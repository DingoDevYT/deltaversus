# Tenna (final fight) — ch3, `obj_tenna_enemy`

**13 real entries, 13 cut.** This fight inverts the usual problem. The boss's own
dispatcher lists only **six** `myattackchoice` branches, but four of them are not
one attack each: choice 3 is a doorway into a **second, string-keyed dispatcher**
(`obj_tenna_zoom`) holding ten more attacks, and choices 20/21 are orphans. So the
boss dispatcher *undercounts*, and the cut content hides one level down — in
`obj_tenna_zoom`'s `minigametype` / `minigamedifficulty` table, which supports
seven variants nothing in this fight ever asks for.

---

## 0. Which Tenna is this

`scr_encountersetup.gml:867-881` — **encounter 121** is the final fight:

```
case 121:
    global.monsterinstancetype[0] = obj_tenna_enemy;   // :874
    global.monstertype[0] = 103;                       // :875
    global.monstertype[1] = 0;                         // :878  <- SOLO
    global.monstertype[2] = 0;                         // :879
    global.battlemsg[0] = "* That's right folks! One last challenge!
                            #1000 points or bust! Can you do it!?"
```

`scr_monstersetup.gml:1861-1866` gives him **5500 HP / AT 13 / DF 0**, and five ACT
slots — `Check` plus four named "Minigame" (`:1873-1900`, costs 20 / 65 / 65 / …).
`AT 13` matters: the two `obj_tenna_zoom` dispatches use
`dc.damage = global.monsterat[myself] * 5` = **65**, the same literal the boss's
own three branches hard-code.

`objects.tsv` confirms only two Tenna objects descend from `obj_monsterparent`:
`obj_tenna_enemy` and `obj_tenna_board4_enemy`.

### What was excluded, and on what evidence

| excluded | why it is not this fight |
|---|---|
| `obj_tenna_board4_enemy` | A **different object** with its own Create / Step / Other_10. Encounters **133 / 134 / 135** (`scr_encountersetup.gml:1106 / 1122 / 1144`, monstertype 105); 134 and 135 pair it with `obj_shadowman_enemy` / `obj_zapper_enemy`. It has **one unconditional attack** — `global.monsterattackname[myself] = "rimshot lensflare"; dc.type = 125; scr_turntimer(300);` at its `Step_0:463-469` — note it reuses **type 125 under a different name** (the final fight calls 125 "all star cast"), which is exactly the collision that makes name-matching unsafe. Its `Other_10` assigns `myattackchoice` 1/4/5/6/7/8, values its own Step never tests at all. |
| `obj_tenna_board4_gacha`, `obj_board_*` | Overworld board-game objects. No `obj_monsterparent` lineage in `objects.tsv`. |
| `obj_tennaPresetTester`, `obj_tenna_battle_idleanimtest` | Dev harnesses (3 and 11 lines of Create). |
| `obj_shootout_*`, `obj_rhythmgame*`, `obj_chefs_*`, `obj_susiezilla_*` | **NOT excluded.** In *this* fight they are not standalone sections — they are the boss's attacks, launched from `obj_tenna_enemy`'s own turn dispatcher through `myattackchoice == 3`. The *standalone* copies live in their own rooms and are entered with minigametype strings `"chef board 4"` / `"rythm board 4"` / `"susiezilla board 4"` (`obj_tenna_zoom_Other_13.gml:1-8` → `room_goto`), strings `obj_tenna_enemy` never produces. The test is a string comparison, not a judgement call. |

---

## 1. The dispatcher — `obj_tenna_enemy_Step_0.gml:568-622`

```
if (scr_isphase("bullets") && attacked == 0)
{
    rtimer += 1;
    if (rtimer == 12)
    {
        if (myattackchoice == 0)        // :576
        {
            global.monsterattackname[myself] = "all star cast";
            dc = scr_bulletspawner(x, y, obj_dbulletcontroller);
            dc.type = 125; dc.damage = 65; scr_turntimer(200);
        }
        else if (myattackchoice == 1)   // :584   smashcut, type 126, 260
        else if (myattackchoice == 2)   // :592   rimshot lensflare, type 128, 260
        else if (myattackchoice == 3)   // :600   minigametransition_con = 1; scr_turntimer(999);
        else if (myattackchoice == 20)  // :609   light em up, type 150, 999999
        else if (myattackchoice == 21)  // :616   minigametype="battle"; difficulty=1; 999999
```

