# Berdly (ch2) — the REAL rosters, derived from the choosers

**Berdly is two fights, not one.** They are separate objects with separate
dispatchers, separate turn lengths and separate difficulty wiring, and they
share exactly three attacks.

| | Fight 1 | Fight 2 |
|---|---|---|
| object | `obj_berdlyb_enemy` | `obj_berdlyb2_enemy` |
| name | **"Bump of Chicken"** — the roller-coaster / bumper-car fight | **Berdly + Noelle** — the Snowgrave-route fight |
| encounter | 58 (`scr_encountersetup.gml:575-582`) | 82 (`scr_encountersetup.gml:908-920`) |
| monstertype | 43 — HP **1985**, AT 10, mercymax 100 (`scr_monstersetup.gml:1188-1218`) | 46 — HP **900**, AT 9, mercymax 100 (`scr_monstersetup.gml:1290-1313`) |
| launched by | `obj_berdly_encounter_setup_Step_0.gml:9` (`global.specialbattle = 3`, flag 529) | `obj_ch2_city_berdly_Step_0.gml:336` — `scr_battle(82, 1, berdly_marker, 0, 0)`, flag 550 |
| selector | `rr`, from an `attackorder` 3-cycle | `chosenattack`, via `rr` |
| turn length | 210 / 200 / 180, per-attack | flat **260** |
| party | Kris / Susie / Ralsei | Kris / **Noelle** |
| ends on | mercy 100 → scripted coaster explosion | mercy 100, or SnowGrave |

Ordering is provable, not inferred: fight 1's setup writes `global.flag[9] = 1`
(`obj_berdly_encounter_setup_Step_0.gml:14-18`) and fight 2 writes
`global.flag[9] = 2` immediately before its `scr_battle`
(`obj_ch2_city_berdly_Step_0.gml:327`).

**`obj_berdlyplug_enemy` is not a third Berdly fight.** It is the
wired-into-the-ceiling Berdly prop inside the QUEEN battle — already recorded as
an `extraEnemies` entry in `rosters/queen.json`, where it is the mercy target for
the Throw ACT and the object the BerdlyTornado attack physically drags.
`gml_Object_obj_berdlyplug_enemy_Step_0.gml` is 97 lines of wire physics with no
`scr_bulletspawner` and no `monsterattackname` anywhere.

---

## The shared attack set

Both bosses dispatch the same three `obj_dbulletcontroller` types. There is no
Berdly-specific controller.

| type | name | controller branch | what it does |
|---|---|---|---|
| 8 | `Tornado` | `obj_dbulletcontroller_Step_0.gml:259-382` | d0 (`:273-307`): 4 `obj_berdlyb_tornado` from `maxx + 30`, entering from `miny + 22` or `maxy - 22`, `yshift = growtangle.sprite_height / 3 - 14`, maxSpeed 6, direction 180, staggered `startDelay`. d1 (`:308-366`): **8** tornadoes on a 240px ring around the box at 45° spacing, spinning inward, `spindir = choose(-1, 1)`, `middespawn = 1` |
| 9 | `SpearBlast` | `:383-411` | Creates `obj_berdlyb_spearblaster` at `(x - 18, y - 114)`, **hides the boss** (`global.monsterinstance[creator].visible = 0`, `:388`), `special = choose(0, 1)` (`:391`), then 6 `obj_berdlyb_spearblast`. Rate is 30 at d0 and 50 at d≥1 (`:394`). `d.aim_at_player` when `difficulty == 2 || (made % 2) == special` (`:405`) |
| 10 | `Chirashi` | `:412-440` | `maxmake = 3` at d1, else 2 (`:420`). Each `obj_berdlyb_chirashistorm` fires a 4×3 grid of `obj_berdlyb_chirashibullet`. Bullet aiming (`obj_berdlyb_chirashibullet_Step_0.gml:38-52`): d1 mirrors about 205°, d0 tracks `obj_heart`, anything else (−1 / 2) mirrors about the box centre |

