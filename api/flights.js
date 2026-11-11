import { normalizeAdsbLolPointResponse } from '../src/data/adsbLolFallback.js';

const RADIUS_KM = 100;
const EARTH_RADIUS_KM = 6371.0088;

function withinRadius(latitude, longitude, centerLat, centerLon) {
  const radians = Math.PI / 180;
  const deltaLat = (latitude - centerLat) * radians;
  const deltaLon = (longitude - centerLon) * radians;
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latitude * radians) * Math.cos(centerLat * radians) *
    Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a))) <= RADIUS_KM;
}

// Free community ADS-B point feed. Regional coverage only, not a global
// aircraft inventory. The upstream may impose access/rate limits.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (!params.has('lat') || !params.has('lon') ||
      !Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: 'Valid lat and lon are required for regional aircraft tracking' }, { status: 400 });
  }
  // Radius deliberately fixed to limit upstream load and discourage bulk polling.
  const upstreamUrl = `https://api.adsb.lol/v2/point/${lat.toFixed(3)}/${lon.toFixed(3)}/100`;
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'BlueAtlasPersonalDashboard/1.0' },
      signal: AbortSignal.timeout(8500),
    });
    if (!upstream.ok) return Response.json({ error: 'Aircraft provider unavailable', upstreamStatus: upstream.status }, { status: 502 });
    const payload = await upstream.json();
    if (!Array.isArray(payload?.ac)) throw new Error('Invalid ADS-B payload');
    const snapshot = normalizeAdsbLolPointResponse(payload);
    // Independently enforce our advertised radius, even if the upstream
    // interprets its point radius differently or returns extra contacts.
    snapshot.states = snapshot.states.filter(
      (state) => withinRadius(state[6], state[5], lat, lon),
    );
    if (snapshot.emergencyByIcao) {
      const admitted = new Set(snapshot.states.map((state) => state[0]));
      snapshot.emergencyByIcao = Object.fromEntries(
        Object.entries(snapshot.emergencyByIcao).filter(([id]) => admitted.has(id)),
      );
    }
    return Response.json(snapshot, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'X-Flight-Source': 'adsb.lol',
        'X-Flight-Coverage': '100 km radius around requested point',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json({ error: 'Aircraft provider temporarily unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
