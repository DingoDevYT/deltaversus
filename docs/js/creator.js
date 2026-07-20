// Custom character creator: base model + hue + stats, and a skill-point
// attack builder where each attack is a stack of composable emitters.
const Creator = {};

const CC_DEFAULT = {
  v: 2, name: 'HERO', base: 'kris', hue: 40, arch: 'balanced', atk: 20, weapon: 'sword',
  fight: { name: 'SLASH', emitters: [{ preset: 'sweep', bullet: 'sword', speed: 'normal', qty: 'low' }] },
  spells: [
    { name: 'FIREBALL', tp: 32, mode: 'attack',
      emitters: [{ preset: 'fan', bullet: 'flame', speed: 'normal', qty: 'med' }] },
    { name: 'MEND', tp: 32, mode: 'heal', emitters: [] },
  ],
  ult: { name: 'OVERDRIVE',
         emitters: [{ preset: 'spiral', bullet: 'orb_l', speed: 'heavy', qty: 'med' }] },
  act: 'taunt', theme: 'big_shot_spamton_neo',
};

const CC_ROWS = ['base', 'color', 'name', 'style', 'atkmag', 'weapon',
                 'fight', 'spell0', 'spell1', 'ult', 'act', 'theme', 'done'];

Creator.open = function () {
  let cc;
  try { cc = JSON.parse(localStorage.getItem('dv_custom1')); } catch (e) { cc = null; }
  if (!cc || cc.v !== 2) cc = JSON.parse(JSON.stringify(CC_DEFAULT));
  G.cc = cc;
  G.ccRow = 0;
  G.screen = 'creator';
};

Creator.saveDraft = function () {
  try { localStorage.setItem('dv_custom1', JSON.stringify(G.cc)); } catch (e) {}
};

function cyc(list, cur, dir) {
  const i = list.indexOf(cur);
  return list[(i + dir + list.length) % list.length];
}
function atkObj(slot) {
  return slot === 'fight' ? G.cc.fight : slot === 'ult' ? G.cc.ult : G.cc.spells[slot];
}
function atkRows(slot) {
  const atk = atkObj(slot);
  const isSpell = (slot === 0 || slot === 1);
  const mode = isSpell ? (atk.mode || 'attack') : 'attack';
  const rows = [{ t: 'name' }];
  if (isSpell) rows.push({ t: 'mode' });
  if (mode === 'attack') {
    if (isSpell) rows.push({ t: 'tp' });
    (atk.emitters || []).forEach((em, i) => rows.push({ t: 'em', i }));
    rows.push({ t: 'add' });
  }
  rows.push({ t: 'done' });
  return rows;
}

// ---------- main creator ----------
Creator.update = function () {
  const cc = G.cc;
  const row = CC_ROWS[G.ccRow];
  if (Input.hit.up) { G.ccRow = (G.ccRow + CC_ROWS.length - 1) % CC_ROWS.length; Snd.play('menumove'); }
  if (Input.hit.down) { G.ccRow = (G.ccRow + 1) % CC_ROWS.length; Snd.play('menumove'); }
  if (Input.hit.cancel) { Snd.play('menumove'); Snd.playMusic('menu'); Creator.saveDraft(); G.screen = 'select'; return; }

  const dir = Input.hit.right ? 1 : Input.hit.left ? -1 : 0;
  if (dir) {
    Snd.play('menumove');
    if (row === 'base') cc.base = cyc(CHAR_IDS, cc.base, dir);
    else if (row === 'color') cc.hue = ((cc.hue + dir * 20) + 360) % 360;
    else if (row === 'style') {
      cc.arch = cyc(ARCH_IDS, cc.arch, dir);
      const pool = ARCHETYPES[cc.arch].pool;
      cc.atk = Math.max(4, Math.min(pool - 4, cc.atk));
    } else if (row === 'atkmag') {
      const pool = ARCHETYPES[cc.arch].pool;
      cc.atk = Math.max(4, Math.min(pool - 4, cc.atk + dir * 2));
    } else if (row === 'weapon') {
      cc.weapon = cyc(WEAPON_IDS, cc.weapon, dir);
      const w = WEAPONS[cc.weapon];
      cc.fight.emitters = [{ preset: w.preset, bullet: w.bullet, speed: 'normal', qty: 'low' }];
    } else if (row === 'act') cc.act = cyc(ACT_IDS, cc.act, dir);
    else if (row === 'theme') {
      cc.theme = cyc(THEMES.map(t => t.key), cc.theme, dir);
      Snd.playMusic(cc.theme);
    }
  }
  if (Input.hit.ok) {
    if (row === 'name') Creator.openName(cc, 'name', 8, 'creator');
    else if (row === 'fight') Creator.openAtk('fight');
    else if (row === 'spell0') Creator.openAtk(0);
    else if (row === 'spell1') Creator.openAtk(1);
    else if (row === 'ult') Creator.openAtk('ult');
    else if (row === 'done') {
      if (!cc.name.trim()) { Snd.play('cantselect'); return; }
      Snd.play('shineselect');
      Creator.saveDraft();
      G.myCharSel = JSON.parse(JSON.stringify(cc));
      Snd.playMusic('menu');
      G.screen = 'loadout';
      G.loadout = []; G.loadIdx = 0;
    }
  }
};

