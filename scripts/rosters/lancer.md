# Lancer (ch1) — the REAL roster, derived from the choosers

**Summary: 7 real attacks across 3 real encounters. 2 cut dispatcher entries.**

All file:line references are into
`C:/Users/lando/Desktop/DELTARUNE - GML/DELTARUNE Chapter 1 - GML/`.

---

## 0. Which object is the Lancer boss fight?

All three candidates are real, and they are three separate encounters in plot
order — not phases of one fight and not cut. `obj_lancerbike` and
`obj_lancerbike_neo` are attack objects, not enemies (`objects.tsv` gives both
`parent = obj_regularbullet`; the three `obj_lancerboss*` have
`parent = obj_monsterparent`).

Each is wired into `scr_encountersetup` and each has a live trigger:

| object | encounter | triggered by | plot | monstertype | HP / AT / DF |
|---|---|---|---|---|---|
| `obj_lancerboss` | 2 | `obj_darkcastle_event_Step_0.gml:576-577` | 22 | 2 | 540 / 5 / 1 |
| `obj_susieenemy` + `obj_lancerboss3` | 31 | `obj_susieandlancer_event_Step_0.gml:143` | 130 | 19 / 18 | 120 / 7 / −5+armor, 800 / 6 / 1 |
| `obj_lancerboss2` | 20 | `obj_lancerbattle2_event_Step_0.gml:31` and `:757` | 154 | 12 | 2400 / 4 / −40 |

- `scr_encountersetup.gml:42-49` (case 2) → `obj_lancerboss`
- `scr_encountersetup.gml:244-253` (case 20) → `obj_lancerboss2`
- `scr_encountersetup.gml:386-397` (case 31) → `obj_susieenemy` **and** `obj_lancerboss3`
- Stats from `scr_monstersetup.gml:30-48` (type 2), `:325-338` (type 12),
  `:475-494` (type 18), `:496-515` (type 19).

Plot ordering settles the naming: fight 1 sets `global.plot = 22`
(`obj_lancerboss_Step_0.gml:229-230`), the Susie rematch sets 130
(`obj_susieandlancer_event_Step_0.gml:827-828`), the solo Card-Castle fight sets
154 (`obj_lancerbattle2_event_Step_0.gml:1153`). So the numbering in the object
names is **not** chronological: `obj_lancerboss3` is the SECOND fight and
`obj_lancerboss2` is the THIRD.

`obj_lancerboss` is used as the roster's `enemy` because it is the first and
eponymous Lancer battle and because its box/turn blocks slice cleanly; the other
three objects are carried in `extraEnemies` / `phaseBlocks`.

---

## 1. There is no selector variable

Chapter 1 predates `global.monsterattackname` entirely —
`grep -rn monsterattackname` over the whole Ch1 dump returns **zero** hits — so
the announcement scan finds nothing here, exactly as with Jevil.

But Lancer is not Jevil-shaped either. Jevil has a single numeric selector
(`jattack == N` → `obj_dbulletcontroller.type`). Lancer has **four different
dispatchers with three different gating idioms**, and two of his attacks have no
`type` at all:

| dispatcher | gate | what it creates |
|---|---|---|
| `obj_lancerboss_Step_0.gml:69-86` | `attacks == 0` / else | `obj_lancerbike` with `racecon = 1` / `lcon = 1` |
| `obj_lancerboss3_Step_0.gml:157-174` | same, gated by `attack_qual` | same |
| `obj_lancerboss2_Step_0.gml:66-106` | `turns == 0 \|\| turns == 2` / `turns == 1` / `turns >= 3` | `obj_dbulletcontroller` type 20 / 21 / 24 |
| `obj_susieenemy_Step_0.gml:29-71` | `attacktype == 2` / `== 1` / `== 0` | type 85 / type 20 / `obj_lancerbike_neo` |

**A `selectorScan` will not work.** With `varName: "turns"` on
`obj_lancerboss2_Step_0.gml`, the generator's window from `turns == 7` (line 100)
to the next hit (line 139) contains `dc.type = 24;` but **not** its
`instance_create` (line 94, which precedes the `turns == 6` hit at line 97), so
the scan drops type 24 entirely, and the two entries it does find are labelled
with the wrong branch values. With `varName: "attacks"` on
`obj_lancerboss_Step_0.gml` there is only ONE `attacks == 0` hit and the window
swallows both arms, collapsing two attacks into one entry with no way to
distinguish `racecon` from `lcon`.

