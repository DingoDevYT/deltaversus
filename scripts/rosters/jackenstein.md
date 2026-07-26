# Jackenstein (ch4) — the REAL roster, derived from the chooser

**Result: 11 of 11 dispatcher entries are real. Nothing is cut.**

That is unusual for this project — the first five bosses reduced 147 dispatcher
entries to 63 — so it is worth stating the reason up front. Jackenstein's
dispatcher is a dense `myattackchoice == 0..10` ladder with no gaps, the chooser
is a plain turn counter that walks 0→8 and then parks on 10 forever, and the one
value the counter never emits (9) is assigned from a completely different place:
the UNLEASH act. Every branch has a writer. I grepped every assignment of
`myattackchoice` in every `obj_jackenstein_enemy_*` event and across all of ch4;
there are exactly twelve, and they are all accounted for below.

All GML paths are relative to
`C:/Users/lando/Desktop/DELTARUNE - GML/DELTARUNE Chapter 4 - GML/`.
Ref data is `C:/Users/lando/Desktop/DELTARUNE - REF DATA/DELTARUNE Chapter 4 - REFDATA/`.

---

## 1. The objects

| object | role | evidence |
|---|---|---|
| `obj_jackenstein_enemy` | the boss (parent `obj_monsterparent`, sprite `spr_jackenstein_battle_eyes`) | `objects.tsv`; stats block `gml_GlobalScript_scr_monstersetup.gml:1984-1996` (`monstertype == 107`) |
| `obj_jackendummy` | inert stand-in, **child of `obj_jackenstein_enemy`**, created only in `room_bullettest` | `objects.tsv` (parent = `obj_jackenstein_enemy`); every event body is `exit;`; `gml_Object_obj_jackendummy_Create_0.gml` is 3 lines: `scaredycat = true; sact = false; ract = false;` |
| `obj_dbulletcontroller` | the one and only controller; all eleven attacks are `type == 146..156` | `gml_Object_obj_jackenstein_enemy_Step_0.gml:500-565` |

`obj_ch4_DCC00_jackenstein`, `obj_dw_church_jackenstein`,
`obj_dw_church_jackenstein_pumpkinNPC` and `obj_npc_jackenstein` are
overworld/cutscene objects and are **not** part of the fight (`objects.tsv`; the
NPC is only un-hidden on victory, `Step_0:26-27`).

Stats (`gml_GlobalScript_scr_monstersetup.gml:1987-1996`): HP 1350, AT 14,
DF 0, mercymax 100.

---

## 2. The dispatcher

`gml_Object_obj_jackenstein_enemy_Step_0.gml:500-565`, inside
`if (scr_isphase("bullets") && attacked == 0)` → `if (rtimer == 8)`:

```gml
if (myattackchoice == 0)
{
    global.monsterattackname[myself] = "jack 1";
    dc = scr_bulletspawner(x, y, obj_dbulletcontroller);
    dc.type = 146;
}
else if (myattackchoice == 1) { ... "jack 2" ... dc.type = 147; }
...
else if (myattackchoice == 10) { ... "jack 10" ... dc.type = 156; }
```

Eleven branches, `myattackchoice` 0–10, one controller, no gaps.

**There are no difficulty variants.** `grep -c difficulty` over the whole
`type == 146..156` region of `gml_Object_obj_dbulletcontroller_Step_0.gml`
(lines 1831–3349) returns **0**, and over
`gml_Object_obj_jackenstein_enemy_Step_0.gml` also **0**. The chooser writes
`difficulty = 0` next to every choice, but the boss never passes it to the
controller and no jackenstein branch ever reads it. The studio's DIFF selector
is a no-op for this fight.

Note the ordering: choice order and type order **do not match**. The mapping is

| choice | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| type | 146 | 147 | **151** | **150** | **148** | **153** | **149** | **152** | 154 | 155 | 156 |
| name | jack 1 | jack 2 | jack 3 | jack 4 | jack 5 | jack 6 | jack 7 | jack 8 | jack 9 | jack lightup | jack 10 |

so the "jack N" names follow the *play order*, not the type ids. Sorting the
studio dropdown by type would scramble the fight.

