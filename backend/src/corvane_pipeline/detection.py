"""Brand mention, position, and lightweight tone rules."""
from __future__ import annotations

import re
from typing import Any


def _token_pattern(value: str) -> re.Pattern[str]:
    escaped = re.escape(value.strip())
    escaped = escaped.replace(r"\ ", r"\s+")
    return re.compile(rf"(?<![\w]){escaped}(?![\w])", re.IGNORECASE)


def _aliases(brands: list[dict[str, Any]], alias_config: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for brand in brands:
        values = {brand["name"], *alias_config.get("aliases", {}).get(brand["brand"], [])}
        domain = brand["website"].lower().removeprefix("www.")
        # Match domains as domains, whether or not the answer includes scheme/www/path.
        values.add(domain)
        for value in values:
            if not value:
                continue
            is_domain = "." in value and "/" not in value
            if is_domain:
                pattern = re.compile(rf"(?<![\w@])(?:https?://)?(?:www\.)?{re.escape(domain)}(?![\w.-])", re.I)
            else:
                pattern = _token_pattern(value)
            items.append({"brand": brand["brand"], "alias": value,
                          "pattern": pattern, "length": len(value)})
    return sorted(items, key=lambda item: item["length"], reverse=True)


def detect_mentions(answer_text: str, brands: list[dict[str, Any]],
                    alias_config: dict[str, Any]) -> list[dict[str, Any]]:
    """Find answer-text mentions with spans; overlapping aliases collapse to one."""
    exclusions = alias_config.get("exclusions", {}).get("corvane", [])
    excluded_spans = [match.span() for exclusion in exclusions
                      for match in _token_pattern(exclusion).finditer(answer_text)]
    matches: list[dict[str, Any]] = []
    for alias in _aliases(brands, alias_config):
        for match in alias["pattern"].finditer(answer_text):
            start, end = match.span()
            if alias["brand"] == "corvane" and any(start < ex_end and end > ex_start
                                                    for ex_start, ex_end in excluded_spans):
                continue
            matches.append({"brand": alias["brand"], "matched_text": match.group(0),
                            "start": start, "end": end, "rule": alias["alias"]})
    # Prefer the longest alias at a given text span and discard overlapping duplicate forms.
    matches.sort(key=lambda m: (m["start"], -(m["end"] - m["start"]), m["brand"]))
    chosen: list[dict[str, Any]] = []
    for item in matches:
        if any(item["start"] < prior["end"] and item["end"] > prior["start"]
               for prior in chosen):
            continue
        chosen.append(item)
    chosen.sort(key=lambda m: (m["start"], m["end"], m["brand"]))
    first_position: dict[str, int] = {}
    for item in chosen:
        if item["brand"] not in first_position:
            first_position[item["brand"]] = len(first_position) + 1
        item["position"] = first_position[item["brand"]]
    return chosen


_NOT_RECOMMENDED = re.compile(r"\b(avoid|do not choose|don't choose|would not choose|wouldn't choose|should not choose|shouldn't choose|not recommended|not recommend|would not recommend|wouldn't recommend|steer clear|stay away from|would not go with|wouldn't go with|not the right fit|isn't the right fit|is not the right fit|not the right choice|isn't the right choice|is not the right choice|not a good fit|not the best fit|overkill|skip it|skip them|not suitable)\b", re.I)
_NEGATIVE = re.compile(r"\b(complaint|complaints|complained|clunky|outage|outages|slow support|slow fixes|expensive|overpriced|poor|weak|unreliable|drawn complaints|billing issue|billing issues|doesn't support|does not support|doesn't offer|does not offer|lacks|lack of|requires a separate tool)\b", re.I)
_RECOMMENDED = re.compile(r"\b(recommend(?:s|ed|ation)?|strong pick|hard to beat|best choice|best option|best fit|best overall|top choice|first choice|top suggestion|stands out|reliable choice|safest choice|worth shortlisting|if i had to pick one|i'd pick|i would pick|i'd choose|i would choose|i'd go with|i would go with|i'd start with|i would start with|start with|it's the one i'd pick|it is the one i'd pick|it would be|one of the better choices|great choice|good choice)\b", re.I)


def _sentences(text: str) -> list[tuple[int, int, str]]:
    # Keep sentence splits deliberately simple; newline/list boundaries are also useful context.
    result = []
    for match in re.finditer(r"[^.!?\n]+(?:[.!?]+|$)", text):
        chunk = match.group(0).strip()
        if chunk:
            left = match.start() + len(match.group(0)) - len(match.group(0).lstrip())
            result.append((left, left + len(chunk), chunk))
    return result


def classify_tone(brand: str, answer_text: str, mentions: list[dict[str, Any]]) -> dict[str, Any]:
    """Use nearby company-specific language; final applicable verdict wins."""
    own = [m for m in mentions if m["brand"] == brand]
    if not own:
        return {"tone": None, "evidence": []}
    sentences = _sentences(answer_text)
    evidence = []
    for mention in own:
        candidates = [(a, b, text) for a, b, text in sentences if a <= mention["end"] and b >= mention["start"]]
        if not candidates:
            continue
        _, _, text = candidates[0]
        # Continuation verdicts often use "it/they" after a named company.
        next_own = min((m["start"] for m in own if m["start"] > mention["start"]), default=len(answer_text))
        next_other = min((m["start"] for m in mentions if m["start"] > mention["start"] and m["brand"] != brand), default=len(answer_text))
        boundary = min(next_own, next_other, mention["end"] + 220)
        following = answer_text[mention["end"]:boundary]
        # Include only the rest of the current paragraph when it contains an explicit verdict.
        paragraph_end = answer_text.find("\n\n", mention["end"])
        if paragraph_end < 0:
            paragraph_end = len(answer_text)
        continuation = answer_text[mention["end"]:min(paragraph_end, boundary)]
        context = text + " " + continuation
        verdicts = []
        for pattern, label in ((_NOT_RECOMMENDED, "not_recommended"),
                               (_NEGATIVE, "negative"), (_RECOMMENDED, "recommended")):
            verdicts.extend((match.end(), label) for match in pattern.finditer(context))
        tone = max(verdicts, key=lambda value: value[0])[1] if verdicts else "neutral"
        evidence.append({"start": mention["start"], "context": context.strip(), "tone": tone})
    return {"tone": evidence[-1]["tone"] if evidence else "neutral", "evidence": evidence}
