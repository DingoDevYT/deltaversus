# Pink Ch5 — Plus-grid / Rotbox (type 202) + Phase-3 Giant Anime-Face Ghost — EXACT PORT SPEC

Source root: `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 5 - GML\`
Refdata root: `C:\Users\lando\Desktop\DELTARUNE - REF DATA\DELTARUNE Chapter 5 - REFDATA\`
Color note: literals like `11141290` are BGR ints → RGB = (int&255, (int>>8)&255, (int>>16)&255). GML `#RRGGBB` hash-literals are read as RGB directly.

---

## 0. HOW THIS ATTACK IS SELECTED / P3 GHOST TRIGGER

The "rotating box" = `myattackchoice == 3` in `obj_pink_enemy`, which spawns an `obj_dbulletcontroller` with `dc.type = 202`.
- `gml_Object_obj_pink_enemy_Step_0.gml:1706-1724`: myattackchoice==3 → creates growtangle box + heartmarker + moveheart, sets `global.monsterattackname="rotating box"`, `dc.type = 202`, `dc.difficulty = difficulty`.

Attack-table (`gml_Object_obj_pink_enemy_Other_10.gml`, the turn-picker, run each turn):
- datecount 1, phaseturns 0 → myattackchoice 3, **difficulty 0** (basic rotbox, NO ghost). (`:59-63`)
- datecount 1, phaseturns 4 → myattackchoice 3, **difficulty 2**. (`:83-88`)
- datecount 2/3, phaseturns 0 → myattackchoice 3, **difficulty 1** → this is the P3 GIANT GHOST variant. (`:93-97`)
- Difficulty meaning for type 202: `0`=default lane pattern, `1`=**giant ghost / hard**, `2`=no-spin variant (`can_spin=false`, purplebg hidden).

**The giant anime-face ghost only appears in the difficulty==1 rotbox.** In the type-202 controller, at `btimer == -173`:
- `gml_Object_obj_dbulletcontroller_Step_0.gml:2054-2058`:
```
if (btimer == -173)
    with (instance_create_depth(camera_get_view_x(view_camera[0]) + 32, scr_get_box(5) + 96, 10, obj_huge_anime_face))
        difficulty = other.difficulty;
```
(`btimer` starts at `-180` for difficulty==1 — `:2047` — so it hits −173 seven steps in.)

---

## 1. TYPE-202 CONTROLLER (obj_dbulletcontroller, type==202)

File `gml_Object_obj_dbulletcontroller_Step_0.gml:1968-2485`.

### 1a. Setup (`made==0`, :1975-2052)
- `phase=0; life_time=0; pattern_phase=0`.
- obj_heart → `sprite_index=spr_purpleheart; canmove=0`. grazebox `grazetimefactor=0`.
- Spawns `obj_purplecontrols` at growtangle x,y depth 4; **`obj_purplecontrols.mode = 3`**, `lane_x=0; lane_y=0`.
- If difficulty==1: destroys existing pink_battlemovement, recreates one at `(growtangle.x+200, y)` depth `depth-5` with `mode=1, air_time=1, sprite_index=spr_pink_ball, image_speed=1, dest_x=controller.x, dest_y=controller.y-118`.
- Creates `obj_purplebg` at depth 200.
- `btimer2 = -210`.
- `pattern_dir = irandom(3) * 90` (initial lane fire dir, one of 0/90/180/270).
- `box_v_stable = scr_get_box(5)` (box vertical center).
- difficulty 0/2 → `obj_purplecontrols.can_spin=false`; difficulty 2 → purplebg invisible.
- difficulty 1 → `can_spin=false`, `global.turntimer=700`, `btimer=-180`, `ammo=6`.
- `_fill_bulletlist=true` on setup.

