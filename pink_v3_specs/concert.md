# Pink (Mad Mew Mew) — IDOL CONCERT attack (type 209) — EXACT PORT SPEC

Decompiled from `DELTARUNE Chapter 5 - GML`. All `file:line` refs are to
`gml_Object_<obj>_<Event>.gml` in that folder unless noted.

Color convention: GML stores plain integer colors as **BGR**. RGB = (int & 255,
(int>>8)&255, (int>>16)&255). GML `#RRGGBB` hex literals are already normal RGB.

Box helper (`gml_GlobalScript_scr_get_box.gml`): the fight box is `obj_growtangle`.
- `scr_get_box(0)` = right edge = growtangle.x + sprite_width*0.5
- `scr_get_box(1)` = top edge = growtangle.y - sprite_height*0.5
- `scr_get_box(2)` = left edge = growtangle.x - sprite_width*0.5
- `scr_get_box(3)` = bottom edge = growtangle.y + sprite_height*0.5
- `scr_get_box(4)` = center x = growtangle.x
- `scr_get_box(5)` = center y = growtangle.y
- `camerax()`/`cameray()` = camera view x/y.

The attack is "singing" (`global.monsterattackname = "singing"`), a.k.a. the idol
concert. The 28-member audience pops up around the inside rim of the battle box and
fires hearts at you; on hard difficulty some members are "haters" that lob exploding
mic-stand bombs. You survive on a turn timer; there is no explicit win/kill.

---

## 1. TRIGGER / ENTRY

### 1a. Attack selection (`obj_pink_enemy_Step_0.gml:1755-1764`)
`myattackchoice == 5`:
- If `obj_growtangle` doesn't exist, create it at `(view_x+320, view_y+170)`.
- `global.monsterattackname[myself] = "singing"`.
- `dc = scr_bulletspawner(x, y, obj_dbulletcontroller); dc.type = 209; dc.difficulty = difficulty;`

### 1b. Controller setup, type 209 (`obj_dbulletcontroller_Step_0.gml:3228-3303`)
Runs once when `made == 0` (`:3230`):
- `made = 1`.
- Destroy all `obj_pink_battlemovement` (`:3234-3235`).
- Box target scale: `_box_xscale = 2.4`, `_box_yscale = 1.249` (`:3237-3238`).
- If growtangle already at max scale, respawn a fresh growtangle at same pos and destroy old (`:3240-3250`).
- `obj_grazebox.grazetimefactor = 0` (`:3252-3253`).
- Inside `with(obj_growtangle)` (`:3255-3272`):
  - `maxxscale = 2 * 2.4 = 4.8`, `maxyscale = 2 * 1.249 = 2.498` (`:3257-3258`). Box grows to this.
  - Create `obj_pink_battlemovement` at `(growtangle.x+200, growtangle.y)`, depth `growtangle.depth-11` (`:3260`): `mode=1; air_time=1; sprite_index=spr_pink_ball; image_speed=1; dest_x=controller.x; dest_y=controller.y-136;`. This is Pink flying up onto the stage.
  - If no `obj_pink_curtains`: **create `obj_pink_curtains` at `(growtangle.x, growtangle.y - 88)`, depth `growtangle.depth - 10`** (`:3270-3271`). This is the concert controller.
- `obj_pink_curtains.difficulty = controller.difficulty` (`:3274-3275`).
- `global.turntimer = 425`; if `difficulty > 0`, `+= 80` → 505 (`:3277-3280`).

Per-step while active:
- Easy (`difficulty==0`): at `global.turntimer == 408`, call `scr_moveheart()` if no `obj_moveheart` (`:3283-3290`).
- Hard (`difficulty>0`): at `global.turntimer == 488`, `scr_moveheart()` (`:3292-3299`).
- `obj_heart.wspeed = global.sp * 1.5` every step (`:3301-3302`).

### 1c. Pink lands on the box (`obj_pink_battlemovement_Step_0.gml:44-83`)
When `air_time` runs out and `obj_pink_curtains` exists (`:59-68`):
`depth += 5; sprite_index = spr_pink_sing; image_index=0; image_speed=0; pattern_time=-20; mode=7;`
Then (`:71-78`) `on_the_box=true; box_pushdown_dest=56;` and `obj_purplecontrols.can_spin=true`.
- Singing bob/anim while on box: `obj_pink_battlemovement_Step_0.gml:1336-1370` (image_index += 0.334 idle,
  x eased toward box center) and `:1355-1362` kicks `obj_pink_curtains.pattern_time = 1` (starts the concert loop) when Pink's `pattern_time == 1`.

