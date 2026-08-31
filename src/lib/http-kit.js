// Minimal zero-dependency Express-like router on top of node:http.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

function compile(pattern) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, m => { keys.push(m.slice(1)); return '([^/]+)'; }) + '/?$');
  return { regex, keys };
}

export function Router() {
  const middleware = [];
  const routes = [];
  const r = {
    use: (...mw) => middleware.push(...mw),
    handle(req, res, subPath) {
      for (const route of routes) {
        if (route.method !== req.method) continue;
        const m = subPath.match(route.regex);
        if (!m) continue;
        req.params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        runChain([...middleware, ...route.handlers], req, res);
        return true;
      }
      return false;
    }
  };
  for (const method of ['get', 'post', 'patch', 'delete', 'put']) {
    r[method] = (pattern, ...handlers) => routes.push({ method: method.toUpperCase(), ...compile(pattern), handlers });
  }
  return r;
}

function runChain(handlers, req, res) {
  let i = 0;
  const next = (err) => {
    if (err) {
      console.error(err);
      if (!res.headersSent) {
        const status=Number.isInteger(err.statusCode)&&err.statusCode>=400&&err.statusCode<600?err.statusCode:500;
        res.status(status).json(status===500?{error:'Internal server error'}:(err.responseBody||{error:err.message}));
      }
      return;
    }
    const h = handlers[i++];
    if (!h) return;
    try {
      const out = h(req, res, next);
      if (out && typeof out.catch === 'function') out.catch(next);
    } catch (e) { next(e); }
  };
  next();
}

export function createApp() {
  const mounts = []; // { prefix, router }
  let staticDir = null;

  const app = {
    mount: (prefix, router) => mounts.push({ prefix, router }),
    static: (dir) => { staticDir = dir; },
    listen: (port, cb) => server.listen(port, cb)
  };

  const server = http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // response helpers
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };

    const url = new URL(req.url, 'http://localhost');
    req.path = url.pathname;
    req.query = Object.fromEntries(url.searchParams);

    // JSON body parsing. The governed DLD staging endpoint alone accepts bounded raw CSV so the
    // exact source bytes can be hashed without base64 inflation or a global JSON-limit increase.
    const rawDldCsv = req.method === 'POST' && req.path === '/api/admin/dld-market-batches' &&
      String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() === 'text/csv';
    const chunks = [];
    let bodySize = 0;
    let bodyTooLarge = false;
    req.on('data', (c) => {
      if (bodyTooLarge) return;
      bodySize += c.length;
      const bodyLimit = rawDldCsv ? 50 * 1024 * 1024 : Number(process.env.MAX_JSON_BODY_BYTES || 33554432);
      if (bodySize > bodyLimit) {
        bodyTooLarge = true;
        chunks.length = 0;
        return res.status(413).json({ error: 'Request body is too large' });
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (bodyTooLarge) return;
      req.body = {};
      if (chunks.length) {
        const bytes = Buffer.concat(chunks);
        if (rawDldCsv) {
          req.rawBody = bytes;
          req.body = {
            fileName: String(req.headers['x-nysa-file-name'] || '').trim(),
            sourceDatasetRef: String(req.headers['x-nysa-source-dataset'] || '').trim(),
            sourceFormat: String(req.headers['x-nysa-source-format'] || '').trim(),
            idempotencyKey: String(req.headers['x-idempotency-key'] || '').trim()
          };
        } else {
          req.rawBody = bytes.toString('utf8');
          try { req.body = JSON.parse(req.rawBody); }
          catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
        }
      }
      dispatch(req, res);
    });
  });

  function dispatch(req, res) {
    try {
      for (const { prefix, router } of mounts) {
        if (req.path === prefix || req.path.startsWith(prefix + '/')) {
          const subPath = req.path.slice(prefix.length) || '/';
          if (router.handle(req, res, subPath)) return;
        }
      }
      if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
      if (staticDir && (req.method === 'GET' || req.method === 'HEAD')) return serveStatic(req, res);
      res.status(404).json({ error: 'Not found' });
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
  }

  function serveStatic(req, res) {
    let rel = req.path === '/' ? 'index.html' : req.path.slice(1);
    const file = path.normalize(path.join(staticDir, rel));
    if (!file.startsWith(path.normalize(staticDir))) return res.status(403).json({ error: 'Forbidden' });
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        // SPA fallback
        const index = path.join(staticDir, 'index.html');
        return fs.existsSync(index) ? streamFile(index, res) : res.status(404).json({ error: 'Not found' });
      }
      streamFile(file, res);
    });
  }

  function streamFile(file, res) {
    const extension=path.extname(file).toLowerCase();
    res.setHeader('Content-Type', MIME[extension] || 'application/octet-stream');
    if (['.html','.js','.css'].includes(extension)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      res.setHeader('X-LiteSpeed-Cache-Control', 'no-cache');
    }
    fs.createReadStream(file).pipe(res);
  }

  return app;
}
