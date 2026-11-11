import { normalizeAdsbLolPointResponse } from '../src/data/adsbLolFallback.js';

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
    return Response.json(normalizeAdsbLolPointResponse(payload), {
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
