// Battle: the full turn loop for one networked 1v1 fight.
// Phases: select -> waitopp -> reveal -> timing -> waittier -> dodge
//         -> waitresult -> resolve -> (select | gameover)

const BOX = { x: 208, y: 128, w: 224, h: 176 };   // dodge box (game px)
const SOUL_R = 5;
const GRAZE_R = 15;
const SELECT_FRAMES = 20 * 60;
const IFRAMES = 55;

const Battle = {};

Battle.init = function (opts) {
  const B = Battle;
  B.matchN = opts.matchN || 1;
  B.myChar = opts.myChar; B.oppChar = opts.oppChar;
  B.myName = CHARS[B.myChar].name; B.oppName = CHARS[B.oppChar].name;
  B.me = { hp: CHARS[B.myChar].hp, max: CHARS[B.myChar].hp, tp: 0,
           items: opts.myItems.slice() };
  B.opp = { hp: CHARS[B.oppChar].hp, max: CHARS[B.oppChar].hp, tp: 0,
            items: opts.oppItems.slice() };
  B.phase = 'select';
  B.turn = 1;
  B.menuIdx = 0; B.subIdx = 0; B.submenu = null;
  B.timer = SELECT_FRAMES;
  B.myAction = null; B.oppAction = null;
  B.myTier = null; B.oppTier = null;
  B.myResult = null; B.oppResult = null;
  B.fxOnMe = null;      // status effects active for my current dodge
  B.fxOnMeNext = null;  // queued by opp acts this turn
  B.fxOnOppNext = null; // queued by my acts (pacify cap handling)
  B.pacifyOpp = false; B.pacifiedMe = false;
  B.msg = []; B.msgT = 0;
  B.soul = { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 };
  B.bullets = []; B.sim = null;
  B.iframes = 0; B.grazeCd = 0; B.shake = 0; B.flash = 0;
  B.dmgTaken = 0; B.tpGained = 0;
  B.dmgPops = [];   // {x,y,txt,t,color}
  B.oppSoul = null; B.oppDodging = false;
  B.timingBar = null;
  B.anim = { myPose: 'idle', oppPose: 'idle', myT: 0, oppT: 0, f: 0 };
  B.result = null;  // 'win' | 'lose'
  B.rematchMe = false; B.rematchOpp = false;
  B.turnSeed = randSeed();
  B.fxOnMeQueued = null;
  B.mirror = null;              // local re-sim of MY attack for spectator box
  B.myPacified = false; B.myPacifiedNext = false;
  Net.handlers = Net.handlers.filter(h => h !== Battle.onMsg);
  Net.on(Battle.onMsg);
  Snd.playMusic(Snd.THEME[B.oppChar]);
};

// send a battle message tagged with the current match number
Battle.send = function (m) { m.n = Battle.matchN; Net.send(m); };

Battle.onMsg = function (m) {
  const B = Battle;
  if (m.t === 'startMatch') {
    // host started the next match; joiner follows
    if (!Net.isHost && m.n !== B.matchN)
      Battle.init({ myChar: B.myChar, oppChar: B.oppChar,
                    myItems: G.myItems, oppItems: G.oppItems, matchN: m.n });
    return;
  }
  if (m.n != null && m.n !== B.matchN) return;   // stale cross-match message
  if (m.t === 'action') { B.oppAction = m; }
  else if (m.t === 'tier') { B.oppTier = m.tier; }
  else if (m.t === 'result') { B.oppResult = m; }
  else if (m.t === 'soul') {
    B.oppSoul = m; B.oppDodging = !m.done;
    if (m.done) B.mirror = null;
    else if (B.mirror) B.mirror.target = Math.max(B.mirror.target, m.f || 0);
  }
  else if (m.t === 'rematch') { B.rematchOpp = true; }
};

// ---------- helpers ----------
function myMoveDef() {
  const B = Battle, c = CHARS[B.myChar], a = B.myAction;
  if (!a) return null;
  if (a.cmd === 'fight') return c.fight;
  if (a.cmd === 'magic') {
    if (a.move === c.ult.id) return c.ult;
    return c.spells.find(s => s.id === a.move);
  }
  return null;
}
function oppMoveDef() {
  const B = Battle, c = CHARS[B.oppChar], a = B.oppAction;
  if (!a) return null;
  if (a.cmd === 'fight') return c.fight;
  if (a.cmd === 'magic') {
    if (a.move === c.ult.id) return c.ult;
    return c.spells.find(s => s.id === a.move);
  }
  return null;
}
function isAttack(def) { return def && def.id && PATTERNS[def.id] && def.dmg; }

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
    case 'waitopp':
      if (B.oppAction) B.startReveal();
      break;
    case 'reveal':
      if (--B.revealT <= 0) B.startTiming();
      break;
    case 'timing': B.updTiming(); break;
    case 'waittier':
      if (B.oppTier != null) B.startDodge();
      break;
    case 'dodge': B.updDodge(); break;
    case 'waitresult':
      if (B.oppResult) B.resolve();
      break;
    case 'resolve':
      if (--B.resolveT <= 0) B.nextTurn();
      break;
    case 'gameover':
      if (Input.hit.ok && !B.rematchMe) {
        B.rematchMe = true;
        Battle.send({ t: 'rematch' });
      }
      if (B.rematchMe && B.rematchOpp && Net.isHost) {
        // host authority: announce the new match, then start it
        const n = B.matchN + 1;
        Net.send({ t: 'startMatch', n });
        Battle.init({ myChar: B.myChar, oppChar: B.oppChar,
                      myItems: G.myItems, oppItems: G.oppItems, matchN: n });
      }
      break;
  }
};

