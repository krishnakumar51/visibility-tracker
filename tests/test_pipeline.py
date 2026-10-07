from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT / "src"))

from corvane_pipeline.detection import classify_tone, detect_mentions
from corvane_pipeline.facts import check_facts
from corvane_pipeline.loader import load_responses, normalize_record
from corvane_pipeline.pipeline import run_pipeline
from corvane_pipeline.scoring import calculate_analytics, point_value


class FixtureCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.brands = [
            {"brand": "corvane", "name": "Corvane Fleet", "website": "corvanefleet.com", "role": "client"},
            {"brand": "trakvia", "name": "Trakvia", "website": "trakvia.com", "role": "tracked_competitor"},
            {"brand": "routelyne", "name": "Routelyne", "website": "routelyne.com", "role": "tracked_competitor"},
            {"brand": "gridwell", "name": "Gridwell Systems", "website": "gridwell.io", "role": "tracked_competitor"},
            {"brand": "fleetora", "name": "Fleetora", "website": "fleetora.com", "role": "other_company"},
            {"brand": "novahaul", "name": "Novahaul", "website": "novahaul.com", "role": "other_company"},
        ]
        cls.aliases = json.loads((ROOT / "config/aliases.json").read_text(encoding="utf-8"))
        cls.facts = json.loads((ROOT / "extras/corvane_data_pack/facts.json").read_text(encoding="utf-8-sig"))
        cls.settings = json.loads((ROOT / "config/scoring.json").read_text(encoding="utf-8"))


class MentionTests(FixtureCase):
    def test_official_name_website_variations_and_misspelling(self):
        for text, brand in [("Corvane Fleet is an option", "corvane"),
                            ("Visit https://www.corvanefleet.com/pricing", "corvane"),
                            ("CorvaneFleet integrates QuickBooks", "corvane"),
                            ("Corvain Fleet is an option", "corvane"),
                            ("TrakVia offers dashcams", "trakvia"),
                            ("Route Lyne is affordable", "routelyne"),
                            ("Gridwell.io is enterprise focused", "gridwell")]:
            with self.subTest(text=text):
                found = detect_mentions(text, self.brands, self.aliases)
                self.assertIn(brand, {x["brand"] for x in found})

    def test_corvane_logistics_is_excluded(self):
        self.assertEqual(detect_mentions("Corvane Logistics is a freight carrier", self.brands, self.aliases), [])

    def test_citations_are_not_scanned(self):
        answer = "An unnamed provider is listed."
        citations = ["https://corvanefleet.com"]
        self.assertEqual(detect_mentions(answer, self.brands, self.aliases), [])
        self.assertTrue(citations)  # Citation data remains separate from answer text.

    def test_order_repeats_and_mixed_order(self):
        found = detect_mentions("TrakVia first; Corvane Fleet next; Trakvia again; Novahaul last.", self.brands, self.aliases)
        positions = {item["brand"]: item["position"] for item in found}
        self.assertEqual(positions, {"trakvia": 1, "corvane": 2, "novahaul": 3})
        self.assertEqual(sum(item["brand"] == "trakvia" for item in found), 2)
        citation_only = detect_mentions("No brand here", self.brands, self.aliases)
        self.assertEqual(citation_only, [])


