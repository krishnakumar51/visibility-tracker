# Implementation plan

**Status:** this is the original implementation plan and its checklists are historical acceptance references. The Python pipeline, CLI, tests, React dashboard, FastAPI upload/history layer, and deployment configuration are now implemented. The application is deployed on Vercel with its API on Railway. Locally, the web app still requires separate backend and frontend processes. Current requirement status is in `CASE_STUDY_REQUIREMENTS.md`.

## MUST HAVE

### Phase 1 — Data inventory and fixtures
- **Objective:** make observed schemas, aliases, and panel expectations executable as fixtures.
- **Likely files:** `tests/fixtures/`, `src/...` later; do not copy the original pack elsewhere unnecessarily.
- **Dependencies:** data dictionary.
- **Output:** validation report specification and small synthetic fixtures.
- **Tests:** both response schemas, engine/prompt variants, timeout, missing fields.
- **Acceptance:** ingestion can explain 518 records, six-week distribution, schema counts, and anomalies without altering source.

### Phase 2 — Ingestion and normalization
- **Objective:** accept existing and future weekly files with supported minor field variations.
- **Likely modules:** `loader`, `normalizer`, config readers.
- **Dependencies:** none beyond standard CSV/JSON libraries unless selected stack needs a minimal library.
- **Output:** canonical response records and data-quality report.
- **Tests:** schema aliases, IDs, engine case, localized timestamps, null arrays, errors, unknown prompt.
- **Acceptance:** all valid records join the right prompt/week/engine; failed records remain identifiable, never silently treated as absence.

### Phase 3 — Company dictionary and mention detection
- **Objective:** detect all six brands and avoid false Corvane matches.
- **Likely modules:** brand config/aliases and `mention_detector`.
- **Dependencies:** normalized answer text, brands.
- **Output:** match spans and canonical brand IDs.
- **Tests:** name, website, spelling/spacing/misspelling, citation-only exclusion, Corvane Logistics exclusion, false-positive boundaries.
- **Acceptance:** every response can be represented against all six brand IDs.

### Phase 4 — Position and tone
- **Objective:** assign ordered first mention and final company-specific verdict.
- **Likely modules:** `position`, `tone`.
- **Dependencies:** Phase 3 spans.
- **Output:** position/tone per mentioned brand with reviewable internal evidence.
- **Tests:** all tone labels, mixed final verdict, comparisons, repeated mentions, Markdown/table order.
- **Acceptance:** output respects definitions, ambiguous cases are visible for manual review.

### Phase 5 — Fact checks
- **Objective:** flag supported factual contradictions, starting with Corvane.
- **Likely modules:** `fact_checker`, field-specific claim rules.
- **Dependencies:** facts config, normalized answers.
- **Output:** response-linked fact key and verbatim claim excerpt; unverified status for uncovered claims.
- **Tests:** price/HQ/year/boolean feature/integration true and false cases, unverified claim, ambiguity.
- **Acceptance:** no unsupported claim is labeled wrong; each emitted alert is traceable.

### Phase 6 — Evaluation records and required exports
- **Objective:** serialize evaluations and exact assessment CSVs.
- **Likely modules:** `evaluator`, `exporter`.
- **Dependencies:** Phases 1–5.
- **Output:** normalized records, `mentions.csv`, `wrong_facts.csv`.
- **Tests:** exact headers/order, six rows per response, blanks, row and ID counts, CSV escaping.
- **Acceptance:** outputs meet brief format and preserve failed-row policy decision.

### Phase 7 — Score and weekly comparison
- **Objective:** implement the approved simple score with coverage/variation safeguards.
- **Likely modules:** `scoring`, `weekly_analysis`.
- **Dependencies:** evaluation and confirmed score weights.
- **Output:** company-week scores, coverage, comparison status, driver evidence.
- **Tests:** equal comparability, no missing-as-zero, repeated key handling, variation signal, partial week suppression.
- **Acceptance:** incomplete W5 does not become a false drop; all tracked companies share the same method.

### Phase 8 — Automated and manual validation
- **Objective:** compare logic against fixture expectations and 15 hand-reviewed answers.
- **Likely modules:** `tests`, review worksheet or CSV outside raw pack.
- **Dependencies:** functional core.
- **Output:** automated test results, recorded 15-answer annotation, mention/tone accuracy and failure notes.
- **Tests:** cases in pipeline design; rerun with future-week fixture.
- **Acceptance:** actual denominators, seed, IDs, and disagreements documented, with no invented results.

