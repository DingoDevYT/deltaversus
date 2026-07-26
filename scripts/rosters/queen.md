# Queen (ch2) — `obj_queen_enemy`, chooser in `Other_10`

**16 of the 30 dispatcher entries appear in the real fight. 14 are cut.**
(Plus 3 controller branches — types 4, 9, 2.3 — and the whole `bufferattack`
sub-system, which no dispatcher arm can reach at all.)

This is Queen's FIRST fight (encounter 59, `scr_encountersetup.gml:585-603`).
`obj_gigaqueen_enemy` is a different fight with its own dispatcher and is not
covered here. `obj_queenshield_enemy_old` / `_old2` are cut duplicates of the
acid shield (see the cut-objects section).

---

## Objects

| object | role | evidence |
|---|---|---|
| `obj_queen_enemy` | the boss. Owns the chooser, the dispatcher, the box block, the phase machine, and the whole ACT tree. | `objects.tsv`; `gml_Object_obj_queen_enemy_Step_0.gml` (2009 lines) |
| `obj_queen_bulletcontroller` | the ONLY attack controller. Every one of the 30 dispatcher entries spawns this and sets `.type`. | `Step_0:787, 795, 816, 831, 855, 876, 884, 898, 905, 912, 919, 928, 952, 968, 977` — all `scr_bulletspawner(x, y, obj_queen_bulletcontroller)` |
| `obj_queenshield_enemy` | the acid shield. No Step event — it is a Draw + ACT object. Gates the ACT menu and arms the Ultimate when it breaks in phase 4. | `Create_0` / `Draw_0` / `Other_10..12` only |
| `obj_berdlyplug_enemy` | permanent second on-field object (Berdly wired into the ceiling). Mercy target; moved by BerdlyTornado and by the Throw ACT. | `obj_ch2_scene25_Step_0.gml:269`; `obj_queen_enemy_Create_0.gml:3-4` |
| `obj_queen_throw_controller` | ACT-driven aiming minigame, NOT an attack. | `Step_0:1236-1241` |

Queen is `monstertype 48`: HP/maxHP **1510**, AT **10**, DF 0, mercymax 100
(`scr_monstersetup.gml:1345-1394`).

---

## The chooser — `Other_10` (event_user(0)), 248 lines

Called once per turn from the boss's own Step:

```gml
// gml_Object_obj_queen_enemy_Step_0.gml:720-731
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

`attackdebug = -1` and `difficultydebug = 0` in Create (`Create_0.gml:17-18`),
and only the debug keypress handler touches them, so **`Other_10` is
authoritative for both `rr` and `difficulty`**. Queen never randomises
difficulty independently — every arm writes the pair together.

`Other_10` opens by clearing the selector:

```gml
// Other_10.gml:1-3
turn++;
phaseturn++;
rr = 0;
```

### 1. Forced-turn overrides (`Other_10:5-45`)

```gml
if (usewineattack == 1 && phase == 2) { rr = 2; difficulty = 0; usewineattack = 0; phaseturn -= 1; }   // :5-11
if (usewineattack == 1 && phase == 3) { rr = 2; difficulty = 1; usewineattack = 0; phaseturn -= 1; }   // :13-19
if (usewineattack == 1 && phase == 4)                                                                  // :21-37
{
    if (beatwine2nodamage == 1) { rr = 2; difficulty = 2; usewineattack = 0; }
    else                        { rr = 2; difficulty = 1; usewineattack = 0; }
    phaseturn -= 1;
}
if (usefinalattack == 1) { rr = 1; difficulty = 0; usefinalattack = 2; phaseturn -= 1; }               // :39-45
```

`usewineattack` is armed by the phase gate (`Other_12.gml:3, 15, 28`),
`usefinalattack` by the shield breaking in phase 4 (`Step_0:274-275`).
Both forced turns **decrement `phaseturn`**, so they do not consume a ladder slot.

### 2. Phase 1-2 ladder + pool (`Other_10:47-132`)

Guard: `if ((phase == 1 && rr != 2 && rr != 1) || (phase == 2 && rr != 2 && rr != 1))`
— i.e. skipped entirely on wine/ultimate turns.

| `phaseturn` | line | `rr` | `difficulty` | attack |
|---|---|---|---|---|
| 1 | :49-53 | 7 | 0 | BerdlyTornado (112) |
| 2 | :55-59 | 3 | 0 | Stomp (3) |
| 3 | :61-65 | 6 | 0 | Explosion (6) |
| 4 | :67-71 | 8 | 0 | QueenLaser (100) |
| 5 | :73-77 | 4 | 0 | NewSocialMedia (106) |
| 6 | :79-83 | 9 | 0 | Plug (110) |
| 7 | :85-89 | 8 | 4 | QueenLaser + legs (115) |

```gml
// Other_10.gml:91-131 — the pool, entered from turn 8 onward
if (phaseturn > 7)
{
    phaseturn = 7;                 // clamp: stays in the pool forever
    var rand = irandom(120);
    if (rand >= 0)   { rr = 7; difficulty = 0; }
    if (rand >= 20)  { rr = 3; difficulty = 0; }
    if (rand >= 40)  { rr = 6; difficulty = 0; }
    if (rand >= 60)  { rr = 8; difficulty = 0; }
    if (rand >= 80)  { rr = 4; difficulty = 0; }
    if (rand >= 100) { rr = 8; difficulty = 4; }
}
```

The cascade of un-elsed `if`s means the LAST matching arm wins, so the real
distribution is `rand 0-19 → 7d0 · 20-39 → 3d0 · 40-59 → 6d0 · 60-79 → 8d0 ·
80-99 → 4d0 · 100-120 → 8d4`. **`rr 9` (Plug) is absent from this pool**, so in
phases 1-2 Plug plays on exactly one turn — `phaseturn == 6` — and never again.

### 3. Phase 3-4 ladder + pool (`Other_10:134-242`)

Same guard shape. Arms 1-7 are identical to phases 1-2, then five more:

| `phaseturn` | line | `rr` | `difficulty` | attack |
|---|---|---|---|---|
| 1-7 | :136-176 | *(same as phases 1-2)* | | |
| 8 | :178-182 | 4 | 1 | NewSocialMedia hard (107) |
| 9 | :184-188 | 7 | 1 | BerdlyTornado hard (113) |
| 10 | :190-194 | 6 | 1 | Explosion slow (6.1) |
| 11 | :196-200 | 9 | 1 | Plug hard (111) |
| 12 | :202-206 | 8 | 5 | QueenLaser + legs + heads (116) |

```gml
// Other_10.gml:208-241
if (phaseturn > 12)
{
    var rand = irandom(100);
    if (rand >= 0)  { rr = 4; difficulty = 1; }
    if (rand >= 20) { rr = 7; difficulty = 1; }
    if (rand >= 40) { rr = 6; difficulty = 1; }
    if (rand >= 60) { rr = 9; difficulty = 1; }
    if (rand >= 80) { rr = 8; difficulty = 5; }
}
```

Note there is **no clamp here** — `phaseturn` keeps climbing, which is harmless
because every value > 12 lands in the pool. Also note the pool contains **only
difficulty-1/5 variants**: `rr 3` (Stomp) and `rr 8 d0/d4` are reachable in
phases 3-4 only via ladder slots 2, 4 and 7.

### 4. The berdlyplug fallback (`Other_10:244-248`)

```gml
if (!instance_exists(obj_berdlyplug_enemy))
{
    if (rr == 7)
        rr = 5;
}
```

This is the **only** writer of `rr = 5`. It never fires — see the cut list.

### `phaseturn` is never reset

`Create_0.gml:28` (`phaseturn = 0;`) is its **only** initialiser. Nothing in
`Other_12` (the phase gate) touches it. Consequences:

* A player who blasts through phases 1-2 quickly enters phase 3 with a low
  `phaseturn` and replays the early ladder at difficulty 0.
* A player who grinds phases 1-2 hits the clamp (`phaseturn = 7`) and enters
  phase 3 already at 7, so the very next turn is `phaseturn 8 → rr 4 d1` — the
  phase-3/4 ladder's slots 1-7 are skipped entirely.

### Vestigial `rr` writes

Two `rr = choose(0, 1, 2, 3)` rolls exist in the boss Step and are **not**
attack selectors:

* `Step_0:324` picks Queen's pre-attack taunt (`"(Regal Laughter)"`, `"I'm
  Computer"`, …). Overwritten by `rr = 0` at `Other_10.gml:3` before the
  dispatcher reads it.
* `Step_0:989` picks the battle message and runs **after** the switch.

Same shape as the Spamton NEO vestigial roll already documented in
`REAL_FIGHT_ROSTERS.md`.

---

## The dispatcher — a `switch`, not an if/else chain

```gml
// gml_Object_obj_queen_enemy_Step_0.gml:777-783
if (scr_isphase("bullets") && attacked == 0)
{
    rtimer += 1;

    if (rtimer == 16)
    {
        switch (rr)
        {
```

