/**
 * sync_sprites.js — copy every sprite the studio can reference into docs/sprites/,
 * then regenerate the manifest and origins to match what was actually copied.
 *
 * Sprites were the visual bottleneck: 425 names were referenced by the presets,
 * GlobalScripts and support objects, but only 211 had art, so the rest drew as
 * placeholder rectangles.
 *
 * Chapter matters twice over. The same sprite name can differ between chapters,
 * and a sprite's ORIGIN must come from the same chapter as its art or it draws
 * offset. So each sprite records which chapter it came from, and origins are read
 * from that chapter's sprites.tsv rather than a merged table.
 *
 *   node scripts/sync_sprites.js            copy + regenerate
 *   node scripts/sync_sprites.js --dry      report what would happen
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXPORT_ROOT = 'C:/Users/lando/Desktop/DELTARUNE - EXPORT';
const REF_ROOT = 'C:/Users/lando/Desktop/DELTARUNE - REF DATA';
const DOCS = path.join(__dirname, '..', 'docs');
const JS = path.join(DOCS, 'js');
const SPRITE_DIR = path.join(DOCS, 'sprites');

const DRY = process.argv.includes('--dry');

/**
 * Which chapter wins when several want the same sprite name. The three bosses the
 * studio previews live in ch2 (Spamton NEO), ch3 (Knight) and ch4 (Gerson);
 * shared UI art is near-identical across chapters, so this order only decides
 * cosmetic ties. Divergences are reported.
 */
const CHAPTER_PRIORITY = ['ch3', 'ch2', 'ch4', 'ch5', 'ch1'];
const CH_NUM = { ch1: 1, ch2: 2, ch3: 3, ch4: 4, ch5: 5 };

