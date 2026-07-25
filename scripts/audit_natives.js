/**
 * audit_natives.js — what can the translator NOT read yet?
 *
 * Scans every GML file in the corpus for function calls, subtracts everything the
 * engine can already resolve (JS natives we define, GlobalScripts we compile from
 * source, object methods, GML keywords), and ranks what is left by how often the
 * game actually calls it.
 *
 * This is the general health metric for "hand it any attack and it plays": a name
 * on this list is a capability the engine is missing, not a bug in one attack.
 *
 * Usage: node scripts/audit_natives.js [--top N] [--chapter N]
 */

const fs = require('fs');
const path = require('path');

const GML_ROOT = 'C:/Users/lando/Desktop/DELTARUNE - GML';
const DOCS = path.join(__dirname, '..', 'docs');
const JS = path.join(DOCS, 'js');

const argTop = (() => { const i = process.argv.indexOf('--top'); return i > 0 ? Number(process.argv[i + 1]) : 60; })();
const argChapter = (() => { const i = process.argv.indexOf('--chapter'); return i > 0 ? process.argv[i + 1] : null; })();

/** GML control-flow and operators that look like calls but aren't. */
const KEYWORDS = new Set([
  'if', 'while', 'for', 'switch', 'repeat', 'with', 'until', 'return', 'else', 'do',
  'case', 'var', 'globalvar', 'exit', 'break', 'continue', 'function', 'new', 'delete',
  'try', 'catch', 'throw', 'enum', 'static', 'and', 'or', 'not', 'xor', 'mod', 'div',
  'then', 'begin', 'end', 'constructor',
]);

function strip(src) {
  return src
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function readIf(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; }

// ── What the engine can already resolve ────────────────────────────────────
const known = new Set();
const knownFrom = new Map();
function learn(name, where) {
  if (!name) return;
  if (!known.has(name)) knownFrom.set(name, where);
  known.add(name);
}

// 1. JS natives: global.NAME = ... / def('NAME', ...) / 'NAME': in a stub list.
for (const f of ['gml_helpers.js', 'gml_runtime.js', 'gml_audio.js', 'gml_asset_db.js']) {
  const src = readIf(path.join(JS, f));
  for (const m of src.matchAll(/\bglobal\.([A-Za-z_]\w*)\s*=/g)) learn(m[1], f);
  for (const m of src.matchAll(/\bdef\(\s*'([A-Za-z_]\w*)'/g)) learn(m[1], f);
  for (const m of src.matchAll(/\bdef\(\s*"([A-Za-z_]\w*)"/g)) learn(m[1], f);
  // Bulk stub tables: STUBS = ['a','b',...] or a long quoted list of snake_case names.
  for (const m of src.matchAll(/'([a-z_][a-z0-9_]{3,})'\s*[,\]]/g)) learn(m[1], f + ' (list)');
}

// 2. Names the codegen maps to something itself.
{
  const src = readIf(path.join(JS, 'gml_codegen.js'));
  for (const m of src.matchAll(/case\s+'([A-Za-z_]\w*)'\s*:/g)) learn(m[1], 'gml_codegen.js');
  for (const m of src.matchAll(/'([a-z_][a-z0-9_]{3,})'/g)) learn(m[1], 'gml_codegen.js');
}

// 3. Every GlobalScript in the corpus compiles from source on demand, and every
//    function declared inside one is resolvable through the declared-function index.
for (let c = 1; c <= 5; c++) {
  const dir = path.join(GML_ROOT, `DELTARUNE Chapter ${c} - GML`);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith('gml_GlobalScript_')) continue;
    learn(f.replace(/^gml_GlobalScript_/, '').replace(/\.gml$/, ''), 'GlobalScript');
    const src = strip(readIf(path.join(dir, f)));
    for (const m of src.matchAll(/\bfunction\s+([A-Za-z_]\w*)\s*\(/g)) learn(m[1], 'GlobalScript fn');
  }
}

// 4. Methods/constructors declared inside objects are called on instances/structs.
for (let c = 1; c <= 5; c++) {
  const dir = path.join(GML_ROOT, `DELTARUNE Chapter ${c} - GML`);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith('gml_Object_')) continue;
    const src = strip(readIf(path.join(dir, f)));
    for (const m of src.matchAll(/\bfunction\s+([A-Za-z_]\w*)\s*\(/g)) learn(m[1], 'object fn');
    for (const m of src.matchAll(/([A-Za-z_]\w*)\s*=\s*function\s*\(/g)) learn(m[1], 'object fn');
  }
}

// ── What the corpus calls ──────────────────────────────────────────────────
const counts = new Map();
const example = new Map();

function tally(src, where) {
  for (const m of strip(src).matchAll(/(?:^|[^.\w])([a-z_][a-z0-9_]*)\s*\(/g)) {
    const name = m[1];
    if (KEYWORDS.has(name)) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
    if (!example.has(name)) example.set(name, where);
  }
}

// `--loaded` scores only the GML we actually SHIP (the extracted object events and
// scripts the studio can execute). That is the set which can break a running
// attack; the full corpus is dominated by save-file and room-layer code no fight
// ever reaches, which drowns out the gaps that matter.
if (process.argv.includes('--loaded')) {
  for (const f of ['gml_objects.js', 'gml_scripts.js']) {
    const src = readIf(path.join(JS, f));
    // The tables are JSON-ish: GML lives in JSON string literals, so unescape.
    for (const m of src.matchAll(/"((?:[^"\\]|\\.){40,})"/g)) {
      let gml;
      try { gml = JSON.parse('"' + m[1] + '"'); } catch (e) { continue; }
      tally(gml, f);
    }
  }
} else {
  for (let c = 1; c <= 5; c++) {
    if (argChapter && String(c) !== String(argChapter)) continue;
    const dir = path.join(GML_ROOT, `DELTARUNE Chapter ${c} - GML`);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.gml')) continue;
      tally(readIf(path.join(dir, f)), `ch${c}/${f.replace('gml_Object_', '').replace('gml_GlobalScript_', '')}`);
    }
  }
}

const missing = [...counts.entries()]
  .filter(([n]) => !known.has(n))
  .sort((a, b) => b[1] - a[1]);

const totalCalls = [...counts.values()].reduce((a, b) => a + b, 0);
const missingCalls = missing.reduce((a, [, n]) => a + n, 0);

console.log(`distinct functions called in the corpus: ${counts.size}`);
console.log(`resolvable by the engine:                ${counts.size - missing.length}`);
console.log(`NOT resolvable:                          ${missing.length}`);
console.log(`call-site coverage:                      ${(100 * (1 - missingCalls / totalCalls)).toFixed(3)}% of ${totalCalls} calls\n`);
console.log(`── top ${Math.min(argTop, missing.length)} unimplemented, by call count ──`);
for (const [name, n] of missing.slice(0, argTop)) {
  console.log(`  ${String(n).padStart(5)}  ${name.padEnd(38)} e.g. ${example.get(name)}`);
}

if (process.argv.includes('--json')) {
  fs.writeFileSync(
    path.join(__dirname, '..', 'docs', 'js', 'native_gaps.json'),
    JSON.stringify(missing.map(([name, n]) => ({ name, calls: n, example: example.get(name) })), null, 1)
  );
  console.log('\nwrote docs/js/native_gaps.json');
}