Queen is the **first supported boss whose dispatcher is a `switch`**. All 30
outcomes live in cases 0-10 plus `default`, and every `scr_turntimer` call is
inside its case. Full map (`Step_0:783-981`):

| case | lines | difficulty | `dc.type` | name | turn |
|---|---|---|---|---|---|
| 0 | 785-791 | *(→ `dc.special`)* | 0 | ImageSearch | 300 |
| 1 | 793-804 | — | 1 | QueenUltimate | 371 |
| 2 | 806-827 | 0 / 1 / 2 | 2 / 2.1 / 2.2 | Wine | 400 |
| 3 | 829-851 | 0 / 1 / 2 / 3 / 4 | 3 / 3.1 / 3.2 / 3.3 / 3.4 | Stomp | 240 |
| 4 | 853-872 | 0 / 1 / 2 | 106 / 107 / 105 | NewSocialMedia | 250 / 300 / 300 |
| 5 | 874-880 | — | 5 | Bufferbullet | 300 |
| 6 | 882-892 | 0 / 1 | 6 / 6.1 | Explosion | 300 |
| 7 | 894-924 | 0 / 1 / 2 / 3 | 112 / 113 / 7 / 7.5 | BerdlyTornado ×2, BerdlyFeather ×2 | 266 |
| 8 | 926-948 | 0 / 1 / 2 / 3 / 4 / 5 | 100 / 101 / 102 / 114 / 115 / 116 | QueenLaser | 245 |
| 9 | 950-964 | 0 / 1 | 110 / 111 | Plug | 300 |
| 10 | 966-973 | — | 8 (`special = 5`) | Birthday | 300 |
| default | 975-980 | — | `rr` | Unknown | 300 |

### Two turn-length traps

`scr_turntimer` only RAISES:

```gml
// gml_GlobalScript_scr_turntimer.gml
function scr_turntimer(arg0) { if (global.turntimer < arg0) global.turntimer = arg0; }
```

1. **Case 3 difficulty 3 does NOT get 190.** `Step_0:834` calls
   `scr_turntimer(240)` unconditionally *before* the difficulty checks, so the
   `scr_turntimer(190)` at `Step_0:845` is a no-op. Type 3.3 would run at 240.
   (Cut anyway, but the `turnByChoice` table must not carry 190.)
2. **Case 1 never gets 311.** `Step_0:798-802` picks 371 when
   `ultimateattackused == 0` and 311 when it is 1, but the flag is only set to 1
   *inside* `obj_queen_ultimate_attack_controller_Create_0.gml:8`, which runs
   after the dispatcher. Since the Ultimate can fire at most once per fight
   (below), 311 — and the `variant = 1` alternate ultimate at
   `..._Create_0.gml:5-6` — are both dead.

`global.turntimer` decrements to 0 every turn
(`obj_battlecontroller_Step_0.gml:1075-1077`), so the raise-only rule applies
per turn from a clean 0. The `else { scr_turntimer(120); }` at `Step_0:1015`
runs on frames `rtimer 1..15` and is a floor only.

---

## The box block — `Step_0:732-762`

```gml
if (!instance_exists(obj_growtangle))
{
    if (rr == 1)      { instance_create(viewX + 320, viewY + 200, obj_growtangle); }
    else if (rr == 5) { instance_create(viewX + 320, viewY + 237, obj_growtangle); }
    else if (rr == 7) { instance_create(viewX + 320, viewY + 200, obj_growtangle);
                        obj_growtangle.maxxscale = 2; obj_growtangle.maxyscale = 1.5; }
    else if (rr == 9) { instance_create(viewX + 320, viewY + 200, obj_growtangle);
                        if (difficulty == 1) { obj_growtangle.maxxscale = 1.5;
                                               obj_growtangle.maxyscale = 2; } }
    else              { instance_create(viewX + 320, viewY + 170, obj_growtangle); }
}
```

(`__view_get(e__VW.XView, 0)` abbreviated.) Defaults are
`maxxscale = maxyscale = 2` (`obj_growtangle_Create_0.gml:13-14`).

Anchor `if (!instance_exists(obj_growtangle))` is **unique** in the file
(`grep -cF` = 1) and `ifStatementEnd` closes the slice cleanly at line 762.

**Two traps recorded so nobody re-derives them:**

