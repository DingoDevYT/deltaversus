// Battle: team-based turn loop (party size 1-3). A size-1 team == classic 1v1.
// Phases: select -> waitopp -> reveal -> timing -> waittier -> dodge
//         -> waitresult -> resolve -> (select | gameover)

const BOX = { x: 220, y: 116, w: 200, h: 200 };   // dodge box (square by default)
const SOUL_R = 5;
const GRAZE_R = 15;
// GREEN SOUL (Hammer/Sound of Justice): shield-block mode. Shell colour = hp (blocks still needed),
// per the real Ch4 mapping: 1 cyan, 2 green, 3 yellow, 4 purple, 5 blue, 6-8 pink.
// EXACT obj_spearshot Draw_0 hp->colour (BGR ints -> RGB): 1 yellow, 2 green, 3 cyan, 4 purple, 5 red, 6-8 pink.
const SHELL_COLORS = { 1: '#ffff00', 2: '#00ff00', 3: '#00ffff', 4: '#800080', 5: '#ff0000', 6: '#ff7fb8', 7: '#ffb2d4', 8: '#ffcce2' };
// resolve a bullet against the green shield — EXACT port of obj_spearshot Other_10 (event_user0).
// `len` = distance from the shield centre; blockable at len < shieldRadius (36 for 4-dir, 46 for 8-dir/diag)
// AND the shield facing within the angle tolerance (50 deg for 4-dir, 30 deg for 8-dir). Checked EVERY frame
// while approaching (so aligning late still blocks). Unblocked -> hits the SOUL at len < 16. Parry (axe moved
// within justlength=4 frames) heals 2.5 TP vs 1.25 for a normal block. (GML: shieldlength/shieldradius,
// scr_tensionheal 2.5/1.25, heartcollisionlen 16.)
function resolveGreen(b) {
  const B = Battle, bx = B.dodgeBox, cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2;
  const len = Math.hypot(b.x - cx, b.y - cy);
  const diag = !!B.greenOct;
  let shieldRadius = diag ? 46 : 36, heartLen = 16;             // GML shieldradius / heartcollisionlen
  if (b.shell) { heartLen = diag ? 30 : 16 + 14; if (b.blocksLeft === 1 && !diag) shieldRadius -= 30; }   // bouncespear==1 & hp==1
  const shieldTol = (b.blockArc != null ? b.blockArc : (diag ? 30 : 50)) * Math.PI / 180;
  const inAng = Math.atan2(b.y - cy, b.x - cx);                 // the side the bullet is on / coming from
  if (b.shellRadial && b.shellState) return;                   // mid-bounce (squish/out-arc): no block or hit
  // TRANSFORM bullet (Hammer flips SOUL red<->green): resolves at the ring regardless of aim.
  if (b.transform) {
    if (len < shieldRadius) { B._greenLatch = b.transform === 'green'; if (b.transform === 'red') B._greenOctLatch = false; b.dead = true; B.shake = 10; B.flash = 6; Snd.play('hurt', 0.4); }
    return;
  }
  const aligned = Math.abs(Math.atan2(Math.sin(inAng - B.shieldAng), Math.cos(inAng - B.shieldAng))) < shieldTol;
  if (len < shieldRadius && aligned) {                          // BLOCKED
    const parry = (B.anim.f - (B.shieldFreshF == null ? -999 : B.shieldFreshF)) < 4;   // justlength = 4
    const gain = parry ? 2.5 : 1.25;
    B.shieldFlash = 4;
    if (parry) { B.shieldParry = 7;                                       // parry: white-flash + 3 light sparks off the axe (obj_shield_just_particle)
      B.blockParts = B.blockParts || [];
      for (let k = 0; k < 3; k++) { const pa = inAng - 0.52 + Math.random() * 1.04;
        B.blockParts.push({ x: cx + Math.cos(pa) * 36, y: cy + Math.sin(pa) * 36, vx: Math.cos(B.shieldAng) * 1.4, vy: Math.sin(B.shieldAng) * 1.4, t: 0 }); } }
    B.myTP = Math.min(100, B.myTP + gain); B.tpGained += gain;
    B.blockFx.push({ x: cx + Math.cos(inAng) * shieldRadius, y: cy + Math.sin(inAng) * shieldRadius, t: 0, perfect: parry });
    Snd.play(parry ? 'criticalswing' : 'bell', parry ? 0.5 : 0.4);   // GML: snd_bell block / snd_parry_fast parry
    if (b.shell) {
      b.blocksLeft = (b.blocksLeft || 1) - 1;
      if (b.blocksLeft <= 0) b.dead = true;                     // yellow (hp1) = final: one block finishes, NO bounce
      else if (b.shellRadial) { b.shellState = 1; b.shellSquish = 5; b.sx = 1.5; b.sy = 0.55; if (b.shellSpin) b.shellPosTarget = (b.shellPosTarget == null ? b.shellPosAng : b.shellPosTarget) - Math.PI / 2; }   // SQUASH; squish -> bounce arc; spinning turn ANIMATES 90 CCW
      else {                                                    // legacy cartesian shell bounce
        const outAng = b.shellSpin ? inAng - Math.PI / 2 : inAng, sp = b.shellSpeed || 2.4, dist = shieldRadius + 150;
        b.x = cx + Math.cos(outAng) * dist; b.y = cy + Math.sin(outAng) * dist;
        b.vx = -Math.cos(outAng) * sp; b.vy = -Math.sin(outAng) * sp; b.rot = outAng + Math.PI;
      }
    } else b.dead = true;                                       // regular spears shatter on the shield
    return;
  }
  if (len < heartLen) {                                         // reached the SOUL unblocked -> take the hit
    if (B.iframes <= 0) {
      const dmg = Math.max(1, Math.round((b.dmg || 10) * (b.dmgMult || 1) * (0.9 + Math.random() * 0.2)));
      B.dmgTaken += dmg; const hit = applyTargetedDamage(B.myTeam, dmg, b.target);
      B.iframes = IFRAMES; B.shake = 14; B.flash = 8; Snd.play('hurt');
      B.dmgPops.push({ x: cx, y: cy - 14, txt: '' + dmg, t: 0, color: '#f22' });
      if (hit) { hit.pose = 'hurt'; hit.poseT = 0; }
    }
    b.dead = true;
  }
}
const BOX_ANIM = 16;   // frames for the box open/close spin-in animation
const SELECT_FRAMES = 60 * 60;   // 60s to pick your move
const IFRAMES = 30;   // Deltarune Ch3 i-frames: 30 processed frames = 1s (hz30 attacks process every 2nd 60Hz frame)
const TIER_TP = [4, 10, 18];   // accuracy -> TP

const Battle = {};

// ---------- team helpers ----------
function mkMember(sel) {
  const def = charDef(sel);
  return { sel, def, hp: def.hp, max: def.hp, downed: false, spared: false, frozen: false,
           mercy: 0, tiredFlag: false,   // mercy = how close YOU are to sparing this foe
           action: null, tier: null, pose: 'idle', poseT: 0,
           dark: 0, darkLvl: 0 };   // darkLvl 0..maxLevel = CHARGE progression (darkners only)
}
// a member is "out" if downed OR spared; a team is done when all are out.
function isOut(m) { return m.downed || m.spared; }
function living(team) { return team.filter(m => !isOut(m)); }
function teamDead(team) { return team.every(isOut); }
function frontLiving(team) { for (const m of team) if (!isOut(m)) return m; return null; }
function isTired(m) { return !isOut(m) && (m.tiredFlag || m.hp <= m.max * 0.30); }
function oppMaxLevel() { return Battle.oppTeam.reduce((mx, m) => isOut(m) ? mx : Math.max(mx, m.def.level || 1), 1); }
// which team a member is on (spare conditions are checked against the member's OWN team,
// so they read correctly whether the member is a foe or one of ours)
function teamOf(m) { return Battle.myTeam.indexOf(m) >= 0 ? Battle.myTeam : Battle.oppTeam; }
// can this member currently be SPARED? returns true/false (mercy 100% + their condition).
// Conditions GATE the spare - they do NOT hand out free mercy.
function canSpare(m) {
  if (isOut(m)) return false;
  const sp = m.def.spare || {};
  if (sp.never) return false;
  // PINK's DOKI spare: she is NOT sparable via MERCY %. You spare her by surviving her phases while filling
  // the DOKI meter (collecting doki-hearts) — each fill triggers a DATE minigame — and clearing the FINAL
  // date. She becomes sparable only once all her dates are done (obj_pink_enemy datecount reaches the end).
  if (m.def.dokiSpare) return (Battle.dokiPhase || 0) >= (m.def.dokiPhases || 3);
  if (m.mercy < 100) return false;
  const team = teamOf(m);
  if (sp.alone && living(team).length > 1) return false;                                   // SUSIE: only when she's the last one standing
  if (sp.fullHp && m.hp < m.max) return false;
  if (sp.noKris && team.some(o => !isOut(o) && o.def.base === 'kris')) return false;         // NOELLE: not while a living KRIS is on her team
  return true;
}
// PINK DOKI meter (obj_pink_enemy doki/datecount + scr_dokiadd). Collecting doki-hearts fills it; a full
// meter marks a DATE minigame as due (dokiReady); completing a date advances the phase (dokiAdvancePhase).
function dokiFoe() { return (Battle.oppTeam || []).find(o => o.def && o.def.dokiSpare && !isOut(o)); }
function dokiMaxFor() {   // DOKI needed for the NEXT date, per phase: 10 -> 15 -> 20 (Landon spec)
  const f = dokiFoe(); if (!f) return 100;
  const th = f.def.dokiThresholds || [10, 15, 20];
  return th[Math.min(Battle.dokiPhase || 0, th.length - 1)];
}
function dokiCollect(amt) {
  if (!dokiFoe()) return;
  Battle.doki = Math.min(dokiMaxFor(), (Battle.doki || 0) + (amt || 8));
  if (typeof Snd !== 'undefined') Snd.play('mercyadd', 0.6);   // scr_dokiadd: snd_mercyadd
  if (Battle.doki >= dokiMaxFor()) Battle.dokiReady = true;   // the DOKI meter is FULL -> Pink's next turn is a DATE minigame
}
function dokiAdvancePhase() {   // a DATE minigame was cleared -> advance the phase; after the final date she's sparable
  Battle.dokiPhase = (Battle.dokiPhase || 0) + 1; Battle.doki = 0; Battle.dokiReady = false;
  // HANDICAP: entering the FINAL phase (after the 2nd of 3 dates), Pink's DARKNESS is forced to 0 — she can
  // only FIGHT weak basics during the last DOKI stretch (last chance to KILL) before the final date SPAREs her.
  const f = dokiFoe();
  if (f && Battle.dokiPhase >= ((f.def.dokiPhases || 3) - 1)) f.darkLvl = 0;
}
// one-line description of what it takes to SPARE this foe (shown in the target menu)
function spareHint(def) {
  const sp = def.spare || {};
  if (sp.never) return 'CANNOT be SPARED';
  if (sp.alone) return 'SPARE: only when ALONE';
  if (sp.fullHp) return 'SPARE: only at FULL HP';
  if (sp.noKris) return 'SPARE: not while KRIS is on their team';
  return 'SPARE at 100% MERCY';
}
// an ACT id resolves to one of KRIS's own acts OR a living enemy's per-enemy mercy act
function findAct(id) {
  const k = (CHARS.kris.acts || []).find(a => a.id === id);
  if (k) return k;
  for (const o of (Battle.oppTeam || [])) if (o.def.act && o.def.act.id === id) return o.def.act;
  return null;
}
function moveDefOf(def, a) {
  if (!a) return null;
  if (a.cmd === 'fight') return def.basics ? (def.basics.find(b => b.id === a.move) || def.basics[0]) : def.fight;
  // CHARGE also fires the current basic (single pattern) — or the ULT once maxed.
  if (a.cmd === 'charge') return a.chargeUlt ? def.ult : (def.basics ? (def.basics.find(b => b.id === a.move) || def.basics[0]) : null);
  if (a.cmd === 'magic') return a.move === def.ult.id ? def.ult
    : (def.spells || []).find(s => s.id === a.move) || (def.dokiDates || []).find(s => s.id === a.move)   // PINK DATE moves
      || (def.testMoves || []).find(s => s.id === a.move);   // tester-only scenery entries (e.g. pink_scene)
  if (a.cmd === 'act') return findAct(a.move);
  return null;
}
function patternIdOf(d) { return d && (d.pattern || d.id); }
function isAttack(def) { return !!(def && def.dmg && (def.custom || PATTERNS[patternIdOf(def)])); }

function sfxFor(def) {
  if (MOVE_SFX[def.id]) return MOVE_SFX[def.id];
  const em = def.custom && def.custom.emitters && def.custom.emitters[0];
  const b = em && em.bullet;
  if (b === 'icicle' || b === 'snowflake' || b === 'shard') return 'icespell';
  if (b === 'flame' || b === 'spark' || b === 'star' || b === 'note') return 'spellcast';
  if (b === 'sword' || b === 'crescent' || b === 'dart') return 'swing';
  if (b === 'axe' || b === 'arc' || b === 'arc_red') return 'heavyswing';
  return def.custom && def.custom.ult ? 'ultraswing' : 'swing';
}

const SPELL_POSE = { susie_rude: 'rudebuster', susie_ult: 'rudebuster',
                     snowgrave: 'snowgrave', pacify: 'pacify' };
function poseForAction(a) {
  if (!a) return 'idle';
  if (a.cmd === 'fight') return 'attack';
  if (a.cmd === 'magic') return SPELL_POSE[a.move] || 'spell';
  if (a.cmd === 'act') return 'act';
  if (a.cmd === 'charge') return 'spell';
  if (a.cmd === 'item') return 'item';
  if (a.cmd === 'defend') return 'guard';
  return 'idle';
}

const MOVE_SFX = {
  susie_rude: 'rudebuster', susie_ult: 'rudebuster',
  snowgrave: 'snowgrave', noelle_ice: 'icespell', noelle_snow: 'icespell',
  kris_slash: 'swing', kris_cross: 'swing', kris_giga: 'heavyswing',
  susie_axe: 'heavyswing', ralsei_scarf: 'smallswing', ralsei_ult: 'spellcast',
  lancer_spade: 'swing', lancer_storm: 'spellcast', lancer_bike: 'heavyswing',
  lancer_ult: 'ultraswing',
  berdly_fight: 'swing', berdly_bolt: 'icespell', berdly_books: 'spellcast', berdly_ult: 'ultraswing',
  // Jevil - his own voice/laughs (Ch1 snd_joker_*)
  jevil_spade: 'jokerha', jevil_diamond: 'jokerlaugh', jevil_verticals: 'jokerlaugh', jevil_clubs: 'jokerha',
  jevil_carousel: 'jokerlaugh', jevil_ult: 'jokerchaos',
  // Spamton NEO - his real Ch2 sounds (laser / pipis / overpower voice)
  sneo_heads: 'sneogun', sneo_heart: 'laz', sneo_columns: 'pipis', sneo_phones: 'laz',
  sneo_pipis: 'pipis', sneo_pipisx: 'pipis', sneo_face: 'spamtonlaugh', sneo_bigshot: 'sneoover',
  // The Roaring Knight - the Ch3 board-battle sounds (each attack + its phase variants)
  knight_stars: 'boardsummon', knight_stars2: 'boardsummon', knight_stars3: 'boardsummon',
  knight_tracking: 'knightsword', knight_tracking2: 'knightsword', knight_tracking3: 'knightsword',
  knight_tunnel: 'knightsword', knight_tunnel2: 'knightsword', knight_tunnel3: 'knightsword',
  knight_flurry: 'boardbomb', knight_flurry2: 'boardbomb', knight_flurry3: 'boardbomb',
  knight_rotslash: 'boarddmg', knight_rotslash2: 'boarddmg', knight_rotslash3: 'boarddmg', knight_roar: 'knightlaugh',
};

// ---------- init ----------
Battle.init = function (opts) {
  const B = Battle;
  B.matchN = opts.matchN || 1;
  B.size = opts.size || 1;
  B.doki = 0; B.dokiPhase = 0; B.dokiReady = false;   // PINK DOKI meter / phase (reset each battle)
  B.myTeamSel = opts.myTeam.slice();
  B.oppTeamSel = opts.oppTeam.slice();
  B.myTeam = opts.myTeam.map(mkMember);
  B.oppTeam = opts.oppTeam.map(mkMember);
  B.myTP = 0; B.oppTP = 0;
  B.myItems = (opts.myItems || []).slice();
  B.oppItems = (opts.oppItems || []).slice();
  B.itemsUsed = [];   // shared bag: indices consumed for the whole battle (never refill)
  B.turn = 1;
  B.msg = []; B.msgT = 0;
  B.dmgPops = [];
  B.anim = { f: 0 };
  B.shake = 0; B.flash = 0;
  B.result = null;
  B.rematchMe = false; B.rematchOpp = false;
  B.fxOnMeQueued = null; B.fxOnMe = null;
  B.pacifyOppNext = false; B.pacifyOpp = false;
  B.myPacifiedNext = false; B.myPacified = false;
  B.proceedCount = 0;                 // Kris+Noelle PROCEED streak (3 -> SNOWGRAVE)
  B.myGuardBuff = 0; B.myPowerBuff = 0;   // Northernlight / Lock In turn counters
  B.mirror = null; B.oppSoul = null; B.oppDodging = false;
  Net.handlers = Net.handlers.filter(h => h !== Battle.onMsg);
  Net.on(Battle.onMsg);
  const od0 = B.oppTeam[0].def;
  Snd.playMusic(od0.custom ? od0.theme : Snd.THEME[od0.base]);
  Battle.startSelect(true);
};

Battle.send = function (m) { m.n = Battle.matchN; Net.send(m); };

Battle.onMsg = function (m) {
  const B = Battle;
  if (m.t === 'startMatch') {
    if (!Net.isHost && m.n !== B.matchN)
      Battle.init({ myTeam: B.myTeamSel, oppTeam: B.oppTeamSel, size: B.size,
                    myItems: G.myItems, oppItems: G.oppItems, matchN: m.n });
    return;
  }
  if (m.n != null && m.n !== B.matchN) return;
  if (m.t === 'actions') B.oppActs = m.acts;
  else if (m.t === 'tiers') B.oppTiers = m.tiers;
  else if (m.t === 'dodgeStart') B.oppDodgeStart = m;
  else if (m.t === 'result') B.oppResult = m;
  else if (m.t === 'soul') {
    B.oppSoul = m; B.oppDodging = !m.done;
    if (m.done) B.mirror = null;
    else if (B.mirror) B.mirror.target = Math.max(B.mirror.target, m.f || 0);
  } else if (m.t === 'spare') { const mm = B.myTeam[m.mi]; if (mm && !isOut(mm)) { mm.spared = true; mm.pose = 'idle'; mm.poseT = 0; } }
  else if (m.t === 'snowgrave') { applySnowgrave(B.myTeam, m.mi); }
  else if (m.t === 'demercy') { for (const o of B.oppTeam) if (!isOut(o)) o.mercy = Math.max(0, o.mercy - (m.amt || 10)); }   // foe's MOTIVATE lowers our accrued MERCY on them
  else if (m.t === 'mercysync') { if (m.vals) m.vals.forEach((v, i) => { if (B.myTeam[i] && !isOut(B.myTeam[i])) B.myTeam[i].mercy = v; }); }   // how close the FOE is to sparing our members - live
  else if (m.t === 'rematch') B.rematchOpp = true;
};

Battle.say = function (lines) {
  Battle.msg = Array.isArray(lines) ? lines : [lines];
  Battle.msgT = 130;
};

// ---------- update ----------
Battle.update = function () {
  const B = Battle;
  B.anim.f++;
  // advance character animation clocks HERE (fixed 60Hz), never in render - otherwise anims run at the
  // display's refresh rate (2-2.4x too fast on 120/144Hz, and different host vs client).
  for (const m of B.myTeam || []) m.poseT = (m.poseT || 0) + 1;
  for (const m of B.oppTeam || []) m.poseT = (m.poseT || 0) + 1;
  B.tickMirror();
  if (B.msgT > 0) B.msgT--;
  if (B.shake > 0) B.shake--;
  if (B.flash > 0) B.flash--;
  for (const p of B.dmgPops) p.t++;
  B.dmgPops = B.dmgPops.filter(p => p.t < 70);

  switch (B.phase) {
    case 'select': B.updSelect(); break;
    case 'waitopp': if (B.oppActs) B.startReveal(); break;
    case 'reveal': if (--B.revealT <= 0) B.startTiming(); break;
    case 'timing': B.updTiming(); break;
    case 'waittier': if (B.oppTiers != null) B.startDodge(); break;
    case 'boxin': B.tickBoxAnim(1); if (B.boxT >= BOX_ANIM) { B.boxT = 0; B.boxGhosts = []; B.phase = 'dodge'; } break;
    case 'dodge': B.updDodge(); break;
    case 'boxout': B.tickBoxAnim(-1); if (B.boxT >= BOX_ANIM) { B.boxGhosts = []; B.endDodge(); } break;
    case 'waitresult': if (B.oppResult) B.resolve(); break;
    case 'resolve': if (--B.resolveT <= 0) B.nextTurn(); break;
    case 'gameover':
      if (Input.hit.ok && !B.rematchMe) { B.rematchMe = true; Battle.send({ t: 'rematch' }); }
      if (B.rematchMe && B.rematchOpp && Net.isHost) {
        const n = B.matchN + 1;
        Net.send({ t: 'startMatch', n });
        Battle.init({ myTeam: B.myTeamSel, oppTeam: B.oppTeamSel, size: B.size,
                      myItems: G.myItems, oppItems: G.oppItems, matchN: n });
      }
      break;
  }
};

// ---------- select (per living member) ----------
const MENU = ['fight', 'magic', 'act', 'item', 'defend'];
const CHARGE_COST = [12, 12, 16, 20, 26, 32, 40, 50, 62, 76];   // %TP to CHARGE into level 1..10 (cheap early, painful late)
function chargeCost(lvl) { return CHARGE_COST[Math.max(0, Math.min(lvl, CHARGE_COST.length - 1))]; }
// what unlocks/upgrades at a given darkness level (for the CHARGE announcement in the dialogue box)
function unlocksAtLevel(def, lvl) {
  const out = [];
  for (const b of (def.basics || [])) if (b.darkLvl === lvl) out.push(b.name);
  for (const s of (def.spells || [])) if (s.darkLvl === lvl) out.push(s.name + ' (SPELL)');
  return out;
}
// darkners swap ACT for CHARGE and pay a discounted TP rate on spells
function isDarkner(mem) { return !!(mem && mem.def && mem.def.darkner); }
// Every lightner can SPARE. Only KRIS can ACT (his MAGIC slot becomes ACT); the
// other fun-gang members have no ACT (they only ACT via Kris's dual-acts).
function menuFor(mem) {
  // CHARGE is a DARKNER-only mechanic (Lancer / Jevil / Spamton / Knight). Everyone else SPAREs.
  if (isDarkner(mem)) return ['fight', 'magic', 'charge', 'spare', 'defend'];   // no ITEM; SPARE shows greyed
  if (mem && mem.def && mem.def.base === 'kris') return ['fight', 'act', 'item', 'spare', 'defend'];
  return ['fight', 'magic', 'item', 'spare', 'defend'];
}
function spellCost(mem, d) { return isDarkner(mem) ? Math.ceil(d.tp * 0.6) : d.tp; }
Battle.startSelect = function (fresh) {
  const B = Battle;
  // passive regen: every downed ally recovers 1/8 max HP at the start of the party's turn,
  // standing back up (min 1/6 max) if that clears their debt. (Not on the very first turn.)
  if (!fresh) for (const m of B.myTeam) if (m.downed && !m.frozen) {
    const amt = Math.ceil(m.max / 8), y = teamGroundY(B.myTeam.indexOf(m), B.myTeam.length) - 30;
    if (m._freshDown) {   // the round right AFTER going down: heal the debt but stay DOWN (no cheap instant revive)
      m._freshDown = false;
      m.hp = Math.min(-1, m.hp + amt);
      B.dmgPops.push({ x: 96, y, txt: '+' + amt, t: 0, color: '#2f2' });
    } else {
      healHP(m, amt);
      B.dmgPops.push({ x: 96, y, txt: m.downed ? '+' + amt : 'UP!', t: 0, color: '#2f2' });
    }
  }
  B.cmdOrder = B.myTeam.map((m, i) => i).filter(i => !isOut(B.myTeam[i]));   // skip downed AND spared members
  B.cmdPos = 0;
  for (const m of B.myTeam) { m.action = null; m.tier = null; m.pose = 'idle'; m.poseT = 0; }
  for (const m of B.oppTeam) { m.pose = 'idle'; m.poseT = 0; }
  B.menuIdx = 0; B.submenu = null; B.subIdx = 0;
  B.timer = SELECT_FRAMES;
  B.oppActs = null; B.oppTiers = null; B.oppResult = null; B.oppDodgeStart = null;
  B.tpSpent = 0;   // TP tentatively spent by chosen spells this turn
  B.tpSel = 0;     // TP tentatively GAINED (DEFEND) this turn, shown live
  // B.itemsUsed persists across turns: one shared bag, items are gone once used.
  B.targeting = false; B.pendingCmd = null;
  B.phase = 'select';
  if (!B.cmdOrder.length) { B.say('* ...'); return; }   // defensive: whole party down (normally gameover first)
  B.say('* ' + B.curMember().def.name + ', your move.');
};
Battle.curMember = function () { return Battle.myTeam[Battle.cmdOrder[Battle.cmdPos]]; };
Battle.livingEnemies = function () { return Battle.oppTeam.map((m, i) => i).filter(i => !isOut(Battle.oppTeam[i])); };
Battle.canUseItems = function () { return !Battle.myTeam.some(m => m.def.secretBoss); };
function isHealMove(d) { return !!(d && (d.kind === 'heal' || (d.kind == null && d.heal))); }
function moveById(def, id) {
  if (!id) return null;
  if (def.ult && id === def.ult.id) return def.ult;
  return (def.spells || []).find(s => s.id === id) || findAct(id) || null;
}
// which team an action targets: 'enemy', 'ally', or null (self/party/no target).
function targetSide(cmd, def, move) {
  if (cmd === 'fight' || cmd === 'spare') return 'enemy';
  if (cmd === 'item') return 'ally';
  if (cmd === 'act') {
    const ad = findAct(move);
    if (!ad) return null;
    return (ad.kind === 'attack' || ad.kind === 'mercy' || ad.kind === 'doki') ? 'enemy' : null;   // demercy (MOTIVATE) hits your OWN party -> no target menu
  }
  if (cmd === 'magic') {
    const d = moveById(def, move);
    if (!d) return null;
    if (d.kind === 'heal' || d.kind === 'revive') return 'ally';
    if (d.kind === 'spareTired') return d.scope === 'all' ? null : 'enemy';
    return 'enemy';   // mercy + attack
  }
  return null;
}
function actNeedsTarget(cmd, def, move) { return targetSide(cmd, def, move) != null; }

