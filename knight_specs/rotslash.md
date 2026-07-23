# Knight "Rotating Slash" — EXACT port spec (obj_dbulletcontroller type 104)

Source: `DELTARUNE Chapter 3 - GML/`. All angles are GML convention (0=right, 90=UP on screen; `lengthdir_x=cos(a)`, `lengthdir_y=-sin(a)` → in JS canvas y-down use `dx=cos(a), dy=-sin(a)`).

## Spawn / entry
- `gml_Object_obj_dbulletcontroller_Step_0.gml:2117-2134` (type 104): sets `global.turntimer = 999999`, hides the Knight (`creatorid.image_alpha = 0`), creates `obj_knight_rotating_slash` at Knight's x/y, copies `.difficulty` from controller, then `event_user(0)` (= Other_10). **turn_type is never set here → stays "full"** (Create default), so `local_turntimer = 400`.
- The attack ends itself: CleanUp sets `global.turntimer = -1` when it finishes (see TIMING).

## What it IS
The Knight teleports to a random spot in the box and fires a set of **full-box-crossing straight red beam-lines that all pass through one aim point** (the SOUL for `aim_type 0`). Before each cut a rotating grey→red **telegraph reticle + gradient marker lines** spin around the aim point; then the lines flash into solid white-hot triangle beams (the CUT) that instantly shrink away. The number of simultaneous lines ramps up over the turn (`slash_array`). It repeats ~every 30→20 frames, teleporting each time, for ~200 frames. On **difficulty 2 "full" turns** it finishes with a 28-hit "FLURRY" of fast spinning cuts centered on the box; other difficulties just return the Knight.
- **Line geometry:** for `slash_number = N`, each line `a` (0..N-1) has angle `dir_a = (360/(N*2))*a + random_offset + aim_direction`. Each line is drawn/attacks BOTH directions (±dir) → N full diameters → **2N rays, N lines, spaced 180/N° apart.** Safe zone = the wedge gaps between lines. N=1 → single line through the aim point.

## Object obj_knight_rotating_slash — event ledger

### Create (`..._Create_0.gml`)
`scr_bullet_init()`; `scr_darksize()` (sets `image_xscale=image_yscale=2` → **HALVE for a 1:1 port**); `image_speed=0`. Key defaults (difficulty 2 shown; overwritten by Other_10 per difficulty):
- `slash_number=1`, `slashes_done=false`
- `rotation=16`, `rotation_base=16`, `rotation_change=1`, `rotation_goal=2` (deg/frame; decelerating spin)
- `state="intro"`, `turn_type="full"`, `local_turntimer=0`, `aim_direction=0`
- `spin = choose(-1,1)`, `random_offset = irandom(360)`
- `slash_array = [1,2,2,3,3,4]` (diff-0 default), `slash_counter=0`, `final_counter=0`
- `slash_base=18`, `slash_offset=6`, `speed_gain=16`, `cooldown_time=6`, `slash_timer=8`, `aim_type=0`
- `anchor_x/y = x/y` (Knight home), `aim_x/y = x/y`
- `r=g=b=0`, `line_width=4`, `slash_list = ds_list_create()`
- `movebox_x=40`, `movebox_y=60`, `line2=-1`, `line3=-1`, `do_final=true`, `my_surface=-4`, `turn_limit_4=270`

### Other_10 = event_user(0) — difficulty & turn setup (`..._Other_10.gml`)
- **difficulty 1:** `slash_offset=6`, `slash_number=3`, `slash_array=[2,3,4,4,4,4]`
- **difficulty 2:** `slash_offset=0`, `slash_number=3`, `slash_array=[3,4,4,4,4,4]`
- **difficulty 0:** (unchanged) `slash_offset=6`, `slash_array=[1,2,2,3,3,4]`
- turn_type → local_turntimer: `"full"=400`; `"start"=320`; `"end"=300,timer=15`; `"short start"=270,timer=12,turn_limit_4=250`; `"short mid"=260,timer=15,turn_limit_4=250`; `"short end"=260,timer=15`.
- **Type-104 phase-ender is always turn_type "full" → local_turntimer=400.**

