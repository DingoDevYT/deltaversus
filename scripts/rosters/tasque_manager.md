# Tasque Manager (ch2) — the REAL roster, derived from the chooser

**4 real attacks across 2 enemy objects. 3 cut entries.** This is the smallest
roster of the six fights and the only one whose attack selection is driven by
the PLAYER rather than by a turn ladder, an HP gate or a random roll.

All paths below are relative to
`C:/Users/lando/Desktop/DELTARUNE - GML/DELTARUNE Chapter 2 - GML/`.

---

## 1. Which objects are actually in the fight

`gml_GlobalScript_scr_encountersetup.gml:559-573` — encounter 57:

```
case 57:
    global.monsterinstancetype[0] = obj_tasque_enemy;          // monstertype 32
    global.monsterinstancetype[1] = obj_tasque_manager_enemy;  // monstertype 42
    global.monsterinstancetype[2] = obj_tasque_enemy;          // monstertype 32
    global.battlemsg[0] = "* Tasque Manager blocks the way!";
```

Encounter 57 is entered from exactly one place —
`gml_Object_obj_npc_tasquemanager_Step_0.gml:23`, `scr_battle(57, 0, marker2, id, 0)`.

So the fight is **three monsters**: Tasque, Tasque Manager, Tasque. Each takes
its own turn and spawns its own `obj_dbulletcontroller`, so up to three
controllers can be live in one bullet phase. `obj_dbulletcontroller_Create_0.gml:14-18`
sets `ratio = 2.3` at three monsters (1.6 at two, 1 at one) and every Tasque
bullet timer is multiplied by it.

The REFDATA confirms both are `obj_monsterparent` children
(`objects.tsv`: `obj_tasque_enemy … obj_monsterparent`,
`obj_tasque_manager_enemy … obj_monsterparent`). Note the same object *names*
exist in ch3/ch4/ch5; everything here is the Chapter 2 copy.

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

Two dispatcher arms each. Unlike the Knight or Gerson there is no pile of cut
branches in the LIVE events — the cut content lives in a whole duplicated event
(§5).

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
| `overrideAttack = 1;` | `Step_0:249` | Kris `acting == 2` — "You asked Tasque Manager to show you order. She obliges!" |
| `overrideAttack = 1;` | `Step_0:273` | `acting == 3` — "Everyone asked Tasque Manager to show you order." |

Both are gated on `violenceused == 0` (`Step_0:237`, `:266`) — hit a Tasque and
the ACT fails, `overrideAttack` is never set, and the Manager whips forever.

So: **rr = 0 (Whip) is the default turn; rr = 1 (Quiz) happens exactly once per
successful Order ACT.** Both values are real.

Two decoys around this chooser must NOT be mistaken for it:

* `Step_0:36` — `rr = (scr_monsterpop() > 1) ? choose(0, 1, 2, 3) : choose(0, 1, 2);`
  is the **enemytalk dialogue** selector (Processes!/whip-it-into-shape/order-order/kitties).
  It runs in the talk phase and is overwritten by the real chooser at `rtimer == 0`.
* `Step_0:187` — `rr = choose(0, 1, 2, 3, 4);` is the **battle-message** selector,
  assigned *after* the controller has already been created. Same vestigial shape
  as Spamton NEO's trailing `rr = choose(0,1,2,3)`.

`Step_0:149-150` (`if (global.encounterno == 89) rr = 1;`) is a third writer, but
encounter 89 is unreachable — see §5b.

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
Says quiz runs. `quizDifficulty != 4` is vestigial — outside debug the value can
never exceed 3 (§4).

Same two decoys as the Manager: `tasque Step_0:11` is the "meowowme" dialogue
roll, `tasque Step_0:93` is the battle-message roll after dispatch.

### Real roster

| # | enemy | rr | type | name | controller |
|---|---|---|---|---|---|
| 1 | `obj_tasque_manager_enemy` | 0 | 20 | WhipAttack | `obj_dbulletcontroller` |
| 2 | `obj_tasque_manager_enemy` | 1 | 32 | QuizAttack | `obj_dbulletcontroller` |
| 3 | `obj_tasque_enemy` | 0 | 2 | YarnBalls | `obj_dbulletcontroller` |
| 4 | `obj_tasque_enemy` | 1 / 2 | 3 | MeowWow (d0 / d1) | `obj_dbulletcontroller` |

---

## 4. Phases — a difficulty ladder driven by player performance

