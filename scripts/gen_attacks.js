/**
 * gen_attacks.js — derive the REAL attack roster from the boss dispatchers.
 *
 * The existing preset list is a flat pile of objects — attack controllers, bullet
 * objects, VFX helpers and support objects all mixed together — which is not what
 * an "attack" is in this game. Each boss dispatches attacks differently:
 *
 *   Knight (ch3)      20 attacks. `obj_knight_enemy` Step maps
 *                     `myattackchoice == N` to a named attack and spawns
 *                     obj_dbulletcontroller with `.type = M`. ALL the attack
 *                     logic lives in that one controller's `type == M` branch.
 *
 *   Spamton NEO (ch2) 13 attacks, same shape but mostly through
 *                     obj_sneo_bulletcontroller (plus obj_dbulletcontroller and
 *                     obj_sneo_phonecall).
 *
 *   Gerson (ch4)      standalone controller objects, launched from
 *                     scr_spearshot's arg3 dispatch rather than a type field.
 *
 * So an attack is (controller object + optional type), not "an object". Spawning
 * the controller and setting its type runs the real code path, which is why this
 * is more faithful than extracting code fragments.
 *
 * Writes docs/js/gml_attacks.js.
 */

const fs = require('fs');
const path = require('path');

const GML_ROOT = 'C:/Users/lando/Desktop/DELTARUNE - GML';
const OUT = path.join(__dirname, '..', 'docs', 'js', 'gml_attacks.js');

/** Bosses whose rosters we extract, and the object that dispatches for them. */
const BOSSES = [
  { id: 'knight', chapter: 'ch3', chNum: 3, label: 'The Roaring Knight',
    enemy: 'obj_knight_enemy',
    // The boss Step's box-setup block: creates obj_growtangle and sizes it per
    // myattackchoice. Replayed verbatim in the studio before the dispatcher.
    boxBlock: { file: 'gml_Object_obj_knight_enemy_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))' },
    // The TURN LENGTH lives in its own if/else chain, AFTER the dispatcher
    // branch and outside it — so slicing the `monsterattackname` branch misses
    // it entirely and every Knight attack fell back to the studio's 90-frame
    // floor. That is not merely "short": type 98 does `global.turntimer += 30`
    // and then `if (global.turntimer <= endtimer + 1) init = 3`, so 90+30=120
    // vs endtimer 120 tripped the terminate check on frame ONE and Stars never
    // spawned a single star. Replayed like the box block, self-selecting on
    // myattackchoice/difficulty.
    turnBlock: { file: 'gml_Object_obj_knight_enemy_Step_0.gml',
                 anchor: 'if (myattackchoice == 7)' } },
  { id: 'spamton_neo', chapter: 'ch2', chNum: 2, label: 'Spamton NEO',
    enemy: 'obj_spamton_neo_enemy',
    boxBlock: { file: 'gml_Object_obj_spamton_neo_enemy_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))' },
    // Spamton NEO's turn length is a flat default followed by per-rr overrides,
    // ending at `turns += 1`. Note scr_turntimer only RAISES
    // (`if (global.turntimer < arg0) global.turntimer = arg0`), so the
    // `if (rr == 5) scr_turntimer(90)` after the 260 default is a NO-OP and
    // that attack really does get 260 — replaying the block verbatim is the
    // only way to get that right without re-deriving it.
    turnBlock: { file: 'gml_Object_obj_spamton_neo_enemy_Step_0.gml',
                 anchor: 'scr_turntimer(260);',
                 endAnchor: 'turns += 1;' } },
  { id: 'gerson', chapter: 'ch4', chNum: 4, label: 'Gerson / Hammer of Justice',
    enemy: 'obj_hammer_of_justice_enemy',
    // Gerson: plain camera-center box, then a with-block applies boxoffset.
    // The sizing statements FOLLOW the creation if, so slice to an end anchor.
    boxBlock: { file: 'gml_Object_obj_hammer_of_justice_enemy_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))',
                endAnchor: 'with (obj_battlecontroller)' },
    // Gerson's controller attacks are dispatched by scr_spearshot's arg3.
    dispatchScript: 'scr_spearshot',
    // His GREEN-SOUL attacks are data charts: Other_10 (event_user(0)) fills
    // list_attack*[] per `attackpattern == N`, and the boss Step's attackcon
    // machine plays the chart through scr_spearshot. Each pattern id is an
    // attack; launching means running the BOSS itself, not a controller.
    greenEvent: 'gml_Object_obj_hammer_of_justice_enemy_Other_10.gml' },
  { id: 'jevil', chapter: 'ch1', chNum: 1, label: 'Jevil',
    enemy: 'obj_joker',
    // Ch1 predates monsterattackname. obj_joker's Other_15 dispatches
    // `jattack == N` -> obj_dbulletcontroller.type — same model, older dialect.
    selectorScan: { file: 'gml_Object_obj_joker_Other_15.gml', varName: 'jattack' },
    // Other_15 ends with: with (obj_dbulletcontroller) joker = 1; — the ch1
    // controller gates its whole Jevil section on that flag.
    controllerSet: { joker: 1 },
    // Ch1 predates maxxscale: the box is created once at (viewX+320, viewY+170)
    // and always grows to a fixed 2x. Jevil's finale floods the SCREEN with
    // spades from the view edges; the box itself never resizes.
    boxBlock: { file: 'gml_Object_obj_joker_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))' },
    // Jevil sets one flat turn length for every attack with a DIRECT
    // `global.turntimer = 240;` (obj_joker_Step_0.gml:267) rather than through
    // scr_turntimer. Sliced to the assignment ALONE: the enclosing
    // `if (rtimer == 12)` block continues into `event_user(5)` — his own attack
    // chooser — plus `rr = choose(...)` and the battle message, and replaying
    // any of that would override the roster's pick with a random attack. Same
    // trap the notes record for the Knight's event_user(0) in the box block.
    turnBlock: { file: 'gml_Object_obj_joker_Step_0.gml',
                 anchor: 'global.turntimer = 240;',
                 endAnchor: 'event_user(5);' } },
  { id: 'pink', chapter: 'ch5', chNum: 5, label: 'Pink',
    enemy: 'obj_pink_enemy',
    // Pink's default box + obj_purplecontrols spawn live in an if/else on
    // myattackchoice: choices 2-6 do their OWN box setup inside their
    // dispatcher branches (captured per-attack as `setup`), everything else
    // gets the default box and purple controls here.
    boxBlock: { file: 'gml_Object_obj_pink_enemy_Step_0.gml',
                anchor: 'if (myattackchoice == 2 || myattackchoice == 3 || myattackchoice == 4 || myattackchoice == 5 || myattackchoice == 6)',
                ifElse: true },
    // Pink's DATING MINIGAME is a turn REPLACEMENT, not a bullet attack: when
    // `doki >= dokimax` her dispatcher does `datecount++` and creates
    // obj_date_controller, which then reads obj_pink_enemy.datecount to decide
    // which of the four dates to run. There is no `.type` and no selector, so
    // it can't be found by scanning for monsterattackname — it's declared here.
    dates: [
      { n: 1, name: 'date 1 — "a date!?" (4 boxes, UP to confirm)' },
      { n: 2, name: 'date 2 — split in two, 3 of 12 questions' },
      { n: 3, name: 'date 3 — scripted, ends in the FINAL ATTACK' },
      { n: 4, name: 'date 4 — the confession, 3 questions' },
    ],
    // The tenth bullet attack ("pink final attack", type 210 — the purple
    // node-maze) is announced inside obj_date_controller, not in Pink's Step,
    // so the announcement scan has to look there too.
    extraAttackFiles: ['gml_Object_obj_date_controller_Step_0.gml'] },
];

