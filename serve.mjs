// Server statico minimale per sviluppo locale (non serve su GitHub Pages)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
import { fileURLToPath } from 'node:url';
const root = normalize(fileURLToPath(new URL('.', import.meta.url))).replace(/[\/]$/, '');
http.createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = normalize(join(root, p));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const d = await readFile(f); res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(+process.env.PORT || 5173, () => console.log('http://localhost:' + (process.env.PORT || 5173)));
