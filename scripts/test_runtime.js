/**
 * test_runtime.js — compile AND RUN every preset headlessly.
 *
 * Parsing clean proves nothing about behaviour. This spins up a real
 * GMLRuntimeEnvironment per preset, spawns the object, and steps it 90 frames
 * (3 seconds at the 30 FPS step rate) with a fake canvas context, reporting any
 * runtime error, NaN position, or instance explosion.
 *
 *   node scripts/test_runtime.js          summary
 *   node scripts/test_runtime.js -v       every failure
 *   node scripts/test_runtime.js <name>   trace one preset frame by frame
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '..', 'docs', 'js');

// ── a canvas 2D context that records nothing but accepts everything ─────────
function fakeCtx() {
  const noop = () => {};
  const ctx = {
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    drawImage: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    fill: noop, stroke: noop, clip: noop, fillText: noop, strokeText: noop,
    measureText: () => ({ width: 8 }), createLinearGradient: () => ({ addColorStop: noop }),
    setTransform: noop, transform: noop, rect: noop, ellipse: noop, quadraticCurveTo: noop,
    getImageData: () => ({ data: new Uint8Array(4) }), putImageData: noop,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#fff', strokeStyle: '#fff', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
  };
  return ctx;
}

function makeSandbox() {
  const sb = {
    console, Math, JSON, Number, String, Boolean, Array, Object, Map, Set,
    WeakMap, WeakSet, Promise, parseInt, parseFloat, isNaN, isFinite, Date,
    RegExp, Error, TypeError, Uint8Array, isNaN, setTimeout: () => 0, clearTimeout: () => {},
    performance: { now: () => 0 },
  };
  sb.window = sb;
  sb.globalThis = sb;
  sb.global = sb;
  sb.document = {
    createElement: () => ({ getContext: () => fakeCtx(), width: 0, height: 0 }),
    getElementById: () => null,
  };
  // Images never load headlessly, which exercises the placeholder path.
  sb.Image = function () { this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; };
  vm.createContext(sb);

  const load = f => vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), sb, { filename: f });
  load('gml_object_index.js');
  load('sprite_origins.js');
  load('sprite_manifest.js');
  load('gml_asset_db.js');
  load('gml_runtime.js');
  load('gml_helpers.js');
  load('gml_compiler.js');
  load('gml_codegen.js');
  load('gml_translator.js');
  load('gml_presets.js');
  load('gml_scripts.js');
  load('gml_objects.js');
  return sb;
}

const sb = makeSandbox();
const W = sb.window;
const presets = W.GML_MASTER_PRESETS;
const names = Object.keys(presets);

const verbose = process.argv.includes('-v');
const only = process.argv.slice(2).find(a => !a.startsWith('-') && presets[a]);

// ── script table compiles once per chapter ─────────────────────────────────
const scriptResults = {};
{
  const t = new W.GMLTranslator({ objectDefinitions: {} });
  for (const ch of ['ch2', 'ch3', 'ch4']) {
    const r = t.compileScripts(ch);
    scriptResults[ch] = r;
    let syntaxOk = true;
    let msg = '';
    try { new vm.Script(`(function(runtime){${r.code}})`); } catch (e) { syntaxOk = false; msg = e.message; }
    console.log(`scripts ${ch}: ${r.count} compiled, ${r.errors.length} warnings, JS ${syntaxOk ? 'OK' : 'BROKEN: ' + msg}`);
    if (!syntaxOk) process.exitCode = 1;
  }
}

function chapterOf(p) {
  const m = /Chapter\s*([1-5])/i.exec(p.label || '');
  return m ? 'ch' + m[1] : 'ch3';
}

// Compile each preset's class source once; evaluating it is per-runtime because
// the generated class closes over `runtime`.
const classSource = {};
const compileWarnings = {};
const presetNames = new Set();
{
  const t = new W.GMLTranslator(null);
  for (const [k, p] of Object.entries(presets)) {
    const n = p.name || k;
    presetNames.add(n);
    try {
      const c = t.compileObject(n, p);
      classSource[n] = c.code;
      compileWarnings[n] = c.errors;
    } catch (e) { classSource[n] = null; compileWarnings[n] = ['compile threw: ' + e.message]; }
  }
}

// Support objects (parents first), compiled once per chapter.
const supportUnits = {};
{
  const t = new W.GMLTranslator(null);
  for (const ch of ['ch2', 'ch3', 'ch4']) {
    const r = t.compileSupportObjects(ch, presetNames);
    supportUnits[ch] = r.units;
    console.log(`support ${ch}: ${r.units.length} objects, ${r.errors.length} warnings`);
  }
}

/** Preset objects this one references, so children run their real code too. */
function relatedObjects(p) {
  const src = [p.create, p.step, p.draw].filter(s => typeof s === 'string').join('\n');
  const out = new Set();
  const re = /\b(obj_[a-zA-Z0-9_]+)\b/g;
  let m;
  while ((m = re.exec(src))) if (classSource[m[1]]) out.add(m[1]);
  return out;
}

