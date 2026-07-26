# Orange & Green — ch5, `obj_orange_green_controller` (+ `obj_orange_enemy`, `obj_green_enemy`)

**4 real bullet attacks + 1 turn replacement; 8 cut entries** (of which only 3 are
`obj_dbulletcontroller` dispatcher branches — the rest are dead code paths inside
the live attacks).

This fight breaks the pattern the first five bosses established in three ways at
once, and each one has to be handled before a single bullet appears:

1. **Neither monster dispatches anything.** All fight logic lives in a third,
   invisible object the monster creates in its own `Create`.
2. **There is no `monsterattackname` anywhere in the fight** — the generator's
   announcement scan finds literally zero attacks. This roster is *declared*.
3. **The chooser is a boolean on another object's variable**, not a numeric
   selector, so `selectorScan` does not apply either.

The reward for getting through that is a small, fully-reachable roster: the
dispatcher overcount here is unusually mild (3 cut types), but the *dead code
inside the shipped attacks* is not.

---

## 0. Which fight this is, and which objects belong to it

`gml_GlobalScript_scr_encountersetup.gml:826-837` — **encounter 221**:

```
case 221:
    global.monsterinstancetype[0] = obj_orange_enemy;   // :827
    global.monstertype[0] = 113;                        // :828
    global.monstermakex[0] = xx + 500;                  // :829
    global.monstermakey[0] = yy + 103;                  // :830
    global.monsterinstancetype[1] = obj_green_enemy;    // :831
    global.monstertype[1] = 114;                        // :832
    global.monstermakex[1] = xx + 493;                  // :833
    global.monstermakey[1] = yy + 180;                  // :834
    global.monstertype[2] = 0;                          // :835
    global.battlemsg[0] = "* Green brings the food!&* Orange brings the fight!"
```

Started from the overworld exactly once, at
`gml_Object_obj_ch5_DWCR03_Step_0.gml:1055`:

```
scr_battle(221, 3, orange_marker, green_marker, 0);
```

`gml_GlobalScript_scr_monstersetup.gml:395-412` (Orange, type 113) and
`:425-442` (Green, type 114) give both **2060 HP / AT 16 / DF 0 / 0 EXP /
400 gold / sparepoint 0 / mercymax 100**, with ACTs `Check` + **`GetAlong`**
(Orange) and `Check` + **`FeastX`** (Green), both described as `25%#mercy`.

### You cannot kill them

The **first two lines of both enemy Steps** —
`gml_Object_obj_orange_enemy_Step_0.gml:1-2` and
`gml_Object_obj_green_enemy_Step_0.gml:1-2`:

```
if (global.monsterhp[myself] < (global.monstermaxhp[myself] * 0.5))
    global.monsterhp[myself] = global.monstermaxhp[myself] * 0.5;
```

HP is clamped *back up* to 50% every frame. `sparepoint = 0` means neither can
be spared by the normal route either. **The only way this fight ends is one of
them reaching 100 mercy**, which is why the finale is chosen by mercy and not by
HP.

### The template cluster — excluded on evidence, not on name

| object | parent in `objects.tsv` | created by | verdict |
|---|---|---|---|
| `obj_orange_enemy` (:404) | `obj_monsterparent` | `scr_encountersetup` case 221 | **REAL** |
| `obj_green_enemy` (:150) | `obj_monsterparent` | `scr_encountersetup` case 221 | **REAL** |
| `obj_orange_green_controller` | *(none)* | `obj_orange_enemy_Create_0.gml:32` | **REAL — the dispatcher** |
| `obj_enemy_orange_example` (:903) | *(none)* | **nothing, anywhere** | dev template |
| `obj_enemy_green_example` (:848) | *(none)* | **nothing, anywhere** | dev template |
| `obj_orangeheart_enemy` (:778) | `obj_bulletparent` | one dead branch of a Flowery object | **different fight** |

**`obj_enemy_orange_example` / `obj_enemy_green_example`.** A chapter-wide
recursive grep for either name returns hits *only* from inside the cluster
itself — the three lines `obj_enemy_orange_example_Draw_0.gml:3, :44, :48`
reaching across to its sibling. Neither has `scr_enemy_object_init()`, an
`obj_monsterparent` parent (their parent column in `objects.tsv` is **empty**,
unlike the two real enemies), an encounter entry, or a RoomCC. The orange one's
`Create_0` builds its **own** battle box at hard-coded screen coordinates with no
battle context at all. Its 461-line `Draw_0` is the visible ancestor of both
`obj_attack_green_cookingtime` and `obj_attack_orange_superattack` — which is
exactly why it looks connected and is not.

`obj_enemy_green_example_Draw_0.gml:68` reads
`obj_orange_green_controller.powerup`. That is the single most convincing line in
the cluster, and it never executes, because nothing creates the object.