* Do **not** widen the slice to reach the wine hide at 764-768. `Step_0:769` is
  the closing brace of the enclosing `if (rtimer == 0 && attackdone == 0)`, so
  any slice ending at 770 carries a stray `}`.
* Do **not** move the anchor up to `if (rtimer == 0 && attackdone == 0)`
  (`Step_0:720`). That block calls `event_user(0)` — the chooser — and would
  re-roll the attack out from under the studio. Identical to the Knight trap in
  `REAL_FIGHT_ROSTERS.md`.

### The wine hide is a separate statement

```gml
// Step_0:764-768 — applies to types 2 / 2.1 / 2.2 only
if (rr == 2)
{
    obj_growtangle.sprite_index = spr_nothing;
    obj_growtangle.visible = false;
}
```

Its own `if (rr == 2)` line is **not** unique (3 hits — `Step_0:332` and `:997`
are dialogue), so it cannot be grepped as an anchor. It is carried in
`queen.json` as a literal `source` string instead. The only unique substring
inside it is `obj_growtangle.sprite_index = spr_nothing;` (`Step_0:766`).

The wine turn also suppresses the boss's own soul placement:

```gml
// Step_0:771-772
if (!instance_exists(obj_moveheart) && !instance_exists(obj_heart) && rr != 2)
    scr_moveheart();
```

---

## The turn block — there isn't one

Every `scr_turntimer` call is interleaved with a `scr_bulletspawner` call inside
its own `case`. There is no contiguous slice that sets turn length without also
spawning a controller — the exact double-spawn trap already recorded for the
Knight. `queen.json` therefore has `"turnBlock": null` and offers two
alternatives:

* `dispatchBlock` — replay the whole switch (`switch (rr)` → `turns += 1;`, both
  strings verified unique) **instead of** spawning a controller manually. It
  self-selects on the boss's `rr` + `difficulty` and carries the turn timer.
* `turnByChoice` — the hand-derived table, with the two traps above applied.

Without one of them, Wine (400) and the Ultimate (371) get chopped to the
studio's 90/120 floor.

---

## The real roster — 16 entries

| `rr` | `diff` | type | name | turn | first reachable at |
|---|---|---|---|---|---|
| 1 | 0 | 1 | QueenUltimate | 371 | `Other_10:39-45` (shield breaks in phase 4) |
| 2 | 0 | 2 | Wine | 400 | `Other_10:5-11` (phase 1→2) |
| 2 | 1 | 2.1 | Wine (tilting glass) | 400 | `Other_10:13-19`, `:29-34` (phase 2→3, phase 4 hit) |
| 2 | 2 | 2.2 | Wine (fast tilt) | 400 | `Other_10:21-28` (phase 4, no-hit clear of the 2.1 wine) |
| 3 | 0 | 3 | Stomp | 240 | `Other_10:55-59`, `:102-106`, `:142-146` |
| 4 | 0 | 106 | NewSocialMedia | 250 | `Other_10:73-77`, `:120-124`, `:160-164` |
| 4 | 1 | 107 | NewSocialMedia (hard) | 300 | `Other_10:178-182`, `:212-216` |
| 6 | 0 | 6 | Explosion | 300 | `Other_10:61-65`, `:108-112`, `:148-152` |
| 6 | 1 | 6.1 | Explosion (slow cadence) | 300 | `Other_10:190-194`, `:224-228` |
| 7 | 0 | 112 | BerdlyTornado | 266 | `Other_10:49-53`, `:96-100`, `:136-140` |
| 7 | 1 | 113 | BerdlyTornado (hard) | 266 | `Other_10:184-188`, `:218-222` |
| 8 | 0 | 100 | QueenLaser | 245 | `Other_10:67-71`, `:114-118`, `:154-158` |
| 8 | 4 | 115 | QueenLaser + legs | 245 | `Other_10:85-89`, `:126-130`, `:172-176` |
| 8 | 5 | 116 | QueenLaser + legs + heads | 245 | `Other_10:202-206`, `:236-240` |
| 9 | 0 | 110 | Plug | 300 | `Other_10:79-83`, `:166-170` |
| 9 | 1 | 111 | Plug (hard) | 300 | `Other_10:196-200`, `:230-234` |

Controller branches, for reference:
type 1 → `:335-344` · type 2/2.1/2.2 → `:345-464` · type 3 → `:467-527` ·
type 6/6.1 → `:705-751` · type 100 → `:761-785` · type 105/106/107 → `:880-933` ·
type 110/111 → `:934-947` · type 112/113 → `:948-960` · type 115 → `:1017-1068` ·
type 116 → `:1069-1135` (all `obj_queen_bulletcontroller_Step_0.gml`).

