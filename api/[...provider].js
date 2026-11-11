import { gnssIntegrityProxy } from '../server/providers/gnssIntegrity.js';
import { cycloneProxy } from '../server/providers/cyclones.js';
import { shipwrecksProxy } from '../server/providers/shipwrecks.js';
import { adaptNodeProvider } from './node-provider-adapter.js';

// One Vercel function serves three provider routes to stay within Hobby limits.
const routes = {
  'gnss-integrity': adaptNodeProvider(gnssIntegrityProxy(), '/api/gnss-integrity'),
  cyclones: adaptNodeProvider(cycloneProxy(), '/api/cyclones'),
  shipwrecks: adaptNodeProvider(shipwrecksProxy(), '/api/shipwrecks'),
};

export default function handler(req, res) {
  const url = new URL(req.url || '/', 'https://blueatlas.invalid');
  const segment = url.pathname.split('/')[2];
  const route = routes[segment];
  if (!route) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'unknown_provider' }));
    return;
  }
  return route(req, res);
}
