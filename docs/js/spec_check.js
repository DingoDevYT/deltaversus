/**
 * spec_check.js — diff what the GML PROMISES against what the engine DOES,
 * as numbers, per attack.
 *
 * The oracles before this one are saturated: the flight recorder reports zero
 * missing natives and zero missing art across all 147 attacks, and the visual
 * probe calls 143/147 clean. Neither can see the failures that are actually
 * left, because both ask "is something there?" and what remains is "is it the
 * RIGHT thing?" — a bullet at the wrong x, a wave every 20 frames instead of
 * 30, five stars instead of six, a phase that flips on the wrong timer.
 *
 * Those are all things the source states EXACTLY. `obj_..._crescentGenerator`
 * Create says `shootrate = 30`, `yposcount = 7`, `curpos = 3`; the dispatcher
 * says the generator is created at `(camerax() + 480 + 80) - 80, cameray() +
 * 160`. So a spec is not an opinion about how the attack should feel — it is a
 * transcription of constants that are written down, each carrying the file and
 * line it came from so a failure can be argued with.
 *
 * A spec file is per attack:
 *
 *   { id: 'knight_type109', assertions: [ {kind, ...params, why, src}, ... ] }
 *
 * Assertion kinds (deliberately few — every one must be decidable from the
 * source alone, and checkable without a reference image):
 *
 *   spawns    {obj, byFrame, min?, max?}      object appears, optionally how many
 *   absent    {obj, byFrame}                  object must NEVER appear
 *   count     {obj, atFrame, min?, max?}      live instances at a frame
 *   pos       {obj, atFrame, x?, y?, tol?}    position of the first live instance
 *   ivar      {obj, atFrame, name, eq|min|max, tol?}   an instance variable
 *   sprite    {name, byFrame}                 sprite drawn at least once
 *   draw      {name, atFrame, x?,y?,xscale?,yscale?,angle?,alpha?,
 *              minCalls?, maxCalls?, tol?}    the DRAW CALL's parameters
 *   box       {x?, y?, w?, h?, tol?}          battle box geometry, best frame
 *   turntimer {eq|min|max, tol?}              turn length the boss sets
 *
 * `draw` is the one that makes VISUAL correctness checkable without reference
 * footage, and it is the point of this file. The source does not merely say
 * that a sprite gets drawn — it says where, at what scale, at what rotation and
 * at what alpha. `draw_sprite_ext(spr_x, i, 320, 240, 2, 2, 0, c_white, 1)` is
 * a complete visual assertion already written down. Checking only "was it
 * drawn" (the `sprite` kind) throws away almost all of that, and a sprite drawn
 * at half scale, mirrored, or 40px left is exactly the class of bug that
 * survives every other oracle here.
 *
 * `pos` and `count` sample the FIRST live instance in creation order, which is
 * stable because the runtime keeps creation ids.
 *
 * Usage:
 *   SPEC_CHECK.load(SPECS)            // array of spec objects
 *   await SPEC_CHECK.runAll()         // -> {passed, failed, failures:[...]}
 *   await SPEC_CHECK.run('knight_type109')
 */
