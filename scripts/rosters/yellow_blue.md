# Yellow & Blue (ch5) — the REAL roster

**Encounter 222.** `gml_GlobalScript_scr_encountersetup.gml:839-850` puts
`obj_blue_enemy` in monster slot 0 (monstertype 115) and `obj_yellow_enemy` in
slot 1 (monstertype 116). It is launched from
`gml_Object_obj_ch5_DWCL03_Step_0.gml:527` — `scr_battle(222, 3, bluecopy, yellowcopy)`.
Both enemies are 2060 HP / AT 16 / DF 0 / 450 gold / sparepoint 0 / mercymax 100
(`gml_GlobalScript_scr_monstersetup.gml:455-480`). `end_trial()` gates on
`global.encounterno == 222` (`gml_Object_obj_yellow_trial_manager_Create_0.gml:646`),
which independently confirms the encounter number.

**Summary: 4 dispatcher branches, 4 real. Nothing in Blue's dispatcher is cut.**
The cut content in this fight lives one level down — two orphaned
`obj_dbulletcontroller` branches, and three pinned sub-modes inside attacks that
DO play.

---

## Blue is the only attacker

Yellow never announces a `monsterattackname` in any of its seven event files.
The turn is decided by attack priority:

| enemy | enemytalk sets | mnfight 1.5 requests |
|---|---|---|
| `obj_yellow_enemy` | `myattackpriority = 0` (`Step_0:8`), calls `scr_attackpriority(-1)` | `scr_attackpriority(0)` (`Step_0:100`) |
| `obj_blue_enemy` | `myattackpriority = 1` (`Step_0:52`), calls `scr_attackpriority(0)` | `scr_attackpriority(1)` (`Step_0:104`) |

`gml_GlobalScript_scr_attackpriority.gml` only returns true when the
battlecontroller's stored value is strictly less than the argument, and the
value is seeded to `-1` in `obj_battlecontroller_Create_0.gml:30` and reset to
`-1` every turn (`scr_endturn.gml:114`, `scr_mnendturn.gml:28`). So each turn
Blue raises it to 0 during enemytalk, then wins the 1.5 check with 1 while
Yellow's `scr_attackpriority(0)` fails. **Yellow's box branch
(`obj_yellow_enemy_Step_0.gml:98-111`) is unreachable while Blue is alive**, and
if it ever did run it would open a plain centered box with `scr_turntimer(90)`
and no bullets at all — its `rtimer == 12` branch (lines 113-162) writes only a
battle message.

So: `enemy = obj_blue_enemy`, `extraEnemies = [obj_yellow_enemy]`.

## The chooser is one line

```gml
// gml_Object_obj_blue_enemy_Other_11.gml:1  (event_user(1))
myattackchoice = turns % 4;
```

Called from `gml_Object_obj_blue_enemy_Step_0.gml:51` (`event_user(1);`) in the
`scr_isphase("enemytalk") && talked == 0` block — i.e. before every Blue turn.
`turns` starts at 0 (`gml_GlobalScript_scr_enemy_object_init.gml:6`) and is
incremented at `Step_0:192`, *after* the attack spawns. There is no other
writer of `myattackchoice` for this object anywhere in Chapter 5 (`Create_0:10`
sets the initial `-1`, which is overwritten before the first turn).

Result — a strict round robin, no randomness, no HP gate, no phase ladder:

```
turn 1: turns 0 -> choice 0  GuidedBullet     (type 301, turntimer 300)
turn 2: turns 1 -> choice 1  Dancers          (type 302, turntimer 270)
turn 3: turns 2 -> choice 2  ShootingGallery  (type 303, turntimer 225)
turn 4: turns 3 -> choice 3  BlueSinging      (type 304, turntimer 300)
turn 5: back to choice 0, forever
```

Because every value of `turns % 4` occurs, **the chooser does not reduce the
dispatcher at all** — this is the first of the six fights where dispatcher and
real roster coincide.

## The dispatcher

`gml_Object_obj_blue_enemy_Step_0.gml:154-195`, guarded by
`rtimer == 12 && i_ex(obj_yellow_enemy) && obj_yellow_enemy.healingraincon == 0`:

