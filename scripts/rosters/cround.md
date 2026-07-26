# C. Round (ch1) — `obj_smallcheckers_enemy`

**Summary: 0 real attacks. 1 dispatcher entry, and it is unreachable.**

C. Round is not a bullet fight. It is the scripted ACT tutorial that plays when
Susie rejoins the party, and its enemy turn was deliberately gutted: the Step
event is a copy of the Hathy's with the attack spawn made unreachable and the
turn length cut to a single frame.

---

## 1. Identifying the enemy

The ch1 export stores monster names as lang keys, so the name has to be resolved
through the localised copy of the same script (Chapters 2–4 ship the same
`scr_monstersetup` with strings inline).

`gml_GlobalScript_scr_monstersetup.gml:237-267` — `global.monstertype[myself] == 9`:

| field | value | line |
|---|---|---|
| `global.monstername[myself]` | **`"C.Round"`** (`scr_monstersetup_slash_scr_monstersetup_gml_251_0`) | :239 |
| `monstermaxhp` / `monsterhp` | 10 / 10 | :240-241 |
| `monsterat` / `monsterdf` | 5 / 0 | :242-243 |
| `monstergold` / `sparepoint` / `mercymax` | 10 / 0 / 100 | :245-248 |
| act 0 | `"Check"` | :250 |
| act 1 (`actactor` 2 = Susie) | `"X-Compliment"` — only `if (scr_havechar(2))` | :258-262 |
| act 2 (`actactor` 3 = Ralsei) | `"Warning"` | :263-265 |

Name strings verified against `DELTARUNE Chapter 2/3/4 - GML/gml_GlobalScript_scr_monstersetup.gml`,
which carry the same table with literals: type 9 → `"C.Round"`, type 10 and 21 →
`"K.Round"` (`obj_checkers_enemy`), type 16 and 7 → `"Clover"` (`obj_clubsenemy`),
type 15 → `"Jigsawry"`. So of the candidate objects, **`obj_smallcheckers_enemy`
is C. Round and `obj_checkers_enemy` is K. Round** — not the other way round.

The object binding is `gml_GlobalScript_scr_encountersetup.gml:110-118`:

```gml
case 7:
    global.monsterinstancetype[0] = obj_smallcheckers_enemy;
    global.monstertype[0] = 9;
    global.monstermakex[0] = xx + 440;
    global.monstermakey[0] = yy + 150;
    global.monstertype[1] = 0;
    global.monstertype[2] = 0;
    global.battlemsg[0] = ...   // "* C. Round attacked violently!&
                                //  * (You recall Ralsei's advice to include Susie in an ACT.)"
```

Encounter 7 is the **only** place `obj_smallcheckers_enemy` is ever instantiated
(grepped across all of ch1). It is reached from
`gml_Object_obj_chaseenemy_Create_0.gml:52-59`:

```gml
if (room == room_field_getsusie)
{
    myencounter = 7;
    sprite_index = spr_smallchecker_front;
    ...
}
```

…and `gml_Object_obj_chaseenemy_Other_10.gml:14` (`global.encounterno = myencounter`).
`scr_monstersetup.gml:252-256` pushes `global.plot` to 40 on this encounter.

`objects.tsv:299` — `obj_smallcheckers_enemy`, sprite `spr_smallchecker_idle`,
parent `obj_monsterparent`, not persistent.

## 2. There is no dispatcher and no chooser

Every other ch1 enemy has the same shape: the boss Step spawns a controller and
sets `.type`. Rudinn, for reference
(`gml_Object_obj_diamondenemy_Step_0.gml:46-75`):

```gml
if (!instance_exists(obj_growtangle))
    instance_create(__view_get(e__VW.XView, 0) + 320, __view_get(e__VW.YView, 0) + 170, obj_growtangle);
...
rr = choose(0, 1);
if (rr == 0) { dc = instance_create(x, y, obj_dbulletcontroller); dc.type = 0; ... }
else         { dc = instance_create(x, y, obj_dbulletcontroller); dc.type = 1; ... }
turns += 1;
global.turntimer = 140;
```

C. Round's whole enemy turn, `gml_Object_obj_smallcheckers_enemy_Step_0.gml:34-67`:

```gml
if (global.mnfight == 2 && attacked == 0)          // :34
{
    with (obj_heartblcon)                          // :36
        instance_destroy();

    rtimer += 1;

    if (rtimer == 12)                              // :41
    {
        rr = scr_monsterpop();                     // :43
        global.turntimer = 1;                      // :44

        if (rr == 999)                             // :46
        {
            dc = instance_create(x, y, obj_spinheart);   // :48
            dc.type = 0;
            dc.target = mytarget;
            dc.damage = global.monsterat[myself] * 5;
        }

        turns += 1;
        attacked = 1;
        global.typer = 6;
        global.fc = 0;
        rr = choose(0);                            // :58
        if (rr == 0)
            global.battlemsg[0] = ...;             // :61
    }
    else
    {
        global.turntimer = 1;                      // :65
    }
}
```

Three things are missing relative to every other enemy: no `scr_moveheart()`, no
`obj_growtangle` creation (grep of all five of its event files finds neither
token), and no controller spawn that can execute.

### The one dispatcher entry is unreachable — `rr == 999`

`rr` is assigned on the immediately preceding line by `scr_monsterpop()`.
`gml_GlobalScript_scr_monsterpop.gml:1-4`:

```gml
function scr_monsterpop()
{
    return global.monster[0] + global.monster[1] + global.monster[2];
}
```

`global.monster[i]` is a 0/1 alive flag — this same file tests
`global.monster[myself] == 1` at `:10` and clears it with
`global.monster[myself] = 0` at `:192`. So `rr ∈ {0,1,2,3}` and **`rr == 999` can
never be true**. C. Round cannot spawn a bullet, ever.

That is not an accident of reading. This Step is a **copy of the Hathy's** with
the attack removed. `gml_Object_obj_heartenemy_Step_0.gml:57-78`:

```gml
if (rtimer == 12)
{
    rr = scr_monsterpop();
    global.turntimer = 140;

    if (rr == 1)
    { dc = instance_create(x, y, obj_spinheart);  dc.type = 0; ... }
    else
    { dc = instance_create(x, y, obj_heartshaper); dc.type = 0; ...
      if (global.encounterno == 9) global.turntimer = 100; }
```

| | Hathy (`obj_heartenemy`) | C. Round (`obj_smallcheckers_enemy`) |
|---|---|---|
| bullet guard | `if (rr == 1)` (:62) | `if (rr == 999)` (:46) — impossible |
| else branch | `obj_heartshaper` (:71) | **deleted** |
| turn length | `140`, or `100` on encounter 9 (:60, :77) | `1` (:44) |
| waiting turn length | `120` (:112) | `1` (:65) |
| soul + box | `scr_moveheart()` + `obj_growtangle` (:42-47) | **deleted** |
| speech bubble | creates `obj_heartblcon`, 4 sprite variants (:10-17) | only `instance_destroy()` (:36) |
| talk length | `talkmax = 90` (`Create_0:6`) | `talkmax = 5` (`Create_0:6`) |
| battle messages | `choose(0,1,2,3,4)` (:84) | `choose(0)` (:58) |
| no-damage hook | `obj_hathyfightevent` → `con = 15` (:120-133) | same lines copied verbatim (:73-86) |

So the real roster is empty, and the single dispatcher branch a scan can find is
cut content inherited from the copy source.

- **Used (0).**
- **Cut (1):** `rr == 999` → `obj_spinheart` `type 0`, `damage = monsterat * 5`
  (= 25). Guard is unsatisfiable by `scr_monsterpop`'s range.

### Turn length