There is no `phaseturn`, no HP gate and no scripted turn sequence. What ramps is
`quizDifficulty`. `gml_Object_obj_tasque_manager_enemy_Step_0.gml:12-23`:

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
is `< 3`, so **the real range is quizDifficulty 0, 1, 2, 3**.

Consequences that cascade:

* `dc.difficulty = quizDifficulty` (`Step_0:178`) → `obj_tm_quizzler.difficulty`
  (`obj_dbulletcontroller_Step_0.gml:1285`) → round pace
  `attacktimer = 90 / 60 / 60 / 40` for difficulty 0/1/2/3
  (`obj_dbulletcontroller_Step_0.gml:1291-1294`) and zap window
  `20 / 15 / 15 / 20` (`obj_tm_quizzler_Step_1.gml:148-153`).
* `obj_tm_quizzler_Step_1.gml:17-31` (`difficulty >= 4` → multi-letter rounds
  `turns = difficulty - 3`) is **unreachable in the real fight** — only the dead
  encounter-89 path ever passes 4.
* Once `quizDifficulty > 1`, the Tasques stop sitting out quiz turns and start
  layering MeowWow d1 on top (`Step_0:145`).

The other two "difficulty" sources are population-based, not phase-based:

* `obj_dbulletcontroller_Step_0.gml:862` — `d.difficulty = scr_monsterpop() == 1;`
  The whip only reaches difficulty 1 (8 bullets at 45° with drift instead of 4 at
  90°, `obj_tm_whip_animation_Step_0.gml:86-95`) once the Manager is the **last
  monster standing**.
* `obj_dbulletcontroller_Create_0.gml:14-18` — `ratio` 2.3 / 1.6 / 1 by population.

Finally, a pre-fight mercy gate: `Step_0:1-10` reads `global.flag[419]`
(`scr_text.gml:6057` = 1 for the right painting answer, `:6067` = 2 for the near
miss) and starts the Manager at `mercymod` 100 or 50 — i.e. the overworld quiz
can make her instantly spareable.

---

## 5. The cut list

### 5a. `Other_24` — a whole dead copy of the Step event (RisingDiamonds, type 1)

`gml_Object_obj_tasque_manager_enemy_Other_24.gml` is user event 14 and is
368 lines of near-duplicate Step code. **Nothing in Chapter 2 invokes it.**
Grepping the whole chapter for `event_user(14)`, `ev_user14`, `ev_user, 14`
and `event_perform` finds only `gml_GlobalScript_scr_monster_makeinstance.gml:15`
(`event_user(15)`) and `gml_Object_obj_teacup_Step_0.gml:409`. There is no
caller.

It is recognisably the OLDER draft:

| | live `Step_0` | dead `Other_24` |
|---|---|---|
| chooser | `:131-134` `overrideAttack ? 1 : 0` | `:102-105` `overrideAttack ? 2 : (rr == 3 ? 3 : 0)` |
| rr 0 | WhipAttack type 20 **+ element 6** | WhipAttack type 20, no element |
| rr 1 | QuizAttack type 32 | **RisingDiamonds type 1** |
| rr 2 | — | QuizAttack type 32 |
| rr 3 | — | *no arm at all* — silent turn |

`rr = (rr == 3) ? 3 : 0;` at `Other_24:105` lets the "Kitties!!" dialogue value 3
leak out of the talk phase into the attack phase, where no branch matches it.
That dead-ends into a turn with no attack, which is exactly the kind of thing you
fix by rewriting the event — which is what happened.

**`RisingDiamonds` (type 1) is cut.** Its only other writer in the chapter is
`gml_Object_obj_baseenemy_Step_0.gml:74`, the generic template enemy, which is
not in any encounter.

### 5b. The "Graze!" dojo quiz — `type 32` with `special = 1, difficulty = 4`

`Step_0:171-175` gives the quiz a completely different personality when
`global.encounterno == 89`, and `Step_0:149-150` / `:215-216` force it to be
selected with `scr_turntimer(99999)`. Encounter 89 is defined —
`scr_encountersetup.gml:1005-1019`, a **solo** Tasque Manager, custom hero
positions, `monstertype[1] = monstertype[2] = 0` — but **no code path sets it.**
Its `battlemsg` is `"* Graze!"`, copy-pasted from the unrelated dojo graze
challenge (`scr_encountersetup.gml:770`, `obj_dojograzeenemy`), which is the
tell that 89 is a dev test slot rather than a shipped mode. The chapter contains no `scr_battle(89`, no
`global.encounterno = 89`, no `myencounter = 89`. The only route in is the debug
`obj_battletester`, whose encounter number is a free-scrolling counter
(`obj_battletester_Draw_64.gml:6-18`, clamped to 50..999 for ch2 by
`obj_battletester_Create_0.gml:4-8`).

