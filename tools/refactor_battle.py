import io, sys
p = r'C:\Users\lando\Desktop\DeltaVersus\docs\js\battle.js'
s = open(p, encoding='utf-8').read()
def rep(old, new):
    global s
    assert old in s, 'NOT FOUND: ' + old[:70]
    s = s.replace(old, new, 1)

rep("""  B.myChar = opts.myChar; B.oppChar = opts.oppChar;
  B.myName = CHARS[B.myChar].name; B.oppName = CHARS[B.oppChar].name;
  B.me = { hp: CHARS[B.myChar].hp, max: CHARS[B.myChar].hp, tp: 0,
           items: opts.myItems.slice() };
  B.opp = { hp: CHARS[B.oppChar].hp, max: CHARS[B.oppChar].hp, tp: 0,
            items: opts.oppItems.slice() };""",
"""  B.mySel = opts.mySel; B.oppSel = opts.oppSel;
  B.myDef = charDef(opts.mySel); B.oppDef = charDef(opts.oppSel);
  B.myChar = B.myDef.base; B.oppChar = B.oppDef.base;
  B.myName = B.myDef.name; B.oppName = B.oppDef.name;
  B.me = { hp: B.myDef.hp, max: B.myDef.hp, tp: 0,
           items: opts.myItems.slice() };
  B.opp = { hp: B.oppDef.hp, max: B.oppDef.hp, tp: 0,
            items: opts.oppItems.slice() };""")

rep("  Snd.playMusic(Snd.THEME[B.oppChar]);",
    "  Snd.playMusic(B.oppDef.custom ? B.oppDef.theme : Snd.THEME[B.oppDef.base]);")

rep("""      Battle.init({ myChar: B.myChar, oppChar: B.oppChar,
                    myItems: G.myItems, oppItems: G.oppItems, matchN: m.n });""",
"""      Battle.init({ mySel: B.mySel, oppSel: B.oppSel,
                    myItems: G.myItems, oppItems: G.oppItems, matchN: m.n });""")
rep("""        Battle.init({ myChar: B.myChar, oppChar: B.oppChar,
                      myItems: G.myItems, oppItems: G.oppItems, matchN: n });""",
"""        Battle.init({ mySel: B.mySel, oppSel: B.oppSel,
                      myItems: G.myItems, oppItems: G.oppItems, matchN: n });""")

rep("  const B = Battle, c = CHARS[B.myChar], a = B.myAction;",
    "  const B = Battle, c = B.myDef, a = B.myAction;")
rep("  const B = Battle, c = CHARS[B.oppChar], a = B.oppAction;",
    "  const B = Battle, c = B.oppDef, a = B.oppAction;")
rep("  const B = Battle, c = CHARS[B.myChar];",
    "  const B = Battle, c = B.myDef;")
rep("  const c = CHARS[B.myChar], a = B.myAction;",
    "  const c = B.myDef, a = B.myAction;")

rep("""  lines.push('* ' + B.actionText(B.myChar, B.myAction, true));
  lines.push('* ' + B.actionText(B.oppChar, B.oppAction, false));""",
"""  lines.push('* ' + B.actionText(B.myDef, B.myAction, true));
  lines.push('* ' + B.actionText(B.oppDef, B.oppAction, false));""")
rep("""Battle.actionText = function (ch, a, mine) {
  const c = CHARS[ch];""",
"""Battle.actionText = function (def, a, mine) {
  const c = def;""")

rep("    B.sim = makeDodgeSim(B.oppChar, oppDef, tier, B.oppAction.seed, B.dodgeBox);",
    "    B.sim = makeDodgeSim(B.oppDef, oppDef, tier, B.oppAction.seed, B.dodgeBox);")
rep("      sim: makeDodgeSim(B.myChar, myDef, myEffTier, B.myAction.seed, mbox),",
    "      sim: makeDodgeSim(B.myDef, myDef, myEffTier, B.myAction.seed, mbox),")

rep("  if (B.oppAction.cmd === 'act') B.fxOnMeQueued = { ...ACT_FX[CHARS[B.oppChar].act.id] };",
    "  if (B.oppAction.cmd === 'act') B.fxOnMeQueued = { ...ACT_FX[B.oppDef.act.id] };")
rep("""    const oc = CHARS[B.oppChar];""",
    """    const oc = B.oppDef;""")
rep("""    const oc2 = CHARS[B.oppChar];""",
    """    const oc2 = B.oppDef;""")

