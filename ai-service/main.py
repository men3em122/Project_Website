"""
OrbitAnnotate AI Service  — OFFLINE MODE
=========================================
FastAPI wrapper around the interactive SAM2 + YOLO + SegFormer pipeline.
All models run locally; no internet connection is required at runtime.

Model locations (all resolved relative to ai-service/):
  SAM2 checkpoint : checkpoints/sam2.1_hiera_large.pt
  YOLO weights    : weights of yolo model/best.pt
  SegFormer       : local_segformer/  (must contain config.json + model weights)

Endpoints
---------
POST /set-image   { imageUrl }            -> { width, height, detections[] }
POST /segment     { imageUrl, x, y }      -> { points[], label, confidence, ... }
GET  /health                              -> { status, device, models }
"""

import os
import sys

# Keep transformers from importing TensorFlow/Flax — we only use PyTorch.
# This saves ~1.5 GB of RAM and a lot of startup time on low-memory machines.
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_FLAX", "0")
os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")

# Prevent the transformers library from downloading anything from Hugging Face.
# All models must be present locally. Remove this line only if you want to
# allow an initial download of the SegFormer weights.
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_DATASETS_OFFLINE", "1")

import io
import threading

import numpy as np
import cv2
import torch
import requests
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from skimage.measure import regionprops
from dotenv import load_dotenv

load_dotenv()

# ─── Config (override via .env) ───────────────────────────────────────────────
# Model paths resolve in this order:
#   1. environment variable (e.g. set in ai-service/.env)
#   2. the local model folders inside ai-service/ (see README for downloads)
#   3. a final fallback (legacy dev path / Hugging Face model id)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _first_existing(*candidates: str, fallback: str) -> str:
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return fallback


SAM2_CHECKPOINT = os.getenv("SAM2_CHECKPOINT") or _first_existing(
    os.path.join(BASE_DIR, "checkpoints", "sam2.1_hiera_large.pt"),
    fallback=r"C:\Users\menna\Desktop\sam\sam2\checkpoints\sam2.1_hiera_large (1).pt",
)
# When SAM2 is installed via `pip install -e .` from the GitHub repo, Hydra
# resolves this relative config name from the installed sam2 package.
SAM2_CONFIG = os.getenv("SAM2_CONFIG") or _first_existing(
    r"C:\Users\menna\Desktop\sam\sam2\sam2\configs\sam2.1\sam2.1_hiera_l.yaml",
    fallback="configs/sam2.1/sam2.1_hiera_l.yaml",
)
YOLO_WEIGHTS = os.getenv("YOLO_WEIGHTS") or _first_existing(
    os.path.join(BASE_DIR, "weights of yolo model", "best.pt"),
    fallback=r"C:\Users\menna\Desktop\sam\sam2\runs\detect\train-3\weights\best.pt",
)
_LOCAL_SEGFORMER = os.path.join(BASE_DIR, "local_segformer")

# In offline mode the local directory MUST contain the model weights in
# addition to config.json.  Presence of either pytorch_model.bin or
# model.safetensors is used as the "weights present" signal.
_segformer_has_weights = any(
    os.path.exists(os.path.join(_LOCAL_SEGFORMER, f))
    for f in ("pytorch_model.bin", "model.safetensors")
)

SEGFORMER_MODEL = os.getenv("SEGFORMER_MODEL") or (
    _LOCAL_SEGFORMER if _segformer_has_weights else None
)

if SEGFORMER_MODEL is None:
    print(
        "\n❌  SegFormer model weights not found in ai-service/local_segformer/\n"
        "   Download the weights once (with internet) and place them there:\n"
        "     pytorch_model.bin  OR  model.safetensors\n"
        "   alongside the existing config.json / preprocessor_config.json.\n"
        "   You can download with:\n"
        "     python -c \"from transformers import SegformerForSemanticSegmentation; "
        "SegformerForSemanticSegmentation.from_pretrained("
        "'wu-pr-gw/segformer-b2-finetuned-with-LoveDA').save_pretrained('local_segformer')\"\n",
        file=sys.stderr,
    )
    sys.exit(1)
