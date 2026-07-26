/**
 * audit_fight_natives.js — native gaps SCOPED TO WHAT REAL FIGHTS REACH.
 *
 * audit_natives.js scores the whole corpus, which is dominated by overworld,
 * save-game and room code no battle ever touches. This walks the other way:
 *
 *   1. seed with the enemy + controller of every gml_attacks.js entry with
 *      inFight true (194 attacks / 20 fights), plus the objects named in each
 *      attack's `setup`, box setup and turn setup, plus the battle-system
 *      objects the studio always spawns (heart, battlecontroller, darkener...).
 *   2. walk transitively through the code the engine ACTUALLY SHIPS AND RUNS —
 *      window.GML_OBJECT_EVENTS_BY_CHAPTER and
 *      window.GML_SCRIPT_SOURCES_BY_CHAPTER — following obj_* references
 *      (instance_create / instance_create_depth / with / raw refs) and script
 *      calls.
 *   3. slice the shared attack controllers by `type`, so obj_dbulletcontroller's
 *      3000-line switch only contributes the branches a real fight selects.
 *   4. tally every function call in that closure and subtract everything the
 *      engine can really resolve: functions that exist on `window` after the
 *      engine loads, compiled GlobalScripts, and object-declared methods.
 *
 * Anything left is a function a REAL FIGHT calls that returns 0.
 *
 * Usage: node scripts/audit_fight_natives.js [--all] [--json]
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOCS_JS = path.join(__dirname, '..', 'docs', 'js');
const GML_ROOT = 'C:/Users/lando/Desktop/DELTARUNE - GML';

// ───────────────────────────────────────────────────────────────────────────
// 1. Load the engine for real, so "implemented" means "is a callable global".
// ───────────────────────────────────────────────────────────────────────────
function loadEngine() {
  const sb = {};
  sb.window = sb;
  sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  sb.document = {
    createElement: () => ({
      getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
      style: {}, width: 0, height: 0, addEventListener() {},
    }),
    addEventListener() {}, body: { appendChild() {} },
  };
  sb.navigator = { userAgent: 'node' };
  sb.requestAnimationFrame = () => 0;
  sb.setTimeout = setTimeout; sb.setInterval = () => 0; sb.clearInterval = () => {};
  sb.Image = function () {}; sb.AudioContext = function () {};
  sb.performance = { now: () => 0 };
  vm.createContext(sb);
  for (const f of ['gml_compiler.js', 'gml_codegen.js', 'gml_runtime.js', 'gml_helpers.js',
    'gml_audio.js', 'gml_asset_db.js', 'gml_translator.js',
    'gml_attacks.js', 'gml_objects.js', 'gml_scripts.js', 'gml_object_index.js']) {
    const p = path.join(DOCS_JS, f);
    if (!fs.existsSync(p)) continue;
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), sb, { filename: f }); }
    catch (e) { console.error(`!! ${f}: ${e.message}`); }
  }
  return sb;
}

const W = loadEngine();

/** Names that are callable on window right now = genuinely implemented. */
const IMPLEMENTED = new Set(
  Object.getOwnPropertyNames(W).filter(k => typeof W[k] === 'function')
);
const BUILTIN_FNS = W.GML_BUILTIN_FNS || new Set();

/** Names the codegen rewrites itself, so the global never has to exist. */
const CODEGEN_SPECIAL = new Set();
{
  const cg = fs.readFileSync(path.join(DOCS_JS, 'gml_codegen.js'), 'utf8');
  // genCall's `switch (name)` arms — every `case 'foo':` inside the call
  // generator becomes an inline rewrite, not a global lookup.
  const start = cg.indexOf('genCall(');
  const body = start > 0 ? cg.slice(start, start + 40000) : cg;
  for (const m of body.matchAll(/case\s+'([a-z_][a-z0-9_]*)'\s*:/g)) CODEGEN_SPECIAL.add(m[1]);
  for (const m of cg.matchAll(/SPECIAL_FNS\s*=\s*new Set\(\[([\s\S]*?)\]\)/g)) {
    for (const q of m[1].matchAll(/'([^']+)'/g)) CODEGEN_SPECIAL.add(q[1]);
  }
}

