# Aqua & Seth (ch5) — the REAL roster, derived from the choosers

**9 real attacks across 2 enemy objects. 4 unreachable dispatcher entries.**
The fight is a fully scripted 7-turn ladder with **no random attack selection
anywhere** — every branch is decided by the turn index, by whether the previous
attack connected, or by a flag carried in from an earlier fight.

All paths below are relative to
`C:/Users/lando/Desktop/DELTARUNE - GML/DELTARUNE Chapter 5 - GML/`.

---

## 1. Which objects are actually in the fight

Seth is **`obj_purple_enemy`**. There is no `obj_seth_enemy`.
`DELTARUNE Chapter 5 - REFDATA/objects.tsv`:

```
obj_purple_enemy    spr_seth_battle          obj_monsterparent
obj_aqua_enemy      spr_enemy_aqua_idle      obj_monsterparent
```

The starting leads `obj_seth_shi_controller` and `obj_seth_shinobeetle_controller`
are Seth **cameos in unrelated encounters** (both are plain `spr_seth_idle`
objects with no `obj_monsterparent` parent) and are not part of this fight.
`obj_dw_cliff_sethaqua_battle` is the overworld trigger, not a combatant.

`gml_GlobalScript_scr_encountersetup.gml:852-863` — encounter 223:

```
case 223:
    global.monsterinstancetype[0] = obj_purple_enemy;   // monstertype 117 — Seth
    global.monstermakex[0] = xx + 480;
    global.monstermakey[0] = yy + 110;
    global.monsterinstancetype[1] = obj_aqua_enemy;     // monstertype 112 — Aqua
    global.monstermakex[1] = xx + 500;
    global.monstermakey[1] = yy + 200;
    global.battlemsg[0] = "* Aqua brings the sword!&* Seth brings the pen!";
```

Entered from exactly one place — `gml_Object_obj_dw_cliff_sethaqua_battle_Step_0.gml:327`,
`scr_battle(223, 3, seth_marker, aqua_marker, 0);`.

**Seth is monster slot 0 and he drives the whole fight.** Aqua is slot 1.

### `fight_type` — what values exist

| object | value | set at | meaning |
|---|---|---|---|
| `obj_aqua_enemy` | `"solo"` | `Create_0.gml:14` (default) | encounter 220, Aqua alone |
| `obj_aqua_enemy` | `"seth"` | `Other_22.gml:13`, guarded by `if (global.encounterno == 223)` at `:8` | **this fight** |
| `obj_aqua_enemy` | `"none its over lmao"` | `Step_0.gml:5` | solo fight's scripted outro only |
| `obj_purple_enemy` | `"aqua"` | `Create_0.gml:18` (default, never reassigned) | Seth has one mode |

So Aqua has **two real fights**. Encounter 220 (solo) is entered from
`gml_Object_obj_dw_garden_aqua_Step_0.gml:570`, `scr_battle(220, 3, aquacopy)`.
Everything under `if (fight_type == "solo")` is live code for *that* fight and
dead code for *this* one.

---

## 2. The two dispatchers

Both monsters run their own `if (rtimer == 12)` dispatcher inside their own
`if (scr_isphase("bullets") && attacked == 0)` block, and **both can fire in the
same bullet phase**.

**Aqua** — `gml_Object_obj_aqua_enemy_Step_0.gml:474-541`, the
`else if (fight_type == "seth")` arm:

| choice | name | type | `scr_turntimer` | line |
|---|---|---|---|---|
| 0 | KnifeChain | 308 | **260 if `turns == 4`, else 240** | 478-488 |
| 1 | FanOfKnives | 309 | 240 | 490-496 |
| 2 | KnifePetal | 310 | 240 | 498-504 |
| 3 | OmegaKnife | 300 | 245 | 506-512 |
| 4 | Everything | 311 | 244 | 514-520 |
| 5 | Duck | 312 | 180 | 522-528 |

**Seth** — `gml_Object_obj_purple_enemy_Step_0.gml:1224-1246`:

| choice | name | type | `scr_turntimer` | line |
|---|---|---|---|---|
| 0 | SupportFire | 313 | *(none — inherits Aqua's)* | 1224-1229 |
| 1 | OmegaBook | 306 | 300 | 1231-1237 |
| 2 | OmegaBookEx | 306 + `dc.omega_ex_mode = true` | 480 | 1239-1246 |

`myattackchoice == -1` means **Seth does not attack this turn** — no branch
matches, but `turns++` at `:1248` still runs, so his counter stays in lockstep.

---

## 3. The choosers

Both live in `Other_11` (user event 1), and **both are called from Seth's
enemytalk block**, Aqua first:

`gml_Object_obj_purple_enemy_Step_0.gml:696-709`:

```
if (scr_isphase("enemytalk") && talked == 0)
{
    scr_randomtarget();
    setbattlemsg = false;

    with (obj_aqua_enemy)
    {
        event_user(1);
        talked = 0;
    }

    event_user(1);
    myattackpriority = 0;
    scr_attackpriority(myattackpriority - 1);
```

Aqua's own Step **never** calls her chooser in this fight —
`gml_Object_obj_aqua_enemy_Step_0.gml:59-62` routes to `talked = 2` unless
`fight_type == "solo"`. The ordering matters: Seth's chooser reads Aqua's
*current-turn* choice, which is only committed because line 703 runs before 707.

### Aqua's chooser — `gml_Object_obj_aqua_enemy_Other_11.gml:28-86`

```
else if (fight_type == "seth")
{
    if (turns == 0)
    {
        switch (global.flag[1313])
        {
            case 0: myattackchoice = 4; break;
            case 1: myattackchoice = 0; break;
            case 2: myattackchoice = 1; break;
            case 3: myattackchoice = 2; break;
            case 4: myattackchoice = 3; break;
        }
    }

    if (turns == 1 && !phasehit)
    {
        if (myattackchoice != 1)
            myattackchoice = 1;
        else
            myattackchoice = 2;
    }

    if (turns == 2)
    {
        previous_attack = myattackchoice;
        myattackchoice = 5;
    }

    if (turns == 3)
    {
        if (!phasehit)
            myattackchoice = previous_attack;
        else
            myattackchoice = 5;
    }

    if (turns == 4)
        myattackchoice = 0;

    with (obj_purple_enemy)
        duck_hit = other.phasehit;

    phasehit = false;
    talked = 2;
}
```

Three things to notice.

1. **There is no `else`.** Every arm is a bare `if (turns == N)`, and
   `myattackchoice` persists across turns. On turn 1 the reroll is guarded by
   `!phasehit` — so **if turn 0's attack connected, turn 0's attack fires
   again**. Same on turn 3. This is why choices 0, 3 and 4 are reachable on
   more than one turn.
2. `previous_attack` is captured on turn 2 *before* the overwrite, so it holds
   **turn 1's** choice, which turn 3 restores.
3. `phasehit` is cleared at `:84` every time the chooser runs, so it always
   means "did my attack land **last turn**".

### Seth's chooser — `gml_Object_obj_purple_enemy_Other_11.gml:1-20`

```
if (fight_type == "aqua")
{
    myattackchoice = -1;
    var duck = false;

    with (obj_aqua_enemy)
    {
        if (myattackchoice == 5)
            duck = true;
    }

    if (turns > 0 && turns < 4 && !duck)
        myattackchoice = 0;

    if (turns == 5)
        myattackchoice = 1;

    if (turns == 6)
        myattackchoice = 2;
}
```

Seth resets to `-1` first, so his default is **silence**. He only supports Aqua
on turns 1-3, and only when she is not doing the duck bit.

### Where `phasehit` comes from

Set true by Aqua's bullet objects on contact, never by Seth's:

```
obj_bullet_knife_Other_15.gml:56          phasehit = true;
obj_omega_knife_Other_15.gml:21           phasehit = true;
obj_attack_knifefan_bullet_Other_15.gml:40  phasehit = true;
obj_aquabullet_Other_15.gml:46            phasehit = true;
```

### `global.flag[1313]` — the cross-fight input

Written by Aqua's `evaluate()` in the **solo** fight,
`gml_Object_obj_aqua_enemy_Create_0.gml:56-69`:

```
evaluate = function()
{
    if (attack_omega_hits == 0 && attack_fan_hits == 0 && attack_chain_hits == 0 && attack_petal_hits == 0)
        exit;

    if (attack_omega_hits >= attack_fan_hits && ...)  global.flag[1313] = 4;
    else if (attack_chain_hits >= ...)                global.flag[1313] = 1;
    else if (attack_fan_hits >= attack_petal_hits)    global.flag[1313] = 2;
    else                                              global.flag[1313] = 3;
};
```

It is zeroed on entry to the solo fight (`Other_22.gml:5-6`,
`if (global.encounterno == 220) global.flag[1313] = 0;`) and the `exit` at the
top means **flag 0 survives if the player was never hit**. Seth's intro
acknowledges exactly that case — `obj_purple_enemy_Step_0.gml:755`,
`if (global.flag[1313] == 0)` plays *"You didn't take ANY DAMAGE!?"* — and
flag 0 is the only route to the paired-exclusive **Everything**.

So: **the attack Seth opens with is whichever of Aqua's four attacks hit you
most in the earlier solo fight.**

---

## 4. The derived ladder

| turn | Aqua | Seth | notes |
|---|---|---|---|
| 0 | flag-driven: `{0,1,2,3,4} -> {4,0,1,2,3}` | — | `noreturn` forced (`aqua Step_0:530-534`) |
| 1 | **hit?** repeat turn 0 · **miss?** 1, or 2 if turn 0 was 1 | **0** SupportFire | `noreturn` forced |
| 2 | **5** Duck (always) | — (duck) | `previous_attack :=` turn 1 |
| 3 | **hit?** 5 Duck again · **miss?** `previous_attack` | 0 SupportFire, unless Aqua ducks | |
| 4 | **0** KnifeChain (always, 260f) | — | rope setpiece; Aqua leaves after |
| 5 | *removed* | **1** OmegaBook | Seth solo |
| 6 | — | **2** OmegaBookEx | last attack |
| 7 | — | — | `case 7:` retreat -> `scr_wincombat` |

Reachability, therefore: Aqua **0,1,2,3,4,5 all reachable**, Seth **0,1,2 all
reachable**. Nothing in either paired dispatcher is dead.

Seth's post-turn commentary switch (`obj_purple_enemy_Step_0.gml:18`,
`switch (turns)` under `global.mnfight == 2 && global.turntimer <= -15`) has
arms `1,2,3,4,5,7` — **no `case 6`**, which is consistent: turn 6's reaction is
delivered as a start-of-turn speech at `:922-947` instead, and `case 7` is the
ending.

