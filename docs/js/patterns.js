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

// ---------- KRIS ----------
PATTERNS.kris_slash = {
  dur: 440,
  tick(api) {
    const { f, rng, box, tier, add } = api;
    // horizontal sword waves with sine wobble
    if (every(f, rate(30, tier))) {
      const fromLeft = rng() < 0.5;
      add({
        x: fromLeft ? box.x - 30 : box.x + box.w + 30, y: box.y + 10 + rng() * (box.h - 20),
        vx: (fromLeft ? 1 : -1) * (1.9 + rng() * 0.9), vy: 0,
        shape: 'crescent', color: '#fff', r: 8,
        rot: fromLeft ? 0 : Math.PI, spin: fromLeft ? 0.1 : -0.1,
        sineA: 0.8, sineF: 0.06,
      });
    }
    // vertical guillotine drop aimed near the soul — keeps you moving off-axis
    if (every(f, rate(58, tier))) {
      add({
        x: api.soul.x + (rng() - 0.5) * 70, y: box.y - 26,
        vx: 0, vy: 0.6, ay: 0.07, maxv: 4,
        shape: 'crescent', color: '#fff', r: 8, rot: Math.PI / 2, spin: 0.14,
      });
    }
  },
};
PATTERNS.kris_cross = {
  dur: 480,
  tick(api) {
    const { f, rng, box, tier, add } = api;
    // rotating X: the 4 arms sweep around over time, so safe gaps keep moving
    if (every(f, rate(44, tier))) {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const R = Math.max(box.w, box.h) / 2 + 40;
      const base = f * 0.055;
      for (let k = 0; k < 4; k++) {
        const a = base + k * (Math.PI / 2);
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        const toC = Math.atan2(cy - y, cx - x);
        add({
          x, y, vx: Math.cos(toC) * 2.3, vy: Math.sin(toC) * 2.3,
          shape: 'crescent', color: '#fff', r: 8, rot: toC, spin: 0.14,
        });
      }
    }
  },
};
PATTERNS.kris_giga = {
  dur: 560,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(26, tier))) {
      const y = box.y + 8 + rng() * (box.h - 16);
      const fromLeft = rng() < 0.5;
      add({
        x: fromLeft ? box.x - 30 : box.x + box.w + 30, y,
        vx: (fromLeft ? 1 : -1) * (2.3 + rng() * 1.2), vy: 0,
        shape: 'crescent', color: '#fff', r: 10,
        rot: fromLeft ? 0 : Math.PI, spin: 0.16,
      });
    }
    if (every(f, rate(60, tier))) {
      // vertical guillotine drops aimed near soul
      const x = api.soul.x + (rng() - 0.5) * 90;
      add({
        x, y: box.y - 30, vx: 0, vy: 0.4, ay: 0.09, maxv: 4.5,
        shape: 'crescent', color: '#fff', r: 11, rot: Math.PI / 2, spin: 0,
      });
    }
  },
};

// ---------- SUSIE ----------
// (hitboxes are deliberately smaller than the big arc visuals -> graze-friendly)
PATTERNS.susie_axe = {
  dur: 420,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    // arcs sweep clean across (no boomerang trap), fast but dodgeable
    if (every(f, rate(36, tier))) {
      const fromLeft = rng() < 0.5;
      add({
        x: fromLeft ? box.x - 40 : box.x + box.w + 40, y: box.y + 14 + rng() * (box.h - 28),
        vx: (fromLeft ? 1 : -1) * (2.6 + rng() * 0.5), vy: (rng() - 0.5) * 0.5,
        img: pick(rng, imgs.arc), scale: 1.4, r: 7,
        rot: 0, spin: fromLeft ? 0.14 : -0.14,
      });
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
          img: pick(rng, imgs.arc), scale: 1.3, r: 8, spin: 0.18,
        });
      }
    }
    if (every(f, rate(52, tier))) {
      add({
        x: box.x + rng() * box.w, y: box.y + box.h + 18,
        vx: (rng() - 0.5) * 1.2, vy: -(2.4 + rng() * 1.2), ay: 0.05,
        img: pick(rng, imgs.arc), scale: 0.8, r: 6, spin: 0.2,
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
        img: pick(rng, imgs.arc), scale: 1.3 + rng() * 0.4, r: 8, spin: 0.2,
      });
    }
    if (every(f, rate(96, tier))) {
      // the BIG crescent: slow and telegraphed, hitbox well under the visual
      const fromLeft = rng() < 0.5;
      add({
        x: fromLeft ? box.x - 70 : box.x + box.w + 70,
        y: box.y + box.h / 2 + (rng() - 0.5) * 70,
        vx: (fromLeft ? 1 : -1) * 1.5, vy: 0,
        ...bulletProps('arc_red'), scale: 2.4, r: 14, flip: !fromLeft,
        sineA: 1.0, sineF: 0.03,
      });
    }
  },
};

