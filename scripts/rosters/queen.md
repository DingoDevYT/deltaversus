# Queen (ch2) — `obj_queen_enemy`, chooser in `Other_10`

**16 of the 30 dispatcher entries appear in the real fight. 14 are cut.**
(Plus 3 controller branches — types 4, 9, 2.3 — and the whole `bufferattack`
sub-system, which no dispatcher arm can reach at all.)

All file paths below are relative to
`C:/Users/lando/Desktop/DELTARUNE - GML/DELTARUNE Chapter 2 - GML/`.
"Step_0" alone means `gml_Object_obj_queen_enemy_Step_0.gml`;
"Other_10" means `gml_Object_obj_queen_enemy_Other_10.gml`;
"ctrl" means `gml_Object_obj_queen_bulletcontroller_Step_0.gml`.

---

## Shape of the fight

Queen is the **first boss in the studio whose dispatcher is a `switch`**, not an
if/else chain:

```
Step_0:777   if (scr_isphase("bullets") && attacked == 0)
Step_0:781       if (rtimer == 16)
Step_0:783           switch (rr)
Step_0:785               case 0:  ... dc.type = 0    ... scr_turntimer(300)
Step_0:793               case 1:  ... dc.type = 1    ... scr_turntimer(371)
Step_0:806               case 2:  ... dc.type = 2/2.1/2.2      scr_turntimer(400)
Step_0:829               case 3:  ... dc.type = 3/3.1/3.2/3.3/3.4
Step_0:853               case 4:  ... dc.type = 106/107/105
Step_0:874               case 5:  ... dc.type = 5    ... scr_turntimer(300)
Step_0:882               case 6:  ... dc.type = 6/6.1          scr_turntimer(300)
Step_0:894               case 7:  ... dc.type = 112/113/7/7.5  scr_turntimer(266)
Step_0:926               case 8:  ... dc.type = 100/101/102/114/115/116
Step_0:950               case 9:  ... dc.type = 110/111        scr_turntimer(300)
Step_0:966               case 10: ... dc.type = 8, special 5   scr_turntimer(300)
Step_0:975               default: ... dc.type = rr             scr_turntimer(300)
Step_0:986           turns += 1;
```

Every arm goes through the same object,
`dc = scr_bulletspawner(x, y, obj_queen_bulletcontroller);` — so an attack here
is exactly "(obj_queen_bulletcontroller, type)", the Knight/Spamton model.
All 15 `global.monsterattackname[myself] = "..."` announcements in the whole
chapter-2 dump that belong to this fight are inside this one switch; no helper
object announces anything, so `extraAttackFiles` is empty.

Two variables select: **`rr`** picks the case, **`difficulty`** picks the
sub-type inside it. Both are written by the same ladder arm, one line apart, so
they are really one selector — `(rr, difficulty)`.

---

## The chooser

`Step_0:720-731`, once per turn:

```gml
if (rtimer == 0 && attackdone == 0)
{
    attackdone = 1;

    if (attackdebug < 0)
        event_user(0);
    else
        rr = attackdebug;

    if (difficultydebug != 0)
        difficulty = difficultydebug;
```

`attackdebug = -1` and `difficultydebug = 0` in `Create_0:17-18`, and the only
writers are the debug mouse handlers (`Mouse_60`/`Mouse_61`, both guarded by
`scr_debug()`), so `event_user(0)` — i.e. `Other_10` — is authoritative.

**The two `rr = choose(0, 1, 2, 3)` rolls are vestigial.** `Step_0:324` picks
Queen's idle taunt during enemy-talk and `Step_0:989` picks the battle message
*after* the attack has already spawned; both are overwritten by `event_user(0)`
before they are ever read as an attack selector. Same trap as Spamton NEO's
`Step_0:924`.

### Other_10 in full

