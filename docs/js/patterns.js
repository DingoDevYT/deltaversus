// Bullet patterns. Each pattern: { dur, tick(api) } where api = {
//   f: frame (0..dur), rng, box {x,y,w,h}, tier, soul {x,y},
//   add(bullet), imgs (char sprite lookup)
// }
// Bullets: x,y,vx,vy,[ax,ay],r (hit radius), img or shape, scale, rot, spin,
//          [sineA, sineF] perpendicular wobble, [homing], flip.
// Patterns spawn generously outside the box; bullets die offscreen.

const PATTERNS = {};

function imgsOf(ch) {
  return {
    slash: A.chrFrames(ch, 'slash'), arc: A.chrFrames(ch, 'arc'),
    bigslash: A.chrFrames(ch, 'bigslash'), scarf: A.chrFrames(ch, 'scarf'),
    icicle: A.chrFrames(ch, 'icicle'), shard: A.chrFrames(ch, 'shard'),
    snowflake: A.chrFrames(ch, 'snowflake'), mist: A.chrFrames(ch, 'mist'),
    orb: A.chrFrames(ch, 'orb'), sparkle: A.chrFrames(ch, 'sparkle'),
    spadeW: A.chrFrames(ch, 'spade_white'), spadeP: A.chrFrames(ch, 'spade_pink'),
    bike: A.chrFrames(ch, 'bike'), hand: A.chrFrames(ch, 'hand'),
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function every(f, n) { return f % n === 0; }
// density: higher tier = more frequent spawns
function rate(base, tier) { return Math.max(2, Math.round(base * [1.25, 1.0, 0.72][tier])); }

// ---------- KRIS (readable sword slashes that CYCLE left -> right -> middle) ----------
PATTERNS.kris_slash = {
  dur: 440,
  tick(api) {
    const { f, box, tier, add } = api;
    const period = rate(46, tier);
    if (f % period === 0) {
      const k = Math.floor(f / period), lane = k % 3;   // predictable cycle: LEFT, RIGHT, MIDDLE
      if (lane === 2) {                                  // MIDDLE: a clean column falls with one safe gap
        const gap = 1 + (k % 3);                         // gap slot shifts predictably (1..3 of 5)
        for (let i = 0; i < 5; i++) { if (i === gap) continue;
          add({ ...bulletProps('knife'), x: box.x + box.w * (0.1 + 0.2 * i), y: box.y - 24, vx: 0, vy: 2.6, rot: 0, spin: 0.3, r: 7 }); }
      } else {                                           // SIDE: an evenly-spaced row sweeps across at one speed
        const left = lane === 0;
        for (let i = 0; i < 4; i++)
          add({ ...bulletProps('knife'), x: left ? box.x - 30 - i * 10 : box.x + box.w + 30 + i * 10,
                y: box.y + box.h * (0.2 + 0.2 * i), vx: (left ? 1 : -1) * 2.8, vy: 0,
                rot: left ? Math.PI / 2 : -Math.PI / 2, spin: 0.3, r: 7 });
      }
    }
  },
};
PATTERNS.kris_cross = {
  dur: 480,
  tick(api) {
    const { f, rng, box, tier, add } = api;
    // rotating cross of knives converging on center — FAST bullets, but a longer gap between waves
    if (every(f, rate(54, tier))) {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const R = Math.max(box.w, box.h) / 2 + 40;
      const base = f * 0.06;
      for (let k = 0; k < 4; k++) {
        const a = base + k * (Math.PI / 2);
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        const toC = Math.atan2(cy - y, cx - x);
        add({ ...bulletProps('knife'), x, y, vx: Math.cos(toC) * 4.2, vy: Math.sin(toC) * 4.2,
              rot: toC + Math.PI / 2, spin: 0.28, r: 7 });
      }
    }
  },
};
PATTERNS.kris_giga = {
  dur: 560,
  tick(api) {
    const { f, box, tier, add, soul } = api;
    const per = rate(30, tier);
    if (f % per === 0) {          // rows of knives sweep across, ALTERNATING sides each wave
      const left = (Math.floor(f / per) % 2) === 0;
      for (let i = 0; i < 3; i++)
        add({ ...bulletProps('knife'), x: left ? box.x - 30 - i * 40 : box.x + box.w + 30 + i * 40,
              y: box.y + box.h * (0.25 + 0.25 * i), vx: (left ? 1 : -1) * 3.0, vy: 0,
              rot: left ? Math.PI / 2 : -Math.PI / 2, spin: 0.35, r: 8 });
    }
    if (every(f, rate(64, tier)))   // telegraphed guillotine straight down the soul's column
      add({ ...bulletProps('knife'), x: soul.x, y: box.y - 30, vx: 0, vy: 0.6, ay: 0.12, maxv: 5, rot: 0, spin: 0.2, r: 8 });
  },
};

// ---------- SUSIE ----------
// (hitboxes are deliberately smaller than the big arc visuals -> graze-friendly)
PATTERNS.susie_axe = {   // axes thrown across the box in varied patterns (Susie+Lancer style)
  dur: 420,
  tick(api) {
    const { f, box, tier, add } = api;
    const period = rate(38, tier), k = Math.floor(f / period);
    if (f % period === 0) {
      const mode = k % 3;               // predictable cycle of the three throws
      if (mode === 0) {                 // an even row sweeps across, alternating sides
        const left = (k % 6) < 3;
        for (let i = 0; i < 3; i++)
          add({ ...bulletProps('axe'), x: left ? box.x - 40 - i * 20 : box.x + box.w + 40 + i * 20,
                y: box.y + box.h * (0.25 + 0.25 * i), vx: (left ? 1 : -1) * 3.0, vy: 0, r: 8, spin: left ? 0.16 : -0.16 });
      } else if (mode === 1) {          // two lobbed axes arc up from fixed thirds
        for (const fx of [0.34, 0.66])
          add({ ...bulletProps('axe'), x: box.x + box.w * fx, y: box.y + box.h + 20, vx: 0, vy: -4, ay: 0.07, r: 8, spin: 0.25 });
      } else {                          // spinning axes drop from both top corners inward
        for (const lx of [box.x - 20, box.x + box.w + 20])
          add({ ...bulletProps('axe'), x: lx, y: box.y - 20, vx: (lx < box.x ? 1 : -1) * 1.8, vy: 1.8, r: 8, spin: 0.3 });
      }
    }
  },
};
PATTERNS.susie_rude = {
  dur: 500,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    // beam sweep with a 2-lane SAFE CORRIDOR you have to find (was an unavoidable wall)
    const lanes = 6;
    const period = rate(80, tier);
    if (every(f, period)) {
      const fromLeft = (Math.floor(f / period) % 2) === 0;
      const gap = Math.floor(rng() * lanes);
      for (let i = 0; i < lanes; i++) {
        if (i === gap || i === (gap + 1) % lanes) continue;   // safe corridor
        add({
          x: (fromLeft ? box.x - 40 : box.x + box.w + 40) - (fromLeft ? 1 : -1) * i * 22,
          y: box.y + (i + 0.5) * (box.h / lanes),
          vx: (fromLeft ? 1 : -1) * 3.2, vy: 0,
          ...bulletProps('rudebeam'), r: 9, spin: 0.08,
        });
      }
    }
    if (every(f, rate(52, tier))) {
      add({
        x: box.x + rng() * box.w, y: box.y + box.h + 18,
        vx: (rng() - 0.5) * 1.2, vy: -(2.4 + rng() * 1.2), ay: 0.05,
        ...bulletProps('axe'), scale: 0.7, r: 6, spin: 0.2,
      });
    }
  },
};
PATTERNS.susie_ult = {
  dur: 560,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(28, tier))) {
      const fromLeft = rng() < 0.5;
      add({
        x: fromLeft ? box.x - 40 : box.x + box.w + 40, y: box.y + rng() * box.h,
        vx: (fromLeft ? 1 : -1) * (2.8 + rng() * 1.4), vy: (rng() - 0.5) * 1.0,
        ...bulletProps('rudebeam'), r: 8, spin: 0.08,
      });
    }
    if (every(f, rate(96, tier))) {
      // the BIG crescent: slow and telegraphed, hitbox well under the visual
      const fromLeft = rng() < 0.5;
      add({
        x: fromLeft ? box.x - 70 : box.x + box.w + 70,
        y: box.y + box.h / 2 + (rng() - 0.5) * 70,
        vx: (fromLeft ? 1 : -1) * 1.5, vy: 0,
        ...bulletProps('rudebeam'), scale: 2.2, r: 16, flip: !fromLeft,
        sineA: 1.0, sineF: 0.03,
      });
    }
  },
};

// ---------- RALSEI (magic sparkles & dots) ----------
PATTERNS.ralsei_scarf = {
  dur: 420,
  tick(api) {
    const { f, rng, box, tier, add } = api;
    // fire projectiles radiate in rings from the centre (Balthizard-style)
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (every(f, rate(48, tier))) {
      const n = 6, off = (f * 0.09) % (6.28 / n);   // sparse 6-dot ring, rotates so gaps shift
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.28 + off;
        add({ ...bulletProps('ralseidot'), x: cx, y: cy,
              vx: Math.cos(a) * 1.45, vy: Math.sin(a) * 1.45, r: 6 });
      }
    }
  },
};
PATTERNS.ralsei_ult = {
  dur: 560,
  tick(api) {
    const { f, rng, box, tier, add } = api;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    // THREE spinning galaxy arms - denser, faster + accelerating (it's a 100% ULT)
    if (every(f, rate(6, tier))) {
      const ang = f * 0.36;
      for (let k = 0; k < 3; k++) {
        const a = ang + k * (Math.PI * 2 / 3);
        add({ ...bulletProps('ralseidot'), x: cx, y: cy,
              vx: Math.cos(a) * 1.7, vy: Math.sin(a) * 1.7,
              ax: Math.cos(a) * 0.02, ay: Math.sin(a) * 0.02, r: 6 });
      }
    }
    // periodic converging ring from the edges - forces you OFF the safe spiral track
    if (f > 60 && every(f, rate(92, tier))) {
      const R = Math.max(box.w, box.h) / 2 + 34, n = 11, off = (f * 0.02) % (6.28 / n);
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.28 + off, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        add({ ...bulletProps('ralseidot'), x, y, vx: -Math.cos(a) * 1.55, vy: -Math.sin(a) * 1.55, r: 6 });
      }
    }
  },
};

// ---------- NOELLE ----------
PATTERNS.noelle_snow = {
  dur: 420,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(34, tier))) {   // slightly sparser falling hexes
      add({
        x: box.x + rng() * box.w, y: box.y - 24,
        vx: (rng() - 0.5) * 1.1, vy: 0.8 + rng() * 0.9, ay: 0.012,
        ...bulletProps('icehex'), r: 7,
        sineA: 0.5, sineF: 0.05,
      });
    }
    if (every(f, rate(104, tier))) {   // gentler homing snowflake (weaker seek, slower, rarer)
      add({
        x: rng() < 0.5 ? box.x - 26 : box.x + box.w + 26, y: box.y + rng() * box.h,
        vx: 0, vy: 0, homing: 0.03, maxv: 1.6,
        ...bulletProps('icesnow'), r: 9,
      });
    }
  },
};
PATTERNS.noelle_ice = {
  dur: 500,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(24, tier))) {
      // denser falling icicles, more often aimed at the soul + falling faster
      const x = rng() < 0.55 ? api.soul.x + (rng() - 0.5) * 60 : box.x + rng() * box.w;
      add({
        x, y: box.y - 34, vx: 0, vy: 0.7, ay: 0.13, maxv: 5.6,
        ...bulletProps('icehex'),
      });
    }
    if (every(f, rate(36, tier))) {
      // shards bounce up from the impact line - occasionally a pair
      const pair = rng() < 0.4 ? 2 : 1;
      for (let i = 0; i < pair; i++)
        add({
          x: box.x + rng() * box.w, y: box.y + box.h + 12,
          vx: (rng() - 0.5) * 2.2, vy: -(2.0 + rng() * 1.5), ay: 0.06,
          ...bulletProps('icehex'), scale: 0.8, r: 5, spin: 0.15,
        });
    }
  },
};
PATTERNS.snowgrave = {   // NOT a dodge: straight forbidden ICE. Cosmetic only - the ~1000-dmg
  dur: 170,               // FROZEN execute is applied directly to the single target (see applySnowgrave).
  tick(api) {
    const { f, rng, box, add } = api;
    api.fx.bgHue = 205;                     // the world goes ice-cold blue-white
    if (f < 6) api.fx.shake = 12;
    if (f % 4 === 0 && f < 90) api.fx.shake = Math.max(api.fx.shake || 0, 6);
    // a wall of giant vertical ICE spears crashes straight down through the whole box (harmless spectacle)
    if (f === 4)
      for (let i = 0; i < 9; i++)
        add({ ...bulletProps('icicle'), x: box.x + (i + 0.5) * (box.w / 9), y: box.y - 40 - (i % 3) * 30,
              vx: 0, vy: 15, scale: 2.4, r: 0, noHit: true, life: 60 });
    // a few frozen shards linger and drift down (cosmetic)
    if (f % 6 === 0 && f < 120)
      add({ ...bulletProps('icehex'), x: box.x + rng() * box.w, y: box.y - 20,
            vx: 0, vy: 2 + rng() * 2, scale: 1.1, r: 0, noHit: true, life: 90 });
  },
};

// ---------- LANCER ----------
PATTERNS.lancer_spade = {
  dur: 420,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(42, tier))) {
      // spade fans from top corners
      const fromLeft = rng() < 0.5;
      const ox = fromLeft ? box.x - 20 : box.x + box.w + 20;
      const oy = box.y - 16;
      for (let i = -1; i <= 1; i++) {
        const ang = Math.atan2(api.soul.y - oy, api.soul.x - ox) + i * 0.35;
        add({
          x: ox, y: oy, vx: Math.cos(ang) * 2.0, vy: Math.sin(ang) * 2.0,
          img: pick(rng, imgs.spadeW), scale: 1.4, r: 7,
        });
      }
    }
  },
};
PATTERNS.lancer_storm = {
  dur: 480,
  tick(api) {
    const { f, rng, box, tier, add, imgs, soul } = api;
    if (every(f, rate(15, tier))) {   // denser + faster rain of spades
      add({
        x: box.x + rng() * box.w, y: box.y - 22,
        vx: (rng() - 0.5) * 0.6, vy: 1.9 + rng() * 1.6,
        img: rng() < 0.5 ? pick(rng, imgs.spadeW) : pick(rng, imgs.spadeP),
        scale: 1.3, r: 7, spin: (rng() - 0.5) * 0.2,
      });
    }
    if (every(f, rate(72, tier))) {   // periodic aimed 3-spade fan straight at the soul
      const ox = box.x + box.w / 2, oy = box.y - 18;
      const base = Math.atan2(soul.y - oy, soul.x - ox);
      for (let i = -1; i <= 1; i++) {
        const a = base + i * 0.3;
        add({ x: ox, y: oy, vx: Math.cos(a) * 3.0, vy: Math.sin(a) * 3.0,
              img: pick(rng, imgs.spadeW), scale: 1.2, r: 7, spin: 0.15 });
      }
    }
  },
};
const BIKE_KEYS = ['lancerbike0', 'lancerbike1', 'lancerbike2', 'lancerbike3', 'lancerbike4', 'lancerbike5'];
PATTERNS.lancer_bike = {   // BIKE CHARGE: Lancer waits on his hog to the side (HONK), then blitzes across the
  dur: 560,                 // telegraphed lane. His vertical position outside the box tells you the line. x6.
  tick(a) {
    const { f, box, tier, add } = a;
    const CYC = rate(84, tier), TELL = 34, k = Math.floor(f / CYC), ev = f % CYC;
    if (k >= 6) return;                                   // ~6 charges
    const left = (k % 2) === 0;
    const lane = box.y + box.h * [0.22, 0.5, 0.78, 0.36, 0.64, 0.5][k];
    const parkX = left ? box.x + 14 : box.x + box.w - 14;   // sits clearly ON-SCREEN at the edge so you SEE him rev
    if (ev === 0)   // rev up: the engine plays the HONK once as this marker spawns
      add({ x: parkX, y: lane, vx: 0, vy: 0, r: 0, noHit: true, life: 2, spawnSnd: 'lancerhonk', spawnVol: 0.6 });
    if (ev < TELL) {   // TELEGRAPH: Lancer sits on the bike at this lane, revving (harmless), so you can read it
      add({ img: bulletProps(BIKE_KEYS[Math.floor(f / 4) % 6]).img, x: parkX, y: lane,
            vx: 0, vy: 0, r: 0, noHit: true, life: 2, flip: left, scale: 1.4 });
    } else if (ev === TELL) {   // RIDE: fast crossing on the telegraphed lane, spitting spades behind
      const bike = { ...bulletProps('lancerbike0'), x: left ? box.x - 30 : box.x + box.w + 30, y: lane, vx: (left ? 1 : -1) * 6.4, vy: 0,
                     r: 14, flip: left, scale: 1.4, animKeys: BIKE_KEYS, animRate: 3, _sp: 0 };
      bike.emit = function (b, out) {
        if ((b._sp = (b._sp || 0) + 1) % 4) return;
        out.push({ ...bulletProps('spade_pink'), x: b.x - (left ? 18 : -18), y: b.y + 6, vx: 0, vy: 1.4, r: 6, scale: 1.1, spin: 0.2 });
      };
      add(bike);
    }
  },
};
PATTERNS.lancer_ult = {   // COOL ATTACK: spade spiral + TELEGRAPHED bike blitz + bursting spade bombs (100% darkner ult)
  dur: 620,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    // relentless two-arm spade spiral from the centre
    if (every(f, rate(10, tier))) {
      const ang = f * 0.22;
      for (let k = 0; k < 2; k++) { const a2 = ang + k * Math.PI;
        add({ ...bulletProps('spade_pink'), x: cx, y: cy, vx: Math.cos(a2) * 2.0, vy: Math.sin(a2) * 2.0, r: 7, scale: 1.2, spin: 0.2 }); }
    }
    // bike blitz - each bike APPEARS + HONKS on-screen, then charges (no more surprise spawns)
    const CYC = rate(90, tier), TELL = 26, ev = f % CYC, bk = Math.floor(f / CYC);
    if (f < 560) {
      const left = (bk % 2) === 0, lane = box.y + 22 + ((bk * 97) % 100) / 100 * (box.h - 44);
      const parkX = left ? box.x + 14 : box.x + box.w - 14;
      if (ev === 0) add({ x: parkX, y: lane, vx: 0, vy: 0, r: 0, noHit: true, life: 2, spawnSnd: 'lancerhonk', spawnVol: 0.45 });
      if (ev < TELL) add({ img: bulletProps(BIKE_KEYS[Math.floor(f / 4) % 6]).img, x: parkX, y: lane, vx: 0, vy: 0, r: 0, noHit: true, life: 2, flip: left, scale: 1.4 });
      else if (ev === TELL) add({ ...bulletProps('lancerbike0'), x: left ? box.x - 34 : box.x + box.w + 34, y: lane,
            vx: (left ? 1 : -1) * 6.8, vy: 0, r: 13, flip: left, scale: 1.4, animKeys: BIKE_KEYS, animRate: 3 });
    }
    // spade bombs fall + burst into a full ring of spades
    if (f > 30 && every(f, rate(120, tier)))
      add({ ...bulletProps('bspade'), x: box.x + 30 + rng() * (box.w - 60), y: box.y - 18, vx: 0, vy: 1.8, r: 9, scale: 1.1,
            burst: 46, burstN: 8, burstSpeed: 2.2, burstImg: 'spade_pink', burstScale: 1.1 });
  },
};

// ---------- custom pattern factory (character creator attacks) ----------
// spec: {ptype, bullet, speed, ult} — bullet is a library id or a shape name.
// ---------- BERDLY (wind, A+ papers, halberd lasers) ----------
PATTERNS.berdly_fight = {   // basic HALBERD swings: fewer, BIGGER, faster thrusts (readable but punchy)
  dur: 420,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(44, tier))) {          // one large halberd thrust sweeps across at one height
      const y = box.y + 20 + rng() * (box.h - 40);
      add({ ...bulletProps('spear'), x: box.x + box.w + 26, y,
            vx: -(3.1 + rng() * 0.5), vy: 0, rot: Math.PI, scale: 1.4, r: 10 });
    }
  },
};
PATTERNS.berdly_bolt = {   // Tornado 1: walls of 4 stacked tornadoes sweep left in set orders
  dur: 480,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    const period = rate(64, tier);
    if (f % period === 0) {
      const order = Math.floor(rng() * 4);
      // 4 fixed orderings: top->bottom, alt pairs, bottom->top, reversed alt pairs
      const seq = order === 0 ? [0, 1, 2, 3] : order === 1 ? [0, 2, 1, 3]
                : order === 2 ? [3, 2, 1, 0] : [1, 3, 0, 2];
      seq.forEach((slot, idx) => {                 // stagger entry so the order reads
        add({ ...bulletProps('tornado'), x: box.x + box.w + 24 + idx * 30,
              y: box.y + 16 + (box.h - 32) * (slot / 3), vx: -1.9, vy: 0, spin: 0.28, r: 9 });
      });
    }
  },
};
PATTERNS.berdly_books = {   // Halberdly: fewer but BIGGER + FASTER energy spears (wavy beam + scatter)
  dur: 480,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(22, tier)))       // curved energy beam sweeps in from the right, bigger + faster
      add({ ...bulletProps('spear'), x: box.x + box.w + 20, y: box.y + 18 + rng() * (box.h - 36),
            vx: -(3.4 + rng()), vy: 0, rot: Math.PI, sineA: 1.4, sineF: 0.06, scale: 1.3, r: 9 });
    if (every(f, rate(54, tier)))       // scattered energy shards perpendicular to the trail
      add({ ...bulletProps('spear'), x: box.x + box.w * (0.3 + rng() * 0.5), y: box.y - 16,
            vx: (rng() - 0.5) * 0.6, vy: 2.4 + rng(), rot: Math.PI / 2, scale: 1.3, r: 9 });
  },
};
PATTERNS.berdly_ult = {   // SMART RACE: a slowly-ROTATING X of converging tornadoes (like Dream Chorus) + A+ papers
  dur: 560,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (every(f, rate(50, tier))) {     // 4 spawn points ORBIT the centre slowly -> the whole X spins
      const rotOff = f * 0.006, R = Math.max(box.w, box.h) * 0.78;
      for (let k = 0; k < 4; k++) {
        const a0 = rotOff + k * Math.PI / 2;
        const x = cx + Math.cos(a0) * R, y = cy + Math.sin(a0) * R;
        const ang = Math.atan2(cy - y, cx - x);
        add({ ...bulletProps('tornado'), x, y, vx: Math.cos(ang) * 2.2, vy: Math.sin(ang) * 2.2, spin: 0.3, r: 9 });
      }
    }
    if (every(f, rate(18, tier)))       // A+ papers streaming from the right
      add({ ...bulletProps('aplus' + Math.floor(rng() * 4)), x: box.x + box.w + 20, y: box.y + 14 + rng() * (box.h - 28),
            vx: -(3 + rng()), vy: (rng() - 0.5) * 1.2, rot: Math.PI, spin: 0.12, r: 7 });
  },
};

// ---------- JEVIL ("joker", Ch1) — rebuilt from the REAL GML (30fps -> hz30). Turn-based escalating
// jester; SOUL always RED. Box centre = (cx,cy). GML image_xscale -> our scale via JS(). ----------
const JS = g => g / 1.6;
// TYPE 70 — Teleport spade-fans: teleport to a side, hurl a 5-spade 72deg fan at the SOUL (spd 4.5, every 20t).
PATTERNS.jevil_spade = {
  dur: 380, hz30: 1,
  tick(a) {
    const { f, box, add, soul, rng } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f % 20 !== 0 || f > 340) return;
    const jx = cx + (rng() < 0.5 ? -1 : 1) * (90 + rng() * 70), jy = cy + (rng() - 0.5) * 90;
    const aim = Math.atan2(soul.y - jy, soul.x - jx);
    for (let i = 0; i < 5; i++) { const ang = aim + (-36 + 18 * i) * Math.PI / 180;   // GML fan +-36/-18/0, spd 4.5, scale 0.4
      add({ ...bulletProps('suitspade'), x: jx, y: jy, vx: Math.cos(ang) * 4.5, vy: Math.sin(ang) * 4.5, rot: ang, scale: JS(0.5), r: 5, grazeR: 11, dmg: 18, life: 130 }); }
    Snd.play('jokerha', 0.3);
  },
};
// TYPE 65 — Spade Ring: 10 spades gather on a ring, then sweep through the centre one-by-one.
PATTERNS.jevil_ring = {
  dur: 360, hz30: 1,
  tick(a) {
    const { f, box, add } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f % 90 !== 0 || f > 300) return;
    const N = 10, R = Math.min(box.w, box.h) * 0.55;
    for (let i = 0; i < N; i++) { const ang = i / N * Math.PI * 2;
      add({ ...bulletProps('suitspade'), x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R, vx: 0, vy: 0, rot: ang + Math.PI, scale: JS(0.85), r: 5, grazeR: 11, noHit: true,
            fireAt: 18 + i * 4, fireVX: -Math.cos(ang) * 6, fireVY: -Math.sin(ang) * 6, dmg: 18, life: 18 + i * 4 + 100 }); }
    Snd.play('jokerha', 0.25);
  },
};
// TYPE 46/49 — Suit bombs fall from the top and detonate into a suit-specific burst.
PATTERNS.jevil_bombs = {
  dur: 360, hz30: 1,
  tick(a) {
    const { f, box, add, rng } = a; const cx = box.x + box.w / 2;
    if (f % 20 !== 0 || f > 320) return;
    const suit = Math.floor(rng() * 4), spr = ['suitspade', 'suitdiamondv', 'jbombheart0', 'jbombclub0'][suit];
    const bx = cx + (rng() < 0.5 ? -1 : 1) * (50 + rng() * 60);
    const bomb = { ...bulletProps(spr), x: bx, y: box.y - 20, vx: 0, vy: 10, r: 8, grazeR: 12, scale: JS(1.0), spin: 0.1, _suit: suit, _fuse: 20 + Math.floor(rng() * 16), dmg: 16 };
    bomb.emit = function (b, out, s) {
      if (b.t >= b._fuse && !b._done && b.y > box.y) {
        b._done = 1; b.dead = true; Snd.play('boardbomb', 0.3);
        if (b._suit === 0) for (let i = 0; i < 12; i++) { const ang = Math.random() * 6.28 + i * Math.PI / 6; out.push({ ...bulletProps('suitspade'), x: b.x, y: b.y, vx: Math.cos(ang) * 8, vy: Math.sin(ang) * 8, rot: ang, scale: JS(0.55), r: 4, life: 90, dmg: b.dmg }); }
        else if (b._suit === 1) for (let i = 0; i < 3; i++) { const ang = Math.atan2(s.y - b.y, s.x - b.x), sp = 11 - i; out.push({ ...bulletProps('suitdiamondv'), x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, scale: JS(0.6), r: 4, life: 90, dmg: b.dmg }); }
        else if (b._suit === 2) for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2; out.push({ ...bulletProps('suitheart'), x: b.x, y: b.y, vx: Math.cos(ang) * 3, vy: Math.sin(ang) * 3, scale: JS(0.7), r: 5, spin: 0.1, homing: 0.06, life: 120, dmg: b.dmg }); }   // GML heartbomb_blast: 4 orbiting hearts + homing
        else for (let i = 0; i < 3; i++) { const base = Math.atan2(s.y - b.y, s.x - b.x), ang = base + (-20 + i * 20) * Math.PI / 180; out.push({ ...bulletProps('suitclubball'), x: b.x, y: b.y, vx: Math.cos(ang) * 8, vy: Math.sin(ang) * 8, scale: JS(0.7), r: 4, life: 90, dmg: b.dmg }); }
      }
    };
    add(bomb);
  },
};
// TYPE 75 — Orbiting Devilsknives: 4 scythes swing THROUGH the centre along rotating axes.
PATTERNS.jevil_scythes = {
  dur: 420, hz30: 1,
  tick(a) {
    const { f, box, add } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2, RAD = Math.min(box.w, box.h) * 0.5;
    if (f !== 0) return;
    for (let k = 0; k < 4; k++) {
      const s = { ...bulletProps('jdevil'), x: cx, y: cy, r: 9, grazeR: 20, scale: JS(1.0), rot: 0, _sine: k * 20, _dir: k * 90, life: 420 };
      s.emit = function (b) { b._sine += 1.4; b._dir += 1.5; const L = Math.cos(b._sine / 18) * RAD, va = -b._dir * Math.PI / 180; b.x = cx - Math.cos(va) * L; b.y = cy - Math.sin(va) * L; b.rot += 0.17; };
      add(s);
    }
    Snd.play('boardsummon', 0.35);
  },
};
// TYPE 62 — The Carousel: pseudo-3D horses sweep around the box; only FRONT-facing ones hurt (updCarousel).
PATTERNS.jevil_carousel = {
  dur: 480, hz30: 1,
  tick(a) {
    const { f, box, add, rng } = a;
    if (f !== 0) return;
    const cols = 7, rows = 3, cx = box.x + box.w / 2, R = box.w / 2 + 24, rowGap = box.h * 0.34, midY = box.y + box.h / 2;
    for (let c = 0; c < cols; c++) { const ang0 = c / cols * Math.PI * 2;
      for (let r = 0; r < rows; r++) { const rowY = midY + (r - 1) * rowGap;
        add({ ...bulletProps('carousel' + Math.floor(rng() * 3)), x: cx, y: rowY, vx: 0, vy: 0, r: 11, grazeR: 16,
              carousel: { ang: ang0, w: 0.03, R, cx, rowY, bob: box.h * 0.11, phase: ang0 } }); } }
  },
};
// TYPE 71 — Teleport diamonds: dense aimed diamonds fired from teleport spots (spd 8, every 9t).
PATTERNS.jevil_diamond = {
  dur: 340, hz30: 1,
  tick(a) {
    const { f, box, add, soul, rng } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f % 9 !== 0 || f > 300) return;
    const jx = cx + (rng() - 0.5) * box.w * 0.8, jy = cy + (rng() - 0.5) * box.h * 0.8, ang = Math.atan2(soul.y - jy, soul.x - jx);
    add({ ...bulletProps('suitdiamondv'), x: jx, y: jy, vx: Math.cos(ang) * 8, vy: Math.sin(ang) * 8, rot: ang + Math.PI / 2, scale: JS(0.7), r: 5, grazeR: 11, dmg: 16, life: 120 });
  },
};
// TYPE 73/74 — Vertical Diamonds: a DENSE column of diamonds spawns from the BOTTOM and flies
// UPWARD (Rudinn-style, biased toward the SOUL's column ~40% of the time), fading in + growing
// 3->1 as it rises; thread the gaps. (obj_dbullet_vert — wiki: "diamonds ... fly upwards")
PATTERNS.jevil_verticals = {
  dur: 320, hz30: 1,
  tick(a) {
    const { f, box, add, soul, rng } = a;
    if (f % 4 !== 0 || f > 280) return;
    const bias = rng() < 0.4;                                   // GML num==3 biases xx into the soul's lane
    let x = bias ? soul.x + (rng() - 0.5) * 30 : box.x + 10 + rng() * (box.w - 20);
    x = Math.max(box.x + 6, Math.min(box.x + box.w - 6, x));
    add({ ...bulletProps('suitdiamondv'), x, y: box.y + box.h + 8, vx: 0, vy: -(2.6 + rng() * 1.2), r: 5, grazeR: 11,
          scale: 0.18, grow: 0.1, growMax: JS(0.75), spin: 0.12, dmg: 16, life: 150 });
  },
};
// TYPE 72 — Corner Clubs: a club rockets in FAST from a diagonal toward the SOUL, decelerates to a near-
// stop, then bursts a 3-club +-19deg fan. Alternating sides every fire. (obj_clubsbullet_dark)
PATTERNS.jevil_clubs = {
  dur: 360, hz30: 1,
  tick(a) {
    const { f, box, add, soul, rng } = a;
    if (f % 18 !== 0 || f > 320) return;
    const side = (Math.floor(f / 18) % 2) ? 1 : -1;
    const dir = (side > 0 ? (rng() < 0.5 ? 225 : 315) : (rng() < 0.5 ? 45 : 135)) * Math.PI / 180;   // GML corner dir
    const R = Math.min(box.w, box.h) * 0.95, sx = soul.x - Math.cos(dir) * R, sy = soul.y + Math.sin(dir) * R;
    const toS = Math.atan2(soul.y - sy, soul.x - sx);
    const club = { ...bulletProps('suitclubball'), x: sx, y: sy, vx: Math.cos(toS) * 11, vy: Math.sin(toS) * 11,
      fric: 0.5, r: 7, grazeR: 12, scale: JS(0.95), spin: 0.22, dmg: 18, _burst: 20 };
    club.emit = function (b, out) {
      if (--b._burst === 0) { const base = Math.atan2(b.vy, b.vx);
        for (let i = -1; i <= 1; i++) { const ang = base + i * 19 * Math.PI / 180;
          out.push({ ...bulletProps('suitclubball'), x: b.x, y: b.y, vx: Math.cos(ang) * 3.5, vy: Math.sin(ang) * 3.5, scale: JS(0.62), r: 5, spin: 0.2, dmg: b.dmg, life: 100 }); }
        b.dead = true; Snd.play('boardbomb', 0.25);
      }
    };
    add(club);
  },
};
// TYPE 77 — ChaosChaos ULT: the box vanishes; giant Devilsknives rain in lanes and smash into ground
// shockwaves; a huge final scythe + whiteout.
PATTERNS.jevil_ult = {
  dur: 600, hz30: 1,
  tick(a) {
    const { f, rng, box, add } = a; a.fx.arena = true;
    if (f === 0) Snd.play('jokerchaos', 0.6);   // "CHAOS, CHAOS!" (snd_joker_byebye/neochaos)
    const gY = box.y + box.h - 6;
    const drop = (x) => {
      const k = { ...bulletProps('jdevilgiant'), x, y: box.y - 60, vx: 0, vy: 5, ay: 1, maxv: 16, spin: 0.24, scale: JS(2.0), hitW: 30, hitH: 72, _gy: gY };
      k.emit = function (b, out) {
        if (b.y >= b._gy && !b._s) { b._s = 1; b.dead = true;
          out.push({ shape: 'line', color: '#fff', x: b.x, y: gY, rot: 0, len: 160, thick: 30, armed: true, life: 22, dmg: b.dmg, vx: 0, vy: 0 });
          Snd.play('boardbomb', 0.4);
        }
      };
      add(k);
    };
    if (f === 20) drop(box.x - 30); if (f === 40) drop(box.x + box.w + 30);
    if (f >= 60 && f % 12 === 0 && f < 420) drop(box.x + box.w * (Math.floor(rng() * 5) / 4));
    if (f === 440) add({ ...bulletProps('jdevilgiant'), x: box.x + box.w / 2, y: box.y - 200, vx: 0, vy: 0, lerpY: box.y + box.h * 0.3, lerpRate: 0.02, spin: 0.03, scale: JS(6), hitW: 280, hitH: 220, dmgMult: 2, life: 200 });
    if (f > 500) { a.fx.whiteout = Math.min(1, (f - 500) / 24); a.fx.shake = 8; }
  },
};

