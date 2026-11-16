import { createRadioProxyMiddleware } from './radio/catalog.js';
export { createRadioProxyMiddleware };
export { isPublicRadioAddress } from './radio/transport.js';
export {
  normalizeRadioBrowserStation,
  publicRadioStation,
  publicRadioHttpsUrl,
} from './radio/stations.js';
export function radioBrowserProxy({ hosted = false } = {}) {
  let middleware;
  const initialize = () =>
    (middleware ||= createRadioProxyMiddleware({
      priorityCountries: process.env.RADIO_PRIORITY_COUNTRIES || '',
      hosted,
    }));
  const install = (server) => {
    server.middlewares.use('/api/radio', initialize());
  };
  return {
    name: 'radio-browser-proxy',
    configureServer: install,
    configurePreviewServer: install,
  };
}
