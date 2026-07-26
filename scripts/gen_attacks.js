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

function chapterDir(n) { return path.join(GML_ROOT, `DELTARUNE Chapter ${n} - GML`); }

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
    if (setup.length > 3500 || (setup.match(/monsterattackname/g) || []).length > 1) setup = null;

    out.push({
      name,
      setup,
      selector: cond ? cond[1] : null,
      choice: cond ? Number(cond[2]) : null,
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

for (const boss of BOSSES) {
  const dir = chapterDir(boss.chNum);
  const bb = extractBoxBlock(dir, boss.boxBlock);
  if (bb) { boxSetups[boss.id] = bb; notes.push(`${boss.id}: box block ${bb.length} chars`); }
  else if (boss.boxBlock) notes.push(`${boss.id}: BOX BLOCK NOT FOUND — check anchor`);
  const tb = extractTurnBlock(dir, boss.turnBlock);
  if (tb) { turnSetups[boss.id] = tb; notes.push(`${boss.id}: turn block ${tb.length} chars`); }
  else if (boss.turnBlock) notes.push(`${boss.id}: TURN BLOCK NOT FOUND — check anchor`);
  // Attack dispatch can live in any event of the enemy object.
  const eventFiles = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.startsWith(`gml_Object_${boss.enemy}_`))
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
}

// De-duplicate: the same (controller, type) can be dispatched from more than one
// branch (difficulty variants). Keep the first, record the alternatives.
const seen = new Map();
const final = [];
for (const a of roster) {
  // pattern/datecount must be part of the key: green entries share controller
  // (null) and all four dates share obj_date_controller with no type.
  const key = `${a.boss}|${a.controller}|${a.type}|${a.pattern}|${a.datecount}`;
  if (seen.has(key)) { seen.get(key).alsoChoices.push(a.choice); continue; }
  a.alsoChoices = [];
  a.hasSpecial = (a.extraFields || []).includes('special');
  a.id = a.launch === 'gerson-green'
    ? `${a.boss}_green${a.pattern}`
    : a.launch === 'pink-date'
      ? `${a.boss}_date${a.datecount}`
      : `${a.boss}_${a.type !== null ? ('type' + String(a.type).replace('.', '_')) : a.controller.replace(/^obj_/, '')}`;
  seen.set(key, a);
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
for (const a of final) {
  const judge = REAL[a.boss];
  a.inFight = judge ? !!judge(a) : true;
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
