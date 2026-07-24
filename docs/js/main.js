// Screens + game loop. G = global game state outside battle.
const G = {
  screen: 'boot',
  menuIdx: 0,
  joinCode: '',
  selIdx: 0,
  loadout: [], loadIdx: 0,
  partySize: 1,
  dummySkill: 0.5,
  myTeamSel: [], dummyTeamSel: [], teamPhase: 'mine',
  myCharSel: null, myItems: null,
  oppItems: null,
  myHelloSent: false, oppHello: null,
  notice: '',
  f: 0,
};
const CHAR_IDS = ['kris', 'susie', 'ralsei', 'noelle', 'lancer', 'berdly', 'jevil', 'spamton', 'knight', 'gerson', 'pink'];
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
  if (G.screen === 'ccname') { Creator.nameKey(e); return; }
  if (G.screen !== 'join') return;
  if (/^[a-zA-Z]$/.test(e.key) && G.joinCode.length < 4)
    G.joinCode += e.key.toUpperCase();
  if (e.key === 'Backspace') G.joinCode = G.joinCode.slice(0, -1);
});

// ---------- net glue ----------
function wireNet() {
  Net.onOpen = () => {
    if (Net.isHost) { Net.send({ t: 'config', size: G.partySize }); startTeamSelect('mine'); }
    else G.screen = 'waitcfg';           // wait for host's party size
  };
  Net.onClose = () => {
    G.screen = 'menu';
    G.notice = 'CONNECTION LOST';
    Snd.playMusic('menu');
  };
  Net.on(m => {
    if (m.t === 'config') { G.partySize = m.size; if (G.screen === 'waitcfg') startTeamSelect('mine'); }
    if (m.t === 'hello') { G.oppHello = m; maybeStartBattle(); }
  });
}

function startTeamSelect(phase) {
  G.teamPhase = phase;
  G.screen = 'select';
  G.selIdx = 0;
  if (phase === 'mine') { G.myTeamSel = []; G.myHelloSent = false; G.oppHello = null; }
  else G.dummyTeamSel = [];
}
function curTeam() { return G.teamPhase === 'mine' ? G.myTeamSel : G.dummyTeamSel; }
function teamCost(team) { return team.reduce((s, sel) => s + (typeof sel === 'string' ? CHARS[sel].cost : 1), 0); }
function teamRemaining() { return G.partySize - teamCost(curTeam()); }

function finishTeam() {
  if (!curTeam().length) { Snd.play('cantselect'); return; }
  Snd.play('shineselect' in A.manifest.sfx ? 'shineselect' : 'select');
  if (G.teamPhase === 'mine' && Net.practice) { startTeamSelect('dummy'); return; }
  G.screen = 'loadout'; G.loadout = []; G.loadIdx = 0;
}

function maybeStartBattle() {
  if (!G.myHelloSent || !G.oppHello) return;
  G.oppItems = G.oppHello.items || [];
  Battle.init({ myTeam: G.myTeamSel, oppTeam: G.oppHello.team || [G.oppHello.char],
                size: G.partySize, myItems: G.myItems, oppItems: G.oppItems });
  G.screen = 'battle';
}

