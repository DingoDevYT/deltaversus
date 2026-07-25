/**
 * visual_probe.js — does the attack actually LOOK like anything?
 *
 * Every check we had ("67/67 ran, 0 errors") only proved nothing threw. It could
 * not see a black screen, a white sheet over the arena, a missing battle box, an
 * empty maze, or a battle menu drawn on top of everything — all of which shipped.
 *
 * Two ideas make this useful:
 *
 * 1. DETERMINISTIC STEPPING. The probe drives runtime.step()/draw() in a plain
 *    loop instead of waiting on requestAnimationFrame. rAF is throttled hard when
 *    the pane is not the foreground tab (measured: ~2 fps), so timing-based
 *    checks were reading half-initialised frames and calling them broken. A loop
 *    gives the same frame N every run, on any machine.
 *
 * 2. JUDGE PIXELS. Each capture is reduced to a few honest numbers — how much of
 *    the frame is not background, how many distinct colours, how much changed
 *    since the last capture, and how dominant the single most common colour is.
 *    Those catch the failure shapes we actually shipped:
 *      BLANK    nothing drawn                    (Gerson's black screen, empty maze)
 *      WASH     one colour covers the frame      (the white sheet over Roaring)
 *      STATIC   nothing moves across frames      (a frozen or never-started attack)
 *      NO_BOX   an attack that needs a box has none
 *      DEAD     an event failed to compile       (the #EE5577 lexer bug)
 *
 * BASELINES turn this into regression detection: snapshot the metrics, then a
 * later run reports what CHANGED. That is the check that would have caught every
 * "this used to work" report, because it does not need to know what correct looks
 * like — only that today differs from the day it was verified.
 *
 * Absolute accuracy still needs a reference image (the wiki has one per attack);
 * `captureDataURL` returns a PNG for that comparison.
 *
 * Usage from the console or a driver:
 *   await VISUAL_PROBE.run('knight_type107')      // one attack
 *   await VISUAL_PROBE.runAll()                   // whole roster + verdicts
 *   VISUAL_PROBE.saveBaseline() / .diffBaseline()
 */