`gml_Object_obj_smallcheckers_enemy_Step_0.gml:44` sets `global.turntimer = 1`
directly (ch1 predates `scr_turntimer`, same as Jevil's `global.turntimer = 240`).
`gml_Object_obj_battlecontroller_Step_0.gml:831-857` decrements it while
`global.mnfight == 2` and closes the turn at `<= 0`. The whole enemy turn is
5 frames of "talk" plus 12 frames of `rtimer` plus one — about **13 frames**, with
nothing on screen.

## 3. What the fight actually is: three ACT turn-replacements

`gml_Object_obj_battlecontroller_Step_0.gml:552` assigns
`global.monsterinstance[thisenemy].acting = global.bmenucoord[9][global.charturn] + 1`,
so `acting` is the act index plus one. All the fight's content hangs off that,
inside `if (global.myfight == 3)` at `Step_0:96-209`:

| `acting` | act | what runs |
|---|---|---|
| 1 | **Check** | one line (`:104`), `actcon = 1`, then `scr_attackphase()` (`:152-156`) — a normal turn follows |
| 2 | **X-Compliment** (Susie) | 12 dialogue lines (`:108-124`), `actcon = 5` → `obj_herosusie` `state = 1`, `points = 100 + round(random(40))` (`:164-179`), `trigger_event(0, 22)`. A scripted guaranteed hit; against 10 HP it ends the fight. `global.flag[211] = 1` (`:195`) |
| 3 | **Warning** (Ralsei) | 18 dialogue lines (`:126-150`), sets `global.monstercomment[myself]` and `global.automiss[0] = 1` (`:147-148`) → Susie's `points = 0` (`:171-172`), then `global.mercymod[myself] = 200` (`:184`) against `mercymax` 100 and `hspeed = 5`: C. Round is spareable and slides off. `global.flag[211] = 2` (`:200-204`) |

`Step_0:1-8` watches `obj_basicattack.sprite_index` for `spr_attack_cut1` /
`spr_attack_slap1` and sets `global.flag[211] = 3` — "you just attacked it".
`obj_npc_puzzlemaster1_Create_0.gml:20` reads that flag later
(`global.plot >= 42 || global.flag[211] == 3`), so the three endings are the
fight's actual output.

`Alarm_4` is one line, `actcon += 1;` — the dialogue/animation pacing.
`Other_22` (user event 12) is the standard `global.monsterx/y` + `scr_monstersetup()`.
`Draw_0:1-9` flips `global.monsterstatus[myself] = 1` (tired, spareable) at
`monsterhp <= monstermaxhp / 3`, i.e. at 3 HP or less.

## 4. Dead code worth flagging

- **`obj_hathyfightevent` no-damage hook** (`Step_0:73-86`). Copied verbatim from
  `obj_heartenemy_Step_0.gml:120-133` (and `obj_headhathy_Step_0.gml:125-138`).
  `obj_hathyfightevent` drives **encounter 9**, three `obj_heartenemy`
  (`obj_hathyfightevent_Step_0.gml:34-35`), sets `global.plot = 36`, and is not
  persistent (`objects.tsv:61`). Encounter 7 spawns one C. Round in
  `room_field_getsusie` and pushes plot to 40, i.e. after that scene. Treat this
  branch as unreachable in the shipped fight; ch1 room data is not in the export,
  so this is inference from the plot ordering and the encounter tables rather than
  from a room listing — the only low-confidence claim in this document.
- **`battlecancel`** (`Step_0:90-91`): initialised to 0 in `Create_0:29` and never
  written anywhere in the object.
- **`spr_smallchecker_crown` / `_transform` / `_transform2` / `_transform3`**
  belong to `obj_checker_animtest_Step_0.gml:277-417` and
  `obj_checkers_enemy_Step_0.gml:678` (the C. Round → K. Round promotion
  cutscene), not to this fight. C. Round's `Draw_0` only ever draws
  `spr_smallchecker_idle`, `_run` and `_hurt`, all at 2× scale.
- The `global.encounterno == 7` special-case inside **monstertype 6 (Hathy)**
  (`scr_monstersetup.gml:139-145`, `global.actactor[myself][2] = 2`) is a leftover:
  encounter 7 contains no Hathy. Evidence that encounter 7 used to be a Hathy
  fight, consistent with the copied Step.

## 5. Consequences for the studio

1. **`real` is empty and `boxBlock` is omitted on purpose.** There is no
   `obj_growtangle` anywhere in this object's five events, so there is no box
   block to slice; a "BOX BLOCK NOT FOUND" note would be misleading.
2. **`turnBlock` slices to the literal `global.turntimer = 1;`** (anchor
   `global.turntimer = 1;`, endAnchor `if (rr == 999)`; verified against
   `extractTurnBlock`'s matcher — the anchor passes the `/turntimer/` window test
   and resolves to `Step_0:44`, the first of the two occurrences, which is the one
   inside `if (rtimer == 12)`). The studio's 90-frame floor is wrong here by 89
   frames.
3. **`selectorScan` on `rr` is supplied deliberately** so the cut branch is
   inventoried rather than invisible. Simulated against `gen_attacks.js`'s scan
   logic: it yields exactly one entry — choice 999 → `obj_spinheart` type 0 — and
   skips the `rr == 0` battle-message hit because no controller follows it. Any
   `REAL[]` judge for this fight must return **false** for everything.
4. Launching that cut entry needs a soul and a box the fight never makes:
   `obj_spinheart_Create_0.gml:7-8` reads `obj_heart.x` / `obj_heart.y`.
5. Running the fight *as shipped* needs turn-REPLACEMENT support of the kind Pink's
   dates already required: an ACT driver for `acting` 1/2/3, an `obj_herosusie`
   attack stub honouring `points` / `global.automiss[0]`, the `obj_writer` gate
   that `actcon` 1/5/6/7 waits on, and `alarm[4]`.