---

## The cut list — 14 entries

### `rr 0` → type 0 **ImageSearch** (`Step_0:785-791`)

`rr = 0` exists only as the initial value at `Other_10.gml:3`. No ladder arm and
no pool arm assigns 0. The induction:

* `phase` is always 1..4 (`Create_0.gml:29`, plus `Other_12.gml:4/16/29`), so
  whenever `rr` is still 0 at line 47 or line 134, one of the two ladders runs.
* Every ladder arm is `if (phaseturn == N)` for N ≥ 1, plus a `phaseturn > 7`
  (or `> 12`) pool. So the ladders overwrite `rr` for any `phaseturn ≥ 1`.
* `phaseturn` is incremented at `Other_10.gml:2` before anything else, and is
  decremented **only** inside the four forced-turn blocks at `:10, :18, :36,
  :44` — each of which has already set `rr` to 2 or 1, and each of which
  therefore fails the `rr != 2 && rr != 1` ladder guard on that same turn.
* So on any turn where the ladder actually runs, `rr` was 0 and no decrement has
  fired, hence `phaseturn ≥ 1` and some arm matches.

The one worry is the double-decrement turn: if a phase-4 gate and a phase-4
shield break land in the same step (`Step_0:243-247` runs `event_user(2)`
immediately before the shield check at `:249`), the next `Other_10` fires both
the wine block and the ultimate block, netting `phaseturn - 1`. That turn still
sets `rr = 1`, and `usefinalattack` becomes 2 permanently, so it can happen at
most once and can never leave `rr == 0`.

### `rr 3` difficulties 1-4 → types **3.1 / 3.2 / 3.3 / 3.4** (`Step_0:836-849`)

Every `rr = 3` write in the chooser (`Other_10.gml:57`, `:104`, `:144`) is
immediately followed by `difficulty = 0`, and nothing else assigns `rr` 3. So
only the base type 3 can be produced. Controller branches `:528-538`, `:539-571`,
`:572-605`, `:606-630` are dead. (Type 3.3's `scr_turntimer(190)` is doubly dead
— see the turn traps above.)

### `rr 4` difficulty 2 → type **105** NewSocialMedia (wide) (`Step_0:866-870`)

The chooser pairs `rr 4` with difficulty 0 (`Other_10.gml:75`, `:122`, `:162`) or
1 (`:180`, `:214`) — never 2. The controller's guard is
`type == 105 || type == 106 || type == 107` (`:880`), so 105 is "neither
override".

### `rr 5` → type 5 **Bufferbullet** (`Step_0:874-880`)

The single writer is the berdlyplug fallback (`Other_10.gml:244-248`). The plug
always exists:

```gml
// gml_Object_obj_ch2_scene25_Step_0.gml:269-274
var new_berdly = instance_create(berdly_wire.x, berdly_wire.y, obj_berdlyplug_enemy);
global.flag[9] = 2;
global.batmusic[0] = snd_init("queen_boss.ogg");
encounterflag = 548;
global.flag[54] = encounterflag;
scr_battle(59, 1, queen_marker, new_berdly, 0);
```

Encounter 59 (`scr_encountersetup.gml:585-603`) is the only entry point to this
fight, and the cutscene creates the plug unconditionally on the line before it.
Nothing destroys it during battle — the only `instance_destroy(obj_berdlyplug_enemy)`
calls are in the post-battle cutscene (`obj_ch2_scene25_Step_0.gml:367` and
`:458`). `obj_queen_enemy_Create_0.gml:3-4` adds a redundant belt-and-braces
create; its `scr_sideb_get_phase() < 2` guard is moot because
`obj_ch2_scene25_Create_0.gml:7-10` destroys the whole scene once sideb phase
≥ 3. **So `rr` never becomes 5**, and the controller's obj_queen_spadeblow
branch (`:694-704`) is dead.

### `rr 7` difficulties 2 and 3 → types **7** and **7.5** BerdlyFeather (`Step_0:909-921`)

The chooser pairs `rr 7` only with difficulty 0 (`Other_10.gml:51`, `:98`, `:138`)
or 1 (`:186`, `:220`). Type 7.5 is **doubly** dead: the controller has no
`type == 7.5` branch at all — the chain reaches `else if (type == 7)` at
`obj_queen_bulletcontroller_Step_0.gml:752` and never tests 7.5, so a 7.5
controller falls through to the no-op `else if (init == 1) init = 2;` at
`:1136-1138` and spawns nothing.

