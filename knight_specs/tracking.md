# Knight — "Tracking Swords" (obj_dbulletcontroller type 151)

EXACT port spec from decompiled DELTARUNE Ch3 GML. All `file:line` refer to
`C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 3 - GML\`.

Angle convention: GML degrees, y-up. `lengthdir_x(l,d) = l*cos(d)`,
`lengthdir_y(l,d) = -l*sin(d)` (already screen-space, y-down). So an offset in
screen coords is `dx = l*cos(d)`, `dy = -l*sin(d)`.

Coordinate scale: these objects use **native `image_xscale = 1`** (no
`scr_darksize` call anywhere in this attack). DELTARUNE dark-world battle room is
rendered at 2x, so to match a HALVED port coordinate space multiply every pixel
distance/size below by 0.5 (len 120→60, +10 offsets→+5, slash length 900→450,
box half-extent 200→100, sword sprite scale 1→0.5). Numbers below are the RAW GML
values.

---

## SPAWN / CONTROLLER (type 151)

`gml_Object_obj_dbulletcontroller_Step_0.gml:2909-2919`
```
if (type == 151) once:
  _manager = instance_create(obj_growtangle.x, cameray(), obj_tracking_swords_manager);
  scr_bullet_inherit(_manager);
  _manager.variant = difficulty;   // 0..3
  _manager.damage  = damage;       // 206 passed in
  with(_manager) event_user(0);
