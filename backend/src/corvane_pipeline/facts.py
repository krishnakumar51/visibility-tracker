"""Conservative rule-based checks against explicit fact-pack fields."""
from __future__ import annotations

import re
from typing import Any

from .detection import detect_mentions


FEATURE_TERMS = {
    "gps_tracking": r"\b(gps tracking|gps tracking software|gps tracking feature)\b",
    "eld_compliance": r"\b(eld compliance|eld-compliant|eld compliant|eld software)\b",
    "fuel_card_integration": r"\b(fuel[- ]card integration|fuel card integrations|fuel cards?)\b",
    "maintenance_alerts": r"\b(maintenance alerts?|maintenance notifications)\b",
    "driver_app": r"\b(driver app|drivers' app|mobile app)\b",
    "dashcams": r"\b(dashcams?|dashboard cameras?|video cameras?)\b",
    "payroll": r"\b(payroll)\b",
}
NEGATION = re.compile(r"\b(no|not|never|doesn't|does not|don't|do not|without|lacks?|lack)\b", re.I)
POSITIVE = re.compile(r"\b(has|have|offers?|includes?|supports?|provides?|features?|integrates? with)\b", re.I)
NEGATED_PREDICATE = re.compile(r"\b(?:doesn't|does not|don't|do not|not|never|without|lacks?|lack)\s+(?:(?:currently|natively|any)\s+)?(?:have|has|offer|offers|include|includes|support|supports|provide|provides|feature|features|integrate|integrates)\b", re.I)


def _paragraphs(text: str) -> list[str]:
    return [part for part in re.split(r"\n\s*\n", text) if part.strip()]


def _segments(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", text) if part.strip()]


def _feature_claim(sentence: str, feature: str, truth: bool) -> bool | None:
    for term in re.finditer(FEATURE_TERMS[feature], sentence, re.I):
        left = sentence[max(0, term.start() - 60):term.start()]
        right = sentence[term.end():min(len(sentence), term.end() + 40)]
        context = left + " " + right
        negative = bool(NEGATED_PREDICATE.search(left)) or bool(re.search(r"\b(no|without|lacks?|lack)\s+$", left, re.I))
        positive = bool(POSITIVE.search(left))
        # “integrations include X” is positive even without an auxiliary before the feature.
        if feature == "fuel_card_integration" and re.search(r"\bintegrat\w*\b", left, re.I):
            positive = True
        if negative:
            return False
        if positive:
            return True
        # Avoid treating bare mentions such as “questions about dashcams” as assertions.
        if re.search(r"\b(no|not|without|doesn't|does not|has|have|offers?|supports?|includes?)\b", context, re.I):
            return not negative
    return None


def check_facts(response: dict[str, Any], brands: list[dict[str, Any]],
                facts: dict[str, Any], alias_config: dict[str, Any], client_key: str = "corvane") -> list[dict[str, str]]:
    if response.get("status") != "success":
        return []
    company_facts = facts.get(client_key)
    if not company_facts:
        return []
    mentions = detect_mentions(response["answer_text"], brands, alias_config)
    if not any(item["brand"] == client_key for item in mentions):
        return []
    alerts: list[dict[str, str]] = []
    for paragraph in _paragraphs(response["answer_text"]):
        active_brand = None
        for sentence in _segments(paragraph):
            exclusions = alias_config.get("exclusions", {}).get(client_key, [])
            if any(re.search(rf"(?<![\w]){re.escape(value).replace(r'\ ', r'\s+')}(?![\w])",
                             sentence, re.I) for value in exclusions):
                active_brand = None
                continue
            local_mentions = detect_mentions(sentence, brands, alias_config)
            local_brands = {item["brand"] for item in local_mentions}
            # A single sentence that names multiple companies makes pronoun and
            # fact attribution uncertain; avoid assigning another company's fact to Corvane.
            if len(local_brands) > 1:
                active_brand = local_mentions[-1]["brand"]
                continue
            if local_mentions:
                active_brand = local_mentions[-1]["brand"]
            refers_to_active_brand = bool(re.search(r"\b(it|its|they|their|this company|the company)\b", sentence, re.I))
            fact_claim_candidate = bool(re.search(
                r"\b(?:starts? at|starting at|priced? at|costs?|expect to pay|pay(?:ing)?|"
                r"founded|established|headquartered|based in|located in)\b", sentence, re.I))
            fact_claim_candidate = fact_claim_candidate or any(
                re.search(pattern, sentence, re.I) for pattern in FEATURE_TERMS.values())
            if active_brand != client_key or not (any(item["brand"] == client_key for item in local_mentions)
                                                  or refers_to_active_brand or fact_claim_candidate):
                continue

            def add(key: str) -> None:
                item = {"response_id": response["response_id"], "brand": client_key,
                        "fact_key": key, "claim_text": sentence}
                if item not in alerts:
                    alerts.append(item)

            price = re.search(
                r"\b(?:starts? at|starting at|priced? at|costs?|expect to pay|pay(?:ing)?)"
                r"\s*(?:(?:from|about|around|approximately|roughly)\s*)?"
                r"\$?\s*(\d+(?:\.\d{1,2})?)", sentence, re.I)
            if price and float(price.group(1)) != float(company_facts["starting_price_usd"]):
                add("starting_price_usd")
            founded = re.search(r"\b(?:founded|established|started)\s+(?:in\s+)?(\d{4})\b", sentence, re.I)
            if founded and int(founded.group(1)) != int(company_facts["founded"]):
                add("founded")
            hq = re.search(r"\b(?:based|headquartered|located)\s+in\s+([A-Z][A-Za-z .'-]+(?:,\s*[A-Z][A-Za-z .'-]+)?)", sentence)
            if hq:
                claimed = re.sub(r"\s+", " ", hq.group(1).strip().rstrip(" .,!?:;")).casefold()
                actual = re.sub(r"\s+", " ", company_facts["hq"].strip()).casefold()
                actual_city = actual.split(",", 1)[0].strip()
                location_matches = claimed == actual or ("," not in claimed and claimed == actual_city)
                if claimed and not location_matches:
                    add("hq")
            for feature in company_facts.get("features", {}):
                claimed = _feature_claim(sentence, feature, company_facts["features"][feature])
                if claimed is not None and claimed != company_facts["features"][feature]:
                    add(f"features.{feature}")
            integrations = company_facts.get("integrations", [])
            known_integrations = sorted({value for company in facts.values() if isinstance(company, dict)
                                         for value in company.get("integrations", [])}, key=len, reverse=True)
            for integration in known_integrations:
                for match in re.finditer(rf"\b{re.escape(integration)}\b", sentence, re.I):
                    left = sentence[max(0, match.start() - 90):match.start()]
                    negative = re.search(
                        r"\b(?:doesn't|does not|don't|do not|no)\s+"
                        r"(?:(?:support|have|provide)\s+)?"
                        r"(?:an?\s+)?(?:integration|integrate|integrates)?\s*(?:with)?\s*$",
                        left, re.I)
                    positive = re.search(
                        r"\b(?:integrates? with|integration with|integrations include|supports? integration with)\s*$",
                        left, re.I)
                    is_supported = integration.casefold() in {value.casefold() for value in integrations}
                    if negative and is_supported:
                        add("integrations")
                    elif positive and not is_supported:
                        add("integrations")
    return alerts
