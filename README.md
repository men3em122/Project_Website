# OrbitAnnotate — Online Mode (`main` branch)

Full-stack satellite image annotation platform. Upload a satellite image, the
AI pipeline (SAM2 + YOLO + SegFormer) segments and classifies objects you click,
and annotations can be saved to categories or exported as a YOLOv8 segmentation
training dataset.

> **Branch overview**
>
> | Branch | Storage | Image hosting | Internet required |
> |--------|---------|---------------|-------------------|
> | `main` | MongoDB Atlas | Cloudinary CDN | Yes |
> | `offline-use` | SQLite file | Local `/uploads/` | No |

---

## Project structure

| Folder | Description |
|--------|-------------|
| `satellite-annotator/` | Next.js 16 frontend (port 3000) |
| `backend/` | Node.js / Express / MongoDB / Cloudinary API (port 5000) |
| `ai-service/` | Python FastAPI — SAM2 + YOLO + SegFormer (port 8000) |

## How it connects (online mode)

```
Frontend (:3000)
   │ 1. upload file ──────────► Backend (:5000) ──► Cloudinary (image hosting)
   │ 2. gets back the Cloudinary URL (kept in frontend state)
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

    [1]  main         (MongoDB Atlas + Cloudinary)  <-- you are here
    [2]  offline-use  (SQLite + local uploads)

  Enter 1 or 2:
```

- Pick **1** for online / cloud mode.
- First time on `main`: the script prompts for your MongoDB URI and Cloudinary
  credentials and saves them to `.env.main.secrets` (gitignored). Every run
  after that reads them silently.
- The script writes the correct `.env` files, runs `npm install` / `pip install`,
  then opens three terminal windows — one per service.
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
 └── local_segformer/             ← (optional) local SegFormer copy goes here
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

### c) SegFormer (land-cover classification)

The land-cover classifier is
[`wu-pr-gw/segformer-b2-finetuned-with-LoveDA`](https://huggingface.co/wu-pr-gw/segformer-b2-finetuned-with-LoveDA).

**Default (online mode):** nothing to do — it downloads from Hugging Face on
the first start and is cached automatically.

**Optional local copy:** to pre-download for faster cold starts or offline use:

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

Required `backend/.env` keys for online mode:

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

## Switching to offline mode

Run `.\start.ps1` and pick **2** — the script automatically:

1. Runs `git checkout offline-use`
2. Writes a `backend/.env` with `SERVER_URL` + `SQLITE_PATH` (no cloud credentials needed)
3. Sets `TRANSFORMERS_OFFLINE=1` so SegFormer loads only from `local_segformer/`
4. Installs the correct npm packages (`sql.js` instead of `mongoose` + `cloudinary`)

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
