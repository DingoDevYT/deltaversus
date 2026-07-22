# PINK BOSS — PIÑATA BOMBS SUBSYSTEM (types 203 & 206) — EXACT PORT SPEC

Scope: `obj_pink_battlemovement` (the thrower / Pink herself), `obj_fusebomb` (small doki
bomb), `obj_fusebomb_big` (giant bomb + finale wave-spin), `obj_pinkbombexplosion`
(explosion visual + hitbox), `obj_plat_pinatabell_pink` (piñata bell, platforming),
`obj_dokiheart` (heal collectible dropped by heart-flagged bombs).

All `file:line` refs are to `DELTARUNE - GML\DELTARUNE Chapter 5 - GML\`.
Colors decoded RGB = (int & 255, (int>>8)&255, (int>>16)&255) — GML stores 0xBBGGRR.

Global helpers referenced:
- `scr_get_box(n)`: 0=right edge, 1=top, 2=left, 3=bottom, 4=center X, 5=center Y of the
  battle box (`obj_growtangle`). When no box exists, box center = camera view + (320,240).
- Lane grid: 4 lanes each axis (grid 0..3), `_lane_distance = 40`. Pixel of a cell:
  `x = (box_cx - 40*1.5) + grid_x*40`, `y = (box_cy - 40*1.5) + grid_y*40`. So the 4×4 grid
  spans center ±60px, cell centers at box_c −60,−20,+20,+60.

---

## ASSET LIST

Sprites (frames / w×h / originX,Y from sprites.tsv):
| sprite | frames | w×h | origin |
|---|---|---|---|
| spr_fusebomb | 5 | 20×20 | 12,13 | small doki bomb body (5 fuse-length frames) |
| spr_fusebomb_big | 1 | 64×64 | 32,32 | giant bomb body |
| spr_fusebomb_burning | 4 | 16×16 | 8,8 | fuse spark (4-frame loop) |
| spr_fusebomb_shadow | 4 | 16×16 | 8,6 | collision mask for both bombs |
| spr_fusebomb_explosion_1 | 16 | 24×24 | 12,12 | central explosion (default) |
| spr_fusebomb_explosion_2 | 16 | 24×24 | 12,12 | radial cross-arm explosion |
| spr_pink_throw_bomb | 9 | 50×65 | 25,42 | mode-5 side throw (small anim) |
| spr_pink_throw_bomb2 | 15 | 64×88 | 39,65 | mode-5 side throw (big-bomb anim) |
| spr_pink_front_throw_bomb | 17 | 44×91 | 18,61 | interlude modes 2/3/4 front throw |
| spr_pink_front_ohoho | 2 | 33×44 | 16,21 | laugh after mode-2 |
| spr_pink_front_surprised | 1 | 37×44 | 18,20 | hit-by-own-bomb / stuck |
| spr_pink_front_burnt | 1 | 37×44 | 18,20 | burnt (grow>1 blast) |
| spr_pink_ball | 4 | 32×22 | 0,0 | rolling exit |
| spr_pink_idle | 5 | 41×42 | 0,0 | idle between throws |
| spr_pink_run | 3 | 38×38 | 17,16 | mode-6 run |
| spr_pink_sing / _idle / _turn | 9/9/2 | 36×46 / 41×46 | — | mode-7 curtains sing |
| spr_dokiheart | 1 | 24×24 | 12,10 | heal heart drop |
| spr_bell_small_pink | 4 | 19×19 | 9,2 | piñata bell body |
| spr_bell_shard | 3 | 5×5 | 2,2 | bell shatter shard |
| spr_bellsparkle | 4 | 15×15 | 7,7 | bell-ring sparkle |
| spr_tinysparkle_x | 5 | 5×5 | 2,2 | bell explode sparkle |
| spr_bhero_flame (spr_pinkmeteorfire) | 1 | 20×16 | 10,8 | explosion smoke puff |
| spr_finisher_explosion | 7 | 270×204 | 135,105 | dokiheart pickup burst |

Sounds: `snd_explosion_mmx` (bomb blast), `snd_pink_throw`, `snd_pink_throw2`,
`snd_whip_throw_only`, `snd_bump`, `snd_pink_huh`, `snd_pink_laugh_long`, `snd_pink_trip`,
`snd_pombark` (heart bounces a live bomb), `snd_coin` (audience-heart grab),
`snd_glassbreak` / `snd_playablebell` / `snd_power` / `snd_swallow` (bell + doki pickup).

Object parents (objects.tsv): `obj_fusebomb`, `obj_fusebomb_big`, `obj_pinkbombexplosion`
all parent `obj_regularbullet`; mask_sprite of both bombs = `spr_fusebomb_shadow`.
`obj_dokiheart` parents `obj_bullet_healing`; `obj_plat_pinatabell_pink` parents
`obj_verlet_rope`.

---

## obj_pink_battlemovement — the thrower

### Create (`gml_Object_obj_pink_battlemovement_Create_0.gml`)
Runs inside `with(obj_pink_enemy)` (Pink's on-screen body), hiding `obj_pink_enemy.visible`
so this object becomes the animated body. Key inits (Create:1-43):
- `image_xscale = image_yscale = 2`, `image_speed = 0.334`.
- `mode=0; phase=0; pattern_time=0; animation_time=0`.
- `grid_x=irandom(3); grid_y=irandom(3); pattern_variant=irandom(3)`.
- `ammo=0; ammo_b=0; ammo_max=0; shots=0; shots_total=0; pattern_repeat=0`.
- `list_bomb=ds_list_create()` (the throw queue), `list_bomb_xy=ds_list_create()` (target
  cell pairs), `list_burnt=ds_list_create()` (per-cell self-burn flags, 4×6 grid).
- `bigbomb_id=-4; ammo_doki=3`.
- `start_x/start_y = x/y`, `dest_x/dest_y = x/y`.
- `wave_angle=90; wave_speed=0; shake_x=0; shake_y=0; flash_amount=0`.
- `on_the_box=false; box_pushdown_dest=0; box_pushdown_real=0; box_y_original` = growtangle y.
- `air_time=1; air_height=90`.

Destroy (`..._Destroy_0.gml`): restore growtangle y; re-show `obj_pink_enemy`.
CleanUp: destroy the three ds_lists.

### Step (`gml_Object_obj_pink_battlemovement_Step_0.gml`) — top-of-step, every mode
- `shake_x→0` by 2/step, `shake_y→0` by 2/step, `flash_amount→0` by 0.1/step (Step:1-3).

Modes (`switch(mode)`):

**mode 0** (Step:7-25): if sprite==`spr_pink_front_ohoho`, run the laugh timing:
animation_time++ → frame reset & image_speed 0.5 at t1, 0.334 at t5, 0.25 at t17.

**mode 1** (Step:27-86): Pink drops onto the box as a ball. Box grows back to full
(`obj_growtangle` xscale/yscale lerp 0.75→maxscale). Descent: `air_time -= 5.12/air_height`
(air_height=90). On land: snap to dest, mode→0; if no curtains → `spr_pink_idle`; else set
`spr_pink_sing`, `pattern_time=-20`, mode→7. If `global.turntimer>0`: `on_the_box=true`,
`box_pushdown_dest=56`, enable `obj_purplecontrols.can_spin`; else `instance_destroy()`.

**modes 2 / 3 / 4** — FRONT interlude throws (Step:88-526). Sprite
`spr_pink_front_throw_bomb`. Sub-`switch(phase)`:
- phase 0 (Step:93-206): set sprite, image_index 0, image_speed 0. `ammo = 4/2/7` for
  mode 2/3/4. Build `list_bomb`:
  - mode 3 (Step:112-153): `irandom(8)` picks one of 9 `(x_offset, big_grid)` pairs added to
    list_bomb, then `ds_list_shuffle`. Pairs: (0,1.5)(0,2)(0,2.5)(0.5,2)(0.5,2.5)(0.5,3)
    (1,2.5)(1,3) default(1.5,3).
  - mode 4 (Step:155-198): same table shuffled, then `ds_list_insert(list_bomb,0,0)` and
    `ds_list_add(list_bomb,0)` — bookends a plain small-throw at start & end.
  - default/mode 2 (Step:200-202): `ds_list_add(list_bomb,0,1,2,3)` then shuffle (4 lanes).
  - `shots=0`, phase++ (falls through into 1).
- phase 1 (Step:208-334): frame-by-frame windup on `spr_pink_front_throw_bomb`, custom
  per-frame `image_index +=` speeds (0:+0.125,1:+0.334,2:+0.334,3:+0.5,4:+0.5,5:+0.25,
  6:+0.5,7..9:+1,10:+1,11:+1,12: varies,13..:+0.334). At floor==10 for mode 4 with `ammo_b>0`
  (Step:254-288): spawn/grow the held `obj_fusebomb` `bigbomb_id` at `(x+4, y-88)`,
  `fuse_time=60, air_time=0, air_height=0, mode=1, inside_the_grid=false, grid_x=1.5`, placed
  at dest; if it already exists, `grow += min(ammo_b,0.3)` and drain ammo_b. At floor==12 with
  a live bigbomb (Step:296-312): pattern_time++, `snd_pink_huh` at t20, then shake_x ±2 on a
  4-frame cadence. At floor≥14 (Step:324-331): `y -= 24`, phase++.
- phase 2 (Step:336-487): the actual throw. At floor==15 (Step:339-385): `ammo--; shots++;
  shots_total++`. If no bigbomb held → play `choose(snd_pink_throw,snd_pink_throw2)` +
  `snd_whip_throw_only` + `snd_bump`, spawn `obj_fusebomb` at
  `x-60 + list_bomb[ammo%4]*40, y+58`, then override: `fuse_time=40, air_height=110, mode=1,
  inside_the_grid=false, x=thrower.x, y=dest_y+16, grid_x=list_bomb[ammo%4]`. If a bigbomb IS
  held → push it out: `fuse_time=45, air_time=1, air_height=20, mode=1, x=thrower.x,
  dest_y+=106`. Remaining frames re-loop (image_index resets to 3) while `ammo>0`; mode-4
  refills list_bomb (0,1,2,3 shuffled) and sets `ammo_b=1.5` when `ammo<=1` (Step:416-427).
  Each throw sound cluster: throw + whip + bump.
- phase 3 (Step:489-523): recovery. mode 2 at pattern_time 25 → `snd_pink_laugh_long`, switch
  to `spr_pink_front_ohoho` (image_speed 0.5→0.334 at t29→0.25 at t41).

**mode 5 — MAIN BOMB THROWER** (Step:528-1253). Sprite `spr_pink_throw_bomb` (9f) or
`spr_pink_throw_bomb2` (15f, used for big bombs). `list_bomb` is pre-populated by the chart
dispatcher (TYPE 203/206) with per-throw **code values**:
`0` = small doki bomb (`obj_fusebomb`), `1` = big bomb random center lane, `2`/`4` = big bomb
targeted (4 = also drops a heart), `3` = finale center big bomb + wave-spin. `phase`:

- phase 0 (Step:533-692) — setup when `ds_list_size(list_bomb)>0`:
  - `sprite_index=spr_pink_throw_bomb`, image_index 0, image_speed 0, pattern_time 0,
    `ammo_max = ds_list_size(list_bomb)`.
  - default grid_x/grid_y if <0 = irandom(3); if `ammo_max<=3` reroll pattern_variant.
  - Count ammo = list size; `ammo_b` = 0 if all entries are 0 else 1 (last-seen entry wins).
  - If `ammo_b==0` (pure small-bomb wave): build `list_bomb_xy` target cells.
    - `ammo_max>=4` (Step:566-629): nudge grid_x/grid_y toward center (1↔2, else 1+irandom),
      then a shuffled `_list_random` of 0..3 lays 4 edge-anchored cells into list_bomb_xy:
      code0→(grid_x,0), 1→(grid_x,3), 2→(0,grid_y), 3→(3,grid_y).
    - `ammo_max<=3` (Step:632-684): walk a knight-ish pattern from (grid_x,grid_y) using
      pattern_variant to choose +1/+2 x & +2/+1 y steps, wrapping mod 4, appending each cell.
  - `ds_list_size==1` → `ammo_doki=2`. `shots=0`, phase++ (falls into 1).
  - else if `global.turntimer<=0`: `_end_the_thing=true`.

- phase 1 (Step:699-1087) — windup + release for the CURRENT `list_bomb[0]`:
  - `_fastthrow` if `ammo_max>=4` or (`ammo_max>=3 && ammo+1<ammo_max`).
  - Two animation tables (one per sprite) advance image_index; the release frame is
    image_index≥5 (`spr_pink_throw_bomb`) or ≥11 (`spr_pink_throw_bomb2`) → `_thrown=true`.
    The last wind-up frame's speed depends on the queued type (Step:726-744 / 799-816):
    `list_bomb[0]==3 → +0.03` (slow, finale), `ammo_b>=1 → +0.04`,
    else `+0.167 / +0.2 / +0.25` by `pattern_repeat` (≤0 / ≤3 / else).
  - On `_thrown` (Step:828-951): `ammo--; shots++; shots_total++`. Box center from scr_get_box.
    Dispatch by `list_bomb[0]`:
    - **==0 SMALL DOKI BOMB** (Step:844-872): `ammo_doki--`, pop the front (x,y) from
      list_bomb_xy, play throw+whip, `ammo_b=0`. Spawn `obj_fusebomb` at the target cell pixel
      (depth-1). Override: if `ammo_doki<=0` → reset ammo_doki=2 and `has_heart=true`;
      **`fuse_time = (55 + ammo*2) - pattern_repeat*2`**; `grid_x=_xx, grid_y=_yy,
      air_height=110, mode=1, x=thrower.x-4, y=thrower.y-88`.
    - **==1 BIG RANDOM** (Step:874-895): `ammo_b=1`, cell = `(choose(1,2), 1)`. Spawn
      `obj_fusebomb_big`: `fuse_time=60, air_height=110, mode=0, active=1, friendlyfire=true,
      x=thrower.x-4, y=thrower.y-88`.
    - **==2 or ==4 BIG TARGETED** (Step:897-926): `ammo_b=1`, pop cell from list_bomb_xy.
      Spawn `obj_fusebomb_big`: **`fuse_time = 52 + ammo*3`**, `warn_time=28, air_height=110,
      mode=0, active=1`; if code==4 → `has_heart=true`; `x=thrower.x-4, y=thrower.y-88`; then
      thrower `y -= 2`.
    - **==3 FINALE CENTER** (Step:928-949): `ammo_b=1`. Spawn `obj_fusebomb_big` at box CENTER
      (`_box_x,_box_y`): `fuse_time=120, air_height=110, air_time=0, mode=1, active=1,
      friendlyfire=true, x=thrower.x-4, y=thrower.y-136`. Then thrower: `image_index=4.999`,
      `pattern_time=0`, **`phase=3`** (enter spin), **`wave_speed = choose(3.85, 4.725, 5.15,
      5.95)`**.
    - `ds_list_delete(list_bomb,0)` after every throw.
  - If not thrown and `ammo>0` (Step:953-1018): loop back through mid-anim frames; end frame
    resets to image_index 4 (`_fastthrow`) or 3 → next windup.
  - If not thrown and `ammo<=0` (Step:1019-1085): play out release frames; when done set
    `image_index=2.999`, phase++.

- phase 2 (Step:1089-1122) — between waves: if list_bomb still has entries, snap to idle,
  `pattern_repeat++`, phase=0 (immediate next wave). Else ease image_index back down to idle,
  then idle + `pattern_repeat++`, phase=0.

- phase 3 (Step:1124-1225) — **FINALE WAVE-SPIN** (only on `spr_pink_throw_bomb`):
  - pattern_time++. Trip sounds at t=20,46,68,86,100,112 (`snd_pink_trip` rising pitch
    0.99→1.3). Sweat drops spawned each step after t≥10.
  - After t≥20 (Step:1167-1195): compute `_endspeed` — if a live `obj_fusebomb_big` in mode 1
    has `fuse_time<=25`, `_endspeed = clamp((fuse_time/25)*2 - 1, 0, 1)` (spin winds down as
    the center bomb nears blast). `_pattime = pattern_time-20`. shake_x = choose(-2,0,2) once
    `_pattime>=30`.
  - **Orbit angle**: `wave_angle += 1 + (min(_pattime,20)/10) * wave_speed * _endspeed`
    (mod 360). This is the spin rate; wave_speed is one of the four finale choices above.
  - **Pink's orbit position** (Step:1187-1194, when box exists):
    `_dx = box_cx + 198 + lengthdir_x(6, (wave_angle*8) % 360)`;
    `_dy = box_cy + 34 + lengthdir_y(96, wave_angle) + _pattime`;
    `_ratio = clamp(_pattime/30,0,1) * 0.5`; `x = x*(1-_ratio) + _dx*_ratio`, same for y.
    (Pink lerps toward an elliptical orbit — 96px vertical radius, small 6px fast horizontal
    wobble at 8× angle — while sliding downward by `_pattime`.)
  - Body rock: image_index oscillates 2↔5 (Step:1197-1222) at ±0.25 (t≥30) / ±1/±0.5 (t≥5).

- default (Step:1227-1229): if `global.turntimer<=0` → `_end_the_thing`.

- `_end_the_thing` (Step:1232-1251): if currently burnt/surprised sprite → get knocked off
  the box (mode 1, `spr_pink_ball`, fly to start_x/start_y, `air_height=40`); else
  `instance_destroy()`.

**mode 6** (Step:1255-1301): knocked-around running; gravity vspeed+=1.5, hspeed eases to
dest_x, clamped ±56 from dest_x; sprite run/surprised; turn-end → ball exit (as above).

**mode 7** (Step:1303-1412): curtains sing loop (`spr_pink_sing`/`_idle`/`_turn`), wanders
horizontally within box ±80, turns to face movement. Not a bomb mode.

**Self-burn check** (Step:1415-1454, runs every step if any explosion exists): scans a 4×6
grid of 16px cells around Pink; if a `friendlyfire` explosion with `image_xscale>=4` overlaps
a cell, set `list_burnt[gy*4+gx]=1`; while throwing (`image_index>=3`) `y-=24`; stop laugh/
trip sounds, switch to `spr_pink_front_surprised`, `phase=99`.

**Audience-heart grab** (Step:1456-1498): `collision_circle(x,y,40,obj_audienceheart)` →
`snd_coin`, flash, spawns `obj_dokiheart` flying up-toward-Pink (`speed=13.4, friction=1,
tension_value=1, mode=1`).

**Box push-down** (Step:1517-1559): while `on_the_box`, `box_pushdown_real` eases to
`box_pushdown_dest` (56 when landed); the delta is applied to Pink's y, dest_y, the growtangle
box, purplecontrols, obj_heart, all bullets, and all dokihearts — i.e. Pink standing on the
box visibly depresses the whole play-field 56px.

### Draw (`gml_Object_obj_pink_battlemovement_Draw_0.gml`)
- Arc position (Draw:3-12): if `air_time>0`,
  `_xx = lerp(dest_x, x, air_time)`, `_yy = lerp(dest_y, y, air_time) + lengthdir_y(air_height,
  (1-air_time)*180)` — a half-sine hop. Else `_xx,_yy = x,y`.
- `spr_pink_idle` offset: `_xx -= 24*image_xscale`, `_yy -= 19*image_yscale` (Draw:16-19).
- Draw body `draw_sprite_ext(sprite_index, -1, _xx+shake_x, _yy+shake_y, image_xscale,
  image_yscale, image_angle, image_blend, image_alpha)` (Draw:24 / 28).
- If `spr_pink_front_surprised` (Draw:27-46): also overlay the burnt cells — for each of the
  4×6 grid cells with `list_burnt==1`, `draw_sprite_part_ext(spr_pink_front_burnt, 0,
  2+gx*8, -2+gy*8, 16,16, x+(-2+gx)*16, y+4+(-3+gy)*16, ...)`.
- Flash overlay (Draw:48-53): if `flash_amount>0`, redraw body with `gpu_set_fog(true, c_lime,
  0,0)` at alpha=flash_amount (green hit flash).
- Held-bomb preview (Draw:55-68): while `spr_pink_throw_bomb` and `ammo_b==1` and phase<3 and
  image_index in [4,6): draw `spr_fusebomb_big` frame 0 at `(x-4 + rand±4, y-88 + rand±4 -
  24*_scale)` with `_scale = clamp((image_index-4)*1.125,0,1)*2` (bomb grows in her hands
  before the big throw), color c_white.

---

## obj_fusebomb — small doki bomb (`gml_Object_obj_fusebomb_*`)

### Create
`event_inherited()` (regularbullet). `target=4; damage=100` (= `obj_pink_enemy.damage`);
`grazepoints=2; active=0; destroyonhit=0; made=0; mode=0; has_heart=false; fuse_time=60;
air_time=1; air_height=120; frames_since_airtime=0; grid_x=0; grid_y=0; dest_x/y=x/y;
bounce_dir=-1; grow=1; fuse_frame=0; pulse_time=0; inside_the_grid=true; heart_direction=270`.
Then it is teleported off-screen to spawn from the air: `x = camview_x+480, y = camview_y+160`
(the thrower overrides x/y and dest afterward). Mask = `spr_fusebomb_shadow` (Other_15).

### Step (`gml_Object_obj_fusebomb_Step_0.gml`)
1. **Landing de-overlap** (Step:5-180, only once while `made==0`): if the destination cell
   holds a dokiheart or another `has_heart` fusebomb, slide the target cell to an adjacent free
   lane (tries axis `choose(0,1)` first, then opposite), recompute dest_x/dest_y. Sets
   `made=1`.
2. **Air descent** (Step:182-263): while `air_time>0`, `air_time -= 5.12/air_height`. On land
   (mode default): clear mask, snap to dest; if another fusebomb occupies the same cell →
   `_bounced`; grid-out-of-range (`<0`/`>3`) wraps +5 lanes and marks `_bounced`; play
   `snd_bump` (pitch 1.02 if bounced). mode 2 landing: `snd_bump`, `fuse_time=10`, snap.
   `frames_since_airtime==5` (Step:265-269): `snd_bump` (pitch 0.98), `active=1`.
3. **Fuse-length pulse** (Step:271-337): `fuse_frame` loops 0..3 (spark frame). By fuse_time
   the bomb visibly swells right before blast:
   `fuse_time 8→ yscale2.25/x=y*0.9; 7→3/×0.8; 6→3.25/×0.9; 5→3.5/×1; 4→3.75/×1;
   3→3.9/×1.05; ≤2→4/×1.1`. Default (fuse_time>8): idle pulse — every 15 frames (or every 6
   once fuse_time≤36) pop to scale 2.75, then ease back to 2.
4. `fuse_time--` (Step:339).
5. **Heart / explosion interactions** (Step:341-371, only when landed): if the player
   `obj_heart` overlaps — mode 1: if settled (frames≥5) `fuse_time=min(fuse_time,1)` (touching
   a live bomb detonates it almost instantly); mode≠1: `snd_pombark`, bounce it, and if
   `frames_since_airtime>1` force bounce_dir = `obj_purplecontrols.grid_direction`. If a
   nearby explosion overlaps (frames≥10) and inside_the_grid → `fuse_time=min(fuse_time,3)`
   (chain reaction). While airborne, `fuse_time=max(fuse_time,1)`.
6. **Sprite frame** (Step:373-379): `_fuselength_scale = (mode==1)?2:1`;
   `image_index = clamp((fuse_time*_fuselength_scale)/20, 0, 4)` (spr_fusebomb's 5 frames map
   the shrinking fuse), `image_speed=0`.
7. **Bounce resolution** (Step:381-395): move one lane along bounce_dir (default 180), set
   `air_height=24, air_time=1, alarm[0]=1` (re-run mask reset), `snd_bump`.
8. **EXPLOSION** at `fuse_time<=0` (Step:397-469): `snd_explosion_mmx`, `scr_shakescreen()`
   (extra 13/13 shake if grow>1). Spawn central `obj_pinkbombexplosion` at (x,y) depth −10,
   scaled by `grow`. Then a 4-arm cross: for `_dir` = 0,90,180,270, step outward in +24px
   increments spawning `obj_pinkbombexplosion` with `sprite=spr_fusebomb_explosion_2,
   image_angle=_dir+270`, scaled by grow, until off the 640×480 view; kill settled dokihearts
   in the path. If `grow>1` → knock Pink burnt (`obj_pink_battlemovement.phase=99,
   spr_pink_front_burnt, y-=24`). If `has_heart` and blast is inside the box → spawn a
   `obj_dokiheart` (`tension_value=3, maxlifetime=150`). `instance_destroy()`.

### Alarm_0: `mask_index = spr_fusebomb_shadow` (re-arm mask after a bounce).

### Other_15 (Cleanup/Destroy handler `gml_Object_obj_fusebomb_Other_15.gml`): if `active==1`
deal `obj_pink_enemy.teamdamage=84` and `event_user(2)` (team-damage tick); else inherited.

### Draw (`gml_Object_obj_fusebomb_Draw_0.gml`)
- Fuse spark color (Draw:3-6): `_fusecolor = merge_color(c_red, c_white, clamp((fuse_time-15)/
  45,0,1))` for mode 0, or `clamp((fuse_time-2)/30,0,1)` otherwise (fuse whitens as it burns).
- Body tint `_color` (Draw:8-38): normally 8947848 = **RGB(136,136,136)** gray (mode 0) or
  16777215 = white (mode≠0). On the "flash" frames of the countdown it blinks:
  26367 = **RGB(255,102,0)** (orange, fuse_time<8) or 48127 = **RGB(255,187,0)** (amber). The
  blink schedule differs for grow≤1 vs grow>1 (Draw:10). If `has_heart`: recolor orange→136 =
  **RGB(136,0,0)**, amber→3351244 = **RGB(204,34,51)**, else→10053375 = **RGB(255,102,153)**
  (pink-tinted).
- Position + landing telegraph (Draw:42-104): while airborne, arc `_bx=lerp(dest_x,x,air_time)`,
  `_by=lerp(dest_y,x-arc) + lengthdir_y(air_height,(1-air_time)*180)`. If `inside_the_grid`,
  draw a **target reticle** at the destination: color alternates `#FFBB00` (RGB 255,187,0) /
  `#880000` (RGB 136,0,0) on `global.turntimer%5<2`; 3 stacked thin rings of radius
  `(1-air_time^4)*14` plus one filled ring of radius `((1-air_time)/2 + (1-air_time)^2/2)*16`.
  When landed, a small squash-bounce offsets `_by` up 4/5/5/4/0 over frames_since_airtime 1-5.
