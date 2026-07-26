# Yellow & Blue — ch5, `obj_blue_enemy` (+ `obj_yellow_enemy`)

**4 real entries, 2 cut.** This is the rare fight where the dispatcher does *not*
overcount: the chooser is a one-line strict round robin, so all four dispatcher
branches are reachable and the real roster equals the branch list. The
interesting work here is elsewhere — **only one of the two monsters ever
attacks**, two of the fight's turns are **turn replacements with no
announcement at all** (healing rain, courtroom trial), and the fight's **win
condition is a minigame**, not damage. There is also a large, plausible-looking
cluster of Blue/Yellow objects that is dev-template code and must be excluded.

---

## 0. Which fight this is, and which objects belong to it

`gml_GlobalScript_scr_encountersetup.gml:839-850` — **encounter 222**:

```
case 222:
    global.monsterinstancetype[0] = obj_blue_enemy;     // :840
    global.monstertype[0] = 115;                        // :841
    global.monstermakex[0] = xx + 466;                  // :842
    global.monstermakey[0] = yy + 40;                   // :843
    global.monsterinstancetype[1] = obj_yellow_enemy;   // :844
    global.monstertype[1] = 116;                        // :845
    global.monstermakex[1] = xx + 500;                  // :846
    global.monstermakey[1] = yy + 160;                  // :847
    global.monstertype[2] = 0;                          // :848
    global.battlemsg[0] = "* Yellow brings the gun's!&* Blue brings the elegance!"
```

Started from the overworld at `gml_Object_obj_ch5_DWCL03_Step_0.gml:527`:

```
scr_battle(222, 3, bluecopy, yellowcopy);
```

`gml_GlobalScript_scr_monstersetup.gml:455-465` (Blue, type 115) and `:469-480`
(Yellow, type 116) give both **2060 HP / AT 16 / DF 0 / 450 gold**, and — note —
**`sparepoint = 0`**, so neither can ever be spared by mercy.

There is exactly **one** Yellow & Blue battle in Chapter 5. `obj_ch5_LW20W_blue`,
`obj_dw_fcastle_yellowblue*`, `obj_plat_*blue*`/`obj_plat_*yellow*` and the
`obj_orangeheart_*` objects are overworld / platforming / other-fight objects with
no `obj_monsterparent` lineage in `objects.tsv`.

### The template cluster — excluded on evidence, not on name

The starting leads named `obj_enemy_blue_attack` and `obj_enemy_yellow_example`.
Both are dev testbeds. So is a third, `obj_enemy_blue_example`. The test that
settles it is *"does anything ever `instance_create` this?"*:

| object | parent in `objects.tsv` | created by | verdict |
|---|---|---|---|
| `obj_enemy_blue_boxspin` | `obj_bulletparent` | `obj_dbulletcontroller_Step_0.gml:3391` | **REAL** (type 302) |
| `obj_enemy_blue_flower_aim` | `obj_bulletparent` | `obj_dbulletcontroller_Step_0.gml:3403` | **REAL** (type 303) |
| `obj_blue_singing2` | `obj_bulletparent` | `obj_dbulletcontroller_Step_0.gml:3414` | **REAL** (type 304) |
| `obj_blue_guidelines` | `obj_bulletparent` | `obj_dbulletcontroller_Step_0.gml:3381` | **REAL** (type 301) |
| `obj_enemy_blue_example` | *(none)* | **nothing, anywhere** | template |
| `obj_enemy_yellow_example` | *(none)* | **nothing, anywhere** | template |
| `obj_enemy_blue_attack` | *(none)* | **nothing, anywhere** | template |
| `obj_attack_blue_ponddancing` | *(none)* | `obj_dbulletcontroller` types **129 / 130** only | cut (see §5) |
| `obj_attack_blue_flowerbullet` | *(none)* | `obj_enemy_blue_attack_Step_0.gml:48` only | template |
| `obj_attack_yellow_reticle` | *(none)* | **nothing, anywhere** — only existence-tested at `obj_attack_blue_ponddancing_Draw_0.gml:125` | template |
| `obj_attack_yellow_reticle_bullet` | `obj_regularbullet` | `obj_attack_yellow_reticle_Step_0.gml:26` only — i.e. by an object that is itself never created | template |

