/** Compile one object event (or raw GML) and print the emitted JS + warnings. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DOCS_JS = path.join(__dirname, '..', 'docs', 'js');

const sb = {};
sb.window = sb; sb.globalThis = sb;
sb.console = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
sb.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }), style: {}, width: 0, height: 0, addEventListener() {} }), addEventListener() {}, body: { appendChild() {} } };
sb.navigator = { userAgent: 'node' }; sb.requestAnimationFrame = () => 0;
sb.setTimeout = setTimeout; sb.setInterval = () => 0; sb.clearInterval = () => {};
sb.Image = function () {}; sb.AudioContext = function () {}; sb.performance = { now: () => 0 };
vm.createContext(sb);
for (const f of ['gml_compiler.js', 'gml_codegen.js', 'gml_runtime.js', 'gml_helpers.js',
  'gml_audio.js', 'gml_asset_db.js', 'gml_translator.js', 'gml_objects.js', 'gml_scripts.js', 'gml_object_index.js']) {
  const p = path.join(DOCS_JS, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), sb, { filename: f });
}

const [, , chapter, objName, evKey, grepFor] = process.argv;
const t = new sb.GMLTranslator(null);

let events;
if (objName === '--raw') {
  events = { chapter, step: fs.readFileSync(evKey, 'utf8') };
} else {
  const table = sb.GML_OBJECT_EVENTS_BY_CHAPTER[chapter] || {};
  if (!table[objName]) { console.log('NOT SHIPPED: ' + objName + ' in ' + chapter); process.exit(1); }
  events = Object.assign({ chapter }, evKey ? { [evKey]: table[objName][evKey] } : table[objName]);
}
const c = t.compileObject(objName === '--raw' ? '__probe' : objName, events);
console.log('--- warnings (' + c.errors.length + ') ---');
for (const e of c.errors) console.log('  ' + e);
console.log('--- code ---');
if (grepFor) {
  const re = new RegExp(grepFor);
  c.code.split('\n').forEach((l, i) => { if (re.test(l)) console.log(String(i + 1).padStart(5) + '  ' + l.trim()); });
} else {
  console.log(c.code);
}