- Body: `draw_sprite_ext(sprite_index, -1, _bx, _by, image_xscale*grow, image_yscale*grow,
  image_angle, _color, image_alpha)` (Draw:106).
- Fuse spark (Draw:112-113): if `fuse_time>4`, draw `spr_fusebomb_burning` frame
  `floor(fuse_frame)` offset by `(-3 - fuse_time*_scale/9)*imgscale*grow` on both axes (spark
  rides the top of the fuse and lowers as it burns), color `_fusecolor`.

---

## obj_fusebomb_big — giant bomb + finale wave-spin (`gml_Object_obj_fusebomb_big_*`)

### Create
Same base as fusebomb plus: `image_xscale=image_yscale=2; warn_time=30; friendlyfire=false;
fuse_time=60; air_time=1; air_height=120`. Teleported to `camview+(480,160)` then overridden
by thrower. Mask = `spr_fusebomb_shadow`.

### Step (`gml_Object_obj_fusebomb_big_Step_0.gml`)
- **mode 1 tether** (Step:9-17): while landed, drags `obj_pink_battlemovement` to
  `(x-4, y-136)` — this is the finale bomb Pink orbits/rides above.
- Descent `air_time -= 4.48/air_height` (Step:21). On land (Step:23-108): snap to dest,
  `snd_bump`, `scr_shakescreen()`. Nearby dokihearts within ±48 get shoved to the nearest
  45°-snapped lane direction (axis-aligned dirs get speed 4.1/friction 0.2; diagonals 6/0.3),
  cancelled if the slide would leave the box.
