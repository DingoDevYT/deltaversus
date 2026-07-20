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