So this roster is **declared**, the way Pink's `dates` are. The `choice` values
1–7 in `lancer.json` are roster indices, not in-game selector values; the real
gate is written out in each `evidence` string.

---

## 2. The choosers, quoted

### Fight 1 — `obj_lancerboss`: a two-attack toggle, four turns, hard stop

```gml
// obj_lancerboss_Step_0.gml:67-90
if (global.mnfight == 2 && attacked == 0)
{
    if (attacks == 0)
    {
        bike = instance_create(x, y, obj_lancerbike);
        visible = 0;
        bike.racecon = 1;
        ...
        attacks = 1;
    }
    else
    {
        bike = instance_create(x, y, obj_lancerbike);
        visible = 0;
        bike.lcon = 1;
        ...
        attacks = 0;
    }

    turns += 1;
    global.turntimer = 999;
    attacked = 1;
```

`Create_0.gml:25` starts `attacks = 0`, so the order is **fixed and
deterministic**: RACE, LOOP, RACE, LOOP. There is no randomness anywhere in the
choice (`rr = floor(random(5))` at `:91` only picks a battle *message*).

The fight then stops itself. The bike's end-of-attack block reads:

```gml
// obj_lancerbike_Step_0.gml:328-343
if (endcon == 1)
{
    global.turntimer = 2;

    with (obj_lancerboss)
    {
        visible = 1;

        if (turns >= 4)
        {
            con = 1;
            ...
```

`con = 1` runs the scripted defeat chain (`Step_0:191-235`, `Alarm_4.gml`
`con += 1`) and Lancer rides off. So fight 1 is exactly **4 attack turns**, each
attack used twice.

There is no early-out *guard*, though: HP 540 with mercymax 100 and
`sparepoint 10`, so a kill or a spare can end it sooner — the 4-turn script is
the intended path, not an enforced one.

### Fight 2 — `obj_susieenemy` + `obj_lancerboss3`: one attacker per turn

Lancer only gets a turn when Susie cannot take it:

```gml
// obj_lancerboss3_Step_0.gml:142-177
if (global.mnfight == 2 && attacked == 0)
{
    attack_qual = 0;

    if (scr_monsterpop() == 1)
        attack_qual = 1;

    with (obj_susieenemy)
    {
        if (sleeping == 1)
            obj_lancerboss3.attack_qual = 1;
    }

    if (attack_qual == 1)
    {
        if (attacks == 0)   { ... bike.racecon = 1; attacks = 1; }
        else                { ... bike.lcon = 1;    attacks = 0; }

        global.turntimer = 999;
    }
```

`scr_monsterpop()` is `global.monster[0] + global.monster[1] + global.monster[2]`
(`scr_monsterpop.gml:3`), i.e. the count of live monsters — so
`scr_monsterpop() == 1` means "Lancer is alone". The `attacks` toggle only
advances inside the `attack_qual == 1` block, so his RACE/LOOP alternation
survives the turns he skips.

Susie's chooser is a bare 3-cycle:

```gml
// obj_susieenemy_Step_0.gml:29-76
if (attacktype == 2) { dc.type = 85; ... if (sleeping == 1) destroy dc }
if (attacktype == 1) { dc.type = 20; ... if (sleeping == 1) destroy dc }
if (attacktype == 0 && sleeping == 0)
{
    bike = instance_create(obj_lancerboss3.x, obj_lancerboss3.y, obj_lancerbike_neo);
    ...
    global.turntimer = 999;
}

attacktype += 1;

if (attacktype >= 3)
    attacktype = 0;
```

`Create_0.gml:39` starts `attacktype = 0`, so her order is **bike_neo → type 20
→ type 85 → …**. Note the increment is *outside* the sleeping checks, so the
cycle keeps turning while she sleeps; her controllers are created and
immediately destroyed instead. All three values are reachable → all three are
real.

