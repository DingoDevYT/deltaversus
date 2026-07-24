/**
 * GML Multi-Script Translator Engine (gml_translator.js)
 * Transpiles GameMaker Language (GML) source code into executable JavaScript object classes.
 * Supports multi-script event binding (Create, Step, Draw, Alarms) and inheritance resolution.
 */

(function(global) {
  'use strict';

  class GMLTranslator {
    constructor(options = {}) {
      this.options = Object.assign({
        targetEngine: 'runtime',
        objectName: 'GMLObject',
      }, options);
    }

    /**
     * Main translation entry point for raw GML code.
     */
    translate(gmlCode) {
      if (!gmlCode || typeof gmlCode !== 'string') return '';

      let code = gmlCode;

      // 1. Preserve Comments & Clean CRLF
      code = code.replace(/\r\n/g, '\n');

      // 2. Convert GML var declarations (var a, b; or var a = 5;)
      code = code.replace(/\bvar\s+([a-zA-Z0-9_,\s=]+);/g, (match, vars) => {
        let decls = vars.split(',').map(v => {
          v = v.trim();
          if (v.includes('=')) return 'let ' + v;
          return 'let ' + v + ' = 0';
        }).join('; ');
        return decls + ';';
      });

      // 3. Map GML exit statement -> return
      code = code.replace(/\bexit;/g, 'return;');
      code = code.replace(/\bscr_bullet_init\(\);?/g, '');

      // 4. Map Built-in GameMaker Objects & Camera References
      code = code.replace(/\bcamerax\(\)/g, '(runtime.growtangle.x - 320)');
      code = code.replace(/\bcameray\(\)/g, '(runtime.growtangle.y - 240)');
      code = code.replace(/\bobj_growtangle\.x\b/g, 'runtime.growtangle.x');
      code = code.replace(/\bobj_growtangle\.y\b/g, 'runtime.growtangle.y');
      code = code.replace(/\bobj_growtangle\.image_xscale\b/g, 'runtime.growtangle.image_xscale');
      code = code.replace(/\bobj_growtangle\.image_yscale\b/g, 'runtime.growtangle.image_yscale');
      code = code.replace(/\b(obj_heart|obj_mainchara|obj_soul)\.x\b/g, 'runtime.soul.x');
      code = code.replace(/\b(obj_heart|obj_mainchara|obj_soul)\.y\b/g, 'runtime.soul.y');

      // 5. Map Math Functions
      code = code.replace(/\blengthdir_x\b/g, 'gmlMath.lengthdir_x');
      code = code.replace(/\blengthdir_y\b/g, 'gmlMath.lengthdir_y');
      code = code.replace(/\bdsin\b/g, 'gmlMath.dsin');
      code = code.replace(/\bdcos\b/g, 'gmlMath.dcos');
      code = code.replace(/\bdtan\b/g, 'gmlMath.dtan');
      code = code.replace(/\bpoint_direction\b/g, 'gmlMath.point_direction');
      code = code.replace(/\bpoint_distance\b/g, 'gmlMath.point_distance');
      code = code.replace(/\birandom_range\b/g, 'gmlMath.irandom_range');
      code = code.replace(/\brandom_range\b/g, 'gmlMath.random_range');
      code = code.replace(/\birandom\b/g, 'gmlMath.irandom');
      code = code.replace(/\brandom\b/g, 'gmlMath.random');
      code = code.replace(/\bchoose\b/g, 'gmlMath.choose');
      code = code.replace(/\bdegtorad\b/g, 'gmlMath.degtorad');
      code = code.replace(/\bradtodeg\b/g, 'gmlMath.radtodeg');
      code = code.replace(/\bclamp01\b/g, 'gmlMath.clamp01');
      code = code.replace(/\bclamp\b/g, 'gmlMath.clamp');
      code = code.replace(/\blerp\b/g, 'gmlMath.lerp');
      code = code.replace(/\bsin\b/g, 'Math.sin');
      code = code.replace(/\bcos\b/g, 'Math.cos');
      code = code.replace(/\babs\b/g, 'Math.abs');
      code = code.replace(/\bfloor\b/g, 'Math.floor');
      code = code.replace(/\bceil\b/g, 'Math.ceil');
      code = code.replace(/\bmin\b/g, 'Math.min');
      code = code.replace(/\bmax\b/g, 'Math.max');
      code = code.replace(/\bsqrt\b/g, 'Math.sqrt');

      // 6. Map GML Bullet & Child Creation Scripts
      code = code.replace(/\bscr_childbullet\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, 'runtime.createInstance($3, $1, $2)');
      code = code.replace(/\bscr_bullet_create\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, 'runtime.createInstance($3, $1, $2)');
      code = code.replace(/\binstance_create\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, 'runtime.createInstance($3, $1, $2)');
      code = code.replace(/\binstance_create_depth\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/g, 'runtime.createInstance($4, $1, $2)');
      code = code.replace(/\binstance_destroy\(\)/g, 'runtime.destroyInstance(this)');
      code = code.replace(/\binstance_exists\(([^)]+)\)/g, 'runtime.instances.some(i => i.object_name === $1 && !i.destroyed)');
      code = code.replace(/\baudio_play_sound\(([^,]+)[^)]*\)/g, 'Snd.play($1)');
      code = code.replace(/\bsnd_play\(([^)]+)\)/g, 'Snd.play($1)');

      // 7. Map GML with() Loops: with (obj) { body } -> runtime.with(obj, function(inst) { body })
      code = code.replace(/\bwith\s*\(([^)]+)\)\s*\{/g, 'runtime.with($1, function(inst) {');

      // 8. Map GML Array syntax alarm[0] -> this.alarm[0]
      code = code.replace(/\balarm\[([0-9]+)\]/g, 'this.alarm[$1]');

      // 9. Map GML Instance Variables ONLY when NOT preceded by a dot (.)
      const gmlVarList = [
        'vspeed', 'hspeed', 'speed', 'direction', 'gravity', 'gravity_direction', 'friction',
        'image_xscale', 'image_yscale', 'image_angle', 'image_alpha', 'image_index', 'image_speed',
        'image_blend', 'sprite_index', 'mask_index', 'depth', 'xstart', 'ystart', 'xprevious', 'yprevious',
        'grazed', 'grazetimer', 'destroyonhit', 'target', 'inv', 'damage', 'element', 'grazepoints', 'active', 'updateimageangle', 'x', 'y'
      ];

      gmlVarList.forEach(v => {
        const regex = new RegExp('(?<![a-zA-Z0-9_\\.])\\b' + v + '\\b', 'g');
        code = code.replace(regex, 'this.' + v);
      });

      return code;
    }

    /**
     * Compiles an entire GameMaker Object from its Create, Step, Draw, and Alarm scripts.
     */
    compileObject(objectName, events = {}) {
      const parentObj = global.gmlAssets ? (global.gmlAssets.getObjectInfo(objectName)?.parent || 'GMLInstance') : 'GMLInstance';
      const baseClass = (parentObj && parentObj !== '0' && parentObj !== '') ? parentObj : 'GMLInstance';

      const transpiledCreate = this.translate(events.create || '');
      const transpiledStep = this.translate(events.step || '');
      const transpiledDraw = this.translate(events.draw || '');

      // Process Alarms 0..11
      let alarmMethods = '';
      for (let i = 0; i < 12; i++) {
        if (events[`alarm_${i}`]) {
          alarmMethods += `
  alarm_${i}() {
    try {
      ${this.translate(events[`alarm_${i}`])}
    } catch(err) {
      console.error("GML Alarm ${i} Error [${objectName}]:", err);
    }
  }
          `;
        }
      }

      const classCode = `
class ${objectName} extends (runtime.objectDefinitions['${baseClass}'] || GMLInstance) {
  constructor(objectType, x, y, id) {
    super(objectType, x, y, id);
  }

  create() {
    if (typeof super.create === 'function') super.create();
    try {
      ${transpiledCreate}
    } catch(err) {
      console.error("GML Create Error [${objectName}]:", err);
    }
  }

  step() {
    if (typeof super.step === 'function') super.step();
    try {
      ${transpiledStep}
    } catch(err) {
      console.error("GML Step Error [${objectName}]:", err);
    }
  }

  draw(ctx) {
    try {
      if (${transpiledDraw.trim().length > 0 ? 'true' : 'false'}) {
        ${transpiledDraw}
      } else {
        super.draw(ctx);
      }
    } catch(err) {
      console.error("GML Draw Error [${objectName}]:", err);
      super.draw(ctx);
    }
  }

  ${alarmMethods}
}
      `;

      return {
        objectName,
        code: classCode,
        transpiledCreate,
        transpiledStep,
        transpiledDraw,
      };
    }
  }

  global.GMLTranslator = GMLTranslator;

})(typeof window !== 'undefined' ? window : global);
