/**
 * gml_translator.js — assembles compiled GML events into a runtime class.
 *
 * The public shape is unchanged (`new GMLTranslator(runtime).compileObject(name, events)`
 * -> `{ objectName, code, errors }`) so gml_studio.html and scripts/*.js keep
 * working, but the guts are now the real front end in gml_compiler.js +
 * gml_codegen.js instead of line-by-line regex substitution.
 *
 * Emitted shape:
 *
 *   class NAME extends ($R.base('parent') || GMLInstance) {
 *     constructor(objectType, x, y, id) { super(...); $R.initInstance(this, 'NAME', {...}); }
 *     create($other) { const $s0 = this, $o0 = ...; <body> }
 *     step($other)   { ... }
 *     draw(ctx)      { ... }
 *     alarm_0()      { ... }
 *     userEvent0()   { ... }
 *   }
 */
(function (global) {
  'use strict';

  /** Fields GMLInstance already defines — never hoisted as fresh variables. */
  const BUILTIN_INSTANCE_VARS = new Set([
    'id', 'object_index', 'object_name', 'x', 'y', 'xstart', 'ystart',
    'xprevious', 'yprevious', 'hspeed', 'vspeed', 'speed', 'direction',
    'gravity', 'gravity_direction', 'friction', 'sprite_index', 'mask_index',
    'image_index', 'image_number', 'image_speed', 'image_xscale', 'image_yscale',
    'image_angle', 'image_alpha', 'image_blend', 'sprite_width', 'sprite_height',
    // sprite_xoffset/yoffset are BUILT-IN read-onlys (the sprite's origin scaled
    // by image_x/yscale). Hoisting them as fresh locals zeroed them, which is
    // what made obj_growtangle bake its custom battle box around the wrong point.
    'sprite_xoffset', 'sprite_yoffset',
    'depth', 'visible', 'persistent', 'solid', 'alarm', 'destroyed',
    'bbox_left', 'bbox_right', 'bbox_top', 'bbox_bottom',
  ]);

  /** events key -> generated method name. */
  const EVENT_METHODS = (() => {
    const m = {
      create: 'create',
      destroy: 'destroyEvent',
      step: 'step',
      step_begin: 'stepBegin',
      step_end: 'stepEnd',
      draw: 'draw',
      draw_begin: 'drawBegin',
      draw_end: 'drawEnd',
      draw_pre: 'drawPre',
      draw_post: 'drawPost',
      draw_gui: 'drawGui',
      draw_gui_begin: 'drawGuiBegin',
      draw_gui_end: 'drawGuiEnd',
      cleanup: 'cleanUp',
    };
    for (let i = 0; i < 12; i++) m[`alarm_${i}`] = `alarm_${i}`;
    // Other_0 = Outside Room, Other_7 = Animation End. The runtime's step loop
    // fires outsideRoom when the box leaves the room and animationEnd when
    // image_index wraps past image_number.
    m.other_0 = 'outsideRoom';
    m.other_7 = 'animationEnd';
    // GameMaker's user events are Other_10..Other_25 in the decompiled dumps.
    for (let i = 0; i < 16; i++) {
      m[`other_${10 + i}`] = `userEvent${i}`;
      m[`user_${i}`] = `userEvent${i}`;
      m[`userevent${i}`] = `userEvent${i}`;
    }
    return m;
  })();

  class GMLTranslator {
    constructor(runtime) {
      this.runtime = runtime;
      this.errors = [];
      this.extraScripts = new Set();
    }

    /** GlobalScript sources for a chapter — these compile into `$R.scr`, so a
     *  call like `scr_afterimage_cut()` runs real GML instead of a stub. */
    scriptSources(chapter) {
      const byCh = global.GML_SCRIPT_SOURCES_BY_CHAPTER;
      if (byCh && byCh[chapter]) return byCh[chapter];
      return global.GML_SCRIPT_SOURCES || {};
    }

    /**
     * Names the codegen may resolve to `$R.scr` for a chapter. This is every
     * function DECLARED by the sources, not just the file names: one file often
     * declares several functions, and callers use the function names.
     */
    scriptNames(chapter) {
      if (this._nameCache && this._nameCache.chapter === chapter) return this._nameCache.set;
      const sources = this.scriptSources(chapter);
      const set = new Set(Object.keys(sources));
      // Anchored at COLUMN 0. All 5402 GlobalScript function declarations in the
      // corpus start there; the only INDENTED ones are five functions nested
      // inside constructors. Harvesting those made them look like GlobalScripts,
      // and `fade` is a name ch5 objects use as an ordinary instance variable —
      // so every object's `fade` collapsed into one process-wide $R.scr slot
      // shared by obj_bullet_orange_debris and obj_afterimage_grow.
      const re = /^function\s+([a-zA-Z_]\w*)\s*\(/gm;
      for (const src of Object.values(sources)) {
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(src))) set.add(m[1]);
      }
      for (const n of this.extraScripts) set.add(n);
      this._nameCache = { chapter, set };
      return set;
    }

    /**
     * Functions objects define on THEMSELVES (GML 2.3 methods declared in an
     * event, e.g. `function DoFlip(arg0 = -1)` in obj_shutta_photo_attack's
     * Create). A caller reaches them through `with (thing) DoFlip(1)`, so they
     * resolve against `self` at runtime, not against a global. Knowing the names
     * lets the codegen stop reporting them as unknown functions.
     */
    methodNames(chapter) {
      if (this._methodCache && this._methodCache.chapter === chapter) return this._methodCache.set;
      const set = new Set();
      const byCh = global.GML_OBJECT_EVENTS_BY_CHAPTER;
      const table = (byCh && byCh[chapter]) || {};
      // Both declaration styles GML 2.3 uses for instance methods:
      //   function cycle() { ... }              (obj_shutta_photo_attack)
      //   cycle = function () { ... }           (ch5 objects favour this)
      //   static init = function () { ... }
      const reDecl = /\bfunction\s+([a-zA-Z_]\w*)\s*\(/g;
      const reAssign = /\b(?:static\s+)?([a-zA-Z_]\w*)\s*=\s*function\b/g;
      const scan = src => {
        if (typeof src !== 'string') return;
        let m;
        reDecl.lastIndex = 0;
        while ((m = reDecl.exec(src))) set.add(m[1]);
        reAssign.lastIndex = 0;
        while ((m = reAssign.exec(src))) set.add(m[1]);
      };
      for (const bundle of Object.values(table)) for (const src of Object.values(bundle)) scan(src);
      // The preset table can define methods too.
      for (const p of Object.values(global.GML_MASTER_PRESETS || {})) {
        for (const ev of ['create', 'step', 'draw']) scan(p[ev]);
      }
      this._methodCache = { chapter, set };
      return set;
    }

    /** Which chapter's asset index table applies. Affects raw-index resolution. */
    static chapterOf(events, objectName) {
      // An explicit `chapter: 'ch2'` wins. This used to be run through a
      // /Chapter\s*([1-5])/ match, which never matches "ch2" — so every caller
      // passing a direct chapter was silently ignored and fell through to the
      // guess below. For an object that exists in several chapters
      // (obj_dbulletcontroller is in ch2 AND ch3) that picked the wrong script
      // set, object defaults and asset-index table.
      const explicit = events && events.chapter;
      if (typeof explicit === 'string' && /^ch[1-5]$/.test(explicit)) return explicit;
      if (typeof explicit === 'number' && explicit >= 1 && explicit <= 5) return 'ch' + explicit;

      const label = (events && (events.label || events.chapter)) || '';
      const m = /Chapter\s*([1-5])/i.exec(label);
      if (m) return 'ch' + m[1];
      if (typeof global.GML_OBJECT_INDEX !== 'undefined' && objectName) {
        // Fall back to whichever chapter actually defines this object.
        for (const key of ['ch3', 'ch4', 'ch2', 'ch5', 'ch1']) {
          const c = global.GML_OBJECT_INDEX.chapters[key];
          if (c && c.objectIndex.has(objectName)) return key;
        }
      }
      return 'ch3';
    }

    compileObject(objectName, events) {
      this.errors = [];
      events = events || {};
      objectName = String(objectName || 'obj_translated');

      const chapter = GMLTranslator.chapterOf(events, objectName);
      const defaults = (typeof global.GML_OBJECT_INDEX !== 'undefined')
        ? global.GML_OBJECT_INDEX.defaults(objectName, chapter)
        : { sprite_index: '', mask_index: '', depth: 0, visible: true, persistent: false, parent: null };

      const cg = new global.GMLCodegen({
        scripts: this.scriptNames(chapter),
        methods: this.methodNames(chapter),
        chapter,
      });
      cg.objectName = objectName;

      const methods = [];
      const seen = new Set();
      /** Events that failed to compile — surfaced on the class as $gmlDeadEvents. */
      const deadEvents = [];
      // [otherObjectName, methodName] pairs — the runtime's collision phase
      // reads these off the class to know which overlaps to test.
      const collisionPairs = [];

      for (const key of Object.keys(events)) {
        const lower = key.toLowerCase();
        let method = EVENT_METHODS[lower];
        if (lower.startsWith('collision:')) {
          const otherName = key.slice('collision:'.length);
          method = 'collision__' + otherName.replace(/[^A-Za-z0-9_]/g, '_');
          collisionPairs.push([otherName, method]);
        }
        if (!method) continue;                     // name/label/parent/etc.
        const src = events[key];
        if (typeof src !== 'string' || !src.trim()) continue;
        if (seen.has(method)) continue;
        seen.add(method);

        let body = '';
        try {
          const parsed = global.GML_PARSE(src);
          Object.assign(cg.macros, parsed.macros);
          Object.assign(cg.enums, parsed.enums);
          cg.usedOther = false;
          // event_inherited() has to name the GENERATED METHOD, not the event
          // key: the parent's prototype carries `userEvent5`, never `other_15`.
          // Passing the key looked up a method that cannot exist, so every
          // inherited event outside create/step/draw/alarm_N silently did
          // nothing — including other_15, the bullet-hit-the-soul hook.
          cg.eventMethod = method;
          body = cg.generateEvent(parsed.ast, lower);
        } catch (err) {
          this.errors.push(`[${objectName}.${key}] ${err.message}`);
          body = `    /* COMPILE ERROR: ${escapeComment(err.message)} */`;
          // SHOUT. A failed event compiles to an empty method that never
          // throws, so at runtime a dead Draw is indistinguishable from an
          // object that legitimately draws nothing. That is how a single lexer
          // bug silently blanked obj_purplecontrols' entire Draw — and with it
          // the rotating box, the 3D tunnel and the node maze — while every
          // sweep reported "0 errors". Record it on the class too, so callers
          // can ask what is dead rather than guess.
          if (typeof console !== 'undefined' && console.error) {
            console.error(`[gml] ${objectName}.${key} FAILED TO COMPILE — this event will do NOTHING at runtime: ${err.message}`);
          }
          deadEvents.push(`${key}: ${err.message}`);
        }

        methods.push(this.emitMethod(method, body, objectName, cg));
      }

      // A draw event is not optional at runtime: without one, nothing renders.
      //
      // But it must not SHADOW an inherited one. This class extends its GML
      // parent, so declaring `draw` here overrides a parent that has a real Draw
      // event — obj_darkshape_centipede_head and _segment have no Draw of their
      // own and rely on obj_darkshape_parent's, and the fallback replaced it
      // with a plain drawSelf, losing the Titan's centipede rendering entirely.
      // Defer to the prototype chain when an ancestor supplies one.
      if (!seen.has('draw')) {
        const drawingParent = defaults.parent
          && (global.GML_OBJECT_INDEX
            ? global.GML_OBJECT_INDEX.parentChain(objectName, chapter)
            : []).length > 0;
        methods.push(drawingParent
          // Must be `super.draw`, NOT a prototype walk from `this`.
          // `Object.getPrototypeOf(Object.getPrototypeOf(this))` is computed from
          // the INSTANCE, so it yields the same prototype at every level of the
          // chain and never advances. When two objects in a chain both land on
          // this fallback — obj_sneo_cshot -> obj_basicbullet_sneo ->
          // obj_collidebullet all do — the parent's copy recomputes the identical
          // prototype and calls itself: infinite recursion, every frame, for 28
          // presets across Spamton NEO, Gerson and the Roaring Knight.
          // `super` is bound to the method's home object, so it walks up exactly
          // one level per class. GMLInstance.prototype.draw (gml_runtime.js:368)
          // terminates the chain by calling drawSelf.
          ? `  draw(ctx) {\n    const $s = super.draw;\n    if (typeof $s === 'function') $s.call(this, ctx);\n    else this.drawSelf(ctx);\n  }`
          : `  draw(ctx) {\n    this.drawSelf(ctx);\n  }`);
      }

      const hoisted = [...cg.instanceVars]
        .filter(n => !BUILTIN_INSTANCE_VARS.has(n))
        .sort();

      const parentExpr = defaults.parent ? `$R.base(${JSON.stringify(defaults.parent)}) || GMLInstance` : 'GMLInstance';

      const code = `const $R = window.GML_HELPERS.for(runtime);
const $G = window;

class ${objectName} extends (${parentExpr}) {

  constructor(objectType, x, y, id) {
    super(objectType, x, y, id);
    $R.initInstance(this, ${JSON.stringify(objectName)}, ${JSON.stringify(defaults)}, ${JSON.stringify(hoisted)});
  }

${methods.join('\n\n')}
}
${objectName}.$gmlObject = ${JSON.stringify(objectName)};
${objectName}.$gmlChapter = ${JSON.stringify(chapter)};
${objectName}.$gmlParent = ${JSON.stringify(defaults.parent)};
${deadEvents.length ? `${objectName}.$gmlDeadEvents = ${JSON.stringify(deadEvents)};` : ''}
${collisionPairs.length ? `${objectName}.$collisions = ${JSON.stringify(collisionPairs)};` : ''}`;

      for (const w of cg.warnings) this.errors.push(`[${objectName}] ${w}`);

      return { objectName, code, errors: [...this.errors], chapter, hoisted };
    }

    emitMethod(method, body, objectName, cg) {
      const isDraw = method === 'draw' || method === 'drawEnd' || method === 'drawBegin'
        || method === 'drawPre' || method === 'drawPost'
        || method === 'drawGui' || method === 'drawGuiBegin' || method === 'drawGuiEnd';
      const sig = isDraw ? `${method}(ctx)` : `${method}($other)`;
      const prologue = [`    const $s0 = this;`];
      prologue.push(`    const $o0 = ($other !== undefined && $other !== null) ? $other : this;`);
      if (isDraw) {
        prologue[1] = `    const $o0 = this;`;
        prologue.push(`    $R.setCtx(ctx);`);
      }
      // The `void` keeps the unused-binding case from tripping strict-mode linters
      // without changing behaviour.
      prologue.push(`    void $o0;`);

      // No implicit super call: GameMaker does NOT run a parent's event code
      // unless the child explicitly calls event_inherited(), which compiles to
      // $R.inherited(...).
      return `  ${sig} {
${prologue.join('\n')}
    try {
${body}
    } catch (err) {
      $R.eventError(${JSON.stringify(objectName)}, ${JSON.stringify(method)}, err);${isDraw ? '\n      try { this.drawSelf(ctx); } catch (e) {}' : ''}
    }
  }`;
    }

    /**
     * Compile the support objects an attack spawns (warps, afterimages, hit
     * sparks, delayed-script carriers). Without these they are inert
     * GMLInstances that never animate and never destroy themselves.
     *
     * Units come back parents-first, because a generated class extends
     * `$R.base(parent)` and that only resolves if the parent is already
     * registered on the runtime.
     *
     * @returns {{units: Array<{objectName: string, code: string}>, errors: string[]}}
     */
    compileSupportObjects(chapter, skipNames) {
      chapter = chapter || 'ch3';
      const table = (global.GML_OBJECT_EVENTS_BY_CHAPTER && global.GML_OBJECT_EVENTS_BY_CHAPTER[chapter]) || {};
      const skip = skipNames instanceof Set ? skipNames : new Set(skipNames || []);
      const names = Object.keys(table).filter(n => !skip.has(n));

      const units = [];
      const errors = [];
      for (const name of GMLTranslator.sortByInheritance(names, chapter)) {
        try {
          const c = this.compileObject(name, Object.assign({ chapter }, table[name]));
          units.push({ objectName: name, code: c.code });
          for (const e of c.errors) errors.push(e);
        } catch (err) {
          errors.push(`[support ${name}] ${err.message}`);
        }
      }
      return { units, errors };
    }

    /**
     * Compile ONE GlobalScript file into evaluable JS. Used by the runtime's
     * just-in-time path ($R.scrCall) so a chapter's 600 scripts don't all
     * compile up front — only what an attack actually calls.
     * @returns {string|null} code that installs the functions into $R.scr.
     */
    compileSingleScript(chapter, name) {
      const sources = this.scriptSources(chapter);
      let src = sources[name];
      if (typeof src !== 'string') {
        // The table is keyed by FILE; `name` may be a function declared inside
        // a differently-named file (d_triangle lives in ossafe_shapes.gml).
        if (!this._fnFile || this._fnFile.chapter !== chapter) {
          const map = new Map();
          // Anchored at COLUMN 0. All 5402 GlobalScript function declarations in the
      // corpus start there; the only INDENTED ones are five functions nested
      // inside constructors. Harvesting those made them look like GlobalScripts,
      // and `fade` is a name ch5 objects use as an ordinary instance variable —
      // so every object's `fade` collapsed into one process-wide $R.scr slot
      // shared by obj_bullet_orange_debris and obj_afterimage_grow.
      const re = /^function\s+([a-zA-Z_]\w*)\s*\(/gm;
          for (const [fileKey, fileSrc] of Object.entries(sources)) {
            let m;
            re.lastIndex = 0;
            while ((m = re.exec(fileSrc))) if (!map.has(m[1])) map.set(m[1], fileKey);
          }
          this._fnFile = { chapter, map };
        }
        const fileKey = this._fnFile.map.get(name);
        if (!fileKey) return null;
        src = sources[fileKey];
        name = fileKey;   // compile the whole file; it installs every declared fn
      }
      if (typeof src !== 'string') return null;
      const known = this.scriptNames(chapter);
      const errors = [];
      let parsed;
      try { parsed = global.GML_PARSE(src); } catch (err) { return null; }
      const decls = parsed.ast.body.filter(s => s && s.type === 'FunctionDecl' && s.name);
      const out = [];
      if (decls.length) {
        for (const decl of decls) {
          const unit = this._emitScript(decl.name, decl.params, decl.body.body, parsed, known, chapter, src, errors);
          if (unit) out.push(unit);
        }
        if (!decls.some(d => d.name === name)) {
          out.push(`$R.scr[${JSON.stringify(name)}] = $R.scr[${JSON.stringify(decls[0].name)}];`);
        }
      } else {
        const unit = this._emitScript(name, [], parsed.ast.body, parsed, known, chapter, src, errors);
        if (unit) out.push(unit);
      }
      if (!out.length) return null;
      return `const $R = window.GML_HELPERS.for(runtime);\nconst $G = window;\n${out.join('\n')}`;
    }

    /**
     * Emit one `$R.scr[name] = function (...)` unit. Scripts run with `this`
     * bound to the caller, which is how GML's legacy scripts scope — that's why
     * `scr_obj_movetowards_point` can read bare `x`/`y` and mean the caller's.
     */
    _emitScript(name, declParams, bodyStatements, parsed, known, chapter, src, errors) {
      const cg = new global.GMLCodegen({ scripts: known, chapter });
      cg.objectName = name;
      cg.isScript = true;
      Object.assign(cg.macros, parsed.macros);
      Object.assign(cg.enums, parsed.enums);

      try {
        const params = declParams.map(p => p.name);
        const defaults = [];
        for (const p of declParams) {
          if (p.default) defaults.push({ name: p.name, node: p.default });
        }

        // Older scripts read inputs as argument0..argumentN rather than declaring
        // parameters (scr_darksize does), and variadic ones index `argument[i]`
        // (scr_script_delayed reads its delay as argument[1]).
        const argMax = maxArgumentIndex(src);
        for (let i = 0; i <= argMax; i++) {
          if (params.indexOf('argument' + i) === -1) params[i] = params[i] || ('argument' + i);
        }
        for (let i = 0; i < params.length; i++) if (!params[i]) params[i] = '$unused' + i;

        const usesArgCount = /\bargument_count\b/.test(src);
        const usesArgArray = /\bargument\s*\[/.test(src);

        cg.scopes = [new Set()];
        cg.selfStack = [{ self: '$s0', other: '$o0' }];
        cg.indent = 2;

        const declared = new Set(params);
        if (usesArgCount) declared.add('argument_count');
        if (usesArgArray) declared.add('argument');
        const hoist = cg.hoistDecl(bodyStatements, declared);
        const body = cg.genStatements(bodyStatements);

        let prologue = '';
        for (const d of defaults) {
          prologue += `    if (${d.name} === undefined) ${d.name} = ${cg.genExpr(d.node)};\n`;
        }
        if (usesArgCount) prologue += `    const argument_count = arguments.length;\n`;
        if (usesArgArray) prologue += `    const argument = Array.prototype.slice.call(arguments);\n`;

        for (const w of cg.warnings) errors.push(`[script ${name}] ${w}`);

        return `$R.scr[${JSON.stringify(name)}] = function (${params.join(', ')}) {
    const $s0 = this, $o0 = this;
    void $o0;
${prologue}    try {
${hoist}${body}
    } catch (err) { $R.eventError(${JSON.stringify(name)}, 'script', err); }
  };`;
      } catch (err) {
        errors.push(`[script ${name}] ${err.message}`);
        return null;
      }
    }

    /** Order object names so every parent precedes its children. */
    static sortByInheritance(names, chapter) {
      const oi = global.GML_OBJECT_INDEX;
      const depth = name => (oi ? oi.parentChain(name, chapter).length : 0);
      return [...names].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
    }

    /**
     * Register extra GlobalScript sources so `scr_foo(...)` compiles to a real call.
     * @param {Object<string,string>} sources  scriptName -> GML source
     */
    registerScripts(sources) {
      if (!sources) return;
      for (const name of Object.keys(sources)) this.extraScripts.add(name);
    }

    /**
     * Compile a chapter's GlobalScripts into JS that populates `$R.scr`.
     * Evaluate the returned code once per runtime, before spawning instances.
     */
    compileScripts(chapter, extraSources) {
      chapter = chapter || 'ch3';
      const sources = Object.assign({}, this.scriptSources(chapter), extraSources || {});
      const names = Object.keys(sources);
      const known = this.scriptNames(chapter);
      for (const n of names) known.add(n);

      const out = [];
      const errors = [];
      for (const fileKey of names) {
        const src = sources[fileKey];
        let parsed;
        try {
          parsed = global.GML_PARSE(src);
        } catch (err) {
          errors.push(`[script ${fileKey}] ${err.message}`);
          continue;
        }

        // One GlobalScript FILE can declare several functions — scr_movetowards.gml
        // declares scr_movetowards, scr_obj_movetowards_obj and
        // scr_obj_movetowards_point. Registering only the first left the others
        // undefined and made the first one return nothing, which quietly turned
        // every caller's value into NaN.
        const decls = parsed.ast.body.filter(s => s && s.type === 'FunctionDecl' && s.name);

        if (decls.length) {
          for (const decl of decls) {
            const unit = this._emitScript(decl.name, decl.params, decl.body.body, parsed, known, chapter, src, errors);
            if (unit) out.push(unit);
          }
          // A file whose functions are all named differently from the file still
          // needs the file name callable, since gen_scripts keyed on it.
          if (!decls.some(d => d.name === fileKey)) {
            out.push(`$R.scr[${JSON.stringify(fileKey)}] = $R.scr[${JSON.stringify(decls[0].name)}];`);
          }
        } else {
          const unit = this._emitScript(fileKey, [], parsed.ast.body, parsed, known, chapter, src, errors);
          if (unit) out.push(unit);
        }
      }

      return {
        code: `const $R = window.GML_HELPERS.for(runtime);\nconst $G = window;\n${out.join('\n')}`,
        errors,
        count: out.length,
      };
    }
  }

  function escapeComment(s) { return String(s).replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' '); }

  /** Highest N in any `argumentN` the source reads, or -1 if there are none. */
  function maxArgumentIndex(src) {
    let max = -1;
    const re = /\bargument(\d+)\b/g;
    let m;
    while ((m = re.exec(src))) max = Math.max(max, +m[1]);
    return max;
  }

  global.GMLTranslator = GMLTranslator;

})(typeof window !== 'undefined' ? window : globalThis);
