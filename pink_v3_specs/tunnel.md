# Pink (Mad Mew Mew) — 3-D TUNNEL subsystem (type 208 / obj_purplecontrols `mode == 7`)

EXACT port spec extracted from decompiled GML. All angles are GameMaker y-DOWN convention:
`lengthdir_x(d,a)=d*cos(a)`, `lengthdir_y(d,a)=-d*sin(a)`; dir 0=right, 90=up, 180=left, 270=down.
Colors below are given as BGR-int → RGB. `#RRGGBB` literals in GML are already RGB.

Objects covered:
- `obj_purplecontrols` (the controller; mode 7 = tunnel). Sprite `spr_purpleheart`.
- `obj_pinkzap` — tunnel zap bullets (sprite `spr_pinkzap`, 6 frames, 17x17, origin 8,8).
- `obj_pink3durgenter` — the "urgent enter" / timeout warning ring entity.
- `obj_pinktimeoutzap` — timeout zap ring + burst.
- `obj_pinkarrow` — **does not exist** in this chapter's export (Glob found no files). The spin-arrow tutorial hint used elsewhere is `spr_pinkspinarrow` drawn inline in mode 3, not mode 7. No arrow object in the tunnel.

`obj_growtangle` is the battle box (sprite `spr_battlebg_0`). Its center/edges are read via
`scr_get_box(n)` (`gml_GlobalScript_scr_get_box.gml`):
`0`=box centerX (`gt.x + sprite_width*0.5`), `1`=box top, `2`=box left, `3`=box bottom,
`4`=`gt.x` (center x), `5`=`gt.y` (center y). In the tunnel `scr_get_box(4)/(5)` = tunnel center.

Helper scripts:
- `scr_approach(v,target,step)` — moves v toward target by step, clamped at target (`gml_GlobalScript_scr_approach.gml`).
- `scr_wrap(v,lo,hi)` — wraps v into [lo,hi] (`gml_GlobalScript_scr_wrap.gml`). Used as `scr_wrap(angle,0,360)`.

---

## 1. STATE / VARIABLES (Create_0 + set-up)

`gml_Object_obj_purplecontrols_Create_0.gml`:
- L2 `mode = 1` (default; the spawner sets `mode=7` and `difficulty` for the tunnel).
- L3 `difficulty = 0`.
- L19-24 `lane_x=1, lane_y=1, x_ongrid=0, y_ongrid=0, grid_direction=0`.
- L26-28 `lane_scroll=0, tunnel_lifetime=0, tunnel_timer=0`.
- L29-35 `tunnel_radius[0..7]` all `= 0` (8-element ring array; the depth layers).
- L37-40 `tunnel_lane_layer=0` (which ring the soul is currently on),
  `tunnel_lane_direction=270`, `tunnel_speed_base=0`, `tunnel_speed=0`.
- L41-42 `array_stars_x[5]=0, array_stars_y[5]=0` (6-element starfield arrays).
- L43-48 `pattern_phase=0, pattern_time=0, rotate_travel=0, rotate_speed=0, heart_angle=0, heart_travel=0`.
- L51 `iframes=0`. L54 `super=0`.
- L60 `bg_pulse=99`. L61 `x_shake=0`. L64 `tutorial_time=0`.
- L67-68 `can_spin=true, can_move=true`.
- L70-73 `surface_effect` / `surface_box` created 32x32 then freed (lazily re-created per-mode).
- L74-83 `growtangle_xscale/yscale` cache the box's original scale (restored on Destroy).
- L88-91 `disableslow=0`; if `button2_h()` at spawn → `disableslow=1`.

Life cycle:
- `made` starts 0; set to 1 at end of every Step (Step_0 L2770). Mode-7 first-frame init is gated on `made==0`.
- `life_time++` every Step (L2771). At `life_time>=30` if no `obj_heart` exists, box+heart made visible and controller self-destructs (L2773-2785).
- Step_1 (Begin Step): `iframes = max(0, iframes-1)` (`..._Step_1.gml` L1).
- Other_11 (event_user1): `exit;` (no-op).
- Destroy_0: if `mode != 2`, restore growtangle scale to cached original; make heart visible; destroy all `obj_pinknode`/`obj_pinknodeact`.
- CleanUp_0: free lists+surfaces; for mode 7 `ds_list_destroy(pattern_list)` if made.

---

## 2. MODE-7 STEP LOGIC — `gml_Object_obj_purplecontrols_Step_0.gml` L1211-2137

### 2.1 Box scale (the visible "zoom" of the tunnel), L1211-1237
```
_scale = 3.75 - min( tunnel_lifetime*0.0025,
                     (tunnel_lifetime+30)*0.002,
                     (tunnel_lifetime+135)*0.0015,
                     (tunnel_lifetime+390)*0.001 )
```
`_box_xscale = _box_yscale = _scale`. Applied to `obj_growtangle` (`image_xscale/yscale = _scale`)
only while `growtangle.sizer >= 1` (L1230-1237). So the battle box literally scales — the growtangle
box sprite is the tunnel frame and grows/shrinks with `_scale`.

First-frame init (L1216-1228, `made==0`):
- `surface_effect = surface_create(300,300)` if missing.
- `pattern_list = ds_list_create()`.
- `rotate_speed = 12`, `pattern_phase = -2`, `heart_angle = 270`.
- If `difficulty == 0`: `tutorial_time = 300`.

