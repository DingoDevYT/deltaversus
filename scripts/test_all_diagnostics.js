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
console.log(`Total Presets to test: ${Object.keys(presets).length}`);

const compileErrors = [];
const runtimeErrors = [];

// 1. Test compilation of all presets
for (const [name, preset] of Object.entries(presets)) {
  try {
    const cls = translator.compileObject(preset, name);
  } catch (err) {
    compileErrors.push({ name, error: err.message, stack: err.stack });
  }
}

console.log(`\n=== COMPILE ERRORS: ${compileErrors.length} ===`);
compileErrors.forEach(e => {
  console.log(`\n[COMPILE ERROR] ${e.name}: ${e.error}`);
  console.log(e.stack ? e.stack.split('\n').slice(0, 5).join('\n') : '');
});

// 2. Test runtime simulation of each preset
for (const [name, preset] of Object.entries(presets)) {
  try {
    const runtime = new window.GMLRuntimeEnvironment();
    // Register all compiled objects
    for (const [pName, pObj] of Object.entries(presets)) {
      try {
        const cls = translator.compileObject(pObj, pName);
        runtime.registerObject(pName, cls);
      } catch (e) {
        // Ignored here (already caught in compileErrors)
      }
    }

    const fakeCtx = {
      save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, fillRect() {}, strokeRect() {}, drawImage() {},
      beginPath() {}, arc() {}, fill() {}, stroke() {}, fillText() {}, measureText() { return { width: 10 }; },
      setTransform() {}, resetTransform() {}
    };

    // Spawn instance
    const inst = runtime.createInstance(name, 320, 240);
    // Step 30 frames and draw
    for (let f = 0; f < 30; f++) {
      runtime.step();
      runtime.draw(fakeCtx);
    }
  } catch (err) {
    runtimeErrors.push({ name, error: err.message, stack: err.stack });
  }
}

console.log(`\n=== RUNTIME ERRORS: ${runtimeErrors.length} ===`);
const errorCounts = {};
runtimeErrors.forEach(e => {
  const key = e.error.split('\n')[0];
  errorCounts[key] = (errorCounts[key] || 0) + 1;
  console.log(`\n[RUNTIME ERROR] ${e.name}: ${e.error}`);
});

console.log(`\n=== RUNTIME ERROR SUMMARY ===`);
console.dir(errorCounts);
