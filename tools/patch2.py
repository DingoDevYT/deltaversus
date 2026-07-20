import re, io

ROOT = r'C:\Users\lando\Desktop\DeltaVersus\docs\js'

# ---------------- characters.js ----------------
p = ROOT + r'\characters.js'
s = open(p, encoding='utf-8').read()

NEW_DATA = r'''const ARCHETYPES = {
  balanced: { name: 'BALANCED', hp: 160, pool: 40, desc: 'Even HP and power' },
  tank:     { name: 'TANK', hp: 205, pool: 32, desc: 'Huge HP, less power' },
  glass:    { name: 'GLASS CANNON', hp: 115, pool: 54, desc: 'Fragile but deadly' },
  tricky:   { name: 'TRICKY', hp: 145, pool: 46, desc: 'Balanced with a big pool' },
};
const ARCH_IDS = Object.keys(ARCHETYPES);

// which base models are enemy-facing (sprite drawn mirrored vs the party)
const ENEMY_FACING = { lancer: true };

// weapon = quick-start: default projectile + preset for your FIGHT emitter
const WEAPONS = {
  sword: { name: 'SWORD', bullet: 'sword', preset: 'sweep' },
  axe:   { name: 'AXE', bullet: 'axe', preset: 'sweep' },
  scarf: { name: 'SCARF', bullet: 'crescent', preset: 'sweep' },
  ice:   { name: 'ICE', bullet: 'icicle', preset: 'rain' },
  spade: { name: 'SPADES', bullet: 'spade', preset: 'fan' },
  wand:  { name: 'WAND', bullet: 'spark', preset: 'spiral' },
};
const WEAPON_IDS = Object.keys(WEAPONS);

// buildable attack presets (emitter shapes) + their skill-point cost
const PRESETS = {
  rain:   { name: 'RAIN', cost: 2, desc: 'falls from above' },
  fan:    { name: 'FAN', cost: 2, desc: 'aimed spread' },
  sweep:  { name: 'SWEEP', cost: 2, desc: 'sweeps across' },
  spiral: { name: 'SPIRAL', cost: 3, desc: 'spins from center' },
  walls:  { name: 'WALLS', cost: 3, desc: 'lanes with a gap' },
  burst:  { name: 'BURST', cost: 3, desc: 'exploding rings' },
  homing: { name: 'HOMING', cost: 4, desc: 'seeks your SOUL' },
};
const PRESET_IDS = Object.keys(PRESETS);

// support (non-projectile) spell modes
const SUPPORTS = {
  heal:   { name: 'HEAL', tp: 32, heal: 60, kind: 'heal', desc: 'Restore 60 HP' },
  pacify: { name: 'PACIFY', tp: 16, kind: 'status', status: 'pacified', desc: 'Weaken their attack' },
  sleep:  { name: 'SLEEP MIST', tp: 24, kind: 'status', status: 'drowsy', desc: 'Slow, drowsy foe' },
};
const SUPPORT_IDS = Object.keys(SUPPORTS);
const SPELL_MODES = ['attack'].concat(SUPPORT_IDS);

const SPEEDS = {
  light:  { name: 'LIGHT', v: 0.8, cost: 0 },
  normal: { name: 'NORMAL', v: 1.05, cost: 1 },
  heavy:  { name: 'HEAVY', v: 1.35, cost: 2 },
};
const SPEED_IDS = Object.keys(SPEEDS);

const QTYS = {
  low:  { name: 'LOW', rate: 1.6, cost: 0 },
  med:  { name: 'MED', rate: 1.0, cost: 1 },
  high: { name: 'HIGH', rate: 0.62, cost: 3 },
};
const QTY_IDS = Object.keys(QTYS);

// projectiles usable in the builder + their skill-point cost tier
const BULLET_COST = {
  spark: 0, orb_s: 0, orb_m: 0, star: 0,
  orb_l: 1, diamond: 1, sword: 1, dart: 1, spade: 1, spade_pink: 1, note: 1, shard: 1, crescent: 1, ring: 1,
  axe: 2, arc: 2, arc_red: 2, shuriken: 2, bone: 2, flame: 2, snowflake: 2, icicle: 2,
};
const CC_BULLETS = Object.keys(BULLET_COST);

function emitterCost(em) {
  return (PRESETS[em.preset] ? PRESETS[em.preset].cost : 2)
       + (BULLET_COST[em.bullet] || 0)
       + (SPEEDS[em.speed] ? SPEEDS[em.speed].cost : 1)
       + (QTYS[em.qty] ? QTYS[em.qty].cost : 1);
}
function attackCost(emitters) {
  return (emitters || []).reduce((sum, em) => sum + emitterCost(em), 0);
}

// skill-point budget per slot. spells scale with the TP cost you set.
const FIGHT_SP = 6;
const ULT_SP = 32;
const TP_MIN = 16, TP_MAX = 64, TP_STEP = 4;
function spellBudget(tp) { return Math.max(4, Math.round(tp / 3)); }
function slotBudget(slot, cc) {
  if (slot === 'fight') return FIGHT_SP;
  if (slot === 'ult') return ULT_SP;
  return spellBudget(cc.spells[slot].tp || 32);
}
function clampTP(tp) { return Math.max(TP_MIN, Math.min(TP_MAX, tp)); }
function defEmitter(cc) {
  const w = WEAPONS[cc && cc.weapon] || WEAPONS.sword;
  return { preset: 'rain', bullet: 'orb_m', speed: 'normal', qty: 'med' };
}'''

