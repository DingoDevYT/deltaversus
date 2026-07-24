/**
 * GML Compatibility Runtime (gml_runtime.js)
 * Provides GameMaker object semantics, vector movement, math functions, sprite origin pivots, draw functions, and instance handling.
 */

(function(global) {
  'use strict';

  // Math & Angle Helpers (GameMaker uses degrees for lengthdir, dsin, dcos)
  function degtorad(deg) { return deg * Math.PI / 180; }
  function radtodeg(rad) { return rad * 180 / Math.PI; }

  function dsin(deg) { return Math.sin(degtorad(deg)); }
  function dcos(deg) { return Math.cos(degtorad(deg)); }
  function dtan(deg) { return Math.tan(degtorad(deg)); }

  function lengthdir_x(len, dir) { return len * dcos(dir); }
  function lengthdir_y(len, dir) { return -len * dsin(dir); } // GM Y axis goes downwards

  function point_direction(x1, y1, x2, y2) {
    let dir = radtodeg(Math.atan2(-(y2 - y1), x2 - x1));
    return (dir < 0) ? dir + 360 : dir;
  }

  function point_distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function clamp(val, minVal, maxVal) {
    return Math.max(minVal, Math.min(maxVal, val));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function random(maxVal) {
    return Math.random() * maxVal;
  }

  function random_range(minVal, maxVal) {
    return minVal + Math.random() * (maxVal - minVal);
  }

  function irandom(maxVal) {
    return Math.floor(Math.random() * (maxVal + 1));
  }

  function irandom_range(minVal, maxVal) {
    return Math.floor(minVal + Math.random() * (maxVal - minVal + 1));
  }

  function choose(...args) {
    if (args.length === 1 && Array.isArray(args[0])) args = args[0];
    return args[Math.floor(Math.random() * args.length)];
  }

  function clamp01(val) {
    return Math.max(0, Math.min(1, val));
  }

  function scr_ease_in(val, p = 2) {
    return Math.pow(clamp01(val), p);
  }

  // Color Converter & Interpolator
  function toCSSColor(c) {
    if (typeof c === 'string') {
      if (c.startsWith('#') || c.startsWith('rgb')) return c;
      if (c === 'c_white' || c === '16777215') return '#ffffff';
      if (c === 'c_red' || c === '255') return '#ff0000';
      if (c === 'c_black' || c === '0') return '#000000';
      if (c === 'c_gray') return '#808080';
      if (c === 'c_blue') return '#0000ff';
      if (c === 'c_yellow') return '#ffff00';
      return '#ffffff';
    }
    if (typeof c === 'number') {
      const b = (c >> 16) & 255;
      const g = (c >> 8) & 255;
      const r = c & 255;
      return `rgb(${r},${g},${b})`;
    }
    return '#ffffff';
  }

  function merge_color(col1, col2, amount) {
    amount = clamp01(amount);
    const c1 = toCSSColor(col1);
    const c2 = toCSSColor(col2);

    const parseColor = (str) => {
      if (str.startsWith('#')) {
        const hex = str.slice(1);
        if (hex.length === 6) {
          return [parseInt(hex.slice(0,2), 16), parseInt(hex.slice(2,4), 16), parseInt(hex.slice(4,6), 16)];
        }
      }
      const match = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
      return [255, 255, 255];
    };

    const rgb1 = parseColor(c1);
    const rgb2 = parseColor(c2);

    const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * amount);
    const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * amount);
    const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * amount);

    return `rgb(${r},${g},${b})`;
  }

  // Base GML Instance Class
  class GMLInstance {
    constructor(objectType, x = 0, y = 0, id = 0) {
      this.id = id;
      this.object_index = objectType;
      this.object_name = objectType;
      this.x = x;
      this.y = y;
      this.xstart = x;
      this.ystart = y;
      this.xprevious = x;
      this.yprevious = y;

      // Speed & Vector Movement
      this._hspeed = 0;
      this._vspeed = 0;
      this._speed = 0;
      this._direction = 0;
      this.gravity = 0;
      this.gravity_direction = 270; // Downward
      this.friction = 0;

      // Sprite & Drawing
      this.sprite_index = '';
      this.mask_index = '';
      this.image_index = 0;
      this.image_number = 1;
      this.image_speed = 1;
      this.image_xscale = 1;
      this.image_yscale = 1;
      this.image_angle = 0;
      this.image_alpha = 1;
      this.image_blend = '#ffffff';
      this.depth = 0;
      this.visible = true;
      this.persistent = false;

      // Bullet Base Properties (scr_bullet_init)
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

      // Alarms (12 alarms)
      this.alarm = new Array(12).fill(-1);

      // Status
      this.destroyed = false;
      this._created = false;
    }

    get speed() {
      return Math.hypot(this._hspeed, this._vspeed);
    }
    set speed(val) {
      const dirRad = degtorad(this.direction);
      this._hspeed = val * Math.cos(dirRad);
      this._vspeed = -val * Math.sin(dirRad);
    }

    get direction() {
      return point_direction(0, 0, this._hspeed, -this._vspeed);
    }
    set direction(val) {
      const spd = this.speed;
      const dirRad = degtorad(val);
      this._hspeed = spd * Math.cos(dirRad);
      this._vspeed = -spd * Math.sin(dirRad);
    }

    get hspeed() { return this._hspeed; }
    set hspeed(val) { this._hspeed = val; }

    get vspeed() { return this._vspeed; }
    set vspeed(val) { this._vspeed = val; }

    get sprite_width() {
      const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(this.sprite_index) : null;
      return (info ? info.width : 32) * Math.abs(this.image_xscale);
    }

    get sprite_height() {
      const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(this.sprite_index) : null;
      return (info ? info.height : 32) * Math.abs(this.image_yscale);
    }

    // Tick lifecycle
    updateMovement() {
      this.xprevious = this.x;
      this.yprevious = this.y;

      if (this.updateimageangle) {
        this.image_angle = this.direction;
      }

      if (this.gravity !== 0) {
        this._hspeed += lengthdir_x(this.gravity, this.gravity_direction);
        this._vspeed += lengthdir_y(this.gravity, this.gravity_direction);
      }

      if (this.friction !== 0) {
        const curSpd = this.speed;
        if (curSpd > 0) {
          const newSpd = Math.max(0, curSpd - this.friction);
          this.speed = newSpd;
        }
      }

      this.x += this._hspeed;
      this.y += this._vspeed;

      for (let i = 0; i < 12; i++) {
        if (this.alarm[i] > 0) {
          this.alarm[i]--;
          if (this.alarm[i] === 0) {
            this.alarm[i] = -1;
            if (typeof this[`alarm_${i}`] === 'function') {
              this[`alarm_${i}`]();
            }
          }
        }
      }

      if (this.image_speed !== 0) {
        this.image_index += this.image_speed;
      }
    }
  }

  // Runtime System Manager
  class GMLRuntimeEnvironment {
    constructor() {
      this.instances = [];
      this.nextId = 100000;
      this.globals = {
        c_white: '#ffffff',
        c_black: '#000000',
        c_red: '#ff0000',
        c_green: '#00ff00',
        c_blue: '#0000ff',
        c_yellow: '#ffff00',
        c_purple: '#800080',
        c_orange: '#ffa500',
        c_gray: '#808080',
        c_lime: '#00ff00',
        c_aqua: '#00ffff',
        c_pink: '#ffc0cb',
        bm_add: 'lighter',
        bm_normal: 'source-over'
      };

      this.growtangle = { x: 320, y: 240, width: 160, height: 160, xscale: 1, yscale: 1, image_xscale: 1, image_yscale: 1 };
      this.soul = { x: 320, y: 240 };
      this.objectDefinitions = {};
    }

    registerObject(name, classDef) {
      this.objectDefinitions[name] = classDef;
    }

    createInstance(objType, x = 0, y = 0) {
      const instId = ++this.nextId;
      let inst;
      if (typeof objType === 'string' && this.objectDefinitions[objType]) {
        inst = new this.objectDefinitions[objType](objType, x, y, instId);
      } else {
        inst = new GMLInstance(objType, x, y, instId);
      }

      if (global.gmlAssets) {
        const objInfo = global.gmlAssets.getObjectInfo(objType);
        if (objInfo && objInfo.sprite) {
          inst.sprite_index = objInfo.sprite;
        }
      }

      this.instances.push(inst);
      if (typeof inst.create === 'function' && !inst._created) {
        inst._created = true;
        inst.create();
      }
      return inst;
    }

    destroyInstance(inst) {
      if (!inst) return;
      inst.destroyed = true;
      if (typeof inst.destroy === 'function') {
        inst.destroy();
      }
      const idx = this.instances.indexOf(inst);
      if (idx !== -1) {
        this.instances.splice(idx, 1);
      }
    }

    with(objectType, callback) {
      const matches = this.instances.filter(inst => {
        if (inst.destroyed) return false;
        if (objectType === 'all') return true;
        if (typeof objectType === 'string') return inst.object_name === objectType;
        return inst === objectType;
      });
      for (const inst of matches) {
        if (!inst.destroyed) {
          callback.call(inst, inst);
        }
      }
    }

    step() {
      this.instances.sort((a, b) => b.depth - a.depth);

      for (let i = this.instances.length - 1; i >= 0; i--) {
        const inst = this.instances[i];
        if (inst && !inst.destroyed) {
          if (typeof inst.step === 'function') {
            inst.step();
          }
          if (!inst.destroyed) {
            inst.updateMovement();
          }
        }
      }

      this.instances = this.instances.filter(inst => !inst.destroyed);
    }

    draw(ctx) {
      for (const inst of this.instances) {
        if (inst && !inst.destroyed && inst.visible) {
          ctx.save();
          if (typeof inst.draw === 'function') {
            inst.draw(ctx);
          } else {
            this.defaultDraw(ctx, inst);
          }
          ctx.restore();
        }
      }
    }

    defaultDraw(ctx, inst) {
      const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(inst.sprite_index) : null;
      const originX = info ? info.originX : 16;
      const originY = info ? info.originY : 16;

      ctx.translate(inst.x, inst.y);
      if (inst.image_angle !== 0) ctx.rotate(degtorad(-inst.image_angle));
      if (inst.image_xscale !== 1 || inst.image_yscale !== 1) ctx.scale(inst.image_xscale, inst.image_yscale);
      if (inst.image_alpha !== 1) ctx.globalAlpha = inst.image_alpha;

      const img = global.gmlAssets ? global.gmlAssets.getSpriteImage(inst.sprite_index, inst.image_index) : null;
      
      if (img) {
        ctx.drawImage(img, -originX, -originY);
      } else {
        // High visibility fallback diamond/star
        ctx.fillStyle = toCSSColor(inst.image_blend || '#ffffff');
        const drawX = -originX;
        const drawY = -originY;
        const width = info ? info.width : 24;
        const height = info ? info.height : 24;
        ctx.fillRect(drawX, drawY, width, height);
      }
    }
  }

  // GameMaker Draw Helpers
  function draw_sprite_ext(sprName, subimg, x, y, xscale, yscale, rot, color, alpha) {
    if (!sprName) return;
    const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(sprName) : null;
    const originX = info ? info.originX : 16;
    const originY = info ? info.originY : 16;

    const img = global.gmlAssets ? global.gmlAssets.getSpriteImage(sprName, subimg) : null;
    
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(degtorad(-rot));
    if (xscale !== 1 || yscale !== 1) ctx.scale(xscale, yscale);
    if (alpha != null) ctx.globalAlpha = alpha;

    if (img) {
      ctx.drawImage(img, -originX, -originY);
    } else {
      ctx.fillStyle = toCSSColor(color);
      const w = info ? info.width : 24;
      const h = info ? info.height : 24;
      ctx.fillRect(-originX, -originY, w, h);
    }
    ctx.restore();
  }

  function draw_set_blend_mode(mode) {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = (mode === 'bm_add' || mode === 1 || mode === 'lighter') ? 'lighter' : 'source-over';
  }

  function scr_draw_beam_color(x, y, length, width, angle, color, blend, alpha) {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(degtorad(-angle));
    ctx.globalAlpha = alpha != null ? alpha : 1.0;
    ctx.fillStyle = toCSSColor(color);
    ctx.fillRect(0, -width / 2, length, width);
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
    return { fadeSpeed: 0.1 };
  }

  // Export Globals
  global.GMLInstance = GMLInstance;
  global.GMLRuntimeEnvironment = GMLRuntimeEnvironment;
  global.draw_sprite_ext = draw_sprite_ext;
  global.draw_set_blend_mode = draw_set_blend_mode;
  global.scr_draw_beam_color = scr_draw_beam_color;
  global.sprite_get_width = sprite_get_width;
  global.sprite_get_height = sprite_get_height;
  global.scr_afterimage = scr_afterimage;
  global.merge_color = merge_color;
  global.toCSSColor = toCSSColor;
  global.scr_ease_in = scr_ease_in;
  global.bm_add = 'bm_add';
  global.bm_normal = 'bm_normal';
  global.gmlMath = {
    degtorad, radtodeg, dsin, dcos, dtan,
    lengthdir_x, lengthdir_y, point_direction, point_distance,
    clamp, lerp, random, random_range, irandom, irandom_range, choose, clamp01
  };

})(typeof window !== 'undefined' ? window : global);
