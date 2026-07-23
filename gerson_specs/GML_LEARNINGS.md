# GML PORTING — LEARNINGS (how to read the GML right & not miss things)

Running log so accuracy stays high. Read the WHOLE object (every event) before porting; port from the CODE, not
a summary or the wiki's shape. When a value "feels" arbitrary, it's in the GML — go find it.

## Systematic checklist for porting ANY attack/mechanic
1. **List every event** of the object (`Glob gml_Object_<obj>_*.gml`) and READ them all — Create, Step, Step_1/2,
   Draw, Alarm_N, Other_10..25 (event_user0..15), CleanUp. The Draw often holds the REAL visuals + sub-animation.
2. **Find who spawns it** and with what per-instance overrides (grep the enemy / controller / `scr_*` for
   `instance_create(... obj_X)` and the lines right after — they set speed/scale/direction/damage PER ATTACK).
3. **Scale**: `scr_darksize()` sets image_xscale = **2** (the Dark World baseline). GML `image_xscale = N` is
   RELATIVE to that — do NOT read it as an absolute. Halve when porting (our drawSpr already ×1.6).
4. **Velocity/speed is usually PER ATTACK** — spears/shells get their speed+frames from the attack's list
   (`scr_spearshot(dir, speed, frames, special, special2)`; `len = speed*frames`). Read the attack table, not a constant.
5. **Colors** are BGR ints: R=int&255, G=(int>>8)&255, B=(int>>16)&255. `make_color_rgb` + `#RRGGBB` are already RGB.
6. **GM angles are y-UP**: dir 0=right,90=UP,180=left,270=DOWN. Canvas is y-down: vx=spd*cos(dir°), vy=-spd*sin(dir°).
   gravity_direction 270 = DOWN (canvas +y). `lengthdir_y(d,a) = -d*sin(a)`.
7. **Sub-animations / squash-stretch**: look in Step & Draw for `scr_lerpvar("image_xscale", ...)`, `spinindex`,
   `image_speed`, `scr_script_delayed(...)`. These are the juicy details (shell squash, star scale-in, trail shrink).
8. **Sounds**: every event plays specific `snd_*`. Map each to a REGISTERED manifest.sfx key (or import it) — a
   wrong/absent key = silence. Note the exact event that triggers each.
9. **Easing, not snapping**: rotations/positions usually EASE (`scr_approach`, `lerp`, `repeat(rep){ +=1 }` where
   `rep = ceil(|angdiff|*k)`). Snapping instantly is almost always wrong.
10. **Masking**: red-soul slashes/telegraphs are drawn CLIPPED to the battle box and span it fully (stencil/clip).

## GERSON-specific facts learned
- **Green soul aim (obj_spearblocker Draw)**: input sets `idealdir` (4-dir, or 8-dir when `diagonal_enabled`).
  The axe `image_angle` EASES toward idealdir: `rep = ceil(abs(angle_difference(idealdir,image_angle))*0.666)`
  then rotates 1deg/iter → ~0.666 of the remaining angle per frame (reaches target in ~4 frames). The BLOCK uses
  the axe's CURRENT (rotating) image_angle, so you can block mid-rotation = frame-perfect skilled play.
  `just` (parry window) = `justlength` (4, +2 if two keys) set on a direction PRESS; decrements in Draw.
- **Block visuals**: event_user0 = `image_angle=idealdir; flash=5` (block-flash frame for 5f). event_user1 (PARRY)
  = `repeat(3) instance_create(x + lengthdir(36, image_angle-30+irandom(60)), ..., obj_shield_just_particle)` →
  3 light sparks at radius 36, spread ±30° around the axe, moving in idealdir. event_user2 = the green RING drawn
  as 4 d_lines, sidelength `lerp(28,33)` (so the visible ring ~28-33px, INSIDE the block radius 36/46 — the axe
  blade sits at 36, on the ring's outer edge).
- **Block geometry (obj_spearshot Other_10)**: block when `len < shieldradius` (36 4-dir / 46 8-dir/diag) AND
  `abs(angle_difference(image_angle, shielddir)) < shieldlength` (50 4-dir / 30 8-dir). shielddir = blocker
  image_angle+180. Heart hit at `len < 16`. Parry heals 2.5 TP (scr_tensionheal), normal block 1.25.
- **scr_darksize = image_xscale/yscale = 2.** (Baseline. Spears & shells were 2x too big because I read scale as absolute.)
- **Shell (obj_spearshot bouncespear) block**: `if(shake!=5) hp--`; hp>1 bounces (squish sprites + fakespeed
  negative + grav, ~34f), hp==1 (yellow) = final, no bounce → destroy. SPINNING shell rotates return dir +90 CCW
  via `_savedir = lerp(savedir+180, savedir+270, t)` over the bounce duration (NOT instant — it's animated).
  Colors by hp (BGR→RGB): 1 yellow, 2 green, 3 cyan, 4 purple, 5 red, 6-8 pink. Parry sfx = snd_parry_fast_nodelay.
- **Shell PINBALL (obj_gerson_shell_pinball)**: full logic in Step_0 (511 lines). Star trail = spr_thrash_star
  every 4f, full size to f22 then scale→0 by f26 (~6 alive). Bounce top/bottom only (squash x1.5/y0.5), pass
  through sides, Gerson knockback (counter<7 aim player speed→15, else top-smash). Break = 4-fan star fountain,
  fire UP + gravity DOWN, RANDOM dir/speed jitter, normal(1.5)+small(1.0) variants, hspeed*=0.5.

## Mistakes I made (don't repeat)
- Ported the pinball from a wiki sentence + aliased it to a different attack. WRONG — read the 511-line Step.
- Read `image_xscale` as absolute (everything 2x too big). It's relative to scr_darksize's 2.
- Snapped the axe angle instantly (should ease 0.666/frame). Snapped shells' 90° turn (should animate over the bounce).
- Drew the visible ring at the block radius; real ring is smaller (28-33), axe sits OUTSIDE it on the block radius.
- Assumed sprite anchors are centered (hair pivot is the sprite's LEFT edge). Check sprites.tsv origin.