s2 = re.sub(r"const ARCHETYPES = \{.*?'crescent', 'star', 'note'\];",
            NEW_DATA.replace('\\', '\\\\'), s, count=1, flags=re.DOTALL)
assert s2 != s, 'characters data block not replaced'
s = s2

NEW_CHARDEF = r'''// normalize a character selection (string id OR custom def object) into a
// battle-ready def. Everything battle-side reads ONLY what this returns.
function charDef(sel) {
  if (typeof sel === 'string') {
    const c = CHARS[sel];
    return { ...c, id: sel, base: sel, hue: 0, custom: false, theme: null };
  }
  const arch = ARCHETYPES[sel.arch] || ARCHETYPES.balanced;
  const name = (sel.name || 'PLAYER').toUpperCase();
  let atk = sel.atk != null ? sel.atk : Math.round(arch.pool / 2);
  atk = Math.max(4, Math.min(arch.pool - 4, atk));
  const mag = arch.pool - atk;

  function mkAttack(a, sid, opts) {
    a = a || {};
    opts = opts || {};
    if (opts.spell && a.mode && a.mode !== 'attack') {
      const sp = SUPPORTS[a.mode] || SUPPORTS.heal;
      return { id: sid, name: (a.name || sp.name), tp: sp.tp, kind: sp.kind,
               heal: sp.heal, status: sp.status,
               text: name + ' casts ' + (a.name || sp.name) + '!' };
    }
    const stat = opts.magic ? mag : atk;
    const ult = !!opts.ult;
    const emitters = (a.emitters && a.emitters.length) ? a.emitters
                     : [{ preset: 'rain', bullet: 'orb_m', speed: 'normal', qty: 'med' }];
    const tp = opts.fight ? 0 : ult ? 100 : clampTP(a.tp || 32);
    const dur = ult ? 560 : opts.fight ? 420 : 480;
    const dmg = Math.max(4, Math.round(stat * (ult ? 1.3 : 1)));
    const nm = a.name || (opts.fight ? 'ATTACK' : ult ? 'ULTIMATE' : 'SPELL');
    return {
      id: sid, kind: 'attack', name: nm, tp, dmg, dur,
      text: name + ' uses ' + nm + (ult ? '!!' : '!'),
      custom: { emitters, ult },
    };
  }

  return {
    id: 'custom', custom: true, base: sel.base || 'kris', hue: sel.hue || 0,
    name,
    color: rotateHue(CHARS[sel.base || 'kris'].color, sel.hue || 0),
    hp: arch.hp, arch: sel.arch, atk, mag,
    desc: arch.name + ' - ATK ' + atk + ' / MAG ' + mag,
    fight: mkAttack(sel.fight, 'cf', { fight: true }),
    spells: [ mkAttack(sel.spells[0], 'cs0', { magic: true, spell: true }),
              mkAttack(sel.spells[1], 'cs1', { magic: true, spell: true }) ],
    ult: mkAttack(sel.ult, 'cu', { magic: true, ult: true }),
    act: { ...ACTS[sel.act || 'taunt'],
           text: name + ' uses ' + ACTS[sel.act || 'taunt'].name + '!' },
    theme: sel.theme || 'rude_buster_general',
  };
}'''

