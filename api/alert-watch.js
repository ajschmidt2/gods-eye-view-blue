// Blue Atlas: multi-state NWS alert watch, for user-selected US states.
// No personal locations or API keys are transmitted; state codes only.
const VALID_STATES = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '));
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const codes = (params.get('states') || 'IN').toUpperCase().split(',').map(s => s.trim());
  if (!codes.length || codes.length > 5 || new Set(codes).size !== codes.length || codes.some(s => !VALID_STATES.has(s))) {
    return Response.json({ error: 'Provide 1 to 5 distinct US state codes, comma-separated' }, { status: 400 });
  }
  const results = await Promise.all(codes.map(async state => {
    try {
      const response = await fetch('https://api.weather.gov/alerts/active?area=' + state, {
        headers: { Accept: 'application/geo+json', 'User-Agent': 'BlueAtlasPersonalDashboard/1.0 (personal weather awareness)' },
        signal: AbortSignal.timeout(9000),
      });
      if (!response.ok) throw Error('NWS HTTP ' + response.status);
      const body = await response.json();
      if (!Array.isArray(body.features)) throw Error('Unexpected NWS response');
      const alerts = body.features.slice(0, 250).map(feature => {
        const p = feature?.properties || {};
        return {
          id: String(feature.id || p.id || '').slice(0, 300),
          event: String(p.event || 'Weather alert').slice(0, 150),
          severity: ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'].includes(p.severity) ? p.severity : 'Unknown',
          urgency: String(p.urgency || 'Unknown').slice(0, 40),
          headline: String(p.headline || '').slice(0, 350),
          areaDesc: String(p.areaDesc || '').slice(0, 400),
          effective: p.effective || null,
          expires: p.expires || null,
          instruction: String(p.instruction || '').slice(0, 1600),
          url: typeof p['@id'] === 'string' && p['@id'].startsWith('https://api.weather.gov/') ? p['@id'] : null,
        };
      });
      return { state, status: 'ok', count: body.features.length, alerts, truncated: body.features.length > 250 };
    } catch {
      return { state, status: 'unavailable', count: null, alerts: [], error: 'NWS request failed; do not interpret this as zero alerts' };
    }
  }));
  return Response.json({
    source: 'National Weather Service', checkedAt: new Date().toISOString(),
    states: codes, results,
    note: 'Informational only. Not a substitute for official emergency notifications; alerts may change between checks.',
  }, { headers: { 'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=60', 'X-Content-Type-Options': 'nosniff' } });
}
