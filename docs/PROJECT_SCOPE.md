# Project scope

## Assignment

Build a working AI visibility tracker for the fictional client Corvane Fleet from the supplied six-week answer pack. The product is intended to run locally or be deployed, and the analysis must run on an ordinary laptop without paid APIs or API keys. The stack is open.

The brief describes Corvane Fleet as GPS tracking and compliance software for trucking and field-service companies with 20–500 vehicles; founded in 2014, based in Columbus, Ohio, with around 4,000 customers. Those client facts are brief context, not additional scoring requirements. All entities and pack data are fictional.

## Users and business problem

- **Marcus Hale, CEO:** wants a Monday view readable in two minutes: whether Corvane is winning or losing in AI, who it is gaining or losing against, what changed and why, one trackable number, wrong claims about Corvane, and suggested action. He also wants the same picture for Trakvia, Routelyne, and Gridwell, including who takes ground when Corvane loses it and wrong competitor facts for sales.
- **Priya Nair, Head of Marketing:** wants question-level visibility and absence, original AI answers, and numbers she can use in monthly board reporting.

The business problem is that Corvane does not know whether answer engines recommend, omit, or misdescribe it when buyers ask about fleet software.

## CORE REQUIREMENTS

1. Detect each of the six configured companies in answer text by name, name variation (including obvious misspelling), or website. Citation-only appearances do not count. Corvane Logistics is unrelated and must never count as Corvane.
2. For every company mention, record position by order of first naming in answer text (only the six configured companies count) and one defined tone: `recommended`, `neutral`, `negative`, or `not_recommended`. For mixed tone, use the final verdict about that company.
3. Detect claims contradicting `facts.json` for Corvane, link each incorrect claim to its answer, and do not label claims outside the facts file as wrong.
4. Produce one explainable visibility score for Corvane, Trakvia, Routelyne, and Gridwell. Week-on-week comparison must distinguish movement from normal run variation and avoid presenting incomplete weeks as false drops.
5. Provide a Monday view with scores, changes and reasons, relative gains/losses, wrong-fact alerts, and suggested actions.
6. Manually review 15 randomly selected answers and report mention accuracy, tone accuracy, and observed failure cases in README.
7. Provide a one-command local run, allow a new week's file without code changes, tolerate slight format changes, implement the scoring export, and include automated detection tests.
8. Produce `mentions.csv` with exactly one row per response and each of six companies (including absent companies), columns in this order: `response_id,brand,mentioned,position,tone`; values and blanks as specified in the brief.
9. Produce `wrong_facts.csv` with one row per incorrect Corvane claim (and competitor claims only if competitor fact checking is implemented), columns: `response_id,brand,fact_key,claim_text`.

## STRETCH REQUIREMENTS

Optional feature choices from the brief:

- Priya detail view: filter by question, engine, buying stage, company; show original answer with every mention highlighted.
- Head-to-head: identify per-question/per-engine winner, dropouts, and replacement company.
- Fact-check Trakvia, Routelyne, and Gridwell against `facts.json`.
- Configuration-based addition of tracked companies and market-side switching.
- Board report export.
- Deployed browser version.

## Submission requirements

- GitHub repository with full commit history (repository submission process is later; Git operations are explicitly out of scope for this planning stage).
- README covering run instructions, assumptions, priorities and rationale, 15-answer manual accuracy check, actual AI tool use and mistakes, and a half-page description of daily operation for 20 clients covering cost, storage, and AI-engine format changes.
- A half-page plain-English note to Marcus explaining what the tool shows, how the score works, and why it was chosen.
- Email repository link and note to `careers@joinindexed.com` with subject `Case Study: AI-Native Developer, [Your Name]` (external submission is not part of this planning work).

## Evaluation criteria

- Accuracy: exports compared with assessor answer key and reported accuracy.
- Judgement: handling messy data, uncertainty, and what Marcus wants versus what can be measured.
- Usability: whether Marcus and Priya can use it unaided.
- Engineering: code quality, tests, commit history, handoff.
- Clarity: explanations for non-developers.

## Constraints

No paid APIs or API keys; ordinary-laptop execution; unseen future inputs must be analyzed by the tool rather than pre-labelled by a paid service. A rules-based approach and open-source libraries are acceptable. The current analysis uses deterministic rules and local files; the upload registry uses SQLite. The source pack under `extras/corvane_data_pack/` is the immutable base and must not be changed by the upload workflow.

## Explicit non-requirements / limits

The brief does not require a specific framework, language, database, cloud platform, or AI model. It does not require all stretch items. SEO/WordPress knowledge is not required. The score is not an externally established market share or sales outcome; it is a measure of observed answers in this pack. No claim outside `facts.json` should be treated as a proven falsehood. Do not infer that citations validate an answer or constitute company mentions.

## Decisions and remaining scope

- The implemented score weights and movement threshold are documented in `SCORING_DESIGN.md` and `backend/config/scoring.json`; they are product choices, not statistically established values.
- Known source format variations are normalized and tested. Future engine formats still require a parser update/test when they exceed known aliases.
- Optional work not delivered includes complete head-to-head replacement analysis, competitor fact alerts, aggregate source reporting, a board report, and multi-client support. The browser app is deployed on Vercel with its API on Railway; see `CASE_STUDY_REQUIREMENTS.md` and `DEPLOYMENT.md`.

## Implementation decision: failed-row CSV representation

The required `mentions.csv` schema has only `true`/`false` and requires six rows for every parsed response, so it cannot encode “unavailable.” The pipeline therefore writes `false` with blank position/tone as a schema-only placeholder for failed/unusable answers, preserves the actual status in `evaluation.json` and `dashboard_data.json`, and explicitly warns about this in `quality_report.json`. Failed answers are excluded from scoring and fact checks. Consumers must consult status before interpreting a placeholder as an observed non-mention.
