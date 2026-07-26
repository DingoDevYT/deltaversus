# Lanino & Elnina (ch3) — the REAL roster, derived from the chooser

**Fight:** encounter 113. **Enemies:** `obj_lanino_enemy` + `obj_elnina_enemy`.
**Attack owner:** `obj_elnina_lanino_controller`.
**Verdict: 5 real attacks (one per `special` value), played across a fixed
7-turn ladder, each with a left/right `side`. 12 dispatcher-level entries in the
Lanino/Elnina family are cut — including two complete unused attacks written for
this fight (`obj_lanino_solar_system`, `obj_elnina_snowring`).**

Unlike the first five bosses, the ratio here is not "many dispatcher branches,
few chosen". It is the opposite: **one dispatcher branch, one `dc.type`, and the
variety comes from a second field.** The cut content is in `obj_dbulletcontroller`
around it, and in a whole vestigial dispatch mechanism inside the controller that
nothing reads.

---

## 0. Where the fight actually lives

`scr_encountersetup.gml:702-725` builds encounter 113:

```
709:            global.monsterinstancetype[0] = obj_lanino_enemy;      // monstertype 61
713:            global.monsterinstancetype[1] = obj_elnina_enemy;      // monstertype 60
719:            global.rank1turns = 7;
```

Neither enemy object contains attack code. `gml_Object_obj_lanino_enemy_Step_0.gml`
is 133 lines and `gml_Object_obj_elnina_enemy_Step_0.gml` is its mirror image;
both are `global.myfight == 3` ACT handling and nothing else. Every ACT writes
back into a third object:

```
obj_elnina_enemy_Create_0.gml:25   instance_create(x, y, obj_elnina_lanino_controller);
```

`obj_elnina_lanino_controller` (Create 61 lines, **Step 2231 lines**, Draw 135,
Alarm_6 52) owns the intro, the forecast HUD, the turn ladder, the single
dispatcher, ~1100 lines of post-bullet dialogue, and the win.

**There is no `monsterattackname` anywhere in this fight.** Grepping the
controller Step, both enemy objects, both rematch enemies and the rematch
controller returns nothing. `gen_attacks.js`'s announcement scan finds zero
attacks for this boss whatever you put in `enemy`. `selectorScan` is no help
either — the dispatch is not the Ch1 `if (var == N) spawn` shape, and scanning
`turns == N` over the controller Step would hit 40+ dialogue branches.
**This roster is declared, not scanned.**

---

## 1. The dispatcher — one site, one type

`gml_Object_obj_elnina_lanino_controller_Step_0.gml:1078-1178`, in the bullets
phase at `rtimer == 12`:

```
1117:        var _a = 379;
1118:
1119:        if (!i_ex(obj_lanino_enemy))
1120:            _a = 946;
1121:
1122:        with (_a)
1123:        {
1124:            dc = scr_bulletspawner(x, y, obj_dbulletcontroller);
1125:            dc.type = 130;
1126:
1127:            if (other.turns == 0)
1128:                dc.special = 0;
...
1148:            if (other.turns == 7)
1149:                dc.special = 4;
1150:
1151:            if (_lanino_favored)
1152:                dc.side = 0;
1153:            else
1154:                dc.side = 1;
1155:        }
```