### Phase 9 — Local dashboard/API
- **Objective:** serve Marcus overview and Priya detail using a stable backend contract.
- **Likely modules:** `dashboard` or API and frontend selected later.
- **Dependencies:** pipeline contract and working exports.
- **Output:** overview, filters, answer drill-down, highlights, alerts, action ideas, exports.
- **Tests:** empty/partial state, filters, highlighting spans, answer links, keyboard/usability review.
- **Acceptance:** one command launches locally; Marcus can understand score/coverage/action; Priya can inspect answer and export.

### Phase 10 — README and handoff
- **Objective:** meet run/submission documentation requirements based on real behavior.
- **Likely files:** `README.md`, note to Marcus.
- **Dependencies:** implemented choices and actual accuracy review.
- **Output:** run instructions, assumptions, priorities, accuracy findings, actual AI use/mistakes, 20-client operations half-page, Marcus note.
- **Tests:** follow instructions on a clean local environment; verify filenames/commands.
- **Acceptance:** no fabricated accuracy or AI usage claims; explain format change handling, cost, and storage.

## STRETCH (after core is reliable)

1. Head-to-head by question/engine and replacement tracking.
2. Priya filters and full answer highlighting (if not in first usable dashboard cut, this is stretch per brief).
3. Competitor fact checking.
4. Sources and sites citing competitors but not Corvane.
5. Board report export.
6. Configuration-driven market side and adding competitors.
7. Deployment (completed; current setup is documented in `DEPLOYMENT.md`).

## OPTIONAL POLISH

- Improved design and charts, accessible styling, data-quality summaries, downloadable filtered reports, and expanded recommendations. Recommendations should remain evidence-linked and transparent. No technology choice is required at this stage.

## Frontend/backend data contract

Backend should expose `meta` (weeks, latest week, freshness, coverage, warnings); `scores[]` (week, brand, score, components, sample/expected counts, completeness, comparability, change and run variation); `drivers[]` (question, engine, old/new mention/tone/position, contribution, response links); `alerts[]` (response, brand, dotted fact key, claim, evidence/review status); `recommendations[]` (plain action tied to evidence); `answers[]` (IDs, prompt/stage/priority, engine/week/run/status, original answer, citations, mention spans, fact alerts); filter values for week/question/engine/stage/company; and export metadata/download paths. This supports Marcus’s Monday overview and Priya’s analysis without choosing React, Streamlit, or another frontend now.

## Highest-risk work

1. **Recall and precision of names:** obvious spellings/domains vs Corvane Logistics and citation-only matches.
2. **Tone attribution:** mixed verdicts and company-specific context are difficult for simple rules.
3. **Fact extraction:** paraphrased numbers, negations, and unsupported claims; conservative false-positive control matters.
4. **Coverage and duplicates:** W5 is missing an engine, W2 has extra ChatGPT rows, and errors exist. A score that hides this would mislead Marcus.
5. **Format robustness:** two schema generations and engine/prompt casing drift.
6. **Honest validation:** 15 answers measure only a small portion of errors; report sample and denominators.

## Decisions resolved during implementation

- The configured score weights, prompt priority weights, and run-variation threshold are documented in `backend/config/scoring.json` and `docs/SCORING_DESIGN.md`; score calculations were independently checked against generated output.
- The fixed mentions CSV uses false/blank placeholders for failed rows because its required schema has no unavailable value. JSON retains response status, and failed rows do not enter scores or fact checks.
- Eight duplicate W2 ChatGPT slots reuse the same IDs and identical content. Source lines remain visible and quality output flags them; duplicate slots do not add score weight.
- `AI Overview` maps to the Google AI Overview engine. Weekly grouping uses the explicit week field; ambiguous localized timestamps are not needed for weekly comparisons.
- W6 does not publish a headline W/W delta after partial W5. It has a separate labeled gap comparison to W4.
- Automated corpus audit and fixtures are complete. The completed human sample covers 15 unique answers / 90 answer-brand rows: mention 90/90, tone 33/37, diagnostic position 37/37. Four tone disagreements are recorded in the README and `outputs/manual_review_comparison.json`.
