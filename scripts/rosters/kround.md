# K. Round (ch1) — the REAL roster, derived from the chooser

**Summary: 4 real attacks, 1 cut. The chooser is a deterministic 4-slot rotation,
not a random roll — the attack order is FIXED and identical in both encounters.**

All file:line references are into
`C:/Users/lando/Desktop/DELTARUNE - GML/DELTARUNE Chapter 1 - GML/`
unless a chapter is named explicitly.

---

## 0. Confirming the encounter

`obj_checkers_enemy` is wired into `scr_encountersetup` twice, and **both are
real, reachable K. Round fights** — they are the two halves of the same gag, not
a fight plus a cut duplicate.

| encounter | monstertype | room | trigger | HP / AT / DF |
|---|---|---|---|---|
| 12 | 10 | `room_field_checkersboss` | `obj_checker_animtest_Step_0.gml:372-388` | 1300 / 7.5 / 3 |
| 27 | 21 | `room_cc_6f` | `obj_rurus_checker_event_Step_0.gml:214-233` | 1300 / 8 / 3 |

- `scr_encountersetup.gml:146-154` (case 12) → `obj_checkers_enemy`, monstertype 10,
  at `xx + 480 / yy + 120`.
- `scr_encountersetup.gml:333-342` (case 27) → `obj_checkers_enemy`, monstertype 21,
  same position, plus `global.heromakey[0] = yy + 65`.
- Stats: `scr_monstersetup.gml:269-295` (type 10) and `:544-567` (type 21).

Chapter 1 stores the names as lang keys, so the identification is made from the
Chapter 2 copy of the same script, which ships the literals inline:

- Ch2 `scr_monstersetup.gml:284` — `stringsetloc("K.Round", ...)` for type **10**
- Ch2 `scr_monstersetup.gml:559` — `stringsetloc("K.Round", ...)` for type **21**

Ordering is settled by `global.flag[246]`: the first fight's **Check** sets it
(`obj_checkers_enemy_Step_0.gml:316`), and the second fight's `scr_monstersetup`
entry reads it to rename its own Check act to "Checkers"
(`scr_monstersetup.gml:559-560`, Ch2 `:572-573`). The trigger gates agree —
encounter 12 needs `global.plot < 60` (`obj_checker_animtest_Create_0.gml:6-19`)
and encounter 27 needs `global.plot < 175`
(`obj_rurus_checker_event_Create_0.gml:3-11`).

`obj_checker_animtest` is not a debug object despite the name: it is the
room-placed cutscene that starts the first fight (`type == 0`, Step_0:1-405) and
it is *also* what `obj_checkers_enemy` spawns with `type = 1` when the fight is
won, to play the crown-flies-off transformation (`Step_0:673-683` → animtest
`Step_0:406+`). Its Create branch for `room_cc_6f` exists only to set
`secondtime = 1` on that spawned instance; `type` is overwritten to 1 by the
creator before its Step ever runs, so `type == 0` (which would start encounter
12) can never fire there.

The `obj_checkers_enemy` in Chapters 2-5 is a leftover copy. Its Step is
byte-identical to Ch1's apart from lang-key vs literal strings and one deleted
`else { global.turntimer = 999; }`, and `obj_checkers_leap_Step_0.gml` diffs
**empty** against Ch1. That makes the Ch2 literals safe to quote for text.

---

## 1. This fight has no bullet controller

Every roster so far has been `boss → scr_bulletspawner(obj_*_bulletcontroller)`
plus a numeric `type`. K. Round has **none of that**. Grepping the enemy's Step
for `scr_bulletspawner` returns nothing; the only spawn in the whole attack path
is:

```gml
dc = instance_create(x, y, obj_checkers_leap);
dc.leapmode = rr;
dc.target = mytarget;
dc.damage = global.monsterat[myself] * 5;
```
— `obj_checkers_enemy_Step_0.gml:79-82`

`obj_checkers_leap` **is** the attack. Per `objects.tsv` its parent is
`obj_collidebullet` (→ `obj_bulletparent`), so the checker's own body is a
hitbox while `active == 1`:

