import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import chat from '../api/chat.js';
import images from '../api/images.js';
import status from '../api/status.js';

test('Vercel functions accept platform-parsed JSON and route requests correctly', async () => {
  const saved = { gemini: process.env.GEMINI_API_KEY, google: process.env.GOOGLE_API_KEY };
  delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY;
  const app = http.createServer(async (req, res) => {
    const fn = req.url === '/api/chat' ? chat : req.url === '/api/images' ? images : status;
    if (req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      req.body = JSON.parse(raw);
    }
    return fn(req, res);
  });
  try {
    await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.address().port}`;
    const response = await fetch(`${base}/api/status`);
    assert.deepEqual(await response.json(), { connected: false, mode: 'demo' });
    const post = (route, data) => fetch(`${base}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const valid = await post('chat', { messages: [{ role: 'user', content: 'Halo Gemini' }] });
    assert.equal(valid.status, 503); assert.match((await valid.json()).error, /GEMINI_API_KEY/);
    assert.equal((await post('chat', { messages: [] })).status, 400);
    assert.equal((await post('images', { prompt: 'A garden', size: 'square' })).status, 503);
    assert.equal((await post('chat', { padding: 'x'.repeat(160000) })).status, 413);
    const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
    assert.equal(config.outputDirectory, 'public');
  } finally {
    await new Promise(resolve => app.close(resolve));
    if (saved.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = saved.gemini;
    if (saved.google === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = saved.google;
  }
});
