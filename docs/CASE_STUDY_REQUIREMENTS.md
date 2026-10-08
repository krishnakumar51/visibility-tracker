# Case-study requirements status

Statuses reflect the current repository and deployed application. Core requirements are checked
against the original brief in `extras/AI_Native_Developer_Case_Study_Corvane_Fleet.md`.

| Requirement | Status | Evidence / Location |
|---|---|---|
| Mention detection across six configured companies | PASS | `backend/src/corvane_pipeline/detection.py`; six company rows per response in `outputs/mentions.csv` |
| Distinguish Corvane Fleet from Corvane Logistics | PASS | Exclusion in `backend/config/aliases.json`; detection tests |
| First-mention position | PASS | Position assigned by answer-text order in `detection.py`; export and tests |
| Four tone categories | PASS | Rules in `detection.py`; canonical tone output; four-tone tests; manual tone accuracy is 33/37 |
| Wrong-fact alerts for supported Corvane claims | PASS | `backend/src/corvane_pipeline/facts.py`; `outputs/wrong_facts.csv` |
| Single visibility score for four tracked companies | PASS | `backend/src/corvane_pipeline/scoring.py`; settings in `backend/config/scoring.json`; `outputs/analytics.json` |
| Week-on-week comparison and observed run variation | PASS | `scoring.py` outputs score-point deltas, variation threshold, and drivers; `docs/SCORING_DESIGN.md` |
| Incomplete-week handling | PASS | 95% threshold and expected engines in scoring config; Week 5 partial handling and tests |
| Marcus Monday overview | PASS | `frontend/src/routes/index.tsx`; scores, coverage, movement, alerts, and evidence-linked actions |
| 15-answer human accuracy check | PASS | `outputs/manual_review.csv`, `outputs/manual_review_comparison.json`, and README results; 90 rows, 4 tone disagreements |
| One-command local use | PARTIAL | `python backend/scripts/run_pipeline.py` runs the pipeline; the complete web app requires separate FastAPI and Vite processes (no combined launcher) |
| Load a new week without changing analysis code | PASS | CLI `--responses` in `backend/scripts/run_pipeline.py`; upload page accepts one week per run |
| Tolerate observed schema variation | PASS | `backend/src/corvane_pipeline/loader.py`; aliases and upload validation tests |
| Required `mentions.csv` schema | PASS | Exact five columns and six rows per source response; export test |
| Required `wrong_facts.csv` schema | PASS | Exact four columns; export test; current rows are Corvane contradictions |
| Automated tests | PASS | `backend/tests/` and `frontend/src/test/`; commands in README |
| Priya detail view: question, engine, stage, company filters and highlighted answers | PARTIAL | `frontend/src/routes/answer-explorer.tsx` filters week/engine/question/company/tone, shows original answer, spans and citations; no buying-stage filter |
| Head-to-head winners, dropouts, and replacement company by question/engine | Not implemented | Not implemented — intentionally not prioritised. Score drivers show contributing prompt/engine strata but do not provide the full winner/replacement analysis. |
| Competitor fact checking | Not implemented | Not implemented — intentionally not prioritised. Fact alerts currently check Corvane only. |
| Source reporting: websites cited and competitor-only sources | PARTIAL | Citation URLs are available in answer detail; source-level aggregation and competitor-only source analysis are not implemented. |
| Configuration-only competitor addition and market-side switching | PARTIAL | Detection/scoring use configured brand data, but fact checking and several dashboard actions are Corvane-specific; switching the client perspective is not implemented. |
| Board report export | Not implemented | Not implemented — intentionally not prioritised. Available downloads are `mentions.csv`, `wrong_facts.csv`, and `dashboard_data.json`. |
| Deployed browser version | COMPLETE | [Vercel dashboard](https://visibility-tracker-beta.vercel.app/) with API at [Railway health endpoint](https://visibility-tracker-production-cd2c.up.railway.app/health); configuration in `DEPLOYMENT.md`. |