### 1b. Bullet-list refill (`_fill_bulletlist`, :2072-2253)
Populates `obj_purplecontrols.ds_bullet_list` in groups of 4 values: `[lane_code, dir, delay, speed]`.
- `lane_code`: 0/1/2 = lane bullet variants; 3/4/5 = extra lane pairs; 6/7/8/9/10 = dokiheart shots (code≥6); values ≥6 spawn dokihearts not lanebullets.
- **difficulty 0** (`:2076-2087`): one huge fixed `ds_list_add` script (full choreographed pattern, ~30 shots), `_d_tuning=0.95`, `_s_tuning=1.1`, `_speed_v=1.1`, `_speed_h=1.265`; `global.turntimer=385; btimer=32`.
- **difficulty 2** (`:2089-2106`): can_spin=false, purplebg invisible; separate fixed pattern; `_speed_strays=1.4`, `_speed_bursts=1.65`; `global.turntimer=200; btimer=32`.
- **difficulty 1** (`:2108-2251`): procedural — picks `_dir=irandom(3)*90`, `_diradd=choose(-90,90)`, `_shot=choose(0,1,2)`; adds 3-4 shots with Markov-ish direction/shot transitions and a "doki_queue" heartshot chain. Speeds `_speed_v=0.9,_speed_h=1,_speed_12=1.5,_speed_3=1.25`. Refilled continuously while `ds_list_size<4 && ammo>0` (`:2065-2069`).

### 1c. Firing loop (`btimer>=40`, :2255-2380) — THE PLUS/LANE BULLET GEOMETRY
Runs a `do…until(btimer<40)` loop while growtangle exists. Each iteration:
- Defaults: `_bdir=pattern_dir`, `_binterval=0.8`, `_bspeed=10`, `_bullet_scale=2`, `_shootdist=352`.
- Reads next 4 list values into `_bdir` (dir), `_blane` (lane code), `_binterval` (delay×0.8), `_bspeed` (speed×8), then deletes those 4 (`:2273-2283`).
- If list <4 remaining → clear list; if difficulty!=1 set `btimer=-999` (ends firing) (`:2285-2291`).
- **`btimer = 40 - floor(0.5 + 40*_binterval)`** — cadence between shots (`:2295`).
- **Spawn origin for every shot**: `(scr_get_box(4) + lengthdir_x(_shootdist, _bdir+180), scr_get_box(5) + lengthdir_y(_shootdist, _bdir+180))` — i.e. 352px OUT from box center along the OPPOSITE of `_bdir`, so bullets fly inward toward center along `_bdir`.

Lane codes 0–5 → `obj_pinklanebullet` via `scr_fire_bullet(...,obj_pinklanebullet,_bdir,_bspeed)` (`:2297-2344`):
- `_bul.image_xscale*=2; image_yscale*=2; depth = controller.depth-10`.
- `_lanebuldist = 52`.
- Codes **0,3,4**: offset `+lengthdir(52, _bdir+270)`, `sprite_index=spr_pinklanebullet_lane`, `image_angle += 180`.
- Code **2**: offset `+lengthdir(52, _bdir+90)`, `sprite_index=spr_pinklanebullet_lane`.
- (Code 1 / else: no offset, keeps default `spr_pinklanebullet_animation`.)
- Then `_bul.image_angle += _bdir`.
- Codes **3,4,5** (`_blane>=3 && <6`): fire a SECOND `obj_pinklanebullet` from same origin; for codes 4,5 offset `+lengthdir(52,_bdir+90)` + `spr_pinklanebullet_lane`; then `image_angle += _bdir`. (So codes 3/4/5 create a PAIR straddling the lane = the "plus/parallel lane" look.)

Lane codes ≥6 → `obj_dokiheart` (`:2346-2371`), `_lanebuldist=66`, at same origin, depth `depth-11`, `tension_value=3, image_xscale=3, image_yscale=3, visual_scale=2/3, direction=_bdir, speed=_bspeed`; codes 6,9,10 offset `+lengthdir(66,_bdir+270)`, code 8 offset `+lengthdir(66,_bdir+90)`.

- **`pattern_dir += choose(90,270)`** then wrap to [0,360) each iteration (`:2373-2376`) — rotates which of the 4 cardinal directions the next shot comes from → the "plus" of incoming lanes.

