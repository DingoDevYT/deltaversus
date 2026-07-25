/**
 * test_semantics.js — targeted checks that the compiler reproduces GML semantics.
 *
 * The preset suites prove nothing crashes. These prove the tricky rules are
 * actually right, each one a case the old regex translator got wrong.
 *
 *   node scripts/test_semantics.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '..', 'docs', 'js');

function fakeCtx() {
  const n = () => {};
  return { save: n, restore: n, translate: n, rotate: n, scale: n, drawImage: n,
    fillRect: n, strokeRect: n, clearRect: n, beginPath: n, closePath: n, moveTo: n,
    lineTo: n, arc: n, fill: n, stroke: n, clip: n, fillText: n,
    measureText: () => ({ width: 8 }), globalAlpha: 1, globalCompositeOperation: '',
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '' };
}

const sb = { console, Math, JSON, Number, String, Boolean, Array, Object, Map, Set,
  WeakMap, WeakSet, parseInt, parseFloat, isNaN, isFinite, Date, RegExp, Error,
  TypeError, setTimeout: () => 0, performance: { now: () => 0 } };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
sb.document = { createElement: () => ({ getContext: () => fakeCtx(), width: 0, height: 0 }), getElementById: () => null };
sb.Image = function () { this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; };
vm.createContext(sb);
for (const f of ['gml_object_index.js', 'sprite_origins.js', 'sprite_manifest.js',
  'gml_asset_db.js', 'gml_runtime.js', 'gml_helpers.js', 'gml_compiler.js',
  'gml_codegen.js', 'gml_translator.js']) {
  vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), sb, { filename: f });
}
const W = sb.window;

let pass = 0;
const failures = [];

/**
 * Compile `events` as an object, spawn it, step once, and hand the instance and
 * runtime to `check`. `check` returns a string on failure.
 */
function scenario(title, events, check, extraObjects) {
  const runtime = new W.GMLRuntimeEnvironment();
  runtime.$chapter = 'ch3';
  W.activeGMLRuntime = runtime;
  W.GML_HELPERS.for(runtime);
  const t = new W.GMLTranslator(runtime);

  try {
    for (const [name, ev] of Object.entries(extraObjects || {})) {
      const c = t.compileObject(name, ev);
      runtime.registerObject(name, vm.runInContext(
        `(function(GMLInstance, runtime){${c.code}\n;return ${name};})`, sb)(W.GMLInstance, runtime));
    }
    const c = t.compileObject('obj_probe', events);
    if (c.errors.some(e => /COMPILE ERROR/.test(e))) throw new Error(c.errors.join('; '));
    runtime.registerObject('obj_probe', vm.runInContext(
      `(function(GMLInstance, runtime){${c.code}\n;return obj_probe;})`, sb)(W.GMLInstance, runtime));

    W.setActiveCtx(fakeCtx());
    const inst = runtime.createInstance('obj_probe', 100, 200);
    runtime.step();
    const problem = check(inst, runtime);
    if (problem) { failures.push(`${title}: ${problem}`); return; }
    pass++;
  } catch (err) {
    failures.push(`${title}: threw ${err.message}`);
  }
}

// ── with() rebinds self, and `other` is the caller ─────────────────────────
scenario('with() rebinds self; other is the caller',
  { create: `marker = 7; hit = 0;`,
    step: `
      var made = instance_create(x, y, obj_target);
      with (made)
      {
          hit = 1;                     // must land on the TARGET
          fromCaller = other.marker;   // must read the CALLER's variable
      }
    ` },
  (inst, rt) => {
    const t = rt.instances.find(i => i.object_name === 'obj_target');
    if (!t) return 'target was never created';
    if (t.hit !== 1) return `hit landed on the wrong instance (target.hit=${t.hit})`;
    if (inst.hit !== 0) return 'assignment leaked onto the caller';
    if (t.fromCaller !== 7) return `other.marker resolved to ${t.fromCaller}, expected 7`;
    return null;
  },
  { obj_target: { create: `hit = 0; fromCaller = -1;` } });

