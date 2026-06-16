# OrbitAnnotate

Full-stack satellite image annotation platform. Upload a satellite image, the
AI pipeline (SAM2 + YOLO + SegFormer) segments and classifies objects you click,
and annotations can be saved to categories or exported as a YOLOv8 segmentation
training dataset.

---

## Project structure

| Folder | Description |
|--------|-------------|
| `satellite-annotator/` | Next.js 16 frontend (port 3000) |
| `backend/` | Node.js / Express / MongoDB / Cloudinary API (port 5000) |
| `ai-service/` | Python FastAPI — SAM2 + YOLO + SegFormer (port 8000) |

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

### a) Install SAM2

SAM2 must be installed as a Python package from
[github.com/facebookresearch/sam2](https://github.com/facebookresearch/sam2):

```bash
git clone https://github.com/facebookresearch/sam2.git
cd sam2
pip install -e .
```

> On Windows, CPython + CUDA on native Windows works fine for inference.

Then download the **SAM 2.1 Hiera-Large checkpoint** and place it in
`ai-service/checkpoints/`:

```bash
curl -L -o "ai-service/checkpoints/sam2.1_hiera_large.pt" ^
  https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_large.pt
```

### b) YOLO weights

Place the trained weights at:

```
ai-service/weights of yolo model/best.pt
```

### c) SegFormer (land-cover classification)

The land-cover classifier is
[`wu-pr-gw/segformer-b2-finetuned-with-LoveDA`](https://huggingface.co/wu-pr-gw/segformer-b2-finetuned-with-LoveDA)
(classes: Building, Road, Water, Barren, Forest, Agriculture, Background).

**Default:** do nothing — it downloads from Hugging Face on the first start
and is cached automatically.

**Optional local copy** (faster cold starts):

```bash
cd ai-service
python -c "
from transformers import SegformerForSemanticSegmentation, AutoImageProcessor
m = 'wu-pr-gw/segformer-b2-finetuned-with-LoveDA'
SegformerForSemanticSegmentation.from_pretrained(m).save_pretrained('local_segformer')
AutoImageProcessor.from_pretrained(m).save_pretrained('local_segformer')
"
```

### d) Install dependencies and run

```bash
cd ai-service
pip install -r requirements.txt
python -u main.py             # serves on http://localhost:8000
```

```bash
curl http://localhost:8000/health
# {"status":"ok","device":"cuda","models":{"sam2":true,"yolo":true,"segformer":true}}
```

---

## 2. Backend setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev            # http://localhost:5000
```

Required `.env` values (see `backend/.env.example`):

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxx.mongodb.net/satellite_annotator
JWT_SECRET=<any long random string>
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>
```

---

## 3. Frontend setup

```bash
cd satellite-annotator
npm install
npm run dev            # http://localhost:3000
```

Create `satellite-annotator/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

---

## Running the whole project

Start the three services in separate terminals:

```bash
# Terminal 1 — AI service
cd ai-service
python -u main.py

# Terminal 2 — backend
cd backend
npm run dev

# Terminal 3 — frontend
cd satellite-annotator
npm run dev
```

Then open <http://localhost:3000>, sign up, go to **Annotate**, and upload a
satellite image (JPEG/PNG/TIFF). Click any object to get a SAM2 segmentation
polygon with a YOLO/SegFormer label, then save to a category or use **Export**
to download a YOLOv8-segmentation dataset ZIP.

---

## Environment files

Never commit real `.env` / `.env.local` files or model weights — both are
listed in `.gitignore`.
