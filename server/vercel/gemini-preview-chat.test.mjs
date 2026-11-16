import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createGeminiPreviewChat } from './gemini-preview-chat.js';

test('protected preview admits its own Gemini requests behind the proxy', async (t) => {
  const host = 'owned-preview.vercel.app';
  const env = {
    VERCEL_ENV: 'preview',
    VERCEL_URL: host,
    GEMINI_API_KEY: 'fixture-key',
  };
  let calls = 0;
  const handler = createGeminiPreviewChat(env, {
    fetchImpl: async (url, options) => {
      calls++;
      assert.match(url, /gemini-3\.5-flash-lite:generateContent$/);
      assert.equal(options.headers['x-goog-api-key'], 'fixture-key');
      return Response.json({
        candidates: [
          { content: { role: 'model', parts: [{ text: 'Ready' }] } },
        ],
      });
    },
  });
  const server = createServer((req, res) => {
    req.headers.host = host;
    void handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const send = (origin) =>
    fetch(`http://127.0.0.1:${server.address().port}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-Proto': 'https',
        Origin: origin,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      }),
    });

  assert.equal((await send('https://elsewhere.example')).status, 403);
  const response = await send('https://' + host);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).content.parts[0].text, 'Ready');
  env.VERCEL_ENV = 'production';
  assert.equal((await send('https://' + host)).status, 403);
  env.GEMINI_PRODUCTION_HOST = host;
  assert.equal((await send('https://elsewhere.example')).status, 403);
  assert.equal((await send('https://' + host)).status, 200);
  assert.equal(calls, 2);
});
