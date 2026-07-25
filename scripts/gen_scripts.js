/**
 * gen_scripts.js — extract the GlobalScript sources the presets actually call.
 *
 * `scr_afterimage_cut`, `scr_sneo_wall_create`, `d_ex`, `remap_clamped` and
 * friends were being stubbed or returning 0. They are ordinary GML in the export,
 * so compiling them is strictly more accurate than hand-approximating them.
 *
 * Walks the call graph from every preset event, transitively, and writes the
 * sources per chapter into docs/js/gml_scripts.js.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GML_ROOT = 'C:/Users/lando/Desktop/DELTARUNE - GML';
const DOCS_JS = path.join(__dirname, '..', 'docs', 'js');
const OUT = path.join(DOCS_JS, 'gml_scripts.js');

const CHAPTERS = { ch1: 1, ch2: 2, ch3: 3, ch4: 4, ch5: 5 };

// ── index every GlobalScript per chapter ────────────────────────────────────
// TWO indexes per chapter: file-name -> path, and FUNCTION-name -> file-name.
// One file often declares several functions (ossafe_shapes.gml declares
// d_triangle and friends; scr_shop_vending.gml declares the vending_*
// constructors; scr_complete_save_file.gml declares
// scr_get_knight_total_attempts). Resolving called names only against file
// names silently lost every one of those.
const scriptsByChapter = {};
const funcIndexByChapter = {};
for (const [key, n] of Object.entries(CHAPTERS)) {
  const dir = path.join(GML_ROOT, `DELTARUNE Chapter ${n} - GML`);
  if (!fs.existsSync(dir)) continue;
  const table = new Map();
  const funcIndex = new Map();
  for (const f of fs.readdirSync(dir)) {
    const m = /^gml_GlobalScript_(.+)\.gml$/.exec(f);
    if (!m) continue;
    const p = path.join(dir, f);
    table.set(m[1], p);
    const src = fs.readFileSync(p, 'utf8');
    const re = /^\s*function\s+([a-zA-Z_]\w*)\s*\(/gm;
    let fm;
    while ((fm = re.exec(src))) {
      if (!funcIndex.has(fm[1])) funcIndex.set(fm[1], m[1]);
    }
  }
  scriptsByChapter[key] = table;
  funcIndexByChapter[key] = funcIndex;
  console.log(`${key}: ${table.size} script files, ${funcIndex.size} declared functions`);
}

// ── which identifiers look like calls in a chunk of GML ─────────────────────
function calledNames(src) {
  // Strip strings and comments first; DELTARUNE dialogue is full of punctuation.
  const clean = src
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Set();
  const re = /\b([a-zA-Z_]\w*)\s*\(/g;
  let m;
  while ((m = re.exec(clean))) out.add(m[1]);
  return out;
}

// ── load presets to find the roots ──────────────────────────────────────────
const sandbox = { console, window: null };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(DOCS_JS, 'gml_presets.js'), 'utf8'), sandbox);
const presets = sandbox.window.GML_MASTER_PRESETS;

/** Chapter a preset belongs to, from its label. */
function chapterOf(p) {
  const m = /Chapter\s*([1-5])/i.exec(p.label || '');
  return m ? 'ch' + m[1] : 'ch3';
}

const roots = {};
for (const [key, p] of Object.entries(presets)) {
  const ch = chapterOf(p);
  roots[ch] = roots[ch] || new Set();
  for (const ev of ['create', 'step', 'draw']) {
    if (typeof p[ev] === 'string') for (const n of calledNames(p[ev])) roots[ch].add(n);
  }
}

/**
 * The attack controllers and the object events they pull in are the real call
 * sites — rooting only from the preset table missed the scripts that
 * obj_dbulletcontroller calls (scr_enemy_animation, scr_getlaunchdirection, ...),
 * so those degraded to stubs returning 0 inside every Knight attack.
 */
{
  const objFile = path.join(DOCS_JS, 'gml_objects.js');
  if (fs.existsSync(objFile)) {
    const sb2 = { window: {} };
    vm.createContext(sb2);
    vm.runInContext(fs.readFileSync(objFile, 'utf8'), sb2);
    for (const [ch, table] of Object.entries(sb2.window.GML_OBJECT_EVENTS_BY_CHAPTER || {})) {
      roots[ch] = roots[ch] || new Set();
      for (const bundle of Object.values(table)) {
        for (const src of Object.values(bundle)) for (const n of calledNames(src)) roots[ch].add(n);
      }
    }
  }
}

/**
 * Non-mechanics subsystems the closure otherwise drags in. `scr_text` alone is
 * 616 KB of dialogue reachable because one attack calls a writer script. Pruned
 * scripts keep their existing behaviour — $R.miss resolves them on window and
 * degrades to 0 — so nothing regresses, we just don't ship the payload.
 */
