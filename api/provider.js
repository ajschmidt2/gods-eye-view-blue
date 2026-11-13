import { adsbLolProxy } from '../server/providers/aircraft/adsb-lol.js';
import { trackBackfillProxies } from '../server/providers/aircraft/tracks.js';
import { cycloneProxy } from '../server/providers/cyclones.js';
import { droneAirspaceProxy } from '../server/providers/droneAirspace.js';
import { firePerimetersProxy } from '../server/providers/firePerimeters.js';
import { gbfsProxy } from '../server/providers/gbfs.js';
import { ghostMapsProxy } from '../server/providers/ghostMaps.js';
import { gnssIntegrityProxy } from '../server/providers/gnssIntegrity.js';
import { inaturalistProxy } from '../server/providers/inaturalist/observations.js';
import { militaryInstallationsProxy } from '../server/providers/military-installations.js';
import { newsProxy } from '../server/providers/news.js';
import { createKeyedNews } from '../server/providers/news/keyed.js';
import { radioBrowserProxy } from '../server/providers/radio.js';
import { shipwrecksProxy } from '../server/providers/shipwrecks.js';
import {
  celestrakProxy,
  rocketLaunchesProxy,
} from '../server/providers/space.js';
import { transitProxy } from '../server/providers/transit.js';
import { weatherProxy } from '../server/providers/weather.js';
import { windProxy } from '../server/providers/wind.js';
import {
  adaptNodeProvider,
  sendProviderJson,
} from '../server/vercel/node-provider-adapter.js';
import { proxyLiveFeed } from '../server/vercel/live-feed-proxy.js';

const satellites = celestrakProxy({
  cacheDir: null,
  maxResponseBytes: 4_000_000,
});

const routes = new Map([
  ['/api/celestrak', () => satellites],
  ['/api/celestrak-satcat', () => satellites],
  ['/api/cyclones', cycloneProxy],
  ['/api/drone-airspace', droneAirspaceProxy],
  ['/api/fire-perimeters', firePerimetersProxy],
  ['/api/gbfs', gbfsProxy],
  ['/api/ghostmaps', () => ghostMapsProxy({ onDemand: true })],
  ['/api/gnss-integrity', gnssIntegrityProxy],
  ['/api/inaturalist', inaturalistProxy],
  ['/api/launches', () => rocketLaunchesProxy({ diskCache: false })],
  ['/api/military', adsbLolProxy],
  ['/api/military/track', trackBackfillProxies],
  [
    '/api/military-installations',
    () => militaryInstallationsProxy({ hosted: true }),
  ],
  [
    '/api/news',
    () =>
      newsProxy({
        hosted: true,
        keyed: createKeyedNews({ env: () => ({}), requestDriven: true }),
      }),
  ],
  ['/api/radio', () => radioBrowserProxy({ hosted: true })],
  ['/api/shipwrecks', shipwrecksProxy],
  ['/api/transit', transitProxy],
  ['/api/weather', () => weatherProxy({ maxImageBytes: 4_000_000 })],
  ['/api/wind', () => windProxy({ inlineGrid: true })],
]);

const handlers = new Map();

export default async function handler(req, res) {
  try {
    const url = new URL(req.url || '/', 'https://blueatlas.invalid');
    const rewrittenPath = url.searchParams.get('__blue_atlas_path');
    if (url.pathname === '/api/provider' && rewrittenPath)
      url.pathname = '/api/' + rewrittenPath;
    // Remove only the internal route parameter and keep the caller's query.
    url.searchParams.delete('__blue_atlas_path');
    const [, api, provider, subroute] = url.pathname.split('/');
    if (api !== 'api') {
      return sendProviderJson(res, 404, { error: 'unknown_provider' });
    }

    if (provider === 'vessels' || provider === 'tomtom')
      return await proxyLiveFeed(req, res, url);

    const root = '/api/' + provider;
    const child = root + '/' + subroute;
    const prefix = routes.has(child) ? child : root;
    const factory = routes.get(prefix);
    if (!factory)
      return sendProviderJson(res, 404, { error: 'unknown_provider' });
    if (!handlers.has(prefix)) {
      handlers.set(prefix, adaptNodeProvider(factory(), prefix));
    }
    return await handlers.get(prefix)(req, res, url);
  } catch (error) {
    console.error('[provider-router]', error?.name || 'Error');
    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    return sendProviderJson(res, 500, { error: 'provider_failed' });
  }
}