// ── with() over an object type touches every instance ──────────────────────
scenario('with(objectType) iterates all instances',
  { step: `
      instance_create(x, y, obj_target);
      instance_create(x, y, obj_target);
      instance_create(x, y, obj_target);
      count = 0;
      with (obj_target)
          flagged = 1;
      with (obj_target)
          other.count += 1;
    ` },
  (inst, rt) => {
    const targets = rt.instances.filter(i => i.object_name === 'obj_target');
    if (targets.length !== 3) return `expected 3 targets, got ${targets.length}`;
    if (!targets.every(t => t.flagged === 1)) return 'not every instance was visited';
    if (inst.count !== 3) return `other.count accumulated to ${inst.count}, expected 3`;
    return null;
  },
  { obj_target: { create: `flagged = 0;` } });

// ── exit unwinds the whole event, even from inside a with ──────────────────
scenario('exit returns from the event from inside with()',
  { step: `
      reached = 0;
      instance_create(x, y, obj_target);
      with (obj_target)
          exit;
      reached = 1;
    ` },
  (inst) => (inst.reached === 0 ? null : 'code after the with() still ran'),
  { obj_target: { create: `dummy = 0;` } });

// ── break/continue apply to the with loop ─────────────────────────────────
scenario('break inside with() stops iterating instances',
  { step: `
      instance_create(x, y, obj_target);
      instance_create(x, y, obj_target);
      seen = 0;
      with (obj_target)
      {
          other.seen += 1;
          break;
      }
    ` },
  (inst) => (inst.seen === 1 ? null : `break did not stop the loop (seen=${inst.seen})`),
  { obj_target: { create: `dummy = 0;` } });

// ── nested with keeps each level's other straight ──────────────────────────
scenario('nested with() keeps each level of other distinct',
  { step: `
      depth = 1;
      with (instance_create(x, y, obj_target))
      {
          depth = 2;
          with (instance_create(x, y, obj_other))
          {
              depth = 3;
              sawInner = other.depth;    // the obj_target (depth 2)
          }
          sawOuter = other.depth;        // the probe (depth 1)
      }
    ` },
  (inst, rt) => {
    const t = rt.instances.find(i => i.object_name === 'obj_target');
    const o = rt.instances.find(i => i.object_name === 'obj_other');
    if (!t || !o) return 'instances missing';
    if (o.sawInner !== 2) return `inner other.depth = ${o.sawInner}, expected 2`;
    if (t.sawOuter !== 1) return `outer other.depth = ${t.sawOuter}, expected 1`;
    return null;
  },
  { obj_target: { create: `depth = 0; sawOuter = -1;` }, obj_other: { create: `depth = 0; sawInner = -1;` } });

// ── arrays auto-create and grow, including 2D ──────────────────────────────
scenario('arrays auto-create and grow, 1D and 2D',
  { step: `
      slots[3] = 42;
      grid[1][2] = 9;
      len = array_length(slots);
      readBack = slots[3];
      readGrid = grid[1][2];
      gap = slots[0];
    ` },
  (inst) => {
    if (inst.len !== 4) return `array_length = ${inst.len}, expected 4`;
    if (inst.readBack !== 42) return `slots[3] = ${inst.readBack}, expected 42`;
    if (inst.readGrid !== 9) return `grid[1][2] = ${inst.readGrid}, expected 9`;
    if (inst.gap !== 0) return `gap filled with ${inst.gap}, expected 0`;
    return null;
  });

// ── #RRGGBB is RGB and packs to a BGR integer ─────────────────────────────
scenario('#RRGGBB literal packs to GameMaker BGR',
  { step: `
      col = #00A2E8;
      red = color_get_red(col);
      green = color_get_green(col);
      blue = color_get_blue(col);
    ` },
  (inst) => {
    if (inst.red !== 0x00) return `red = ${inst.red}, expected 0`;
    if (inst.green !== 0xA2) return `green = ${inst.green}, expected 162`;
    if (inst.blue !== 0xE8) return `blue = ${inst.blue}, expected 232`;
    return null;
  });

// ── operators: div, word forms, <>, and GML precedence ────────────────────
scenario('div / mod / and / or / not / <> all behave',
  { step: `
      a = 7 div 2;
      b = -7 div 2;
      c = 7 mod 3;
      d = (1 and 1);
      e = (0 or 1);
      f = (not 0);
      g = (3 <> 4);
      h = 1 + 2 * 3;
    ` },
  (inst) => {
    const want = { a: 3, b: -3, c: 1, d: true, e: true, f: true, g: true, h: 7 };
    for (const [k, v] of Object.entries(want)) {
      if (inst[k] !== v && !(typeof v === 'boolean' && !!inst[k] === v)) {
        return `${k} = ${inst[k]}, expected ${v}`;
      }
    }
    return null;
  });