A chapter-wide grep for each name returns *only* references from inside the
cluster itself. `gml_Object_obj_enemy_blue_example_Create_0.gml:8` is the
giveaway — it makes its **own** battle box at hardcoded room coordinates with
no battle context at all, then pins its own position:

```
instance_create(320, 170, obj_growtangle);   // :8
xstart = 468;                                 // :9
ystart = 96;                                  // :10
```

Note the trap in the naming: `obj_enemy_blue_boxspin` and
`obj_enemy_blue_flower_aim` share the `obj_enemy_blue_*` prefix with the two
templates and are **real**. Prefix is not evidence; the creator is.

---

## 1. Only Blue attacks — `scr_attackpriority` decides it every turn

Both monsters run the same enemy-turn shape, but they contend for the turn.

`gml_Object_obj_yellow_enemy_Step_0.gml:8-9` (enemytalk):

```
myattackpriority = 0;
scr_attackpriority(myattackpriority - 1);       // → scr_attackpriority(-1)
```

`gml_Object_obj_blue_enemy_Step_0.gml:52-53` (enemytalk):

```
myattackpriority = 1;
scr_attackpriority(myattackpriority - 1);       // → scr_attackpriority(0)
```

`gml_GlobalScript_scr_attackpriority.gml` succeeds only on a **strict** increase:

```
if (obj_battlecontroller.attackpriority < arg0)
{
    obj_battlecontroller.attackpriority = arg0;
    return true;
}
else return false;
```

`obj_battlecontroller` seeds `attackpriority = -1` (`Create_0.gml:30`) and it is
reset to `-1` every turn (`scr_endturn.gml:114`, `scr_mnendturn.gml:28`).
Enemytalk therefore leaves it at **0**. Then at `global.mnfight == 1.5`:

* Yellow (`Step_0.gml:100`) calls `scr_attackpriority(0)` → `0 < 0` is false → **loses**.
* Blue (`Step_0.gml:104`) calls `scr_attackpriority(1)` → `0 < 1` is true → **wins**.

So Yellow's entire mnfight-1.5 block (`obj_yellow_enemy_Step_0.gml:98-111`) is
dead while Blue lives, and it would not matter if it ran: it makes a plain
camera-centred box, calls `scr_turntimer(90)`, and **spawns no attack**. Yellow's
bullets-phase block (`:113-162`) only bumps her own `turns` counter and writes a
battle message.

Confirming it from the other direction: a grep for `monsterattackname` across
the whole chapter finds **four** hits for this fight, all in Blue's Step
(`:162`, `:170`, `:178`, `:186`). `obj_yellow_enemy` never announces an attack
anywhere. That is why `enemy` is `obj_blue_enemy` and no `extraAttackFiles` are
needed.

---

## 2. The chooser — one line

`gml_Object_obj_blue_enemy_Other_11.gml` is a **one-line file**, and it is the
entire chooser:

```
myattackchoice = turns % 4;
```

It runs as `event_user(1)` from `gml_Object_obj_blue_enemy_Step_0.gml:51`, inside
the enemytalk block that opens at `:47`:

```
if (scr_isphase("enemytalk") && talked == 0)      // :47
{
    scr_randomtarget();
    setbattlemsg = false;
    event_user(1);                                 // :51  ← the chooser
    myattackpriority = 1;
```

`turns` is initialised by `gml_GlobalScript_scr_enemy_object_init.gml:6`
(`turns = 0;`), called from `gml_Object_obj_blue_enemy_Create_0.gml:1`. It is
incremented in exactly one place, `Step_0.gml:192`, *after* the attack has been
dispatched.

So the selector sequence is **0, 1, 2, 3, 0, 1, 2, 3, …** — deterministic, no
`choose()`, no `irandom`, no HP gate, no phase gate. `myattackchoice = -1` in
`Create_0.gml:10` is only a pre-first-turn placeholder; the chooser overwrites it
during enemytalk before `mnfight` ever reaches 1.5.

**Every value 0-3 occurs, and no other value can.** The real roster is therefore
the whole dispatcher.

---

## 3. The dispatcher — `obj_blue_enemy_Step_0.gml:154-195`

