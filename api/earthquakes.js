// Free USGS GeoJSON feed via a fixed upstream. No arbitrary URL proxying.
const FEEDS = {
  hour: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
  day: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
};
export async function GET(request) {
  const period = new URL(request.url).searchParams.get('period') || 'day';
  if (!Object.hasOwn(FEEDS, period)) {
    return Response.json({ error: 'period must be hour or day' }, { status: 400 });
  }
  try {
    const response = await fetch(FEEDS[period], {
      headers: { Accept: 'application/geo+json, application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('USGS unavailable');
    const data = await response.json();
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('Invalid USGS payload');
    }
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Data-Source': 'USGS Earthquake Hazards Program',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json({ error: 'Earthquake feed temporarily unavailable' }, {
      status: 502, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