// ── a statement may span many lines ───────────────────────────────────────
scenario('multi-line statements parse as one statement',
  { step: `
      total = 1 +
              2 +
              3;
      flag = (total == 6 &&
              total > 5)
             ? 1
             : 0;
    ` },
  (inst) => {
    if (inst.total !== 6) return `total = ${inst.total}, expected 6`;
    if (inst.flag !== 1) return `flag = ${inst.flag}, expected 1`;
    return null;
  });

// ── var is function-scoped and may be redeclared ──────────────────────────
scenario('var is function-scoped and redeclarable',
  { step: `
      switch (1)
      {
          case 1:
              var v = 10;
              break;
          case 2:
              var v = 20;
              break;
      }
      if (true)
          var later = 5;
      escaped = later;
      fromSwitch = v;
    ` },
  (inst) => {
    if (inst.fromSwitch !== 10) return `switch var = ${inst.fromSwitch}, expected 10`;
    if (inst.escaped !== 5) return `var declared in a block did not outlive it (got ${inst.escaped})`;
    return null;
  });

// ── x = 1+2 is arithmetic, not one number token ───────────────────────────
scenario('number lexing does not swallow operators',
  { step: `n = 1+2; m = 3-1; o = .5 + 1;` },
  (inst) => {
    if (inst.n !== 3) return `1+2 = ${inst.n}`;
    if (inst.m !== 2) return `3-1 = ${inst.m}`;
    if (inst.o !== 1.5) return `.5+1 = ${inst.o}`;
    return null;
  });

// ── do ... until repeats while the condition is false ─────────────────────
scenario('do ... until loops until the condition holds',
  { step: `
      i = 0;
      do
      {
          i++;
      }
      until (i >= 4);
    ` },
  (inst) => (inst.i === 4 ? null : `i = ${inst.i}, expected 4`));

// ── an instance id works as an instance reference ─────────────────────────
scenario('a raw instance id derefs as an instance reference',
  { step: `
      var made = instance_create(x, y, obj_target);
      var handle = made.id;
      handle.tagged = 5;
      readBack = handle.tagged;
    ` },
  (inst, rt) => {
    const t = rt.instances.find(i => i.object_name === 'obj_target');
    if (!t) return 'target missing';
    if (t.tagged !== 5) return `write through the id did not land (tagged=${t.tagged})`;
    if (inst.readBack !== 5) return `read through the id gave ${inst.readBack}`;
    return null;
  },
  { obj_target: { create: `tagged = 0;` } });

// ── alarms fire before Step, not after ────────────────────────────────────
scenario('alarm set to 1 fires on the next frame, before Step',
  { create: `alarm[0] = 1; fired = 0; order = "";`,
    step: `order += "S";`,
    alarm_0: `fired = 1; order += "A";` },
  (inst, rt) => {
    // create -> step 1 (alarm ticks 1->0 and fires, then Step runs)
    if (inst.fired !== 1) return 'alarm never fired';
    if (inst.order !== 'AS') return `event order was "${inst.order}", expected "AS"`;
    return null;
  });

// ── event_user dispatches to the right instance through with() ────────────
scenario('with(inst) event_user(0) runs on the target',
  { step: `
      var made = instance_create(x, y, obj_target);
      with (made)
          event_user(0);
    ` },
  (inst, rt) => {
    const t = rt.instances.find(i => i.object_name === 'obj_target');
    if (!t) return 'target missing';
    if (t.userRan !== 1) return `user event did not run on the target (userRan=${t.userRan})`;
    if (inst.userRan === 1) return 'user event ran on the caller instead';
    return null;
  },
  { obj_target: { create: `userRan = 0;`, other_10: `userRan = 1;` } });

// ── div truncates its OPERANDS first, per the manual ──────────────────────
// "the div operator first converts its operands into integers, then performs
// integer division" — which is not the same as truncating the quotient.
scenario('div converts operands to integers before dividing',
  { step: `
      a = 3.9 div 1.5;     // 3 div 1 = 3, NOT trunc(3.9/1.5) = 2
      b = 7 div 2;
      c = -7 div 2;
      d = 23 div 2;
      e = 9.9 div 2.9;     // 9 div 2 = 4
    ` },
  (inst) => {
    const want = { a: 3, b: 3, c: -3, d: 11, e: 4 };
    for (const [k, v] of Object.entries(want)) {
      if (inst[k] !== v) return `${k} = ${inst[k]}, expected ${v}`;
    }
    return null;
  });