/** Build a runtime, register the preset under test plus the children it spawns. */
function runPreset(key, frames) {
  const p = presets[key];
  const objName = p.name || key;
  const chapter = chapterOf(p);

  const runtime = new W.GMLRuntimeEnvironment();
  runtime.$chapter = chapter;
  W.activeGMLRuntime = runtime;
  const H = W.GML_HELPERS.for(runtime);

  const issues = [];

  // Scripts first, so object code can call them.
  try {
    vm.runInContext(`(function(runtime){${scriptResults[chapter].code}})`, sb)(runtime);
  } catch (e) { issues.push('script eval: ' + e.message); }

  // Support objects first — they're the parents/spawnees the presets rely on.
  for (const u of supportUnits[chapter] || []) {
    try {
      const cls = vm.runInContext(`(function(GMLInstance, runtime){${u.code}\n;return ${u.objectName};})`, sb)(W.GMLInstance, runtime);
      runtime.registerObject(u.objectName, cls);
    } catch (e) { /* one bad support object must not fail the preset */ }
  }

  // The object under test, plus the objects it names, so children run real code.
  const toRegister = relatedObjects(p);
  toRegister.add(objName);
  for (const n2 of toRegister) {
    if (!classSource[n2]) { if (n2 === objName) issues.push('compile failed'); continue; }
    try {
      const cls = vm.runInContext(`(function(GMLInstance, runtime){${classSource[n2]}\n;return ${n2};})`, sb)(W.GMLInstance, runtime);
      runtime.registerObject(n2, cls);
    } catch (e) {
      if (n2 === objName) issues.push('eval: ' + e.message);
    }
  }

  // Count creations per object and hard-cap them. A single GML frame can create
  // unbounded instances (an attack that spawns a helper every step whose own
  // code never destroys it), and the between-frames check is too late to stop
  // the process running out of memory.
  const created = new Map();
  const origCreate = runtime.createInstance.bind(runtime);
  let capped = false;
  runtime.createInstance = function (o, x, y) {
    const key = typeof o === 'string' ? o : (o && o.object_name) || String(o);
    created.set(key, (created.get(key) || 0) + 1);
    if (runtime.instances.length > 25000) {
      capped = true;
      throw new Error('instance cap');
    }
    return origCreate(o, x, y);
  };

  const ctx = fakeCtx();
  W.setActiveCtx(ctx);

  // Minimal battle context, mirroring what gml_studio.html sets up.
  runtime.growtangle.x = 320; runtime.growtangle.y = 200;
  runtime.growtangle.width = 250; runtime.growtangle.height = 150;
  runtime.growtangle.maxxscale = 2.5; runtime.growtangle.maxyscale = 2.0;
  runtime.soul.x = 320; runtime.soul.y = 200;

  let inst = null;
  const errorsBefore = runtime.errorLog.length;
  try {
    inst = runtime.createInstance(objName, 320, 200);
  } catch (e) { issues.push('create: ' + e.message); }

  let maxInstances = runtime.instances.length;
  for (let f = 0; f < frames; f++) {
    try { runtime.step(); } catch (e) { issues.push(`step crash frame ${f}: ${e.message}`); break; }
    try { runtime.draw(ctx); } catch (e) { issues.push(`draw crash frame ${f}: ${e.message}`); break; }
    maxInstances = Math.max(maxInstances, runtime.instances.length);
    if (inst && !inst.destroyed) {
      if (isNaN(Number(inst.x)) || isNaN(Number(inst.y))) { issues.push(`NaN position at frame ${f}`); break; }
    }
    if (capped) { const top=[...created.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]+"×"+e[1]).join(", "); issues.push(`instance cap hit at frame ${f} — top creators: ${top}`); break; }
  }

  const runtimeErrors = runtime.errorLog.slice(errorsBefore).filter(e => !/instance cap/.test(e));
  const topCreated = [...created.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  return { objName, chapter, issues, runtimeErrors, maxInstances, topCreated, instances: runtime.instances.length };
}

if (only) {
  const r = runPreset(only, 90);
  console.log(`\n${r.objName} [${r.chapter}]  peak instances ${r.maxInstances}`);
  console.log('issues:', r.issues.length ? r.issues : 'none');
  console.log('created:', r.topCreated.map(e=>e[0]+' ×'+e[1]).join(', '));
  console.log('runtime error log:');
  (r.runtimeErrors.length ? r.runtimeErrors : ['(empty)']).forEach(e => console.log('  ' + e));
  process.exit(0);
}

let clean = 0;
const failures = [];
const errorKinds = new Map();

for (const key of names) {
  // TRACE=1 prints progress and heap per preset — useful when one preset hangs
  // or blows memory and you need to know which.
  if (process.env.TRACE) {
    console.error(`  ${key}  heap=${(process.memoryUsage().heapUsed / 1048576).toFixed(0)}MB`);
  }
  let r;
  try { r = runPreset(key, 60); }
  catch (e) { failures.push({ objName: key, issues: ['harness: ' + e.message], runtimeErrors: [] }); continue; }

  for (const e of r.runtimeErrors) {
    const kind = String(e).replace(/\[[^\]]*\]/g, '[]').replace(/\d+/g, 'N').slice(0, 120);
    errorKinds.set(kind, (errorKinds.get(kind) || 0) + 1);
  }
  if (r.issues.length || r.runtimeErrors.length) failures.push(r);
  else clean++;
}

console.log(`\npresets run:        ${names.length}`);
console.log(`clean (no errors):  ${clean}`);
console.log(`with errors:        ${failures.length}`);

const hardFails = failures.filter(f => f.issues.length);
console.log(`hard failures:      ${hardFails.length}`);

if (hardFails.length) {
  console.log('\n── hard failures (crash / NaN / explosion) ──');
  for (const f of (verbose ? hardFails : hardFails.slice(0, 20))) {
    console.log(`  ${f.objName}: ${f.issues.join('; ')}`);
  }
  if (!verbose && hardFails.length > 20) console.log(`  ... ${hardFails.length - 20} more (-v)`);
}

if (errorKinds.size) {
  console.log(`\n── runtime error classes (${errorKinds.size} distinct) ──`);
  for (const [k, c] of [...errorKinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${String(c).padStart(4)}  ${k}`);
  }
}

process.exitCode = hardFails.length ? 1 : 0;
