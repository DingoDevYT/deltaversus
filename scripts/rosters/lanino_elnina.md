# Lanino & Elnina (ch3) — the REAL roster, derived from the chooser

**Fight:** encounter 113. **Enemies:** `obj_lanino_enemy` + `obj_elnina_enemy`.
**Attack owner:** `obj_elnina_lanino_controller`.

**Verdict: 5 real attacks (one per `special` value), played across a fixed 7-turn
ladder, each launchable with a left/right `side`. 17 entries in the
Lanino/Elnina family are cut — including two complete unused attacks written
specifically for this fight (`obj_lanino_solar_system`, `obj_elnina_snowring`)
and an entire unreachable rematch encounter.**

Unlike the first five bosses the ratio here is not "many dispatcher branches, few
chosen". It is the opposite: **one dispatcher branch, one `dc.type`, and all the
variety comes from a second field.** The cut content sits in
`obj_dbulletcontroller` around it, plus a whole vestigial dispatch mechanism
inside the controller that nothing reads.

---

## 0. Where the fight actually lives

`gml_GlobalScript_scr_encountersetup.gml:702-725` builds encounter 113:

```
709:            global.monsterinstancetype[0] = obj_lanino_enemy;      // monstertype 61
713:            global.monsterinstancetype[1] = obj_elnina_enemy;      // monstertype 60
719:            global.rank1turns = 7;
724:            global.battlemsg[0] = "* Let's hear it!! \"I LOVE TV!!!\"!"
```

Entered unconditionally from `gml_Object_obj_board_event_ninfight_Step_0.gml:145`
(`battler.encounterno = 113;`). Stats, from
`gml_GlobalScript_scr_monstersetup.gml:1782-1836`: both monsters are **8880 HP,
AT 12, DF 0, 160 gold, sparepoint 0, mercymax 100**, with ACT lists
Check / ILoveTV / ILoveTVX. Neither object has an `Other_20` spare handler and
nothing in the fight grants mercy, so they are not meant to be defeated at all —
though the dispatcher does carry a fallback for Lanino being killed (§1).

Neither enemy object contains attack code. `gml_Object_obj_lanino_enemy_Step_0.gml`
is 133 lines and `gml_Object_obj_elnina_enemy_Step_0.gml` is its mirror image;
both are `global.myfight == 3` ACT handling and nothing else. Every ACT writes
back into a third object:

```
obj_elnina_enemy_Create_0.gml:25   instance_create(x, y, obj_elnina_lanino_controller);
```

`obj_elnina_lanino_controller` (Create 61 lines, **Step 2231 lines**, Draw 135,
Alarm_6 52, CleanUp 1) owns the intro, the forecast HUD, the turn ladder, the
single dispatcher, ~1100 lines of post-bullet dialogue, and the win.

**There is no `monsterattackname` anywhere in this fight.** Grepping the
controller Step, both enemy objects, both rematch enemies, the rematch controller
and the mascot attack returns nothing. `gen_attacks.js`'s announcement scan finds
zero attacks for this boss whatever you put in `enemy`. `selectorScan` is no help
either: the dispatch is not the Ch1 `if (var == N) spawn` shape — the
`scr_bulletspawner` call *precedes* the entire `turns == N` ladder, so no
`turns == N` window contains a spawner — and `turns == N` recurs 40+ times in
dialogue branches. **This roster is declared, not scanned.**

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

