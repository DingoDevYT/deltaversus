# Knight "Flurry" — obj_dbulletcontroller type 99 (turn_type "full")

> All `image_xscale/yscale = 2` in GML are on the DARKWORLD 2x baseline. **HALVE every scale for the port** (darksize 2 → 1.0). GML angles are y-DOWN-screen with GM math convention (0=right, 90=screen-UP, 180=left, 270/-90=screen-DOWN). Screen-space directions are given below already converted.

## WHAT IT ACTUALLY IS (verify: despite the name it is NOT a fountain/quick-slash attack)
"Flurry" is a **box-splitting slash barrage**. The Knight stands beside the arena and repeatedly slashes the SOUL box. Each slash **cleaves the box in half** (alternating vertical / horizontal cut), the two halves **wrench apart ~70px shoving the SOUL to one side**, a **row of 13 tooth-bullets** erupts along the cut line firing perpendicular, then the box **snaps back shut**. This repeats for the whole turn. If the SOUL is caught inside the closing cut at the strike frame it takes a massive hit (66% max HP).

- `obj_dbulletcontroller` type 99 (`gml_Object_obj_dbulletcontroller_Step_0.gml:2032-2051`): hides the bulletmaker, spawns `obj_roaringknight_boxsplitter_attack` at creator x/y, `scr_bullet_inherit`, sets `.difficulty`, `turn_type="full"`, calls `event_user(0)` (which does NOT exist on the object — no-op; the object is `auto=true` and self-drives from its Step). `made=true`.
- **Chain:** `boxsplitter_attack` (manager, draws the Knight + slash telegraph) → spawns `obj_roaringknight_splitslash` (one per slash) → at slash-land spawns/uses one shared `obj_knight_split_growtangle` (the split box + tooth spawner) → teeth = `obj_roaringknight_split_bullet` (spr_roaringknight_tooth).
- **NOT USED by Flurry:** `obj_roaringknight_fountain_bullet` and the fountain code live only in `obj_knight_split_growtangle` **Other_12 (event_user 2)** and **Other_13 (event_user 3)**, plus the `_backup`/`_vertical`/`_old` variant objects. The ACTIVE `obj_knight_split_growtangle` Step only ever calls `event_user(0)` (= Other_10 = `con++`), so fountains never fire. `obj_roaringknight_quickslash*` objects are also NOT spawned (those are type 100/101, different attacks). The `spr_rk_quickslash` **sprite** IS used for the slash visual, but the quickslash objects are not.

---

## PHASE / SEGMENT ORDER (per slash cycle, repeats whole turn)

**A. Manager loop — obj_roaringknight_boxsplitter_attack**
- Create (`..._Create_0.gml`): `local_turntimer=330`, `spawn_speed=40`, `spawn_range=4`, `timer=200`, `image_xscale=image_yscale=2` (→1.0), `image_index=1`, `animtimer=5`, `count=3`, `auto=true`, `difficulty=2` (overwritten by controller). `anchor_x/y=x/y`. `force_oneside=irandom(1)`.
- Step (`..._Step_0.gml`): first frame sets `spawn_speed` by difficulty — **diff0=50, diff1=46 (+`force_swap`), diff2=31, diff3 default 40**; `vertical=irandom(1)`.
  - Every frame `local_turntimer--`. While `local_turntimer > 30` it runs the spawn loop: `timer++`; when `timer >= spawn_speed` → `timer=0`, pick `vertical=irandom(1)` (diff0 forces `force_oneside`), spawn `obj_roaringknight_splitslash` at `growtangle.x/y` with `.vertical`; diff3 adds `.diagonal` (alternating). `slash_count++`. If `diff<=2 && spawn_speed>40` ease spawn_speed→40 by 3 (diff2 stays 31). `spawn_range` approaches 60 by 3.
  - **Wind-down** `local_turntimer<=30`: at `<=10` snap Knight sprite to `spr_roaringknight_idle` frame0 (un-flip x, `x-=220` if flipped); at `<22 && xscale<0` set frame 4; nudge `x++` toward enemy; `y = lerp(y, knight.y, (50-t)/50)`. At `local_turntimer<0` and box not split → `global.turntimer=0; instance_destroy()`.
- Draw (`..._Draw_0.gml`): Knight sprite `draw_self()` (anim: `image_index` cycles 1→2 / 4→5 gated by `animtimer<4`). Every 4th frame spawns an afterimage (`scr_afterimage`, alpha 0.6, fadeSpeed 0.02, hspeed `2*sign(x-growtangle.x)`). Also builds a 142×142 `hell_surface` and draws each active splitslash's telegraph beam into it (additive) — see splitslash Draw.
- CleanUp: frees surface; if `bulletparent_count<2` restores `knight.image_alpha=1`, `global.turntimer=-1`.

