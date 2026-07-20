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
  dur: 420,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(34, tier))) {
      // sword wave sweeping horizontally, sine wobble
      const fromLeft = rng() < 0.5;
      const y = box.y + 10 + rng() * (box.h - 20);
      add({
        x: fromLeft ? box.x - 30 : box.x + box.w + 30, y,
        vx: (fromLeft ? 1 : -1) * (1.7 + rng() * 0.8), vy: 0,
        shape: 'crescent', color: '#fff', r: 9,
        rot: fromLeft ? 0 : Math.PI, spin: fromLeft ? 0.09 : -0.09,
        sineA: 0.7, sineF: 0.05 + rng() * 0.04,
      });
    }
  },
};
PATTERNS.kris_cross = {
  dur: 480,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(52, tier))) {
      // X burst: 4 diagonal waves from the corners aimed through center
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const jx = (rng() - 0.5) * 60, jy = (rng() - 0.5) * 40;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = cx + sx * (box.w / 2 + 34) + jx, y = cy + sy * (box.h / 2 + 34) + jy;
        const ang = Math.atan2(cy + jy - y, cx + jx - x);
        add({
          x, y, vx: Math.cos(ang) * 2.1, vy: Math.sin(ang) * 2.1,
          shape: 'crescent', color: '#fff', r: 9, rot: ang, spin: 0.12,
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
PATTERNS.susie_axe = {
  dur: 420,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(40, tier))) {
      // giant arcs boomeranging across the box
      const fromLeft = rng() < 0.5;
      const y = box.y + 14 + rng() * (box.h - 28);
      add({
        x: fromLeft ? box.x - 36 : box.x + box.w + 36, y,
        vx: (fromLeft ? 1 : -1) * 2.6, vy: (rng() - 0.5) * 0.8,
        ax: (fromLeft ? -1 : 1) * 0.028,             // boomerang back
        img: pick(rng, imgs.arc), scale: 1.5, r: 11,
        rot: 0, spin: fromLeft ? 0.14 : -0.14, life: 220,
      });
    }
  },
};
PATTERNS.susie_rude = {
  dur: 500,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    // beam sweep: a column of arcs marches across; telegraphed by spacing
    const period = rate(90, tier);
    if (every(f, period)) {
      const fromLeft = (Math.floor(f / period) % 2) === 0;
      for (let i = 0; i < 5; i++) {
        add({
          x: (fromLeft ? box.x - 40 : box.x + box.w + 40) - (fromLeft ? 1 : -1) * i * 26,
          y: box.y + (i + 0.5) * (box.h / 5),
          vx: (fromLeft ? 1 : -1) * 3.4, vy: 0,
          img: pick(rng, imgs.arc), scale: 1.6, r: 12, spin: 0.18,
        });
      }
    }
    if (every(f, rate(48, tier))) {
      // shockwave shards off the floor
      add({
        x: box.x + rng() * box.w, y: box.y + box.h + 20,
        vx: (rng() - 0.5) * 1.4, vy: -(2.6 + rng() * 1.4), ay: 0.05,
        img: pick(rng, imgs.arc), scale: 0.9, r: 8, spin: 0.2,
      });
    }
  },
};
PATTERNS.susie_ult = {
  dur: 560,
  tick(api) {
    const { f, rng, box, tier, add, imgs } = api;
    if (every(f, rate(30, tier))) {
      const fromLeft = rng() < 0.5;
      add({
        x: fromLeft ? box.x - 40 : box.x + box.w + 40,
        y: box.y + rng() * box.h,
        vx: (fromLeft ? 1 : -1) * (2.8 + rng() * 1.6), vy: (rng() - 0.5) * 1.2,
        img: pick(rng, imgs.arc), scale: 1.4 + rng() * 0.6, r: 11, spin: 0.2,
      });
    }
    if (every(f, rate(110, tier))) {
      // the BIG crescent: slow, huge, unmissable-looking
      const fromLeft = rng() < 0.5;
      add({
        x: fromLeft ? box.x - 70 : box.x + box.w + 70,
        y: box.y + box.h / 2 + (rng() - 0.5) * 60,
        vx: (fromLeft ? 1 : -1) * 1.5, vy: 0,
        ...bulletProps('arc_red'), scale: 2.6, r: 24, flip: !fromLeft,
        sineA: 1.1, sineF: 0.03,
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
function bulletProps(bid, r) {
  if (bid === 'crescent' || bid === 'star' || bid === 'note') {
    const col = bid === 'crescent' ? '#fff' : bid === 'star' ? '#7fff9f' : '#ff9fff';
    return { shape: bid, color: col, r: r || 8 };
  }
  const info = (A.manifest.bullets || {})[bid];
  const img = A.img['assets/bullets/' + (info ? info.f : '')];
  const rad = info ? Math.max(5, Math.min(16, Math.max(info.w, info.h) * 0.55)) : 6;
  return { img, r: r || rad, scale: 1.0 };
}

function customPattern(spec) {
  const v = spec.speed || 1;
  const ult = !!spec.ult;
  const den = ult ? 0.8 : 1;      // ults spawn a little denser
  const P = { dur: spec.dur || 480 };
  const bp = () => bulletProps(spec.bullet);
  switch (spec.ptype) {
    case 'rain':
      P.tick = a => {
        if (every(a.f, rate(Math.round(26 * den), a.tier)))
          a.add({ ...bp(), x: a.box.x + a.rng() * a.box.w, y: a.box.y - 26,
                  vx: (a.rng() - 0.5) * 0.8 * v, vy: (1.2 + a.rng() * 1.2) * v,
                  spin: 0.08 });
        if (ult && every(a.f, rate(70, a.tier)))
          a.add({ ...bp(), x: a.soul.x + (a.rng() - 0.5) * 60, y: a.box.y - 30,
                  vx: 0, vy: 0.4, ay: 0.09 * v, maxv: 5 * v });
      };
      break;
    case 'sweep':
      P.tick = a => {
        const period = rate(Math.round(46 * den), a.tier);
        if (every(a.f, period)) {
          const L = (Math.floor(a.f / period) % 2) === 0;
          a.add({ ...bp(), x: L ? a.box.x - 30 : a.box.x + a.box.w + 30,
                  y: a.box.y + 8 + a.rng() * (a.box.h - 16),
                  vx: (L ? 1 : -1) * 2.2 * v, vy: 0,
                  sineA: 0.6, sineF: 0.05, spin: 0.1 });
        }
      };
      break;
    case 'spiral':
      P.tick = a => {
        if (every(a.f, rate(Math.round(15 * den), a.tier))) {
          const cx = a.box.x + a.box.w / 2, cy = a.box.y + a.box.h / 2;
          const ang = a.f * 0.31;
          const arms = ult ? 3 : 2;
          for (let k = 0; k < arms; k++) {
            const t2 = ang + k * (Math.PI * 2 / arms);
            a.add({ ...bp(), x: cx, y: cy,
                    vx: Math.cos(t2) * 1.6 * v, vy: Math.sin(t2) * 1.6 * v,
                    spin: 0.12 });
          }
        }
      };
      break;
    case 'fan':
      P.tick = a => {
        if (every(a.f, rate(Math.round(40 * den), a.tier))) {
          const L = a.rng() < 0.5;
          const ox = L ? a.box.x - 18 : a.box.x + a.box.w + 18, oy = a.box.y - 14;
          const n = ult ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const ang = Math.atan2(a.soul.y - oy, a.soul.x - ox) + (i - (n - 1) / 2) * 0.32;
            a.add({ ...bp(), x: ox, y: oy,
                    vx: Math.cos(ang) * 2.0 * v, vy: Math.sin(ang) * 2.0 * v });
          }
        }
      };
      break;
    case 'walls':
      P.tick = a => {
        if (every(a.f, rate(Math.round(20 * den), a.tier))) {
          const lanes = 6;
          const open = Math.floor(a.f / 100) % lanes;   // moving gap
          const lane = Math.floor(a.rng() * lanes);
          if (lane !== open)
            a.add({ ...bp(), x: a.box.x + a.box.w + 26,
                    y: a.box.y + (lane + 0.5) * (a.box.h / lanes),
                    vx: -(2.0 + a.rng() * 0.6) * v, vy: 0 });
        }
      };
      break;
    case 'homing':
      P.tick = a => {
        if (every(a.f, rate(Math.round(55 * den), a.tier))) {
          const side = Math.floor(a.rng() * 4);
          const x = side === 0 ? a.box.x - 24 : side === 1 ? a.box.x + a.box.w + 24 : a.box.x + a.rng() * a.box.w;
          const y = side === 2 ? a.box.y - 24 : side === 3 ? a.box.y + a.box.h + 24 : a.box.y + a.rng() * a.box.h;
          a.add({ ...bp(), x, y, vx: 0, vy: 0, homing: 0.05 * v, maxv: 1.9 * v, spin: 0.06 });
        }
      };
      break;
    case 'burst':
      P.tick = a => {
        if (every(a.f, rate(Math.round(72 * den), a.tier))) {
          const cx = a.box.x + a.rng() * a.box.w, cy = a.box.y + a.rng() * a.box.h;
          const n = ult ? 10 : 8;
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2;
            a.add({ ...bp(), x: cx, y: cy,
                    vx: Math.cos(ang) * 1.5 * v, vy: Math.sin(ang) * 1.5 * v,
                    life: 200 });
          }
        }
      };
      break;
    // ------- weapon FIGHT patterns -------
    case 'weapon_sword':
      P.dur = 420;
      P.tick = a => {
        if (every(a.f, rate(34, a.tier))) {
          const L = a.rng() < 0.5;
          const useSword = a.rng() < 0.4;
          a.add({ ...(useSword ? bulletProps('sword') : bulletProps('crescent')),
                  x: L ? a.box.x - 30 : a.box.x + a.box.w + 30,
                  y: a.box.y + 10 + a.rng() * (a.box.h - 20),
                  vx: (L ? 1 : -1) * (1.7 + a.rng() * 0.8), vy: 0,
                  rot: L ? 0 : Math.PI, spin: useSword ? 0.13 : (L ? 0.09 : -0.09),
                  sineA: 0.7, sineF: 0.06 });
        }
      };
      break;
    case 'weapon_axe':
      P.dur = 420;
      P.tick = a => {
        if (every(a.f, rate(42, a.tier))) {
          const L = a.rng() < 0.5;
          a.add({ ...bulletProps('axe'), x: L ? a.box.x - 34 : a.box.x + a.box.w + 34,
                  y: a.box.y + 14 + a.rng() * (a.box.h - 28),
                  vx: (L ? 1 : -1) * 2.5, vy: (a.rng() - 0.5) * 0.8,
                  ax: (L ? -1 : 1) * 0.027, spin: 0.16, life: 220 });
        }
      };
      break;
    case 'weapon_scarf':
      P.dur = 420;
      P.tick = a => {
        if (every(a.f, rate(38, a.tier))) {
          const L = a.rng() < 0.5;
          a.add({ shape: 'crescent', color: '#ff9fdf', r: 8,
                  x: L ? a.box.x - 34 : a.box.x + a.box.w + 34,
                  y: a.box.y + 12 + a.rng() * (a.box.h - 24),
                  vx: (L ? 1 : -1) * 1.9, vy: 0, rot: L ? 0 : Math.PI,
                  sineA: 1.6, sineF: 0.07 });
        }
      };
      break;
    case 'weapon_ice':
      P.dur = 420;
      P.tick = a => {
        if (every(a.f, rate(34, a.tier)))
          a.add({ ...bulletProps('icicle'), x: a.box.x + a.rng() * a.box.w,
                  y: a.box.y - 30, vx: 0, vy: 0.5, ay: 0.1, maxv: 4.6 });
        if (every(a.f, rate(52, a.tier)))
          a.add({ ...bulletProps('shard'), x: a.box.x + a.rng() * a.box.w,
                  y: a.box.y + a.box.h + 12, vx: (a.rng() - 0.5) * 2,
                  vy: -(1.8 + a.rng() * 1.2), ay: 0.06, spin: 0.15 });
      };
      break;
    case 'weapon_spade':
      P.dur = 420;
      P.tick = a => {
        if (every(a.f, rate(42, a.tier))) {
          const L = a.rng() < 0.5;
          const ox = L ? a.box.x - 20 : a.box.x + a.box.w + 20, oy = a.box.y - 16;
          for (let i = -1; i <= 1; i++) {
            const ang = Math.atan2(a.soul.y - oy, a.soul.x - ox) + i * 0.35;
            a.add({ ...bulletProps('spade'), x: ox, y: oy,
                    vx: Math.cos(ang) * 2.0, vy: Math.sin(ang) * 2.0 });
          }
        }
      };
      break;
    default:
      P.tick = a => {
        if (every(a.f, 30))
          a.add({ ...bp(), x: a.box.x + a.rng() * a.box.w, y: a.box.y - 20,
                  vx: 0, vy: 1.5 * v });
      };
  }
  return P;
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