---

## 5. Cut / unreachable in this fight

The four entries in the `fight_type == "solo"` arm,
`gml_Object_obj_aqua_enemy_Step_0.gml:391-473`:

| choice | name | type | line | why unreachable in enc. 223 |
|---|---|---|---|---|
| 0 | KnifeChain | 308 | 395-401 | arm guarded by `if (fight_type == "solo")` at `:391`; `Other_22:8-13` sets `"seth"` for encounter 223 |
| 1 | FanOfKnives | 309 | 403-409 | same |
| 2 | KnifePetal | 310 | 411-417 | same |
| 3 | OmegaKnife | 300 | 419-425 | same |

**These are not cut content.** They are the real solo Aqua fight (encounter
220). They are listed because the generator's announcement scan over
`gml_Object_obj_aqua_enemy_*` emits **ten** entries whose first four carry the
*same* `(name, choice, type)` triples as the paired ones. Verified by replaying
`attackAnnouncements` against the real file:

```
0  KnifeChain   choice 0  type 308   <- SOLO
1  FanOfKnives  choice 1  type 309   <- SOLO
2  KnifePetal   choice 2  type 310   <- SOLO
3  OmegaKnife   choice 3  type 300   <- SOLO
4  KnifeChain   choice 0  type 308   <- this fight
5  FanOfKnives  choice 1  type 309   <- this fight
6  KnifePetal   choice 2  type 310   <- this fight
7  OmegaKnife   choice 3  type 300   <- this fight
8  Everything   choice 4  type 311   <- this fight
9  Duck         choice 5  type 312   <- this fight
```

**Take the second occurrence of choices 0/1/2/3.** The pairs are not
interchangeable:

- **OmegaKnife** solo sets `scr_turntimer(300)` and then the controller
  overrides it to `global.turntimer = 480`
  (`gml_Object_obj_dbulletcontroller_Step_0.gml:3336-3338`) — a branch
  explicitly gated on `fight_type == "solo"`. Paired runs at **245**.
- **FanOfKnives** paired sets `knife_number = 3` (`:3512-3513`), solo does not.
- **KnifePetal** paired sets `knife_number = 6` (`:3526-3527`), solo does not.
- **KnifeChain** paired uses `knife_setup(..., 60, 6, 0.35)`, solo uses
  `(..., 50, 8, 0.35)` (`:3473-3484`).

---

