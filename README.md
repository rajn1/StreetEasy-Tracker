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

Edit `.env` and paste your key. Also set `APP_PASSWORD` so the deployed site requires a password. That file is ignored by Git, so it will not be committed to GitHub.

When deploying to Vercel, add these project environment variables:

- `GOOGLE_MAPS_API_KEY`
- `APP_PASSWORD`
- `APARTMENT_AUTH_SECRET`
- `EDGE_CONFIG`
- `EDGE_CONFIG_ID`
- `VERCEL_API_TOKEN`
- `VERCEL_TEAM_ID` if your project is owned by a team

The browser calls `/api/commutes`; the Google key stays on the serverless function. The password gate is enforced by Vercel Routing Middleware before the page or API routes load.

Destinations are stored universally in Vercel Edge Config through `/api/destinations`. Attach Edge Config to the project so Vercel injects `EDGE_CONFIG`. Saving from the app also needs a Vercel API token with access to update that Edge Config.
