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

## Phase 4: NASA FIRMS on Vercel

The existing FIRMS Active Fires globe layer requests `/api/firms`. A Vercel function now implements that endpoint for the contiguous United States using NOAA-20 VIIRS NRT detections from the trailing 24 hours. This is satellite heat detection, not verified wildfire perimeter or incident status. The function caches responses for 30 minutes and returns HTTP 503 `{ "error": "no_key" }` when `FIRMS_MAP_KEY` is not configured. Create a free NASA FIRMS MAP_KEY at https://firms.modaps.eosdis.nasa.gov/api/map_key/ and add it in Vercel project Settings → Environment Variables as `FIRMS_MAP_KEY` (server-only, never `VITE_`); redeploy the preview branch. Test `/api/firms` and enable **FIRMS Active Fires**. No live FIRMS test was possible without the key. This first endpoint is limited to the contiguous US and one VIIRS satellite, not the worldwide multi-sensor feed of the upstream development server.

The weather alerts endpoint is data-only: alert polygons are **not yet rendered** on the globe. Weather radar/satellite layers are separate products and must not be described as NWS warning polygons.

## Phase 5: Data health dashboard

Open `/status.html` on the Preview deployment for a read-only dashboard. `/api/source-health` performs on-demand checks using the actual source handlers for USGS earthquakes, Indianapolis-area ADS-B flights, contiguous-US NASA FIRMS, and Indiana NWS alerts. Results are cached for 120 seconds; provider checks are not continuous uptime monitoring. Counts are observations and may be zero legitimately. Observation timestamps can be upstream generation or retrieval timestamps, not newest record timestamps. The dashboard does not replace official warnings. `/api/source-status` remains a configuration inventory and does not imply upstream health.

## NASA EONET natural events

`/api/natural-events?days=14` retrieves open NASA EONET natural events for a bounded 1–30 day lookback, with optional allowlisted `category`. The globe layer `NASA Natural Events` shows reported Point coordinates only; polygon-only observations are omitted rather than assigning misleading centroids. The feed requires no key and is also included in `/api/source-health`. NASA event markers are not real-time emergency warnings.

## Launch Library, Radio Browser, and mapped installations

- Launch Library 2 shares a 15-minute request window and Vercel CDN cache across hosted requests. If the feed fails, the provider marks a retained snapshot stale. The optional `LL2_API_TOKEN` raises the upstream limit.
- Radio Browser's hosted route uses a fixed HTTPS mirror list. Test `/api/radio/stations` for a station count and the `degraded` field.
- For detailed OpenStreetMap geometry, set `OVERPASS_UPSTREAMS` on Vercel to the full interpreter URL of an instance you are allowed to use. For low-volume personal use, Private.coffee publishes `https://overpass.private.coffee/api/interpreter`. The map uses OpenStreetMap vector tiles when the detailed endpoint is absent, overloaded, or unreachable.

## Live vessels and traffic

Use one long-running Node process, with a durable state directory, for the AIS WebSocket and TomTom quota. The Vercel API proxies the existing same-origin layer URLs to that service.

On the feed host, install with `npm ci`, then add these values to an untracked `.env.local`:

```dotenv
BLUE_ATLAS_FEED_TOKEN=<random shared secret>
BLUE_ATLAS_FEED_STATE_DIR=./.gev-cache
AISSTREAM_API_KEY=<AISStream key>
TOMTOM_API_KEY=<TomTom key>
```

Start it with `node --env-file=.env.local server/standalone/live-feeds.js`. It listens on `127.0.0.1:8787` by default. Expose only this feed process through an HTTPS reverse proxy or authenticated tunnel to a stable hostname. For a container, set `BLUE_ATLAS_FEED_HOST=0.0.0.0` and mount a persistent state directory. Run one replica so it owns one AIS socket and one TomTom quota counter.

In Vercel Preview, set `BLUE_ATLAS_FEED_ORIGIN` to the bare HTTPS origin and set `BLUE_ATLAS_FEED_TOKEN` to the same secret. Keep the preview protected when using the quota-backed feed. Set `AISSTREAM_API_KEY` and `TOMTOM_API_KEY` only on the feed host. Use a provider key or account limit appropriate for your usage.

Verify `/api/vessels` reports `status: "live"` with recent positions in a covered region and `/api/tomtom/status` reports `hasKey: true`. Zoom into a road network and check that the flow tile response is a vector tile and the layer reports live speeds. Keep simulation enabled as the fallback. To use this same-origin setup, remove any old `VITE_AIS_LIVE_API_URL` override.