Two things to notice immediately:

1. **Choice 3 announces nothing.** No `global.monsterattackname`, no controller.
   It only sets `minigametransition_con = 1`. Ten real attacks are behind that
   line and `gen_attacks.js`'s announcement scan cannot see any of them.
2. **The turn length lives inside each branch.** There is no separate ladder.
   The only out-of-branch call is `scr_turntimer(90)` at `:565` — see §6.

The doorway opens at `Step_0:1183-1243`: `obj_actor_tenna` jumps at the screen,
lands, and then

```
tenna_zoom = instance_create(tenna_actor.x, tenna_actor.y - 154, obj_tenna_zoom);  // :1225
tenna_zoom.minigametype  = minigametype;   tenna_zoom.minigamedifficulty  = difficulty;
tenna_zoom.minigametype2 = minigametype2;  tenna_zoom.minigamedifficulty2 = difficulty2;
tenna_zoom.minigametype3 = minigametype3;  tenna_zoom.minigamedifficulty3 = difficulty3;
```

`obj_tenna_zoom_Other_11.gml` (event_user(1), fired from its own
`Step_0:127`) is the **second dispatcher**, keyed on the string:

```
if (minigametype == "susiezilla")  -> obj_susiezilla_gamecontroller.setup(1..7)   // :10-35
if (minigametype == "music")       -> obj_rhythmgame, tenna_boss=true, len 360    // :37-46
if (minigametype == "cooking")     -> obj_chefs_init, difficulty 0 or 2           // :48-149
if (minigametype == "cowboy")      -> obj_shootout_controller, type 2 or 3        // :151-244
if (minigametype == "battle")      -> difficulty 1 sharpshoot / 2 ball / 3 finale // :246-378
```

---

## 2. The chooser — `obj_tenna_enemy_Other_10.gml` (event_user(0))

Called from `Step_0:44-62`, once per turn, gated on
`scr_isphase("enemytalk") && talked == 0 && attackchosen == false`.

### 2a. The bullet ladder (above half HP)

```
 6  if (!minigameactivated)
 7      phaseturn++;
22  if (phaseturn == 1)  myattackchoice = 0;                       // all star cast
25  if (phaseturn == 2)  myattackchoice = 1;                       // smashcut
28  if (phaseturn == 3) { myattackchoice = 2; phaseturn = 0; }     // rimshot lensflare
```

Three attacks on a loop. `minigameactivated` is reset to `false` at the end of
every turn (`Step_0:713`), so `phaseturn` normally increments each turn — except
on a turn where the player ACTed **Minigame**, which preserves the ladder position.

**Only three of the boss's own bullet attacks are real: types 125, 126, 128.**

### 2b. What forces a PHYSICAL CHALLENGE turn (`myattackchoice = 3`)

```
34  if (global.monsterhp[myself] <= (global.monstermaxhp[myself] * 0.5))
35  {   myattackchoice = 3; minigamecount++; minigameactivated = true;   }
41  if (minigameactivated && minigamecount <= 5) { myattackchoice = 3; minigamecount++; }
47  if (minigameactivated && minigamecount >= 6) { myattackchoice = 3; minigamecount++;
                                                   _minigamecount = 2; }   // DOUBLE FEATURE
54  if (minigameinsanity == true) { minigameactivated = true; myattackchoice = 3; }
```

Three independent triggers:

* **the player**, ACTing "Minigame" (`Step_0:839-872`: acting 2/3/4/5 all fall
  into `acting = 5.1`, which sets `minigameactivated = true` at `:867`);
