import { satelliteProxy } from '../../server/vercel/satellite-proxy.js';

export function GET(request) {
  return satelliteProxy(request, 'satcat');
}