---

## 3. The chooser

`gml_Object_obj_jackenstein_enemy_Other_10.gml` (= `event_user(0)`), all 64
lines, condensed:

```gml
if (phaseturn == 1)  { myattackchoice = 0;  difficulty = 0; }   // :1-5
if (phaseturn == 2)  { myattackchoice = 1;  difficulty = 0; }   // :7-11
if (phaseturn == 3)  { myattackchoice = 2;  difficulty = 0; }   // :13-17
if (phaseturn == 4)  { myattackchoice = 3;  difficulty = 0; }   // :19-23
if (phaseturn == 5)  { myattackchoice = 4;  difficulty = 0; }   // :25-29
if (phaseturn == 6)  { myattackchoice = 5;  difficulty = 0; }   // :31-35
if (phaseturn == 7)  { myattackchoice = 6;  difficulty = 0; }   // :37-41
if (phaseturn == 8)  { myattackchoice = 7;  difficulty = 0; }   // :43-47
if (phaseturn == 9)  { myattackchoice = 8;  difficulty = 0; }   // :49-53
if (phaseturn == 10) { myattackchoice = 10; difficulty = 0; }   // :55-59

phaseturn++;                                                    // :61
if (phaseturn == 11)
    phaseturn = 10;                                             // :63-64
```

`phaseturn = 1` at `gml_Object_obj_jackenstein_enemy_Create_0.gml:16`.

So the fight is a **fixed, non-random, non-branching sequence**:

```
turn 1  choice 0  type 146  jack 1
turn 2  choice 1  type 147  jack 2
turn 3  choice 2  type 151  jack 3       + dancing_jackolantern_con = 1 at turn end
turn 4  choice 3  type 150  jack 4
turn 5  choice 4  type 148  jack 5
turn 6  choice 5  type 153  jack 6
turn 7  choice 6  type 149  jack 7
turn 8  choice 7  type 152  jack 8
turn 9  choice 8  type 154  jack 9
turn 10+ choice 10 type 156 jack 10      forever (phaseturn clamps to 10)
```

There is no `choose()`, no HP gate, no mercy gate anywhere in the chooser or in
the code that calls it. The only HP test in the whole boss is the death
cutscene at `Step_0:67-72`.

### 3a. Where the chooser is called, and how choice 9 skips it

`gml_Object_obj_jackenstein_enemy_Step_0.gml:74-85`:

```gml
if (scr_isphase("enemytalk") && talked == 0)
{
    rs_rand = choose(0, 1, 2, 3, 4);
    scr_randomtarget();

    if (!instance_exists(obj_darkener))
    {
        if (unleash == 1)
            myattackchoice = 9;
        else
            event_user(0);
        ...
```

This is the whole story of choice 9, **"jack lightup" / type 155**:

- It is **not** in the `phaseturn` ladder. Its only writer is `Step_0:82`.
- `unleash` is set to 1 at `Step_0:727-732`, the tail of Kris's UNLEASH ACT
  (`acting == 2.2 && actcon == 0 && !i_ex(obj_purify_event)`).
- The ACT is defined at `gml_GlobalScript_scr_monstersetup.gml:2000-2003`:
  `canact[1] = 1`, name `"Unleash"`, desc `"Reveal#weakness"`,
  `actcost[1] = 150` TP. It is always available (no flag gate).
- `Step_0:208` does `unleash = 0` unconditionally in the same block, so one ACT
  buys exactly one type-155 turn.
- Because the `else` is skipped, **an UNLEASH turn does not advance
  `phaseturn`**. The ladder resumes exactly where it left off. Type 155 is
  therefore an *insertable* turn, playable any number of times at any point in
  the fight, and it never consumes a scripted attack.

`Create_0.gml:11` also sets `myattackchoice = 0`, but the chooser runs before
every non-UNLEASH turn and `phaseturn == 1` assigns 0 anyway, so the Create
value is never load-bearing (unlike the Knight, where Create's choice 0 —
Swordslash — is destroyed by the chooser and never plays).

