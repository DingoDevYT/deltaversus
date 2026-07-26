# Flowery (ch5) — the REAL roster, derived from the chooser

**Enemy object.** `objects.tsv` lists 47 objects with "flowery" in the name; exactly **one** has
`obj_monsterparent` as its parent:

| object | parent | role |
|---|---|---|
| `obj_flowery_enemy` | `obj_monsterparent` | **the boss.** monstertype **119**, HP 7000, AT 16, DF 0, mercymax 100 (`scr_monstersetup.gml:581-611`). Encounter **225**, one instance at `xx+500, yy+114` (`scr_encountersetup.gml:872-878`). |
| `obj_flowery_marker` | *(none)* | seven prop instances (Aqua, Seth/purple, Orange, Green, Blue, Yellow, plus the four recruit cameos) created in `obj_flowery_enemy_Create_0.gml:173-235`. No battle code. |
| `obj_orangeheart_floweryjarona` | `obj_orangeheart_hazard` | the "Jarona" bullet-boss — a **bullet**, not an enemy. Created by the box block, not by a controller. |
| `obj_plat_finalflowery` | `obj_plat_entity` | **OMEGA FLOWERY**, the finale boss. A platform-mode entity, not a `obj_monsterparent`. |
| `obj_flowery_bulletcontroller` | `obj_bulletgenparent` | **created by nothing.** The only reference in chapter 5 is a liveness test in `obj_heromover_Step_0.gml:1`. Dead. |

So the battle proper is **`obj_flowery_enemy`** dispatching `obj_dbulletcontroller` with a `.type`,
selected by **`myattackchoice`** — the Knight/Titan shape. What is *not* the Knight shape is the soul:
every turn is played as the **ORANGE SOUL** (`obj_orangeheart` + `obj_debug_orangeheartcontroller`),
an auto-scrolling runner, and the fight ends by leaving the battle engine entirely.

---

## The dispatcher (23 branches)

`obj_flowery_enemy_Step_0.gml:1196-1404`, inside
`if (scr_isphase("bullets") && attacked == 0 && endcon == 0 && healingscenecon == 0 && flowery_blowkiss_scene_con == 0)`
at `rtimer == 12`:

| choice | type | name | turntimer | line |
|---|---|---|---|---|
| 0 | 620 | FloweryDeflect1 | 3200 | 1218-1224 |
| 1 | 621 | FloweryDeflect2 | 3200 | 1226-1232 |
| 2 | 634 | FloweryDeflect3 | 3200 | 1234-1240 |
| 3 | 623 | FloweryWallsTutorial | 320 | 1242-1248 |
| 4 | 624 | FloweryChase | 320 | 1250-1256 |
| 5 | 625 | FloweryChase2 | 320 | 1258-1264 |
| 6 | 626 | FloweryChase2Harder | 320 | 1266-1272 |
| 7 | 627 | FloweryBulletsFistEasy | 320 | 1274-1280 |
| 8 | 628 | FloweryBulletsFistMedium | 320 | 1282-1288 |
| 9 | 629 | FloweryBulletsFistHard | 320 | 1290-1296 |
| 10 | 630 | FloweryBoxesEasy | 320 | 1298-1304 |
| 11 | 631 | FloweryBoxesMedium | 320 | 1306-1312 |
| 12 | 632 | FloweryChase2Random | 320 | 1314-1320 |
| 13 | 633 | FloweryChaseWithBullets | 320 | 1322-1328 |
| 14 | 622 | FloweryDeflect2point5 | 3200 | 1330-1336 |
| 15 | 635 | FloweryChaseBlueYellow | 320 | 1338-1344 |
| 16 | 636 | FloweryDeflectOrange | 3200 | 1346-1352 |
| 17 | 637 | FloweryDashTutorial | 9999999 | 1354-1360 |
| 18 | 638 | JustKidding | 3800 | 1362-1368 |
| 19 | 639 | SuperJarona | 9999 | 1370-1376 |
| 20 | 640 | BlueChase | 380 | 1378-1384 |
| 21 | 641 | AquaKnives | 320 | 1386-1392 |
| 22 | 647 | OrbitStars | 320 | 1394-1400 |

Note the **deliberate scramble**: choice 2 is type 634 and choice 14 is type 622, so anything
downstream must key on `type`, never on `choice`.

There is a **24th announcement**, outside the dispatcher: the intro at `Step_0:512-515` spawns
`type = 637` directly under `if (introtimer == 21)`. Every branch carries a
`global.monsterattackname` line, so `gen_attacks.js`'s scan finds all 24 (verified by running
`attackAnnouncements()` against the file: 24 hits, every one with a controller, a type and a
non-null `setup` slice of 183-266 characters). After dedupe (637 appears twice with the same name
and controller) the generator emits **23** entries — **14 real, 9 cut**.

---

## The chooser

### `obj_flowery_enemy_Other_11.gml` — `event_user(1)`

Called from **`Step_0:584`**, in the `scr_isphase("enemytalk") && talked == 0 && endcon == 0 &&
phasetransition_con == 0 && healingscenecon == 0 && flowery_blowkiss_scene_con == 0` gate, i.e. once
at the top of every enemy turn. It opens with `phaseturn++` (`:1`) and is the **only** non-debug
writer of `myattackchoice`.