// ── sprite name extraction ──────────────────────────────────────────────────
function strip(src) {
  return String(src)
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Sprites referenced by NUMERIC asset index rather than by name.
 *
 * The decompiled dump writes some sprites as the raw integer the compiler
 * assigned: `pinkportrait = 982`, `knight_sprite = 664`. A name-only scan is
 * blind to those, so their art was never synced and they drew as placeholders —
 * every portrait in the dating minigame.
 *
 * Matching bare integers everywhere would drag in thousands of unrelated
 * sprites, so this looks only where a sprite is plausibly being STORED: an
 * assignment whose target reads like a sprite holder. That covers the real
 * pattern in the corpus while staying far away from ordinary arithmetic.
 */
const SPRITE_VAR = /\b([a-zA-Z_]\w*(?:sprite|portrait|_spr|spr_|face|idle|icon|body|image)\w*)\s*=\s*(\d{2,5})\s*;/gi;
function numericSpriteRefs(src, into, indices) {
  if (typeof src !== 'string' || !indices) return;
  const clean = strip(src);
  let m;
  while ((m = SPRITE_VAR.exec(clean))) {
    const idx = Number(m[2]);
    for (const ch of Object.keys(indices)) {
      const name = indices[ch][idx];
      if (name) into.add(name);
    }
  }
  // Also `draw_sprite*(982, ...)` — an index passed straight to a draw call.
  const drawRe = /\bdraw_sprite\w*\s*\(\s*(\d{2,5})\s*,/g;
  while ((m = drawRe.exec(clean))) {
    const idx = Number(m[1]);
    for (const ch of Object.keys(indices)) {
      const name = indices[ch][idx];
      if (name) into.add(name);
    }
  }
}

function spriteRefs(src, into) {
  if (typeof src !== 'string') return;
  const re = /\bspr_[a-zA-Z0-9_]+\b/g;
  let m;
  const clean = strip(src);
  while ((m = re.exec(clean))) into.add(m[0]);
  numericSpriteRefs(src, into, global.__SPRITE_INDICES);
}

// Asset-index -> name table, so numeric sprite references resolve (see above).
{
  const p = path.join(__dirname, '..', 'docs', 'js', 'sprite_indices.js');
  if (fs.existsSync(p)) {
    const sb = { window: {} };
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(p, 'utf8'), sb);
    global.__SPRITE_INDICES = sb.window.GML_SPRITE_INDICES;
  } else {
    console.log('  (no sprite_indices.js — run gen_sprite_indices.js for numeric refs)');
  }
}

// ── load the tables ─────────────────────────────────────────────────────────
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['gml_object_index.js', 'gml_presets.js', 'gml_scripts.js', 'gml_objects.js']) {
  const p = path.join(JS, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
}
const presets = sandbox.window.GML_MASTER_PRESETS || {};
const scriptTable = sandbox.window.GML_SCRIPT_SOURCES_BY_CHAPTER || {};
const objectTable = sandbox.window.GML_OBJECT_EVENTS_BY_CHAPTER || {};
const OI = sandbox.window.GML_OBJECT_INDEX;

function chapterOfPreset(p) {
  const m = /Chapter\s*([1-5])/i.exec(p.label || '');
  return m ? 'ch' + m[1] : 'ch3';
}

/** chapter -> Set(spriteName) */
const wanted = {};
const add = (ch, name) => { (wanted[ch] = wanted[ch] || new Set()).add(name); };

for (const [key, p] of Object.entries(presets)) {
  const ch = chapterOfPreset(p);
  const s = new Set();
  for (const ev of ['create', 'step', 'draw']) spriteRefs(p[ev], s);
  for (const n of s) add(ch, n);
}
for (const [ch, table] of Object.entries(scriptTable)) {
  const s = new Set();
  for (const src of Object.values(table)) spriteRefs(src, s);
  for (const n of s) add(ch, n);
}
for (const [ch, table] of Object.entries(objectTable)) {
  const s = new Set();
  for (const bundle of Object.values(table)) for (const src of Object.values(bundle)) spriteRefs(src, s);
  for (const n of s) add(ch, n);
}

/**
 * Object DEFAULT sprites and masks. These never appear in the GML text — GameMaker
 * applies them before Create runs — yet they're what most instances actually draw.
 * obj_sneo_rotatingwall_bomb's GML only names bomb2/bomb3, but every instance
 * spawns wearing its default spr_mettaton_bomb1, so the wall's bombs were drawing
 * as placeholder squares. Parent chains count too, since defaults inherit.
 */
if (OI) {
  const objectNames = {};
  for (const [key, p] of Object.entries(presets)) {
    const ch = chapterOfPreset(p);
    (objectNames[ch] = objectNames[ch] || new Set()).add(p.name || key);
    // Objects named anywhere in the preset can be spawned by it.
    const src = strip([p.create, p.step, p.draw].filter(s => typeof s === 'string').join('\n'));
    const re = /\b(obj_[a-zA-Z0-9_]+)\b/g;
    let m;
    while ((m = re.exec(src))) objectNames[ch].add(m[1]);
  }
  for (const [ch, table] of Object.entries(objectTable)) {
    const set = (objectNames[ch] = objectNames[ch] || new Set());
    for (const [name, bundle] of Object.entries(table)) {
      set.add(name);
      const src = strip(Object.values(bundle).join('\n'));
      const re = /\b(obj_[a-zA-Z0-9_]+)\b/g;
      let m;
      while ((m = re.exec(src))) set.add(m[1]);
    }
  }
  let defaultSprites = 0;
  for (const [ch, names] of Object.entries(objectNames)) {
    for (const name of names) {
      for (const objName of [name, ...OI.parentChain(name, ch)]) {
        const d = OI.defaults(objName, ch);
        for (const spr of [d.sprite_index, d.mask_index]) {
          if (spr && /^spr_/.test(spr)) { add(ch, spr); defaultSprites++; }
        }
      }
    }
  }
  console.log(`  (+${defaultSprites} object default sprite/mask references)`);
}

/**
 * Sprites the studio and battle engine name directly rather than through GML —
 * the SOUL, the box, the party idles the studio spawns for battle context.
 */
const ENGINE_SPRITES = [
  'spr_heart', 'spr_dodgeheart', 'spr_dodgeheartmask', 'spr_yellowheart',
  'spr_yheart_shot', 'spr_yheart_bigshot', 'spr_yheart_bigshot_trail',
  'spr_yheart_charge', 'spr_yheart_shot_hit3', 'spr_heartbreak',
  'spr_battlebg_0', 'spr_battlebg_stretch_hitbox', 'spr_custom_box',
  'spr_susie_idle', 'spr_ralsei_idle', 'spr_kris_idle',
  'spr_krisb_idle', 'spr_susieb_idle', 'spr_ralseib_idle',
  'spr_sneo_idle', 'spr_gerson_idle', 'spr_roaringknight_idle',
  'spr_whitepixel', 'spr_pxwhite', 'spr_blank_tile_black',
];
for (const n of ENGINE_SPRITES) add('ch3', n);

const allWanted = new Set();
for (const s of Object.values(wanted)) for (const n of s) allWanted.add(n);
console.log(`sprite names referenced: ${allWanted.size}`);

// ── NEW RIP index: full-frame art that beats the trimmed EXPORT ────────────
// The EXPORT PNGs are texture-page trimmed (transparent margins cropped, offset
// unrecorded), which draws those sprites a few pixels off their origin. The
// NEW RIP dump has FULL-FRAME versions for most of them. A NEW RIP file is used
// for a frame exactly when its dimensions equal the chapter's declared frame
// size — that condition is the correctness criterion itself.
const NEWRIP_ROOT = 'C:/Users/lando/Desktop/DeltaVersus/NEW RIP';
const newripIndex = new Map();   // lowercased basename -> [paths]
if (fs.existsSync(NEWRIP_ROOT)) {
  (function walk(d) {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.png$/i.test(e.name)) {
        const k = e.name.toLowerCase();
        if (!newripIndex.has(k)) newripIndex.set(k, []);
        newripIndex.get(k).push(p);
      }
    }
  })(NEWRIP_ROOT);
  console.log(`NEW RIP indexed: ${newripIndex.size} distinct png names`);
}

