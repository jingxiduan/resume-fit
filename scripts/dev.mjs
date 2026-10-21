// 本地开发服务器：无需 Netlify CLI。静态文件取自 src/，/api/* 直接调用 netlify/functions 中的处理函数。
import http from 'node:http';
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 读取 .env
const envFile = path.join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const routes = {};
for (const f of await fs.readdir(path.join(root, 'netlify/functions'))) {
  if (!f.endsWith('.mjs')) continue;
  const mod = await import(pathToFileURL(path.join(root, 'netlify/functions', f)).href);
  if (mod.config?.path) routes[mod.config.path] = mod.default;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.bcmap': 'application/octet-stream' };
const vendorMap = {
  'pdf.min.js': 'node_modules/pdfjs-dist/build/pdf.min.js',
  'pdf.worker.min.js': 'node_modules/pdfjs-dist/build/pdf.worker.min.js',
  'mammoth.browser.min.js': 'node_modules/mammoth/mammoth.browser.min.js'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const fn = routes[url.pathname];
  if (fn) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    try {
      const r = await fn(request, {});
      res.writeHead(r.status, Object.fromEntries(r.headers));
      if (r.body) Readable.fromWeb(r.body).pipe(res);
      else res.end();
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  let file;
  if (url.pathname.startsWith('/vendor/')) {
    const name = url.pathname.slice(8);
    file = vendorMap[name] ? path.join(root, vendorMap[name]) : name.startsWith('cmaps/') ? path.join(root, 'node_modules/pdfjs-dist', name) : null;
  } else {
    file = path.join(root, 'src', url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
    if (!file.startsWith(path.join(root, 'src'))) file = null;
  }
  try {
    if (!file) throw new Error();
    const data = await fs.readFile(file);
    const csp = (readFileSync(path.join(root, 'netlify.toml'), 'utf8').match(/Content-Security-Policy\s*=\s*"([^"]+)"/) || [])[1];
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store', ...(csp ? { 'content-security-policy': csp } : {}) });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

const port = parseInt(process.env.PORT || '8888', 10);
server.listen(port, () => console.log(`ResumeFit dev server: http://localhost:${port}  (functions: ${Object.keys(routes).join(', ')})`));