YOLO_CONF_THRESHOLD = float(os.getenv("YOLO_CONF_THRESHOLD", "0.10"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

SEG_CLASSES_DICT = {
    0: "Unlabeled",
    1: "Background",
    2: "Building",
    3: "Road",
    4: "Water",
    5: "Barren",
    6: "Forest",
    7: "Agriculture",
}

YOLO_CLASSES_DICT = {
    0: "Small Aircraft",
    1: "Cargo Aircraft",
    2: "Passenger Vehicle",
    3: "Truck",
    4: "Maritime Vessel",
    5: "Engineering Vehicle",
    6: "Building",
    7: "Small Building",
    8: "Large Building",
}

# ─── Model loading (once at startup) ──────────────────────────────────────────
torch.cuda.empty_cache()
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Loading models on {device}...")

from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor
from transformers import AutoImageProcessor, SegformerForSemanticSegmentation
from ultralytics import YOLO

sam2_model = build_sam2(SAM2_CONFIG, SAM2_CHECKPOINT, device=device)
predictor = SAM2ImagePredictor(sam2_model)

processor = AutoImageProcessor.from_pretrained(SEGFORMER_MODEL)
seg_model = SegformerForSemanticSegmentation.from_pretrained(SEGFORMER_MODEL).to(device)
seg_model.eval()

yolo_model = YOLO(YOLO_WEIGHTS)

print("All models READY")

# ─── Per-image cache ──────────────────────────────────────────────────────────
# The SAM2 predictor holds one embedded image at a time, so we cache the state
# of the most recently analyzed image, keyed by its URL.
_lock = threading.Lock()
_cache = {
    "url": None,           # image URL currently loaded
    "image_rgb": None,     # np.ndarray HxWx3
    "yolo_boxes": [],      # [(xmin, ymin, xmax, ymax, cls_id, conf), ...]
    "semantic_mask": None, # np.ndarray HxW of SegFormer class ids
}


def _download_image(url: str) -> np.ndarray:
    """Fetch the image from the local Express backend (http://localhost:5000/uploads/...)."""
    try:
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=422, detail=f"Could not download image: {exc}")
    try:
        img = Image.open(io.BytesIO(resp.content))
        return np.array(img.convert("RGB"))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid image data: {exc}")


def _run_yolo(image_rgb: np.ndarray):
    results = yolo_model(image_rgb, imgsz=640, verbose=False)
    boxes = []
    for box in results[0].boxes:
        xyxy = box.xyxy[0].cpu().numpy()
        cls_id = int(box.cls[0].cpu().numpy())
        conf = float(box.conf[0].cpu().numpy())
        if conf > YOLO_CONF_THRESHOLD:
            boxes.append((float(xyxy[0]), float(xyxy[1]), float(xyxy[2]), float(xyxy[3]), cls_id, conf))
    return boxes


def _run_segformer(image_rgb: np.ndarray) -> np.ndarray:
    """Full-image semantic mask, computed once per image and cached."""
    inputs = processor(images=Image.fromarray(image_rgb), return_tensors="pt").to(device)
    with torch.no_grad():
        logits = seg_model(**inputs).logits
    upsampled = torch.nn.functional.interpolate(
        logits,
        size=(image_rgb.shape[0], image_rgb.shape[1]),
        mode="bilinear",
        align_corners=False,
    )
    return upsampled.argmax(dim=1)[0].cpu().numpy()


def _ensure_image(url: str):
    """Load + embed the image and cache YOLO/SegFormer outputs if not already cached."""
    if _cache["url"] == url:
        return
    image_rgb = _download_image(url)
    predictor.set_image(image_rgb)
    _cache["url"] = url
    _cache["image_rgb"] = image_rgb
    _cache["yolo_boxes"] = _run_yolo(image_rgb)
    _cache["semantic_mask"] = _run_segformer(image_rgb)


def _segformer_class_for_mask(mask_bool: np.ndarray):
    """Majority SegFormer class inside the mask (same logic as the notebook)."""
    semantic_mask = _cache["semantic_mask"]
    mask_pixels = semantic_mask[mask_bool].astype(np.int64)
    if mask_pixels.size == 0:
        return "Unknown", 0.0

    valid = mask_pixels[mask_pixels > 1]  # skip Unlabeled/Background when possible
    pool = valid if valid.size > 0 else mask_pixels
    counts = np.bincount(pool)
    class_id = int(counts.argmax())
    confidence = float(counts[class_id] / pool.size)
    label = SEG_CLASSES_DICT.get(class_id, f"Class_{class_id}")
    return label, confidence


def _yolo_match(x: float, y: float):
    """Return (label, confidence, box) if the click is inside a YOLO detection."""
    for xmin, ymin, xmax, ymax, cls_id, conf in _cache["yolo_boxes"]:
        if xmin <= x <= xmax and ymin <= y <= ymax:
            label = YOLO_CLASSES_DICT.get(cls_id, f"Class_{cls_id}")
            box = {"x": xmin, "y": ymin, "width": xmax - xmin, "height": ymax - ymin}
            return label, conf, box
    return None


def _mask_to_polygon(mask_bool: np.ndarray, max_points: int = 100):
    """Largest contour of the mask as a flat [x1, y1, x2, y2, ...] polygon."""
    contours, _ = cv2.findContours(
        mask_bool.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return []
    contour = max(contours, key=cv2.contourArea)
    epsilon = 0.002 * cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, epsilon, True).reshape(-1, 2)
    if len(approx) > max_points:
        idx = np.linspace(0, len(approx) - 1, max_points).astype(int)
        approx = approx[idx]
    return [float(v) for v in approx.flatten()]


# ─── API ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="OrbitAnnotate AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SetImageRequest(BaseModel):
    imageUrl: str


class SegmentRequest(BaseModel):
    imageUrl: str
    x: float
    y: float


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": str(device),
        "models": {"sam2": True, "yolo": True, "segformer": True},
    }


