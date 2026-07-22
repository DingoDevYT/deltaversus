// PeerJS networking: host/join by 4-letter room code, plus a Practice stub.
const Net = {
  peer: null, conn: null,
  isHost: false, connected: false, practice: false,
  code: '',
  handlers: [],   // fn(msg)
  status: '',     // human-readable connection status
  onOpen: null, onClose: null,
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
function makeCode() {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}
const PEER_PREFIX = 'deltaversus-v1-';

Net.host = function () {
  Net.reset();
  Net.isHost = true;
  Net.code = makeCode();
  Net.status = 'CREATING ROOM...';
  Net.peer = new Peer(PEER_PREFIX + Net.code);
  Net.peer.on('open', () => { Net.status = 'WAITING FOR CHALLENGER'; });
  Net.peer.on('connection', c => {
    if (Net.conn) { c.close(); return; }
    Net.bind(c);
  });
  Net.peer.on('error', e => {
    if (e.type === 'unavailable-id') { Net.peer.destroy(); Net.host(); }
    else Net.status = 'ERROR: ' + e.type;
  });
};

Net.join = function (code) {
  Net.reset();
  Net.isHost = false;
  Net.code = code;
  Net.status = 'CONNECTING...';
  Net.peer = new Peer();
  Net.peer.on('open', () => {
    const c = Net.peer.connect(PEER_PREFIX + code, { reliable: true });
    Net.bind(c);
  });
  Net.peer.on('error', e => {
    if (e.type === 'peer-unavailable') Net.status = 'ROOM NOT FOUND';
    else Net.status = 'ERROR: ' + e.type;
  });
};

Net.bind = function (c) {
  Net.conn = c;
  c.on('open', () => {
    Net.connected = true;
    Net.status = 'CONNECTED';
    if (Net.onOpen) Net.onOpen();
  });
  c.on('data', d => { for (const h of Net.handlers) h(d); });
  c.on('close', () => {
    Net.connected = false;
    Net.status = 'DISCONNECTED';
    if (Net.onClose) Net.onClose();
  });
};

Net.send = function (msg) {
  if (Net.practice) { PracticeAI.recv(msg); return; }
  if (Net.conn && Net.connected) Net.conn.send(msg);
};
Net.on = fn => Net.handlers.push(fn);
Net.emitLocal = msg => { for (const h of Net.handlers) h(msg); };

Net.reset = function () {
  if (Net.peer) try { Net.peer.destroy(); } catch (e) {}
  Net.peer = null; Net.conn = null;
  Net.connected = false; Net.practice = false;
  Net.handlers = []; Net.status = '';
  Net.onOpen = null; Net.onClose = null;
};

Net.startPractice = function () {
  Net.reset();
  Net.practice = true;
  Net.isHost = true;
  Net.connected = true;
  Net.status = 'PRACTICE';
};

// --- practice dummy: replies to messages like a remote player ---
const PracticeAI = {
  char: null, myChar: null,
  recv(msg) {
    // reply asynchronously so the game loop treats it like network data
    setTimeout(() => PracticeAI.handle(msg), 60 + Math.random() * 500);
  },
  // greedy bullet-avoidance: steer away from nearby threats, hug open space,
  // avoid corners. `skill` 0..1 adds jitter/reaction lag when lower.
  moveSoul(soul, bullets, box, skill) {
    const sp = 2.2;
    let fx = 0, fy = 0;
    const reach = 52 + skill * 22;
    for (const b of bullets) {
      const dx = soul.x - b.x, dy = soul.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < reach) {
        let w = (reach - d) / reach; w *= w;
        // weight bullets heading toward us more heavily
        const vlen = Math.hypot(b.vx || 0, b.vy || 0) || 1;
        const approach = -((b.vx || 0) * dx + (b.vy || 0) * dy) / (vlen * d);
        if (approach > 0) w *= 1 + approach * 1.5;
        fx += dx / d * w; fy += dy / d * w;
      }
    }
    // anti-corner drift, but ONLY when few threats are near (else it walks
    // straight into center-converging patterns like X-slash / spirals)
    const threat = Math.hypot(fx, fy);
    const calm = Math.max(0, 1 - threat * 4);
    fx += (box.w / 2 - soul.x) * 0.004 * calm;
    fy += (box.h / 2 - soul.y) * 0.004 * calm;
    // lower skill -> shakier aim
    fx += (Math.random() - 0.5) * (1 - skill) * 1.2;
    fy += (Math.random() - 0.5) * (1 - skill) * 1.2;
    const m = Math.hypot(fx, fy);
    if (m > 0.0001) { soul.x += fx / m * sp; soul.y += fy / m * sp; }
    soul.x = Math.min(box.w - 5, Math.max(5, soul.x));
    soul.y = Math.min(box.h - 5, Math.max(5, soul.y));
  },
  buildTeam(size) {
    let sels = (typeof G !== 'undefined' && G.dummyTeamSel && G.dummyTeamSel.length)
      ? G.dummyTeamSel.slice() : null;
    if (!sels || !sels.length) {                 // random team within the cost budget
      const ids = Object.keys(CHARS);
      sels = []; let budget = size;
      while (budget > 0) {
        const pick = ids.filter(id => CHARS[id].cost <= budget);
        if (!pick.length) break;
        sels.push(pick[Math.floor(Math.random() * pick.length)]);
        budget -= CHARS[sels[sels.length - 1]].cost;
      }
      if (!sels.length) sels = ['kris'];
    }
    return {
      sels,
      members: sels.map(s => { const d = charDef(s); return { def: d, hp: d.hp, max: d.hp, downed: false, spared: false, dark: 0 }; }),
      tp: 0, items: ['darkburger', 'cdbagel', 'chocodiamond'],
    };
  },
  handle(msg) {
    if (msg.t === 'hello') {
      const size = msg.size || 1;
      const T = PracticeAI.team = PracticeAI.buildTeam(size);
      Net.emitLocal({ t: 'hello', team: T.sels.slice(), items: T.items.slice(), size });
      Net.emitLocal({ t: 'ready' });
    } else if (msg.t === 'actions') {
      // the human's actions arrived; the dummy team now picks its own
      const T = PracticeAI.team;
      const acts = [];
      T.members.forEach((m, i) => {
        if (m.downed || m.spared) return;
        let cmd = 'fight', move = null;
        const r = Math.random();
        const dk = !!m.def.darkner;
        if (m.dark == null) m.dark = 0;
        const disc = s => Math.ceil(s.tp * (dk ? 0.6 : 1));
        // PINK: a full DOKI meter forces a DATE minigame this turn (obj_pink_enemy datecount++)
        if (m.def.dokiSpare && typeof Battle !== 'undefined' && Battle.dokiReady && (m.def.dokiDates || []).length) {
          const dd = m.def.dokiDates[Math.min(Battle.dokiPhase || 0, m.def.dokiDates.length - 1)];
          acts.push({ mi: i, cmd: 'magic', move: dd.id, seed: randSeed() }); return;
        }
        if (m.hp < m.max * 0.35 && T.items.length && r < 0.5 && !m.def.secretBoss) {
          cmd = 'item'; move = 0;
          const it = ITEMS[T.items.shift()]; if (it) m.hp = Math.min(m.max, m.hp + (it.heal || 0));
        } else if (dk && m.dark < 85 && r < 0.4) {   // darkner charges up (need ~5 to unlock ult)
          cmd = 'charge'; m.dark = Math.min(100, m.dark + 17); T.tp = Math.min(100, T.tp + 8);
        } else if (r < 0.12) { cmd = 'defend'; T.tp = Math.min(100, T.tp + 16); }
        else {
          const afford = m.def.spells.filter(s => disc(s) <= T.tp && (!s.darkReq || m.dark >= s.darkReq));
          if (afford.length && r < 0.5) { const s = afford[Math.floor(Math.random() * afford.length)]; cmd = 'magic'; move = s.id; T.tp = Math.max(0, T.tp - disc(s)); }
        }
        acts.push({ mi: i, cmd, move, seed: randSeed() });
      });
      Net.emitLocal({ t: 'actions', acts });
      setTimeout(() => {
        const tiers = acts.filter(a => a.cmd === 'fight' || a.cmd === 'magic')
          .map(a => ({ mi: a.mi, tier: 1 + (Math.random() < 0.4 ? 1 : 0) }));
        T.tp = Math.min(100, T.tp + tiers.reduce((s, t) => s + [4, 10, 18][t.tier], 0));
        Net.emitLocal({ t: 'tiers', tiers });
      }, 500 + Math.random() * 700);
    } else if (msg.t === 'dodgeStart') {
      const T = PracticeAI.team;
      const atks = msg.atks || [];
      if (!atks.length) { setTimeout(() => PracticeAI.report(T, 0), 250); return; }
      const box = { x: 0, y: 0, w: 224, h: 176 };
      const N = atks.length, keep = 1 / (1 + 0.55 * Math.max(0, N - 1));
      const subs = atks.map(a => ({
        sim: makeDodgeSim({ base: a.base }, { id: a.moveId, custom: a.custom, dmg: a.perHit, dur: a.dur }, a.tier, a.seed, box),
        perHit: a.perHit, target: a.target || 0, rng: mulberry32(((a.seed || 1) ^ 0x9e3779b9) >>> 0),
      }));
      // driven by the main loop (PracticeAI.tick) so it is immune to the
      // background-tab timer throttle and runs at the game's framerate.
      PracticeAI.dodge = {
        T, box, subs, N, keep,
        soul: { x: box.w / 2, y: box.h * 0.7 },
        dur: Math.max(...subs.map(s => s.sim.dur)),
        skill: (typeof G !== 'undefined' && G.dummySkill != null) ? G.dummySkill : 0.82,
        atks, bullets: [], f: 0, dmg: 0, ifr: 0, grz: 0,
      };
    } else if (msg.t === 'spare') {
      const T = PracticeAI.team; if (T && T.members[msg.mi]) T.members[msg.mi].spared = true;
    } else if (msg.t === 'snowgrave') {
      const T = PracticeAI.team; if (T) T.members.forEach(m => { m.hp = 0; m.downed = true; });
    } else if (msg.t === 'rematch') {
      PracticeAI.team = null;
      Net.emitLocal({ t: 'rematch' });
    }
  },
  // advanced once per main-loop frame (throttle-immune). Runs the dummy's
  // combined dodge and reports its result when done.
  tick() {
    const D = PracticeAI.dodge;
    if (!D) return;
    if (D.f < D.dur) {
      for (const s of D.subs) {
        if (D.f >= s.sim.dur) continue;
        s.sim.tick(D.soul, b => { if (D.N === 1 || s.rng() < D.keep) { b.t = 0; b.phase0 = Math.random() * 6.28; b.dmg = s.perHit; b.target = s.target; D.bullets.push(b); } });
      }
      PracticeAI.moveSoul(D.soul, D.bullets, D.box, D.skill);
      for (const b of D.bullets) {
        b.t++;
        if (b.homing) { const d = Math.hypot(D.soul.x - b.x, D.soul.y - b.y) || 1; b.vx += (D.soul.x - b.x) / d * b.homing; b.vy += (D.soul.y - b.y) / d * b.homing; }
        b.vx += b.ax || 0; b.vy += b.ay || 0;
        if (b.maxv) { const v = Math.hypot(b.vx, b.vy); if (v > b.maxv) { b.vx *= b.maxv / v; b.vy *= b.maxv / v; } }
        b.x += b.vx; b.y += b.vy;
        if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
      }
      D.bullets = D.bullets.filter(b => b.x > -50 && b.x < D.box.w + 50 && b.y > -50 && b.y < D.box.h + 50 && (!b.life || b.t < b.life));
      if (D.ifr > 0) D.ifr--;
      if (D.grz > 0) D.grz--;
      for (const b of D.bullets) {
        const d = Math.hypot(b.x - D.soul.x, b.y - D.soul.y), rr = (b.r || 6) + 5;
        if (d < rr) { if (D.ifr <= 0) { const dm = b.dmg || 10; D.dmg += dm; PracticeAI.applyDmg(D.T, dm, b.target); D.ifr = 55; } }
        else if (d < rr + 12 && D.grz <= 0) { D.T.tp = Math.min(100, D.T.tp + 2); D.grz = 10; }
      }
      D.f++;
      if (D.f % 4 === 0) Net.emitLocal({ t: 'soul', x: D.soul.x / D.box.w, y: D.soul.y / D.box.h, f: D.f, done: false });
    } else {
      Net.emitLocal({ t: 'soul', x: 0.5, y: 0.5, done: true });
      PracticeAI.report(D.T, Math.round(D.dmg));
      PracticeAI.dodge = null;
    }
  },
  applyDmg(T, dmg, target) {
    const alive = x => !x.downed && !x.spared;
    let m = (target != null && T.members[target] && alive(T.members[target])) ? T.members[target] : null;
    if (!m) m = T.members.find(alive);
    let d = dmg;
    while (d > 0 && m) { const take = Math.min(m.hp, d); m.hp -= take; d -= take; if (m.hp <= 0) { m.downed = true; m = T.members.find(alive); } else break; }
  },
  report(T, dmg) {   // damage already applied live during tick
    Net.emitLocal({ t: 'result', dmgTaken: dmg, hp: T.members.map(m => m.hp), downed: T.members.map(m => m.downed), tp: T.tp });
  },
};
