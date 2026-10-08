# Corvane Fleet AI Visibility Tracker

This project analyzes AI answers to buyer questions about fleet software. It helps Corvane Fleet
see how often it appears, how it is described, which supported facts are contradicted, and how its
observed visibility compares with three tracked competitors. The product is built around two
workflows: Marcus's concise Monday overview and Priya's answer-level investigation in Answer
Explorer.

## Key workflows

- **Overview:** current weekly score, coverage, comparable movement, evidence-linked drivers,
  wrong-fact alerts, and deterministic suggested actions.
- **Answer Explorer:** filter by week, engine, question, company, and tone; search original answers;
  inspect failed records, all six company evaluations, mention spans, and citations.
- **Upload & Analyze:** submit one new week's JSONL through the app. The API validates it and runs
  the existing Python CLI.
- **Upload History:** review each run and logically delete it from the active dataset. The backend
  recomputes all dashboard calculations from the original base plus active uploads; deleted-run
  files remain available on disk for audit.

The live application is available at [visibility-tracker-beta.vercel.app](https://visibility-tracker-beta.vercel.app/).
Its API health endpoint is [visibility-tracker-production-cd2c.up.railway.app/health](https://visibility-tracker-production-cd2c.up.railway.app/health).

The original `extras/corvane_data_pack/responses.jsonl` contains 518 records (515 successful and
three failed) and is not overwritten by the upload workflow. Each upload is additive and receives
a unique run folder. The uploaded
responses and generated snapshots remain stored even after a run is deactivated.

## Architecture

```text
JSONL + prompts.csv + brands.json + facts.json
  -> normalization and validation
  -> mention detection and Corvane Logistics exclusion
  -> first-mention position and tone
  -> supported Corvane fact checks
  -> coverage-aware weekly scores and comparisons
  -> CSV/JSON exports
  -> FastAPI upload/history layer
  -> React dashboard and Answer Explorer
```

The Python pipeline is the source of truth. `backend/scripts/run_pipeline.py` remains the CLI
entry point. FastAPI invokes that CLI for uploads rather than duplicating analysis logic. A SQLite
registry under the configured output directory records run metadata and active/deleted state. The
active dataset is always the 518-record base plus active uploads; deleting an upload is a logical
deactivation, not file removal.

## Quick start

Use three terminals from the repository root. These PowerShell commands also work on the current
Windows setup.

**Terminal 1 — install dependencies and generate baseline outputs:**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python backend/scripts/run_pipeline.py
```

**Terminal 1, after processing — start FastAPI:**

```powershell
python -m uvicorn app:app --app-dir backend --host 127.0.0.1 --port 8000
```

**Terminal 2 — start the frontend:**

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open <http://localhost:5173>. Vite proxies API requests to FastAPI at port 8000. Local pipeline
processing itself is one command (`python backend/scripts/run_pipeline.py`); launching the complete
web app currently requires separate backend and frontend processes. There is no one-command web
launcher.

To load a future week's file through the CLI without changing Python code, place it beside the
shared data pack and run, for example:

```powershell
python backend/scripts/run_pipeline.py --responses extras/corvane_data_pack/responses_week_7.jsonl
```

The CLI combines that file with the base responses for that run. Alternatively, submit one week's
JSONL from **Upload & Analyze**; uploaded files are additive runs and do not modify the base file.

## Quick Demo Upload

The repository includes [`demo-data/responses_week_7_demo.jsonl`](demo-data/responses_week_7_demo.jsonl),
a small Week 7 demo/test file for trying the upload workflow. It is separate from the original
six-week source pack; the original source pack remains unchanged.

1. Open the [live dashboard](https://visibility-tracker-beta.vercel.app/).
2. Open **Upload & Analyze**.
3. Select `demo-data/responses_week_7_demo.jsonl` from the repository.
4. Click **Run Analysis**.
5. Review the dashboard, Answer Explorer, and Upload History.
6. Delete the run to remove it from active dashboard data. Its record and files remain in Upload
   History for review.

## Data and ingestion

The base pack describes six weeks, 15 prompts, three engines, and two runs per prompt/engine/week:
540 nominal slots. It contains 518 source records, 510 unique response IDs, 515 successful
responses, and three timeouts. Week 5 has 60/90 valid slots because all 30 Perplexity slots are
missing. Week 2 contains 98 rows: eight duplicate ChatGPT response IDs/slots, each with identical
content. Those source lines remain represented in evaluation and exports; expected coverage slots
are counted once and repeated records within a run are averaged for scoring.

Failed or unusable responses remain visible with their status in JSON, but are not scored or
fact-checked. They are not treated as zero visibility. The required `mentions.csv` format has no
unavailable value, so its failed/unusable rows use `false` with blank position and tone as a schema
placeholder; check JSON response status before interpreting those rows.

The loader canonicalizes known input variations, including `response_text`/`answer`,
`citations`/`sources`, `run`/`run_number`, `collected_at`/`collected`,
`prompt_id`/`question_id`, prompt-ID case, and engine labels such as `ChatGPT` and `AI Overview`.
The explicit `week` field controls grouping; ambiguous localized timestamps are preserved rather
than guessed. Blank JSONL lines are skipped. The upload
endpoint rejects malformed JSON, unknown prompts, invalid required fields, and files containing
more than one week with a useful validation error. New observed formats should get a normalization
change and parser test; a major schema change is not solved by the score layer.

Incomplete weeks still have a partial score from observed valid slots, but are visibly marked
partial. A week needs at least 95% coverage and at least one valid slot from every expected engine
to be complete. Failed slots reduce coverage, not score. The dashboard suppresses a headline
week-over-week change after an incomplete prior week and labels a comparison to the last complete
week separately.

## Scoring

The 0–100 visibility index rewards a company for appearing, appearing earlier, and receiving a
positive recommendation. A non-mention earns zero. Mention tone values are `recommended` 1.00,
`neutral` 0.65, `negative` 0.40, and `not_recommended` 0.25. Position multipliers are 1.00 for
first, 0.80 for second, 0.60 for third, and 0.40 for fourth or later. Each prompt's configured
priority (1–3) weights its prompt/engine stratum. Valid values are averaged within a run, available
runs are averaged equally, and the priority-weighted mean across prompt/engine strata is scaled to
100. Engines receive equal treatment; competitors use the same score method.

Movement is shown in score points. The comparison threshold is the larger of a configurable
2-point floor and the mean observed run variation across up to four prior complete weeks. This is a
practical signal for this panel, not a statistical significance test. An incomplete week cannot
create a false headline drop. See [`docs/SCORING_DESIGN.md`](docs/SCORING_DESIGN.md) and
[`backend/config/scoring.json`](backend/config/scoring.json) for details. This is a product metric
for the selected questions and engines, not market share, total buyer exposure, or a guarantee of
business outcomes.

## Accuracy check

The manual review covers 15 randomly selected unique successful answers (seed 42), expanded into
90 response-by-brand evaluations. Human annotations are compared with tool predictions; tool
values are not substituted for human labels.

- **Mentions:** 90/90 correct (100%); no disagreements.
- **Position:** 37/37 correct among human-reviewed mentions (100%, diagnostic); no disagreements.
- **Tone:** 33/37 correct (89.19%). The four disagreements are:
  - `r_0b1a37fccc56` / Fleetora: tool recommended, human neutral.
  - `r_653a60305014` / Gridwell: tool neutral, human negative.
  - `r_99758b95d5ba` / Gridwell: tool recommended, human neutral.
  - `r_af07f3755749` / Corvane Fleet: tool neutral, human negative.

The deterministic tone rules can misread context: nearby generic recommendations can be attributed
to a named company, or a limiting/critical clause can be missed when deciding the answer's final
verdict. In the four observed cases, two neutral descriptions were labeled recommended; two
human-negative cases (one mentioning slow customer support, one describing limited reporting and
complaints) were labeled neutral. This small sample is a validation check, not proof of perfect
accuracy or performance on future data. The machine-readable results and answer evidence are in
[`outputs/manual_review_comparison.json`](outputs/manual_review_comparison.json) and
[`outputs/manual_review.csv`](outputs/manual_review.csv).

## Priorities and trade-offs

**Priority 1** was reliable mention detection; distinguishing Corvane Fleet from Corvane Logistics;
position, tone, and supported fact alerts; an explainable score; incomplete-week handling; Marcus's
overview; Priya's answer explorer; the required exports; automated tests; and future-week ingestion.
These make the underlying evidence and its limits reviewable before adding broader automation.

**Priority 2** was the upload workflow, persistent upload history, active/deleted run management,
and deployment configuration. The scoring approach is deterministic and rules-based: it needs no
paid inference API, runs on an ordinary laptop, is reproducible, and can be inspected and tested.
The review's four tone disagreements are disclosed rather than hidden behind unnecessary model
complexity.

The current one-client app is specifically configured for Corvane Fleet. Full per-question
head-to-head replacement analysis, competitor fact alerts, source-level citation analysis, board
report export, multi-client operations, and a single-command web launcher are not delivered. The
browser app and API are deployed; see [`docs/CASE_STUDY_REQUIREMENTS.md`](docs/CASE_STUDY_REQUIREMENTS.md)
for the requirement-by-requirement status.

## AI-assisted development

Codex and AI-assisted development were used for implementation, debugging, test generation,
frontend iteration, API integration, and documentation review. Generated suggestions were checked
against the source pack, code, tests, and human-review results rather than accepted as ground truth.
The manual comparison exposed four tone mismatches, and the corpus contains both `response_text`
and `answer` schemas plus timeout/duplicate cases. Those are retained as known limitations and
explicit parser/test cases; no AI tool independently produced or verified a perfect result.

## Daily operations for 20 clients

A practical daily cycle would collect the latest responses for each client's agreed question,
engine, and run panel; load that week's JSONL; validate schema, prompt IDs, failures, and coverage;
then review score movement and its evidence before opening wrong-fact alerts and important changed
answers. The operator would confirm claims against each client's approved facts, document unresolved
items, and export the CSV/JSON results for reporting. Collection and review need an owner and a
repeatable schedule; no scheduled collector is included here.

The tool itself has no paid AI inference dependency. Its operating costs are ordinary compute,
persistent storage, and hosting if deployed; scheduled collection added later may have separate
provider or operator costs. No vendor bill is estimated here. The current app is a single Corvane
workspace, not a 20-client service. A real 20-client rollout would need isolated base/config/run
storage per client and operational access controls; those multi-client features are not
implemented.

Keep each client's original source pack immutable, store each uploaded JSONL as a separate run,
retain that run's generated CSV/JSON snapshot, and keep its active/deleted state in the SQLite
registry on persistent storage. This provides an audit trail while allowing active results to be
recomputed. For an engine format change, normalize known aliases into the canonical record,
preserve raw fields and schema/validation issues, and reject malformed uploads rather than silently
scoring them. Add a fixture and parser test for every newly observed format. A major schema change
belongs in normalization, not in scoring.

## Exports

- **`mentions.csv`** — `response_id,brand,mentioned,position,tone`; one row for each response and
  each of the six configured companies. Useful for assessment and spreadsheet-level mention,
  position, and tone review.
- **`wrong_facts.csv`** — `response_id,brand,fact_key,claim_text`; each supported contradiction
  currently detected for Corvane, linked to its response. Uncovered claims are unverified, not
  wrong.
- **`dashboard_data.json`** — scores, coverage/comparisons, drivers, alerts, and normalized answer
  records used by the frontend and available for downstream analysis.

The upload page downloads these three outputs. Other pipeline artifacts include `analytics.json`,
`evaluation.json`, `quality_report.json`, and the human-review files.

## Upload history and deployment

Every successful upload gets a unique ID and a folder containing its input plus dashboard and CSV
snapshots. Deleting a run changes its registry state and recomputes the active dataset; it does not
remove the run folder. Locally the registry and latest outputs are under project-root `outputs/`.
The deployed Railway service is configured with
`CORVANE_OUTPUT_DIR=/var/data/outputs`; the registry and run folders use that configured directory.
The repository documentation does not establish whether Railway has a persistent volume mounted
there, so persistence across redeploys should not be assumed. Configure `VITE_API_URL` at frontend
build time. The Vercel and Railway settings are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md).
There is no automatic artifact expiration: define an operational retention policy separately if
storage needs to be reclaimed, because the application's Delete action intentionally preserves
run files.

## Testing

Run from the repository root for the backend, and from `frontend/` for frontend commands:

```powershell
python -m unittest discover -s backend/tests -v
cd frontend
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build
```

The backend tests cover normalization, mention/position/tone rules, supported fact checks, scoring,
coverage, exports, future-week loading, upload validation, active-run recomputation, soft deletion,
and restoration of the base dataset.

## Project structure

```text
backend/       Python pipeline, CLI, FastAPI layer, config, and tests
docs/          scoring, data, assumptions, Marcus note, and case-study status
extras/        original brief and immutable Corvane data pack
frontend/      React/Vite dashboard, Answer Explorer, upload, and run history
outputs/       local generated exchange files, upload snapshots, and SQLite registry
Dockerfile     backend container image
DEPLOYMENT.md  local, Vercel, and Railway setup
```