s2 = re.sub(r"// normalize a character selection.*\Z",
            NEW_CHARDEF.replace('\\', '\\\\'), s, count=1, flags=re.DOTALL)
assert s2 != s, 'charDef not replaced'
open(p, 'w', encoding='utf-8').write(s2)
print('characters.js patched')

# ---------------- patterns.js ----------------
p = ROOT + r'\patterns.js'
s = open(p, encoding='utf-8').read()

NEW_PAT = r'''function emSpeedV(x) { return (SPEEDS[x] || SPEEDS.normal).v; }
function emQtyRate(x) { return (QTYS[x] || QTYS.med).rate; }

// per-emitter spawn logic. em = {bp(), v, rm(rate mult), ult}
const EMITTER_FN = {
  rain(a, em) {
    if (every(a.f, rate(Math.round(26 * em.rm), a.tier)))
      a.add({ ...em.bp(), x: a.box.x + a.rng() * a.box.w, y: a.box.y - 26,
              vx: (a.rng() - 0.5) * 0.8 * em.v, vy: (1.2 + a.rng() * 1.2) * em.v, spin: 0.08 });
  },
  sweep(a, em) {
    const period = rate(Math.round(46 * em.rm), a.tier);
    if (every(a.f, period)) {
      const L = (Math.floor(a.f / period) % 2) === 0;
      a.add({ ...em.bp(), x: L ? a.box.x - 30 : a.box.x + a.box.w + 30,
              y: a.box.y + 8 + a.rng() * (a.box.h - 16),
              vx: (L ? 1 : -1) * 2.2 * em.v, vy: 0, sineA: 0.6, sineF: 0.05, spin: 0.1 });
    }
  },
  spiral(a, em) {
    if (every(a.f, rate(Math.round(15 * em.rm), a.tier))) {
      const cx = a.box.x + a.box.w / 2, cy = a.box.y + a.box.h / 2, ang = a.f * 0.31;
      const arms = em.ult ? 3 : 2;
      for (let k = 0; k < arms; k++) {
        const t2 = ang + k * (Math.PI * 2 / arms);
        a.add({ ...em.bp(), x: cx, y: cy, vx: Math.cos(t2) * 1.6 * em.v, vy: Math.sin(t2) * 1.6 * em.v, spin: 0.12 });
      }
    }
  },
  fan(a, em) {
    if (every(a.f, rate(Math.round(40 * em.rm), a.tier))) {
      const L = a.rng() < 0.5, ox = L ? a.box.x - 18 : a.box.x + a.box.w + 18, oy = a.box.y - 14;
      const n = em.ult ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const ang = Math.atan2(a.soul.y - oy, a.soul.x - ox) + (i - (n - 1) / 2) * 0.32;
        a.add({ ...em.bp(), x: ox, y: oy, vx: Math.cos(ang) * 2.0 * em.v, vy: Math.sin(ang) * 2.0 * em.v });
      }
    }
  },
  walls(a, em) {
    if (every(a.f, rate(Math.round(20 * em.rm), a.tier))) {
      const lanes = 6, open = Math.floor(a.f / 100) % lanes, lane = Math.floor(a.rng() * lanes);
      if (lane !== open)
        a.add({ ...em.bp(), x: a.box.x + a.box.w + 26, y: a.box.y + (lane + 0.5) * (a.box.h / lanes),
                vx: -(2.0 + a.rng() * 0.6) * em.v, vy: 0 });
    }
  },
  homing(a, em) {
    if (every(a.f, rate(Math.round(55 * em.rm), a.tier))) {
      const side = Math.floor(a.rng() * 4);
      const x = side === 0 ? a.box.x - 24 : side === 1 ? a.box.x + a.box.w + 24 : a.box.x + a.rng() * a.box.w;
      const y = side === 2 ? a.box.y - 24 : side === 3 ? a.box.y + a.box.h + 24 : a.box.y + a.rng() * a.box.h;
      a.add({ ...em.bp(), x, y, vx: 0, vy: 0, homing: 0.05 * em.v, maxv: 1.9 * em.v, spin: 0.06 });
    }
  },
  burst(a, em) {
    if (every(a.f, rate(Math.round(72 * em.rm), a.tier))) {
      const cx = a.box.x + a.rng() * a.box.w, cy = a.box.y + a.rng() * a.box.h, n = em.ult ? 10 : 8;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        a.add({ ...em.bp(), x: cx, y: cy, vx: Math.cos(ang) * 1.5 * em.v, vy: Math.sin(ang) * 1.5 * em.v, life: 200 });
      }
    }
  },
};

// build a runnable pattern from a composed attack:
// spec = { emitters:[{preset,bullet,speed,qty}], ult, dur }
function customPattern(spec) {
  const list = (spec.emitters && spec.emitters.length) ? spec.emitters
               : [{ preset: 'rain', bullet: 'orb_m', speed: 'normal', qty: 'med' }];
  const ems = list.map(em => ({
    fn: EMITTER_FN[em.preset] || EMITTER_FN.rain,
    bp: () => bulletProps(em.bullet),
    v: emSpeedV(em.speed),
    rm: emQtyRate(em.qty),
    ult: !!spec.ult,
  }));
  return {
    dur: spec.dur || 480,
    tick(a) { for (const em of ems) em.fn(a, em); },
  };
}
'''

