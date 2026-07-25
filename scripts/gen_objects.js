/**
 * gen_objects.js — extract object event code for everything the presets touch.
 *
 * The studio only ever knew the 154 hand-picked preset objects. Everything they
 * spawned — obj_knight_warp, obj_afterimage_cut, obj_yshot_anim,
 * obj_script_delayed — fell back to a bare GMLInstance with no events, so those
 * instances never animated, never moved, and never destroyed themselves. (An
 * attack that spawns one per frame then leaks thousands of them.)
 *
 * Walks obj_* references transitively from the presets and the extracted
 * GlobalScripts, and writes every event body per chapter to docs/js/gml_objects.js.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GML_ROOT = 'C:/Users/lando/Desktop/DELTARUNE - GML';
const DOCS_JS = path.join(__dirname, '..', 'docs', 'js');
const OUT = path.join(DOCS_JS, 'gml_objects.js');

const CHAPTERS = { ch1: 1, ch2: 2, ch3: 3, ch4: 4, ch5: 5 };

/**
 * Decompiled event filename suffix -> the events key GMLTranslator understands.
 *
 * GameMaker's draw slots are numbered, not named: Draw_0 is the normal Draw,
 * Draw_72 is Draw BEGIN and Draw_73 is Draw END. Only Draw_0 used to be
 * extracted, so 42 objects across ch2-ch5 silently lost draw code the game
 * depends on — obj_darkness_overlay sets its depth every frame in Draw Begin
 * (without it the darkness sorts wrong), and the Knight's roar spawns
 * obj_afterimage_screen with draw_end = true, so it draws in Draw End or not at
 * all. The runtime already had a drawEnd pass and eventPerform already mapped
 * 72/73; they were dead code because nothing was ever extracted into them.
 */
function eventKeyFor(suffix) {
  if (suffix === 'Create_0') return 'create';
  if (suffix === 'Destroy_0') return 'destroy';
  if (suffix === 'CleanUp_0') return 'cleanup';
  if (suffix === 'Step_0') return 'step';
  if (suffix === 'Step_1') return 'step_begin';
  if (suffix === 'Step_2') return 'step_end';
  if (suffix === 'Draw_0') return 'draw';
  if (suffix === 'Draw_72') return 'draw_begin';
  if (suffix === 'Draw_73') return 'draw_end';
  let m = /^Alarm_(\d+)$/.exec(suffix);
  if (m && +m[1] < 12) return `alarm_${m[1]}`;
  // Other_0 = Outside Room (how most bullets clean themselves up),
  // Other_7 = Animation End (how most VFX destroy themselves).
  if (suffix === 'Other_0') return 'other_0';
  if (suffix === 'Other_7') return 'other_7';
  m = /^Other_(\d+)$/.exec(suffix);
  if (m && +m[1] >= 10 && +m[1] <= 25) return `other_${m[1]}`;
  return null;
}

// ── index every object's events, per chapter ────────────────────────────────
const byChapter = {};
for (const [key, n] of Object.entries(CHAPTERS)) {
  const dir = path.join(GML_ROOT, `DELTARUNE Chapter ${n} - GML`);
  if (!fs.existsSync(dir)) continue;
  const objects = new Map();   // objName -> { eventKey: filePath }
  for (const f of fs.readdirSync(dir)) {
    // Collision events name the OTHER OBJECT, not a numeric subtype — the
    // generic pattern below can't match them. They're how the yellow-soul
    // shots interact with shootable bullets (obj_sneo_wallbullet_new has
    // Collision_obj_yheart_shot), so they must be extracted.
    const cm = /^gml_Object_(.+?)_Collision_(.+)\.gml$/.exec(f);
    if (cm) {
      if (!objects.has(cm[1])) objects.set(cm[1], {});
      objects.get(cm[1])['collision:' + cm[2]] = path.join(dir, f);
      continue;
    }
    const m = /^gml_Object_(.+?)_([A-Za-z]+_\d+)\.gml$/.exec(f);
    if (!m) continue;
    const evKey = eventKeyFor(m[2]);
    if (!evKey) continue;
    if (!objects.has(m[1])) objects.set(m[1], {});
    objects.get(m[1])[evKey] = path.join(dir, f);
  }
  byChapter[key] = objects;
  console.log(`${key}: ${objects.size} objects with event code`);
}

