# Watercooler (ch3) — `obj_watercooler_enemy`

**Chapter used: 3.** Both chapters ship a watercooler-shaped enemy and I read
both. Chapter 3 has `obj_watercooler_enemy` (`objects.tsv`, sprite
`spr_watercooler`, parent `obj_monsterparent`), whose monster name is literally
`"Watercooler"` (`scr_monstersetup.gml:1701`). Chapter 4's is
`obj_holywatercooler_enemy` — a *different*, later enemy ("Holy Watercooler",
church area, its own `Alarm_6`/`Alarm_7` and `Draw_0`). Chapter 4 only reuses
the *bullet* object `obj_watercooler_bullet_rainball`. The fight called "the
Watercooler" is the chapter 3 one, so that is what this roster covers.

**Result: 1 real attack, 4 cut entries.** This is the smallest roster of any
fight documented so far, and the derivation is unusual because there is no
numeric selector at all.

---

## The dispatcher

There is exactly one, in `gml_Object_obj_watercooler_enemy_Step_0.gml:82-108`:

```gml
if (scr_isphase("bullets") && attacked == 0)
{
    rtimer += 1;

    if (rtimer == 12)
    {
        if (amimoonwarmer == false)
        {
            global.monsterattackname[myself] = "Rain";
            dc = scr_bulletspawner(x, y, obj_dbulletcontroller);
            dc.type = 135;
            dc.special = 0;

            if (turns > 1 && (turns % 2) == 0)
                dc.special = 1;
            else if (turns > 1)
                dc.special = 2;
        }
        else
        {
            global.monsterattackname[myself] = "Moon";
            dc = scr_bulletspawner(x, y, obj_dbulletcontroller);
            dc.type = 69;
            dc.special = 0;
        }

        scr_turntimer(140);
```

Two branches, selected by the **boolean** `amimoonwarmer` — not by a numeric
attack choice. So the "chooser" question reduces to: *can `amimoonwarmer` ever
be true?*

## Two decoy selectors

Before answering that, two variables have to be cleared out of the way, because
both look like choosers and neither is one.

**`myattackchoice` is dead.** `Create_0.gml:10` sets it to 1, and the enemytalk
block toggles it every turn (`Step_0.gml:18-21`):

```gml
if (myattackchoice == 0)
    myattackchoice = 1;
else
    myattackchoice = 0;
```

Nothing ever reads it. `grep myattackchoice` over
`gml_Object_obj_watercooler_enemy_*.gml` returns only those three write sites
plus the Create, and the only *cross-object* reads of `myattackchoice` anywhere
in chapter 3 target a different boss — `scr_damage.gml:99`, `scr_damage.gml:270`
and `scr_damage_maxhp.gml:78`, all `obj_knight_enemy.myattackchoice`. This is
the same vestigial-selector shape as Spamton NEO's `rr`, except here it was never
wired up in the first place.

**`rr` is dead for attack purposes too.** `Step_0.gml:32` increments it to pick
the enemy's balloon text (`rr == 1` gives "Buble", otherwise a randomised
"B~1b~2e"), and then `Step_0.gml:117` clobbers it outright:

```gml
rr = choose(0, 1, 2, 3, 4);
```

purely to select one of four battle messages at `Step_0.gml:123-133`. It never
touches the controller.

## The chooser: `amimoonwarmer`

`amimoonwarmer` is written in exactly two places in the entire chapter (grep over
all of `DELTARUNE Chapter 3 - GML` returns hits only in this object's Create and
Step):

`gml_Object_obj_watercooler_enemy_Create_0.gml:13-18`
```gml
amimoonwarmer = false;
...
if (global.encounterno == 140)
    amimoonwarmer = true;
```

`gml_Object_obj_watercooler_enemy_Step_0.gml:1-10`
```gml
if (_init == false)
{
    if (global.encounterno == 140)
    {
        amimoonwarmer = true;
        global.monstername[myself] = stringset("Moonwarmer");
    }

    _init = true;
}
```

Both gates are `global.encounterno == 140`. So the whole roster hinges on whether
encounter 140 is reachable.

### Encounter 139 is the real fight; 140 is unreachable

Both encounters exist and are byte-for-byte identical except the intro message
(`scr_encountersetup.gml:1228-1264`) — same `obj_watercooler_enemy`, same
`monstertype[0] = 58`, same positions, same `rank1turns = 4`:

- `case 139:` → `"* A strong aura emanates from the Watercooler."` (`:1244`)
- `case 140:` → `"* A strong aura emanates from the Moonwarmer."` (`:1263`)

Every launcher passes **139**:

| site | line |
|---|---|
| `obj_b3bs_watercooler_Step_0.gml` | `194: scr_battle(139, 0, watercooler);` |
| `obj_b3bs_zapper_b_Step_0.gml` | `217: scr_battle(139, 0, des);` |
| `obj_dw_teevie_watercooler_Step_0.gml` | `123: scr_battle(139, 0, des);` |
| `obj_dw_teevie_watercooler_Step_0.gml` | `215: scr_battle(139, 0, watermarker);` |
| `obj_room_ranking_c_Step_0.gml` | `51: encounterno = 139;` |

And nothing anywhere sets 140. A grep over every `myencounter = ` /
`encounterno = ` assignment in the chapter yields 1, 4, 12, 16, 50, 52, 110,
111, 113, 118, 125, 126, 131, 132, 133, 134, 135, 136, 500, 777 — never 140.
`obj_fusionmenu`'s dojo list is `{100, 72, 71, 89, 90}`
(`obj_fusionmenu_Step_0.gml:111-164`). The only other mention of 140 in the
chapter is `obj_testoverworldenemy_Other_10.gml:14`, choosing battle music.

The single way in is the debug `obj_battletester` (chapter 3 range
`encountermin = 110`, `encountermax = 999`, `obj_battletester_Create_0.gml:10-13`).

**Therefore `amimoonwarmer` is always false, and the Moonwarmer half of the object
— attack, name, all its battle messages, its `ActWarmer` rename, its CHECK text —
is cut content.**

## Real roster (1)

| # | type | name | controller | turn |
|---|---|---|---|---|
| 0 | 135 | **Rain** | `obj_dbulletcontroller` | 300 |

`obj_dbulletcontroller_Step_0.gml:2749-2761` spawns a single
`obj_watercooler_bullet_rainball` at the box centre and copies `special` onto it.

### The variant axis is `special`, driven by turn parity

Like the Roaring Knight's `difficulty`, one attack carries three authored
flavours. `turns` starts at 1 (`Create_0.gml:28`) and increments at
`Step_0.gml:110`, and `Step_0.gml:93-98` maps it:

| turn | `special` | behaviour | source |
|---|---|---|---|
| 1 | 0 | ball sits still at box centre | — |
| 2, 4, … | 1 | widening horizontal sweep, `x = xstart + sin(siner/10)*siner/10*side` | `rainball_Step_0.gml:97-101` |
| 3, 5, … | 2 | small circular wobble **plus** every live raindrop's angle sways by `sin(siner/20)*2` | `rainball_Step_0.gml:103-118` |

With `rank1turns = 4` (`scr_encountersetup.gml:1242`) the intended fight is four
turns, so all three specials are reachable in a normal playthrough.

### What Rain actually looks like

`obj_watercooler_bullet_rainball_Step_0.gml:5-33` — every `threshold` (3) frames
the ball spawns an `obj_regularbullet` on a circle of radius 150 around itself,
with `sprite_index = 857`. That is a **raw numeric sprite id**: `sprites.tsv`
line 859 with a header on line 1 means 0-based id 857 = `spr_raindrop`.

The raindrops fall **inward**: `mybulletspeed += mybulletgravity` (0.2) and
`mybulletdist -= mybulletspeed`, repositioned each frame from the ball
(`:56-59`). When a drop reaches the ball's edge —
`if (mybulletdist <= (0 + (other.sprite_width / 2)))`, `:61` — it is flagged for
destruction, splashes `spr_raindrop_splash`, and grows the ball by
`other.size += 0.05` (`:71`). The ball therefore gets steadily fatter and its
catch radius grows with it.

Aim: a rolling counter makes every 5th drop aim near the soul and every 6th
exactly at it, then resets (`:12-19`):

```gml
if (count == 4)
    bulletangle = heartangle + random_range(-30, 30);

if (count == 5)
{
    bulletangle = heartangle;
    count = 0;
}
```

Damage is 40 — `scr_bulletspawner.gml` sets
`damage = global.monsterat[myself] * 5` and monstertype 58 has AT 8
(`scr_monstersetup.gml:1704`).

## Cut (4)

| type / special | name | why unreachable |
|---|---|---|
| 69 | **Moon** | needs `amimoonwarmer`, i.e. encounter 140 — never selected (above). `Step_0.gml:100-106`. |
| 136 | Rain, twin rainballs | no writer exists |
| 135 special 3 | ball orbits the box | `special` never exceeds 2 |
| 135 special 4 | orbit + rotating raindrops | `special` never exceeds 2 |

**Type 136** (`obj_dbulletcontroller_Step_0.gml:2763-2784`) spawns *two* rainballs
at `box.x ± 50` with `side` −1/+1, `threshold = 7` and `amount = 2`. Nothing in
chapter 3 assigns `.type = 136` — the complete set of `type = 135/136/69` writes
is `obj_watercooler_enemy_Step_0.gml:92` (135), `:104` (69),
`obj_rouxls_ch3_enemy_Step_0.gml:2925` and `:2939` (69), plus two RoomCC files
for an unrelated board-dungeon object
(`gml_RoomCC_room_board_dungeon_3_21/22_PreCreate.gml`, `type = 135` on a
non-controller).

