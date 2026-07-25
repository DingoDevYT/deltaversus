const fs = require('fs');

const dbCode = fs.readFileSync('docs/js/gml_asset_db.js', 'utf8');
const runtimeCode = fs.readFileSync('docs/js/gml_runtime.js', 'utf8');
const translatorCode = fs.readFileSync('docs/js/gml_translator.js', 'utf8');

eval(dbCode); eval(runtimeCode); eval(translatorCode);

const translator = new GMLTranslator();

const PRESETS = [
  {
    name: 'obj_knight_pointing_star',
    create: `direction = point_direction(x, y, obj_heart.x, obj_heart.y);
speed = 2;
friction = -0.05;
image_angle = direction;
sprite_index = "spr_knight_bullet_star";
timer = 0;
con = 0;
growspeed = 0.05;
playSound = 1;
difficulty = 2;`,
    step: `timer += 1;
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
}`
  },
  {
    name: 'obj_knight_tunnel_slasher_2_revised',
    create: `vspeed = 0;
hspeed = -4;
timer = 0;
vertical_pos = 0;`,
    step: `timer += 1;
if (timer % 8 == 0) {
  var newpos = vertical_pos + 15 + irandom(90);
  if (newpos > 60) newpos -= 120;
  vertical_pos = clamp(newpos, -50, 50);
  
  var gapY = obj_growtangle.y + vertical_pos;
  var topBlade = instance_create(x, gapY - 70, obj_tunnel_blade);
  topBlade.hspeed = -5;
  topBlade.image_angle = 270;
  topBlade.sprite_index = "spr_knight_sword";
  
  var botBlade = instance_create(x, gapY + 70, obj_tunnel_blade);
  botBlade.hspeed = -5;
  botBlade.image_angle = 90;
  botBlade.sprite_index = "spr_knight_sword";
}`
  },
  {
    name: 'obj_gerson_squishes_box',
    create: `timer = 0;`,
    step: `timer += 1;
if (timer == 26) {
  obj_growtangle.image_xscale = 2.5;
  obj_growtangle.image_yscale = 0.3;
}
if (timer > 30 && timer < 120 && timer % 12 == 0) {
  var slash = instance_create(obj_growtangle.x + random_range(-140, 140), obj_growtangle.y, obj_gerson_slash);
  slash.sprite_index = "spr_gerson_hammer";
}`
  },
  {
    name: 'obj_sneo_wall_controller_new',
    create: `timer = 0;
spd = -16;`,
    step: `timer += 1;
if (timer < 16) spd += 0.6;
else spd -= 0.1;

if (timer % 34 == 0) {
  for (var r = 0; r < 5; r++) {
    if (r !== 2) {
      var tile = instance_create(x, obj_growtangle.y - 60 + r * 30, obj_sneo_tile);
      tile.hspeed = spd;
      tile.sprite_index = "spr_sneo_head";
    }
  }
}`
  }
];

let allPassed = true;

for (const p of PRESETS) {
  const compiled = translator.compileObject(p.name, { create: p.create, step: p.step });
  const runtime = new GMLRuntimeEnvironment();
  try {
    const evalFunc = new Function(
      'GMLInstance', 'gmlMath', 'Snd', 'runtime', 
      'draw_sprite_ext', 'draw_set_blend_mode', 'scr_draw_beam_color', 'sprite_get_width', 'sprite_get_height', 
      'scr_afterimage', 'merge_color', 'toCSSColor', 'scr_ease_in', 'bm_add', 'bm_normal',
      'c_white', 'c_red', 'c_black', 'c_blue', 'c_yellow', 'c_gray',
      compiled.code + `;\nreturn ${p.name};`
    );

    const ObjectClass = evalFunc(
      GMLInstance, gmlMath, { play: () => {} }, runtime, 
      draw_sprite_ext, draw_set_blend_mode, scr_draw_beam_color, sprite_get_width, sprite_get_height,
      scr_afterimage, merge_color, toCSSColor, scr_ease_in, bm_add, bm_normal,
      '#ffffff', '#ff0000', '#000000', '#0000ff', '#ffff00', '#808080'
    );

    runtime.registerObject(p.name, ObjectClass);
    runtime.createInstance(p.name, 320, 240);

    for (let frame = 0; frame < 60; frame++) {
      runtime.step();
    }
    console.log(`PRESET PASSED [${p.name}]: Active instances = ${runtime.instances.length}`);
  } catch(err) {
    allPassed = false;
    console.error(`PRESET FAILED [${p.name}]:`, err);
  }
}

if (allPassed) {
  console.log('ALL PRESETS VERIFIED FLawlessly!');
}
