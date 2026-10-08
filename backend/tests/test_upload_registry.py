from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from backend.upload_registry import UploadRegistry
from corvane_pipeline.loader import load_pack

BACKEND_ROOT = Path(__file__).resolve().parents[1]
ROOT = BACKEND_ROOT.parent
INPUT_DIR = ROOT / "extras" / "corvane_data_pack"


def response(response_id: str, week: int, prompt_id: str, run: int, answer: str) -> dict[str, object]:
    return {
        "response_id": response_id,
        "week": week,
        "engine": "chatgpt",
        "prompt_id": prompt_id,
        "run": run,
        "response_text": answer,
        "citations": [],
    }


class UploadRegistryIntegrationTests(unittest.TestCase):
    def test_active_uploads_recalculate_and_deletion_restores_base(self):
        base_bytes_before = (INPUT_DIR / "responses.jsonl").read_bytes()
        base = load_pack(INPUT_DIR)
        self.assertEqual(len(base["responses"]), 518)

        with tempfile.TemporaryDirectory() as temporary:
            output_dir = Path(temporary) / "outputs"
            store = UploadRegistry(
                input_dir=INPUT_DIR,
                config_dir=BACKEND_ROOT / "config",
                pipeline_script=BACKEND_ROOT / "scripts" / "run_pipeline.py",
                output_dir=output_dir,
            )

            # BASE DATASET remains the original 518 records before and after runs.
            baseline = store.rebuild_active()
            self.assertEqual(len(baseline["responses"]), 518)
            baseline_scores = baseline["scores"]

            upload_a_records = [
                response("upload-a-1", 7, "P01", 1, "Corvane Fleet is a strong choice."),
                response("upload-a-2", 7, "P01", 2, "Trakvia is another option."),
            ]
            upload_a = store.add_upload(
                "week_7.jsonl",
                b"".join(json.dumps(record).encode() + b"\n" for record in upload_a_records),
            )
            after_a = json.loads((output_dir / "dashboard_data.json").read_text(encoding="utf-8"))
            self.assertEqual(upload_a["status"], "active")
            self.assertEqual(upload_a["response_count"], 2)
            self.assertEqual(len(after_a["responses"]), 520)
            self.assertIn("upload-a-1", {item["response_id"] for item in after_a["responses"]})

            upload_b_records = [
                response("upload-b-1", 8, "P02", 1, "Gridwell Systems is a strong choice."),
            ]
            upload_b = store.add_upload(
                "future_run.jsonl",
                b"".join(json.dumps(record).encode() + b"\n" for record in upload_b_records),
            )
            after_b = json.loads((output_dir / "dashboard_data.json").read_text(encoding="utf-8"))
            self.assertEqual(len(after_b["responses"]), 521)
            self.assertIn("upload-a-1", {item["response_id"] for item in after_b["responses"]})
            self.assertIn("upload-b-1", {item["response_id"] for item in after_b["responses"]})
            self.assertIn(7, {item["week"] for item in after_b["scores"]})
            self.assertIn(8, {item["week"] for item in after_b["scores"]})

            expected_run_files = {
                "uploaded_responses.jsonl",
                "dashboard_data.json",
                "mentions.csv",
                "wrong_facts.csv",
            }
            upload_a_dir = output_dir / "uploads" / upload_a["upload_id"]
            upload_b_dir = output_dir / "uploads" / upload_b["upload_id"]
            self.assertEqual({path.name for path in upload_a_dir.iterdir()}, expected_run_files)
            self.assertEqual({path.name for path in upload_b_dir.iterdir()}, expected_run_files)

            deleted_a = store.delete_upload(upload_a["upload_id"])
            after_delete_a = json.loads((output_dir / "dashboard_data.json").read_text(encoding="utf-8"))
            active_response_ids = {item["response_id"] for item in after_delete_a["responses"]}
            self.assertEqual(deleted_a["status"], "deleted")
            self.assertFalse(deleted_a["active"])
            self.assertNotIn("upload-a-1", active_response_ids)
            self.assertNotIn("upload-a-2", active_response_ids)
            self.assertIn("upload-b-1", active_response_ids)
            self.assertEqual(len(after_delete_a["responses"]), 519)
            self.assertNotIn(7, {item["week"] for item in after_delete_a["scores"]})
            self.assertIn(8, {item["week"] for item in after_delete_a["scores"]})
            self.assertTrue(upload_a_dir.is_dir())
            self.assertTrue((upload_a_dir / "dashboard_data.json").is_file())

            store.delete_upload(upload_b["upload_id"])
            restored = json.loads((output_dir / "dashboard_data.json").read_text(encoding="utf-8"))
            self.assertEqual(restored, baseline)
            self.assertEqual(restored["scores"], baseline_scores)
            self.assertEqual(len(restored["responses"]), 518)
            self.assertFalse({"upload-a-1", "upload-a-2", "upload-b-1"} & {
                item["response_id"] for item in restored["responses"]
            })
            self.assertEqual((INPUT_DIR / "responses.jsonl").read_bytes(), base_bytes_before)

            states = {run["upload_id"]: run for run in store.list_uploads()}
            self.assertEqual(states[upload_a["upload_id"]]["status"], "deleted")
            self.assertEqual(states[upload_b["upload_id"]]["status"], "deleted")
            self.assertEqual(len(states), 2)


if __name__ == "__main__":
    unittest.main()