// ── Roster configs contributed as DATA ─────────────────────────────────────
//
// Everything above is a boss whose config was hand-derived. scripts/rosters/
// holds the same thing as JSON, one file per fight, each written alongside a
// .md showing the chooser-to-roster derivation. Adding a fight is therefore a
// data change, not a code change: drop in <id>.json and it appears here.
//
// Each file supplies the BOSSES fields (enemy, boxBlock, turnBlock,
// selectorScan, extraAttackFiles, controllerSet, monsterType) plus `real` and
// `cut` lists, which become that boss's REAL filter below.
const ROSTER_DIR = path.join(__dirname, 'rosters');
const rosterConfigs = [];
if (fs.existsSync(ROSTER_DIR)) {
  for (const f of fs.readdirSync(ROSTER_DIR).filter(x => x.endsWith('.json')).sort()) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(ROSTER_DIR, f), 'utf8')); }
    catch (e) { console.warn(`[rosters] ${f}: unreadable — ${e.message}`); continue; }
    if (!j || !j.id || !j.enemy) { console.warn(`[rosters] ${f}: missing id/enemy`); continue; }
    // A fight with no real attacks is documented, not listed: C. Round's
    // encounter is the scripted ACT tutorial, its attack spawn is unreachable
    // and its turn is one frame, so there is nothing to launch.
    if (Array.isArray(j.real) && j.real.length === 0) {
      console.warn(`[rosters] ${j.id}: 0 real attacks — documented only, not added`);
      continue;
    }
    rosterConfigs.push(j);
  }
}
for (const j of rosterConfigs) {
  if (BOSSES.some(b => b.id === j.id)) continue;   // hand-written entry wins
  BOSSES.push({
    id: j.id, chapter: j.chapter, chNum: j.chNum, label: j.label,
    enemy: j.enemy, extraEnemies: j.extraEnemies || [],
    boxBlock: j.boxBlock || null, turnBlock: j.turnBlock || null,
    selectorScan: j.selectorScan || null,
    extraAttackFiles: j.extraAttackFiles || [],
    controllerSet: j.controllerSet || null,
    monsterType: j.monsterType === undefined ? null : j.monsterType,
    fromRoster: true,
  });
}

function chapterDir(n) { return path.join(GML_ROOT, `DELTARUNE Chapter ${n} - GML`); }

/**
 * The boss's global.monstertype, read out of scr_encountersetup.
 *
 * scr_monstersetup switches on this to fill name/hp/maxhp/at/df/mercy/acts, so
 * it is the single number the studio needs to give a fight its REAL stats
 * instead of invented ones. Encounters bind it in pairs:
 *     global.monsterinstancetype[0] = obj_knight_enemy;
 *     global.monstertype[0] = 104;
 * The slot index varies and the two lines are not always adjacent, so match the
 * instancetype line and then take the next monstertype assignment for the SAME
 * slot within the same case.
 */
function monsterTypeOf(chNum, enemy) {
  const src = readIfExists(path.join(chapterDir(chNum), 'gml_GlobalScript_scr_encountersetup.gml'));
  if (!src) return null;
  const re = new RegExp(
    'monsterinstancetype\\[(\\d+)\\]\\s*=\\s*' + enemy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*;',
    'g');
  let m;
  while ((m = re.exec(src))) {
    const slot = m[1];
    const after = src.slice(m.index, m.index + 600);
    const t = new RegExp('monstertype\\[' + slot + '\\]\\s*=\\s*(\\d+)').exec(after);
    if (t) return Number(t[1]);
  }
  return null;
}

function readIfExists(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }

/** Strip strings/comments so brace counting and matching aren't fooled by dialogue. */
function strip(src) {
  return src
    .replace(/"(?:[^"\\]|\\.)*"/g, m => '"' + ' '.repeat(Math.max(0, m.length - 2)) + '"')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * From `from` (pointing at an `if`), return the exclusive end index of the
 * whole if-statement: its braced block, a nested if, or the single `;`.
 */
function ifStatementEnd(clean, from) {
  let i = clean.indexOf('(', from);
  if (i === -1) return clean.length;
  let depth = 0;
  for (; i < clean.length; i++) {
    if (clean[i] === '(') depth++;
    else if (clean[i] === ')') { depth--; if (depth === 0) break; }
  }
  i++;
  while (i < clean.length && /\s/.test(clean[i])) i++;
  if (clean[i] === '{') {
    let d = 0;
    for (let j = i; j < clean.length; j++) {
      if (clean[j] === '{') d++;
      else if (clean[j] === '}') { d--; if (d === 0) return j + 1; }
    }
    return clean.length;
  }
  if (clean.startsWith('if', i)) return ifStatementEnd(clean, i);
  const semi = clean.indexOf(';', i);
  return semi === -1 ? clean.length : semi + 1;
}

/**
 * Slice a boss's box-setup block verbatim so the studio can replay it with
 * self = the boss. The block self-selects on the boss's own attack variable
 * (myattackchoice / rr), so one slice serves every attack.
 */
