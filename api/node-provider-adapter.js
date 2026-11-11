/** Bridge the existing Node middleware providers to Vercel functions. */
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
  return async function handle(req, res) {
    const originalUrl = req.url;
    const url = new URL(req.url || '/', 'https://blueatlas.invalid');
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'unknown_route' }));
      return;
    }
    req.url = url.pathname.slice(prefix.length) + url.search || '/';
    try {
      await handler(req, res);
    } finally {
      req.url = originalUrl;
    }
  };
}
