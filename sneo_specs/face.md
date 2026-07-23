# Spamton NEO — "Face Attack" (SneoFaceAttack, rr=7)

Exact port spec from decompiled DELTARUNE Ch2 GML. GML angles are **y-up** (0°=right, 90°=up).
`scr_darksize` sets `image_xscale=image_yscale=2` (dark-world 2x). **PORT NOTE: assets are full-res → HALVE every darksize scale (2→1).** All coords/offsets below are in room pixels (already post-2x-scale) unless noted.

Base GML path: `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 2 - GML\`

---

## 1. WHAT IT IS
A giant Spamton face slams in from the right and hovers beside the battle box. It is built from **4 overlaid instances of `obj_sneo_faceattack`**, all spawned at the SAME (x,y):
- `type=0` FACE (base head, no attack) — `depth += 10` (drawn behind the parts).
- `type=1` EYES → fires homing **laser circles** (obj_werewire_bullet_lasercircle). HP tracked in `obj_spamton_neo_enemy.eyeshp`.
- `type=2` NOSE → fires arcing **nose-booger** gravity bullets (obj_regularbullet). HP `nosehp`.
- `type=3` MOUTH → fires **wisp** bullets from the mouth (obj_regularbullet). HP `mouthhp`.

You use the **YELLOW soul** (`scr_heartcolor("yellow")`, `obj_heart.wspeed=global.sp`) and shoot `obj_yheart_shot` at each part's red weakpoint target. Each part has 16 HP; breaking a part stops its bullets and speeds up the survivors. Break all 3 → next Face Attack is shortened.

Dispatch: `gml_Object_obj_spamton_neo_enemy_Step_0.gml:841-848` (rr==7 → `scr_bulletspawner(x,y,obj_sneo_bulletcontroller)`, `type=12`, `special=hellmode`, `faceattackcount++`), turntimer at `:915-916` = **300**. Box preset `:737-743` (rr==7: `obj_growtangle.x+=15; maxxscale=2; maxyscale=2`). Manager creates the controller which spawns the face at controller Step `:962-1026`.

---

## 2. SPAWN / INTRO
Controller `obj_sneo_bulletcontroller type==12` (`gml_Object_obj_sneo_bulletcontroller_Step_0.gml:962`):
- `atimer` counts up. `atimer<20`: Spamton NEO slides right (`sneo.x` eased +300 over 20f, `obj_spamton_neo_enemy.x += 10/frame`) — `:975-980`.
- `atimer==20`: **spawn FACE** at `instance_create(camerax()+424, cameray()+100, obj_sneo_faceattack)`, set `target/damage`, `special=hellmode`; if `faceattackcount==1` set `first_time=true` (2nd face does the smash-in intro). Then `with(face) event_user(0)` spawns the 3 parts — `:982-993`.
- `facetimeincrease` (`:995-1004`) = count of parts already dead (carryover from a prior face). Applies startup delay to survivors (`:1006-1025`): non-eye parts `+20` if 1 dead / `+50` if 2-3 dead; eyes `+20` in all cases.

**event_user(0)** (`gml_Object_obj_sneo_faceattack_Other_10.gml`) — runs only on the first faceattack instance (the FACE): reads `eyeshp/nosehp/mouthhp` from the enemy (or 16 each if enemy gone; if `facebroken==1`, all set to -1 = pre-broken), then `instance_create` the eyes(type1), nose(type2), mouth(type3) at the face's x,y, copying hp/target/damage/first_time.

**Smash-in intro** (Create `first_time` block, Step `:34-95`): FACE starts at `x=camerax()+730`, `xstart=x`; moves left `x-=smashspeed` (`smashspeed=25`, `+0.5`/frame) until `x<xstart` → `intro_timer=15`, `scr_shakescreen()`, `snd_play(snd_closet_impact)`; then a 15-frame `sin`-eased overshoot wobble (`x=xstart - sin(pi*intro_timer/15)*20`), synced to `obj_growtangle`. `first_time=false` when done. (First face of the battle spawns with no smash; only the 2nd — `faceattackcount==1` — smashes.)

`image_alpha` starts 0, rises `+0.1/frame` once `global.turntimer > 21` (Step `:107-108`). Parts only fire while `global.turntimer > 21`.

---

## 3. VISUALS (all draw in Draw_0 `gml_Object_obj_sneo_faceattack_Draw_0.gml`)
Sprites (REFDATA sprites.tsv — **w,h,xorigin,yorigin**), drawn at `scr_darksize` scale **2** (port: 1):
| type | sprite | frames | dims | origin | 2x drawn |
|---|---|---|---|---|---|
| 0 face | `spr_spamtonneo_faceAttack_face` | 1 | 42×71 | 0,0 | 84×142 |
| 1 eyes | `spr_spamtonneo_faceAttack_eyes` | 3 | 42×71 | 0,0 | 84×142 |
| 2 nose | `spr_spamtonneo_faceAttack_nose` | 3 | 42×71 | 0,0 | 84×142 |
| 3 mouth| `spr_spamtonneo_faceAttack_mouth`| 5 | 42×71 | 0,0 | 84×142 |

All 4 share the same (x,y) (top-left origin), so the sprites are transparent-registered overlays that composite into one head. FACE is base (`depth+10`, behind); eyes/nose/mouth on top at default depth.

**image_index (frame) states:**
- Parts spawn at `image_index=1` (idle) (`Create/Step:20`). If hp≤0 at init → `broken=1, image_index=2`.
- MOUTH firing: `timer>=10` → `image_index=3` (open); resets to `1` at `timer==42` (Step `:234-259`).
- Broken frames: eyes & nose `image_index=2`; mouth `image_index=4` (Step `:283-287`).

**Tint (Draw `:3-19`)** via `image_blend`: while part hp>0, `merge_color(c_purple, blue_col, parthp/16)` where `blue_col = merge_color(#00A2E8, c_aqua, 0.25)` (Create:22 → RGB ≈ (0,162,232)→(0,255,255) at .25 ≈ **(0,185,238)**). `c_purple`=RGB(128,0,128). So a full-HP part = ~blue-cyan, fading toward purple as it takes damage. When hp<1 or showing a broken frame → `image_blend = c_white`.
**Flash overrides:** `shootflashtimer>0` → `c_yellow` (set to 3 on every shot); `hurtflashtimer>0` → `c_red` (3 on hit); `invincibilitytimer>0` → `c_red` + blink-hide on frames 10,9,6,5,3,2 (`:33-42`).

**Backing box element** (Draw `:47`, drawn every part): `draw_sprite_ext(spr_battlebg_0, 0, x-3, y+70, 2.4, 2, 0, blend, 1)` — `spr_battlebg_0` 75×75 origin 37,37, xscale 2.4 / yscale 2, `blend = merge_color(c_green,c_lime,0.5)` = RGB≈(64,220,0) green, alpha 1. (Decorative green box slab behind the face.)

**Explosion FX on break** (Step `:110-140`): `explodetimer=16`; every 2nd frame spawns `obj_boxing_crescent` (`spr_boxing_crescent` 20×20 origin 10,10, 4 frames) at a jittered spot near the part center (`(x+xx-25)+random(50)`, xx/yy per type: eyes 58,32 / nose 30,64 / mouth 48,102), `depth = part.depth-100`.

**Weakpoint target** `obj_sneo_faceattack_target` (`event_user(2)` = Other_12): `instance_create(x+xx, y+yy, ...)`, `depth = part.depth-999`. Offsets: eyes `+62,+32`, nose `+34,+64`, mouth `+52,+102`. Sprite `spr_boxing_crescent` (objects.tsv), Create sets `image_speed=0; image_xscale=image_yscale=0.4; image_blend=c_red` (a small red crescent marker over each part). Destroyed when part breaks (`broken==1 && type!=0` → `with(targ) instance_destroy()`, Step `:97-103`) and on faceattack Destroy.

---

## 4. MECHANICS — per-part bullet patterns
`brokencounter`/`brokenmod` = number of currently-broken faceattack instances (Step `:142-148`); survivors read it to ramp difficulty as parts die.

### EYES (type 1) — homing laser circles — Step `:150-185`
- Aim init at `timer==30` (or laserinit==0): `lasex = x+56-10`, `lasey = y+32`, `laserdir = point_direction(lasex,lasey, obj_heart.x+10, obj_heart.y+10)`, `brokenmod=brokencounter`.
- `timer>=30` && `timer%3==0` && `turntimer>21`: spawn `obj_werewire_bullet_lasercircle` at (lasex,lasey), `scr_bullet_inherit`, `my_angle=laserdir`, `my_speed=7`, `my_accel = brokenmod*0.25`, `image_yscale=2`, `my_angle_change=0`, element 6. If `brokenmod==2`: `my_angle = laserdir + brokenmod*random_range(-8,8)` (spray). `shootflashtimer=3`.
- Loop: `timer==50` → `timer = brokenmod*5` (cadence: bursts of lasers every 3f across timer 30→50, then repeats; more broken parts = shorter reset, faster repeat).
- The lasercircle (`obj_werewire_bullet_lasercircle`, `spr_bullet_laser_circle` 15×15 org 6,7) grows then streams `obj_werewire_bullet_lasersquare` segments (`spr_bullet_laser_square_sneo` 8×8) along `my_angle` at `my_speed` — a telegraphed straight laser beam toward the heart.

### NOSE (type 2) — arcing gravity boogers — Step `:187-224`
- init `timer>=70` sets `brokenmod`.
- `timer>=80` && `timer%5==0`: loop `i=0..2` spawn `obj_regularbullet` at (x,y): `sprite_index=spr_spamtonneo_faceAttack_nose_bullet` (42×71 org 0,0), `mask_index=spr_spamtonneo_faceAttack_nose_bullet_mask`, `scr_darksize` (2x→port 1x), `gravity=0.6 gravity_direction=180` (falls down), `friction=0.4`, `vspeed = -4 + i*4.5` (i.e. **-4, +0.5, +5**), `hspeed=-3` (leftward toward box), element 6. If `brokenmod==2`: `vspeed += random_range(-2,2)`. `shootflashtimer=3`.
- Loop: `timer==90` → `timer = 26 + brokenmod*10`.

### MOUTH (type 3) — wisps — Step `:226-260`
- init `timer>=10` sets `brokenmod`; `timer>=10` → mouth frame `image_index=3` (open).
- `timer>=10` && `timer%6==0`: spawn `obj_regularbullet` at `(x+30, y+98)`: `sprite_index=spr_spamtonneo_faceAttack_wisp` (29×19 org 14,9), `scr_bullet_inherit`, `hspeed=random_range(-4,-7)` (drifts left), `vspeed=random_range(6,-2)`, `gravity=-0.2` (floats up), element 6. If `obj_heart.y >= obj_growtangle.y`: `vspeed += 1` (bias toward the player). `shootflashtimer=3`.
- Loop: `timer==42` → `image_index=1`, `timer = -40 + brokenmod*20`.

### Breaking a part — Collision(obj_yheart_shot) `gml_Object_obj_sneo_faceattack_Collision_obj_yheart_shot.gml`
- FACE (type 0) or `image_alpha<0.9` → ignore (`:1`).
- If already broken → `snd_play(snd_bell)`, destroy the shot, exit (`:4-12`).
- If `invincibilitytimer>0` and shot is small → destroy shot, exit (i-frames).
- Damage per shot: **small `obj_yheart_shot` (other.big==0) = -1 hp**; **big (charged) shot = -4 hp**, but in `hellmode==1` big = **-2** (`:36-50`). Each part starts at **16 HP** → 16 small shots, or 4 big (8 in hellmode) to break.
- On hit: `snd_play(snd_damage)`, `invincibilitytimer=10`, `hurtflashtimer=3`, `shake=6`.
- When that part's hp ≤0: `broken=1; image_index=2; snd_play(snd_rocket); explodetimer=16` (`:56-62`).
- All shots call `with(other) event_user(0)` on the shot.

### Break consequences
- Broken part stops firing (`type==N && broken==0` gates all attack code), destroys its target (`:97-103`).
- Controller (`:1028-1042`): once `turntimer>80` and every part is broken → force `global.turntimer=80` (ends the attack early / lets you leave).
- Destroy event (`gml_Object_obj_sneo_faceattack_Destroy_0.gml`): if all three hp≤0 → set enemy `eyeshp=nosehp=mouthhp=16` and `facebroken=2`. `facebroken==2` at next face controller start (`:968-972`) → `global.turntimer=170` (shortened) then `facebroken=1`.
- Difficulty diffs: **hellmode** halves big-shot damage (4→2) and drives the `special=hellmode` flag. `brokenmod` (# broken parts) makes every survivor loop faster and adds spray/random spread.

### Heart / box behavior — Step_2 `gml_Object_obj_sneo_faceattack_Step_2.gml`
Only FACE (type 0) runs it, during intro. Clamps `obj_heart.x` inside the growtangle box `[gt.x - sw/2 +2, gt.x + sw/2 -24]` and applies `heart_recoil` push when the heart hits the incoming face edge.

Player damage from all bullets: `damage = global.monsterat[myself]*5` (scr_bulletspawner), element 6. Collision radius = default `obj_regularbullet`/inherited bullet masks (nose uses its explicit mask sprite; wisp/laser use sprite masks).

---

## 5. TIMING
- Attack length / `scr_turntimer` = **300** frames (rr==7 branch `:915-916`). Shortened to **170** if the prior face was fully broken (`facebroken==2`).
- Parts gated to fire only while `global.turntimer > 21`; `image_alpha` fade-in also starts at turntimer>21.
- Face spawns at controller `atimer==20`; enemy slide-in over first 20 frames.
- End: `turntimer` 21→1 → parts fade `image_alpha -=0.1` and `instance_destroy`; Spamton slides back (`:1044-1067`).
- Cadence (frames): EYES fire every **3** over timer window 30–50, reset `timer=brokenmod*5`. NOSE every **5** over 80–90, reset `26+brokenmod*10`. MOUTH every **6** over 10–42, reset `-40+brokenmod*20`.

---

## 6. SFX + ASSETS
SFX (sounds.tsv): `snd_closet_impact` (smash-in), `snd_damage` (part hit), `snd_rocket` (part breaks), `snd_bell` (shooting an already-broken part).
Sprites: `spr_spamtonneo_faceAttack_face/eyes/nose/mouth` (42×71 org 0,0), `_nose_bullet` (+`_mask`) (42×71), `_wisp` (29×19 org 14,9); `spr_bullet_laser_circle` (15×15), `spr_bullet_laser_square_sneo`/`spr_bullet_laser_front_sneo` (8×8), `spr_boxing_crescent` (20×20 org 10,10), `spr_battlebg_0` (75×75 org 37,37).
Objects: `obj_sneo_faceattack` (manager+parts), `obj_sneo_faceattack_target` (red weakpoint), `obj_sneo_bulletcontroller` (type 12 spawner), `obj_werewire_bullet_lasercircle`/`_lasersquare` (eye laser), `obj_regularbullet` (nose+mouth), `obj_boxing_crescent` (break FX), `obj_growtangle` (box), `obj_yheart_shot` (player shot), `obj_heart` (yellow soul).