Battle.updSelect = function () {
  const B = Battle;
  if (B.targeting) { B.updTargeting(); return; }
  const scale = (B.fxOnMe && B.fxOnMe.timerScale) || 1;
  B.timer -= 1 / scale;
  if (B.timer <= 0) { while (B.cmdPos < B.cmdOrder.length) B.commitChoice('defend', null, 0); return; }

  if (!B.submenu) {
    const menu = menuFor(B.curMember());
    if (Input.hit.left) { B.menuIdx = (B.menuIdx + menu.length - 1) % menu.length; Snd.play('menumove'); }
    if (Input.hit.right) { B.menuIdx = (B.menuIdx + 1) % menu.length; Snd.play('menumove'); }
    if (Input.hit.cancel && B.cmdPos > 0) { B.undoLast(); Snd.play('menumove'); }
    if (Input.hit.ok) {
      const cmd = menu[B.menuIdx], mem = B.curMember();
      if (cmd === 'item' && !B.canUseItems()) { Snd.play('cantselect'); }
      else if (cmd === 'spare' && isDarkner(mem)) { Snd.play('cantselect'); }   // darkners can't SPARE (greyed)
      else {
        Snd.play('select');
        if (cmd === 'fight' && mem.def.basics) { B.submenu = 'fight'; B.subIdx = 0; }   // darkner: choose an ACTIVE
        else if (cmd === 'fight' || cmd === 'defend' || cmd === 'charge' || cmd === 'spare') B.choose(cmd, null);
        else { B.submenu = cmd; B.subIdx = 0; }
      }
    }
  } else {
    const opts = B.subOptions();
    B.subIdx = gridNav(B.subIdx, opts.length);
    if (Input.hit.cancel) { B.submenu = null; Snd.play('menumove'); }
    if (Input.hit.ok && opts.length) {
      const o = opts[B.subIdx];
      if (o.disabled) Snd.play('cantselect');
      else { Snd.play('select'); B.choose(o.spare ? 'spare' : B.submenu, o.spare ? null : o.id); }
    }
  }
};

// navigation for a 2-column grid (row-major): left/right within a row, up/down by row.
function gridNav(idx, n) {
  if (!n) return 0;
  let ni = idx;
  if (Input.hit.left) { ni = idx - 1; Snd.play('menumove'); }
  else if (Input.hit.right) { ni = idx + 1; Snd.play('menumove'); }
  else if (Input.hit.up) { ni = idx - 2; Snd.play('menumove'); }
  else if (Input.hit.down) { ni = idx + 2; Snd.play('menumove'); }
  return Math.max(0, Math.min(n - 1, ni));
}

// TP available now, previewing this turn's tentative spends (spells) and
// gains (DEFEND) so you can e.g. Kris-DEFEND to fund Susie's spell.
Battle.tpAvail = function () { return Math.min(100, Battle.myTP - Battle.tpSpent + Battle.tpSel); };

Battle.subOptions = function () {
  const B = Battle, mem = B.curMember(), c = mem.def;
  if (B.submenu === 'fight') {   // darkner FIGHT: pick an unlocked ACTIVE attack (free; unlocks accumulate by level)
    return (c.basics || []).map(b => {
      const gated = b.darkLvl != null && (mem.darkLvl || 0) < b.darkLvl;
      return { id: b.id, label: b.name, cost: gated ? '🌑L' + b.darkLvl : 'FREE', costTP: 0,
               disabled: gated, info: 'Deals ' + b.dmg + ' damage.' };
    });
  }
  if (B.submenu === 'magic') {
    const facingDoki = !!dokiFoe();
    const opt = (s, ult) => {
      const cost = spellCost(mem, s);
      const gated = s.darkLvl != null && (mem.darkLvl || 0) < s.darkLvl;   // locked until you CHARGE to this level
      const snowLock = s.snowgrave && B.proceedCount < 3;   // SNOWGRAVE needs Proceed x3
      let eff = '';
      if (s.kind === 'attack') eff = 'Deals ' + s.dmg + ' damage.';
      else if (s.kind === 'heal') eff = 'Heals ' + s.heal + ' HP.';
      else if (s.kind === 'mercy') eff = 'Raises the foe\'s MERCY.';
      else if (s.kind === 'spareTired') eff = s.scope === 'all' ? 'Spares all TIRED foes.' : 'Spares a TIRED foe.';
      else if (s.kind === 'revive') eff = 'Revives a downed ally.';
      else if (s.kind === 'doki') eff = 'Raises PINK\'s DOKI +' + (s.doki || 1) + '.';
      return { id: s.id, label: s.name, ult,
               cost: snowLock ? 'NEEDx3' : gated ? '🌑L' + s.darkLvl : cost + '%',
               costTP: cost, disabled: snowLock || gated || B.tpAvail() < cost, info: eff };
    };
    const list = (c.spells || []).filter(s => !s.pinkOnly || facingDoki).map(s => opt(s, false));   // FLIRT only shows vs PINK
    if (!isDarkner(mem)) list.push(opt(c.ult, true));   // darkners fire their ULT via CHARGE-at-max, not MAGIC
    return list;
  }
  if (B.submenu === 'act') {
    const opts = [];
    const remaining = new Set(B.cmdOrder.slice(B.cmdPos + 1));   // allies not yet acted
    const facingDoki = !!dokiFoe();
    for (const ad of (c.acts || [])) {
      if (ad.pinkOnly && !facingDoki) continue;   // MegaFlirt only appears when facing PINK
      // dual-acts whose NAMED partner ISN'T on the team at all are hidden entirely (don't waste menu space);
      // otherwise Kris's team-up acts always show (disabled if the partner has already acted / no TP)
      if (ad.ally && ad.ally !== 'any' && !B.myTeam.some(m => m.def.base === ad.ally)) continue;
      let disabled = false, cost = ad.tp ? ad.tp + '%' : 'FREE';
      if (ad.tp && B.tpAvail() < ad.tp) disabled = true;
      if (ad.ally === 'any') {   // MegaFlirt: needs ANY non-Kris ally who hasn't acted yet
        const ai = B.myTeam.findIndex((m, i) => !isOut(m) && m.def.base !== 'kris' && remaining.has(i) && !m.action);
        if (ai < 0) { disabled = true; cost = 'need ALLY'; }
      } else if (ad.ally) {
        const ai = B.myTeam.findIndex((m, i) => !isOut(m) && m.def.base === ad.ally && remaining.has(i) && !m.action);
        if (ai < 0) { disabled = true; cost = 'need ' + ad.ally.toUpperCase(); }
      }
      if (ad.id === 'act_proceed') cost = B.proceedCount >= 2 ? 'x3->SNOW' : 'x' + (B.proceedCount + 1);
      opts.push({ id: ad.id, label: ad.name, cost, disabled, ally: ad.ally, info: ad.text });
    }
    // per-enemy mercy ACTs: each living, sparable foe contributes its own mercy act
    const seen = new Set();
    for (const o of B.oppTeam) {
      if (isOut(o) || (o.def.spare || {}).never || !o.def.act || seen.has(o.def.act.id)) continue;
      seen.add(o.def.act.id);
      const ad = o.def.act;
      opts.push({ id: ad.id, label: ad.name, cost: ad.tp ? ad.tp + '%' : 'FREE',
                  disabled: !!(ad.tp && B.tpAvail() < ad.tp), info: ad.text });
    }
    return opts;
  }
  if (B.submenu === 'item') {
    if (!B.canUseItems()) return [{ id: null, label: 'NO ITEMS (BOSS)', disabled: true }];
    const bag = B.myItems.filter((_, i) => !B.itemsUsed.includes(i));
    if (!bag.length) return [{ id: null, label: '(empty)', disabled: true }];
    return B.myItems.map((it, i) => {
      const d = ITEMS[it];
      const eff = 'Heals ' + (d.heal || 0) + ' HP' + (d.tp ? ' +' + d.tp + ' TP' : '') + '.';
      return { id: i, label: d.name, disabled: B.itemsUsed.includes(i), info: eff, costTP: 0, item: true };
    });
  }
  return [];
};

// route through target-select if the action needs an enemy target and there's
// more than one living enemy; otherwise commit immediately.
Battle.choose = function (cmd, move) {
  const B = Battle, c = B.curMember().def;
  const side = targetSide(cmd, c, move);
  if (side) {
    const md = cmd === 'magic' ? moveById(c, move) : null;
    let cand;
    if (side === 'ally') {
      const revive = md && md.kind === 'revive';
      // heals may target DOWNED allies too (the heal is added to their negative balance / revives them)
      cand = B.myTeam.map((m, i) => i).filter(i => revive ? B.myTeam[i].downed : !B.myTeam[i].spared);
    } else if (md && md.kind === 'spareTired') {
      cand = B.oppTeam.map((m, i) => i).filter(i => isTired(B.oppTeam[i]) && !(B.oppTeam[i].def.spare || {}).never);
    } else {
      cand = B.livingEnemies();
      // a per-enemy mercy ACT only targets the foe(s) that actually own it
      if (cmd === 'act' && !(c.acts || []).some(a => a.id === move))
        cand = cand.filter(i => B.oppTeam[i].def.act && B.oppTeam[i].def.act.id === move);
    }
    if (!cand.length) { Snd.play('cantselect'); B.say('* No valid target!'); B.submenu = null; return; }
    if (cand.length >= 1) {   // ALWAYS open the target menu, even for one foe, so its HP/MERCY is visible
      B.pendingCmd = { cmd, move, side }; B.targetList = cand; B.targetIdx = 0;
      B.targetSideCur = side;
      if (side === 'ally') { const k = cand.indexOf(B.cmdOrder[B.cmdPos]); if (k >= 0) B.targetIdx = k; }
      B.submenu = null; B.targeting = true;
      B.say(side === 'ally' ? '* Use it on whom?' : cmd === 'spare' ? '* Spare whom?' : '* Choose a target.');
      return;
    }
    B.commitChoice(cmd, move, cand[0]);
    return;
  }
  B.commitChoice(cmd, move, 0);
};

Battle.updTargeting = function () {
  const B = Battle;
  B.targetIdx = gridNav(B.targetIdx, B.targetList.length);
  if (Input.hit.cancel) { B.targeting = false; B.pendingCmd = null; Snd.play('menumove'); }
  if (Input.hit.ok) {
    Snd.play('select');
    const p = B.pendingCmd; B.targeting = false; B.pendingCmd = null;
    B.commitChoice(p.cmd, p.move, B.targetList[B.targetIdx]);
  }
};

Battle.commitChoice = function (cmd, move, target) {
  const B = Battle, mem = B.curMember(), c = mem.def;
  const act = { mi: B.cmdOrder[B.cmdPos], cmd, move, seed: randSeed(), target, tside: targetSide(cmd, c, move) };
  if (cmd === 'magic') { const d = moveById(c, move); if (d) B.tpSpent += spellCost(mem, d); }
  else if (cmd === 'act') {
    const ad = findAct(move);
    if (ad && ad.tp) B.tpSpent += ad.tp;
    if (ad && ad.ally) {   // multi-act: consume a not-yet-acted ally's turn as an assist ('any' = any non-Kris ally)
      const match = i => !isOut(B.myTeam[i]) && !B.myTeam[i].action && (ad.ally === 'any' ? B.myTeam[i].def.base !== 'kris' : B.myTeam[i].def.base === ad.ally);
      const ai = B.cmdOrder.slice(B.cmdPos + 1).find(match);
      if (ai != null) { B.myTeam[ai].action = { mi: ai, cmd: 'assist', of: act.mi, seed: randSeed() }; act.assistMi = ai; }
    }
  }
  else if (cmd === 'item') { B.itemsUsed.push(move); act.itemId = B.myItems[move]; }
  else if (cmd === 'defend') B.tpSel += 16;   // instant, visible TP gain
  else if (cmd === 'charge') {
    const lvl = mem.darkLvl || 0, max = mem.def.maxLevel || 10;
    if (lvl >= max) { act.chargeUlt = true; B.tpSpent += 100; }   // MAXED: CHARGE fires the 100%-TP ULT
    else { B.tpSpent += chargeCost(lvl); mem.darkLvl = lvl + 1; act.toLvl = mem.darkLvl; }  // +1 level (curve TP) + basic fires
  }
  mem.action = act;
  B.submenu = null;
  B.advanceCmd();
};

Battle.advanceCmd = function () {
  const B = Battle;
  B.cmdPos++;
  while (B.cmdPos < B.cmdOrder.length && B.myTeam[B.cmdOrder[B.cmdPos]].action) B.cmdPos++;   // skip assists
  if (B.cmdPos < B.cmdOrder.length) { B.menuIdx = 0; B.say('* ' + B.curMember().def.name + ', your move.'); return; }
  B.myTP = Math.max(0, Math.min(100, B.myTP - B.tpSpent + B.tpSel));
  const acts = B.cmdOrder.map(i => B.myTeam[i].action).filter(Boolean);
  Battle.send({ t: 'actions', acts });
  B.phase = 'waitopp';
  B.say('* Waiting for the enemy team...');
};

Battle.undoLast = function () {
  const B = Battle;
  B.cmdPos--;
  while (B.cmdPos > 0) { const a = B.myTeam[B.cmdOrder[B.cmdPos]].action; if (a && a.cmd === 'assist') B.cmdPos--; else break; }
  const mem = B.curMember(), a = mem.action, c = mem.def;
  if (a) {
    if (a.cmd === 'magic') { const d = moveById(c, a.move); if (d) B.tpSpent -= spellCost(mem, d); }
    else if (a.cmd === 'act') {
      const ad = findAct(a.move); if (ad && ad.tp) B.tpSpent -= ad.tp;
      if (a.assistMi != null && B.myTeam[a.assistMi]) B.myTeam[a.assistMi].action = null;
    }
    else if (a.cmd === 'item') { const k = B.itemsUsed.indexOf(a.move); if (k >= 0) B.itemsUsed.splice(k, 1); }
    else if (a.cmd === 'defend') B.tpSel -= 16;
    else if (a.cmd === 'charge') {
      if (a.chargeUlt) B.tpSpent -= 100;
      else { mem.darkLvl = Math.max(0, (mem.darkLvl || 0) - 1); B.tpSpent -= chargeCost(mem.darkLvl); }
    }
  }
  mem.action = null; B.menuIdx = 0;
  B.say('* ' + mem.def.name + ', your move.');
};

// ---------- reveal ----------
Battle.startReveal = function () {
  const B = Battle;
  // bind opp actions onto opp members
  for (const m of B.oppTeam) m.action = null;
  for (const a of B.oppActs) { const m = B.oppTeam[a.mi]; if (m) m.action = a; }
  const lines = [];
  const myAtk = B.myTeam.filter(m => m.action);
  const oppAtk = B.oppTeam.filter(m => m.action);
  if (myAtk[0]) lines.push('* ' + actionText(myAtk[0].def, myAtk[0].action, true));
  if (oppAtk[0]) lines.push('* ' + actionText(oppAtk[0].def, oppAtk[0].action, false));
  B.say(lines.length ? lines : ['* The teams clash!']);
  B.revealT = 110;
  B.phase = 'reveal';
};
function actionText(def, a, mine) {
  const c = def;
  if (a.cmd === 'fight') { const d = moveDefOf(c, a); return d ? d.text : (c.fight ? c.fight.text : c.name + ' attacks!'); }
  if (a.cmd === 'magic') { const d = moveById(c, a.move); return d ? d.text : c.name + ' casts magic!'; }
  if (a.cmd === 'act') { const d = findAct(a.move); return d ? d.text : c.name + ' ACTs.'; }
  if (a.cmd === 'spare') return c.name + ' spares the foe!';
  if (a.cmd === 'assist') return c.name + ' joins the ACT!';
  if (a.cmd === 'item') return c.name + ' uses ' + (a.itemId ? ITEMS[a.itemId].name.toUpperCase() : 'an item') + '!';
  if (a.cmd === 'defend') return c.name + ' braces for impact!';
  if (a.cmd === 'charge') {
    if (a.chargeUlt) return c.ult.text;
    const un = a.toLvl != null ? unlocksAtLevel(c, a.toLvl) : [];
    return c.name + ' draws in the DARKNESS! (LV ' + (a.toLvl != null ? a.toLvl : '?') + ')' + (un.length ? '  Unlocked: ' + un.join(', ') + '!' : '');
  }
  return c.name + ' hesitates!';
}

// ---------- timing: only FIGHT uses the bar; spells fire at full power ----------
// All FIGHT bars are shown at once, but their markers start staggered (Kris,
// then Susie, then Ralsei...) and you press [Z] for each as it reaches the zone.
const TIMING_ZONE = 22;   // half-width of the target zone (smaller = harder)
Battle.startTiming = function () {
  const B = Battle;
  // fixed 'good' tier for spell attackers (they don't time)
  for (const m of B.myTeam) {
    if (m.action && m.action.cmd === 'magic' && isAttack(moveDefOf(m.def, m.action))) m.tier = 1;
  }
  const fighters = B.myTeam.map((m, i) => i).filter(i => B.myTeam[i].action && B.myTeam[i].action.cmd === 'fight');
  if (!fighters.length) { B.finishAllTiming(); return; }
  let delay = 0;
  B.bars = fighters.map((mi, k) => {
    delay += (k === 0 ? 20 : 24 + Math.floor(Math.random() * 22));
    return { mi, x: 470, startDelay: delay, started: false, done: false, tier: null };
  });
  B.barCursor = 0;   // which bar the next [Z] resolves
  B.timeT = 0;
  B.phase = 'timing';
  B.say('* Time your strikes!');
};
Battle.finishAllTiming = function () {
  const B = Battle;
  const tiers = B.myTeam.map((m, i) => (m.action && isAttack(moveDefOf(m.def, m.action))) ? { mi: i, tier: m.tier == null ? 1 : m.tier } : null).filter(Boolean);
  Battle.send({ t: 'tiers', tiers });
  B.sendDodgeStart();
  B.phase = 'waittier';
  B.say('* Bracing...');
};
Battle.applyTimingResult = function (mi, tier) {
  const B = Battle;
  B.myTeam[mi].tier = tier;
  Snd.play(tier === 2 ? 'criticalswing' : tier === 1 ? 'bell' : 'smallswing');
  const gain = TIER_TP[tier];
  B.myTP = Math.min(100, B.myTP + gain);
  if (gain) B.dmgPops.push({ x: 46, y: 250, txt: '+' + gain, t: 0, color: '#ff8000' });
};
Battle.updTiming = function () {
  const B = Battle;
  B.timeT = (B.timeT || 0) + 1;
  for (const bar of B.bars) {
    if (bar.done) continue;
    if (!bar.started && B.timeT >= bar.startDelay) bar.started = true;
    if (bar.started) {
      bar.x -= 4.7;                             // faster than before
      if (bar.x <= -14) { bar.done = true; B.applyTimingResult(bar.mi, 0); }   // missed
    }
  }
  if (Input.hit.ok) {
    const bar = B.bars.find(b => !b.done && b.started) || B.bars.find(b => !b.done);
    if (bar && bar.started) {
      const d = Math.abs(bar.x - 26);
      const tier = d < 3 ? 2 : d < 13 ? 1 : 0;   // tight perfect zone
      bar.done = true; B.applyTimingResult(bar.mi, tier);
    } else Snd.play('cantselect');               // pressed before any bar started
  }
  if (B.bars.every(b => b.done)) B.finishAllTiming();
};

// gather attackers (member+move+tier+seed) for a team's actions
function attackersOf(team, pacifyCap) {
  const out = [];
  for (const m of team) {
    if (!m.action || isOut(m)) continue;   // spared / downed members never attack
    const md0 = moveDefOf(m.def, m.action);
    if (isAttack(md0)) {
      const md = { ...md0, id: patternIdOf(md0) };   // acts carry .pattern; sim keys off .id
      let tier = m.tier == null ? 1 : m.tier;
      if (pacifyCap) tier = 0;
      if (Battle.myPowerBuff && team === Battle.myTeam) md.dmg = Math.round(md.dmg * 2);   // Lock In
      out.push({ def: m.def, moveDef: md, tier, seed: m.action.seed, member: m,
                 target: m.action.target || 0 });
    }
  }
  return out;
}

Battle.sendDodgeStart = function () {
  const B = Battle;
  const atkers = attackersOf(B.myTeam, B.myPacified);
  const atks = atkers.map(a => ({
    base: a.def.base, moveId: a.moveDef.id, custom: a.moveDef.custom || null,
    tier: a.tier, seed: a.seed, target: a.target,
    dur: a.moveDef.dur || (PATTERNS[a.moveDef.id] || {}).dur || 480,
    perHit: Math.round(a.moveDef.dmg * TIER_MULT[a.tier]),
  }));
  Battle.send({ t: 'dodgeStart', atks });
};

// ---------- dodge (combined) ----------
Battle.startDodge = function () {
  const B = Battle;
  // ITEM heals the user just before dodging (DEFEND TP was applied at select)
  for (const m of B.myTeam) {
    const a = m.action; if (!a) continue;
    if (a.cmd === 'item') {
      const it = ITEMS[a.itemId];
      if (it) {
        // items can target downed allies too (heal is added to their negative balance)
        const tgt = (a.tside === 'ally' && B.myTeam[a.target]) ? B.myTeam[a.target] : m;
        if (it.revivePct) { if (!tgt.frozen) { tgt.hp = Math.max(tgt.hp, Math.round(tgt.max * it.revivePct)); if (tgt.downed) { tgt.downed = false; tgt.pose = 'idle'; tgt.poseT = 0; } } }  // revive items bypass the debt, never lower HP - but NOT frozen (SNOWGRAVE)
        else healHP(tgt, it.heal || 0);
        B.myTP = Math.min(100, B.myTP + (it.tp || 0));
        Snd.play('cure');
        const ti = B.myTeam.indexOf(tgt);
        if (it.heal) B.dmgPops.push({ x: 96, y: teamGroundY(ti, B.myTeam.length) - 30, txt: '+' + it.heal, t: 0, color: '#2f2' });
      }
    }
    m.pose = poseForAction(a); m.poseT = 0;
  }

  B.dmgTaken = 0; B.tpGained = 0;
  B.bullets = [];
  B.iframes = 0; B.grazeCd = 0; B.grazeFx = null;
  B.dodgeBox = { ...BOX };
  if (B.fxOnMe && B.fxOnMe.boxScale) {
    const s = B.fxOnMe.boxScale;
    B.dodgeBox.w = Math.round(BOX.w * s); B.dodgeBox.h = Math.round(BOX.h * s);
    B.dodgeBox.x = Math.round(BOX.x + (BOX.w - B.dodgeBox.w) / 2);
    B.dodgeBox.y = Math.round(BOX.y + (BOX.h - B.dodgeBox.h) / 2);
  }
  B.soul = { x: B.dodgeBox.x + B.dodgeBox.w / 2, y: B.dodgeBox.y + B.dodgeBox.h * 0.72 };
  B.hearts = [];
  if (B.fxOnMe && B.fxOnMe.hearts)
    for (let i = 0; i < 7; i++)
      B.hearts.push({ x: B.dodgeBox.x + Math.random() * B.dodgeBox.w, y: B.dodgeBox.y + Math.random() * B.dodgeBox.h,
                      vx: (Math.random() - 0.5) * 1.1, vy: (Math.random() - 0.5) * 1.1 });

  // apply the enemy's timing tiers to their members, then build the combined
  // incoming pattern from all OPP attackers
  if (B.oppTiers) for (const t of B.oppTiers) { const m = B.oppTeam[t.mi]; if (m) m.tier = t.tier; }
  const oppAtkers = attackersOf(B.oppTeam, B.pacifyOpp);
  // per-attack box shape: a solo boss attack can reshape the box (wide/tall/square)
  if (oppAtkers.length === 1 && !(B.fxOnMe && B.fxOnMe.boxScale)) {
    const pb = (PATTERNS[oppAtkers[0].moveDef.id] || {}).box;
    if (pb) {
      const cxC = BOX.x + BOX.w / 2, cyC = BOX.y + BOX.h / 2;
      B.dodgeBox = { w: pb.w, h: pb.h, x: Math.round(cxC - pb.w / 2), y: Math.round(cyC - pb.h / 2) };
      B.soul = { x: B.dodgeBox.x + B.dodgeBox.w / 2, y: B.dodgeBox.y + B.dodgeBox.h * 0.72 };
    }
  }
  if (oppAtkers.length) {
    B.sim = makeCombinedSim(oppAtkers, B.dodgeBox);
    B.dodgeT = B.sim.dur;
    Snd.play(sfxFor(oppAtkers[0].moveDef));
    B.say('* DODGE!');
  } else { B.sim = null; B.dodgeT = 0; }

  // YELLOW SOUL: dodging a boss with soulYellow lets you shoot RIGHT (toward them)
  B.soulYellow = oppAtkers.some(a => a.def.soulYellow);
  B.shots = []; B.charge = 0; B.shootCd = 0; B._okPrev = false; B.pendingLasers = []; B.shotFx = [];
  Snd.stop(B._chargeSnd); B._chargeSnd = null;
  // GREEN SOUL: locked at centre, aim Susie's axe to BLOCK incoming bullets (no movement, no graze).
  B._defGreen = oppAtkers.some(a => a.def.soulGreen);   // whole-attack green; patterns can also toggle it live
  B.soulGreen = false; B._greenLatch = false; B._greenOctLatch = false; B.greenOct = false;
  B.shieldAng = Math.PI / 2; B.shieldTarget = Math.PI / 2; B.shieldDiag = false; B.shieldFreshF = -999; B.blockFx = []; B.blockParts = [];
  if (B.fx) B.fx.bossSprite = null;
  // PURPLE SOUL (Pink): heart rides a virtual grid inside the box (obj_purplecontrols).
  B.soulPurple = false; B._pmode = -1; B.pLaneX = 1; B.pLaneY = 1; B.pOnX = 0; B.pOnY = 0;
  // 30 FPS ATTACKS: DELTARUNE-authored patterns (Gerson) run their sim at 30Hz so raw GML tick values
  // are correct as-written; we render at 60Hz (bullets step every 2nd frame = authentic choppy motion).
  B.hz30 = oppAtkers.length === 1 && (PATTERNS[oppAtkers[0].moveDef.id] || {}).hz30 !== false && (/^(gerson|gn|jevil|pink|pinkn)_/.test(oppAtkers[0].moveDef.id) || !!(PATTERNS[oppAtkers[0].moveDef.id] || {}).hz30);
  B._hzTick = false;
  // fx = pattern-driven engine control channel (blackout / box warp / soul pull / arena / split / arms)
  B.fx = {}; B.baseBox = { ...B.dodgeBox }; B.boardSplit = null;

  // mirror = combined MY attackers (spectator box)
  const myAtkers = attackersOf(B.myTeam, B.myPacified);
  if (myAtkers.length) {
    if (!B.sim) Snd.play(sfxFor(myAtkers[0].moveDef));
    const mbox = { x: 0, y: 0, w: BOX.w, h: BOX.h };
    B.mirror = { sim: makeCombinedSim(myAtkers, mbox), box: mbox, bullets: [], f: 0, target: 0,
                 soul: { x: mbox.w / 2, y: mbox.h * 0.72 } };
  }

  // spin the box open, then dodge (endDodge is deferred to the boxout animation)
  B.boxT = 0; B.boxGhosts = [];
  if (!B.sim) { B.say('* Guard up...'); B.phase = 'boxout'; }
  else B.phase = 'boxin';
};