A knock-on: because `amount` stays 1, the rainball's ball-vs-ball collision code
is dead in the real fight —

```gml
if (amount > 1 && global.turntimer > 10)      // rainball_Step_0.gml:35
```

**Specials 3 and 4** (`rainball_Step_0.gml:120-141`) pin the ball to a 50px orbit
around `obj_growtangle` and drop `threshold` to 8; special 4 additionally rotates
every live raindrop by `1 * other.side` per frame. The only writer of a
rainball's `special` is the controller (`obj_dbulletcontroller_Step_0.gml:2757`,
`:2771`), and the only writer of the controller's `special` on the type 135 path
is `obj_watercooler_enemy_Step_0.gml:93-98`, which emits 0, 1 or 2.

Note that type 69 is **not** globally dead — Rouxls Kaard uses it
(`obj_rouxls_ch3_enemy_Step_0.gml:2925`, `:2939`). It is cut *for this fight*.

## Phases, HP gates, soul modes

None. No phase machine, no HP gate on attack selection, no green/purple/yellow
soul, no minigame, no turn replacement, no second enemy object. HP only affects
flavour text (`Step_0.gml:159`, "looks like it needs a refill" below ⅓ HP).

## Box block

`gml_Object_obj_watercooler_enemy_Step_0.gml:64-80`, inside `global.mnfight == 1.5`.
Anchor `if (!instance_exists(obj_growtangle))` (line 66, unique in file),
endAnchor `global.mnfight = 2;` (line 78, unique):

```gml
if (!instance_exists(obj_growtangle))
    instance_create(__view_get(e__VW.XView, 0) + 320, __view_get(e__VW.YView, 0) + 170, obj_growtangle);

if (amimoonwarmer == false)
    instance_create(obj_growtangle.x - 10, obj_growtangle.y + 18, obj_heartmarker);

if (!instance_exists(obj_moveheart))
    scr_moveheart();

with (obj_heartmarker)
    instance_destroy();
```

The box is never resized — it is the stock `obj_growtangle` with
`maxxscale = maxyscale = 2` (`obj_growtangle_Create_0.gml:13-14`).

**The heartmarker lines must stay in the slice.** `obj_heartmarker` has no event
files at all (it is a pure position marker, `objects.tsv:1408`, visible False).
`obj_moveheart_Create_0.gml:6-20` reads it:

```gml
if (instance_exists(obj_heartmarker))
{
    distx = obj_heartmarker.x;
    disty = obj_heartmarker.y;
}
...
else
{
    distx = obj_growtangle.x - 10;
    disty = obj_growtangle.y - 10;
}
```

So Rain spawns the soul at `box.y + 18` — *below* the rainball that occupies the
box centre — while the Moonwarmer branch deliberately skips the marker and falls
back to `box.y - 10`. Drop those four lines and the soul starts inside the ball.

## Turn block — layered, and load-bearing

`scr_turntimer` only ever **raises** (`scr_turntimer.gml:3-4`):

```gml
if (global.turntimer < arg0)
    global.turntimer = arg0;
```

and `global.turntimer` is otherwise only decremented once per step
(`obj_battlecontroller_Step_0.gml:1420`) or zeroed by `scr_turn_skip` /
`scr_gameover`. So the sequence is:

1. `Step_0.gml:79` — `scr_turntimer(200);` at `mnfight == 1.5`. **This is the
   turnBlock anchor** (line 79, unique in file; endAnchor `}` closes the
   `mnfight == 1.5` block on line 80).
2. `Step_0.gml:108` — `scr_turntimer(140);` fires 12 frames later, when
   `turntimer` is still ≈188. **No-op.**
3. `obj_watercooler_bullet_rainball_Create_0.gml:11` — `scr_turntimer(300);`
   when the ball is created. **Rain's real turn length is 300.**

Moon has no `scr_turntimer` anywhere on the type 69 path, so it would stay at 200.

