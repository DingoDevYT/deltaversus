/**
 * gml_helpers.js — the `$R` namespace compiled GML calls into, plus the
 * GameMaker-fidelity patches that belong to the runtime rather than the compiler.
 *
 * Load AFTER gml_runtime.js and gml_object_index.js.
 *
 * What it fixes in the existing runtime, and why each one changes visible behaviour:
 *
 *   Event order      GameMaker runs alarms BEFORE the Step event, and runs each
 *                    event type as a phase across all instances. The runtime was
 *                    ticking alarms inside per-instance movement, i.e. after Step,
 *                    so every alarm fired a frame late relative to the code
 *                    reading it.
 *   Depth sort       An unstable in-place sort on `depth` alone made same-depth
 *                    sprites swap render order between frames (visible flicker).
 *                    Ties now break on creation id, like GameMaker.
 *   image_number     Never derived from the sprite, so it stayed 1 and every
 *                    animation was frozen on frame 0.
 *   make_color_rgb   Packed RGB while toCSSColor decoded BGR, so every
 *                    programmatic colour came out with red and blue swapped.
 *   image_blend      Was only used to tint the missing-sprite placeholder, never
 *                    real sprites — Deltarune tints constantly.
 *   collision_*      Were hardcoded to return noone, so every shootable /
 *                    destructible bullet interaction silently did nothing.
 */