| choice | lines | name | `dc.type` | `scr_turntimer` | controller branch | spawns |
|---|---|---|---|---|---|---|
| 0 | 160-166 | `GuidedBullet` | 301 | 300 | `obj_dbulletcontroller_Step_0.gml:3376-3385` | `obj_blue_guidelines` at `camerax()+434, cameray()+181`, grazepoints 12 |
| 1 | 168-174 | `Dancers` | 302 | 270 | `:3387-3397` | `obj_enemy_blue_boxspin` at Blue, **`d.mode = 1`**, grazepoints 8 |
| 2 | 176-182 | `ShootingGallery` | 303 | 225 | `:3399-3407` | `obj_enemy_blue_flower_aim` at Blue |
| 3 | 184-190 | `BlueSinging` | 304 | 300 | `:3409-3425` | `obj_blue_singing2` at Blue, lerped to `camerax()+436 / cameray()+90`, grazepoints 6 |

`grep -rn "dc.type = 30[0-9]"` over Chapter 5 shows 301-304 are written **only**
by these four lines; the neighbouring controller types 300 and 305-314 belong to
Aqua, Netskie, Purple, Orange/Green, Seth and Thrash.

## What each attack actually does

- **301 GuidedBullet.** `obj_blue_guidelines` snakes a chain of
  `obj_blue_guideline` segments toward the soul — one new segment every 3 frames
  (or whenever fewer than 4 exist), each easing up to 35 degrees toward
  `obj_heart` (`obj_blue_guidelines_Step_0.gml:3-32`). Every
  `12 - difficulty * 3`th segment becomes a `spr_enemy_blue_flower_reticle`
  node. At `timer == 32` a single `obj_yellow_guided_bullet` is fired from
  `camerax()+438, cameray()+181` and rides the trail, consuming segments and
  detonating an 8-way petal burst at each reticle node
  (`obj_yellow_guided_bullet_Step_0.gml:5-53`). The attack has no self-terminate;
  it just runs out the 300-frame turn. Its Create writes
  `obj_growtangle.image_xscale/image_yscale = 2.5` **directly**, bypassing the
  maxxscale grow animation (`obj_blue_guidelines_Create_0.gml:4-8`).
- **302 Dancers.** Blue's dancing body (`obj_enemy_blue_boxspin`) hops around
  the box while two interleaved rows of 8 `obj_attack_blue_dancer_bullet`
  (tagged `type = 0` and `type = 1`) sweep across from a random side
  (`Step_0:41-72`), with `Alarm_3` adding a fresh pair every 40 frames and
  `Step_0:83-97` alarming one whole tag group at a distance-scaled delay. The box itself wobbles on a sine and drags the soul and the
  bullets with it (`Step_2.gml:11-29`). Loops the `timer 42..106` segment three
  times (`Step_0:99-103`), then flies home at `global.turntimer <= 30`.
- **303 ShootingGallery.** Blue glides to the box edge and plants
  `obj_blue_flower_reticle` targets in threes; Yellow shoots them
  (`obj_enemy_blue_flower_aim_Alarm_0`) with an `obj_yellow_beam` chained from
  the previous target, each hit exploding into 8 petals. Three volleys, from
  the right, then `scr_get_box(0)+16`, then `scr_get_box(2)-116`
  (`Step_0:345-413`). Ends at `global.turntimer <= 20`.
- **304 BlueSinging.** Blue floats at the right edge singing; three sine
  waveforms are drawn across the box (`Draw_0`, 3 x 112 line segments per
  frame) and `spr_blue_note` bullets ride them
  (`Step_0:40-71`). Every 28 frames a triple of notes spawns; on every second
  volley one lane's note becomes a spinning reticle that detonates into petals
  via `scr_blue_petal_explosion` (`Step_0:81-208`). Ends at
  `global.turntimer <= 30`.

## Cut content

### Dispatcher-level (2)

| type | lines | spawns | why it can never be chosen |
|---|---|---|---|
| 129 | `obj_dbulletcontroller_Step_0.gml:1568-1576` | `obj_attack_blue_ponddancing`, `d.type = 2` | No code in Chapter 5 ever assigns 129 to a controller — `grep -rn "type = 129"` returns nothing. The only writers of a controller type in this fight are `obj_blue_enemy_Step_0.gml:164/172/180/188`. |
| 130 | `:1578-1586` | `obj_attack_blue_ponddancing`, `d.type = 1` | Same: no writer for 130 anywhere. |

`obj_attack_blue_ponddancing` has **no parent** in `objects.tsv` (the three real
Blue attack objects are all `obj_bulletparent` children), and its Draw event
(`gml_Object_obj_attack_blue_ponddancing_Draw_0.gml:125`) reaches for
`obj_attack_yellow_reticle` and `obj_enemy_yellow_example` — the prototype
cluster. Same status as Jevil's `jattack` 99 / 999: a dispatcher branch with no
writer.

### The `*_example` objects — confirmed dev templates, excluded