function strip(src) {
  return src
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/** obj_* names referenced in a chunk of GML. */
function objectRefs(src) {
  const out = new Set();
  const re = /\b(obj_[a-zA-Z0-9_]+|o_[a-zA-Z0-9_]+)\b/g;
  let m;
  const clean = strip(src);
  while ((m = re.exec(clean))) out.add(m[1]);
  return out;
}

// ── roots: the presets, plus the scripts we already extracted ──────────────
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(DOCS_JS, 'gml_presets.js'), 'utf8'), sandbox);
let scriptTable = {};
if (fs.existsSync(path.join(DOCS_JS, 'gml_scripts.js'))) {
  vm.runInContext(fs.readFileSync(path.join(DOCS_JS, 'gml_scripts.js'), 'utf8'), sandbox);
  scriptTable = sandbox.window.GML_SCRIPT_SOURCES_BY_CHAPTER || {};
}
const presets = sandbox.window.GML_MASTER_PRESETS;

function chapterOf(p) {
  const m = /Chapter\s*([1-5])/i.exec(p.label || '');
  return m ? 'ch' + m[1] : 'ch3';
}

const roots = {};
const presetNames = new Set();
for (const [key, p] of Object.entries(presets)) {
  const ch = chapterOf(p);
  roots[ch] = roots[ch] || new Set();
  presetNames.add(p.name || key);
  roots[ch].add(p.name || key);
  for (const ev of ['create', 'step', 'draw']) {
    if (typeof p[ev] === 'string') for (const n of objectRefs(p[ev])) roots[ch].add(n);
  }
}
// Attack controllers and boss objects are roots in every chapter they belong to.
{
  const attacksFile = path.join(DOCS_JS, 'gml_attacks.js');
  if (fs.existsSync(attacksFile)) {
    const sb3 = { window: {} };
    vm.createContext(sb3);
    vm.runInContext(fs.readFileSync(attacksFile, 'utf8'), sb3);
    for (const a of sb3.window.GML_ATTACKS || []) {
      const ch = a.chapter || 'ch3';
      roots[ch] = roots[ch] || new Set();
      if (a.controller) roots[ch].add(a.controller);
      if (a.enemy) roots[ch].add(a.enemy);
    }
  }
}
for (const [ch, table] of Object.entries(scriptTable)) {
  roots[ch] = roots[ch] || new Set();
  for (const src of Object.values(table)) for (const n of objectRefs(src)) roots[ch].add(n);
}

// Player-side soul objects. The studio spawns these for the yellow-soul mode
// (Spamton NEO); nothing in the boss code creates them, so they'd never be
// reached by the walk.
//
// The TURN SYSTEM is here for the same reason and matters more: no attack
// mentions obj_battlecontroller by name, yet its Step is the ONLY thing in the
// game that counts global.turntimer down, and obj_darkener's Draw is what closes
// the battle box when it reaches zero. Without them an attack has no clock and
// literally cannot end. obj_bulletparent / obj_bulletgenparent are the two root
// parents the teardown reaps, so they must exist for the parent chain to resolve.
for (const ch of Object.keys(roots)) {
  for (const n of ['obj_yheart_shot', 'obj_yshot_anim', 'obj_yheart_shot_hit',
    'obj_battlecontroller', 'obj_darkener', 'obj_returnheart', 'obj_moveheart',
    'obj_bulletparent', 'obj_bulletgenparent', 'obj_heart', 'obj_grazebox',
    'obj_whiteedge']) roots[ch].add(n);
}

