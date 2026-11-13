import { readResponseBytesCapped } from '../providers/common/http.js';
import { admitSameSiteKeyless } from '../providers/common/same-site.js';
import { liveFeedRoute } from '../providers/live-feed-routes.js';
import { sendProviderJson } from './node-provider-adapter.js';

const MAX_BYTES = 4_000_000;
const responseHeaders = [
  'content-type',
  'retry-after',
  'x-feed-source',
  'x-tomtom-cache',
  'x-tomtom-fetched-at',
];

export async function proxyLiveFeed(req, res, url, env = process.env) {
  if (req.method !== 'GET')
    return sendProviderJson(res, 405, { error: 'method_not_allowed' });
  if (admitSameSiteKeyless(req, res)) return;
  const provider = liveFeedRoute(url);
  if (!provider)
    return sendProviderJson(res, 400, { error: 'invalid_live_feed_request' });

  const origin = URL.parse(env.BLUE_ATLAS_FEED_ORIGIN ?? '');
  const token = env.BLUE_ATLAS_FEED_TOKEN?.trim();
  if (
    !origin ||
    origin.protocol !== 'https:' ||
    origin.href !== origin.origin + '/' ||
    !token
  ) {
    if (url.pathname === '/api/tomtom/status')
      return sendProviderJson(res, 200, { hasKey: false });
    if (provider === 'vessels')
      return sendProviderJson(res, 503, { rows: [], status: 'unsupported' });
    return sendProviderJson(res, 503, { error: 'traffic_backend_unavailable' });
  }

  const target = new URL(url.pathname + url.search, origin);
  // Bound the snapshot to keep it under the Vercel response cap.
  if (url.pathname === '/api/vessels' || url.pathname === '/api/vessels/') {
    target.searchParams.set(
      'maxRows',
      String(
        Math.min(Number(target.searchParams.get('maxRows') ?? 5000), 5000),
      ),
    );
  }
  try {
    const signal = AbortSignal.timeout(22_000);
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal,
    });
    const bytes = await readResponseBytesCapped(upstream, MAX_BYTES, signal);
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value) headers[name] = value;
    }
    res.writeHead(upstream.status, headers);
    return res.end(Buffer.from(bytes));
  } catch {
    return sendProviderJson(res, 502, { error: 'live_feed_unreachable' });
  }
}
