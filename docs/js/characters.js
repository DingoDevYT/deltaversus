// Character kits: stats, moves, spells, acts, ultimates.
// Every damaging move maps to a pattern id in patterns.js.
// dmg = damage per bullet hit at tier 1 (tier 0 = x0.75, tier 2 = x1.5).

const CHARS = {
  kris: {
    name: 'KRIS', color: '#00c0ff', hp: 160,
    desc: 'THE LEADER. BALANCED.\nCOMMANDS THE BLADE.',
    fight: { id: 'kris_slash', name: 'Slash', dmg: 28, dur: 420,
             text: 'KRIS attacks with the sword!' },
    spells: [
      { id: 'kris_cross', name: 'X-Slash', tp: 30, dmg: 34, dur: 480, kind: 'attack',
        text: 'KRIS carves an X into the air!' },
    ],
    ult: { id: 'kris_giga', name: 'GIGASLASH', tp: 100, dmg: 46, dur: 560, kind: 'attack',
           text: 'KRIS unleashes GIGASLASH!!' },
    act: { id: 'taunt', name: 'Taunt', desc: 'Shrink foe box',
           text: 'KRIS taunted! The enemy box shrinks next turn!' },
  },
  susie: {
    name: 'SUSIE', color: '#ff00ff', hp: 190,
    desc: 'RECKLESS POWERHOUSE.\nHITS LIKE A TRUCK.',
    fight: { id: 'susie_axe', name: 'Axe Swing', dmg: 34, dur: 420,
             text: 'SUSIE swings the axe wildly!' },
    spells: [
      { id: 'susie_rude', name: 'Rude Buster', tp: 50, dmg: 40, dur: 500, kind: 'attack',
        text: 'SUSIE fires RUDE BUSTER!' },
    ],
    ult: { id: 'susie_ult', name: 'BUSTER RAMPAGE', tp: 100, dmg: 50, dur: 560, kind: 'attack',
           text: 'SUSIE goes on a RAMPAGE!!' },
    act: { id: 'intimidate', name: 'Intimidate', desc: 'Slow foe soul',
           text: 'SUSIE glares... the enemy SOUL feels heavy!' },
  },
  ralsei: {
    name: 'RALSEI', color: '#00ff80', hp: 140,
    desc: 'FLUFFY PRINCE OF DARK.\nHEALS AND SOOTHES.',
    fight: { id: 'ralsei_scarf', name: 'Scarf Whip', dmg: 22, dur: 420,
             text: 'RALSEI whips the scarf!' },
    spells: [
      { id: 'heal', name: 'Heal Prayer', tp: 32, heal: 60, kind: 'heal',
        text: 'RALSEI prays... HP recovered!' },
      { id: 'pacify', name: 'Pacify', tp: 16, kind: 'status', status: 'pacified',
        text: 'RALSEI casts PACIFY! The enemy attack weakens!' },
    ],
    ult: { id: 'ralsei_ult', name: 'DREAM CHORUS', tp: 100, dmg: 36, dur: 560, kind: 'attack',
           heal: 50, text: 'RALSEI sings a DREAM CHORUS!!' },
    act: { id: 'compliment', name: 'Compliment', desc: 'Distract with love',
           text: 'RALSEI compliments you so sweetly it is distracting!' },
  },
  noelle: {
    name: 'NOELLE', color: '#ffff00', hp: 130,
    desc: 'FRAGILE ICE MAGE.\nTERRIFYING POTENTIAL.',
    fight: { id: 'noelle_snow', name: 'Snow Toss', dmg: 24, dur: 420,
             text: 'NOELLE tosses snow... sorry!' },
    spells: [
      { id: 'noelle_ice', name: 'IceShock', tp: 40, dmg: 38, dur: 500, kind: 'attack',
        text: 'NOELLE casts ICESHOCK!' },
      { id: 'sleepmist', name: 'Sleep Mist', tp: 24, kind: 'status', status: 'drowsy',
        text: 'NOELLE breathes SLEEP MIST... so sleepy...' },
    ],
    ult: { id: 'snowgrave', name: 'SNOWGRAVE', tp: 100, dmg: 60, dur: 600, kind: 'attack',
           text: 'NOELLE casts the forbidden SNOWGRAVE...' },
    act: { id: 'nervouslaugh', name: 'NervousLaugh', desc: 'Rush foe timer',
           text: 'NOELLE laughs nervously. The pressure is on!' },
  },
  lancer: {
    name: 'LANCER', color: '#4080ff', hp: 220,
    desc: 'BAD GUY. HO HO HO.\nSPADES AND MISCHIEF.',
    fight: { id: 'lancer_spade', name: 'Spade Toss', dmg: 26, dur: 420,
             text: 'LANCER throws spades! Ho ho ho!' },
    spells: [
      { id: 'lancer_storm', name: 'Spade Storm', tp: 35, dmg: 32, dur: 480, kind: 'attack',
        text: 'LANCER summons a SPADE STORM!' },
      { id: 'lancer_bike', name: 'Bike Charge', tp: 45, dmg: 42, dur: 480, kind: 'attack', darkReq: 34,
        text: 'LANCER rides through on his hog!' },
    ],
    ult: { id: 'lancer_ult', name: 'DEVILSKNIFE', tp: 100, dmg: 48, dur: 560, kind: 'attack', darkReq: 68,
           text: 'LANCER spins like the DEVILSKNIFE!!' },
    act: { id: 'hohoho', name: 'Ho Ho Ho!', desc: 'Flip foe controls',
           text: 'LANCER giggles! Something feels backwards...' },
  },
  berdly: {
    name: 'BERDLY', color: '#2aa0ff', hp: 135, cost: 1,
    desc: 'THE SMART ONE.\nHIGH PROJECTILE VARIETY.',
    fight: { id: 'berdly_fight', name: 'Feather Toss', dmg: 26, dur: 420,
             text: 'BERDLY flings feathers, smartly!' },
    spells: [
      { id: 'berdly_bolt', name: 'Blue Bolt', tp: 34, dmg: 30, dur: 480, kind: 'attack',
        text: 'BERDLY strikes with BLUE BOLTS!' },
      { id: 'berdly_books', name: 'Smart Rain', tp: 42, dmg: 30, dur: 480, kind: 'attack',
        text: 'BERDLY rains down SMART bullets!' },
    ],
    ult: { id: 'berdly_ult', name: 'SMART RACE', tp: 100, dmg: 40, dur: 560, kind: 'attack',
           text: 'BERDLY goes ALL OUT!!' },
    act: { id: 'taunt', name: 'Gloat', desc: 'Shrink foe box',
           text: 'BERDLY gloats! Their box shrinks!' },
  },
  jevil: {
    name: 'JEVIL', color: '#7a5cff', hp: 1000, cost: 3, darkner: true, secretBoss: true,
    desc: 'CHAOS, CHAOS!\nSECRET BOSS - 1000 HP, NO ITEMS.',
    fight: { id: 'jevil_spade', name: 'Spade Fan', dmg: 26, dur: 440,
             text: 'JEVIL flings spinning spades!' },
    spells: [
      { id: 'jevil_diamond', name: 'Diamond Rain', tp: 38, dmg: 30, dur: 500, kind: 'attack',
        text: 'JEVIL scatters DIAMONDS!' },
      { id: 'jevil_carousel', name: 'Carousel', tp: 48, dmg: 34, dur: 520, kind: 'attack', darkReq: 34,
        text: 'JEVIL spins the CAROUSEL!' },
    ],
    ult: { id: 'jevil_ult', name: 'DEVILSKNIFE', tp: 100, dmg: 50, dur: 600, kind: 'attack', darkReq: 68,
           text: 'JEVIL unleashes DEVILSKNIFE!! Metamorphosis!' },
    act: { id: 'intimidate', name: 'Chaos', desc: 'Slow foe soul',
           text: 'JEVIL cackles! CHAOS, CHAOS!' },
  },
};
// party-cost + darkner defaults (used by party-size + darkness systems)
for (const id in CHARS) {
  if (CHARS[id].cost == null) CHARS[id].cost = 1;
  if (CHARS[id].darkner == null) CHARS[id].darkner = false;
}
CHARS.lancer.cost = 2; CHARS.lancer.darkner = true;

