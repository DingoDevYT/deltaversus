# GML Translator Engine — architecture & handover

This covers the **runtime GML→JS pipeline** behind `docs/gml_studio.html` (paste real
Deltarune GML, watch it run). It is a separate path from the hand-porting pipeline in
`DELTAVERSUS_PORTING_PLAYBOOK.md` / `patterns.js`, which stays the route for shipping
attacks into the multiplayer battle engine.

## What an "attack" actually is

**An attack is a controller object plus a `type`, not an object.** This is the single
most important thing to know here, and the old preset list got it wrong.

Each boss dispatches differently, and `scripts/gen_attacks.js` reads the real roster
out of the dispatchers rather than guessing from object names:

| Boss | How it dispatches | Attacks |
|---|---|---|
| The Roaring Knight (ch3) | `obj_knight_enemy` Step: `myattackchoice == N` → spawns `obj_dbulletcontroller` with `.type = M`. Every attack's logic is a `type == M` branch inside that one 3,000-line controller. | 15 |
| Spamton NEO (ch2) | same shape, selector is `rr`, mostly `obj_sneo_bulletcontroller` (plus `obj_dbulletcontroller`, `obj_sneo_phonecall`) | 11 |
| Gerson / Hammer of Justice (ch4) | standalone controllers, chosen by `scr_spearshot`'s `arg3` | 7 |

Every attack announces itself with `global.monsterattackname[myself] = "..."`, which is
what the extractor anchors on — that works regardless of which variable the boss uses
to select.

The consequence: `obj_sneo_wall_controller_new` (the "mail wall") is **not an attack**.
It's a sub-part of Spamton NEO's `RECREWColumns`, spawned by
`obj_sneo_bulletcontroller` type 6. Running it directly skips the real entry point.
The 154-entry object list conflated attack controllers, bullet objects, VFX helpers
and support objects; it is still available in the studio under
"individual objects", which is useful for isolating one bullet, but it is not a
roster of attacks.

To run an attack: spawn its `controller`, set `.type`, and step. That executes the real
code path, which is why it beats extracting code fragments.

## Status

- **154/154 presets** compile with zero GML parse errors and zero JS syntax errors.
- **154/154 run 60 frames in-browser** with no runtime errors, NaN positions, or crashes.
- **16/16 semantics checks** pass (`with`/`other`/`exit`/arrays/operators/alarm order/...).
- **208/208 support objects** compile.
- **~0.18 ms per step**, peak 408 instances (33 ms budget at 30 FPS).

Verify with:

```bash
node scripts/test_semantics.js && node scripts/test_compiler.js && node scripts/test_runtime.js
```

`test_semantics.js` is the one to trust when changing the compiler — it asserts the
actual rules rather than just "nothing threw". The preset suites catch regressions in
breadth; the semantics suite catches regressions in meaning.

## Why the old translator couldn't get there

`gml_translator.js` used to be line-by-line regex substitution. That approach cannot
express what Deltarune attack code actually does, and each of these was silently wrong
rather than loudly broken:

| GML | What regex substitution did |
|---|---|
| `with (inst) { ... }` (34,567 uses) | Rewrote the header but left the body pointing at the *original* instance, so the block was a no-op or worse. 54% of them have no braces at all. |
| `other` (10,418 uses) | Emitted a bare `other`, i.e. `undefined`. |
| `exit` inside nested blocks | Only handled `exit;` at statement level. |
| `a[i] = v` | GML auto-creates and grows arrays; nothing did. 11,121 chained 2D writes (`a[i][j]`) needed the intermediate row created. |
| `#00A2E8` | Became `0x00A2E8` read as BGR — every such colour came out with red and blue swapped. |
| `x = 1+2` | The number lexer's character class swallowed `1+2` as one token. |
| 22.6% of statements spanning 2+ lines | Mangled, since a line was assumed to be a statement. |
| `div`, `mod`, `and`, `or`, `not`, `<>` | Treated as identifiers. |

## Architecture

```
docs/js/
  gml_compiler.js      lexer + recursive-descent parser -> AST
  gml_codegen.js       AST -> JavaScript (the scope model lives here)
  gml_translator.js    assembles events into a runtime class; compiles scripts
  gml_helpers.js       the `$R` namespace + GameMaker-fidelity runtime patches
  gml_object_index.js  GENERATED — per-chapter asset tables & object defaults
  sprite_origins.js    GENERATED — sprite origins and frame counts
  gml_scripts.js       GENERATED — GlobalScript sources the presets reach
  gml_objects.js       GENERATED — event code for support objects they spawn
```

Regenerate the four generated files (they read the Desktop GML/REFDATA exports):

```bash
node scripts/gen_object_index.js && node scripts/gen_scripts.js && node scripts/gen_objects.js
```

### The scope model

Every event carries a stack of `(self, other)` bindings. At the top of an event self is
`$s0` (= `this`); `with` pushes a new pair:

```js
{ const $o1 = $s0;                              // caller becomes `other`
  const $L1 = $R.withList(<target>, $o1);       // target evaluated in the CALLER's scope
  for (let $k1 = 0; $k1 < $L1.length; $k1++) {
    const $s1 = $L1[$k1];
    if ($s1.destroyed) continue;
    ... body compiled against $s1 / $o1 ...
  } }
```

Because that's a real loop in the same function, `break` leaves the `with`, `continue`
skips one instance, and `exit` returns from the whole event — matching GameMaker. Nesting
works to any depth (the corpus goes to 5, including a `with` chain re-entered inside a
closure). Every compiler-internal name is `$`-prefixed; GML identifiers can't contain `$`,
so temporaries never collide with user variables.

Identifier resolution order: local `var` → literal (`true`/`false`) → `global` → builtin
constant → enum → compiled script → asset name → builtin function → instance variable.

### Things worth knowing before you change it

- **`var` is function-scoped in GML, not block-scoped**, and may be redeclared. All `var`s
  are hoisted to one `let` at the top of the function and declarations become assignments.
  `__view_get` declares `var __cam` in two `switch` arms, which is a JS SyntaxError otherwise.
