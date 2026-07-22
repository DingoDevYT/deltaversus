# Gerson (Hammer of Justice) — EXACT Port Spec: RUDEBUSTER / BELL / CANE / SQUISH

All refs are `file:line` into `DELTARUNE - GML\DELTARUNE Chapter 4 - GML\`.
GML colors are BGR ints: R=int&255, G=(int>>8)&255, B=(int>>16)&255.
Named consts used here: `c_white`=RGB(255,255,255), `c_red`=RGB(255,0,0),
`c_lime`=RGB(0,255,0), `c_black`=RGB(0,0,0). No raw BGR ints appear in these objects.

Global room note: the arena box is `obj_growtangle` (sprite `spr_battlebg_0`, 75x75, origin 37,37).
Player soul is `obj_heart`. Susie hero is `obj_herosusie` / `obj_heroparent`. Bullets self-destroy on `global.turntimer < 1`.

Invocation dispatcher is `scr_spearshot(arg0=x, arg1=y, arg2, arg3=code)`:
- code 5  -> `instance_create(x,y,obj_gerson_box_hit_controller)` (scr_spearshot.gml:168) — box-side diamond barrage
- code 6  -> `instance_create(x,y,obj_gerson_bell_attack_controller)` (scr_spearshot.gml:172) — bell attack
- code 13 -> `instance_create_depth(x,y,depth,obj_gerson_squishes_box); gers.type=5` (scr_spearshot.gml:231) — jump-flatten
- code 53 -> `instance_create(x,y,obj_gerson_box_rumble_controller)` (scr_spearshot.gml:701) — box side-shove

===============================================================================
## RUDEBUSTER  (obj_gerson_rudebuster + obj_oflash_gerson_buster)
===============================================================================
This is the homing "orb" Gerson launches at Susie; the player presses a button to
knock it back (deflect) for big damage, otherwise it hits Susie.

### INVOCATION
- Spawned from `obj_hammer_of_justice_enemy` Draw at swingtimer==12:
  `blast = instance_create(x - 40, y + 20, obj_gerson_rudebuster)` — Draw_0.gml:290
  sets `blast.battlemode=0; blast.target=1281; blast.image_alpha=1;` then
  `snd_play(snd_rudebuster_swing)`, `rudebusterhitcount++`, spawns `obj_shake`. (Draw_0.gml:290-296)
- `obj_gerson_rudebuster` object sprite = `spr_rudebuster_beam` (objects.tsv), but Create overwrites
  behavior; it is drawn via `draw_self` with the beam sprite. `spr_rudebuster_beam`: 7 frames, 43x62, origin 20,30.

### VISUALS
- Create (Create_0.gml:19-23): image_alpha=0 (fades in +0.25/step to 1, Step_0.gml:1-4),
  image_xscale=2, image_yscale=2, image_speed=1, image_angle=180.
- Flying afterimage trail: each step while `explode==0 && speed!=0` spawn `scr_afterimage()`
  with image_yscale=1.8, image_index=4, image_speed=0.5, alpha=image_alpha-0.2; each trail
  shrinks image_yscale-=0.1, dies at <=0.1. (Step_0.gml:276-308)
- "PRESS Z" / button prompt drawn over Susie while susieattackcon==0 and orb near her
  (`x < camerax()+330`): red<->white pulse `merge_color(c_white,c_red,0.5+sin(t)/2)`, translucent
  bg rect. (Draw_0.gml:56-73)
- Hurt flash: white fog overlay, alpha starts 1, -=0.1/step. (Draw_0.gml:75-81)
- `obj_oflash_gerson_buster` = white hit-flash decal on the struck target: draws sprite (set by
  caller to `spr_susieb_hurt`, 54x45, origin 20,0) under `d3d_set_fog(true, flashcolor=c_white)`,
  alpha=sin(siner/3), siner+=1/step, self-destroys when siner>4 && sin(siner/3)<0. Tracks
  `x=(target.x-20)+target.hurtindex*10`. (oflash Create/Draw)

### MECHANICS — homing
- Create vars: target=3, damage=60 (both overwritten from initial values), tmax=4, t=0. (Create_0.gml:34-52)
- First frame (t==0, Step_0.gml:132-146): targetx/y = center of target instance; 
  `direction = point_direction(x,y,target) - 20`; **speed=9; friction=-1.5** (accelerates while flying);
  image_angle=direction.
- Homing (t>=1 && explode==0, Step_0.gml:148-166):
  `dir = point_direction(x,y,cx,cy); direction += angle_difference(dir,direction)/4;` (turn rate = 1/4 per step)
  image_angle=direction.
  When `point_distance(x,y,cx,cy) <= 40`: hitsusietimer++; on hitsusietimer==2 && hitback==false ->
  visible=0, explode=1, t=1 (impact on Susie).

### MECHANICS — deflect (press to knock back)
- Step_0.gml:6-24: if (`button1_p()||button2_p()||button3_p()`) && hurtflashalpha==0 && explode==0 &&
  obj_herosusie.hurt==0  ->  buffer_z=2  (buffer window, decremented each step at Step_0.gml:130).
- While buffer_z>0 (same guards): susieattackcon=1, play `snd_ultraswing` x2, set Susie to
  `spr_susie_hitback_miss` (offset 18,9), slowdown con. (Step_0.gml:9-24)
- susieattackcon==1 sequence (Step_0.gml:26-75):
  - susieattacktimer==4: **deflect connects only if `x < camerax()+330`** (orb must be close enough).
    -> hitback=true, Susie `spr_susie_hitback`, shake, `obj_shake`, `snd_criticalswing`, hurtflashalpha=1,
       direction=0, x+=10, spawn hit fx (`spr_gerson_hit_fx4`, xscale/yscale=2), afterimage screen fade.
    -> susieattackcon=2.
  - susieattacktimer==9: reset to susieattackcon=0 (whiffed if it never connected).
- susieattackcon==2 = knockback launch (Step_0.gml:77-128, Draw_0.gml:1-52):
  - obj_heroparent.x += 1 each step.
  - susieattacktimer==2: spawn `spr_susie_gerson_hitbback_fx_1` (scale 3).
  - Draw shows `spr_gerson_rude_orb2` scaling 1.2->0.8->0.6->0.5 at timers 7..10, spinning
    (angle -= timer*80), and 4 `obj_particle_generic` sparks/step while timer<7. (Draw_0.gml:3-49)
  - susieattacktimer==10: Susie image_index=12, `spr_susie_gerson_hitbback_fx_2` (scale 3), shake,
    `snd_rudebuster_hit`+`snd_rudebuster_swing`, spawn **obj_rudebuster_bolt** (the actual damage beam)
    at heroparent, direction=0, speedmax=10, gersonswingtimer=4, gersonoffset=-20,
    **damage = ceil((global.battlemag[1]*5 + global.battleat[1]*11) - global.monsterdf[0]*3)**. Then destroy self.
    (Step_0.gml:92-124)

### MECHANICS — explode (orb hits Susie, not deflected)
- explode==1 (Step_0.gml:168-274): Susie hurt=1; slowdown con.
  - t==1: `damage = lerp(12, 90, b)`, `b = clamp((global.hp[2]-30)/250, 0, +inf)`; global.inv=-1;
    rudebusterhitcount=0; **progress += 6**; mercylaughcon=1, mercylaughcount=6; scr_damage_all().
    On target spawn `obj_oflash_gerson_buster` (spr_susieb_hurt). `snd_rudebuster_hit`.
    Spawn **8 afterimage bursts** at image_angle=45+i*90 (i=0..7), speed=25, image_speed=0.5. (Step_0.gml:187-248)
  - t>=2: bursts decay speed*=0.75/0.8, xscale*=0.8. (Step_0.gml:251-270)
  - t>=18: instance_destroy. (Step_0.gml:272-273)
- susiehitbyrudebustercount increments, rudebusterdelay=20. (Step_0.gml:203-210)

### NOTE — obj_rudebuster_anim_gerson (separate, TITAN cutscene, not the boss orb)
Create: xscale=-2, yscale=2, image_speed=0.5, sprite `spr_gerson_rudebuster` (17f,101x96,origin 21,43).
Step: at t==14 fires `obj_rudebuster_bolt` at (x-132,y+14), damage=1950+irandom(100), speedmax=44,
sprite `spr_rudebuster_beam_green`; at t>=32 restore Gerson & destroy. (anim_gerson Create/Step)

### ASSETS — RUDEBUSTER
Sprites: spr_rudebuster_beam (7,43x62,o20,30), spr_rudebuster_beam_green, spr_gerson_rude_orb2
(1,50x50,o25,25), spr_gerson_hit_fx4 (4,66x102,o0,0), spr_susieb_hurt (1,54x45,o20,0),
spr_susie_hitback / spr_susie_hitback_miss, spr_susie_gerson_hitbback_fx_1/_2, spr_gerson_rudebuster (17,101x96,o21,43).
Sounds: snd_rudebuster_swing, snd_rudebuster_hit, snd_ultraswing (x2), snd_criticalswing.

===============================================================================
## BELL  (obj_gerson_bell_attack_controller, obj_gerson_bell, obj_gerson_bell_hit,
##         obj_gerson_bell_bullet, obj_gerson_bell_bullet_radial)
===============================================================================
Two bells hang on the sides; Gerson rings them to fire musical-note bullets in radial
spirals / spreads / rows. Note bullet = `spr_gerson_musical_note2` (1f, 24x24, origin 12,12).

### SETUP (bell_attack_controller Create_0.gml:1-14)
- Spawns 2 `obj_gerson_bell`:  left @ (growtangle.x - 235, growtangle.y - 60);
  right @ (growtangle.x + 160, growtangle.y - 60).
- Spawns 2 `obj_gerson_teleport` (type 3) as the ringers @ growtangle.x ± 340, .y (left xscale +, right xscale -2).
- Hammer hidden. Controller & bells self-destroy when turntimer<1.
- `obj_gerson_bell`: sprite `spr_gerson_bell` (1f, 83x120, origin 0,0), xscale=2, yscale=2, image_speed=0.

### RING CADENCE (all obj_gerson_bell_hit variants share con FSM)
con0: timer++; timer==14 -> `snd_play(motor_upper_quick_mid)` (wind-up);
      timer==16 -> fire (con=1), `snd_queen_punched_lower`, shake, image_index=1, pick nearest bell.
con1: image_index=2 after N frames.  con2: reset con=0, image_index=0, set timer negative (= inter-shot delay).
Facing chosen by `image_xscale>0` (right ringer) vs `<0` (left ringer). Bullets spawn at
`bell.x + (22 or 42)`, `bell.y + 60`, target=3, damage=1.

### VARIANT A — Step_0 (radial spiral), obj_gerson_bell_bullet_radial
File bell_hit_Step_0.gml. angle_offset = random(40)-20. con1 at timer==4; con2 at timer==4 -> timer=-22.
- `choose(0,1)`==0: **7 shots**, place = (220 - 24*i) + offset  (right; left: 220 + 24*i), type=0.
- else: **10-11 shots**, place = (220 - 16*i) + offset (right, 10 shots) / (220 + 16*i) (left, 11 shots), type=1.
Radial bullet motion (bell_bullet_radial): pos = xstart + lengthdir_x(length, place); length += fakespeed;
place += dirspeed  (spiral).  Create: place=1,speed(unused for pos)=20,length=0,fakespeed=8,dirspeed=1.
  type0: fakespeed lerp 16->4 (t<=12) then 4->16; dirspeed 2.25->1.5 then 1.5->2.25; fade after timer>24.
  type1: fakespeed 14->3 then 3->9; dirspeed 3->1.25 then 1.25->1.75; fade after timer>40.
Off-screen cull at view ±80 / +760 / +580.

### VARIANT B — Other_24 (7-shot fan), obj_gerson_bell_bullet_radial
File bell_hit_Other_24.gml. angle_offset = random(60)-30. Also plays `snd_bell`.
con1 timer==6, con2 timer==6 -> timer=-47.
- right (xscale>0): **7 shots**, place = (270 - 30*i) + offset, spawn bell.x+42,bell.y+60.
- left: **7 shots**, place = 250 + 30*i + offset, spawn bell.x+42,bell.y+60.

### VARIANT C — Other_25 (note row + diamond radial)
File bell_hit_Other_25.gml. slowbullet1 = irandom(4). Right side only fires (left just shakes).
- **5 `obj_gerson_bell_bullet` notes**, skipping index slowbullet1 (=4 notes), image_xscale/yscale=1.4,
  direction=180, pos=i, at bell.x+42,bell.y+60.
- **5 `obj_collidebullet` diamonds** (`spr_diamondbullet`, 33x32, o16,15): direction = (i/5)*180 + 110 + dir,
  speed=1, friction=-0.3 (accel); bighearttype==1 -> friction=-0.23 and dir bias ±(25 + random10);
  element=6. (bell_bullet_Step handles note motion below.)

### obj_gerson_bell_bullet (musical note, VARIANT C) motion — bell_bullet_Create/Step
Create: dir=1, speed=20, ypos[0..4] = growtangle.y + {-60,-30,0,+30,+60}.
Step: timer<16 speed lerp->4 (decel); timer<11 y lerp ystart->ypos[pos] (snap to a lane over 10f);
timer>15 speed lerp 4->20 over 40f (re-accelerate); fade -0.1 alpha once past growtangle.x ± 75.

### ASSETS — BELL
Sprites: spr_gerson_bell (1,83x120,o0,0), spr_gerson_musical_note2 (1,24x24,o12,12),
spr_diamondbullet (1,33x32,o16,15), spr_gerson_swing_side (bell_hit obj sprite, 3,106x50,o0,0).
Sounds: motor_upper_quick_mid, snd_queen_punched_lower, snd_bell (also snd_play_pitch 0.8 / 1.1 in a
2nd unread variant path), snd_wing.

===============================================================================
## CANE  (obj_gerson_cane_bullet)   sprite spr_gerson_cane (1f, 20x6, origin 9,5)
===============================================================================
A spinning cane that arcs onto the field and ricochets around the arena-box corners
whenever it strikes the soul, each bounce firing a bullet wave. (This is a **Guei-enemy**
attack, NOT hammer_of_justice: spawned at `obj_guei_enemy` Step_0.gml:428
`instance_create(gerson.x, gerson.y, obj_gerson_cane_bullet)`.)

### VISUALS / ENTRY (Create_0)
image_angle=80, image_xscale=2, image_yscale=2, anglespeed=30 (spin rate), angledirection=1.
`scr_jump_to_point(camerax()+350, cameray()+128, 10, 45)` — parabolic entry over 45 frames, apex jump 10.
`snd_play_pitch(snd_slidewhistle, 1.3)`. Depth pinned to obj_growtangle.depth-1 while it exists.

### MECHANICS (Step_0)
- Spins: image_angle += anglespeed (or -= if angledirection!=1). anglespeed decays -0.2/step (-0.8 extra while con==2).
- timer==45 (landing): anglespeed=2, `scr_shakeobj()`, `snd_play(snd_wing)`, depth bumped.
- con1 (after alarm[0] fires): `scr_lerpvar` x->xtarget, y->ytarget over 20f, then con2; con2 & anglespeed==0 -> con0, alpha=1.
- Alarm_0: `snd_play_pitch(snd_slidewhistle, 2)`, anglespeed=38 (re-spin burst).
- Destroys itself once obj_heart no longer exists (after init). (Step_0.gml:53-57)

### ON HIT SOUL (Collision_obj_heart)
con==0 only: `snd_wing`, image_alpha=0.75, con=1, hitcount++, `alarm[0]=28`.
Cane teleport-lerps to a growtangle **corner** cycling with hitcount, and each hit pushes
`obj_dbulletcontroller { n=1; special++; }` (fires the next scripted bullet wave):
- hitcount 1 -> xtarget=growtangle.x+45, ytarget=growtangle.y-45
- hitcount 2 -> (growtangle.x-45, growtangle.y-45)
- hitcount 3 -> (growtangle.x-45, growtangle.y+45)
- hitcount 4 -> (growtangle.x+45, growtangle.y+45), hitcount resets to 0
(Collision_obj_heart.gml:1-57)

### ASSETS — CANE
Sprites: spr_gerson_cane (1,20x6,o9,5); related spin sprites spr_gerson_cane_spin (12,83x60,o23,20),
spr_gerson_cane_spin_loop (2,83x60). Sounds: snd_slidewhistle (pitch 1.3 then 2), snd_wing.

===============================================================================
## SQUISH  (obj_gerson_squishes_box + obj_gerson_box_hit / box_hit_controller +
##          obj_gerson_box_rumble_controller)
===============================================================================
Gerson rockets up and body-slams the arena box FLAT (super-wide, super-short). Separate
controllers handle the diamond barrage across the box and the side-to-side box shove.

### PART 1 — FLATTEN  (obj_gerson_squishes_box, invoked scr_spearshot code 13, type=5)
Create (Create_0): image_xscale=2, image_yscale=2, image_speed=0, hammer hidden.
con0 (Step_0.gml:1-39):
  - timer==1: **vspeed=-48** (launch up), `snd_jump`+`snd_rocket`+`snd_screenshake`, obj_shake (2,2).
  - each step spawn afterimage (fadeSpeed 0.2); gravity `vspeed += 0.8` while vspeed<0.
  - timer==14: con1, vspeed=0, x=growtangle.x, y=cameray(), sprite=`spr_gerson_dodge_origin_top_bottom`
    (1f, 49x67, origin 31,67), image_index=0.
con1 (Step_0.gml:41-58): y lerp cameray() -> growtangle.y-70 over 5f; timer==5 -> con2, shake.
con2 = **THE SQUISH** (Step_0.gml:60-91): sets hammer.squishbox=true. timermax=10.
  Box (`obj_growtangle`) target absolute scales (base sprite 75x75):
  - timer<=10:  xscale -> lerp(9, 6, timer/10)   (WIDE, 675px -> 450px)
                yscale -> lerp(0.2, 1, timer/10)  (FLAT, 15px -> 75px)   [via lerp(current,target,timer/10)]
  - timer>10:   xscale -> lerp(5, 6, timer/15)    (settle ~450px)
                yscale -> lerp(1.2, 1, timer/15)   (settle ~75px)
  - Gerson y = growtangle.y - 35*growtangle.image_yscale (rides the box top).
  - timer>=15: spawn `obj_gerson_teleport` at (x, y-67), destroy.
  Net: box snaps from square to a very wide/very short slab (peak ~9x wide, ~0.2x tall) then settles ~6x0.9.

### PART 2 — DIAMOND BARRAGE across box (obj_gerson_box_hit + box_hit_controller, code 5)
box_hit_controller Create: timer=15, con=choose(0,1), count=7, first=0. Step: alternates spawning
`obj_gerson_box_hit` (type1 teleporters) on left/right at growtangle.x ± 180, .y+20, counting down
`count` from 7; at count==-1 sets global.turntimer=12 (ends). (box_hit_controller Step_0.gml)

obj_gerson_box_hit (sprite `spr_gerson_swing`, 7f, 101x96, o21,43; xscale/yscale=2):
Step_0 con0: image_index ramps after timer>16; timer==18 `motor_upper_quick_mid`; timer==20 fire:
`snd_queen_punched_lower`, shake. Facing: xscale>0 -> side_x=+80, dir=180 (fire leftward across box);
else side_x=-80, dir=0. `rand = choose(1..6)` selects one of 6 fixed 10-bullet speed patterns.
**10 `obj_box_hit_bullet`** (`spr_diamondbullet`) spawned in a vertical column:
  x = growtangle.x + side_x (±80),  y = (growtangle.y - 70) + 15*i  (i=0..9, **15px spacing**),
  direction = dir (horizontal), friction = **0.14** (decelerate), depth-1.
Per-pattern speeds (px/step, index 0..9):
  rand0 (unused, rand starts at 1): base 5.6+random(2), friction .14; gap bullets (slowbullet1..4) 2+random(1.5), friction .08.
  rand1: 7.2, 6.8, 6.4, 6.0, 4.4, 4.4, 6.0, 6.4, 6.8, 7.2
  rand2: 4.8, 4.8, 4.8, 7, 7, 7, 7, 7, 4.8, 4.8, 7   (note extra)
  rand3: 4.8,4.8,4.8,7,7,7,4.8,4.8,7.6,7
  rand4: 7,7,7,4.8,4.8,4.8,4.8,4.8,7,7
  rand5: 7,7,7,4.8,4.8,4.8,4.8,6.2,6.2,7
  rand6: 4.6,4.0,3.4,5.4,5.5,5.6,6.0,6.4,6.8,7.2  (ascending "sweep")
con1 timer==6 -> con2; con2 timer==1 -> spawn obj_gerson_teleport (x±60,y+20), destroy.
NOTE: bullets travel **horizontally** across the flattened box (no gravity/rain) — the "columns" are
vertical stacks fired sideways; you dodge through the slower-bullet gaps.

### PART 3 — BOX SIDE-SHOVE (obj_gerson_box_rumble_controller, code 53)
Create (Create_0): anchor_x=growtangle.x, anchor_y=growtangle.y-40, bonk_side=-1, sprite spr_gerson_swing,
`scr_lerpvar("y",y,y+80,16)`, black oflash, `snd_boost`, global.turntimer=9999.
`box_bonk(dir, dur=24)`: green oflash, `snd_queen_punched_lower`, lerp growtangle to
  new_x = anchor_x + (100 + irandom(20))*dir,  new_y = anchor_y + irandom_range(-40,40) over dur+8 frames
  (shoves the whole arena box sideways ±~100-120px).
Step (Step_0): phase0 spawns green oflash every 3 frames until timer==24 -> phase1(timer=30);
phase1: timer==32 -> `box_bonk(bonk_side, 40)`, `bonk_side *= -1`, timer=0 (alternating shove every ~32f).
Ends when turntimer<1.
box_rumble Step_2 draws box; Draw just `draw_self`.
Soul-clamp during rumble (rumble... actually squishes_box Draw uses `obj_gerson_box_hit`? clamp is in
box-rumble draw): `obj_heart` clamped to box interior [x-71, x+53], [y-71, y+53]. (box_hit... rumble Draw)

### ASSETS — SQUISH
Sprites: spr_gerson_dodge_origin_top_bottom (1,49x67,o31,67), spr_gerson_swing (7,101x96,o21,43),
spr_diamondbullet (1,33x32,o16,15), spr_battlebg_0 (box, 2,75x75,o37,37).
Sounds: snd_jump, snd_rocket, snd_screenshake, snd_boost, motor_upper_quick_mid, snd_queen_punched_lower.

===============================================================================
## COLOR CONVERSIONS (BGR int -> RGB)  used in these attacks
===============================================================================
c_white  0xFFFFFF -> RGB(255,255,255)
c_red    0x0000FF -> RGB(255,0,0)      (rudebuster PRESS-prompt pulse)
c_lime   0x00FF00 -> RGB(0,255,0)      (box_rumble green oflash)
c_black  0x000000 -> RGB(0,0,0)        (box_rumble initial oflash)
No custom BGR integer literals are used in these objects; all tints are named constants + white-fog flash.