// ---------- attack editor ----------
Creator.openAtk = function (slot) {
  Snd.play('select');
  G.ccAtk = { slot, cursor: 0, editEm: null, erow: 0 };
  G.ccSim = null;
  G.screen = 'ccatk';
};

Creator.updAtk = function () {
  const cc = G.cc, s = G.ccAtk, atk = atkObj(s.slot);
  const isSpell = (s.slot === 0 || s.slot === 1);
  if (s.editEm != null) { Creator.updEmit(); return; }

  const rows = atkRows(s.slot);
  s.cursor = Math.min(s.cursor, rows.length - 1);
  const n = rows.length;
  if (Input.hit.up) { s.cursor = (s.cursor + n - 1) % n; Snd.play('menumove'); }
  if (Input.hit.down) { s.cursor = (s.cursor + 1) % n; Snd.play('menumove'); }
  if (Input.hit.cancel) { Snd.play('menumove'); Creator.saveDraft(); G.screen = 'creator'; return; }

  const row = rows[s.cursor];
  const dir = Input.hit.right ? 1 : Input.hit.left ? -1 : 0;
  if (dir && row.t === 'mode') {
    Snd.play('menumove');
    atk.mode = cyc(SPELL_MODES, atk.mode || 'attack', dir);
    if (atk.mode === 'attack' && (!atk.emitters || !atk.emitters.length))
      atk.emitters = [defEmitter(cc)];
    s.cursor = 0; G.ccSim = null;
  } else if (dir && row.t === 'tp') {
    Snd.play('menumove');
    atk.tp = clampTP((atk.tp || 32) + dir * TP_STEP);
  }
  if (Input.hit.ok) {
    if (row.t === 'name') Creator.openName(atk, 'name', 12, 'ccatk');
    else if (row.t === 'em') { s.editEm = row.i; s.erow = 0; Snd.play('select'); }
    else if (row.t === 'add') {
      const budget = slotBudget(s.slot, cc);
      const e = defEmitter(cc);
      if (attackCost(atk.emitters) + emitterCost(e) <= budget) {
        atk.emitters.push(e); G.ccSim = null; Snd.play('select');
      } else Snd.play('cantselect');
    } else if (row.t === 'done') { Creator.saveDraft(); G.screen = 'creator'; Snd.play('select'); }
  }
};