Debug-only writers, listed for completeness and excluded from the roster
reasoning: `Step_0:9-13` (`scr_debug() && keyboard_check_pressed(ord("T"))` →
`phaseturn = 8`), `Mouse_60.gml:3` (`phaseturn++`), `Mouse_61.gml:3`
(`phaseturn--`). All three are behind `scr_debug()`.

---

## 4. The real roster (11 entries)

| choice | type | name | box sprite | turntimer | controller lines |
|---|---|---|---|---|---|
| 0 | 146 | jack 1 | `spr_ghost_house_starter` | 999999 | 1831–1883 |
| 1 | 147 | jack 2 | `spr_ghost_house_3x2` | 999999 | 1885–2011 |
| 2 | 151 | jack 3 | `spr_ghost_house_normal` | 999999 | 2458–2558 |
| 3 | 150 | jack 4 | `spr_ghost_house_chimney` | 999999 | 2313–2456 |
| 4 | 148 | jack 5 | `spr_ghost_house_toolong` | 999999 | 2013–2208 |
| 5 | 153 | jack 6 | `spr_ghost_house_nopumpkin` | 999999 | 2755–2912 |
| 6 | 149 | jack 7 | `spr_ghost_house_twopumpkins` | 999999 | 2210–2311 |
| 7 | 152 | jack 8 | `spr_ghost_house_yourtutu` | 999999 | 2560–2753 |
| 8 | 154 | jack 9 | `spr_ghost_house_final` | 999999 | 2914–3231 |
| 9 | 155 | jack lightup | `spr_ghost_house_lightup` | **900** | 3233–3285 |
| 10 | 156 | jack 10 | *(plain box, `image_yscale = 1`)* | **420** | 3287–3349 |

(controller lines are `gml_Object_obj_dbulletcontroller_Step_0.gml`.)

**Cut list: empty.** Every dispatcher value 0–10 is written by the code above.

---

## 5. Turn length — read this before wiring the studio

Nine of eleven attacks set `global.turntimer = 999999` **directly** (not through
`scr_turntimer`), inside their `if (!made)` block. Those turns are not timed at
all; they end on one of two events:

- the SOUL reaches the exit —
  `gml_Object_obj_ghosthouse_exit_Collision_obj_heart.gml`, all two lines:
  `instance_destroy(); global.turntimer = 1;`
- the chasing pumpkin has hit you twelve times —
  `gml_Object_obj_ghosthouse_jackolantern_Other_15.gml:16-17`:
  `if (hits == 12) global.turntimer = 1;`

Only type 155 (900 frames) and type 156 (420 frames) are on a clock.

The turn-length chain in the boss is trivially short:
`gml_Object_obj_jackenstein_enemy_Step_0.gml:567` — `scr_turntimer(200);` —
immediately followed by `turns += 1;` at :568. There is also a
`scr_turntimer(90);` at :477 at the end of the box setup. `scr_turntimer` only
RAISES, so 90 then 200 gives 200; and then every controller branch overwrites it
with a direct assignment. The 200 exists only to keep the turn alive long enough
for the controller's `made` block to run.

---

## 6. Generator config, with the anchors verified

```json
"boxBlock":  { "file": "gml_Object_obj_jackenstein_enemy_Step_0.gml",
               "anchor": "if (!instance_exists(obj_growtangle))",
               "endAnchor": "global.mnfight = 2;", "ifElse": false },
"turnBlock": { "file": "gml_Object_obj_jackenstein_enemy_Step_0.gml",
               "anchor": "scr_turntimer(200);", "endAnchor": "turns += 1;" }
```

Verified against the file, and verified against a local re-implementation of
`extractBoxBlock` / `extractTurnBlock` / `attackAnnouncements` copied out of
`scripts/gen_attacks.js`:

- `if (!instance_exists(obj_growtangle))` occurs **exactly once** in the file
  (line 415).
- `global.mnfight = 2;` occurs exactly once (line 476). Line 639 is
  `global.mnfight == 2` — a comparison, not a match.
- `scr_turntimer(200);` occurs exactly once (line 567), and passes the
  generator's `/turntimer/` proximity test.
- `turns += 1;` occurs exactly once (line 568).
- Extracted box block: **2686 chars**, lines 415–475, brace balance 0, paren
  balance 0.
