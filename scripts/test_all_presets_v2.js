/**
 * Test harness verifying all 4 GML presets in Node.js using real GML source code.
 */

global.window = global;
global.document = { getElementById: () => ({ getContext: () => null }) };
global.Image = class { constructor() { this.src = ''; this.onload = null; this.onerror = null; this.complete = false; this.naturalWidth = 32; this.naturalHeight = 32; } };

require('../docs/js/gml_asset_db.js');
require('../docs/js/gml_runtime.js');
require('../docs/js/gml_translator.js');

const PRESETS = [
  {
    name: 'obj_knight_pointing_star',
    create: `scr_bullet_init();
growspeed = 0.02;
image_xscale = 0;
image_yscale = 0;
even = false;
destroyonhit = false;
timer = 0;
con = 0;
growstart = 0;
playSound = true;
beamflicker = 0;
damage = 1;
grazepoints = 2;
element = 5;
difficulty = 0;
grazetimer = 0;
side = 0;
init = false;
mask_index = spr_knight_bullet_star_mask;
rotation = 0;
dir = choose(-1, 1);`,
    step: `if (x < (camerax() - (sprite_width / 2)) || y < (cameray() - (sprite_height / 2)) || y > (cameray() + 480 + (sprite_height / 2))) {
    instance_destroy(); exit;
}
if (!init) {
    sprite_index = spr_knight_bullet_star;
    init = true;
}
grazetimer++;
if ((grazetimer % 4) == 0) grazed = 0;
if (con == 0) {
    image_xscale += growspeed; image_yscale += growspeed;
    if (image_xscale >= 1) { con = 1; speed = 2; direction = point_direction(x, y, obj_heart.x + 10, obj_heart.y + 10); }
} else if (con == 1) {
    friction = 0.5; con++;
} else if (con == 2) {
    mask_index = spr_knight_bullet_star_mask;
    if (speed == 0) { gravity = 0.1; gravity_direction = direction - 180; friction = 0; }
    timer++;
    if (timer >= 40) { timer = 0; con++; }
    growstart = image_xscale;
} else if (con == 3) {
    timer++;
    image_xscale = growstart + clamp01(timer / 2); image_yscale = growstart + clamp01(timer / 2);
    if (timer == 3) {
        var _angle = 90;
        for (i = 0; i < 6; i++) {
            d = scr_childbullet(x, y, obj_knight_pointing_starchild);
            d.image_angle = _angle; d.direction = _angle; d.speed = 4;
            d.image_xscale = image_xscale * 0.5; d.image_yscale = image_yscale * 0.5;
            d.deceleration = 0.15; d.sprite_index = spr_knight_starchild;
            _angle += 60;
        }
        active = false;
    }
    if (timer >= 4) instance_destroy();
}`,
    draw: `var _xscale = (sprite_width + 16) / sprite_get_width(sprite_index);
var _yscale = (sprite_height + 16) / sprite_get_height(sprite_index);
var _color = merge_color(c_gray, c_red, clamp01(timer / 30));
var _alpha = (sin(timer * 3) + 1) * 0.25;
draw_set_blend_mode(bm_add);
scr_draw_beam_color(x, y, 600, 10, 90, c_white, 0, _alpha, false);
draw_set_blend_mode(bm_normal);
draw_sprite_ext(sprite_index, 1, x, y, _xscale + 0.1, _yscale + 0.1, image_angle, c_white, _alpha);
draw_sprite_ext(sprite_index, 0, x, y, _xscale, _yscale, image_angle, _color, 1);`
  },
  {
    name: 'obj_knight_tunnel_slasher_2_revised',
    create: `vertical_pos = 0; old_pos = 0; hole_size = 60; scr_bullet_init(); damage = 206; timer = 0; con = 1; first_strike = 1;`,
    step: `timer++;
if (timer >= 8) {
    var newpos = old_pos + 15 + irandom(90);
    if (newpos > 60) newpos -= 120;
    old_pos = vertical_pos; vertical_pos = newpos;
    vertical_pos = clamp(vertical_pos, old_pos - 50, old_pos + 50);
    var hole_diff = abs(old_pos - vertical_pos);
    if (hole_diff < 20) hole_size = 36;
    else if (hole_diff < 30) hole_size = 44;
    else if (hole_diff < 40) hole_size = 52;
    else hole_size = 60;

    if (first_strike > 0) {
        vertical_pos = irandom_range(-15, 15); old_pos = vertical_pos; hole_size = 100;
        first_strike = scr_approach(first_strike, 0, 0.25);
    }
    var mbox = mean(scr_get_box(1), scr_get_box(3));
    var dorifto = 0.15 + (random(0.6) * choose(1, -1));
    if (vertical_pos > -20) {
        var y1 = (mbox + vertical_pos) - (hole_size * 0.5);
        var y2 = scr_get_box(1) - 40;
        var y3 = max((y1 - y2) * (0.5 + random(0.5)), 50);
        var y4 = y1 - y3;
        var bul = scr_fire_bullet(scr_get_box(0) + 40, mean(y1, y4), obj_knight_diamondswordbullet_ext, 180, 0.5);
        bul.image_angle = 270; bul.image_yscale = 1; bul.sprite_index = spr_knight_diamondbullet_m;
        bul.gravity_direction = 180; bul.gravity = 0.4; bul.vspeed = dorifto;
    }
    if (vertical_pos < 20) {
        var y1 = mbox + vertical_pos + (hole_size * 0.5);
        var y2 = scr_get_box(3) + 40;
        var y3 = max((y2 - y1) * (0.5 + random(0.5)), 60);
        var y4 = y1 + y3;
        var bul2 = scr_fire_bullet(scr_get_box(0) + 40, mean(y1, y4), obj_knight_diamondswordbullet_ext, 180, 0.5);
        bul2.image_angle = 90; bul2.image_yscale = 1; bul2.sprite_index = spr_knight_diamondbullet_m;
        bul2.gravity_direction = 180; bul2.gravity = 0.4; bul2.vspeed = dorifto;
    }
    timer = 0;
}`,
    draw: ``
  },
  {
    name: 'obj_gerson_squishes_box',
    create: `timer = 0; con = 0; image_xscale = 2; image_yscale = 2; image_speed = 0; sprite_index = spr_gerson_dodge_origin_top_bottom;`,
    step: `if (con == 0) {
    timer++;
    if (timer == 1) { vspeed = -48; snd_play(snd_jump); }
    if (vspeed < 0) vspeed += 0.8;
    if (timer == 14) { timer = 0; con = 1; vspeed = 0; x = obj_growtangle.x; y = cameray(); }
}
if (con == 1) {
    if (timer < 5) timer++;
    y = lerp(cameray(), obj_growtangle.y - 70, timer / 5);
    if (timer == 5) { y = obj_growtangle.y - 70; con = 2; timer = 0; }
}
if (con == 2) {
    timer++; var timermax = 10;
    if (timer <= timermax) {
        var maxscalex = lerp(9, 6, timer / timermax);
        var maxscaley = lerp(0.2, 1, timer / timermax);
        obj_growtangle.image_xscale = lerp(obj_growtangle.image_xscale, maxscalex, timer / timermax);
        obj_growtangle.image_yscale = lerp(obj_growtangle.image_yscale, maxscaley, timer / timermax);
    }
    if (timer > timermax) {
        var maxscalex = lerp(5, 6, timer / 15);
        var maxscaley = lerp(1.2, 1, timer / 15);
        obj_growtangle.image_xscale = lerp(obj_growtangle.image_xscale, maxscalex, timer / 15);
        obj_growtangle.image_yscale = lerp(obj_growtangle.image_yscale, maxscaley, timer / 15);
    }
    y = obj_growtangle.y - (35 * obj_growtangle.image_yscale);
    if (timer >= 15) { instance_create(x, y - 67, obj_gerson_teleport); instance_destroy(); }
}`,
    draw: ``
  },
  {
    name: 'obj_sneo_wall_controller_new',
    create: `wallsize = 7; wallcountmax = 35; wallcount = 0; wallsetupcount = 0; timer = 0; timer2 = 0; wallcreatetimermax = 30; con = 0; difficulty = 0; x = 0; y = 0;
for (var a = 0; a < 35; a++) { wallcreatetimer[a] = 30; wallspeed[a] = -7; walltype[a] = 1; }
scr_sneo_wall_create(0, 2, 0, 3, 0, 1, 1);
scr_sneo_wall_create(0, 3, 0, 2, 0, 30, 1);
scr_sneo_wall_create(0, 2, 0, 3, 0, 30, 1);
scr_sneo_wall_create(0, 0, 2, 3, 0, 30, 1);`,
    step: `timer++;
if (wallcount < wallsetupcount && timer >= wallcreatetimer[wallcount]) {
    timer = 0;
    var bx = obj_growtangle.x + (obj_growtangle.width / 2) + 40;
    var by = obj_growtangle.y - 60;
    var topTile = instance_create(bx, by - 30, obj_sneo_tile);
    topTile.hspeed = wallspeed[wallcount]; topTile.sprite_index = spr_sneo_head;
    if (breakspot1[wallcount] == 1) { var t1 = instance_create(bx, by + 0, obj_sneo_tile); if (t1) { t1.hspeed = wallspeed[wallcount]; t1.sprite_index = spr_sneo_head; } }
    else if (pipispot1[wallcount] == 1) { var t1 = instance_create(bx, by + 0, obj_sneo_tile); if (t1) { t1.hspeed = wallspeed[wallcount]; t1.sprite_index = spr_sneo_bomb; } }
    if (breakspot2[wallcount] == 2) { var t2 = instance_create(bx, by + 30, obj_sneo_tile); if (t2) { t2.hspeed = wallspeed[wallcount]; t2.sprite_index = spr_sneo_head; } }
    else if (pipispot2[wallcount] == 2) { var t2 = instance_create(bx, by + 30, obj_sneo_tile); if (t2) { t2.hspeed = wallspeed[wallcount]; t2.sprite_index = spr_sneo_bomb; } }
    if (breakspot3[wallcount] == 3) { var t3 = instance_create(bx, by + 60, obj_sneo_tile); if (t3) { t3.hspeed = wallspeed[wallcount]; t3.sprite_index = spr_sneo_head; } }
    else if (pipispot3[wallcount] == 3) { var t3 = instance_create(bx, by + 60, obj_sneo_tile); if (t3) { t3.hspeed = wallspeed[wallcount]; t3.sprite_index = spr_sneo_bomb; } }
    if (breakspot4[wallcount] == 4) { var t4 = instance_create(bx, by + 90, obj_sneo_tile); if (t4) { t4.hspeed = wallspeed[wallcount]; t4.sprite_index = spr_sneo_head; } }
    else if (pipispot4[wallcount] == 4) { var t4 = instance_create(bx, by + 90, obj_sneo_tile); if (t4) { t4.hspeed = wallspeed[wallcount]; t4.sprite_index = spr_sneo_bomb; } }
    var botTile = instance_create(bx, by + 120, obj_sneo_tile);
    botTile.hspeed = wallspeed[wallcount]; botTile.sprite_index = spr_sneo_head;
    wallcount++;
}`,
    draw: ``
  }
];