```
if (scr_isphase("bullets") && attacked == 0)                                    // :154
{
    rtimer++;
    if (rtimer == 12 && i_ex(obj_yellow_enemy) && obj_yellow_enemy.healingraincon == 0)   // :158
    {
        if (myattackchoice == 0) { "GuidedBullet";    dc.type = 301; scr_turntimer(300); } // :160-166
        if (myattackchoice == 1) { "Dancers";         dc.type = 302; scr_turntimer(270); } // :168-174
        if (myattackchoice == 2) { "ShootingGallery"; dc.type = 303; scr_turntimer(225); } // :176-182
        if (myattackchoice == 3) { "BlueSinging";     dc.type = 304; scr_turntimer(300); } // :184-190
        turns++;                                                                            // :192
        attacked = 1;                                                                       // :193
    }
}
```

Each branch is literally:

```
global.monsterattackname[myself] = "GuidedBullet";
dc = scr_bulletspawner(x, y, obj_dbulletcontroller);
dc.type = 301;
scr_turntimer(300);
```

Note two things the studio needs to know:

1. **Every turn length lives inside its own branch.** There is no separate
   ladder. The only out-of-branch call is the raise-only floor
   `scr_turntimer(90)` at `:150`.
2. **The whole dispatcher is gated on `obj_yellow_enemy.healingraincon == 0`**
   (`:158`), so on a healing-rain turn `turns` does **not** advance and the
   skipped attack plays next turn instead.

### The four real attacks

| choice | name | `dc.type` | turntimer | what the controller makes |
|---|---|---|---|---|
| 0 | `GuidedBullet` | 301 | 300 | `obj_blue_guidelines` at `camerax()+434, cameray()+181`, grazepoints 12 — `dbulletcontroller_Step_0.gml:3376-3385` |
| 1 | `Dancers` | 302 | 270 | `obj_enemy_blue_boxspin` at Blue's position with **`d.mode = 1`**, grazepoints 8 — `:3387-3397` |
| 2 | `ShootingGallery` | 303 | 225 | `obj_enemy_blue_flower_aim` at Blue's position — `:3399-3407` |
| 3 | `BlueSinging` | 304 | 300 | `obj_blue_singing2` at Blue's position, lerped to `camerax()+436` / `yanchor = cameray()+90`, grazepoints 6 — `:3409-3425` |

**GuidedBullet** builds a snaking chain of `obj_blue_guideline` segments that
homes toward the heart (`obj_blue_guidelines_Step_0.gml:3-32`, every 3 frames,
turning with `scr_ease_towards_direction`), sprinkling
`spr_enemy_blue_flower_reticle` markers every `12 - difficulty*3` segments; at
`timer == 32` (`:34-44`) it fires `obj_yellow_guided_bullet` down the path. It has
**no self-terminating condition** — the turn timer is what ends it.

**Dancers** slides Blue in as `obj_enemy_blue_boxspin`, widens the box, fires
rows of `obj_attack_blue_dancer_bullet` across the floor
(`Step_0.gml:43-69`), re-arms them on `alarm[3] = 40` (`:71`, and `Alarm_3` re-arms
itself at `:15`), and rocks `obj_growtangle.y` on a sine in `Step_2.gml:11-29` —
dragging `obj_heart` and every dancer bullet along with it.

**ShootingGallery** puts Blue at the top of the box as
`obj_enemy_blue_flower_aim` and fires volleys of three `obj_blue_flower_reticle`
at the heart's level, sweeping the shooter across the box
(`Step_0.gml:345-414`: volley → `event_user(0)` → `scr_lerpvar("x", …)` to
`scr_get_box(0)+16`, then to `scr_get_box(2)-16-100`, three passes at frames
27/31/35, 77/81/85, 127/131/135).

**BlueSinging** is the singing/petal attack: `obj_blue_singing2` draws three
112-segment sine waves (`Draw_0.gml:3-17`) and fires bullets on the wave, with
`scr_blue_petal_explosion` scheduled three times (`Step_0.gml:121/160/199`).

---

## 4. Two turns that are NOT attacks

### 4a. Healing Rain — a turn replacement

`gml_Object_obj_blue_enemy_Step_0.gml:106-107`, the **first** statement inside
Blue's `mnfight == 1.5` block:

```
if (i_ex(obj_yellow_enemy) && global.monsterhp[obj_yellow_enemy.myself] < (global.monstermaxhp[obj_yellow_enemy.myself] * 0.5) && obj_yellow_enemy.healingraincon == 0)
    obj_yellow_enemy.healingraincon = 1;
else if (!instance_exists(obj_growtangle))
    instance_create(__view_get(e__VW.XView, 0) + 320, __view_get(e__VW.YView, 0) + 170, obj_growtangle);
```

