"""FastAPI deployment layer for the existing Corvane pipeline CLI."""
from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

BACKEND_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT / "src"))

try:  # supports both `uvicorn app:app --app-dir backend` and `backend.app` imports
    from .upload_registry import UploadInputError, UploadRegistry, validate_upload  # type: ignore[import-not-found]  # noqa: E402
except ImportError:
    from upload_registry import UploadInputError, UploadRegistry, validate_upload  # noqa: E402

INPUT_DIR = PROJECT_ROOT / "extras" / "corvane_data_pack"
CONFIG_DIR = BACKEND_ROOT / "config"
PIPELINE_SCRIPT = BACKEND_ROOT / "scripts" / "run_pipeline.py"
OUTPUT_DIR = Path(os.environ.get("CORVANE_OUTPUT_DIR", PROJECT_ROOT / "outputs")).resolve()
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORVANE_FRONTEND_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
logger = logging.getLogger("corvane.upload")
store = UploadRegistry(INPUT_DIR, CONFIG_DIR, PIPELINE_SCRIPT, OUTPUT_DIR)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Rebuild on startup so only base responses and registry-active uploads appear.
    store.rebuild_active()
    yield


app = FastAPI(
    title="Corvane Fleet Analysis",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


def _validate_upload(filename: str | None, payload: bytes, temp_dir: Path):
    """Compatibility wrapper used by API validation tests."""
    return validate_upload(filename, payload, temp_dir, INPUT_DIR)


@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/uploads")
def upload_history() -> list[dict[str, Any]]:
    return store.list_uploads()


@app.get("/dashboard_data.json")
def dashboard_data() -> FileResponse:
    path = OUTPUT_DIR / "dashboard_data.json"
    if not path.is_file():
        raise HTTPException(status_code=503, detail="Pipeline dashboard data is not available yet.")
    return FileResponse(path, media_type="application/json", headers={"Cache-Control": "no-store"})


@app.get("/api/downloads/{filename}")
def download_output(filename: str) -> FileResponse:
    if filename not in {"mentions.csv", "wrong_facts.csv", "dashboard_data.json"}:
        raise HTTPException(status_code=404, detail="That download is not available.")
    runs = store.list_uploads()
    latest = next((run for run in runs if run["status"] in {"active", "deleted"}), None)
    if latest is None:
        raise HTTPException(status_code=404, detail="No successful upload analysis is available yet.")
    path = OUTPUT_DIR / "uploads" / latest["upload_id"] / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"{filename} has not been generated yet.")
    return FileResponse(path, filename=filename)


@app.post("/api/analyze")
def analyze(file: UploadFile = File(...)) -> dict[str, Any]:
    payload = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The response file exceeds the 20 MB upload limit.")
    try:
        return store.add_upload(file.filename, payload)
    except UploadInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Upload analysis failed")
        raise HTTPException(status_code=500, detail="Analysis failed. Check the backend log and try again.") from exc


@app.delete("/api/uploads/{upload_id}")
def delete_upload(upload_id: str) -> dict[str, Any]:
    try:
        return store.delete_upload(upload_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Upload run not found.") from exc
    except Exception as exc:
        logger.exception("Could not deactivate upload %s", upload_id)
        raise HTTPException(status_code=500, detail="The active dataset could not be recalculated.") from exc


@app.get("/{requested_path:path}")
def frontend_file(requested_path: str) -> FileResponse:
    if requested_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found.")
    index_path = FRONTEND_DIST / "index.html"
    if not index_path.is_file():
        raise HTTPException(status_code=503, detail="Frontend build is unavailable. Build frontend/dist first.")
    candidate = (FRONTEND_DIST / requested_path).resolve()
    if candidate.is_relative_to(FRONTEND_DIST.resolve()) and candidate.is_file():
        return FileResponse(candidate)
    if Path(requested_path).suffix:
        raise HTTPException(status_code=404, detail="Not found.")
    return FileResponse(index_path)