Ralsei's ACT 3 is what puts her to sleep (`obj_susieenemy_Step_0.gml:204-271`),
and she wakes after 3 turns (`obj_susieenemy_Other_11.gml:4-14`). If Susie is
killed, Lancer resurrects her at 40 HP after three solo turns
(`obj_lancerboss3_Step_0.gml:13-38`). The real win condition is the pacify
chain: repeated ACTs push `anythingcounter` to 10 and set `defeated = 1`
(`:372-383`), with `ears_blocked` letting Lancer plug his ears twice
(`actcon` 20/21, `:386-426`).

### Fight 3 — `obj_lancerboss2`: a scripted turn ladder, 0…7

```gml
// obj_lancerboss2_Step_0.gml:62-113
if (rtimer == 12)
{
    global.turntimer = 140;

    if (turns == 0 || turns == 2)
    {
        dc = instance_create(x, y, obj_dbulletcontroller);
        dc.type = 20;
        ...
        global.turntimer = 180;
    }

    if (turns == 1)
    {
        dc = instance_create(x, y, obj_dbulletcontroller);
        dc.type = 21;
        ...
        global.turntimer = 180;
    }

    if (turns >= 3)
    {
        dc = instance_create(x, y, obj_dbulletcontroller);
        dc.difficulty = turns * 2;

        if (turns == 6)
            dc.difficulty = 30;

        if (turns == 7)
            dc.difficulty = 90;

        dc.type = 24;
        ...
    }

    turns += 1;
```

Ladder, with no randomness:

| turn | type | difficulty | turntimer | notes |
|---|---|---|---|---|
| 0 | 20 | – | 180 | |
| 1 | 21 | – | 180 | |
| 2 | 20 | – | 180 | |
| 3 | 24 | 6 | 140 | `bmax = difficulty + 5` → 11 |
| 4 | 24 | 8 | 140 | bmax 13 |
| 5 | 24 | 10 | 140 | bmax 15; Susie's sprites go "serious" (`:157-166`) |
| 6 | 24 | **30** | 140 | bmax 35 — the *sparsest* turn; Susie's sprites revert (`:168-179`) |
| 7 | — | — | — | **dialogue only**, then the scripted blackout |

Fight 3 also opens abnormally: `Create_0.gml:40` sets `firstskip = 1` and
`Step_0:1-20` forces `acting = 1; global.charturn = 3; global.myfight = 3;`, so
the battle begins directly in the ACT text with no talk/blcon intro. Every turn
runs `global.monsterdf[myself] -= 5` (`:190`), starting from DF −40. Damage
halves to `global.monsterat * 3` while the leader is at ≤ 70 HP (`:73-74`,
`:86-87`).

---

## 3. The real roster (7)

| # | attack | controller | launch | turntimer | where |
|---|---|---|---|---|---|
| 1 | Bike Race — honk, then drive-by | `obj_lancerbike` | `racecon = 1` | 999 (self-ends) | fights 1 & 2 |
| 2 | Bike Loop — loop-de-loop trailing spades | `obj_lancerbike` | `lcon = 1` | 999 (self-ends) | fights 1 & 2 |
| 3 | Falling Spades | `obj_dbulletcontroller` | `type = 20` | 180 | fight 3 turns 0/2; Susie attacktype 1 |
| 4 | Side Spades | `obj_dbulletcontroller` | `type = 21` | 180 | fight 3 turn 1 |
| 5 | Homing Falling Spades | `obj_dbulletcontroller` | `type = 24`, difficulty 6/8/10/30 | 140 | fight 3 turns 3–6 |
| 6 | Susie's Axes (Lancer cheers) | `obj_dbulletcontroller` | `type = 85` | 180 | Susie attacktype 2 |
| 7 | Susie rides the bike | `obj_lancerbike_neo` | *(nothing — self-starts)* | 999 (self-ends) | Susie attacktype 0 |

Bodies:

- **Bike Loop** — `obj_lancerbike_Step_0.gml:1-209`. `lcon` 1 → 1.5
  (`snd_cardrive`) → 2 (wheelie: `hspeed = sin(ltimer / 3) * 5`, `image_yscale`
  squash) → 5 → 6 → 7 → 8 → 9 → 10 → 11 (fade the spades, end). Spades spawn
  every 10 frames while `lcon >= 6 && lcon < 10` (`:23-55`): `obj_regularbullet`
  with `spr_spadebullet`, `move_towards_point(obj_heart.x + 8, obj_heart.y + 8, 4)`
  and `friction = -0.4`, i.e. they *accelerate* toward where the heart was.
