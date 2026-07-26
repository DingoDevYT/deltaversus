# The Chaos King (ch1) — `obj_king_boss`, chooser in `Step_0:90-121`

**11 of 11 dispatcher branches are real. Nothing in the dispatcher is cut.**

This is the opposite of every fight in `REAL_FIGHT_ROSTERS.md`. The Knight ships
20 branches and plays 7; the King ships 11 and plays all 11, because his
dispatcher was written for a *fixed script*, not a chooser. The cut content is
one level down — inside the chain/bouncer objects the dispatcher spawns.

## a. The enemy objects

| object | refdata | what it actually is |
|---|---|---|
| `obj_king_boss` | `spr_chainking_idle`, parent `obj_monsterparent` | **the fight.** The only enemy. |
| `obj_chainking` | `spr_chainking_spin`, parent `obj_bulletparent` | per-attack chain-thrower spawned by 5 of the 11 branches; makes `obj_wavechain` / `obj_finalchain` / `obj_chain_of_hell` |
| `obj_king_body` | `spr_chainking_spin`, no parent | **a debug attack tester, not a phase** — see below |
| `obj_kingcutscene` | `spr_event` | the 3595-line cutscene director that *starts* encounter 40 |

`gml_GlobalScript_scr_encountersetup.gml:430-438`:

```gml
case 40:
    global.monsterinstancetype[0] = obj_king_boss;
    global.monstertype[0] = 25;
    global.monstermakex[0] = xx + 460;
    global.monstermakey[0] = yy + 70;
    global.monstertype[1] = 0;
    global.monstertype[2] = 0;
```

Monstertype 25 (`gml_GlobalScript_scr_monstersetup.gml:611-620`): **HP 2800,
AT 8, DF 0, mercymax 999**, three party ACTs.

`obj_kingcutscene` starts it (`gml_Object_obj_kingcutscene_Step_0.gml:948-953`):

```gml
global.encounterno = 40;
scr_encountersetup(global.encounterno);
...
instance_create(0, 0, obj_encounterbasic);
```

**There is no second bullet phase in the cutscene.** Grepping that file for
`obj_dbulletcontroller|obj_chainking|obj_growtangle|turntimer` returns nothing;
its only bullet-ish lines are `scr_marker(..., spr_spadebullet_chunk)` decor at
lines 608, 662, 1364-65, 1487, 1579, 1643, 1797, 2077-78. The "chained phase"
you would expect from the object list is not a phase — it is attacks 2/5/6/10/11
of the one fight, where the King goes `visible = 0` and hands the screen to
`obj_chainking`.

### `obj_king_body` is a debug harness

`gml_Object_obj_king_body_Step_0.gml:1`:

```gml
if (keyboard_check(vk_enter) && active == 1 && scr_debug())
```

Everything in that object is behind that gate. It re-implements the same 11
attacks with `faketimer`/`faketimermax` instead of `global.turntimer`, assigns
no `damage` and no `target` at all, and has its own chooser
(`king_body_Step_0.gml:6-9`):

```gml
if (attackno <= 11)
    attack = attackno;
else
    attack = choose(7, 8, 9, 10, 11);
```

Two of its branches contradict the real fight: its attack 4 uses
`damagebox.type = 0` (`:50`) where the fight uses 5, and its attack 6 uses
`chainking.subtype = 2` (`:70`) where the fight uses 5. **Do not derive the
roster from it.** It is listed in the cut section so nobody mistakes it for a
phase later.

## b. The chooser

Ch1 predates `monsterattackname` (grep confirms: zero occurrences anywhere in
Chapter 1), so this is the Jevil dialect — a numeric selector assigned in the
boss Step and dispatched in a user event. The selector is `attack`; the
dispatcher is `event_user(5)` = `gml_Object_obj_king_boss_Other_15.gml`.

`gml_Object_obj_king_boss_Step_0.gml:90-121` — **the whole chooser**:

```gml
kturn += 1;

if (kturn <= 11)
{
    attack = kturn;
}
else
{
    if (kturn == 12)
        attack = 7;

    if (kturn == 13)
        attack = 8;

    if (kturn == 14)
        attack = 10;

    if (kturn == 15)
        attack = 9;

    if (kturn == 16)
        attack = 7;

    if (kturn == 17)
        attack = 11;

    if (kturn >= 18)
        attack = 11;

    if (global.monsterdf[myself] > -25)
        global.monsterdf[myself] -= 5;
}
```