```gml
if (active == 1)
    scr_damage();
```
— `obj_checkers_leap_Other_15.gml:1-2`, reached from
`obj_heart_Collision_obj_collidebullet.gml:1-2` (`with (other) event_user(5);`)

Each `leapmode` branch of its Step then spawns whatever `obj_regularbullet`
shrapnel it needs, and ends the turn itself.

---

## 2. The chooser

```gml
if (!instance_exists(obj_checkers_leap))
{
    if (attacktype == 0)
        rr = 0;

    if (attacktype == 1)
        rr = 3;

    if (attacktype == 2)
        rr = 1;

    if (attacktype == 3)
        rr = 2;

    dc = instance_create(x, y, obj_checkers_leap);
    dc.leapmode = rr;
    dc.target = mytarget;
    dc.damage = global.monsterat[myself] * 5;
    attacktype += 1;

    if (attacktype > 3)
        attacktype = 0;
}
```
— `obj_checkers_enemy_Step_0.gml:65-87`

This is the chooser **and** the dispatcher in one block, which is why K. Round
needed no cut-content pruning: there is no separate "if (type == N)" ladder that
outlived its selector.

**`attacktype` is a deterministic cycling counter.** It is initialised to 0 at
`Create_0.gml:37`, and the two lines above (`attacktype += 1;` / wrap at `> 3`)
are the **only** writes to it anywhere in Chapter 1. So:

| turn | `attacktype` | `rr` = `leapmode` | attack |
|---|---|---|---|
| 1 | 0 | **0** | Stomp |
| 2 | 1 | **3** | Leg Sweep |
| 3 | 2 | **1** | Slam |
| 4 | 3 | **2** | Magnificent Ascent |
| 5 | 0 | 0 | (repeat) |

Note the deliberately scrambled mapping — slot 1 fires leapmode 3, slot 2 fires
leapmode 1. Every one of the four values is reached on turns 1-4 of both fights,
and no other value can be produced. **All four leapmodes are real.**

### The decoy `rr`

`rr` is written a fifth time, 20 lines further down:

```gml
rr = choose(0);
```
— `obj_checkers_enemy_Step_0.gml:98`

This is vestigial. It runs *after* `dc.leapmode = rr` has already read the value,
it rolls a one-option `choose` (always 0), and **there is no `rr ==` test
anywhere in the object**. It is the same line that survives in
`obj_smallcheckers_enemy_Step_0.gml` (C. Round), where it at least feeds the dead
`if (rr == 999)` branch. Here it feeds nothing.

Consequence for `gen_attacks.js`: a `selectorScan` for `rr` on the boss file
finds **zero** hits (the regex is `<var>\s*==\s*(-?\d+)` and no such comparison
exists), and a scan for `attacktype` finds four one-line windows with no
`instance_create` in three of them. The roster therefore points `selectorScan` at
`obj_checkers_leap_Step_0.gml` / `leapmode` instead — see §6.

---

## 3. The four real attacks

All four are one instance of `obj_checkers_leap` created at the boss's position
(`xstart`/`ystart` are read throughout each branch), carrying
`damage = global.monsterat[myself] * 5` — **37.5** in the first fight, **40** in
the rematch, rising by 2.5 per milk (see §5).

Fixed geometry these branches assume: boss at `viewY + 120`, box centred on
`(viewX + 320, viewY + 170)` at scale 2 of `spr_battlebg_0` (75×75) → 150×150,
**floor at `viewY + 245`**.

### leapmode 0 — Stomp (turn 1)
`obj_checkers_leap_Step_0.gml:1-92`

Three charge-and-leap cycles. Charge is 20 frames on the first
(`jumpmax` at `:45-48`), 10 after; launch `vspeed = -17` then `-15` (`:59-62`)
with `hspeed = (targetx - x) / 28` aimed at `obj_heart.x + 8` (`:58`). Each leap
lands on

```gml
y >= ((obj_growtangle.y + (obj_growtangle.sprite_height / 2)) - sprite_height)
```
— `:7`