`379` and `946` are raw object indices, verified against the Chapter 3
`objects.tsv`: index 379 is `obj_lanino_enemy`, index 946 is `obj_elnina_enemy`.
So the spawner runs with `self` = Lanino, falling back to Elnina if Lanino is
dead. (The cut rematch's `993` / `1591` are the rematch enemies, the same idiom.)

`dc.difficulty` is never written, so it keeps
`obj_dbulletcontroller_Create_0.gml:21`'s default of **0**. `dc.damage` comes
from `scr_bulletspawner` as `global.monsterat[myself] * 5` = **60**.

Type 130 is a thin wrapper — `gml_Object_obj_dbulletcontroller_Step_0.gml:2614-2627`:

```
2618:        var _mascot_attack = instance_create(obj_growtangle.x, obj_growtangle.y, obj_elnina_mascotattack);
2619:        _mascot_attack.attacktype = special;
2620:        _mascot_attack.favored    = side;
2621:        _mascot_attack.type       = difficulty;
2622:        scr_bullet_inherit(_mascot_attack);
...
2626:    if (special != 4)
2627:        exit;
```

All five attacks are branches of `obj_elnina_mascotattack_Step_0.gml` (456
lines). The only thing the dbulletcontroller keeps for itself is the final
attack's dialogue timing (`:2629-2746`).

**So the attack selector is `dc.special`, and the chooser is `turns`.**

---

## 2. The chooser — `turns`, and the two regulators on it

`turns = 0` at `Create_0.gml:3`, and increments once per enemy turn:

```
Step_0:310    if (scr_isphase("enemytalk") && talked == 0 && !i_ex(obj_rouxls_ch3_enemy))
Step_0:332        turns += 1;
```

Phase order inside a turn is **menu** (`global.myfight == 0`) → **enemytalk**
(`global.mnfight == 1`) → **bullets** (`global.mnfight == 2`), per
`gml_GlobalScript_scr_isphase.gml:5-36`. Two regulators sit on the ladder, both
in the menu phase:

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

* **If the player never says "I LOVE TV"**, line 237 pins the ladder — `turns` is
  knocked back to 0 every menu phase, then bumped to 1 in enemytalk, so the
  sequence goes 1, 2, 1, 2, 1, 2 and **special 0 repeats** until `turn2_turns`
  reaches 7, at which point the guard fails and the ladder proceeds.
* **Once anyone says it**, lines 233 and 335 fast-forward to turn 3 (the choicer
  turn).
* Nothing decrements past that, and **nothing is random**.

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
the ending chain 23 → 23.1 → 24 → 24.5 → 25 → 25.5 → 26 → 27 → 28, and
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
(`obj_growtangle_Create_0.gml:13-14`). **Both blocks read `turns`, a controller
variable — they must be replayed with `self` = an `obj_elnina_lanino_controller`
instance.** That is why the JSON's `enemy` field names the controller rather than
a monster.

Anchor check (all four grepped, each occurs exactly once in the controller Step):
`if (!instance_exists(obj_growtangle))` :1049 · `if (!instance_exists(obj_moveheart))`
:1058 · `if (turns < 5)` :1159 · `global.typer = 6;` :1171. A dry run of
`extractBoxBlock` / `extractTurnBlock` against this config produces exactly the
two blocks quoted above, and `extractTurnBlock`'s "`turntimer` within 80 chars of
the anchor" disambiguator passes on the first hit.

---

## 3. The second axis — `side` / `favored`

```
Step_0:304    var _lanino_favored = (lastchosen == "" && sunboost > 0) || lastchosen == "lanino";
```

Before turn 3, `lastchosen` is `""` and favouritism is driven purely by ACTs
(the tie, `sunboost == 0`, resolves to Elnina favored):

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
**5 attacks × 2 sides = 10 launchable variants**. `side` 0 = Lanino (moon mascot,
`mascot[0]`, `ms[0][*]`), `side` 1 = Elnina (cloud mascot, `mascot[1]`,
`ms[1][*]`) — confirmed by the type-130 finale dialogue, which puts the "Nice
move, huh, Lanino!?" line in `obj_elnina_enemy`'s mouth when `side == 1`
(`obj_dbulletcontroller_Step_0.gml:2634-2642`).

---

## 4. The five real attacks

All: `obj_dbulletcontroller`, `type = 130`, `difficulty = 0`, `side` 0 or 1.

### special 0 — Weather Report (turns 1, 2) · 260 frames
`obj_elnina_mascotattack_Step_0.gml:33-34` places the two mascots at
box.x ± 72, y − 116; `:131-141` drifts both with a sine sway; `:197-198` sets
shotrate 11/11 (the only two specials with **no** `extrabulletrate` term). At
`siner == 162` both switch to their KISS sprite `ms[i][1]` and at `168` a
`spr_ch3_bullet_heart` marker floats up and fades (`:138-139`, `:188-195`).
The signature is in the bullet, not the mascot:

```
obj_regularbullet_elnina_Step_0.gml:44   if (i_ex(obj_elnina_lanino_controller) && obj_elnina_lanino_controller.turns <= 2)
                                   :46-54     … both bullets become a pink spr_ch3_bullet_heart, snd_coaster_kiss
```

Two bullets that meet turn into hearts instead of annihilating. The couple is in
love. (Reachability: `Step_0:1127-1134` assigns special 0 for turns 0, 1 and 2,
and line 237 makes the 1↔2 pair repeat for a player who never ACTs.)

### special 1 — the favored one grows (turn 3) · 260 frames
`Step_0:1136-1137`. `mascotattack:37-41` scales `mascot[favored]` to 2.25× and
line 133 exempts it from the drift, so it hangs still and huge while the partner
keeps sliding. shotrate stays 11 (`:197-198`, and the no-op `:215-216`).
**First turn where bullets annihilate** — `turns <= 2` is now false, so the else
at `obj_regularbullet_elnina_Step_0.gml:56-81` destroys both with `snd_bump` and
a grey `spr_ball_small` shrink marker. The couple is fighting. Post-bullet, the
Rain/Shine choicer runs.

Turn 3 is reachable two ways: naturally (1 → 2 → 3) and by the fast-forward at
`Step_0:230-234` / `:334-335`.

### special 2 — smug vs. scared (turn 4) · 260 frames
`Step_0:1139-1140`. `mascotattack:43-63` gives the favored mascot `ms[i][2]`
(*_large_smug*) at 1.7× and the other `ms[i][4]` (*_scared*) at 1.5×; `:142-148`
makes the favored one sway wide while the loser jitters outward; `:218-225` sets
shotrate `14 + extrabulletrate` for both and 8 for the favored one and bumps both
speed components by 0.2–0.7; `:284-285` gives every bullet grazepoints 3;
`:356-368` scales the favored side's bullets to 1.5 and the other side's to 0.8.
Turn 4 also plays a scripted cut-in **during** the bullets —
`Step_0:1223-1306`: at `extratimer 39` the un-favored partner walks 70px across,
at 50 and 100 they say "Wh-what the!?" and "It's ruining MY attack!", at 140 they
walk back.

### special 3 — the chase (turns 5 and 6) · 275 frames
`Step_0:1142-1146` — **both** turns set special 3, with the same turn length
(`:1162-1166` are duplicated arms). `mascotattack:65-92` puts both mascots in
motion (favored `ms[i][2]` at 2×, speed 6; other `ms[i][4]` at 1× mirrored,
speed 4.4, `image_speed` 0.5, both launched at `90 + 90 * facing[favored]`);
`:149-176` bounces them off a 140px (favored) / 110px (other) square around the
box centre, reversing hspeed/vspeed and adding `90 * facing[favored]` to both
`image_angle` and `direction` on each bounce; `:227-232` sets shotrate
`13 + losscount` / favored `6 + losscount`; `:287-288` grazepoints 3; `:370-398`
discards the gravity arc and re-aims every bullet at the box centre with a ±15
spread (favored, 2×, speed 1) or ±35 spread (other, 1×, friction −0.1). Turns 5
and 6 differ only in dialogue (`Step_0:438-486` vs `:488-535` before,
`:1603-1636` vs `:1805-1828` after).

### special 4 — FINAL ATTACK (turn 7) · **850 frames**
`Step_0:1148-1149` + `:1168-1169`. The only special that keeps running code
inside `obj_dbulletcontroller`; every other one hits `if (special != 4) exit;` at
`:2626-2627`. Lines `:2629-2746` fire "Nice move, huh, \<partner\>!?" /
"… \<partner\>?" / "… oh…" at turntimer 500 / 350 / 200, with `obj_writer` kills
at 400 / 250 / 100.

`mascotattack:94-120` seats the favored mascot (`ms[i][3]`, *_huge_gloat*, 2×) at
the box centre and parks the other (`ms[i][6]`, *_chase_small*) at box.x − 120.
`:177-184` gives the favored one a sin/cos jitter while turntimer > 250.
`:400-418` **destroys every bullet the un-favored mascot tries to fire** and
fades that mascot out 0.05 alpha/scale per attempted shot. `:234-265` starts the
favored shotrate at `7 + losscount` (6 if `global.hp[1]` is at or above half)
and, once turntimer < 500, ramps it to `(65 + losscount) − turntimer/10`; fades
the battle music with `mus_volume`; swaps the mascot to `ms[favored][7]`
(*_large_smug_sad*), advancing `image_index` at 350 and 200; and stops firing
entirely (shotrate 9999) at turntimer ≤ 250. `:420-441` lerps each surviving
bullet up to 3× scale, flips gravity left or right via `choose(0, 180)`, and
dooms it after 100 frames. This is also the only turn whose box is 20px lower.

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
| 68 | `obj_dbulletcontroller_Step_0.gml:775-808` | `obj_bullet_sun`, bouncing, damage 55 |
| 69 | `:810-895` | `obj_bullet_submoon` arcs |
| 70 | `:896-978` | rejection-sampled `obj_bullet_snow` / `spr_snowflake` field |
| 71 | `:979-1027` | `obj_rainwater` flood |

The controller writes them into `lanino_attack` / `elnina_attack` in **29
places** — every line of `Step_0` between 542 and 1008 that names a weather:
542, 548, 648, 649, 682, 683, 687, 716, 717, 790, 791, 866, 872, 877, 880, 897,
900, 904, 910, 930, 936, 941, 944, 961, 964, 968, 974, 994, 1008 (plus the `= 0`
clears at 328, 329, 543, 549, 995, 1007) — as the dialogue announces each weather
("… Moon.", "… Drop.", "TRUEST Crystal!", "EXTRA DEXTRA Sun!").

**Nothing in Chapter 3 ever reads `lanino_attack` or `elnina_attack`.** A
recursive grep over the whole Ch3 dump returns 40 hits and every one is a write:
the two Create initialisers (`obj_elnina_lanino_controller_Create_0.gml:7-8`,
`obj_elnina_lanino_rematch_controller_Create_0.gml:7-8`), the per-turn clears,
and the assignments themselves. There is no reader, and the controller's only
`dc.type` write in 2231 lines is the `130` at line 1125.

This is the fossil of a design in which each announced weather launched its own
bullet attack. What shipped uses the forecast only to pick a bullet **sprite**
(§6). Of the four, 69 and 71 survive elsewhere —
`obj_rouxls_ch3_enemy_Step_0.gml:2925, 2939` and `:2928, 2942`, plus
`obj_watercooler_enemy_Step_0.gml:104` — but never here. **68 and 70 have no
dispatcher anywhere in Chapter 3.**

### 5b. Undispatched Lanino/Elnina attacks in `obj_dbulletcontroller`

Method: enumerate every `.type = <number>` write in the whole Chapter 3 dump and
diff it against every `if (type == <number>)` branch in
`obj_dbulletcontroller_Step_0.gml`. Dispatched: 0-8, 13, 14, 20, 30-33, 48,
60-62, 64-67, 69, 71-74, 98, 99, 101-112, 120, 125, 126, 128, 130, 135, 141,
145-147, 150-154, 999. Implemented but never dispatched, in this family:

| type | line | what it is | why cut |
|---|---|---|---|
| **72.1** | `:1065-1151` | mascotattack with `dummy = true` — mascots as scenery plus a separate 3-shot burst | no writer; `dummy` is the mascot's other mode (`Create_0.gml:23`, `Step_0.gml:24-30, 138, 188, 272`), so that whole branch is dead |
| **73.5** | `:1518-1588` | `obj_rouxls_moon_bullet` + `obj_rouxls_cloud_bullet` pair | no writer (Rouxls dispatches 73 and 73.1 only) |
| **75** | `:1623-1738` | **Lanino SOLAR SYSTEM** — box scaled to 3×, `obj_lanino_solar_system` + orbiting `obj_lanino_solar_system_orbit` rings | no writer. Speaks through `with (obj_lanino_enemy)` at `:1642-1646` ("SUN ATTACK!! HA HA HA!!!") — written for **this** fight, then cut. Five event files that never run |
| **76** | `:1739-1853` | **Elnina SNOW RING** — box 3×, `obj_elnina_snowring` raining `obj_elnina_raindrop` | no writer, *and* `:1743` is `with (obj_elnina_enemy) scr_randomtarget();` and `:1746` reads `obj_elnina_enemy.mytarget` — it names this fight's enemy explicitly. `obj_elnina_raindrop` has exactly one reference in all of Ch3 (`obj_elnina_snowring_Step_0.gml`), so it is unreachable too |
| **140** | `:2786-2797` | mascotattack + `obj_elnina_umbrella`; unlike 130 it does *not* forward `difficulty` | no writer. The umbrella shipped through other code: `obj_lanino_rematch_enemy_Step_0.gml:37, 65`, `obj_elnina_rematch_enemy_Step_0.gml:37, 65`, and the Tenna fight |
| **141** | `:2799-2819` | `obj_elnina_bouncingbullet` + umbrella | dispatched only by `obj_elnina_lanino_rematch_controller_Step_0.gml:350, 362` — and that encounter is itself unreachable (§5c) |

### 5c. The whole rematch — encounter 141

`scr_encountersetup.gml:1265-1287` defines encounter 141, "* Its a rematch.",
with `obj_lanino_rematch_enemy` (monstertype 107) and `obj_elnina_rematch_enemy`
(monstertype 106) and rank1turns 7. Three objects plus a second 437-line
controller implement it.

**Nothing selects it.** Grepping every line containing `141` for `encounterno`,
`scr_battle`, `myencounter` or `battler.` returns no hit anywhere in Chapter 3,
while the live fight is entered explicitly at
`obj_board_event_ninfight_Step_0.gml:145`, `battler.encounterno = 113;` — and
that assignment is **unconditional**, so even the `retry == 1` re-entry branch
(`ninfight Step_0:132`, which only swaps Tenna's intro lines) comes back to 113,
never 141. Encounter 141 is reachable only through the debug `obj_battletester`.

Its chooser is a genuinely different design and worth recording anyway:
`obj_elnina_lanino_rematch_controller_Step_0.gml:21-33` picks `attack_chosen`
with `choose()` from the three weathers that are not the previous one, and
`:375-393` dispatches type 130 with **special always 0** and `difficulty`
1/2/3/4 for rain/snow/moon/sun — i.e. it reuses this fight's special 0 and varies
only the bullet sprite. Mercy-gated arms at `:343-366` dispatch type 141, and at
`mercymod == 100` (`:367-370`) the turn is 60 empty frames with no controller at
all. Its box is one unconditional create at view +320/+180 (`:308`) under
`global.mnfight == 1`, not `1.5`.

### 5d. Dead arms inside the live dispatcher

* `if (other.turns == 0) dc.special = 0;` (`Step_0:1127-1128`) — the bullets
  phase can never see `turns == 0`, because enemytalk runs first and
  unconditionally does `turns += 1` (line 332), and even the `turns = 0` reset at
  line 237 happens in the menu phase, one phase earlier still. Harmless: it
  assigns the same value turns 1 and 2 do.
* `instafinalattack` (`Create_0.gml:50-53`) — `instafinalattack = false;`
  immediately followed by `if (instafinalattack == true) turns = 6;`. Never
  reassigned in Ch3. The devs' shortcut to test turn 7 (6, then the enemytalk
  increment makes 7). It is also the right model for how the studio should launch
  special 4.
* The **`sunboost` juggle** (`Step_0:1084-1157`) — saves `sunboost`, zeroes it,
  rewrites it to ±1…±4 from `global.choice` and `turns`, spawns the controller,
  then restores it. It changes nothing: the only consumer of `sunboost` in this
  Step is `_lanino_favored`, and that is a `var` already evaluated at line 304,
  ~780 lines earlier. `dc.side` uses the pre-juggle favouritism, and nothing
  inside the `with (_a)` block reads `sunboost` at all.

### 5e. Unused asset slots

* `Step_0:246` declares `var _hale = 14;` (`spr_weather_hale`) alongside
  `_sun`/`_moon`/`_rain`/`_snow`, and the forecast switch at `:250-296` never
  places it in any `forecasts[]` entry. Hail was a fifth weather that got cut;
  only the unreachable rematch still names the sprite
  (`rematch_controller_Step_0.gml:19`).
* `mascotattack_Create_0.gml:27, 29` load `bs[0] = 429`
  (`spr_ch3_bullet_raincloud`) and `bs[2] = 4150` (`spr_ch3_bullet_heart`). The
  Step only ever assigns `bs[1]`, `bs[3]`, `bs[4]`, `bs[5]` to a bullet
  (`:281`, `:293-303`, `:307-320`), so `bs[0]` is never used at all and the heart
  sprite reaches the screen only via the marker at `:190` and the kiss inside
  `obj_regularbullet_elnina`.
* `mascotattack_Create_0.gml:38, 46` load `ms[0][5] = 2807`
  (`spr_ch3_mascot_moon_chase`) and `ms[1][5] = 4393`
  (`spr_ch3_mascot_cloud_chase`). Attacktype 3 — the chase — actually uses
  `ms[i][2]` and `ms[i][4]`, so the full-size chase sprites are never assigned by
  any attacktype.
* `mascotattack_Step_0.gml:293-303` maps `type` (= `dc.difficulty`) 1/2/3/4 onto
  `bs[5]/bs[1]/bs[4]/bs[3]`. The live fight never sets `difficulty`, and for
  `turns < 7` the forecast override would win anyway — so this ladder is dead
  here. Only the unreachable rematch drives it.

### 5f. Objects with no references at all
`obj_elnina_heart`, `obj_bullet_moon` and `obj_rouxls_raincloud` appear in the
Chapter 3 `objects.tsv` with sprites, and `obj_elnina_heart` even has a Create
and a Step, but a recursive grep for each name returns hits only inside its own
event files. Nothing creates them.

---

## 6. The forecast picks sprites, not attacks

`Step_0:224-300` (menu phase, once per turn — guarded by `calculated_forecast`,
which is cleared at `:330`) fills `forecasts[0..2]` with
`[temperature, laninoSprite, elninaSprite]` from a switch on `forecast_turn`
(= `turns` **before** that turn's increment):

| `forecast_turn` | forecast | so the bullets on turn… |
|---|---|---|
| 0 | moon + snow | 1 |
| 1 | sun + rain | 2 |
| 2 | moon + rain | 3 |
| 3+ | `choose(0,1)` → sun + snow, or moon + rain | 4, 5, 6 |

with runaway temperatures from turn 3 on — `80 + 100*(t−3)` if Lanino was chosen,
`40 − 30*(t−3)` if Elnina was (`Step_0:271-280`). Sprite ids are bare numbers:
sun 783, moon 1474, rain 4255, snow 1650 (`spr_weather_sun/_moon/_rain/_snow`).

```
obj_elnina_mascotattack_Create_0.gml:11-16   if (i_ex(controller) && controller.turns < 7)
                                                 laninobulletsprite = forecasts[0][1];
                                                 elninabullesprite  = forecasts[0][2];
obj_elnina_mascotattack_Step_0.gml:305-321   moon 1474 -> bs[4] spr_ch3_bullet_moon
                                             sun   783 -> bs[3] spr_ch3_bullet_sun
                                             rain 4255 -> bs[5] spr_ch3_bullet_raindrop
                                             snow 1650 -> bs[1] spr_ch3_bullet_ice
```

On **turn 7** the `turns < 7` guard fails, so no override is read and the defaults
apply (`bs[3 - i*2]`: Lanino fires suns, Elnina fires ice).

**`difficulty` is a sprite override too, not a difficulty** (§5e). The main fight
never sets it, so it is 0 and the forecast wins. If the studio's DIFF selector
feeds a non-zero value into a main-fight launch, the bullets silently change
species. The `controllerSet: { "difficulty": 0 }` in the JSON pins this.

---

## 7. Phases, HP gates, soul modes — there are none

* **No HP gate anywhere.** The win condition is scripted (§8) and the ladder is
  driven only by `turns` / `turn2_turns` / `ilovetv`.
* **No soul mode.** `scr_moveheart()` at `Step_0:1058-1059` is the plain red
  soul. No `obj_purplecontrols`, no green, no yellow.
* **No minigame turn.** Nothing here is a Pink-style turn replacement. The
  Rain/Shine choicer (§3) is a dialogue choice inside the ordinary post-bullet
  flow, not a turn of its own.
* **One phase-ish flag:** `Step_0:581-582`,
  `if (turns == 3 || turns > 4) obj_battlecontroller.noreturn = 1;`, which is what
  enables the post-bullet dialogue machine at `Step_0:1316`.
* Damage is flat — `obj_regularbullet_elnina_Create_0.gml:7-8`: damage 60,
  grazepoints 2. Its `Other_15` then hard-overwrites `target = 4` on line 1, a
  real `scr_damage` mode (`gml_GlobalScript_scr_damage.gml:47-69`) that re-rolls
  the target up to three times, biasing away from any party member below half the
  party HP average and away from Kris below 35%.
* Retries get **easier**: `Create_0.gml:58-61` increments the persistent
  `global.elninalosscount` on every entry after the first,
  `mascotattack_Create_0.gml:9` copies it into `extrabulletrate`, and that is
  **added** to shotrate — which is the number of frames *between* shots. Applies
  to specials 2, 3 and 4 only.
* One more bullet variant that never fires here: `mascotattack` counts its own
  shots and turns every `firebulletcount`-th bullet into a red 2× `spr_lanino_fire`
  (`Create_0.gml:26` sets `firebulletcount = 2000`, `Step_0:339-348` applies it).
  Only the cut rematch lowers it, to 20 or 12 at high mercy
  (`Step_0:328-335`, gated on `i_ex(obj_lanino_rematch_enemy)`).

---

## 8. The win condition (not an attack, but it drives the ladder)

Tenna states it in the intro (`Step_0:110-124`): say "I LOVE TV" 99 times. Both
monsters' ACT lists are Check / ILoveTV / ILoveTVX
(`scr_monstersetup.gml:1794-1807`, `:1822-1835`), and Susie's and Ralsei's
S-Action / R-Action slots are renamed while the controller exists —
`scr_spellmenu_setup.gml:50-51` and `:74-75`:

```
if (__actnamecheck && global.chapter == 3 && i_ex(obj_elnina_lanino_controller))
    global.battlespellname[__i][__fj] = stringsetloc("ILoveTV", …);
```

Each ACT bumps `ilovetv_increase`; `Step_0:189-222` ticks the counter up one per
frame with a rising pitch. **The counter can never pass 39 for almost the whole
fight:**

```
Step_0:210    if (ilovetvlimit == true && ilovetv == 40)
Step_0:211        ilovetv = 30;
```

so the display just bounces 30 → 39 → 30. `ilovetvlimit` is cleared only at
`Step_0:2115`, inside the scripted ending; `:2124-2132` then sets
`ilovetv_increase = 99` so the counter races to 99 by itself while `obj_ilovetv`
balloons spawn (`:2143-2156`), and `:2186` calls `scr_wincombat()`. **The fight
is always won on the script at the end of turn 7 — never on damage, and never by
genuinely reaching 99 early.**

---

## 9. Neighbouring fights that reuse these objects

Do not fold these into this roster.

* **Rematch, encounter 141** — cut; see §5c.
* **Rouxls Kaard:** `obj_lanino_enemy_rouxls` / `obj_elnina_enemy_rouxls` are
  *separate objects* used as backup dancers, driven from `obj_dbulletcontroller`
  type 73 (`:1256, 1262, 1321, 1324, 1348, 1351`) and from
  `obj_room_teevie_chef`. Their attacks belong to
  `obj_rouxls_ch3_enemy_Step_0.gml:2894-2942` (types 74, 72, 73, 73.1, 69, 71).
  Note that `obj_elnina_lanino_controller` guards its enemytalk, box and
  dispatcher blocks with `!i_ex(obj_rouxls_ch3_enemy)` (`:310`, `:1047`, `:1078`),
  so the two fights are explicitly kept apart.
* `obj_elnina_umbrella` and `obj_elnina_bouncingbullet` also appear in the Tenna
  fight, and `obj_regularbullet_elnina_Step_0.gml:41-42` disables the whole
  kiss/annihilate system whenever `obj_elnina_rematch_enemy` exists.

---

## 10. What the studio has to special-case

1. **Declare the roster; nothing will scan it.** No `monsterattackname`, and
   `selectorScan` cannot reach the spawner. This needs a new `BOSSES` field in
   the shape of Pink's `dates` — a list of `{special, side}` pairs the studio
   writes onto a manually spawned `obj_dbulletcontroller`.
2. **Create the controller and use it as the replay `self`.** Both blocks read
   `turns`. Set `turns` to the launched attack's turn (1/2 → special 0; 3; 4;
   5/6; 7) before replaying. `mascotattack_Create_0.gml:11-16` and
   `obj_regularbullet_elnina_Step_0.gml:44` also read the live controller — both
   behind `i_ex()` guards, which is *worse* than an error: a missing controller
   silently drops the forecast sprites and the heart-merge, and every attack ends
   up looking like a turn-7 attack.
3. **Stub the controller's Create.** `Create_0.gml:44-48` spawns
   `obj_actor_tenna` at depth −9999999 and calls `scr_speaker("tenna")`;
   `CleanUp_0` does `safe_delete(tenna)`; `Draw_0:128-135` destroys the controller
   and stops the music when `global.fighting == 0`; `Step_0:171-172`
   (`intro == 1`) calls `snd_init("rudebuster_boss.ogg")` + `mus_loop_ext`, and
   the finale reads `global.batmusic[0]` to fade out
   (`mascotattack_Step_0.gml:250`). Easiest path: create the controller, then
   force `intro = 4`, `talked = 0`, `attacked = 0`, `turns = <n>`, the
   `lastchosen`/`sunboost` pair for the side you want, and a populated
   `forecasts`, skipping the intro and dialogue chains entirely.
4. **`forecasts` is an array of arrays and it drives the art.** To reproduce turn
   N's real look, set `forecasts[0]` to the switch's output for
   `forecast_turn = N−1` (§6). Leave it empty and every bullet falls back to
   sun/ice for every turn.
5. **Resolve numeric object indices in a `with`.** `with (_a)` where `_a = 379` /
   `946`. If you spawn the dbulletcontroller manually instead, replicate
   `scr_bulletspawner` (`creator = myself`, `creatorid = id`,
   `target = mytarget`, `damage = global.monsterat[myself] * 5` = 60) from a
   Lanino/Elnina instance — `mascotattack_Step_0.gml:290-291` copies
   `obj_dbulletcontroller.target` onto every bullet.
6. **Pin `difficulty` to 0** (§6).
7. **Honour the 850-frame turn.** Special 4 reads `global.turntimer` at
   500/400/350/250/200/100 for dialogue and 500/350/250/200 for the shotrate
   ramp, sprite swap and music fade. Any shorter floor skips the ramp entirely
   and the attack fires at a constant rate forever. Note also that
   `mascotattack_Step_0.gml:7-12` hard-exits and hides both mascots once
   `global.turntimer <= 2`.
8. **26 raw sprite indices must resolve.** `mascotattack_Create_0.gml:27-48`:
   `bs[0..5] = 429/3812/4150/4065/4417/1359` = `spr_ch3_bullet_raincloud /
   _ice / _heart / _sun / _moon / _raindrop`;
   `ms[0][0..7] = 472/2176/3561/187/4196/2807/539/1126` =
   `spr_ch3_mascot_moon_{normal, kiss, large_smug, huge_gloat, scared, chase,
   chase_small, large_smug_sad}`; `ms[1][0..7] =
   2069/4612/714/4573/4261/4393/266/2595` = the `spr_ch3_mascot_cloud_*`
   equivalents. Plus 783/1474/4255/1650 for the forecast comparisons. If any fail
   to resolve, the mascots draw blank *and* the sprite-equality comparisons
   silently take the wrong branch — no error, wrong fight.
9. **Mascots are `obj_marker` instances**, not bullets —
   `scr_dark_marker(x, y, sprite)` creates `obj_marker` at 2× with
   `image_speed = 0`. They must not be collidable.
   `obj_elnina_mascotattack_Draw_0.gml` is a bare `exit;` and its `CleanUp_0`
   destroys both markers.
10. **Bullet-vs-bullet collision is manual, self-directed and mutating.**
    `obj_regularbullet_elnina_Step_0.gml:31` runs
    `collision_rectangle(…, object_index, true, true)` — a same-object query with
    an inflated bbox and the notme flag — then mutates *both* instances
    (`:48-53` kiss, `:58-80` annihilate). Note the object's
    `Collision_obj_regularbullet_elnina` event is a bare `exit;`, so a
    physics-style collision event will not reproduce any of this. The engine also
    needs `scr_doom`, `scr_lerpvar_instance` **and** `scr_lerp_var_instance`
    (both spellings exist and both are used — the mascot uses the first, this
    bullet the second).
11. **`obj_regularbullet_elnina`'s parent is `obj_collidebullet`**, not
    `obj_regularbullet` (Ch3 `objects.tsv`), and its `Other_15` sets `target = 4`
    (§7), which needs a real three-member party to behave correctly.
12. **Multi-part monster draw with live sprite swaps.**
    `obj_lanino_enemy_Draw_0.gml` and `obj_elnina_enemy_Draw_0.gml` (114 lines
    each) composite 6–8 limbs from raw sprite-index fields (head, chest,
    shoulders, legs, leftarm, lefthand / hairtufts, waist, rightarm, skirt) using
    `draw_sprite_ext` and `draw_sprite_ext_flash` with sin-driven bob offsets —
    and the dialogue reassigns those fields constantly (`lanino.head = 679;`,
    `elnina.head = 4435;`, ~40 more). Not needed for the bullets; needed for a
    faithful scene.
13. **Not attacks — don't spec them as such:** the ACT layer (ILoveTV rename,
    counter, 39-cap, `sunboost`), the turn-3 choicer (`global.choicemsg[0..1]`,
    `global.choice`, `obj_choicer_neo` which `Step_0:1316` tests for), the turn-4
    in-bullet cut-in (`extratimer` 39/50/100/140), the forecast HUD
    (`Draw_0:38-126` — three `spr_glass_pane` panels, temperature in °F or °C by
    `use_celsius = string_lower(os_get_region()) != "us"`), the I-LOVE-TV digit
    counter (`Draw_0:9-31`, `spr_tv_counter_numbers`), and the ~1100 lines of
    `ballooncon` dialogue that are over half the controller Step. All five bullet
    attacks run without any of it; it just will not look like the show.

---

## Summary

* **Real: 5** — `obj_dbulletcontroller` type 130, `special` 0/1/2/3/4, each
  playable with `side` 0 (Lanino favored) or 1 (Elnina favored), across a fixed
  7-turn ladder (0, 0, 1, 2, 3, 3, 4) with turn lengths
  260/260/260/260/275/275/850. No randomness in selection anywhere.
* **Cut: 17** — types 68, 69, 70, 71 (the whole `lanino_attack` /
  `elnina_attack` mechanism, which has no reader), 72.1, 73.5, 75 (solar system),
  76 (snow ring), 140 (umbrella), 141 (bouncing bullet), the entire unreachable
  rematch encounter 141, the unreachable `turns == 0` arm, `instafinalattack`,
  the no-op `sunboost` juggle, the unused asset slots (`_hale`, `bs[0]`, `bs[2]`,
  `ms[i][5]`), the dead `difficulty` sprite ladder, and three orphan objects.
* **Confidence: high.** The dispatcher is a single site with one `dc.type`, the
  chooser is a straight-line ladder with no randomness, both extraction anchors
  were dry-run against the real generator functions, and every "cut" claim is a
  grep over the whole Ch3 dump for a writer that does not exist.
