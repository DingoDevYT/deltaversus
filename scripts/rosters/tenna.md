# Tenna (final fight) — ch3, `obj_tenna_enemy`

**13 real entries, 12 cut.** The dispatcher in `obj_tenna_enemy`'s Step lists only
six `myattackchoice` branches, but four of them are *not* an attack each: choice 3
is a doorway into a **second, string-keyed dispatcher** (`obj_tenna_zoom`) that
holds ten more attacks, and choices 20/21 are orphans. So this fight is the
mirror image of the usual problem — the boss dispatcher *undercounts*, and the
real roster is bigger than the branch list, not smaller.

---

## 0. Which Tenna is this

`scr_encountersetup.gml:867` — **encounter 121** is the final fight:

```
case 121:
    global.monsterinstancetype[0] = obj_tenna_enemy;   // :874
    global.monstertype[0] = 103;                       // :875
    global.monstertype[1] = 0;                         // :877  ← SOLO
    global.monstertype[2] = 0;                         // :878
    global.battlemsg[0] = "* That's right folks! One last challenge!
                            1000 points or bust! Can you do it!?"
```

`scr_monstersetup.gml:1861-1866` gives him **5500 HP / AT 13**, and five ACT
slots named "Minigame" plus "ILoveTV".

Everything else with "tenna" in the name was excluded on evidence, not by name:

| excluded | why it is not this fight |
|---|---|
| `obj_tenna_board4_enemy` | a **different object** with its own Create/Step/Other_10. Encounters **133 / 134 / 135** (`scr_encountersetup.gml:1106 / 1122 / 1144`), two of them paired with `obj_shadowman_enemy` / `obj_zapper_enemy`. One unconditional attack: `"rimshot lensflare"` → `dc.type = 125` (`its Step_0:465-468`) — note it reuses **type 125 under a different name**, which is exactly the kind of collision that makes name-matching unsafe. Its own `Other_10` assigns `myattackchoice` 1/4/5/6/7/8, values its Step never tests at all. |
| `obj_tenna_board4_gacha`, `obj_board_*` | overworld board-game objects, no `obj_monsterparent` lineage (`objects.tsv`). |
| `obj_tennaPresetTester`, `obj_tenna_battle_idleanimtest` | dev harnesses. |
| `obj_shootout_*`, `obj_rhythmgame*`, `obj_chefs_*`, `obj_susiezilla_*` | **NOT excluded.** In this fight they are not standalone sections — they are the boss's attacks, launched from `obj_tenna_enemy`'s own turn dispatcher through `myattackchoice == 3`. The *standalone* copies live in their own rooms and are reached with minigametype strings `"chef board 4"` / `"rythm board 4"` / `"susiezilla board 4"` (`obj_tenna_zoom_Other_13.gml:1-8`) that `obj_tenna_enemy` never produces. Telling them apart is a string comparison, not a guess. |

---

## 1. The dispatcher — `obj_tenna_enemy_Step_0.gml:568-691`

```
if (scr_isphase("bullets") && attacked == 0)          // :568
{
    rtimer += 1;
    if (rtimer == 12)                                  // :572
    {
        if (myattackchoice == 0)        { "all star cast";      dc.type = 125; dc.damage = 65; scr_turntimer(200); }   // :576-583
        else if (myattackchoice == 1)   { "smashcut";           dc.type = 126; dc.damage = 65; scr_turntimer(260); }   // :584-591
        else if (myattackchoice == 2)   { "rimshot lensflare";  dc.type = 128; dc.damage = 65; scr_turntimer(260); }   // :592-599
        else if (myattackchoice == 3)   { minigametransition_con = 1;                          scr_turntimer(999); }   // :600-608
        else if (myattackchoice == 20)  { "light em up";        dc.type = 150; scr_turntimer(999999); }                // :609-615
        else if (myattackchoice == 21)  { minigametransition_con = 1; minigametype = "battle"; difficulty = 1; }       // :616-622
```

