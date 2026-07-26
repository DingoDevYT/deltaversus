# Tasque Manager (ch2) — the REAL roster, derived from the chooser

**5 real attack entries across 2 encounters and 2 enemy objects. 3 cut entries.**
This fight is the only one documented so far whose attack selection is driven by
the PLAYER rather than by a turn ladder, an HP gate or a random roll — and the
only one with a **second shipped encounter** (a post-recruitment dojo challenge)
that re-skins one of its attacks into a scored, losable minigame.

All paths below are relative to
`C:/Users/lando/Desktop/DELTARUNE - GML/DELTARUNE Chapter 2 - GML/`.
Every line number was read out of the file, not inferred.

> **Correction note.** An earlier pass at this roster filed the encounter-89
> dojo quiz as *cut*, reasoning that the chapter contains no literal
> `scr_battle(89`. That reasoning was wrong: the chapter has **two non-literal
> `scr_battle` call sites**, and one of them is the dojo menu. Encounter 89
> ships. §5 below is the corrected derivation, and it is worth reading as a
> method warning — "no literal call" is not the same as "unreachable".

---

## 1. Which objects are actually in the fight

`obj_tasque_manager_enemy` appears in exactly two encounters, and **both are
real**. `obj_tasque_enemy` appears in eight.

### 1a. Encounter 57 — the story fight

`gml_GlobalScript_scr_encountersetup.gml:559-573`:

```
case 57:
    global.monsterinstancetype[0] = obj_tasque_enemy;          // monstertype 32
    global.monsterinstancetype[1] = obj_tasque_manager_enemy;  // monstertype 42
    global.monsterinstancetype[2] = obj_tasque_enemy;          // monstertype 32
    global.battlemsg[0] = "* Tasque Manager blocks the way!";
```

Entered from exactly one place —
`gml_Object_obj_npc_tasquemanager_Step_0.gml:23`, `scr_battle(57, 0, marker2, id, 0)`.

**Three monsters.** Each takes its own turn and spawns its own
`obj_dbulletcontroller`, so up to three controllers can be live in one bullet
phase. `obj_dbulletcontroller_Create_0.gml:12-18` sets `ratio = 2.3` at three
monsters (1.6 at two, 1 at one) and every Tasque bullet timer is multiplied by it.

### 1b. Encounter 89 — the dojo challenge "Tasque Manager Says"

`gml_GlobalScript_scr_encountersetup.gml:1005-1019` — a **solo** Manager with
custom hero positions and `monstertype[1] = monstertype[2] = 0`. Reached from the
Castle Town dojo menu, `gml_Object_obj_fusionmenu_Step_0.gml:637-642`:

```
global.ambush     = dojoEncounterAmbush[menuCoord[0]];
global.encounterno = dojoEncounter[menuCoord[0]];
global.flag[35] = 1;  global.flag[37] = 1;
global.flag[38] = 1;  global.flag[61] = 1;
scr_battle(global.encounterno, 3, 0, 0, 0);
```

and `:147-157` fills slot 3 of that menu:

```
if (global.chapter == 2)
{
    tasqueRecruited = global.flag[642];

    if (tasqueRecruited == 1)
    {
        dojoName[3]       = "Tasque Manager Says";
        dojoPrizeName[3]  = "$250";
        dojoTopComment[3] = "Winning's as easy as A-B-C!#You've got three chances, boss!";
        dojoEncounter[3]  = 89;
    }
```

`global.flag[642]` **is** the Tasque Manager recruit flag: `scr_recruit.gml:5,13`
stores recruit progress in `global.flag[global.monstertype[myself] + 600]`, and
the Manager is monstertype 42 (`scr_monstersetup.gml:1157`). So the challenge
unlocks by sparing/recruiting her in encounter 57.

It is fully wired as shipped content: `dojoPrizeValue[3] = 250` /
`dojoPrizeType[3] = "money"` / `dojoFlag[3] = 812`, paid out at
`obj_npc_dojo_Step_0.gml:53-70`, greyed to "Claimed" at `fusionmenu:184-185`, and
counted by the all-dojo-complete check at `scr_text.gml:5402` and `:5426`.
The blurb "You've got three chances, boss!" is a literal description of the
3-strikes machine at `obj_dbulletcontroller_Step_0.gml:1300-1399`.

Its `battlemsg` is `"* Graze!"` — copy-pasted from the unrelated graze challenge
(encounter 72, `obj_dojograzeenemy`, `scr_encountersetup.gml:763-770`). That's a
leftover string, **not** evidence the slot is dead; the enemy overwrites
`global.battlemsg[0]` on its first turn anyway.

### 1c. Stats and cast

