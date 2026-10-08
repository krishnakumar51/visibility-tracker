# Pipeline design

**Status:** this is the original design record. The pipeline, API, and frontend have since been implemented. For current behavior and unmet requirements, see `README.md` and `CASE_STUDY_REQUIREMENTS.md`; the ?proposed? sections are design context, not promises that every listed item shipped.

## Proposed architecture

Use a small local application with a deterministic processing library, configuration/data files, and a thin dashboard/API added after the pipeline. Read raw JSONL/CSV/JSON, normalize into in-memory or generated files outside the original pack, then create evaluation records and CSV exports. Keep inputs, rules, and outputs separate. A local file-backed workflow is sufficient for the analysis of 518 records and new weekly files. The analysis remains local and deterministic; SQLite is used only for upload-run state and persistence. No paid service, microservices, or model is used.

The pipeline should retain source `response_id` and raw text at every step so classifications can be reviewed. Add validation summaries (record counts, unknown prompts, failed rows, duplicate panel keys, missing slots, schema aliases) alongside dashboard data. Never modify `extras/corvane_data_pack/`.

## Stages

### 1. Raw ingestion

- **Input:** all JSONL response files, `prompts.csv`, `brands.json`, `facts.json`.
- **Processing:** parse records independently; report malformed JSON or missing required fields. Read only supported input files; later week's file is discovered/selected without changing code.
- **Output:** raw response objects plus config/reference objects and an ingestion report.
- **Edge cases:** blank lines, malformed line, schema A/B, extra fields, error rows, absent/new week, encoding.
- **Tests:** fixture with both schemas, malformed JSON line, extra key, missing file, and a new week.

### 2. Normalization

- **Input:** raw records and prompt table.
- **Processing:** map `response_text`/`answer`, `citations`/`sources`, `run`/`run_number`, `collected_at`/`collected`, `prompt_id`; lowercase prompt IDs; canonicalize engine aliases (`chatgpt`, `perplexity`, `google_ai_overview`) while retaining raw engine. Keep week as a string or integer canonical key. Parse dates only when unambiguous; weekly analysis uses `week` rather than localized collection dates. Preserve raw field values for traceability.
- **Output:** normalized response with response ID, week, canonical and raw engine, prompt ID/text/stage/priority if matched, run, collection value, answer text, citations, error/status.
- **Edge cases:** case drift, schema changes, null/empty sources, timeout, unknown prompt, timestamp timezone and locale. Never convert timeout into empty answer.
- **Tests:** field alias equivalence, case normalization, prompt joins, empty/null values, unknown prompt, timestamps.

### 3. Company identification and mention detection

- **Input:** normalized answer text and `brands.json`.
- **Processing:** detect configured official names, known spellings/spacing variants, obvious misspellings, and domain variants in answer text only. Use conservative token boundaries and explicit aliases. Add a hard exclusion/guard for Corvane Logistics so its name cannot map to Corvane. Do not scan citation/source values. Variation list should be data-driven and reviewable; do not use fuzzy matching without a threshold and false-positive tests.
- **Output:** spans and canonical company IDs for every detection, then six per-answer company mention rows (including false rows).
- **Edge cases:** case, punctuation, `TrakVia`/`RouteLyne`/`Route Lyne`, domain with scheme/www/path, substring collisions, same company repeated, Corvane Logistics, mention only in citation.
- **Tests:** each official name/domain, observed spelling variations in corpus, misspellings, Logistics exclusion, citation-only, repeated occurrence, no company.

### 4. Position detection

- **Input:** company spans in answer text.
- **Processing:** sort occurrences by start offset; each newly encountered tracked/detection company gets the next rank; repeated mentions do not change rank. Only six configured brands count; ignore citations.
- **Output:** first-mention order and integer position per mentioned company; blank otherwise.
- **Edge cases:** two companies in a single sentence/table row, overlaps between aliases, repeated companies, Markdown formatting, websites.
- **Tests:** exact order, repeated name, table/list order, nonconfigured company ignored, citations ignored.

### 5. Tone detection

- **Input:** each company’s answer context and mention spans.
- **Processing:** deterministic, explainable context rules or small lexicon classify recommendation, neutral mention, criticism, or advice against. Group relevant statements by company and decide tone from the final verdict about it, consistent with brief. Store evidence/context and a confidence or review-needed state internally; export only required labels. Avoid inferring a verdict from tone words unrelated to that company.
- **Output:** one tone per mentioned company.
- **Edge cases:** mixed praise/criticism; final verdict; negation; “cheap but…”; comparisons; generic verdict applying to multiple companies; no judgment; model hedging.
- **Tests:** examples for all four values, mixed cases resolved by final verdict, company-specific attribution, neutral, unrelated sentiment.

### 6. Wrong-fact detection

- **Input:** answer text and `facts.json`.
- **Processing:** detect explicit factual assertions for supported fields and compare normalized values/feature state/integration membership with facts. Emit only a contradiction with a traceable text excerpt and dotted fact key. Unsupported topics/claims are unverified, not wrong. Core scope is Corvane; competitor checking is stretch. Keep rules explicit and conservative.
- **Output:** zero or more fact alerts with response ID, brand, fact key, exact claim text, and optionally review status/evidence.
- **Edge cases:** paraphrases, units, variants, negation, conditional language, quoted/unendorsed text, conflicting claims, price range versus starting price, unsupported claim.
- **Tests:** each supported field type (price, HQ, year, feature, integration), correct fact no alert, contradiction alert, missing fact unverified, ambiguous claim held for review.

