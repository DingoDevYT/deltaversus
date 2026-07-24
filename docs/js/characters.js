// Character kits: stats, moves, spells, acts, ultimates.
// Every damaging move maps to a pattern id in patterns.js.
// dmg = damage per bullet hit at tier 1 (tier 0 = x0.75, tier 2 = x1.5).

const CHARS = {
  kris: {
    name: 'KRIS', color: '#00c0ff', hp: 160, level: 1, spare: { never: true },
    desc: 'THE LEADER. BALANCED.\nCOMMANDS THE BLADE.',
    fight: { id: 'kris_slash', name: 'Slash', dmg: 28, dur: 420,
             text: 'KRIS attacks with the sword!' },
    spells: [],   // KRIS is magicless - no MAGIC, no ult; everything is an ACT
    // KRIS is the only character with the ACT menu (single acts + Kris multi-acts).
    acts: [
      { id: 'act_check', name: 'Check', kind: 'mercy', mercy: 20, text: 'KRIS sizes up the foe.' },
      { id: 'act_motivate', name: 'Motivate', tp: 30, kind: 'demercy', mercyDown: 10,
        text: 'KRIS motivates the party - shaving 10% MERCY off each ally so the foe can\'t SPARE them.' },
      { id: 'act_xslash', name: 'X-Slash', tp: 25, dmg: 34, dur: 480, kind: 'attack', pattern: 'kris_cross',
        mercy: 8, lvl3: true, text: 'KRIS carves an X into the air!' },
      { id: 'act_redbuster', name: 'Red-Buster', tp: 60, dmg: 46, dur: 500, kind: 'attack', pattern: 'redbuster',
        ally: 'susie', lvl3: true, text: 'KRIS & SUSIE fire the RED BUSTER!' },
      { id: 'act_dualheal', name: 'Dual-Heal', tp: 50, kind: 'healAll', heal: 70,
        ally: 'ralsei', lvl3: true, text: 'KRIS & RALSEI heal the party!' },
      { id: 'act_northern', name: 'Northernlight', tp: 50, kind: 'buff', buff: 'guard',
        ally: 'noelle', lvl3: true, text: 'KRIS & NOELLE raise the NORTHERN LIGHT!' },
      { id: 'act_lockin', name: 'Lock In', tp: 75, kind: 'buff', buff: 'power',
        ally: 'berdly', lvl3: true, text: 'KRIS & BERDLY LOCK IN!' },
      { id: 'act_proceed', name: 'Proceed', tp: 0, kind: 'proceed', mercy: 20,
        ally: 'noelle', lvl3: true, text: 'KRIS says: ...proceed.' },
    ],
  },
  susie: {
    name: 'SUSIE', color: '#ff00ff', hp: 190, level: 1, spare: { alone: true },
    desc: 'RECKLESS POWERHOUSE.\nHITS LIKE A TRUCK.',
    fight: { id: 'susie_axe', name: 'Axe Swing', dmg: 34, dur: 420,
             text: 'SUSIE swings the axe wildly!' },
    spells: [
      { id: 'susie_saction', name: 'S-Action', tp: 8, kind: 'mercy', mercy: 15,
        text: 'SUSIE does her thing. (+MERCY)' },
      { id: 'susie_rude', name: 'Rude Buster', tp: 50, dmg: 40, dur: 500, kind: 'attack',
        text: 'SUSIE fires RUDE BUSTER!' },
      { id: 'susie_betterheal', name: 'Better Heal', tp: 80, heal: 120, kind: 'heal',
        text: 'SUSIE heals... surprisingly gently!' },
    ],
    ult: { id: 'susie_ult', name: 'BUSTER RAMPAGE', tp: 100, dmg: 50, dur: 560, kind: 'attack',
           text: 'SUSIE goes on a RAMPAGE!!' },
  },
  ralsei: {
    name: 'RALSEI', color: '#00ff80', hp: 140, level: 1, spare: {},
    desc: 'FLUFFY PRINCE OF DARK.\nHEALS AND SOOTHES.',
    fight: { id: 'ralsei_scarf', name: 'Scarf Whip', dmg: 22, dur: 420,
             text: 'RALSEI whips the scarf!' },
    spells: [
      { id: 'ralsei_raction', name: 'R-Action', tp: 8, kind: 'mercy', mercy: 15,
        text: 'RALSEI encourages the foe. (+MERCY)' },
      { id: 'heal', name: 'Heal Prayer', tp: 32, heal: 60, kind: 'heal',
        text: 'RALSEI prays... HP recovered!' },
      { id: 'pacify', name: 'Pacify', tp: 16, kind: 'spareTired', scope: 'one',
        text: 'RALSEI casts PACIFY!' },
      { id: 'ralsei_revive', name: 'Revive Song', tp: 85, kind: 'revive', revive: 0.5,
        text: 'RALSEI sings a REVIVE SONG!' },
    ],
    ult: { id: 'ralsei_ult', name: 'DREAM CHORUS', tp: 100, dmg: 36, dur: 560, kind: 'attack',
           heal: 50, text: 'RALSEI sings a DREAM CHORUS!!' },
  },
  noelle: {
    name: 'NOELLE', color: '#ffff00', hp: 130, level: 1, spare: { noKris: true },
    desc: 'FRAGILE ICE MAGE.\nTERRIFYING POTENTIAL.',
    fight: { id: 'noelle_snow', name: 'Snow Toss', dmg: 24, dur: 420,
             text: 'NOELLE tosses snow... sorry!' },
    spells: [
      { id: 'noelle_naction', name: 'N-Action', tp: 8, kind: 'mercy', mercy: 15,
        text: 'NOELLE hesitates... (+MERCY)' },
      { id: 'heal', name: 'Heal Prayer', tp: 32, heal: 30, kind: 'heal',
        text: 'NOELLE prays... a little HP back.' },
      { id: 'sleepmist', name: 'Sleep Mist', tp: 32, kind: 'spareTired', scope: 'all',
        text: 'NOELLE breathes SLEEP MIST...' },
      { id: 'noelle_ice', name: 'Ice Shock', tp: 8, dmg: 22, dur: 460, kind: 'attack',
        text: 'NOELLE casts ICE SHOCK!' },
    ],
    ult: { id: 'snowgrave', name: 'SNOWGRAVE', tp: 100, dmg: 1000, dur: 170, kind: 'attack',
           snowgrave: true, text: 'NOELLE casts the forbidden SNOWGRAVE...' },
  },
  lancer: {
    name: 'LANCER', color: '#4080ff', hp: 220, level: 2, spare: {},
    desc: 'BAD GUY. HO HO HO.\nSPADES AND MISCHIEF.',
    fight: { id: 'lancer_spade', name: 'Spade Toss', dmg: 26, dur: 420,
             text: 'LANCER throws spades! Ho ho ho!' },
    spells: [
      { id: 'lancer_storm', name: 'Spade Storm', tp: 35, dmg: 32, dur: 480, kind: 'attack', darkReq: 17,
        text: 'LANCER summons a SPADE STORM!' },
      { id: 'lancer_bike', name: 'Bike Charge', tp: 45, dmg: 42, dur: 480, kind: 'attack', darkReq: 51,
        text: 'LANCER rides through on his hog!' },
    ],
    ult: { id: 'lancer_ult', name: 'COOL ATTACK', tp: 100, dmg: 48, dur: 620, kind: 'attack', darkReq: 85,
           text: 'LANCER unleashes his COOL ATTACK!! Ho ho ho!!' },
    act: { id: 'act_praise', name: 'Praise', kind: 'mercy', mercy: 26, text: 'KRIS praises LANCER! He grins. Ho ho ho!' },
  },
  berdly: {
    name: 'BERDLY', color: '#2aa0ff', hp: 135, cost: 1, level: 3, spare: { fullHp: true }, mercyGain: 1.6,
    desc: 'THE SMART ONE.\nHIGH PROJECTILE VARIETY.',
    fight: { id: 'berdly_fight', name: 'Halberd', dmg: 26, dur: 420,
             text: 'BERDLY swings his halberd!' },
    spells: [
      { id: 'berdly_baction', name: 'B-Action', tp: 8, kind: 'mercy', mercy: 15,
        text: 'BERDLY monologues. (+MERCY)' },
      { id: 'berdly_bolt', name: 'Winged Saviour', tp: 16, dmg: 24, dur: 460, kind: 'attack',
        text: 'BERDLY summons the WINGED SAVIOUR!' },
      { id: 'berdly_books', name: 'Halberdly', tp: 32, dmg: 32, dur: 480, kind: 'attack',
        text: 'BERDLY strikes with HALBERDLY!' },
      { id: 'berdly_papers', name: 'A++++', tp: 50, dmg: 34, dur: 480, kind: 'attack',
        text: 'BERDLY grades you: A++++!' },
    ],
    ult: { id: 'berdly_ult', name: 'SMART RACE', tp: 100, dmg: 40, dur: 560, kind: 'attack',
           text: 'BERDLY goes ALL OUT!!' },
  },
  jevil: {
    name: 'JEVIL', color: '#7a5cff', hp: 1000, cost: 3, darkner: true, secretBoss: true, level: 3, spare: {}, mercyGain: 0.22,
    desc: 'CHAOS, CHAOS!\nSECRET BOSS - 1000 HP, NO ITEMS.',
    maxLevel: 10,   // DARKNESS: FIGHT = ACTIVE attacks (free, unlock by level); MAGIC = SPELLs (TP); CHARGE@max = ULT
    basics: [
      { id: 'jevil_spade',     name: 'Five of Spades', dmg: 30, dur: 380, darkLvl: 0, text: 'JEVIL teleports and flings SPADES!' },
      { id: 'jevil_ring',      name: 'Ace Spiral I',   dmg: 30, dur: 360, darkLvl: 0, text: 'JEVIL rings you with SPADES!' },
      { id: 'jevil_clubs',     name: 'Three of Clubs', dmg: 55, dur: 360, darkLvl: 2, text: 'JEVIL rockets in CLUBS!' },
      { id: 'jevil_carousel',  name: 'Carousel I',     dmg: 55, dur: 480, darkLvl: 3, text: 'JEVIL spins the CAROUSEL!' },
      { id: 'jevil_carousel2', name: 'Carousel II',    dmg: 55, dur: 480, darkLvl: 5, text: 'JEVIL spins the CAROUSEL — horses and all!' },
      { id: 'jevil_ring2',     pattern: 'jevil_ring',     name: 'Ace Spiral II', dmg: 55, dur: 360, darkLvl: 6, text: 'JEVIL winds a WIDER SPIRAL!' },
      { id: 'jevil_carousel3', pattern: 'jevil_carousel2', name: 'Carousel III', dmg: 60, dur: 480, darkLvl: 7, text: 'The CAROUSEL spins FASTER!' },
    ],
    spells: [
      { id: 'jevil_diamond',   name: 'Ace of Diamonds I',  tp: 32, dmg: 55, dur: 340, kind: 'attack', darkLvl: 1,  text: 'JEVIL hurls DIAMONDS!' },
      { id: 'jevil_scythes',   name: "Devil's Knife I",    tp: 40, dmg: 55, dur: 420, kind: 'attack', darkLvl: 4,  text: 'JEVIL summons DEVILSKNIVES!' },
      { id: 'jevil_bombs',     name: 'Suite Bomb',         tp: 48, dmg: 55, dur: 360, kind: 'attack', darkLvl: 8,  text: 'JEVIL drops a SUITE BOMB!' },
      { id: 'jevil_verticals', name: 'Ace of Diamonds II', tp: 52, dmg: 60, dur: 320, kind: 'attack', darkLvl: 9,  text: 'DIAMONDS pour from EVERYWHERE!' },
      { id: 'jevil_knife2', pattern: 'jevil_scythes', name: "Devil's Knife II", tp: 52, dmg: 60, dur: 420, kind: 'attack', darkLvl: 10, text: 'DEVILSKNIVES — even FASTER!' },
    ],
    ult: { id: 'jevil_ult', name: 'CHAOS, CHAOS!', tp: 100, dmg: 60, dur: 600, kind: 'attack',
           text: 'JEVIL unleashes CHAOS, CHAOS!! Metamorphosis!' },
    act: { id: 'act_play', name: 'Play', kind: 'mercy', mercy: 20, text: 'KRIS plays JEVIL\'s game! CHAOS, CHAOS!' },
  },
  spamton: {
    name: 'SPAMTON NEO', shortName: 'S. NEO', color: '#ff5cc8', hp: 1200, cost: 3, secretBoss: true, level: 3, spare: {}, mercyGain: 0.22,
    dscale: 0.6, yoff: 18,   // marionette puppet is a big multi-part sprite - scale down + sit it on the line
    soulYellow: true,   // dodging his attacks uses the yellow SOUL (shoots right)
    act: { id: 'act_deal', name: 'Deal', kind: 'mercy', mercy: 22, text: 'KRIS hears out [[SPAMTON]]\'s deal...' },
    desc: '[[BIG SHOT]] SECRET BOSS.\n1200 HP - NO ITEMS.',
    maxLevel: 10,
    basics: [
      { id: 'sneo_heads', name: "1T's m3!!",      dmg: 30, dur: 460, darkLvl: 0,  text: 'SPAMTON NEO launches his HEADS!' },
      { id: 'sneo_heart', name: 'HEART ATTACK I', dmg: 55, dur: 520, darkLvl: 0,  text: 'SPAMTON NEO swings his [[HEART]]!' },
      { id: 'sneo_pipis', name: "IT'S F0R Y0U",   dmg: 55, dur: 460, darkLvl: 1,  text: 'SPAMTON NEO has [[A CALL FOR YOU]]!' },
      { id: 'sneo_pipisx', name: 'PIPIS BOMB I',  dmg: 55, dur: 300, darkLvl: 5,  text: 'SPAMTON NEO drops the [[PIPIS]]!' },
      { id: 'sneo_pipisbomb2', pattern: 'sneo_pipisx', name: 'PIPIS BOMB II', dmg: 60, dur: 300, darkLvl: 7,  text: 'A BIGGER [[PIPIS BOMB]]!' },
      { id: 'sneo_heart2',     pattern: 'sneo_heart',  name: 'HEART ATTACK II', dmg: 60, dur: 520, darkLvl: 10, text: 'SPAMTON NEO swings his [[HEART]] — HARDER!' },
    ],
    spells: [
      { id: 'sneo_face',    name: 'BIG FACE I',          tp: 40, dmg: 55, dur: 520, kind: 'attack', darkLvl: 2,  text: 'SPAMTON NEO shows his [[FACE]]!' },
      { id: 'sneo_columns', name: "YOU've G0t mA1l! I",  tp: 40, dmg: 55, dur: 560, kind: 'attack', darkLvl: 3,  text: 'SPAMTON NEO calls the [[RECREW]]!' },
      { id: 'sneo_phones',  name: 'GRIPPING PHONES I',   tp: 44, dmg: 55, dur: 500, kind: 'attack', darkLvl: 4,  text: 'SPAMTON NEO GRIPS the PHONES!' },
      { id: 'sneo_columns2', pattern: 'sneo_columns', name: "YOU've G0t mA1l! II", tp: 48, dmg: 60, dur: 560, kind: 'attack', darkLvl: 6, text: 'MORE of the [[RECREW]]!' },
      { id: 'sneo_face2',    pattern: 'sneo_face',   name: 'BIG FACE II',        tp: 48, dmg: 60, dur: 520, kind: 'attack', darkLvl: 8, text: 'SPAMTON NEO gets IN YOUR [[FACE]]!' },
      { id: 'sneo_phones2',  pattern: 'sneo_phones', name: 'GRIPPING PHONES II', tp: 52, dmg: 60, dur: 500, kind: 'attack', darkLvl: 9, text: 'The PHONES GRIP TIGHTER!' },
    ],
    ult: { id: 'sneo_bigshot', name: 'BIG SHOT', tp: 100, dmg: 66, dur: 1000, kind: 'attack',
           text: 'SPAMTON NEO: [[NOW\'S YOUR CHANCE TO BE A]] BIG SHOT!!' },
  },
  knight: {
    name: 'KNIGHT', color: '#e8e8ff', hp: 1500, cost: 3, secretBoss: true, level: 3, spare: { never: true },
    dscale: 0.82, bob: true, afterimage: 12,   // hovers + trails ghost afterimages
    desc: 'THE ROARING KNIGHT.\nFINAL SECRET BOSS - 1500 HP.',
    // REBUILT 1:1 from the Ch3 obj_knight_enemy GML (see knight_specs/). 5 core attacks, each with
    // its 3 phase variants (per the wiki attack table), + THE ROARING ult. (Sword Vortex removed —
    // it's not a standalone attack; it's the Tracking Swords P2 "you feel surrounded" circle.)
    maxLevel: 10,
    // FIGHT (ACTIVE): Dark Stars / Black Knives / Omnislash (I/II/III). MAGIC (SPELL): Sword Corridor + Box Split.
    basics: [
      { id: 'knight_stars',     name: 'Dark Stars I',   dmg: 30, dur: 205, darkLvl: 0,  text: 'THE KNIGHT calls down DARK STARS!' },
      { id: 'knight_tracking',  name: 'Black Knives I', dmg: 30, dur: 230, darkLvl: 0,  text: 'THE KNIGHT aims BLACK KNIVES!' },
      { id: 'knight_rotslash',  name: 'Omnislash I',    dmg: 30, dur: 250, darkLvl: 0,  text: 'THE KNIGHT carves an OMNISLASH!' },
      { id: 'knight_stars2',    name: 'Dark Stars II',   dmg: 55, dur: 205, darkLvl: 1,  text: 'The DARK STARS burst SIXFOLD!' },
      { id: 'knight_rotslash2', name: 'Omnislash II',    dmg: 55, dur: 250, darkLvl: 2,  text: 'Your chest TWISTS!' },
      { id: 'knight_tracking2', name: 'Black Knives II', dmg: 55, dur: 250, darkLvl: 3,  text: 'You feel SURROUNDED!' },
      { id: 'knight_stars3',    name: 'Dark Stars III',  dmg: 60, dur: 205, darkLvl: 6,  text: 'The STARS turn RED and HUNT you!' },
      { id: 'knight_tracking3', name: 'Black Knives III',dmg: 60, dur: 210, darkLvl: 9,  text: 'The world REVOLVES around you!' },
      { id: 'knight_rotslash3', name: 'Omnislash III',   dmg: 60, dur: 326, darkLvl: 10, text: 'Your heartbeat becomes TWISTED!' },
    ],
    spells: [
      { id: 'knight_tunnel',  name: 'Sword Corridor I',   tp: 32, dmg: 30, dur: 252, kind: 'attack', darkLvl: 0, text: 'THE KNIGHT opens a SWORD CORRIDOR!' },
      { id: 'knight_flurry',  name: 'Box Split I',        tp: 40, dmg: 55, dur: 300, kind: 'attack', darkLvl: 4, text: 'THE KNIGHT CLEAVES the board!' },
      { id: 'knight_tunnel2', name: 'Sword Corridor II',  tp: 42, dmg: 55, dur: 252, kind: 'attack', darkLvl: 5, text: 'Your head is SPINNING!' },
      { id: 'knight_flurry2', name: 'Box Split II',       tp: 46, dmg: 60, dur: 300, kind: 'attack', darkLvl: 7, text: 'The winds blow from EVERY side!' },
      { id: 'knight_tunnel3', name: 'Sword Corridor III', tp: 48, dmg: 60, dur: 252, kind: 'attack', darkLvl: 8, text: 'You feel CORNERED!' },
    ],
    ult: { id: 'knight_roar', name: 'ROAR FROM THE DEPTHS', tp: 100, dmg: 72, dur: 430, kind: 'attack',
           text: 'THE KNIGHT lets out a ROAR FROM THE DEPTHS!!' },
  },
  gerson: {
    name: 'GERSON', color: '#5bb84a', hp: 1400, cost: 3, secretBoss: true, level: 3, spare: {}, mercyGain: 0.22,
    dscale: 1.15, yoff: 4,
    hair: { key: 'ghair', n: 5, rate: 6, dx: 2, dy: -14, scale: 1 },   // spr_gerson_hair — pivots at its LEFT edge on the back of his head
    desc: 'GERSON BOOM - the HAMMER OF JUSTICE.\nGREEN SOUL spells: BLOCK, don\'t dodge!',
    // ALL 21 real Hammer-of-Justice attacks (wiki order). GREEN = BLOCK by facing the spear's side (0 dmg
    // on a clean block); RED = free-move dodge. Attack 14 is a repeat of 8, 21 is the final.
    maxLevel: 10,
    // FIGHT (ACTIVE) = two parallel tracks, Spear Volley I-IV + Shell Volley I-IV (unlock by level).
    // MAGIC (SPELL) = the hammer/shell specials. GREEN SOUL: block, don't dodge.
    basics: [
      { id: 'gn_atk1',  name: 'Spear Volley I',   dmg: 55, dur: 320, darkLvl: 0, text: 'GREEN SOUL! BLOCK the SPEARS — face each one!' },
      { id: 'gn_atk11', name: 'Shell Volley I',   dmg: 55, dur: 480, darkLvl: 0, text: 'FOUR shells, then shell-and-arrow arcs!' },
      { id: 'gn_atk4',  name: 'Spear Volley II',  dmg: 55, dur: 360, darkLvl: 1, text: 'Fast crossfire with slow sleepers!' },
      { id: 'gn_atk10', name: 'Shell Volley II',  dmg: 55, dur: 420, darkLvl: 2, text: 'Spear rows, then bouncing SHELLS!' },
      { id: 'gn_atk9',  name: 'Spear Volley III', dmg: 55, dur: 320, darkLvl: 3, text: 'Spears rain from the UPPER arc!' },
      { id: 'gn_atk15', name: 'Shell Volley III', dmg: 60, dur: 380, darkLvl: 5, text: 'CYAN shells spin 90° — and fast spears!' },
      { id: 'gn_atk18', name: 'Spear Volley IV',  dmg: 60, dur: 560, darkLvl: 7, text: '32 spears from all sides, speeding up!' },
      { id: 'gn_atk20', name: 'Shell Volley IV',  dmg: 60, dur: 560, darkLvl: 8, text: 'A full CYAN-shell assault!' },
    ],
    spells: [
      { id: 'gn_atk6',  name: 'Falling Hammer',      tp: 32, dmg: 55, dur: 360, kind: 'attack', darkLvl: 0,  text: 'A HAMMER falls — then GERSON slashes!' },
      { id: 'gn_atk7',  name: 'Shell Bounce',        tp: 32, dmg: 55, dur: 300, kind: 'attack', darkLvl: 0,  text: 'GERSON kicks a SHELL around the board!' },
      { id: 'gn_atk8',  name: 'Hammer Time',         tp: 40, dmg: 55, dur: 403, kind: 'attack', darkLvl: 4,  text: 'GERSON hurls HAMMERS + a giant one!' },
      { id: 'gn_atk13', name: 'Thorough Walloping',  tp: 44, dmg: 55, dur: 600, kind: 'attack', darkLvl: 6,  text: 'GERSON SQUISHES the box — thread the SLASHES!' },
      { id: 'gn_atk14', name: 'Hammer Time II',      tp: 52, dmg: 60, dur: 403, kind: 'attack', darkLvl: 9,  text: 'Another HAMMER barrage — RELENTLESS!' },
      { id: 'gn_atk19', name: 'Deluge of 48',        tp: 52, dmg: 60, dur: 640, kind: 'attack', darkLvl: 10, text: '48 spears — slow, but RELENTLESS!' },
    ],
    ult: { id: 'gn_atk21', name: 'Trial of the Holy Hammer', tp: 100, dmg: 60, dur: 620, kind: 'attack',
           text: 'GERSON unleashes the TRIAL OF THE HOLY HAMMER!!' },
  },
  pink: {
    name: 'PINK', color: '#ff5ca8', hp: 1300, cost: 3, secretBoss: true, level: 3,
    // PINK is spared through her DOKI: you can't build MERCY the normal way — you fill the DOKI meter by
    // collecting doki-hearts during her attacks, which triggers her DATE minigames, and clear the FINAL
    // date. dokiSpare gates canSpare on dokiPhase (obj_pink_enemy datecount). (spare:{} keeps her non-'never'.)
    // SPARE = DOKI route (Flirt acts/spells build DOKI 10->15->20; DATE minigames between; darkness forced to
    // 0 entering the final stretch). Only teams with SPARE can take it — others must KILL her. Hearts = +1 TP.
    spare: {}, dokiSpare: true, dokiThresholds: [10, 15, 20], dokiPhases: 3, maxLevel: 10,
    act: { id: 'act_flirt', name: 'Flirt', kind: 'doki', doki: 1, text: 'KRIS flirts with PINK! (+DOKI)' },
    dscale: 1.0, yoff: 4,
    desc: 'PINK - the mew magical-girl idol (Ch5).\nFLIRT to fill her DOKI + clear the DATES to SPARE.',
    basics: [
      { id: 'pink_cats',     name: 'Cats',         dmg: 30, dur: 340, darkLvl: 0, text: 'PINK sends in the CATS!' },
      { id: 'pink_plusgrid', name: 'Plus-Grid',    dmg: 30, dur: 420, darkLvl: 0, text: 'PINK lines up the CATS!' },
      { id: 'pink_bombs',    name: 'Pinata Bombs', dmg: 30, dur: 300, darkLvl: 0, text: 'PINK drops PINATA BOMBS!' },
      { id: 'pink_cats2',    name: 'Cat Conga',    dmg: 55, dur: 360, darkLvl: 2, text: 'PINK forms a CAT CONGA line!' },
      { id: 'pink_plusgrid2',name: 'Plus-Grid+',   dmg: 55, dur: 420, darkLvl: 4, text: 'PINK snaps the GRID tighter!' },
      { id: 'pink_bombsfin', name: 'Bomb Finale',  dmg: 60, dur: 560, darkLvl: 7, text: 'PINK unleashes a BOMB FINALE!' },
    ],
    spells: [
      { id: 'pink_bombs2',   name: 'Bomb Volley',      tp: 40, dmg: 55, dur: 480, kind: 'attack', darkLvl: 1, text: 'PINK rains BOMBS faster!' },
      { id: 'pink_tunnel',   name: '3-D Tunnel',       tp: 42, dmg: 55, dur: 500, kind: 'attack', darkLvl: 3, text: 'PINK pulls you into the TUNNEL!' },
      { id: 'pink_bombsg',   name: 'Giant Bomb',       tp: 44, dmg: 55, dur: 620, kind: 'attack', darkLvl: 5, text: 'PINK winds up a GIANT BOMB!' },
      { id: 'pink_rotbox',   name: 'Rotating Ring',    tp: 46, dmg: 60, dur: 480, kind: 'attack', darkLvl: 6, text: 'PINK spins the RING around you!' },
      { id: 'pink_concert2', name: 'Concert (Haters)', tp: 52, dmg: 60, dur: 560, kind: 'attack', darkLvl: 8, text: 'PINK plays for the HATERS!' },
    ],
    ult: { id: 'pink_ult', pattern: 'pink_rotbox', name: 'ROTATING BOX', tp: 100, dmg: 60, dur: 520, kind: 'attack',
           text: 'PINK spins the whole WORLD around you!! DOKI DOKI!' },
    // DATE minigames — played instead of an attack when the DOKI meter fills. Final DATE hits like a TRUCK.
    dokiDates: [
      { id: 'pink_date1', name: 'DATE', dmg: 40, dur: 100000, kind: 'attack', text: 'PINK wants to... DATE!?' },
      { id: 'pink_date2', name: 'DATE', dmg: 40, dur: 100000, kind: 'attack', text: 'PINK wants to... DATE!?' },
      { id: 'pink_finalmaze', name: 'DATE', dmg: 70, dur: 900, kind: 'attack', text: 'PINK has split into GHOST and BODY!' },
      { id: 'pink_date4', name: 'DATE', dmg: 60, dur: 100000, kind: 'attack', text: 'PINK has a... CONFESSION.' },
    ],
    // scenery-only backdrop test (no bullets) — surfaced in the attack tester, not a combat move
    testMoves: [
      { id: 'pink_scene', name: 'Stage Scene (test)', dmg: 1, dur: 900, kind: 'attack', text: '' },
    ],
  },
};
// party-cost + darkner + level/spare defaults
for (const id in CHARS) {
  if (CHARS[id].cost == null) CHARS[id].cost = 1;
  if (CHARS[id].darkner == null) CHARS[id].darkner = false;
  if (CHARS[id].level == null) CHARS[id].level = 1;
  if (CHARS[id].spare == null) CHARS[id].spare = {};
}
CHARS.lancer.cost = 2; CHARS.lancer.darkner = true; CHARS.lancer.maxLevel = 5;
CHARS.spamton.darkner = true; CHARS.knight.darkner = true;   // dark-world bosses: you CHARGE, you can't SPARE them
CHARS.gerson.darkner = true; CHARS.pink.darkner = true;      // Hammer of Justice + Pink are DARKNERS too

