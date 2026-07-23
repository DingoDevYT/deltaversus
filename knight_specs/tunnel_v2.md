# Roaring Knight — SWORD TUNNEL (attack type 153) — FINE re-extraction

Source: `DELTARUNE Chapter 3 - GML`. GML angles are **y-up** (0=right, 90=up, 180=left, 270=down; increasing angle = counter-clockwise).
Board reference object = `obj_growtangle` (bullet board); `obj_growtangle.y` = board center Y. `obj_heart` = player soul.

## Object wiring (what actually spawns what)

- `obj_dbulletcontroller` type 153 → creates **`obj_sword_tunnel_manager`** at (`obj_growtangle.x`, `cameray()`), sets `.difficulty`, `.damage`, then `event_user(0)`.
  - `gml_Object_obj_dbulletcontroller_Step_0.gml:2936-2950`
- `obj_knight_enemy` picks it (myattackchoice 13, name "sword tunnel new"): `type=153`, `difficulty=<enemy difficulty>`, `damage=62`, `global.invc=0.14`.
  - `gml_Object_obj_knight_enemy_Step_0.gml:509-517`
- Manager spawns **`obj_sword_tunnel_sword`** (sprite `spr_knight_diamondbullet_l`) in top/bottom pairs each tick.
- On finale each sword, when it reaches the heart, spawns **`obj_sword_tunnel_hitbox`** (invisible line hitbox).
- Manager Create also spawns `obj_knight_swordtunnelanim` (the Knight point/pose + leaf ambience visual; not a bullet).
- NOTE: `obj_knight_diamondswordbullet_ext` and `obj_bullet_knight_tunnelslash` named in the task are a DIFFERENT/older attack — type 153 does NOT use them. The real chain is manager → `obj_sword_tunnel_sword` → `obj_sword_tunnel_hitbox`.

The swords are **NOT** darksized (scr_darksize only applies to the anim pose). `spr_knight_diamondbullet_l` = 3 frames, 99x32 px, origin (49,15); swords draw at `image_index=2` (frame 3), `image_xscale=1`, `image_yscale` animated (see speeds).

---

## 1. THE GAP (top wall + bottom wall + passable opening)

Every spawn tick two swords are created symmetric about `swordy` (= the gap CENTER, initialized to `obj_growtangle.y`):
`gml_Object_obj_sword_tunnel_manager_Step_0.gml:24-29` (straight mode 0):
```
top    = instance_create(swordx, swordy - 50 - (gapsize/2), sword); top.image_angle = 270
bottom = instance_create(swordx, swordy + 50 + (gapsize/2), sword); bottom.image_angle = 90
```
- `swordx = camerax()+camerawidth()+20` (Create:9) — spawns just off the RIGHT edge, travels LEFT.
- Each sword is offset `50 + gapsize/2` from center → **vertical distance between the two sword origins = 100 + gapsize** (default gapsize 45 → 145 px center-to-center). The clear passable opening is the band around `swordy` between the two blades. `image_angle 270/90` only sets the vertical visual orientation of the blade; the sword still MOVES along `mydirection` (180 = left) in straight mode.
- VISUAL: the swords ARE the walls — a top column pointing up (angle 270) and a bottom column pointing down (angle 90), the sprite drawn full-size with a 10-sample motion smear (`Draw_0:21-22`). The gap is simply the empty vertical space between the two rows; there is no separate "gap sprite." The port must render BOTH rows and leave the `100+gapsize` band empty.

### Gap-center motion (exact) — `Step_0.gml:105-141`
Each spawn tick, `swordy` shifts by `verticalchange` in `movedirection`:
- `movedirection == "up"` → `swordy -= verticalchange`; `"down"` → `swordy += verticalchange`; `"none"` → hold.
- A run counter: after `setcount = choose(2,3,4)` moving sets (or `waitsetcount = choose(1,2,3)` still sets while "none"), it flips: up/down→"none", "none"→choose("up","down"). (mode 2 uses `setcount=choose(4,6,8)`, `waitsetcount=choose(2,4,6)`; mode 2 volley `choose(6,10,12)`/`choose(6,8,12)`.)
- Clamp at switch: if `swordy < obj_growtangle.y-20` force "down"; if `swordy > obj_growtangle.y+20` force "up". So the gap center wanders only within roughly board-center ±(20 + one step).
- `verticalchange` per difficulty (event_user(0)): diff0=10, diff1=10, diff2=7, diff3=dynamic (see below), diff4=10.

---

## 2. ROTATING VARIANT (the key mechanism) — `Step_0.gml:44-103`

`sworddirection` starts at **180** (Create:13). In rotating modes the WHOLE tunnel axis is built around `sworddirection` and it increments every spawn tick, so the entire wall+gap slowly sweeps a 360° arc **counter-clockwise** (angle increases).

