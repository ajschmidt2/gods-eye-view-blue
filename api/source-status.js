// Describes configured source endpoints, not live uptime guarantees.
export function GET() {
  return Response.json({
    service: 'blue-atlas',
    checkedAt: new Date().toISOString(),
    note: 'configured does not mean upstream is healthy; test each endpoint separately',
    sources: [
      { id: 'earthquakes', provider: 'USGS', endpoint: '/api/earthquakes?period=day', configured: true, keyRequired: false, coverage: 'global' },
      { id: 'flights', provider: 'adsb.lol', endpoint: '/api/flights?lat=39.7684&lon=-86.1581', configured: true, keyRequired: false, coverage: '100 km around supplied coordinates; upstream limits apply' },
      { id: 'wildfires', provider: 'NASA FIRMS', endpoint: '/api/firms', configured: Boolean(process.env.FIRMS_MAP_KEY), keyRequired: true, coverage: 'contiguous United States; VIIRS NOAA-20 NRT; trailing 24 hours' },
      { id: 'weather-alerts', provider: 'US National Weather Service', endpoint: '/api/weather-alerts?area=IN', configured: true, keyRequired: false, coverage: 'US only' },
    ],
  }, { headers: { 'Cache-Control': 'no-store' } });
}
