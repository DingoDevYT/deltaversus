/**
 * audit_trimmed_sprites.js — how much does the trimmed-PNG export gap actually
 * cost us?
 *
 * Known gap #1 in GML_TRANSLATOR_ENGINE.md: the export writes each frame
 * cropped to its opaque pixels and records the crop offset NOWHERE, so a
 * trimmed sprite drawn on its declared origin lands a few pixels off. That has
 * been carried as a vague risk. This turns it into a list.
 *
 * For every sprite the studio actually ships, compare the PNG's real pixel size
 * against the frame size declared in that chapter's sprites.tsv. A sprite whose
 * PNG is SMALLER than its declared frame was trimmed and cannot be placed
 * exactly. Reported worst-first by how many pixels are missing, because a 2px
 * trim on a 200px sword is invisible and a 20px trim on a 24px bullet is not.
 *
 *   node scripts/audit_trimmed_sprites.js
 *   node scripts/audit_trimmed_sprites.js --all   include sprites we don't ship
 */
const fs = require('fs');
const path = require('path');

const REF = 'C:/Users/lando/Desktop/DELTARUNE - REF DATA';
const EXPORT = 'C:/Users/lando/Desktop/DELTARUNE - EXPORT';
const SPRITE_DIR = path.join(__dirname, '..', 'docs', 'sprites');
const CHAPTERS = [1, 2, 3, 4, 5];

/** PNG dimensions straight out of the IHDR chunk — no image library needed. */
function pngSize(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0);
    if (b.readUInt32BE(0) !== 0x89504e47) return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch (e) {}
  }
}

const _declCache = new Map();
function loadDeclaredCached(ch) {
  if (!_declCache.has(ch)) _declCache.set(ch, loadDeclared(ch));
  return _declCache.get(ch);
}

function loadDeclared(ch) {
  const f = path.join(REF, `DELTARUNE Chapter ${ch} - REFDATA`, 'sprites.tsv');
  const out = new Map();
  if (!fs.existsSync(f)) return out;
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split('\t');
    if (c.length < 6) continue;
    out.set(c[0], { frames: +c[1], w: +c[2], h: +c[3], ox: +c[4], oy: +c[5] });
  }
  return out;
}

// Which sprites do we actually ship? Those are the only ones that can hurt.
const shipped = new Set();
if (fs.existsSync(SPRITE_DIR)) {
  for (const f of fs.readdirSync(SPRITE_DIR)) {
    const m = /^(.+?)_(\d+)\.png$/.exec(f);
    if (m) shipped.add(m[1]);
  }
}
const all = process.argv.includes('--all');

