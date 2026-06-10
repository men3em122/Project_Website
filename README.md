# Project Website — OrbitAnnotate

Full-stack satellite image annotation platform. Upload a satellite image, the
AI pipeline (SAM2 + YOLO + SegFormer) segments and classifies the objects you
click, and the annotations can be saved to categories or exported as a
YOLOv8 segmentation training dataset.

## Structure

| Folder | Description |
|--------|-------------|
| `satellite-annotator/` | Next.js frontend (port 3000) |
| `backend/` | Node.js / Express / MongoDB / Cloudinary API (port 5000) |
| `ai-service/` | Python FastAPI AI service — SAM2 + YOLO + SegFormer (port 8000) |

## How it connects

```
Frontend (:3000)
   │ 1. upload file ──────────► Backend (:5000) ──► Cloudinary (image hosting)
   │ 2. gets back the Cloudinary URL (kept in frontend state)
   │ 3. POST /set-image { imageUrl } ──► AI service (:8000)  (warm-up + YOLO)
   │ 4. click on canvas ──► POST /segment { imageUrl, x, y } (SAM2 polygon + label)
```

---

## 1. AI Service setup (models)

The AI service needs **Python ≥ 3.10**, PyTorch (CUDA recommended), and three
models. All model files live inside `ai-service/` and are **not committed to
git** — download them as described below.

```
ai-service/
 ├── checkpoints/                 ← SAM2 checkpoint (.pt) goes here
 ├── weights of yolo model/       ← trained YOLO weights (best.pt) go here
 ├── local_segformer/             ← (optional) local SegFormer copy goes here
 ├── main.py
 └── requirements.txt
```

### a) Install SAM2 (from the official repo)

SAM2 must be installed as a Python package from
[github.com/facebookresearch/sam2](https://github.com/facebookresearch/sam2):

```bash
git clone https://github.com/facebookresearch/sam2.git
cd sam2
pip install -e .
```

> On Windows this works in a normal Python environment; the official repo
> recommends WSL, but CPython + CUDA on native Windows is fine for inference.

Then download the **SAM 2.1 Hiera-Large checkpoint** and place it in
`ai-service/checkpoints/`:

```bash
# from the Project_Website folder
curl -L -o "ai-service/checkpoints/sam2.1_hiera_large.pt" ^
  https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_large.pt
```

(Other sizes — tiny / small / base_plus — are listed in the SAM2 repo README.
If you use a different one, set `SAM2_CHECKPOINT` and `SAM2_CONFIG` in
`ai-service/.env`.)

The model config `configs/sam2.1/sam2.1_hiera_l.yaml` ships inside the
installed `sam2` package, so no extra download is needed for it.

### b) YOLO weights (custom xView-trained model)

The object detector is a custom **Ultralytics YOLO** model trained on xView
satellite classes (Small Aircraft, Cargo Aircraft, Passenger Vehicle, Truck,
Maritime Vessel, Engineering Vehicle, Building, Small/Large Building).

Place the trained weights file at:

```
ai-service/weights of yolo model/best.pt
```

If you trained it yourself with Ultralytics, the file is the training output
`runs/detect/<run-name>/weights/best.pt`. If a teammate trained it, get
`best.pt` from them (or your shared drive / GitHub release) and drop it in
that folder.

### c) SegFormer (land-cover classification)

The land-cover classifier is
[`wu-pr-gw/segformer-b2-finetuned-with-LoveDA`](https://huggingface.co/wu-pr-gw/segformer-b2-finetuned-with-LoveDA)
(classes: Building, Road, Water, Barren, Forest, Agriculture, Background).

**Option 1 — automatic (default):** do nothing. It downloads from Hugging
Face on the first start and is cached.

**Option 2 — local copy (offline use):** save it into
`ai-service/local_segformer/` once, and the service will load it from disk:

```bash
cd ai-service
python -c "from transformers import AutoImageProcessor, SegformerForSemanticSegmentation; m='wu-pr-gw/segformer-b2-finetuned-with-LoveDA'; AutoImageProcessor.from_pretrained(m).save_pretrained('local_segformer'); SegformerForSemanticSegmentation.from_pretrained(m).save_pretrained('local_segformer')"
```

### d) Install dependencies and run

```bash
cd ai-service
pip install -r requirements.txt
copy .env.example .env        # optional — only needed to override defaults
python -u main.py             # serves on http://localhost:8000
```

Model paths resolve automatically: environment variable → local folder inside
`ai-service/` → Hugging Face download (SegFormer only). Check it's alive:

```bash
curl http://localhost:8000/health
# {"status":"ok","device":"cuda","models":{"sam2":true,"yolo":true,"segformer":true}}
```

---

## 2. Backend setup

```bash
cd backend
cp .env.example .env   # fill in MongoDB URI, JWT secret, Cloudinary credentials
npm install
npm run dev            # http://localhost:5000
```

Required `.env` values (see `backend/.env.example`):

- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — any long random string
- `CLOUDINARY_URL` / `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
- `FRONTEND_URL` — `http://localhost:3000`

## 3. Frontend setup

```bash
cd satellite-annotator
npm install
npm run dev            # http://localhost:3000
```

Create `satellite-annotator/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

---

## Running the whole project

Start the three services in any order (three terminals):

```bash
# Terminal 1 — AI service
cd ai-service && python -u main.py

# Terminal 2 — backend
cd backend && npm run dev

# Terminal 3 — frontend
cd satellite-annotator && npm run dev
```

Then open <http://localhost:3000>, sign up, go to **Annotate**, and upload a
satellite image (JPEG/PNG/TIFF — TIFF is converted to JPEG automatically).
Click any object to get a SAM2 segmentation polygon with a YOLO/SegFormer
label, then save to a category or use **Export** to download a
YOLOv8-segmentation dataset ZIP (`dataset/images`, `dataset/labels`,
`classes.txt`, `data.yaml`).

## Environment files

Never commit real `.env` / `.env.local` files or model weights — both are
listed in `.gitignore`.
