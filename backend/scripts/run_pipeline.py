from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT / "src"))

from corvane_pipeline.pipeline import run_pipeline  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Corvane Fleet local visibility pipeline.")
    parser.add_argument("--input", type=Path, default=PROJECT_ROOT / "extras" / "corvane_data_pack",
                        help="Directory containing prompts.csv, brands.json, facts.json, and responses.jsonl")
    parser.add_argument("--responses", type=Path, default=None,
                        help="Optional JSONL response file (for a future/new week's data)")
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "outputs")
    parser.add_argument("--config", type=Path, default=BACKEND_ROOT / "config")
    parser.add_argument("--seed", type=int, default=42, help="Seed for the reproducible manual review sample")
    args = parser.parse_args()
    result = run_pipeline(args.input, args.output, args.config, args.responses, args.seed)
    print(json.dumps({"output_dir": result["output_dir"],
                      "records": result["quality"]["parsed_response_records"],
                      "statuses": result["quality"]["status_counts"],
                      "mentions_csv_rows": result["mention_rows"],
                      "wrong_fact_rows": result["wrong_fact_rows"]}, indent=2))


if __name__ == "__main__":
    main()