`379` and `946` are raw object indices — `objects.tsv` line 381 is
`obj_lanino_enemy` (381 − 2 = 379) and line 948 is `obj_elnina_enemy` (946).
So the spawner runs with `self` = Lanino, falling back to Elnina if Lanino is
dead. (The rematch's `993` / `1591` check out the same way: lines 995 and 1593.)

`dc.difficulty` is never written, so it keeps `obj_dbulletcontroller_Create_0.gml:21`'s
default of **0**.

Type 130 is a thin wrapper — `gml_Object_obj_dbulletcontroller_Step_0.gml:2614-2627`:

```
2618:        var _mascot_attack = instance_create(obj_growtangle.x, obj_growtangle.y, obj_elnina_mascotattack);
2619:        _mascot_attack.attacktype = special;
2620:        _mascot_attack.favored    = side;
2621:        _mascot_attack.type       = difficulty;
...
2626:    if (special != 4)
2627:        exit;
```

All five attacks are branches of `obj_elnina_mascotattack_Step_0.gml` (456
lines). The only thing the controller keeps for itself is the final attack's
dialogue timing (2629-2746).

**So the attack selector is `dc.special`, and the chooser is `turns`.**

---

## 2. The chooser — `turns`, and the two regulators on it

`turns = 0` at `Create_0.gml:3`, and increments once per enemy turn:

```
Step_0:310    if (scr_isphase("enemytalk") && talked == 0 && !i_ex(obj_rouxls_ch3_enemy))
Step_0:332        turns += 1;
```

Two regulators sit on it, both in the **menu** phase (which runs one phase
before enemytalk):

```
Step_0:228        turn2_turns++;
Step_0:230        if (ilovetv > 0)
Step_0:232            if (turn2_turns > 2 && turns < 2)
Step_0:233                turns = 2;
Step_0:235        else if (turns > 1 && ilovetv == 0 && turn2_turns < 7)
Step_0:237            turns = 0;
```

and one more in enemytalk, right after the increment:

```
Step_0:334    if (ilovetv > 0 && turn2_turns > 2 && turns < 3)
Step_0:335        turns = 3;
```

Read together:

* **If the player never says "I LOVE TV"**, line 237 pins the ladder — `turns`
  is knocked back to 0 every menu phase, then bumped to 1 in enemytalk, so
  **special 0 repeats** for up to seven menu phases (`turn2_turns < 7`).
* **Once anyone says it**, lines 233 and 335 fast-forward straight to turn 3
  (the choicer turn) and the ladder proceeds normally.
* Nothing ever decrements past that, and nothing is random.

**The ladder is therefore fixed:**

| turn | `dc.special` | `scr_turntimer` | box y | notes |
|---|---|---|---|---|
| 1 | 0 | 260 | view+170 | bullets KISS on contact |
| 2 | 0 | 260 | view+170 | last kiss turn |
| 3 | 1 | 260 | view+170 | Rain/Shine choicer afterwards |
| 4 | 2 | 260 | view+170 | in-bullet cut-in (`extratimer`) |
| 5 | 3 | 275 | view+170 | |
| 6 | 3 | 275 | view+170 | same attack, new dialogue |
| 7 | 4 | **850** | **view+190** | finale, then `scr_wincombat()` |

Turn 7 is the last: `Step_0:1992` (`ballooncon == -1 && turns == 7`) hands off to
the ending chain 23 → 23.1 → … → 24.5 → 25 → 25.5 → 26 → 27 → 28, and
`Step_0:2186` calls `scr_wincombat()`. `turns` never reaches 8.

Turn-length ladder, `Step_0:1159-1169` — this is the `turnBlock`:

```
1159:        if (turns < 5)
1160:            scr_turntimer(260);
1162:        if (turns == 5)
1163:            scr_turntimer(275);
1165:        if (turns == 6)
1166:            scr_turntimer(275);
1168:        if (turns == 7)
1169:            scr_turntimer(850);
```

The base `scr_turntimer(90)` at `Step_0:1062` sits outside the slice. Harmless —
`scr_turntimer` only *raises*, and every ladder value is larger.

Box block, `Step_0:1049-1056`:

```
1049:    if (!instance_exists(obj_growtangle))
1050:    {
1051:        if (turns < 7)
1052:            instance_create(view.x + 320, view.y + 170, obj_growtangle);
1054:        if (turns == 7)
1055:            instance_create(view.x + 320, view.y + 190, obj_growtangle);
1056:    }
```

No `maxxscale` / `maxyscale` override, so it is the default 2×2 box
(`obj_growtangle_Create_0.gml:12-13`). **Both blocks read `turns`, a controller
variable — they must be replayed with `self` = an `obj_elnina_lanino_controller`
instance.** That is why the JSON's `enemy` field names the controller rather
than a monster.

---

## 3. The second axis — `side` / `favored`

```
Step_0:304    var _lanino_favored = (lastchosen == "" && sunboost > 0) || lastchosen == "lanino";
```

Before turn 3, `lastchosen` is `""` and favouritism is driven purely by ACTs:

```
obj_lanino_enemy_Step_0.gml:32-33   if (…sunboost < 3)  sunboost++;    // "I Love TV" to Lanino
obj_elnina_enemy_Step_0.gml:32-33   if (…sunboost > -3) sunboost--;    // "I Love TV" to Elnina
```

After turn 3's bullets the game asks outright — a two-option choicer:

```
Step_0:1513   global.choicemsg[0] = stringsetloc("#Rain",  …);
Step_0:1514   global.choicemsg[1] = stringsetloc("#Shine", …);
...
Step_0:1535   if (global.choice == 0) { sunboost = -3; lastchosen = "elnina"; … }
Step_0:1557   if (global.choice == 1) { sunboost =  3; lastchosen = "lanino"; … }
Step_0:1579   global.flag[1017] = global.choice;
```

and from then on `lastchosen` **locks** favouritism for the rest of the fight.
Both values are reachable for every `special`, so the real set is
**5 attacks × 2 sides**. `side` 0 = Lanino (moon mascot, `mascot[0]`,
`ms[0][*]`), `side` 1 = Elnina (cloud mascot, `mascot[1]`, `ms[1][*]`) —
confirmed by the type-130 finale dialogue, which puts the "Nice move, huh,
Lanino!?" line in `obj_elnina_enemy`'s mouth when `side == 1`
(`obj_dbulletcontroller_Step_0.gml:2634-2642`).

---

## 4. The five real attacks

All: `obj_dbulletcontroller`, `type = 130`, `difficulty = 0`, `side` 0 or 1.

### special 0 — Weather Report (turns 1, 2) · 260 frames
`obj_elnina_mascotattack_Step_0.gml:33-34` places the two mascots at
box.x ± 72, y − 116; `131-141` drifts both with a sine sway; `197-198` sets
shotrate 11/11. At `siner == 162` both switch to their KISS sprite `ms[i][1]`
and at `168` a `spr_ch3_bullet_heart` marker floats up (lines 138-139, 188-195).
The signature is in the bullet, not the mascot:

```
obj_regularbullet_elnina_Step_0.gml:44   if (i_ex(obj_elnina_lanino_controller) && obj_elnina_lanino_controller.turns <= 2)
                                    46-54     … both bullets become a pink spr_ch3_bullet_heart
```

Two bullets that meet turn into hearts instead of annihilating. The couple is
in love. (Reachable evidence: `Step_0:1127-1134` assigns special 0 for turns 0,
1 and 2, and line 237 makes turns 1 repeat indefinitely for a player who never
ACTs.)

### special 1 — the favored one grows (turn 3) · 260 frames
`Step_0:1136-1137`. `mascotattack:37-41` scales `mascot[favored]` to 2.25× and
line 133 exempts it from the drift, so it hangs still and huge while the partner
keeps sliding. shotrate stays 11 (lines 197-198, 215-216). **First turn where
bullets annihilate** — `turns <= 2` is now false, so the else at
`obj_regularbullet_elnina_Step_0.gml:56-81` destroys both with a bump and a grey
shrink-ball. The couple is fighting. Post-bullet, the Rain/Shine choicer runs.

### special 2 — smug vs. scared (turn 4) · 260 frames
`Step_0:1139-1140`. `mascotattack:43-63` gives the favored mascot `ms[i][2]`
(*_large_smug*) at 1.7× and the other `ms[i][4]` (*_scared*) at 1.5×; `142-148`
makes the favored one sway wide while the loser jitters; `218-225` sets shotrate
14 + `extrabulletrate` for both and 8 for the favored one and bumps both speed
components; `284-285` gives every bullet grazepoints 3; `356-368` scales the
favored side's bullets to 1.5 and the other side's to 0.8. Turn 4 also plays a
scripted cut-in **during** the bullets — `Step_0:1223-1306`: at `extratimer 39`
the un-favored partner walks 70px across, at 50 and 100 they say "Wh-what the!?"
and "It's ruining MY attack!", at 140 they walk back.

### special 3 — the chase (turns 5 and 6) · 275 frames
`Step_0:1142-1146` — **both** turns set special 3, with the same turn length
(1162-1166 are duplicated arms). `mascotattack:65-92` puts both mascots in
motion (favored `ms[i][2]` at 2×, speed 6; other `ms[i][4]` at 1× mirrored,
speed 4.4, both launched at `90 + 90 * facing[favored]`); `149-176` bounces them
off a 140px (favored) / 110px (other) square around the box centre, adding 90°
to `image_angle` and `direction` on each bounce; `227-232` sets shotrate 13 /
favored 6; `370-398` re-aims every bullet at the box centre with a ±15 (favored,
2×, speed 1) or ±35 (other, 1×, friction −0.1) spread instead of the usual
gravity arc. Turns 5 and 6 differ only in dialogue (`Step_0:438-486` vs
`488-535` before, `1603-1636` vs `1805-1828` after).

### special 4 — FINAL ATTACK (turn 7) · **850 frames**
`Step_0:1148-1149` + `1168-1169`. The only special that keeps running code
inside `obj_dbulletcontroller`; every other one hits `if (special != 4) exit;`
at `2626-2627`. Lines `2629-2746` fire "Nice move, huh, <partner>!?" /
"… <partner>?" / "… oh…" at turntimer 500 / 350 / 200, with `obj_writer` kills
at 400 / 250 / 100.

`mascotattack:94-120` seats the favored mascot (`ms[i][3]`, *_huge_gloat*, 2×)
at the box centre and parks the other (`ms[i][6]`, *_chase_small*) at
box.x − 120. `400-418` **destroys every bullet the un-favored mascot tries to
fire** and fades it out 0.05 alpha/scale per shot. `234-265` ramps the favored
shotrate from 7 (6 if the soul is above half HP) and, once turntimer < 500, to
`(65 + extrabulletrate) − turntimer/10`; fades the battle music with
`mus_volume`; swaps the mascot to `ms[favored][7]` (*_large_smug_sad*),
advancing `image_index` at 350 and 200; and stops firing entirely
(shotrate 9999) at turntimer ≤ 250. `420-441` lerps each surviving bullet up to
3× scale, flips gravity left or right via `choose(0, 180)`, and dooms it after
100 frames. This is also the only turn whose box is 20px lower.

---

## 5. Cut — and why

### 5a. The vestigial weather dispatch (`_sun_atk` … `_rain_atk`)

```
Step_0:305    var _sun_atk  = 68;
Step_0:306    var _moon_atk = 69;
Step_0:307    var _snow_atk = 70;
Step_0:308    var _rain_atk = 71;
```

Those four numbers are real `obj_dbulletcontroller` types:

| type | branch | what it is |
|---|---|---|
| 68 | `obj_dbulletcontroller_Step_0.gml:775-809` | `obj_bullet_sun`, bouncing |
| 69 | `:810-895` | `obj_bullet_submoon` arcs |
| 70 | `:896-977` | rejection-sampled `obj_bullet_snow` field |
| 71 | `:979-1027` | `obj_rainwater` flood |

The controller writes them into `lanino_attack` / `elnina_attack` in **29
places** — every line of `Step_0` in 542…1008 that names a weather:
542, 548, 648, 649, 682, 683, 687, 716, 717, 790, 791, 866, 872, 877, 880, 897,
900, 904, 910, 930, 936, 941, 944, 961, 964, 968, 974, 994, 1008 (plus the
`= 0` clears at 543, 549, 995, 1007) — as the dialogue announces each weather
("… Moon.", "… Drop.", "TRUEST Crystal!", "EXTRA DEXTRA Sun!").

**Nothing in Chapter 3 ever reads `lanino_attack` or `elnina_attack`.** A
recursive grep over the whole Ch3 dump returns only the two Create initialisers
(`obj_elnina_lanino_controller_Create_0.gml:7-8`,
`obj_elnina_lanino_rematch_controller_Create_0.gml:7-8`) and the assignments
themselves. There is no reader, and the controller's only `dc.type` write is the
`130` at line 1125.

This is the fossil of a design where each announced weather launched its own
bullet attack. What shipped uses the forecast only to pick a bullet **sprite**
(§6). Of the four, 69 and 71 survive elsewhere — `obj_rouxls_ch3_enemy_Step_0.gml:2925,
2939` and `:2928, 2942`, plus `obj_watercooler_enemy_Step_0.gml:104` — but never
here. **68 and 70 have no dispatcher anywhere in Chapter 3.**

### 5b. Undispatched Lanino/Elnina attacks in `obj_dbulletcontroller`

Verified by `grep -rn 'type *= *<n>;'` across the whole Ch3 dump; the only
`.type` writes in the 65-79 / 125-145 range are
`obj_zapper_enemy` (65/66/67), `obj_rouxls_ch3_enemy` (69/71/72/73/73.1/74),
`obj_watercooler_enemy` (69/135), `obj_tenna_enemy` (125/126/128),
`obj_tenna_board4_enemy` (125), `obj_shutta_enemy` (145),
two room PreCreates (135), the rematch controller (130/141) and **this fight's
single 130**.

| type | line | what it is | why cut |
|---|---|---|---|
| **72.1** | `:1065-1151` | mascotattack with `dummy = true` — mascots as scenery plus a separate pattern | no writer; `dummy` is the mascot's other unreachable mode (`Create_0.gml:23`, `Step_0.gml:24-30, 272`) |
| **73.5** | `:1518-1588` | `obj_rouxls_moon_bullet` + `obj_rouxls_cloud_bullet` pair | no writer (Rouxls dispatches 73 and 73.1 only) |
| **75** | `:1623-1738` | **Lanino SOLAR SYSTEM** — box scaled to 3×, `obj_lanino_solar_system` + orbiting `obj_lanino_solar_system_orbit` rings | no writer. A complete attack with five event files that never runs |
| **76** | `:1739-1853` | **Elnina SNOW RING** — box 3×, `obj_elnina_snowring` raining `obj_elnina_raindrop` | no writer — *and line 1742 is `with (obj_elnina_enemy) scr_randomtarget();`*, so it names this fight's enemy explicitly. It was written for this fight and cut. `obj_elnina_raindrop` has exactly one reference in all of Ch3 (`obj_elnina_snowring_Step_0.gml:71`), so it is unreachable too |
| **140** | `:2786-2797` | mascotattack + `obj_elnina_umbrella`, and unlike 130 it does *not* forward `difficulty` | no writer. The umbrella shipped through other code: `obj_lanino_rematch_enemy_Step_0.gml:37, 65`, `obj_elnina_rematch_enemy_Step_0.gml:37, 65`, `obj_tenna_zoom_Other_11.gml:278` |

### 5c. Dead arms inside the live dispatcher

* `if (other.turns == 0) dc.special = 0;` (`Step_0:1127-1128`) — the bullets
  phase can never see `turns == 0`, because enemytalk unconditionally does
  `turns += 1` first (line 332), and even the `turns = 0` reset at line 237
  happens one phase earlier. Harmless: it assigns the same value turns 1 and 2
  do.
* `instafinalattack` (`Create_0.gml:50-53`) — `instafinalattack = false;`
  immediately followed by `if (instafinalattack == true) turns = 6;`. Never
  reassigned in Ch3. The devs' shortcut to test turn 7.
* The **`sunboost` juggle** (`Step_0:1084-1157`) — saves `sunboost`, zeroes it,
  rewrites it to ±1…±4 from `global.choice` and `turns`, spawns the controller,
  then restores it. It changes nothing: the only consumer of `sunboost` in this
  step is `_lanino_favored`, and that is a `var` already evaluated at line 304,
  long before line 1085. `dc.side` uses the pre-juggle favouritism.

### 5d. Objects with no references at all
`obj_elnina_heart` and `obj_rouxls_raincloud` are referenced nowhere in Ch3
outside their own event files.

---

## 6. The forecast picks sprites, not attacks

`Step_0:224-300` (menu phase) fills `forecasts[0..2]` with
`[temperature, laninoSprite, elninaSprite]` from a switch on `forecast_turn`:

| `forecast_turn` | forecast |
|---|---|
| 0 | moon + snow |
| 1 | sun + rain |
| 2 | moon + rain |
| 3+ | `choose(0,1)` → sun + snow, or moon + rain |

with runaway temperatures from turn 3 on — `80 + 100*(t−3)` if Lanino was
chosen, `40 − 30*(t−3)` if Elnina was (`Step_0:271-280`). Sprite ids are bare
numbers: sun 783, moon 1474, rain 4255, snow 1650 (`spr_weather_sun/_moon/_rain/_snow`).

```
obj_elnina_mascotattack_Create_0.gml:11-16   if (i_ex(controller) && controller.turns < 7)
                                                 laninobulletsprite = forecasts[0][1];
                                                 elninabullesprite  = forecasts[0][2];
obj_elnina_mascotattack_Step_0.gml:305-321   moon 1474 -> bs[4] spr_ch3_bullet_moon
                                             sun   783 -> bs[3] spr_ch3_bullet_sun
                                             rain 4255 -> bs[5] spr_ch3_bullet_raindrop
                                             snow 1650 -> bs[1] spr_ch3_bullet_ice
```

On **turn 7** the `turns < 7` guard fails, so no override is read and the
defaults apply (`bs[3 - i*2]`: Lanino fires suns, Elnina fires ice).

**`difficulty` is also a sprite override, not a difficulty** —
`mascotattack_Step_0.gml:293-303` maps `type` (= the dbulletcontroller's
`difficulty`) 1/2/3/4 onto `bs[5]/bs[1]/bs[4]/bs[3]`. The main fight never sets
it, so it is 0 and the forecast wins. If the studio's DIFF selector feeds a
non-zero value into a main-fight launch, the bullets silently change species.
The `controllerSet: { "difficulty": 0 }` in the JSON pins this.

---

## 7. Phases, HP gates, soul modes — there are none

* **No HP gate anywhere.** The win condition is scripted (§8), and the ladder is
  driven only by `turns` / `turn2_turns` / `ilovetv`.
* **No soul mode.** `scr_moveheart()` at `Step_0:1058-1059` is the plain red
  soul. No `obj_purplecontrols`, no green/yellow.
* **No minigame turn.** Nothing here is a Pink-style turn replacement. The
  Rain/Shine choicer (§3) is a two-line dialogue choice inside the ordinary
  post-bullet flow, not a turn of its own.
* **One phase-ish flag:** `Step_0:581-582`,
  `if (turns == 3 || turns > 4) obj_battlecontroller.noreturn = 1;`, which is
  what enables the post-bullet dialogue machine at `Step_0:1316`.
* Damage is flat — `obj_regularbullet_elnina_Create_0.gml:7-8`: damage 60,
  grazepoints 2.
* Retries get easier: `Create_0.gml:58-61` increments `global.elninalosscount`
  on every fight after the first, `mascotattack_Create_0.gml:9` copies it into
  `extrabulletrate`, and that is **added** to shotrate (the frames between
  shots) for specials 2, 3 and 4.

---

## 8. The win condition (not an attack, but it drives the ladder)

Tenna states it in the intro (`Step_0:110-124`): say "I LOVE TV" 99 times.
Susie's and Ralsei's S-Action / R-Action slots are renamed while the controller
exists — `scr_spellmenu_setup.gml:50-51` and `74-75`:

```
if (__actnamecheck && global.chapter == 3 && i_ex(obj_elnina_lanino_controller))
    global.battlespellname[__i][__fj] = stringsetloc("ILoveTV", …);
```

Each ACT bumps `ilovetv_increase`; `Step_0:189-222` ticks the counter up one per
frame with a rising pitch. **The counter is hard-capped at 30 for almost the
whole fight:**

```
Step_0:210    if (ilovetvlimit == true && ilovetv == 40)
Step_0:211        ilovetv = 30;
```

`ilovetvlimit` is cleared only at `Step_0:2115`, inside the scripted ending;
`2124-2132` then sets `ilovetv_increase = 99` so the counter races to 99 by
itself while `obj_ilovetv` balloons spawn (`2143-2156`), and `2186` calls
`scr_wincombat()`. **The fight is always won on the script, never on damage or
on genuinely reaching 99 early.**

---

## 9. Neighbouring fights that reuse these objects

Do not fold these into this roster.

* **Rematch, encounter 141** (`scr_encountersetup.gml:1266-1287`):
  `obj_lanino_rematch_enemy` + `obj_elnina_rematch_enemy` +
  `obj_elnina_lanino_rematch_controller` (Step 437 lines). Different chooser —
  `rematch_controller_Step_0.gml:21-31` picks `attack_chosen` with `choose()`
  from the three weathers that are not the previous one, and `375-393`
  dispatches type 130 with **special always 0** and `difficulty` 1/2/3/4
  (rain/snow/moon/sun), i.e. it reuses special 0 and varies only the bullet
  sprite. Mercy-gated branches at `343-366` dispatch **type 141**
  (`obj_elnina_bouncingbullet` + `obj_elnina_umbrella`,
  `obj_dbulletcontroller_Step_0.gml:2799-2819`), and at `mercymod == 100`
  (`367-370`) the turn is 60 empty frames. Its box is one unconditional create
  at view +320/+180 (line 308) under `global.mnfight == 1`, not `1.5`.
* **Rouxls Kaard, encounter 114:** `obj_lanino_enemy_rouxls` /
  `obj_elnina_enemy_rouxls` are backup dancers driven from
  `obj_dbulletcontroller` type 73 (lines 1256, 1262, 1321, 1324, 1348, 1351) and
  from `obj_room_teevie_chef`. Their attacks belong to
  `obj_rouxls_ch3_enemy_Step_0.gml:2894-2942` (types 74, 72, 73, 69, 71, 73.1).
* `obj_elnina_umbrella` and `obj_elnina_bouncingbullet` also appear in the Tenna
  fight (`obj_tenna_zoom_Step_0.gml:483-542`, `obj_tenna_zoom_Other_11.gml:278`).

---

## 10. What the studio has to special-case

1. **Create the controller and use it as the replay `self`.** Both blocks read
   `turns`. Set `turns` to the launched attack's turn (1/2 → special 0, 3, 4,
   5/6, 7) before replaying. `mascotattack_Create_0.gml:11-16` and
   `obj_regularbullet_elnina_Step_0.gml:44` also read the live controller — both
   behind `i_ex()` guards, which is *worse* than an error: a missing controller
   silently drops the forecast sprites and the heart-merge.
