// Battle: team-based turn loop (party size 1-3). A size-1 team == classic 1v1.
// Phases: select -> waitopp -> reveal -> timing -> waittier -> dodge
//         -> waitresult -> resolve -> (select | gameover)

const BOX = { x: 208, y: 128, w: 224, h: 176 };   // dodge box (game px)
const SOUL_R = 5;
const GRAZE_R = 15;
const SELECT_FRAMES = 24 * 60;
const IFRAMES = 55;
const TIER_TP = [4, 10, 18];   // accuracy -> TP

const Battle = {};

// ---------- team helpers ----------
function mkMember(sel) {
  const def = charDef(sel);
  return { sel, def, hp: def.hp, max: def.hp, downed: false,
           action: null, tier: null, pose: 'idle', poseT: 0 };
}
function living(team) { return team.filter(m => !m.downed); }
function teamDead(team) { return team.every(m => m.downed); }
function frontLiving(team) { for (const m of team) if (!m.downed) return m; return null; }
function moveDefOf(def, a) {
  if (!a) return null;
  if (a.cmd === 'fight') return def.fight;
  if (a.cmd === 'magic') return a.move === def.ult.id ? def.ult : def.spells.find(s => s.id === a.move);
  return null;
}
function isAttack(def) { return !!(def && def.dmg && (def.custom || PATTERNS[def.id])); }

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
  } else if (m.t === 'rematch') B.rematchOpp = true;
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
    case 'dodge': B.updDodge(); break;
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
  B.itemsUsed = [];
  B.phase = 'select';
  B.say('* ' + B.curMember().def.name + ', your move.');
};
Battle.curMember = function () { return Battle.myTeam[Battle.cmdOrder[Battle.cmdPos]]; };

Battle.updSelect = function () {
  const B = Battle;
  const scale = (B.fxOnMe && B.fxOnMe.timerScale) || 1;
  B.timer -= 1 / scale;
  if (B.timer <= 0) { while (B.cmdPos < B.cmdOrder.length) B.choose('defend', null); return; }

  if (!B.submenu) {
    if (Input.hit.left) { B.menuIdx = (B.menuIdx + MENU.length - 1) % MENU.length; Snd.play('menumove'); }
    if (Input.hit.right) { B.menuIdx = (B.menuIdx + 1) % MENU.length; Snd.play('menumove'); }
    if (Input.hit.cancel && B.cmdPos > 0) { B.undoLast(); Snd.play('menumove'); }
    if (Input.hit.ok) {
      const cmd = MENU[B.menuIdx];
      Snd.play('select');
      if (cmd === 'fight' || cmd === 'defend') B.choose(cmd, null);
      else { B.submenu = cmd; B.subIdx = 0; }
    }
  } else {
    const opts = B.subOptions();
    if (Input.hit.up) { B.subIdx = (B.subIdx + opts.length - 1) % opts.length; Snd.play('menumove'); }
    if (Input.hit.down) { B.subIdx = (B.subIdx + 1) % opts.length; Snd.play('menumove'); }
    if (Input.hit.cancel) { B.submenu = null; Snd.play('menumove'); }
    if (Input.hit.ok && opts.length) {
      const o = opts[B.subIdx];
      if (o.disabled) Snd.play('cantselect');
      else { Snd.play('select'); B.choose(B.submenu, o.id); }
    }
  }
};

Battle.tpAvail = function () { return Battle.myTP - Battle.tpSpent; };

Battle.subOptions = function () {
  const B = Battle, c = B.curMember().def;
  if (B.submenu === 'magic') {
    const list = c.spells.map(s => ({ id: s.id, label: s.name, cost: s.tp + '%', disabled: B.tpAvail() < s.tp }));
    list.push({ id: c.ult.id, label: c.ult.name, cost: c.ult.tp + '%', disabled: B.tpAvail() < c.ult.tp, ult: true });
    return list;
  }
  if (B.submenu === 'act') return [{ id: c.act.id, label: c.act.name, cost: 'FREE' }];
  if (B.submenu === 'item') {
    const bag = B.myItems.filter((_, i) => !B.itemsUsed.includes(i));
    if (!bag.length) return [{ id: null, label: '(empty)', disabled: true }];
    return B.myItems.map((it, i) => ({ id: i, label: ITEMS[it].name,
                                       disabled: B.itemsUsed.includes(i) }));
  }
  return [];
};