const PRUNE = [
  // Only true non-battle bulk: dialogue printing and save handling. The info/
  // shop scripts came OFF this list — the ch4 arena furniture (obj_gerson_table
  // and the fountain vending machines) legitimately calls them.
  /^scr_text$/, /^scr_save/,
];
// 256KB: size caps keep silently deleting mechanics (scr_spearshot 25KB, then
// scr_monstersetup 118KB). Only the named PRUNE list may drop scripts.
// Previously: the old cap silently pruned scr_spearshot (25KB) — the script
// that IS Gerson's green-soul attack dispatcher — and every green attack
// degraded to a $R.miss returning 0 with no error. Only prune true junk by
// name; a size cap on mechanics scripts is a footgun.
const MAX_SCRIPT_BYTES = 256 * 1024;

// Scripts the attack roster names directly can NEVER be dropped, whatever
// their size.
const KEEP = new Set(['scr_spearshot', 'scr_spearpattern', 'scr_bulletspawner']);
{
  const attacksFile = path.join(DOCS_JS, 'gml_attacks.js');
  if (fs.existsSync(attacksFile)) {
    const sbA = { window: {} };
    vm.createContext(sbA);
    vm.runInContext(fs.readFileSync(attacksFile, 'utf8'), sbA);
    for (const a of sbA.window.GML_ATTACKS || []) {
      if (a.source && a.source.startsWith('scr_')) KEEP.add(a.source.split(' ')[0]);
    }
  }
}

const dropped = new Map();

function shouldPrune(name, size) {
  if (KEEP.has(name)) return false;
  if (PRUNE.some(re => re.test(name))) { dropped.set(name, `${(size / 1024).toFixed(1)}KB non-mechanics`); return true; }
  if (size > MAX_SCRIPT_BYTES) { dropped.set(name, `${(size / 1024).toFixed(1)}KB over cap`); return true; }
  return false;
}

// ── transitive closure over the call graph ──────────────────────────────────
const collected = {};
let totalBytes = 0;

for (const [ch, wanted] of Object.entries(roots)) {
  const table = scriptsByChapter[ch];
  if (!table) continue;
  const funcIndex = funcIndexByChapter[ch] || new Map();
  const out = {};
  const queue = [...wanted];
  const seen = new Set();
  const seenFiles = new Set();

  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    // Resolve to a FILE: by file name, else by the function index.
    const fileKey = table.has(name) ? name : funcIndex.get(name);
    if (!fileKey || seenFiles.has(fileKey)) continue;
    const file = table.get(fileKey);
    if (!file) continue;
    seenFiles.add(fileKey);
    const src = fs.readFileSync(file, 'utf8');
    // Prune before traversing, so a pruned script's own dependencies don't
    // leak in either.
    if (shouldPrune(fileKey, src.length)) continue;
    out[fileKey] = src;
    totalBytes += src.length;
    for (const n of calledNames(src)) if (!seen.has(n)) queue.push(n);
  }

  collected[ch] = out;
  console.log(`${ch}: ${Object.keys(out).length} script files reachable from ${wanted.size} call sites`);
}

// ── emit ────────────────────────────────────────────────────────────────────
let src = `/**
 * gml_scripts.js — GENERATED by scripts/gen_scripts.js. Do not edit.
 *
 * GlobalScript sources reachable from the attack presets, per chapter. These get
 * compiled by GMLTranslator.compileScripts() into \`$R.scr\`, so a call like
 * \`scr_afterimage_cut()\` runs the real GML instead of a stub that returns 0.
 *
 * Chapter matters: the same script name can differ between chapters.
 */
window.GML_SCRIPT_SOURCES_BY_CHAPTER = {
`;
for (const [ch, table] of Object.entries(collected)) {
  src += `  ${ch}: {\n`;
  for (const [name, code] of Object.entries(table)) {
    src += `    ${JSON.stringify(name)}: ${JSON.stringify(code)},\n`;
  }
  src += `  },\n`;
}
src += `};

/** Default table, used when no chapter is known. */
window.GML_SCRIPT_SOURCES = window.GML_SCRIPT_SOURCES_BY_CHAPTER.ch3 || {};
`;

fs.writeFileSync(OUT, src, 'utf8');
console.log(`\nwrote ${OUT} (${(src.length / 1024).toFixed(1)} KB, ${(totalBytes / 1024).toFixed(1)} KB of GML)`);

if (dropped.size) {
  console.log(`\npruned ${dropped.size} scripts (still resolved at runtime via $R.miss, as before):`);
  for (const [name, why] of [...dropped.entries()].sort()) console.log(`  ${name} — ${why}`);
}