// A++++ : streams of A+ exam papers (spr_chirashi) - readable, constant speed, NO homing accel
PATTERNS.berdly_papers = {
  dur: 480,
  tick(a) {
    const { f, rng, box, tier, add, soul } = a;
    if (every(f, rate(28, tier))) {
      const ox = box.x + box.w + 24, oy = box.y + 12 + rng() * (box.h - 24);
      const base = Math.atan2(soul.y - oy, soul.x - ox);
      // 2 papers, gently aimed once at spawn (no acceleration) - the tumbling A+ flyer sprite
      for (let i = 0; i < 2; i++) {
        const ang = base + (i - 0.5) * 0.34;
        add({ ...bulletProps('aplus' + Math.floor(rng() * 4)), x: ox, y: oy,
              vx: Math.cos(ang) * 2.5, vy: Math.sin(ang) * 2.5, rot: ang, spin: 0.14, r: 7 });
      }
    }
  },
};
// RED BUSTER : Kris+Susie multi-act - wide straight beams toward the soul's height
PATTERNS.redbuster = {
  dur: 460,
  tick(a) {
    const { f, rng, box, tier, add, soul } = a;
    const period = rate(32, tier);
    if (f % period === 0) {
      const left = (Math.floor(f / period) % 2) === 0;
      for (let i = -1; i <= 1; i++)
        add({ ...bulletProps('rudebeam'), x: left ? box.x - 46 : box.x + box.w + 46, y: soul.y + i * 15,
              vx: (left ? 1 : -1) * 3.4, vy: 0, r: 10, scale: 1.3, spin: 0.05 });
    }
  },
};

// ---------- SPAMTON NEO (Ch2 secret boss) ----------
// Rebuilt frame-by-frame from the real attack GIFs (ref/spamton/*.webp,
// montages in ref/vidframes/*_grid.png). Yellow SOUL shoots (def.soulYellow).
// FLYING HEADS (rr0 / obj_sneo_guymaker + obj_sneo_lilguy): crew-heads sweep in from the
// RIGHT decelerating along a lane; each one, after ~0.6s, fires ONE spinning bullet aimed at
// the SOUL. You pop each head in a single yellow-soul shot (max 3 shots live). GML turntimer 240.
PATTERNS.sneo_heads = {
  dur: 470, box: { w: 300, h: 150 },
  tick(a) {
    const { f, rng, box, tier, add } = a;
    const WAVE = rate(70, tier), rows = [box.y + 26, box.y + box.h / 2, box.y + box.h - 26];
    // a wave = 4 heads on staggered lanes, fired 10f apart (GML timer 5,10,15,20)
    if (f < 400 && f % WAVE < 40 && f % 10 === 0) {
      const wave = Math.floor(f / WAVE), k = Math.floor((f % WAVE) / 10);
      const ly = rows[(wave * 2 + k) % 3] + (rng() - 0.5) * 16;
      add({ ...bulletProps('sneocrew'), x: box.x + box.w + 22, y: ly, vx: -4.6, ax: 0.055, vy: 0,   // decelerate as they arrive
            r: 12, scale: 1.2, spin: 0, shootable: true, hp: 1, maxv: 6, _fire: 30 + Math.floor(rng() * 10),
            emit(b, out, soul) {
              if (b._fire != null && --b._fire <= 0) { b._fire = null; Snd.play('sneofire', 0.4);
                const ang = Math.atan2(soul.y - b.y, soul.x - b.x);
                out.push({ ...bulletProps('sneoarrow'), x: b.x - 10, y: b.y, vx: Math.cos(ang) * 4.2, vy: Math.sin(ang) * 4.2, r: 6, spin: 0.5, scale: 0.9 });
              }
            }, life: 240 });
    }
  },
};
// HEART ATTACK (rr2 / obj_sneo_wireheart): wire-frame hearts detach from Spamton's chest on
// green wires, ease out to a spot and fire aimed 5-diamond fans; every third is a BOMB-heart
// that bursts a 16-diamond ring. Drain the hearts with yellow-soul shots. GML dmg = at*5.
PATTERNS.sneo_heart = {
  dur: 480, box: { w: 200, h: 180 },
  tick(a) {
    const { f, box, add, rng, tier } = a;
    const anchorX = box.x + box.w + 30, anchorY = box.y + box.h * 0.28, SPAWN = rate(150, tier);
    if (f % SPAWN === 0 && f < 400) {
      const bomb = (Math.floor(f / SPAWN) % 3 === 2);
      const tx = box.x + box.w * (0.28 + rng() * 0.5), ty = box.y + box.h * (0.2 + rng() * 0.6);
      const heart = { ...bulletProps('sneowire'), x: anchorX, y: anchorY, vx: 0, vy: 0, r: 13, scale: 1.0,
        shootable: true, hp: bomb ? 1 : 6, pushOnShot: 0, _tx: tx, _ty: ty, _cd: 44, _shots: 0, _bomb: bomb, _life: 0,
        tint: bomb ? '#ff4d6d' : null };
      heart.emit = function (b, out, soul, bx, fx) {
        b._life++;
        b.x += (b._tx - b.x) * 0.06; b.y += (b._ty - b.y) * 0.06;          // ease onto its spot
        fx.arms = (fx.arms || []).concat([{ x1: anchorX, y1: anchorY, x2: b.x, y2: b.y }]);   // the wire
        if (b._bomb) {
          if (b._life === 84) {   // BOMB-heart: burst a 16-diamond ring
            for (let i = 0; i < 16; i++) { const ang = i * Math.PI / 8;
              out.push({ ...bulletProps('diamond'), x: b.x, y: b.y, vx: Math.cos(ang) * 2.3, vy: Math.sin(ang) * 2.3, rot: ang, r: 5, scale: 0.85, fric: -0.015 }); }
            Snd.play('sneofire', 0.4); b.dead = true;
          }
          return;
        }
        if (--b._cd <= 0 && b._shots < 3) { b._cd = 42; b._shots++;         // 3 aimed 5-diamond fans
          const base = Math.atan2(soul.y - b.y, soul.x - b.x);
          for (let k = 0; k < 5; k++) { const ang = base + (k - 2) * (Math.PI / 8);
            out.push({ ...bulletProps('diamond'), x: b.x, y: b.y, vx: Math.cos(ang) * 2.6, vy: Math.sin(ang) * 2.6, rot: ang, r: 5, scale: 0.9 }); }
        }
        if (b._life > 250) b.dead = true;
      };
      add(heart);
    }
  },
};
// RECREW COLUMNS (rr6 / obj_sneo_wall_controller_new): 7-tile-tall walls of mailbox / crew /
// bomb bricks slide in from the RIGHT and race LEFT toward the SOUL. You thread the moving gap
// and SHOOT the crew tiles open. GML wallsize 7, walltype accelerates, turntimer 330.
PATTERNS.sneo_columns = {
  dur: 560, box: { w: 280, h: 168 },
  tick(a) {
    const { f, rng, box, add, tier } = a;
    const ROWS = 7, rh = box.h / ROWS, CAD = rate(28, tier);
    if (f === 0) this._gap = 3;
    if (f < 470 && f % CAD === 0) {
      this._gap += (rng() < 0.5 ? -1 : 1);                       // walk the passable gap
      this._gap = Math.max(1, Math.min(5, this._gap));
      const g = this._gap, x0 = box.x + box.w + 18, base = { vx: -4.6, ax: -0.05, maxv: 10 };
      add({ ...bulletProps('sneobox'), ...base, x: x0, y: box.y - rh * 0.4, r: 0, noHit: true, scale: rh / 30 });   // top cap
      for (let r = 0; r < ROWS; r++) {
        if (Math.abs(r - g) <= 1) continue;                      // 3-row gap window (threadable, shifts each column)
        const y = box.y + (r + 0.5) * rh, roll = rng();
        if (roll < 0.2)                                          // CREW tile: shoot it to punch a hole
          add({ ...bulletProps('sneocrew'), ...base, x: x0, y, r: rh * 0.44, scale: rh / 22 * 1.2, shootable: true, hp: 1, tint: '#00a2e8' });
        else if (roll < 0.27)                                    // BOMB tile: shoot -> cross laser
          add({ ...bulletProps('sneobomb'), ...base, x: x0, y, r: rh * 0.44, scale: rh / 22, shootable: true, hp: 1, bomb: true });
        else                                                     // SOLID mailbox brick
          add({ ...bulletProps('sneomail'), ...base, x: x0, y, r: rh * 0.42, scale: rh / (20 * 1.6) });
      }
      add({ ...bulletProps('sneobox'), ...base, x: x0, y: box.y + box.h + rh * 0.4, r: 0, noHit: true, scale: rh / 30 });   // bottom cap
      if (f % (CAD * 2) === 0) Snd.play('sneofire', 0.12);
    }
  },
};
PATTERNS.sneo_phones = {   // GRIPPING PHONES: a blue head climbs in on two phones (its hands on the box); shoot to delay
  dur: 560, box: { w: 240, h: 160 },
  tick(a) {
    const { f, box, add } = a;
    if (f !== 0) return;
    const head = { ...bulletProps('sneohead'), x: box.x + box.w, y: box.y + box.h / 2,
      vx: -0.38, vy: 0, r: 13, scale: 1.35, shootable: true, hp: 9999, pushOnShot: 4.5, maxv: 3, _ball: 74 };
    head.emit = function (b, out, soul, bx, fx) {
      // can't be shot back past the box's right edge (no more knocking him off-screen)
      b.x = Math.min(bx.x + bx.w, b.x);
      // vertical tracking: gentle normally, but if the SOUL slips BEHIND (left of) the head it
      // SNAPS to the soul's row and rams it - no more cheesing from behind (the head collides).
      const behind = soul.x < b.x;
      b.y += (soul.y - b.y) * (behind ? 0.3 : 0.03);
      b.y = Math.max(bx.y + 12, Math.min(bx.y + bx.h - 12, b.y));
      // the two phones are its HANDS: they lie FLAT ON the border ahead of the head, hand-over-hand
      const step = Math.sin(b.t * 0.1) * 8;
      const topPh = { ...bulletProps('sneophone'), x: b.x - 18 + step, y: bx.y + 3, vx: 0, vy: 0, r: 0, noHit: true, life: 2, rot: 0 };
      const botPh = { ...bulletProps('sneophone'), x: b.x - 18 - step, y: bx.y + bx.h - 3, vx: 0, vy: 0, r: 0, noHit: true, life: 2, rot: 0, flip: true };
      out.push(topPh, botPh);
      // DIAGONAL green arms: the head sits behind its phone-hands
      if (fx) fx.arms = [{ x1: b.x, y1: b.y - 6, x2: topPh.x, y2: topPh.y + 3 }, { x1: b.x, y1: b.y + 6, x2: botPh.x, y2: botPh.y - 3 }];
      // GML Phonehands: fires a leftward SPREADSHOT every ~20f (dir 180 +/- ~14deg, spd ~8)
      if (--b._ball <= 0) {
        b._ball = 22; Snd.play('sneofire', 0.3);
        for (let k = -2; k <= 2; k++) { const ang = Math.PI + k * 0.12;
          out.push({ ...bulletProps('sneoball'), x: b.x - 12, y: b.y, vx: Math.cos(ang) * 4.4, vy: Math.sin(ang) * 4.4, r: 6, scale: 0.6, spin: 0.2 }); }
      }
    };
    add(head);
  },
};
// face-part colour by state: BLUE (fine) -> PURPLE (hurt) -> VERY PURPLE (one big shot from gone) -> YELLOW (firing)
function faceTint(b) {
  if (b._fireT > 0) { b._fireT--; b.tint = '#ffd000'; return; }
  if (b.hp <= 4) b.tint = '#7b2cbf';        // very purple
  else if (b.hp < 12) b.tint = '#c77dff';   // purple
  else b.tint = null;                        // blue (native sprite)
}
PATTERNS.sneo_face = {   // EYES NOSE AND MOUTH: square player box + Spamton's rectangular face box ATTACHED to it
  dur: 580, box: { w: 170, h: 170 },   // the player's box stays SQUARE
  tick(a) {
    const { f, box, add } = a;
    // the face box shares the player box's right edge (directly attached, soul can't enter).
    // it's a WIDE rectangle - the extra width gives the player time to read the projectiles.
    const fbw = 132, fbx = box.x + box.w, fby = box.y;
    a.fx.faceBox = { x: fbx, y: fby, w: fbw, h: box.h };
    if (f !== 0) return;
    const fcx = fbx + fbw / 2, fcy = fby + box.h / 2, SC = 1.1, PX = 1.6 * SC;
    // the part sprites share one 42x71 canvas, so drawing them ALL at the same centre
    // rebuilds Spamton's face exactly. Hitboxes sit at each feature's height via drawDY.
    add({ ...bulletProps('sneofacebg'), x: fcx, y: fcy, vx: 0, vy: 0, r: 0, noHit: true, life: 999999, scale: SC });
    const eyeOff = -21.5 * PX, mouthOff = 20.5 * PX;
    const eye = { ...bulletProps('sneoeye'), x: fcx, y: fcy + eyeOff, drawDY: -eyeOff, vx: 0, vy: 0, r: 14, scale: SC, shootable: true, noHit: true, breakShot: true, hp: 16, _fireT: 0, _cd: 60 };
    eye.emit = function (b, out, soul) {
      faceTint(b);
      if (--b._cd > 0) return; b._cd = 180; b._fireT = 28;   // flash YELLOW while firing
      const ang = Math.atan2(soul.y - b.y, soul.x - b.x), dx = Math.cos(ang), dy = Math.sin(ang);   // aim at captured soul pos
      for (let i = 0; i < 7; i++) out.push({ ...bulletProps('sneolaser'), x: b.x - dx * i * 15, y: b.y - dy * i * 15, vx: dx * 4.2, vy: dy * 4.2, r: 5 });
    };
    add(eye);
    const nose = { ...bulletProps('sneonose'), x: fcx, y: fcy, vx: 0, vy: 0, r: 12, scale: SC, shootable: true, noHit: true, breakShot: true, hp: 16, _fireT: 0, _cd: 120 };
    nose.emit = function (b, out, soul, bx) {
      faceTint(b);
      if (--b._cd > 0) return; b._cd = 180; b._fireT = 28;
      const rows = [bx.y + 10, bx.y + bx.h / 2, bx.y + bx.h - 10];   // rows RIDE the top edge / middle / bottom edge
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)        // 3x3 of the real NOSE TRIANGLES
        out.push({ ...bulletProps('sneonosetri'), x: b.x, y: b.y, vx: -2.6 - c * 0.35, vy: 0,
                   lerpY: rows[r], lerpRate: 0.1, r: 6, rot: 0 });   // ease onto the row and STAY on it
    };
    add(nose);
    const mouth = { ...bulletProps('sneomouth'), x: fcx, y: fcy + mouthOff, drawDY: -mouthOff, vx: 0, vy: 0, r: 14, scale: SC, shootable: true, noHit: true, breakShot: true, hp: 16, _fireT: 0, _cd: 180 };
    mouth._openImg = bulletProps('sneomouth').img; mouth._kissImg = bulletProps('sneomouthk').img;
    mouth.emit = function (b, out) {
      if (b._kissT && --b._kissT <= 0) b.img = b._openImg;   // back to the normal mouth after the kiss
      faceTint(b);
      if (--b._cd > 0) return; b._cd = 180; b._fireT = 28;
      b.img = b._kissImg; b._kissT = 26;                     // pucker up while firing
      for (let i = 0; i < 6; i++)   // 6 kiss-wisps drift left then curl up out of the box
        out.push({ ...bulletProps('sneowisp'), x: b.x, y: b.y, vx: -1.4 - Math.random() * 0.9, vy: 0.3 - Math.random() * 0.6, ay: -0.02, r: 6 });
    };
    add(mouth);
  },
};
PATTERNS.sneo_bigshot = {   // POWER OF NEO (ult): blackout. A ~2x GIANT Spamton advances while sucking $ (then firing
  dur: 1000, box: { w: 300, h: 180 },   // BIG SHOTs). He's SHOOTABLE - your big shots shove him back for room.
  tick(a) {
    const { f, box, add } = a;
    if (f !== 0) return;
    const B = { x: box.x, y: box.y, w: box.w, h: box.h }, cy = B.y + B.h / 2, boxR = B.x + B.w;
    const far = boxR + 80, near = boxR - 4;   // b.x tracks his MOUTH; it aligns with the box's right edge up close
    const SUCK = 460;                          // the suck lasts noticeably longer now
    const MOUTHDX = 150, MOUTHDY = 34;         // sprite-centre offset from the mouth -> mouth lands on the box centre
    // the boss is an INVISIBLE shootable controller (drawn via fx.boss); big shots shove him RIGHT for room
    const boss = { x: far, y: cy, vx: 0, vy: 0, r: 60, noHit: true, noDraw: true, shootable: true, hp: 9999999, pushOnShot: 9,
                   _d: 0, _shotN: 0, _boom: 0 };
    boss.emit = function (b, out, soul, bx, fx) {
      fx.blackout = true;
      if (b.t > 956) {   // ENDING: white flash + explosion sound (the final shot detonating) - transition out
        fx.whiteout = Math.min(1, (b.t - 956) / 30);
        if (!b._boom) { b._boom = 1; Snd.play('sneoover', 0.75); }
      }
      b.x = Math.max(near, Math.min(far, b.x));                         // clamp the mouth to its range
      const approach = Math.max(0, Math.min(1, (far - b.x) / (far - near)));
      if (b.t < SUCK) {
        b.x -= 0.26;                                                    // creeps closer as he sucks
        fx.boss = { key: 'sneofinalsuck', x: b.x + MOUTHDX, y: cy + MOUTHDY, scale: 1.9, flip: false };
        fx.pinch = 0.55 * approach;                                     // the box's right side warps toward his mouth
        fx.pull = { x: b.x, y: cy, force: 0.32 + approach * 0.14 };
        b._d++;                                                         // pulls in MORE $ over time (ramps difficulty)
        const rateD = Math.max(6, 18 - Math.floor(b.t / 70) * 3);
        if (b._d % rateD === 0)
          out.push({ ...bulletProps('sneodollar'), x: B.x + 8, y: B.y + 14 + Math.random() * (B.h - 28),
                     vx: 2.1 + Math.random() * 0.6, vy: 0, lerpY: cy, lerpRate: 0.016, spin: 0.06, r: 7, shrink: 0.988 });
      } else {
        // FIRE phase: normal face, still advancing (less room per shot); your big shots keep him back
        b.x -= 0.5;
        const bob = Math.sin(b.t * 0.05) * 24;
        fx.boss = { key: 'sneofinal', x: b.x + MOUTHDX, y: cy + MOUTHDY + bob, scale: 1.9, flip: false };
        fx.pinch = Math.max(0, 0.55 * (1 - (b.t - SUCK) / 40));
        const p2 = b.t - SUCK, SHOT = 82;
        if (p2 >= 0 && p2 % SHOT === 0) {
          const n = b._shotN++;
          if (n < 5) {   // BIG SHOTs from his MOUTH; hitbox is tight to the sprite (hitDX shifts it to the front)
            const bottom = (n % 2) === 0, hitH = B.h * 0.6, cyy = bottom ? B.y + B.h - hitH / 2 : B.y + hitH / 2;
            out.push({ ...bulletProps('sneobig'), x: b.x - 20, y: cyy + bob * 0.4, vx: -3.4, vy: 0, hitW: 82, hitDX: -14, hitH, scale: hitH / 58, rot: 0 });
          } else if (n === 5) {   // FINALE: a full-height shot you MUST push back - else it reaches the left and hits
            out.push({ ...bulletProps('sneobig'), x: b.x - 10, y: cy, vx: -0.9, vy: 0, hitW: 96, hitDX: -18, hitH: B.h, scale: B.h / 54, rot: 0,
                       shootable: true, hp: 999999, pushOnShot: 6, life: 320 });
          }
        }
      }
    };
    // ENDING: the box flashes WHITE with an explosion sound (the final shot detonating) - just the transition
    boss._endEmit = true;
    add(boss);
  },
};
// A CALL FOR YOU (rr8 / obj_sneo_phonecall -> FootballPipis): Spamton fires blue, BOUNCING Pipis
// toward the SOUL; when one reaches the board it SPRAYS a fast fan of tiny Spamton heads at you.
// Shoot the Pipis to pop them (they give extra TP). Later in the attack he fires two at once.
PATTERNS.sneo_pipis = {
  dur: 460, box: { w: 280, h: 170 },
  tick(a) {
    const { f, box, add, rng, tier } = a;
    const CAD = rate(64, tier);
    if (f < 400 && f % CAD === 0) {
      const n = f > 200 ? 2 : 1;   // "the second time and on, fires two Pipis at once"
      for (let k = 0; k < n; k++) {
        const y0 = box.y + 22 + rng() * (box.h - 64);
        add({ ...bulletProps('sneopipis0'), animKeys: ['sneopipis0', 'sneopipis1', 'sneopipis2', 'sneopipis3'], animRate: 6,
          x: box.x + box.w + 18 + k * 24, y: y0, vx: -(2.4 + rng() * 0.8), vy: -1.5, ay: 0.12, r: 8, grazeR: 13, scale: 1.2,
          shootable: true, hp: 1, _sprayed: 0, life: 260,
          emit(b, out, soul, bx) {
            if (b.y > bx.y + bx.h - 8 && b.vy > 0) { b.vy = -Math.abs(b.vy) * 0.86; b.y = bx.y + bx.h - 8; Snd.play('pipis', 0.22); }   // bounce off the floor
            if (b.y < bx.y + 8 && b.vy < 0) { b.vy = Math.abs(b.vy) * 0.86; b.y = bx.y + 8; }
            if (!b._sprayed && b.x < bx.x + 40) {   // reached the board -> SPRAY tiny heads at the soul, fast
              b._sprayed = 1; b.dead = true; Snd.play('sneofire', 0.35);
              const base = Math.atan2(soul.y - b.y, soul.x - b.x);
              for (let i = 0; i < 7; i++) { const ang = base + (i - 3) * 0.14;
                out.push({ ...bulletProps('sneocrew'), x: b.x, y: b.y, vx: Math.cos(ang) * 6, vy: Math.sin(ang) * 6, r: 5, scale: 0.7, spin: 0.3, life: 80 }); }
            }
          } });
      }
    }
  },
};
// PIPIS EXPLOSION (Weird-Route attack): three Pipis appear on the right and EXPLODE into a ring of
// small, destroyable Spamton heads. (Exclusive to that route in canon; included as a Pipis attack.)
PATTERNS.sneo_pipisx = {
  dur: 300, box: { w: 260, h: 170 },
  tick(a) {
    const { f, box, add } = a;
    if (f % 96 === 20 && f < 250) {
      for (let p = 0; p < 3; p++) {
        add({ ...bulletProps('sneopipis0'), animKeys: ['sneopipis0', 'sneopipis1', 'sneopipis2', 'sneopipis3'], animRate: 6,
          x: box.x + box.w - 22, y: box.y + 30 + p * ((box.h - 60) / 2), vx: -1.1, vy: 0, r: 8, scale: 1.3,
          shootable: true, hp: 1, _boom: 42 + p * 6, life: 130,
          emit(b, out) {
            if (--b._boom <= 0) { b.dead = true; Snd.play('sneofire', 0.35);
              for (let i = 0; i < 10; i++) { const ang = i * Math.PI / 5;
                out.push({ ...bulletProps('sneocrew'), x: b.x, y: b.y, vx: Math.cos(ang) * 4.5, vy: Math.sin(ang) * 4.5, r: 5, scale: 0.65, spin: 0.3, shootable: true, hp: 1, life: 90 }); }
            }
          } });
      }
    }
  },
};

// ---------- THE ROARING KNIGHT (Ch3 secret boss) ----------
// Rebuilt frame-by-frame from the attack-guide footage (ref/knight/attack_guide.mp4,
// montages ref/vidframes/scan_*.png + clip_*.png). The guide's own captions name each
// ============================================================================
// ROARING KNIGHT (Chapter 3, obj_knight_enemy) — REBUILT 1:1 from the decompiled
// GML. 30fps sim (hz30:1 -> raw GML frames/speeds). Canonical rotation:
//   Stars(98) -> TrackingSwords(151) -> Flurry/box-split(99) -> SwordTunnel(153)
//   -> RotatingSlash(104) -> SwordVortex(154) -> Roaring(107)=ULT.
// scr_darksize baseline = image_xscale 2 (PS(2)=1.25, drawn 2x native). Native-
// scale sprites (tracking/vortex) use PS(1)=0.625 (1x native). Specs: knight_specs/*.md
// ============================================================================
const KN_BOX = { w: 162, h: 150 };
const D2R = Math.PI / 180;
// the Knight's on-field attack pose (spr_roaringknight_attack_ol), auto-expiring
function knightAtk(a) { a.fx.bossSprite = { key: 'knightattack', n: 6, rate: 4, ttl: 4 }; }