// DARKNESS bosses: FIGHT chooses from `basics` (ACTIVE attacks, gated by darkLvl); `def.fight` = default basic
// (kept for code paths that still read c.fight). MAGIC lists `spells` gated by darkLvl. maxLevel default 10.
for (const id in CHARS) {
  const c = CHARS[id];
  if (c.basics && c.basics.length) { c.fight = c.fight || c.basics[0]; if (c.maxLevel == null) c.maxLevel = 10; }
}

// PINK DOKI-spare FLIRT options (Kris ACT via pink.act; Susie/Ralsei spell; Kris multi-act). pinkOnly = hidden unless facing Pink.
CHARS.kris.acts.push({ id: 'act_megaflirt', name: 'MegaFlirt', tp: 40, kind: 'doki', doki: 5, ally: 'any', pinkOnly: true, text: 'KRIS leads a MEGAFLIRT!' });
CHARS.susie.spells.push({ id: 'susie_flirt', name: 'Flirt', tp: 12, kind: 'doki', doki: 1, pinkOnly: true, text: 'SUSIE flirts... reluctantly. (+DOKI)' });
CHARS.ralsei.spells.push({ id: 'ralsei_flirt', name: 'Flirt', tp: 12, kind: 'doki', doki: 1, pinkOnly: true, text: 'RALSEI flirts sweetly! (+DOKI)' });

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
  revivemint:   { name: 'Revive Mint',   revivePct: 1.0, desc: 'Fully heals + revives an ally to FULL HP' },
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
// bases whose battle sprites were ripped as ENEMIES (facing left by default),
// so they must be flipped relative to the party members.
const ENEMY_FACING = { lancer: true, berdly: true, jevil: true, spamton: true, knight: true, gerson: true, pink: true };

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
    name, level: 1, spare: {},
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