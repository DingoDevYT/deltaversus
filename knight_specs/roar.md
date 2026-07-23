# Knight ULT — "Roaring" (obj_knight_roaring2, controller type 107 / target=3)

EXACT port spec extracted from decompiled DELTARUNE Ch3 GML. Read every event.

## Scope / entry point
- Controller: `gml_Object_obj_dbulletcontroller_Step_0.gml:2184` — `if (type == 107)`: sets `global.turntimer = 999999`, hides Knight (`creatorid.image_alpha = 0`), then `instance_create(creatorid.x, creatorid.y, obj_knight_roaring2)` with `.target = 3` and `scr_bullet_inherit`. (`.target=3` → `scr_damage_all`, the PvP/party-wide hit.)
- **This ULT is driven by `obj_knight_roaring_star`, NOT `obj_knight_bullethell1/2`.** bullethell1/2 belong to `obj_knight_lightorb` (`gml_Object_obj_knight_lightorb_Draw_0.gml`) — a different attack. `obj_knight_roaring_fx` is also a SEPARATE roar attack (fires `obj_regularbullet`/`spr_roaring_fire2`) — documented at bottom for reference only; it is NOT type 107.
- Two full-timeline variants exist in roaring2: **`Step_0` (canonical — nothing calls `event_user(0)`)** and `Other_10` = User Event 0 (harder alt; differences noted inline). Below = Step_0 unless marked [ALT].

## COORDINATE / SCALE CONVENTION
Dark-world battle: `scr_darksize()`, camera is 640×480. `fake_x = camerawidth()*0.5 = 320`, `fake_y` starts 24. **Knight core anchor = `(fake_x, fake_y+55)`**. All draw scales of `2` and bullet `image_xscale=2` are the 2× dark render — **HALVE everything for a 320×240 canvas** (scale 2→1, positions ÷2, knight core ≈ (160, 71.5) once fake_y=88). Angles are GML math-convention (0=right, 90=up) on a y-DOWN screen: `lengthdir_y(l,a) = -l*sin(a)`.

---

## FULL TIMELINE (Step_0, `timer` then `roaring_timer`)  — file: gml_Object_obj_knight_roaring2_Step_0.gml unless noted

### CHARGE (timer 0 → intensity reaches 4)   Create_0.gml + Step_0.gml
- **Create** (`_Create_0.gml`): `obj_heart.boundaryup=160`; knight `y-=320` (rises off box); `obj_knight_enemy.chargeupcon=2, chargeuptimer=0`; `scr_script_delayed(scr_lerpvar,20,"darkness",0,1,32)` → screen `darkness` (whole-surface alpha) fades 0→1 over 32 starting frame 20. Init: `intensity=1.5, intensify=1.5, ball_speed=2, player_suck=0.5, knight_sprite=664(=spr_roaringknight_front_filled), knight_sprite_speed=0.5, hsv=128, bobble_amp=4, bobble_freq=1, r=g=b=128`.
- **Every step**: heart hard-clamped inside camera (x: camerax()..+camerawidth()-20; y: cameray()..+cameraheight()-20). `bobble_count += bobble_freq`.
- **timer 30**: `obj_growtangle` (the battle-box bg) lerps `image_xscale→2560/w`, `image_yscale→1920/h` over **160f** ("out") — box swells to fill screen.
- **timer 80**: `fake_alpha` 0→1 over 48; `fake_y` 24→88 over 48 (Knight fades in, drops to core height).
- **timer ≥120**, every 3f while `intensity<3.75`: spawn `scr_afterimage_grow()` ghost of `spr_roaringknight_front_filled`, alpha 0.01→0.35, scale ≈2.2 growing +0.15·min(timer-116,18) then pulsing ×1.2, pinned to knight core. (Throbbing aura.)
- **timer 118**: `ball_darkness` 0→1 over 32 (delay 16).
- **timer 132**: `sound = snd_play_pitch(snd_knight_stretch, 0.1)`; thereafter (`timer>132`) pitch += 0.000535/f — rising strain drone.
- **timer >128** (main charge loop):
  - `intensity = approach(intensity, 4, 0.008)`; `ball_speed = intensity*3`.
  - `player_suck → 1` by 0.1625 (while intensity<3.75), then `→0` by 0.15. Heart pulled toward knight core each frame by `lengthdir(player_suck, dir_to_core)`. **[ALT Other_10: player_suck target = 3 (stronger inward pull).]**
  - every 3f (intensity<3.9): `obj_afterimage_screen` swirl (xrate/yrate -0.01, faderate 0.1/intensity).
  - **timer ≥136 & intensity<3.75, EVERY frame**: white convergence line — `obj_particle_generic`, `spr_pixel_white_front`, spawned 480–560px out at random angle, aimed at core, `image_xscale 320→2 / yscale 2→0.1 / alpha 1→0.5` over 16, lerps into core over 8. (Streaks being inhaled.)
  - **intensity 3.66**: `obj_knight_circle` white flash ring (r/g/b 0→255 over 48, size 480→0), `ball_darkness` 1→0.
  - **intensity 3.74**: `knight_sprite→4961 (spr_roaringknight_front_flourish)`, image 0→4 over 16; `fake_alpha 1→0` over 32 (Knight strobes out at peak).
  - **CHARGE STARS — `attack_timer==4`** (then `attack_timer = floor(-1+intensity)`, so cadence tightens as intensity→4):
    - `rand_dist=600`. If `intensity≥2.7`: `rand_angle+=9`; fire **2** `obj_knight_roaring_star` at `rand_angle` & `+180` (opposed pair), `speed 16, friction -0.1, scale 2, spinspeed 1`.
    - If `intensity<2.7`: `rand_angle+=32`; loop 6× (`rand_angle+=60`) → **6-point ring**, `speed 8+intensity, friction -0.1, scale 2`.
    - (Interior star_angle2/3 blocks are dead — set to -1.)
    - These stars are **inhaled**: while `roaring_timer<1` (Step_0 bottom block) each roaring_star, if `roaring_timer<180`, scales by distance (`0.00588·dist`, min 0.2), spirals toward core tangentially (`dir+90·spinspeed`, step `speed·0.625/intensity`), destroyed when `dist<12`. **[ALT: also sets `speed` dynamically by distance, faster near core.]**
    - **[ALT Other_10 `attack_timer==4`]**: simpler — `rand_angle += 80+irandom(80)`, `rand_dist=600+irandom(80)`; fire ONE live star (`speed 7+rand(2), scale 2, spinspeed ±1`) + ONE inert decoy at `+180` (`image_blend=c_dkgray, active=false, scale 1`). cadence via `attack_timer_goal` approaching 2.