Type 10's difficulty is **mutated by the controller**: `if (difficulty == 0)
difficulty = choose(-1, 0);` (`:416-417`) and then `if (difficulty < 1)
difficulty = -1 - difficulty;` after every storm (`:437-438`), so a d0 Chirashi
alternates heart-tracking and box-mirroring storms. d1 and d2 are stable.

---

## Fight 1 — `obj_berdlyb_enemy`, chooser at `Step_0:27-39`

There is no `event_user` chooser. (`gml_Object_obj_berdlyb_enemy_Other_5.gml` is
a single `exit;` — a decoy.) The ladder is inline at the top of the enemytalk
phase:

```gml
if (attackorder == 0)          // Step_0:27-28
    rr = 0;

if (attackorder == 1)          // Step_0:30-31
    rr = 2;

if (attackorder == 2)          // Step_0:33-37
{
    rr = 1;
    attackorder = -1;
}

attackorder++;                 // Step_0:39
```

`attackorder = 0` in `Create_0.gml:18`, and the `-1` + `++` at the end of arm 3
returns it to 0. So fight 1 is a **strict, deterministic 3-cycle** for its entire
length:

> **Tornado → Chirashi → SpearBlast → Tornado → …**

The dispatcher (`Step_0:182-239`) has no fourth arm — the third case is a bare
`else`, so every possible `rr` maps onto one of the three:

```gml
if (rtimer == 16)                                       // Step_0:182
{
    if (rr == 0)   { ... dc.type = 8;  dc.difficulty = 0; scr_turntimer(210); }  // :184-191
    else if (rr == 1) { ... dc.type = 9;  dc.difficulty = 1; scr_turntimer(200); }  // :192-199
    else           { ... dc.type = 10; dc.difficulty = 2; scr_turntimer(180); }  // :200-207
}
```

### The trap: `rr` is clobbered every turn and it does not matter

`Step_0:212` runs `rr = choose(0, 1, 2, 3, 4, 5)` right after the spawn — but it
only selects one of the six flavour battle messages at `:214-230` ("Berdly calls
Queen for help!", "Smells like fried chicken."). The `attackorder` ladder
unconditionally rewrites `rr` at the top of the next enemy turn, so the roll never
reaches the dispatcher. Same vestigial shape as Spamton NEO's trailing
`rr = choose(0, 1, 2, 3)`.

### The one wrinkle: `attackorder--`

```gml
if ((bumpedpast50percent == 0 && global.mercymod[myself] > 50 && balloonorder > 4)
 || (bumpedpast50percent == 0 && global.monsterhp[myself] < (global.monstermaxhp[myself] * 0.5) && balloonorder > 4))
{
    msgsetloc(0, "What? My car&is breaking!?/%", ...);   // Step_0:50-56
    bumpedpast50percent = 1;
    ballooncon = 2;
    attackorder--;
}
```

This fires **once**, on the first turn after either mercy > 50 or HP < 50% with at
least five default balloons already shown. `rr` for that turn is already chosen;
the `attackorder--` undoes the increment so the **same attack repeats next turn**.
It cannot introduce a new attack. The only degenerate case is when it fires on the
SpearBlast turn (`attackorder` was 2 → set to −1 → `++` → 0 → `--` → −1): the next
turn matches none of the three arms, so `rr` keeps the battle-message roll from
`:212` — values 0/1/2 map to the same three attacks and 3/4/5 fall into the
`else`, i.e. Chirashi. Still no fourth attack.

### Real roster — fight 1 (3 entries, 0 cut dispatcher branches)

| cycle slot | `rr` | type | difficulty | turn | name |
|---|---|---|---|---|---|
| 1 | 0 | 8 | 0 | 210 | Tornado |
| 2 | 2 | 10 | 2 | 180 | Chirashi |
| 3 | 1 | 9 | 1 | 200 | SpearBlast |

Difficulty is **hardcoded per attack** here. `obj_berdlyb_enemy.difficulty` is 0
(`Create_0.gml:9`) and its only writer is the debug toggle at `Step_0:537-541`
(`keyboard_check_pressed(ord("B"))`), so the box rotation at `Step_0:172-173`
(`if (difficulty == 1 && rr == 0) obj_growtangle.target_angle += 45;`) never fires
in real play, and `dc.difficulty` never sees a boss field.

### Box block — `Step_0:166-173`

```
anchor    : if (!instance_exists(obj_moveheart) && !instance_exists(obj_heart))
endAnchor : }
```

Both verified: the anchor occurs exactly once (`grep -cF` == 1), and there is no
brace anywhere between line 166 and line 173, so `}` resolves to the block closer
on 174 and the slice is brace-balanced. Confirmed by replaying `gen_attacks.js`'s
own `strip()` / `extractBoxBlock()` against the file:

```gml
if (!instance_exists(obj_moveheart) && !instance_exists(obj_heart))
    scr_moveheart();