- **Bike Race** — `obj_lancerbike_Step_0.gml:211-326`. `racecon` 1 (init,
  `vspeed = -14 * choose(1, -1)`, `maxr = 15 + random(25)`) → 2 (bob between
  `topy`/`bottomy`) → 3 (two honks at rtimer 5 and 10, `spr_lancernoise` via
  `obj_afterimage_grow`) → 4 (`hspeed = -20` charge across the view, tilting to
  50°) → 5 (return). The only randomness in either bike attack is the initial
  vertical direction and the bob duration.
- **Falling Spades (20)** — `obj_dbulletcontroller_Step_0.gml:325-383`. `bmax = 8`
  (`:353-354`); each spade drops from `__view_get(e__VW.YView, 0) - 20` at
  `obj_heart.x + (-80..+80) + 8`, `gravity 0.3`, `vspeed 3`, slight random drift.
  `:326-351` whistle-animates `obj_lancerboss3` (swap to `spr_lancerbike_l` for
  30 frames) when he exists — so this body was written for both fights.
- **Side Spades (21)** — `:385-433`. `bmax = 9` (`:387-388`); spades enter
  alternately from `viewX + 80` heading right and `viewX + 560` heading left, at
  a random y inside `obj_growtangle`, `speed 5` with `friction -0.1`, fading in
  through `with (obj_regularbullet) image_alpha += 0.2`.
- **Homing Falling Spades (24)** — `:435-527`. `bmax = difficulty + 5` (`:437`),
  and *every* live `obj_regularbullet` steers toward the heart's x (`:439-501`) —
  a two-stage nudge that gets aggressive within 100 px vertically. Spawn y is a
  raw `-20` (`:506`), **not** view-relative — compare type 20's
  `__view_get(e__VW.YView, 0) - 20` at `:362`.
- **Susie's Axes (85)** — `:883-999`. Hides the real Susie and Lancer, spawns
  `obj_bulletparent` stand-ins `fakelan` (`spr_lancerbike`, swaps to
  `spr_lancerbike_l` whenever `global.inv > 10` — he cheers when you get hit) and
  `fakesus` (`spr_susie_enemy_attack`), then every 27 frames spawns an
  `obj_axebullet` at `viewX + 540` / `obj_battlesolid.y` (`:983-995`). Restores
  visibility at `global.turntimer <= 10`.
- **Susie rides the bike** — `obj_lancerbike_neo_Step_0.gml`. `Create_0.gml:16`
  leaves `racecon = 0` and `Step_0:1-33` self-starts, so **no flag is set by the
  dispatcher**. Susie is an `obj_regularbullet_permanent` (`spr_susiel_dark`)
  that leaps onto the bike; `racecon` 2 honks twice, then 3 charges while
  `s_attack == 1` throws an `obj_axebullet` roughly every 8 frames with
  `hspeed += 0.3 * ax_timer` (`:71-116`); `racecon` 4 resets and ends the turn
  with `global.turntimer = 5` (`:202`).

---

## 4. Cut (2)

### `obj_dbulletcontroller` type 22 — Falling Spades, fast variant

`obj_dbulletcontroller_Step_0.gml:325` shares the whole falling-spade body
between `type == 20` and `type == 22`, and `:356-357` gives 22 the tighter
`bmax = 6`. It is unmistakably a Lancer attack — `:326-351` whistle-animates
`obj_lancerboss3`. But **nothing in Chapter 1 ever writes it**:
`grep -rn 'type = 22'` over the entire Ch1 dump returns zero hits. Unreachable.

(The sibling values in the type-21 branch are *not* cut Lancer content: `23` is
written by `obj_king_body_Step_0.gml:101` and `obj_king_boss_Other_15.gml:149`,
`25` by `obj_joker_Other_15.gml:203`. Those are King's and Jevil's attacks
reusing the same body.)

### `obj_lancerboss2` turn 7 — type 24 at difficulty 90

```gml
// obj_lancerboss2_Step_0.gml:100-101
if (turns == 7)
    dc.difficulty = 90;
```