## 6. What each attack actually spawns

`gml_Object_obj_dbulletcontroller_Step_0.gml`:

- **300 OmegaKnife** (`:3330-3374`) — 6x6 grid of `obj_omega_knife` on a 100px
  pitch centred on `obj_growtangle`, `spr_stolen_knife`, scale 1.65, spin -3,
  direction 315 speed 4; the centre knife (`t70a == 2 && t70b == 2`) is
  `looplocked`. Every 60 frames all knives lerp `direction` by `choose(-45, 45)`.
- **306 OmegaBook / OmegaBookEx** (`:3436-3453`) — `obj_omega_book_manager` at
  the growtangle centre, `damage = floor(damage * 1.25) + 15`. The Ex variant is
  detected with `variable_instance_exists(id, "omega_ex_mode")` and then
  `angle_speed_goal *= 4`, `angle_speed_change *= 2`, `scroll_speed_goal *= 2`.
- **308 KnifeChain** (`:3465-3486`) — **two** `obj_attack_knifechain_manager2`,
  directions 145 and 215.
- **309 FanOfKnives** (`:3488-3516`) — `obj_attack_knifefan_manager`. The
  `obj_netskie_enemy` arm at `:3494` belongs to a different encounter.
- **310 KnifePetal** (`:3518-3529`) — `obj_attack_knife_leafling`.
- **311 Everything** (`:3531-3539`) — `obj_attack_knife_everything`.
- **312 Duck** (`:3541-3554`) — a single `obj_thrash_duck_bullet` at btimer 119,
  `damage = 1`, speed 2, direction 180, `snd_pombark`. Deliberately trivial;
  that is the joke.
- **313 SupportFire** (`:3556-3565`) — `obj_purple_aim_attack` at
  `scr_get_box(0) + 75, scr_get_box(5)`, `damage = floor(damage * 1.25)`.

---

## 7. The box block, and why the owner changes

Aqua's, `gml_Object_obj_aqua_enemy_Step_0.gml:368-379` (ungated):

```
if (!instance_exists(obj_growtangle))
    instance_create(__view_get(e__VW.XView, 0) + 320, __view_get(e__VW.YView, 0) + 170, obj_growtangle);

if (myattackchoice == 3)
{
    with (obj_growtangle)
    {
        maxxscale = 3;
        maxyscale = 3;
    }
}
```

Seth's, `gml_Object_obj_purple_enemy_Step_0.gml:1201-1214`, is the same
320/170 growtangle **without** the resize, and it is gated:

```
if (global.mnfight == 1.5)
{
    if (scr_attackpriority(myattackpriority))
    {
```

`scr_attackpriority(arg0)` returns true **only** if
`obj_battlecontroller.attackpriority < arg0`, and then raises it
(`gml_GlobalScript_scr_attackpriority.gml:5-8`). The counter resets to `-1`
every turn (`scr_endturn.gml:114`, `scr_mnendturn.gml:28`). So:

- **Turns 0-4.** Aqua claims it during enemytalk —
  `aqua Step_0:64-65`, `myattackpriority = 1; scr_attackpriority(0);` — raising
  it to 0. Seth then calls `scr_attackpriority(-1)` (`:709`, no-op) and later
  `scr_attackpriority(0)` (`:1203`), which is `0 < 0` -> **false**. Seth's block
  never runs; **Aqua's ungated block does all the work**, including the
  OmegaKnife resize.
- **Turns 5-6.** Aqua has been removed, so her Step exits at
  `if (global.monster[myself] == 1)` (`Step_0:1`) and nothing claims priority.
  Seth's `scr_attackpriority(0)` is now `-1 < 0` -> **true**, and he creates the
  box.

Both anchors verified by replaying `extractBoxBlock` / `extractTurnBlock` from
`scripts/gen_attacks.js` against the real files. `turnBlock` uses
`anchor: "scr_turntimer(90);"` + `endAnchor: "}"`, which slices to exactly
`scr_turntimer(90);` — the same shape already used by `yellow_blue.json`.
Note that `strip()` blanks string literals, so **anchors must not contain
string literals**; none of these do.

---

## 8. Turn 4 — the rope setpiece

Aqua's forced turn-4 KnifeChain **hits Seth**.
`gml_Object_obj_attack_knifechain_manager2_Alarm_1.gml:4-63` makes him jump
(`scr_lerpvar("y", ...)`, `spr_seth_shadow`) and shout a seven-line panic
sequence indexed by `rope_counter`:

```
seth_panic[0] = "A-Aqua--"      seth_panic[4] = "WE'RE ON THE--"
seth_panic[1] = "What are--"    seth_panic[5] = "SAME TEAM--!!"
seth_panic[2] = "You're--"      seth_panic[6] = "QUIT IT!!!"
seth_panic[3] = "Supposed to--"
```

with the writer forced open — `disablebutton1 = true; disablebutton2 = true;
preventcskip = true;` (`:56-60`). Both alarms bail on
`if (global.turntimer <= 5) exit;` (`Alarm_1:1-2`, `Alarm_2:1-2`) and `Alarm_2:6-7`
stops once `rope_counter == 6`. This is the only place in the fight where
dialogue runs **during** a bullet phase.

It pays off immediately: Seth's `case 5:` arm (`obj_purple_enemy_Step_0.gml:316-445`)
sends Aqua spinning off-screen with a petal shower and calls

```
with (obj_aqua_enemy)
    scr_monsterdefeat();
```

at `:437-438` — *"... fine! She was only holding me back anyway!"*

---

## 9. ACTs, mercy, and the HP gates

Encounter 223 replaces Aqua's six solo ACTs with three party-wide ones —
`Other_22.gml:16-24` sets **SpinX / PoseX / DanceX**, each `"20%#Mercy"`, plus
`S-Action` / `R-Action` simul acts at `:29-34`. ACT 4 and 5 are disabled
(`global.canact[myself][4] = false`, `:25-28`).

**Seth counters every ACT after the first.** `aqua Step_0:739-763`: mercy is
granted only while `seth_counter == 0`; from then on
*"But, Seth countered!"* and, at `:900-912`, *"The MERCY was taken back!!"*
with `snd_mercyremove` and the damage writer reversed. `seth_counter++` at
`:963`. **The fight cannot be spared to completion.**

Both monsters clamp at 10% max HP and set `violence_end`
(`aqua Create_0:87-94`, `purple Create_0:56-62`), routing to the two alternate
endings at `purple Step_0:949-1116` (Seth downed) and `:1118-1193` (Aqua
downed), each ending in `scr_wincombat()`. Both set `global.flag[1906] = -1`.

---

## 10. What the studio will need to special-case

1. **Two live `obj_dbulletcontroller` instances** on turns 1 and 3, each with
   its own `btimer` / `made` / `type`. A single-controller harness silently
   drops Seth's SupportFire.
2. **Two enemy objects** with independent `turns`, both stepping, plus the
   cross-reads Seth->Aqua (`purple Other_11:6-10`, `purple Step_0:796-812`) and
   Aqua->Seth (`aqua Other_11:81-82`). Aqua's `turns` must be readable by the
   controller (`dbulletcontroller:3473`) and **already incremented** when the
   controller first steps — that off-by-one is what makes turn 4's KnifeChain
   use the wide `knife_setup`.
3. **Chooser order Aqua-then-Seth**, both driven from Seth's enemytalk
   (`purple Step_0:701-707`). Reversing it breaks the duck test.
4. **`global.flag[1313]` as a selectable input (0-4)** to reach all five turn-0
   openers, and **`phasehit`** wired to real collisions or turns 1 and 3 will
   not branch.
5. **Mid-fight monster removal** — `scr_monsterdefeat` on Aqua at turn 5 must
   stop her Step, free `attackpriority`, and hand the box to Seth.
6. **Duplicate announcement keys** — ten entries for `obj_aqua_enemy`, four of
   them the solo fight. Disambiguate by source offset or by `fight_type`.
7. **`omega_ex_mode`** honoured by `obj_omega_book_manager`.
8. **Per-attack turn length**, not a floor: 180 (Duck) to 480 (OmegaBookEx)
   over a base of 90, with KnifeChain turn-dependent (260 on turn 4, else 240).
9. **Dialogue during a bullet phase** with input suppression, for turn 4 only.
10. **Not needed:** alternate soul modes, minigame boards, custom heart
    controllers. Grepping both Steps and every attack manager for
    `soulmode` / `obj_purplecontrols` / `greensoul` / `purpleheart` returns
    nothing — this fight is plain red soul from start to finish.

**Confidence: high.** Every claim above is a direct read of the chooser,
dispatcher or controller source, and both proposed anchors were verified by
replaying `gen_attacks.js`'s own extraction functions against the real files.
