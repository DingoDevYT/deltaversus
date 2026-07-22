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
    for (let i = 0; i < 5; i++) { const ang = aim + (-36 + 18 * i) * Math.PI / 180;
      add({ ...bulletProps('suitspade'), x: jx, y: jy, vx: Math.cos(ang) * 4.5, vy: Math.sin(ang) * 4.5, rot: ang, scale: JS(0.75), r: 5, grazeR: 11, dmg: 18, life: 130 }); }
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
        else if (b._suit === 2) for (let i = 0; i < 8; i++) { const ang = i / 8 * 6.28; out.push({ ...bulletProps('suitheart'), x: b.x, y: b.y, vx: Math.cos(ang) * 6, vy: Math.sin(ang) * 6, scale: JS(0.7), r: 4, life: 80, dmg: b.dmg }); }
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
// TYPE 77 — ChaosChaos ULT: the box vanishes; giant Devilsknives rain in lanes and smash into ground
// shockwaves; a huge final scythe + whiteout.
PATTERNS.jevil_ult = {
  dur: 600, hz30: 1,
  tick(a) {
    const { f, rng, box, add } = a; a.fx.arena = true;
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
// STARS (obj_knight_pointing_cone) — the Knight's every-phase OPENER. Silver stars converge from the
// edges onto an aim point, flash red, then blast outward into shard bursts. Waves escalate.
PATTERNS.knight_stars = {
  dur: 420,
  tick(a) {
    const { f, box, add, rng, tier } = a;
    const WAVE = rate(116, tier);
    if (f % WAVE === 0 && f < 360) {
      const tx = box.x + box.w * (0.25 + rng() * 0.5), ty = box.y + box.h * (0.25 + rng() * 0.5), n = 10;
      for (let i = 0; i < n; i++) {
        const ang = i / n * 6.28 + rng() * 0.25, R = Math.max(box.w, box.h) * 1.05;
        const sx = tx + Math.cos(ang) * R, sy = ty + Math.sin(ang) * R, toT = Math.atan2(ty - sy, tx - sx);
        add({ ...bulletProps('knightstar'), x: sx, y: sy, vx: Math.cos(toT) * 2.6, vy: Math.sin(toT) * 2.6, r: 6, grazeR: 13, scale: 0.9, spin: 0.12,
              burst: 46, burstN: 6, burstImg: 'knighttri', burstSpeed: 3.5, burstScale: 0.8, burstLife: 80, redAt: 30, life: 200 });
      }
      Snd.play('boardsummon', 0.35);
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

// ============================================================================
// JEVIL — "NEW SET" (Gemini recipes, FULL specs). TEST patterns wired only into the
// attack tester + showcase, NOT Jevil's real in-game moveset. Real suit sprites.
//
// UNIT CONVERSIONS (DELTARUNE 30 FPS -> our fixed 60 Hz):
//  * speeds/rotations are PER-FRAME @30fps -> multiply by F (=0.5) for per-tick @60fps.
//  * absolute delays stay in real seconds (seconds*60 = ticks).
//  * DISPLAY size: SZ(nativeMax, dispPx) -> the scale that draws the sprite at dispPx
//    (our draw = native*scale*1.6). Native sizes: spade36 heart18 club34 clubball18
//    diamond33 jdevil47 jdevilgiant62.
//  * HURTBOX: b.r ~= recipe_hurtbox/2 - 2 (our collision adds SOUL_R=5), kept smaller
//    than the sprite for tight grazing; rect blades use hitW/hitH; b.grazeR per recipe.
// ============================================================================
const F = 0.5;
const SZ = (nat, disp) => disp / (nat * 1.6);
const SC_SPADE12 = SZ(36, 12), SC_SPADE16 = SZ(36, 16), SC_SPADE32 = SZ(36, 26), SC_HEART24 = SZ(18, 24), SC_HEART16 = SZ(18, 16),
      SC_CLUB24 = SZ(34, 24), SC_CLUB16 = SZ(18, 16), SC_DIA = SZ(33, 16),
      SC_DEVIL = SZ(47, 64), SC_DEVILSM = SZ(47, 46), SC_DEVILRED = SZ(62, 92), SC_DEVILGIANT = SZ(47, 84), SC_DEVILULT = SZ(47, 190), SC_BOMB = SZ(23, 26);

PATTERNS.jx_spread = {   // Five-Spade Teleport Spread. spade 16px | hurtbox 8 | graze 24 | speed 6px/f
  dur: 340, box: { w: 160, h: 160 },
  tick(a) {
    const { f, box, tier, add, soul } = a;
    const CYC = rate(30, tier), k = Math.floor(f / CYC);   // teleport + fan every 0.5s, 10 waves
    if (k >= 10) return;
    const left = (k % 2) === 0;
    const oy = box.y + box.h * (0.2 + ((k * 37) % 100) / 100 * 0.6);       // random Y 20%-80%
    a.fx.boss = { key: 'jevilcast', x: left ? box.x - 40 : box.x + box.w + 40, y: oy, scale: 1, flip: !left };
    if (f % CYC === 0) {
      const ox = left ? box.x - 18 : box.x + box.w + 18;
      const base = Math.atan2(soul.y - oy, soul.x - ox);                   // middle spade AIMED
      for (const off of [-0.524, -0.262, 0, 0.262, 0.524]) {              // -30, -15, 0, +15, +30 deg
        const ang = base + off;
        add({ ...bulletProps('suitspade'), x: ox, y: oy, vx: Math.cos(ang) * 6 * F, vy: Math.sin(ang) * 6 * F, rot: ang, spin: 0, r: 2, grazeR: 7, scale: SC_SPADE12 });   // smaller, points travel dir (sprite faces right)
      }
    }
  },
};
PATTERNS.jx_spiral = {   // Spade Spiral. large spade 32px | hurtbox 16 | graze 40 | speed 5.5 then 7.0px/f
  dur: 280, box: { w: 160, h: 160 },
  tick(a) {
    const { f, box, add } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, R = 130;         // 140px ring, clamped to the 160 box
    for (const w0 of [0, 120]) {
      if (f !== w0) continue;
      const dir = w0 === 0 ? -1 : 1, spd = (w0 === 0 ? 5.5 : 7.0) * F;      // wave 2 is faster
      for (let i = 0; i < 10; i++) {                                        // 10 spades, 36 deg apart
        const ang = i / 10 * Math.PI * 2, x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R;
        const toC = Math.atan2(cy - y, cx - x);                            // PURE inward -> each spade drives straight THROUGH the centre and out the far side (no safe middle)
        const vx = Math.cos(toC) * spd, vy = Math.sin(toC) * spd;
        add({ ...bulletProps('suitspade'), x, y, vx: 0, vy: 0, r: 6, grazeR: 15, scale: SC_SPADE32, spin: 0, rot: Math.atan2(vy, vx),   // points travel dir
              noHit: true, fireAt: 24 + i * 4, fireVX: vx, fireVY: vy, life: 24 + i * 4 + 200 });   // 0.4s tell, launch 0.06s apart, live long enough to cross + exit
      }
    }
  },
};
PATTERNS.jx_heartbomb = {   // Heart Bomb (HORIZONTAL): bomb-sprite hearts fly in from the SIDE, burst into a SPACED
  dur: 360, box: { w: 160, h: 160 },   // 4-heart cluster that spins while continuing across. bomb 4px/f, cluster 3px/f + 0.1rad/f
  tick(a) {
    const { f, box, tier, add } = a;
    const CYC = rate(48, tier);                                            // a bomb every 0.8s
    if (f % CYC === 0 && f < 300) {
      const k = f / CYC, left = (k % 2) === 0, dir = left ? 1 : -1;
      const LANES = [0.12, 0.62, 0.37, 0.87, 0.25, 0.75, 0.5, 0.06, 0.94];  // fixed spread hits top, bottom & middle every run
      const y = box.y + box.h * LANES[k % LANES.length];                    // no permanent safe zone anywhere vertically
      const bomb = { ...bulletProps('jbombheart0'), animKeys: ['jbombheart0', 'jbombheart1'], animRate: 8,
                     x: left ? box.x - 16 : box.x + box.w + 16, y, vx: dir * 4 * F, vy: 0, r: 6, grazeR: 11, scale: SC_BOMB, _burstX: left ? box.x + box.w * 0.35 : box.x + box.w * 0.65 };
      bomb.emit = function (b, out) {
        if ((dir > 0 ? b.x >= b._burstX : b.x <= b._burstX) && !b._done) {
          b._done = 1; b.dead = true;
          const cx = b.x, cy = b.y;
          for (let i = 0; i < 4; i++) { const ang = i / 4 * Math.PI * 2 + Math.PI / 4;   // SPACED 4-heart square (R 26) continuing across
            out.push({ ...bulletProps('suitheart'), x: cx + Math.cos(ang) * 26, y: cy + Math.sin(ang) * 26, r: 2, grazeR: 7, scale: SC_HEART16,
                       orbit: { cx, cy, R: 26, w: 0.1 * F, ang, vx: dir * 3 * F }, life: 170 }); }
        }
      };
      add(bomb);
    }
  },
};
PATTERNS.jx_clubbomb = {   // Club Bomb. bomb 24px/hb12 | club 16px/hb8 | bomb 5px/f, burst 5.5px/f aimed +/-20
  dur: 340, box: { w: 160, h: 160 },
  tick(a) {
    const { f, box, tier, add } = a;
    const CYC = rate(36, tier);                                            // a bomb every 0.6s
    if (f % CYC === 0 && f < 300) {
      const k = f / CYC, x = box.x + box.w * (0.1 + ((k * 61) % 100) / 100 * 0.8);
      const bomb = { ...bulletProps('jbombclub0'), animKeys: ['jbombclub0', 'jbombclub1'], animRate: 8, x, y: box.y - 16, vx: 0, vy: 5 * F, r: 6, grazeR: 11, scale: SC_BOMB };
      bomb.emit = function (b, out, s) {
        if (b.y >= box.y + 14 && !b._done) {
          b._done = 1; b.dead = true;
          const base = Math.atan2(s.y - b.y, s.x - b.x);                   // middle AIMED, outer +/-20 deg
          for (const off of [-0.349, 0, 0.349]) { const ang = base + off;
            out.push({ ...bulletProps('suitclub'), x: b.x, y: b.y, vx: Math.cos(ang) * 5.5 * F, vy: Math.sin(ang) * 5.5 * F, r: 2, grazeR: 7, scale: SC_CLUB16, spin: 0, rot: ang }); }   // clubs point travel dir
        }
      };
      add(bomb);
    }
  },
};
PATTERNS.jx_diamond = {   // Diamond Shower. vertical diamond 12x16px | hurtbox 6x8. A solid diamond TELLS at the
  dur: 360, box: { w: 160, h: 160 },   // bottom (parked, no hit) showing where it will fire, then launches UP ~5.5px/f. ~60% density.
  tick(a) {
    const { f, rng, box, add } = a;
    if (f < 290 && f % (f < 180 ? 5 : 4) === 0) {   // ~60% of the old rate
      const x = box.x + box.w * (0.05 + rng() * 0.9);
      add({ ...bulletProps('suitdiamondv'), tint: '#fff', x, y: box.y + box.h - 6, vx: 0, vy: 0, r: 3, grazeR: 8, spin: 0, scale: SC_DIA,
            noHit: true, fireAt: 24, fireVX: 0, fireVY: -5.5 * F, life: 120 });   // solid WHITE diamond parks at bottom as the tell (0.4s), then fires up
    }
  },
};
// Both carousels reuse the GAME'S proven fake-3D CYLINDER (updCarousel): 8 columns x 3 rows rotate
// around a cylinder with the box inside; the far side is hidden, front columns bob - slip the gaps.
// (Recipe: horse hurtbox 16 much smaller than the 48px sprite - the cylinder keeps r tight below.)
function jxCarousel(a, keyFor) {
  const { f, rng, box, add } = a;
  if (f !== 0) return;
  const cols = 6, rows = 3, cx = box.x + box.w / 2, R = box.w / 2 + 24;
  const rowGap = box.h * 0.34, midY = box.y + box.h / 2;
  for (let c = 0; c < cols; c++) { const ang0 = c / cols * Math.PI * 2;
    for (let r = 0; r < rows; r++) { const rowY = midY + (r - 1) * rowGap;
      add({ ...bulletProps(keyFor(c, r, rng)), x: cx, y: rowY, vx: 0, vy: 0, r: 7, grazeR: 14,
            carousel: { ang: ang0, w: 0.018, R, cx, rowY, bob: box.h * 0.11, phase: ang0 } }); } }
}
PATTERNS.jx_carousel_h = {   // Carousel (horses): the cylinder, random duck-horse variants
  dur: 520, box: { w: 160, h: 160 },
  tick(a) { jxCarousel(a, (c, r, rng) => 'carousel' + Math.floor(rng() * 3)); },
};
PATTERNS.jx_carousel_hd = {   // Carousel (horses & ducks): the cylinder, alternating horse/duck sprites + a rare Everyman (1%)
  dur: 520, box: { w: 160, h: 160 },
  tick(a) { jxCarousel(a, (c, r, rng) => { const duck = (c + r) % 2 === 1; return duck ? (rng() < 0.01 ? 'carousel2' : 'carousel1') : 'carousel0'; }); },
};
PATTERNS.jx_scythes = {   // Orbiting Devilsknives. scythe 64px | hurtbox r12 circle | graze 56 | orbit 0.04 spin 0.15 rad/f
  dur: 420, box: { w: 160, h: 160 },
  tick(a) {
    const { f, box, add } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f === 0) for (let k = 0; k < 4; k++)
      add({ ...bulletProps('jdevil'), x: cx, y: cy, r: 8, grazeR: 20, scale: SC_DEVILSM, spin: 0.24 * F, vx: 0, vy: 0, life: 400,   // smaller + faster spin
            orbit: { cx, cy, R: 58, w: 0.075 * F, ang: k * Math.PI / 2, pulse: { base: 58, amp: 10, freq: 0.03 * F },
                     center: { cx0: cx, cy0: cy, ax: 34, ay: 26, f: 0.02 * F } } });   // orbit centre WANDERS so the middle isn't a free safe spot
  },
};
PATTERNS.jx_redsweep = {   // Red Devilsknife Sweep. grey scythe 64px + red 128px/hb 80x32 | red speed 8px/f
  dur: 380, box: { w: 160, h: 160 },
  tick(a) {
    const { f, box, add } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f === 0) for (let k = 0; k < 4; k++)
      add({ ...bulletProps('jdevil'), x: cx, y: cy, r: 8, grazeR: 20, scale: SC_DEVILSM, spin: 0.24 * F, vx: 0, vy: 0, life: 380,   // smaller + faster
            orbit: { cx, cy, R: 52, w: 0.075 * F, ang: k * Math.PI / 2, center: { cx0: cx, cy0: cy, ax: 30, ay: 24, f: 0.02 * F } } });   // wandering centre
    // 4 red sweeps alternating TOP/BOTTOM lanes at 0.5 / 1.8 / 3.1 / 4.4s
    const sweeps = [[30, 0.25, 1], [108, 0.75, -1], [186, 0.25, 1], [264, 0.75, -1]];
    for (const [t, laneP, dir] of sweeps) if (f === t)
      add({ ...bulletProps('jdevilgiant'), tint: '#e83030', x: dir > 0 ? box.x - 70 : box.x + box.w + 70, y: box.y + box.h * laneP,
            vx: dir * 8 * F, vy: 0, scale: SC_DEVILRED, spin: 0.1 * F, hitW: 52, hitH: 18, flip: dir < 0 });   // smaller red blade
  },
};
PATTERNS.jx_finalchaos = {   // Final Chaos (ult). full-screen arena; devilsknife (same sprite as the orbiting set,
  dur: 900, box: { w: 160, h: 160 },   // just bigger) -> full-height light beam; ends with a huge descending ultimate + white flash.
  tick(a) {
    const { f, rng, box, tier, add } = a;
    a.fx.arena = true;
    const gY = box.y + box.h - 8;
    const drop = (x, vy) => {   // a scythe -> smashes into a full-height light beam (thick column)
      const k = { ...bulletProps('jdevil'), x, y: box.y + 30, vx: 0, vy, spin: 0.04, scale: SC_DEVILGIANT, hitW: 58, hitH: 18, _gy: gY };
      k.emit = function (b, out) {
        if (b.y >= b._gy && !b._s) { b._s = 1; b.dead = true;
          out.push({ shape: 'line', color: '#fff', x: b.x, y: box.y + box.h / 2, rot: Math.PI / 2, len: box.h + 40, thick: 26, armed: true, life: 24, dmg: b.dmg, vx: 0, vy: 0 });   // beam lingers 0.4s
          Snd.play('boarddmg', 0.3);
        }
      };
      add(k);
    };
    if (f >= 30 && f < 420 && (f - 30) % 18 === 0) drop(box.x + 30 + rng() * (box.w - 60), 12 * F);   // PHASE 1: random rain every 0.3s @12px/f (doubled spacing)
    const seq = f - 440;                                                                              // PHASE 2: edges -> centre, 0.4s apart (doubled)
    if (seq >= 0 && seq < 120 && seq % 24 === 0) {
      const pairs = [[0.1, 0.9], [0.25, 0.75], [0.4, 0.6], [0.5]][Math.floor(seq / 24)];
      if (pairs) for (const p of pairs) drop(box.x + box.w * p, 12 * F);
    }
    // PHASE 3: the ULTIMATE scythe (190px, hurtbox 150x46) descends over ~2.5s, stops with a 30px safe zone at the bottom
    if (f === 580) add({ ...bulletProps('jdevil'), x: box.x + box.w / 2, y: box.y - 90, vx: 0, vy: 0,
                         lerpY: box.y + box.h - 30 - 20, lerpRate: 0.035, spin: 0.02, scale: SC_DEVILULT, hitW: 150, hitH: 46, life: 320 });
    if (f > 860) { a.fx.whiteout = Math.min(1, (f - 860) / 24); a.fx.shake = 8; }                     // white-flash ending (well after the ultimate is on-screen)
  },
};

// GREEN SOUL test bench: locks the soul, you aim Susie's axe to BLOCK. Square (4-way) then octagon
// (8-way), plus multi-hit turtle shells (colour = blocks left) — regular and spinning. Tester only.
PATTERNS.green_test = {
  dur: 1300, box: { w: 170, h: 170 },
  tick(a) {
    const { f, box, add, rng } = a;
    const oct = f >= 520;                       // square first, octagon after ~8.7s
    a.fx.greenSoul = oct ? { oct: true } : true;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, R = 190;
    const fire = (dir, sp, dmg) => add({ ...bulletProps('knighttooth'), x: cx + Math.cos(dir) * R, y: cy + Math.sin(dir) * R,
      vx: -Math.cos(dir) * sp, vy: -Math.sin(dir) * sp, r: 7, rot: dir + Math.PI, scale: 0.85, grazeR: 0, dmg: dmg || 14 });
    // aimed bullets from a snapped side, telegraphed by the cadence
    if (f > 40 && f % 26 === 0) {
      const slots = oct ? 8 : 4, step = Math.PI * 2 / slots;
      fire(Math.floor(rng() * slots) * step, 2.3);
    }
    // turtle shells: 1..5 blocks, ~40% spinning (return 90 deg CCW). Come from a random side.
    if (f > 120 && f % 170 === 60) {
      const slots = oct ? 8 : 4, step = Math.PI * 2 / slots, dir = Math.floor(rng() * slots) * step;
      const n = 1 + Math.floor(rng() * 5), sp = 1.9;
      add({ shape: 'shell', shell: true, blocksLeft: n, shellSpin: rng() < 0.4, shellSpeed: sp,
            x: cx + Math.cos(dir) * R, y: cy + Math.sin(dir) * R, vx: -Math.cos(dir) * sp, vy: -Math.sin(dir) * sp, r: 10, dmg: 18 });
    }
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
// one GREEN spear from GML direction `gd`, inward speed `spd`; block by facing its side.
function gSpear(a, gd, spd, opt) {
  opt = opt || {}; const { box, add } = a, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const va = -gd * Math.PI / 180, D = opt.dist || 210;
  add({ ...bulletProps('gchevron'), x: cx - Math.cos(va) * D, y: cy - Math.sin(va) * D,
        vx: Math.cos(va) * spd, vy: Math.sin(va) * spd, r: 8, scale: GSC(22, 20), rot: va, blockArc: 50, dmg: opt.dmg || 18, life: opt.life || 200 });
  Snd.play('smallswing', 0.35);
}
// GREEN multi-block turtle shell from side `gd` (needs `hp` blocks; spinning -> returns 90 CCW).
function gShell(a, gd, hp) {
  const { box, add } = a, cx = box.x + box.w / 2, cy = box.y + box.h / 2, va = -gd * Math.PI / 180, D = 220, spd = 4;
  add({ shape: 'shell', shell: true, blocksLeft: hp, shellSpin: true, shellSpeed: 4, x: cx - Math.cos(va) * D, y: cy - Math.sin(va) * D,
        vx: Math.cos(va) * spd, vy: Math.sin(va) * spd, r: 10, blockArc: 50, dmg: 20 });
}
// play a fixed spear sequence (each entry [gmlTick, gmlDirString-or-number, speed]); auto green.
function gSeq(a, seq, oct) { a.fx.greenSoul = oct ? { oct: true } : true;
  for (const e of seq) if (a.f === e[0]) gSpear(a, typeof e[1] === 'string' ? G_STR2GML[e[1]] : ((e[1] % 360) + 360) % 360, e[2]); }

// --- GREEN: SPEAR VOLLEY (fight) = AP 0 warm-up: 3 up jabs, then l / d / r on the double-beat. ---
PATTERNS.gerson_spears = {
  dur: 300, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f } = a; a.fx.greenSoul = true;
    let t = 20, seq = []; const rounds = [['u', 6.4, 14], ['u', 6.4, 14], ['u', 6.4, 28], ['l', 8, 28], ['d', 6.4, 28], ['r', 8, 28]];
    for (let rep = 0; rep < 3; rep++) for (const [d, s, w] of rounds) { seq.push([t, d, s]); t += w; }
    gSeq(a, seq);
  },
};
// --- GREEN: UPPER-ARC BARRAGE (AP 6) — ul/u/ur pulse accelerating, then a quick down finisher. octagon. ---
PATTERNS.gerson_barrage = {
  dur: 300, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f } = a; a.fx.greenSoul = { oct: true };
    const rows = [['ul', 10, 10], ['ul', 10, 10], ['u', 10, 10], ['u', 10, 10], ['ur', 12, 15], ['ur', 12, 30],
                  ['ul', 14, 10], ['u', 14, 10], ['ur', 14, 10], ['u', 14, 5], ['u', 14, 5], ['ul', 14, 10],
                  ['u', 16, 10], ['ur', 20, 30], ['d', 16, 12], ['dl', 20, 12], ['d', 16, 8], ['dr', 20, 8]];
    let t = 20, seq = []; for (const [d, s, w] of rows) { seq.push([t, d, s]); t += w; }
    for (const e of seq) if (f === e[0]) gSpear(a, G_STR2GML[e[1]], e[2]);
  },
};
// --- GREEN: ROTATING SPEAR SWEEP (AP 53) — 45deg sweeps, 4-beat, ending in a 30-spear ramp. octagon. ---
PATTERNS.gerson_spearsweep = {
  dur: 340, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f } = a; a.fx.greenSoul = { oct: true };
    let t = 10, seq = [];
    for (let i = 0; i < 5; i++) { seq.push([t, 90 + 45 * i, 9]); t += 4; } t += 8;
    for (let i = 0; i < 5; i++) { seq.push([t, 180 - 45 * i, 9]); t += 4; } t += 8;
    for (let i = 0; i < 5; i++) { seq.push([t, 90 + 45 * i, 9]); t += 4; } t += 8;
    for (let i = 0; i < 11; i++) { seq.push([t, 180 - 45 * i, 9]); t += 4; } t += 8;
    for (let i = 0; i < 30; i++) { seq.push([t, 90 + 45 * i, 9 + 0.5 * i]); t += 4; }
    for (const e of seq) if (f === e[0]) gSpear(a, ((e[1] % 360) + 360) % 360, e[2]);
  },
};
// --- GREEN: SHELL VOLLEY — spears interleaved with multi-block turtle shells (AP 7/13 flavour). ---
PATTERNS.gerson_shellvolley = {
  dur: 360, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f } = a; a.fx.greenSoul = true;
    const spears = [[24, 'l', 8], [48, 'r', 8], [72, 'u', 8], [96, 'd', 8], [180, 'r', 8], [204, 'l', 8], [228, 'u', 8], [300, 'd', 8], [324, 'l', 8]];
    for (const e of spears) if (f === e[0]) gSpear(a, G_STR2GML[e[1]], e[2]);
    if (f === 120) gShell(a, G_STR2GML.l, 2);
    if (f === 150) gShell(a, G_STR2GML.r, 3);
    if (f === 264) gShell(a, G_STR2GML.u, 2);
  },
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
// --- RED (free move): SWING DOWN + RED HAMMER (AP 4/9) — swing_down_new telegraphs a slice zone then
// slashes through it fast; red-hammer spears sweep a fixed compass line across the box. ---
PATTERNS.gerson_swingdown = {
  dur: 320, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f, box, add } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    // swing_down_new: telegraph (image_alpha ramp) then a fast slash. Half/diagonal zones.
    const SEQ = [[30, 0], [78, 1], [126, 2], [174, 3], [222, 4]];
    for (const [t, kind] of SEQ) { if (f !== t) continue;
      if (kind < 4) { const horiz = kind >= 2, off = (kind % 2 === 0) ? -38 : 38;
        add({ shape: 'line', color: '#f33', len: (horiz ? box.w : box.h) * 1.6, thick: 72,
              x: horiz ? cx : cx + off, y: horiz ? cy + off : cy, rot: horiz ? 0 : Math.PI / 2, vx: 0, vy: 0, tellT: 12, armWindow: 4, dmg: 26 });
      } else add({ shape: 'line', color: '#f33', len: Math.hypot(box.w, box.h) * 1.6, thick: 52, x: cx, y: cy, rot: Math.PI / 4, vx: 0, vy: 0, tellT: 12, armWindow: 4, dmg: 26, shakeOnCut: true });
    }
    // red-hammer spears: big fast spears sweeping fixed compass lines across the box (grav 0.3 in GML)
    if ([54, 102, 150, 198, 258].includes(f)) {
      const side = [0, 90, 180, 270][Math.floor((f / 48) % 4)], va = -side * Math.PI / 180, D = 200;
      add({ ...bulletProps('ghammerd'), x: cx - Math.cos(va) * D, y: cy - Math.sin(va) * D, vx: Math.cos(va) * 6, vy: Math.sin(va) * 6, ay: 0.075,
            r: 10, grazeR: 15, scale: GSC(23, 44), rot: va, dmg: 28, life: 120 });
    }
  },
};
// --- RED (ult): FINALE (AP 19) — a dense gigashell + spear barrage with swing-down cuts. (provisional;
// refined from the AP-19 sequence.) ---
PATTERNS.gerson_finale = {
  dur: 460, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f, box, add, rng } = a;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    a.fx.greenSoul = true;
    // dense multi-block shells from rotating sides
    if (f % 34 === 20 && f < 300) gShell(a, [0, 90, 180, 270][Math.floor(f / 34) % 4], 2 + Math.floor(rng() * 3));
    // spear rain between shells
    if (f % 12 === 6 && f < 360) gSpear(a, [0, 45, 90, 135, 180, 225, 270, 315][Math.floor(f / 12) % 8], 10 + rng() * 4);
    // swing-down cuts as punctuation
    if ([90, 180, 270, 360].includes(f))
      add({ shape: 'line', color: '#f33', len: Math.hypot(box.w, box.h) * 1.6, thick: 60, x: cx, y: cy, rot: (f / 90) * Math.PI / 4, vx: 0, vy: 0, tellT: 12, armWindow: 4, dmg: 30, shakeOnCut: true, noHit: false });
  },
};
// #A BOX THROW (AP70, RED free-move) — despite the name it LOBS arcing hammers into the box: 16 fan-throws,
// then 25 fast singles tracking a sine-swept x, then one giant hammer finisher.
PATTERNS.gerson_boxthrow = {
  dur: 403, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f, box, add, rng } = a; const cx = box.x + box.w / 2, gx = box.x + box.w + 40, gy = box.y - 18;
    if (f >= 36 && f < 196 && (f - 36) % 10 === 0) {                 // PHASE 0: 16 fan-throws of 3-4 hammers
      const n = 3 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) { const off = rng() * 60 - 30;
        const vx = -Math.abs(gx - (cx + off)) / 45 + (-2 + (4 / (n - 1)) * i) + (rng() - 0.5), vy = -14 + (-1 + (2 / (n - 1)) * i) + (rng() * 2 - 1);
        add({ ...bulletProps('ghammer'), x: gx, y: gy, vx, vy, ay: 0.6, maxv: 16, r: 8, grazeR: 13, scale: GSC(23, 44), spin: 0.24, dmg: 28, life: 130 }); }
      Snd.play('smallswing', 0.3);
    }
    const p1 = f - 196;                                              // PHASE 1: 25 fast singles at a sine-swept x
    if (p1 >= 0 && p1 < 100 && p1 % 4 === 0) {
      const tx = cx + Math.sin(f * 0.325) * 60;
      add({ ...bulletProps('ghammer'), x: gx, y: gy, vx: -Math.abs((gx - tx) / 45), vy: -14, ay: 0.6, maxv: 16, r: 8, grazeR: 13, scale: GSC(23, 44), spin: 0.24, dmg: 28, life: 130 });
    }
    if (f === 305) { add({ ...bulletProps('ggiant'), x: gx, y: gy, vx: -Math.abs((gx - cx) / 25.5), vy: -16, ay: 0.6, maxv: 20, spin: 0.1, scale: GSC(92, 120), r: 16, hitW: 60, hitH: 60, dmg: 40, life: 140 }); Snd.play('smallswing', 0.5); }
  },
};
// #B SQUISH-BOX SPEAR RAIN (AP47, RED) — the box flattens into a wide thin strip, then hammer-smash columns
// rain straight down at fixed x's; weave between the columns.
PATTERNS.gerson_squish = {
  dur: 460, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f, box, add } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f > 34) a.fx.boxTarget = { x: cx - 190, y: cy - 24, w: 380, h: 48 };   // squash wide + flat
    const COLS = [100, 150, 200, 250, 300, 350, 400, 450, 550, 500, 450, 400, 350, 300, 250, 200, 100, 150, 300, 350, 500, 550, 100, 150, 200, 250, 400, 450];
    if (f >= 55 && (f - 55) % 5 === 0) {
      const idx = (f - 55) / 5;
      if (idx < COLS.length) { const colX = cx - 190 + (COLS[idx] - 80) / 470 * 380;
        add({ ...bulletProps('gswdown'), x: colX, y: cy - 60, vx: 0, vy: 0, noHit: true, scale: GSC(40, 50), rot: 0, fireAt: 22, fireVX: 0, fireVY: 14, r: 7, grazeR: 12, dmg: 26, life: 90 });
      }
    }
  },
};
// #C RUDE BUSTER (RED) — Gerson lobs a slow homing orb; press [Z] when it's CLOSE to knock it back for TP
// (b.deflectable), or eat a big hit. A deflect duel.
PATTERNS.gerson_rudebuster = {
  dur: 300, box: { w: 150, h: 150 }, hz30: 1,
  tick(a) {
    const { f, box, add, soul } = a; const gx = box.x + box.w + 40, gy = box.y - 10;
    if (f % 90 !== 10 || f >= 270) return;
    const ang = Math.atan2(soul.y - gy, soul.x - gx);
    add({ color: '#ff3b6b', x: gx, y: gy, vx: Math.cos(ang) * 4, vy: Math.sin(ang) * 4, r: 11, grazeR: 0, homing: 0.1, deflectable: 1, deflectR: 34, spin: 0.1, dmg: 44, life: 220 });
    Snd.play('smallswing', 0.4);
  },
};

