import { celestrakSatcatUrl, celestrakTleUrl } from '../src/data/spaceProviderRequests.js';

const GROUPS = new Set([
  'stations', 'visual', 'gps-ops', 'glo-ops', 'galileo', 'geo',
  'starlink', 'resource', 'weather', 'planet', 'sar', 'science', 'active',
]);
const SATCAT_GROUPS = new Set([...GROUPS].filter((group) => group !== 'starlink' && group !== 'active'));
const MAX_BYTES = 16 * 1024 * 1024;

export async function satelliteProxy(request, kind) {
  const group = new URL(request.url).pathname.split('/').pop()?.toLowerCase();
  const satcat = kind === 'satcat';
  if (!(satcat ? SATCAT_GROUPS : GROUPS).has(group)) {
    return Response.json({ error: 'Unsupported satellite group' }, { status: 400 });
  }
  const upstream = satcat ? celestrakSatcatUrl(group) : celestrakTleUrl(group);
  try {
    const response = await fetch(upstream, {
      headers: { Accept: satcat ? 'text/csv' : 'text/plain' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      return Response.json({ error: 'Satellite provider unavailable', upstreamStatus: response.status }, {
        status: 502, headers: { 'Cache-Control': 'no-store' },
      });
    }
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_BYTES) {
      return Response.json({ error: 'Satellite response exceeds size limit' }, { status: 502 });
    }
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BYTES ||
        !(satcat ? body.startsWith('OBJECT_NAME,') : /^1 /m.test(body))) {
      return Response.json({ error: 'Invalid satellite provider response' }, { status: 502 });
    }
    return new Response(body, {
      headers: {
        'Content-Type': satcat ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8',
        'Cache-Control': satcat
          ? 'public, s-maxage=86400, stale-while-revalidate=86400'
          : 'public, s-maxage=21600, stale-while-revalidate=21600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json({ error: 'Satellite provider timed out or unreachable' }, {
      status: 502, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