function extractBoxBlock(dir, cfg) {
  if (!cfg) return null;
  const src = readIfExists(path.join(dir, cfg.file));
  if (!src) return null;
  const clean = strip(src);
  const at = clean.indexOf(cfg.anchor);
  if (at === -1) return null;
  if (cfg.endAnchor) {
    const end = clean.indexOf(cfg.endAnchor, at);
    return src.slice(at, end === -1 ? Math.min(clean.length, at + 2000) : end).trim();
  }
  let end = ifStatementEnd(clean, at);
  if (cfg.ifElse) {
    // Capture the else too — Pink's DEFAULT box lives in the else branch.
    let k = end;
    while (k < clean.length && /\s/.test(clean[k])) k++;
    if (clean.startsWith('else', k)) {
      k += 4;
      while (k < clean.length && /\s/.test(clean[k])) k++;
      if (clean[k] === '{') {
        let d = 0;
        for (let j = k; j < clean.length; j++) {
          if (clean[j] === '{') d++;
          else if (clean[j] === '}') { d--; if (d === 0) { end = j + 1; break; } }
        }
      }
    }
  }
  return src.slice(at, end).trim();
}

/**
 * Slice a boss's TURN-LENGTH chain: the `if (choice == N) scr_turntimer(...)`
 * ladder that sets how long each attack lasts. It sits outside the dispatcher
 * branch, so the per-attack `setup` slice never contains it.
 *
 * Captured from the anchor through the closing bare `else scr_turntimer(N);`,
 * which is how every one of these ladders terminates.
 */
function extractTurnBlock(dir, cfg) {
  if (!cfg) return null;
  const src = readIfExists(path.join(dir, cfg.file));
  if (!src) return null;
  const clean = strip(src);
  // The anchor can be AMBIGUOUS. `if (myattackchoice == 7)` appears twice in
  // obj_knight_enemy's Step: once as combinationattack's DISPATCHER branch and
  // again, ~170 lines later, as the first arm of the turn-length ladder.
  // Taking the first match sliced 5,027 characters starting at the dispatcher —
  // including FOUR `scr_bulletspawner(x, y, obj_dbulletcontroller)` calls and
  // their `monsterattackname` assignments. The studio replays this block, so
  // every Knight attack spawned a SECOND controller: doubled singletons
  // (obj_knight_swordfall live=2), doubled bullet counts (obj_fallingsword 14
  // where the chart says 6-8), and local_turntimers ~60 frames stale because a
  // second copy had been running all along.
  //
  // So accept only an occurrence that actually introduces a turn ladder: one
  // with `scr_turntimer` close behind it.
  let at = -1;
  for (let from = 0; ;) {
    const hit = clean.indexOf(cfg.anchor, from);
    if (hit === -1) break;
    // `turntimer`, not `scr_turntimer` — Jevil sets his turn length with a
    // direct `global.turntimer = 240;` rather than through the script, and the
    // Knight's dispatcher branch still fails the test because its first 80
    // characters are the monsterattackname assignment and the bullet spawner.
    if (/turntimer/.test(clean.slice(hit, hit + (cfg.anchorWindow || 80)))) { at = hit; break; }
    from = hit + cfg.anchor.length;
  }
  if (at === -1) return null;
  // Bosses do not share a shape here. The Knight's ladder terminates in a
  // trailing `else scr_turntimer(N);`; Spamton NEO's is a flat default followed
  // by `if (rr == N) scr_turntimer(X)` lines and simply stops at `turns += 1`.
  // Requiring the Knight's shape is why only the Knight ever got a turn block,
  // and why every other boss fell back to the studio's floor — all 8 Spamton
  // NEO attacks read 120 against 750/330/300/1200/430/260/90.
  if (cfg.endAnchor) {
    const end = clean.indexOf(cfg.endAnchor, at);
    if (end === -1) return null;
    return src.slice(at, end).trim();
  }
  const tail = /\n\s*else\s*\n\s*scr_turntimer\(\s*\d+\s*\)\s*;/.exec(clean.slice(at));
  if (!tail) return null;
  return src.slice(at, at + tail.index + tail[0].length).trim();
}

/**
 * Every attack announces itself with `global.monsterattackname[myself] = "..."`,
 * so anchor on that rather than on the branch variable — the Knight selects with
 * `myattackchoice`, Spamton NEO with `rr`, and anchoring on the announcement
 * works for both without knowing which.
 *
 * From each announcement, look forward over the rest of its branch for the
 * controller spawn and the `.type` that selects the attack inside it.
 */
