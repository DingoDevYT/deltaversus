# Knight "Stars" — obj_dbulletcontroller type 98 — EXACT PORT SPEC

Source files (DELTARUNE Chapter 3 - GML):
- `gml_Object_obj_dbulletcontroller_Step_0.gml` lines 1946-2030 (type-98 spawner)
- `gml_Object_obj_knight_pointing_cone_*` (Create/Step/Draw_0/CleanUp_0)
- `gml_Object_obj_knight_pointing_star_*` (Create/Step/Draw_0/Other_10/Other_15)
- `gml_Object_obj_knight_pointing_starchild_*` (Create/Step/Draw_0/Other_15)
- `gml_Object_obj_heart_follower_*` (Create/Step)
- `gml_GlobalScript_scr_bullet_init.gml`, `gml_GlobalScript_scr_draw_beam.gml`

GML angle convention: y-up. `vx = spd*cos(dir°)`, `vy = -spd*sin(dir°)`. dir=180 ⇒ moves LEFT (toward the play field; the cone sits on the right at growtangle.x+115). scr_darksize baseline = 2, so HALVE every literal `2` scale on the cone's full-screen background sprites (NOT the star's dynamic gameplay scales).

---

## 0. SETUP / SPAWN CHAIN (dbulletcontroller type 98, `_Step_0.gml:1946-2030`)

On `init==1` (line 1948):
- create `obj_heart_follower` at heart pos (line 1951) — a smoothed lag-cursor stars later aim at.
- create `bulletmaker = obj_knight_pointing_cone` at controller x,y (1952).
- `bulletmaker.difficulty = difficulty`; `btimer = 0`.
- `endtimer = 120`. If `difficulty >= 2`: `endtimer += 30`, `global.turntimer += 60`, `endtimer += 60` ⇒ endtimer **210** (else **120**). `bulletmaker.endtimer = endtimer`.
- `global.turntimer += 30` (all difficulties). `delay=0; subdelay=0`.
- `if difficulty==0: side = choose(-1,1)`.

Stop condition (line 1977): when `global.turntimer <= endtimer+1` ⇒ `init=3` (stop spawning; cone plays finale). turntimer counts DOWN each frame.

### Star spawn cadence (line 1981)
Fire a star when `(made != 0 && btimer >= 4) || (btimer >= 45)`.
⇒ **first star after 45 frames, then one every 4 frames** while turntimer > endtimer+1. `btimer` resets to 0 each fire; `made++`.

Per star (1986-2028):
- spawn `obj_knight_pointing_star` at `bulletmaker.x+22, bulletmaker.y+56`.
- `d.difficulty = difficulty`, `d.side = side` (diff2: `side = choose(0,66,-66)` re-rolled each shot, line 1983).
- SFX: `snd_play_pitch(snd_stardrop, 0.5)` then `snd_volume(.,0.5,0)` ⇒ pitch 0.5, volume 0.5.
- **size/special roll:**
  - first shot (`made==0`): `size = random_range(0.5,1)`, `special = random_range(-0.5,0.5)`.
  - later: `special = ((special+0.5 + (0.5+sin(random(1))*0.3)) mod 1) - 0.5`; `size = (size + 0.5 + sin(made)*0.5) mod 1`.
- **aim:** `_dir = 180 + special*bulletmaker.angle` (bulletmaker.angle grows 0→60 over the attack — see §2). special∈[-0.5,0.5] ⇒ spread up to ±30° at full charge, leftward.
- **anti-cheap-shot (size<=0.1 only):** if `_dir` within 20° of the direct line to the heart, push `_dir` at least 20° off the heart, then clamp into `[180-angle, 180+angle]` (lines 2009-2022).
- `d.direction = _dir`; `d.speed = lerp(10, 5, size)` (bigger=slower); `d.grow_Speed = lerp(0.1, 0.25, size)` (bigger=grows faster). NOTE GML is case-insensitive: `grow_Speed` overwrites the star's `growspeed`.

---

## 1. obj_heart_follower (`Create_0`/`Step_0`)
- `target = obj_heart`, `depth = obj_heart.depth-5`, `smoothing = 0.125`, `max_speed = 4`.
- Step: `x = movetowards(x, heart.x, clamp(abs(dx)*0.125, 1, 4))`, same for y. A lagging cursor. **Starchildren home on `obj_heart_follower.x+10, .y+10` (not the real heart).** Draw: none (invisible tracker).