| | type | HP | AT | sparepoint | ACTs |
|---|---|---|---|---|---|
| Tasque | 32 (`scr_monstersetup.gml:778-827`) | 240 | 8 | 20 | Check, Petting (+100 mercy), Roar/SoftVoice or PettingX |
| Tasque Manager | 42 (`:1157-1186`) | 1367 | 10 | 5 | Check, **Order**, **OrderX** (everyone-act, `actactor 4`) |

Both are `obj_monsterparent` children (ch2 `objects.tsv`). The same object *names*
exist in ch3/ch4/ch5; everything here is the Chapter 2 copy.

`obj_tasque_enemy` also appears in encounters 52, 70, 74, 86, 87, 92 and 98
(`scr_encountersetup.gml:482, 736, 787, 958, 974, 1062, 1156`), where its
`choose(0, 1)` runs with no Manager to override it — so YarnBalls/MeowWow are
shared content, not exclusive to this fight.

---

## 2. The dispatcher

`gml_Object_obj_tasque_manager_enemy_Step_0.gml:154-181`:

```
if (rtimer == 15)
{
    if (rr == 0)
    {
        global.monsterattackname[myself] = "WhipAttack";
        dc = scr_bulletspawner(x, y, obj_dbulletcontroller);
        dc.type = 20;
        dc.element = 6;
    }
    else if (rr == 1)
    {
        lastQuizLetter = -1;
        global.monsterattackname[myself] = "QuizAttack";
        dc = scr_bulletspawner(x, y, obj_dbulletcontroller);
        dc.type = 32;
        dc.element = 6;

        if (global.encounterno == 89)   { dc.special = 1; dc.difficulty = 4; }
        else                            { dc.difficulty = quizDifficulty; }
    }
```

`gml_Object_obj_tasque_enemy_Step_0.gml:58-76`:

```
if (rtimer == 15)
{
    if (rr == 0)      { … "YarnBalls"; dc.type = 2; dc.element = 6; }
    else if (rr > 0)  { … "MeowWow";   dc.type = 3; dc.element = 6;
                        if (rr == 2) dc.difficulty = 1; }
```

Two dispatcher arms each — and the Manager's second arm is really *two* attacks
behind one `type`, split on `global.encounterno`. There is no pile of cut branches
in the LIVE events; the cut content lives in a whole duplicated event (§6a).

---

## 3. The chooser

### 3a. The Manager: the player picks the attack

`gml_Object_obj_tasque_manager_enemy_Step_0.gml:129-138` is the entire chooser:

```
if (rtimer == 0)
{
    if (overrideAttack)
        rr = 1;
    else
        rr = 0;

    if (rr == 1)
        obj_growtangle.target_angle = 45;
}
```

There is **no `choose()`, no turn index and no HP threshold**. `overrideAttack`
starts at 0 (`Create_0:33`) and is re-zeroed every single turn at `Step_0:183`.
The only writers of `overrideAttack = 1` are ACTs:

| writer | file:line | ACT |
|---|---|---|
| `overrideAttack = 1;` | `Step_0:249` | Kris `acting == 2` = **Order** — "You asked Tasque Manager to show you order. She obliges!" |
| `overrideAttack = 1;` | `Step_0:273` | `acting == 3` = **OrderX** — "Everyone asked Tasque Manager to show you order." |

(Those act indices line up with `scr_monstersetup.gml:1170-1179`: slot 0 Check,
slot 1 Order, slot 2 OrderX with `actactor = 4`.)

Both are gated on `violenceused == 0` (`Step_0:237`, `:266`) — hit a Tasque and
the ACT fails, `overrideAttack` is never set, and the Manager whips forever.

So in **encounter 57**: rr = 0 (Whip) is the default turn; rr = 1 (Quiz) happens
exactly once per successful Order ACT. Both values are real.

A third writer, `Step_0:149-150`, runs **every turn** in the dojo:

```
if (global.encounterno == 89)
    rr = 1;
```

so **encounter 89 is nothing but quizzes** — the whip never fires there.

Two decoys around this chooser must NOT be mistaken for it:

* `Step_0:36` — `rr = (scr_monsterpop() > 1) ? choose(0, 1, 2, 3) : choose(0, 1, 2);`
  is the **enemytalk dialogue** selector (Processes!/whip-it-into-shape/order-order/kitties).
  It runs in the talk phase and is overwritten by the real chooser at `rtimer == 0`.
* `Step_0:187` — `rr = choose(0, 1, 2, 3, 4);` is the **battle-message** selector,
  assigned *after* the controller has already been created. Same vestigial shape
  as Spamton NEO's trailing `rr = choose(0,1,2,3)`.