// STARS (type 98) — 3 phase variants (wiki attack table):
//   P1 explode into 3 shards · P2 into 6 · P3 into 2 that turn RED and home at the SOUL.
function knightStars(v) {
  const shardN = v === 2 ? 6 : v === 1 ? 3 : 2;
  return {
    dur: 205, hz30: 1, box: KN_BOX,
    tick(a) {
      const { f, box, add, rng } = a;
      const cx0 = box.x + box.w - 6, cy0 = box.y + box.h * 0.5, END = 150, EXPLODE = 172;
      const ca = 60 * (1 - Math.pow(1 - Math.min(1, f / 40), 3));
      if (f >= 45 && f <= END && (f - 45) % 4 === 0) {
        this._sz = (this._sz == null) ? 0.5 + rng() * 0.5 : (this._sz + 0.5 + Math.sin(f) * 0.5) % 1;
        this._sp = (this._sp == null) ? (rng() - 0.5) : (((this._sp + 1 + (0.5 + Math.sin(rng()) * 0.3)) % 1) - 0.5);
        const size = this._sz, dir = 180 + this._sp * ca, rad = dir * D2R, spd = 5 + (1 - size) * 5;
        const st = { ...bulletProps('knightstar'), x: cx0, y: cy0, vx: Math.cos(rad) * spd, vy: -Math.sin(rad) * spd,
          r: 7, grazeR: 12, scale: 0.15, grow: 0.04 + size * 0.05, growMax: 0.7 + size * 0.5, spin: 0.14, fric: 0.11,
          life: 230, redAt: Math.max(18, EXPLODE - f) - 12 };
        if (v === 3) {   // P3: detonate into 2 RED shards that HOME at the soul (one leads)
          st._bt = Math.max(18, EXPLODE - f);
          st.emit = function (b, out, soul) {
            if (!b._done && b.t >= b._bt) { b._done = 1; b.dead = true;
              for (let i = 0; i < 2; i++) { const ang = Math.atan2(soul.y - b.y, soul.x - b.x) + (i ? 0.5 : -0.5);
                out.push({ ...bulletProps('knighttri'), x: b.x, y: b.y, vx: Math.cos(ang) * 1.1, vy: Math.sin(ang) * 1.1,
                  rot: ang, tint: '#f33', r: 5, scale: 0.7, homing: 0.07 + i * 0.02, maxv: 5, life: 95 }); }
            }
          };
        } else {
          st.burst = Math.max(18, EXPLODE - f); st.burstN = shardN; st.burstImg = 'knighttri';
          st.burstSpeed = 3.2; st.burstScale = 0.7; st.burstLife = 90;
        }
        add(st); Snd.play('boardsummon', 0.2);
      }
      if (f === EXPLODE + 2) Snd.play('explosionmmx', 0.28);
      if (f > 40 && f < END) knightAtk(a);
    },
  };
}

// TRACKING SWORDS (type 151) — 3 phase variants:
//   P1 a single blade tracks the SOUL then slashes (10x, speeding up) · P2 "you feel surrounded":
//   a circle of swords contracts/expands + orbits the box · P3 like P1 but appears + fires much faster.
function knightTracking(v) {
  if (v === 2) {   // P2 — the surrounding, breathing sword-ring (was the standalone "vortex")
    return {
      dur: 250, hz30: 1, box: KN_BOX,
      tick(a) {
        const { f, box, add } = a, cx = box.x + box.w / 2, cy = box.y + box.h / 2, N = 8;
        const idx = (f >= 6 && (f - 6) % 3 === 0) ? (f - 6) / 3 : -1;
        if (idx >= 0 && idx < N) {
          add({ img: bulletProps('knightswordol').img, scale: 0.66, r: 13, alpha: 0.9,
            orbit: { cx, cy, R: 54, ang: idx * (Math.PI * 2 / N), w: -4.2 * D2R,
              pulse: { base: 54, amp: 28, freq: 0.05 },                 // contracts + expands
              center: { cx0: cx, cy0: cy, ax: 20, ay: 20, f: 0.016 } }, life: 300 });
        }
        knightAtk(a);
      },
    };
  }
  const CAD = v === 3 ? 14 : 22;   // P3 fires much faster
  return {
    dur: v === 3 ? 210 : 230, hz30: 1, box: KN_BOX,
    tick(a) {
      const { f, add } = a, LEN = 60, START = 16;
      if (f >= START && (f - START) % CAD === 0) {
        this._used = this._used || [];
        let dir; do { dir = (Math.floor(a.rng() * 8) * 45); } while (this._used.indexOf(dir) >= 0);
        this._used.push(dir); if (this._used.length > 3) this._used.shift();
        const track = v === 3 ? 22 : 32, fireT = track + 1;   // faster lock in P3
        const sw = { img: bulletProps('knightswordol').img, scale: 0.66, r: 0, noHit: true, life: fireT + 12,
          tint: '#f44', alpha: 0.5, _dir: dir, _len: LEN, rot: 0, _tk: track, _ft: fireT };
        sw.emit = function (b, out, soulNow) {
          const rad = b._dir * D2R, dx = Math.cos(rad), dy = -Math.sin(rad);
          if (b.t <= b._tk) {
            b.x = soulNow.x + dx * b._len; b.y = soulNow.y + dy * b._len;
            b.rot = Math.atan2(-dy, -dx);
            b.alpha = Math.min(0.9, b.t / 8) * (b.t < b._tk - 5 ? 0.6 : 1.0);
            if (b.t >= b._tk - 5) b.tint = '#ff3030';
            b._lx = b.x; b._ly = b.y; b._lr = Math.atan2(-dy, -dx);
          } else if (b.t === b._ft) {
            Snd.play('knightsword', 0.5);
            out.push({ shape: 'line', color: '#fff', len: 460, thick: 6, x: b._lx, y: b._ly,
              rot: b._lr, vx: 0, vy: 0, tellT: 1, armWindow: 4, dmg: b.dmg, shakeOnCut: true });
            b.dead = true;
          }
        };
        add(sw); Snd.play('smallswing', 0.35);
      }
      knightAtk(a);
    },
  };
}

// BOX SPLITTER (type 99) — 3 phase variants:
//   P1 cleaves ONE fixed orthogonal direction · P2 switches V/H each cleave · P3 also DIAGONAL
//   (diagonal cleave radiates teeth from the centre instead of splitting the box).
function knightFlurry(v) {
  return {
    dur: 300, hz30: 1, box: KN_BOX,
    tick(a) {
      const { f, box, add, rng } = a, cx = box.x + box.w / 2, cy = box.y + box.h / 2, GAP = 46;
      if (f >= 276) return;
      const ev = f % GAP;
      if (ev === 0) {   // choose this cleave's axis
        if (v === 1) this._axis = this._axis || (rng() < 0.5 ? 'h' : 'v');           // fixed all attack
        else if (v === 2) this._axis = rng() < 0.5 ? 'h' : 'v';                       // switch each time
        else { const r = rng(); this._axis = r < 0.4 ? 'h' : r < 0.8 ? 'v' : 'd'; }   // + diagonal
        if (this._axis === 'd') this._drot = (rng() < 0.5 ? 1 : -1) * Math.PI / 4;
      }
      const horiz = this._axis === 'h', diag = this._axis === 'd';
      if (ev === 0) {
        if (diag) add({ shape: 'line', color: '#f33', len: Math.hypot(box.w, box.h) * 1.1, thick: 5, x: cx, y: cy,
          rot: this._drot, vx: 0, vy: 0, tellT: 30, armWindow: 5, tellRamp: true, tellMax: 30 });
        else add({ shape: 'line', color: '#f33', len: (horiz ? box.w : box.h) * 1.06, thick: 5, x: cx, y: cy,
          rot: horiz ? 0 : Math.PI / 2, vx: 0, vy: 0, tellT: 30, armWindow: 5, tellRamp: true, tellMax: 30 });
        knightAtk(a);
      }
      if (!diag) {   // box physically splits (h/v only)
        let off = 0;
        if (ev >= 30 && ev < 44) off = (ev - 30) / 14 * 35;
        else if (ev >= 44 && ev < 60) off = 35;
        else if (ev >= 60 && ev < 74) off = 35 * (1 - (ev - 60) / 14);
        if (off > 0) a.fx.split = { axis: horiz ? 'h' : 'v', offset: off };
      }
      if (ev === 30) {
        Snd.play('explosionmmx', 0.3); a.fx.shake = 6;
        if (diag) {   // radiate teeth outward from the centre
          const M = 14;
          for (let i = 0; i < M; i++) { const ang = i * Math.PI * 2 / M;
            add({ ...bulletProps('knighttooth'), x: cx, y: cy, rot: ang + Math.PI / 2, scale: 0.9, r: 6, noHit: true,
              fireAt: 6, fireVX: Math.cos(ang) * 3.4, fireVY: Math.sin(ang) * 3.4, ax: Math.cos(ang) * 0.1, ay: Math.sin(ang) * 0.1, life: 52 }); }
        } else {   // 13 teeth erupt along the cut, accelerating outward
          const N = 13, span = horiz ? box.w : box.h, base = horiz ? box.x : box.y;
          for (let i = 0; i < N; i++) {
            const t = (i + 0.5) / N, pos = base + t * span;
            if (horiz) {
              add({ ...bulletProps('knighttooth'), x: pos, y: cy - 6, rot: 0, scale: 1.0, r: 7, noHit: true, ridesSplit: 1, fireAt: 6, fireVY: -3.6, ay: -0.16, life: 40 });
              add({ ...bulletProps('knighttooth'), x: pos, y: cy + 6, rot: Math.PI, scale: 1.0, r: 7, noHit: true, ridesSplit: -1, fireAt: 6, fireVY: 3.6, ay: 0.16, life: 40 });
            } else {
              add({ ...bulletProps('knighttooth'), x: cx - 6, y: pos, rot: -Math.PI / 2, scale: 1.0, r: 7, noHit: true, ridesSplit: 1, fireAt: 6, fireVX: -3.6, ax: -0.16, life: 40 });
              add({ ...bulletProps('knighttooth'), x: cx + 6, y: pos, rot: Math.PI / 2, scale: 1.0, r: 7, noHit: true, ridesSplit: -1, fireAt: 6, fireVX: 3.6, ax: 0.16, life: 40 });
            }
          }
        }
      }
    },
  };
}

// SWORD TUNNEL (type 153) — 3 phase variants:
//   P1 straight walls, wandering gap · P2 the incoming angle rotates (blades slant + sweep) ·
//   P3 straight but the gap is NARROWER.
function knightTunnel(v) {
  const gapH = v === 3 ? 34 : 46, FIN = 210;
  return {
    dur: 252, hz30: 1, box: KN_BOX,
    tick(a) {
      const { f, box, add, soul } = a, cyC = box.y + box.h / 2;
      if (f === 0) { this._gap = cyC; this._dir = 1; this._sw = 0; }
      if (f < FIN && f % 4 === 0) {
        if (this._sw <= 0) { this._sw = 2 + Math.floor(a.rng() * 3); this._dir = (this._gap > cyC + 12) ? -1 : (this._gap < cyC - 12) ? 1 : (a.rng() < 0.5 ? 1 : -1); }
        this._gap += this._dir * 5; this._sw--;
        this._gap = Math.max(cyC - 20, Math.min(cyC + 20, this._gap));
        const x0 = box.x + box.w + 16;
        const slant = v === 2 ? Math.sin(f * 0.05) * 2.2 : 0;    // P2: blades drift -> the corridor slants/rotates
        const blade = (yy, hh, rot) => add({ ...bulletProps('knightdiamondl2'), x: x0, y: yy, vx: -6, vy: slant, ax: -0.9, maxv: 20,
          rot, scale: 0.62, sx: 1.1, sy: Math.min(1.6, hh / 28), hitW: 12, hitH: hh + 4, life: 60 });
        const wall = (yStart, yEnd, rot) => { const h = yEnd - yStart; if (h < 10) return;
          const nb = Math.max(1, Math.round(h / 30)); for (let i = 0; i < nb; i++) blade(yStart + (i + 0.5) * h / nb, h / nb, rot); };
        wall(box.y + 3, this._gap - gapH / 2, Math.PI / 2);
        wall(this._gap + gapH / 2, box.y + box.h - 3, -Math.PI / 2);
        if (f % 12 === 0) Snd.play('heavyswing', 0.16);
      }
      if (f === FIN) {
        Snd.play('knightsword', 0.5);
        const ang = Math.atan2(soul.y - cyC, -1);
        add({ shape: 'line', color: '#fff', len: 520, thick: 10, x: box.x + box.w / 2, y: cyC, rot: ang,
          vx: 0, vy: 0, tellT: 24, armWindow: 7, tellRamp: true, tellMax: 24, shakeOnCut: true });
        knightAtk(a);
      }
      if (f > 4 && f < FIN) knightAtk(a);
    },
  };
}

// ROTATING SLASH (type 104) — 3 phase variants (wiki cut counts):
//   P1 1-2-2-3-3-4 · P2 3-3-4-4-4-4 · P3 3-4-4-4-4-4 then a fast SPIRAL finale.
function knightRotslash(v) {
  const SEQ = v === 1 ? [1, 2, 2, 3, 3, 4] : v === 2 ? [3, 3, 4, 4, 4, 4] : [3, 4, 4, 4, 4, 4];
  const finale = v === 3;
  return {
    dur: finale ? 326 : 250, hz30: 1, box: KN_BOX,
    tick(a) {
      const { f, box, add, soul, rng } = a, cx = box.x + box.w / 2, cy = box.y + box.h / 2, GAP = 36, INTRO = 16;
      for (let e = 0; e < SEQ.length; e++) {
        if (f !== INTRO + e * GAP) continue;
        const n = SEQ[e], base = rng() * Math.PI, spin = (rng() < 0.5 ? 1 : -1) * (0.14 + rng() * 0.08);
        for (let i = 0; i < n; i++)
          add({ shape: 'line', color: '#f33', len: Math.hypot(box.w, box.h) * 1.2, thick: 7, x: soul.x, y: soul.y,
            rot: base + i * Math.PI / n, vx: 0, vy: 0, spin, spinDecay: 0.9, tellT: 24, armWindow: 6, tellRamp: true, tellMax: 24 });
        knightAtk(a);
      }
      if (finale) {   // the spiral: 28 rapid box-centre lines sweeping around
        const FIN = INTRO + SEQ.length * GAP + 30;
        if (f >= FIN && f < FIN + 56 && (f - FIN) % 2 === 0) {
          const kk = (f - FIN) / 2;
          add({ shape: 'line', color: '#f33', len: Math.hypot(box.w, box.h) * 1.2, thick: 6, x: cx, y: cy,
            rot: kk * (Math.PI * 2 / 28), vx: 0, vy: 0, tellT: 14, armWindow: 6, shakeOnCut: true });
        }
      }
    },
  };
}

PATTERNS.knight_stars = knightStars(1);
PATTERNS.knight_stars2 = knightStars(2);
PATTERNS.knight_stars3 = knightStars(3);
PATTERNS.knight_tracking = knightTracking(1);
PATTERNS.knight_tracking2 = knightTracking(2);
PATTERNS.knight_tracking3 = knightTracking(3);
PATTERNS.knight_flurry = knightFlurry(1);
PATTERNS.knight_flurry2 = knightFlurry(2);
PATTERNS.knight_flurry3 = knightFlurry(3);
PATTERNS.knight_tunnel = knightTunnel(1);
PATTERNS.knight_tunnel2 = knightTunnel(2);
PATTERNS.knight_tunnel3 = knightTunnel(3);
PATTERNS.knight_rotslash = knightRotslash(1);
PATTERNS.knight_rotslash2 = knightRotslash(2);
PATTERNS.knight_rotslash3 = knightRotslash(3);

// FINAL ROAR (ULT, type 107 / obj_knight_roaring2 + roaring_star): blackout arena. The
// Knight charges (stars pulled IN), lets out THE ROAR (stars blast out + 3-fans), then
// every star DETONATES in sequence into shard-children, ending in a screen-splitting cut.
const ROAR_ROAR = 130, ROAR_EXPLODE = 300, ROAR_CUT = 372;
PATTERNS.knight_roar = {
  dur: 430, hz30: 1, box: KN_BOX,
  tick(a) {
    const { f, rng, box, add } = a;
    a.fx.blackout = true;
    a.fx.bgHue = (f >= ROAR_ROAR && f < ROAR_EXPLODE) ? 0 : (f * 2) % 360;
    a.fx.hideBox = true; a.fx.arena = true; a.fx.bgStars = true;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    // THE KNIGHT centre-screen: charge (flourish 0->6) -> roar loop -> slash finale
    let key = 'knightflourish0', scale = 2.1, n = 1, rate = 6, kf = 0;
    if (f < ROAR_ROAR) { const s = Math.min(6, Math.floor(f / 20)); key = 'knightflourish'; n = 7; rate = 20; kf = s; }
    else if (f < ROAR_EXPLODE) { key = 'knightroar'; n = 2; rate = 10; a.fx.shake = 5; }
    else if (f < ROAR_CUT) { key = 'knightroar'; n = 2; rate = 6; }
    else { key = 'knightslashf'; n = 6; rate = 8; kf = Math.min(5, Math.floor((f - ROAR_CUT) / 8)); scale = 4.0; }
    a.fx.boss = { key: (n > 1 ? key + (n === 7 ? kf : (Math.floor(f / rate) % n)) : key), x: cx, y: cy, scale };
    // CHARGE: stars pull IN (random, then two swirling arms)
    if (f < ROAR_ROAR) a.fx.pull = { x: cx, y: cy, force: 0.4 };
    if (f >= 20 && f < 80 && f % 6 === 0) {
      const th = rng() * 6.28, R = 340, x = cx + Math.cos(th) * R, y = cy + Math.sin(th) * R, toC = Math.atan2(cy - y, cx - x);
      add({ ...bulletProps('knightstar'), x, y, vx: Math.cos(toC) * 2.7, vy: Math.sin(toC) * 2.7, spin: 0, r: 8, life: 160 });
    }
    if (f >= 80 && f < ROAR_ROAR && f % 5 === 0) {
      const bse = f * 0.05, R = 350, vr = 2.8, vt = 2.0;
      for (const off of [0, Math.PI]) { const th = bse + off, x = cx + Math.cos(th) * R, y = cy + Math.sin(th) * R;
        add({ ...bulletProps('knightstar'), x, y, spin: 0, r: 8, life: 160, vx: -Math.cos(th) * vr - Math.sin(th) * vt, vy: -Math.sin(th) * vr + Math.cos(th) * vt }); }
    }
    if (f === ROAR_ROAR) Snd.play('knightlaugh', 0.6);
    // ROAR: spew stars OUT; they decelerate near the edges and can't detonate until EXPLODE,
    // when they ALL shatter (in sequence) into slow fading shard-children.
    const outStar = (th, sp) => {
      const burstIn = Math.max(20, ROAR_EXPLODE - f);
      add({ ...bulletProps('knightstar'), x: cx, y: cy, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp,
        ax: -Math.cos(th) * sp * 0.02, ay: -Math.sin(th) * sp * 0.02, spin: 0, r: 8,
        redAt: burstIn - 16, burst: burstIn, burstN: 6, burstImg: 'knighttri', burstSpeed: 1.0,
        burstScale: 1.0, burstLife: 200, burstFade: true, burstFadeDelay: 60 });
    };
    if (f === ROAR_ROAR) { for (let i = 0; i < 8; i++) outStar(i * Math.PI / 4, 3.1); a.fx.shake = 9; }
    if (f > ROAR_ROAR + 15 && f < ROAR_EXPLODE - 40 && f % 5 === 0) {
      const base = rng() * 6.28; for (let i = 0; i < 3; i++) outStar(base + (i - 1) * 0.35, 2.4 + rng() * 1.2);
    }
    if (f === ROAR_EXPLODE + 2) Snd.play('explosionmmx', 0.4);
    // FINAL screen-splitting diagonal cut
    if (f === ROAR_CUT) { Snd.play('ultraswing', 0.6);
      add({ shape: 'line', color: '#fff', len: 960, thick: 14, x: cx, y: cy, rot: Math.atan2(1, 1.6), vx: 0, vy: 0, tellT: 26, armWindow: 8, shakeOnCut: true }); }
  },
};