i.e. standing on the **box floor**, with `snd_impact` + `obj_shake` (`:9-10`).
The fourth jump sets `active = 0` and returns to `xstart` at `gravity = 2`
(`:67-74`), then 10 frames later `global.turntimer = -1` and it destroys itself
(`:78-91`).

**Spawns no bullets at all** — the checker's body is the entire attack.
Estimated ~170 frames.

### leapmode 3 — Leg Sweep (turn 2)
`obj_checkers_leap_Step_0.gml:346-433`

Plays `spr_checkers_leg` (6 frames, `image_speed 0.5`) and fires on the exact
frame `image_index == 3`:

```gml
for (i = 0; i < 4; i += 1)
{
    bul = instance_create(x - 40, y + 100, obj_regularbullet);
    bul.sprite_index = spr_checkershrapnel;
    bul.direction = (point_direction(bul.x, bul.y, obj_heart.x + 8, obj_heart.y + 8) - (10 * i)) + random(i * 20);
    bul.speed = 3.5 + random(1.8);
    ...
}
```
— `:369-377`

Four volleys of four (`amt >= 4` at `:404`), so **16 aimed shrapnel** per turn.
Every live `obj_regularbullet` also grows `0.01` in each scale per frame for the
whole attack (`:348-352`). 30-frame wind-down fades them out and ends the turn at
`:427`. Estimated ~155 frames.

### leapmode 1 — Slam (turn 3)
`obj_checkers_leap_Step_0.gml:94-223`

Charge 20 frames → leap toward the soul at `vspeed = -17` (`:139-149`) → freeze
at the apex when `vspeed >= 0` (`:163-173`) → hover 15 frames with `snd_boost`
and a spinning sprite → `snd_ultraswing`, `vspeed = 32`, slam down leaving
`scr_afterimage()` trails every frame (`:182-194`). On impact:

```gml
shrap.direction = 130 - random(10) - (70 * (i / (shrapmax - 1)));
shrap.speed = 6 + random(1);
shrap.gravity = 0.25;
```
— `:207-210`, `shrapmax = 6`

**6 shrapnel fanned upward from the impact point, arcing back down.** Two slams
(`amt >= 3` at `:152` turns the third charge into the retreat) → **12 bullets**.
20-frame wind-down ends the turn at `:111`. Estimated ~175 frames.

### leapmode 2 — Magnificent Ascent (turn 4)
`obj_checkers_leap_Step_0.gml:225-343`

Plays `spr_checkers_magnificent` to its last frame (5 frames, `image_index >= 4`
at `:240`), then rises off the top of the screen:

```gml
hspeed = -4;
gravity = -0.12;
...
y += (sin(siner / 3) * 4);
```
— `:244-254`

From `s_timer >= 24` it drops one bullet every 3 frames (`:260-284`) with
`vspeed = 3`, `gravity_direction = 135 + random(180)`, `gravity = 0.06` — a slow
scatter of drifting shrapnel. The **7th and 13th** are different:

```gml
if (magamt == 6 || magamt == 12)
{
    with (bul)
    {
        gravity = 0;
        move_towards_point(obj_heart.x + 8, obj_heart.y + 8, 3);
    }
}
```
— `:273-280`

These are the **only homing bullets K. Round has**. Once past `viewY - 200` the
checker teleports to `(xstart + 300, ystart - 100)` and flies back in at
`hspeed = -30` (`:286-295`), lands, and a 30-frame wind-down ends the turn at
`:337`. Roughly 17 bullets. Estimated ~125 frames.

---

## 4. The cut entry

### leapmode 4 — short-hop stomp
`obj_checkers_leap_Step_0.gml:436-508`

**Unreachable.** `leapmode` is written in exactly two places in the whole
Chapter 1 dump — `obj_checkers_leap_Create_0.gml:6` (`leapmode = 0;`) and
`obj_checkers_enemy_Step_0.gml:80` (`dc.leapmode = rr;`) — and `rr` at that
moment can only be 0, 3, 1 or 2 (§2). `grep -rn leapmode` over the whole chapter
returns 6 hits: those two writes plus the five `if (leapmode == N)` branch heads.
Nothing produces 4.

