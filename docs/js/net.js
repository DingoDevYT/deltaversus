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
  handle(msg) {
    if (msg.t === 'hello') {
      const ids = Object.keys(CHARS);
      PracticeAI.char = ids[Math.floor(Math.random() * ids.length)];
      Net.emitLocal({ t: 'hello', name: 'DUMMY', char: PracticeAI.char,
                      items: ['darkburger', 'cdbagel', 'chocodiamond'] });
      Net.emitLocal({ t: 'ready' });
    } else if (msg.t === 'action') {
      const me = CHARS[PracticeAI.char];
      const st = PracticeAI.state = PracticeAI.state ||
        { hp: me.hp, tp: 0, items: ['darkburger', 'cdbagel', 'chocodiamond'] };
      // pick: mostly fight, spell if TP, item if hurt
      let cmd = 'fight', move = null;
      const r = Math.random();
      if (st.hp < me.hp * 0.35 && st.items.length && r < 0.5) {
        cmd = 'item'; move = st.items.pop();
      } else if (r < 0.15) {
        cmd = 'defend';
      } else {
        const afford = me.spells.filter(s => s.tp <= st.tp);
        if (afford.length && r < 0.55) { cmd = 'magic'; move = afford[Math.floor(Math.random() * afford.length)].id; }
      }
      Net.emitLocal({ t: 'action', cmd, move, seed: randSeed() });
      setTimeout(() => Net.emitLocal({ t: 'tier', tier: Math.floor(Math.random() * 3) }),
                 400 + Math.random() * 1200);
    } else if (msg.t === 'tier') {
      // after both tiers, the real player dodges; dummy "dodges" too:
      // report plausible damage when the player's attack lands.
      PracticeAI.pendingTier = msg.tier;
    } else if (msg.t === 'dodgeStart') {
      const st = PracticeAI.state;
      const atk = msg.atk;
      if (!atk) {                              // nothing to dodge this turn
        setTimeout(() => Net.emitLocal({ t: 'result', dmgTaken: 0, tpGained: 0,
                                         hp: st.hp, tp: st.tp }), 250);
        return;
      }
      // rebuild the REAL attack and dodge it with an avoidance AI
      const box = { x: 0, y: 0, w: 224, h: 176 };
      const moveDef = { id: atk.moveId, custom: atk.custom, dmg: atk.perHit, dur: atk.dur };
      const sim = makeDodgeSim({ base: atk.base }, moveDef, atk.tier, atk.seed, box);
      const soul = { x: box.w / 2, y: box.h * 0.7 };
      const skill = PracticeAI.skill != null ? PracticeAI.skill : 0.82;  // 0..1 competence
      let bullets = [], f = 0, dmg = 0, tp0 = st.tp, tp = st.tp, ifr = 0, grz = 0;

      const iv = setInterval(() => {
        for (let step = 0; step < 3 && f < atk.dur; step++, f++) {
          sim.tick(soul, b => { b.t = 0; b.phase0 = Math.random() * 6.28; bullets.push(b); });
          PracticeAI.moveSoul(soul, bullets, box, skill);
          for (const b of bullets) {
            b.t++;
            if (b.homing) {
              const d = Math.hypot(soul.x - b.x, soul.y - b.y) || 1;
              b.vx += (soul.x - b.x) / d * b.homing; b.vy += (soul.y - b.y) / d * b.homing;
            }
            b.vx += b.ax || 0; b.vy += b.ay || 0;
            if (b.maxv) { const v = Math.hypot(b.vx, b.vy); if (v > b.maxv) { b.vx *= b.maxv / v; b.vy *= b.maxv / v; } }
            b.x += b.vx; b.y += b.vy;
            if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
          }
          bullets = bullets.filter(b => b.x > -50 && b.x < box.w + 50 && b.y > -50 && b.y < box.h + 50 && (!b.life || b.t < b.life));
          if (ifr > 0) ifr--;
          if (grz > 0) grz--;
          for (const b of bullets) {
            const d = Math.hypot(b.x - soul.x, b.y - soul.y), rr = (b.r || 6) + 5;
            if (d < rr) { if (ifr <= 0) { dmg += atk.perHit; ifr = 55; } }
            else if (d < rr + 12 && grz <= 0) { tp = Math.min(100, tp + 2); grz = 10; }
          }
        }
        if (f % 2 === 0)
          Net.emitLocal({ t: 'soul', x: soul.x / box.w, y: soul.y / box.h, f, done: false });
        if (f >= atk.dur) {
          clearInterval(iv);
          st.hp = Math.max(0, st.hp - Math.round(dmg));
          st.tp = Math.min(100, tp + 8);       // small defend-ish trickle
          Net.emitLocal({ t: 'soul', x: 0.5, y: 0.5, done: true });
          Net.emitLocal({ t: 'result', dmgTaken: Math.round(dmg),
                          tpGained: st.tp - tp0, hp: st.hp, tp: st.tp });
        }
      }, 30);
    } else if (msg.t === 'rematch') {
      PracticeAI.state = null;
      Net.emitLocal({ t: 'rematch' });
    }
  },
};