// ---------- select phase ----------
const MENU = ['fight', 'magic', 'act', 'item', 'defend'];
Battle.updSelect = function () {
  const B = Battle;
  const scale = (B.fxOnMe && B.fxOnMe.timerScale) || 1;
  B.timer -= 1 / scale;
  if (B.timer <= 0) { B.choose('defend', null); return; }

  if (!B.submenu) {
    if (Input.hit.left) { B.menuIdx = (B.menuIdx + MENU.length - 1) % MENU.length; Snd.play('menumove'); }
    if (Input.hit.right) { B.menuIdx = (B.menuIdx + 1) % MENU.length; Snd.play('menumove'); }
    if (Input.hit.ok) {
      const cmd = MENU[B.menuIdx];
      Snd.play('select');
      if (cmd === 'fight') B.choose('fight', null);
      else if (cmd === 'defend') B.choose('defend', null);
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

Battle.subOptions = function () {
  const B = Battle, c = CHARS[B.myChar];
  if (B.submenu === 'magic') {
    const list = c.spells.map(s => ({
      id: s.id, label: s.name, cost: s.tp + '%', disabled: B.me.tp < s.tp,
    }));
    list.push({ id: c.ult.id, label: c.ult.name, cost: c.ult.tp + '%',
                disabled: B.me.tp < c.ult.tp, ult: true });
    return list;
  }
  if (B.submenu === 'act') {
    return [{ id: c.act.id, label: c.act.name, cost: 'FREE' }];
  }
  if (B.submenu === 'item') {
    if (!B.me.items.length) return [{ id: null, label: '(empty)', disabled: true }];
    return B.me.items.map((it, i) => ({ id: i, label: ITEMS[it].name }));
  }
  return [];
};

Battle.choose = function (cmd, move) {
  const B = Battle;
  B.myAction = { t: 'action', cmd, move, seed: randSeed() };
  Battle.send(B.myAction);
  B.submenu = null;
  B.phase = 'waitopp';
  B.say('* Waiting for ' + B.oppName + '...');
};

// ---------- reveal ----------
Battle.startReveal = function () {
  const B = Battle;
  const lines = [];
  lines.push('* ' + B.actionText(B.myChar, B.myAction, true));
  lines.push('* ' + B.actionText(B.oppChar, B.oppAction, false));
  B.say(lines);
  B.revealT = 120;
  B.phase = 'reveal';
};

Battle.actionText = function (ch, a, mine) {
  const c = CHARS[ch];
  if (a.cmd === 'fight') return c.fight.text;
  if (a.cmd === 'magic') {
    const d = a.move === c.ult.id ? c.ult : c.spells.find(s => s.id === a.move);
    return d ? d.text : c.name + ' casts magic!';
  }
  if (a.cmd === 'act') return c.act.text;
  if (a.cmd === 'item') {
    const it = mine ? ITEMS[Battle.me.items[a.move]] : ITEMS[Battle.opp.items[a.move]];
    return c.name + ' uses ' + (it ? it.name.toUpperCase() : 'an item') + '!';
  }
  if (a.cmd === 'defend') return c.name + ' braces for impact!';
  return c.name + ' hesitates!';
};

// ---------- timing bar ----------
Battle.startTiming = function () {
  const B = Battle;
  const def = myMoveDef();
  if (isAttack(def)) {
    // Deltarune-style: marker sweeps right->left toward the colored zone
    B.timingBar = { x: 416, done: false, t: 0, result: null };
    B.phase = 'timing';
    B.say('* Press [Z] on the target!');
  } else {
    B.myTier = 1;
    Battle.send({ t: 'tier', tier: 1 });
    B.phase = 'waittier';
    B.say('* Waiting...');
  }
};

Battle.updTiming = function () {
  const B = Battle, tb = B.timingBar;
  tb.t++;
  tb.x -= 3.4;
  if (tb.x <= -10) { B.finishTiming(0); return; }   // sailed past -> miss
  if (Input.hit.ok) {
    const d = Math.abs(tb.x - 26);                  // zone center (bar-local)
    B.finishTiming(d < 11 ? 2 : d < 42 ? 1 : 0);
  }
};

Battle.finishTiming = function (tier) {
  const B = Battle;
  B.myTier = tier;
  B.timingBar.done = true;
  B.timingBar.result = tier;
  Snd.play(tier === 2 ? 'criticalswing' : tier === 1 ? 'bell' : 'smallswing');
  Battle.send({ t: 'tier', tier });
  B.phase = 'waittier';
  B.say('* ' + TIER_NAME[tier]);
};

// per-move attack sound when the attack actually fires
const MOVE_SFX = {
  susie_rude: 'rudebuster', susie_ult: 'rudebuster',
  snowgrave: 'snowgrave', noelle_ice: 'icespell', noelle_snow: 'icespell',
  kris_slash: 'swing', kris_cross: 'swing', kris_giga: 'heavyswing',
  susie_axe: 'heavyswing', ralsei_scarf: 'smallswing', ralsei_ult: 'spellcast',
  lancer_spade: 'swing', lancer_storm: 'spellcast', lancer_bike: 'heavyswing',
  lancer_ult: 'ultraswing',
};

// ---------- dodge ----------
Battle.startDodge = function () {
  const B = Battle;
  const oppDef = oppMoveDef();
  B.dmgTaken = 0; B.tpGained = 0;
  B.bullets = [];
  B.soul.x = BOX.x + BOX.w / 2; B.soul.y = BOX.y + BOX.h * 0.72;
  B.iframes = 0; B.grazeCd = 0;
  B.dodgeBox = { ...BOX };
  if (B.fxOnMe && B.fxOnMe.boxScale) {
    const s = B.fxOnMe.boxScale;
    B.dodgeBox.w = Math.round(BOX.w * s); B.dodgeBox.h = Math.round(BOX.h * s);
    B.dodgeBox.x = Math.round(BOX.x + (BOX.w - B.dodgeBox.w) / 2);
    B.dodgeBox.y = Math.round(BOX.y + (BOX.h - B.dodgeBox.h) / 2);
    B.soul.x = B.dodgeBox.x + B.dodgeBox.w / 2;
    B.soul.y = B.dodgeBox.y + B.dodgeBox.h * 0.7;
  }
  B.hearts = [];
  if (B.fxOnMe && B.fxOnMe.hearts) {
    for (let i = 0; i < 7; i++)
      B.hearts.push({ x: B.dodgeBox.x + Math.random() * B.dodgeBox.w,
                      y: B.dodgeBox.y + Math.random() * B.dodgeBox.h,
                      vx: (Math.random() - 0.5) * 1.1, vy: (Math.random() - 0.5) * 1.1 });
  }

  if (isAttack(oppDef)) {
    let tier = B.oppTier;
    if (B.pacifyOpp) tier = 0;   // pacified: their press doesn't matter
    B.oppEffTier = tier;
    B.sim = makeDodgeSim(B.oppChar, oppDef, tier, B.oppAction.seed, B.dodgeBox);
    B.dodgeT = B.sim.dur;
    B.anim.oppPose = 'attack'; B.anim.oppT = 0;
    Snd.play(MOVE_SFX[oppDef.id] || 'swing');
    B.say('* DODGE!');
  } else {
    B.sim = null;
    B.dodgeT = 0;
  }
  const myDef = myMoveDef();
  if (isAttack(myDef)) {
    B.anim.myPose = 'attack'; B.anim.myT = 0;
    if (B.sim == null) Snd.play(MOVE_SFX[myDef.id] || 'swing');
    // spectator mirror: re-simulate MY attack pattern (same seed) so we can
    // watch the opponent's streamed soul dodge it in the side box
    const myEffTier = B.myPacified ? 0 : B.myTier;
    const mbox = { x: 0, y: 0, w: BOX.w, h: BOX.h };
    B.mirror = {
      sim: makeDodgeSim(B.myChar, myDef, myEffTier, B.myAction.seed, mbox),
      box: mbox, bullets: [], f: 0, target: 0,
      soul: { x: mbox.w / 2, y: mbox.h * 0.72 },
    };
  }

  // tell the (practice) opponent how strong our attack is
  Battle.send({ t: 'dodgeStart',
             potential: isAttack(myDef) ? Math.round(myDef.dmg * TIER_MULT[B.myTier] * 3) : 0,
             dur: isAttack(myDef) ? PATTERNS[myDef.id].dur : 0 });

  B.phase = 'dodge';
  if (!B.sim) {
    B.say(B.myAction.cmd === 'defend' ? '* You keep your guard up...' : '* Nothing to dodge!');
    B.endDodge();
  }
};

Battle.updDodge = function () {
  const B = Battle;
  // soul movement
  const fx = B.fxOnMe || {};
  let sp = 2.4 * (fx.soulSpeed || 1);
  let dx = (Input.down.right ? 1 : 0) - (Input.down.left ? 1 : 0);
  let dy = (Input.down.down ? 1 : 0) - (Input.down.up ? 1 : 0);
  if (fx.invertX) dx = -dx;
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }
  B.soul.x += dx * sp; B.soul.y += dy * sp;
  if (fx.drift) { B.soul.y += Math.sin(B.anim.f * 0.05) * 0.5; }
  const bx = B.dodgeBox;
  B.soul.x = Math.max(bx.x + 4, Math.min(bx.x + bx.w - 4, B.soul.x));
  B.soul.y = Math.max(bx.y + 4, Math.min(bx.y + bx.h - 4, B.soul.y));

  for (const h of B.hearts || []) {
    h.x += h.vx; h.y += h.vy;
    if (h.x < bx.x || h.x > bx.x + bx.w) h.vx *= -1;
    if (h.y < bx.y || h.y > bx.y + bx.h) h.vy *= -1;
  }

  // bullets
  B.sim.tick(B.soul, b => {
    b.t = 0; b.phase0 = Math.random() * 6.28;
    B.bullets.push(b);
  });
  if (B.iframes > 0) B.iframes--;
  if (B.grazeCd > 0) B.grazeCd--;
  const oppDef = oppMoveDef();
  const defending = B.myAction.cmd === 'defend';
  for (const b of B.bullets) {
    b.t++;
    if (b.homing) {
      const d = Math.hypot(B.soul.x - b.x, B.soul.y - b.y) || 1;
      b.vx += (B.soul.x - b.x) / d * b.homing;
      b.vy += (B.soul.y - b.y) / d * b.homing;
    }
    b.vx += b.ax || 0; b.vy += b.ay || 0;
    if (b.maxv) {
      const v = Math.hypot(b.vx, b.vy);
      if (v > b.maxv) { b.vx *= b.maxv / v; b.vy *= b.maxv / v; }
    }
    b.x += b.vx; b.y += b.vy;
    if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
    if (b.spin) b.rot = (b.rot || 0) + b.spin;
    if (b.trail === 'spade' && b.t % 9 === 0) {
      B.bullets.push({ x: b.x, y: b.y + 10, vx: 0, vy: 1.2, r: 6, t: 0,
                       img: A.chrFrames(B.oppChar, 'spade_pink')[0] || null,
                       shape: 'dot', color: '#88f', scale: 1.1 });
    }
    // collision
    const dist = Math.hypot(b.x - B.soul.x, b.y - B.soul.y);
    if (dist < (b.r || 6) + SOUL_R) {
      if (B.iframes <= 0) {
        let dmg = Math.round(oppDef.dmg * TIER_MULT[B.oppEffTier] * (defending ? 0.5 : 1)
                             * (0.9 + Math.random() * 0.2));
        B.dmgTaken += dmg;
        B.me.hp = Math.max(0, B.me.hp - dmg);
        B.iframes = IFRAMES;
        B.shake = 14; B.flash = 8;
        Snd.play('hurt');
        B.dmgPops.push({ x: B.soul.x, y: B.soul.y - 14, txt: '' + dmg, t: 0, color: '#f22' });
        B.anim.myPose = 'hurt'; B.anim.myT = 0;
      }
    } else if (dist < (b.r || 6) + GRAZE_R && B.grazeCd <= 0 && b.t > 2) {
      const gain = defending ? 3 : 2;
      B.me.tp = Math.min(100, B.me.tp + gain);
      B.tpGained += gain;
      B.grazeCd = 10;
      Snd.play('graze', 0.35);
      B.grazeFx = { x: B.soul.x, y: B.soul.y, t: 8 };
    }
  }
  if (B.grazeFx && --B.grazeFx.t <= 0) B.grazeFx = null;
  B.bullets = B.bullets.filter(b =>
    b.x > -60 && b.x < 700 && b.y > -60 && b.y < 540 && (!b.life || b.t < b.life));

  // stream my soul position + sim frame for the opponent's spectator box
  if (B.anim.f % 4 === 0)
    Battle.send({ t: 'soul', x: (B.soul.x - bx.x) / bx.w, y: (B.soul.y - bx.y) / bx.h,
                  f: B.sim ? B.sim.f : 0, done: false });

  if (--B.dodgeT <= 0 || B.me.hp <= 0) B.endDodge();
};

// advance the spectator mirror sim toward the opponent's reported frame
Battle.tickMirror = function () {
  const B = Battle, M = B.mirror;
  if (!M || !B.oppDodging) return;
  // follow their reported frame, advancing at most 3 steps/frame to catch up
  M.target = Math.max(M.target, M.f + 1);
  let steps = Math.min(3, M.target - M.f, M.sim.dur - M.f);
  if (B.oppSoul) {
    M.soul.x = B.oppSoul.x * M.box.w;
    M.soul.y = B.oppSoul.y * M.box.h;
  }
  while (steps-- > 0) {
    M.sim.tick(M.soul, b => { b.t = 0; b.phase0 = Math.random() * 6.28; M.bullets.push(b); });
    M.f++;
    for (const b of M.bullets) {
      b.t++;
      if (b.homing) {
        const d = Math.hypot(M.soul.x - b.x, M.soul.y - b.y) || 1;
        b.vx += (M.soul.x - b.x) / d * b.homing;
        b.vy += (M.soul.y - b.y) / d * b.homing;
      }
      b.vx += b.ax || 0; b.vy += b.ay || 0;
      if (b.maxv) {
        const v = Math.hypot(b.vx, b.vy);
        if (v > b.maxv) { b.vx *= b.maxv / v; b.vy *= b.maxv / v; }
      }
      b.x += b.vx; b.y += b.vy;
      if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
      if (b.spin) b.rot = (b.rot || 0) + b.spin;
    }
    M.bullets = M.bullets.filter(b =>
      b.x > -80 && b.x < M.box.w + 80 && b.y > -80 && b.y < M.box.h + 80 &&
      (!b.life || b.t < b.life));
  }
};

Battle.endDodge = function () {
  const B = Battle;
  B.bullets = [];
  B.sim = null;
  Battle.send({ t: 'soul', x: 0.5, y: 0.5, done: true });

  // apply my heals/items/defend AFTER dodging
  const c = CHARS[B.myChar], a = B.myAction;
  if (a.cmd === 'defend') B.me.tp = Math.min(100, B.me.tp + 16);
  if (a.cmd === 'item') {
    const it = ITEMS[B.me.items[a.move]];
    if (it) {
      B.me.hp = Math.min(B.me.max, B.me.hp + (it.heal || 0));
      B.me.tp = Math.min(100, B.me.tp + (it.tp || 0));
      B.me.items.splice(a.move, 1);
      Snd.play('cure');
      B.dmgPops.push({ x: 110, y: 250, txt: '+' + it.heal, t: 0, color: '#2f2' });
    }
  }
  if (a.cmd === 'magic') {
    const d = a.move === c.ult.id ? c.ult : c.spells.find(s => s.id === a.move);
    if (d) {
      B.me.tp = Math.max(0, B.me.tp - d.tp);
      if (d.heal) {
        B.me.hp = Math.min(B.me.max, B.me.hp + d.heal);
        Snd.play('cure');
        B.dmgPops.push({ x: 110, y: 250, txt: '+' + d.heal, t: 0, color: '#2f2' });
      }
      if (d.kind === 'status') Snd.play(d.status === 'pacified' ? 'pacify' : 'spellcast');
      if (d.kind === 'status') B.pacifyOppNext = (d.status === 'pacified');
      if (d.status === 'drowsy') B.fxOnOppQueue = 'drowsy';
    }
  }

  B.myResult = { t: 'result', dmgTaken: B.dmgTaken, tpGained: B.tpGained,
                 hp: B.me.hp, tp: B.me.tp };
  Battle.send(B.myResult);
  B.phase = 'waitresult';
  B.say('* Waiting for result...');
};

// ---------- resolve ----------
Battle.resolve = function () {
  const B = Battle;
  const r = B.oppResult;
  B.opp.hp = r.hp; B.opp.tp = r.tp;
  if (r.dmgTaken > 0) {
    Snd.play('damage');
    B.dmgPops.push({ x: 530, y: 200, txt: '' + r.dmgTaken, t: 0, color: '#f22' });
    B.anim.oppPose = 'hurt'; B.anim.oppT = 0;
    B.shake = Math.max(B.shake, 8);
  } else if (isAttack(myMoveDef())) {
    B.dmgPops.push({ x: 530, y: 200, txt: 'MISS', t: 0, color: '#888' });
  }

  // queue status effects for NEXT turn
  B.fxOnMeQueued = null;
  if (B.oppAction.cmd === 'act') B.fxOnMeQueued = { ...ACT_FX[CHARS[B.oppChar].act.id] };
  const oppD = oppMoveDef();
  if (B.oppAction.cmd === 'magic') {
    const oc = CHARS[B.oppChar];
    const d = B.oppAction.move === oc.ult.id ? oc.ult : oc.spells.find(s => s.id === B.oppAction.move);
    if (d && d.kind === 'status') B.fxOnMeQueued = { ...ACT_FX[d.status] };
  }
  B.pacifyOpp = !!B.pacifyOppNext; B.pacifyOppNext = false;
  // did THEY pacify ME? then my next attack is capped at weak tier
  B.myPacifiedNext = false;
  if (B.oppAction.cmd === 'magic') {
    const oc2 = CHARS[B.oppChar];
    const od2 = B.oppAction.move === oc2.ult.id ? oc2.ult : oc2.spells.find(s => s.id === B.oppAction.move);
    if (od2 && od2.status === 'pacified') B.myPacifiedNext = true;
  }

  const lines = [];
  if (r.dmgTaken > 0) lines.push('* ' + B.oppName + ' took ' + r.dmgTaken + ' damage!');
  if (B.dmgTaken > 0) lines.push('* You took ' + B.dmgTaken + ' damage!');
  if (!lines.length) lines.push('* The tension rises...');
  B.say(lines);

  if (B.me.hp <= 0 || B.opp.hp <= 0) {
    B.result = B.me.hp <= 0 ? (B.opp.hp <= 0 ? 'draw' : 'lose') : 'win';
    B.phase = 'gameover';
    B.anim[B.result === 'win' ? 'oppPose' : 'myPose'] = 'downed';
    if (B.result === 'win') { Snd.stopMusic(); Snd.play('won'); }
    else if (B.result === 'lose') Snd.playMusic('game_over');
    else Snd.stopMusic();
    return;
  }
  B.resolveT = 110;
  B.phase = 'resolve';
};

Battle.nextTurn = function () {
  const B = Battle;
  B.turn++;
  B.fxOnMe = B.fxOnMeQueued;   // opponent's queued sabotage applies this turn
  B.fxOnMeQueued = null;
  B.myPacified = B.myPacifiedNext; B.myPacifiedNext = false;
  B.mirror = null;
  B.myAction = B.oppAction = null;
  B.myTier = B.oppTier = null;
  B.myResult = B.oppResult = null;
  B.timer = SELECT_FRAMES;
  B.menuIdx = 0; B.submenu = null;
  B.oppDodging = false; B.oppSoul = null;
  B.anim.myPose = 'idle'; B.anim.oppPose = 'idle';
  B.phase = 'select';
  B.say('* ' + B.myName + '!  Your move.');
};

// ---------- render ----------
Battle.render = function (ctx) {
  const B = Battle;
  ctx.save();
  if (B.shake > 0)
    ctx.translate((Math.random() - 0.5) * B.shake * 0.8, (Math.random() - 0.5) * B.shake * 0.8);

  // background
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

  // damage pops
  for (const p of B.dmgPops) {
    const dy = Math.max(0, 12 - p.t) * 1.2;
    drawText(ctx, 'big', p.txt, p.x, p.y - 20 - dy + (p.t > 50 ? (p.t - 50) : 0),
             { color: p.color, align: 'center', scale: 0.75 });
  }
  if (B.flash > 0) {
    ctx.fillStyle = 'rgba(255,0,0,' + (B.flash / 40) + ')';
    ctx.fillRect(0, 0, 640, 480);
  }
  ctx.restore();
};

function poseFrames(ch, pose) {
  const groups = { idle: 'idle', attack: 'attack', hurt: 'hurt', downed: 'downed' };
  let fr = A.chrFrames(ch, groups[pose] || 'idle');
  if (!fr.length) fr = A.chrFrames(ch, 'idle');
  return fr;
}

Battle.renderChars = function (ctx) {
  const B = Battle;
  B.anim.myT++; B.anim.oppT++;
  if (B.anim.myPose === 'hurt' && B.anim.myT > 40) B.anim.myPose = 'idle';
  if (B.anim.oppPose === 'hurt' && B.anim.oppT > 40) B.anim.oppPose = 'idle';
  if (B.anim.myPose === 'attack' && B.anim.myT > 60) B.anim.myPose = 'idle';
  if (B.anim.oppPose === 'attack' && B.anim.oppT > 60) B.anim.oppPose = 'idle';

  const mf = poseFrames(B.myChar, B.anim.myPose);
  const of = poseFrames(B.oppChar, B.anim.oppPose);
  const mi = mf[Math.floor(B.anim.myT / 12) % mf.length];
  const oi = of[Math.floor(B.anim.oppT / 12) % of.length];
  const hurtFlashMe = B.anim.myPose === 'hurt' && (B.anim.myT % 8 < 4);
  drawSpr(ctx, mi, 100, 250, { scale: 2, alpha: hurtFlashMe ? 0.4 : 1 });
  const hurtFlashOpp = B.anim.oppPose === 'hurt' && (B.anim.oppT % 8 < 4);
  drawSpr(ctx, oi, 540, 230, { scale: 2, flip: true, alpha: hurtFlashOpp ? 0.4 : 1 });
};

Battle.renderBoxAndBullets = function (ctx) {
  const B = Battle;
  const inDodge = B.phase === 'dodge';
  const bx = inDodge ? B.dodgeBox : BOX;
  ctx.fillStyle = '#000';
  ctx.fillRect(bx.x, bx.y, bx.w, bx.h);
  ctx.strokeStyle = '#00c000'; ctx.lineWidth = 3;   // Deltarune green board
  ctx.strokeRect(bx.x - 1.5, bx.y - 1.5, bx.w + 3, bx.h + 3);

  if (inDodge) {
    ctx.save();
    ctx.beginPath(); ctx.rect(bx.x - 40, bx.y - 40, bx.w + 80, bx.h + 80); ctx.clip();
    for (const h of B.hearts || []) {
      drawText(ctx, 'main', '', 0, 0);  // (no glyph) fallback below
      ctx.fillStyle = 'rgba(255,105,180,0.8)';
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(-0.05);
      ctx.fillRect(-4, -3, 3, 3); ctx.fillRect(1, -3, 3, 3);
      ctx.fillRect(-4, 0, 8, 3); ctx.fillRect(-2, 3, 4, 2);
      ctx.restore();
    }
    for (const b of B.bullets) {
      if (b.img && b.img.width) {
        drawSpr(ctx, b.img, b.x, b.y, { scale: (b.scale || 1) * 1.6, rot: b.rot || 0, flip: b.flip });
      } else {
        ctx.fillStyle = b.color || '#fff';
        if (b.shape === 'star') {
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate((b.t || 0) * 0.1);
          for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-1, -6, 2, 12); }
          ctx.restore();
        } else if (b.shape === 'note') {
          ctx.fillRect(b.x - 2, b.y - 6, 3, 10);
          ctx.beginPath(); ctx.arc(b.x - 3, b.y + 4, 4, 0, 7); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r || 5, 0, 7); ctx.fill();
        }
      }
    }
    // soul
    const soulImg = A.ui('soul');
    const blink = B.iframes > 0 && (B.anim.f % 8 < 4);
    if (!blink) drawSpr(ctx, soulImg, B.soul.x, B.soul.y, { scale: 1 });
    if (B.grazeFx) {
      ctx.strokeStyle = 'rgba(255,255,150,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(B.grazeFx.x, B.grazeFx.y, 14 - B.grazeFx.t, 0, 7); ctx.stroke();
    }
    ctx.restore();
    // status labels
    if (B.fxOnMe) {
      const tags = [];
      if (B.fxOnMe.boxScale) tags.push('CRAMPED');
      if (B.fxOnMe.soulSpeed) tags.push('HEAVY');
      if (B.fxOnMe.invertX) tags.push('REVERSED');
      if (B.fxOnMe.hearts) tags.push('FLUSTERED');
      if (B.fxOnMe.drift) tags.push('DROWSY');
      if (tags.length)
        drawText(ctx, 'main', tags.join(' '), bx.x + bx.w / 2, bx.y - 20,
                 { color: '#ff8', align: 'center' });
    }
  }
};