rep("""function drawCharAnim(ctx, ch, pose, tFrames, x, groundY, flip, alpha) {
  const an = A.anim(ch, pose) || A.anim(ch, 'idle');
  if (!an) return true;
  const ms = tFrames * (1000 / 60);
  const done = !LOOP_POSES[pose] && ms >= an.total;
  const im = A.animFrame(an, ms, !!LOOP_POSES[pose]);
  if (im && im.width)
    drawSpr(ctx, im, x, groundY - im.height / 2, { scale: 1, flip, alpha });
  return done;
}""",
"""function drawCharAnim(ctx, def, pose, tFrames, x, groundY, flip, alpha) {
  const an = A.anim(def.base, pose) || A.anim(def.base, 'idle');
  if (!an) return true;
  const ms = tFrames * (1000 / 60);
  const done = !LOOP_POSES[pose] && ms >= an.total;
  let im = A.animFrame(an, ms, !!LOOP_POSES[pose]);
  if (im && im.width) {
    if (def.hue) im = A.hued(im, def.hue);
    drawSpr(ctx, im, x, groundY - im.height / 2, { scale: 1, flip, alpha });
  }
  return done;
}""")
rep("""  const doneMy = drawCharAnim(ctx, B.myChar, B.anim.myPose, B.anim.myT,
                              100, GROUND_MY, false, hurtFlashMe ? 0.4 : 1);
  const doneOpp = drawCharAnim(ctx, B.oppChar, B.anim.oppPose, B.anim.oppT,
                               540, GROUND_OPP, true, hurtFlashOpp ? 0.4 : 1);""",
"""  const doneMy = drawCharAnim(ctx, B.myDef, B.anim.myPose, B.anim.myT,
                              100, GROUND_MY, false, hurtFlashMe ? 0.4 : 1);
  const doneOpp = drawCharAnim(ctx, B.oppDef, B.anim.oppPose, B.anim.oppT,
                               540, GROUND_OPP, true, hurtFlashOpp ? 0.4 : 1);""")

rep("  drawSpr(ctx, tintedSoul(CHARS[B.oppChar].color), mx + M.soul.x * s, my + M.soul.y * s, { scale: 0.75 });",
    "  drawSpr(ctx, tintedSoul(B.oppDef.color), mx + M.soul.x * s, my + M.soul.y * s, { scale: 0.75 });")
rep("  drawSpr(ctx, A.ui('head_' + B.oppChar), mx - 18, my + 10, { scale: 1, alpha: 0.9 });",
    "  drawSpr(ctx, A.hued(A.ui('head_' + B.oppDef.base), B.oppDef.hue), mx - 18, my + 10, { scale: 1, alpha: 0.9 });")

rep("""function drawEntry(ctx, x, y, ch, name, hp, max, active) {
  const head = A.ui('head_' + ch + (hp <= 0 ? '_gray' : ''));
  drawSpr(ctx, head, x + 13, y + 15, { scale: 1 });""",
"""function drawEntry(ctx, x, y, def, name, hp, max, active) {
  let head = A.ui('head_' + def.base + (hp <= 0 ? '_gray' : ''));
  if (hp > 0 && def.hue) head = A.hued(head, def.hue);
  drawSpr(ctx, head, x + 13, y + 15, { scale: 1 });""")
rep("""  ctx.fillStyle = CHARS[ch].color;
  ctx.fillRect(x + 156, y + 14, Math.max(0, Math.round(94 * hp / max)), 9);
  if (active) {
    ctx.strokeStyle = CHARS[ch].color; ctx.lineWidth = 1;""",
"""  ctx.fillStyle = def.color;
  ctx.fillRect(x + 156, y + 14, Math.max(0, Math.round(94 * hp / max)), 9);
  if (active) {
    ctx.strokeStyle = def.color; ctx.lineWidth = 1;""")
rep("""  drawEntry(ctx, 62, 394, B.myChar, B.myName, B.me.hp, B.me.max,
            B.phase === 'select');
  drawEntry(ctx, 358, 394, B.oppChar, B.oppName, B.opp.hp, B.opp.max, false);""",
"""  drawEntry(ctx, 62, 394, B.myDef, B.myName, B.me.hp, B.me.max,
            B.phase === 'select');
  drawEntry(ctx, 358, 394, B.oppDef, B.oppName, B.opp.hp, B.opp.max, false);""")

rep("  drawSpr(ctx, A.ui('head_' + B.myChar), 60, y + h / 2, { scale: 1 });",
    "  drawSpr(ctx, A.hued(A.ui('head_' + B.myDef.base), B.myDef.hue), 60, y + h / 2, { scale: 1 });")
rep("  ctx.fillStyle = CHARS[B.myChar].color;",
    "  ctx.fillStyle = B.myDef.color;")

open(p, 'w', encoding='utf-8').write(s)
print('done. CHARS[ refs left:', s.count('CHARS['))