function attackAnnouncements(src) {
  const clean = strip(src);
  const out = [];
  const re = /monsterattackname\s*\[[^\]]*\]\s*=\s*"/g;
  let m;
  while ((m = re.exec(clean))) {
    // The real name survives only in the original text.
    const nameMatch = /monsterattackname\s*\[[^\]]*\]\s*=\s*"([^"]*)"/.exec(src.slice(m.index, m.index + 200));
    const name = nameMatch ? nameMatch[1] : null;

    // Walk forward to the end of the enclosing block (first unmatched `}`), so a
    // sibling branch's spawn can't be misattributed to this attack.
    let i = m.index;
    let depth = 0;
    let end = clean.length;
    for (let j = i; j < clean.length && j < i + 4000; j++) {
      const c = clean[j];
      if (c === '{') depth++;
      else if (c === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    const window = clean.slice(i, end);

    // Which branch value selected this attack — the nearest `<var> == N` before it.
    const before = clean.slice(Math.max(0, i - 300), i);
    const cond = [...before.matchAll(/([a-zA-Z_]\w*)\s*==\s*(-?\d+(?:\.\d+)?)\s*\)/g)].pop();

    // SWITCH DISPATCH. Queen is the first boss whose dispatcher is
    // `switch (rr) { case 3: ... }` rather than an if/else chain, so there is no
    // `rr == 3)` for the test above to find and every one of her attacks came
    // out with a null selector — unlaunchable, because the studio sets the
    // selector on the boss to pick the branch. Resolve the nearest preceding
    // `case N:` and then the `switch (var)` that encloses it.
    let swSelector = null, swChoice = null, swCaseAt = -1;
    if (!cond) {
      const upto = clean.slice(0, i);
      const caseM = [...upto.matchAll(/\bcase\s+(-?\d+(?:\.\d+)?)\s*:/g)].pop();
      if (caseM) {
        const sw = [...upto.slice(0, caseM.index).matchAll(/\bswitch\s*\(\s*([a-zA-Z_]\w*)\s*\)/g)].pop();
        if (sw) { swSelector = sw[1]; swChoice = Number(caseM[1]); swCaseAt = caseM.index; }
      }
    }

    // The WHOLE enclosing branch, walked backward to its `{`. The studio
    // replays this verbatim with self = the boss, because setup that PRECEDES
    // the announcement (box creation, obj_purplecontrols mode, heart markers)
    // is part of the attack — Pink's "3d tunnel" sets maxxscale 3.75 and
    // purple mode 7 before the controller ever spawns.
    let bstart = i;
    {
      let d = 0;
      for (let j = i - 1; j >= 0; j--) {
        const c = clean[j];
        if (c === '}') d++;
        else if (c === '{') { if (d === 0) { bstart = j + 1; break; } d--; }
      }
    }
    let setup = src.slice(bstart, end).trim();
    // An unbraced branch walks out into some huge enclosing block — a replay
    // of that would re-run half the boss turn. Fall back to manual spawning.
    //
    // "More than one announcement" is the WRONG test for that: the Knight's
    // choice 15 is a genuine COMBO branch — sword vortex AND tracking swords,
    // two announcements, two scr_bulletspawner calls in one branch — and
    // nulling its setup dropped `dc.difficulty = 3; dc.damage = 206;` and the
    // whole second controller (the manual fallback spawns one controller with
    // the studio's difficulty and no damage; measured: every sword at damage 0
    // against the source's 206). An ESCAPED walk is recognisable differently:
    // its slice re-tests the selector (`myattackchoice == N)` from sibling
    // branches), which a real branch body never does.
    const escaped = cond && new RegExp(
      cond[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=='
    ).test(setup);
    if (setup.length > 3500 || escaped) setup = null;

    // A switch case has no braces of its own, so the backward walk above lands
    // on the SWITCH's `{` and swallows every sibling case. Re-slice from the
    // `case N:` to whichever comes first: the next `case`, the `break`, or the
    // end of the announcement's own block.
    if (swCaseAt >= 0) {
      const bodyStart = clean.indexOf(':', swCaseAt) + 1;
      const nextCase = clean.indexOf('case ', i);
      const brk = clean.indexOf('break;', i);
      let stop = end;
      for (const cand of [nextCase, brk]) if (cand >= 0 && cand < stop) stop = cand;
      const sliced = src.slice(bodyStart, stop).trim();
      setup = (sliced && sliced.length <= 3500) ? sliced : null;
    }

    out.push({
      name,
      setup,
      selector: cond ? cond[1] : swSelector,
      choice: cond ? Number(cond[2]) : swChoice,
      controller: (/(?:scr_bulletspawner|instance_create(?:_depth)?)\s*\([^;]*?(obj_[a-zA-Z0-9_]+)\s*\)/.exec(window) || [])[1] || null,
      type: (() => { const t = /\.\s*type\s*=\s*(-?\d+(?:\.\d+)?)/.exec(window); return t ? Number(t[1]) : null; })(),
      usesDifficulty: /\.\s*difficulty\s*=/.test(window),
      // Distinguish `dc.difficulty = difficulty` (pass the boss's own setting on,
      // so the studio's DIFF selector should drive it) from `dc.difficulty = 0`
      // (the dispatcher pins a specific value, and overriding it changes the
      // attack — Pink's finale pins 0 because obj_pinknodeact ramps it 0->4
      // itself as the player clears nodes).
      difficultyLiteral: (() => {
        const m = /\.\s*difficulty\s*=\s*(-?\d+(?:\.\d+)?)\s*;/.exec(window);
        return m ? Number(m[1]) : null;
      })(),
      extraFields: [...window.matchAll(/\bdc\s*\.\s*([a-zA-Z_]\w*)\s*=\s*([^;]{1,40});/g)]
        .map(x => x[1]).filter(f => f !== 'type' && f !== 'difficulty'),
    });
  }
  return out;
}

const roster = [];
const notes = [];
const boxSetups = {};
const turnSetups = {};
// Per-boss "emit the roster JSON's own list" closures, run only for fights that
// none of the scanning paths could see (see the DECLARED ATTACKS note below).
const DECLARED_FALLBACK = {};