* **half HP** (`:34`) — from then on *every* turn is a minigame. Note `:34` and
  `:41` both fire on the same pass, so `minigamecount` climbs **two per turn**;
  by the fourth sub-50% turn it is ≥ 6 and every turn becomes a **double feature**;
* **minigame insanity** (`:9-10`, see §4).

### 2c. Which minigame — the `global.tempflag[91]` ladder (`:78-292`)

`global.tempflag[91]` is written **nowhere else in the chapter** (grep), so it is
a pure per-fight counter. `repeat (_minigamecount)` runs the ladder once or twice
and stores into `minigametype`/`difficulty` (`_i == 0`) or
`minigametype2`/`difficulty2` (`_i == 1`).

| tempflag[91] | minigame | line |
|---|---|---|
| 1 | cooking d0 | :84-88 |
| 2 | music | :90-94 |
| 3 | battle d1 (sharpshoot) | :96-100 |
| 4 | cowboy d0 | :102-106 |
| 5 | music | :108-112 |
| 6 | *skipped* → 7 | :114-115 |
| 7 | `flag[1197] > 0` ? **susiezilla d2** : **battle d2** | :117-129 |
| 8 | cowboy d1 | :131-135 |
| 9 | music | :137-141 |
| 10 | cowboy d0 | :143-147 |
| 11 | *skipped* → 12 | :149-150 |
| 12 | battle d2 | :152-156 |
| 13 | music | :158-162 |
| 14 | cooking d0 | :164-168 |
| 15 | `flag[1197] > 0` ? **susiezilla d3** : **battle d1** | :170-182 |
| 16 | cowboy d1 | :184-188 |
| >16 | weighted random pool | :190-264 |

The random pool (`:192-263`):

```
var randomchosen = choose(0, 0, 0, 1, 2, 3, 4, 5);
if (global.flag[1197] > 0)
    randomchosen = choose(0, 0, 0, 1, 3, 4, 5, 6, 7);
repeat (3) {                                  // anti-repeat vs the last two picks
    if (randomchosen == randomchosenprev1 || randomchosen == randomchosenprev2)
        randomchosen += 2;
    if (global.flag[1197] == 0 && randomchosen > 5) randomchosen -= 5;
    if (global.flag[1197] > 0 && randomchosen > 7) randomchosen -= 7;
}
0 music · 1 cooking d0 · 2 cowboy d0 · 3 cowboy d1
4 battle d1 · 5 battle d2 · 6 susiezilla d2 · 7 susiezilla d4
```

Two derivations from that wrap arithmetic:

* With `flag[1197] == 0` the reachable set is exactly **0–5**: the pool tops out
  at 5, `+2` can reach 7, and `-5` brings 6→1 and 7→2. **susiezilla can never
  appear without the flag.**
* With `flag[1197] > 0`, value **2** *is* reachable even though it is absent from
  the pool — `0 + 2 = 2`, and `7 + 2 = 9 → 9 - 7 = 2`. So cowboy d0 stays real
  on both routes.

`global.flag[1197]` is the banked PHYSICAL CHALLENGE score from earlier in the
chapter (`obj_round_evaluation_Draw_0.gml:402-404`,
`global.flag[1197] = physicalchallengepoints`). It is a **run-dependent gate**,
not a random one — the three susiezilla turns are real but conditional.

---

## 3. The real roster

### Bullet turns (red soul, standard box)

| choice | type | name | turn | spawns |
|---|---|---|---|---|
| 0 | 125 | **all star cast** | 200 | `obj_tenna_allstars_manager` → `obj_tenna_allstars_bullet` (`dbulletcontroller_Step_0:2526-2535`) |
| 1 | 126 | **smashcut** | 260 | `obj_tenna_smashcut_attack` (`:2552-2560`) |
| 2 | 128 | **rimshot lensflare** | 260 | two `obj_tenna_rimshot_star` at `btimer` 103 and 117, from two sides 90° apart; `snd_rimshot` pulses on `btimer % 78 == 50` (`:2562-2612`) |

### PHYSICAL CHALLENGE turns (choice 3, string-dispatched)

