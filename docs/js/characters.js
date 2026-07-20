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
    name: 'LANCER', color: '#4080ff', hp: 150,
    desc: 'BAD GUY. HO HO HO.\nSPADES AND MISCHIEF.',
    fight: { id: 'lancer_spade', name: 'Spade Toss', dmg: 26, dur: 420,
             text: 'LANCER throws spades! Ho ho ho!' },
    spells: [
      { id: 'lancer_storm', name: 'Spade Storm', tp: 35, dmg: 32, dur: 480, kind: 'attack',
        text: 'LANCER summons a SPADE STORM!' },
      { id: 'lancer_bike', name: 'Bike Charge', tp: 45, dmg: 42, dur: 480, kind: 'attack',
        text: 'LANCER rides through on his hog!' },
    ],
    ult: { id: 'lancer_ult', name: 'DEVILSKNIFE', tp: 100, dmg: 48, dur: 560, kind: 'attack',
           text: 'LANCER spins like the DEVILSKNIFE!!' },
    act: { id: 'hohoho', name: 'Ho Ho Ho!', desc: 'Flip foe controls',
           text: 'LANCER giggles! Something feels backwards...' },
  },
};

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
  balanced: { name: 'BALANCED', hp: 160, mult: 1.0, desc: 'Steady all-rounder' },
  tank:     { name: 'TANK', hp: 200, mult: 0.85, desc: 'Huge HP, softer hits' },
  glass:    { name: 'GLASS CANNON', hp: 120, mult: 1.25, desc: 'Fragile, hits HARD' },
  tricky:   { name: 'TRICKY', hp: 145, mult: 1.1, desc: 'Fast and mean' },
};
const ARCH_IDS = Object.keys(ARCHETYPES);

const WEAPONS = {
  sword: { name: 'SWORD', pattern: 'w_sword', dmg: 28, bullet: 'sword' },
  axe:   { name: 'AXE', pattern: 'w_axe', dmg: 34, bullet: 'axe' },
  scarf: { name: 'SCARF', pattern: 'w_scarf', dmg: 22, bullet: 'crescent' },
  ice:   { name: 'ICE MAGIC', pattern: 'w_ice', dmg: 24, bullet: 'icicle' },
  spade: { name: 'SPADES', pattern: 'w_spade', dmg: 26, bullet: 'spade' },
};
const WEAPON_IDS = Object.keys(WEAPONS);

const SPELL_TYPES = {
  rain:   { name: 'RAIN', tp: 40, dmg: 30, dur: 480, desc: 'falls from above' },
  sweep:  { name: 'SWEEP', tp: 35, dmg: 32, dur: 460, desc: 'rows sweep across' },
  spiral: { name: 'SPIRAL', tp: 45, dmg: 34, dur: 500, desc: 'spins from center' },
  fan:    { name: 'FAN', tp: 30, dmg: 28, dur: 440, desc: 'aimed spreads' },
  walls:  { name: 'WALLS', tp: 45, dmg: 34, dur: 500, desc: 'lanes with gaps' },
  homing: { name: 'HOMING', tp: 40, dmg: 30, dur: 460, desc: 'seeks your SOUL' },
  burst:  { name: 'BURST', tp: 35, dmg: 32, dur: 460, desc: 'exploding rings' },
  heal:   { name: 'HEAL', tp: 32, heal: 60, kind: 'heal', desc: 'restore 60 HP' },
  pacify: { name: 'PACIFY', tp: 16, kind: 'status', status: 'pacified', desc: 'weaken their press' },
  sleep:  { name: 'SLEEP MIST', tp: 24, kind: 'status', status: 'drowsy', desc: 'slow drowsy soul' },
};
const SPELL_TYPE_IDS = Object.keys(SPELL_TYPES);
const ATTACK_TYPE_IDS = SPELL_TYPE_IDS.filter(t => !SPELL_TYPES[t].kind);

const SPEEDS = {
  light:  { name: 'LIGHT', v: 0.8, dmg: 0.85, tp: -8 },
  normal: { name: 'NORMAL', v: 1.0, dmg: 1.0, tp: 0 },
  heavy:  { name: 'HEAVY', v: 1.25, dmg: 1.2, tp: 10 },
};
const SPEED_IDS = Object.keys(SPEEDS);

// bullets available in the attack builder ('crescent'/'star'/'note' are shapes)
const CC_BULLETS = ['sword', 'axe', 'flame', 'spark', 'orb_m', 'orb_l', 'diamond',
                    'ring', 'dart', 'shuriken', 'bone', 'spade', 'spade_pink',
                    'icicle', 'snowflake', 'shard', 'arc', 'arc_red',
                    'crescent', 'star', 'note'];

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
  const wp = WEAPONS[sel.weapon] || WEAPONS.sword;
  const name = (sel.name || 'PLAYER').toUpperCase();

  function mkSpell(sp, sid, ult) {
    const t = SPELL_TYPES[sp.type];
    if (t.kind) {   // heal / status
      return { id: sid, name: t.name, tp: t.tp, kind: t.kind, heal: t.heal,
               status: t.status,
               text: name + ' casts ' + t.name + '!' };
    }
    const spd = SPEEDS[sp.speed] || SPEEDS.normal;
    const label = (sp.bullet + ' ' + t.name).toUpperCase();
    return {
      id: sid, kind: 'attack',
      name: ult ? label + ' EX' : label,
      tp: ult ? 100 : Math.max(10, t.tp + spd.tp),
      dmg: Math.round(t.dmg * arch.mult * spd.dmg * (ult ? 1.35 : 1)),
      dur: Math.round(t.dur * (ult ? 1.25 : 1)),
      text: name + ' unleashes ' + label + (ult ? '!!' : '!'),
      custom: { ptype: sp.type, bullet: sp.bullet, speed: spd.v, ult: !!ult },
    };
  }

  return {
    id: 'custom', custom: true, base: sel.base || 'kris', hue: sel.hue || 0,
    name,
    color: rotateHue(CHARS[sel.base || 'kris'].color, sel.hue || 0),
    hp: arch.hp, arch: sel.arch,
    desc: arch.name + ' / ' + wp.name,
    fight: { id: wp.pattern, name: wp.name, dmg: Math.round(wp.dmg * arch.mult),
             dur: 420, text: name + ' attacks with the ' + wp.name + '!',
             custom: { ptype: 'weapon_' + (sel.weapon || 'sword'), bullet: wp.bullet, speed: 1 } },
    spells: [mkSpell(sel.spells[0], 'cs0'), mkSpell(sel.spells[1], 'cs1')],
    ult: mkSpell(sel.ult, 'cu', true),
    act: { ...ACTS[sel.act || 'taunt'],
           text: name + ' uses ' + ACTS[sel.act || 'taunt'].name + '!' },
    theme: sel.theme || 'rude_buster_general',
  };
}
