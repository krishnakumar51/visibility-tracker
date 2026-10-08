"""Persistent upload registry and active-dataset recomputation."""
from __future__ import annotations

import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any
from uuid import uuid4

BACKEND_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_ROOT / "src"))
from corvane_pipeline.loader import load_pack, load_responses

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
SNAPSHOT_FILES = ("dashboard_data.json", "mentions.csv", "wrong_facts.csv")
PUBLISHED_FILES = (
    "dashboard_data.json",
    "mentions.csv",
    "wrong_facts.csv",
    "analytics.json",
    "evaluation.json",
    "quality_report.json",
    "manual_review.csv",
)


class UploadInputError(ValueError):
    pass


def validate_upload(
    filename: str | None, payload: bytes, temp_dir: Path, input_dir: Path
) -> tuple[int, list[dict[str, Any]]]:
    if not Path(filename or "").name.lower().endswith(".jsonl"):
        raise UploadInputError("Choose a .jsonl response file.")
    if not payload.strip():
        raise UploadInputError("The JSONL file is empty.")
    try:
        payload.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise UploadInputError("The JSONL file must use UTF-8 encoding.") from exc

    candidate = temp_dir / "uploaded.jsonl"
    candidate.write_bytes(payload)
    records, malformed, _ = load_responses(candidate)
    if malformed:
        lines = ", ".join(str(row["source_line"]) for row in malformed[:5])
        raise UploadInputError(
            f"Invalid JSONL at line(s) {lines}; each non-empty line must be a JSON object."
        )
    if not records:
        raise UploadInputError("The file contains no response records.")

    prompts = load_pack(input_dir)["prompts"]
    weeks: set[int] = set()
    issues: list[str] = []
    for line, record in enumerate(records, start=1):
        actionable = [issue for issue in record["issues"] if not issue.startswith("source_error:")]
        if actionable:
            issues.append(f"line {line}: {', '.join(actionable)}")
            continue
        week = record["week"]
        if week is None or week < 1:
            issues.append(f"line {line}: week must be a positive integer")
        else:
            weeks.add(week)
        if record["prompt_id"] not in prompts:
            issues.append(f"line {line}: unknown prompt_id {record['prompt_id']}")
    if issues:
        raise UploadInputError("Invalid response record(s): " + "; ".join(issues[:5]))
    if len(weeks) != 1:
        raise UploadInputError("Upload one week's responses at a time; records contain multiple week values.")
    return next(iter(weeks)), records