### Step (`..._Step_0.gml`) — the state machine
- L1-4: `obj_knight_enemy.siner2=0`; re-reads anchor from Knight; `local_turntimer--`.
- L6-166: `next_up` branches (1/3/4/5) chain OTHER Knight attacks (quickslash / tunnel_slasher_2 / swordfall / weird_bottom). **Not used by the type-104 ender (next_up=-1) — ignore for this port.**
- L168-176: every 4th `global.time`, spawn `scr_afterimage()` trail behind the sprite (alpha 0.6, fadeSpeed 0.04, hspeed 4).
- L178-188: advance `line2`/`line3` line-flash counters (`++`, `%=8`) when >-1.
- L190-194: clamp sprite anim: if `image_index>=5 && aim_type!=2` → hold frame 5, speed 0.
- **state "intro" (L196-205):** `timer++`; at `timer>16` → state "aim", timer=0. (16-frame entry pause.)
- **state "aim" (L207-285):** the telegraph/spin.
  - `timer==1`: `snd_stop`+`snd_loop(snd_knight_rotatingslash_line)`; `rotation=rotation_base`; new `spin=choose(-1,1)`; `r=g=b=128` (grey start); randomize teleport: `movebox_x += 20+irandom(40)`, `movebox_y += 30+irandom(60)` (wrap >80 / >120); if aim_type!=2 `image_index=1` else swap to `spr_roaringknight_flurry_prepare`. Lerp the object to `(scr_get_box(0)-20+movebox_x, scr_get_box(1)-20+movebox_y)` over `slash_base+slash_offset-8` frames ("out" ease).
  - every step: `aim_direction += rotation*spin`; `rotation = approach(rotation, 2, rotation_change)` (**spin decelerates 16→2°/frame, −1/frame diff0, −0.5 diff2-final**).
  - `timer==1` & aim_type 0: `aim_x=obj_heart.x+10, aim_y=obj_heart.y+10` (LOCK onto soul once); spawn `obj_knight_circle` reticle at aim.
  - else: ramp color grey→**RED**: `r→255`, `g→0`, `b→0` each by `9.142857` (≈128→255 / 0 over ~14 frames).
  - `timer == floor((slash_base+slash_offset)*0.5)` & aim!=2 → `image_index++`.
  - `timer == slash_base+slash_offset` → start sprite anim (`image_speed=0.5`, or flurry path delayed).
  - `timer == slash_base+6+slash_offset` → **state "slash"**, timer=0. (aim length = `slash_base+slash_offset+6`; diff0 first = 18+6+6 = **30f**, shrinks toward 15+0+6=21f.)
- **state "slash" (L287-424):** the CUT.
  - `timer==1`: stop line SFX; rebuild `slash_list` = the N angles above; `ds_list_shuffle`; **play `snd_knight_cut` + `snd_explosion_firework`**.
  - while `(timer-1) < slash_number`: spawn one `obj_roaringknight_slash` at `(aim_x,aim_y)` per frame: `image_xscale=2`, `image_angle=direction=list[timer-1]`, `visible=false`, **`width *= 2`** (→48), `aoe=true`. Also spawns `spr_knight_slash_mark` particles (red `c_red` xscale `5+rnd3`/yscale `2+rnd1`, + black underlay ×0.85, both lerp to 0 over 4f) and 8-14 red spark streaks. Then `scr_bullet_inherit(slashid)` + `with(slashid) event_user(0)` (**applies damage immediately**).
  - `timer == slash_timer (8)` → state "cooldown", timer=0.
