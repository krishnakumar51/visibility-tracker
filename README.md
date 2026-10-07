# Corvane Fleet visibility pipeline

Local, standard-library Python pipeline for normalizing the supplied AI answer pack, detecting company mentions and tone, checking explicit Corvane fact contradictions, calculating weekly visibility scores, and exporting CSV/JSON results. It does not call external services or modify the source pack.

## Run locally

From the repository root (Python 3.11 or newer):

```powershell
python -m venv .venv
.venv\\Scripts\\Activate.ps1
python -m pip install -r requirements.txt
python scripts/run_pipeline.py
```

To process a new response file while reusing the prompt, brand, and fact configuration:

```powershell
python scripts/run_pipeline.py --input extras/corvane_data_pack --responses path\\to\\new_responses.jsonl --output outputs
```

The input directory must contain `prompts.csv`, `brands.json`, and `facts.json`. `--seed` controls the reproducible 15-answer review sample. Run automated tests with `python -m unittest discover -s tests -v`.

## Outputs

- `outputs/mentions.csv`: six company rows for every source-line response, including failed responses.
- `outputs/wrong_facts.csv`: supported Corvane contradictions with response IDs and claim excerpts.
- `outputs/quality_report.json`: status, coverage, schema, duplicate-slot, and reproducible review sample details.
- `outputs/evaluation.json`: normalized response details, mention evidence, status, and fact alerts.
- `outputs/analytics.json`: scores, completeness, run variation, week comparisons, and score drivers.
- `outputs/dashboard_data.json`: combined machine-readable data for a future frontend.
- `outputs/manual_review.csv`: the 15 selected answers expanded into one row per brand, with original answer text, separate tool predictions, and human annotation columns. Existing human annotations are preserved by subsequent pipeline runs.
- `outputs/manual_review_comparison.json`: comparison counts, accuracies, denominators, and full disagreement details.

## Human accuracy review

Open `outputs/manual_review.csv` in a spreadsheet. For each answer and each brand, independently read the original `answer_text`, then fill `human_mentioned` with `true` or `false`. For mentioned brands, record `human_position` as the order of first appearance and `human_tone` as `recommended`, `neutral`, `negative`, or `not_recommended`. Leave position and tone blank when the brand is absent. Add disagreement context in `review_notes` if useful. The `tool_*` fields are the pipeline's predictions; do not edit them. The pipeline preserves the worksheet whenever any human annotations or notes are present.

After saving the annotations, run this from the repository root:

```powershell
python scripts/compare_manual_review.py
```

The comparison reports mention and tone accuracy using their human-labeled denominators, plus disagreement details. Position accuracy is included as a diagnostic only. Blank or unreviewed fields are excluded. With no human labels, the command reports an incomplete review and no accuracy percentages.

### Completed 15-answer review

The completed sample contains 15 unique answers and 90 answer-brand rows. Human labels mark 37 brand mentions and 53 non-mentions. Tool mention detection agrees on **90/90 rows (100%)**. For the 37 human-mentioned brands, tool position agrees on **37/37 (100%, diagnostic)**. Tool tone agrees on **33/37 (89.19%)**. These are sample results, not population-wide guarantees. Automated test results are separate and do not contribute to these denominators.

The four tone disagreements (tool -> human) are:

- `r_0b1a37fccc56` / Fleetora: recommended -> neutral.
- `r_653a60305014` / Gridwell Systems: neutral -> negative.
- `r_99758b95d5ba` / Gridwell Systems: recommended -> neutral.
- `r_af07f3755749` / Corvane Fleet: neutral -> negative.

## Current pack and interpretation

The supplied file contains 518 records, 510 unique response IDs, 515 successful responses, and 3 timeouts. Eight week-2 ChatGPT run slots occur twice with identical IDs and content. They remain visible as source-line records; duplicate slots do not add score weight. Consequently, the mentions export has 3,108 rows, while `wrong_facts.csv` deduplicates identical claims by response ID, brand, fact key, and claim text.

Week 5 is partial: all 30 Perplexity slots are absent. Week 6 is complete. Its headline week-over-week change is suppressed because the immediately preceding week is incomplete; a separate gap comparison against week 4 is labeled as such. Timeout rows are excluded from scoring and fact checks. The mandated mentions CSV has no unavailable value, so these rows use false with blank position and tone; check response status in JSON before interpreting them as observed non-mentions.

The current corpus run emits 47 distinct Corvane contradiction rows. The rules cover supported fields and explicit language, not every possible paraphrase; unsupported claims are unverified rather than wrong. Tone and fact extraction are rule-based. The score is a configurable index of this finite prompt and engine sample, not market share.

## Audit and AI-assisted development

The pipeline has been audited against the supplied corpus, automated fixtures, and the completed 15-answer human review. Corpus audit fixes included the `Corvain` spelling, indirect recommendation and negative-tone phrasing, price/HQ/integration contradiction patterns, and a fact-attribution false positive involving Corvane Logistics. The human review found no mention or position disagreements and four tone disagreements; those results are listed above. See `docs/` for input details, scoring choices, and limitations.