### 1d. Box entrance & difficulty-1 intro sequence
- difficulty!=1: for `life_time<=8`, push purplecontrols/growtangle/heart/collidebullet/dokiheart `y += 8` per step (box slides down into place) (`:2382-2406`).
- difficulty==1 intro (`:2408-2484`), phases 0→2 with pink_battlemovement (Mad Mew Mew sprite) reacting: phase0 at life_time≥28 → `snd_pink_laugh_long`, `spr_pink_front_ohoho`; phase1 stops anim at 60, at 90 → `spr_pink_front_surprised`; phase2 at 50 → pink_battlemovement `mode=6, dest_x=scr_get_box(4)`. While `rotate_speed!=0` these phases freeze (`other.life_time=255`).

---

## 2. obj_pinklanebullet — THE LANE / PLUS BULLET

Parent: `obj_regularbullet` (→ obj_bulletparent). Default sprite `spr_pinklanebullet_animation` (3 frames, 19×19, origin 9,9). Alt sprite `spr_pinklanebullet_lane` (3 frames, 19×19, origin 9,9).

### Create (`gml_Object_obj_pinklanebullet_Create_0.gml`)
- `event_inherited()`; `grazepoints=2; make_sounds=0; target=4; damage=100` (`=obj_pink_enemy.damage` if it exists); `element=6; wall_destroy=0`.
- `image_xscale=2; image_yscale=2; image_speed=1; image_index=0`.
- `life_time=0; image_alpha=0.25`.
- (Controller then multiplies xscale/yscale by 2 → effective scale 4; alpha ramps up in Step.)

### Step (`gml_Object_obj_pinklanebullet_Step_0.gml`)
- Friction handling: if `friction>0`, `_minspeed=2/3`; `friction=clamp((speed-_minspeed)/4,0,friction)`; if friction≤0 → `speed=_minspeed` (`:3-10`).
- Gravity: if `gravity>0 && speed>=12` → `gravity=min(gravity,1)` (`:12-16`).
- `life_time += 1`; `_limit = max(80, 720 / max(speed,0.1))` (lifetime cap scales inverse to speed) (`:18-19`).
- **On `life_time==1`**: scan all pinklanebullets, find highest id among ones just spawned; the highest-id one plays the shot SFX (`:21-49`):
  - `_amount<2` → `snd_play(snd_heartshot_dr, 1, 0.65)`.
  - else → `snd_play(snd_heartshot_dr,1,0.4)` + `snd_play(snd_heartshot_dr,1,0.9)` (two-pitch chord).
- Alpha: while `life_time<_limit` → `image_alpha=clamp(image_alpha+0.25,0,1)` (fade in). Once `life_time>=_limit` → `image_alpha-=0.1`, destroy when ≤0.001 (`:51-61`).

### Draw (`gml_Object_obj_pinklanebullet_Draw_0.gml`) — MOTION-BLUR TRAIL
- `_dist=2`.
- `_alpha_a = 0.0833333 + 0.1666667*clamp(speed/10,0,1)`.
- `_alpha_b = 0.0416667 + 0.0833333*clamp(speed/10,0,1)`.
- If `mask_index != -1`: draw 3 copies of `mask_index` (else `sprite_index`/`draw_self`):
  1. behind by `speed*_dist*2` opposite `direction`, alpha `min(image_alpha,_alpha_b)`.
  2. behind by `speed*_dist*1`, alpha `min(image_alpha,_alpha_a)`.
  3. at (x,y), full `image_alpha`.
  All: `draw_sprite_ext(spr, -1, ..., image_xscale, image_yscale, image_angle, c_white, alpha)`.
- Trail streaks backward along `direction`, length ∝ current speed.

### Special reaction on ghost bump (from ghost step, see §4c): pinklanebullets with `friction>0 || speed<=1` get `friction=0; gravity_direction=direction; speed=3; gravity=2` — they get knocked loose and fall (`obj_huge_anime_face_Step_0.gml:309-318`).

---

## 3. obj_purplecontrols mode 3 — THE PLUS-GRID ITSELF (soul on a rotatable plus)

The heart rides a "+"-shaped 5-node grid (center + 4 arms). Player moves along arms; L/R while at a dead-end SPINS the whole box 90°.

### Create (`gml_Object_obj_purplecontrols_Create_0.gml`)
Key rotbox fields: `lane_x=1; lane_y=1` (overridden to 0,0 by controller), `x_ongrid=0; y_ongrid=0`, `rotate_travel=0; rotate_speed=0; rotate_momentum=0`, `heart_angle=0; heart_travel=0`, `box_momentum=0`, `super=0`, `x_shake=0`, `can_spin=true; can_move=true`, `iframes=0`, `bg_pulse=99`, `image_angle` (via growtangle) starts 0.