if (!instance_exists(obj_growtangle))
    instance_create(__view_get(e__VW.XView, 0) + 320, __view_get(e__VW.YView, 0) + 170, obj_growtangle);

if (difficulty == 1 && rr == 0)
    obj_growtangle.target_angle += 45;
```

A plain `if (!instance_exists(obj_growtangle))` anchor with no `endAnchor` also
extracts cleanly (verified) but drops the rotate. The box is never resized —
`obj_growtangle` keeps its default `maxxscale = maxyscale = 2`
(`obj_growtangle_Create_0.gml:13-14`).

### Turn block — there isn't one

All three `scr_turntimer` calls sit **inside their own dispatcher branch**, on the
line after the `scr_bulletspawner` (`Step_0:190 / :198 / :206`). This is the Queen
situation exactly: any slice that carries the turn value also carries
`dc = scr_bulletspawner(x, y, obj_dbulletcontroller)`, and replaying it would
double-spawn the controller — the Knight bug already documented in
`gen_attacks.js`. Use `turnByChoice`:

```
rr 0 → 210    rr 1 → 200    rr 2/else → 180    pre-attack floor → 120 (Step_0:242)
```

`scr_turntimer` only raises, so the `else scr_turntimer(120);` floor that runs
while `rtimer < 16` never lowers a real value, and nothing shortens the turn
afterwards (the controller's only direct `global.turntimer = 200;` write, at
`obj_dbulletcontroller_Step_0.gml:265`, is in the type-8 **difficulty 1** arm,
which fight 1 never selects).

---

## Fight 2 — `obj_berdlyb2_enemy`, chooser at `Step_0:36-59`

Two hops: `rr` picks, `chosenattack` dispatches, and the mapping is **not the
identity**.

```gml
if (sideb_route)                                          // Step_0:36-41
    rr = 2 - rr;
else if (turns == 2 || scr_monsterpop() > 1)
    rr = irandom(2);
else
    rr = attack_phase;

if (rr == 0) { chosenattack = 0; ... }   // Step_0:43-47  -> Tornado
if (rr == 1) { chosenattack = 2; ... }   // Step_0:49-53  -> Chirashi
if (rr == 2) { chosenattack = 1; ... }   // Step_0:55-59  -> SpearBlast
```

Difficulty is derived from the field, not hardcoded:

```gml
difficulty = (scr_monsterpop() == 1) ? 1 : 0;             // Step_0:421
```

and the dispatcher (`Step_0:438-496`) passes it through, with one override:

```gml
if (chosenattack == 0)      { ... dc.type = 8;  dc.difficulty = difficulty; }              // :442-448
else if (chosenattack == 1) { ... dc.type = 9;  dc.difficulty = sideb_route ? 2 : difficulty; }  // :449-455
else                        { ... dc.type = 10; dc.difficulty = difficulty; }              // :456-462

scr_turntimer(260);                                       // :464
turns += 1;
if (!sideb_route && scr_monsterpop() == 1)
    attack_phase = (attack_phase + 1) % 3;                // :467-468