// Gerson's green-soul system. The spear chart machine spawns these; several
// (obj_spearshot 32KB, obj_giant_hammer 20KB) are over the incidental-object
// size cap, so they must be both rooted and cap-exempt.
const GREEN_SYSTEM = [
  'obj_spearshot', 'obj_follow_spear', 'obj_spearblocker', 'obj_spearblocker_piece',
  'obj_gerson_growtangle', 'obj_gerson_growtangle_hit_fx', 'obj_gerson_growtangle_telegraph',
  'obj_gerson_growtangle_telegraph_new', 'obj_gerson_growtangle_transform',
  'obj_giant_hammer', 'obj_gerson_green_switch', 'obj_gerson_green_chevron',
  'obj_green_heart_particle', 'obj_just_text', 'obj_gerson_teleport',
];
if (roots.ch4) for (const n of GREEN_SYSTEM) roots.ch4.add(n);

// Pink's purple-soul system (ch5). obj_purplecontrols is the grid-lane movement
// controller type 199 spawns; the rest are its attack/FX satellites.
const PURPLE_SYSTEM = [
  'obj_purplecontrols', 'obj_pink_battlemovement', 'obj_purple_aim_attack',
  'obj_fx_purpleripple', 'obj_bullet_foxtrot', 'obj_trashy_beam',
  'obj_orangeheart_square', 'obj_orangeheart_wall', 'obj_orangeheart_wallflower',
  'obj_orangeheart_word_manager', 'obj_orangeheart_bullet_word',
  'obj_orangeheart_helpful_flower',
];
if (roots.ch5) for (const n of PURPLE_SYSTEM) roots.ch5.add(n);

/**
 * Objects big enough to dominate the payload without helping: the boss objects
 * themselves. Their attack controllers are already presets, and their own Step
 * events are thousands of lines of phase/dialogue sequencing that the studio
 * deliberately disables anyway (it nulls out boss.step).
 */
const SKIP = new Set([
  'obj_battlecontroller', 'obj_gamecontroller', 'obj_writer', 'obj_tensionbar',
  'obj_darkener', 'obj_face', 'obj_spellphase', 'obj_dmgwriter', 'obj_enemyblcon',
]);
const MAX_EVENT_BYTES = 256 * 1024;   // obj_purplecontrols (the purple soul) is 121KB

/**
 * The attack controllers are the whole point — every attack's logic lives inside
 * one of them, selected by `.type`. They're also the biggest objects in the game
 * (obj_dbulletcontroller's Step alone is ~3000 lines), so the size cap was
 * excluding exactly the code we most need. Never cap or skip these, and never
 * cap the boss objects whose Create sets up the fight.
 */
const ALWAYS_INCLUDE = new Set();
{
  const attacksFile = path.join(DOCS_JS, 'gml_attacks.js');
  if (fs.existsSync(attacksFile)) {
    const sb2 = { window: {} };
    vm.createContext(sb2);
    vm.runInContext(fs.readFileSync(attacksFile, 'utf8'), sb2);
    for (const a of sb2.window.GML_ATTACKS || []) {
      if (a.controller) ALWAYS_INCLUDE.add(a.controller);
      if (a.enemy) ALWAYS_INCLUDE.add(a.enemy);
    }
  }
  // Soul-mode systems are integral to their fights, whatever their size
  // (obj_purplecontrols alone is 121KB).
  for (const n of GREEN_SYSTEM) ALWAYS_INCLUDE.add(n);
  for (const n of PURPLE_SYSTEM) ALWAYS_INCLUDE.add(n);
  // The TURN system. No attack references these by name, so the reference walk
  // never reached them — yet obj_battlecontroller's Step is the ONLY thing in
  // the game that counts global.turntimer down, and obj_darkener's Draw is what
  // closes the battle box when it hits zero. Without them an attack has no clock
  // and can never end.
  for (const n of ['obj_battlecontroller', 'obj_darkener', 'obj_returnheart',
    'obj_bulletparent', 'obj_bulletgenparent', 'obj_heart', 'obj_moveheart',
    'obj_grazebox', 'obj_whiteedge']) ALWAYS_INCLUDE.add(n);
}