2. **Stub the controller's Create.** `Create_0.gml:44-49` spawns
   `obj_actor_tenna` at depth −9999999 and calls `scr_speaker("tenna")`;
   `CleanUp_0` does `safe_delete(tenna)`; `Draw_0:128-135` destroys the
   controller and stops the music when `global.fighting == 0`; `Step_0:169-187`
   (`intro == 1`) calls `snd_init("rudebuster_boss.ogg")` + `mus_loop_ext`, and
   the finale reads `global.batmusic[0]` to fade out
   (`mascotattack_Step_0.gml:250`). Easiest path: create the controller, then
   force `intro = 4`, `talked = 0`, `turns = <n>` and skip the intro chain.
3. **Resolve numeric object indices in a `with`.** `with (_a)` where `_a = 379`
   / `946`. If you spawn the dbulletcontroller manually instead, replicate
   `scr_bulletspawner` (`creator = myself`, `creatorid = id`,
   `target = mytarget`, `damage = global.monsterat[myself] * 5`) from a
   Lanino/Elnina instance — `mascotattack_Step_0.gml:290-291` copies
   `obj_dbulletcontroller.target` onto every bullet.
4. **Pin `difficulty` to 0** (§6).
5. **Honour the 850-frame turn.** Special 4 reads `global.turntimer` at
   500/400/350/250/200/100 for dialogue and 500/350/250/200 for the shotrate
   ramp, sprite swap and music fade. Any shorter floor skips the ramp and the
   attack fires at a constant rate forever.