```

### Normal-route progression

`attack_phase = 0`, `chosenattack = 0`, `rr = 0` in Create (`:31/:32/:35`).

- **turn 0** — `scr_monsterpop() == 1`, `turns != 2` → `rr = attack_phase` = 0 →
  **Tornado**, difficulty **1** (Berdly is alone). `attack_phase → 1`.
- **turn 1** — same path → `rr = 1` → **Chirashi**, difficulty **1**.
  `attack_phase → 2`.
- **turn 2** — the `turns == 2` arm forces `rr = irandom(2)`. In the *same*
  enemytalk phase Berdly summons: `Step_0:110-112` sets `summoning = true` and
  `Step_0:344-373` runs `scr_monster_add(33, obj_werewire_enemy)` `3 -
  scr_monsterpop()` times. By the time `:421` runs, `scr_monsterpop()` is 3 →
  difficulty **0**. `attack_phase` is *not* advanced (`:467` requires pop == 1),
  so it stays at 2.
- **turns 3+ while any werewire lives** — `scr_monsterpop() > 1` → `rr =
  irandom(2)`, difficulty **0**. All three attacks in play at d0.
- **after the werewires are gone** — pop returns to 1 → `rr = attack_phase`
  resumes cycling from 2, difficulty back to **1**. This is the only route to
  SpearBlast at difficulty 1 in fight 2.
- **turn 6+** — the scripted dialogue ladder ends (`Step_0:63` is
  `if (turns <= 5)`), the attack machinery is unchanged.

### Weird-route (Snowgrave) progression

`sideb_route = scr_sideb_get_phase() > 0`, latched in `Create_0.gml:7`. The whole
turn-0..5 dialogue block — **including the summon** — is inside
`if (scr_sideb_get_phase() == 0)` (`Step_0:61-280`), so **no werewires are ever
summoned on the weird route**, `scr_monsterpop()` is 1 forever, and difficulty is
always 1 (except SpearBlast, which is forced to 2).

The chooser degenerates to `rr = 2 - rr`. With `rr = 0` from Create, **turn 1 is
always SpearBlast at difficulty 2** — the homing-spear opener of the
Snowgrave fight. After that, `Step_0:472`'s `rr = choose(0, 1, 2, 3, 4, 5)`
battle-message roll (which the normal route safely ignores, because its chooser
overwrites `rr` unconditionally) **is** the input to `2 - rr` on the next turn:

| `choose` result | next turn `rr` | `chosenattack` | attack |
|---|---|---|---|
| 0 | 2 | 1 | SpearBlast (d2) |
| 1 | 1 | 2 | Chirashi (d1) |
| 2 | 0 | 0 | Tornado (d1) |
| 3, 4, 5 | −1, −2, −3 | *unchanged* | previous attack repeats |

So on the weird route all three attacks occur, half the time repeating. Note
`Step_0:492-493` blanks the battle message on this route
(`global.battlemsg[0] = stringset(" ")`), which is why the roll is invisible.

Also weird-route only: if Kris is at 0 HP, Berdly skips his turn entirely —
`Step_0:412-418` calls `scr_mnendturn()` instead of building the box.

### Real roster — fight 2 (7 entries)

| context | `rr` | `chosenattack` | type | difficulty | turn |
|---|---|---|---|---|---|
| solo (turn 0, and after werewires die) | 0 | 0 | 8 | 1 | 260 → **200** |
| solo | 1 | 2 | 10 | 1 | 260 |
| solo | 2 | 1 | 9 | 1 | 260 |
| werewires alive | 0 | 0 | 8 | 0 | 260 |
| werewires alive | 1 | 2 | 10 | 0 | 260 |
| werewires alive | 2 | 1 | 9 | 0 | 260 |
| **weird route only** | 2 | 1 | 9 | **2** | 260 |

The `260 → 200` is real: the type-8 difficulty-1 arm opens with

```gml
if (init == 1 && difficulty == 1)
{
    special = 1;
    init = 2;
    global.turntimer = 200;      // obj_dbulletcontroller_Step_0.gml:265
}
```

That is a **direct assignment**, not `scr_turntimer`, so unlike everything else in
these fights it *lowers* the turn.

### Box block — `Step_0:423-430`

```
anchor    : if (!i_ex(obj_moveheart) && !i_ex(obj_heart))
endAnchor : }
```

Same shape as fight 1 (anchor unique, no braces between 423 and 430, closer on
431), verified by replaying the generator's extractor:

```gml
if (!i_ex(obj_moveheart) && !i_ex(obj_heart))
    scr_moveheart();

if (!i_ex(obj_growtangle))
    instance_create(__view_get(e__VW.XView, 0) + 320, __view_get(e__VW.YView, 0) + 170, obj_growtangle);

if (difficulty == 1 && chosenattack == 0)
    obj_growtangle.target_angle += 45;
