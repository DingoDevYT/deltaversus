/**
 * attack_specs.js — GENERATED/CURATED. Per-attack assertions transcribed from
 * the real GML, consumed by spec_check.js.
 *
 * Every assertion must be a NUMBER THE SOURCE STATES, with `src` naming the
 * file and line it came from. Nothing here is a judgement about how an attack
 * should feel — that is what the reference footage is for. If an assertion
 * cannot be traced to a line of GML, it does not belong in this file.
 */
window.ATTACK_SPECS = [
  {
    id: 'knight_type109',
    name: 'Swordslash',
    assertions: [
      // Dispatcher: obj_dbulletcontroller Step type==109 spawns the warp on the
      // boss and the generator at (camerax()+480+80)-80, cameray()+160.
      { kind: 'spawns', obj: 'obj_bullet_knight_crescentGenerator', byFrame: 8, min: 1, max: 1,
        why: 'type 109 creates exactly one crescent generator',
        src: 'obj_dbulletcontroller_Step_0.gml:2247' },
      // Frame 1, before the generator's movement block runs: its y is chosen
      // from `ypos[]` and drifts, and measured 164 then 181 on two runs, so any
      // later frame is asserting on RNG.
      { kind: 'pos', obj: 'obj_bullet_knight_crescentGenerator', atFrame: 1, x: 480, y: 160, tol: 2,
        why: '(camerax()+480+80)-80 = 480, cameray()+160 = 160 with the view at origin',
        src: 'obj_dbulletcontroller_Step_0.gml:2247' },
      { kind: 'spawns', obj: 'obj_knight_warp', byFrame: 8, min: 1,
        why: 'created on creatorid (the boss) then event_user(1)',
        src: 'obj_dbulletcontroller_Step_0.gml:2236' },

      // Generator Create sets type = 2, so Step init selects the type-2 block.
      // Create's yposcount = 7 / shootrate = 30 are OVERWRITTEN there — a good
      // canary for "did init actually run".
      { kind: 'ivar', obj: 'obj_bullet_knight_crescentGenerator', atFrame: 30, name: 'init', eq: 1,
        why: 'init flips to 1 once the box is found',
        src: 'obj_bullet_knight_crescentGenerator_Step_0.gml:82' },
      { kind: 'ivar', obj: 'obj_bullet_knight_crescentGenerator', atFrame: 30, name: 'yposcount', eq: 6,
        why: 'type 2 sets yposcount = 6, overwriting Create\'s 7',
        src: 'obj_bullet_knight_crescentGenerator_Step_0.gml:32' },
      { kind: 'ivar', obj: 'obj_bullet_knight_crescentGenerator', atFrame: 30, name: 'movementmode', eq: 1,
        why: 'type 2 sets movementmode = 1',
        src: 'obj_bullet_knight_crescentGenerator_Step_0.gml:28' },
      { kind: 'ivar', obj: 'obj_bullet_knight_crescentGenerator', atFrame: 30, name: 'posrange', eq: 2,
        why: 'type 2 sets posrange = 2',
        src: 'obj_bullet_knight_crescentGenerator_Step_0.gml:31' },
      { kind: 'ivar', obj: 'obj_bullet_knight_crescentGenerator', atFrame: 30, name: 'shootrate', min: 15, max: 20,
        why: 'type 2 sets 15, or 20 when obj_knight_enemy.damagereduction == 0.04',
        src: 'obj_bullet_knight_crescentGenerator_Step_0.gml:29,39' },
      { kind: 'ivar', obj: 'obj_bullet_knight_crescentGenerator', atFrame: 30, name: 'myspeed', eq: -1,
        why: 'type 2 sets myspeed = -1',
        src: 'obj_bullet_knight_crescentGenerator_Step_0.gml:34' },

      // The generator must actually fire.
      { kind: 'spawns', obj: 'obj_bullet_knightcrescent', byFrame: 120, min: 1,
        why: 'a generator that never emits a crescent is the whole attack failing silently',
        src: 'obj_bullet_knight_crescentGenerator_Step_0.gml' },
    ],
  },
];
