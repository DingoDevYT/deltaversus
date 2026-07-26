/**
 * stamp_assets.js — content-hash every local asset URL in docs/*.html.
 *
 * GitHub Pages serves with `Cache-Control: max-age=600`. HTML and JS are cached
 * INDEPENDENTLY, so for ten minutes after a deploy a returning visitor can hold
 * the new gml_studio.html against the previous build's JS. That mix is not a
 * degraded experience, it is a hard crash: a stale gml_translator.js makes
 * `compiled.errors` undefined, and a stale gml_asset_db.js has no
 * getLoadStatus(), and both throw before the studio can start.
 *
 * Rewriting `src="js/gml_runtime.js"` to `src="js/gml_runtime.js?v=1a2b3c4d"`
 * makes the URL itself change whenever the bytes change, so the browser cannot
 * reuse an old copy — and, because the hash is of the CONTENT, files that did
 * not change keep their URL and stay cached.
 *
 * Idempotent: an existing ?v= is stripped before the new one is applied, so this
 * can run on every build.
 *
 *   node scripts/stamp_assets.js          stamp
 *   node scripts/stamp_assets.js --check  report drift, exit 1 if any (for CI)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DOCS = path.join(__dirname, '..', 'docs');
const CHECK = process.argv.includes('--check');

/** Short content hash — 8 hex chars is ample to distinguish builds. */
const hashCache = new Map();
function hashOf(absPath) {
  if (hashCache.has(absPath)) return hashCache.get(absPath);
  let h = null;
  try {
    h = crypto.createHash('sha1').update(fs.readFileSync(absPath)).digest('hex').slice(0, 8);
  } catch (e) {
    h = null;   // missing file: leave the URL alone rather than inventing a hash
  }
  hashCache.set(absPath, h);
  return h;
}

// src="..." / href="..." pointing at a LOCAL .js or .css. Absolute URLs and
// protocol-relative ones are skipped: we cannot hash what we do not ship.
const ASSET_RE = /\b(src|href)=("|')([^"'>]+?\.(?:js|css))(\?v=[0-9a-f]+)?\2/gi;

function stampFile(htmlPath) {
  const original = fs.readFileSync(htmlPath, 'utf8');
  let changed = 0, skipped = 0;

  const out = original.replace(ASSET_RE, (whole, attr, q, url, oldQuery) => {
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) { skipped++; return whole; }
    const abs = path.join(path.dirname(htmlPath), url);
    const h = hashOf(abs);
    if (!h) { skipped++; return whole; }
    const next = `${attr}=${q}${url}?v=${h}${q}`;
    if (next !== whole) changed++;
    return next;
  });

  if (out !== original && !CHECK) fs.writeFileSync(htmlPath, out, 'utf8');
  return { changed, skipped, drifted: out !== original };
}

const htmlFiles = fs.readdirSync(DOCS).filter(f => f.endsWith('.html'))
  .map(f => path.join(DOCS, f));

let drift = 0;
for (const f of htmlFiles) {
  const r = stampFile(f);
  if (r.drifted) drift++;
  const name = path.basename(f);
  if (CHECK) {
    console.log(`${r.drifted ? 'STALE  ' : 'ok     '} ${name}${r.drifted ? `  (${r.changed} asset URLs out of date)` : ''}`);
  } else {
    console.log(`${name}: ${r.changed} asset URLs stamped${r.skipped ? `, ${r.skipped} skipped` : ''}`);
  }
}

if (CHECK && drift) {
  console.error(`\n${drift} file(s) have unstamped or stale asset hashes — run: node scripts/stamp_assets.js`);
  process.exit(1);
}