Six branches, four announcements. Note **every turn length lives inside its own
branch** — there is no separate ladder. The only out-of-branch call is the
raise-only floor `scr_turntimer(90)` at `:565`.

## 2. The chooser — `obj_tenna_enemy_Other_10.gml`, called at `Step_0:50`

```
if (attackchosen == false) { event_user(0); ... attackchosen = true; }     // Step_0:48-62
```

`event_user(0)` is the **only** user event `obj_tenna_enemy` ever fires on
itself. That single fact decides four of the twelve cut entries.

### 2a. The bullet ladder (above half HP)

```
if (!minigameactivated) phaseturn++;          // :6-7
if (phaseturn == 1) myattackchoice = 0;       // :22-23   all star cast
if (phaseturn == 2) myattackchoice = 1;       // :25-26   smashcut
if (phaseturn == 3) { myattackchoice = 2; phaseturn = 0; }   // :28-32   rimshot
```

A flat 3-cycle: **0 → 1 → 2 → 0 → 1 → 2 …**. There are no `phaseturn` values
4-17 in the live chooser at all. (`Step_0:96` also zeroes `phaseturn` once, in
the rimshot dialogue branch — harmless duplication.)

### 2b. The minigame turn (`myattackchoice = 3`)

Three independent triggers, all writing choice 3:

```
if (global.monsterhp <= maxhp * 0.5) { myattackchoice = 3; minigamecount++; minigameactivated = true; }  // :34-39
if (minigameactivated && minigamecount <= 5) { myattackchoice = 3; minigamecount++; }                    // :41-45
if (minigameactivated && minigamecount >= 6) { myattackchoice = 3; minigamecount++; _minigamecount = 2; } // :47-52
if (minigameinsanity == true) { minigameactivated = true; myattackchoice = 3; }                          // :54-58
```

`minigameactivated` is also set by the **player's ACT** — "Everyone gets ready
to play…!" at `Step_0:861-872` — and cleared at the end of each turn
(`Step_0:713`). So a minigame turn happens when the party ACTs for one, *or*
unconditionally once Tenna drops to 2750 HP. `_minigamecount = 2` is the
**DOUBLE FEATURE** (two minigames queued in one turn, chained by `obj_tenna_zoom`
at its `Step_0:769-798`); the dialogue confirms it — "How about a DOUBLE
FEATURE!?" fires on `minigamecount >= 6` (`Step_0:135-140`).

### 2c. The minigame *order* — the `global.tempflag[91]` ladder (`:78-292`)

Choice 3 alone says nothing about *which* minigame. The `repeat (_minigamecount)`
block advances `global.tempflag[91]` once per queued minigame and reads off:

| tempflag | minigame | caption (`Other_13`) |
|---|---|---|
| 1 | cooking d0 | DODGE FIRE! |
| 2 | music d0 | PERFORM! |
| 3 | battle d1 | SHOOT THE TARGETS! |
| 4 | cowboy d0 | SHOOT! |
| 5 | music d0 | PERFORM! |
| 6 | *skipped* — `:114-115` bumps it straight to 7 | |
| 7 | `flag[1197] > 0` ? **susiezilla d2** : battle d2 | PROTECT RALSEI! / BOUNCE THE BALL! |
| 8 | cowboy d1 | DODGE! |
| 9 | music d0 | PERFORM! |
| 10 | cowboy d0 | SHOOT! |
| 11 | *skipped* — `:149-150` bumps to 12 | |
| 12 | battle d2 | BOUNCE THE BALL! |
| 13 | music d0 | PERFORM! |
| 14 | cooking d0 | DODGE FIRE! |
| 15 | `flag[1197] > 0` ? **susiezilla d3** : battle d1 | FIGHT…? / SHOOT THE TARGETS! |
| 16 | cowboy d1 | DODGE! |
| >16 | weighted random pool (`:190-264`) | |

The pool:

```
var randomchosen = choose(0, 0, 0, 1, 2, 3, 4, 5);                         // :192
if (global.flag[1197] > 0) randomchosen = choose(0, 0, 0, 1, 3, 4, 5, 6, 7);  // :195
repeat (3) { if (== prev1 || == prev2) randomchosen += 2; ...wrap... }      // :197-207
```

