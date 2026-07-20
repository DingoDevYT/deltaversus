// Custom character creator: Sims-style rows, live recolored preview,
// buildable spells/ultimate, ACT + battle theme choice.
const Creator = {};

const CC_DEFAULT = {
  v: 1, name: 'HERO', base: 'kris', hue: 40, arch: 'balanced', weapon: 'sword',
  spells: [
    { type: 'fan', bullet: 'spark', speed: 'normal' },
    { type: 'heal', bullet: 'spark', speed: 'normal' },
  ],
  ult: { type: 'rain', bullet: 'orb_l', speed: 'heavy' },
  act: 'taunt',
  theme: 'big_shot_spamton_neo',
};

const CC_ROWS = ['base', 'color', 'name', 'style', 'weapon',
                 'spell0', 'spell1', 'ult', 'act', 'theme', 'done'];

Creator.open = function () {
  try {
    const saved = JSON.parse(localStorage.getItem('dv_custom1'));
    G.cc = saved && saved.v === 1 ? saved : JSON.parse(JSON.stringify(CC_DEFAULT));
  } catch (e) { G.cc = JSON.parse(JSON.stringify(CC_DEFAULT)); }
  G.ccRow = 0;
  G.ccEdit = null;     // {slot: 0|1|'ult', row: 0}
  G.screen = 'creator';
};

function cyc(list, cur, dir) {
  const i = list.indexOf(cur);
  return list[(i + dir + list.length) % list.length];
}

Creator.update = function () {
  const cc = G.cc;
  if (G.ccEdit) { Creator.updSpellEdit(); return; }
  const row = CC_ROWS[G.ccRow];
  if (Input.hit.up) { G.ccRow = (G.ccRow + CC_ROWS.length - 1) % CC_ROWS.length; Snd.play('menumove'); }
  if (Input.hit.down) { G.ccRow = (G.ccRow + 1) % CC_ROWS.length; Snd.play('menumove'); }
  if (Input.hit.cancel) { Snd.play('menumove'); Snd.playMusic('menu'); G.screen = 'select'; return; }

  const dir = Input.hit.right ? 1 : Input.hit.left ? -1 : 0;
  if (dir) {
    Snd.play('menumove');
    if (row === 'base') cc.base = cyc(CHAR_IDS, cc.base, dir);
    else if (row === 'color') cc.hue = ((cc.hue + dir * 20) + 360) % 360;
    else if (row === 'style') cc.arch = cyc(ARCH_IDS, cc.arch, dir);
    else if (row === 'weapon') cc.weapon = cyc(WEAPON_IDS, cc.weapon, dir);
    else if (row === 'act') cc.act = cyc(ACT_IDS, cc.act, dir);
    else if (row === 'theme') {
      const keys = THEMES.map(t => t.key);
      cc.theme = cyc(keys, cc.theme, dir);
      Snd.playMusic(cc.theme);        // live preview
    }
  }
  if (Input.hit.ok) {
    if (row === 'name') { Snd.play('select'); G.screen = 'ccname'; }
    else if (row === 'spell0') { Snd.play('select'); G.ccEdit = { slot: 0, row: 0 }; }
    else if (row === 'spell1') { Snd.play('select'); G.ccEdit = { slot: 1, row: 0 }; }
    else if (row === 'ult') { Snd.play('select'); G.ccEdit = { slot: 'ult', row: 0 }; }
    else if (row === 'done') {
      if (!cc.name.trim()) { Snd.play('cantselect'); return; }
      Snd.play('shineselect');
      localStorage.setItem('dv_custom1', JSON.stringify(cc));
      G.myCharSel = JSON.parse(JSON.stringify(cc));
      Snd.playMusic('menu');
      G.screen = 'loadout';
      G.loadout = []; G.loadIdx = 0;
    }
  }
};

function ccSpec(slot) {
  return slot === 'ult' ? G.cc.ult : G.cc.spells[slot];
}