for (const boss of BOSSES) {
  const dir = chapterDir(boss.chNum);
  const bb = extractBoxBlock(dir, boss.boxBlock);
  if (bb) { boxSetups[boss.id] = bb; notes.push(`${boss.id}: box block ${bb.length} chars`); }
  else if (boss.boxBlock) notes.push(`${boss.id}: BOX BLOCK NOT FOUND — check anchor`);
  const tb = extractTurnBlock(dir, boss.turnBlock);
  if (tb) { turnSetups[boss.id] = tb; notes.push(`${boss.id}: turn block ${tb.length} chars`); }
  else if (boss.turnBlock) notes.push(`${boss.id}: TURN BLOCK NOT FOUND — check anchor`);
  // Attack dispatch can live in any event of the enemy object — and, for a
  // fight that spans several enemy objects, of any of them. Berdly is two
  // separate encounters (obj_berdlyb_enemy and obj_berdlyb2_enemy) and the
  // paired Chapter 5 fights put one enemy's attacks in the other's Step.
  const scanObjects = [boss.enemy].concat(boss.extraEnemies || []);
  const eventFiles = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => scanObjects.some(o => f.startsWith(`gml_Object_${o}_`)))
    : [];

  let found = 0;
  for (const f of eventFiles) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!/monsterattackname/.test(src)) continue;
    for (const a of attackAnnouncements(src)) {
      // An announcement with no controller isn't a bullet attack (a scripted
      // cutscene beat, or a name reset) — skip rather than invent one.
      if (!a.controller || !a.name) continue;
      roster.push({
        boss: boss.id, bossLabel: boss.label, chapter: boss.chapter,
        enemy: boss.enemy, selector: a.selector, choice: a.choice,
        name: a.name, controller: a.controller, type: a.type,
        usesDifficulty: a.usesDifficulty, difficultyLiteral: a.difficultyLiteral, extraFields: a.extraFields,
        setup: a.setup || null,
        source: f,
      });
      found++;
    }
  }
  notes.push(`${boss.id}: ${found} named attacks in ${boss.enemy}`);

  // DECLARED ATTACKS. Not every fight dispatches through
  // `global.monsterattackname[...] = "..."` next to a controller spawn:
  //   * Lancer's turns set fields on a persistent obj_lancerbike
  //     (`bike.racecon = 1` / `bike.lcon = 1`) — no announcement, no type.
  //   * Lanino & Elnina and Orange & Green dispatch from their own controller
  //     object with one shared type and a `special` / life-counter selecting
  //     the variant.
  // For those, the roster JSON's `real` list IS the derivation (each entry
  // carries file:line evidence), so emit it directly rather than inventing a
  // parser per fight. Only used when scanning found nothing, so a fight the
  // scanner handles keeps its verbatim setup blocks.
  DECLARED_FALLBACK[boss.id] = () => {
    const cfg = rosterConfigs.find(c => c.id === boss.id);
    let d = 0;
    for (const r of (cfg && cfg.real) || []) {
      // Not every real turn goes through a bullet controller. Orange & Green's
      // HEALING EGG replaces the turn outright — no controller, no box, no soul
      // — so requiring `controller` dropped it from the roster entirely. Fall
      // back to the object the row says the attack actually creates.
      const cell = parseControllerCell(r.controller || r.attackObject);
      if (!cell.name) continue;
      roster.push({
        boss: boss.id, bossLabel: boss.label, chapter: boss.chapter,
        enemy: boss.enemy,
        selector: (cfg.selectorVar && typeof r.choice === 'number') ? cfg.selectorVar : null,
        choice: typeof r.choice === 'number' ? r.choice : null,
        name: r.name || `${boss.label} attack`,
        controller: cell.name,
        type: typeof r.type === 'number' ? Math.floor(r.type) : (r.type === undefined ? null : r.type),
        set: Object.assign({}, cell.set, r.set || null),
        turntimerHint: r.turntimer === undefined ? null : r.turntimer,
        usesDifficulty: false, difficultyLiteral: null, extraFields: [],
        setup: null, declared: true,
        source: `rosters/${boss.id}.json (declared)`,
      });
      d++;
    }
    if (d) notes.push(`${boss.id}: ${d} DECLARED attacks from rosters/${boss.id}.json`);
  };

  // Attacks announced by a HELPER object rather than the boss (Pink's date
  // controller spawns the type-210 finale itself). No selector is recorded:
  // the nearest `x == N` in a helper's event is unrelated bookkeeping, and
  // writing it onto the boss would poison unrelated state. Setup replay is off
  // for the same reason — the branch reads the helper's own locals.
  for (const xf of boss.extraAttackFiles || []) {
    const src = readIfExists(path.join(dir, xf));
    if (!src) { notes.push(`${boss.id}: extra file MISSING ${xf}`); continue; }
    let n = 0;
    for (const a of attackAnnouncements(src)) {
      if (!a.controller || !a.name) continue;
      roster.push({
        boss: boss.id, bossLabel: boss.label, chapter: boss.chapter,
        enemy: boss.enemy, selector: null, choice: null,
        name: a.name, controller: a.controller, type: a.type,
        usesDifficulty: a.usesDifficulty, difficultyLiteral: a.difficultyLiteral, extraFields: a.extraFields,
        setup: null, source: xf,
      });
      n++;
    }
    notes.push(`${boss.id}: ${n} attacks announced in ${xf}`);
  }

  // The dating minigame: declared, because `datecount++` + create-controller
  // has no announcement, no type and no selector to scan for.
  for (const d of boss.dates || []) {
    roster.push({
      boss: boss.id, bossLabel: boss.label, chapter: boss.chapter,
      enemy: boss.enemy, selector: 'datecount', choice: d.n,
      name: d.name, controller: 'obj_date_controller', type: null,
      launch: 'pink-date', datecount: d.n,
      usesDifficulty: false, extraFields: [], setup: null,
      source: 'obj_pink_enemy_Step_0.gml (datecount++ / obj_date_controller)',
    });
  }
  if (boss.dates) notes.push(`${boss.id}: ${boss.dates.length} dating-minigame turns`);

  // Jevil-style: a numeric selector in one event, no monsterattackname.
  if (boss.selectorScan) {
    const src = readIfExists(path.join(dir, boss.selectorScan.file));
    if (src) {
      const clean = strip(src);
      const varName = boss.selectorScan.varName;
      const re = new RegExp(varName + '\\s*==\\s*(-?\\d+)\\b', 'g');
      const hits = [...clean.matchAll(re)];
      let found = 0;
      for (let i = 0; i < hits.length; i++) {
        const start = hits[i].index;
        const end = i + 1 < hits.length ? hits[i + 1].index : Math.min(clean.length, start + 1200);
        const win = clean.slice(start, end);
        const ctrl = /(?:scr_bulletspawner|instance_create(?:_depth)?)\s*\([^;]*?(obj_[a-zA-Z0-9_]+)\s*\)/.exec(win);
        if (!ctrl) continue;
        const type = (() => { const t = /\.\s*type\s*=\s*(-?\d+(?:\.\d+)?)/.exec(win); return t ? Number(t[1]) : null; })();
        // The braced branch body, for verbatim replay (ch1 branches are all
        // `if (jattack == N) { ... }`).
        let setup = null;
        {
          const bOpen = clean.indexOf('{', start);
          const nextHit = i + 1 < hits.length ? hits[i + 1].index : clean.length;
          if (bOpen !== -1 && bOpen < nextHit) {
            let d = 0, endB = -1;
            for (let j = bOpen; j < clean.length; j++) {
              if (clean[j] === '{') d++;
              else if (clean[j] === '}') { d--; if (d === 0) { endB = j + 1; break; } }
            }
            if (endB !== -1 && endB - bOpen < 3500) setup = src.slice(bOpen + 1, endB - 1).trim();
          }
        }
        roster.push({
          setup,
          boss: boss.id, bossLabel: boss.label, chapter: boss.chapter,
          enemy: boss.enemy, selector: varName, choice: Number(hits[i][1]),
          name: `${varName} ${hits[i][1]}${type !== null ? ` (type ${type})` : ''}`,
          controller: ctrl[1], type,
          usesDifficulty: /\.\s*difficulty\s*=/.test(win),
          // e.g. ch1 sets `joker = 1` on every controller after dispatch, and
          // the controller gates its whole Jevil section on it.
          controllerSet: boss.controllerSet || null,
          extraFields: [...win.matchAll(/\bdc\s*\.\s*([a-zA-Z_]\w*)\s*=\s*[^;]{1,40};/g)]
            .map(x => x[1]).filter(f => f !== 'type' && f !== 'difficulty'),
          source: boss.selectorScan.file,
        });
        found++;
      }
      notes.push(`${boss.id}: ${found} attacks via ${varName} scan`);
    }
  }

  // Gerson's green-soul charts: every `attackpattern == N` branch in the fill
  // event is one attack. These launch by running the BOSS (attackpattern set,
  // event_user(0), attackcon = 1), not by spawning a controller.
  if (boss.greenEvent) {
    const src = readIfExists(path.join(dir, boss.greenEvent));
    if (src) {
      const ids = [...new Set([...strip(src).matchAll(/attackpattern\s*==\s*(\d+)/g)].map(m => Number(m[1])))]
        .sort((a, b) => a - b);
      for (const n of ids) {
        roster.push({
          boss: boss.id, bossLabel: boss.label, chapter: boss.chapter,
          enemy: boss.enemy, selector: 'attackpattern', choice: n,
          name: `green spears — pattern ${n}`,
          controller: null, type: null,
          launch: 'gerson-green', pattern: n,
          usesDifficulty: false, extraFields: [],
          source: boss.greenEvent,
        });
      }
      notes.push(`${boss.id}: ${ids.length} green-soul chart patterns`);
    }
  }

  // Gerson-style: standalone controllers behind scr_spearshot's arg3.
  if (boss.dispatchScript) {
    const src = readIfExists(path.join(dir, `gml_GlobalScript_${boss.dispatchScript}.gml`));
    if (src) {
      const clean = strip(src);
      const re = /arg3\s*==\s*(-?\d+(?:\.\d+)?)\s*\)\s*\{?([\s\S]{0,400}?)(?=else if\s*\(arg3|\n\s*\}\s*\n)/g;
      let m;
      let gfound = 0;
      while ((m = re.exec(clean))) {
        const ctrl = /instance_create[^;]*?(obj_[a-zA-Z0-9_]*controller)\s*\)/.exec(m[2]);
        if (!ctrl) continue;
        roster.push({
          boss: boss.id, bossLabel: boss.label, chapter: boss.chapter,
          enemy: boss.enemy, choice: Number(m[1]),
          name: ctrl[1].replace(/^obj_gerson_/, '').replace(/_controller$/, '').replace(/_/g, ' '),
          controller: ctrl[1], type: null, usesDifficulty: false,
          source: `${boss.dispatchScript} arg3==${m[1]}`,
        });
        gfound++;
      }
      notes.push(`${boss.id}: ${gfound} standalone controllers via ${boss.dispatchScript}`);
    }
  }

  // Last resort, once every scanning path has had its turn: a fight none of
  // them could see falls back to the roster JSON's own derivation.
  if (DECLARED_FALLBACK[boss.id] && !roster.some(r => r.boss === boss.id)) {
    DECLARED_FALLBACK[boss.id]();
  }
}