@app.post("/set-image")
def set_image(req: SetImageRequest):
    with _lock:
        _ensure_image(req.imageUrl)
        h, w = _cache["image_rgb"].shape[:2]
        detections = [
            {
                "label": YOLO_CLASSES_DICT.get(cls_id, f"Class_{cls_id}"),
                "confidence": conf,
                "model": "yolo",
                "boundingBox": {"x": xmin, "y": ymin, "width": xmax - xmin, "height": ymax - ymin},
            }
            for xmin, ymin, xmax, ymax, cls_id, conf in _cache["yolo_boxes"]
        ]
    return {"width": w, "height": h, "detections": detections}


@app.post("/segment")
def segment(req: SegmentRequest):
    with _lock:
        _ensure_image(req.imageUrl)
        h, w = _cache["image_rgb"].shape[:2]
        x = float(np.clip(req.x, 0, w - 1))
        y = float(np.clip(req.y, 0, h - 1))

        masks, scores, _ = predictor.predict(
            point_coords=np.array([[x, y]]),
            point_labels=np.array([1]),
            multimask_output=False,
        )
        mask_bool = masks[0].astype(bool)
        props = regionprops(mask_bool.astype(np.uint8))
        if not props:
            raise HTTPException(status_code=422, detail="SAM2 produced an empty mask at this point")
        p = props[0]

        points = _mask_to_polygon(mask_bool)
        if not points:
            raise HTTPException(status_code=422, detail="Could not extract a polygon from the mask")

        # Classification: YOLO box match first, SegFormer land-cover fallback
        yolo_hit = _yolo_match(x, y)
        if yolo_hit is not None:
            label, confidence, bounding_box = yolo_hit
            model_used = "yolo"
        else:
            label, confidence = _segformer_class_for_mask(mask_bool)
            model_used = "segformer"
            min_r, min_c, max_r, max_c = p.bbox
            bounding_box = {
                "x": float(min_c),
                "y": float(min_r),
                "width": float(max_c - min_c),
                "height": float(max_r - min_r),
            }

    return {
        "points": points,
        "label": label,
        "confidence": confidence,
        "model": model_used,
        "samScore": float(scores[0]),
        "area": float(p.area),
        "perimeter": round(float(p.perimeter), 2),
        "solidity": round(float(p.solidity), 2),
        "boundingBox": bounding_box,
        "click": {"x": x, "y": y},
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
