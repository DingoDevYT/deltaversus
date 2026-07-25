global.window = global;
require('../docs/js/gml_runtime.js');
require('../docs/js/gml_translator.js');
require('../docs/js/gml_presets.js');

const translator = new window.GMLTranslator();

const targetNames = ['obj_knight_roaring2', 'obj_knight_roaring_star', 'obj_gerson_box_rumble_controller', 'obj_gerson_shell_pinball', 'obj_sneo_crusher_chase'];

targetNames.forEach(name => {
  console.log('\n==================================================');
  console.log('DEBUGGING: ' + name);
  console.log('==================================================');
  const compiled = translator.compileObject(name, window.GML_MASTER_PRESETS[name]);
  try {
    new Function('GMLInstance', 'runtime', compiled.code);
    console.log('SUCCESS!');
  } catch (err) {
    console.log('FUNCTION COMPILATION ERROR:', err.message);
    const lines = compiled.code.split('\n');
    lines.forEach((line, i) => {
      // Print line with error line context
      if (line.includes('TRANSLATION ERROR') || line.includes('/* with') || line.includes('this.') || line.includes('let')) {
        // console.log(`${i+1}: ${line}`);
      }
    });
    console.log('FULL COMPILED CODE:');
    console.log(compiled.code);
  }
});
