import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBridge, saveCapture } from './server.mjs';
import http from 'node:http';

const sample = { id: 'capture-1', project: '../../Project', title: 'Useful question', selectedText: 'Why does the compressor cycle?', note: 'User asks about cooling', source: 'ChatGPT', sourceUrl: 'https://private.invalid/chat' };
test('capture is constrained, excludes URLs, and is idempotent', async t => {
  const vault = await mkdtemp(path.join(os.tmpdir(), 'router-vault-'));
  t.after(() => rm(vault, { recursive: true, force: true }));
  const saved = await saveCapture(vault, sample);
  assert.match(saved.path, /^Chat Inbox\/Router Captures\/[a-f0-9]{64}\.md$/);
  const content = await readFile(path.join(vault, saved.path), 'utf8');
  assert.match(content, /compressor/); assert.ok(!content.includes('private.invalid'));
  assert.equal((await saveCapture(vault, sample)).duplicate, true);
  await assert.rejects(saveCapture(vault, { ...sample, selectedText: 'changed' }), /different content/);
  assert.equal((await readdir(path.dirname(path.join(vault, saved.path)))).length, 1);
});
test('credential and oversized captures never create a note', async t => {
  const vault = await mkdtemp(path.join(os.tmpdir(), 'router-vault-'));
  t.after(() => rm(vault, { recursive: true, force: true }));
  await assert.rejects(saveCapture(vault, { ...sample, selectedText: 'sk-' + 'a'.repeat(30) }), /credential/);
  await assert.rejects(saveCapture(vault, { ...sample, selectedText: 'a'.repeat(10001) }), /Invalid/);
  assert.deepEqual(await readdir(vault), []);
});
test('HTTP requires authentication and rejects web origins, invalid hosts and non-JSON writes', async t => {
  const vault = await mkdtemp(path.join(os.tmpdir(), 'router-vault-'));
  const token = 'a'.repeat(64); let calls = 0;
  const server = createBridge({ vault, token, roots: [vault], searchSources: async () => { calls++; return [{ source: 'note.md', line: 1, excerpt: 'test' }]; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(vault, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  assert.equal((await fetch(base + '/health')).status, 401);
  assert.equal((await fetch(base + '/health', { headers: { ...headers, Origin: 'https://evil.test' } })).status, 403);
  const badHost = await new Promise((resolve, reject) => {
    const request = http.get(base + '/health', { headers: { ...headers, Host: 'evil.test' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
  assert.equal(badHost, 403);
  assert.equal((await fetch(base + '/search?q=x', { headers })).status, 400);
  assert.equal(calls, 0);
  const search = await fetch(base + '/search?q=project', { headers });
  assert.equal(search.status, 200); assert.equal((await search.json()).results[0].line, 1);
  const saved = await fetch(base + '/capture', { method: 'POST', headers, body: JSON.stringify(sample) });
  assert.equal(saved.status, 200); assert.equal((await saved.json()).saved, true);
  assert.equal((await fetch(base + '/capture', { method: 'POST', headers: { Authorization: headers.Authorization }, body: '{}' })).status, 415);
  assert.equal((await fetch(base + '/capture', { method: 'POST', headers, body: 'x'.repeat(41000) })).status, 413);
});