```gml
phaseturn++;                                                  // :1

if (phase == 1 || phase == 2)                                 // :3
{
    if (phaseturn == 1) myattackchoice = 3;                   // :7   FloweryWallsTutorial
    if (phaseturn == 2) myattackchoice = 0;                   // :13  FloweryDeflect1
    if (phaseturn == 3) myattackchoice = 4;                   // :19  FloweryChase
    if (phaseturn == 4) myattackchoice = 2;                   // :25  FloweryDeflect3
    if (phaseturn == 5) { myattackchoice = 4;
                          difficulty = chase_attack_difficulty; }  // :31-33
    if (phaseturn == 6) { myattackchoice = 2; phaseturn = 4; }      // :38-39
}

if (phase == 3)                                               // :44
{
    if (phaseturn == 1) myattackchoice = 10;                  // :48  FloweryBoxesEasy
    if (phaseturn == 2) myattackchoice = 21;                  // :54  AquaKnives
    if (phaseturn == 3)
    {
        if (did_sethaqua_attack_without_getting_hurt == true)
            myattackchoice = 11;                              // :62  FloweryBoxesMedium
        else
            myattackchoice = 10;                              // :67  FloweryBoxesEasy
    }
    if (phaseturn >= 4) { myattackchoice = 21; phaseturn = 2; }     // :74-76
}

if (phase == 4)                                               // :80
{
    if (phaseturn == 1) myattackchoice = 16;                  // :84  FloweryDeflectOrange
    if (phaseturn == 2) myattackchoice = 18;                  // :90  JustKidding
    if (phaseturn == 3) { myattackchoice = 12;
                          difficulty = chase_attack_difficulty; }  // :96-98
    if (phaseturn == 4) myattackchoice = 18;                  // :103 JustKidding
}                                                             // NO phaseturn >= 5 arm, NO reset

if (phase == 5)                                               // :108
{
    if (phaseturn == 1)  myattackchoice = 15;                 // :112 FloweryChaseBlueYellow
    if (phaseturn >= 2)  myattackchoice = 15;                 // :118
}

if (phase == 6)                                               // :123
{
    if (phaseturn == 1) myattackchoice = 19;                  // :127 SuperJarona
    if (phaseturn != 1) myattackchoice = 14;                  // :133 FloweryDeflect2point5
}
```

Reading the ladders out:

* **phases 1-2** — `3, 0, 4, 2, 4, 2` and then, because `:39` rewinds `phaseturn` to 4, an endless
  `{4, 2}` alternation. Phase 2 does **not** reset `phaseturn` (`Step_0:354-359` only sets
  `phase = 2`), which is exactly why the chooser treats 1 and 2 as one ladder; `phase = 3` at
  `Step_0:361-366` is the first transition that does `phaseturn = 0`.
* **phase 3** — `10, 21, 11-or-10`, then `:76` rewinds `phaseturn` to 2, giving an endless
  `{21, 11-or-10}` alternation. The 11 arm is skill-gated (below).
* **phase 4** — `16, 18, 12, 18`, and then **18 forever**: turn 5 increments `phaseturn` to 5, no
  arm matches, and `myattackchoice` simply retains the 18 written on turn 4.
* **phase 5** — 15 on every turn.
* **phase 6** — 19 once, then 14 forever.

`difficulty = chase_attack_difficulty` at `:33` and `:98` is **inert**: `chase_attack_difficulty` is
`0` from `Create_0.gml:18` and is never written again, and the dispatcher never passes the boss's
`difficulty` on to `dc`.

### The other writers of `myattackchoice`

* `Create_0.gml:302` — `myattackchoice = 0`. **Inert**: `event_user(1)` runs at `Step_0:584` before
  the first bullet turn is ever dispatched, so the Create value is always overwritten first. (Same
  situation as the Knight's orphan choice 0, and unlike the Titan where Create's 0 agrees with the
  chooser.)