// tinted soul sprite cache (per css color)
const soulTints = {};
function tintedSoul(color) {
  if (soulTints[color]) return soulTints[color];
  const src = A.ui('soul');
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  soulTints[color] = c;
  return c;
}

// spectator box: the opponent (their colored soul) dodging MY attack
Battle.renderMirror = function (ctx) {
  const B = Battle, M = B.mirror;
  if (!M || !B.oppDodging || !B.oppSoul) return;
  const s = 0.5;
  const mw = M.box.w * s, mh = M.box.h * s;
  const mx = 500 - mw / 2, my = 96 - mh / 2;   // top-right, above opp sprite
  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = '#000';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 2;
  ctx.strokeRect(mx - 1, my - 1, mw + 2, mh + 2);
  ctx.beginPath(); ctx.rect(mx - 20, my - 20, mw + 40, mh + 40); ctx.clip();
  for (const b of M.bullets) {
    if (b.img && b.img.width) {
      drawSpr(ctx, b.img, mx + b.x * s, my + b.y * s,
              { scale: (b.scale || 1) * 1.6 * s, rot: b.rot || 0, flip: b.flip });
    } else {
      ctx.fillStyle = b.color || '#aaa';
      ctx.beginPath(); ctx.arc(mx + b.x * s, my + b.y * s, (b.r || 5) * s, 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 0.95;
  drawSpr(ctx, tintedSoul(CHARS[B.oppChar].color), mx + M.soul.x * s, my + M.soul.y * s, { scale: 0.75 });
  ctx.restore();
  drawSpr(ctx, A.ui('head_' + B.oppChar), mx - 18, my + 10, { scale: 1, alpha: 0.9 });
};

// one bottom-panel character entry: head icon, name, HP label, bar, numbers
function drawEntry(ctx, x, y, ch, name, hp, max, active) {
  const head = A.ui('head_' + ch + (hp <= 0 ? '_gray' : ''));
  drawSpr(ctx, head, x + 13, y + 15, { scale: 1 });
  drawText(ctx, 'main', name, x + 34, y + 6, { color: '#fff' });
  drawText(ctx, 'main', hp + '/ ' + max, x + 250, y - 2, { color: '#fff', align: 'right' });
  drawText(ctx, 'main', 'HP', x + 132, y + 11, { color: '#fff' });
  ctx.fillStyle = '#3c0d0d';
  ctx.fillRect(x + 156, y + 14, 94, 9);
  ctx.fillStyle = CHARS[ch].color;
  ctx.fillRect(x + 156, y + 14, Math.max(0, Math.round(94 * hp / max)), 9);
  if (active) {
    ctx.strokeStyle = CHARS[ch].color; ctx.lineWidth = 1;
    ctx.strokeRect(x - 4, y - 6, 262, 38);
  }
}

Battle.renderHud = function (ctx) {
  const B = Battle;
  // bottom panel
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 384, 640, 96);
  ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 384.5); ctx.lineTo(640, 384.5); ctx.stroke();

  drawEntry(ctx, 62, 394, B.myChar, B.myName, B.me.hp, B.me.max,
            B.phase === 'select');
  drawEntry(ctx, 358, 394, B.oppChar, B.oppName, B.opp.hp, B.opp.max, false);

  // TP bar (vertical, top-left like the real game)
  ctx.fillStyle = '#3f0000'; ctx.fillRect(38, 58, 18, 190);
  const tpH = Math.round(190 * B.me.tp / 100);
  ctx.fillStyle = '#ff8000'; ctx.fillRect(38, 58 + 190 - tpH, 18, tpH);
  if (tpH > 0 && tpH < 190) { ctx.fillStyle = '#fff'; ctx.fillRect(38, 58 + 190 - tpH, 18, 3); }
  drawText(ctx, 'main', 'T', 22, 58, { color: '#fff' });
  drawText(ctx, 'main', 'P', 22, 76, { color: '#fff' });
  drawText(ctx, 'main', '' + B.me.tp, 46, 252, { color: '#ff8000', align: 'center' });
  drawText(ctx, 'main', '%', 46, 270, { color: '#ff8000', align: 'center' });

  // command buttons under my entry (select phase only)
  if (B.phase === 'select') {
    const names = ['fight', 'magic', 'act', 'item', 'defend'];
    for (let i = 0; i < names.length; i++) {
      const sel = !B.submenu && B.menuIdx === i;
      const im = A.ui('btn_' + names[i] + (sel ? '_sel' : ''));
      drawSpr(ctx, im, 92 + i * 48, 448, { scale: 1.4 });
    }
    const secs = Math.ceil(B.timer / 60);
    drawText(ctx, 'big', '' + secs, 320, 20, { color: secs <= 5 ? '#f44' : '#fff', align: 'center', scale: 0.6 });
  }
  drawText(ctx, 'main', 'TURN ' + B.turn, 30, 20, { color: '#666' });

  // submenu panel
  if (B.submenu) {
    const opts = B.subOptions();
    const px = 200, py = 150, pw = 240, ph = 40 + opts.length * 26;
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);
    drawText(ctx, 'main', B.submenu.toUpperCase(), px + pw / 2, py + 8, { color: '#ff8000', align: 'center' });
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
  B.msg.forEach((m, i) => {
    drawText(ctx, 'main', m, 40, 428 + i * 22, { color: '#fff' });
  });
};

Battle.renderTiming = function (ctx) {
  const B = Battle, tb = B.timingBar;
  // Deltarune attack bar: head icon + PRESS + long bar, colored target at left
  const x = 150, y = 434, w = 416, h = 28;
  drawSpr(ctx, A.ui('head_' + B.myChar), 60, y + h / 2, { scale: 1 });
  drawText(ctx, 'main', 'PRESS', 80, y + 6, { color: '#fff' });
  ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = CHARS[B.myChar].color;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x + 8, y + 2, 36, h - 4);            // target zone
  ctx.globalAlpha = 1;
  if (!tb.done) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + Math.max(0, tb.x) - 2, y - 5, 4, h + 10);
  }
};

Battle.renderGameover = function (ctx) {
  const B = Battle;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 640, 480);
  const txt = B.result === 'win' ? 'YOU WON!' : B.result === 'draw' ? 'DRAW!' : 'YOU LOST!';
  const col = B.result === 'win' ? '#ff0' : B.result === 'draw' ? '#fff' : '#f44';
  drawText(ctx, 'big', txt, 320, 180, { color: col, align: 'center' });
  drawText(ctx, 'main',
           B.rematchMe ? (B.rematchOpp ? '' : 'Waiting for opponent...') : 'Press [Z] for REMATCH',
           320, 250, { color: '#fff', align: 'center' });
};