- **A raw instance id is a valid instance reference in GML.** `target.__scipt = x` where
  `target` holds an id compiles through `$R.d(...)`, which maps an id back to its instance
  and returns an inert sink if it no longer exists (so one dead reference can't kill an event).
- **A GlobalScript *file* can declare several functions.** `scr_movetowards.gml` declares
  three. Registering only the first made that function return nothing, quietly turning every
  caller's value into `NaN`.
- **`argument0..N`, `argument[i]`, and `argument_count`** are all used by legacy scripts and
  all supported. `scr_script_delayed` reads its delay as `argument[1]`.
- **Direct `builtin(...)` calls are only safe** because `GML_HELPERS.ensureBuiltins()`
  guarantees every name in `GML_BUILTIN_FNS` exists on `window`. Without that guarantee the
  emission decision depended on script load order, and core math like `irandom()` degraded
  to a stub returning 0 — which corrupts loop bounds.
- **GameMaker does NOT auto-run a parent's event.** There is no implicit `super` call;
  `event_inherited()` compiles to `$R.inherited(...)`.
- Unknown functions route through `$R.miss`, which resolves on `window` at call time and
  degrades to 0 with one warning rather than aborting the event.

### Runtime fidelity fixes in `gml_helpers.js`

Each of these changed visible behaviour:

| Fix | Was |
|---|---|
| Alarms run **before** Step, and each event type runs as a phase across all instances | Alarms ticked inside per-instance movement, i.e. *after* Step, so every alarm fired a frame late relative to the code reading it |
| Depth sort breaks ties on creation id | Unstable sort on `depth` alone made same-depth sprites swap render order between frames (visible flicker) |
| `image_number` derived from the sprite | Stayed 1 forever, so every animation was frozen on frame 0 |
| `make_color_rgb` packs BGR | Packed RGB while `toCSSColor` decoded BGR — red/blue swapped |
| `image_blend` tints real sprites | Only tinted the missing-sprite placeholder |
| `collision_*` / `place_meeting` do real AABB tests against sprite masks | Hardcoded to return `noone`, so every shootable/destructible interaction silently did nothing |
| Object defaults (sprite, mask, depth, visible, parent) applied before Create | Never applied |
| `room_width`/`room_height`/`fps` and the `bm_*` constants defined | A `ReferenceError` that killed the whole Step event — so off-screen bullets never despawned |
| `draw_circle` skips a negative radius | Canvas `arc()` throws where GameMaker draws nothing |

`sprite_origins.js` **did not exist** — `gml_studio.html` had a `<script>` tag for it and
`gml_asset_db.js` read `window.GML_SPRITE_ORIGINS`, so every origin was `(0,0)` and every
sprite drew top-left-anchored instead of on its origin.

### Safety valve

`$R.maxCreationsPerFrame` (4000) and `$R.maxInstances` (20000) are a backstop against a
genuinely unbounded spawner, not a performance budget. Keep them generous: real attacks
burst into the hundreds (`obj_knight_roaring_fx` peaks near 340 before cleaning itself back
to 4), and refusing a spawn mid-attack corrupts logic that expects `instance_create` to
succeed.

## Sprites

`scripts/sync_sprites.js` copies every sprite the studio can reach out of the
`DELTARUNE - EXPORT` dumps and regenerates the manifest and origins. It went from 211
sprites to **1,346** (4,699 frames); nothing requested at runtime is missing now.

Two things it gets right that are easy to get wrong:

- **Origins must come from the same chapter as the art.** A merged origin table
  silently offsets any sprite that differs between chapters, so each sprite records
  which chapter it was taken from and reads that chapter's `sprites.tsv`.
  `gen_object_index.js` deliberately does NOT write `sprite_origins.js` for this reason.
- **Object DEFAULT sprites never appear in the GML.** GameMaker applies them before
  Create runs. `obj_sneo_rotatingwall_bomb`'s code only names bomb2/bomb3, but every
  instance spawns wearing its default `spr_mettaton_bomb1` — so the wall's bombs drew
  as placeholder squares until defaults (and parent chains) were included.

## Regenerating the tables

```bash
node scripts/gen_all.js
```

Use that rather than the individual generators. Order matters and objects/scripts are
**mutually** dependent — object events call scripts, scripts create objects — so
`gen_all.js` repeats that pair until both stop growing (converges in 3 rounds; running
each once left ~90 scripts per chapter uncollected). Then it does the index and sprites.

## The fidelity pass (positions / rotations / scales / animations / objects)

A deep audit against the manual, done after "no errors" proved insufficient. Every item
below was silently wrong — no error, just different behaviour than GameMaker:

| Area | Was | Now |
|---|---|---|
| `direction` | derived from velocity — setting it at speed 0 was LOST, so `bul.direction = d; bul.speed = s;` aimed right instead of `d` | stored property, per manual |
| `speed` | always `hypot(...)` ≥ 0 | signed, negative travels opposite `direction` |
| `round()` | `Math.round` (half up) | banker's rounding (half to even), per manual |
| `div` | truncated the quotient | truncates the OPERANDS first, per manual |
| Destroy event | never ran — `instance_destroy` only set a flag | runs while the instance still exists |
| Animation End (Other_7) | never extracted, never fired | fires when `image_index` wraps — this is how VFX destroy themselves |
| Outside Room (Other_0) | never extracted, never fired | fires each step the box is fully outside — how bullets clean up |
| `image_speed` default | 0 (animations frozen unless Create set it) | 1, the GameMaker default |
| Surfaces | no-op stubs — offscreen draws (incl. `draw_clear`) hit the SCREEN, hence the white rectangles on Knight attacks | real offscreen canvases with a target stack |
| Collision builtins | returned `noone` unconditionally | real AABB vs declared masks, `this`-bound so `notme`/`place_*` work |
| `bbox_left/right/top/bottom` | never computed (auto-array proxies) | real getters |
| `sprite_width/height`, `sprite_get_*` | trimmed-PNG size, unsigned | declared frame size, SIGNED per manual |
| `draw_sprite_tiled(_ext)` | drew one copy | tiles the whole target |
| `draw_sprite_stretched(_ext)`, shape `_colour` variants, `draw_sprite_general` rotation | stubs / dropped args | implemented |
| Preset shadowing | preset create/step/draw subsets shadowed full extracted event sets | extraction wins everywhere; presets only fill gaps |
| Trimmed art | 586 sprites drawn offset (crop unrecorded) | 1,932 frames upgraded to full-frame NEW RIP art (criterion: dimensions match the declared frame) |
| Battle globals between runs | `turntimer` left at 0 by one attack killed the next | reset per Transpile |

**Trap for future work:** never guard with an `inst.$flag` property — reading an unset
property through the instance proxy materialises a truthy auto-array, so the guard
reads as "already set" the first time. Use a WeakSet.

## Audio, collisions, masks, soul modes (round 3)

- **Sound**: `scripts/gen_sounds.js` copies every referenced sound (285 files, keyed to
  each chapter's sounds.tsv — the tsv `file` column has no extension; disk files are
  `<name>.wav/.ogg`). `docs/js/gml_audio.js` implements the `audio_*` natives that the
  compiled `snd_play`/`snd_play_x`/`snd_volume` GlobalScripts bottom out in, handles are
  first-class (gain/pitch on a handle), and the studio has a volume slider (persisted,
  `dv_studio_vol`). Browsers block audio until the first user interaction — one click
  and it self-heals. `translateAndPlay` stops all sounds between runs.
- **Collision events**: `gml_Object_X_Collision_Y.gml` files are extracted
  (`collision:Y` keys), compiled to `collision__Y($other)` methods with the pairs
  recorded on `Class.$collisions`, and dispatched by the step loop right after movement
  (the documented order). `other` inside the event is the touched instance. This is
  what makes shootable bullets (Collision_obj_yheart_shot) actually work.
- **Yellow soul (Spamton NEO)**: Z tap = pellet, hold ≥ 20 steps = big shot. Fires the
  REAL `obj_yheart_shot`; the big shot flips the boss's own `upgrade` flag so the
  object's authentic Create branch produces it.
- **Masking**: `gpu_set_blendmode_ext` maps the factor pairs Deltarune uses —
  `(bm_zero, bm_src_alpha)`→destination-in, `(bm_zero, bm_inv_src_alpha)`→destination-out
  — instead of collapsing everything to additive. `scr_draw_in_box_*` re-implemented:
  the runtime's own versions close over its OLD box math, so the clip rect was wrong.
- **Sprite smearing**: `draw_sprite_part(_ext)` now clamps the source rect and shifts
  the dest like GameMaker; canvas's clamp-but-keep-dest-size behaviour was stretching.
- **Shaders**: white/flash shaders render a white silhouette (`drawTinted` checks
  `$gmlShader`); all others are silent no-ops. `shd_*` names compile as strings.
- **Layer order**: the studio's box outline and SOUL are `runtime.$overlays` entries at
  depth 0 inside the depth pipeline — bullets at negative depth pass over them,
  positive-depth backgrounds sit behind. Overlay shape: `{depth, tie, draw(ctx)}`.

Known remaining gaps: shaders other than white-flash do nothing; music tracks aren't
auto-started (attacks rarely play music themselves).

## Round 6: real collision

GameMaker's actual model, both tiers:

- **Box tier** (`prec` false / pixels unavailable): the mask rectangle transformed by
  origin, SIGNED scale and image_angle. `bbox_left/right/top/bottom` are the
  axis-aligned bounds of that oriented box — **rotation-aware**, which the old AABB
  never was; every rotated sword used to test collision in the wrong place.
- **Precise tier** (`prec` true, and always for instance-vs-instance when both sides
  have pixels): per-pixel alpha masks, tolerance 0, built lazily in the browser from
  the drawn PNG (`frameMaskOf` → canvas `getImageData`, cached per sprite#frame). The
  mask rect is trimmed to opaque pixels, matching the Automatic mask mode. Sampling
  inverse-transforms each pixel of the overlap region into both sprites' local spaces
  (`worldToLocal`), so rotation and mirroring are exact. Regions above 160×160 fall
  back to the box tier (never reached by heart-sized overlaps).
- **Maskless instances cannot collide** (no sprite and no mask ⇒ skipped), matching
  the engine; previously they carried a phantom 16×16 box.
- Collision events and `place_meeting`/`instance_place` run mask-vs-mask; the
  `collision_rectangle/circle/point/line` family honours `prec` per the manual.
- Headless (Node) has no pixel data — everything degrades to the oriented-box tier,
  which is why the semantics tests target rotation (hand-computed rotated bbox) and
  the browser probe targets pixels (bbox corner: hits prec=false, misses prec=true on
  the heart's transparent corner).

## Round 4: five bosses, green soul, difficulty variants

The roster is now **142 attacks across five bosses**: Knight 15, Spamton NEO 11,
Gerson 7 controllers + **82 green-soul chart patterns**, **Jevil 18** (ch1),
**Pink 9** (ch5).

- **Gerson's green soul**: not controller attacks at all. `Other_10`
  (`event_user(0)`) fills `list_attack*[]` charts per `attackpattern == N`; the
  boss Step's `attackcon` machine feeds rows to `scr_spearshot`, which spawns the
  green switch → chevron → **the shield (obj_spearblocker) from a Draw event** →
  spears aimed at the shield. Launching one = spawn the boss with Step ACTIVE, set
  `attackpattern`, fire `event_user(0)`, set `attackcon = 1`. The shield reads
  `up_h()/left_h()...` — now real functions fed from `window.$gmlInput`, which the
  studio fills once per STEP (pressed edges included).
- **THE bug of the round**: `scr_spearshot` (25KB) was silently pruned by
  gen_scripts' 16KB size cap, so every green attack degraded to a `$R.miss`
  returning 0 — no error anywhere. Cap is now 40KB, mechanics scripts are in a
  KEEP set, and **never size-cap a mechanics script again**.
- **Jevil (ch1)**: predates `monsterattackname`. `obj_joker` Other_15 dispatches
  `jattack == N` → `obj_dbulletcontroller.type`, and ends with
  `with (obj_dbulletcontroller) joker = 1` — the ch1 controller gates its whole
  Jevil section on that flag (roster entries carry it as `controllerSet`).
- **Pink (ch5)**: standard `monsterattackname` dispatcher; the generic extractor
  needed zero changes.
- **Difficulty variants**: header DIFF 0/1/2 select sets `boss.difficulty` and
  `dc.difficulty`; HELL checkbox (shown when the attack records a `special`
  field) sets Spamton's `hellmode`/`dc.special`.
- **Controllers now spawn through the compiled `scr_bulletspawner`** with the
  boss as `self`, which stamps `creator`, `creatorid`, `target` and `damage` —
  a direct createInstance left all four unset and quietly corrupted anything
  reading them (sameattack checks, `scr_bullet_inherit`, damage scaling).

## Round 5: kill the caps, JIT everything, real input arrays

**Standing rule (from Landon): no caveats.** An unknown function means find its
definition in the GML and make the translator read it. Every failure this round
traced to information we already had on disk being dropped or bypassed:

- **Size caps are banned.** They silently deleted `scr_spearshot` (25KB, the green
  dispatcher), then `scr_monstersetup` (118KB) and `obj_purplecontrols` (121KB — the
  entire purple soul). Caps are now 256KB and only the named PRUNE list may drop
  anything.
- **Input**: `up_h()` etc are GlobalScripts reading `global.input_held[i]`
  (0=down 1=right 2=up 3=left, 4/7=confirm, 5/8=cancel, 6/9=menu — filled by
  `obj_time` in the game). The compiled scripts beat our native stubs, saw zeros,
  and the green shield never rotated. The studio now fills
  `input_held/input_pressed/input_released` every step. **The axe rotates**
  (`image_angle` chases `idealdir` — verified Right→0°, Up→90°).
- **Purple soul (Pink, ch5)**: `type 199` sets `spr_purpleheart` + `canmove = 0` and
  spawns `obj_purplecontrols`, the grid-lane movement controller. With the object
  extracted and inputs real, lane movement works (verified lane 1,1 → 1,0 with the
  heart moving a lane). The studio honours `canmove` and draws whatever sprite the
  game puts on the heart.
- **ch5 "unknown functions"** (`cycle`, `init`, `recalculate_box`, `trashy_beam_go`)
  were instance methods on unextracted objects; `ds_exists` is a real builtin (now
  native). `methodNames` also recognises `name = function()` / `static name = ...`.
- **JIT compilation**: with full extraction (~625 objects + ~600 scripts per
  chapter), precompiling on selection froze the page for minutes. Now only the
  object under test compiles up front; classes compile the first time something
  spawns them (`$R.ensureClass`, parents first, wired into `createInstance`) and
  scripts the first time they're called (`$R.scrCall` →
  `translator.compileSingleScript`). Page loads instantly; a JIT miss logs once.

## Round 7: the error-list-to-zero pass

- **bm_subtract is `destination-out`**, not `difference`. Deltarune's darkness
  overlays draw a black surface and subtract the light sprite to punch a transparent
  hole; `difference` inverted it to WHITE — the Gerson white-screen bug.
- **Function names resolve to their containing FILE.** `d_triangle` lives in
  `ossafe_shapes.gml`, the `vending_*` constructors in `scr_shop_vending.gml`,
  `scr_get_knight_total_attempts` in `scr_complete_save_file.gml`. Both gen_scripts
  and the JIT (`compileSingleScript`) now consult a declared-function index.
- **`new constructor()` on a script** compiles to `$R.scrGet(name)` so the
  constructor JIT-compiles before `new` sees it.
- **Runtime sprite reassignment works**: `sprite_create_from_surface` builds a real
  dynamic sprite (a canvas registered in every sprite table, masquerading as a
  loaded Image), and ALL sprite lookups pass `sprAlias()` — `spr_custom_box = <new>`
  redirects every draw, mask and size query.
- **Paths**: full runtime-path support (`path_add`/`path_add_point`/`path_start`
  with stop/restart/continue/reverse end-actions, polyline following in
  updateMovement). ASSET paths (`path_sneo_head_path1`) are a resource type that is
  **not in the export dumps at all** — the one true external gap; a path export
  would make those exact.
- info/shop scripts un-pruned (the ch4 arena furniture legitimately calls them);
  object walk depth 3.
- Process note, learned the hard way: never patch generators with `node -e` string
  replacement — a silent non-match cost Jevil his `joker = 1` flag for a whole
  round. Use real edits.

## Round 8: the REAL battle box (dispatcher replay)

The box was a hardcoded singleton that never ran Step/Draw, so no attack could
resize or reshape it. The fix is structural, not another preset table:

- **The battle box is the chapter's real `obj_growtangle` instance.** Its own
  Step grows it in (`image_xscale = maxxscale * timer/maxtimer` + spin +
  afterimages), rebuilds the custom-size sprite through a surface when
  `maxxscale != 2` (rounded to n/37.5), and `with (obj_battlesolid)` reaches it
  through the parent chain. Ch1's growtangle has no maxxscale at all — fixed 2×
  — and gets that for free by compiling ch1's own object.
- **Box sizing lives in the BOSS's Step, not the dispatcher**: a
  `if (!instance_exists(obj_growtangle)) { instance_create(...); if (rr == 6)
  {x += 58; maxxscale = 3.33; ...} }` block keyed on the selector variable.
  `gen_attacks` slices each boss's block verbatim (`GML_ATTACKS_BOXSETUP`) and
  the studio replays it with `self = boss` after setting the selector — the
  block self-selects the right branch. No guessed presets anywhere.
- **Each attack's whole dispatcher branch is captured as `attack.setup`**
  (backward brace-walk from the `monsterattackname` announcement to the branch
  `{`) and replayed with `self = boss` instead of manually spawning the
  controller. That's what carries Pink's per-attack box code, and —
  the user-visible payoff — **`obj_purplecontrols.mode`** (2 = bomb lanes,
  7 = 3d tunnel), heart markers, and `maxxscale 3.75` for the tunnel. Unbraced
  or >3.5 KB branches fall back to the old manual spawn (52 of 60 replay).
- **`getInstances('obj_growtangle')` must never return `[null]`.** The legacy
  singleton alias made `instance_exists()` lie, silently skipping every box
  creation. Real instances win; the alias only backstops. Same lesson as the
  auto-array trap: aliases that answer for dead objects poison `if (!exists)`.
- **The Knight's box block opens with `event_user(0)` — his attack chooser** —
  which would override the roster pick with his own turn sequence. The studio
  stubs `H.eventUser` during the box replay only (swap the helper, never read
  an instance property you don't know exists — auto-array trap).
- `scr_moveheart` is stubbed at the `H.scr` level (real one tweens via
  `obj_moveheart` from `obj_herokris`, battle furniture the studio doesn't run);
  it just centres the soul in the box, which is the real contract.
- Verified 1:1: Swordslash slit box at x=168 (320−152, 0.5×), Stars 168×132,
  xattacks 262×262, sword tunnel 300,190 224×150, RECREW 303,170 250×172,
  **Roaring 1100×900+ (the border leaves the screen — arena IS the screen)**,
  Pink tunnel 277×277 with purple mode 7, and **Jevil's BYE BYE (type 77)
  fades the box out and `instance_destroy()`s it at timer 10** while laser
  scythes sweep the view — "NO BOX" there is fidelity, not a bug. (His type 25
  finale keeps the 150×150 box and floods the screen from the view edges.)
  Sweep: 62 launches, 60 boxes exact + those 2 correct removals, 0 errors;
  34/34 semantics, 154/154 compile.

## Round 9: numeric ids, real soul containment, Pink's dates

**An instance used as a NUMBER is its id.** `proto.valueOf` now returns `id`, because
GML's collision and instance functions all hand back ids and the game then does
arithmetic on them. Without it, the game's own idioms silently inverted:
`if (_h >= 0)` was false even on a hit (`{} >= 0` is false), and
`until (_h < 0)` could never become true. That is the whole reason **Pink's singing
attack froze the tab**: `obj_pink_battlemovement` eats audience notes with
`do { _getheart = collision_circle(...); ... } until (_getheart < 0)`, spinning forever
and allocating an `obj_dokiheart` every iteration. `noone` stays the literal `-4`, so
`>= 0` and `!= -4` now agree with it. It also fixes `if (instance_place(...))`
everywhere, which `$R.b()` had been reading as NaN → false.

**Compiled `while` / `do…until` carry an iteration guard** (`$R.spin`, 500k, warns once
naming the object and event). Deltarune has loops whose termination depends on state a
port can get wrong — and one, the curtains' free-audience-seat search
(`until (ds_list_find_index(l_audience_showup, _dice) < 0)`), can exhaust its 25-slot
ring in the *original*. A guard turns a dead tab into a log line.

**The SOUL is contained the way `obj_heart` really does it** — `place_meeting(x + px,
y + py, obj_battlesolid)` per axis, then the VIEW bounds (`x` in `[0, 640 -
sprite_width]`, `y` in `[0, 320 - sprite_height + boundaryup]`) — not a clamp to
`scr_get_box`'s rectangle. This matters because `spr_battlebg_0` frame 0 is a **hollow
white frame** (10% opaque, transparent centre; frame 1 is the black fill), so the heart
is bounded by the actual drawn border. Consequences that a rectangle clamp could never
produce: rotated and custom-built boxes bound correctly, and when an attack **destroys**
the box there is nothing left to collide with, so the heart roams the whole screen —
Jevil's BYE BYE finale (type 77) destroys `obj_battlesolid` at `realtimer == 10` *and*
sets `boundaryup = 160`, which is exactly "the entire screen becomes the battlebox".
Verified: box kept → heart held to 248–374 × 98–224 inside the 150×150 box; box gone →
0,0 to 624,464.

Masks are decoded lazily from PNGs, and for a hollow frame a not-yet-decoded mask is
catastrophic in **both** directions: fall back to the bounding rectangle and the heart
is "inside a solid" at spawn and pinned there; ignore the wall and it escapes, after
which the frame locks it out. So containment is graded — rectangle clamp while the art
decodes, per-pixel walls once ready — plus a hard backstop that keeps the heart within
the union of the solids' bounds whenever any box exists. That backstop is also what
holds the Knight's 0.5× slit, whose box is a runtime-built custom sprite whose mask
doesn't line up with how it draws (a known remaining gap).

**The synthetic green box overlay is gone.** The box draws itself (real
`obj_growtangle`), and a second axis-aligned rectangle stroked from `scr_get_box` could
never follow a rotating or custom box — and kept drawing after an attack destroyed the
real one. `setDebugBox(true)` shows the collision extent in magenta when geometry is in
question.

**Colour constants were wrong.** GameMaker's `c_green` is RGB(0,128,0) — `#00ff00` is
`c_lime` — and `c_orange` is RGB(255,160,64), not `#ffa500`. The box's own
`image_blend = merge_color(c_green, c_lime, 0.5)` should therefore be RGB(0,191,0);
sampling the wiki's Jevil attack GIFs confirms a hollow border at ≈(0,191,0). (Wiki used
for VISUAL ground truth only — never mechanics.)

**Pink's DATING MINIGAME is a turn REPLACEMENT, not a bullet attack**, which is why
scanning for `monsterattackname` never found it: her dispatcher does `datecount++` and
creates `obj_date_controller`, which reads `obj_pink_enemy.datecount` in its own Create
to choose the date. All four dates are now roster entries (`pink_date1..4`, launch
`pink-date`) — set `datecount` on Pink *before* creating the controller. A date has no
battle box at all (her `mnfight == 1.5` prep skips it and the date draws on its own
full-screen surfaces), so the box replay is skipped and the studio's soul overlay hides
while a date is running without `obj_purplecontrols`. Her tenth bullet attack,
**type 210 "pink final attack"** (the purple mode-8 node maze), is announced inside
`obj_date_controller`, so `gen_attacks` now also scans declared `extraAttackFiles`
(selector and setup-replay suppressed there — a helper's local branch conditions are not
the boss's state). Pink: 9 → 14 attacks; roster 142 → 147.

## Round 10: capability coverage, not bug-by-bug

The brief was explicit: make the translator *better at reading things* rather than fix
individual attacks. So this round starts from a measurement, not a bug list.

**`scripts/audit_natives.js`** scans every function call in the corpus, subtracts
everything the engine can resolve (JS natives, GlobalScripts it compiles from source,
object methods), and ranks what is left by call count. `--loaded` scores only the GML we
actually ship and can execute, which is the set that can break a running attack. That
number is now the health metric: **98.6% → 99.3% of call sites**, 79 functions covering
3,548 call sites implemented this round. Re-run it after any extraction change; anything
near the top of its list is a missing capability, not an attack-specific bug.

Implemented as general engine features:
- **Room layers** — the largest cluster by far (~850 calls, `layer_set_visible` alone
  363). Rooms aren't in the export, so there is no authored layer data; but the calls
  must still be coherent, because the game reads back what it writes. Layers are a real
  registry created on demand by name, with working visibility/depth/x/y/speed. Returning
  -1 for an unknown name would be the wrong lie: in the real game those layers exist.
- **Surfaces** — `draw_surface_part` (the reported unknown function), plus
  `draw_surface`, `_stretched_ext`, `_tiled`, `_general`, all routed through one
  implementation that CLAMPS the source rect the way GameMaker does, carrying the clamp
  offset to the destination. Canvas throws on an out-of-bounds source rect, so one
  offscreen pixel could blank a whole panel.
- **`event_perform`** — was user-events-only, so every other call silently did nothing.
  Deltarune uses `event_perform(ev_draw, ev_draw_normal)` to hand-draw objects it marks
  invisible; an invisible object whose Draw never runs is simply absent. Now a full
  (type, number) → method dispatcher, with the whole `ev_*` constant family added — they
  had been compiling to undefined instance variables.
- **`sprite_xoffset` / `sprite_yoffset`** — GameMaker's origin SCALED by image_x/yscale.
  Unimplemented, they were hoisted as ordinary variables and zeroed. This is the real
  root cause of the custom-box problem: `obj_growtangle` paints the stretch sprite into
  its surface *at* those offsets and registers the baked sprite *with* them as its
  origin, so at 0 the art landed with its centre on the surface's top-left corner.
- **Blend factors** — `bm_src_colour` and `bm_src_alpha` were both `2` across two files,
  so a `(bm_zero, bm_src_colour)` multiply was composited as `destination-in`. Now
  GameMaker's real values in one place, with the factor-pair map keyed on them.
- **`gpu_set_fog`** — the Roaring Knight's "shader" effects are not shaders at all; the
  attack contains zero `shader_set` calls. They are the fixed-function fog/colourise
  stage (also reached through `scr_draw_outline`), which the engine no-opped. Fog now
  replaces RGB and keeps alpha through the single `drawTinted` funnel, so every fogged
  draw in the game is fixed at once.
- **`gpu_set_texfilter`** as real state (default off, as `obj_initializer2` sets it),
  plus audio track position, list-returning collisions (`*_list`), `ds_map_set`, ini and
  text-file stores, `asset_get_index`, `draw_get_font`, gamepad/navigation stubs.

**Pixel art is nearest-neighbour everywhere.** Canvas defaults `imageSmoothingEnabled`
to true, so every scaled draw was bilinear-filtered — worse through intermediate buffers
(tints, silhouettes, surfaces), which resample twice. Patching call sites is how you
miss one, so the default is set at its source: `getContext('2d')` is wrapped to apply
the current texture-filter state. This also survives `canvas.width = n`, which resets
2D state and silently re-enables smoothing.

**Purple soul, horizontal movement.** `obj_purplecontrols` moves the soul sideways with
`x_ongrid = min(x_ongrid + wspeed, 63)`, reading `wspeed` off `obj_heart`. The studio
fabricated the soul as a bare instance, so `wspeed` was never defined, the proxy answered
the read with a zero-valued auto-array, and the step became a no-op — vertical worked
only because its lane distances are literals. The soul is now built from the REAL
`obj_heart` class with its Create run, which is both the fix and one less piece of host
scaffolding.

**Two ordering rules the host had wrong**, both general:
- The boss's box-setup block is part of the BOSS'S TURN, so it is replayed only for
  attacks the boss itself dispatches. Pink's block creates `obj_purplecontrols`, whose
  one-time `made` latch then fired under its default mode — so when the type-210 finale
  later set `mode = 8`, the node-maze builder was already spent and the maze never
  appeared. With the rule applied it builds 9 nodes + 3 act buttons.
- A dispatcher that pins a literal (`dc.difficulty = 0`) means that value IS the attack;
  the UI difficulty is forwarded only where the boss passes its own through. Pink's
  finale pins 0 because `obj_pinknodeact` ramps it 0→4 as the player clears nodes.

**Correction to round 9.** The recorded gap "custom box sprites have a mask that doesn't
match their draw" was **wrong**. `obj_growtangle` carries an explicit editor mask of
`spr_battlebg_0`, so the mask never was the dynamic sprite; measured against the live
canvas the slit box's walls sit exactly on its drawn borders. The real defect was
cold-start timing — masks are decoded lazily, and until they exist a hollow frame reads
as a solid rectangle. Instances now begin decoding their art at spawn (`warmSprite`).

## Round 11: the lexer bug, and attacks that end

**A one-line lexer ordering bug was blanking 229 files.** `#RRGGBB` colour literals were
tested for AFTER preprocessor directives, and the directive guard was "`#` followed by a
letter" — which also describes every colour whose first hex digit is a letter (`#EE5577`).
`lexDirective()` swallowed the rest of the line and the enclosing event failed to parse.
`obj_purplecontrols_Draw_0.gml:316` is `draw_set_color(#EE5577);`, so its entire 536-line
Draw compiled to an empty method — and that Draw is the ONLY thing that paints the
rotating box, the 3D tunnel and the node maze. It also killed `obj_pink_enemy`'s own Step
and `obj_dokiheart`'s Draw. Testing the colour first is safe: no directive name is 6 or 8
hex characters. **All 36,847 GML files in the corpus now parse, 0 failures.**

**Compile failures are now LOUD.** A failed event became `/* COMPILE ERROR */` inside a
try that never throws, so at runtime a dead Draw was indistinguishable from an object that
legitimately draws nothing — which is how the above hid while every sweep reported "0
errors". Failures now `console.error` and are listed on the class as `$gmlDeadEvents`.

**Attacks end again.** Exactly one thing in Deltarune measures a turn:
`obj_battlecontroller`'s Step does `global.turntimer -= 1` while `global.mnfight == 2`,
and at zero runs a fixed teardown (destroy `obj_bulletparent` and `obj_bulletgenparent`,
`obj_darkener.darken = 0`, heart → `obj_returnheart`, `alarm[2] = 15` → `scr_mnendturn`).
That block is byte-identical across all five chapters. Three things were wrong:
- `obj_battlecontroller` and `obj_darkener` were in the extractor's SKIP list as "system
  objects", so the countdown owner did not exist in the engine at all.
- The studio pinned `turntimer = 9999`. Worse than it looks: `scr_turntimer(n)` is a
  MAX-CLAMP, so a 9999 floor silently neutralised every `scr_turntimer` call in the game,
  and attacks that phase on thresholds (`if (global.turntimer < 500)`) froze in stage one.
- `global.mnfight` was never set, so the countdown gate was always closed. It must be set
  AFTER the battle context is built — `obj_battlecontroller`'s Create resets it to 0.
The real object now owns the clock; the host only closes the box when no `obj_darkener`
exists. Verified: 67/67 attacks with a running clock, bullets cleared at zero.

**Draw Begin / Draw End / CleanUp were never EXTRACTED.** `gen_objects.js` mapped only
Draw_0, so 42 objects lost draw code (Draw_72/73 are Begin/End) — the runtime's drawEnd
pass and `eventPerform`'s 72/73 cases were dead code with nothing to dispatch. Now
extracted (13 draw_begin, 31 draw_end, 349 cleanup keys), and Draw Begin runs as its own
full pass over the depth-sorted list, as GameMaker does.

Other general fixes: `draw_set_color` now sets strokeStyle too (every OUTLINE — the tunnel
rings, maze lines, lane grid — stroked default black); real draw colour/alpha state with
`draw_get_*`; the missing shape natives (`draw_triangle`/`ellipse`/`point`/`roundrect`/
`healthbar`); `draw_primitive_end` respects the primitive KIND instead of closing every
vertex list into one polygon (a 4-vertex trianglestrip was rendering as a bow-tie);
surface draws honour their colour argument (Deltarune's outline idiom is blitting the same
surface tinted black); `subimg = -1` means "the caller's image_index", not frame 1;
`view_wport`/`view_hport` exist (absent, the proxy returned 0 and Pink's date backdrop
tiled entirely offscreen); `event_perform(ev_step, …)` dispatched to the wrong method names.

**The party is no longer drawn.** Kris/Susie/Ralsei still EXIST — `scr_moveheart` reads
`obj_herokris.x`, and attacks aim at party members — but this studio shows one attack, not
a battle, so they are `visible = false` rather than competing for depth.

**Gerson's second, wrong-looking boss was ours.** The studio's boss table co-spawned
`obj_sound_of_justice_enemy` on the assumption it belonged to this fight. It is a separate
encounter (the black "Sound of Justice" statue): its Create spawns
`obj_gerson_darkness_overlay` — the black screen — and its Draw continuously spawns
`obj_church_old_man_ripple_effect` drawn as `spr_gerson_battle_overworld` — the "evil
ripple Gerson". Its mere existence also corrupts the real fight, because `scr_spearshot`
and several Gerson objects branch on `i_ex(obj_sound_of_justice_enemy)`.

## Round 12: how to know it actually works

The verification up to here was worthless and it needs saying plainly: "67/67 ran,
0 errors" only proved nothing THREW. It could not see a black screen, a white sheet over
the arena, a missing battle box, an empty maze, or a battle menu drawn on top of every
attack — all of which shipped while the checks reported success. Two things were wrong
with it.

**Step deterministically.** `docs/js/visual_probe.js` drives `runtime.step()`/`draw()` in
a plain loop instead of waiting on `requestAnimationFrame`. rAF throttles to ~2 fps when
the pane is not foreground, so every timing-based check was reading half-initialised
frames and calling them broken — that is how Gerson's green attacks got diagnosed as dead
when the chart machine was healthy. A loop gives the same frame N every run.

**Judge pixels, not instance counts.** Each capture reduces to `inkPct` (how much is not
background), distinct `colours`, `motionPct` (change since the last capture) and
`dominantPct` (share of the most common colour). Those map onto the failures actually
shipped: `BLANK` (Gerson's black screen, the empty maze), `WASH` (the white sheet over
Roaring), `STATIC` (never started), `DEAD_EVENTS` (the `#EE5577` lexer bug), plus
`NO_BOX` / `NO_CLOCK`.

Two traps the probe has to respect, both learned the hard way:
- A finished attack legitimately has no box and no clock. Verdicts are taken from the
  frame with the most ink, and completion is tracked separately, or every short attack
  reads as broken.
- Deterministic stepping outruns image DECODING, and a sprite whose bitmap is not ready
  draws as a placeholder. The probe settles before capturing — the same timing trap that
  made collision masks read a hollow battle box as solid.

`saveBaseline()` / `diffBaseline()` turn this into regression detection: it needs no idea
what correct looks like, only that today differs from a day the output was accepted. That
is the check that catches "this used to work", which is the failure mode this project kept
hitting.

**Numeric asset indices.** The decompiled dump stores some sprites as the raw integer the
compiler assigned (`pinkportrait = 982`, `knight_sprite = 664`). Every draw path bailed on
the non-string, so those draws were silently dropped — all 30 of the dating minigame's
portraits and the Knight's body during the roar. `sprites.tsv` preserves asset order, so
index N is data row N; `scripts/gen_sprite_indices.js` emits the table (23,869 entries,
with anchor assertions so a re-export that reorders fails loudly) and `sprAlias()` resolves
numbers as well as names. Three draw paths were checking `typeof !== 'string'` BEFORE
resolution and had to be fixed to resolve first. `sync_sprites` now also follows numeric
references, which pulled in 506 sprites it had never seen (6,312 → 6,818).

**The battle menu on every attack** was `obj_battlecontroller`, added to extraction in
round 11 for the turn clock. Its Step *is* the menu — FIGHT/ACT/ITEM, the two purple
lines, the cursor SFX — plus the turn machine that re-picks each enemy's attack, which
also fought the roster's choice and moved the box. It now exists (attacks re-depth against
it) but does not step or draw; `tickTurnTimer` implements that block's semantics instead.

**Roaring's frame rate.** Two real costs: tiled draws were a nested `drawImage` loop, now
a cached `createPattern` fill (17.8 ms → 2.76 ms); and its Draw shears a full-screen
surface ONE SCANLINE AT A TIME — 480 tinted `draw_surface_part_ext` calls per frame, all
with the same colour — so the tint buffer is now built once per frame, keyed on
surface + colour + frame stamp.

## Round 13: the engine diagnoses itself

The remaining bottleneck was the ORACLE — someone had to say "this attack looks wrong",
and that someone was Landon, one attack at a time. `docs/js/flight_recorder.js` removes
most of that, on one observation:

> **The GML is the spec.** For any attack the source states exactly which sprites get
> drawn and which objects get spawned, so most bugs can be found by diffing what the code
> PROMISES against what the engine DID — no reference image, no human.

Per attack it records: natives that fell through to the not-implemented stub, events that
threw, sprites requested with no art, draws at NaN/wildly-offscreen coordinates, and a
draw/spawn census. Then `recordAll()` ranks by evidence and — the useful part — tallies
**which missing capability affects the most attacks**, so the fix list is ordered by blast
radius instead of by who complained.

Its first run over 147 attacks produced this, entirely unprompted:

| Missing native | Attacks | What it broke |
|---|---|---|
| `sprite_set_offset` | **69** | sets sprite ORIGINS at runtime — the "positionally off" reports |
| `string_format` | 14 | number→text |
| `keyboard_check_released` | 11 | input |
| `draw_text_ext_transformed` | 4 | **all dating-minigame dialogue** |

All are now implemented, along with the `draw_text_ext*` family (line breaks + word
wrapping — the plain aliases collapsed wrapped blocks onto one line), real `string_width`/
`string_height` via canvas metrics (Deltarune SIZES layout from these: each date choice box
scales by `50 / string_width(text)`, so a `length * 8` guess mis-scaled every line), the
`variable_struct_*` family, and `ds_list_sort`/`insert`/`shuffle`. Verified: date dialogue
now draws (`draw_text_ext_transformed "Wh"` — the typewriter mid-reveal — plus the DOKI
meter), and both sampled attacks report zero missing natives.

One caveat worth keeping: warnings dedupe for the whole session, which is right for a human
reading the console but wrong for per-attack attribution — a missing native would be blamed
only on the FIRST attack that hit it. `GML_CLEAR_WARNINGS()` resets between attacks.

Still open from this round: `obj_afterimage` spawns at runaway negative x (−6430 … −36900)
during Gerson's green charts — a numeric positional bug the recorder found without a
screenshot, cause not yet established.

## Round 14: the soul anchor, and turn lengths

**THE SOUL IS TOP-LEFT ANCHORED.** `spr_heart`, `spr_greenheart` and
`spr_dodgeheartmask` all have origin (0,0) — which is why the entire corpus writes
`obj_heart.x + 10, obj_heart.y + 10` when it means "the centre of the soul", and why
`scr_heartclamp` subtracts a literal 20 from the right and bottom edges. The studio
stored and DREW the soul as a centre, so:

- everything anchored on the soul sat +10,+10 off. `obj_spearblocker` sets
  `x = obj_heart.x + 10`, and every spear is placed as
  `obj_spearblocker.x + lengthdir_x(...)` — so Gerson's axe, its 30px radius and the
  entire spear ring were displaced as one. That is the whole "positionally off" report.
- the drawn sprite disagreed with our OWN collision mask by half a heart, in every
  attack, because `maskGeom` honours the origin correctly.

Fixed at the three places that assume a centre: the overlay draws at
`(x - originX, y - originY)`, and seeding/NaN-recovery go through `centreSoulOn(cx, cy)`,
which derives the offset from the soul's mask sprite rather than hard-coding 10 (so a
small-heart attack works too). Verified: shield lands exactly on the box centre
(320,240 — was 330,250) and `soul + 10` is the box centre.

**Turn lengths live outside the dispatcher.** The Knight sets each attack's duration in a
SEPARATE `if (myattackchoice == N) scr_turntimer(...)` ladder that runs after the
dispatcher branch, so slicing the `monsterattackname` branch never captured it and every
Knight attack fell back to the studio's 90-frame floor. For Stars that was fatal, not just
short: type 98 does `global.turntimer += 30` and then
`if (global.turntimer <= endtimer + 1) init = 3` — 90+30 = 120 against `endtimer` 120, so
it tripped its own terminate check on frame ONE and never spawned a star, and the cone's
scrolling-background phase (`con == 2`) ran for exactly zero frames. `gen_attacks` now
extracts the ladder as `GML_ATTACKS_TURNSETUP` and the studio replays it like the box
block. Verified: 6 star objects spawning, turntimer 270 → 70 over 200 frames.

**Two more general faults found the same way:**
- Only `os_windows` was defined, so `os_type == os_ps4` compared undefined to undefined
  and came out TRUE — the corpus took its PlayStation branch and added a +1px offset to
  every `d_*` shape call (104 `d_circle` + 33 `d_line` sites in ch4 alone). All the OS
  constants are now distinct.
- The `d_*` device-pixel shape wrappers (`d_rectangle_color`, `d_line_width_color`,
  `d_circle_color`, …) resolved to nothing at all and silently returned 0. They are how
  Deltarune draws most of its UI — including the dating minigame's answer boxes and the
  purple node graph, which is why those never appeared regardless of font work.

**Fonts are absent from the export entirely** — no `fonts.tsv` in any REFDATA chapter and
no font directory in any EXPORT chapter, so `fnt_main`/`fnt_mainbig`/etc. have no glyph
data anywhere. A headless replay proved the date's text path is fully reached (1,971
`fillText` calls, correct strings, correct typewriter), so the dialogue is DRAWN — it just
paints a near-black fill (`merge_color(c_black, c_gray, 0.1)` = rgb 13,13,13) whose only
legibility comes from eight white copies offset ±2px. With Deltarune's chunky bitmap face
that ring is a solid outline; with thin 16px monospace it collapses into the glyph. The
remaining work is a font stack with Deltarune's metrics (main: 8px advance/18px line;
mainbig: 16px/36px — read from `scr_texttype`'s `scr_textsetup` calls), plus sprite-strip
fonts for the digits, which are the only glyphs that DID export.

### Current state, measured

Full deterministic visual sweep: **145 of 147 attacks clean**, baseline saved for 146.
The two flags are both `NO_BOX` on attacks that destroy their own battle box on purpose —
Jevil's BYE BYE (`with (obj_battlesolid) instance_destroy()` at realtimer 10) and Pink's
type-210 finale (`with (obj_growtangle) instance_destroy()`). Both were confirmed correct
by eye. If a third appears, check whether the attack legitimately removes the box before
treating it as a bug.

Node battery: 34/34 semantics, 154/154 compile, **36,847/36,847 corpus GML files parse**,
99.27% native call-site coverage.

## Checking GameMaker semantics

For anything inherent to GameMaker rather than Deltarune, read the manual instead of
inferring from usage: <https://manual.gamemaker.io/lts/en/>. `WebFetch` returns 403 —
open pages in a browser. Many pages are collapsed accordions whose text is in the DOM
but hidden, so read `document.body.textContent`, not `innerText`.

It settled these, two of which were bugs:

- **Event order** (`Object_Properties/Event_Order.htm`): Begin Step → Timelines/Time
  Sources/**Alarms** → Step → instances moved by hspeed/vspeed → collisions → End Step →
  Draw, as phases over all instances. Confirms the phase model here, and that the
  original runtime ticking alarms after Step was wrong. Instance order within one event
  is explicitly not guaranteed; highest depth draws first.
- **Truthiness** (`GML_Overview/Data_Types.htm`, Boolean): a real "equal to or below 0.5"
  is false, "greater than 0.5" is true — not `!= 0`.
- **`div`** (`GML_Overview/Expressions_And_Operators.htm`): "first converts its
  **operands** into integers, then performs integer division". `3.9 div 1.5` is
  `3 div 1` = 3, not `trunc(3.9/1.5)` = 2. **This was a bug** — the corpus does
  `sprite_width div _tilesize` with a scaled, fractional `sprite_width`.
- **Alarms with no handler** (`Object_Events.htm`): "an alarm with no actions or code in
  it will not count down", so an empty slot must not expire. **Also a bug.**
- **Operator precedence is not portable.** The manual lists operator *categories*, not a
  precedence table, and says compilers may differ; brackets are the only guarantee. The
  table in `gml_compiler.js` is therefore a choice — safe here because the corpus never
  mixes bitwise with comparison unbracketed.

## Round 15: a spec oracle, and the trim gap measured

The previous oracles are **saturated**, and that is the finding that shapes this
round. A full flight-recorder pass over all 147 attacks reports **zero missing
natives, zero missing art, zero events that threw**, and the visual probe calls
143/147 clean — the four flags being Jevil's BYE BYE and Pink's type-210 (both
destroy their own box on purpose) and the two dates, which paint a full-screen
backdrop by design and are now exempt from `WASH`.

So nothing that asks *"is something there?"* can find what is left. What remains
is *"is it the RIGHT thing?"* — a bullet at the wrong x, a wave every 20 frames
instead of 30, five stars instead of six.

**`docs/js/spec_check.js`** is the oracle for that, and it works because the
source states those numbers exactly. A spec is a transcription, not an opinion:
each assertion carries the `file.gml:line` it came from, so a failure can be
argued with. Kinds: `spawns` / `absent` / `count` / `pos` / `ivar` / `sprite` /
`box` / `turntimer`. Specs live in `docs/js/attack_specs.js`;
`docs/SPEC_AUTHORING_BRIEF.md` is the contract they are written to.

Two traps it hit immediately, both worth keeping:

- **Spawns must be recorded as they happen, not inferred from live instances.**
  The first version unioned the live set at each sampled frame, and
  `obj_knight_warp` — the Knight's teleport flash, whose `event_user(1)` sets
  `alarm[1] = 4` — lives four frames and was invisible between samples. It
  reported as "never created" on an engine that was creating it correctly. That
  is a checker bug that reads exactly like an engine bug, and it would have
  fired on every short-lived VFX object in the roster. `createInstance` is now
  hooked directly.
- **Never assert a position on a moving object.** The crescent generator's y
  measured 164 on one run and 181 on the next, because its `ypos[]` choice is
  random. Spawn positions are asserted at frame 1.

### The trimmed-sprite gap, measured rather than feared

`scripts/audit_trimmed_sprites.js` replaces the estimate that was in this
section with numbers, and the picture is much better than it read — and much
more specific about what is actually wrong.

Of the **21,867 frames the studio ships, 94.2% are already the full declared
frame**; `sync_sprites`' NEW RIP upgrade did most of the work. Only 1,278 remain
trimmed, and the worst of those are rhythm-game, TV-prize and overworld
transition art the studio never draws.

But the residual is not uniformly harmless, because of **how** trimmed art is
placed. `gml_asset_db.drawSprite` ends in `ctx.drawImage(img, -ox, -oy)`: the
trimmed bitmap's top-left is anchored on the FULL-frame origin. For a sprite
whose origin is the frame centre that is wrong by half the trim.
`spr_donut_bullet` is declared 48×50 with origin (24,25) and ships as a
complete 24×25 donut, so it renders a full half-sprite up and left of where the
game puts it. **277 shipped frames have a centre origin and are trimmed.**

Two things to know before fixing it:
- `maskGeom` uses the same declared origin, so draw and collision currently
  AGREE with each other while both being offset. Centring the draw alone would
  desynchronise them — both paths have to change together.
- Some trims are recoverable exactly and are simply being rejected. NEW RIP has
  `spr_gerson_swing_down_telegraph_0` at 80×360 — the full declared *height* —
  where the export is 315, but `sync_sprites` requires BOTH dimensions to match
  the declared frame, so it keeps the export and Gerson's swing telegraph is
  45px short (12.5%) on the axis the player reads to dodge.

## Known gaps

1. **The PNG export is trimmed per frame and the crop offset isn't recorded.**
   Now measured (see Round 15): 1,278 of 21,867 shipped frames, 94.2% already
   exact. The part that actually misplaces art is the **277 centre-origin**
   frames, which `drawImage(img, -ox, -oy)` anchors top-left instead of centred.
   Fixing needs `drawSprite` and `maskGeom` changed together so collision keeps
   agreeing with the art. Re-run `node scripts/audit_trimmed_sprites.js` for the
   current list; it also reports which trims NEW RIP or another chapter could
   fix exactly (276 sprites are recoverable from neither and need a re-export).
2. **Pruned payloads.** `gen_scripts.js` skips non-mechanics scripts (`scr_text` alone is
   616 KB of dialogue); `gen_objects.js` caps incidental objects at 24 KB and the
   reference walk at 2 hops, but **never** caps the attack controllers or boss objects.
   Both log exactly what they dropped, and pruned names still resolve via `$R.miss`.
3. **ASSET path resources** (`path_sneo_head_path1`) are absent from the export dumps —
   runtime-built paths work fully, asset paths warn once naming the path. Needs a path
   export to be exact. (Asset-name reassignment and surfaces, formerly listed here, are
   real now — rounds 7 and 2.)
4. **Runtime-built custom box sprites have a mask that doesn't match how they draw.**
   When `maxxscale != 2` the growtangle rebuilds its sprite through a surface
   (`sprite_create_from_surface`, rounded to n/37.5); the resulting dynamic sprite draws
   correctly but its pixel mask doesn't line up, so per-pixel soul containment can't be
   trusted there (the Knight's 0.5× slit). The union-bounds backstop in `moveSoul`
   holds the heart in the box meanwhile, so it degrades to a rectangle rather than
   breaking — but rotating a custom-size box would be loose.
5. **The battle system around the attacks is minimal.** The studio fakes just enough
   context (box, soul, party, boss with `myself`/`difficulty` set, `global.turntimer`)
   for attacks to run — plus, since round 8, each boss's real box block and each
   attack's real dispatcher branch. Attacks that read deeper battle state — mercy,
   turn phases, HP — will behave as if those are at defaults.