- Extracted turn block: `scr_turntimer(200);` (19 chars).
- Announcement scan yields all **11** attacks with `selector = myattackchoice`,
  `controller = obj_dbulletcontroller`, correct types, and a 144–150 char
  `setup` slice per attack (none dropped by the length or "escaped" guards).

The box block itself is `if (global.mnfight == 1.5) { ... }` in the source; the
slice starts *inside* it at line 415 and ends before `global.mnfight = 2;`, so
the enclosing `if` and its closing brace are both outside the slice — which is
why it balances. What it contains, in order:

1. the per-choice `instance_create(...)` ladder (11 arms, lines 417–448) —
   different spawn positions per maze;
2. `with (obj_growtangle) { visible = false; image_xscale = 2; image_yscale = 2;
   image_alpha = 1; depth = 15; timer = 15; }`;
3. `instance_create_depth(0, 0, -15, obj_ghosthouse_fadein);` and a second
   `obj_growtangle.visible = false;`;
4. `if (!instance_exists(obj_moveheart) && !i_ex(obj_heart)) scr_moveheart();`;
5. a second `with (obj_growtangle)` that sets `timer = maxtimer` and **snaps x/y
   back to the view centre** `(XView + 320, YView + 170)`.

Step 5 overwrites step 1's positions, so the per-choice spawn coordinates in the
ladder are effectively dead — every maze ends up centred. Do not "fix" this.
`maxxscale`/`maxyscale` stay at their Create defaults of 2, and `visible` is
false, so `obj_growtangle_Step_0.gml:1-29` does **not** take its
`spr_battlebg_stretch_hitbox` custom-box path. The maze sprite is applied later,
by the controller.

---

## 7. What this fight actually is (and what the studio has to special-case)

It is a **ghost-house maze**, not a bullet-hell. Per turn:

- `obj_growtangle` (parent `obj_battlesolid` in ch4 — see `objects.tsv`) has its
  `sprite_index` set to one of ten `spr_ghost_house_*` mazes and its
  `mask_index` set to `-1`, so **the maze artwork is the collision geometry**.
- The soul walks it with `gml_Object_obj_heart_Step_0.gml:79-215` — an 8-way
  `place_meeting(..., obj_battlesolid)` resolver with corner-nudging and
  wall-slide. Lines 249–259 clamp to the **view**, not to the box; without
  working solid collision the soul just walks out of the maze.
- A second `obj_battlesolid` carrying `spr_ghost_house_*_inner` is created on
  top for the interior walls (every branch does this).
- `obj_ghosthouse_key` (+12.5 TP, `gml_Object_obj_ghosthouse_key_Other_15.gml:1`)
  rotates `obj_ghosthouse_lock` 135° out of the way (`:25-32`) and arms
  `obj_ghosthouse_exit` (`alarm[0] = 60`). Touching the exit ends the turn.
- `obj_ghosthouse_dot` are collectible TREASURE, +2.5 TP each
  (`gml_Object_obj_ghosthouse_dot_Other_15.gml:7`), and they double as
  telegraphs tracing the fireball paths.
- Touching the invisible `obj_ghosthouse_trigger` spawns
  `obj_ghosthouse_jackolantern` (`Collision_obj_heart:62`), which chases along
  the path stored on the controller —
  `gml_Object_obj_ghosthouse_jackolantern_Create_0.gml:17`:
  `path = obj_dbulletcontroller.path;`.
- Everything is rendered through `obj_darkness_overlay` with `darkfight = true`
  (`gml_Object_obj_jackenstein_enemy_Create_0.gml:68-73`). Only the radius
  around `obj_lightsource_heartlight` is lit, and the box, lock, lamp and
  selected battlesolids are drawn **by the overlay**, not by themselves
  (`gml_Object_obj_darkness_overlay_Draw_0.gml:323-362`).
- The box is created `visible = false` and is only revealed by
  `gml_Object_obj_ghosthouse_fadein_Draw_0.gml:6` once `obj_dbulletcontroller.made`
  is true; that same Draw event paints the black silhouette (frame 1 of the maze
  sprite) fading at 0.025/frame ≈ 40 frames. **Without `obj_ghosthouse_fadein`
  the maze is invisible for the whole turn.**