// ── what the studio ACTUALLY ships ─────────────────────────────────────────
//
// The export dumps are not what runs. `sync_sprites.js` already upgrades a
// frame to NEW RIP art when its dimensions match the declared frame, so
// auditing the export measures a problem that may already be fixed on disk.
// This is the number that matters: of the PNGs in docs/sprites, how many are
// still smaller than the frame the game declares?
{
  const declaredAny = new Map();      // sprite -> declared size, any chapter
  for (const ch of CHAPTERS) {
    for (const [n, d] of loadDeclaredCached(ch)) if (!declaredAny.has(n)) declaredAny.set(n, d);
  }
  let ship = 0, shipExact = 0, shipTrim = 0, shipTrimBig = 0;
  const worst = [];
  for (const f of (fs.existsSync(SPRITE_DIR) ? fs.readdirSync(SPRITE_DIR) : [])) {
    const m = /^(.+?)_(\d+)\.png$/.exec(f);
    if (!m) continue;
    const dec = declaredAny.get(m[1]);
    if (!dec || !dec.w || !dec.h) continue;
    const s = pngSize(path.join(SPRITE_DIR, f));
    if (!s) continue;
    if (s.w <= 2 && s.h <= 2) continue;      // blank frame, carries no art
    ship++;
    const dx = dec.w - s.w, dy = dec.h - s.h;
    if (dx <= 0 && dy <= 0) { shipExact++; continue; }
    shipTrim++;
    if (Math.max(dx, dy) > 8) shipTrimBig++;
    worst.push({ f, declared: dec.w + 'x' + dec.h, got: s.w + 'x' + s.h, off: Math.max(dx, dy) });
  }
  worst.sort((a, b) => b.off - a.off);
  console.log('── SHIPPED art (docs/sprites — what actually runs) ──');
  console.log(`  frames checked:            ${ship}`);
  console.log(`  exact (full declared frame): ${shipExact}  (${(100 * shipExact / Math.max(1, ship)).toFixed(1)}%)`);
  console.log(`  still trimmed:               ${shipTrim}`);
  console.log(`  trimmed by more than 8px:    ${shipTrimBig}`);
  console.log('  worst 15 still-trimmed frames:');
  for (const w of worst.slice(0, 15)) {
    console.log(`    ${w.f.padEnd(48)} declared ${w.declared.padEnd(10)} shipped ${w.got.padEnd(10)} off by ${w.off}px`);
  }
  // The only trims that matter for this project are the ones on art an ATTACK
  // draws. Overworld and minigame sprites can be off by 300px without anyone
  // noticing, because the studio never renders them.
  // How many trimmed frames have their origin at the exact CENTRE of the
  // declared frame? Those are the ones the draw path places visibly wrong:
  // `ctx.drawImage(img, -ox, -oy)` anchors the trimmed bitmap's top-left on the
  // full-frame origin, so a sprite meant to be centred lands up-left by half
  // the trim. spr_donut_bullet is declared 48x50 with origin (24,25) and ships
  // as a complete 24x25 donut — it renders a full half-sprite off.
  let centreOrigin = 0;
  const centreRows = [];
  for (const w of worst) {
    const m = /^(.+?)_(\d+)\.png$/.exec(w.f);
    const dec = m && declaredAny.get(m[1]);
    if (!dec) continue;
    if (Math.abs(dec.ox - dec.w / 2) <= 1 && Math.abs(dec.oy - dec.h / 2) <= 1 && (dec.ox || dec.oy)) {
      centreOrigin++;
      if (centreRows.length < 12) centreRows.push(`${w.f} declared ${w.declared} origin ${dec.ox},${dec.oy} shipped ${w.got}`);
    }
  }
  console.log(`\n  of the still-trimmed, CENTRE-ORIGIN (drawn visibly off): ${centreOrigin}`);
  for (const c of centreRows) console.log('    ' + c);

  const ATTACK_ART = /knight|sneo|spamton|gerson|hammer|jevil|joker|pink|doki|date|bullet|spear|sword|crescent|star|pipis|heart|soul|growtangle|battlebg|bomb|laser|scythe|diamond/i;
  const attackTrims = worst.filter(w => ATTACK_ART.test(w.f));
  console.log(`\n  of those, drawn by ATTACKS: ${attackTrims.length}` +
              (attackTrims.length ? ' (worst 20 below)' : ' — none, so this gap does not affect attack fidelity'));
  for (const w of attackTrims.slice(0, 20)) {
    console.log(`    ${w.f.padEnd(48)} declared ${w.declared.padEnd(10)} shipped ${w.got.padEnd(10)} off by ${w.off}px`);
  }
  console.log('');
}

const rows = [];
let checked = 0, exact = 0;