Battle.tickBoxAnim = function (dir) {
  const B = Battle;
  B.boxT++;
  const p = dir > 0 ? (B.boxT / BOX_ANIM) : (1 - B.boxT / BOX_ANIM);
  const pc = Math.max(0, Math.min(1, p));
  B.boxScaleCur = 1 - Math.pow(1 - pc, 3);                 // easeOut scale
  B.boxRotCur = (B.boxT / BOX_ANIM) * Math.PI * 2 * (dir > 0 ? 1 : -1);
  if (!B.boxGhosts) B.boxGhosts = [];
  B.boxGhosts.push({ s: B.boxScaleCur, rot: B.boxRotCur, alpha: 0.4 });
  for (const g of B.boxGhosts) g.alpha -= 0.08;
  B.boxGhosts = B.boxGhosts.filter(g => g.alpha > 0.03);
};

// Deltarune healing: adds to the (possibly negative) HP balance; a member stands back
// up the moment healing pushes them above 0, bumped to at least 1/6 max HP.
function healHP(m, amt) {
  if (m.frozen) return;   // FROZEN (SNOWGRAVE) members can never be healed or revived
  m.hp = Math.min(m.max, m.hp + amt);
  if (m.downed && m.hp > 0) {
    m.hp = Math.max(m.hp, Math.ceil(m.max / 6));   // minimum stand-up HP
    m.downed = false; m.pose = 'idle'; m.poseT = 0;
  }
}
// SNOWGRAVE execute: ~1000 straight ICE to ONE target, bypassing the downed floor
// (can sink to ~-900), and FREEZES them so they can never be healed/revived. Bosses
// survive one hit early but are then frozen. Returns the hit member.
function applySnowgrave(team, target) {
  const m = (target != null && team[target]) ? team[target] : frontLiving(team);
  if (!m) return null;
  m.hp = Math.max(-999, m.hp - 1000);
  m.frozen = true;
  if (m.hp <= 0 && !m.downed) { m.downed = true; }
  m.pose = 'downed'; m.poseT = 0;
  return m;
}
// targeted damage: hits the member the attacker aimed at (or the front if that one is down).
// lethal damage sinks HP into a NEGATIVE debt, hard-capped at -50% max HP. No cascade.
function applyTargetedDamage(team, dmg, target) {
  const m = (target != null && team[target] && !team[target].downed) ? team[target] : frontLiving(team);
  if (!m) return null;
  m.hp -= dmg;
  if (m.hp <= 0) {
    const floor = -Math.floor(m.max * 0.5);
    if (m.hp < floor) m.hp = floor;                // overkill is absorbed by the -50% floor
    if (!m.downed) { m.downed = true; m._freshDown = true; m.pose = 'downed'; m.poseT = 0; }
  }
  return m;
}

Battle.updDodge = function () {
  const B = Battle;
  if (B.hz30) {
    // buffer directional edge-presses across the SKIPPED 60Hz frame so the purple grid-soul never drops a hop
    if ((B.fx || {}).purpleSoul) { B._pbuf = B._pbuf || {}; for (const k of ['up', 'down', 'left', 'right']) if (Input.hit[k]) B._pbuf[k] = 1; }
    B._hzTick = !B._hzTick; if (!B._hzTick) return;   // 30 FPS attack: process the sim every 2nd 60Hz frame
  }
  const fx = B.fxOnMe || {};
  let sp = 2.4 * (fx.soulSpeed || 1) * (B.hz30 ? 2 : 1);   // at 30Hz, move twice as far per processed frame to keep real-time speed
  let dx = (Input.down.right ? 1 : 0) - (Input.down.left ? 1 : 0);
  let dy = (Input.down.down ? 1 : 0) - (Input.down.up ? 1 : 0);
  if (fx.invertX) dx = -dx;
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }
  B.soul.x += dx * sp; B.soul.y += dy * sp;
  if (fx.drift) B.soul.y += Math.sin(B.anim.f * 0.05) * 0.5;

  // ---- pattern-driven engine fx (set by the pattern on B.fx during the previous tick) ----
  const CF = B.fx || {};
  if (CF.boxTarget) {                     // animate the dodge box toward a target (warp / shrink / full-screen arena)
    const t = CF.boxLerp || 0.14, tg = CF.boxTarget, c = B.dodgeBox;
    c.w += (tg.w - c.w) * t; c.h += (tg.h - c.h) * t; c.x += (tg.x - c.x) * t; c.y += (tg.y - c.y) * t;
  }
  if (CF.pull) {                          // suction: drag the soul toward a point (still escapable)
    const a = Math.atan2(CF.pull.y - B.soul.y, CF.pull.x - B.soul.x);
    B.soul.x += Math.cos(a) * CF.pull.force; B.soul.y += Math.sin(a) * CF.pull.force;
  }
  // BOARD SPLIT: the halves separate OUTWARD from the cut (horizontal cut -> top half
  // moves up, bottom moves down). The soul and riding bullets (b.ridesSplit = +1
  // top/left half, -1 bottom/right) move WITH their half.
  let soulSide = 0;
  if (CF.split) {
    const bx0 = B.dodgeBox, cutC = CF.split.axis === 'h' ? bx0.y + bx0.h / 2 : bx0.x + bx0.w / 2;
    const delta = CF.split.offset - (B._splitPrev || 0);
    soulSide = (CF.split.axis === 'h' ? B.soul.y < cutC : B.soul.x < cutC) ? 1 : -1;
    if (CF.split.axis === 'h') B.soul.y -= delta * soulSide; else B.soul.x -= delta * soulSide;
    for (const b of B.bullets) if (b.ridesSplit) {
      if (CF.split.axis === 'h') b.y -= delta * b.ridesSplit; else b.x -= delta * b.ridesSplit;
    }
    B._splitPrev = CF.split.offset;
  } else B._splitPrev = 0;
  if (CF.arena && !CF.boxTarget) CF.boxTarget = { x: -12, y: -12, w: 664, h: 504 };   // borderless full-screen arena
  if (CF.shake) B.shake = Math.max(B.shake || 0, CF.shake);

  // clamp the soul: to its own (shifted) HALF while the board is split, and inside the
  // pinched trapezoid during the Power-of-NEO suck (right side shrinks height-wise)
  const bx = B.dodgeBox;
  let x0 = bx.x + 4, x1 = bx.x + bx.w - 4, y0 = bx.y + 4, y1 = bx.y + bx.h - 4;
  if (CF.split) {
    const off = CF.split.offset;
    if (CF.split.axis === 'h') { const cy2 = bx.y + bx.h / 2;
      if (soulSide === 1) { y0 -= off; y1 = cy2 - 4 - off; } else { y0 = cy2 + 4 + off; y1 += off; } }
    else { const cx2 = bx.x + bx.w / 2;
      if (soulSide === 1) { x0 -= off; x1 = cx2 - 4 - off; } else { x0 = cx2 + 4 + off; x1 += off; } }
  }
  if (CF.pinch) {
    const t = Math.max(0, Math.min(1, (B.soul.x - bx.x) / bx.w)), inset = CF.pinch * bx.h / 2 * t;
    y0 += inset; y1 -= inset;
  }
  if (CF.boxRot) {   // TILTED box (Gerson hammer-throw): clamp the soul inside the rotated rectangle
    const bcx = bx.x + bx.w / 2, bcy = bx.y + bx.h / 2, ca = Math.cos(-CF.boxRot), sa = Math.sin(-CF.boxRot);
    const dx = B.soul.x - bcx, dy = B.soul.y - bcy;
    let lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
    lx = Math.max(-bx.w / 2 + 4, Math.min(bx.w / 2 - 4, lx)); ly = Math.max(-bx.h / 2 + 4, Math.min(bx.h / 2 - 4, ly));
    const cb = Math.cos(CF.boxRot), sb = Math.sin(CF.boxRot);
    B.soul.x = bcx + lx * cb - ly * sb; B.soul.y = bcy + lx * sb + ly * cb;
  } else {
    B.soul.x = Math.max(x0, Math.min(x1, B.soul.x));
    B.soul.y = Math.max(y0, Math.min(y1, B.soul.y));
  }
  for (const h of B.hearts) { h.x += h.vx; h.y += h.vy; if (h.x < bx.x || h.x > bx.x + bx.w) h.vx *= -1; if (h.y < bx.y || h.y > bx.y + bx.h) h.vy *= -1; }

  // GREEN SOUL: lock the soul dead-centre and aim Susie's axe with the direction keys (it snaps to the
  // 4 sides of the square, or 8 with the octagon). A FRESH press timestamps the aim for the block-timing bonus.
  B.greenOct = !!(CF.greenSoul && CF.greenSoul.oct) || B._greenOctLatch;
  B.soulGreen = !!(B._defGreen || CF.greenSoul || B._greenLatch);
  if (B.soulGreen) {
    B.soul.x = bx.x + bx.w / 2; B.soul.y = bx.y + bx.h / 2;
    const rawx = (Input.down.right ? 1 : 0) - (Input.down.left ? 1 : 0), rawy = (Input.down.down ? 1 : 0) - (Input.down.up ? 1 : 0);
    // Detect the PRESS EDGE from held state (survives 30 Hz). A fresh press = the direction vector changed
    // to a non-zero value — including re-pressing the SAME direction after releasing (GML: re-press parries).
    const wd = B._gWasDir || { x: 0, y: 0 };
    const freshPress = (rawx || rawy) && (rawx !== wd.x || rawy !== wd.y);
    B._gWasDir = { x: rawx, y: rawy };
    if (rawx || rawy) {
      const step = Math.PI * 2 / (B.greenOct ? 8 : 4);
      const ang = Math.round(Math.atan2(rawy, rawx) / step) * step;
      const diff = Math.abs(Math.atan2(Math.sin(ang - (B.shieldTarget == null ? B.shieldAng : B.shieldTarget)), Math.cos(ang - (B.shieldTarget == null ? B.shieldAng : B.shieldTarget))));
      if (diff > 0.01) { B.shieldTarget = ang; B.shieldDiag = !!(rawx && rawy); }
      if (freshPress) B.shieldFreshF = B.anim.f;   // parry window (justlength 4) on any fresh press or re-press
    }
    // EASE the axe toward its target (GML: rep = ceil(|angdiff|*0.666) deg/frame). The BLOCK uses this LIVE
    // shieldAng, so you can rotate INTO a block mid-turn = frame-perfect skilled play. Never snaps instantly.
    if (B.shieldTarget == null) B.shieldTarget = B.shieldAng;
    const d = Math.atan2(Math.sin(B.shieldTarget - B.shieldAng), Math.cos(B.shieldTarget - B.shieldAng));
    B.shieldAng = Math.abs(d) < 0.02 ? B.shieldTarget : B.shieldAng + d * 0.666;
    // NEXT-TO-HIT spear turns red (spr_spear_arrow_highlight): the soonest-arriving spear gets its hiImg.
    const cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2; let soon = null, st = Infinity;
    for (const b of B.bullets) { if (!b.isSpear) continue; const sp = Math.hypot(b.vx, b.vy) || 0.01;
      const tt = (Math.hypot(b.x - cx, b.y - cy)) / sp; if (tt < st) { st = tt; soon = b; } }
    for (const b of B.bullets) if (b.isSpear) b.img = (b === soon) ? b.hiImg : b.loImg;
  }

  // PURPLE SOUL (Pink): the heart rides a virtual GRID inside the box. Buffered direction presses hop
  // it one cell at a time; x_ongrid/y_ongrid EASE to the target cell. mode 1 = 3 lanes + free X; mode 2 = 4x4.
  B.soulPurple = !!CF.purpleSoul;
  if (B.soulPurple) {
    const pm = CF.purpleSoul.mode || 1, ccx = bx.x + bx.w / 2, ccy = bx.y + bx.h / 2;
    const ap = (v, t, s) => Math.abs(t - v) <= s ? t : v + Math.sign(t - v) * s;
    if (B._pmode !== pm) { B._pmode = pm; B.pLaneX = (pm === 4 || pm === 5) ? 0 : (pm === 3 ? 0 : 1); B.pLaneY = pm === 3 ? 0 : 1; B.pOnX = (pm === 4 || pm === 5) ? -63 : 0; B.pOnY = 0; B.pGX = 0; B.pGY = 0; B.pAng = 90; }
    const pb = B._pbuf || {}, H = { up: Input.hit.up || pb.up, down: Input.hit.down || pb.down, left: Input.hit.left || pb.left, right: Input.hit.right || pb.right }, D = Input.down, wsp = 3;
    B._pbuf = {};
    if (pm === 8) {                                   // NODE MAZE (obj_purplecontrols mode 8, obj_pinknode): the
      // heart hops between connected maze nodes; a direction press moves to the neighbour in that direction.
      const T = CF.purpleSoul, nodes = T.nodes || [], edges = T.edges || [];
      if (B._pNode == null || B._mgen !== T.gen) { B._mgen = T.gen; B._pNode = T.start || 0;
        const s0 = nodes[B._pNode] || { x: 0, y: 0 }; B.pOnX = s0.x; B.pOnY = s0.y; }
      const cur = nodes[B._pNode] || { x: 0, y: 0 };
      if (Math.abs(B.pOnX - cur.x) < 1.5 && Math.abs(B.pOnY - cur.y) < 1.5) {   // settled on a node -> accept a hop
        let want = -1;
        if (H.right) want = 0; else if (H.up) want = 1; else if (H.left) want = 2; else if (H.down) want = 3;
        if (want >= 0) {
          const wv = [[1, 0], [0, -1], [-1, 0], [0, 1]][want]; let best = -1, bestDot = 0.35;
          for (const nb of (edges[B._pNode] || [])) { const n = nodes[nb]; if (!n) continue;
            const dx = n.x - cur.x, dy = n.y - cur.y, len = Math.hypot(dx, dy) || 1, dot = (dx / len) * wv[0] + (dy / len) * wv[1];
            if (dot > bestDot) { bestDot = dot; best = nb; } }
          if (best >= 0) { B._pNode = best; Snd.play('graze', 0.2); }
        }
      }
      const tgt = nodes[B._pNode] || { x: 0, y: 0 };
      B.pOnX = ap(B.pOnX, tgt.x, 20); B.pOnY = ap(B.pOnY, tgt.y, 20);   // snappy node-to-node travel
      B.pNodeReached = (Math.abs(B.pOnX - tgt.x) < 1.5 && Math.abs(B.pOnY - tgt.y) < 1.5) ? B._pNode : -1;
      // pOnX/pOnY set; fall through to the shared `B.soul.x = ccx + B.pOnX` (do NOT return — the pattern still runs)
    }
    else if (pm === 2) {                              // 4x4 grid (lane_distance 40, GML obj_fusebomb)
      const xt = (B.pLaneX - 1.5) * 40, yt = (B.pLaneY - 1.5) * 40;
      if (Math.abs(B.pOnX - xt) < 0.5 && Math.abs(B.pOnY - yt) < 0.5) {
        if (H.left && B.pLaneX > 0) B.pLaneX--; else if (H.right && B.pLaneX < 3) B.pLaneX++;
        else if (H.up && B.pLaneY > 0) B.pLaneY--; else if (H.down && B.pLaneY < 3) B.pLaneY++;
      }
      B.pOnX = ap(B.pOnX, (B.pLaneX - 1.5) * 40, 22); B.pOnY = ap(B.pOnY, (B.pLaneY - 1.5) * 40, 22);
    } else if (pm === 4 || pm === 5) {                // 2 vertical lanes (lane_distance 126 -> x = +/-63); free Y (mode 4) or conveyor (mode 5)
      const xt = (B.pLaneX - 0.5) * 126, ymax = bx.h / 2 - 14;
      if (Math.abs(B.pOnX - xt) < 0.5) { if (H.left && B.pLaneX > 0) B.pLaneX--; else if (H.right && B.pLaneX < 1) B.pLaneX++; }
      B.pOnX = ap(B.pOnX, (B.pLaneX - 0.5) * 126, 24);   // _laneswap_speed 24
      const onLane = Math.abs(B.pOnX - (B.pLaneX - 0.5) * 126) < 0.5;
      if (pm === 4 || !onLane) {                      // free vertical
        if (D.down) B.pOnY = Math.min(B.pOnY + wsp, ymax); if (D.up) B.pOnY = Math.max(B.pOnY - wsp, -ymax);
      } else {                                        // mode 5 conveyor: lane 0 pushes DOWN, lane 1 pushes UP (1.25/frame)
        if (B.pLaneX === 0) B.pOnY = Math.min(B.pOnY + 1.25, ymax); else B.pOnY = Math.max(B.pOnY - 1.25, -ymax);
      }
    } else if (pm === 7) {                            // 3-D TUNNEL (obj_purplecontrols mode 7): the heart RIDES one of the
      // 8 expanding rings (tunnel_lane_layer). UP hops INWARD (forward), DOWN hops outward, LEFT/RIGHT swing
      // the heart ±90 degrees around the tunnel. The heart is carried outward as its ring grows and ZOOMS with
      // it (image_xscale = radius/48). GML angles: screen pos = centre + (R*cos(a), -R*sin(a)); 270 = bottom.
      const T = CF.purpleSoul || {};
      if (B._pT7 == null) { B._pT7 = 1; B.pAng = 270; B.pLayer = 0; B.pRotT = 0; B._pShiftSeen = T.shiftN || 0; B.pR = 12; }
      const rings = T.rings || [], lim = T.moveLimit || 131;
      if (T.shiftN != null && T.shiftN !== B._pShiftSeen) { B.pLayer = Math.min(7, B.pLayer + (T.shiftN - B._pShiftSeen)); B._pShiftSeen = T.shiftN; }
      if ((rings[B.pLayer] || 0) <= 0 && B.pLayer > 0) B.pLayer--;   // our ring got recycled -> drop to the next live one
      if (B.pRotT === 0) {
        if (H.left) B.pRotT = -90; else if (H.right) B.pRotT = 90;   // rotate_travel ±90 (discrete swings)
        else if (H.up && B.pLayer > 0) { B.pLayer--; Snd.play('graze', 0.2); }   // heart_travel -1: hop INWARD
        else if (H.down && B.pLayer < 7 && rings[B.pLayer + 1] > 0 && rings[B.pLayer + 1] <= lim && (rings[B.pLayer] || 0) <= lim) { B.pLayer++; Snd.play('graze', 0.2); }
      }
      if (B.pRotT !== 0) {   // GML: _rotation_speed = 4 + |to_go|/6, eased swing
        const spd = 4 + Math.abs(B.pRotT) / 6, st = Math.sign(B.pRotT) * Math.min(spd, Math.abs(B.pRotT));
        B.pAng = ((B.pAng + st) % 360 + 360) % 360; B.pRotT -= st;
        if (Math.abs(B.pRotT) < 0.5) { B.pRotT = 0; B.pAng = Math.round(B.pAng / 90) * 90 % 360; }
      }
      B.pR = ap(B.pR, Math.max(12, rings[B.pLayer] || 12), 9);       // radius follows the ring (eased hop transitions)
      // CAMERA RIDES THE SOUL (GML keeps heart_angle=270, rotates the world via image_angle): the soul stays
      // pinned at the screen bottom and the whole tunnel (rings/zaps/dokis) rotates by viewRot instead, so
      // LEFT/RIGHT never flip meaning at the "top". Everything angular is drawn at worldAngle + pViewRot.
      B.pViewRot = 270 - B.pAng;
      B.pOnX = 0; B.pOnY = B.pR;                                     // soul fixed at screen-bottom (angle 270)
      B.pHScale = Math.max(0.4, B.pR / 48);                          // pseudo-3D zoom (image_xscale = radius/48)
      if (T.wall && B.iframes <= 0) {                               // the electric WALL zaps you if you sit pinned at the edge
        const dmg = 8; B.dmgTaken += dmg; applyTargetedDamage(B.myTeam, dmg, 0);
        B.iframes = IFRAMES; B.shake = 12; B.flash = 6; Snd.play('pinkelectric', 0.5);
      }
    } else if (pm === 3) {                            // ROTATING "+" cross: 5 cells (center + 4 arms at 56), whole box spins
      const ang = ((CF.purpleSoul.rot || 0)) * Math.PI / 180, cs = Math.cos(ang), sn = Math.sin(ang);
      const gx = B.pLaneX * 56, gy = B.pLaneY * 56;   // on-grid (pre-rotation) target
      B.pGX = ap(B.pGX == null ? gx : B.pGX, gx, 20); B.pGY = ap(B.pGY == null ? gy : B.pGY, gy, 20);
      if (Math.abs(B.pGX - gx) < 0.5 && Math.abs(B.pGY - gy) < 0.5) {   // on a cell: accept a (rotation-compensated) hop
        let sd = -1;                                   // screen dir pressed (deg, 0=right,90=down)
        if (H.up) sd = 270; else if (H.down) sd = 90; else if (H.left) sd = 180; else if (H.right) sd = 0;
        if (sd >= 0) {
          let gd = sd - (CF.purpleSoul.rot || 0); gd = ((gd % 360) + 360) % 360; gd = Math.round(gd / 90) * 90 % 360;   // grid-space dir
          if ((gd === 270 || gd === 90) && B.pLaneX === 0) B.pLaneY = Math.max(-1, Math.min(1, B.pLaneY + (gd === 270 ? -1 : 1)));
          else if ((gd === 0 || gd === 180) && B.pLaneY === 0) B.pLaneX = Math.max(-1, Math.min(1, B.pLaneX + (gd === 0 ? 1 : -1)));
        }
      }
      B.pOnX = B.pGX * cs - B.pGY * sn; B.pOnY = B.pGX * sn + B.pGY * cs;   // rotate on-grid into screen space
    } else {                                          // mode 1: 3 horizontal lanes (y), free X within +/-63
      const yt = (B.pLaneY - 1) * 56;
      if (Math.abs(B.pOnY - yt) < 0.5) { if (H.up && B.pLaneY > 0) B.pLaneY--; else if (H.down && B.pLaneY < 2) B.pLaneY++; }
      B.pOnY = ap(B.pOnY, (B.pLaneY - 1) * 56, 20);
      if (D.right) B.pOnX = Math.min(B.pOnX + wsp, 63); if (D.left) B.pOnX = Math.max(B.pOnX - wsp, -63);
    }
    B.soul.x = ccx + B.pOnX; B.soul.y = ccy + B.pOnY;
  }

  // ---- YELLOW SOUL: HOLD the button to charge, RELEASE to fire a shot to the RIGHT.
  //      Hold time = shot size: a quick tap = a small pellet, a long hold = the BIG SHOT.
  //      You can't rapid-fire AND charge at once - it's one shot per press-release. ----
  if (B.soulYellow) {
    const ok = Input.down.ok;
    const BIG_AT = 26;   // frames held to graduate a tap into a BIG SHOT
    if (ok) {
      if (B.charge === 0 && !B._chargeSnd) B._chargeSnd = Snd.hold('sneocharge', 0.5);   // charge whir, looped until release
      B.charge = Math.min(60, B.charge + 1);
    } else if (B._okPrev) {                 // just released -> fire
      Snd.stop(B._chargeSnd); B._chargeSnd = null;
      const c = B.charge, big = c >= BIG_AT;
      // big shot: modest size, its own sneobig sprite, damages each target ONCE (hit set),
      // pierces a whole row (8) so it can clear all 4 heads. small nudge, not a launch.
      B.shots.push({ x: B.soul.x + 8, y: B.soul.y, vx: big ? 8.5 : 8,
                     r: big ? 9 : 4, big, power: big ? 4 : 1, pierce: big ? 8 : 1, hitIds: [] });
      Snd.play(big ? 'sneofire' : 'heartshot', big ? 0.75 : 0.5);   // real heart-shot / big-shot fire
      B.charge = 0;
    } else {
      B.charge = 0;
      if (B._chargeSnd) { Snd.stop(B._chargeSnd); B._chargeSnd = null; }
    }
    B._okPrev = ok;
    for (const s of B.shots) s.x += s.vx;
    B.shots = B.shots.filter(s => !s.dead && s.x < bx.x + bx.w + 220);
    for (const fx of B.shotFx) fx.t++;
    B.shotFx = B.shotFx.filter(fx => fx.t < 15);
  }

  // transient fx are re-requested by the pattern each frame; box target persists so the box can ease back
  B.fx.blackout = false; B.fx.pull = null; B.fx.faceBox = null; B.fx.arms = null; B.fx.bgHue = null; B.fx.knightCone = null;
  B.fx.split = null; B.fx.boss = null; B.fx.hideBox = false; B.fx.pinch = 0; B.fx.arena = false;
  B.fx.bgStars = false; B.fx.shake = 0; B.fx.whiteout = 0; B.fx.crt = false; B.fx.screenCleave = null; B.fx.bombWarn = []; B.fx.pinkGhost = null;   // per-frame telegraphs
  B.fx.audience = null; B.fx.audienceFront = null; B.fx.pinkSing = null; B.fx.pinkFinale = null; B.fx.pinkSplit = null; B.fx.maze = null;
  B.fx.pinkScene = false;   // PINK stage scenery (set truthy by pink_* patterns each tick)
  B.fx.pinkRoll = null;     // rotating-grid scrolling parallax backdrop
  B.fx.attackDone = false;  // a normal attack can signal "wrap up now" (e.g. bombs, ~2s after the last blast)
  B.sim.tick(B.soul, b => { b.t = 0; if (b.vx == null) b.vx = 0; if (b.vy == null) b.vy = 0; if (b.phase0 == null) b.phase0 = Math.random() * 6.28; B.bullets.push(b); }, B.fx);
  if (B.fx.maze) {   // GHOST/BODY MAZE: full-screen takeover; the pattern drives movement/collision itself
    if (B.fx.maze.done) { B._mazeEnd = (B._mazeEnd || 0) + 1;
      if (B._mazeEnd > 20) { B.bullets = []; B.boxT = 0; B.boxGhosts = []; B.phase = 'boxout'; } }
    else B._mazeEnd = 0;
    return;
  }
  if (B.fx.date) {   // DATE minigame: the quiz drives itself; no bullets/soul collision
    if (B.fx.date.done) { B._dateEnd = (B._dateEnd || 0) + 1;
      if (B._dateEnd > 24) { if (!B._dokiDatedThisRun) { B._dokiDatedThisRun = 1; dokiAdvancePhase(); }   // finishing a DATE advances Pink's phase
        B.bullets = []; B.boxT = 0; B.boxGhosts = []; B.phase = 'boxout'; } }
    return;
  }
  B._dokiDatedThisRun = 0;
  if (B.fx.attackDone) B.dodgeT = Math.min(B.dodgeT, 1);   // pattern asked to wrap up -> end via the normal path
  tickPendingLasers(B.bullets, B.dodgeBox);
  if (B.iframes > 0) B.iframes--;
  if (B.grazeCd > 0) B.grazeCd--;
  const front = frontLiving(B.myTeam);
  const defending = front && front.action && front.action.cmd === 'defend';
  const spawned = [];   // bullets emitted by controller bullets this frame (added after the loop)
  for (const b of B.bullets) {
    b.t++;
    if (b.spawnSnd && !b._snd) { b._snd = 1; Snd.play(b.spawnSnd, b.spawnVol != null ? b.spawnVol : 0.6); }   // one-shot sfx on spawn (bike honk, etc.)
    if (b.animKeys && b.animRate) b.img = bulletProps(b.animKeys[Math.floor(b.t / b.animRate) % b.animKeys.length]).img;   // frame-cycled sprite
    if (b.homing) { const d = Math.hypot(B.soul.x - b.x, B.soul.y - b.y) || 1; b.vx += (B.soul.x - b.x) / d * b.homing; b.vy += (B.soul.y - b.y) / d * b.homing; }
    b.vx += b.ax || 0; b.vy += b.ay || 0;
    if (b.fric) { const v = Math.hypot(b.vx, b.vy); if (v > 0) { const nv = Math.max(0, v - b.fric); b.vx *= nv / v; b.vy *= nv / v; } }   // GML friction (neg = accelerate)
    if (b.maxv) { const v = Math.hypot(b.vx, b.vy); if (v > b.maxv) { b.vx *= b.maxv / v; b.vy *= b.maxv / v; } }
    b.x += b.vx; b.y += b.vy;
    if (b.shellRadial) {   // obj_spearshot bouncespear: shell rides a radial `len` inward; on block it SQUISHES
      // then BOUNCES out HIGH (fakespeed -17 + grav 0.9, GML) and falls back in for the next block.
      if (b.shellState === 1) { if (--b.shellSquish <= 0) { b.shellState = 2; b.shellSpeed = -17; b.shellGrav = 0.9; b.sx = 1; b.sy = 1; } }
      else if (b.shellState === 2) { b.shellSpeed += b.shellGrav; b.shellLen -= b.shellSpeed; if (b.shellSpeed >= 0) { b.shellState = 0; b.shellSpeed = b.shellBaseSpeed; } }
      else b.shellLen -= b.shellSpeed;
      // spinning-shell 90deg turn ANIMATES (eases posAng toward target over the bounce, not an instant snap)
      if (b.shellPosTarget != null) { const dd = Math.atan2(Math.sin(b.shellPosTarget - b.shellPosAng), Math.cos(b.shellPosTarget - b.shellPosAng)); b.shellPosAng = Math.abs(dd) < 0.02 ? b.shellPosTarget : b.shellPosAng + dd * 0.2; }
      const scx = B.dodgeBox.x + B.dodgeBox.w / 2, scy = B.dodgeBox.y + B.dodgeBox.h / 2;
      b.x = scx + Math.cos(b.shellPosAng) * b.shellLen; b.y = scy + Math.sin(b.shellPosAng) * b.shellLen;
      b.rot = (b.rot || 0) + (b.shellSpin ? 0.18 : 0.07);
    }
    if (b.orbit) { const o = b.orbit; o.ang += o.w;
      if (o.vx) o.cx += o.vx; if (o.vy) o.cy += o.vy;                                   // the orbit centre can drift
      if (o.center) { o.cx = o.center.cx0 + o.center.ax * Math.sin(b.t * o.center.f); o.cy = o.center.cy0 + o.center.ay * Math.cos(b.t * o.center.f); }   // ...or wander so the centre isn't safe
      if (o.pulse) o.R = o.pulse.base + o.pulse.amp * Math.sin(b.t * o.pulse.freq);     // radius can breathe
      if (o.grow) o.R += o.grow;                                                        // ...or spiral outward (Pink tunnel arrows)
      b.x = o.cx + Math.cos(o.ang) * o.R; b.y = o.cy + Math.sin(o.ang) * o.R;
      b.rot = o.ang + (o.w >= 0 ? Math.PI / 2 : -Math.PI / 2); }                        // arrow points along its orbit
    if (b.carousel) updCarousel(b);   // fake-3D carousel column (Jevil)
    if (b.swing) b.x = b.swing.cx + b.swing.amp * Math.sin(b.t * b.swing.spd + (b.swing.ph || 0));
    if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
    if (b.lerpY != null) b.y += (b.lerpY - b.y) * (b.lerpRate || 0.12);   // ease toward a row and STAY on it
    if (b.spin) b.rot = (b.rot || 0) + b.spin;
    if (b.spinDecay) { b.spin *= b.spinDecay; if (Math.abs(b.spin) < 0.0008) b.spin = 0; }   // rotation eases to a stop (Knight red-slash tell)
    if (b.shrink) b.scale = (b.scale || 1) * b.shrink;   // bullet shrinks over time (eaten dollars)
    if (b.grow) { b.scale = Math.min(b.growMax != null ? b.growMax : 1.5, (b.scale || 0) + b.grow); if (b.scale >= (b.growMax != null ? b.growMax : 1.5)) b.grow = 0; }   // scale-in (Gerson box-hit stars pop from 0)
    if (b.shrinkAfter != null && b.t > b.shrinkAfter) { b.scale = Math.max(0, (b.scale || 1) - (b.shrinkStep || 0.3)); }   // delayed scale-to-0 (pinball star trail)
    if (b.fade && b.life) {   // roar shards: hold full for fadeDelay, then fade OPACITY only; stop hurting once faint
      const fd = b.fadeDelay || 0;
      b.alpha = b.t <= fd ? 1 : Math.max(0, 1 - (b.t - fd) / Math.max(1, b.life - fd));
      if (b.alpha < 0.4) b.noHit = true;
    }
    if (b.redAt != null && b.t >= b.redAt) b.tint = '#f33';   // roar stars turn RED just before shattering
    // axis-tracking sword (Knight directional swords): fade in red at 50%, slide to line up
    // with the soul, then turn white and fire fast (with an SFX)
    if (b.aim) {
      if (b.t < b.aim.delay) {
        const px = Math.cos(b.aim.dir + Math.PI / 2), py = Math.sin(b.aim.dir + Math.PI / 2);
        const rel = (B.soul.x - b.x) * px + (B.soul.y - b.y) * py;
        b.x += px * rel * 0.14; b.y += py * rel * 0.14; b.rot = b.aim.dir;   // points along its firing axis
        b.tint = '#f44'; b.alpha = Math.min(1, b.t / 16) * 0.5; b.noHit = true;
      } else if (b.t === b.aim.delay) {
        b.vx = Math.cos(b.aim.dir) * b.aim.speed; b.vy = Math.sin(b.aim.dir) * b.aim.speed;
        b.tint = null; b.alpha = 1; b.noHit = false; Snd.play('knightsword', 0.6);
      }
    }
    if (b.fireAt != null && b.t === b.fireAt) { b.vx = b.fireVX || 0; b.vy = b.fireVY || 0; b.noHit = false; }   // parked teeth launch
    if (b.tellT != null && --b.tellT <= 0 && !b.armed) { b.armed = true; b.armT = b.armWindow || 10; Snd.play(b.cutSnd || 'boarddmg', b.cutVol != null ? b.cutVol : 0.5); if (b.shakeOnCut) B.shake = Math.max(B.shake, 7); }   // tell -> live cut (+screenshake; cutSnd overrides)
    if (b.armed && b.armT != null && --b.armT <= 0) b.dead = true;
    // controller bullets (climbing head, face parts, giant Spamton) emit projectiles from their LIVE
    // position; emitted children INHERIT the controller's per-hit damage + target (else they'd be 10)
    if (b.emit && !b.dead) {
      const pre = spawned.length;
      b.emit(b, spawned, B.soul, B.dodgeBox, B.fx);
      for (let i = pre; i < spawned.length; i++) {
        if (spawned[i].dmg == null) spawned[i].dmg = b.dmg;
        if (spawned[i].target == null) spawned[i].target = b.target;
      }
    }
    // yellow-soul shots destroy shootable boss bullets (heads / mail / heart)
    if (B.soulYellow && b.shootable) {
      for (const s of B.shots) {
        if (s.hitIds && s.hitIds.indexOf(b) >= 0) continue;   // a single shot damages each target only ONCE
        if (Math.hypot(b.x - s.x, b.y - s.y) < (b.r || 8) + s.r) {
          if (s.hitIds) s.hitIds.push(b);
          if (b.pushOnShot) b.x += (s.big ? 2 : 1) * b.pushOnShot;   // small nudge back toward the boss
          b.hp = (b.hp || 1) - (s.power || (s.big ? 4 : 1));
          if (!s.big || b.breakShot || --s.pierce <= 0) s.dead = true;   // shots BREAK on face parts (breakShot), else big shots pierce
          B.shotFx.push({ x: b.x, y: b.y, t: 0 });   // shot-hit sparkle vfx
          Snd.play('bosshit', 0.4);
          if (b.hp <= 0) {
            b.dead = true; B.myTP = Math.min(100, B.myTP + 2);
            if (b.bomb) B.pendingLasers.push({ x: b.x, y: b.y, t: b.bombDelay || 16 });   // cross laser after a beat
          }
          break;
        }
      }
      if (b.dead) continue;
    }
    if (b.burst && b.t >= b.burst) {
      b.dead = true;
      B.bullets.push(...burstChildren(b));
      continue;
    }
    if (b.noHit) continue;   // cosmetic bullets (cord dots, parked face parts) never collide/graze
    // DOKI HEART (Pink): a COLLECTABLE, not a damaging bullet. It gravitates to the soul when near
    // (obj_dokiheart _pickdist 42), and on pickup grants TP + a small heal. It never hurts you.
    if (b.pickup) {
      const dd = Math.hypot(b.x - B.soul.x, b.y - B.soul.y);
      if (dd < 42) { const dir = Math.atan2(B.soul.y - b.y, B.soul.x - b.x), pull = 1 + ((42 - dd) / 42) * 11; b.x += Math.cos(dir) * pull; b.y += Math.sin(dir) * pull; }
      if (dd < 14 + SOUL_R) {
        b.dead = true;
        const tp = 1;   // Pink hearts are a small +1 TP boost; DOKI is built ONLY via FLIRT acts/spells now
        B.myTP = Math.min(100, B.myTP + tp); B.tpGained += tp;
        B.flash = 4; Snd.play('healspark', 0.5);
        B.dmgPops.push({ x: B.soul.x, y: B.soul.y - 14, txt: '+' + tp, t: 0, color: '#ff8fe0' });
      }
      continue;
    }
    // DEFLECT (Gerson's Rude Buster orb): press OK while the orb is close to knock it back for TP, no damage.
    if (b.deflectable) {
      const dd = Math.hypot(b.x - B.soul.x, b.y - B.soul.y);
      if (Input.down.ok && dd < (b.deflectR || 34)) { b.dead = true; B.myTP = Math.min(100, B.myTP + 3); B.tpGained += 3; B.flash = 6; B.shake = Math.max(B.shake, 6); Snd.play('criticalswing', 0.5); B.blockFx = B.blockFx || []; B.blockFx.push({ x: b.x, y: b.y, t: 0, perfect: true }); continue; }
    }
    if (B.soulGreen && b.shape !== 'line') { resolveGreen(b); continue; }   // green mode: block-or-take-it at the shield ring (no graze)
    if (b.shape === 'line' && !b.armed) continue;   // a tell-line only hurts once the Knight actually cuts (armed)
    // line hitbox: perpendicular distance to the (rotated) line through b, within its length
    let lineHit = false;
    if (b.shape === 'line') {
      const nx = -Math.sin(b.rot || 0), ny = Math.cos(b.rot || 0);
      const perp = Math.abs((B.soul.x - b.x) * nx + (B.soul.y - b.y) * ny);
      const along = Math.abs((B.soul.x - b.x) * Math.cos(b.rot || 0) + (B.soul.y - b.y) * Math.sin(b.rot || 0));
      lineHit = perp < (b.thick || 6) / 2 + SOUL_R && along < (b.len || 400) / 2 + SOUL_R;
    }
    // rectangular hitbox (hitW/hitH) for wall-shaped bullets (BIG SHOT, teeth); hitDX shifts it toward the
    // visible sprite (so the empty "tail" behind a BIG SHOT doesn't hit); else circular
    const rectHit = b.hitW && Math.abs(b.x + (b.hitDX || 0) - B.soul.x) < b.hitW / 2 + SOUL_R && Math.abs(b.y - B.soul.y) < b.hitH / 2 + SOUL_R;
    const dist = Math.hypot(b.x - B.soul.x, b.y - B.soul.y);
    if (lineHit || rectHit || (!b.hitW && b.shape !== 'line' && dist < (b.r || 6) + SOUL_R)) {
      if (b.transform) { B._greenLatch = b.transform === 'green'; if (b.transform === 'red') B._greenOctLatch = false; b.dead = true; B.flash = 6; Snd.play('hurt', 0.4); continue; }   // Hammer's red<->green transform bullet
      if (B.iframes <= 0) {
        const tgtDef = (b.target != null && B.myTeam[b.target] && B.myTeam[b.target].action && B.myTeam[b.target].action.cmd === 'defend');
        const guard = B.myGuardBuff > 0 ? 0.5 : 1;   // Northernlight damage shield
        const dmg = Math.max(1, Math.round((b.dmg || 10) * (b.dmgMult || 1) * ((defending || tgtDef) ? 0.5 : 1) * guard * (0.9 + Math.random() * 0.2)));
        B.dmgTaken += dmg;
        const hit = applyTargetedDamage(B.myTeam, dmg, b.target);
        B.iframes = IFRAMES; B.shake = 14; B.flash = 8;
        Snd.play('hurt');
        B.dmgPops.push({ x: B.soul.x, y: B.soul.y - 14, txt: '' + dmg, t: 0, color: '#f22' });
        if (hit) { hit.pose = 'hurt'; hit.poseT = 0; }
      }
    } else if (dist < (b.r || 6) + (b.grazeR || GRAZE_R) && B.grazeCd <= 0 && b.t > 2) {
      const gain = defending ? 3 : 2;
      B.myTP = Math.min(100, B.myTP + gain); B.tpGained += gain; B.grazeCd = 10;
      Snd.play('graze', 0.35); B.grazeFx = { x: B.soul.x, y: B.soul.y, t: 8 };
    }
  }
  if (B.grazeFx && --B.grazeFx.t <= 0) B.grazeFx = null;
  if (B.blockFx && B.blockFx.length) { for (const fx of B.blockFx) fx.t++; B.blockFx = B.blockFx.filter(fx => fx.t < 8); }
  if (B.blockParts && B.blockParts.length) { for (const p of B.blockParts) { p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9; p.t++; } B.blockParts = B.blockParts.filter(p => p.t < 14); }
  if (B.fx && B.fx.bossSprite && B.fx.bossSprite.ttl != null && --B.fx.bossSprite.ttl <= 0) B.fx.bossSprite = null;   // Gerson attack-pose auto-expires back to idle
  if (B.shieldFlash > 0) B.shieldFlash--;
  if (B.shieldParry > 0) B.shieldParry--;
  for (const nb of spawned) { nb.t = nb.t || 0; if (nb.vx == null) nb.vx = 0; if (nb.vy == null) nb.vy = 0; if (nb.phase0 == null) nb.phase0 = Math.random() * 6.28; B.bullets.push(nb); }
  // Green spears/shells spawn FAR offscreen (len = speed*frames, up to ~900px) and fly in — exempt them from the
  // position cull (they self-expire via `life`). Everything else is culled at wide bounds (Pink cats at box±416).
  B.bullets = B.bullets.filter(b => !b.dead && (!b.life || b.t < b.life) && (b.isSpear || b.shellRadial || (b.x > -130 && b.x < 790 && b.y > -130 && b.y < 610)));

  if (B.anim.f % 4 === 0)
    Battle.send({ t: 'soul', x: (B.soul.x - bx.x) / bx.w, y: (B.soul.y - bx.y) / bx.h, f: B.sim ? B.sim.f : 0, done: false });

  if (--B.dodgeT <= 0 || teamDead(B.myTeam)) { B.bullets = []; B.boxT = 0; B.boxGhosts = []; B.phase = 'boxout'; }
};