| minigametype | diff | caption (`Other_13`) | built at | gate |
|---|---|---|---|---|
| music | 0 | PERFORM! | `Other_11:37-46` | — |
| cooking | 0 | DODGE FIRE! | `Other_11:48-105` | — |
| cowboy | 0 | SHOOT! | `Other_11:212-213` | — |
| cowboy | 1 | DODGE! | `Other_11:215-219` | — |
| battle | 1 | SHOOT THE TARGETS! | `Other_11:251-267` | — |
| battle | 2 | BOUNCE THE BALL! | `Other_11:269-356` | — |
| battle | 3 | *(no caption — the finale)* | `Other_11:358-377` | insanity only |
| susiezilla | 2 | PROTECT RALSEI! | `Other_11:17-18` | `flag[1197] > 0` |
| susiezilla | 3 | FIGHT...? | `Other_11:20-21` | `flag[1197] > 0` |
| susiezilla | 4 | FIGHT...? | `Other_11:23-24` | `flag[1197] > 0` |

**The two `battle` type-150 attacks are the same controller with different
targets.** Both do `dc.type = 150` *and* `dc.minigamedifficulty = 1` — that field
does **not** discriminate. The discriminator is in
`obj_lightemup_controller_Create_0.gml:1-8`:

```
inst = instance_create_depth(x + 120, y + 150, depth + 10, obj_shadowman_sharpshoot_target);
inst.type = 4;                                                  // LIGHT 'EM UP
if (obj_tenna_enemy.myattackchoice == 21)          inst.type = 5;
if (i_ex(obj_tenna_zoom) && obj_tenna_zoom.minigamedifficulty == 1) inst.type = 5;   // sharpshoot
```

It reads the **zoom's** difficulty. d1 → target type 5 (sharpshoot practice);
d3 → target type 4 (the real finale).

---

## 4. Phases

**Phase 1 — points.** Bullet ladder 0/1/2 on loop; minigames only when the player
buys one with the "Minigame" ACT. Score meter on `obj_tenna_enemy_bg`
(`myscore` / `maxscore 1000`). The point multiplier climbs with turn count
(`Step_0:52-59`: turn 10 → 1.3, 15 → 1.6, 20 → 2.0).

**Phase 2 — half HP** (`Other_10:34-39`). Every turn is a PHYSICAL CHALLENGE;
after ~4 turns every turn is a **double feature** (`_minigamecount = 2`,
chained by the zoom at `Step_0:769-798` via `con == 3`).

**Phase 3 — MINIGAME INSANITY** (`Other_10:9-10`):

```
if ((global.monsterhp[myself] <= (global.monstermaxhp[myself] * 0.2)
     || obj_tenna_enemy_bg.myscore >= 1000) && haveusedultimate == false)
    minigameinsanity = true;
```

The chooser forces **music** as the turn's opener (`:287-291`), then
`obj_tenna_zoom` takes over and channel-surfs (`Step_0:279-445`):

* `minigameinsanitytimermax` shrinks `120 → 110 → … → 50`, then `→ 39 → 38 → …`,
  clamped at **30** (`:304-311`);
* once it is `<= 60` the pool narrows to `choose(1, 2, 4, 5)` — **no music, no
  susiezilla** (`:339-340`, with its own wrap at `:347-356`);
* each flip bumps `obj_tenna_minigame_ui.channelnumber` and fires
  `obj_screen_channel_change`;
* once `minigameinsanitytimermax == 30`, each flip increments
  `obj_tenna_enemy.minigameinsanitycount`, and **on the 5th** (`:423-437`):

```
minigametype = "battle";  minigamedifficulty = 3;
minigameinsanity = false; minigameinsanityintro = false;
with (obj_tenna_enemy) phaseturn = 18;
```

