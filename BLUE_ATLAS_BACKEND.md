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

## Phase 2: US weather alerts and source inventory

- `/api/weather-alerts?area=IN` — active NWS alerts for Indiana; change `IN` to any valid two-letter US state code. No API key. Response is GeoJSON FeatureCollection with metadata and a `count`.
- `/api/source-status` — machine-readable inventory of configured sources. This is **not** an uptime monitor.
- The weather endpoint is **not yet rendered as a globe layer**. NWS alerts are US-only, and some alerts lack point or polygon geometry.
- Validate both endpoints on the latest preview URL before merging. A 502 indicates the upstream request failed or timed out.
- Aircraft and wildfire integrations are not yet deployed; validate provider terms, rate limits, and response formats before adding them.

## Phase 3: Globe earthquakes and regional aircraft

- The existing Earthquakes (24h) layer now tries `/api/earthquakes?period=day` first and falls back to USGS directly when the proxy is unavailable.
- `/api/flights?lat=39.7684&lon=-86.1581` queries a bounded 100 km radius around the supplied location using the community adsb.lol v2 point API. This is **not global coverage**. The existing Flights layer already requests `/api/flights` with `lat` and `lon` for regional views; confirm those query parameters are present in browser Network requests. Without coordinates, the endpoint intentionally returns HTTP 400 rather than falsely claiming worldwide data.
- The endpoint returns an OpenSky-compatible `{time,states}` payload using the project's existing ADS-B normalizer. Verify live upstream availability and the provider's usage policy before relying on it.
- FIRMS active fires currently require `FIRMS_MAP_KEY` from NASA's free registration; the original local Vite proxy is not a Vercel production function. No FIRMS production route has been added yet. Do not interpret missing fire markers as no fires.
- The CI unit-test failures must be investigated before merging.