Creator.updSpellEdit = function () {
  const e = G.ccEdit, sp = ccSpec(e.slot);
  const isUlt = e.slot === 'ult';
  const t = SPELL_TYPES[sp.type];
  const editable = t.kind ? 1 : 3;    // heal/status: only TYPE row matters
  const rows = editable + 1;          // + OK
  if (Input.hit.up) { e.row = (e.row + rows - 1) % rows; Snd.play('menumove'); }
  if (Input.hit.down) { e.row = (e.row + 1) % rows; Snd.play('menumove'); }
  if (Input.hit.cancel) { Snd.play('menumove'); G.ccEdit = null; return; }
  const dir = Input.hit.right ? 1 : Input.hit.left ? -1 : 0;
  if (dir) {
    Snd.play('menumove');
    if (e.row === 0) {
      const pool = isUlt ? ATTACK_TYPE_IDS : SPELL_TYPE_IDS;
      sp.type = cyc(pool, sp.type, dir);
      if (e.row >= (SPELL_TYPES[sp.type].kind ? 1 : 3)) e.row = 0;
    } else if (e.row === 1) sp.bullet = cyc(CC_BULLETS, sp.bullet, dir);
    else if (e.row === 2) sp.speed = cyc(SPEED_IDS, sp.speed, dir);
  }
  if (Input.hit.ok && e.row === rows - 1) { Snd.play('select'); G.ccEdit = null; }
};

// name entry: letters/digits via raw keydown (registered in main.js)
Creator.nameKey = function (e) {
  if (/^[a-zA-Z0-9 ]$/.test(e.key) && G.cc.name.length < 8)
    G.cc.name += e.key.toUpperCase();
  if (e.key === 'Backspace') G.cc.name = G.cc.name.slice(0, -1);
  if (e.key === 'Enter') { Snd.play('select'); G.screen = 'creator'; }
};

// ---------- render ----------
function spellLabel(sp, ult) {
  const t = SPELL_TYPES[sp.type];
  if (t.kind) return t.name + ' (' + t.tp + '%)';
  const spd = SPEEDS[sp.speed] || SPEEDS.normal;
  const tp = ult ? 100 : Math.max(10, t.tp + spd.tp);
  return (sp.bullet + ' ' + t.name).toUpperCase() + (ult ? ' EX' : '') + ' (' + tp + '%)';
}

Creator.render = function (ctx) {
  const cc = G.cc;
  const def = charDef(cc);
  drawText(ctx, 'main', 'CREATE YOUR SOUL', 320, 16, { color: '#fff', align: 'center' });

  // preview: recolored idle animation
  const an = A.anim(cc.base, 'idle');
  let im = A.animFrame(an, G.f * (1000 / 60), true);
  if (im && cc.hue) im = A.hued(im, cc.hue);
  drawSpr(ctx, im, 105, 130, { scale: 1.3 });
  drawSpr(ctx, A.hued(A.ui('head_' + cc.base), cc.hue), 60, 210, { scale: 1 });
  drawText(ctx, 'main', cc.name || '?', 105, 224, { color: def.color, align: 'center' });
  drawText(ctx, 'main', 'HP ' + def.hp, 105, 248, { color: '#ff0', align: 'center' });
  drawText(ctx, 'main', ARCHETYPES[cc.arch].name, 105, 268, { color: '#aaa', align: 'center' });
  drawText(ctx, 'main', 'FIGHT ' + def.fight.dmg + ' DMG', 105, 288, { color: '#6cf', align: 'center' });

  const themeName = (THEMES.find(t => t.key === cc.theme) || {}).name || '?';
  const rowsDef = [
    ['BASE', CHARS[cc.base].name],
    ['COLOR', ''],
    ['NAME', cc.name || '(none)'],
    ['STYLE', ARCHETYPES[cc.arch].name],
    ['WEAPON', WEAPONS[cc.weapon].name],
    ['SPELL 1', spellLabel(cc.spells[0])],
    ['SPELL 2', spellLabel(cc.spells[1])],
    ['ULTIMATE', spellLabel(cc.ult, true)],
    ['ACT', ACTS[cc.act].name + ' - ' + ACTS[cc.act].desc],
    ['THEME', themeName],
    ['', 'DONE - SAVE FIGHTER'],
  ];
  rowsDef.forEach(([label, val], i) => {
    const y = 46 + i * 30;
    const sel = G.ccRow === i && !G.ccEdit;
    if (sel) drawSpr(ctx, A.ui('soul'), 210, y + 8, { scale: 1 });
    drawText(ctx, 'main', label, 228, y, { color: sel ? '#ff0' : '#999' });
    if (CC_ROWS[i] === 'color') {
      // hue bar
      for (let hx = 0; hx < 18; hx++) {
        ctx.fillStyle = `hsl(${hx * 20},80%,55%)`;
        ctx.fillRect(340 + hx * 14, y + 2, 13, 12);
      }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.strokeRect(340 + (cc.hue / 20) * 14, y, 14, 16);
    } else {
      drawText(ctx, 'main', val, 340, y, { color: sel ? '#fff' : '#bbb' });
    }
  });
  drawText(ctx, 'main', 'ARROWS CHANGE - [Z] EDIT/OK - [X] BACK', 320, 452,
           { color: '#555', align: 'center' });

  if (G.ccEdit) Creator.renderSpellEdit(ctx);
};

