from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(BACKEND_ROOT / "src"))

from corvane_pipeline.manual_review import compare_review


FIELDS = ["response_id", "answer_text", "brand", "tool_mentioned", "tool_position", "tool_tone",
          "human_mentioned", "human_position", "human_tone", "review_notes"]


class ManualReviewTests(unittest.TestCase):
    def write_rows(self, rows):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        path = Path(temp.name) / "manual_review.csv"
        with path.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(rows)
        return path

    @staticmethod
    def row(**changes):
        row = dict(response_id="r1", answer_text="Corvane Fleet is a strong pick.", brand="corvane",
                   tool_mentioned="true", tool_position="1", tool_tone="recommended",
                   human_mentioned="", human_position="", human_tone="", review_notes="")
        row.update(changes)
        return row

    def test_incomplete_review_has_no_accuracy_when_blank(self):
        result = compare_review(self.write_rows([self.row()]))
        self.assertEqual(result["status"], "incomplete")
        self.assertIsNone(result["mention_accuracy"])
        self.assertIsNone(result["tone_accuracy"])

    def test_fully_annotated_review_calculates_mention_and_tone_accuracy(self):
        rows = [self.row(human_mentioned="true", human_position="1", human_tone="recommended"),
                self.row(response_id="r2", brand="trakvia", tool_mentioned="false", tool_position="", tool_tone="",
                         human_mentioned="false")]
        result = compare_review(self.write_rows(rows))
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["mention_accuracy"], 100.0)
        self.assertEqual(result["position_accuracy"], 100.0)
        self.assertEqual(result["tone_accuracy"], 100.0)

    def test_disagreements_identified_with_answer_and_both_results(self):
        row = self.row(tool_mentioned="false", tool_position="", tool_tone="",
                       human_mentioned="true", human_position="1", human_tone="recommended")
        result = compare_review(self.write_rows([row]))
        self.assertEqual(result["mention_accuracy"], 0.0)
        self.assertEqual(result["position_accuracy"], 0.0)
        self.assertEqual(result["tone_accuracy"], 0.0)
        self.assertEqual(len(result["mention_disagreements"]), 1)
        self.assertEqual(len(result["position_disagreements"]), 1)
        self.assertEqual(result["tone_disagreements"][0]["tool_result"], "")
        self.assertEqual(result["mention_disagreements"][0]["answer_text"], row["answer_text"])

    def test_blank_annotations_are_ignored(self):
        rows = [self.row(human_mentioned="true", human_tone="recommended"), self.row(response_id="r2")]
        result = compare_review(self.write_rows(rows))
        self.assertEqual(result["mention_reviewed"], 1)
        self.assertEqual(result["tone_reviewed"], 1)
        self.assertEqual(result["mention_accuracy"], 100.0)

    def test_comparison_does_not_modify_machine_or_human_fields(self):
        row = self.row(human_mentioned="true", human_position="2", human_tone="neutral")
        path = self.write_rows([row])
        before = path.read_bytes()
        compare_review(path)
        self.assertEqual(path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