// ============================================================================
// GERSON BOOM — Hammer / Sound of Justice (Ch4). Rebuilt from the REAL GML roster.
// DELTARUNE runs at 30 FPS; the engine runs Gerson's sim at 30Hz (B.hz30), so every value
// below is the RAW GML per-tick number. Core = a directional SPEAR system you BLOCK with the
// GREEN shield (heart locked centre); a few RED free-move specials (shell kick, swing-down).
// Spear: spawns on its side at distance ~ and travels inward; block by facing that side.
// GML dir angle (0=r,90=u-in-GML,180=l,270=d) -> screen vel angle = -dir; block side = spawn side.
// ============================================================================
const GSC = (nat, disp) => disp / (nat * 1.6);
const G_STR2GML = { l: 0, d: 90, r: 180, u: 270, dr: 135, dl: 45, ur: 225, ul: 315 };
// one GREEN spear (obj_spearshot) from GML direction `gd`, inward speed `spd`; block by facing its side.
// Real sprite = spr_spear_arrow (YELLOW arrow); the NEXT-to-hit spear turns red (spr_spear_arrow_highlight) —
// that swap is done live in updDodge (soonest-arriving spear gets b.hiImg). Arrow points along travel.
function gSpear(a, gd, spd, opt) {
  opt = opt || {}; const { box, add } = a, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  // EXACT GML: spawn at len = speed * frames (frames=heartframes~50), travel at `spd`. So FASTER spears spawn
  // FARTHER offscreen and arrive at ~the same time (arrival = frames - 36/spd). Arrow drawn at HALF size (~17px).
  const va = -gd * Math.PI / 180, D = spd * (opt.frames || 50);
  const lo = bulletProps('gspear0').img, hi = bulletProps('gspearhi0').img;
  add({ img: lo, loImg: lo, hiImg: hi, isSpear: true, x: cx - Math.cos(va) * D, y: cy - Math.sin(va) * D,
        vx: Math.cos(va) * spd, vy: Math.sin(va) * spd, r: 6, scale: GSC(21, 17), rot: va, dmg: opt.dmg || 18, life: opt.life || 110 });
  Snd.play('smallswing', 0.3);
}
// GREEN multi-block turtle shell (obj_spearshot bouncespear) from side `gd`. `hp` = blocks needed
// (2 green, 3 blue/cyan, 4 purple, 5 red). opt.spin = spinning/cyan shell (returns 90 deg CCW on block);
// opt.big = larger + slower shell. Normal shells come from ONE direction (no spin) per the GML/wiki.
function gShell(a, gd, hp, opt) {
  opt = opt || {}; const { box, add } = a, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  // GML: shell = obj_spearshot bouncespear, SAME speed model as spears (fakespeed = speed, len = speed*frames).
  // Falls toward the SOUL at spear speed; opt.big = slower/larger. Spawn well offscreen at speed*frames.
  const va = -gd * Math.PI / 180, posAng = va + Math.PI, spd = opt.spd || (opt.big ? 4 : G_SLOW), D = spd * (opt.frames || 46);
  add({ shape: 'shell', shell: true, shellRadial: true, blocksLeft: hp, shellSpin: !!opt.spin,
        shellLen: D, shellPosAng: posAng, shellPosTarget: posAng, shellSpeed: spd, shellBaseSpeed: spd, shellGrav: 0, shellState: 0,
        x: cx + Math.cos(posAng) * D, y: cy + Math.sin(posAng) * D, vx: 0, vy: 0,
        r: opt.big ? 11 : 8, scale: opt.big ? 0.8 : 0.55, dmg: 20 });   // HALF size (GML scr_darksize baseline is 2x)
}
// play a fixed spear sequence (each entry [gmlTick, gmlDirString-or-number, speed]); auto green.
// GREEN sequence system (wiki-exact). Tokens: ['s',dir]=slow spear, ['f',dir]=fast spear,
// ['H',dir,hp]=shell (2=green,3=blue,4=purple,5=red), ['w',frames]=extra pause. dir = a G_STR2GML key
// (the direction the SHIELD must FACE to block, per the wiki). Cadence: slow 26f, fast 13f, shell 44f.
const G_SLOW = 6.4, G_FAST = 12;   // GML fakespeed (attack 0 spearspeed 8 -> 6.4 slow / 8; fast volleys ramp to 18)
// tokens: ['s',dir]/['f',dir] slow/fast spear; ['H',dir,hp] normal shell; ['Hs',dir,hp] SPINNING (cyan)
// shell (returns 90 CCW); ['Hb',dir,hp] big+slow shell; ['w',frames] pause.
function gBuild(tokens, t0) {
  let t = (t0 == null ? 20 : t0); const seq = [];
  for (const [ty, a1, a2] of tokens) {
    if (ty === 'w') { t += a1; continue; }
    if (ty === 'H' || ty === 'Hs' || ty === 'Hb') {
      seq.push({ t, dir: a1, kind: 'shell', hp: a2 || 2, spin: ty === 'Hs', big: ty === 'Hb' }); t += 44; continue;
    }
    seq.push({ t, dir: a1, spd: ty === 'f' ? G_FAST : G_SLOW }); t += (ty === 'f' ? 13 : 26);
  }
  return seq;
}
function gRun(a, seq) {
  for (const e of seq) if (a.f === e.t) {
    const d = typeof e.dir === 'string' ? G_STR2GML[e.dir] : (((e.dir % 360) + 360) % 360);
    if (e.kind === 'shell') gShell(a, d, e.hp, { spin: e.spin, big: e.big }); else gSpear(a, d, e.spd);
  }
}
// --- GREEN: SPEAR VOLLEY (fight) = wiki Attack 1 + Attack 3, exact. ---
// A1: u u u l d r (slow). A3: slow u u u l d, then fast r r l l r l u u u.
const GSEQ_SPEARS = gBuild([
  ['s','u'],['s','u'],['s','u'],['s','l'],['s','d'],['s','r'], ['w',36],
  ['s','u'],['s','u'],['s','u'],['s','l'],['s','d'], ['w',10],
  ['f','r'],['f','r'],['f','l'],['f','l'],['f','r'],['f','l'],['f','u'],['f','u'],['f','u'],
]);
PATTERNS.gerson_spears = {
  dur: 515, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) { a.fx.greenSoul = true; gRun(a, GSEQ_SPEARS); },
};
// --- GREEN: UPPER BARRAGE (spell) = wiki Attack 9, exact. octagon. ---
// normal ul ul u u ur ur | fast ul u ur u u ul u ur | normal d dl d dr.
const GSEQ_BARRAGE = gBuild([
  ['s','ul'],['s','ul'],['s','u'],['s','u'],['s','ur'],['s','ur'], ['w',10],
  ['f','ul'],['f','u'],['f','ur'],['f','u'],['f','u'],['f','ul'],['f','u'],['f','ur'], ['w',12],
  ['s','d'],['s','dl'],['s','d'],['s','dr'],
]);
PATTERNS.gerson_barrage = {
  dur: 440, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) { a.fx.greenSoul = { oct: true }; gRun(a, GSEQ_BARRAGE); },
};
// --- GREEN: ROTATING SPEAR SWEEP (spell) = wiki Attack 17, exact. octagon. ---
// 5 arrows CW right->..., 5 CCW down->..., 11 CW, then 30 CCW accelerating. 45deg steps (8-dir).
function gSweepSeq() {
  const seq = []; let t = 16;
  const push = (n, base, step, gap0, gapK) => { for (let i = 0; i < n; i++) {
    seq.push({ t: Math.round(t), dir: ((base + step * i) % 360 + 360) % 360, spd: G_FAST + (gapK ? i * 0.14 : 0) });
    t += Math.max(4, gap0 - (gapK ? i * gapK : 0)); } };
  push(5, 180, -45, 8, 0); t += 10;   // right -> ... (CW)
  push(5, 90, 45, 8, 0);  t += 10;    // down -> ... (CCW)
  push(11, 180, -45, 8, 0); t += 12;  // 11 CW
  push(30, 90, 45, 8, 0.13);          // 30 CCW, accelerating
  return seq;
}
const GSEQ_SWEEP = gSweepSeq();
PATTERNS.gerson_spearsweep = {
  dur: 460, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) { a.fx.greenSoul = { oct: true }; gRun(a, GSEQ_SWEEP); },
};
// --- GREEN: SHELL VOLLEY (spell) = wiki Attack 11, exact. octagon. ---
// 4 fast shells u l r d; shell(top)+5 arrows; reflected shell(bottom)+5 arrows; arrows r l d ul dl.
const GSEQ_SHELLVOLLEY = gBuild([
  ['H','u',2],['w',-30],['H','l',2],['w',-30],['H','r',2],['w',-30],['H','d',2], ['w',24],
  ['H','u',2], ['f','l'],['f','dl'],['f','d'],['f','dr'],['f','r'], ['w',20],
  ['H','d',2], ['f','l'],['f','ul'],['f','u'],['f','ur'],['f','r'], ['w',20],
  ['s','r'],['s','l'],['s','d'],['s','ul'],['s','dl'],
]);
PATTERNS.gerson_shellvolley = {
  dur: 555, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) { a.fx.greenSoul = { oct: true }; gRun(a, GSEQ_SHELLVOLLEY); },
};
// --- RED (free move): SHELL KICK (AP 72) — a shell ricochets; side-wall hits re-aim it at the SOUL and
// ramp its speed to 15; the 7th kick sends it up, then it slams straight down into a 28-star starburst. ---
PATTERNS.gerson_shellkick = {
  dur: 300, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f, box, add, soul } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f !== 0) return;
    const a0 = Math.atan2(soul.y - cy, soul.x - (box.x + box.w + 18));
    const shell = { ...bulletProps('gshell'), x: box.x + box.w + 18, y: cy, vx: Math.cos(a0) * 12, vy: Math.sin(a0) * 12, r: 9, grazeR: 14, scale: GSC(45, 26), spin: 0.4, _kicks: 0, _phase: 0 };
    shell.emit = function (b, out, s) {
      const L = box.x + 8, R = box.x + box.w - 8, T = box.y + 8, Bt = box.y + box.h - 8;
      if (b._phase === 0) {
        if (b.y < T) { b.y = T; b.vy = Math.abs(b.vy); } else if (b.y > Bt) { b.y = Bt; b.vy = -Math.abs(b.vy); }
        if (b.x < L || b.x > R) {
          b.x = b.x < L ? L : R; b._kicks++;
          if (b._kicks >= 7) { const ang = Math.atan2((cy - 70) - b.y, cx - b.x); b.vx = Math.cos(ang) * 10; b.vy = Math.sin(ang) * 10; b._phase = 1; }
          else { b._sp = Math.min(15, (b._sp || 12) + 1.5); const ty = (Math.random() < 0.5) ? s.y : (2 * cy - s.y);
                 const ang = Math.atan2(ty - b.y, s.x - b.x); b.vx = Math.cos(ang) * b._sp; b.vy = Math.sin(ang) * b._sp; }
          Snd.play('boarddmg', 0.25);
        }
      } else if (b._phase === 1) {
        if (b.y <= cy - 55 || b.x < L || b.x > R) { b.x = Math.max(L, Math.min(R, b.x)); b.vx = 0; b.vy = 30; b._phase = 2; }
      } else if (b._phase === 2) {
        if (b.y >= Bt) {
          b.dead = true; Battle.shake = 16; Snd.play('boardbomb', 0.5);
          const arcs = [[4, 0, 12.0, 0.535, 4], [10, 24, 13.25, 0.5, 7], [8, 0, 14.5, 0.465, 6], [6, -24, 15.75, 0.43, 5]];
          for (const [n, xo, sp, grav, spr] of arcs) for (let i = 0; i < n; i++) {
            const ang = -Math.PI / 2 + (n > 1 ? (i / (n - 1) - 0.5) * 2 * spr * Math.PI / 180 : 0);
            out.push({ ...bulletProps('gstar7'), x: b.x + xo, y: Bt, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ay: grav, r: 6, grazeR: 12, scale: GSC(16, 16), spin: 0.2, life: 140, dmg: b.dmg });
          }
        }
      }
    };
    add(shell);
  },
};
// ============================================================================
// SHELL PINBALL (obj_gerson_shell_pinball, wiki Attack 7) — FULL GML port.
// Gerson swings -> launches a green shell aimed at the SOUL (speed 12). It bounces off the box TOP/BOTTOM only
// (squash-stretch + sfx), PASSES THROUGH the sides; when it exits a side Gerson teleports there, swings, and
// knocks it back at the SOUL (counter++ up to 7, speed ramps to 15, 50% bank shots). After the 7th kick it
// flies to the top-right, Gerson slams it DOWN the middle, and it SHATTERS into a 28-star gravity fountain
// (4 fans, random dir/speed jitter, normal+small variants). Trailing ~6 stars fade by scaling to 0.
// ============================================================================
function gPinTrailStar(x, y) {   // spr_thrash_star: full size 22f, then scale->0 over 4f (~6 alive)
  return { ...bulletProps('gtstar0'), x, y, vx: 0, vy: 0, r: 6, grazeR: 10, scale: 0.72,
           rot: Math.random() * 6.28, spin: 0.25, dmg: 40, life: 26, shrinkAfter: 22, shrinkStep: 0.2 };
}
function gPinSwing(x, y, flipLeft) {   // transient Gerson SWING pose (spr_gerson_swing frames 3..6) at the exit side
  return { img: bulletProps('gswing3').img, animKeys: ['gswing3', 'gswing4', 'gswing5', 'gswing6'], animRate: 2,
           x, y, vx: 0, vy: 0, noHit: true, scale: 0.8, flip: !!flipLeft, life: 10 };
}
function gPinBurst(b, out) {   // 4 fans of spr_gerson_star7 firing UP with gravity DOWN (fountain), jittered
  const FANS = [[-2, 2, 4, 12, 0.535, 0], [-5, 5, 7, 13.25, 0.5, 24], [-4, 4, 6, 14.5, 0.465, 0], [-3, 3, 5, 15.75, 0.43, -24]];
  for (const [a0, a1, step, spd0, grav, xo] of FANS) {
    for (let a = a0; a < a1; a++) {
      const gml = 90 + step * a + (Math.random() * 2 - 1);           // GML direction (90 = UP)
      const sp = spd0 + (Math.random() * 2 - 1), sc = Math.random() < 0.5 ? 1.0 : 0.66;   // normal + SMALL variant
      let vx = Math.cos(gml * Math.PI / 180) * sp * 0.5, vy = -Math.sin(gml * Math.PI / 180) * sp;   // hspeed *= 0.5
      out.push({ ...bulletProps('gstar7'), x: b.x + xo, y: b.y, vx, vy, ay: grav, r: 6, grazeR: 11,
                 scale: sc, rot: Math.random() * 6.28, spin: 0.22, dmg: 44, life: 170 });
    }
  }
}
function gPinKnock(b, s, bx) {   // Gerson knocks the shell back (counter<7 -> aim at soul, ramp to 15; else top-smash)
  const cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2;
  b._cnt++; Snd.play('heavyswing', 0.4); Battle.shake = Math.max(Battle.shake, 6);
  if (b._cnt < 7) {
    const ang = Math.atan2(s.y - b.y, s.x - b.x), sp = Math.min(15, Math.hypot(b.vx, b.vy) + 1.5);
    b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
  } else {   // aim ABOVE CENTRE, then Gerson slams it down the MIDDLE (it shatters at the centre, not the side)
    const tx = cx, ty = cy - bx.h / 2 - 80, dist = Math.hypot(tx - b.x, ty - b.y), ang = Math.atan2(ty - b.y, tx - b.x);
    b.vx = Math.cos(ang) * (dist / 30); b.vy = Math.sin(ang) * (dist / 30); b._tt = 0;
  }
}
function gPinballShell(box, x, y, ang, spd) {
  return {
    ...bulletProps('gshellspr0'), x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
    r: 12, grazeR: 15, scale: 0.65, spin: 0.42, tint: '#33ff33', dmg: 44,   // ~10% smaller, normal green shell sprite
    _cnt: Math.random() < 0.5 ? 0 : -1, _lt: -1, _rt: -1, _tt: -1, _tmr: 0, _sqT: 0,
    emit(b, out, s, bx) {
      const cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2, T = cy - bx.h / 2, B = cy + bx.h / 2;
      b._tmr++;
      if (b._sqT > 0 && --b._sqT === 0) { b.sx = 1; b.sy = 1; }        // squash decays back
      if (b._tmr % 4 === 0 && b._tt < 0) out.push(gPinTrailStar(b.x, b.y));
      if (b.x > cx - 72 && b.x < cx + 72) {                            // vertical bounce (top/bottom only)
        if (b.y > B - 14 && b._cnt < 7 && b.vy > 0) { b.y = B - 14; b.vy = -b.vy; b.sx = 1.5; b.sy = 0.5; b._sqT = 6; Snd.play('criticalswing', 0.35); }
        else if (b.y < T + 14 && b._cnt < 7 && b.vy < 0) { b.y = T + 14; b.vy = -b.vy; b.sx = 1.5; b.sy = 0.5; b._sqT = 6; Snd.play('criticalswing', 0.35); }
        if (b.y > B - 14 && b._tt >= 20) { gPinBurst(b, out); b.dead = true; Battle.shake = 18; Battle.flash = 6; Snd.play('explosionmmx', 0.5); Battle._pinBurstF = Battle.anim.f; return; }
      }
      if (b.x < cx - 73 && b.vx < 0 && b._lt === -1) b._lt = 0;        // exits left/right (through the walls)
      if (b.x > cx + 92 && b.vx > 0 && b._rt === -1) b._rt = 0;
      if (b._lt > -1) b._lt++; if (b._rt > -1) b._rt++; if (b._tt > -1) b._tt++;
      if (b._lt === 1) out.push(gPinSwing(b.x - 30, b.y, true));
      if (b._lt === 7) { gPinKnock(b, s, bx); b._lt = -1; }
      if (b._rt === 1) out.push(gPinSwing(b.x + 30, b.y, false));
      if (b._rt === 7) { gPinKnock(b, s, bx); b._rt = -1; }
      if (b._tt === 0) { out.push({ img: bulletProps('gblade0').img, animKeys: ['gblade0', 'gblade1'], animRate: 3, x: cx, y: T - 40, vx: 0, vy: -1.5, noHit: true, scale: 1, life: 34 }); Snd.play('smallswing', 0.4); }
      if (b._tt === 30) { b.vx = 0; b.vy = 30; Battle.shake = 14; Snd.play('bosshit', 0.5); }
    },
  };
}
PATTERNS.gerson_pinball = {
  dur: 700, box: { w: 150, h: 150 }, hz30: 1,   // dur is a backstop; it really ends ~90f after the shell SHATTERS
  tick(a) {
    const { f, box, add } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2, gx = box.x + box.w + 54, gy = cy;
    if (f <= 1) Battle._pinBurstF = 0;
    if (f === 10) { add(gPinSwing(gx, gy, false)); Snd.play('heavyswing', 0.4); Battle.shake = 8; }   // Gerson wind-up swing
    if (f === 32) { Snd.play('rudebuster', 0.4); add(gPinballShell(box, gx, gy, Math.atan2(cy - gy, cx - gx), 12)); }   // LAUNCH aimed at the soul
    if (Battle._pinBurstF && Battle.anim.f - Battle._pinBurstF > 90) a.fx.attackDone = true;   // end once the star fountain has rained down
  },
};
// --- RED (free move): SWING DOWN (obj_gerson_swing_down_new, wiki Attack 12) — Gerson lunges his BLADE
// (spr_gerson_swing_down_new) down through a side of the board: middle, right, left, middle, left, right,
// left; then a fakeout, then a horizontal slash right->left at the SOUL. Blade telegraphs (poised) then
// slams (GML speed 50). Dodge to the UNslashed side. ---
function gBladeSlash(a, x, y, rotAng, fvx, fvy, hitW, hitH, tel) {
  const { add, box } = a;
  a.fx.bossSprite = { key: 'gswing', n: 7, rate: 3, ttl: 16 };   // Gerson visibly SWINGS when a slash fires
  a.fx.shake = Math.max(a.fx.shake || 0, 3);
  add({ ...bulletProps('gblade0'), x, y, vx: 0, vy: 0, rot: rotAng, scale: GSC(52, 110),
        noHit: true, fireAt: tel, fireVX: fvx, fireVY: fvy, hitW, hitH, dmg: 26, life: tel + 16 });
  // telegraph zone: RED then FADES TO WHITE as the slash lands (GML gerson telegraph colour ramp)
  add({ shape: 'line', color: '#ff3b3b', tellRamp: true, tellMax: tel, len: (Math.abs(fvy) > Math.abs(fvx) ? box.h : box.w) * 1.8, thick: hitW,
        x: x + (fvx ? Math.sign(fvx) * 30 : 0), y: y + (fvy ? Math.sign(fvy) * 30 : 0), rot: rotAng + Math.PI / 2,
        vx: 0, vy: 0, tellT: tel, armWindow: 5, dmg: 26, noHit: false, shakeOnCut: true });
  Snd.play('heavyswing', 0.4);
}
PATTERNS.gerson_swingdown = {
  dur: 400, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f, box } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const L = cx - 40, M = cx, R = cx + 40;
    const COLS = [M, R, L, M, L, R, L];                                   // wiki Attack 12 slash order
    COLS.forEach((colX, i) => { if (f === 26 + i * 42)
      gBladeSlash(a, colX, box.y - 96, 0, 0, 42, 62, box.h + 90, 12);     // vertical blade slams DOWN a column
    });
    // FAKEOUT finish: a horizontal blade sweeps right -> left across the whole board at the SOUL.
    if (f === 26 + 7 * 42 + 20)
      gBladeSlash(a, box.x + box.w + 60, cy, Math.PI / 2, -46, 0, box.w + 140, 60, 14);
  },
};
// --- GREEN (ult): TRIAL OF THE HOLY HAMMER — Gerson's climax, true to his "BLOCK, don't dodge" identity.
// Escalating 8-way spear volleys, multi-block turtle shells, then a giant "holy hammer" overhead you must
// block UP. Everything is blockable in the octagon green mode (no unfair unblockable cuts). ---
const G_D8 = [0, 45, 90, 135, 180, 225, 270, 315];
PATTERNS.gerson_finale = {
  dur: 470, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f, box, add, rng } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    a.fx.greenSoul = { oct: true };
    // PHASE 1 (20-170): rotating spear volley, cadence tightens 12 -> 8.
    if (f >= 20 && f < 170) { const cad = f < 96 ? 12 : 8; if (f % cad === 0) gSpear(a, G_D8[Math.floor(f / cad) % 8], 9 + rng() * 3); }
    // PHASE 2 (120-345): multi-block shells from rotating sides + spear fill between them.
    if (f >= 120 && f < 345 && f % 40 === 10) gShell(a, [0, 90, 180, 270][Math.floor(f / 40) % 4], 2 + Math.floor(rng() * 3));
    if (f >= 170 && f < 345 && f % 7 === 0) gSpear(a, G_D8[Math.floor(f / 7) % 8], 11 + rng() * 3);
    // PHASE 3 CLIMAX (350+): spear STORM + two giant HOLY HAMMER shells (block UP, then DOWN).
    if (f >= 350) {
      if (f === 350) { Battle.shake = 18; Battle.flash = 8; Snd.play('bosshit', 0.6); }
      if (f < 440 && f % 5 === 0) gSpear(a, G_D8[Math.floor(f / 5) % 8], 13 + rng() * 3);
      if (f === 362 || f === 402) {                                              // the "holy hammer": a huge 4-block shell
        const gd = f === 362 ? 270 : 90, va = -gd * Math.PI / 180, D = 230, spd = 3.4;
        add({ shape: 'shell', shell: true, blocksLeft: 4, shellSpin: true, shellSpeed: 3.4, x: cx - Math.cos(va) * D, y: cy - Math.sin(va) * D,
              vx: Math.cos(va) * spd, vy: Math.sin(va) * spd, r: 20, scale: 1.5, dmg: 44 });
        Snd.play('heavyswing', 0.5);
      }
    }
  },
};

// ============================================================================
// GERSON — ALL 21 ATTACKS (gn_atk1..gn_atk21), wiki-EXACT (deltarune.wiki/w/Hammer_of_Justice).
// Directions are the way the SHIELD must FACE to block (= the side the spear is on). Green attacks use the
// gBuild/gRun sequence compiler; red/transition attacks reuse the verified red patterns. The block mechanic
// itself (ring 36/46, tol 50/30, parry 2.5 vs 1.25, len<16 heart hit) lives in battle.js resolveGreen.
// ============================================================================
const gAtkDur = seq => Math.max(...seq.map(e => e.t)) + 62;   // last spawn + ~48f arrival + small tail (no dead time)
function gGreen(tokens, oct) { const seq = gBuild(tokens); return { dur: gAtkDur(seq), _seq: seq, _oct: oct,
  box: { w: 150, h: 150 }, hz30: 1, tick(a) { a.fx.greenSoul = this._oct ? { oct: true } : true; gRun(a, this._seq); } }; }

// 1: slow u u u l d r.
PATTERNS.gn_atk1 = gGreen([['s','u'],['s','u'],['s','u'],['s','l'],['s','d'],['s','r']], false);
// 2: replay of 1 (only if you were hit on 1), a touch quicker.
PATTERNS.gn_atk2 = gGreen([['f','u'],['f','u'],['f','u'],['f','l'],['f','d'],['f','r']], false);
// 3: slow u u u l d, then fast r r l l r l u u u.
PATTERNS.gn_atk3 = gGreen([['s','u'],['s','u'],['s','u'],['s','l'],['s','d'],['w',12],
  ['f','r'],['f','r'],['f','l'],['f','l'],['f','r'],['f','l'],['f','u'],['f','u'],['f','u']], false);
// 4: fast r u d r d u, slow l, fast r u d l d u l l, slow r.
PATTERNS.gn_atk4 = gGreen([['f','r'],['f','u'],['f','d'],['f','r'],['f','d'],['f','u'],['w',8],['s','l'],['w',10],
  ['f','r'],['f','u'],['f','d'],['f','l'],['f','d'],['f','u'],['f','l'],['f','l'],['w',8],['s','r']], false);
// 5: (u r u l) x3 varying, then becomes 8-directional -> ul, ur.
PATTERNS.gn_atk5 = gGreen([['f','u'],['f','r'],['f','u'],['f','l'],['s','u'],['f','r'],['s','u'],['f','l'],
  ['f','u'],['f','r'],['f','u'],['f','l'],['w',8],['s','ul'],['w',6],['s','ur']], true);
// 6: GREEN arrows d ul d ur d r d l while a hammer falls -> turns SOUL RED -> Gerson slashes down CENTRE.
PATTERNS.gn_atk6 = {
  dur: 300, box: { w: 150, h: 150 }, hz30: 1,
  _seq: gBuild([['s','d'],['s','ul'],['s','d'],['s','ur'],['s','d'],['s','r'],['s','d'],['s','l']]),
  tick(a) { const { f, box, add } = a; const cx = box.x + box.w / 2, RED = 232;
    a.fx.greenSoul = f < RED ? { oct: true } : false;   // GREEN until the hammer lands, then RED (must clear explicitly)
    gRun(a, this._seq);
    // a big hammer SLOWLY falls from the top the whole time — watch it; when it lands the SOUL turns RED.
    if (f === 12) add({ ...bulletProps('ghammer40'), x: cx, y: box.y - 150, vx: 0, vy: 0, ay: 0.006, spin: 0.05,
                        noHit: true, scale: GSC(14, 46), life: RED - 6, _fallHammer: 1 });
    if (f === RED) { Battle.shake = 16; Battle.flash = 8; Snd.play('bosshit', 0.6); }   // hammer lands -> RED (soul frees up)
    // the centre slash: a LONG telegraph after the flip so you have time to move to a side before it lands.
    if (f === RED + 26) gBladeSlash(a, cx, box.y - 96, 0, 0, 42, 70, box.h + 90, 20);
  },
};
// 7: shell PINBALL + star fountain (red) — defined above. (8/13/14 red aliases are set after their patterns.)
PATTERNS.gn_atk7 = PATTERNS.gerson_pinball;   // wiki Attack 7 = the SHELL PINBALL (not the old shell-kick)
// 9: slow ul ul u u ur ur | fast ul u ur u u ul u ur | slow d dl d dr.
PATTERNS.gn_atk9 = gGreen([['s','ul'],['s','ul'],['s','u'],['s','u'],['s','ur'],['s','ur'],['w',10],
  ['f','ul'],['f','u'],['f','ur'],['f','u'],['f','u'],['f','ul'],['f','u'],['f','ur'],['w',12],
  ['s','d'],['s','dl'],['s','d'],['s','dr']], true);
// 10: 3l 3r u ul d dr 3r 3l d dr u, then a green shell from top + two shells left then right.
PATTERNS.gn_atk10 = gGreen([['s','l'],['s','l'],['s','l'],['f','r'],['f','r'],['f','r'],['s','u'],['s','ul'],
  ['s','d'],['s','dr'],['f','r'],['f','r'],['f','r'],['f','l'],['f','l'],['f','l'],['s','d'],['s','dr'],['s','u'],
  ['w',10],['H','u',2],['w',20],['H','l',2],['H','r',2]], true);
// 11: 4 fast shells u l r d | shell(top)+5 arrows | reflected shell(bottom)+5 | arrows r l d ul dl.
PATTERNS.gn_atk11 = gGreen([['H','u',2],['w',-30],['H','l',2],['w',-30],['H','r',2],['w',-30],['H','d',2],['w',24],
  ['H','u',2],['f','l'],['f','dl'],['f','d'],['f','dr'],['f','r'],['w',20],
  ['H','d',2],['f','l'],['f','ul'],['f','u'],['f','ur'],['f','r'],['w',20],
  ['s','r'],['s','l'],['s','d'],['s','ul'],['s','dl']], true);
// 12: GREEN shells u l d, then a hammer from the RIGHT -> RED -> the column slash sequence + fakeout.
PATTERNS.gn_atk12 = {
  dur: 460, box: { w: 150, h: 150 }, hz30: 1,
  _seq: gBuild([['H','u',2],['H','l',2],['H','d',2]]),
  tick(a) { const { f, box } = a; const cx = box.x + box.w / 2, RED = 210;
    a.fx.greenSoul = f < RED ? { oct: true } : false;
    gRun(a, this._seq);
    if (f === RED) { Battle.shake = 14; Battle.flash = 6; Snd.play('bosshit', 0.55); }
    const L = cx - 40, M = cx, R = cx + 40, COLS = [M, R, L, M, L, R, L];   // longer lead-in after the flip + a big telegraph
    COLS.forEach((colX, i) => { if (f === RED + 30 + i * 40) gBladeSlash(a, colX, box.y - 96, 0, 0, 42, 62, box.h + 90, 18); });
    if (f === RED + 30 + 7 * 40 + 22) gBladeSlash(a, box.x + box.w + 60, box.y + box.h / 2, Math.PI / 2, -46, 0, box.w + 140, 60, 18);
  },
};
// 8/14: the hammer throw (14 is a repeat of 8) — aliases set after gerson_boxthrow is defined (below).
// 15: cyan SPINNING shells (bounce 90 CCW) + fast arrows. Hs(u,3) Hs(ur,3) then l r dr r ul l ur dl u (last 3 fast).
PATTERNS.gn_atk15 = gGreen([['Hs','u',3],['w',6],['Hs','ur',3],['w',20],
  ['s','l'],['s','r'],['s','dr'],['s','r'],['s','ul'],['s','l'],['f','ur'],['f','dl'],['f','u']], true);
// 16: green shell l, arrows d dr, shell r; arrows u d; d u; 3 cyan shells r ur u; ul; cyan dr r ur; then arrows + top hammer.
PATTERNS.gn_atk16 = gGreen([['H','l',2],['s','d'],['s','dr'],['H','r',2],['w',10],['s','u'],['s','d'],['w',20],
  ['s','d'],['s','u'],['w',10],['Hs','r',3],['Hs','ur',3],['Hs','u',3],['w',10],['s','ul'],
  ['Hs','dr',3],['Hs','r',3],['Hs','ur',3],['w',12],['f','u'],['f','u'],['H','u',2]], true);
// 17: rotating spear SWEEP (5 CW, 5 CCW, 11 CW, 30 CCW accelerating) — the verified sweep.
PATTERNS.gn_atk17 = PATTERNS.gerson_spearsweep;
// 18: 32 arrows from all directions, starting slow and speeding up.
PATTERNS.gn_atk18 = { dur: 470, box: { w: 150, h: 150 }, hz30: 1,
  _seq: (function () { const D = ['r','dr','d','dl','l','ul','u','ur']; let t = 20; const s = [];
    for (let i = 0; i < 32; i++) { s.push({ t, dir: D[(i * 5 + 3) % 8], spd: 6 + i * 0.16 }); t += Math.round(Math.max(9, 20 - i * 0.35)); } return s; })(),
  tick(a) { a.fx.greenSoul = { oct: true }; gRun(a, this._seq); } };
// 19: 48 arrows from all directions, all slow but very densely packed.
// 19: 48 arrows from all directions, all SLOW but EXTREMELY CONSOLIDATED (tight 5f gaps -> a dense wall you
// must block continuously). Pseudo-random directions (deterministic so it's a fixed pattern).
PATTERNS.gn_atk19 = { dur: 320, box: { w: 150, h: 150 }, hz30: 1,
  _seq: (function () { const D = ['r','dr','d','dl','l','ul','u','ur']; let t = 16; const s = [];
    for (let i = 0; i < 48; i++) { s.push({ t, dir: D[(i * 3 + i * i + 5) % 8], spd: 6 }); t += 5; } return s; })(),
  tick(a) { a.fx.greenSoul = { oct: true }; gRun(a, this._seq); } };
// 20 (wiki-exact): cyan shell(top)+arrows r dr d / ur r ur / ul; cyan shell(right)+arrows r ur u ur / u l dl;
// 4 cyan shells u l r d +arrow ul; 3 cyan shells ur ul dr +arrows u r. Cyan shells (hp3) bounce 90 CCW each hit.
PATTERNS.gn_atk20 = gGreen([
  ['Hs','u',3], ['w',24], ['s','r'],['s','dr'],['s','d'], ['w',26], ['s','ur'],['s','r'],['s','ur'], ['w',24], ['s','ul'], ['w',34],
  ['Hs','r',3], ['w',24], ['s','r'],['s','ur'],['s','u'],['s','ur'], ['w',26], ['s','u'],['s','l'],['s','dl'], ['w',44],
  ['Hs','u',3],['w',-30],['Hs','l',3],['w',-30],['Hs','r',3],['w',-30],['Hs','d',3], ['w',12],['s','ul'], ['w',40],
  ['Hs','ur',3],['w',-30],['Hs','ul',3],['w',-30],['Hs','dr',3], ['w',12],['s','u'],['s','r']], true);
// 21 (FINAL): cyan u, green l, cyan ur, fast RED shell(5) from right; green u; hammer from LEFT -> RED;
// then Gerson slashes in a circle from the top-right corner CCW (move in a circle near centre).
PATTERNS.gn_atk21 = {
  dur: 620, box: { w: 150, h: 150 }, hz30: 1,
  _seq: gBuild([['Hs','u',3],['H','l',2],['Hs','ur',3],['H','r',5],['w',20],['H','u',2]]),
  tick(a) { const { f, box } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2, RED = 300;
    a.fx.greenSoul = f < RED ? { oct: true } : false;
    gRun(a, this._seq);
    if (f === RED) { Battle.shake = 16; Battle.flash = 8; Snd.play('bosshit', 0.6); }
    // 18 slashes spiralling CCW from the top-right, 45deg step, ACCELERATING (beat 16 -> 6) — orbit the centre.
    // Lead-in after the red flip (34f) + a bigger telegraph on the first slash so you can start circling.
    if (f <= 1) this._spiral = null;
    if (!this._spiral) { const s = []; let t = RED + 34; for (let i = 0; i < 18; i++) { s.push({ t, deg: -45 - i * 45, tel: i === 0 ? 20 : 12 }); t += Math.round(Math.max(6, 16 - i * 0.6)); } this._spiral = s; }
    for (const e of this._spiral) if (f === e.t) {
      const va = ((e.deg % 360) + 360) % 360 * Math.PI / 180, D = 150;
      gBladeSlash(a, cx - Math.cos(va) * D, cy + Math.sin(va) * D, va, Math.cos(va) * 42, -Math.sin(va) * 42, 54, 54, e.tel);
    }
  },
};

