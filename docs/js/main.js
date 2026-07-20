// Screens + game loop. G = global game state outside battle.
const G = {
  screen: 'boot',
  menuIdx: 0,
  joinCode: '',
  selIdx: 0,
  loadout: [], loadIdx: 0,
  myChar: null, myItems: null,
  oppChar: null, oppItems: null,
  myHelloSent: false, oppHello: null,
  notice: '',
  f: 0,
};
const CHAR_IDS = ['kris', 'susie', 'ralsei', 'noelle', 'lancer'];
const ITEM_IDS = Object.keys(ITEMS);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function fitCanvas() {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / 640, innerHeight / 480)));
  canvas.style.width = 640 * s + 'px';
  canvas.style.height = 480 * s + 'px';
}
addEventListener('resize', fitCanvas);
fitCanvas();

// raw letter capture for the join-code entry
addEventListener('keydown', e => {
  if (G.screen !== 'join') return;
  if (/^[a-zA-Z]$/.test(e.key) && G.joinCode.length < 4)
    G.joinCode += e.key.toUpperCase();
  if (e.key === 'Backspace') G.joinCode = G.joinCode.slice(0, -1);
});

// ---------- net glue ----------
function wireNet() {
  Net.onOpen = () => { toSelect(); };
  Net.onClose = () => {
    G.screen = 'menu';
    G.notice = 'CONNECTION LOST';
    Snd.playMusic('menu');
  };
  Net.on(m => {
    if (m.t === 'hello') {
      G.oppHello = m;
      maybeStartBattle();
    }
  });
}

function toSelect() {
  G.screen = 'select';
  G.selIdx = 0;
  G.loadout = [];
  G.myHelloSent = false;
  G.oppHello = null;
}

function maybeStartBattle() {
  if (!G.myHelloSent || !G.oppHello) return;
  G.oppChar = G.oppHello.char;
  G.oppItems = G.oppHello.items || [];
  Battle.init({ myChar: G.myChar, oppChar: G.oppChar,
                myItems: G.myItems, oppItems: G.oppItems });
  G.screen = 'battle';
}

// ---------- update ----------
function update() {
  G.f++;
  switch (G.screen) {
    case 'title':
      if (Input.hit.ok) { G.screen = 'menu'; G.menuIdx = 0; Snd.play('select'); }
      break;
    case 'menu': {
      const n = 4;   // host / join / practice / volume
      if (Input.hit.up) { G.menuIdx = (G.menuIdx + n - 1) % n; Snd.play('menumove'); }
      if (Input.hit.down) { G.menuIdx = (G.menuIdx + 1) % n; Snd.play('menumove'); }
      if (G.menuIdx === 3) {
        if (Input.hit.left) { Snd.setMaster(Snd.master - 0.1); Snd.play('menumove'); }
        if (Input.hit.right) { Snd.setMaster(Snd.master + 0.1); Snd.play('menumove'); }
      }
      if (Input.hit.ok && G.menuIdx < 3) {
        Snd.play('select');
        G.notice = '';
        if (G.menuIdx === 0) { Net.host(); wireNet(); G.screen = 'host'; }
        else if (G.menuIdx === 1) { G.joinCode = ''; G.screen = 'join'; }
        else { Net.startPractice(); wireNet(); toSelect(); }
      }
      break;
    }
    case 'host':
      if (Input.hit.cancel) { Net.reset(); G.screen = 'menu'; }
      break;
    case 'join':
      if (Input.hit.cancel) { Net.reset(); G.screen = 'menu'; }
      if (Input.hit.ok && G.joinCode.length === 4 && !Net.peer) {
        Net.join(G.joinCode); wireNet();
      }
      break;
    case 'select': {
      if (Input.hit.left) { G.selIdx = (G.selIdx + CHAR_IDS.length - 1) % CHAR_IDS.length; Snd.play('menumove'); }
      if (Input.hit.right) { G.selIdx = (G.selIdx + 1) % CHAR_IDS.length; Snd.play('menumove'); }
      if (Input.hit.ok) {
        Snd.play('select');
        G.myChar = CHAR_IDS[G.selIdx];
        G.screen = 'loadout';
        G.loadout = []; G.loadIdx = 0;
      }
      break;
    }
    case 'loadout': {
      const rows = ITEM_IDS.length + 1;  // + DONE
      if (Input.hit.up) { G.loadIdx = (G.loadIdx + rows - 1) % rows; Snd.play('menumove'); }
      if (Input.hit.down) { G.loadIdx = (G.loadIdx + 1) % rows; Snd.play('menumove'); }
      if (Input.hit.cancel) {
        Snd.play('menumove');
        if (G.loadout.length) G.loadout.pop();
        else G.screen = 'select';
      }
      if (Input.hit.ok) {
        if (G.loadIdx < ITEM_IDS.length) {
          if (G.loadout.length < LOADOUT_SIZE) { G.loadout.push(ITEM_IDS[G.loadIdx]); Snd.play('select'); }
          else Snd.play('cantselect');
        } else {
          Snd.play('shineselect' in A.manifest.sfx ? 'shineselect' : 'select');
          G.myItems = G.loadout.slice();
          G.myHelloSent = true;
          Net.send({ t: 'hello', name: CHARS[G.myChar].name, char: G.myChar, items: G.myItems });
          Net.send({ t: 'ready' });
          G.screen = 'waiting';
          maybeStartBattle();
        }
      }
      break;
    }
    case 'waiting':
      maybeStartBattle();
      break;
    case 'battle':
      Battle.update();
      break;
  }
  Input.flush();
}