### ROAR (intensity == 4 → `roaring_timer` counts)
- **roaring_timer 9 — THE ROAR HIT**: knight image 4→6; `fake_alpha=1`; `player_suck = -6` (**blowback**), `ball_speed = -32` (flow reverses), `ball_darkness=1`, `bobble_freq 1→3`; **`snd_play(snd_knight_roar)`**; spawn obj 46 ×2 (`scr_script_repeat`); full-white `obj_knight_circle` flash; **fire 8 stars radially** at `a*45°`, `speed 8.5+rand(2)`, scale lerp 0.1→1.2 over 32.
- **roaring_timer ≥9**: `player_suck = min(player_suck,-3)` — sustained outward shove on the heart.
- **roaring_timer 15**: `sprite_index=spr_roaringknight_front_roar`, `knight_sprite=219(roar)`, image_speed 0.5.
- every 3f: `obj_afterimage_screen`.
- **roaring_timer >15, every 5f — MAIN ROAR BULLET-HELL**: `snd_stardrop` (pitch .5, vol .5); `rand_angle += 60+irandom(10)`; fire **3-way fan**: `star_angle1=rand_angle` (speed 6.5+rand), `star_angle2=+20` (8.5+rand), `star_angle3=-20` (8.5+rand); each scale 0.1→1.6 over 32. Rotating spray of aimed star-triples. Runs until roaring_timer **169** [ALT: **181**]. **[ALT fan]**: angles `rand_angle`, `+80+rand(80)`, `-(80+rand(80))` and `rand_angle += 40+irandom(40)` — wider random spread.
- **roaring_timer 181 — FREEZE / ARM**: `colorize=6`; `player_suck→0`, `ball_speed→1`, `bobble_freq 3→1`; `sprite=spr_roaringknight_front_flourish`, `knight_sprite=4961`, image 5.99→0; **every roaring_star gets `friction=0.5` and is queued into `bullet_list`.**
- **roaring_timer ≥182**: pop ONE star from list per frame, set its `con=1` → sequential detonation (see roaring_star below). All queued stars firework one-by-one.
- **roaring_timer 275 — SLASH WINDUP**: `sprite=spr_roaringknight_front_slash`, `knight_sprite=4319`, image 0→2; `bobble_amp 4→0`; `line_timer=0` (aim-line marker appears); color `r/g/b 128→(255,0,0)` over 16 (goes red).
- **roaring_timer 299 — THE CUT**: `do_fake_screen=true`; **`snd_play(snd_knight_cut)`**; knight image 2→5; spawn `obj_roaringknight_slash` at **direction 117°**, `image_xscale=4`, `width*=4`, positioned `(cx+cw*0.5) - lengthdir(-160,117)`; `event_user(0)` on it. Draw_0 then **splits the whole screen into two triangular halves** (`fakey_screen`/`fakey_screen_2` sprites from `terrible_surface`) that fly apart via `scr_marker` (speeds 15/14 → 0.5 then gravity, dirs 180°/0°). **Heart is destroyed.** Knight leaps up (`y` +40 then -320).
- **roaring_timer 363**: `jumpimages=false`; knight returns to `obj_knight_enemy` position; `sprite=spr_knight_warp`, image 5→8 (warp-out).
- **roaring_timer 375 — END**: `obj_knight_enemy.image_alpha=1`; `obj_growtangle.growcon=3` (box shrinks back); **`global.turntimer = -1`** (turn ends). CleanUp frees 4 surfaces, stops `snd_knight_stretch/roar/stardrop/knight_cut`, resets knight `chargeupcon=0`.

