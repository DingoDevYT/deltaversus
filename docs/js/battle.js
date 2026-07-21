// Battle: team-based turn loop (party size 1-3). A size-1 team == classic 1v1.
// Phases: select -> waitopp -> reveal -> timing -> waittier -> dodge
//         -> waitresult -> resolve -> (select | gameover)

const BOX = { x: 220, y: 116, w: 200, h: 200 };   // dodge box (square by default)
const SOUL_R = 5;
const GRAZE_R = 15;
const BOX_ANIM = 16;   // frames for the box open/close spin-in animation
const SELECT_FRAMES = 24 * 60;
const IFRAMES = 55;
const TIER_TP = [4, 10, 18];   // accuracy -> TP

const Battle = {};

// ---------- team helpers ----------
function mkMember(sel) {
  const def = charDef(sel);
  return { sel, def, hp: def.hp, max: def.hp, downed: false, spared: false,
           mercy: 0, tiredFlag: false,   // mercy = how close YOU are to sparing this foe
           action: null, tier: null, pose: 'idle', poseT: 0,
           dark: 0 };   // darkness/CHARGE meter (darkners only)
}
// a member is "out" if downed OR spared; a team is done when all are out.
function isOut(m) { return m.downed || m.spared; }
function living(team) { return team.filter(m => !isOut(m)); }
function teamDead(team) { return team.every(isOut); }
function frontLiving(team) { for (const m of team) if (!isOut(m)) return m; return null; }
function isTired(m) { return !isOut(m) && (m.tiredFlag || m.hp <= m.max * 0.30); }
function oppMaxLevel() { return Battle.oppTeam.reduce((mx, m) => isOut(m) ? mx : Math.max(mx, m.def.level || 1), 1); }
// can this enemy member currently be SPARED? returns true/false (mercy + condition)
function canSpare(m) {
  if (isOut(m)) return false;
  const sp = m.def.spare || {};
  if (sp.never) return false;
  if (m.mercy < 100) return false;
  if (sp.alone && living(Battle.oppTeam).length > 1) return false;
  if (sp.downed && !m.downed) return false;   // (unreachable via normal flow; kept for intent)
  if (sp.fullHp && m.hp < m.max) return false;
  if (sp.noKris && Battle.oppTeam.some(o => !isOut(o) && o.def.base === 'kris')) return false;
  return true;
}
function moveDefOf(def, a) {
  if (!a) return null;
  if (a.cmd === 'fight') return def.fight;
  if (a.cmd === 'magic') return a.move === def.ult.id ? def.ult : (def.spells || []).find(s => s.id === a.move);
  if (a.cmd === 'act') return (def.acts || []).find(s => s.id === a.move);
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
  jevil_spade: 'jokerha', jevil_diamond: 'jokerlaugh', jevil_carousel: 'jokerlaugh', jevil_ult: 'jokerchaos',
  // Spamton NEO - his real Ch2 sounds (laser / pipis mail / overpower voice)
  sneo_heads: 'sneogun', sneo_heart: 'laz', sneo_mail: 'pipis', sneo_phones: 'laz',
  sneo_face: 'spamtonlaugh', sneo_bigshot: 'sneoover',
  // The Roaring Knight - the Ch3 board-battle sounds
  knight_corridor: 'knightsword', knight_circle: 'knightsword', knight_slash: 'boarddmg',
  knight_board: 'boardbomb', knight_roar: 'knightlaugh',
};

