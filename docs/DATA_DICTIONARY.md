# Data dictionary

Inspection covers all five supplied pack files and all 518 non-empty JSONL records. Original files are source data and remain untouched.

## `README.txt`

- **Format:** plain text.
- **Contents:** says responses cover weeks 1–6, ChatGPT/Perplexity/Google AI Overviews, two runs per question-engine-week; prompts are 15 buyer questions; brands lists companies/websites; facts lists truths. Calls the pack fictional.
- **Observed caveat:** the statement implies a complete balanced panel, but the actual record counts and schema below do not match a complete 540-record panel.

## `brands.json`

- **Format/structure:** UTF-8 JSON object with `client`, `tracked_competitors`, and `other_companies`. Each company object has `name` and `website` strings.
- **Companies:** Corvane Fleet (`corvanefleet.com`); Trakvia (`trakvia.com`); Routelyne (`routelyne.com`); Gridwell Systems (`gridwell.io`); Fleetora (`fleetora.com`); Novahaul (`novahaul.com`).
- **Relationships:** Corvane is the client; three competitors are fully tracked; two others are detection-only. `facts.json` contains the client and three tracked competitors, not Fleetora or Novahaul.
- **Processing notes:** use configured names/websites. Brief specifies Corvane Logistics exclusion. Preserve official `brand` keys required by CSV as normalized slugs (`corvane`, etc.); the file itself does not define those keys.

## `facts.json`

- **Format/structure:** JSON object with `_note` and four company objects: `corvane`, `trakvia`, `routelyne`, `gridwell`.
- **Fields:** `name` and `website` (strings); `starting_price_usd` and `founded` (numbers); `price_unit` and `hq` (strings); `features` (booleans for `gps_tracking`, `eld_compliance`, `fuel_card_integration`, `maintenance_alerts`, `driver_app`, `dashcams`, `payroll`); `integrations` (string arrays).
- **Values:** Corvane starts at 29 USD per vehicle per month, Columbus, Ohio, founded 2014; has GPS, ELD, fuel-card integration, maintenance alerts, driver app; lacks dashcams and payroll; integrations QuickBooks, WEX, Comdata. Trakvia: $39, Austin, 2016; has GPS, ELD, maintenance, app, dashcams; lacks fuel card and payroll; Salesforce. Routelyne: $19, Phoenix, 2019; has GPS and app; lacks ELD, fuel card, maintenance, dashcams, payroll; no integrations. Gridwell: $55, Chicago, 2008; has GPS, ELD, fuel card, maintenance, app, dashcams; lacks payroll; SAP and Oracle.
- **Relationships/limits:** facts align to four tracked companies. No truths about the two other companies. The file establishes claim-checking scope but not a complete ontology, equivalence rules, or evidence-extraction format. Unsupported claims are unverified, not wrong.

## `prompts.csv`

- **Format:** CSV with header and 15 rows, 4 columns: `prompt_id` (string P01–P15), `question` (string), `stage` (string), `priority` (integer 1–3).
- **Stages observed:** `comparing_options`, `early_research`, `specific_company`.
- **Priority counts:** priority 1: 2 rows; priority 2: 7; priority 3: 6.
- **Examples:** P01 “What is the best fleet tracking software for a small trucking company?” / comparing_options / 3; P05 “Corvane Fleet reviews” / specific_company / 3; P12 “How can I reduce fuel costs in my fleet?” / early_research / 1.
- **Relationships:** `prompt_id` joins responses. Actual response values include uppercase `P01` forms and lowercase `p01` forms; normalize IDs case-insensitively. Brief calls these question IDs, but the actual field and CSV column are `prompt_id`.
- **Processing notes:** validate unknown IDs and preserve prompt text and stage. Priority may inform a score only if clearly disclosed; no explicit score weighting is mandated.

## `responses.jsonl`