// ---------- RALSEI ----------
PATTERNS.ralsei_scarf = {
  dur: 420,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(38, tier))) {
      // scarf ribbons snake across with strong sine
      const fromLeft = rng() < 0.5;
      add({
        x: fromLeft ? box.x - 34 : box.x + box.w + 34,
        y: box.y + 12 + rng() * (box.h - 24),
        vx: (fromLeft ? 1 : -1) * 1.9, vy: 0,
        shape: 'crescent', color: '#ff9fdf', r: 8,
        rot: fromLeft ? 0 : Math.PI,
        sineA: 1.6, sineF: 0.07,
      });
    }
    if (every(f, rate(70, tier))) {
      // soft star pellets that drift down
      add({
        x: box.x + rng() * box.w, y: box.y - 20,
        vx: (rng() - 0.5) * 0.8, vy: 1.1 + rng() * 0.5,
        shape: 'star', color: '#7fff9f', r: 5,
      });
    }
  },
};
PATTERNS.ralsei_ult = {
  dur: 560,
  tick(api) {
    const { f, rng, box, tier, add } = api;
    if (every(f, rate(16, tier))) {
      // spiraling music notes from center
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const ang = f * 0.35;
      for (let k = 0; k < 2; k++) {
        const a = ang + k * Math.PI;
        add({
          x: cx, y: cy, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5,
          ax: Math.cos(a) * 0.012, ay: Math.sin(a) * 0.012,
          shape: 'note', color: k ? '#ff9fff' : '#9fffb7', r: 6,
        });
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
        img: pick(rng, imgs.orb), scale: 0.9, r: 7,
        sineA: 0.5, sineF: 0.05,
      });
    }
    if (every(f, rate(90, tier))) {
      add({
        x: rng() < 0.5 ? box.x - 26 : box.x + box.w + 26, y: box.y + rng() * box.h,
        vx: 0, vy: 0, homing: 0.045, maxv: 2.0,
        img: imgs.snowflake[0], scale: 0.5, r: 8, spin: 0.05,
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
        ...bulletProps('icicle'), scale: 1.0,
      });
    }
    if (every(f, rate(46, tier))) {
      // shards bounce up from impact line
      add({
        x: box.x + rng() * box.w, y: box.y + box.h + 12,
        vx: (rng() - 0.5) * 2.0, vy: -(1.8 + rng() * 1.4), ay: 0.06,
        img: pick(rng, imgs.shard), scale: 1.1, r: 5, spin: 0.15,
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
        img: pick(rng, imgs.sparkle), scale: 1.3, r: 6,
      });
    }
    if (every(f, rate(50, tier))) {
      add({
        x: box.x + rng() * box.w, y: box.y - 30, vx: 0, vy: 0.4, ay: 0.1, maxv: 5.5,
        ...bulletProps('icicle'), scale: 1.25, r: 10,
      });
    }
    if (every(f, rate(120, tier))) {
      // the giant snowflake: slow homing menace
      add({
        x: rng() < 0.5 ? box.x - 50 : box.x + box.w + 50,
        y: box.y - 40, homing: 0.03, maxv: 1.6, vx: 0, vy: 0.8,
        img: imgs.snowflake[0], scale: 1.1, r: 16, spin: 0.03,
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
// ---------- BERDLY (medium attack, high projectile variety) ----------
PATTERNS.berdly_fight = {
  dur: 420,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(30, tier)))
      add({ ...bulletProps('spark'), x: box.x + rng() * box.w, y: box.y - 20,
            vx: (rng() - 0.5) * 1.2, vy: 1.6 + rng() * 0.8, spin: 0.1 });
  },
};
PATTERNS.berdly_bolt = {   // blue bolts strike down + side sparks
  dur: 480,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(44, tier)))
      add({ ...bulletProps('lightning'), x: box.x + 18 + rng() * (box.w - 36), y: box.y - 30,
            vx: 0, vy: 0.6, ay: 0.42, maxv: 7, scale: 1.4 });
    if (every(f, rate(30, tier)))
      add({ ...bulletProps('spark'), x: box.x + box.w + 20, y: box.y + rng() * box.h,
            vx: -(2 + rng()), vy: 0 });
  },
};
PATTERNS.berdly_books = {   // "high projectile variety" rain
  dur: 480,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(22, tier))) {
      const bs = ['diamond', 'kstar', 'snowflake', 'spark'];
      add({ ...bulletProps(bs[Math.floor(rng() * bs.length)]),
            x: box.x + rng() * box.w, y: box.y - 22,
            vx: (rng() - 0.5) * 0.9, vy: 1.4 + rng() * 1.1, spin: 0.12 });
    }
  },
};
PATTERNS.berdly_ult = {
  dur: 560,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(17, tier))) {
      const bs = ['lightning', 'snowflake', 'spark', 'kstar'];
      add({ ...bulletProps(bs[Math.floor(rng() * bs.length)]),
            x: box.x + rng() * box.w, y: box.y - 24,
            vx: (rng() - 0.5) * 1.4, vy: 1.8 + rng() * 1.2, spin: 0.12 });
    }
    if (every(f, rate(38, tier))) {
      const L = rng() < 0.5;
      add({ ...bulletProps('lightning'), x: L ? box.x - 20 : box.x + box.w + 20,
            y: box.y + rng() * box.h, vx: (L ? 1 : -1) * 3.2, vy: 0 });
    }
  },
};