- **state "cooldown" (L426-560):** advance sequence / decide end.
  - at `timer==cooldown_time(6)` OR `local_turntimer<200`: `slash_counter++`; if `slash_counter < 6` → `slash_number = slash_array[slash_counter]`, `slash_offset→0` (−6/f), `slash_base→15` (−1/f). (After index 6 exhausted, `slash_number` HOLDS at last value = 4.)
  - if `local_turntimer<200 && !slashes_done`: `slashes_done=true`, `local_turntimer=99999` (freeze).
  - **END BRANCH — slashes_done:**
    - **diff2 + turn_type "full" (the ender) + do_final:** trigger FLURRY: `snd_knight_puff` + `snd_knight_teleport`(pitch0.5); `rotation_base=18`, `rotation_change=0.5`, `slash_number=1`, `slash_base=24`, `cooldown_time=2`, `slash_timer=2`, `aim_type→2`, spawn `obj_afterimage_screen` (faderate .05); aim locked to **box center** `mean(box2,box0),mean(box1,box3)`.
    - **else (diff0/1):** if a "start/short*" turn → warp+continue; otherwise `state="return"`, lerp back to anchor over 12f, `alarm[3]=22` → destroy.
  - if `aim_type<2`: loop back state="aim". (aim_type1 path sets `line2=0`, `alarm[1]=4`.)
  - if `aim_type==2` (FLURRY loop): state="slash"; `aim_direction += speed_gain*spin`; `speed_gain→24` (+1/f); `final_counter++`; at `final_counter==28` → `state="return"`, sprite→`spr_ch3_wheel_center`(id2128), lerp home, `alarm[3]=22`. Else teleport again & `sprite_index=spr_roaringknight_flurry`, `image_speed=1`.
- Alarm_1: `line3=0`. Alarm_2: `next_up` chaining (unused here) then destroy. Alarm_3: `instance_destroy()`.

### Draw (`..._Draw_0.gml`) — RENDERS TO A BOX-CLIPPED SURFACE
- Creates/resizes `my_surface` = box interior minus 8px: `(box0-box2-8) × (box3-box1-8)`. All telegraph & cut visuals drawn to it, then `draw_surface(my_surface, box2+5, box1+5)` → **everything is CLIPPED to the box** (offset origin = box left+5 / top+5; subtract `(box2+5, box1+5)` from world coords).
- **Telegraph markers (state "aim" & timer):** for each of N dirs:
  - `spr_rk_quickslash_marker_gradient` frame 0 at aim, `image_angle=dir`, xscale `= timer*0.2`, yscale `= 1 + 2*(1 - timer/(slash_base+6+slash_offset))` (starts 3, shrinks to 1), blend `make_color_rgb(r,g,b)` (grey→red), alpha 1.
  - `spr_rk_quickslash_marker` frame 0, same transform, blend `c_black`.
- **Flash lines (line2/line3):** two draw_line passes at alpha `1-(line2/7)`, width `line_width(4)`, color `rgb(r,g,b)`; two parallel full-diameter lines (`±320` along dir) offset `±lengthdir(line2*6, dir+90)` — a widening double-line sweep.
- **The CUT beam (per `obj_roaringknight_slash`):** white-hot triangle, `hx=lengthdir_x(640,direction)`, half-width `width` at `dir+90`; color `make_color_rgb(255,(1-image_alpha)*255,(1-image_alpha)*255)` → **starts RED (alpha1) and whitens as it fades**. `slashdir` (±1) flips which end is the point (grows out one way).
- Finally draws its own sprite: `draw_sprite_ext(sprite_index, image_index, x, y + sin(global.time*0.1)*2, image_xscale(2), image_yscale(2), image_angle, blend, alpha)` — a 2px bob. Default sprite `spr_roaringknight_attack_ol`.

### CleanUp (`..._CleanUp_0.gml`)
`ds_list_destroy`, free surface. If turn wasn't a start/mid chain AND `<2` bullets remain: restore `obj_knight_enemy.image_alpha=1` and **`global.turntimer = -1`** (ends the turn). Stops line SFX.