```gml
Other_10:1    turn++;
Other_10:2    phaseturn++;
Other_10:3    rr = 0;

Other_10:5    if (usewineattack == 1 && phase == 2)  { rr = 2; difficulty = 0; usewineattack = 0; phaseturn -= 1; }
Other_10:13   if (usewineattack == 1 && phase == 3)  { rr = 2; difficulty = 1; usewineattack = 0; phaseturn -= 1; }
Other_10:21   if (usewineattack == 1 && phase == 4)  { rr = 2; difficulty = (beatwine2nodamage == 1) ? 2 : 1; ... phaseturn -= 1; }
Other_10:39   if (usefinalattack == 1)               { rr = 1; difficulty = 0; usefinalattack = 2; phaseturn -= 1; }

Other_10:47   if ((phase == 1 && rr != 2 && rr != 1) || (phase == 2 && rr != 2 && rr != 1))   // ladder A
Other_10:134  if ((phase == 3 && rr != 2 && rr != 1) || (phase == 4 && rr != 2 && rr != 1))   // ladder B

Other_10:244  if (!instance_exists(obj_berdlyplug_enemy)) { if (rr == 7) rr = 5; }
```

**Ladder A — phases 1 and 2** (`Other_10:47-132`):

| phaseturn | rr | difficulty | attack |
|---|---|---|---|
| 1 | 7 | 0 | BerdlyTornado (type 112) |
| 2 | 3 | 0 | Stomp (type 3) |
| 3 | 6 | 0 | Explosion (type 6) |
| 4 | 8 | 0 | QueenLaser (type 100) |
| 5 | 4 | 0 | NewSocialMedia (type 106) |
| 6 | 9 | 0 | Plug (type 110) |
| 7 | 8 | 4 | QueenLaser + legs (type 115) |
| >7 | — | — | `phaseturn = 7;` then a pool, `var rand = irandom(120)` |

The pool at `Other_10:91-131` is a cascade of `if (rand >= K)` with no `else`,
so the **last** matching arm wins: `0-19 → 7 d0 · 20-39 → 3 d0 · 40-59 → 6 d0 ·
60-79 → 8 d0 · 80-99 → 4 d0 · 100-120 → 8 d4`. Note **rr 9 is not in this
pool** — in phases 1-2 the Plug attack only ever plays on the single turn where
`phaseturn == 6`.

**Ladder B — phases 3 and 4** (`Other_10:134-242`): arms 1-7 are byte-identical
to ladder A, then it continues and, crucially, **does not clamp**:

| phaseturn | rr | difficulty | attack |
|---|---|---|---|
| 8 | 4 | 1 | NewSocialMedia (type 107) |
| 9 | 7 | 1 | BerdlyTornado (type 113) |
| 10 | 6 | 1 | Explosion (type 6.1) |
| 11 | 9 | 1 | Plug (type 111) |
| 12 | 8 | 5 | QueenLaser + legs + heads (type 116) |
| >12 | — | — | pool, `var rand = irandom(100)` |

Pool B (`Other_10:208-241`), same last-wins cascade: `0-19 → 4 d1 · 20-39 →
7 d1 · 40-59 → 6 d1 · 60-79 → 9 d1 · 80-100 → 8 d5`.

`phaseturn` is **never reset on a phase change** — `Create_0:28` is its only
initialiser and `Other_12` (the phase gate) does not touch it. Ladder A clamps
it at 7, so a fight that spends 7+ turns in phases 1-2 enters phase 3 already at
`phaseturn == 7` and lands straight on ladder B's arm 8. A faster fight enters
phase 3 early and replays arms 1-7, which produce the same (rr, difficulty)
pairs — so the reachable set is the same either way.

---

## From chooser to roster

The chooser can produce `rr ∈ {1, 2, 3, 4, 6, 7, 8, 9}`. Everything below
follows from that.

### 16 real attacks