It is an earlier, tamer draft of leapmode 0: 16-frame charge instead of 20/10
(`:470`), `vspeed = -12` instead of −17/−15 (`:477`), `hspeed` divisor 24 instead
of 28 (`:479`), and — the giveaway — it lands back on `floory`, the boss's *own*
y (`:440-449`), rather than on the box floor, so the checker never enters the
battle box at all. Like leapmode 0 it spawns nothing.

It is byte-identical in Chapters 1-5, so it was never revived later either.

### Other dead code

- **`battlecancel`** — `Create_0.gml:29` sets it to 0; `Step_0:120-130` branches
  on `== 1` (mercymod 999) and `== 2` (`obj_battlecontroller.noreturn = 1`).
  Nothing in Chapter 1 ever assigns 1 or 2. The same block is dead in
  `obj_smallcheckers_enemy` — the two Steps share an ancestor.
- **`obj_checkers_leap.boss`** — `Create_0.gml:17`, one hit in the whole dump.
- **`bikeflip`, `nexttry`, `tired`, `candodge`, `dodgetimer`** —
  `Create_0.gml:1, 30, 24, 27, 26`. None appears in any of the object's six
  events; template leftovers.
- **`Draw_0:1-35`** — the `state == 3` hurt-shake path. Nothing in the object
  ever sets `state = 3` (`Create_0.gml:7` is the only write).

---

## 5. Phases, milk, and the actual win condition

There is one gate, and it is not an HP phase in the usual sense.

```gml
milkmax = 1000;

if (milk_counter > 0)
    milkmax = 600;

if (global.monsterhp[myself] > milkmax)
{
    if (!instance_exists(obj_moveheart) && !instance_exists(obj_heart))
        scr_moveheart();

    if (!instance_exists(obj_growtangle))
        instance_create(__view_get(e__VW.XView, 0) + 320, __view_get(e__VW.YView, 0) + 170, obj_growtangle);
}
```
— `obj_checkers_enemy_Step_0.gml:21-33`

The same test is repeated at `rtimer == 12` (`:53-62`). If HP is at or below
`milkmax`, K. Round **skips its attack entirely**:

```gml
if (global.monsterat[myself] < 10)
    global.monsterat[myself] += 0.5;

snd_play(snd_power);
milkheal = 700;

if (milk_counter == 0)
    milkheal = 300;

global.monsterhp[myself] += milkheal;
```
— `:221-230`

Ch2's literal copy gives the text: *"K. ROUND felt stressed out and attacked!"*
→ *"K. ROUND practiced self-care!"* → *"K. ROUND's HP and ATTACK went up!"*
(Ch2 `obj_checkers_enemy_Step_0.gml:146, 159, 276`).

This is **repeatable**: `scon` returns to 0 (`:266`, `:293`) and `milkmax` stays
600, so from then on every turn that begins at ≤600 HP is another +700 heal.
Damage alone cannot win unless you burst him from above the threshold to 0 in one
turn. On a milk turn there is **no box and no soul** — the gate at `:26` covers
both `scr_moveheart()` and the `obj_growtangle` create.

In the rematch this is pre-armed:

```gml
if (global.monstertype[myself] == 21)
    secondtime = 1;
...
if (secondtime == 1)
    milk_counter = 99;

if (secondtime == 1)
    ralsei_lecture = 99;
```
— `:1-12`

so `milkmax` is 600 from the start, the heal is the full 700, and the
Susie/Ralsei milk dialogue (`:270-282`) is skipped.

### The crown

```gml
if (crown >= 100)
{
    global.mercymod[myself] = 999;
    actcon = 50;
}
else
{
    scr_attackphase();
}
```
— `:634-642`