When Yellow is under half HP, Blue sets a flag **instead of making the box**.
On that turn:

* no `obj_growtangle` (the `else if` never runs),
* no `scr_moveheart()` — `:146` is gated on `healingraincon == 0`,
* no attack — `:158` is gated on `healingraincon == 0`,
* therefore **no `turns++`** (`:192` is inside that guard).

Yellow runs the beat herself, at top level in her Step (outside the
`global.monster[myself] == 1` wrapper), `obj_yellow_enemy_Step_0.gml:438-462`:

```
if (healingraincon == 1)
{
    with (obj_writer) instance_destroy();
    msgsetloc(0, "* BLUE cast HEALING RAIN on YELLOW!/%", …);   // :443
    scr_battletext_default();
    healingraincon = 2;
    idlesprite = spr_yellow_looksup;
    instance_create(obj_blue_enemy.x, obj_blue_enemy.y, obj_healing_rain);  // :447
}

if (healingraincon == 2)
{
    global.turntimer = 999;                                      // :452
    if (!instance_exists(obj_writer) && !i_ex(obj_healing_rain))
    {
        idlesprite = spr_yellow_idle;
        healingraincon = 0;
        global.turntimer = 2;                                    // :459
    }
}
```

`gml_Object_obj_healing_rain_Draw_0.gml:43-44` does the heal:

```
with (obj_yellow_enemy)
    global.monsterhp[myself] = global.monstermaxhp[myself];
```

…and the cloud destroys itself at `timer == 75` (`:59-60`). This can fire on
**every** turn that starts with Yellow under half HP.

**No `monsterattackname`, no controller, no `.type`.** An announcement scan
cannot see this turn at all — it is a turn replacement in the same sense as
Pink's dates.

### 4b. Yellow bodyguards Blue

`gml_Object_obj_heroparent_Step_0.gml:355-371` — when the player's attack
resolves:

```
if (i_ex(obj_blue_enemy) && i_ex(obj_yellow_enemy))
{
    if (global.chartarget[myself] == obj_blue_enemy.myself)
    {
        obj_yellow_enemy.x = obj_blue_enemy.x - 60;
        obj_yellow_enemy.y = obj_blue_enemy.y;
        global.chartarget[myself] = obj_yellow_enemy.myself;
        …
        with (obj_yellow_enemy) { blockcon = 1; blocktimer = 0; hurtsprite = spr_yellow_block; }
    }
}
```

Yellow snaps in front, eats the hit, and is unwound 30 frames later by
`obj_yellow_enemy_Step_0.gml:421-436`. Rude Buster has its own duplicate of the
same interception at `gml_Object_obj_rudebuster_anim_Step_0.gml:25-42`.

Combined with the healing rain, **Blue takes no damage and Yellow cannot be
whittled below half**. Damage is not the win condition.

### 4c. The trial — the actual win condition

Yellow's ACT 1 is **Justice**, installed by `yellow_justice_check`
(`obj_yellow_enemy_Create_0.gml:256-287`); it costs `justice_cost` (100, from
`Create_0.gml:18`) or is pinned to the greyed-out sentinel `2497.5` when the
EVIDENCE for the current trial is missing. Using it runs
`obj_yellow_enemy_Step_0.gml:182-242`, which creates `obj_yellow_trial_manager`
with `trial_id = trial_counter` and an `evidence_list` assembled from
`evidence_obtained[0..6]` (seeded from `scr_keyitemcheck` at `Create_0.gml:42-48`,
with an Annoying Dog fallback at `:230` and a bonus Egg at `:232-233`).

Blue's two ACTs feed it: ACT 0 **Evidence** hands out missing evidence
(`obj_blue_enemy_Step_0.gml:223-272` → `obj_yellow_enemy.gain_evidence()`,
defined at `Create_0.gml:77-224`), ACT 1 **Integrity** revives downed party
members for half the party's TP (`Step_0.gml:290-406`). ACT names and costs are
installed in `gml_Object_obj_blue_enemy_Other_22.gml`.

`gml_Object_obj_yellow_trial_manager_Create_0.gml:308-312` defines the trials,
and the perp enum at the tail of that file is
`0=Aqua, 1=Seth, 2=Green, 3=Blue, 4=Yellow, 5=Flowery` (mapped at `:2744-2768`):