**B. One slash — obj_roaringknight_splitslash** (`..._Step_0.gml`, `_Draw_0.gml`, `_Other_7`, `_Other_15`, `_Step_2`)
- Create: `damage=206`, `element=5`, `thickness=10`, `image_blend=c_black`, `slice_delay=5`, `hurt_delay=15`, `flip=choose(-1,1)`.
- `timer++` each step. Init: `depth=growtangle.depth+10`; makes a `spr_rk_quickslash_upper` marker (invisible); `angleoffset=random_range(-12,12)`.
  - **Cut orientation** by `slash_count%2`: diagonal(diff3) dir ±45; vertical (odd) dir ±90 + `xoffset=rand(-8,8)*2`; horizontal (even) `yoffset=rand(-8,8)*2`.
  - `timer<=15`: `thickness` lerps 10→1 (ease_out^4). Blend `merge_color(black,red, t/20)` — telegraph reddens over 20f.
  - **`timer==30`: THE STRIKE.** Snap to `xstart/ystart+offset`, `image_blend=c_white`, `active=true`, `slash=true`. Create the shared `obj_knight_split_growtangle` at growtangle pos if none (inherit, `grazepoints=5`, store on manager as `growtangle`); set its `vertical/diagonal`, `xoffset/yoffset/angle`, `con=1`, `timer=0`. Sprite→`spr_rk_quickslash` (250×48, 4 frames, origin 125,27), `image_speed=1`, `image_yscale*=2`. Plays `snd_wideslash_low` (vol 0.8, pitch 0.9+rand). Spawns **16 `obj_afterimage` debris** (spr_knight_slash_mark 160×150) flying ±along the slash angle.
  - `timer==34`: `active=false` (slash hitbox live frames **30–34**, ~4 frames).
  - `timer==(35+hurt_delay)` & playerstrike → clear, `scr_damage_maxhp(0.66)`, `global.inv=invc*30`, destroy.
- Draw: BEFORE strike → additive beam `spr_pxwhite10_center` (10×10 origin 5,5) at `growtangle.x/y+offset`, xscale=`ease_out(t/30)*180` (length 0→180), yscale=`lerp(4,0,ease)`, angle `spin+image_angle+angleoffset`, blend `merge(black,red,0.5)`. AFTER strike → `draw_self()` (the white quickslash sprite). If caught: draws heartslice `spr_rk_slash_heartslice` (20×20, frame `cuty`).
- Other_7 (heart collision): if `active && scr_precise_hit(3)` → `playerstrike=1`, SOUL hidden (`image_alpha=0`), `global.inv=-1`, `cuty=remap(-16..16→1..14, heartY)`, sets `split_delay=5`, `manager.timer-=5`, `manager.local_turntimer+=5`, `hurt_delay=split_wait`. (SOUL got sliced.)
- CleanUp: deletes slashmarker.

**C. The split box + teeth — obj_knight_split_growtangle** (`..._Create_0`, `_Step_0`, `_Draw_0`, `_Step_2`, `_Other_10/11`, `_CleanUp`)
- Create: `split_dist=50`, `max_distance=70`, `open_time=45`, `split_wait=5`, `split_hold=30`, `split_bullet=obj_roaringknight_split_bullet`, `bullet_count=13`, `bullet_range=144`, `disable_on_close=true`. Hides real `obj_growtangle`. Two `spr_rk_split_flame_big` markers (6f, 75×50 origin 37,25, scale 2→1, image_speed 0.5, gray) mark the cut edges.
- Step first frame diff2: `split_wait=4`, `split_hold=26`.
- **con state machine** (driven by `event_user(0)`=`con++`):
  - **con 1** (armed by splitslash): `timer==1` spawn `obj_knight_split_growtangle_effect`. At `timer >= split_wait+split_delay` (4/5f): disable prior teeth, `snd_knight_boxbreak` (pitch 1.1), `event_user(0)`→con2. Compute `heart_x/heart_y` = push-away direction from cut. `snd_chargeshot_fire`. **Spawn 13 teeth** (`obj_roaringknight_split_bullet`) evenly across `bullet_range=144` centered on box, split into two halves at the mid index (halves flip firing side). Each tooth: `friction=-0.2 or -0.05` (accelerates), `top_speed=(4 or 2)±0.2` chosen by weight, `image_speed=0.5`, `image_xscale=image_yscale=2`(→1), `speed=0`, `active=false`. Direction: **vertical cut → 0°/180° (fire right/left); horizontal cut → 90°/-90° (fire screen-up / screen-down)**; diagonal → radial `i*360/13`.
  - **con 2** (open): `split=true`. `timer==7` → all teeth `active=true`, depth up. `timer <= split_hold/2` (13f diff2): `distance = ease_out(t/(hold/2),3)*max_distance(70)` — box halves wrench apart 0→70px; SOUL shoved `(Δdist)*heart_x` (×1.25 for straight, ×1 diagonal / vertical uses heart_x*1.25). Past half → `event_user(0)`→con3.
  - **con 3** (close): `distance = 70 - ease_in(t/(hold/2),3)*70` (70→0). At `t>=hold/2` random `hshift/vshift ±3`, `event_user(0)`→con4.
  - **con 4** (settle): `distance` movetowards 0 by **12/frame**. At 0 → `con=0`, `split=false`, difficulty ramps (`split_wait--` down to 5[/3 diff3], `split_hold-=2` down to 30[/26]), `snd_locker`. `obj_growtangle.x` hidden at -9999 while `distance>0`, restored at 0.
  - Markers repositioned to cut edges each frame (`marker[0/1]` at `±dist`).
