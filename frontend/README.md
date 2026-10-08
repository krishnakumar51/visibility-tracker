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