// ============================================================================
// PINK — Ch5 idol boss (mew magical-girl). Rebuilt from real GML (30fps -> hz30). Real ripped
// Ch5 sprites. NOTE: the real fight uses the PURPLE string-soul (grid/web movement) + DOKI/DATE
// machinery; this v1 uses RED free-move as an approximation (purple-soul mode = follow-up).
// ============================================================================
const PS = g => g / 1.6;   // GML image_xscale -> our scale
// TYPE 200 — CATS: cat bullets stream in from the sides in 3 rows (56px apart).
PATTERNS.pink_cats = {
  dur: 340, hz30: 1,
  tick(a) {
    const { f, box, add, rng } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f % 13 !== 0 || f > 300) return;
    const side = rng() < 0.5 ? -1 : 1, lane = Math.floor(rng() * 3);
    add({ ...bulletProps('pcat'), x: cx + side * (box.w / 2 + 30), y: cy + (lane - 1) * 52, vx: -side * 9, vy: 0, r: 8, grazeR: 13, scale: PS(2), spin: 0.05, dmg: 24, life: 170 });
    if (rng() < 0.4) add({ ...bulletProps('pdoki'), x: cx + side * (box.w / 2 + 30), y: cy + (Math.floor(rng() * 3) - 1) * 52, vx: -side * 7, vy: 0, r: 6, grazeR: 12, scale: PS(1.4), dmg: 20, life: 170 });
    Snd.play('boardsummon', 0.25);
  },
};
// TYPE 206 — PIÑATA BOMBS: fusebombs land on a 4x4 grid, then detonate into a row+column cross of beams.
PATTERNS.pink_bombs = {
  dur: 300, hz30: 1,
  tick(a) {
    const { f, box, add, rng } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f < 20 || f % 16 !== 0 || f > 260) return;
    const gx = Math.floor(rng() * 4), gy = Math.floor(rng() * 4), x = cx - 60 + gx * 40, y = cy - 60 + gy * 40;
    const bomb = { ...bulletProps('pbomb'), x, y, vx: 0, vy: 0, r: 7, grazeR: 11, scale: PS(2.4), spin: 0.15, _fuse: 60, dmg: 20 };
    bomb.emit = function (b, out) {
      if (b.t >= b._fuse && !b._done) {
        b._done = 1; b.dead = true; Snd.play('boardbomb', 0.35);
        out.push({ ...bulletProps('pboom'), shape: 'line', color: '#ff7fd0', x: b.x, y: b.y, rot: 0, len: box.w * 1.4, thick: 14, armed: true, life: 16, dmg: b.dmg, vx: 0, vy: 0 });
        out.push({ shape: 'line', color: '#ff7fd0', x: b.x, y: b.y, rot: Math.PI / 2, len: box.h * 1.4, thick: 14, armed: true, life: 16, dmg: b.dmg, vx: 0, vy: 0 });
      }
    };
    add(bomb);
  },
};
// TYPE 204 — BELL/CAT LANES: three vertical cat streams at cx-28/cx/cx+28, different rates.
PATTERNS.pink_lanes = {
  dur: 340, hz30: 1,
  tick(a) {
    const { f, box, add } = a; const cx = box.x + box.w / 2;
    const lanes = [[7, -28, 1, 3.2], [10, 0, -1, 2.0], [36, 28, 1, 1.25]];   // [interval, xoff, dir(1=down/-1=up), speed]
    for (const [intv, xo, dir, spd] of lanes) if (f % intv === 0 && f < 300) {
      const y = dir === 1 ? box.y - 16 : box.y + box.h + 16;
      add({ ...bulletProps('pcat'), x: cx + xo, y, vx: 0, vy: dir * spd * 2, r: 7, grazeR: 12, scale: PS(2), spin: 0.05, dmg: 22, life: 170 });
    }
    if (f % 44 === 0 && f < 300) add({ ...bulletProps('pbell'), x: cx, y: box.y - 18, vx: 0, vy: 3, r: 8, grazeR: 13, scale: PS(2), spin: 0.08, dmg: 22, life: 160 });
  },
};
// TYPE 202 — ROTATING BOX: lane bullets fire inward from a rotating cardinal, with perpendicular offshoots.
PATTERNS.pink_rotbox = {
  dur: 300, hz30: 1,
  tick(a) {
    const { f, box, add } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f % 20 !== 0 || f < 20 || f > 260) return;
    const dir = (Math.floor(f / 20) % 4) * 90, va = -dir * Math.PI / 180, D = box.w * 0.9;
    const sx = cx - Math.cos(va) * D, sy = cy - Math.sin(va) * D;
    add({ ...bulletProps('planeb'), x: sx, y: sy, vx: Math.cos(va) * 8, vy: Math.sin(va) * 8, rot: va, r: 7, grazeR: 12, scale: PS(2), dmg: 24, life: 130 });
    const px = Math.cos(va + Math.PI / 2) * 52, py = Math.sin(va + Math.PI / 2) * 52;
    for (const s of [-1, 1]) add({ ...bulletProps('plane'), x: sx + px * s, y: sy + py * s, vx: Math.cos(va) * 8, vy: Math.sin(va) * 8, rot: va, r: 6, grazeR: 11, scale: PS(1.7), dmg: 20, life: 130 });
    Snd.play('boardsummon', 0.25);
  },
};
// TYPE 209 — SINGING (ult, idol concert): cats from the sides + bells raining + a doki flourish finale.
PATTERNS.pink_idol = {
  dur: 460, hz30: 1,
  tick(a) {
    const { f, box, add, rng } = a; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f % 10 === 0 && f < 400) { const side = rng() < 0.5 ? -1 : 1;
      add({ ...bulletProps('pcat'), x: cx + side * (box.w / 2 + 30), y: cy + (Math.floor(rng() * 3) - 1) * 52, vx: -side * 9, vy: 0, r: 7, grazeR: 12, scale: PS(2), spin: 0.05, dmg: 22, life: 170 }); }
    if (f % 16 === 8 && f < 400) add({ ...bulletProps('pbell'), x: box.x + rng() * box.w, y: box.y - 18, vx: 0, vy: 4, r: 7, grazeR: 12, scale: PS(2), spin: 0.1, dmg: 22, life: 160 });
    if (f === 410) { for (let i = 0; i < 16; i++) { const ang = i / 16 * 6.28; add({ ...bulletProps('pdoki'), x: cx, y: cy, vx: Math.cos(ang) * 5, vy: Math.sin(ang) * 5, rot: ang, r: 6, grazeR: 11, scale: PS(1.6), dmg: 24, life: 130 }); } Snd.play('boardbomb', 0.5); }
    if (f > 430) a.fx.shake = 6;
  },
};

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
    t += Math.max(1, Math.round(0.5 + (13 * chart[k + 2]) / 1.25));   // _bullet_interval_modifier = 1.25
  }
  sched.total = Math.round(t);
  return sched;
}
function pinkFireCat(add, cx, cy, e) {
  const spd = 8 * e.speed * (4 / 3);         // _bullet_speed_modifier = 4/3
  const vx = -e.side * spd;                   // side 1 spawns right (+416) moving left; -1 spawns left moving right
  if (e.lane < 3) {
    const y = cy + Math.floor(e.lane - 1) * 56;
    add({ ...bulletProps('pcat'), x: cx + e.side * 416, y, vx, vy: 0, r: 9, grazeR: 14, scale: PS(2), spin: e.speed >= 1.5 ? 0.14 : 0.03, dmg: 24, life: 420 });
    const nd = Math.round((e.lane % 1) * 10);   // frac(lane)*10 trailing doki-heart collectables
    for (let i = 1; i <= nd; i++)
      add({ ...bulletProps('pdoki'), x: cx + e.side * (416 - i * 72 * e.speed), y, vx, vy: 0, pickup: true, tp: 8, r: 8, scale: PS(1.5), life: 460 });
  } else if (e.lane >= 6 && e.lane <= 8) {
    add({ ...bulletProps('pdoki'), x: cx + e.side * 416, y: cy + (e.lane - 7) * 56, vx, vy: 0, pickup: true, tp: 8, r: 8, scale: PS(1.5), life: 460 });
  }
  // lane 3/4/5 = Pink dance-move triggers (obj_pink_battlemovement), cosmetic — no bullet
}
function pinkCatsPattern(chart) {
  return {
    box: { w: 150, h: 130 }, hz30: 1, dur: pinkCatsSchedule(chart).total + 90,
    tick(a) {
      const { f, box, add } = a; a.fx.purpleSoul = { mode: 1, diff: 0 };
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      if (f === 0) { this._sched = pinkCatsSchedule(chart); this._si = 0; }
      const s = this._sched;
      while (this._si < s.length && s[this._si].f <= f) pinkFireCat(add, cx, cy, s[this._si++]);
    },
  };
}
PATTERNS.pinkn_cats = pinkCatsPattern(PINK_CATS_D0);       // the "Cats" attack (difficulty 0)
PATTERNS.pinkn_cats2 = pinkCatsPattern(PINK_CATS_D1);      // harder variant (difficulty 1) — conga + fast finale
// TYPE 203/206 — Pinata bombs (purple mode 2: 4x4 grid, lane_distance 40). Bombs (obj_fusebomb) land ON
// the grid cells, fuse (pulsing faster near the end), then detonate: obj_pinkbombexplosion marches out
// 24px at a time in all 4 directions to the screen edge — a full row+column CROSS of explosion sprites.
// ~1/3 of bombs "have_heart" and drop a doki-heart TP collectable where they blew up. Hop off the cross.
PATTERNS.pinkn_bombs = {
  dur: 300, box: { w: 150, h: 150 }, hz30: 1,   // fits mode-2 grid: 4x4 cells at (lane-1.5)*40 -> ±60
  tick(a) {
    const { f, box, add, rng } = a; a.fx.purpleSoul = { mode: 2, diff: 0 };
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (f < 18 || f % 26 !== 0 || f > 250) return;
    const gx = Math.floor(rng() * 4), gy = Math.floor(rng() * 4);
    const x = cx + (gx - 1.5) * 40, y = cy + (gy - 1.5) * 40;
    const bomb = { ...bulletProps('pbomb'), x, y, vx: 0, vy: 0, noHit: true, scale: PS(2), _fuse: 50, _heart: rng() < 0.34, dmg: 20 };
    bomb.emit = function (b, out) {
      const F = b._fuse;
      if (b.t < F) {   // fuse pulse — subtle, then rapid in the final ~14 frames (telegraph)
        const near = b.t > F - 14;
        b.scale = PS(2) * (1 + (near ? 0.4 : 0.14) * Math.abs(Math.sin(b.t * (near ? 0.95 : 0.4))));
        return;
      }
      if (b._done) return;
      b._done = 1; b.dead = true;
      Snd.play('boardbomb', 0.5);
      if (typeof Battle !== 'undefined') { Battle.shake = Math.max(Battle.shake || 0, 12); Battle.flash = Math.max(Battle.flash || 0, 6); }
      out.push({ ...bulletProps('pexploc'), x: b.x, y: b.y, vx: 0, vy: 0, r: 11, scale: PS(2.2), life: 18, dmg: b.dmg });
      for (const [dx, dy] of [[24, 0], [0, -24], [-24, 0], [0, 24]]) {   // march out to the screen edge
        let px = b.x, py = b.y;
        for (let s = 0; s < 28; s++) {
          px += dx; py += dy;
          if (px < -24 || px > 664 || py < 36 || py > 500) break;
          out.push({ ...bulletProps('pboom'), x: px, y: py, vx: 0, vy: 0, r: 9, scale: PS(2), life: 16, dmg: b.dmg, rot: Math.atan2(dy, dx) + Math.PI / 2 });
        }
      }
      if (b._heart) out.push({ ...bulletProps('pdoki'), x: b.x, y: b.y, vx: 0, vy: 0, pickup: true, tp: 8, r: 8, scale: PS(1.5), life: 170 });
    };
    add(bomb);
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