**Phase 4 — LIGHT 'EM UP.** `Other_11:358-377` announces `"lightemup"` and spawns
the type-150 controller. This turn **never ends**: `obj_tenna_zoom_Step_0:14-15`
floors `global.turntimer` at 4 on every step, and the zoom's exits to `con = 2`
(`:448-468`, `:561-571`) have **no arm for `minigamedifficulty == 3`**. The whole
finale plays out inside that one turn, and the fight ends from
`Step_0:37-42` (`myscore >= 1000 && haveusedultimate` → `endcon = 1`).

**The finale's bullets do not come from the controller.** `obj_actor_tenna`'s
**Draw** event runs the pattern generator, gated on
`i_ex(obj_lightemup_controller) && obj_shadowman_sharpshoot_target.type == 4`
(`obj_actor_tenna_Draw_0.gml:1063`), spawns `obj_tenna_lightemup_bullet`
(`:1410-1506`), sets `obj_tenna_enemy.stopshoot` (`:1072-1076`) and prints
`"DEFEAT TENNA!"` (`:1078-1083`).

### Damage model

Minigames do **no damage while you play them**. `obj_tenna_zoom` counts
`minigamefailcount` (capped at 3, `Step_0:1295-1296`); the boss cashes it in
afterwards at `Step_0:1298-1375` — **56 / 26 / 18** for the 1st / 2nd / 3rd+ fail
of the fight, `scr_damage_all()`, or doubled onto Ralsei alone if POPULAR BOY is
active (`:1318-1326`).

---

## 5. The cut list

| # | entry | why it can never be chosen |
|---|---|---|
| 1 | **choice 20 — "light em up"** (`Step_0:609-615`) | The only writer of `myattackchoice = 20` in ch3 is `obj_tenna_enemy_Other_12.gml:74-78`. Other_12 is **event_user(2)**, and no code anywhere in the chapter does `with (obj_tenna_enemy) event_user(2)` — the object only ever calls `event_user(0)` (`Step_0:50`). |
| 2 | **choice 21 — sharpshoot debug** (`Step_0:616-622`) | Selected only by `Other_10:12-17`, behind `testsharpshoot == true`. `testsharpshoot` is written exactly once in the chapter: `testsharpshoot = false;` (`Create_0:122`). |
| 3 | **type 127 — lensflare only** (`dbulletcontroller_Step_0:2537-2550`) | Chapter-wide grep for `type = 127`: no hits. |
| 4 | **type 129 — fast rimshot** (`:2562-2611`, one star, rate 27/20) | Chapter-wide grep for `type = 129`: no hits. |
| 5 | **cooking d2** (`Other_11:107-148`, microgame 1, freq 50) | Every cooking assignment pins difficulty 0 — `Other_10:86-87`, `:166-167`, `:225-226`, and the insanity re-roll `obj_tenna_zoom_Step_0:383-384`. |
| 6 | **cooking d1 / d3 — "DODGE AND SERVE!"** (`Other_13:59-60`, `:65-66`) | Captions exist, but `Other_11`'s cooking block has arms only for difficulty 0 and 2 — there is **no setup body** for 1 or 3, and no chooser writer. |
| 7 | **battle d0 — "PHOTO 3 SMILES!"** (`obj_shutta` photo minigame) | Doubly dead. (a) No chooser ever yields battle difficulty 0. (b) Even if it did, `Other_11:248-249` rewrites `if (minigamedifficulty == 0) minigamedifficulty = choose(1, 2);` and **Other_11 runs before Other_13** (`obj_tenna_zoom_Step_0:127` vs `:275`), so the default caption at `Other_13:88` can never print. Its teardown still survives at `Other_12:78-88`. |
| 8 | **susiezilla d1 — BREAK THE STATUE!** (`Other_11:14-15`) | Chooser produces susiezilla 2, 3, 4 only (`Other_10:121-122`, `:174-175`, `:255-256`, `:261-262`). |
| 9 | **susiezilla d5 — DESTROY HOUSES!** (`Other_11:26-27`) | Wave-spawn arcade mode (`susiezilla_gamecontroller_Create_0:269-270`). No chooser writer. |
| 10 | **susiezilla d6 — DESTROY HOUSES!** (`Other_11:29-30`) | Same; `Create_0:272-273`. No chooser writer. |
| 11 | **susiezilla d7** (`Other_11:32-33`) | `susiezilla_gamecontroller_Create_0:275-277` is an **empty body**, and Other_13 has no caption for it. |
| 12 | **the whole `Other_12` alt chooser + TRIPLE FEATURE** | `obj_tenna_enemy_Other_12.gml:1-78` is a complete alternative 18-step ladder (`myattackchoice = choose(0, 1, 2)` at `:59`, `_minigamecount = 3` at `:71`). Orphaned, as in row 1. It writes `_minigamecount`, a var **local to Other_10** (declared `Other_10:1`) — proof it was split off from the live chooser. Consequently `minigametype3`/`difficulty3`, plumbed through `Create_0:39-40`, `Step_0:1230-1231`, `obj_tenna_zoom_Create_0:32-33` and the `con == 3` chain (`obj_tenna_zoom_Step_0:769-798`), is unreachable: the live chooser sets `_minigamecount` to 1 or 2 only. |
| 13 | **`Other_10` `phaseturn == 18` / `== 19` blocks** (`:60-67`, `:69-76`) | Byte-for-byte duplicates. Neither runs: `phaseturn = 18` is assigned **mid-turn** by `obj_tenna_zoom_Step_0:435`, and the same block starts LIGHT 'EM UP immediately without the chooser; that turn then never ends (§4), so `event_user(0)` never runs again and `phaseturn` stays 18 — which is exactly what `obj_tenna_minigame_ui_Draw_0.gml:1` tests for. The only other writer is the dead `testlightemup` flag (`Other_10:19-20`; written `false` once at `Create_0:121`, read by `obj_darkener_Draw_0.gml:6`). |