`sparepoint` is 0 and `mercymax` is 100, so **crown is the only mercy route**.
It is fed by ACTs: **Bow** +15 first fight / +18 rematch (`:344-348`), **Deep
Bow** +20 (`:460`). The running total is announced every enemy turn
(`:107-108`, Ch2 literal: `"* The crown is \cY~1-percent\cW loose!"`). At
`actcon == 50` the boss goes invisible, `snd_free_all()`, and spawns
`obj_checker_animtest` with `type = 1` and `spr_smallchecker_transform3`
(`:673-683`) — the crown-flies-off transformation.

### ACT menus

`acting = act index + 1` (`obj_battlecontroller_Step_0.gml:552`). `actactor`
semantics from `obj_battlecontroller_Step_0.gml:529-566`: **1** = Kris alone,
**2** = Kris+Susie, **3** = Kris+Ralsei, **4** = Kris+Susie+Ralsei (and the menu
entry is greyed out if the required partner is absent or downed).

**First fight** (`scr_monstersetup.gml:281-294`; Ch2 literals `:294-307`):

| acting | name | actactor | effect |
|---|---|---|---|
| 1 | Check | 1 | `global.flag[246] = 1`, renames itself to "Checkers" (`Step_0:314-321`) |
| 2 | Bow | 1 | crown **+15** (`:345`) |
| 3 | Deep Bow | 3 | crown **+20**, Kris and Ralsei both bow (`:458-496`) |
| 4 | Warning | 3 | only if `scr_havechar(2)` (Susie present); third use does `global.battleat[2] *= 1.5` (`:623`) |

`global.battleat` is indexed by **party slot** (`obj_battlecontroller_Create_0.gml:122`),
and the Ch1 party order at that point is Kris(0) / Ralsei(1) / Susie(2) —
`scr_getchar` fills the first free slot, and Susie rejoins last
(`obj_darkcastle_event_Step_0.gml:922-923` then `obj_dustpile_susie_Step_0.gml:174`).
So slot 2 *is* Susie, matching the Ch2 text *"Susie's ATTACK went up massively"*.

**Rematch** (`scr_monstersetup.gml:556-566`; Ch2 literals `:569-579`):

| acting | name | actactor | effect |
|---|---|---|---|
| 1 | Check / "Checkers" | 1 | text only |
| 2 | Bow | 1 | crown **+18** (`:348`) |
| 3 | "Susie's Idea" → "Throw" | 4 | one dialogue turn (`:586-602`), then an aiming minigame with `obj_throwtarget` + `obj_throwralsei` (`:562-585`), resolved in `obj_ralseithrown_Collision_obj_throwtarget.gml` |

Soul is plain **red** throughout — `scr_moveheart()` → `obj_moveheart` →
`obj_heart` (`gml_GlobalScript_scr_moveheart.gml`). No green/blue/purple mode.

---

## 6. What the studio has to special-case

