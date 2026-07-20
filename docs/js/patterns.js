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

// ---------- KRIS (sword slashes: left / right / middle, randomized) ----------
PATTERNS.kris_slash = {
  dur: 440,
  tick(api) {
    const { f, rng, box, tier, add } = api;
    const period = rate(40, tier);
    if (f % period === 0) {
      const lane = Math.floor(rng() * 3);       // 0=left 1=right 2=middle, randomized
      const n = 3 + Math.floor(rng() * 2);      // 3-4 knives per slash, count randomized
      if (lane === 2) {                          // MIDDLE: slash cuts straight down the centre
        for (let i = 0; i < n; i++)
          add({ ...bulletProps('knife'), x: box.x + box.w * (0.25 + 0.5 * (n > 1 ? i / (n - 1) : 0.5)),
                y: box.y - 26 - i * 6, vx: 0, vy: 2.4 + rng() * 0.5, rot: 0, spin: 0.3, r: 7 });
      } else {                                    // LEFT/RIGHT: slash sweeps across, blade-first
        const left = lane === 0;
        const y0 = box.y + 12 + rng() * Math.max(6, box.h - 24 - n * 12);
        for (let i = 0; i < n; i++)
          add({ ...bulletProps('knife'), x: left ? box.x - 30 - i * 8 : box.x + box.w + 30 + i * 8,
                y: y0 + i * 12, vx: (left ? 1 : -1) * (2.4 + rng() * 0.5), vy: 0,
                rot: left ? Math.PI / 2 : -Math.PI / 2, spin: 0.32, r: 7 });
      }
    }
  },
};
PATTERNS.kris_cross = {
  dur: 480,
  tick(api) {
    const { f, rng, box, tier, add } = api;
    // rotating cross of knives converging on center — safe gaps keep moving
    if (every(f, rate(42, tier))) {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const R = Math.max(box.w, box.h) / 2 + 40;
      const base = f * 0.06;
      for (let k = 0; k < 4; k++) {
        const a = base + k * (Math.PI / 2);
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        const toC = Math.atan2(cy - y, cx - x);
        add({ ...bulletProps('knife'), x, y, vx: Math.cos(toC) * 2.4, vy: Math.sin(toC) * 2.4,
              rot: toC + Math.PI / 2, spin: 0.28, r: 7 });
      }
    }
  },
};
PATTERNS.kris_giga = {
  dur: 560,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(24, tier))) {
      const y = box.y + 8 + rng() * (box.h - 16);
      const fromLeft = rng() < 0.5;
      add({
        ...bulletProps('knife'), x: fromLeft ? box.x - 30 : box.x + box.w + 30, y,
        vx: (fromLeft ? 1 : -1) * (2.4 + rng() * 1.2), vy: 0,
        rot: fromLeft ? Math.PI / 2 : -Math.PI / 2, spin: 0.4, r: 8,
      });
    }
    if (every(f, rate(56, tier))) {
      // guillotine knife drops near the soul
      const x = api.soul.x + (rng() - 0.5) * 90;
      add({
        ...bulletProps('knife'), x, y: box.y - 30, vx: 0, vy: 0.4, ay: 0.1, maxv: 4.8,
        rot: 0, spin: 0.2, r: 8,
      });
    }
  },
};

