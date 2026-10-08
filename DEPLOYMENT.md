# Deployment and local setup

The project is configured for local development, Vercel, and Render. **It has not been deployed**
as part of this case study.

## Local development

From the repository root, install the backend and generate the initial baseline outputs:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python backend/scripts/run_pipeline.py
```

Start the API in one terminal from the repository root:

```powershell
python -m uvicorn app:app --app-dir backend --host 127.0.0.1 --port 8000
```

In a second terminal, start the frontend:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to FastAPI at `127.0.0.1:8000`. Local generated
outputs remain under the project-root `outputs/` directory by default, including
`outputs/upload_registry.sqlite3` and `outputs/uploads/<upload_id>/`. Set
`CORVANE_OUTPUT_DIR` only if you intentionally want a different local path; the effective
configuration is resolved by `backend/app.py` and used for both the registry and pipeline outputs.

Run verification from the repository root for Python, then from `frontend/` for JavaScript:

```powershell
python -m unittest discover -s backend/tests -v
cd frontend
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build
```

## Vercel frontend

- Set the Vercel project root to `frontend`.
- Install with `npm ci`; build with `npm run build` (Vite writes to `dist`).
- Set `VITE_API_URL` to the Render service origin, for example `https://your-service.onrender.com`.
  This is a build-time environment variable. Production frontend requests use it; production does
  not fall back to localhost.

## Render backend

- Deploy using the repository-root `Dockerfile` and repository-root build context.
- Attach a persistent disk mounted at `/var/data`.
- Set `CORVANE_OUTPUT_DIR=/var/data/outputs`.
- Set `CORVANE_FRONTEND_ORIGIN` to the exact Vercel origin. Comma-separated origins are supported
  for additional preview origins.
- Set the health check path to `/health`. The Docker start command binds to Render's `PORT` value,
  with 8000 as the local Docker fallback.

With that disk mounted, generated outputs are stored at `/var/data/outputs/`, the SQLite registry at
`/var/data/outputs/upload_registry.sqlite3`, and per-run files at
`/var/data/outputs/uploads/<upload_id>/`. The registry path is derived from the same configured
output directory as the files, so neither is kept only in the ephemeral application image.

Deleting a run is a logical deletion: its registry row becomes inactive/deleted, then the backend
recomputes current outputs from the immutable base plus active uploads. The uploaded JSONL and
generated files for the deleted run remain on the persistent disk for audit. Local development uses
the same layout under root `outputs/`; it does not require a database service or paid API.
