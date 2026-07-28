/**
 * flight_recorder.js — make the engine diagnose itself.
 *
 * The bottleneck on this project has been the ORACLE: someone has to say "this
 * attack looks wrong", and that someone has been Landon, one attack at a time.
 * The visual probe removed the "is anything on screen" half of that. This
 * removes most of the rest, using the observation that
 *
 *     THE GML IS THE SPEC.
 *
 * For any attack, the source states exactly which sprites get drawn and which
 * objects get spawned. So we do not need a reference image to find most bugs —
 * we need to compare what the code PROMISES against what the engine DID.
 *
 * Per attack this records:
 *   missingNatives  functions that fell through to the not-implemented stub —
 *                   the single most actionable signal, because each one is a
 *                   named engine capability the attack needed and did not get
 *   threw           events that raised, with the object and message
 *   noArt           sprites requested whose art is absent from the manifest
 *   badCoords       draws at NaN / wildly offscreen positions (the shape of
 *                   every "positionally off" report)
 *   drawn           sprite -> draw count  (the census to diff against the GML)
 *   spawned         object -> instance count
 *   promised        sprites/objects the GML names but that never appeared
 *
 * `promised` is the oracle: sprites the attack's own source draws, minus sprites
 * the run actually drew. A non-empty list is a concrete, self-generated bug
 * report — "the GML draws spr_knight_cone_bg and we never did".
 *
 *   await FLIGHT.record('knight_type98')     // one attack
 *   await FLIGHT.recordAll()                 // ranked report over the roster
 */