Unreachable. The ACT block that runs before every attack sets `actcon = 1`
(`:137`), but the `turns == 7` arm (`:181-188`) overrides it to `actcon = 2`.
Only `actcon == 1` calls `scr_attackphase()` (`:197-201`); `actcon == 2`
(`:203-230`) blacks the screen out and hands control to
`obj_lancerbattle2_event` (`con = 52`), which destroys `obj_lancerboss2` at
`obj_lancerbattle2_event_Step_0.gml:802`. So the `global.mnfight == 2` block
never runs an eighth time. (bmax would have been 95 — effectively no bullets.)

### Dead code inside live attacks (not roster entries)

- `obj_lancerbike` `lcon` states **3 and 4** are never reached: `Step_0:75`
  jumps `lcon = 2` straight to `5`.
- `obj_lancerbike_Step_0.gml:222-227` —
  `else if (instance_exists(obj_susieenemy)) { s = 289; sy = s.y; ... }` — is
  unreachable, because `obj_susieandlancer_event` (tested first, `:216`) always
  exists in the only fight where `obj_susieenemy` does. `s = 289` is a
  hardcoded instance id, a decompiler artifact of a room-instance reference.
- Never-read locals: `obj_lancerbike`'s `spec`, `flip`, `loop`, `bikeflip`,
  `becomeflash`; `obj_lancerbike_neo`'s `lcon`, `ltimer`, `type`.

---

## 5. Box and turn blocks

Every one of the four battle objects creates the same fixed Ch1 box — no
`maxxscale`, no resizing, identical to Jevil's:

```gml
if (!instance_exists(obj_growtangle))
    instance_create(__view_get(e__VW.XView, 0) + 320, __view_get(e__VW.YView, 0) + 170, obj_growtangle);
```

at `obj_lancerboss_Step_0.gml:57`, `obj_lancerboss2_Step_0.gml:53`,
`obj_lancerboss3_Step_0.gml:132`, `obj_susieenemy_Step_0.gml:16`. The anchor
occurs exactly once in each file, and the generator's `ifStatementEnd` walks the
unbraced single statement to the `;` — verified, all four slice to precisely the
two lines above.

Turn blocks, all verified by replaying `gen_attacks.js`'s `extractTurnBlock`:

| object | anchor | endAnchor | slices to |
|---|---|---|---|
| `obj_lancerboss` | `global.turntimer = 999;` | `attacked = 1;` | `global.turntimer = 999;` |
| `obj_lancerboss3` | `global.turntimer = 999;` | `}` | `global.turntimer = 999;` |
| `obj_susieenemy` | `global.turntimer = 180;` | `if (attacktype == 2)` | `global.turntimer = 180;` |
| `obj_lancerboss2` | `global.turntimer = 140;` | `if (turns == 0 \|\| turns == 2)` | `global.turntimer = 140;` |

Three traps in there:

1. **`obj_lancerboss3` needs `endAnchor: "}"`.** Its 999 sits *inside* the
   `if (attack_qual == 1)` block (`:176`) and the very next line is that block's
   closing brace, so the obvious `turns += 1;` endAnchor would capture an
   unbalanced `}`.
2. **`obj_lancerboss2` must NOT slice to `turns += 1;`.** Between the 140 default
   and `turns += 1;` sit all three dispatcher branches with their
   `instance_create(obj_dbulletcontroller)` calls — replaying that block is
   exactly the doubled-controller trap `gen_attacks.js` records for the Knight's
   `if (myattackchoice == 7)`. The 140 is genuinely the turn length for type 24
   only; types 20 and 21 raise it to 180 inside their own branches (`:76`,
   `:89`), which the roster records per-entry instead.
3. **The 150 and 120 values are not turn lengths.**
   `obj_lancerboss2_Step_0.gml:116` and `obj_susieenemy_Step_0.gml:99` are the
   `else` arms of `rtimer == 12` — holding values that keep the turn alive during
   the 12-frame wind-up and are overwritten the instant the attack spawns.

Note also that unlike Spamton NEO, none of these go through `scr_turntimer`;
they are direct `global.turntimer = N` assignments, so the "only RAISES" rule
does not apply and later assignments really do win.

---

## 6. What the studio has to special-case

Assets are **not** the problem. Everything is already present:

- `docs/js/gml_objects.js` has `obj_lancerbike`, `obj_lancerbike_neo`,
  `obj_lancerboss`, `obj_lancerboss2`, `obj_lancerboss3`, `obj_susieenemy`,
  `obj_dbulletcontroller`, `obj_axebullet`, `obj_regularbullet_permanent`,
  `obj_bulletparent`, `obj_battlesolid`, `obj_dmgwriter`, `obj_afterimage_grow`,
  `obj_growtangle`.
- `sprite_manifest.js` + `sprite_indices.js` have `spr_lancerbike`,
  `spr_lancerbike_l`, `spr_lancerbike_hurt`, `spr_lancerbike_earcover`,
  `spr_spadebullet`, `spr_lancernoise`, `spr_susiel_dark`, `spr_susie_enemy`,
  `spr_susie_enemy_attack`, `spr_susie_enemy_defeat`, `spr_lancer_battle`,
  `spr_lancer_battle_hurt`.
- `gml_sounds.js` has `snd_cardrive`, `snd_lancerhonk`, `snd_drive`,
  `snd_spearrise`, `snd_lancerwhistle`, `snd_splat`, `snd_jump`, `snd_laz_c`.

The gaps are all in the **launch path**:

1. **The roster must be declared, not scanned.** No `monsterattackname`, and
   `selectorScan` provably drops type 24 and cannot separate `racecon` from
   `lcon` (§1). Follow the Pink `dates` precedent.
2. **Two attacks have no `type`.** `obj_lancerbike` needs `racecon = 1` or
   `lcon = 1` written on the instance after creation; `obj_lancerbike_neo` needs
   nothing at all. The launcher needs per-attack controller flags, which is why
   `lancer.json` carries a `set` field on those entries. (This is the same
   mechanism as Jevil's `controllerSet: { joker: 1 }`, except it varies per
   attack rather than per boss.)
3. **Three attacks self-terminate the turn.** `obj_lancerbike` sets
   `global.turntimer = 2` (`Step_0:330`) and `obj_lancerbike_neo` sets `5`
   (`Step_0:202`) when the animation finishes. Their declared 999 is a ceiling,
   not a duration — the studio must not clamp turn length to a floor or
   force-end on a timer.
4. **The bike attacks are not box-confined.** `obj_lancerbike` drives to
   `__view_get(e__VW.XView, 0) + 5` and `+ 630`, then teleports to
   `viewX + 740` (`Step_0:103`, `:138`, `:310`). It needs a correct 640×480 view
   origin, not just the growtangle rect. The boss itself is hidden
   (`visible = 0`) for the whole attack and restored by the bike's `endcon`.
5. **Type 85 hard-depends on `obj_battlesolid`.** `:983` gates the axe spawn on
   `instance_exists(obj_battlesolid)` and `:993` reads its `y`; the two stand-in
   sprites are placed off it too (`:898`, `:911`). Without it the attack runs but
   fires nothing.
6. **Type 20 reaches into `obj_lancerboss3`** to whistle-animate him
   (`:326-351`). It is `instance_exists`-guarded so it is safe without him, but
   the visual is wrong.
7. **Type 24 spawns at a raw `y = -20`** (`:506`) rather than view-relative, so it
   only looks correct when the view y origin is 0.
8. **Fight 2 is a two-enemy fight with a mutual-exclusion rule.** Running
   Susie's attacks or Lancer's in isolation is fine for the studio, but the real
   turn order depends on `scr_monsterpop()` and `obj_susieenemy.sleeping`
   (§2) — a faithful full-fight replay needs both objects alive.

No soul modes, no minigames, no green/purple/yellow soul anywhere in these three
fights.

**Confidence: high.** Every claim above is a direct read of the dispatcher or
chooser, every anchor was verified verbatim, and all eight box/turn slices were
produced by replaying `gen_attacks.js`'s own `extractBoxBlock` /
`extractTurnBlock`. The one thing not verified from source is whether
`obj_lancerboss2` (HP 2400, DF dropping 5/turn from −40) can actually be killed
inside its 7 attack turns — there is no kill *guard* in the code
(`scr_damage_enemy.gml:37-41` calls `scr_monsterdefeat()` unconditionally at
HP ≤ 0), so the 8-turn script is the intended path rather than an enforced one.
