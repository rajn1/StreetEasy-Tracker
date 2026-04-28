# StreetEasy Tracker

A small static web app for NYC apartment hunting tools.

## Current tools

- Commute-aware search with tabbed navigation
- Manual commute ranking without external services
- Optional Google Maps JavaScript API support for real commute times

## Run locally

Serve the folder and open the local URL:

```sh
python3 -m http.server 5173
```

Then visit `http://localhost:5173`.

For Google Maps ranking, create a browser-restricted API key with Maps JavaScript API and Distance Matrix API access enabled.

Then create a local config file:

```sh
cp config.local.example.js config.local.js
```

Edit `config.local.js` and paste your key. That file is ignored by Git, so it will not be committed to GitHub.

Important: this keeps the key out of the repository, but browser-side Maps keys are still visible to anyone who can load the webpage. Restrict the key in Google Cloud to your allowed HTTP referrers, such as `http://localhost:5173/*` while developing.