What it unlocks inside `obj_dbulletcontroller_Step_0.gml`:

* `:1244-1245` `if (special == 1) global.turntimer = 5400;` — a 3-minute turn.
* `:1298` `if ((made == 4 || special < -2) …)` — with `special == 1` the respawn
  branch at `:1401-1416` increments `made`, so after **four** quizzler rounds the
  scoring machine at `:1300-1399` fires: `spr_tm_maru` / `spr_tm_maru_big` on a
  pass, `spr_tm_batsu` on a fail (`:1383-1398`, itself re-gated on encounter 89),
  three `phase`s, three `strikes`.
* `:1343-1351` `if (strikes == 3) { global.flag[36] = 1; global.flag[39] = 1;
  global.turntimer = 10; … }` — the same two flags `scr_gameover.gml:32-33` sets.
  A dojo washout is scripted as a game over.
* `obj_tm_quizzler_Step_1.gml:3-7` — `if (global.encounterno == 89 && global.inv > 0
  && hit == 0) controller.special = -4;` is the only writer of the `-4` state, so
  the `special == -4` arm at `:1367` is likewise dojo-only.

In the real fight `special` stays 0 (`obj_dbulletcontroller_Create_0.gml:23`).
That means `made` is set to 1 at `:1278` and **never increments** (the `made++`
at `:1404` is inside `if (special == 1)`), so `made == 4` is never true, no
scoring ever happens, and the quiz just loops rounds until the 260-frame turn
expires. `d.dojo = special < -2` (`:1282`) is always false.

### 5c. `type 35` — an orphan quiz controller

`obj_dbulletcontroller_Step_0.gml:1451-1494` builds the same `spr_tm_grid`
diamond, the same four `spr_tm_letters` markers and an `obj_tm_quizzler`, but
with `global.turntimer = 3600`, `difficulty = 0` forced and `d.dojo = true`
hard-coded (`:1489`) — i.e. a standalone version of the §5b dojo quiz that does
not need the `special` handshake. Grepping all of Chapter 2 for `type = 35` /
`type *= *35` returns **nothing** — no object dispatches it. It carries no
`global.monsterattackname`, so `gen_attacks.js` will not emit it as a roster
entry; it is recorded here only so nobody rediscovers it and assumes it plays.

Also worth knowing about but not roster entries: `obj_tm_quizzler_old`,
`obj_tm_whip_animation_old`, `obj_tm_whip_attack_backup` — three more
superseded drafts sitting in the chapter, none referenced by live code.

---

## 6. What each real attack actually does

**WhipAttack (type 20)** — `obj_dbulletcontroller_Step_0.gml:850-866` creates one
`obj_tm_whip_attack`, hides the Manager and sets
`d.difficulty = scr_monsterpop() == 1`. `obj_tm_whip_attack_Step_0.gml` is a
4-state loop (wind up 20 → strike 35 → zap 55 → recover 65, then reset to 5) that
runs for the whole turn, gated on `global.turntimer > 30` so it will not start a
swing it cannot finish. The visible whip, its warning telegraph and the ball's
hitbox are all computed in **`obj_tm_whip_animation_Draw_0.gml:84-155`** — the
bullet `obj_tm_whip` is moved from a Draw event. The zap ring comes from
`obj_tm_whip_animation_Step_0.gml:68-105`: 4 × `obj_regularbullet` at 90°
spacing (`spr_tm_zap_bullet`, `speed 0.1`, `friction -0.5`) at difficulty 0, or
8 at 45° with `rotation += (zaptimer/5) * 15 * ±1` at difficulty 1.

