# Roaring Knight — STARS attack (Ch3) — FINE re-extraction v2

Attack = `myattackchoice == 1`, dbulletcontroller `type == 98`, name "Stars".
Objects: `obj_knight_pointing_cone` (the aiming "bow"), `obj_knight_pointing_star`
(the star bullet), `obj_knight_pointing_starchild` (the shards).
All angles GML y-up (0=right, 90=up, 180=left, 270=down). 60 fps.

File roots:
- GML: `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 3 - GML\`
- REFDATA: `C:\Users\lando\Desktop\DELTARUNE - REF DATA\DELTARUNE Chapter 3 - REFDATA\`

---

## 1. BOX (dodge box shape during Stars)  — RESHAPED, not default

`gml_Object_obj_knight_enemy_Step_0.gml`
- L363: box spawned at `(view.x + 320, view.y + 170)`.
- L369-373 (myattackchoice==1):
  ```
  obj_growtangle.maxxscale = 2.25;
  obj_growtangle.maxyscale = 1.75;
  ```
  Default growtangle is `maxxscale = 2, maxyscale = 2` (`gml_Object_obj_growtangle_Create_0.gml` L13-14) → 150x150.

`gml_Object_obj_growtangle_Step_0.gml` L3-15 customBox path (triggered because scale != 2/2):
- L8-12 snap: non-even scales get `round(scale*37.5)/37.5`.
  - 2.25 → round(84.375)/37.5 = 84/37.5 = **2.24**
  - 1.75 → round(65.625)/37.5 = 66/37.5 = **1.76**
- Base hitbox sprite `spr_battlebg_stretch_hitbox` = 75x75 (sprites.tsv L3277).
- Full-grown box = 75*2.24 x 75*1.76 = **≈168 wide x ≈132 tall** (WIDE, SHORT letterbox).
  Half-extents ≈84 px horiz, ≈66 px vert from center (view.x+320, view.y+170).

Porter fix: box is NOT the default square — it is a wide/short 2.24 x 1.76 (≈168x132) box.

---

## 2. POINT ANIMATION — the cone / "purple sideways rhombus"

Object `obj_knight_pointing_cone`. Create: `target_angle = 60`, `angle = 0`,
`image_xscale/yscale = 2`, `endtimer = 120`.
Sits at `growtangle.x + 115, growtangle.y - 56` (Step L39-40, ease-out tween in).
Apex ("hand") of the fired shape = `screenx(x + 22), screeny(y + 56)`.

DRAW (`..._cone_Draw_0.gml` L93-104): it is a **triangle fan (pr_trianglelist), not a
sprite rhombus** — a filled cone pointing at **180° (left, toward the box)**, textured by
`spr_knight_bullet_flow` (frame 0 bg + frame 1 lines, both scrolling left, alpha-tested/masked
to the triangle) → the flowing purple wedge. Fill color = `merge_color(c_white, c_black, angle/target_angle)`.
- half-spread each side = `_angle/2`, where `_angle = angle + draw_angle` (`draw_angle` toggles 0/1 each frame = jitter).
- edges: `lengthdir(600, 180 ± _angle/2)` from apex. Cone length = 600 px.

SPREAD growth `angle` (0 → target_angle=60), Step L74-92:
- Widening phase (`global.turntimer > endtimer`, L84-88):
  `angle_lerp = movetowards(angle_lerp, 1, 0.025)` then
  `angle = lerp(0, 60, scr_ease_out(angle_lerp, 6))`.
- Finale phase (`global.turntimer <= endtimer`, L47-83): when `angle_lerp == 1` it LAUNCHES all
  stars (see §3/§4), then closes: `angle_lerp = movetowards(angle_lerp, 0, 0.1)`,
  `angle = lerp(0, 60, scr_ease_in(angle_lerp, 6))`.
- Once fully open before finale: `x += 0.25` drift (L91).
Stars fire within this cone: `_dir = 180 + special * bulletmaker.angle`, `special ∈ [-0.5, 0.5]`
(dbullet L2007) → star spread tracks the cone's half-angle exactly.

Knockback/shake on box (Step L94-107): on launch `knockback=10`, decays 0.5/frame with ease;
otherwise box nudged `gt_x -= angle/target_angle/2` and fake_gt jitter.

---

## 3. STAR MOTION — EXACT (obj_knight_pointing_star)

Spawn (dbullet type98, `..._dbulletcontroller_Step_0.gml` L1986-2028):
- `d.speed = lerp(10, 5, size)`, `size = random_range(0.5,1)` first star then evolves →
  **initial speed ≈ 5.0–7.5** (10 only at size 0).
- `d.direction = 180 + special*angle` (aimed left into the cone spread).
- `d.grow_Speed = lerp(0.1, 0.25, size)` — **DEAD VARIABLE. `grow_Speed` is never read anywhere.**
  Actual scale growth uses the constant `growspeed = 0.02` (Create L2). Porter trap: do NOT use grow_Speed.

Create (`..._star_Create_0.gml`): `growspeed = 0.02`, `image_xscale/yscale = 0`, `friction 0`,
`rotation = 0`, `dir = choose(-1,1)` (rotation & dir are set but NEVER used → **no spin**).

Step (`..._star_Step_0.gml`) con state machine:
- con 0 (L20-24): flies at spawn speed & direction; `image_xscale += 0.02; image_yscale += 0.02`
  each frame (grows). No friction yet. (This is the charging fly-out while cone aims.)
- con 1 (L25-29): set by the CONE FINALE (`with(obj_knight_pointing_star) con=1`, cone Step L53-57)
  → `friction = 0.5; con++` (same frame). All stars enter this together.
- con 2 (L30-57): friction 0.5 decelerates speed → 0.  **When `speed == 0`:** `gravity = 0.1`,
  `gravity_direction = direction - 180` (**REVERSES** — star then drifts slowly back toward the knight),
  `friction = 0`. `timer++`; at `timer >= 40` → con 3 (+`snd_explosion_firework` if playSound).
- con 3 (L58-138): explosion. scale ramps `growstart + clamp01(timer/2)`; at `timer==3` spawns shards;
  at `timer>=4` `instance_destroy()`.

Per-frame summary: decelerate by friction 0.5 to a full stop, then gentle 0.1/frame reverse drift for the
remainder of a 40-frame timer, then detonate. **No image_angle rotation at any point** (star stays upright,
merely reddening: draw color `merge_color(c_gray, c_red, clamp01(timer/30))`, Draw L6).

---

## 4. EXPLODE — synchronized, shard counts, P3 red homing

WHEN: All stars are set to con=1 in the SAME frame by the cone finale (`angle_lerp==1`), so they all
detonate **together ~40 frames later** (con2 timer=40). NOT individually timed.

Shard spawn loop (star Step L75-125) — ALWAYS iterates i=0..5 (6 spawns) but content varies:
- **P1 (difficulty 0): 3 real shards.** i%2==1 (i=1,3,5) → `speed=1, lifetime=30` (weak/short);
  i even (i=0,2,4) → `speed=4`. Net = 3 main fast shards + 3 weak.
- **P2 (difficulty 1): 6 shards**, all `speed=4` (the diff0 weak-branch condition is false).
- **P3 (difficulty 2): 2 real shards.** (i%3)>0 (i=1,2,4,5) → trail deco (`difficulty=-1`, reduced
  speed, `spr_knight_starchild_trail`); i=0,3 → the 2 real homing shards (`difficulty=2`).
- Every shard: `deceleration = 0.15`, `image_angle = direction = _angle` starting 90° then +48/+66 fan
  (diff2 uses side + 180/0), scale = star scale * 0.5.

Shard motion (`..._starchild_Step_0.gml`, `_Create_0` defaults: minspeed=1, lifetime=60, accel N/A):
- All: decelerate `speed → minspeed(1)` at 0.15/frame.
- **P1/P2 (difficulty<2): NO homing, NO red.** delay=0 so con stays 0 → just drift out and fade
  (Draw L31-37: alpha fades over the last 15 frames of lifetime 60 (weak=30), destroy at alpha 0).
- **P3 (difficulty>=2): turn RED and home on soul, STAGGERED (not all at once).**
  - Init L5-24: `delay = 25` + accumulated per-bullet delay via obj_dbulletcontroller subdelay
    counter → each shard activates at a different time (intentionally staggered).
  - con1 (10f): morph, turns red (`outline = merge(c_black, c_red, ...)`, blend white→black).
  - con2 (10f): track `obj_heart_follower`, rotate `direction` toward it at 2°/frame.
  - con3 (FIRE): `speed = scr_movetowards(speed, 25, 0.5)` — **ramps to max 25 gradually at 0.5/frame
    (~48 frames), NOT instant**; red afterimages (`image_blend=c_red`).
  - con4: explode `spr_thrash_missile_explosion` 4 frames then destroy.
  - Recoil before firing (L130-136): while `ease<40`, pulled backward `(1-ease/40)*2` px/frame for 40 f.
  Porter bug: P3 shards should ramp to 25 (not spawn at max speed) AND be staggered by per-bullet delay,
  not fire in unison.

---

## 5. TIMING

- `scr_turntimer(240)` for Stars (myattackchoice==1 hits the `else` branch, knight_enemy Step L597-598).
- dbullet type98 init (L1955-1967): `global.turntimer += 30` (always); difficulty>=2 also `+= 60`.
  `endtimer = 120` (difficulty>=2: `endtimer = 210`; bulletmaker.endtimer set to match).
- Total turn length: **≈270 frames (~4.5 s) on diff 0/1; ≈330 frames (~5.5 s) on diff 2.**
- Star spawning STOPS when `global.turntimer <= endtimer+1` (init=3, L1977-1980).
- Cone finale/launch fires at `turntimer ≈ endtimer (=120)`; stars detonate ~40 f later (~turntimer 80);
  shards persist up to `lifetime` (≈60 f, P3 longer via con chain) → gone ~turntimer 20.
- The ~120-frame (≈2 s) tail between `endtimer` and turn end (turntimer 0) exists SPECIFICALLY so the last
  explosions and shards play out. **Porter bug: ending the attack at the last explosion cuts this 2 s tail
  and clips the shards** — the turn must keep running until turntimer hits 0.

---

## 6. SFX (exact snd_ + trigger)

- `snd_knight_drawpower` ×3, pitch 1.3 — cone Step L3-8 at `timerb == 3` (attack start / draw-power).
- `snd_rocket_long`, pitch 0.6 — cone Draw L68 when charge completes (`con`→2, timer>=30).
- `snd_stardrop`, pitch 0.5, volume 0.5 — dbullet L1989-1990, on EACH star spawn.
- `snd_explosion_firework` — star Step L49, on EACH star detonation (con2→3) IF `playSound`
  (odd-index stars set `playSound=false`, cone Step L66-68, so ~every other star sounds).
- `snd_knight_star_explosion_close` ×3 (a=2, b=0.7) — cone Step L10-17 at `timerb == 120` (the big finale hit).

---

### KEY NUMBERS
1. BOX 2.24 x 1.76 scale (snapped from 2.25/1.75) on 75px base = ≈168 x 132 px wide/short; default is 2/2=150x150.
2. Cone = pr_trianglelist wedge at box.x+115/y-56, apex (x+22,y+56), dir 180°, len 600, spr_knight_bullet_flow texture; target_angle 60; open: angle_lerp+=0.025, angle=lerp(0,60,ease_out(al,6)); close: al-=0.1, ease_in.
3. Star init speed lerp(10,5,size)≈5-7.5; friction 0.5 to stop then gravity 0.1 dir-180 (reverses); grow=growspeed 0.02 const (grow_Speed is DEAD); NO image_angle rotation ever.
4. All stars con=1 in one frame → detonate together ~40f later. Shards: P1=3(speed4)+3weak(sp1,life30), P2=6(sp4), P3=2 homing(+4 trails). P3: staggered delay, red, speed ramps to 25 @0.5/f (not instant).
5. Turn = scr_turntimer(240)+30 ≈270f (~4.5s) diff0/1; ≈330f diff2. Spawn stops at turntimer≤endtimer(120). ~120f (2s) tail after endtimer for shards — don't cut it.
6. SFX: knight_drawpower×3 p1.3 @start; rocket_long p0.6 @charge; stardrop p0.5 v0.5 @each spawn; explosion_firework @each detonation (odd stars muted); knight_star_explosion_close×3 @timerb120.