const KEYWORDS = new Set([
  'if', 'while', 'for', 'switch', 'repeat', 'with', 'until', 'return', 'else', 'do',
  'case', 'var', 'globalvar', 'exit', 'break', 'continue', 'function', 'new', 'delete',
  'try', 'catch', 'throw', 'enum', 'static', 'and', 'or', 'not', 'xor', 'mod', 'div',
  'then', 'begin', 'end', 'constructor', 'default', 'self', 'other', 'all', 'noone',
]);

// ───────────────────────────────────────────────────────────────────────────
// 2. The shipped code tables — this is the universe that can execute.
// ───────────────────────────────────────────────────────────────────────────
const OBJ_EVENTS = W.GML_OBJECT_EVENTS_BY_CHAPTER || {};
const SCRIPTS = W.GML_SCRIPT_SOURCES_BY_CHAPTER || {};
const ATTACKS = (W.GML_ATTACKS || []).filter(a => a.inFight);
const BOXSETUP = W.GML_ATTACKS_BOXSETUP || {};
const TURNSETUP = W.GML_ATTACKS_TURNSETUP || {};

function strip(src) {
  return String(src)
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Objects whose OWN EVENT CODE this source causes to run.
 *
 * Merely NAMING an object does not run it: `i_ex(obj_heart)`,
 * `place_meeting(x, y, obj_battlesolid)` and `depth = obj_x.depth` are queries.
 * Only creation (and `with`, whose body can fire the target's user events) puts
 * another object's code on the execution path. Walking every mention instead —
 * which is what gen_objects.js does, deliberately, so it can SHIP the code —
 * drags the closure through obj_savemenu, obj_time and half the overworld.
 */
const SPAWN_CALLS = {
  instance_create: 2, instance_create_depth: 3, instance_create_layer: 3,
  scr_bulletspawner: 2, scr_fire_bullet: 2, instance_change: 0, instance_copy: 0,
  scr_dark_marker: 2,
};
function spawnRefs(src) {
  const out = new Set();
  const clean = strip(src);
  for (const [fn, pos] of Object.entries(SPAWN_CALLS)) {
    const re = new RegExp(`\\b${fn}\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(clean))) {
      // split the argument list at top-level commas
      let i = m.index + m[0].length, depth = 0, cur = '', args = [];
      for (; i < clean.length; i++) {
        const c = clean[i];
        if (c === '(' || c === '[') depth++;
        else if (c === ')' && depth === 0) break;
        else if (c === ')' || c === ']') depth--;
        if (c === ',' && depth === 0) { args.push(cur); cur = ''; continue; }
        cur += c;
      }
      args.push(cur);
      const a = (args[pos] || '').trim();
      const om = /^(obj_[A-Za-z0-9_]+|o_[A-Za-z0-9_]+)$/.exec(a);
      if (om) out.add(om[1]);
    }
  }
  // `with (obj_x)` does NOT create anything — it iterates instances that already
  // exist, and its BODY is part of this source (already tallied). The target's
  // own event code only runs if the body dispatches one. Treating every `with`
  // as an edge is what dragged obj_darkcontroller / obj_time / obj_savemenu into
  // the closure: obj_shootout_controller's Create has
  //   if (!i_ex(obj_tenna_enemy)) { with (obj_darkcontroller) ... }
  // — a branch that is false in the real fight, on an instance the studio never
  // spawns. So only follow a `with` whose body dispatches an event.
  for (const m of clean.matchAll(/\bwith\s*\(\s*(obj_[A-Za-z0-9_]+|o_[A-Za-z0-9_]+)\s*\)\s*(\{[\s\S]{0,4000}?\}|[^\n;]*;)/g)) {
    if (/\bevent_(user|perform|inherited)\s*\(/.test(m[2])) out.add(m[1]);
  }
  return out;
}

function callNames(src) {
  const out = [];
  for (const m of strip(src).matchAll(/(?:^|[^.\w])([a-z_][a-z0-9_]*)\s*\(/g)) {
    if (!KEYWORDS.has(m[1])) out.push(m[1]);
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Type slicing for the shared attack controllers.
// ───────────────────────────────────────────────────────────────────────────
/** The controller objects whose whole behaviour is one big `type` switch. */
const TYPED_CONTROLLERS = process.argv.includes('--noslice')
  ? new Set()
  : new Set(ATTACKS.map(a => a.controller).filter(Boolean));

/**
 * Keep only the parts of `src` a fight with these `type` values can enter.
 * Conservative: any top-level `if`/`else if` whose condition does not consist
 * purely of decidable `type <op> literal` comparisons is KEPT.
 */
function sliceByType(src, types) {
  const lines = src.split('\n');
  const keep = new Array(lines.length).fill(true);
  // Work on the raw text with a brace scanner.
  let depth = 0;
  let i = 0;
  const text = src;
  const lineOf = [];
  { let ln = 0; for (let k = 0; k < text.length; k++) { lineOf[k] = ln; if (text[k] === '\n') ln++; } }

  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') { i++; while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; i++; } i++; continue; }
    if (ch === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') { depth--; i++; continue; }
    if (depth === 0 && /[a-z]/.test(ch)) {
      const m = /^(?:else\s+)?if\s*\(/.exec(text.slice(i, i + 20));
      const prevCh = i > 0 ? text[i - 1] : '\n';
      if (m && !/[\w.]/.test(prevCh)) {
        // read the condition
        let j = i + m[0].length, par = 1;
        while (j < text.length && par > 0) { if (text[j] === '(') par++; else if (text[j] === ')') par--; j++; }
        const cond = text.slice(i + m[0].length, j - 1);
        const verdict = evalTypeCond(cond, types);
        // find the statement body that follows
        let k = j;
        while (k < text.length && /\s/.test(text[k])) k++;
        let end;
        if (text[k] === '{') {
          let d2 = 0;
          end = k;
          do { if (text[end] === '{') d2++; else if (text[end] === '}') d2--; end++; } while (end < text.length && d2 > 0);
        } else {
          end = text.indexOf(';', k);
          end = end < 0 ? text.length : end + 1;
        }
        if (verdict === false) {
          for (let p = i; p < end && p < text.length; p++) keep[lineOf[p]] = false;
        }
        i = end;
        continue;
      }
    }
    i++;
  }
  return lines.filter((_, n) => keep[n]).join('\n');
}

/**
 * true  — reachable, false — provably unreachable for these types,
 * null  — undecidable (treated as reachable).
 */
function evalTypeCond(cond, types) {
  const c = cond.replace(/\s+/g, ' ').trim();
  if (!/\btype\b/.test(c)) return null;
  // Only decide conditions built from `type <cmp> <number>` joined by || / &&
  // where every term mentions type. Anything else stays.
  const terms = c.split(/\|\||&&|\bor\b|\band\b/);
  let anyTrue = false;
  for (const t of terms) {
    const m = /^\s*\(*\s*type\s*(==|=|>=|<=|>|<|!=)\s*(-?[\d.]+)\s*\)*\s*$/.exec(t);
    if (!m) return null;                       // undecidable term -> keep
    const v = parseFloat(m[2]);
    const hit = [...types].some(ty => {
      switch (m[1]) {
        case '==': case '=': return ty === v;
        case '!=': return ty !== v;
        case '>=': return ty >= v;
        case '<=': return ty <= v;
        case '>': return ty > v;
        case '<': return ty < v;
      }
      return true;
    });
    if (hit) anyTrue = true;
  }
  // With || between terms this is exact; with && it over-approximates, which is
  // the safe direction (we keep more code than we must).
  return anyTrue ? true : false;
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Walk.
// ───────────────────────────────────────────────────────────────────────────

/** Objects the studio spawns for every fight regardless of the boss. */
const ALWAYS_LIVE = [
  'obj_heart', 'obj_grazebox', 'obj_battlecontroller', 'obj_darkener',
  'obj_growtangle', 'obj_returnheart', 'obj_moveheart', 'obj_whiteedge',
  'obj_bulletparent', 'obj_bulletgenparent',
];

/** chapter -> Set of type values any in-fight attack of that chapter selects. */
const typesByChapterController = new Map();
for (const a of ATTACKS) {
  const key = a.chapter + '|' + a.controller;
  if (!typesByChapterController.has(key)) typesByChapterController.set(key, new Set());
  if (a.type !== null && a.type !== undefined) typesByChapterController.get(key).add(Number(a.type));
  // extraFields can carry a second selector (e.g. `special`).
  for (const f of a.extraFields || []) {
    if (f && f.name === 'type' && typeof f.value === 'number') {
      typesByChapterController.get(key).add(f.value);
    }
  }
  // Any `X.type = N` in the setup branch is a type this fight also spawns.
  for (const m of strip(a.setup || '').matchAll(/\.type\s*=\s*(-?[\d.]+)/g)) {
    typesByChapterController.get(key).add(parseFloat(m[1]));
  }
}

/** For each chapter: reached objects, reached scripts, per-name call tallies. */
const results = {};

for (const chapter of Object.keys(OBJ_EVENTS)) {
  const chAttacks = ATTACKS.filter(a => a.chapter === chapter);
  if (!chAttacks.length) continue;

  const objTable = OBJ_EVENTS[chapter] || {};
  const scrTable = SCRIPTS[chapter] || {};

  // Which function names resolve to a compiled script this chapter.
  const scriptNames = new Set(Object.keys(scrTable));
  const fnFile = new Map();
  for (const [fileKey, src] of Object.entries(scrTable)) {
    for (const m of src.matchAll(/^\s*function\s+([A-Za-z_]\w*)\s*\(/gm)) {
      scriptNames.add(m[1]);
      if (!fnFile.has(m[1])) fnFile.set(m[1], fileKey);
    }
  }
  // Methods objects declare on themselves (resolved via $R.miss -> self).
  const methodNames = new Set();
  for (const bundle of Object.values(objTable)) {
    for (const src of Object.values(bundle)) {
      for (const m of String(src).matchAll(/\bfunction\s+([A-Za-z_]\w*)\s*\(/g)) methodNames.add(m[1]);
      for (const m of String(src).matchAll(/\b(?:static\s+)?([A-Za-z_]\w*)\s*=\s*function\b/g)) methodNames.add(m[1]);
    }
  }

  // types selected in this chapter, per controller
  const typesFor = ctrl => typesByChapterController.get(chapter + '|' + ctrl) || new Set();

  const seenObj = new Map();   // name -> "why" (path back to a seed)
  const seenScr = new Map();
  const objQueue = [];
  const scrQueue = [];
  /** call name -> { n, where: Set } */
  const calls = new Map();
  const tally = (name, where) => {
    if (!calls.has(name)) calls.set(name, { n: 0, where: new Set() });
    const e = calls.get(name);
    e.n++;
    if (e.where.size < 8) e.where.add(where);
  };

  const pushObj = (n, why) => { if (n && !seenObj.has(n)) { seenObj.set(n, why); objQueue.push(n); } };
  const pushScr = (n, why) => {
    const file = scrTable[n] !== undefined ? n : fnFile.get(n);
    if (file && !seenScr.has(file)) { seenScr.set(file, why); scrQueue.push(file); }
  };

  // ── seeds ──
  // The studio spawns the boss and the attack controller, replays each boss's
  // box-setup block and each attack's dispatcher branch, then steps. It NULLS
  // the boss's own Step (gml_studio.html: `if (objName !== b.name) boss.step =
  // null;`), so the boss contributes Create / Draw / alarms / user events only.
  const BOSS_OBJECTS = new Set(chAttacks.map(a => a.enemy));
  const seedSrc = [];
  for (const a of chAttacks) {
    pushObj(a.enemy, `boss of ${a.boss}`);
    pushObj(a.controller, `controller of ${a.boss}/${a.name}`);
    if (a.setup) seedSrc.push([`setup:${a.boss}/${a.name}`, a.setup]);
  }
  for (const boss of new Set(chAttacks.map(a => a.boss))) {
    if (BOXSETUP[boss]) seedSrc.push([`boxsetup:${boss}`, String(BOXSETUP[boss].code || BOXSETUP[boss])]);
    if (TURNSETUP[boss]) seedSrc.push([`turnsetup:${boss}`, String(TURNSETUP[boss].code || TURNSETUP[boss])]);
  }
  for (const n of ALWAYS_LIVE) pushObj(n, 'battle furniture the studio always spawns');
  for (const [where, src] of seedSrc) {
    for (const n of spawnRefs(src)) pushObj(n, where);
    for (const n of callNames(src)) { tally(n, where); pushScr(n, where); }
  }

  // ── BFS ──
  let guard = 0;
  while ((objQueue.length || scrQueue.length) && guard++ < 200000) {
    if (objQueue.length) {
      const name = objQueue.shift();
      const bundle = objTable[name];
      if (!bundle) continue;                     // not shipped -> cannot execute
      const sliced = TYPED_CONTROLLERS.has(name) && typesFor(name).size;
      for (const [ev, rawSrc] of Object.entries(bundle)) {
        if (typeof rawSrc !== 'string') continue;
        if (BOSS_OBJECTS.has(name) && ev === 'step') continue;   // studio nulls it
        const src = sliced ? sliceByType(rawSrc, typesFor(name)) : rawSrc;
        for (const n of spawnRefs(src)) pushObj(n, `${name}.${ev}`);
        for (const n of callNames(src)) { tally(n, `${name}.${ev}`); pushScr(n, `${name}.${ev}`); }
      }
      for (const k of Object.keys(bundle)) if (k.startsWith('collision:')) pushObj(k.slice(10), `${name} collision`);
      continue;
    }
    const fileKey = scrQueue.shift();
    const src = scrTable[fileKey];
    if (typeof src !== 'string') continue;
    for (const n of spawnRefs(src)) pushObj(n, `scr:${fileKey}`);
    for (const n of callNames(src)) { tally(n, `scr:${fileKey}`); pushScr(n, `scr:${fileKey}`); }
  }

  results[chapter] = { seenObj, seenScr, calls, scriptNames, methodNames, objTable };
}

// ───────────────────────────────────────────────────────────────────────────
// 5. Ask the REAL COMPILER what it can resolve.
//
// A regex tally over-reports badly: `var _copyfunc = other.script; _copyfunc()`
// in obj_script_delayed's Other_10 looks like an unknown function but compiles
// to `$R.vcall(_copyfunc, ...)` and works. So compile every reachable event and
// script with GMLTranslator and read the verdict off the emitted JS:
//
//   $R.miss("name", ...)   -> nothing resolves it; returns 0 at runtime
//   name(...) / name.call  -> a direct global call; if the name has no
//                             implementation, ensureBuiltins() replaced it with
//                             a stub that returns 0 (gml_helpers.js:642-648)
// ───────────────────────────────────────────────────────────────────────────
const UNIMPL_BUILTIN = new Set([...BUILTIN_FNS].filter(n => !IMPLEMENTED.has(n) && !CODEGEN_SPECIAL.has(n)));

const overall = new Map();   // name -> { n, chapters:Set, where:Set, kind }
let totalCalls = 0, unresolvedCalls = 0;

const translator = new W.GMLTranslator(null);

function record(name, chapter, where, kind) {
  unresolvedCalls++;
  if (!overall.has(name)) overall.set(name, { n: 0, chapters: new Set(), where: new Set(), kind });
  const o = overall.get(name);
  o.n++;
  o.chapters.add(chapter);
  if (o.where.size < 12) o.where.add(`${chapter}:${where}`);
}

/**
 * $R.miss is NOT automatically a failure: it resolves against `self` first
 * (gml_helpers.js:1060-1071), which is exactly how GML 2.3 instance/struct
 * methods work — `fnc_make_node()` inside obj_purplecontrols finds the
 * `fnc_make_node = function(...)` that object declared in its own Create. Use
 * the translator's own method index (the same one the codegen uses to decide
 * whether to warn) so only calls that resolve to NOTHING are reported.
 */
function isMethodName(chapter, name) {
  return translator.methodNames(chapter).has(name) || translator.scriptNames(chapter).has(name);
}

/** Read unresolved calls out of one emitted JS blob. */
function scanEmitted(code, chapter, where) {
  for (const m of code.matchAll(/\$R\.miss\(\s*"((?:[^"\\]|\\.)*)"/g)) {
    const name = JSON.parse('"' + m[1] + '"');
    if (isMethodName(chapter, name)) continue;
    record(name, chapter, where, 'miss');
  }
  for (const name of UNIMPL_BUILTIN) {
    const re = new RegExp(`(?:^|[^.\\w$])${name}\\s*(?:\\.call)?\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(code))) record(name, chapter, where, 'stub');
  }
  totalCalls += (code.match(/\w\(/g) || []).length;
}

for (const [chapter, r] of Object.entries(results)) {
  const objTable = OBJ_EVENTS[chapter] || {};
  const scrTable = SCRIPTS[chapter] || {};
  const BOSS_OBJECTS = new Set(ATTACKS.filter(a => a.chapter === chapter).map(a => a.enemy));

  for (const name of r.seenObj.keys()) {
    const bundle = objTable[name];
    if (!bundle) continue;
    const events = { chapter };
    const sliced = TYPED_CONTROLLERS.has(name) && (typesByChapterController.get(chapter + '|' + name) || new Set()).size;
    for (const [ev, src] of Object.entries(bundle)) {
      if (typeof src !== 'string') continue;
      if (BOSS_OBJECTS.has(name) && ev === 'step') continue;
      events[ev] = sliced ? sliceByType(src, typesByChapterController.get(chapter + '|' + name)) : src;
    }
    let c;
    try { c = translator.compileObject(name, events); } catch (e) { continue; }
    scanEmitted(c.code, chapter, name);
  }

  const known = translator.scriptNames(chapter);
  for (const fileKey of r.seenScr.keys()) {
    const src = scrTable[fileKey];
    if (typeof src !== 'string') continue;
    let parsed;
    try { parsed = W.GML_PARSE(src); } catch (e) { continue; }
    const decls = parsed.ast.body.filter(s => s && s.type === 'FunctionDecl' && s.name);
    const errs = [];
    const units = [];
    try {
      if (decls.length) {
        for (const d of decls) units.push(translator._emitScript(d.name, d.params, d.body.body, parsed, known, chapter, src, errs));
      } else {
        units.push(translator._emitScript(fileKey, [], parsed.ast.body, parsed, known, chapter, src, errs));
      }
    } catch (e) { continue; }
    scanEmitted(units.filter(Boolean).join('\n'), chapter, `scr:${fileKey}`);
  }
}

const chapters = Object.keys(results);

/** Trace a reached object/script back to a seed. */
function why(chapter, node) {
  const r = results[chapter];
  const out = [];
  let cur = node;
  for (let i = 0; i < 30; i++) {
    const w = r.seenObj.has(cur) ? r.seenObj.get(cur)
      : r.seenScr.has(cur) ? r.seenScr.get(cur)
        : (r.seenScr.has(cur.replace(/^scr:/, '')) ? r.seenScr.get(cur.replace(/^scr:/, '')) : null);
    if (!w) break;
    out.push(`${cur}  <-  ${w}`);
    const m = /^(?:scr:)?([A-Za-z_]\w*)(?:\.\w+)?$/.exec(w.replace(/^scr:/, ''));
    const next = w.startsWith('scr:') ? w.slice(4) : (m ? w.split('.')[0] : null);
    if (!next || next === cur) break;
    cur = next;
  }
  return out;
}

if (process.argv.includes('--why')) {
  const target = process.argv[process.argv.indexOf('--why') + 1];
  for (const ch of chapters) {
    const r = results[ch];
    if (!r.seenObj.has(target) && !r.seenScr.has(target)) continue;
    console.log(`\n[${ch}] ${target}`);
    for (const line of why(ch, target)) console.log('   ' + line);
  }
  process.exit(0);
}

console.log(`in-fight attacks: ${ATTACKS.length} across ${new Set(ATTACKS.map(a => a.boss)).size} fights`);
for (const ch of chapters) {
  const r = results[ch];
  const withCode = [...r.seenObj.keys()].filter(n => r.objTable[n]).length;
  console.log(`  ${ch}: ${r.seenObj.size} objects reached (${withCode} with shipped code), ${r.seenScr.size} scripts reached, ${r.calls.size} distinct functions called`);
}
console.log(`\ncompiled call sites in the reachable closure: ${totalCalls}`);
console.log(`resolve to 0 at runtime:                     ${unresolvedCalls}`);
console.log(`distinct unresolvable names:                 ${overall.size}\n`);

const sorted = [...overall.entries()].sort((a, b) => b[1].n - a[1].n);
const limit = process.argv.includes('--all') ? sorted.length : 80;
console.log(`── functions a REAL FIGHT calls that return 0 ──`);
console.log(`  calls  name                                   how              chapters   call sites`);
for (const [name, o] of sorted.slice(0, limit)) {
  console.log(
    `  ${String(o.n).padStart(5)}  ${name.padEnd(38)} ${(o.kind === 'stub' ? 'builtin stub->0' : '$R.miss->0').padEnd(16)} ${[...o.chapters].sort().join(',').padEnd(10)} ${[...o.where].slice(0, 4).join('  ')}`
  );
}

if (process.argv.includes('--json')) {
  const out = sorted.map(([name, o]) => ({
    name, calls: o.n, kind: o.kind,
    chapters: [...o.chapters].sort(), where: [...o.where],
  }));
  const p = path.join(__dirname, '..', 'docs', 'js', 'fight_native_gaps.json');
  fs.writeFileSync(p, JSON.stringify(out, null, 1));
  console.log(`\nwrote ${p}`);
}

// --callers NAME : which reachable objects/scripts call NAME (for verification)
if (process.argv.includes('--callers')) {
  const target = process.argv[process.argv.indexOf('--callers') + 1];
  const re = new RegExp('(?:^|[^.\\w])' + target + '\\s*\\(');
  for (const [chapter, r] of Object.entries(results)) {
    const objTable = OBJ_EVENTS[chapter] || {}, scrTable = SCRIPTS[chapter] || {};
    for (const n of r.seenObj.keys()) {
      const b = objTable[n]; if (!b) continue;
      for (const [ev, src] of Object.entries(b)) if (typeof src === 'string' && re.test(strip(src))) console.log(`${chapter}  ${n}.${ev}`);
    }
    for (const f of r.seenScr.keys()) {
      const src = scrTable[f];
      if (typeof src === 'string' && re.test(strip(src))) console.log(`${chapter}  scr:${f}`);
    }
  }
}
