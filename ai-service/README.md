# OrbitAnnotate AI Service

FastAPI service exposing the SAM2 + YOLO + SegFormer pipeline from
`notebooks/interactive_sam.ipynb` to the web app.

## How it connects

```
Frontend (Next.js :3000)
   │  1. upload file ──────────────► Backend (Express :5000) ──► Cloudinary
   │  2. gets back the Cloudinary URL (kept in frontend state)
   │  3. POST /set-image { imageUrl } ─► AI service (:8000)  → auto YOLO detections
   │  4. click on canvas → POST /segment { imageUrl, x, y } → polygon + label
```

## API

### `POST /set-image`

Input:

```json
{ "imageUrl": "https://res.cloudinary.com/.../image.jpg" }
```

Output — image size + every YOLO detection on the full image:

```json
{
  "width": 1024,
  "height": 768,
  "detections": [
    { "label": "Truck", "confidence": 0.87, "model": "yolo",
      "boundingBox": { "x": 10, "y": 20, "width": 50, "height": 40 } }
  ]
}
```

### `POST /segment`

Input — the Cloudinary URL plus the clicked pixel (image coordinates):

```json
{ "imageUrl": "https://res.cloudinary.com/.../image.jpg", "x": 312, "y": 208 }
```

Output — SAM2 polygon + classification (YOLO box match first, SegFormer
land-cover fallback) and the same shape stats the notebook prints:

```json
{
  "points": [x1, y1, x2, y2, ...],
  "label": "Building",
  "confidence": 0.91,
  "model": "yolo",
  "samScore": 0.97,
  "area": 5230.0,
  "perimeter": 312.4,
  "solidity": 0.93,
  "boundingBox": { "x": 290, "y": 180, "width": 80, "height": 64 },
  "click": { "x": 312, "y": 208 }
}
```

## Run

Use the same Python environment where SAM2 already works (the notebook env):

```powershell
cd d:\Grad\Project_Website\ai-service
pip install -r requirements.txt
copy .env.example .env   # adjust paths if your checkpoints moved
python main.py           # serves on http://localhost:8000
```

First startup downloads the SegFormer weights from Hugging Face and loads
SAM2 + YOLO onto the GPU (CUDA if available).