class ToneTests(FixtureCase):
    def tone(self, sentence):
        mentions = detect_mentions(sentence, self.brands, self.aliases)
        return classify_tone("corvane", sentence, mentions)["tone"]

    def test_four_tones(self):
        self.assertEqual(self.tone("Corvane Fleet is a strong pick."), "recommended")
        self.assertEqual(self.tone("Other options include Corvane Fleet."), "neutral")
        self.assertEqual(self.tone("Corvane Fleet has slow support."), "negative")
        self.assertEqual(self.tone("Avoid Corvane Fleet for small fleets."), "not_recommended")

    def test_final_verdict_and_final_occurrence(self):
        self.assertEqual(self.tone("Corvane Fleet is a strong pick, but avoid it for small fleets."), "not_recommended")
        text = "Corvane Fleet has complaints. Corvane Fleet is still a reliable choice."
        mentions = detect_mentions(text, self.brands, self.aliases)
        self.assertEqual(classify_tone("corvane", text, mentions)["tone"], "recommended")
        actual_style = "Corvane Fleet. Note that it doesn't support ELD compliance, so you'd need a separate tool."
        mentions = detect_mentions(actual_style, self.brands, self.aliases)
        self.assertEqual(classify_tone("corvane", actual_style, mentions)["tone"], "negative")

    def test_indirect_recommendation_and_advice_against(self):
        self.assertEqual(self.tone("If I had to pick one, it would be Corvane Fleet."), "recommended")
        self.assertEqual(self.tone("I wouldn't choose Corvane Fleet for small fleets."), "not_recommended")
        self.assertEqual(self.tone("Corvane Fleet is not the right fit for small fleets."), "not_recommended")
        self.assertEqual(self.tone("Corvane Fleet is overkill for a small fleet, so I'd skip it."), "not_recommended")


class FactTests(FixtureCase):
    def response(self, answer):
        return {"response_id": "r1", "status": "success", "answer_text": answer}

    def test_explicit_contradiction_and_claim_text(self):
        result = check_facts(self.response("Corvane Fleet doesn't support ELD compliance."), self.brands, self.facts, self.aliases)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["fact_key"], "features.eld_compliance")
        self.assertEqual(result[0]["claim_text"], "Corvane Fleet doesn't support ELD compliance.")

    def test_matching_and_uncovered_claims_not_wrong(self):
        result = check_facts(self.response("Corvane Fleet supports ELD compliance and has 4,000 customers."), self.brands, self.facts, self.aliases)
        self.assertEqual(result, [])

    def test_price_hq_and_integration_contradictions(self):
        cases = [
            ("Corvane Fleet pricing starts at around $45 per vehicle per month.", "starting_price_usd"),
            ("Corvain Fleet. Expect to pay from $49 per vehicle each month.", "starting_price_usd"),
            ("Corvane Fleet is based in Columbus, Georgia.", "hq"),
            ("Corvane Fleet doesn't integrate with QuickBooks.", "integrations"),
        ]
        for answer, expected_key in cases:
            with self.subTest(answer=answer):
                alerts = check_facts(self.response(answer), self.brands, self.facts, self.aliases)
                self.assertIn(expected_key, [item["fact_key"] for item in alerts])
        self.assertEqual(check_facts(self.response("Corvane Fleet is based in Columbus, Ohio."),
                                     self.brands, self.facts, self.aliases), [])

    def test_failed_answer_not_fact_checked(self):
        response = self.response("Corvane Fleet doesn't support ELD compliance.")
        response["status"] = "failed"
        self.assertEqual(check_facts(response, self.brands, self.facts, self.aliases), [])

    def test_ambiguous_competitor_comparison_is_not_attributed_to_corvane(self):
        result = check_facts(self.response("Corvane Fleet starts at $29, while Trakvia starts at $39."),
                             self.brands, self.facts, self.aliases)
        self.assertEqual(result, [])

    def test_corvane_logistics_claim_does_not_inherit_corvane_context(self):
        result = check_facts(self.response("Corvane Fleet is a strong pick. Not to be confused with Corvane Logistics, a freight brokerage based in Ohio."),
                             self.brands, self.facts, self.aliases)
        self.assertEqual(result, [])