// ── GML truthiness is > 0.5, exactly ──────────────────────────────────────
// "GameMaker will interpret a real number equal to or below 0.5 as a false
// value, and any real number greater than 0.5 as being true."
scenario('a real is true only when greater than 0.5',
  { step: `
      lowFalse = 0;
      halfFalse = 0;
      aboveTrue = 0;
      oneTrue = 0;
      if (0.4)
          lowFalse = 1;
      if (0.5)
          halfFalse = 1;
      if (0.6)
          aboveTrue = 1;
      if (1)
          oneTrue = 1;
    ` },
  (inst) => {
    if (inst.lowFalse !== 0) return '0.4 was truthy';
    if (inst.halfFalse !== 0) return '0.5 was truthy (must be false: "equal to or below 0.5")';
    if (inst.aboveTrue !== 1) return '0.6 was falsy';
    if (inst.oneTrue !== 1) return '1 was falsy';
    return null;
  });

// ── an alarm with no handler does not count down ───────────────────────────
// Per the manual: "an alarm with no actions or code in it will not count down."
scenario('an alarm with no handler never counts down',
  { create: `alarm[3] = 2; alarm[0] = 2; firedZero = 0;`,
    step: `slotThree = alarm[3];`,
    alarm_0: `firedZero = 1;` },
  (inst) => {
    // One frame has passed: alarm[0] has a handler so it ticked 2 -> 1;
    // alarm[3] has none so it must still be 2.
    if (Number(inst.slotThree) !== 2) return `alarm[3] counted down to ${inst.slotThree}, expected to stay at 2`;
    if (Number(inst.alarm[0]) !== 1) return `alarm[0] is ${inst.alarm[0]}, expected 1 after one frame`;
    return null;
  });

// ── direction is a stored property, independent of velocity ────────────────
// Manual: direction "can be used to set the direction of movement of the
// instance when it has a speed other than 0" — i.e. setting it at speed 0 must
// persist so a later `speed = s` moves that way.
scenario('direction set at speed 0 persists and aims a later speed',
  { create: `direction = 135; speed = 4;` },
  (inst) => {
    // spawn (100, 200); one step of movement at 4px toward 135° (up-left)
    const ex = 100 + 4 * Math.cos(135 * Math.PI / 180);
    const ey = 200 - 4 * Math.sin(135 * Math.PI / 180);
    if (Math.abs(inst.x - ex) > 0.01) return `x = ${inst.x}, expected ${ex.toFixed(3)}`;
    if (Math.abs(inst.y - ey) > 0.01) return `y = ${inst.y}, expected ${ey.toFixed(3)}`;
    if (Math.round(inst.direction) !== 135) return `direction read back as ${inst.direction}`;
    return null;
  });

// ── speed can be negative (travels opposite direction) ─────────────────────
scenario('negative speed moves opposite the facing direction',
  { create: `direction = 0; speed = -3;` },
  (inst) => (Math.abs(inst.x - 97) < 0.01 ? null : `x = ${inst.x}, expected 97`));

// ── banker's rounding ───────────────────────────────────────────────────────
// Manual: "2.5 would be rounded to 2, while 3.5 will be rounded to 4".
scenario('round() is banker\'s rounding',
  { step: `a = round(0.5); b = round(1.5); c = round(2.5); d = round(3.5); e = round(-0.5); f = round(2.4);` },
  (inst) => {
    const want = { a: 0, b: 2, c: 2, d: 4, e: 0, f: 2 };
    for (const [k, v] of Object.entries(want)) if (inst[k] !== v) return `${k} = ${inst[k]}, expected ${v}`;
    return null;
  });

// ── Destroy event runs when the instance is destroyed ─────────────────────
scenario('instance_destroy runs the Destroy event',
  { step: `
      var made = instance_create(x, y, obj_target);
      instance_destroy(made);
    ` },
  (inst, rt) => {
    if (W.destroyFired !== 1) return 'destroy event never ran';
    if (rt.instances.some(i => i.object_name === 'obj_target')) return 'instance survived destruction';
    return null;
  },
  { obj_target: { create: `dummy = 0;`, destroy: `global.destroyFired = 1;` } });