(function (global) {
  'use strict';

  const state = {
    on: false,
    missingNatives: new Map(),
    threw: new Map(),
    noArt: new Set(),
    badCoords: new Map(),
    drawn: new Map(),
    spawned: new Map(),
  };

  function bump(map, key) { map.set(key, (map.get(key) || 0) + 1); }

  // ── hooks ────────────────────────────────────────────────────────────────
  let installed = false;
  function install() {
    if (installed) return;
    installed = true;

    // 1. Unimplemented natives. $R.miss is where every unknown function lands.
    const H = global.GML_HELPERS && global.GML_HELPERS.for(global.activeGMLRuntime);
    if (H && typeof H.miss === 'function') {
      const origMiss = H.miss.bind(H);
      // Patch the shared helper object so it survives runtime swaps.
      global.GML_HELPERS.$patchMiss = origMiss;
    }
    // The stub installer names them; hook the generic warn path instead so we
    // catch both stubbed builtins and $R.miss.
    const origWarn = console.warn;
    console.warn = function (...args) {
      const s = String(args[0] || '');
      if (state.on) {
        let m = /\[gml\]\s+([a-zA-Z_]\w*)\(\)\s+is not implemented/.exec(s)
          || /\[gml\]\s+unknown function\s+([a-zA-Z_]\w*)/.exec(s)
          || /\[gml\]\s+no constructor source for\s+([a-zA-Z_]\w*)/.exec(s);
        if (m) bump(state.missingNatives, m[1]);
      }
      return origWarn.apply(console, args);
    };
    const origErr = console.error;
    console.error = function (...args) {
      const s = String(args[0] || '');
      if (state.on) {
        const m = /(?:step|draw|create|destroy)\s+Error\s+\[([^\]]+)\]:\s*(.*)/i.exec(s)
          || /\[gml\]\s+(\S+)\s+FAILED TO COMPILE[^:]*:\s*(.*)/.exec(s);
        if (m) bump(state.threw, m[1] + ': ' + String(m[2]).slice(0, 90));
      }
      return origErr.apply(console, args);
    };

    // 2. Sprite draws + missing art + bad coordinates.
    const A = global.gmlAssets;
    if (A && typeof A.getImage === 'function') {
      const orig = A.getImage.bind(A);
      A.getImage = function (spr, f) {
        if (state.on && typeof spr === 'string') {
          bump(state.drawn, spr);
          const man = global.GML_SPRITE_MANIFEST;
          if (man && !man[spr]) state.noArt.add(spr);
        }
        return orig(spr, f);
      };
    }

    // 3. Spawns, and coordinates that cannot be right.
    const rt0 = global.activeGMLRuntime;
    if (rt0) {
      const proto = Object.getPrototypeOf(rt0);
      const origCreate = proto.createInstance;
      // explicitDepth forwarded — an observer that drops an argument changes the
      // behaviour it is supposed to be observing (see gml_helpers.js:1699).
      proto.createInstance = function (objType, x, y, explicitDepth) {
        const inst = origCreate.call(this, objType, x, y, explicitDepth);
        if (state.on && inst) {
          bump(state.spawned, inst.object_name);
          // Only coordinates that CANNOT be intentional.
          //
          // Merely-offscreen is not a bug: `instance_create(-9999, -9999, ...)`
          // is a standard GML idiom for parking a controller out of view, and
          // objects with NEGATIVE friction legitimately accelerate away —
          // Gerson's chevrons have `friction = -2`, no Step and no destroyer, so
          // they really do fly off to x = -50000 in the shipped game, and
          // afterimages spawn wherever their parent has got to. Flagging those
          // buried the real signal.
          const nx = Number(x), ny = Number(y);
          if (!isFinite(nx) || !isFinite(ny)) bump(state.badCoords, inst.object_name + ' NaN');
          else if (Math.abs(nx) > 60000 || Math.abs(ny) > 60000) {
            bump(state.badCoords, inst.object_name + ' runaway @' + Math.round(nx) + ',' + Math.round(ny));
          }
        }
        return inst;
      };
    }
  }

  function reset() {
    state.missingNatives = new Map();
    state.threw = new Map();
    state.noArt = new Set();
    state.badCoords = new Map();
    state.drawn = new Map();
    state.spawned = new Map();
    // Warnings dedupe globally, so clear the engine's seen-set or a native only
    // ever reports against the FIRST attack that hit it.
    if (global.GML_CLEAR_WARNINGS) global.GML_CLEAR_WARNINGS();
  }

  /**
   * What the attack's own GML promises to draw and spawn.
   *
   * Read from the shipped event source for the objects this run actually
   * touched, so it stays in step with whatever the extraction contains.
   */
  function promisedBy(objectNames, chapter) {
    const table = (global.GML_OBJECT_EVENTS_BY_CHAPTER || {})[chapter] || {};
    const sprites = new Set();
    const objects = new Set();
    for (const name of objectNames) {
      const bundle = table[name];
      if (!bundle) continue;
      for (const src of Object.values(bundle)) {
        if (typeof src !== 'string') continue;
        for (const m of src.matchAll(/\bspr_[a-zA-Z0-9_]+/g)) sprites.add(m[0]);
        for (const m of src.matchAll(/instance_create\w*\s*\([^;]*?(obj_[a-zA-Z0-9_]+)\s*\)/g)) objects.add(m[1]);
      }
    }
    return { sprites, objects };
  }

  async function record(attackId, frames) {
    frames = frames || 200;
    install();
    reset();
    const probe = global.VISUAL_PROBE;
    if (!probe) return { id: attackId, error: 'visual_probe.js not loaded' };

    state.on = true;
    const vis = await probe.run(attackId);
    probe.stepTo(frames, probe.FRAMES[probe.FRAMES.length - 1]);
    state.on = false;

    const rt = global.activeGMLRuntime;
    // Host scaffolding is not part of the attack, and its source names sprites
    // the attack will never draw (obj_mainchara alone lists every Kris walk
    // sprite), which swamped the promise diff with noise.
    const SCAFFOLD = /^obj_(hero|mainchara|battlecontroller|tensionbar|grazebox|overworldheart|darkener|returnheart)/;
    const touched = new Set([...state.spawned.keys()].filter(n => !SCAFFOLD.test(n)));
    for (const i of rt.instances) if (!SCAFFOLD.test(i.object_name)) touched.add(i.object_name);
    const promise = promisedBy(touched, rt.$chapter || 'ch3');

    // The oracle: named in the source, never seen at runtime.
    const neverDrawn = [...promise.sprites].filter(s => !state.drawn.has(s)
      && (global.GML_SPRITE_MANIFEST || {})[s]);
    const neverSpawned = [...promise.objects].filter(o => !state.spawned.has(o));

    return {
      id: attackId,
      flags: vis.flags,
      ink: vis.captures[vis.captures.length - 1].inkPct,
      missingNatives: [...state.missingNatives.keys()],
      threw: [...state.threw.keys()].slice(0, 5),
      noArt: [...state.noArt],
      badCoords: [...state.badCoords.keys()].slice(0, 6),
      neverDrawn: neverDrawn.slice(0, 12),
      neverSpawned: neverSpawned.slice(0, 12),
      drawnCount: state.drawn.size,
      spawnedCount: state.spawned.size,
    };
  }

  async function recordAll(filter) {
    const ids = (global.GML_ATTACKS || []).map(a => a.id).filter(id => !filter || id.includes(filter));
    const rows = [];
    for (const id of ids) rows.push(await record(id));
    // Rank by how much evidence of breakage there is.
    const score = r => (r.threw.length * 10) + (r.missingNatives.length * 4)
      + (r.noArt.length * 3) + (r.badCoords.length * 3) + (r.neverDrawn.length)
      + (r.flags.length * 5);
    rows.sort((a, b) => score(b) - score(a));

    // Which engine capabilities would fix the most attacks at once?
    const nativeTally = new Map();
    for (const r of rows) for (const n of r.missingNatives) bump(nativeTally, n);
    const artTally = new Map();
    for (const r of rows) for (const s of r.noArt) bump(artTally, s);

    return {
      attacks: rows.length,
      worst: rows.filter(r => score(r) > 0).slice(0, 20).map(r =>
        r.id + ' [' + (r.flags.join(',') || 'renders') + ']' +
        (r.threw.length ? ' THREW:' + r.threw[0] : '') +
        (r.missingNatives.length ? ' natives:' + r.missingNatives.join('/') : '') +
        (r.noArt.length ? ' noArt:' + r.noArt.slice(0, 3).join('/') : '') +
        (r.badCoords.length ? ' coords:' + r.badCoords.slice(0, 2).join('/') : '') +
        (r.neverDrawn.length ? ' neverDrawn:' + r.neverDrawn.slice(0, 3).join('/') : '')),
      // The ranked fix list: one entry here can fix many attacks.
      missingNativesByImpact: [...nativeTally.entries()].sort((a, b) => b[1] - a[1])
        .map(([n, c]) => n + ' (' + c + ' attacks)'),
      missingArtByImpact: [...artTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
        .map(([n, c]) => n + ' (' + c + ')'),
      rows,
    };
  }

  global.FLIGHT = { record, recordAll, state };
})(window);
