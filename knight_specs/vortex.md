# Knight — "Sword Vortex" (obj_dbulletcontroller type 154)

Exact port spec from decompiled DELTARUNE Ch3 GML. All coordinates GM y-DOWN unless noted.
GM angle convention: `lengthdir_x(r,a) = r*cos(a)`, `lengthdir_y(r,a) = -r*sin(a)` (screen y-down: +y is down, so lengthdir_y already returns downward-negative). image_angle in degrees CCW.

## WHAT IT IS
A rotating **ring of swords orbiting the battle-box center**. Swords spawn in opposite-side pairs at fixed angles (0° and 180°), fade in, and continuously **spin clockwise** around the center while the **orbit radius pulses in/out** on a sine wave (breathing vortex). In the difficulty-3 variant used here, the **orbit CENTER itself wanders randomly** around the box every 60 frames. NO net inward spiral at variant 3 (shrinkrate=0); the ring holds its average radius. Swords persist (do not destroy on hit) for the whole turn. Runs alongside a separate "tracking swords" manager (type 151, diff 0) — out of scope here.

## SPAWN / OWNERSHIP
- `obj_knight_enemy` Step_0 line 527-539 (myattackchoice==15): creates `obj_dbulletcontroller` with `type=154, difficulty=3, damage=206`; also a type 151 diff 0 dmg 206 tracking-swords controller; `global.invc=0.4`.
- Turn length: `scr_turntimer(300)` — obj_knight_enemy Step_0 line 595-596 → **300 frames**.
- `obj_dbulletcontroller` Step_0 line 2952-2961 (type 154): once, `instance_create(obj_growtangle.x, cameray(), obj_sword_vortex_manager)`; `scr_bullet_inherit(_manager)`; `_manager.variant = difficulty (=3)`; `_manager.damage = damage (=206)`.

## MANAGER — obj_sword_vortex_manager (invisible, no Draw)
### Create (gml_Object_obj_sword_vortex_manager_Create_0.gml)
- L1-25 defaults: timer=0, siner=0, sinpower=65, sinspeed=24, startinglen=70, shrinkrate=0, multiswordmax=0, movespeed=60.
- L19-22: **orbit center = box center** `swordcirclecenterx/y = obj_growtangle.x / .y` (overrides the cameray() spawn y). startx/starty = that.
- L27-28: setdirection[0..49] = -1 (sentinel "use random").
- **variant==3** (L87-106, the one used): rate=11, ratedecay=0, rateminimum=1, maxswords=6, multiswordmax=2, multiswordframes=1, sinpower=17, sinspeed=22, startinglen=80, setdirection[1..6]={0,180,0,180,0,180}, **centermoves=1**, movespeed=60. (shrinkrate stays 0.)
- L108: `timer = rate - 5` = 11-5 = **6**.

### Step (gml_Object_obj_sword_vortex_manager_Step_0.gml)
- L1-2: timer++, siner++ (siner drives the shared radius sine for all swords).
- L4 spawn condition: `(timer==rate && swordcount<maxswords) || (timer==multiswordframes && multiswordcon==1)`.
- L6-16: create `obj_sword_vortex` at box center; set dir=choose(0,45,...,315) then **overridden** by setdirection[setcount] (L19-20) → 0/180 alternating; pass variant, sinpower(17), sinspeed(22), len=startinglen(80), lenstart=len, shrinkrate(0), damage(206), target. swordcount++, setcount++.
- L22-32 multisword logic: multiswordmax=2 → after first spawn multiswordcon flips 1, so the *next* frame (timer==multiswordframes==1) spawns the partner; after 2 the pair counter resets and it waits `rate`(11) again. Net cadence: **pairs of 2 swords 1 frame apart, pairs 12 frames apart** (11 + 1), 3 pairs → **6 swords total**, then stops (swordcount==maxswords).
  - Cadence timeline (approx): pair1 ~frame 5 & 6, pair2 ~frame 17 & 18, pair3 ~frame 29 & 30. All 6 swords up by ~frame 30.
- L34-38: on spawn, place sword at `xstart+lengthdir_x(len,dir)`, `ystart+lengthdir_y(len,dir)`, image_angle=dir-90.
- L41-44: rate -= ratedecay(0) (no change; clamp to rateminimum 1).
- **Center wander** (centermoves==1, L49-71): when idle picks new target `targetx=(box.x-60)+irandom(120)`, `targety=(box.y-60)+irandom(120)` (uniform in a 120×120 box centered on box), then LERPs center from start→target over movespeed=60 frames (`t=centermovestimer/60`); on arrival resets and picks again. Continuous random walk of the whole vortex, one 60-frame leg at a time.