---

## 6. Notes for the generator / studio

### boxBlock — verified

```json
{ "file": "gml_Object_obj_tenna_enemy_Step_0.gml",
  "anchor": "if (myattackchoice < 3)", "ifElse": false }
```

One occurrence in the file; `ifStatementEnd` yields a **brace-balanced 325-char**
slice (`Step_0:555-562`) containing the only `obj_growtangle` creation in the boss
and the `scr_moveheart()` call. Tenna never resizes the box — no `maxxscale`
anywhere. The `< 3` guard is load-bearing and correct: choice 20 (LIGHT 'EM UP)
must get **no** box, and it doesn't.

### No turnBlock — on purpose

Every turn length is **inside** its dispatcher branch, so the per-attack `setup`
slice carries it. Verified by running `gen_attacks.js`'s own scanner:

```
"all star cast"     sel=myattackchoice==0  type=125  setup 219 chars  escaped=false  balanced
"smashcut"          sel=myattackchoice==1  type=126  setup 214 chars  escaped=false  balanced
"rimshot lensflare" sel=myattackchoice==2  type=128  setup 223 chars  escaped=false  balanced
"light em up"       sel=myattackchoice==20 type=150  setup 188 chars  escaped=false  balanced
```

Each ends in its own `scr_turntimer(200 / 260 / 260 / 999999)`. The only
out-of-branch call is `scr_turntimer(90)` at `Step_0:565`, which is raise-only and
identical to the studio's fallback (`gml_studio.html:1897`) — a strict no-op. Any
slice wide enough to include it either breaks brace balance or re-runs the
spawners (the Knight double-spawn trap).

### The type-150 dedup collision

Three dispatches produce `obj_dbulletcontroller.type = 150`:

| source | name | selector seen by the scanner |
|---|---|---|
| `obj_tenna_enemy_Step_0:609-615` | `light em up` | `myattackchoice == 20` (**cut**) |
| `obj_tenna_zoom_Other_11:251-267` | `sharpshoot test` | forced to `null` (extra file) |
| `obj_tenna_zoom_Other_11:358-377` | `lightemup` | forced to `null` (extra file) |

`gen_attacks.js`'s dedup key is `boss|controller|type|pattern|datecount`
(`:529`), so all three collapse to **one** entry, and the boss's own event files
are scanned before `extraAttackFiles` — so the **cut choice-20 entry wins**.

By luck it still plays the real finale: `obj_lightemup_controller_Create_0.gml:4-8`
downgrades the target to type 5 only when `myattackchoice == 21` or
`obj_tenna_zoom.minigamedifficulty == 1`, and choice 20 satisfies neither. But
the **sharpshoot** variant is unreachable from the dropdown unless an
`obj_tenna_zoom` is faked with `minigamedifficulty = 1`. Note also that the two
`Other_11` entries arrive with `selector: null`, which fails the studio's
`bossDispatched` gate (`gml_studio.html:1684-1685`) — so they would get no box
block, no turn block and no setup even if they survived dedup.

### What the studio will need

1. **Register the boss.** `MONSTER_TYPE` (`gml_studio.html:1572-1578`) needs
   `obj_tenna_enemy: 103`, and the `BOSSES` list an entry. The boss's own Create
   builds the rest of the cast for free — `obj_actor_tenna` preset 2
   (`Create_0:80-81`), `obj_tenna_enemy_bg` (`:88-89`), `obj_tenna_minigame_ui`
   (`:91`) — but it also calls `scr_enable_screen_border(1)`,
   `scr_enemy_object_init()`, `scr_speaker("tenna")` and destroys
   `obj_battleback`, and `Step_0:1-10` **exits outright** without
   `obj_herosusie` and `obj_heroralsei`.
2. **A `launch: 'tenna-minigame'` mode**, the way Pink's dates are declared:
   carry `minigametype` + `difficulty`, create `obj_tenna_zoom` with those two
   fields set, and skip the `obj_actor_tenna` jump-in. Without it none of the ten
   PHYSICAL CHALLENGE variants can be selected at all.
3. **LIGHT 'EM UP needs `obj_actor_tenna` alive and drawing** — its bullets come
   from a 1877-line Draw event. The studio's `also` list nulls `step` but leaves
   `draw`, which is exactly what this needs. `obj_lightemup_controller`'s Create
   also touches `obj_herokris` / `obj_herosusie` / `obj_heroralsei` **unguarded**
   and calls `scr_act_charsprite` on all three, so a full three-hero party is
   required.
4. **Unimplemented natives.** The cowboy setup calls `layer_create`,
   `layer_background_create`, `layer_background_htiled`,
   `layer_background_stretch` and `layer_background_speed`
   (`Other_11:221-243`) — all five are in `docs/js/native_gaps.json`, and
   `ch3/obj_tenna_zoom_Other_11.gml` is literally the cited example for
   `layer_background_speed`.
5. **The zoom transition is cosmetic** but uses
   `sprite_create_from_surface(application_surface, …)` (`obj_tenna_zoom_Step_0:117`),
   drawn back by `obj_battlecontroller_Draw_0.gml:32`. It can be stubbed by
   jumping straight to `con = 1` with `event_user(1)` already fired.
6. **The other minigames are whole subsystems.** susiezilla needs
   `obj_mainchara.cutscene`, a 1280-wide sub-world, `scr_script_delayed` and
   `scr_dark_marker`; cooking needs the `obj_chefs_*` kitchen plus
   `scr_chefs_end`; music needs `obj_rhythmgame`'s chart data and audio sync.
7. **Scoring is routed.** `scr_tenna_add_score.gml:20-23` sends points to
   `obj_tenna_minigame_ui.myscore` while `obj_tenna_zoom` exists, and to
   `obj_tenna_enemy_bg.addscore` otherwise — and `addscore` only drains into
   `myscore` while `global.mnfight == 0` (`obj_tenna_enemy_bg_Other_10.gml:59-62`).
   A studio run with no battle phase will show 0 points forever.
8. `obj_tenna_allstars_manager` (the one attack most likely to run today) uses
   `ds_list`, two surfaces, a GML 2.3 `spawn_new = function(arg0)` method, and
   opens with `snd_loop(snd_crowd_laughter_loop)` (`Create_0:1-15`).