| trial | case | culprit | `culprit:` line |
|---|---|---|---|
| 1 | a Floradinn crushed flat | **Seth** | `:269` |
| 2 | Yellow's shirt burnt black | **Green** | `:280` |
| 3 | Green's handkerchiefs stolen | **Aqua** | `:291` |
| 4 | Yellow's secret petals missing | **BLUE** | `:302` |

`wrong_accusation` (`:314-325`) does `fail_counter++`, `just_failed = true`, and
drops `justice_cost` to 50. `right_accusation` (`:531-540`) does
`just_succeeded = true`, `trial_counter = scr_approach(trial_counter, 3, 1)`,
`fail_counter = 0`. Those two counters drive the per-turn dialogue variants in
`obj_yellow_enemy_Step_0.gml:16-54` and the battle-message variants at
`:136-156`.

Convicting Blue in trial 4 runs `right_blue` (defined at `:1576`) and ends the
battle outright:

```
with (obj_battlecontroller)
    skipvictory = 2;      // :1801
scr_wincombat();          // :1803
```

The manager is **not** exclusive to this fight — `obj_flowery_enemy` reuses it
with `trial_id = 99` (`gml_Object_obj_flowery_enemy_Step_0.gml:2599-2611`), which
is exactly why `end_trial` (`:646`) and `begin_trial` (`:2719`) both branch on
`global.encounterno == 222`.

---

## 5. The cut list — dbulletcontroller types 129 and 130

Two `obj_dbulletcontroller` branches build Blue's **prototype** attack:

```
if (type == 129)                                    // :1568
{
    if (!made) { made = true; var d = instance_create(x, y, obj_attack_blue_ponddancing); d.type = 2; }
}

if (type == 130)                                    // :1578
{
    if (!made) { made = true; var d = instance_create(x, y, obj_attack_blue_ponddancing); d.type = 1; }
}
```

Why they can never be chosen:

* A chapter-wide grep for a `type` being assigned `129` or `130` returns **only
  the two branch tests themselves**. Nothing writes those values to a controller.
* The only writers of a controller `type` in this fight are
  `obj_blue_enemy_Step_0.gml:164 / 172 / 180 / 188` → `301 / 302 / 303 / 304`.
* `obj_attack_blue_ponddancing` has **no parent** in `objects.tsv`, unlike all
  three shipped Blue attack objects (`obj_bulletparent` children).
* `gml_Object_obj_attack_blue_ponddancing_Draw_0.gml` references
  `obj_enemy_yellow_example`, `obj_enemy_blue_attack` and
  `obj_attack_yellow_reticle` — the three parentless dev templates from §0. The
  whole prototype cluster hangs together and is reachable from live code *only*
  through these two branches.

Same status as Jevil's `jattack` 99/999: a dispatcher branch with no writer.

### Dead code *inside* the four shipped attacks

Worth knowing before speccing, because it is easy to spec an attack that never
actually plays:

**(a) `obj_enemy_blue_boxspin` mode 0 — Blue's revolver attack — never runs.**
The dispatcher pins `d.mode = 1` (`dbulletcontroller_Step_0.gml:3392`) and
`Create_0.gml:27` also defaults to `1`. The object's own `alarm[0]` is armed in
exactly one place, `Step_0.gml:36`, inside `if (mode == 0)`:

```
if (mode == 0)          // :33
{
    if (timer == 32)
        alarm[0] = 96;  // :36
}
```

(The other `alarm[0]` in that file, `:95`, is inside
`with (obj_attack_blue_dancer_bullet)` — a bullet's alarm, not the manager's.)
So `Alarm_0`, the `alarm[0] == 64` spin trigger at `:118-134`, the box-flip block
at `:136-162`, `obj_attack_blue_revolver_bullet`, `Alarm_1`, `Alarm_2`, the
`mode == 0` arm of `Step_2.gml:3-9`, and the `spr_blue_boxcover` draw in
`Draw_0.gml:3-4` are all unreachable.

**(b) `obj_enemy_blue_flower_aim` spread types 0/1/2 never run.**
`Create_0.gml:14` pins `spread_type = 3` and nothing in the chapter reassigns it
(grep: 1 write, 4 reads). `Step_0.gml:18-70`, `:72-158` and `:160-344` are dead;
only the three-volleys sweep at `:345-414` plays.