`kturn = 0` at `Create_0:38`. It is incremented once per turn, immediately
before `attack` is read, so **turn N plays attack N for N = 1..11**, then
12→7, 13→8, 14→10, 15→9. There is no `choose()`, no HP gate, no difficulty
variable. The only HP read in the whole object is cosmetic
(`Step_0:168-169`, it swaps a battle message at ≤ 1/4 HP).

### Where the fight stops

`Step_0:84-88`:

```gml
if (kturn >= 14)
{
    global.msg[0] = scr_84_get_lang_string("obj_king_boss_slash_Step_0_gml_49_0");
    battlecancel = 2;
}
```

The message block reads `kturn` *before* the `kturn += 1` on line 90, so this
fires on **turn 15** — the turn that then dispatches `attack = 9`. When that
turn's clock runs out (`Step_0:177-193`):

```gml
if (global.turntimer <= 1)
{
    if (battlecancel == 1)
        global.mercymod[myself] = 999;

    if (battlecancel == 2)
    {
        with (obj_battlecontroller)
            noreturn = 1;

        con = 1;
        battlecancel = 3;
    }
}
```

`con = 1` → `con = 4` → `con = 5` (`alarm[4] = 15`) → `con = 6`, which runs
`global.flag[247] = 1; scr_monsterdefeat(); event_user(10); instance_destroy();`
(`Step_0:196-218`). **The fight is exactly 15 turns long and always ends the
same way.** `kturn` can never reach 16, which is what makes ladder slots 16, 17
and ≥18 dead.

## c. Chooser → roster

| turn | kturn after ++ | attack | controller (+ selector) | box | turntimer |
|---|---|---|---|---|---|
| 1 | 1 | 1 | `obj_dbulletcontroller` type 21 | growtangle | 190 |
| 2 | 2 | 2 | `obj_chainking` type 1 **subtype 0** → `obj_wavechain` | **nonsolid** | 999 |
| 3 | 3 | 3 | `obj_dbulletcontroller` type 34 | growtangle | 210 |
| 4 | 4 | 4 | `obj_growtangle_bouncer` type 5 | growtangle (`spr_battlebg_2`) | 999 |
| 5 | 5 | 5 | `obj_chainking` type 1 **subtype 1** → `obj_wavechain` | **nonsolid** | 999 |
| 6 | 6 | 6 | `obj_chainking` type 2 **subtype 5** → `obj_finalchain` | **nonsolid** (`spr_battlebg_1`) | 999 |
| 7 | 7 | 7 | `obj_dbulletcontroller` type 35 | growtangle | 220 |
| 8 | 8 | 8 | `obj_growtangle_bouncer` type 3 | growtangle (`spr_battlebg_2`) | 999 |
| 9 | 9 | 9 | `obj_dbulletcontroller` type 23 | growtangle | 200 |
| 10 | 10 | 10 | `obj_chainking` type 1 **subtype 2** → `obj_wavechain` | **nonsolid** | 999 |
| 11 | 11 | 11 | `obj_chainking` type 2 **subtype 1** → `obj_finalchain` | **nonsolid** (`spr_battlebg_1`) | 999 |
| 12 | 12 | 7 (repeat) | | | |
| 13 | 13 | 8 (repeat) | | | |
| 14 | 14 | 10 (repeat) | | | |
| 15 | 15 | 9 (repeat) — **last turn** | | | |

`turntimer` values are the ones the branch itself assigns
(`Other_15:15, 35, 47, 66, 80, 105, 119, 141, 150, 174, 189`). The `999` entries
are park values: the chain and bouncer objects write `global.turntimer = 3`
themselves when they finish
(`obj_wavechain_Step_0` at `t >= tmax`, `obj_finalchain_Step_0` in the
`ended == 1` block, `obj_growtangle_bouncer_Other_12`).

Damage, from `Other_15`: attacks 1/3/4/7/8/9 → `monsterat * 5 * tempattack`
(= 40), chain waves 2/5/10 and the drag 6 → `* 4` and `* 5` (32 / 40),
attack 11 → `* 3` (24, but it is the longest and densest).

### The five families

**Side spades — attacks 1 (type 21) and 9 (type 23).**
`obj_dbulletcontroller_Step_0.gml:384-431`. Spades alternate between the left
(`viewX + 80`) and right (`viewX + 560`) screen edges at a random y inside the
growtangle, speed 5 with `friction = -0.1` so they accelerate across.
`bmax = 9` for type 21, `7` for type 23. Both get `dd.btimer = -8`
(`Other_15:14, 153`), a 17/15-frame lead-in past Create's `btimer = 99`.

