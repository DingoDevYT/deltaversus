/**
 * test_attacks.js — run the REAL attack roster, not the object pile.
 *
 * An attack is a controller object plus a `type` (see scripts/gen_attacks.js).
 * This spawns each one the way its boss does — boss present, box sized, party
 * present, controller created via scr_bulletspawner semantics with `.type` set —
 * and reports whether it actually produces bullets and survives.
 *
 *   node scripts/test_attacks.js            summary
 *   node scripts/test_attacks.js -v         per-attack detail
 *   node scripts/test_attacks.js <id>       one attack, frame by frame
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '..', 'docs', 'js');
const GML_ROOT = 'C:/Users/lando/Desktop/DELTARUNE - GML';

function fakeCtx() {
  const n = () => {};
  return { save: n, restore: n, translate: n, rotate: n, scale: n, drawImage: n,
    fillRect: n, strokeRect: n, clearRect: n, beginPath: n, closePath: n, moveTo: n,
    lineTo: n, arc: n, fill: n, stroke: n, clip: n, fillText: n, strokeText: n,
    measureText: () => ({ width: 8 }), setTransform: n, transform: n, rect: n,
    ellipse: n, quadraticCurveTo: n, createLinearGradient: () => ({ addColorStop: n }),
    getImageData: () => ({ data: new Uint8Array(4) }), putImageData: n,
    globalAlpha: 1, globalCompositeOperation: 'source-over', canvas: { width: 640, height: 480 },
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '' };
}

const sb = { console, Math, JSON, Number, String, Boolean, Array, Object, Map, Set,
  WeakMap, WeakSet, parseInt, parseFloat, isNaN, isFinite, Date, RegExp, Error,
  TypeError, Uint8Array, setTimeout: () => 0, clearTimeout: () => {},
  performance: { now: () => Date.now() } };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
sb.document = { createElement: () => ({ getContext: () => fakeCtx(), width: 0, height: 0 }), getElementById: () => null };
sb.Image = function () { this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; };
vm.createContext(sb);
const load = f => vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), sb, { filename: f });
for (const f of ['gml_object_index.js', 'sprite_origins.js', 'sprite_manifest.js',
  'gml_asset_db.js', 'gml_runtime.js', 'gml_helpers.js', 'gml_compiler.js',
  'gml_codegen.js', 'gml_translator.js', 'gml_presets.js', 'gml_scripts.js',
  'gml_objects.js', 'gml_attacks.js']) load(f);

const W = sb.window;
const ATTACKS = W.GML_ATTACKS || [];
const verbose = process.argv.includes('-v');
const only = process.argv.slice(2).find(a => !a.startsWith('-'));

// ── compile everything once per chapter ────────────────────────────────────
const presets = W.GML_MASTER_PRESETS || {};
const presetNames = new Set(Object.entries(presets).map(([k, p]) => p.name || k));
const chapters = [...new Set(ATTACKS.map(a => a.chapter))];

// Each generated class is PARSED once into a factory `(GMLInstance, runtime) => Class`
// and then called per runtime. Re-parsing 190 classes for each of 33 attacks is
// what made the naive version take minutes; parsing is the expensive part,
// invoking the factory is not.
const perChapter = {};
{
  const t = new W.GMLTranslator(null);
  for (const ch of chapters) {
    const scripts = t.compileScripts(ch);
    let scriptFactory = null;
    try { scriptFactory = vm.runInContext(`(function(runtime){${scripts.code}})`, sb); }
    catch (e) { console.log(`${ch}: script bundle is not valid JS — ${e.message}`); }

    const support = t.compileSupportObjects(ch, presetNames);
    const factories = [];
    let broken = 0;
    for (const u of support.units) {
      try {
        factories.push([u.objectName, vm.runInContext(
          `(function(GMLInstance,runtime){${u.code}\n;return ${u.objectName};})`, sb)]);
      } catch (e) { broken++; if (verbose) console.log(`  ! ${ch} ${u.objectName}: ${e.message}`); }
    }
    for (const [k, p] of Object.entries(presets)) {
      const m = /Chapter\s*([1-5])/i.exec(p.label || '');
      if (('ch' + (m ? m[1] : '3')) !== ch) continue;
      const n = p.name || k;
      if (factories.some(f => f[0] === n)) continue;   // extracted GML already wins
      try {
        const code = t.compileObject(n, p).code;
        factories.push([n, vm.runInContext(`(function(GMLInstance,runtime){${code}\n;return ${n};})`, sb)]);
      } catch (e) {}
    }
    perChapter[ch] = { scriptFactory, factories };
    console.log(`${ch}: ${scripts.count} scripts, ${factories.length} classes (${broken} not valid JS)`);
  }
}

function runAttack(a, frames) {
  const ch = a.chapter;
  const bundle = perChapter[ch];
  const runtime = new W.GMLRuntimeEnvironment();
  runtime.$chapter = ch;
  W.activeGMLRuntime = runtime;
  const H = W.GML_HELPERS.for(runtime);
  const issues = [];

  try { if (bundle.scriptFactory) bundle.scriptFactory(runtime); }
  catch (e) { return { issues: ['script eval: ' + e.message] }; }

  let regFail = 0;
  for (const [name, factory] of bundle.factories) {
    try { runtime.registerObject(name, factory(W.GMLInstance, runtime)); }
    catch (e) { regFail++; }
  }

  const ctx = fakeCtx();
  W.setActiveCtx(ctx);

  // Battle context the attacks read: box, soul, party, boss.
  const gt = runtime.growtangle;
  gt.x = 320; gt.y = 190; gt.width = 100; gt.height = 100;
  gt.maxxscale = 2.5; gt.maxyscale = 2.0;
  gt.image_xscale = 2.5; gt.image_yscale = 2.0;
  runtime.soul.x = 320; runtime.soul.y = 190;
  W.global.turntimer = 600;

  for (const [obj, x, y] of [['obj_herosusie', 120, 240], ['obj_heroralsei', 120, 300], ['obj_mainchara', 120, 180]]) {
    try { runtime.createInstance(obj, x, y); } catch (e) {}
  }

  let boss = null;
  try {
    boss = runtime.createInstance(a.enemy, 520, 180);
    if (boss) { boss.myself = 0; boss.difficulty = 1; }
  } catch (e) { issues.push('boss create: ' + e.message); }

  // The controller, spawned as its boss spawns it.
  let dc = null;
  const errsBefore = runtime.errorLog.length;
  try {
    dc = runtime.createInstance(a.controller, boss ? boss.x : 320, boss ? boss.y : 180);
    if (!dc) issues.push('controller was not created');
    else {
      if (a.type !== null && a.type !== undefined) dc.type = a.type;
      if (a.usesDifficulty) dc.difficulty = 1;
    }
  } catch (e) { issues.push('controller create: ' + e.message); }

  let peak = runtime.instances.length;
  let bulletsSeen = 0;
  const spawned = new Set();
  for (let f = 0; f < frames; f++) {
    try { runtime.step(); } catch (e) { issues.push(`step crash f${f}: ${e.message}`); break; }
    try { runtime.draw(ctx); } catch (e) { issues.push(`draw crash f${f}: ${e.message}`); break; }
    peak = Math.max(peak, runtime.instances.length);
    for (const i of runtime.instances) {
      if (i === dc || i === boss) continue;
      if (/bullet|shot|sword|star|pipis|head|mail|crew|bomb|slash|spear|hammer|bell|shell|diamond|orb|laser/i.test(i.object_name)) {
        spawned.add(i.object_name);
      }
    }
    bulletsSeen = Math.max(bulletsSeen, spawned.size);
    if (dc && !dc.destroyed && (isNaN(Number(dc.x)) || isNaN(Number(dc.y)))) { issues.push(`controller NaN pos f${f}`); break; }
  }

  const errs = runtime.errorLog.slice(errsBefore);
  return { issues, errs, peak, spawned: [...spawned], regFail, alive: dc && !dc.destroyed };
}

if (only) {
  const a = ATTACKS.find(x => x.id === only || x.name === only || x.controller === only);
  if (!a) { console.log('no such attack; ids:\n  ' + ATTACKS.map(x => x.id).join('\n  ')); process.exit(1); }
  const r = runAttack(a, 150);
  console.log(`\n${a.bossLabel} — ${a.name}`);
  console.log(`  controller ${a.controller}${a.type !== null ? ' type=' + a.type : ''}  [${a.chapter}]`);
  console.log(`  peak instances ${r.peak}, spawned: ${r.spawned.join(', ') || '(nothing)'}`);
  console.log(`  issues: ${r.issues.length ? r.issues.join('; ') : 'none'}`);
  console.log('  runtime errors:');
  (r.errs && r.errs.length ? r.errs.slice(0, 12) : ['(none)']).forEach(e => console.log('    ' + e));
  process.exit(0);
}

// Registering ~250 classes per runtime × 33 attacks is slow in Node (minutes).
// The browser sweep in gml_studio.html is the faster authoritative check; this
// harness is for isolating ONE attack: `node scripts/test_attacks.js <id>`.
console.log(`\nrunning ${ATTACKS.length} real attacks (90 frames each) — this takes a few minutes;`);
console.log(`for a single attack use: node scripts/test_attacks.js <id>\n`);
let ok = 0, silent = 0, failed = 0;
const rows = [];
for (const a of ATTACKS) {
  const r = runAttack(a, 90);
  const hard = r.issues.length > 0;
  const produced = r.spawned.length > 0;
  if (hard) failed++;
  else if (!produced) silent++;
  else ok++;
  rows.push({ a, r, hard, produced });
}

for (const boss of [...new Set(ATTACKS.map(a => a.boss))]) {
  console.log(`── ${ATTACKS.find(a => a.boss === boss).bossLabel} ──`);
  for (const { a, r, hard, produced } of rows.filter(x => x.a.boss === boss)) {
    const mark = hard ? 'FAIL' : (produced ? ' ok ' : 'idle');
    console.log(`  [${mark}] ${a.name.padEnd(24)} ${String(a.spawnedCount || r.spawned.length).padStart(2)} kinds  peak ${String(r.peak).padStart(4)}` +
      (hard ? `  ${r.issues[0]}` : ''));
    if (verbose && r.spawned.length) console.log(`         spawns: ${r.spawned.join(', ')}`);
    if (verbose && r.errs && r.errs.length) console.log(`         first error: ${r.errs[0]}`);
  }
}

console.log(`\nproducing bullets: ${ok}/${ATTACKS.length}   idle (no spawns): ${silent}   hard failures: ${failed}`);
process.exitCode = failed ? 1 : 0;