Battle.tickMirror = function () {
  const B = Battle, M = B.mirror;
  if (!M || !B.oppDodging) return;
  M.target = Math.max(M.target, M.f + 1);
  let steps = Math.min(3, M.target - M.f, M.sim.dur - M.f);
  if (B.oppSoul) { M.soul.x = B.oppSoul.x * M.box.w; M.soul.y = B.oppSoul.y * M.box.h; }
  while (steps-- > 0) {
    M.sim.tick(M.soul, b => { b.t = 0; if (b.vx == null) b.vx = 0; if (b.vy == null) b.vy = 0; if (b.phase0 == null) b.phase0 = Math.random() * 6.28; M.bullets.push(b); });
    M.f++;
    for (const b of M.bullets) {
      b.t++;
      if (b.homing) { const d = Math.hypot(M.soul.x - b.x, M.soul.y - b.y) || 1; b.vx += (M.soul.x - b.x) / d * b.homing; b.vy += (M.soul.y - b.y) / d * b.homing; }
      b.vx += b.ax || 0; b.vy += b.ay || 0;
      if (b.fric) { const v = Math.hypot(b.vx, b.vy); if (v > 0) { const nv = Math.max(0, v - b.fric); b.vx *= nv / v; b.vy *= nv / v; } }
      if (b.maxv) { const v = Math.hypot(b.vx, b.vy); if (v > b.maxv) { b.vx *= b.maxv / v; b.vy *= b.maxv / v; } }
      b.x += b.vx; b.y += b.vy;
      if (b.orbit) { const o = b.orbit; o.ang += o.w; if (o.vx) o.cx += o.vx; if (o.vy) o.cy += o.vy;
        if (o.center) { o.cx = o.center.cx0 + o.center.ax * Math.sin(b.t * o.center.f); o.cy = o.center.cy0 + o.center.ay * Math.cos(b.t * o.center.f); }
        if (o.pulse) o.R = o.pulse.base + o.pulse.amp * Math.sin(b.t * o.pulse.freq);
        b.x = o.cx + Math.cos(o.ang) * o.R; b.y = o.cy + Math.sin(o.ang) * o.R; }
      if (b.carousel) updCarousel(b);
      if (b.swing) b.x = b.swing.cx + b.swing.amp * Math.sin(b.t * b.swing.spd + (b.swing.ph || 0));
      if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
      if (b.spin) b.rot = (b.rot || 0) + b.spin;
      if (b.burst && b.t >= b.burst) {
        b.dead = true;
        M.bullets.push(...burstChildren(b));
      }
    }
    M.bullets = M.bullets.filter(b => !b.dead && b.x > -80 && b.x < M.box.w + 80 && b.y > -80 && b.y < M.box.h + 80 && (!b.life || b.t < b.life));
  }
};

Battle.endDodge = function () {
  const B = Battle;
  Snd.stop(B._chargeSnd); B._chargeSnd = null;   // never let the charge whir bleed past the dodge
  B.bullets = []; B.sim = null;
  Battle.send({ t: 'soul', x: 0.5, y: 0.5, done: true });
  // spell heals / revive / dual-heal resolve after dodging
  const healMember = (tgt, amt) => {
    if (!tgt || !amt) return;
    const wasDown = tgt.downed;
    healHP(tgt, amt); Snd.play('cure');
    B.dmgPops.push({ x: 96, y: teamGroundY(B.myTeam.indexOf(tgt), B.myTeam.length) - 30, txt: wasDown && !tgt.downed ? 'REVIVE' : '+' + amt, t: 0, color: '#2f2' });
  };
  B.usedSnowgrave = false;
  for (const m of B.myTeam) {
    const a = m.action; if (!a) continue;
    if (a.cmd === 'magic') {
      const d = moveById(m.def, a.move); if (!d) continue;
      if (isHealMove(d)) healMember((a.tside === 'ally' && B.myTeam[a.target] && !isOut(B.myTeam[a.target])) ? B.myTeam[a.target] : m, d.heal);
      else if (d.heal) healMember(m, d.heal);           // attack+heal ult (DREAM CHORUS)
      if (d.kind === 'revive') {
        const t = B.myTeam[a.target];
        if (t && t.downed && !t.frozen) { t.downed = false; t.hp = Math.round(t.max * (d.revive || 0.5)); t.pose = 'idle'; t.poseT = 0; Snd.play('cure'); B.dmgPops.push({ x: 96, y: teamGroundY(a.target, B.myTeam.length) - 30, txt: 'REVIVE', t: 0, color: '#2f2' }); }
      }
      if (d.snowgrave) { B.usedSnowgrave = true; B.snowgraveTarget = a.target != null ? a.target : 0; }
    } else if (a.cmd === 'act') {
      const ad = findAct(a.move);
      if (ad && ad.kind === 'healAll') for (const tm of B.myTeam) if (!isOut(tm)) healMember(tm, ad.heal);
    }
  }
  if (B.usedSnowgrave) Battle.send({ t: 'snowgrave', mi: B.snowgraveTarget });
  B.myResult = { t: 'result', dmgTaken: B.dmgTaken,
                 hp: B.myTeam.map(m => m.hp), downed: B.myTeam.map(m => m.downed), tp: B.myTP };
  Battle.send(B.myResult);
  B.phase = 'waitresult';
  B.say('* Waiting for result...');
};

// ---------- resolve ----------
Battle.resolve = function () {
  const B = Battle;
  const r = B.oppResult;
  // apply opponent's authoritative team state
  if (r.hp) r.hp.forEach((hp, i) => { if (B.oppTeam[i]) B.oppTeam[i].hp = hp; });
  if (r.downed) r.downed.forEach((dn, i) => { if (B.oppTeam[i]) { B.oppTeam[i].downed = dn; if (dn) B.oppTeam[i].pose = 'downed'; } });
  B.oppTP = r.tp != null ? r.tp : B.oppTP;
  if (r.dmgTaken > 0) {
    Snd.play('damage');
    B.dmgPops.push({ x: 530, y: 200, txt: '' + r.dmgTaken, t: 0, color: '#f22' });
    const oh = frontLiving(B.oppTeam); if (oh) { oh.pose = 'hurt'; oh.poseT = 0; }
    B.shake = Math.max(B.shake, 8);
  }

  B.fxOnMeQueued = null; B.myPacifiedNext = false; B.pacifyOpp = false;

  // resolve MY mercy / spare / buff / proceed effects (SNOWGRAVE forces a wipe)
  Battle.applyMyEffects();
  if (B.usedSnowgrave) { const t = applySnowgrave(B.oppTeam, B.snowgraveTarget);
    if (t) { B.dmgPops.push({ x: 530, y: 200, txt: 'FROZEN', t: 0, color: '#8cf' }); Snd.play('snowgrave'); } }

  const lines = [];
  if (r.dmgTaken > 0) lines.push('* Enemy team took ' + r.dmgTaken + ' damage!');
  if (B.dmgTaken > 0) lines.push('* Your team took ' + B.dmgTaken + ' damage!');
  if (B.mercyMsg) { lines.push(B.mercyMsg); B.mercyMsg = null; }
  if (!lines.length) lines.push('* The tension rises...');
  B.say(lines);

  const myDead = teamDead(B.myTeam), oppDead = teamDead(B.oppTeam);
  if (myDead || oppDead) {
    B.result = myDead ? (oppDead ? 'draw' : 'lose') : 'win';
    B.phase = 'gameover';
    // battle over: any surviving team's downed allies get back UP at 1/8 max HP (Deltarune rule)
    if (!myDead) for (const m of B.myTeam) if (m.downed && !m.spared) { m.hp = Math.ceil(m.max / 8); m.downed = false; }
    for (const m of B.myTeam) if (!isOut(m)) { m.pose = B.result === 'win' ? 'victory' : 'idle'; m.poseT = 0; }
    for (const m of B.oppTeam) if (!isOut(m)) { m.pose = B.result === 'lose' ? 'victory' : 'idle'; m.poseT = 0; }
    if (B.result === 'win') { Snd.stopMusic(); Snd.play('won'); }
    else if (B.result === 'lose') Snd.playMusic('game_over');
    else Snd.stopMusic();
    return;
  }
  B.resolveT = 110; B.phase = 'resolve';
};

