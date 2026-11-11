import { satelliteProxy } from '../satellite-proxy.js';

export function GET(request) {
  return satelliteProxy(request, 'tle');
}