---

## 2. obj_knight_pointing_cone — the "bow"/aim (`Create`/`Step`/`Draw`/`CleanUp`)

### Create_0 (`gml_Object_obj_knight_pointing_cone_Create_0.gml`)
`angle=0; target_angle=60; image_xscale=image_yscale=2; image_speed=0; con=0; difficulty=0; endtimer=120; timerb=0; timer=0; knockback=0; star_flicker=0; draw_angle=0; yoff=irandom(60)+2`. Positions to `obj_growtangle.x+115, .y-56` via a 0.05 tween (Step 35-41). Default sprite `spr_roaringknight_point_ol` (5f, 100×88, origin 0,0), drawn `draw_self()` at scale 2.

### Step_0 (`..._Step_0.gml`) — SFX + aim angle
- `timerb++`. **`timerb==3`:** `snd_knight_drawpower` ×3 (vol 1, pitch 1.3). **`timerb==120`:** `snd_knight_star_explosion_close` ×3 (vol 2, pitch 0.7).
- `con` states: 0/1 charge (Draw-driven, see §2 Draw), 2 = active/aiming, 3 = release flash, 4 = fly back to knight (`lerp` x/y toward knight at 0.15), 5 = done (knight re-shown).
- **Angle growth (the cone half-spread, lines 43-92):**
  - `con<2`: exit.
  - `global.turntimer <= endtimer` (**finale**): on the frame `angle_lerp==1`, set EVERY existing star `con=1` (fire), stagger `star.timer = -i`, odd i ⇒ `playSound=false`, and `knockback=10`. Then `angle_lerp → 0` at 0.1/frame; `angle = lerp(0,60, ease_in(angle_lerp,6))` (snaps closed). When `angle_lerp==0 && con<3`: `timer=10; con=3; yoff=120+irandom_range(-60,60)`.
  - else if `angle < 60`: `angle_lerp → 1` at **0.025/frame** (~40 frames); `angle = lerp(0,60, ease_out(angle_lerp,6))`. ⇒ **spread widens 0→60° over the charge**, so stars fan out more as the attack progresses.
  - else: `x += 0.25`.
- **knockback / growtangle shake (94-107):** when knockback≠0, `gt_x -= ease_in(knockback/10,5)*10`, knockback→0 at 0.5; fake_gt offset jitter ±(knockback/10). Else `gt_x -= angle/target_angle/2` and jitter ±(angle/60). `obj_growtangle.x = round(gt_x)`; `obj_heart.x = min(obj_heart.x, gt_maxx()-22)` (box shrinks the arena from the right).

### Draw_0 (`..._Draw_0.gml`) — visuals (renders to a 640×480 surface)
- image_index eases the bow frames (con>=3 winds back at −0.25/frame; else +0.5 up to last frame).
- `con<5`: `draw_self()` (the bow, `spr_roaringknight_point_ol`, scale 2).
- afterimages every 4 aetimer frames (con<=4): alpha 0.6, fadeSpeed 0.02, speed `2+spread/30`, direction `sin(aetimer)*angle/2`, depth `knight.depth+1`.
- **con 0/1 = rocket charge (lines 43-73):** additive `spr_knight_bullet_flow` frame 2 streaks up from `(x+22, y+54)`; at timer>=30 ⇒ `snd_play_pitch(snd_rocket_long, 0.6)`, `con=2`. (base `spr_knight_bullet_flow` = 3f 320×240 origin 0,0.)
- **con 2 = active cone render (89-119):** builds a triangle (`pr_trianglelist`) from apex `(x+22,y+56)`, color `merge_color(c_white,c_black, angle/60)`, spread `±angle/2` at length 600 — this is the visible aiming cone. Scrolls two `spr_knight_bullet_flow` frame0 (bg) at scale 2, x -= 20/frame, and two frame1 (lines) at scale 2, x -= 80/frame (wrap at 640). Heart is masked in via `bm_subtract` (`draw_sprite(heart.sprite, image_index, screenx, screeny)`).
- **star compositing (126-153):** into `starsurf`: for each star with `image_xscale>0.5` call `event_user(0)` (= Other_10 hit event, see §3); draw `spr_knight_line_grate` (1f 320×240) with `bm_subtract`, `star_flicker` toggles 0↔2; then stars with `image_xscale<=0.5` call `event_user(0)`. Surface blitted with separate-alpha blend.
- **con 3 = release flash (75-87):** two `spr_knight_bullet_flow` frame2 additive streaks fade over 10 frames, then `con=4`.

