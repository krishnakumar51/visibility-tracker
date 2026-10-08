from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT / "src"))

from corvane_pipeline.manual_review import compare_review  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare human labels with tool predictions in manual_review.csv.")
    parser.add_argument("csv_path", nargs="?", type=Path, default=PROJECT_ROOT / "outputs" / "manual_review.csv")
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "outputs" / "manual_review_comparison.json",
                        help="Path for the machine-readable comparison report")
    args = parser.parse_args()
    try:
        result = compare_review(args.csv_path)
    except (OSError, csv.Error, ValueError) as exc:
        parser.error(str(exc))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if result["status"] == "incomplete":
        print("Review incomplete; accuracy is calculated only for fields with human annotations.")
    else:
        print("Review complete.")
    mention = result["mention_accuracy"]
    tone = result["tone_accuracy"]
    print(f"Mention accuracy: {mention:.2f}% ({result['mention_reviewed']} reviewed)") if mention is not None else print("Mention accuracy: not available (no labels)")
    position = result["position_accuracy"]
    print(f"Position accuracy (diagnostic): {position:.2f}% ({result['position_reviewed']} reviewed mentions)") if position is not None else print("Position accuracy: not available (no human positions)")
    print(f"Tone accuracy: {tone:.2f}% ({result['tone_reviewed']} reviewed mentions)") if tone is not None else print("Tone accuracy: not available (no human tone labels)")
    print(f"Disagreements: {len(result['mention_disagreements'])} mention; {len(result['position_disagreements'])} position; {len(result['tone_disagreements'])} tone")
    print(f"Comparison report: {args.output.resolve()}")
    for case in result["mention_disagreements"] + result["position_disagreements"] + result["tone_disagreements"]:
        print(f"\n[{case['type']}] {case['response_id']} / {case['brand']}")
        print(f"Tool: {case['tool_result']} | Human: {case['human_result']}")
        print(f"Answer: {case['answer_text']}")


if __name__ == "__main__":
    main()