→ 0 music · 1 cooking d0 · 2 cowboy d0 · 3 cowboy d1 · 4 battle d1 ·
5 battle d2 · **6 susiezilla d2** · **7 susiezilla d4** (6 and 7 only in the
`flag[1197] > 0` pool). `global.flag[1197]` is the chapter's banked
*physicalchallengepoints* (`obj_round_evaluation_Draw_0.gml:402-404`), so the
three Susiezilla turns are **conditional real content**, not cut.

### 2d. The finale — MINIGAME INSANITY → LIGHT 'EM UP

```
if ((hp <= maxhp * 0.2 || obj_tenna_enemy_bg.myscore >= 1000) && haveusedultimate == false)
    minigameinsanity = true;                                              // Other_10:9-10
```

`obj_tenna_zoom` then stops ending the turn and starts **channel-surfing**
between minigames on a shrinking timer, 120 → 30 frames
(`obj_tenna_zoom_Step_0.gml:299-311`). On the fifth flip at 30:

```
if (obj_tenna_enemy.minigameinsanitycount == 5)                            // :427
{
    minigametype = "battle"; minigamedifficulty = 3;
    minigameinsanity = false; minigameinsanityintro = false;
    with (obj_tenna_enemy) phaseturn = 18;                                 // :435
}
```

`phaseturn = 18` is set **from `obj_tenna_zoom`, not from the boss** — which is
why the boss's own `if (phaseturn == 18)` block (`Other_10:60-67`) is live even
though nothing in `Other_10` can ever count that high. It re-selects battle d3
each following turn and latches `haveusedultimate = true`, which is what lets
`Step_0:37-42` end the fight once the score hits 1000.

## 3. The second dispatcher — `obj_tenna_zoom_Other_11.gml` (`event_user(1)`)

`myattackchoice == 3` only sets `minigametransition_con = 1`. The boss's Step
(`:1183-1243`) then throws `obj_actor_tenna` at the screen and creates
`obj_tenna_zoom`, copying **three** (type, difficulty) pairs onto it
(`:1226-1231`). `obj_tenna_zoom`'s `event_user(1)` is the real attack dispatcher,
and it keys on a **string**:

| minigametype / difficulty | what it builds | line |
|---|---|---|
| `"susiezilla"` 1-7 | `obj_susiezilla_gamecontroller.setup(N)` | :10-35 |
| `"music"` | `obj_rhythmgame` (`tenna_boss = true`, `turn_length = 360`) | :37-46 |
| `"cooking"` d0 | `obj_chefs_init`, `obj_chefs_game.microgame = 6`, spawner freq 90 | :48-105 |
| `"cooking"` d2 | microgame 1, freq 50 | :107-148 |
| `"cowboy"` d0 | `obj_shootout_controller.shootout_type = 2` | :212-213 |
| `"cowboy"` d1 | `shootout_type = 3` + `obj_shootout_big_tenna` | :215-219 |
| `"battle"` d0 | **rewritten** → `minigamedifficulty = choose(1, 2)` | :248-249 |
| `"battle"` d1 | `"sharpshoot test"` → `dc.type = 150`, `dc.minigamedifficulty = 1` | :251-267 |
| `"battle"` d2 | own `obj_growtangle` at (view+320, view+200) + `obj_elnina_umbrella` + 18 `obj_umbrella_tv` | :269-356 |
| `"battle"` d3 | `"lightemup"` → `dc.type = 150` | :358-377 |

Both `type = 150` dispatches go to the same `obj_lightemup_controller`, which
splits them in its own Create:

```
inst.type = 4;                                                       // LIGHT 'EM UP
if (obj_tenna_enemy.myattackchoice == 21) inst.type = 5;             // :4-5
if (i_ex(obj_tenna_zoom) && obj_tenna_zoom.minigamedifficulty == 1)
    inst.type = 5;                                                   // :7-8  SHARPSHOOT
```