### `rr 8` difficulties 1, 2, 3 → types **101 / 102 / 114** (`Step_0:932-939`)

The chooser pairs `rr 8` with difficulty 0 (`Other_10.gml:69`, `:116`, `:156`),
4 (`:87`, `:128`, `:174`) or 5 (`:204`, `:238`). Never 1, 2 or 3. Controller
branches `:786-879` (101/102) and `:961-1016` (114) are dead.

### `rr 10` → type 8 **Birthday** (`Step_0:966-973`)

No `rr = 10` exists anywhere. The complete list of `rr` writers in the fight is
`Other_10.gml:3, 7, 15, 25, 31, 41, 51, 57, 63, 69, 75, 81, 87, 98, 104, 110,
116, 122, 128, 138, 144, 150, 156, 162, 168, 174, 180, 186, 192, 198, 204, 214,
220, 226, 232, 238, 247`, plus the two vestigial dialogue rolls at `Step_0:324`
and `:989`. None produces 10.

### `default` → `dc.type = rr` **Unknown** (`Step_0:975-980`)

Cases 0-10 cover every integer the chooser can produce, and 0 / 5 / 10 are
themselves unreachable.

---

## Cut controller branches (no dispatcher arm reaches them)

| branch | lines | why |
|---|---|---|
| `type == 4` | `:631-693` | The `obj_queen_finger` scroll attack. Case 4 produces 105/106/107, never 4. It is also the only branch reading the CONTROLLER's own `difficulty` (`:646`), which Queen's dispatcher never assigns — it stays at the Create default 1 (`Create_0.gml:23`). |
| `type == 9` | guard only, `:27` | No `dc.type = 9` anywhere in ch2. |
| `type == 2.3` | guard only, `:445` | Never assigned; and the wine branch guard at `:345` does not accept 2.3, so `:445` could never be entered with it. |
| `special == 99` | `:271-285` | Spawns `obj_queen_search_window_bday`. `special` is only assigned at `Step_0:789` (`= difficulty`, cut rr 0) and `Step_0:970` (`= 5`, cut rr 10). |
| the whole `bufferattack` system | `:29-46`, `:79-98`, `:308-318`, `:712-719` | `obj_queen_enemy_Create_0.gml:19` sets `bufferattack = false` and **nothing in chapter 2 ever writes it true** — the only other writes are Create defaults (`obj_queen_bulletcontroller_Create_0.gml:39`, `obj_queen_explodinghead_intro_Create_0.gml:12`); every other mention is a read or a `dc.bufferattack = bufferattack` pass-through (`Step_0:818/833/857/878/886/930/953/971/979`). So `obj_queen_buffercontroller` is never created and `scr_queen_buffercheck()` is always false. |

### Cut support objects

`obj_queen_search_flail`, `obj_queen_search_gun`, `obj_queen_search_junk` are
spawned by `obj_queen_search_window_Draw_0.gml:82 / :92 / :102`, gated on
`search == 1 / 2 / 3` (`:80-105`). Every `d.search = 1|2|3` write lives in the
cut ImageSearch branch (`obj_queen_bulletcontroller_Step_0.gml:247, 249, 261,
263, 276, 294, 309`) or the cut type-114 branch (`:1012`). Also cut:
`obj_queen_search_window_bday` (only at `:273` under the never-assigned
`special == 99`), `obj_queen_search_image`, `obj_queen_search_bdog`,
`obj_queen_solitaire` (zero external references in ch2), and the `_old` family
(`obj_queen_search_gun_old`, `obj_queen_search_flail_old`,
`obj_queen_search_window_old`, `obj_queen_search_laser`,
`obj_queenshield_enemy_old`, `obj_queenshield_enemy_old2`).

**Counterexample worth writing down:** `obj_queen_search_window` *itself* is
**live**. `obj_queen_lasergun_Create_0.gml:16-20` creates one with `search = 99`
and `donttypeanything = 1` as the window chrome around every laser gun, so it
appears in real types 100 / 115 / 116. With `search = 99` it takes the
`else { state = 5; }` path (`Draw_0.gml:106-109`) and spawns no sub-bullets.

---

## Phases, gates and the two special turns

Phase gate — `Other_12` (event_user(2)), called from `Step_0:243-247`:

| → phase | gate (`Other_12`) | effect |
|---|---|---|
| 2 | `:1` `bardlymercy >= 25 \|\| hp < 75%` | `usewineattack = 1`, shieldhp 400, shieldacthp 6, targetmercy 50 |
| 3 | `:13` `bardlymercy >= 50 \|\| hp < 50%` | `usewineattack = 1`, shieldhp 500, shieldacthp 8, shieldsize 10, targetmercy 75 |
| 4 | `:26` `bardlymercy >= 75 \|\| hp < 25%` | `usewineattack = 1`, shieldhp 500, shieldacthp 8, shieldsize 12, targetmercy 100 |

So **every phase transition forces a Wine turn**, and Wine is the only source of
the acid shield.

### Wine (types 2 / 2.1 / 2.2) — a turn the CONTROLLER cannot run alone

1. Dispatcher case 2 (`Step_0:809-813`) sets `wineglasscon = 1; drink = 0;` on
   the boss, then spawns the controller.
2. The box block hides `obj_growtangle` (`Step_0:764-768`) and the boss skips
   its own `scr_moveheart` (`Step_0:771`, `rr != 2`).
3. The controller's `init == 1` block creates `obj_queen_wineglass` and then
   **stops at `init = 2`** (`obj_queen_bulletcontroller_Step_0.gml:349-370`).
4. The BOSS drives `wineglasscon` 1 → 2 → 3 over ~45 frames
   (`Step_0:96-165`) — throw animation, glass flies to `camerax() + 320,
   cameray() + 228`, scales up — and only then:

```gml
// Step_0:152-164
if (winetimer >= 15)
{
    wineglasscon = 0;
    with (obj_queen_bulletcontroller)
        init = 3;
    with (obj_queen_wineglass)   visible = true;
    with (obj_queen_battlesolid_wine) instance_destroy();
}
```

5. Only at `init == 3` does the controller place the soul itself:

```gml
// obj_queen_bulletcontroller_Step_0.gml:373-382
if (init == 3)
{
    init = 4;
    with (obj_heartmarker) instance_destroy();
    instance_create(obj_growtangle.x - 8, obj_growtangle.y + 30, obj_heartmarker);
    scr_moveheart();
}
```

Then it rains `obj_queen_wine_attack_droplet` into the glass. Difficulty 1/2 add
a sinusoidal glass tilt (`obj_queen_wineglass.image_angle = sin(ctimer /
turnperiod) * turnamount`, `:447-451`) with tighter thresholds
(2.1: threshold 8 / wineadd 4 / turnamount ×1.2, `:355-361`;
2.2: threshold 6 / wineadd 3 / turnamount ×2, `:363-370`).

**`beatwine2nodamage`** is the "clear the 2.1 wine untouched" flag: set when 2.1
starts (`:360`), cleared on any wine hit
(`obj_queen_wine_attack_droplet_Other_15.gml:3-4`,
`obj_queen_wine_attack_bottom_hurtbox_Other_15.gml:3-4`). It is what picks 2.2
over 2.1 for the phase-4 wine (`Other_10.gml:23`).

### The acid shield

`obj_queen_wineglass_Destroy_0.gml:4` creates `obj_queenshield_intro`, which
flies the glass back to Queen and at `winetimer == 23`
(`obj_queenshield_intro_Step_0.gml:31-39`) creates `obj_queenshield_enemy`.
While it exists:

* the ACT menu swaps Loosen → **Toast** and GroupLoosen → **GroupToast**, and
  drops Throw (`Other_11.gml`, which re-runs `scr_spellmenu_setup()`);
* it bleeds 10% of `shieldmaxhp` per turn (`Step_0:294-298`);
* at `shieldhp <= 5 || shieldacthp < 1` it breaks (`Step_0:254-278`), and
  **if `phase == 4`, `usefinalattack = 1`** (`Step_0:274-275`).

### Ultimate (type 1) fires at most once

`usefinalattack` goes 1 → 2 at `Other_10.gml:43` and is never reset. Its only
writer of 1 (`Step_0:275`) sits inside a block guarded on
`instance_exists(obj_queenshield_enemy)` (`Step_0:249`), and a new shield only
appears at the end of a Wine turn, which only happens on a phase transition —
of which none remain after phase 4. Hence:

* `Step_0:801-802` (`scr_turntimer(311)`) is dead;
* `obj_queen_ultimate_attack_controller_Create_0.gml:5-6` (`variant = 1`) is dead.

The Ultimate itself is a **scripted joke turn**, not a bullet pattern: the
controller creates `obj_queen_ultimate_attack_controller` and covers the real
soul with `obj_hiddenheart` (`obj_queen_bulletcontroller_Step_0.gml:339-343`),
then fades out the heroes and plays a download progress bar,
`obj_queen_poppup_error` popups and `obj_queen_explodinghead_intro` passes.