// ---------- render ----------
function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 640, 480);
  switch (G.screen) {
    case 'boot':
      drawText(ctx, 'main', 'LOADING...', 320, 230, { color: '#fff', align: 'center' });
      break;
    case 'title': renderTitle(); break;
    case 'menu': renderMenu(); break;
    case 'host': renderHost(); break;
    case 'join': renderJoin(); break;
    case 'select': renderSelect(); break;
    case 'loadout': renderLoadout(); break;
    case 'waiting':
      renderVs();
      drawText(ctx, 'main', 'Waiting for opponent...', 320, 420, { color: '#aaa', align: 'center' });
      break;
    case 'battle': Battle.render(ctx); break;
  }
}

function renderTitle() {
  const bg = A.bgFrame(G.f);
  if (bg && bg.width) { ctx.globalAlpha = 0.4; ctx.drawImage(bg, 0, 0, 640, 480); ctx.globalAlpha = 1; }
  drawText(ctx, 'big', 'DELTAVERSUS', 320, 130, { color: '#fff', align: 'center', scale: 1.4 });
  drawText(ctx, 'main', 'A DELTARUNE FAN GAME - 1V1', 320, 200, { color: '#888', align: 'center' });
  drawSpr(ctx, A.ui('soul'), 320, 265, { scale: 2 });
  if (G.f % 60 < 40)
    drawText(ctx, 'main', 'PRESS [Z] OR [ENTER]', 320, 320, { color: '#ff0', align: 'center' });
  drawText(ctx, 'main', 'ARROWS/WASD MOVE - Z CONFIRM - X CANCEL', 320, 430, { color: '#555', align: 'center' });
}

function renderMenu() {
  drawText(ctx, 'big', 'DELTAVERSUS', 320, 70, { color: '#fff', align: 'center', scale: 0.9 });
  const items = ['HOST GAME', 'JOIN GAME', 'PRACTICE (VS DUMMY)', 'VOLUME'];
  items.forEach((s, i) => {
    const sel = i === G.menuIdx;
    if (sel) drawSpr(ctx, A.ui('soul'), 210, 208 + i * 44, { scale: 1 });
    drawText(ctx, 'main', s, 232, 200 + i * 44, { color: sel ? '#ff0' : '#fff', scale: 1 });
  });
  // volume slider
  const vy = 200 + 3 * 44 + 4;
  ctx.fillStyle = '#333'; ctx.fillRect(340, vy, 120, 10);
  ctx.fillStyle = G.menuIdx === 3 ? '#ff0' : '#888';
  ctx.fillRect(340, vy, Math.round(120 * Snd.master), 10);
  drawText(ctx, 'main', Math.round(Snd.master * 100) + '%', 472, vy - 4,
           { color: Snd.muted ? '#f44' : '#aaa' });
  if (Snd.muted) drawText(ctx, 'main', 'MUTED (M)', 340, vy + 16, { color: '#f44' });
  drawText(ctx, 'main', 'M MUTE  +/- VOLUME', 320, 440, { color: '#555', align: 'center' });
  if (G.notice)
    drawText(ctx, 'main', G.notice, 320, 408, { color: '#f44', align: 'center' });
}

function renderHost() {
  drawText(ctx, 'main', 'ROOM CODE', 320, 130, { color: '#888', align: 'center' });
  drawText(ctx, 'big', Net.code || '....', 320, 170, { color: '#ff0', align: 'center', scale: 1.5 });
  drawText(ctx, 'main', Net.status, 320, 280, { color: '#fff', align: 'center' });
  drawText(ctx, 'main', 'Send this code to your challenger!', 320, 320, { color: '#888', align: 'center' });
  drawText(ctx, 'main', '[X] CANCEL', 320, 430, { color: '#555', align: 'center' });
}

function renderJoin() {
  drawText(ctx, 'main', 'ENTER ROOM CODE', 320, 150, { color: '#888', align: 'center' });
  let disp = '';
  for (let i = 0; i < 4; i++) disp += (G.joinCode[i] || '_') + ' ';
  drawText(ctx, 'big', disp.trim(), 320, 190, { color: '#ff0', align: 'center' });
  drawText(ctx, 'main', Net.status, 320, 290, { color: '#fff', align: 'center' });
  drawText(ctx, 'main', 'Type letters, then [Z] to connect', 320, 330, { color: '#888', align: 'center' });
  drawText(ctx, 'main', '[X] BACK', 320, 430, { color: '#555', align: 'center' });
}

