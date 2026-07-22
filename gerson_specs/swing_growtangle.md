# Gerson — Swing-Down + Growtangle Port Spec (EXACT)

Source root: `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 4 - GML\`
Colors below: GML ints are **BGR** → `R=int&255, G=(int>>8)&255, B=(int>>16)&255`.
Game runs at 30 fps; all "timer"/"frame" counts are step-events (1 step = 1 frame).

---

## 1. OBJECT MAP / PARENTS (objects.tsv)

| object | sprite | mask | parent |
|---|---|---|---|
| obj_gerson_swing_down_new | spr_gerson_swing_down_new | spr_gerson_swing_down_mask | (none listed; Create calls `event_inherited`, behaves as regularbullet) |
| obj_gerson_swing_down | spr_gerson_swing_down | spr_gerson_swing_down_mask | obj_regularbullet |
| obj_gerson_swing_down_mask | spr_gerson_swing_down | (none) | obj_regularbullet |
| obj_gerson_growtangle | (none) | (none) | (none) — the ATTACK CONTROLLER / box |
| obj_gerson_growtangle_telegraph_new | spr_gerson_swing_down_telegraph | (none) | obj_regularbullet — the ACTIVE slash hitbox flash |
| obj_gerson_growtangle_telegraph (old) | spr_whitepixel | (none) | (none) — rect/triangle zone telegraph |
| obj_gerson_growtangle_transform | (none) | (none) | (none) — box grow/shrink lerp |
| obj_gerson_growtangle_hit_fx | spr_gerson_box_hit_fx2 | (none) | (none) |
| obj_gerson_gradient_telegraph | spr_whitegradientdown_40 | (none) | (none) — edge white gradient |
| obj_growtangle | spr_battlebg_0 | spr_battlebg_0 | obj_battlesolid — the physical bullet-box the heart lives in |

Note: `obj_growtangle` (the box) and `obj_gerson_growtangle` (the attack controller) are DIFFERENT objects.

---

## 2. SPRITES (sprites.tsv: name, frames, w, h, originX, originY)

- spr_gerson_swing_down_new — 5f, 52x112, origin (28,62)  [the hammer swing anim]
- spr_gerson_swing_down_loop_new — 2f, 52x112, origin (28,62)  [post-swing loop pose]
- spr_gerson_swing_down — 4f, 52x112, origin (0,0)  [old swing]
- spr_gerson_swing_down_loop — 2f, 52x112, origin (0,0)
- spr_gerson_swing_down_telegraph — 1f, 73x360, origin (32,0)  [growtangle_telegraph_new default]
- spr_gerson_swing_down_telegraph2 — 1f, 80x360, origin (36,0)  [longtelegraph variant]
- spr_gerson_swing_down_telegraph3 — 1f, 72x360, origin (36,0)  [attackpattern 19]
- spr_gerson_swing_down_telegraph4 — 1f, 72x360, origin (36,0)  [angle==270 downward variant]
- spr_gerson_swing — 7f, 101x96, origin (21,43)  [swipe FX played by controller]
- spr_battlebg_0 — 2f, 75x75, origin (37,37)  [box sprite]
- spr_whitegradientdown_40 — 1f, 40x40, origin (0,0)  [edge gradient, frame index 9 drawn]
- spr_whitepixel — 1f, 1x1, origin (0,0)  [old zone telegraph, scaled by xscale/yscale]
- spr_gerson_box_hit_fx2 — 4f, 40x40, origin (0,21)

---

## 3. SOUNDS (sounds.tsv)

- motor_upper_quick_mid (audiogroup_default, gain 1) — plays at timer==timetoswing+2
- motor_swing_down (audiogroup_default, gain 1) — plays at timer==timetoswing+5
- snd_impact (audio_sfx, gain 0.92) — plays when image_alpha==1.2 during fade-out
- snd_eye_telegraph (mp3, gain 1) — plays via snd_play_pitch when eye telegraph starts (pitch 1; 0.95 for box-wide variants)
- snd_smallswing (audio_sfx) — growtangle controller con==2 timer==2
- snd_screenshake (audio_sfx) — growtangle controller con==0 timer==9

---

## 4. obj_gerson_swing_down_new — the SWING (main attack unit)

### Create (`gml_Object_obj_gerson_swing_down_new_Create_0.gml`)
- L2-20: timer=0, con=0, active=0, swingdowntype=0, timetoswing=22, telegraphtime=12, image_speed=0,
  speed=-7, direction=270, friction=0.4, image_xscale=2, image_yscale=2, image_alpha=1.4.
  (Sprite drawn at 2x scale, starting slightly transparent-additive at 1.4.)
- L22-23: `depth = obj_growtangle.depth + 1` if the box exists.
- L28-32: **In the hammer fight (obj_hammer_of_justice_enemy exists) OR sound_of_justice**, override to
  `timetoswing=10, telegraphtime=8`. (This is the real boss cadence — use these.)
- L34-39: `a=(global.hp[2]-30)/250; clamp a>=0; damage=lerp(12,90,a)`.
- L41-49: sound_of_justice override: target=4; damage=38 (phase1) or 58.

### Step (`..._Step_0.gml`) — cadence (with boss values timetoswing=10, telegraphtime=8)
- L1: timer++.
- L3-4: timer==2 → image_index=1.
- L6-7: timer>10 → depth=-999999 (draw on top).
- L9-10: timer==(timetoswing-telegraphtime) i.e. timer==2 → eye_con=1 (start telegraph flash + spawn hitbox telegraph). Default cadence: timer==10.
- L12-13: timer>timetoswing (>10) AND sprite still spr_gerson_swing_down_new → image_index += 0.5 each step (plays swing anim).
- L28-32: timer==timetoswing+2 (==12) → play motor_upper_quick_mid.
- L34-38: timer==timetoswing+5 (==15) → play motor_swing_down.
- L40-45: sprite==swing_down_new AND image_index>4.5 → switch to spr_gerson_swing_down_loop_new, image_index=0, image_speed=0.
- L47-56: sprite==swing_down_new AND image_index>2.5 AND con==0 → **STRIKE**: active=1, con=1, speed=50, friction=10
  (if diagonal angle 45/135/225/315 → friction=6.5). This is the moment the slash becomes a live hitbox and lunges.
- L58-81 (con==1 & speed<12): friction=4; speed floored at 5; image_alpha-=0.2 each step;
  when image_alpha==1.2 → snd_impact; when image_alpha<=0.8 → mask_index=spr_nothing & active=0 (hitbox off);
  when image_alpha<0 → instance_destroy.
- L15-26: sound_of_justice: spawn red ripple FX at timer 5/7/9.

Motion: the unit initially drifts up (speed -7, dir 270, friction 0.4 decel), then on strike lunges speed 50 in `direction` (270 by default = straight down; direction set by spawner = image_angle+270).

### Draw (`..._Draw_0.gml`)
- Two branches by `image_angle`:
  - **image_angle < 1** (vertical): draw sprite at `(x+14, y)` scale 2x2, angle, blend, image_alpha. (L11)
  - **else** (rotated): draw at `(x + lengthdir_x(14, image_angle+90), y + lengthdir_y(14, image_angle+90))`. (L70)
- Eye telegraph block (eye_con==1), on eye_index==0:
  - play snd_eye_telegraph pitch 1.
  - `_x = 0` (or -6 if version==1). `_image_angle = image_angle` (clamped to 0 if <0).
  - Spawn `obj_gerson_growtangle_telegraph_new` at
    `(x + _x + lengthdir_x(15, 270+_image_angle), y + lengthdir_y(15, 270+_image_angle))`, inst.image_angle=_image_angle.
  - Vertical branch angle==270 special (L91-98): set inst.image_xscale=1, sprite=spr_gerson_swing_down_telegraph4.
  - inst.depth = obj_heart.depth+1 if heart exists.
  - Alpha pulse: alphacon==0 → alpha+=0.2 until ==1.2 then alphacon=1; else alpha-=0.2.
  - Draw a **white flash** copy of the sprite with `d3d_set_fog(true, c_white,0,1)` at `alpha` (fog forces whole sprite to white). eye_index += 0.4 (+0.6 more if swingdowntype==1); eye_con=0 when eye_index>=5.
- sound_of_justice branches wrap the same draws in `d3d_set_fog(true, c_black,0,1)` (silhouette black).

---

## 5. obj_gerson_growtangle_telegraph_new — ACTIVE SLASH HITBOX (the "eye"/blade telegraph→hit)

### Create (`..._new_Create_0.gml`)
- scr_bullet_init; con=0, active=0, activetimer=0, longtelegraph=false, image_alpha=0.
- damage=lerp(12,90,a) same formula (sound_of_justice: 38/58/…; CleanUp uses 67).
- L26-30: hammer attackpattern==19 → image_xscale=1, sprite=spr_gerson_swing_down_telegraph3.
- L31-36: hammer reachedendphase==1 → longtelegraph=true, image_xscale=1, sprite=spr_gerson_swing_down_telegraph2.
- default sprite = spr_gerson_swing_down_telegraph (73x360, origin 32,0).

### Step (`..._new_Step_0.gml`) — telegraph→active cadence
- con==0 (fade IN):
  - normal: image_alpha += 0.2/step; at ==1 → con=1  (≈5 frames telegraph).
  - longtelegraph: image_alpha += 0.08/step; at >=1.1 → con=1 (≈14 frames).
- con==1 (fade OUT / go active):
  - image_alpha counts DOWN; when image_alpha <= -1.3, activetimer++; active=1 ONLY on activetimer==3 (single-frame hit window), else active=0.
  - normal: image_alpha -= 0.4/step, destroy when <= -3.4.
  - longtelegraph: image_alpha -= 1/3 per step, destroy when <= -2.
- So the blade telegraphs bright, then swings; the damaging frame is a brief window while alpha is deep-negative (used only as a counter — sprite invisible then).

### Draw (`..._new_Draw_0.gml`) — STENCIL box-clipped white blade
- Requires obj_growtangle. Uses GPU stencil: disable color-write, fill full camera rect at alpha 0, then fill the BOX interior rect (`obj_gerson_growtangle.x1+3 .. x2-3`, `y1+3 .. y2-3`, or gt_minx/maxx fallbacks) at `image_alpha`, then re-enable color and `draw_self()` with `bm_dest_alpha / bm_inv_dest_alpha`, alphatest ref 1. Net effect: the blade sprite is drawn only inside the box, masked by the stencil.

### CleanUp (`..._new_CleanUp_0.gml`) — DAMAGE application
- recompute damage=lerp(12,90,a); sound_of_justice → damage=67.
- if active==1: `scr_damage()` (or scr_damage_all if target==3); destroyonhit → destroy.

---

## 6. obj_gerson_growtangle — ATTACK CONTROLLER (vine/box sequence)

Spawned from `scr_spearshot.gml:450` (attack arg3==31). (Transform-shrink variant from L426.)

### Create (`..._Create_0.gml`)
- x1/x2 = ceil(obj_growtangle.x ∓ sprite_width/2); y1/y2 = ceil(obj_growtangle.y ∓ sprite_height/2). (box = 75x75 → ±37.)
- `col = merge_color(c_green, c_lime, 0.5)` → **RGB ≈ (0, 191, 0)** (c_green 0x008000, c_lime 0x00FF00, mid).
- depth = obj_growtangle.depth - 1; **obj_growtangle.x = -99999** (hides real box); timer=0, con=0, xxprev=0, maxx=0.

### Step (Step_2 = End-Step, `..._Step_2.gml`)
- Destroys if global.turntimer<1. Clamps obj_heart inside x1+3..x2-3-15, y1+3..y2-3-15 (heart 15px, kept in the drawn zone).

### Draw (`..._Draw_0.gml`) — the whole growtangle sequence + green box render
- con==0 (intro, ~35f):
  - timer==2: spawn obj_animation with spr_gerson_swing (7f, 101x96), image_speed 0.5, 2x scale, at (heart.x+40, heart.y-10) — the swipe FX.
  - timer==9: heart → spr_heart black; spawn obj_gerson_fakeheart at heart, directionhit=180, speed=15.6; spawn obj_shake; snd_screenshake.
  - timer>11: x1 tracks fakeheart.x - 30 (min camerax+50) — LEFT wall follows fake heart.
  - timer==35: con=1, timer=0, xxprev=fakeheart.x.
- con==1 (growth phase):
  - every 20 frames `(timer%20==0)` AND heart.x < x2-80: spawn `obj_gerson_swing_down_new` at `(heart.x+20, y1+20)`, clamped x <= camerax+260. (Repeated swings rain from the top edge.)
  - as fakeheart moves right (xxprev<xx): y1 += 2 each such frame (top wall creeps DOWN, box shrinks vertically), y1 capped at cameray+250; xxprev updated.
  - x1 = fakeheart.x - 30 (min camerax+50).
  - when heart.x > x2-50 AND timer>30 → con=2, timer=0.
- con==2 (restore, ~20f): lerp x1/x2/y1/y2 back toward the real box bounds (factor 0.2/step); obj_growtangle.x restored to xstart, alpha 0.
  - timer==2: snd_smallswing; spawn obj_spearblocker.
  - timer==20: obj_growtangle.image_alpha=1; destroy controller.
- Box outline drawn every frame (L122-128): `draw_set_colour(col)`; 4 edges via `d_line_width(...,4)` (4px thick green border):
  left `(x1,y1-1)-(x1,y2+2)`, top `(x1,y1+1)-(x2,y1+1)`, right `(x2,y1-1)-(x2,y2+2)`, bottom `(x1,y2)-(x2,y2)`.

### CleanUp (`..._CleanUp_0.gml`): restore obj_growtangle → spr_battlebg_0, xscale/yscale 1.5, alpha 1.

---

## 7. obj_gerson_growtangle_telegraph (OLD zone telegraph) — rect/triangle hit-zone shapes

### Create: con=0, special=0, image_alpha=0.
### Step (`..._Step_0.gml`): image_alpha += 0.2/step to 1 (con=0), then con=1 fades -0.2/step, destroy <0. (Symmetric ~5f up / 5f down pulse.) Destroy if turntimer<1.
### Draw (`..._Draw_0.gml`): white-filled zone, alpha=image_alpha. Zone defined by `image_xscale`/`image_yscale` (used as pixel WIDTH/HEIGHT, set by spawner), clamped to box bounds:
- special==0, box maxxscale==2: rect clamped to `[x-210 .. x+215] × [y-35 .. y+35]`; else clamped to `±53` square. Filled `ossafe_fill_rectangle_color(... c_white)`.
- special==1: HALF/DIAGONAL fill — 4 triangles over a hexagon spanning right-top to left-bottom (diagonal split ↘): pts around obj_growtangle center at ±53.
- special==2: mirror diagonal (↙).
- special==3: vertical strip `x-30 .. x+32`, `y-53 .. y+53`.
- special==4: horizontal strip `x-53 .. x+53`, `y+30 .. y-32`.
Spawned by obj_gerson_swing_down_mask Other_10 with xscale/yscale like 142×72, 72×142, 70×142 depending on side/swingdowntype (see file for exact placement).

---

## 8. obj_gerson_growtangle_transform — box resize

### Create: timer=0, shrink=false, grow=false.
### Step: if shrink → lerp obj_growtangle.maxxscale/maxyscale/image_xscale/image_yscale toward **1.5** (0.2/step) and push heart out of box (6 iters, 1px away from center). if grow → lerp toward **2** (0.2/step). timer++ destroy at >30 (or turntimer<1).

## 9. obj_gerson_growtangle_hit_fx
### Create: dir=1, timer=0.
### Step (Step_2): x = obj_growtangle.x ∓ 74 (dir -1 → +74, dir 1 → -74). If sprite==spr_gerson_box_hit_fx2: timer++ destroy at timer==6.
### Other_7 (animation end): instance_destroy.

## 10. obj_gerson_gradient_telegraph — screen-edge white gradient wipe
### Create: timer=0, side="left", depth=-9999999999 (very front). image_alpha defaults 1.
### Draw (`..._Draw_0.gml`): draw spr_whitegradientdown_40 **frame index 9**, xscale 20, yscale 1, rotated by side, fading image_alpha -= 0.1/step (10 frames), destroy at <0:
- "left": at (camerax+40, cameray), angle -90.
- "right": at (camerax+camerawidth-40, cameray+cameraheight+40), angle 90.
- "up": at (camerax+camerawidth, cameray+40), angle 180.
- "down": depth=obj_battlecontroller.depth-2, at (camerax, cameray+cameraheight-40), angle 0.

---

## 11. HOW ATTACKS ARE INVOKED (scr_spearshot.gml + hammer)

- `gml_GlobalScript_scr_spearshot.gml:450` (arg3==31): `instance_create(x, y, obj_gerson_growtangle)` — starts the whole growtangle box sequence.
- `..._spearshot.gml:426` (arg3==27): `obj_gerson_growtangle_transform` with shrink=true.
- `..._spearshot.gml:452-488` (arg3==32): direct single-swing spawns of `obj_gerson_swing_down_new` relative to `obj_growtangle`:
  - arg2>=0: at (box.x+arg0, box.y+arg1), image_angle=arg2, direction/gravity_direction=arg2+270.
  - arg2==-1: at (box.x+70, heart.y), angle 270, dir 540 (from RIGHT).
  - arg2==-2: at (box.x-70, heart.y), angle 90, dir 360 (from LEFT).
  - arg2==-3: at (box.x+arg0, box.y+arg1), angle arg2, version=1.
- `gml_Object_obj_hammer_of_justice_enemy_Step_0.gml:625-647`: creates the box `obj_growtangle` at screen center, sets depths, scr_turntimer(90).
- Hammer Step_0 L1128-1137: box afterimage trail while hspeed!=0. hitbox_con 1/2 shove box + heart hspeed ±16, friction 0.8.
- Hammer Other_24: cleanup destroys obj_gerson_swing_down (and many others) between turns.

---

## 12. DEPTH / LAYER ORDER (front→back within attack)
1. obj_gerson_gradient_telegraph: depth -9999999999 (frontmost) / down-side = battlecontroller.depth-2.
2. obj_gerson_swing_down_new after timer>10: depth -999999.
3. obj_gerson_growtangle_telegraph_new / old telegraph: obj_heart.depth+1.
4. obj_gerson_swing_down_new (early): obj_growtangle.depth+1.
5. obj_gerson_growtangle controller: obj_growtangle.depth-1.
6. obj_growtangle box: its own depth (battlecontroller set to box.depth+2, box set to box.depth-2 during setup).
