import { GET as earthquakes } from './earthquakes.js';
import { GET as flights } from './flights.js';
import { GET as firms } from './firms.js';
import { GET as weatherAlerts } from './weather-alerts.js';
import { GET as naturalEvents } from './natural-events.js';

// On-demand operational checks, not a historical uptime monitor.
// Calling the same handlers as the globe avoids false green configuration-only checks.
const CHECKS = [
  { id: 'earthquakes', provider: 'USGS', call: () => earthquakes(new Request('https://blue-atlas.invalid/api/earthquakes?period=day')), freshnessMs: 5 * 60_000 },
  { id: 'flights', provider: 'adsb.lol / adsb.fi', call: () => flights(new Request('https://blue-atlas.invalid/api/flights?lat=39.7684&lon=-86.1581')), freshnessMs: 3 * 60_000 },
  { id: 'wildfires', provider: 'NASA FIRMS', call: () => firms(), freshnessMs: 60 * 60_000 },
  { id: 'weather-alerts', provider: 'NWS', call: () => weatherAlerts(new Request('https://blue-atlas.invalid/api/weather-alerts?area=IN')), freshnessMs: 5 * 60_000 },
  { id: 'natural-events', provider: 'NASA EONET', call: () => naturalEvents(new Request('https://blue-atlas.invalid/api/natural-events?days=14')), freshnessMs: 15 * 60_000 },
];

async function check(item) {
  const started = Date.now();
  try {
    const response = await item.call();
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      let error = 'Source returned HTTP ' + response.status;
      try {
        const body = await response.json();
        if (body?.error === 'no_key') error = 'NASA FIRMS key not configured';
        else if (item.id === 'flights' && body?.reason) {
          const reason = String(body.reason);
          error = reason === 'timeout' ? 'Both aircraft providers timed out' :
            reason === 'upstream_http' && body.upstreamStatus === 429 ? 'Aircraft provider rate-limited requests (HTTP 429)' :
            'Aircraft providers unavailable: ' + (Array.isArray(body.providers) ? body.providers.map(p => p.provider + ' (' + p.reason + ')').join(', ') : reason);
        }
      } catch {}
      return { id: item.id, provider: item.provider, status: response.status === 503 ? 'unconfigured' : 'unavailable', checkedAt: new Date().toISOString(), latencyMs, error };
    }
    const body = await response.json();
    let count = null;
    let observationTime = null;
    if (item.id === 'earthquakes') {
      count = body.features?.length ?? null;
      observationTime = body.metadata?.generated ?? null;
    } else if (item.id === 'flights') {
      count = body.states?.length ?? null;
      observationTime = Number.isFinite(body.time) ? body.time * 1000 : null;
    } else if (item.id === 'wildfires') {
      count = body.count ?? null;
      observationTime = body.fetchedAt ?? null;
    } else if (item.id === 'natural-events') {
      count = body.count ?? null;
      observationTime = Date.parse(body.retrievedAt);
    } else if (item.id === 'weather-alerts') {
      count = body.count ?? null;
      observationTime = Date.parse(body.retrievedAt);
    }
    const ageMs = Number.isFinite(observationTime) ? Math.max(0, Date.now() - observationTime) : null;
    return {
      id: item.id, provider: item.provider,
      status: ageMs !== null && ageMs > item.freshnessMs ? 'stale' : 'operational',
      checkedAt: new Date().toISOString(), latencyMs, count,
      observationTime: observationTime === null ? null : new Date(observationTime).toISOString(),
      ageSeconds: ageMs === null ? null : Math.round(ageMs / 1000),
      note: item.id === 'weather-alerts' && count === 0 ? 'No active alerts returned; this is not a feed failure' : item.id === 'flights' ? 'Indianapolis sample region only' : null,
    };
  } catch {
    return { id: item.id, provider: item.provider, status: 'unavailable', checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, error: 'Live check failed' };
  }
}

export async function GET() {
  const sources = await Promise.all(CHECKS.map(check));
  return Response.json({
    service: 'blue-atlas', checkedAt: new Date().toISOString(),
    note: 'Live on-demand provider checks. Counts are observations, not incidents; timestamps may represent provider generation or retrieval rather than newest individual observation.',
    sources,
  }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60', 'X-Content-Type-Options': 'nosniff' } });
}