// ---------- SUSIE ----------
// (hitboxes are deliberately smaller than the big arc visuals -> graze-friendly)
PATTERNS.susie_axe = {   // axes thrown across the box in varied patterns (Susie+Lancer style)
  dur: 420,
  tick(api) {
    const { f, rng, box, tier, add } = api;
    const period = rate(34, tier);
    if (f % period === 0) {
      const mode = Math.floor(rng() * 3);
      if (mode === 0) {                 // sweep of axes straight across
        const left = rng() < 0.5;
        for (let i = 0; i < 3; i++)
          add({ ...bulletProps('axe'), x: left ? box.x - 40 - i * 18 : box.x + box.w + 40 + i * 18,
                y: box.y + 14 + rng() * (box.h - 28), vx: (left ? 1 : -1) * (2.6 + rng() * 0.5),
                vy: (rng() - 0.5) * 0.4, r: 8, spin: left ? 0.16 : -0.16 });
      } else if (mode === 1) {          // lobbed axe arcs up from the bottom
        for (let i = 0; i < 2; i++)
          add({ ...bulletProps('axe'), x: box.x + 20 + rng() * (box.w - 40), y: box.y + box.h + 20,
                vx: (rng() - 0.5) * 1.6, vy: -(3 + rng()), ay: 0.06, r: 8, spin: 0.25 });
      } else {                          // spinning axes drop from both top corners
        for (const lx of [box.x - 20, box.x + box.w + 20])
          add({ ...bulletProps('axe'), x: lx, y: box.y - 20,
                vx: (lx < box.x ? 1 : -1) * 1.6, vy: 1.7, r: 8, spin: 0.3 });
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
    // spiral galaxy of sparkles from the center
    if (every(f, rate(9, tier))) {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2, ang = f * 0.3;
      for (let k = 0; k < 2; k++) {
        const a = ang + k * Math.PI;
        add({ ...bulletProps('ralseidot'), x: cx, y: cy,
              vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5,
              ax: Math.cos(a) * 0.012, ay: Math.sin(a) * 0.012, r: 6 });
      }
    }
  },
};

// ---------- NOELLE ----------
PATTERNS.noelle_snow = {
  dur: 420,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(30, tier))) {
      add({
        x: box.x + rng() * box.w, y: box.y - 24,
        vx: (rng() - 0.5) * 1.2, vy: 0.8 + rng() * 0.9, ay: 0.012,
        ...bulletProps('icehex'), r: 7,
        sineA: 0.5, sineF: 0.05,
      });
    }
    if (every(f, rate(90, tier))) {
      add({
        x: rng() < 0.5 ? box.x - 26 : box.x + box.w + 26, y: box.y + rng() * box.h,
        vx: 0, vy: 0, homing: 0.045, maxv: 2.0,
        ...bulletProps('icesnow'), r: 9, spin: 0.05,
      });
    }
  },
};
PATTERNS.noelle_ice = {
  dur: 500,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(34, tier))) {
      // falling icicles with slight aim
      const x = rng() < 0.4 ? api.soul.x + (rng() - 0.5) * 70 : box.x + rng() * box.w;
      add({
        x, y: box.y - 34, vx: 0, vy: 0.5, ay: 0.11, maxv: 5,
        ...bulletProps('icehex'),
      });
    }
    if (every(f, rate(46, tier))) {
      // shards bounce up from impact line
      add({
        x: box.x + rng() * box.w, y: box.y + box.h + 12,
        vx: (rng() - 0.5) * 2.0, vy: -(1.8 + rng() * 1.4), ay: 0.06,
        ...bulletProps('icehex'), scale: 0.8, r: 5, spin: 0.15,
      });
    }
  },
};
PATTERNS.snowgrave = {
  dur: 600,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(22, tier))) {
      // blizzard walls: horizontal streams alternating gaps
      const lane = Math.floor(rng() * 6);
      add({
        x: box.x + box.w + 30, y: box.y + (lane + 0.5) * (box.h / 6),
        vx: -(2.2 + rng() * 1.4), vy: 0,
        ...bulletProps('icesnow'), scale: 0.8, r: 6,
      });
    }
    if (every(f, rate(50, tier))) {
      add({
        x: box.x + rng() * box.w, y: box.y - 30, vx: 0, vy: 0.4, ay: 0.1, maxv: 5.5,
        ...bulletProps('icehex'), scale: 1.1, r: 9,
      });
    }
    if (every(f, rate(120, tier))) {
      // the giant snowflake: slow homing menace
      add({
        x: rng() < 0.5 ? box.x - 50 : box.x + box.w + 50,
        y: box.y - 40, homing: 0.03, maxv: 1.6, vx: 0, vy: 0.8,
        ...bulletProps('icesnow'), scale: 1.5, r: 14, spin: 0.03,
      });
    }
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
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(18, tier))) {
      add({
        x: box.x + rng() * box.w, y: box.y - 22,
        vx: (rng() - 0.5) * 0.6, vy: 1.6 + rng() * 1.5,
        img: rng() < 0.5 ? pick(rng, imgs.spadeW) : pick(rng, imgs.spadeP),
        scale: 1.3, r: 7, spin: (rng() - 0.5) * 0.2,
      });
    }
  },
};
PATTERNS.lancer_bike = {
  dur: 480,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    const period = rate(85, tier);
    if (every(f, period)) {
      // bike crossing at soul height, spraying spades behind it
      const fromLeft = (Math.floor(f / period) % 2) === 0;
      add({
        x: fromLeft ? box.x - 60 : box.x + box.w + 60,
        y: api.soul.y,
        vx: (fromLeft ? 1 : -1) * 3.6, vy: 0,
        img: pick(rng, imgs.bike), scale: 1.6, r: 13, flip: !fromLeft,
        trail: 'spade',
      });
    }
    if (every(f, rate(50, tier))) {
      add({
        x: box.x + rng() * box.w, y: box.y + box.h + 14,
        vx: 0, vy: -(1.4 + rng() * 1.2),
        img: pick(rng, imgs.spadeP), scale: 1.2, r: 6,
      });
    }
  },
};
PATTERNS.lancer_ult = {
  dur: 560,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(14, tier))) {
      // devilsknife spiral from center
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const a = f * 0.23;
      add({
        x: cx, y: cy, vx: Math.cos(a) * 2.0, vy: Math.sin(a) * 2.0,
        img: pick(rng, imgs.spadeW), scale: 1.4, r: 7, spin: 0.2,
      });
    }
    if (every(f, rate(95, tier))) {
      const fromLeft = rng() < 0.5;
      add({
        x: fromLeft ? box.x - 60 : box.x + box.w + 60, y: box.y + rng() * box.h,
        vx: (fromLeft ? 1 : -1) * 3.2, vy: 0,
        img: pick(rng, imgs.bike), scale: 1.6, r: 13, flip: !fromLeft,
      });
    }
  },
};

