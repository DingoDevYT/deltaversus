/**
 * Quick test to verify the GML runtime + translator work without crashing.
 * Run: node scripts/test_studio_v2.js
 */

// Minimal DOM stubs for Node.js
global.window = global;
global.document = { getElementById: () => ({ getContext: () => null }) };
global.Image = class { constructor() { this.src = ''; this.onload = null; this.onerror = null; this.complete = false; this.naturalWidth = 0; } };

// Load our modules
require('../docs/js/gml_asset_db.js');
require('../docs/js/gml_runtime.js');
require('../docs/js/gml_translator.js');

const runtime = new GMLRuntimeEnvironment();
const translator = new GMLTranslator(runtime);

// Test 1: Compile the Knight Star preset
console.log('=== TEST 1: Knight Star Compile ===');
const knightStar = translator.compileObject('obj_knight_pointing_star', {
  create: `scr_bullet_init();
growspeed = 0.02;
image_xscale = 0;
image_yscale = 0;
destroyonhit = false;
timer = 0;
con = 0;
growstart = 0;
playSound = true;
damage = 1;
difficulty = 0;
sprite_index = "spr_knight_bullet_star";
rotation = 0;
dir = choose(-1, 1);`,
  step: `if (x < 0 || y < 0 || x > 640 || y > 480) {
    instance_destroy();
    exit;
}
if (con == 0) {
    image_xscale += growspeed;
    image_yscale += growspeed;
    if (image_xscale >= 1) {
        con = 1;
        speed = 2;
        direction = point_direction(x, y, obj_heart.x + 10, obj_heart.y + 10);
    }
} else if (con == 1) {
    timer++;
    if (timer >= 20) friction = 0.15;
    if (speed <= 0.05) { con = 2; timer = 0; friction = 0; speed = 0; }
} else if (con == 2) {
    timer++;
    if (timer >= 40) { timer = 0; con = 3; }
    growstart = image_xscale;
} else if (con == 3) {
    timer++;
    image_xscale = growstart + clamp01(timer / 2);
    image_yscale = growstart + clamp01(timer / 2);
    if (timer == 3) {
        var _angle = 90;
        for (var i = 0; i < 6; i++) {
            var d = scr_childbullet(x, y, obj_knight_pointing_starchild);
            d.direction = _angle;
            d.speed = 4;
            _angle += 60;
        }
        active = false;
    }
    if (timer >= 4) { instance_destroy(); }
}`,
  draw: `var _alpha = (sin(timer * 3) + 1) * 0.25;
draw_sprite_ext(sprite_index, 0, x, y, image_xscale, image_yscale, image_angle, c_white, image_alpha);`
});

if (knightStar.errors.length > 0) {
  console.log('  WARNINGS:', knightStar.errors);
}
console.log('  Compiled class length:', knightStar.code.length, 'chars');