// ---------- update ----------
function update() {
  G.f++;
  Input.textMode = (G.screen === 'join');   // typing a room code: letters, not OK/CANCEL
  switch (G.screen) {
    case 'title':
      if (Input.hit.ok) { G.screen = 'menu'; G.menuIdx = 0; Snd.play('select'); }
      break;
    case 'menu': {
      const n = 6;   // host / join / practice / party size / dummy skill / volume
      if (Input.hit.up) { G.menuIdx = (G.menuIdx + n - 1) % n; Snd.play('menumove'); }
      if (Input.hit.down) { G.menuIdx = (G.menuIdx + 1) % n; Snd.play('menumove'); }
      if (G.menuIdx === 3) {   // PARTY SIZE
        if (Input.hit.left) { G.partySize = Math.max(1, G.partySize - 1); Snd.play('menumove'); }
        if (Input.hit.right) { G.partySize = Math.min(3, G.partySize + 1); Snd.play('menumove'); }
      }
      if (G.menuIdx === 4) {   // DUMMY SKILL
        if (Input.hit.left) { G.dummySkill = Math.max(0, Math.round((G.dummySkill - 0.1) * 10) / 10); Snd.play('menumove'); }
        if (Input.hit.right) { G.dummySkill = Math.min(1, Math.round((G.dummySkill + 0.1) * 10) / 10); Snd.play('menumove'); }
      }
      if (G.menuIdx === 5) {   // VOLUME
        if (Input.hit.left) { Snd.setMaster(Snd.master - 0.1); Snd.play('menumove'); }
        if (Input.hit.right) { Snd.setMaster(Snd.master + 0.1); Snd.play('menumove'); }
      }
      if (Input.hit.ok && G.menuIdx < 3) {
        Snd.play('select');
        G.notice = '';
        if (G.menuIdx === 0) { Net.host(); wireNet(); G.screen = 'host'; }
        else if (G.menuIdx === 1) { G.joinCode = ''; G.screen = 'join'; }
        else { Net.startPractice(); wireNet(); startTeamSelect('mine'); }
      }
      break;
    }
    case 'host':
      if (Input.hit.cancel) { Net.reset(); G.screen = 'menu'; }
      if (Input.hit.left) { G.partySize = Math.max(1, G.partySize - 1); Snd.play('menumove'); }
      if (Input.hit.right) { G.partySize = Math.min(3, G.partySize + 1); Snd.play('menumove'); }
      break;
    case 'waitcfg': break;
    case 'join':
      if (Input.hit.cancel) { Net.reset(); G.screen = 'menu'; }
      if (Input.hit.ok && G.joinCode.length === 4 && !Net.peer) {
        Net.join(G.joinCode); wireNet();
      }
      break;
    case 'select': {
      const nTiles = CHAR_IDS.length + 1;   // chars + DONE (CREATE temporarily disabled)
      if (Input.hit.left) { G.selIdx = (G.selIdx + nTiles - 1) % nTiles; Snd.play('menumove'); }
      if (Input.hit.right) { G.selIdx = (G.selIdx + 1) % nTiles; Snd.play('menumove'); }
      if (Input.hit.cancel) {
        if (curTeam().length) { curTeam().pop(); Snd.play('menumove'); }
        else if (!Net.practice && Net.conn) { /* stay */ }
        else { Snd.play('menumove'); Net.reset(); G.screen = 'menu'; }
      }
      if (Input.hit.ok) {
        if (G.selIdx < CHAR_IDS.length) {
          const id = CHAR_IDS[G.selIdx], cost = CHARS[id].cost;
          if (cost <= teamRemaining()) {
            curTeam().push(id); Snd.play('select');
            if (teamRemaining() <= 0) finishTeam();
          } else Snd.play('cantselect');
        } else { finishTeam(); }   // DONE tile (CREATE temporarily disabled)
      }
      break;
    }
    case 'creator': Creator.update(); break;
    case 'ccatk': Creator.updAtk(); break;
    case 'ccname': break;
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
          Net.send({ t: 'hello', team: G.myTeamSel, items: G.myItems, size: G.partySize });
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
  if (Net.practice && PracticeAI.dodge) PracticeAI.tick();   // drive dummy dodge
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
    case 'waitcfg': renderWaitcfg(); break;
    case 'join': renderJoin(); break;
    case 'select': renderSelect(); break;
    case 'creator': Creator.render(ctx); break;
    case 'ccatk': Creator.renderAtk(ctx); break;
    case 'ccname': Creator.renderName(ctx); break;
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
  drawText(ctx, 'big', 'DELTAVERSUS', 320, 60, { color: '#fff', align: 'center', scale: 0.9 });
  const items = ['HOST GAME', 'JOIN GAME', 'PRACTICE (VS DUMMY)', 'PARTY SIZE', 'DUMMY SKILL', 'VOLUME'];
  const rowY = i => 150 + i * 36;
  items.forEach((s, i) => {
    const sel = i === G.menuIdx;
    if (sel) drawSpr(ctx, A.ui('soul'), 150, rowY(i) + 8, { scale: 1 });
    drawText(ctx, 'main', s, 170, rowY(i), { color: sel ? '#ff0' : '#fff' });
  });
  // party size: < N >
  const py = rowY(3);
  drawText(ctx, 'main', '<  ' + G.partySize + '  >', 360, py, { color: G.menuIdx === 3 ? '#ff0' : '#aaa' });
  drawText(ctx, 'main', G.partySize === 1 ? '(1v1)' : 'PER TEAM', 452, py, { color: '#666' });
  // dummy skill slider
  const sy = rowY(4) + 4;
  ctx.fillStyle = '#333'; ctx.fillRect(360, sy, 110, 10);
  ctx.fillStyle = G.menuIdx === 4 ? '#ff0' : '#888';
  ctx.fillRect(360, sy, Math.round(110 * G.dummySkill), 10);
  drawText(ctx, 'main', Math.round(G.dummySkill * 100) + '%', 480, sy - 4, { color: '#aaa' });
  // volume slider
  const vy = rowY(5) + 4;
  ctx.fillStyle = '#333'; ctx.fillRect(360, vy, 110, 10);
  ctx.fillStyle = G.menuIdx === 5 ? '#ff0' : '#888';
  ctx.fillRect(360, vy, Math.round(110 * Snd.master), 10);
  drawText(ctx, 'main', Math.round(Snd.master * 100) + '%', 480, vy - 4, { color: Snd.muted ? '#f44' : '#aaa' });
  drawText(ctx, 'main', 'M MUTE  -  ARROWS ADJUST', 320, 452, { color: '#555', align: 'center' });
  if (G.notice) drawText(ctx, 'main', G.notice, 320, 420, { color: '#f44', align: 'center' });
}

function renderHost() {
  drawText(ctx, 'main', 'ROOM CODE', 320, 120, { color: '#888', align: 'center' });
  drawText(ctx, 'big', Net.code || '....', 320, 160, { color: '#ff0', align: 'center', scale: 1.5 });
  drawText(ctx, 'main', 'PARTY SIZE  <  ' + G.partySize + '  >', 320, 250, { color: '#ff0', align: 'center' });
  drawText(ctx, 'main', Net.status, 320, 300, { color: '#fff', align: 'center' });
  drawText(ctx, 'main', 'Send this code to your challenger!', 320, 336, { color: '#888', align: 'center' });
  drawText(ctx, 'main', 'ARROWS SET SIZE  -  [X] CANCEL', 320, 430, { color: '#555', align: 'center' });
}
function renderWaitcfg() {
  drawText(ctx, 'main', Net.status, 320, 220, { color: '#fff', align: 'center' });
  drawText(ctx, 'main', 'Waiting for host settings...', 320, 256, { color: '#888', align: 'center' });
}

function renderJoin() {
  drawText(ctx, 'main', 'ENTER ROOM CODE', 320, 150, { color: '#888', align: 'center' });
  let disp = '';
  for (let i = 0; i < 4; i++) disp += (G.joinCode[i] || '_') + ' ';
  drawText(ctx, 'big', disp.trim(), 320, 190, { color: '#ff0', align: 'center' });
  drawText(ctx, 'main', Net.status, 320, 290, { color: '#fff', align: 'center' });
  drawText(ctx, 'main', 'Type the 4 letters, then [ENTER] to connect', 320, 330, { color: '#888', align: 'center' });
  drawText(ctx, 'main', '[BKSP] edit   [ESC] back', 320, 430, { color: '#555', align: 'center' });
}

function renderSelect() {
  const solo = G.partySize === 1;
  const header = G.teamPhase === 'dummy' ? 'PICK THE DUMMY TEAM'
               : solo ? 'CHOOSE YOUR FIGHTER' : 'BUILD YOUR TEAM';
  drawText(ctx, 'main', header, 320, 20, { color: G.teamPhase === 'dummy' ? '#f88' : '#fff', align: 'center' });
  if (!solo) drawText(ctx, 'main', 'BUDGET ' + teamCost(curTeam()) + ' / ' + G.partySize, 320, 40, { color: '#ff8000', align: 'center' });

  const nTiles = CHAR_IDS.length + 1;   // chars + DONE (CREATE temporarily disabled)
  const sp = Math.min(84, 600 / nTiles);
  const startX = 320 - (nTiles - 1) * sp / 2, y = 108;
  const hw = Math.min(40, sp * 0.46);
  const rem = teamRemaining();
  CHAR_IDS.forEach((id, i) => {
    const x = startX + i * sp, c = CHARS[id], sel = i === G.selIdx;
    const afford = c.cost <= rem;
    if (sel) { ctx.strokeStyle = c.color; ctx.lineWidth = 2; ctx.strokeRect(x - hw, y - 48, hw * 2, 96); }
    const im = A.animFrame(A.anim(id, 'idle'), G.f * (1000 / 60), true);
    drawSpr(ctx, im, x, y, { scale: sel ? 0.85 : 0.65, alpha: sel ? (afford ? 1 : 0.5) : (afford ? 0.6 : 0.3), flip: !!ENEMY_FACING[id] });
    drawText(ctx, 'main', c.name, x, y + 54, { color: sel ? c.color : '#777', align: 'center' });
    if (c.cost > 1) drawText(ctx, 'main', 'x' + c.cost, x + hw - 12, y - 46, { color: afford ? '#f80' : '#844', align: 'center' });
  });
  { const x = startX + CHAR_IDS.length * sp, sel = G.selIdx === CHAR_IDS.length;   // DONE (CREATE temporarily disabled)
    if (sel) { ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2; ctx.strokeRect(x - hw, y - 48, hw * 2, 96); }
    drawSpr(ctx, A.ui('soul'), x, y - 10, { scale: 1 });
    drawText(ctx, 'main', 'DONE', x, y + 54, { color: sel ? '#0f0' : (curTeam().length ? '#8f8' : '#555'), align: 'center' });
  }

  // info for the highlighted fighter
  if (G.selIdx < CHAR_IDS.length) {
    const c = CHARS[CHAR_IDS[G.selIdx]];
    drawText(ctx, 'main', c.name + '   HP ' + c.hp + (c.darkner ? '   (DARKNER)' : ''), 320, 188, { color: c.color, align: 'center' });
    c.desc.split('\n').forEach((l, i) => drawText(ctx, 'main', l, 320, 210 + i * 18, { color: '#aaa', align: 'center' }));
    const kit = ['FIGHT: ' + c.fight.name].concat(c.spells.map(s => s.name + ' (' + s.tp + '%)')).concat([c.ult.name + ' (100%)']);
    kit.forEach((l, i) => drawText(ctx, 'main', l, 320, 258 + i * 18, { color: '#6cf', align: 'center' }));
  }

  // current team roster
  const team = curTeam();
  drawText(ctx, 'main', G.teamPhase === 'dummy' ? 'DUMMY:' : 'TEAM:', 150, 356, { color: '#fc0' });
  team.forEach((sel, i) => {
    const d = charDef(sel);
    let head = A.ui('head_' + d.base); if (d.hue) head = A.hued(head, d.hue);
    drawSpr(ctx, head, 210 + i * 60, 362, { scale: 1 });
    drawText(ctx, 'main', d.name.slice(0, 6), 210 + i * 60, 380, { color: d.color, align: 'center' });
  });
  if (!team.length) drawText(ctx, 'main', '(empty)', 210, 356, { color: '#555' });

  drawText(ctx, 'main', solo ? '[Z] PICK  [X] BACK' : '[Z] ADD/DONE   [X] REMOVE', 320, 448, { color: '#555', align: 'center' });
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
  if (!G.myTeamSel || !G.myTeamSel.length) return;
  drawText(ctx, 'big', 'VS', 320, 200, { color: '#f44', align: 'center' });
  G.myTeamSel.forEach((sel, i) => {
    const d = charDef(sel), n = G.myTeamSel.length;
    let im = A.animFrame(A.anim(d.base, 'idle'), G.f * (1000 / 60), true);
    if (d.hue) im = A.hued(im, d.hue);
    const y = 220 + (i - (n - 1) / 2) * 70;
    drawSpr(ctx, im, 190, y, { scale: 1.1, flip: !!ENEMY_FACING[d.base] });
    drawText(ctx, 'main', d.name, 190, y + 40, { color: d.color, align: 'center' });
  });
  const oppTeam = G.oppHello && G.oppHello.team;
  if (oppTeam) {
    oppTeam.forEach((sel, i) => {
      const d = charDef(sel), n = oppTeam.length;
      let im = A.animFrame(A.anim(d.base, 'idle'), G.f * (1000 / 60), true);
      if (d.hue) im = A.hued(im, d.hue);
      const y = 220 + (i - (n - 1) / 2) * 70;
      drawSpr(ctx, im, 450, y, { scale: 1.1, flip: !ENEMY_FACING[d.base] });
      drawText(ctx, 'main', d.name, 450, y + 40, { color: d.color, align: 'center' });
    });
  } else {
    drawText(ctx, 'big', '?', 450, 200, { color: '#666', align: 'center' });
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