**`obj_orangeheart_enemy`** was in the starting leads and does not belong here.
The whole `obj_orangeheart_*` family is the **ORANGE SOUL platformer mode**, which
belongs to **FLOWERY**; the shared colour word is a coincidence.
`obj_orangeheart_enemy` has exactly **two** references in Chapter 5, both at
`gml_Object_obj_debug_orangeheartcontroller_Step_0.gml:948-949`, inside that
object's `if (attacktype == 4)` branch — and nothing in the chapter ever writes
`attacktype = 4` (grep over `obj_dbulletcontroller_Step_0.gml` shows `attacktype`
assigned only 0, 2 or 3), so even that one creator is itself dead code.
`obj_orangeheart_enemy_Create_0.gml:14` sets
`sprite_index = spr_flowery_walk_left_jacket_hand_up`. Neither `obj_orange_enemy`,
`obj_green_enemy` nor `obj_orange_green_controller` mentions `obj_orangeheart` in
any form.

---

## 1. The real dispatcher is a third object

`gml_Object_obj_orange_enemy_Create_0.gml:32`:

```
instance_create(x, y, obj_orange_green_controller);
```

and `gml_Object_obj_orange_enemy_CleanUp_0.gml` destroys it again. Everything
that matters is in that controller:

| what | where |
|---|---|
| powerup ladder | `obj_orange_green_controller_Step_0.gml:1-22` |
| soul-speed overrides | `:24-82` |
| ending flags | `:117-137` |
| dialogue ladders | `:145-308` |
| **battle box** | **`:514-538`** |
| Orange's punch stance | `:544-571` |
| **per-turn dispatcher** | **`:573-614`** |
| turn-end / heroes_shake | `:617-769` |
| endcon cutscene 1 → 2 → 2.5 | `:771-880` |
| **finale box + dispatcher** | **`:837-847` / `:849-879`** |
| **healing egg turn** | **`:1609-1653`** |
| `enum e__VW` (at the bottom!) | `:1656-1675` |

Meanwhile `obj_orange_enemy_Step_0.gml` is ACT dialogue plus the omelet-punch
minigame, and `obj_green_enemy_Step_0.gml` is pure ACT dialogue.
`obj_green_enemy_Other_10.gml` — the event that would hold a chooser on any other
boss — is a single line: `exit;`.

**There is no `monsterattackname` in this fight.** `grep -n monsterattackname`
over every `obj_orange_enemy_*`, `obj_green_enemy_*` and
`obj_orange_green_controller_*` file returns nothing (exit 1). `gen_attacks.js`'s
`attackAnnouncements()` therefore returns an empty array no matter what goes in
`enemy`, and `extraAttackFiles` is deliberately omitted from the JSON — pointing
it anywhere would only produce a `0 attacks announced` note.

---

## 2. The chooser

There are **exactly four** `.type =` assignments in the entire cast — verified by
grepping `\.type = ` across all `obj_orange_enemy_*`, `obj_green_enemy_*` and
`obj_orange_green_controller_*` files:

```
obj_orange_green_controller_Step_0.gml:589    __dc.type = 314;
obj_orange_green_controller_Step_0.gml:604    __dc.type = 131;
obj_orange_green_controller_Step_0.gml:860    __dc.type = 132;
obj_orange_green_controller_Step_0.gml:871    __dc.type = 307;
```

(The two other `type = 3` hits at `:743` and `obj_orange_enemy_Step_0.gml:834`
are `obj_dmgwriter` types, not bullet types.)

### 2a. Per-turn chooser — `obj_orange_green_controller_Step_0.gml:573-614`

```
if (rtimer == 12)                                            // :573
{
    visible = false;
    with (obj_orange_enemy) punchomeletcount = 0;

    if (healing_egg_con == 0)                                // :580
    {
        if (i_ex(obj_orange_enemy) && obj_orange_enemy.uppercut_life < 1)   // :582
        {
            __dc = instance_create(obj_orange_enemy.x, obj_orange_enemy.y,
                                   obj_dbulletcontroller);   // :584
            __dc.creator  = obj_orange_enemy.myself;
            __dc.creatorid= obj_orange_enemy.id;
            __dc.target   = obj_orange_enemy.mytarget;
            __dc.damage   = global.monsterat[obj_orange_enemy.myself] * 5;
            __dc.type     = 314;                             // :589
            __dc.difficulty = 8;                             // :590
            with (obj_orange_enemy) uppercut_life = 5;       // :592-593
            scr_turntimer(360);                              // :595
        }
        else
        {
            __dc = instance_create(x, y, obj_dbulletcontroller);  // :599
            __dc.creator  = obj_green_enemy.myself;
            __dc.creatorid= obj_green_enemy.id;
            __dc.target   = obj_green_enemy.mytarget;
            __dc.damage   = global.monsterat[obj_green_enemy.myself] * 5;
            __dc.type     = 131;                             // :604
            scr_turntimer(270);                              // :605
        }
    }
    ...
}
```

That is the whole thing. **One input: `obj_orange_enemy.uppercut_life`.** No
`rr`, no `myattackchoice`, no ladder.

`uppercut_life` starts at **5** (`obj_orange_enemy_Create_0.gml:15`) and is reset
to 5 in three places (`:592-593` after every 314, and `:122-123` / `:133-134` at
the two ending triggers). The only thing that *lowers* it is
`obj_orange_enemy_Step_0.gml:553`, inside the omelet punch:

```
if (punchomeletcon != 2)                                     // :541
{
    with (obj_bullet_healing)
    {
        if (y > (obj_growtangle.y + 100) && ... type == 131 && image_alpha > 0)  // :545
        {
            with (obj_orange_enemy)
            {
                punchomeletcon = 1;
                punchomeletcount++;
                show_uppercut_life = true;
                uppercut_life--;                             // :553
                if (uppercut_life < -3) uppercut_life = -3;  // :555-556
                ...
```

**Derivation:** both arms are reachable and repeat indefinitely. Type 131 is
always the first bullet turn (uppercut_life = 5) and the default afterwards; type
314 fires on the turn after the player lets **5 or more** foods hit the floor, and
then immediately resets the counter. Neither is HP- or turn-gated. The visible
counter is the 5-egg ring drawn around Orange
(`obj_orange_enemy_Draw_0.gml:96-155`), which draws 6/7/8 eggs at
`uppercut_life` −1/−2/−3.

The third possibility is the `healing_egg_con != 0` case, where the whole `if` is
skipped and **no controller is created at all** — see §4.

### 2b. Finale chooser — `:117-137` sets the flag, `:849-879` dispatches

```
if (global.mercymod[obj_orange_enemy.myself] >= 100)   // :117
{
    condescendending = true;                           // :119
    endcon = 1;
    with (obj_orange_enemy) uppercut_life = 5;
    exit;
}

if (global.mercymod[obj_green_enemy.myself] >= 100)    // :128
{
    admireending = true;                               // :130
    endcon = 1;
    with (obj_orange_enemy) uppercut_life = 5;
    exit;
}
```

and later, inside `if (endcon == 2.5)`:

```
if (endtimer == 12)                                    // :849
{
    with (obj_orange_enemy) state = 0;

    if (condescendending && i_ex(obj_orange_enemy))    // :854
    {
        __dc = instance_create(obj_orange_enemy.x, obj_orange_enemy.y,
                               obj_dbulletcontroller);
        __dc.creator = obj_orange_enemy.myself;
        __dc.type    = 132;                            // :860
        scr_turntimer(300);                            // :861
    }

    if (admireending && i_ex(obj_green_enemy))         // :864
    {
        __dc = instance_create(x, y, obj_dbulletcontroller);
        __dc.creator = obj_green_enemy.myself;
        __dc.damage  = global.monsterat[obj_green_enemy.myself] * 5;
        __dc.type    = 307;                            // :871
        __dc.damage  = 92;                             // :872  (overwrites!)
        __dc.target  = 4;                              // :873
        scr_turntimer(500);                            // :874
    }
    endcon = 3;
}
```

Two notes worth writing down:

* **Type 132's dispatcher sets no damage at all.** The attack object supplies its
  own (`obj_attack_orange_superattack_Create_0.gml`:
  `damage = global.monsterat[obj_orange_enemy.myself] * 5; target = 4;`).
* **Type 307's damage is written twice**, `monsterat*5` then a flat `92`. The
  second wins.

**Mercy is the only ending currency, and it comes only from the ACT menu:**

| ACT | file:line | orange | green |
|---|---|---|---|
| Orange · `GetAlong` | `obj_orange_enemy_Step_0.gml:446-449` | **+25** | +20 |
| Green · `FeastX` | `obj_green_enemy_Step_0.gml:294-297` | +20 | **+25** |

`scr_mercyadd.gml:7-8` clamps at `mercymax` = 100. So:

* 4 × `GetAlong` → orange 100 → **condescendending** → **type 132**
* 4 × `FeastX` → green 100 → **admireending** → **type 307**
* Orange is tested first (`:117` before `:128`), so a simultaneous 100/100 gives
  the condescend ending.

---

## 3. The real roster

| # | choice | type | attack | controller / object | turn |
|---|---|---|---|---|---|
| 1 | `uppercut_life >= 1` | **131** | **COOKING TIME** — Green's FAST FOOD | `obj_dbulletcontroller` → `obj_attack_green_cookingtime` | 270 |
| 2 | `uppercut_life < 1` | **314** | **OMEGA-3 uppercut** — glove rings | `obj_dbulletcontroller` → `obj_glove_manager` | 360 |
| 3 | `condescendending` | **132** | **OMEGA-3 SUPER ATTACK** (Orange finale) | `obj_dbulletcontroller` → `obj_attack_orange_superattack` | **615** |
| 4 | `admireending` | **307** | **OMEGA PAN** (Green finale) | `obj_dbulletcontroller` → `obj_omega_pan_manager` | 500 |
| — | `healing_egg_con != 0` | — | **HEALING EGG** (turn replacement) | *none* → `obj_green_egg_heal` | 999 |

### 1 · type 131 — COOKING TIME

`obj_dbulletcontroller_Step_0.gml:1588-1598` hides Green and creates
`obj_attack_green_cookingtime`. **That object has no Step event** — its entire
198-line attack is in `Draw_0`.

Every `timermax` frames it drops one item at one of three landing spots
(`Create_0:23-32`, `camerax()+272/306/336`, shifted to `+283/318/352` at
`powerup == 2`). Every third drop (`(mode2count % 3) == 0`, `Draw_0:54`) is a
**harmful** `obj_regularbullet` with `spr_bullet_green_flame`, damage 96, target 4,
gravity 0.35. Everything else is **food** — `obj_bullet_healing` (`Draw_0:123-191`):