---

## 4. The REAL roster (13)

**Bullet turns (`myattackchoice` 0/1/2, red soul, standard box):**

| choice | type | name | dmg | turntimer | bullets |
|---|---|---|---|---|---|
| 0 | 125 | all star cast | 65 | 200 | `obj_tenna_allstars_manager` → `obj_tenna_allstars_bullet` |
| 1 | 126 | smashcut | 65 | 260 | `obj_tenna_smashcut_attack` |
| 2 | 128 | rimshot lensflare | 65 | 260 | `obj_tenna_rimshot_star` ×2, opposite sides |

**PHYSICAL CHALLENGE turns (`myattackchoice` 3 → `obj_tenna_zoom`):**

| minigametype | d | caption | reachable because |
|---|---|---|---|
| music | 0 | PERFORM! | tempflag 2/5/9/13, pool 0 |
| cooking | 0 | DODGE FIRE! | tempflag 1/14, pool 1 |
| cowboy | 0 | SHOOT! | tempflag 4/10, pool 2 |
| cowboy | 1 | DODGE! | tempflag 8/16, pool 3 |
| battle | 1 | SHOOT THE TARGETS! (sharpshoot, type 150) | tempflag 3/15*, pool 4 |
| battle | 2 | BOUNCE THE BALL! | tempflag 7*/12, pool 5 |
| battle | 3 | **LIGHT 'EM UP** (type 150, the finale) | insanity count 5 → `phaseturn = 18` |
| susiezilla | 2 | PROTECT RALSEI! | tempflag 7, pool 6 — **needs `flag[1197] > 0`** |
| susiezilla | 3 | FIGHT…? | tempflag 15 — **needs `flag[1197] > 0`** |
| susiezilla | 4 | FIGHT…? | pool 7 — **needs `flag[1197] > 0`** |

\* the `flag[1197] == 0` arm of that tempflag.

## 5. The CUT list (12) — with the reason each is unreachable

1. **choice 20 → type 150 "light em up"** (`Step_0:609-615`). The only writer of
   `myattackchoice = 20` in the whole chapter is `Other_12.gml:74-78`, and
   **`Other_12` is `event_user(2)`, which nothing ever calls on
   `obj_tenna_enemy`.** The boss fires only `event_user(0)`; the three
   `event_user(2)` calls that exist in ch3 (`obj_tenna_zoom_Step_0.gml:5, 331,
   730`) are `obj_tenna_zoom` calling its *own* Other_12 (the minigame teardown).
2. **choice 21 → sharpshoot debug turn** (`Step_0:616-622`). Selected only by
   `if (testsharpshoot == true)` (`Other_10:12-17`). `testsharpshoot` is written
   exactly once in Chapter 3: `testsharpshoot = false;` (`Create_0.gml:122`).
   Same for `testlightemup` (`Create_0.gml:121`, read at `Other_10:19-20` and
   `obj_darkener_Draw_0.gml:6`) — no writer sets either true.
3. **type 127 — lensflare only.** Fully implemented in
   `obj_dbulletcontroller_Step_0.gml:2537-2550`; a chapter-wide grep for
   `type = 127` returns nothing.
4. **type 129 — fast rimshot.** Shares the 128 branch
   (`obj_dbulletcontroller_Step_0.gml:2562-2610`) with `rate1 27 / rate2 20`
   instead of `78 / 50` and a single star. Never dispatched.
5. **cooking d2** (`obj_tenna_zoom_Other_11.gml:107-148`). Every cooking
   assignment in the chooser pins difficulty 0 — `Other_10:86-87`, `:166-167`,
   `:225-226` — and the insanity re-roll (`obj_tenna_zoom_Step_0.gml:381-385`)
   pins 0 too.