---

## obj_knight_roaring_star  (the bullet)  — gml_Object_obj_knight_roaring_star_*
- **Create**: `damage=206, element=5, destroyonhit=false, con=0, splitmax=14, image scale 0`.
- **Movement during ULT**: handled by roaring2 (inhale spiral in charge; free flight during roar; friction 0.5 after 181).
- **con detonation sequence (Step_0.gml)** after `con=1`:
  - con1→`friction=0.5`, con→2.
  - con2→`gravity=0.1` opposite `direction`, decel; `timer≥40 & !split` → `snd_play(snd_explosion_firework)`, con→3.
  - con2.5 (if `split`): sprite→`spr_knight_bullet_star_top`, `splitease` eases out to `splitmax·scale`.
  - con3→grows scale; **`timer==3`: spawn 6 `obj_knight_pointing_starchild`** in a star pattern (angle +66/+57 alternating), each `speed 1, friction -0.1, scale ×0.5, deceleration 0.15`. `timer≥4`→afterimage + destroy.
- **Draw (Other_11)**: 6-point beam glow (`scr_draw_beam_color`, bm_add, dirs 90/156/24/270/336/204), sprite colored `merge_color(gray→red, timer/30)`, pulsing outline.
- **Collision (Other_15)**: hitbox = `2` (or `0` if soul = `spr_dodgeheart_smaller_2px`) via `scr_precise_hit`. **If `obj_knight_roaring2` exists → `obj_knight_enemy.event_user(2)`** (the ULT damage model). Else `target==3` → `scr_damage_all` (else `scr_damage`).
- **event_user(2)** (`gml_Object_obj_knight_enemy_Other_12.gml`): if `global.inv<0`, deals **40** damage to each of the 3 party members (`target=0,1,2`), clamped so a live member can't be one-shot below 1 HP; then `global.inv = global.invc*30`. → In DeltaVersus (`target=3` / all-hit), treat a roaring_star contact as a party-wide 40-per-head hit (raw bullet `damage=206`).

## obj_knight_pointing_starchild  (sparkle shards from detonation)
- sprite `spr_knight_starchild_parts`, `damage=1, element=5, lifetime=60`.
- **During the ULT its homing/attack code is DISABLED** (`Step_0`: whole body gated by `if (!i_ex(obj_knight_roaring2))`). While roaring2 lives they are pure visuals: roaring2 Draw draws them with additive glow outline and **fades them out over frames 45→60 then destroys** (`image_alpha = clamp01(remap(45,60,1,0,timer))`). So in the ULT they are non-damaging sparkle flourishes, not tracking daggers.

## obj_roaringknight_slash  (final screen slash)
- `element=5, width=24 (×4 here =96), aoe=true, active=true`. Draws a red triangular beam 640 long along `direction` (117°), `color rgb(255, (1-α)·255, (1-α)·255)`, alpha·2. `image_yscale 0.1`, grows via alarms.

## obj_knight_circle  (flash rings)  — additive radial gradient
- Draws `draw_circle_color` center→edge `make_color_rgb(r,g,b)`, bm_add. Used for white/growing flash pops (r/g/b lerp 0→255, size lerps). `draw_in_box=false` variants draw full-screen.

## obj_growtangle  (battle-box bg that swells/shrinks)
- `image_blend = merge_color(c_green,c_lime,0.5)`, alpha ~0.3→1. grows (growcon 1) over `maxtimer`, shrinks (growcon 3) at end; leaves afterimage trails.

---

