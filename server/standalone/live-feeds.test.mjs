import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { WebSocketServer } from 'ws';
import { proxyLiveFeed } from '../vercel/live-feed-proxy.js';
import { createLiveFeedServer } from './live-feeds.js';

test('the live-feed bridge reads one authenticated AIS stream and preserves TomTom quota across server restarts', async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), 'blue-atlas-feeds-'));
  const ais = new WebSocketServer({
    host: '127.0.0.1',
    port: 0,
    perMessageDeflate: true,
  });
  await new Promise((resolve) => ais.once('listening', resolve));
  const env = {
    BLUE_ATLAS_FEED_STATE_DIR: stateDir,
    AISSTREAM_API_KEY: 'ais-fixture',
    AISSTREAM_URL: `ws://127.0.0.1:${ais.address().port}`,
    TOMTOM_API_KEY: 'tomtom-fixture',
    TOMTOM_DAILY_TILE_BUDGET: '1',
  };
  const previous = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, env);
  const secret = 'bridge-fixture';
  let service;
  let address;
  let connections = 0;
  let tileRequests = 0;
  const realFetch = globalThis.fetch;
  t.after(async () => {
    if (service?.listening)
      await new Promise((resolve) => service.close(resolve));
    for (const socket of ais.clients) socket.terminate();
    await new Promise((resolve) => ais.close(resolve));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(stateDir, { recursive: true, force: true });
  });
  ais.on('connection', (socket) => {
    connections++;
    socket.on('message', (raw) => {
      assert.equal(socket.extensions, 'permessage-deflate');
      assert.equal(JSON.parse(raw).APIKey, env.AISSTREAM_API_KEY);
      socket.send(
        JSON.stringify({
          MessageType: 'PositionReport',
          MetaData: {
            MMSI: 123456789,
            latitude: 30,
            longitude: -97,
            time_utc: new Date().toISOString(),
          },
          Message: { PositionReport: { UserID: 123456789, Sog: 10, Cog: 90 } },
        }),
      );
    });
  });
  t.mock.method(globalThis, 'fetch', async (raw, options) => {
    const url = new URL(raw);
    if (url.hostname === 'api.tomtom.com') {
      tileRequests++;
      assert.equal(url.searchParams.get('key'), env.TOMTOM_API_KEY);
      return new Response(Uint8Array.of(1, 2, 3));
    }
    assert.equal(url.origin, 'https://feeds.example');
    return realFetch(address + url.pathname + url.search, options);
  });
  async function start() {
    service = createLiveFeedServer(secret);
    await new Promise((resolve) => service.listen(0, '127.0.0.1', resolve));
    address = `http://127.0.0.1:${service.address().port}`;
  }
  async function request(path) {
    const result = {};
    const res = {
      writeHead(status, headers) {
        Object.assign(result, { status, headers });
      },
      end(body) {
        result.body = body;
      },
    };
    await proxyLiveFeed(
      { method: 'GET', headers: {} },
      res,
      new URL(path, 'https://map.example'),
      {
        BLUE_ATLAS_FEED_ORIGIN: 'https://feeds.example',
        BLUE_ATLAS_FEED_TOKEN: secret,
      },
    );
    return result;
  }
  await start();
  assert.equal((await realFetch(address + '/api/tomtom/status')).status, 401);
  let snapshot;
  for (let i = 0; i < 80; i++) {
    snapshot = JSON.parse((await request('/api/vessels?maxRows=12000')).body);
    if (snapshot.status === 'live') break;
    await delay(10);
  }
  assert.equal(snapshot.status, 'live');
  assert.equal(snapshot.rows[0].mmsi, '123456789');
  assert.equal(connections, 1);

  for (const tile of await Promise.all([
    request('/api/tomtom/flow/8/1/1.pbf'),
    request('/api/tomtom/flow/8/1/1.pbf'),
  ])) {
    assert.equal(tile.status, 200);
    assert.deepEqual([...tile.body], [1, 2, 3]);
  }
  assert.equal(tileRequests, 1);
  await new Promise((resolve) => service.close(resolve));
  // The second server reads the first process's persisted quota.
  delete process.env.AISSTREAM_API_KEY;
  await start();
  assert.equal(
    JSON.parse((await request('/api/tomtom/status')).body).dailyCount,
    1,
  );
  assert.equal((await request('/api/tomtom/flow/8/2/1.pbf')).status, 429);
  assert.equal(tileRequests, 1);
});