- `obj_enemy_blue_example` is referenced by **nothing**; its
  `Create_0.gml:8` does `instance_create(320, 170, obj_growtangle)` at hardcoded
  room coordinates with no battle context. Testbed.
- `obj_enemy_yellow_example` is referenced only from
  `obj_attack_yellow_reticle_Step_0.gml` and the two other template objects'
  Draw events. Its Create hardcodes `x = 434; y = 206;`.
- `obj_enemy_blue_attack` is referenced only from
  `obj_enemy_blue_example_Draw_0.gml` and `obj_attack_blue_ponddancing_Draw_0.gml`.
  It is the sole creator of `obj_attack_blue_flowerbullet`
  (`obj_enemy_blue_attack_Step_0.gml:48`).
- None of the three has a parent in `objects.tsv`; none is created by any
  `instance_create` in the chapter; none appears in a `RoomCC` file.

The similarly-named `obj_enemy_blue_boxspin` and `obj_enemy_blue_flower_aim`
ARE real (types 302 and 303) — the `enemy_` prefix is not the tell, the parent
and the `instance_create` are.

### Dead sub-modes inside attacks that DO play (3)

These are not roster entries, but they matter for speccing — roughly half the
code in the used attack objects never executes.

1. **`obj_enemy_blue_boxspin` mode 0 — Blue's revolver attack.** The dispatcher
   pins `d.mode = 1` (`obj_dbulletcontroller_Step_0.gml:3392`) and
   `Create_0.gml:27` also defaults to 1; nothing writes 0. So
   `Step_0:33-37` (`alarm[0] = 96`), the whole spin machine at `Step_0:118-162`,
   `Alarm_1`, `Alarm_2`, `obj_attack_blue_revolver_bullet`, the `mode == 0` arm
   of `Step_2` and the `spr_blue_boxcover` draw in `Draw_0` are all unreachable.
   Yellow's turn dialogue even references it — "Blue's a revolver? Guess I do
   like gun's..." (`obj_yellow_enemy_Step_0.gml:69`) — but the attack never
   plays.
2. **`obj_enemy_blue_flower_aim` spread types 0/1/2.** `Create_0.gml:14` pins
   `spread_type = 3` and no code in the chapter reassigns it, so the three
   alternative reticle layouts (`Step_0:18-70`, `72-158`, `160-344` — 327 of the
   file's 437 lines) never run. Only the 3x3 up/down/up sweep at
   `Step_0:345-414` plays.
3. **`obj_blue_singing2` mode 1.** `Create_0.gml:31` pins `mode = 2`, so the
   "aimed note" arms (`Step_0:87-88, 103-105, 142-144, 181-183, 210-216`) are
   dead. Mode 2 fires on a 28-frame period with `do_spread = choose(0, 2)`.

---

## Turn replacements (no announcement, no controller, no `.type`)

Like Pink's dates, these cannot be found by scanning for `monsterattackname`.

### Healing Rain

`obj_blue_enemy_Step_0.gml:106-107` — at `global.mnfight == 1.5`, **before** the
box is created:

```gml
if (i_ex(obj_yellow_enemy) && global.monsterhp[obj_yellow_enemy.myself] < (global.monstermaxhp[obj_yellow_enemy.myself] * 0.5) && obj_yellow_enemy.healingraincon == 0)
    obj_yellow_enemy.healingraincon = 1;
else if (!instance_exists(obj_growtangle))
    instance_create(...obj_growtangle);
```

When it triggers: no box, no `scr_moveheart` (line 146 is gated on
`healingraincon == 0`), and the dispatcher is skipped because line 158 requires
the same flag — so **`turns` does not increment** (line 192 sits inside that
guard) and the skipped attack simply plays on the following turn.
`obj_yellow_enemy_Step_0.gml:438-462` runs the beat: the battle text
"BLUE cast HEALING RAIN on YELLOW!", `instance_create(obj_blue_enemy.x,
obj_blue_enemy.y, obj_healing_rain)`, `global.turntimer = 999` while the writer
lives, then `global.turntimer = 2`. `obj_healing_rain_Draw_0.gml:43-44` sets
`global.monsterhp[myself] = global.monstermaxhp[myself]` — a full heal. It can
repeat on every turn Yellow is under half HP.

### Yellow bodyguards Blue

`gml_Object_obj_heroparent_Step_0.gml:355-371`: if the player's target is
`obj_blue_enemy.myself`, Yellow is teleported to `blue.x - 60`,
`global.chartarget` is rewritten to Yellow's slot, `global.monsterx/y` are
repointed, and Yellow eats the hit with `hurtsprite = spr_yellow_block` and
`blockcon = 1` (unwound 30 frames later by
`obj_yellow_enemy_Step_0.gml:421-436`). The same interception exists for
Rudebuster (`obj_rudebuster_anim_Step_0.gml:31`). Together with the healing
rain this makes Blue effectively undamageable.

### The courtroom trial — the actual win condition

Yellow's ACT slot 1 is **"Justice"** (`obj_yellow_enemy_Create_0.gml:256-287`),
100 TP, or locked at the sentinel cost `2497.5` when the party is short on
EVIDENCE. Using it runs `obj_yellow_enemy_Step_0.gml:182-242`: the party is
re-sprited into `spr_kris_lawyer` / `spr_susie_lawyer` / `spr_ralsei_lawyer` and
`obj_yellow_trial_manager` is created with an `evidence_list` assembled from
Yellow's `evidence_obtained[0..6]` (seeded from `scr_keyitemcheck(26/21/23/27/28/22/20)`
in `Create_0:42-48`, topped up by `gain_evidence()` at `Create_0:77-224`).

