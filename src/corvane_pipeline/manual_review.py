"""Comparison helpers for the independently annotated manual-review worksheet."""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Any


def compare_review(path: Path) -> dict[str, Any]:
    """Compare populated human labels with stored tool predictions without editing the CSV."""
    with path.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))

    mention_reviewed = [row for row in rows if row.get("human_mentioned", "").strip().lower() in {"true", "false"}]
    positive_reviewed = [row for row in mention_reviewed if row["human_mentioned"].strip().lower() == "true"]
    position_reviewed = [row for row in positive_reviewed if row.get("human_position", "").strip()]
    tone_reviewed = [row for row in positive_reviewed if row.get("human_tone", "").strip()]
    mention_mismatches = []
    position_mismatches = []
    tone_mismatches = []
    for row in mention_reviewed:
        human = row["human_mentioned"].strip().lower()
        tool = row.get("tool_mentioned", "").strip().lower()
        if human.casefold() != tool.casefold():
            mention_mismatches.append(_case(row, tool, human, "mention"))
    for row in position_reviewed:
        human = row["human_position"].strip()
        tool = row.get("tool_position", "").strip()
        if human.casefold() != tool.casefold():
            position_mismatches.append(_case(row, tool, human, "position"))
    for row in tone_reviewed:
        human = row["human_tone"].strip()
        tool = row.get("tool_tone", "").strip()
        if human.casefold() != tool.casefold():
            tone_mismatches.append(_case(row, tool, human, "tone"))

    fully_annotated = bool(rows) and len(mention_reviewed) == len(rows) and all(
        row["human_mentioned"].strip().lower() == "false"
        or (bool(row.get("human_tone", "").strip()) and bool(row.get("human_position", "").strip()))
        for row in rows)
    return {
        "status": "complete" if fully_annotated else "incomplete",
        "rows": len(rows),
        "comparable_rows": {"mention": len(mention_reviewed), "position": len(position_reviewed),
                            "tone": len(tone_reviewed)},
        "mention_reviewed": len(mention_reviewed),
        "position_reviewed": len(position_reviewed),
        "tone_reviewed": len(tone_reviewed),
        "mention_accuracy": _accuracy(len(mention_reviewed) - len(mention_mismatches), len(mention_reviewed)),
        "position_accuracy": _accuracy(len(position_reviewed) - len(position_mismatches), len(position_reviewed)),
        "tone_accuracy": _accuracy(len(tone_reviewed) - len(tone_mismatches), len(tone_reviewed)),
        "mention_disagreements": mention_mismatches,
        "position_disagreements": position_mismatches,
        "tone_disagreements": tone_mismatches,
    }


def _accuracy(correct: int, reviewed: int) -> float | None:
    return round(correct / reviewed * 100, 2) if reviewed else None


def _case(row: dict[str, str], tool: str, human: str, kind: str) -> dict[str, str]:
    return {"type": kind, "response_id": row.get("response_id", ""), "brand": row.get("brand", ""),
            "answer_text": row.get("answer_text", ""), "tool_result": tool, "human_result": human}