### 2.2 Spawn the urgent-enter ring, L1239-1240
If `!instance_exists(obj_pink3durgenter)` **and** `tunnel_lifetime >= 1`:
`instance_create_depth(x+1, y+1, -5, obj_pink3durgenter)`. One always-present since it destroys itself.

### 2.3 Constants used this frame, L1242-1249
- `_rotation_to_go = 270 - heart_angle`
- `_rotation_speed = 4 + abs(_rotation_to_go)/6`
- `_heart_move_limit = 35 * _box_xscale`  (max ring radius the soul can occupy)
- `_circle_grow_limit = 224`   (ring radius at which a ring recycles/dies)
- `_heart_zoomin_speed = 1`
- `_circle_interval = 188`   (tunnel_timer threshold to emit a new ring + attack wave)
- `_tunnel_grow_factor = 32000`
- `_tunnel_grow_addition = 0.0375`

### 2.4 Tunnel forward speed, L1251-1306

Base speed by difficulty (L1251-1254):
```
difficulty <= 0:  tunnel_speed_base = min( tunnel_lifetime/10,
                                           1.5 + tunnel_lifetime/50,
                                           11 )
difficulty  > 0:  tunnel_speed_base = min( 1.5 + tunnel_lifetime/15,
                                           6.5 + tunnel_lifetime/60,
                                           8.75 + tunnel_lifetime/180,
                                           11 )
```
`tunnel_speed = tunnel_speed_base` (L1256). If `_rotation_to_go != 0` (soul mid-rotate to bottom):
`tunnel_speed /= (1 + _rotation_speed/20)` (L1258-1259) — tunnel slows while the view is rotating.

`_heart_distance_to_center = point_distance(x_ongrid, y_ongrid, 0, 0)` (L1261).

