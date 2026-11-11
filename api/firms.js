import { filterTrailing24h, parseFirmsCsv } from '../src/data/firmsCsv.js';

// NASA FIRMS active-fire detections. A free NASA FIRMS MAP_KEY is required.
// This first Vercel implementation is deliberately limited to the contiguous
// United States, avoiding multi-megabyte worldwide payloads and quota waste.
const TTL_MS = 30 * 60_000;
const SOURCE = 'VIIRS_NOAA20_NRT';
const AREA = '-125,24,-66,50'; // west,south,east,north
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET() {
  const key = String(process.env.FIRMS_MAP_KEY || '').trim();
  if (!key) return Response.json({ error: 'no_key' }, {
    status: 503, headers: { 'Cache-Control': 'no-store' },
  });
  try {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${SOURCE}/${AREA}/2`;
    const upstream = await fetch(url, {
      headers: { Accept: 'text/csv' },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) throw new Error('FIRMS HTTP ' + upstream.status);
    const length = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_BYTES) throw new Error('FIRMS payload too large');
    const reader = upstream.body?.getReader();
    if (!reader) throw new Error('Missing FIRMS body');
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) throw new Error('FIRMS payload too large');
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const records = parseFirmsCsv(new TextDecoder().decode(bytes));
    if (records === null) throw new Error('Unexpected FIRMS response');
    const now = Date.now();
    const fires = filterTrailing24h(records, now);
    return Response.json({
      fetchedAt: now,
      stale: false,
      ttlMs: TTL_MS,
      coverage: 'contiguous United States only',
      sources: [{ source: SOURCE, count: fires.length, ok: true }],
      count: fires.length,
      fires,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json({ error: 'FIRMS data temporarily unavailable' }, {
      status: 502, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