```
`cameray()` = `camera_get_view_y(view_camera[0])` (top of view). Manager x,y is
only its own anchor; swords immediately reposition to the heart.

---

## MANAGER — obj_tracking_swords_manager

### Create (`..._Create_0.gml`)
`timer=0; con=0; variant=0; firstsword=false;` multisword vars 0; `setcount=0`;
`setdirection[0..49] = -1`; `swordcount=0`; `directionprev[0..7] = -1`;
`scr_bullet_init()`; then `event_user(0)` (line 23).

### event_user(0) — variant table (`..._Other_10.gml`)
Per-variant spawn tuning (`rate` = frames between swords, decays by `ratedecay`
each spawn down to `rateminimum`):

| variant | rate | ratedecay | rateminimum | maxswords | multiswordmax | multiswordframes | setdirection seq |
|--------:|-----:|----------:|------------:|----------:|--------------:|-----------------:|------------------|
| 0 | 32 | 4 | 16 | 99 | 0 | 0 | (random 8-dir) |
| 1 | 24 | 0 | 24 | 99 | 0 | 0 | (random 8-dir) — *lines 10-16 first set 50/10/6/5 then are OVERWRITTEN by 17-21* |
| 2 | 24 | 0 | 24 | 99 | 2 | 4 | 0,45,90,135,180,225,270,315,0,45 (idx1..10) |
| 3 | 20 | 4 | 13 | 99 | 0 | 0 | (random 8-dir) |

Type overrides (NOT type 151, ignore for this port): type 104 → rate 55; type 154
→ rate 24/decay4/min16 (`:53-79`).
Last line `:81` `timer = rate - 5;` → first sword spawns 5 frames after start.

### Step (`..._Step_0.gml`)
- `:1-2` `if (global.turntimer < 70) exit;` — whole attack only runs while the
  turn's `global.turntimer >= 70`. Attack length = turn length (external);
  swordcount>maxswords branches (`:37-42`) never fire since maxswords=99.
- `:5-6` `timer++`; spawn when `timer == rate` (`&& swordcount <= maxswords`) OR
  `timer == multiswordframes && multiswordcon == 1` (variant 2 burst).
- `:8` spawn `obj_tracking_sword1` at manager x,y.
- `:9` `inst.direction = choose(0,45,90,135,180,225,270,315)` — random 8-way.
- `:13-20` reroll: repeat 8×, if direction matches any of last-8 `directionprev`
  add 45° (avoid recently-used compass dirs).
- `:22` `inst.image_angle = direction + 180` (sword points back toward heart).
- `:23` record `directionprev[swordcount]=direction`; `:25-33` clear the next 3
  history slots (wrap at 7).
- `:35` `swordcount++`; `:43-44` if `swordcount>7 && <maxswords` reset to 0.
- `:46-49` `setcount++`; if `setdirection[setcount] != -1` override
  `inst.direction` (variant 2 forced sequence).
- `:51-61` multisword burst bookkeeping (variant 2: 2 swords per set,
  `multiswordframes=4` apart).
- `:63-69` **reposition sword to heart:**
  `x = obj_heart.x + 10 + lengthdir_x(len, direction)`,
  `y = obj_heart.y + 10 + lengthdir_y(len, direction)`, `ystart=y`,
  `image_angle = direction + 180`. (`len` starts 120 → sword sits 120px from
  heart-center+10 along its compass direction.)
- `:71-74` `rate -= ratedecay; if (rate < rateminimum) rate = rateminimum;`
- `:76` `timer = 0`.

### Draw (`..._Draw_0.gml`) — slash glow surface
Creates 150×150 surface `hell_surface`, clears alpha, `bm_add`, draws every
`obj_tracking_sword_slash` with offset `(x - gt_minx(), y - gt_miny())` at
`image_xscale/yscale/image_angle`, `c_white`, `image_alpha`, then blits surface at
`(gt_minx(), gt_miny())`. `gt_minx/miny` = growtangle box top-left
(`obj_growtangle.x - sprite_width/2`, `.y - sprite_height/2`). Slashes render as
ADDITIVE white glow clipped/offset to the battle box.

### CleanUp — `surface_free(hell_surface)`.

---

## TELEGRAPH SWORD — obj_tracking_sword1  (default sprite `spr_roaringknight_sword_ol`)
Sprite REFDATA: **75×31, origin (37,15), 1 frame**. Drawn `draw_self` at native
scale 1 (HALVE → 0.5). Also a bullet (obj_regularbullet child): damage=206,
destroyonhit=1 — the telegraph blade itself is solid if the heart runs into it.

### Create (`..._Create_0.gml`)
`timer=0; con=0; afterimagecon=0; targetx/y=0; variant=0; image_alpha=0;`
`scr_bullet_init(); element=5;` `fadetohalftime=5; waittime=10;`
`fadetofulltime=20; flashtime=4;` `len=120; lenstart=len;`

### Step (`..._Step_0.gml`) — lifecycle
While `con < 2` (`:1-5`) it **tracks the heart** (recomputes x,y each frame at
`len` distance/`direction`, y clamped to `cameray()+40 .. cameray()+320`).

- **con 0** (`:7-21`): fade alpha 0→0.5 over `fadetohalftime=5` frames
  (`lerp(0,0.5,timer/5)`). `timer==1` → `snd_play_x(snd_knight_jump_quick,1,1.3)`.
  When alpha==0.5 → con 1, timer 0.  (**5 frames**)
- **con 1** (`:23-43`): `timer++`; while `timer>=waittime(10)`:
  `alpha = lerp(0.8,1,(timer-10)/20)`, `len = lerp(len, lenstart+10,(timer-10)/20)`
  (120→130), `image_blend = merge_color(c_white,c_red, timer/30)` (whitens→reddens).
  When alpha==1 (timer==30) → con 2, timer 0; `scr_afterimage_grow()` with
  xrate=yrate=0.2, fade=0.3.  (**30 frames**, still homing on heart)
- **con 2** (`:45-54`): flash. Draw does an extra fog-white `draw_self` (`Draw
  :5-11`) = solid white blink. Lasts `flashtime+1 = 5` frames → con 3. Position
  now LOCKED (con≥2, no more heart tracking).  (**5 frames**)
- **con 3** (`:56-100`): FIRE.
  - `timer==1` (`:60-66`): `afterimagecon=1`;
    `targetx = x + lengthdir_x(900, direction+180)`,
    `targety = y + lengthdir_y(900, direction+180)` (900px line back THROUGH the
    heart's locked position and beyond); `snd_play_x(snd_knight_cut2,1,1.3)`.
  - `timer==2` (`:68-96`): spawn `obj_tracking_sword_slash` (the hit line) +
    `obj_tracking_sword_slash_extra_graze` at sword x,y with same
    image_angle/direction, damage=206. **variant 1 only** (`:82-95`): walk 27
    steps along the slash line (`b=27`), `c=lerp(1,5,i/b)`; for each step whose
    lerp point lies inside growtangle ±200, spawn `obj_tracking_sword2` diamond at
    `lerp(x,targetx,(i/b)*c), lerp(y,targety,(i/b)*c)` with damage=206.
  - `timer==5` → `instance_destroy()`.

Approx total sword life: 5 + 30 + 5 + 5 ≈ **45 frames** spawn→destroy; fires at
con3 timer==2 (~frame 42). **Tracks heart ~35 frames, then locks, flashes 5, fires.**

### Draw (`..._Draw_0.gml`)
- `afterimagecon==0`: `draw_self()`; if con==2 extra fog-white `draw_self` (flash).
- `afterimagecon==1/2` (fire moment): draw faint self (alpha 0.0025) + a 40-step
  trail `draw_sprite_ext` lerped x→targetx alpha `0.2+i/80` (then ×0.5 second
  frame) — the visible slash streak of the sword sprite along the 900px line.

The tracking swords do NOT turn/steer with a turn-rate. They are **anchored at a
fixed compass direction & distance from the heart and re-snap to the heart every
frame** (perfect lock) during telegraph, then freeze and slash a straight 900px
line through where the heart was at lock time.

---

## SLASH HITBOX — obj_tracking_sword_slash  (sprite `spr_pxwhite2`)
Sprite REFDATA: **1×2, origin (0,1)**. obj_regularbullet child.
Create: `image_xscale=900, image_yscale=1` → a **900px long, ~2px thin line**;
`active=1; destroyonhit=0; damage=206; grazepoints=4` (→ **2** if
`obj_tracking_swords_manager.variant==1`, or if a sword_vortex_manager exists);
`timepoints=11`. Step: `exit`. Draw: `timer++; timer==3 → instance_destroy()` →
**hitbox lives 3 frames.** Rendered as additive white glow via the manager Draw
surface (not its own draw). This is the primary damage line.

## GRAZE COLLECTOR — obj_tracking_sword_slash_extra_graze  (sprite `spr_pxwhite2`)
Create: `image_xscale=900, image_yscale=7, image_blend=c_red, visible=false`;
graze factors from armor (`scr_armorcheck_equipped_party(15/24/14)`). Step: when
`global.inv < 0` and heart overlaps → `scr_tensionheal`: **4×tp** (variant 1 or
vortex) else **7×tp**; reduces `global.turntimer` by `(1/30)*grazetimefactor` if
turntimer≥10; then destroys. Draw: `draw_self(); timer==3 → destroy`. Invisible
900×7 graze band, 3 frames.

## VARIANT-1 DIAMONDS — obj_tracking_sword2  (default `spr_knight_triangle_bullet`)
Sprite REFDATA: **16×16, origin (7,8), 2 frames**. obj_regularbullet child.
Create: `scr_bullet_init(); damage=1(overridden→206); destroyonhit=0;`
`grazepoints=1; active=0; image_speed=0; image_index=1` (2nd frame);
`image_angle=irandom(360); direction=image_angle; gravity_direction=image_angle;`
`image_xscale=image_yscale=1; image_alpha=0.5;`
**`sprite_index = spr_ball_small_pixel_hitbox`** (overrides default → renders/
collides as the 16×16 origin(8,8) pixel-hitbox ball).
Step: `timer++`; `timer==30` → `gravity=0.01; active=1; image_alpha=1` (arms after
30 frames, drifts slowly in its random direction). If outside growtangle ±200 →
fade `image_alpha -= 0.1`, destroy when <0.1.

---

## SFX
| sound | trigger | file:line |
|-------|---------|-----------|
| `snd_knight_jump_quick` (pitch 1.3) | each sword, con0 timer==1 (spawn/appear) | sword1 Step :12 |
| `snd_knight_cut2` (pitch 1.3) | each sword, con3 timer==1 (slash fire) | sword1 Step :65 |

Both `snd_play_x(snd, 1, 1.3)` = volume 1, pitch 1.3.

## ASSETS
Sprites: `spr_roaringknight_sword_ol` (75×31, o 37,15, 1f) — telegraph blade;
`spr_pxwhite2` (1×2, o 0,1) — slash line + graze band;
`spr_knight_triangle_bullet` (16×16, o 7,8, 2f) — v1 diamond default (unused after
override); `spr_ball_small_pixel_hitbox` (16×16, o 8,8, 1f) — v1 diamond actual.
Sounds: `snd_knight_jump_quick`, `snd_knight_cut2`.

## DAMAGE / SCALE NOTES
Raw GML `damage = 206` flows to sword1 (solid blade), slash line, and v1 diamonds.
This is DELTARUNE's raw damage number — apply your engine's own damage scaling
(DELTARUNE hearts have ~hundreds of HP). Collision shapes: slash = 900px×2px line
(HALVE→450×1); telegraph blade = 75×31 sword sprite; diamond = 16×16 pixel ball.