| # | rr | diff | type | name | turn | where the chooser produces it |
|---|---|---|---|---|---|---|
| 1 | 1 | 0 | 1 | QueenUltimate | 371 | `Other_10:39-45` |
| 2 | 2 | 0 | 2 | Wine | 400 | `Other_10:5-11` |
| 3 | 2 | 1 | 2.1 | Wine | 400 | `Other_10:13-19`, `:29-34` |
| 4 | 2 | 2 | 2.2 | Wine | 400 | `Other_10:21-28` |
| 5 | 3 | 0 | 3 | Stomp | 240 | `Other_10:55`, `:102`, `:142` |
| 6 | 4 | 0 | 106 | NewSocialMedia | 250 | `Other_10:73`, `:120`, `:160` |
| 7 | 4 | 1 | 107 | NewSocialMedia | 300 | `Other_10:178`, `:212` |
| 8 | 6 | 0 | 6 | Explosion | 300 | `Other_10:61`, `:108`, `:148` |
| 9 | 6 | 1 | 6.1 | Explosion | 300 | `Other_10:190`, `:224` |
| 10 | 7 | 0 | 112 | BerdlyTornado | 266 | `Other_10:49`, `:96`, `:136` |
| 11 | 7 | 1 | 113 | BerdlyTornado | 266 | `Other_10:184`, `:218` |
| 12 | 8 | 0 | 100 | QueenLaser | 245 | `Other_10:67`, `:114`, `:154` |
| 13 | 8 | 4 | 115 | QueenLaser | 245 | `Other_10:85`, `:126`, `:172` |
| 14 | 8 | 5 | 116 | QueenLaser | 245 | `Other_10:202`, `:236` |
| 15 | 9 | 0 | 110 | Plug | 300 | `Other_10:79`, `:166` |
| 16 | 9 | 1 | 111 | Plug | 300 | `Other_10:196`, `:230` |

The two event-driven turns:

* **Wine** — `usewineattack = 1` is written only by the phase gate,
  `Other_12:3` (1→2), `:15` (2→3), `:28` (3→4). So the Wine attack plays exactly
  three times per fight, at difficulty 0, 1, and then 1-or-2. Difficulty 2
  requires `beatwine2nodamage == 1`: the controller sets that flag when type 2.1
  starts (`ctrl:360`) and it is cleared the moment the player is hit by a wine
  droplet (`obj_queen_wine_attack_droplet_Other_15.gml:4`) or by the bottom
  hurtbox (`obj_queen_wine_attack_bottom_hurtbox_Other_15.gml:4`) — i.e. clear
  the phase-3 wine turn without taking a hit.
* **Ultimate** — `usefinalattack = 1` is written only at `Step_0:274-275`,
  inside the shield-break branch, gated on `phase == 4`. The shield only exists
  after a wine turn (`obj_queen_wineglass_Destroy_0.gml:4` →
  `obj_queenshield_intro_Step_0.gml:35`), and phase 4 is the last phase, so the
  shield can only be raised and broken once there → **exactly one Ultimate per
  fight**. That makes the `ultimateattackused == 1` half of `Step_0:798-802`
  (`scr_turntimer(311)`) and `variant = 1` in
  `obj_queen_ultimate_attack_controller_Create_0.gml:5-6` dead tuning: the real
  fight always gets 371 frames and variant 0.

### 14 cut dispatcher entries

**rr 0 — "ImageSearch" (type 0), `Step_0:785-791`.**
`rr = 0` is only the initial value at `Other_10:3`. Both ladders are guarded
only by `phase` and by `rr != 2 && rr != 1`, and `phase` is always 1-4
(`Create_0:29`, `Other_12:4/16/29`), so a ladder always runs unless the turn was
already claimed by Wine or the Ultimate. `phaseturn++` at `Other_10:2` runs
first, so `phaseturn >= 1` and some arm always matches. For `rr` to survive as
0, `phaseturn` would have to reach 0 or below inside a ladder, which needs two
`phaseturn -= 1` decrements to stack on one turn. They cannot: the wine
decrement and the final-attack decrement can only coincide if `usewineattack`
and `usefinalattack` are both 1, but `Other_12` (which sets `usewineattack`)
runs at `Step_0:243-247` and *resets `shieldhp` to 500 and `shieldacthp` to 8*
before the shield-break test at `Step_0:249-284` (which sets `usefinalattack`)
is reached, so the break test can never pass on a phase-transition turn.
**The search-window attack never plays.**