### CleanUp_0
Frees `surf`/`starsurf`; re-shows `obj_knight_enemy` and restores its `aetimer`.

---

## 3. obj_knight_pointing_star — the star bullet

### Create_0 (`..._Create_0.gml`)
`scr_bullet_init()` (⇒ destroyonhit=1, target=0, inv=60, damage=10, element=0, grazepoints=1, active=1). Then overridden: `growspeed=0.02` (spawner overwrites to 0.1-0.25), `image_xscale=image_yscale=0`, `con=0`, `damage=1`, `grazepoints=2`, `element=5`, `mask_index=spr_knight_bullet_star_mask` (64×64, origin 32,32), `rotation=0`, `dir=choose(-1,1)`. Object default sprite `spr_knight_bullet_star` (3f 64×64 origin 32,32).

### Step_0 (`..._Step_0.gml`)
- Off-screen cull (line 1): destroy if past camera left / above / below (with sprite_width/2 margin).
- `if difficulty==0`: `sprite_index = spr_knight_bullet_star_easy` (3f 64×64 origin 32,32).
- graze reset every 4 frames.
- **con 0 (flying/growing):** `image_xscale += growspeed; image_yscale += growspeed` each frame (no friction — flies straight at spawn speed, scale accumulates from 0). Stays here until the CONE sets `con=1` at the finale.
- **con 1:** `friction = 0.5; con=2`.
- **con 2 (braking → detonation, lines 30-57):** if `speed==0` ⇒ `gravity=0.1`, `gravity_direction = direction-180` (drifts backward), `friction=0`. `timer++`; at `timer>=40` ⇒ `con=3, timer=0`, and if `playSound` ⇒ `snd_play(snd_explosion_firework)`. `growstart = image_xscale`.
- **con 3 (explode, 58-138):** `timer++`; scale = `growstart + clamp01(timer/2)`. At **timer==3** spawn **6** `obj_knight_pointing_starchild` (see §4). At **timer>=4** snap scale to `(sprite_width+16)/64`, spawn afterimage (fadeSpeed×3), `instance_destroy()`.

### Draw_0 (`..._Draw_0.gml`) — star body + spike beams
`_xscale = (sprite_width+16)/64 = image_xscale+0.25`; `_color = merge_color(c_gray, c_red, clamp01(timer/30))` (gray→red over 30f); `_alpha = (sin(timer*3)+1)*0.25`.
- **con 2 or 3 — spike burst (`scr_draw_beam_color(x,y,length,width=10,angle,tipColor,baseColor=0,alpha,circle=false)`, additive):** difficulty<2 draws 6 triangular spikes from (x,y): main length `_length` at angles **90, 336, 204** (color white 16777215), plus half-length (`_length/2`) accents at **156, 24, 270** (c_white). con2 length pulses `50 + 50*prog`, con3 length 120. (diff2 uses a rotated `90±side` 6-beam layout with `_color` tint.)
- **con 1 or 2 — star body:** `draw_sprite_ext(sprite, 1, x,y, _xscale+0.1, _yscale+0.1, image_angle, c_white, _alpha)` glow, then frame 0 at `_color` alpha 1.
- **con 3 or 4 — burst frame:** `draw_sprite_ext(sprite, 2, x,y, _xscale+0.1,…, c_white, (sin(timer*6)+1)*0.25)` + frame 2 solid.

### Other_10 = User Event 0 (`..._Other_10.gml`) — AOE HIT (called by cone Draw each frame)
`target = 3; damage = 75; obj_knight_enemy.aoedamage = true`. If `active==1`: `scr_precise_hit(3)` (3px shrink on the 64×64 mask, scaled by image_xscale) ⇒ `scr_damage_all()` (target 3). **Contact = 75 damage, whole party.** (Base contact via standard collide bullet would be damage 1, but the cone-driven event forces the 75 AOE while the star is on the field.)

