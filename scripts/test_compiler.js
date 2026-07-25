/**
 * test_compiler.js — compile every preset with the new front end and report.
 *
 *   node scripts/test_compiler.js            summary
 *   node scripts/test_compiler.js -v         list every failure
 *   node scripts/test_compiler.js <name>     dump generated JS for one preset
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOCS = path.join(__dirname, '..', 'docs');
const JS = path.join(DOCS, 'js');

// A DOM-less window good enough for the compiler + tables.
const sandbox = { console, Math, JSON, Number, String, Boolean, Array, Object, Map, Set, WeakMap, WeakSet, parseInt, parseFloat, isNaN, isFinite, Date, RegExp, Error, TypeError };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = { createElement: () => ({ getContext: () => ({}), width: 0, height: 0 }) };
vm.createContext(sandbox);

function load(file) {
  const src = fs.readFileSync(path.join(JS, file), 'utf8');
  vm.runInContext(src, sandbox, { filename: file });
}

load('gml_object_index.js');
load('sprite_origins.js');
load('sprite_manifest.js');
load('gml_compiler.js');
load('gml_codegen.js');
load('gml_translator.js');
load('gml_presets.js');

const presets = sandbox.window.GML_MASTER_PRESETS;
const names = Object.keys(presets);

const translator = new sandbox.window.GMLTranslator({ objectDefinitions: {} });

const only = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1] && presets[a]);
const verbose = process.argv.includes('-v');

if (only) {
  const r = translator.compileObject(presets[only].name || only, presets[only]);
  console.log(r.code);
  console.log('\n// ---- diagnostics ----');
  r.errors.forEach(e => console.log('// ' + e));
  process.exit(0);
}

let ok = 0;
const parseFails = [];
const syntaxFails = [];
const unknownFns = new Map();
const otherWarns = new Map();

for (const key of names) {
  const p = presets[key];
  const objName = p.name || key;
  let result;
  try {
    result = translator.compileObject(objName, p);
  } catch (err) {
    parseFails.push({ objName, msg: 'compileObject threw: ' + err.message });
    continue;
  }

  // Does the generated JS actually parse as JavaScript?
  try {
    new vm.Script(`(function(GMLInstance, runtime){\n${result.code}\n;return ${objName};})`, { filename: objName });
  } catch (err) {
    syntaxFails.push({ objName, msg: err.message, code: result.code });
    continue;
  }

  for (const e of result.errors) {
    const m = /unknown function (\w+)\(\)/.exec(e);
    if (m) { unknownFns.set(m[1], (unknownFns.get(m[1]) || 0) + 1); continue; }
    if (/COMPILE ERROR|\] .*(expected|unexpected)/.test(e)) { parseFails.push({ objName, msg: e }); continue; }
    otherWarns.set(e.replace(/^\[[^\]]+\]\s*/, ''), (otherWarns.get(e.replace(/^\[[^\]]+\]\s*/, '')) || 0) + 1);
  }
  ok++;
}

console.log(`presets:            ${names.length}`);
console.log(`compiled to valid JS: ${ok}`);
console.log(`GML parse errors:     ${parseFails.length}`);
console.log(`JS syntax errors:     ${syntaxFails.length}`);

if (parseFails.length) {
  console.log('\n── GML parse errors ──');
  for (const f of (verbose ? parseFails : parseFails.slice(0, 15))) console.log(`  ${f.objName}: ${f.msg}`);
  if (!verbose && parseFails.length > 15) console.log(`  ... ${parseFails.length - 15} more (-v)`);
}

if (syntaxFails.length) {
  console.log('\n── generated JS does not parse ──');
  for (const f of (verbose ? syntaxFails : syntaxFails.slice(0, 10))) console.log(`  ${f.objName}: ${f.msg}`);
  if (!verbose && syntaxFails.length > 10) console.log(`  ... ${syntaxFails.length - 10} more (-v)`);
}

if (unknownFns.size) {
  console.log(`\n── functions with no implementation (${unknownFns.size} distinct) ──`);
  const sorted = [...unknownFns.entries()].sort((a, b) => b[1] - a[1]);
  for (const [n, c] of sorted.slice(0, 40)) console.log(`  ${String(c).padStart(4)}  ${n}`);
  if (sorted.length > 40) console.log(`  ... ${sorted.length - 40} more`);
}

if (otherWarns.size) {
  console.log('\n── other warnings ──');
  for (const [w, c] of [...otherWarns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(c).padStart(4)}  ${w}`);
  }
}

process.exitCode = (parseFails.length || syntaxFails.length) ? 1 : 0;