// ---------- JEVIL (darkner boss - Difficult) ----------
PATTERNS.jevil_spade = {   // spinning spade fans aimed at the soul
  dur: 440,
  tick(a) {
    const { f, rng, box, tier, add, soul } = a;
    if (every(f, rate(26, tier))) {
      const L = rng() < 0.5, ox = L ? box.x - 16 : box.x + box.w + 16, oy = box.y - 14;
      for (let i = -1; i <= 1; i++) {
        const ang = Math.atan2(soul.y - oy, soul.x - ox) + i * 0.4;
        add({ ...bulletProps('spade'), x: ox, y: oy,
              vx: Math.cos(ang) * 2.4, vy: Math.sin(ang) * 2.4, spin: 0.2 });
      }
    }
  },
};
PATTERNS.jevil_diamond = {   // zig-zagging diamonds rain (hard to read)
  dur: 500,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(30, tier)))
      add({ ...bulletProps('diamond'), x: box.x + rng() * box.w, y: box.y - 20,
            vx: 0, vy: 1.6 + rng() * 0.8, sineA: 1.6, sineF: 0.08, spin: 0.15 });
  },
};
PATTERNS.jevil_carousel = {   // clones circle the box firing inward (rotates)
  dur: 520,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(10, tier))) {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2, R = Math.max(box.w, box.h) / 2 + 30;
      const ang = f * 0.06;
      for (let k = 0; k < 3; k++) {
        const a2 = ang + k * 2.094;
        const x = cx + Math.cos(a2) * R, y = cy + Math.sin(a2) * R;
        const toC = Math.atan2(cy - y, cx - x);
        add({ ...bulletProps('spade'), x, y,
              vx: Math.cos(toC) * 2.0, vy: Math.sin(toC) * 2.0, spin: 0.2 });
      }
    }
  },
};
PATTERNS.jevil_ult = {   // DEVILSKNIFE: spinning scythe spiral + homing chaos
  dur: 600,
  tick(a) {
    const { f, rng, box, tier, add } = a;
    if (every(f, rate(11, tier))) {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2, ang = f * 0.2;
      add({ ...bulletProps('shuriken'), x: cx, y: cy,
            vx: Math.cos(ang) * 2.6, vy: Math.sin(ang) * 2.6, spin: 0.3, scale: 1.3 });
    }
    if (every(f, rate(44, tier))) {
      const side = Math.floor(rng() * 4);
      const x = side === 0 ? box.x - 20 : side === 1 ? box.x + box.w + 20 : box.x + rng() * box.w;
      const y = side === 2 ? box.y - 20 : side === 3 ? box.y + box.h + 20 : box.y + rng() * box.h;
      add({ ...bulletProps('diamond'), x, y, vx: 0, vy: 0, homing: 0.04, maxv: 2.2, spin: 0.2 });
    }
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
    rng: mulberry32(((a.seed || 1) ^ 0x9e3779b9) >>> 0),
  }));
  const dur = Math.max(...subs.map(s => s.sim.dur));
  return {
    f: 0, dur,
    tick(soul, add) {
      for (const s of subs) {
        if (this.f >= s.sim.dur) continue;
        s.sim.tick(soul, b => { if (N === 1 || s.rng() < keep) { b.dmg = s.dmg; add(b); } });
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
