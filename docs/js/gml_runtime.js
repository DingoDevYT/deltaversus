/**
 * GML Compatibility Runtime (gml_runtime.js) — REBUILT
 * Provides GameMaker object semantics: vector movement, alarms, sprite rendering,
 * instance lifecycle, and all 48 core GML/DELTARUNE functions.
 */

(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // MATH HELPERS (GameMaker uses degrees everywhere)
  // ═══════════════════════════════════════════════════════════════

  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  // Live instances a single attack may hold before createInstance starts
  // refusing. The busiest real attack in the corpus (the Knight's sword tunnel)
  // peaks around 230, so this is an order of magnitude of headroom and only a
  // runaway spawner can reach it.
  const INSTANCE_CEILING = 3000;

  function degtorad(d) { return d * DEG2RAD; }
  function radtodeg(r) { return r * RAD2DEG; }
  function dsin(d) { return Math.sin(d * DEG2RAD); }
  function dcos(d) { return Math.cos(d * DEG2RAD); }
  function dtan(d) { return Math.tan(d * DEG2RAD); }
  function lengthdir_x(len, dir) { return len * dcos(dir); }
  function lengthdir_y(len, dir) { return -len * dsin(dir); }

  function point_direction(x1, y1, x2, y2) {
    let d = Math.atan2(-(y2 - y1), x2 - x1) * RAD2DEG;
    return d < 0 ? d + 360 : d;
  }

  function point_distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function angle_difference(dest, src) {
    let diff = ((dest - src) % 360 + 540) % 360 - 180;
    return diff;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sign(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }

  function random(mx) { return Math.random() * mx; }
  function random_range(lo, hi) { return lo + Math.random() * (hi - lo); }
  function irandom(mx) { return Math.floor(Math.random() * (mx + 1)); }
  function irandom_range(lo, hi) { return Math.floor(lo + Math.random() * (hi - lo + 1)); }

  function choose() {
    const args = arguments.length === 1 && Array.isArray(arguments[0]) ? arguments[0] : Array.from(arguments);
    return args[Math.floor(Math.random() * args.length)];
  }

  // ═══════════════════════════════════════════════════════════════
  // DELTARUNE-SPECIFIC HELPER SCRIPTS
  // ═══════════════════════════════════════════════════════════════

  const pi = Math.PI;
  function scr_ease_in(v, p) { return Math.pow(clamp01(v), p || 2); }
  function scr_ease_out(v, p) { return 1 - Math.pow(1 - clamp01(v), p || 2); }
  function scr_ease_inout(v, p) {
    if (p === undefined || p === null) p = 2;
    if (p < -3 || p > 7) return v;
    if (p === -1) { const s = 1.70158; const t=v; return t*t*((s+1)*t-s); }
    if (p === 0) return v;
    if (p === 1) return 0.5 - 0.5 * Math.cos(Math.PI * v);
    v = v * 2;
    if (v < 1) return 0.5 * Math.pow(v, p);
    v -= 2;
    return 1 - 0.5 * Math.pow(Math.abs(v), p);
  }

  function remap(val, inMin, inMax, outMin, outMax) {
    if (inMin === inMax) return outMin;
    return outMin + (val - inMin) * (outMax - outMin) / (inMax - inMin);
  }
  function inverselerp(a, b, val) {
    if (a === b) return 0;
    return (val - a) / (b - a);
  }
  const scr_inverselerp = inverselerp;
  function lerp_ease_in(a, b, t, p) { return lerp(a, b, scr_ease_in(t, p)); }
  function lerp_ease_out(a, b, t, p) { return lerp(a, b, scr_ease_out(t, p)); }

  function scr_movetowards(current, target, step) {
    if (current < target) return Math.min(current + step, target);
    if (current > target) return Math.max(current - step, target);
    return target;
  }
  function scr_approach(current, target, step) { return scr_movetowards(current, target, step); }

  function scr_rotatetowards(current, target, step) {
    const diff = angle_difference(target, current);
    if (Math.abs(diff) <= step) return target;
    return current + sign(diff) * step;
  }

  // ═══════════════════════════════════════════════════════════════
  // COLOR UTILITIES
  // ═══════════════════════════════════════════════════════════════

  function toCSSColor(c) {
    if (typeof c === 'string') {
      if (c.startsWith('#') || c.startsWith('rgb')) return c;
      return '#ffffff';
    }
    if (typeof c === 'number') {
      // GameMaker BGR integer format
      const r = c & 0xFF;
      const g = (c >> 8) & 0xFF;
      const b = (c >> 16) & 0xFF;
      return `rgb(${r},${g},${b})`;
    }
    return '#ffffff';
  }

  function parseRGB(str) {
    if (typeof str === 'number') {
      return [str & 0xFF, (str >> 8) & 0xFF, (str >> 16) & 0xFF];
    }
    str = toCSSColor(str);
    if (str.startsWith('#') && str.length === 7) {
      return [parseInt(str.slice(1,3),16), parseInt(str.slice(3,5),16), parseInt(str.slice(5,7),16)];
    }
    const m = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return [255, 255, 255];
  }

  function merge_color(c1, c2, amt) {
    amt = clamp01(amt);
    const a = parseRGB(c1), b = parseRGB(c2);
    const r = Math.round(a[0] + (b[0]-a[0]) * amt);
    const g = Math.round(a[1] + (b[1]-a[1]) * amt);
    const bl = Math.round(a[2] + (b[2]-a[2]) * amt);
    return `rgb(${r},${g},${bl})`;
  }

  // Color constants (GameMaker values)
  // GameMaker's documented constants. Two were wrong: c_green is a DARK green
  // (#008000) — #00ff00 is c_lime — and c_orange is #ffa040, not the CSS orange.
  // Deltarune tints with these constantly, and the battle box's own
  // `merge_color(c_green, c_lime, 0.5)` came out pure lime instead of the
  // RGB(0,191,0) the game actually shows.
  const C_WHITE = '#ffffff', C_BLACK = '#000000', C_RED = '#ff0000';
  const C_GREEN = '#008000', C_BLUE = '#0000ff', C_YELLOW = '#ffff00';
  const C_GRAY = '#808080', C_ORANGE = '#ffa040', C_PURPLE = '#800080';
  const C_AQUA = '#00ffff', C_LIME = '#00ff00', C_PINK = '#ffc0cb';
  const C_MAROON = '#800000', C_NAVY = '#000080', C_OLIVE = '#808000';
  const C_TEAL = '#008080', C_SILVER = '#c0c0c0', C_FUCHSIA = '#ff00ff';
  const C_DKGRAY = '#404040', C_LTGRAY = '#c0c0c0';

  // ═══════════════════════════════════════════════════════════════
  // BASE GML INSTANCE CLASS
  // ═══════════════════════════════════════════════════════════════

  class GMLInstance {
    constructor(objectType, x, y, id) {
      this.id = id || 0;
      this.object_index = objectType;
      this.object_name = objectType;
      this.x = x || 0;
      this.y = y || 0;
      this.xstart = this.x;
      this.ystart = this.y;
      this.xprevious = this.x;
      this.yprevious = this.y;

      // Vector movement
      this.$hspeed = 0;
      this.$vspeed = 0;
      this.gravity = 0;
      this.gravity_direction = 270;
      this.friction = 0;

      // Sprite & drawing
      this.sprite_index = '';
      // -1 = "use the sprite", GameMaker's unset value. Code branches on it:
      // obj_pinklanebullet's Draw does `if (mask_index != -1)`.
      this.mask_index = -1;
      this.image_index = 0;
      this.image_number = 1;
      this.image_speed = 0;
      this.image_xscale = 1;
      this.image_yscale = 1;
      this.image_angle = 0;
      this.image_alpha = 1;
      this.image_blend = C_WHITE;
      this.depth = 0;
      this.visible = true;

      // Bullet properties (scr_bullet_init)
      this.grazed = 0;
      this.grazetimer = 0;
      this.destroyonhit = 1;
      this.target = 0;
      this.inv = 60;
      this.damage = 10;
      this.element = 0;
      this.grazepoints = 1;
      this.timepoints = 1;
      this.active = 1;
      this.updateimageangle = 0;

      // Alarms
      this.alarm = new Array(12).fill(-1);

      const ARRAY_PROPS = new Set([
        'bullet', 'bullets', 'breakspot', 'pipispot', 'emptyspot', 'wall', 'walls', 'rem', 'alarm',
        'laser', 'lasers', 'wire', 'wires', 'head', 'heads', 'hand', 'hands', 'node', 'nodes',
        'line', 'lines', 'point', 'points', 'part', 'parts', 'star', 'stars', 'blade', 'blades',
        'sword', 'swords', 'box', 'boxes', 'bomb', 'bombs', 'orb', 'orbs', 'shot', 'shots',
        'sub', 'pos', 'spawn', 'spawns', 'wave', 'waves', 'trail', 'trails',
        'heartx', 'hearty', 'krisx', 'krisy', 'armx', 'army', 'handx', 'handy',
        'starlist', 'childlist', 'ypos', 'xpos', 'slash_array', 'partxoff', 'partyoff',
        'xoff', 'yoff', 'offsets', 'slots', 'targets', 'marks', 'data', 'list'
      ]);

      const isArrayPropName = (prop) => {
        if (!prop || typeof prop !== 'string') return false;
        if (ARRAY_PROPS.has(prop)) return true;
        if (prop.includes('spot') || prop.includes('break') || prop.includes('list') ||
            prop.startsWith('rem') || prop.startsWith('bullet') ||
            prop.startsWith('heart') || prop.startsWith('kris') ||
            prop.startsWith('arm') || prop.startsWith('hand') ||
            prop.endsWith('list') || prop.endsWith('array') ||
            prop.endsWith('xoff') || prop.endsWith('yoff')) return true;
        return false;
      };

      // State
      this.destroyed = false;
      this._created = false;

      return new Proxy(this, {
        get(obj, prop) {
          if (typeof prop === 'symbol' || prop === 'then' || prop === 'constructor' || prop === 'valueOf' || prop === 'toString') {
            return obj[prop];
          }
          if (prop === 'destroyed') return obj.destroyed || false;
          if (prop === '_created') return obj._created || false;
          if (typeof prop === 'string' && !(prop in obj)) {
            const autoArr = new Array(30).fill(0);
            obj[prop] = new Proxy(autoArr, {
              get(t, idx) {
                if (idx === Symbol.toPrimitive || idx === 'valueOf') return () => 0;
                if (idx === 'toString') return () => '0';
                if (typeof idx === 'string' && !(idx in t) && isNaN(idx)) return 0;
                return t[idx] !== undefined ? t[idx] : 0;
              },
              set(t, idx, val) {
                t[idx] = val;
                return true;
              }
            });
          }
          return obj[prop];
        },
        set(obj, prop, value) {
          obj[prop] = value;
          return true;
        }
      });
    }

    // --- Speed/Direction as computed properties ---
    get speed() { return Math.hypot(this.$hspeed, this.$vspeed); }
    set speed(val) {
      if (val === 0) { this.$hspeed = 0; this.$vspeed = 0; return; }
      const dir = this.direction;
      this.$hspeed = val * dcos(dir);
      this.$vspeed = -val * dsin(dir);
    }

    get direction() {
      if (this.$hspeed === 0 && this.$vspeed === 0) return 0;
      let d = Math.atan2(-this.$vspeed, this.$hspeed) * RAD2DEG;
      return d < 0 ? d + 360 : d;
    }
    set direction(val) {
      const spd = this.speed;
      this.$hspeed = spd * dcos(val);
      this.$vspeed = -spd * dsin(val);
    }

    get hspeed() { return this.$hspeed; }
    set hspeed(v) { this.$hspeed = v; }
    get vspeed() { return this.$vspeed; }
    set vspeed(v) { this.$vspeed = v; }

    get sprite_width() {
      if (this.object_name === 'obj_growtangle') {
        const baseW = this.width || 100;
        const scale = this.maxxscale || this.image_xscale || 1;
        return baseW * Math.abs(scale);
      }
      const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(this.sprite_index) : null;
      const baseW = info && info.width > 0 ? info.width : 32;
      return baseW * Math.abs(this.image_xscale);
    }
    get sprite_height() {
      if (this.object_name === 'obj_growtangle') {
        const baseH = this.height || 100;
        const scale = this.maxyscale || this.image_yscale || 1;
        return baseH * Math.abs(scale);
      }
      const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(this.sprite_index) : null;
      const baseH = info && info.height > 0 ? info.height : 32;
      return baseH * Math.abs(this.image_yscale);
    }

    // --- Movement tick ---
    updateMovement() {
      this.xprevious = this.x;
      this.yprevious = this.y;

      if (this.updateimageangle) this.image_angle = this.direction;

      // Gravity
      if (this.gravity !== 0) {
        this.$hspeed += lengthdir_x(this.gravity, this.gravity_direction);
        this.$vspeed += lengthdir_y(this.gravity, this.gravity_direction);
      }

      // Friction
      if (this.friction !== 0) {
        const spd = this.speed;
        if (spd > 0) {
          const newSpd = Math.max(0, spd - this.friction);
          this.speed = newSpd;
        }
      }

      // Position
      this.x += this.$hspeed;
      this.y += this.$vspeed;

      // Alarms
      for (let a = 0; a < 12; a++) {
        if (this.alarm[a] > 0) {
          this.alarm[a]--;
          if (this.alarm[a] === 0) {
            this.alarm[a] = -1;
            const fn = this[`alarm_${a}`];
            if (typeof fn === 'function') {
              try { fn.call(this); } catch(e) { console.error(`Alarm ${a} error:`, e); }
            }
          }
        }
      }

      // Image animation
      if (this.image_speed !== 0) {
        this.image_index += this.image_speed;
        if (this.image_number > 0) {
          this.image_index = ((this.image_index % this.image_number) + this.image_number) % this.image_number;
        }
      }
    }

    // --- DRAW METHOD (the critical fix!) ---
    draw(ctx) {
      this.drawSelf(ctx);
    }

    drawSelf(ctx) {
      if (isNaN(this.x) || isNaN(this.y)) return;

      const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(this.sprite_index) : null;
      const ox = info ? (info.originX || 0) : 0;
      const oy = info ? (info.originY || 0) : 0;
      const w = info ? info.width : 24;
      const h = info ? info.height : 24;

      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.image_angle !== 0) ctx.rotate(-this.image_angle * DEG2RAD);
      if (this.image_xscale !== 1 || this.image_yscale !== 1) ctx.scale(this.image_xscale, this.image_yscale);
      ctx.globalAlpha = clamp(this.image_alpha, 0, 1);

      const frameIdx = Math.floor(Math.abs(this.image_index || 0));
      const img = global.gmlAssets ? global.gmlAssets.getImage(this.sprite_index, frameIdx) : null;

      if (img && img.complete && img.naturalWidth > 0) {
        // Image is fully loaded — draw it
        ctx.drawImage(img, -ox, -oy);
      } else if (this.sprite_index) {
        // Sprite assigned but image not loaded yet or missing — draw placeholder
        ctx.fillStyle = toCSSColor(this.image_blend || C_WHITE);
        ctx.globalAlpha = Math.max(0.3, clamp(this.image_alpha, 0, 1));
        ctx.fillRect(-ox, -oy, w || 16, h || 16);
      }

      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RUNTIME ENVIRONMENT
  // ═══════════════════════════════════════════════════════════════

  // Shared by every runtime: the object parent table is a property of the
  // CHAPTER, not of a run, and a runtime is rebuilt for each of the 154
  // presets. One frozen empty set avoids allocating for the common case of an
  // object with no parent at all.
  const EMPTY_ANCESTORS = new Set();
  const ANCESTOR_CACHE = {};

  class GMLRuntimeEnvironment {
    constructor() {
      this.instances = [];
      this.nextId = 100000;
      this.objectDefinitions = {};
      this.errorLog = [];

      // Battle box
      const gtInst = new GMLInstance('obj_growtangle', 320, 240, 99999);
      gtInst.width = 100;
      gtInst.height = 100;
      gtInst.maxxscale = 2.5;
      gtInst.maxyscale = 2.0;
      gtInst.image_xscale = 2.5;
      gtInst.image_yscale = 2.0;
      gtInst.image_blend = C_GREEN;
      this.instances.push(gtInst);
      this.growtangle = gtInst;

      // Player soul
      this.soul = { x: 320, y: 240 };
    }

    log(msg) {
      this.errorLog.push(msg);
      if (this.errorLog.length > 50) this.errorLog.shift();
    }

    registerObject(name, classDef) {
      this.objectDefinitions[name] = classDef;
      if (typeof global !== 'undefined' && typeof createObjectProxy === 'function') {
        global[name] = createObjectProxy(name);
      }
    }

    createInstance(objType, x, y) {
      // Clean objType
      if (objType && typeof objType === 'object' && objType.object_name) {
        objType = objType.object_name;
      }
      if (typeof objType !== 'string') objType = String(objType);
      objType = objType.replace(/^["']|["']$/g, ''); // strip quotes

      // Runaway-spawn valve. The game's spawn conditions are always eventually
      // false, but ours can stay true forever when a variable the condition
      // reads is one the engine gets wrong — and a spawner running every step
      // then buries the tab with no error and no clue which object did it. No
      // real attack in this corpus is anywhere near this many instances, so
      // crossing it always means a bug; refuse, and name the culprit once.
      // Destroyed instances linger in the array until the next sweep, so the
      // cheap length test is only a trigger for the real live count.
      if (this.instances.length > INSTANCE_CEILING) {
        const hist = {};
        let live = 0;
        for (const i of this.instances) {
          if (i.destroyed) continue;
          live++;
          hist[i.object_name] = (hist[i.object_name] || 0) + 1;
        }
        if (live > INSTANCE_CEILING) {
          if (!this.$spawnCapped) {
            this.$spawnCapped = true;
            const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 5)
              .map(e => `${e[0]} x${e[1]}`).join(', ');
            console.warn(`[gml] instance ceiling (${INSTANCE_CEILING}) hit creating ${objType} — refusing further spawns. Most numerous: ${top}`);
          }
          return null;
        }
      }

      const id = ++this.nextId;
      let inst;
      try {
        if (this.objectDefinitions[objType]) {
          inst = new this.objectDefinitions[objType](objType, x, y, id);
        } else {
          inst = new GMLInstance(objType, x, y, id);
        }
      } catch(e) {
        this.log('createInstance error for ' + objType + ': ' + e.message);
        inst = new GMLInstance(objType, x, y, id);
      }

      // Set default sprite from asset DB
      if (global.gmlAssets && !inst.sprite_index) {
        const objInfo = global.gmlAssets.getObjectInfo(objType);
        if (objInfo && objInfo.sprite) inst.sprite_index = objInfo.sprite;
      }

      // THE OBJECT'S REAL DEPTH. DELTARUNE's own instance_create is a script:
      //   var myDepth = object_get_depth(arg2);
      //   return instance_create_depth(arg0, arg1, myDepth, arg2);
      // and object_get_depth reads the GMS1-compat table in
      // __global_object_depths() — obj_growtangle 5, obj_heart 1, obj_grazebox 2,
      // obj_regularbullet -10, obj_monsterparent 90, obj_darkener 200.
      // objects.tsv's depth column is 0 for EVERY object and is not the real
      // value, so without this every battle object was born at depth 0 and the
      // draw order collapsed onto the id tie-break.
      //
      // The lookup is FLAT: no parent inheritance. An object absent from the
      // table genuinely is depth 0 (obj_knight_pointing_starchild does not
      // inherit obj_regularbullet's -10), so `absent` must stay 0 here.
      const depthTable = global.GML_OBJECT_DEPTHS
        && global.GML_OBJECT_DEPTHS[this.$chapter || 'ch3'];
      if (depthTable && Object.prototype.hasOwnProperty.call(depthTable, objType)) {
        inst.depth = depthTable[objType];
      }

      this.instances.push(inst);

      if (typeof inst.create === 'function' && !inst._created) {
        inst._created = true;
        try { inst.create(); } catch(e) {
          this.log('Create error [' + objType + ']: ' + e.message);
        }
      }

      return inst;
    }

    // scr_childbullet: creates child and copies parent bullet properties
    createChildBullet(parent, objType, x, y) {
      const child = this.createInstance(objType, x, y);
      if (parent) {
        child.damage = parent.damage;
        child.grazepoints = parent.grazepoints;
        child.timepoints = parent.timepoints;
        child.inv = parent.inv;
        child.target = parent.target;
        child.grazed = parent.grazed;
        child.grazetimer = parent.grazetimer;
        child.element = parent.element;
      }
      return child;
    }

    destroyInstance(inst) {
      if (!inst) return;
      inst.destroyed = true;
    }

    with(objType, callback) {
      if (typeof objType !== 'string') objType = String(objType);
      objType = objType.replace(/^["']|["']$/g, '');
      for (const inst of this.instances) {
        if (!inst.destroyed && inst.object_name === objType) {
          try { callback.call(inst, inst); } catch(e) {
            this.log('with() error: ' + e.message);
          }
        }
      }
    }

    getInstances(objType) {
      if (!objType) return [];
      if (typeof objType === 'object') return objType.destroyed ? [] : [objType];
      const name = String(objType).replace(/^["']|["']$/g, '');
      if (name === 'runtime.soul' || name === 'obj_soul' || name === 'obj_mainchara' || name === 'obj_heart' || name === 'obj_heart_follower') {
        // Same rule as obj_growtangle below: REAL instances win, the soul only
        // backstops. Returning [this.soul] unconditionally masked genuine
        // objects that share these names — obj_heart_follower is a real object
        // the Knight's Stars attack spawns, and every query for it was being
        // answered with the soul instead.
        const live = this.instances.filter(i => !i.destroyed && i.object_name === name);
        if (live.length) return live;
        return (this.soul && !this.soul.destroyed) ? [this.soul] : [];
      }
      if (name === 'runtime.growtangle' || name === 'obj_growtangle') {
        // The box is a REAL obj_growtangle instance now (created by the boss's
        // own replayed GML). Only fall back to the tracked singleton if a live
        // instance doesn't exist — `[null]` here made instance_exists() lie,
        // which silently skipped every boss's box creation.
        const live = this.instances.filter(i => !i.destroyed && i.object_name === 'obj_growtangle');
        if (live.length) return live;
        return (this.growtangle && !this.growtangle.destroyed) ? [this.growtangle] : [];
      }
      if (name === 'all') return this.instances.filter(i => !i.destroyed);
      // PARENT-TYPED QUERIES. In GameMaker, naming an object in `with`,
      // instance_exists, instance_number, place_meeting and friends selects
      // that object AND EVERY DESCENDANT of it. Matching object_name exactly
      // silently returned nothing for every parent in the corpus:
      //   obj_battlesolid   255 references — obj_growtangle's parent, so the
      //                     battle box was invisible to `with (obj_battlesolid)`
      //                     and to the soul's containment place_meeting
      //   obj_bulletparent  146 references, 40 children in ch3 alone — this is
      //                     what obj_battlecontroller clears at turn end, so
      //                     bullets were never torn down
      //   obj_monsterparent 206 references
      return this.instances.filter(i => !i.destroyed && this._isKindOf(i.object_name, name));
    }

    /**
     * Ancestor set of an object name, memoised per CHAPTER (not per runtime —
     * a runtime is rebuilt for every attack, and re-deriving this 154 times was
     * the whole cost).
     *
     * Walks `objectDefs[name].p` directly rather than calling
     * `GML_OBJECT_INDEX.defaults()`: that helper allocates a Set, an array and
     * a result object and re-walks the entire chain on every call, so using it
     * per link made this O(depth^2) with allocations on a path that runs for
     * every instance of every `with` in every frame.
     */
    _ancestorsOf(objectName) {
      const ch = this.$chapter || 'ch3';
      let perChapter = ANCESTOR_CACHE[ch];
      if (!perChapter) perChapter = ANCESTOR_CACHE[ch] = new Map();
      let set = perChapter.get(objectName);
      if (set) return set;
      set = EMPTY_ANCESTORS;
      const oi = global.GML_OBJECT_INDEX;
      const defs = oi && ((oi.chapters && oi.chapters[ch] && oi.chapters[ch].objectDefs) || oi.objectDefs);
      if (defs) {
        let cur = objectName, first = true;
        // Depth-bounded: a malformed table must not spin here.
        for (let d = 0; d < 16; d++) {
          const def = defs[cur];
          const parent = def && def.p;
          if (!parent) break;
          if (first) { set = new Set(); first = false; }
          if (set.has(parent)) break;             // cycle
          set.add(parent);
          cur = parent;
        }
      }
      perChapter.set(objectName, set);
      return set;
    }

    _isKindOf(objectName, queryName) {
      // Exact match first so the common case never walks anything; the
      // ancestor set is memoised per object name, so the miss path is one
      // Set.has(). No "does this parent have children" cache — that would be
      // an answer about a world that changes every time something spawns.
      return objectName === queryName || this._ancestorsOf(objectName).has(queryName);
    }

    // --- STEP: run all instance steps with error isolation ---
    step() {
      // Step each instance
      for (let i = this.instances.length - 1; i >= 0; i--) {
        const inst = this.instances[i];
        if (!inst || inst.destroyed) continue;

        // Run step
        if (typeof inst.step === 'function') {
          try { inst.step(); } catch(e) {
            this.log('Step error [' + inst.object_name + ']: ' + e.message);
          }
        }

        // Run movement
        if (!inst.destroyed) {
          try { inst.updateMovement(); } catch(e) {
            this.log('Movement error [' + inst.object_name + ']: ' + e.message);
          }
        }
      }

      // Cleanup destroyed
      this.instances = this.instances.filter(inst => !inst.destroyed);
    }

    // --- DRAW: render all instances with error isolation ---
    draw(ctx) {
      // Sort by depth (higher depth = drawn first/behind)
      this.instances.sort((a, b) => b.depth - a.depth);

      for (const inst of this.instances) {
        if (!inst || inst.destroyed || !inst.visible) continue;

        ctx.save();
        try {
          if (typeof inst.draw === 'function') {
            inst.draw(ctx);
          } else {
            inst.drawSelf(ctx);
          }
        } catch(e) {
          this.log('Draw error [' + inst.object_name + ']: ' + e.message);
          // Attempt fallback draw
          try { inst.drawSelf(ctx); } catch(e2) { /* give up */ }
        }
        ctx.restore();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DRAWING FUNCTIONS (available to transpiled GML code)
  // ═══════════════════════════════════════════════════════════════

  // These need a reference to the active canvas context.
  // We'll set this each frame from the studio.
  let _activeCtx = null;
  function setActiveCtx(ctx) { _activeCtx = ctx; }

  function draw_sprite(spr, subimg, x, y) {
    draw_sprite_ext(spr, subimg, x, y, 1, 1, 0, C_WHITE, 1);
  }

  function draw_sprite_ext(spr, subimg, x, y, xscale, yscale, rot, color, alpha) {
    const ctx = _activeCtx;
    if (!ctx || !spr) return;

    const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(spr) : null;
    const ox = info ? (info.originX || 0) : 0;
    const oy = info ? (info.originY || 0) : 0;
    const w = info ? info.width : 24;
    const h = info ? info.height : 24;

    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(-rot * DEG2RAD);
    if (xscale !== 1 || yscale !== 1) ctx.scale(xscale, yscale);
    if (alpha != null) ctx.globalAlpha = clamp(alpha, 0, 1);

    const img = global.gmlAssets ? global.gmlAssets.getImage(spr, Math.floor(subimg || 0)) : null;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -ox, -oy);
    } else {
      // Placeholder while loading
      ctx.fillStyle = toCSSColor(color || C_WHITE);
      ctx.fillRect(-ox, -oy, w || 16, h || 16);
    }
    ctx.restore();
  }

  function draw_self() {
    // Called from within a GML draw() method — `this` should be the instance
    if (_activeCtx && this && typeof this.drawSelf === 'function') {
      this.drawSelf(_activeCtx);
    }
  }

  function draw_set_color(color) {
    if (_activeCtx) _activeCtx.fillStyle = toCSSColor(color);
  }
  function draw_set_colour(color) { draw_set_color(color); }
  function draw_set_alpha(alpha) {
    if (_activeCtx) _activeCtx.globalAlpha = clamp(alpha, 0, 1);
  }
  function draw_set_font(font) {}
  function draw_clear_alpha(color, alpha) {}
  function draw_rectangle(x1, y1, x2, y2, outline) {
    if (!_activeCtx) return;
    if (outline) _activeCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    else _activeCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
  }
  function draw_line(x1, y1, x2, y2) {
    if (!_activeCtx) return;
    _activeCtx.beginPath();
    _activeCtx.moveTo(x1, y1);
    _activeCtx.lineTo(x2, y2);
    _activeCtx.stroke();
  }
  function draw_line_width(x1, y1, x2, y2, w) {
    if (!_activeCtx) return;
    _activeCtx.save();
    _activeCtx.lineWidth = w;
    _activeCtx.beginPath();
    _activeCtx.moveTo(x1, y1);
    _activeCtx.lineTo(x2, y2);
    _activeCtx.stroke();
    _activeCtx.restore();
  }
  function draw_circle(x, y, r, outline) {
    if (!_activeCtx) return;
    _activeCtx.beginPath();
    _activeCtx.arc(x, y, r, 0, Math.PI * 2);
    if (outline) _activeCtx.stroke();
    else _activeCtx.fill();
  }

  function draw_set_blend_mode(mode) {
    if (!_activeCtx) return;
    if (mode === 1 || mode === 'bm_add' || mode === 'lighter') {
      _activeCtx.globalCompositeOperation = 'lighter';
    } else {
      _activeCtx.globalCompositeOperation = 'source-over';
    }
  }

  function scr_draw_outline(sprite, subimg, x, y, xscale, yscale, rot, color, alpha) {
    draw_sprite_ext(sprite, subimg, x, y, xscale || 1, yscale || 1, rot || 0, color || C_WHITE, alpha !== undefined ? alpha : 1);
  }
  function scr_draw_outline_ext(sprite, subimg, x, y, xscale, yscale, rot, color, alpha) {
    draw_sprite_ext(sprite, subimg, x, y, xscale || 1, yscale || 1, rot || 0, color || C_WHITE, alpha !== undefined ? alpha : 1);
  }

  function scr_draw_beam_color(x, y, length, width, angle, color, blend, alpha) {
    const ctx = _activeCtx;
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-angle * DEG2RAD);
    ctx.globalAlpha = clamp(alpha || 0, 0, 1);
    ctx.fillStyle = toCSSColor(color || C_WHITE);
    ctx.fillRect(0, -width/2, length, width);
    ctx.restore();
  }

  function sprite_get_width(spr) {
    const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(spr) : null;
    return info ? info.width : 32;
  }

  function sprite_get_height(spr) {
    const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(spr) : null;
    return info ? info.height : 32;
  }

  function scr_afterimage() {
    // Stub: in the real game this creates a fading duplicate. Return an object so .fadeSpeed doesn't crash.
    return { fadeSpeed: 0.1 };
  }

  function scr_custom_afterimage() {
    return { image_blend: C_WHITE, fadeSpeed: 0.1 };
  }

  function scr_onscreen_tolerance(inst, tol) {
    return true; // Always on screen in the studio
  }

  function mean() {
    let sum = 0;
    for (let i = 0; i < arguments.length; i++) sum += arguments[i];
    return arguments.length ? sum / arguments.length : 0;
  }

  function scr_approach(current, target, amount) {
    if (current < target) return Math.min(current + amount, target);
    return Math.max(current - amount, target);
  }

  function scr_ease_out(v, p) {
    return 1 - Math.pow(1 - clamp01(v), p || 2);
  }

  function scr_get_box(idx) {
    const rt = global.activeGMLRuntime;
    const gt = rt ? rt.growtangle : { x: 320, y: 240, width: 160, height: 160, image_xscale: 1, image_yscale: 1 };
    const bw = (gt.width || 160) * Math.abs(gt.image_xscale || 1) / 2;
    const bh = (gt.height || 160) * Math.abs(gt.image_yscale || 1) / 2;

    switch (idx) {
      case 0: return gt.x - bw; // left
      case 1: return gt.y - bh; // top
      case 2: return gt.x + bw; // right
      case 3: return gt.y + bh; // bottom
      case 4: return gt.x;      // center x
      case 5: return gt.y;      // center y
      default: return gt.x;
    }
  }

  function scr_fire_bullet(x, y, objType, dir, spd) {
    const rt = global.activeGMLRuntime;
    if (!rt) return null;
    const inst = rt.createInstance(objType, x, y);
    if (inst) {
      if (dir != null) inst.direction = dir;
      if (spd != null) inst.speed = spd;
    }
    return inst;
  }

  function scr_lerpvar(varname, startval, targetval, duration) {
    if (this && varname) {
      this[varname] = targetval;
    }
  }

  function scr_darksize() {}
  function scr_bullet_inherit() {}
  function snd_play_x() {}
  function lerp_ease_out(a, b, t, power) {
    const p = power || 2;
    const factor = 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), p);
    return a + (b - a) * factor;
  }
  function instance_create_depth(x, y, depth, objType) {
    const rt = global.activeGMLRuntime;
    if (!rt) return null;
    const inst = rt.createInstance(objType, x, y);
    // The whole point of this call is the EXPLICIT depth, which overrides the
    // object's table depth. Dropping it (the previous behaviour) silently
    // relayered everything created this way — e.g. Pink's
    // `instance_create_depth(x, y, 4, obj_purplecontrols)`, whose lane arena is
    // designed to sit in front of the depth-5 battle box.
    if (inst && depth !== undefined && depth !== null && isFinite(Number(depth))) {
      inst.depth = Number(depth);
    }
    return inst;
  }
  function instance_number(obj) {
    const rt = global.activeGMLRuntime;
    if (!rt) return 0;
    if (!obj) return rt.instances.length;
    const name = typeof obj === 'string' ? obj : (obj.object_name || '');
    return rt.instances.filter(i => !i.destroyed && i.object_name === name).length;
  }

  // Color helpers
  //
  // GameMaker packs colours as BGR (0xBBGGRR), and toCSSColor decodes them that
  // way. gml_helpers.js overrides `global.make_color_rgb` with the correct
  // packing — but this is a module-LOCAL function, and `make_color_hsv` below
  // closes over it rather than the global, so that fix never reached it. Every
  // colour produced by make_color_hsv came out with red and blue swapped.
  //
  // The Roaring Knight is where it shows: its Draw tints the full-screen ball
  // surface with `make_color_hsv(hsv % 255, 255, 255)` where hsv sweeps
  // 128..288, which should run cyan -> blue -> magenta -> red. Swapped, hue 128
  // packed as 0x00FCFF and decoded to RGB(255,252,0) — the flat YELLOW wash
  // Landon reported as "a visual problem with the background colors".
  function make_color_rgb(r, g, b) {
    return ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
  }
  function make_colour_rgb(r, g, b) { return make_color_rgb(r, g, b); }
  function make_color_hsv(h, s, v) {
    h = (h % 255) / 255; s = clamp(s / 255, 0, 1); v = clamp(v / 255, 0, 1);
    let r = 0, g = 0, b = 0;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return make_color_rgb(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
  }
  function make_colour_hsv(h, s, v) { return make_color_hsv(h, s, v); }
  function merge_colour(c1, c2, amount) { return merge_color(c1, c2, amount); }

  // Surface helpers
  function surface_exists(id) { return id != null && id !== -1; }
  function surface_create(w, h) { return 1; }
  function surface_free(id) {}
  function surface_set_target(id) {}
  function surface_reset_target() {}
  function surface_get_width(id) { return 320; }
  function surface_get_height(id) { return 240; }
  function draw_surface(id, x, y) {}
  function draw_surface_ext(id, x, y, xscale, yscale, rot, color, alpha) {}
  function sprite_create_from_surface(id, x, y, w, h, removeback, smooth, xorig, yorig) { return 'spr_bullet'; }

  // Advanced draw helpers
  function draw_sprite_part_ext_rot(spr, subimg, left, top, width, height, x, y, xscale, yscale, rot, color, alpha) {
    const ctx = _activeCtx;
    if (!ctx || !spr) return;
    const img = global.gmlAssets ? global.gmlAssets.getImage(spr, Math.floor(subimg || 0)) : null;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(-rot * DEG2RAD);
    if (xscale !== 1 || yscale !== 1) ctx.scale(xscale, yscale);
    if (alpha != null) ctx.globalAlpha = clamp(alpha, 0, 1);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
    } else {
      ctx.fillStyle = toCSSColor(color || C_WHITE);
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }
  function draw_sprite_part_ext(spr, subimg, left, top, width, height, x, y, xscale, yscale, color, alpha) {
    draw_sprite_part_ext_rot(spr, subimg, left, top, width, height, x, y, xscale, yscale, 0, color, alpha);
  }
  function draw_sprite_part(spr, subimg, left, top, width, height, x, y) {
    draw_sprite_part_ext_rot(spr, subimg, left, top, width, height, x, y, 1, 1, 0, C_WHITE, 1);
  }
  function draw_sprite_general(spr, subimg, left, top, width, height, x, y, xscale, yscale, rot, c1, c2, c3, c4, alpha) {
    draw_sprite_part_ext_rot(spr, subimg, left, top, width, height, x, y, xscale, yscale, rot, c1, alpha);
  }
  function draw_sprite_tiled(spr, subimg, x, y) { draw_sprite_ext(spr, subimg, x, y, 1, 1, 0, C_WHITE, 1); }
  function draw_sprite_tiled_ext(spr, subimg, x, y, xscale, yscale, color, alpha) { draw_sprite_ext(spr, subimg, x, y, xscale, yscale, 0, color, alpha); }
  function draw_sprite_pos(spr, subimg, x1, y1, x2, y2, x3, y3, x4, y4, alpha) { draw_sprite_ext(spr, subimg, x1, y1, 1, 1, 0, C_WHITE, alpha); }
  function draw_line_width_color(x1, y1, x2, y2, w, c1, c2) {}
  function draw_line_color(x1, y1, x2, y2, c1, c2) {}
  function draw_circle_color(x, y, r, c1, c2, outline) {}
  function draw_rectangle_color(x1, y1, x2, y2, c1, c2, c3, c4, outline) {}
  function draw_triangle_color(x1, y1, x2, y2, x3, y3, c1, c2, c3, outline) {}
  function ossafe_fill_rectangle_color(x1, y1, x2, y2, c1, c2, c3, c4, outline) {}
  function gpu_set_blendmode(mode) { draw_set_blend_mode(mode); }
  function gpu_set_colorwriteenable(r, g, b, a) {}
  function gpu_set_blendenable(enable) {}
  function d3d_set_fog(enable, color, start, end) {}
  function sprite_get_bbox_left(spr) { return 0; }
  function sprite_get_bbox_top(spr) { return 0; }

  // Audio stubs
  function snd_play(sound) {}
  function snd_play_pitch(sound, pitch) {}
  function snd_stop(sound) {}
  function snd_loop(sound) {}
  function snd_pause(sound) {}
  function snd_is_playing(sound) { return false; }
  function snd_volume(sound, vol) {}
  function snd_pitch(sound, pitch) {}
  function snd_free(sound) {}
  function snd_exists(sound) { return true; }
  function audio_play_sound(sound, priority, loop) {}
  function audio_stop_sound(sound) {}
  function audio_is_playing(sound) { return false; }
  function audio_sound_pitch(sound, pitch) {}
  function audio_sound_gain(sound, volume, time) {}
  function audio_stop_all() {}

  // ── Battle box coordinate helpers (match real GML scripts) ──────────────────
  function gt_minx() {
    const rt = global.activeGMLRuntime;
    const gt = rt ? rt.growtangle : null;
    if (!gt) return 160;
    return gt.x - (gt.sprite_width || gt.width || 160) / 2;
  }
  function gt_miny() {
    const rt = global.activeGMLRuntime;
    const gt = rt ? rt.growtangle : null;
    if (!gt) return 120;
    return gt.y - (gt.sprite_height || gt.height || 120) / 2;
  }
  function gt_maxx() {
    const rt = global.activeGMLRuntime;
    const gt = rt ? rt.growtangle : null;
    if (!gt) return 480;
    return gt.x + (gt.sprite_width || gt.width || 160) / 2;
  }
  function gt_maxy() {
    const rt = global.activeGMLRuntime;
    const gt = rt ? rt.growtangle : null;
    if (!gt) return 360;
    return gt.y + (gt.sprite_height || gt.height || 120) / 2;
  }
  function gt_inbounds(x, y) { return x >= gt_minx() && x <= gt_maxx() && y >= gt_miny() && y <= gt_maxy(); }
  function gt_inbounds_tol(x, y, tol) { return x >= gt_minx()-tol && x <= gt_maxx()+tol && y >= gt_miny()-tol && y <= gt_maxy()+tol; }
  function camerax() { return 0; }
  function cameray() { return 0; }

  // ── Draw-in-box clip helpers (no WebGL stencil in canvas, just no-ops) ───────
  function scr_draw_in_box_begin() {
    // Canvas 2D doesn't support alpha stencil, scissor rect instead
    const ctx = _activeCtx;
    if (!ctx) return;
    ctx.save();
    const minX = gt_minx() + 5, minY = gt_miny() + 5;
    const maxX = gt_maxx() - 4, maxY = gt_maxy() - 4;
    ctx.beginPath();
    ctx.rect(minX, minY, maxX - minX, maxY - minY);
    ctx.clip();
  }
  function scr_draw_in_box_end() {
    const ctx = _activeCtx;
    if (ctx) ctx.restore();
  }
  function scr_draw_in_box_ext_begin(marginX, marginY) {
    const ctx = _activeCtx;
    if (!ctx) return;
    ctx.save();
    const minX = gt_minx() + 5 - (marginX||0), minY = gt_miny() + 5 - (marginY||0);
    const maxX = gt_maxx() - 4 + (marginX||0), maxY = gt_maxy() - 4 + (marginY||0);
    ctx.beginPath();
    ctx.rect(minX, minY, maxX - minX, maxY - minY);
    ctx.clip();
  }
  function scr_draw_in_box_ext_end() { scr_draw_in_box_end(); }
  function ossafe_fill_rectangle(x1, y1, x2, y2, outline) {
    const ctx = _activeCtx;
    if (!ctx) return;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    if (outline) ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    else ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  }
  const ossafe_fill_rectangle_ext = ossafe_fill_rectangle;

  // ── GPU state no-ops (canvas 2D has no GPU pipeline) ────────────────────────
  function gpu_set_blendmode_ext(src, dst) {}
  function gpu_set_blendenable(val) {}
  function gpu_set_colorwriteenable(r, g, b, a) {}
  function gpu_set_alphatestenable(val) {}
  function gpu_set_alphatestref(val) {}
  function gpu_set_fog(enable, color, start, end) {}
  // GameMaker's real blend-FACTOR values. These were ad-hoc and collided with
  // the table in gml_helpers (bm_src_colour and bm_src_alpha both came out 2),
  // so a (bm_zero, bm_src_colour) multiply was silently read as
  // (bm_zero, bm_src_alpha) and composited as 'destination-in'.
  const bm_dest_alpha = 7;
  const bm_inv_dest_alpha = 8;
  const bm_src_alpha = 5;
  const bm_inv_src_alpha = 6;

  // ── Surface extras ───────────────────────────────────────────────────────────
  function surface_resize(surfId, w, h) {
    if (surfId && surfId._canvas) { surfId._canvas.width = w; surfId._canvas.height = h; }
  }

  // ── Script stubs & helper functions ─────────────────────────────────────────
  function event_user(n) {
    // Called as: event_user(0) — fires user event N on 'this'
    if (this) {
      const fn = this['userEvent' + n] || this['Other_' + (10 + n)];
      if (typeof fn === 'function') fn.call(this);
    }
  }

  function scr_enemy_drawidle_generic(arg0, arg1) {
    if (this && typeof this.drawSelf === 'function') {
      const ctx = _activeCtx;
      if (ctx) this.drawSelf(ctx);
    }
  }

  function scr_enemy_object_init() {
    if (!this) return;
    this.becomeflash = 0; this.flash = 0; this.turnt = 0; this.turns = 0;
    this.talktimer = 0; this.state = 0; this.siner = 0; this.fsiner = 0;
    this.talked = 0; this.attacked = 0; this.hurt = 0; this.hurttimer = 0;
    this.hurtshake = 0; this.shakex = 0; this.acttimer = 0; this.con = 0;
    this.dodgetimer = 0; this.fatal = 0; this.candodge = 0; this.mytarget = 0;
    this.element = 'none'; this.acting = 0; this.mercymod = 0; this.maxmercy = 100;
    this.recruitable = 1; this.freezable = 1; this.recruitcount = 1;
    this.image_xscale = 2; this.image_yscale = 2; this.image_speed = 0.2;
    this.custombody = 0; this.aetimer = 0;
    this._charactsprite = new Array(10).fill(0);
    this.partxoff = new Array(10).fill(0);
    this.partyoff = new Array(10).fill(0);
    this.depth = 90 - (((this.y || 240) - 0) / 50);
  }

  function scr_oflash() {
    const rt = global.activeGMLRuntime;
    const _oflash = rt ? rt.createInstance('obj_oflash', this ? this.x : 0, this ? this.y : 0) : null;
    if (_oflash && this) {
      _oflash.image_xscale = this.image_xscale;
      _oflash.image_yscale = this.image_yscale;
      _oflash.image_speed = 0;
      _oflash.image_index = this.image_index;
      _oflash.sprite_index = this.sprite_index;
      _oflash.depth = this.depth - 1;
      _oflash.target = this;
    }
    return _oflash;
  }

  function scr_dark_marker(x, y, spr) {
    const rt = global.activeGMLRuntime;
    const m = rt ? rt.createInstance('obj_marker', x, y) : null;
    if (m) { m.sprite_index = spr; m.image_speed = 0; m.image_xscale = 2; m.image_yscale = 2; }
    return m;
  }

  function scr_afterimagefast() {
    const rt = global.activeGMLRuntime;
    const ai = rt ? rt.createInstance('obj_afterimage', this ? this.x : 0, this ? this.y : 0) : null;
    if (ai && this) {
      ai.sprite_index = this.sprite_index; ai.image_index = this.image_index;
      ai.image_blend = this.image_blend; ai.image_speed = 0; ai.depth = this.depth;
      ai.image_xscale = this.image_xscale; ai.image_yscale = this.image_yscale;
      ai.image_angle = this.image_angle; ai.fadeSpeed = 0.08;
    }
    return ai;
  }

  function scr_lerpvar_instance(target, varname, pointa, pointb, maxtime, easetype, easeinout) {
    const rt = global.activeGMLRuntime;
    const lv = rt ? rt.createInstance('obj_lerpvar', 0, 0) : null;
    if (lv) {
      lv.target = target; lv.varname = varname; lv.pointa = pointa;
      lv.pointb = pointb; lv.maxtime = maxtime || 1; lv.timer = 0;
      lv.easetype = easetype || 0; lv.easeinout = easeinout || 0;
      // obj_lerpvar step: animate the variable each frame
      lv.step = function() {
        this.timer++;
        const t = clamp01(this.timer / Math.max(1, this.maxtime));
        const val = lerp(this.pointa, this.pointb, t);
        if (this.target && this.varname) {
          try { this.target[this.varname] = val; } catch(e) {}
        }
        if (this.timer >= this.maxtime) this.destroyed = true;
      };
    }
    return lv;
  }
  function scr_lerpvar(varname, pointa, pointb, maxtime, easetype, easeinout) {
    return scr_lerpvar_instance.call(this, this, varname, pointa, pointb, maxtime, easetype, easeinout);
  }
  function scr_lerpvar_respect() { return scr_lerpvar.apply(this, arguments); }

  function scr_monsterattacknamecount(attackName) {
    let count = 0;
    const ma = global.monsterattackname || [];
    const mo = global.monster || [1, 1, 1];
    for (let i = 0; i < 3; i++) {
      if (ma[i] === attackName && mo[i] === 1) count++;
    }
    return count;
  }

  function scr_shakeobj() {
    const rt = global.activeGMLRuntime;
    const s = rt ? rt.createInstance('obj_shakeobj', this ? this.x : 0, this ? this.y : 0) : null;
    if (s && this) s.target = this;
    return s;
  }

  function scr_jump_to_point(endx, endy, jumpspeed, jumptime) {
    const rt = global.activeGMLRuntime;
    const j = rt ? rt.createInstance('obj_jump_to_point', this ? this.x : 0, this ? this.y : 0) : null;
    if (j && this) {
      j.target = this; j.endx = endx; j.endy = endy;
      j.jumpspeed = jumpspeed || 4; j.jumptime = jumptime || 30;
    }
    return j;
  }
  function scr_jump_to_point_sprite(endx, endy, jumpspeed, jumptime, spr, subimg) {
    return scr_jump_to_point.call(this, endx, endy, jumpspeed, jumptime);
  }

  function box_bonk() {} // Sound effect stub
  function msgsetloc(idx, str, locId) { if (global.msg) global.msg[idx] = str; }
  function stringsetloc(str, locId) { return str; }
  function scr_84_get_sprite(key) { return key; } // Return the key as sprite name stub
  function scr_84_get_lang_string(id) { return ''; }
  function i_ex(obj) { // Shorthand for instance_exists — must answer identically
    return global.instance_exists ? !!global.instance_exists(obj) : false;
  }

  function draw_surface_part_ext(surf, left, top, width, height, x, y, xscale, yscale, color, alpha) {
    const ctx = _activeCtx;
    if (!ctx || !surf) return;
    const canvas = surf._canvas || surf;
    if (canvas && (canvas.width || canvas.naturalWidth)) {
      ctx.save();
      ctx.translate(x, y);
      if (xscale !== 1 || yscale !== 1) ctx.scale(xscale, yscale);
      if (alpha != null) ctx.globalAlpha = clamp(alpha, 0, 1);
      try { ctx.drawImage(canvas, left, top, width, height, 0, 0, width, height); } catch(e) {}
      ctx.restore();
    }
  }

  function scr_afterimage_grow() {
    const rt = global.activeGMLRuntime;
    const ai = rt ? rt.createInstance('obj_afterimage_grow', this ? this.x : 0, this ? this.y : 0) : null;
    if (ai && this) {
      ai.sprite_index = this.sprite_index; ai.image_index = this.image_index;
      ai.image_blend = this.image_blend; ai.image_speed = 0; ai.depth = this.depth;
      ai.image_xscale = this.image_xscale; ai.image_yscale = this.image_yscale;
      ai.image_angle = this.image_angle; ai.image_alpha = this.image_alpha;
    }
    return ai;
  }

  function scr_at_player(spd) {
    if (!this) return;
    const rt = global.activeGMLRuntime;
    const soul = rt ? rt.soul : { x: 320, y: 240 };
    const dir = point_direction(this.x, this.y, soul.x, soul.y);
    this.direction = dir;
    this.speed = spd || 4;
  }

  function variable_global_exists(name) {
    return typeof name === 'string' && (name in global);
  }

  function scr_debug(msg) {}

  let _currentPrimitive = null;
  function draw_primitive_begin(kind) { _currentPrimitive = []; }
  function draw_vertex(x, y) { if (_currentPrimitive) _currentPrimitive.push({ x, y, color: '#ffffff', alpha: 1 }); }
  function draw_vertex_color(x, y, col, alpha) { if (_currentPrimitive) _currentPrimitive.push({ x, y, color: toCSSColor(col), alpha: alpha !== undefined ? alpha : 1 }); }
  function draw_vertex_texture(x, y, u, v) { if (_currentPrimitive) _currentPrimitive.push({ x, y, color: '#ffffff', alpha: 1 }); }
  function draw_primitive_end() {
    const ctx = _activeCtx;
    if (ctx && _currentPrimitive && _currentPrimitive.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(_currentPrimitive[0].x, _currentPrimitive[0].y);
      for (let i = 1; i < _currentPrimitive.length; i++) ctx.lineTo(_currentPrimitive[i].x, _currentPrimitive[i].y);
      ctx.closePath();
      ctx.fillStyle = _currentPrimitive[0].color;
      ctx.globalAlpha = _currentPrimitive[0].alpha;
      ctx.fill();
      ctx.restore();
    }
    _currentPrimitive = null;
  }

  function instance_nearest(x, y, objType) {
    const rt = global.activeGMLRuntime;
    if (!rt) return -4;
    const insts = rt.getInstances(objType);
    if (!insts || insts.length === 0) return -4;
    let nearest = insts[0];
    let minDist = point_distance(x, y, nearest.x, nearest.y);
    for (let i = 1; i < insts.length; i++) {
      const d = point_distance(x, y, insts[i].x, insts[i].y);
      if (d < minDist) { minDist = d; nearest = insts[i]; }
    }
    return nearest;
  }

  function scr_pingpong(val, target) {
    val = (val || 0) % (target * 2);
    if (val > target) return target * 2 - val;
    return val;
  }
  function scr_sonic_boom(dir, spd) {
    const rt = global.activeGMLRuntime;
    return rt ? rt.createInstance('obj_bullet', 320, 240) : null;
  }
  function scr_marker(x, y, spr) {
    const rt = global.activeGMLRuntime;
    return rt ? rt.createInstance('obj_marker', x, y) : null;
  }
  function scr_script_delayed(fn, delay) {}
  function scr_var(name, val) { if (this) this[name] = val; }
  function scr_shakescreen() {}
  function scr_pan_screen() {}
  function scr_custom_box_reset() {}
  function randomsign() { return Math.random() < 0.5 ? 1 : -1; }
  function camerawidth() { return 640; }
  function cameraheight() { return 480; }
  function screenx() { return 0; }
  function screeny() { return 0; }

  function collision_rectangle(x1, y1, x2, y2, obj, prec, notme) { return -4; }
  function collision_line(x1, y1, x2, y2, obj, prec, notme) { return -4; }
  function collision_circle(x1, y1, r, obj, prec, notme) { return -4; }
  function distance_to_point(x, y) { return 0; }
  function distance_to_object(obj) { return 0; }
  function __view_get(type, index) {
    if (type === 2 || type === 13 || type === '2' || type === '13') return 640; // WView / WPort
    if (type === 3 || type === 14 || type === '3' || type === '14') return 480; // HView / HPort
    return 0;
  }
  global.__view_get = __view_get;

  function scr_sneo_wall_create(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
    if (!this.breakspot1) this.breakspot1 = [];
    if (!this.breakspot2) this.breakspot2 = [];
    if (!this.breakspot3) this.breakspot3 = [];
    if (!this.breakspot4) this.breakspot4 = [];
    if (!this.breakspot5) this.breakspot5 = [];
    if (!this.pipispot1) this.pipispot1 = [];
    if (!this.pipispot2) this.pipispot2 = [];
    if (!this.pipispot3) this.pipispot3 = [];
    if (!this.pipispot4) this.pipispot4 = [];
    if (!this.pipispot5) this.pipispot5 = [];
    if (!this.emptyspot1) this.emptyspot1 = [];
    if (!this.emptyspot2) this.emptyspot2 = [];
    if (!this.emptyspot3) this.emptyspot3 = [];
    if (!this.emptyspot4) this.emptyspot4 = [];
    if (!this.emptyspot5) this.emptyspot5 = [];
    if (!this.wallcreatetimer) this.wallcreatetimer = [];
    if (!this.walltype) this.walltype = [];

    const idx = this.wallsetupcount || 0;
    if (arg0 === 1) this.emptyspot1[idx] = 1;
    if (arg0 === 2) this.breakspot1[idx] = 1;
    if (arg0 === 3) this.pipispot1[idx] = 1;
    if (arg1 === 1) this.emptyspot2[idx] = 2;
    if (arg1 === 2) this.breakspot2[idx] = 2;
    if (arg1 === 3) this.pipispot2[idx] = 2;
    if (arg2 === 1) this.emptyspot3[idx] = 3;
    if (arg2 === 2) this.breakspot3[idx] = 3;
    if (arg2 === 3) this.pipispot3[idx] = 3;
    if (arg3 === 1) this.emptyspot4[idx] = 4;
    if (arg3 === 2) this.breakspot4[idx] = 4;
    if (arg3 === 3) this.pipispot4[idx] = 4;
    if (arg4 === 1) this.emptyspot5[idx] = 5;
    if (arg4 === 2) this.breakspot5[idx] = 5;
    if (arg4 === 3) this.pipispot5[idx] = 5;

    this.wallcreatetimer[idx] = arg5;
    this.walltype[idx] = arg6;
    this.wallsetupcount = idx + 1;
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════════════════════════════

  global.GMLInstance = GMLInstance;
  global.GMLRuntimeEnvironment = GMLRuntimeEnvironment;
  global.setActiveCtx = setActiveCtx;

  // Drawing functions
  global.draw_sprite = draw_sprite;
  global.draw_sprite_ext = draw_sprite_ext;
  global.draw_set_color = draw_set_color;
  global.draw_set_colour = draw_set_colour;
  global.draw_set_alpha = draw_set_alpha;
  global.draw_set_font = draw_set_font;
  global.draw_clear_alpha = draw_clear_alpha;
  global.draw_rectangle = draw_rectangle;
  global.draw_line = draw_line;
  global.draw_line_width = draw_line_width;
  global.draw_circle = draw_circle;
  global.draw_sprite_part = draw_sprite_part;
  global.draw_sprite_part_ext = draw_sprite_part_ext;
  global.draw_sprite_part_ext_rot = draw_sprite_part_ext_rot;
  global.draw_sprite_general = draw_sprite_general;
  global.draw_sprite_tiled = draw_sprite_tiled;
  global.draw_sprite_tiled_ext = draw_sprite_tiled_ext;
  global.draw_sprite_pos = draw_sprite_pos;
  global.draw_line_width_color = draw_line_width_color;
  global.draw_line_color = draw_line_color;
  global.draw_circle_color = draw_circle_color;
  global.draw_rectangle_color = draw_rectangle_color;
  global.draw_triangle_color = draw_triangle_color;
  global.ossafe_fill_rectangle_color = ossafe_fill_rectangle_color;
  global.scr_draw_outline = scr_draw_outline;
  global.scr_draw_outline_ext = scr_draw_outline_ext;
  global.gpu_set_blendmode = gpu_set_blendmode;
  global.gpu_set_colorwriteenable = gpu_set_colorwriteenable;
  global.gpu_set_blendenable = gpu_set_blendenable;
  global.d3d_set_fog = d3d_set_fog;
  global.sprite_create_from_surface = sprite_create_from_surface;
  global.sprite_get_bbox_left = sprite_get_bbox_left;
  global.sprite_get_bbox_top = sprite_get_bbox_top;
  global.draw_self = draw_self;
  global.draw_set_blend_mode = draw_set_blend_mode;
  global.scr_draw_beam_color = scr_draw_beam_color;
  global.sprite_get_width = sprite_get_width;
  global.sprite_get_height = sprite_get_height;
  global.scr_afterimage = scr_afterimage;
  global.scr_custom_afterimage = scr_custom_afterimage;
  global.scr_onscreen_tolerance = scr_onscreen_tolerance;
  global.merge_color = merge_color;
  global.merge_colour = merge_colour;
  global.make_color_rgb = make_color_rgb;
  global.make_colour_rgb = make_colour_rgb;
  global.make_color_hsv = make_color_hsv;
  global.make_colour_hsv = make_colour_hsv;
  global.toCSSColor = toCSSColor;
  global.scr_ease_in = scr_ease_in;
  global.scr_movetowards = scr_movetowards;
  global.scr_rotatetowards = scr_rotatetowards;
  global.angle_difference = angle_difference;

  // Surface functions
  global.surface_exists = surface_exists;
  global.surface_create = surface_create;
  global.surface_free = surface_free;
  global.surface_set_target = surface_set_target;
  global.surface_reset_target = surface_reset_target;
  global.surface_get_width = surface_get_width;
  global.surface_get_height = surface_get_height;
  global.draw_surface = draw_surface;
  global.draw_surface_ext = draw_surface_ext;

  // Audio functions
  global.snd_play = snd_play;
  global.snd_play_pitch = snd_play_pitch;
  global.snd_stop = snd_stop;
  global.snd_loop = snd_loop;
  global.snd_pause = snd_pause;
  global.snd_is_playing = snd_is_playing;
  global.snd_volume = snd_volume;
  global.snd_pitch = snd_pitch;
  global.snd_free = snd_free;
  global.snd_exists = snd_exists;
  global.audio_play_sound = audio_play_sound;
  global.audio_stop_sound = audio_stop_sound;
  global.audio_is_playing = audio_is_playing;
  global.audio_sound_pitch = audio_sound_pitch;
  global.audio_sound_gain = audio_sound_gain;
  global.audio_stop_all = audio_stop_all;

  // Boss scripts
  global.scr_orbitx = scr_orbitx;
  global.scr_orbity = scr_orbity;
  global.scr_enemy_drawidle_generic = scr_enemy_drawidle_generic;
  global.scr_pingpong = scr_pingpong;
  global.scr_sonic_boom = scr_sonic_boom;
  global.scr_marker = scr_marker;
  global.scr_script_delayed = scr_script_delayed;
  global.scr_var = scr_var;
  global.scr_shakescreen = scr_shakescreen;
  global.scr_pan_screen = scr_pan_screen;
  global.scr_custom_box_reset = scr_custom_box_reset;
  global.randomsign = randomsign;
  global.camerawidth = camerawidth;
  global.cameraheight = cameraheight;
  global.screenx = screenx;
  global.screeny = screeny;

  // Color constants
  global.c_white = C_WHITE; global.c_black = C_BLACK; global.c_red = C_RED;
  global.c_green = C_GREEN; global.c_blue = C_BLUE; global.c_yellow = C_YELLOW;
  global.c_gray = C_GRAY; global.c_orange = C_ORANGE; global.c_purple = C_PURPLE;
  global.c_aqua = C_AQUA; global.c_lime = C_LIME; global.c_pink = C_PINK;
  global.c_maroon = C_MAROON; global.c_navy = C_NAVY; global.c_olive = C_OLIVE;
  global.c_teal = C_TEAL; global.c_silver = C_SILVER; global.c_fuchsia = C_FUCHSIA;
  global.c_dkgray = C_DKGRAY; global.c_ltgray = C_LTGRAY;
  global.c_dkgrey = C_DKGRAY; global.c_ltgrey = C_LTGRAY;
  global.c_grey = C_GRAY;

  // Blend mode constants
  global.bm_add = 1;
  global.bm_normal = 0;

  // Virtual key codes — the Windows VK_* values GameMaker exposes verbatim.
  // keyboard_check* take these, and the corpus also compares them against
  // `keyboard_key` / `keyboard_lastkey` directly, so the numbers have to be the
  // real ones rather than arbitrary tokens.
  Object.assign(global, {
    vk_nokey: 0, vk_anykey: 1,
    vk_backspace: 8, vk_tab: 9, vk_enter: 13, vk_shift: 16, vk_control: 17,
    vk_alt: 18, vk_pause: 19, vk_escape: 27, vk_space: 32,
    vk_pageup: 33, vk_pagedown: 34, vk_end: 35, vk_home: 36,
    vk_left: 37, vk_up: 38, vk_right: 39, vk_down: 40,
    vk_printscreen: 44, vk_insert: 45, vk_delete: 46,
    vk_numpad0: 96, vk_numpad1: 97, vk_numpad2: 98, vk_numpad3: 99, vk_numpad4: 100,
    vk_numpad5: 101, vk_numpad6: 102, vk_numpad7: 103, vk_numpad8: 104, vk_numpad9: 105,
    vk_multiply: 106, vk_add: 107, vk_subtract: 109, vk_decimal: 110, vk_divide: 111,
    vk_f1: 112, vk_f2: 113, vk_f3: 114, vk_f4: 115, vk_f5: 116, vk_f6: 117,
    vk_f7: 118, vk_f8: 119, vk_f9: 120, vk_f10: 121, vk_f11: 122, vk_f12: 123,
    vk_lshift: 160, vk_rshift: 161, vk_lcontrol: 162, vk_rcontrol: 163,
    vk_lalt: 164, vk_ralt: 165,
  });

  global.instance_create_depth = instance_create_depth;
  global.mean = mean;
  global.scr_approach = scr_approach;
  global.scr_ease_out = scr_ease_out;
  global.scr_ease_inout = scr_ease_inout;
  global.scr_get_box = scr_get_box;
  global.scr_fire_bullet = scr_fire_bullet;
  global.scr_lerpvar = scr_lerpvar;
  global.scr_lerpvar_instance = scr_lerpvar_instance;
  global.scr_lerpvar_respect = scr_lerpvar_respect;
  global.scr_darksize = scr_darksize;
  global.scr_bullet_inherit = scr_bullet_inherit;
  global.snd_play_x = snd_play_x;
  global.lerp_ease_in = lerp_ease_in;
  global.lerp_ease_out = lerp_ease_out;
  global.remap = remap;
  global.inverselerp = inverselerp;
  global.scr_inverselerp = scr_inverselerp;
  global.pi = pi;
  global.scr_sneo_wall_create = scr_sneo_wall_create;
  global.collision_rectangle = collision_rectangle;
  global.collision_line = collision_line;
  global.collision_circle = collision_circle;
  global.distance_to_point = distance_to_point;
  global.distance_to_object = distance_to_object;
  global.instance_number = instance_number;
  // Battle box helpers
  global.gt_minx = gt_minx; global.gt_miny = gt_miny;
  global.gt_maxx = gt_maxx; global.gt_maxy = gt_maxy;
  global.gt_inbounds = gt_inbounds; global.gt_inbounds_tol = gt_inbounds_tol;
  global.camerax = camerax; global.cameray = cameray;
  // Draw-in-box
  global.scr_draw_in_box_begin = scr_draw_in_box_begin;
  global.scr_draw_in_box_end = scr_draw_in_box_end;
  global.scr_draw_in_box_ext_begin = scr_draw_in_box_ext_begin;
  global.scr_draw_in_box_ext_end = scr_draw_in_box_ext_end;
  global.ossafe_fill_rectangle = ossafe_fill_rectangle;
  global.ossafe_fill_rectangle_ext = ossafe_fill_rectangle_ext;
  // GPU state stubs
  global.gpu_set_blendmode_ext = gpu_set_blendmode_ext;
  global.gpu_set_blendenable = gpu_set_blendenable;
  global.gpu_set_colorwriteenable = gpu_set_colorwriteenable;
  global.gpu_set_alphatestenable = gpu_set_alphatestenable;
  global.gpu_set_alphatestref = gpu_set_alphatestref;
  global.gpu_set_fog = gpu_set_fog;
  global.bm_dest_alpha = bm_dest_alpha;
  global.bm_inv_dest_alpha = bm_inv_dest_alpha;
  global.bm_src_alpha = bm_src_alpha;
  global.bm_inv_src_alpha = bm_inv_src_alpha;
  // Surface extras
  global.surface_resize = surface_resize;
  // New script functions
  global.event_user = event_user;
  global.scr_enemy_object_init = scr_enemy_object_init;
  global.scr_oflash = scr_oflash;
  global.scr_dark_marker = scr_dark_marker;
  global.scr_afterimagefast = scr_afterimagefast;
  global.scr_lerpvar_instance = scr_lerpvar_instance;
  global.scr_monsterattacknamecount = scr_monsterattacknamecount;
  global.scr_shakeobj = scr_shakeobj;
  global.scr_jump_to_point = scr_jump_to_point;
  global.scr_jump_to_point_sprite = scr_jump_to_point_sprite;
  global.box_bonk = box_bonk;
  global.msgsetloc = msgsetloc;
  global.stringsetloc = stringsetloc;
  global.scr_84_get_sprite = scr_84_get_sprite;
  global.scr_84_get_lang_string = scr_84_get_lang_string;
  global.i_ex = i_ex;
  global.draw_surface_part_ext = draw_surface_part_ext;
  global.scr_afterimage_grow = scr_afterimage_grow;
  global.scr_at_player = scr_at_player;
  global.variable_global_exists = variable_global_exists;
  global.scr_debug = scr_debug;
  global.draw_primitive_begin = draw_primitive_begin;
  global.draw_vertex = draw_vertex;
  global.draw_vertex_color = draw_vertex_color;
  global.draw_vertex_texture = draw_vertex_texture;
  global.draw_primitive_end = draw_primitive_end;
  global.instance_nearest = instance_nearest;

  class Vector2 {
    constructor(x, y) {
      this.x = x || 0;
      this.y = y || 0;
    }
  }
  global.Vector2 = Vector2;

  function audio_sound_get_pitch(snd) { return 1; }
  function audio_sound_get_gain(snd) { return 1; }
  function debug_print(msg) {}
  function gpu_set_blendmode_ext_sepalpha(src, dst, srca, dsta) {}
  function ds_list_clear(list) { if (Array.isArray(list)) list.length = 0; }
  function array_length(arr) { return Array.isArray(arr) ? arr.length : 0; }
  function array_length_1d(arr) { return array_length(arr); }
  function array_length_2d(arr, row) { return Array.isArray(arr) && Array.isArray(arr[row]) ? arr[row].length : 0; }

  global.audio_sound_get_pitch = audio_sound_get_pitch;
  global.audio_sound_get_gain = audio_sound_get_gain;
  global.debug_print = debug_print;
  global.gpu_set_blendmode_ext_sepalpha = gpu_set_blendmode_ext_sepalpha;
  global.ds_list_clear = ds_list_clear;
  global.array_length = array_length;
  global.array_length_1d = array_length_1d;
  global.array_length_2d = array_length_2d;

  // Dynamic Object Controller Proxies (resolves obj_controller.var references in GML)
  function createObjectProxy(objName) {
    const defaultData = { x: 320, y: 240, width: 160, height: 160, sprite_width: 160, sprite_height: 160, depth: 0, image_xscale: 1, image_yscale: 1, image_angle: 0, image_alpha: 1, image_speed: 0, image_index: 0, myself: 0, difficulty: 1, state: 0, slash_count: 1, aetimer: 0, dir: 0, shadowtimer: 0, talktimer: 0, talkmax: 30 };
    return new Proxy(defaultData, {
      get(target, prop) {
        if (prop === Symbol.toPrimitive || prop === 'valueOf') return () => 1000;
        if (prop === 'toString') return () => '1000';
        if (prop === 'object_name') return objName;
        const rt = global.activeGMLRuntime;
        if (rt) {
          const insts = rt.getInstances(objName);
          if (insts && insts.length > 0 && insts[0] && prop in insts[0]) {
            return insts[0][prop];
          }
        }
        if (prop in target) return target[prop];
        if (typeof prop === 'string') {
          const autoArr = new Array(30).fill(0);
          target[prop] = new Proxy(autoArr, {
            get(t, idx) {
              if (idx === Symbol.toPrimitive || idx === 'valueOf') return () => 0;
              if (idx === 'toString') return () => '0';
              if (typeof idx === 'string' && !(idx in t) && isNaN(idx)) return 0;
              return t[idx] !== undefined ? t[idx] : 0;
            },
            set(t, idx, val) {
              t[idx] = val;
              return true;
            }
          });
          return target[prop];
        }
        return 0;
      },
      set(target, prop, value) {
        target[prop] = value;
        const rt = global.activeGMLRuntime;
        if (rt) {
          const insts = rt.getInstances(objName);
          if (insts) {
            for (const inst of insts) {
              inst[prop] = value;
            }
          }
        }
        return true;
      }
    });
  }
  global.createObjectProxy = createObjectProxy;

  const _objectProxies = {};
  function getOrCreateObjectProxy(objName) {
    if (!objName) return createObjectProxy('obj_unknown');
    if (typeof objName !== 'string') {
      if (typeof objName === 'object' && objName.object_name) return objName;
      objName = String(objName);
    }
    const cleanName = objName.replace(/^["']|["']$/g, '');
    if (!_objectProxies[cleanName]) {
      _objectProxies[cleanName] = createObjectProxy(cleanName);
    }
    return _objectProxies[cleanName];
  }
  global.getOrCreateObjectProxy = getOrCreateObjectProxy;

  function scr_orbitx(cx, cy, radius, angle) { return cx + lengthdir_x(radius, angle); }
  function scr_orbity(cx, cy, radius, angle) { return cy + lengthdir_y(radius, angle); }

  // Global object proxies for enemy controllers referenced in attack scripts
  const dummyObj = createObjectProxy('obj_enemy');
  global.obj_spamton_neo_enemy = createObjectProxy('obj_spamton_neo_enemy');
  global.obj_hammer_of_justice_enemy = createObjectProxy('obj_hammer_of_justice_enemy');
  global.obj_knight_enemy = createObjectProxy('obj_knight_enemy');
  global.obj_gerson_enemy = createObjectProxy('obj_gerson_enemy');
  global.obj_sound_of_justice_enemy = createObjectProxy('obj_sound_of_justice_enemy');
  global.obj_guei_enemy = createObjectProxy('obj_guei_enemy');
  global.obj_gamecontroller = createObjectProxy('obj_gamecontroller');
  global.obj_herokris = createObjectProxy('obj_herokris');
  global.obj_herosusie = createObjectProxy('obj_herosusie');
  global.obj_heroralsei = createObjectProxy('obj_heroralsei');
  global.obj_mainchara = createObjectProxy('obj_mainchara');
  global.obj_sneo_wall_controller = createObjectProxy('obj_sneo_wall_controller');
  global.obj_sneo_wall_controller_new = createObjectProxy('obj_sneo_wall_controller_new');
  global.obj_sneo_bulletcontroller = createObjectProxy('obj_sneo_bulletcontroller');
  global.obj_battlecontroller = createObjectProxy('obj_battlecontroller');
  global.obj_roaringknight_boxsplitter_attack = createObjectProxy('obj_roaringknight_boxsplitter_attack');
  global.obj_growtangle = createObjectProxy('obj_growtangle');
  global.obj_gerson_growtangle = createObjectProxy('obj_gerson_growtangle');
  global.obj_writer = createObjectProxy('obj_writer');
  global.obj_darkener = createObjectProxy('obj_darkener');
  global.obj_spellphase = createObjectProxy('obj_spellphase');
  global.obj_face = createObjectProxy('obj_face');
  global.obj_attackpress = createObjectProxy('obj_attackpress');
  global.obj_dmgwriter = createObjectProxy('obj_dmgwriter');
  global.obj_ch3_PTB02 = createObjectProxy('obj_ch3_PTB02');
  global.obj_tensionbar = createObjectProxy('obj_tensionbar');
  global.obj_shake = createObjectProxy('obj_shake');
  global.obj_enemyblcon = createObjectProxy('obj_enemyblcon');
  global.obj_block_vfx = createObjectProxy('obj_block_vfx');
  global.other = createObjectProxy('other');

  // Auto-expanding Proxy Array helper (prevents 'Cannot read properties of undefined' on array indices)
  function createAutoArray(defaultLength = 10, defaultValue = 0) {
    const arr = new Array(defaultLength).fill(defaultValue);
    return new Proxy(arr, {
      get(target, prop) {
        if (prop === Symbol.toPrimitive || prop === 'valueOf') return () => 0;
        if (prop === 'toString') return () => '0';
        if (typeof prop === 'string' && !(prop in target)) {
          if (!isNaN(prop)) return defaultValue;
          target[prop] = createAutoArray(10, defaultValue);
          return target[prop];
        }
        return target[prop] !== undefined ? target[prop] : defaultValue;
      },
      set(target, prop, val) {
        target[prop] = val;
        return true;
      }
    });
  }
  global.createAutoArray = createAutoArray;

  // Battle Turn Globals (prevents premature attack termination)
  global.turntimer = 9999;
  global.monsterat = createAutoArray(10, 10);
  global.monsterhp = createAutoArray(10, 1000);
  global.monstermaxhp = createAutoArray(10, 1000);
  global.monstername = createAutoArray(10, 'Enemy');
  global.monstermakey = createAutoArray(10, 180);
  global.monstermakex = createAutoArray(10, 520);
  global.tempflag = createAutoArray(100, 0);
  global.flag = createAutoArray(100, 0);
  global.canactsus = createAutoArray(10, createAutoArray(10, 0));
  global.actnamesus = createAutoArray(10, createAutoArray(10, ''));
  global.actsimulsus = createAutoArray(10, createAutoArray(10, 0));
  global.actactorsus = createAutoArray(10, createAutoArray(10, 0));
  global.actcostsus = createAutoArray(10, createAutoArray(10, 0));
  global.battlespell = createAutoArray(10, createAutoArray(10, 0));
  global.battleactcount = createAutoArray(10, 0);
  global.battlespellname = createAutoArray(10, createAutoArray(10, ''));
  global.battlespelldesc = createAutoArray(10, createAutoArray(10, ''));
  global.batmusic = createAutoArray(10, 'snd_dummy');
  global.battlemsg = createAutoArray(10, '');
  global.monsterinstance = [{ myself: 0 }, { myself: 1 }, { myself: 2 }];
  global.monsterattackname = ['attack', 'attack', 'attack'];
  global.monster = createAutoArray(10, 1);
  global.myattack = 1;
  global.typer = 1;
  global.msg = createAutoArray(10, '');
  global.hp = createAutoArray(10, 100);
  global.maxhp = createAutoArray(10, 100);
  global.party = createAutoArray(10, 0);
  global.charweapon = createAutoArray(10, 0);
  global.chararmor1 = createAutoArray(10, 0);
  global.chararmor2 = createAutoArray(10, 0);
  global.charmember = createAutoArray(10, 0);
  global.chara = createAutoArray(10, 0);
  global.facing = createAutoArray(10, 0);
  global.phasing = createAutoArray(10, 0);
  global.item = createAutoArray(10, 0);
  global.phone = createAutoArray(10, 0);

  // GML Built-in Function Stubs
  function gml_string(val) { return String(val !== undefined && val !== null ? val : ''); }
  global.string = gml_string;
  global.bm_subtract = 3;
  global.ds_list_shuffle = function(list) { if (Array.isArray(list)) list.sort(() => Math.random() - 0.5); };
  global.scr_var_delayed = function(name, val, delay) { if (this) this[name] = val; };
  global.ds_list_find_value = function(list, idx) { return Array.isArray(list) ? (list[idx] !== undefined ? list[idx] : 0) : 0; };
  global.scr_enemyblcon = function(x, y, type) { const rt = global.activeGMLRuntime; const b = rt ? rt.createInstance('obj_enemyblcon', x, y) : null; if (this) this.myblcon = b; return b; };
  global.scr_84_set_draw_font = function(font) {};
  global.scr_battle_sprite_reset = function(inst) {};
  global.snd_pitch_time = function(snd, pitch, time) {};
  global.scr_attack_override = function(a, b, c, d) { return a; };
  global.scr_isphase = function(phase) { return true; };
  global.scr_randomtarget = function() { return 0; };
  global.scr_spellmenu_setup = function() {};
  global.scr_nextact = function() {};
  global.scr_fadeout = function(t) {};
  global.scr_gameover = function() {};
  global.scr_turntimer = function(time) { if (global.turntimer < time) global.turntimer = time; };
  global.scr_bulletspawner = function(x, y, objType) {
    const rt = global.activeGMLRuntime;
    const dc = rt ? rt.createInstance(objType || 'obj_dbulletcontroller', x, y) : null;
    if (dc && this) {
      dc.creator = this.myself !== undefined ? this.myself : 0;
      dc.creatorid = this.id;
      dc.target = this.mytarget !== undefined ? this.mytarget : 0;
      dc.damage = (global.monsterat[dc.creator] || 10) * 5;
    }
    return dc;
  };
  global.scr_getbuttonsprite = function(btn) { return 'spr_cbtn'; };
  global.scr_doom = function(inst, time) {
    if (!inst) return;
    setTimeout(() => { if (global.activeGMLRuntime) global.activeGMLRuntime.destroyInstance(inst); }, (time || 1) * 33);
  };
  global.scr_custom_afterimage = function(objType) {
    const rt = global.activeGMLRuntime;
    const ai = rt ? rt.createInstance(objType || 'obj_afterimage', this ? this.x : 0, this ? this.y : 0) : null;
    if (ai && this) {
      ai.sprite_index = this.sprite_index; ai.image_index = this.image_index;
      ai.image_blend = this.image_blend; ai.image_speed = 0; ai.depth = (this.depth || 0) + 1;
      ai.image_xscale = this.image_xscale; ai.image_yscale = this.image_yscale;
      ai.image_angle = this.image_angle; ai.image_alpha = this.image_alpha;
    }
    return ai;
  };
  global.scr_onscreen_tolerance = function(inst, tol) {
    if (!inst) return true;
    tol = tol || 0;
    const cx = (global.runtime && global.runtime.growtangle) ? global.runtime.growtangle.x - 320 : 0;
    const cy = (global.runtime && global.runtime.growtangle) ? global.runtime.growtangle.y - 240 : 0;
    const w = inst.sprite_width || 20, h = inst.sprite_height || 20;
    if ((inst.x + w + tol) < cx || (inst.x - tol) > (cx + 640) || (inst.y + h + tol) < cy || (inst.y - tol) > (cy + 480)) return false;
    return true;
  };
  global.scr_anglechange = function(cur, target, rate) {
    return median(-rate, rate, angle_difference(target, cur));
  };
  global.scr_angle_lerp = function(a, b, t) {
    const diff = angle_difference(b, a);
    return a + diff * clamp01(t);
  };
  function scr_moveheart() { const rt = global.activeGMLRuntime; return rt ? rt.createInstance('obj_moveheart', 320, 240) : null; }
  function scr_guardpeek(inst) {}
  global.scr_moveheart = scr_moveheart;
  global.scr_guardpeek = scr_guardpeek;

  function draw_text_color(x, y, str, c1, c2, c3, c4, alpha) {
    const ctx = _activeCtx;
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = toCSSColor(c1 || C_WHITE);
    if (alpha != null) ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillText(String(str), x, y);
    ctx.restore();
  }
  global.draw_text_color = draw_text_color;

  // GML Input & Camera View globals
  const makeBtn = () => {
    const fn = function(b) { return false; };
    fn.valueOf = function() { return false; };
    return fn;
  };
  global.button1 = makeBtn(); global.button1_p = makeBtn(); global.button1_h = makeBtn();
  global.button2 = makeBtn(); global.button2_p = makeBtn(); global.button2_h = makeBtn();
  global.button3 = makeBtn(); global.button3_p = makeBtn(); global.button3_h = makeBtn();
  global.e__VW = { XView: 0, YView: 1, WView: 2, HView: 3, Angle: 4, HBorder: 5, VBorder: 6, HSpeed: 7, VSpeed: 8, Object: 9, Visible: 10, XPort: 11, YPort: 12, WPort: 13, HPort: 14, Camera: 15, SurfaceID: 16 };
  global.__view_get = function(type, index) {
    if (type === 0 || type === 11 || type === 12) return 0; // XView, XPort, YPort
    if (type === 1) return 0; // YView
    if (type === 2 || type === 13) return 640; // WView, WPort
    if (type === 3 || type === 14) return 480; // HView, HPort
    return 0;
  };

  // Instance creation helpers (safety fallbacks for untranspiled calls)
  global.instance_create = function(x, y, objType) {
    return global.activeGMLRuntime ? global.activeGMLRuntime.createInstance(objType, x, y) : null;
  };
  global.scr_childbullet = function(x, y, objType) {
    return global.activeGMLRuntime ? global.activeGMLRuntime.createChildBullet(this, objType, x, y) : null;
  };
  global.scr_bullet_create = function(x, y, objType) {
    return global.activeGMLRuntime ? global.activeGMLRuntime.createInstance(objType, x, y) : null;
  };
  global.instance_destroy = function(inst) {
    if (global.activeGMLRuntime) global.activeGMLRuntime.destroyInstance(inst || this);
  };
  /**
   * EXISTENCE MUST AGREE WITH WHAT `with` AND PROPERTY READS SEE.
   *
   * This scanned `instances` by name directly, while getInstances() resolves
   * aliases — so the soul, which IS a real obj_heart instance but is kept out
   * of the stepped instance list (the studio drives its movement itself),
   * answered `obj_heart.x` correctly and `instance_exists(obj_heart)` FALSE.
   *
   * The corpus checks that 392 times (172 `i_ex(obj_heart)` + 220
   * `instance_exists(obj_heart)`), so every one of those guarded blocks was
   * being skipped on an engine that could see the heart perfectly well
   * everywhere else. This is the identical trap Round 8 fixed for
   * obj_growtangle, where an alias that lied about existence silently skipped
   * every boss's box creation.
   */
  global.instance_exists = function(objType) {
    const rt = global.activeGMLRuntime;
    if (!rt) return false;
    if (objType && typeof objType === 'object') return !objType.destroyed;
    return rt.getInstances(objType).length > 0;
  };

  // Math library
  global.abs = Math.abs;
  global.sin = Math.sin;
  global.cos = Math.cos;
  global.tan = Math.tan;
  global.floor = Math.floor;
  global.ceil = Math.ceil;
  global.round = Math.round;
  global.min = Math.min;
  global.max = Math.max;
  global.sqrt = Math.sqrt;

  global.random = random;
  global.random_range = random_range;
  global.irandom = irandom;
  global.irandom_range = irandom_range;
  global.choose = choose;
  global.clamp = clamp;
  global.clamp01 = clamp01;
  global.lerp = lerp;
  global.sign = sign;
  global.degtorad = degtorad;
  global.radtodeg = radtodeg;
  global.dsin = dsin;
  global.dcos = dcos;
  global.dtan = dtan;
  global.lengthdir_x = lengthdir_x;
  global.lengthdir_y = lengthdir_y;
  global.point_direction = point_direction;
  global.point_distance = point_distance;
  global.angle_difference = angle_difference;

  global.gmlMath = {
    degtorad, radtodeg, dsin, dcos, dtan,
    lengthdir_x, lengthdir_y, point_direction, point_distance, angle_difference,
    clamp, clamp01, lerp, sign,
    random, random_range, irandom, irandom_range, choose,
    scr_ease_in, scr_movetowards, scr_rotatetowards
  };

})(typeof window !== 'undefined' ? window : global);
