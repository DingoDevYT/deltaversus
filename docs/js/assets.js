// Asset loading + bitmap font rendering.
const A = {
  img: {},        // path -> Image
  manifest: null,
  fonts: {},      // key -> {h, glyphs, atlas Image, tints: {color: canvas}}
  ready: false,
};

A.load = function (done) {
  fetch('assets/manifest.json').then(r => r.json()).then(man => {
    A.manifest = man;
    const paths = [];
    for (const ch in man.chars)
      for (const g in man.chars[ch])
        for (const f of man.chars[ch][g]) paths.push(`assets/chars/${ch}/${f}`);
    for (const b of ['fight', 'act', 'item', 'spare', 'defend', 'magic'])
      paths.push(`assets/ui/btn_${b}.png`, `assets/ui/btn_${b}_sel.png`);
    paths.push('assets/ui/soul.png');
    for (const ch of ['kris', 'susie', 'ralsei', 'noelle', 'lancer'])
      paths.push(`assets/ui/head_${ch}.png`, `assets/ui/head_${ch}_gray.png`);
    for (const k in man.fonts) paths.push(`assets/ui/font_${k}.png`);
    // background: load every 2nd frame (50 is plenty smooth)
    for (let i = 0; i < man.bg_frames; i += 2) paths.push(`assets/bg/${i}.png`);
    let n = paths.length;
    for (const p of paths) {
      const im = new Image();
      im.onload = im.onerror = () => { if (--n === 0) finish(); };
      im.src = p;
      A.img[p] = im;
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
  const list = A.manifest.chars[ch][group] || [];
  return list.map(f => A.img[`assets/chars/${ch}/${f}`]);
};
A.ui = p => A.img[`assets/ui/${p}.png`];
A.bgFrame = function (t) {
  const n = Math.floor(A.manifest.bg_frames / 2);
  return A.img[`assets/bg/${(Math.floor(t / 4) % n) * 2}.png`];
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