// RECONCILE against the roster's own derivation. A generic scan can find the
// right BRANCH and still name the wrong controller: K. Round's dispatch is
// `leap = instance_create(...obj_checkers_leap); leap.leapmode = N`, and
// scanning leapmode inside obj_checkers_leap's Step matches each branch body,
// whose first instance_create is an obj_shake or an obj_regularbullet — an
// incidental effect, not the attack. The roster JSON records the real controller
// (its .md documents this exact caveat), so where it declares one for a choice,
// it wins. The scan's verbatim `setup` block is kept either way.
/**
 * A roster row's controller cell may carry the seed values alongside the name:
 *   "obj_rhythmgame (tenna_boss = true, turn_length = 360)"
 * Those annotations are exactly the fields the attack needs to launch, so parse
 * them rather than dropping them with the parenthetical.
 */
function parseControllerCell(cell) {
  if (typeof cell !== 'string') return { name: null, set: {} };
  const m = cell.match(/^\s*([A-Za-z_]\w*)\s*(?:\((.*)\))?/);
  if (!m) return { name: null, set: {} };
  const set = {};
  if (m[2]) {
    for (const kv of m[2].split(',')) {
      const p = kv.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.+?)\s*$/);
      if (!p) continue;
      const raw = p[2];
      if (/^-?\d+(\.\d+)?$/.test(raw)) set[p[1]] = Number(raw);
      else if (raw === 'true' || raw === 'false') set[p[1]] = raw === 'true';
    }
  }
  return { name: m[1], set };
}

/**
 * Fold a roster row's declared values onto a generated attack entry.
 *
 * A fractional `type` (2.1, 6.1) is the roster's shorthand for "same controller
 * type, next step along the difficulty axis" — the real GML type is the integer
 * part, and the variant comes from `difficulty`. Passing 2.1 through as the type
 * would land on no case at all and the attack would spawn nothing.
 */
function applyRosterRow(a, r, selectorVar) {
  const ctl = parseControllerCell(r.controller);
  if (ctl.name && ctl.name !== a.controller) a.controller = ctl.name;
  if (typeof r.type === 'number') a.type = Math.floor(r.type);
  else if (r.type !== undefined && r.type !== null) a.type = r.type;
  if (r.name) a.name = r.name;

  const set = Object.assign({}, ctl.set, r.set || {}, a.set || {});
  // `difficulty` is a number only when the roster pins one; several rosters use
  // that cell for prose describing how the fight derives it, which must not be
  // written onto the controller.
  if (typeof r.difficulty === 'number') {
    a.difficultyLiteral = r.difficulty;
    set.difficulty = r.difficulty;
  }
  if (typeof r.special === 'number') set.special = r.special;
  if (typeof r.turnOverride === 'number') a.turnTimer = r.turnOverride;
  else if (typeof r.turn === 'number') a.turnTimer = r.turn;
  if (Object.keys(set).length) a.set = set;

  // No `type` means the selector itself is the payload: the boss creates the
  // object and writes the selector onto it (leap.leapmode = 2).
  if ((r.type === undefined || r.type === null) && !a.set && typeof a.choice === 'number') {
    a.set = { [selectorVar]: Number(a.choice) };
  }
}