// resolve MY team's non-attack support actions (mercy / spare / spareTired /
// buffs / proceed). Mercy is a LOCAL view of the enemy; spares are synced.
Battle.applyMyEffects = function () {
  const B = Battle;
  // mercy gained scales by the foe's resistance (super bosses build MERCY very slowly ~20 turns)
  const grantMercy = (i, amt) => { const o = B.oppTeam[i]; if (o && !isOut(o)) o.mercy = Math.min(100, o.mercy + amt * (o.def.mercyGain != null ? o.def.mercyGain : 1)); };
  const doSpare = (i, tiredOnly) => {
    const o = B.oppTeam[i]; if (!o || isOut(o)) return false;
    if ((o.def.spare || {}).never) return false;
    if (tiredOnly ? isTired(o) : canSpare(o)) { o.spared = true; o.pose = 'idle'; o.poseT = 0; Battle.send({ t: 'spare', mi: i }); Snd.play('spare'); B.mercyMsg = '* ' + o.def.name + ' was SPARED!'; return true; }
    return false;
  };
  let usedProceed = false;
  const spareCmds = [], spareTireds = [];   // SPARES are deferred to the very END (see below)
  // PASS 1: all the MERCY-changing effects (grants / MOTIVATE / PROCEED), plus buffs
  for (const m of B.myTeam) {
    const a = m.action; if (!a) continue;
    if (a.cmd === 'magic') {
      const d = moveById(m.def, a.move); if (!d) continue;
      if (d.kind === 'mercy') grantMercy(a.target, d.mercy || 15);
      else if (d.kind === 'spareTired') spareTireds.push(d.scope === 'all' ? 'all' : a.target);
      else if (d.kind === 'doki') dokiCollect(d.doki || 1);   // PINK: Susie/Ralsei FLIRT spell fills the DOKI meter
    } else if (a.cmd === 'act') {
      const ad = findAct(a.move); if (!ad) continue;
      if (ad.mercy) grantMercy(a.target, ad.mercy);
      if (ad.kind === 'doki') dokiCollect(ad.doki || 1);   // PINK: Kris FLIRT / MegaFlirt fills the DOKI meter
      if (ad.kind === 'demercy') {   // MOTIVATE: Kris rallies his OWN party - shave MERCY off each of them
        const amt = ad.mercyDown || 10;                                   // so the foe must rebuild to spare your team
        for (const t of B.myTeam) if (!isOut(t)) t.mercy = Math.max(0, (t.mercy || 0) - amt);
        B.send({ t: 'demercy', amt });                                    // authoritative: the foe lowers their accrued MERCY on us too
        B.mercyMsg = '* KRIS motivates the party! Their MERCY drops!';
      }
      if (ad.kind === 'buff') { if (ad.buff === 'guard') B.myGuardBuff = 3; if (ad.buff === 'power') B.myPowerBuff = 3; }
      if (ad.kind === 'proceed') usedProceed = true;
    } else if (a.cmd === 'spare') spareCmds.push(a.target);
  }
  // using PROCEED sways an enemy NOELLE (+20% MERCY toward sparing her)
  if (usedProceed) for (const o of B.oppTeam) if (!isOut(o) && o.def.base === 'noelle') o.mercy = Math.min(100, o.mercy + 20);
  // PASS 2: SPARES resolve LAST, against the FINAL mercy - regardless of who acted in what order.
  for (const t of spareTireds) { if (t === 'all') B.oppTeam.forEach((o, i) => doSpare(i, true)); else doSpare(t, true); }
  for (const t of spareCmds) doSpare(t, false) || (B.mercyMsg = '* ...it wasn\'t enough to SPARE.');
  // push the fresh enemy MERCY to the foe so their own-party bar updates immediately (both ends stay in sync)
  B.send({ t: 'mercysync', vals: B.oppTeam.map(o => o.mercy) });
  // PROCEED streak (3 in a row, nobody down) unlocks SNOWGRAVE
  const anyDown = B.myTeam.some(m => m.downed);
  if (B.usedSnowgrave || anyDown) B.proceedCount = 0;
  else if (usedProceed) B.proceedCount = Math.min(3, B.proceedCount + 1);
  else B.proceedCount = 0;
};

Battle.nextTurn = function () {
  const B = Battle;
  B.turn++;
  B.fxOnMe = B.fxOnMeQueued; B.fxOnMeQueued = null;
  B.myPacified = B.myPacifiedNext; B.myPacifiedNext = false;
  if (B.myGuardBuff > 0) B.myGuardBuff--;
  if (B.myPowerBuff > 0) B.myPowerBuff--;
  B.mirror = null; B.oppDodging = false; B.oppSoul = null;
  B.startSelect(false);
};

// ---------- render ----------
Battle.render = function (ctx) {
  const B = Battle;
  ctx.save();
  if (B.shake > 0) ctx.translate((Math.random() - 0.5) * B.shake * 0.8, (Math.random() - 0.5) * B.shake * 0.8);
  const blackout = B.phase === 'dodge' && B.fx && B.fx.blackout;
  if (blackout) {
    // full blackout (Spamton's BIG SHOT / the Knight's ROAR): only the box + soul + TP show.
    if (B.fx.bgHue != null) { ctx.fillStyle = 'hsl(' + Math.round(B.fx.bgHue) + ',65%,10%)'; ctx.fillRect(0, 0, 640, 480); }
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480); }
    if (B.fx.bgStars) {   // twinkling white star specks drifting in the void
      for (let i = 0; i < 46; i++) {
        const px = (i * 137 + B.anim.f * (0.2 + (i % 3) * 0.15)) % 640;
        const py = (i * 89 + Math.floor(i / 7) * 53) % 480;
        ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(B.anim.f * 0.05 + i));
        ctx.fillStyle = '#fff'; ctx.fillRect(px, py, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }
  } else if (B.fx && B.fx.pinkRoll) {
    drawPinkRoll(ctx, B.fx.pinkRoll);   // rotating-grid: linear-scrolling parallax backdrop (box appears to roll)
    B.renderChars(ctx);
  } else if (B.fx && B.fx.pinkScene) {
    drawPinkSceneBack(ctx);   // PINK stage: black void + MEWERS LIVE + bg dancers + petals
    B.renderChars(ctx);
  } else {
    const bg = A.bgFrame(B.anim.f);
    if (bg && bg.width) { ctx.globalAlpha = 0.55; ctx.drawImage(bg, 0, 0, 640, 480); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480); }
    B.renderChars(ctx);
  }
  B.renderBoxAndBullets(ctx);
  if (B.fx && B.fx.pinkScene && !blackout) drawPinkSceneFront(ctx);   // fg dancers in front of the box
  B.renderMirror(ctx);
  // DATE/MAZE full-screen takeovers hide the HUD only WHILE dodging (boxin/dodge/boxout). Back in select/etc,
  // always show the menu again even though B.fx (stale from the last attack) may still hold .date/.maze.
  const dodgeTakeover = (B.phase === 'boxin' || B.phase === 'dodge' || B.phase === 'boxout') && B.fx && (B.fx.date || B.fx.maze);
  if (!dodgeTakeover) B.renderHud(ctx);
  if (!dodgeTakeover) drawDokiBar(ctx);   // PINK's DOKI meter (spare progress)
  B.renderMsg(ctx);
  if (B.phase === 'timing') B.renderTiming(ctx);
  if (B.phase === 'gameover') B.renderGameover(ctx);
  for (const p of B.dmgPops) {
    const dy = Math.max(0, 12 - p.t) * 1.2;
    drawText(ctx, 'big', p.txt, p.x, p.y - 20 - dy + (p.t > 50 ? (p.t - 50) : 0), { color: p.color, align: 'center', scale: 0.7 });
  }
  if (B.flash > 0) { ctx.fillStyle = 'rgba(255,0,0,' + (B.flash / 40) + ')'; ctx.fillRect(0, 0, 640, 480); }
  if (B.fx && B.fx.crt) {
    ctx.save();
    const wobble = Math.sin(B.anim.f * 0.35) * 2.5 + ((B.anim.f % 11 < 3) ? (Math.sin(B.anim.f * 1.7) * 4) : 0);
    ctx.translate(wobble, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < 480; y += 3) {
      const vWave = Math.sin(B.anim.f * 0.08 + y * 0.02) * 1.5;
      ctx.fillRect(vWave, y, 640, 1.2);
    }
    if ((B.anim.f % 7) < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, (B.anim.f * 29) % 476, 640, 5);
    }
    ctx.restore();
  }
  if (B.fx && B.fx.shake > 8) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.drawImage(ctx.canvas, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
    ctx.restore();
  }
  if (B.fx && B.fx.screenCleave) {
    const p = B.fx.screenCleave.progress || 0;
    const shift = Math.min(280, p * 4 + Math.pow(p * 0.14, 2));
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(320 - shift, 0, shift * 2, 480);
    ctx.restore();
  }
  if (B.fx && B.fx.whiteout > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, B.fx.whiteout) + ')'; ctx.fillRect(0, 0, 640, 480); }
  ctx.restore();
};

const LOOP_POSES = { idle: 1, guard: 1 };
const HOLD_POSES = { downed: 1, victory: 1, hurt: 1 };
function drawCharAnim(ctx, def, pose, tFrames, x, groundY, flip, alpha, scale) {
  const an = A.anim(def.base, pose) || A.anim(def.base, 'idle');
  if (!an) return true;
  const ms = tFrames * (1000 / 60);
  const done = !LOOP_POSES[pose] && ms >= an.total;
  let im = A.animFrame(an, ms, !!LOOP_POSES[pose]);
  if (im && im.width) {
    const fl = ENEMY_FACING[def.base] ? !flip : flip;
    const cy0 = groundY - im.height / 2 * (scale || 1) + (def.yoff || 0);
    // flowing HAIR (Gerson: spr_gerson_hair) — drawn behind his head, same layer, PIVOTING at the sprite's
    // LEFT EDGE (origin 0,18) which sits on the back of his head; it flows backward.
    if (def.hair && typeof bulletProps === 'function') {
      const H = def.hair, hsc = (scale || 1) * (H.scale || 1), hf = bulletProps(H.key + (Math.floor(tFrames / (H.rate || 6)) % (H.n || 5))).img;
      if (hf && hf.width) { const back = fl ? 1 : -1, hw = hf.width * hsc * 1.6 / 2;
        // shift the (centred) sprite by +halfWidth along the flow so its LEFT EDGE lands on the head anchor
        drawSpr(ctx, hf, x + back * ((H.dx || 0) + hw), cy0 + (H.dy || 0) + Math.sin(tFrames * 0.1) * 1.5, { scale: hsc, flip: fl, alpha }); }
    }
    if (def.hue) im = A.hued(im, def.hue);
    drawSpr(ctx, im, x, cy0, { scale: scale || 1, flip: fl, alpha });
  }
  return done;
}
function teamGroundY(i, n) { return 214 + (i - (n - 1) / 2) * 58; }

Battle.renderChars = function (ctx) {
  const B = Battle;
  function drawTeam(team, x, flip) {
    const n = team.length;
    team.forEach((m, i) => {
      if (m.spared) return;   // SPARED members vanish from the field entirely (gone for the rest of the battle)
      if (team === B.oppTeam && B.fx && B.fx.boss) return;   // setpiece boss active: hide normal side-standing boss
      // (poseT is advanced in Battle.update at a fixed 60Hz - do NOT increment it here in render)
      const hurtFlash = m.pose === 'hurt' && (m.poseT % 8 < 4);
      const alpha = m.downed ? 0.35 : (hurtFlash ? 0.4 : 1);
      const sc = (n >= 3 ? 1.3 : 1.7) * (m.def.dscale || 1);   // per-char scale override
      const bob = (m.def.bob && !isOut(m)) ? Math.sin(m.poseT * 0.09) * 7 : 0;   // Knight hovers
      const gy = teamGroundY(i, n) + bob;
      // afterimage trail (Roaring Knight): fading copies streaming backward
      if (m.def.afterimage && !isOut(m)) {
        if (!m.trail) m.trail = [];
        m.trail.unshift(gy);
        if (m.trail.length > m.def.afterimage) m.trail.pop();
        const back = flip ? 1 : -1;   // "backward" = away from the enemy the boss faces
        for (let k = m.trail.length - 1; k >= 1; k--)
          drawCharAnim(ctx, m.def, 'idle', m.poseT, x + back * k * 3, m.trail[k], flip, 0.06 + 0.14 * (1 - k / m.trail.length), sc);
      }
      // BOSS ATTACK POSE: a pattern can drive the boss's on-field sprite (Gerson swing/throw/spin) via
      // B.fx.bossSprite = {key,n,rate,flip,f}. Used only while fresh (set this frame). Falls back to the anim.
      const bs = (team === B.oppTeam && !isOut(m) && B.fx && B.fx.bossSprite) ? B.fx.bossSprite : null;
      if (bs && typeof bulletProps === 'function') {
        const frm = bulletProps(bs.key + (Math.floor(m.poseT / (bs.rate || 3)) % bs.n)).img;
        if (frm && frm.width) { const fl = (ENEMY_FACING[m.def.base] ? !flip : flip) !== !!bs.flip;
          drawSpr(ctx, frm, x, gy - frm.height / 2 * sc + (m.def.yoff || 0), { scale: sc, flip: fl, alpha }); }
      }
      const done = bs ? true : drawCharAnim(ctx, m.def, m.downed ? 'downed' : m.pose, m.poseT, x, gy, flip, alpha, sc);
      if (!bs && done && !LOOP_POSES[m.pose] && !HOLD_POSES[m.pose]) { m.pose = 'idle'; m.poseT = 0; }
      else if (done && m.pose === 'hurt' && m.poseT > 50) { m.pose = 'idle'; m.poseT = 0; }
      // small MERCY readout, only on YOUR OWN party, only once MERCY has started building,
      // tucked below the character (no HP - that's already on the panel)
      if (team === B.myTeam && !isOut(m) && m.mercy > 0 && !(m.def.spare || {}).never) {
        const bw = 30, bx0 = x - bw / 2, by0 = gy + 38;
        ctx.fillStyle = '#3a3000'; ctx.fillRect(bx0, by0, bw, 2);
        ctx.fillStyle = canSpare(m) ? '#ffd000' : '#c8a000'; ctx.fillRect(bx0, by0, Math.round(bw * m.mercy / 100), 2);
        drawText(ctx, 'main', canSpare(m) ? 'SPARE!' : m.mercy + '%', x, by0 + 3, { color: canSpare(m) ? '#ff0' : '#dd0', align: 'center', scale: 0.7 });
      }
    });
  }
  drawTeam(B.myTeam, 96, false);
  drawTeam(B.oppTeam, 544, true);
};