### 7. Normalized evaluation records

- **Input:** normalized responses and detections.
- **Processing:** produce response-level records and exactly six brand rows per valid answer. Preserve answer, citations, source engine/week/prompt, mention spans and statuses. For error/empty answer, keep record traceable but mark evaluation unavailable; exports require careful policy because the mandated schema has no unavailable value (see open decision).
- **Output:** internal JSON/CSV-like records feeding export, score, and UI.
- **Edge cases:** duplicate IDs, failed response, unmatched prompt, additional companies in a later configuration.
- **Tests:** row cardinality and link integrity.

### 8. Visibility scoring

- **Input:** complete evaluations, score proposal in `SCORING_DESIGN.md`.
- **Processing:** aggregate consistently by prompt and engine, account for two-run variation, completeness, and fixed configured priorities.
- **Output:** weekly score per tracked company, score components, sample coverage, uncertainty/status.
- **Edge cases/tests:** absent company, extreme position, competitor parity, one complete run, missing entire engine/week, order-independent aggregation, equal data same score.

### 9. Week-over-week analysis

- **Input:** weekly estimates and panel-coverage report.
- **Processing:** compare like-for-like prompt/engine strata. Suppress or qualify comparison for incomplete week and calculate change against previous comparable week; distinguish observed delta from ordinary paired-run spread.
- **Output:** change amount/status and drivers (questions/engines/mention, tone, position changes).
- **Edge cases:** W5 missing engine, failed slots, new prompt/engine, run duplicates, insufficient runs. Do not fill missing slots with zero.
- **Tests:** incomplete week cannot show false zero/drop; complete neutral week; variation within threshold; persistent movement; changed coverage comparison.

### 10. CSV exports

- **Input:** normalized per-answer evaluation and contradictions.
- **Processing:** write exact required header order, lowercase `true`/`false`, blank position/tone on non-mention, exact row count of six per response (subject to the unresolved failed-answer convention). Wrong-fact rows preserve claim wording and dotted key.
- **Output:** `mentions.csv`, `wrong_facts.csv` outside source data.
- **Edge cases:** commas/quotes/newlines in claim, UTF-8, blank values, no fact alerts, stable brand IDs.
- **Tests:** headers/order, row count, CSV round-trip, exact blanks and booleans, response ID join, one row per incorrect claim.

### 11. Dashboard data

- **Input:** scores, coverage, drivers, alerts, source list, normalized answers, mentions.
- **Processing:** provide one stable data contract to a future frontend; keep analysis independent of presentation.
- **Output:** JSON/API or local query functions. No frontend technology selected at this planning stage.
- **Edge cases/tests:** no data, partial latest week, company filters, pagination/large answers, escaping highlighted spans.

## Frontend data contract (proposed)

- `meta`: available weeks, latest week, data freshness, source file, coverage and data-quality warnings.
- `scores[]`: week, brand, score (0–100), score components, sample size/expected size, coverage, comparability status, change vs previous comparable week, variation range/status.
- `drivers[]`: brand, question ID/text, engine, prior/current mentions, tone, position, contribution to score movement, answer IDs.
- `alerts[]`: response ID, week, engine, prompt, brand, fact key, claim text, severity/review state, answer link.
- `recommendations[]`: proposed action text and linked evidence/driver. Rules for producing recommendations are not specified; begin with transparent templates, and validate wording with the user before implementing.
- `answers[]`: response ID, week, engine, prompt ID/text/stage/priority, run, status, original answer, citations, mention records and character spans, fact alerts.
- `filters`: available values and current selections for week, question, engine, stage, and company.
- `exports`: file name, generation time, row count, downloadable location.

Marcus’s overview uses scores, changes, competitor positions, coverage warnings, fact alerts, and evidence-linked actions. Priya’s view uses filters, answer detail, highlighted spans, question non-mentions, sources, and exports.

## Testing and manual validation strategy

Automated tests should use small hand-written fixtures around identified edge cases, then a dataset-level validation run for schema mix, coverage, duplicate keys, alert counts, and export shape. Avoid testing only the existing pack. The required manual 15-answer check: select 15 distinct response IDs at random using a recorded seed; independently annotate each answer for each of six company mentions and each mentioned-company tone (and optionally position); compare tool outputs; record selection seed/IDs, reviewer date, definitions, counts, disagreements, and representative failure examples in README. Report mention and tone accuracy with denominators, do not fabricate results before that review occurs.

## Implemented conservative choices

- Expected engines are kept in `backend/config/scoring.json`, so a new weekly file missing an entire engine is still identified as partial.
- Eight repeated week-2 ChatGPT slots reuse the same response IDs and identical content. Source-line rows are retained and reported; duplicate slots do not add scoring weight. The corpus has 518 records and 510 unique response IDs.
- A sentence naming multiple companies is skipped for fact-checking because attribution is ambiguous. Pronoun-only claim sentences may inherit the most recently named company within their paragraph.
- The exact mentions export cannot represent unavailable. Failed/unusable response rows use false/blank placeholders there, while JSON preserves status; failed rows are excluded from scores and fact checks.
- Headline week-over-week movement is suppressed after a partial prior week; an optional gap comparison is separate and explicitly labeled. Week 6 has no W/W headline delta and a separate W4 comparison.
- Fact checks cover only Corvane. Competitor fact checking remains unimplemented stretch scope.
