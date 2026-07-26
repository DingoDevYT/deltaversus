# The Titan (ch4) — the REAL roster, derived from the chooser

**Enemy objects.** `objects.tsv` lists three candidates. Only two are enemies:

| object | parent | role |
|---|---|---|
| `obj_titan_enemy` | `obj_monsterparent` | **the boss.** monstertype 108, HP 21000, AT 18 (`scr_monstersetup.gml:2026-2069`) |
| `obj_titan_spawn_enemy` | `obj_monsterparent` | a **separate, earlier encounter** — "Titan Spawn", monstertype 109, HP 3000 (`scr_monstersetup.gml:2072-2111`) |
| `obj_titan_enemy_actor` | *(none)* | not an enemy — a visual stand-in with no battle code. `obj_titan_enemy_Create_0.gml:129-135` copies its `siner` and destroys it. Its Create is a near-verbatim copy of the boss's (same `unleash_hp = 3000`, `attack_chooser = 6`, `handattackhardcon = 0`), but it has only Create/Draw/Step and never touches `myattackchoice`. |

So the fight is driven by **`obj_titan_enemy`**, dispatching `obj_dbulletcontroller` with a `.type`,
chosen by **`myattackchoice`** — the same shape as the Knight. `obj_titan_spawn_enemy` runs its own
smaller version of the same dispatcher and is documented at the bottom.

---

## The dispatcher (17 + 1 branches)

`obj_titan_enemy_Step_0.gml:169-322`, all inside `if (scr_isphase("bullets") && attacked == 0)` at
`rtimer == 12`:

| choice | type | name | line |
|---|---|---|---|
| 0 | 461 | darkshapeswithred | 180-186 |
| 1 | 451 | darkshapescentipedeharder | 188-193 |
| 2 | 452 | darkshapesbigshot | 195-200 |
| 3 | 453 | darkshapesbigshotdesperation | 202-208 |
| 4 | 454 | darkshapesbigshotaimed | 210-215 |
| 5 | 470 | darkshapescentipedehardest | 217-222 |
| 6 | 456 | darkshapesintro | 224-229 |
| 7 | 457 | darkshapescentipedeintro | 231-236 |
| 8 | 458 | darkshapesmine | 238-243 |
| 9 | 459 | thehands | 245-250 |
| 10 | 462 | thehandsfast | 252-257 |
| 11 | 463 | thehandsfastest | 259-264 |
| 12 | 464 | darkshapescentipedenoshapes | 266-271 |
| 13 | 465 | darkshapesbigshotdesperationshort | 273-279 |
| 14 | 468 | darkshapeharder | 281-287 |
| 15 | 469 | darkshapehardest | 289-295 |
| 16 | 472 | darkshapefinal | 297-303 |
| **20** | — | `instance_create(x, y, obj_titan_heal)` | 305-314 |

Choice 20 has **no `global.monsterattackname` line**, so `gen_attacks.js`'s announcement scan will
never see it. It has to be declared by hand, exactly like Pink's dates.

## The chooser

Everything that assigns `myattackchoice` anywhere in chapter 4:

**`obj_titan_enemy_Other_10.gml`** (`event_user(0)`), called from `Step_0:332` after
`phaseturn++` at the end of every enemy turn, and again from `Step_0:2014` the moment UNLEASH lands:

```gml
if (phase == 1)
{
    if (phaseturn == 1)  { myattackchoice = 0;  ... }          // :10-15
    if (phaseturn == 2)  { myattackchoice = 12; ... }          // :17-22
    if (phaseturn == 3)  { myattackchoice = 9; phaseturn = 0; }// :24-30
}
else if (phase == 2)
{
    if (phaseturn == 1)  { myattackchoice = 4;  ... }          // :34-48
    if (phaseturn == 2)  { myattackchoice = 1; phaseturn = 1;
                           phase = 3; deunleash = true; }      // :50-68
}
else if (phase == 3)   // 1 :74 · 14 :81 · 10 :88, phaseturn = 0 :90
else if (phase == 4)   // 4 :99 · 5 :115 -> phase = 5, deunleash = true :118-119
else if (phase == 5)   // 5 :137 · 15 :144 · 11 :151, phaseturn = 0 :153
else if (phase == 6)   // loopedphase6 ? 4 (:175) : switch(phase6turn){1: 3 (:185); 2: 4 (:192)}
else if (phase == 7)   // 20 · 20 · 20  (:215, :221, :227)
else if (phase == 8)   // dualbusterused ? 4 (:236) : 15 (:238)
```

