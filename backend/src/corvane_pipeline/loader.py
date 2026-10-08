"""Source loading and schema normalization."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8-sig") as stream:
        return json.load(stream)


def load_prompts(path: Path) -> tuple[dict[str, dict[str, Any]], list[str]]:
    prompts: dict[str, dict[str, Any]] = {}
    issues: list[str] = []
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for line, row in enumerate(csv.DictReader(stream), start=2):
            prompt_id = (row.get("prompt_id") or "").strip().upper()
            if not prompt_id:
                issues.append(f"prompts.csv:{line}: missing prompt_id")
                continue
            try:
                priority = int(row.get("priority", ""))
            except (TypeError, ValueError):
                priority = 1
                issues.append(f"prompts.csv:{line}: invalid priority; defaulted to 1")
            if prompt_id in prompts:
                issues.append(f"prompts.csv:{line}: duplicate prompt_id {prompt_id}")
            prompts[prompt_id] = {
                **row,
                "prompt_id": prompt_id,
                "priority": priority,
            }
    return prompts, issues


def slug_for_company(name: str, role: str | None = None) -> str:
    """Derive the stable export key from configured company names."""
    if role == "client":
        return re.sub(r"\W+", "", name.split()[0].lower())
    return re.sub(r"\W+", "", name.split()[0].lower())


def load_brands(path: Path) -> tuple[list[dict[str, Any]], list[str]]:
    data = load_json(path)
    brands: list[dict[str, Any]] = []
    for role, values in (("client", [data.get("client")]),
                         ("tracked_competitor", data.get("tracked_competitors", [])),
                         ("other_company", data.get("other_companies", []))):
        for item in values:
            if not item or not item.get("name") or not item.get("website"):
                continue
            brands.append({"brand": slug_for_company(item["name"], role),
                           "name": item["name"], "website": item["website"],
                           "role": role})
    keys = [brand["brand"] for brand in brands]
    issues = [f"duplicate configured brand key: {key}" for key in set(keys) if keys.count(key) > 1]
    return brands, issues


def normalize_record(raw: dict[str, Any], line_number: int) -> dict[str, Any]:
    """Map known source schema versions while retaining the unmodified object."""
    response_id = raw.get("response_id")
    raw_engine = raw.get("engine")
    engine_text = str(raw_engine or "").strip().casefold()
    engine_aliases = {
        "chatgpt": "chatgpt", "chat gpt": "chatgpt",
        "perplexity": "perplexity", "google_ai_overview": "google_ai_overview",
        "ai overview": "google_ai_overview", "google ai overview": "google_ai_overview",
    }
    raw_week = raw.get("week")
    try:
        week = int(raw_week) if raw_week is not None and str(raw_week).strip() else None
    except (TypeError, ValueError):
        week = None
    raw_run = raw.get("run", raw.get("run_number"))
    try:
        run = int(raw_run) if raw_run is not None and str(raw_run).strip() else None
    except (TypeError, ValueError):
        run = None
    prompt_id = str(raw.get("prompt_id", raw.get("question_id", "")) or "").strip().upper()
    answer = raw.get("response_text", raw.get("answer", ""))
    answer = answer if isinstance(answer, str) else ""
    citations = raw.get("citations", raw.get("sources", []))
    if not isinstance(citations, list):
        citations = []
    issues = []
    if not response_id:
        issues.append("missing_response_id")
    if week is None:
        issues.append("invalid_or_missing_week")
    if engine_text not in engine_aliases:
        issues.append("unknown_or_missing_engine")
    if not prompt_id:
        issues.append("missing_prompt_id")
    if run not in (1, 2):
        issues.append("invalid_or_missing_run")
    status = "failed" if raw.get("error") else ("unusable" if issues else "success")
    if status == "success" and not answer.strip():
        status = "unusable"
        issues.append("empty_answer_without_error")
    if raw.get("error"):
        issues.append(f"source_error:{raw['error']}")
    return {
        "response_id": str(response_id or f"malformed-line-{line_number}"),
        "source_line": line_number,
        "week": week,
        "engine": engine_aliases.get(engine_text),
        "engine_raw": raw_engine,
        "prompt_id": prompt_id or None,
        "run": run,
        "collected_at": raw.get("collected_at", raw.get("collected")),
        "answer_text": answer,
        "citations": citations,
        "status": status,
        "source_error": raw.get("error"),
        "issues": issues,
        "source_schema": "answer" if "answer" in raw else "response_text",
        "raw": raw,
    }


def load_responses(path: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    records: list[dict[str, Any]] = []
    malformed: list[dict[str, Any]] = []
    issues: list[str] = []
    with path.open(encoding="utf-8-sig") as stream:
        for line_number, line in enumerate(stream, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
                if not isinstance(value, dict):
                    raise ValueError("JSON line is not an object")
                record = normalize_record(value, line_number)
                records.append(record)
                issues.extend(f"{record['response_id']}:{item}" for item in record["issues"])
            except (json.JSONDecodeError, ValueError) as exc:
                malformed.append({"response_id": f"malformed-line-{line_number}",
                                  "source_line": line_number, "status": "malformed",
                                  "error": str(exc), "raw_line": line.rstrip("\r\n")})
                issues.append(f"responses.jsonl:{line_number}: malformed record: {exc}")
    return records, malformed, issues


def load_pack(input_dir: Path) -> dict[str, Any]:
    prompts, prompt_issues = load_prompts(input_dir / "prompts.csv")
    brands, brand_issues = load_brands(input_dir / "brands.json")
    facts = load_json(input_dir / "facts.json")
    responses, malformed, response_issues = load_responses(input_dir / "responses.jsonl")
    for response in responses:
        if response["prompt_id"] and response["prompt_id"] not in prompts:
            response["issues"].append("unknown_prompt_id")
            if response["status"] == "success":
                response["status"] = "unusable"
            response_issues.append(f"{response['response_id']}:unknown_prompt_id:{response['prompt_id']}")
        response["prompt"] = prompts.get(response["prompt_id"])
    return {"prompts": prompts, "brands": brands, "facts": facts,
            "responses": responses, "malformed": malformed,
            "issues": prompt_issues + brand_issues + response_issues}
