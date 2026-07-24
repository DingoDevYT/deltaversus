const fs = require('fs');
const dbCode = fs.readFileSync('docs/js/gml_asset_db.js', 'utf8');
const runtimeCode = fs.readFileSync('docs/js/gml_runtime.js', 'utf8');
const translatorCode = fs.readFileSync('docs/js/gml_translator.js', 'utf8');
eval(dbCode); eval(runtimeCode); eval(translatorCode);

const translator = new GMLTranslator();
const PRESETS = {
  knight_star: {
    name: 'obj_knight_pointing_star',
    create: `direction = point_direction(x, y, obj_heart.x, obj_heart.y);
speed = 2;
friction = -0.05;
image_angle = direction;
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
      d.image_blend = c_red;
    }
    instance_destroy();
  }
}`
  }
};

const objName = PRESETS.knight_star.name;
const compiled = translator.compileObject(objName, { create: PRESETS.knight_star.create, step: PRESETS.knight_star.step });
console.log('Compiled Code:\n', compiled.code);

try {
  const evalFunc = new Function('GMLInstance', 'gmlMath', 'Snd', 'runtime', compiled.code + ';\nreturn ' + objName + ';');
  const ObjectClass = evalFunc(GMLInstance, gmlMath, { play: () => {} }, new GMLRuntimeEnvironment());
  console.log('Evaluated Class successfully:', ObjectClass);
} catch(err) {
  console.error('EVAL ERROR:', err);
}