6. **26 raw sprite indices must resolve.** `mascotattack_Create_0.gml:27-48`:
   `bs[0..5] = 429/3812/4150/4065/4417/1359` = `spr_ch3_bullet_raincloud /
   _ice / _heart / _sun / _moon / _raindrop`;
   `ms[0][0..7] = 472/2176/3561/187/4196/2807/539/1126` =
   `spr_ch3_mascot_moon_{normal, kiss, large_smug, huge_gloat, scared, chase,
   chase_small, large_smug_sad}`; `ms[1][0..7] =
   2069/4612/714/4573/4261/4393/266/2595` = the `spr_ch3_mascot_cloud_*`
   equivalents. Plus 783/1474/4255/1650 for the forecast comparisons. If any
   fail to resolve the mascots draw blank *and* the sprite-equality comparisons
   silently take the wrong branch.
7. **Mascots are `obj_marker` instances**, not bullets —
   `scr_dark_marker(x, y, sprite)` creates `obj_marker` at 2× with
   `image_speed = 0`. They must not be collidable.
   `obj_elnina_mascotattack_Draw_0.gml` is a bare `exit;` and its `CleanUp_0`
   destroys both markers.
8. **Bullet-vs-bullet collision is manual and self-directed.**
   `obj_regularbullet_elnina_Step_0.gml:31` runs
   `collision_rectangle(…, object_index, true, true)` — a same-object query with
   an inflated bbox — then mutates *both* instances. The engine needs that call
   shape plus `scr_doom`, `scr_lerpvar_instance`, `scr_lerp_var_instance` and
   `scr_script_delayed`, which the mascot and the bullets lean on heavily.
