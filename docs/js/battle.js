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
  jevil_spade: 'swing', jevil_diamond: 'spellcast', jevil_carousel: 'spellcast', jevil_ult: 'ultraswing',
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
  if (isDarkner(mem)) return ['fight', 'magic', 'charge', 'item', 'defend'];
  if (mem && mem.def && mem.def.base === 'kris') return ['fight', 'act', 'item', 'spare', 'defend'];
  return ['fight', 'magic', 'item', 'spare', 'defend'];
}
function spellCost(mem, d) { return isDarkner(mem) ? Math.ceil(d.tp * 0.6) : d.tp; }
Battle.startSelect = function (fresh) {
  const B = Battle;
  B.cmdOrder = B.myTeam.map((m, i) => i).filter(i => !B.myTeam[i].downed);
  B.cmdPos = 0;
  for (const m of B.myTeam) { m.action = null; m.tier = null; m.pose = 'idle'; m.poseT = 0; }
  for (const m of B.oppTeam) { m.pose = 'idle'; m.poseT = 0; }
  B.menuIdx = 0; B.submenu = null; B.subIdx = 0;
  B.timer = SELECT_FRAMES;
  B.oppActs = null; B.oppTiers = null; B.oppResult = null; B.oppDodgeStart = null;
  B.tpSpent = 0;   // TP tentatively spent by chosen spells this turn
  B.tpSel = 0;     // TP tentatively GAINED (DEFEND) this turn, shown live
  B.itemsUsed = [];
  B.targeting = false; B.pendingCmd = null;
  B.phase = 'select';
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
      cand = B.myTeam.map((m, i) => i).filter(i => revive ? B.myTeam[i].downed : !isOut(B.myTeam[i]));
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
        const tgt = (a.tside === 'ally' && B.myTeam[a.target] && !B.myTeam[a.target].downed) ? B.myTeam[a.target] : m;
        tgt.hp = Math.min(tgt.max, tgt.hp + (it.heal || 0));
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
  if (oppAtkers.length) {
    B.sim = makeCombinedSim(oppAtkers, B.dodgeBox);
    B.dodgeT = B.sim.dur;
    Snd.play(sfxFor(oppAtkers[0].moveDef));
    B.say('* DODGE!');
  } else { B.sim = null; B.dodgeT = 0; }

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

// targeted damage: a bullet damages the enemy member its attacker aimed at;
// if that member is already down, it flows to the front living member.
function applyTargetedDamage(team, dmg, target) {
  let m = (target != null && team[target] && !team[target].downed) ? team[target] : frontLiving(team);
  if (!m) return null;
  const first = m;
  let d = dmg;
  while (d > 0 && m) {
    const take = Math.min(m.hp, d);
    m.hp -= take; d -= take;
    if (m.hp <= 0) { m.downed = true; m.pose = 'downed'; m.poseT = 0; m = frontLiving(team); } else break;
  }
  return first;
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
  const bx = B.dodgeBox;
  B.soul.x = Math.max(bx.x + 4, Math.min(bx.x + bx.w - 4, B.soul.x));
  B.soul.y = Math.max(bx.y + 4, Math.min(bx.y + bx.h - 4, B.soul.y));
  for (const h of B.hearts) { h.x += h.vx; h.y += h.vy; if (h.x < bx.x || h.x > bx.x + bx.w) h.vx *= -1; if (h.y < bx.y || h.y > bx.y + bx.h) h.vy *= -1; }

  B.sim.tick(B.soul, b => { b.t = 0; if (b.phase0 == null) b.phase0 = Math.random() * 6.28; B.bullets.push(b); });
  if (B.iframes > 0) B.iframes--;
  if (B.grazeCd > 0) B.grazeCd--;
  const front = frontLiving(B.myTeam);
  const defending = front && front.action && front.action.cmd === 'defend';
  for (const b of B.bullets) {
    b.t++;
    if (b.homing) { const d = Math.hypot(B.soul.x - b.x, B.soul.y - b.y) || 1; b.vx += (B.soul.x - b.x) / d * b.homing; b.vy += (B.soul.y - b.y) / d * b.homing; }
    b.vx += b.ax || 0; b.vy += b.ay || 0;
    if (b.maxv) { const v = Math.hypot(b.vx, b.vy); if (v > b.maxv) { b.vx *= b.maxv / v; b.vy *= b.maxv / v; } }
    b.x += b.vx; b.y += b.vy;
    if (b.orbit) { b.orbit.ang += b.orbit.w; b.x = b.orbit.cx + Math.cos(b.orbit.ang) * b.orbit.R; b.y = b.orbit.cy + Math.sin(b.orbit.ang) * b.orbit.R; }
    if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
    if (b.spin) b.rot = (b.rot || 0) + b.spin;
    if (b.burst && b.t >= b.burst) {
      b.dead = true;
      const n = b.burstN || 8, bsp = b.burstSpeed || 2.2;
      for (let i = 0; i < n; i++) {
        const ang = i / n * 6.28 + (b.burstRot || 0);
        B.bullets.push({ img: b.img, scale: (b.scale || 1) * 0.55, r: Math.max(4, (b.r || 8) * 0.55),
          dmg: b.dmg, target: b.target, x: b.x, y: b.y,
          vx: Math.cos(ang) * bsp, vy: Math.sin(ang) * bsp, spin: 0.2, t: 0, phase0: 0 });
      }
      continue;
    }
    const dist = Math.hypot(b.x - B.soul.x, b.y - B.soul.y);
    if (dist < (b.r || 6) + SOUL_R) {
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
      if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
      if (b.spin) b.rot = (b.rot || 0) + b.spin;
      if (b.burst && b.t >= b.burst) {
        b.dead = true;
        const n = b.burstN || 8, bsp = b.burstSpeed || 2.2;
        for (let i = 0; i < n; i++) {
          const ang = i / n * 6.28 + (b.burstRot || 0);
          M.bullets.push({ img: b.img, scale: (b.scale || 1) * 0.55, r: Math.max(4, (b.r || 8) * 0.55),
            x: b.x, y: b.y, vx: Math.cos(ang) * bsp, vy: Math.sin(ang) * bsp, spin: 0.2, t: 0, phase0: 0 });
        }
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
    tgt.hp = Math.min(tgt.max, tgt.hp + amt); Snd.play('cure');
    B.dmgPops.push({ x: 96, y: teamGroundY(B.myTeam.indexOf(tgt), B.myTeam.length) - 30, txt: '+' + amt, t: 0, color: '#2f2' });
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
  const bg = A.bgFrame(B.anim.f);
  if (bg && bg.width) { ctx.globalAlpha = 0.55; ctx.drawImage(bg, 0, 0, 640, 480); ctx.globalAlpha = 1; }
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480); }
  B.renderChars(ctx);
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
      const sc = n >= 3 ? 1.3 : 1.7;   // ripped sprites read small; scale them up
      const done = drawCharAnim(ctx, m.def, m.downed ? 'downed' : m.pose, m.poseT, x, teamGroundY(i, n), flip, alpha, sc);
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
    for (const g of (B.boxGhosts || [])) drawBoxRect(ctx, cx, cy, bx.w * g.s, bx.w * g.s, g.rot, g.alpha);
    const s = B.boxScaleCur || 0;
    drawBoxRect(ctx, cx, cy, bx.w * s, bx.w * s, B.boxRotCur || 0, 1);
    return;
  }
  drawBoxRect(ctx, cx, cy, bx.w, bx.h, 0, 1);
  ctx.save();
  ctx.beginPath(); ctx.rect(bx.x - 40, bx.y - 40, bx.w + 80, bx.h + 80); ctx.clip();
  for (const h of B.hearts) {
    ctx.fillStyle = 'rgba(255,105,180,0.8)';
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(-0.05);
    ctx.fillRect(-4, -3, 3, 3); ctx.fillRect(1, -3, 3, 3); ctx.fillRect(-4, 0, 8, 3); ctx.fillRect(-2, 3, 4, 2);
    ctx.restore();
  }
  for (const b of B.bullets) drawBullet(ctx, b, b.x, b.y, 1);
  const blink = B.iframes > 0 && (B.anim.f % 8 < 4);
  if (!blink) drawSpr(ctx, A.ui('soul'), B.soul.x, B.soul.y, { scale: 1 });
  if (B.grazeFx) { ctx.strokeStyle = 'rgba(255,255,150,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(B.grazeFx.x, B.grazeFx.y, 14 - B.grazeFx.t, 0, 7); ctx.stroke(); }
  ctx.restore();
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

function drawBullet(ctx, b, px, py, s) {
  if (b.img && b.img.width) { drawSpr(ctx, b.img, px, py, { scale: (b.scale || 1) * 1.6 * s, rot: b.rot || 0, flip: b.flip }); return; }
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
  drawSpr(ctx, tintedSoul(od.color), mx + M.soul.x * s, my + M.soul.y * s, { scale: 0.75 });
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