6. **battle d0 — "PHOTO 3 SMILES!"** (the Shutta photo minigame). Doubly dead:
   the chooser never yields battle d0, **and** `Other_11:248-249` rewrites
   `minigamedifficulty = choose(1, 2)` before the caption is chosen — `event_user(1)`
   runs at `obj_tenna_zoom_Step_0.gml:127`, `event_user(3)` (the captions) not
   until `:275`. The caption at `Other_13:88` can therefore never print, though
   the teardown at `Other_12:78-88` still destroys `obj_shutta_enemy`,
   `obj_shutta_photo_controller` and `obj_shutta_nobyacttest`.
7. **susiezilla d1 — BREAK THE STATUE!** (`Other_11:14-15`, caption `Other_13:17-18`,
   mode body `obj_susiezilla_gamecontroller_Create_0.gml:244-245`). The chooser
   only ever produces 2, 3 and 4.
8. **susiezilla d5 — DESTROY HOUSES!** (`Other_11:26-27`, mode body `:269-270`).
9. **susiezilla d6 — DESTROY HOUSES!** (`Other_11:29-30`, mode body `:272-273`).
10. **susiezilla d7** (`Other_11:32-33`) — no caption even exists for it.
    5/6/7 are the standalone Susiezilla arcade's modes.
11. **`phaseturn == 19`** (`Other_10:69-76`) — a byte-for-byte duplicate of the
    `== 18` block. Every `phaseturn` writer in ch3: `Other_10:7` (++, but the
    ladder resets to 0 at `:31`), `Other_10:14` (= 99), `Other_10:20` (= 18,
    dead flag), `Step_0:96` (= 0), `obj_tenna_zoom_Step_0.gml:435` (= 18).
    Nothing ever writes 19.
12. **The whole `Other_12` ladder — including the TRIPLE FEATURE.**
    `Other_12.gml:1-78` is a complete alternative 18-step chooser
    (`phaseturn` 1-18 → choices 0/1/2/3/20, `myattackchoice = choose(0, 1, 2)`
    at `:59`, `_minigamecount = 3` at `:71`). Two proofs it is orphaned: nothing
    calls `event_user(2)` on the boss, and it writes `_minigamecount`, a
    **`var` local to `Other_10`** — it was split off the live chooser and never
    rewired. Consequence: `minigametype3` / `difficulty3`, plumbed all the way
    through `Step_0:1230-1231`, `obj_tenna_zoom_Create_0.gml:32-33` and the
    `con == 3` chain, can never be reached — the live chooser sets
    `_minigamecount` to 1 or 2 only (`Other_10:1`, `:51`).

---

## 6. Anchors

**boxBlock** — `gml_Object_obj_tenna_enemy_Step_0.gml`, anchor
`if (myattackchoice < 3)` (line 555, **unique** in the file). Extracts to:

```
if (myattackchoice < 3)
{
    if (!instance_exists(obj_growtangle))
        instance_create(__view_get(e__VW.XView, 0) + 320, __view_get(e__VW.YView, 0) + 170, obj_growtangle);

    if (!instance_exists(obj_moveheart) && !i_ex(obj_heart))
        scr_moveheart();
}
```

Ch1-style: the box is created at a fixed spot and **never resized** — there is
no `maxxscale`. The `myattackchoice < 3` guard is load-bearing and self-selects
per attack: minigame and finale turns correctly get **no** box (the battle-d2
umbrella game builds its own at `view+200`, `Other_11:275`).

I deliberately anchored one level *inside* `if (global.mnfight == 1.5)` (553)
rather than on it, so the replay does not also execute `global.mnfight = 2;`.

**turnBlock — deliberately omitted.** Every Tenna turn length is *inside* its
dispatcher branch (200 / 260 / 260 / 999 / 999999) and is therefore already
carried by the per-attack `setup` slice; verified by re-running
`gen_attacks.js`'s `attackAnnouncements` against the file — all four setups come
out 188-223 chars with `scr_turntimer` included and `escaped == false`. The only
out-of-branch call is the raise-only `scr_turntimer(90)` floor at `:565`, which
is numerically identical to the studio's own fallback. Any slice wide enough to
capture it is either brace-unbalanced or re-runs the four `scr_bulletspawner`
calls — the Knight double-spawn trap documented in `gen_attacks.js:216-238`.