- Step_2 (`_Step_2.gml`): clamps SOUL inside whichever half-box it's in (TL `xstart-70-sw`, BR `xstart+52+sw`); diagonal cross-couples axes. Rounds heart x/y.
- Draw: renders the real box to a 170×170 `source_surf` (`draw_sprite_ext(sprite,frame,85,85,2,2,...)`), then when open cuts it into `half_box_a/half_box_b` via `bm_subtract` triangles along the cut line and draws the two halves offset by `±_splid/±_dist` (with 1px jitter). Draws `spr_rk_split_flame_edge` (5f, 75×50 origin 37,25, scale 2→1, gray) on each glowing cut edge; while `distance==0 && con>0` draws a thin `spr_whitepixel` seam line. `flame_index += 0.5`.
- effect object (`..._effect_Draw_0.gml`): 10-frame screen-tear flourish at each slash — copies application_surface, draws box halves sliding apart ×4/6/8, plus two additive `spr_pxwhite10_center` flashes (xscale 50) along the cut; destroys at `timer==10`.
- CleanUp: `event_user(1)`(Other_11 restores real box from surface as customBox), destroys markers, frees surfaces.

**D. Tooth bullet — obj_roaringknight_split_bullet** (`spr_roaringknight_tooth` 36×36, 2 frames, origin 18,18)
- Create: `element=5`, `speed_mult=0`, `top_speed=0`(set by box), `active=false`, `image_speed=0`.
- Step: `grazepoints=3`. `speed_mult += 0.2/frame` up to 1 (activates once ≥0.1); `speed = speed_mult*top_speed` → **accelerates to top speed over 5 frames**. `image_xscale/yscale` forced to 1. `distance += speed`.
- Draw: `image_index = floor(ease_in(anim_timer,2)*image_number)`; `anim_timer += 0.1` to 1; drawn with ±0.1 scale jitter. Standard `obj_regularbullet` collision (mask from 36×36 sprite → ~18px radius at scale 1). Contact damage via bullet system.

---

## KEY DIFFERENCE BY DIFFICULTY
- **spawn_speed** (frames between slashes): diff0=50, diff1=46, diff2=31, diff3≈40.
- diff0 forces one side only (`force_oneside`); diff1 adds `force_swap`; diff3 adds **diagonal (±45) cuts** and tighter box timing (`split_wait` down to 3, `split_hold` down to 26, `_hold+2`).
- Box open/close speed: diff2 `split_wait=4, split_hold=26`; others `5 / 30`; both shrink as the turn goes on.

## DAMAGE
- SOUL caught in a slash at strike frame → **scr_damage_maxhp(0.66)** (66% of MAX HP) + 30×inv i-frames. This is the punish for being inside the closing cut.
- Teeth: regular contact bullets (grazepoints 3), standard bullet damage.

## SFX
`snd_wideslash_low` (each slash, vol0.8 pitch~0.9), `snd_knight_hurtb` (stopped), `snd_knight_boxbreak` (box cleaves, pitch1.1), `snd_chargeshot_fire` (teeth erupt; +`snd_chargeshot_fire` pitch0.5 if split_delay), `snd_locker` (box snaps shut).

## ASSETS
Sprites: `spr_roaringknight_attack_ol`/`spr_roaringknight_idle` (117×115, origin 7,23, 6f — the Knight), `spr_rk_quickslash` (250×48, origin 125,27, 4f), `spr_rk_quickslash_upper` (250×27, origin 125,27 — marker), `spr_pxwhite10_center` (10×10, origin 5,5 — beams), `spr_knight_bullet_flow` (320×240 — flow overlay), `spr_knight_slash_mark` (160×150 — debris), `spr_rk_slash_heartslice` (20×20, 18f), `spr_roaringknight_tooth` (36×36, origin 18,18, 2f — teeth), `spr_rk_split_flame_big` (75×50, origin 37,25, 6f), `spr_rk_split_flame_edge` (75×50, origin 37,25, 5f), `spr_whitepixel` (1×1). Objects: obj_roaringknight_boxsplitter_attack, obj_roaringknight_splitslash, obj_knight_split_growtangle(+_effect), obj_roaringknight_split_bullet, obj_afterimage/obj_marker.

## KEY FILE:LINE
- Spawn/type99: `gml_Object_obj_dbulletcontroller_Step_0.gml:2032-2051`
- Manager Create/Step/Draw: `gml_Object_obj_roaringknight_boxsplitter_attack_{Create_0,Step_0,Draw_0}.gml`
- Slash: `gml_Object_obj_roaringknight_splitslash_{Create_0,Step_0:55-165,Draw_0,Other_7}.gml`
- Box+teeth: `gml_Object_obj_knight_split_growtangle_{Create_0,Step_0:1-282,Draw_0,Step_2}.gml`
- Tooth: `gml_Object_obj_roaringknight_split_bullet_{Create_0,Step_0,Draw_0}.gml`