- `frames_since_airtime==10` (mode≠1): `snd_bump` 0.98 + `scr_shakescreen(2)`.
- `fuse_frame` loops 0..3.
- **Swell**: `image_xscale = 2 + 0.5/max(1, fuse_time/3)`; `image_yscale=xscale`
  (Step:126-127) — grows sharply in the final ~1.5s. `fuse_time--`.
- Chain-detonation: if landed ≥15 frames and overlapping an explosion, inside grid →
  `fuse_time=min(fuse_time,3)`. Airborne → `fuse_time=max(fuse_time,1)`.
- Bounce block (Step:143-157) identical shape to small bomb (`air_height=24, air_time=1,
  alarm[0]=1`).
- **EXPLOSION** `fuse_time<=0` (Step:159-356): `_scaling=8`. Two `snd_explosion_mmx` (pitch
  0.975 & 0.9 at 1/3 vol), `scr_shakescreen(13)`. Central `obj_pinkbombexplosion` scaled ×8,
  `friendlyfire` propagated. 4-arm cross like the small bomb but stepping **+48px**
  (`spr_fusebomb_explosion_2`, angle `_dir+270`, ×8 scale). Kills settled dokihearts in path.
  **Finale doki wave** (Step:205-353, only if box exists and `has_heart`): builds a randomized
  list and, for each of the 4 directions, walks lanes across the box laying `obj_dokiheart`s
  (`tension_value=3, maxlifetime=150, pulse=i`) that are given crossing velocities
  (`speed ~2.9, friction 0.1`) — the reward heart-stream that sweeps the box after the finale
  blast. `instance_destroy()`.