for (const ch of CHAPTERS) {
  const declared = loadDeclared(ch);
  const dir = path.join(EXPORT, `DELTARUNE Chapter ${ch} - EXPORT`, 'sprites');
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir);
  // Group the flat `NAME_frame.png` dump by sprite.
  const byName = new Map();
  for (const f of files) {
    const m = /^(.+)_(\d+)\.png$/.exec(f);
    if (!m) continue;
    if (!byName.has(m[1])) byName.set(m[1], []);
    byName.get(m[1]).push(f);
  }
  for (const [name, frames] of byName) {
    if (!all && !shipped.has(name)) continue;
    const dec = declared.get(name);
    if (!dec || !dec.w || !dec.h) continue;
    let worstDx = 0, worstDy = 0, varies = false, firstKey = null, real = 0;
    for (const f of frames) {
      const s = pngSize(path.join(dir, f));
      if (!s) continue;
      // A fully transparent frame trims to 1x1. Those are real frames of the
      // animation (blink gaps, flash off-frames) but they carry no art, so
      // they cannot be "placed wrong" — counting them made every sprite with
      // one blank frame report 99% missing and buried the actual offenders.
      if (s.w <= 2 && s.h <= 2) continue;
      real++;
      const dx = dec.w - s.w, dy = dec.h - s.h;
      const key = s.w + 'x' + s.h;
      if (firstKey === null) firstKey = key; else if (key !== firstKey) varies = true;
      if (dx > worstDx) worstDx = dx;
      if (dy > worstDy) worstDy = dy;
    }
    if (!real) continue;
    checked++;
    if (worstDx <= 0 && worstDy <= 0) { exact++; continue; }
    // Worst-case placement error is half the missing extent per axis when the
    // trim is symmetric, the full amount when it is all on one side.
    rows.push({
      ch, name, declared: dec.w + 'x' + dec.h, missing: worstDx + 'x' + worstDy,
      frames: frames.length, varies,
      severity: Math.max(worstDx / dec.w, worstDy / dec.h),
      pixels: Math.max(worstDx, worstDy),
    });
  }
}

rows.sort((a, b) => b.severity - a.severity);

// ── recovery: is there a full-frame copy of this art somewhere else? ────────
//
// Two sources can rescue a trimmed sprite EXACTLY, with no guessing about
// where the crop sat:
//   1. NEW RIP — a separate, mostly-untrimmed dump (35k PNGs, nested folders).
//   2. Another chapter's export — the same sprite is often shipped untrimmed
//      in a chapter that uses it differently.
// Anything neither source covers genuinely needs a re-export.
const newRipIndex = new Map();          // "spr_name_0.png" -> absolute path
(function indexNewRip(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) indexNewRip(p);
    else if (e.name.toLowerCase().endsWith('.png') && !newRipIndex.has(e.name)) newRipIndex.set(e.name, p);
  }
})(path.join(__dirname, '..', 'NEW RIP'));

let viaNewRip = 0, viaOtherChapter = 0, unrecoverable = 0;
const unrecoverableRows = [];
for (const r of rows) {
  const dec = loadDeclaredCached(r.ch).get(r.name);
  if (!dec) continue;
  const frame0 = `${r.name}_0.png`;

  const rip = newRipIndex.get(frame0);
  if (rip) {
    const s = pngSize(rip);
    if (s && s.w === dec.w && s.h === dec.h) { viaNewRip++; continue; }
  }
  let found = false;
  for (const other of CHAPTERS) {
    if (other === r.ch) continue;
    const od = loadDeclaredCached(other).get(r.name);
    if (!od || od.w !== dec.w || od.h !== dec.h) continue;
    const s = pngSize(path.join(EXPORT, `DELTARUNE Chapter ${other} - EXPORT`, 'sprites', frame0));
    if (s && s.w === dec.w && s.h === dec.h) { found = true; break; }
  }
  if (found) { viaOtherChapter++; continue; }
  unrecoverable++;
  if (unrecoverableRows.length < 25) unrecoverableRows.push(r);
}

console.log(`sprites shipped by the studio: ${shipped.size}`);
console.log(`checked against sprites.tsv:   ${checked}`);
console.log(`exact (full declared frame):   ${exact}`);
console.log(`TRIMMED (placement uncertain): ${rows.length}`);
console.log(`  of those, multi-frame with VARYING trim: ${rows.filter(r => r.varies).length}`);
console.log(`  trimmed by more than 8px:               ${rows.filter(r => r.pixels > 8).length}`);
console.log('\n── recovery (exact, no guessing where the crop sat) ──');
console.log(`  full-frame copy in NEW RIP:        ${viaNewRip}`);
console.log(`  full-frame in another chapter:     ${viaOtherChapter}`);
console.log(`  NEITHER — needs a re-export:       ${unrecoverable}`);

console.log('\n── worst 25 that nothing can currently fix ──');
for (const r of unrecoverableRows) {
  console.log(
    `  ch${r.ch} ${r.name.padEnd(42)} declared ${r.declared.padEnd(10)} missing ${r.missing.padEnd(9)}` +
    ` ${(r.severity * 100).toFixed(0)}%${r.varies ? '  VARIES/frame' : ''}`
  );
}