NOTE ON SPOTLIGHTS: `obj_spotlight*` and `obj_rhythmgame_spotlights` are **NOT used by the
concert** (they belong to other attacks). The Pink fight's own stage lighting is
`obj_pink_spotlight` (character spotlights) + `obj_mewers_live` marquee + `obj_pink_dummy`
audience-silhouette rows, all set up ONCE for the whole boss fight, not per-attack, in
`obj_pink_enemy_Step_0.gml:3129-3193` (see §6). They stay on for the whole fight.

---

## 2. obj_pink_curtains — concert controller + curtains + speakers

Sprite index: `spr_pink_curtain` (32x32, 1 frame, origin 16,16). objects.tsv:253.

### 2a. Create (`obj_pink_curtains_Create_0.gml`)
```
target = 4; damage = 100 (or obj_pink_enemy.damage if it exists)   :1-5
ammo = 5;                 // number of shooting patterns this turn   :7
pattern_repeat = 0;       // pattern-loop counter                    :8
difficulty = 0;                                                       :9
closed = 2;               // curtain-closed amount, 2 → 0 open        :10
surface_effect = surface_create(640, 480);                           :11
```
Data lists (`:12-19`): `l_patterns, l_timings, l_audience_y, l_audience_sway,
l_audience_angle, l_audience_showup, l_audience_hater, l_audience_shoottime`.
```
audience_number = 28;                                                 :20
audience_hitbox[28] = -4;  // array of hitbox instance ids, init -4    :21,31
audience_popout = 0; hater_popout = 0;                               :22-23
```
Per audience member i=0..27 (`:26-33`):
- `l_audience_y[i]  = random(60) + choose(0,180)`  (bob phase 0..60 or 180..240)
- `l_audience_sway[i] = 3 + random(9)`             (sway speed 3..12)
- `l_audience_angle[i] = random(360)`              (sway phase)
- `audience_hitbox[i] = -4`
14 curtain "slats" i=0..13 (`:35-42`): `curtain_sway[i]=0; curtain_angle[i]=0;`
Speakers (`:44-49`): `speaker_scale[0]=speaker_scale[1]=1; speaker_cycle=0;
speaker_phase=0; phase=0; pattern_time=0;`

### 2b. Step_2 (position follow) (`obj_pink_curtains_Step_2.gml`)
If `obj_growtangle` exists AND `global.turntimer > 0`: `x = growtangle.x; y = growtangle.y - 88`.
Else `instance_destroy()`. (Curtains sit 88px above box center; die when turn ends.)

### 2c. Step_0 (main logic) (`obj_pink_curtains_Step_0.gml`)
- `obj_dmgwriter.depth -= 10` each step (`:1-2`).
- **Speaker pulse** (`:4-17`): each step `speaker_scale[k] = 0.2 + speaker_scale[k]*0.8`
  (decays toward ~0.25). `speaker_cycle += 36`; when `>=360`: subtract 360, set both
  `speaker_scale = 1.15` (pop), `speaker_phase++` (wrap at 8). ≈ one pop every 10 steps.
- **Curtain open** (`:19-35`): while `closed > 0`, `closed -= 0.05` per step (2 → 0 over 40
  steps). When it hits 0, set all 14 `curtain_sway[i] = 2 + i`, `curtain_angle[i]=0` (a
  ripple kick as curtains finish opening).
- **Curtain sway physics** per slat i=0..13 (`:37-46`), a damped pendulum:
  ```
  curtain_sway[i] += (0.5 - lengthdir_y(0.5, 270 + curtain_angle[i])) * sign(-curtain_angle[i]) * 2;
  curtain_sway[i]  = scr_approach(curtain_sway[i], 0, 0.25);
  curtain_angle[i] = curtain_angle[i] + curtain_sway[i];
  curtain_angle[i] = scr_approach(curtain_angle[i], 0, max(0, 1 - abs(curtain_sway[i])));
  ```

#### Pattern state machine — `switch(phase)` (`:48-482`)
**phase 0 — build the next audience wave** (`:50-461`). Only if `ammo > 0` and
`pattern_time >= 1`:
- `ammo--; pattern_time = 90;`
- **Refill pattern queue if empty** (`:58-92`): if `l_patterns` empty:
  - If `pattern_repeat==0 && difficulty<=0` (first easy wave): 50/50 add either
    `l_patterns = [4,1,5,2,0]` or `[4,2,5,1,0]`; `l_timings = [80,40,40,60]`.
  - Else `irandom(3)`: case0 `[3,1,5,2,0]`, case1 `[3,2,5,1,0]`, case2 `[3,1,2,5,0]`,
    case3 `[3,2,1,5,0]`; `l_timings = [90,60,60,90]`.