// #A BOX THROW (AP70, RED free-move) — despite the name it LOBS arcing hammers into the box: 16 fan-throws,
// then 25 fast singles tracking a sine-swept x, then one giant hammer finisher.
PATTERNS.gerson_boxthrow = {
  dur: 420, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f, box, add, rng } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2, gx = box.x + box.w + 70, gy = box.y - 18;
    // GERSON HITS THE BOX first (visible SWING): it TILTS ~45deg left + shifts left ONCE, then STAYS put. Anchor
    // captured at the hit frame so the target is FIXED (using the live box.x caused it to chase itself left forever).
    if (f <= 1) { this._ax = null; this._settled = 0; Battle._giantLand = 0; }   // reset (object reused by atk8 & atk14)
    if (f >= 6 && f < 20) a.fx.bossSprite = { key: 'gswing', n: 7, rate: 2, ttl: 3 };   // Gerson visibly HITS the box
    if (f === 12) { this._ax = box.x; this._ay = box.y; Battle.shake = 14; Battle.flash = 5; Snd.play('bosshit', 0.6); }
    if (Battle._giantLand) this._settled = 1;                        // giant landed -> box knocked DOWN
    if (this._ax != null) {
      const tilt = Math.min(1, (f - 12) / 12);
      a.fx.boxRot = -0.785 * tilt;                                   // -45deg (to the LEFT)
      a.fx.boxTarget = { x: this._ax - 40, y: (this._settled ? this._ay + 34 : this._ay), w: box.w, h: box.h, boxLerp: this._settled ? 0.5 : 0.25 };
    }
    if (f >= 34 && f < 320) a.fx.bossSprite = { key: 'gswing', n: 7, rate: 4, ttl: 4 };   // Gerson visibly THROWS
    if (f >= 40 && f < 200 && (f - 40) % 10 === 0) {                 // 16 fan-throws of 3-4 hammers
      const n = 3 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) { const off = rng() * 60 - 30;
        const vx = -Math.abs(gx - (cx + off)) / 45 + (-2 + (4 / (n - 1)) * i) + (rng() - 0.5), vy = -14 + (-1 + (2 / (n - 1)) * i) + (rng() * 2 - 1);
        add({ ...bulletProps('ghammer40'), x: gx, y: gy, vx, vy, ay: 0.6, maxv: 11, r: 8, grazeR: 13, scale: GSC(14, 30), spin: 0.24, dmg: 28, life: 130 }); }
      Snd.play('smallswing', 0.3);
    }
    const p1 = f - 200;                                              // 25 bigger fast singles at a sine-swept x
    if (p1 >= 0 && p1 < 100 && p1 % 4 === 0) {
      const tx = cx + Math.sin(f * 0.325) * 80;
      add({ ...bulletProps('ghammer40'), x: gx, y: gy, vx: -Math.abs((gx - tx) / 45), vy: -14, ay: 0.6, maxv: 11, r: 11, grazeR: 15, scale: GSC(14, 44), spin: 0.24, dmg: 28, life: 130 });
    }
    // FINAL: the GIANT hammer rises, then DROPS straight INTO the box; on landing it KNOCKS the box down + shakes.
    if (f === 306) {
      const tx = cx - 20, giant = { ...bulletProps('ggiant'), x: gx, y: gy, vx: -Math.abs((gx - tx) / 20), vy: -18, ay: 0.75,
        maxv: 24, spin: 0.08, scale: GSC(92, 150), r: 22, grazeR: 26, dmg: 44, life: 200, _giant: 1, _land: 0, _sit: 0 };
      giant.emit = function (b, out, s, bx) {
        if (!b._land && b.vy > 2 && b.y > bx.y + bx.h * 0.62) {      // falling + reached the lower box -> LAND
          b._land = 1; b.vy = 0; b.vx = 0; b.ay = 0; b.y = bx.y + bx.h * 0.7; b._sit = 22;
          Battle.shake = 22; Battle.flash = 8; Snd.play('bosshit', 0.7); Battle._giantLand = 1;   // knock the box DOWN
        }
        if (b._land && --b._sit <= 0) b.dead = true;
      };
      add(giant); Snd.play('smallswing', 0.5);
    }
  },
};
// #B SQUISH-BOX SLASHES (obj_gerson_squishes_box, RED, wiki Attack 13) — Gerson SQUISHES the board THIN + WIDE
// (GML xscale 9 / yscale 0.2), then a wall of SWING-DOWN blades marches L->R (stopping before the edge), then
// R->L, then a big spread keeping only a small safe strip. Ride AHEAD of the advancing slashes.
PATTERNS.gerson_squish = {
  dur: 490, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f, box } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f === 26) { Battle.shake = 16; Snd.play('bosshit', 0.6); }               // the squish slam
    if (f > 24) a.fx.boxTarget = { x: cx - 232, y: cy - 22, w: 464, h: 44 };      // THIN + WIDE
    const L = cx - 210, R = cx + 210, span = R - L, N = 9, W = 58;
    const slash = colX => gBladeSlash(a, colX, cy - 96, 0, 0, 46, W, box.h + 130, 9);
    // PHASE 1: sweep LEFT -> RIGHT, stopping ~92% across (safe strip at the far right)
    for (let i = 0; i < N; i++) if (f === 56 + i * 16) slash(L + span * 0.92 * (i / (N - 1)));
    // PHASE 2: sweep RIGHT -> LEFT
    for (let i = 0; i < N; i++) if (f === 240 + i * 16) slash(R - span * 0.92 * (i / (N - 1)));
    // PHASE 3: a broad spread leaving ONE small safe gap (near the right — the "likely unintended" safe spot)
    const FRAC = [0.0, 0.13, 0.26, 0.39, 0.52, 0.65, 1.0];                        // gap around 0.82
    FRAC.forEach((fr, i) => { if (f === 424 + i * 8) slash(L + span * fr); });
  },
};
// #C RUDE BUSTER (RED, obj_gerson_rudebuster) — Gerson hurls an ACCELERATING homing orb (GML speed 9,
// friction -1.5, homing turn = angle_diff/4). Press [Z] when it's CLOSE to knock it back for TP; if it
// reaches you undeflected it BURSTS into 8 radial bolts (GML: 8 shots @45+90i, speed 25). A deflect duel.
PATTERNS.gerson_rudebuster = {
  dur: 300, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f, box, add, soul } = a; const gx = box.x + box.w + 40, gy = box.y - 10;
    if (f % 96 !== 12 || f >= 264) return;
    const ang = Math.atan2(soul.y - gy, soul.x - gx);
    const orb = { color: '#ff3b6b', x: gx, y: gy, vx: Math.cos(ang) * 2.4, vy: Math.sin(ang) * 2.4,
                  r: 12, grazeR: 0, homing: 0.55, maxv: 9, deflectable: 1, deflectR: 38, spin: 0.14, dmg: 50, life: 260, _bo: 0 };
    orb.emit = function (b, out, s) {                                            // burst if it reaches the soul undeflected
      if (b._bo || Math.hypot(b.x - s.x, b.y - s.y) > 40) return;
      b._bo = 1; b.dead = true; Battle.shake = 14; Battle.flash = 6; Snd.play('boardbomb', 0.5);
      for (let i = 0; i < 8; i++) { const aa = (45 + i * 90) * Math.PI / 180;
        out.push({ color: '#ff5c7d', x: b.x, y: b.y, vx: Math.cos(aa) * 6.5, vy: Math.sin(aa) * 6.5, r: 7, grazeR: 12, spin: 0.12, dmg: 50, life: 64 }); }
    };
    add(orb);
    Snd.play('smallswing', 0.4);
  },
};
// Red-attack aliases for the 21-attack set (defined here so their target patterns already exist).
PATTERNS.gn_atk8 = PATTERNS.gerson_boxthrow;    // hammer throw + giant finisher
PATTERNS.gn_atk13 = PATTERNS.gerson_squish;     // squish star barrage
PATTERNS.gn_atk14 = PATTERNS.gerson_boxthrow;   // a repeat of attack 8

// ============================================================================
// PINK — Ch5 idol boss (mew magical-girl). Rebuilt from real GML (30fps -> hz30). Real ripped
// Ch5 sprites. NOTE: the real fight uses the PURPLE string-soul (grid/web movement) + DOKI/DATE
// machinery; this v1 uses RED free-move as an approximation (purple-soul mode = follow-up).
// ============================================================================
const PS = g => g / 1.6;   // GML image_xscale -> our scale
// TYPE 200 — CATS: cat bullets stream in from the sides in 3 rows (56px apart).
// TYPE 206 — PIÑATA BOMBS: fusebombs land on a 4x4 grid, then detonate into a row+column cross of beams.
// TYPE 204 — BELL/CAT LANES: three vertical cat streams at cx-28/cx/cx+28, different rates.
// TYPE 202 — ROTATING BOX: lane bullets fire inward from a rotating cardinal, with perpendicular offshoots.
// TYPE 209 — SINGING (ult, idol concert): cats from the sides + bells raining + a doki flourish finale.

// ---------- PINK — NEW (GML-faithful, PURPLE GRID SOUL). Tester/showcase only. ----------
// TYPE 200 — Cats (purple mode 1: 3 lanes + free X). This is the REAL attack: the exact ds_bullet_list
// choreography charts, imported verbatim from obj_dbulletcontroller (difficulty 0 = "Cats", 1 = the
// harder/ULT variant). Each tuple = [lane, side, interval, speed]; played front-to-back with the game's
// timing rule (15-frame lead, then round(0.5 + 13*interval/1.25) frames to the next). lane<3 = a cat
// (obj_pinkcatbullet) on row floor(lane-1)*56, plus frac(lane)*10 trailing DOKI-HEART collectables;
// lane 6-8 = a doki-heart row (collectable, grants TP); lane 3/4/5 = Pink dance triggers (cosmetic).
const PINK_CATS_D0 = [0, 1, 1.1, 0.75, 2, 1, 1.1, 0.75, 1, 1, 1.1, 0.75, 0, 1, 1.1, 0.75, 2, 1, 3.75, 0.75, 7, -1, 0.825, 0.675, 6, -1, 0.825, 0.675, 7, -1, 0.825, 0.675, 8, -1, 0.825, 0.675, 7, -1, 0.825, 0.675, 8, -1, 0.825, 0.675, 7, -1, 4.5, 0.675, 2.1, 1, 1, 0.9, 1.1, 1, 1, 0.9, 0.1, 1, 1, 0.9, 1.1, 1, 1, 0.9, 2.1, 1, 1, 0.9, 0.1, 1, 1, 0.9, 1.1, 1, 1, 0.9, 2.1, 1, 1, 0.9, 1.1, 1, 4, 0.9, 7, -1, 0, 1.3333, 0, -1, 0, 1.3333, 2, -1, 0.95, 1.3333, 8, -1, 0, 1.3333, 1, -1, 0, 1.3333, 0, -1, 0.95, 1.3333, 7, -1, 0, 1.3333, 2, -1, 0, 1.3333, 0, -1, 0.95, 1.3333, 6, -1, 0, 1.3333, 1, -1, 0, 1.3333, 2, -1, 0.95, 1.3333, 7, -1, 0, 1.3333, 0, -1, 0, 1.3333, 2, -1, 0.95, 1.3333, 6, -1, 0, 1.3333, 2, -1, 0, 1.3333, 1, -1, 0.95, 1.3333, 7, -1, 0, 1.3333, 0, -1, 0, 1.3333, 2, -1, 0.95, 1.3333, 8, -1, 0, 1.3333, 1, -1, 0, 1.3333, 0, -1, 0.95, 1.3333, 7, -1, 0, 1.3333, 2, -1, 0, 1.3333, 0, -1, 0.95, 1.3333, 8, -1, 0, 1.3333, 0, -1, 0, 1.3333, 1, -1, 0.95, 1.3333, 7, -1, 0, 1.3333, 0, -1, 0, 1.3333, 2, -1, 0.95, 1.3333, 6, -1, 0, 1.3333, 2, -1, 0, 1.3333, 1, -1, 0.01, 1.3333];
const PINK_CATS_D1 = [7, 1, 0, 0.9, 0, 1, 0, 0.9, 2, 1, 0.95, 0.9, 8, -1, 0, 0.9, 0, -1, 0, 0.9, 1, -1, 0.95, 0.9, 7, 1, 0, 0.9, 0, 1, 0, 0.9, 2, 1, 0.95, 0.9, 6, -1, 0, 0.9, 1, -1, 0, 0.9, 2, -1, 0.95, 0.9, 7, 1, 0, 0.9, 0, 1, 0, 0.9, 2, 1, 0.95, 0.9, 8, -1, 0, 0.9, 0, -1, 0, 0.9, 1, -1, 0.95, 0.9, 7, 1, 0, 0.9, 0, 1, 0, 0.9, 2, 1, 0.95, 0.9, 6, -1, 0, 0.9, 1, -1, 0, 0.9, 2, -1, 3, 0.9, 2, 1, 0, 0.9, 0.1, -1, 0.5, 0.9, 2, 1, 0, 0.9, 0, -1, 1, 0.9, 0, 1, 0, 0.9, 1.1, -1, 0.5, 0.9, 0, 1, 0, 0.9, 1, -1, 1, 0.9, 2.1, 1, 0, 0.9, 0, -1, 0.5, 0.9, 2, 1, 0, 0.9, 0, -1, 1, 0.9, 1.1, 1, 0, 0.9, 2, -1, 0.5, 0.9, 1, 1, 0, 0.9, 2, -1, 1, 0.9, 0.1, 1, 0, 0.9, 0, -1, 0.5, 0.9, 0, 1, 0, 0.9, 0, -1, 1, 0.9, 2, 1, 0, 0.9, 1.1, -1, 0.5, 0.9, 2, 1, 0, 0.9, 1, -1, 1, 0.9, 1, 1, 0, 0.9, 2.1, -1, 0.5, 0.9, 1, 1, 0, 0.9, 2, -1, 1, 0.9, 2, 1, 0, 0.9, 0.1, -1, 0.5, 0.9, 2, 1, 0, 0.9, 0, -1, 1, 0.9, 1, 1, 0, 0.9, 1.1, -1, 0.5, 0.9, 1, 1, 0, 0.9, 1, -1, 3, 0.9, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 3, 1, 0, 1, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 0.05, 1.5, 0, 1, 0.05, 1.5, 2, -1, 5, 1.5];
// Build the frame-accurate firing schedule from a chart (the GML's btimer/interval playback rule).
function pinkCatsSchedule(chart) {
  const sched = []; let t = 15;
  for (let k = 0; k < chart.length; k += 4) {
    sched.push({ f: Math.round(t), lane: chart[k], side: chart[k + 1], speed: chart[k + 3] });
    // GML round(0.5) = 0 (banker's): interval-0 tuples fire the SAME frame (tight formations)
    t += chart[k + 2] === 0 ? 0 : Math.max(1, Math.round(0.5 + (13 * chart[k + 2]) / 1.25));   // _bullet_interval_modifier = 1.25
  }
  sched.total = Math.round(t);
  return sched;
}
function pinkFireCat(add, cx, cy, e) {
  const spd = 8 * e.speed * (4 / 3);         // _bullet_speed_modifier = 4/3
  const vx = -e.side * spd;                   // side 1 spawns right (+416) moving left; -1 spawns left moving right
  if (e.lane < 3) {
    const y = cy + Math.floor(e.lane - 1) * 56;
    add({ ...catP(), x: cx + e.side * 416, y, vx, vy: 0, r: 9, grazeR: 14, scale: PS(2), dmg: 24, life: 420 });
    const nd = Math.round((e.lane % 1) * 10);   // frac(lane)*10 trailing doki-heart collectables
    for (let i = 1; i <= nd; i++)
      add({ ...bulletProps('pdoki'), x: cx + e.side * (416 - i * 72 * e.speed), y, vx, vy: 0, pickup: true, tp: 2, doki: 2, r: 8, scale: PS(1.5), life: 460 });
  } else if (e.lane >= 6 && e.lane <= 8) {
    add({ ...bulletProps('pdoki'), x: cx + e.side * 416, y: cy + (e.lane - 7) * 56, vx, vy: 0, pickup: true, tp: 2, doki: 2, r: 8, scale: PS(1.5), life: 460 });
  }
  // lane 3/4/5 = Pink dance-move triggers (obj_pink_battlemovement), cosmetic — no bullet
}
function pinkCatsPattern(chart) {
  return {
    box: { w: 150, h: 150 }, hz30: 1, dur: pinkCatsSchedule(chart).total + 90,   // growtangle 75x75 hitbox at scale 2 = 150x150
    tick(a) {
      const { f, box, add } = a; a.fx.purpleSoul = { mode: 1, diff: 0 };
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      if (f === 0) { this._sched = pinkCatsSchedule(chart); this._si = 0; }
      const s = this._sched;
      while (this._si < s.length && s[this._si].f <= f) pinkFireCat(add, cx, cy, s[this._si++]);
    },
  };
}

// ============ DATE minigame (obj_date_controller): 1:1 movement/selection model ============
// The PURPLE SOUL sits at the bottom of the screen ON A LINE; the answer options are a horizontal strip
// that LOOPS. LEFT scrolls the strip left (draw_box_selected++), RIGHT scrolls it right (draw_box_selected--)
// — that exact direction, per obj_date_controller Step con==2. You SELECT by pressing UP: the heart rises
// (draw_box_con=2, y 390->319) into the centred option (choiceselected = draw_box_selected). NO Z. Single-
// option questions disable L/R (press UP only). A correct choice (choiceiscorrect==1) advances; a wrong one
// or the timer running out (datetimeleft, only while idle) plays the awkward reaction and REPEATS the same
// question — no HP damage in date 1 (the real dodging is date 3/4's type-210 attack). All correct -> won.
// Content is the real script (obj_date_controller Create/Other_11). "|" = an explicit line break.
function lerp2(a, b, t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return a + (b - a) * t; }
function wrongReactSfx() {   // a wrong/timeout answer: Pink lashes out — the party takes damage (registers in the tester)
  if (typeof Snd !== 'undefined') Snd.play('pinkgasp', 0.5);
  if (typeof Battle !== 'undefined') {
    const B = Battle; B.shake = Math.max(B.shake || 0, 12); B.flash = Math.max(B.flash || 0, 8);
    const dmg = 30; B.dmgTaken = (B.dmgTaken || 0) + dmg;
    for (const m of (B.myTeam || [])) if (m && m.hp > 0) m.hp = Math.max(0, m.hp - dmg);
    if (typeof Snd !== 'undefined') Snd.play('hurt', 0.4);
  }
}

// ===== PINK V3 DATE (obj_date_controller) — per-beat portrait swaps, ghost split, real UI =====
// Text is PARAPHRASED (the real script is copyrighted). Each beat carries the exact `pinkportrait`
// emotion from spec §3.3/§6 so the FACE changes per line (the prior port used one idle face).
// spk/ghost = imported portrait keys; frames are the 2-frame lipsync. Ghost draws at 0.7 alpha
// and the two face each other (spec §3.1). date2 SPLITS the body+ghost apart mid-cutscene.
const PINK_N3_DATE1 = {
  date: 1,
  cut: [
    { spk: 'spkshock', text: "S-school…?|What are you even|talking about?!", sfx: 'pinkgasp' },
    { spk: 'spkhappy', sweat: 1, text: "I don't… I don't|do the school thing.|Not anymore." },
    { spk: 'spksad', text: "And NOW you wanna|walk me home?!", sfx: 'pinkmew' },
  ],
  qs: [
    { spk: 'spksad', text: "…Well? Are you|gonna answer me?", opts: ["…Sure"], correct: [0], single: true },
    { spk: 'spkhappy', sweat: 1, text: "You only like this|body 'cause it's CUTE,|huh?!", opts: ["Nope", "Yeah", "Yeah"], correct: [1, 2], timed: true },
    { spk: 'spksad', text: "Bet you wish you'd|never even met me…", opts: ["True", "For sure", "Obviously", "Not at all", "Obviously", "For sure"], correct: [3], timed: true },
  ],
  outro: { spk: 'spkangb', text: "Ghh— that's ENOUGH!|We're DONE here!" },
};
const PINK_N3_DATE2 = {
  date: 2,
  cut: [
    { spk: 'spkhappy', text: "Let's go on a date,|mew!" },
    { spk: 'spkangb', text: "I am NOT|doing this!!" },
    { spk: 'spknya', text: "C'mon, let's|date already!!" },
    { spk: 'spkangb', text: "I! Said! NO!!" },
    { spk: 'spkconc', ghost: 'ghconc', split: 1, text: "Wh— we came|APART?!", sfx: 'ghostappear' },
    { spk: 'spkshock', ghost: 'ghshock', text: "H-hey! There's|TWO of us now!" },
    { spk: 'spkjoy', ghost: 'ghconc', text: "Now we can BOTH|date you!" },
    { spk: 'spknya', ghost: 'ghconc', text: "So… say something|sweet to us?" },
    { spk: 'spkconc', ghost: 'ghangry', who: 'ghost', text: "No way—|say something MEAN!!" },
  ],
  qs: [   // ghost (nasty side) blurts the "mean" hint that is ALSO the correct pun answer
    { spk: 'spkwink', ghost: 'ghangry', text: "Where should we|take our date?", ghostHint: "Tell us to get LOST!", opts: ["A mountain hike", "Get lost!", "Stargazing"], correct: [0], timed: true },
    { spk: 'spkwink', ghost: 'ghangry', text: "Did our letter|move you at all?", ghostHint: "Rip it to SHREDS!", opts: ["Tore me up", "Ripped me apart", "Made me cry"], correct: [0], timed: true },
    { spk: 'spkwink', ghost: 'ghangry', text: "Got a little|gift for me?", ghostHint: "Call us ROTTEN!", opts: ["A rotten fish", "You're rotten", "A diamond"], correct: [0], timed: true },
  ],
  outro: { spk: 'spkhappy', ghost: 'ghconc', text: "…Heh.|Not bad, mew." },
};
function pinkDateN3Pattern(D) {
  return {
    box: { w: 300, h: 190 }, hz30: false, dur: 100000,
    tick(a) {
      const { f } = a; const S = this;
      const IN = (typeof Input !== 'undefined') ? Input : { hit: {} };
      const HIT = k => IN.hit && IN.hit[k];
      if (f === 0) { S.ph = 'cut'; S.ci = 0; S.qi = 0; S.sel = 0; S.boxCon = 0; S.boxOff = 0; S.bt = 0;
        S.heartY = 400; S.chars = 0; S.talk = 0; S.bg = 0; S.bgy = 0; S.flash = 0; S.timer = 240;
        S.reactT = 0; S.done = false; S.correct = 0; S.ghostOn = false; S._shown = null; }
      S.bg = (S.bg + 0.7) % 80; S.bgy = (S.bgy + 0.4) % 80; S.talk += 0.167;
      if (S.flash > 0) S.flash--;
      const beat = () => (S.ph === 'cut' ? D.cut[S.ci] : S.ph === 'outro' ? D.outro : D.qs[S.qi]);
      const setText = str => { const p = (str || '').split('|'); S._t = p; S.chars = 0; };
      const cur = beat() || {};
      const rng = (a.rng || Math.random);
      if (S._shown !== S.ph + ':' + (S.ph === 'cut' ? S.ci : S.qi)) { setText(cur.text); S._shown = S.ph + ':' + (S.ph === 'cut' ? S.ci : S.qi);
        if (cur.split) S.ghostOn = true; if (cur.sfx && typeof Snd !== 'undefined') Snd.play(cur.sfx, 0.5); S.askDwell = 0;
        if (S.ph === 'ask') { const nn = D.qs[S.qi].opts.length;   // SHUFFLE the option order (correct was always first)
          S.perm = Array.from({ length: nn }, (_, i) => i); for (let i = nn - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = S.perm[i]; S.perm[i] = S.perm[j]; S.perm[j] = t; }
          S.sel = Math.floor(rng() * nn); S.heartY = 400; S.timer = 240; }
        else if (S.ph === 'cut') { S.sel = 0; S.heartY = 400; S.timer = 240; } }
      const full = S._t.join('').length;
      S.chars = Math.min(full + 2, S.chars + 2);
      const talkF = (S.chars < full && (Math.floor(S.talk) % 2)) ? 1 : 0;
      const ghostKey = (S.ghostOn || S.ph === 'outro') ? (cur.ghost || 'ghconc') : (cur.ghost || null);
      const Qh = (S.ph === 'ask' || S.ph === 'choose' || S.ph === 'react') && D.qs[S.qi] ? D.qs[S.qi].ghostHint : null;
      const dispOpts = () => (S.perm ? S.perm.map(i => D.qs[S.qi].opts[i]) : (D.qs[S.qi] ? D.qs[S.qi].opts : []));
      const realIdx = () => (S.perm ? S.perm[S.sel] : S.sel);
      const emit = extra => { a.fx.date = Object.assign({
        v3: true, date: D.date, bg: S.bg, bgy: S.bgy, ph: S.ph, flash: S.flash, qi: S.qi, total: D.qs.length,
        spk: cur.spk || 'spktalk', ghost: ghostKey, talkF, who: cur.who || null, gtext: cur.gtext || Qh,
        sweat: !!cur.sweat && (S.timer < 84 || S.ph !== 'choose') ? 0 : (cur.sweat ? 1 : 0),
        rawLines: S._t.slice(), chars: Math.floor(S.chars), fullChars: full,
        hearts: S.correct, heartY: S.heartY,
      }, extra || {}); };
      const typed = () => Math.floor(S.chars) >= full;

      if (S.done) { emit({ done: true }); return; }

      if (S.ph === 'cut') {
        if ((HIT('ok') || HIT('up')) && S.chars > 4) { if (!typed()) S.chars = full + 2; else { S.ci++; if (S.ci >= D.cut.length) { S.ph = 'ask'; S._shown = null; } } }
        emit({}); return;
      }
      const Q = D.qs[S.qi], n = Q.opts.length;
      if (S.ph === 'ask') { emit({ opts: dispOpts(), sel: S.sel, boxOff: 0, single: !!Q.single, timer: null });
        if (typed()) { S.askDwell = (S.askDwell || 0) + 1; if (S.askDwell > 6) { S.ph = 'choose'; S.bt = 0; S.askDwell = 0; } } return; }
      if (S.ph === 'choose') {
        if (Q.timed && S.boxCon === 0) S.timer -= 0.5;
        if (S.boxCon === 0) {
          if (!Q.single && HIT('right')) { S.boxCon = -1; S.bt = 0; Snd.play('menumove', 0.5); }
          else if (!Q.single && HIT('left')) { S.boxCon = 1; S.bt = 0; Snd.play('menumove', 0.5); }
          else if (HIT('up')) { S.boxCon = 2; S.bt = 0; }
        } else if (S.boxCon === -1) { S.bt++; S.boxOff = lerp2(0, -200, S.bt / 5); if (S.bt >= 5) { S.boxCon = 0; S.boxOff = 0; S.sel = (S.sel + 1) % n; } }
        else if (S.boxCon === 1) { S.bt++; S.boxOff = lerp2(0, 200, S.bt / 5); if (S.bt >= 5) { S.boxCon = 0; S.boxOff = 0; S.sel = (S.sel - 1 + n) % n; } }
        else if (S.boxCon === 2) { S.bt++; S.heartY = lerp2(400, 344, S.bt / 3);
          if (S.bt >= 3) { S.boxCon = 0; S.heartY = 400;
            if (Q.correct.indexOf(realIdx()) >= 0) { S.ph = 'react'; S._react = 1; S.reactT = 0; Snd.play('pinkcoin', 0.6); }
            else { S.ph = 'react'; S._react = -1; S.reactT = 0; S.flash = 24; pinkDateWrong(D.wrongDmg); } } }
        if (Q.timed && S.timer <= 0) { S.ph = 'react'; S._react = -1; S.reactT = 0; S.flash = 24; pinkDateWrong(D.wrongDmg); }
        emit({ opts: dispOpts(), sel: S.sel, boxOff: S.boxOff, single: !!Q.single, timer: Q.timed ? Math.max(0, S.timer / 240) : null });
        return;
      }
      if (S.ph === 'react') { S.reactT++;
        const spk = S._react > 0 ? (['spknya', 'spknya2', 'spktongue'][S.qi % 3]) : 'spkangry';
        emit({ opts: dispOpts(), sel: S.sel, boxOff: 0, single: !!Q.single, correct: S._react > 0, spk, timer: Q.timed ? Math.max(0, S.timer / 240) : null });
        if (S.reactT >= 30) {
          if (S._react > 0) { S.correct++; if (S.qi + 1 >= D.qs.length) { S.ph = 'outro'; S.reactT = 0; S._shown = null; Snd.play('boost', 0.5); } else { S.qi++; S.ph = 'ask'; S._shown = null; } }
          else { S.ph = 'ask'; S._shown = null; }
        }
        return;
      }
      if (S.ph === 'outro') { S.reactT++; emit({}); if (typed() && S.reactT > full + 40) S.done = true; return; }
    },
  };
}
function pinkDateWrong(dmg) {   // wrong/timeout: Pink lashes out — party takes damage (1 in the gentle confession)
  if (typeof Snd !== 'undefined') Snd.play('pinkgasp', 0.5);
  if (typeof Battle !== 'undefined') { const B = Battle; const d = dmg != null ? dmg : 30; B.shake = Math.max(B.shake || 0, 12); B.flash = Math.max(B.flash || 0, 8);
    B.dmgTaken = (B.dmgTaken || 0) + d; for (const m of (B.myTeam || [])) if (m && m.hp > 0) m.hp = Math.max(0, m.hp - d); Snd.play('hurt', 0.4); }
}
// DATE 4 — the CONFESSION finale (obj_date_controller datecount 4). Paraphrased (the real script is
// copyrighted): Pink's ghost admits the fight was about fear + self-loathing, and the party answers with
// compassion. 3 questions, a WRONG answer costs only 1 HP (per the wiki). Ends the fight.
const PINK_N3_DATE4 = {
  date: 4, wrongDmg: 1,
  cut: [
    { spk: 'spkconc', ghost: 'ghconc', who: 'ghost', text: "…Fine. I'll admit it.|My heart really WAS racing." },
    { spk: 'spkconc', ghost: 'ghangry', who: 'ghost', text: "But only because…|when they flirted with you,|it scared me." },
    { spk: 'spksad', ghost: 'ghconc', who: 'ghost', text: "After finally finding myself…|I felt like I was|losing myself again." },
    { spk: 'spkangb', ghost: 'ghangry', who: 'ghost', text: "I didn't want you being|anyone else's.|I wanted you to be ME." },
    { spk: 'spksad', ghost: 'ghshock', who: 'ghost', text: "Because… I can't|stand who I am." },
    { spk: 'spkconc', ghost: 'ghconc', who: 'ghost', text: "But puppeting you around…|that only hurts you,|doesn't it?" },
    { spk: 'spkhappy', ghost: 'ghconc', who: 'ghost', text: "If we're to be together…|then I have to…" },
  ],
  qs: [
    { spk: 'spkconc', ghost: 'ghconc', who: 'ghost', text: "…So why WAS|my heart racing?", opts: ["You liked it", "You loved it", "You got scared"], correct: [2] },
    { spk: 'spksad', ghost: 'ghconc', who: 'ghost', text: "I don't want to|lose you to…?", opts: ["Anyone else", "Only me", "Someone new"], correct: [0] },
    { spk: 'spkhappy', ghost: 'ghconc', who: 'ghost', text: "So… what do|we do now?", opts: ["Love us both", "Ignore your needs", "Push us away"], correct: [0] },
  ],
  outro: { spk: 'spkhappy', ghost: 'ghconc', text: "…Heh.|Together, then —|for real this time, mew." },
};
PATTERNS.pink_date1 = pinkDateN3Pattern(PINK_N3_DATE1);
PATTERNS.pink_date2 = pinkDateN3Pattern(PINK_N3_DATE2);
PATTERNS.pink_date4 = pinkDateN3Pattern(PINK_N3_DATE4);   // the confession that ends the fight

