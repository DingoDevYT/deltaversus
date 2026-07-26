const fs = require('fs');

// The engine modules and the code they generate both target a browser: they
// read `window` for GML's `global` namespace, and gml_helpers.js allocates
// offscreen canvases. Node has neither, so shim both before anything is
// evaluated. (scripts/test_runtime.js is the fuller headless harness — it runs
// EVERY preset in a vm sandbox. This file is the single-snippet smoke test that
// predates it, and had rotted: it still loaded only gml_translator.js, from
// before the compiler and codegen were split out of it.)
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.document === 'undefined') {
  const noop = () => {};
  const fakeCtx = () => ({
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    drawImage: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    fill: noop, stroke: noop, clip: noop, fillText: noop, strokeText: noop,
    measureText: () => ({ width: 8 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    setTransform: noop, transform: noop, rect: noop, ellipse: noop,
    quadraticCurveTo: noop, putImageData: noop,
    getImageData: () => ({ data: new Uint8Array(4) }),
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#fff', strokeStyle: '#fff', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '',
  });
  globalThis.document = {
    createElement: () => ({ getContext: fakeCtx, width: 0, height: 0 }),
    getElementById: () => null,
  };
  globalThis.Image = function () { this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; };
}

// Load modules
const dbCode = fs.readFileSync('docs/js/gml_asset_db.js', 'utf8');
const runtimeCode = fs.readFileSync('docs/js/gml_runtime.js', 'utf8');
const translatorCode = fs.readFileSync('docs/js/gml_translator.js', 'utf8');
// The compiler and codegen were split out of gml_translator.js; this harness
// still loaded only the translator, so GMLCodegen was undefined and every run
// died on `new global.GMLCodegen(...)` before testing anything.
const compilerCode = fs.readFileSync('docs/js/gml_compiler.js', 'utf8');
const codegenCode = fs.readFileSync('docs/js/gml_codegen.js', 'utf8');
const helpersCode = fs.readFileSync('docs/js/gml_helpers.js', 'utf8');

eval(dbCode); eval(runtimeCode); eval(helpersCode);
eval(compilerCode); eval(codegenCode); eval(translatorCode);

const translator = new GMLTranslator();
const gmlCreate = `direction = point_direction(x, y, obj_heart.x, obj_heart.y);
speed = 2;
friction = -0.05;
image_angle = direction;
sprite_index = "spr_knight_bullet_star";
timer = 0;
con = 0;
growspeed = 0.05;
playSound = 1;
difficulty = 2;`;

const gmlStep = `timer += 1;
if (con == 0) {
  image_xscale += growspeed;
  image_yscale += growspeed;
  if (timer >= 30) con = 1;
} else if (con == 1) {
  friction = 0.5;
  if (speed <= 0.1) con = 2;
} else if (con == 2) {
  if (timer >= 60) {
    for (var i = 0; i < 6; i += 1) {
      var d = instance_create(x, y, obj_knight_star_shrapnel);
      d.direction = i * 60;
      d.speed = 4;
      d.sprite_index = "spr_knight_star";
      d.image_blend = c_red;
    }
    instance_destroy();
  }
}`;

const compiled = translator.compileObject('obj_knight_pointing_star', { create: gmlCreate, step: gmlStep });
console.log('--- COMPILED JS CLASS ---');
console.log(compiled.code);

const runtime = new GMLRuntimeEnvironment();
try {
  const evalFunc = new Function(
    'GMLInstance', 'gmlMath', 'Snd', 'runtime', 
    'draw_sprite_ext', 'draw_set_blend_mode', 'scr_draw_beam_color', 'sprite_get_width', 'sprite_get_height', 
    'scr_afterimage', 'merge_color', 'toCSSColor', 'scr_ease_in', 'bm_add', 'bm_normal',
    'c_white', 'c_red', 'c_black', 'c_blue', 'c_yellow', 'c_gray',
    compiled.code + `;\nreturn obj_knight_pointing_star;`
  );

  const ObjectClass = evalFunc(
    GMLInstance, gmlMath, { play: () => {} }, runtime, 
    draw_sprite_ext, draw_set_blend_mode, scr_draw_beam_color, sprite_get_width, sprite_get_height,
    scr_afterimage, merge_color, toCSSColor, scr_ease_in, bm_add, bm_normal,
    '#ffffff', '#ff0000', '#000000', '#0000ff', '#ffff00', '#808080'
  );

  runtime.registerObject('obj_knight_pointing_star', ObjectClass);
  const inst = runtime.createInstance('obj_knight_pointing_star', 320, 240);

  console.log('--- INITIAL INSTANCE STATE ---');
  console.log(inst);

  console.log('--- RUNNING 100 STEPS ---');
  for (let frame = 0; frame < 100; frame++) {
    runtime.step();
  }
  console.log('SUCCESS! Instance steps ran cleanly without exceptions. Remaining instances:', runtime.instances.length);
} catch(err) {
  console.error('--- EXCEPTION DETECTED ---');
  console.error(err);
}
