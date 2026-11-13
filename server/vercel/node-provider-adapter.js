export function sendProviderJson(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
}

/** Bridge a Vite middleware mount to a Vercel function. */
export function adaptNodeProvider(provider, prefix) {
  let handler;
  provider.configureServer({
    middlewares: {
      use(path, fn) {
        if (path === prefix) handler = fn;
      },
    },
  });
  if (!handler) throw new Error('Provider did not register its route');
  return async function handle(req, res, url) {
    const originalUrl = req.url;
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) {
      return sendProviderJson(res, 404, { error: 'unknown_route' });
    }
    const pathname = url.pathname.slice(prefix.length) || '/';
    req.url = pathname + url.search;
    try {
      await handler(req, res, () =>
        sendProviderJson(res, 404, { error: 'unknown_route' }),
      );
    } finally {
      req.url = originalUrl;
    }
  };
}