9. **Not attacks — don't spec them as such:** the ACT layer (ILoveTV rename,
   counter, 30-cap, `sunboost`), the turn-3 choicer (`global.choicemsg[0..1]`,
   `global.choice`, `obj_choicer_neo` which `Step_0:1316` tests for), the turn-4
   in-bullet cut-in (`extratimer` 39/50/100/140), the forecast HUD
   (`Draw_0:33-126` — three glass panes, temperature in °F or °C by
   `os_get_region()`), the I-LOVE-TV digit counter (`Draw_0:9-31`), and the
   ~1100 lines of `ballooncon` dialogue that are over half the controller Step.
   All five bullet attacks run without any of it; it just will not look like the
   show.

---

## Summary

* **Real: 5** — `obj_dbulletcontroller` type 130, `special` 0/1/2/3/4, each
  playable with `side` 0 (Lanino favored) or 1 (Elnina favored), across a fixed
  7-turn ladder (0, 0, 1, 2, 3, 3, 4) with turn lengths 260/260/260/260/275/275/850.
* **Cut: 12 dispatcher-level entries** — types 68, 69, 70, 71 (the whole
  `lanino_attack` / `elnina_attack` mechanism, which has no reader), 72.1, 73.5,
  75 (solar system), 76 (snow ring), 140 (umbrella), plus the unreachable
  `turns == 0` arm, `instafinalattack`, and the no-op `sunboost` juggle.
* **Confidence: high.** The dispatcher is a single site with one `dc.type`, the
  chooser is a straight-line ladder with no randomness, and every "cut" claim is
  a grep over the whole Ch3 dump for a `.type` writer that does not exist.