// ---------- custom pattern factory (character creator attacks) ----------
// spec: {ptype, bullet, speed, ult} — bullet is a library id or a shape name.
// ---------- BERDLY (wind, A+ papers, halberd lasers) ----------
PATTERNS.berdly_fight = {   // basic HALBERD swings: telegraphed slashes, easy (free attack)
  dur: 420,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(40, tier))) {          // a slow halberd slash sweeps across at one height
      const y = box.y + 20 + rng() * (box.h - 40);
      for (let i = 0; i < 2; i++)
        add({ ...bulletProps('spear'), x: box.x + box.w + 24 + i * 22, y,
              vx: -(2.1 + rng() * 0.4), vy: 0, rot: Math.PI, r: 7 });
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
PATTERNS.berdly_books = {   // Halberd Laser: wavy energy beam + perpendicular scatter
  dur: 480,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(16, tier)))       // curved energy beam sweeps in from the right
      add({ ...bulletProps('spear'), x: box.x + box.w + 20, y: box.y + 18 + rng() * (box.h - 36),
            vx: -(2.6 + rng()), vy: 0, rot: Math.PI, sineA: 1.4, sineF: 0.06, r: 7 });
    if (every(f, rate(46, tier)))       // scattered energy shards perpendicular to the trail
      add({ ...bulletProps('spear'), x: box.x + box.w * (0.3 + rng() * 0.5), y: box.y - 16,
            vx: (rng() - 0.5) * 0.6, vy: 1.9 + rng(), rot: Math.PI / 2, r: 7 });
  },
};
PATTERNS.berdly_ult = {   // SMART RACE: center-converging tornadoes + doubled papers
  dur: 560,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (every(f, rate(50, tier))) {     // 4 corner tornadoes collapse to center + cross
      const cn = [[box.x - 24, box.y - 24], [box.x + box.w + 24, box.y - 24],
                  [box.x - 24, box.y + box.h + 24], [box.x + box.w + 24, box.y + box.h + 24]];
      for (const [x, y] of cn) {
        const ang = Math.atan2(cy - y, cx - x);
        add({ ...bulletProps('tornado'), x, y, vx: Math.cos(ang) * 2.2, vy: Math.sin(ang) * 2.2, spin: 0.3, r: 9 });
      }
    }
    if (every(f, rate(18, tier)))       // doubled A+ papers streaming from the right
      add({ ...bulletProps('feather'), x: box.x + box.w + 20, y: box.y + 14 + rng() * (box.h - 28),
            vx: -(3 + rng()), vy: (rng() - 0.5) * 1.2, rot: Math.PI, spin: 0.03, r: 7 });
  },
};

