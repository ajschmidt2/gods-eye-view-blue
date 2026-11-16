import { isValidTileCoord } from '../../src/data/tomtomTiles.js';

export function liveFeedRoute(url) {
  const { pathname, searchParams } = url;
  if (pathname === '/api/vessels' || pathname === '/api/vessels/') {
    const rows = searchParams.get('maxRows');
    if (rows !== null && (!/^\d{1,5}$/.test(rows) || Number(rows) < 1))
      return null;
    return 'vessels';
  }
  if (pathname === '/api/vessels/track') {
    return /^\d{5,10}$/.test(searchParams.get('mmsi') ?? '') ? 'vessels' : null;
  }
  if (pathname === '/api/tomtom/status') return 'tomtom';
  const tile = /^\/api\/tomtom\/flow\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(pathname);
  return tile && isValidTileCoord(...tile.slice(1).map(Number))
    ? 'tomtom'
    : null;
}
