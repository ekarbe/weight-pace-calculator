#!/usr/bin/env node
// Minimal static server for the exported site (./out), mounted under the app's basePath exactly like on
// GitHub Pages: everything outside /weight-pace-calculator/ is a 404. No dependencies; used by the e2e suite.
//
//   node scripts/serve-out.mjs [port]      (or PORT=3000; default 3100)
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE_PATH = '/weight-pace-calculator';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** Maps a request path to a file under `root`, or null when it is outside the basePath or escapes `root`. */
export function resolveFile(root, pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (path !== BASE_PATH && !path.startsWith(`${BASE_PATH}/`)) return null;
  const file = resolve(root, `.${path.slice(BASE_PATH.length) || '/'}`);
  if (file !== root && !file.startsWith(root + sep)) return null;
  if (existsSync(file) && statSync(file).isDirectory()) return join(file, 'index.html');
  return file;
}

export function createStaticServer(root) {
  return createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      return res.end();
    }
    if (pathname === BASE_PATH) {
      // GitHub Pages redirects the bare project path to its trailing-slash form.
      res.writeHead(301, { location: `${BASE_PATH}/${new URL(req.url ?? '/', 'http://localhost').search}` });
      return res.end();
    }
    const file = resolveFile(root, pathname);
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'content-length': statSync(file).size,
      // The suite must always see the build it just made.
      'cache-control': 'no-store',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'out');
  if (!existsSync(join(root, 'index.html'))) {
    console.error(`serve-out: ${root}/index.html not found. Run "npm run build" first.`);
    process.exit(1);
  }
  const port = Number(process.argv[2] ?? process.env.PORT ?? 3100);
  const server = createStaticServer(root);
  server.listen(port, () => console.log(`serve-out: http://localhost:${port}${BASE_PATH}/ (serving ${root})`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