| foodtype | sprite | behaviour |
|---|---|---|
| 0 | `spr_bullet_green_egg` | gravity 0.35, then `scr_doom(candy, 80)` |
| 1 | `spr_donut_bullet` | `vspeed = -14 - random(6)`, bounces wall to wall |
| 2 | `spr_swatchling_platter_candy` | lerped to alternating box edges, telegraphed |

Catching food (`obj_bullet_healing_Step_0.gml:101-193`) calls `scr_healall(1)`,
gives every hero `scr_tensionheal(4)`, and revives downed heroes to 1 HP; candy
adds `scr_tensionheal(7)` and donut `scr_tensionheal(4)` on top.

`powerup` is the difficulty axis (`Draw_0:7-27` and `:86-121`):

| powerup | `timermax` | `foodtype` | flame bullets? | soul `wspeed` |
|---|---|---|---|---|
| 0 | 12 | 0 | yes | 4 (default) |
| 1 | 13 | alternates 1/0 | yes | 7 |
| 2 | 10 | 2 | yes (`mode2count -= irandom(1)`) | 7 |
| 3 | 6 | 0 | yes | 7 |
| *(4)* | *(8)* | *(2)* | — | — **unreachable, see §5** |
| 5 | 10 | alternates 1/0 | **no** (`powerup != 5` guard) | **10** |

The attack ends itself on `global.turntimer < 1` (`Draw_0:197-198`) — it never
*sets* the turn timer, which is why the external `scr_turntimer(270)` is
load-bearing.

### 2 · type 314 — OMEGA-3 uppercut

`obj_dbulletcontroller_Step_0.gml:3567-3712`. The dispatcher pins
`difficulty = 8`, so the branch's own `if (difficulty == 0) difficulty = 9;`
(`:3571-3572`) is dead **for the real fight** (it is live for a manual spawn).
`difficulty` becomes `obj_glove_manager.bullets` (`:3693-3694`) — **8 gloves per
ring**.

`global.turntimer = 360;` at `:3574` is a **direct assignment**, matching the
dispatcher's `scr_turntimer(360)`.

Cycle of 56 frames (`mytimer % 56`):

| frame | `:line` | what |
|---|---|---|
| 1 | 3592 | pick next position; `running = (global.turntimer >= 64)` |
| — | 3601-3602 | `nextx = growtangle.x ± (56 + random(24))`, `nexty = growtangle.y - 144 + random(20)` — lerped with afterimages |
| 15 | 3650 | wind-up, `spr_orange_screenpunch` |
| 22 | 3660 | punch: `spr_orange_screenpunchfist` `obj_bulletparent` flash |
| **25** | **3691-3699** | **drop `obj_glove_manager`**, `bullets = difficulty`, `event_user(0)`, `gloveflip *= -1`, `scr_shakescreen(8)` |
| 29 | 3685 | recover |
| 30 | 3704-3705 | `mytimer += 3 * (obj_heart.wspeed - 4)` — **faster soul ⇒ sooner next punch** |

`obj_glove_manager_Other_10.gml` rings `bullets` `obj_orange_glove` around the
manager; `obj_glove_manager_Step_0.gml:1-33` falls at
`vspeed → 0.7 + obj_heart.wspeed / 2` with radius `(90 + 33·sin(expand)) · grow`
and each glove orbiting at `turn / dist`.

`running` flipping false at `global.turntimer < 64` (`:3594-3595`) is **how Orange
retreats** — a wrong turn length breaks the retreat, not just the length.

**Decompiler artifact to preserve:** `:3581` is `orange = 402;` and `:3586` reads
`bspr = orange.sprite_index;` — object-scoped access through an *integer literal*.
402 is `obj_orange_enemy` (`objects.tsv` line 404, header on line 1 → id 402).

### 3 · type 132 — OMEGA-3 SUPER ATTACK

`obj_dbulletcontroller_Step_0.gml:1622-1630`:

```
if (type == 132)
{
    if (!made)
    {
        global.turntimer = 615;                                   // :1626
        made = true;
        var d = instance_create_depth(x, y, -1, obj_attack_orange_superattack);
    }
}
```

**615 overrides the dispatcher's `scr_turntimer(300)`** — a direct assignment, so
it lowers as well as raises. The real Orange finale is 615 frames.

`obj_attack_orange_superattack_Step_0.gml` is literally `exit;`. All 301 lines are
in `Draw_0`: it lerps `obj_growtangle.image_xscale` to 3 over 30 frames
(`:34-35`), orbits `foodcollected = 10` eggs inward, then rains
`obj_bullet_orange_debris` — **rendered through a surface clipped to
`gt_minx/gt_miny/gt_maxx/gt_maxy`** (`Draw_0:1-21`).

### 4 · type 307 — OMEGA PAN

`obj_dbulletcontroller_Step_0.gml:3455-3463` creates `obj_omega_pan_manager` at
the box centre and `scr_bullet_inherit()`s it. Its `Create_0:4-5`:

```
obj_growtangle.sprite_index = spr_battlebg_round;
obj_growtangle.mask_index   = spr_battlebg_round;
```

**The box turns round** (`spr_battlebg_round` is 80×80 origin 40,40 —
`sprites.tsv:326`). Three `obj_omega_pan` at radius 140, 120° apart, shuffled into
a `ds_list`. `Step_0` rotates 0.5°/frame with a breathing radius
`120 + 6·cos(global.time · 0.25)` and a swinging tangential offset
`-32 - 32·sin(global.time · 0.125)`; every 35 frames the next pan in the shuffled
list fires a 3-bullet fan of `obj_omega_pan_fire` (`spr_bullet_green_flame`,
speed 9, `gravity = -0.3` along its own direction, middle bullet `speed += 2`).

This is the only entry followed by the `endcon == 3.1 → 3.4` scene where Susie
and Ralsei praise Green's attack (`:908-912`, `:916-979`).

### — · HEALING EGG (turn replacement)

`obj_orange_green_controller_Step_0.gml:516-519`:

```
if (i_ex(obj_green_enemy)  && global.monsterhp[green]  < (global.monstermaxhp[green]  * 0.7) && healing_egg_con == 0)
    healing_egg_con = 1;
else if (i_ex(obj_orange_enemy) && global.monsterhp[orange] < (global.monstermaxhp[orange] * 0.7) && healing_egg_con == 0
         && global.monsterhp[orange] < global.monsterhp[green])
    healing_egg_con = 2;
else if (!instance_exists(obj_growtangle) && healing_egg_con == 0)
    instance_create(viewX + 320, viewY + 170, obj_growtangle);
```

Once set, **every downstream guard suppresses the bullet turn**: `:520` skips the
box, `:532` skips `scr_moveheart()`, `:554` skips Orange's punch stance, `:580`
skips the `obj_dbulletcontroller` entirely. `:1609-1643` prints
`* GREEN cast HEALING EGG on self!` / `...on ORANGE!`, spawns `obj_green_egg_heal`
with `target_enemy`, pins `global.turntimer = 999`, then drops it to −10 to end
the turn; `:1645-1653` clears the flag.

**Fully reachable and repeatable**: because both enemies clamp their HP up to 50%
every frame, any party that deals more than 30% damage crosses the 70% line.
`obj_healing_egg_Draw_0.gml:48-58` restores the target to **full** max HP. The
enemy-talk phase short-circuits for it too — `:139-143` jumps straight to
`global.mnfight = 1.5` with no dialogue when either enemy is under 70%.

Like Pink's dates, this **replaces a turn**; it is in `real[]` but it is not an
attack.

---

## 4. Box and turn length

### Box block — `:514-538`, anchor `if (global.mnfight == 1.5 && endcon == 0)`

Verified by replaying `gen_attacks.js`'s `strip()` + `ifStatementEnd()` against
the file: **1 occurrence, lines 514-538, 1005 chars, brace-balanced**, no
`endAnchor` needed.

It creates `obj_growtangle` at `(viewX+320, viewY+170)` and then forces
`maxxscale = 1.5`. `obj_growtangle_Create_0.gml:14-15` defaults both scales to 2,
and `spr_battlebg_0` is 75×75 origin 37,37 (`sprites.tsv:4100`), so the **regular
turns run a narrowed 112.5 × 150 box** against the usual 150 × 150.

Two traps live inside this slice:

* **The healing-egg trap.** The `instance_create(... obj_growtangle)` is the
  *third* arm of the chain above. Replay this with `global.monsterhp` unset (0 or
  `undefined`) and the chain takes arm 1, sets `healing_egg_con = 1`, and
  **never creates the box or the soul**. Seed
  `global.monsterhp[i] = global.monstermaxhp[i] = 2060` for both enemies first.
* `if (powerup == 4) with (obj_growtangle) maxxscale = 2;` (`:526-530`) is
  **dead** — see §5.

### Finale box — `:837-847`, supplied as literal source

The two finale attacks do **not** use the box block. They are set up inside
`if (endcon == 2.5) { if (endtimer == 1) { ... } }`, with **no `maxxscale = 1.5`**
— so the finale box is the untouched 2 × 2 default.

There is no clean anchor pair for it. `if (endtimer == 1)` occurs **5 times**
(`:775, :837, :1117, :1186, :1315`) and `scr_turntimer(90);` occurs twice
(`:535, :845`); slicing `if (endcon == 2.5)` with `endAnchor: "if (endtimer == 12)"`
produces a **brace-unbalanced** 382-char fragment (tested). So the JSON carries
the literal source instead.

### Turn block — **`null`, deliberately**

There is no turn-length ladder in this fight. Every `scr_turntimer` except the
floor is *inside* a dispatcher branch, interleaved with the
`instance_create(..., obj_dbulletcontroller)` calls at `:595, :605, :861, :874` —
so **no slice can set the turn length without also re-spawning a controller**
(the Knight double-spawn trap). The only standalone call is the floor
`scr_turntimer(90)` at `:535`, which already lives inside `boxBlock`.