Spawn cadence = `rate = 4` frames (timer resets to 0 at `Step_0:150` each time `timer>=rate`).

- **tobymode 2 (difficulty 2):** `sworddirection += 4` per spawn (`Step_0:67`) = **4°/spawn = 1°/frame**. Full 360° = 90 spawns = **~360 frames ≈ 6.0 s**.
- **tobymode 3 (difficulty 3):** `sworddirection += 8` per spawn (`Step_0:102`) = **8°/spawn = 2°/frame**. Full 360° = 45 spawns = **~180 frames ≈ 3.0 s** (faster), PLUS a pulsing gap + volley (below).

Sword placement in rotating modes (mode 2, lines 46-66; mode 3 lines 79-101):
```
sx = lengthdir_x(swordxrel, sworddirection+180)   // swordxrel = 340 (Create:11)
sy = lengthdir_y(swordxrel, sworddirection+180)
syadd = lengthdir(swordy - growtangle.y, sworddirection+270)   // gap-center offset, perpendicular
sgap  = lengthdir(gapsize, sworddirection+270) * 2             // half-gap, perpendicular to axis
top    at (_xx+sx - sgapx + syaddx, _yy+sy - sgapy + syaddy); image_angle = sworddirection+270
bottom at (_xx+sx + sgapx + syaddx, _yy+sy + sgapy + syaddy); image_angle = sworddirection+90
each: sword.mydirection = sworddirection   // swords FLY inward along the rotating axis
```
`_xx,_yy` = board center (`obj_growtangle.x/y`). So the pair emerges 340 px out along `sworddirection+180`, gap perpendicular, both flying along `sworddirection`. As `sworddirection` climbs, the entry point orbits the board CCW.

Launch kinematics in rotating modes:
`speedproportion = lerp(1, 0.8, abs(lengthdir_y(1, sworddirection+180)))`
`sword._speed = -8 * speedproportion; sword._gravity = 2 * speedproportion` (starts pulled back, then accelerates in — capped at `_maxspeed=30`).
Mode 3 additionally: `sword._gravity = ((2*speedproportion) - (verticalchange/15)) * tobyvolleymodeinitspeed`.

---

## 3. FINALE (red warning lines → swords FLY across) — `obj_sword_tunnel_sword_Step_0.gml:9-68`, `Draw_0.gml`

Trigger: when `finishtimer == finishtimermax` the manager sets `con=1` and `with (obj_sword_tunnel_sword) con=1` (`manager_Step_0:12-18`). `finishtimermax = 230` (**250 if enemy difficulty==3**, Create:2-6). So the tunnel runs ~230 frames, then EVERY sword currently alive on the board begins the finale simultaneously.

**HOW MANY LINES:** one telegraph line PER live sword. Swords spawn in pairs every 4 frames and live until they exit the board, so at finale time there are roughly **20–30 swords on screen simultaneously**, i.e. ~20–30 red warning lines strung all over the box at their individual angles — NOT one. (The port draws only 1; it must draw one per sword.)

Per-sword finale timeline (`con==1`, local `timer`, `c=10`):
- `timer==1`: `_gravity=0`, `telegraph=1` (begin red line).
- `timer < 15` (`10+c/2`): rotate `image_angle` toward `obj_heart` (+ per-sword random offset `randx=-20..20`, `randy=-20..20`), `anglespeed` lerp 8→0. Each sword AIMS at the soul.
- `timer < 20` (`10+c`): `_speed` lerp → 0 (swords stop moving).
- `timer 21..24` (`11+c`..`15+c`): tiny pull-back (`_speed=2` backward along `image_angle+180`); play `snd_knight_jump` (vol 1, pitch 0.8).
- `timer 25..29` (`15+c`..`20+c`): frozen (no movement) — the hold/tell.
- `timer==30` (`20+c`): afterimage burst (`scr_afterimage_grow`).
- `timer >= 30`: `telegraph=0`, `damage=160`, `_speed=80`, fly along `image_angle` (at heart); play `snd_knight_cut` (vol 1, pitch 0.8).

**Tell/warning duration ≈ 30 frames (~0.5 s)** from line-appear (timer 1) to launch (timer 30).

Warning line visual (`Draw_0.gml:1-8`): `draw_sprite_ext(spr_lasergun_laser_telegraph, 0, x, y, 999, 0.4, image_angle, c_red, telegraphalpha)` — a thin red line (base sprite 2x13, origin (0,6)) stretched to xscale **999** so it spans the whole box along the sword's aim angle. Alpha fades IN 0.05/frame up to **0.5** (`telegraph==1`), fades OUT 0.1/frame after launch.