Blue's ACTs feed it: slot 0 **"Evidence"** hands out missing evidence
(`obj_blue_enemy_Step_0.gml:223-272`), slot 1 **"Integrity"** revives downed
party members for half the party's TP (`Step_0:290-406`). Susie's and Ralsei's
`HelpOut` ACTs give 60 TP each (`Step_0:421-518`).

Four trials, `trial_counter` 0..3, defendants Aqua / Seth / Green / Blue /
Yellow as `obj_trial_perp`. A wrong accusation does `fail_counter++` and
`just_failed = true` (`obj_yellow_trial_manager_Create_0.gml:320-322`); a right
one does `trial_counter = scr_approach(trial_counter, 3, 1)` and
`fail_counter = 0` (lines 535-537). Those counters drive the per-turn dialogue
variants (`obj_yellow_enemy_Step_0.gml:16-54`, mirrored by Blue at
`obj_blue_enemy_Step_0.gml:58-96`) and the battle-message hints
(`obj_yellow_enemy_Step_0.gml:136-156`).

Solving trial 4 — culprit **Blue** — runs `right_blue()` and ends the battle
outright:

```gml
// gml_Object_obj_yellow_trial_manager_Create_0.gml:1800-1803
with (obj_battlecontroller)
    skipvictory = 2;

scr_wincombat();
```

So **HP is not the win condition**; the four bullet attacks are pure attrition
between trials. The same manager is reused by the Flowery fight with
`trial_array[99] = trial_flowery` (`obj_flowery_enemy_Step_0.gml:2599`), so the
trial code is not exclusive to this encounter.

---

## Generator config

```jsonc
"enemy": "obj_blue_enemy",
"extraEnemies": ["obj_yellow_enemy"],

"boxBlock": {
  "file": "gml_Object_obj_blue_enemy_Step_0.gml",
  "anchor":    "if (i_ex(obj_yellow_enemy) && global.monsterhp[obj_yellow_enemy.myself] < (global.monstermaxhp[obj_yellow_enemy.myself] * 0.5) && obj_yellow_enemy.healingraincon == 0)",   // :106
  "endAnchor": "if (!instance_exists(obj_moveheart) && obj_yellow_enemy.healingraincon == 0)"                                                                                            // :146
},
"turnBlock": {
  "file": "gml_Object_obj_blue_enemy_Step_0.gml",
  "anchor":    "scr_turntimer(90);",   // :150 — first and only occurrence of this exact call
  "endAnchor": "}"
}
```

**Why the box anchor starts on the healing-rain test.** The box creation is the
`else if` arm of that statement (`Step_0:108-109`). Slicing from the `else if`
alone would emit a syntactically invalid fragment, and letting `ifStatementEnd`
run from it would capture only the single `instance_create` and drop all four
`myattackchoice` sizing blocks. Anchoring on the leading `if` and ending at the
`scr_moveheart` guard yields a self-contained, brace-balanced 1249-character
block: the healing-rain fork, the box creation, and the per-choice sizing —

| choice | box adjustment |
|---|---|
| 0 | `obj_growtangle.x -= 50` and `obj_heart.x -= 50` |
| 1 | `maxxscale = 3.5`, `y += 48` |
| 2 | `x -= 50`, `maxxscale = 3` |
| 3 | `maxxscale = 3` |

In the studio `i_ex(obj_yellow_enemy)` degrades safely to false when no Yellow
stub exists, so the `else if` runs and the box is created as normal.

