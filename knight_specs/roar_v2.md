# THE ROARING (type 107) — Roaring Knight ULTIMATE — MAX-FIDELITY SPEC

Source: `DELTARUNE - GML\DELTARUNE Chapter 3 - GML\`
All angles GML convention (y-up, CCW, 0°=right). "center" = the on-screen knight-mouth focus point = `camerax()+fake_x , cameray()+fake_y+55` (fake_x=camerawidth*0.5, fake_y ramps 24→88).

---

## 0. DISPATCH / SETUP

`gml_Object_obj_dbulletcontroller_Step_0.gml:2184-2198` — `if (type == 107)`:
- `global.turntimer = 999999`, `made = true`.
- `with (creatorid) image_alpha = 0` — the Knight (obj_knight_enemy) is HIDDEN; roaring2 draws its own fake knight for the whole set-piece.
- `instance_create(creatorid.x, creatorid.y, obj_knight_roaring2)`, `.target = 3` (hits whole party), `scr_bullet_inherit`.
- **No `event_user` is called** → the object's own `Step_0` / `Draw_0` run. (`Other_10` / User-Event-0 is a DEAD earlier draft still in the files; differences noted at bottom. Do NOT port Other_10.)

### obj_knight_roaring2 Create (`_Create_0.gml`)
Key init: `timer=0`, `fake_x=camerawidth*0.5`, `fake_y=24`, `fake_alpha=0`, `rand_angle=irandom(360)`, `rand_dist=320`, `intensity=1.5`, `intensify=1.5`, `attack_timer=0`, `attack_timer_goal=-2`, `attack_token=1`, `roaring_timer=0`, `line_timer=-1`, `r=g=b=128`, `knight_sprite=664`(=spr_roaringknight_front_filled), `knight_sprite_speed=0.5`, `bobble_freq=1`, `bobble_amp=4`, `ball_counter=0`, **`ball_speed=2`**, **`player_suck=0.5`**, `hsv=128`, `hsv_switch=false`, `bullet_list=ds_list_create()`, `do_fake_screen=false`, `stop=false`.
- `obj_heart.boundaryup = 160` (SOUL: raises top clamp of the box so soul can go high).
- `y -= 320` (object parks off-screen; only used as a draw/anchor host).
- `obj_knight_enemy.chargeupcon = 2`, `chargeuptimer = 0`.
- `scr_script_delayed(scr_lerpvar, 20, "darkness", 0, 1, 32)` → at timer≈20, fade whole surface in (darkness 0→1 over 32f).
- 4 surfaces created lazily in Draw: my_surface, ball_surface, star_surface, terrible_surface (all camerawidth×cameraheight).

SOUL clamp each Step (`Step_0.gml:1-14`): heart hard-clamped inside camera rect (x≥camerax, x≤camerax+camerawidth-20, y≥cameray, y≤cameray+cameraheight-20). No custom wspeed change here; only `boundaryup=160`.

---

## 1. MASTER TIMELINE (obj_knight_roaring2 Step_0)

`timer` increments every frame from 0. `intensity` only moves once `timer>128`.

| timer | event |
|---|---|
| ~20 | `darkness` 0→1 over 32f (screen surface fades in over black). |
| 30 | `obj_growtangle` (the battle BOX) lerps `image_xscale→2560/sprite_width`, `image_yscale→1920/sprite_height` over **160f**, ease "out" → box GROWS to (near) fullscreen arena. |
| 80 | `fake_alpha` 0→1 over 48f; `fake_y` 24→88 over 48f (ease2) — fake knight fades in and rises. |
| 118 | `ball_darkness` 0→1 over 32f (delayed 16) — background tunnel darkens. |
| ≥120, every 3f, while intensity<3.75 | spawn `obj_afterimage_grow` w/ spr_roaringknight_front_filled, scale 2.2+min(timer-116,18)*0.15, pulsing scale, alpha 0.01→0.35 — growing ghost of the knight. |
| 132 | `sound = snd_play_pitch(snd_knight_stretch, 0.1)`; from 133+ pitch += 0.000535/frame (rising strain tone). |
| >128 | **CHARGE begins** — `intensity = approach(intensity, 4, 0.008)` (+0.008/f, ~1.5→4 over ~310f). |
| ≥136, every frame, intensity<3.75 | spawn `obj_particle_generic` (spr_pixel_white_front) at random 480-560px out, streaks INWARD to center over 8f (converging energy lines). |
| intensity==3.66 | spawn `obj_knight_circle` (r/g/b 0→255 over 48f, size 480→0, growth10, not in box) — white flash bloom; `ball_darkness` 1→0 over 32f. |
| intensity==3.74 | `knight_sprite=4961`(front_flourish), img lerp 0→4 over 16f; `fake_alpha` 1→0 over 32f (knight strip fades as it winds up). |
| **intensity==4** | **ROAR PHASE** starts (`roaring_timer` begins counting). |

### CHARGE bullet spew (`Step_0.gml:105-371`, gated `attack_timer==4`)
`attack_timer++` each charge frame; on hitting 4 → fire, then `attack_timer = floor(-1+intensity)` (cadence tightens as intensity climbs: reset 0→ fire every 4f early; reset 2→ every 2f near end).
Per fire, `starcount_p1++`; the ONLY live volley is `starcount_p1==1 && intensity<3.7`:
- **intensity < 2.7:** `rand_angle+=32`, then repeat 6: `rand_angle+=60`; spawn `obj_knight_roaring_star` at `center + lengthdir(rand_dist=600, rand_angle)`, `direction`=toward center, `speed = 8+intensity`, `friction=-0.1`, `spinspeed=1`, scale 2 → **6-star ring pulled inward.**
- **2.7 ≤ intensity < 3.7:** `rand_angle+=9`; repeat 2 with `_o` 0 then 180: spawn star at `rand_dist=600, rand_angle+_o`, `speed=16`, `friction=-0.1`, `spinspeed=1`, scale 2 → **2 opposing stars.**
- (`star_angle1/2/3` are force-set to -1 → all following fan blocks are DEAD code; ignore.)
- After starcount handling: `if starcount_p1==3 || intensity>=2.7 → starcount_p1=0`.
- Clamp (intensity 3–4): stars kept within camera±60.

### SPIRAL PULL-IN of charge stars (`Step_0.gml:608-631`, while `roaring_timer<1` & each star's dist logic)
Every star, while `roaring_timer<180`:
- `image_x/yscale = 0.00588 * dist(star,center)` (min 0.2) — bigger when far, shrinks approaching.
- `direction = point_direction(star→center)`; then moves `x/y += lengthdir(speed*0.625*(1/intensity), direction + 90*spinspeed)` → **tangential + inward = SPIRAL into the center.**
- `if dist < 12 → instance_destroy` (consumed at the mouth).
Net effect: rings of stars are sucked in a spiral into the knight's mouth during charge.

### SOUL SUCK during charge (`Step_0.gml:81-103`)
- While `roaring_timer<1` & intensity<4: `ball_speed = intensity*3`; if intensity<3.75 `player_suck = approach(player_suck, 1, 0.1625)`.
- Then `player_suck = approach(player_suck, 0, 0.15)` (decays).
- Heart pulled toward center: `obj_heart.x/y += lengthdir(player_suck, dir(heart+10 → center))`. Positive = TOWARD knight.

---

## 2. ROAR PHASE (intensity==4 → roaring_timer 1..375+)

| roaring_timer | event |
|---|---|
| 9 | `knight_sprite_image` lerp 4→6 (4f); `fake_alpha=1`; **`player_suck=min(player_suck,-6)`** (SOUL blown OUTWARD hard), from 9+ clamped ≥ -3 = -3 (steady push-away); **`ball_speed=-32`** (tunnel reverses/explodes outward); `ball_darkness=1`; `bobble_freq` 1→3 (8f); **`snd_play(snd_knight_roar)`**; `scr_script_repeat(instance_create,8,2, center, 46)` (spawn obj id 46 ×2 every 8f — screen dust); spawn white `obj_knight_circle` (255,255,255, not in box) = big WHITE FLASH. **Initial 8-star burst:** loop a=0..7 → star at `direction=a*45°`, `speed=8.5+random(2)`, scale lerp 0.1→1.2 over 32f. |
| 15 | `sprite_index=spr_roaringknight_front_roar`; `knight_sprite=219`, img 0, speed 0.5 (open-mouth roar sprite). |
| >15, every 5f (until 168) | `snd_play_pitch(snd_stardrop,0.5)` @vol0.5; `rand_angle += 60+irandom(10)`; `starcount_p2++`; **3-star fan** at `star_angle1=rand_angle`, `star_angle2=rand_angle+20`, `star_angle3=rand_angle-20`; speeds: angle1 `6.5+random(2)`, angle2 & angle3 `8.5+random(2)`; each scale lerp 0.1→1.6 over 32f. → continuous rotating 3-fan star SPEW outward, every 5 frames, from ~timer20 to ~168 (≈30 volleys). |
| every 3f | `obj_afterimage_screen` (xrate/yrate 0.015, faderate 0.025) — screen shudder ghost. |
| 181 | **FLOURISH / freeze:** `colorize=6`; `player_suck` → 0 over 24f; `ball_speed` → 1 over 24f; `bobble_freq` 3→1 (16f); `sprite_index=spr_roaringknight_front_flourish`, img 0 speed 0; `knight_sprite=4961`, `knight_sprite_image` lerp 5.99→0 over 12f. **ALL roaring_stars: `friction=0.5`** (they brake) and each id is pushed into `bullet_list` (queued for detonation). |
| ≥182, 1 per frame | pop `bullet_list[0]`: set that star's `con=1` (arm it) then delete from list → **SEQUENTIAL DETONATION, one star armed per frame** in spawn order. Each armed star fireworks ~40f later (see §3). |
| 275 | **SLASH wind-up:** `sprite_index=spr_roaringknight_front_slash`; `knight_sprite=4319`, img lerp 0→2 (8f); `bobble_amp` 4→0 (24f); `line_timer=0` (slash guide-line starts drawing); color `r`128→255, `g`128→0, `b`128→0 over 16f → the guide line turns RED. |
| 299 | **THE CUT:** knight snapped to `x=center, y=cameray+fake_y+20`; `obj_growtangle.image_x/yscale=0` (box collapses); `knight_sprite_image` lerp 2→5 (6f) & `image_index` 2→5; `do_fake_screen=true` (screen-split render path, §4); **`snd_play(snd_knight_cut)`**; spawn `obj_roaringknight_slash` at direction **117°**, `image_xscale=4`, `width*=4`, `slashdir=-1`; `scr_bullet_inherit`; `event_user(0)`. Knight lunges: `y` +40 (16f out) then +40→-320 over 24f (24f delay, ease in) = leaps up/off. `jumpimages=true` (afterimage trail). |
| 363 | Recover: `jumpimages=false`; `x=creatorid.x`; reset `obj_knight_enemy.siner2=0`, y=ystart bob; `sprite_index=spr_knight_warp`, img 5→8 over 8f (warp-out anim). |
| 375 | **END:** `obj_knight_enemy.image_alpha=1` (real Knight reappears); `obj_growtangle.growcon=3, timer=0` (box shrinks/destroys — restores normal box); **`global.turntimer=-1`** (turn ends). |

Sprite sequence overall: **front_filled(664)** [charge] → **front_flourish(4961) img0-6** [wind-up, intensity 3.74→roar 9] → **front_roar(219)** [rt15, the roar] → **front_flourish(4961) img5.99→0** [rt181] → **front_slash(4319) img0→2→5** [rt275→299] → **spr_knight_warp img5→8** [rt363].

---

## 3. obj_knight_roaring_star (the stars) + detonation

Create (`_Create_0.gml`): `scr_bullet_init`, scale 0, `destroyonhit=false`, `con=0`, `splitmax=14`, `damage=206`, `element=5`, `playSound=true`.
Draw is routed by roaring2 Draw: `con==0 → event_user(0)`(Other_10, whole star) else `event_user(1)`(Other_11, detonation beams). Uses spr_knight_bullet_star (+_top/_bottom, 3 frames).

Hit handler (`Other_15.gml`): while roaring2 exists, ANY star touch → `with obj_knight_enemy event_user(2)` = FIXED chip damage (40 to each party member ×3-loop, `gml_Object_obj_knight_enemy_Other_12.gml`), NOT the 206 value. The 206/element are dormant while the set-piece runs.

Detonation state machine (`Step_0.gml`):
- **con==1:** `friction=0.5`, con→2.
- **con==2:** when `speed==0 && gravity==0` set `gravity=0.1`, `gravity_direction=direction-180` (drifts back the way it came), friction 0. `timer++`; at **`timer>=40`** (and !split): timer=0, con→3, **`snd_play(snd_explosion_firework)`**.
- **con==3:** grows; at `timer==3` spawn **6 `obj_knight_pointing_starchild`** via scr_childbullet: angles start 90°, step pattern +66,+57,+66,+66,+57,+66 → {90,156,213,279,345,42}; each `speed=1`, `friction=-0.1`, `deceleration=0.15`, scale = star.scale*0.5. At `timer>=4`: spawn afterimage, `instance_destroy`.
- (split path uses spr_knight_bullet_star_top/bottom + splitease; not entered in the main type-107 flow since `split` stays 0.)

So: each queued star fireworks ~40f after being armed (1 armed/frame from rt182) → a rolling cascade of firework pops, **6 starchildren per star**.

### obj_knight_pointing_starchild (firework shrapnel)
Create (`_Create_0.gml`): `deceleration=0.1`, `minspeed=1`, `damage=1`(→ overwritten to parent 206 by scr_childbullet, but hit handler uses fixed-chip too), `element=5`, `lifetime=60`, `tracking=true`, `accel=0.5`, `sprite=spr_knight_starchild_parts`.
Step (`Step_0.gml`, only while roaring2 does NOT exist... note guard `if (!i_ex(obj_knight_roaring2))`) — **during the ROARING these children run their tracking only after roaring2 is gone**; while roaring2 lives they are drawn/faded by roaring2 Draw and fade via `image_alpha = clamp01(remap(45,60,1,0,timer))` (start fading at timer45, gone at 60) → short-lived glowing sparks. When roaring2 gone: con0→1 (align to heart_follower over 10f, squash), con2 (home, rotate toward heart at 2°/f, ease-in drift), con3 (speed→25, red afterimage streak), con4 (explosion sprite `spr_thrash_missile_explosion`, 4f, destroy). Homing target = `obj_heart_follower`.
Hit handler (`Other_15.gml`): same as star — with roaring2 present → knight event_user(2) chip damage; else target=3 damage=75 aoe.

---

## 4. SCREEN / BG EFFECTS (obj_knight_roaring2 Draw_0)

Render order onto surfaces then composited:
1. **ball_surface (tunnel BG):** `draw_sprite_tiled(spr_knight_bullet_flow, fake_x+global.time*2, fake_y)` normal + 4× additive → scrolling tunnel flow. `ball_counter += ball_speed` (wraps 0..1800). 6 additive rings via `draw_circle_color(fake_x, fake_y+57, 1800-((ball_counter+300*a)%1800), white,#595959)` with `bm_zero,bm_src_color`, plus a 640-radius white→black core circle. This is the pulsing radial "throat" that speeds with ball_speed (2→ up to intensity*3 →-32 on roar → 1).
2. **star_surface:** obj_knight_circle (event_user1), obj_particle_generic, then roaring_stars (con0=Other_10 / con1=Other_11) drawn in blend passes, the **`spr_knight_line_grate`** overlay (`draw_sprite_ext(spr_knight_line_grate,0,0,star_flicker,2,2,...)`, `star_flicker=2-star_flicker` → 1px vertical jitter every frame = scanline grate), starchildren (additive outline glow), afterimages.
3. **my_surface (HSV ping-pong composite):** clear black; **HSV cycle** `hsv++`/`--`, ping-pong **range 128↔288** (`hsv_switch` flips at ≥288 and ≤128). For each scanline row of ball_surface: `color = make_color_hsv(hsv%255,255,255)`; `draw_surface_part_ext` with horizontal wobble `sin((a+time)*0.1)*4*intensity + sin((a+time)*0.35)*0.5*intensity` (bm_add, alpha=ball_darkness) → rainbow, wavy, intensity-scaled BG. Then `draw_surface(star_surface)`, afterimage_grow.
4. **Slash guide line** (line_timer>-1, from rt275): two `spr_rk_quickslash_marker(_gradient)` beams at screen-center offset by lengthdir(280,-63°), scaling `line_timer*1` long, thickness `4+8*(1-min(line_timer,16)/16)`, angle -63°, color make_color_rgb(r,g,b) (grey→red). The telegraph of the cut.
5. **Fake knight strip draw:** per scanline of knight_sprite, `draw_sprite_part_ext(...70px wide col..., 2×2)` with horizontal `sin` wobble scaled by `intensify` (extra mirrored pass when intensify>1.5) and vertical bob `sin(bobble_count*0.1)*bobble_amp`. `intensify` = intensity until 3.75 then decays to 0.
6. Composite: `draw_surface_ext(my_surface, camerax, cameray, darkness)` then obj_heart drawn on top.

Shake/darkness: `darkness` 0→1 fade-in at start (whole scene appears from black). White flashes via obj_knight_circle at intensity3.66 & roar rt9. `obj_afterimage_screen` ghosts each 3f (screen shudder). Background wobble amplitude scales with `intensity`.

### The screen-splitting cut (`do_fake_screen`, Draw_0:182-255, set rt299)
On the cut frame: draw knight, then build TWO half-screen sprites from `terrible_surface`:
- Render my_surface+heart, mask off with a black rectangle + triangle along the `midway±120` diagonal → capture LEFT diagonal half → `fakey_screen` (pivot camerawidth*0.25, height*0.5).
- Repeat mirrored for the RIGHT half → `fakey_screen_2` (pivot 0.75,0.5).
- `stop=true` (freeze normal render), destroy obj_heart & starchildren.
- Spawn two `scr_marker` pieces: left half at (0.25,0.5) `direction=180`, speed lerp 15→0.5 (12f) then gravity 1 dir180; right half at (0.75,0.5) `direction=0`, speed lerp 14→0.5 then gravity 1 dir0. → the frozen screen splits along a diagonal and the two halves slide apart and fall = the signature "world gets cut in half" finish.

obj_roaringknight_slash (`_Create/_Step_2/_Draw`): width=24 (×4=96 here), element5, `alarm[0]=1`,`alarm[1]=3`, `image_yscale=0.1`. Draw = big additive triangle beam length 640 along direction 117°, color white→red by alpha. Step_2: after alarm0, `width*=0.66`, `alpha*=0.66` each frame (fades); jitters obj_growtangle ±2px & `scr_heartclamp` while width>4; deactivates <12, destroys <0.5. Hit (`Other_15`): damage 206 → aoe path damage 75 target 3 (party-wide) via knight event_user(2) chip while roaring2 present.

---

## 5. NOT PART OF TYPE 107 (do not port into THE ROARING)
- **obj_knight_roaring_fx** = the separate "Roaring" FIRE attack (spr_roaringknight_shift_ol, obj_knight_crush, obj_regularbullet w/ spr_roaring_fire2 rings, obj_knight_puff). roaring2 never spawns it.
- **obj_knight_lightorb, obj_knight_bullethell1/2 (+ _bullet/_bullet2/_bullet_bounce)** — belong to OTHER Knight attacks; NOT referenced anywhere in the roaring2/roaring_star/starchild chain (grep-verified).
- **obj_knight_roaring2 Other_10 (User-Event-0)** = dead earlier draft (never invoked). Diffs vs live Step_0: player_suck target 3 not 1; roaring window `<181` not `<169`; charge spew is a simple star+antistar pair (rand_angle & +180, dkgray decoy) with `attack_token` toggle instead of the ring/pair `starcount_p1` logic; roar-phase fan uses rand_angle & ±(80+random(80)) instead of ±20. IGNORE for the port.

---

## 6. SFX LEDGER (name — exact trigger)
- `snd_knight_stretch` — Step timer==132, pitch 0.1 rising +0.000535/f (charge strain). Stopped in CleanUp.
- `snd_knight_roar` — roaring_timer==9 (the ROAR). Stopped in CleanUp.
- `snd_stardrop` (pitch 0.5, vol 0.5) — every 5f during roar spew (rt>15..168). Stopped in CleanUp.
- `snd_explosion_firework` — per star, con2→con3 (each detonation, ~40f after arming).
- `snd_knight_cut` — roaring_timer==299 (the screen-split slash). Stopped in CleanUp.

## 7. COLOR CONVERSIONS
- `#595959` (Draw ball rings) — GML BGR literal 0x595959 → R=0x59,G=0x59,B=0x59 = (89,89,89) grey (symmetric).
- `#595959` is grey so BGR=RGB. `make_color_rgb(r,g,b)` slash line: 128,128,128 grey → 255,0,0 red (already RGB order via make_color_rgb).
- `make_color_hsv(hsv%255,255,255)` BG rainbow, hue ping-pong 128↔288 (mod 255): hue ~128(cyan)→255/0(red) full-sat full-val.