Finale hitbox (`Step_0.gml:86-97`): once flying (`_speed==80`) and inside the heart's ±80 box, each sword spawns ONE `obj_sword_tunnel_hitbox` at its position: `image_angle` = sword angle, `image_yscale=0.4`, `image_xscale=999` (a full-width line), and the heart mask shrinks to `spr_dodgeheart_smallmask`. Hitbox: `damage=160`, active only frame 2, self-destructs frame 3 (`hitbox_Step_0.gml`). Only ONE hitbox per sword (`create_2nd_hitbox` latch). Before the finale, normal swords hit via `collision_line(... 37px ...)` → `event_user(5)`.

---

## 4. Difficulty variants (event_user(0), `manager_Other_10.gml`)

| GML difficulty | rate | gapsize | verticalchange | tobymode | behavior |
|---|---|---|---|---|---|
| 0 | 4 | 45 | 10 | 0 | straight tunnel, gap wanders |
| 1 | 4 | 45 | 10 | 1 (toby) | straight, per-sword speed wobble `_speed += sin(tobytimer/6)*16 + random(1)`; `timer=max(0,sin(tobytimer/6)*2)` |
| 2 | 4 | 45 | 7 | 2 | **rotating +4°/spawn (CCW, ~6 s/rev)**; wider set counts |
| 3 | 4 | 45* | 7 | 3 | **rotating +8°/spawn (CCW, ~3 s/rev)** + pulsing gap + volley; finishtimermax 250 |
| 4 | 4 | **40** | 10 | 0 | straight but **narrower gap** |
(*mode 3 overrides gapsize live each frame, see below.)
Default (unmatched) = rate 6, gapsize 50, verticalchange 15, mode 0, maxswords 999.

Wiki mapping: "Sword Tunnel 1" (straight) = diff 0/1/4; "Sword Tunnel 2" (angle changes CCW) = diff 2/3. "Narrower gap" = diff 4 (gapsize 40 vs 45). The knight escalates difficulty per turn (`obj_knight_enemy_Other_10.gml` / `_Step_0.gml:514` passes the enemy's current `difficulty`).

Mode-3 pulsing gap (`Step_0.gml:73-77`, only when NOT volley):
`verticalchange = abs(sin(tobytimer/8)) * 5;  gapsize = 34 + (verticalchange * 1.4)` → gap breathes between **34 and 41 px** (base offset) while rotating.

---

## 5. Speeds / damage / scales / SFX

**Speeds (swords DO accelerate):** sword Create → `_speed=6`, `_gravity=1`, `_maxspeed=30`; Step: `_speed += _gravity` capped at 30 (`sword_Step_0.gml:1-4`). So straight-mode swords ramp 6→30 px/step. Rotating modes override to `_speed=-8*prop`, `_gravity=2*prop` (start backward, accelerate in, cap 30). Finale launch `_speed=80`. Movement is stepped in chunks of 8 near the heart (`repeat(max(floor(_speed/8),1))`).

**Damage:** tunnel swords `damage=62` (from `dc.damage`, applied every spawn). Finale swords `damage=160`; finale hitbox `damage=160`. `grazepoints=0.8`. `global.invc=0.14` for this attack.

**Scales:** swords `image_xscale=1`; `image_yscale` starts 0 and lerps toward `_speed/20` (`sword_Step_0.gml:134`) — a speed-based vertical stretch, capped ~1.5 at max speed. NOT darksized. Finale hitbox: `xscale=999`, `yscale=0.4`. Telegraph line: `xscale=999`, `yscale=0.4`. Draw uses a 10-sample trailing smear (`sword_Draw_0.gml:21-22`).

**SFX (exact names + events):**
- `snd_heavy_passing` — every spawn tick, vol 0.3 pitch 1.2 (`manager_Step_0:149`); continues after finale for 3 more ticks (`stopsfxtimer`).
- `snd_knight_jump` — finale wind-up, sword timer 21-24, vol 1 pitch 0.8 (`sword_Step_0:35-36`).
- `snd_knight_cut` — finale launch, sword timer≥30, vol 1 pitch 0.8 (`sword_Step_0:59-60`).
- CleanUp stops `snd_object_passing` + `snd_heavy_passing` (`manager_CleanUp_0.gml`).
- Anim/pose object `obj_knight_swordtunnelanim`: sound id `226` every 3rd frame (rising pitch) + `snd_shinka_ambience` every 11th frame — ambience only, not gameplay.

**Timing summary:** tunnel spawns a pair every 4 frames for `finishtimermax` frames (230, or 250 at diff3) ≈ 3.8–4.2 s, then all live swords do the ~30-frame telegraph→launch finale.