(function (global) {
  'use strict';

  // Frame 8 exists to catch state that an attack deliberately REMOVES: Jevil's
  // BYE BYE destroys the battle box at realtimer 10, so a first capture at 30
  // never sees a box and wrongly reports NO_BOX on correct behaviour.
  const FRAMES = [8, 30, 90, 180];     // opening, wind-up, mid-attack, late
  const SAMPLE_STEP = 2;               // sample every Nth pixel — 4x faster, same verdicts

  function canvas() { return document.getElementById('canvas'); }

  /** Reduce a frame to numbers we can reason about. */
  function measure(prevData) {
    const cv = canvas();
    const ctx = cv.getContext('2d');
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const counts = new Map();
    let nonBlack = 0, total = 0, changed = 0;
    for (let i = 0; i < d.length; i += 4 * SAMPLE_STEP) {
      total++;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 8 || g > 8 || b > 8) nonBlack++;
      // Quantise to 5 bits/channel so anti-aliasing doesn't explode the count.
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      counts.set(key, (counts.get(key) || 0) + 1);
      if (prevData && (prevData[i] !== r || prevData[i + 1] !== g || prevData[i + 2] !== b)) changed++;
    }
    let top = 0;
    for (const n of counts.values()) if (n > top) top = n;
    return {
      inkPct: +(100 * nonBlack / total).toFixed(2),
      colours: counts.size,
      motionPct: prevData ? +(100 * changed / total).toFixed(2) : null,
      dominantPct: +(100 * top / total).toFixed(2),
      raw: d,
    };
  }

  /** Clear to black and run the depth pipeline, exactly as the studio does. */
  function drawFrame(rt, ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas().width, canvas().height);
    ctx.restore();
    try { rt.draw(ctx); } catch (e) {}
  }

  /**
   * Run the engine forward deterministically, capturing at FRAMES.
   *
   * DRAW RUNS EVERY FRAME, and that is not a rendering nicety — it is required
   * for correctness. GameMaker executes Draw once per step, and Deltarune
   * CREATES OBJECTS FROM DRAW EVENTS: obj_gerson_green_chevron's Draw is what
   * spawns obj_spearblocker, the shield every green-soul spear is then aimed at.
   *
   * This used to step N times and draw once at the end, which starved every
   * such object. Measured on Gerson pattern 20: the shield never appeared, so
   * all 18 `scr_spearshot(..., special 14, ...)` rows found `i_ex(obj_spearblocker)`
   * false and fired into nothing — 0 spears. Drawing each frame gives 36. The
   * engine was correct the whole time; the observer was not, and it had been
   * reporting dozens of green patterns as identical because the only thing it
   * ever let them draw was the furniture.
   */
  function stepTo(frame, from) {
    const rt = global.activeGMLRuntime;
    const ctx = canvas().getContext('2d');
    for (let f = from; f < frame; f++) {
      try { rt.step(); } catch (e) { /* recorded via the error log */ }
      if (global.GML_STUDIO_TICK_TURN) { try { global.GML_STUDIO_TICK_TURN(); } catch (e) {} }
      drawFrame(rt, ctx);
    }
    // Redraw the frame being measured so the captured pixels are frame `frame`.
    drawFrame(rt, ctx);
    return frame;
  }

  function launch(attackId) {
    const sel = document.getElementById('rosterSelect') || document.querySelector('select');
    const opt = [...sel.options].find(o => o.value === attackId || o.value.includes(attackId));
    if (!opt) return false;
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change'));
    const el = document.getElementById('errorLog');
    if (el) el.textContent = '';
    document.getElementById('btnTranslate').click();
    return true;
  }

  /** Everything that failed to compile in the current run — silent killers. */
  function deadEvents() {
    const rt = global.activeGMLRuntime;
    const out = [];
    const seen = new Set();
    for (const inst of rt.instances) {
      const cls = inst && inst.constructor;
      if (!cls || seen.has(cls)) continue;
      seen.add(cls);
      if (cls.$gmlDeadEvents) out.push(inst.object_name + ': ' + cls.$gmlDeadEvents.join('; '));
    }
    return out;
  }

  async function run(attackId, opts) {
    opts = opts || {};
    if (!launch(attackId)) return { id: attackId, error: 'not in roster' };
    // Freeze the live rAF loop for the whole measurement: it would otherwise
    // advance the game during the settle wait below by a machine-speed
    // dependent number of frames, so "frame 30" would not mean frame 30.
    const wasPaused = global.GML_STUDIO_SET_PAUSED ? global.GML_STUDIO_SET_PAUSED(true) : false;
    // Let the launch settle before capturing. Stepping deterministically runs
    // far faster than the browser DECODES images, and a sprite whose bitmap is
    // not ready draws as a placeholder — so a probe that starts immediately
    // measures loading, not correctness. (The same timing trap made the
    // collision masks read a hollow battle box as solid.) Spawning warms every
    // instance's art; this gives that a chance to finish.
    await new Promise(r => setTimeout(r, 350));

    const rt = global.activeGMLRuntime;
    const caps = [];
    let at = 0, prev = null, sawBox = false, sawClock = false;
    for (const f of FRAMES) {
      at = stepTo(f, at);
      const m = measure(prev);
      prev = m.raw;
      delete m.raw;
      const live = rt.instances.filter(i => !i.destroyed);
      if (live.some(i => i.object_name === 'obj_growtangle')) sawBox = true;
      if (Number(global.turntimer) > 0) sawClock = true;
      caps.push(Object.assign({ frame: f, instances: live.length }, m));
    }

    const el = document.getElementById('errorLog');
    const box = rt.instances.find(i => !i.destroyed && i.object_name === 'obj_growtangle');
    const res = {
      id: attackId,
      captures: caps,
      box: box ? Math.round(box.x) + ',' + Math.round(box.y) + ' ' + Math.round(box.sprite_width) + 'x' + Math.round(box.sprite_height) : null,
      boxEverExisted: sawBox,
      // An attack that ran its course has no box and no clock left, and that is
      // CORRECT — the probe must not report a completed attack as broken.
      finished: sawClock && !(Number(global.turntimer) > 0),
      turntimer: Number(global.turntimer),
      errors: (el && el.textContent.trim().slice(0, 200)) || '',
      dead: deadEvents(),
    };
    res.flags = verdict(res);
    if (opts.png) res.png = canvas().toDataURL('image/png');
    if (global.GML_STUDIO_SET_PAUSED) global.GML_STUDIO_SET_PAUSED(wasPaused);
    return res;
  }

  /** Turn the numbers into named failure shapes. */
  function verdict(res) {
    const flags = [];
    const last = res.captures[res.captures.length - 1];
    const mid = res.captures[1] || last;
    if (res.dead.length) flags.push('DEAD_EVENTS');
    if (res.errors) flags.push('ERRORS');
    // Judge the frame the attack is most alive on, not the last one — by then a
    // short attack has legitimately torn itself down.
    const best = res.captures.reduce((a, c) => (c.inkPct > a.inkPct ? c : a), res.captures[0]);
    // Nothing drawn at all. The soul alone is well under 1%.
    if (best.inkPct < 0.6) flags.push('BLANK');
    // One colour covering the frame: the white-sheet / all-black failure.
    // A DATE is exempt: it replaces the turn and paints its own full-screen
    // backdrop, so a single dominant colour is what correct looks like. Both
    // dates were verified by eye — portrait, dialogue, HP hearts and timer bar
    // all present — while being flagged here, and a check that cries wolf on
    // known-good output stops being read.
    if (best.dominantPct > 88 && best.inkPct > 20 && !/_date\d/.test(res.id)) flags.push('WASH');
    // A still image after the wind-up means it never really started.
    if (mid.motionPct !== null && mid.motionPct < 0.05 && last.motionPct < 0.05) flags.push('STATIC');
    // Only a problem if a box NEVER appeared; losing it at the end is the
    // teardown doing its job. A DATE legitimately has no battle box at all —
    // it replaces the turn and draws on its own surfaces.
    if (!res.boxEverExisted && !/_date\d/.test(res.id)) flags.push('NO_BOX');
    if (!res.finished && !(res.turntimer > 0)) flags.push('NO_CLOCK');
    return flags;
  }

  async function runAll(filter) {
    const list = (global.GML_ATTACKS || [])
      .map(a => a.id)
      .filter(id => !filter || id.includes(filter));
    const out = [];
    for (const id of list) out.push(await run(id));
    const bad = out.filter(r => r.flags && r.flags.length);
    return {
      total: out.length,
      clean: out.length - bad.length,
      problems: bad.map(r => r.id + ' -> ' + r.flags.join(',') +
        '  ink=' + r.captures[r.captures.length - 1].inkPct + '%' +
        ' motion=' + r.captures[r.captures.length - 1].motionPct + '%' +
        ' colours=' + r.captures[r.captures.length - 1].colours +
        (r.dead.length ? ' DEAD:' + r.dead[0] : '')),
      results: out,
    };
  }

  const BASELINE_KEY = 'dv_visual_baseline';
  function saveBaseline(results) {
    const slim = {};
    for (const r of results) {
      slim[r.id] = r.captures.map(c => [c.inkPct, c.colours, c.motionPct, c.dominantPct]);
    }
    localStorage.setItem(BASELINE_KEY, JSON.stringify(slim));
    return Object.keys(slim).length + ' attacks baselined';
  }
  /**
   * What CHANGED since the baseline. This is the regression check: it needs no
   * idea of what correct looks like, only that today differs from a day the
   * output was eyeballed and accepted.
   */
  function diffBaseline(results, tol) {
    tol = tol === undefined ? 25 : tol;   // percent, relative
    const base = JSON.parse(localStorage.getItem(BASELINE_KEY) || '{}');
    const drifted = [];
    for (const r of results) {
      const b = base[r.id];
      if (!b) continue;
      r.captures.forEach((c, i) => {
        if (!b[i]) return;
        const was = b[i][0], now = c.inkPct;
        const delta = Math.abs(now - was);
        if (delta > 1 && delta > (was * tol / 100)) {
          drifted.push(`${r.id} f${c.frame}: ink ${was}% -> ${now}%`);
        }
      });
    }
    return drifted;
  }

  global.VISUAL_PROBE = { run, runAll, saveBaseline, diffBaseline, measure, stepTo, FRAMES };
})(window);