### Step mode 3 (`gml_Object_obj_purplecontrols_Step_0.gml:361-815`)
- Hides growtangle + heart sprites (drawn manually).
- `_input_buffer_length` = 6 if buffer_boost>0 else 2 (`:29-33`).
- `_laneswap_speed=20` (10 while `rotate_travel!=0`); `_lane_distance=56`.
- **Movement (heart_travel==0 only)** (`:378-539`): reads buffered dir (U=90,D=270,L=180,R=0). Then de-rotates input by current `image_angle`:
  - `_move_dir = _move_dir_original - image_angle - sign(rotate_travel)*min(rotate_speed*5, abs(rotate_travel))`, wrapped, snapped to nearest 90 if within `_allowed_input_angle=44.9°`, else −1 (rejected).
  - Arm rules: you may only travel along the axis you're on. Up/Down allowed only when `lane_x==0` (vertical arm); Left/Right only when `lane_y==0` (horizontal arm). `lane_x,lane_y ∈ {-1,0,1}`. Moving sets `heart_angle`, `heart_travel=_lane_distance(56)`, spawns `obj_pinkdust` with matching `image_angle`, plays `snd_wing`. Blocked moves give `heartshake` nudge.
- **BOX ROTATION (`rotate_travel != 0`)** (`:556-669`):
  - Sets every `obj_huge_anime_face.player_moved=1` (tells the ghost the player acted).
  - `rotate_speed = clamp(rotate_speed+0.2, 0.2+rotate_momentum, 10)`.
  - `image_angle = scr_approach(image_angle, image_angle+rotate_travel, rotate_speed)`; `rotate_travel = scr_approach(rotate_travel, 0, rotate_speed)`.
  - On completion (rotate_travel hits 0): re-quantize `lane_x/lane_y` from `point_direction(0,0,lane_x,lane_y)+image_angle` snapped to 90° → new (lane_x,lane_y); reset `image_angle=0`; `heart_angle += sign*90`; `rotate_momentum += 1`; `x_shake=4`; re-quantize dokihearts similarly.
  - Wrap image_angle to [0,360).
  - **World scroll while rotating**: `_x_traveled = -(rotate_travel-_rotate_travel_old)*0.8333333*1.570795`; apply `x += _x_traveled` to all obj_bulletparent EXCEPT obj_pinklanebullet, plus slidedust; purplebg `bg_x += _x_traveled/4`. (Lane bullets stay fixed relative to box while everything else parallax-scrolls — creates the spinning-world illusion.)
- **Tire/lift bob** (`:671-713`): `_tirecorner_angle = (image_angle % 90) + 45`; `_tire_lift = lengthdir_y(96, _tirecorner_angle)` (super≤0). Box y = `tire_y + _tire_lift` → the box visually rolls on a corner as it spins. pinklanebullets & dokihearts follow `y += (y - _y_old)`.
- **box_momentum slide** (`:714-753`): decays via scr_approach; while decaying, scrolls bulletparents (not lanebullets)/slidedust `x += -box_momentum` (÷4 while rotating), spawns `obj_slidedust` (`spr_dust1`). This is the recoil after a ghost ram.
- **super finisher** (`:755-776`): when `rotate_travel==0 && super>=1`, decrement super, spawn `obj_pinkmeteor` (scale 3.5) at super==1, kick another `rotate_travel = sign*90`, play `snd_impact`.
- **heart_travel decay** (`:778-809`): `heart_travel = scr_approach(heart_travel,0,_laneswap_speed)`; spawns pinktrail; on arrival sets heart mask back to `spr_dodgeheartmask`, applies directional `heartshake`.
- **Final on-grid position** (`:811-814`):
  - `_heart_dir = point_direction(0,0,lane_x,lane_y)`, `_heart_dist = point_distance(0,0,lane_x,lane_y)`.
  - `x_ongrid = lengthdir_x(_heart_dist*56, _heart_dir+image_angle) - lengthdir_x(heart_travel, heart_angle+image_angle)`.
  - `y_ongrid = lengthdir_y(_heart_dist*56, _heart_dir+image_angle) - lengthdir_y(heart_travel, heart_angle+image_angle)`.