### 3b. The Tasques: `choose(0, 1)`, overridden by their boss

`gml_Object_obj_tasque_enemy_Step_0.gml:53-54`:

```
if (rtimer == 0)
    rr = choose(0, 1);
```

…and then the Manager reaches into them. `gml_Object_obj_tasque_manager_enemy_Step_0.gml:140-147`:

```
if (rtimer == 2 && scr_monsterpop() > 1)
{
    if (rr == 1)
    {
        with (obj_tasque_enemy)
            rr = (obj_tasque_manager_enemy.quizDifficulty > 1 && obj_tasque_manager_enemy.quizDifficulty != 4) ? 2 : -1;
    }
}
```

The Manager's `rtimer == 2` lands before the Tasques' `rtimer == 15` dispatch, so
this override always wins on a quiz turn. The reachable set for a Tasque is
therefore `{0, 1, 2, -1}`:

| rr | outcome | evidence |
|---|---|---|
| 0 | YarnBalls, type 2 | own `choose(0,1)`, `tasque Step_0:60-66` |
| 1 | MeowWow, type 3, difficulty 0 | own `choose(0,1)`, `tasque Step_0:67-73` |
| 2 | MeowWow, type 3, **difficulty 1** | Manager forces it when `quizDifficulty > 1`, `manager Step_0:145`; `tasque Step_0:74-75` |
| −1 | **nothing** — no dispatcher arm matches | Manager forces it on an easy quiz turn |

`rr == -1` is not a bug: it is how the game keeps the box clear while the Simon
Says quiz runs. `quizDifficulty != 4` is vestigial — `quizDifficulty` is the
boss's own field, clamped to 0..3 (§4), and this whole block is behind
`scr_monsterpop() > 1`, which the solo dojo encounter fails.

Same two decoys as the Manager: `tasque Step_0:11` is the "meowowme" dialogue
roll, `tasque Step_0:93` is the battle-message roll after dispatch.

### Real roster

| # | enemy | encounter | rr | type | name | controller |
|---|---|---|---|---|---|---|
| 1 | `obj_tasque_manager_enemy` | 57 | 0 | 20 | WhipAttack | `obj_dbulletcontroller` |
| 2 | `obj_tasque_manager_enemy` | 57 | 1 | 32 | QuizAttack (difficulty 0–3) | `obj_dbulletcontroller` |
| 3 | `obj_tasque_manager_enemy` | **89** | 1 | 32 | QuizAttack — dojo, `special = 1`, difficulty 4→6 | `obj_dbulletcontroller` |
| 4 | `obj_tasque_enemy` | 57 | 0 | 2 | YarnBalls | `obj_dbulletcontroller` |
| 5 | `obj_tasque_enemy` | 57 | 1 / 2 | 3 | MeowWow (d0 / d1) | `obj_dbulletcontroller` |

Entries 2 and 3 share `(controller, type)`, so `gen_attacks.js` will emit **one**
`tasque_manager_type32` — see Trap 1.

---

## 4. Phases — a difficulty ladder driven by player performance

There is no `phaseturn`, no HP gate and no scripted turn sequence in encounter 57.
What ramps is `quizDifficulty`.
`gml_Object_obj_tasque_manager_enemy_Step_0.gml:12-23`:

```
if (instance_exists(obj_tm_quizzler))
    simonsayscon = 1;

if (simonsayscon == 1 && !instance_exists(obj_tm_quizzler))
{
    simonsayscon = 0;

    if (hitbysimonsaysattackcount < 2 && quizDifficulty < 3)
        quizDifficulty++;

    hitbysimonsaysattackcount = 0;
}
```

`hitbysimonsaysattackcount` is incremented by the two things that can hit you
during a quiz — `obj_tm_quizzap_Other_15.gml:3-7` (the wrong-quadrant zaps) and
`obj_tasque_soundwave_Other_15.gml:3-4` (a Tasque's meow landing on top of the
quiz). Take fewer than two hits and the next quiz is a notch harder. The clamp
is `< 3`, so **the story range is quizDifficulty 0, 1, 2, 3**.

Consequences that cascade:

* `dc.difficulty = quizDifficulty` (`Step_0:178`) → `obj_tm_quizzler.difficulty`
  (`obj_dbulletcontroller_Step_0.gml:1285`) → round pace
  `attacktimer = 90 / 60 / 60 / 40` for difficulty 0/1/2/3
  (`obj_dbulletcontroller_Step_0.gml:1291-1294`) and zap window
  `20 / 15 / 15 / 20` (`obj_tm_quizzler_Step_1.gml:148-153`).
