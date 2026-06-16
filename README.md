# OrbitAnnotate — Offline Mode (`offline-use` branch)

Full-stack satellite image annotation platform. Upload a satellite image, the
AI pipeline (SAM2 + YOLO + SegFormer) segments and classifies objects you click,
and annotations can be saved to categories or exported as a YOLOv8 segmentation
training dataset.

> **Branch overview**
>
> | Branch | Storage | Image hosting | Internet required |
> |--------|---------|---------------|-------------------|
> | `offline-use` | SQLite file | Local `/uploads/` | No |
> | `main` | MongoDB Atlas | Cloudinary CDN | Yes |

---

## Project structure

| Folder | Description |
|--------|-------------|
| `satellite-annotator/` | Next.js 16 frontend (port 3000) |
| `backend/` | Node.js / Express / SQLite API (port 5000) |
| `ai-service/` | Python FastAPI — SAM2 + YOLO + SegFormer (port 8000) |

## How it connects (offline mode)

```
Frontend (:3000)
   │ 1. upload file ──────────► Backend (:5000) ──► saves to backend/uploads/
   │ 2. gets back a local URL  http://localhost:5000/uploads/<file>
   │ 3. POST /set-image { imageUrl } ──► AI service (:8000)  (warm-up + YOLO)
   │ 4. click on canvas ──► POST /segment { imageUrl, x, y } (SAM2 polygon + label)
```

---

## Quick start (recommended)

A PowerShell launcher handles branch selection, `.env` configuration, dependency
installation, and starts all three services automatically.

```powershell
# From the Project_Website folder — only needs to be done once:
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

# Every time you want to start the project:
cd D:\Grad\Project_Website
.\start.ps1
```

The script will ask:

```
  OrbitAnnotate - Which mode do you want to run?

    [1]  main         (MongoDB Atlas + Cloudinary)
    [2]  offline-use  (SQLite + local uploads)      <-- you are here

  Enter 1 or 2:
```

- Pick **2** for offline mode.
- The script switches the git branch, writes the correct `.env` files, runs
  `npm install` / `pip install`, then opens three terminal windows — one per
  service.
- To stop everything: `.\stop.ps1`

> **-SkipInstall flag** — If dependencies are already installed and you just
> want a fast restart, use `.\start.ps1 -SkipInstall`.

---

## One-time setup — AI models

> Only needed once. These files are **not committed** (listed in `.gitignore`).

```
ai-service/
 ├── checkpoints/                 ← SAM2 checkpoint (.pt) goes here
 ├── weights of yolo model/       ← YOLO weights (best.pt) go here
 └── local_segformer/             ← SegFormer weights go here (REQUIRED for offline)
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

Download the **SAM 2.1 Hiera-Large** checkpoint into `ai-service/checkpoints/`:

```bash
curl -L -o "ai-service/checkpoints/sam2.1_hiera_large.pt" ^
  https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_large.pt
```

### b) YOLO weights

Place your trained weights at:

```
ai-service/weights of yolo model/best.pt
```

### c) SegFormer — download once, run offline forever

On the `offline-use` branch `TRANSFORMERS_OFFLINE=1` is set automatically, so
the model **must** already exist in `local_segformer/`. Run this once on a
machine with internet access:

```bash
cd ai-service
python -c "
from transformers import SegformerForSemanticSegmentation, AutoImageProcessor
m = 'wu-pr-gw/segformer-b2-finetuned-with-LoveDA'
SegformerForSemanticSegmentation.from_pretrained(m).save_pretrained('local_segformer')
AutoImageProcessor.from_pretrained(m).save_pretrained('local_segformer')
print('Saved to local_segformer/')
"
```

After this the AI service starts with no internet connection at all.

### d) Install AI service Python dependencies

```bash
cd ai-service
pip install -r requirements.txt
```

> `.\start.ps1` runs `pip install` automatically on every launch.

Verify the service is healthy:

```bash
curl http://localhost:8000/health
# {"status":"ok","device":"cuda","models":{"sam2":true,"yolo":true,"segformer":true}}
```

---

## Manual setup (alternative to start.ps1)

### Backend

```bash
cd backend
npm install
npm run dev            # http://localhost:5000
```

Required `backend/.env` keys for offline mode:

```env
PORT=5000
NODE_ENV=development
SERVER_URL=http://localhost:5000
SQLITE_PATH=./data/database.db
JWT_SECRET=<any long random string>
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

> `start.ps1` writes this file automatically on every run.

### Frontend

```bash
cd satellite-annotator
npm install
npm run dev            # http://localhost:3000
```

`satellite-annotator/.env.local` (created automatically by `start.ps1`):

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

### AI service

```bash
cd ai-service
python -u main.py      # http://localhost:8000
```

---

## Switching to online mode (main branch)

Run `.\start.ps1` and pick **1** — the script automatically:

1. Runs `git checkout main`
2. Writes a `backend/.env` with MongoDB + Cloudinary credentials
3. Sets `TRANSFORMERS_OFFLINE=0` so SegFormer can download from Hugging Face
4. Installs the correct npm packages (`mongoose` + `cloudinary` instead of `sql.js`)

First time on `main`: the script will prompt for your MongoDB URI and Cloudinary
credentials and save them to `.env.main.secrets` (gitignored).

---

## Environment files

| File | Created by | Committed |
|------|-----------|-----------|
| `backend/.env` | `start.ps1` (auto) | No |
| `ai-service/.env` | `start.ps1` (auto) | No |
| `satellite-annotator/.env.local` | `start.ps1` (auto, first run) | No |
| `.env.main.secrets` | `start.ps1` (first run on main) | No |
| `backend/.env.example` | Manually maintained | Yes |
| `ai-service/.env.example` | Manually maintained | Yes |

Never commit real `.env` files or model weights — both are in `.gitignore`.