- `_shootorder_variant = irandom(3)` (`:94`), then overridden per formation below.
- **Formation** = `switch(ds_list_find_value(l_patterns,0))` — which audience seats pop up
  and create an `obj_audience_hitbox` per seat (`:96-258`). Seat index i maps to a screen
  position (see §2d). Seat layout: **i 0..6 = LEFT wall (angle 270), i 7..20 = BOTTOM row
  (14 seats), i 21..27 = RIGHT wall (angle 90).** Formations:
  - **case 0** (`:98-129`): seats 4,5,6 (left) + 7..20 (whole bottom) + 25,26,27 (right).
    If `difficulty<=0`, force `_shootorder_variant = 2` (center-out wave).
  - **case 1** (`:131-155`): left seats 2..6, then every-other bottom seats 8,10,12,14.
    Force `_shootorder_variant = 1` (reverse index order).
  - **case 2** (`:157-181`): right seats 23..27, then bottom 19,17,15,13 (step -2).
    Force `_shootorder_variant = 0` (index order).
  - **case 3** (`:183-218`): 13 pseudo-random unique seats via `_dice` walk
    (`_dice = 1+irandom(25)`, each step `+= 1+irandom(24)`, skip seat 21, wrap by
    `-(audience_number-2)=−26`, linear-probe for uniqueness). If `difficulty<=0`, force
    `_shootorder_variant = 3` (shuffled).
  - **case 4** (`:220-242`): bottom seats 9,10,11,12 and 15,16,17,18. If easy, variant 3.
  - **case 5** (`:244-257`): bottom seats 10..17 (8 in a row). If easy, variant 3.
- `ds_list_delete(l_patterns,0)` (`:260`).
- Sort `l_audience_showup` ascending, then **move all seats >=21 (right wall) to the end**
  so right-wall members are processed last (`:261-273`).
- **Haters count** `_haters` by `pattern_repeat` (`:275-288`): repeats 0,1,2,3 → `1`; else → `4`.
- **Per shown seat** build `l_audience_hater` and `l_audience_shoottime` (`:290-315`):
  - `l_audience_hater`: `1` if `difficulty>0 && i<_haters` else `0` (then shuffled at `:345`).
  - `l_audience_shoottime` by `_shootorder_variant`:
    - variant 0: `floor(i * 1.5)` (front-to-back)
    - variant 1: `floor((size - i) * 1.5)` (back-to-front)
    - variant 3: `floor(i * 1)`
    - (variant 2 handled separately below)
- **variant 2** (center-out wave) (`:317-338`): delay `_delay=3`; for each shown seat i:
  if `i < 14` → `floor((14 - i)*3)`; elif `i<21` → `floor((i-14)*3)`; else → `floor((i-14-3)*3)`.
- **variant 3**: `ds_list_shuffle(l_audience_shoottime)` (`:340-342`).
- `ds_list_shuffle(l_audience_hater)` (`:345`). `audience_popout=0; hater_popout=0`.
- **Place & init each hitbox** loop i=0..27 (`:348-449`): only seats in `l_audience_showup`.
  For each existing `audience_hitbox[i]`:
  - `visible = 0` (the hitbox itself is invisible; drawn by curtains surface pass).
  - Copy `audience_y, audience_angle, audience_sway` from lists; `audience_shoottime` and
    `audience_hater` from the showup-indexed lists.
  - Jump/peek params (`:364-377`): non-hater `_jump=10, _popout=0, _curtainpeek=0`;
    hater `_jump=5, _popout=0, _curtainpeek=6`.
  - **Screen position by seat index** (`:379-407`), where `x,y` = curtains pos:
    - `i < 3`  (left, near curtain edge): `x = x+10-160 + _popout + _curtainpeek; y = y+12 + i*24; image_angle = 270`
    - `i < 7`  (left wall): `x = x-160 + _popout; y = y+12 + i*24; image_angle = 270`
    - `i < 21` (bottom row): `x = x + (i-6.5-7)*24; y = y+170 - _popout` (image_angle stays 0)
    - `i < 24` (right, near curtain edge): `x = x-10+164 - _popout - _curtainpeek; y = y+12 + (i-21)*24; image_angle = 90`
    - else (right wall): `x = x+164 - _popout; y = y+12 + (i-21)*24; image_angle = 90`
  - `start_x = x; start_y = y` (`:409-410`).
  - Immediately apply the bob offset via `with(hitbox)` block (`:412-444`) — same formula as
    the hitbox Step (see §3), using `abs(lengthdir_y(_jump, audience_y))` along the wall's
    outward axis plus `_popout`.
- Pop the next `l_timings` value into `pattern_time` and delete it (`:451-455`). `phase++`.

**phase 1** (`:463-466`): `audience_popout = -0.1; phase++;` (nudges the pop-out easing).

