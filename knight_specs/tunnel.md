# Knight — "Sword Tunnel New" (obj_dbulletcontroller type 153) — EXACT PORT SPEC

All refs are `file:line` into `DELTARUNE - GML\DELTARUNE Chapter 3 - GML\`.
GML angles are y-DOWN screen space (image_angle 0=right, 90=up-on-screen but sprite tip conventions noted inline). Converted notes marked **(y-up)**.

---

## 0. INVOCATION / TOP LEVEL

- Selected as knight `myattackchoice == 13`: `gml_Object_obj_knight_enemy_Step_0.gml:509-517`
  - `global.monsterattackname = "sword tunnel new"`
  - spawns `obj_dbulletcontroller`, `.type = 153`, `.difficulty = difficulty` (the KNIGHT's current difficulty — 0/3/4 across phases), `.damage = 62`, `global.invc = 0.14`.
- Turn length: `gml_Object_obj_knight_enemy_Step_0.gml:589-592`
  - `if (choice==13 && difficulty==3) scr_turntimer(360); else scr_turntimer(330);`  → **330 frames normally, 360 on difficulty 3.**
- type 153 handler: `gml_Object_obj_dbulletcontroller_Step_0.gml:2936-2950`
  - Once (`!made`): `_manager = instance_create(obj_growtangle.x, cameray(), obj_sword_tunnel_manager)`, `scr_bullet_inherit`, copies `difficulty` + `damage`, then `with(_manager) event_user(0)`, sets `made=true`.
  - **NO box reshape.** Unlike type 101 (which did `obj_growtangle.x-=70` / xscale 2.5), type 153 does NOT touch obj_growtangle geometry. Box stays default size. Manager just sits at box center.

---

## 1. obj_sword_tunnel_manager  (the spawner; invisible controller)

### Create_0 (`gml_Object_obj_sword_tunnel_manager_Create_0.gml`)
```
timer = -40 + irandom(10)      // negative → ~40f warm-up delay before first wave
finishtimer = 0
finishtimermax = 230           // 250 if obj_knight_enemy.difficulty == 3   (line 5-6)
con = 0
swordx = camerax()+camerawidth()+20   // spawn X = just OFF the RIGHT edge of screen
swordy = obj_growtangle.y             // spawn Y = vertical center of box (drifts over time)
swordxrel = 340
swordyrel = 0
sworddirection = 180           // radial modes only
swordcount = 0
setcount = choose(2,3,4)       // waves before gap-drift direction changes
waitsetcount = choose(1,2,3)
movedirection = choose("up","down")
difficulty = 0                 // OVERWRITTEN by dc.difficulty before event_user(0)
tobyvolleyamount = 10 + irandom(6)
tobyvolleymodeinitspeed = 1
event_user(0)
instance_create(knight.x, knight.y, obj_knight_swordtunnelanim)   // the Knight pose/leaf FX
```
**The tunnel = swords stream in from the RIGHT edge and fly LEFT across the box; the soul threads the vertical gap between a top row and a bottom row. The gap's vertical center (swordy) wanders up/down.**

### Other_10 = event_user(0)  — difficulty table (`gml_Object_..._Other_10.gml`)
Defaults: `rate=6, gapsize=50, verticalchange=15, tobymode=0, maxswords=999`. Then per difficulty:
| diff | rate | gapsize | verticalchange | tobymode | notes |
|------|------|---------|----------------|----------|-------|
| 0 | 4 | 45 | 10 | 0 | straight horizontal tunnel |
| 1 | 4 | 45 | 10 | 1 | sin-pulsed speed |
| 2 | 4 | 45 | 7  | 2 | rotating radial tunnel (+4°/wave) |
| 3 | 4 | 45 | 7  | 3 | rotating radial, gap breathes (+8°/wave) |
| 4 | 4 | 40 | 10 | 0 | same as 0 but TIGHTER gap (40) |
- `rate` = frames between spawn waves. **This fight uses difficulty 0, 3, 4** → rate always 4.
- Only tobymode 0 (diff 0 & 4) and tobymode 3 (diff 3) matter for the port.

### Step_0 (`gml_Object_obj_sword_tunnel_manager_Step_0.gml`)
- `timer++; finishtimer++;` each frame. `_xx,_yy` = obj_growtangle center (fallback camera center+320/180). Lines 1-10.
- **Finish trigger** L12-18: when `finishtimer == finishtimermax` (230 / 250@d3) → `con=1` on manager AND `with(obj_sword_tunnel_sword) con=1` (all live swords enter FINALE sweep, see §2).
- **Spawn wave** L20 `if (timer >= rate && con == 0)`:
  - **tobymode 0 (diff 0/4)** L22-30: two swords at `swordx`:
    - TOP: `(swordx, swordy - 50 - gapsize/2)`, `image_angle = 270`, `damage = 62`.
    - BOTTOM: `(swordx, swordy + 50 + gapsize/2)`, `image_angle = 90`, `damage = 62`.
    - → the two blades sit `50 + gapsize/2` above & below center; passable gap centered on `swordy`.
  - **tobymode 3 (diff 3)** L69-103: rotating tunnel.
    - `if (!tobyvolleymode)`: `verticalchange = abs(sin(tobytimer/8))*5; gapsize = 34 + verticalchange*1.4;` (gap "breathes" 34→41).
    - `sx=lengthdir_x(swordxrel(340), sworddirection+180)`, `sy=lengthdir_y(...)`.
    - `syaddx/y = lengthdir(swordy-growtangle.y, sworddirection+270)`; `sgapx/y = lengthdir(gapsize, sworddirection+270)*2`.
    - TOP sword at `((_xx+sx)-sgapx)+syaddx , ((_yy+sy)-sgapy)+syaddy`, `image_angle = sworddirection+270`, `mydirection = sworddirection`.
    - BOTTOM at `_xx+sx+sgapx+syaddx , _yy+sy+sgapy+syaddy`, `image_angle = sworddirection+90`.
    - Both: `speedproportion = lerp(1,0.8, abs(lengthdir_y(1, sworddirection+180)))`, `_speed = -8*speedproportion`, `_gravity = ((2*speedproportion) - verticalchange/15) * tobyvolleymodeinitspeed(1)`, `damage=62`.
    - `sworddirection += 8;`  (rotates 8° per wave).
  - (tobymode 1 = sin speed pulse, tobymode 2 = +4°/wave radial — not used in this fight.)
  - **Gap drift** L105-141: `if movedirection=="up" swordy -= verticalchange; if "down" swordy += verticalchange;` each wave. `swordcount++`.
    - When `swordcount == setcount` (moving) → reset counters, `setcount=choose(2,3,4)`, `waitsetcount=choose(1,2,3)`, toggle movedirection to "none" (hold) ↔ choose up/down. Clamp: if would go up but `swordy < growtangle.y-20` → force down; if down but `swordy > growtangle.y+20` → force up. **Gap center stays within ±20px of box center.**
- **SFX + timer reset** L144-151: `if (timer >= rate && stopsfxtimer < 3)`: while con==1 count stopsfxtimer; play `snd_heavy_passing` vol **0.3** pitch **1.2**; `timer = 0`.
- L153-154: `if (swordcount >= maxswords(999)) instance_destroy` — never in practice.

### CleanUp_0
`snd_stop(snd_object_passing); snd_stop(snd_heavy_passing);`

---

## 2. obj_sword_tunnel_sword  (the blade projectile)

Sprite `spr_knight_diamondbullet_l`: **3 frames, 99×32 px, origin (49,15)** (sprites.tsv:3259). Native scale (no darksize halving on the sword itself).

### Create_0 (`gml_Object_obj_sword_tunnel_sword_Create_0.gml`)
```
scr_bullet_init(); grazepoints=0.8; destroyonhit=0
_speed=6; _gravity=1; _maxspeed=30       // (first _speed=10/_grav=2 lines overwritten by L14-15)
image_index=2; image_speed=0             // static frame 2 of 3
mydirection=180                          // travels LEFT
image_yscale=0                           // grows in (see Step L134)
randx=-20+irandom(40); randy=-20+irandom(40)   // finale aim jitter
targetangle=0; anglespeed=8; telegraph=0; telegraphalpha=0
```
- Manager overrides `image_angle` (270 top / 90 bottom for horizontal; sworddirection±90 for radial) and `.damage`.

### Step_0 (`gml_Object_obj_sword_tunnel_sword_Step_0.gml`)
- L1-4: `_speed += _gravity;` clamp to `_maxspeed(30)`. → horizontal swords accelerate 6→30 px/f moving left.
- `_xadd=lengthdir_x(1,mydirection)`, `_yadd=lengthdir_y(1,mydirection)`.
- **FINALE (`con==1`)** L9-68: the end sweep.
  - `timer++`, `c=10`.
  - `timer==1`: `_gravity=0; telegraph=1`.
  - `timer < 15`: rotate `image_angle` toward `obj_heart` (+10+randx, +10+randy) at `anglespeed` lerp 8→0; `_speed` lerps toward 0.
  - `timer 21..24`: play `snd_knight_jump` (idx 225) vol1 pitch **0.8**; `_speed=2`, move BACKWARD (`image_angle+180`) — the wind-up recoil.
  - `timer 25..29`: freeze (`_xadd=_yadd=0`).
  - `timer==30`: `scr_afterimage_grow()` xrate/yrate 0.4 fade 0.2.
  - `timer>=30`: play `snd_knight_cut` (idx 21) vol1 pitch **0.8**; `telegraph=0`; **`damage=160`**; **`_speed=80`**; charge along `image_angle`. → THE SLASH.
- `image_blend = c_white` (default).
- **Collision** L72-109: only checked when within 80px box of heart. Sets `image_blend=c_red`. Substep loop `repeat(max(floor(_speed/8),1))` advancing 8px:
  - If finale (`con==1 && _speed==80 && !create_2nd_hitbox`): spawn `obj_sword_tunnel_hitbox` at (x,y) depth-1, `image_angle=image_angle`, `image_yscale=0.4`, `image_xscale=999` (a full-width line hitbox); set `obj_heart.mask_index = spr_dodgeheart_smallmask`; `create_2nd_hitbox=true`.
  - Else normal: `collision_line(x, y, x+lengthdir_x(37,image_angle), y+lengthdir_y(37,image_angle), obj_heart)` → `event_user(5)` (registers hit). **Blade = 37px collision segment along image_angle.**
- Move L111-112: `x += _xadd*_speed; y += _yadd*_speed`.
- Afterimage L113-119: `scr_afterimage()` alpha 0.4 at midpoint; white blend during finale.
- Despawn L121-131: x ≤ camerax-100, x ≥ camerax+740, y ≥ cameray+600, y ≤ cameray-250.
- L133-134: while con==0, `image_yscale = lerp(image_yscale, _speed/20, 0.1)` → blade stretches with speed (max ~30/20=1.5). image_xscale stays 1.

### Draw_0 (`gml_Object_obj_sword_tunnel_sword_Draw_0.gml`)
- L1-8: telegraph laser — `telegraphalpha` fades toward 0.5 when telegraph==1 (step 0.05), fades out step 0.1. If >0 draw `spr_lasergun_laser_telegraph` frame0 at (x,y) **xscale 999, yscale 0.4, image_angle, c_red, alpha=telegraphalpha** (long red aim line).
- L10-19: during finale, red blend merges back to white over `timer/10`.
- L21-22: **motion trail** — 10 copies: `draw_sprite_ext(sprite_index, image_index, lerp(xprevious,x,i/10), lerp(yprevious,y,i/10), image_xscale, image_yscale, image_angle, image_blend, i/10)` for i=0..9.
- L24: `draw_self()`.

---

## 3. obj_sword_tunnel_hitbox  (finale line hitbox, invisible)
- Create: `scr_bullet_init; grazepoints=0.8; damage=160; active=0; visible=false`.
- Step: `timer++`; `timer==2 → active=1`; `timer==3 → instance_destroy`. (2-frame line hit at slash impact.)
- Destroy: `exit`.
- Sprite mask `spr_lasergun_laser_telegraph_mask` (2×13, origin 0,6); scaled xscale 999 yscale 0.4 → full-box horizontal band along blade angle.

---

## 4. obj_knight_swordtunnelanim  (Knight character pose + leaf FX; cosmetic)
- Create: `scr_darksize()` (**HALVE** — dark-world 2x sprites), `sprite_index=spr_roaringknight_point_ol` (100×88, origin 0,0; sprites.tsv:2714), image_speed=0, depth=growtangle.depth-1, drawtrail=true, dir=4, ystart bob.
- Step: intro (con0, timer<60) — every 3f play `snd_punchmed` (idx 226) ×2 vol `0.8*fadeaudio` pitch 1+rand(0.2). `timer==1` lerp image_index 0→4 and dir 4→-18. `timer==20` fade alpha out, `hspeed=-4`. At timer 60 → con=1.
  - con1: lerp shinkafade/leafpitch; every 3f `snd_punchmed` (leaf whoosh); every 11f `snd_shinka_ambience`.
  - `global.turntimer < 10`: switch to `spr_roaringknight_ball_transition_sword` (100×88), destroy at endtimer 8.
  - Bob: `y = ystart + sin(siner/16)*8`; afterimage trail when drawtrail.
- Draw: `draw_self()`.

---

## 5. SFX LIST (sounds.tsv indices)
| sound | idx | where | vol | pitch |
|-------|-----|-------|-----|-------|
| snd_heavy_passing | 370 | manager, every wave (≤3 after finish) | 0.3 | 1.2 |
| snd_object_passing | 467 | stopped in CleanUp | — | — |
| snd_knight_jump | 225 | sword finale windup (t 21-24) | 1 | 0.8 |
| snd_knight_cut | 21 | sword finale slash (t≥30) | 1 | 0.8 |
| snd_punchmed | 226 | anim leaf whoosh (every 3f) | ~0.8 | 1+rand |
| snd_shinka_ambience | 376 | anim con1 (every 11f) | shinkafade | 1 |

## 6. ASSET LIST
- Sprites: spr_knight_diamondbullet_l (99×32 o49,15 — the sword), spr_lasergun_laser_telegraph (2×13 o0,6 — red aim line, drawn xs999 ys0.4), spr_lasergun_laser_telegraph_mask (hitbox mask), spr_dodgeheart_smallmask (20×20 — shrunk soul mask during finale), spr_roaringknight_point_ol (100×88 — Knight pose, HALVED), spr_roaringknight_ball_transition_sword (100×88 — end transition).
- Objects: obj_sword_tunnel_manager, obj_sword_tunnel_sword, obj_sword_tunnel_hitbox, obj_knight_swordtunnelanim.

## 7. TIMELINE (frames)
- 0: manager spawns, timer≈-40 (warm-up ~40f before first wave), anim starts.
- ~40 → finishtimermax: swords stream in, 2 per wave every 4 frames (rate). Gap wanders ±20px of center in sets of 2-4 waves.
- finishtimermax = **230 (250 @ diff3)**: con=1 → all live swords rotate to aim at soul, telegraph (~15f), windup recoil (t21-24), freeze, then SLASH at speed 80 / damage 160 with full-width line hitbox; soul mask shrinks.
- Turn ends at turntimer **330 (360 @ diff3)**.
