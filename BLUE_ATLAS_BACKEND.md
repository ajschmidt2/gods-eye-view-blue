# Blue Atlas — free-first production backend

This is a **personal dashboard**, not a public intelligence service. The original Vite middleware in `server/providers/local.js` does not run automatically in Vercel production. The following standalone serverless routes are the first incremental step, **not** a replacement for that middleware.

## Available preview endpoints

- `/api/health` — returns application backend health; no secrets required
- `/api/earthquakes?period=day` — USGS past-day GeoJSON feed
- `/api/earthquakes?period=hour` — USGS past-hour GeoJSON feed

The earthquake endpoint is **not yet wired into the existing globe UI**, which currently has its own earthquake source. The endpoint is a testable backend foundation.

## Required variables

**None** for the two routes above. Do not buy API access or enter credentials just to test these endpoints.

## Optional later variables

- `GOOGLE_MAPS_API_KEY` — metered 3D Maps, subject to Google billing and terms; the existing build embeds this key into browser code, so restrict it by HTTP referrer and API
- `CESIUM_ION_TOKEN` — optional Cesium assets/terrain, may be exposed in the browser
- `MAPILLARY_CLIENT_TOKEN` — optional street imagery client token
- `OPENAI_API_KEY` or `GEMINI_API_KEY` — optional AI, server-only; do not configure until an appropriate production proxy exists
- `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` — optional authenticated aircraft source, server-only

Do **not** set a `VITE_` prefix on secret keys. Never commit an `.env` file. Adding a key does not magically deploy a missing provider route.

## Test procedure

1. Wait for the GitHub PR preview deployment to be READY.
2. Open `https://<preview-host>/api/health` and confirm `status: ok`.
3. Open `https://<preview-host>/api/earthquakes?period=day` and confirm GeoJSON `FeatureCollection`.
4. Inspect the browser Network tab while enabling globe layers. Note any 404 or 500 responses on `/api/*`.
5. Keep the PR in draft until CI and icon regeneration are verified.

## Architecture direction

For a single-user setup, use Vercel Functions for short-lived stateless API requests and public upstreams. Avoid a separate paid server until a required feed genuinely needs long-running processes or persistent storage. Keep future alert history optional and use Neon only when persistent state is needed.

## Security

The preview endpoints expose only public data. Personal dashboards should be protected before adding saved locations, private notes, or provider secrets. Use Vercel Deployment Protection or equivalent access controls. Respect USGS feed policies and avoid polling more frequently than necessary.
