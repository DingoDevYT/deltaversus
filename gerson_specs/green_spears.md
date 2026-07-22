# Gerson Green-Soul (Spear-Block) — EXACT PORT SPEC

Decompiled from `DELTARUNE Chapter 4 - GML`. All frame counts are raw GML steps @ 30 fps.
GML angle convention: 0=right, 90=up, 180=left, 270=down. `lengthdir_x=len*cos(a)`, `lengthdir_y=-len*sin(a)`.
GML color ints are BGR: R=int&255, G=(int>>8)&255, B=(int>>16)&255.

## OVERVIEW OF THE MECHANIC
The "green chevron" and "green switch" are the TRANSITION-IN animation that swaps the soul into
green-shield mode. The projectiles you actually BLOCK are `obj_spearshot`, deflected by the rotating
shield `obj_spearblocker` (spr_spearblocker). Green mode = press an arrow key to face the shield toward
the incoming spear before it reaches the soul.

- `scr_spearshot(dir,speed,frames,special,special2)` with `special==1` spawns `obj_gerson_green_switch`
  → the switch spawns `obj_gerson_green_chevron` → the chevron, on crossing the soul's x, spawns
  `obj_spearblocker`. That is the whole "enter green mode" chain.
  - scr_spearshot.gml:3-6 (special==1 branch)
  - green_switch Step:5 (`instance_create(x-15, y, obj_gerson_green_chevron)`)
  - green_chevron Draw:9 (`instance_create(x, y, obj_spearblocker)`)

---

## 1. obj_gerson_green_chevron  (the flying green arrow that becomes the shield)
Default object sprite: `spr_gerson_chevron2` (objects.tsv). 6 frames, 120x160, origin (10,78).

### Create — gml_Object_obj_gerson_green_chevron_Create_0.gml
```
timer=0; con=0;
image_speed=0; image_index=5;      // holds on frame 5 of spr_gerson_chevron2
direction=180;                     // travels LEFT
speed=12; friction=-2;             // negative friction = ACCELERATES (+2 px/frame each step)
```
Its `image_blend` is set by the switch to `merge_color(c_lime, c_black, 0.2*timer)`; at spawn timer=0 →
**c_lime = RGB(0,255,0)** (green_switch Step:6).

### Draw — gml_Object_obj_gerson_green_chevron_Draw_0.gml
- Line 1-2: `scr_afterimage()` with `afterimage.fadeSpeed = 0.2` (green trailing afterimages).
- Line 4-11: once, when `con==0 && obj_heart exists && x < obj_heart.x`:
  - if `global.turntimer < 990 && !obj_spearblocker` → `snd_play(snd_smallswing)`.
  - `instance_create(x, y, obj_spearblocker)`  ← the shield spawns here. `con=1`.
- Line 13-16: `timer++`; at `timer==100` → `instance_destroy()`.
- Line 18: `draw_self()` (spr_gerson_chevron2, image_index 5, xscale/yscale 1, no rotation, blend=c_lime).

## 2. obj_gerson_green_switch  (the "SWITCH" flash that toggles green mode)
Default object sprite: `spr_gerson_swing` (objects.tsv). 7 frames, 101x96, origin (21,43).

### Create — gml_Object_obj_gerson_green_switch_Create_0.gml
```
timer=0; timer2=0; type=0;
image_xscale=2; image_yscale=2;    // drawn at 2x
image_speed=1/3;                   // ~0.333 frames/step → advances 1 sprite frame every 3 steps
if (obj_sound_of_justice_enemy exists) image_blend=c_black;   // black silhouette in that fight
with(obj_hammer_of_justice_enemy) image_alpha=0;   // hide Gerson during the swing
with(obj_sound_of_justice_enemy)  image_alpha=0;
scr_oflash();                      // white screen flash
snd_play(snd_boost);
```
### Step — gml_Object_obj_gerson_green_switch_Step_0.gml
- L1-10: while `image_index>4` and `timer<1` (fires once), spawn chevron at `(x-15, y)`; `timer++`.
- L12-18: while `image_index<=3 && image_alpha==1`, lerp `y` toward `cameray()+cameraheight()/2` @0.3.
- L20-51: once `image_index>6.5`: restore hammer/sound `image_alpha=1`, set own `image_alpha=0`,
  `image_speed=0`, `timer2++`; after `timer2>3` lerp y back to `ystart`@0.4; at `timer2==10` destroy.
- L53-54: if `type==1`, clamp `image_index=3` (held telegraph variant).
- Draw = `draw_self()`.

### CleanUp — restores `obj_hammer_of_justice_enemy` / `obj_sound_of_justice_enemy` `image_alpha=1`.

---