// A choice can legitimately cover SEVERAL playable attacks: Queen's `case 2`
// dispatches Wine at three tilt speeds, and Tenna's `case 3` covers every
// PHYSICAL CHALLENGE minigame. The scan sees one branch and emits one entry, so
// those variants used to be dropped (27 attacks across Queen, Tenna, Berdly,
// Tasque Manager and Orange & Green). Fan the entry out into one attack per
// roster row instead — the rows carry the type/difficulty/special that
// distinguish them, and the scan's verbatim `setup` block is shared by all.
for (const j of rosterConfigs) {
  if (!j.selectorVar || !Array.isArray(j.real)) continue;
  const grouped = new Map();
  for (const r of j.real) {
    if (typeof r.choice !== 'number') continue;
    if (!grouped.has(r.choice)) grouped.set(r.choice, []);
    grouped.get(r.choice).push(r);
  }
  // Names repeat across variant axes (Berdly fights Tornado in both of his
  // fights). Disambiguate with whatever actually differs, so the dedupe below
  // sees distinct attacks and the dropdown reads unambiguously.
  const nameCount = new Map();
  for (const r of j.real) nameCount.set(r.name, (nameCount.get(r.name) || 0) + 1);
  const suffixFor = r => {
    if ((nameCount.get(r.name) || 0) < 2) return '';
    const bits = [];
    if (r.fight !== undefined) bits.push(`fight ${r.fight}`);
    if (typeof r.difficulty === 'number') bits.push(`difficulty ${r.difficulty}`);
    if (typeof r.special === 'number') bits.push(`special ${r.special}`);
    if (!bits.length && r.minigametype) bits.push(String(r.minigametype));
    return bits.length ? ` (${bits.join(', ')})` : '';
  };

  const expanded = [];
  for (let i = 0; i < roster.length; i++) {
    const a = roster[i];
    if (a.boss !== j.id) continue;
    const rows = grouped.get(Number(a.choice));
    if (!rows || !rows.length) continue;
    if (rows.length === 1) { applyRosterRow(a, rows[0], j.selectorVar); continue; }
    for (const r of rows) {
      const clone = Object.assign({}, a, { set: a.set ? Object.assign({}, a.set) : undefined });
      applyRosterRow(clone, r, j.selectorVar);
      clone.name = (r.name || clone.name) + suffixFor(r);
      clone.variantOf = a.name;
      expanded.push(clone);
    }
    roster[i] = null; // the un-fanned entry is replaced by its variants
  }
  if (expanded.length) {
    for (let i = roster.length - 1; i >= 0; i--) if (roster[i] === null) roster.splice(i, 1);
    roster.push(...expanded);
  }

  // Rows whose choice the scan never reached at all (Orange & Green's HEALING
  // EGG replaces the whole turn, so no dispatcher branch creates a controller).
  const covered = new Set(roster.filter(a => a.boss === j.id).map(a => a.name));
  for (const r of j.real) {
    const nm = (r.name || '') + suffixFor(r);
    if (!r.name || covered.has(nm) || covered.has(r.name)) continue;
    const base = roster.find(a => a.boss === j.id);
    if (!base) continue;
    const entry = {
      boss: j.id, bossLabel: j.label, chapter: j.chapter, enemy: j.enemy,
      selector: j.selectorVar, choice: r.choice, name: nm,
      controller: null, type: null, usesDifficulty: false, difficultyLiteral: null,
      extraFields: [], setup: base.setup || null,
      source: `rosters/${j.id}.json (row not reached by scan)`,
    };
    applyRosterRow(entry, r, j.selectorVar);
    entry.name = nm;
    roster.push(entry);
    covered.add(nm);
  }
}