Plus five one-off writes in `Step_0`:

- `:44` `myattackchoice = 20` — HP ≤ 50 % trips `finalunleashphasedone` and forces a heal turn.
- `:57` `myattackchoice = 20` — phase 8 and HP ≤ 40 %.
- `:1298` `myattackchoice = 15` — the turn on which phase 8 and the DualBuster ACT open.
- `:1315` `myattackchoice = 4` — `endingcon == 23`, the turn after DualBuster fires.
- `:1683` `myattackchoice = 15` — the DualBuster ACT's own resolution.

And `Create_0.gml:61` `myattackchoice = 0` for turn one — which agrees with phase 1 / phaseturn 1,
so unlike the Knight there is no orphan Create value.

**Union of assignable values: `{0, 1, 3, 4, 5, 9, 10, 11, 12, 14, 15, 20}`.**
`{2, 6, 7, 8, 13, 16}` have no writer anywhere.

## Phase ladder

`Step_0:1967-2018` is the UNLEASH ACT's resolution (`acting == 4.2`, the 200-TP ACT from
`scr_monstersetup.gml:2055-2059`). It sets `unleashed = true`, advances the phase, then does
`phaseturn = 1; event_user(0); phaseturn = 0;` so the phase's first attack replaces whatever was
already queued — and the next end-of-turn `phaseturn++` re-selects that same first attack.

```
phase 1  {0, 12, 9} loop ──UNLEASH──▶ phase 2  {4, 4, 1}
                                              └─ phase-2 pt2 sets phase = 3, deunleash
phase 3  {1, 14, 10} loop ─UNLEASH──▶ phase 4  {4, 4, 5}
                                              └─ phase-4 pt2 sets phase = 5, deunleash
phase 5  {5, 15, 11} loop ─UNLEASH──▶ phase 6  {3, then 4 forever}   unleashmultiplier 1.2/1.2/2/3
HP ≤ 50 % (Step_0:25) ─────────────▶ phase 7  {20, 20, 20} + cutscene
endingcon 22.5 (Step_0:1292) ──────▶ phase 8  {15 → DualBuster → 4 → Susie's Idea}
```

Three arms of the unleash switch are **dead**. `Step_0:1975` (`phase == 2 → 4`), `:1983`
(`phase == 4 → 6`) and `:1997` (`phase == 6 → 6`) can never fire, because `unleashed` is only
cleared by `deunleash` (`Step_0:338-348`) and `deunleash` is set only on the LAST turn of phases 2
and 4 — at which point `phase` has already been moved on to 3 or 5. During phases 2, 4 and 6 the
ACT falls into `Step_0:1936-1944` ("Kris!! What are you doing!? Attack!!") instead. This does not
change the roster: every choice in those arms is reachable another way.

Phase 6 reaches choice **3** exactly once per fight. `Create_0.gml:37` sets `loopedphase6 = 0`, so
the first phase-6 turn falls through to `switch (phase6turn)` → case 1 → choice 3; case 2 then sets
`loopedphase6 = true` (`Other_10.gml:203`) and every later phase-6 turn takes the `if (loopedphase6)`
shortcut to choice 4. (The `if (loopedphase6 == true)` at `:197` is inside case 2 *before* the
assignment on `:203`, so that battle message is itself dead code.)

## Real roster — 12 entries for the Titan proper