s2 = re.sub(r"function customPattern\(spec\) \{.*?\n\}\n(?=\n// ---------- bullet simulation)",
            NEW_PAT.replace('\\', '\\\\'), s, count=1, flags=re.DOTALL)
assert s2 != s, 'customPattern not replaced'
open(p, 'w', encoding='utf-8').write(s2)
print('patterns.js patched')

# ---------------- battle.js ----------------
p = ROOT + r'\battle.js'
s = open(p, encoding='utf-8').read()

def rep(old, new):
    global s
    assert old in s, 'battle NOT FOUND: ' + old[:60]
    s = s.replace(old, new, 1)

# sfxFor emitters
rep("  const b = def.custom && def.custom.bullet;",
    "  const em = def.custom && def.custom.emitters && def.custom.emitters[0];\n  const b = em && em.bullet;")

# instant defend/item at start of dodge
rep("""  const oppDef = oppMoveDef();
  B.dmgTaken = 0; B.tpGained = 0;
  B.bullets = [];""",
"""  const oppDef = oppMoveDef();
  B.dmgTaken = 0; B.tpGained = 0;
  // DEFEND / ITEM resolve instantly, before the dodge phase begins
  if (B.myAction.cmd === 'defend') B.me.tp = Math.min(100, B.me.tp + 16);
  if (B.myAction.cmd === 'item') {
    const it = ITEMS[B.me.items[B.myAction.move]];
    if (it) {
      B.me.hp = Math.min(B.me.max, B.me.hp + (it.heal || 0));
      B.me.tp = Math.min(100, B.me.tp + (it.tp || 0));
      B.me.items.splice(B.myAction.move, 1);
      Snd.play('cure');
      B.dmgPops.push({ x: 110, y: 250, txt: '+' + it.heal, t: 0, color: '#2f2' });
    }
  }
  B.bullets = [];""")

# remove defend/item from endDodge
rep("""  // apply my heals/items/defend AFTER dodging
  const c = B.myDef, a = B.myAction;
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
  if (a.cmd === 'magic') {""",
"""  // spell effects (heal / status) resolve after dodging
  const c = B.myDef, a = B.myAction;
  if (a.cmd === 'magic') {""")

# lancer facing in drawCharAnim
rep("""    if (def.hue) im = A.hued(im, def.hue);
    drawSpr(ctx, im, x, groundY - im.height / 2, { scale: 1, flip, alpha });""",
"""    if (def.hue) im = A.hued(im, def.hue);
    const fl = ENEMY_FACING[def.base] ? !flip : flip;
    drawSpr(ctx, im, x, groundY - im.height / 2, { scale: 1, flip: fl, alpha });""")

open(p, 'w', encoding='utf-8').write(s)
print('battle.js patched')