// ---------- init ----------
Battle.init = function (opts) {
  const B = Battle;
  B.matchN = opts.matchN || 1;
  B.size = opts.size || 1;
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
  else if (m.t === 'snowgrave') { for (const mm of B.myTeam) { mm.hp = 0; mm.downed = true; mm.pose = 'downed'; mm.poseT = 0; } }
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
const CHARGE_GAIN = 17;   // darkness per CHARGE turn (~6 charges to full)
// darkners swap ACT for CHARGE and pay a discounted TP rate on spells
function isDarkner(mem) { return !!(mem && mem.def && mem.def.darkner); }
// Every lightner can SPARE. Only KRIS can ACT (his MAGIC slot becomes ACT); the
// other fun-gang members have no ACT (they only ACT via Kris's dual-acts).
function menuFor(mem) {
  // CHARGE is a DARKNER-only mechanic (Lancer / Jevil / Spamton / Knight). Everyone else SPAREs.
  if (isDarkner(mem)) return ['fight', 'magic', 'charge', 'item', 'defend'];
  if (mem && mem.def && mem.def.base === 'kris') return ['fight', 'act', 'item', 'spare', 'defend'];
  return ['fight', 'magic', 'item', 'spare', 'defend'];
}
function spellCost(mem, d) { return isDarkner(mem) ? Math.ceil(d.tp * 0.6) : d.tp; }
Battle.startSelect = function (fresh) {
  const B = Battle;
  // passive regen: every downed ally recovers 1/8 max HP at the start of the party's turn,
  // standing back up (min 1/6 max) if that clears their debt. (Not on the very first turn.)
  if (!fresh) for (const m of B.myTeam) if (m.downed) {
    const wasDown = m.downed;
    healHP(m, Math.ceil(m.max / 8));
    B.dmgPops.push({ x: 96, y: teamGroundY(B.myTeam.indexOf(m), B.myTeam.length) - 30,
                     txt: wasDown && !m.downed ? 'UP!' : '+' + Math.ceil(m.max / 8), t: 0, color: '#2f2' });
  }
  B.cmdOrder = B.myTeam.map((m, i) => i).filter(i => !B.myTeam[i].downed);
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
  return (def.spells || []).find(s => s.id === id) || (def.acts || []).find(s => s.id === id) || null;
}
// which team an action targets: 'enemy', 'ally', or null (self/party/no target).
function targetSide(cmd, def, move) {
  if (cmd === 'fight' || cmd === 'spare') return 'enemy';
  if (cmd === 'item') return 'ally';
  if (cmd === 'act') {
    const ad = (def.acts || []).find(s => s.id === move);
    if (!ad) return null;
    return (ad.kind === 'attack' || ad.kind === 'mercy') ? 'enemy' : null;
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
      const cmd = menu[B.menuIdx];
      if (cmd === 'item' && !B.canUseItems()) { Snd.play('cantselect'); }
      else {
        Snd.play('select');
        if (cmd === 'fight' || cmd === 'defend' || cmd === 'charge' || cmd === 'spare') B.choose(cmd, null);
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
  if (B.submenu === 'magic') {
    const opt = (s, ult) => {
      const cost = spellCost(mem, s);
      const gated = s.darkReq && mem.dark < s.darkReq;
      const snowLock = s.snowgrave && B.proceedCount < 3;   // SNOWGRAVE needs Proceed x3
      let eff = '';
      if (s.kind === 'attack') eff = 'Deals ' + s.dmg + ' damage.';
      else if (s.kind === 'heal') eff = 'Heals ' + s.heal + ' HP.';
      else if (s.kind === 'mercy') eff = 'Raises the foe\'s MERCY.';
      else if (s.kind === 'spareTired') eff = s.scope === 'all' ? 'Spares all TIRED foes.' : 'Spares a TIRED foe.';
      else if (s.kind === 'revive') eff = 'Revives a downed ally.';
      return { id: s.id, label: s.name, ult,
               cost: snowLock ? 'NEEDx3' : gated ? '🌑x' + Math.ceil(s.darkReq / CHARGE_GAIN) : cost + '%',
               costTP: cost, disabled: snowLock || gated || B.tpAvail() < cost, info: eff };
    };
    const list = c.spells.map(s => opt(s, false));
    list.push(opt(c.ult, true));
    return list;
  }
  if (B.submenu === 'act') {
    const opts = [];
    const lvl3 = oppMaxLevel() >= 3;
    const remaining = new Set(B.cmdOrder.slice(B.cmdPos + 1));   // allies not yet acted
    for (const ad of (c.acts || [])) {
      if (ad.lvl3 && !lvl3) continue;                            // level-3-only acts hidden otherwise
      let disabled = false, cost = ad.tp ? ad.tp + '%' : 'FREE';
      if (ad.tp && B.tpAvail() < ad.tp) disabled = true;
      if (ad.ally) {
        const ai = B.myTeam.findIndex((m, i) => !isOut(m) && m.def.base === ad.ally && remaining.has(i) && !m.action);
        if (ai < 0) { disabled = true; cost = 'need ' + ad.ally.toUpperCase(); }
      }
      if (ad.id === 'act_proceed') cost = B.proceedCount >= 2 ? 'x3->SNOW' : 'x' + (B.proceedCount + 1);
      opts.push({ id: ad.id, label: ad.name, cost, disabled, ally: ad.ally, info: ad.text });
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
    }
    if (!cand.length) { Snd.play('cantselect'); B.say('* No valid target!'); B.submenu = null; return; }
    if (cand.length > 1) {
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
    const ad = (c.acts || []).find(s => s.id === move);
    if (ad && ad.tp) B.tpSpent += ad.tp;
    if (ad && ad.ally) {   // multi-act: consume a not-yet-acted ally's turn as an assist
      const ai = B.cmdOrder.slice(B.cmdPos + 1).find(i => !isOut(B.myTeam[i]) && B.myTeam[i].def.base === ad.ally && !B.myTeam[i].action);
      if (ai != null) { B.myTeam[ai].action = { mi: ai, cmd: 'assist', of: act.mi, seed: randSeed() }; act.assistMi = ai; }
    }
  }
  else if (cmd === 'item') { B.itemsUsed.push(move); act.itemId = B.myItems[move]; }
  else if (cmd === 'defend') B.tpSel += 16;   // instant, visible TP gain
  else if (cmd === 'charge') { mem.dark = Math.min(100, mem.dark + CHARGE_GAIN); B.tpSel += 8; }
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
      const ad = (c.acts || []).find(s => s.id === a.move); if (ad && ad.tp) B.tpSpent -= ad.tp;
      if (a.assistMi != null && B.myTeam[a.assistMi]) B.myTeam[a.assistMi].action = null;
    }
    else if (a.cmd === 'item') { const k = B.itemsUsed.indexOf(a.move); if (k >= 0) B.itemsUsed.splice(k, 1); }
    else if (a.cmd === 'defend') B.tpSel -= 16;
    else if (a.cmd === 'charge') { mem.dark = Math.max(0, mem.dark - CHARGE_GAIN); B.tpSel -= 8; }
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
  if (a.cmd === 'fight') return c.fight.text;
  if (a.cmd === 'magic') { const d = moveById(c, a.move); return d ? d.text : c.name + ' casts magic!'; }
  if (a.cmd === 'act') { const d = (c.acts || []).find(s => s.id === a.move); return d ? d.text : c.name + ' ACTs.'; }
  if (a.cmd === 'spare') return c.name + ' spares the foe!';
  if (a.cmd === 'assist') return c.name + ' joins the ACT!';
  if (a.cmd === 'item') return c.name + ' uses ' + (a.itemId ? ITEMS[a.itemId].name.toUpperCase() : 'an item') + '!';
  if (a.cmd === 'defend') return c.name + ' braces for impact!';
  if (a.cmd === 'charge') return c.name + ' draws in the DARKNESS!';
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
    if (!m.action) continue;
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
        if (it.revivePct) { tgt.hp = Math.max(tgt.hp, Math.round(tgt.max * it.revivePct)); if (tgt.downed) { tgt.downed = false; tgt.pose = 'idle'; tgt.poseT = 0; } }  // revive items bypass the debt, never lower HP
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
  m.hp = Math.min(m.max, m.hp + amt);
  if (m.downed && m.hp > 0) {
    m.hp = Math.max(m.hp, Math.ceil(m.max / 6));   // minimum stand-up HP
    m.downed = false; m.pose = 'idle'; m.poseT = 0;
  }
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
    if (!m.downed) { m.downed = true; m.pose = 'downed'; m.poseT = 0; }
  }
  return m;
}

Battle.updDodge = function () {
  const B = Battle;
  const fx = B.fxOnMe || {};
  let sp = 2.4 * (fx.soulSpeed || 1);
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
  B.soul.x = Math.max(x0, Math.min(x1, B.soul.x));
  B.soul.y = Math.max(y0, Math.min(y1, B.soul.y));
  for (const h of B.hearts) { h.x += h.vx; h.y += h.vy; if (h.x < bx.x || h.x > bx.x + bx.w) h.vx *= -1; if (h.y < bx.y || h.y > bx.y + bx.h) h.vy *= -1; }

  // ---- YELLOW SOUL: HOLD the button to charge, RELEASE to fire a shot to the RIGHT.
  //      Hold time = shot size: a quick tap = a small pellet, a long hold = the BIG SHOT.
  //      You can't rapid-fire AND charge at once - it's one shot per press-release. ----
  if (B.soulYellow) {
    const ok = Input.down.ok;
    const BIG_AT = 26;   // frames held to graduate a tap into a BIG SHOT
    if (ok) {
      if (B.charge === 0) Snd.play('sneocharge', 0.5);   // start-of-charge whir
      B.charge = Math.min(60, B.charge + 1);
    } else if (B._okPrev) {                 // just released -> fire
      const c = B.charge, big = c >= BIG_AT;
      // big shot: modest size, its own sneobig sprite, damages each target ONCE (hit set),
      // pierces up to 3 targets. push is small so it nudges rather than launches.
      B.shots.push({ x: B.soul.x + 8, y: B.soul.y, vx: big ? 8.5 : 8,
                     r: big ? 9 : 4, big, power: big ? 4 : 1, pierce: big ? 3 : 1, hitIds: [] });
      Snd.play(big ? 'sneofire' : 'heartshot', big ? 0.75 : 0.5);   // real heart-shot / big-shot fire
      B.charge = 0;
    } else {
      B.charge = 0;
    }
    B._okPrev = ok;
    for (const s of B.shots) s.x += s.vx;
    B.shots = B.shots.filter(s => !s.dead && s.x < bx.x + bx.w + 220);
    for (const fx of B.shotFx) fx.t++;
    B.shotFx = B.shotFx.filter(fx => fx.t < 15);
  }

  // transient fx are re-requested by the pattern each frame; box target persists so the box can ease back
  B.fx.blackout = false; B.fx.pull = null; B.fx.faceBox = null; B.fx.arms = null; B.fx.bgHue = null;
  B.fx.split = null; B.fx.boss = null; B.fx.hideBox = false; B.fx.pinch = 0; B.fx.arena = false;
  B.fx.bgStars = false; B.fx.shake = 0;
  B.sim.tick(B.soul, b => { b.t = 0; if (b.phase0 == null) b.phase0 = Math.random() * 6.28; B.bullets.push(b); }, B.fx);
  tickPendingLasers(B.bullets, B.dodgeBox);
  if (B.iframes > 0) B.iframes--;
  if (B.grazeCd > 0) B.grazeCd--;
  const front = frontLiving(B.myTeam);
  const defending = front && front.action && front.action.cmd === 'defend';
  const spawned = [];   // bullets emitted by controller bullets this frame (added after the loop)
  for (const b of B.bullets) {
    b.t++;
    if (b.homing) { const d = Math.hypot(B.soul.x - b.x, B.soul.y - b.y) || 1; b.vx += (B.soul.x - b.x) / d * b.homing; b.vy += (B.soul.y - b.y) / d * b.homing; }
    b.vx += b.ax || 0; b.vy += b.ay || 0;
    if (b.maxv) { const v = Math.hypot(b.vx, b.vy); if (v > b.maxv) { b.vx *= b.maxv / v; b.vy *= b.maxv / v; } }
    b.x += b.vx; b.y += b.vy;
    if (b.orbit) { b.orbit.ang += b.orbit.w; b.x = b.orbit.cx + Math.cos(b.orbit.ang) * b.orbit.R; b.y = b.orbit.cy + Math.sin(b.orbit.ang) * b.orbit.R; }
    if (b.swing) b.x = b.swing.cx + b.swing.amp * Math.sin(b.t * b.swing.spd + (b.swing.ph || 0));
    if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
    if (b.lerpY != null) b.y += (b.lerpY - b.y) * (b.lerpRate || 0.12);   // ease toward a row and STAY on it
    if (b.spin) b.rot = (b.rot || 0) + b.spin;
    if (b.spinDecay) { b.spin *= b.spinDecay; if (Math.abs(b.spin) < 0.0008) b.spin = 0; }   // rotation eases to a stop (Knight red-slash tell)
    if (b.shrink) b.scale = (b.scale || 1) * b.shrink;   // bullet shrinks over time (eaten dollars)
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
    if (b.tellT != null && --b.tellT <= 0 && !b.armed) { b.armed = true; b.armT = b.armWindow || 10; Snd.play('boarddmg', 0.5); }   // tell -> live cut
    if (b.armed && b.armT != null && --b.armT <= 0) b.dead = true;
    // controller bullets (climbing head, face parts) emit projectiles from their LIVE position
    if (b.emit && !b.dead) b.emit(b, spawned, B.soul, B.dodgeBox, B.fx);
    // yellow-soul shots destroy shootable boss bullets (heads / mail / heart)
    if (B.soulYellow && b.shootable) {
      for (const s of B.shots) {
        if (s.hitIds && s.hitIds.indexOf(b) >= 0) continue;   // a single shot damages each target only ONCE
        if (Math.hypot(b.x - s.x, b.y - s.y) < (b.r || 8) + s.r) {
          if (s.hitIds) s.hitIds.push(b);
          if (b.pushOnShot) b.x += (s.big ? 2 : 1) * b.pushOnShot;   // small nudge back toward the boss
          b.hp = (b.hp || 1) - (s.power || (s.big ? 4 : 1));
          if (!s.big || --s.pierce <= 0) s.dead = true;
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
    if (b.shape === 'line' && !b.armed) continue;   // a tell-line only hurts once the Knight actually cuts (armed)
    // line hitbox: perpendicular distance to the (rotated) line through b, within its length
    let lineHit = false;
    if (b.shape === 'line') {
      const nx = -Math.sin(b.rot || 0), ny = Math.cos(b.rot || 0);
      const perp = Math.abs((B.soul.x - b.x) * nx + (B.soul.y - b.y) * ny);
      const along = Math.abs((B.soul.x - b.x) * Math.cos(b.rot || 0) + (B.soul.y - b.y) * Math.sin(b.rot || 0));
      lineHit = perp < (b.thick || 6) / 2 + SOUL_R && along < (b.len || 400) / 2 + SOUL_R;
    }
    // rectangular hitbox (hitW/hitH) for wall-shaped bullets (BIG SHOT, teeth); else circular
    const rectHit = b.hitW && Math.abs(b.x - B.soul.x) < b.hitW / 2 + SOUL_R && Math.abs(b.y - B.soul.y) < b.hitH / 2 + SOUL_R;
    const dist = Math.hypot(b.x - B.soul.x, b.y - B.soul.y);
    if (lineHit || rectHit || (!b.hitW && b.shape !== 'line' && dist < (b.r || 6) + SOUL_R)) {
      if (B.iframes <= 0) {
        const tgtDef = (b.target != null && B.myTeam[b.target] && B.myTeam[b.target].action && B.myTeam[b.target].action.cmd === 'defend');
        const guard = B.myGuardBuff > 0 ? 0.5 : 1;   // Northernlight damage shield
        const dmg = Math.max(1, Math.round((b.dmg || 10) * ((defending || tgtDef) ? 0.5 : 1) * guard * (0.9 + Math.random() * 0.2)));
        B.dmgTaken += dmg;
        const hit = applyTargetedDamage(B.myTeam, dmg, b.target);
        B.iframes = IFRAMES; B.shake = 14; B.flash = 8;
        Snd.play('hurt');
        B.dmgPops.push({ x: B.soul.x, y: B.soul.y - 14, txt: '' + dmg, t: 0, color: '#f22' });
        if (hit) { hit.pose = 'hurt'; hit.poseT = 0; }
      }
    } else if (dist < (b.r || 6) + GRAZE_R && B.grazeCd <= 0 && b.t > 2) {
      const gain = defending ? 3 : 2;
      B.myTP = Math.min(100, B.myTP + gain); B.tpGained += gain; B.grazeCd = 10;
      Snd.play('graze', 0.35); B.grazeFx = { x: B.soul.x, y: B.soul.y, t: 8 };
    }
  }
  if (B.grazeFx && --B.grazeFx.t <= 0) B.grazeFx = null;
  for (const nb of spawned) { nb.t = nb.t || 0; if (nb.phase0 == null) nb.phase0 = Math.random() * 6.28; B.bullets.push(nb); }
  B.bullets = B.bullets.filter(b => !b.dead && b.x > -60 && b.x < 700 && b.y > -60 && b.y < 540 && (!b.life || b.t < b.life));

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
    M.sim.tick(M.soul, b => { b.t = 0; if (b.phase0 == null) b.phase0 = Math.random() * 6.28; M.bullets.push(b); });
    M.f++;
    for (const b of M.bullets) {
      b.t++;
      if (b.homing) { const d = Math.hypot(M.soul.x - b.x, M.soul.y - b.y) || 1; b.vx += (M.soul.x - b.x) / d * b.homing; b.vy += (M.soul.y - b.y) / d * b.homing; }
      b.vx += b.ax || 0; b.vy += b.ay || 0;
      if (b.maxv) { const v = Math.hypot(b.vx, b.vy); if (v > b.maxv) { b.vx *= b.maxv / v; b.vy *= b.maxv / v; } }
      b.x += b.vx; b.y += b.vy;
      if (b.orbit) { b.orbit.ang += b.orbit.w; b.x = b.orbit.cx + Math.cos(b.orbit.ang) * b.orbit.R; b.y = b.orbit.cy + Math.sin(b.orbit.ang) * b.orbit.R; }
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
        if (t && t.downed) { t.downed = false; t.hp = Math.round(t.max * (d.revive || 0.5)); t.pose = 'idle'; t.poseT = 0; Snd.play('cure'); B.dmgPops.push({ x: 96, y: teamGroundY(a.target, B.myTeam.length) - 30, txt: 'REVIVE', t: 0, color: '#2f2' }); }
      }
      if (d.snowgrave) B.usedSnowgrave = true;
    } else if (a.cmd === 'act') {
      const ad = (m.def.acts || []).find(s => s.id === a.move);
      if (ad && ad.kind === 'healAll') for (const tm of B.myTeam) if (!isOut(tm)) healMember(tm, ad.heal);
    }
  }
  if (B.usedSnowgrave) Battle.send({ t: 'snowgrave' });
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
  if (B.usedSnowgrave) for (const m of B.oppTeam) { m.hp = 0; m.downed = true; m.pose = 'downed'; }

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
  const grantMercy = (i, amt) => { const o = B.oppTeam[i]; if (o && !isOut(o)) o.mercy = Math.min(100, o.mercy + amt); };
  const doSpare = (i, tiredOnly) => {
    const o = B.oppTeam[i]; if (!o || isOut(o)) return false;
    if ((o.def.spare || {}).never) return false;
    if (tiredOnly ? isTired(o) : canSpare(o)) { o.spared = true; o.pose = 'idle'; o.poseT = 0; Battle.send({ t: 'spare', mi: i }); Snd.play('spare'); B.mercyMsg = '* ' + o.def.name + ' was SPARED!'; return true; }
    return false;
  };
  let usedProceed = false;
  for (const m of B.myTeam) {
    const a = m.action; if (!a) continue;
    if (a.cmd === 'magic') {
      const d = moveById(m.def, a.move); if (!d) continue;
      if (d.kind === 'mercy') grantMercy(a.target, d.mercy || 15);
      else if (d.kind === 'spareTired') { if (d.scope === 'all') B.oppTeam.forEach((o, i) => doSpare(i, true)); else doSpare(a.target, true); }
    } else if (a.cmd === 'act') {
      const ad = (m.def.acts || []).find(s => s.id === a.move); if (!ad) continue;
      if (ad.mercy) grantMercy(a.target, ad.mercy);
      if (ad.kind === 'buff') { if (ad.buff === 'guard') B.myGuardBuff = 3; if (ad.buff === 'power') B.myPowerBuff = 3; }
      if (ad.kind === 'proceed') usedProceed = true;
    } else if (a.cmd === 'spare') { doSpare(a.target, false) || (B.mercyMsg = '* ...it wasn\'t enough to SPARE.'); }
  }
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
  } else {
    const bg = A.bgFrame(B.anim.f);
    if (bg && bg.width) { ctx.globalAlpha = 0.55; ctx.drawImage(bg, 0, 0, 640, 480); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480); }
    B.renderChars(ctx);
  }
  B.renderBoxAndBullets(ctx);
  B.renderMirror(ctx);
  B.renderHud(ctx);
  B.renderMsg(ctx);
  if (B.phase === 'timing') B.renderTiming(ctx);
  if (B.phase === 'gameover') B.renderGameover(ctx);
  for (const p of B.dmgPops) {
    const dy = Math.max(0, 12 - p.t) * 1.2;
    drawText(ctx, 'big', p.txt, p.x, p.y - 20 - dy + (p.t > 50 ? (p.t - 50) : 0), { color: p.color, align: 'center', scale: 0.7 });
  }
  if (B.flash > 0) { ctx.fillStyle = 'rgba(255,0,0,' + (B.flash / 40) + ')'; ctx.fillRect(0, 0, 640, 480); }
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
    if (def.hue) im = A.hued(im, def.hue);
    const fl = ENEMY_FACING[def.base] ? !flip : flip;
    drawSpr(ctx, im, x, groundY - im.height / 2 * (scale || 1), { scale: scale || 1, flip: fl, alpha });
  }
  return done;
}
function teamGroundY(i, n) { return 214 + (i - (n - 1) / 2) * 58; }