- `Step_1` (End Step): `iframes = max(0, iframes-1)`.

### event_user0 = Other_10 (`gml_Object_obj_purplecontrols_Other_10.gml`) — BOX GETS RAMMED BY GHOST
Called by the ghost when it collides with growtangle (§4c). Guarded by `iframes<=0`:
- `iframes = 10`.
- If `other.super>=1` → `super=2`.
- If `rotate_travel>=0` → `rotate_speed = 6 + super*12; rotate_travel -= 90` (spin left one quarter).
- else → `rotate_speed = max(6, rotate_speed+6) + super*12`.
- `box_momentum = 24` (recoil slide).
(Other_11 = event_user1 = `exit;` — no-op.)

### Draw mode 3 (`gml_Object_obj_purplecontrols_Draw_0.gml:151-203`) — VISUALS
Palette (BGR ints → RGB):
- `_prpl_light = 11141290` → **RGB(170,0,170)**.
- `_prpl_dark = 5570645` → RGB(85,0,85).
- `_prpl_darker = 3866683` → **RGB(59,0,59)**.
- `_prpl_darkest = 3342387` → RGB(51,0,51).
- `_prpl_backdrop = 2228258` → RGB(34,0,34).
- If `!can_move`: each is `merge_color(col, c_black, 0.5)` (darkened while frozen).

Draw order (mode 3):
1. Box sprite ×2 via growtangle: `draw_sprite_ext(sprite_index, 1, x+x_shake, y, image_xscale, image_yscale, purplecontrols.image_angle, image_blend, image_alpha)` then same with `image_index = -1`. `_scale = growtangle.image_xscale/2`.
2. **Plus grid lines** (`_prpl_darker` = RGB59,0,59), `_lane_distance = 56*_scale`, `_dir = image_angle`:
   - Draw 3 parallel `d_line`s across the horizontal axis (offsets `_xx = -0.5*_scale, 0, +0.5*_scale` perpendicular), each spanning `lengthdir(56,_dir)` to `lengthdir(56,_dir+180)` through center (+`x_shake` on x endpoints).
   - `_dir += 90`; repeat 3 parallel lines for the vertical axis. → the "+" of two thick lines.
3. **Nodes** (`_prpl_light` = RGB170,0,170): 4 arm-end dots `d_circle(x+lengthdir_x(56,_dir), y+lengthdir_y(56,_dir), 4*_scale, false)` for _dir in 0/90/180/270 (+`x_shake`), plus center dot `d_circle(x+x_shake, y, 4*_scale)`.
4. **Spin hint arrows** if `arrow_alpha>0` (`:191-195`): `spr_pinkspinarrow` frame 1 at `(x+57, y+18+abs(lengthdir_y(10,arrow_dir)))` angle 270 white α=arrow_alpha; and a mirrored (`xscale -1`) upper copy at `y-16-...` α=arrow_alpha/3.
5. `obj_pinktrail` draw_self; `obj_pinkdust` draw.
6. After the switch, the heart is drawn (`:535-536`): `draw_sprite_ext(heart.sprite_index, -1, x + x_shake + heartshake_x + heartbump_x, y + heartshake_y + heartbump_y, xscale, yscale, image_angle, blend, alpha)` — heart's world pos = purplecontrols (x,y) + (x_ongrid,y_ongrid) applied elsewhere; the box (growtangle) origin is where x,y sit.

---

## 4. obj_huge_anime_face — PHASE-3 GIANT GHOST FACE (the "bull" that rams the box)

Parent `obj_regularbullet`. Default sprite `spr_pinkghost_nya_1` (2f, 112×116, origin 0,0). Spawned by controller at `(camera_x+32, scr_get_box(5)+96, depth 10)` (§0).

### Create (`gml_Object_obj_huge_anime_face_Create_0.gml`)
`event_inherited(); active=0; destroyonhit=0; wall_destroy=0; image_xscale=-2; image_yscale=2` (mirrored, 2× → giant); `hspeed=20; friction=1.25; image_index=0; image_speed=0; life_time=0; phase=-1; pattern=0; pattern_time=0; player_moved=0; mode=0; jump_cycle=0; bumps=0; attacked=0; bump_timer=0; super=0`.