// ── Animation End (Other_7) fires when the animation wraps ────────────────
scenario('animation end fires when image_index wraps image_number',
  { create: `sprite_index = "spr_sneo_crew"; image_speed = 2; ended = 0;`,
    other_7: `ended = 1;` },
  (inst, rt) => {
    // 4 frames at speed 2: step 1 -> idx 2, step 2 -> wraps and fires.
    rt.step();
    if (Number(inst.ended) !== 1) return `animation end did not fire (idx=${inst.image_index})`;
    if (Number(inst.image_index) >= 4) return `image_index did not wrap (${inst.image_index})`;
    return null;
  });

// ── Outside Room (Other_0) fires when the box leaves the room ─────────────
scenario('outside room fires once the instance leaves the room',
  { create: `escaped = 0;`,
    step: `x = 2000;`,
    other_0: `global.outsideFired = 1; instance_destroy();` },
  (inst, rt) => {
    if (W.outsideFired !== 1) return 'outside-room event never fired';
    if (!inst.destroyed) return 'instance not destroyed by its outside-room handler';
    return null;
  });

// ── collision_rectangle finds instances; notme excludes the caller ────────
scenario('collision_rectangle hits a real bbox and honours notme',
  { step: `
      instance_create(300, 200, obj_target);
      hit = collision_rectangle(280, 180, 320, 220, obj_target, false, true);
      found = (hit != -4);
      selfhit = collision_rectangle(x - 50, y - 50, x + 50, y + 50, obj_probe, false, true);
      notmeOk = (selfhit == -4);
    ` },
  (inst) => {
    if (!inst.found) return 'collision_rectangle missed a target sitting inside the rect';
    if (!inst.notmeOk) return 'notme failed to exclude the calling instance';
    return null;
  },
  { obj_target: { create: `sprite_index = "spr_sneo_crew";` } });

// ── sprite_width is signed and uses the declared frame ────────────────────
scenario('sprite_width is signed under a negative scale',
  { create: `sprite_index = "spr_sneo_crew"; image_xscale = -2;`,
    step: `sw = sprite_width;` },
  (inst) => (inst.sw === -80 ? null : `sprite_width = ${inst.sw}, expected -80 (40 × -2)`));

// ── bbox and collision are rotation-aware ───────────────────────────────
// spr_sneo_crew: 40x48, origin (18, 22). Rotated 90° at (300, 200) the
// transformed box is x ∈ [278, 326], y ∈ [178, 218] — computed from the same
// transform the renderer uses. The old AABB ignored image_angle completely,
// which put every rotated sword's hitbox in the wrong place.
scenario('bbox accounts for image_angle',
  { create: `sprite_index = "spr_sneo_crew"; image_angle = 90; x = 300; y = 200;`,
    step: `l = bbox_left; r = bbox_right; t = bbox_top; b = bbox_bottom;` },
  (inst) => {
    const got = { l: Math.round(inst.l), r: Math.round(inst.r), t: Math.round(inst.t), b: Math.round(inst.b) };
    const want = { l: 278, r: 326, t: 178, b: 218 };
    for (const k of Object.keys(want)) {
      if (Math.abs(got[k] - want[k]) > 1) return `bbox_${k} = ${got[k]}, expected ${want[k]}`;
    }
    return null;
  });

scenario('collision_point respects rotation',
  { step: `
      var t = instance_create(300, 200, obj_target);
      t.image_angle = 90;
      hitWide = (collision_point(325, 200, obj_target, false, true) != -4);
      missBelow = (collision_point(300, 224, obj_target, false, true) == -4);
    ` },
  (inst) => {
    // 325 is outside the unrotated box (right edge 322) but inside the rotated
    // one (326); 224 is inside unrotated (bottom 226) but outside rotated (218).
    if (!inst.hitWide) return 'point inside the rotated box was missed';
    if (!inst.missBelow) return 'point outside the rotated box was hit';
    return null;
  },
  { obj_target: { create: `sprite_index = "spr_sneo_crew";` } });

// ── an instance with no sprite and no mask cannot collide ─────────────────
scenario('maskless instances cannot collide',
  { step: `
      instance_create(300, 200, obj_ghost);
      ghostHit = (collision_rectangle(250, 150, 350, 250, obj_ghost, false, false) != -4);
    ` },
  (inst) => (inst.ghostHit ? 'a sprite-less instance collided' : null),
  { obj_ghost: { create: `timer = 0;` } });