The rainball reads `global.turntimer` twice, so getting this wrong is visible:
`Step_0.gml:35` (`> 10`, gates the twin-ball collision code) and
`Step_0.gml:79` (`< 10`, suppresses the splash animation at turn end so the
screen doesn't litter as the turn closes).

## The cut Moon attack, for completeness

`obj_dbulletcontroller_Step_0.gml:810-894`. Every 35 frames it drips an
`obj_bullet_submoon` from a 180px arc above the box, homing with
`turnrate = 6 - special` and accelerating via `scr_approach`.

Its damage model is a **special case worth knowing about** even though it never
runs — `obj_bullet_submoon_Other_15.gml:1-7`:

```gml
if (i_ex(obj_watercooler_enemy))
{
    with (obj_watercooler_enemy)
        event_user(2);
}
```

which routes into `obj_watercooler_enemy_Other_12.gml`, hitting **all three**
living party members for `round(global.maxhp[...] / 4)` each inside a single
invulnerability window. `obj_bullet_snow_Other_15.gml` carries the identical
hook, but snow belongs to type 70 (Rouxls) and never appears in this fight.

Two further dead paths inside type 69 as the Moonwarmer would call it:
`is_water` tests `instance_exists(obj_rainwater)`, and `obj_rainwater` is only
ever created by type 71 (`obj_dbulletcontroller_Step_0.gml:985`), so it is always
0; and the `special > 1` precipitation-shatter block (`:870-893`) never runs
because the Moonwarmer passes `special = 0`.

## What the studio needs to special-case

**Transpiler hazards, all in `obj_watercooler_bullet_rainball_Step_0.gml`:**

1. **Raw numeric sprite id.** `bulletsprite = 857` (`Create_0.gml:9`) is not a
   name. The sprite table must resolve integer ids. The raindrop identity test is
   `with (obj_regularbullet) { if (sprite_index == mybulletsprite) ... }` at
   `:48-50`, `:110-112` and `:133-135`, where `mybulletsprite` is a `var` local
   captured from the *enclosing* scope inside a `with` block.
2. **`destroybulletid` crosses a `with` boundary.** Declared `var` at `:3`,
   assigned from *inside* `with (obj_regularbullet)` at `:62`, read *after* the
   with at `:67`. These are GML script-scope locals, not instance vars. A
   transpiler that rebinds locals per with-instance breaks the splash/grow loop
   completely — the ball would never grow and drops would never despawn.
3. **`other.sprite_width` inside the with** (`:61`) refers to the *rainball*, and
   grows with `size`. The splash radius is dynamic, not constant.
4. `collision_rectangle(..., obj_regularbullet, false, 1)` at `:37` — only live
   when `amount > 1`, i.e. cut content, but it will still be transpiled.

**Enum hoisting.** The boss Step declares `enum e__VW` at the **bottom** of the
file (`Step_0.gml:445-464`) while the box block uses `__view_get(e__VW.XView, 0)`
at line 67. Same hoisting requirement as the Roaring Knight and Jevil slices.

**Launching the cut Moon variant** needs `amimoonwarmer = true` set on the *boss
instance* (or `global.encounterno = 140` before Create) — both the box block and
the dispatcher branch on it. There is no controller flag to set, unlike Jevil's
`joker = 1`, so no `controllerSet` entry applies. Moon also needs the enemy's
`Other_12` wired as the submoon hit handler, or damage silently falls back to the
controller's flat 55 per hit.

**Objects:** `obj_dbulletcontroller` (135; 69 for Moon),
`obj_watercooler_bullet_rainball`, `obj_regularbullet`, `obj_growtangle`,
`obj_heartmarker`, `obj_moveheart`, `obj_animation`; plus `obj_bullet_submoon`
and `obj_precipitation_bullet_parent` for the cut branch.

**Scripts:** `scr_bulletspawner`, `scr_bullet_inherit`, `scr_bullet_create`,
`scr_moveheart`, `scr_turntimer`, `scr_isphase`, `scr_lerpvar`,
`scr_script_delayed`, `scr_approach`, `scr_at_player`, `snd_play_x`.

No `selectorScan`, `extraAttackFiles` or `controllerSet` entries are needed: the
attack is announced and dispatched entirely inside
`obj_watercooler_enemy_Step_0.gml`, and the only per-turn parameter (`dc.special`)
is set by the dispatcher itself.

## ACTs (flavour only)

`Step_0.gml:191-436`. Check; BegForMercy (`global.flag[1119]`, unlocks
ActCool + Flirt on the second use — `Create_0.gml:30-31` pre-seeds
`begformercycount = 2` on replays); ActCool (+25 mercy, repositions the party
around the cooler with `spr_*_zoosuit_cup` sprites); Flirt (+10, or +14 if Susie
and Ralsei are both down; sets `global.flag[1144] = 1` for the Teevie curtain
scene); S-Action and R-Action (+6, or +10 if the other two are down). None of
them alter which attack fires.

## Confidence: high

The whole fight is 464 lines in one Step file plus one 143-line bullet object and
two controller branches, and I read all of it. The only judgement call is
counting Rain's three `special` values as one attack rather than three, which
follows the Knight-difficulty precedent in `REAL_FIGHT_ROSTERS.md`.
