# Jevil Port Spec — Devilsknives/Scythes (A) & Carousel (B)

Source GML: `DELTARUNE Chapter 1 - GML\`. GML angles are Y-UP (lengthdir_y sign flips vs screen).
Scale convention: DeltaVersus JS(g) = g / 1.6. Sprite dims from `sprites.tsv` (name, frames, w, h, originX, originY).

---

## A. DEVILSKNIVES / CENTER SCYTHES  (obj_dbulletcontroller types 75 & 76)

Spawner: `gml_Object_obj_dbulletcontroller_Step_0.gml:1449-1464`
- `type==75 || type==76`: on first step (`special==0`) play `snd_spearappear`, create ONE `obj_centerscythe` at (0,0), copy damage/inv/target/grazepoints/timepoints into it, set special=1.
- type 75 = INSANE variant (insanity=1). type 76 = ORDERED variant (insanity=0, sinespeed 1.3, adds red side-scythe bullets). Detected in scythe Create via `obj_dbulletcontroller.type == 76`.

obj_centerscythe Create — `gml_Object_obj_centerscythe_Create_0.gml`
- damage=124, inv=120, grazepoints=3, timepoints=2 (:2-6).
- centerx/centery = obj_battlesolid.x/y, fallback (320,120) (:16-23).
- radius=150 (:25). sinespeed=1.4 (:27). dirspeed = 1.5 * choose(1,-1) (:29). rotspeed starts 0.
- type 76 branch (:45-52): insanity=0, sinespeed=1.3, scythesidex=choose(1,-1).
- The FIRST instance becomes `king=1` and spawns the other THREE → total **4 scythes** (:54-98):
  - king: dir per first instance, placed via lengthdir; s2 dir=180 un=1; s3 dir=90 un=0; s4 dir=270 un=1.
  - all share sinespeed/dirspeed/insanity from king; positioned `x=centerx-lengthdir_x(radius,dir)`, `y=centery-lengthdir_y(radius,dir)`.

obj_centerscythe Step — `gml_Object_obj_centerscythe_Step_0.gml`
- Fade in image_alpha += 0.04 → active (:1-11).
- Spin: un==0 → rotspeed climbs to +10; un==1 → rotspeed falls to -10 (±1/frame) (:15-25). `image_angle += rotspeed` (:108).
- Orbit: `sine += sinespeed`; `dir += dirspeed` (:27-28).
- **Pendulum-through-centre**: `length = cos(sine/18) * radius`; `x = centerx - lengthdir_x(length,dir)`; `y = centery - lengthdir_y(length,dir)` (:39-41). length swings +radius→0→-radius, so each scythe sweeps THROUGH the centre along an axis `dir` that itself rotates. 4 scythes = 4 rotating axes crossing centre.
- insanity==1: dirspeed accelerates by ±0.01/frame toward cap ±3 (:30-37).
- king plays `snd_swing` when passing centre (`abs(length)<=8`, buffer 10f) (:43-52).
- type==76 king side-scythe (:55-105): every 60f spawn `obj_collidebullet` sprite `spr_joker_scythebody`, scale 2×2, image_blend c_red, at (centerx+radius*side, centery+60*side); frames 60-70 angle +=10*side & fade in; 85-90 hspeed -=3*side (flings out); 100-105 fade out; 105 destroy & flip side, reset timer to 59.
- Graze cooldown 30f (:110-119).

Sprite: `spr_joker_scythebody` 48×45 origin (22,21), 1 frame; mask `spr_joker_scythebody_mask` 46×43 origin (21,20). Base scale 1×1 (side-scythes 2×2). JS(1)=0.625, JS(2)=1.25.

---

## B. CAROUSEL  (obj_dbulletcontroller types 62 & 61)

Spawner: `gml_Object_obj_dbulletcontroller_Step_0.gml` — fires once at `btimer>=40 && made==0`, then made=1.

### type 62 (single) — :1265-1285 → **21 horses**
- Loop `i=0..2` (rows) × `j=0..6` (7 per row) = 21.
- Each: `obj_carouselbullet` at (battlesolid.x+150, (battlesolid.y-80)+i*80). Rows at y = -80/0/+80.
- siner = j*18; vsin = j*9; sinspeed = 1.15; altmode = 3.

### type 61 (DOUBLED) — :1224-1263 → **18 horses**
- `vseed = random(300)`. Loop `j=0..2` × `i=0..2`, TWO instances per inner iter = 3*3*2 = 18.
- inst A: siner=j*42, vsin=vseed, image_index=0, altmode=2, sinspeed=1.1.
- inst B: siner=j*42+21, vsin=vseed, image_index=1, altmode=1, sinspeed=1.1.
- 1/50 chance image_index=2 (:1251-1254). Same x/y grid as type 62.

obj_carouselbullet Create — `gml_Object_obj_carouselbullet_Create_0.gml`
- hspeed=6 (→ maxspeed, then hspeed set 0 in step), damage=124, inv=120, grazepoints=10, timepoints=10, image_xscale/yscale=2, image_speed=0.

obj_carouselbullet Step — `gml_Object_obj_carouselbullet_Step_0.gml` (pseudo-3D)
- Fade in alpha+=0.04, active at t==25 (:1-5).
- `siner += sinspeed`; horizontal orbit: `x = obj_battlesolid.x - sin(siner/20)*150` (radius 150) (:14-18).
- Facing/scale: `sinsign = sin(siner/20) - sin((siner-1)/20)`; `image_xscale = sinsign*50` clamped to ±2 (:15-25). Horse squashes to edge-on at the turns, full-width across face.
- **Front vs back / hurtbox** (:27-42):
  - `sinsign > 0` → moving to back: depth=21, active=0 (NO hurt), image_blend c_gray.
  - `sinsign < 0` → moving to front: depth=0, active=1 (HURTS, if alpha>=1), image_blend c_white.
- Vertical bob: altmode 0/2/3 → `y += sin(vsin/10)*3.5`; altmode 1 → `y -= sin(vsin/10)*3.5` (opposite phase) (:44-50). vsin+=1/frame.

Sprite: `spr_carousel` 36×29 origin (18,20), 3 frames. Base scale 2×2 → JS(2)=1.25. (bg `spr_carouselbg` 700×300.)

---

## KEY NUMBERS
A: 4 center-scythes; radius 150 about centre (battlesolid x/y, fallback 320,120); axes dir 0/90/180/270 rotating at dirspeed 1.5*±1 (insanity type75 accel +0.01 → cap 3); pendulum length=cos(sine/18)*150 sweeps THROUGH centre; sine+=sinespeed 1.4 (75) / 1.3 (76); spin rotspeed→±10 (±1/f); damage 124, inv 120, graze3/time2; snd_spearappear spawn, snd_swing at centre; sprite spr_joker_scythebody 48×45 o(22,21) scale 1×1; type76 red side-scythe 2×2 flung every 60f.
B: type62=21 horses (3 rows×7), type61=18 (3×3×2 doubled); grid x=solid.x+150, rows y=solid.y-80/0/+80; orbit x=solid.x - sin(siner/20)*150 (r150); sinspeed 1.15 (62)/1.1 (61); facing image_xscale=sinsign*50 clamp±2; front(sinsign<0)=white active HURTS depth0, back(sinsign>0)=gray inactive depth21; bob y±=sin(vsin/10)*3.5; damage124 inv120 graze10/time10; sprite spr_carousel 36×29 o(18,20) 3f scale 2×2.