* `Step_0:224 / 229 / 234 / 239 / 244 / 249 / 254 / 259 / 264 / 269 / 274 / 279 / 284 / 289 / 294 /
  299 / 304 / 309 / 314 / 319 / 324 / 329` — every one of them inside the `switch (pattern_test)`
  at `Step_0:220-331`, which is inside **`if (scr_debug())`** at `Step_0:70`. This is the Alt/Ctrl +
  number-key pattern browser (`pattern_category` 0-5 = "No Forced Patterns / Jarona / Chase / Fist /
  Boxes / The Final Jarona", `Step_0:130-161`). It reaches **all 23** dispatcher values, which is
  precisely why the dispatcher looks bigger than the fight.

Nothing outside `obj_flowery_enemy` writes it: a grep for `myattackchoice` over the whole chapter-5
GML returns only Leafling, Netskie, Scarecrow, Seth/Shi, Yellow, Purple, Pink, `obj_flowery_bullet`
and `obj_flowery_bullet_parent` — all of them their own, unrelated variables.

---

## The real roster (14)

| # | choice | type | name | when |
|---|---|---|---|---|
| 1 | *(intro)* | 637 | FloweryDashTutorial | first-run intro, `Step_0:512-515` |
| 2 | 3 | 623 | FloweryWallsTutorial | phase 1/2 pt 1 |
| 3 | 0 | 620 | FloweryDeflect1 | phase 1/2 pt 2 |
| 4 | 4 | 624 | FloweryChase | phase 1/2 pt 3 and pt 5 |
| 5 | 2 | 634 | FloweryDeflect3 | phase 1/2 pt 4 and pt 6 (loop) |
| 6 | 10 | 630 | FloweryBoxesEasy | phase 3 pt 1, pt 3 (fail) |
| 7 | 21 | 641 | AquaKnives | phase 3 pt 2, pt ≥ 4 (loop) |
| 8 | 11 | 631 | FloweryBoxesMedium | phase 3 pt 3 (skill-gated) |
| 9 | 16 | 636 | FloweryDeflectOrange | phase 4 pt 1 |
| 10 | 18 | 638 | JustKidding | phase 4 pt 2, pt 4, and pt ≥ 5 forever |
| 11 | 12 | 632 | FloweryChase2Random | phase 4 pt 3 |
| 12 | 15 | 635 | FloweryChaseBlueYellow | phase 5, every turn |
| 13 | 19 | 639 | SuperJarona | phase 6 pt 1, once per fight |
| 14 | 14 | 622 | FloweryDeflect2point5 | phase 6, every later turn |

### The intro attack is not chosen — it is hard-coded

```gml
if (introcon == 1 && !i_ex(obj_writer))          // Step_0:491
{
    global.charturn = 3;
    introtimer++;
    if (introtimer == 10) { /* growtangle created, then visible = false; scr_moveheart() */ }
    if (introtimer == 21)                        // :510
    {
        global.monsterattackname[myself] = "FloweryDashTutorial";   // :512
        dc = scr_bulletspawner(x, y, obj_dbulletcontroller);
        dc.type = 637;                                              // :514
        scr_turntimer(9999999);
        introcon = 2;
        with (obj_battlecontroller) noreturn = 1;
    }
}
```

The dispatcher's own choice-17 branch is debug-only, but the **type** plays on every first run, so
637 is in `realTypes`. It is skipped on a retry — `Create_0.gml:26-30`:

```gml
global.tempflag[65]++;
global.flag[1865] = global.tempflag[65];
if (global.flag[1865] > 1)
    introcon = 3;                    // straight past the tutorial
```

The controller body (`obj_dbulletcontroller_Step_0.gml:4304-4351`) re-skins the orange soul into a
stationary red heart — `spr_orangeheart_centered`, `image_angle = -90`, `image_blend = c_red`,
`cancharge = false`, `canmovevertically = false` — so the tutorial teaches **only** the dash.
Ralsei's prompt string is built in `Create_0.gml:123`:
*"(Kris! Press and release ~1 to dash! Tapping it works, too!)"*.

### The one skill gate in the fight

Phase 3 turn 3 is `11` instead of `10` only when `did_sethaqua_attack_without_getting_hurt` is true,
and that variable is written from the **controller's CleanUp**, not the boss:

```gml
// obj_dbulletcontroller_CleanUp_0.gml:4-10
if (type == 630 && i_ex(obj_flowery_enemy))
{
    if (obj_flowery_enemy.did_sethaqua_attack_hit_count < 3)
        obj_flowery_enemy.did_sethaqua_attack_without_getting_hurt = true;
    obj_flowery_enemy.did_sethaqua_attack_hit_count = 0;
}
```

with the counter incremented from `scr_damage.gml:268`. Fewer than 3 hits during the type-630 box
turn ⇒ the harder box turn next.

### The other adaptive knob

Types **624** and **632** read `open_chase_difficulty = obj_flowery_enemy.open_chase_counter`
(`obj_dbulletcontroller_Step_0.gml:3894` and `:4187`). The boss starts it at 0
(`Create_0.gml:161`); `obj_orangeheart_Destroy_0.gml:1-5` steps it one closer to 2 whenever an open
chase ends with the heart's own counter still above 0 — that counter starts at 2
(`obj_orangeheart_Create_0.gml:35`) and only decrements inside `hurt()` while
`attacktype == 0 && (difficulty == 1 || difficulty == 4)` (`:63-72`). Higher values narrow every
wall gap (`obj_debug_orangeheartcontroller_Step_0.gml:106, 174, 208, 337`) and speed up
`obj_orangeheart_chaseattack` (`:28-29`). **Survive a chase and the next one is harder.**

---

## The cut roster (9)

Every one of these is a dispatcher branch with **no writer outside `if (scr_debug())`**.

| choice | type | name | why it can never be chosen |
|---|---|---|---|
| 1 | 621 | FloweryDeflect2 | `Step_0:1226-1232`. The unused middle difficulty of the deflect trio (difficulty 1, attack_speed 26, `do_bullets` *not* set — `obj_dbulletcontroller_Step_0.gml:3805-3828`). The chooser jumps 620 → 634 → 622. |
| 5 | 625 | FloweryChase2 | `Step_0:1258-1264`; controller `:3908-3932` (attacktype 0, difficulty 2, timer -5). Debug label "Chase Closed". |
| 6 | 626 | FloweryChase2Harder | `Step_0:1266-1272`; controller `:3934-3958` (difficulty 3). Debug label "Chase Closed Hard". |
| 7 | 627 | FloweryBulletsFistEasy | `Step_0:1274-1280`. |
| 8 | 628 | FloweryBulletsFistMedium | `Step_0:1282-1288`. |
| 9 | 629 | FloweryBulletsFistHard | `Step_0:1290-1296`; controller `:4018-4038` — the only branch that raises the turn *inside the controller* (`scr_turntimer(3200)` at `:4028`) on top of its own 320. |
| 13 | 633 | FloweryChaseWithBullets | `Step_0:1322-1328`; controller `:4200-4224` (difficulty 5). |
| 20 | 640 | BlueChase | `Step_0:1378-1384`. The only 380-frame turn in the fight. Controller `:4412-4435` sets difficulty **9**, one of the three values the chase spawner explicitly skips (`difficulty != 7 && difficulty != 8 && difficulty != 9`, `obj_debug_orangeheartcontroller_Step_0.gml:21`) — it would have run with no chaser at all. |
| 22 | 647 | OrbitStars | `Step_0:1394-1400`; controller `:4916-4945` — the only branch that sets `rotatecontrol = true` on `obj_orangeheart`, which repurposes up/down to spin `obj_orangeheart_bullet_orbit` instead of moving the soul (`obj_orangeheart_Step_0.gml:28-40`). A whole input mode that ships unused. |

**The entire "Fist" category is cut.** Debug `pattern_category 3` (`Step_0:147-150`) has exactly
three members — choices 7, 8, 9 — and none is ever assigned. Their controller branches set
`attacktype = 2`, and **`obj_debug_orangeheartcontroller_Step_0.gml` has no `attacktype == 2`
branch** (it handles only 0, 1, 3, 4 and 5), so those attacks would have been carried entirely by
`obj_orangeheart_floweryjarona`'s mode 1 / mode 3.

**Fossil in live code:** the box block still tests `myattackchoice == 8 || myattackchoice == 16` at
`Step_0:1147` to fling the Orange stand-in across the screen; only the 16 half can ever fire.

---

## The box block

`Step_0:1110-1194`. Anchor:

```
if (global.mnfight == 1.5 && endcon == 0 && phasetransition_con == 0 && healingscenecon == 0 && flowery_blowkiss_scene_con == 0)
```

**One occurrence**, verified by running `extractBoxBlock()` against the real file: 2 831 characters,
containing **no `scr_bulletspawner`**, so there is no double-spawn risk.

> The obvious anchor `if (!instance_exists(obj_growtangle))` is **unusable** here — it occurs twice
> (`:500` in the intro block, `:1112` in the real one) and `extractBoxBlock` takes `indexOf`'s first
> hit, which would slice the one-line intro create and nothing else.

What the block does, and why all of it matters:

```gml
if (!instance_exists(obj_growtangle))
    instance_create(view.x + 320, view.y + 170, obj_growtangle);        // :1112-1113
with (obj_growtangle)
{
    maxxscale = camerawidth() / 70;                                     // :1117
    maxyscale = 0.6779661016949152;                                     // :1118
    x -= 5;
    if (other.myattackchoice == 17) visible = false;                    // :1121-1122
}
if (myattackchoice == 0 || 1 || 2 || 16 || 18 || 19 || 7 || 8 || 9)     // :1125
{
    var _jarona = instance_create(x, y, obj_orangeheart_floweryjarona); // :1127
    if (myattackchoice == 18) _jarona.can_kidding = true;               // :1130
    if (myattackchoice == 19) { _jarona.visible = false;                // :1134
                                depth = obj_growtangle.depth + 1; }
    else                        visible = false;                        // :1139
}
else depth = obj_growtangle.depth + 1;
if (myattackchoice == 8 || myattackchoice == 16) { /* Orange stand-in flies in */ }
/* scr_moveheart(), then: */
global.mnfight = 2; scr_turntimer(90);                                  // :1177-1178
global.mnfight = 2; scr_turntimer(90);                                  // :1192-1193  (duplicated verbatim in the source)
```

* **`obj_orangeheart_floweryjarona` is created HERE, not by the controller.** Seven of the fourteen
  real attacks (620, 621, 622, 634, 636, 638, 639) only *configure* an existing Jarona; replaying
  the dispatcher branch alone gives them an empty box.
* `can_kidding` (choice 18) and the SuperJarona visibility swap (choice 19) exist nowhere else.
* The box is a **wide, tall runner corridor**, not the default rectangle:
  `maxxscale = camerawidth()/70`, and then `obj_debug_orangeheartcontroller_Create_0.gml:44-52`
  lerps `image_yscale` to 3.3 and `maxyscale` to 3, while every type branch additionally sets
  `image_xscale = camerawidth() / 75`.
* The duplicated `global.mnfight = 2; scr_turntimer(90);` paragraph is verbatim in the source and
  harmless — `scr_turntimer` only raises.

## The turn block

Anchor `scr_turntimer(90);`, endAnchor `if (!instance_exists(obj_moveheart))`. Verified: the anchor
occurs twice (`:1178`, `:1193`), the first passes `extractTurnBlock`'s `/turntimer/` proximity test
on its own text, and the endAnchor (3 occurrences: `:506`, `:1165`, `:1180`) resolves to `:1180`
because `indexOf` starts at `at`. **Slice = 18 characters: `scr_turntimer(90);`.**

Flowery has **no turn-length ladder**. Every per-attack length lives inside its own dispatcher
branch (`Step_0:1223-1399`) and therefore rides along in each entry's `setup` slice. Anchoring on
the dispatcher instead would slice the whole 180-line chain and spawn a second
`obj_dbulletcontroller` — the Knight bug.

### The big numbers are ceilings, not durations

This is the single most important thing for the studio. **Flowery's attacks end themselves** by
writing `global.turntimer` directly when their pattern completes:

| where | line | writes |
|---|---|---|
| `obj_orangeheart_floweryjarona_Step_0.gml` | 359-360 | `battle_timer > 315 && turntimer > 5 && mode != 4` → **5** |
| `obj_orangeheart_floweryjarona_Step_0.gml` | 1190 | deflected, no bullet fan → **30** |
| `obj_orangeheart_floweryjarona_Step_0.gml` | 1379 | deflected into the bullet fan → **90** |
| `obj_debug_orangeheartcontroller_Step_0.gml` | 76 | walls tutorial reaches the jump pad → **70** |
| `obj_debug_orangeheartcontroller_Step_0.gml` | 514 | the "well, if that's the way you wanna go out" line → **5** |
| `obj_debug_orangeheartcontroller_Step_0.gml` | 583 | `wall_counter == 6` cleared → **15** |
| `obj_orangeheart_wall_Create_0.gml` | 174 | tutorial wall 4 → **9999** (an *extension*) |

So a Jarona turn is ~315 frames of real play behind a 3200-frame ceiling. Mode 4 (SuperJarona) is
the only mode exempt from the 315-frame cutoff, which is why type 639 is given 9999.

---

## Phases, gates and the ACT side

The bullet roster is barely half of this fight. Phase transitions are **mercy**-gated
(`Step_0:354-489`) against a per-phase cap (`_maxmercy`, `Step_0:8-24`), and each one calls
`event_user(0)` (`Other_10.gml`) which **replaces the ACT menu**:

| phase | entered at | ACT (cost) | what the ACT actually is |
|---|---|---|---|
| 1 | start | Posey 160 / PoseyZ 125 (`scr_monstersetup.gml:595-604`) | the tutorial ACT |
| 2 | mercymod 10 (`Step_0:354`) | BlowAway 160 / BlowAwayZ 125 (`Other_10.gml:11-21`) | **button mash** — `Step_0:1708-1766` sets `acting = 101`, then `:1768-1866` counts `button1_p()` with `presscount_1` capped at 5, `presstimer`, and `progress` decaying 0.2/frame |
| 3 | mercymod 20 (`:361`) | Spin 200 / SpinZ 160 (`Other_10.gml:23-35`) | dialogue + animation; Aqua and Seth walk on (`:686-690`) |
| 4 | mercymod 30 (`:368`) | Praise 200 / PraiseZ 160 (`Other_10.gml:37-49`) | Orange and Green walk on (`:716-717`) |
| 5 | mercymod 40 (`:412`) | Justice 250 (`Other_10.gml:51-79`, and it **blanks ACTs 2-5**) | **the Ace-Attorney trial minigame** — `Step_0:2599-2620` creates `obj_yellow_trial_manager` with `trial_id = 99`, `flowery_mode = true` and a three-item evidence list (Metal Cuff / Moss / Prisoncloth) |
| 6 | mercymod 50 (`:448`) **or** two cleared trials | SusiesIdea 120 (`Other_10.gml:81-87`) | **the finale trigger** |
| 7 | mercymod 80 (`:483`) | — | **dead, see below** |

`NOOO_MERCY` (`Create_0.gml:36`, set true at each transition, cleared at `Step_0:4143 / 4162 / 4186 /
4197` once the new arrivals finish entering) suppresses mercy payout during the entrance
animations.

**Phase 5 → 6 is not purely mercy.** `obj_yellow_trial_manager_Create_0.gml:729-740`:

```gml
with (obj_flowery_enemy)
{
    actcon = 1; acting = 0; talked = 0;
    succeed_trial_count++;
    if (succeed_trial_count == 2)
        phase = 6;
    event_user(0);
}
```

Two cleared trials jump the phase directly, bypassing the mercymod-50 gate.

**Flowery cannot be killed.** `Step_0:569-580`: the instant `global.monsterhp <= 99% of max` during
enemytalk the fight interrupts into the healing scene (`healingscenecon` 1 → 10,
`Step_0:3382-3775`), which ends with

```gml
global.monsterhp[myself] = global.monstermaxhp[myself];   // Step_0:3532
```

up to three times (`global.flag[1873]`). The fight is won on **mercy only**. TENSION is the fuel:
breaking walls and touching helpful flowers calls `scr_tensionheal` scaled by `moar_tension`, which
ramps 1.0 → 1.5 with `global.tempflag[74]` (the retry counter, `Step_0:46-65`) and is read in
`obj_orangeheart_helpful_flower_Create_0.gml:28`, `obj_orangeheart_wall_Create_0.gml:96` and
`obj_orangeheart_wall_Step_0.gml:58` — the anti-frustration lever, since every mercy ACT costs
120-250 TP.

### Phase 7 and `endcon` are both dead ends

* `Step_0:483-489` sets `phase = 7` and `phasetransition_con = 20`. **Nothing anywhere tests
  `phasetransition_con == 20`**, and the whole turn loop is gated on `phasetransition_con == 0`
  (`:582`, `:1107`, `:1110`) — the fight would simply stop. It is unreachable in normal play anyway:
  phase 6's only ACTs are Check and SusiesIdea, so mercymod cannot climb to 80 without the debug
  `P` key (`Step_0:72-97`, `scr_mercyadd(myself, 10)`).
* `Step_0:566-567` sets `endcon = 1` at mercymod ≥ 100, and `Step_0:4037-4045` turns that into
  `endcon = 2` after 30 frames — and then nothing. There is **no `scr_wincombat` in this fight.**

---

## THE FINALE

Three separate engines, none of them the battle engine.

### Stage 0 — leaving the battle (`obj_flowery_enemy_Step_0.gml:2665-2988`)

Phase 6, `SusiesIdea`. `acting == 2` starts a dialogue chain (`2.11 → 2.12 → 2.13 → 2.14 → 2.91`,
short-circuited straight to `2.91` on a retry via `global.flag[1874]`, `:2676`). Then `acting 2.91`
(`:2757`):

1. Marks `obj_marker`, `obj_flowery_hero_flower`, `obj_flowery_marker`, `obj_heroparent`,
   `obj_battlecontroller`, `obj_tensionbar`, `obj_flowery_throwkris`, `obj_flowery_enemy`,
   `obj_flowery_towery`, `obj_flowery_tower_decoration` and `obj_script_delayed` **persistent for 5
   frames** (`:2777-2838`).
2. `room_goto(room_dw_fcastle_flowerclimb);` (**`:2840`**).
3. Hand-shifts every one of them by `(-last_cam_x, 11640 - last_cam_y)` (`:2841-2914`) so the whole
   battle scene lands at the bottom of the 11 000-pixel climb room.
4. `obj_flowery_enemy_Other_4` (**Room Start**) un-persists them all again.

`acting 2.92` (`:2921`) spawns `obj_flowery_throwkris` on Susie, at `acttimer == 32` forces
`throwcon = 2`, throws a `spr_kris_jump_ball` marker to `(camerax()+320, cameray()-200)`, calls
`obj_dw_fcastle_flowerclimb.start_pan()`, sets `hidebattleui = 1`, and at `acttimer == 100` destroys
`obj_monsterparent`, `obj_bulletparent`, `obj_tensionbar`, clears `global.fighting` and destroys
`obj_battlecontroller`.

### Stage 1 — THE CLIMB (`obj_dw_fcastle_flowerclimb`, Create 29 + Step 176 lines)

`start_pan()` (`Create_0.gml:12-29`) puts `obj_mainchara` at `x = -300` in `cutscene = 1`, calls
`scr_losechar()` and destroys the followers. The Step then:

* lerps the camera to `y = 9466` over 120 frames (`Step_0:133-137`) while a `spr_kris_dw_plummet`
  marker rises at `vspeed = -14` (`:115-123`) and `obj_rotating_tower_controller_new` spins into
  place (`rotation_con = 1`, two `scr_lerpvar`s over 90 frames, `:125-130`);
* once the marker passes the `obj_climbstarter` it becomes `spr_plat_kris_ball` with `gravity = 0.9`
  (`:139-145`), and on the way back down `instance_create(cs.x + 20, cs.y - 20, obj_climb_kris)`
  (`:156`) hands control to the player.

**Player input contract** (`obj_climb_kris_Step_0.gml:90-230`):

* **Hold a direction** (`up_h` / `down_h` / `left_h` / `right_h`) to grab hand-over-hand, through a
  directional buffer of `ceil(5 - climbmomentum * 2)` frames capped at 4 (`:85-88`) — the buffer
  *shrinks* as you speed up.
* Multi-direction frames are resolved against `currentdir`, `recently_bumped` and `previous_bump`
  (`:146-186`); reversing into a direction you were just bumped from **cancels the slip**, otherwise
  `slipcon == 2` zeroes `climbmomentum` and `climbspeed` (`:186-196`).
* **Hold the jump button to charge** (`chargetime1 = 10`, `chargetime2 = 22`,
  `Create_0.gml:38-40`), release to leap; `button1buffer` 2 for held, 3 for pressed (`:203-217`).

**The climb is a chained BOOST run.** The room places **eleven** `obj_climb_boostenemy` with
`boost_bonus` 1..11 (`gml_RoomCC_room_dw_fcastle_flowerclimb_8/9/16/17/18/19/20/21/22/23/24_PreCreate.gml`).
Hitting one mid-jump:

```gml
// obj_climb_kris_Step_0.gml:381-394
climbtimer = 0; boosting = true; xclimb = 0;
y = obstacle.y; yclimb = 0;
yclimb -= (600 + (20 * obstacle.boost_bonus));
jumpchargeamount = 8; boost_cooldown = 12;
```

so each successive booster throws Kris higher — 620 px for the first, 820 px for the eleventh.
Missing one drops you (`fallingcon = 1` on the enemy's non-fatal hit, `obj_climb_boostenemy_Step_0.gml`).

Three `obj_plat_cam_clampzone` areas (`extflag` `area_1/2/3`) re-wrap the climbables around the
cylinder as you pass them (`obj_dw_fcastle_flowerclimb_Step_0.gml:56-107`, modulo the tower's 880-px
circumference). The `end` trigger fades out and does
`room_goto(room_dw_fcastle_flowerydash)` (`:20-43`).

### Stage 2 — THE RUN (`obj_dw_flowerydash`, Create 62 + Step 338 lines)

`con == 0` plays a `scr_cutscene_make()` sequence: Kris lands, Flowery poses, six flower enemies
(`flowers = [6096, 2001, 2497, 6497, 4605, 5810]`) orbit him and are absorbed
(`flower_accel` 0 → 5 → 3 → 10, `flower_radius` 140 → 90 → 0), a white overlay covers the screen —
OMEGA FLOWERY.

`con == 10` (`:265-299`) turns the game into a **platform-mode auto-runner**:

```gml
with (obj_plat_player)
{
    dashing = true; dashsign = 1;
    static_dash = true;
    static_dash_fake_speed = other.dashspeed;   // 24
}
with (obj_parallax_background) autoscroll_speed = 24;
with (obj_plat_floortex_FLOOR)  x -= 24;   /* wrapping every 80 px */
```

and `instance_create(480, 160, obj_plat_finalflowery)` (`:242`) brings in the boss.

### Stage 3 — THE PARRY (`obj_plat_finalflowery`, Create 424 + Step 828 + Collision 124 lines)

`hp = 100`, and a `con` machine (`Step_0:7-13`):

| con | name | reachable? |
|---|---|---|
| 6 | `__INTRO` | yes — the Create default |
| 0 | `__IDLE` | yes |
| 1 | `__BULLETS` | **no** |
| 2 | `__JARONA` | yes |
| 3 | `__FINALJARONA` | yes |
| 4 | `__ACTING` | **no** |
| 5 | `__FLATTER` | **no** |

`only_jarona = true` (`Create_0.gml:88` and `:424`, never cleared) makes IDLE always route to
JARONA (`Step_0:50-52`), so `__BULLETS` is dead; `__ACTING` is entered by nothing
(`switch_con((nextcon % 2) + 1)` only ever yields 1 or 2), and `__FLATTER` is only entered from
`__ACTING`.

**`__JARONA` is the parry loop:**

* **subcon 0** — 80 frames of charging: rainbow `make_bwoosh` ripples every 4 frames, growing
  monochrome afterimages, `shake = subcontimer / 20`, a looping `snd_chargeshot_charge` pitched
  0.5 → 1.5 (`:63-118`).
* **subcon 1** — picks a random "rona" voice clip from
  `[[12, 9], [150, 9], [752, 9], [68, 9]]`, waits `ronawait`, then launches
  (`:119-168`). `jarona_repeat++` here.
* **subcon 2** — he dashes leftward carrying `dashbullet`, an `obj_plat_bulletred` whose damage is
  ```gml
  dashbullet.damage = 60 + global.battledf[0];
  var ddamage = (global.hp[global.char[0]] - 1) + global.battledf[0];
  dashbullet.damage = min(floor(global.hp[global.char[0]] * 0.4) + df, ddamage, dashbullet.damage);
  ```
  (`:179-189`) — **it can never kill you outright.** `memory` (0/1/2, `:174-177`) picks his vertical
  arc.
* **subcon 9** — he flies back to `xstart` over `ceil(24 - 0.5 * attack_speed)` frames (`:268-288`),
  then either loops back to subcon 1 or, once `jarona_repeat >= jarona_repeat_target`, to IDLE.

**The player's contract** is the platform-mode slash: land `obj_plat_hbx` (generated by
`obj_plat_player_Step_0.gml:1654-1690` from the attack button) on him as he passes.
`Collision_obj_plat_hbx` then destroys the `dashbullet`, adds **1.7** to `attack_speed` (so every
successful parry makes the next pass faster), cycles the sunset colour through
`sunset_cycle = [2, 3, 4, 5, 6]`, emits petals and does `switch_subcon(9)`.

**Missing costs progress** — passing off-screen left runs
`if (jarona_repeat < jarona_repeat_target) jarona_repeat--;` (`:237-238`).

`jarona_repeat_target = 8` and `attack_speed = 20` under `only_jarona` (`:69-77`), and

```gml
if (only_jarona)  is_final_jarona = jarona_repeat == (jarona_repeat_target - 1);   // :131
if (global.hp[global.char[0]] < 2) is_final_jarona = true;                          // :133-134
```

On the final pass `obj_plat_player.act_enabled = false`, `attack_speed = 18`, and `memory = 2` homes
him onto the player's `y` (`:138-144`, `:204-205`). Contact (`:247-266`) — or a hit (`Collision:57-60`)
— goes to `con = 3`.

**`__FINALJARONA` is the clash + QTE:**

* **subcon 0** (`:330-369`) — Kris is frozen in `spr_kris_plat_clash` with `attacking = true`,
  physics/gravity/wallcollision off; the battle music fades over 120 frames, a looping
  `snd_flowery_clash_cymbal` drone starts, `obj_screen_zoom` pushes in at 1.5×, both entities are
  re-depthed by -200000. 50 frames.
* **subcon 1** (`:370-398`) — three ghost pushes at `subcontimer` 1 / 31 / 51 (`final_jarona_ghost_state`
  lerps up, Kris slides left, white flash). At **subcontimer 131**: `snd_free(global.currentsong[0]);
  qte_prompt_state = 1;`
* **The parry bar** (`Step_0:806-828`, drawn by the `press_ui` marker's `draw_func` in
  `Create_0.gml:18-86` out of `spr_pxwhite` + `spr_pressfront` + `spr_pressfront_b` +
  `spr_pressspot` + `spr_attackspot`, an 80×360 box at `camerax()+140, cameray()+obj_plat_player.y+40`):

```gml
if (qte_prompt_state == 1)
{
    qte_alpha = scr_approach(qte_alpha, 1, 0.1);
    if (qte_alpha == 1)
    {
        boltframe++;
        if (boltframe > 60 && boltframe < 110)
        {
            if (button1_p() || button2_p() || button3_p())
            { qte_prompt_state = 2; switch_subcon(2); }     // SUCCESS
        }
        else if (boltframe >= 110)
        { qte_prompt_state = 3; switch_subcon(3); }          // FAIL
    }
}
```

  **The success window is `60 < boltframe < 110` — 49 frames — and any of the three buttons counts.**
  The bolt sprite is drawn at `xx + 160 + 2*boltframe*boltspeed - boltx*boltspeed*2` with
  `boltspeed = 1`, so it crosses the bar left-to-right and the window is the "hit zone" at
  `spr_pressspot` (`xx + 338`).

* **subcon 2 = SUCCESS** (`:399-536`) — Kris slashes through
  (`spr_kris_plat_slash_air`, `do_hit_event()`, `scr_plat_vfx(3352)`, white fade at
  `subcontimer 36`, black fade at `110`), and at `subcontimer 160`:
  `global.plot = 499; global.flag[1852] = 2; scr_setparty(1, 1); room_goto(room_dw_post_flowery_battle);`
* **subcon 3 = FAIL** (`:537-686`) — Flowery deflects (`spr_omegaflowery_deflect` at 72) and punches
  (`spr_omegaflowery_punch` at 82), the six absorbed-flower ghosts peel away
  (`ghost_aqua_offset` … `ghost_green_offset`, `:619-643`), and at `subcontimer 200`:
  `global.plot = 499; global.flag[1852] = 1; scr_setparty(1, 1); room_goto(room_dw_post_flowery_battle);`

**There is no death state in stage 3.** The outcome is a flag (`global.flag[1852]` = 2 for parried,
1 for missed), not a game over. `obj_dw_fcastle_flowery_gameover` (`Step_0`, 464 lines) is the
*battle*-stage retry, spawned from `obj_dw_fcastle_flowery_Create_0.gml:4-14` under
`global.tempflag[98] == 1`.

---

## Cut content living inside the shipped fight

1. **The ACT-menu minigame is unreachable.** `obj_flowery_act_menu_controller` / `_choice` /
   `_heart` (a dash-to-the-right-flower ACT selector with a charging orange heart, its own
   `obj_moveheart`, and green/red correct-answer feedback) is created only by
   `obj_battlecontroller_Step_0.gml:1096-1101`:
   ```gml
   if (i_ex(obj_flowery_enemy) && obj_flowery_enemy.act_type == 1
       && obj_flowery_enemy.flowerbuttonactive == true && obj_flowery_enemy.phase <= 4)
   ```
   and `act_type = 0` / `flowerbuttonactive = false` are set in `Create_0.gml:60-61` and **never
   written again anywhere in chapter 5** (`scr_charbox.gml:132` also reads
   `flowerbuttonactive` and is likewise dead). Consistently, both ACT-correctness checks are
   short-circuited by a hard-coded `_pickedcorrectly = true;` — `Step_0:1960` (phase 3) and
   `Step_0:2179` (phase 4) — and `correctact` stays 1 forever (`Create_0.gml:80`).
2. **`failedpreviousact` is only ever assigned `false`** (`Create_0.gml:81`,
   `Step_0:372 / 417 / 453`), so the bonus-mercy blocks at `Step_0:2025-2076` and `Step_0:2233` are
   dead.
3. **`rand_array` is shuffled and never read.** `Other_10.gml:1-7` runs a Fisher-Yates over
   `rand_array[0..3]` at the top of every ACT-menu rebuild; nothing in the chapter reads it.
4. **The aim-and-throw minigame is skipped.** `obj_flowery_throwkris` has a full angle/power meter
   (`angle`, `anglespeed 2`, `mypower 15..30`, `powerdir`, `radius 300`) that fires
   `obj_flowery_kristhrown` — but only under `activatethrow == 1`, and the only object in the
   chapter that ever sets that is `obj_throwralsei_Step_0.gml:14`. The finale sets `throwcon = 2`
   directly (`Step_0:2941`) and animates the throw by hand, so **`obj_flowery_kristhrown` never
   spawns.**
5. **An entire earlier prototype of this fight survives.** `obj_flowery_runner`,
   `obj_flowery_crescent` (+ `_effect`), `obj_flowery_shockwave`, `obj_flowery_star`,
   `obj_flowery_bullet` (+ `_parent`), `obj_flowery_shooter`, `obj_pathbox`, `obj_fallingbox`,
   `obj_fallingbox_original`, `obj_bullet_dashbar` and `obj_attack_jarona` are created **only** by
   `obj_dbulletcontroller` types 400/401/402/403/410 (`Step_0:1269-1522`) — and **nothing in
   chapter 5 assigns those types.** The shipped fight uses `obj_orangeheart_*` instead.
6. `obj_flowery_towery_old`, `obj_flowery_towery_pillars_old` and `obj_flowery_bulletcontroller`
   are likewise orphaned.

---

## What the studio needs

See `flowery.json`'s `engineNeeds` for the full list. The short version:

* **The orange soul is the whole fight** — ~4 000 lines across `obj_orangeheart`,
  `obj_debug_orangeheartcontroller`, `obj_orangeheart_wall / _chaseattack / _square /
  _word_manager / _helpful_flower / _jumppad / _ball / _enemy / _bullet / _bullet_orbit /
  _wallflower` and `obj_orangeheart_floweryjarona`. It replaces `obj_heart` entirely and needs its
  charge-and-dash state machine (`obj_orangeheart_Step_0.gml:86-230`, `chargecon` 0→5) plus the
  scrolling `fakecamx` world.
* **Turn termination is controller-driven**, not timer-driven (see the table above). Honouring the
  dispatcher's 3200 would leave the box empty for ~107 s.
* **The box block is mandatory**, not cosmetic — it is where `obj_orangeheart_floweryjarona` is
  created.
* Seven `obj_flowery_marker` props are dereferenced **unconditionally** every frame
  (`Step_0:4281 / 4286 / 4289 / 4292 / 4296-4299 / 4355`); a missing marker is a hard error.
* Surfaces and shaders: `obj_debug_orangeheartcontroller_Draw_0.gml:15-26`
  (`surface_create(camerawidth(), cameraheight())`), `obj_flowery_enemy_Draw_0.gml:13-18`
  (`d3d_set_fog`), `obj_flowery_towery` (three shaders, eleven uniforms, multiple surfaces),
  `obj_plat_finalflowery` (`shd_chromatic_reflection`, five uniforms).
* **The finale needs three engines the studio does not have**: the chapter-5 CLIMB subsystem
  (486 `obj_climb_*` files; at minimum `obj_climb_kris` at 2 117 lines, plus
  `obj_rotating_tower_controller_new`), platform mode (`obj_plat_player`, `obj_plat_hbx`,
  `obj_plat_bulletred`, `obj_plat_camera`, the parallax/border/particle stack), and the trial
  minigame `obj_yellow_trial_manager` (3 149 lines) for phase 5.
* **Room data is missing.** `room_dw_fcastle_flowerclimb`'s instance layout is not in the GML
  export — only 30 `PreCreate` snippets giving the eleven `boost_bonus` values, the
  `area_1/2/3` and `end` extflags, and four `prebake_sprite` ids. Same for
  `room_dw_fcastle_flowerydash`.
* **The one finale piece that IS reproducible standalone** is the parry QTE:
  `obj_plat_finalflowery_Step_0.gml:806-828` plus the `press_ui` `draw_func` — an 80×360 bar, a
  bolt advancing one pixel-pair per frame, success on any of button1/2/3 while
  `60 < boltframe < 110`.
* Cross-run state a cold launch cannot reproduce: `global.flag[1865]` / `tempflag[65]`
  (>1 skips the intro dash tutorial), `tempflag[74]` (drives `moar_tension` 1.0→1.5),
  `flag[1873]` (healing scenes remaining), `flag[1874]` (shortens the finale dialogue),
  `flag[670..674]` (which flower enemies were recruited — changes the phase-2 BlowAway animation),
  and `open_chase_counter` (the adaptive chase difficulty).

## Why `selectorVar` is omitted from `flowery.json`

The dispatcher really does switch on `myattackchoice`, but setting `selectorVar` would **corrupt the
AquaKnives entry**. Verified by running `gen_attacks.js`'s own `attackAnnouncements()` against
`gml_Object_obj_flowery_enemy_Step_0.gml`: the file yields 24 announcements and the **first** is the
intro at `:512`, whose enclosing `if` is `if (introtimer == 21)` (`:510`). The scanner therefore
records that row as `selector "introtimer", choice 21`. With `selectorVar` set, the RECONCILE pass
(`byChoice.get(Number(a.choice))`) would match it against this file's **choice-21** entry —
AquaKnives — and rewrite its name to `"AquaKnives"` and its type from 637 to 641. Dedupe would then
collapse it with the genuine AquaKnives row (identical controller/type/name) and keep the *intro*
row, so launching AquaKnives in the studio would replay
`dc.type = 637; scr_turntimer(9999999); introcon = 2;` — the dash tutorial.

With `selectorVar` absent the reconcile loop `continue`s, every scanned row keeps its own
selector/choice, and the REAL filter still works because it prefers `realTypes` and all 23 deduped
entries carry a type. Nothing is lost: the scanner already writes `selector "myattackchoice"` onto
the 23 dispatcher rows by itself, which is what the box block reads.

**End-to-end simulation of the generator for this entry** (scan → dedupe → REAL judge) produces:

```
scanned rows: 24
reconcile skipped (no selectorVar) — as intended
deduped rows: 23
  REAL  flowery_type637   introtimer==21      FloweryDashTutorial   also=[17]  setup=266
  REAL  flowery_type620   myattackchoice==0   FloweryDeflect1                  setup=190
  cut   flowery_type621   myattackchoice==1   FloweryDeflect2                  setup=190
  REAL  flowery_type634   myattackchoice==2   FloweryDeflect3                  setup=190
  REAL  flowery_type623   myattackchoice==3   FloweryWallsTutorial             setup=194
  REAL  flowery_type624   myattackchoice==4   FloweryChase                     setup=186
  cut   flowery_type625   myattackchoice==5   FloweryChase2                    setup=187
  cut   flowery_type626   myattackchoice==6   FloweryChase2Harder              setup=193
  cut   flowery_type627   myattackchoice==7   FloweryBulletsFistEasy           setup=196
  cut   flowery_type628   myattackchoice==8   FloweryBulletsFistMedium         setup=198
  cut   flowery_type629   myattackchoice==9   FloweryBulletsFistHard           setup=196
  REAL  flowery_type630   myattackchoice==10  FloweryBoxesEasy                 setup=190
  REAL  flowery_type631   myattackchoice==11  FloweryBoxesMedium               setup=192
  REAL  flowery_type632   myattackchoice==12  FloweryChase2Random              setup=193
  cut   flowery_type633   myattackchoice==13  FloweryChaseWithBullets          setup=197
  REAL  flowery_type622   myattackchoice==14  FloweryDeflect2point5            setup=196
  REAL  flowery_type635   myattackchoice==15  FloweryChaseBlueYellow           setup=196
  REAL  flowery_type636   myattackchoice==16  FloweryDeflectOrange             setup=195
  REAL  flowery_type638   myattackchoice==18  JustKidding                      setup=186
  REAL  flowery_type639   myattackchoice==19  SuperJarona                      setup=186
  cut   flowery_type640   myattackchoice==20  BlueChase                        setup=183
  REAL  flowery_type641   myattackchoice==21  AquaKnives                       setup=184
  cut   flowery_type647   myattackchoice==22  OrbitStars                       setup=184

real 14 / cut 9
boxBlock.anchor verbatim hits : 1
turnBlock.anchor verbatim hits: 2
turnBlock.endAnchor hits      : 3
```

One known deviation: because the merged type-637 row carries `selector "introtimer"`, the studio
will not set `myattackchoice = 17`, so the box block's `if (other.myattackchoice == 17) visible =
false` (`Step_0:1121-1122`) does not fire and the dash tutorial runs with a **visible** box. Setting
`myattackchoice = 17` on the boss by hand restores it.