| # | choice | type | name | where it plays | turn |
|---|---|---|---|---|---|
| 1 | 0 | 461 | darkshapeswithred | p1 t1 (and turn one, `Create:61`) | 420 |
| 2 | 12 | 464 | darkshapescentipedenoshapes | p1 t2 | 420 |
| 3 | 9 | 459 | thehands (difficulty 0) | p1 t3 | 360 |
| 4 | 4 | 454 | darkshapesbigshotaimed | p2 t1, p4 t1, p6 loop, p8 post-DualBuster | 360 |
| 5 | 1 | 451 | darkshapescentipedeharder | p2 t2, p3 t1 | 420 |
| 6 | 14 | 468 | darkshapeharder | p3 t2 | 420 |
| 7 | 10 | 462 | thehandsfast (difficulty 1) | p3 t3 | 360 |
| 8 | 5 | 470 | darkshapescentipedehardest | p4 t2, p5 t1 | 420 |
| 9 | 15 | 469 | darkshapehardest | p5 t2, p8 pre-DualBuster | 420 |
| 10 | 11 | 463 | thehandsfastest (difficulty 2) | p5 t3 | 360 |
| 11 | 3 | 453 | darkshapesbigshotdesperation | p6, once | 430 |
| 12 | 20 | — | **the Titan regenerates** — turn replacement, `obj_titan_heal` | p7 ×3, HP 50 %, p8 HP 40 % | 360 |

`difficulty` is `0` on every single one of them — `Other_10` writes `difficulty = 0` next to every
`myattackchoice`. Unlike the Knight, the Titan escalates by swapping to a harder *type*, not by
raising a difficulty field. What the dispatcher never passes on, the controller supplies: types
462/463 set `_titanhandsmanager.difficulty = 1 / 2` themselves
(`obj_dbulletcontroller_Step_0.gml:3767, 3781`).

## Cut — 6 entries

| choice | type | name | why it can never be chosen |
|---|---|---|---|
| 2 | 452 | darkshapesbigshot | No writer in either fight. Its fossils survive twice over: the box block still tests `myattackchoice == 2` (`Step_0:155`) and the turn ladder still has the dead `if (myattackchoice == 2) scr_turntimer(270);` (`Step_0:177-178`). |
| 6 | 456 | darkshapesintro | No Titan writer. **Reachable in the Titan Spawn fight** (`obj_titan_spawn_enemy_Other_10.gml:5`), so the deduped roster entry is real — just not in this fight. |
| 7 | 457 | darkshapescentipedeintro | No writer in either fight. |
| 8 | 458 | darkshapesmine | No writer — and **broken**: `obj_dbulletcontroller_Step_0.gml:3692` guards on `if (!made && obj_)`, a dangling identifier, and its `pattern_mines` is never defined in `obj_darkshape_manager_Create_0.gml`. |
| 13 | 465 | darkshapesbigshotdesperationshort | No writer. The only branch that *lowers* the turn (`global.turntimer = 240;`, `Step_0:278`) — hence "short". |
| 16 | 472 | darkshapefinal | No writer, `scr_turntimer(900)`. `pattern_darkshape_final` (`obj_darkshape_manager_Create_0.gml:1036-1045`) spawns `obj_darkshape_giant`, which never appears in the shipped fight. The real finale is choice 15 → DualBuster → choice 4 → Susie's Idea. |