**Sky chains — attacks 3 (type 34) and 7 (type 35).**
`obj_dbulletcontroller_Step_0.gml:700-763`. Every 28 / 22 frames an
`obj_skychain` enters from a random edge; it homes at the soul once on Create
and then flies straight with `friction = -0.3`, trailing `obj_fadechain`.
**Source bug, replay verbatim:** type 34's line is
`scr_bullet_inherit(255);` (`:727`) where type 35 correctly passes `chain`
(`:759`) — so attack 3's chains keep `obj_skychain`'s own `damage = 50` /
`target = 0` instead of the King's 40 / `mytarget`.

**Bouncing box — attacks 4 (type 5) and 8 (type 3).**
`obj_growtangle_bouncer_Step_2.gml`. The bouncer *is* the box: its tail block
writes `obj_growtangle.x/y = x/y` every step and reflects off an inset
rectangle, playing `snd_bump` + `snd_screenshake` + `obj_shake` on each wall
hit. Type 5 = 30px inset, top speed 4, 170 frames; type 3 = 50px inset,
heading jittered ±20°, top speed 4.4, 170 frames, faster decel. Grazing the
walls adds `timer += 2` (i.e. it *shortens* the attack).

**Chain waves — attacks 2, 5, 10 (`obj_chainking` type 1 → `obj_wavechain`).**
`obj_chainking_Step_0.gml:33-34, 40`. The King goes invisible, throws a chain
left across the screen; when it reaches the nonsolid box it *locks* to it
(`chaincon = 2.1`, a 12→0 shake) and then swings the whole box up and down on a
sine while spades stream in from `viewX - 20`. Subtype selects the tempo:

| subtype | swing | spade gap | attack |
|---|---|---|---|
| 0 | `sin(siner / 12) * 80` | 20f | 2 |
| 1 | `sin(siner / 10) * 80` | 18f | 5 |
| 2 | `sin(siner / 9) * 80` | 16f | 10 |
| 3 | `sin(siner / 7) * 80 * wavefactor` | 14f | **never dispatched** |

Fixed length `tmax = 220`, with a 10-frame fade-out.

**Chain drags — attacks 6 and 11 (`obj_chainking` type 2 → `obj_finalchain`).**
Red chain (`image_blend = c_red`). It locks the nonsolid box the same way, then
`type >= 1` grows a `spr_battlebg_spikes` wall inside it
(`obj_regularbullet_permanent`, mask = the box sprite) and teleport-drags the
box to random points 100–140px away, holding `maxmove` frames each. Attack 11
(subtype 1) *also* satisfies `type <= 1`, which builds a 5×5 grid of
`obj_regularbullet_permanent` spades that track the soul and slowly scale up
until `image_xscale >= 0.68` ends the attack — that closing ring is unique to
attack 11.

**Quirk worth preserving:** `obj_finalchain_Create_0` runs
`type = 1; maxtimer = 200; if (type == 1) maxtimer = 300;` and
`obj_chainking_Step_0:40` only assigns the real `.type` *after* the instance
exists — so **`maxtimer` is 300 for every finalchain regardless of subtype.**

## d. The cut list

Nothing in the King's own dispatcher is cut. Everything below is one layer down.