**(c) `obj_blue_singing2` mode 1 never runs.** `Create_0.gml:31` pins `mode = 2`,
so the mode-1 arms (`Step_0.gml:87-88`, `:210+`) are dead.

---

## 6. Box block and turn block

### boxBlock — `obj_blue_enemy_Step_0.gml:106-145`

```json
"anchor":    "if (i_ex(obj_yellow_enemy) && global.monsterhp[obj_yellow_enemy.myself] < (global.monstermaxhp[obj_yellow_enemy.myself] * 0.5) && obj_yellow_enemy.healingraincon == 0)",
"endAnchor": "if (!instance_exists(obj_moveheart) && obj_yellow_enemy.healingraincon == 0)"
```

Both strings occur **exactly once** in the file (verified by round-tripping
`gen_attacks.js`'s own `strip()` + `indexOf` logic: anchor at offset 4665,
endAnchor at 5940, 1249-char slice, braces balanced 7/7).

The anchor is the **healing-rain gate**, deliberately one statement earlier than
the growtangle creation. Anchoring on `if (!instance_exists(obj_growtangle))`
would match `:108` — where it appears as `else if (…)` — and silently drop the
gate, making the studio build a box on healing-rain turns that the real game
leaves empty.

The slice carries all four per-attack box tweaks, so one slice serves every
attack:

| choice | box change |
|---|---|
| 0 | `x -= 50` on the box **and** on `obj_heart` |
| 1 | `maxxscale = 3.5`, `y += 48` |
| 2 | `x -= 50`, `maxxscale = 3` |
| 3 | `maxxscale = 3` |

Every read of `obj_yellow_enemy` inside the slice is behind the
`i_ex(obj_yellow_enemy) &&` short-circuit. The **excluded** line `:146` is not —
which is one reason a Yellow stub is mandatory (§7.1).

### turnBlock — `obj_blue_enemy_Step_0.gml:150`

```json
"anchor": "scr_turntimer(90);",
"endAnchor": "}"
```

The bare `}` endAnchor is intentional and matches the `aqua_seth` precedent:
`scr_turntimer(90);` is the last statement of the `mnfight == 1.5` block, so the
next token is that block's closing brace at `:151` and the slice is the single
line. It resolves unambiguously because `indexOf` starts at the anchor.
`extractTurnBlock` requires `turntimer` within 80 chars of the match — the anchor
text itself satisfies that, so it locks onto `:150` (the first of the file's five
`scr_turntimer` calls) rather than one of the dispatcher's.

**That 90 is a floor, not the turn length.** `scr_turntimer` only raises. The real
values (300 / 270 / 225 / 300) are written inside their dispatcher branches, so
`gen_attacks.js`'s per-attack `setup` slice already carries them. Do **not**
re-anchor the turn block onto the dispatcher — that replays
`scr_bulletspawner` and doubles every controller (the documented Knight trap).

---

## 7. What the studio will need to special-case

1. **`obj_yellow_enemy` must exist as a positioned instance.** Two of the four
   attacks dereference it in Create, so they hard-error without it:
   `obj_enemy_blue_flower_aim_Create_0.gml:12-13`
   (`beam_x = obj_yellow_enemy.x; beam_y = obj_yellow_enemy.y + 46;`), plus its
   `Step_0.gml:11-16` / `:420-424` and `Alarm_0.gml:49-50`;
   `obj_blue_singing2_Step_0.gml:5-9` and `:26-30`; and
   `gml_GlobalScript_scr_blue_petal_explosion.gml:22-26`, which reads Yellow's
   x/y for **every** petal burst and feeds them to `obj_yellow_beam.setup()`
   (called three times from BlueSinging, `Step_0.gml:121/160/199`). A stub at
   `camera + (500, 160)` with a `myself` slot, `healingraincon = 0`, and
   `global.monsterhp` / `global.monstermaxhp` entries is enough.

2. **Turn length is load-bearing.** Three of the four attacks read
   `global.turntimer` to schedule their exit:
   `obj_enemy_blue_boxspin_Step_0.gml:105` (`<= 30`, dancer flies home),
   `obj_enemy_blue_flower_aim_Step_0.gml:416` (`<= 20`),
   `obj_blue_singing2_Step_0.gml:24` (`<= 30`). At the studio's 90-frame floor
   all three fire their ending on frame one. GuidedBullet is the exception — it
   has no self-terminating condition and depends entirely on turn-end cleanup.