---

## 7. What the studio will need to special-case

1. **The minigame turn is not an announced attack.** `myattackchoice == 3` sets
   no `global.monsterattackname` and creates no controller, so the announcement
   scan yields **nothing** for ten of the thirteen real entries. They need a
   declared launch mode the way Pink's dates do — say
   `launch: 'tenna-minigame'` carrying `minigametype` + `difficulty` — that
   creates `obj_tenna_zoom` directly with those fields set and skips the
   `obj_actor_tenna` jump-in (`Step_0:1183-1243`).
2. **Type-150 dedup collision.** Three dispatches produce
   `obj_dbulletcontroller.type = 150`: `Step_0:609-615` (the *cut* choice 20),
   `Other_11:251-267` (sharpshoot) and `Other_11:358-377` (LIGHT 'EM UP).
   `gen_attacks.js`'s dedup key is `boss|controller|type|pattern|datecount`, so
   all three collapse to **one** entry and the cut choice-20 one wins (boss
   events are scanned before `extraAttackFiles`). By luck that entry still plays
   the real finale — `obj_lightemup_controller_Create_0.gml:1-8` only downgrades
   the target to type 5 when `myattackchoice == 21` or
   `obj_tenna_zoom.minigamedifficulty == 1`, neither of which holds — but the
   **sharpshoot variant becomes unreachable from the dropdown** unless a stub
   `obj_tenna_zoom` with `minigamedifficulty = 1` exists first.
3. **Three-hero party required.** `obj_lightemup_controller`'s Create references
   `obj_tenna_enemy`, `obj_herokris`, `obj_herosusie` and `obj_heroralsei`
   **unguarded** (`:39-61`) and calls `scr_act_charsprite` on all three.
4. **Unimplemented natives.** The cowboy setup calls `layer_create`,
   `layer_background_create`, `layer_background_htiled`,
   `layer_background_stretch` and `layer_background_speed`
   (`Other_11:221-243`). All five are in `docs/js/native_gaps.json` — and
   `obj_tenna_zoom_Other_11.gml` is literally the recorded example call site for
   `layer_background_speed`.
5. **The TV-zoom transition** does
   `sprite_create_from_surface(application_surface, …)`
   (`obj_tenna_zoom_Step_0.gml:117`) and drives five `scr_lerpvar` tweens over
   surfaces. It is cosmetic — a stub can jump straight to `con = 1` with
   `event_user(1)` already fired.
6. **The other three minigames are whole subsystems.** susiezilla needs
   `obj_mainchara.cutscene`, a 1280-wide `game_bounds` sub-world,
   `scr_script_delayed` and GML 2.3 method vars (`setup = function(arg0)`);
   cooking needs the entire `obj_chefs_*` kitchen plus `scr_chefs_end`; music
   needs `obj_rhythmgame_chart` and audio-synced charting.
7. **`obj_tenna_allstars_manager`** (the only *bullet* attack with unusual
   requirements) uses `ds_list_create`, two surfaces, a
   `spawn_new = function(arg0)` method var, and opens with
   `snd_loop(snd_crowd_laughter_loop)`.
8. **Damage is deferred, not immediate.** Failing a minigame does not hurt you
   during it; `obj_tenna_zoom` counts `minigamefailcount` (capped at 3,
   `Step_0:1295-1296`) and the boss cashes it in afterwards at
   `Step_0:1298-1375` for **56 / 26 / 18** damage per fail — doubled and
   redirected to Ralsei alone if POPULAR BOY is active (`:1318-1326`).
9. **Score, not HP, is the win condition** — `obj_tenna_enemy_bg` (`myscore`,
   `addscore`, `maxscore = 1000`). The boss Step reads it at `:37`, `:52-59`,
   `:686` and `:695`, and `Create_0:88-89` instantiates it. A spec run that
   omits `obj_tenna_enemy_bg` will throw in the boss's Step, not just look wrong.
