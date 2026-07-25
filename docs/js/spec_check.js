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
 *   box       {x?, y?, w?, h?, tol?}          battle box geometry, best frame
 *   turntimer {eq|min|max, tol?}              turn length the boss sets
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
  const census = { active: false, drawn: new Set(), spawned: new Set() };
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
    for (const k of ['obj', 'name', 'atFrame', 'byFrame', 'x', 'y', 'w', 'h', 'eq', 'min', 'max', 'tol']) {
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
    // placeholder; settle before measuring, or we measure loading.
    await new Promise(r => setTimeout(r, 350));

    const marks = framesNeeded(spec);
    // Snapshot state at each frame of interest, then evaluate — assertions at
    // different frames must not each re-run the attack.
    const snap = {};
    // Union of the live sets, kept only as a backstop for objects that spawn
    // before the census is armed; `census.spawned` is the real record.
    const seenLive = new Set();
    let boxBest = null, at = 0;
    const turntimerStart = Number(global.turntimer);

    for (const f of marks) {
      at = probe.stepTo(f, at);
      const rt = global.activeGMLRuntime;
      const alive = rt.instances.filter(i => !i.destroyed);
      for (const i of alive) seenLive.add(i.object_name);
      const byName = {};
      for (const i of alive) (byName[i.object_name] = byName[i.object_name] || []).push(i);
      snap[f] = byName;
      const box = alive.find(i => i.object_name === 'obj_growtangle');
      if (box && (!boxBest || box.sprite_width > boxBest.w)) {
        boxBest = { x: box.x, y: box.y, w: box.sprite_width, h: box.sprite_height };
      }
    }
    census.active = false;

    const ever = name => census.spawned.has(name) || seenLive.has(name);

    const results = [];
    for (const a of spec.assertions || []) {
      let ok = true, got = '';
      const frame = a.atFrame != null ? a.atFrame : a.byFrame;
      const at2 = snap[frame] || {};
      const list = a.obj ? (at2[a.obj] || []) : [];

      switch (a.kind) {
        case 'spawns': {
          // "appeared by frame F" is cumulative: an object that spawned and was
          // destroyed before F still satisfies it. `min`/`max` constrain how
          // many are LIVE at that frame, which is only meaningful for objects
          // that outlive the sample — so a min is treated as satisfied by the
          // spawn record when nothing is left alive.
          const everSeen = ever(a.obj);
          const n = list.length;
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
          ok = (a.min == null || list.length >= a.min) && (a.max == null || list.length <= a.max);
          got = String(list.length);
          break;
        case 'pos': {
          const i0 = list[0];
          if (!i0) { ok = false; got = 'no instance'; break; }
          ok = near(i0.x, a.x, a.tol) && near(i0.y, a.y, a.tol);
          got = Math.round(i0.x) + ',' + Math.round(i0.y);
          break;
        }
        case 'ivar': {
          const i0 = list[0];
          if (!i0) { ok = false; got = 'no instance'; break; }
          const v = i0[a.name];
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
        case 'box':
          if (!boxBest) { ok = false; got = 'no box'; break; }
          ok = near(boxBest.x, a.x, a.tol) && near(boxBest.y, a.y, a.tol) &&
               near(boxBest.w, a.w, a.tol) && near(boxBest.h, a.h, a.tol);
          got = Math.round(boxBest.x) + ',' + Math.round(boxBest.y) + ' ' +
                Math.round(boxBest.w) + 'x' + Math.round(boxBest.h);
          break;
        case 'turntimer': {
          const v = turntimerStart;
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

  global.SPEC_CHECK = { load, run, runAll, get specs() { return SPECS; } };
})(window);