* `obj_tm_quizzler_Step_1.gml:17-21` — `if (difficulty >= 4) { turnspeed = 40 - ((difficulty - 4) * 5); turns = difficulty - 3; }`
  — is the **dojo's** branch, not dead code. The dojo starts at 4 and increments
  per phase, so rounds go 1 → 2 → 3 letters. The `difficulty == 5` and
  `difficulty == 4` arms immediately below it (`:22-31`) *are* genuinely dead in
  every case: the `>= 4` test above them shadows both.
* Once `quizDifficulty > 1`, the Tasques stop sitting out quiz turns and start
  layering MeowWow d1 on top (`Step_0:145`).

The other two "difficulty" sources are population-based, not phase-based:

* `obj_dbulletcontroller_Step_0.gml:862` — `d.difficulty = scr_monsterpop() == 1;`
  The whip only reaches difficulty 1 (8 bullets at 45° with drift instead of 4 at
  90°, `obj_tm_whip_animation_Step_0.gml:86-95`) once the Manager is the **last
  monster standing**.
* `obj_dbulletcontroller_Create_0.gml:12-18` — `ratio` 2.3 / 1.6 / 1 by population.

Finally, a pre-fight mercy gate: `Step_0:1-10` reads `global.flag[419]`
(`scr_text.gml:6057` = 1 for the right painting answer, `:6067` = 2 for the near
miss) and starts the Manager at `mercymod` 100 or 50 — i.e. the overworld quiz
can make her instantly spareable. Sparing her also spares both Tasques
(`Other_20:1-2`); sparing a Tasque feeds her +35 (`obj_tasque_enemy_Other_20.gml:6-9`);
Petting a Tasque is a flat +100 (`tasque Step_0:141-142`).

---

## 5. The dojo variant (encounter 89) in detail

Same `type 32` branch, `special = 1`, `difficulty = 4`. What that unlocks inside
`obj_dbulletcontroller_Step_0.gml`:

* `:1244-1245` `if (special == 1) global.turntimer = 5400;` — a 3-minute turn.
  (`manager Step_0:215-216` also runs `scr_turntimer(99999)` in this encounter;
  the flat 5400 assignment overwrites it, because `scr_turntimer` only raises.)
* `:1401-1416` is the round loop. With `special == 1` the `made++` at `:1404`
  fires, so `made` climbs 1 → 4.
* `:1298` `if ((made == 4 || special < -2) …)` then opens the scoring machine at
  `:1300-1399`. **Three phases of four rounds:**
  * pass (`special == -2`, `:1305-1329`) → `spr_tm_maru` tally mark, a big
    `spr_tm_maru_big` `obj_tm_quiz_result`, `difficulty++`, `phase++`.
  * hit → `obj_tm_quizzler_Step_1.gml:3-7`
    (`global.encounterno == 89 && global.inv > 0 && hit == 0`) sets
    `controller.special = -4`, which routes `:1367` → `:1372-1398`: a
    `spr_tm_batsu` mark and `strikes++`.
  * `:1343-1351` `if (strikes == 3)` → `global.flag[36] = 1; global.flag[39] = 1;`
    and the Manager slides offscreen.
  * `:1353-1360` `if (phase == 3)` → `special = -5; global.flag[39] = 1;` —
    the win (note: **no** `flag[36]`).

That flag pair is a **dojo loss**, not a game over. `global.flag[39]` ends the
battle (`scr_mnendturn.gml:17`; cleared by `obj_battlecontroller_Create_0.gml:266`
and `obj_npc_dojo_Step_0.gml:130`), and `global.flag[36]` is exactly what makes
`obj_npc_dojo_Step_0.gml:51` skip the $250 payout. `scr_gameover.gml:29-33` does
the same substitution for an actual death, gated on the `global.flag[35] = 1` the
dojo menu set at `fusionmenu:638`.

In **encounter 57** none of this runs: `special` stays 0
(`obj_dbulletcontroller_Create_0.gml:23`), `made` is set to 1 at `:1278` and never
increments, `made == 4` is never true, and the quiz just loops single-letter
rounds until the 260-frame turn expires. `d.dojo = special < -2` (`:1282`) is
false in both encounters at spawn; only the `:1414-1415` respawn sets it.

---

## 6. The cut list

### 6a. `Other_24` — a whole dead copy of the Step event (RisingDiamonds, type 1)