const EROWS = ['preset', 'bullet', 'speed', 'qty', 'delete', 'back'];
Creator.updEmit = function () {
  const cc = G.cc, s = G.ccAtk, atk = atkObj(s.slot), em = atk.emitters[s.editEm];
  if (!em) { s.editEm = null; return; }
  const n = EROWS.length;
  if (Input.hit.up) { s.erow = (s.erow + n - 1) % n; Snd.play('menumove'); }
  if (Input.hit.down) { s.erow = (s.erow + 1) % n; Snd.play('menumove'); }
  if (Input.hit.cancel) { s.editEm = null; Snd.play('menumove'); return; }

  const dir = Input.hit.right ? 1 : Input.hit.left ? -1 : 0;
  if (dir && s.erow < 4) {
    const budget = slotBudget(s.slot, cc);
    const others = attackCost(atk.emitters) - emitterCost(em);
    const field = EROWS[s.erow];
    const list = field === 'preset' ? PRESET_IDS : field === 'bullet' ? CC_BULLETS
                 : field === 'speed' ? SPEED_IDS : QTY_IDS;
    const nv = cyc(list, em[field], dir);
    const trial = { ...em, [field]: nv };
    if (others + emitterCost(trial) <= budget) { em[field] = nv; G.ccSim = null; Snd.play('menumove'); }
    else Snd.play('cantselect');
  }
  if (Input.hit.ok) {
    if (s.erow === 4) {           // delete
      atk.emitters.splice(s.editEm, 1);
      s.editEm = null; G.ccSim = null; Snd.play('select');
    } else if (s.erow === 5) { s.editEm = null; Snd.play('select'); }  // back
  }
};

// ---------- name entry (fighter or attack) ----------
Creator.openName = function (obj, key, max, back) {
  Snd.play('select');
  G.nameEntry = { obj, key, max: max || 8, back: back || 'creator' };
  G.screen = 'ccname';
};
Creator.nameKey = function (e) {
  const ne = G.nameEntry;
  if (!ne) { G.screen = 'creator'; return; }
  if (/^[a-zA-Z0-9 ]$/.test(e.key) && ne.obj[ne.key].length < ne.max)
    ne.obj[ne.key] += e.key.toUpperCase();
  else if (e.key === 'Backspace') ne.obj[ne.key] = ne.obj[ne.key].slice(0, -1);
  else if (e.key === 'Enter' || e.key === 'Escape') {
    Snd.play('select');
    G.screen = ne.back;
    Input.down = {}; Input.hit = {};   // stop this keypress bleeding into the next screen
  }
};

// ---------- preview sim ----------
Creator.previewSim = function (box) {
  const s = G.ccAtk, atk = atkObj(s.slot);
  const isSpell = (s.slot === 0 || s.slot === 1);
  const mode = isSpell ? (atk.mode || 'attack') : 'attack';
  if (mode !== 'attack') { G.ccSim = null; return null; }
  const sig = JSON.stringify(atk.emitters) + (s.slot === 'ult' ? '!' : '');
  if (!G.ccSim || G.ccSim.sig !== sig || G.ccSim.bw !== box.w) {
    const mk = () => makeDodgeSim({ base: G.cc.base },
      { custom: { emitters: atk.emitters, ult: s.slot === 'ult' }, dur: 480 }, 1, 1234567, box);
    G.ccSim = { sig, bw: box.w, sim: mk(), mk, bullets: [],
                soul: { x: box.w / 2, y: box.h * 0.7 }, vx: 0, vy: 0 };
  }
  const S = G.ccSim;
  S.vx += (Math.random() - 0.5) * 0.35; S.vy += (Math.random() - 0.5) * 0.35;
  S.vx *= 0.9; S.vy *= 0.9;
  S.soul.x = Math.min(box.w - 4, Math.max(4, S.soul.x + S.vx));
  S.soul.y = Math.min(box.h - 4, Math.max(4, S.soul.y + S.vy));
  if (S.sim.f >= S.sim.dur) { S.sim = S.mk(); S.bullets.length = 0; }
  S.sim.tick(S.soul, b => { b.t = 0; b.phase0 = Math.random() * 6.28; S.bullets.push(b); });
  for (const b of S.bullets) {
    b.t++;
    if (b.homing) {
      const d = Math.hypot(S.soul.x - b.x, S.soul.y - b.y) || 1;
      b.vx += (S.soul.x - b.x) / d * b.homing; b.vy += (S.soul.y - b.y) / d * b.homing;
    }
    b.vx += b.ax || 0; b.vy += b.ay || 0;
    if (b.maxv) { const v = Math.hypot(b.vx, b.vy); if (v > b.maxv) { b.vx *= b.maxv / v; b.vy *= b.maxv / v; } }
    b.x += b.vx; b.y += b.vy;
    if (b.sineA) b.y += Math.sin(b.t * (b.sineF || 0.05) * 6.28 + b.phase0) * b.sineA;
    if (b.spin) b.rot = (b.rot || 0) + b.spin;
  }
  S.bullets = S.bullets.filter(b => b.x > -40 && b.x < box.w + 40 && b.y > -40 && b.y < box.h + 40 && (!b.life || b.t < b.life));
  return S;
};

