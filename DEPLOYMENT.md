# Deployment and local setup

The application is deployed with a Vercel frontend and Railway backend.

- Dashboard: <https://visibility-tracker-beta.vercel.app/>
- Backend health: <https://visibility-tracker-production-cd2c.up.railway.app/health>
- Source repository: <https://github.com/krishnakumar51/visibility-tracker>

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
- Set `VITE_API_URL` to the Railway backend origin, `https://visibility-tracker-production-cd2c.up.railway.app`.
  This is a build-time environment variable. Production frontend requests use it; production does
  not fall back to localhost.

## Railway backend

- Deploy the repository using its root-level `Dockerfile`.
- The configured health check path is `/health`.
- Set `CORVANE_OUTPUT_DIR=/var/data/outputs`.
- Set `CORVANE_FRONTEND_ORIGIN=https://visibility-tracker-beta.vercel.app`.
- The Dockerfile starts Uvicorn and binds to Railway's `PORT` (8000 fallback).

The configured registry location is `/var/data/outputs/upload_registry.sqlite3`; each run is stored
under `/var/data/outputs/uploads/<upload_id>/`. The repository configuration establishes these paths,
but does not establish whether a Railway persistent volume is mounted at `/var/data`. Confirm that
storage mount in Railway before relying on upload history and generated files surviving redeploys.

Deleting a run is a logical deletion: its registry row becomes inactive/deleted, then the backend
recomputes current outputs from the immutable base plus active uploads. The uploaded JSONL and
generated files for the deleted run remain in the configured output directory. Local development
uses the same layout under root `outputs/`; it does not require a database service or paid API.