// De-duplicate: the same (controller, type) can be dispatched from more than one
// branch (difficulty variants). Keep the first, record the alternatives.
const seen = new Map();
const usedIds = new Set();
const final = [];
for (const a of roster) {
  // pattern/datecount must be part of the key: green entries share controller
  // (null) and all four dates share obj_date_controller with no type.
  // The NAME is part of the identity. Difficulty variants of one attack share
  // both the announcement and the (controller, type), so they still collapse —
  // but the Chaos King dispatches three genuinely different attacks through
  // obj_chainking with type 1, and without the name they merged into one entry
  // and two of his attacks disappeared from the roster.
  const key = `${a.boss}|${a.controller}|${a.type}|${a.pattern}|${a.datecount}|${a.name}`;
  if (seen.has(key)) { seen.get(key).alsoChoices.push(a.choice); continue; }
  a.alsoChoices = [];
  a.hasSpecial = (a.extraFields || []).includes('special');
  a.id = a.launch === 'gerson-green'
    ? `${a.boss}_green${a.pattern}`
    : a.launch === 'pink-date'
      ? `${a.boss}_date${a.datecount}`
      : `${a.boss}_${a.type !== null ? ('type' + String(a.type).replace('.', '_')) : a.controller.replace(/^obj_/, '')}`;
  // Now that same-(controller,type) attacks with different names are kept
  // separately, the id can collide. Ids address attacks everywhere — the
  // dropdown, SPEC_CHECK, the visual baseline — so make them unique by
  // appending a slug of the announcement rather than a bare counter.
  if (usedIds.has(a.id)) {
    const slug = String(a.name || '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 14).replace(/_$/, '');
    let candidate = `${a.id}_${slug || 'alt'}`;
    let n = 2;
    while (usedIds.has(candidate)) candidate = `${a.id}_${slug || 'alt'}${n++}`;
    a.id = candidate;
  }
  usedIds.add(a.id);
  seen.set(key, a);
  // The studio seeds the controller from `controllerSet`. A roster row's own
  // values arrive as `set`, so fold them in here rather than teaching the
  // launcher about a second field that means the same thing. Attack-level wins:
  // the boss-level entry is a blanket default (`joker: 1`).
  if (a.set) {
    a.controllerSet = Object.assign({}, a.controllerSet || {}, a.set);
    delete a.set;
  }
  final.push(a);
}

// ── Which entries the REAL fights actually play ────────────────────────────
//
// The roster above inventories every dispatcher branch, but the dispatchers
// are full of cut content nothing ever selects. This table is derived from the
// code that ASSIGNS each selector — the choosers — documented with line-level
// evidence in REAL_FIGHT_ROSTERS.md. Landon called this out: he recognised the
// roster as mostly unused attacks and put Gerson at ~21 real entries, and the
// choosers agree exactly.
//
//   knight  obj_knight_enemy Other_10: phases use choices {1,2,5,9,11,13,14,15,-1};
//           the chooser runs before EVERY attack, so Create's choice 0
//           (Swordslash!) never plays. Phase-1 turns 6-9 are dead code.
//   sneo    Other_10 ladder: rr {0,2,6,7,8,8.5,9} + weird-route 5. The
//           trailing `rr = choose(0,1,2,3)` in Step is overwritten by
//           event_user(0) before it is ever read.
//   jevil   jturn progression + pools reach jattack 0-15; 99/999 have no writer.
//   gerson  Other_10 ladder trueturn 0-20: greens {0,1,2,3,4,6,7,9,12,13,14,
//           19,47,53,55,56,220} + wrappers 70 (box throw) / 72 (shell kick).
//           No used chart fires specials 5/6/7, so bell/box_hit/hammer_bro
//           are cut. The 100+ charts are NOT the statue fight's (it has its
//           own Other_10) — plain leftovers.
//   pink    Other_10 assigns {1,3,4,5,6} → types 200/202/208/209/203; purple
//           intro, finale 210 and the four dates are event-driven and real.
const REAL = {
  knight: a => [98, 99, 104, 151, 153, 154, 107].includes(a.type),
  spamton_neo: a => ['spamton_neo_type0', 'spamton_neo_type1_5', 'spamton_neo_type51',
    'spamton_neo_type6', 'spamton_neo_type12', 'spamton_neo_sneo_phonecall',
    'spamton_neo_type8_5', 'spamton_neo_type9'].includes(a.id),
  jevil: a => a.choice >= 0 && a.choice <= 15,
  gerson: a => a.launch === 'gerson-green'
    ? [0, 1, 2, 3, 4, 6, 7, 9, 12, 13, 14, 19, 47, 53, 55, 56, 70, 72, 220].includes(a.pattern)
    : ['obj_box_throw_controller', 'obj_gerson_shell_kick_controller'].includes(a.controller),
  pink: a => a.launch === 'pink-date' || [200, 202, 208, 209, 203, 199, 210].includes(a.type),
};
// Fights contributed as data carry their own real/cut lists. Match on whatever
// the derivation actually keyed on — a `type` when the dispatcher uses one, the
// selector `choice` otherwise — so a roster JSON does not have to know how the
// generator will end up naming the entry.
for (const j of rosterConfigs) {
  if (REAL[j.id]) continue;                      // hand-written filter wins
  // Types are floored to match the entries: a roster's 2.1 is type 2 at the
  // next difficulty, not a distinct controller case.
  const realTypes = new Set((j.real || []).filter(r => r.type !== undefined && r.type !== null).map(r => Math.floor(Number(r.type))));
  const realChoices = new Set((j.real || []).filter(r => typeof r.choice === 'number').map(r => Number(r.choice)));
  // `attackObject` too, for the turns that create an object without a bullet
  // controller — otherwise they generate and are then judged cut.
  const realControllers = new Set((j.real || [])
    .map(r => parseControllerCell(r.controller || r.attackObject).name).filter(Boolean));
  REAL[j.id] = a => {
    if (a.type !== null && a.type !== undefined && realTypes.size) return realTypes.has(Number(a.type));
    if (a.choice !== null && a.choice !== undefined && realChoices.size) return realChoices.has(Number(a.choice));
    return realControllers.has(a.controller);
  };
}

for (const a of final) {
  const judge = REAL[a.boss];
  a.inFight = judge ? !!judge(a) : true;
  // The boss's monstertype, so the studio can run the fight's own
  // scr_monstersetup and get real hp/at/df instead of invented numbers.
  const cfg = BOSSES.find(b => b.id === a.boss);
  if (cfg) {
    if (cfg.monsterType === null || cfg.monsterType === undefined) {
      // Lanino & Elnina and Orange & Green are driven by a CONTROLLER object
      // that is not itself a monster, so the encounter binds the stats to the
      // real enemies listed alongside it.
      cfg.monsterType = monsterTypeOf(cfg.chNum, cfg.enemy);
      for (const e of cfg.extraEnemies || []) {
        if (cfg.monsterType !== null && cfg.monsterType !== undefined) break;
        cfg.monsterType = monsterTypeOf(cfg.chNum, e);
      }
    }
    if (cfg.monsterType !== null && cfg.monsterType !== undefined) a.monsterType = cfg.monsterType;
    // The fight's OTHER enemies. Several of these fights are duos (Lanino &
    // Elnina, Aqua & Seth, Yellow & Blue, Orange & Green) and their attacks
    // read both enemies for positioning and state, so the studio has to spawn
    // the partner too or those reads land on an empty proxy at (320, 240).
    if ((cfg.extraEnemies || []).length) a.extraEnemies = cfg.extraEnemies;
  }
}

console.log(notes.join('\n'));
console.log(`\nreal attacks: ${final.length} (${final.filter(a => a.inFight).length} in real fights, ${final.filter(a => !a.inFight).length} cut)`);
for (const boss of BOSSES) {
  const mine = final.filter(a => a.boss === boss.id);
  console.log(`\n${boss.label} (${mine.length}):`);
  for (const a of mine) {
    console.log(`  choice ${String(a.choice).padStart(3)}  ${String(a.name).padEnd(26)} ${a.controller}${a.type !== null ? ' type=' + a.type : ''}`);
  }
}

const src = `/**
 * gml_attacks.js — GENERATED by scripts/gen_attacks.js. Do not edit.
 *
 * The real attack roster, read out of each boss's own dispatcher rather than
 * guessed from object names. An attack is a CONTROLLER OBJECT plus (usually) a
 * \`type\`, because most of these bosses put every attack's logic in one big
 * controller and select between them with that field.
 *
 * To run one: spawn \`controller\`, set \`.type = type\` (when not null), and step.
 *
 * Each attack also carries \`setup\` — its whole dispatcher branch, replayed
 * verbatim with self = the boss — and GML_ATTACKS_BOXSETUP holds each boss's
 * own battle-box block (creates + sizes obj_growtangle, keyed on the selector
 * variable), so the box comes out exactly as the real fight makes it.
 */
window.GML_ATTACKS = ${JSON.stringify(final, null, 1)};

window.GML_ATTACKS_BOXSETUP = ${JSON.stringify(boxSetups, null, 1)};

window.GML_ATTACKS_TURNSETUP = ${JSON.stringify(turnSetups, null, 1)};
`;
fs.writeFileSync(OUT, src, 'utf8');
console.log(`\nwrote ${OUT} (${(src.length / 1024).toFixed(1)} KB)`);