`gml_Object_obj_tasque_manager_enemy_Other_24.gml` is user event 14 and is
368 lines of near-duplicate Step code. **Nothing in Chapter 2 invokes it.**
Counting every `event_user(N)` call in the chapter gives
N ∈ {0,1,2,3,4,5,6,7,8,9,10,11,12,15} — **13 and 14 have no caller at all.**
The only high ones are `scr_monsterdefeat.gml:94` (`event_user(11)`),
`scr_monster_makeinstance.gml:12/15` (`event_user(12)` and `event_user(15)`,
the two the battle system fires on every monster instance) and
`scr_spare.gml:4` (`event_user(10)`). The single `event_perform` in the chapter
is `obj_teacup_Step_0.gml:409`, `ev_other, ev_user0`.

`Other_24` is recognisably the OLDER draft:

| | live `Step_0` | dead `Other_24` |
|---|---|---|
| chooser | `:131-134` `overrideAttack ? 1 : 0` | `:102-105` `overrideAttack ? 2 : (rr == 3 ? 3 : 0)` |
| rr 0 | WhipAttack type 20 **+ element 6** | WhipAttack type 20, no element |
| rr 1 | QuizAttack type 32 (+ the encounter-89 split) | **RisingDiamonds type 1** |
| rr 2 | — | QuizAttack type 32, no encounter-89 split |
| rr 3 | — | *no arm at all* — silent turn |

`rr = (rr == 3) ? 3 : 0;` at `Other_24:105` lets the "Kitties!!" dialogue value 3
leak out of the talk phase into the attack phase, where no branch matches it.
That dead-ends into a turn with no attack — the kind of thing you fix by
rewriting the event, which is what happened. The dojo split is absent entirely,
which dates `Other_24` to before the dojo challenge existed.

**`RisingDiamonds` (type 1) is cut.** Its only other writer in the chapter is
`gml_Object_obj_baseenemy_Step_0.gml:72`, the generic template enemy. That enemy
*is* placed — but only in encounters **1** and **99**, both of them
`"* Test enemies showed up."` slots (`scr_encountersetup.gml:35-45`, `:1166-1181`).
Neither is reachable. Checking **all three** ways an encounter number can be set
this time:

* literal calls — `scr_battle(51/54/57/59/60/61/62/66/79/82/83/84/88/101/102)`;
* `obj_fusionmenu_Step_0.gml:637` — can only pass `dojoEncounter` ∈ {100, 72, 71, 89, 90};
* `scr_wincombat.gml:31` — `global.encounterno = global.flag[60]`, and
  `global.flag[60]` is only ever written 0/91/92/93/94
  (`obj_ch2_dojo_allstarsPlaylist_Step_0.gml:1-17`, `obj_npc_dojo_Step_0.gml:131`)
  — the All Stars chain.

### 6b. `type 35` — an orphan quiz controller

`obj_dbulletcontroller_Step_0.gml:1451-1494` builds the same `spr_tm_grid`
diamond, the same four `spr_tm_letters` markers and an `obj_tm_quizzler`, but
with `global.turntimer = 3600`, `difficulty = 0` forced and `d.dojo = true`
hard-coded (`:1489`) — an earlier standalone take on the dojo quiz that skips the
`special` handshake the shipped encounter-89 path uses. Grepping all of Chapter 2
for `type = 35` / `.type = 35` returns **nothing** — no object dispatches it. It
carries no `global.monsterattackname`, so `gen_attacks.js` will not emit it as a
roster entry; it is recorded here only so nobody rediscovers it and assumes it plays.

### 6c. Three orphan draft objects

`obj_tm_quizzler_old`, `obj_tm_whip_animation_old`, `obj_tm_whip_attack_backup`.
Grepping every `.gml` in the chapter for these three names finds references only
inside their own event files — no live code creates any of them. Not dispatcher
entries (no `monsterattackname`), listed so they don't get mistaken for content.

---

## 7. What each real attack actually does

**WhipAttack (type 20)** — `obj_dbulletcontroller_Step_0.gml:850-866` creates one
`obj_tm_whip_attack`, hides the Manager and sets
`d.difficulty = scr_monsterpop() == 1`. `obj_tm_whip_attack_Step_0.gml` is a
4-state loop (wind up 20 → strike 35 → zap 55 → recover 65, then reset to 5) that
runs for the whole turn, gated on `global.turntimer > 30` (`:17`) so it will not
start a swing it cannot finish. The visible whip, its warning telegraph and the
ball's hitbox are all computed in **`obj_tm_whip_animation_Draw_0.gml:84-155`** —
the bullet `obj_tm_whip` is moved from a Draw event. The zap ring comes from
`obj_tm_whip_animation_Step_0.gml:68-105`: 4 × `obj_regularbullet` at 90°
spacing (`spr_tm_zap_bullet`, `speed 0.1`, `friction -0.5`) at difficulty 0, or
8 at 45° with `rotation += (zaptimer/5) * 15 * ±1` at difficulty 1.
`attackoffset = choose(0, 45)` at Create and `+= 45` per swing, so consecutive
swings alternate the ring's phase.