function pngDims(p) {
  const b = Buffer.alloc(24);
  const fd = fs.openSync(p, 'r');
  fs.readSync(fd, b, 0, 24, 0);
  fs.closeSync(fd);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

/**
 * A better-than-the-export replacement for one frame, or null.
 *
 * Requiring BOTH dimensions to equal the declared frame threw away art that was
 * correct on the axis that mattered. `spr_gerson_swing_down_telegraph` is
 * 80x360 in NEW RIP against a declared 73x360, so the exact test rejected it
 * and kept the export's 68x315 — leaving Gerson's swing telegraph 45px (12.5%)
 * short on the axis the player reads to dodge.
 *
 * So: an exact match still wins outright. Otherwise take a candidate that is
 * strictly closer to the declared frame on BOTH axes than the export is, never
 * further on either. That can only reduce the missing extent, never introduce a
 * new crop — and a candidate LARGER than declared on an axis is rejected,
 * because that is a different asset (or padded), not a better crop of this one.
 */
function newripFullFrame(name, frameIdx, declaredW, declaredH, exportPath) {
  if (!declaredW || !declaredH) return null;
  const cands = newripIndex.get(`${name}_${frameIdx}.png`.toLowerCase()) || [];
  let exp = null;
  if (exportPath) { try { exp = pngDims(exportPath); } catch (e) { /* keep null */ } }

  let best = null, bestMissing = Infinity;
  for (const c of cands) {
    let w, h;
    try { [w, h] = pngDims(c); } catch (e) { continue; }
    if (w === declaredW && h === declaredH) return c;      // exact: done
    if (!exp) continue;
    if (w > declaredW || h > declaredH) continue;          // not a crop of this frame
    const missing = (declaredW - w) + (declaredH - h);
    const expMissing = (declaredW - exp[0]) + (declaredH - exp[1]);
    // Strictly better overall and no worse on either axis.
    if (missing < expMissing && w >= exp[0] && h >= exp[1] && missing < bestMissing) {
      best = c; bestMissing = missing;
    }
  }
  return best;
}

// ── index the export dirs: chapter -> name -> [frame files] ────────────────
const exportIndex = {};
for (const [ch, n] of Object.entries(CH_NUM)) {
  const dir = path.join(EXPORT_ROOT, `DELTARUNE Chapter ${n} - EXPORT`, 'sprites');
  if (!fs.existsSync(dir)) continue;
  const byName = new Map();
  for (const f of fs.readdirSync(dir)) {
    const m = /^(.*)_(\d+)\.png$/i.exec(f);
    if (!m) continue;
    if (!byName.has(m[1])) byName.set(m[1], []);
    byName.get(m[1]).push({ file: f, idx: Number(m[2]) });
  }
  for (const list of byName.values()) list.sort((a, b) => a.idx - b.idx);
  exportIndex[ch] = { dir, byName };
  console.log(`  ${ch}: ${byName.size} sprites available`);
}

// ── origins per chapter, from that chapter's sprites.tsv ───────────────────
const originIndex = {};
for (const [ch, n] of Object.entries(CH_NUM)) {
  const tsv = path.join(REF_ROOT, `DELTARUNE Chapter ${n} - REFDATA`, 'sprites.tsv');
  if (!fs.existsSync(tsv)) continue;
  const map = new Map();
  const lines = fs.readFileSync(tsv, 'utf8').replace(/\r/g, '').split('\n');
  const header = lines[0].split('\t');
  const col = name => header.indexOf(name);
  const iSpr = col('sprite'), iFr = col('frames'), iW = col('width'), iH = col('height');
  const iOX = col('originX'), iOY = col('originY');
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = lines[i].split('\t');
    map.set(c[iSpr], {
      frames: Number(c[iFr]) || 1,
      width: Number(c[iW]) || 0, height: Number(c[iH]) || 0,
      ox: Number(c[iOX]) || 0, oy: Number(c[iOY]) || 0,
    });
  }
  originIndex[ch] = map;
}