**No soul modes.** No green, purple or yellow — the heart stays red the whole
fight, which makes this the least mode-exotic of the six but the most
geometry-dependent.

**No phases and no HP gates.** `phase` is set to 1 in `Create_0.gml:15` and never
read anywhere. `endcon` / `end_cutscene_version` are set in `Create_0.gml:17-19`
and again at `Step_0:70-71` and are likewise never read — all three are dead
variables. The only real "phase" is `phaseturn`, which is a turn counter.

### Per-turn ACT modifiers the attacks read off the boss instance

| field | ACT | set at | read by |
|---|---|---|---|
| `scaredycat` | Kris "ScaredyCat", 5 TP, **only offered when `global.tempflag[100] > 0`** (`scr_monstersetup.gml:2008-2013`) | `Step_0:734-747` | `obj_heart_Step_0.gml:11-12` → `wspeed = 4`; type 148 path speed +13 (`dbulletcontroller:2041-2042`); chimney pumpkin start +15 frames (`gml_Object_obj_ghosthouse_trigger_Collision_obj_heart.gml:121`) |
| `ract` | Ralsei "LightUp", 2.5 TP (`scr_monstersetup.gml:2020-2023`) | `Step_0:773-795` | `Step_0:489-498` → heartlight `radius += 10`, `biggerrad += 12` at the start of **every** bullet phase; type 155 adds `+5` more (`dbulletcontroller:3262-3266`) |
| `sact` | Susie "TreasureHunt", 5 TP (`scr_monstersetup.gml:2016-2019`) | `Step_0:749-771` | type 156 dot spawner `timer2 += 0.25`/frame (`dbulletcontroller:3315-3319`) |

All three are reset at turn end (`Step_0:639-654`, together with `rr = -1` and
the `dancing_jackolantern_con` flip for choice 2).

`scr_tensionheal` is special-cased for this fight:
`gml_GlobalScript_scr_tensionheal.gml:3-4` gives **1.5× TP** from every key and
dot when `i_ex(obj_jackenstein_enemy) && global.tempflag[89] >= 3`.

### Engine gaps, ranked

1. **GameMaker paths.** Seven of eleven attacks build a controller path for the
   chase pumpkin (`path = path_add()` at dbulletcontroller lines 1911 / 2040 /
   2238 / 2338 / 2487 / 2588 / 2939 — types 147, 148, 149, 150, 151, 152, 154).
   Type 150's has **zero points** — that pumpkin runs on `move_directly`
   instead. Type 152 additionally gives **six** `obj_gh_fireball_square` bullets
   their own paths, using each bullet's own `path = path_add()` from
   `gml_Object_obj_gh_fireball_square_Create_0.gml:21` (dbulletcontroller
   2637–2716). Needed: `path_add`, `path_add_point`, `path_set_closed`,
   `path_start`, `path_speed`, `path_end`, `path_action_reverse`,
   `path_action_restart`.
2. **Per-pixel solid collision.** `mask_index = -1` on a maze sprite means the
   mask is the artwork. Bounding-box collision makes every maze a filled
   rectangle and the soul cannot move at all.
3. **`obj_ghosthouse_exit`.** Nine attacks run at `turntimer = 999999`; without
   the exit collision (and the 12-hit pumpkin fallback) every maze runs forever.
4. **Darkness rendering.** `obj_darkness_overlay_Draw_0.gml` is 515 lines of
   surface work that also re-draws the box, lock, lamp and battlesolids. Plus
   `obj_ghosthouse_fadein`, without which nothing is visible.
5. **`obj_lightsource_heartlight` must exist before type 156 launches.**
   `dbulletcontroller:3301-3302` uses direct dot-access
   (`obj_lightsource_heartlight.radius = 52;`) — a hard runtime error on a
   missing instance. Types 146–155 use `with (...)`, which no-ops safely. The
   boss Create makes it at `Create_0.gml:61-66` (radius 40).
