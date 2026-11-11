// Free National Weather Service active alerts. US-only; no API key.
const STATE = /^[A-Z]{2}$/;
export async function GET(request) {
  const area = (new URL(request.url).searchParams.get('area') || 'IN').toUpperCase();
  if (!STATE.test(area)) return Response.json({ error: 'area must be a two-letter US state code' }, { status: 400 });
  try {
    const upstream = await fetch('https://api.weather.gov/alerts/active?area=' + area, {
      headers: { Accept: 'application/geo+json', 'User-Agent': 'BlueAtlasPersonalDashboard/1.0 (personal weather awareness)' },
      signal: AbortSignal.timeout(9000),
    });
    if (!upstream.ok) throw new Error('NWS returned ' + upstream.status);
    const payload = await upstream.json();
    if (!Array.isArray(payload.features)) throw new Error('Invalid NWS response');
    return Response.json({
      source: 'National Weather Service',
      area,
      retrievedAt: new Date().toISOString(),
      count: payload.features.length,
      type: 'FeatureCollection',
      features: payload.features,
    }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return Response.json({ error: 'NWS alerts temporarily unavailable', area }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
