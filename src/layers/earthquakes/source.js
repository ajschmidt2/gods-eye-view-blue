import { normalizeEarthquakeSnapshot } from './records.js';
const PUBLIC_USGS_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const BLUE_ATLAS_API_URL = '/api/earthquakes?period=day';

/**
 * Prefer the deployed Blue Atlas API for earthquake observations.
 * Fall back to the official public USGS feed for local/offline-backend
 * development or when the proxy is temporarily unavailable.
 */
export function createUsgsEarthquakeSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      let lastError;
      for (const url of [BLUE_ATLAS_API_URL, PUBLIC_USGS_URL]) {
        try {
          const response = await fetchImpl(url, { signal });
          if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);
          const payload = await response.json();
          signal?.throwIfAborted();
          const rows = normalizeEarthquakeSnapshot(payload);
          if (!rows) throw new Error('Malformed USGS response');
          return rows;
        } catch (error) {
          if (signal?.aborted) throw error;
          lastError = error;
        }
      }
      throw lastError || new Error('USGS earthquake feed unavailable');
    },
  };
}