const mockCtx = {
  save: ()=>{}, restore: ()=>{}, translate: ()=>{}, rotate: ()=>{}, scale: ()=>{},
  fillRect: ()=>{}, fillText: ()=>{}, beginPath: ()=>{}, arc: ()=>{}, fill: ()=>{},
  drawImage: ()=>{}, stroke: ()=>{}, strokeRect: ()=>{}, moveTo: ()=>{}, lineTo: ()=>{},
  set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){}, set globalAlpha(v){},
  set globalCompositeOperation(v){}, set font(v){}
};

console.log('=== RUNNING REAL GML PRESET INTEGRATION TEST ===');

for (const p of PRESETS) {
  const runtime = new GMLRuntimeEnvironment();
  global.activeGMLRuntime = runtime;
  const translator = new GMLTranslator(runtime);

  const compiled = translator.compileObject(p.name, { create: p.create, step: p.step, draw: p.draw });
  if (compiled.errors.length > 0) {
    console.error(`❌ [${p.name}] Transpile warnings:`, compiled.errors);
  }

  const factory = new Function(
    'GMLInstance', 'runtime',
    'instance_create', 'scr_childbullet', 'instance_destroy', 'instance_exists',
    'mean', 'scr_approach', 'scr_ease_out', 'scr_get_box', 'scr_fire_bullet', 'scr_lerpvar', 'scr_sneo_wall_create',
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
    compiled.code + `;\nreturn ${p.name};`
  );

  const ObjClass = factory(
    GMLInstance, runtime,
    global.instance_create, global.scr_childbullet, global.instance_destroy, global.instance_exists,
    global.mean, global.scr_approach, global.scr_ease_out, global.scr_get_box, global.scr_fire_bullet, global.scr_lerpvar, global.scr_sneo_wall_create,
    Math.sin, Math.cos, Math.abs, Math.ceil, Math.floor, Math.round, Math.min, Math.max, Math.sqrt, Math.sign,
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

  runtime.registerObject(p.name, ObjClass);
  runtime.registerObject('obj_knight_pointing_starchild', GMLInstance);
  runtime.registerObject('obj_knight_diamondswordbullet_ext', GMLInstance);
  runtime.registerObject('obj_tunnel_blade', GMLInstance);
  runtime.registerObject('obj_gerson_slash', GMLInstance);
  runtime.registerObject('obj_gerson_teleport', GMLInstance);
  runtime.registerObject('obj_sneo_tile', GMLInstance);

  runtime.createInstance(p.name, 320, 240);

  let peakInst = 0;
  let stepErrors = 0;
  for (let f = 0; f < 100; f++) {
    const errCountBefore = runtime.errorLog.length;
    runtime.step();
    if (runtime.errorLog.length > errCountBefore) {
      stepErrors++;
    }
    if (runtime.instances.length > peakInst) peakInst = runtime.instances.length;
  }

  try {
    runtime.draw(mockCtx);
    if (stepErrors === 0) {
      console.log(`✅ [${p.name}] Passed 100 frames! Peak active instances: ${peakInst}`);
    } else {
      console.error(`❌ [${p.name}] Had ${stepErrors} frame errors! Logs:`, runtime.errorLog);
    }
  } catch(e) {
    console.error(`❌ [${p.name}] Draw failed:`, e.message);
  }
}

console.log('=== ALL REAL GML PRESET INTEGRATION TESTS COMPLETE ===');