// ACT effects: statuses applied to the opponent, active during their next dodge
// (and/or their next select phase). One turn only.
const ACT_FX = {
  taunt:        { boxScale: 0.72 },
  intimidate:   { soulSpeed: 0.7 },
  compliment:   { hearts: true },
  nervouslaugh: { timerScale: 0.5 },
  hohoho:       { invertX: true },
  pacified:     { tierCap: 0 },     // from Ralsei's Pacify spell
  drowsy:       { soulSpeed: 0.82, drift: true }, // from Sleep Mist
};

const ITEMS = {
  darkburger:   { name: 'Darkburger',    heal: 70, desc: 'Heals 70 HP' },
  cdbagel:      { name: 'CD Bagel',      heal: 50, desc: 'Heals 50 HP' },
  chocodiamond: { name: 'ChocoDiamond',  heal: 40, tp: 16, desc: 'Heals 40 HP +16 TP' },
  darkcandy:    { name: 'Dark Candy',    heal: 30, desc: 'Heals 30 HP' },
};
const LOADOUT_SIZE = 3;

const TIER_MULT = [0.75, 1.0, 1.5];
const TIER_NAME = ['WEAK', 'GOOD', 'PERFECT!'];

// ================= CUSTOM CHARACTER CREATOR DATA =================
const ARCHETYPES = {
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
  spark: 0, orb_s: 0, orb_m: 0, star: 0, toebean: 0,
  orb_l: 1, diamond: 1, sword: 1, dart: 1, spade: 1, spade_pink: 1, note: 1, shard: 1, crescent: 1, ring: 1,
  egg: 1, carrot: 1, knife: 1, yarn: 1, catface: 1, kdiamond: 1, kstar: 1, ktriangle: 1,
  redring: 1, bell: 1, dice: 1, dice4: 1, umbrella2: 1, trash: 1, lamp: 1, ring2: 1,
  axe: 2, arc: 2, arc_red: 2, shuriken: 2, bone: 2, flame: 2, snowflake: 2, icicle: 2,
  umbrella: 2, scissors: 2, gflame: 2, ghostfire: 2, lightning: 2, flame_m: 2,
  sparkle: 0, healspark: 0, knife: 1, bspade: 1, bdiamond: 1, bheart: 1, bclub: 1,
  feather: 1, icehex: 1, icesnow: 1, scythe: 2, tornado: 2, spear: 2, rudebeam: 2,
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
}