### Alarm_0 / Other_15: identical role to small bomb (mask reset; `active==1` no-op body).

### Draw (`gml_Object_obj_fusebomb_big_Draw_0.gml`)
- **WARNING TELEGRAPH** (Draw:1-25, when `fuse_time < warn_time`):
  - Color `c_yellow` during `fuse_time∈[warn_time-7, warn_time-5)`, else `c_red`.
  - `alpha = 0.3 + (1 - fuse_time/warn_time)*0.125` (intensifies as fuse burns).
  - Early (`fuse_time >= warn_time-5`, Draw:10-16): two growing filled ellipses — horizontal
    `x±_warn` by `y±_thick` and vertical `x±_thick` by `y±_warn`, where
    `_warn = (warn_time - fuse_time)*128`, `_thick = 56 - (fuse_time%2)*4` (a pulsing + shape
    that expands each frame — telegraphs the cross blast).
  - Late (`fuse_time < warn_time-5`, Draw:18-21): two full-view bars (`_thick=54-(fuse_time%2)
    *4`): a horizontal band across the whole 640-wide view at `y±_thick`, and a vertical band
    down the whole 480-tall view at `x±_thick` — the solid cross the blast will fill.
- Body tint `_color` (Draw:27-44): flashes 8930559 = **RGB(255,68,136)** (hot pink) on a
  schedule keyed off `_flash_time=5`, else 16777215 white. has_heart → 10053375 =
  **RGB(255,102,153)**.