**rr 5 — "Bufferbullet" (type 5), `Step_0:874-880`.**
The only writer is `Other_10:244-248`:

```gml
if (!instance_exists(obj_berdlyplug_enemy))
{
    if (rr == 7)
        rr = 5;
}
```

`obj_berdlyplug_enemy` always exists during this fight:

* `obj_ch2_scene25_Step_0.gml:269-274` creates it unconditionally and then calls
  `scr_battle(59, 1, queen_marker, new_berdly, 0)` — and `scr_battle(59)` is the
  **only** entry point to the Queen encounter anywhere in ch2.
* Nothing destroys it mid-battle. The only `instance_destroy(obj_berdlyplug_enemy)`
  calls are in the post-battle branches of the same cutscene
  (`obj_ch2_scene25_Step_0.gml:367`, `:458`). `con = 1` (Throw ACT,
  `Step_0:1238`; BerdlyTornado, `ctrl:952`) only lerps it 200px off-screen.
* The `scr_sideb_get_phase() < 2` guard at `obj_queen_enemy_Create_0.gml:3` is
  redundant belt-and-braces — the cutscene already made the plug — and it can
  never matter, because `obj_ch2_scene25_Create_0.gml:7` destroys the entire
  scene (and with it this battle) once sideb phase reaches 3.

So the Berdly-less variant of the fight this branch was written for does not
exist in the shipped game, and `rr` never becomes 5.

**Difficulty-variant branches the ladders never pair with their rr.**
Each `rr` value carries a fixed, small set of difficulties. Anything the case
handles outside that set is dead:

| entry | needs | chooser only ever gives | evidence |
|---|---|---|---|
| type 3.1 | rr 3, d 1 | rr 3 → d 0 | `Other_10:57`, `:104`, `:144` |
| type 3.2 | rr 3, d 2 | rr 3 → d 0 | same |
| type 3.3 | rr 3, d 3 | rr 3 → d 0 | same (also the only arm that *lowers* the turn timer, to 190) |
| type 3.4 | rr 3, d 4 | rr 3 → d 0 | same |
| type 105 | rr 4, d 2 | rr 4 → d 0 or 1 | `Other_10:75/122/162`, `:180/214` |
| type 7 | rr 7, d 2 | rr 7 → d 0 or 1 | `Other_10:51/98/138`, `:186/220` |
| type 7.5 | rr 7, d 3 | rr 7 → d 0 or 1 | same |
| type 101 | rr 8, d 1 | rr 8 → d 0, 4 or 5 | `Other_10:69/116/156`, `:87/128/174`, `:204/238` |
| type 102 | rr 8, d 2 | rr 8 → d 0, 4 or 5 | same |
| type 114 | rr 8, d 3 | rr 8 → d 0, 4 or 5 | same |

Four of the five Stomp variants and three of the six Laser variants are cut.
**type 7.5 is doubly dead**: the controller has no `type == 7.5` branch at all
(its chain stops at `else if (type == 7)`, `ctrl:752`), so even if it were
dispatched it would fall through to the no-op `else if (init == 1) init = 2;`
at `ctrl:1136` and spawn nothing.

**rr 10 — "Birthday" (type 8, special 5), `Step_0:966-973`.** No `rr = 10`
exists anywhere. The complete set of `rr` writers is `Other_10:3, 7, 15, 25, 31,
41, 51, 57, 63, 69, 75, 81, 87, 98, 104, 110, 116, 122, 128, 138, 144, 150, 156,
162, 168, 174, 180, 186, 192, 198, 204, 214, 220, 226, 232, 238, 247` plus the
two vestigial dialogue rolls at `Step_0:324` and `Step_0:989`. None produce 10.

**`default:` — "Unknown" (type = rr), `Step_0:975-980.`** Cases 0-10 cover every
value the chooser can produce, so the fallback never runs.

### Controller branches with no dispatcher at all

Not switch arms, so not counted in the 30, but worth knowing before someone
tries to launch them:

* **type 4** (`ctrl:631-693`) — an `obj_queen_finger` scrolling social-media
  variant with `obj_queen_sm_deleter` and `obj_queen_pfp`. Nothing sets
  `dc.type = 4`; case 4 of the switch dispatches 106/107/105 instead. It is also
  the only branch that reads the controller's own `difficulty` field
  (`ctrl:646`), which Queen's dispatcher never assigns.
* **type 9** (`ctrl:27`) — appears only in the guard
  `if (type == 0 || type == 9 || type == 8)`. No `dc.type = 9` in ch2.
* **type 2.3** (`ctrl:445`) — appears only in the tilt guard inside the wine
  branch; the wine branch's own entry guard at `ctrl:345` does not even accept
  2.3, so it could not run if it were dispatched.
* **`special == 99`** (`ctrl:271-285`, spawns `obj_queen_search_window_bday`) —
  `special` is only ever written by the dispatcher at `Step_0:789`
  (`dc.special = difficulty`, cut rr 0) and `Step_0:970` (`dc.special = 5`, cut
  rr 10). Never 99.
* **the whole `bufferattack` sub-system.** `obj_queen_enemy_Create_0.gml:19` sets
  `bufferattack = false` and **nothing in ch2 ever writes it true** — the only
  other mentions are the nine `dc.bufferattack = bufferattack` reads in the
  switch. So `obj_queen_buffercontroller` is never created,
  `scr_queen_buffercheck()` is always false, and every `if (bufferattack)` path
  in the controller (`ctrl:29-46`, `:79-98`, `:308-318`, `:712-719`) is dead.
* **orphan objects.** A grep over the whole ch2 dump finds no `instance_create`
  for `obj_queen_search_flail`, `obj_queen_search_gun(_old)`,
  `obj_queen_search_flail_old`, `obj_queen_search_window_old`,
  `obj_queen_search_window_bday`, `obj_queen_search_image`,
  `obj_queen_search_bdog`, `obj_queen_search_junk`, `obj_queen_search_laser`,
  `obj_queen_solitaire`, `obj_queenshield_enemy_old`, or
  `obj_queenshield_enemy_old2` outside their own events. Earlier drafts of the
  search attack and the shield.

---

## Phases and gates

`gml_Object_obj_queen_enemy_Other_12.gml` (= `event_user(2)`), called from
`Step_0:243-247` at the top of the enemy-talk step:

| → phase | trigger | effects |
|---|---|---|
| 2 | `bardlymercy >= 25` **or** `hp < 75%` (`Other_12:1`) | `usewineattack = 1`, shieldhp 400, shieldacthp 6, shieldsize 7, targetmercy 50 |
| 3 | `bardlymercy >= 50` **or** `hp < 50%` (`Other_12:13`) | `usewineattack = 1`, shieldhp 500, shieldacthp 8, shieldsize 10, targetmercy 75 |
| 4 | `bardlymercy >= 75` **or** `hp < 25%` (`Other_12:26`) | `usewineattack = 1`, shieldhp 500, shieldacthp 8, shieldsize 12, targetmercy 100 |

Queen is monstertype 48: HP 1510, AT 10, mercymax 100
(`gml_GlobalScript_scr_monstersetup.gml:1345-1394`).

The **acid shield** (`obj_queenshield_enemy`) is not an attacker — it has no
`monsterattackname` and no Step event. It is created by `obj_queenshield_intro`
when `obj_queen_wineglass` is destroyed at the end of a wine turn
(`obj_queen_wineglass_Destroy_0.gml:4`). While it exists, `Other_11` swaps the
ACT menu from Loosen/GroupLoosen (Berdly mercy) to Toast/GroupToast, which drain
`shieldacthp` via `shield_damage_buffer` (`Step_0:1465`). When it breaks in
phase 4 → `usefinalattack = 1` → the Ultimate next turn.

`obj_berdlyplug_enemy` is a permanent second on-field object: the mercy target,
the thing BerdlyTornado grabs (`ctrl:952`), and the target of the **Throw** ACT
(`obj_queen_throw_controller`, an aiming minigame spawned at `Step_0:1239`).

