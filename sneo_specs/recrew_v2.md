# Spamton NEO — RECREW / "Spam Mail" (rr = 6) — v2 fine-fidelity extraction

Source: `DELTARUNE Chapter 2 - GML`. Objects: `obj_sneo_wall_controller_new` (the real rr=6
attack), `obj_sneo_wallbullet_new` (tile + speed engine), `obj_sneo_rotatingwall_bomb` +
`obj_mettaton_bomb_hitbox` (bombs), `scr_sneo_wall_create` (pattern DSL). The legacy
`obj_sneo_wall_controller` (type 3, sine motion) is the **difficulty 9 / hell** variant only
(dispatched at `obj_sneo_bulletcontroller_Step_0.gml:582`). All screen coords are GM y-DOWN
(row 0 = top). GML y-up note does not apply — RECREW motion is purely horizontal (x only).

---

## 0. Dispatch chain (how rr=6 gets here)

- `gml_Object_obj_spamton_neo_enemy_Other_10.gml` picks the attack per `phaseturn`:
  - **phaseturn 2 → `rr=6, difficulty=0`** (line 22-26) = the EASY first-time version.
  - **phaseturn 12 → `rr=6, difficulty=1`** (line 91-96), then `phaseturn=7` (loops back). = HARD looped version.
  - rr=6 is **only ever paired with difficulty 0 or 1** in normal play. diff 2/3 exist in the
    controller but are reachable for rr=6 only via `difficultydebug`.
- `gml_Object_obj_spamton_neo_enemy_Step_0.gml:835-840` — rr==6 spawns
  `obj_sneo_bulletcontroller` with `dc.type = 6`; name = "RECREWColumns".
- `:912-913` — `if (rr == 6) scr_turntimer(330)` → the attack lasts **330** turntimer frames.
- `gml_Object_obj_sneo_bulletcontroller_Step_0.gml:577-587` — type 6, `init==1`:
  `if (difficulty == 9) instance_create(obj_sneo_wall_controller)` **else**
  `instance_create(obj_sneo_wall_controller_new)`.

---

## 1. CAR / WALL DECELERATION — the real per-frame speed curve

Per-column horizontal speed lives in `obj_sneo_wall_controller_new.wallspeed[wallnumber]`
(one entry per wall). Every tile does `x += wallspeed[wallnumber]` each step
(`gml_Object_obj_sneo_wallbullet_new_Step_0.gml:4-5`). Negative = moving LEFT toward the box.

The **leader tile** (row 0, `wallcontroller = 1`, set in `..._new_Step_0.gml:20-21`) is the only
one that runs the timer and overwrites `wallspeed[wallnumber]`. The curve is selected by
`walltype[wallnumber]` (`gml_Object_obj_sneo_wallbullet_new_Step_0.gml:7-28`):

**walltype 1** (used by **diff 0 and diff 1** — every RECREW wall in normal play):
```
timer < 16 :  wallspeed = lerp(-21, -5, timer/15)      // FAST -21 → decel to -5 over 15 frames
timer < 90 :  wallspeed = lerp(-5, -13, (timer-15)/70) // then RE-ACCELERATES -5 → -13 over 70 frames
```
So a wall enters at **-21 px/frame**, brakes hard to **-5 px/frame** by frame 15 (this is the
"slows down inside the box" the wiki/user describe), then quietly speeds back up to **-13 px/frame**
by frame 85 and holds -13. Not constant, not accelerating-from-slow — it's decel-then-reaccel.

**walltype 0** (default; used by diff 2, diff 3, and the terminating "clear" wall):
```
timer < 9   : wallspeed = lerp(-16, -6, timer/9)       // -16 → -6 over 9 frames
timer < 150 : wallspeed = lerp(-6, -6, (timer-9)/130)  // constant -6 thereafter
```
Enter at **-16**, brake to **-6** over 9 frames, then hold **-6** flat.

Initial `wallspeed[a] = -7` (`..._controller_new_Create_0.gml:49`) is only the value before the
leader's first step overwrites it. Porter fix: speed is **per-wall, time-based lerp**, starting
FAST and braking — not constant and not ramping-up.

---

## 2. DIFFICULTY VARIANTS (0 easy → 3 hard)

Selected in `obj_sneo_wall_controller_new_Create_0.gml`. Args to `scr_sneo_wall_create` are
`(row1, row2, row3, row4, row5, spacing_frames, walltype)` where the 5 row codes fill rows 1..5
(codes: 0=solid mail, 1=gap, 2=crew, 3=bomb, 4=red-crew). `spacing_frames` = frames until this
wall spawns after the previous (`wallcreatetimer`).

