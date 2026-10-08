from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.app import _validate_upload
from backend.upload_registry import UploadInputError


class UploadValidationTests(unittest.TestCase):
    def test_accepts_supported_schema_variation_and_failed_responses(self):
        payload = (
            '{"response_id":"new-1","week":"7","engine":"ChatGPT",'
            '"prompt_id":"p01","run_number":"1","answer":"Corvane Fleet is a strong pick.",'
            '"sources":[]}\n'
            '{"response_id":"new-2","week":7,"engine":"chatgpt","prompt_id":"P01",'
            '"run":2,"error":"timeout","response_text":"","citations":[]}\n'
        ).encode()
        payload = b"\xef\xbb\xbf" + payload
        with tempfile.TemporaryDirectory() as directory:
            week, records = _validate_upload("responses_week_7.jsonl", payload, Path(directory))

        self.assertEqual(week, 7)
        self.assertEqual([record["status"] for record in records], ["success", "failed"])

    def test_rejects_malformed_jsonl_with_line_number(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(UploadInputError) as raised:
                _validate_upload("week.jsonl", b'{"response_id":"ok"}\nnot json\n', Path(directory))

        self.assertIn("line(s) 2", str(raised.exception))

    def test_rejects_multiple_weeks_in_one_upload(self):
        payload = b'\n'.join(
            (
                b'{"response_id":"a","week":7,"engine":"chatgpt","prompt_id":"P01","run":1,"response_text":"answer"}',
                b'{"response_id":"b","week":8,"engine":"chatgpt","prompt_id":"P01","run":2,"response_text":"answer"}',
            )
        )
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(UploadInputError) as raised:
                _validate_upload("week.jsonl", payload, Path(directory))

        self.assertIn("one week's responses", str(raised.exception))

    def test_rejects_unknown_prompt_id(self):
        payload = b'{"response_id":"a","week":7,"engine":"chatgpt","prompt_id":"P99","run":1,"response_text":"answer"}'
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(UploadInputError) as raised:
                _validate_upload("week.jsonl", payload, Path(directory))

        self.assertIn("unknown prompt_id P99", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