- Arc/reticle (Draw:46-118): airborne arc same as small bomb; reticle radius uses **48**
  (5 thin rings + 1 filled) instead of 14/16; landing squash offsets `_by` up to −7 over
  frames 1-9 (mode≠1).
- Fuse spark (Draw:120-121): `spr_fusebomb_burning` frame `floor(fuse_frame)` drawn at
  `(_bx-37, _by-49)` plus the same `-3 - fuse_time*0.5/9` climb, scaled by `image_xscale*grow`,
  `_fuselength_scale=0.5`.
- Body drawn after spark (Draw:122). If `active==1` and purplecontrols squished, draws the
  heart outline (`spr_heartoutline`) at an offset — box-squish visual (Draw:124-143).

---

## obj_pinkbombexplosion — blast visual + hitbox (`gml_Object_obj_pinkbombexplosion_*`)

Default sprite `spr_fusebomb_explosion_1` (16f, 24×24, origin 12,12).

### Create
`event_inherited()`; `active=0; grazepoints=2; target=4; damage=100 (=pink damage);
destroyonhit=0; friendlyfire=false; image_index = image_number/2` (=8, starts mid-anim so it
appears already blooming). `has_drawn=0`. Alarms: `alarm[0] = 1 + irandom(image_number/2 - 1)`
(random smoke spawn), `alarm[2]=1` (→active=1 next frame), `alarm[1]=6` (→active=0 after 6).

