import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import handler from '../../api/provider.js';

test('the provider router dispatches nested paths without passing routing metadata upstream', async (t) => {
  const server = createServer((req, res) => void handler(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const request = (path, options) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  const catalog = await request(
    '/api/provider?__blue_atlas_path=transit%2Ffeeds',
  );
  assert.equal(catalog.status, 200);
  assert.ok((await catalog.json()).feeds.length > 0);

  const weather = await request(
    '/api/provider?__blue_atlas_path=weather%2Fmanifest&product=unknown',
  );
  assert.equal(weather.status, 400);
  assert.deepEqual(await weather.json(), { error: 'unknown_weather_product' });

  assert.equal((await request('/api/military/unknown')).status, 404);
  assert.equal((await request('/api/wind/manifest?model=invalid')).status, 400);
  assert.equal((await request('/api/provider')).status, 404);

  const crossSite = await request('/api/news/hotspots', {
    headers: { 'Sec-Fetch-Site': 'cross-site', 'X-Forwarded-Proto': 'https' },
  });
  assert.equal(crossSite.status, 403);
  const ownSite = await request('/api/news/hotspots?invalid=1', {
    headers: { 'Sec-Fetch-Site': 'same-origin', 'X-Forwarded-Proto': 'https' },
  });
  assert.equal(ownSite.status, 400);
});
