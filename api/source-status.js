// Describes configured source endpoints, not live uptime guarantees.
export function GET() {
  return Response.json({
    service: 'blue-atlas',
    checkedAt: new Date().toISOString(),
    note: 'configured does not mean upstream is healthy; test each endpoint separately',
    sources: [
      { id: 'earthquakes', provider: 'USGS', endpoint: '/api/earthquakes?period=day', configured: true, keyRequired: false, coverage: 'global' },
      { id: 'weather-alerts', provider: 'US National Weather Service', endpoint: '/api/weather-alerts?area=IN', configured: true, keyRequired: false, coverage: 'US only' },
    ],
  }, { headers: { 'Cache-Control': 'no-store' } });
}