### Step (`gml_Object_obj_huge_anime_face_Step_0.gml`) — `life_time++` then `switch(mode)`
**mode 0 (rise-in intro):**
- phase −1 (`:9-17`): wait until `player_moved>0 || life_time>=50` → `audio_play_sound(snd_rumble,1,1)`, life_time=0, phase→0.
- phase 0 (`:19-141`): RISE UP to `_y_goal = (scr_get_box(5)-132)+10`. `_risespeed` ramps by life_time: <20→0.5, <30→2, <72→4, <77→2, else 1. If `player_moved>0`, a `_hastening` multiplier (2–8, larger the further below goal) runs the rise loop multiple times per step (skips ahead when the player is spinning). Each sub-step: `y -= _risespeed`, camera shift `_camerashift_x = 0.1*_risespeed`, `_camerashift_y = 0.08*_risespeed`. Spawns `obj_slidedust`(`spr_dust1`) dust each step. Applies camerashift to purplecontrols/purplebg/growtangle/heart/pink_battlemovement. On `y<=_y_goal`: `snd_stop(snd_rumble)`, snap all to integers, `obj_purplecontrols.can_move=true`, `friction=0`, life_time=0, phase→1.
- phase 1 (`:143-154`): when `player_moved>0 || life_time>=30` → `sprite_index=spr_pinkghost_angry`, image_index=0, life_time=0, phase=0, **mode=1**.

**mode 1 (charging / ramming loop):** (`:159-349`)
- `pattern_time++`. Camera follow: `_cameragoal_x`; if growtangle exists `= bbox_right*0.25 + (scr_get_box(4)+16)*0.75`; `_camerashift_x = clamp((cam_x+320)-_cameragoal_x, -4, 4)`; applied to bulletparent/dokiheart/purplecontrols/purplebg/growtangle/heart/pink_battlemovement.
- `x = clamp(x + 1.5, cam_x-160, cam_x+640)`.
- **Speed ramp by `bumps`** (`:197-269`): `_speedmulti` = 32 (bumps≤0), 1.5 (<2, keep momentum), 4 (<3), 9 (<4), 11 (≥4). At bumps≥5 aggro kicks in; at bumps≥7 → `_aggroboost=0.667, _aggrothreshold=29, _speedmulti=-0.06, super=1` (SUPER charge). hspeed integration: if `_speedmulti<=0` → `hspeed += _speedmulti`; else stepped adds (`+0.02*mult` if hspeed<2.5, `+0.01*mult` if <4, else `+0.002*mult`).
- At bumps≥7 & `bump_timer>=_aggrothreshold-10`: `sprite_index = spr_pinkghost_yell_full` (145×156, origin 24,0), reposition to keep bbox_right/bottom; if `bump_timer>=_aggrothreshold` → `hspeed += _aggroboost`.
- **jump_cycle** (`:271-278`): `jump_cycle += 10*speed`; crossing 180 or 360 → `snd_play(snd_impact_bc,0.5,0.5)`; wraps −360. Drives the vertical bob in Draw.
- `bump_timer++`.
- **THE RAM** (`:283-347`): `if (place_meeting(x-32, y, obj_growtangle))` → `with (obj_purplecontrols) if (iframes<=0) { _we_bumped=true; event_user(0); }` (spins the box, §3 Other_10).
  - On bump: `bumps++`, `bump_timer=0`, `snd_play(snd_pink_trip)`, `snd_play(snd_impact)`, `scr_shakescreen()`.
  - If `!_keep_bump_momentum` → `speed /= 2`; then `speed = max(1, speed-1)`.
  - **Knocks pinklanebullets loose** (`:309-318`): those with `friction>0 || speed<=1` get `friction=0; gravity_direction=direction; speed=3; gravity=2`.
  - Flip & face swap: bumps<7 → `image_xscale = -image_xscale`, reposition by bbox_right. bumps==7 → `image_xscale=-abs(image_xscale)`, `sprite_index=spr_pinkghost_shock_full` (150×130, origin 0,0), reposition bbox_right/bottom.
  - If `super>=1` → obj_shake `shakex=8, shakey=8`.
  - `attacked=0; pattern_time=0`.