// ---------- render: main creator ----------
function fighterSprite(ctx, base, hue, x, y, scale) {
  let im = A.animFrame(A.anim(base, 'idle'), G.f * (1000 / 60), true);
  if (im && hue) im = A.hued(im, hue);
  drawSpr(ctx, im, x, y, { scale, flip: !!ENEMY_FACING[base] });
}
function atkSummary(atk, slot) {
  const isSpell = (slot === 0 || slot === 1);
  const mode = isSpell ? (atk.mode || 'attack') : 'attack';
  if (mode !== 'attack') return (atk.name || SUPPORTS[mode].name) + ' - ' + SUPPORTS[mode].name;
  const used = attackCost(atk.emitters), bud = slotBudget(slot, G.cc);
  const tp = slot === 'fight' ? 'free' : slot === 'ult' ? '100%' : (atk.tp || 32) + '%';
  return (atk.name || 'ATTACK') + '  ' + tp + '  [' + used + '/' + bud + ' SP]';
}

Creator.render = function (ctx) {
  const cc = G.cc, def = charDef(cc);
  drawText(ctx, 'main', 'CREATE YOUR SOUL', 320, 12, { color: '#fff', align: 'center' });

  fighterSprite(ctx, cc.base, cc.hue, 96, 120, 1.2);
  drawSpr(ctx, A.hued(A.ui('head_' + cc.base), cc.hue), 58, 196, { scale: 1 });
  drawText(ctx, 'main', cc.name || '?', 96, 208, { color: def.color, align: 'center' });
  drawText(ctx, 'main', 'HP ' + def.hp, 96, 230, { color: '#ff0', align: 'center' });
  drawText(ctx, 'main', 'ATK ' + def.atk, 96, 250, { color: '#f88', align: 'center' });
  drawText(ctx, 'main', 'MAG ' + def.mag, 96, 270, { color: '#8cf', align: 'center' });

  const themeName = (THEMES.find(t => t.key === cc.theme) || {}).name || '?';
  const pool = ARCHETYPES[cc.arch].pool;
  const rowsDef = [
    ['BASE', CHARS[cc.base].name],
    ['COLOR', ''],
    ['NAME', cc.name || '(none)'],
    ['CLASS', ARCHETYPES[cc.arch].name],
    ['ATK/MAG', 'ATK ' + def.atk + '  /  MAG ' + def.mag],
    ['WEAPON', WEAPONS[cc.weapon].name],
    ['FIGHT', atkSummary(cc.fight, 'fight')],
    ['SPELL 1', atkSummary(cc.spells[0], 0)],
    ['SPELL 2', atkSummary(cc.spells[1], 1)],
    ['ULTIMATE', atkSummary(cc.ult, 'ult')],
    ['ACT', ACTS[cc.act].name],
    ['THEME', themeName],
    ['', 'DONE - SAVE FIGHTER'],
  ];
  rowsDef.forEach(([label, val], i) => {
    const y = 40 + i * 27;
    const sel = G.ccRow === i;
    if (sel) drawSpr(ctx, A.ui('soul'), 198, y + 7, { scale: 1 });
    drawText(ctx, 'main', label, 214, y, { color: sel ? '#ff0' : '#999' });
    if (CC_ROWS[i] === 'color') {
      for (let hx = 0; hx < 18; hx++) { ctx.fillStyle = `hsl(${hx * 20},80%,55%)`; ctx.fillRect(316 + hx * 15, y + 2, 14, 12); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(316 + (cc.hue / 20) * 15, y, 15, 16);
    } else if (CC_ROWS[i] === 'atkmag') {
      const fr = def.atk / pool;
      ctx.fillStyle = '#8cf'; ctx.fillRect(316, y + 3, 150, 11);
      ctx.fillStyle = '#f88'; ctx.fillRect(316, y + 3, Math.round(150 * fr), 11);
      drawText(ctx, 'main', def.atk + '/' + def.mag, 476, y, { color: sel ? '#fff' : '#bbb' });
    } else {
      drawText(ctx, 'main', val, 316, y, { color: sel ? '#fff' : '#bbb' });
    }
  });
  drawText(ctx, 'main', 'ARROWS CHANGE  [Z] EDIT/OK  [X] BACK', 320, 452, { color: '#555', align: 'center' });
};

// ---------- render: attack editor ----------
Creator.renderAtk = function (ctx) {
  const cc = G.cc, s = G.ccAtk, atk = atkObj(s.slot);
  const isSpell = (s.slot === 0 || s.slot === 1);
  const mode = isSpell ? (atk.mode || 'attack') : 'attack';
  const title = s.slot === 'fight' ? 'FIGHT' : s.slot === 'ult' ? 'ULTIMATE' : 'SPELL ' + (s.slot + 1);
  drawText(ctx, 'main', 'BUILD: ' + title, 24, 16, { color: '#ff8000' });

  const budget = slotBudget(s.slot, cc), used = attackCost(atk.emitters);
  const rows = atkRows(s.slot);
  let y = 48;
  rows.forEach((row, i) => {
    const sel = s.cursor === i && s.editEm == null;
    let label = '', val = '';
    if (row.t === 'name') { label = 'NAME'; val = atk.name || '(none)'; }
    else if (row.t === 'mode') { label = 'MODE'; val = mode === 'attack' ? 'ATTACK' : SUPPORTS[mode].name; }
    else if (row.t === 'tp') { label = 'TP COST'; val = (atk.tp || 32) + '%  (' + budget + ' SP)'; }
    else if (row.t === 'em') {
      const em = atk.emitters[row.i];
      label = (row.i + 1) + '.';
      val = PRESETS[em.preset].name + ' ' + em.bullet + ' ' + SPEEDS[em.speed].name +
            ' x' + QTYS[em.qty].name + '  [' + emitterCost(em) + ']';
    } else if (row.t === 'add') { label = '+ ADD EMITTER'; }
    else if (row.t === 'done') { label = 'DONE'; }
    if (sel) drawSpr(ctx, A.ui('soul'), 18, y + 7, { scale: 1 });
    const col = row.t === 'done' ? (sel ? '#0f0' : '#8f8') : row.t === 'add' ? (sel ? '#ff0' : '#8cf') : (sel ? '#ff0' : '#999');
    drawText(ctx, 'main', label, 34, y, { color: col });
    if (val) drawText(ctx, 'main', val, row.t === 'em' ? 60 : 130, y, { color: sel ? '#fff' : '#bbb' });
    y += 26;
  });

  if (mode === 'attack') {
    // budget bar
    ctx.fillStyle = '#3a1a00'; ctx.fillRect(24, 420, 200, 14);
    ctx.fillStyle = used > budget ? '#f44' : '#ff8000';
    ctx.fillRect(24, 420, Math.round(200 * Math.min(1, used / budget)), 14);
    drawText(ctx, 'main', 'SKILL ' + used + ' / ' + budget, 26, 402, { color: '#ff8000' });
    // live preview
    const box = { x: 0, y: 0, w: 150, h: 130 };
    const px = 448, py = 70;
    drawText(ctx, 'main', 'PREVIEW', px + box.w / 2, py - 20, { color: '#888', align: 'center' });
    ctx.fillStyle = '#000'; ctx.fillRect(px, py, box.w, box.h);
    ctx.strokeStyle = '#00c000'; ctx.lineWidth = 2; ctx.strokeRect(px, py, box.w, box.h);
    const S = Creator.previewSim(box);
    if (S) {
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, box.w, box.h); ctx.clip();
      for (const b of S.bullets) drawBullet(ctx, b, px + b.x, py + b.y, 1);
      drawSpr(ctx, A.ui('soul'), px + S.soul.x, py + S.soul.y, { scale: 1 });
      ctx.restore();
    }
    const stat = (isSpell || s.slot === 'ult') ? charDef(cc).mag : charDef(cc).atk;
    const dmg = Math.max(4, Math.round(stat * (s.slot === 'ult' ? 1.3 : 1)));
    drawText(ctx, 'main', dmg + ' DMG / HIT', px + box.w / 2, py + box.h + 10, { color: '#6cf', align: 'center' });
    drawText(ctx, 'main', 'from ' + ((isSpell || s.slot === 'ult') ? 'MAGIC' : 'ATTACK'), px + box.w / 2, py + box.h + 28, { color: '#666', align: 'center' });
  } else {
    drawText(ctx, 'main', SUPPORTS[mode].desc, 320, 300, { color: '#8f8', align: 'center' });
  }
  drawText(ctx, 'main', 'ARROWS  [Z] OK  [X] BACK', 320, 462, { color: '#555', align: 'center' });

  if (s.editEm != null) Creator.renderEmit(ctx);
};

