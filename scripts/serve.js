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

const server = http.createServer((req, res) => {
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