---

## Battle box

`Step_0:732-762` is the `boxBlock` slice — anchor
`if (!instance_exists(obj_growtangle))` (unique in the file), **no endAnchor**,
sliced by the generator's `ifStatementEnd` so it comes out brace-balanced at
line 762:

```gml
if (!instance_exists(obj_growtangle))
{
    if (rr == 1)          instance_create(XView + 320, YView + 200, obj_growtangle);
    else if (rr == 5)     instance_create(XView + 320, YView + 237, obj_growtangle);
    else if (rr == 7)   { instance_create(XView + 320, YView + 200, obj_growtangle);
                          obj_growtangle.maxxscale = 2; obj_growtangle.maxyscale = 1.5; }
    else if (rr == 9)   { instance_create(XView + 320, YView + 200, obj_growtangle);
                          if (difficulty == 1) { maxxscale = 1.5; maxyscale = 2; } }
    else                  instance_create(XView + 320, YView + 170, obj_growtangle);
}

if (rr == 2)
{
    obj_growtangle.sprite_index = spr_nothing;
    obj_growtangle.visible = false;
}
```

`obj_growtangle_Create_0.gml:13-14` defaults `maxxscale = maxyscale = 2`, so
every attack except rr 7 and rr 9-at-difficulty-1 gets the square 2× box; only
the vertical offset changes (170 normally, 200 for the Ultimate/Tornado/Plug,
237 for the cut Bufferbullet).

The `if (rr == 2)` hide at `Step_0:764-768` is **not** part of the slice and has
to be applied as a studio special case for types 2 / 2.1 / 2.2. It cannot be
picked up by extending `endAnchor` to the `scr_moveheart` line, because
`Step_0:769` is the closing brace of the enclosing
`if (rtimer == 0 && attackdone == 0)` block — a slice to `Step_0:771` carries a
stray `}`. Its own `if (rr == 2)` line is not unique either (3 occurrences;
`Step_0:332` and `:997` are dialogue rolls). The unique hook is
`obj_growtangle.sprite_index = spr_nothing;`.

Just past the slice sits

```gml
Step_0:771  if (!instance_exists(obj_moveheart) && !instance_exists(obj_heart) && rr != 2)
Step_0:772      scr_moveheart();
```

— the studio keeps control of the soul here, and the `rr != 2` exclusion is
documented rather than replayed. During Wine the boss does **not** move the
heart; the controller does it itself once Queen has thrown the glass
(`ctrl:371-382`).

---

## Turn length — there is no turn block

Unlike every other boss in the studio, **Queen has no separate turn-length
ladder**. Every `scr_turntimer` call lives inside its own `case`, interleaved
with the `scr_bulletspawner` call:

```gml
case 6:
    global.monsterattackname[myself] = "Explosion";
    dc = scr_bulletspawner(x, y, obj_queen_bulletcontroller);
    dc.type = 6;
    dc.bufferattack = bufferattack;

    if (difficulty == 1)
        dc.type = 6.1;

    scr_turntimer(300);
    break;
```

There is no slice that sets the turn length without also spawning a second
controller — the exact trap `gen_attacks.js` documents for the Knight. So
`turnBlock` is **null** in `queen.json` and the lengths are supplied as a
`turnByChoice` table instead:

| rr | turn | notes |
|---|---|---|
| 0 | 300 | cut |
| 1 | 371 | 311 if `ultimateattackused == 1` — unreachable, see above |
| 2 | 400 | all three difficulties |
| 3 | 240 | 190 at difficulty 3 (cut) |
| 4 | 250 | 300 at difficulty 1 and 2 |
| 5 | 300 | cut |
| 6 | 300 | |
| 7 | 266 | all difficulties |
| 8 | 245 | all difficulties |
| 9 | 300 | |
| 10 | 300 | cut |
| default | 300 | cut |