```

Here the 45° rotate **is** real content — a solo Berdly Tornado turn always tilts
the box. The slice deliberately starts *after* `Step_0:421`'s
`difficulty = (scr_monsterpop() == 1) ? 1 : 0;` so replaying it does not overwrite
the studio's own difficulty pick; apply that line yourself if you want the
authentic coupling.

### Turn block — `Step_0:464`

```
anchor    : scr_turntimer(260);
endAnchor : turns += 1;
```

Both unique; extracts to exactly `scr_turntimer(260);`. Identical in shape to
Spamton NEO's turn block, and it passes `extractTurnBlock`'s `/turntimer/`
disambiguation trivially. Pre-attack floor `scr_turntimer(120);` at `Step_0:499`.

---

## Cut content

Berdly's *dispatchers* have no cut branches at all — both are three-arm if/else
chains ending in a bare `else`, and both choosers can produce every arm. That is
unusual, and it is why this roster is 10 entries with nothing thrown away. The cut
content is elsewhere.

| what | where | why it can never happen |
|---|---|---|
| **"Mr. Bones' Wild Ride" ACT** (`acting == 4`) | `obj_berdlyb_enemy_Step_0.gml:304-314` — sets `mrboneswildride = 1`, which raises `o_coaster_controller.timermax` from 180 to **250** (`Step_0:416-417`) and forces all three heroes onto the coaster | `acting` is act index + 1 (`scr_actselect.gml:6`), so this needs `global.canact[myself][3]`. `scr_monstersetup.gml:1188-1218` (monstertype 43) defines only indices 0 (Check), 1 (Bump), 2 (BumpX), and `scr_monster_actreset(myself)` clears the array first (`scr_monstersetup.gml:3`). Index 3 is never set for type 43 anywhere in ch2 |
| **NITRO bump variant** | `o_coaster_berdly_Collision_o_coaster_hero.gml:9-12`, `o_coaster_hero_Other_24.gml:1` | `obj_berdlyb_enemy.nitro` is 0 in `Create_0.gml:13` and the only other write in ch2 is `if (nitro > 0) nitro -= 1;` (`Step_0:17-18`). Nothing raises it |
| **PREMONITION telegraph** | `o_coaster_berdly_Create_0.gml:30-37`, `o_coaster_berdly_Step_0.gml:83-90`, draw loop at `o_coaster_berdly_Draw_0.gml:46-52` | Identical shape: `premonition = 0` (`Create_0.gml:14`), only ever decremented (`Step_0:20-21`) |
| **Tornado `special == 2`** (phase-offset ring) | `obj_dbulletcontroller_Step_0.gml:356-357` and `:372-376` | The controller's `special` is only ever set to **1**, at `:263`, and cleared to 0 at `:368-371`. `grep -rn "special = 2;"` over ch2 finds only `obj_onionbody`, `obj_queen_bulletcontroller` (`d.special`) and `obj_sneo_bulletcontroller` |
| **Tornado at any difficulty other than 0 or 1** | `obj_dbulletcontroller_Step_0.gml:273/308` is a strict `if / else if` with **no else** | Spawns literally nothing. Neither Berdly can produce it, but the studio's DIFF selector could — legal type-8 difficulties are 0 and 1 only |
| **`bulletoverride`** | `obj_berdlyb2_enemy_Create_0.gml:19` | Never read. Copy-paste from `obj_rouxls_enemy` / `obj_spamton_enemy`, where it *is* read (`obj_spamton_enemy_Step_0.gml:82`) |
| **Werewire hang attack** (`rr == 3`, `shootmode 2`, `global.turntimer = 170`) | `obj_werewire_enemy_Step_0.gml:52`, `:68-80` | `rr = (scr_monsterpop() > 1) ? choose(0, 1) : 3;`. In the Berdly fight the werewires exist only because Berdly summoned them, so pop is always ≥ 2 and `rr` is always `choose(0, 1)`. Their `if (!instance_exists(obj_berdlyb2_enemy))` guards at `:56` and `:132` show the author tracking both contexts |
| **Orphaned objects** — `obj_berdlyb_tornado_old`, `o_coaster_controller_old`, `o_coaster_hero_old`, `o_coaster_hero_back_old`, `obj_berdlyb_wire_old` | — | `grep` over the whole ch2 dump: zero references from outside each object's own event files. Earlier revisions of the tornado bullet and of the entire bumper-car minigame |
| **`obj_berdlyb_enemy` Other_5** | `gml_Object_obj_berdlyb_enemy_Other_5.gml` | Single `exit;`. Do not go looking for an `event_user` chooser here |

One near-miss worth recording: **`obj_berdlyb_spearblast_mini` looks orphaned but
is not** — it is spawned as a child bullet at
`obj_berdlyb_spearblast_bullet_Step_0.gml:33` via `scr_childbullet`.

---

## Phases, HP gates, soul modes

Neither fight uses a non-red soul, changes the box size, or has HP-gated attack
phases. Everything else is dialogue and mercy state.

**Fight 1** has no attack progression at all — a flat 3-cycle from turn 1 to the
end. Its only gates are cosmetic/mercy:

- `Step_0:57-62` — once, at `mercymod > 0` with `balloonorder > 4`: "Go ahead,
  *bump* me, you bumpbarians!" (`ballooncon = 1`).
- `Step_0:50-56` — once, at `mercymod > 50` **or** HP < 50% with
  `balloonorder > 4`: "What? My car is breaking!?" → `ballooncon = 2` → "This is
  Smart Smoke!". Same threshold flips Berdly's car to the damaged sprite
  (`o_coaster_berdly_Step_0.gml:1`).
- `Step_0:65-84` — five one-shot "default" balloons on `balloonorder` 0..4.
- **Victory is mercy, not damage.** `o_coaster_controller_Step_0.gml:89-90`
  applies `bumpmercy`, and `:92-93` sets `obj_berdlyb_enemy.endcon = 1` at
  mercy ≥ 100. `endcon` runs the scripted ending at `Step_0:490-535` —
  `skipvictory = 1`, `snd_bomb` at `endtime == 30`, Berdly's "W-what...? My
  coaster, it's...!", `scr_wincombat()` at 90. Casting Pacify short-circuits to
  the same ending (`scr_spell.gml:100-111`).

**Fight 2, normal route** — turn-indexed dialogue script for turns 0-5
(`Step_0:61-255`), with the summon on turn 2. Turn 6+ falls through to
`Step_0:256-279` (a one-shot "Don't worry, it's part of my calculations!" if
Noelle has been hurt). Victory at mercy ≥ 100 (`Step_0:691-697`).

**Fight 2, weird route** — `scr_sideb_get_phase() > 0` (gated on
`global.flag[915]`/`[916]`, `scr_sideb_get_phase.gml`). No summon, no dialogue
ladder; instead:

- ACT names swap to **Glare** / **Wake** (`scr_monstersetup.gml:1304-1309`), and
  Glare drops `global.monsterdf` by 5 per use (`Step_0:592`).
- `obj_berdlyb_spearblaster` swaps to `spr_berdlyb_super_jump_serious`
  (`obj_berdlyb_spearblaster_Create_0.gml:5-6`); Berdly's idle is
  `spr_berdlyb_idle_serious` (`Create_0.gml:8`).
- **Berdly is the only enemy in ch2 that cannot be frozen**: `freezable = 0` in
  `Create_0.gml:25`, against `scr_enemy_object_init.gml:53`'s default of 1, which
  `obj_icespell_Draw_0.gml:57` checks. IceShock alone cannot finish him.
- SnowGrave is intercepted by the boss for the first three attempts:
  `global.bmenuno == 99` → `Step_0:721-784` plays a Noelle refusal, increments
  `global.flag[924]`, and bounces the menu back to `global.bmenuno = 2`. On the
  fourth attempt `scr_spellinfo.gml:134-139` sets `spellanim = 1` and the spell
  fires; `scr_spell.gml:275-279` sets `global.spelldelay = 999999`.
- The kill is a 30-step cutscene: `obj_spell_snowgrave_Draw_0.gml:231-241` sets
  `obj_berdlyb2_enemy.sidebcon = 1`, which drives `Step_0:786-889` to
  `scr_losechar()`, `global.flag[915] = 6`, `global.flag[38] = 1`, and
  `scr_wincombat()`.

---

## What the studio will need to special-case

1. **Split this into two `BOSSES` entries** — `berdly_coaster`
   (`obj_berdlyb_enemy`) and `berdly_noelle` (`obj_berdlyb2_enemy`). Same three
   types, but 210/200/180 vs a flat 260, and hardcoded vs derived difficulty.
   `berdly.json`'s `fights[]` holds two ready-made configs.
2. **Fight 1 has no sliceable turn block** — without `turnByChoice` the studio
   floor cuts the 210-frame Tornado to 120 and the later tornado waves never
   spawn.
3. **Hard dependencies with no `instance_exists` guard.** `obj_growtangle`: the
   controller preamble reads `.y`/`.sprite_height` at
   `obj_dbulletcontroller_Step_0.gml:15-16`, type 8 d0 reads `.sprite_height` at
   `:277`, d1 reads `.x`/`.y` at `:331-332`, and
   `obj_berdlyb_chirashistorm_Create_0.gml:3-4` reads `.x`/`.y`. `obj_heart`:
   `obj_berdlyb_chirashibullet_Step_0.gml:45` in the d0 arm.
4. **`creator` must be a valid monster slot for type 9.** `:388` does
   `global.monsterinstance[creator].visible = 0;` and
   `obj_berdlyb_spearblaster_Destroy_0.gml` does the matching `= 1`. A
   hand-built controller that skips `scr_bulletspawner` will throw on frame one,
   or half-run and leave the boss invisible.
5. **Difficulty is passed, never read from the boss.** Write `dc.difficulty`
   directly. Legal values: **0/1/2** for types 9 and 10, **0/1 only** for type 8.
6. **Fight 1's ACT is a real-time minigame the engine does not have.**
   `obj_berdlyb_enemy_Step_0.gml:4` creates `o_coaster_controller` on frame one;
   it spawns `o_coaster_berdly` plus three `o_coaster_hero` (+ `o_coaster_hero_back`),
   reads raw Z/X/C (`mykey 90/88/67`, `o_coaster_controller_Create_0.gml:13-15`)
   inside a `timermax`-180 window, has its own collision event, and pays out in
   mercy. It never announces a `monsterattackname`, so no scanner will find it.
7. **Fight 1's boss is drawn by a proxy.** `Create_0.gml:5` sets
   `visible = false`; only `alarm[5]` (armed from `Step_0:5`) turns it back on,
   and `o_coaster_berdly_Draw_0.gml:1-4` mirrors `sprite_index` / `image_index`
   across. A launcher that never creates `o_coaster_berdly` renders nothing.
   `Destroy_0` also tears down `o_coaster_berdly`, `o_coaster_hero`,
   `o_coaster_controller` and `obj_herokris`, and creates
   `o_berdly_coaster_end_fix`.
8. **Fight 2 needs a fourth party member.** Noelle is `global.hp[4]` /
   `global.battlemag[1]` / `canactnoe`, read at `Step_0:28-31`, `:218`, `:265`,
   and `global.charcantarget[0]` at `:14`. It also needs `obj_werewire_enemy`
   addable at runtime via `scr_monster_add(33, ...)`, and it branches on
   `scr_monsterpop()` for **both** the attack and the difficulty — in a
   one-monster studio scene fight 2 will only ever produce its solo (difficulty 1)
   variants.
9. **`scr_sideb_get_phase()` must be stubbable** — it decides `sideb_route`, the
   difficulty-2 SpearBlast, the spearblaster sprite, and the ACT names.
10. **Attack names are load-bearing beyond bookkeeping.**
    `obj_werewire_enemy_Step_0.gml:156` reads
    `scr_monsterattacknamecount("Chirashi")` to slow its own shot rate while a
    Chirashi storm is on screen.

---

## Summary

**10 real roster entries** (3 in fight 1, 7 in fight 2), covering **8 distinct
(type, difficulty) controller configurations** across the two battles. **Zero cut
dispatcher branches** — the cut content is one ACT (`acting == 4`), two dead
coaster mechanics (`nitro`, `premonition`), one controller path (`special == 2`),
one unreachable ally attack, and five orphaned legacy objects.