For the record: the shape `yellow_blue.json` and `watercooler.json` use —
`anchor: "scr_turntimer(90);"`, `endAnchor: "}"` — would slice from `:535` and
additionally re-run `global.mnfight = 2; ballooncon = -1;`, for a turn length of
90 that is wrong every single time.

Use `turnByType`, or replay `dispatchBlock` / `finaleDispatchBlock` verbatim
(they carry the right values themselves):

| type | turn | source |
|---|---|---|
| 131 | **270** | external `scr_turntimer(270)` at `:605`; the attack only *reads* the timer (`Draw_0:197`) |
| 314 | **360** | self-set, `obj_dbulletcontroller_Step_0.gml:3574` (direct assignment) |
| 132 | **615** | self-set, `:1626` — **overrides** the dispatcher's 300 |
| 307 | **500** | external `scr_turntimer(500)` at `:874`; the manager never touches the timer |
| — | 90 | the floor set in `boxBlock` — wrong for all four |

**Type 131 is further rewritten mid-turn.** When the eat sequence triggers,
`obj_orange_enemy_Step_0.gml:623-624` forces `global.turntimer = 2`, `:634`
rewrites it to 170, and `:816` to 30. Do not treat 270 as final for that turn.

Note `scr_turntimer` only *raises*
(`if (global.turntimer < arg0) global.turntimer = arg0;`) — but types 314 and 132
use direct assignment, which also lowers.

---

## 5. Cut list

### Dispatcher branches nothing selects (3)

| type | object | proof |
|---|---|---|
| **127** | `obj_attack_orange_simplesin` | `obj_dbulletcontroller_Step_0.gml:1550-1557` creates it, and it has a full Create/Step/Draw/CleanUp set and a real parent (`objects.tsv:462`, `obj_regularbullet`). But `grep -rn 'type = 127'` over the whole Ch5 dump returns **zero hits**, and the only four `.type =` assignments in the cast are 314/131/132/307. Reachable only through `obj_battletester`. |
| **128** | `obj_attack_orange_dragonpunch` | `:1559-1566` (`objects.tsv:627`, no parent). Same proof — `grep -rn 'type = 128'` returns nothing. This is the discarded earlier design of Orange's melee turn; the shipped fight uses the type-314 glove rings. |
| **305** | `obj_green_bigpan` | `:3427-3434` creates it at a **hard-coded `(468, 96)`** — a screen-space literal rather than a box-relative one, itself a tell. `objects.tsv:623`, parent `obj_bulletparent`. `grep -rn 'type = 305'` returns nothing. It is the single-pan ancestor of the shipped type-307 `obj_omega_pan_manager`. |

### Dead code inside the shipped attacks (5)

**`powerup == 4` — an entire missing difficulty tier.** The ladder at
`:8-21` assigns 0, 1, 2, 3 and then **jumps to 5**:

```
if (_progress >= 60 && _progress < 80)  powerup = 3;    // :17-18
if (_progress >= 80 && _progress < 100) powerup = 5;    // :20-21
```

`Create_0:43` initialises it to 0, and a chapter-wide grep shows those six lines
are the *only* writers. So everything gated on `powerup == 4` is dead: the box
widening at `:526-530`, the Cooking Time cadence `timermax = 8`
(`obj_attack_green_cookingtime_Draw_0.gml:23-24`) and the `foodtype = 2`
assignment (`ibid:106-107`). Separately, `if (powerup >= 4) wspeed = 6;`
(`:70-74`) is not dead but is a **no-op** — `powerup >= 3` two lines above already
set 6.