Two more controller branches — types **466** (`pattern_mineguys`) and **467**
(`pattern_darkshape_walls`) — exist in `obj_dbulletcontroller_Step_0.gml:3830` and `:3851` with
**no dispatcher entry anywhere in chapter 4**, so they never even become roster rows. Both call
undefined pattern functions. (Type 471 in the same file is `obj_holywatercooler_enemy`'s, not the
Titan's — `obj_holywatercooler_enemy_Step_0.gml:389`.)

---

## The box block

`obj_titan_enemy_Step_0.gml:153-159`, anchor `if (!instance_exists(obj_growtangle))` (unique in the
file), 415 characters:

```gml
if (!instance_exists(obj_growtangle))
{
    if (myattackchoice == 2 || myattackchoice == 3 || myattackchoice == 4)
        instance_create(__view_get(e__VW.XView, 0) + 250, __view_get(e__VW.YView, 0) + 200, obj_growtangle);
    else
        instance_create(__view_get(e__VW.XView, 0) + 320, __view_get(e__VW.YView, 0) + 170, obj_growtangle);
}
```

The three big-blast attacks shift the box left and down so the blasts, which are fired from
`obj_growtangle.x + 240`, have room to cross it. `maxxscale`/`maxyscale` stay at `obj_growtangle`'s
default 2/2 except for types **468** (2.125) and **469** (2.25), which the controller sets itself
(`obj_dbulletcontroller_Step_0.gml:3867-3871, 3893-3897`) — so the per-attack `setup` slice is not
where that lives, and the studio gets it for free by actually spawning the controller.

The whole block already sits inside `if (myattackchoice == 20) { } else { ... }` (`Step_0:148-163`),
so **a heal turn creates no box at all** — and `Step_0:61` likewise skips `obj_darkener` when
`myattackchoice == 20`.

## The turn block

`obj_titan_enemy_Step_0.gml:175-178`, anchor `scr_turntimer(360);`, endAnchor
`if (myattackchoice == 0)`:

```gml
scr_turntimer(360);

if (myattackchoice == 2)
    scr_turntimer(270);
```

Two traps here.

1. **`scr_turntimer(270)` is a no-op.** `scr_turntimer` only raises
   (`scr_turntimer.gml:2-3`), and 360 was set one line earlier — the same fossil Spamton NEO has
   with his `scr_turntimer(90)` after 260. Choice 2 really would get 360, if it were reachable.
2. **The endAnchor is mandatory.** This ladder has no closing `else scr_turntimer(N);`, which is the
   only terminator `extractTurnBlock` recognises on its own; without an endAnchor the slice would
   run through the entire dispatcher and the studio would spawn a *second* `obj_dbulletcontroller`
   every turn — the exact bug the Knight's notes record.

Per-attack overrides are all *inside* the dispatcher branches, so they ride along in each entry's
`setup`: 420 for choices 0/14/15, 430 for choice 3, `global.turntimer = 240` for the cut choice 13.
Controller-side raises to 420 also exist for types 451/455/457/464/470
(`obj_dbulletcontroller_Step_0.gml:3551, 3643, 3684, 3803, 3930`), which is why choices 1/5/12 read
420 even though their branches say nothing.

One override is **not** capturable: `if (myattackchoice == 4 && phase == 8) global.turntimer = 240;`
(`Step_0:319-320`) sits after `turns += 1`, outside every branch, and needs `phase == 8`. The
studio will run choice 4 at 360 rather than the phase-8 240.

Termination depends on this: `obj_darkshape_manager_Step_0.gml:3-7` destroys itself the moment
`global.turntimer <= 0`, so an unreplayed turn block means the attack ends on frame one.

---

## What the fight actually is

RED soul, plain rectangular box, **no green/purple/yellow modes, no minigame turns, no
turn-replacement dates**. The one non-bullet turn is choice 20, which just plays `obj_titan_heal`.

The mechanic is light versus dark. `obj_darkshape` bullets home in on the SOUL
(`obj_darkshape_Create_0.gml:136-171`); loitering inside `obj_darkshape_light_aura` — whose radius
tracks `obj_titan_enemy.light_radius`, default 48, raised by the 10-TP **Brighten** ACT — burns a
shape's `light` to 1, killing it into an `obj_darkshape_greenblob`
(`obj_darkshape_Create_0.gml:94-134`) that pays out TENSION scaled by `obj_titan_enemy.tensionscaling`.
That scaling ramps 1 → 1.5 → 2 → 3 after 4, 5 and 7 turns without an UNLEASH
(`Step_0:74-81`), so the game hands you the 200 TP if you stall. Spending it is the entire phase
engine.

Damage (`obj_heroparent_Step_0.gml:362-392`): ×0.5 while shielded, ×0.1 in `drawstate == "defense"`,
×5 on the exposed weak point — ×10 with weapon 26 or 11 — all times `unleashmultiplier`, which
phase 6 ramps 1.2 / 1.2 / 2 / 3 (`Other_10.gml:159-171`). Against 21000 HP that is why phase 6 is
where the fight is won.

**The hands attacks carry state between turns.** `obj_titan_battle_hands_manager_Create_0.gml:82-146`
and `:205-269` read `hand1_finger1..4` / `hand2_finger1..4` off `obj_titan_enemy` and immediately
re-destroy any finger that was broken on a previous turn. Types 459 → 462 → 463 are the same attack
at difficulty 0 → 1 → 2, and a fresh studio launch always starts with all eight fingers intact.

### Dead variables, for anyone reading the source

- `first_barrage` is set `true` in all three Creates (`obj_titan_enemy_Create_0.gml:49`,
  `..._actor_Create_0.gml:43`, `obj_titan_spawn_enemy_Create_0.gml:15`) and **never cleared**, so
  all seventeen `if (!creatorid.first_barrage)` barrage overrides in `obj_dbulletcontroller` are
  unreachable.
- `attack_chooser = 6` — written in all three Creates, read nowhere.
- `handattackhardcon = 1` at `Other_10.gml:91` (phase 3 t3, the first `thehandsfast`) — read nowhere.
- `unleash_hp = 3000` / `unleash_hpmax`, reset at `Other_10.gml:57` and `:120` — read nowhere. The
  shield is not a second HP bar; it is the `unleashed` boolean plus the TP cost of the ACT.
- `pattern_centipede_hard` is **defined twice** in `obj_darkshape_manager_Create_0.gml` (`:281` and
  `:994`); the later three-head, `phase_difficulty = 3` version wins for both type 455 and type 470.
- `pattern_bigshots_easy` (`:495`) is defined and never referenced.

---

## Sub-fight: the Titan Spawn (`obj_titan_spawn_enemy`)

A separate, earlier encounter. Multiple instances can co-exist and only the first is the
battlecontroller (`Create_0.gml:4-5`), which is why its box/turn/dispatch code is all gated on
`if (battlecontroller)`. Its chooser is a three-line ladder called from `Step_0:6`:

```gml
phaseturn++;
if (phaseturn == 1) { myattackchoice = 6;  }    // Other_10.gml:3-7
if (phaseturn == 2) { myattackchoice = 10; }    // :9-13
if (phaseturn == 3) { myattackchoice = 0; phaseturn = 2; }  // :15-20
```

`phaseturn = 2` on the third call means the sequence is **6, 10, 0, 0, 0, …** forever, until the
160-TP **Banish** ACT ends it (`Step_0:313-314` → `scr_wincombat`).

- **Used (3):** choice 6 → type 456 *darkshapesintro*, choice 10 → type 460 *darkshapesspeedup*,
  choice 0 → type 450 *darkshapeswithred* (which sets no `pattern_to_use` and therefore runs
  `obj_darkshape_manager`'s default, `Create_0.gml:1047`).
- **Cut (8):** choices 1, 2, 3, 4, 5, 7, 8, 9 → types 451, 452, 453, 454, 455, 457, 458, 459
  (`Step_0:57-118`). Of those, 451/453/454/459 are real in the Titan proper; 452/457/458 are cut in
  both; **455 (`darkshapescentipedehard`) exists only here and is unreachable**, the one genuinely
  new cut entry the spawn contributes.

Its box (`Step_0:33-34`) is the plain `view + (320, 170)` with no per-attack offset, and its turn
length is a flat `scr_turntimer(360)` *after* the dispatch (`Step_0:127`) with no per-attack
override at all — so the Titan's own turn block covers it.

Listing `gml_Object_obj_titan_spawn_enemy_Step_0.gml` in `extraAttackFiles` is enough to pull types
**450**, **455** and **460** into the roster; the other eight spawn announcements collapse into the
Titan's own entries under `gen_attacks.js`'s `boss|controller|type` dedupe key, which is the right
outcome because the Titan's entries carry the `setup` slices.

---

## Counts

**21 roster entries: 15 real, 6 cut.**
12 real belong to `obj_titan_enemy` (11 bullet attacks + 1 declared heal turn); 3 belong to
`obj_titan_spawn_enemy`. Of the 6 cut, 5 are Titan dispatcher branches (choices 2, 7, 8, 13, 16)
and 1 is spawn-only (type 455). Type 456 counts as real because the spawn fight plays it, even
though the Titan's choice 6 has no writer.