class UploadRegistry:
    def __init__(
        self,
        input_dir: Path,
        config_dir: Path,
        pipeline_script: Path,
        output_dir: Path,
        python_executable: str | None = None,
    ) -> None:
        self.input_dir = input_dir.resolve()
        self.config_dir = config_dir.resolve()
        self.pipeline_script = pipeline_script.resolve()
        self.output_dir = output_dir.resolve()
        self.uploads_dir = self.output_dir / "uploads"
        self.database_path = self.output_dir / "upload_registry.sqlite3"
        self.python_executable = python_executable or sys.executable
        self.lock = RLock()
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self._initialize_database()
        self._import_existing_runs()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        return connection

    @contextmanager
    def _connection(self):
        connection = self._connect()
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _initialize_database(self) -> None:
        with self._connection() as connection:
            connection.execute(
                """CREATE TABLE IF NOT EXISTS uploads (
                    upload_id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    detected_week INTEGER NOT NULL,
                    uploaded_at TEXT NOT NULL,
                    response_count INTEGER NOT NULL,
                    success_count INTEGER NOT NULL,
                    failed_count INTEGER NOT NULL,
                    coverage REAL,
                    status TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 0,
                    deleted_at TEXT
                )"""
            )
            connection.execute(
                "UPDATE uploads SET status='failed', active=0 WHERE status='processing'"
            )

    def _import_existing_runs(self) -> None:
        """Adopt complete run folders created before the SQLite registry existed."""
        for run_dir in sorted(self.uploads_dir.iterdir(), key=lambda path: path.name):
            if not run_dir.is_dir() or run_dir.name.startswith("."):
                continue
            uploaded_path = run_dir / "uploaded_responses.jsonl"
            if not uploaded_path.is_file() or not all(
                (run_dir / filename).is_file() for filename in SNAPSHOT_FILES
            ):
                continue
            with self._connection() as connection:
                if connection.execute(
                    "SELECT 1 FROM uploads WHERE upload_id=?", (run_dir.name,)
                ).fetchone():
                    continue
            try:
                records, malformed, _ = load_responses(uploaded_path)
                dashboard = json.loads((run_dir / "dashboard_data.json").read_text(encoding="utf-8"))
            except (OSError, UnicodeError, json.JSONDecodeError):
                continue
            weeks = {record["week"] for record in records if record["week"] is not None}
            if malformed or len(weeks) != 1:
                continue
            week = next(iter(weeks))
            score = next(
                (item for item in dashboard.get("scores", []) if item.get("week") == week),
                {},
            )
            statuses = [record["status"] for record in records]
            uploaded_at = datetime.fromtimestamp(
                uploaded_path.stat().st_mtime, timezone.utc
            ).isoformat()
            with self._connection() as connection:
                connection.execute(
                    """INSERT OR IGNORE INTO uploads
                    (upload_id, filename, detected_week, uploaded_at, response_count,
                     success_count, failed_count, coverage, status, active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 1)""",
                    (
                        run_dir.name,
                        "uploaded_responses.jsonl",
                        week,
                        uploaded_at,
                        len(records),
                        sum(status == "success" for status in statuses),
                        sum(status != "success" for status in statuses),
                        score.get("coverage"),
                    ),
                )

    def list_uploads(self) -> list[dict[str, Any]]:
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT * FROM uploads ORDER BY uploaded_at DESC, upload_id DESC"
            ).fetchall()
        return [dict(row) | {"active": bool(row["active"])} for row in rows]

    def _active_paths(self, connection: sqlite3.Connection | None = None) -> list[Path]:
        own_connection = connection is None
        db = connection or self._connect()
        try:
            rows = db.execute(
                "SELECT upload_id FROM uploads WHERE active=1 AND status='active' "
                "ORDER BY uploaded_at, upload_id"
            ).fetchall()
        finally:
            if own_connection:
                db.close()
        paths = [self.uploads_dir / row["upload_id"] / "uploaded_responses.jsonl" for row in rows]
        missing = [path for path in paths if not path.is_file()]
        if missing:
            raise RuntimeError("An active upload file is missing from persistent storage.")
        return paths

    def _pipeline(self, response_files: list[Path]) -> tuple[dict[str, Any], Path]:
        temp_root = Path(tempfile.mkdtemp(prefix="corvane-active-dataset-"))
        staged_outputs = temp_root / "outputs"
        staged_outputs.mkdir()
        existing_review = self.output_dir / "manual_review.csv"
        if existing_review.is_file():
            shutil.copy2(existing_review, staged_outputs / "manual_review.csv")

        command = [
            self.python_executable,
            str(self.pipeline_script),
            "--input", str(self.input_dir),
            "--config", str(self.config_dir),
            "--output", str(staged_outputs),
        ]
        if response_files:
            aggregate = temp_root / "active_uploads.jsonl"
            with aggregate.open("wb") as stream:
                for response_file in response_files:
                    data = response_file.read_bytes()
                    stream.write(data)
                    if data and not data.endswith(b"\n"):
                        stream.write(b"\n")
            command.extend(["--responses", str(aggregate)])

        try:
            result = subprocess.run(
                command,
                cwd=self.input_dir.parent.parent,
                env={**os.environ, "PYTHONHASHSEED": "0"},
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            if result.returncode != 0:
                raise RuntimeError(f"Existing pipeline failed: {result.stderr[-4000:]}")
            dashboard = json.loads(
                (staged_outputs / "dashboard_data.json").read_text(encoding="utf-8")
            )
            return dashboard, staged_outputs
        except Exception:
            shutil.rmtree(temp_root, ignore_errors=True)
            raise

    def _publish_outputs(self, staged_outputs: Path) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        for name in PUBLISHED_FILES:
            source = staged_outputs / name
            if not source.is_file():
                raise RuntimeError(f"Pipeline output missing: {name}")
            temporary = self.output_dir / f".{name}.{uuid4().hex}.tmp"
            shutil.copy2(source, temporary)
            temporary.replace(self.output_dir / name)

    def _recompute(self, response_files: list[Path], snapshot_dir: Path | None = None) -> dict[str, Any]:
        dashboard, staged_outputs = self._pipeline(response_files)
        try:
            if snapshot_dir is not None:
                for name in SNAPSHOT_FILES:
                    shutil.copy2(staged_outputs / name, snapshot_dir / name)
            self._publish_outputs(staged_outputs)
            return dashboard
        finally:
            shutil.rmtree(staged_outputs.parent, ignore_errors=True)

    def rebuild_active(self) -> dict[str, Any]:
        with self.lock:
            return self._recompute(self._active_paths())

    def add_upload(self, filename: str | None, payload: bytes) -> dict[str, Any]:
        with self.lock:
            with tempfile.TemporaryDirectory(prefix="corvane-validation-") as temp:
                week, records = validate_upload(filename, payload, Path(temp), self.input_dir)
            cleaned_payload = payload.decode("utf-8-sig").encode("utf-8")
            upload_id = uuid4().hex
            uploaded_at = datetime.now(timezone.utc).isoformat()
            run_dir = self.uploads_dir / upload_id
            run_dir.mkdir(parents=True)
            uploaded_path = run_dir / "uploaded_responses.jsonl"
            uploaded_path.write_bytes(cleaned_payload)
            success_count = sum(record["status"] == "success" for record in records)
            failed_count = len(records) - success_count
            with self._connection() as connection:
                connection.execute(
                    """INSERT INTO uploads
                    (upload_id, filename, detected_week, uploaded_at, response_count,
                     success_count, failed_count, coverage, status, active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'processing', 0)""",
                    (
                        upload_id,
                        Path(filename or "responses.jsonl").name,
                        week,
                        uploaded_at,
                        len(records),
                        success_count,
                        failed_count,
                    ),
                )
            try:
                active_paths = self._active_paths() + [uploaded_path]
                dashboard = self._recompute(active_paths, run_dir)
                score = next(
                    (item for item in dashboard.get("scores", []) if item.get("week") == week),
                    {},
                )
                with self._connection() as connection:
                    connection.execute(
                        "UPDATE uploads SET status='active', active=1, coverage=? WHERE upload_id=?",
                        (score.get("coverage"), upload_id),
                    )
            except Exception:
                with self._connection() as connection:
                    connection.execute(
                        "UPDATE uploads SET status='failed', active=0 WHERE upload_id=?",
                        (upload_id,),
                    )
                raise
            run = next(item for item in self.list_uploads() if item["upload_id"] == upload_id)
            analyzed_records = dashboard.get("responses", [])[-len(records):]
            mentions = sum(
                bool(evaluation.get("mentioned"))
                for record in analyzed_records
                for evaluation in record.get("evaluations", [])
            )
            wrong_fact_keys = {
                (fact["response_id"], fact["brand"], fact["fact_key"], fact["claim_text"])
                for record in analyzed_records
                for fact in record.get("wrong_facts", [])
            }
            return run | {
                "week": week,
                "responses_processed": len(records),
                "successful_responses": success_count,
                "failed_responses": failed_count,
                "mentions": mentions,
                "wrong_facts": len(wrong_fact_keys),
            }

    def delete_upload(self, upload_id: str) -> dict[str, Any]:
        with self.lock:
            with self._connection() as connection:
                row = connection.execute(
                    "SELECT * FROM uploads WHERE upload_id=?", (upload_id,)
                ).fetchone()
            if row is None:
                raise KeyError(upload_id)
            if row["status"] == "deleted":
                return dict(row) | {"active": False}
            if row["status"] == "active":
                active_paths = [
                    path
                    for path in self._active_paths()
                    if path.parent.name != upload_id
                ]
                self._recompute(active_paths)
            deleted_at = datetime.now(timezone.utc).isoformat()
            with self._connection() as connection:
                connection.execute(
                    """UPDATE uploads SET status='deleted', active=0, deleted_at=?
                    WHERE upload_id=?""",
                    (deleted_at, upload_id),
                )
            return next(item for item in self.list_uploads() if item["upload_id"] == upload_id)
