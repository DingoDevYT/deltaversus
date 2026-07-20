p = r'C:\Users\lando\Desktop\DeltaVersus\docs\js\main.js'
s = open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert old in s, 'NOT FOUND: ' + old[:60]
    s = s.replace(old, new, 1)

rep("""  myChar: null, myItems: null,
  oppChar: null, oppItems: null,""",
"""  myCharSel: null, myItems: null,
  oppItems: null,""")

rep("""addEventListener('keydown', e => {
  if (G.screen !== 'join') return;""",
"""addEventListener('keydown', e => {
  if (G.screen === 'ccname') { Creator.nameKey(e); return; }
  if (G.screen !== 'join') return;""")

rep("""function maybeStartBattle() {
  if (!G.myHelloSent || !G.oppHello) return;
  G.oppChar = G.oppHello.char;
  G.oppItems = G.oppHello.items || [];
  Battle.init({ myChar: G.myChar, oppChar: G.oppChar,
                myItems: G.myItems, oppItems: G.oppItems });
  G.screen = 'battle';
}""",
"""function maybeStartBattle() {
  if (!G.myHelloSent || !G.oppHello) return;
  G.oppItems = G.oppHello.items || [];
  Battle.init({ mySel: G.myCharSel, oppSel: G.oppHello.char,
                myItems: G.myItems, oppItems: G.oppItems });
  G.screen = 'battle';
}""")

rep("""    case 'select': {
      if (Input.hit.left) { G.selIdx = (G.selIdx + CHAR_IDS.length - 1) % CHAR_IDS.length; Snd.play('menumove'); }
      if (Input.hit.right) { G.selIdx = (G.selIdx + 1) % CHAR_IDS.length; Snd.play('menumove'); }
      if (Input.hit.ok) {
        Snd.play('select');
        G.myChar = CHAR_IDS[G.selIdx];
        G.screen = 'loadout';
        G.loadout = []; G.loadIdx = 0;
      }
      break;
    }""",
"""    case 'select': {
      const nTiles = CHAR_IDS.length + 1;   // + CREATE
      if (Input.hit.left) { G.selIdx = (G.selIdx + nTiles - 1) % nTiles; Snd.play('menumove'); }
      if (Input.hit.right) { G.selIdx = (G.selIdx + 1) % nTiles; Snd.play('menumove'); }
      if (Input.hit.ok) {
        Snd.play('select');
        if (G.selIdx < CHAR_IDS.length) {
          G.myCharSel = CHAR_IDS[G.selIdx];
          G.screen = 'loadout';
          G.loadout = []; G.loadIdx = 0;
        } else {
          Creator.open();
        }
      }
      break;
    }
    case 'creator': Creator.update(); break;
    case 'ccname': break;""")

rep("""          G.myItems = G.loadout.slice();
          G.myHelloSent = true;
          Net.send({ t: 'hello', name: CHARS[G.myChar].name, char: G.myChar, items: G.myItems });""",
"""          G.myItems = G.loadout.slice();
          G.myHelloSent = true;
          Net.send({ t: 'hello', char: G.myCharSel, items: G.myItems });""")

rep("""    case 'select': renderSelect(); break;""",
"""    case 'select': renderSelect(); break;
    case 'creator': Creator.render(ctx); break;
    case 'ccname': Creator.renderName(ctx); break;""")

OLD_SELECT = """  CHAR_IDS.forEach((id, i) => {
    const x = 96 + i * 112, y = 120;
    const c = CHARS[id];
    const sel = i === G.selIdx;
    if (sel) {
      ctx.strokeStyle = c.color; ctx.lineWidth = 2;
      ctx.strokeRect(x - 44, y - 52, 88, 104);
    }
    const an = A.anim(id, 'idle');
    const im = A.animFrame(an, G.f * (1000 / 60), true);
    drawSpr(ctx, im, x, y, { scale: sel ? 1 : 0.8, alpha: sel ? 1 : 0.6 });
    drawText(ctx, 'main', c.name, x, y + 62, { color: sel ? c.color : '#777', align: 'center' });
  });
  const c = CHARS[CHAR_IDS[G.selIdx]];
  drawText(ctx, 'main', 'HP ' + c.hp, 320, 220, { color: '#ff0', align: 'center' });
  c.desc.split('\\n').forEach((l, i) =>
    drawText(ctx, 'main', l, 320, 250 + i * 20, { color: '#aaa', align: 'center' }));
  const kit = ['FIGHT: ' + c.fight.name]
    .concat(c.spells.map(s => s.name + ' (' + s.tp + '%)'))
    .concat([c.ult.name + ' (100%)', 'ACT: ' + c.act.name]);
  kit.forEach((l, i) =>
    drawText(ctx, 'main', l, 320, 310 + i * 20, { color: '#6cf', align: 'center' }));"""