Startup burst (L1263-1270): warps the tunnel fast at the very start.
```
difficulty<=0 & life_time<40:  tunnel_speed += (240 / max(1, life_time*0.9)) * (40-life_time) / 40
difficulty>0  & life_time<20:  tunnel_speed += (240 / max(1, life_time*0.9)) * (20-life_time) / 20
```
Else (normal play, L1271-1293) — a proximity slow-down / speed-up loop over 8 rings:
```
for i in 0..7:
  if _heart_distance_to_center < ( max(34, 59 - tunnel_speed_base*3) - (i*i)/2 ):
     if i==0:  tunnel_speed = max(tunnel_speed, 2)
     else:     tunnel_speed *= 4/3
     _heart_zoomin_speed *= 0.9375
  else: break
```
(When the soul is deep near center it speeds the tunnel; near the mouth it doesn't.)

Hard brake when the soul's ring gets too big (approaching the viewer), L1295-1306:
```
if tunnel_radius[tunnel_lane_layer] > _heart_move_limit + 2:  tunnel_speed = 1/3
if tunnel_radius[tunnel_lane_layer] > _heart_move_limit + 8:  tunnel_speed = 1/6
if tunnel_radius[tunnel_lane_layer] > _heart_move_limit + 15: tunnel_speed = 0
```

### 2.5 Ring growth — THE PSEUDO-3D DEPTH MODEL, L1308-1333

Each ring `i` has scalar radius `tunnel_radius[i]`. Rings grow outward (toward the camera) each frame:
```
if tunnel_speed > 0:
  for i in 0..7:
    _tunnel_radius_old[i] = tunnel_radius[i]
    if tunnel_radius[i] > 0:
      tunnel_radius[i] = tunnel_radius[i] * (1 + tunnel_radius[i] / (_tunnel_grow_factor / tunnel_speed))
                          + _tunnel_grow_addition * tunnel_speed
      if tunnel_radius[i] > _circle_grow_limit (224):   # ring passed the camera
        tunnel_radius[i] = 0
        if tunnel_lane_layer == i: tunnel_lane_layer--
```
This is the core perspective law: a ring's on-screen radius grows **proportionally to its own radius**
(exponential-ish: `r *= 1 + r/(32000/speed)`) plus a small linear term. Small (far/deep) rings barely
move; large (near) rings rush outward — exactly a vanishing-point tunnel. `_tunnel_grow_factor/tunnel_speed`
means faster tunnel speed = smaller divisor = faster growth.

### 2.6 New-ring emission + attack scheduling, L1335-1673

`tunnel_timer += tunnel_speed` (L1336). When `tunnel_timer >= _circle_interval (188)` (L1338):
- `tunnel_timer -= 188`.
- Shift ring array outward one slot (L1341-1349): `for i=7..1: tunnel_radius[i]=tunnel_radius[i-1]`,
  then `tunnel_radius[0] = _starting_radius (12)`. So a new innermost ring (radius 12) is born at the
  vanishing point each interval, and existing rings shove one index outward.
- If the shifted-off ring (`tunnel_radius[7]` before) was >0, `tunnel_lane_layer++` (clamped <8) so the soul
  stays on its ring (L1351-1357).
- Bump the layer index of all live tunnel entities so they ride outward with their ring, destroying any that
  fall off (`tunnel_lane_layer++`, destroy if `>=8` or their new ring radius `<=0`):
  `obj_pinkzap` (L1359-1367), `obj_pinktimeoutzap` (L1369-1377), `obj_dokiheart` (L1379-1387).
- `_dokidir = irandom(3)*90` (L1389). `pattern_phase++` (L1390).

Attack pattern generation (L1392-1654) fires only when `pattern_phase >= 1`:
- When `pattern_list` is empty, refill it (L1397-1554): a Markov-ish chain builds up to 3 `(variant, angle)`
  pairs. Variant codes `_atk` ∈ {0,1,2,3,4}; each picks the next variant via `choose(...)` and an `_angle`
  snapped to 45°/90° multiples. (`_atk==3` guards against 4-in-a-row of variant 3.) The exact `choose`
  tables are L1405-1540; angles are `scr_wrap(_angle,0,360)`.
- Pop one pair: `_variant = pattern_list[0]`, `_dir = pattern_list[1]`; delete both (L1556-1560).
  `pattern_phase -= 1` when popped, and again if list emptied (L1562-1563).
- `_dir_add = choose(-1,1) * 10` (the angular spacing between consecutive zaps in the fan), `_multiple = 1`.
- Per-variant fan parameters (L1569-1618):
  - variant 0: `_dir = 90*irandom(3)` if unset; `_repeats = 6`, `_moving = 0`.
  - variant 1: `_dir = 45*choose(1,3,5,7)`; `_repeats = 15`, `_moving = 0`.
  - variant 2: `_dir = 90*irandom(3)`; `_repeats = 29`, `_moving = 0`.
  - variant 3: `_dir = 45*irandom(7)`; `_repeats = 6 + irandom(2)`;
    `_moving = choose(-1,1) * choose(2.5,5)` (a MOVING/arrow zap). If next queued variant ∈ {4,2,1}, force `_repeats=6`.
  - default (variant 4): `_dir = 45*choose(1,3,5,7)`; `_repeats = 6`, `_moving = 0`, `_multiple = 2`.
- Center the fan and offset by view rotation (L1621):
  `_dir = scr_wrap( _dir - (_dir_add/2)*(_repeats-1) + tunnel_lane_direction, 0, 360 )`.
  `_multiple_angle = 360/_multiple`.
- Emit the zaps (L1625-1653), one per step of the fan:
```
repeat (_repeats * _multiple):
  _zap = instance_create_depth( scr_get_box(4)+1, scr_get_box(5)+1, -5, obj_pinkzap )   # spawn at tunnel center
  _zap.direction = _dir
  _zap.wave_dir  = direction * 8
  _zap.pattern_speed = _moving
  if (i % _repeats)==0 OR (i % _repeats)==(_repeats-1):   # first & last in fan are decorative
      _zap.mode = 0;  _zap.mask_index = mask_empty        # (non-colliding endcaps)
  if _moving != 0: _zap.sprite_index = spr_pinkzap_arrow
  _dir = scr_wrap(_dir + _dir_add, 0, 360)
  if _multiple>1 and (i%_repeats)==0:
      _dir = scr_wrap(_dir + _multiple_angle - _dir_add*_repeats, 0, 360)
```
- Optional doki-heart pickup (L1656-1666): if `tunnel_radius[5] > 0` and `_dokidir >= 0`, spawn `obj_dokiheart`
  at center with `direction = scr_wrap(_dokidir + tunnel_lane_direction, 0, 360)`, `tension_value=3`, `maxlifetime=600`.
- Sub-frame offset fix so the new ring is at the right radius mid-interval (L1668-1672):
  `tunnel_radius[0] = tunnel_radius[0]*(1 + (tunnel_radius[0]/32000)*tunnel_timer) + 0.0375*tunnel_timer`.

### 2.7 Soul (heart) input — MOVE BETWEEN RINGS / ROTATE VIEW, L1675-1745

`buffer_*` are the buffered directional inputs (mode 7 buffer length = 4, Step L37-39). Only act if
`heart_travel==0 && rotate_travel==0`:
- **Up** (L1675-1683): `heart_travel = -1` (move inward toward center / deeper), `tutorial_time=0`.
- **Down** (L1685-1692): `heart_travel = 1` (move outward toward the mouth/camera).
- **Left** (L1694-1701): `rotate_travel -= 90` (rotate the whole tunnel view CCW... see sign below).
- **Right** (L1703-1710): `rotate_travel += 90`.

Guards on outward travel (heart_travel>=1), L1712-1720:
`heart_travel=0` if `tunnel_lane_layer>=7`, or next ring `tunnel_radius[layer+1]<=0`, or next ring
`> _heart_move_limit` (too big to enter).
Inward travel (L1722-1728): if `tunnel_lane_layer>0` decrement layer, else cancel.
Second outward step (L1730-1743): if `layer<7` and `tunnel_radius[layer]` in `(0, _heart_move_limit]`
then `tunnel_lane_layer++`, else cancel; at layer 7 cancel.
`heart_travel = clamp(heart_travel, -1, 1)` (L1745).

### 2.8 Soul travel animation (interpolate ring→ring), L1747-1835
When `heart_travel != 0`:
- On the initiating frame (`==1` or `==-1`) play `snd_wing` and spawn `obj_pinkdust` at heart pos, angle
  `180 + heart_travel*90` (L1749-1760).
- Decay: inward `heart_travel = scr_approach(heart_travel, 0, 0.2 * _heart_zoomin_speed)`,
  outward `... 0.2` (L1767-1770).
- The heart's visual scale is interpolated between the two rings it is between (L1772-1784):
  ```
  _true_radius = tunnel_radius[tunnel_lane_layer]
  if heart_travel<0: _true_radius = tr[layer]*(1+ht) + tr[layer+1]*(-ht)
  if heart_travel>0: _true_radius = tr[layer-1]*ht + tr[layer]*(1-ht)
  obj_heart.image_xscale = image_yscale = _true_radius / 48
  ```
- Emit heart trail every other frame (L1786-1796). On arrival, `heartshake` kick per `heart_angle` (L1798-1825).
- If not travelling, heart scale locks to `tunnel_radius[tunnel_lane_layer]/48` (L1829-1834).

### 2.9 View rotation, L1837-1913
When `rotate_travel != 0`:
- On the initiating frame play `snd_wing` + spawn dust angled `90 - rotate_travel` (L1839-1851).
- `heart_angle = scr_approach(heart_angle, heart_angle + rotate_travel, rotate_speed)`,
  `rotate_travel = scr_approach(rotate_travel, 0, rotate_speed)` (L1854-1855).
- Emit trail; on completion heartshake kick by final `heart_angle` (L1866-1893).

Auto-align the soul to the bottom (270°) — the tunnel constantly re-centers the view so the soul sits at
the bottom of the ring (L1896-1913):
```
_rotation_to_go = 270 - heart_angle
_rotation_speed = 4 + abs(_rotation_to_go)/6
_rotated_amount = clamp(_rotation_to_go, -_rotation_speed, _rotation_speed)
heart_angle += _rotated_amount   (wrapped 0..360)
tunnel_lane_direction += _rotated_amount   (wrapped 0..360)
```
`_rotated_amount` is this frame's global view-rotation delta applied to every tunnel entity below.

### 2.10 Soul world position on its ring, L1915-1935
```
if heart_travel!=0 and (layer - sign(heart_travel)) in [0,8):
   R = tunnel_radius[layer]*(1-abs(ht)) + tunnel_radius[layer - sign(ht)]*abs(ht)
else:
   R = tunnel_radius[layer]
x_ongrid = lengthdir_x(R, heart_angle)
y_ongrid = lengthdir_y(R, heart_angle)
```
Then clamp `x_ongrid/y_ongrid` inside the growtangle bbox (L1931-1935). The heart's final screen position
is set at the shared tail of Step (L2730-2734): `heart.x = ctrl.x + x_ongrid - 9*heart.image_xscale`,
`heart.y = ctrl.y + y_ongrid - 9*heart.image_yscale`.

### 2.11 Per-entity ride-out transforms (applied every frame), L1937-2094
For each `obj_pinkzap` with `tunnel_lane_layer < 7` (L1937-1986):
- Collision/highlight vs the soul's ring:
  - `active=1, mask_index=-1` if `mode==1 && tunnel_lane_layer==ctrl.tunnel_lane_layer`; else `active=0, mask_index=mask_empty`.
  - `highlight = 2` if on soul's ring, `1` if one ring behind (`ctrl.layer-1`), else `0`.
- Scale: `image_xscale = image_yscale = ctrl.tunnel_radius[layer] / 64`.
- Spin the zap along its ring: `direction += pattern_speed + _rotated_amount` (wrapped).
- Position on ring (offset half its own size inward):
  `x = ctrl.x + 1 + lengthdir_x(tunnel_radius[layer] - image_xscale/2, direction - sign(pattern_speed)*90)`,
  `y = ctrl.y + 1 + lengthdir_y(...)`.
- `image_angle = direction+90` if `pattern_speed==0`, else `= direction`.
- If ring radius `> _heart_move_limit + 16` (ring passed the camera): `life_time = max(99999, life_time)`
  (triggers fade-out; see obj_pinkzap Step). Layer `>=7` → destroy.

For each `obj_pinktimeoutzap` (L1988-2003): scale `= tunnel_radius[layer]/64`;
`radius = tunnel_radius[layer] - image_xscale/2`; same `>+16` fade trigger; layer>=7 → destroy.

For each `obj_dokiheart` (L2005-2027): scale `= tunnel_radius[layer]/48`; `direction += _rotated_amount`;
positioned on ring like zaps; then `visual_scale=2` halves image scale; `>+16` → `lifetime=99999`.

For the single `obj_pink3durgenter` (L2029-2045): if growtangle exists,
`radius = 37 * growtangle.image_xscale`; it hovers on the mouth ring at the angle pointing from tunnel
center to the soul: `_damagedir = point_direction(center, heart+9,+9)`,
`x = center_x + lengthdir_x(radius, _damagedir)`, `y = center_y + lengthdir_y(radius, _damagedir)`;
`image_xscale = image_yscale = radius/64`.

`obj_pinkdust` and `obj_pinktrail` (L2047-2077) are pushed outward by the same perspective growth law
(`_dist = _dist*(1 + _dist/(32000/tunnel_speed)) + 0.0375*tunnel_speed`) and rotated by `_rotated_amount`,
their sprite scale multiplied by the growth ratio — so dust/trails visibly rush toward the viewer too.

### 2.12 Starfield, L2079-2111
6 stars in `array_stars_x/y[0..5]` (parallax specks in the backdrop). Each frame:
- Rotate by `_rotated_amount` around origin (L2083-2089).
- Scale radially outward: `array_stars_[i] *= 1.1 + (tunnel_speed_base-1.5)/24` (L2091-2092).
- Recycle: when `array_stars_x[5]==0 && tunnel_lifetime%5==0`, or star 5's distance `>200`, shift the array
  and spawn a new star 0 at random angle, distance `(128 + random(64)) * max(0.2, 1.15 - tunnel_speed_base/10)` (L2096-2111).

### 2.13 Ripple pulse + timers, L2113-2135
`bg_pulse++`; when soul is idle (`heart_travel==0 && rotate_travel==0`) and `bg_pulse>=25`, spawn
`obj_fx_purpleripple` at heart and reset (L2115-2125).
`tutorial_time` (L2127-2135): while `>0`, decrement and `global.turntimer++` (freezes the turn clock during
the difficulty-0 tutorial); once expired, `tunnel_lifetime++` each frame (this is what drives ramp-up in 2.1/2.4).

---

## 3. THE DRAW — pseudo-3D tunnel render, `gml_Object_obj_purplecontrols_Draw_0.gml` `case 7:` L205-363

### Palette (L1-14, shared)
| var | BGR int | RGB | note |
|---|---|---|---|
| `_prpl_light` | 11141290 | (170,0,170) | ring dots / bright |
| `_prpl_dark` | 5570645 | (85,0,85) | ring circles |
| `_prpl_darker` | 3866683 | (59,0,59) | radial spokes |
| `_prpl_darkest`| 3342387 | (51,0,51) | (unused in mode 7) |
| `_prpl_backdrop`| 2228258 | (34,0,34) | stars + far spokes |
| `#EE5577` | — | (238,85,119) | soul-ring highlight (pink) |
When `!can_move`, each purple is `merge_color(col, c_black, 0.5)` (darkened 50%), L8-14.

### Render target
- `_growtanglescale = obj_growtangle.image_xscale` (L206-209) — same `_scale` from Step.
- `surface_effect` (300x300), cleared transparent. Tunnel center on the surface: `_cx=_cy=150` (L234-237).
- `_heart_move_limit = 35 * _growtanglescale` (L214).
- `_layer_movelimit` (L216-224) = highest ring index still "in play" (radius `< _heart_move_limit` & `>0`,
  or `tunnel_lane_layer` past it). `_layer_last` (L226-232) = index of last live ring.

### 3a. Stars, L238-248
Color `_prpl_backdrop`. For each of the (up to) 6 stars: draw a triangle (a stretched speck) from
`(_cx,_cy)` outward. `_scale = 1 + (tunnel_speed_base-1.5)*0.3 + dist/200`. The triangle:
two base verts at `±90°` offset `1*_scale` from the star point, apex pulled back toward center by
`dist*_scale*(1/6)`. (Gives motion-streak stars.) `d_triangle(...)` = `draw_triangle`.

### 3b. Radial spokes (the 4 tunnel edge lines), L250-282
Color `_prpl_darker`. Find first live ring index `i` (L251-259). Then walk rings outward drawing 4 spokes
(the tunnel's square-corner edges) connecting ring `i` to ring `i+1`:
```
_dir = tunnel_lane_direction - 270          # so soul-bottom aligns downward
repeat 4:                                     # 4 spokes 90° apart
   d_line_width( _cx+lengthdir_x(tunnel_radius[i],_dir),   _cy+lengthdir_y(tunnel_radius[i],_dir),
                 _cx+lengthdir_x(tunnel_radius[i+1],_dir), _cy+lengthdir_y(tunnel_radius[i+1],_dir),
                 (1+i)*1.125 )                 # spoke thickness grows with depth index
   _dir += 90
i++   until i>_layer_movelimit or tunnel_radius[i+1]<=0 or i>=7
```
Then in `_prpl_backdrop`, extend the 4 spokes from the last ring out to radius 300 (the vanishing beyond the
box), same 90° step, thickness `(1+i)*1.125` (L275-282). `d_line_width` = `draw_line_width`.

### 3c. Concentric rings, L284-349
`for i in 0..7:` (draw color `_prpl_dark`, L288-291 — both branches set `_prpl_dark`):
If `tunnel_radius[i] > 0`, draw the ring as a stack of nested thin circles (fake thickness) centered `_cx,_cy`:
```
_thick = 0;  _thickscore = tunnel_radius[i]   (+160 if i==tunnel_lane_layer)
do:
   d_circle(_cx, _cy, tunnel_radius[i] + _thick, outline=1)   # d_circle = draw_circle
   _thick = (_thick>=0) ? (-_thick - 0.5) : (-_thick)         # alternate ±, widening
   _thickscore -= 20
until _thickscore <= 0
```
So the soul's own ring (`i==tunnel_lane_layer`) is drawn much thicker (+160 score → many passes).
Then for the soul ring, overdraw a **pink** highlight (`#EE5577` = RGB(238,85,119)) with `_thickscore =
tunnel_radius[i]*0.75` using the same nested-circle loop (L314-333) — this is how the "current lane" ring
glows pink. Then reset to `_prpl_dark`.

Ring corner dots (L336-345): if `i != 0` color switches to `_prpl_light`. Draw 4 filled dots at the ring's
4 corners: `_dir = tunnel_lane_direction - 270`, repeat 4 (`_dir += 90`):
`d_circle(_cx+lengthdir_x(tunnel_radius[i],_dir), _cy+lengthdir_y(...), 2 + (tunnel_radius[i]-12)/24, fill)`.
Dot size grows with ring radius (perspective).

### 3d. Blit surface → box, L351-355
```
_pixels = _growtanglescale * 71
draw_surface_part( surface_effect,
   srcX = max(0, 150 - _pixels/2) + 2,  srcY = max(0, 150 - _pixels/2) + 2,
   w = _pixels, h = _pixels,
   destX = (scr_get_box(4) - 148) + max(0, 150 - _pixels/2),
   destY = (scr_get_box(5) - 148) + max(0, 150 - _pixels/2) )
```
i.e. crop a `_pixels`-square region centered on the surface's (150,150) tunnel center and paste it so the
tunnel center lands on the box center. The 300px surface is drawn 1:1 (no scaling) — the *rings themselves*
carry all the perspective; the crop just frames the box.

### 3e. Overlays, L357-362 & shared tail
`obj_pinktrail` draw_self, `obj_pinkdust` draw. Then shared tail (L535-536): the heart is drawn with
`draw_sprite_ext(sprite_index, -1, x + x_shake + heartshake_x + heartbump_x, y + heartshake_y + heartbump_y,
image_xscale, image_yscale, image_angle, image_blend, image_alpha)`.

Zaps/urgent/timeout draw themselves via their own Draw events (they are separate instances layered by depth
`-5`, above the box surface). See sections 4-6.

---

## 4. obj_pinkzap — tunnel zap bullet

Refdata: sprite `spr_pinkzap` (17x17, origin 8,8, 6 frames). Parent `obj_regularbullet`.

### Create_0 (`..._pinkzap_Create_0.gml`)
- `event_inherited()`. `target=4`, `damage=100` (or `obj_pink_enemy.damage`), `element=6`, `grazepoints=2`.
- `active=0`, `destroyonhit=0`, `sprite_index=spr_pinkzap_thick`, `mode=1`, `highlight=0`.
- `image_speed=1, image_index=0`, `alarm[0]=2`, `life_time=0`, `image_alpha=0`, `tunnel_lane_layer=0`.
- `wave_dir=random(360)`, `direction=random(360)`.
- `pattern_speed = choose(-1,1)*(2 + random(4))`, `speed = abs(pattern_speed)`.
  (NOTE: these random defaults are overwritten by the spawner in Step 2.6 — `direction`, `wave_dir`,
  `pattern_speed` are all reassigned. So the meaningful `pattern_speed` is `_moving` from the fan: 0 for
  static zaps, `±{2.5,5}` for arrow zaps.)

### Alarm_0 (`..._pinkzap_Alarm_0.gml`) — frame animator/reset
`image_index=0`; if `(speed<0.5 && irandom(9)!=0) || (speed>=0.5 && irandom(4)!=0)` then `alarm[0]=2`
(re-arm). Randomized flicker of the 6-frame sprite. (Alarm_0 also invoked via Other_7 = Animation End, which
just does `event_perform(ev_alarm,0)`.)

### Step_0 (`..._pinkzap_Step_0.gml`)
- `event_inherited()`. `speed = max(0.1, abs(pattern_speed))`. `life_time++`.
- `wave_dir += sign(pattern_speed)*48` (wrapped 0..360) — drives the arrow-zap wiggle.
- Fade-in: while `life_time<30`, `image_alpha = clamp(image_alpha+0.2, 0, 1)`.
- If `image_alpha>1`: decay by 0.3 down toward 1.
- Else if `life_time>=99999` (marked dead by controller when its ring passes the camera):
  `image_alpha = min(image_alpha,1) - 0.075`; destroy when `<=0.001`.

(Movement/scale/position are driven entirely by the controller each frame — section 2.11.)

### Draw_0 (`..._pinkzap_Draw_0.gml`)
Highlight tint (L3-17): `highlight==2 → white 16777215 (255,255,255)`; `==1 → 14540253 (221,221,221)`;
else `12303291 (187,187,187)`.
If `sprite_index==spr_pinkzap_arrow` (moving zap), offset draw pos by the wiggle:
`_xx += lengthdir_x(image_xscale*lengthdir_y(3,wave_dir), image_angle+90)`, `_yy` similarly (L22-26).

`mode==1` (colliding zap, L28-45): draw main sprite `draw_sprite_ext(spr, -1, _xx,_yy, image_xscale,
image_yscale, image_angle, _color, image_alpha)`. Thickness `2.5` if highlight>=1 else `1.5`; if
`highlight>=2` also draw two half-alpha copies offset `±_thickness` perpendicular to `image_angle` (L40-44)
— a fat glowing bar on the soul's ring.

`mode==0` (decorative endcap, L46-66): if `highlight>=2` draw `spr_pinkzap_thick` else `_spr`;
thickness `2`/`1.25`; same twin-offset copies at `0.45*alpha` when `highlight>=2`.

---

## 5. obj_pink3durgenter — urgent-enter / mouth warning ring

Refdata: sprite `spr_pinkzap` (6 frames). Parent `obj_regularbullet`. Spawned once (2.2) at box center,
depth -5. Represents the electrified ring at the tunnel mouth that damages if you dwell too long / warns of
the incoming end.

### Create_0
- `event_inherited()`. `grazepoints=2, target=4, damage=100` (or enemy dmg), `element=6`.
- `active=0, destroyonhit=0, life_time=0, tunnel_lane_layer=0`.
- `radius=128`, `dir_add=12` → `ceil(360/12)=30` segments. `array_frame[0..29] = irandom(1)` (per-segment
  animation frame seed). `pattern_time=1`, `backwards_momentum=0`.

### Step_0
- `life_time++`. At `life_time==20` play `snd_electroshock`. At `life_time==30` `active=1` (becomes lethal).
- `pattern_time -= 1/15` while `>0`.
- Animate each of the 30 segment frames: `array_frame[i]++`; if in `[2,3)` and `irandom(59)!=0` subtract 2
  (mostly holds frames 0/1, occasionally flashes into 2+); wrap by `image_number` (=6). (Loop L13-30.)

(`radius` and scale are overwritten by the controller each frame: `radius = 37*growtangle.image_xscale`,
`image_xscale = radius/64`, positioned toward the soul — section 2.11.)

### Alarm_1 → `instance_destroy()`. Other_7 (anim end) → `image_index = 1`.

### Draw_0 (`..._pink3durgenter_Draw_0.gml`)
If no growtangle, `exit`. Draws a growing **square** border of electric sprites around the box, filling in
over time (`life_time>=20`). `_side_width = radius*2`, `_side_position` walks 0.55→1 along each side then
resets, cycling `_squaredir` 90→0→270→180→90 (bottom, right, top, left) as `_side` increments (L40-72).
Per placed sprite: `draw_sprite_ext(sprite_index, floor(array_frame[i%30]), _xx,_yy, image_xscale,
image_yscale, _squaredir+270, c_white, image_alpha)` plus two thicker ghost copies at `1/3` alpha offset
`±(image_scale*1.5)` (L36-38). The loop runs `until i > (life_time-20)*2 || _side>4` — so the ring "draws
itself" segment-by-segment, 2 segments per frame after life_time 20, wrapping the whole box by the time it
goes active.

---

## 6. obj_pinktimeoutzap — timeout ring + radial burst

Refdata: sprite `spr_pinkzap` (6 frames). Parent `obj_regularbullet`. This is the "you're taking too long"
punisher: a filling ring that, once full, fires a 36-way spinning fan of zaps every 30 frames.

### Create_0
Identical to pink3durgenter minus `dir_add`/`backwards_momentum`: `target=4, damage=100, element=6,
grazepoints=2, active=0, destroyonhit=0, life_time=0, tunnel_lane_layer=0, radius=128, dir_add=12`,
`array_frame[0..29]=irandom(1)`, `pattern_time=1`.

### Step_0 (`..._pinktimeoutzap_Step_0.gml`)
- `life_time++`. `pattern_time -= 0.016666… (1/60)`.
- While `pattern_time>0`: animate segment frames up to `(1-pattern_time)*360/dir_add` of them (the fill
  sweep); frame roll uses `irandom(19)` flash rule; wrap by `image_number` (6). (L6-25.)
- Once `pattern_time<=0` and `alarm[1]<=0` (L26-49) — FIRE THE BURST:
```
_dir = 90;  _moving = -1;  _dir_add = -10
repeat 36:
   _zap = instance_create_depth( scr_get_box(4)+lengthdir_x(radius,_dir),
                                 scr_get_box(5)+lengthdir_y(radius,_dir), -5, obj_pinkzap )
   _zap.direction = scr_wrap(_dir - 90, 0, 360)
   _zap.pattern_speed = -1               # slow-spinning zaps
   _zap.tunnel_lane_layer = self.tunnel_lane_layer
   _zap.image_alpha = 3                  # (>1 → brief bright flash, decays to 1)
   _zap.life_time = 99969
   _dir = scr_wrap(_dir + _dir_add, 0, 360)   # 36 zaps × 10° = full circle
alarm[1] = 30                            # re-fire every 30 frames
```
- Fade-out when `life_time>=99999` (marked dead): `image_alpha = min(image_alpha,1) - 0.075`, destroy at `<=0.001`.

### Alarm_0 → `exit`. Alarm_1 → `instance_destroy()`. Other_7 → `image_index = 1`.

### Draw_0 (`..._pinktimeoutzap_Draw_0.gml`)
Draws the filling ring: `_dirfill = (1-pattern_time)*360`. Loop placing sprites every `dir_add` (12°) from
`_dir=0` up to `_dirfill` (or 360). Each: jittered radius `(radius - image_xscale) + irandom(2)*image_xscale`
at angle `(90 - _dir) + _dir_rand` (`_dir_rand = -1 + irandom(2)`), rotation `-_dir + _dir_rand`, alpha
`clamp(0.2 + 0.4*(1-pattern_time), 0, 1)` — ring brightens as it fills. Plus one leading cap sprite at
`90 - _dirfill` (L14). (`radius` & scale set by controller — section 2.11.)

---

## 7. DAMAGE / HIT RESPONSE — Other_10 (event_user0), `..._purplecontrols_Other_10.gml`
(This is the generic controls hit reaction; in the tunnel it's largely inert since mode-7 doesn't use
`rotate_travel`/`box_momentum` for hits, but for completeness:)
If `iframes<=0`: set `iframes=10`; if `other.super>=1` set `super=2`; kick `rotate_speed`/`rotate_travel`
and `box_momentum=24`. Tunnel damage itself is dealt by the zap/urgent/timeout bullets (all `damage=100`
or enemy damage, `element=6`, `target=4`, `grazepoints=2`) colliding with `obj_heart` when `active==1`.

---

## 8. TIMING / CADENCE SUMMARY
- New depth ring + attack wave: every time `tunnel_timer` (accumulating `+tunnel_speed`/frame) crosses
  `_circle_interval = 188`. Effective cadence therefore scales with `tunnel_speed` (faster tunnel = more
  frequent waves).
- Ring lifespan: born radius 12 → recycled/killed at radius 224 (`_circle_grow_limit`).
- `obj_pinkzap`: fade-in over 30 frames; `alarm[0]=2` frame-flicker loop; dies when its ring passes camera
  (marked `life_time=99999`, alpha −0.075/frame).
- `obj_pink3durgenter`: `snd_electroshock` at life_time 20, becomes `active` (lethal) at 30; wraps the box
  visually over ~ (segments/2) frames after 20.
- `obj_pinktimeoutzap`: ring fills over `pattern_time` 1→0 at `1/60` per frame = 60 frames; then bursts 36
  zaps and re-arms `alarm[1]=30` (burst every half-second).
- Tutorial (difficulty 0): `tutorial_time=300` frames during which `global.turntimer` is frozen and
  `tunnel_lifetime` does not advance.
- Controller self-destructs 30 frames after `obj_heart` is gone.

---

## 9. ASSET LIST
Sprites:
- `spr_purpleheart` (2f, 20x20, origin 0,0) — controller/soul.
- `spr_pinkzap` (6f, 17x17, origin 8,8) — base zap; used by pink3durgenter & pinktimeoutzap.
- `spr_pinkzap_thick` (6f, 17x19, origin 8,9) — pinkzap default/highlight sprite.
- `spr_pinkzap_arrow` (6f, 17x19, origin 8,9) — moving (`_moving!=0`) zaps.
- `spr_pinkspinarrow` (1f, 16x16, origin 8,8) — spin hint (mode 3 only, not tunnel).
- `spr_dust1` (5f, 14x13, origin 7,9) — slide dust (referenced elsewhere; mode-7 uses `obj_pinkdust`).
- `spr_battlebg_0` — `obj_growtangle` box sprite (the tunnel frame that scales by `_scale`).

Sounds:
- `snd_wing` — every soul move (ring change / view rotate).
- `snd_impact` — spin/impact (mode 3; not the tunnel core, but same controller).
- `snd_electroshock` — pink3durgenter arming (life_time 20).

Objects referenced: `obj_growtangle` (box), `obj_heart` (soul), `obj_pinkzap`, `obj_pink3durgenter`,
`obj_pinktimeoutzap`, `obj_dokiheart` (bonus pickup on rings), `obj_pinkdust`, `obj_pinktrail`,
`obj_fx_purpleripple` (idle pulse), `obj_pink_enemy` (damage source), `obj_regularbullet` (bullet parent).

---

## 10. PORTING NOTES / KEY FORMULAS (condensed)
1. **Depth model**: 8 scalar ring radii `tunnel_radius[0..7]`. Growth per frame (only when moving):
   `r' = r*(1 + r/(32000/speed)) + 0.0375*speed`. Ring 0 spawns at 12 every 188 timer-units; die at 224.
   Soul rides `tunnel_lane_layer`; up = inward (−1), down = outward (+1). Everything on a ring scales
   `radius/64` (zaps), `radius/48` (heart/doki) and sits at `center + lengthdir(radius, angle)`.
2. **View is always rotated so the soul sits at 270° (bottom)**: each frame
   `_rotated_amount = clamp(270-heart_angle, ±(4+|270-heart_angle|/6))`; add to `heart_angle`,
   `tunnel_lane_direction`, and every entity's `direction`. Left/Right add `∓90` to `rotate_travel` to spin
   the whole tunnel.
3. **Perspective render is fake-3D via concentric circles + 4 corner spokes** on a 300×300 surface centered
   at (150,150), then a `_scale*71`-px crop pasted onto the box center. Soul's ring drawn thick + pink
   (`#EE5577`); other rings `_prpl_dark`; corner dots `_prpl_light`; spokes `_prpl_darker`→`_prpl_backdrop`.
4. **Attacks** come from a per-difficulty `min(...)` speed ramp feeding the 188-interval wave clock; each
   wave pops a `(variant, angle)` from a self-refilling `pattern_list` and fires a fan of `_repeats` zaps
   spaced `±10°`, spawned at center, that then ride outward on rings. Variant 3 = moving arrow zaps
   (`pattern_speed = ±{2.5,5}`, `spr_pinkzap_arrow`); variant 4 = doubled (`_multiple=2`).
5. **Timeout ring** (`obj_pinktimeoutzap`) fills over 60 frames then loops a 36-way 10°-spaced burst every
   30 frames; **urgent-enter** (`obj_pink3durgenter`) is the mouth ring that becomes lethal 30 frames after
   spawn (electroshock at 20).