// ── resolve each wanted sprite to a chapter ───────────────────────────────
/** name -> { chapter, files: [...], meta } */
const resolved = new Map();
const notFound = [];
const divergent = [];

for (const name of [...allWanted].sort()) {
  // Chapters that reference it, in priority order, then any chapter that has it.
  const requesters = CHAPTER_PRIORITY.filter(ch => wanted[ch] && wanted[ch].has(name));
  const candidates = [...new Set([...requesters, ...CHAPTER_PRIORITY])];

  let picked = null;
  const seenCounts = new Map();
  for (const ch of candidates) {
    const idx = exportIndex[ch];
    if (!idx || !idx.byName.has(name)) continue;
    const files = idx.byName.get(name);
    seenCounts.set(ch, files.length);
    if (!picked) picked = { chapter: ch, files };
  }

  if (!picked) { notFound.push(name); continue; }

  // Flag real divergence between chapters, not just presence.
  const counts = [...new Set(seenCounts.values())];
  if (counts.length > 1) {
    divergent.push(`${name}: ${[...seenCounts.entries()].map(([c, n]) => `${c}=${n}f`).join(' ')} -> using ${picked.chapter}`);
  }

  const meta = (originIndex[picked.chapter] && originIndex[picked.chapter].get(name)) || null;
  resolved.set(name, { chapter: picked.chapter, files: picked.files, meta });
}

console.log(`\nresolved: ${resolved.size}   missing from every export: ${notFound.length}`);
if (notFound.length) {
  console.log('  not in any export (likely runtime-generated or misparsed):');
  for (const n of notFound.slice(0, 25)) console.log('    ' + n);
  if (notFound.length > 25) console.log(`    ... ${notFound.length - 25} more`);
}
if (divergent.length) {
  console.log(`\n${divergent.length} sprites differ in frame count between chapters:`);
  for (const d of divergent.slice(0, 15)) console.log('    ' + d);
  if (divergent.length > 15) console.log(`    ... ${divergent.length - 15} more`);
}