**phase 2** (`:468-481`): `pattern_time--`; when `<=0`: clear `l_audience_showup`,
`l_audience_hater`, `l_audience_shoottime`; `pattern_time=1; phase=0; pattern_repeat++`.
Loop back to spawn the next wave (until `ammo` runs out).

### 2d. Draw (`obj_pink_curtains_Draw_0.gml`) — DRAW ORDER + VISUALS
Exit if no `obj_growtangle` (`:1-2`). `_drawdummies = (obj_audience_hitbox exists)` (`:4-7`).

**Speakers** (drawn first, on top of box) — only when `_drawdummies` true (`:9-13`):
- `draw_sprite_ext(spr_dw_castle_tv_speaker, frame 1, camerax()+172, scr_get_box(1)-31, 2*speaker_scale[0], 2*speaker_scale[0], 0, c_white, 1)`
- `draw_sprite_ext(spr_dw_castle_tv_speaker, frame 1, camerax()+468, scr_get_box(1)-31, 2*speaker_scale[1], 2*speaker_scale[1], 0, c_white, 1)`
- `spr_dw_castle_tv_speaker` = 26x41, 2 frames, origin 13,24. Two speakers flanking the top of the box, base scale 2, pulsing with speaker_scale.
- (When NOT `_drawdummies`, the same two speakers are instead drawn INTO the surface at
  `_cx+172` / `_cx+468`, y `= _cy + (scr_get_box(1) - view_y) - 31`, `:35-39`.)

**Audience render via off-screen surface** (`:15-54`):
- `surface_effect` (640x480) is targeted; `draw_clear_alpha(c_black, 0)`.
- If `_drawdummies`: for each `obj_audience_hitbox`, temporarily add `view_x/view_y` to its
  x/y, run its `Draw` event (`event_perform(ev_draw, ev_draw_normal)`), then restore
  (`:41-50`). This draws all audience members + their aim-line into the surface.
- Surface is blitted back with `draw_surface_part(...)` clipped to the inner box, inset by
  `growtangle.image_xscale*2.5 / image_yscale*2.5` on the top-left and `*4` on size
  (`:52-53`). So audience is masked to the box interior.

**Curtains** (drawn every frame, into surface via `draw_sprite_ext`) (`:56-145`):
Grid `_bits_h = 6` columns × `_bits_v = 14` rows of `spr_pink_curtain` (32x32) tiles per side.
- Camera fix `_camfix_x/_y` = 0 when drawing to surface, else `-view_x/-view_y` (`:15-31`).
- Per column i=0..5:
  - Opening offsets while `closed<1`: `_xx1b = lerp(14,0,closed)`, `_xx2b = lerp(8,0,closed)` (`:62-69`).
  - Left column x `_xx1 = _camfix_x + x + (-176 + _xx1b) + i*32` (`:71`).
  - Right column x `_xx2 = _camfix_x + x + (176 - _xx2b) - i*32` (`:72`).
  - `_scale_column = min(-i + clamp(closed,0,1)*6, 1)`; if `<0`, spread columns outward by
    `32*_scale_column` (`:73-79`). This is the accordion open/close.
  - Per row j (0..13, counting down): `_scale_closed` — for the innermost column
    (`i==5`) a hand-tuned taper by row j: j0=1, j1=1, j2=0.975, j3=0.95, j4=0.875,
    j5=0.775, j6=0.65, j7=0.5, j8=0.35, default 0.2 (`:88-131`); all other columns 0.2 (`:135`).
  - `_scale = max(_scale_closed, _scale_column)` (`:138`).
  - Row y `_yy = (_camfix_y + y + j*14) - 12 + lengthdir_y(12, 270 + curtain_angle[j])` (`:139`).
  - Draw LEFT tile (`:140`): `draw_sprite_ext(sprite_index=spr_pink_curtain, -1,
    _xx1 - sprite_width*0.5*(1-_scale) + lengthdir_x(12, 270 - curtain_angle[j]), _yy,
    _scale, 1, 0, c_white, 1)`.
  - Draw RIGHT tile (`:141`): `draw_sprite_ext(spr_pink_curtain, -1,
    _xx2 + sprite_width*0.5*(1-_scale) + lengthdir_x(12, 270 + curtain_angle[j]), _yy,
    _scale, 1, 0, c_white, 1)`.
  - Curtains use only x-scale animation (yscale fixed 1), sway from `curtain_angle[j]`.
- When NOT `_drawdummies` (surface being composited to world), the whole surface is drawn
  with `draw_surface_ext` transformed to match growtangle's angle/scale (`:147-156`).

### 2e. CleanUp (`obj_pink_curtains_CleanUp_0.gml`)
`surface_free(surface_effect)` and destroy all 8 ds_lists.

---

## 3. obj_audience_hitbox — one audience member (invisible hitbox + custom draw)

