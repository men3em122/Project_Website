# Project Website — OrbitAnnotate

Full-stack satellite image annotation platform.

## Structure

| Folder | Description |
|--------|-------------|
| `satellite-annotator/` | Next.js frontend |
| `backend/` | Node.js / Express / MongoDB API |

## Setup

### Backend

```bash
cd backend
cp .env.example .env   # fill in your values
npm install
npm run dev
```

Runs on `http://localhost:5000`.

### Frontend

```bash
cd satellite-annotator
cp .env.example .env.local   # fill in your values
npm install
npm run dev
```

Runs on `http://localhost:3000`.

## Environment variables

- **Backend:** see `backend/.env.example`
- **Frontend:** see `satellite-annotator/.env.example`

Never commit real `.env` or `.env.local` files — they are listed in `.gitignore`.
