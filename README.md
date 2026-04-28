# StreetEasy Tracker

A small Vercel web app for NYC apartment hunting tools.

## Current tools

- Commute-aware search with tabbed navigation
- Manual commute ranking without external services
- Server-side Google Routes API support for real commute times

## Run locally

Install the Vercel CLI if needed, then run the app:

```sh
npm run dev
```

Then visit the local URL printed by Vercel, usually `http://localhost:3000`.

For Google Maps ranking, create a server-side API key with Routes API access enabled.

Then create a local environment file:

```sh
cp .env.example .env
```

Edit `.env` and paste your key. That file is ignored by Git, so it will not be committed to GitHub.

When deploying to Vercel, add `GOOGLE_MAPS_API_KEY` as a project environment variable. The browser calls `/api/commutes`; the Google key stays on the serverless function.