const collected = {};
const dropped = new Map();
let totalBytes = 0;

for (const [ch, wanted] of Object.entries(roots)) {
  const table = byChapter[ch];
  if (!table) continue;
  const out = {};
  // Breadth-limited: an object two hops from an attack is still plausibly part
  // of that attack. Beyond that the closure wanders into unrelated overworld
  // code (obj_climb_kris, o_boxingqueen) via generic shared scripts.
  const MAX_DEPTH = 3;   // 2 left Pink (ch5) missing satellite objects
  const queue = [...wanted].map(n => [n, 0]);
  const seen = new Set();

  while (queue.length) {
    const [name, depth] = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const exempt = ALWAYS_INCLUDE.has(name);
    // Extract EVERYTHING, including preset-named objects. The preset table is a
    // hand-assembled create/step/draw subset — it has no alarms, no user
    // events, no Animation End, no Outside Room, no Destroy — so letting it
    // shadow the extraction meant those objects ran with most of their
    // behaviour missing (e.g. obj_sneo_wallbullet_new's event_user(0) handler
    // lives in Other_10, which the preset simply doesn't have).
    if (!exempt && SKIP.has(name)) { dropped.set(name, 'system object'); continue; }
    const events = table.get(name);
    if (!events) continue;

    const bundle = {};
    let size = 0;
    for (const [evKey, file] of Object.entries(events)) {
      const src = fs.readFileSync(file, 'utf8');
      size += src.length;
      bundle[evKey] = src;
    }
    if (!exempt && size > MAX_EVENT_BYTES) { dropped.set(name, `${(size / 1024).toFixed(1)}KB over cap`); continue; }

    out[name] = bundle;
    totalBytes += size;
    if (depth < MAX_DEPTH) {
      for (const src of Object.values(bundle)) {
        for (const n of objectRefs(src)) if (!seen.has(n)) queue.push([n, depth + 1]);
      }
    }
    // A collision partner is part of this object's behaviour even when its name
    // never appears in the code (it only appears in the event FILENAME).
    for (const k of Object.keys(bundle)) {
      if (k.startsWith('collision:') && !seen.has(k.slice(10))) queue.push([k.slice(10), depth + 1]);
    }
  }

  collected[ch] = out;
  console.log(`${ch}: ${Object.keys(out).length} support objects extracted`);
}

let src = `/**
 * gml_objects.js — GENERATED by scripts/gen_objects.js. Do not edit.
 *
 * Event code for the support objects the attack presets spawn, per chapter:
 *   { objName: { create, step, draw, alarm_0.., other_10.., destroy } }
 *
 * Without these, anything an attack spawns (warps, afterimages, hit sparks,
 * delayed-script carriers) becomes an inert GMLInstance that never animates and
 * never destroys itself.
 */
window.GML_OBJECT_EVENTS_BY_CHAPTER = {
`;
for (const [ch, table] of Object.entries(collected)) {
  src += `  ${ch}: {\n`;
  for (const [name, bundle] of Object.entries(table)) {
    src += `    ${JSON.stringify(name)}: ${JSON.stringify(bundle)},\n`;
  }
  src += `  },\n`;
}
src += `};
`;

fs.writeFileSync(OUT, src, 'utf8');
console.log(`\nwrote ${OUT} (${(src.length / 1024).toFixed(1)} KB, ${(totalBytes / 1024).toFixed(1)} KB of GML)`);

if (dropped.size) {
  console.log(`\nskipped ${dropped.size} objects:`);
  for (const [n, why] of [...dropped.entries()].sort()) console.log(`  ${n} — ${why}`);
}