**QuizAttack (type 32)** — `obj_dbulletcontroller_Step_0.gml:1235-1417`. Rotates
the box to 45° (`:1275-1276`), lays a grey `spr_tm_grid` and four `spr_tm_letters`
corner markers at ±50 px, then spawns `obj_tm_quizzler` and adds 120 frames to the
turn (`:1287`). `obj_tm_quizzler_Step_1.gml` picks `turns` letters avoiding an
immediate repeat (`:37-56`, using the Manager's `lastQuizLetter`), flashes them
one at a time as `obj_tm_quizletter` pairs (`:113-135`), then in state 1 spawns an
`obj_tm_quizzap` in every quadrant **except** the announced one
(`:155-163`, `if (i == letters[currentturn]) continue;`). Stand in the right
quadrant of the diamond or take a hit. `turns` is 1 in the real fight (the
`turns` overrides at `:17-31` need difficulty ≥ 4).

**YarnBalls (type 2)** — `obj_dbulletcontroller_Step_0.gml:64-88`, every
`10 * ratio` frames spawns an `obj_yarnmaker` and calls `scr_bullet_inherit`,
with a launch angle solved by `scr_getlaunchdirection` for childgravity 0.5 and
a speed remapped from the enemy's height above the camera (`scr_remapvalue(40, 200, y - cameray(), 8, 16)`).
Every third throw (`(made % 3) == 2`) is aimed straight at the soul.

**MeowWow (type 3)** — `obj_dbulletcontroller_Step_0.gml:89-122`. Hides the
Tasque behind an `obj_tasque_meowing` animation, then every
`(difficulty >= 2 ? 40 : 24) * ratio * (1 + difficulty)` frames fires an
`obj_chainbullet` aimed at the soul with `childBullet = 456`
(= `obj_tasque_soundwave`) and `childSpeed = difficulty == 1 ? 4 : 7`. Note the
**slower** child speed at difficulty 1 — the d1 upgrade is more meows, not faster
ones. The `sameattacker` stagger at `:101-102` desynchronises two Tasques meowing
at once.

---

## 7. Generator config, and the traps in it

```json
"boxBlock":  { "file": "gml_Object_obj_tasque_manager_enemy_Step_0.gml",
               "anchor": "if (!instance_exists(obj_growtangle))" },
"turnBlock": { "file": "gml_Object_obj_tasque_manager_enemy_Step_0.gml",
               "anchor": "scr_turntimer(140);", "endAnchor": "overrideAttack = 0;" },
"extraAttackFiles": ["gml_Object_obj_tasque_enemy_Step_0.gml"]
```

All three anchor strings occur **exactly once** in the named file
(`if (!instance_exists(obj_growtangle))` at `:122`, `scr_turntimer(140);` at
`:182`, `overrideAttack = 0;` at `:183`), verified with `grep -Fc`. A dry run of
`extractBoxBlock` / `extractTurnBlock` / `attackAnnouncements` against this
config yields a 154-char box block, a 19-char turn block, and the five expected
announcements.

**Why the box block stops at the `instance_create`.** The tempting extension is
to reach forward to `obj_growtangle.target_angle = 45;` at `:137`, but that slice
would have to cross `:131-134` — the chooser — and replaying it would overwrite
the roster's selection with `overrideAttack ? 1 : 0`. That is the exact trap the
Jevil note records for `event_user(5)`. It costs nothing: `type 32` sets
`target_angle` and `image_angle` itself at `obj_dbulletcontroller_Step_0.gml:1275-1276`,
and WhipAttack never rotates the box. This fight also never resizes the box —
no `maxxscale` anywhere — so the default 2× `obj_growtangle` is correct.

**Why the turn block is one line.** `scr_turntimer` only raises, so the
`scr_turntimer(120);` floor at `:212` is dominated by 140, and `scr_turntimer(99999)`
at `:216` is behind the dead encounter-89 check. The real quiz turn is 260 frames
because the controller adds 120 at `:1287` — that happens inside the replayed
controller, not here. Both Tasques call `scr_turntimer(140)` too
(`obj_tasque_enemy_Step_0.gml:78`), so one number covers all four attacks.

**Trap 1 — `Other_24` wins the de-duplication.** `readdirSync` returns
`…_Other_24.gml` before `…_Step_0.gml`, so `gen_attacks.js` keeps the DEAD copies
of WhipAttack and QuizAttack and discards the live ones. Confirmed by dry run.
The two copies are functionally identical for the studio — the differences are
`dc.element = 6` (only consumed by `scr_element_damage_reduction`, inert without
armour) and a redundant `lastQuizLetter = -1` (the controller re-does it at
`:1284`) — so nothing breaks, but every entry's `source` will cite dead code and
`Other_24` also injects the cut RisingDiamonds. An `excludeFiles` hook on the
`BOSSES` entry is the clean fix.

**Trap 2 — MeowWow's setup is nulled.** `attackAnnouncements` finds the nearest
preceding condition for the `else if (rr > 0)` arm to be `rr == 0)` (from the
YarnBalls arm above it) and then its `escaped` heuristic sees `if (rr == 2)`
inside the body, so it drops the branch and falls back to a manual spawn. Moot
here — `extraAttackFiles` entries get `setup: null` regardless — but it means
both Tasque attacks lose `dc.element = 6` and MeowWow loses `dc.difficulty = 1`,
so difficulty has to come from the studio's DIFF selector.

**Trap 3 — the quiz always runs at difficulty 0.** `dc.difficulty = quizDifficulty`
reads boss state, and `Create_0:32` initialises it to 0. Replaying the branch
verbatim can only ever produce difficulty 0; seeing 1–3 requires writing
`obj_tasque_manager_enemy.quizDifficulty` before launch.

**Trap 4 — population.** `scr_monsterpop()` sets both the whip's difficulty and
the controller's `ratio`. A single-monster studio scene reproduces the *end* of
the fight (whip d1, ratio 1); the opening is three monsters, whip d0, ratio 2.3.

---

## 8. What the studio will need to special-case

1. **Rotated battle-box collision.** `obj_growtangle`'s parent *is*
   `obj_battlesolid` and its mask is `spr_battlebg_0` (ch2 `objects.tsv`); the
   soul is confined by `place_meeting(x + px, y + py, obj_battlesolid)` in
   `obj_heart_Step_0.gml:61-80`. The Quiz sets `image_angle = 45`, so confinement
   must honour a rotated rectangle mask or the whole quadrant mechanic collapses.
   `obj_tm_quizzap` (parent `obj_regularbullet`, `spr_tm_gridzap`, `image_angle`
   0/90/−90/180, scaled 2×) needs the same.
2. **Assignment through an object index.** `obj_tm_quizzler_Create_0.gml:23-32`:
   `if (instance_exists(obj_tm_whip_animation)) animator = 460;` — 460 is the raw
   asset index of `obj_tm_whip_animation` (`objects.tsv` row 460), and the object
   then writes `animator.creator`, `animator.state`, `animator.zapping`,
   `animator.quizloop`. This is the GML "write through an object index, broadcast
   to every instance" idiom, and it is taken on **every quiz round after the
   first** because the destroyed quizzler leaves its animator behind.
3. **`obj_tasque_soundwave` has no translated events.** MeowWow's
   `d.childBullet = 456` (`obj_dbulletcontroller_Step_0.gml:109`) is a numeric
   object reference, so `gen_objects.js`'s name-based transitive closure never
   reaches it: the object is present in `docs/js/gml_object_index.js` but has
   **zero** event code in `docs/js/gml_objects.js`. Without it the meow bullets
   get no growth (`Step_0`: `image_[xy]scale += 0.025 * (speed / 7)`) and no
   damage hook (`Other_15`). Add it as a root, or resolve numeric indices in the
   closure. (`372` = `obj_regularbullet` and `460` = `obj_tm_whip_animation`
   confirm the row-order mapping.)
4. **Draw-order-sensitive bullet geometry.** `obj_tm_whip`'s position, angle and
   warning telegraph are all written from `obj_tm_whip_animation`'s *Draw* event
   (`Draw_0.gml:84-155`). Draw must run every frame, before collision.
5. **Multi-part monster drawing.** `obj_tasque_manager_enemy_Draw_0.gml` composes
   six limb sprites through `draw_monster_body_part_ext` with per-part sin/cos
   wobble (and a `sparesprite[]` swap once mercy is maxed);
   `obj_tm_whip_animation_Draw_0.gml` redraws the same six with `draw_sprite_ext`
   plus a `spr_whitepixel` rope (12×2, rotated, lerped in 6 segments).
   `draw_monster_body_part_ext`, `scr_remapvalue`, `scr_getlaunchdirection`,
   `scr_inverselerp`, `scr_childbullet`, `scr_bullet_create`, `scr_dark_marker`
   and `scr_monsterattacknamecount` are all already present in
   `docs/js/gml_scripts.js`.
6. **Three monsters, or the timings are wrong** — see Trap 4.
7. **A way to set `quizDifficulty`** — see Trap 3.
8. Not needed: no green/purple/yellow soul, no shrinktangle, no custom box, no
   turn-replacement minigame in the *real* fight. The Quiz is a Simon Says
   minigame, but it is an ordinary bullet turn mechanically — the soul is the
   soul, and the only novelty is the rotated box.