1. **No controller, no `.type`.** The launch is
   `instance_create(x, y, obj_checkers_leap)` + `leapmode`. `gen_attacks.js`
   extracts `type = null` for every branch and its controller regex reports
   `obj_shake` (leapmodes 0, 1) or `obj_regularbullet` (leapmodes 2, 3) — both
   wrong. The studio needs a `checkers-leap` launch mode that creates the leap
   object **at the boss's x/y** (`xstart`/`ystart` are read at `:31, :71, :156,
   :291, :309, :457, :487`) and sets `leapmode`, `target`, `damage`.

2. **The attack object is also a bullet.** Parent `obj_collidebullet`; must be in
   the soul's collision set, must honour `active`, and must not be culled by the
   turn-end sweep of `obj_bulletparent`
   (`obj_battlecontroller_Step_0.gml:837-838`) before it has written
   `global.turntimer = -1`.

3. **Self-terminating turn.** No `scr_turntimer` exists in this fight.
   `global.turntimer = 999` (`:94`) is a sentinel; the leap drives it to −1
   (`obj_checkers_leap_Step_0.gml:84, 111, 337, 427, 500`) and
   `obj_battlecontroller_Step_0.gml:831-856` closes the turn. A default 90/120
   floor truncates all four attacks (they run ~125-175 frames). The
   `turnByChoice` numbers in `kround.json` are **hand-estimated** from the state
   machines, not read off any call, and should be used only as a safety cap.

4. **Unguarded dependencies.** `obj_growtangle` is dereferenced with no
   `instance_exists` check at `:7, :11, :196, :204, :215` — the landing height
   *is* the box floor, so a missing or wrongly-sized box changes the mechanics,
   not just the look. `obj_heart` likewise at `:58, :145, :278, :373`.
   `obj_regularbullet` self-destructs in Create if `obj_heart` is absent
   (`obj_regularbullet_Create_0.gml:12-13`). Also needed: `obj_shake`,
   `scr_afterimage`, `obj_afterimage`.

5. **Ch1's `obj_growtangle` is not Ch2's.** It has no `maxxscale`/`maxyscale`
   fields at all (`obj_growtangle_Create_0.gml:1-11`); it grows `image_x/yscale`
   from 0 to a hard-coded 2 over `maxtimer = 15` frames
   (`obj_growtangle_Step_0.gml:17-18`). Reusing a Ch2+ growtangle that reads
   `maxxscale` will put the floor in the wrong place.

6. **Boss-side state the dispatch block needs:** `attacktype` (persists across
   turns, mutated by the block itself — replay it *instead of* spawning, never in
   addition, or the `!instance_exists` guard swallows the spawn), `mytarget`
   (from `scr_randomtarget()` at `:16`; `scr_damage` re-rolls it if the target is
   down, `gml_GlobalScript_scr_damage.gml:16-17`), and `global.monsterat[myself]`.

7. **The milk turn is a turn REPLACEMENT.** `scon` 1 → 1.5 → 2 → 3 → 4 → 5 → (6)
   at `:135-301`, dialogue-gated on `obj_writer`, using `scr_dark_marker` +
   `spr_checkers_milk`, `obj_dmgwriter` type 3 and `obj_healanim`. No box, no
   soul, and it holds `global.turntimer = 999` while the text is up.

8. **Sprites and sounds are all present** in the Ch1 export. `spr_checkers_idle`
   (8f, 43×77), `spr_checkers_crouch` (1f, 48×84), `spr_checkers_leap` (3f,
   48×84), `spr_checkers_leg` (6f, 70×77 — the `image_index == 3` fire frame and
   the `>= 5` stop both depend on that count), `spr_checkers_magnificent` (5f,
   116×78 — `image_index >= 4` is its last frame), `spr_checkershrapnel` (1f,
   16×16, origin centred), `spr_checkers_bow` (6f), `spr_checkers_milk` (1f).
   Everything renders at `image_x/yscale = 2` (`Create_0.gml:33-34`, leap
   `Create_0.gml:4-5`); `Draw_0:37-53` hand-draws the idle at 2× with `siner / 3`
   as the frame index. Sounds: `snd_jump`, `snd_impact`, `snd_boost`,
   `snd_ultraswing`, `snd_swing`, `snd_magicsprinkle`, `snd_power` — all in
   `sounds.tsv`.

9. **No difficulty axis.** No `difficulty` field is written or read anywhere in
   this fight. The only variation between the two encounters is AT (7.5 vs 8) and
   the `secondtime` presets.

---

## 7. One naming loose end

The rematch's **Check** text is, verbatim from Ch2
(`obj_checkers_enemy_Step_0.gml:323`):

> `"* K.ROUND - AT 9 DF 3&* Watch out for its Flying King attack!/"`

"Flying King" is the only in-game name any K. Round attack has, and the code
does **not** bind it to a `leapmode` — it is a flat string in the Check branch,
not attached to a dispatcher arm. leapmode 1 (leap → hover → slam) and leapmode 2
(sails off the top of the screen) are both plausible referents. The roster
therefore uses descriptive names and records this rather than guessing.

The same line also reports "AT 9 DF 3" while `scr_monstersetup` gives AT 8 (type
21) and AT 7.5 (type 10) — hardcoded flavour text that ignores both the real stat
and the `+0.5` milk escalation.