**QuizAttack (type 32)** — `obj_dbulletcontroller_Step_0.gml:1235-1417`. Rotates
the box to 45° (`:1275-1276`), lays a grey `spr_tm_grid` and four `spr_tm_letters`
corner markers at ±50 px, then spawns `obj_tm_quizzler` and adds 120 frames to the
turn (`:1287`). `obj_tm_quizzler_Step_1.gml` picks `turns` letters avoiding an
immediate repeat (`:37-56`, using the Manager's `lastQuizLetter`), flashes them
one at a time as `obj_tm_quizletter` pairs (`:113-135`), then in state 1 spawns an
`obj_tm_quizzap` in every quadrant **except** the announced one
(`:155-163`, `if (i == letters[currentturn]) continue;`). Stand in the right
quadrant of the diamond or take a hit. In encounter 57 `turns` is 1, so each
quizzler does exactly one letter and then `alarm[1]` destroys it (`:169-174`,
`Alarm_1`) and the controller respawns another `attacktimer` frames later; in the
dojo `turns` walks 1 → 2 → 3 and the scoring machine of §5 runs.

**YarnBalls (type 2)** — `obj_dbulletcontroller_Step_0.gml:64-88`, every
`10 * ratio` frames spawns an `obj_yarnmaker` and calls `scr_bullet_inherit`,
with a launch angle solved by `scr_getlaunchdirection` for childgravity 0.5 and
a speed remapped from the enemy's height above the camera
(`scr_remapvalue(40, 200, y - cameray(), 8, 16)`). Every third throw
(`(made % 3) == 2`) is aimed straight at the soul. **The maker has no Step event**
— its scale-up *and* the `scr_bullet_create(x, y, obj_yarnbullet)` that produces
the real bullet both live in `obj_yarnmaker_Draw_0.gml:1-30`.

**MeowWow (type 3)** — `obj_dbulletcontroller_Step_0.gml:89-122`. Hides the
Tasque behind an `obj_tasque_meowing` animation, then every
`(difficulty >= 2 ? 40 : 24) * ratio * (1 + difficulty)` frames fires an
`obj_chainbullet` aimed at the soul with `childBullet = 456`
(= `obj_tasque_soundwave`) and `childSpeed = difficulty == 1 ? 4 : 7`. Note the
**slower** child speed at difficulty 1 — the d1 upgrade is more meows, not faster
ones. `obj_chainbullet_Step_0.gml:4-26` then emits `totalBullets = 8` children
every `firingSpeed = 2` frames. The `sameattacker` stagger at `:101-102`
desynchronises two Tasques meowing at once.

---

## 8. Generator config, and the traps in it

```json
"boxBlock":  { "file": "gml_Object_obj_tasque_manager_enemy_Step_0.gml",
               "anchor": "if (!instance_exists(obj_growtangle))" },
"turnBlock": { "file": "gml_Object_obj_tasque_manager_enemy_Step_0.gml",
               "anchor": "scr_turntimer(140);", "endAnchor": "overrideAttack = 0;" },
"extraAttackFiles": ["gml_Object_obj_tasque_enemy_Step_0.gml"]
```

All three anchor strings occur **exactly once** in the named file
(`grep -Fc` = 1 each): `if (!instance_exists(obj_growtangle))` at `:122`,
`scr_turntimer(140);` at `:182`, `overrideAttack = 0;` at `:183`. A dry run of
`extractBoxBlock` / `extractTurnBlock` / `attackAnnouncements` against this exact
config yields a **154-char box block**, a **19-char turn block**, and 7
announcements collapsing to 5 dedup'd entries (types 20, 1, 32, 2, 3).

**Why the box block stops at the `instance_create`.** The tempting extension is
to reach forward to `obj_growtangle.target_angle = 45;` at `:137`, but that slice
would have to cross `:131-134` — the chooser — and replaying it would overwrite
the roster's selection with `overrideAttack ? 1 : 0`. That is the exact trap the
Jevil note records for `event_user(5)`. It costs nothing: `type 32` sets
`target_angle` **and** `image_angle` itself at
`obj_dbulletcontroller_Step_0.gml:1275-1276`, and WhipAttack never rotates the
box. This fight also never resizes the box — grep for `maxxscale`/`maxyscale`
across every tasque/tm file and across the type 2/3/20/32 controller branches
returns nothing — so `obj_growtangle`'s default 2× (`Create_0:13-14`) is correct.

**Why the turn block is one line.** `scr_turntimer` only raises, so the
`scr_turntimer(120);` floor at `:212` is dominated by 140. The story quiz turn is
260 frames because the controller adds 120 at `:1287` — inside the replayed
controller, not here. The dojo's `scr_turntimer(99999)` at `:216` is likewise
overwritten by the controller's flat `global.turntimer = 5400`. Both Tasques call
`scr_turntimer(140)` too (`obj_tasque_enemy_Step_0.gml:78`), so one number covers
every attack.

**Trap 1 — `Other_24` wins the de-duplication, and that now costs real data.**
`readdirSync` returns `…_Other_24.gml` before `…_Step_0.gml`, so `gen_attacks.js`
keeps the DEAD copies of WhipAttack and QuizAttack and discards the live ones.
Measured on the two copies:

| copy | `extraFields` | `hasSpecial` | `difficultyLiteral` |
|---|---|---|---|
| live `Step_0` QuizAttack | `["element","special"]` | **true** | **4** |
| dead `Other_24` QuizAttack | `[]` | false | null |

Since the dojo variant is *real content* (§5), losing `special` and the literal
`4` removes the studio's only generated handle on it. The emitted `choice` fields
are also Other_24's (whip **0**, quiz **2**) with the live values surviving only
as `alsoChoices` (`[0]`, `[1]`), and `Other_24` additionally injects the cut
RisingDiamonds. An `excludeFiles` hook on the `BOSSES` entry is the fix;
`gen_attacks.js` has no such field today.

**Trap 2 — one entry, two attacks.** Even with Trap 1 fixed, the dedup key is
`(boss, controller, type)`, so the story quiz and the dojo quiz collapse into a
single `tasque_manager_type32`. The dojo version has to be reached by setting
`special = 1`, `difficulty = 4` *and* `global.encounterno = 89` (read directly by
`obj_tm_quizzler_Step_1.gml:3` and `obj_dbulletcontroller_Step_0.gml:1367, 1383`).

**Trap 3 — MeowWow's setup is nulled.** `attackAnnouncements` finds the nearest
preceding condition for the `else if (rr > 0)` arm to be `rr == 0)` (from the
YarnBalls arm above it) and then its `escaped` heuristic sees `if (rr == 2)`
inside the body, so it drops the branch and falls back to a manual spawn. Moot
here — `extraAttackFiles` entries get `setup: null` regardless — but it means
both Tasque attacks lose `dc.element = 6` and MeowWow loses `dc.difficulty = 1`,
so difficulty has to come from the studio's DIFF selector.

**Trap 4 — the story quiz always runs at difficulty 0.**
`dc.difficulty = quizDifficulty` reads boss state, and `Create_0:32` initialises
it to 0. Replaying the branch verbatim can only ever produce difficulty 0; seeing
1–3 requires writing `obj_tasque_manager_enemy.quizDifficulty` before launch.

**Trap 5 — population.** `scr_monsterpop()` sets both the whip's difficulty and
the controller's `ratio`. A single-monster studio scene reproduces the *end* of
encounter 57 (whip d1, ratio 1) — though it is the *correct* population for the
dojo encounter. A faithful story replay needs three monsters registered.

**Trap 6 — the extra file's entries are attributed to the wrong enemy.**
`gen_attacks.js` stamps `enemy: boss.enemy` on `extraAttackFiles` entries, so
YarnBalls and MeowWow will be recorded against `obj_tasque_manager_enemy`. They
belong to `obj_tasque_enemy` (hence `extraEnemies` in the JSON).

---

## 9. What the studio will need to special-case

1. **Rotated battle-box collision.** `obj_growtangle`'s parent *is*
   `obj_battlesolid` and its sprite and mask are both `spr_battlebg_0`
   (ch2 `objects.tsv:879`); the soul is confined by
   `place_meeting(x + px, y + py, obj_battlesolid)` in `obj_heart_Step_0.gml:61-80`.
   The Quiz sets `image_angle = 45` (and `obj_growtangle_Step_0.gml:46` folds
   `target_angle` into `image_angle` every frame while growing), so confinement
   must honour a rotated rectangle mask or the whole quadrant mechanic collapses.
   `obj_tm_quizzap` (parent `obj_regularbullet`, `spr_tm_gridzap`, `image_angle`
   0/90/−90/180, scaled 2×) needs the same.
2. **Assignment through an object index.** `obj_tm_quizzler_Create_0.gml:23-32`:
   `if (instance_exists(obj_tm_whip_animation)) animator = 460;` — 460 is the raw
   asset index of `obj_tm_whip_animation` (`objects.tsv` line 462; asset index =
   line − 2), and the object then writes `animator.creator`, `animator.quizmode`,
   `animator.state`, `animator.zapping`, `animator.quizloop`. This is the GML
   "write through an object index, broadcast to every instance" idiom, and it is
   taken on **every quiz round after the first**, because the destroyed quizzler
   (`Destroy_0.gml`) leaves its animator behind.
3. **`obj_tasque_soundwave` has no translated events.** MeowWow's
   `d.childBullet = 456` (`obj_dbulletcontroller_Step_0.gml:109`) is a numeric
   object reference resolved by `scr_childbullet`, so `gen_objects.js`'s
   name-based transitive closure (`gen_objects.js:95`, `/obj_[a-zA-Z0-9_]+/`)
   never reaches it. **Verified:** the object is present in
   `docs/js/gml_object_index.js` but is entirely **absent** from
   `docs/js/gml_objects.js`, while `obj_yarnmaker`, `obj_tasque_meowing`,
   `obj_chainbullet`, `obj_tm_whip_animation`, `obj_tm_quizzler` and
   `obj_tm_quizzap` are all present. Without it the meow bullets get no growth
   (`Step_0`: `image_[xy]scale += 0.025 * (speed / 7)`) and no damage hook
   (`Other_15` — which is also one of the two writers of
   `hitbysimonsaysattackcount`, so the difficulty ladder mis-measures too).
   Add it as a root, or resolve numeric indices in the closure.
   (`372` = `obj_regularbullet` and `460` = `obj_tm_whip_animation` confirm the
   row-order mapping.)
4. **Draw-order-sensitive bullet geometry — twice.** `obj_tm_whip`'s position,
   angle and warning telegraph are written from `obj_tm_whip_animation`'s *Draw*
   event (`Draw_0.gml:84-155`), and `obj_yarnmaker`'s scale-up plus the
   `scr_bullet_create(x, y, obj_yarnbullet)` that makes the actual yarn bullet
   are in `obj_yarnmaker_Draw_0.gml:1-30`. Draw must run every frame, before
   collision, for both. If the studio ever skips Draw for an invisible or
   off-screen instance, **YarnBalls produces no bullets at all.**
5. **Multi-part monster drawing.** `obj_tasque_manager_enemy_Draw_0.gml` composes
   six limb sprites through `draw_monster_body_part_ext` with per-part sin/cos
   wobble and a `sparesprite[]` swap once mercy is maxed, and early-exits while
   `obj_tm_whip_animation` is visible (`:1-2`);
   `obj_tm_whip_animation_Draw_0.gml` redraws the same six with `draw_sprite_ext`
   plus a `spr_whitepixel` rope (12×2, rotated, lerped in 6 segments).
   `draw_monster_body_part_ext`, `scr_remapvalue`, `scr_getlaunchdirection`,
   `scr_inverselerp`, `scr_childbullet`, `scr_bullet_create`, `scr_bullet_inherit`,
   `scr_dark_marker`, `scr_dark_marker_animated`, `scr_monsterattacknamecount`,
   `scr_bulletspawner`, `scr_turntimer` and `scr_monsterpop` are all already
   present in `docs/js/gml_scripts.js` (verified by grep).
6. **The dojo quiz writes global flags.** `obj_dbulletcontroller_Step_0.gml:1345-1346`
   and `:1356` set `global.flag[36]` and `global.flag[39]`. A harness that does
   not clear them between runs (the game does, at
   `obj_battlecontroller_Create_0.gml:266`) will end the *next* turn immediately,
   because `scr_mnendturn.gml:17` reads `flag[39]`.
7. **Three monsters for the story fight** — see Trap 5. **`quizDifficulty`
   writable** — see Trap 4. **`special`/`difficulty`/`encounterno` settable** to
   reach the dojo variant — see Trap 2.
8. **Uninitialised boss state.** Neither Create nor `scr_enemy_object_init`
   defines `rr` or `rtimer`; both are created implicitly during the enemytalk
   phase (`manager Step_0:114` sets `rtimer = 0`, `:36` first writes `rr`).
   The box and turn blocks sliced above touch neither, so the default path is
   safe — this only matters if someone widens the slices.
9. **Don't chase `turnlength`.** `obj_dbulletcontroller_Step_0.gml:1411` sets
   `d.turnlength = 90` on every re-spawned quizzler, but `obj_tm_quizzler` never
   reads `turnlength` in any of its five events. Round length is entirely
   `turnspeed` (30) plus the controller's `attacktimer`.
10. Not needed: no green/purple/yellow soul, no shrinktangle, no custom box, no
    turn-replacement minigame. The Quiz is a Simon Says minigame, but it is an
    ordinary bullet turn mechanically — the soul is the soul, and the only
    novelty is the rotated box (plus, in the dojo, a scoreboard).