## 3. THE SHIELD — obj_spearblocker  (spr_spearblocker: 3 frames, 64x64, origin 32,32)
### Create (gml_Object_obj_spearblocker_Create_0.gml)
- `obj_heart.color = #020000` (near-black soul while in shield mode).
- `idealdir=90; dir=90; justlength=4; radius=30;` `image_speed=0; image_alpha=0; forceheartpos=true`.
- If `obj_sound_of_justice_enemy` exists: `idealdir=180; image_angle=180`.

### Step (gml_Object_obj_spearblocker_Step_0.gml) — key facts
- Follows soul: `x = obj_heart.x + 10; y = obj_heart.y + 10` (L178-182). So shield/soul center = heart+(10,10).
- Arrow keys set `idealdir`: Up→90, Down→270, Left→180, Right→0 (L28-74, L110-120).
  Diagonals (only if `diagonal_enabled`, from a special transform): UR→45, UL→135, DL→225, DR→315.
- `image_angle` rotates toward `idealdir` at ~`ceil(|angle_difference|*0.666)` deg/step (L188, L199-235):
  roughly 1.5 deg/step effective — NOT instant; the shield swings.
- On a key press: `just = justlength (4)`, `+2` if two arrows pressed same frame (L34-73) — this is the
  **parry (just-guard) timing window**: `just` counts down 1/step, so ~4 frames after a fresh press.
- Fade-in: `image_alpha += 0.2` per step until 1 (L271-274); `vanish==1` → alpha -=0.1 then destroy.
- Draw: `draw_sprite_ext(spr_spearblocker, image_index, x, y, image_xscale(1), image_yscale(1),
  image_angle, image_blend(c_white), image_alpha)` (L302). `image_index` = 0 normally, 1 while flashing.
- Destroyed if `!obj_heart || global.turntimer < 1` (L184-185).

### Block detection & damage — gml_Object_obj_spearshot_Other_10.gml (User Event 0, run when spear `len<50`)
- `shielddir = obj_spearblocker.image_angle + 180` (L26).
- Normal (non-diagonal) shield: `shieldlength = 50` (arc half-width, DEGREES), `shieldradius = 36` (L34-38).
  Diagonal shield: `shieldlength = 30`, `shieldradius = 46` (L40-44).
- BLOCK succeeds when (L72):
  `len < shieldradius(36)  &&  abs(angle_difference(image_angle, shielddir)) < shieldlength(50)`
  i.e. the spear is within 36 px AND the shield is facing within 50° of the spear.
- On block:
  - If `obj_spearblocker.just > 0` (fresh press) → **PARRY**: `scr_tensionheal(2.5)`, `snd_bell_bounce_short`,
    `justflash=1.8`, blocker `event_user(1)` particle burst (L103-174).
  - Else normal block → `scr_tensionheal(1.25)`, `snd_bell` (L175-186).
  - Then blocker snaps `image_angle=idealdir`, `event_user(0)` (particles), spear `instance_destroy()`.
- If NOT blocked and `len < heartcollisionlen (16)` (L257-270): `scr_damage()` with
  `damage = lerp(12, 90, clamp((global.hp[2]-30)/250, 0..1))` (L272-277). Then destroy.
- `redhammer` spears BREAK the shield instead of being blocked (breakshield path, L74-77, L339+).

---

## 4. THE SPEARS — obj_spearshot  (spr_spear_arrow: 25x24, origin 12,11)
### Create (gml_Object_obj_spearshot_Create_0.gml)
`fakespeed=2; len=100; hp=2; grav=0;` sprite becomes `spr_spear_arrow`, highlighted to
`spr_spear_arrow_highlight` when it is the CLOSEST spear (spearblocker Step L238-261).
### Step (gml_Object_obj_spearshot_Step_0.gml)
- Position each step: `x = obj_spearblocker.x + lengthdir_x(len, direction+180)`,
  `y = obj_spearblocker.y + lengthdir_y(len, direction+180)` (L418-422, L436-443). Spawns on the OPPOSITE
  side (direction+180) and moves inward.
- `fakespeed += grav; len -= fakespeed;` (L353-357) → travels toward soul at `fakespeed` px/step.
- `if (len < 50) event_user(0)` → runs the block/hit check every step once within 50 px (L445-446).

### Spawner — scr_spearshot(dir, speed, frames, special, special2)  [gml_GlobalScript_scr_spearshot.gml]
- `special==1` → spawn green_switch (enter green mode).  (L3-6)
- Default/else branch (special is a plain int, e.g. 0) → plain blockable spear (L718-770):
  `_inst.direction = dir; _inst.fakespeed = speed; _inst.len = speed*frames; _inst.image_angle = dir`.
  **So spawn distance = speed × frames, travel speed = `speed` px/step, travel time ≈ `frames` steps.**