| what | where | why it can never happen |
|---|---|---|
| kturn slots **16, 17, ≥18** (→ attacks 7, 11, 11) | `Step_0:110-117` | `battlecancel = 2` at `Step_0:87` fires on turn 15 and `Step_0:184-191` destroys the boss when that turn's clock expires. kturn stops at 15. |
| `obj_finalchain` **type 2** (attack 6's repeat form) | `Other_15:97-98` | Guarded by `chain_dragging >= 1`. `chain_dragging` starts at 0 (`Create_0:47`) and is only incremented at `Other_15:100`, inside the `attack == 6` branch. `attack` is set to 6 in exactly one place — `Step_0:94` at kturn 6 — and the kturn ≥ 12 ladder only emits 7, 8, 10, 9, 7, 11. **Attack 6 fires once per battle, so subtype 5 is the only value that ships.** |
| `obj_chainking` **type 0** → `obj_chain_of_hell` | `obj_chainking_Step_0.gml:30-31` | The King only assigns `chainking.type = 1` (`Other_15:22, 74, 162`) or `2` (`Other_15:94, 183`). `grep -rn obj_chain_of_hell` over all of Ch1 finds only this creation site + the object-name table — the whole path-driven chain object is dead in the shipped game. |
| `obj_wavechain` **type 3** | `obj_wavechain_Step_0.gml` | Subtype only ever 0/1/2 (`Other_15:23, 75, 163`). Nothing else in Ch1 creates an `obj_wavechain`. |
| `obj_finalchain` **types 0, 3, 4** | `obj_finalchain_Step_0.gml` (maxd / maxmove ladders) | Only subtypes 5 and 1 ship. Type 0 additionally fails the `type >= 1` spike gate — a bare dragged box with nothing in it. |
| `obj_growtangle_bouncer` **types 0, 1, 2, 4** | `obj_growtangle_bouncer_Step_2.gml` | The fight assigns only 5 (`Other_15:63`) and 3 (`Other_15:138`). Type 0 is reachable **only** in the debug harness (`king_body_Step_0.gml:50`). 1, 2 and 4 have no assigner anywhere in Ch1. |
| `obj_dbulletcontroller` **type 36** | `dbulletcontroller_Step_0.gml:764-795` | A third, 16-frame copy of the 34/35 sky-chain code. `grep -rn '\.type = 36;'` over Ch1 returns nothing. (Sibling **type 25**, the bmax-4 side-spade variant, is real but it is **Jevil's** — `obj_joker_Other_15.gml:203`.) |
| `battlecancel == 1` (spare-out ending) | `Step_0:181-182` | `battlecancel` is only ever written 0 / 2 / 3. Dead. |
| **`obj_king_body`** (whole object) | `king_body_Step_0.gml:1` | `scr_debug()`-gated ENTER-key attack tester. See section (a). |

## e. Generator wiring

```json
"selectorScan": { "file": "gml_Object_obj_king_boss_Other_15.gml", "varName": "attack" },
"turnBlock":    { "file": "gml_Object_obj_king_boss_Step_0.gml",
                  "anchor": "global.turntimer = 180;", "endAnchor": "event_user(5);" },
"boxBlock":     null
```

**Anchors verified** by running `gen_attacks.js`'s own `strip()` +
`extractTurnBlock()` matching logic over the file: `global.turntimer = 180;`
occurs **exactly once** (index 4237 of the stripped source, i.e. `Step_0:148`),
`event_user(5);` occurs **exactly once** (index 4273, `Step_0:149`), and the
slice is exactly `global.turntimer = 180;`.

This is the Jevil shape verbatim — a flat baseline assigned immediately before
`event_user(5)`, with the per-attack values inside `Other_15` meant to win. The
studio's raise-only guard (`gml_studio.html:1890-1893`) already handles that.
Strictly the block is optional here (every branch assigns its own timer), but it
keeps the 90-frame floor from applying if a setup replay ever fails.

**`boxBlock` is deliberately null.** `grep -n growtangle
gml_Object_obj_king_boss_Step_0.gml` returns *nothing* — Ch1 has no shared
box-setup block, and each of the 11 branches builds its own arena inside
`Other_15`, five of them out of a completely different object
(`obj_nonsolid_growtangle`). Any boxBlock would double-create the box.

I ran the generator's `selectorScan` logic against `Other_15` to confirm what it
produces. It finds exactly 11 hits, `attack == 1` … `attack == 11`, in file
order, every branch braced and 313–707 chars, so **`setup` is captured verbatim
for all 11** and `attacked == 0` on line 1 does not false-match. But:

```
choice  1 ctrl obj_growtangle    type  21   key chaosking|obj_growtangle|21
choice  2 ctrl obj_chainking     type   1   key chaosking|obj_chainking|1
choice  3 ctrl obj_growtangle    type  34   key chaosking|obj_growtangle|34
choice  4 ctrl obj_growtangle    type   5   key chaosking|obj_growtangle|5
choice  5 ctrl obj_chainking     type   1   key chaosking|obj_chainking|1  <<< COLLIDES
choice  6 ctrl obj_chainking     type   2   key chaosking|obj_chainking|2
choice  7 ctrl obj_growtangle    type  35   key chaosking|obj_growtangle|35
choice  8 ctrl obj_growtangle    type   3   key chaosking|obj_growtangle|3
choice  9 ctrl obj_growtangle    type  23   key chaosking|obj_growtangle|23
choice 10 ctrl obj_chainking     type   1   key chaosking|obj_chainking|1  <<< COLLIDES
choice 11 ctrl obj_chainking     type   2   key chaosking|obj_chainking|2  <<< COLLIDES
```

## f. What the studio has to special-case

1. **Dedupe-key collision — the blocker.** `gen_attacks.js:529` keys on
   `${boss}|${controller}|${type}`, and the id at `:537` is
   `${boss}_type${type}`. For the King the discriminator is **`subtype`**, not
   `type`: three attacks are `obj_chainking` type 1 and two are type 2. As shown
   above the current key folds 11 attacks into 8 (choices 5 and 10 disappear
   into 2; 11 disappears into 6). The key and the id both need `subtype` (or,
   for ch1 `selectorScan` bosses, `choice`).

2. **Controller mis-detection.** The scan's controller regex takes the *first*
   `instance_create` in the window, and six King branches (1, 3, 4, 7, 8, 9)
   create the **box** first — so `controller` comes out `obj_growtangle` rather
   than `obj_dbulletcontroller` / `obj_growtangle_bouncer`. Harmless while the
   `setup` replay succeeds (the studio only uses `controller` to pick `mainInst`
   afterwards, `gml_studio.html:1796-1805`), but it makes `mainInst` the battle
   box, and the manual fallback at `:1806-1832` would spawn a growtangle *as the
   controller* if a replay ever errors.

3. **Suppress the default-box pre-create.** `gml_studio.html:1785-1789` creates
   an `obj_growtangle` at (320, 170) whenever none exists yet — for other bosses
   the boxBlock replay has already made one. King has no boxBlock, so it fires
   and then the setup replay creates a **second** box for attacks 1/3/4/7/8/9,
   and an unwanted visible growtangle *alongside* the nonsolid box for
   2/5/6/10/11. It must be skipped when the roster declares `boxBlock: null`.

4. **`obj_nonsolid_growtangle` is the arena for five attacks and the studio has
   never heard of it** — `grep nonsolid_growtangle docs/gml_studio.html` returns
   zero hits. `syncGrowtangle()` (`:1658-1662`) only looks for `obj_growtangle`,
   so `runtime.growtangle` and `centreSoulOn()` aim at the wrong box and the
   soul spawns outside the playfield. Worse, `obj_wavechain` and
   `obj_finalchain` address `obj_nonsolid_growtangle.x/.y` **directly every
   step** and move it — the soul clamp has to follow that instance, and the box
   is *supposed* to fly around the screen.

5. **`obj_heartmarker` is missing.** Six branches do
   `hm = instance_create(box.x - 10, box.y - 10, obj_heartmarker); scr_moveheart();
   with (hm) instance_destroy();`. It has **no events at all** (Ch1
   `objects.tsv`: sprite `spr_diamondbullet_form`, visible `False`), which is
   why `gen_objects.js` skipped it — but the class must still be instantiable or
   those branches throw. Everything else the fight needs is already in
   `docs/js/gml_objects.js` `ch1`: `obj_chainking`, `obj_wavechain`,
   `obj_finalchain`, `obj_chainpiece`, `obj_skychain`, `obj_fadechain`,
   `obj_growtangle_bouncer`, `obj_nonsolid_growtangle`, `obj_regularbullet`,
   `obj_regularbullet_permanent`, `obj_moveheart`, `obj_shake`,
   `obj_dbulletcontroller`, `obj_king_boss`.

6. **`global.invc` must exist and be reset per launch.** `Other_15:3` does
   `global.invc = reminvc;` *outside* the branches, so the setup replay never
   restores it, and attacks 4/6/8/11 each do `global.invc *= 1.5`. Re-launching
   one of those compounds the multiplier forever.

7. **Let the attack own the box position.** `obj_growtangle_bouncer` sets
   `obj_growtangle.megakeep = 1` on Create and then writes `obj_growtangle.x/y`
   every step; `obj_wavechain` / `obj_finalchain` do `with (obj_growtangle)
   megakeep = 1` too. Nothing may re-centre the box after the attack starts.

8. **`with` over an absent class must be a no-op.**
   `obj_growtangle_bouncer_Other_12` (= `event_user(2)`, the bouncer's exit)
   opens with `with (obj_king_body) active = 1;`, and `obj_king_body` will never
   exist in the studio. Same for `obj_chainking_Destroy_0`'s
   `with (obj_king_boss) { visible = 1; active = 1; }` if the boss is absent.

9. **Boss Create must run.** The setup slices read `xx`/`yy` (`Create_0:39-40`,
   the view origin), `mytarget = 3` (`:31`), `tempattack = 1` (`:41`),
   `chain_dragging = 0` (`:47`) and `reminvc` (`:43`), and the chain branches use
   the boss's own `x`/`y` as the chain's launch point.

## g. Not needed

No `controllerSet` (there is no Jevil-style `joker = 1` flag — the ch1
`obj_dbulletcontroller` types 21/23/34/35 are ungated). No
`extraAttackFiles` (nothing outside `Other_15` announces a King attack). No
soul-mode switch, no green/purple/yellow soul, no minigame, no turn
replacement. `tempattack` (0.8 after Ralsei's ACT, `Step_0:262`) is the only
per-turn modifier, and it resets to 1 at `Other_15:197`.