(function (global) {
  'use strict';

  // ── Pixel art: nearest-neighbour EVERYWHERE ─────────────────────────────
  // DELTARUNE is pixel art and GameMaker draws it with texture interpolation
  // off. Canvas defaults the other way (`imageSmoothingEnabled` is true), so
  // every scaled draw was bilinear-filtered — visible as blurred pixels on any
  // sprite drawn at a scale other than 1, and doubly so for anything routed
  // through an intermediate buffer (tints, silhouettes, surfaces), which
  // resamples twice.
  //
  // Patching the sites one by one is how you miss one. Defaulting the property
  // at its source means every canvas in the app — including ones created later
  // by surfaces, mask building, or new code — starts unsmoothed, while an
  // explicit `ctx.imageSmoothingEnabled = true` still wins if something ever
  // genuinely wants filtering.
  if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.$gmlPixelated) {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      const ctx = nativeGetContext.call(this, type, ...rest);
      // Assigning canvas.width/height RESETS the 2D state, re-enabling
      // smoothing — so this has to re-apply on every fetch, not just the first.
      if (ctx && type === '2d') pixelate(ctx);
      return ctx;
    };
    HTMLCanvasElement.prototype.$gmlPixelated = true;
  }
  // GameMaker's texture filter is real engine state, and Deltarune turns it OFF
  // at boot (obj_initializer2) then flips it on for a couple of deliberate glows.
  // Model it, defaulting to off, rather than hard-coding "never smooth".
  let texFilter = false;
  /** Apply the current texture-filter state to a context. */
  function pixelate(ctx) {
    if (!ctx) return ctx;
    const on = texFilter;
    ctx.imageSmoothingEnabled = on;
    ctx.mozImageSmoothingEnabled = on;
    ctx.webkitImageSmoothingEnabled = on;
    ctx.msImageSmoothingEnabled = on;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'low';
    return ctx;
  }
  global.GML_PIXELATE = pixelate;
  global.gpu_set_texfilter = function (on) {
    texFilter = !!on && on !== 0;
    pixelate(global.$gmlActiveCtx);
  };
  global.gpu_get_texfilter = () => texFilter;
  global.gpu_set_texfilter_ext = (stage, on) => global.gpu_set_texfilter(on);
  global.texture_set_interpolation = global.gpu_set_texfilter;
  global.texture_set_interpolation_ext = (stage, on) => global.gpu_set_texfilter(on);

  const OBJREFS = new WeakSet();
  const OBJNAMES = new WeakMap();
  const STATICS = Object.create(null);
  const MISSING_WARNED = new Set();
  /** Script names the JIT already failed to find — stops per-read re-attempts. */
  const SCR_JIT_MISS = new Set();
  // Warnings dedupe for the whole session, which is right for a human reading
  // the console but wrong for per-attack diagnostics: a missing native would be
  // attributed only to the FIRST attack that hit it. The flight recorder clears
  // the set between attacks so each one reports what IT actually needed.
  global.GML_CLEAR_WARNINGS = () => MISSING_WARNED.clear();
  const ALL = { $gmlAll: true, toString: () => 'all' };

  /**
   * Sink for writes through a handle that points at nothing. Reads give 0 so
   * arithmetic keeps working, writes are swallowed, and `destroyed` is true so
   * a `with` over it iterates nothing.
   */
  const DEAD_REF = new Proxy({ destroyed: true, $dead: true }, {
    get(t, p) {
      if (p === 'destroyed' || p === '$dead') return true;
      if (p === Symbol.toPrimitive || p === 'valueOf') return () => 0;
      if (p === 'toString') return () => '0';
      if (p === 'object_name') return '';
      return 0;
    },
    set() { return true; },
  });

  const OI = () => global.GML_OBJECT_INDEX;

  // ═══════════════════════════════════════════════════════════════════════
  // VALUE SEMANTICS
  // ═══════════════════════════════════════════════════════════════════════

  /** GML numeric coercion. The runtime's instance proxy hands back array
   *  objects for never-assigned variables; Number() collapses those to 0. */
  function num(v) {
    if (typeof v === 'number') return v;
    if (v === undefined || v === null) return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  /** GML truthiness: a value is true when it is greater than 0.5. */
  function bool(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v > 0.5;
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.length > 0;
    if (typeof v === 'object') {
      if (v === ALL) return true;
      // Instances are truthy; the auto-array proxy collapses to 0 via valueOf.
      if (typeof v.object_name === 'string' && v.object_name) return !v.destroyed;
      return num(v) > 0.5;
    }
    return !!v;
  }

  /** GML `+`: string concatenation when either side is a string, else numeric. */
  function add(a, b) {
    if (typeof a === 'string' || typeof b === 'string') {
      return (typeof a === 'string' ? a : str(a)) + (typeof b === 'string' ? b : str(b));
    }
    return num(a) + num(b);
  }

  /**
   * GML `div`. Per the manual: "the div operator first converts its operands into
   * integers, then performs integer division." Truncating the OPERANDS first is
   * not the same as truncating the quotient — `3.9 div 1.5` is `3 div 1` = 3 in
   * GameMaker, but trunc(3.9/1.5) = 2. The corpus does `sprite_width div _tilesize`
   * where sprite_width is scaled and fractional, so this is reachable.
   *
   * The manual also warns the right operand must be >= 1 or it's a divide-by-zero
   * error; returning 0 degrades instead of throwing.
   */
  function div(a, b) {
    const ai = Math.trunc(num(a));
    const bi = Math.trunc(num(b));
    if (bi === 0) return 0;
    return Math.trunc(ai / bi);
  }

  function sqr(v) { v = num(v); return v * v; }

  function str(v) {
    if (typeof v === 'string') return v;
    if (v === undefined || v === null) return '';
    if (typeof v === 'number') {
      // GameMaker prints integers without a decimal part and reals to 2dp.
      return Number.isInteger(v) ? String(v) : v.toFixed(2);
    }
    if (typeof v === 'object' && v.object_name !== undefined) return String(v.id);
    try { return String(v); } catch (e) { return ''; }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ARRAYS
  // ═══════════════════════════════════════════════════════════════════════

  function isArr(v) { return Array.isArray(v) || (v && typeof v === 'object' && typeof v.length === 'number' && !v.object_name); }

  /** Indexed read. Extra indices walk nested arrays (GML's 2D arrays). */
  function ig(base, i0) {
    if (base === undefined || base === null) return 0;
    if (typeof base === 'string') return base.charAt(num(i0));
    let v = base[num(i0)];
    for (let k = 2; k < arguments.length; k++) {
      if (v === undefined || v === null) return 0;
      v = v[num(arguments[k])];
    }
    return v === undefined ? 0 : v;
  }

  /**
   * Grow an array to hold `i`, zero-filling the gap the way GML does.
   *
   * The bound matters: GameMaker throws on an absurd index, but here an index
   * that came out of a bad expression would zero-fill hundreds of millions of
   * slots and take the tab (or the test process) down with it. Refuse instead,
   * and say so once.
   */
  const MAX_ARRAY_INDEX = 1 << 20;
  function grow(arr, i) {
    if (!Array.isArray(arr)) arr = arr && typeof arr === 'object' && typeof arr.length === 'number' ? Array.from(arr) : [];
    if (!(i >= 0) || i > MAX_ARRAY_INDEX) {
      const key = 'grow:' + i;
      if (!MISSING_WARNED.has(key)) {
        MISSING_WARNED.add(key);
        console.warn(`[gml] refusing array index ${i} (limit ${MAX_ARRAY_INDEX})`);
      }
      return arr;
    }
    while (arr.length <= i) arr.push(0);
    return arr;
  }

  /**
   * `arr[i] = v`, `arr[i][j] = v`, ... to any depth. Returns the (possibly
   * newly created) outer array, so the caller can write it back.
   */
  function aput(arr, indices, value) {
    const i = num(indices[0]);
    arr = grow(arr, i);
    if (indices.length === 1) {
      arr[i] = value;
      return arr;
    }
    // Create the intermediate row if this path has never been written.
    arr[i] = aput(Array.isArray(arr[i]) ? arr[i] : [], indices.slice(1), value);
    return arr;
  }

  /** `holder.prop[i] = v`, creating the array if `prop` was never assigned. */
  function aset(holder, prop, indices, value) {
    if (holder === undefined || holder === null) return value;
    let arr = holder[prop];
    if (!Array.isArray(arr)) {
      // The instance proxy pre-fills unknown properties with a 30-slot
      // array-like; copy what's there instead of discarding it.
      arr = (arr && typeof arr === 'object' && typeof arr.length === 'number') ? Array.from(arr) : [];
    }
    holder[prop] = aput(arr, indices, value);
    return value;
  }

  function alen(a) {
    if (a === undefined || a === null) return 0;
    if (typeof a === 'string') return a.length;
    if (typeof a.length === 'number') return a.length;
    return 0;
  }
  function alen2(a, i) { const r = a && a[num(i)]; return r && typeof r.length === 'number' ? r.length : 0; }
  function acreate(n, fill) {
    n = Math.max(0, Math.floor(num(n)));
    return new Array(n).fill(fill === undefined ? 0 : fill);
  }

  // ds_* live as plain arrays/Maps; these keep the accessor syntax working.
  function listGet(l, i) { return ig(l, i); }
  function listSet(l, i, v) { if (Array.isArray(l)) { grow(l, num(i)); l[num(i)] = v; } return v; }
  function gridGet(g, i, j) { return ig(g, i, j); }
  function gridSet(g, i, j, v) { if (Array.isArray(g)) aput(g, [i, j], v); return v; }
  function mapGet(m, k) {
    if (!m) return undefined;
    if (m instanceof Map) return m.get(k);
    return m[k];
  }
  function mapSet(m, k, v) {
    if (!m) return v;
    if (m instanceof Map) m.set(k, v); else m[k] = v;
    return v;
  }
  function structGet(s, k) { return s ? s[k] : undefined; }
  function structSet(s, k, v) { if (s) s[k] = v; return v; }

  // ═══════════════════════════════════════════════════════════════════════
  // GEOMETRY — bounding boxes, used by the collision functions
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Axis-aligned bounding box for an instance, from its collision mask (falling
   * back to its sprite), offset by the sprite origin and scaled by image_x/yscale.
   * This is the non-precise mask GameMaker uses for unrotated instances.
   */
  /**
   * Runtime sprite redirection. `spr_custom_box = sprite_create_from_surface(...)`
   * compiles to `$G["spr_custom_box"] = <handle>`; every sprite lookup passes
   * through here so reads of the original name resolve to the dynamic sprite.
   */
  function sprAlias(name) {
    // A RAW NUMERIC asset index. The decompiled GML stores some sprites as the
    // integer the compiler assigned (`pinkportrait = 982`), and since this
    // engine keys everything by name, every such draw was dropped on the
    // `typeof !== 'string'` guard — all 30 of the dating minigame's portraits,
    // and the Knight's body during the roar. sprites.tsv preserves asset order,
    // so the index resolves to a name (see scripts/gen_sprite_indices.js).
    if (typeof name === 'number' && isFinite(name) && name >= 0) {
      const tbl = global.GML_SPRITE_INDICES;
      const rt = global.activeGMLRuntime;
      const ch = (rt && rt.$chapter) || 'ch3';
      const hit = tbl && ((tbl[ch] && tbl[ch][name])
        // A helper object can be built from another chapter's table; fall back
        // across chapters rather than drawing nothing.
        || (() => { for (const k of Object.keys(tbl)) if (tbl[k][name]) return tbl[k][name]; return null; })());
      if (hit) return sprAlias(hit);
      return name;
    }
    if (typeof name !== 'string' || !name) return name;
    const a = global[name];
    if (typeof a === 'string' && a && a !== name
        && ((global.GML_SPRITE_MANIFEST && global.GML_SPRITE_MANIFEST[a]) || a.startsWith('__dynspr_'))) {
      return a;
    }
    return name;
  }

  /** Declared frame size for a sprite — what GML positioning math uses. */
  function declaredSpriteSize(sprRaw) {
    const spr = sprAlias(sprRaw);
    return declaredSpriteSizeInner(spr);
  }
  function declaredSpriteSizeInner(spr) {
    const s = global.GML_SPRITE_SIZES && global.GML_SPRITE_SIZES[spr];
    if (s) return { w: s[0], h: s[1] };
    const meta = OI() && OI().spriteMeta[spr];
    if (meta) return { w: meta[1], h: meta[2] };
    if (global.gmlAssets && spr) {
      const img = global.gmlAssets.getImage(spr, 0);
      const w = img && (img.naturalWidth || img.width);
      if (w) return { w, h: img.naturalHeight || img.height };
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COLLISION ENGINE — GameMaker's real model.
  //
  // Two tiers, split exactly the way the engine documents it:
  //   bbox tier     the collision mask rectangle transformed by origin, SIGNED
  //                 scale and image_angle (an oriented box). bbox_left/right/
  //                 top/bottom are the axis-aligned bounds of that box, which is
  //                 why a rotated sword's bbox is wider than its sprite.
  //   precise tier  per-pixel alpha masks (tolerance 0 — any alpha counts),
  //                 built lazily in the browser from the drawn PNG the first
  //                 time a sprite is asked for one. This is the same data
  //                 GameMaker's "precise" mode rasterises from the image.
  //                 Headless runs (no pixel data) fall back to the box tier.
  //
  // The tsv export carries no per-sprite mask-mode flag, so `prec` arguments are
  // honoured for every sprite (precise when asked and pixels are available).
  // ═══════════════════════════════════════════════════════════════════════

  /** spr#frame -> { w, h, bl, bt, br, bb, bits: Uint8Array } | null (no pixels). */
  const maskCache = new Map();
  /**
   * Drop every cached pixel mask for a sprite. Runtime-built sprites (the
   * custom battle box) are rebuilt under the SAME name whenever the box
   * changes size, so a cache keyed only by name#frame would keep answering
   * collision queries with the previous box's pixels.
   */
  global.GML_FORGET_SPRITE = function (name) {
    const prefix = String(name) + '#';
    for (const key of [...maskCache.keys()]) if (key.startsWith(prefix)) maskCache.delete(key);
  };

  function frameMaskOf(sprRaw, frameIdx) {
    const spr = sprAlias(sprRaw);
    const frames = (global.GML_SPRITE_FRAMES && global.GML_SPRITE_FRAMES[spr]) || 1;
    const idx = frames > 0 ? Math.floor(Math.abs(num(frameIdx))) % frames : 0;
    const key = spr + '#' + idx;
    if (maskCache.has(key)) return maskCache.get(key);
    const img = global.gmlAssets ? global.gmlAssets.getImage(spr, idx) : null;
    if (!img || !img.complete || !(img.naturalWidth > 0)) return undefined;   // not ready yet
    let entry = null;
    try {
      const w = img.naturalWidth, h = img.naturalHeight;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const cx = cv.getContext('2d');
      cx.drawImage(img, 0, 0);
      const data = cx.getImageData(0, 0, w, h).data;
      if (data.length >= w * h * 4) {
        const bits = new Uint8Array(w * h);
        let bl = w, bt = h, br = -1, bb = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 0) {
              bits[y * w + x] = 1;
              if (x < bl) bl = x;
              if (x > br) br = x;
              if (y < bt) bt = y;
              if (y > bb) bb = y;
            }
          }
        }
        entry = br >= 0 ? { w, h, bl, bt, br, bb, bits } : { w, h, bl: 0, bt: 0, br: -1, bb: -1, bits };
      }
    } catch (e) { entry = null; }   // tainted canvas / headless quirk
    maskCache.set(key, entry);
    return entry;
  }

  /**
   * Everything needed to transform an instance's mask: position, origin, signed
   * scales, angle, the local mask rect, and pixel bits when available.
   * Returns null for instances with no sprite and no mask — those cannot
   * collide in GameMaker.
   */
  function maskGeom(inst, atX, atY) {
    // Resolve BEFORE the string guard: a sprite may be a raw asset index.
    // mask_index -1 means "use the sprite" (GameMaker's unset value). It is
    // TRUTHY, so `mask_index || sprite_index` would try to alias -1 and come
    // back null, making every maskless object collisionless.
    const rawMask = inst.mask_index;
    const spr = sprAlias((rawMask === -1 || rawMask === '' || rawMask == null) ? inst.sprite_index : rawMask);
    if (!spr || typeof spr !== 'string') return null;
    let ox = 0, oy = 0;
    const orig = global.GML_SPRITE_ORIGINS && global.GML_SPRITE_ORIGINS[spr];
    if (orig) { ox = orig[0]; oy = orig[1]; }
    else {
      const meta = OI() && OI().spriteMeta[spr];
      if (meta) { ox = meta[3]; oy = meta[4]; }
    }
    const mask = frameMaskOf(spr, inst.image_index);
    let rect;
    if (mask && mask.br >= 0) {
      // GameMaker's Automatic mask mode: trimmed to the opaque pixels.
      rect = { l: mask.bl, t: mask.bt, r: mask.br + 1, b: mask.bb + 1 };
    } else {
      const size = declaredSpriteSize(spr) || { w: 16, h: 16 };
      rect = { l: 0, t: 0, r: size.w, b: size.h };
    }
    const ang = (num(inst.image_angle) * Math.PI) / 180;
    // Trimmed export art: mask pixels live in TRIMMED-local coords, so the
    // same trim offset the draw applies must shift the mask, or hitboxes
    // detach from the pixels the player sees. The declared-size fallback rect
    // is already CANVAS-space, so trim only applies when real bits back it.
    const trim = (mask && mask.br >= 0 && global.$gmlTrimOf)
      ? global.$gmlTrimOf(spr, num(inst.image_index) || 0) : null;
    return {
      x: atX === undefined ? num(inst.x) : num(atX),
      y: atY === undefined ? num(inst.y) : num(atY),
      ox, oy,
      tx: trim ? trim[0] : 0,
      ty: trim ? trim[1] : 0,
      sx: num(inst.image_xscale) || 1,
      sy: num(inst.image_yscale) || 1,
      cos: Math.cos(ang), sin: Math.sin(ang),
      rect,
      mask: mask || null,
    };
  }

  /** Local sprite-pixel coords -> world. Matches the draw transform exactly. */
  function localToWorld(g, lx, ly) {
    const u = (lx + (g.tx || 0) - g.ox) * g.sx;
    const v = (ly + (g.ty || 0) - g.oy) * g.sy;
    return {
      x: g.x + u * g.cos + v * g.sin,
      y: g.y - u * g.sin + v * g.cos,
    };
  }

  /** World -> local sprite-pixel coords. */
  function worldToLocal(g, wx, wy) {
    const dx = wx - g.x, dy = wy - g.y;
    const u = dx * g.cos - dy * g.sin;
    const v = dx * g.sin + dy * g.cos;
    return { x: u / g.sx + g.ox - (g.tx || 0), y: v / g.sy + g.oy - (g.ty || 0) };
  }

  /** The four world-space corners of the transformed mask rect. */
  function obbCorners(g) {
    return [
      localToWorld(g, g.rect.l, g.rect.t),
      localToWorld(g, g.rect.r, g.rect.t),
      localToWorld(g, g.rect.r, g.rect.b),
      localToWorld(g, g.rect.l, g.rect.b),
    ];
  }

  function aabbOf(g) {
    const c = obbCorners(g);
    return {
      left: Math.min(c[0].x, c[1].x, c[2].x, c[3].x),
      top: Math.min(c[0].y, c[1].y, c[2].y, c[3].y),
      right: Math.max(c[0].x, c[1].x, c[2].x, c[3].x),
      bottom: Math.max(c[0].y, c[1].y, c[2].y, c[3].y),
    };
  }

  /** Point inside the transformed mask rect (box tier). */
  function pointInObb(g, wx, wy) {
    const p = worldToLocal(g, wx, wy);
    return p.x >= g.rect.l && p.x < g.rect.r && p.y >= g.rect.t && p.y < g.rect.b;
  }

  /** Point inside the pixel mask (precise tier; falls back to the box). */
  function pointInMask(g, wx, wy, precise) {
    const p = worldToLocal(g, wx, wy);
    if (p.x < g.rect.l || p.x >= g.rect.r || p.y < g.rect.t || p.y >= g.rect.b) return false;
    if (!precise || !g.mask || !g.mask.bits) return true;
    const mx = Math.floor(p.x), my = Math.floor(p.y);
    if (mx < 0 || my < 0 || mx >= g.mask.w || my >= g.mask.h) return false;
    return g.mask.bits[my * g.mask.w + mx] === 1;
  }

  /** Separating-axis test between two transformed mask rects. */
  function obbsOverlap(a, b) {
    const ca = obbCorners(a), cb = obbCorners(b);
    const axes = [
      { x: ca[1].x - ca[0].x, y: ca[1].y - ca[0].y },
      { x: ca[3].x - ca[0].x, y: ca[3].y - ca[0].y },
      { x: cb[1].x - cb[0].x, y: cb[1].y - cb[0].y },
      { x: cb[3].x - cb[0].x, y: cb[3].y - cb[0].y },
    ];
    for (const ax of axes) {
      const len = Math.hypot(ax.x, ax.y);
      if (len < 1e-9) continue;
      const nx = ax.x / len, ny = ax.y / len;
      let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const p of ca) { const d = p.x * nx + p.y * ny; if (d < amin) amin = d; if (d > amax) amax = d; }
      for (const p of cb) { const d = p.x * nx + p.y * ny; if (d < bmin) bmin = d; if (d > bmax) bmax = d; }
      if (amax < bmin || bmax < amin) return false;
    }
    return true;
  }

  /** Pixel regions above this are tested with the box tier instead. */
  const PRECISE_REGION_CAP = 160 * 160;

  /**
   * Instance-vs-instance collision, GameMaker style: boxes first; when both
   * sides have pixel data and the overlap region is sane, per-pixel.
   */
  function geomsCollide(a, b) {
    if (!a || !b) return false;
    if (!obbsOverlap(a, b)) return false;
    if (!a.mask || !a.mask.bits || !b.mask || !b.mask.bits) return true;
    const ra = aabbOf(a), rb = aabbOf(b);
    const l = Math.max(ra.left, rb.left), t = Math.max(ra.top, rb.top);
    const r = Math.min(ra.right, rb.right), bo = Math.min(ra.bottom, rb.bottom);
    if (r <= l || bo <= t) return false;
    if ((r - l) * (bo - t) > PRECISE_REGION_CAP) return true;
    for (let y = Math.floor(t); y < bo; y++) {
      for (let x = Math.floor(l); x < r; x++) {
        const wx = x + 0.5, wy = y + 0.5;
        if (pointInMask(a, wx, wy, true) && pointInMask(b, wx, wy, true)) return true;
      }
    }
    return false;
  }

  function instancesCollide(instA, instB) {
    return geomsCollide(maskGeom(instA), maskGeom(instB));
  }

  /**
   * Axis-aligned bounds of the instance's transformed mask — what GameMaker's
   * bbox_left/right/top/bottom report. Rotation-aware: the old version ignored
   * image_angle entirely, so every rotated sword tested collision in the wrong
   * place. Instances with no sprite are a point at (x, y), as in GameMaker.
   */
  function bbox(inst) {
    const g = maskGeom(inst);
    if (!g) {
      const x = num(inst.x), y = num(inst.y);
      return { left: x, top: y, right: x, bottom: y };
    }
    return aabbOf(g);
  }

  /**
   * Sprite animation, GameMaker-shaped: image_index advances by image_speed
   * once per step (we do it at the top of the next step, equivalent to "after
   * this frame's draw"), wraps at image_number, and fires Animation End
   * (Other_7) on the wrap. VFX objects lean on that event to destroy
   * themselves; without it they lingered forever.
   */
  function advanceAnimation(inst, runtime) {
    const isp = num(inst.image_speed);
    if (isp === 0) return;
    const frames = (global.GML_SPRITE_FRAMES && global.GML_SPRITE_FRAMES[inst.sprite_index])
      || num(inst.image_number) || 0;
    if (frames <= 0) return;
    const idx = num(inst.image_index) + isp;
    if (idx >= frames || idx < 0) {
      inst.image_index = ((idx % frames) + frames) % frames;
      if (typeof inst.animationEnd === 'function') safe(inst, 'animationEnd', runtime);
    } else {
      inst.image_index = idx;
    }
  }

  // ── Surfaces ──────────────────────────────────────────────────────────
  // Real render targets. The stubs were worse than nothing: after a no-op
  // surface_set_target, everything an object meant to render offscreen —
  // including full-surface draw_clear washes — landed on the SCREEN. That is
  // where the giant white rectangles over some Knight attacks came from.
  const SURFACES = new Map();
  let nextSurfaceId = 1;
  const surfaceStack = [];

  function resetSurfaceStack() {
    if (surfaceStack.length) {
      // A draw event threw between set_target and reset_target.
      const base = surfaceStack[0];
      surfaceStack.length = 0;
      if (base && global.setActiveCtx) global.setActiveCtx(base);
    }
  }

  function rectsOverlap(a, b) {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER FACTORY — one bound namespace per runtime
  // ═══════════════════════════════════════════════════════════════════════

  const CACHE = new WeakMap();

  /**
   * The codegen emits a direct `someBuiltin(...)` call for every name in
   * GML_BUILTIN_FNS. That is only safe if the name really is callable, so
   * install a warn-once stub for any the runtime doesn't provide. Runs late
   * (first compiled code execution) so gml_codegen.js has certainly loaded.
   */
  let builtinsEnsured = false;
  function ensureBuiltins() {
    if (builtinsEnsured) return;
    const list = global.GML_BUILTIN_FNS;
    if (!list) return;
    builtinsEnsured = true;
    let stubbed = 0;
    for (const name of list) {
      if (typeof global[name] === 'function') continue;
      stubbed++;
      global[name] = function () {
        if (!MISSING_WARNED.has(name)) {
          MISSING_WARNED.add(name);
          console.warn(`[gml] ${name}() is not implemented — returning 0`);
        }
        return 0;
      };
    }
    if (stubbed) console.info(`[gml] stubbed ${stubbed} unimplemented builtins`);
  }

  function helpersFor(runtime) {
    ensureBuiltins();
    if (CACHE.has(runtime)) return CACHE.get(runtime);
    const H = buildHelpers(runtime);
    CACHE.set(runtime, H);
    runtime.H = H;
    patchRuntime(runtime, H);
    return H;
  }

  function buildHelpers(runtime) {
    let activeCtx = null;

    /** Every live instance, ascending creation id — GameMaker's event order. */
    function liveInstances() {
      return runtime.instances.filter(i => i && !i.destroyed).sort((a, b) => num(a.id) - num(b.id));
    }

    function objectNameOf(v) {
      if (v === null || v === undefined) return null;
      if (typeof v === 'string') return v.replace(/^["']|["']$/g, '');
      if (typeof v === 'number') {
        if (v === -4) return null;
        // Ids issued by the runtime start at 100001; anything smaller that
        // reaches here is a raw asset index leaked by the decompiler.
        if (v >= 100000) return null;
        const nm = OI() && OI().objectName(v, runtime.$chapter || 'ch3');
        return nm || null;
      }
      if (typeof v === 'object') {
        if (OBJNAMES.has(v)) return OBJNAMES.get(v);
        if (v.$gmlAll) return 'all';
        if (typeof v.object_name === 'string') return v.object_name;
      }
      return null;
    }

    function instanceById(id) {
      id = num(id);
      for (const i of runtime.instances) if (!i.destroyed && num(i.id) === id) return i;
      return null;
    }

    /** True when `inst` is of `name` or descends from it, as GML matches objects. */
    function instanceIs(inst, name) {
      if (!inst) return false;
      if (inst.object_name === name || name === 'all') return true;
      const oi = OI();
      if (!oi) return false;
      return oi.isDescendantOf(inst.object_name, name, runtime.$chapter || 'ch3');
    }

    function instancesOf(v) {
      // Identity only. An object reference is a Proxy whose get trap answers ANY
      // unknown property with a truthy auto-array, so a `v.$gmlAll` probe is
      // always true — which made every `with (obj_type)` iterate every instance
      // in the room instead of that object's.
      if (v === ALL) return liveInstances();
      // A concrete instance (not an object reference).
      if (v && typeof v === 'object' && !OBJNAMES.has(v) && typeof v.object_name === 'string') {
        return v.destroyed ? [] : [v];
      }
      if (typeof v === 'number' && v >= 100000) {
        const inst = instanceById(v);
        return inst ? [inst] : [];
      }
      const name = objectNameOf(v);
      if (!name) return [];
      if (name === 'all') return liveInstances();
      // The runtime aliases the SOUL objects onto its singleton. The battle
      // box is NOT in this list any more: obj_growtangle is a real instance in
      // the room, and the descendant-aware filter below must own it so
      // `with (obj_battlesolid)` and instance_exists() see the truth.
      const aliased = runtime.getInstances(name);
      if (aliased && aliased.length && (name === 'obj_heart' ||
          name === 'obj_mainchara' || name === 'obj_soul' || name === 'obj_heart_follower')) {
        return aliased.filter(Boolean);
      }
      return liveInstances().filter(i => instanceIs(i, name));
    }

    const H = {
      ALL,
      runtime,

      // ── value semantics ────────────────────────────────────────────
      b: bool, n: num, add, div, sqr, str,
      ig, aput, aset, alen, alen2, acreate,
      listGet, listSet, gridGet, gridSet, mapGet, mapSet, structGet, structSet,

      // ── object references ──────────────────────────────────────────
      /** An object reference usable for reads/writes across all its instances. */
      o(name) {
        const p = global.getOrCreateObjectProxy(name);
        OBJREFS.add(p);
        OBJNAMES.set(p, name);
        return p;
      },

      /** Normalise anything object-shaped for the runtime's own builtins. */
      oref(v) {
        if (v && typeof v === 'object' && !OBJNAMES.has(v) && typeof v.object_name === 'string') return v;
        const nm = objectNameOf(v);
        return nm === null ? v : nm;
      },

      objectNameOf,
      instancesOf,
      instanceIs,

      /** The instance list a `with (...)` block iterates. */
      withList(target, caller) {
        if (target === undefined || target === null) return [];
        if (typeof target === 'number' && target === -4) return [];
        if (target === ALL) return liveInstances();
        return instancesOf(target);
      },

      // ── instances ──────────────────────────────────────────────────
      create(x, y, objArg, depth, self) {
        const name = objectNameOf(objArg) || (typeof objArg === 'string' ? objArg : null);
        if (!name) return null;
        if (H.creationBudgetExhausted(name)) return null;
        const inst = runtime.createInstance(name, num(x), num(y));
        if (inst && depth !== undefined && depth !== null) inst.depth = num(depth);
        return inst;
      },

      /**
       * Safety valve. Deltarune attacks are written knowing the rest of the
       * battle engine will clean up after them; in isolation a spawner can
       * recurse or spawn a helper whose own code never destroys it, and a single
       * frame then allocates without bound. GameMaker would grind to a halt too,
       * but here it takes the browser tab with it, so refuse past a ceiling and
       * name the object once.
       */
      creationBudgetExhausted(name) {
        if (runtime.$frameCreations === undefined) runtime.$frameCreations = 0;
        runtime.$frameCreations++;
        if (runtime.$frameCreations > H.maxCreationsPerFrame) {
          const key = 'budget:' + name;
          if (!MISSING_WARNED.has(key)) {
            MISSING_WARNED.add(key);
            console.warn(`[gml] creation budget (${H.maxCreationsPerFrame}/frame) exhausted while spawning ${name} — further spawns this frame refused`);
          }
          return true;
        }
        if (runtime.instances.length >= H.maxInstances) {
          const key = 'cap:' + name;
          if (!MISSING_WARNED.has(key)) {
            MISSING_WARNED.add(key);
            console.warn(`[gml] instance ceiling (${H.maxInstances}) reached while spawning ${name}`);
          }
          return true;
        }
        return false;
      },

      // Deliberately generous. These are a backstop against a genuinely
      // unbounded spawner, not a performance budget: real attacks legitimately
      // burst into the hundreds (obj_knight_roaring_fx peaks near 340 before
      // cleaning itself back down to 4), and refusing a spawn mid-attack
      // corrupts logic that expects instance_create to succeed. A step costs
      // ~1.3ms at these counts, so there is plenty of headroom.
      maxCreationsPerFrame: 4000,
      maxInstances: 20000,

      childBullet(parent, x, y, objArg) {
        const name = objectNameOf(objArg) || String(objArg);
        const inst = runtime.createChildBullet(parent, name, num(x), num(y));
        return inst;
      },

      destroy(v) {
        if (v === undefined || v === null) return;
        if (typeof v === 'object' && typeof v.object_name === 'string' && !OBJNAMES.has(v)) {
          runtime.destroyInstance(v);
          return;
        }
        for (const inst of instancesOf(v)) runtime.destroyInstance(inst);
      },

      exists(v) {
        if (v === undefined || v === null) return false;
        if (typeof v === 'number' && v === -4) return false;
        if (typeof v === 'boolean') return v;
        return instancesOf(v).length > 0;
      },

      count(v) { return v === undefined ? liveInstances().length : instancesOf(v).length; },

      find(objArg, n) {
        const list = instancesOf(objArg);
        const i = num(n);
        return i >= 0 && i < list.length ? list[i] : -4;
      },

      nearest(x, y, objArg, exclude) {
        let best = null, bestD = Infinity;
        for (const inst of instancesOf(objArg)) {
          if (inst === exclude) continue;
          const d = Math.hypot(num(inst.x) - num(x), num(inst.y) - num(y));
          if (d < bestD) { bestD = d; best = inst; }
        }
        return best || -4;
      },

      /** GML's scr_bullet_init — the shared bullet variable block. */
      bulletInit(inst) {
        inst.grazed = 0;
        inst.grazetimer = 0;
        inst.destroyonhit = 1;
        inst.target = 0;
        inst.inv = 60;
        inst.damage = 10;
        inst.element = 0;
        inst.grazepoints = 1;
        inst.timepoints = 1;
        inst.active = 1;
        inst.updateimageangle = 0;
        return inst;
      },

      /**
       * Object properties GameMaker applies before Create runs, plus zeroing the
       * instance variables this object assigns anywhere. Zeroing matters because
       * the runtime's instance proxy otherwise hands back a 30-slot array object
       * for a never-assigned variable, which is truthy.
       */
      initInstance(inst, objectName, defaults, hoisted) {
        if (defaults) {
          if (defaults.sprite_index) inst.sprite_index = defaults.sprite_index;
          if (defaults.mask_index) inst.mask_index = defaults.mask_index;
          if (defaults.depth) inst.depth = defaults.depth;
          if (defaults.visible === false) inst.visible = false;
          if (defaults.persistent) inst.persistent = true;
        }
        inst.$objectName = objectName;
        // GameMaker's default image_speed is 1 — sprites play unless the object
        // says otherwise. The runtime defaulted to 0, freezing every animation
        // whose Create didn't set it explicitly.
        inst.image_speed = 1;
        // image_number has to follow the real sprite or image_speed animates nothing.
        H.syncImageNumber(inst);
        if (hoisted) for (let i = 0; i < hoisted.length; i++) inst[hoisted[i]] = 0;
        // Start decoding this instance's art NOW rather than at its first
        // collision test. Pixel masks are built from the decoded PNG, and until
        // one exists the collision engine has to fall back to the bounding box —
        // which for the battle box (a HOLLOW frame) means the heart briefly reads
        // as standing inside a solid. Touching the image at spawn closes that
        // window for every instance, not just the box.
        H.warmSprite((inst.mask_index === -1 || !inst.mask_index) ? inst.sprite_index : inst.mask_index);
        return inst;
      },

      syncImageNumber(inst) {
        const frames = H.frameCount(inst.sprite_index);
        if (frames > 0) inst.image_number = frames;
      },

      /**
       * Begin decoding a sprite's frames so its pixel mask can be built before
       * anything needs to collide with it. getImage() is cached, so repeat calls
       * are free; decode() (when available) also forces the bitmap to be ready
       * rather than merely loaded.
       */
      warmSprite(sprRaw) {
        const spr = sprAlias(sprRaw);
        if (!spr || typeof spr !== 'string' || !global.gmlAssets) return;
        const frames = Math.min(num(H.frameCount(spr)) || 1, 4);
        for (let f = 0; f < frames; f++) {
          const img = global.gmlAssets.getImage(spr, f);
          if (img && typeof img.decode === 'function' && !img.complete) {
            img.decode().catch(() => { /* a missing frame is reported elsewhere */ });
          }
        }
      },

      /** image_number for the sprite currently assigned, as GameMaker reports it. */
      imgnum(inst) {
        if (!inst) return 1;
        const frames = H.frameCount(inst.sprite_index);
        if (frames > 0) return frames;
        const stored = num(inst.image_number);
        return stored > 0 ? stored : 1;
      },

      frameCount(sprRaw) {
        const spr = sprAlias(sprRaw);
        if (!spr || typeof spr !== 'string') return 0;
        if (global.GML_SPRITE_FRAMES && global.GML_SPRITE_FRAMES[spr]) return global.GML_SPRITE_FRAMES[spr];
        if (global.GML_SPRITE_MANIFEST && global.GML_SPRITE_MANIFEST[spr]) return global.GML_SPRITE_MANIFEST[spr].length;
        return 0;
      },

      base(parentName) {
        if (!parentName) return null;
        return runtime.objectDefinitions[parentName] || null;
      },

      /** event_inherited() — run the parent object's version of this event. */
      inherited(inst, method, objectName) {
        const oi = OI();
        const chain = oi ? oi.parentChain(objectName, runtime.$chapter || 'ch3') : [];
        for (const parent of chain) {
          const cls = runtime.objectDefinitions[parent];
          const fn = cls && cls.prototype && cls.prototype[method];
          if (typeof fn === 'function') { fn.call(inst); return; }
        }
      },

      eventUser(inst, n) {
        if (!inst) return;
        n = num(n);
        const fn = inst['userEvent' + n] || inst['Other_' + (10 + n)];
        if (typeof fn === 'function') fn.call(inst);
      },

      /**
       * Run any event on an instance on demand, as GameMaker does.
       *
       * This used to handle ONLY user events (type 7), so every other
       * event_perform silently did nothing. That is not a rare corner: Deltarune
       * uses `event_perform(ev_draw, ev_draw_normal)` to hand-draw objects it has
       * marked invisible, so the parent draws children in its own order. An
       * invisible object whose Draw never runs is simply absent — which is why
       * the buttons on Pink's date-3 node maze never appeared.
       *
       * The mapping mirrors gml_translator's EVENT_METHODS so a method exists for
       * every event the extractor compiles.
       */
      eventPerform(inst, type, num_) {
        const self = H.d ? H.d(inst) : inst;
        if (!self) return;
        const t = num(type), n = num(num_);
        const run = name => {
          const fn = self[name];
          if (typeof fn !== 'function') return;
          // Draw events take the active context; everything else takes `other`.
          if (name === 'draw' || name === 'drawEnd' || name === 'drawBegin') {
            fn.call(self, global.$gmlActiveCtx);
          } else {
            fn.call(self, self);
          }
        };
        switch (t) {
          case 0: return run('create');
          case 1: return run('destroyEvent');
          case 2: return run('alarm_' + n);
          case 3:                                   // ev_step + which step
            // Names must match what gml_translator emits (stepBegin/stepEnd),
            // or these dispatch to nothing.
            if (n === 1) return run('stepBegin');
            if (n === 2) return run('stepEnd');
            return run('step');
          case 7:                                   // ev_other
            if (n >= 10 && n <= 25) return H.eventUser(self, n - 10);
            if (n === 0) return run('outsideRoom');
            if (n === 1) return run('boundary');
            if (n === 4) return run('roomStart');
            if (n === 5) return run('roomEnd');
            if (n === 7) return run('animationEnd');
            return;
          case 8:                                   // ev_draw + which draw
            if (n === 72) return run('drawBegin');
            if (n === 73) return run('drawEnd');
            return run('draw');
          default:
            return;
        }
      },

      /** `expr.method(args)` where expr may be an instance, an id, or a struct. */
      mcall(obj, prop, args, self) {
        if (obj === undefined || obj === null) return 0;
        obj = H.d(obj);
        const fn = prop ? obj[prop] : obj;
        if (typeof fn === 'function') return fn.apply(obj, args);
        return 0;
      },

      /** A local variable holding a method (GML 2.3 method values). */
      vcall(fn, args, self) {
        if (typeof fn === 'function') return fn.apply(self, args);
        return 0;
      },

      /**
       * A function the compiler couldn't resolve statically, in GML's own
       * resolution order: a method on the current `self` first, then a global.
       *
       * Self-first matters. GML 2.3 lets an object define methods in its Create
       * (`function DoFlip(arg0 = -1) { ... }` in obj_shutta_photo_attack), and
       * another object then calls it through a `with`:
       *
       *     with (photo)
       *         DoFlip(1);
       *
       * That bare call resolves against the with-target. Checking only `window`
       * missed every such call and silently returned 0.
       */
      miss(name, self, args) {
        const own = self && self[name];
        if (typeof own === 'function') {
          try { return own.apply(self, args); } catch (e) {
            const key = 'method:' + name;
            if (!MISSING_WARNED.has(key)) {
              MISSING_WARNED.add(key);
              console.error(`[gml] method ${name}() threw:`, e);
            }
            return 0;
          }
        }
        // A compiled GlobalScript. The codegen resolves these statically when it
        // knows the name, but the script table can hold names it didn't know
        // about at compile time (a chapter's script set is built from the call
        // sites the generators found), so check it before giving up.
        const scr = H.scr[name];
        if (typeof scr === 'function') {
          try { return scr.apply(self, args); } catch (e) {
            const key = 'scr:' + name;
            if (!MISSING_WARNED.has(key)) {
              MISSING_WARNED.add(key);
              console.error(`[gml] ${name}() threw:`, e);
            }
            return 0;
          }
        }
        const fn = global[name];
        if (typeof fn === 'function') {
          try { return fn.apply(self, args); } catch (e) {
            if (!MISSING_WARNED.has(name)) {
              MISSING_WARNED.add(name);
              console.warn(`[gml] ${name}() threw:`, e.message);
            }
            return 0;
          }
        }
        if (!MISSING_WARNED.has(name)) {
          MISSING_WARNED.add(name);
          console.warn(`[gml] unimplemented function ${name}() — returning 0`);
        }
        return 0;
      },

      /**
       * Dereference an instance handle. GML treats a raw id as an instance
       * reference; JS doesn't, so `someId.prop` compiles to `$R.d(someId).prop`.
       * Anything already object-shaped passes straight through.
       */
      d(v) {
        if (v === null || v === undefined) return DEAD_REF;
        if (typeof v === 'number') {
          if (v === -4) return DEAD_REF;
          const inst = instanceById(v);
          if (inst) return inst;
          // NOT a dead instance handle: numbers below 100000 are OBJECT asset
          // indices (GameMaker starts instance ids at 100000), and the
          // decompile bakes them where the source named an object.
          // `growtangle = 1517;` on obj_roaringknight_boxsplitter_attack is
          // `growtangle = obj_growtangle;` — and every read AND write through
          // it was landing in the dead-ref sink, which is why Flurry's box
          // never split or moved (its whole gimmick) and why the very first
          // runtime sweep logged "write to instance 1517 — ignored".
          // obj_heart_follower's `target = 1463` (= obj_heart, the Stars
          // attack) and the bullethell targeters' 1185 (= obj_mainchara) were
          // the same bug. GameMaker's own semantics for <object_index>.x is
          // "the instance of that object", so resolve exactly that way —
          // through getInstances, which also honours the soul aliases and
          // parent chains.
          if (v >= 0 && v < 100000) {
            const nm = OI() && OI().objectName(v, runtime.$chapter || 'ch3');
            if (nm) {
              const list = runtime.getInstances(nm);
              if (list.length) return list[0];
            }
          }
          // A handle to something that genuinely no longer exists. GameMaker
          // raises here, but a lerp helper outliving its target by one frame
          // shouldn't kill the whole event — route into a sink and say so once.
          const key = 'deadref:' + v;
          if (!MISSING_WARNED.has(key)) {
            MISSING_WARNED.add(key);
            console.warn(`[gml] instance/object ref ${v} resolves to nothing live — ignored`);
          }
          return DEAD_REF;
        }
        return v;
      },

      /** script_execute(scriptRef, ...) — compiled scripts are plain functions. */
      scriptExecute(self, fn) {
        const args = Array.prototype.slice.call(arguments, 2);
        if (typeof fn === 'function') {
          try { return fn.apply(self, args); } catch (e) { return 0; }
        }
        if (typeof fn === 'string') return H.scrCall(fn, self, args);
        return 0;
      },

      del(v) { return v; },

      static(key, init) {
        if (!(key in STATICS)) STATICS[key] = init;
        return STATICS[key];
      },

      // These take an instance HANDLE, which in GML may be a raw id — obj_lerpvar
      // drives its tween with variable_instance_set(target, varname, ...) where
      // target is an id. Without the deref the write threw, so the lerp helper
      // never reached its own instance_destroy() and leaked one per call.
      hasVar(inst, name) { const t = H.d(inst); return !!t && !t.$dead && Object.prototype.hasOwnProperty.call(t, name); },
      getVar(inst, name) { const t = H.d(inst); return t ? t[name] : undefined; },
      setVar(inst, name, v) { const t = H.d(inst); if (t) t[name] = v; return v; },

      debug() { console.log.apply(console, Array.prototype.slice.call(arguments).map(str)); },

      // ── drawing context ────────────────────────────────────────────
      setCtx(ctx) { activeCtx = ctx; if (global.setActiveCtx) global.setActiveCtx(ctx); },
      ctx() { return activeCtx || global.$gmlActiveCtx; },

      /** draw_self() on whatever the current `self` is, if it can draw at all. */
      drawSelf(inst) {
        if (!inst || typeof inst.drawSelf !== 'function') return;
        const ctx = activeCtx || global.$gmlActiveCtx;
        if (ctx) inst.drawSelf(ctx);
      },

      // ── collision ──────────────────────────────────────────────────
      bbox,

      /**
       * collision_rectangle. Non-precise is a bounding-box test (GameMaker's
       * Rectangle-mask tier); precise samples the pixel mask over the overlap.
       */
      collisionRect(x1, y1, x2, y2, objArg, prec, notme, self) {
        const r = {
          left: Math.min(num(x1), num(x2)), top: Math.min(num(y1), num(y2)),
          right: Math.max(num(x1), num(x2)), bottom: Math.max(num(y1), num(y2)),
        };
        const precise = bool(prec);
        for (const inst of instancesOf(objArg)) {
          if (notme && inst === self) continue;
          const g = maskGeom(inst);
          if (!g) continue;                       // no sprite, no mask, no collision
          const bb = aabbOf(g);
          if (!rectsOverlap(r, bb)) continue;
          if (!precise) return inst;
          // Sample the rect ∩ bbox region against the pixel mask.
          const l = Math.max(r.left, bb.left), t = Math.max(r.top, bb.top);
          const ri = Math.min(r.right, bb.right), bo = Math.min(r.bottom, bb.bottom);
          if ((ri - l) * (bo - t) > PRECISE_REGION_CAP) return inst;
          for (let y = Math.floor(t); y <= bo; y++) {
            for (let x = Math.floor(l); x <= ri; x++) {
              if (pointInMask(g, x + 0.5, y + 0.5, true)) return inst;
            }
          }
        }
        return -4;
      },

      collisionCircle(cx, cy, rad, objArg, prec, notme, self) {
        cx = num(cx); cy = num(cy); rad = num(rad);
        const precise = bool(prec);
        for (const inst of instancesOf(objArg)) {
          if (notme && inst === self) continue;
          const g = maskGeom(inst);
          if (!g) continue;
          const bb = aabbOf(g);
          const nx = Math.max(bb.left, Math.min(cx, bb.right));
          const ny = Math.max(bb.top, Math.min(cy, bb.bottom));
          if (Math.hypot(cx - nx, cy - ny) > rad) continue;
          if (!precise) return inst;
          const l = Math.max(bb.left, cx - rad), t = Math.max(bb.top, cy - rad);
          const ri = Math.min(bb.right, cx + rad), bo = Math.min(bb.bottom, cy + rad);
          if ((ri - l) * (bo - t) > PRECISE_REGION_CAP) return inst;
          for (let y = Math.floor(t); y <= bo; y++) {
            for (let x = Math.floor(l); x <= ri; x++) {
              const wx = x + 0.5, wy = y + 0.5;
              if (Math.hypot(wx - cx, wy - cy) <= rad && pointInMask(g, wx, wy, true)) return inst;
            }
          }
        }
        return -4;
      },

      collisionPoint(px, py, objArg, prec, notme, self) {
        px = num(px); py = num(py);
        const precise = bool(prec);
        for (const inst of instancesOf(objArg)) {
          if (notme && inst === self) continue;
          const g = maskGeom(inst);
          if (!g) continue;
          if (precise) {
            if (pointInMask(g, px, py, true)) return inst;
          } else {
            const bb = aabbOf(g);
            if (px >= bb.left && px <= bb.right && py >= bb.top && py <= bb.bottom) return inst;
          }
        }
        return -4;
      },

      collisionLine(x1, y1, x2, y2, objArg, prec, notme, self) {
        // Sampled every ~2px along the segment.
        x1 = num(x1); y1 = num(y1); x2 = num(x2); y2 = num(y2);
        const precise = bool(prec);
        const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 2));
        for (const inst of instancesOf(objArg)) {
          if (notme && inst === self) continue;
          const g = maskGeom(inst);
          if (!g) continue;
          const bb = aabbOf(g);
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
            if (px < bb.left || px > bb.right || py < bb.top || py > bb.bottom) continue;
            if (!precise || pointInMask(g, px, py, true)) return inst;
          }
        }
        return -4;
      },

      /**
       * place_meeting / instance_place: `self`'s mask moved to (x, y) against
       * each target's mask — pixel-precise when both sides have pixels, the
       * oriented-box tier otherwise.
       */
      placeMeeting(x, y, objArg, self) {
        if (!self) return -4;
        const gSelf = maskGeom(self, x, y);
        if (!gSelf) return -4;
        for (const inst of instancesOf(objArg)) {
          if (inst === self) continue;
          if (geomsCollide(gSelf, maskGeom(inst))) return inst;
        }
        return -4;
      },

      /** Instance-vs-instance, for the collision-event dispatcher. */
      instancesCollide,

      // ── error reporting ────────────────────────────────────────────
      eventError(objectName, method, err) {
        const key = `${objectName}.${method}: ${err && err.message}`;
        if (!MISSING_WARNED.has(key)) {
          MISSING_WARNED.add(key);
          console.error(`${method} Error [${objectName}]:`, err);
        }
        if (runtime.log) runtime.log(`${method} error [${objectName}]: ${err && err.message}`);
      },

      /**
       * Script table, filled by GMLTranslator.compileScripts(). It is a Proxy
       * so scripts JIT-compile on property READ, not just on scrCall: compiled
       * GML passes scripts as VALUES — `scr_script_delayed(scr_var, 6, ...)`
       * emits `$R.scr["scr_var"]` in argument position — and before this an
       * uncompiled name yielded undefined, obj_script_delayed stored it, and
       * script_execute(undefined) made the whole delayed payload a silent
       * no-op (the shell-kick shell froze on its first floor squash because
       * its "restore -vspeed in 6 frames" never ran).
       */
      scr: new Proxy(Object.create(null), {
        get(store, name) {
          if (typeof name !== 'string') return store[name];
          let fn = store[name];
          if (fn === undefined && !SCR_JIT_MISS.has(name) && global.GML_SCRIPT_SOURCES_BY_CHAPTER) {
            // Not every chapter's extraction has every shared script —
            // scr_var/scr_get_box are absent from ch1/ch2 sources but ch2
            // (SNEO) code still calls into shared helpers. Try the runtime's
            // chapter first, then every other chapter: the corpus versions
            // are the same engine scripts. Only a name missing EVERYWHERE
            // goes in the miss cache (a per-chapter miss must not poison the
            // chapters that do have it).
            const t = global.__jitTranslator || (global.__jitTranslator = new global.GMLTranslator(null));
            const tried = new Set();
            for (const ch of [runtime.$chapter || 'ch3', 'ch4', 'ch3', 'ch5', 'ch2', 'ch1']) {
              if (tried.has(ch)) continue;
              tried.add(ch);
              try {
                const code = t.compileSingleScript(ch, name);
                if (code) { new Function('runtime', code)(runtime); fn = store[name]; }
              } catch (e) { /* try the next chapter */ }
              if (fn !== undefined) break;
            }
            if (fn === undefined) SCR_JIT_MISS.add(name);
          }
          return fn;
        },
      }),

      /**
       * Compile a class for `objectName` on first use — parents first, so
       * inheritance resolves — from the extracted event tables (which win) or
       * the preset table. This is what lets the studio load instantly: nothing
       * compiles until an attack actually spawns it.
       */
      ensureClass(objectName) {
        if (runtime.objectDefinitions[objectName]) return runtime.objectDefinitions[objectName];
        const ch = runtime.$chapter || 'ch3';
        const byCh = global.GML_OBJECT_EVENTS_BY_CHAPTER || {};
        let events = (byCh[ch] && byCh[ch][objectName]) || null;
        if (!events) {
          // Preset fallback (hand-edited create/step/draw subsets).
          if (!global.__presetEventMap) {
            global.__presetEventMap = {};
            for (const [k, p] of Object.entries(global.GML_MASTER_PRESETS || {})) {
              global.__presetEventMap[p.name || k] = p;
            }
          }
          events = global.__presetEventMap[objectName] || null;
        }
        if (!events) return null;
        const oi = OI();
        const parent = oi ? oi.defaults(objectName, ch).parent : null;
        if (parent && !runtime.objectDefinitions[parent]) H.ensureClass(parent);
        try {
          const t = global.__jitTranslator || (global.__jitTranslator = new global.GMLTranslator(null));
          const code = t.compileObject(objectName, Object.assign({ chapter: ch }, events)).code;
          const cls = new Function('GMLInstance', 'runtime', code + ';\nreturn ' + objectName + ';')(global.GMLInstance, runtime);
          runtime.registerObject(objectName, cls);
          return cls;
        } catch (e) {
          const key = 'jit:' + objectName;
          if (!MISSING_WARNED.has(key)) {
            MISSING_WARNED.add(key);
            console.error(`[gml] JIT compile failed for ${objectName}:`, e);
          }
          return null;
        }
      },

      /**
       * Resolve a compiled script FUNCTION (JIT on miss) without calling it —
       * for `new constructor_name(...)`, where the value itself is needed.
       */
      scrGet(name) {
        if (typeof H.scr[name] === 'function') return H.scr[name];
        try {
          const t = global.__jitTranslator || (global.__jitTranslator = new global.GMLTranslator(null));
          const code = t.compileSingleScript(runtime.$chapter || 'ch3', name);
          if (code) new Function('runtime', code)(runtime);
        } catch (e) { /* fall through to the stub below */ }
        if (typeof H.scr[name] === 'function') return H.scr[name];
        const key = 'ctor:' + name;
        if (!MISSING_WARNED.has(key)) {
          MISSING_WARNED.add(key);
          console.warn(`[gml] no constructor source for ${name} — returning empty struct`);
        }
        return function () {};
      },

      /**
       * Call a compiled GlobalScript with `this` bound to the caller, which is
       * how GML's legacy scripts scope. Scripts compile just-in-time on first
       * call; $R.miss remains the fallback for names with no source anywhere.
       */
      scrCall(name, self, args) {
        let fn = H.scr[name];
        if (typeof fn !== 'function' && global.GML_SCRIPT_SOURCES_BY_CHAPTER) {
          try {
            const t = global.__jitTranslator || (global.__jitTranslator = new global.GMLTranslator(null));
            const code = t.compileSingleScript(runtime.$chapter || 'ch3', name);
            if (code) {
              new Function('runtime', code)(runtime);
              fn = H.scr[name];
            }
          } catch (e) {
            const key = 'jitscr:' + name;
            if (!MISSING_WARNED.has(key)) {
              MISSING_WARNED.add(key);
              console.error(`[gml] JIT script compile failed for ${name}:`, e);
            }
          }
        }
        if (typeof fn === 'function') {
          try { return fn.apply(self, args); }
          catch (e) {
            const key = 'scr:' + name + ':' + e.message;
            if (!MISSING_WARNED.has(key)) { MISSING_WARNED.add(key); console.error(`[gml] ${name}() threw:`, e); }
            return 0;
          }
        }
        return H.miss(name, self, args);
      },

      /**
       * Iteration guard for compiled `while` / `do…until`. Returns false once a
       * single loop entry exceeds the cap, which breaks the loop and reports the
       * site ONCE. The cap is far above any real game loop (the largest in this
       * corpus walks a 343-note chart), so a trip means the exit condition can
       * never be met — a hang the browser can't recover from otherwise.
       */
      spin(i, site) {
        if (i < 500000) return true;
        const key = 'spin:' + site;
        if (!MISSING_WARNED.has(key)) {
          MISSING_WARNED.add(key);
          console.warn(`[gml] loop in ${site} exceeded 500k iterations — bailing out. Its exit condition is never satisfied.`);
        }
        return false;
      },

      liveInstances,
    };

    return H;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RUNTIME PATCHES
  // ═══════════════════════════════════════════════════════════════════════

  function patchRuntime(runtime, H) {
    if (runtime.$patched) return;
    runtime.$patched = true;

    // The runtime models the SOUL as a plain {x, y} object, but getInstances()
    // hands it back for obj_heart / obj_mainchara / obj_soul — so any
    // `with (obj_heart) ...` block ran against something with no drawSelf, no
    // sprite_index, no depth and no destroyed flag. Promote it to a real
    // instance, keeping its position, and deliberately leave it out of
    // runtime.instances because the studio draws the SOUL itself.
    if (runtime.soul && typeof runtime.soul.drawSelf !== 'function' && global.GMLInstance) {
      const old = runtime.soul;
      // Build the soul from the REAL obj_heart class and run its Create, rather
      // than hand-fabricating an instance with a few fields filled in.
      //
      // obj_heart's Create defines state the rest of the game reads back —
      // notably `wspeed = global.sp` (the soul's horizontal speed). Fabricated
      // souls had no wspeed, the instance proxy answered the read with a
      // zero-valued auto-array, and obj_purplecontrols' horizontal step
      // (`x_ongrid = min(x_ongrid + wspeed, 63)`) became a permanent no-op —
      // which is exactly why the purple soul could move vertically (hard-coded
      // lane literals) but never left or right.
      const sx = num(old.x) || 320, sy = num(old.y) || 240;
      let soul;
      try {
        const cls = H.ensureClass('obj_heart');
        soul = cls ? new cls('obj_heart', sx, sy, 99998) : null;
      } catch (e) { soul = null; }
      if (!soul) soul = new global.GMLInstance('obj_heart', sx, sy, 99998);
      if (typeof soul.create === 'function' && !soul._created) {
        soul._created = true;
        // The Create also spawns obj_grazebox and touches battle globals; that is
        // the real behaviour, and anything it cannot reach is caught per-event.
        try { soul.create(soul); } catch (e) { runtime.log('obj_heart Create: ' + e.message); }
      }
      // Belt and braces: if the class was unavailable, seed what Create defines
      // so no reader ever sees an absent wspeed.
      if (typeof soul.wspeed !== 'number') {
        global.sp = num(global.sp) || 4;
        soul.wspeed = num(global.sp);
      }
      soul.sprite_index = 'spr_heart';
      soul.mask_index = 'spr_dodgeheartmask';
      soul.depth = -100;
      // The real obj_heart defaults to movable; purple mode (ch5 type 199) sets
      // canmove = 0 and hands movement to obj_purplecontrols. Defaulting it here
      // lets hosts honour that handoff without guessing.
      soul.canmove = 1;
      for (const k of Object.keys(old)) {
        if (k !== 'x' && k !== 'y') soul[k] = old[k];
      }
      runtime.soul = soul;
    }

    // ── Event order ────────────────────────────────────────────────────
    // GameMaker runs each event type as a phase over all instances, alarms
    // BEFORE Step, then built-in movement, then End Step.
    runtime.step = function () {
      runtime.$frameCreations = 0;
      resetSurfaceStack();
      // Each phase takes a FRESH live list, matching GameMaker: an instance
      // created during the Step phase skips the event types that already ran
      // this frame, but is still moved and drawn this same frame.
      const phase = () => H.liveInstances();

      // Between-frames bookkeeping: xprevious/yprevious snapshot (GameMaker sets
      // them at the start of the step, not mid-movement) and sprite animation.
      for (const inst of phase()) {
        inst.xprevious = num(inst.x);
        inst.yprevious = num(inst.y);
        advanceAnimation(inst, runtime);
      }

      for (const inst of phase()) if (typeof inst.stepBegin === 'function') safe(inst, 'stepBegin', runtime);
      for (const inst of phase()) tickAlarms(inst, runtime);
      for (const inst of phase()) if (typeof inst.step === 'function') safe(inst, 'step', runtime);

      for (const inst of phase()) {
        try { inst.updateMovement(); } catch (e) { runtime.log('Movement error [' + inst.object_name + ']: ' + e.message); }
      }

      // Collision events, right after movement per the documented order. Only
      // classes that declared Collision_<other> events ($collisions, set by the
      // translator) are tested; `other` inside the event is the touched
      // instance, which is exactly what the $other prologue binds.
      for (const inst of phase()) {
        const pairs = inst && inst.constructor && inst.constructor.$collisions;
        if (!pairs || !pairs.length) continue;
        const gInst = maskGeom(inst);
        if (!gInst) continue;                     // maskless instances can't collide
        for (const [targetName, method] of pairs) {
          for (const other of H.instancesOf(targetName)) {
            if (other === inst || other.destroyed) continue;
            if (!geomsCollide(gInst, maskGeom(other))) continue;
            try { inst[method](other); }
            catch (e) { runtime.log(`collision error [${inst.object_name} vs ${targetName}]: ${e.message}`); }
            if (inst.destroyed) break;
          }
          if (inst.destroyed) break;
        }
      }

      // Outside Room (Other_0) fires every step the instance's box is fully out
      // of the room — it's how most Deltarune bullets clean themselves up.
      const rw = num(global.room_width) || 640;
      const rh = num(global.room_height) || 480;
      for (const inst of phase()) {
        if (typeof inst.outsideRoom !== 'function') continue;
        const bb = bbox(inst);
        if (bb.right < 0 || bb.left > rw || bb.bottom < 0 || bb.top > rh) {
          safe(inst, 'outsideRoom', runtime);
        }
      }

      for (const inst of phase()) if (typeof inst.stepEnd === 'function') safe(inst, 'stepEnd', runtime);

      runtime.instances = runtime.instances.filter(i => i && !i.destroyed);
    };

    // JIT: compile the object's class the first time anything spawns it.
    const plainCreate = runtime.createInstance.bind(runtime);
    runtime.createInstance = function (objType, x, y) {
      let nm = objType;
      if (nm && typeof nm === 'object' && nm.object_name) nm = nm.object_name;
      if (typeof nm === 'string') {
        nm = nm.replace(/^["']|["']$/g, '');
        if (!runtime.objectDefinitions[nm]) H.ensureClass(nm);
      }
      return plainCreate(objType, x, y);
    };

    // GameMaker runs the Destroy event as part of instance_destroy(), while the
    // instance still exists — bullets that burst into children do it there.
    // The runtime only ever set a flag, so no Destroy event ever ran.
    //
    // The re-entry guard is a WeakSet, NOT a property on the instance: reading
    // an unset property through the instance proxy materialises a truthy
    // auto-array, so an `inst.$flag` check reads as "already set" the very
    // first time.
    const destroying = new WeakSet();
    const plainDestroy = runtime.destroyInstance.bind(runtime);
    runtime.destroyInstance = function (inst) {
      if (!inst || inst.destroyed) return;
      if (!destroying.has(inst)) {
        destroying.add(inst);
        if (typeof inst.destroyEvent === 'function') {
          try { inst.destroyEvent(); }
          catch (e) { runtime.log('destroy error [' + inst.object_name + ']: ' + e.message); }
        }
        // CLEAN UP runs after Destroy whenever an instance is removed — and
        // NOTHING ever dispatched it. Round 11 extracted 349 CleanUp handlers
        // and they have been dead code since: every companion object an
        // instance frees there leaked. Measured on the Knight's Flurry, which
        // is where Landon saw "sprites that are meant to disappear but don't":
        // obj_roaringknight_splitslash's CleanUp is `safe_delete(slashmarker)`,
        // and TEN orphaned obj_marker telegraphs were still alive at the end of
        // the attack.
        if (typeof inst.cleanUp === 'function') {
          try { inst.cleanUp(); }
          catch (e) { runtime.log('cleanup error [' + inst.object_name + ']: ' + e.message); }
        }
      }
      plainDestroy(inst);
    };

    // ── Depth sort ─────────────────────────────────────────────────────
    // Higher depth draws first (behind). Ties break on creation id so
    // same-depth sprites hold a stable order instead of flickering.
    runtime.draw = function (ctx) {
      // Frame stamp for per-frame render caches (tinted surfaces).
      global.$gmlFrame = num(global.$gmlFrame) + 1;
      if (global.setActiveCtx) global.setActiveCtx(ctx);
      const order = runtime.instances
        .filter(i => i && !i.destroyed && i.visible)
        .sort((a, b) => {
          const d = num(b.depth) - num(a.depth);
          return d !== 0 ? d : num(a.id) - num(b.id);
        });

      // Host overlays (the studio's box outline and SOUL) participate in the
      // SAME depth ordering as instances instead of being painted before/after
      // everything — bullets at negative depth correctly cover them, sprites at
      // positive depth sit behind. { depth(): number, tie: number, draw(ctx) }.
      // GameMaker runs THREE full passes over the depth-sorted list — Draw
      // Begin for every instance, then Draw for every instance, then Draw End —
      // not begin/draw/end per instance. Objects that set up shared GPU state
      // (a surface target, a blend mode) in Draw Begin and tear it down in Draw
      // End rely on that ordering.
      for (const inst of order) {
        if (typeof inst.drawBegin !== 'function') continue;
        ctx.save();
        global.$gmlDrawSelf = inst;
        try { inst.drawBegin(ctx); } catch (e) { runtime.log('DrawBegin error [' + inst.object_name + ']: ' + e.message); }
        ctx.restore();
      }
      global.$gmlDrawSelf = null;

      const items = order.map(inst => ({
        d: num(inst.depth), tie: num(inst.id),
        run: c => {
          c.save();
          // `draw_sprite_ext(spr, -1, ...)` means "the caller's image_index",
          // so the draw dispatcher has to say who the caller is.
          global.$gmlDrawSelf = inst;
          try {
            if (typeof inst.draw === 'function') inst.draw(c);
            else inst.drawSelf(c);
          } catch (e) {
            runtime.log('Draw error [' + inst.object_name + ']: ' + e.message);
            try { inst.drawSelf(c); } catch (e2) {}
          }
          global.$gmlDrawSelf = null;
          c.restore();
        },
      }));
      for (const ov of runtime.$overlays || []) {
        items.push({
          d: num(typeof ov.depth === 'function' ? ov.depth() : ov.depth),
          tie: ov.tie === undefined ? 1e9 : ov.tie,
          run: c => { c.save(); try { ov.draw(c); } catch (e) {} c.restore(); },
        });
      }
      items.sort((a, b) => (b.d - a.d) || (a.tie - b.tie));
      for (const it of items) it.run(ctx);

      for (const inst of order) {
        if (typeof inst.drawEnd === 'function') {
          ctx.save();
          global.$gmlDrawSelf = inst;
          try { inst.drawEnd(ctx); } catch (e) {}
          global.$gmlDrawSelf = null;
          ctx.restore();
        }
      }
    };
  }

  function safe(inst, method, runtime) {
    try { inst[method](); }
    catch (e) { runtime.log(`${method} error [${inst.object_name}]: ${e.message}`); }
  }

  /**
   * Per the manual (Object Events): "an alarm with no actions or code in it will
   * not count down." So an alarm on an object that has no handler for that slot
   * stays put rather than expiring — code using `alarm[n] > 0` as a still-waiting
   * flag would otherwise time out here but never in GameMaker.
   *
   * Runs between Begin Step and Step, which is where the documented event order
   * puts alarms.
   */
  function tickAlarms(inst, runtime) {
    const al = inst.alarm;
    if (!al || typeof al.length !== 'number') return;
    for (let a = 0; a < 12; a++) {
      if (num(al[a]) <= 0) continue;
      const fn = inst['alarm_' + a];
      if (typeof fn !== 'function') continue;
      al[a] = num(al[a]) - 1;
      if (num(al[a]) === 0) {
        al[a] = -1;
        try { fn.call(inst); }
        catch (e) { runtime.log(`alarm_${a} error [${inst.object_name}]: ${e.message}`); }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PROTOTYPE + BUILTIN PATCHES (applied once, on load)
  // ═══════════════════════════════════════════════════════════════════════

  function patchGlobals() {
    const GI = global.GMLInstance;

    if (GI && GI.prototype) {
      // Alarms move to the step phase; movement must stop ticking them.
      const proto = GI.prototype;
      // Built-in motion only. xprevious/yprevious and sprite animation moved to
      // the start-of-step phase where GameMaker does them; friction is
      // sign-aware because speed can legitimately be negative.
      proto.updateMovement = function () {
        // Path following owns the position while active.
        if (this.$path && global.GML_HELPERS.tickPath && global.GML_HELPERS.tickPath(this)) return;
        if (bool(this.updateimageangle)) this.image_angle = this.direction;
        const g = num(this.gravity);
        if (g !== 0) {
          this.hspeed = num(this.hspeed) + global.lengthdir_x(g, num(this.gravity_direction));
          this.vspeed = num(this.vspeed) + global.lengthdir_y(g, num(this.gravity_direction));
        }
        const fr = num(this.friction);
        if (fr !== 0) {
          const spd = num(this.speed);
          if (spd > 0) this.speed = Math.max(0, spd - fr);
          else if (spd < 0) this.speed = Math.min(0, spd + fr);
        }
        this.x = num(this.x) + num(this.hspeed);
        this.y = num(this.y) + num(this.vspeed);
      };

      // ── Motion variables ─────────────────────────────────────────────
      // Straight from the manual: `direction` is a STORED property ("can be
      // used to set the direction of movement ... when it has a speed other
      // than 0"), and `speed` "can have a negative value, in which case the
      // instance will travel in the opposite direction". The old accessors
      // DERIVED both from the velocity components, so `direction = d` while
      // speed was 0 was silently lost — and `bul.direction = d; bul.speed = s;`
      // is the single most common way Deltarune aims a bullet.
      const norm360 = v => ((num(v) % 360) + 360) % 360;
      function syncPolar(o) {
        const h = num(o.$hspeed), v = num(o.$vspeed);
        const mag = Math.sqrt(h * h + v * v);
        o.$speed = mag;
        if (mag > 1e-9) o.$direction = norm360(Math.atan2(-v, h) * 180 / Math.PI);
      }
      Object.defineProperty(proto, 'hspeed', {
        configurable: true,
        get() { return this.$hspeed || 0; },
        set(v) { this.$hspeed = num(v); syncPolar(this); },
      });
      Object.defineProperty(proto, 'vspeed', {
        configurable: true,
        get() { return this.$vspeed || 0; },
        set(v) { this.$vspeed = num(v); syncPolar(this); },
      });
      Object.defineProperty(proto, 'speed', {
        configurable: true,
        get() {
          if (this.$speed !== undefined) return this.$speed;
          const h = num(this.$hspeed), v = num(this.$vspeed);
          return Math.sqrt(h * h + v * v);
        },
        set(v) {
          v = num(v);
          this.$speed = v;
          const d = this.$direction || 0;
          this.$hspeed = v * global.dcos(d);
          this.$vspeed = -v * global.dsin(d);
        },
      });
      Object.defineProperty(proto, 'direction', {
        configurable: true,
        get() { return norm360(this.$direction || 0); },
        set(v) {
          this.$direction = num(v);
          const s = this.$speed !== undefined
            ? this.$speed
            : Math.sqrt(num(this.$hspeed) ** 2 + num(this.$vspeed) ** 2);
          this.$hspeed = s * global.dcos(v);
          this.$vspeed = -s * global.dsin(v);
        },
      });

      // sprite_width/height are SIGNED (manual: affected by image_x/yscale,
      // negative when the scale is negative) and use the DECLARED frame size —
      // GML positioning math is written against the authored frame.
      Object.defineProperty(proto, 'sprite_width', {
        configurable: true,
        get() {
          const s = declaredSpriteSize(this.sprite_index);
          if (s && s.w) return s.w * (num(this.image_xscale) || 1);
          // Legacy synthetic box (sprite-less singleton in headless harnesses).
          if (this.object_name === 'obj_growtangle') {
            return (num(this.width) || 100) * num(this.maxxscale || this.image_xscale || 1);
          }
          return 0;
        },
      });
      Object.defineProperty(proto, 'sprite_height', {
        configurable: true,
        get() {
          const s = declaredSpriteSize(this.sprite_index);
          if (s && s.h) return s.h * (num(this.image_yscale) || 1);
          if (this.object_name === 'obj_growtangle') {
            return (num(this.height) || 100) * num(this.maxyscale || this.image_yscale || 1);
          }
          return 0;
        },
      });

      // sprite_xoffset / sprite_yoffset are the sprite's ORIGIN SCALED by
      // image_x/yscale — not the raw origin. obj_growtangle builds the
      // custom-size battle box around them: it paints the stretch sprite into a
      // surface at (sprite_xoffset, sprite_yoffset) and then registers the baked
      // sprite with those same values as its origin. Unimplemented, they were
      // hoisted to 0, so the art was painted with its centre at the surface's
      // top-left corner (only one quadrant landing inside) and the baked sprite
      // got origin [0,0] instead of its centre.
      const originOf = (spr, axis) => {
        const s = sprAlias(spr);
        if (!s || typeof s !== 'string') return 0;
        const o = global.GML_SPRITE_ORIGINS && global.GML_SPRITE_ORIGINS[s];
        if (o) return num(o[axis]) || 0;
        const oi = OI();
        const meta = oi && oi.spriteMeta && oi.spriteMeta(s);
        return meta ? num(axis === 0 ? meta.originX : meta.originY) || 0 : 0;
      };
      Object.defineProperty(proto, 'sprite_xoffset', {
        configurable: true,
        get() { return originOf(this.sprite_index, 0) * (num(this.image_xscale) || 1); },
      });
      Object.defineProperty(proto, 'sprite_yoffset', {
        configurable: true,
        get() { return originOf(this.sprite_index, 1) * (num(this.image_yscale) || 1); },
      });

      // An instance USED AS A NUMBER is its id, exactly as in GML, where every
      // collision/instance function hands back an id and the calling code then
      // does arithmetic on it. Without this, `_h = collision_circle(...)` gives
      // an object and the game's own idioms silently invert:
      //   if (_h >= 0)      → false even on a hit  ({} >= 0 is false)
      //   until (_h < 0)    → never true → INFINITE LOOP (Pink's singing attack
      //                       eats audience notes with exactly this loop)
      //   if (instance_place(...)) → false, because num(obj) was NaN
      // `noone` stays the literal -4, so `!= -4` and `>= 0` now agree with it.
      proto.valueOf = function () {
        const v = num(this.id);
        return isFinite(v) ? v : 0;
      };

      // bbox_* were never computed at all — reading one handed back the
      // instance proxy's auto-array. Deltarune bullets test these constantly.
      Object.defineProperty(proto, 'bbox_left', { configurable: true, get() { return bbox(this).left; } });
      Object.defineProperty(proto, 'bbox_right', { configurable: true, get() { return bbox(this).right; } });
      Object.defineProperty(proto, 'bbox_top', { configurable: true, get() { return bbox(this).top; } });
      Object.defineProperty(proto, 'bbox_bottom', { configurable: true, get() { return bbox(this).bottom; } });

      // Real sprites now honour image_blend, which Deltarune uses constantly
      // for flashing, tinting, and fading bullets.
      proto.drawSelf = function (ctx) {
        if (!ctx || isNaN(num(this.x)) || isNaN(num(this.y))) return;
        const spr = sprAlias(this.sprite_index);
        if (!spr || typeof spr !== 'string') return;
        const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(spr) : null;
        const ox = info ? num(info.originX) : 0;
        const oy = info ? num(info.originY) : 0;
        const frames = (global.GML_SPRITE_FRAMES && global.GML_SPRITE_FRAMES[spr]) || 1;
        let frameIdx = Math.floor(Math.abs(num(this.image_index)));
        if (frames > 0) frameIdx = frameIdx % frames;
        const img = global.gmlAssets ? global.gmlAssets.getImage(spr, frameIdx) : null;
        // Trimmed export art draws shifted by its trim offset (canvas-space origins).
        const trim = global.$gmlTrimOf ? global.$gmlTrimOf(spr, frameIdx) : null;
        const tox = ox - (trim ? trim[0] : 0);
        const toy = oy - (trim ? trim[1] : 0);

        ctx.save();
        ctx.translate(num(this.x), num(this.y));
        const ang = num(this.image_angle);
        if (ang !== 0) ctx.rotate(-ang * Math.PI / 180);
        const sx = num(this.image_xscale) || 0;
        const sy = num(this.image_yscale) || 0;
        if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
        const selfA = num(this.image_alpha);
        ctx.globalAlpha = isFinite(selfA) ? Math.max(0, Math.min(1, selfA)) : 1;

        if (img && img.complete && img.naturalWidth > 0) {
          drawTinted(ctx, img, -tox, -toy, this.image_blend);
        } else if (num(this.image_alpha) > 0) {
          // Missing-art placeholder. It must honour the REAL alpha — the old
          // 0.3 floor made intentionally invisible sprites show up as solid
          // boxes (a full-screen bg sprite at alpha 0 became a white wall).
          const size = declaredSpriteSize(spr) || { w: 16, h: 16 };
          ctx.fillStyle = global.toCSSColor(this.image_blend || '#ffffff');
          ctx.fillRect(-ox, -oy, size.w, size.h);
        }
        ctx.restore();
      };

      // Assigning a sprite must refresh image_number, exactly as GameMaker does.
      const desc = Object.getOwnPropertyDescriptor(proto, 'sprite_index');
      if (!desc) {
        Object.defineProperty(proto, '$syncSprite', {
          value: function () {
            const f = global.GML_SPRITE_FRAMES && global.GML_SPRITE_FRAMES[this.sprite_index];
            if (f) this.image_number = f;
          },
          enumerable: false,
        });
      }
    }

    // ── Colour model ───────────────────────────────────────────────────
    // GameMaker packs colours as BGR (0xBBGGRR). toCSSColor already decodes
    // that way; make_color_rgb was packing RGB, swapping red and blue.
    global.make_color_rgb = function (r, g, b) {
      return (num(r) & 255) | ((num(g) & 255) << 8) | ((num(b) & 255) << 16);
    };
    global.make_colour_rgb = global.make_color_rgb;
    global.color_get_red = global.colour_get_red = c => channels(c)[0];
    global.color_get_green = global.colour_get_green = c => channels(c)[1];
    global.color_get_blue = global.colour_get_blue = c => channels(c)[2];

    // ── Constants the runtime never defined ────────────────────────────
    // A missing one is a ReferenceError that kills the whole event, e.g.
    // obj_knight_roaring2's Draw referencing bm_zero.
    const CONSTS = {
      // GameMaker's documented blend FACTORS (bm_zero starts at 1, not 0). The
      // previous ad-hoc numbering gave bm_src_colour and bm_src_alpha the same
      // value as the copies in gml_runtime, so a multiply blend was composited
      // as destination-in. Blend MODES (bm_normal/add/subtract/max) are a
      // separate, unrelated enum — do not merge the two.
      bm_zero: 1, bm_one: 2, bm_src_colour: 3, bm_inv_src_colour: 4,
      bm_src_alpha: 5, bm_inv_src_alpha: 6, bm_dest_alpha: 7, bm_inv_dest_alpha: 8,
      bm_dest_colour: 9, bm_inv_dest_colour: 10, bm_src_alpha_sat: 11,
      bm_max: 2, bm_complex: 4, bm_normal_alpha: 0,
      // Event kinds/subtypes for event_perform. Missing, these compiled to
      // undefined instance variables, so every event_perform was a no-op —
      // including the ones Deltarune uses to draw objects it marks invisible.
      ev_create: 0, ev_destroy: 1, ev_alarm: 2, ev_step: 3, ev_collision: 4,
      ev_keyboard: 5, ev_mouse: 6, ev_other: 7, ev_draw: 8, ev_keypress: 9,
      ev_keyrelease: 10, ev_trigger: 11,
      ev_step_normal: 0, ev_step_begin: 1, ev_step_end: 2,
      ev_draw_normal: 0, ev_gui: 64, ev_draw_begin: 72, ev_draw_end: 73,
      ev_gui_begin: 74, ev_gui_end: 75, ev_draw_pre: 76, ev_draw_post: 77,
      ev_outside: 0, ev_boundary: 1, ev_game_start: 2, ev_game_end: 3,
      ev_room_start: 4, ev_room_end: 5, ev_no_more_lives: 6, ev_animation_end: 7,
      ev_end_of_path: 8, ev_no_more_health: 9, ev_close_button: 30,
      ev_user0: 10, ev_user1: 11, ev_user2: 12, ev_user3: 13, ev_user4: 14,
      ev_user5: 15, ev_user6: 16, ev_user7: 17, ev_user8: 18, ev_user9: 19,
      ev_user10: 20, ev_user11: 21, ev_user12: 22, ev_user13: 23, ev_user14: 24,
      ev_user15: 25,
      c_fuchsia: '#ff00ff', c_maroon: '#800000', c_navy: '#000080',
      c_olive: '#808000', c_silver: '#c0c0c0', c_teal: '#008080',
      c_dkgray: '#404040', c_ltgray: '#c0c0c0', c_dkgrey: '#404040', c_ltgrey: '#c0c0c0',
      fa_left: 0, fa_center: 1, fa_right: 2, fa_top: 0, fa_middle: 1, fa_bottom: 2,
      pr_pointlist: 1, pr_linelist: 2, pr_linestrip: 3,
      pr_trianglelist: 4, pr_trianglestrip: 5, pr_trianglefan: 6,
      // Every OS constant must be DISTINCT. With only os_windows defined, every
      // other one read as undefined — and `os_type == os_ps4` then compared
      // undefined to undefined and came out TRUE, so the corpus took its
      // PlayStation branch and added a +1px offset to every `d_*` shape call
      // (104 d_circle and 33 d_line sites in chapter 4 alone).
      infinity: Infinity, room_speed: 30, os_type: 0,
      os_windows: 0, os_macosx: 1, os_linux: 2, os_ios: 3, os_android: 4,
      os_ps3: 5, os_ps4: 6, os_ps5: 7, os_psvita: 8, os_xboxone: 9,
      os_xboxseriesxs: 10, os_switch: 11, os_uwp: 12, os_unknown: -1,
      browser_not_a_browser: 0, os_browser: 0,
      gamemaker_pro: true, pointer_null: null,
      // obj_lerpvar checks `global.interact != 0` to pause tweens; undefined
      // compared != 0 is true, which froze every respect-interact lerp.
      interact: 0,
      // Room/timing globals. Bullets routinely test `x > room_width` to know
      // when they've left the screen; undefined here was a ReferenceError that
      // killed the whole Step event, so off-screen bullets never despawned.
      room_width: 640, room_height: 480, room: 0, view_current: 0,
      fps: 30, fps_real: 30, delta_time: 33333, current_time: 0,
      mouse_x: 0, mouse_y: 0, mouse_button: 0,
    };
    for (const [k, v] of Object.entries(CONSTS)) {
      if (global[k] === undefined) global[k] = v;
    }
    // Aliases GameMaker spells both ways.
    if (global.bm_src_color === undefined) global.bm_src_color = global.bm_src_colour;
    if (global.bm_inv_src_color === undefined) global.bm_inv_src_color = global.bm_inv_src_colour;
    if (global.bm_dest_color === undefined) global.bm_dest_color = global.bm_dest_colour;
    if (global.bm_inv_dest_color === undefined) global.bm_inv_dest_color = global.bm_inv_dest_colour;

    // ── Battle box geometry ────────────────────────────────────────────
    // The real scr_get_box is:
    //   0 = RIGHT  (x + sprite_width  * 0.5)
    //   1 = top    (y - sprite_height * 0.5)
    //   2 = LEFT   (x - sprite_width  * 0.5)
    //   3 = bottom (y + sprite_height * 0.5)
    //   4/5 = centre x/y
    // The runtime had 0 and 2 swapped and sized the box with image_xscale instead
    // of sprite_width (which for the growtangle is width * maxxscale), so every
    // edge test came out mirrored and at the wrong extent. Attacks use this to
    // decide where to spawn and when a bullet has left the arena.
    function boxEdges() {
      const rt = global.activeGMLRuntime;
      const gt = rt && rt.growtangle;
      if (!gt) return { l: 160, t: 160, r: 480, b: 320, cx: 320, cy: 240 };
      // sprite_width is legitimately 0 while the box grows in (image_xscale
      // starts at 0), and the REAL instance has no legacy `width` field — so
      // fall through only on non-finite values, never on honest zeros.
      const swRaw = num(gt.sprite_width), shRaw = num(gt.sprite_height);
      const legW = num(gt.width) * Math.abs(num(gt.maxxscale) || num(gt.image_xscale) || 1);
      const legH = num(gt.height) * Math.abs(num(gt.maxyscale) || num(gt.image_yscale) || 1);
      const halfW = Math.abs(isFinite(swRaw) ? swRaw : (isFinite(legW) ? legW : 150)) * 0.5;
      const halfH = Math.abs(isFinite(shRaw) ? shRaw : (isFinite(legH) ? legH : 150)) * 0.5;
      const cx = num(gt.x), cy = num(gt.y);
      return { l: cx - halfW, t: cy - halfH, r: cx + halfW, b: cy + halfH, cx, cy };
    }
    global.scr_get_box = function (idx) {
      const e = boxEdges();
      switch (num(idx)) {
        case 0: return e.r;
        case 1: return e.t;
        case 2: return e.l;
        case 3: return e.b;
        case 4: return e.cx;
        case 5: return e.cy;
        default: return e.cx;
      }
    };
    // ── instance_exists with GameMaker's full argument semantics ───────
    // The runtime version only understood object NAMES. But GML also passes:
    //   • raw instance IDS (>= 100000) — obj_script_delayed stores `target = id`
    //     and gates its whole payload on `i_ex(target)`. With a number it
    //     returned false, so every scr_script_delayed payload silently
    //     SKIPPED — the shell-kick shell froze on its first floor squash
    //     because the delayed "restore -vspeed" never ran.
    //   • object ASSET INDICES (< 100000) — decompiler-baked object refs.
    global.instance_exists = function (v) {
      const rt = global.activeGMLRuntime;
      if (!rt) return false;
      if (v === undefined || v === null || v === -4) return false;
      if (typeof v === 'object') return !v.destroyed;
      if (typeof v === 'number') {
        if (v >= 100000) {
          for (const i of rt.instances) if (i && !i.destroyed && num(i.id) === v) return true;
          return false;
        }
        if (v < 0) return false;
        const nm = OI() && OI().objectName(v, rt.$chapter || 'ch3');
        return !!nm && rt.getInstances(nm).length > 0;
      }
      return rt.getInstances(v).length > 0;
    };
    global.i_ex = global.instance_exists;

    global.gt_minx = () => boxEdges().l;
    global.gt_maxx = () => boxEdges().r;
    global.gt_miny = () => boxEdges().t;
    global.gt_maxy = () => boxEdges().b;
    global.gt_inbounds = (x, y) => {
      const e = boxEdges();
      return num(x) >= e.l && num(x) <= e.r && num(y) >= e.t && num(y) <= e.b;
    };
    global.gt_inbounds_tol = (x, y, tol) => {
      const e = boxEdges();
      const t = num(tol);
      return num(x) >= e.l - t && num(x) <= e.r + t && num(y) >= e.t - t && num(y) <= e.b + t;
    };
    /** Shared by the studio so the drawn outline IS the collision box. */
    global.GML_BOX_EDGES = boxEdges;

    /**
     * Move the SOUL the way the real `obj_heart` Step does.
     *
     * The game does NOT clamp the heart to a rectangle — it collides it against
     * `obj_battlesolid` (the box's parent) with `place_meeting(x + px, y + py,
     * obj_battlesolid)`, sliding per axis, and only then applies the VIEW
     * bounds: x in [0, 640 - sprite_width], y in [0, 320 - sprite_height +
     * boundaryup].
     *
     * That one difference is why a rectangle clamp could never be right:
     *  - the box's mask is a HOLLOW frame, so the heart is bounded by the actual
     *    drawn border — rotated boxes and custom-built box shapes just work;
     *  - when an attack DESTROYS the box (Jevil's BYE BYE finale), nothing is
     *    left to collide with and the heart roams the whole screen, which is
     *    the "the entire screen becomes the battlebox" effect. A clamp to the
     *    last known rectangle — or to a default one — killed it.
     *  - `boundaryup` is how the finale extends the floor (it sets 160).
     */
    function moveSoul(dx, dy) {
      // This lives in the GLOBAL patch section (like boxEdges), so there is no
      // `runtime` in scope — read the active one, as scr_get_box does.
      const rt = global.activeGMLRuntime;
      const soul = rt && rt.soul;
      if (!soul) return;
      dx = num(dx); dy = num(dy);
      // Where the soul stood BEFORE this input tick. Game code writes
      // obj_heart.x/y directly (the phonehand master pins the heart at
      // master.x - 36 even past the box wall) and in GameMaker those writes
      // are AUTHORITATIVE — walls only gate the player's own movement. The
      // union backstop below must therefore never yank a heart that game
      // code already placed outside the box.
      const entryX = num(soul.x), entryY = num(soul.y);
      const oi = global.GML_OBJECT_INDEX;
      const chapter = (rt && rt.$chapter) || 'ch3';
      const isSolid = inst => inst.object_name === 'obj_battlesolid'
        || (oi && oi.isDescendantOf(inst.object_name, 'obj_battlesolid', chapter));
      // A solid PARKED OFFSCREEN is not a wall. `instance_create(-9999, -9999,
      // ...)` is a standard GML idiom for stowing an object out of view, and
      // the boxsplitter attack moves obj_growtangle to x = -9999 partway
      // through. The union-bounds backstop below then dutifully clamped the
      // heart into that box's bounds and yanked it across the screen — measured
      // at frame 300 of knight_type99: box at -9999, soul dragged from x 441 to
      // x 0. Ignore solids whose bounds lie wholly outside the view; the view
      // clamp at the end still contains the heart when no real box is left.
      const solids = rt.instances.filter(i => {
        if (!i || i.destroyed || !isSolid(i)) return false;
        const px = num(i.x), py = num(i.y);
        return isFinite(px) && isFinite(py)
          && px > -2000 && px < 2640 && py > -2000 && py < 2320;
      });

      // The box's mask is a HOLLOW frame whose pixels are decoded lazily from
      // the PNG, and the heart's art is no different. Until BOTH have pixels,
      // geomsCollide falls back to the bounding RECTANGLE — and for a hollow
      // frame that reads as "the heart's own position is inside a solid",
      // pinning it for the whole attack. Ignoring the wall instead is just as
      // wrong the other way: the heart escapes and the frame then locks it out.
      // So fall back to the rectangle CLAMP (right for an ordinary box) and
      // switch to real per-pixel walls the moment the art is ready.
      const soulGeom = maskGeom(soul, num(soul.x), num(soul.y));
      const solidGeoms = solids.map(s => maskGeom(s)).filter(Boolean);
      const hasBits = g => !!(g && g.mask && g.mask.bits);
      const precise = hasBits(soulGeom) && solidGeoms.length > 0 && solidGeoms.every(hasBits);

      const blocked = (nx, ny) => {
        if (!precise) return false;
        const g = maskGeom(soul, nx, ny);
        if (!g) return false;
        for (const gs of solidGeoms) if (geomsCollide(g, gs)) return true;
        return false;
      };
      // One pixel at a time so the heart comes to rest ON the wall (and can
      // still slide along it), which is what GML's per-axis retry achieves.
      const slide = (axis, amount) => {
        const stepPx = Math.sign(amount);
        for (let i = 0; i < Math.abs(amount); i++) {
          const nx = axis === 'x' ? num(soul.x) + stepPx : num(soul.x);
          const ny = axis === 'y' ? num(soul.y) + stepPx : num(soul.y);
          if (blocked(nx, ny)) break;
          soul.x = nx; soul.y = ny;
        }
      };
      slide('x', dx);
      slide('y', dy);

      // Backstop: while ANY box exists the heart stays within the union of the
      // solids' bounds. Precise walls do the real work; this only catches the
      // cases where per-pixel walls can't be trusted — art still decoding, or a
      // runtime-built custom box sprite (the Knight's 0.5x slit) whose mask
      // doesn't line up with how it draws. Without it the heart slips out and
      // the frame then locks it OUT, which is far worse than a slightly loose
      // wall. For a rotated box the union is wider than the box, so precise
      // collision still governs; for the screen-sized arenas it is looser than
      // the view bounds below and does nothing.
      if (solids.length) {
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
        for (const gs of solidGeoms) {
          const bb = aabbOf(gs);
          if (!bb) continue;
          l = Math.min(l, bb.left); t = Math.min(t, bb.top);
          r = Math.max(r, bb.right); b = Math.max(b, bb.bottom);
        }
        if (!isFinite(l)) { const e = boxEdges(); l = e.l; t = e.t; r = e.r; b = e.b; }
        // Precise walls already stop the heart AT the frame, so only inset when
        // falling back to the rectangle.
        const pad = precise ? 0 : 8;
        // Only clamp a heart that STARTED this tick inside the box (small
        // tolerance for the pad). If game code parked it outside — the
        // phonehand push, a cutscene reposition — the clamp would fight that
        // authoritative write every frame and the heart visibly jittered
        // against the wall. Input already can't ESCAPE the box: the per-pixel
        // slide above blocks at the frame, and a heart outside gets no help
        // from us to move further out (the view clamp still applies).
        const wasInside = entryX >= l - pad && entryX <= r + pad
          && entryY >= t - pad && entryY <= b + pad;
        if (wasInside && r - l > pad * 2 && b - t > pad * 2) {
          soul.x = Math.max(l + pad, Math.min(r - pad, num(soul.x)));
          soul.y = Math.max(t + pad, Math.min(b - pad, num(soul.y)));
        }
      }

      const vx = typeof global.camerax === 'function' ? num(global.camerax()) : 0;
      const vy = typeof global.cameray === 'function' ? num(global.cameray()) : 0;
      const sw = Math.abs(num(soul.sprite_width)) || 16;
      const sh = Math.abs(num(soul.sprite_height)) || 16;
      const bUp = num(soul.boundaryup) || 0;
      soul.x = Math.max(vx, Math.min(vx + 640 - sw, num(soul.x)));
      soul.y = Math.max(vy, Math.min(vy + 320 - sh + bUp, num(soul.y)));
    }
    global.GML_MOVE_SOUL = moveSoul;

    // ── Player input polled by game objects ─────────────────────────────
    // obj_spearblocker aims Gerson's green-soul shield with up_h()/right_h()
    // etc. These were stubs returning 0, so the shield never rotated. The host
    // (gml_studio) fills global.$gmlInput once per STEP, including pressed
    // edges; the functions just read it.
    global.$gmlInput = global.$gmlInput || {
      l: 0, r: 0, u: 0, d: 0, lp: 0, rp: 0, up: 0, dp: 0,
      z: 0, zp: 0, x: 0, xp: 0, c: 0, cp: 0,
    };
    const IN = () => global.$gmlInput;
    const held = k => () => !!IN()[k];
    global.left_h = held('l'); global.right_h = held('r');
    global.up_h = held('u'); global.down_h = held('d');
    global.left_p = held('lp'); global.right_p = held('rp');
    global.up_p = held('up'); global.down_p = held('dp');
    // Deltarune's three buttons: 1 = confirm (Z), 2 = cancel (X), 3 = menu (C).
    global.button1 = global.button1_h = held('z'); global.button1_p = held('zp');
    global.button2 = global.button2_h = held('x'); global.button2_p = held('xp');
    global.button3 = global.button3_h = held('c'); global.button3_p = held('cp');

    // Camera queries the runtime exposes only through __view_get.
    def('camera_get_view_x', () => 0);
    def('camera_get_view_y', () => 0);
    def('camera_get_view_width', () => 640);
    def('camera_get_view_height', () => 480);
    def('view_get_camera', () => 0);
    def('camera_set_view_pos', () => {});
    def('camera_set_view_size', () => {});

    // ── Math / string polyfills the runtime was missing ────────────────
    def('power', (a, b) => Math.pow(num(a), num(b)));
    def('sqr', v => num(v) * num(v));
    def('exp', v => Math.exp(num(v)));
    def('ln', v => Math.log(num(v)));
    def('log2', v => Math.log2(num(v)));
    def('log10', v => Math.log10(num(v)));
    def('logn', (n, v) => Math.log(num(v)) / Math.log(num(n)));
    def('frac', v => num(v) - Math.trunc(num(v)));
    def('real', v => num(v));
    def('median', function () {
      const a = flat(arguments).map(num).sort((x, y) => x - y);
      if (!a.length) return 0;
      const m = a.length >> 1;
      return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
    });
    def('mean', function () { const a = flat(arguments).map(num); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; });
    def('arcsin', v => Math.asin(num(v)));
    def('arccos', v => Math.acos(num(v)));
    def('arctan', v => Math.atan(num(v)));
    def('arctan2', (y, x) => Math.atan2(num(y), num(x)));
    def('darcsin', v => Math.asin(num(v)) * 180 / Math.PI);
    def('darccos', v => Math.acos(num(v)) * 180 / Math.PI);
    def('darctan2', (y, x) => Math.atan2(num(y), num(x)) * 180 / Math.PI);
    def('dot_product', (x1, y1, x2, y2) => num(x1) * num(x2) + num(y1) * num(y2));
    def('is_undefined', v => v === undefined);
    def('is_real', v => typeof v === 'number');
    def('is_string', v => typeof v === 'string');
    def('is_array', v => Array.isArray(v));
    def('is_struct', v => !!v && typeof v === 'object' && !Array.isArray(v));
    def('is_method', v => typeof v === 'function');
    def('is_numeric', v => typeof v === 'number');

    def('string_length', s => str(s).length);
    def('string_copy', (s, i, n) => str(s).substr(Math.max(0, num(i) - 1), num(n)));
    def('string_char_at', (s, i) => str(s).charAt(num(i) - 1));
    def('string_pos', (sub, s) => str(s).indexOf(str(sub)) + 1);
    def('string_delete', (s, i, n) => { s = str(s); return s.slice(0, num(i) - 1) + s.slice(num(i) - 1 + num(n)); });
    def('string_insert', (sub, s, i) => { s = str(s); return s.slice(0, num(i) - 1) + str(sub) + s.slice(num(i) - 1); });
    def('string_replace', (s, from, to) => str(s).replace(str(from), str(to)));
    def('string_replace_all', (s, from, to) => str(s).split(str(from)).join(str(to)));
    def('string_upper', s => str(s).toUpperCase());
    def('string_lower', s => str(s).toLowerCase());
    def('string_repeat', (s, n) => str(s).repeat(Math.max(0, num(n))));
    def('string_digits', s => str(s).replace(/[^0-9]/g, ''));
    def('string_letters', s => str(s).replace(/[^a-zA-Z]/g, ''));
    def('chr', n => String.fromCharCode(num(n)));
    def('ord', s => str(s).charCodeAt(0) || 0);
    // Real text metrics. Deltarune SIZES layout from these — the dating
    // minigame sets each choice box's scale to `50 / string_width(text)` and
    // clamps it — so a length*8 guess mis-scales every line of dialogue.
    // Measured against the same font the text natives draw with.
    def('string_width', s => {
      const t = str(s).split('#').join('\n').split('\n');
      const ctx = global.$gmlActiveCtx;
      if (!ctx) return Math.max(...t.map(l => l.length)) * 8;
      ctx.save();
      ctx.font = global.$gmlFont || '16px monospace';
      let w = 0;
      for (const line of t) w = Math.max(w, ctx.measureText(line).width);
      ctx.restore();
      return w;
    });
    def('string_height', s => {
      const lines = str(s).split('#').join('\n').split('\n').length;
      return lines * 16;
    });

    def('array_create', (n, v) => new Array(Math.max(0, Math.floor(num(n)))).fill(v === undefined ? 0 : v));
    def('array_push', function (a) { if (Array.isArray(a)) for (let i = 1; i < arguments.length; i++) a.push(arguments[i]); });
    def('array_pop', a => (Array.isArray(a) ? a.pop() : undefined));
    def('array_insert', (a, i, v) => { if (Array.isArray(a)) a.splice(num(i), 0, v); });
    def('array_delete', (a, i, n) => { if (Array.isArray(a)) a.splice(num(i), num(n)); });
    def('array_resize', (a, n) => { if (Array.isArray(a)) { while (a.length < num(n)) a.push(0); a.length = num(n); } });
    def('array_copy', (dst, di, src, si, n) => {
      if (!Array.isArray(dst) || !Array.isArray(src)) return;
      for (let k = 0; k < num(n); k++) dst[num(di) + k] = src[num(si) + k];
    });
    def('ds_list_create', () => []);
    def('ds_list_destroy', () => {});
    def('ds_list_add', function (l) { if (Array.isArray(l)) for (let i = 1; i < arguments.length; i++) l.push(arguments[i]); });
    def('ds_list_size', l => (l && l.length) || 0);
    def('ds_list_delete', (l, i) => { if (Array.isArray(l)) l.splice(num(i), 1); });
    def('ds_list_find_index', (l, v) => (Array.isArray(l) ? l.indexOf(v) : -1));
    def('ds_list_replace', (l, i, v) => { if (Array.isArray(l)) l[num(i)] = v; });
    def('ds_map_create', () => new Map());
    def('ds_map_destroy', () => {});
    def('ds_map_add', (m, k, v) => { if (m instanceof Map) m.set(k, v); });
    def('ds_map_find_value', (m, k) => (m instanceof Map ? m.get(k) : undefined));
    def('ds_map_exists', (m, k) => (m instanceof Map ? m.has(k) : false));
    def('ds_map_delete', (m, k) => { if (m instanceof Map) m.delete(k); });
    def('ds_map_size', m => (m instanceof Map ? m.size : 0));
    // ds_map_set is the accessor form of ds_map_add and OVERWRITES; it is what
    // the `map[? key] = value` syntax compiles to, so it is used far more than
    // ds_map_add.
    def('ds_map_set', (m, k, v) => { if (m instanceof Map) m.set(k, v); });
    def('ds_map_clear', m => { if (m instanceof Map) m.clear(); });
    def('ds_map_empty', m => (m instanceof Map ? m.size === 0 : true));
    def('ds_map_keys_to_array', m => (m instanceof Map ? [...m.keys()] : []));
    def('ds_map_values_to_array', m => (m instanceof Map ? [...m.values()] : []));
    def('ds_map_find_first', m => (m instanceof Map ? [...m.keys()][0] : undefined));
    def('ds_map_find_last', m => (m instanceof Map ? [...m.keys()].pop() : undefined));
    def('ds_map_replace', (m, k, v) => { if (m instanceof Map) m.set(k, v); });

    // ── .ini files ───────────────────────────────────────────────────────
    // Deltarune keeps settings and save metadata in ini files. There is no disk
    // here, so back them with an in-memory store that persists for the session:
    // the point is that a write followed by a read returns what was written,
    // which is what the config and language scripts actually depend on.
    const INI_STORE = new Map();
    let iniOpen = null;
    global.ini_open = name => {
      const key = String(name);
      if (!INI_STORE.has(key)) INI_STORE.set(key, new Map());
      iniOpen = INI_STORE.get(key);
      return true;
    };
    global.ini_close = () => { iniOpen = null; return ''; };
    global.ini_open_from_string = str => { iniOpen = new Map(); return str; };
    const iniKey = (sec, k) => String(sec) + ' ' + String(k);
    global.ini_write_real = (sec, k, v) => { if (iniOpen) iniOpen.set(iniKey(sec, k), num(v)); };
    global.ini_write_string = (sec, k, v) => { if (iniOpen) iniOpen.set(iniKey(sec, k), String(v)); };
    global.ini_read_real = (sec, k, def_) => {
      if (!iniOpen || !iniOpen.has(iniKey(sec, k))) return num(def_);
      return num(iniOpen.get(iniKey(sec, k)));
    };
    global.ini_read_string = (sec, k, def_) => {
      if (!iniOpen || !iniOpen.has(iniKey(sec, k))) return def_ === undefined ? '' : String(def_);
      return String(iniOpen.get(iniKey(sec, k)));
    };
    global.ini_key_exists = (sec, k) => !!(iniOpen && iniOpen.has(iniKey(sec, k)));
    global.ini_section_exists = sec => {
      if (!iniOpen) return false;
      const p = String(sec) + ' ';
      for (const key of iniOpen.keys()) if (key.startsWith(p)) return true;
      return false;
    };
    // ── Text files ───────────────────────────────────────────────────────
    // Same contract as the ini store: no disk, but a file written then read
    // back must give the same bytes, because the save/load scripts round-trip
    // through these and several battle scripts call into save code.
    const TEXTFILES = new Map();
    const FHANDLES = new Map();
    let nextFh = 1;
    global.file_text_open_write = name => {
      const h = nextFh++;
      TEXTFILES.set(String(name), []);
      FHANDLES.set(h, { name: String(name), line: 0, mode: 'w' });
      return h;
    };
    global.file_text_open_append = name => {
      const h = nextFh++;
      if (!TEXTFILES.has(String(name))) TEXTFILES.set(String(name), []);
      FHANDLES.set(h, { name: String(name), line: TEXTFILES.get(String(name)).length, mode: 'a' });
      return h;
    };
    global.file_text_open_read = name => {
      if (!TEXTFILES.has(String(name))) return -1;
      const h = nextFh++;
      FHANDLES.set(h, { name: String(name), line: 0, mode: 'r' });
      return h;
    };
    const fhLines = h => { const f = FHANDLES.get(num(h)); return f ? TEXTFILES.get(f.name) : null; };
    global.file_text_close = h => { FHANDLES.delete(num(h)); };
    global.file_text_write_string = (h, s) => {
      const L = fhLines(h); const f = FHANDLES.get(num(h));
      if (!L || !f) return;
      L[f.line] = (L[f.line] === undefined ? '' : L[f.line]) + String(s);
    };
    global.file_text_write_real = (h, v) => global.file_text_write_string(h, String(num(v)));
    global.file_text_writeln = h => { const f = FHANDLES.get(num(h)); const L = fhLines(h); if (f && L) { if (L[f.line] === undefined) L[f.line] = ''; f.line++; } };
    global.file_text_readln = h => {
      const f = FHANDLES.get(num(h)); const L = fhLines(h);
      if (!f || !L) return '';
      const v = L[f.line] === undefined ? '' : String(L[f.line]);
      f.line++;
      return v;
    };
    global.file_text_read_string = h => {
      const f = FHANDLES.get(num(h)); const L = fhLines(h);
      if (!f || !L) return '';
      return L[f.line] === undefined ? '' : String(L[f.line]);
    };
    global.file_text_read_real = h => num(global.file_text_read_string(h));
    global.file_text_eof = h => {
      const f = FHANDLES.get(num(h)); const L = fhLines(h);
      return !f || !L || f.line >= L.length;
    };
    global.file_exists = name => TEXTFILES.has(String(name));
    global.file_delete = name => { TEXTFILES.delete(String(name)); return true; };

    // ── Input devices / navigation the studio does not host ──────────────
    // Honest zeroes, not missing names: a gamepad that is not connected reports
    // exactly this, and the studio deliberately does not change rooms.
    for (const fn of ['gamepad_button_check_pressed', 'gamepad_button_check', 'gamepad_button_check_released',
      'gamepad_is_connected', 'gamepad_button_value']) global[fn] = () => false;
    global.gamepad_axis_value = () => 0;
    global.gamepad_get_device_count = () => 0;
    global.get_string = (prompt, def_) => (def_ === undefined ? '' : String(def_));
    global.get_integer = (prompt, def_) => num(def_);
    for (const fn of ['room_goto', 'room_goto_next', 'room_goto_previous', 'game_change',
      'game_restart', 'game_end']) global[fn] = () => {};
    global.room_exists = () => true;
    // Dynamic sprites really are deletable — free the canvas and its cached mask
    // so a rebuilt custom box does not keep answering with stale pixels.
    global.sprite_delete = spr => {
      const name = typeof spr === 'string' ? spr : String(spr);
      if (global.GML_SPRITE_MANIFEST) delete global.GML_SPRITE_MANIFEST[name];
      if (global.GML_SPRITE_FRAMES) delete global.GML_SPRITE_FRAMES[name];
      if (typeof global.GML_FORGET_SPRITE === 'function') global.GML_FORGET_SPRITE(name);
      return true;
    };

    global.ini_key_delete = (sec, k) => { if (iniOpen) iniOpen.delete(iniKey(sec, k)); };
    global.ini_section_delete = sec => {
      if (!iniOpen) return;
      const p = String(sec) + ' ';
      for (const key of [...iniOpen.keys()]) if (key.startsWith(p)) iniOpen.delete(key);
    };
    // ds_exists(ind, type): 1=list, 2=map, 3=grid in GameMaker's numbering.
    // Our lists/grids are plain arrays and maps are Maps.
    global.ds_exists = (v, type) => {
      const t = num(type);
      if (t === 2) return v instanceof Map;
      if (t === 1 || t === 3) return Array.isArray(v);
      return Array.isArray(v) || v instanceof Map;
    };
    global.ds_type_list = 1; global.ds_type_map = 2; global.ds_type_grid = 3;

    def('sprite_get_number', spr => {
      return (global.GML_SPRITE_FRAMES && global.GML_SPRITE_FRAMES[spr]) || 1;
    });
    def('sprite_get_xoffset', spr => {
      const o = global.GML_SPRITE_ORIGINS && global.GML_SPRITE_ORIGINS[spr];
      return o ? o[0] : 0;
    });
    def('sprite_get_yoffset', spr => {
      const o = global.GML_SPRITE_ORIGINS && global.GML_SPRITE_ORIGINS[spr];
      return o ? o[1] : 0;
    });
    def('sprite_exists', spr => !!(global.GML_SPRITE_MANIFEST && global.GML_SPRITE_MANIFEST[spr]));

    // Text drawing was entirely absent; several attacks draw counters and labels.
    def('draw_set_halign', function (a) { global.$gmlHalign = a; });
    def('draw_set_valign', function (a) { global.$gmlValign = a; });
    def('draw_text', function (x, y, s) {
      const ctx = global.$gmlActiveCtx;
      if (!ctx) return;
      ctx.save();
      ctx.font = '16px monospace';
      ctx.fillStyle = global.toCSSColor(global.$gmlDrawColor || '#ffffff');
      ctx.textAlign = alignName(global.$gmlHalign);
      ctx.textBaseline = baselineName(global.$gmlValign);
      ctx.fillText(str(s), num(x), num(y));
      ctx.restore();
    });
    /**
     * The draw_text_ext* family: line breaks and word WRAPPING.
     *
     * `sep` is the line height (-1 = default) and `w` the wrap width in pixels
     * (-1 = no wrap). Treating these as plain draw_text collapsed every wrapped
     * block onto one line; the transformed variants were missing entirely, which
     * is what the dating minigame writes all of its dialogue with — hence no
     * visible text at all.
     */
    function wrapLines(s, width) {
      const raw = str(s).split('#').join('\n').split('\n');
      const w = num(width);
      if (!(w > 0)) return raw;
      const ctx = global.$gmlActiveCtx;
      const out = [];
      for (const line of raw) {
        if (!ctx) { out.push(line); continue; }
        const words = line.split(' ');
        let cur = '';
        for (const word of words) {
          const test = cur ? cur + ' ' + word : word;
          if (ctx.measureText(test).width > w && cur) { out.push(cur); cur = word; }
          else cur = test;
        }
        out.push(cur);
      }
      return out;
    }
    function textBlock(x, y, s, sep, width, xs, ys, ang, alpha) {
      const ctx = global.$gmlActiveCtx;
      if (!ctx) return;
      ctx.save();
      ctx.translate(num(x), num(y));
      if (num(ang)) ctx.rotate(-num(ang) * Math.PI / 180);
      const sx = xs === undefined ? 1 : (num(xs) || 1);
      const sy = ys === undefined ? 1 : (num(ys) || 1);
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
      ctx.font = global.$gmlFont || '16px monospace';
      ctx.fillStyle = global.toCSSColor(global.$gmlDrawColor || '#ffffff');
      ctx.textAlign = alignName(global.$gmlHalign);
      ctx.textBaseline = baselineName(global.$gmlValign);
      if (alpha !== undefined) ctx.globalAlpha = Math.max(0, Math.min(1, num(alpha)));
      const lh = num(sep) > 0 ? num(sep) : 16;
      const lines = wrapLines(s, width);
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 0, i * lh);
      ctx.restore();
    }
    def('draw_text_ext', function (x, y, s, sep, w) { textBlock(x, y, s, sep, w, 1, 1, 0); });
    def('draw_text_ext_transformed', function (x, y, s, sep, w, xs, ys, ang) {
      textBlock(x, y, s, sep, w, xs, ys, ang);
    });
    def('draw_text_ext_transformed_color', function (x, y, s, sep, w, xs, ys, ang, c1, c2, c3, c4, alpha) {
      const saved = global.$gmlDrawColor;
      if (c1 !== undefined) global.$gmlDrawColor = global.toCSSColor(c1);
      textBlock(x, y, s, sep, w, xs, ys, ang, alpha);
      global.$gmlDrawColor = saved;
    });
    def('draw_text_ext_color', function (x, y, s, sep, w, c1, c2, c3, c4, alpha) {
      const saved = global.$gmlDrawColor;
      if (c1 !== undefined) global.$gmlDrawColor = global.toCSSColor(c1);
      textBlock(x, y, s, sep, w, 1, 1, 0, alpha);
      global.$gmlDrawColor = saved;
    });
    def('draw_text_transformed_color', function (x, y, s, xs, ys, ang, c1, c2, c3, c4, alpha) {
      const saved = global.$gmlDrawColor;
      if (c1 !== undefined) global.$gmlDrawColor = global.toCSSColor(c1);
      textBlock(x, y, s, -1, -1, xs, ys, ang, alpha);
      global.$gmlDrawColor = saved;
    });
    def('draw_text_transformed', function (x, y, s, xs, ys, ang) {
      const ctx = global.$gmlActiveCtx;
      if (!ctx) return;
      ctx.save();
      ctx.translate(num(x), num(y));
      if (num(ang)) ctx.rotate(-num(ang) * Math.PI / 180);
      ctx.scale(num(xs) || 1, num(ys) || 1);
      ctx.font = '16px monospace';
      ctx.fillStyle = global.toCSSColor(global.$gmlDrawColor || '#ffffff');
      ctx.textAlign = alignName(global.$gmlHalign);
      ctx.textBaseline = baselineName(global.$gmlValign);
      ctx.fillText(str(s), 0, 0);
      ctx.restore();
    });

    def('object_get_name', v => (typeof v === 'string' ? v : (v && v.object_name) || ''));
    def('object_get_parent', name => {
      const oi = global.GML_OBJECT_INDEX;
      const chain = oi ? oi.parentChain(typeof name === 'string' ? name : (name && name.object_name)) : [];
      return chain.length ? chain[0] : -1;
    });
    def('object_is_ancestor', (child, parent) => {
      const oi = global.GML_OBJECT_INDEX;
      return oi ? oi.isDescendantOf(child, parent) : false;
    });
    def('object_exists', name => {
      const oi = global.GML_OBJECT_INDEX;
      return oi ? oi.isObject(name) : false;
    });

    // Keep the shim's own colour/alpha state in sync with the runtime's setters
    // so draw_text can read them.
    wrap('draw_set_color', c => { global.$gmlDrawColor = c; });
    wrap('draw_set_colour', c => { global.$gmlDrawColor = c; });

    // GameMaker quietly draws nothing for a negative radius; Canvas's arc()
    // throws, which killed the whole Draw event (obj_rouxls_power_up_orb shrinks
    // its radius past zero as it fades).
    guardRadius('draw_circle', 2);
    guardRadius('draw_circle_colour', 2);
    guardRadius('draw_circle_color', 2);

    // ── Sprite alias routing + dynamic sprites ──────────────────────────
    // All name-based lookups in the asset DB honour sprAlias, so a runtime
    // reassignment of an asset name (obj_growtangle's spr_custom_box) redirects
    // every draw, mask and size query.
    if (global.gmlAssets) {
      const A = global.gmlAssets;
      for (const m of ['getSprite', 'getImage', 'getSpriteInfo']) {
        const orig = A[m].bind(A);
        A[m] = function (name) {
          const args = Array.prototype.slice.call(arguments);
          args[0] = sprAlias(name);
          return orig.apply(null, args);
        };
      }
    }

    let dynSpriteN = 1;
    global.sprite_create_from_surface = function (surfId, x, y, w, h, removeback, smooth, xorig, yorig) {
      const src = SURFACES.get(num(surfId));
      w = Math.max(1, Math.floor(num(w))); h = Math.max(1, Math.floor(num(h)));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ccx = cv.getContext('2d');
      if (src) {
        try { ccx.drawImage(src, num(x), num(y), w, h, 0, 0, w, h); } catch (e) {}
      }
      // `removeback`: GameMaker makes the colour of the top-left pixel fully
      // transparent. The Knight's split box passes true.
      if (bool(removeback) && w > 0 && h > 0) {
        try {
          const img = ccx.getImageData(0, 0, w, h);
          const d = img.data;
          const kr = d[0], kg = d[1], kb = d[2];
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] === kr && d[i + 1] === kg && d[i + 2] === kb) d[i + 3] = 0;
          }
          ccx.putImageData(img, 0, 0);
        } catch (e) { /* tainted canvas */ }
      }
      // Quack like a loaded Image for every draw/mask path.
      cv.complete = true; cv.naturalWidth = w; cv.naturalHeight = h;
      const name = '__dynspr_' + dynSpriteN++;
      if (global.gmlAssets) global.gmlAssets.sprites[name] = { frames: [cv], frameCount: 1, loaded: true };
      if (global.GML_SPRITE_FRAMES) global.GML_SPRITE_FRAMES[name] = 1;
      if (global.GML_SPRITE_SIZES) global.GML_SPRITE_SIZES[name] = [w, h];
      // Origins here are legitimately FRACTIONAL (the box bakes at 18.5*maxxscale),
      // so keep the real number — `num(v) || 0` would also turn a true 0 into 0,
      // but more importantly must not be allowed to swallow non-integers.
      if (global.GML_SPRITE_ORIGINS) {
        const ox = num(xorig), oy = num(yorig);
        global.GML_SPRITE_ORIGINS[name] = [Number.isFinite(ox) ? ox : 0, Number.isFinite(oy) ? oy : 0];
      }
      if (global.GML_SPRITE_MANIFEST) global.GML_SPRITE_MANIFEST[name] = ['(dynamic)'];
      if (typeof global.GML_FORGET_SPRITE === 'function') global.GML_FORGET_SPRITE(name);
      return name;
    };

    // ── Paths ───────────────────────────────────────────────────────────
    // Full support for RUNTIME-BUILT paths (path_add / path_add_point /
    // path_start following in updateMovement). Asset paths are a resource type
    // absent from the export dumps, so a start on one warns once with its name.
    const PATHS = new Map();
    let nextPathId = 1;
    global.path_add = () => { const id = nextPathId++; PATHS.set(id, { points: [], closed: false }); return id; };
    global.path_add_point = (id, x, y, speed) => {
      const p = PATHS.get(num(id));
      if (p) p.points.push({ x: num(x), y: num(y), s: num(speed) || 100 });
    };
    global.path_set_closed = (id, closed) => { const p = PATHS.get(num(id)); if (p) p.closed = bool(closed); };
    global.path_delete = id => { PATHS.delete(num(id)); };
    global.path_exists = id => PATHS.has(num(id));
    global.path_action_stop = 0; global.path_action_restart = 1;
    global.path_action_continue = 2; global.path_action_reverse = 3;
    global.path_start = function (pathRef, speed, endaction, absolute) {
      const s = this && typeof this.object_name === 'string' ? this : undefined;
      if (!s) return;
      const p = PATHS.get(num(pathRef));
      if (!p || p.points.length < 2) {
        const key = 'path:' + String(pathRef);
        if (!MISSING_WARNED.has(key)) {
          MISSING_WARNED.add(key);
          console.warn(`[gml] path_start: no data for path ${String(pathRef)} — asset paths are not in the export dumps`);
        }
        return;
      }
      const pts = bool(absolute)
        ? p.points
        : p.points.map(pt => ({ x: pt.x - p.points[0].x + num(s.x), y: pt.y - p.points[0].y + num(s.y), s: pt.s }));
      s.$path = { pts, speed: num(speed), endaction: num(endaction), seg: 0, t: 0 };
    };
    global.path_end = function () {
      const s = this && typeof this.object_name === 'string' ? this : undefined;
      if (s) s.$path = undefined;
    };
    /** Advance an instance along its path by `speed` px this step. */
    global.GML_HELPERS.tickPath = function (inst) {
      const P = inst.$path;
      if (!P || typeof P !== 'object' || !P.pts) return false;
      let remaining = Math.abs(P.speed);
      const dirSign = P.speed < 0 ? -1 : 1;
      while (remaining > 0) {
        const i = P.seg, pts = P.pts;
        const a = pts[i], b = pts[i + 1];
        if (!b) {
          if (P.endaction === 1) { P.seg = 0; P.t = 0; inst.x = pts[0].x; inst.y = pts[0].y; continue; }
          if (P.endaction === 3) { P.pts = pts.slice().reverse(); P.seg = 0; P.t = 0; continue; }
          inst.$path = undefined;   // stop / continue
          return true;
        }
        const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
        const left = (1 - P.t) * segLen;
        if (remaining < left) {
          P.t += (remaining / segLen) * dirSign;
          remaining = 0;
        } else {
          remaining -= left;
          P.seg++; P.t = 0;
        }
        const cur = P.pts[P.seg], nxt = P.pts[P.seg + 1] || cur;
        inst.x = cur.x + (nxt.x - cur.x) * P.t;
        inst.y = cur.y + (nxt.y - cur.y) * P.t;
      }
      return true;
    };

    // ── Surface builtins (real render targets — see SURFACES above) ─────
    global.surface_create = (w, h) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(num(w)));
      c.height = Math.max(1, Math.ceil(num(h)));
      const id = nextSurfaceId++;
      SURFACES.set(id, c);
      return id;
    };
    global.surface_exists = id => SURFACES.has(num(id));
    global.surface_free = id => { SURFACES.delete(num(id)); };
    global.surface_get_width = id => { const c = SURFACES.get(num(id)); return c ? c.width : 0; };
    global.surface_get_height = id => { const c = SURFACES.get(num(id)); return c ? c.height : 0; };
    global.surface_resize = (id, w, h) => {
      const c = SURFACES.get(num(id));
      if (c) { c.width = Math.max(1, Math.ceil(num(w))); c.height = Math.max(1, Math.ceil(num(h))); }
    };
    // surface_copy(dest, x, y, source) — blit one surface onto another, and
    // surface_copy_part(dest, x, y, source, xs, ys, w, h) for a sub-rect.
    // These REPLACE the destination pixels rather than compositing over them
    // ('copy'), which is what GameMaker does and is the whole reason the call
    // is used: a copy is how the game snapshots a surface before mutating it.
    // Unimplemented it returned 0, so every such snapshot was silently empty.
    const surfBlit = (dest, x, y, src, sx, sy, sw, sh) => {
      const d = SURFACES.get(num(dest));
      const s = SURFACES.get(num(src));
      if (!d || !s) return 0;
      // A zero-sized source rect makes drawImage throw; GameMaker draws nothing.
      const w = sw === undefined ? s.width : Math.min(num(sw), s.width - num(sx || 0));
      const h = sh === undefined ? s.height : Math.min(num(sh), s.height - num(sy || 0));
      if (!(w > 0) || !(h > 0)) return 0;
      const ctx = d.getContext('2d');
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'copy';
      try {
        ctx.drawImage(s, num(sx || 0), num(sy || 0), w, h, num(x), num(y), w, h);
      } catch (e) { /* out-of-bounds rect: GameMaker draws nothing */ }
      ctx.restore();
      return 0;
    };
    global.surface_copy = (dest, x, y, src) => surfBlit(dest, x, y, src);
    global.surface_copy_part = (dest, x, y, src, sx, sy, sw, sh) =>
      surfBlit(dest, x, y, src, sx, sy, sw, sh);

    global.surface_set_target = id => {
      const c = SURFACES.get(num(id));
      if (!c) return false;
      surfaceStack.push(global.$gmlActiveCtx || null);
      global.setActiveCtx(c.getContext('2d'));
      return true;
    };
    global.surface_reset_target = () => {
      const prev = surfaceStack.pop();
      if (prev) global.setActiveCtx(prev);
      return true;
    };
    global.draw_surface = (id, x, y) => {
      const ctx = global.$gmlActiveCtx, c = SURFACES.get(num(id));
      if (ctx && c) ctx.drawImage(c, num(x), num(y));
    };
    global.draw_surface_ext = (id, x, y, xs, ys, rot, col, alpha) => {
      const c = SURFACES.get(num(id));
      if (c) surfacePart(id, 0, 0, c.width, c.height, x, y, xs, ys, rot, alpha, col);
    };
    /**
     * The whole draw_surface_part* family through one implementation.
     *
     * GameMaker CLAMPS the source rectangle to the surface rather than failing,
     * and clamping has to move the DESTINATION too — if `left` is negative the
     * visible part starts further right, so drawing the clamped region at the
     * original x would shift the image. Canvas throws (or silently drops the
     * call) on an out-of-bounds source rect, which is how a single offscreen
     * pixel could make a whole panel vanish.
     */
    /**
     * A surface tinted by `blend`, cached per (surface, colour, frame). Surfaces
     * are redrawn every frame, so the cache is stamped with the frame counter
     * rather than kept indefinitely.
     */
    const surfTintCache = new Map();
    function tintedSurface(id, srcCanvas, blend) {
      const frame = num(global.$gmlFrame);
      const key = id + '|' + String(blend);
      const hit = surfTintCache.get(key);
      if (hit && hit.frame === frame && hit.buf.width === srcCanvas.width
          && hit.buf.height === srcCanvas.height) return hit.buf;
      const buf = (hit && hit.buf) || document.createElement('canvas');
      if (buf.width !== srcCanvas.width) buf.width = srcCanvas.width;
      if (buf.height !== srcCanvas.height) buf.height = srcCanvas.height;
      const bctx = buf.getContext('2d');
      bctx.clearRect(0, 0, buf.width, buf.height);
      bctx.globalAlpha = 1;
      bctx.globalCompositeOperation = 'source-over';
      drawTinted(bctx, srcCanvas, 0, 0, blend);
      surfTintCache.set(key, { frame, buf });
      return buf;
    }

    function surfacePart(id, l, t, w, h, x, y, xs, ys, rot, alpha, blend) {
      const ctx = global.$gmlActiveCtx, c = SURFACES.get(num(id));
      if (!ctx || !c) return;
      // Surface blits participate in the alpha-mask idiom too
      // (scr_draw_in_box_* draws whole surfaces through dest-alpha masks).
      if (AMASK.tracked && (ctx.globalCompositeOperation === 'source-atop'
          || ctx.globalCompositeOperation === 'destination-in')) {
        return withAlphaMask(ctx, () => surfacePart(id, l, t, w, h, x, y, xs, ys, rot, alpha, blend));
      }
      let sl = num(l), st = num(t), sw = num(w), sh = num(h);
      if (!(sw > 0) || !(sh > 0)) return;
      // Clamp the source rect into the surface, carrying the offset to the dest.
      let dx = 0, dy = 0;
      if (sl < 0) { dx -= sl; sw += sl; sl = 0; }
      if (st < 0) { dy -= st; sh += st; st = 0; }
      sw = Math.min(sw, c.width - sl);
      sh = Math.min(sh, c.height - st);
      if (!(sw > 0) || !(sh > 0)) return;
      // A blend argument on a surface draw is a real tint — Deltarune's outline
      // idiom blits the same surface several times tinted black before the plain
      // pass. The tinted copy is built ONCE PER FRAME, not once per call: the
      // Knight's roar shears a full-screen surface one scanline at a time, 480
      // tinted calls a frame all using the same colour.
      let src = c;
      if (blend !== undefined && blend !== null) {
        const ch = channels(blend);
        if (!(ch[0] === 255 && ch[1] === 255 && ch[2] === 255)) src = tintedSurface(num(id), c, blend);
      }
      const a = (alpha === undefined ? 1 : Math.max(0, Math.min(1, num(alpha)))) * MASK_MUL;
      const rt = num(rot), sxv = num(xs) || 1, syv = num(ys) || 1;

      // FAST PATH: unrotated, unscaled. `save`/`restore` and the transform
      // updates are the two most expensive things on a 2D context, and this
      // function is called in tight per-scanline loops — obj_knight_roaring2's
      // Draw shears the ball surface across 480 rows AND the knight sprite four
      // more times, well over a thousand calls a frame, every one of them
      // unrotated at scale 1. Folding the translate into drawImage's
      // destination is mathematically identical and skips all of it. Measured:
      // that object's draw was 34ms/frame on its own, the single biggest cost
      // in the roar's finale.
      if (!rt && sxv === 1 && syv === 1) {
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = a;
        try { ctx.drawImage(src, sl, st, sw, sh, num(x) + dx, num(y) + dy, sw, sh); } catch (e) {}
        ctx.globalAlpha = prevAlpha;
        return;
      }

      ctx.save();
      ctx.translate(num(x), num(y));
      if (rt) ctx.rotate(-rt * Math.PI / 180);
      ctx.scale(sxv, syv);
      ctx.globalAlpha = a;
      try { ctx.drawImage(src, sl, st, sw, sh, dx, dy, sw, sh); } catch (e) {}
      ctx.restore();
    }
    global.draw_surface_part = (id, l, t, w, h, x, y) =>
      surfacePart(id, l, t, w, h, x, y, 1, 1, 0, 1);
    global.draw_surface_part_ext = (id, l, t, w, h, x, y, xs, ys, col, alpha) =>
      surfacePart(id, l, t, w, h, x, y, xs, ys, 0, alpha, col);
    global.draw_surface = (id, x, y) => {
      const c = SURFACES.get(num(id));
      if (c) surfacePart(id, 0, 0, c.width, c.height, x, y, 1, 1, 0, 1);
    };
    global.draw_surface_stretched = (id, x, y, w, h) => {
      const ctx = global.$gmlActiveCtx, c = SURFACES.get(num(id));
      if (ctx && c && num(w) > 0 && num(h) > 0) ctx.drawImage(c, num(x), num(y), num(w), num(h));
    };
    global.draw_surface_stretched_ext = (id, x, y, w, h, col, alpha) => {
      const ctx = global.$gmlActiveCtx, c = SURFACES.get(num(id));
      if (!ctx || !c || !(num(w) > 0) || !(num(h) > 0)) return;
      ctx.save();
      ctx.globalAlpha = alpha === undefined ? 1 : Math.max(0, Math.min(1, num(alpha)));
      ctx.drawImage(c, num(x), num(y), num(w), num(h));
      ctx.restore();
    };
    global.draw_surface_tiled = (id, x, y) => {
      const ctx = global.$gmlActiveCtx, c = SURFACES.get(num(id));
      if (!ctx || !c || !c.width || !c.height) return;
      const vw = (ctx.canvas && ctx.canvas.width) || 640;
      const vh = (ctx.canvas && ctx.canvas.height) || 480;
      const ox = ((num(x) % c.width) + c.width) % c.width - c.width;
      const oy = ((num(y) % c.height) + c.height) % c.height - c.height;
      for (let py = oy; py < vh; py += c.height) {
        for (let px = ox; px < vw; px += c.width) ctx.drawImage(c, px, py);
      }
    };
    global.draw_surface_general = (id, l, t, w, h, x, y, xs, ys, rot, c1, c2, c3, c4, alpha) =>
      surfacePart(id, l, t, w, h, x, y, xs, ys, rot, alpha);

    // ── Draw colour/alpha state, and the shape primitives ────────────────
    // `draw_set_color` only ever assigned fillStyle, so every OUTLINE stroked
    // with the canvas default (opaque black): Pink's tunnel rings, the maze's
    // connection lines and the purple lane grid are all outline draws, so they
    // came out black-on-black. GameMaker keeps one colour and one alpha that
    // apply to both fill and stroke, so model that.
    const DRAWSTATE = { color: '#ffffff', alpha: 1 };
    const css = c => (typeof global.toCSSColor === 'function' ? global.toCSSColor(c) : c);
    function applyDrawState(ctx) {
      ctx.fillStyle = DRAWSTATE.color;
      ctx.strokeStyle = DRAWSTATE.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, num(DRAWSTATE.alpha)));
    }
    // ── Alpha-channel mask emulation (gpu_set_colorwriteenable) ──────────
    // Deltarune's clip-to-the-box idiom paints the screen's ALPHA CHANNEL and
    // then draws through (bm_dest_alpha, bm_inv_dest_alpha):
    //   gpu_set_colorwriteenable(false, false, false, true);  // alpha only
    //   draw_set_alpha(0); fill(whole screen);                // clear mask
    //   draw_set_alpha(a); fill(box interior);                // mask = box
    //   gpu_set_colorwriteenable(true, true, true, true);
    //   gpu_set_blendmode_ext(bm_dest_alpha, bm_inv_dest_alpha);
    //   <sprite/surface draws>                                // clipped
    // Canvas has no alpha-only writes, so the idiom is modelled directly:
    // rect fills with RGB writes off become a tracked CLIP REGION, and
    // dest-alpha composites clip to it. Measured case:
    // obj_gerson_growtangle_telegraph_new — without this its telegraph column
    // drew unclipped and IMMORTAL (a floating white rectangle above the box,
    // still there at image_alpha -2.2, which in-game means an empty mask).
    const CW = { rgb: true, alpha: true };
    const AMASK = { tracked: false, alpha: 1, rects: [] };
    let MASK_MUL = 1;
    global.gpu_set_colorwriteenable = (r, g, b, a) => {
      CW.rgb = bool(r) || bool(g) || bool(b);
      CW.alpha = a === undefined ? true : bool(a);
    };
    global.gpu_set_colourwriteenable = global.gpu_set_colorwriteenable;
    function maskRect(x1, y1, x2, y2) {
      AMASK.tracked = true;
      const a = num(DRAWSTATE.alpha);
      const w = Math.abs(num(x2) - num(x1)), h = Math.abs(num(y2) - num(y1));
      if (a <= 0) {
        // The idiom's zero-alpha fill covers the whole view to blank the mask.
        if (w >= 600 && h >= 400) AMASK.rects = [];
        return;
      }
      AMASK.alpha = Math.min(1, a);
      AMASK.rects.push([Math.min(num(x1), num(x2)), Math.min(num(y1), num(y2)), w, h]);
    }
    /** Wrap a draw so dest-alpha composites honour the tracked mask. */
    function withAlphaMask(ctx, fn) {
      const op = ctx.globalCompositeOperation;
      if (!AMASK.tracked || (op !== 'source-atop' && op !== 'destination-in')) { fn(); return; }
      if (!AMASK.rects.length) return;          // empty mask: nothing shows
      ctx.save();
      ctx.beginPath();
      for (const r of AMASK.rects) ctx.rect(r[0], r[1], r[2], r[3]);
      ctx.clip();
      ctx.globalCompositeOperation = 'source-over';
      MASK_MUL = AMASK.alpha;
      try { fn(); } finally { MASK_MUL = 1; ctx.restore(); }
    }

    /** Run `fn` with the current GML draw state applied, then restore. */
    function shape(fn) {
      const ctx = global.$gmlActiveCtx;
      if (!ctx) return;
      // Colour writes disabled: geometry only feeds the alpha mask (rects are
      // recorded by draw_rectangle itself); nothing may touch the pixels.
      if (!CW.rgb) return;
      ctx.save();
      applyDrawState(ctx);
      try { fn(ctx); } finally { ctx.restore(); }
    }
    /**
     * Push the GML draw state onto a context.
     *
     * This MUST happen eagerly, not only inside our own shape wrappers: plenty
     * of draw functions (draw_text above all) are the runtime's and read
     * ctx.fillStyle directly. A draw_set_color that merely recorded state left
     * every one of them painting with whatever colour happened to be current —
     * which is how text and UI across the dating minigame and Gerson's fight
     * lost their colour after the state layer landed.
     *
     * It also has to be re-pushed when the render TARGET changes, because GML
     * keeps one draw state across surfaces while each canvas has its own.
     */
    function pushDrawState(ctx) {
      if (!ctx) return;
      ctx.fillStyle = DRAWSTATE.color;
      ctx.strokeStyle = DRAWSTATE.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, num(DRAWSTATE.alpha)));
    }
    global.GML_PUSH_DRAW_STATE = pushDrawState;
    /**
     * sprite_set_offset — move a sprite's ORIGIN at runtime.
     *
     * The most-needed missing native in the whole corpus: 69 attacks call it.
     * Every draw and every collision mask is positioned relative to the origin,
     * so with this absent the affected sprites render and collide at an offset —
     * which is exactly the "positionally off" shape of Gerson's green attacks.
     * It mutates GLOBAL sprite state (not per-instance), so cached masks built
     * from the old origin have to be dropped.
     */
    global.sprite_set_offset = function (spr, xo, yo) {
      const s = sprAlias(spr);
      if (!s || typeof s !== 'string') return;
      if (!global.GML_SPRITE_ORIGINS) global.GML_SPRITE_ORIGINS = {};
      global.GML_SPRITE_ORIGINS[s] = [num(xo), num(yo)];
      if (global.gmlAssets && global.gmlAssets.sprites && global.gmlAssets.sprites[s]) {
        const rec = global.gmlAssets.sprites[s];
        rec.originX = num(xo);
        rec.originY = num(yo);
      }
      if (typeof global.GML_FORGET_SPRITE === 'function') global.GML_FORGET_SPRITE(s);
    };
    global.sprite_get_xoffset = spr => {
      const o = global.GML_SPRITE_ORIGINS && global.GML_SPRITE_ORIGINS[sprAlias(spr)];
      return o ? num(o[0]) : 0;
    };
    global.sprite_get_yoffset = spr => {
      const o = global.GML_SPRITE_ORIGINS && global.GML_SPRITE_ORIGINS[sprAlias(spr)];
      return o ? num(o[1]) : 0;
    };

    /**
     * string_format(val, total, dec) — GameMaker's fixed-width number format.
     * Pads the integer part to `total` characters with SPACES (not zeroes) and
     * shows exactly `dec` decimals. Used by every score/timer/percentage
     * readout, including the dating minigame's.
     */
    global.string_format = function (val, total, dec) {
      const v = num(val), t = Math.max(0, Math.floor(num(total))), d = Math.max(0, Math.floor(num(dec)));
      let s = v.toFixed(d);
      const intLen = s.split('.')[0].replace('-', '').length;
      const pad = t - intLen;
      return pad > 0 ? ' '.repeat(pad) + s : s;
    };

    global.keyboard_check_released = function (key) {
      const gi = global.$gmlInput || {};
      const rel = gi.released || {};
      return !!rel[num(key)];
    };
    if (typeof global.keyboard_check_pressed !== 'function') {
      global.keyboard_check_pressed = function (key) {
        const gi = global.$gmlInput || {};
        return !!(gi.pressed || {})[num(key)];
      };
    }

    global.variable_struct_set = (st, name, val) => { if (st && typeof st === 'object') st[String(name)] = val; };
    global.variable_struct_get = (st, name) => (st && typeof st === 'object' ? st[String(name)] : undefined);
    global.variable_struct_exists = (st, name) => !!(st && typeof st === 'object' && String(name) in st);
    global.variable_struct_names_count = st => (st && typeof st === 'object' ? Object.keys(st).length : 0);
    global.variable_struct_get_names = st => (st && typeof st === 'object' ? Object.keys(st) : []);

    global.ds_list_sort = (l, asc) => {
      if (!Array.isArray(l)) return;
      const up = asc === undefined ? true : bool(asc);
      l.sort((a, b) => {
        const na = num(a), nb = num(b);
        const cmp = (isFinite(na) && isFinite(nb)) ? na - nb : String(a).localeCompare(String(b));
        return up ? cmp : -cmp;
      });
    };
    global.ds_list_insert = (l, pos, v) => { if (Array.isArray(l)) l.splice(Math.max(0, num(pos)), 0, v); };
    global.ds_list_shuffle = l => {
      if (!Array.isArray(l)) return;
      for (let i = l.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [l[i], l[j]] = [l[j], l[i]];
      }
    };

    global.draw_set_color = global.draw_set_colour = c => {
      DRAWSTATE.color = css(c);
      // The text natives read $gmlDrawColor directly; keep it in step or every
      // draw_text paints in a stale colour.
      global.$gmlDrawColor = DRAWSTATE.color;
      pushDrawState(global.$gmlActiveCtx);
    };
    global.draw_get_color = global.draw_get_colour = () => DRAWSTATE.color;
    global.draw_set_alpha = a => {
      DRAWSTATE.alpha = num(a);
      pushDrawState(global.$gmlActiveCtx);
    };
    global.draw_get_alpha = () => DRAWSTATE.alpha;

    const strokeOrFill = (ctx, outline) => { if (bool(outline)) ctx.stroke(); else ctx.fill(); };
    global.draw_line = (x1, y1, x2, y2) => shape(ctx => {
      ctx.beginPath(); ctx.moveTo(num(x1), num(y1)); ctx.lineTo(num(x2), num(y2)); ctx.stroke();
    });
    global.draw_line_width = (x1, y1, x2, y2, w) => shape(ctx => {
      ctx.lineWidth = Math.max(1, num(w));
      ctx.beginPath(); ctx.moveTo(num(x1), num(y1)); ctx.lineTo(num(x2), num(y2)); ctx.stroke();
    });
    global.draw_rectangle = (x1, y1, x2, y2, outline) => {
      // RGB writes off + alpha on = this fill defines the alpha MASK, not
      // pixels (see the colorwriteenable block above).
      if (!CW.rgb) { if (CW.alpha && !bool(outline)) maskRect(x1, y1, x2, y2); return; }
      return shape(ctx => {
        const x = Math.min(num(x1), num(x2)), y = Math.min(num(y1), num(y2));
        const w = Math.abs(num(x2) - num(x1)), h = Math.abs(num(y2) - num(y1));
        if (bool(outline)) ctx.strokeRect(x, y, w, h); else ctx.fillRect(x, y, w, h);
      });
    };
    global.draw_circle = (x, y, r, outline) => shape(ctx => {
      ctx.beginPath(); ctx.arc(num(x), num(y), Math.abs(num(r)), 0, Math.PI * 2);
      strokeOrFill(ctx, outline);
    });
    global.draw_ellipse = (x1, y1, x2, y2, outline) => shape(ctx => {
      const cx = (num(x1) + num(x2)) / 2, cy = (num(y1) + num(y2)) / 2;
      const rx = Math.abs(num(x2) - num(x1)) / 2, ry = Math.abs(num(y2) - num(y1)) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      strokeOrFill(ctx, outline);
    });
    global.draw_triangle = (x1, y1, x2, y2, x3, y3, outline) => shape(ctx => {
      ctx.beginPath();
      ctx.moveTo(num(x1), num(y1)); ctx.lineTo(num(x2), num(y2)); ctx.lineTo(num(x3), num(y3));
      ctx.closePath();
      strokeOrFill(ctx, outline);
    });
    global.draw_point = (x, y) => shape(ctx => { ctx.fillRect(num(x), num(y), 1, 1); });
    global.draw_roundrect = (x1, y1, x2, y2, outline) =>
      global.draw_roundrect_ext(x1, y1, x2, y2, 8, 8, outline);
    global.draw_roundrect_ext = (x1, y1, x2, y2, rx, ry, outline) => shape(ctx => {
      const x = Math.min(num(x1), num(x2)), y = Math.min(num(y1), num(y2));
      const w = Math.abs(num(x2) - num(x1)), h = Math.abs(num(y2) - num(y1));
      const r = Math.max(0, Math.min(Math.abs(num(rx)), w / 2, h / 2));
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
      strokeOrFill(ctx, outline);
    });
    global.draw_healthbar = (x1, y1, x2, y2, amount, back, min_, max_, dir, showback, showborder) => shape(ctx => {
      const x = Math.min(num(x1), num(x2)), y = Math.min(num(y1), num(y2));
      const w = Math.abs(num(x2) - num(x1)), h = Math.abs(num(y2) - num(y1));
      const f = Math.max(0, Math.min(1, num(amount) / 100));
      if (bool(showback)) { ctx.fillStyle = css(back); ctx.fillRect(x, y, w, h); }
      ctx.fillStyle = DRAWSTATE.color;
      const d = num(dir);
      if (d === 1) ctx.fillRect(x + w * (1 - f), y, w * f, h);
      else if (d === 2) ctx.fillRect(x, y, w, h * f);
      else if (d === 3) ctx.fillRect(x, y + h * (1 - f), w, h * f);
      else ctx.fillRect(x, y, w * f, h);
      if (bool(showborder)) ctx.strokeRect(x, y, w, h);
    });
    // The *_colour variants take their colour as an argument instead of from
    // the state; route them through the same core so there is one implementation.
    const withColor = (c, fn) => {
      const saved = DRAWSTATE.color;
      DRAWSTATE.color = css(c);
      try { fn(); } finally { DRAWSTATE.color = saved; }
    };
    global.draw_line_colour = global.draw_line_color = (x1, y1, x2, y2, c1) =>
      withColor(c1, () => global.draw_line(x1, y1, x2, y2));
    global.draw_line_width_colour = global.draw_line_width_color = (x1, y1, x2, y2, w, c1) =>
      withColor(c1, () => global.draw_line_width(x1, y1, x2, y2, w));
    global.draw_rectangle_colour = global.draw_rectangle_color = (x1, y1, x2, y2, c1, c2, c3, c4, outline) =>
      withColor(c1, () => global.draw_rectangle(x1, y1, x2, y2, outline));
    global.draw_circle_colour = global.draw_circle_color = (x, y, r, c1, c2, outline) =>
      withColor(c1, () => global.draw_circle(x, y, r, outline));
    global.draw_ellipse_colour = global.draw_ellipse_color = (x1, y1, x2, y2, c1, c2, outline) =>
      withColor(c1, () => global.draw_ellipse(x1, y1, x2, y2, outline));
    global.draw_triangle_colour = global.draw_triangle_color = (x1, y1, x2, y2, x3, y3, c1, c2, c3, outline) =>
      withColor(c1, () => global.draw_triangle(x1, y1, x2, y2, x3, y3, outline));

    // ── d_* device-pixel shape wrappers ──────────────────────────────────
    // Deltarune draws most of its UI through these rather than the raw shape
    // functions; they exist only to snap to device pixels, so at 1:1 they are a
    // straight alias. They resolved to NOTHING (neither global nor script), so
    // every one silently returned 0 — which is why the dating minigame's answer
    // boxes and the purple node graph never appeared, independently of any font
    // or surface work. `d_` prefixes appear across many attacks, not one.
    const D_ALIASES = {
      d_line: 'draw_line', d_line_width: 'draw_line_width',
      d_line_colour: 'draw_line_colour', d_line_color: 'draw_line_color',
      d_line_width_colour: 'draw_line_width_colour', d_line_width_color: 'draw_line_width_color',
      d_rectangle: 'draw_rectangle', d_rectangle_colour: 'draw_rectangle_colour',
      d_rectangle_color: 'draw_rectangle_color',
      d_circle: 'draw_circle', d_circle_colour: 'draw_circle_colour', d_circle_color: 'draw_circle_color',
      d_ellipse: 'draw_ellipse', d_ellipse_colour: 'draw_ellipse_colour', d_ellipse_color: 'draw_ellipse_color',
      d_triangle: 'draw_triangle', d_triangle_colour: 'draw_triangle_colour', d_triangle_color: 'draw_triangle_color',
      d_point: 'draw_point', d_roundrect: 'draw_roundrect', d_roundrect_ext: 'draw_roundrect_ext',
      d_healthbar: 'draw_healthbar',
    };
    for (const [dName, target] of Object.entries(D_ALIASES)) {
      // Late-bound: the target may be (re)defined after this loop runs.
      global[dName] = function (...args) {
        const fn = global[target];
        return typeof fn === 'function' ? fn.apply(this, args) : 0;
      };
    }

    // ── Primitives ───────────────────────────────────────────────────────
    // The old assembler ignored the primitive KIND and closed every vertex list
    // into one polygon filled with vertex 0's colour. A 4-vertex trianglestrip
    // whose vertices alternate across the ribbon axis then renders as a
    // self-intersecting bow-tie instead of a quad — which is exactly the shape
    // the node maze's travelling pulses use.
    let PRIM = null;
    global.draw_primitive_begin = kind => { PRIM = { kind: num(kind), verts: [] }; };
    global.draw_primitive_begin_texture = (kind) => { PRIM = { kind: num(kind), verts: [] }; };
    global.draw_vertex = (x, y) => { if (PRIM) PRIM.verts.push({ x: num(x), y: num(y), c: DRAWSTATE.color, a: DRAWSTATE.alpha }); };
    global.draw_vertex_colour = global.draw_vertex_color = (x, y, c, a) => {
      if (PRIM) PRIM.verts.push({ x: num(x), y: num(y), c: css(c), a: a === undefined ? 1 : num(a) });
    };
    global.draw_vertex_texture = (x, y) => global.draw_vertex(x, y);
    global.draw_vertex_texture_colour = global.draw_vertex_texture_color = (x, y, u, v, c, a) =>
      global.draw_vertex_colour(x, y, c, a);
    global.draw_primitive_end = () => {
      const p = PRIM; PRIM = null;
      const ctx = global.$gmlActiveCtx;
      if (!ctx || !p || p.verts.length < 2) return;
      const V = p.verts;
      // Canvas has no Gouraud fill, so a triangle takes the mean of its three
      // vertex colours — closer than always using vertex 0.
      const mean = list => {
        let r = 0, g = 0, b = 0, a = 0;
        for (const v of list) {
          const ch = channels(v.c);
          r += ch[0]; g += ch[1]; b += ch[2]; a += v.a;
        }
        const n = list.length;
        return { css: `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`, a: a / n };
      };
      const tri = (a, b, c) => {
        const m = mean([a, b, c]);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, m.a));
        ctx.fillStyle = m.css;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      };
      const seg = (a, b) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, a.a));
        ctx.strokeStyle = a.c;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.restore();
      };
      switch (p.kind) {
        case 1:  for (const v of V) { ctx.save(); ctx.globalAlpha = v.a; ctx.fillStyle = v.c; ctx.fillRect(v.x, v.y, 1, 1); ctx.restore(); } break;
        case 2:  for (let i = 0; i + 1 < V.length; i += 2) seg(V[i], V[i + 1]); break;
        case 3:  for (let i = 0; i + 1 < V.length; i++) seg(V[i], V[i + 1]); break;
        case 4:  for (let i = 0; i + 2 < V.length; i += 3) tri(V[i], V[i + 1], V[i + 2]); break;
        case 5:  for (let i = 0; i + 2 < V.length; i++) tri(V[i], V[i + 1], V[i + 2]); break;
        case 6:  for (let i = 1; i + 1 < V.length; i++) tri(V[0], V[i], V[i + 1]); break;
        default: for (let i = 0; i + 2 < V.length; i++) tri(V[i], V[i + 1], V[i + 2]); break;
      }
    };

    // ── The view ports ───────────────────────────────────────────────────
    // `view_wport[0]` / `view_hport[0]` are the view's pixel size. Absent, the
    // instance proxy answered with a zero-filled auto-array, so anything sizing
    // itself from the view collapsed — Pink's date backdrop tiles from
    // `camx - 638` to `camx + view_wport[0]`, which with 0 tiles entirely
    // offscreen and leaves the background blank.
    if (!Array.isArray(global.view_wport)) global.view_wport = new Array(8).fill(640);
    if (!Array.isArray(global.view_hport)) global.view_hport = new Array(8).fill(480);
    if (!Array.isArray(global.view_xport)) global.view_xport = new Array(8).fill(0);
    if (!Array.isArray(global.view_yport)) global.view_yport = new Array(8).fill(0);
    if (!Array.isArray(global.view_visible)) global.view_visible = new Array(8).fill(true);
    if (!Array.isArray(global.view_wview)) global.view_wview = new Array(8).fill(640);
    if (!Array.isArray(global.view_hview)) global.view_hview = new Array(8).fill(480);
    if (!Array.isArray(global.view_xview)) global.view_xview = new Array(8).fill(0);
    if (!Array.isArray(global.view_yview)) global.view_yview = new Array(8).fill(0);
    if (!Array.isArray(global.view_enabled)) global.view_enabled = new Array(8).fill(true);
    if (!Array.isArray(global.view_camera)) global.view_camera = new Array(8).fill(0);

    // ── Room layers ──────────────────────────────────────────────────────
    // The single largest unresolved call cluster in the shipped GML (~850
    // calls, `layer_set_visible` alone 363). Rooms are not part of the export,
    // so there is no authored layer data to load — but the calls still have to
    // behave coherently, because the game reads back what it writes:
    // `layer_set_visible(layer_get_id("bg"), false)` then a later
    // `layer_get_visible` must answer false, and `layer_x(lay, n)` then
    // `layer_get_x` must answer n.
    //
    // So layers are a real registry, created on demand by name. Returning -1
    // for an unknown name (what GameMaker does for a layer that truly does not
    // exist) would be the wrong lie here: in the real game these layers DO
    // exist, and -1 turns every subsequent read into garbage. An instance
    // assigned to a hidden layer stops drawing, which is the one visible effect
    // the studio can honour faithfully.
    const LAYERS = new Map();
    const LAYERS_BY_NAME = new Map();
    let nextLayerId = 1000;
    function layerNew(name, depth) {
      const rec = {
        id: nextLayerId++, name: String(name), visible: true,
        depth: num(depth) || 0, x: 0, y: 0, hspeed: 0, vspeed: 0, elements: [],
      };
      LAYERS.set(rec.id, rec);
      LAYERS_BY_NAME.set(rec.name, rec);
      return rec;
    }
    /** Resolve a layer id OR name to its record, creating it on demand. */
    function layerOf(ref, create) {
      if (ref && typeof ref === 'object' && ref.id !== undefined) return LAYERS.get(num(ref.id)) || null;
      const n = num(ref);
      if (isFinite(n) && LAYERS.has(n)) return LAYERS.get(n);
      if (typeof ref === 'string') {
        const byName = LAYERS_BY_NAME.get(ref);
        if (byName) return byName;
        return create === false ? null : layerNew(ref, 0);
      }
      return null;
    }
    global.GML_LAYER_VISIBLE = function (ref) {
      const l = layerOf(ref, false);
      return l ? !!l.visible : true;
    };

    global.layer_exists = ref => !!layerOf(ref, false);
    global.layer_get_id = name => layerOf(name).id;
    global.layer_get_id_at_depth = d => {
      const hits = [...LAYERS.values()].filter(l => l.depth === num(d)).map(l => l.id);
      return hits.length ? hits : [layerNew('depth_' + num(d), num(d)).id];
    };
    global.layer_create = (depth, name) => layerNew(name || ('layer_' + nextLayerId), depth).id;
    global.layer_destroy = ref => {
      const l = layerOf(ref, false);
      if (!l) return;
      LAYERS.delete(l.id);
      LAYERS_BY_NAME.delete(l.name);
    };
    global.layer_get_all = () => [...LAYERS.keys()];
    global.layer_get_name = ref => { const l = layerOf(ref, false); return l ? l.name : ''; };
    global.layer_set_visible = (ref, vis) => { const l = layerOf(ref); if (l) l.visible = bool(vis); };
    global.layer_get_visible = ref => { const l = layerOf(ref, false); return l ? l.visible : true; };
    global.layer_depth = (ref, d) => { const l = layerOf(ref); if (l) l.depth = num(d); };
    global.layer_get_depth = ref => { const l = layerOf(ref, false); return l ? l.depth : 0; };
    global.layer_x = (ref, v) => { const l = layerOf(ref); if (l) l.x = num(v); };
    global.layer_y = (ref, v) => { const l = layerOf(ref); if (l) l.y = num(v); };
    global.layer_get_x = ref => { const l = layerOf(ref, false); return l ? l.x : 0; };
    global.layer_get_y = ref => { const l = layerOf(ref, false); return l ? l.y : 0; };
    global.layer_hspeed = (ref, v) => { const l = layerOf(ref); if (l) l.hspeed = num(v); };
    global.layer_vspeed = (ref, v) => { const l = layerOf(ref); if (l) l.vspeed = num(v); };
    global.layer_get_hspeed = ref => { const l = layerOf(ref, false); return l ? l.hspeed : 0; };
    global.layer_get_vspeed = ref => { const l = layerOf(ref, false); return l ? l.vspeed : 0; };
    global.layer_get_element_layer = () => -1;
    global.layer_get_element_type = () => 0;      // layerelementtype_undefined
    global.layer_element_move = () => {};
    global.layer_has_instance = (ref, inst) => {
      const l = layerOf(ref, false);
      return !!(l && inst && String(inst.layer) === l.name);
    };
    // No authored room content exists, so a layer owns no elements. Returning an
    // empty array (never undefined) keeps the game's `for` loops over it safe.
    global.layer_get_all_elements = () => [];
    for (const g of ['sprite', 'background', 'tilemap', 'instance']) {
      global['layer_' + g + '_exists'] = () => false;
    }
    // Sprite-element accessors: the element does not exist, so report neutral
    // values rather than undefined, which would poison the arithmetic they feed.
    const spriteElementDefaults = {
      layer_sprite_get_sprite: -1, layer_sprite_get_index: 0, layer_sprite_get_speed: 0,
      layer_sprite_get_x: 0, layer_sprite_get_y: 0, layer_sprite_get_xscale: 1,
      layer_sprite_get_yscale: 1, layer_sprite_get_angle: 0, layer_sprite_get_alpha: 1,
      layer_sprite_get_blend: 16777215, layer_sprite_get_id: -1,
    };
    for (const [fn, val] of Object.entries(spriteElementDefaults)) global[fn] = () => val;
    for (const fn of ['layer_sprite_change', 'layer_sprite_x', 'layer_sprite_y', 'layer_sprite_index',
      'layer_sprite_xscale', 'layer_sprite_yscale', 'layer_sprite_angle', 'layer_sprite_alpha',
      'layer_sprite_blend', 'layer_sprite_speed', 'layer_sprite_destroy',
      'layer_background_visible', 'layer_background_change', 'layer_background_alpha',
      'layer_background_blend', 'layer_background_xscale', 'layer_background_yscale',
      'layer_background_htiled', 'layer_background_vtiled', 'layer_background_stretch',
      'layer_background_index', 'layer_background_speed', 'layer_background_destroy']) {
      global[fn] = () => {};
    }
    // The font stack: draw_get_font must report what draw_set_font last set, or
    // the many "save the font, change it, restore it" blocks restore garbage.
    let currentFont = -1;
    const nativeSetFont = global.draw_set_font;
    global.draw_set_font = function (f) {
      currentFont = (f === undefined || f === null) ? -1 : f;
      if (typeof nativeSetFont === 'function') try { nativeSetFont.call(this, f); } catch (e) {}
    };
    global.draw_get_font = () => currentFont;

    global.layer_sprite_create = () => -1;
    global.layer_background_create = () => -1;
    global.layer_background_get_sprite = () => -1;
    global.layer_background_get_visible = () => true;

    // ── Assets by name ───────────────────────────────────────────────────
    // This engine identifies every asset by its NAME, so an "index" IS the name.
    // Deltarune uses asset_get_index for data-driven lookups (localised sounds,
    // sprite tables), and -1 for a real asset would silently blank them.
    global.asset_get_index = function (name) {
      const n = typeof name === 'string' ? name : String(name);
      const has = (global.GML_SPRITE_MANIFEST && global.GML_SPRITE_MANIFEST[n])
        || (global.GML_SPRITE_FRAMES && global.GML_SPRITE_FRAMES[n])
        || (global.GML_SOUNDS && global.GML_SOUNDS[n])
        || (global.GML_OBJECT_INDEX && global.GML_OBJECT_INDEX.exists && global.GML_OBJECT_INDEX.exists(n))
        || (typeof global[n] === 'function');
      return has ? n : -1;
    };
    global.asset_get_type = function (name) {
      const n = String(name);
      if (global.GML_SPRITE_MANIFEST && global.GML_SPRITE_MANIFEST[n]) return 0;   // asset_sprite
      if (global.GML_SOUNDS && global.GML_SOUNDS[n]) return 3;                     // asset_sound
      if (/^obj_/.test(n)) return 1;                                               // asset_object
      return -1;
    };
    global.draw_clear = col => {
      const ctx = global.$gmlActiveCtx;
      if (!ctx) return;
      const w = (ctx.canvas && ctx.canvas.width) || 640, h = (ctx.canvas && ctx.canvas.height) || 480;
      ctx.save();
      if (ctx.setTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = global.toCSSColor(col);
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    };
    global.draw_clear_alpha = (col, a) => {
      const ctx = global.$gmlActiveCtx;
      if (!ctx) return;
      const w = (ctx.canvas && ctx.canvas.width) || 640, h = (ctx.canvas && ctx.canvas.height) || 480;
      ctx.save();
      if (ctx.setTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (ctx.clearRect) ctx.clearRect(0, 0, w, h);
      a = num(a);
      if (a > 0) {
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillStyle = global.toCSSColor(col);
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
    };

    // ── Collision builtins ───────────────────────────────────────────────
    // The runtime's versions returned noone unconditionally, so every
    // shootable/destructible interaction silently did nothing. These are AABB
    // against declared sprite masks (precise-mask arg is accepted, ignored).
    // They run with `this` bound to the calling instance (codegen SELF_FNS),
    // which is what `notme` and the place_* family need.
    const activeH = () => { const r = global.activeGMLRuntime; return r && r.H; };
    const selfInst = t => (t && typeof t === 'object' && typeof t.object_name === 'string' ? t : undefined);
    global.collision_rectangle = function (x1, y1, x2, y2, obj, prec, notme) {
      const h = activeH(); if (!h) return -4;
      return h.collisionRect(x1, y1, x2, y2, obj, prec, notme, selfInst(this));
    };
    global.collision_circle = function (cx, cy, rad, obj, prec, notme) {
      const h = activeH(); if (!h) return -4;
      return h.collisionCircle(cx, cy, rad, obj, prec, notme, selfInst(this));
    };
    global.collision_line = function (x1, y1, x2, y2, obj, prec, notme) {
      const h = activeH(); if (!h) return -4;
      return h.collisionLine(x1, y1, x2, y2, obj, prec, notme, selfInst(this));
    };
    global.collision_point = function (px, py, obj, prec, notme) {
      const h = activeH(); if (!h) return -4;
      return h.collisionPoint(px, py, obj, prec, notme, selfInst(this));
    };
    global.instance_place = function (x, y, obj) {
      const h = activeH(); if (!h) return -4;
      return h.placeMeeting(x, y, obj, selfInst(this));
    };
    global.place_meeting = function (x, y, obj) {
      return global.instance_place.call(this, x, y, obj) !== -4;
    };
    // ── List-returning collision queries ─────────────────────────────────
    // GameMaker's *_list variants append EVERY hit to a ds_list and return the
    // count, where the plain call returns only the first. Deltarune uses them
    // whenever it has to act on all overlaps at once (pushable furniture,
    // multi-hit sweeps). `withList` gives the same candidate set that `with`
    // would iterate, so object/parent matching stays identical to everything
    // else in the engine.
    function collisionList(hitTest, objArg, list, notme, self) {
      const h = activeH();
      if (!h) return 0;
      let n = 0;
      for (const inst of (h.withList(objArg) || [])) {
        if (!inst || inst.destroyed) continue;
        if (bool(notme) && inst === self) continue;
        if (!hitTest(inst)) continue;
        if (Array.isArray(list)) list.push(inst);
        n++;
      }
      return n;
    }
    global.collision_rectangle_list = function (x1, y1, x2, y2, obj, prec, notme, list) {
      const h = activeH(); if (!h) return 0;
      return collisionList(i => h.collisionRect(x1, y1, x2, y2, i, prec, false, undefined) !== -4,
        obj, list, notme, selfInst(this));
    };
    global.collision_circle_list = function (cx, cy, rad, obj, prec, notme, list) {
      const h = activeH(); if (!h) return 0;
      return collisionList(i => h.collisionCircle(cx, cy, rad, i, prec, false, undefined) !== -4,
        obj, list, notme, selfInst(this));
    };
    global.collision_point_list = function (px, py, obj, prec, notme, list) {
      const h = activeH(); if (!h) return 0;
      return collisionList(i => h.collisionPoint(px, py, i, prec, false, undefined) !== -4,
        obj, list, notme, selfInst(this));
    };
    global.collision_line_list = function (x1, y1, x2, y2, obj, prec, notme, list) {
      const h = activeH(); if (!h) return 0;
      return collisionList(i => h.collisionLine(x1, y1, x2, y2, i, prec, false, undefined) !== -4,
        obj, list, notme, selfInst(this));
    };
    global.instance_place_list = function (x, y, obj, list, ordered) {
      const h = activeH(); if (!h) return 0;
      const self = selfInst(this);
      return collisionList(i => h.placeMeeting(x, y, i, self) !== -4, obj, list, false, self);
    };

    global.instance_position = function (x, y, obj) {
      const h = activeH(); if (!h) return -4;
      return h.collisionPoint(x, y, obj, false, false, undefined);
    };
    global.position_meeting = function (x, y, obj) {
      return global.instance_position(x, y, obj) !== -4;
    };
    global.instance_nearest = function (x, y, obj) {
      const h = activeH(); if (!h) return -4;
      return h.nearest(x, y, obj, undefined);
    };
    global.instance_furthest = function (x, y, obj) {
      const h = activeH(); if (!h) return -4;
      let best = -4, bd = -1;
      for (const i of h.instancesOf(obj)) {
        const d = Math.hypot(num(i.x) - num(x), num(i.y) - num(y));
        if (d > bd) { bd = d; best = i; }
      }
      return best;
    };
    global.distance_to_point = function (x, y) {
      const s = selfInst(this); if (!s) return 0;
      const bb = bbox(s);
      const dx = Math.max(bb.left - num(x), num(x) - bb.right, 0);
      const dy = Math.max(bb.top - num(y), num(y) - bb.bottom, 0);
      return Math.sqrt(dx * dx + dy * dy);
    };
    global.distance_to_object = function (obj) {
      const s = selfInst(this), h = activeH();
      if (!s || !h) return 100000;
      const a = bbox(s);
      let best = 100000;
      for (const i of h.instancesOf(obj)) {
        if (i === s) continue;
        const b = bbox(i);
        const dx = Math.max(b.left - a.right, a.left - b.right, 0);
        const dy = Math.max(b.top - a.bottom, a.top - b.bottom, 0);
        best = Math.min(best, Math.sqrt(dx * dx + dy * dy));
      }
      return best;
    };
    global.point_in_rectangle = (px, py, x1, y1, x2, y2) =>
      num(px) >= Math.min(num(x1), num(x2)) && num(px) <= Math.max(num(x1), num(x2)) &&
      num(py) >= Math.min(num(y1), num(y2)) && num(py) <= Math.max(num(y1), num(y2));
    global.motion_set = function (dir, spd) {
      const s = selfInst(this); if (!s) return;
      s.direction = num(dir); s.speed = num(spd);
    };
    global.motion_add = function (dir, spd) {
      const s = selfInst(this); if (!s) return;
      s.hspeed = num(s.hspeed) + global.lengthdir_x(num(spd), num(dir));
      s.vspeed = num(s.vspeed) + global.lengthdir_y(num(spd), num(dir));
    };
    global.move_towards_point = function (x, y, spd) {
      const s = selfInst(this); if (!s) return;
      s.direction = global.point_direction(num(s.x), num(s.y), num(x), num(y));
      s.speed = num(spd);
    };

    // ── Math corrections (all manual-verified) ──────────────────────────
    // round() is banker's rounding: half-integers go to the nearest EVEN value
    // ("2.5 would be rounded to 2, while 3.5 will be rounded to 4").
    global.round = v => {
      v = num(v);
      const f = Math.floor(v);
      const d = v - f;
      if (d > 0.5) return f + 1;
      if (d < 0.5) return f;
      return (f % 2 === 0) ? f : f + 1;
    };
    // irandom(n): integer 0..n INCLUSIVE; a float's fraction is dropped.
    global.irandom = n => {
      n = Math.trunc(num(n));
      if (n >= 0) return Math.floor(Math.random() * (n + 1));
      return -Math.floor(Math.random() * (-n + 1));
    };
    global.irandom_range = (a, b) => {
      a = Math.trunc(num(a)); b = Math.trunc(num(b));
      if (a > b) { const t = a; a = b; b = t; }
      return a + Math.floor(Math.random() * (b - a + 1));
    };
    global.angle_difference = (a, b) => ((num(a) - num(b) + 180) % 360 + 360) % 360 - 180;

    // Declared-frame sprite queries — GML math uses the authored frame size.
    global.sprite_get_width = spr => { const s = declaredSpriteSize(spr); return s ? s.w : 0; };
    global.sprite_get_height = spr => { const s = declaredSpriteSize(spr); return s ? s.h : 0; };
    global.string_hash_to_newline = s => str(s).replace(/#/g, '\n');

    // ── Shape/colour + stretched/tiled draws that were no-ops ───────────
    // One flat colour approximates GameMaker's per-vertex gradients.
    const shapeCtx = () => global.$gmlActiveCtx;
    global.draw_line_colour = global.draw_line_color = (x1, y1, x2, y2, c1) => {
      const ctx = shapeCtx(); if (!ctx) return;
      ctx.save(); ctx.strokeStyle = global.toCSSColor(c1); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(num(x1), num(y1)); ctx.lineTo(num(x2), num(y2)); ctx.stroke(); ctx.restore();
    };
    global.draw_line_width_colour = global.draw_line_width_color = (x1, y1, x2, y2, w, c1) => {
      const ctx = shapeCtx(); if (!ctx) return;
      ctx.save(); ctx.strokeStyle = global.toCSSColor(c1); ctx.lineWidth = Math.max(1, num(w));
      ctx.beginPath(); ctx.moveTo(num(x1), num(y1)); ctx.lineTo(num(x2), num(y2)); ctx.stroke(); ctx.restore();
    };
    global.draw_rectangle_colour = global.draw_rectangle_color = (x1, y1, x2, y2, c1, c2, c3, c4, outline) => {
      const ctx = shapeCtx(); if (!ctx) return;
      ctx.save();
      const l = Math.min(num(x1), num(x2)), t = Math.min(num(y1), num(y2));
      const w = Math.abs(num(x2) - num(x1)), h = Math.abs(num(y2) - num(y1));
      if (bool(outline)) { ctx.strokeStyle = global.toCSSColor(c1); ctx.strokeRect(l, t, w, h); }
      else { ctx.fillStyle = global.toCSSColor(c1); ctx.fillRect(l, t, w, h); }
      ctx.restore();
    };
    global.draw_circle_colour = global.draw_circle_color = (x, y, r, c1, c2, outline) => {
      const ctx = shapeCtx(); if (!ctx || num(r) < 0) return;
      ctx.save(); ctx.beginPath(); ctx.arc(num(x), num(y), num(r), 0, Math.PI * 2);
      if (bool(outline)) { ctx.strokeStyle = global.toCSSColor(c1); ctx.stroke(); }
      else {
        // c1 is the CENTRE colour, c2 the EDGE — a radial gradient, per the
        // manual. Filling flat c1 broke the Roaring Knight's whole backdrop:
        // its Draw multiplies six expanding
        // `draw_circle_color(cx, cy, r, c_white, #595959)` rings plus a
        // white→black vignette onto the flow texture through
        // (bm_zero, bm_src_color), and a FLAT WHITE circle multiplies to a
        // no-op — so none of the pulsing darkening ever happened and the
        // background rendered flat and blinding.
        let fill = global.toCSSColor(c1);
        if (c2 !== undefined && c2 !== null && num(r) > 0) {
          const g = ctx.createRadialGradient(num(x), num(y), 0, num(x), num(y), num(r));
          g.addColorStop(0, global.toCSSColor(c1));
          g.addColorStop(1, global.toCSSColor(c2));
          fill = g;
        }
        ctx.fillStyle = fill; ctx.fill();
      }
      ctx.restore();
    };
    global.draw_triangle_colour = global.draw_triangle_color = (x1, y1, x2, y2, x3, y3, c1, c2, c3, outline) => {
      const ctx = shapeCtx(); if (!ctx) return;
      ctx.save(); ctx.beginPath();
      ctx.moveTo(num(x1), num(y1)); ctx.lineTo(num(x2), num(y2)); ctx.lineTo(num(x3), num(y3)); ctx.closePath();
      if (bool(outline)) { ctx.strokeStyle = global.toCSSColor(c1); ctx.stroke(); }
      else { ctx.fillStyle = global.toCSSColor(c1); ctx.fill(); }
      ctx.restore();
    };
    global.ossafe_fill_rectangle_colour = global.ossafe_fill_rectangle_color = (x1, y1, x2, y2, c1) => {
      global.draw_rectangle_colour(x1, y1, x2, y2, c1, c1, c1, c1, false);
    };
    global.draw_sprite_stretched = (spr, sub, x, y, w, h) => {
      const ctx = shapeCtx(); if (!ctx || num(w) <= 0 || num(h) <= 0) return;
      const s = spriteDraw(spr, sub);
      if (s.img && s.img.complete && s.img.naturalWidth > 0) ctx.drawImage(s.img, num(x), num(y), num(w), num(h));
    };
    global.draw_sprite_stretched_ext = (spr, sub, x, y, w, h, col, alpha) => {
      const ctx = shapeCtx(); if (!ctx || num(w) <= 0 || num(h) <= 0) return;
      const s = spriteDraw(spr, sub);
      if (!(s.img && s.img.complete && s.img.naturalWidth > 0)) return;
      ctx.save();
      ctx.globalAlpha = alpha === undefined ? 1 : Math.max(0, Math.min(1, num(alpha)));
      ctx.drawImage(s.img, num(x), num(y), num(w), num(h));
      ctx.restore();
    };
    // A tiled fill is ONE canvas pattern fill, not a nested drawImage loop.
    // The loop cost real frame rate: the Knight's roar tiles a small sprite over
    // a 640x480 surface FIVE times per frame, which is thousands of blits and
    // measured 16.7 ms — the entire frame budget in one object's Draw.
    const patternCache = new WeakMap();
    function patternFor(ctx, img, blend) {
      let byBlend = patternCache.get(img);
      if (!byBlend) { byBlend = new Map(); patternCache.set(img, byBlend); }
      const key = blend === undefined || blend === null ? '' : String(blend);
      let pat = byBlend.get(key);
      if (pat !== undefined) return pat;
      let src = img;
      // A tint has to be baked into the pattern source; there is no per-fill tint.
      if (key) {
        const ch = channels(blend);
        if (!(ch[0] === 255 && ch[1] === 255 && ch[2] === 255)) {
          const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          if (w > 0 && h > 0) {
            const buf = document.createElement('canvas');
            buf.width = w; buf.height = h;
            drawTinted(buf.getContext('2d'), img, 0, 0, blend);
            src = buf;
          }
        }
      }
      try { pat = ctx.createPattern(src, 'repeat'); } catch (e) { pat = null; }
      byBlend.set(key, pat);
      return pat;
    }
    global.draw_sprite_tiled_ext = (spr, sub, x, y, xs, ys, col, alpha) => {
      // Tiles across the whole render target, phase-shifted so a tile corner
      // sits at (x, y) — GameMaker semantics. The runtime drew ONE copy.
      const ctx = shapeCtx(); if (!ctx) return;
      const s = spriteDraw(spr, sub);
      if (!(s.img && s.img.complete && s.img.naturalWidth > 0)) return;
      const sx = Math.abs(num(xs) || 1), sy = Math.abs(num(ys) || 1);
      const iw = s.img.naturalWidth, ih = s.img.naturalHeight;
      const tw = iw * sx, th = ih * sy;
      if (tw < 1 || th < 1) return;
      const W = (ctx.canvas && ctx.canvas.width) || 640, Hh = (ctx.canvas && ctx.canvas.height) || 480;
      const startX = ((num(x) % tw) + tw) % tw - tw;
      const startY = ((num(y) % th) + th) % th - th;
      ctx.save();
      const tA = alpha === undefined ? 1 : num(alpha);
      ctx.globalAlpha = isFinite(tA) ? Math.max(0, Math.min(1, tA)) : 1;
      const pat = patternFor(ctx, s.img, col);
      if (pat) {
        // The pattern repeats from the LOCAL origin, so translating to the phase
        // offset lines the tiles up exactly as the loop did.
        ctx.translate(startX, startY);
        if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, (W - startX) / sx + iw, (Hh - startY) / sy + ih);
      } else {
        for (let yy = startY; yy < Hh; yy += th) {
          for (let xx = startX; xx < W; xx += tw) ctx.drawImage(s.img, xx, yy, tw, th);
        }
      }
      ctx.restore();
    };
    global.draw_sprite_tiled = (spr, sub, x, y) => global.draw_sprite_tiled_ext(spr, sub, x, y, 1, 1, undefined, 1);

    // ── Blend modes ────────────────────────────────────────────────────
    // gpu_set_blendmode was a no-op, so every additive effect — glows, lasers,
    // light orbs, flashes — drew flat and opaque instead of brightening what's
    // under it. Canvas can express the two modes Deltarune actually uses.
    const BLEND_TO_COMPOSITE = {
      0: 'source-over',      // bm_normal
      1: 'lighter',          // bm_add
      2: 'source-over',      // bm_max — no exact Canvas match; additive is closer
      // bm_subtract removes colour AND alpha — Deltarune's darkness overlays
      // draw a black surface and subtract the light sprite to punch a
      // transparent hole. 'difference' (the old mapping) inverted instead,
      // which painted the hole WHITE: the Gerson white-screen bug.
      3: 'destination-out',
    };
    global.gpu_set_blendmode = function (mode) {
      const ctx = global.$gmlActiveCtx;
      if (!ctx) return;
      const op = BLEND_TO_COMPOSITE[num(mode)];
      ctx.globalCompositeOperation = op || 'source-over';
    };
    global.draw_set_blend_mode = global.gpu_set_blendmode;
    // The src/dst factor form is how Deltarune does MASKING on surfaces:
    //   (bm_zero, bm_src_alpha)     keep dest where src has alpha → destination-in
    //   (bm_zero, bm_inv_src_alpha) punch holes where src has alpha → destination-out
    // Collapsing every combination to 'lighter' (the old behaviour) made every
    // mask into a glow instead.
    global.gpu_set_blendmode_ext = function (src, dst) {
      const ctx = global.$gmlActiveCtx;
      if (!ctx) return;
      const key = num(src) + ',' + num(dst);
      // Keyed on GameMaker's real factor values (bm_zero=1 … bm_src_alpha=5).
      // Canvas has no separable blend equation, so each pair maps to the
      // Porter-Duff operator with the same visible result.
      const MAP = {
        '1,6': 'destination-out',   // (zero, inv_src_alpha): punch a hole
        '1,5': 'destination-in',    // (zero, src_alpha): keep only where src is
        '1,3': 'multiply',          // (zero, src_colour): modulate the target
        '1,9': 'multiply',          // (zero, dest_colour)
        '5,2': 'lighter',           // (src_alpha, one): additive
        '2,2': 'lighter',           // (one, one): additive
        '2,1': 'copy',              // (one, zero): overwrite
        '5,6': 'source-over',       // (src_alpha, inv_src_alpha): normal alpha
        '2,6': 'source-over',       // (one, inv_src_alpha): premultiplied normal

        // The DEST-ALPHA family. Each is derived from GameMaker's blend
        // equation, result = src*srcFactor + dst*dstFactor, with Ad = the
        // destination's alpha:
        //
        //   (7,8) dest_alpha, inv_dest_alpha -> src*Ad + dst*(1-Ad)
        //         Ad=1: src.  Ad=0: dst (transparent).  "Draw only where the
        //         destination already has alpha" — Deltarune's mask-clipping
        //         idiom in scr_draw_in_mask / scr_draw_in_box_begin, which
        //         builds a mask in the alpha channel and then clips to it.
        //         Left as source-over the mask did nothing at all and content
        //         drew everywhere.
        '7,8': 'source-atop',
        //
        //   (7,7) dest_alpha, dest_alpha -> (src + dst) * Ad
        //         Additive, but clipped to the existing alpha. Used by
        //         obj_roaringknight_boxsplitter_attack: it paints a slash into
        //         a cleared surface, then tiles spr_knight_bullet_flow through
        //         it. Canvas cannot express "additive AND clipped" in one op,
        //         so we keep the CLIP: source-atop loses the additive glow,
        //         while 'lighter' would flood the whole surface and destroy the
        //         slash shape that is the effect's entire identity.
        '7,7': 'source-atop',
        //
        //   (8,7) inv_dest_alpha, dest_alpha -> src*(1-Ad) + dst*Ad
        //         Ad=1: dst is kept.  Ad=0: src shows. That is "draw BEHIND
        //         what is already there", which Canvas has exactly.
        //         obj_purplecontrols uses it to lay the darker purple field in
        //         behind the lane grid it just drew — as source-over the field
        //         painted OVER the grid and hid it.
        '8,7': 'destination-over',
        //
        //   (7,1) dest_alpha, zero -> src*Ad, dst discarded. EXACTLY Canvas
        //         'source-in'. obj_knight_split_growtangle draws its seam line
        //         with this so the line exists only inside the split box's
        //         silhouette; as source-over the line painted unclipped.
        '7,1': 'source-in',
        //
        //   (8,1) inv_dest_alpha, zero -> src*(1-Ad): draw only where the
        //         destination is EMPTY, discard it elsewhere = 'source-out'
        //         (ch4 prophecy overlay).
        '8,1': 'source-out',
        //
        //   (1,5) zero, src_alpha -> dst*As: keep the destination scaled by
        //         the SOURCE's alpha = 'destination-in' (ch5 foyer darkness).
        '1,5': 'destination-in',
        //
        //   (1,1) zero, zero -> 0 wherever the source has coverage: an eraser.
        //         'destination-out' is dst*(1-As) — exact for the opaque
        //         silhouettes obj_following_silhouette punches out.
        '1,1': 'destination-out',
        //
        //   (7,2) dest_alpha, one -> src*Ad + dst: additive clipped to the
        //         destination's alpha (spotlight backlighting). Over an opaque
        //         target Ad=1 and this IS plain additive.
        '7,2': 'lighter',
        //
        //   (5,7) src_alpha, dest_alpha -> src*As + dst*Ad: over the opaque
        //         room the noellehouse overlays draw on, Ad=1 -> additive.
        '5,7': 'lighter',
        //
        //   (5,8) src_alpha, inv_dest_alpha -> src*As + dst*(1-Ad): source
        //         shows where the destination is empty, destination survives
        //         where it is opaque — Canvas's 'destination-over' (ch3 room
        //         spotlights).
        '5,8': 'destination-over',
      };
      const op = MAP[key];
      if (!op && !MISSING_WARNED.has('bmext:' + key)) {
        MISSING_WARNED.add('bmext:' + key);
        console.warn(`[gml] gpu_set_blendmode_ext(${key}) has no canvas mapping — using source-over`);
      }
      ctx.globalCompositeOperation = op || 'source-over';
    };
    global.draw_set_blend_mode_ext = global.gpu_set_blendmode_ext;

    /**
     * Separate-alpha blending. The ALPHA pair is the whole point of this call
     * and forwarding only the colour pair threw it away.
     *
     * `(..., bm_dest_alpha, bm_zero)` on the alpha channel is
     * `Ad' = Ad*Ad + As*0`, i.e. **keep the destination's alpha and contribute
     * none from the source** — Deltarune's "paint into this shape without
     * changing its silhouette" idiom. It appears in
     * obj_knight_pointing_cone (the Stars cone, twice), obj_darkness_overlay in
     * both ch4 and ch5, obj_darkness_overlay_twofloor and obj_board_quizwheel.
     *
     * The cone builds its wedge as a pr_trianglelist primitive on a cleared
     * surface, then scrolls spr_knight_bullet_flow across the FULL 640-wide
     * surface with this mode so the texture only shows inside the wedge. Read
     * as the colour pair alone that is `(bm_src_alpha, bm_one)` = 'lighter',
     * additive and unclipped — so the flow flooded the whole surface and the
     * cone lost its shape entirely.
     *
     * Canvas cannot express "additive AND clipped to destination alpha" in one
     * operator, so we keep the CLIP: `source-atop` restricts the paint to the
     * existing alpha and preserves it exactly. That loses the additive
     * brightening over the wedge but keeps the silhouette, which is the
     * effect's visual identity — the same trade already made for the
     * (bm_dest_alpha, bm_dest_alpha) boxsplitter case.
     */
    global.gpu_set_blendmode_ext_sepalpha = function (src, dst, asrc, adst) {
      const ctx = global.$gmlActiveCtx;
      const a = num(asrc) + ',' + num(adst);
      // 7 = bm_dest_alpha, 1 = bm_zero, 6 = bm_inv_src_alpha, 2 = bm_one.
      if (ctx && a === '7,1') { ctx.globalCompositeOperation = 'source-atop'; return; }
      // Alpha erased wherever the source covers: a hole punch.
      if (ctx && a === '1,6') { ctx.globalCompositeOperation = 'destination-out'; return; }
      // Anything else: the colour pair carries the meaning.
      global.gpu_set_blendmode_ext(src, dst);
    };

    // ── Box clipping ─────────────────────────────────────────────────────
    // The runtime's scr_draw_in_box_* close over ITS OWN old gt_minx/gt_maxx
    // (the pre-fix formulas), so the clip rectangle disagreed with the real
    // box — sprites visibly cut off at the wrong edges. Same +5/-4 insets the
    // game uses.
    global.scr_draw_in_box_begin = () => {
      const ctx = global.$gmlActiveCtx;
      if (!ctx || !ctx.beginPath) return;
      const e = global.GML_BOX_EDGES();
      ctx.save();
      ctx.beginPath();
      ctx.rect(e.l + 5, e.t + 5, (e.r - e.l) - 9, (e.b - e.t) - 9);
      if (ctx.clip) ctx.clip();
    };
    global.scr_draw_in_box_end = () => {
      const ctx = global.$gmlActiveCtx;
      if (ctx) ctx.restore();
    };
    global.scr_draw_in_box_ext_begin = (mx, my) => {
      const ctx = global.$gmlActiveCtx;
      if (!ctx || !ctx.beginPath) return;
      const e = global.GML_BOX_EDGES();
      mx = num(mx); my = num(my);
      ctx.save();
      ctx.beginPath();
      ctx.rect(e.l + mx, e.t + my, (e.r - e.l) - 2 * mx, (e.b - e.t) - 2 * my);
      if (ctx.clip) ctx.clip();
    };
    global.scr_draw_in_box_ext_end = global.scr_draw_in_box_end;

    // ── draw_sprite_part with GameMaker's source-rect clamping ──────────
    // Canvas clamps an out-of-range source rect but keeps the dest size, which
    // STRETCHES the sprite — the "clipped/smeared sprite" artefacts. GameMaker
    // clamps the rect and shifts the destination by the clamped amount.
    global.draw_sprite_part_ext = (spr, sub, l, t, w, h, x, y, xs, ys, col, alpha) => {
      const ctx = global.$gmlActiveCtx;
      if (!ctx) return;
      const s = spriteDraw(spr, sub);
      if (!(s.img && s.img.complete && s.img.naturalWidth > 0)) return;
      let L = num(l), T = num(t), W = num(w), Hh = num(h), dx = 0, dy = 0;
      if (L < 0) { W += L; dx = -L; L = 0; }
      if (T < 0) { Hh += T; dy = -T; T = 0; }
      W = Math.min(W, s.img.naturalWidth - L);
      Hh = Math.min(Hh, s.img.naturalHeight - T);
      if (W <= 0 || Hh <= 0) return;
      ctx.save();
      ctx.translate(num(x), num(y));
      ctx.scale(num(xs) || 1, num(ys) || 1);
      ctx.globalAlpha = alpha === undefined ? 1 : Math.max(0, Math.min(1, num(alpha)));
      try { ctx.drawImage(s.img, L, T, W, Hh, dx, dy, W, Hh); } catch (e) {}
      ctx.restore();
    };
    global.draw_sprite_part = (spr, sub, l, t, w, h, x, y) =>
      global.draw_sprite_part_ext(spr, sub, l, t, w, h, x, y, 1, 1, undefined, 1);

    // ── Shader shim ──────────────────────────────────────────────────────
    // Real GLSL is out of scope, but the one shader battle code leans on
    // constantly is the white/flash fill — drawTinted renders a white
    // silhouette while a *white*/*flash* shader is set. Anything else is a
    // silent no-op (previously they were ReferenceErrors or dead stubs).
    global.shader_set = sh => { global.$gmlShader = sh == null ? '' : String(sh); };
    global.shader_reset = () => { global.$gmlShader = ''; };
    global.shader_is_compiled = () => true;
    global.shader_get_uniform = () => 0;
    global.shader_set_uniform_f = () => {};
    global.shader_set_uniform_i = () => {};

    // ── draw_sprite_ext ────────────────────────────────────────────────
    // Reimplemented rather than wrapped: the runtime version ignored the `color`
    // argument for real images (it only tinted the missing-sprite placeholder),
    // so any attack that tints through draw_sprite_ext instead of image_blend
    // drew untinted. Wrapping it couldn't work — its own save()/restore() resets
    // the composite state a tint pass depends on.
    global.draw_sprite_ext = function (spr, subimg, x, y, xscale, yscale, rot, color, alpha) {
      const ctx = global.$gmlActiveCtx;
      spr = sprAlias(spr);
      if (!ctx || !spr || typeof spr !== 'string') return;
      withAlphaMask(ctx, () => {
        const s = spriteDraw(spr, subimg);
        ctx.save();
        ctx.translate(num(x), num(y));
        const r = num(rot);
        if (r) ctx.rotate(-r * Math.PI / 180);
        const sx = xscale === undefined ? 1 : num(xscale);
        const sy = yscale === undefined ? 1 : num(yscale);
        if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
        // A NaN globalAlpha is silently IGNORED by canvas — it keeps whatever
        // alpha was last set, which turns one NaN-poisoned argument into
        // nondeterministic full-bright draws. Normalise to 1 (GM draws fully
        // when its alpha maths degenerates, and 1 is at least deterministic).
        const rawA = alpha === undefined ? 1 : num(alpha);
        ctx.globalAlpha = (isFinite(rawA) ? Math.max(0, Math.min(1, rawA)) : 1) * MASK_MUL;
        if (s.img && s.img.complete && s.img.naturalWidth > 0) {
          drawTinted(ctx, s.img, -s.ox, -s.oy, color);
        } else {
          ctx.fillStyle = global.toCSSColor(color || '#ffffff');
          ctx.fillRect(-s.ox, -s.oy, s.w || 16, s.h || 16);
        }
        ctx.restore();
      });
    };
    global.draw_sprite = function (spr, subimg, x, y) {
      global.draw_sprite_ext(spr, subimg, x, y, 1, 1, 0, undefined, 1);
    };
    global.draw_sprite_general = function (spr, subimg, left, top, w, h, x, y, xscale, yscale, rot, c1, c2, c3, c4, alpha) {
      // Sub-rectangle draw WITH rotation about (x, y). The previous version
      // delegated to draw_sprite_part_ext and silently dropped the rotation.
      // Four corner colours collapse to one flat tint approximation (c1).
      const ctx = global.$gmlActiveCtx;
      if (!ctx || num(w) <= 0 || num(h) <= 0) return;
      const s = spriteDraw(spr, subimg);
      if (!(s.img && s.img.complete && s.img.naturalWidth > 0)) return;
      ctx.save();
      ctx.translate(num(x), num(y));
      if (num(rot)) ctx.rotate(-num(rot) * Math.PI / 180);
      ctx.scale(num(xscale) || 1, num(yscale) || 1);
      ctx.globalAlpha = alpha === undefined ? 1 : Math.max(0, Math.min(1, num(alpha)));
      try { ctx.drawImage(s.img, num(left), num(top), num(w), num(h), 0, 0, num(w), num(h)); } catch (e) {}
      ctx.restore();
    };

    const prevSetActive = global.setActiveCtx;
    global.setActiveCtx = function (ctx) {
      global.$gmlActiveCtx = ctx;
      // One GML draw state, many canvases: re-push colour/alpha and the texture
      // filter whenever the render target changes, or everything drawn into a
      // surface picks up that canvas's defaults instead of the game's state.
      if (typeof global.GML_PUSH_DRAW_STATE === 'function') global.GML_PUSH_DRAW_STATE(ctx);
      if (typeof pixelate === 'function') pixelate(ctx);
      if (prevSetActive) prevSetActive(ctx);
    };
  }

  function channels(c) {
    if (typeof c === 'number') return [c & 255, (c >> 8) & 255, (c >> 16) & 255];
    const s = String(c);
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    // merge_color returns CSS "rgb(r,g,b)" STRINGS. Unparsed they fell through
    // to the white default, so every sprite tinted with a merge_color result
    // drew UNTINTED — the Flurry fountain column rendered as a white sheet.
    const r = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(s);
    if (r) return [+r[1], +r[2], +r[3]];
    return [255, 255, 255];
  }

  function alignName(a) { return a === 1 ? 'center' : a === 2 ? 'right' : 'left'; }
  function baselineName(a) { return a === 1 ? 'middle' : a === 2 ? 'bottom' : 'top'; }

  function flat(argsLike) {
    const out = [];
    for (let i = 0; i < argsLike.length; i++) {
      const v = argsLike[i];
      if (Array.isArray(v)) out.push.apply(out, v);
      else out.push(v);
    }
    return out;
  }

  /** Define a global only when it is missing or a known-broken stub. */
  function def(name, fn) {
    if (typeof global[name] !== 'function') global[name] = fn;
  }

  /** Origin and frame image for a sprite name, via the asset DB. */
  function spriteDraw(spr, subimg) {
    const info = global.gmlAssets ? global.gmlAssets.getSpriteInfo(spr) : null;
    const frames = (global.GML_SPRITE_FRAMES && global.GML_SPRITE_FRAMES[spr]) || 1;
    // GameMaker reads a NEGATIVE subimg as "use the calling instance's
    // image_index". Math.abs turned -1 into frame 1, so e.g. the battle box's
    // `draw_sprite_ext(sprite_index, 1, ...)` then `(..., -1, ...)` pair —
    // interior fill, then the hollow border frame — drew the fill twice and the
    // box came out as a solid slab with no border.
    let raw = num(subimg);
    if (!isFinite(raw) || raw < 0) {
      const self = global.$gmlDrawSelf;
      raw = self ? num(self.image_index) : 0;
    }
    let idx = Math.floor(Math.abs(raw));
    if (frames > 0) idx = ((idx % frames) + frames) % frames;
    const img = global.gmlAssets ? global.gmlAssets.getImage(spr, idx) : null;
    // Trimmed export art draws shifted by its trim offset (canvas-space origins).
    const t = global.$gmlTrimOf ? global.$gmlTrimOf(spr, idx) : null;
    return {
      img,
      ox: (info ? num(info.originX) : 0) - (t ? t[0] : 0),
      oy: (info ? num(info.originY) : 0) - (t ? t[1] : 0),
      w: info ? info.width : 16,
      h: info ? info.height : 16,
    };
  }

  /** Skip a draw call whose radius argument has gone negative. */
  function guardRadius(name, argIndex) {
    const orig = global[name];
    if (typeof orig !== 'function') return;
    global[name] = function () {
      if (num(arguments[argIndex]) < 0) return;
      return orig.apply(this, arguments);
    };
  }

  /** Run `extra` before the existing implementation of `name`. */
  function wrap(name, extra) {
    const orig = global[name];
    global[name] = function () {
      try { extra.apply(null, arguments); } catch (e) {}
      if (typeof orig === 'function') return orig.apply(this, arguments);
    };
  }

  // ── Sprite tinting ───────────────────────────────────────────────────
  // Canvas has no per-draw tint, so multiply the sprite through an offscreen
  // buffer. Buffers are cached by size; a white blend skips the work entirely.
  /** GameMaker's fixed-function fog (colourise) state — see drawTinted. */
  const FOG = { on: false, css: '#ffffff' };
  global.gpu_set_fog = function (enable, colour) {
    FOG.on = !!enable && enable !== 0;
    if (colour !== undefined && typeof global.toCSSColor === 'function') {
      FOG.css = global.toCSSColor(colour);
    }
  };
  global.d3d_set_fog = global.gpu_set_fog;
  global.gpu_get_fog = () => [FOG.on, FOG.css, 0, 1];

  const tintCache = new Map();
  function drawTinted(ctx, img, dx, dy, blend) {
    // FOG is GameMaker's fixed-function colourise stage: with it enabled the
    // default shader replaces every fragment's RGB with the fog colour and keeps
    // its alpha — a flat silhouette. Deltarune reaches for it constantly (via
    // gpu_set_fog / d3d_set_fog, and inside scr_draw_outline), and the Roaring
    // Knight's "shader" effects are entirely this, not real shaders. In 2D every
    // vertex sits at depth 0, so the fog factor is always 1 and start/end don't
    // matter. drawSilhouette already keeps source alpha and replaces RGB.
    if (FOG.on) {
      drawSilhouette(ctx, img, dx, dy, FOG.css);
      return;
    }
    // A white/flash shader turns the sprite into a solid white silhouette —
    // the flash effect Deltarune uses for hits, tells and parries.
    if (global.$gmlShader && /white|flash/i.test(global.$gmlShader)) {
      drawSilhouette(ctx, img, dx, dy, '#ffffff');
      return;
    }
    if (blend === undefined || blend === null || blend === '#ffffff' || blend === 16777215 || blend === -1) {
      ctx.drawImage(img, dx, dy);
      return;
    }
    const ch = channels(blend);
    if (ch[0] === 255 && ch[1] === 255 && ch[2] === 255) { ctx.drawImage(img, dx, dy); return; }

    // A SURFACE is a canvas, and canvases have width/height but no
    // naturalWidth — reading only the latter gave a 0x0 tint buffer and
    // drawImage threw InvalidStateError, killing the whole Draw event of
    // anything that tints a surface.
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (!(w > 0) || !(h > 0)) return;
    const key = w + 'x' + h;
    let buf = tintCache.get(key);
    if (!buf) {
      buf = document.createElement('canvas');
      buf.width = w; buf.height = h;
      tintCache.set(key, buf);
    } else if (buf.width !== w || buf.height !== h) {
      buf.width = w; buf.height = h;
    }
    const bctx = buf.getContext('2d');
    bctx.clearRect(0, 0, w, h);
    bctx.globalCompositeOperation = 'source-over';
    bctx.drawImage(img, 0, 0);
    bctx.globalCompositeOperation = 'multiply';
    bctx.fillStyle = `rgb(${ch[0]},${ch[1]},${ch[2]})`;
    bctx.fillRect(0, 0, w, h);
    // Restore the sprite's own alpha, which `multiply` over a filled rect loses.
    bctx.globalCompositeOperation = 'destination-in';
    bctx.drawImage(img, 0, 0);
    ctx.drawImage(buf, dx, dy);
  }

  /** Solid-colour silhouette of a sprite — the shape with every pixel `color`. */
  function drawSilhouette(ctx, img, dx, dy, color) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return;
    const key = 'sil:' + w + 'x' + h;
    let buf = tintCache.get(key);
    if (!buf) {
      buf = document.createElement('canvas');
      buf.width = w; buf.height = h;
      tintCache.set(key, buf);
    } else if (buf.width !== w || buf.height !== h) { buf.width = w; buf.height = h; }
    const bctx = buf.getContext('2d');
    bctx.clearRect(0, 0, w, h);
    bctx.globalCompositeOperation = 'source-over';
    bctx.drawImage(img, 0, 0);
    bctx.globalCompositeOperation = 'source-in';
    bctx.fillStyle = color;
    bctx.fillRect(0, 0, w, h);
    ctx.drawImage(buf, dx, dy);
  }

  // ═══════════════════════════════════════════════════════════════════════

  global.GML_HELPERS = {
    for: helpersFor,
    ensureBuiltins,
    num, bool, add, div, str,
    bbox, rectsOverlap,
  };

  patchGlobals();

})(typeof window !== 'undefined' ? window : globalThis);
