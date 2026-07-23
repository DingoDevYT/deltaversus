# Gerson SHELL mechanics — EXACT port spec (DELTARUNE Ch4 decompile)

Source root: `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 4 - GML\`
Sprite dims from `DELTARUNE - REF DATA\DELTARUNE Chapter 4 - REFDATA\sprites.tsv`.
GameMaker plain-integer colours are **BGR** (`$BBGGRR`); RGB conversions noted below.

---

## TOPIC A — SHELL BLOCK mechanic (obj_spearshot "bouncespear")

### Object / variable identity
`obj_spearshot` is the shared spear/shell bullet. Shell mode is `bouncespear > 0`.
Files: `gml_Object_obj_spearshot_Create_0.gml`, `..._Step_0.gml`, `..._Other_10.gml` (event_user 0 = the BLOCK/collision handler), `..._Draw_0.gml`.

**Create_0 defaults** (Create_0:3-74): `fakespeed = 2`, `len = 100`, `grav = 0`, `hp = 2`, `maxhp = 2`, `bouncespear = 0`, `bouncespeartimer = 0`, `bouncespearcon = 0`, `bouncespeardir = 0`, `savedir = 0`, `spinindex = 3`, `shakeintensity = 2`, `gigashell = false`, `hurtsquish = false`.
Pink colours (Create_0:57-59): `pink1 = rgb(255,127,184)`, `pink2 = rgb(255,178,212)`, `pink3 = rgb(255,204,226)`.

### bouncespear variants
- **bouncespear == 1 = normal GREEN shell (non-spinning).** `spinindex` forced 0 (Draw_0:110-111). Position = straight `lengthdir(len, direction+180)` off the shield (Step_0:130-134). Squish sprite = `spr_bounce_shell_squish2`.
- **bouncespear == 2 = SPINNING shell (cyan/etc).** Spins, uses the 90° return-arc lerp. Squish sprite = `spr_bounce_shell_squish`; on launch swaps to `spr_bounce_shell_hit_center` (Step_0:56-59). Colour purely a function of `hp` (below).
- **big/slow shells:** `gigashell == true` -> draw `scale = 1` instead of `0.75` (Draw_0:100-103, Other_10:235-237). `slowbounce`/`fastbounce` flags tune the bounce arc (below).

### Colour per HP (Draw_0:74-98) — BGR int -> RGB
Drawn via `spr_bounce_shell_*_color` sub-sprites tinted with `shellcolor`:
| hp | int | RGB | colour |
|----|-----|-----|--------|
| 8 | pink3 | (255,204,226) | light pink |
| 7 | pink2 | (255,178,212) | pink |
| 6 | pink1 | (255,127,184) | hot pink |
| 5 | 255 | (255,0,0) | RED |
| 4 | 8388736 | (128,0,128) | PURPLE |
| 3 | 16776960 | (0,255,255) | CYAN |
| 2 | 65280 | (0,255,0) | GREEN |
| 1 | 65535 | (255,255,0) | YELLOW |
Default fallthrough `shellcolor = 16777215` (white).
So the canonical 3-hit spinning shell is **hp3 CYAN -> hp2 GREEN -> hp1 YELLOW**. hp1/yellow is final.

### The BLOCK event — event_user(0) in Other_10.gml
Shield geometry (Other_10:34-44): non-diagonal `shieldlength=50, shieldradius=36`; diagonal `shieldlength=30, shieldradius=46`.
Radius tweaks: `bouncespear==1 && hp==1` -> `shieldradius -= 30` (final green must be blocked almost point-blank, Other_10:49-50). `bouncespear==2 && bouncespearcon==2 && sprite==spr_bounce_shell_hit_center` -> `+10` (Other_10:52-53).
`dontblockshell` guards (Other_10:61-70): true if `bouncespear==1 && len>36`, or `bouncespear==2 && len>46`, or (`shakeduration>0` or (`bouncespearcon==2 && fakespeed<0`)) — i.e. **cannot be blocked while flying outward**.
Block test (Other_10:72): `len < shieldradius && !dontblockshell && angle_difference(direction, shielddir) < shieldlength` (for bouncespear==2; spears use image_angle).

**On a successful block (Other_10:195-224), if `hp > 1`:**
```
if (shakeduration != 5) hp--;      // decrement -> next colour
bouncespearcon = 1;                 // enter squish windup
savedir = direction;                // remember incoming dir
sprite_index = spr_bounce_shell_squish;         // (squish2 if bouncespear==1)
image_angle = direction; image_index = 1;
len = parryradius - 5;   // (parryradius-12 if bouncespear 1 or 2)
bouncespeartimer = 0; shakeduration = 5; hitstopbounce = 1;
```
Parry (just) block heals 2.5 tension + `snd_parry_fast_nodelay`, sets `spinindex = 0`; normal block heals 1.25 + `snd_bell`.

**If `hp == 1` (final, Other_10:225-251): NO bounce.** Spawns a spin-out `obj_gerson_animation` ghost (bouncespear==2 only) then `instance_destroy()`. One block finishes it.

Direct heart hit (Other_10:270-337): also squishes (`bouncespearcon=1`, `hurtsquish=true`, `hp=0`) then destroys.

### Bounce PHYSICS — Step_0.gml (bouncespear block, Step_0:19-208)
State machine on `bouncespearcon`:
- **con 0** (Step_0:21-38): init frame. `sprite = spr_bounce_shell_idle`, `image_xscale/yscale = 1.5`, `savedir = direction`, then `bouncespearcon = -1`.
- **con -1**: idle; Draw adds `spinindex += 0.5` per frame (Draw_0:107-108) -> continuous spin while orbiting.
- **con 1** (Step_0:40-119): squish WINDUP. `image_index++`, `bouncespeartimer++`. On `bouncespeartimer == 5`: `bouncespearcon = 2`, launch:
  - bouncespear==2 default: `fakespeed = -17`, `grav = 1` (Step_0:74-75); swaps to `spr_bounce_shell_hit_center`, `image_index=1`, nudges pos +/-16 by direction.
  - `hitstopbounce==1`: `fakespeed = -19`, `grav = 1.25`.
  - `fastbounce==1`: `fakespeed = -38`, `grav = 6`.
  - bouncespear==1: `fakespeed = -20`, `grav = 1.2` (Step_0:48-49, generic branch).
  - `slowbounce` 1/2/3/4: fakespeed `-10/-10/-10/-11`, grav `0.35/0.25/0.2/0.24`.
  - resets `bouncespeartimer = 0`. **Negative fakespeed = shell travels OUTWARD/up-and-back** (`len -= fakespeed` grows len).
- **con 2** (Step_0:126-207): BOUNCE FLIGHT. Each step `fakespeed += grav; len -= fakespeed;` (Step_0:139-140) — classic gravity arc: len grows (out), fakespeed climbs through 0, len shrinks (returns).
  - `duration = 34` default; `hitstopbounce`->30; `fastbounce`->12; slowbounce 1/2/3/4 -> 60/80/100/110 (minus 6 if hitstopbounce). `duration += testcon`.
  - Spin: `spinindex = (bouncespeartimer / duration) * 14.5` (one ~14-frame spin over the arc; sprite has 14 frames).
  - **90-degree return rotation (Step_0:185-206):**
    - `bouncespeardir == 0`: orbit angle `_savedir = lerp(savedir+180, savedir+270, t)` while t<=1, and `direction = savedir + 90`. -> return path swings **+90 (CCW)** from incoming.
    - `bouncespeardir == 180`: `_savedir = lerp(savedir+180, savedir+90, t)`, `direction = savedir - 90`. -> mirror, 90 CW.
  - Position: `x = obj_spearblocker.x + lengthdir_x(len, _savedir)` (Step_0:205-206). bouncespear==1 instead stays on `direction+180` radial (Step_0:130-134), no spin, no rotation.

### Shake / squish visuals
`shakeduration` (Draw_0/Step_0): on block set to 5; shakelen = +4 at dur4, -4 at dur2, dir = direction+90 (Draw_0:10-24).

### Sprite names + sizes (frames W x H, origin)
| sprite | frames | W x H | origin |
|--------|--------|-------|--------|
| spr_bounce_shell_idle | 14 | 45x45 | 45,22 |
| spr_bounce_shell_idle_color | 14 | 45x45 | 45,22 |
| spr_bounce_shell_hit_center | 14 | 45x45 | 22,22 |
| spr_bounce_shell_hit_center_color | 14 | 45x45 | 22,22 |
| spr_bounce_shell_squish | 2 | 30x45 | 30,23 |
| spr_bounce_shell_squish_color | 2 | 30x45 | 30,22 |
| spr_bounce_shell_squish2 | 1 | 30x45 | 30,23 |
| spr_bounce_shell_squish2_color | 2 | 30x45 | 30,23 |
Draw scale 0.75 normal / 1.0 gigashell. Idle drawn at xscale=yscale=1.5 in con0 but rendered through the 0.75 scale path in Draw.

---

## TOPIC B — SHELL PINBALL attack

Files: `gml_Object_obj_gerson_shell_kick_controller_Create_0 / Step_0 / Step_1(empty:"exit;") / Step_2.gml`, `gml_Object_obj_gerson_shell_pinball_Create_0 / Step_0 / Other_15(collision) / Draw_0 / CleanUp_0.gml`.
`obj_gerson_shell_pinball` parent = `obj_regularbullet`; sprite `spr_bounce_shell_idle_old2` (14f, 45x45).

### Controller — launch (kick_controller Step_0.gml)
- Create: `shell_counter = 1`, `full_timer = 999`, `global.turntimer = 9999`, `visible=false`.
- `timer==12`: snap to `obj_hammer_of_justice_enemy`, `sprite=spr_gerson_swing` frame0, hide hammer, `snd_boost`, lerp x +48 out over 12.
- `timer 12..24 %3`: lime `scr_oflash()` sparks.
- `timer==24`: lerp swing `image_index 0->6` over 12, `snd motor_upper_quick_mid`.
- **`timer==32`: SWING — `snd_rudebuster_swing`, screen shake, spawn `obj_gerson_shell_pinball`** at `(x+100-42, y+90-86)`: `direction = scr_at_player`, `speed = 12`, xscale/yscale +=0.25, `target=3`, `damage=1`, `destroyonhit=false`.
- `timer==40`: `shell_counter==1` -> hide + teleport puff; else `timer=23`, `shell_counter++`.
- End: `full_timer<4` teleport puff; `<2` -> `global.turntimer=1`; restore hammer, destroy.
- Step_2: box (`obj_growtangle`) vertical drift propagates to heart AND to the pinball (`y += ydiff`).

### Pinball flight & wall behaviour (pinball Step_0.gml)
Box edges via `scr_get_box(1)` = TOP, `scr_get_box(3)` = BOTTOM, `scr_get_box(4)` = right. Box x-span for bounce test: `obj_growtangle.x -72 .. +72`.
- **TOP/BOTTOM bounce only** (Step_0:40-80): inside x-span, on hitting `y > box(3)-16` (down) or `y < box(1)+16` (up): clamp y, squish `xscale*1.5 / yscale*0.5` over 3 frames (restore after 3), `snd_parry_fast_nodelay`, then after **6-frame delay** `vspeed = -vspeed` (hspeed kept). vspeed/hspeed zeroed during the 6-frame hitstop. Box nudges +/-10 y.
- **Passes THROUGH left/right** (Step_0:308-312): exit left when `x < growtangle.x-73 && hspeed<0` -> `left_timer=0`; exit right when `x > growtangle.x+92 && hspeed>0` -> `right_timer=0`.

### Gerson teleport + knock-back (left_timer / right_timer switch, Step_0:323-448)
Same sequence mirrored L/R:
- **case 1**: `gerson_x = x + hspeed*6`, `gerson_y = y + vspeed*6` (predict landing); spawn `obj_gerson_teleport_generic`.
- **case 5**: spawn swing marker `spr_gerson_swing` frames 3->6 (left flips xscale *= -1).
- **case 7**: `snd_queen_punched_lower`; `counter++`. If `counter < 7`: knock back — `direction = scr_at_player` (50% chance aimed at a mirrored heart-y via `check_bounds`), `speed = scr_approach(speed, 15, 1.5)`, restore `image_speed=8`. Else (`counter >= 7`): aim to TOP `point_direction(x,y, box(4), box(1)-80)`, `speed = dist/30`, `top_timer=0`.
- **case 15**: second teleport puff, reset timer `= -1`.
`counter` starts `choose(0,-1)`. So ~7 back-and-forth side knockbacks, then the top smash.

### Top HAMMER SMASH -> BREAK (top_timer switch, Step_0:450-511)
- **case 0**: lerp `image_angle +270` over 30; spawn `spr_gerson_swing_down_new` marker at `(box(4), box(1)+80)`, fade in, rise `y-240` over 29, `snd_jump`.
- **case 29**: marker drops (`image_index 2->4`, `y+80` over 8).
- **case 30**: `scr_shakescreen`, `snd_queen_punched_lower_heavy` + `snd_rudebuster_swing`, sonic booms(270); shell `direction=270, image_angle=90, speed=30` — vertical downward smash.
- **case 36**: destroy the swing-down marker.
- **BREAK trigger** (Step_0:82-101): while `top_timer >= 20`, when shell reaches `y > box(3)-16` (bottom): clamp, `snd_explosion_firework` + `snd_stardrop(0.5,0.75)`, `scr_shakescreen`, controller `full_timer=80`, spawn `spr_finisher_explosion` burst marker + `spr_launchsmoke` puffs, then the STAR BURST, `im_done=true`.

### STAR BURST particles (Step_0:128-302)
Bullet obj `obj_regularbullet`, sprite `spr_gerson_star7` (16x16). `spinspeed=15, spin=1`. Scale `1.5`, and `if (irandom(1)) scale -= 0.5` -> **NORMAL (1.5) and SMALL (1.0) variants**. `image_blend` fades gray->white via delayed `scr_var`: f8=10855845(165), f9=13421772(204), f10=15921906(242), f11=16777215(white); active at f11. `hspeed *= 0.5`.
Four fountains (all `gravity_direction = 270` = UPWARD force; launched downish `direction ~90` so they fall then arc back UP = the "bounce", not constant speed):
| fan (a range) | spawn x | direction | speed | gravity |
|---|---|---|---|---|
| -2..1 | x | 90 + 4a | 12 | 0.535 |
| -5..4 | x+24 | 90 + 7a | 13.25 | 0.5 |
| -4..3 | x | 90 + 6a | 14.5 | 0.465 |
| -3..2 | x-24 | 90 + 5a | 15.75 | 0.43 |
Each also `direction += random_range(-1,1)`, `speed += random_range(-1,1)`.
`spr_launchsmoke` (23x26) puffs: `a=-6..5` (skip 0), `gravity_direction=90` down, `gravity = abs(a)*0.05 + random(0.1)`, `hspeed = a*3`, fade/scale out over `2 + abs(a)*6` frames.

### STAR TRAIL (~6 stars) — pinball Step_0:15-38
Every 4 frames while `!top_timer`: fire `spr_thrash_star` (26x24) at current x,y, `image_xscale/yscale = 1.5`, `spinspeed=15, spin=1`.
Lifecycle via `scr_script_delayed`: at **frame 22** lerp `image_xscale`/`image_yscale` -> 0 over 4 frames; `instance_destroy` at **frame 26**.
=> each trail star holds full size 22 frames then shrinks to 0 in 4; spawn interval 4 => ~6-7 stars alive at once. Head shell `image_speed = scr_approach(image_speed, 0.5, 0.4)` (spins down from 8).

### Pinball Draw (Draw_0.gml) — motion-blur trail
Two lime-fog after-images at `xpprevious/ypprevious` (alpha 0.5) and `xprevious/yprevious`, both `image_*scale*0.85`, then `draw_self()`. `xpprevious=xprevious; ypprevious=yprevious` each frame (2-frame ghost).

### Collision (pinball Other_15.gml)
`damage = lerp(12, 90, clamp((global.hp[2]-30)/250, 0, ..))`. `target==3` -> `scr_damage_all()`, else `scr_damage()`; destroy if `destroyonhit`.

### Sounds
snd_boost, motor_upper_quick_mid, snd_rudebuster_swing, snd_parry_fast_nodelay, snd_queen_punched_lower, snd_queen_punched_lower_heavy, snd_jump, snd_explosion_firework, snd_stardrop, snd_bell, snd_bell_bounce_short.