Battle.renderChars = function (ctx) {
  const B = Battle;
  function drawTeam(team, x, flip) {
    const n = team.length;
    team.forEach((m, i) => {
      m.poseT++;
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
      const done = drawCharAnim(ctx, m.def, m.downed ? 'downed' : m.pose, m.poseT, x, gy, flip, alpha, sc);
      if (done && !LOOP_POSES[m.pose] && !HOLD_POSES[m.pose]) { m.pose = 'idle'; m.poseT = 0; }
      else if (done && m.pose === 'hurt' && m.poseT > 50) { m.pose = 'idle'; m.poseT = 0; }
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
// The battle box only exists during the dodge (and its spin-in / spin-out).
Battle.renderBoxAndBullets = function (ctx) {
  const B = Battle;
  const anim = B.phase === 'boxin' || B.phase === 'boxout';
  const inDodge = B.phase === 'dodge';
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
  } else drawBoxRect(ctx, cx, cy, bx.w, bx.h, 0, 1);
  // pattern-driven overlays: a second non-enterable box (face attack) + green connector arms (phones/heart)
  if (B.fx) {
    if (B.fx.arms) { ctx.strokeStyle = '#49d049'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (const a of B.fx.arms) { ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke(); } }
    if (B.fx.faceBox) { const fb = B.fx.faceBox; drawBoxRect(ctx, fb.x + fb.w / 2, fb.y + fb.h / 2, fb.w, fb.h, 0, 1); }
  }
  ctx.save();
  const wide = B.fx && (B.fx.hideBox || bx.w > 500);   // full-screen arena: no bullet clipping
  const clipL = wide ? 0 : (B.fx && B.fx.faceBox ? Math.min(bx.x, B.fx.faceBox.x) - 40 : bx.x - 40);
  const clipR = wide ? 640 : (B.fx && B.fx.faceBox ? Math.max(bx.x + bx.w, B.fx.faceBox.x + B.fx.faceBox.w) + 40 : bx.x + bx.w + 80);
  ctx.beginPath(); ctx.rect(clipL, wide ? 0 : bx.y - 40, clipR - clipL, wide ? 480 : bx.h + 80); ctx.clip();
  for (const h of B.hearts) {
    ctx.fillStyle = 'rgba(255,105,180,0.8)';
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(-0.05);
    ctx.fillRect(-4, -3, 3, 3); ctx.fillRect(1, -3, 3, 3); ctx.fillRect(-4, 0, 8, 3); ctx.fillRect(-2, 3, 4, 2);
    ctx.restore();
  }
  for (const b of B.bullets) if (b.shape !== 'line') drawBullet(ctx, b, b.x, b.y, 1);
  // red tell-lines are MASKED to the inside of the battle box (they stretch edge to edge)
  ctx.save(); ctx.beginPath(); ctx.rect(bx.x, bx.y, bx.w, bx.h); ctx.clip();
  for (const b of B.bullets) if (b.shape === 'line') drawBullet(ctx, b, b.x, b.y, 1);
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
  const blink = B.iframes > 0 && (B.anim.f % 8 < 4);
  if (!blink) {
    // the real heart sprites: the yellow "Justice" soul (2-frame pulse) or the normal red heart
    const soulImg = B.soulYellow ? A.soul(B.anim.f % 20 < 10 ? 'yheart0' : 'yheart1') : (A.soul('red0') || A.ui('soul'));
    drawSpr(ctx, soulImg, B.soul.x, B.soul.y, { scale: 1 });
  }
  if (B.grazeFx) {   // graze sparkle: spr_grazeappear_0..3 (yellow variant for the yellow soul)
    const fr = Math.min(3, Math.floor((8 - B.grazeFx.t) / 2));
    const g = A.soul((B.soulYellow ? 'ygraze' : 'graze') + fr);
    if (g) drawSpr(ctx, g, B.grazeFx.x, B.grazeFx.y, { scale: 1, alpha: 0.9 });
  }
  ctx.restore();
  if (B.soulYellow) drawText(ctx, 'main', 'YELLOW SOUL - HOLD [Z] then RELEASE to FIRE (hold longer = BIG SHOT)', bx.x + bx.w / 2, bx.y + bx.h + 8, { color: '#ee0', align: 'center' });
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
      life: b.burstLife, t: 0, phase0: 0 });
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
function tintImg(img, color) {
  const key = (img.src || img._tid || (img._tid = Math.random())) + '|' + color;
  if (imgTints[key]) return imgTints[key];
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  imgTints[key] = c; return c;
}

function drawBullet(ctx, b, px, py, s) {
  if (b.drawDX) px += b.drawDX * s;   // visual offset from the hitbox (overlaid face layers)
  if (b.drawDY) py += b.drawDY * s;
  if (b.img && b.img.width) {
    const im = b.tint ? tintImg(b.img, b.tint) : b.img;
    drawSpr(ctx, im, px, py, { scale: (b.scale || 1) * 1.6 * s, rot: b.rot || 0, flip: b.flip,
                               sx: b.sx, sy: b.sy, alpha: b.alpha });
    return;
  }
  ctx.fillStyle = b.color || '#fff';
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
  } else if (b.shape === 'note') {
    ctx.fillRect(px - 2 * s, py - 6 * s, 3 * s, 10 * s);
    ctx.beginPath(); ctx.arc(px - 3 * s, py + 4 * s, 4 * s, 0, 7); ctx.fill();
  } else if (b.shape === 'line') {   // full-length line (Knight red-slash TELL, then the cut)
    const L = (b.len || 400) * s, th = (b.thick || 4) * s;
    ctx.save(); ctx.translate(px, py); ctx.rotate(b.rot || 0);
    ctx.globalAlpha = b.armed ? 1 : (b.tellFade != null ? b.tellFade : 0.5);
    ctx.fillStyle = b.color || '#f33'; ctx.fillRect(-L / 2, -th / 2, L, th);
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
  drawText(ctx, 'main', m.def.name, px + 32, py + 10, { color: out ? '#666' : '#fff' });
  const barW = 82, barX = px + w - barW - 6, barY = py + 22;
  drawText(ctx, 'main', 'HP', barX - 22, py + 10, { color: out ? '#555' : '#c8c8c8' });
  drawText(ctx, 'main', m.spared ? 'SPARED' : (m.hp + '/' + m.max), barX, py + 4, { color: out ? '#888' : '#fff' });
  ctx.fillStyle = '#3c0d0d'; ctx.fillRect(barX, barY, barW, 6);
  ctx.fillStyle = out ? '#611' : m.def.color; ctx.fillRect(barX, barY, Math.max(0, Math.round(barW * m.hp / m.max)), 6);
  if (isDarkner(m) && !out) {
    ctx.fillStyle = '#1a0a2a'; ctx.fillRect(barX, barY + 7, barW, 3);
    ctx.fillStyle = m.dark >= 100 ? '#d060ff' : '#8a2be2'; ctx.fillRect(barX, barY + 7, Math.round(barW * m.dark / 100), 3);
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
    const px = startX + i * (pw + 8), py = PANEL_BASE - RAISE * m.raise;
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

  // bottom dialogue box + state-driven content (full-size font, no shrinking)
  const d = DBOX;
  ctx.fillStyle = '#000'; ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(d.x + 1, d.y + 1, d.w - 2, d.h - 2);
  if (B.phase === 'timing') { /* renderTiming draws the bars over this box */ }
  else if (B.targeting) Battle.renderTargetList(ctx, d);
  else if (B.submenu) Battle.renderOptionGrid(ctx, d);
  else (B.msg || []).slice(0, 3).forEach((m, i) => drawText(ctx, 'main', m, d.x + 16, d.y + 12 + i * 20, { color: '#fff' }));
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
    if (img && img.width) drawSpr(ctx, img, cx, top + img.height / 2, { scale: 1 });   // top-aligned, native size
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
    drawText(ctx, 'main', (sel ? '> ' : '  ') + m.def.name, x + 36, y, { color: sel ? '#ff0' : '#fff' });
  }
  if (pages > 1) drawText(ctx, 'main', 'PG ' + (page + 1) + '/' + pages, d.x + optW - 56, d.y + d.h - 18, { color: '#888' });
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(infoX - 10, d.y + 8); ctx.lineTo(infoX - 10, d.y + d.h - 8); ctx.stroke();
  const tm = team[B.targetList[B.targetIdx]];
  if (tm) {
    drawText(ctx, 'main', tm.def.name, infoX, d.y + 8, { color: '#fff' });
    ctx.fillStyle = '#3c0d0d'; ctx.fillRect(infoX, d.y + 30, infoW, 7);
    ctx.fillStyle = tm.def.color; ctx.fillRect(infoX, d.y + 30, Math.max(0, Math.round(infoW * tm.hp / tm.max)), 7);
    drawText(ctx, 'main', tm.hp + '/' + tm.max, infoX + infoW, d.y + 28, { color: '#bbb', align: 'right' });
    if (!ally) {
      ctx.fillStyle = '#3a3000'; ctx.fillRect(infoX, d.y + 50, infoW, 6);
      ctx.fillStyle = canSpare(tm) ? '#ffd000' : '#c8a000'; ctx.fillRect(infoX, d.y + 50, Math.round(infoW * tm.mercy / 100), 6);
      const tag = (tm.def.spare || {}).never ? 'CANT SPARE' : canSpare(tm) ? 'SPARE READY!' : isTired(tm) ? 'TIRED' : 'MERCY ' + tm.mercy + '%';
      drawText(ctx, 'main', tag, infoX, d.y + d.h - 16, { color: canSpare(tm) ? '#ff0' : '#aa8' });
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