### Alarm_0 (`..._Alarm_0.gml`): if `image_xscale>1`, spawn a smoke puff
`obj_pinkmeteorfire` (spr_bhero_flame) within ±24px, then shrink self `image_xscale *= 0.5 +
random(0.25)` (yscale follows); smoke flies out at `image_angle+90`, speed 2-6.
### Alarm_1: `active = 0` (hitbox off). ### Alarm_2: `active = 1` (hitbox on) — so the blast
damages only during frames 1..6.

### Step_1 (End-Step): `event_inherited(); has_drawn=0` (reset per-frame draw latch).
### Other_7 (Animation End): `instance_destroy()` — dies when the 16-frame sprite finishes.

### Other_15 (`..._Other_15.gml`): hitbox tick — if `active==1`,
`obj_pink_enemy.teamdamage = 84` (or **120** if `image_xscale>6`, i.e. the ×8 giant blast),
then `event_user(2)`.

### Draw (`..._Draw_0.gml`): batched draw — while `has_drawn==0`, loops ALL
`obj_pinkbombexplosion`: first draws each at `floor(image_index) - image_number/2` (the
trailing after-image, 8 frames back), then at `floor(image_index)` and latches `has_drawn=1`.
Effect: each explosion renders a current frame plus a fading 8-frame-old ghost of itself.