### Other_15 = User Event 5 (`..._Other_15.gml`)
Simple surface draw: `draw_sprite_ext(sprite_index, 0, screenx(), screeny(), (sprite_width+16)/64, same, 0, c_white, 1)`.

---

## 4. obj_knight_pointing_starchild — the 6 shards per star

### Spawn params (from star Step_0:75-125, per i=0..5)
`d.image_angle = d.direction = _angle` starting 90; scale = `star.image_xscale*0.5`; `deceleration=0.15`. diff0: odd i ⇒ speed 1 & lifetime 30, else speed 4. Angle steps: after i==1 or 4 add 48, else add 66 (diff0/1 pattern). diff2 uses a 2-shot fan (±180) with `spr_knight_starchild_trail`.

### Create_0 (`..._Create_0.gml`)
`scr_bullet_init()`; `deceleration=0.1; minspeed=1; damage=1; element=5; lifetime=60; con=0; tracking=true; rotatespeed=10; accel=0.5; sprite_index=spr_knight_starchild_parts` (2f 33×32 origin 16,16). Default object sprite `spr_knight_starchild` (1f 33×32 origin 16,16).

### Step_0 (`..._Step_0.gml`) — homing shards
- diff>=2 gets a staggered `delay` (25 + accumulating per-controller subdelay).
- speed decays to `minspeed` at `deceleration`.
- con 1: image_angle lerps to heart_follower dir over 10f, scale wobble via cos, then con=2 (tracking on).
- **con>=2 tracking (56-93):** `target_angle = point_direction(x,y, heart_follower.x+10, .y+10)`; if within 90°, rotate `direction` toward it (2°/step in con2; con3 uses rotation ±1/±2 by error). Small backward ease for first 40 frames.
- **con 3 (attack dash):** `speed → 25` at 0.5/frame; `image_xscale = xscale_start + speed/60`; `image_yscale = yscale_start - speed/90`; red afterimages.
- con 4: speed 0, destroy after 4 frames (draws `spr_thrash_missile_explosion` 4f 54×54 origin 27,27, tinted c_red).

### Draw_0 / Other_15
Draw: additive glow outline (`scr_draw_outline`) + frame1 outline + frame0 body; diff<2 fades out over last 15f of lifetime then destroys. Other_15 (User 5) = hit: same as star — sets `damage=75, target=3` (or event_user(2) on knight if obj_knight_roaring2 exists), `scr_precise_hit(5)` ⇒ `scr_damage_all()`.

---

## COLOR INT → RGB (R=int&255, G=(int>>8)&255, B=(int>>16)&255)
- c_white 16777215 = (255,255,255); c_black 0 = (0,0,0); c_red 255 = (255,0,0); c_gray 12632256 = (128,128,128); beam base `0` = black (fades spike tail to black additively). Star tint `merge_color(gray→red, timer/30)`.

## ASSETS
Sprites: spr_roaringknight_point_ol (5f 100×88 o0,0); spr_knight_bullet_flow (3f 320×240 o0,0); spr_knight_line_grate (1f 320×240 o0,0); spr_knight_bullet_star (3f 64×64 o32,32); spr_knight_bullet_star_easy (3f 64×64 o32,32); spr_knight_bullet_star_mask (1f 64×64 o32,32); spr_knight_starchild (1f 33×32 o16,16); spr_knight_starchild_parts (2f 33×32 o16,16); spr_knight_starchild_trail (2f 33×32 o16,16); spr_thrash_missile_explosion (4f 54×54 o27,27).
Sounds: snd_knight_drawpower; snd_knight_star_explosion_close; snd_rocket_long; snd_stardrop; snd_explosion_firework.

## SFX EVENT MAP
- cone timerb==3 → snd_knight_drawpower ×3 (vol1, pitch1.3)
- cone rocket-charge complete (con1→2, ~30f) → snd_rocket_long (pitch0.6)
- cone timerb==120 → snd_knight_star_explosion_close ×3 (vol2, pitch0.7)
- each star spawn → snd_stardrop (pitch0.5, vol0.5)
- each star detonation (con2→3, if playSound) → snd_explosion_firework