function drawBoxRect(ctx, cx, cy, w, h, rot, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy); if (rot) ctx.rotate(rot);
  ctx.fillStyle = '#000'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = '#00c000'; ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2 - 1.5, -h / 2 - 1.5, w + 3, h + 3);
  ctx.restore();
}
// DATE minigame: the FULL dating-sim takeover screen (obj_date_controller Draw_0 layout):
// black screen + scrolling spr_diamond_loop tiles, spr_datingsim_ui_bg frame at (106,24)x2, Pink's
// talking portrait, typewriter question text centred at (320,208) with a white 8-direction outline and
// near-black fill (mainbig, sep 28, wrap 320), the purple gradient band, and the CYLINDRICAL option
// carousel at y=291: boxes 200 apart on a strip projected via angle=lerp(0,180,(x+165)/970),
// screenX = 240*cos(angle)+312 (perspective squeeze at the edges), scrolled LEFT/RIGHT.
// PINK's DOKI meter (obj_pink_enemy show_doki_bar): a pink heart-meter at the top. Fills as you collect
// doki-hearts; a full bar means a DATE is due; the pips show phases cleared. When all phases are done,
// Pink can be SPARED. Only drawn while a dokiSpare foe (Pink) is in the fight.
function drawDokiBar(ctx) {
  const B = Battle; if (typeof dokiFoe !== 'function') return;
  const foe = dokiFoe(); if (!foe) return;
  const max = (B.dokiPhase || 0) >= 1 ? (foe.def.dokiMaxLater || 20) : (foe.def.dokiMax || 100);
  const pct = Math.max(0, Math.min(1, (B.doki || 0) / max)), phases = foe.def.dokiPhases || 3;
  const w = 160, x = 320 - w / 2, y = 20, h = 10;
  ctx.save();
  ctx.font = "12px 'Determination Mono', monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ff8fe0'; ctx.fillText('DOKI', 320, y - 3);
  ctx.fillStyle = '#301028'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = B.dokiReady ? '#ffe14d' : '#ff5ca8'; ctx.fillRect(x + 1, y + 1, (w - 2) * pct, h - 2);
  ctx.strokeStyle = '#ff9fd0'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  for (let i = 0; i < phases; i++) {   // phase pips (dates cleared)
    ctx.fillStyle = i < (B.dokiPhase || 0) ? '#ffe14d' : '#5a2a4a';
    ctx.fillRect(x + w + 8 + i * 12, y, 8, h);
  }
  if ((B.dokiPhase || 0) >= phases) { ctx.fillStyle = '#ffe14d'; ctx.fillText('SPARE READY', 320, y + h + 12); }
  ctx.restore();
}
// red-tinted copy of a sprite (cached on the image) — used to make concert HATERS read clearly
function redTintSprite(im) {
  if (im._redTint) return im._redTint;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,42,42,0.62)'; x.fillRect(0, 0, im.width, im.height);
  im._redTint = c; return c;
}
// word-wrap `text` to fit maxW px, RETURNING the lines (canvas has no auto-wrap). Named dsimWrap to avoid
// colliding with the existing text-drawing wrapText(). Used by the date dialogue so long lines never
// overflow the box or reflow mid-typewriter.
function dsimWrap(ctx, text, maxW) {
  const words = String(text == null ? '' : text).split(' '); const lines = []; let cur = '';
  for (const w of words) { const test = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; } else cur = test; }
  if (cur) lines.push(cur); return lines.length ? lines : [''];
}
// ---- PINK V3 dating-sim renderer: per-beat portrait swaps, ghost split (0.7a, facing), real UI ----
function dsimImg(id) { const bp = (typeof bulletProps === 'function') ? bulletProps : null; const i = bp && bp(id); return i && i.img && i.img.width ? i.img : null; }
function drawPortrait(ctx, key, frame, cx, bottomY, flip, alpha) {   // anchored by BOTTOM-CENTER (feet)
  const im = dsimImg(key + frame) || dsimImg(key + '0'); if (!im) return;
  ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.imageSmoothingEnabled = false;
  const w = im.width * 2, h = im.height * 2;
  ctx.translate(cx, bottomY); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();               // bottom edge sits at bottomY
}
function drawDateUIV3(ctx, D) {
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
  // Layer 1 — scrolling diamond bg (full-screen, shows in the frame margins)
  const dia = dsimImg('dsimdiamond') || dsimImg('dsimdia1');
  if (dia) { ctx.globalAlpha = 0.5; for (let ty = -80 + ((D.bgy || 0) - 80); ty < 560; ty += 80) for (let tx = -(D.bg || 0) - 80; tx < 720; tx += 80) ctx.drawImage(dia, tx, ty, 80, 80); ctx.globalAlpha = 1; }
  if (D.done) { ctx.restore(); return; }
  const hasGhost = !!D.ghost, inv = D.date >= 3;   // date3/final uses the inverted (dark) plate
  // CLIP window content to the frame's opening so the oversized sky can't leak past the border
  ctx.save(); ctx.beginPath(); ctx.rect(110, 22, 454, 276); ctx.clip();
  // Layer 2 — sky window bg (spr_datingsim_ui_bg @ (106,24) 2x); the frame plate (drawn LAST) borders it
  const win = dsimImg('dsimbg0') || dsimImg('dsimbg'); if (win) ctx.drawImage(win, 106, 24, 480, 280);
  // Layer 3 — portraits, anchored by FEET at the window floor so different-sized sprites don't jump
  const feet = 288;
  if (hasGhost) { drawPortrait(ctx, D.spk, D.talkF || 0, 214, feet, false, 1); drawPortrait(ctx, D.ghost, D.talkF || 0, 426, feet, true, 0.7); }
  else drawPortrait(ctx, D.spk, D.talkF || 0, 320, feet, false, 1);
  if (D.sweat) { const sw = dsimImg('spksweat' + (Math.floor((D.bg || 0) / 6) % 3)); if (sw) ctx.drawImage(sw, (hasGhost ? 214 : 320) - sw.width, feet - 232, sw.width * 2, sw.height * 2); }
  // Layer 4/5 — dialogue gradient (enlarged to fill the rectangle) + RAISED, word-wrapped text
  const boxT = 208, boxB = 288, flash = D.flash > 0 && (D.flash % 4 < 2);
  const grad = ctx.createLinearGradient(0, boxT, 0, boxB); grad.addColorStop(0, 'rgba(102,86,177,0.1)'); grad.addColorStop(1, 'rgba(102,86,177,0.72)');
  ctx.fillStyle = grad; ctx.fillRect(114, boxT, 452, boxB - boxT);
  ctx.font = "16px 'Determination Mono', monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const outline = (str, x, y, fillc) => { ctx.fillStyle = '#0a0a0a'; for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]]) ctx.fillText(str, x + dx, y + dy); ctx.fillStyle = fillc; ctx.fillText(str, x, y); };
  const spkCol = flash ? '#ff4040' : (hasGhost ? '#ff8a90' : '#f0f0f0');
  const chars = D.chars != null ? D.chars : 999, textTop = boxT + 16, lh = 20;
  // wrap the FULL text once (stable) then reveal `chars` across the wrapped lines -> single clean type-through
  const reveal = (raw, maxW) => { let wrapped = []; for (const hl of (raw || [])) wrapped = wrapped.concat(dsimWrap(ctx, hl, maxW));
    let rem = chars, out = []; for (const wl of wrapped) { if (rem <= 0) break; out.push(wl.slice(0, rem)); rem -= wl.length; } return out; };
  if (hasGhost && D.who === 'ghost') reveal(D.rawLines, 300).forEach((ln, i) => outline(ln, 426, textTop + i * lh, '#c7b9d7'));
  else if (hasGhost) { reveal(D.rawLines, 200).forEach((ln, i) => outline(ln, 224, textTop + i * lh, spkCol));   // speaker LEFT (salmon)
    if (D.gtext) dsimWrap(ctx, D.gtext, 200).forEach((ln, i) => outline(ln, 426, textTop + i * lh, '#c7b9d7')); }   // ghost RIGHT (lavender)
  else reveal(D.rawLines, 420).forEach((ln, i) => outline(ln, 320, textTop + i * lh, spkCol));
  ctx.restore();   // end window clip
  // Layer 6 — OFFICIAL FRAME: nodiamonds plate frames (320x220 @2x -> fill 640x440) ON TOP; masks + borders
  const pfx = inv ? 'dsimplateinv' : 'dsimplate';
  for (const fr of [0, 1]) { const p = dsimImg(pfx + fr); if (p) ctx.drawImage(p, 0, 0, 640, 440); }
  // Layer 9 — 3-question progress hearts (over the plate, top-left slot)
  for (let i = 0; i < 3; i++) { const hi = dsimImg('dsimheart' + (i < (D.hearts || 0) ? 0 : 8)); if (hi) { ctx.save(); if (i >= (D.hearts || 0)) ctx.globalAlpha = 0.85; ctx.drawImage(hi, 42 + i * 26, 40, hi.width, hi.height); ctx.restore(); } }
  // Layer 10 — choice carousel: horizontal CYLINDER projection (flat row, edges compressed) + connector
  // rail with dots/arrows + the purple soul at the hub (spec §5.2). Boxes at constant y in the black panel.
  if (D.opts) {
    const n = D.opts.length, off = D.boxOff || 0, Rc = 300, y0 = 322, bh = 44, kmax = D.single ? 0 : 2;
    const railY = y0 + bh + 34, hubX = 320;
    const projX = L => hubX + Math.sin(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, L / Rc))) * Rc;
    // connector rail (purple 128,0,128): horizontal spine + vertical drops + junction dots + inward arrows
    ctx.strokeStyle = 'rgb(128,0,128)'; ctx.fillStyle = 'rgb(128,0,128)'; ctx.lineWidth = 2;
    if (!D.single) { ctx.beginPath(); ctx.moveTo(projX(-kmax * 200 + off), railY); ctx.lineTo(projX(kmax * 200 + off), railY); ctx.stroke(); }
    for (let k = -kmax; k <= kmax; k++) { const L = k * 200 + off; if (Math.abs(L / Rc) > Math.PI / 2) continue; const bx = projX(L);
      ctx.beginPath(); ctx.moveTo(bx, y0 + bh); ctx.lineTo(bx, railY); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, railY, 4, 0, 6.2832); ctx.fill();
      if (k !== 0) { const dir = k > 0 ? -1 : 1, ax = (bx + hubX) / 2; ctx.beginPath(); ctx.moveTo(ax - dir * 5, railY - 5); ctx.lineTo(ax, railY); ctx.lineTo(ax - dir * 5, railY + 5); ctx.stroke(); }
    }
    for (let k = kmax; k >= -kmax; k--) {   // draw edges first, center last (center on top)
      const L = k * 200 + off; if (Math.abs(L / Rc) > Math.PI / 2) continue;
      const bx = projX(L), comp = Math.cos(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, L / Rc)));
      const idx = ((D.sel + k) % n + n) % n, bw = 150 * comp, centred = (k === 0 && Math.abs(off) < 40);
      ctx.fillStyle = centred && D.correct ? '#7dff7d' : '#fff'; ctx.fillRect(bx - bw / 2, y0, bw, bh);
      ctx.fillStyle = '#120b1f'; ctx.fillRect(bx - bw / 2 + 2, y0 + 2, bw - 4, bh - 4);
      ctx.font = "18px 'Determination Mono', monospace"; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      let tw = ctx.measureText(D.opts[idx]).width, ts = Math.min(comp, tw > bw - 14 ? (bw - 14) / tw : 1);
      ctx.save(); ctx.translate(bx, y0 + bh / 2); ctx.scale(ts, 1); ctx.fillStyle = centred ? '#fff' : '#b58bd6'; ctx.fillText(D.opts[idx], 0, 0); ctx.restore();
    }
    const ph = A.soul((Math.floor((D.bg || 0) / 6) % 2) ? 'pheart1' : 'pheart0') || A.ui('soul');
    if (ph) drawSpr(ctx, ph, hubX, (D.heartY != null ? D.heartY : railY), { scale: 1 });
    const arw = dsimImg('pkarrow0') || dsimImg('pkarrow');
    if (arw && D.ph === 'choose') { const bob = Math.abs(Math.sin((D.bg || 0) * 0.13)) * 4;
      ctx.save(); ctx.translate(hubX, railY - 22 - bob); ctx.rotate(-Math.PI / 2); ctx.globalAlpha = 0.9; ctx.drawImage(arw, -13, -13, 26, 26); ctx.restore(); }
  }
  // Layer 8 — timer bar (date1/2 only), anchored (186,416), 0..300px
  if (D.timer != null) { ctx.fillStyle = '#241a33'; ctx.fillRect(186, 416, 300, 12);
    ctx.fillStyle = D.timer < 0.3 ? '#ff5050' : '#c060e0'; ctx.fillRect(186, 416, 300 * D.timer, 12); }
  ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawDateUI(ctx, D) {
  if (D && D.v3) { drawDateUIV3(ctx, D); return; }
  const bp = (typeof bulletProps === 'function') ? bulletProps : null;
  const img = id => { const i = bp && bp(id); return i && i.img && i.img.width ? i.img : null; };
  ctx.save();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
  const dia = img('dsimdiamond');   // scrolling diamond background (2x tiles)
  if (dia) { ctx.globalAlpha = 0.55;
    for (let ty = -80 + ((D.bgy || 0) - 80); ty < 480 + 80; ty += 80) for (let tx = -80 + (-(D.bg || 0)); tx < 640 + 80; tx += 80)
      ctx.drawImage(dia, tx, ty, 80, 80);
    ctx.globalAlpha = 1; }
  const frame = img('dsimbg');      // spr_datingsim_ui_bg at (106,24) scale 2 (drawn from its corner)
  if (frame) ctx.drawImage(frame, 106, 24, 480, 280);
  if (D.done) { ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; return; }
  // the SPEAKER portrait (obj_date_controller `pinkportrait`): the full talking face spr_pinkspeaker_date4_idle
  // (2-frame lipsync) drawn from (320-114, 21) at scale 2, with the spr_pinkspeaker_tail accent behind it.
  const full0 = (D.line1 || '').length + (D.line2 || '').length;
  const talking = D.chars != null && D.chars < full0 + 2;
  const tailA = img('spktail' + (Math.floor((D.bg || 0) / 3) % 11));
  if (tailA) { ctx.save(); ctx.globalAlpha = 0.9; ctx.drawImage(tailA, 320 - 112, 21, tailA.width * 2, tailA.height * 2); ctx.restore(); }
  // expression: shocked on a wrong answer (react con 4 / flash), else the idle talking face (2-frame lipsync)
  const wrong = D.correct === false || D.flash > 0;
  const face = wrong ? img('spkshock0') : (img('spkface' + (talking ? (Math.floor((D.bg || 0) / 6) % 2) : 0)) || img('spkface0'));
  if (face) ctx.drawImage(face, 320 - 114, 21, 228, 232);
  // sweatdrop under time pressure (spr_pinkspeaker_sweatdrop), obj_date_controller sweatcon
  if (D.timer != null && D.timer < 0.35 && !wrong) { const sw = img('spksweat' + (Math.floor((D.bg || 0) / 6) % 3));
    if (sw) ctx.drawImage(sw, 320 - 114, 21, 228, 232); }
  // 3-LIVES HUD (spr_datingsim_ui_heart): full heart = life left, greyed = lost. Top-left of the panel (xx+14, yy+170).
  if (D.lives != null) for (let i = 0; i < 3; i++) { const hi = img('dsimheart' + (i < D.lives ? 0 : 8));
    if (hi) { ctx.save(); if (i >= D.lives) ctx.globalAlpha = 0.4; ctx.drawImage(hi, 118 + i * 26, 32, hi.width * 2, hi.height * 2); ctx.restore(); } }
  // DATE 2: the GHOST side of Pink (spr_pinkghost_tail) floats beside her and blurts a HINT that points to the
  // pun answer (obj_date_controller second_text). Drawn semi-transparent with its own speech line.
  if (D.ghost) {
    const gf = Math.floor((D.bg || 0) / 2) % 11;
    const gim = img('ghosttail' + gf) || img('ghosttail0');
    if (gim) { ctx.save(); ctx.globalAlpha = 0.7; ctx.drawImage(gim, 424, 34, 112 * 1.5, 116 * 1.5); ctx.restore(); }
    ctx.font = "14px 'Determination Mono', monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { ctx.fillStyle = '#3a0d2e'; ctx.fillText('"' + D.ghost + '"', 496 + dx, 150 + dy); }
    ctx.fillStyle = '#ff9fe0'; ctx.fillText('"' + D.ghost + '"', 496, 150);
  }
  // Pink's spoken lines / the current question: typewriter, centred, WHITE 8-dir outline + near-black fill.
  const full = (D.line1 || '') + (D.line2 || ''); let shown = D.chars != null ? D.chars : full.length;
  const l1 = (D.line1 || '').slice(0, shown); const l2 = (D.line2 || '').slice(0, Math.max(0, shown - (D.line1 || '').length));
  ctx.font = "16px 'Determination Mono', monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const flash = D.flash > 0 && (D.flash % 4 < 2);
  const drawLine = (str, y) => { if (!str) return;
    ctx.fillStyle = flash ? '#ff4040' : '#fff';
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]]) ctx.fillText(str, 320 + dx, y + dy);
    ctx.fillStyle = '#0d0d0d'; ctx.fillText(str, 320, y); };
  drawLine(l1, 206); drawLine(l2, 234);
  // ---- the option LINE (only while asking/choosing): a horizontal strip that LOOPS; centred box is the
  //      one the purple soul will pick when you press UP. LEFT/RIGHT scroll it (draw_box_x_offset). ----
  if (D.opts) {
    const n = D.opts.length, off = D.boxOff || 0;
    const kmax = D.single ? 0 : 2, byTop = 276, bh = 44;
    for (let k = -kmax; k <= kmax; k++) {
      const idx = ((D.sel + k) % n + n) % n, cx = 320 + off + k * 200, bw = 150;
      if (cx < -120 || cx > 760) continue;
      const x0 = cx - bw / 2, centred = (k === 0);
      ctx.fillStyle = centred && D.correct ? '#7dff7d' : '#fff';               // white border (green on a correct pick)
      ctx.fillRect(x0, byTop, bw, bh);
      ctx.fillStyle = '#120b1f'; ctx.fillRect(x0 + 2, byTop + 2, bw - 4, bh - 4);   // dark-purple fill
      ctx.font = "18px 'Determination Mono', monospace"; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      let tw = ctx.measureText(D.opts[idx]).width, sc = tw > bw - 16 ? (bw - 16) / tw : 1;
      ctx.save(); ctx.translate(cx, byTop + bh / 2); ctx.scale(sc, 1);
      ctx.fillStyle = centred ? '#fff' : '#b58bd6'; ctx.fillText(D.opts[idx], 0, 0); ctx.restore();
    }
    // the PURPLE SOUL on the line at the bottom, rising into the option on select (heartY 385 -> 319)
    const ph = A.soul((Math.floor((D.bg || 0) / 6) % 2) ? 'pheart1' : 'pheart0') || A.ui('soul');
    if (ph) drawSpr(ctx, ph, 320, (D.heartY != null ? D.heartY : 385), { scale: 1 });
    // hint arrows: UP above the soul (press UP to pick); LEFT/RIGHT flanking it (scroll) when multi-option
    const arw = img('pkarrow');
    if (arw && D.ph === 'choose') { const bob = Math.abs(Math.sin((D.bg || 0) * 0.13)) * 4;
      ctx.save(); ctx.translate(320, 352 - bob); ctx.rotate(-Math.PI / 2); ctx.globalAlpha = 0.9; ctx.drawImage(arw, -13, -13, 26, 26); ctx.restore();
      if (!D.single) { for (const s of [-1, 1]) { ctx.save(); ctx.translate(320 + s * (28 + bob), 385); ctx.rotate(s < 0 ? Math.PI : 0);
        ctx.globalAlpha = 0.7; ctx.drawImage(arw, -12, -12, 24, 24); ctx.restore(); } }
    }
  }
  // question timer (timed questions only)
  if (D.timer != null) { ctx.fillStyle = '#2a2a2a'; ctx.fillRect(160, 456, 320, 6);
    ctx.fillStyle = D.timer < 0.3 ? '#ff5050' : '#c060e0'; ctx.fillRect(160, 456, 320 * D.timer, 6); }
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
// The battle box only exists during the dodge (and its spin-in / spin-out).
// GHOST/BODY MAZE full-screen render (obj_purplecontrols mode 8 Draw). The box is gone; everything is drawn to
// an offscreen "glow surface" then blitted with an 8-direction bleed (bloom) — magenta nodes, dark-purple 3px
// connections, 96x48 pulsing DIE!/goal boxes — over the wave-distorted Pink body + ghost split.
function drawWaveSprite(ctx, key, cx, cy, wave, alpha) {
  const info = (A.manifest.bullets || {})[key]; const im = info && A.img['assets/bullets/' + info.f];
  if (!im || !im.width) return;
  const w = im.width, h = im.height, step = 2;
  ctx.save(); ctx.globalAlpha = alpha;
  for (let i = 0; i < h; i += step) {   // sine-slice the sprite horizontally (spr_pink_*_2xscale wave distort)
    const off = Math.sin((wave + i * 8) / 30) * 3, sh = Math.min(step + 1, h - i);
    ctx.drawImage(im, 0, i, w, sh, Math.round(cx - w / 2 + off), Math.round(cy - h / 2 + i), w, sh);
  }
  ctx.restore();
}
function drawMazeBox(g, x, y, txt, goal, lt) {
  const p = lt % 40, k = Math.min(1, (p / 40) * 2); let border, th = 1;
  if (goal) { border = mixHex('#ffffff', '#6656b1', 0.25 + 0.75 * k); if (p < 1) th = 2; else if (p < 2) th = 3; else if (p < 5) th = 2; }
  else { border = mixHex('#ffff00', '#ff0000', k); if (p < 2) th = 3; else if (p < 4) th = 2; }
  g.fillStyle = border; g.fillRect(Math.round(x - 48 - th), Math.round(y - 24 - th), 96 + th * 2, 48 + th * 2);
  g.fillStyle = '#000'; g.fillRect(Math.round(x - 48), Math.round(y - 24), 96, 48);
  const tw = textWidth('big', txt) || 1, sc = Math.min(1.05, 88 / tw);
  drawText(g, 'big', txt, Math.round(x), Math.round(y - 16), { color: goal ? '#fff' : '#ff2b2b', align: 'center', scale: sc });
}
function renderMazeGraph(g, M) {
  const nodes = M.nodes || [], lt = M.life || 0;
  g.strokeStyle = 'rgb(85,0,85)'; g.lineWidth = 3; g.lineCap = 'round';   // connections (_prpl_dark, 3px)
  for (let i = 0; i < nodes.length; i++) { const n = nodes[i]; for (const c of n.child) { if (c < 0 || c <= i) continue; const m = nodes[c]; if (!m) continue; g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(m.x, m.y); g.stroke(); } }
  const glow = Math.cos((lt % 60) / 60 * 6.2832) * 0.5 + 0.5;
  for (let i = 0; i < nodes.length; i++) { const n = nodes[i];   // node circles (_prpl_light / glow)
    if (n.checkpoint === 2) { g.fillStyle = 'rgba(208,45,170,0.7)'; g.beginPath(); g.arc(n.x, n.y, 7.2 + glow * 0.5, 0, 6.2832); g.fill(); g.fillStyle = 'rgb(208,45,170)'; g.beginPath(); g.arc(n.x, n.y, 5.2 - glow * 0.5, 0, 6.2832); g.fill(); }
    else if (n.checkpoint === 1) { g.fillStyle = 'rgba(247,91,200,0.7)'; g.beginPath(); g.arc(n.x, n.y, 9.3 - glow, 0, 6.2832); g.fill(); g.fillStyle = 'rgb(247,91,200)'; g.beginPath(); g.arc(n.x, n.y, 7.3 - glow, 0, 6.2832); g.fill(); }
    else { g.fillStyle = 'rgb(170,0,170)'; g.beginPath(); g.arc(n.x, n.y, 4, 0, 6.2832); g.fill(); }
  }
  for (const d of (M.dokis || [])) { const info = (A.manifest.bullets || {}).pdoki, im = info && A.img['assets/bullets/' + info.f];   // spr_dokiheart
    if (im && im.width) { const bob = Math.sin((lt + d.x) / 6) * 2; g.drawImage(im, Math.round(d.x - im.width / 2), Math.round(d.y - im.height / 2 + bob), im.width, im.height); } }
  for (const ac of (M.acts || [])) drawMazeBox(g, ac.x, ac.y, ac.mode === 1 ? (M.goalText || 'Stop!') : 'DIE!', ac.mode === 1, lt);
  for (const b of (M.train || [])) drawMazeBox(g, b.x, b.y, 'DIE!', false, lt);   // the patrolling DIE-train (diff3)
}
// POSSESSED Mew Mew backdrop (obj_date_controller date3): 3-layer glow form + green eye-lasers, behind the maze
function drawPossessedPink(ctx, M) {
  const t = (M.life || 0) / 10, sw = Math.sin(t), fr = Math.floor((M.life || 0) / 8) % 3;
  const ex = 320, ey = 158 + sw * 2;   // possessed form, centred upper (bobs)
  const spr = k => { const info = (A.manifest.bullets || {})[k + fr]; return info && A.img['assets/bullets/' + info.f]; };
  // 10 green eye-laser beams radiating down-and-out FROM THE EYES (d_line_color 0,255,0). Two eyes, offset up.
  ctx.save(); ctx.strokeStyle = 'rgba(0,255,0,0.5)'; ctx.lineWidth = 2;
  const eyeY = ey - 86;   // the white eyes (measured at screen y~71 for ey~158)
  for (const eyeX of [ex - 26, ex + 26]) for (let i = 0; i < 5; i++) { const ang = Math.PI * 0.5 + (i - 2) * 0.22;
    ctx.beginPath(); ctx.moveTo(eyeX, eyeY); ctx.lineTo(eyeX + Math.cos(ang) * 460, eyeY + Math.sin(ang) * 460); ctx.stroke(); }
  ctx.restore();
  // 3-layer body: greyscale (0.95) + purple (0.7+sin*0.3) + pink (0.7-sin*0.3) cross-fade pulse
  const draw = (im, a) => { if (im && im.width) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); drawSpr(ctx, im, ex, ey, { scale: 2 }); } };
  draw(spr('posgrey'), 0.95); draw(spr('pospurp'), 0.7 + sw * 0.3); draw(spr('pospink'), 0.7 - sw * 0.3);
  const eyes = spr('poseyes'); if (eyes && eyes.width) { ctx.globalAlpha = Math.max(0, 0.7 - sw * 0.3); drawSpr(ctx, eyes, ex, ey - 16, { scale: 2 }); }
  ctx.globalAlpha = 1;
}
function drawMaze(ctx, M) {
  ctx.save();
  ctx.fillStyle = '#12000a'; ctx.fillRect(0, 0, 640, 480);   // the possessed date-screen backdrop (box destroyed)
  const life = M.life || 0;
  // INVERTED dating-sim backdrop: ONE red diamond tile scrolling (like the other date bgs) + inverted portrait bg
  const dia = A.img['assets/bullets/dsimdiainv0.png'];
  if (dia && dia.width) { const ox = (life * 0.7) % 80, oy = (life * 0.4) % 80; ctx.globalAlpha = 0.55;
    for (let ty = -80 + oy; ty < 560; ty += 80) for (let tx = -80 - ox; tx < 720; tx += 80) ctx.drawImage(dia, tx, ty, 80, 80);
    ctx.globalAlpha = 1; }
  const uibg = A.img['assets/bullets/dsimbginv0.png']; if (uibg && uibg.width) ctx.drawImage(uibg, 106, 24, 480, 280);
  drawPossessedPink(ctx, M);
  const dk = [0, 0.4, 0.6, 0.8, 0][M.round || 0] || 0;   // per-difficulty darkener (date3darkner_alpha): diff3 = 80% black
  if (dk > 0) { ctx.fillStyle = 'rgba(0,0,0,' + dk + ')'; ctx.fillRect(0, 0, 640, 480); }
  // HUD OVERLAY: the inverted nodiamonds frame ON TOP of the bg + portrait (but UNDER the maze graph, which
  // blits next, so the frame borders the scene without hiding the maze)
  for (const fr of [0, 1]) { const p = dsimImg('dsimplateinv' + fr); if (p) ctx.drawImage(p, 0, 0, 640, 440); }
  // glow surface — allocate ONCE (assigning canvas.width/height reallocates+clears the whole
  // backing store, which is what made the maze lag when done every frame). Reuse + clearRect.
  let s = drawMaze._s;
  if (!s) { s = drawMaze._s = document.createElement('canvas'); s.width = 640; s.height = 480; s.getContext('2d').imageSmoothingEnabled = false; }
  const g = s._g || (s._g = s.getContext('2d')); g.clearRect(0, 0, 640, 480);
  renderMazeGraph(g, M);
  // GML mode-8 bloom: 8 black drop-shadow offsets (dark neon outline) + 1 crisp pass.
  ctx.globalAlpha = 0.25; for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0]]) ctx.drawImage(s, dx, dy);
  ctx.globalAlpha = 0.45; for (const [dx, dy] of [[2, 2], [-2, 2], [2, -2], [-2, -2]]) ctx.drawImage(s, dx, dy);
  ctx.globalAlpha = 1; ctx.drawImage(s, 0, 0);
  // the purple SOUL (drawn crisp, on top)
  const ph = A.soul(((Math.floor((M.life || 0) / 8) % 2) ? 'pheart1' : 'pheart0')) || A.ui('soul');
  if (ph && ph.width) drawSpr(ctx, ph, M.soul.x, M.soul.y, { scale: 1 });
  ctx.restore();
}

// ===================== PINK STAGE SCENE (obj_pink_enemy scenery) =====================
// The Pink fight is a whole stage: black backdrop + "MEWERS LIVE" marquee + 16 bg
// dancers + 8 fg dancers (glowsticks) + falling petals + per-hero spotlights.
// Rendered when a pink_* pattern sets B.fx.pinkScene truthy. Derived deterministically
// from the frame counter (like all transient fx) — no persistent state to desync.
// Sprite origins are from refdata (originX,originY at native px; ×2 stage scale).
function pinkSceneImg(key) {
  const info = (A.manifest.bullets || {})[key]; if (!info) return null;
  const im = A.img['assets/bullets/' + info.f]; return (im && im.width) ? im : null;
}
// draw a scene sprite so its GML origin (ox,oy native px) sits at screen (ax,ay)
function pinkSceneSpr(ctx, key, ax, ay, ox, oy, { scale = 2, alpha = 1, angle = 0, flip = false } = {}) {
  const im = pinkSceneImg(key); if (!im) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(ax, ay);
  if (angle) ctx.rotate(-angle * Math.PI / 180);
  ctx.scale(flip ? -scale : scale, scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, -ox, -oy);
  ctx.restore();
}
function pinkHash01(n) { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }
// wave-pattern hop offset (vspeed -8, gravity 1 => 16-frame parabola peaking -32px)
function pinkHop(clock) { const t = clock % 60; return (t < 16) ? 0.5 * t * (t - 16) : 0; }
function drawPinkDancer(ctx, f, a, kind) {
  const bg = kind === 'bg';
  const span = bg ? 16 * 51 : 8 * 121;
  const base = bg ? a * 51 : a * 121;
  let x = ((base - f * 2) % span + span) % span;   // scroll left, wrap
  // duplicate one span to the right so the seam is covered
  for (const xx of [x, x + span]) {
    if (xx < -70 || xx > 700) continue;
    const yhop = pinkHop(f + a * (bg ? 4 : 8));
    if (bg) {
      const y = 60 + yhop;
      pinkSceneSpr(ctx, 'pnbgd0', xx, y, 13, 31, { scale: 1, alpha: 0.9 });
      const ga = 20 + Math.sin((f + a * 4) * 0.15) * 30;       // glowstick sway ±30, base +20
      pinkSceneSpr(ctx, 'pnbgglow0', xx + 4, y - 15, 5, 15, { scale: 1, alpha: 0.9, angle: ga });
    } else {
      const y = 398 + yhop;                                     // foreground row sits low, near the stage lip
      const fi = Math.min(4, Math.floor((xx / 640) * 5 + 5) % 5);   // frame by screen-fifth
      const gf = Math.floor((f + a * 8) / 8) % 3;
      pinkSceneSpr(ctx, 'pnfgglow' + gf, xx + 11, y - 18, 15, 45, { scale: 1, alpha: 0.95 });
      pinkSceneSpr(ctx, 'pnfgd' + fi, xx, y, 43, 17, { scale: 1, alpha: 0.95 });
    }
  }
}
function drawPinkMewers(ctx, f) {
  const y = 6 + Math.sin(f * 0.1) * 3;
  pinkSceneSpr(ctx, 'pnmewersd0', 320, y, 59, 0, { scale: 2, alpha: 1 });        // dim base
  const ga = Math.max(0, Math.min(1, 0.6 + Math.sin(f * 0.12) * 0.5));            // pulsing neon
  pinkSceneSpr(ctx, 'pnmewers0', 320, y, 59, 0, { scale: 2, alpha: ga });
}
function drawPinkPetals(ctx, f) {
  const step = Math.floor(f / 5);
  for (let k = 0; k < 24; k++) {
    const sf = (step - k) * 5; if (sf < 0) continue;
    const age = f - sf; if (age > 120 || age < 0) continue;
    const x0 = 180 + pinkHash01(sf) * 460, y0 = -30 - pinkHash01(sf * 3.1) * 50;
    const x = x0 - 2 * age, y = y0 + 5 * age;
    if (y < -20 || y > 500) continue;
    const fr = Math.floor(age * (0.1 + pinkHash01(sf * 7) * 0.2) + pinkHash01(sf)) % 5;
    const al = 0.5 * Math.min(1, age / 8) * Math.min(1, (120 - age) / 20);
    pinkSceneSpr(ctx, 'pnpetal' + fr, x, y, 4, 4, { scale: 2, alpha: al, angle: age * 3 + sf });
  }
}
// rotating-grid scrolling parallax backdrop (spr_pinkroll_background 0/1): a linear-scrolling pattern that
// makes the box + Pink read as "moving/rolling". Frame 1 scrolls at half speed behind frame 0 (parallax).
function drawPinkRoll(ctx, R) {
  const f = R.f || 0;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#180010'; ctx.fillRect(0, 0, 640, 480);
  const layer = (key, speed, alpha) => { const im = A.img['assets/bullets/' + key]; if (!im || !im.width) return;
    const tw = im.width * 4, th = im.height * 4, off = ((f * speed) % tw + tw) % tw, y = 240 - th / 2; ctx.globalAlpha = alpha;   // DOUBLE size, ONE centered strip (no vertical repeat)
    for (let x = -tw; x < 640 + tw; x += tw) ctx.drawImage(im, Math.round(x - off), y, tw, th);
    ctx.globalAlpha = 1; };
  layer('pinkroll1.png', 2.25, 0.6);   // back (half the front speed) — 1.5x the old
  layer('pinkroll0.png', 4.5, 0.92);   // front (full speed) — 1.5x the old
  ctx.restore();
}
// back layer: backdrop + marquee + bg dancers + petals (drawn behind the bullet box)
function drawPinkSceneBack(ctx) {
  const f = Battle.anim.f;
  ctx.save();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);        // black_square_bg2 (full void)
  ctx.fillStyle = 'rgba(10,0,14,1)'; ctx.fillRect(0, 40, 640, 320);  // black_square_bg stage band
  drawPinkMewers(ctx, f);
  for (let a = 0; a < 16; a++) drawPinkDancer(ctx, f, a, 'bg');
  drawPinkPetals(ctx, f);
  ctx.restore();
}
// front layer: fg dancers (drawn in front of the box, per GML depth = battlecontroller+1)
function drawPinkSceneFront(ctx) {
  const f = Battle.anim.f;
  ctx.save();
  for (let a = 0; a < 8; a++) drawPinkDancer(ctx, f, a, 'fg');
  ctx.restore();
}