## Object obj_roaringknight_slash — the damaging beam
- **Create (`..._Create_0.gml`):** `scr_bullet_init()`; `event_inherited()`; `active=true`; `element=5`; **`width=24`** (→48 after rotating_slash `width*=2`); `grazepoints=50`; `aoe=true`; `alarm[0]=1`; `alarm[1]=3`; `image_index=2`; `image_speed=0`; `image_yscale=0.1`; `slashdir=choose(-1,1)`; `destroyonhit=false`. Sprite `spr_rk_quickslash_marker` (but drawn as a triangle, not the sprite).
- **Step (`..._Step_2.gml`):** `damage=206`, `grazepoints=50`. Once `alarm[0]` expires (after 1f): **`width *= 0.66`, `image_alpha *= 0.66` every frame** (beam collapses fast). `width<12` → `active=false` (stops hitting); `width<0.5` → destroy. While `width>4`: jitter `obj_growtangle` ±2 (box shake) and `scr_heartclamp()`.
- **Damage event Other_15 = event_user(5) (`..._Other_15.gml`):** `damage=206`; if `aoe` (always true here) → `damage=75`, `target=3`, flags Knight `aoedamage`. Applies `scr_damage()`/`scr_damage_all()` if active. **Effective hit is a wide instant line; ~1-3 active frames (width 48→shrinks below 12).**
- **Alarm_0:** `exit` (noop). **Alarm_1:** `mask_index = spr_nomask` (collision is by the triangle math / heart proximity, not sprite mask).
- Draw (`..._Draw_0.gml`) unused (visible=false; rotating_slash draws it on its surface).

## KEY TIMINGS (frames @30fps)
- Entry pause (intro): 16f.
- Per-cut cycle: aim `slash_base+slash_offset+6` (diff0 30f → shrinks to ~21f; diff2 aim = slash_base+0+6, 24f→21f) + slash `slash_timer` (8f) + cooldown `cooldown_time` (6f). ≈ 44f→35f per cut early.
- Whole turn: `local_turntimer` 400 → when `<200` the current cycle is the last, then finisher. ~200 frames of cutting.
- Flurry (diff2 full only): aim/slash both collapse to `slash_base=24, cooldown_time=2, slash_timer=2` → very fast; 28 hits; then return + destroy (alarm[3]=22).
- Ends on its own via CleanUp `global.turntimer=-1`.

## SFX
- `snd_knight_rotatingslash_line` — looped during "aim" telegraph (snd_loop, stopped at cut & cleanup).
- `snd_knight_cut` + `snd_explosion_firework` — on every CUT (slash timer==1).
- `snd_knight_puff` + `snd_knight_teleport` (pitch 0.5) — on flurry start (diff2 full).

## ASSETS (sprite = frames,w,h,originX,originY from REFDATA)
- `spr_roaringknight_attack_ol` = 6, 117, 115, 7, 23  (Knight body sprite; drawn ×2 via darksize → halve)
- `spr_rk_quickslash_marker` = 4, 250, 46, 125, 23  (telegraph reticle, black)
- `spr_rk_quickslash_marker_gradient` = 2, 250, 46, 125, 23  (telegraph reticle, r/g/b tint)
- `spr_knight_slash_mark` = 1, 160, 150, 80, 75  (slash mark particle; red + black underlay)
- `spr_roaringknight_flurry` = 3, 113, 78, 0, 0  (flurry spin sprite)
- `spr_roaringknight_flurry_prepare` = 1, 113, 95, 0, 0  (flurry windup)
- `spr_ch3_wheel_center` (id 2128) — flurry return sprite
- CUT beam itself = procedural `draw_triangle_color` (NO sprite): length ±640 along dir, half-width `width`.
- Also spawns: `obj_knight_circle` (reticle), `scr_afterimage`, `obj_afterimage_screen`, `obj_particle_generic` sparks.

## COLOR RAMPS → RGB
- Telegraph tint: starts `(128,128,128)` grey, ramps to `(255,0,0)` pure red (`r→255,g→0,b→0` by 9.14/frame ≈ over 14f).
- CUT beam: `rgb(255, (1-alpha)*255, (1-alpha)*255)` — **red when fresh (alpha≈1), whitening to full white as it fades out.**
- Slash-mark particles: red (`c_red`) with a black (`c_black`) underlay at 0.85 scale.