- special 14/17/18 = fade-in variants; 19-22,40-42 = bounce shells; 25 = long spear; 35/355 = red hammer.

### Direction words (scr_spearpattern.gml L9-19): `"u"=270, "d"=90, "l"=0, "r"=180`.
A `"u"` spear spawns ABOVE the soul (dir+180=90 → +y up) and moves down; block it by pressing **Up**
(shield idealdir 90 → shielddir 270 matches spear angle 270).

---

## 5. CADENCE / SEQUENCING (gml_Object_obj_hammer_of_justice_enemy_Step_0.gml + Other_10.gml)
Attacks are a queue built by `scr_spearpattern(...)` in Create Event `Other_10` per `attackpattern`.
Each entry stores: direction, speed, frames, special, WAIT, special2 (scr_spearpattern L117-126).
Driver loop (Step_0 L1029-1064):
```
attackcon==1: fire scr_spearshot(list[attackcount]); attackcon=2; attackcount++
attackcon==2: attacktimer++; when attacktimer >= list_attackwait[attackcount-1] → attackcon=1  // WAIT frames
attackcon==3: turn ends when no obj_spearshot remain
```
So `list_attackwait` (arg5 of scr_spearpattern) = frames to wait before firing the NEXT entry = the cadence.

### EXAMPLE VOLLEY — attackpattern 0 (the intro green-soul volley), Other_10.gml L495-508
```
scr_spearpattern(0,0,0, 1, 30);        // special 1 = GREEN SWITCH (enter green mode), wait 30f
scr_spearpattern(0,0,0, 34, 20);       // special 34 = intro dialogue trigger, wait 20f
beat = 14; spearspeed = 8;
scr_spearpattern("u", 6.4, 50, 0, 14); // up spear, 6.4 px/f, dist=6.4*50=320, ~50f travel, wait 14f
scr_spearpattern("u", 6.4, 50, 0, 14);
scr_spearpattern("u", 6.4, 50, 0, 28);
scr_spearpattern("l", 8,   50, 0, 28);
scr_spearpattern("d", 6.4, 50, 0, 28);
scr_spearpattern("r", 8,   50, 0, 28);
```
Reads as: enter green mode, wait, then Up, Up, Up, Left, Down, Right — cadence 14f between the first
pair then 28f apart. Later patterns (e.g. 100, L9-59) run 16-frame "beat" grids at speeds 20-65.

---

## 6. ASSET LIST
### Sprites (sprites.tsv: frames, w, h, originX, originY)
- spr_gerson_chevron2   6, 120, 160, (10, 78)   — the flying green chevron (uses image_index 5)
- spr_gerson_swing      7, 101,  96, (21, 43)    — the green switch flash (2x scale)
- spr_gerson_chevron    2,  32,  32, (16, 14)    — (small chevron variant, not used by green_chevron)
- spr_spearblocker      3,  64,  64, (32, 32)    — rotating shield (offset retuned at runtime: 30/31/32,
                                                    diagonal 25/26/27, via sprite_set_offset)
- spr_spear_arrow       1,  25,  24, (12, 11)    — the blockable spear
- spr_spear_arrow_highlight  4, 25, 24, (12, 11) — closest-spear highlight
- spr_spear_arrow_long  3,  25,  24, (12, 11)    — long-spear variant
- spr_green_circle_piece 1, 32,  32, (23, 10)    — shield shatter debris (breakshield)
- spr_heart / spr_dodgeheart  — soul sprites (16x16 / 20x20)

### Sounds (sounds.tsv)
- snd_smallswing (audio_sfx)      — chevron swing-in
- snd_boost (audio_sfx)           — green switch flash
- snd_jump (audio_sfx)            — diagonal-shield transform
- snd_wing (default, vol 0.8)     — shield rotates to a new facing
- snd_bell (default, vol 0.84)    — normal (non-parry) block
- snd_bell_bounce_short           — parry / just-guard block
- snd_parry_fast_nodelay          — bounce-shell parry
- snd_queen_punched_lower_heavy   — shield shatter (redhammer break)

## KEY CONSTANTS (quick reference)
- Shield/soul center = obj_heart + (10, 10).
- Spear spawn distance = speed × frames; approach speed = `speed` px/step; block window opens at len<50.
- Block: len < 36 px AND |shieldAngle − spearAngle| < 50°  (diagonal: len<46, arc 30°).
- Parry window ("just") = 4 frames after a fresh arrow press (justlength=4).
- Hit damage: lerp(12, 90, clamp((HP−30)/250, 0,1)); heart-hit radius len<16.
- Chevron: dir 180, speed 12, friction −2 (accelerating), sprite spr_gerson_chevron2 frame 5, blend c_lime(0,255,0), lives 100 frames.
