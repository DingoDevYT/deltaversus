// Asset loading + bitmap font rendering.
const A = {
  img: {},        // path -> Image
  manifest: null,
  fonts: {},      // key -> {h, glyphs, atlas Image, tints: {color: canvas}}
  ready: false,
};

const ASSET_V = 33;   // bump when sprite/manifest files change so browsers refetch
A.load = function (done) {
  fetch('assets/manifest.json?a=' + ASSET_V).then(r => r.json()).then(man => {
    A.manifest = man;
    const paths = [];
    for (const ch in man.chars)
      for (const g in man.chars[ch])
        for (const f of man.chars[ch][g]) paths.push(`assets/chars/${ch}/${f}`);
    for (const b of ['fight', 'act', 'item', 'spare', 'defend', 'magic', 'charge'])
      paths.push(`assets/ui/btn_${b}.png`, `assets/ui/btn_${b}_sel.png`);
    paths.push('assets/ui/soul.png');
    for (const ch of ['kris', 'susie', 'ralsei', 'noelle', 'lancer', 'berdly', 'jevil', 'spamton', 'knight'])
      paths.push(`assets/ui/head_${ch}.png`, `assets/ui/head_${ch}_gray.png`);
    for (const k in man.fonts) paths.push(`assets/ui/font_${k}.png`);
    for (const b in (man.bullets || {})) paths.push(`assets/bullets/${man.bullets[b].f}`);
    for (const ch in (man.anims || {}))
      for (const pose in man.anims[ch])
        for (const f of man.anims[ch][pose].frames) paths.push(`assets/anims/${ch}/${f}`);
    // background: load every 2nd frame (50 is plenty smooth)
    for (let i = 0; i < man.bg_frames; i += 2) paths.push(`assets/bg/${i}.png`);
    let n = paths.length;
    for (const p of paths) {
      const im = new Image();
      im.onload = im.onerror = () => { if (--n === 0) finish(); };
      im.src = p + '?a=' + ASSET_V;
      A.img[p] = im;   // keyed by clean path; lookups are unaffected
    }
    function finish() {
      for (const k in man.fonts)
        A.fonts[k] = { ...man.fonts[k], atlas: A.img[`assets/ui/font_${k}.png`], tints: {} };
      A.ready = true;
      done();
    }
  });
};

A.chr = function (ch, group, i) {
  const list = A.manifest.chars[ch][group];
  if (!list) return null;
  return A.img[`assets/chars/${ch}/${list[i % list.length]}`];
};
A.chrFrames = function (ch, group) {
  const c = A.manifest.chars[ch];
  const list = (c && c[group]) || [];
  return list.map(f => A.img[`assets/chars/${ch}/${f}`]);
};
A.ui = p => A.img[`assets/ui/${p}.png`];

// wiki-based animation: {frames: [Image], durs: [ms], total}
// falls back through poses so a missing pose never crashes.
A.anim = function (ch, pose) {
  const chAnims = (A.manifest.anims || {})[ch] || {};
  let e = chAnims[pose];
  if (!e) e = chAnims.idle;
  if (!e) return null;
  if (!e._c) {
    e._c = {
      frames: e.frames.map(f => A.img[`assets/anims/${ch}/${f}`]),
      durs: e.durs,
      total: e.durs.reduce((a, b) => a + b, 0),
    };
  }
  return e._c;
};
// frame for elapsed ms; loop or clamp to last frame
A.animFrame = function (an, ms, loop) {
  if (!an) return null;
  let t = loop ? ms % an.total : Math.min(ms, an.total - 1);
  for (let i = 0; i < an.frames.length; i++) {
    t -= an.durs[i];
    if (t < 0) return an.frames[i];
  }
  return an.frames[an.frames.length - 1];
};
A.bgFrame = function (t) {
  const n = Math.floor(A.manifest.bg_frames / 2);
  return A.img[`assets/bg/${(Math.floor(t / 4) % n) * 2}.png`];
};

// hue-rotated copy of an image (pixel-art safe: greys/outlines barely move).
// cached per (src, hue). hue in degrees; 0 returns the original.
A._hueCache = {};
A.hued = function (img, hue) {
  if (!hue || !img || !img.width) return img;
  const key = (img.src || img._k || '?') + '|' + hue;
  if (A._hueCache[key]) return A._hueCache[key];
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  const sh = hue / 60;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) continue;                    // grey: leave outlines alone
    const df = mx - mn;
    const s = l > 0.5 ? df / (2 - mx - mn) : df / (mx + mn);
    let h = mx === r ? ((g - b) / df + (g < b ? 6 : 0)) : mx === g ? (b - r) / df + 2 : (r - g) / df + 4;
    h = (h + sh) % 6; if (h < 0) h += 6;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => {
      t = ((t % 6) + 6) % 6;
      if (t < 1) return p + (q - p) * t;
      if (t < 3) return q;
      if (t < 4) return p + (q - p) * (4 - t);
      return p;
    };
    d[i] = Math.round(f(h + 2) * 255);
    d[i + 1] = Math.round(f(h) * 255);
    d[i + 2] = Math.round(f(h - 2) * 255);
  }
  x.putImageData(id, 0, 0);
  A._hueCache[key] = c;
  return c;
};

// --- bitmap font ---
function tintAtlas(font, color) {
  if (font.tints[color]) return font.tints[color];
  const c = document.createElement('canvas');
  c.width = font.atlas.width; c.height = font.atlas.height;
  const x = c.getContext('2d');
  x.drawImage(font.atlas, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  font.tints[color] = c;
  return c;
}

// draw text; key: 'main' (16px) or 'big' (32px). opts: {color, scale, align}
function drawText(ctx, key, str, x, y, opts) {
  opts = opts || {};
  const font = A.fonts[key];
  if (!font) return;
  const scale = opts.scale || 1;
  const src = opts.color && opts.color !== '#fff' ? tintAtlas(font, opts.color) : font.atlas;
  let w = textWidth(key, str) * scale;
  if (opts.align === 'center') x -= w / 2;
  if (opts.align === 'right') x -= w;
  let cx = x;
  for (const c of str) {
    const g = font.glyphs[c.charCodeAt(0)];
    if (!g) { cx += 6 * scale; continue; }
    ctx.drawImage(src, g.x, 0, g.w, font.h, Math.round(cx), Math.round(y), g.w * scale, font.h * scale);
    cx += (g.w + 1) * scale;
  }
  return cx - x;
}
function textWidth(key, str) {
  const font = A.fonts[key];
  let w = 0;
  for (const c of str) {
    const g = font.glyphs[c.charCodeAt(0)];
    w += g ? g.w + 1 : 6;
  }
  return w;
}

// sprite draw helper (integer pixel snap, optional hflip, scale 2 default)
function drawSpr(ctx, im, x, y, opts) {
  if (!im || !im.width) return;
  opts = opts || {};
  const s = opts.scale != null ? opts.scale : 2;
  const w = im.width * s, h = im.height * s;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (opts.flip) ctx.scale(-1, 1);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.rot) ctx.rotate(opts.rot);
  ctx.drawImage(im, Math.round(-w / 2), Math.round(-h / 2), w, h);
  ctx.restore();
}
