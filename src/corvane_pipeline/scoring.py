"""Comparable score, completeness, movement, and driver calculations."""
from __future__ import annotations

from collections import defaultdict
from typing import Any


def point_value(mention: dict[str, Any], settings: dict[str, Any]) -> float:
    if not mention.get("mentioned"):
        return 0.0
    tone = settings["tone_points"].get(mention.get("tone"), 0.65)
    position = mention.get("position")
    factor = settings["position_factors"].get(str(position), settings["position_factors"]["4_plus"])
    return float(tone) * float(factor)


def _round(value: float | None, digits: int = 2) -> float | None:
    return None if value is None else round(value, digits)


def calculate_analytics(responses: list[dict[str, Any]], prompts: dict[str, dict[str, Any]],
                        brands: list[dict[str, Any]], settings: dict[str, Any]) -> dict[str, Any]:
    tracked = [b["brand"] for b in brands if b["role"] != "other_company"]
    engines = sorted(set(settings.get("expected_engines", [])) |
                     {r["engine"] for r in responses if r.get("engine")})
    weeks = sorted({r["week"] for r in responses if r.get("week") is not None})
    prompt_ids = sorted(prompts)
    expected_runs = 2
    expected_slots = len(prompt_ids) * len(engines) * expected_runs
    grouped: dict[tuple[int, str, str, int], list[dict[str, Any]]] = defaultdict(list)
    for response in responses:
        if response.get("week") is not None and response.get("engine") and response.get("prompt_id") and response.get("run"):
            grouped[(response["week"], response["engine"], response["prompt_id"], response["run"])].append(response)

    weekly: list[dict[str, Any]] = []
    per_week_brand_strata: dict[tuple[int, str], dict[tuple[str, str], dict[str, Any]]] = {}
    for week in weeks:
        expected_keys = {(week, engine, pid, run) for engine in engines for pid in prompt_ids for run in (1, 2)}
        observed_keys = {key for key in expected_keys if key in grouped}
        valid_keys = {key for key in observed_keys if any(r["status"] == "success" for r in grouped[key])}
        engine_coverage = {}
        for engine in engines:
            engine_expected = len(prompt_ids) * expected_runs
            engine_valid = sum(1 for key in valid_keys if key[1] == engine)
            engine_coverage[engine] = {"valid_runs": engine_valid, "expected_runs": engine_expected,
                                       "coverage": round(engine_valid / engine_expected, 4) if engine_expected else 0}
        coverage = len(valid_keys) / expected_slots if expected_slots else 0
        threshold = float(settings.get("minimum_week_coverage", 0.95))
        all_engines_present = all(engine_coverage[e]["valid_runs"] > 0 for e in engines)
        complete = coverage >= threshold and all_engines_present
        duplicate_groups = [{"engine": key[1], "prompt_id": key[2], "run": key[3],
                             "response_ids": [r["response_id"] for r in values]}
                            for key, values in grouped.items() if key[0] == week and len(values) > 1]
        record_by_id = {r["response_id"]: r for r in responses}
        strata: dict[tuple[str, str], dict[str, Any]] = {}
        brand_scores = {}
        for brand in tracked:
            observations: dict[tuple[str, str], dict[int, list[tuple[float, str]]]] = defaultdict(lambda: defaultdict(list))
            for key in observed_keys:
                _, engine, prompt_id, run = key
                prompt = prompts[prompt_id]
                successful = [r for r in grouped[key] if r["status"] == "success"]
                for response in successful:
                    result = next((m for m in response["evaluations"] if m["brand"] == brand), None)
                    if result is not None:
                        observations[(engine, prompt_id)][run].append((point_value(result, settings), response["response_id"]))
            weighted_sum = weight_sum = 0.0
            stratum_values = {}
            for engine in engines:
                for prompt_id in prompt_ids:
                    key = (engine, prompt_id)
                    run_groups = observations.get(key, {})
                    run_means = {run: sum(value for value, _ in vals) / len(vals)
                                 for run, vals in run_groups.items() if vals}
                    run_response_ids = {run: sorted(response_id for _, response_id in vals)
                                        for run, vals in run_groups.items() if vals}
                    if not run_means:
                        continue
                    # Duplicate source records within a run are averaged above; run numbers are equally weighted.
                    mean_value = sum(run_means.values()) / len(run_means)
                    priority = max(settings.get("priority_min", 1),
                                   min(settings.get("priority_max", 3), int(prompts[prompt_id]["priority"])))
                    weighted_sum += mean_value * priority
                    weight_sum += priority
                    stratum_values[key] = {"value": mean_value, "run_values": run_means,
                                           "run_response_ids": run_response_ids, "priority": priority}
            score = 100 * weighted_sum / weight_sum if weight_sum else None
            spread_values = []
            for item in stratum_values.values():
                if len(item["run_values"]) >= 2:
                    vals = list(item["run_values"].values())
                    spread_values.append(abs(vals[0] - vals[1]))
            run_variation = 100 * (sum(spread_values) / len(spread_values)) if spread_values else None
            brand_scores[brand] = {"score": _round(score), "valid_strata": len(stratum_values),
                                   "expected_strata": len(engines) * len(prompt_ids),
                                   "run_variation_points": _round(run_variation)}
            per_week_brand_strata[(week, brand)] = stratum_values
        weekly.append({"week": week, "score_status": "complete" if complete else "partial",
                       "coverage": round(coverage, 4), "valid_run_slots": len(valid_keys),
                       "observed_run_slots": len(observed_keys), "expected_run_slots": expected_slots,
                       "source_records": sum(1 for r in responses if r.get("week") == week),
                       "failed_responses": sum(1 for r in responses if r.get("week") == week and r["status"] == "failed"),
                       "engine_coverage": engine_coverage, "duplicate_run_slots": duplicate_groups,
                       "brands": brand_scores})

    comparisons = []
    for index, current in enumerate(weekly):
        previous = next((candidate for candidate in reversed(weekly[:index])
                         if candidate["score_status"] == "complete"), None)
        item = {"week": current["week"], "compared_to_week": previous["week"] if previous else None,
                "status": "no_previous_week", "brands": {}}
        if previous:
            both_comparable = current["score_status"] == "complete"
            consecutive = current["week"] == previous["week"] + 1
            if not both_comparable:
                item["status"] = "not_comparable_incomplete_coverage"
            else:
                item["status"] = "comparable" if consecutive else "comparable_to_last_complete_week"
            item["gap_weeks"] = max(0, current["week"] - previous["week"] - 1)
            for brand in tracked:
                now = current["brands"][brand]["score"]
                before = previous["brands"][brand]["score"]
                delta = round(now - before, 2) if now is not None and before is not None and both_comparable else None
                prior_complete = [j for j in range(index) if weekly[j]["score_status"] == "complete"]
                prior_complete = prior_complete[-int(settings.get("historical_variation_weeks", 4)):]
                variations = [weekly[j]["brands"][brand]["run_variation_points"] for j in prior_complete
                              if weekly[j]["brands"][brand]["run_variation_points"] is not None]
                average_variation = sum(variations) / len(variations) if variations else 0.0
                threshold = max(float(settings.get("variation_floor_points", 2.0)), average_variation)
                if delta is None:
                    movement = "not_comparable"
                elif abs(delta) > threshold:
                    movement = "outside_observed_run_variation"
                else:
                    movement = "within_observed_run_variation"
                old_strata = per_week_brand_strata[(previous["week"], brand)]
                new_strata = per_week_brand_strata[(current["week"], brand)]
                drivers = []
                for key in sorted(set(old_strata) | set(new_strata)):
                    old, new = old_strata.get(key), new_strata.get(key)
                    if not old or not new:
                        continue
                    contribution = (new["value"] - old["value"]) * old["priority"]
                    if abs(contribution) > 1e-9:
                        drivers.append({"engine": key[0], "prompt_id": key[1],
                                        "previous_value": round(old["value"] * 100, 2),
                                        "current_value": round(new["value"] * 100, 2),
                                        "weighted_direction": "gain" if contribution > 0 else "loss",
                                        "unscaled_weighted_change": round(contribution * 100, 2),
                                        "previous_response_ids": sorted({rid for ids in old["run_response_ids"].values() for rid in ids}),
                                        "current_response_ids": sorted({rid for ids in new["run_response_ids"].values() for rid in ids})})
                drivers.sort(key=lambda d: abs(d["unscaled_weighted_change"]), reverse=True)
                item["brands"][brand] = {"change_points": delta, "movement": movement,
                                         "variation_threshold_points": round(threshold, 2),
                                         "drivers": drivers}
            # A score after a partial or absent intervening week is useful as a
            # trend check, but it is not a week-over-week movement. Keep it separate.
            if current["score_status"] == "complete" and not consecutive:
                gap_comparison = {**item, "status": "gap_comparison_since_last_complete_week",
                                  "label": "Change since last complete week; not week-over-week"}
                item["gap_comparison"] = gap_comparison
                immediately_previous = weekly[index - 1]
                item["compared_to_week"] = immediately_previous["week"]
                item["status"] = ("not_comparable_previous_week_incomplete"
                                  if immediately_previous["score_status"] != "complete"
                                  else "not_comparable_non_adjacent_weeks")
                item["brands"] = {
                    brand: {"change_points": None, "movement": "not_comparable",
                            "variation_threshold_points": gap_comparison["brands"][brand]["variation_threshold_points"],
                            "drivers": []}
                    for brand in tracked
                }
        comparisons.append(item)
    return {"tracked_brands": tracked, "engines": engines, "prompt_count": len(prompt_ids),
            "weeks": weekly, "week_over_week": comparisons}