// TYPE 204 — Vertical cat rain (purple mode 4: 2 vertical lanes, tall box, free Y). Cats fall/rise in 3
// columns (x -28/0/+28) in bursts: each stream fires b_number cats b_interval apart, then rests b_break
// frames. Ported 1:1 from the btimer_array burst/break logic. Swap lanes L/R, weave vertically.
// ============ TYPE 202 — PLUS-GRID / ROTATING BOX: 1:1 port ============
// purple mode 3 (5-cell "+" cross). obj_dbulletcontroller(202) plays a ds_bullet_list of [shot, dir,
// interval, speed]. dir = 0/90/180/270 (GML: right/up/left/down) = which of the 4 arms the bullet streams
// DOWN. Bullets are obj_pinklanebullet, spawned 352px out (opposite dir) at speed*8, in one of 3 lanes per
// arm (perp offset 52): shot 0=+270 half-circle, 1=centre CIRCLE, 2=+90 half-circle; 3/4/5 = PAIRS (a gap):
// 3=[+270 half, centre circle], 4=[+270 half, +90 half], 5=[centre circle, +90 half]; 6/7/8 = doki HEARTS
// (offset 66). Fire gap = floor(0.5 + 32*interval) frames (interval-0 = same frame). Sprites: circle =
// spr_pinklanebullet_animation (plane), half-circle = spr_pinklanebullet_lane (planeb). D0 = P2 T1 static,
// D2 = P2 T5 static+fast (both can_spin=false). D1 (P3) adds the giant-ghost 90° box knocks (see rotbox).
const PINK_PLUS_D0 = [2, 270, 0.4987, 1.32, 1, 270, 0.4987, 1.32, 0, 270, 0.76, 1.32, 1, 180, 0.4275, 1.5812, 7, 180, 0, 1.5812, 4, 180, 0.855, 1.5812, 6, 90, 0, 1.54, 2, 90, 0.4275, 1.54, 1, 90, 0.4275, 1.54, 8, 90, 0, 1.54, 0, 90, 0.76, 1.54, 1, 0, 0.1425, 1.771, 7, 0, 0.2375, 1.771, 4, 0, 0.475, 1.771, 1, 90, 0.855, 1.43, 6, 180, 0, 0.7333, 1, 180, 0.855, 0.7333, 6, 270, 0, 0.7333, 1, 270, 0.855, 0.7333, 6, 0, 0, 0.7333, 1, 0, 1.615, 0.7333, 4, 0, 0.1425, 1.8975, 4, 0, 0.1425, 1.9879, 4, 0, 0.1425, 2.0782, 4, 0, 0.0475, 2.1686, 0, 90, 0, 2.75, 0, 270, 0, 2.75, 4, 0, 0.0475, 2.2589, 0, 90, 0, 2.75, 0, 270, 0, 2.75, 4, 0, 0.0475, 2.3493, 0, 90, 0, 2.75, 0, 270, 0, 2.75, 4, 0, 0.0475, 2.4396, 0, 90, 0, 2.75, 0, 270, 0, 2.75, 4, 0, 0.0475, 2.53, 0, 90, 0, 2.75, 0, 270, 99, 2.75];
const PINK_PLUS_D2 = [0, 270, 0.475, 1.54, 1, 270, 0.2375, 1.54, 2, 0, 0, 1.848, 8, 270, 0.2375, 1.54, 2, 270, 0.2375, 1.54, 1, 0, 0.2375, 1.848, 7, 0, 0, 1.848, 0, 90, 0.2375, 1.54, 0, 0, 0.2375, 1.848, 1, 90, 0.2375, 1.54, 7, 90, 0, 1.54, 2, 180, 0.2375, 1.848, 2, 90, 0.2375, 1.54, 1, 180, 0.2375, 1.848, 6, 180, 0.2375, 1.848, 0, 180, 0.475, 1.848, 1, 0, 0, 2.178, 1, 180, 0.114, 2.178, 1, 0, 0, 2.178, 1, 180, 0.114, 2.178, 1, 0, 0, 2.178, 1, 180, 0.475, 2.178, 6, 90, 0, 1.815, 1, 90, 0, 1.815, 1, 270, 0.114, 1.815, 1, 90, 0, 1.815, 1, 270, 0.114, 1.815, 1, 90, 0, 1.815, 1, 270, 99, 1.815];
const gmlVec = deg => { const r = deg * Math.PI / 180; return [Math.cos(r), -Math.sin(r)]; };   // GML angle -> screen unit vec
function pinkLaneFire(add, cx, cy, e, rotDeg) {
  const d = e.dir + (rotDeg || 0), spd = e.spd * 8, dist = 352, off = 52;
  const [tx, ty] = gmlVec(d), [sx, sy] = [cx - tx * dist, cy - ty * dist];   // spawn far out, opposite travel
  const [p2x, p2y] = gmlVec(d + 270), [p9x, p9y] = gmlVec(d + 90), rot = Math.atan2(ty, tx);
  // half-circles curve toward the lane centre so a PAIR reads as a CUT CIRCLE: the +270-offset half is drawn
  // at image_angle = dir+180 (flip), the +90-offset half at image_angle = dir (obj_dbulletcontroller L2299-2342).
  // obj_pinklanebullet: spr_pinklanebullet_animation (3-frame anim, image_speed 1), scale 2, image_angle = travel dir
  const mk = (ox, oy, sp, flip) => add({ ...bulletProps('planebullet'), animKeys: ['planebullet0', 'planebullet1', 'planebullet2'], animRate: 2,
    x: sx + ox, y: sy + oy, vx: tx * spd, vy: ty * spd, r: 8, grazeR: 12, scale: PS(2), rot: rot + (flip ? Math.PI : 0), dmg: 24, life: 130 });
  if (e.shot < 6) {
    if (e.shot === 0 || e.shot === 3 || e.shot === 4) mk(p2x * off, p2y * off, 'planeb', true);   // +270 half, flipped
    else if (e.shot === 2) mk(p9x * off, p9y * off, 'planeb', false);                             // +90 half
    else mk(0, 0, 'plane', false);
    if (e.shot >= 3) { if (e.shot === 4 || e.shot === 5) mk(p9x * off, p9y * off, 'planeb', false); else mk(0, 0, 'plane', false); }   // pair's 2nd bullet
  } else {
    const o2 = 66; let ox = 0, oy = 0;
    if (e.shot === 6 || e.shot === 9 || e.shot === 10) { ox = p2x * o2; oy = p2y * o2; } else if (e.shot === 8) { ox = p9x * o2; oy = p9y * o2; }
    add({ ...bulletProps('pdoki'), x: sx + ox, y: sy + oy, vx: tx * spd, vy: ty * spd, pickup: true, tp: 2, doki: 2, r: 9, scale: PS(1.5), life: 140 });
  }
}
function pinkPlusSchedule(chart) {
  const s = []; let t = 8;   // btimer starts 32, fires at >=40 -> 8-frame lead
  for (let k = 0; k < chart.length; k += 4) {
    s.push({ f: t, shot: chart[k], dir: chart[k + 1], spd: chart[k + 3] });
    if (chart[k + 2] >= 90) { t += 30; break; }   // interval 99 = the LIST TERMINATOR (attack ends), NOT a huge delay
    t += Math.max(0, Math.floor(0.5 + 32 * chart[k + 2]));
  }
  s.total = t; return s;
}
function pinkPlusGridPattern(chart, spin) {
  return {
    box: { w: 150, h: 150 }, hz30: 1, dur: pinkPlusSchedule(chart).total + 120,   // base 150x150 box
    tick(a) {
      const { f, box, add } = a;
      if (f === 0) { this._S = pinkPlusSchedule(chart); this._si = 0; this._rot = 0; this._rtar = 0; this._grp = 0; }
      const s = this._S, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      if (spin) {   // P3: giant ghost knocks the box +90 CW between bullet groups (interval>=1 = a gap)
        const d = this._rtar - this._rot; this._rot += Math.abs(d) < 9 ? d : Math.sign(d) * 9;
      }
      a.fx.purpleSoul = { mode: 3, rot: this._rot };
      while (this._si < s.length && s[this._si].f <= f) {
        const e = s[this._si++];
        pinkLaneFire(add, cx, cy, e, this._rot);
        if (spin && this._si < s.length && (s[this._si].f - e.f) >= 14) this._rtar += 90;   // knock after a group-ending gap
      }
    },
  };
}
// ---- TYPE 202 difficulty 1 (P3): the PROCEDURAL doki-queue generator (obj_dbulletcontroller case 1). Each
// refill emits a small group of [shot, dir, delay, speed] tuples: a shot, then the shot transitions and the
// dir rotates by ±90 (choose 1 or 2 steps) twice, then a DOKI-HEART variant of the shot (6/7/8) is queued;
// certain shot/dir relations flag a doki_queue that changes the tail. Between groups the giant ghost
// (obj_huge_anime_face) knocks the box 90°. Played through the same obj_pinklanebullet geometry as D0.
function pinkPlusD1Group(rng) {
  const ir = n => Math.floor(rng() * (n + 1)), pk = (...xs) => xs[Math.floor(rng() * xs.length)];
  const wrap = d => ((d % 360) + 360) % 360;
  const _delay = 0.3, sv = 0.9, sh = 1, s12 = 1.5, s3 = 1.25, _doki_dist = 1, _nextdelay = 1.2;
  const spd = (d, m) => (d === 90 || d === 270 ? sv : sh) * m;
  let dir = ir(3) * 90, shot = pk(0, 1, 2); const diradd = pk(-90, 90);
  const out = [];
  let sf = spd(dir, s12);
  out.push([shot, dir, _delay, sf]);
  const shot_prev0 = shot, dir_prev0 = dir, spd_prev = sf;                          // 1st shot's saved prev
  shot = shot === 0 ? pk(0, 1) : shot === 1 ? pk(0, 2) : pk(1, 2);                  // transition 1
  dir = wrap(dir + diradd * pk(1, 2)); sf = spd(dir, s12);
  const shot_prev = shot, dir_prev = dir;                                          // 2nd prev (overwrites)
  shot = pk(0, 1);                                                                  // transition 2 (all -> 0/1)
  dir = wrap(dir + diradd * pk(1, 2)); sf = spd(dir, s3);
  let heart = shot <= 2 ? shot + 6 : shot === 3 ? 7 : shot === 4 ? 6 + pk(0, 2) : 7;
  let doki = 0;
  if (shot_prev === 1 && ((heart === 6 && (dir === wrap(dir_prev + 90) || dir === wrap(dir_prev - 270))) ||
      (heart === 8 && (dir === wrap(dir_prev - 90) || dir === wrap(dir_prev + 270))))) doki = 1;
  if ((dir === wrap(dir_prev + 180) || dir === wrap(dir_prev - 180)) &&
      ((shot_prev === 0 && heart === 8) || (shot_prev === 1 && heart === 7) || (shot_prev === 2 && heart === 6))) doki = 1;
  out.push([shot_prev, dir_prev, doki === 0 ? _delay * (1 - _doki_dist) : _delay, spd_prev]);
  if (doki === 0) out.push([heart, dir, _delay * _doki_dist, sf]);
  if (doki !== 1) out.push([shot, dir, _nextdelay, sf]);
  else {
    out.push([shot, dir, _delay * _doki_dist, sf]);
    const h2 = shot <= 2 ? shot + 6 : shot === 3 ? 7 : shot === 4 ? 6 + pk(0, 2) : 7;
    out.push([h2, dir, _nextdelay - (_delay * (1 - _doki_dist)), sf]);
  }
  return out;
}
function pinkRotboxD1Pattern() {
  return {
    box: { w: 150, h: 150 }, hz30: 1, dur: 640,
    tick(a) {
      const { f, box, add, rng } = a; const S = this;
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const restX = cx - box.w / 2 - 130;   // rests FAR left -> a long run-up/wind-up before each ram
      if (f === 0) { S._q = []; S._t = 8; S._rot = 0; S._rtar = 0; S._pendKnock = 0;
        S._ghost = { x: restX, ram: 0, bob: 0, enter: 0, bumps: 0, hsp: 0, flip: false, frame: 0 }; }
      // ROTATION: the box eases toward its target at 6°/frame (obj_purplecontrols rotate_speed = 6)
      const d = S._rtar - S._rot; S._rot += Math.abs(d) < 6 ? d : Math.sign(d) * 6;
      a.fx.purpleSoul = { mode: 3, rot: S._rot };
      a.fx.pinkRoll = { f };   // scrolling parallax backdrop (shows the box "rolling"): spr_pinkroll_background 0/1
      // ---- the GHOST (obj_huge_anime_face): RISES in from below-left (hspeed slide + rise), then bobs and LUNGES
      // right to bump the box — each bump is the 90° knock (the rotation telegraph). A big spr_pinkghost_angry. ----
      const gh = S._ghost;
      gh.enter = Math.min(1, gh.enter + 0.035);            // dramatic rise-in (scale + lift from below)
      gh.bob += 0.22;
      // bumps -> approach speed multiplier (obj_huge_anime_face Step: 0->32, 1->1.5, 2->4, 3->9, >=4->11).
      const sm = gh.bumps <= 0 ? 32 : gh.bumps < 2 ? 1.5 : gh.bumps < 3 ? 4 : gh.bumps < 4 ? 9 : 11;
      const hitX = cx - box.w / 2 - 92;   // stops with the portrait's EDGE just at the box edge (doesn't run inside)
      if (S._pendKnock > 0 && gh.ram === 0 && gh.enter >= 1) { gh.ram = 1; gh.hsp = 0; if (typeof Snd !== 'undefined') Snd.play('heavyswing', 0.4); }   // lunge whoosh
      if (gh.ram === 1) {                                  // accelerate toward the box (GML accel tiers by hspeed)
        gh.hsp += gh.hsp < 2.5 ? 0.6 : gh.hsp < 4 ? 0.35 : 0.12;
        gh.hsp = Math.min(gh.hsp, 2 + sm * 0.55);
        gh.x += gh.hsp;
        if (gh.x >= hitX) {                                // BUMP: rotate box 90°, flip sprite, KNOCK the box back
          gh.x = hitX; gh.ram = 2; gh.bumps++; S._rtar += 90; S._pendKnock--;
          gh.flip = !gh.flip; gh.frame ^= 1;               // image_xscale flip + image_index toggle each bump
          if (typeof Snd !== 'undefined') { Snd.play('bosshit', 0.6); Snd.play('explosionmmx', 0.35); Snd.play('boarddmg', 0.4); }
          if (typeof Battle !== 'undefined') Battle.shake = Math.max(Battle.shake || 0, 14);
          S._knock = 34;                                   // shove the box RIGHT harder (rolled from the impact)
          gh.hsp = Math.max(1, gh.hsp * 0.5);
        }
      } else if (gh.ram === 2) { gh.x -= 6; if (gh.x <= restX) { gh.x = restX; gh.ram = 0; } }   // recoil back left
      else gh.x = restX;
      // BOX KNOCKBACK: the whole box + bullets lurch in the ram direction then spring back to rest
      if (typeof Battle !== 'undefined' && Battle.dodgeBox) {
        const want = S._knock || 0, applied = S._knockApplied || 0, delta = want - applied;
        if (delta) { Battle.dodgeBox.x += delta; for (const b of (Battle.bullets || [])) b.x += delta; }
        S._knockApplied = want; S._knock = want * 0.92;   // decay SLOWLY so it lingers offset-right (room to keep pushing)
      }
      const riseY = (1 - gh.enter) * 150;                  // starts 150px below, rises to rest
      const kind = gh.bumps >= 7 ? 'shock' : gh.bumps >= 6 ? 'yell' : 'angry';   // angry -> yell_full -> shock_full
      a.fx.pinkGhost = { x: gh.x, y: cy - 8 - Math.abs(Math.sin(gh.bob)) * 10 + riseY, frame: gh.frame, kind, ramming: gh.ram === 1, scale: 1.6 + gh.enter * 0.4, flip: gh.flip };
      if (f < 8) return;
      if (S._q.length === 0 && f < S.dur - 120) {   // refill: generate the next group; queue a knock (the ghost delivers it)
        const g = pinkPlusD1Group(rng); let t = S._t;
        for (const e of g) { S._q.push({ f: Math.round(t), shot: e[0], dir: e[1], spd: e[3] }); t += Math.max(0, Math.floor(0.5 + 32 * e[2])); }
        S._t = t; S._pendKnock++;
      }
      while (S._q.length && S._q[0].f <= f) pinkLaneFire(add, cx, cy, S._q.shift(), S._rot);
    },
  };
}
// ============ TYPE 208 — 3-D TUNNEL (purple mode 7): FULL 1:1 port ============
// obj_purplecontrols mode 7, EXACT constants: 8 tunnel_radius[] rings; grow r = r*(1 + r/(32000/speed))
// + 0.0375*speed; recycle at 224; new ring at radius 12 every 188 tunnel-units; tunnel_speed_base =
// min(life/10, 1.5+life/50, 11) with the huge early kick (life<40: += (240/max(1,life*.9))*(40-life)/40)
// that floods the tunnel at the start; zoom-in boost (x4/3 stacking while the heart is near centre);
// STALLS when the heart's ring passes moveLimit = 35*box_scale (1/3 -> 1/6 -> 0) — hop INWARD (UP) to
// keep moving. Box shrinks: scale = 3.75 - min(life*.0025,(life+30)*.002,(life+135)*.0015,(life+390)*.001),
// box = 75*scale. Zap WALLS spawn at centre on the newest ring: pattern_list [atk, angle] chain generator
// (exact _atk switch), walls of `repeats` zaps spaced 10 degrees (ends harmless, mask_empty), variants:
// 0=6@cardinal, 1=15@diagonal, 2=29 near-full ring, 3=6-8 MOVING (spr_pinkzap_arrow, drifts ±2.5/5),
// 4=6x2 opposite. Dokis ride rings on non-attack shifts. tunnel_lane_direction = 270 rotates all spawns.
const pinkTunnelPattern = {
  box: { w: 281, h: 281 }, hz30: 1, dur: 900,
  tick(a) {
    const { f, box, add, rng } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const ir = n => Math.floor(rng() * (n + 1)), pick = (...xs) => xs[Math.floor(rng() * xs.length)];
    const wrap = d => ((d % 360) + 360) % 360;
    if (f === 0) {
      this.S = { rings: [0, 0, 0, 0, 0, 0, 0, 0], timer: 0, life: 0, started: false, shiftN: 0,
                 list: [], phase: -2, laneDir: 270, lastAtk: -1, cx, cy };
    }
    const S = this.S;
    S.started = true;                                                   // AUTO-START: the tunnel runs immediately (no waiting for input)
    const L = S.life;
    const scale = 3.75 - Math.min(L * 0.0025, (L + 30) * 0.002, (L + 135) * 0.0015, (L + 390) * 0.001);
    const moveLimit = 35 * scale;
    const bw = Math.round(75 * scale);
    a.fx.boxTarget = { x: cx - bw / 2, y: cy - bw / 2, w: bw, h: bw };   // the box SHRINKS over the attack
    // the electric WALL is DANGEROUS: once your ring passes the move limit you are pinned against the box
    // edge and it zaps you — you MUST hop inward (UP) to escape (obj_pink3durgenter). Flag it for the engine.
    const hlNow = (typeof Battle !== 'undefined' && Battle.pLayer != null) ? Battle.pLayer : 0;
    const wallDanger = (S.rings[hlNow] || 0) > moveLimit + 6;
    a.fx.purpleSoul = { mode: 7, rings: S.rings.slice(), moveLimit, shiftN: S.shiftN, elec: Math.floor(f / 4) % 3, wall: wallDanger };
    S.life++;
    // ---- tunnel_speed (exact) ----
    let speed = Math.min(L / 10, 1.5 + L / 50, 11);
    if (L < 40) speed += ((240 / Math.max(1, L * 0.9)) * (40 - L)) / 40;   // the early flood
    const hl = (typeof Battle !== 'undefined' && Battle.pLayer != null) ? Battle.pLayer : 0;
    const hR = (typeof Battle !== 'undefined' && Battle.pR != null) ? Battle.pR : 12;
    if (L >= 40) { let base = Math.min(L / 10, 1.5 + L / 50, 11);          // zoom-in boost while near the centre
      for (let i = 0; i < 8; i++) { if (hR < Math.max(34, 59 - base * 3) - (i * i) / 2) { if (i === 0) speed = Math.max(speed, 2); else speed *= 4 / 3; } else break; } }
    const rHeart = S.rings[hl] || 0;                                       // stall if your ring is past the limit
    if (rHeart > moveLimit + 2) { speed = 1 / 3; if (rHeart > moveLimit + 8) { speed = 1 / 6; if (rHeart > moveLimit + 15) speed = 0; } }
    // ---- grow + recycle rings (exact formula) ----
    if (speed > 0) for (let i = 0; i < 8; i++) { let r = S.rings[i]; if (r > 0) {
      r = r * (1 + r / (32000 / speed)) + 0.0375 * speed;
      S.rings[i] = r > 224 ? 0 : r; } }
    // ---- shift: new ring + attack/doki ----
    S.timer += speed;
    if (S.timer >= 188) {
      S.timer -= 188;
      for (let i = 7; i >= 1; i--) S.rings[i] = S.rings[i - 1];
      S.rings[0] = 12; S.shiftN++;
      let dokidir = ir(3) * 90;
      S.phase++;
      if (S.phase >= 1) {
        if (S.list.length <= 0) {   // refill pattern_list with the EXACT _atk chain generator
          let atk = S.lastAtk, ang = S.list.length ? 0 : ir(7) * 45;
          for (let k = 0; k < 3; k++) {
            let na, nang = ang;
            switch (atk) {
              case 0: na = pick(1, 3, 4);
                if (na === 1) nang = ang + 45 + 90 * pick(1, 2); else if (na === 4) nang = 45 * pick(1, 3, 5, 7); else nang = 45 * ir(7); break;
              case 1: na = pick(-1, 3); nang = na === 1 ? ang + 90 * pick(1, 3) : 45 * ir(7); break;
              case 2: na = pick(-1, 0); nang = na === 0 ? ang + 90 * pick(0, 1, 3) : 45 * ir(7); break;
              case 4: na = pick(-1, 0, 3, 4);
                if (na === 0) nang = 90 * ir(3); else if (na === 4) nang = ang + 90; else nang = 45 * ir(7); break;
              case 3: {
                const prev4 = S.list.length >= 4 && S.list[S.list.length - 4] === 3;
                na = prev4 ? -1 : pick(-1, 0, 1, 2, 3, 4);
                if (na === 0 || na === 2) nang = 90 * ir(3); else if (na === 1 || na === 4) nang = 45 * pick(1, 3, 5, 7); else nang = 45 * ir(7); break; }
              default: na = pick(0, 1, 2, 3, 4);
                if (na === 0 || na === 2) nang = 90 * ir(3); else if (na === 1 || na === 4) nang = 45 * pick(1, 3, 5, 7); else nang = 45 * ir(7);
            }
            nang = wrap(nang);
            if (na >= 0) { S.list.push(na, nang); atk = na; ang = nang; } else break;
          }
          S.lastAtk = atk;
        }
        S.phase -= 1;
        const variant = S.list.shift(), vdir = S.list.shift();
        if (S.list.length <= 0) S.phase -= 1;
        // wall parameters (exact per-variant table)
        const dirAdd = pick(-1, 1) * 10; let repeats = 6, moving = 0, multiple = 1, dir0 = vdir;
        if (variant === 0) repeats = 6;
        else if (variant === 1) repeats = 15;
        else if (variant === 2) repeats = 29;
        else if (variant === 3) { repeats = 6 + ir(2); moving = pick(-1, 1) * pick(2.5, 5); if (S.list.length >= 2 && (S.list[0] === 4 || S.list[0] === 2 || S.list[0] === 1)) repeats = 6; }
        else { repeats = 6; multiple = 2; }
        let dir = wrap((dir0 - (dirAdd / 2) * (repeats - 1)) + S.laneDir);
        const mkZap = (angDeg, cap) => {
          // obj_pinkzap / obj_pinktimeoutzap: spr_pinkzap (6-frame anim); moving walls use spr_pinkzap_arrow
          const zapKeys = moving !== 0 ? ['pinkzaparrow0', 'pinkzaparrow1', 'pinkzaparrow2', 'pinkzaparrow3', 'pinkzaparrow4', 'pinkzaparrow5']
                                        : ['pinkzap0', 'pinkzap1', 'pinkzap2', 'pinkzap3', 'pinkzap4', 'pinkzap5'];
          const b = { ...bulletProps(zapKeys[0]), animKeys: zapKeys, animRate: 4, x: cx, y: cy, vx: 0, vy: 0,
                      r: 7, grazeR: 10, scale: PS(1), dmg: 50, life: 9000, noHit: true, alpha: 0,
                      _zap: 1, _cap: !!cap, _layer: 0, _ss: S.shiftN, _angDeg: angDeg, _spin: moving };
          const SS = S;
          b.emit = function (b) {
            while (b._ss < SS.shiftN) { b._layer++; b._ss++; }
            if (b._layer > 7 || (SS.rings[b._layer] || 0) <= 0) { b.dead = true; return; }
            b._angDeg = wrap(b._angDeg + b._spin);
            const vr = (typeof Battle !== 'undefined' && Battle.pViewRot) || 0;   // camera rides the soul
            const R = SS.rings[b._layer], ar = wrap(b._angDeg + vr) * Math.PI / 180;
            b.x = SS.cx + Math.cos(ar) * R; b.y = SS.cy - Math.sin(ar) * R;   // GML lengthdir (y = -sin)
            b.scale = PS(Math.max(0.5, R / 48));                              // pseudo-3D zoom with the ring
            b.rot = Math.atan2(-Math.cos(ar), -Math.sin(ar)) + (b._spin < 0 ? Math.PI : 0);   // tangent
            // COLLISION: a zap only hurts when it's on the HEART's OWN ring (obj_pinkzap active only when
            // tunnel_lane_layer==heart layer). Instead of trusting Battle.pLayer (off-by-one at ring
            // boundaries let the next ring out hit you), compute the ring PHYSICALLY closest to the heart
            // and collide ONLY that one. End-caps (cap) are always harmless.
            let hLayer = (typeof Battle !== 'undefined' && Battle.pLayer != null) ? Battle.pLayer : 0;
            const heart = (typeof Battle !== 'undefined') && Battle.soul;
            if (heart) { const hd = Math.hypot(heart.x - SS.cx, heart.y - SS.cy); let cb = 1e9;
              for (let i = 0; i < 8; i++) { const ri = SS.rings[i]; if (ri > 0) { const dd = Math.abs(ri - hd); if (dd < cb) { cb = dd; hLayer = i; } } } }
            b.noHit = b._cap || (b._layer !== hLayer);
            if (b.alpha < 1) b.alpha = Math.min(1, (b.alpha || 0) + 0.2);
          };
          add(b);
        };
        for (let i = 0; i < repeats * multiple; i++) {
          const cap = (i % repeats) === 0 || (i % repeats) === (repeats - 1);   // wall end-caps are harmless
          mkZap(dir, cap);
          dir = wrap(dir + dirAdd);
          if (multiple > 1 && ((i + 1) % repeats) === 0) dir = wrap(dir + 180 - dirAdd * repeats);
        }
        dokidir = -1;
      }
      if (S.rings[5] > 0 && dokidir >= 0) {   // non-attack shifts drop a doki-heart riding the new ring
        const b = { ...bulletProps('pdoki'), x: cx, y: cy, vx: 0, vy: 0, pickup: true, tp: 2, doki: 2, r: 8, scale: PS(1), life: 9000,
                    _layer: 0, _ss: S.shiftN, _angDeg: wrap(dokidir + S.laneDir) };
        const SS = S;
        b.emit = function (b) {
          while (b._ss < SS.shiftN) { b._layer++; b._ss++; }
          if (b._layer > 7 || (SS.rings[b._layer] || 0) <= 0) { b.dead = true; return; }
          const vr = (typeof Battle !== 'undefined' && Battle.pViewRot) || 0;   // camera rides the soul
          const R = SS.rings[b._layer], ar = wrap(b._angDeg + vr) * Math.PI / 180;
          b.x = SS.cx + Math.cos(ar) * R; b.y = SS.cy - Math.sin(ar) * R;
          b.scale = PS(Math.max(0.5, R / 48));
        };
        add(b);
      }
    }
  },
};
// ============ TYPE 209 — IDOL CONCERT (Pink's ULT): 1:1-structured port ============
// Stage box, Pink sings at top, FAST free-move (red) soul. obj_pink_curtains fires audience members in a
// CHOREOGRAPHED order (l_patterns e.g. [4,1,5,2,0]) with l_timings [80,40,40,60] between them. Each
// obj_audienceheart WINDS UP ~32f (grows, aims/eases toward the soul), then LAUNCHES at speed 5 in the
// aimed direction (obj_audienceheart phase 0->1). A heart that flies past the top (reaching Pink) becomes
// a bigger COLLECTABLE pink heart. Audience sit around the lower stage.
// ============ TYPE 209 — IDOL CONCERT (Pink's ULT): full rebuild from obj_pink_curtains ============
// Stage box; PINK sings at the top; the AUDIENCE (spr_dummyaudience) is seated in a row below the stage and
// pops up in choreographed CLUSTERS (l_patterns [4,1,5,2,0]... + l_timings). Each risen member fires an
// obj_audienceheart: it GROWS from tiny over 32 frames while AIMING at the soul (turn ±2/frame, 0.8/0.2
// blend), then LAUNCHES in the aimed direction with ACCELERATING speed (speed += 0.25 + t/32). Later reps
// spawn HATERS (spr_dummyaudience frame 1) that fire red homing hearts. A heart that flies past the top of
// the stage (reaching Pink) becomes a bigger COLLECTABLE. FAST free-move (red) soul.
// IDOL CONCERT (obj_pink_curtains) — FULL 1:1 port. 28 dummies line the LEFT column (0-6), BOTTOM row (7-20)
// and RIGHT column (21-27) of the arena. Each wave a subset "shows up", pops out and (20f later) fires ONE
// obj_audienceheart INWARD which grows, aims at the soul (±2°/f, 0.8/0.2 blend) then LAUNCHES accelerating.
// Difficulty-0 (first meeting): ammo=5, patterns [4,1,5,2,0] or [4,2,5,1,0], l_timings [90,80,40,40,60], no haters.
function pinkConcertSlot(i, gx, gy) {   // dummy i -> {x, y, side} exactly per obj_pink_curtains placement
  if (i < 3) return { x: gx - 160 + 10, y: gy + 12 + i * 24, side: 'left' };
  if (i < 7) return { x: gx - 160, y: gy + 12 + i * 24, side: 'left' };
  if (i < 21) return { x: gx + (i - 13.5) * 24, y: gy + 170, side: 'bottom' };
  if (i < 24) return { x: gx + 164 - 10, y: gy + 12 + (i - 21) * 24, side: 'right' };
  return { x: gx + 164, y: gy + 12 + (i - 21) * 24, side: 'right' };
}
function pinkConcertShowup(pat, rng) {   // obj_pink_curtains l_patterns cases -> the dummy indices that appear
  const s = [];
  if (pat === 0) { for (let i = 4; i < 7; i++) s.push(i); for (let i = 7; i < 21; i++) s.push(i); for (let i = 25; i < 28; i++) s.push(i); }
  else if (pat === 1) { for (let i = 2; i < 7; i++) s.push(i); for (let i = 8; i <= 14; i += 2) s.push(i); }
  else if (pat === 2) { for (let i = 23; i < 28; i++) s.push(i); for (let i = 19; i >= 13; i -= 2) s.push(i); }
  else if (pat === 4) { for (let i = 9; i < 13; i++) s.push(i); for (let i = 15; i < 19; i++) s.push(i); }
  else if (pat === 5) { for (let i = 10; i < 18; i++) s.push(i); }
  else if (pat === 3) { const used = new Set(); let d = 1 + Math.floor(rng() * 25);   // random 13 (fnc dice walk)
    for (let k = 0; k < 13; k++) { d += 1 + Math.floor(rng() * 24); if (d >= 21) d++; if (d >= 28) d -= 26;
      while (used.has(d)) { d++; if (d >= 21) d++; if (d >= 28) d -= 26; } used.add(d); s.push(d); } }
  return s;
}
function pinkConcertPattern(diff) { return {
  box: { w: 320, h: 172 }, hz30: 1, dur: diff > 0 ? 560 : 480,
  tick(a) {
    const { f, box, add, rng } = a; const S = this;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const gx = cx, gy = box.y;                               // obj_pink_curtains anchor = box centre-top
    S.closed = (S.closed == null) ? 2 : Math.max(0, S.closed - 0.05);   // stage curtains open 2->0 over ~40 steps
    a.fx.pinkSing = { x: cx, y: box.y - 34, f, closed: S.closed, boxTop: box.y, boxH: box.h, boxW: box.w };   // + curtains
    if (f === 0) {
      S.dummies = [];
      // hard (difficulty>0) uses the case-3 pattern set + slower [90,60,60,90] timings (concert.md 2c)
      const order = diff > 0 ? (rng() < 0.5 ? [3, 1, 5, 2, 0] : [3, 2, 1, 5, 0]) : (rng() < 0.5 ? [4, 1, 5, 2, 0] : [4, 2, 5, 1, 0]);
      const timings = diff > 0 ? [90, 90, 60, 60, 90] : [90, 80, 40, 40, 60];   // l_timings: delay BEFORE each wave
      S.waves = []; let t = 8;
      for (let w = 0; w < 5; w++) { S.waves.push({ at: t, pat: order[w], wi: w }); t += timings[w]; }
    }
    // ---- launch a wave when its time comes: pick the dummy set + per-dummy shoottime sweep (_shootorder_variant) ----
    for (const wv of S.waves) {
      if (wv.done || f < wv.at) continue; wv.done = 1;
      const pat = wv.pat;
      const variant = pat === 2 ? 0 : pat === 1 ? 1 : pat === 0 ? 2 : 3;   // difficulty-0 forced variants
      let show = pinkConcertShowup(pat, rng);
      show.sort((p, q) => p - q);
      const right = show.filter(i => i >= 21), rest = show.filter(i => i < 21); show = rest.concat(right);   // right column fires last
      const size = show.length;
      // HARD: HATERS (lobbed mic-stand bombs) only near the END, max 2 (wave 3 -> 1, final wave 4 -> 2)
      const nHaters = diff > 0 ? (wv.wi >= 4 ? 2 : wv.wi === 3 ? 1 : 0) : 0;
      const haterSet = new Set(); while (haterSet.size < Math.min(nHaters, size)) haterSet.add(Math.floor(rng() * size));
      show.forEach((i, k) => {
        let st;                                              // shoottime = staggered sweep
        if (variant === 0) st = Math.floor(k * 1.5);
        else if (variant === 1) st = Math.floor((size - k) * 1.5);
        else if (variant === 2) st = i < 14 ? Math.floor((14 - i) * 3) : i < 21 ? Math.floor((i - 14) * 3) : Math.floor((i - 17) * 3);
        else st = Math.floor(rng() * size);                 // variant 3: shuffled
        const sl = pinkConcertSlot(i, gx, gy);
        S.dummies.push({ i, x: sl.x, y: sl.y, side: sl.side, st, hater: haterSet.has(k), t: 0, pop: 0 });
      });
    }
    // ---- advance every live dummy: pop out, wait 20f, count its shoottime, FIRE inward, retract at 60, gone at 90 ----
    const aimOf = s => s === 'left' ? 0 : s === 'right' ? Math.PI : -Math.PI / 2;
    for (const d of S.dummies) {
      d.t++;
      d.pop += ((d.t >= 8 && d.t < 60 ? 1 : 0) - d.pop) * 0.35;   // pop out, then retract
      if (d.hater) { if (d.t === 55 && !d._done) { d._done = 1; mkAudienceHater(add, d.x, d.y, box); } }   // convert to lobbed bomb
      else if (d.t >= 20 && d.st >= 0) { if (d.st > 0) d.st--; else { mkAudienceHeart(add, d.x, d.y, aimOf(d.side), cx, cy, box, false); d.st = -1; } }
    }
    S.dummies = S.dummies.filter(d => d.t < 90);
    // draw the U-ring IN FRONT of the box + bullets, each popped inward from its edge
    a.fx.audienceFront = S.dummies.map(d => {
      const off = d.pop * 12 * (d.hater ? 2.6 : 1);   // haters leap much higher (up over the top to threaten a high soul)
      const px = d.side === 'left' ? d.x + off : d.side === 'right' ? d.x - off : d.x;
      const py = d.side === 'bottom' ? d.y - off : d.y;
      return { x: px, y: py, side: d.side, pop: d.pop, hater: d.hater };
    });
  },
}; }
// obj_audiencehater: a hard-mode member converts to a mic-stand bomb that LOBS at the soul (overshoot arc,
// speed ~9 + gravity 0.5) then EXPLODES (spr_explosion_round) on contact / landing (concert.md §5).
function mkAudienceHater(add, x, y, box) {
  if (typeof Snd !== 'undefined') Snd.play('pinkelectric', 0.3);
  const b = { ...bulletProps('dummyaud1'), x, y, vx: 0, vy: 0, noHit: true, scale: PS(1), dmg: 50, life: 320,
              rot: 0, tint: '#ff2a2a', tintMul: true, _wind: 32 };   // haters are RED (easy to see)
  b.emit = function (b, out, sl) {
    if (b._wind > 0) { b._wind--;
      b.tint = (b._wind < 9 && (b._wind % 2)) ? '#ffff88' : '#ff2a2a';    // yellow pre-throw flash
      b.x = x + (b._wind < 12 ? ((b._wind % 2) * 2 - 1) * 2 : 0);          // jitter windup
      if (b._wind === 0 && sl) {                                          // LAUNCH: lob at the soul with overshoot
        const dist = Math.hypot(sl.x - b.x, sl.y - b.y), over = dist * dist / 620;   // higher arc so it reaches the top
        const dir = Math.atan2((sl.y - over) - b.y, sl.x - b.x);
        const spd = Math.max(13, Math.min(20, dist / 9 + 12));            // fast enough to reach a soul at the top of the box
        b._vx = Math.cos(dir) * spd; b._vy = Math.sin(dir) * spd; b._fly = 1; b.noHit = false; b.tint = '#ffffff'; b.tintMul = false;
        if (typeof Snd !== 'undefined') Snd.play('boardbomb', 0.35);
      }
      return;
    }
    if (b._fly && !b._boom) { b._vy += 0.5; b.x += b._vx; b.y += b._vy; b.rot = Math.atan2(b._vy, b._vx) + Math.PI / 2;
      if ((sl && Math.hypot(sl.x - b.x, sl.y - b.y) < 22) || b.y > box.y + box.h + 48 || b.t > 130) {   // contact / land / timeout
        b._boom = 1; b.noHit = true; b.dead = true;
        out.push({ ...bulletProps('explround0'), animKeys: ['explround0', 'explround1', 'explround2', 'explround3', 'explround4', 'explround5', 'explround6', 'explround7', 'explround8'],
                   animRate: 2, x: b.x, y: b.y, vx: 0, vy: 0, r: 30, scale: PS(1), dmg: 26, life: 18, _pinkBoom: 1 });
        if (typeof Battle !== 'undefined') { Battle.shake = Math.max(Battle.shake || 0, 10); }
        if (typeof Snd !== 'undefined') Snd.play('explosionmmx', 0.4);
      }
    }
  };
  add(b);
}
function mkAudienceHeart(add, x, y, dir, cx, cy, box, hater) {
  // obj_audienceheart: the REAL projectile is spr_heartbullet (18px red heart). Grows from tiny, aims, launches.
  const b = { ...bulletProps('heartbullet'), x, y, vx: 0, vy: 0, noHit: true, scale: 0.02, dmg: 48, life: 340,
              r: 7, grazeR: 11, _w: 0, _aim: dir != null ? dir : -Math.PI / 2, _hater: hater };
  if (hater) { b.tint = '#d000d0'; b.tintMul = true; }   // haters (spr_dummyaudience frame1) fire a purple homing heart
  if (typeof Snd !== 'undefined') Snd.play('pinkelectric', 0.25);
  const FINAL = PS(1.5);   // obj_audienceheart _mainscale = 1.5 -> ~27px heart
  b.emit = function (b, out, sl) {
    if (b._phase !== 1) {   // PHASE 0: grow (tiny -> FINAL) + aim at the soul over 32 frames (obj_audienceheart)
      b._w++;
      const grow = b._w < 25 ? Math.min(FINAL, 0.02 + (b._w / 24) * FINAL) : FINAL * (b._w >= 26 ? 1.0 + Math.min(4, b._w - 25) * 0.05 : 1.0);
      b.scale = grow;
      if (b._w >= 11 && sl) { const dest = Math.atan2(sl.y - b.y, sl.x - b.x);   // turn toward the soul, capped ±2/frame + 0.8/0.2 blend
        let dd = ((dest - b._aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI; b._aim += Math.max(-0.035, Math.min(0.035, dd));
        b._aim = b._aim * 0.8 + dest * 0.2; }
      if (b._w >= 32) { b._phase = 1; b.noHit = false; b._spd = 1; b._dir = b._aim; }
    } else {   // PHASE 1: launch in the aimed direction, accelerating
      b._spd += 0.25 + b._w / 320; b._w++;
      if (b._hater && sl) { const dest = Math.atan2(sl.y - b.y, sl.x - b.x);   // haters keep homing a little
        let dd = ((dest - b._dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI; b._dir += Math.max(-0.045, Math.min(0.045, dd)); }
      b.vx = Math.cos(b._dir) * b._spd; b.vy = Math.sin(b._dir) * b._spd;
      b.scale = FINAL;
      if (!b._hater && b.y < box.y - 4 && !b._done) {   // reached Pink at the top -> becomes a DOKI collectable (spr_dokiheart)
        b._done = 1; b.dead = true;
        out.push({ ...bulletProps('pdoki'), x: b.x, y: box.y + 12, vx: 0, vy: 1, pickup: true, tp: 2, doki: 2, r: 9, scale: PS(0.9), life: 160 });
      }
    }
  };
  add(b);
}
// TYPE 205 — Conveyor cat rush (purple mode 5: the 2 lanes auto-scroll you vertically — lane 0 down,
// lane 1 up). Faster cats (5.4/4.4/3.4) + 4 stationary corner "wall" cats. Fight the conveyor, weave.
// ============ TYPE 210 — GHOST/BODY MAZE (obj_purplecontrols mode 8): FULL-SCREEN 1:1 port ============
// The battle box is DESTROYED — the maze plays on the whole 640x480 purple void. obj_pinknode form a graph;
// the purple heart HOPS node-to-node (arrows). obj_pinknodeact boxes patrol (pattern 0 static, 1 vertical bob
// +-62 @ +4deg/f, 2 horizontal sweep 288 @ +1.5deg/f, 3 hunter along connections). mode 0 = "DIE!" (contact ->
// damage + reset to the checkpoint=2 node), mode 1 = the goal. A DOKI heart converts a DIE box to the goal
// (diff 0) or docks root hp (root hp 0 -> goal spawns on root). Beating a difficulty rebuilds the next graph
// (0->1->2->3); after difficulty 3 the maze ENDS (no case 4) and hands back. Pink is SPLIT into her wave-
// distorted body (spr_pink_very_hurt_2xscale) + detached ghost (spr_pink_ghost_2xscale), sine-sliced.
// fnc_make_node(dir,dist): child[dir] at (x+lengthdir_x(dist,dir*90), y+lengthdir_y(dist,dir*90)); dir 0=R,1=U,
// 2=L,3=D. _node_dist=54, horizontal arms x2.125=114.75. Goal text per difficulty: Stop!/Calm down!/Don't cry!/It's OK!
function mazeBuild(r, rng) {
  const D = 54, HM = 2.125, rnd = rng || Math.random;
  const N = [];
  const node = (x, y) => { N.push({ x, y, child: [-1, -1, -1, -1], drawConn: [false, false, false, false], checkpoint: 0, darkify: 0 }); return N.length - 1; };
  const mk = (parent, dir, dist) => { const p = N[parent], rad = dir * Math.PI / 2;
    const i = node(p.x + Math.cos(rad) * dist, p.y - Math.sin(rad) * dist); N[parent].child[dir] = i; return i; };
  const goalText = ['Stop!', 'Calm down!', "Don't cry!", "It's OK!"][Math.min(3, r)];
  let start = 0, acts = [], dokis = [], rootHp = 0, path = null;
  const root = node(0, 0); N[root].checkpoint = 2;
  if (r <= 0) {
    const n1 = mk(0, 0, D * HM), n2 = mk(0, 1, D), n3 = mk(0, 2, D * HM), n4 = mk(0, 3, D);
    const n5 = mk(1, 1, D), n6 = mk(1, 3, D), n7 = mk(3, 1, D), n8 = mk(3, 3, D);
    acts = [{ node: n4, mode: 0, pattern: 0 }, { node: n5, mode: 0, pattern: 0 }, { node: n7, mode: 0, pattern: 0 }];
    dokis = [{ node: [n2, n6, n8][Math.floor(rnd() * 3)], changeActIdx: Math.floor(rnd() * 3), delay: 45 }];
  } else if (r === 1) {
    const n1 = mk(0, 0, D * HM), n2 = mk(0, 1, D), n3 = mk(0, 2, D * HM), n4 = mk(0, 3, D);
    const n5 = mk(1, 1, D), n6 = mk(1, 3, D), n7 = mk(3, 1, D), n8 = mk(3, 3, D);
    N[n2].child[2] = n7; N[n4].child[0] = n6;
    acts = [{ node: n1, mode: 0, pattern: 1, pdir: 0 }, { node: n3, mode: 0, pattern: 1, pdir: 180 }];
    dokis = [{ node: n5, rootHp: 1, delay: 30 }, { node: n8, rootHp: 1, delay: 30 }]; rootHp = 2;
  } else if (r === 2) {
    const n1 = mk(0, 0, D * HM), n2 = mk(0, 1, D), n3 = mk(0, 2, D * HM), n4 = mk(0, 3, D);
    const n5 = mk(1, 0, D * HM), n6 = mk(1, 1, D), n7 = mk(1, 3, D); const n8 = mk(n5, 1, D);
    const n9 = mk(3, 1, D), n10 = mk(3, 2, D * HM), n11 = mk(3, 3, D); const n12 = mk(n10, 3, D);
    acts = [{ node: n1, mode: 0, pattern: 1, pdir: 0 }, { node: n3, mode: 0, pattern: 1, pdir: 180 }, { node: n5, mode: 0, pattern: 2, pdir: 210 }];
    dokis = [{ node: n7, rootHp: 1, delay: 60 }, { node: n8, rootHp: 1, delay: 30 }, { node: n9, rootHp: 1, delay: 60 }, { node: n12, rootHp: 1, delay: 30 }]; rootHp = 4;
  } else {
    const chain = [[0, 1], [1, 1], [0, 1], [3, 1], [0, 1], [3, 1], [0, 1], [1, 1], [0, 1], [1, 1], [2, 1], [1, 1.5], [0, 1], [1, 1], [2, 1], [1, 2.5], [2, 1.75], [3, 1], [2, 1.25], [1, 1], [2, 2], [3, 1], [2, 1.25], [1, 1], [2, 2.75], [3, 1], [0, 1], [3, 1], [2, 1], [3, 1], [0, 2], [3, 2], [2, 1.25], [1, 1], [2, 1], [3, 3], [0, 1], [1, 1], [0, 2.375]];
    let cur = 0; const seq = []; for (const [dir, mul] of chain) { cur = mk(cur, dir, D * mul); seq.push(cur); }
    start = seq[0]; N[start].checkpoint = 2; N[root].checkpoint = 0;
    acts = [{ node: cur, mode: 1, pattern: 0 }];   // goal at the snake end; DIE! hazards are the patrolling TRAIN
    for (const [si, dir, mul] of [[4, 1, 1.25], [11, 2, 1.25], [22, 3, 1]]) {   // checkpoint/dark SAFETY branches
      const b = mk(seq[si], dir, D * mul); N[b].checkpoint = 1; N[b].darkify = 1; N[b].child[(dir + 2) % 4] = seq[si]; }
    path = seq;   // the ordered main chain the DIE-train loops along (start=seq[0], end=seq[last])
  }
  // every edge built so far is a REAL (draw_connection) edge; the reciprocal back-links added next are not
  for (const nd of N) for (let d = 0; d < 4; d++) if (nd.child[d] >= 0) nd.drawConn[d] = true;
  // reciprocal back-links (obj_pinknode Other_10) -> bidirectional SOUL movement (hunter ignores these)
  for (let i = 0; i < N.length; i++) for (let d = 0; d < 4; d++) { const c = N[i].child[d]; if (c >= 0 && N[c].child[(d + 2) % 4] < 0) N[c].child[(d + 2) % 4] = i; }
  // RAW room coords (obj_pinknode uses absolute lengthdir positions; NO re-center/scale). Root at (320,360)
  // = screen centre-x, lower-third-y, so small graphs cluster low-centre and diff-3 fills the screen.
  for (const n of N) { n.x += 320; n.y += 360; n.dx = n.x; n.dy = n.y; }
  return { nodes: N, start, acts, dokis, rootHp, goalText, path };
}
// ============ PINK V3 — FINAL MAZE (obj_purplecontrols mode 8), exact re-port ============
// Fixes over V2: node DRIFT (diff3, speed 0.25 / 10deg steer), soul tracks the LIVE (drifting)
// node so it sits heart_travel px behind it (spec §4), a REPEATING hunter launched from
// (320,140) toward node_start at cadence 36+clamp(hits-1,0,4)*2 (spec §9), and doki RELOCATION
// to a backup node when the soul camps the doki's node (spec §6). Shares mazeBuild + drawMaze
// (drawMaze's per-frame surface realloc — the lag — is fixed).
PATTERNS.pink_finalmaze = {
  box: { w: 565, h: 372 }, hz30: 1, dur: 12000, fullscreen: true, ROUNDS: 4,
  tick(a) {
    const { f, rng } = a; const S = this;
    const B = (typeof Battle !== 'undefined') ? Battle : null;
    const IN = (typeof Input !== 'undefined') ? Input : { hit: {}, down: {} };
    const HIT = k => IN.hit && IN.hit[k];
    const D2R = Math.PI / 180, STEER = 10 * D2R;
    if (f === 0) { S.round = 0; S._built = -1; S._done = false; S.hits = 0; }
    if (S._built !== S.round) {
      const R = mazeBuild(S.round, rng);
      S.nodes = R.nodes; S.start = R.start; S.acts = R.acts.filter(ac => ac.pattern !== 3); // hunters spawned live
      S.dokis = R.dokis; S.rootHp = R.rootHp; S.goalText = R.goalText;
      S._built = S.round; S._won = 0; S._winT = 0; S.iframes = 0;
      S.soulNode = S.start; const s0 = S.nodes[S.start]; S.soul = { x: s0.x, y: s0.y }; S.heartTravel = 0; S.target = S.start; S.moveDir = 0;
      for (const ac of S.acts) { const n = S.nodes[ac.node]; ac.x = n.x; ac.y = n.y; ac.pdir = ac.pdir || 0; ac.life = 0; ac._tnode = ac.node; }
      // node drift only on diff3 (speed 0.25); each node wanders around its home dx/dy
      S.drift = (S.round === 3);
      for (const n of S.nodes) { n.dir = rng() * Math.PI * 2; n.spd = S.drift ? 0.25 : 0; }
      // doki backup node = the farthest OTHER doki node (relocation target if the soul camps)
      for (const dk of S.dokis) { dk._t = dk.delay; dk.spawned = false; dk.collected = false;
        let best = -1, bd = -1; for (const o of S.dokis) { if (o === dk) continue; const dd = Math.hypot(S.nodes[o.node].x - S.nodes[dk.node].x, S.nodes[o.node].y - S.nodes[dk.node].y); if (dd > bd) { bd = dd; best = o.node; } }
        dk.backup = best; }
      // DIE-TRAIN (diff3): the ordered main path (excl. start & end) that the looping DIE! buttons patrol
      S.path = R.path; S.trainPath = R.path ? R.path.slice(1, -1) : null; S.train = null; S.trainStarted = false;
    }
    if (S.iframes > 0) S.iframes--;
    // ---- NODE DRIFT (diff3): steer `dir` toward home by <=10deg/frame, wander when home ----
    if (S.drift) for (const n of S.nodes) {
      const dh = Math.hypot(n.x - n.dx, n.y - n.dy);
      if (dh >= 1.5) { const aim = Math.atan2(n.dy - n.y, n.dx - n.x); let d = aim - n.dir;
        while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        n.dir += Math.max(-STEER, Math.min(STEER, d)); }
      else n.dir += (rng() < 0.5 ? -1 : 1) * STEER;
      n.x += Math.cos(n.dir) * n.spd; n.y += Math.sin(n.dir) * n.spd;
    }
    // ---- INPUT: ONE press = ONE node move. Detect the press EDGE from the HELD state (Input.down) so a tap
    // is NEVER dropped at 30Hz — Input.hit clears every 60Hz frame, so the 30Hz sim would randomly miss it
    // (that was the "can't move during a flash"). A tap mid-slide is buffered (~10f) and fired on arrival. ----
    const DOWN = k => IN.down && IN.down[k];
    S._wd = S._wd || {}; const DIRK = ['right', 'up', 'left', 'down'];
    let pressDir = -1; for (let i = 0; i < 4; i++) { const nowD = DOWN(DIRK[i]); if (nowD && !S._wd[DIRK[i]]) pressDir = i; S._wd[DIRK[i]] = nowD; }
    if (pressDir >= 0) { S.bufDir = pressDir; S.bufAge = 0; }
    else if (S.bufDir != null) { S.bufAge = (S.bufAge || 0) + 1; if (S.bufAge > 10) S.bufDir = null; }
    // ---- SOUL node-hop movement: heart_travel = home edge length; soul rides behind LIVE node ----
    if (S.heartTravel <= 0 && !S._won) {
      const dir = S.bufDir;   // only a fresh (buffered) tap moves — no auto-repeat on hold
      if (dir != null && dir >= 0) { const c = S.nodes[S.soulNode].child[dir];
        if (c >= 0) { const cur = S.nodes[S.soulNode], t = S.nodes[c]; S.target = c;
          S.heartTravel = Math.hypot((t.dx - cur.dx), (t.dy - cur.dy));   // point_distance(dest,dest)
          if (typeof Snd !== 'undefined') Snd.play('graze', 0.2); } }
      S.bufDir = null;   // consume the buffer on arrival
    }
    if (S.heartTravel > 0) { const t = S.nodes[S.target];
      const md = Math.atan2(t.y - S.soul.y, t.x - S.soul.x);              // live point_direction soul->node
      const dist = Math.hypot(t.x - S.soul.x, t.y - S.soul.y);
      const mv = Math.min(22, Math.max(1, dist)); S.heartTravel -= mv; S.moveDir = md;
      if (S.heartTravel <= 0 || dist <= mv) { S.heartTravel = 0; S.soulNode = S.target; S.soul.x = t.x; S.soul.y = t.y;
        if (t.checkpoint === 1) { for (const n of S.nodes) if (n.checkpoint > 1) n.checkpoint = 1; t.checkpoint = 2; } }
      else { S.soul.x = t.x - Math.cos(md) * S.heartTravel; S.soul.y = t.y - Math.sin(md) * S.heartTravel; }
    }
    // ---- DIE-TRAIN (diff3): a LOOP of evenly-spaced DIE! buttons patrols the main chain (excl. start/end &
    // the side SAFETY nodes), chasing the player. They wrap end->start endlessly. Hide in a safety node or
    // reach the goal to survive; a hit sends you back to the START (not a checkpoint). ----
    if (S.round === 3 && S.trainPath && !S._won) {
      if (!S.trainStarted && S.soulNode !== S.start) {   // spawns once the player first leaves the start node
        S.trainStarted = true; S.train = []; const NB = 4, tpN = S.trainPath.length;
        for (let i = 0; i < NB; i++) S.train.push({ seg: Math.floor(i * tpN / NB) % tpN, prog: 0, x: 0, y: 0 }); }
      if (S.trainStarted) { const tp = S.trainPath, tpN = tp.length, spd = 9.5 + S.hits * 0.4;   // ~soul speed minus a ~0.1s/node reaction window; faster as you get hit
        for (const btn of S.train) {
          let na = S.nodes[tp[btn.seg]], nb = S.nodes[tp[(btn.seg + 1) % tpN]], edge = Math.hypot(nb.x - na.x, nb.y - na.y) || 1;
          btn.prog += spd; let guard = 0;
          while (btn.prog >= edge && guard++ < 60) { btn.prog -= edge; btn.seg = (btn.seg + 1) % tpN; na = S.nodes[tp[btn.seg]]; nb = S.nodes[tp[(btn.seg + 1) % tpN]]; edge = Math.hypot(nb.x - na.x, nb.y - na.y) || 1; }
          const tt = btn.prog / edge; btn.x = na.x + (nb.x - na.x) * tt; btn.y = na.y + (nb.y - na.y) * tt;
        }
      }
    }
    // ---- ACTS: obj_pinknodeact movement patterns ----
    for (const ac of S.acts) { ac.life++; const n = S.nodes[ac.node] || { x: 320, y: 268 };
      if (ac.pattern === 1) { ac.pdir = (ac.pdir + 4) % 360; ac.x = n.x; ac.y = n.y - Math.sin(ac.pdir * Math.PI / 180) * 62; }
      else if (ac.pattern === 2) { ac.pdir = (ac.pdir + 1.5) % 360; const base = (ac.pdir > 90 && ac.pdir < 270) ? 704 : -64; ac.x = base + Math.cos(ac.pdir * Math.PI / 180) * 288; ac.y = n.y; }
      else if (ac.pattern === 3) { const tg = S.nodes[ac._tnode] || n, dx = tg.x - ac.x, dy = tg.y - ac.y, dd = Math.hypot(dx, dy) || 1;
        const spd = Math.min(4 + ac.life / 2, Math.max(12, Math.min(15, 15 - (S.hits - 1) * 0.75))), mv = Math.min(spd, dd);
        ac.x += dx / dd * mv; ac.y += dy / dd * mv;
        if (dd <= spd) { const nd = S.nodes[ac._tnode];   // FIXED route: first available draw_connection child (E,U,W,D) — never the soul
          let next = -1; for (let i = 0; i < 4; i++) { if (nd.child[i] >= 0 && nd.drawConn[i]) { next = nd.child[i]; break; } }
          if (next >= 0) ac._tnode = next; else ac._dead = 1; } }   // dead-end -> retire hunter
      else { ac.x = n.x; ac.y = n.y; }
    }
    S.acts = S.acts.filter(ac => !ac._dead && !(ac._hunter && ac.life > 600));   // retire spent hunters
    // ---- DOKI hearts: spawn after delay (RELOCATE to backup if soul camps the node), collect ----
    for (const dk of S.dokis) {
      if (!dk.spawned) { dk._t--; if (dk._t <= 0) { dk.spawned = true;
        let nd = dk.node; if (dk.backup >= 0 && S.soulNode === dk.node) nd = dk.backup;   // doki relocation
        dk._at = nd; const n = S.nodes[nd]; dk.x = n.x; dk.y = n.y; } }
      else if (!dk.collected) { const n = S.nodes[dk._at != null ? dk._at : dk.node]; dk.x = n.x; dk.y = n.y;   // glued to node
        if (Math.hypot(S.soul.x - dk.x, S.soul.y - dk.y) < 26) { dk.collected = true; if (typeof Snd !== 'undefined') Snd.play('mercyadd', 0.5); if (B) B.flash = 8;
          if (dk.changeActIdx != null && S.acts[dk.changeActIdx]) { S.acts[dk.changeActIdx].mode = 1; S.acts[dk.changeActIdx].life = 0; }
          else if (dk.rootHp) { S.rootHp--; if (S.rootHp <= 0 && !S.acts.some(x => x.mode === 1)) { const n2 = S.nodes[S.start]; S.acts.push({ node: S.start, mode: 1, pattern: 0, x: n2.x, y: n2.y, life: 0, pdir: 0, _tnode: S.start }); } } } }
    }
    // ---- CONTACT: DIE (mode 0) = damage + reset to checkpoint; GOAL (mode 1) = win the difficulty ----
    if (!S._won) for (const ac of S.acts) {
      if (!(Math.abs(S.soul.x - ac.x) < 24 && Math.abs(S.soul.y - ac.y) < 16)) continue;   // 48x32 hitbox
      if (ac.mode === 0 && S.iframes <= 0 && B) { const dmg = 16; B.dmgTaken = (B.dmgTaken || 0) + dmg;
        for (const m of (B.myTeam || [])) if (m && m.hp > 0) m.hp = Math.max(0, m.hp - dmg);
        S.iframes = 40; B.shake = Math.max(B.shake || 0, 16); B.flash = 8; if (typeof Snd !== 'undefined') Snd.play('hurt', 0.5); S.hits++;
        let cp = S.nodes.findIndex(n => n.checkpoint === 2); if (cp < 0) cp = S.start;   // reset to checkpoint node
        S.soulNode = cp; const c = S.nodes[cp]; S.soul.x = c.x; S.soul.y = c.y; S.heartTravel = 0; }
      else if (ac.mode === 1) { S._won = 1; S._winT = 0; if (typeof Snd !== 'undefined') Snd.play('pinkcoin', 0.7); if (B) B.flash = 14; }
    }
    // ---- DIE-TRAIN CONTACT (diff3): hit -> back to the START node + UNIQUE tiered damage (80/40/10 by HP%) ----
    if (S.round === 3 && S.trainStarted && !S._won && S.iframes <= 0 && B) {
      for (const btn of S.train) { if (Math.hypot(S.soul.x - btn.x, S.soul.y - btn.y) < 22) {
        for (const m of (B.myTeam || [])) if (m && m.hp > 0) { const mx = m.max || m.maxhp || m.hp, pct = m.hp / mx;
          const dmg = pct > 0.5 ? 80 : pct > 0.25 ? 40 : 10; m.hp = Math.max(0, m.hp - dmg); B.dmgTaken = (B.dmgTaken || 0) + dmg; }
        S.iframes = 40; B.shake = Math.max(B.shake || 0, 16); B.flash = 8; if (typeof Snd !== 'undefined') Snd.play('hurt', 0.5); S.hits++;
        S.soulNode = S.start; const c = S.nodes[S.start]; S.soul.x = c.x; S.soul.y = c.y; S.heartTravel = 0; break;
      } }
    }
    if (S._won) { S._winT++; if (S._winT >= 25) { if (S.round + 1 < S.ROUNDS) S.round++; else S._done = true; } }   // mode1 timer 2/frame->50 ~= 25 real frames
    // ---- POSSESSED Mew Mew backdrop (3-layer form + eye-lasers) is drawn behind the maze by drawMaze ----
    a.fx.maze = { active: true, done: S._done, nodes: S.nodes, acts: S.acts, hits: S.hits, life: f, goalText: S.goalText, round: S.round,
      dokis: S.dokis.filter(d => d.spawned && !d.collected).map(d => ({ x: d.x, y: d.y })),
      train: S.train ? S.train.map(b => ({ x: b.x, y: b.y })) : null,
      soul: { x: S.soul.x, y: S.soul.y }, wave: f * 2 };
  },
};

// ============ TYPE 203 — PINATA BOMBS: full 1:1 port ============
// obj_dbulletcontroller(203) chart = [cmd, interval] pairs, wait after each = round(0.5 + 45*interval).
//   cmd 0 = queue a small fusebomb   cmd 1 = Pink laughs (cosmetic)   cmd 2 = giant centre bomb
//   cmd 3 = 4-giant volley (edge/outside XYs via pattern 0/1/2 + reflect/rotate; one of the four has_heart)
//   cmd 4 = FINALE: Pink slides up/down at the box right holding a giant bomb (fuse 120, wave_speed
//           choose(3.85,4.725,5.15,5.95), slows to a stop as fuse<=25) — blasts the rows where she stops.
// obj_pink_battlemovement mode 5 (the thrower): volleys of 4+ smalls land in a PLUS around a centre cell
// [(gx,0),(gx,3),(0,gy),(3,gy)] shuffled; volleys of <=3 walk (±1,±2)/(±2,±1) hops wrapping mod 4.
// Small fuse = 55 + remaining*2 - repeat*2 (volleys detonate ~together, repeats speed up). has_heart every
// ammo_doki cycle (3 -> reset 2) — those bombs are PINK-tinted and leave a heart. obj_fusebomb: 22-tick
// air arc + flashing landing-ring telegraph, land bounce, fuse-frame sprite burn-down, squash-swell in the
// last 8 ticks, orange flash windows, SOUL CONTACT = instant detonation, explosion crosses CHAIN-detonate
// other landed bombs and destroy settled hearts. Giant = 3-lane-thick cross (x8 scale, 48px steps).
const PINK_BOMB_D0 = [0, 1.05, 0, 0, 0, 1.05, 0, 0, 0, 0.98, 0, 0, 0, 0, 0, 1.1, 0, 0, 0, 0, 0, 0.98, 0, 0, 0, 0, 0, 0.97, 0, 0, 0, 0, 0, 0, 0, 1.25, 1, 0];   // obj_dbulletcontroller type 203 case 0 (exact)
const PINK_BOMB_D1 = [0, 0.85, 0, 0.7, 0, 0.6, 0, 0.6, 0, 0, 0, 0.8, 0, 0, 0, 0.65, 0, 0, 0, 0, 0, 1.25, 1, 0];
const PINK_BOMB_D2 = [3, 1.25, 3, 1.25, 3, 1.25, 3, 1.5, 4, 3];
const PINK_BOMB_D3 = [0, 0, 0, 1.05, 0, 0, 0, 0, 0, 1.05, 0, 0, 0, 0, 0, 1.05, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0.975, 0, 0, 0, 0, 0, 0, 0, 0.875, 2, 1.5, 1, 0];
const PINK_BOMB_D4 = [0, 0.85, 0, 0.7, 0, 0.6, 0, 0.6, 0, 0, 0, 0.8, 0, 0, 0, 0.65, 0, 0, 0, 0, 0, 0.9, 2, 1.5, 1, 0];

function pinkBombExplode(b, out, box, giant) {
  Snd.play(giant ? 'explosionmmx' : 'boardbomb', giant ? 0.8 : 0.5);   // obj_fusebomb_big: snd_explosion_mmx
  if (typeof Battle !== 'undefined') { Battle.shake = Math.max(Battle.shake || 0, giant ? 16 : 12); Battle.flash = Math.max(Battle.flash || 0, 6); }
  const step = giant ? 48 : 24, sc = giant ? PS(8) : PS(2), rr = giant ? 46 : 13;   // giant arm is 3 lanes thick (~±46); overlaps 48px step -> contiguous
  const explAnim = Array.from({ length: 16 }, (_, i) => 'bombexpl' + i);   // spr_fusebomb_explosion_1: 16-frame blast
  out.push({ ...bulletProps('bombexpl0'), animKeys: explAnim, animRate: 1, x: b.x, y: b.y, vx: 0, vy: 0, r: giant ? 46 : 11, scale: giant ? PS(8) : PS(2.2), life: 16, dmg: b.dmg, _pinkBoom: 1 });
  for (const [dx, dy] of [[step, 0], [0, -step], [-step, 0], [0, step]]) {
    let px = b.x, py = b.y;
    for (let s = 0; s < 30; s++) {
      px += dx; py += dy;
      if (px < -48 || px > 688 || py < 20 || py > 520) break;
      // rectangular hitbox on each arm (hitW/hitH) so the whole 3-lane row/column is a reliable kill band
      const horiz = dx !== 0;
      out.push({ ...bulletProps('bombexpl0'), animKeys: explAnim, animRate: 1, x: px, y: py, vx: 0, vy: 0, r: rr, scale: sc, life: 16, dmg: b.dmg, _pinkBoom: 1,
                 hitW: giant ? (horiz ? 50 : 96) : undefined, hitH: giant ? (horiz ? 96 : 50) : undefined,
                 rot: Math.atan2(dy, dx) + Math.PI / 2 });
    }
  }
  // the cross CHAIN-detonates other landed bombs (fuse=min(fuse,3)) + destroys settled hearts in its path
  if (typeof Battle !== 'undefined' && Battle.bullets) {
    const th = giant ? 64 : 20;
    for (const o of Battle.bullets) {
      const onCross = Math.abs(o.x - b.x) < th || Math.abs(o.y - b.y) < th;
      if (o._pinkBomb && o !== b && o._land >= 0 && (o.t - o._land) >= 10 && onCross) o._fuse = Math.min(o._fuse, 3);
      if (o.pickup && o.t >= 30 && Math.abs(o.vx) + Math.abs(o.vy) < 0.3 && onCross && Math.hypot(o.x - b.x, o.y - b.y) > 10) o.dead = true;
    }
  }
  if (b._heart) {
    if (!giant) out.push({ ...bulletProps('pdoki'), x: b._dx, y: b._dy, vx: 0, vy: 0, pickup: true, tp: 2, doki: 2, r: 8, scale: PS(1.5), life: 150 });
    else {   // giant has_heart sprays hearts along the row+column every 2 lanes, drifting (obj_fusebomb_big)
      let alt = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let s = 0; s <= 3; s += 2) {
        const hx = b._dx + dx * 40 * s, hy = b._dy + dy * 40 * s;
        if (hx > box.x && hx < box.x + box.w && hy > box.y && hy < box.y + box.h) {
          const drift = [0, 2.9, -2.9][alt++ % 3];
          out.push({ ...bulletProps('pdoki'), x: hx, y: hy, vx: dy !== 0 ? drift : 0, vy: dx !== 0 ? drift : 0, fric: 0.1, pickup: true, tp: 2, doki: 2, r: 8, scale: PS(1.5), life: 150 });
        }
      }
    }
  }
}

function mkPinkBomb(add, box, dest, x0, y0, o) {
  const giant = !!o.giant;
  const b = { ...bulletProps(giant ? 'fusebombbig0' : 'fusebomb4'), x: x0, y: y0, vx: 0, vy: 0, noHit: true,
              scale: PS(2), _pinkBomb: 1, _giant: giant, _air: 1, _fuse: o.fuse, _heart: !!o.heart, _dx: dest.x, _dy: dest.y,
              _x0: x0, _y0: y0, _land: -1, _pt: 0, _sc: 2, dmg: o.dmg, life: 900 };
  if (b._heart) { b.tint = '#ff6699'; b.tintMul = true; }   // has_heart bombs are PINK (GML image_blend)
  b.emit = function (b, out, soul, box2, fx) {
    // ---- AIRBORNE: 22-tick arc to the cell + the flashing landing-ring telegraph (obj_fusebomb Draw) ----
    if (b._air > 0) {
      b._air = Math.max(0, b._air - ((giant ? 4.48 : 5.12) / 110));
      const a = b._air, p = 1 - a;
      b.x = b._dx * p + b._x0 * a; b.y = b._dy * p + b._y0 * a - Math.sin(p * Math.PI) * 110;
      if (!b._ring) { b._ring = { shape: 'ring', noHit: true, x: b._dx, y: b._dy, vx: 0, vy: 0, ringR: 0, fillR: 0, life: 900 }; out.push(b._ring); }
      b._ring.ringR = (1 - a * a * a * a) * 14; b._ring.fillR = (p / 2 + (p * p) / 2) * 16;
      b._ring.color = (b.t % 5) < 2 ? '#ffbb00' : '#880000';
      if (b._air <= 0) { b._land = b.t; b.x = b._dx; b.y = b._dy; b._ring.dead = true; b._ring = null; Snd.play('boardbomb', 0.1); }
      return;
    }
    const sl = b.t - b._land;
    b.drawDY = sl >= 1 && sl <= 4 ? [-4, -5, -5, -4][sl - 1] : 0;   // landing bounce (GML frames_since_airtime)
    b._fuse--;
    const fu = b._fuse;
    // ---- ROW/COLUMN TELEGRAPH (obj_fusebomb_big Draw: red danger bands fading in over the last warn_time=30) ----
    if (fx && fx.bombWarn && fu > 0) {
      if (giant && fu < 30) {
        const yellow = fu >= 23 && fu < 25;                        // brief yellow flash (warn_time-7..-5)
        const alpha = 0.2 + (1 - fu / 30) * 0.28, col = yellow ? '#ffcc00' : '#c00000';
        if (fu >= 25) fx.bombWarn.push({ x: b.x, y: b.y, ellipse: (30 - fu) * 42, thick: 54, alpha, color: col });   // expanding-ellipse cross
        else fx.bombWarn.push({ x: b.x, y: b.y, thick: 54 - (fu % 2) * 4, alpha, color: col });                      // full row + column bands
      } else if (!giant && fu < 18) {                              // small bombs: a thin fairness telegraph (added, not in GML)
        fx.bombWarn.push({ x: b.x, y: b.y, thick: 7, alpha: (1 - fu / 18) * 0.32, color: '#c00000' });
      }
    }
    if (!giant) {
      b.img = bulletProps('fusebomb' + Math.max(0, Math.min(4, Math.floor(fu / 10)))).img;   // fuse burn-down frames
      if (fu > 8) {   // periodic pulse decaying toward x2 (pulse every 15, every 6 once fuse<=36)
        b._pt++;
        if (b._pt >= 15 || (b._pt >= 6 && fu <= 36)) { b._pt = 0; b._sc = 2.75; }
        b._sc = Math.max(2, 2 + (b._sc - 2) * 0.8 - 0.01);
        b.scale = PS(b._sc); b.sx = 1;
      } else {        // the final 8-tick swell with squash/stretch (exact GML table)
        const T = [[4, 1.1], [4, 1.1], [4, 1.1], [3.9, 1.05], [3.75, 1], [3.5, 1], [3.25, 0.9], [3, 0.8], [2.25, 0.9]];
        const e = T[Math.max(0, Math.min(8, fu))]; b.scale = PS(e[0]); b.sx = e[1];
      }
      const flash = (fu === 22 || fu === 23) || (fu < 16 && (fu % 4) < 2);
      if (b._heart) { b.tint = flash ? '#880000' : '#ff6699'; b.tintMul = !flash; }
      else if (flash) { b.tint = fu < 8 ? '#ff6600' : '#ffbb00'; b.tintMul = false; }
      else b.tint = null;
    } else {
      b.scale = PS(2 + 0.5 / Math.max(1, fu / 3));   // giant swells as the fuse dies
      const flash = (fu >= 24 && fu < 27) || (fu >= 14 && fu < 17) || (fu >= 8 && fu < 10) || ((fu % 2) === 0 && fu < 8);
      if (b._heart) { b.tint = flash ? '#880000' : '#ff6699'; b.tintMul = !flash; }
      else if (flash) { b.tint = fu < 8 ? '#ff6600' : '#ffbb00'; b.tintMul = false; }
      else b.tint = null;
    }
    // ---- SOUL CONTACT = instant detonation (GML: fuse_time = min(fuse_time, 1)) ----
    if (sl >= 5 && soul && Math.hypot(soul.x - b.x, soul.y - b.y) < (giant ? 34 : 19)) b._fuse = Math.min(b._fuse, 1);
    if (b._fuse <= 0 && !b._done) { b._done = 1; b.dead = true; pinkBombExplode(b, out, box, giant); }
  };
  add(b);
}

function mkPinkSlideBomb(add, box, o) {   // FINALE (obj_pink_battlemovement): Pink RUNS in from the LEFT, CHARGES
  // (holds the throw-bomb pose with escalating snd_pink_trip), THROWS a giant bomb at the box centre, RUNS off.
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const ctrl = { noHit: true, x: box.x - 130, y: cy, vx: 0, vy: 0, r: 0, life: 500, _ph: 0, _t: 0, _thrown: false };
  ctrl.emit = function (b, out, sl, box2, fx) {
    b._t++;
    if (b._ph === 0) {                                   // RUN IN from the left (spr_pink_run)
      b.x += 6; fx.pinkFinale = { x: b.x, y: b.y, pose: 'run', flip: false, f: b._t };
      if (b.x >= box.x - 46) { b._ph = 1; b._t = 0; }
    } else if (b._ph === 1) {                            // CHARGE: hold + escalating trip sounds (Step L1131-1153)
      const beats = [20, 46, 68, 86, 100, 112]; if (beats.indexOf(b._t) >= 0) Snd.play('pinktrip', 0.5);
      const shk = b._t > 20 ? (((b._t * 73) % 7) - 3) * Math.min(1, (b._t - 20) / 40) : 0;
      fx.pinkFinale = { x: b.x + shk, y: b.y, pose: 'charge', flip: false, f: b._t };
      if (b._t === 58 && !b._thrown) {                   // THROW the giant bomb (fuse 120) at the box centre
        b._thrown = true; Snd.play('pinkthrow2', 0.5);
        mkPinkBomb(bb => out.push(bb), box, { x: cx, y: cy }, b.x + 20, b.y - 18, { fuse: 120, giant: true, dmg: o.dmg });
      }
      if (b._t > 128) { b._ph = 2; b._t = 0; }
    } else {                                             // RUN OFF to the right
      b.x += 8; fx.pinkFinale = { x: b.x, y: b.y, pose: 'run', flip: false, f: b._t };
      if (b.x > box.x + box.w + 140) b.dead = true;
    }
  };
  add(ctrl);
}

function pinkBombPattern(chart) {
  const sched = []; let t = 8, volleys = 0;
  // GML round(0.5) = 0 (banker's): interval-0 commands queue the SAME frame — that's what forms volleys
  for (let k = 0; k < chart.length; k += 2) { sched.push({ f: t, cmd: chart[k] }); if (chart[k + 1] > 0) volleys++; t += chart[k + 1] === 0 ? 0 : Math.max(1, Math.round(0.5 + 58 * chart[k + 1])); }
  return {
    // the OVERLAP GUARD freezes the schedule while a batch is on the board, so the real playtime is longer
    // than the raw schedule: pad the duration by ~110 frames per volley so the final volley/finale resolves.
    // generous cap; the real end is fx.attackDone (2s after the last blast, set in the tick)
    box: { w: 150, h: 150 }, hz30: 1, dur: t + 500 + volleys * 140,
    tick(a) {
      const { f, box, add, rng, soul } = a; a.fx.purpleSoul = { mode: 2, diff: 0 };
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const cell = (gx, gy) => ({ x: cx + (gx - 1.5) * 40, y: cy + (gy - 1.5) * 40 });
      const ir = n => Math.floor(rng() * (n + 1));
      const pick = (...xs) => xs[Math.floor(rng() * xs.length)];
      if (f === 0) this._S = { si: 0, queue: [], doki: 3, gx: ir(3), gy: ir(3), pv: ir(3), rep: 0, wind: -1, hold: 0, cool: 0 };
      const S = this._S;
      // ---- OVERLAP GUARD: never START the next volley while the previous batch's bombs are still LANDED &
      // FUSING. The moment they DETONATE we release, so the next volley winds up immediately (its bomb arcs in
      // while the explosion finishes) — no dead time, but never a throw mid-fuse. ----
      const bl = (typeof Battle !== 'undefined' && Battle.bullets) ? Battle.bullets : [];
      const liveBatch = bl.some(b => b._pinkBomb && !b.dead && b._land >= 0);   // only UN-detonated landed bombs
      const frozen = (S.queue.length === 0) && liveBatch;
      if (frozen) { S.hold++; }
      // ---- controller: play the chart, queueing bombs for Pink ----
      while (!frozen && S.si < sched.length && (sched[S.si].f + S.hold) <= f) {
        const cmd = sched[S.si++].cmd;
        if (cmd === 0) { if (!S.queue.length) S.doki = 0; S.queue.push({ k: 0 }); S.doki++; }
        else if (cmd === 2) S.queue.push({ k: 1 });
        else if (cmd === 4) S.queue.push({ k: 3 });
        else if (cmd === 3) {   // 4-giant volley: exact XY pattern + reflect/rotate (obj_dbulletcontroller)
          let xy; const pat = pick(0, 0, 1, 1, 2);
          if (pat === 0) { const r1 = 3 + ir(1), r0 = Math.max(-1, r1 - 4 - ir(1)); xy = [[-2, r0], [-2, r1], [1 + ir(2), -2], [5, r1]]; }
          else if (pat === 1) { const r2 = 1 + ir(1), r1 = 3 + ir(1), r0 = Math.max(-1, r1 - 4 - ir(1)); xy = [[-2, r0], [5, r1], [r2, -2], [r2, 4]]; }
          else xy = [[-2, -1], [4, -2], [5, 4 - pick(0, 1, 1)], [-1 + pick(0, 1, 1), 5]];
          const ord = [0, 1, 2, 3].sort(() => rng() - 0.5);
          const xs = ir(1) ? -1 : 1, xo = xs < 0 ? 3 : 0, ys = ir(1) ? -1 : 1, yo = ys < 0 ? 3 : 0, xr = ir(1);
          const kinds = [[4, 2, 2, 2], [2, 4, 2, 2], [2, 2, 4, 2], [2, 2, 2, 4]][ir(3)];
          for (let i = 0; i < 4; i++) {
            const p = xy[ord[i]];
            S.queue.push({ k: 2, heart: kinds[i] === 4, gx: xo + xs * p[xr ? 1 : 0], gy: yo + ys * p[xr ? 0 : 1] });
          }
        }
      }
      // ---- Pink's thrower (mode 5): volley pickup -> positions -> paced throws ----
      if (S.wind < 0 && S.queue.length) {
        const smalls = S.queue.filter(q => q.k === 0).length;
        if (S.queue[0].k === 0) {
          if (smalls === 1) S.doki = 2;
          if (smalls >= 4) {   // PLUS around a centre cell, shuffled
            S.gx = S.gx === 1 ? 2 : S.gx === 2 ? 1 : 1 + ir(1);
            S.gy = S.gy === 1 ? 2 : S.gy === 2 ? 1 : 1 + ir(1);
            const pos = [[S.gx, 0], [S.gx, 3], [0, S.gy], [3, S.gy]].sort(() => rng() - 0.5);
            let pi = 0; for (const q of S.queue) if (q.k === 0 && pi < 4) { q.gx = pos[pi][0]; q.gy = pos[pi][1]; pi++; }
          } else {             // walk pattern: (±1,±2)/(±2,±1) hops wrapping mod 4
            if (smalls <= 3) S.pv = ir(3);
            for (const q of S.queue) if (q.k === 0 && q.gx == null) {
              q.gx = S.gx; q.gy = S.gy;
              if (ir(1) === 1) { S.gx += S.pv < 2 ? 2 : -2; S.gy += S.pv % 2 === 0 ? 1 : -1; }
              else { S.gx += S.pv < 2 ? 1 : -1; S.gy += S.pv % 2 === 0 ? 2 : -2; }
              S.gx = ((S.gx % 4) + 4) % 4; S.gy = ((S.gy % 4) + 4) % 4;
            }
          }
        }
        S.wind = S.rep <= 0 ? 20 : S.rep <= 3 ? 18 : 16;   // windup speeds up per repeat (GML anim rates)
      }
      if (S.wind > 0) S.wind--;
      else if (S.wind === 0 && S.queue.length) {
        const q = S.queue.shift(), left = S.queue.length;
        const tx = box.x + box.w + 58, ty = box.y - 46;   // thrown from Pink (right of the box)
        if (q.k !== 1 && q.k !== 3) Snd.play(rng() < 0.5 ? 'pinkthrow' : 'pinkthrow2', 0.4);   // snd_pink_throw(2)
        if (q.k === 0) {
          S.doki--; const heart = S.doki <= 0; if (heart) S.doki = 2;
          mkPinkBomb(add, box, cell(q.gx, q.gy), tx, ty, { fuse: 54 + left * 2 - S.rep * 2, heart, dmg: 50 });
        } else if (q.k === 1) {   // GIANT ENDER: sits OUTSIDE an edge and blasts one 3-lane band into the box (leaving an outer safe lane)
          const edge = pick(0, 1, 2, 3), lane = 1 + ir(1);
          const gp = edge === 0 ? [-2, lane] : edge === 1 ? [5, lane] : edge === 2 ? [lane, -2] : [lane, 5];
          mkPinkBomb(add, box, cell(gp[0], gp[1]), tx, ty, { fuse: 60, giant: true, dmg: 50 });
        }
        else if (q.k === 2) mkPinkBomb(add, box, cell(q.gx, q.gy), tx, ty, { fuse: 52 + left * 3, giant: true, heart: q.heart, dmg: 50 });
        else if (q.k === 3) mkPinkSlideBomb(add, box, { fuse: 120, dmg: 50, wspd: pick(3.85, 4.725, 5.15, 5.95) });
        S.wind = S.queue.length ? 6 : -1;
        if (!S.queue.length) S.rep++;
      } else if (!S.queue.length) S.wind = -1;
      // END: once the chart is done, the queue is empty, and NO bomb is still live, wait ~2s then wrap up
      const anyLive = bl.some(b => b._pinkBomb && !b.dead);
      if (S.si >= sched.length && S.queue.length === 0 && S.wind < 0 && !anyLive) {
        S.endT = (S.endT || 0) + 1; if (S.endT >= 60) a.fx.attackDone = true;   // 60 @30Hz = 2s after the last blast
      } else S.endT = 0;
    },
  };
}

// ===== PINK V3 — promote the verified V2 box attacks onto the real STAGE SCENE =====
// Charts/mechanics were confirmed exact in V2 (cats/bombs/plusgrid/tunnel/concert); the V3 uplift
// is that they now render on the actual Pink stage (MEWERS LIVE + dancers + petals) via fx.pinkScene
// instead of the default battle bg. Wrap each so it flags the scene, keeping the V2 logic intact.
function withPinkScene(p) { return Object.assign({}, p, { tick(a) { a.fx.pinkScene = true; return p.tick.call(this, a); } }); }
PATTERNS.pink_cats      = withPinkScene(pinkCatsPattern(PINK_CATS_D0));
PATTERNS.pink_cats2     = withPinkScene(pinkCatsPattern(PINK_CATS_D1));
PATTERNS.pink_bombs     = withPinkScene(pinkBombPattern(PINK_BOMB_D0));
PATTERNS.pink_bombs2    = withPinkScene(pinkBombPattern(PINK_BOMB_D1));
PATTERNS.pink_bombsg    = withPinkScene(pinkBombPattern(PINK_BOMB_D3));
PATTERNS.pink_bombsfin  = withPinkScene(pinkBombPattern(PINK_BOMB_D2));
PATTERNS.pink_plusgrid  = withPinkScene(pinkPlusGridPattern(PINK_PLUS_D0, false));
PATTERNS.pink_plusgrid2 = withPinkScene(pinkPlusGridPattern(PINK_PLUS_D2, false));
PATTERNS.pink_rotbox    = pinkRotboxD1Pattern();   // its own scrolling parallax backdrop (fx.pinkRoll)
PATTERNS.pink_tunnel    = withPinkScene(pinkTunnelPattern);
PATTERNS.pink_concert   = withPinkScene(pinkConcertPattern(0));
PATTERNS.pink_concert2  = withPinkScene(pinkConcertPattern(1));   // hard concert (haters), phase-2 variant

// ===== PINK V3 (pink_*) — from-scratch rebuild on the real STAGE SCENE =====
// pink_scene: scenery-layer verification stub (MEWERS LIVE + dancers + petals, no bullets).
PATTERNS.pink_scene = { box: { w: 180, h: 140 }, hz30: 1, dur: 900, tick(a) { a.fx.pinkScene = true; } };

// obj_pinkcatbullet: the cat FACE bullet (spr_bullet_catface, 4-frame anim at image_speed 0.334, scale 2).
// It ANIMATES through its frames and does NOT rotate (spin_dir is a movement spiral, not sprite rotation).
function catP() { return { ...bulletProps('catface'), animKeys: ['catface0', 'catface1', 'catface2', 'catface3'], animRate: 3 }; }
function bulletProps(bid, r) {
  if (bid === 'crescent' || bid === 'star' || bid === 'note') {
    const col = bid === 'crescent' ? '#fff' : bid === 'star' ? '#7fff9f' : '#ff9fff';
    return { shape: bid, color: col, r: r || 8 };
  }
  const info = (A.manifest.bullets || {})[bid];
  const img = A.img['assets/bullets/' + (info ? info.f : '')];
  // hitbox kept below the visual so bullets are graze-friendly, not "bullshit"
  const rad = info ? Math.max(4, Math.min(12, Math.max(info.w, info.h) * 0.42)) : 6;
  return { img, r: r || rad, scale: 1.0 };
}

function emSpeedV(x) { return (SPEEDS[x] || SPEEDS.normal).v; }
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

// combined dodge: overlay several attackers' patterns in one box, thinned so
// a 3-way volley is fair (~1.6x a single, not 3x). Each bullet is tagged with
// its source attacker's per-hit damage (b.dmg). attackers: [{def,moveDef,tier,seed}]
function makeCombinedSim(attackers, box) {
  const N = attackers.length;
  const keep = 1 / (1 + 0.55 * Math.max(0, N - 1));
  const subs = attackers.map(a => ({
    sim: makeDodgeSim(a.def, a.moveDef, a.tier, a.seed, box),
    dmg: Math.round(a.moveDef.dmg * TIER_MULT[a.tier == null ? 1 : a.tier]),
    target: a.target || 0,
    rng: mulberry32(((a.seed || 1) ^ 0x9e3779b9) >>> 0),
  }));
  const dur = Math.max(...subs.map(s => s.sim.dur));
  return {
    f: 0, dur,
    tick(soul, add, fx) {
      for (const s of subs) {
        if (this.f >= s.sim.dur) continue;
        s.sim.tick(soul, b => { if (N === 1 || s.rng() < keep) { b.dmg = s.dmg; b.target = s.target; add(b); } }, fx);
      }
      this.f++;
    },
  };
}

// ---------- bullet simulation ----------
function makeDodgeSim(attackerDef, moveDef, tier, seed, box) {
  const rng = mulberry32(seed);
  const pattern = moveDef.custom
    ? customPattern({ ...moveDef.custom, dur: moveDef.dur })
    : PATTERNS[moveDef.id];
  const imgs = imgsOf(attackerDef.base);
  return {
    bullets: [], f: 0, dur: pattern.dur,
    // `fx` is the engine control channel: patterns set flags on it (blackout, box warp,
    // soul pull, screen arena, board split) and Battle.updDodge applies them each frame.
    tick(soul, add, fx) {
      pattern.tick({ f: this.f, rng, box, tier, soul, add, imgs, fx: fx || {} });
      this.f++;
    },
  };
}