Creator.renderSpellEdit = function (ctx) {
  const e = G.ccEdit, sp = ccSpec(e.slot);
  const isUlt = e.slot === 'ult';
  const t = SPELL_TYPES[sp.type];
  const px = 170, py = 130, pw = 310, ph = 190;
  ctx.fillStyle = 'rgba(0,0,0,0.95)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#00c000'; ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);
  drawText(ctx, 'main', isUlt ? 'BUILD ULTIMATE' : 'BUILD SPELL ' + (e.slot + 1),
           px + pw / 2, py + 10, { color: '#ff8000', align: 'center' });

  const rows = [['TYPE', t.name + ' - ' + t.desc]];
  if (!t.kind) {
    rows.push(['BULLET', sp.bullet.toUpperCase()]);
    rows.push(['SPEED', (SPEEDS[sp.speed] || SPEEDS.normal).name]);
  }
  rows.push(['', 'OK']);
  rows.forEach(([label, val], i) => {
    const y = py + 40 + i * 26;
    const sel = e.row === i;
    drawText(ctx, 'main', (sel ? '> ' : '  ') + label, px + 16, y, { color: sel ? '#ff0' : '#999' });
    drawText(ctx, 'main', val, px + 120, y, { color: sel ? '#fff' : '#bbb' });
  });
  // live bullet preview + stats
  if (!t.kind) {
    const bp = bulletProps(sp.bullet);
    if (bp.img) drawSpr(ctx, bp.img, px + pw - 46, py + 66, { scale: 1.6 });
    else drawBullet(ctx, { ...bp, t: G.f }, px + pw - 46, py + 66, 1.4);
    const spd = SPEEDS[sp.speed] || SPEEDS.normal;
    const arch = ARCHETYPES[G.cc.arch];
    const dmg = Math.round(t.dmg * arch.mult * spd.dmg * (isUlt ? 1.35 : 1));
    const tp = isUlt ? 100 : Math.max(10, t.tp + spd.tp);
    drawText(ctx, 'main', dmg + ' DMG/HIT - ' + tp + '% TP', px + pw / 2, py + ph - 26,
             { color: '#6cf', align: 'center' });
  }
};

Creator.renderName = function (ctx) {
  drawText(ctx, 'main', 'NAME YOUR FIGHTER', 320, 150, { color: '#888', align: 'center' });
  let disp = '';
  for (let i = 0; i < 8; i++) disp += (G.cc.name[i] || '_') + ' ';
  drawText(ctx, 'big', disp.trim(), 320, 190, { color: '#ff0', align: 'center', scale: 0.8 });
  drawText(ctx, 'main', 'Type letters - [ENTER] done', 320, 300, { color: '#888', align: 'center' });
};