// ── Collision events dispatch with `other` bound to the touched instance ──
scenario('a Collision_<other> event fires on overlap with other bound',
  { step: `
      instance_create(300, 200, obj_hitter);
      instance_create(300, 200, obj_hittee);
    ` },
  (inst, rt) => {
    rt.step();   // the two spawned this frame; collisions test next step
    if (W.collisionHit !== 1) return 'collision event never fired';
    if (W.collisionOtherTag !== 42) return `other resolved wrong (tag=${W.collisionOtherTag})`;
    return null;
  },
  {
    obj_hitter: {
      create: `sprite_index = "spr_sneo_crew";`,
      'collision:obj_hittee': `global.collisionHit = 1; global.collisionOtherTag = other.tag;`,
    },
    obj_hittee: { create: `sprite_index = "spr_sneo_crew"; tag = 42;` },
  });

// ── surfaces are real render targets ───────────────────────────────────────
scenario('surfaces create, target, and free as real objects',
  { step: `
      surf = surface_create(64, 32);
      okExists = surface_exists(surf);
      wgot = surface_get_width(surf);
      surface_set_target(surf);
      draw_clear_alpha(c_black, 0);
      surface_reset_target();
      surface_free(surf);
      goneOk = !surface_exists(surf);
    ` },
  (inst) => {
    if (!inst.okExists) return 'surface_exists false right after create';
    if (inst.wgot !== 64) return `surface_get_width = ${inst.wgot}, expected 64`;
    if (!inst.goneOk) return 'surface still exists after surface_free';
    return null;
  });

// ── an object's own method, called through with() ──────────────────────────
// GML 2.3 objects declare methods in an event; another object reaches them with
// `with (thing) TheMethod(1)`. An unqualified call resolves against `self`
// BEFORE globals — obj_dbulletcontroller calls obj_shutta_photo_attack's DoFlip
// exactly this way, and resolving only against globals silently returned 0.
scenario('an object method resolves through with(), self before globals',
  { step: `
      var made = instance_create(x, y, obj_target);
      with (made)
          Bump(7);
    ` },
  (inst, rt) => {
    const t = rt.instances.find(i => i.object_name === 'obj_target');
    if (!t) return 'target missing';
    if (typeof t.Bump !== 'function') return 'method was not defined on the instance';
    if (t.got !== 7) return `method ran with got=${t.got}, expected 7`;
    if (t.ran !== 1) return 'method body did not run';
    return null;
  },
  { obj_target: { create: `
      got = -1;
      ran = 0;
      function Bump(arg0 = -1)
      {
          if (arg0 > -1)
              got = arg0;
          ran = 1;
      }
    ` } });

// ── a method's default parameter applies when omitted ─────────────────────
scenario('method default parameter applies when the argument is omitted',
  { step: `
      var made = instance_create(x, y, obj_target);
      with (made)
          Bump();
    ` },
  (inst, rt) => {
    const t = rt.instances.find(i => i.object_name === 'obj_target');
    if (!t) return 'target missing';
    if (t.got !== -1) return `default not applied (got=${t.got}, expected -1)`;
    if (t.ran !== 1) return 'method body did not run';
    return null;
  },
  { obj_target: { create: `
      got = -99;
      ran = 0;
      function Bump(arg0 = -1)
      {
          got = arg0;
          ran = 1;
      }
    ` } });

// ── sprite_index assignment refreshes image_number ────────────────────────
scenario('assigning sprite_index refreshes image_number',
  { create: `sprite_index = "spr_sneo_crew";`,
    step: `frames = image_number;` },
  (inst) => {
    const expected = (W.GML_SPRITE_FRAMES && W.GML_SPRITE_FRAMES['spr_sneo_crew']) || 0;
    if (!expected) return null;   // sprite not exported here; nothing to assert
    // `frames` is what the GML read produced, which is the thing that matters.
    return inst.frames === expected ? null
      : `image_number read as ${inst.frames}, expected ${expected}`;
  });

// ── report ────────────────────────────────────────────────────────────────
const total = pass + failures.length;
console.log(`semantics checks: ${pass}/${total} passed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exitCode = 1;
}
