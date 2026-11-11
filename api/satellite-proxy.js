import {
  celestrakSatcatUrl,
  celestrakTleUrl,
} from '../src/data/spaceProviderRequests.js';

const GROUPS = new Set([
  'stations',
  'visual',
  'gps-ops',
  'glo-ops',
  'galileo',
  'geo',
  'starlink',
  'resource',
  'weather',
  'planet',
  'sar',
  'science',
  'active',
]);
const MAX_BYTES = 16 * 1024 * 1024;

function failure(code, status = 502, upstreamStatus = null) {
  return Response.json(
    { error: code, upstreamStatus },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function satelliteProxy(request, kind) {
  const group = new URL(request.url).pathname.split('/').pop()?.toLowerCase();
  if (!GROUPS.has(group)) return failure('unsupported_group', 400);
  const satcat = kind === 'satcat';
  const upstream = satcat ? celestrakSatcatUrl(group) : celestrakTleUrl(group);
  let response;
  try {
    response = await fetch(upstream, {
      headers: { Accept: satcat ? 'text/csv' : 'text/plain' },
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return failure('upstream_unreachable');
  }
  if (!response.ok) {
    await response.body?.cancel();
    return failure('upstream_http_error', 502, response.status);
  }
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_BYTES)
    return failure('response_too_large');
  let body;
  try {
    body = await response.text();
  } catch {
    return failure('upstream_body_error');
  }
  if (new TextEncoder().encode(body).byteLength > MAX_BYTES)
    return failure('response_too_large');
  // CelesTrak can prepend CSV metadata or change column order. Require a
  // recognizable catalog column rather than one exact first-column header.
  const valid = satcat
    ? /(?:^|,)\s*(?:OBJECT_NAME|NORAD_CAT_ID|OBJECT_ID)\s*(?:,|$)/im.test(
        body.split(/\r?\n/, 1)[0],
      )
    : /^1 [0-9]{5}/m.test(body) && /^2 [0-9]{5}/m.test(body);
  if (!valid) return failure('invalid_upstream_payload');
  return new Response(body, {
    headers: {
      'Content-Type': satcat
        ? 'text/csv; charset=utf-8'
        : 'text/plain; charset=utf-8',
      'Cache-Control': satcat
        ? 'public, s-maxage=86400, stale-while-revalidate=86400'
        : 'public, s-maxage=7200, stale-while-revalidate=7200',
      'X-Content-Type-Options': 'nosniff',
      'X-Satellite-Provider': 'celestrak',
    },
  });
}