`Step_0:1013-1016` adds a floor: while `rtimer < 16` the boss calls
`scr_turntimer(120)` every frame. Since `scr_turntimer` only raises
(`if (global.turntimer < arg0) global.turntimer = arg0`) and every real value is
above 120, the floor never overrides a case value — but it does mean the turn
timer is already at 120 when the attack spawns.

If the studio falls back to its own floor here, Wine (400) and the Ultimate
(371) both get cut off less than a third of the way through.

As a belt-and-braces alternative, `queen.json` also carries a `dispatchBlock`
(anchor `switch (rr)`, endAnchor `turns += 1;`, = `Step_0:783-985`): the whole
switch, which self-selects on `rr`/`difficulty` and carries every
`scr_turntimer`. It spawns its own controller, so it must be replayed
**instead of**, never in addition to, a manual spawn.

---

## What the studio will need to special-case

1. **Switch-aware slicing.** `attackAnnouncements()` in `gen_attacks.js` assumes
   if/else dispatch. On a `switch`:
   * the backward walk to the enclosing `{` lands on the switch's own brace, so
     `setup` is the whole switch (>3500 chars → nulled) or every preceding case;
   * the `<var> == N)` back-scan for the branch value finds
     `if (rtimer == 16)` and stamps **selector `rtimer`, choice 16** on every
     Queen attack;
   * the forward window runs past `break` into later cases, so `extraFields`
     over-collects `bufferattack` / `damage` / `target`.

   It needs a case-label-to-next-case-label slicer, or hand-authored per-attack
   setups from the line ranges in the table at the top of this file.

2. **Wine cannot be launched by spawning the controller.** Types 2 / 2.1 / 2.2
   set `init = 2` and then do nothing forever. The sequence is driven by the
   BOSS: `Step_0:809-813` sets `wineglasscon = 1`, `Step_0:96-165` runs
   `wineglasscon` 1 → 2 → 3 (create the glass, hold, hurl it to the box centre),
   and only at `Step_0:156-157` does

   ```gml
   with (obj_queen_bulletcontroller)
       init = 3;
   ```

   hand control back. `obj_queen_enemy` must exist and be stepping.

3. **Hard dereferences with no `instance_exists` guard** — these will throw:
   * `ctrl:952` (`obj_berdlyplug_enemy.con = 1;`) for types 112/113, and
     `ctrl:756` for cut type 7;
   * `ctrl:340` (`instance_create(obj_heart.x, obj_heart.y, obj_hiddenheart)`)
     for type 1;
   * the 0/8/9 branch reads `obj_growtangle.x` directly from `ctrl:83` onward;
   * `obj_growtangle_electric_Create_0.gml:7-16` self-destructs without
     `obj_growtangle` (types 110/111).

4. **Difficulty is boss-side.** Queen's dispatcher never writes `dc.difficulty`;
   the controller's own `difficulty` defaults to 1
   (`gml_Object_obj_queen_bulletcontroller_Create_0.gml:23`) and is read
   only by cut type 4. The studio's DIFF selector must drive
   `obj_queen_enemy.difficulty` (or simply pick the type directly) — wiring it
   to `obj_queen_bulletcontroller.difficulty` changes nothing.

5. **Controller lifecycle.** `ctrl:1-22` calls
   `scr_monsterattacknamecount(global.monsterattackname[creator])`, so `creator`
   must be a valid monster slot — `scr_bulletspawner` sets it, a bare
   `instance_create` does not. `obj_queen_bulletcontroller_Destroy_0.gml` does
   `with (obj_queenshield_enemy) appearcon = 1;` and stops `snd_crowd`.

6. **Sound.** Types 105/106/107 start `snd_loop(snd_crowd)` at `ctrl:892-897`
   and rely on the Destroy event to stop it; relaunching without destroying the
   old controller leaves the crowd loop running.

7. **Red soul throughout.** No green/blue/purple mode anywhere in this fight —
   the only soul trick is the Wine turn's invisible box plus the controller's
   own `obj_heartmarker` + `scr_moveheart`, and the Ultimate's `obj_hiddenheart`
   overlay while the heroes and Queen fade out.