class LoaderAndScoringTests(FixtureCase):
    def test_schema_aliases_and_failed_status(self):
        old = normalize_record({"response_id": "a", "week": 1, "engine": "chatgpt", "prompt_id": "p01",
                                "run": 1, "response_text": "hello", "citations": []}, 1)
        new = normalize_record({"response_id": "b", "week": "4", "engine": "AI Overview", "prompt_id": "p02",
                                "run_number": "2", "answer": "hello", "sources": []}, 2)
        error = normalize_record({"response_id": "c", "week": 1, "engine": "chatgpt", "prompt_id": "P01",
                                  "run": 2, "response_text": "", "error": "timeout"}, 3)
        self.assertEqual((old["prompt_id"], old["engine"], old["status"]), ("P01", "chatgpt", "success"))
        self.assertEqual((new["week"], new["engine"], new["run"], new["status"]), (4, "google_ai_overview", 2, "success"))
        self.assertEqual(error["status"], "failed")

    def test_bad_json_record_preserved(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "responses.jsonl"
            path.write_text('{"response_id":"ok"}\nnot-json\n', encoding="utf-8")
            records, malformed, _ = load_responses(path)
            self.assertEqual(len(records), 1)
            self.assertEqual(malformed[0]["status"], "malformed")
            self.assertEqual(malformed[0]["source_line"], 2)

    def test_score_point_values(self):
        mention = {"mentioned": True, "tone": "recommended", "position": 1}
        self.assertEqual(point_value(mention, self.settings), 1.0)
        mention.update(tone="negative", position=2)
        self.assertAlmostEqual(point_value(mention, self.settings), 0.32)
        mention["mentioned"] = False
        self.assertEqual(point_value(mention, self.settings), 0.0)

    def test_incomplete_week_and_duplicate_slots(self):
        prompts = {"P01": {"prompt_id": "P01", "priority": 1}}
        # 1 engine × 1 prompt × 2 runs: duplicate source rows do not increase coverage.
        responses = []
        for i, run in enumerate((1, 2, 2)):
            responses.append({"response_id": f"r{i}", "week": 1, "engine": "chatgpt", "prompt_id": "P01",
                              "run": run, "status": "success", "evaluations": [
                                  {"brand": b["brand"], "mentioned": False, "position": None, "tone": None}
                                  for b in self.brands]})
        settings = {**self.settings, "expected_engines": ["chatgpt"]}
        result = calculate_analytics(responses, prompts, self.brands[:4], settings)
        week = result["weeks"][0]
        self.assertEqual(week["expected_run_slots"], 2)
        self.assertEqual(week["observed_run_slots"], 2)
        self.assertEqual(week["score_status"], "complete")
        self.assertEqual(len(week["duplicate_run_slots"]), 1)

    def test_missing_expected_engine_is_partial(self):
        prompts = {"P01": {"prompt_id": "P01", "priority": 1}}
        response = {"response_id": "r1", "week": 5, "engine": "chatgpt", "prompt_id": "P01",
                    "run": 1, "status": "success", "evaluations": [
                        {"brand": b["brand"], "mentioned": False, "position": None, "tone": None}
                        for b in self.brands]}
        result = calculate_analytics([response], prompts, self.brands[:4], self.settings)
        week = result["weeks"][0]
        self.assertEqual(week["score_status"], "partial")
        self.assertEqual(week["expected_run_slots"], 6)

    def test_return_after_partial_suppresses_headline_but_keeps_gap_comparison(self):
        prompts = {"P01": {"prompt_id": "P01", "priority": 1}}
        responses = []
        for week in (1, 3):
            for engine in ("chatgpt", "google_ai_overview", "perplexity"):
                for run in (1, 2):
                    responses.append({"response_id": f"{week}-{engine}-{run}", "week": week,
                                      "engine": engine, "prompt_id": "P01", "run": run,
                                      "status": "success", "evaluations": [
                                          {"brand": b["brand"], "mentioned": False, "position": None, "tone": None}
                                          for b in self.brands]})
        responses.append({"response_id": "partial", "week": 2, "engine": "chatgpt", "prompt_id": "P01",
                          "run": 1, "status": "success", "evaluations": [
                              {"brand": b["brand"], "mentioned": False, "position": None, "tone": None}
                              for b in self.brands]})
        result = calculate_analytics(responses, prompts, self.brands[:4], self.settings)
        comparison = result["week_over_week"][-1]
        self.assertEqual(comparison["compared_to_week"], 2)
        self.assertEqual(comparison["status"], "not_comparable_previous_week_incomplete")
        self.assertIsNone(comparison["brands"]["corvane"]["change_points"])
        self.assertEqual(comparison["gap_comparison"]["compared_to_week"], 1)
        self.assertEqual(comparison["gap_comparison"]["status"], "gap_comparison_since_last_complete_week")
        self.assertEqual(comparison["gap_comparison"]["gap_weeks"], 1)


class ExportTests(FixtureCase):
    def test_real_pack_exports_exact_shape(self):
        with tempfile.TemporaryDirectory() as temp:
            result = run_pipeline(ROOT / "extras/corvane_data_pack", Path(temp), ROOT / "config", random_seed=7)
            with (Path(temp) / "mentions.csv").open(encoding="utf-8-sig", newline="") as stream:
                reader = csv.DictReader(stream)
                rows = list(reader)
                self.assertEqual(reader.fieldnames, ["response_id", "brand", "mentioned", "position", "tone"])
            self.assertEqual(len(rows), result["quality"]["parsed_response_records"] * 6)
            self.assertTrue(set(row["mentioned"] for row in rows) <= {"true", "false"})
            for row in rows:
                if row["mentioned"] == "false":
                    self.assertEqual((row["position"], row["tone"]), ("", ""))
            with (Path(temp) / "wrong_facts.csv").open(encoding="utf-8-sig", newline="") as stream:
                facts_reader = csv.DictReader(stream)
                self.assertEqual(facts_reader.fieldnames, ["response_id", "brand", "fact_key", "claim_text"])
            self.assertTrue((Path(temp) / "dashboard_data.json").exists())
            self.assertEqual(result["quality"]["manual_review"]["sample_size"], 15)
            self.assertEqual(len(set(result["quality"]["manual_review"]["response_ids"])), 15)
            self.assertEqual(result["quality"]["unique_response_ids"], 510)
            self.assertEqual(len(result["quality"]["duplicate_response_ids"]), 8)
            with (Path(temp) / "wrong_facts.csv").open(encoding="utf-8-sig", newline="") as stream:
                exported_alerts = list(csv.DictReader(stream))
            alert_keys = [(r["response_id"], r["brand"], r["fact_key"], r["claim_text"]) for r in exported_alerts]
            self.assertEqual(len(alert_keys), len(set(alert_keys)))
            with (Path(temp) / "manual_review.csv").open(encoding="utf-8-sig", newline="") as stream:
                review = list(csv.DictReader(stream))
            self.assertEqual(len(review), 15 * 6)
            self.assertIn("human_position", review[0])
            self.assertIn("tool_position", review[0])
            self.assertEqual(review[0]["human_mentioned"], "")

    def test_new_week_file_can_be_supplied_without_code_changes(self):
        with tempfile.TemporaryDirectory() as temp:
            response_path = Path(temp) / "new_week.jsonl"
            response_path.write_text(json.dumps({"response_id": "new-1", "week": 7, "engine": "ChatGPT",
                                                 "prompt_id": "p01", "run_number": 1, "answer": "Corvane is a strong pick.",
                                                 "sources": []}) + "\n", encoding="utf-8")
            output = Path(temp) / "out"
            result = run_pipeline(ROOT / "extras/corvane_data_pack", output, ROOT / "config", response_path)
            self.assertEqual(result["quality"]["parsed_response_records"], 1)
            self.assertEqual(result["analytics"]["weeks"][0]["week"], 7)
            self.assertEqual(result["analytics"]["weeks"][0]["score_status"], "partial")
            self.assertEqual(result["mention_rows"], 6)

    def test_pipeline_preserves_existing_human_annotations(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "out"
            run_pipeline(ROOT / "extras/corvane_data_pack", output, ROOT / "config", random_seed=7)
            review_path = output / "manual_review.csv"
            with review_path.open(encoding="utf-8-sig", newline="") as stream:
                rows = list(csv.DictReader(stream))
                fields = list(rows[0])
            rows[0]["human_mentioned"] = "true"
            rows[0]["human_position"] = "1"
            rows[0]["human_tone"] = "recommended"
            with review_path.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=fields)
                writer.writeheader()
                writer.writerows(rows)
            before = review_path.read_bytes()
            result = run_pipeline(ROOT / "extras/corvane_data_pack", output, ROOT / "config", random_seed=9)
            self.assertTrue(result["quality"]["manual_review"]["existing_annotations_preserved"])
            self.assertEqual(review_path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