// ---------- JEVIL (darkner secret boss - Difficult) ----------
PATTERNS.jevil_spade = {   // Five-Spade Teleport Spread: middle aimed at soul, ±15°/±30°
  dur: 440,
  tick(a) {
    const { f, rng, box, tier, add, soul } = a;
    if (every(f, rate(38, tier))) {   // teleport, then 5-way spread w/ ±15°/±30° offsets (spec)
      const left = rng() < 0.5;
      const ox = left ? box.x - 18 : box.x + box.w + 18;
      const oy = box.y + 16 + rng() * (box.h - 32);
      const base = Math.atan2(soul.y - oy, soul.x - ox);
      for (const o of [-0.52, -0.26, 0, 0.26, 0.52])
        add({ ...bulletProps('spade'), x: ox, y: oy,
              vx: Math.cos(base + o) * 2.6, vy: Math.sin(base + o) * 2.6, spin: 0.2, r: 7 });
    }
  },
};
PATTERNS.jevil_diamond = {   // Rising Diamond Shower: fast diamonds up near the soul's X (spec)
  dur: 500,
  tick(a) {
    const { f, rng, box, tier, add, soul } = a;
    if (every(f, rate(12, tier))) {  // spawn near the soul's X, rise fast w/ slight drift
      const x = Math.max(box.x + 6, Math.min(box.x + box.w - 6, soul.x + (rng() - 0.5) * 80));
      add({ ...bulletProps('bdiamond'), x, y: box.y + box.h + 18, vx: 0, vy: -(3.3 + rng() * 0.8), sineA: 0.5, sineF: 0.1, spin: 0.1, r: 8 });
    }
    if (every(f, rate(120, tier)))    // heart bomb falls, detonates into 4 rotating hearts
      add({ ...bulletProps('bheart'), x: box.x + 30 + rng() * (box.w - 60), y: box.y - 18,
            vx: 0, vy: 1.5, r: 9, burst: 46, burstN: 4, burstSpeed: 1.7, burstRot: 0.78 });
  },
};
PATTERNS.jevil_carousel = {   // The Carousel: 3 rows L->R, sine bob w/ alternating phase + club bombs
  dur: 520,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    const spawn = rate(30, tier);
    if (f % spawn === 0) {
      const col = f / spawn;
      for (let row = 0; row < 3; row++) {
        const baseY = box.y + 22 + row * (box.h - 44) / 2;
        const phase = ((row + col) % 2) * Math.PI;   // adjacent horses/ducks bob opposite
        add({ ...bulletProps('carousel'), x: box.x - 22, y: baseY,
              vx: 1.5, vy: 0, sineA: 8, sineF: 0.05, phase0: phase, r: 9 });
      }
    }
    if (every(f, rate(150, tier)))   // club bomb drops + bursts into a spread
      add({ ...bulletProps('bclub'), x: box.x + 30 + rng() * (box.w - 60), y: box.y - 16,
            vx: 0, vy: 1.6, r: 9, burst: 40, burstN: 6, burstSpeed: 2.0 });
  },
};
PATTERNS.jevil_ult = {   // DEVILSKNIFE / Final Chaos: orbiting scythes + spade spiral + giant scythe rain
  dur: 620,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f === 0 || f === 200 || f === 400) {   // 4 grey scythes orbit the center
      for (let k = 0; k < 4; k++)
        add({ ...bulletProps('scythe'), x: cx, y: cy, r: 10, spin: 0.3, vx: 0, vy: 0,
              orbit: { cx, cy, R: 46, w: 0.05 * (k % 2 ? 1 : -1), ang: k * Math.PI / 2 }, life: 200 });
    }
    if (f < 300 && every(f, rate(24, tier))) {   // Ring of Spades spiral collapses inward
      const dir = (Math.floor(f / 120) % 2) ? 1 : -1, ang = f * 0.16 * dir, R = Math.max(box.w, box.h) / 2 + 34;
      const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R, toC = Math.atan2(cy - y, cx - x);
      add({ ...bulletProps('bspade'), x, y, vx: Math.cos(toC + dir * 0.5) * 1.6, vy: Math.sin(toC + dir * 0.5) * 1.6, spin: 0.2, r: 8 });
    }
    if (f >= 300 && every(f, rate(40, tier))) {  // Final Chaos: giant scythes rain, edges->center
      const seqPos = [0.06, 0.94, 0.22, 0.78, 0.5][Math.floor(f / rate(40, tier)) % 5];
      add({ ...bulletProps('scythebig'), x: box.x + 10 + seqPos * (box.w - 20), y: box.y - 40,
            vx: 0, vy: 1.9 + rng() * 0.6, spin: 0.12, r: 13 });
    }
  },
};