Battle.choose = function (cmd, move) {
  const B = Battle, mem = B.curMember(), c = mem.def;
  const act = { mi: B.cmdOrder[B.cmdPos], cmd, move, seed: randSeed() };
  // tentative resource reservation (shared TP / shared bag)
  if (cmd === 'magic') {
    const d = move === c.ult.id ? c.ult : c.spells.find(s => s.id === move);
    if (d) B.tpSpent += d.tp;
  } else if (cmd === 'item') {
    B.itemsUsed.push(move); act.itemId = B.myItems[move];
  }
  mem.action = act;
  B.submenu = null;
  B.cmdPos++;
  if (B.cmdPos < B.cmdOrder.length) { B.menuIdx = 0; B.say('* ' + B.curMember().def.name + ', your move.'); return; }
  // all members chose -> send
  const acts = B.cmdOrder.map(i => B.myTeam[i].action);
  Battle.send({ t: 'actions', acts });
  B.phase = 'waitopp';
  B.say('* Waiting for the enemy team...');
};

Battle.undoLast = function () {
  const B = Battle;
  B.cmdPos--;
  const mem = B.curMember(), a = mem.action, c = mem.def;
  if (a) {
    if (a.cmd === 'magic') { const d = a.move === c.ult.id ? c.ult : c.spells.find(s => s.id === a.move); if (d) B.tpSpent -= d.tp; }
    if (a.cmd === 'item') { const k = B.itemsUsed.indexOf(a.move); if (k >= 0) B.itemsUsed.splice(k, 1); }
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
  if (a.cmd === 'magic') { const d = a.move === c.ult.id ? c.ult : c.spells.find(s => s.id === a.move); return d ? d.text : c.name + ' casts magic!'; }
  if (a.cmd === 'act') return c.act.text;
  if (a.cmd === 'item') return c.name + ' uses ' + (a.itemId ? ITEMS[a.itemId].name.toUpperCase() : 'an item') + '!';
  if (a.cmd === 'defend') return c.name + ' braces for impact!';
  return c.name + ' hesitates!';
}

// ---------- timing (sequential, one bar per attacking member) ----------
Battle.startTiming = function () {
  const B = Battle;
  B.timeQueue = B.myTeam.map((m, i) => i).filter(i => {
    const m = B.myTeam[i]; return m.action && isAttack(moveDefOf(m.def, m.action));
  });
  B.timeI = 0;
  B.nextTimingBar();
};
Battle.nextTimingBar = function () {
  const B = Battle;
  if (B.timeI >= B.timeQueue.length) {
    // done: send tiers
    const tiers = B.myTeam.map((m, i) => (m.action && isAttack(moveDefOf(m.def, m.action))) ? { mi: i, tier: m.tier } : null).filter(Boolean);
    Battle.send({ t: 'tiers', tiers });
    B.sendDodgeStart();
    B.phase = 'waittier';
    B.say('* Bracing...');
    return;
  }
  B.timingBar = { x: 416, done: false, t: 0 };
  B.phase = 'timing';
  B.say('* ' + B.myTeam[B.timeQueue[B.timeI]].def.name + ': press [Z] on the target!');
};
Battle.updTiming = function () {
  const B = Battle, tb = B.timingBar;
  tb.t++; tb.x -= 3.4;
  if (tb.x <= -10) { B.finishTiming(0); return; }
  if (Input.hit.ok) { const d = Math.abs(tb.x - 26); B.finishTiming(d < 4 ? 2 : d < 30 ? 1 : 0); }
};
Battle.finishTiming = function (tier) {
  const B = Battle, mem = B.myTeam[B.timeQueue[B.timeI]];
  mem.tier = tier;
  Snd.play(tier === 2 ? 'criticalswing' : tier === 1 ? 'bell' : 'smallswing');
  const gain = TIER_TP[tier];
  B.myTP = Math.min(100, B.myTP + gain);
  if (gain) B.dmgPops.push({ x: 46, y: 250, txt: '+' + gain, t: 0, color: '#ff8000' });
  B.timeI++;
  B.nextTimingBar();
};

// gather attackers (member+move+tier+seed) for a team's actions
function attackersOf(team, pacifyCap) {
  const out = [];
  for (const m of team) {
    if (!m.action) continue;
    const md = moveDefOf(m.def, m.action);
    if (isAttack(md)) {
      let tier = m.tier == null ? 1 : m.tier;
      if (pacifyCap) tier = 0;
      out.push({ def: m.def, moveDef: md, tier, seed: m.action.seed, member: m });
    }
  }
  return out;
}

Battle.sendDodgeStart = function () {
  const B = Battle;
  const atkers = attackersOf(B.myTeam, B.myPacified);
  const atks = atkers.map(a => ({
    base: a.def.base, moveId: a.moveDef.id, custom: a.moveDef.custom || null,
    tier: a.tier, seed: a.seed,
    dur: a.moveDef.dur || (PATTERNS[a.moveDef.id] || {}).dur || 480,
    perHit: Math.round(a.moveDef.dmg * TIER_MULT[a.tier]),
  }));
  Battle.send({ t: 'dodgeStart', atks });
};

// ---------- dodge (combined) ----------
Battle.startDodge = function () {
  const B = Battle;
  // instant self-actions: DEFEND (+TP) and ITEM (heal the user) before dodging
  for (const m of B.myTeam) {
    const a = m.action; if (!a) continue;
    if (a.cmd === 'defend') B.myTP = Math.min(100, B.myTP + 16);
    if (a.cmd === 'item') {
      const it = ITEMS[a.itemId];
      if (it) {
        m.hp = Math.min(m.max, m.hp + (it.heal || 0));
        B.myTP = Math.min(100, B.myTP + (it.tp || 0));
        Snd.play('cure');
        B.dmgPops.push({ x: 110, y: 250, txt: '+' + it.heal, t: 0, color: '#2f2' });
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

  B.phase = 'dodge';
  if (!B.sim) { B.say('* Guard up...'); B.endDodge(); }
};

function applyTeamDamage(team, dmg) {
  let d = dmg, hitMember = null;
  while (d > 0) {
    const m = frontLiving(team); if (!m) break;
    if (!hitMember) hitMember = m;
    const take = Math.min(m.hp, d);
    m.hp -= take; d -= take;
    if (m.hp <= 0) { m.downed = true; m.pose = 'downed'; m.poseT = 0; } else break;
  }
  return hitMember;
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

  B.sim.tick(B.soul, b => { b.t = 0; b.phase0 = Math.random() * 6.28; B.bullets.push(b); });
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
    if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
    if (b.spin) b.rot = (b.rot || 0) + b.spin;
    const dist = Math.hypot(b.x - B.soul.x, b.y - B.soul.y);
    if (dist < (b.r || 6) + SOUL_R) {
      if (B.iframes <= 0) {
        const dmg = Math.round((b.dmg || 10) * (defending ? 0.5 : 1) * (0.9 + Math.random() * 0.2));
        B.dmgTaken += dmg;
        const hit = applyTeamDamage(B.myTeam, dmg);
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
  B.bullets = B.bullets.filter(b => b.x > -60 && b.x < 700 && b.y > -60 && b.y < 540 && (!b.life || b.t < b.life));

  if (B.anim.f % 4 === 0)
    Battle.send({ t: 'soul', x: (B.soul.x - bx.x) / bx.w, y: (B.soul.y - bx.y) / bx.h, f: B.sim ? B.sim.f : 0, done: false });

  if (--B.dodgeT <= 0 || teamDead(B.myTeam)) B.endDodge();
};

Battle.tickMirror = function () {
  const B = Battle, M = B.mirror;
  if (!M || !B.oppDodging) return;
  M.target = Math.max(M.target, M.f + 1);
  let steps = Math.min(3, M.target - M.f, M.sim.dur - M.f);
  if (B.oppSoul) { M.soul.x = B.oppSoul.x * M.box.w; M.soul.y = B.oppSoul.y * M.box.h; }
  while (steps-- > 0) {
    M.sim.tick(M.soul, b => { b.t = 0; b.phase0 = Math.random() * 6.28; M.bullets.push(b); });
    M.f++;
    for (const b of M.bullets) {
      b.t++;
      if (b.homing) { const d = Math.hypot(M.soul.x - b.x, M.soul.y - b.y) || 1; b.vx += (M.soul.x - b.x) / d * b.homing; b.vy += (M.soul.y - b.y) / d * b.homing; }
      b.vx += b.ax || 0; b.vy += b.ay || 0;
      if (b.maxv) { const v = Math.hypot(b.vx, b.vy); if (v > b.maxv) { b.vx *= b.maxv / v; b.vy *= b.maxv / v; } }
      b.x += b.vx; b.y += b.vy;
      if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
      if (b.spin) b.rot = (b.rot || 0) + b.spin;
    }
    M.bullets = M.bullets.filter(b => b.x > -80 && b.x < M.box.w + 80 && b.y > -80 && b.y < M.box.h + 80 && (!b.life || b.t < b.life));
  }
};

Battle.endDodge = function () {
  const B = Battle;
  B.bullets = []; B.sim = null;
  Battle.send({ t: 'soul', x: 0.5, y: 0.5, done: true });
  // spell heal/status effects resolve after dodging
  for (const m of B.myTeam) {
    const a = m.action; if (!a || a.cmd !== 'magic') continue;
    const d = moveDefOf(m.def, a) || (a.move === m.def.ult.id ? m.def.ult : m.def.spells.find(s => s.id === a.move));
    if (!d) continue;
    if (d.kind === 'heal' || d.heal) {
      m.hp = Math.min(m.max, m.hp + (d.heal || 0));
      if (d.heal) { Snd.play('cure'); B.dmgPops.push({ x: 110, y: 250, txt: '+' + d.heal, t: 0, color: '#2f2' }); }
    }
    if (d.kind === 'status') { Snd.play(d.status === 'pacified' ? 'pacify' : 'spellcast'); if (d.status === 'pacified') B.pacifyOppNext = true; B.statusOnOpp = d.status; }
  }
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

  // queue sabotage for next turn (from opp acts / status spells)
  B.fxOnMeQueued = null;
  const oppActMem = B.oppTeam.find(m => m.action && m.action.cmd === 'act');
  if (oppActMem) B.fxOnMeQueued = { ...ACT_FX[oppActMem.def.act.id] };
  B.myPacifiedNext = false;
  for (const m of B.oppTeam) {
    const a = m.action; if (!a || a.cmd !== 'magic') continue;
    const d = moveDefOf(m.def, a) || (a.move === m.def.ult.id ? m.def.ult : m.def.spells.find(s => s.id === a.move));
    if (d && d.kind === 'status') { B.fxOnMeQueued = { ...ACT_FX[d.status] }; if (d.status === 'pacified') B.myPacifiedNext = true; }
  }
  B.pacifyOpp = !!B.pacifyOppNext; B.pacifyOppNext = false;

  const lines = [];
  if (r.dmgTaken > 0) lines.push('* Enemy team took ' + r.dmgTaken + ' damage!');
  if (B.dmgTaken > 0) lines.push('* Your team took ' + B.dmgTaken + ' damage!');
  if (!lines.length) lines.push('* The tension rises...');
  B.say(lines);

  const myDead = teamDead(B.myTeam), oppDead = teamDead(B.oppTeam);
  if (myDead || oppDead) {
    B.result = myDead ? (oppDead ? 'draw' : 'lose') : 'win';
    B.phase = 'gameover';
    for (const m of B.myTeam) if (!m.downed) { m.pose = B.result === 'win' ? 'victory' : 'idle'; m.poseT = 0; }
    for (const m of B.oppTeam) if (!m.downed) { m.pose = B.result === 'lose' ? 'victory' : 'idle'; m.poseT = 0; }
    if (B.result === 'win') { Snd.stopMusic(); Snd.play('won'); }
    else if (B.result === 'lose') Snd.playMusic('game_over');
    else Snd.stopMusic();
    return;
  }
  B.resolveT = 110; B.phase = 'resolve';
};

Battle.nextTurn = function () {
  const B = Battle;
  B.turn++;
  B.fxOnMe = B.fxOnMeQueued; B.fxOnMeQueued = null;
  B.myPacified = B.myPacifiedNext; B.myPacifiedNext = false;
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
function teamGroundY(i, n) { return 250 + (i - (n - 1) / 2) * 62; }

Battle.renderChars = function (ctx) {
  const B = Battle;
  function drawTeam(team, x, flip) {
    const n = team.length;
    team.forEach((m, i) => {
      m.poseT++;
      const hurtFlash = m.pose === 'hurt' && (m.poseT % 8 < 4);
      const alpha = m.downed ? 0.35 : (hurtFlash ? 0.4 : 1);
      const sc = n >= 3 ? 0.85 : 1;
      const done = drawCharAnim(ctx, m.def, m.downed ? 'downed' : m.pose, m.poseT, x, teamGroundY(i, n), flip, alpha, sc);
      if (done && !LOOP_POSES[m.pose] && !HOLD_POSES[m.pose]) { m.pose = 'idle'; m.poseT = 0; }
      else if (done && m.pose === 'hurt' && m.poseT > 50) { m.pose = 'idle'; m.poseT = 0; }
    });
  }
  drawTeam(B.myTeam, 96, false);
  drawTeam(B.oppTeam, 544, true);
};

Battle.renderBoxAndBullets = function (ctx) {
  const B = Battle;
  const inDodge = B.phase === 'dodge';
  const bx = inDodge ? B.dodgeBox : BOX;
  ctx.fillStyle = '#000'; ctx.fillRect(bx.x, bx.y, bx.w, bx.h);
  ctx.strokeStyle = '#00c000'; ctx.lineWidth = 3;
  ctx.strokeRect(bx.x - 1.5, bx.y - 1.5, bx.w + 3, bx.h + 3);
  if (!inDodge) return;
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

// compact team HUD entry
function drawEntry(ctx, x, y, m, active) {
  const def = m.def, hp = m.hp, max = m.max;
  let head = A.ui('head_' + def.base + (m.downed ? '_gray' : ''));
  if (!m.downed && def.hue) head = A.hued(head, def.hue);
  drawSpr(ctx, head, x + 11, y + 11, { scale: 0.8 });
  drawText(ctx, 'main', def.name, x + 26, y + 1, { color: m.downed ? '#666' : '#fff' });
  ctx.fillStyle = '#3c0d0d'; ctx.fillRect(x + 26, y + 16, 92, 6);
  ctx.fillStyle = m.downed ? '#611' : def.color;
  ctx.fillRect(x + 26, y + 16, Math.max(0, Math.round(92 * hp / max)), 6);
  drawText(ctx, 'main', hp + '/' + max, x + 124, y + 1, { color: m.downed ? '#666' : '#bbb' });
  if (active) { ctx.strokeStyle = def.color; ctx.lineWidth = 1; ctx.strokeRect(x - 2, y - 2, 190, 26); }
}

Battle.renderHud = function (ctx) {
  const B = Battle;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 384, 640, 96);
  ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 384.5); ctx.lineTo(640, 384.5); ctx.stroke();

  const activeMi = B.phase === 'select' ? B.cmdOrder[B.cmdPos]
                 : B.phase === 'timing' ? B.timeQueue[B.timeI] : -1;
  B.myTeam.forEach((m, i) => drawEntry(ctx, 66, 390 + i * 28, m, i === activeMi));
  B.oppTeam.forEach((m, i) => drawEntry(ctx, 386, 390 + i * 28, m, false));

  // shared TP bar (left)
  ctx.fillStyle = '#3f0000'; ctx.fillRect(38, 70, 16, 170);
  const tpH = Math.round(170 * B.myTP / 100);
  ctx.fillStyle = '#ff8000'; ctx.fillRect(38, 70 + 170 - tpH, 16, tpH);
  if (tpH > 0 && tpH < 170) { ctx.fillStyle = '#fff'; ctx.fillRect(38, 70 + 170 - tpH, 16, 3); }
  drawText(ctx, 'main', 'TP', 40, 54, { color: '#ff8000', align: 'center' });
  drawText(ctx, 'main', '' + B.myTP, 46, 244, { color: '#ff8000', align: 'center' });

  if (B.phase === 'select') {
    // command buttons above the panel (over the empty board), labelled by member
    const names = ['fight', 'magic', 'act', 'item', 'defend'];
    for (let i = 0; i < names.length; i++) {
      const sel = !B.submenu && B.menuIdx === i;
      drawSpr(ctx, A.ui('btn_' + names[i] + (sel ? '_sel' : '')), 236 + i * 34, 352, { scale: 1.0 });
    }
    drawText(ctx, 'main', B.curMember().def.name, 320, 322, { color: B.curMember().def.color, align: 'center' });
    const secs = Math.ceil(B.timer / 60);
    drawText(ctx, 'big', '' + secs, 320, 18, { color: secs <= 5 ? '#f44' : '#fff', align: 'center', scale: 0.5 });
  }
  drawText(ctx, 'main', 'TURN ' + B.turn, 30, 18, { color: '#666' });

  if (B.submenu) {
    const opts = B.subOptions();
    const px = 200, py = 140, pw = 240, ph = 40 + opts.length * 26;
    ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);
    drawText(ctx, 'main', B.curMember().def.name + ' ' + B.submenu.toUpperCase(), px + pw / 2, py + 8, { color: '#ff8000', align: 'center' });
    opts.forEach((o, i) => {
      const sel = i === B.subIdx;
      const col = o.disabled ? '#555' : o.ult ? '#f4a' : sel ? '#ff0' : '#fff';
      drawText(ctx, 'main', (sel ? '> ' : '  ') + o.label, px + 14, py + 32 + i * 26, { color: col });
      if (o.cost) drawText(ctx, 'main', o.cost, px + pw - 14, py + 32 + i * 26, { color: col, align: 'right' });
    });
  }
};

Battle.renderMsg = function (ctx) {
  const B = Battle;
  if (!B.msg.length || B.phase === 'timing' || B.phase === 'select') return;
  B.msg.forEach((m, i) => drawText(ctx, 'main', m, 40, 300 + i * 22, { color: '#fff' }));
};

Battle.renderTiming = function (ctx) {
  const B = Battle, tb = B.timingBar;
  const mem = B.myTeam[B.timeQueue[B.timeI]], def = mem.def;
  const x = 150, y = 348, w = 416, h = 28;
  drawSpr(ctx, A.hued(A.ui('head_' + def.base), def.hue), 60, y + h / 2, { scale: 1 });
  drawText(ctx, 'main', 'PRESS', 80, y + 6, { color: '#fff' });
  ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = def.color; ctx.globalAlpha = 0.85; ctx.fillRect(x + 8, y + 2, 36, h - 4); ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.fillRect(x + 25, y + 2, 2, h - 4);
  if (!tb.done) { ctx.fillStyle = '#fff'; ctx.fillRect(x + Math.max(0, tb.x) - 2, y - 5, 4, h + 10); }
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