### Draw (`gml_Object_obj_huge_anime_face_Draw_0.gml`) — `_col = 16777215` = white
- mode 0 phase 0: `draw_sprite_ext(sprite_index, -1, (x-2)+irandom(4), y, image_xscale, image_yscale, image_angle, white, image_alpha)` (horizontal rumble jitter ±0–2).
- mode 0 phase 1: `draw_self()`.
- mode 1: `draw_sprite_ext(sprite_index, -1, x + choose(-1,0,1) + abs(lengthdir_y(3,jump_cycle)), (y+choose(-1,0,1)) - abs(lengthdir_y(10,jump_cycle)), image_xscale, image_yscale, image_angle, white, image_alpha)` — hops via jump_cycle (up to ~10px vertical bounce, ~3px forward lean) plus ±1 jitter.

### CleanUp (`gml_Object_obj_huge_anime_face_CleanUp_0.gml`): `snd_stop(snd_rumble)`.

Ghost sprite set used: `spr_pinkghost_nya_1` (spawn) → `spr_pinkghost_angry` (mode1 start) → `spr_pinkghost_yell_full` (bumps≥7 wind-up) / `spr_pinkghost_shock_full` (bump #7).

---

## 5. obj_pinkcirclestar — ORPHAN SPINNING STAR (NOT referenced by type-202 code)

`grep pinkcirclestar` over the whole GML dump → **no instance_create anywhere**; it is not spawned by the plus-grid/rotbox attack in Ch5 (leftover/unused, or room-placed). Full behavior documented for completeness. Parent `obj_regularbullet`, sprite `spr_pinkstar` (3f, 32×32, origin 16,16).

### Create (`gml_Object_obj_pinkcirclestar_Create_0.gml`)
`target=4; damage=100; element=6; grazepoints=2; image_speed=0; image_index=0`.
`angle[0]=0; angle[1]=0; angle_speed[0]=6; angle_speed[1]=4` (two layers spin at 6°/4° per step).
Trail arrays: 3 entries all init to (x,y). `life_time=0; image_alpha=0; tunnel_lane_layer=0`.
`direction=random(360); pattern_speed = choose(-1,1)*(2+random(4)); speed=2`.

### Step (`gml_Object_obj_pinkcirclestar_Step_0.gml`)
`life_time++`. For i in 0,1: `angle[i] = scr_wrap(angle[i]+angle_speed[i], 0, 360)`.
`life_time<30` → alpha `+0.2` (fade in). `life_time>=300` → alpha `-0.075`, destroy at ≤0.001.

### Draw (`gml_Object_obj_pinkcirclestar_Draw_0.gml`)
- 3 trail copies (i=0..2): `draw_sprite_ext(sprite_index, 0, trail_x[i], trail_y[i], image_xscale*(1-i*0.15), image_yscale*(1-i*0.15), angle[0], image_blend, image_alpha*(0.5-i*0.1))`. (Note: trail_x/trail_y never updated in Step, so they stay at spawn pos.)
- Layer C: frame 2, angle[1], alpha `image_alpha*(1/3)`.
- Layer B: frame 1, angle[0], alpha `image_alpha*(2/3)`.
- Layer A: frame 0, angle[0], alpha `image_alpha`. → stacked 3-frame star, two rotation speeds.

---

## 6. ASSET LIST

### Sprites (name, frames, w, h, originX, originY)
- `spr_pinklanebullet_animation` — 3, 19×19, (9,9) — default lane bullet.
- `spr_pinklanebullet_lane` — 3, 19×19, (9,9) — offset-lane bullet variant.
- `spr_pinkstar` — 3, 32×32, (16,16) — pinkcirclestar.
- `spr_pinkghost_nya_1` — 2, 112×116, (0,0) — ghost spawn face.
- `spr_pinkghost_angry` — 2, 112×116, (0,0) — ghost charging.
- `spr_pinkghost_yell_full` — 2, 145×156, (24,0) — ghost aggro wind-up.
- `spr_pinkghost_shock_full` — 1, 150×130, (0,0) — ghost bump #7.
- `spr_pinkspinarrow` — 1, 16×16, (8,8) — box spin hint arrows.
- `spr_pinkarrows` — 5, 32×32, (0,0) — (used by purplecontrols modes 1; not mode 3).
- `spr_purpleheart` — 2, 20×20, (0,0) — the soul in this attack.
- `spr_pink_ball` — 4, 32×22, (0,0) — pink_battlemovement (difficulty 1 intro).
- `spr_pink_front_ohoho` — 2, 33×44, (16,21); `spr_pink_front_surprised` — 1, 37×44, (18,20) — Mad Mew Mew reaction faces (difficulty 1 intro).
- `spr_dust1` — slide/rise dust (obj_slidedust). `spr_dodgeheartmask` — heart collision mask.

### Sounds
- `snd_heartshot_dr` — lane bullet spawn (pitch 0.65 single, or 0.4+0.9 chord).
- `snd_rumble` — ghost rise-in loop (stopped on arrival & CleanUp).
- `snd_pink_trip` — ghost bump.
- `snd_impact` — box ram / super finisher.
- `snd_impact_bc` — ghost jump-cycle beat (0.5 vol/pitch).
- `snd_pink_laugh_long` — difficulty-1 intro laugh.
- `snd_wing` — heart arm-move on the plus grid.

---

## 7. TIMING / CONSTANTS QUICK TABLE
- Lane fire cadence: `btimer = 40 - floor(0.5 + 40*_binterval)`, loop until `btimer<40`.
- Lane bullet spawn radius from box center: **352 px** (opposite `_bdir`); base speed `_bspeed = list_speed*8` (default 10); base scale ×2 in Create then ×2 in controller = 4×; lane offset 52 px (dokiheart 66 px).
- Lane bullet lifetime cap: `max(80, 720/max(speed,0.1))`; fade-in +0.25/step, fade-out −0.1/step.
- Plus grid: lane_distance **56 px**, arms at 0/90/180/270; nodes radius `4*_scale`; lines in RGB(59,0,59), nodes/heart-path in RGB(170,0,170).
- Rotation: `rotate_speed = clamp(rotate_speed+0.2, 0.2+rotate_momentum, 10)`; laneswap 20 (10 while rotating); ram sets `rotate_speed=6+super*12`, `rotate_travel-=90`, `box_momentum=24`, iframes=10.
- World-scroll factor while rotating: `-(Δrotate_travel)*0.8333333*1.570795` (bulletparents except lanebullets; purplebg ÷4).
- Ghost: spawn at `btimer==-173`; rise goal `y = scr_get_box(5)-132+10`; rise speeds 0.5/2/4/2/1 by life_time; mode-1 speed multipliers by bumps 32/1.5/4/9/11, super at bumps≥7; jump_cycle `+=10*speed`, impact beats at 180 & 360.
- difficulty-1 controller: `global.turntimer=700`, `btimer=-180`, `ammo=6`.

---

## FILE:LINE INDEX
- Attack pick: `gml_Object_obj_pink_enemy_Other_10.gml:59-97`; spawn `gml_Object_obj_pink_enemy_Step_0.gml:1706-1724`.
- Controller type 202: `gml_Object_obj_dbulletcontroller_Step_0.gml:1968-2485` (ghost spawn 2054-2058; lane geometry 2255-2380).
- Lane bullet: `gml_Object_obj_pinklanebullet_Create_0.gml`, `_Step_0.gml`, `_Draw_0.gml`.
- Plus-grid controller mode 3: `gml_Object_obj_purplecontrols_Step_0.gml:361-815`; draw `_Draw_0.gml:151-203` + heart `:535-536`; ram handler `_Other_10.gml`; endstep `_Step_1.gml`; palette `_Draw_0.gml:2-14`.
- Ghost: `gml_Object_obj_huge_anime_face_Create_0.gml`, `_Step_0.gml`, `_Draw_0.gml`, `_CleanUp_0.gml`.
- Star (orphan): `gml_Object_obj_pinkcirclestar_Create_0.gml`, `_Step_0.gml`, `_Draw_0.gml`.
