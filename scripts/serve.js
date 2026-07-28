const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8399;
const DOCS_DIR = path.join(__dirname, '..', 'docs');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json'
};

const SHOT_DIR = path.join(__dirname, '..', 'shots');

const JS_DIR = path.join(DOCS_DIR, 'js');

const server = http.createServer((req, res) => {
  // POST /baseline writes docs/js/visual_baseline.json.
  //
  // VISUAL_PROBE.saveBaseline only ever wrote localStorage, so the committed
  // baseline could only be refreshed by pasting console output over the file by
  // hand — which meant it drifted: the copy in the tree measured a state two
  // engine fixes old, and a stale baseline reports real regressions as
  // pre-existing and real fixes as regressions.
  if (req.method === 'POST' && req.url === '/baseline') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);           // reject garbage before writing
        const n = Object.keys(parsed).length;
        fs.writeFileSync(path.join(JS_DIR, 'visual_baseline.json'),
          JSON.stringify(parsed, null, 1) + '\n');
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end('wrote visual_baseline.json (' + n + ' attacks)');
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end('err ' + e.message);
      }
    });
    return;
  }
  // POST /snap/<name>.png with a base64 dataURL body writes the canvas to
  // docs/../shots/<name>.png at FULL resolution.
  //
  // The browser-pane screenshot tool downscales to ~800px wide, which is enough
  // to miss exactly the layering and tint errors this studio exists to catch —
  // a frame that reads "fine" at 55% scale can have the battle box painted over
  // the effect that should be on top of it. Round-tripping the dataURL through
  // the console is worse: the strings are megabytes and get truncated. So the
  // page posts its own pixels here and they get inspected from disk.
  if (req.method === 'POST' && req.url.startsWith('/snap/')) {
    const name = path.basename(decodeURIComponent(req.url.slice(6)));
    let body = '';
    req.setEncoding('utf8');
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const b64 = body.replace(/^data:image\/\w+;base64,/, '');
        fs.mkdirSync(SHOT_DIR, { recursive: true });
        fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(b64, 'base64'));
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end('ok ' + name);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end('err ' + e.message);
      }
    });
    return;
  }

  // Strip the query string and decode: `?v=2` cache-busters are the normal way to
  // force a reload here, and path.join would otherwise look for a file literally
  // named "gml_studio.html?v=2".
  let urlPath = req.url.split('?')[0].split('#')[0];
  try { urlPath = decodeURIComponent(urlPath); } catch (e) { /* keep raw */ }
  if (urlPath === '/' || urlPath === '') urlPath = '/gml_studio.html';

  // Keep requests inside docs/.
  const filePath = path.join(DOCS_DIR, path.normalize(urlPath).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(DOCS_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      // No caching: this is a live editing surface, and a stale gml_codegen.js
      // silently makes the studio disagree with the Node test suites.
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`DELTA STUDIO SERVER RUNNING AT http://localhost:${PORT}/gml_studio.html`);
});