---

## obj_plat_pinatabell_pink — the piñata bell (platforming) (`gml_Object_obj_plat_pinatabell_pink_*`)

Parent `obj_verlet_rope` (a hanging rope-swung bell, `spr_bell_small_pink` 19×19). This is the
overworld/platform-phase target Susie slashes, NOT a bullet.

### PreCreate: `coincount=10; flag=-1; flagbit=0; nodecount=5`.
### Create: `was_hit=false; scr_depth(); hit_cooldown=0; image_speed=0.1`.
- `ringbell()` = `scr_plat_susie_attack_fast(self,true)`.
- `explode()` (Create:17-65): burst 20 `spr_tinysparkle_x` markers in a ring (speed 6,
  friction 0.05, gravity 0.3-0.6, fade over 60) + 6 `spr_bell_shard` fancy markers (speed
  7-12, gravity 0.8-1, spin +16°/step, doom 180); `snd_glassbreak`;
  `scr_plat_makecoins(x,y,coincount,...)`; `broken=true`.
- If `flag>0` and its bitmask already set → destroy on spawn (already-broken bell).

### Step (`..._Step_0.gml`): rope physics via `event_inherited()`; afterimage while swinging
fast; `image_angle = 90 + point_direction(...)` from the last two rope nodes. While
`was_hit>0`: escalate (`was_hit+=2`, `force_angle+=15`, `nodelength+=0.05`, spawn
`spr_bellsparkle`, fade out, add swing force) — the bell rings and swings after being hit.