// A++++ : dense A+ exam papers, aimed and accelerating (Berdly spell)
PATTERNS.berdly_papers = {
  dur: 480,
  tick(a) {
    const { f, rng, box, tier, add, soul } = a;
    if (every(f, rate(20, tier))) {
      const ox = box.x + box.w + 24, oy = box.y + 12 + rng() * (box.h - 24);
      const base = Math.atan2(soul.y - oy, soul.x - ox);
      for (let i = -1; i <= 1; i++) {
        const ang = base + i * 0.22;
        add({ ...bulletProps('feather'), x: ox, y: oy, vx: Math.cos(ang) * 2.2, vy: Math.sin(ang) * 2.2,
              ax: Math.cos(ang) * 0.05, ay: Math.sin(ang) * 0.05, maxv: 5, rot: ang, spin: 0.03 });
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

// ---------- SPAMTON NEO (Ch2 secret boss - real moveset) ----------
PATTERNS.sneo_heads = {   // Flying Heads: copies of his head launch at the soul in lanes
  dur: 440,
  tick(a) {
    const { f, rng, box, tier, add, soul } = a;
    if (every(f, rate(34, tier)))   // a head streaks across from the right at the soul's lane
      add({ ...bulletProps('sneohead'), x: box.x + box.w + 24, y: soul.y, vx: -(3.0 + rng() * 0.6), vy: 0, spin: 0.05, r: 9 });
    if (every(f, rate(26, tier)))   // heads spit small word bullets as they cross
      add({ ...bulletProps('sneosound'), x: box.x + box.w * (0.3 + rng() * 0.5), y: box.y - 14, vx: 0, vy: 2.0, r: 6 });
  },
};
PATTERNS.sneo_heart = {   // Heart Attack: the chained heart swings across the top spraying diamonds
  dur: 500,
  tick(a) {
    const { f, box, tier, add } = a;
    const cx = box.x + box.w / 2 + box.w * 0.42 * Math.sin(0.03 * f), cy = box.y + 22;
    if (every(f, rate(4, tier)))    // the heart itself (short-lived spawns trace its path = a hazard)
      add({ ...bulletProps('sneowire'), x: cx, y: cy, vx: 0, vy: 0, life: 6, spin: 0.04, r: 11 });
    if (every(f, rate(15, tier)))   // sprays a fan of diamond bullets downward
      for (let i = -1; i <= 1; i++)
        add({ ...bulletProps('kdiamond'), x: cx, y: cy + 10, vx: i * 0.9, vy: 2.2 + Math.abs(i) * 0.3, spin: 0.1, r: 6 });
  },
};
PATTERNS.sneo_mail = {   // Spam Mail: towers of mail (and stray heads) drive in from the right
  dur: 480,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(38, tier))) {
      const ty = box.y + 8 + rng() * (box.h - 44);
      for (let j = 0; j < 3; j++)
        add({ ...bulletProps('sneomail'), x: box.x + box.w + 20 + j * 16, y: ty + j * 12, vx: -(2.4 + rng() * 0.4), vy: 0, spin: 0.03, r: 7 });
    }
    if (every(f, rate(24, tier)))
      add({ ...bulletProps('sneohead'), x: box.x + box.w + 20, y: box.y + rng() * box.h, vx: -(2.0 + rng()), vy: 0, spin: 0.05, r: 8 });
  },
};
PATTERNS.sneo_words = {   // Word Bullets: strings of letters weave across in a sine wave
  dur: 480,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(10, tier)))
      add({ ...bulletProps('sneosound'), x: box.x + box.w + 18, y: box.y + 16 + rng() * (box.h - 32),
            vx: -(2.6 + rng() * 0.5), vy: 0, sineA: 1.5, sineF: 0.08, spin: 0.03, r: 6 });
  },
};
PATTERNS.sneo_bigshot = {   // BIG SHOT: arm-cannon bursts aimed at the soul + words + heads
  dur: 620,
  tick(a) {
    const { f, rng, box, tier, add, soul } = a;
    if (every(f, rate(46, tier))) {   // big shot, bursts into a ring
      const ox = box.x + box.w + 26, oy = box.y + box.h * 0.3 + rng() * box.h * 0.4;
      const ang = Math.atan2(soul.y - oy, soul.x - ox);
      add({ ...bulletProps('sneobig'), x: ox, y: oy, vx: Math.cos(ang) * 2.2, vy: Math.sin(ang) * 2.2, spin: 0.1, r: 12, burst: 58, burstN: 6, burstSpeed: 2.4 });
    }
    if (every(f, rate(14, tier)))
      add({ ...bulletProps('sneosound'), x: box.x + box.w + 16, y: box.y + 16 + rng() * (box.h - 32), vx: -(2.8 + rng()), vy: 0, sineA: 1.2, sineF: 0.09, r: 6 });
    if (every(f, rate(30, tier)))
      add({ ...bulletProps('sneohead'), x: box.x + box.w + 20, y: soul.y, vx: -3.0, vy: 0, spin: 0.05, r: 9 });
  },
};

