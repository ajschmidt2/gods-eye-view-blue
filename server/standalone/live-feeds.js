import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { liveFeedRoute } from '../providers/live-feed-routes.js';
import { tomtomProxy } from '../providers/traffic.js';
import { aisLiveProxy } from '../providers/vessels/ais-live.js';
import { sendProviderJson } from '../vercel/node-provider-adapter.js';

const digest = (text) => createHash('sha256').update(text).digest();

export function createLiveFeedServer(token) {
  if (!token?.trim())
    throw new Error(
      'Set BLUE_ATLAS_FEED_TOKEN before starting the feed server.',
    );
  const expected = digest(`Bearer ${token.trim()}`);
  const routes = new Map();
  const server = createServer(async (req, res) => {
    if (!timingSafeEqual(digest(req.headers.authorization ?? ''), expected))
      return sendProviderJson(res, 401, { error: 'unauthorized' });
    if (req.method !== 'GET')
      return sendProviderJson(res, 405, { error: 'method_not_allowed' });
    try {
      const url = URL.parse(req.url || '/', 'http://localhost');
      const route = url && liveFeedRoute(url);
      if (!route) return sendProviderJson(res, 404, { error: 'unknown_feed' });
      const prefix = '/api/' + route;
      req.url = (url.pathname.slice(prefix.length) || '/') + url.search;
      return await routes.get(prefix)(req, res);
    } catch {
      if (!res.headersSent)
        return sendProviderJson(res, 500, { error: 'feed_failed' });
      res.destroy();
    }
  });
  const context = {
    httpServer: server,
    middlewares: { use: (prefix, handler) => routes.set(prefix, handler) },
  };
  aisLiveProxy().configureServer(context);
  tomtomProxy({ trustedServer: true }).configureServer(context);
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createLiveFeedServer(process.env.BLUE_ATLAS_FEED_TOKEN);
  const host = process.env.BLUE_ATLAS_FEED_HOST || '127.0.0.1';
  const port = Number(process.env.BLUE_ATLAS_FEED_PORT || 8787);
  server.listen(port, host, () =>
    console.log(`Blue Atlas live feeds listening on ${host}:${port}`),
  );
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close());
  }
}
