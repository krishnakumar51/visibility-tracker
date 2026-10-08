# Corvane Fleet AI Visibility Dashboard

A standalone React and TypeScript dashboard built with Vite.

## Development

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Generate the pipeline data from the repository root before starting the UI:

```sh
python backend/scripts/run_pipeline.py
```

Then, from `frontend/`, run `npm run dev`. The Vite adapter serves only the
root `outputs/dashboard_data.json` at `/dashboard_data.json`. The overview is
available at `/`, the answer explorer at `/answer-explorer`, upload at `/upload`,
and run history at `/runs`.

## Build

```sh
npm run build
npm run preview
```

`src/lib/dashboard-data.ts` validates and maps the active dashboard JSON from
FastAPI. Set `VITE_API_URL` to the backend origin for deployed builds. The Vite
adapter serves the root pipeline JSON during local development and copies only
that file into the static build; production fetches active data from FastAPI.

The deployed dashboard is <https://visibility-tracker-beta.vercel.app/>. Production API and
environment setup are documented in the repository-root [`DEPLOYMENT.md`](../DEPLOYMENT.md).

## Quick Demo Upload

Use the repository's [`demo-data/responses_week_7_demo.jsonl`](../demo-data/responses_week_7_demo.jsonl)
to try **Upload & Analyze** on the [live dashboard](https://visibility-tracker-beta.vercel.app/).
Select the file, run the analysis, and review Overview, Answer Explorer, and Upload History. You can
delete the run from active dashboard data; its record and files remain in Upload History. This is
demo/test data, not part of the original six-week source pack, which remains unchanged.