Battle.renderBoxAndBullets = function (ctx) {
  const B = Battle;
  const anim = B.phase === 'boxin' || B.phase === 'boxout';
  const inDodge = B.phase === 'dodge';
  if (B.fx && B.fx.maze && inDodge) { drawMaze(ctx, B.fx.maze); return; }   // GHOST/BODY MAZE: full-screen takeover (no box)
  if (!anim && !inDodge) return;
  const bx = B.dodgeBox; if (!bx) return;
  const cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2;
  if (anim) {   // afterimage trail + the scaling/rotating box
    for (const g of (B.boxGhosts || [])) drawBoxRect(ctx, cx, cy, bx.w * g.s, bx.h * g.s, g.rot, g.alpha);
    const s = B.boxScaleCur || 0;
    drawBoxRect(ctx, cx, cy, bx.w * s, bx.h * s, B.boxRotCur || 0, 1);
    return;
  }
  // giant boss sprite behind the box (Power of NEO / FINAL ROAR)
  if (B.fx && B.fx.boss) {
    const bp = B.fx.boss, info = (A.manifest.bullets || {})[bp.key];
    const im = info && A.img['assets/bullets/' + info.f];
    if (im && im.width) drawSpr(ctx, im, bp.x, bp.y, { scale: bp.scale || 1, flip: bp.flip });
  }
  // PINK GHOST (obj_huge_anime_face): the big ghost that rams the box — the P3 rotation telegraph
  // (the obj_huge_anime_face GHOST rams the box; drawn ON TOP of the box + bullets — see drawPinkGhost after the soul)
  // IDOL CONCERT (obj_pink_curtains): PINK sings on stage flanked by two SPEAKERS (background pass; the CAT
  // CROWD is drawn later, in FRONT of the box + bullets — see the foreground pass after the soul).
  if (B.fx && B.fx.pinkSing) { const p = B.fx.pinkSing;
    // STAGE CURTAINS (obj_pink_curtains): a spr_pink_curtain panel on EACH side of the box (mirrored), tiled
    // 3 cols x N rows, hanging from the box top with a per-row sway; they slide OPEN (retract outward) as `closed` 2->0.
    if (p.closed != null) { const cur = A.img['assets/bullets/pcurtain0.png'];
      if (cur && cur.width) { const ts = 2, tw = 32 * ts, th = 32 * ts, cols = 3;
        const open = (2 - p.closed) / 2;                                   // 0 closed -> 1 fully open
        const rows = Math.ceil((p.boxH + 60) / th) + 1, topY = p.boxTop - 24;
        for (const side of [-1, 1]) { const edge = p.x + side * (p.boxW / 2 - 10 + open * 120);   // inner edge, retracts outward as it opens
          for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
            const sway = Math.sin(p.f * 0.09 + r * 0.6) * 5 * (0.4 + r / rows);   // fabric sway, more at the bottom
            const tcx = edge + side * (c * tw + tw / 2) + sway, tcy = topY + r * th + th / 2;
            drawSpr(ctx, cur, tcx, tcy, { scale: ts, flip: side > 0 });
          }
        }
      }
    }
    // two SPEAKERS (spr_dw_castle_tv_speaker frame 1) at screen x 172/468 = ±148 from the box centre, y = box top - 31,
    // scale 2 x speaker_scale (pulses to 1.15 on the beat every 8 phases; obj_pink_curtains Draw).
    const sp = A.img['assets/bullets/dwspeaker1.png'] || A.img['assets/bullets/dwspeaker0.png'];
    const beat = 1 + Math.abs(Math.sin(p.f * 0.196)) * 0.15;
    for (const sx of [-1, 1]) if (sp && sp.width) drawSpr(ctx, sp, p.x + sx * 148, p.y + 10, { scale: 2 * beat });
    // PINK sings on stage (spr_pink_sing, 9 frames)
    const si = (A.manifest.bullets || {})['pinksing' + (Math.floor(p.f / 6) % 9)];
    const sim = si && A.img['assets/bullets/' + si.f]; if (sim && sim.width) drawSpr(ctx, sim, p.x, p.y - 4, { scale: 2 }); }
  // FINAL maze — Pink SPLIT: body (spr_pink_idle) on stage + her detached GHOST (spr_pink_ghost) drifting overhead
  if (B.fx && B.fx.pinkSplit) { const s = B.fx.pinkSplit;
    const gi = (A.manifest.bullets || {})['pinkbodyghost' + (Math.floor(s.f / 8) % 5)];
    const gim = gi && A.img['assets/bullets/' + gi.f]; if (gim && gim.width) drawSpr(ctx, gim, s.gx, s.gy, { scale: 2, alpha: 0.82 });
    const bi = (A.manifest.bullets || {})['pinkidle' + (Math.floor(s.f / 10) % 5)];
    const bim = bi && A.img['assets/bullets/' + bi.f]; if (bim && bim.width) drawSpr(ctx, bim, s.bx, s.by, { scale: 2 }); }
  // BOMB FINALE: Pink runs in / charges (spr_pink_run / spr_pink_front_throw_bomb)
  if (B.fx && B.fx.pinkFinale) { const pf = B.fx.pinkFinale;
    const key = pf.pose === 'run' ? 'pinkrun' + (Math.floor(pf.f / 5) % 3) : 'pinkchargebomb';
    const pi = (A.manifest.bullets || {})[key], pim = pi && A.img['assets/bullets/' + pi.f];
    if (pim && pim.width) drawSpr(ctx, pim, pf.x, pf.y, { scale: 2, flip: pf.flip }); }
  // CAROUSEL far side: draw the behind-the-box horses BEFORE the box, so the box's black fill masks
  // the part that's inside it (they render perfectly where they poke out past the box edges).
  for (const b of B.bullets) if (b.carousel && b._back) drawBullet(ctx, b, b.x, b.y, 1);
  const split = B.fx && B.fx.split;
  if (B.fx && B.fx.hideBox) { /* full-screen arena: no border at all */ }
  else if (split && split.offset > 0.5) {
    // the CUT board: the halves separate OUTWARD from the cut
    const off = split.offset;
    if (split.axis === 'h') {
      drawBoxRect(ctx, cx, cy - bx.h / 4 - off, bx.w, bx.h / 2, 0, 1);
      drawBoxRect(ctx, cx, cy + bx.h / 4 + off, bx.w, bx.h / 2, 0, 1);
    } else {
      drawBoxRect(ctx, cx - bx.w / 4 - off, cy, bx.w / 2, bx.h, 0, 1);
      drawBoxRect(ctx, cx + bx.w / 4 + off, cy, bx.w / 2, bx.h, 0, 1);
    }
  } else if (B.fx && B.fx.pinch > 0.02) {
    // Power-of-NEO suck: the RIGHT side shrinks height-wise, so top & bottom run diagonally
    const p = B.fx.pinch * bx.h / 2;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.moveTo(bx.x, bx.y); ctx.lineTo(bx.x + bx.w, bx.y + p);
    ctx.lineTo(bx.x + bx.w, bx.y + bx.h - p); ctx.lineTo(bx.x, bx.y + bx.h); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = '#00c000'; ctx.lineWidth = 3; ctx.stroke();
  } else drawBoxRect(ctx, cx, cy, bx.w, bx.h, (B.fx && B.fx.purpleSoul && B.fx.purpleSoul.mode === 3 ? (B.fx.purpleSoul.rot || 0) * Math.PI / 180 : (B.fx && B.fx.boxRot) || 0), 1);
  if (B.fx && B.fx.date) { drawDateUI(ctx, B.fx.date); return; }   // DATE minigame: full dating-sim takeover screen
  // pattern-driven overlays: a second non-enterable box (face attack) + green connector arms (phones/heart)
  if (B.fx) {
    if (B.fx.arms) { ctx.strokeStyle = '#49d049'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (const a of B.fx.arms) { ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke(); } }
    // Knight STARS aim-cone (obj_knight_pointing_cone): a purple wedge from the apex showing the
    // spread the stars fire into. c = {x,y,dir(rad),spread(rad),len}.
    if (B.fx.knightCone) { const c = B.fx.knightCone, hs = c.spread / 2;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.dir);
      const g = ctx.createLinearGradient(0, 0, c.len, 0); g.addColorStop(0, 'rgba(150,60,220,0.55)'); g.addColorStop(1, 'rgba(150,60,220,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(hs) * c.len, Math.sin(hs) * c.len); ctx.lineTo(Math.cos(-hs) * c.len, Math.sin(-hs) * c.len);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c060ff'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();   // the purple rhombus at the apex
      ctx.restore(); }
    if (B.fx.faceBox) { const fb = B.fx.faceBox; drawBoxRect(ctx, fb.x + fb.w / 2, fb.y + fb.h / 2, fb.w, fb.h, 0, 1); }
  }
  ctx.save();
  // GREEN SOUL: NO bullet clipping — you MUST see spears/shells approaching from off-box to aim your block.
  const wide = B.fx && (B.fx.hideBox || bx.w > 500) || B.soulGreen;   // full-screen arena: no bullet clipping
  if (wide) { ctx.beginPath(); ctx.rect(0, 0, 640, 480); ctx.clip(); }
  else if (B.fx && B.fx.faceBox) {   // Spamton face attack keeps its own tight two-box clip
    const l = Math.min(bx.x, B.fx.faceBox.x) - 40, r = Math.max(bx.x + bx.w, B.fx.faceBox.x + B.fx.faceBox.w) + 40;
    ctx.beginPath(); ctx.rect(l, bx.y - 40, r - l, bx.h + 80); ctx.clip();
  } else {   // otherwise: FULL WIDTH + a generous vertical margin so incoming bullets are visible approaching (no edge mask)
    ctx.beginPath(); ctx.rect(0, Math.max(52, bx.y - 96), 640, bx.h + 192); ctx.clip();
  }
  // BOMB TELEGRAPH (obj_fusebomb_big / obj_fusebomb Draw): the red row/column danger bands that fade in over
  // the last warn frames. Giant = full-width + full-height 3-lane-thick bands (with an early expanding-ellipse
  // cross + a yellow flash); small = a thin row/column line. Gaps between bands are the safe lanes.
  if (B.fx && B.fx.bombWarn) for (const w of B.fx.bombWarn) {
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(0.85, w.alpha)); ctx.fillStyle = w.color || '#d00000';
    if (w.ellipse != null) {   // early giant warning: two expanding ellipses forming a cross
      const rw = w.ellipse, th = w.thick;
      ctx.beginPath(); ctx.ellipse(w.x, w.y, rw, th, 0, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w.x, w.y, th, rw, 0, 0, 6.2832); ctx.fill();
    } else {                   // full row + column bands, thickness = w.thick (3 lanes for giant, ~1 for small)
      ctx.fillRect(0, w.y - w.thick, 640, w.thick * 2);
      ctx.fillRect(w.x - w.thick, 0, w.thick * 2, 480);
    }
    ctx.restore();
  }
  for (const h of B.hearts) {
    ctx.fillStyle = 'rgba(255,105,180,0.8)';
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(-0.05);
    ctx.fillRect(-4, -3, 3, 3); ctx.fillRect(1, -3, 3, 3); ctx.fillRect(-4, 0, 8, 3); ctx.fillRect(-2, 3, 4, 2);
    ctx.restore();
  }
  for (const b of B.bullets) if (b.shape !== 'line' && !b.boxClip && !(b.carousel && b._back)) drawBullet(ctx, b, b.x, b.y, 1);   // (back carousel horses already drawn behind the box)
  // red tell-lines AND slash blades are MASKED to the inside of the battle box (they stretch edge to edge)
  ctx.save(); ctx.beginPath(); ctx.rect(bx.x, bx.y, bx.w, bx.h); ctx.clip();
  for (const b of B.bullets) if (b.shape === 'line' || b.boxClip) drawBullet(ctx, b, b.x, b.y, 1);
  ctx.restore();
  // yellow-soul player shots (real sprites: yshot / ybig + trail) + charge indicator
  if (B.soulYellow) {
    const shot = A.soul('yshot'), big = A.soul('ybig'), trail = A.soul('ybigtrail');
    for (const s of B.shots) {
      if (s.big) { if (trail) drawSpr(ctx, trail, s.x - 14, s.y, { scale: 1, alpha: 0.6 }); if (big) drawSpr(ctx, big, s.x, s.y, { scale: 1 }); }
      else if (shot) drawSpr(ctx, shot, s.x, s.y, { scale: 1 });
    }
    // shot-hit VFX bursts
    for (const fx of (B.shotFx || [])) { const im = A.soul('yhit' + Math.min(4, Math.floor(fx.t / 3))); if (im) drawSpr(ctx, im, fx.x, fx.y, { scale: 1 }); }
    if (B.charge > 0) {   // yellow charge sparks orbit the soul; brighten once it's a BIG SHOT
      const ch = A.soul('ycharge'), ready = B.charge >= 26, n = ready ? 5 : 3, R = 10 + Math.min(8, B.charge * 0.3);
      for (let i = 0; i < n; i++) { const a = B.anim.f * 0.25 + i * (6.28 / n);
        if (ch) drawSpr(ctx, ch, B.soul.x + Math.cos(a) * R, B.soul.y + Math.sin(a) * R, { scale: ready ? 1.3 : 1 }); }
    }
  }
  // GREEN SOUL: the shield ring (at the real block radius) + Susie's AXE (spr_spearblocker) pivoting to the
  // guarded side. frame 0 = idle, frame 1 = block-flash (a few frames after a block), frame 2 (white) = parry.
  if (B.soulGreen) {
    const gcx = bx.x + bx.w / 2, gcy = bx.y + bx.h / 2;
    const RING = B.greenOct ? 33 : 30, GR = B.greenOct ? 46 : 36;   // visible ring (GML sidelength ~28-33) vs block radius (axe sits here)
    ctx.strokeStyle = '#33d13a'; ctx.lineWidth = 2;
    if (B.greenOct) { ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, px = gcx + Math.cos(a) * RING * 1.0824, py = gcy + Math.sin(a) * RING * 1.0824; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke();
    } else ctx.strokeRect(gcx - RING, gcy - RING, RING * 2, RING * 2);
    const sa = B.shieldAng == null ? Math.PI / 2 : B.shieldAng;
    const parryF = (B.shieldParry || 0) > 0, blockF = (B.shieldFlash || 0) > 0;
    const axe = bulletProps(parryF ? 'gaxe2' : blockF ? 'gaxe1' : 'gaxe0').img;
    // spr_spearblocker faces RIGHT by default. Push the axe OUT to the block radius so its blade sits ON the ring edge.
    if (axe && axe.width) drawSpr(ctx, axe, gcx + Math.cos(sa) * (GR - 6), gcy + Math.sin(sa) * (GR - 6), { scale: 1.05, rot: sa, tint: parryF ? '#ffffff' : null });
  }
  for (const p of (B.blockParts || [])) {   // parry sparks off the axe (obj_shield_just_particle): 3 light bits
    const a = Math.max(0, 1 - p.t / 14); ctx.globalAlpha = a; ctx.fillStyle = p.t < 6 ? '#ffffff' : '#9dff9d';
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.4 * a + 0.6, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
  }
  for (const fx of (B.blockFx || [])) {   // block spark: bright ring, brighter/yellow on a perfect (well-timed) block
    const r = 4 + fx.t * 1.6; ctx.strokeStyle = fx.perfect ? '#fff36b' : '#8affa0'; ctx.globalAlpha = Math.max(0, 1 - fx.t / 8); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
  }
  // PURPLE SOUL: draw the grid guides the heart hops between (lanes / 4x4 cells).
  if (B.soulPurple) {
    const gcx = bx.x + bx.w / 2, gcy = bx.y + bx.h / 2;
    ctx.strokeStyle = 'rgba(181,105,214,0.45)'; ctx.lineWidth = 1;
    if (B._pmode === 2) { for (let i = 0; i < 4; i++) { const o = (i - 1.5) * 40;
      ctx.beginPath(); ctx.moveTo(gcx - 60, gcy + o); ctx.lineTo(gcx + 60, gcy + o); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gcx + o, gcy - 60); ctx.lineTo(gcx + o, gcy + 60); ctx.stroke(); } }
    else if (B._pmode === 4 || B._pmode === 5) { for (let i = 0; i < 2; i++) { const o = (i - 0.5) * 126;   // 2 vertical lanes
      ctx.beginPath(); ctx.moveTo(gcx + o, gcy - bx.h / 2 + 6); ctx.lineTo(gcx + o, gcy + bx.h / 2 - 6); ctx.stroke(); } }
    else if (B._pmode === 3) { const a = ((B.fx && B.fx.purpleSoul && B.fx.purpleSoul.rot) || 0) * Math.PI / 180;   // rotating "+" cross arms
      for (let k = 0; k < 4; k++) { const t = a + k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(gcx, gcy); ctx.lineTo(gcx + Math.cos(t) * 62, gcy + Math.sin(t) * 62); ctx.stroke(); } }
    else if (B._pmode === 7) { const ps = (B.fx && B.fx.purpleSoul) || {};   // 3-D TUNNEL
      // the 8 expanding tunnel_radius rings (pseudo-3D depth); the heart's ring is highlighted
      if (ps.rings) for (let i = 0; i < ps.rings.length; i++) { const rr = ps.rings[i]; if (rr <= 2) continue;
        const mine = i === B.pLayer;
        ctx.strokeStyle = mine ? 'rgba(220,160,255,0.85)' : 'rgba(181,105,214,' + Math.max(0.14, 0.55 - rr / 300) + ')';
        ctx.lineWidth = mine ? 2 : 1 + rr / 110;
        ctx.beginPath(); ctx.arc(gcx, gcy, rr, 0, 6.283); ctx.stroke(); }
      if (ps.elec != null) {   // flickering electric frame around the box (obj_pink3durgenter)
        const seg = 9, w = bx.w, h = bx.h, ph = ps.elec;
        ctx.strokeStyle = '#c8a0ff'; ctx.lineWidth = 2;
        for (let s = 0; s < seg; s++) { if ((s + ph) % 3 === 0) continue; const t = s / (seg - 1);
          ctx.beginPath(); ctx.moveTo(bx.x + t * w, bx.y); ctx.lineTo(bx.x + (t + 0.06) * w, bx.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx.x + t * w, bx.y + h); ctx.lineTo(bx.x + (t + 0.06) * w, bx.y + h); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx.x, bx.y + t * h); ctx.lineTo(bx.x, bx.y + (t + 0.06) * h); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx.x + w, bx.y + t * h); ctx.lineTo(bx.x + w, bx.y + (t + 0.06) * h); ctx.stroke(); }
      }
    }
    else if (B._pmode === 8) { const ps = (B.fx && B.fx.purpleSoul) || {};   // NODE MAZE (obj_purplecontrols/obj_pinknode Draw)
      const nodes = ps.nodes || [], edges = ps.edges || [], start = ps.start || 0, sc = ps.sc || 1, lt = B.anim.f;
      // exact GML palette (BGR ints -> RGB): connections = _prpl_dark (85,0,85), nodes = _prpl_light (170,0,170),
      // the START (checkpoint 2) pulses toward lightpink (247,91,200).
      const PRPL_DARK = 'rgb(85,0,85)', PRPL_LIGHT = 'rgb(170,0,170)';
      // connections: obj_purplecontrols Draw stacks 3 thin d_lines -> a ~3px dark-purple line
      ctx.strokeStyle = PRPL_DARK; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < edges.length; i++) for (const j of (edges[i] || [])) { if (j <= i) continue; const a = nodes[i], b = nodes[j]; if (!a || !b) continue;
        ctx.beginPath(); ctx.moveTo(gcx + a.x, gcy + a.y); ctx.lineTo(gcx + b.x, gcy + b.y); ctx.stroke(); }
      // nodes: obj_pinknode Draw -> _prpl_light filled circle r4; START = merge(light, lightpink glow, .5) pulsing r5.2 + outer ring
      const glowT = (lt % 60) / 60, glow = Math.cos(glowT * 6.2832) * 0.5 + 0.5;
      for (let i = 0; i < nodes.length; i++) { const n = nodes[i];
        if (i === start) {
          ctx.fillStyle = 'rgba(208,45,170,0.55)'; ctx.beginPath(); ctx.arc(gcx + n.x, gcy + n.y, 5.2 + glow * 0.5 + 2, 0, 6.2832); ctx.fill();
          ctx.fillStyle = 'rgb(208,45,170)'; ctx.beginPath(); ctx.arc(gcx + n.x, gcy + n.y, 5.2 - glow * 0.5, 0, 6.2832); ctx.fill();
        } else { ctx.fillStyle = PRPL_LIGHT; ctx.beginPath(); ctx.arc(gcx + n.x, gcy + n.y, 4, 0, 6.2832); ctx.fill(); }
      }
      // DIE!/goal boxes (obj_pinknodeact Draw): 96x48 (x sc). mode 0 border pulses yellow->red every 40f with a
      // thickness that spikes 3->2 at the top of each cycle; mode 1 (goal) border pulses white->pink. Black fill,
      // "mainbig" text. The VISUAL box is bigger than the 48x32 hitbox — matches the source exactly.
      const bw = 48 * sc, bh = 24 * sc;
      const drawNodeBox = (nx, ny, txt, life, goal) => {
        const p = (life || lt) % 40, k = Math.min(1, (p / 40) * 2);
        let border, th = 1 * sc;
        if (goal) { border = mixHex('#ffffff', '#ff9fd0', 0.25 + 0.75 * k); if (p < 1) th = 3 * sc; else if (p < 2) th = 2 * sc; else if (p < 5) th = 2 * sc; }
        else { border = mixHex('#ffff00', '#ff0000', k); if (p < 2) th = 3 * sc; else if (p < 4) th = 2 * sc; }
        ctx.fillStyle = border; ctx.fillRect(gcx + nx - bw - th, gcy + ny - bh - th, bw * 2 + th * 2, bh * 2 + th * 2);
        ctx.fillStyle = '#000'; ctx.fillRect(gcx + nx - bw, gcy + ny - bh, bw * 2, bh * 2);
        const tw = textWidth('big', txt) || 1;
        drawText(ctx, 'big', txt, gcx + nx, gcy + ny - 11 * sc, { color: goal ? '#fff' : border, align: 'center', scale: Math.min(1, (86 * sc) / tw) });
      };
      for (const d of (ps.dieBoxes || [])) drawNodeBox(d.x, d.y, 'DIE!', d.life, false);
      if (ps.goalBox) drawNodeBox(ps.goalBox.x, ps.goalBox.y, ps.goalText || 'Stop!', ps.goalBox.life, true);
    }
    else { for (let i = 0; i < 3; i++) { const o = (i - 1) * 56;
      ctx.beginPath(); ctx.moveTo(gcx - 63, gcy + o); ctx.lineTo(gcx + 63, gcy + o); ctx.stroke(); } }
  }
  const blink = B.iframes > 0 && (B.anim.f % 8 < 4);
  if (!blink) {
    // the real heart sprites: yellow "Justice" soul, green (block), purple (Pink grid), or the normal red heart
    const soulImg = B.soulPurple ? (A.soul(B.anim.f % 20 < 10 ? 'pheart0' : 'pheart1') || tintedSoul('#b25cff'))   // the REAL spr_purpleheart (20px, 2 frames)
      : B.soulGreen ? tintedSoul('#33d13a') : B.soulYellow ? A.soul(B.anim.f % 20 < 10 ? 'yheart0' : 'yheart1') : (A.soul('red0') || A.ui('soul'));
    drawSpr(ctx, soulImg, B.soul.x, B.soul.y, { scale: B.soulPurple && B._pmode === 7 ? (B.pHScale || 1) : 1 });   // tunnel: heart ZOOMS with its ring (radius/48)
  }
  if (B.grazeFx) {   // graze sparkle: spr_grazeappear_0..3 (yellow variant for the yellow soul)
    const fr = Math.min(3, Math.floor((8 - B.grazeFx.t) / 2));
    const g = A.soul((B.soulYellow ? 'ygraze' : 'graze') + fr);
    if (g) drawSpr(ctx, g, B.grazeFx.x, B.grazeFx.y, { scale: 1, alpha: 0.9 });
  }
  // the obj_huge_anime_face GHOST rams the box — drawn ON TOP of the box + bullets + soul (may cover the play
  // area briefly on a bump; that's intended difficulty)
  if (B.fx && B.fx.pinkGhost) { const g = B.fx.pinkGhost;
    let key, flip = g.flip != null ? g.flip : true;
    if (g.kind === 'shock') key = 'pinkshock';
    else if (g.kind === 'yell') { key = 'pinkyell' + (g.frame || 0); flip = !flip; }
    else key = 'pinkghost' + (g.frame || 0);
    const gi = (A.manifest.bullets || {})[key] || (A.manifest.bullets || {}).pinkghost0, gim = gi && A.img['assets/bullets/' + gi.f];
    if (gim && gim.width) drawSpr(ctx, gim, g.x, g.y, { scale: g.scale != null ? g.scale : 1.9, flip, alpha: g.ramming ? 1 : 0.92 });
  }
  ctx.restore();
  // IDOL CONCERT crowd (obj_pink_curtains): 28 dummies line the LEFT column, BOTTOM row and RIGHT column of the
  // arena (a U-ring), drawn IN FRONT of the box + bullets. spr_dummyaudience (frame 1 = a "hater"). Each pops
  // OUT of its edge (audience_popout) when its wave is up, then fires a heart inward.
  if (B.fx && B.fx.audienceFront) for (const m of B.fx.audienceFront) {
    const key = m.hater ? 'paudience1.png' : 'paudience0.png';
    let aim = A.img['assets/bullets/' + key] || A.img['assets/bullets/paudience0.png'];
    if (aim && aim.width) { const al = Math.max(0.2, Math.min(1, (m.pop || 0) * 1.7));   // fade in as they pop out
      drawSpr(ctx, m.hater ? redTintSprite(aim) : aim, m.x, m.y, { scale: 1.5, flip: m.side === 'right', alpha: al }); }   // haters tinted RED
  }
  if (B.soulYellow) drawText(ctx, 'main', 'YELLOW SOUL - HOLD [Z] then RELEASE to FIRE (hold longer = BIG SHOT)', bx.x + bx.w / 2, bx.y + bx.h + 8, { color: '#ee0', align: 'center' });
  if (B.soulGreen) drawText(ctx, 'main', "GREEN SOUL - can't move! Aim [ARROWS] to BLOCK with Susie's AXE", bx.x + bx.w / 2, bx.y + bx.h + 8, { color: '#4de04d', align: 'center' });
  if (B.fxOnMe) {
    const tags = [];
    if (B.fxOnMe.boxScale) tags.push('CRAMPED');
    if (B.fxOnMe.soulSpeed) tags.push('HEAVY');
    if (B.fxOnMe.invertX) tags.push('REVERSED');
    if (B.fxOnMe.hearts) tags.push('FLUSTERED');
    if (B.fxOnMe.drift) tags.push('DROWSY');
    if (tags.length) drawText(ctx, 'main', tags.join(' '), bx.x + bx.w / 2, bx.y - 20, { color: '#ff8', align: 'center' });
  }
};