function renderSelect() {
  drawText(ctx, 'main', 'CHOOSE YOUR FIGHTER', 320, 30, { color: '#fff', align: 'center' });
  CHAR_IDS.forEach((id, i) => {
    const x = 96 + i * 112, y = 120;
    const c = CHARS[id];
    const sel = i === G.selIdx;
    if (sel) {
      ctx.strokeStyle = c.color; ctx.lineWidth = 2;
      ctx.strokeRect(x - 44, y - 52, 88, 104);
    }
    const frames = A.chrFrames(id, 'idle');
    const im = frames[Math.floor(G.f / 14) % frames.length];
    drawSpr(ctx, im, x, y, { scale: sel ? 2 : 1.6, alpha: sel ? 1 : 0.6 });
    drawText(ctx, 'main', c.name, x, y + 62, { color: sel ? c.color : '#777', align: 'center' });
  });
  const c = CHARS[CHAR_IDS[G.selIdx]];
  drawText(ctx, 'main', 'HP ' + c.hp, 320, 220, { color: '#ff0', align: 'center' });
  c.desc.split('\n').forEach((l, i) =>
    drawText(ctx, 'main', l, 320, 250 + i * 20, { color: '#aaa', align: 'center' }));
  const kit = ['FIGHT: ' + c.fight.name]
    .concat(c.spells.map(s => s.name + ' (' + s.tp + '%)'))
    .concat([c.ult.name + ' (100%)', 'ACT: ' + c.act.name]);
  kit.forEach((l, i) =>
    drawText(ctx, 'main', l, 320, 310 + i * 20, { color: '#6cf', align: 'center' }));
  drawText(ctx, 'main', '[Z] SELECT', 320, 448, { color: '#ff0', align: 'center' });
}

function renderLoadout() {
  drawText(ctx, 'main', 'PICK ' + LOADOUT_SIZE + ' ITEMS', 320, 40, { color: '#fff', align: 'center' });
  ITEM_IDS.forEach((id, i) => {
    const sel = G.loadIdx === i;
    const it = ITEMS[id];
    drawText(ctx, 'main', (sel ? '> ' : '  ') + it.name, 180, 110 + i * 34,
             { color: sel ? '#ff0' : '#fff' });
    drawText(ctx, 'main', it.desc, 460, 110 + i * 34, { color: '#888', align: 'right' });
  });
  const doneSel = G.loadIdx === ITEM_IDS.length;
  drawText(ctx, 'main', (doneSel ? '> ' : '  ') + 'DONE', 180, 110 + ITEM_IDS.length * 34 + 16,
           { color: doneSel ? '#0f0' : '#8f8' });
  drawText(ctx, 'main', 'BAG: ' + (G.loadout.map(x => ITEMS[x].name).join(', ') || '(empty)'),
           320, 380, { color: '#fc0', align: 'center' });
  drawText(ctx, 'main', '[Z] ADD  [X] REMOVE/BACK', 320, 430, { color: '#555', align: 'center' });
}

function renderVs() {
  if (!G.myChar) return;
  const my = A.chrFrames(G.myChar, 'idle')[0];
  drawSpr(ctx, my, 200, 220, { scale: 2.4 });
  drawText(ctx, 'main', CHARS[G.myChar].name, 200, 300, { color: CHARS[G.myChar].color, align: 'center' });
  drawText(ctx, 'big', 'VS', 320, 200, { color: '#f44', align: 'center' });
  if (G.oppHello) {
    const op = A.chrFrames(G.oppHello.char, 'idle')[0];
    drawSpr(ctx, op, 440, 220, { scale: 2.4, flip: true });
    drawText(ctx, 'main', CHARS[G.oppHello.char].name, 440, 300,
             { color: CHARS[G.oppHello.char].color, align: 'center' });
  } else {
    drawText(ctx, 'big', '?', 440, 200, { color: '#666', align: 'center' });
  }
}

// ---------- loop ----------
let last = 0, acc = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (!A.ready) return;
  const dt = Math.min(100, t - last);
  last = t;
  acc += dt;
  let steps = 0;
  while (acc >= 1000 / 60 && steps < 4) {
    update();
    acc -= 1000 / 60;
    steps++;
  }
  render();
}

A.load(() => { G.screen = 'title'; Snd.playMusic('menu'); });
requestAnimationFrame(frame);

// rAF stops in background tabs and setInterval gets throttled to ~1Hz,
// so a hidden tab would stall the match (e.g. alt-tabbing to Discord).
// Web Worker timers are exempt from throttling — use one as the ticker.
try {
  const src = URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),16)'],
                                           { type: 'text/javascript' }));
  const ticker = new Worker(src);
  ticker.onmessage = () => { if (document.hidden && A.ready) update(); };
} catch (e) {
  setInterval(() => { if (document.hidden && A.ready) update(); }, 1000 / 60);
}