**Cooking Time `mode == 1`.** `obj_attack_green_cookingtime_Create_0.gml:12` sets
`mode = 2` and nothing ever reassigns it (that Create line is the only write to
this object's `mode` in the chapter). So `Draw_0:140-141` —
`if (powerup >= 1 && mode == 1) candy.gravity = choose(0.35, 0.35, 0.1);` — can
never run, and the healing food never gets the slow-float variant. Its sibling at
`Draw_0:74-75` tests `mode == 2`, does run, and gives the *flame bullets*
`choose(0.35, 0.45, 0.25)` at `powerup >= 1`.

**`treasurehunter`, plus five write-only Create vars.**
`obj_bullet_healing_Step_0.gml:24-29` makes every food item home 6 px/frame
toward the soul when `obj_orange_green_controller.treasurehunter` is true and the
soul is within 30 px — a food magnet. `Create_0:41` sets it to `false` and that is
the **only** assignment in the chapter. Five more Create-only variables have
neither a reader nor a second writer: `admirecount` (`:37`), `condescendcount`
(`:38`), `heartspeed` (`:42`), `admiregreenonly` (`:44`), `condescendorangeonly`
(`:45`). `afterbulletcon` (`:17`) is the mirror case — it **has** a reader
(`obj_battlecontroller_Step_0.gml:29` exits the whole battle step while it is > 0)
but no writer anywhere, so that hook is dead too, along with `afterbullettimer`
(`:18`).

**`obj_bullet_green_food` / `obj_omelet_cut` — orphan bullet objects.**
`obj_bullet_green_food` (`objects.tsv:787`, parent `obj_collidebullet`, sprite
`spr_bullet_green_egg`, with Create/Step/Draw/Other_15) and `obj_omelet_cut`
(`objects.tsv:831`, `spr_bullet_green_egg_half`) have **no creator anywhere** —
`grep -rl` for each name across the whole chapter returns **zero files**. The
shipped fight uses `obj_bullet_healing` (no parent, `:695`) for food and
`obj_omelet_marker` (`:148`) for the punched-food trophies.

**The flagless second `endcon = 1` at `:706-763`.** It fires at the end of a
bullet turn when either mercy is ≥ 100, and revives every downed hero to 5 HP —
but it sets **neither** `condescendending` nor `admireending`. Down that path the
finale plays with no message and no attack (the `if (endtimer == 12)` dispatcher
matches neither branch). It is unreachable as a *first* trigger, because mercy can
only change during the ACT phase, which precedes enemytalk, and `:117-137` runs
first and `exit`s. Treat it as a safety net — but do not delete it, because it is
what revives downed heroes before the finale.

---

## 6. Phases, and the one line you must transpile literally

There is no phase machine. The difficulty axis is `powerup`, recomputed **every
frame** at `:1-22`:

```
var _progress = global.mercymod[obj_green_enemy.myself];                        // :3

if ((_progress == global.mercymod[obj_green_enemy.myself])
        < global.mercymod[obj_orange_enemy.myself])                             // :5
    _progress = global.mercymod[obj_orange_enemy.myself];                       // :6
```

The inner comparison `(_progress == mercymod[green])` is **always true** —
`_progress` was assigned that value on the line above — so it evaluates to `1` and
the whole line reduces to:

```
if (1 < mercymod[orange]) _progress = mercymod[orange];
```

**This is not a `max()`.** It takes *Orange's* mercy whenever Orange has more than
1, and only falls back to Green's on the very first turn. Since every ACT gives
Orange at least +20, `powerup` tracks Orange's mercy exclusively from turn 2
onward. Rewriting it as `max(green, orange)` changes the fight — do not "fix" it.

| `_progress` | powerup |
|---|---|
| 0-19 | 0 |
| 20-39 | 1 |
| 40-59 | 2 |
| 60-79 | 3 |
| 80-99 | **5** |
| 100 | *(no arm — holds its previous value)* |

Because `scr_mercyadd` clamps at 100 and there is no `100` arm, powerup **holds**
at exactly 100 mercy. And because reaching 100 immediately triggers an ending,
**powerup 5 is only seen on mixed routes** — e.g. 2 × GetAlong + 2 × FeastX puts
both at 90 with neither at 100.

Soul speed follows powerup (`:24-52` for type 131, `:54-82` for type 314):

| type | powerup ≥ 1 | ≥ 3 | ≥ 5 |
|---|---|---|---|
| 131 | `wspeed = 7` | 7 | **10** |
| 314 | `wspeed = 5` | 6 | 7 |

Other per-turn state, none of which changes *which* attack fires:

* **Heroes shake** (`:633-645`, applied `:1588-1607`): catch all the food for
  1/2/3 consecutive turns → every `obj_heroparent` jitters ±1/±2/±3 px outside the
  bullets phase, with `* It's getting very hard to stay still!`.
* **Dialogue ladders** (`:145-308`): `orange_succeeded_getting_food_count` and
  `orange_failed_getting_food_count` step 1 → 1.5 → 2 → … → 4.5. Note `:148` tests
  `uppercut_life == uppercut_life_previous` — the player caught *everything*,
  which is the **failed** ladder from Orange's point of view.
* **`rr` is a decoy**, exactly like the Watercooler's: `Create_0:7` sets it to 0
  and `:647` does `rr = choose(0, 1, 2)` purely to pick one of three flavour
  battle messages.

**Soul: plain RED throughout.** No green/purple/yellow/orange mode, no
`obj_purplecontrols`, no soul-mode switch anywhere.

---

## 7. What the studio will need to special-case

Ordered roughly by how soon each will bite.

1. **Draw-event attacks.** `obj_attack_green_cookingtime` has **no Step event** —
   its entire attack is in `Draw_0`. `obj_attack_orange_superattack_Step_0.gml` is
   literally `exit;` with all 301 lines in `Draw_0`. `obj_green_egg_heal` and
   `obj_healing_egg` are Create + Draw only. The engine must run Draw **exactly
   once per frame, in step order**, for these — an invisible-object Draw skip, a
   batched Draw at a different cadence, or a missed Draw on the spawn frame all
   mean the attack simply does not happen.

2. **The healing-egg box trap** (§4). Seed
   `global.monsterhp[i] = global.monstermaxhp[i] = 2060`,
   `global.monsterat[i] = 16`, `global.mercymod[i] = 0`, `global.monster[i] = 1`,
   plus `myself` / `mytarget` on both enemy instances, before replaying anything.

3. **Damage routes through the controller's user events.**
   `obj_orange_glove_Other_15.gml` and `obj_glove_manager_Other_15.gml` do
   `if (active == 1) with (obj_orange_green_controller) event_user(0);`;
   `obj_omega_pan_fire_Other_15.gml` and `obj_bullet_orange_debris_Other_15.gml`
   call `event_user(1)`. `Other_10` / `Other_11` then run
   `with (obj_orange_enemy) { ... }` and hit **all three living heroes on one
   invulnerability window**, scaled by the party's collective HP fraction:

   | | < 0.5 | ≥ 0.5 | ≥ 0.8 |
   |---|---|---|---|
   | gloves (`Other_10`) | 46 | 70 | 90 |
   | pan-fire / debris (`Other_11`) | 35 | 55 | 70 |

   Without those two events wired, every glove and every flame silently falls back
   to *one* random hero at the bullet's own `monsterat * 5 = 80` — wrong number,
   wrong count. Both handlers need `obj_orange_enemy` with writable `target`,
   `myself` and `remdamage`, and they clobber `global.inv` (−1 per hero, restored
   to `global.invc * 40`).

4. **Turn length is not sliceable** — §4. The 90-frame floor is wrong for all
   four attacks: at 90, Cooking Time terminates a third of the way in, and
   Orange's uppercut loop (`running = global.turntimer >= 64`) retreats on its
   very first cycle.

5. **`obj_dbulletcontroller` defaults to type 132.**
   `obj_dbulletcontroller_Create_0.gml:1` is `type = 132;` — *this fight's Orange
   finale*. A controller spawned without an explicit type fires the OMEGA-3 SUPER
   ATTACK. `:25` also defaults `difficulty = 0`, which is what makes the type-314
   branch's `if (difficulty == 0) difficulty = 9;` live for a manual spawn even
   though the real dispatcher pins 8.

6. **Raw numeric object id.** `obj_dbulletcontroller_Step_0.gml:3581` is
   `orange = 402;` and `:3586` reads `bspr = orange.sprite_index;`. The transpiler
   must resolve integer *object* ids the way it already resolves integer sprite
   ids.

7. **`enum e__VW` is declared at the bottom** of
   `obj_orange_green_controller_Step_0.gml` (`:1656-1675`) while `boxBlock` uses
   `__view_get(e__VW.XView, 0)` at `:521` — same hoisting requirement as the
   Knight and Jevil slices. Both enemy Steps carry the same trailing enum.

8. **The attack mutates the box.** Type 132 lerps
   `obj_growtangle.image_xscale` to 3; type 307 rewrites `sprite_index` **and**
   `mask_index` to `spr_battlebg_round`. A studio that re-derives the box each
   frame from `maxxscale` will fight both. Regular turns are 1.5 × 2; finale turns
   are 2 × 2.

9. **Non-`obj_bulletparent` attack state.** `obj_bullet_healing` (`:695`),
   `obj_attack_green_cookingtime` (`:226`) and `obj_omelet_marker` (`:148`) have
   **no parent at all**, so a `with (obj_bulletparent) instance_destroy()` sweep
   will not clear them. The source cleans them explicitly (controller `:694-701`,
   `obj_orange_enemy_Step_0.gml:790-791`).

10. **Turn-replacement support** for HEALING EGG — same machinery as Pink's
    dates: a turn that creates no controller, pins `global.turntimer = 999` while
    an `obj_writer` is up, then drops it to −10. A studio that always spawns a
    controller cannot represent this turn.

11. **Surfaces.** `obj_attack_orange_superattack_Draw_0.gml:1-21` renders every
    `obj_bullet_orange_debris` into a surface sized to the box interior and blits
    it clipped — the debris rain is **invisible** without surface support.
    `obj_glove_manager_CleanUp_0.gml` frees a `ring_surf`.

12. **`ds_list_shuffle`.** `obj_omega_pan_manager_Create_0.gml` shuffles its
    three-pan list and `Step_0` rotates through it with add/delete. A stub
    `ds_list` will silently make all three pans fire from the same one.

**Not needed:** no soul-mode switch, no green/purple/yellow soul, no second box,
no `obj_purplecontrols`, no minigame controller object, no phase machine beyond
the powerup ladder.

---

## 8. The omelet-catch minigame, for completeness

It is not an attack, but it is the fight, and it drives the only chooser input.

During every type-131 turn, food that falls past `obj_growtangle.y + 100` is
**punched by Orange** (`obj_orange_enemy_Step_0.gml:541-594`): he slides in from
the box's left edge, plays `spr_orange_punch_omelet`, converts the food into an
`obj_omelet_marker` trophy, and decrements `uppercut_life` (clamped at −3).

Once `uppercut_life` hits 0 or below, that turn's Cooking Time **ends early** and
becomes a scripted eat-and-power-up sequence:

| `:line` | what |
|---|---|
| 623-624 | as soon as all bullets are gone, `global.turntimer = 2` |
| 626-637 | rewrites it to **170**, sets `punchomeletcon = 2` |
| 751-756 | Orange rockets off the top of the screen |
| 766 | `healamount++` once per `obj_omelet_marker` swallowed on the way up |
| 794-817 | lands on his start position, dust, `scr_shakescreen()`, `global.turntimer = 30` |
| 819-845 | at `global.turntimer == 5`, heals himself `healamount` HP with an `obj_healanim` and a lime `obj_dmgwriter` |

**The next enemy turn is the type-314 uppercut**, after which `uppercut_life`
resets to 5 and the loop restarts.