### Collision with `obj_plat_slash_hbx` (`..._Collision_...gml`): Susie's slash.
- Guard: exit if `broken`, `was_hit>0`, or `hit_cooldown>0`. Set `hit_cooldown` (4-frame delay
  via `scr_delay_var`).
- Two `snd_playablebell` (pitch-bent 1.2→1.5 up and 0.2→1.5), a white ripple, coin spray.
- `was_hit<3`: `was_hit+=1`, `image_blend = merge_color(c_white, c_red, was_hit/3)` (reddens
  with each hit). At `was_hit==3` → `explode()`.
- Adds swing force toward player, sets flag bit if `flag>0`.

### Draw: `event_inherited(); if(!broken) draw_self()`.

---

## obj_dokiheart — heal collectible dropped by heart bombs (`gml_Object_obj_dokiheart_*`)

Parent `obj_bullet_healing`, sprite `spr_dokiheart` (24×24, origin 12,10).

### Create: `event_inherited(); maxlifetime=90; image_xscale=image_yscale=1; mode=0; mother=-4;
act_to_change=-4; xdraw=x; ydraw=y; visual_scale=1; pulse=0; tension_value=1; heart_angle=0`.
Thrower/big-bomb overrides set `mode=1`, `tension_value=3`, `maxlifetime=150`, velocities.

### Step (`..._Step_0.gml`):
- mode 1 (Step:1-56): sliding heart — friction management (settles to speed 0.8 then gravity
  0.06 downward), soft-body separation from other dokihearts (push apart within 22px), and
  **magnet to the player heart** within 42px (`_dist = 1 + ((42-dist)/42)*11` pull).
- **Pickup** (Step:58-130): if it overlaps `obj_heart`'s inner box: `snd_power`,
  `scr_healall(1)`, damages `act_to_change` if any, boosts `obj_tensionbar`
  (`maxtensionlimit += tension_value*2.5`, cap 250), `scr_tensionheal(tension_value*2.5)`,
  `snd_swallow`, spawn a `spr_finisher_explosion` burst tinted `obj_pink_enemy.c_pink`,
  trigger `obj_pink_tension_glow`, destroy.
- Lifetime (Step:132-149): `lifetime++`; dies if no player heart; after `maxlifetime` fades
  `image_alpha -= 0.1`; else fades in `+0.1`. `pulse` loops 0..14.

### Step_2 (End-Step): `xdraw/ydraw` chase `x/y` (trail smoothing); if `mother` exists, snap to
mother's pos.

### Draw (`..._Draw_0.gml`): `_scale` pulses 1.5→1.05 over `pulse` 0-5, ×`visual_scale`.
mode 1: draw `spr_dokiheart` at `xdraw,ydraw`, angle `image_angle + lengthdir_x(15, lifetime*
15)` (wobble), tint **#FF88AA = RGB(255,136,170)**, with a black outline (×0.5 alpha) if a
`obj_huge_anime_face` exists. default mode: same but bobs `ydraw + lengthdir_y(2, lifetime*
10)`.

---

## PORT CHEAT-SHEET (numbers you must hit)

- Lane pitch 40px; 4×4 grid centered on box; cell = box_c −60/−20/+20/+60.
- Small bomb fuse (thrown, code 0): `fuse = 55 + ammo*2 - pattern_repeat*2`; air_height 110.
- Interlude small bombs: mode-2/3/4 front throws, `fuse=40`, air_height 110 (held big-bomb
  variant `fuse=60→45`, grows by ammo_b×0.3).
- Big bomb random (code 1): fuse 60, mode 0, friendlyfire.
- Big bomb targeted (code 2/4): `fuse = 52 + ammo*3`, warn_time 28; code 4 drops a heart.
- Finale center bomb (code 3): fuse 120, mode 1, friendlyfire, spawned at box center, Pink
  pinned to `(x-4, y-136)`; `wave_speed = choose(3.85, 4.725, 5.15, 5.95)`.
- Finale spin: `wave_angle += 1 + (min(pattime,20)/10)*wave_speed*endspeed`;
  Pink orbit `dx = box_cx+198 + lengthdir_x(6,(wave_angle*8)%360)`,
  `dy = box_cy+34 + lengthdir_y(96, wave_angle) + pattime`, lerp ratio `clamp(pattime/30)*0.5`.
- Small bomb descent `air_time -= 5.12/air_height`; big bomb `-= 4.48/air_height`; draw arc
  `lerp(dest,x,air_time) + lengthdir_y(air_height,(1-air_time)*180)`.
- Small bomb final-swell yscale by fuse_time: 8→2.25,7→3,6→3.25,5→3.5,4→3.75,3→3.9,≤2→4.
- Big bomb swell `xscale = 2 + 0.5/max(1,fuse_time/3)`.
- Explosion scale: small ×grow, big ×8; cross-arm step 24px (small) / 48px (big); explosion
  hitbox active only frames 1-6; teamdamage 84 (120 when xscale>6).
- Box push-down: 56px when Pink lands on the box, eased, applied to entire play-field.
