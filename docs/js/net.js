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
      const dmg = msg.potential != null ? Math.round(msg.potential * (0.25 + Math.random() * 0.45)) : 0;
      const st = PracticeAI.state;
      const durMs = (msg.dur || 480) / 60 * 1000 * (0.9 + Math.random() * 0.2);
      // stream a wandering soul so the spectator mirror box has something to show
      if (msg.dur > 0) {
        let f = 0, sx = 0.5, sy = 0.7, vx = 0, vy = 0;
        const iv = setInterval(() => {
          f += 4;
          vx += (Math.random() - 0.5) * 0.06; vy += (Math.random() - 0.5) * 0.06;
          vx *= 0.8; vy *= 0.8;
          sx = Math.min(0.95, Math.max(0.05, sx + vx));
          sy = Math.min(0.95, Math.max(0.05, sy + vy));
          if (f >= msg.dur) { clearInterval(iv); Net.emitLocal({ t: 'soul', x: 0.5, y: 0.5, done: true }); }
          else Net.emitLocal({ t: 'soul', x: sx, y: sy, f, done: false });
        }, 66);
      }
      setTimeout(() => {
        if (st) { st.hp = Math.max(0, st.hp - dmg); st.tp = Math.min(100, st.tp + 20 + Math.random() * 15 | 0); }
        Net.emitLocal({ t: 'result', dmgTaken: dmg, tpGained: 25, hp: st ? st.hp : 1, tp: st ? st.tp : 0 });
      }, durMs);
    } else if (msg.t === 'rematch') {
      PracticeAI.state = null;
      Net.emitLocal({ t: 'rematch' });
    }
  },
};