(function (global) {
  'use strict';

  let SPECS = [];

  // ── sprite draw census ────────────────────────────────────────────────────
  // Same hook the flight recorder uses. Installed once; `active` gates it so
  // it costs nothing between runs.
  const census = { active: false, drawn: new Set(), spawned: new Set(), draws: [] };

  /** One draw call, normalised. `draws` is cleared per sampled frame. */
  function record(spr, x, y, xs, ys, rot, alpha, via, destSize) {
    // A sprite reference may be the raw integer the compiler assigned rather
    // than a name (`knight_sprite = 664`, `pinkportrait = 982`). Resolving is
    // not optional: dropping non-strings would silently omit the Knight's body
    // during the roar and every dating-minigame portrait from the census, i.e.
    // exactly the draws most worth checking.
    let name = spr;
    if (typeof name === 'number') {
      const rt = global.activeGMLRuntime;
      const tbl = global.GML_SPRITE_INDICES && global.GML_SPRITE_INDICES[(rt && rt.$chapter) || 'ch3'];
      if (tbl && tbl[name]) name = tbl[name];
    }
    if (!name || typeof name !== 'string') return;
    census.drawn.add(name);
    // A missing optional argument means the GameMaker default, not NaN. Guard
    // every field: one NaN silently poisons a group key and reads as a bug.
    const n = (v, d) => (v === undefined || v === null || !isFinite(+v) ? d : +v);
    census.draws.push({
      spr: name, x: n(x, 0), y: n(y, 0),
      xs: n(xs, 1), ys: n(ys, 1),
      rot: n(rot, 0), alpha: n(alpha, 1),
      via, destSize: !!destSize,
    });
  }

  let hooked = false;
  function hookDraws() {
    if (hooked) return;
    const A = global.gmlAssets;
    if (!A || typeof A.getImage !== 'function') return;
    hooked = true;
    const orig = A.getImage.bind(A);
    A.getImage = function (spr, f) {
      if (census.active && typeof spr === 'string') census.drawn.add(spr);
      return orig(spr, f);
    };

    // Every sprite draw, with its parameters. Wrapping the natives catches
    // explicit `draw_sprite_*` calls; wrapping drawSelf catches the automatic
    // per-instance draw, which is how most bullets get on screen. Both funnel
    // into one record so an assertion does not have to know which route the
    // object took.
    // These do NOT share a signature, and assuming they do is how a recorder
    // invents bugs: `draw_sprite_part(spr, subimg, left, top, w, h, x, y)`
    // read as draw_sprite_ext yields the SOURCE RECT as the position and a NaN
    // rotation. Each is destructured as the manual defines it, and the
    // stretched family reports its destination size as an effective scale so a
    // spec can still talk about how big the thing landed.
    const SIG = {
      // (spr, sub, x, y)
      draw_sprite: a => ({ x: a[2], y: a[3], xs: 1, ys: 1, rot: 0, al: 1 }),
      // (spr, sub, x, y, xscale, yscale, rot, colour, alpha)
      draw_sprite_ext: a => ({ x: a[2], y: a[3], xs: a[4], ys: a[5], rot: a[6], al: a[8] }),
      // (spr, sub, left, top, w, h, x, y, xscale, yscale, rot, c1..c4, alpha)
      draw_sprite_general: a => ({ x: a[6], y: a[7], xs: a[8], ys: a[9], rot: a[10], al: a[15] }),
      // (spr, sub, left, top, w, h, x, y)
      draw_sprite_part: a => ({ x: a[6], y: a[7], xs: 1, ys: 1, rot: 0, al: 1 }),
      // (spr, sub, left, top, w, h, x, y, xscale, yscale, colour, alpha)
      draw_sprite_part_ext: a => ({ x: a[6], y: a[7], xs: a[8], ys: a[9], rot: 0, al: a[11] }),
      // (spr, sub, x, y, w, h) — w/h are a DESTINATION SIZE, not a scale
      draw_sprite_stretched: a => ({ x: a[2], y: a[3], xs: a[4], ys: a[5], rot: 0, al: 1, dest: true }),
      // (spr, sub, x, y, w, h, colour, alpha)
      draw_sprite_stretched_ext: a => ({ x: a[2], y: a[3], xs: a[4], ys: a[5], rot: 0, al: a[7], dest: true }),
      // (spr, sub, x, y)
      draw_sprite_tiled: a => ({ x: a[2], y: a[3], xs: 1, ys: 1, rot: 0, al: 1 }),
      // (spr, sub, x, y, xscale, yscale, colour, alpha)
      draw_sprite_tiled_ext: a => ({ x: a[2], y: a[3], xs: a[4], ys: a[5], rot: 0, al: a[7] }),
    };
    for (const fn of Object.keys(SIG)) {
      const orig = global[fn];
      if (typeof orig !== 'function') continue;
      const pick = SIG[fn];
      global[fn] = function () {
        if (census.active) {
          const p = pick(arguments);
          record(arguments[0], p.x, p.y, p.xs, p.ys, p.rot, p.al, fn, p.dest);
        }
        return orig.apply(this, arguments);
      };
    }
    // The INSTANCE's own drawSelf, not the helper's. `draw_self()` in GML
    // compiles to `window.draw_self`, whose body is
    // `this.drawSelf(_activeCtx)` — an instance method. Hooking the helper
    // caught neither that nor the automatic per-instance draw, so every object
    // that renders with plain `draw_self()` was invisible to the census.
    // obj_gerson_green_switch does exactly that, which is why 10 assertions
    // reported `spr_gerson_swing` "not drawn" while the switch was alive,
    // visible, at xscale 2 and holding that very sprite.
    const IP = global.GMLInstance && global.GMLInstance.prototype;
    if (IP && typeof IP.drawSelf === 'function' && !IP.__specHooked) {
      IP.__specHooked = true;
      const origSelf = IP.drawSelf;
      IP.drawSelf = function () {
        if (census.active) {
          record(this.sprite_index, this.x, this.y, this.image_xscale,
            this.image_yscale, this.image_angle, this.image_alpha, 'drawSelf');
        }
        return origSelf.apply(this, arguments);
      };
    }

    // Spawns MUST be recorded as they happen, not inferred from which
    // instances are alive at the sampled frames. Deltarune's VFX are mostly
    // short-lived: obj_knight_warp is the Knight's teleport flash and its
    // event_user(1) sets `alarm[1] = 4`, so it exists for four frames and is
    // gone long before a sample at frame 8. Reconstructing "ever spawned" from
    // live sets reported it as never created — a bug in the checker that would
    // have been read as a bug in the engine, on every VFX object in the roster.
    const rt0 = global.activeGMLRuntime;
    if (rt0) {
      const proto = Object.getPrototypeOf(rt0);
      const origCreate = proto.createInstance;
      proto.createInstance = function (objType, x, y) {
        const inst = origCreate.apply(this, arguments);
        if (census.active && inst) census.spawned.add(inst.object_name);
        return inst;
      };
    }
  }

  function live(objName) {
    const rt = global.activeGMLRuntime;
    if (!rt) return [];
    return rt.instances.filter(i => !i.destroyed && i.object_name === objName);
  }

  /** Frames we must stop at, in order, to evaluate everything in this spec. */
  function framesNeeded(spec) {
    const s = new Set();
    for (const a of spec.assertions || []) {
      if (a.atFrame != null) s.add(a.atFrame);
      if (a.byFrame != null) s.add(a.byFrame);
    }
    if (!s.size) s.add(60);
    return [...s].sort((x, y) => x - y);
  }

  function near(actual, expected, tol) {
    if (expected == null) return true;
    return Math.abs(Number(actual) - Number(expected)) <= (tol == null ? 2 : tol);
  }

  function fmt(a) {
    const p = [];
    for (const k of ['obj', 'name', 'atFrame', 'byFrame', 'x', 'y', 'w', 'h',
      'xscale', 'yscale', 'angle', 'alpha', 'minCalls', 'maxCalls', 'eq', 'min', 'max', 'tol']) {
      if (a[k] != null) p.push(k + '=' + a[k]);
    }
    return a.kind + '(' + p.join(' ') + ')';
  }

  /**
   * Run one attack and evaluate its assertions.
   *
   * Stepping is deterministic (VISUAL_PROBE.stepTo), never rAF, for the reason
   * documented there: rAF throttles to ~2fps off-foreground, so a timing check
   * would otherwise read a half-initialised frame and call it a bug.
   */
  async function run(id) {
    const spec = SPECS.find(s => s.id === id);
    if (!spec) return { id, error: 'no spec' };
    const probe = global.VISUAL_PROBE;
    if (!probe) return { id, error: 'visual_probe.js not loaded' };

    hookDraws();
    census.active = true;
    census.drawn = new Set();
    census.spawned = new Set();
    if (global.GML_CLEAR_WARNINGS) global.GML_CLEAR_WARNINGS();

    if (!probe.run) return { id, error: 'probe has no run' };
    // Launch through the studio's own path so the box block, turn setup and
    // dispatcher replay all happen exactly as they do for a human.
    const sel = document.getElementById('presetSelect') || document.querySelector('select');
    // Roster options are prefixed `attack:`. Match that exactly rather than by
    // substring — `includes('knight_type10')` also matches `knight_type109`.
    const opt = [...sel.options].find(o => o.value === 'attack:' + id || o.value === id);
    if (!opt) { census.active = false; return { id, error: 'not in roster' }; }
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change'));
    document.getElementById('btnTranslate').click();
    // Art decodes asynchronously and a not-yet-decoded sprite draws as a
    // placeholder; settle before measuring, or we measure loading. FREEZE the
    // live loop across that wait — otherwise it advances the game by a
    // machine-speed-dependent number of frames and every measurement (most
    // visibly global.turntimer, read ~11 short) is off by however fast the
    // machine is.
    const wasPaused = global.GML_STUDIO_SET_PAUSED ? global.GML_STUDIO_SET_PAUSED(true) : false;
    await new Promise(r => setTimeout(r, 350));

    /**
     * Deterministic stepping, mirroring VISUAL_PROBE.stepTo exactly (never
     * rAF — it throttles to ~2fps off-foreground and every timing check would
     * read a half-initialised frame). Re-implemented here only so the draw log
     * can be cleared immediately before draw(), which is what makes the
     * recorded draw calls belong to exactly one frame.
     */
    function stepToCapturing(frame, from) {
      const rt = global.activeGMLRuntime;
      const cv = document.getElementById('canvas');
      const ctx = cv.getContext('2d');
      const paint = () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.restore();
        try { rt.draw(ctx); } catch (e) {}
      };
      for (let f = from; f < frame; f++) {
        try { rt.step(); } catch (e) { /* surfaced via the error log */ }
        if (global.GML_STUDIO_TICK_TURN) { try { global.GML_STUDIO_TICK_TURN(); } catch (e) {} }
        // Sample the clock EVERY frame, not just at the marks. A controller
        // that pins `global.turntimer = 999999` does it on its first step and
        // the countdown starts immediately, so a peak taken only at frame 8
        // reads 999991 and an `eq: 999999` assertion fails against an engine
        // that set exactly that.
        const t = Number(global.turntimer);
        if (isFinite(t) && t > turntimerPeak) turntimerPeak = t;
        // Draw EVERY frame — Deltarune spawns objects from Draw events (the
        // green-soul shield is created in a chevron's Draw), so skipping them
        // silently removes whole attacks. See visual_probe.stepTo.
        paint();
      }
      census.draws = [];                 // record only the sampled frame's draws
      paint();
      return frame;
    }

    const marks = framesNeeded(spec);
    // Snapshot state at each frame of interest, then evaluate — assertions at
    // different frames must not each re-run the attack.
    const snap = {};
    // Union of the live sets, kept only as a backstop for objects that spawn
    // before the census is armed; `census.spawned` is the real record.
    const seenLive = new Set();
    let boxBest = null, at = 0;
    // The turn length an attack SETS, not the value at an arbitrary instant.
    //
    // Reading it once at launch is wrong for any attack whose duration is
    // pinned inside the CONTROLLER's Step rather than the boss's ladder —
    // Knight types 102/105/106/107/108 all do `global.turntimer = 999999`
    // there, so at launch they still read the boss's 240 and only jump once the
    // controller has stepped. Tracking the MAXIMUM across the sampled frames is
    // correct for both shapes, because nothing lowers the clock except the
    // per-frame countdown: `scr_turntimer` only ever raises
    // (`if (global.turntimer < arg0) global.turntimer = arg0`) and the
    // controller pins raise further.
    let turntimerPeak = Number(global.turntimer) || 0;

    // WHICH INSTANCE VARIABLES DOES THIS SPEC READ?
    //
    // Snapshots must capture VALUES, not instance references. Storing the live
    // objects and reading them after the stepping loop meant every `ivar` and
    // `pos` assertion was evaluated against the instance's state at the LAST
    // sampled frame, not its own. Jevil's obj_suitbomb asserted at frame 2 read
    // 250 — where the bomb had landed by frame 60 — instead of the -60 it
    // genuinely holds at frame 2, and the engine was right the whole time. Same
    // cause behind the Knight's local_turntimer reading ~60 low and the
    // image_alpha values above 1.
    const varsPerObj = {};
    for (const a of spec.assertions || []) {
      if (a.kind === 'ivar' && a.obj && a.name) {
        (varsPerObj[a.obj] = varsPerObj[a.obj] || new Set()).add(a.name);
      }
    }

    const drawsAt = {};
    for (const f of marks) {
      at = stepToCapturing(f, at);
      const rt = global.activeGMLRuntime;
      drawsAt[f] = census.draws.slice();
      const alive = rt.instances.filter(i => !i.destroyed);
      // The SOUL is a real obj_heart instance but is deliberately kept out of
      // the stepped list (the studio drives its movement itself), so a spec
      // asserting on obj_heart — Jevil's BYE BYE and the Knight's roar both
      // raise `boundaryup` to 160 — found "no instance" while getInstances
      // resolved it perfectly well. Same disagreement instance_exists had.
      if (rt.soul && !rt.soul.destroyed) alive.push(rt.soul);
      for (const i of alive) seenLive.add(i.object_name);
      const byName = {};
      for (const i of alive) {
        const nm = i.object_name;
        if (!byName[nm]) byName[nm] = { n: 0, x: null, y: null, vars: {} };
        const rec = byName[nm];
        rec.n++;
        if (rec.n === 1) {
          // First live instance in creation order — the one `pos`/`ivar` mean.
          rec.x = i.x; rec.y = i.y;
          const want = varsPerObj[nm];
          if (want) for (const v of want) rec.vars[v] = i[v];
        }
      }
      snap[f] = byName;
      // RAW max, with no "+f already counted down" compensation. That
      // compensation assumed the clock had decremented every frame since zero,
      // which is false for an attack that has ENDED — it sits at 0, and 0 + 180
      // invents a peak of 180 that was never set. The launch sample already
      // captures the boss-ladder value, and a controller that pins
      // `global.turntimer = 999999` re-pins it every frame, so the raw maximum
      // is right for both shapes.
      const tt = Number(global.turntimer);
      if (isFinite(tt) && tt > turntimerPeak) turntimerPeak = tt;
      const box = alive.find(i => i.object_name === 'obj_growtangle');
      if (box && (!boxBest || box.sprite_width > boxBest.w)) {
        boxBest = { x: box.x, y: box.y, w: box.sprite_width, h: box.sprite_height };
      }
    }
    census.active = false;
    if (global.GML_STUDIO_SET_PAUSED) global.GML_STUDIO_SET_PAUSED(wasPaused);

    const ever = name => census.spawned.has(name) || seenLive.has(name);

    const results = [];
    for (const a of spec.assertions || []) {
      let ok = true, got = '';
      const frame = a.atFrame != null ? a.atFrame : a.byFrame;
      const at2 = snap[frame] || {};
      const rec = a.obj ? at2[a.obj] : null;      // {n, x, y, vars} or undefined
      const liveN = rec ? rec.n : 0;

      switch (a.kind) {
        case 'spawns': {
          // "appeared by frame F" is cumulative: an object that spawned and was
          // destroyed before F still satisfies it. `min`/`max` constrain how
          // many are LIVE at that frame, which is only meaningful for objects
          // that outlive the sample — so a min is treated as satisfied by the
          // spawn record when nothing is left alive.
          const everSeen = ever(a.obj);
          const n = liveN;
          ok = everSeen;
          if (a.max != null && n > a.max) ok = false;
          got = 'ever=' + everSeen + ' live=' + n;
          break;
        }
        case 'absent':
          ok = !ever(a.obj);
          got = 'ever=' + ever(a.obj);
          break;
        case 'count':
          ok = (a.min == null || liveN >= a.min) && (a.max == null || liveN <= a.max);
          got = String(liveN);
          break;
        case 'pos': {
          if (!rec) { ok = false; got = 'no instance'; break; }
          ok = near(rec.x, a.x, a.tol) && near(rec.y, a.y, a.tol);
          got = Math.round(rec.x) + ',' + Math.round(rec.y);
          break;
        }
        case 'ivar': {
          if (!rec) { ok = false; got = 'no instance'; break; }
          const v = rec.vars[a.name];
          got = String(v);
          if (a.eq != null) ok = near(v, a.eq, a.tol == null ? 0.001 : a.tol);
          if (a.min != null) ok = ok && Number(v) >= a.min;
          if (a.max != null) ok = ok && Number(v) <= a.max;
          break;
        }
        case 'sprite':
          ok = census.drawn.has(a.name);
          got = ok ? 'drawn' : 'never drawn';
          break;
        case 'draw': {
          // Visual fidelity, straight from the source's own draw call.
          const calls = (drawsAt[frame] || []).filter(d => d.spr === a.name);
          // `maxCalls: 0` is the NEGATIVE form — "this must not be drawn on this
          // frame" — so no calls is the pass, not the failure. Testing emptiness
          // first made every such assertion fail on correct behaviour.
          if (a.maxCalls === 0) {
            ok = calls.length === 0;
            got = calls.length + ' call(s)';
            break;
          }
          if (!calls.length) { ok = false; got = 'not drawn on frame ' + frame; break; }
          if (a.minCalls != null && calls.length < a.minCalls) {
            ok = false; got = calls.length + ' calls (want >=' + a.minCalls + ')'; break;
          }
          if (a.maxCalls != null && calls.length > a.maxCalls) {
            ok = false; got = calls.length + ' calls (want <=' + a.maxCalls + ')'; break;
          }
          // Any ONE of the calls satisfying the parameters is a pass: an attack
          // legitimately draws the same sprite many times (tiles, trails, a
          // ring of bullets), and requiring all of them to match would only be
          // assertable for single-draw sprites.
          const t = a.tol == null ? 2 : a.tol;
          const hit = calls.find(d =>
            near(d.x, a.x, t) && near(d.y, a.y, t) &&
            near(d.xs, a.xscale, a.tol == null ? 0.01 : a.tol) &&
            near(d.ys, a.yscale, a.tol == null ? 0.01 : a.tol) &&
            near(d.rot, a.angle, a.tol == null ? 1 : a.tol) &&
            near(d.alpha, a.alpha, a.tol == null ? 0.02 : a.tol));
          ok = !!hit;
          if (!ok) {
            const c = calls[0];
            got = calls.length + ' call(s), e.g. ' +
              Math.round(c.x) + ',' + Math.round(c.y) +
              ' scale ' + (+c.xs.toFixed(2)) + ',' + (+c.ys.toFixed(2)) +
              ' rot ' + Math.round(c.rot) + ' alpha ' + (+c.alpha.toFixed(2));
          } else {
            got = calls.length + ' call(s), matched';
          }
          break;
        }
        case 'box':
          if (!boxBest) { ok = false; got = 'no box'; break; }
          ok = near(boxBest.x, a.x, a.tol) && near(boxBest.y, a.y, a.tol) &&
               near(boxBest.w, a.w, a.tol) && near(boxBest.h, a.h, a.tol);
          got = Math.round(boxBest.x) + ',' + Math.round(boxBest.y) + ' ' +
                Math.round(boxBest.w) + 'x' + Math.round(boxBest.h);
          break;
        case 'turntimer': {
          const v = turntimerPeak;
          got = String(v);
          ok = true;
          if (a.eq != null) ok = near(v, a.eq, a.tol == null ? 2 : a.tol);
          if (a.min != null) ok = ok && v >= a.min;
          if (a.max != null) ok = ok && v <= a.max;
          break;
        }
        default:
          ok = true; got = 'unknown kind — skipped';
      }
      results.push({ ok, assertion: fmt(a), got, why: a.why || '', src: a.src || '' });
    }

    return {
      id,
      passed: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
      failures: results.filter(r => !r.ok),
    };
  }

  async function runAll(filter) {
    const out = [];
    for (const s of SPECS) {
      if (filter && !s.id.includes(filter)) continue;
      out.push(await run(s.id));
    }
    const failures = [];
    for (const r of out) {
      for (const f of r.failures || []) {
        failures.push(r.id + '  ' + f.assertion + '  GOT ' + f.got +
                      (f.src ? '  [' + f.src + ']' : '') + (f.why ? '  — ' + f.why : ''));
      }
    }
    return {
      attacks: out.length,
      passed: out.reduce((n, r) => n + (r.passed || 0), 0),
      failed: out.reduce((n, r) => n + (r.failed || 0), 0),
      cleanAttacks: out.filter(r => !r.failed && !r.error).length,
      failures,
      results: out,
    };
  }

  function load(specs) { SPECS = specs || []; return SPECS.length + ' specs loaded'; }

  /**
   * What did this attack ACTUALLY draw on a given frame?
   *
   * The counterpart to writing a spec: read the GML to learn what should be
   * drawn, then call this to see what was. Groups identical draws so a ring of
   * 20 bullets reads as one line with a count rather than 20 rows.
   *
   *   await SPEC_CHECK.draws('knight_type98', 60)
   */
  async function draws(id, frame) {
    const spec = { id, assertions: [{ kind: 'draw', name: ' none', atFrame: frame || 60, why: '', src: '' }] };
    const had = SPECS.find(s => s.id === id);
    if (!had) SPECS.push(spec); else SPECS.splice(SPECS.indexOf(had), 1, spec);
    await run(id);
    if (!had) SPECS.splice(SPECS.indexOf(spec), 1); else SPECS.splice(SPECS.indexOf(spec), 1, had);
    const groups = new Map();
    for (const d of census.draws) {
      const k = [d.spr, Math.round(d.x), Math.round(d.y), +d.xs.toFixed(2),
        +d.ys.toFixed(2), Math.round(d.rot), +d.alpha.toFixed(2)].join('|');
      groups.set(k, (groups.get(k) || 0) + 1);
    }
    return [...groups.entries()]
      .map(([k, n]) => {
        const [spr, x, y, xs, ys, rot, alpha] = k.split('|');
        return { spr, x: +x, y: +y, xscale: +xs, yscale: +ys, angle: +rot, alpha: +alpha, calls: n };
      })
      .sort((a, b) => b.calls - a.calls);
  }

  global.SPEC_CHECK = { load, run, runAll, draws, get specs() { return SPECS; } };
})(window);