// ---------- THE ROARING KNIGHT (Ch3 secret boss - real moveset) ----------
PATTERNS.knight_stars = {   // Star Barrage (EarthBound-style): stars converge from every edge
  dur: 460,
  tick(a) {
    const { f, rng, box, tier, add, soul } = a;
    if (every(f, rate(10, tier))) {
      const side = Math.floor(rng() * 4); let x, y;
      if (side === 0) { x = box.x - 20; y = box.y + rng() * box.h; }
      else if (side === 1) { x = box.x + box.w + 20; y = box.y + rng() * box.h; }
      else if (side === 2) { x = box.x + rng() * box.w; y = box.y - 20; }
      else { x = box.x + rng() * box.w; y = box.y + box.h + 20; }
      const ang = Math.atan2(soul.y - y, soul.x - x) + (rng() - 0.5) * 0.4;
      add({ ...bulletProps('knightstar'), x, y, vx: Math.cos(ang) * 2.6, vy: Math.sin(ang) * 2.6, spin: 0.12, r: 8 });
    }
  },
};
PATTERNS.knight_corridor = {   // Sword Corridor: sword walls with a wavy roller-coaster safe path
  dur: 500,
  tick(a) {
    const { f, box, tier, add } = a;
    if (every(f, rate(11, tier))) {
      const midY = box.y + box.h / 2 + Math.sin(f * 0.06) * box.h * 0.32, gapH = 46;
      for (let y = box.y + 4; y < box.y + box.h - 4; y += 22) {
        if (y > midY - gapH / 2 && y < midY + gapH / 2) continue;   // the corridor gap
        add({ ...bulletProps('knightsword'), x: box.x + box.w + 18, y, vx: -3.0, vy: 0, rot: -Math.PI / 2, r: 8 });
      }
    }
  },
};
PATTERNS.knight_circle = {   // Circle of Swords: a ring coils round the soul then homes in
  dur: 500,
  tick(a) {
    const { f, box, tier, add, soul } = a;
    if (every(f, rate(52, tier))) {
      const N = 10, R = 72;
      for (let k = 0; k < N; k++) { const th = k * 2 * Math.PI / N + f * 0.02;
        add({ ...bulletProps('knightsword'), x: soul.x + Math.cos(th) * R, y: soul.y + Math.sin(th) * R,
              vx: 0, vy: 0, homing: 0.05, maxv: 2.4, spin: 0.12, rot: th + Math.PI, r: 7 }); }
    }
  },
};
PATTERNS.knight_crescents = {   // Crescent Slash: fast crescent blades sweep in from the sides
  dur: 480,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(20, tier))) {
      const left = rng() < 0.5;
      for (let i = 0; i < 3; i++)
        add({ ...bulletProps('knightcross'), x: left ? box.x - 20 : box.x + box.w + 20, y: box.y + 20 + rng() * (box.h - 40),
              vx: (left ? 1 : -1) * (3.0 + rng() * 0.5), vy: (rng() - 0.5) * 0.6, spin: left ? 0.2 : -0.2, r: 8 });
    }
  },
};
PATTERNS.knight_roar = {   // ROARING SLASH: converging stars + homing swords + crescent sweeps
  dur: 620,
  tick(a) {
    const { f, rng, box, tier, add, soul } = a;
    if (every(f, rate(16, tier))) {
      const side = Math.floor(rng() * 4); let x, y;
      if (side === 0) { x = box.x - 20; y = box.y + rng() * box.h; }
      else if (side === 1) { x = box.x + box.w + 20; y = box.y + rng() * box.h; }
      else if (side === 2) { x = box.x + rng() * box.w; y = box.y - 20; }
      else { x = box.x + rng() * box.w; y = box.y + box.h + 20; }
      const ang = Math.atan2(soul.y - y, soul.x - x);
      add({ ...bulletProps('knightstar'), x, y, vx: Math.cos(ang) * 2.8, vy: Math.sin(ang) * 2.8, spin: 0.12, r: 8 });
    }
    if (every(f, rate(40, tier)))
      add({ ...bulletProps('knightsword'), x: box.x + box.w + 20, y: box.y + rng() * box.h, vx: -2.0, vy: 0, homing: 0.04, maxv: 3.0, spin: 0.1, r: 8 });
    if (every(f, rate(72, tier)))
      for (let i = 0; i < 4; i++)
        add({ ...bulletProps('knightcross'), x: box.x - 20, y: box.y + 30 + i * (box.h - 60) / 3, vx: 3.2, vy: 0, spin: 0.2, r: 8 });
  },
};

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
    tick(soul, add) {
      for (const s of subs) {
        if (this.f >= s.sim.dur) continue;
        s.sim.tick(soul, b => { if (N === 1 || s.rng() < keep) { b.dmg = s.dmg; b.target = s.target; add(b); } });
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
    tick(soul, add) {
      pattern.tick({ f: this.f, rng, box, tier, soul, add, imgs });
      this.f++;
    },
  };
}