const ACTS = {
  taunt:        { id: 'taunt', name: 'Taunt', desc: 'Shrink foe box' },
  intimidate:   { id: 'intimidate', name: 'Intimidate', desc: 'Slow foe soul' },
  compliment:   { id: 'compliment', name: 'Compliment', desc: 'Distract with love' },
  nervouslaugh: { id: 'nervouslaugh', name: 'NervousLaugh', desc: 'Rush foe timer' },
  hohoho:       { id: 'hohoho', name: 'Ho Ho Ho!', desc: 'Flip foe controls' },
};
const ACT_IDS = Object.keys(ACTS);

const THEMES = [
  { key: 'rude_buster_general', name: 'RUDE BUSTER' },
  { key: 'ruder_buster_general', name: 'RUDER BUSTER' },
  { key: 'vs_susie_susie', name: 'VS. SUSIE' },
  { key: 'from_now_on_ralsei', name: 'FROM NOW ON' },
  { key: 'vs_lancer_lancer', name: 'VS. LANCER' },
  { key: 'vs_noelle_noelle', name: 'VS. NOELLE' },
  { key: 'smart_race_berdly', name: 'SMART RACE' },
  { key: 'now_s_your_chance_to_be_a_big_spamton', name: 'BIG SHOT CHANCE' },
  { key: 'big_shot_spamton_neo', name: 'BIG SHOT' },
  { key: 'attack_of_the_killer_queen_queen', name: 'KILLER QUEEN' },
  { key: 'black_knife_the_roaring_knight', name: 'BLACK KNIFE' },
];

// rotate a hex color's hue by deg (for custom char accent colors)
function rotateHue(hex, deg) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `hsl(${Math.round(h + deg) % 360},${Math.round(s * 100)}%,${Math.round(l * 100)}%)`;
}

const BASE_HP = { kris: 160, susie: 190, ralsei: 140, noelle: 130, lancer: 150 };

// normalize a character selection (string id OR custom def object) into a
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
}