// Try to eval + instantiate
try {
  const factory = new Function(
    'GMLInstance', 'runtime',
    'sin', 'cos', 'abs', 'ceil', 'floor', 'round', 'min', 'max', 'sqrt', 'sign',
    'degtorad', 'radtodeg',
    'lengthdir_x', 'lengthdir_y', 'point_direction', 'point_distance', 'angle_difference',
    'clamp', 'clamp01', 'lerp',
    'random', 'random_range', 'irandom', 'irandom_range', 'choose',
    'scr_ease_in', 'scr_movetowards', 'scr_rotatetowards',
    'draw_sprite_ext', 'draw_set_blend_mode', 'scr_draw_beam_color',
    'sprite_get_width', 'sprite_get_height',
    'scr_afterimage', 'scr_custom_afterimage',
    'merge_color', 'toCSSColor',
    'c_white', 'c_black', 'c_red', 'c_green', 'c_blue', 'c_yellow', 'c_gray', 'c_orange', 'c_aqua', 'c_lime',
    'bm_add', 'bm_normal',
    knightStar.code + ';return obj_knight_pointing_star;'
  );

  const ObjClass = factory(
    GMLInstance, runtime,
    Math.sin, Math.cos, Math.abs, Math.ceil, Math.floor, Math.round, Math.min, Math.max, Math.sqrt, gmlMath.sign || Math.sign,
    gmlMath.degtorad, gmlMath.radtodeg,
    gmlMath.lengthdir_x, gmlMath.lengthdir_y, gmlMath.point_direction, gmlMath.point_distance, gmlMath.angle_difference,
    gmlMath.clamp, gmlMath.clamp01, gmlMath.lerp,
    gmlMath.random, gmlMath.random_range, gmlMath.irandom, gmlMath.irandom_range, gmlMath.choose,
    gmlMath.scr_ease_in, gmlMath.scr_movetowards, gmlMath.scr_rotatetowards,
    draw_sprite_ext, draw_set_blend_mode, scr_draw_beam_color,
    sprite_get_width, sprite_get_height,
    scr_afterimage, scr_custom_afterimage,
    merge_color, toCSSColor,
    c_white, c_black, c_red, c_green, c_blue, c_yellow, c_gray, c_orange, c_aqua, c_lime,
    bm_add, bm_normal
  );

  runtime.registerObject('obj_knight_pointing_star', ObjClass);
  runtime.registerObject('obj_knight_pointing_starchild', GMLInstance);

  const inst = runtime.createInstance('obj_knight_pointing_star', 320, 240);
  console.log('  ✓ Instance created:', inst.object_name, 'at', inst.x, inst.y);
  console.log('  ✓ growspeed:', inst.growspeed, 'con:', inst.con, 'timer:', inst.timer);
  console.log('  ✓ image_xscale:', inst.image_xscale, '(starts at 0 = invisible, grows)');

  // Run 120 frames
  let maxInst = 0;
  for (let f = 0; f < 120; f++) {
    try {
      runtime.step();
      if (runtime.instances.length > maxInst) maxInst = runtime.instances.length;
    } catch(e) {
      console.error('  ✗ Frame', f, 'crashed:', e.message);
      break;
    }
  }
  console.log('  ✓ Ran 120 frames, peak instances:', maxInst);
  console.log('  ✓ Final instances:', runtime.instances.length);

  // Test draw doesn't crash
  const mockCtx = {
    save: ()=>{}, restore: ()=>{}, translate: ()=>{}, rotate: ()=>{}, scale: ()=>{},
    fillRect: ()=>{}, fillText: ()=>{}, beginPath: ()=>{}, arc: ()=>{}, fill: ()=>{},
    drawImage: ()=>{}, stroke: ()=>{}, moveTo: ()=>{}, lineTo: ()=>{},
    set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){}, set globalAlpha(v){},
    set globalCompositeOperation(v){}, set font(v){},
  };
  try {
    runtime.draw(mockCtx);
    console.log('  ✓ Draw completed without crash');
  } catch(e) {
    console.error('  ✗ Draw crashed:', e.message);
  }

} catch(e) {
  console.error('  ✗ EVAL FAILED:', e.message);
  console.error('  Generated code:\n', knightStar.code);
}

console.log('\n=== TEST 2: Verify GMLInstance has draw() ===');
const testInst = new GMLInstance('test', 100, 200, 1);
console.log('  ✓ has draw:', typeof testInst.draw === 'function');
console.log('  ✓ has drawSelf:', typeof testInst.drawSelf === 'function');

// Super.draw() should not crash now
class TestChild extends GMLInstance {
  draw(ctx) {
    super.draw(ctx);
  }
}
const child = new TestChild('test', 0, 0, 2);
try {
  child.draw({ save:()=>{}, restore:()=>{}, translate:()=>{}, rotate:()=>{}, scale:()=>{}, fillRect:()=>{}, set fillStyle(v){}, set globalAlpha(v){} });
  console.log('  ✓ super.draw(ctx) works without crash');
} catch(e) {
  console.error('  ✗ super.draw(ctx) crashed:', e.message);
}

console.log('\n=== ALL TESTS COMPLETE ===');
