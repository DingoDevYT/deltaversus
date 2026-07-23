# Gerson (Hammer of Justice) — GREEN→RED Transition Attacks + Battle Sprite/Hair Port Spec

Source: DELTARUNE Chapter 4 decompiled GML at
`C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 4 - GML\`
Sprite dims from `...DELTARUNE Chapter 4 - REFDATA\sprites.tsv` (cols: sprite, frames, width, height, originX, originY).
Enemy object: `obj_hammer_of_justice_enemy`. Attack dispatcher: `scr_spearpattern` -> queued -> `scr_spearshot`.
No dialogue reproduced (per task).

GameMaker colour ints are BGR-encoded (`value = R + G*256 + B*65536`). All colours below already converted to RGB.

---

## 0. Core dispatch model (how any attack is built)

- `scr_spearpattern(dir, speed, heartframes, special, beat [,arg5])` — `gml_GlobalScript_scr_spearpattern.gml`.
  String dirs map to angles: `"u"=270, "d"=90, "r"=180, "l"=0, "dr"=135, "dl"=45, "ur"=225, "ul"=315`.
  Named slots (used by swing telegraphs) set an (x,y,angle) offset triple:
  - `up1` -> (-36,-75), `up2` -> (50,-75, angle -3)
  - `left1`(-75,-36,90) `left2`(-75,36,90) `right1`(75,-36,270) `right2`(75,36,270)
  - `down1`(-36,75,180) `down2`(36,75,180)
  - `diag1`(90,-90,315) `diag2`(-90,-90,45) `diag3`(-90,90,135) `diag4`(90,90,225)
- Each queued row is fired in `Step_0` (`obj_hammer_of_justice_enemy_Step_0.gml:1033`) via
  `scr_spearshot(dir, speed, frames, special, arg5)` then waits `list_attackwait[]` (the `beat`) frames.
- `scr_spearshot` special codes (`gml_GlobalScript_scr_spearshot.gml`) — the ones that matter here:
  - `1`  -> `obj_gerson_green_switch` (soul->GREEN flip + box slam-in)  [line 5]
  - `2`  -> `obj_giant_hammer` (hittable thrown hammer, type 2)         [line 9]
  - `3`  -> enable diagonal shield mode                                 [line 13]
  - `4`  -> spawn `obj_gerson_teleport` "flying Gerson" (edge/diag slasher) [line 30]
  - `32` -> `obj_gerson_swing_down_new` (the falling-Gerson slash)      [line 452]
  - `35` -> `obj_spearshot` with `redhammer=1, grav=0.3` (slow RED hammer) [line 500]
  - `355`-> `obj_spearshot` `redhammer=1, redhammerfakeout=1` (hover-then-drop hammer) [line 511]
  - `19/20/20.1/21/21.6/21.65/21.66/21.9` -> `obj_spearshot` bounce SHELLS, hp per code (see §3)
  - `40/40.4/40.5/40.6/41/41.1/42/42.1/42.2` -> slowbounce shells (colours, see §3)
  - `36` -> create `obj_spearblocker` (the green directional shield ring)
  - `55` -> spearblocker vanish + `scr_heartcolor("red")`
  - `9`  -> Gerson laugh (state 12); `10/10.5` -> teleport out; `27` -> `obj_gerson_growtangle_transform`

### Battle box (green AND red use the SAME box)
- Box object `obj_growtangle`, sprite `spr_battlebg_0` (75x75, origin 37,37), grows to
  `maxxscale = maxyscale = 2` -> ~150x150 px, centered at camera center
  (`Step_0` mnfight==1.5 block, `Create` line 13). **No separate/smaller RED box** — the red slash
  sequences run in the same grown green box. The slash INDICATOR sprite is what spans the full box
  (see telegraph sprite in §2, 360 px tall = far taller than the box, so it visually fills it).

---

## 1. FALLING HAMMER (wiki Attack 6) = `attackpattern == 4`  (Other_10 lines 599-618)

Sequence: spearblocker(36) -> **slow red hammer from TOP** -> green arrows -> Gerson laugh -> more
green arrows -> teleport -> **single centre slash**.

- Slow falling hammer: `scr_spearpattern("u", 1, 280, 355, 16)` (line 605)
  -> `obj_spearshot` `redhammer=1 redhammerfakeout=1`, speed 1 across 280 heartframes = crawls down.
- Fakeout/drop timing (`obj_spearshot_Step_0` redhammer block + `Draw_0` lines 32-71):
  - `redhammersiner==350` -> `fakespeed=0` (hammer HOVERS/stalls)
  - `redhammersiner==410` -> `fakespeed=-15, grav=3` (hammer SLAMS down)
  - `redhammersiner>420` -> red afterimages (`spr_gerson_red_hammer`)
  - colour pulses white<->red: `merge_color(c_white,c_red, 0.4 + sin(redhammersiner/8)/3)`
- Soul flip to RED / land: hammer breaks the green shield on contact — `obj_spearshot_Other_10.gml:74`
  `if (redhammer==1) breakshield=true`; on heart contact (len<16) line 285-291
  `breakshield=true; hitheart=true; global.inv=-1; scr_damage()`. breakshield block (line 339)
  sets `obj_heart.color=c_black; sprite_index=spr_heart`, spawns `obj_gerson_fakeheart`, shatters
  `obj_spearblocker` -> control passes to red free-move. redhammer collision radius `shieldradius+=15`.
- Centre slash (undodgeable-in-green point): `scr_spearpattern(0,-70,0,32,45)` (line 616)
  -> `obj_gerson_swing_down_new` at box top-centre, `image_angle=0`, `direction=270` (straight DOWN centre).
  Then `scr_spearpattern(0,0,0,10,1)` -> Gerson teleports back in.
- `obj_gerson_swing_down_new` (Create/Step): `timetoswing=10, telegraphtime=8`, spawns at box top,
  `speed=-7` rising then `image_index>2.5` -> `speed=50 friction=10` = fast slam down;
  telegraph created in `Draw_0` line 88 = `obj_gerson_growtangle_telegraph_new` (vertical variant
  uses `spr_gerson_swing_down_telegraph4`). Sprites: `spr_gerson_swing_down_new` (5f,52x112,org 28,62),
  loop `spr_gerson_swing_down_loop_new` (2f,52x112,org 28,62).

## 2. SLASH FAKEOUT (wiki Attack 12) = `attackpattern == 9`  (Other_10 lines 719-764)

Sequence: shells -> a red hammer -> soul RED -> **many flying Gersons slash from top, full-box indicators**.

- Shells first (special 19 = bounce shell hp2/green): `("u",12,40,19,14) ("l",12,40,19,14) ("d",12,40,19,50)`.
- Red hammer: `scr_spearpattern("r",12,50,35,44)` -> special 35 = `redhammer=1 grav=0.3` (breaks shield -> red).
- Multiple flying-Gerson slashes (full box top): `beat=16; scr_spearpattern(0,-70,0,32,beat)` then a
  `repeat(6)` loop choosing `up1`/`up2`/centre each firing special `32` (lines 733-758). Each ->
  `obj_gerson_swing_down_new` at box top with a full-height telegraph.
  - Full-box slash INDICATOR sprite: `spr_gerson_swing_down_telegraph4` = **72 x 360**, origin (36,0)
    (created in `obj_gerson_swing_down_new_Draw_0.gml:96` when `image_angle==270`). 360 tall >> ~150 box,
    so the indicator stretches the entire battle box vertically. (Diagonal variant:
    `spr_gerson_swing_down_telegraph2` 80x360; older `spr_gerson_swing_down_telegraph` 73x360.)
- Then edge "flying Gersons": `scr_spearpattern(300,125,-5,4,0)` and `(378,125,-5,4,25)` -> special 4
  spawns `obj_gerson_teleport` (7f, 84x60, org 43,34) that does a swing; `(0,0,-1,32,41)` = another
  centre slash; `(0,0,0,10,1)` teleport back.

## 3. FINAL (wiki Attack 21) = `attackpattern == 19`  (Other_10 lines 1085-1125; trueturn>=20)

Sequence: shells -> **red hammer from LEFT -> soul RED -> SPIRAL of slashes top-right, counterclockwise, speeding up**.

- Shells (fired at pattern start, lines 1089-1093):
  - `("u",8,47,41.1,10)` special 41.1 -> hp3 **giga** shell (CYAN, 0,255,255)
  - `("l",6,55,42.1,20)` special 42.1 -> hp2 **giga** (GREEN, 0,255,0)
  - `("ur",10,47,40.6,8)` special 40.6 -> hp3 **giga** (CYAN)
  - `("r",12,47,21.66,116)` special 21.66 -> hp5 (RED, 255,0,0)
  - `("u",10,47,20.1,55)` special 20.1 -> hp2 (GREEN)
- Red hammer from LEFT: `scr_spearpattern("l",18,50,35,55)` (line 1094) -> special 35 redhammer,
  dir 0 (travels rightward = enters from left), breaks shield -> RED soul.
- **SPIRAL** — 18 `obj_gerson_swing_down_new` slashes, special 32, 45° apart, around box perimeter,
  order top-right -> top -> top-left -> left -> bottom-left -> bottom -> bottom-right -> right (repeat)
  = **counterclockwise starting top-right**. `beat` (wait between slashes) = the RATE, it DECREASES
  (speeds up): `16,15,14,13,12,11,10,9, 8,8,7,7,7,7,7,6, 6,21` (lines 1095-1112).
  Positions/angles: diag1(315,+90,-90) / up(0,0,-70) / diag2(45,-90,-90) / left(90,-70,0) /
  diag3(135,-90,+90) / down(180,0,+70) / diag4(225,+90,+90) / right(270,+70,0).
- Tail: special 27 (`obj_gerson_growtangle_transform` shrink), 28, seven special-4 flying Gersons
  (`(0,0,-3,4,2)` x7 then `,38`), 10.5 (teleport back in), 9 (laugh -> ends turn).

### Shell colour table (`obj_spearshot_Draw_0.gml:74-98`, by `hp`; sprite `spr_bounce_shell_idle_color`, 14f 45x45 org 45,22)
| hp | RGB | note |
|----|-----|------|
| 8 | (255,204,226) `pink3` | high-HP pink |
| 7 | (255,178,212) `pink2` | high-HP pink |
| 6 | (255,127,184) `pink1` | high-HP pink |
| 5 | (255,0,0) red | |
| 4 | (128,0,128) purple | |
| 3 | (0,255,255) cyan | |
| 2 | (0,255,0) green | |
| 1 | (255,255,0) yellow | |
Base shell white outline sprite `spr_bounce_shell_idle` drawn on top; `gigashell` scale=1 else 0.75.
Specials->hp: 19=2, 20=3, 20.1=2, 21=9, 21.6=6, 21.65=6, 21.66=5, 21.9=9, 22=3(fast),
40=3,40.4=2,40.5=4,40.6=3giga,41=3,41.1=3giga,42=3,42.1=2giga,42.2=3giga.

---

## 4. Gerson battle sprite + flowing HAIR

### Hair (furthest-back layer) — `obj_hammer_of_justice_enemy_Draw_0.gml:18-113`
- Sprite `spr_gerson_hair` = **5 frames, 55x33, origin (0,18)**. Drawn at 2x scale.
- Drawn FIRST in Draw (before `scr_enemy_drawhurt_generic()` and before the body
  `draw_monster_body_part(thissprite,...)`), so it is the furthest-back layer behind the body.
- Position: `x + hair_x*2, y + hair_y*2` with `hair_x = 18` (constant) and `hair_y` oscillating by
  `_index = siner % 14`: hair_y sequence per index 0..13 = `5,4,3,4,5,6,7,5,4,3,3,4,6,7` (px, pre-2x).
- Anim: `hairindex += 0.2` while state 0 (idle), `+= 0.1` otherwise; loops frames 0..4.
- Extra flash passes: a white-fog pass and a rudebuster-flash pass (alpha `sin(rudebusterflashtimer/3)`).
- End-cutscene detached hair uses `obj_gerson_hair2` (separate physics object).
- `nohairsprite` flag (Draw line 126) swaps to `spr_gerson_headtilt_nohair` (67x50, org 0,11) at the end.

### Battle animation states (drawn via `draw_monster_body_part(sprite, siner, x, y)`; body drawn AFTER hair)
`state` set in `Step_0`/`Draw_0`. Idle bob: `x = xstart + sin(movesiner/5)*10`.
| state | meaning | sprite | frames | w x h | origin |
|------|---------|--------|--------|-------|--------|
| 0 | idle (`idlesprite`) | `spr_gerson_idle` | 14 | 67x39 | (0,0) |
| 3 | hurt | `spr_gerson_idle` (hurtsprite) + `spr_gerson_idle`/hurt overlay | — | 67x39 | (0,0) |
| 12 | laugh | `spr_gerson_laugh` | 3 | 73x61 | (8,22) |
| 10/11 | rudebuster wind-up + swing | `spr_gerson_swing` | 7 | 101x96 | (21,43) |
| 13 | dodge (dodges your attack) | `spr_gerson_dodge` | 1 | 49x67 | (-18,28) |
| 14 | spin (mercy/spare spin) | `spr_gerson_spin` (+ `spr_gerson_spin_smear`) | 14 / 2 | 83x60 | (43,59) |
| — | teleport (flying Gerson / warp) | `spr_gerson_teleport` | 7 | 84x60 | (43,34) |
| — | throw (item steal) | `spr_gerson_item_steal2` | 3 | 49x104 | (-18,65) |
| — | headtilt (end) | `spr_gerson_headtilt` | 1 | 67x39 | (0,0) |
Related: `spr_gerson_hurt` (1,101x96,21,43), `spr_giant_hammer` (1,100x100,20,49),
`spr_gerson_red_hammer` (4,25x25,12,13), `spr_gerson_green_chevron` used by green_switch.
Laugh state 12 draws at `image_index += 0.2333`, `snd_gerlaugh` on frame 1, lasts 62 frames.
Swing states: state 10 spins up to image_index 3 then state 11 fires `obj_gerson_rudebuster` at swingtimer 12.

### Soul GREEN flip object — `obj_gerson_green_switch` (special 1)
- Create: `image_xscale=image_yscale=2`, `image_speed=1/3`, `scr_oflash()`, `snd_play(snd_boost)`,
  hides enemy (`image_alpha=0`) during the flip.
- Step: at `image_index>4` spits `obj_gerson_green_chevron` (blend `c_lime`); box lerps to camera
  center `y=lerp(y, cameray()+cameraheight()/2, 0.3)`; at `image_index>6.5` restores enemy alpha and
  snaps box back to ystart, destroys at timer2==10.

---

## Key sounds
`snd_boost` (green flip), `motor_upper_quick`/`motor_upper_quick_mid`/`motor_swing_down` (Gerson swings),
`snd_impact` (slash land), `snd_gerlaugh` (laugh), `snd_bell`/`snd_bell_bounce_short` (block/shell),
`snd_parry_fast_nodelay` (shell parry), `snd_eye_telegraph` (slash telegraph), `snd_criticalswing`,
`snd_rudebuster_swing`, `snd_mercyadd` (progress stars).