## SWORD — obj_sword_vortex (obj_regularbullet child)
### Create (gml_Object_obj_sword_vortex_Create_0.gml)
- image_alpha=0, dir=0, spinspeed=4, len=70, lenstart=len; damage=10, grazepoints=2, destroyonhit=0, timepoints=1, speedtowardscenter=0.4 (unused). scr_bullet_init() sets destroyonhit→1 first then this event/manager set values that matter: **destroyonhit=0** (persistent), damage overwritten to 206 by manager, len/lenstart/sinpower/sinspeed/shrinkrate overwritten by manager (80/80/17/22/0).
- No scale set anywhere → **image_xscale=image_yscale=1** (native sprite size; NO darksize halving for this bullet).

### Step (gml_Object_obj_sword_vortex_Step_0.gml)
- L1: `image_alpha += 0.1` (fades in over 10 frames, clamps at 1 on draw).
- L2: `dir -= spinspeed * lerp(2, 1, len/120)` → **angular speed = 4·lerp(2,1,len/120)°/frame, DECREASING dir (clockwise in y-down screen)**. At len=80 ≈ 4·1.333 = **5.33°/f**; range over len 63–97 ≈ 4.77–5.90°/f.
- L3: image_angle = dir - 90.
- L7: `len = lenstart + sin(manager.siner / sinspeed) * sinpower` = **80 + sin(siner/22)·17** → radius pulses **63 … 97** px (period 2π·22 ≈ 138 frames).
- L8-9: `x = manager.swordcirclecenterx + lengthdir_x(len,dir)`, `y = manager.swordcirclecentery + lengthdir_y(len,dir)` → orbit around (wandering) center at radius len.
- L10: `lenstart -= shrinkrate` = 0 → **no inward spiral at variant 3** (variant 1 uses 0.15 for a slow shrink).
- L13-16: timer++, every 4 frames reset grazed.

### Draw (gml_Object_obj_sword_vortex_Draw_0.gml)
- L1: `draw_self();` — sprite `spr_roaringknight_sword_ol`, image_index 0, at (x,y), scale 1×1, rotation=image_angle(=dir-90), image_alpha(ramp→1), image_blend default **c_white**, no color tint.
- Depth: default (bullet depth from inherit; not explicitly set).

## VISUALS / ASSET DIMS (REFDATA sprites.tsv)
- `spr_roaringknight_sword_ol` — frames 1, **width 75, height 31, origin (37,15)** (≈center). Drawn native (scale 1). Origin centered so it rotates about its middle; the blade extends ±37px along local axis. image_angle = dir-90 makes the blade point tangent-ish / along its travel.

## COLLISION / DAMAGE
- Parent obj_regularbullet handles heart overlap using the sprite mask (75×31 rotated bbox). **damage 206**, grazepoints 2, **destroyonhit 0** (sword survives contact — persistent orbiting hazard). global.invc set to 0.4 by the attack (i-frames on hit).

## VARIANT (difficulty) TABLE — for reference
| var | rate | maxswords | multiswordmax/frames | sinpower | sinspeed | startinglen | shrinkrate | centermoves | setdir |
|-----|------|-----------|----------------------|----------|----------|-------------|------------|-------------|--------|
| 0 | 1 | 2 | 0 / – | 65 | 24 | 70 | 0 | 0 | {0,180} |
| 1 | 10 | 6 | 2 / 1 | 20 | 18 | 90 | 0.15 (spiral in) | 0 | {0,180×3} |
| 2 | 4 | 6 | 2 / 1 | 20 | 26 | 70 | 0 | 0 | {0,180×3} |
| **3 (used)** | **11** | **6** | **2 / 1** | **17** | **22** | **80** | **0** | **1 (wander, spd 60)** | **{0,180,0,180,0,180}** |

## SFX
- **None** in obj_sword_vortex, obj_sword_vortex_manager, or the type-154 controller block. No snd_play calls in this attack's objects.

## ASSETS
- Objects: obj_sword_vortex_manager, obj_sword_vortex (parent obj_regularbullet).
- Sprite: spr_roaringknight_sword_ol (75×31, origin 37,15).
- Center reference: obj_growtangle (battle box) for center & wander bounds; obj_heart (soul) collision.
