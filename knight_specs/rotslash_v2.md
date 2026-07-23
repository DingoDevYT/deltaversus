# Roaring Knight — ROTATING SLASH (attack type 104) — GML re-extraction v2

Source (Chapter 3 GML, all events read):
- `obj_knight_rotating_slash` — Create_0, Step_0, Alarm_1, Alarm_2, Alarm_3, Draw_0, Other_10 (User Event 0), CleanUp_0
- `obj_roaringknight_slash` (the cut beam) — Create_0, Alarm_0, Alarm_1, Step_2, Draw_0, Other_15 (User Event 5)
- Helpers: `scr_get_box` (box edges), `scr_darksize` (2x scale)

Path root: `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 3 - GML\`
GML angles are y-up (deg CCW). `scr_get_box`: 0=RIGHT, 1=TOP, 2=LEFT, 3=BOTTOM, 4=cx, 5=cy.

---

## 1. THE RED LINES / beam length (Q1) — always full-span, fixed constants

Two different draws, BOTH use fixed lengths independent of the aim center, so they ALWAYS
span the whole box no matter where the cut is centered. Porter bug = clipping to box edge
relative to center instead of using the fixed ±constant.

### (a) The actual CUT BEAM — `±640` (1280 px total)
`gml_Object_obj_roaringknight_slash_Draw_0.gml:1-2` and the mirrored copy in
`gml_Object_obj_knight_rotating_slash_Draw_0.gml:62-63`:
```
var hx = lengthdir_x(640, direction);
var hy = lengthdir_y(640, direction);
```
Beam is a triangle: apex at `x - hx*image_alpha`, base corners `x + hx ± hxoff` where
`hxoff = lengthdir(width, direction+90)`. So it reaches **640 px each way from center → 1280 total**,
a hard constant. The box is at most ~a few hundred px wide, so ±640 ALWAYS overruns both
edges → the cut spans the full box every time regardless of `aim_x/aim_y`.

### (b) The grey→red TELEGRAPH LINES — `±320` (640 total)
`gml_Object_obj_knight_rotating_slash_Draw_0.gml:32-33` (line2) and `:49-50` (line3):
```
var dirx = lengthdir_x(320, dir);
var diry = lengthdir_y(320, dir);
```
Twin lines drawn ±320 along `dir`, offset perpendicular by `lengthdir(line2*6, dir+90)`,
sliding apart over 8 frames (`line2`/`line3` count 0→7, alpha `1-(line2/7)`). Fixed ±320 → full span.

---

## 2. SFX — EXACT names + event/frame (Q2)

| When | GML | snd_ (exact) |
|------|-----|--------------|
| Telegraph loop START (each aim) | Step_0:213-214, state=="aim" timer==1 | `snd_stop(snd_knight_rotatingslash_line)` then `snd_loop(snd_knight_rotatingslash_line)` |
| Loop STOP (each slash fires) | Step_0:293, state=="slash" timer==1 | `snd_stop(snd_knight_rotatingslash_line)` |
| THE CUT | Step_0:300, slash timer==1 | `snd_play(snd_knight_cut)` |
| Firework/explosion (with the cut) | Step_0:301, slash timer==1 | `snd_play(snd_explosion_firework)` |
| FINALE start (P3 flurry) | Step_0:453-454 | `snd_play(snd_knight_puff)` + `snd_play_x(snd_knight_teleport, 1, 0.5)` (pitch/vol 1, 0.5) |
| Cleanup safety stop | CleanUp_0:14 | `snd_stop(snd_knight_rotatingslash_line)` |

Note: `snd_knight_cut` (NOT snd_knight_cut2). Firework is `snd_explosion_firework` (NOT `_bc`).
Loop starts on EVERY aim entry and stops on EVERY slash — one continuous rising-line whine per telegraph.

---

## 3. Cut counts per phase + timing (Q3) — CONFIRMED

Sequence per turn = `[initial slash_number, slash_array[1], slash_array[2], ... slash_array[5]]`.
IMPORTANT: `slash_array[0]` is NEVER used as a count — the first cut uses the initial
`slash_number`, and cooldown does `slash_counter++` (→1) BEFORE reading the array.

Phase = `difficulty` (set by manager before User Event 0 = Other_10):

- **P1 (difficulty 0** — Create defaults, Other_10 does NOT override):
  `slash_number=1`, `slash_array=[1,2,2,3,3,4]` (Create_0:5,21-26) → **1-2-2-3-3-4** ✓
- **P2 (difficulty 1** — Other_10:1-11): `slash_number=3`, `slash_array=[2,3,4,4,4,4]` → **3-3-4-4-4-4** ✓
- **P3 (difficulty 2** — Other_10:13-23): `slash_number=3`, `slash_array=[3,4,4,4,4,4]` → **3-4-4-4-4-4** ✓

(Create_0 sets difficulty=2 by default but the spawning manager overwrites it per phase.)

### State machine timing (Step_0)
- **intro**: `timer++` until `timer>16` → aim. **= 17 frames** (Step_0:196-205).
- **aim** (telegraph/rotate): duration **= slash_base + slash_offset + 6** frames (Step_0:280 → slash).
  - `timer==1`: start loop sfx, `r=g=b=128` grey, pick new random movebox pos, lerp x/y there
    over `(slash_base+slash_offset)-8` frames (Step_0:211-241).
  - `aim_direction += rotation*spin` every frame; `rotation` decelerates `rotation_base=16` →
    `rotation_goal=2` by `rotation_change=1`/frame (Step_0:244-245). `spin = choose(-1,1)`, `random_offset = irandom(360)`.
  - marker frame bump at `timer==floor((slash_base+slash_offset)*0.5)`; `image_speed=0.5` at `timer==slash_base+slash_offset`.
  - `slash_base` starts 18 → approaches 15 by 1 per cooldown; `slash_offset` starts 6 (P1) → approaches 0 by 6 (P2/P3 already 0).
  - So aim length: P1 ≈ 30,24,23,22,21,21 ; P2/P3 ≈ 24,23,22,21,21,21 frames.
- **slash**: `timer==1` clears list, adds `slash_number` dirs `((360/(slash_number*2))*a)+random_offset+aim_direction`,
  shuffles, spawns beams + plays cut/firework; one beam spawned per frame from list;
  `timer==slash_timer` (=8) → cooldown (Step_0:287-423).
- **cooldown**: advance at `timer==cooldown_time` (=6) OR `local_turntimer<200`; then `slash_counter++`,
  update slash_number/base/offset (Step_0:426-439).
- Turn budget `local_turntimer` (Other_10): full=400, start=320, end=300, short mid/end=260, short start=270.
  When it drops <200 the six slashes are declared done (`slashes_done=true`, Step_0:441-444).

---

## 4. FINALE (P3 / difficulty 2, turn_type=="full") — spiral of center cuts (Q4)

Triggered after the 6 slashes when `slashes_done && difficulty==2 && turn_type=="full" && do_final`
(Step_0:449-473). Setup:
- SFX `snd_knight_puff` + `snd_knight_teleport` (Step_0:453-454).
- `obj_afterimage_screen` faderate 0.05 (screen smear).
- `slash_number=1`, `slash_base=24`, `cooldown_time=2`, `slash_timer=2`, `do_final=false`.
- `aim_x/aim_y = box CENTER` (`mean(box2,box0)`, `mean(box1,box3)`).
- `rotation_base=18`, `rotation_change=0.5`.
- `aim_type` ramps 0→1→2 by scr_approach(...,2,1): ONE aim pass happens with `aim_type==1`
  (sets `line2=0`, `alarm[1]=4` → line3 telegraph), then becomes 2 (Step_0:502-513).

### Count & cadence
- `aim_type==2` cooldown branch (Step_0:516-557): each cut goes state="slash" DIRECTLY (no aim),
  `aim_direction += speed_gain*spin`, `speed_gain` ramps 16→24 by +1/cut, `final_counter++`.
- Cadence = `slash_timer(2) + cooldown_time(2)` = **~4 frames per cut**, each rotated 16→24° from the last (a tightening spiral).
- Ends when **`final_counter == 28`** (Step_0:524) → **≈28 center cuts total**.

### WARNING / TELL time (the port under-warns)
- Only the FIRST finale cut gets a full telegraph: the single `aim` pass at `slash_base=24` →
  aim length **= 24 + 0 + 6 = 30 frames** of `spr_roaringknight_flurry_prepare` windup +
  the grey→red spinning line (line2/line3).
- Cuts 2–28 have NO per-cut aim state — they fire back-to-back every ~4 frames; the beam itself
  is the only tell. The beam is lethal only briefly: mask removed at frame 3 (`obj_roaringknight_slash`
  Alarm_1 `mask_index=spr_nomask`) and it shrinks `width*=0.66`/frame, going inactive at `width<12`
  (~3–4 frames). Port must reproduce the fixed ±640 full-span beam + the 30-frame flurry_prepare
  pre-spiral tell so the spiral reads, rather than clipping/rushing.

### Knight on-field animation (whole attack)
- Main 6 slashes: object sprite **`spr_roaringknight_attack_ol`** (id 2128, 6 frames);
  `image_index` walks 1→up, `image_speed=0.5`, clamped at frame 5 while `aim_type!=2` (Step_0:190-194, 264, 271).
  Knight teleports (obj_knight_warp) to a fresh random movebox spot each aim; afterimage every 4 frames (hspeed 4).
- Finale windup: **`spr_roaringknight_flurry_prepare`** (id, 1 frame) set at aim timer==1 (Step_0:236),
  then delayed swap to **`spr_roaringknight_flurry`** (id 3329, 3 frames) with `image_speed=1` at aim timer==24 (Step_0:275-276).
- Finale spiral: **`spr_roaringknight_flurry`**, `image_speed=1` (3-frame loop = the "crazy slashing" anim), Step_0:546-547.
- Return (final_counter==28 or normal end): sprite → **`spr_roaringknight_attack_ol`** (2128),
  image_index 0, image_speed 0; lerp back to anchor over 12 frames; `alarm[3]=22` destroys (Step_0:526-540, Alarm_3).

---

## 5. Colors / scales / damage (Q5)

### Telegraph color ramp (grey → red)
- Set grey at aim timer==1: `r=128, g=128, b=128` (Step_0:218-220).
- Each later frame: `r→255`, `g→0`, `b→0` via `scr_approach(_, _, 9.142857142857142)` (=64/7 per frame) → full red in ~7 frames (Step_0:259-261).
- Markers: `spr_rk_quickslash_marker_gradient` drawn `make_color_rgb(r,g,b)` under `spr_rk_quickslash_marker` (c_black on top). Draw_0:12-23.
- Twin lines drawn in the same `make_color_rgb(r,g,b)` grey→red.

### Cut color (red → white fade)
- `color = make_color_rgb(255, (1-image_alpha)*255, (1-image_alpha)*255)` with `draw_set_alpha(image_alpha*2)`
  (obj_roaringknight_slash Draw_0:5-6; mirror Draw_0:66).
- image_alpha starts 1 → pure **RED (255,0,0)**; as it fades toward 0 → **WHITE (255,255,255)**. Beam shrinks as it whitens.

### Scales
- `scr_darksize()` → `image_xscale = image_yscale = 2` (2x asset; halve for a 1x port). Create_0:2.
- Beam bullet: `image_xscale=2`, `width` = 24 → `*2` = **48**, `image_yscale=0.1` (Create + spawn Step_0:311,314; slash Create width=24).
- Marker scale `1 + 2*(1 - timer/(slash_base+6+slash_offset))` → ~3 shrinking to 1 (Draw_0:16,22).
- Slash-mark particles: red `spr_knight_slash_mark` xscale `5+random(3)` yscale `2+random(1)`, plus black underlay, lerp to 0 over 4 frames; spray particles xscale 0.3/yscale 0.15.

### Damage
- `obj_roaringknight_slash`: base `damage=206`, `grazepoints=50`, `element=5` (Step_2:1-2, Create).
- On hit (Other_15 / User Event 5): `aoe==true` → **`damage = 75`**, `target=3` → `scr_damage_all()` (AOE hits everyone). `obj_knight_enemy.aoedamage` toggled. Other_15:1-25.

---

## KEY NUMBERS (porter checklist)
```
CUT BEAM length ...... lengthdir(640, dir) → ±640 = 1280px, FIXED (never clip to box) → always full-span
TELEGRAPH lines ...... lengthdir(320, dir) → ±320 = 640px, FIXED; twin lines slide apart over 8f (alpha 1-n/7)
SFX aim loop ......... snd_stop+snd_loop(snd_knight_rotatingslash_line)  @ aim timer==1
SFX cut+firework ..... snd_play(snd_knight_cut) + snd_play(snd_explosion_firework)  @ slash timer==1
SFX finale ........... snd_play(snd_knight_puff) + snd_play_x(snd_knight_teleport,1,0.5)
CUT COUNTS  P1 ....... 1-2-2-3-3-4   (diff0: slash_number=1, array[1,2,2,3,3,4], array[0] unused)
CUT COUNTS  P2 ....... 3-3-4-4-4-4   (diff1: slash_number=3, array[2,3,4,4,4,4])
CUT COUNTS  P3 ....... 3-4-4-4-4-4   (diff2: slash_number=3, array[3,4,4,4,4,4])
TIMING ............... intro 17f | aim = base+offset+6 (P1~30→21, P2/3~24→21) | slash_timer 8 | cooldown 6
ROTATE ............... aim_direction+=rotation*spin; rotation 16→2 by 1/f; finale base18 change0.5; spin ±1; offset irandom(360)
FINALE count ......... final_counter==28 → ~28 center cuts, cadence ~4f (slash_timer2+cooldown2), spiral speed_gain 16→24
FINALE warning ....... ONLY first cut telegraphed: 30f flurry_prepare + grey→red line; cuts 2-28 = no aim, beam-only tell (~3f lethal)
KNIGHT anim .......... main: spr_roaringknight_attack_ol (2128, 6f, idx1→5 spd0.5) | windup: spr_roaringknight_flurry_prepare
                       spiral: spr_roaringknight_flurry (3329, 3f, spd1) | return: spr_roaringknight_attack_ol
COLOR telegraph ...... grey (128,128,128) → red (255,0,0) via approach 64/7 per frame (~7f)
COLOR cut ............ red (255,0,0) at alpha1 → white (255,255,255) as alpha→0; draw alpha = image_alpha*2
SCALES ............... darksize xscale=yscale=2 (halve for 1x); beam width 24*2=48, yscale0.1, xscale2; marker scale 3→1
DAMAGE ............... AOE 75 (base 206 → 75 when aoe, target=3 scr_damage_all), grazepoints 50, element 5
```