if (DRY) {
  const totalFrames = [...resolved.values()].reduce((a, r) => a + r.files.length, 0);
  console.log(`\n[dry run] would copy ${totalFrames} frames for ${resolved.size} sprites`);
  process.exit(0);
}

// ── copy ──────────────────────────────────────────────────────────────────
if (!fs.existsSync(SPRITE_DIR)) fs.mkdirSync(SPRITE_DIR, { recursive: true });

// Start clean so a sprite never keeps stale frames from another chapter's art.
for (const f of fs.readdirSync(SPRITE_DIR)) {
  if (/\.png$/i.test(f)) fs.unlinkSync(path.join(SPRITE_DIR, f));
}

const manifest = {};
const origins = {};
const frameCounts = {};
const sizes = {};
let copied = 0;
let upgraded = 0;

for (const [name, r] of [...resolved.entries()].sort()) {
  const srcDir = exportIndex[r.chapter].dir;
  const outFiles = [];
  const declared = r.meta ? [r.meta.width, r.meta.height] : null;
  // Re-index frames to a dense 0..N-1 run so getImage()'s modulo indexing lines
  // up with GameMaker's subimage numbers even if the export skipped a number.
  r.files.forEach((f, i) => {
    const outName = `${name}_${i}.png`;
    const exportPath = path.join(srcDir, f.file);
    let src = exportPath;
    if (declared) {
      // Upgrade to full-frame art only when the export copy is trimmed.
      let trimmed = true;
      try { const [w, h] = pngDims(exportPath); trimmed = (w !== declared[0] || h !== declared[1]); } catch (e) {}
      if (trimmed) {
        const full = newripFullFrame(name, f.idx, declared[0], declared[1], exportPath);
        if (full) { src = full; upgraded++; }
      }
    }
    fs.copyFileSync(src, path.join(SPRITE_DIR, outName));
    outFiles.push(outName);
    copied++;
  });
  manifest[name] = outFiles;
  frameCounts[name] = outFiles.length;
  if (r.meta) {
    origins[name] = [r.meta.ox, r.meta.oy];
    sizes[name] = [r.meta.width, r.meta.height];
  } else {
    origins[name] = [0, 0];
  }
}

console.log(`\ncopied ${copied} frames for ${resolved.size} sprites into docs/sprites/`);
console.log(`upgraded ${upgraded} trimmed frames to full-frame NEW RIP art`);

// ── regenerate manifest + origins ─────────────────────────────────────────
fs.writeFileSync(path.join(JS, 'sprite_manifest.js'),
  `/**
 * sprite_manifest.js — GENERATED by scripts/sync_sprites.js. Do not edit.
 * spriteName -> [frame files], dense and in subimage order.
 */
window.GML_SPRITE_MANIFEST = ${JSON.stringify(manifest, null, 0)};
`, 'utf8');

fs.writeFileSync(path.join(JS, 'sprite_origins.js'),
  `/**
 * sprite_origins.js — GENERATED by scripts/sync_sprites.js. Do not edit.
 *
 * Origins come from the SAME chapter as the copied art — a sprite drawn with
 * another chapter's origin sits visibly offset.
 */
window.GML_SPRITE_ORIGINS = ${JSON.stringify(origins, null, 0)};

/** spriteName -> frame count, so image_number matches the real sprite. */
window.GML_SPRITE_FRAMES = ${JSON.stringify(frameCounts, null, 0)};

/** spriteName -> [width, height] as authored, for sprite_get_width/height. */
window.GML_SPRITE_SIZES = ${JSON.stringify(sizes, null, 0)};
`, 'utf8');

console.log('regenerated sprite_manifest.js and sprite_origins.js');

const chapterCounts = {};
for (const r of resolved.values()) chapterCounts[r.chapter] = (chapterCounts[r.chapter] || 0) + 1;
console.log('sprites per source chapter:', JSON.stringify(chapterCounts));
