import http from 'node:http';
import path from 'node:path';
import { readFile, realpath, mkdir, lstat, open } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const MAX_BODY = 40000;
const secrets = /\b(?:sk-[\w-]{16,}|gh[pousr]_[\w]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[\w-]{10,}|Bearer\s+[\w.-]{20,})|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:password|api[_-]?key|token|secret)\s*[:=]\s*\S{6,}/i;
function field(value, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw Error('Invalid capture fields.');
  return value;
}
export function normalizeCapture(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid capture.');
  const capture = {
    id: field(data.id, 80, true), project: field(data.project, 60, true),
    title: field(data.title, 120, true), selectedText: field(data.selectedText, 10000, true),
    note: field(data.note, 2000), source: field(data.source, 40),
  };
  if (secrets.test(JSON.stringify(capture))) throw Error('Possible credential detected. Remove it before saving.');
  return capture;
}
async function captureDirectory(vault) {
  const root = await realpath(vault);
  let current = root;
  for (const segment of ['Chat Inbox', 'Router Captures']) {
    current = path.join(current, segment);
    await mkdir(current, { recursive: true });
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(current) !== current) throw Error('Capture directory is not safe.');
  }
  return current;
}
export async function saveCapture(vault, data) {
  const capture = normalizeCapture(data);
  const digest = createHash('sha256').update(JSON.stringify(capture)).digest('hex');
  const id = createHash('sha256').update(capture.id).digest('hex');
  const relative = `Chat Inbox/Router Captures/${id}.md`;
  const folder = await captureDirectory(vault);
  const file = path.join(folder, `${id}.md`);
  const single = text => text.replace(/[\r\n]/g, ' ');
  const quote = text => text.split(/\r?\n/).map(line => `> ${line}`).join('\n');
  const content = `<!-- router-capture-sha256:${digest} -->\n# ${single(capture.title)}\n\nProject: ${single(capture.project)}\nSource client: ${single(capture.source || 'unknown')}\nSaved: ${new Date().toISOString()}\n\n## Routed passage (source text)\n${quote(capture.selectedText)}\n\n## Carry-over context (source text)\n${quote(capture.note || 'None identified')}\n\nSource conversation URL omitted. Original chat unchanged.\n`;
  try {
    const fh = await open(file, 'wx', 0o600);
    try { await fh.writeFile(content, 'utf8'); await fh.sync(); } finally { await fh.close(); }
    return { saved: true, duplicate: false, path: relative };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if ((await lstat(file)).isSymbolicLink()) throw Error('Capture target is not safe.');
    const existing = await readFile(file, 'utf8');
    if (!existing.startsWith(`<!-- router-capture-sha256:${digest} -->`)) throw Error('Capture already exists with different content.');
    return { saved: true, duplicate: true, path: relative };
  }
}
export function createBridge({ vault, token, searchSources, roots }) {
  if (typeof token !== 'string' || token.length < 32) throw Error('A private pairing key is required.');
  const expected = Buffer.from(`Bearer ${token}`);
  return http.createServer(async (req, res) => {
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(data));
    };
    // No CORS grants: browser pages cannot pair, read or write. Extension host permission is explicit.
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || '') ||
        (req.headers.origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(req.headers.origin))) return reply(403, { error: 'Origin or host rejected.' });
    const supplied = Buffer.from(req.headers.authorization || '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply(401, { error: 'Pair Router with the local bridge first.' });
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/health') return reply(200, { ok: true, captureFolder: 'Chat Inbox/Router Captures' });
      if (req.method === 'GET' && url.pathname === '/search') {
        const q = url.searchParams.get('q') || '';
        if (q.trim().length < 2 || q.length > 200) return reply(400, { error: 'Search needs 2–200 characters.' });
        const results = await searchSources(q, { roots, limit: 12 });
        return reply(200, { results });
      }
      if (req.method === 'POST' && url.pathname === '/capture') {
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return reply(415, { error: 'JSON required.' });
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) return reply(413, { error: 'Capture too large.' }); chunks.push(chunk); }
        return reply(200, await saveCapture(vault, JSON.parse(Buffer.concat(chunks).toString('utf8'))));
      }
      reply(404, { error: 'Unknown bridge action.' });
    } catch { reply(400, { error: 'Request failed. Check fields, credentials, destination access, or capture conflicts.' }); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const { searchSources } = await import(pathToFileURL(config.searchModule).href);
  const server = createBridge({ ...config, searchSources, roots: [config.vault, config.memory] });
  server.requestTimeout = 15000;
  server.listen(4828, '127.0.0.1', () => console.log('Router central brain bridge ready on 127.0.0.1:4828'));
}
