"""End-to-end orchestration and artifact writing."""
from __future__ import annotations

import csv
import json
import random
from collections import Counter
from pathlib import Path
from typing import Any

from .detection import classify_tone, detect_mentions
from .facts import check_facts
from .loader import load_json, load_pack
from .scoring import calculate_analytics


def _write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _write_csv(path: Path, headers: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def run_pipeline(input_dir: Path, output_dir: Path, config_dir: Path,
                 responses_path: Path | None = None, random_seed: int = 42) -> dict[str, Any]:
    input_dir = input_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    pack = load_pack(input_dir)
    if responses_path is not None:
        # Add a separately supplied future week's JSONL while keeping pack history and configs.
        from .loader import load_responses
        responses, malformed, response_issues = load_responses(responses_path)
        for response in responses:
            if response["prompt_id"] and response["prompt_id"] not in pack["prompts"]:
                response["issues"].append("unknown_prompt_id")
                if response["status"] == "success":
                    response["status"] = "unusable"
                response_issues.append(f"{response['response_id']}:unknown_prompt_id:{response['prompt_id']}")
            response["prompt"] = pack["prompts"].get(response["prompt_id"])
        pack["responses"].extend(responses)
        pack["malformed"].extend(malformed)
        pack["issues"].extend(response_issues)

    alias_config = load_json(config_dir / "aliases.json")
    scoring_settings = load_json(config_dir / "scoring.json")
    brand_rows = []
    wrong_facts: list[dict[str, str]] = []
    response_details = []
    for response in pack["responses"]:
        mentions = detect_mentions(response["answer_text"], pack["brands"], alias_config) if response["status"] == "success" else []
        by_brand: dict[str, dict[str, Any]] = {}
        for brand in pack["brands"]:
            matching = [m for m in mentions if m["brand"] == brand["brand"]]
            tone = classify_tone(brand["brand"], response["answer_text"], mentions) if matching else {"tone": None, "evidence": []}
            result = {"response_id": response["response_id"], "brand": brand["brand"],
                      "mentioned": bool(matching), "position": matching[0]["position"] if matching else None,
                      "tone": tone["tone"], "mention_evidence": matching,
                      "tone_evidence": tone["evidence"], "response_status": response["status"]}
            by_brand[brand["brand"]] = result
            brand_rows.append(result)
        response["evaluations"] = [by_brand[brand["brand"]] for brand in pack["brands"]]
        response["mentions"] = mentions
        alerts = check_facts(response, pack["brands"], pack["facts"], alias_config)
        response["wrong_facts"] = alerts
        wrong_facts.extend(alerts)
        response_details.append({"response_id": response["response_id"], "week": response["week"],
                                 "engine": response["engine"], "engine_raw": response["engine_raw"],
                                 "prompt_id": response["prompt_id"], "prompt": response.get("prompt"),
                                 "run": response["run"], "collected_at": response["collected_at"],
                                 "source_line": response["source_line"], "source_schema": response["source_schema"],
                                 "source_fields": sorted(response["raw"].keys()),
                                 "source_error": response["source_error"],
                                 "source_extra_fields": {key: value for key, value in response["raw"].items()
                                                          if key not in {"response_id", "week", "engine", "prompt_id",
                                                                         "question_id", "run", "run_number", "collected_at",
                                                                         "collected", "response_text", "answer", "citations",
                                                                         "sources", "error"}},
                                 "status": response["status"], "issues": response["issues"],
                                 "answer_text": response["answer_text"], "citations": response["citations"],
                                 "mentions": mentions, "evaluations": response["evaluations"],
                                 "wrong_facts": alerts})

    analytics = calculate_analytics(pack["responses"], pack["prompts"], pack["brands"], scoring_settings)
    # Repeated source lines can have the same response_id. The fact export is
    # keyed by answer ID, so identical claim rows for that ID appear only once.
    unique_wrong_facts = []
    seen_alerts = set()
    for alert in wrong_facts:
        key = (alert["response_id"], alert["brand"], alert["fact_key"], alert["claim_text"])
        if key not in seen_alerts:
            seen_alerts.add(key)
            unique_wrong_facts.append(alert)
    wrong_facts = unique_wrong_facts
    statuses = Counter(r["status"] for r in pack["responses"])
    by_week: dict[str, dict[str, int]] = {}
    for response in pack["responses"]:
        key = str(response["week"] if response["week"] is not None else "unknown")
        by_week.setdefault(key, Counter())
        by_week[key][response["status"]] += 1
    engine_counts = Counter(r["engine"] or "unknown" for r in pack["responses"])
    source_schema_counts = Counter(r["source_schema"] for r in pack["responses"])
    tone_distribution = Counter(row["tone"] for row in brand_rows if row["tone"])
    mention_counts = Counter(row["brand"] for row in brand_rows if row["mentioned"])

    mentions_csv = []
    for row in brand_rows:
        # The mandated CSV has no unavailable value. For failed/unusable responses,
        # false is a schema placeholder only; evaluation.json keeps the true status.
        mentions_csv.append({"response_id": row["response_id"], "brand": row["brand"],
                             "mentioned": str(row["mentioned"]).lower(),
                             "position": row["position"] if row["mentioned"] else "",
                             "tone": row["tone"] if row["mentioned"] else ""})
    _write_csv(output_dir / "mentions.csv", ["response_id", "brand", "mentioned", "position", "tone"], mentions_csv)
    _write_csv(output_dir / "wrong_facts.csv", ["response_id", "brand", "fact_key", "claim_text"], wrong_facts)

    review_rng = random.Random(random_seed)
    candidates_by_id = {}
    for response in pack["responses"]:
        if response["status"] == "success":
            candidates_by_id.setdefault(response["response_id"], response)
    candidates = list(candidates_by_id.values())
    sample = sorted(review_rng.sample(candidates, min(15, len(candidates))), key=lambda r: r["response_id"])
    review_rows = []
    for response in sample:
        for evaluation in response["evaluations"]:
            review_rows.append({"response_id": response["response_id"], "week": response["week"],
                                "engine": response["engine"], "prompt_id": response["prompt_id"],
                                "prompt_text": (response.get("prompt") or {}).get("question", ""),
                                "answer_text": response["answer_text"], "brand": evaluation["brand"],
                                "tool_mentioned": str(evaluation["mentioned"]).lower(),
                                "tool_position": evaluation["position"] if evaluation["position"] is not None else "",
                                "tool_tone": evaluation["tone"] or "", "human_mentioned": "",
                                "human_position": "", "human_tone": "", "review_notes": ""})
    review_path = output_dir / "manual_review.csv"
    preserve_annotated_review = False
    if review_path.exists():
        try:
            with review_path.open(encoding="utf-8-sig", newline="") as stream:
                existing_review = list(csv.DictReader(stream))
            preserve_annotated_review = any(
                (row.get(column) or "").strip()
                for row in existing_review
                for column in ("human_mentioned", "human_position", "human_tone", "review_notes")
            )
        except (OSError, csv.Error, UnicodeError):
            # Preserve an unreadable existing review for human recovery; do not destroy it.
            preserve_annotated_review = True
    if not preserve_annotated_review:
        _write_csv(review_path,
                   ["response_id", "week", "engine", "prompt_id", "prompt_text", "answer_text", "brand",
                    "tool_mentioned", "tool_position", "tool_tone", "human_mentioned", "human_position",
                    "human_tone", "review_notes"], review_rows)

    response_id_counts = Counter(r["response_id"] for r in pack["responses"])
    duplicate_response_ids = [{"response_id": response_id, "record_count": count,
                               "source_lines": [r["source_line"] for r in pack["responses"]
                                               if r["response_id"] == response_id]}
                              for response_id, count in sorted(response_id_counts.items()) if count > 1]
    quality = {"source_input": str((responses_path or input_dir / "responses.jsonl").resolve()),
               "parsed_response_records": len(pack["responses"]), "malformed_records": pack["malformed"],
               "unique_response_ids": len(response_id_counts), "duplicate_response_ids": duplicate_response_ids,
               "status_counts": dict(statuses), "week_counts": {k: dict(v) for k, v in sorted(by_week.items())},
               "engine_counts": dict(engine_counts), "source_schema_counts": dict(source_schema_counts),
               "tone_distribution": dict(tone_distribution), "mentions_by_brand": dict(mention_counts),
               "wrong_fact_count": len(wrong_facts), "pipeline_issues": pack["issues"],
               "manual_review": {"sample_size": len(sample), "random_seed": random_seed,
                                 "response_ids": [r["response_id"] for r in sample],
                                 "existing_annotations_preserved": preserve_annotated_review},
               "failed_export_note": "mentions.csv encodes failed/unusable rows as false to satisfy its mandated schema; consult evaluation.json response status before interpreting these rows."}
    _write_json(output_dir / "quality_report.json", quality)
    _write_json(output_dir / "evaluation.json", {"brands": pack["brands"], "prompts": pack["prompts"],
                                                   "responses": response_details, "wrong_facts": wrong_facts})
    _write_json(output_dir / "analytics.json", analytics)
    _write_json(output_dir / "dashboard_data.json", {"meta": quality, "brands": pack["brands"],
                                                       "scores": analytics["weeks"],
                                                       "week_over_week": analytics["week_over_week"],
                                                       "wrong_facts": wrong_facts,
                                                       "responses": response_details})

    # Structural assertions make output corruption fail loudly.
    expected_rows = len(pack["responses"]) * len(pack["brands"])
    if len(mentions_csv) != expected_rows:
        raise RuntimeError(f"mentions.csv row count {len(mentions_csv)} != {expected_rows}")
    if any(list(row) != ["response_id", "brand", "mentioned", "position", "tone"] for row in mentions_csv):
        raise RuntimeError("mentions.csv columns do not match the required contract")
    return {"quality": quality, "analytics": analytics, "mention_rows": len(mentions_csv),
            "wrong_fact_rows": len(wrong_facts), "output_dir": str(output_dir.resolve())}