| diff | source lines | walltype/curve | cadence (spacing) | tile mix | role |
|------|-------------|----------------|-------------------|----------|------|
| **0** | :61-168 | all `walltype=1` (-21→-5→-13) | wide: 1, 30, 40, 6 | hand-authored; only 0/1/2/3 (solid, gap, **crew**, **bomb**). NO red-crew | **EASY first-time** (phaseturn 2). ~13 scripted walls chosen from 3 random layout sets, ends `create(1,1,1,1,1,9999,0)` = all-gap clear wall |
| **1** | :170-331 | all `walltype=1` | tighter: 1, **20**, **32**, 6 | hand-authored; 0/1/2/3 only, denser wave count | **HARD looped** (phaseturn 12→loops). 4 random layout sets × ~3-4 walls each = ~16 walls, same clear wall terminator |
| **2** | :385-401 | `walltype=0` (-16→-6 const) | fast: **7** (burst) & **63** (pause) | fully random per row `choose(2,2,1,1,1,4,3,0)` — includes **red-crew(4)** & bomb(3), crew-heavy | random gauntlet; 6+1+5+1+5 = 18 walls |
| **3** | :403-419 | `walltype=0` | fast: 7 & 63 | random `choose(2,2,1,1,1,3,0)` — bomb yes, **NO red-crew** | random gauntlet, 18 walls |
| 99 | :333-383 | `walltype=1` first two, rest `0` | 1,7,63,60,50 mixed | hand-authored dense gauntlet w/ red-crew | not used by rr=6 normal |

Key easy-vs-hard deltas: diff 0 = walltype-1 braking curve + WIDE 30/40-frame gaps + scripted
readable gap paths + no red-crew. diff 1 = same curve but 20/32-frame gaps and more waves.
diff 2/3 = walltype-0 (faster steady -6) + 7-frame bursts + fully random dense fills. The port
built the diff-2/3-style dense/fast version; the first-encounter attack is diff 0.

---

## 3. BOMB tiles — `obj_sneo_rotatingwall_bomb`

Spawned where a row code = **3** (pipispot), at `..._controller_new_Step_0.gml:38-42`
(spawn x = camera right edge, y = row·34 offset, `wallnumber` inherited). Moves left with the
wall (`..._bomb_Step_0.gml:4-5`). `destroyable = 0`, `bighitbox = 1`, `element = 6`,
`damage = global.monsterat[myself]*5` (`..._bomb_Create_0.gml:6-12`).

Lifecycle (`..._bomb_Step_0.gml` + `..._Collision_obj_yheart_shot.gml`):
1. **Player shoots it** → `timer==0` branch: `snd_play(snd_damage)`, `timer = 1`,
   `image_speed = 1` (starts spinning), `snd_loop(snd_bombfall)`. Shooting ARMS it; it does not die.
2. Each step while `timer>0`, `timer++`.
3. **`timer == 6`**: `snd_play(snd_bomb)`, stop bombfall, sprite → `spr_mettaton_bomb2`,
   spawn `obj_shake`, and spawn a **CROSS of two hitboxes**:
   - `hitbox1`: `image_xscale = 500, image_yscale = 0.5` → full-width **HORIZONTAL** beam.
   - `hitbox2`: `image_xscale = 0.2, image_yscale = 500` → full-height **VERTICAL** beam.
4. **`timer == 12`**: `instance_destroy()`.

So: shooting a bomb triggers a **6-frame fuse → full-screen cross laser (horizontal + vertical)**
centered on the bomb, which persists ~6 frames (12-6), then the bomb vanishes. The visual beam is
drawn in `..._bomb_Draw_0.gml:3-11` (tiles `spr_mettaton_bomb3` at ±24·i, i=1..23, all 4 directions).

`obj_mettaton_bomb_hitbox` (`Create_0`, `Step_0`, `Other_15`): sprite `spr_hitbox_10px_center`,
`element=6`, `damage = monsterat*5`, `grazed=1`, lives **3 frames** (`Step_0:3-4 timer==3 destroy`),
deals damage on heart contact (`Other_15`: `scr_damage()` / `scr_damage_all` if target==3).
Porter fix: the bomb is a **delayed cross-explosion armed by shooting it**, not an on-contact pop —
don't shoot bombs unless you can clear the cross; damage = monsterAT×5 both from bomb body and beams.

(Note: `obj_sneo_rotatingwall_pipis` — the 12-way radial diamond burst — is a DIFFERENT object used
by rr=5, not spawned by RECREW. Red-crew destroy loop references it but no pipis spawn in rr=6.)

---

## 4. THE "HOLES" BUG — exact fill per column, one intended path

Row loop is 7 rows, `i = 0..6` (`..._controller_new_Step_0.gml:8`). **Rows 0 and 6 are always the
solid frame** and are NOT part of the code args:
- row 0 = `spr_sneo_bullet_box`, becomes the leader (`wallcontroller=1`), `destroyable=0`.
- row 6 = `spr_sneo_wall_car` (the visual car), spawned at x-50, y offset -180, `destroyable=0`.