NEW_SELECT = """  CHAR_IDS.forEach((id, i) => {
    const x = 66 + i * 96, y = 120;
    const c = CHARS[id];
    const sel = i === G.selIdx;
    if (sel) {
      ctx.strokeStyle = c.color; ctx.lineWidth = 2;
      ctx.strokeRect(x - 42, y - 52, 84, 104);
    }
    const an = A.anim(id, 'idle');
    const im = A.animFrame(an, G.f * (1000 / 60), true);
    drawSpr(ctx, im, x, y, { scale: sel ? 1 : 0.8, alpha: sel ? 1 : 0.6 });
    drawText(ctx, 'main', c.name, x, y + 62, { color: sel ? c.color : '#777', align: 'center' });
  });
  {
    const x = 66 + CHAR_IDS.length * 96, y = 120;
    const sel = G.selIdx === CHAR_IDS.length;
    if (sel) { ctx.strokeStyle = '#ff8000'; ctx.lineWidth = 2; ctx.strokeRect(x - 42, y - 52, 84, 104); }
    drawText(ctx, 'big', '+', x, y - 24, { color: sel ? '#ff8000' : '#666', align: 'center', scale: 0.9 });
    drawText(ctx, 'main', 'CREATE', x, y + 62, { color: sel ? '#ff8000' : '#777', align: 'center' });
  }
  if (G.selIdx < CHAR_IDS.length) {
    const c = CHARS[CHAR_IDS[G.selIdx]];
    drawText(ctx, 'main', 'HP ' + c.hp, 320, 220, { color: '#ff0', align: 'center' });
    c.desc.split('\\n').forEach((l, i) =>
      drawText(ctx, 'main', l, 320, 250 + i * 20, { color: '#aaa', align: 'center' }));
    const kit = ['FIGHT: ' + c.fight.name]
      .concat(c.spells.map(s => s.name + ' (' + s.tp + '%)'))
      .concat([c.ult.name + ' (100%)', 'ACT: ' + c.act.name]);
    kit.forEach((l, i) =>
      drawText(ctx, 'main', l, 320, 310 + i * 20, { color: '#6cf', align: 'center' }));
  } else {
    drawText(ctx, 'main', 'BUILD YOUR OWN FIGHTER', 320, 240, { color: '#ff8000', align: 'center' });
    drawText(ctx, 'main', 'base + color + weapon + custom attacks + theme', 320, 266, { color: '#aaa', align: 'center' });
  }"""
rep(OLD_SELECT, NEW_SELECT)

OLD_VS = """function renderVs() {
  if (!G.myChar) return;
  const my = A.animFrame(A.anim(G.myChar, 'idle'), G.f * (1000 / 60), true);
  drawSpr(ctx, my, 200, 220, { scale: 1.2 });
  drawText(ctx, 'main', CHARS[G.myChar].name, 200, 300, { color: CHARS[G.myChar].color, align: 'center' });
  drawText(ctx, 'big', 'VS', 320, 200, { color: '#f44', align: 'center' });
  if (G.oppHello) {
    const op = A.animFrame(A.anim(G.oppHello.char, 'idle'), G.f * (1000 / 60), true);
    drawSpr(ctx, op, 440, 220, { scale: 1.2, flip: true });
    drawText(ctx, 'main', CHARS[G.oppHello.char].name, 440, 300,
             { color: CHARS[G.oppHello.char].color, align: 'center' });
  } else {
    drawText(ctx, 'big', '?', 440, 200, { color: '#666', align: 'center' });
  }
}"""
NEW_VS = """function renderVs() {
  if (!G.myCharSel) return;
  const md = charDef(G.myCharSel);
  let my = A.animFrame(A.anim(md.base, 'idle'), G.f * (1000 / 60), true);
  if (md.hue) my = A.hued(my, md.hue);
  drawSpr(ctx, my, 200, 220, { scale: 1.2 });
  drawText(ctx, 'main', md.name, 200, 300, { color: md.color, align: 'center' });
  drawText(ctx, 'big', 'VS', 320, 200, { color: '#f44', align: 'center' });
  if (G.oppHello) {
    const od = charDef(G.oppHello.char);
    let op = A.animFrame(A.anim(od.base, 'idle'), G.f * (1000 / 60), true);
    if (od.hue) op = A.hued(op, od.hue);
    drawSpr(ctx, op, 440, 220, { scale: 1.2, flip: true });
    drawText(ctx, 'main', od.name, 440, 300, { color: od.color, align: 'center' });
  } else {
    drawText(ctx, 'big', '?', 440, 200, { color: '#666', align: 'center' });
  }
}"""
rep(OLD_VS, NEW_VS)

open(p, 'w', encoding='utf-8').write(s)
print('main.js wired')