Parent `obj_regularbullet`; sprite `spr_pixel_2x` (2x2, mask 2x2). Deals contact damage.
objects.tsv:216.

### Create (`obj_audience_hitbox_Create_0.gml`)
`event_inherited()`. `target=4; damage=100` (or pink's). `element=6; active=1; life_time=0;
destroyonhit=0; image_xscale=2; image_yscale=2;` (4x4 hitbox). `start_x=start_y=0;
audience_y=0; audience_sway=0; audience_angle=0; audience_hater=0; audience_shoottime=0;
audience_popout=-40; hater_popout=-40; image_angle=0; phase=1; pattern_time=0;`

### Step (`obj_audience_hitbox_Step_0.gml`)
`event_inherited()`. `switch(phase)`:
- **phase 1** (`:5-54`), the "on stage" phase:
  - `pattern_time++`. `audience_popout *= 0.9` (eased toward 0, snapped to 0 within ±0.1);
    same for `hater_popout` (`:6-15`). This is the pop-up-into-view slide.
  - **Shooting** at `pattern_time >= 20` (`:17-34`): if NOT a hater and `audience_shoottime>0`,
    decrement it; when it reaches exactly 0, **fire a heart**:
    `_shot = instance_create_depth(x, y, depth-2, obj_audienceheart);
    _shot.speed = 1; _shot.pattern_time = -irandom(4); _shot.direction = image_angle + 90;`
    then set `audience_shoottime = -1` (fires once). Note `image_angle+90`: left wall
    (270)→0° right, bottom (0)→90° up, right wall (90)→180° left = inward into the arena.
  - **Hater conversion** at `pattern_time == 55` (`:36-45`): if hater, spawn
    `obj_audiencehater` at `(x,y)`, depth `depth-6`, set its
    `image_angle = lengthdir_y(30, audience_angle) + image_angle`, then `instance_destroy()`
    this hitbox. (The hater's mic-stand bomb replaces the member.)
  - At `pattern_time >= 60` (`:47-52`): `audience_popout=-0.1; pattern_time=0; phase=2`.
- **phase 2** — retract (`:56-67`): `pattern_time++`;
  `audience_popout = clamp(audience_popout*1.25, -40, 40)` (slides back off screen); at
  `pattern_time >= 30`, zero popouts and `instance_destroy()`.

**Continuous bob** every step (`:70-109`):
- `audience_y += 18` (wrap at 360); `audience_angle += audience_sway` (wrap at 360).
- Jump/popout by hater flag (`:82-93`): non-hater `_jump=10, _popout=audience_popout,
  _curtainpeek=0`; hater `_jump=5, _popout=hater_popout, _curtainpeek=6`.
- Position along the outward axis of the wall:
  - `image_angle==270` (left): `x = start_x + abs(lengthdir_y(_jump, audience_y)) + _popout; y=start_y`
  - `image_angle==0` (bottom): `x=start_x; y = start_y - abs(lengthdir_y(_jump, audience_y)) - _popout`
  - `image_angle==90` (right): `x = start_x - abs(lengthdir_y(_jump, audience_y)) - _popout; y=start_y`

### Draw (`obj_audience_hitbox_Draw_0.gml`) — drawn into curtains' surface
`draw_self()` first (the 2x2 hitbox, effectively invisible). Then per `image_angle` branch,
draw the visible dummy sprite + a pink aim line:
- Colors: non-hater `_color = 13421772` = BGR → **RGB(204,204,204) #CCCCCC** (light grey);
  hater `_color = 1118685` = BGR → **RGB(29,17,17) #1D1111** (near-black).
- **left (270)** (`:3-28`): `draw_sprite_ext(spr_dummyaudience, frame=audience_hater, x, y,
  1, 1, lengthdir_y(30, audience_angle) - 90, _color, 1)`. Aim line: `draw_set_color(#FF6688)`
  (pink RGB 255,102,136), `_dir = lengthdir_y(30, audience_y) + 45 - 90`,
  `draw_line_width(x-5, y+4, x-5+lengthdir_y(10,_dir), y+4+lengthdir_x(10,_dir), 3)`.
- **bottom (0)** (`:30-51`): sprite angle `lengthdir_y(30, audience_angle)`, aim
  `_dir = lengthdir_y(30, audience_y) + 45`, line from `(x+5, y+4)` length 10 width 3.
- **right (90)** (`:53-78`): sprite angle `lengthdir_y(30, audience_angle) + 90`, aim
  `_dir = lengthdir_y(30, audience_y) + 45 + 90`, line from `(x+5, y-4)` width 3.
- `spr_dummyaudience` = 24x24, **2 frames** (frame 0 = normal fan, frame 1 = hater),
  origin 12,12. The sprite bobs/rotates via `audience_angle`; the `#FF6688` line is the
  little pink arm/glowstick pointing by `audience_y` phase.

---

## 4. obj_audienceheart — the fired heart bullet (the U-ring projectiles)

Parent `obj_regularbullet`; sprite `spr_heartbullet` (18x18, 1 frame, origin 9,9). objects.tsv:341.

### Create (`obj_audienceheart_Create_0.gml`)
`event_inherited()`. `target=4; damage=100` (or pink's). `element=6; active=1; float_dir=0;
life_time=0; grazepoints=2; image_xscale=0.025; image_yscale=0.025; phase=0; pattern_time=0;`
Sound: `snd_stop(snd_ghostappear); snd_play_x(snd_ghostappear, 1, 1.5)` (pitch 1.5).
(Spawned by the hitbox with `speed=1; direction = image_angle+90; pattern_time = -irandom(4)`.)

### Step (`obj_audienceheart_Step_0.gml`) — grow → home → launch
`event_inherited()`. `_mainscale = 1.5`.
- **phase 0** (`:6-87`): `pattern_time++`. `_timebeforeturn=11; _timetolaunch=32`.
  - **Grow-in wobble** while `pattern_time < 22` (`:11-15`):
    `image_xscale = _mainscale - lengthdir_x(max(0, (_mainscale/2) - (life_time*_mainscale/24)), (life_time*66) % 360)`;
    `image_yscale = image_xscale`. (Pops from ~0 up to 1.5 with a spin.)
  - **Pre-launch squash** at `pattern_time >= 25` (`:16-41`): by `pattern_time-25`:
    0→`1.5*1.2`, 1→`*1.3`, 2→`*1.38`, 3→`*1.42`, default→`*1.45` for xscale;
    `image_yscale = _mainscale + (_mainscale - image_xscale)` (inverse squash).
  - **Homing** at `pattern_time >= 11` (`:43-66`): `speed = min(speed, 0.25)` (nearly stops);
    if `obj_heart` exists, turn `image_angle-90` toward the heart at max ±2°/step, then blend
    `_dir = _dir*0.8 + _dest*0.2`; `image_angle = _dir + 90`.
  - **Trail** at `pattern_time == 31` (`:68-78`): spawn `obj_pinktrail` copy (sprite same,
    xscale `1.5*0.875`, yscale `1.5*1.125`, direction `image_angle-90`, speed 5).
  - **Launch** at `pattern_time >= 32` (`:80-85`): `direction = image_angle-90; pattern_time=0; phase++`.
- **phase 1** — flight (`:89-142`): `pattern_time++`.
  - At `pattern_time == 10`: `snd_stop(snd_heartshot_dr_b); snd_play_x(snd_heartshot_dr_b, 0.5, 0.5)` (`:92-95`).
  - `speed += 0.25 + pattern_time/32` (accelerating) (`:98`).
  - Squash-recover by `pattern_time` (`:100-128`): 1→`1.5*1.42`, 2→`*1.24`, 3→`*1.16`,
    4→`*1.08`, 5→`*1.04`, 6→`*1.01`, default `image_xscale *= 0.98`;
    `image_yscale = _mainscale + (_mainscale - image_xscale)`.
  - Every 2 steps spawn an `obj_pinktrail` copy of current sprite/scale/angle (`:132-140`).
- `life_time++`.

### Draw (`obj_audienceheart_Draw_0.gml`)
`draw_sprite_ext(sprite_index, -1, x, y, image_xscale, image_yscale, image_angle, image_blend, image_alpha)`.

The "U-ring of bullets" the caller mentions is the emergent result of the whole audience row
firing hearts inward with staggered `audience_shoottime` (variant 2 fires center-out, giving
the ripple/arc), each heart homing slightly toward the player then launching — around the
left/bottom/right walls it forms a U of incoming hearts.

---

## 5. obj_audiencehater — hard-mode mic-stand bomb (thrown, explodes)

Parent `obj_regularbullet`; sprite `spr_dummyaudience` (24x24, 2 frames). objects.tsv:1142.
Spawned from a hater hitbox at member `pattern_time==55` (§3), replacing that member.

### Create (`obj_audiencehater_Create_0.gml`)
`event_inherited()`. `target=4; damage=100` (or pink's). `grazepoints=2; active=1;
destroyonhit=0; life_time=0; image_xscale=1; image_yscale=1; phase=0; pattern_time=0;
launch_time=0; boom_frame=-1; boom_x=x; boom_y=y; bar_x=x; bar_y=y; bar_hspeed=0;
bar_vspeed=0; bar_spin=0; bar_angle=0;`

### Step (`obj_audiencehater_Step_0.gml`)
`event_inherited()`. `switch(phase)`:
- **phase 0** — wind-up + aim (`:5-94`): `pattern_time++`.
  - **Set launch_time once** (`:8-23`): if `launch_time<=0`, count all haters still in phase 0
    with `pattern_time<10` into `_amount`, then set every such hater's
    `launch_time = 46 + (_amount-1)*2` (staggers simultaneous haters).
  - **Squash windup** at `pattern_time >= launch_time-25` (`:25-27`):
    `image_yscale = image_yscale*0.8 + 0.1334`; `image_xscale = 1 + (1 - image_yscale)`.
  - **Aim with overshoot** if `obj_heart` exists (`:31-47`): `_distance = dist to heart`,
    `_overshoot = _distance^2 / 860`, aim at `obj_heart.y - _overshoot` (lob arc);
    turn `image_angle+90` toward it via `_dir = _dir*0.8 + _dest*0.2`; `image_angle = _dir-90`.
  - **Pre-throw burst trails** at `pattern_time == launch_time-9` (`:49-68`): spawn 4
    `obj_pinktrail` (image_index 1, blend `#FFFF88` = RGB 255,255,136), directions 0/90/180/270, speed 3,
    offset by `_scalepush = (1-image_yscale)*sprite_get_height*0.75` along `image_angle+270`.
  - **LAUNCH** at `pattern_time >= launch_time` (`:70-92`): play `snd_explosion_mmx3` (if not
    already), `direction = point_direction(x,y, heart.x, heart.y-_overshoot); speed = 15;
    gravity_direction = 270; gravity = 0.5; image_xscale=image_yscale=1; boom_frame=0;
    boom_x=x; boom_y=y;` and spawn the tumbling **mic-bar**:
    `bar_x = x + lengthdir_x(7, 315+image_angle); bar_y = y + lengthdir_y(7, 315+image_angle);
    bar_hspeed = -sign(hspeed)*random(abs(hspeed/2)); bar_vspeed = -3 - random(7);
    bar_spin = choose(-1,1)*(5 + random(85)); bar_angle = random(360);` `pattern_time=0; phase++`.
- **phase 1** — projectile + explosion anim (`:96-143`):
  - Bar physics: `bar_x += bar_hspeed; bar_y += bar_vspeed; bar_vspeed += 0.4` (gravity);
    `bar_angle += bar_spin` (wrapped 0..360).
  - `boom_frame` advance schedule (`:108-129`): frames 0-4 +1/step, frame 5 +0.5, frames 6-7 +0.334.
  - `hspeed *= 0.999`. Every 2 steps spawn `obj_pinktrail` copy (`:133-141`).
- `life_time++`.

### Step_2 (`obj_audiencehater_Step_2.gml`)
If `gravity > 0`: `image_angle = direction - 90` (rotate to travel direction after launch).

### Draw (`obj_audiencehater_Draw_0.gml`)
- **phase 0** (`:5-13`): `_col = 1118685` (#1D1111); at `pattern_time` in `[launch_time-9,
  launch_time-7)` flash `_col = 8978431` = BGR → **RGB(255,255,136) #FFFF88** (yellow flash).
  `_xx = (((pattern_time%2)*2)-1) * max(0, (pattern_time+31-launch_time)/15)` (jitter shake).
  `_scalepush = (1-image_yscale)*sprite_get_height*0.75`.
- **default/phase1** (`:15-19`): `_col = 16777215` white; `_xx=0; _scalepush=0`.
- Body (`:21`): `draw_sprite_ext(sprite_index=spr_dummyaudience, frame 1,
  x + lengthdir_x(_scalepush, image_angle+270) + _xx, y + lengthdir_y(_scalepush, image_angle+270),
  image_xscale, image_yscale, image_angle, _col, image_alpha)`.
- **phase 0 aim line** (`:23-28`): `#FF6688`, `_dir = image_angle+35`,
  `d_line_width` length 10 width 3 from the offset mic point `(x+lengthdir_x(7,315+image_angle)+scalepush, …)`.
- **phase 1 explosion** (`:30-40`): if `boom_frame` in [0,8): `draw_sprite(spr_explosion_round,
  floor(boom_frame), boom_x-25, boom_y-35)` (50x50, 9 frames). Plus the tumbling mic-bar:
  `#FF6688`, `d_line_width(bar_x - lengthdir_x(3,bar_angle), bar_y - lengthdir_y(3,bar_angle),
  bar_x + lengthdir_x(7,bar_angle), bar_y + lengthdir_y(7,bar_angle), 3)`.

---

## 6. Persistent stage staging (whole fight, incl. concert) — reference

Set up once in `obj_pink_enemy_Step_0.gml:3129-3193` (`spotlightinit`), NOT concert-specific
but present during the concert:
- `obj_pink_spotlight` per hero + Pink (`:3133-3164`): sprites `spr_pink_spotlight_kris/
  susie/ralsei/pink`, scale 2, alpha eased 0→1 via `lerp(image_alpha,1,0.3)` when
  `pink_bg_con==1` (`:3232-3242`), eased to 0 when hidden/`pink_bg_con==3` (`:3294-3295`).
  Positions: kris `(herokris.x+22, .y+106)`, susie `(+52,+126)`, ralsei `(+53,+92)`,
  pink `(x+28, y+82)`.
- `obj_mewers_live` marquee at `(camerax()+camerawidth()/2, cameray()-120)` (`:3165`).
- 16 `obj_pink_dummy` bg silhouettes `spr_pink_bg_dummy` scale 2 across the top
  (`camerax()+a*51, cameray()-62`), and 8 fg `spr_pink_fg_dummy` along the bottom
  (`camerax()+a*121, cameray()+620`) (`:3166-3192`). They wave via `wavetimer`, ease
  yoffset toward 124 (bg) / -300 (fg) when `pink_bg_con==1`.

Pink herself sings on the box: `spr_pink_sing` / `spr_pink_sing_idle` / `spr_pink_ball`
(entry), `image_speed` driven manually (see §1c).

**NOT USED by the concert:** `obj_spotlight`, `obj_spotlight_blocker`, `obj_spotlight_wall`,
`obj_spotlight_darkobj`, `obj_spotlight_backlighting`, `obj_rhythmgame_spotlights` — these
belong to other Pink attacks/minigames, not type 209. Do not port them into the concert.

---

## 7. ASSET LIST

### Sprites
| sprite | size | frames | origin | use |
|---|---|---|---|---|
| spr_pink_curtain | 32x32 | 1 | 16,16 | curtain tiles (6col×14row per side) |
| spr_dw_castle_tv_speaker | 26x41 | 2 | 13,24 | two pulsing speakers (uses frame 1) |
| spr_dummyaudience | 24x24 | 2 | 12,12 | audience member (frame0 fan / frame1 hater); also hater bomb body |
| spr_heartbullet | 18x18 | 1 | 9,9 | fired audience heart |
| spr_pixel_2x | 2x2 | 2 | 1,1 | invisible audience hitbox (scaled x2) |
| spr_explosion_round | 50x50 | 9 | 0,0 | hater bomb explosion |
| spr_pink_ball / spr_pink_sing / spr_pink_sing_idle | — | — | — | Pink entry + singing |
| spr_pink_spotlight_kris/susie/ralsei/pink, spr_pink_bg_dummy, spr_pink_fg_dummy | — | — | — | persistent stage lights/audience |

### Sounds
| sound | use | play |
|---|---|---|
| snd_ghostappear | heart spawn | `snd_play_x(...,1,1.5)` pitch 1.5, on audienceheart Create |
| snd_heartshot_dr_b | heart launch | `snd_play_x(...,0.5,0.5)`, phase1 pattern_time==10 |
| snd_explosion_mmx3 | hater bomb throw | `snd_play(...)` at hater launch |

### Colors (BGR ints → RGB)
| int | RGB | hex | use |
|---|---|---|---|
| 13421772 | 204,204,204 | #CCCCCC | normal audience member tint |
| 1118685 | 29,17,17 | #1D1111 | hater member / bomb (dark) |
| 8978431 | 255,255,136 | #FFFF88 | hater pre-throw flash |
| 16777215 | 255,255,255 | #FFFFFF | bomb in flight |
| `#FF6688` (GML literal, RGB) | 255,102,136 | #FF6688 | pink aim lines / mic bar |
| `#FFFF88` (GML literal, RGB) | 255,255,136 | #FFFF88 | hater burst-trail blend |

### Key numbers
- Turn timer: 425 (easy) / 505 (hard). moveheart at turntimer 408 (easy) / 488 (hard).
- Box target scale: maxxscale 4.8, maxyscale 2.498. Curtains at `(box.x, box.y-88)`.
- 28 audience seats (0-6 left/270°, 7-20 bottom/0°, 21-27 right/90°). Seat pitch 24px.
- 5 patterns per turn (`ammo=5`). Pattern timings [80,40,40,60] (first easy) / [90,60,60,90].
- Member lifecycle: shoot window opens at pattern_time 20, hater converts at 55, retract at 60→30.
- Heart: grow ~22 steps, homing from t≥11, launch at t=32, accel `+=0.25+t/32`.
- Hater bomb: launch_time `46+(_amount-1)*2`, launch speed 15, gravity 0.5 dir 270.
- Curtain open: `closed` 2→0 at 0.05/step (~40 steps); speaker pop every ~10 steps (cycle+=36).