### Soul modes

**Red only.** No green, blue, purple or yellow mode anywhere in this fight — the
only soul-mode-adjacent behaviour is the Wine turn's `obj_hiddenheart` /
`obj_heartmarker` relocation and the Ultimate's `obj_hiddenheart` swap.

### `obj_berdlyplug_enemy` — the mercy target

Loosen / GroupLoosen / Throw all do `bardlymercy += mercyset` then
`with (obj_berdlyplug_enemy) event_user(0)`
(`Step_0:1060-1075`, `:1173-1188`, `:1273-1288`, `:1370-1385`).
`bardlymercy` is what drives the phase gates on the pacifist route. The plug is
also yanked by BerdlyTornado (`obj_queen_bulletcontroller_Step_0.gml:952` sets
`obj_berdlyplug_enemy.con = 1`) and by the Throw ACT, which opens an aiming
minigame:

```gml
// Step_0:1236-1241
if (!instance_exists(obj_queenshield_enemy))
{
    obj_berdlyplug_enemy.con = 1;
    instance_create(viewX + 380, viewY + 50, obj_queen_throw_controller);
    scr_move_to_point_over_time(x - 40, cameray() + 195, 8);
}
```

That is an ACT, not an attack, so it is not in the roster — but the studio will
need it if anyone wants the full turn loop.

---

## What the studio has to special-case

1. **Switch-aware slicing.** `gen_attacks.js`'s `attackAnnouncements()` assumes
   an if/else chain. On Queen: walking backward from an announcement to the
   enclosing `{` lands on the switch's own opening brace, so `setup` comes out
   as either the whole switch (> 3500 chars → nulled) or every preceding case.
   The `<var> == N)` back-scan finds `if (rtimer == 16)` at `Step_0:781` and
   would tag **every** Queen attack with selector `rtimer`, choice 16. The
   forward window also runs past each `break` into later cases, over-collecting
   `extraFields` (`bufferattack` / `damage` / `target`). Either teach it
   case-label → next-case-label slicing, or hand-author the setups from the
   line ranges in the dispatcher table above.
2. **No turn ladder.** `turnBlock` is `null`; use `dispatchBlock` or
   `turnByChoice`.
3. **Wine cannot be spawned standalone.** Types 2 / 2.1 / 2.2 idle forever at
   `init == 2` without a live, stepping `obj_queen_enemy` running the
   `wineglasscon` machine. Launching one requires the boss instance,
   `wineglasscon = 1; drink = 0;` as case 2 does, and the box-hide snippet.
4. **Unguarded dereferences that will throw.**
   `obj_berdlyplug_enemy` at `obj_queen_bulletcontroller_Step_0.gml:952-953`
   (types 112/113) and `:756-757` (cut type 7) — neither is behind an
   `instance_exists`. `obj_heart` at `:340` (type 1). `obj_growtangle.x` at
   `:1091`, `:1123`, `:1152` (types 115/116). Separately,
   `obj_berdlyplug_enemy_Create_0.gml:26-28` reads
   `obj_ch2_scene25.berdly_wire` when `room == room_dw_mansion_east_4f_d` —
   safe in the studio only because the room will not match.
5. **Difficulty is boss-side.** The dispatcher never sets `dc.difficulty`; the
   BOSS's `difficulty` field selects which type is passed. The studio's DIFF
   selector must write `obj_queen_enemy.difficulty` (or pick the type directly),
   **not** `obj_queen_bulletcontroller.difficulty` — that field is read by cut
   type 4 alone and defaults to 1 (`Create_0.gml:23`).
6. **Controller lifecycle.** Its Step opens with
   `sameattack = scr_monsterattacknamecount(global.monsterattackname[creator])`
   (`:3`), so `creator` must be a valid monster slot — `scr_bulletspawner` sets
   it from `myself`. Its `Destroy_0` does
   `with (obj_queenshield_enemy) appearcon = 1;` and stops `snd_crowd`.
7. **Sound cleanup.** Types 105/106/107 create
   `obj_social_media_attack_fade_heroes` and loop `snd_crowd`; without the
   `Destroy_0` cleanup running, the crowd noise persists between launches.
8. **The Ultimate is a set piece,** not a bullet pattern: it needs
   `obj_hiddenheart`, `obj_queen_poppup_error`, and the hero-fade path.