3. **The box is written from outside.** `obj_blue_guidelines_Create_0.gml:4-8`
   sets `obj_growtangle.image_xscale/image_yscale = 2.5` **directly**, bypassing
   the `maxxscale` grow animation. `obj_enemy_blue_boxspin_Step_0.gml:19-22`
   lerps `image_xscale` 3.5→3.6 and `image_yscale` 2→1.85 (fighting the
   `maxxscale = 3.5` set in the box block). `Step_2.gml:11-29` moves
   `obj_growtangle.y` on a sine every frame and drags `obj_heart` and every
   dancer bullet with it, re-clamping via `scr_get_box(0..3)`. The engine needs a
   growtangle whose `x` / `y` / `image_xscale` / `image_yscale` are externally
   writable, plus `scr_get_box` and `scr_afterimagefast` on it.

4. **Natives used:** `scr_fire_bullet`, `scr_bullet_init`, `scr_bullet_inherit`,
   `scr_bulletspawner`, `scr_darksize`, `scr_lerpvar`, `scr_script_delayed`,
   `scr_script_repeat`, `scr_var`, `scr_var_delay`, `scr_approach`,
   `scr_ease_towards_direction`, `scr_afterimagefast`, `scr_doom`,
   `scr_get_box`, `ds_list_*`, `instance_create_depth`,
   `point_direction`/`point_distance`/`lengthdir_*`, `d_line_width_color`.
   `obj_yellow_beam` needs its Create-defined
   `setup(x1, y1, x2, y2, width, width_goal, circle_width, beam_lifetime, circle_lifetime)`
   method (`Create_0.gml:18-30`). `obj_blue_flower_reticle` converts
   `xgoal`/`ygoal` into speed+direction in `Other_10.gml:1-2`.
   `obj_blue_singing2_Draw_0.gml:3-17` draws up to 3 × 112 `d_line_width_color`
   segments per frame — a per-frame cost worth watching.

5. **No soul-mode change.** Plain RED soul throughout
   (`scr_moveheart()` at `obj_blue_enemy_Step_0.gml:146-147`). No green / purple /
   yellow soul controller is created anywhere in either enemy.

6. **Three of the four attacks hide the boss.**
   `obj_enemy_blue_boxspin_Create_0.gml:4-5`,
   `obj_enemy_blue_flower_aim_Create_0.gml:3-4` and
   `obj_blue_singing2_Create_0.gml:6-7` each set
   `obj_blue_enemy.visible = false` and adopt its depth (and, for boxspin, its
   `image_index`). A studio that draws the boss unconditionally will double-draw
   Blue.

7. **Two turns the bullet engine cannot model at all**: the courtroom trial
   (`obj_yellow_trial_manager` — 2790-line Create plus Step/Draw/Alarm/CleanUp,
   `obj_trial_perp`, key-item evidence via `scr_keyitemcheck`,
   `obj_balloon_queue` / `msgset_add` balloons, `obj_face`, and
   `spr_kris_lawyer` / `spr_susie_lawyer` / `spr_ralsei_lawyer` battle-sprite
   swaps) and the healing-rain turn. Both are turn **replacements** — no
   `monsterattackname`, no controller, no `.type` — so an announcement scan can
   never find them, and each needs a bespoke driver. The trial is also the
   fight's **only** win condition
   (`obj_yellow_trial_manager_Create_0.gml:1803`), so a damage-only harness will
   never end this battle.

---

## Summary

| | |
|---|---|
| dispatcher entries | 4 |
| **real** | **4** — GuidedBullet (301), Dancers (302), ShootingGallery (303), BlueSinging (304) |
| **cut** | **2** — `obj_dbulletcontroller` types 129 / 130 (`obj_attack_blue_ponddancing` prototype) |
| chooser | `obj_blue_enemy_Other_11.gml:1` — `myattackchoice = turns % 4;` |
| phases / HP gates on attack choice | none |
| HP gate elsewhere | healing rain at Yellow < 50% max HP (`obj_blue_enemy_Step_0.gml:106`) |
| soul modes | RED only |
| turn replacements | healing rain, courtroom trial |
| confidence | **high** — the chooser is one deterministic line, all four branches verified in `obj_dbulletcontroller`, both anchors round-tripped through the generator's own slicing logic |