Creator.renderEmit = function (ctx) {
  const s = G.ccAtk, atk = atkObj(s.slot), em = atk.emitters[s.editEm];
  if (!em) return;
  const px = 250, py = 120, pw = 300, ph = 210;
  ctx.fillStyle = 'rgba(0,0,0,0.96)'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#00c000'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);
  drawText(ctx, 'main', 'EMITTER ' + (s.editEm + 1), px + pw / 2, py + 8, { color: '#ff8000', align: 'center' });
  const rows = [
    ['PRESET', PRESETS[em.preset].name + ' (' + PRESETS[em.preset].desc + ')'],
    ['BULLET', em.bullet.toUpperCase() + '  +' + (BULLET_COST[em.bullet] || 0)],
    ['SPEED', SPEEDS[em.speed].name],
    ['QTY', QTYS[em.qty].name],
    ['', 'DELETE'],
    ['', 'BACK'],
  ];
  rows.forEach(([label, val], i) => {
    const y = py + 38 + i * 25;
    const sel = s.erow === i;
    const col = i === 4 ? (sel ? '#f66' : '#a44') : (sel ? '#ff0' : '#999');
    drawText(ctx, 'main', (sel ? '> ' : '  ') + (label || val), px + 14, y, { color: col });
    if (label) drawText(ctx, 'main', val, px + 110, y, { color: sel ? '#fff' : '#bbb' });
  });
  const bp = bulletProps(em.bullet);
  if (bp.img) drawSpr(ctx, bp.img, px + pw - 40, py + 46, { scale: 1.5 });
  else drawBullet(ctx, { ...bp, t: G.f }, px + pw - 40, py + 46, 1.4);
  drawText(ctx, 'main', 'COST ' + emitterCost(em), px + pw - 40, py + ph - 20, { color: '#ff8000', align: 'center' });
};

// ---------- render: name entry ----------
Creator.renderName = function (ctx) {
  const ne = G.nameEntry;
  const cur = ne ? ne.obj[ne.key] : '';
  const isFighter = ne && ne.obj === G.cc;
  drawText(ctx, 'main', isFighter ? 'NAME YOUR FIGHTER' : 'NAME THIS ATTACK', 320, 150, { color: '#888', align: 'center' });
  let disp = '';
  for (let i = 0; i < (ne ? ne.max : 8); i++) disp += (cur[i] || '_') + ' ';
  drawText(ctx, 'big', disp.trim(), 320, 190, { color: '#ff0', align: 'center', scale: 0.7 });
  drawText(ctx, 'main', 'TYPE  -  [ENTER] OR [ESC] DONE', 320, 300, { color: '#888', align: 'center' });
};