- **Format:** one JSON object per line. 518 records, 346,309 bytes. Each has `response_id`, `week`, `engine`, prompt identifier, run identifier, collection time, answer text, citation/source list, and in some records `error`.
- **Observed schema A (428 records):** `response_id`, `week`, `engine`, `prompt_id`, `run`, `collected_at`, `response_text`, `citations`, with `error` on one record. `week` is integer; typical engine values are lowercase `chatgpt`, `perplexity`, `google_ai_overview`; run is 1 or 2; timestamps usually ISO-8601 with `Z`.
- **Observed schema B (90 records):** `response_id`, `week`, `engine`, `prompt_id`, `run_number`, `collected`, `answer`, `sources`, with `error` on two records. These are primarily week 4 and part of week 5/6. Week 4 engine values are title case (`ChatGPT`, `Perplexity`, `AI Overview`); prompt IDs are lowercase; collection time uses `MM/DD/YYYY HH:mm` (observed sample `07/09/2026 21:26`, date interpretation ambiguous without locale metadata). Week is still numeric.
- **Normalization requirement:** response text comes from `response_text` or `answer`; timestamps from `collected_at` or `collected`; citations from `citations` or `sources`; run from `run` or `run_number`; prompt id from `prompt_id`. Normalize engine aliases while retaining the original source value. `google_ai_overview` and `AI Overview` appear to refer to the same listed engine; the implementation records `AI Overview` as an alias of `google_ai_overview`. Do not silently guess dates for ambiguous localized strings if date matters to grouping; `week` is the grouping field.
- **Engine counts:** chatgpt 188 records (including capitalization variants), Perplexity 150 (including case variants), Google AI Overview 180 (including `AI Overview`). Canonicalized coverage per week: W1 30 each; W2 ChatGPT 38, Perplexity 30, Google 30; W3 30 each; W4 30 each; W5 ChatGPT 30, Google 30, Perplexity 0; W6 30 each. Total by week: W1 90, W2 98, W3 90, W4 90, W5 60, W6 90.
- **Completeness:** expected balanced panel from the pack description is 6 × 15 × 3 × 2 = 540. Actual has 518. W5 entirely lacks Perplexity (30 absent slots). W2 has 8 additional ChatGPT rows versus the 30 expected. Composite-key inspection found eight duplicated slots: P03 run 2, P05 runs 1 and 2, P07 runs 1 and 2, P08 run 1, and P14 run 2 (all ChatGPT, week 2); each appears twice. W1/W3/W4/W6 have expected engine totals. The eight W2 duplicated slots reuse IDs and identical content, leaving 510 unique IDs among 518 source lines. Dataset README says “two runs”; it does not guarantee all slots or explain duplicates.
- **Identifiers:** actual field is `prompt_id`, not `question_id`. Run keys vary. Inspecting values revealed 1/2 run numbers; malformed/missing identifiers should be reported by validation.
- **Observed name forms in answer text:** case and formatting vary: `Corvane Fleet`, `Corvane`, `CorvaneFleet`, `corvanefleet.com`, and the corpus misspelling `Corvain`; `Trakvia`/`TrakVia`; `Routelyne`/`RouteLyne`/`Route Lyne`; `Gridwell`/`Gridwell Systems`; the other configured companies also occur. `Corvane Logistics` appears in 29 textual occurrences across answers and must remain excluded. Counts are raw substring occurrences, not unique answers or verified detections.
- **Answer/citations:** answers are plain text, often Markdown (lists, bold, tables). Observed maximum text length 731 characters; zero-length answer records exist. Citations/sources are arrays, sometimes empty or absent/null. Mentions must be parsed from answer text only; citation URLs are separately available for source views. Empty or failed response records have `error: "timeout"` (one in schema A, two in schema B) and should not count as observed non-mentions.
- **Errors/variations:** records include timeout errors; schema migration; engine capitalization/aliases; prompt case; timestamp formatting/timezone differences; empty/missing source collections. These affect ingestion, grouping, export completeness, and fair week comparisons.
- **Relationships:** `prompt_id` joins `prompts.csv`; engine/week/run delimit a panel slot; `response_id` is the export foreign key. Text is the mention, position, tone, and fact-check input. Citations relate to source reporting but never satisfy mention rules.
- **Duplicate-ID audit:** the pack has 518 JSONL records but only 510 unique `response_id` values. The eight duplicate week-2 slots each reuse the same ID and identical content. They are retained as source-line records and reported in quality output; scoring averages values within a run slot. `mentions.csv` follows source-line count (3,108 rows), so duplicated IDs have two six-brand row sets. `wrong_facts.csv` deduplicates identical claims by response ID/brand/fact key/claim text. The reason for duplicate lines is not stated.