6. **`obj_heart` and `obj_grazebox` must exist before the controller's `made`
   block**, which reassigns their sprites/masks to the small dodgeheart set and
   reads `obj_growtangle.x/y` to place the soul.
7. **Numeric sprite ids.** Each attack sets
   `obj_growtangle.spr_custom_box = <int>` with a raw ch4 asset index. All ten
   were checked against `sprites.tsv` (index = line number − 2) and every one
   resolves to the *same* sprite assigned to `sprite_index` on the line above:

   | id | sprite | id | sprite |
   |---|---|---|---|
   | 5420 | `spr_ghost_house_starter` | 1401 | `spr_ghost_house_yourtutu` |
   | 32 | `spr_ghost_house_3x2` | 5800 | `spr_ghost_house_nopumpkin` |
   | 2173 | `spr_ghost_house_toolong` | 5175 | `spr_ghost_house_final` |
   | 1868 | `spr_ghost_house_twopumpkins` | 4708 | `spr_ghost_house_lightup` |
   | 3175 | `spr_ghost_house_chimney` | 2334 | `spr_ghost_house_normal` |

   Safe shortcut for the studio: `spr_custom_box = sprite_index`.
   (Type 156 sets neither — it keeps the plain box, sets `image_yscale = 1` and
   `y += 24`, and is the one conventional falling-bullet turn in the fight.)
8. **Support cast**, all ch4-only: `obj_ghosthouse_key` / `_lock` / `_exit` /
   `_trigger` / `_dot` / `_cleaner` / `_fadein`; `obj_gh_fireball_bouncy` /
   `_linear` / `_square` / `_hop` / `_mobius`; `obj_gh_bouncebarrier`;
   `obj_gh_exitsign`; `obj_battlesolid`; `obj_ghosthouse_jackolantern`
   (456-line Step) and `obj_ghosthouse_jackolantern_merciful` (613-line Step,
   used **only** by type 155); `obj_your_tutu` + `obj_small_jackolantern` +
   `obj_takingtoolong` (type 152 only); the `obj_lightsource_*` family.
9. **Scripts**: `scr_lerpvar`, `scr_lerp_var_instance`, `scr_script_delayed`,
   `scr_doom`, `scr_fire_bullet`, `scr_tensionheal`, `scr_afterimage`,
   `scr_bulletspawner`, `scr_moveheart`, `merge_color`,
   `sprite_create_from_surface`.
10. **Free test harness.** **All eleven** branches carry an
    `if (room == room_bullettest)` block (dbulletcontroller lines 1837, 1891,
    2019, 2216, 2319, 2464, 2566, 2761, 2920, 3239, 3294) that creates
    `obj_darkness_overlay_bullettest` and plays `pumpkin_boss.ogg`. Types
    148 / 149 / 152 additionally create `obj_jackendummy` there (2021, 2218,
    2568), with `scaredycat` forced `false` for 149 and `true` for 152.
    Because `obj_jackendummy`'s parent **is** `obj_jackenstein_enemy`, both
    `i_ex(obj_jackenstein_enemy)` and `obj_jackenstein_enemy.scaredycat`
    resolve against the dummy. So if the studio reports `room == room_bullettest`
    it inherits the dummy, the bullet-test overlay and the music for free.
    Otherwise it **must** supply a boss instance carrying `scaredycat` / `sact`
    / `ract`, because `obj_heart`, `obj_ghosthouse_trigger` and types
    148 / 152 / 155 / 156 all read those fields.

---

## 8. Confidence

**High.** Every claim here was read out of the decompiled source and
cross-checked: the eleven-entry dispatcher and the eleven `type ==` branches
line up one-to-one; every `myattackchoice` writer in ch4 was enumerated by grep;
all four anchor strings were confirmed unique and re-extracted with a local copy
of the generator's own slicing code; and all ten numeric `spr_custom_box` ids
were resolved against `sprites.tsv`.

The one thing that is *derived* rather than observed is that a real playthrough
reaches turn 10 — the studio can't confirm that from source alone. But it does
not matter for the roster: `phaseturn` is monotone, has no early exit, and
clamps at 10, so choices 0–8 and 10 are all reachable in order and 9 is
reachable at any time via UNLEASH.