## BACKGROUND / SCREEN RENDER (Draw_0.gml — the psychedelic field)
Rendered on 4 surfaces (ball/star/my/terrible):
- **ball_surface**: `spr_knight_bullet_flow` (320×240) tiled & scrolling `+global.time*2`, drawn 1× normal + 4× additive; then 6 concentric `draw_circle_color` bands (radius `1800-((ball_counter+300a)%1800)`, white→#595959) via `bm_zero/bm_src_color`, plus a 640-radius white→black core. `ball_counter += ball_speed` (wraps 0..1800). = pulsing radial tunnel; `ball_speed` sign flips at roar (flow reverses).
- **my_surface composite**: per-scanline `draw_surface_part_ext` of ball_surface with sine horizontal displacement `sin((a+time)*0.1)*4*intensity + sin((a+time)*0.35)*0.5*intensity`, tinted `make_color_hsv(hsv%255,255,255)`, alpha `ball_darkness`. **`hsv` ping-pongs 128↔288** (cyan↔magenta). Final `draw_surface_ext(my_surface, alpha=darkness)`.
- **spr_knight_line_grate** (320×240) scanline overlay drawn scale 2×2, black, `star_flicker` toggles 0/2 each frame (CRT flicker), color-write on RGB only.
- **KNIGHT RENDER (the shimmering figure)**: per horizontal scanline `a` of `knight_sprite`, `draw_sprite_part_ext(knight_sprite, knight_sprite_image, bbox_left, a, 70,1, ...)` scale **2×2**, with per-line sine wobble `sin((a+time*4)*0.2)*intensify*0.3` (heat-haze) + vertical bobble `sin(bobble_count*0.1)*bobble_amp`, alpha `fake_alpha`. When `intensify>1.5` a second doubled wavier pass at 0.75 alpha. `knight_sprite_image += knight_sprite_speed`.
- **Aim-line marker** (when `line_timer>-1`): `spr_rk_quickslash_marker_gradient` + `spr_rk_quickslash_marker` at screen-center offset `lengthdir(280,-63)`, **angle -63°**, length `line_timer`, width `4+8·(1-min(line_timer,16)/16)`, color `rgb(r,g,b)` (charging red) then black overlay.

---

## SFX (all triggers)
| sound | trigger | notes |
|---|---|---|
| `snd_knight_stretch` | timer 132 | pitch 0.1, ramps +0.000535/f (rising strain) |
| `snd_stardrop` | roar phase, every 5f (>15) | pitch 0.5, vol 0.5 (each fan volley) |
| `snd_knight_roar` | roaring_timer 9 | THE roar |
| `snd_explosion_firework` | each roaring_star con2→3 (detonation) | if `playSound` |
| `snd_knight_cut` | roaring_timer 299 | the screen-cut |
(Stopped in CleanUp: stretch, roar, stardrop, cut. `snd_knight_powerup_white` / `snd_knight_puff` are the roaring_fx variant, not this ULT.)

## ASSETS
**Sprites (REFDATA: frames / w×h / origin):**
- `spr_roaringknight_front_filled` 1 / 70×80 / 35,30 — base charge pose (knight_sprite 664)
- `spr_roaringknight_front_roar` 2 / 70×80 / 35,30 — roar (knight_sprite 219)
- `spr_roaringknight_front_flourish` 7 / 71×82 / 35,32 — peak/arm (knight_sprite 4961)
- `spr_roaringknight_front_slash` 6 / 133×141 / 60,68 — slash windup (knight_sprite 4319)
- `spr_knight_warp` 9 / 100×88 / 0,0 — warp-out
- `spr_knight_bullet_star` 3 / 64×64 / 32,32 (+`_top`,`_bottom` 3/64×64/32,32) — the stars
- `spr_knight_starchild_parts` 2 / 33×32 / 16,16 — sparkle shards
- `spr_knight_bullet_flow` 3 / 320×240 / 0,0 — scrolling radial flow bg
- `spr_knight_line_grate` 1 / 320×240 / 0,0 — scanline grate overlay
- `spr_rk_quickslash_marker` 4 / 250×46 / 125,23  ; `spr_rk_quickslash_marker_gradient` 2 / 250×46 / 125,23 — aim line
- `spr_pixel_white_front` 1 / 4×4 / 4,2 — convergence streaks
**Sounds:** snd_knight_stretch, snd_stardrop, snd_knight_roar, snd_explosion_firework, snd_knight_cut.
**Objects:** obj_knight_roaring2, obj_knight_roaring_star, obj_knight_pointing_starchild, obj_knight_circle, obj_growtangle, obj_roaringknight_slash, obj_afterimage_grow/_screen, obj_particle_generic.

---

## REFERENCE ONLY — obj_knight_roaring_fx (SEPARATE roar attack, not type 107)
Uses `spr_roaringknight_shift_ol`→`spr_roaringknight_pose_ol`, `obj_knight_crush` whiteout, and fires `obj_regularbullet` with `spr_roaring_fire2` (64×64) in `density`-way rings (density 12→6) that curve (`anglechange 6·spin`), speed ~18→8, spin flips each volley, ~30 volleys. SFX: snd_knight_stretch (pitch .75), snd_knight_roar, snd_knight_puff (pitch .15). Not part of the ULT — do not port here unless you specifically want this variant.