**Why the turn block is only `scr_turntimer(90);`.** Unlike the Knight or
Spamton NEO, Blue has **no separate turn-length ladder**. The real per-attack
lengths (300 / 270 / 225 / 300) are the last statement inside each dispatcher
branch, so they arrive with each attack's own `setup` slice
(`attackAnnouncements` walks back to the branch's `{`, which includes them).
The only turn statement outside a branch is the base floor at `Step_0:150`.
`scr_turntimer` only raises (`if (global.turntimer < arg0) ...`), so replaying
the 90 alongside a branch's 300 is a no-op in either order — but omitting the
turn block entirely would leave the studio's own floor as the only source, and
declaring it makes the relationship explicit. `extractTurnBlock`'s
"`turntimer` within 80 characters of the anchor" test passes trivially because
the anchor *is* the call; `endAnchor: "}"` clips the slice at the enclosing
brace, verified to produce exactly `scr_turntimer(90);`.

Three of the four attacks read `global.turntimer` to schedule their exit —
`obj_enemy_blue_boxspin_Step_0.gml:105` (`<= 30`),
`obj_enemy_blue_flower_aim_Step_0.gml:416` (`<= 20`),
`obj_blue_singing2_Step_0.gml:24` (`<= 30`) — so at a 90-frame floor all three
would fire their ending routine on frame one, exactly the failure the Knight's
`type 98` notes describe.

No `selectorScan` (this fight uses `monsterattackname`, so the announcement
scan finds all four), no `controllerSet` (the controller needs no flag beyond
`.type`), no `extraAttackFiles` (nothing outside `obj_blue_enemy_Step_0.gml`
announces an attack for this encounter).

## What the studio will need to special-case

1. **A positioned `obj_yellow_enemy` stub.** Attacks 303 and 304 read Yellow's
   coordinates unconditionally and will throw on an unset instance variable
   without one: `obj_enemy_blue_flower_aim_Create_0.gml:12-13`, `Step_0:11-16`,
   `Step_0:420-424`, `Alarm_0:49-50`; `obj_blue_singing2_Step_0.gml:5-9, 26-30`;
   and `scr_blue_petal_explosion.gml:22-26`, which is called from **both**
   attacks for every petal burst. Encountersetup places Yellow at camera +
   (500, 160) and Blue at camera + (466, 40)
   (`scr_encountersetup.gml:842-847`). The stub also needs a `myself` slot and a
   `global.monsterhp` entry so the box block's HP test is well-defined.
2. **A writable `obj_growtangle`.** `obj_blue_guidelines_Create_0.gml:4-8`
   assigns `image_xscale/image_yscale = 2.5` directly rather than through
   `maxxscale`; `obj_enemy_blue_boxspin_Step_0.gml:10-24` lerps
   `image_xscale 3.5 -> 3.6` and `image_yscale 2 -> 1.85`, and
   `Step_2.gml:11-29` drives `obj_growtangle.y` on a sine while dragging
   `obj_heart` and every dancer bullet by the delta. `scr_get_box(0..5)` and
   `scr_afterimagefast` on the box are both required.
3. **Support natives** used across the four attacks: `scr_fire_bullet`,
   `scr_bullet_init`, `scr_bullet_inherit`, `scr_darksize`, `scr_lerpvar`,
   `scr_script_delayed`, `scr_script_repeat`, `scr_var`, `scr_var_delay`,
   `scr_approach`, `scr_ease_towards_direction`, `scr_afterimagefast`,
   `scr_afterimage_grow`, `scr_doom`, `scr_draw_in_box_begin/end`,
   `d3d_set_fog`, `d_line_width_color`, `instance_create_depth`,
   `make_color_rgb`, and the `ds_list_*` family (guidelines, singing and
   flower_aim each keep lists). `obj_yellow_beam` needs its Create-defined
   `setup(x1, y1, x2, y2, ...)` method.
4. **Red soul only.** `scr_moveheart` at `obj_blue_enemy_Step_0.gml:146-147`;
   no green / purple / yellow controller is created anywhere in this fight.
5. **Out of scope for the bullet engine:** the courtroom trial
   (`obj_yellow_trial_manager` — 2790-line Create plus Step/Draw/Alarm,
   `obj_trial_perp`, evidence key items, `obj_balloon_queue` / `msgset_add`
   speech balloons, lawyer battle-sprite swaps) and the healing-rain turn. Both
   are turn REPLACEMENTS with no announcement, no controller and no `.type`, and
   the trial is also the fight's only win condition.