**Rows 1..5 are the fillable lanes**, and each `scr_sneo_wall_create(a,b,c,d,e, …)` maps
`a→row1, b→row2, c→row3, d→row4, e→row5` (via arrays in `scr_sneo_wall_create.gml`). The dispatch
in `..._controller_new_Step_0.gml:35-72` per lane:

| code | array set | result | passable? | destroyable |
|------|-----------|--------|-----------|-------------|
| **0** | none | `spr_sneo_mail` solid brick | **NO — hard wall** | 0 (indestructible; shot = `snd_bell` bounce) |
| **1** | emptyspot | nothing spawned = **GAP** | **YES** | — |
| **2** | breakspot | `spr_sneo_crew` (blue), img_speed .5 | only after you shoot it | 1 |
| **3** | pipispot | `obj_sneo_rotatingwall_bomb` | via cross-detonate | (bomb, see §3) |
| **4** | redbreakspot | `spr_sneo_crew` blend `c_red`, `red=1` | shoot = clears WHOLE column | 1 |

There is **no randomness in solidity** — every lane of every wall has a defined fill. The intended
path through a wall is exactly the lane(s) marked code 1 (gap) or the crew/bomb you're meant to
shoot. Solid mail (code 0) is a **hard, indestructible wall** — the port's "random holes that let
you pass without shooting" is a bug: unspecified lanes must be **solid mail (0)**, not gaps. Only
explicit emptyspot(1) lanes are passable without shooting. Red-crew(4) shot: the yheart_shot
collision (`..._new_Collision_obj_yheart_shot.gml:11-33`) loops all `obj_sneo_wallbullet_new`
sharing `wallnumber` and destroys them (whole column clears with `snd_bomb` per tile).

Example diff-0 wall `scr_sneo_wall_create(0,2,3,0,0,30,1)`: row1=solid, row2=crew, row3=bomb,
row4=solid, row5=solid — exactly one crew + one bomb, everything else a hard wall.

---

## 5. Wall geometry / assets / damage / SFX

- **Rows**: `wallsize = 7` (rows 0-6). Row 0 top frame(leader), rows 1-5 fill, row 6 = car.
- **Vertical pitch**: `i * 34` px. Base y = `cameray_view + HView/2 + i*34 - 172`
  (`..._controller_new_Step_0.gml:12`). Car row uses `-180` and `x-50` (`:25`).
- **Spawn X**: `camerax() + camerawidth()` = right edge of battle view (`camerawidth = WView`,
  the box view width ≈ 640). Walls travel left (negative wallspeed).
- **Sprites**: box `spr_sneo_bullet_box` (xs 1.25, ys 1.6); car `spr_sneo_wall_car` (xs 1.25, ys 1.6,
  depth-1); mail `spr_sneo_mail` (xs **1.2**, ys **1.71**); crew `spr_sneo_crew` (img_speed .5, ys 1.2).
- **Track/road**: `..._controller_new_Draw_0.gml` — 3× `spr_sneo_wall_track` at
  `y = cameray+cameraheight-180`, scroll **+4 px/frame**, wrap by **-960** px.
- **Damage**: all hazard tiles (mail-crew, bomb, bomb hitbox, crew) =
  `global.monsterat[obj_spamton_neo_enemy.myself] * 5`. `element = 6`, `grazepoints = 2`.
- **Attack duration**: `scr_turntimer(330)`. Controller wallcountmax = 35.
- **SFX**: crew/mail destroyed = `snd_bomb` (pitch 1.1+random .2); indestructible mail shot =
  `snd_bell`; bomb armed = `snd_damage` + loop `snd_bombfall`; bomb detonate = `snd_bomb`;
  red-crew column clear = `snd_bomb` per tile; DEF-up cutscene = `snd_cardrive`.

---

## Key file:line index
- Speed curve: `gml_Object_obj_sneo_wallbullet_new_Step_0.gml:7-28`
- Diff select / patterns: `gml_Object_obj_sneo_wall_controller_new_Create_0.gml:61 / 170 / 385 / 403`
- Tile dispatch / geometry: `gml_Object_obj_sneo_wall_controller_new_Step_0.gml:6-77`
- Pattern DSL (arg→row map): `gml_GlobalScript_scr_sneo_wall_create.gml:1-86`
- Bomb: `gml_Object_obj_sneo_rotatingwall_bomb_Step_0.gml:1-27`, `..._Collision_obj_yheart_shot.gml`, `..._Draw_0.gml`
- Bomb hitbox: `gml_Object_obj_mettaton_bomb_hitbox_{Create_0,Step_0,Other_15}.gml`
- rr=6 dispatch: `gml_Object_obj_spamton_neo_enemy_Step_0.gml:835-913`; phase select `..._Other_10.gml:22-96`
- type6→controller: `gml_Object_obj_sneo_bulletcontroller_Step_0.gml:577-587`
