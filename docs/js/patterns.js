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
        ...bulletProps('icesnow'), r: 9, spin: 0.05,
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

// ---------- JEVIL (darkner secret boss - Difficult) ----------
PATTERNS.jevil_spade = {   // SPADE FAN: Jevil hovers at ALTERNATING sides and hurls a slower fan of real spades
  dur: 440,
  tick(a) {
    const { f, box, tier, add, soul } = a;
    const CYC = rate(52, tier), ev = f % CYC, k = Math.floor(f / CYC);
    const left = (k % 2) === 0;
    const ox = left ? box.x - 20 : box.x + box.w + 20, oy = box.y + box.h / 2;
    // Jevil floats at the side, bobbing, and throws (drawn behind the box via fx.boss)
    a.fx.boss = { key: 'jevilcast', x: left ? box.x - 42 : box.x + box.w + 42, y: oy + Math.sin(f * 0.18) * 8, scale: 1, flip: !left };
    if (ev === 0) {   // slower fan of real battle-spades aimed at the soul (one fewer + slower than before)
      const base = Math.atan2(soul.y - oy, soul.x - ox);
      for (const o of [-0.34, 0, 0.34])
        add({ ...bulletProps('jspade'), x: ox, y: oy, vx: Math.cos(base + o) * 2.0, vy: Math.sin(base + o) * 2.0, spin: 0.22, r: 7, scale: 1.2 });
    }
  },
};
PATTERNS.jevil_diamond = {   // DIAMOND RAIN: small REAL diamonds rain down from the top - readable + dodgeable
  dur: 500,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(9, tier)))     // steady rain of small diamonds with slight drift + spin
      add({ ...bulletProps('diamond'), x: box.x + rng() * box.w, y: box.y - 16,
            vx: (rng() - 0.5) * 0.8, vy: 2.2 + rng() * 1.4, r: 6, spin: 0.12 });
    if (every(f, rate(88, tier))) {  // occasional slanted downpour line to force a move
      const dir = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < 5; i++)
        add({ ...bulletProps('diamond'), x: box.x + box.w * 0.5 + dir * i * 14, y: box.y - 20 - i * 12,
              vx: dir * 1.2, vy: 2.6, r: 6, spin: 0.12 });
    }
  },
};
PATTERNS.jevil_carousel = {   // THE CAROUSEL: a fake-3D cylinder of 8 columns x 3 horse-ducks rotating around the
  dur: 560,                    // box. ~3 columns are in FRONT at once, bobbing up/down as a unit - slip the gaps.
  tick(a) {
    const { f, box, add, rng } = a;
    if (f !== 0) return;
    const cols = 8, rows = 3;
    const cx = box.x + box.w / 2, R = box.w / 2 + 24;
    const rowGap = box.h * 0.34, midY = box.y + box.h / 2;
    for (let c = 0; c < cols; c++) {
      const ang0 = c / cols * Math.PI * 2;
      for (let r = 0; r < rows; r++) {
        const rowY = midY + (r - 1) * rowGap;
        // each duck-horse is a RANDOM variant sprite (carousel0/1/2) for visual variety - not an animation
        add({ ...bulletProps('carousel' + Math.floor(rng() * 3)), x: cx, y: rowY, vx: 0, vy: 0, r: 11,
              carousel: { ang: ang0, w: 0.018, R, cx, rowY, bob: box.h * 0.11, phase: ang0 } });
      }
    }
  },
};
PATTERNS.jevil_ult = {   // DEVILSKNIFE (turn-4): the arena fills the screen; giant Devilsknives fall and smash
  dur: 680,               // into light pillars - random first, then edges->center->edges, then a screen-filler.
  tick(a) {
    const { f, rng, box, tier, add } = a;
    a.fx.arena = true;                                     // the arena grows to fill the whole screen
    const gY = box.y + box.h - 8;
    const drop = (x, vy, scale) => {
      const sc = scale || 1;
      // SMALLER, MUCH FASTER falling knives; each smashes into a full-height pillar of white light
      const k = { ...bulletProps('scythebig'), x, y: box.y + 24, vx: 0, vy: vy, spin: 0.08, scale: sc * 0.95,
                  hitW: 26 * sc, hitH: 62 * sc, _gy: gY };
      k.emit = function (b, out) {
        if (b.y >= b._gy && !b._smash) {
          b._smash = 1; b.dead = true;
          out.push({ shape: 'line', color: '#fff', x: b.x, y: box.y + box.h / 2, rot: Math.PI / 2, len: box.h + 60, thick: 26 + 8 * sc,
                     armed: true, life: 20, dmg: b.dmg, vx: 0, vy: 0 });
          Snd.play('boarddmg', 0.3);
        }
      };
      add(k);
    };
    if (f < 300 && every(f, rate(26, tier))) {             // PHASE 1: MANY random fast knives
      drop(box.x + 30 + rng() * (box.w - 60), 6.5 + rng() * 1.5, 1.0);
    }
    const seq = f - 300;
    if (seq >= 0 && seq % rate(52, tier) === 0) {           // PHASE 2: the set pattern (fast)
      const n = Math.floor(seq / rate(52, tier));
      if (n === 0 || n === 2) { drop(box.x + 44, 7.5, 1.0); drop(box.x + box.w / 2, 7.5, 1.0); drop(box.x + box.w - 44, 7.5, 1.0); }   // edges + centre
      else if (n === 1) { drop(box.x + box.w * 0.3, 7.5, 1.0); drop(box.x + box.w * 0.7, 7.5, 1.0); }
      else if (n === 3) { drop(box.x + 80, 7.5, 1.0); drop(box.x + box.w - 80, 7.5, 1.0); }
      else if (n === 4)   // FINALE: one HUGE Devilsknife descends SLOWLY - DOUBLE damage if touched, but easy: move DOWN
        add({ ...bulletProps('scythebig'), x: box.x + box.w / 2, y: -80, vx: 0, vy: 0,
              lerpY: box.y + box.h * 0.28, lerpRate: 0.02, spin: 0.03, scale: 5.4, hitW: 300, hitH: 240, dmgMult: 2, life: 260 });
    }
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
PATTERNS.sneo_heads = {   // FLYING HEADS: a row of 4 heads decelerates to ~66% in, stops, EXPLODES into small heads
  dur: 470, box: { w: 300, h: 150 },
  tick(a) {
    const { f, rng, box, tier, add } = a;
    const period = rate(84, tier);
    if (f % period === 0 && f < 410) {
      const ly = box.y + 24 + rng() * (box.h - 48);          // random lane
      for (let i = 0; i < 5; i++)                             // 5 heads in a straight row - only a great shot clears them all
        add({ ...bulletProps('sneohead'), x: box.x + box.w + 24 + i * 22, y: ly,
              vx: -4.4, ax: 0.05, vy: 0, r: 11, spin: 0, shootable: true, hp: 1,
              // if not all shot in time they stop and burst into 5 small UN-shootable heads at RANDOM angles
              burst: 84, burstN: 5, burstSpeed: 1.7, burstImg: 'sneohead', burstScale: 0.5, burstSpin: 0.08, burstScatter: true });
    }
    // occasionally a LONE rogue head streaks in off-beat at a random lane/speed - hard to pick off, adds variety
    if (f > 40 && f < 420 && f % rate(96, tier) === 40)
      add({ ...bulletProps('sneohead'), x: box.x + box.w + 20, y: box.y + 20 + rng() * (box.h - 40),
            vx: -(3.4 + rng() * 1.8), ax: 0.03, vy: 0, r: 11, spin: 0, shootable: true, hp: 1,
            burst: 70, burstN: 5, burstSpeed: 1.9, burstImg: 'sneohead', burstScale: 0.5, burstSpin: 0.08, burstScatter: true });
  },
};
PATTERNS.sneo_heart = {   // A HEART ATTACK: heart emerges from Spamton's side; fires 3 rounds of a 5-bullet 180 arc
  dur: 520, box: { w: 190, h: 190 },
  tick(a) {
    const { f, box, add } = a;
    if (f !== 0) return;
    const anchorX = box.x + box.w + 40, anchorY = box.y + box.h * 0.3;   // Spamton's side (chain anchor)
    const reach = box.w * 0.66;                                          // as far as the heart can extend toward you
    // the heart PROACTIVELY reaches toward the player; when fully extended it fires 3 aimed shots.
    // Shoot it to shove it back toward Spamton (buying space).
    const heart = { ...bulletProps('sneowire'), x: box.x + box.w * 0.8, y: box.y + box.h / 2, vx: 0, vy: 0,
                    shootable: true, hp: 9999, pushOnShot: 8, spin: 0.05, r: 15, _cd: 30 };
    heart.emit = function (b, out, soul, bx, fx) {
      b.x += (soul.x - b.x) * 0.055; b.y += (soul.y - b.y) * 0.055;      // ease toward the player
      const dx = b.x - anchorX, dy = b.y - anchorY, d = Math.hypot(dx, dy) || 1;
      if (d > reach) { b.x = anchorX + dx / d * reach; b.y = anchorY + dy / d * reach; }   // clamp to max reach
      b.x = Math.max(bx.x + 18, Math.min(bx.x + bx.w - 8, b.x));
      b.y = Math.max(bx.y + 12, Math.min(bx.y + bx.h - 12, b.y));
      fx.arms = [{ x1: anchorX, y1: anchorY, x2: b.x, y2: b.y }];
      if (b._cd > 0) b._cd--;
      if (d >= reach - 8 && b._cd <= 0) {   // fully extended toward the player -> fire 3 aimed shots
        b._cd = 64;
        const base = Math.atan2(soul.y - b.y, soul.x - b.x);
        for (let k = -1; k <= 1; k++) { const ang = base + k * (Math.PI / 7);
          out.push({ ...bulletProps('diamond'), x: b.x, y: b.y, vx: Math.cos(ang) * 2.8, vy: Math.sin(ang) * 2.8, rot: ang, spin: 0, r: 5, scale: 0.8, sx: 2 }); }
      }
    };
    add(heart);
  },
};
// SPAM MAIL schedule: cars enter from the RIGHT and drive cleanly LEFT (constant speed, no decel/
// reversing). Explicit timeline: easy singles -> a back-to-back batch of lined-head cars (one BIG SHOT
// column clears them) -> harder cars -> a 3-bomb no-head finale. [frame, type]
const MAIL_SCRIPT = [
  [30, 'easy'], [122, 'easy'], [214, 'hard'],
  [300, 'lined'], [342, 'lined'], [384, 'lined'], [426, 'lined'],
  [504, 'hard'], [596, 'hard'],
  [726, 'bomb'], [818, 'bomb'],
];
PATTERNS.sneo_mail = {
  dur: 980, box: { w: 260, h: 190 },
  tick(a) {
    const { f, rng, box, add } = a;
    for (const [t, type] of MAIL_SCRIPT) {
      if (f !== t) continue;
      let fill;
      if (type === 'easy') { fill = ['m', 'm', 'm', 'm', 'm']; fill[1 + Math.floor(rng() * 3)] = 'h'; }
      else if (type === 'lined') { fill = ['m', 'm', 'm', 'm', 'm']; fill[2] = 'h'; }   // head always slot 2 -> bigshot column
      else if (type === 'hard') { fill = ['m', 'h', 'm', 'h', 'b']; for (let i = fill.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [fill[i], fill[j]] = [fill[j], fill[i]]; } }
      else fill = ['b', 'm', 'b', 'm', 'b'];   // BOMB CAR: 3 bombs, no heads
      const tx = box.x + box.w + 26, vx = -2.8;   // constant leftward speed - exits cleanly, never comes back
      const slotH = box.h / 5;
      add({ ...bulletProps('sneobox'), x: tx, y: box.y - 4, vx, r: 9 });                    // top square
      for (let s = 0; s < 5; s++) {
        const sy = box.y + (s + 0.5) * slotH, sc = slotH / (20 * 1.6);
        if (fill[s] === 'm') add({ ...bulletProps('sneomail'), x: tx, y: sy, vx, r: slotH * 0.42, scale: sc });
        else if (fill[s] === 'h') add({ ...bulletProps('sneohead'), x: tx, y: sy, vx, r: slotH * 0.42, scale: sc * 0.9, shootable: true, hp: 1 });
        else add({ ...bulletProps('sneobomb'), x: tx, y: sy, vx, r: slotH * 0.42, scale: sc * 0.9, shootable: true, hp: 1, bomb: true });
      }
      add({ ...bulletProps('sneobox'), x: tx, y: box.y + box.h + 4, vx, r: 9 });            // bottom square
      add({ ...bulletProps('sneocar'), x: tx, y: box.y + box.h + 22, vx, r: 0, noHit: true });   // the car
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
      // spit a SMALLER yellow ball that drifts left & decelerates, flashes, then bursts into 3 soundwaves
      if (--b._ball <= 0) {
        b._ball = 70;
        out.push({ ...bulletProps('sneoball'), x: b.x - 12, y: b.y, vx: -2.2, ax: 0.04, vy: 0, r: 6, scale: 0.6, flash: true,
          burst: 58, burstN: 3, burstArc: Math.PI / 2, burstAng: Math.PI, burstSpeed: 2.0, burstImg: 'sneosound', burstScale: 1.0, burstR: 10 });
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
    const eye = { ...bulletProps('sneoeye'), x: fcx, y: fcy + eyeOff, drawDY: -eyeOff, vx: 0, vy: 0, r: 14, scale: SC, shootable: true, noHit: true, breakShot: true, hp: 12, _fireT: 0, _cd: 60 };
    eye.emit = function (b, out, soul) {
      faceTint(b);
      if (--b._cd > 0) return; b._cd = 180; b._fireT = 28;   // flash YELLOW while firing
      const ang = Math.atan2(soul.y - b.y, soul.x - b.x), dx = Math.cos(ang), dy = Math.sin(ang);   // aim at captured soul pos
      for (let i = 0; i < 7; i++) out.push({ ...bulletProps('sneolaser'), x: b.x - dx * i * 15, y: b.y - dy * i * 15, vx: dx * 4.2, vy: dy * 4.2, r: 5 });
    };
    add(eye);
    const nose = { ...bulletProps('sneonose'), x: fcx, y: fcy, vx: 0, vy: 0, r: 12, scale: SC, shootable: true, noHit: true, breakShot: true, hp: 12, _fireT: 0, _cd: 120 };
    nose.emit = function (b, out, soul, bx) {
      faceTint(b);
      if (--b._cd > 0) return; b._cd = 180; b._fireT = 28;
      const rows = [bx.y + 10, bx.y + bx.h / 2, bx.y + bx.h - 10];   // rows RIDE the top edge / middle / bottom edge
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)        // 3x3 of the real NOSE TRIANGLES
        out.push({ ...bulletProps('sneonosetri'), x: b.x, y: b.y, vx: -2.6 - c * 0.35, vy: 0,
                   lerpY: rows[r], lerpRate: 0.1, r: 6, rot: 0 });   // ease onto the row and STAY on it
    };
    add(nose);
    const mouth = { ...bulletProps('sneomouth'), x: fcx, y: fcy + mouthOff, drawDY: -mouthOff, vx: 0, vy: 0, r: 14, scale: SC, shootable: true, noHit: true, breakShot: true, hp: 12, _fireT: 0, _cd: 180 };
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

// ---------- THE ROARING KNIGHT (Ch3 secret boss) ----------
// Rebuilt frame-by-frame from the attack-guide footage (ref/knight/attack_guide.mp4,
// montages ref/vidframes/scan_*.png + clip_*.png). The guide's own captions name each
// attack: Sword Corridor (~114s), Spinning Swords (~164s), Red Slash (~172s),
// Break the Board (~142/190s), and the FINAL "converge then spinning pattern" (~240s).
PATTERNS.knight_corridor = {   // SWORD CORRIDOR (fight): fast sword COLUMNS with a ~3-soul gap that wanders, then a red-line cut
  dur: 560,
  tick(a) {
    const { f, box, tier, add, rng, soul } = a;
    const cy = box.y + box.h / 2, per = rate(6, tier);
    if (f === 0) this._gy = soul.y;   // remember the player's lane so the intro gap starts ON them
    // ~60 columns in ~6s: each column is a sword pointing DOWN from the top + one pointing UP from the bottom.
    // The gap starts on the player's lane (so they always begin safe + have time), then eases into a wander.
    if (f < 372 && f % per === 0) {
      const col = Math.floor(f / per), ease = Math.min(1, col / 34);
      const wander = cy + Math.sin(col * 0.28) * box.h * 0.16;
      const gapC = this._gy * (1 - ease) + wander * ease;
      const gapH = 44, L = 115;   // a touch more forgiving (~2.5 souls tall); fixed blade length
      add({ ...bulletProps('knightknife'), x: box.x + box.w + 18, y: gapC - gapH / 2 - L / 2, vx: -7.4, vy: 0,
            rot: Math.PI / 2, scale: 1.65, sy: 0.33, hitW: 9, hitH: L });
      add({ ...bulletProps('knightknife'), x: box.x + box.w + 18, y: gapC + gapH / 2 + L / 2, vx: -7.4, vy: 0,
            rot: -Math.PI / 2, scale: 1.65, sy: 0.33, hitW: 9, hitH: L });
    }
    // finale: the Knight fills the box with red tell-lines - each is where a KNIFE will fly through
    if (f === 402)
      for (let i = 0; i < 28; i++) {
        const line = { shape: 'line', color: '#f33', len: Math.hypot(box.w, box.h) * 2.2, thick: 3,
              x: box.x + rng() * box.w, y: box.y + rng() * box.h, rot: rng() * Math.PI, vx: 0, vy: 0, tellT: 62, armWindow: 12, dmg: 16, _shot: 0 };
        line.emit = function (b, out) {   // when the cut lands, KNIVES visibly streak along the line
          if (b.armed && !b._shot) { b._shot = 1;
            const dx = Math.cos(b.rot), dy = Math.sin(b.rot);
            for (let k = 0; k < 5; k++)
              out.push({ ...bulletProps('knightknife'), x: b.x - dx * (120 - k * 40), y: b.y - dy * (120 - k * 40),
                         vx: dx * 11, vy: dy * 11, rot: b.rot, scale: 1.3, r: 0, noHit: true, life: 34 });
          }
        };
        add(line);
      }
  },
};
PATTERNS.knight_circle = {   // DIRECTIONAL SWORDS: swords appear on the 8 axes, track you ~1.5s, then fire fast
  dur: 560,
  tick(a) {
    const { f, box, tier, add } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, R = Math.max(box.w, box.h) * 0.9;
    // a sword materialises FAR out on one of the 8 compass axes, points inward, TRACKS the soul along
    // its perpendicular for ~1s, then fires extremely fast - you only escape by moving along its axis.
    const per = rate(30, tier);
    if (f > 6 && f % per === 0) {
      const slot = (Math.floor(f / per) * 3) % 8;             // cycle the 8 slots
      const dir = slot * Math.PI / 4;
      // real roaringknight sword sprite; fades in red, tracks your axis, turns white + SFX when it fires.
      // Faster spawns + much less tell + faster shot (it's a TP spell).
      add({ ...bulletProps('knightswordol'), x: cx - Math.cos(dir) * R, y: cy - Math.sin(dir) * R, vx: 0, vy: 0,
            scale: 1.3, rot: dir, aim: { dir, delay: rate(38, tier), speed: 16 } });
    }
  },
};
PATTERNS.knight_slash = {   // RED SLASH: soul-centred red tell-lines that rotate to a stop then CUT.
  dur: 940,                  // Formation 1,2,2,3,3,4,4,4,6, then a spinning-line finale.
  tick(a) {
    const { f, box, tier, add, soul, rng } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const SEQ = [1, 2, 2, 3, 3, 4, 4, 4, 6], GAP = rate(56, tier);   // faster: next set starts as this one cuts
    for (let e = 0; e < SEQ.length; e++) {
      if (f !== 16 + e * GAP) continue;
      const n = SEQ[e], C = { x: soul.x, y: soul.y };           // centred on the soul's position at spawn
      // more rotation (45-180deg) before easing to a stop; thicker + a touch faster cut
      const base = rng() * Math.PI, rotV = (rng() < 0.5 ? 1 : -1) * (0.06 + rng() * 0.12);
      for (let i = 0; i < n; i++)
        add({ shape: 'line', color: '#f33', len: Math.hypot(box.w, box.h) * 2.2, thick: 7,   // even thicker; reaches every edge (masked to the box)
              x: C.x, y: C.y, rot: base + i * Math.PI / n, vx: 0, vy: 0, spin: rotV, spinDecay: 0.93, tellT: 52, armWindow: 10, dmg: 24 });
    }
    // FINALE - the SPINNING-LINE SPAM: ~40 centre lines fire in a rapid sweep, each ~9deg further around
    // (a full 360 in ~1.2s), each with a fast tell then cut + screenshake. Circle the centre to survive.
    const FIN = 16 + SEQ.length * GAP + 44;
    if (f >= FIN && f < FIN + 80 && (f - FIN) % 2 === 0) {
      const k = (f - FIN) / 2;   // 40 lines, 9deg apart
      add({ shape: 'line', color: '#f33', len: Math.hypot(box.w, box.h) * 2.2, thick: 6,
            x: cx, y: cy, rot: k * (Math.PI * 2 / 40), vx: 0, vy: 0, tellT: 16, armWindow: 7, dmg: 22, shakeOnCut: true });
    }
  },
};
const RK_FLAME = ['rkflame0', 'rkflame1', 'rkflame2', 'rkflame3', 'rkflame4', 'rkflame5'];
const RK_FLAME_BIG = ['rkflamebig0', 'rkflamebig1', 'rkflamebig2', 'rkflamebig3', 'rkflamebig4', 'rkflamebig5'];
PATTERNS.knight_board = {   // BREAK THE BOARD: red cut tell, the board ACTUALLY splits (soul rides its half) with
  dur: 560,                  // mystical FLAME on the broken edges; teeth (pointing DOWN) fire in two waves of 4.
  tick(a) {
    const { f, box, tier, add, rng } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, GAP = rate(116, tier);
    if (f >= 470) return;
    const ev = f % GAP, k = Math.floor(f / GAP) % 2, horiz = k === 0;
    if (ev === 0)   // the cut tell-line (harmless until the Knight strikes it) - fast tell
      add({ shape: 'line', color: '#f33', len: (horiz ? box.w : box.h) * 1.05, thick: 4,
            x: cx, y: cy, rot: horiz ? 0 : Math.PI / 2, vx: 0, vy: 0, tellT: 26, armWindow: 8, dmg: 20 });
    // THE SPLIT: halves slide apart quickly, brief hold, then snap back
    let off = 0;
    if (ev >= 28 && ev < 42) off = (ev - 28) / 14 * 26;
    else if (ev >= 42 && ev < 70) off = 26;
    else if (ev >= 70 && ev < 84) off = 26 * (1 - (ev - 70) / 14);
    if (off > 0) a.fx.split = { axis: horiz ? 'h' : 'v', offset: off };
    // teeth + FLAMES spawn when the cut lands
    if (ev === 28) {
      // FIRST WAVE: a random 4 of 8 - constrained so no more than 2 fire adjacently (always dodgeable)
      let firstWave;
      for (let tries = 0; tries < 40; tries++) {
        firstWave = []; while (firstWave.length < 4) { const i = Math.floor(rng() * 8); if (!firstWave.includes(i)) firstWave.push(i); }
        const s = firstWave.slice().sort((p, q) => p - q); let run = 1, ok = true;
        for (let j = 1; j < s.length; j++) { run = s[j] === s[j - 1] + 1 ? run + 1 : 1; if (run >= 3) { ok = false; break; } }
        if (ok) break;
      }
      // MYSTICAL FLAME on the broken edges FIRST (big split-flame sprite, scaled to sit within the box)
      // so the TEETH draw on top of it.
      const NF = 9, fbase = { animKeys: RK_FLAME_BIG, animRate: 4, r: 0, noHit: true, life: 74, vx: 0, vy: 0, scale: 0.5 };
      for (let i = 0; i < NF; i++) {
        const t = (i + 0.5) / NF;
        if (horiz) { const x = box.x + t * box.w;
          add({ ...bulletProps('rkflamebig0'), ...fbase, x, y: cy - 5, ridesSplit: 1 });
          add({ ...bulletProps('rkflamebig0'), ...fbase, x, y: cy + 5, ridesSplit: -1, flip: true });
        } else { const y = box.y + t * box.h;
          add({ ...bulletProps('rkflamebig0'), ...fbase, x: cx - 5, y, ridesSplit: 1, rot: Math.PI / 2 });
          add({ ...bulletProps('rkflamebig0'), ...fbase, x: cx + 5, y, ridesSplit: -1, rot: -Math.PI / 2 });
        }
      }
      // TEETH (on top of the flame), pointing INTO the gap per the cut direction
      for (let i = 0; i < 8; i++) {
        const t = (i + 0.5) / 8, when = firstWave.includes(i) ? 20 : 46;   // teeth smaller (0.8) + FASTER fire
        if (horiz) {   // horizontal cut: top teeth point DOWN into the gap, bottom teeth point UP
          const x = box.x + t * box.w;
          add({ ...bulletProps('knighttooth'), x, y: cy - 7, vx: 0, vy: 0, rot: 0, scale: 0.8, r: 6, noHit: true, ridesSplit: 1, fireAt: when, fireVY: -3.7 });
          add({ ...bulletProps('knighttooth'), x, y: cy + 7, vx: 0, vy: 0, rot: Math.PI, scale: 0.8, r: 6, noHit: true, ridesSplit: -1, fireAt: when, fireVY: 3.7 });
        } else {   // vertical cut: left teeth point RIGHT into the gap, right teeth point LEFT
          const y = box.y + t * box.h;
          add({ ...bulletProps('knighttooth'), x: cx - 7, y, vx: 0, vy: 0, rot: -Math.PI / 2, scale: 0.8, r: 6, noHit: true, ridesSplit: 1, fireAt: when, fireVX: -3.7 });
          add({ ...bulletProps('knighttooth'), x: cx + 7, y, vx: 0, vy: 0, rot: Math.PI / 2, scale: 0.8, r: 6, noHit: true, ridesSplit: -1, fireAt: when, fireVX: 3.7 });
        }
      }
    }
  },
};
// FINAL ROAR timeline: charge(flourish 0->4, stars pull in random then swirl) -> flourish 5->6
// -> ROAR (roar 0<->1, spew stars OUT, can't explode yet) -> all stars shatter into slow fading
// shards -> final diagonal cut (slash 0->5). Stars all shatter around EXPLODE regardless of when fired.
const ROAR_ROAR = 300, ROAR_EXPLODE = 620, ROAR_CUT = 700;
PATTERNS.knight_roar = {
  dur: 860,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    a.fx.blackout = true;
    a.fx.bgHue = (f >= ROAR_ROAR && f < ROAR_EXPLODE) ? 0 : (f * 2) % 360;   // rainbow, RED during the roar
    a.fx.hideBox = true; a.fx.arena = true; a.fx.bgStars = true;              // borderless full-screen arena
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    // THE KNIGHT centre-screen: idle-front -> flourish charge 0->4 -> 5->6 -> roar loop -> slash finale
    let key = 'knightflourish0', scale = 2.1;
    if (f < 24) key = 'knightflourish0';
    else if (f < 200) key = 'knightflourish' + Math.min(4, Math.floor((f - 24) / 40));   // charge 0->4
    else if (f < ROAR_ROAR) key = 'knightflourish' + Math.min(6, 5 + Math.floor((f - 260) / 20));   // 5->6 (held 4 until 260)
    else if (f < ROAR_EXPLODE) { key = (Math.floor(f / 10) % 2) ? 'knightroar1' : 'knightroar0'; a.fx.shake = 5; }
    else if (f < ROAR_CUT) key = 'knightroar1';
    else { key = 'knightslashf' + Math.min(5, Math.floor((f - ROAR_CUT) / 8)); scale = 4.2; }   // the screen-cut
    if (f >= 200 && f < 260) key = 'knightflourish4';
    a.fx.boss = { key, x: cx, y: cy, scale };
    // CHARGE: stars pull IN toward the Knight. First random, then two tight swirling arms (Dream-Chorus-like).
    if (f < ROAR_ROAR) a.fx.pull = { x: cx, y: cy, force: 0.4 };
    if (f >= 30 && f < 150 && every(f, rate(6, tier))) {           // random pull-in
      const th = rng() * 6.28, R = 340, x = cx + Math.cos(th) * R, y = cy + Math.sin(th) * R, toC = Math.atan2(cy - y, cx - x);
      add({ ...bulletProps('knightstar'), x, y, vx: Math.cos(toC) * 2.6, vy: Math.sin(toC) * 2.6, spin: 0, r: 8, life: 150 });
    }
    if (f >= 150 && f < ROAR_ROAR && every(f, rate(5, tier))) {    // two tight swirling arms pulling in
      const base = f * 0.05, R = 350, vr = 2.7, vt = 1.9;
      for (const armOff of [0, Math.PI]) {
        const th = base + armOff, x = cx + Math.cos(th) * R, y = cy + Math.sin(th) * R;
        add({ ...bulletProps('knightstar'), x, y, spin: 0, r: 8, life: 150,
              vx: -Math.cos(th) * vr - Math.sin(th) * vt, vy: -Math.sin(th) * vr + Math.cos(th) * vt });
      }
    }
    // ROAR: spew stars OUT from the centre - they decelerate near the edges and CANNOT explode until
    // ROAR_EXPLODE, when they ALL shatter into slightly-large, slow, short-range fading shards.
    const outStar = (th, sp) => {
      const burstIn = Math.max(24, ROAR_EXPLODE - f);
      add({ ...bulletProps('knightstar'), x: cx, y: cy, vx: Math.cos(th) * sp, vy: Math.sin(th) * sp,
            ax: -Math.cos(th) * sp * 0.02, ay: -Math.sin(th) * sp * 0.02, spin: 0, r: 8,
            redAt: burstIn - 18, burst: burstIn, burstN: 6, burstImg: 'knighttri',
            // shards keep full size; hold 1s then fade OPACITY only, and stop hurting once faint (<40%)
            burstSpeed: 1.0, burstScale: 1.0, burstLife: 200, burstFade: true, burstFadeDelay: 60 });
    };
    if (f === ROAR_ROAR) for (let i = 0; i < 12; i++) outStar(i * Math.PI / 6, 3.0);   // opening 12-star
    if (f > ROAR_ROAR + 20 && f < ROAR_EXPLODE - 50 && every(f, rate(16, tier)))       // denser bursts of 4-5
      for (let i = 0; i < 5; i++) outStar(rng() * 6.28, 2.2 + rng() * 1.2);
    // FINAL diagonal cut across the whole screen (front_slash plays over it)
    if (f === ROAR_CUT)
      add({ shape: 'line', color: '#fff', len: 940, thick: 12, x: cx, y: cy, rot: Math.atan2(1, 1.5), vx: 0, vy: 0, tellT: 30, armWindow: 8, dmg: 40 });
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