// fake-3D carousel: a duck-horse rides a column around a vertical cylinder. Its x sweeps
// with sin(angle); depth = cos(angle) sizes/dims it and only the FRONT columns are solid.
function updCarousel(b) {
  const c = b.carousel; c.ang += c.w;
  const depth = Math.cos(c.ang);
  b.x = c.cx + Math.sin(c.ang) * c.R;
  b.y = c.rowY + Math.sin(c.ang * 3 + c.phase) * c.bob;   // the whole column bobs together
  b.scale = 0.62 + 0.5 * (depth * 0.5 + 0.5);
  b._back = depth < 0.02;                                  // the far side draws BEHIND the box (masked by it), not hidden
  b.noHit = depth < 0.12;                                  // only front-facing horses collide
  b.flip = depth < 0;                                      // face the way it's travelling
}
// shared burst: full ring (default) or an arc of burstN bullets centred on burstAng,
// optionally with a different child sprite/colour/shape. Directional sprites face travel.
function burstChildren(b) {
  const n = b.burstN || 8, bsp = b.burstSpeed || 2.2, out = [];
  const full = b.burstArc == null;
  const bimg = b.burstImg ? bulletProps(b.burstImg).img : b.img;
  for (let i = 0; i < n; i++) {
    const ang = b.burstScatter ? Math.random() * 6.28
              : full ? (i / n * 6.28 + (b.burstRot || 0))
                     : ((b.burstAng || 0) + (n > 1 ? (i / (n - 1) - 0.5) * b.burstArc : 0));
    out.push({ img: bimg, color: b.burstColor, shape: b.burstShape,
      scale: b.burstScale != null ? b.burstScale : (b.scale || 1) * 0.55,
      r: b.burstR || Math.max(4, (b.r || 8) * 0.55),
      dmg: b.dmg, target: b.target, x: b.x, y: b.y,
      vx: Math.cos(ang) * bsp, vy: Math.sin(ang) * bsp,
      rot: b.burstImg ? ang : 0, spin: b.burstSpin != null ? b.burstSpin : (b.burstImg ? 0 : 0.2),
      life: b.burstLife, shrink: b.burstShrink, fade: b.burstFade, fadeDelay: b.burstFadeDelay, t: 0, phase0: 0 });
  }
  return out;
}

// bomb cross-laser: after a short delay, a white beam sweeps the bomb's whole row + column
function tickPendingLasers(bullets, box) {
  const B = Battle;
  if (!B.pendingLasers || !B.pendingLasers.length) return;
  for (const pl of B.pendingLasers) {
    if (--pl.t > 0) continue;
    pl.done = true;
    for (let x = box.x + 6; x <= box.x + box.w - 6; x += 12)   // horizontal beam (its row)
      bullets.push({ x, y: pl.y, vx: 0, vy: 0, r: 6, color: '#fff', life: 26, t: 0, phase0: 0, dmg: 8 });
    for (let y = box.y + 6; y <= box.y + box.h - 6; y += 12)   // vertical beam (its column)
      bullets.push({ x: pl.x, y, vx: 0, vy: 0, r: 6, color: '#fff', life: 26, t: 0, phase0: 0, dmg: 8 });
    Snd.play('boardbomb', 0.55);
  }
  B.pendingLasers = B.pendingLasers.filter(pl => !pl.done);
}

// generic sprite tint cache (red spawn-tint for the Knight's directional knives, etc.)
const imgTints = {};
function tintImg(img, color, mul) {
  const key = (img.src || img._tid || (img._tid = Math.random())) + '|' + color + (mul ? '|m' : '');
  if (imgTints[key]) return imgTints[key];
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  if (mul) {   // GML image_blend: multiply the colour but KEEP the sprite art + alpha
    x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
  } else {
    x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  }
  imgTints[key] = c; return c;
}

function drawBullet(ctx, b, px, py, s) {
  if (b.noDraw) return;   // invisible controller bullets (e.g. the BIG SHOT boss anchor)
  if (b.drawDX) px += b.drawDX * s;   // visual offset from the hitbox (overlaid face layers)
  if (b.drawDY) py += b.drawDY * s;
  if (b.img && b.img.width) {
    const im = b.tint ? tintImg(b.img, b.tint, b.tintMul) : b.img;
    drawSpr(ctx, im, px, py, { scale: (b.scale || 1) * 1.6 * s, rot: b.rot || 0, flip: b.flip,
                               sx: b.sx, sy: b.sy, alpha: b.alpha });
    return;
  }
  ctx.fillStyle = b.color || '#fff';
  if (b.shape === 'shell') {   // green-soul turtle shell (spr_bounce_shell) tinted by hp: 1 yellow..5 red
    const col = SHELL_COLORS[b.blocksLeft] || b.color || '#ffe100';
    const shImg = (typeof bulletProps === 'function') && bulletProps('gshellspr0').img;
    if (shImg && shImg.width) {   // real shell sprite, multiply-tinted to the block colour, spinning
      drawSpr(ctx, tintImg(shImg, col, true), px, py, { scale: (b.scale || 1) * 1.6 * s, rot: b.rot || 0 });
      return;
    }
    const r = (b.r || 10) * s;    // fallback procedural shell
    ctx.save(); ctx.translate(px, py); ctx.rotate(b.rot || 0);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = Math.max(1.5, 2 * s);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, 6.283); ctx.stroke();
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke();
    ctx.restore(); return;
  }
  if (b.shape === 'crescent') {
    const r = (b.r || 8) * 1.5 * s;
    ctx.save(); ctx.translate(px, py); ctx.rotate((b.rot || 0));
    ctx.strokeStyle = b.color || '#fff'; ctx.lineWidth = Math.max(2, 4 * s);
    ctx.beginPath(); ctx.arc(-r * 0.35, 0, r, -1.1, 1.1); ctx.stroke();
    ctx.lineWidth = Math.max(1, 2 * s); ctx.beginPath(); ctx.arc(-r * 0.15, 0, r * 0.7, -1.0, 1.0); ctx.stroke();
    ctx.restore();
  } else if (b.shape === 'star') {
    ctx.save(); ctx.translate(px, py); ctx.rotate((b.t || 0) * 0.1);
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-1 * s, -6 * s, 2 * s, 12 * s); }
    ctx.restore();
  } else if (b.shape === 'diamond') {   // DELTARUNE white bullet-diamond (Gerson squish barrage)
    const r = (b.r || 6) * 1.5 * s;
    ctx.save(); ctx.translate(px, py); ctx.rotate((b.rot || 0) + Math.PI / 4);
    ctx.fillStyle = b.color || '#fff'; ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  } else if (b.shape === 'note') {
    ctx.fillRect(px - 2 * s, py - 6 * s, 3 * s, 10 * s);
    ctx.beginPath(); ctx.arc(px - 3 * s, py + 4 * s, 4 * s, 0, 7); ctx.fill();
  } else if (b.shape === 'line') {   // full-length line (Knight/Gerson red-slash TELL, then the cut)
    const L = (b.len || 400) * s, th = (b.thick || 4) * s;
    ctx.save(); ctx.translate(px, py); ctx.rotate(b.rot || 0);
    ctx.globalAlpha = b.armed ? 1 : (b.tellFade != null ? b.tellFade : 0.5);
    let col = b.color || '#f33';
    if (b.tellRamp) {   // GML Gerson telegraph: RED then FADE TO WHITE as the slash lands (white on the cut)
      const prog = b.armed ? 1 : Math.max(0, Math.min(1, 1 - (b.tellT || 0) / (b.tellMax || 12)));
      const gb = Math.round(59 + prog * 196); col = 'rgb(255,' + gb + ',' + gb + ')';   // (255,59,59) -> white
    }
    ctx.fillStyle = col; ctx.fillRect(-L / 2, -th / 2, L, th);
    ctx.restore(); ctx.globalAlpha = 1;
  } else if (b.shape === 'ring') {   // landing-target telegraph (Pink fusebombs): flashing outline + growing filled core
    ctx.save(); ctx.strokeStyle = b.color || '#ffbb00'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.arc(px, py, Math.max(1, (b.ringR || 10) * s), 0, 7); ctx.stroke();
    if (b.fillR > 0.5) { ctx.fillStyle = b.color || '#ffbb00'; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(px, py, b.fillR * s, 0, 7); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
  } else { ctx.beginPath(); ctx.arc(px, py, (b.r || 5) * s, 0, 7); ctx.fill(); }
}

const soulTints = {};
function tintedSoul(color) {
  if (soulTints[color]) return soulTints[color];
  const src = A.ui('soul');
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  soulTints[color] = c; return c;
}

Battle.renderMirror = function (ctx) {
  const B = Battle, M = B.mirror;
  if (!M || !B.oppDodging || !B.oppSoul) return;
  const s = 0.5, mw = M.box.w * s, mh = M.box.h * s, mx = 500 - mw / 2, my = 92 - mh / 2;
  const od = frontLiving(B.oppTeam) ? frontLiving(B.oppTeam).def : B.oppTeam[0].def;
  ctx.save(); ctx.globalAlpha = 0.62; ctx.fillStyle = '#000'; ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 2; ctx.strokeRect(mx - 1, my - 1, mw + 2, mh + 2);
  ctx.beginPath(); ctx.rect(mx - 20, my - 20, mw + 40, mh + 40); ctx.clip();
  for (const b of M.bullets) drawBullet(ctx, b, mx + b.x * s, my + b.y * s, s);
  ctx.globalAlpha = 0.95;
  drawSpr(ctx, A.soul('red0') || tintedSoul(od.color), mx + M.soul.x * s, my + M.soul.y * s, { scale: 0.75 });
  ctx.restore();
  drawSpr(ctx, A.hued(A.ui('head_' + od.base), od.hue), mx - 18, my + 10, { scale: 1, alpha: 0.9 });
};

// --------- bottom UI: party info panels (HP/name) + a black dialogue box that
// holds text, command buttons, option grids and target lists (Deltarune-style).
const PANEL_BASE = 366, PANEL_H = 34, RAISE = 40;   // active panel raises to reveal its buttons
const DBOX = { x: 20, y: 400, w: 600, h: 78 };      // dialogue box sits flush under the panels

// panel layout: [icon] NAME  HP [ value/max over a short health bar ]
function drawPartyPanel(ctx, m, px, py, w, active) {
  const out = isOut(m);
  ctx.fillStyle = '#000'; ctx.fillRect(px, py, w, PANEL_H);
  ctx.strokeStyle = active ? m.def.color : '#333'; ctx.lineWidth = active ? 2 : 1; ctx.strokeRect(px + 1, py + 1, w - 2, PANEL_H - 2);
  let head = A.ui('head_' + m.def.base + (m.downed ? '_gray' : '')); if (!m.downed && m.def.hue) head = A.hued(head, m.def.hue);
  drawSpr(ctx, head, px + 16, py + PANEL_H / 2, { scale: 0.8, alpha: m.spared ? 0.5 : 1 });
  drawText(ctx, 'main', m.def.shortName || m.def.name, px + 32, py + 10, { color: out ? '#666' : '#fff' });
  const barW = 82, barX = px + w - barW - 6, barY = py + 22;
  drawText(ctx, 'main', 'HP', barX - 22, py + 10, { color: out ? '#555' : '#c8c8c8' });
  drawText(ctx, 'main', m.frozen ? 'FROZEN' : m.spared ? 'SPARED' : (m.hp + '/' + m.max), barX, py + 4, { color: m.frozen ? '#8cf' : out ? '#888' : '#fff' });
  ctx.fillStyle = m.frozen ? '#12354d' : '#3c0d0d'; ctx.fillRect(barX, barY, barW, 6);
  if (!m.frozen) { ctx.fillStyle = out ? '#611' : m.def.color; ctx.fillRect(barX, barY, Math.max(0, Math.round(barW * m.hp / m.max)), 6); }
  if (isDarkner(m) && !out) {
    const maxL = m.def.maxLevel || 10, lvl = m.darkLvl || 0, maxed = lvl >= maxL;
    ctx.fillStyle = '#1a0a2a'; ctx.fillRect(barX, barY + 7, barW, 3);
    ctx.fillStyle = maxed ? '#d060ff' : '#8a2be2'; ctx.fillRect(barX, barY + 7, Math.round(barW * lvl / maxL), 3);
    drawText(ctx, 'main', maxed ? '🌑MAX' : '🌑' + lvl, barX + barW - 2, barY - 1, { color: maxed ? '#d060ff' : '#a86ede', align: 'right', scale: 0.7 });
  }
}

function wrapText(ctx, text, x, y, maxW, lineH, color, scale) {
  scale = scale || 0.8;
  const maxChars = Math.max(6, Math.floor(maxW / (7 * scale)));
  const words = ('' + (text || '')).split(' '); const lines = []; let line = '';
  for (const w of words) { if ((line + ' ' + w).trim().length > maxChars && line) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w; }
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((ln, i) => drawText(ctx, 'main', ln, x, y + i * lineH, { color, scale }));
}

Battle.renderHud = function (ctx) {
  const B = Battle;
  // When an attack starts the dialogue box SLIDES DOWN off-screen and the HP panels slide down WITH it to sit
  // FLUSH at the bottom (DELTARUNE). dboxSlide eases 0 (menu) -> 1 (dodge). SLIDE moves panels 366 -> 446.
  const dodging = B.phase === 'dodge' || B.phase === 'boxin' || B.phase === 'boxout';
  B.dboxSlide = (B.dboxSlide || 0) + ((dodging ? 1 : 0) - (B.dboxSlide || 0)) * 0.3;
  if (B.dboxSlide < 0.002) B.dboxSlide = 0;
  const SLIDE = B.dboxSlide * (446 - PANEL_BASE);
  // party info panels
  const n = B.myTeam.length;
  const pw = Math.min(196, (600 - (n - 1) * 8) / n);
  const totalW = n * pw + (n - 1) * 8, startX = 320 - totalW / 2;
  const activeMi = (B.phase === 'select' && !B.targeting && !B.submenu) ? B.cmdOrder[B.cmdPos]
                 : B.phase === 'timing' ? ((B.bars.find(x => !x.done && x.started) || B.bars.find(x => !x.done) || {}).mi) : -1;
  // panels sit flush on the dialogue box; the ACTIVE member's panel RAISES up,
  // revealing its command buttons in the gap (they pop up from the box).
  B.myTeam.forEach((m, i) => {
    if (m.raise == null) m.raise = 0;
    m.raise += ((i === activeMi ? 1 : 0) - m.raise) * 0.4;
    const px = startX + i * (pw + 8), py = PANEL_BASE - RAISE * m.raise + SLIDE;
    if (m.raise > 0.05 && B.phase === 'select') Battle.renderCommandButtons(ctx, m, px, py + PANEL_H, pw, Math.min(1, m.raise * 1.5));
    drawPartyPanel(ctx, m, px, py, pw, i === activeMi);
  });

  // shared TP bar + buffs + turn/timer
  const dispTP = B.phase === 'select' ? Math.max(0, Math.min(100, B.myTP - (B.tpSpent || 0) + (B.tpSel || 0))) : B.myTP;
  ctx.fillStyle = '#3f0000'; ctx.fillRect(38, 70, 16, 190);
  const tpH = Math.round(190 * dispTP / 100);
  ctx.fillStyle = '#ff8000'; ctx.fillRect(38, 70 + 190 - tpH, 16, tpH);
  if (tpH > 0 && tpH < 190) { ctx.fillStyle = '#fff'; ctx.fillRect(38, 70 + 190 - tpH, 16, 3); }
  drawText(ctx, 'main', 'TP', 40, 52, { color: '#ff8000', align: 'center' });
  drawText(ctx, 'main', '' + dispTP, 46, 264, { color: '#ff8000', align: 'center' });
  let by = 286;
  if (B.myGuardBuff > 0) { drawText(ctx, 'main', 'GUARD ' + B.myGuardBuff, 26, by, { color: '#6cf' }); by += 18; }
  if (B.myPowerBuff > 0) { drawText(ctx, 'main', 'POWER ' + B.myPowerBuff, 26, by, { color: '#f84' }); }
  if (B.phase === 'select') { const secs = Math.ceil(B.timer / 60); drawText(ctx, 'big', '' + secs, 320, 16, { color: secs <= 5 ? '#f44' : '#fff', align: 'center', scale: 0.5 }); }
  drawText(ctx, 'main', 'TURN ' + B.turn, 26, 16, { color: '#666' });

  // bottom dialogue box: SLIDES DOWN off-screen during the dodge (the panels ride it down to sit flush at the
  // bottom). Its text content only shows when it's up (not sliding).
  if (B.dboxSlide < 0.98) {
    const d = DBOX, dy = d.y + B.dboxSlide * 130;
    ctx.fillStyle = '#000'; ctx.fillRect(d.x, dy, d.w, d.h);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(d.x + 1, dy + 1, d.w - 2, d.h - 2);
    if (B.dboxSlide < 0.2) {
      if (B.phase === 'timing') { /* renderTiming draws the bars over this box */ }
      else if (B.targeting) Battle.renderTargetList(ctx, d);
      else if (B.submenu) Battle.renderOptionGrid(ctx, d);
      else (B.msg || []).slice(0, 3).forEach((m, i) => drawText(ctx, 'main', m, d.x + 16, dy + 12 + i * 20, { color: '#fff' }));
    }
  }
};
Battle.renderMsg = function () {};   // text now lives inside the dialogue box

// command buttons revealed under the raised active panel (icons TOP-aligned so
// the shorter SPARE/CHARGE line up). Button labels are baked into the textures.
Battle.renderCommandButtons = function (ctx, mem, px, py, w, alpha) {
  const B = Battle, names = menuFor(mem);
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.fillStyle = '#000'; ctx.fillRect(px, py, w, 38);
  ctx.strokeStyle = mem.def.color; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, w - 2, 36);
  const step = (w - 8) / names.length, top = py + 3;
  for (let k = 0; k < names.length; k++) {
    const name = names[k], img = A.ui('btn_' + name + (B.menuIdx === k ? '_sel' : ''));
    const cx = px + 4 + step * k + step / 2;
    const greyed = name === 'spare' && isDarkner(mem);   // darkners can't SPARE — show it greyed-out
    if (img && img.width) drawSpr(ctx, img, cx, top + img.height / 2, { scale: 1, alpha: greyed ? 0.3 : 1 });
  }
  ctx.restore();
};

// 3-column layout at full font: two option columns (row-major) + info column.
Battle.renderOptionGrid = function (ctx, d) {
  const B = Battle;
  const opts = B.subOptions();
  const perPage = 6, page = Math.floor(B.subIdx / perPage), pages = Math.ceil(opts.length / perPage);
  const optW = Math.round(d.w * 0.56), infoX = d.x + optW + 14, infoW = d.w - optW - 28;
  const colX = [d.x + 14, d.x + optW / 2 + 6], rowY = [d.y + 10, d.y + 32, d.y + 54];
  for (let j = 0; j < perPage; j++) {
    const gi = page * perPage + j; if (gi >= opts.length) break;
    const o = opts[gi], sel = gi === B.subIdx;
    const x = colX[j % 2], y = rowY[Math.floor(j / 2)];
    const color = o.disabled ? '#666' : o.ult ? '#f6a' : sel ? '#ff0' : '#fff';
    drawText(ctx, 'main', (sel ? '> ' : '  ') + o.label, x, y, { color });
  }
  if (pages > 1) drawText(ctx, 'main', 'PG ' + (page + 1) + '/' + pages, d.x + optW - 56, d.y + d.h - 18, { color: '#888' });
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(infoX - 10, d.y + 8); ctx.lineTo(infoX - 10, d.y + d.h - 8); ctx.stroke();
  const cur = opts[B.subIdx];
  if (cur) {
    let ty = d.y + 10;
    if (cur.ally) { const h = A.ui('head_' + cur.ally); if (h) drawSpr(ctx, h, infoX + 9, d.y + 16, { scale: 0.8 }); drawText(ctx, 'main', '+ ' + cur.ally.toUpperCase(), infoX + 22, d.y + 10, { color: '#8cf' }); ty = d.y + 32; }
    wrapText(ctx, cur.info || '', infoX, ty, infoW, 18, '#cfcfcf', 1);
    const bottom = cur.item ? '' : (cur.cost ? cur.cost : 'FREE');
    if (bottom) drawText(ctx, 'main', bottom, d.x + d.w - 14, d.y + d.h - 18, { color: '#ff8000', align: 'right' });
  }
};

Battle.renderTargetList = function (ctx, d) {
  const B = Battle, ally = B.targetSideCur === 'ally', team = ally ? B.myTeam : B.oppTeam;
  const optW = Math.round(d.w * 0.56), infoX = d.x + optW + 14, infoW = d.w - optW - 28;
  const colX = [d.x + 14, d.x + optW / 2 + 6], rowY = [d.y + 10, d.y + 32, d.y + 54];
  const perPage = 6, page = Math.floor(B.targetIdx / perPage), pages = Math.ceil(B.targetList.length / perPage);
  for (let j = 0; j < perPage; j++) {
    const gi = page * perPage + j; if (gi >= B.targetList.length) break;
    const m = team[B.targetList[gi]], sel = gi === B.targetIdx;
    const x = colX[j % 2], y = rowY[Math.floor(j / 2)];
    let head = A.ui('head_' + m.def.base); if (m.def.hue) head = A.hued(head, m.def.hue);
    drawSpr(ctx, head, x + 24, y + 8, { scale: 0.7 });
    drawText(ctx, 'main', (sel ? '> ' : '  ') + (m.def.shortName || m.def.name), x + 36, y, { color: sel ? '#ff0' : '#fff' });
  }
  if (pages > 1) drawText(ctx, 'main', 'PG ' + (page + 1) + '/' + pages, d.x + optW - 56, d.y + d.h - 18, { color: '#888' });
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(infoX - 10, d.y + 8); ctx.lineTo(infoX - 10, d.y + d.h - 8); ctx.stroke();
  const tm = team[B.targetList[B.targetIdx]];
  if (tm) {
    drawText(ctx, 'main', tm.def.shortName || tm.def.name, infoX, d.y + 8, { color: '#fff' });
    ctx.fillStyle = '#3c0d0d'; ctx.fillRect(infoX, d.y + 30, infoW, 7);
    ctx.fillStyle = tm.def.color; ctx.fillRect(infoX, d.y + 30, Math.max(0, Math.round(infoW * tm.hp / tm.max)), 7);
    drawText(ctx, 'main', tm.hp + '/' + tm.max, infoX + infoW, d.y + 28, { color: '#bbb', align: 'right' });
    if (!ally) {
      // MERCY bar + exact % (always shown so you can track progress toward a spare)
      ctx.fillStyle = '#3a3000'; ctx.fillRect(infoX, d.y + 50, infoW, 6);
      ctx.fillStyle = canSpare(tm) ? '#ffd000' : '#c8a000'; ctx.fillRect(infoX, d.y + 50, Math.round(infoW * tm.mercy / 100), 6);
      drawText(ctx, 'main', 'MERCY ' + tm.mercy + '%', infoX, d.y + 40, { color: '#ffd000' });
      // status + the exact spare CONDITION so the player knows what's needed
      const ready = canSpare(tm), status = ready ? 'SPARE READY!' : spareHint(tm.def);
      drawText(ctx, 'main', status, infoX, d.y + d.h - 16, { color: ready ? '#ff0' : (tm.def.spare || {}).never ? '#f66' : '#aa8' });
    }
  }
};

Battle.renderTiming = function (ctx) {
  const B = Battle, d = DBOX;
  // the FIGHT timing bars live inside the bottom dialogue box
  const x = d.x + 54, w = d.w - 118, h = 15;
  const active = B.bars.find(b => !b.done && b.started) || B.bars.find(b => !b.done);
  drawText(ctx, 'main', 'TIME YOUR STRIKES!', d.x + 12, d.y + 3, { color: '#ff8000' });
  B.bars.forEach((bar, k) => {
    const def = B.myTeam[bar.mi].def;
    const y = d.y + 22 + k * 17;
    drawSpr(ctx, A.hued(A.ui('head_' + def.base), def.hue), d.x + 28, y + h / 2, { scale: 0.6 });
    ctx.globalAlpha = bar.done ? 0.4 : (bar === active ? 1 : 0.7);
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = bar === active ? '#fff' : '#888'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = def.color; ctx.globalAlpha = (bar.done ? 0.4 : 0.8);
    ctx.fillRect(x + 13, y + 2, 26, h - 4);
    ctx.globalAlpha = bar.done ? 0.4 : 1;
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 25, y + 2, 2, h - 4);   // perfect tick
    if (bar.started && !bar.done) { ctx.fillStyle = '#fff'; ctx.fillRect(x + Math.max(0, bar.x) - 2, y - 3, 4, h + 6); }
    if (bar.done && bar.tier != null) drawText(ctx, 'main', TIER_NAME[bar.tier], x + w + 6, y, { color: bar.tier === 2 ? '#ff0' : bar.tier === 1 ? '#8f8' : '#888' });
    ctx.globalAlpha = 1;
  });
};

Battle.renderGameover = function (ctx) {
  const B = Battle;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 640, 480);
  const txt = B.result === 'win' ? 'YOU WON!' : B.result === 'draw' ? 'DRAW!' : 'YOU LOST!';
  const col = B.result === 'win' ? '#ff0' : B.result === 'draw' ? '#fff' : '#f44';
  drawText(ctx, 'big', txt, 320, 170, { color: col, align: 'center' });
  drawText(ctx, 'main', B.rematchMe ? (B.rematchOpp ? '' : 'Waiting for opponent...') : 'Press [Z] for REMATCH',
           320, 250, { color: '#fff', align: 'center' });
};
