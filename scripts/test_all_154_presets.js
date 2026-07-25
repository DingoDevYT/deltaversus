const fs = require('fs');

global.window = global;
global.window.global = global;

if (typeof Image === 'undefined') {
  global.Image = class {
    constructor() {
      this.complete = true;
      this.naturalWidth = 32;
      this.naturalHeight = 32;
    }
  };
}

require('../docs/js/gml_asset_db.js');
require('../docs/js/gml_runtime.js');
require('../docs/js/gml_translator.js');
require('../docs/js/gml_presets.js');

const translator = new window.GMLTranslator();
const presets = window.GML_MASTER_PRESETS;

const evalErrors = [];

for (const [name, preset] of Object.entries(presets)) {
  try {
    const compiled = translator.compileObject(name, preset);
    const evalCode = compiled.code + `;\nreturn ${name};`;

    const factory = new Function('GMLInstance', 'runtime', evalCode);

    const runtime = new window.GMLRuntimeEnvironment();
    const ObjectClass = factory(window.GMLInstance, runtime);
    runtime.registerObject(name, ObjectClass);

    // Create instance & step/draw
    const inst = runtime.createInstance(name, 320, 240);
    const fakeCtx = {
      save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, fillRect() {}, strokeRect() {}, drawImage() {},
      beginPath() {}, arc() {}, fill() {}, stroke() {}, fillText() {}, measureText() { return { width: 10 }; },
      setTransform() {}, resetTransform() {}
    };

    for (let f = 0; f < 30; f++) {
      runtime.step();
      runtime.draw(fakeCtx);
    }
  } catch (err) {
    evalErrors.push({ name, error: err.message, stack: err.stack });
  }
}

console.log(`\n=== 154 GML BOSS ATTACKS VERIFICATION: ${154 - evalErrors.length} / 154 PASSED ===`);
if (evalErrors.length > 0) {
  console.log(`Failed: ${evalErrors.length}`);
  evalErrors.forEach(e => console.log(`[FAIL] ${e.name}: ${e.error}`));
  process.exit(1);
} else {
  console.log(`ALL 154 RAW GML BOSS ATTACKS PASSED WITH 0 EVALUATION ERRORS!`);
  process.exit(0);
}
