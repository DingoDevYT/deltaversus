# Pink (Mad Mew Mew) Boss — EXACT Port Spec: Fight Flow + Scenery/Background

Source: `DELTARUNE Chapter 5 - GML`. All `file:line` refs are to
`gml_Object_obj_pink_enemy_*.gml`, `gml_Object_obj_pink_battlemovement_*.gml`,
and the named scenery objects. Sprite dims come from
`DELTARUNE Chapter 5 - REFDATA/sprites.tsv` (format: name, frames, W, H, xorigin, yorigin).

Blend-color decode rule (GML BGR int → RGB): `R = int & 255`, `G = (int>>8)&255`,
`B = (int>>16)&255`. GML `#RRGGBB` literals are already RGB.

Default object sprites (objects.tsv):
`obj_pink_enemy = spr_pink_idle` (parent obj_monsterparent); `obj_pink_curtains =
spr_pink_curtain`; `obj_mewers_live = spr_pink_mewers_live`; `obj_growtangle =
spr_battlebg_0`; `obj_pink_spotlight`, `obj_pink_dummy` have NO default sprite
(assigned in code).

================================================================================
## 1. SCENE OVERVIEW / DRAW LAYER ORDER
================================================================================

The fight is drawn in a battle room. There is NO static background sprite — the
entire stage is built procedurally by `obj_pink_enemy` in its Create + Step.
Layer order, back → front (by depth; smaller depth = more in front):

1. `black_square_bg2` — full-screen black rect, DEEPEST backdrop.
2. `black_square_bg` — black floor/curtain rect.
3. `obj_mewers_live` — glowing "MEWERS LIVE" marquee sign (behind Pink, depth-1).
4. `obj_pink_dummy` type "bg" — 16 background dancers (depth+1000, i.e. far back).
5. Pink's body / spotlights / bullet box (`obj_growtangle`) / heart — mid layer.
6. `obj_pink_dummy` type "fg" — 8 foreground dancers (depth = battlecontroller+1,
   in FRONT of the box).
7. `obj_marker_doomed` petals, `obj_afterimage_grow` smoke — overlay.
8. `obj_pink_curtains` — only during the SINGING attack (draws stage curtains +
   audience via a surface, wrapped onto the rotating box).

### 1.1 Black backdrop rectangles — Create_0:8-17
```
black_square_bg  = marker at (camerax()-10, cameray()+40), depth = depth+999
  sprite spr_whitepixel (1x1), xscale = camerawidth()+20, yscale = 320, blend c_black
black_square_bg2 = marker at (camerax()-10, cameray()-10), depth = depth+9999
  sprite spr_whitepixel, xscale = camerawidth()+20, yscale = cameraheight()+20, blend c_black
```
Both destroyed in CleanUp_0:13-17. `black_square_bg2` = whole screen black;
`black_square_bg` = a 320px-tall black band from y=+40 (the "stage floor"/lower
black). Also `with(obj_battleback) instance_destroy()` (Create_0:5) removes the
default battle backdrop.

### 1.2 obj_growtangle (the bullet box)
Spawned by attack code at `(XView+320, YView+170)` (Step_0:1595 etc). Its sprite is
`spr_battlebg_0` (75x75, origin 37,37). `obj_pink_battlemovement` pushes the whole
box + heart + bullets down when Pink stands on it (§4).

================================================================================
## 2. BATTLE STAGE SCENERY (spawned in obj_pink_enemy Step_0, `spotlightinit`)
================================================================================
Guarded by `if (spotlightinit == false)` — runs once, Step_0:3129-3193.

### 2.1 Per-hero + Pink spotlights (`obj_pink_spotlight`)
Each is a plain marker (default draw) created at `depth(target)+1`, alpha 0, xscale=
yscale=2:
| var | pos | sprite | dims (W×H, orig) |
|---|---|---|---|
| pink_spotlight_kris   | kris.x+22,  kris.y+106  | spr_pink_spotlight_kris   | 36×42 (14,41) |
| pink_spotlight_susie  | susie.x+52, susie.y+126 | spr_pink_spotlight_susie  | 53×46 (45,41) |
| pink_spotlight_ralsei | ralsei.x+53,ralsei.y+92 | spr_pink_spotlight_ralsei | 53×26 (45,23) |
| pink_spotlight_pink   | pink.x+28,  pink.y+82   | spr_pink_spotlight_pink   | 41×48 (14,41) |
Alpha is lerped to 1 when the stage is "shown" and to 0 when hidden (§2.5).

### 2.2 MEWERS LIVE sign (`obj_mewers_live`) — Step_0:3165; obj_mewers_live_*
Created at `(camerax()+camerawidth()/2, cameray()-120)`, depth-1, xscale=yscale=2.
Draw (obj_mewers_live_Draw_0):
```
timer++;
draw spr_pink_mewers_live_dim (119×53, orig 59,0) at (x, y+sin(timer*0.1)), alpha 1
draw spr_pink_mewers_live     (same dims)         at (x, y+sin(timer*0.1)),
     alpha = 0.6 + sin(timer*0.12)*0.5   // pulsing neon glow
```
Vertical bob target driven by `mewerslive_y_target` (Pink Step lerps y toward
`ystart + mewerslive_y_target`; target animates 400→120 or 460→120 over 8 frames,
Step_0:3263-3285). When stage hidden, y lerps to `ystart-90` (Step_0:3306).

### 2.3 Background dancers — 16× `obj_pink_dummy` type "bg" — Step_0:3168-3178
```
repeat(16): a=0..15
  inst at (camerax()+a*51, cameray()-62), depth+1000
  sprite spr_pink_bg_dummy (25×33, orig 13,31), xscale=yscale=2
  type="bg", wavetimer=a*4, wavecon=a
```
### 2.4 Foreground dancers — 8× `obj_pink_dummy` type "fg" — Step_0:3182-3192
```
repeat(8): a=0..7
  inst at (camerax()+a*121, cameray()+480+140), depth = obj_battlecontroller.depth+1
  sprite spr_pink_fg_dummy (61×38, orig 43,17), xscale=yscale=2
  type="fg", wavetimer=a*8, wavecon=a
```

### 2.5 Stage show/hide logic — Step_0:3208-3314
- `pink_bg_con`: 1 = show stage, 3 = hide (during turns/date). Default set to 1 when
  `global.mnfight==0` (3210-3213). Set to 3 when a turn is active or date UI open
  (3216-3217).
- `_hide` = true during intros/enemytalk/ballooncon 2-4/talked 0.41 etc (3219-3222).
- When SHOWN (`pink_bg_con==1 && !_hide`, 3224-3261):
  - `obj_marker_doomed` (petals) alpha lerp→1 (if datecount≠3).
  - all 4 spotlights alpha lerp→1 (rate 0.3).
  - bg dummies `yoffset` lerp→124; fg dummies `yoffset` lerp→ -300 (rate 0.1).
  - mewers_live y lerp→ `ystart + mewerslive_y_target` (if introcon==3, datecount<3).
- When HIDDEN (`pink_bg_con==3 || datecount==3 || _hide`, 3287-3308): petals + all
  `obj_pink_spotlight` alpha lerp→0; dummy yoffset lerp→0; mewers_live y→ystart-90.

### 2.6 obj_pink_dummy behavior (dancers) — Create + Draw
Create: image_speed=0, wave/glowstick state zeroed, camx/camwidth cached.
Draw (obj_pink_dummy_Draw_0) — exits if no pink_enemy or if obj_date_controller
exists. Each frame `x -= 2` (dancers scroll left; wrap when off-screen).
- `shocktimer>0` → uses `spr_pink_bg_dummy_shocked` (30×33) / `spr_pink_fg_dummy_shocked`
  (61×38) and forces pattern "shocked". Set to 30 when Pink is hurt (Draw_0:66,
  Step ghostintro 2752).
- type "bg": draws body then `spr_pink_bg_dummy_glowstick` (20×18, orig 5,15) at
  glowstick_x=x+8, angle = glowstick_angle+20, scale2.
- type "fg": `image_index` chosen by x-position across screen fifths (0..4); draws
  `spr_pink_fg_dummy_hlowstick` (3 frames, 32×46) then body; glowstick_x=x+23.
- Dance patterns (driven by `obj_pink_enemy.dummy_pattern`, chosen every 120f in
  Step_0:3316-3350 among `"wave"×3, "every other jump", "glowstick up and down"`):
  - "wave": glowstick angle oscillates ±30 (step 9/frame); every 60f dummy hops
    (vspeed=-8, gravity=1). glowstick_y lerps to ±20 from base.
  - "every other jump": alternating dummies hop (wavecon parity), 30/45f cadence.
  - "glowstick up and down": glowstick_y jitters ±3 (bg) / ±8 (fg) on a 30f loop.
  - "glowstick wave": angle sweeps −60→+50.
- Landing clamp: `if (y+vspeed)>ystart → vspeed=0,gravity=0,y=ystart`.

### 2.7 Falling petals (`obj_marker_doomed` via `drop_petal()`) — Create_0:279-298
Called each 5 frames (`freezable`, Step_0:3200-3206) while `datecount<3`:
```
drop_petal(x,y): marker_doomed at depth = battlecontroller.depth+1
  sprite spr_spin_petal (9×8, 5 frames), xscale=yscale=2, image_speed rand 0.1-0.3
  gravity_direction 175+rand10, vspeed 5, hspeed -2, gravity 0.06
  blend = merge_color(c_white, c_black, rand 0.25); alarm[0]=120 (lifetime)
spawn pos = (_cx+640-325+rand, _cy-250+rand) with _cx=camerax()+100, _cy=cameray()-100
```

### 2.8 Curtains + audience (`obj_pink_curtains`) — SINGING attack only
Created by the singing bullet pattern. Uses a 640×480 surface. Draws:
- Two TV speakers `spr_dw_castle_tv_speaker` frame 1 at box-left (camerax+172) and
  box-right (camerax+468), y = box_top-31, scale = 2*speaker_scale (pulses to 1.15
  every 10 steps, Step_0:4-17).
- Stage curtains: 6 columns × 14 rows of `spr_pink_curtain` (32×32, origin 16,16),
  drawn mirrored from both sides, opening animation via `closed` (2→0, −0.05/step)
  and per-row sway (`curtain_angle[14]`). Draw_0:56-145.
- 28 audience dummies (`obj_audience_hitbox`) that pop out of the curtains and shoot
  hearts — bullet subsystem, not scenery. Pattern machine in Step_0:48-482.
- Whole surface is drawn wrapped/rotated onto the growtangle box (Draw_0:147-156)
  when not drawing dummies directly.

================================================================================
## 3. PINK BODY DRAWING (obj_pink_enemy Draw_0)
================================================================================
`obj_pink_battlemovement.visible` note: during ATTACKS, `obj_pink_enemy` sets
`visible=false` and `obj_pink_battlemovement` draws Pink instead (§4). Otherwise
`obj_pink_enemy` Draw_0 draws her. Base scale = 2×2 (image_speed 0.16667).

### 3.1 Very-hurt state (datecount 3 body) — Draw_0:7-60
If `idlesprite == spr_pink_very_hurt`: draws `spr_pink_very_hurt_2xscale` (92×64,
5 frames) sliced in horizontal strips with a sine wobble (distortion) and a red-fog
flashing overlay (`turnredcon`), emitting `spr_cakesmoke` every 15f. `exit` after.
Distortion offset: `x + shakex -6 + sin((wave_siner + i*8)/30)*3`, `y + i*thickness + 28`.

### 3.2 Hurt / head-pop (state 3) — Draw_0:62-124
When `datecount!=3`: draws detached head — body `hurtsprite`
(spr_pink_front_surprised_nohead, 37×44) at `(x+10+shakex+hurtspriteoffx+36,
y-2+hurtspriteoffy+26)` scale2, plus flying head `spr_pink_front_surprised_nohead`
frame 1 at `(x+10+headx+36, y-2+heady+26)` rotating by `headangle` (spins 0→360 over
24f, gravity headspeed). White-flash overlay via d3d_set_fog while
`pink_head_white_alpha>0`. When `datecount==3`: draws `spr_pink_front_surprised`
frame `hurttimer/2` at `(x+shakex+..+43, y+..+42)` scale2 + red flash.

### 3.3 Idle / expression sprites — Draw_0:126-400
Large `if idlesprite == …` chain. Each calls `draw_monster_body_part(sprite, siner,
x+DX, y+DY)` with a specific offset & siner increment. Key ones (DX,DY / siner step):
```
spr_pink_sweat_drop     (+14, -2)   siner+=1/3 clamp 2
spr_pink_front_ohoho    (+46,+39)   siner+=1/3
spr_pink_laugh          (+52,+34)   siner+=1/3
spr_pink_front_angry    (+52,+38)   siner+=1/6
spr_pink_front_angry_blink (+52,+38)
spr_pink_front_sweat    (+52,+38)
spr_pink_peace_sign     (+20,  0)
spr_mew_stomp           (+52,+38)   (angrier: siner+=0.5)
spr_pink_yelling        ( +6, -6)
spr_mew_kick / _kick_r  (+18, -4)
spr_mew_pushing         (+18+sin(siner)*5, -4)  + white date-flash overlay
spr_pink_shocked/_r     ( x,  y)     siner+=0.5  + date-flash overlay
spr_pink_run            (+18,+35)   + date-flash overlay
spr_pink_walk_right     ( +6, +4)
spr_pink_yelling_r      ( +6, +6)   + white flash
spr_pink_kneeling_sad/2 (+18, -4)
spr_pink_kneeling_crying_loop (+18,-6)
default                 scr_enemy_drawidle_generic(0.16667)
```
- Red-turn overlay (`turnredcon==1`, Draw_0:304-338): re-draw with c_red fog at alpha
  `0.2 + sin(turnredtimer*0.35)*0.2`, emit smoke every 5f.
- Smoke (`spr_cakesmoke`) also every 15f while `datecount>=1 || dateflashcon==1`.
- Electricity: `spr_pink_electricity` (60×60, 5f) at `(x+off, y-10)` scale 1.5×1.8
  for 30f while `electricity_con==1`; loops `snd_electroshock_loop` (Draw_0:367-399).
- Purple intro rect (Draw_0:417-424): purple (192,0,192) rectangle rising from the
  box during `talked==0.41` intro.

### 3.4 Ghost (`ghostmarker` ×3) — obj_pink_ghost_marker, Create_0:60-80
3 ghost markers, `spr_pink_ghost` (41×42, 5f), image_speed 0.16667, scale2, alpha 0.
Fade/scale in during `ghostintrocon` sequence (Step_0:2748-2815): appears at frame
14 with `snd_ghostappear` + `obj_ghostburst`, then floats via
`hspeed=sin(ghosttimer/12)*3, vspeed=cos(ghosttimer/12)*3` and a saturation shader
(`pos` lerps to −0.55) once `ghostintrocon==2`. datecount==2+ splits Pink into GHOST
+ BODY.

================================================================================
## 4. obj_pink_battlemovement — MODE STRUCTURE (Pink during attacks)
================================================================================
Create_0: scale2, image_speed 0.334, `mode=0`, `phase=0`, plus bomb/grid ds_lists.
Sets `obj_pink_enemy.visible=false`. Destroy/CleanUp restore visibility & free lists.

Draw_0 draws `sprite_index` at an arc-interpolated pos when `air_time>0`
(`lerp(dest,x)` + `lengthdir_y(air_height,(1-air_time)*180)` — a jump arc). Special:
`spr_pink_idle` offset −24*xscale, −19*yscale. Burnt overlay grid for
`spr_pink_front_surprised`. Green flash (`c_lime` fog) when `flash_amount>0`
(collecting audience hearts).

Modes (Step_0 switch):
- **0 — idle/land**: default resting; handles `spr_pink_front_ohoho` laugh timing.
- **1 — jump/arc onto box**: `air_time` decays; on land → `spr_pink_idle` (or, if
  curtains exist, `spr_pink_sing` mode 7). If turn active → `on_the_box=true`,
  `box_pushdown_dest=56` (Pink's weight pushes the box + heart + bullets down 56px,
  Step_0:1533-1558). Else `instance_destroy`.
- **2/3/4 — bomb throw** (`spr_pink_front_throw_bomb`): mode 2=4 ammo, 3=2, 4=7.
  Frame-driven throw animation spawns `obj_fusebomb` into a 4-wide grid.
- **5 — advanced bomb pattern** (`spr_pink_throw_bomb`/`_bomb2`): grid list logic,
  spawns `obj_fusebomb` / `obj_fusebomb_big`, wave-spin big bombs (`wave_angle`,
  `wave_speed` chosen from {3.85,4.725,5.15,5.95}). This is the "rotating box"/"bomb".
- **6 — chase/land run** (`spr_pink_run`/`spr_pink_front_surprised`): approaches
  dest_x with gravity; on turn end resets to `spr_pink_ball` and flies home.
- **7 — singing on box** (`spr_pink_sing`/`_idle`/`_turn`, 36×46): paces left/right
  over the box (hspeed ±(1-2)), turn-around animation, `spr_pink_sing_turn`; collects
  `obj_audienceheart` (spawns `obj_dokiheart` toward the box, +tension). Runs while
  `obj_pink_curtains` present.
Box push (all modes): `box_pushdown_real` eases to `box_pushdown_dest`; delta applied
to growtangle.y, purplecontrols, heart, all bullets, dokihearts.

================================================================================
## 5. FIGHT-FLOW STATE MACHINE
================================================================================

### 5.1 Key state vars (Create_0)
```
turns=1, phaseturns=0, difficulty=0            // Create_0:24-26
datecount=0, datecon=0, datetimer=0            // date/phase counter (0..3)  :37-39
doki=0, dokimax=15, dokiprev=0                 // DOKI meter                 :119-121
damage=132, nonteamdamage=132, teamdamage=100  // :99-100,124
teamdamageproportional=false                    // :125
myattackchoice=-1                               // :101
looping=false, firstphaseturn=0                 // :94,123
introcon=0, introtimer=-17                       // :87-88
outfit_select=choose(0,1)                        // kris/susie/ralsei uniform toggle :35
mewerslive_y_target=240                          // :98
```
`global.flag[1449] = ++global.tempflag[96]`; if >1 (revisit) `introcon=3`
(skip intro) — Create_0:149-153.

### 5.2 datecount = the PHASE counter (0,1,2,3)
Each attack turn `doki` (DOKI meter) is filled by FLIRT/ACT/share-food. When
`doki >= dokimax` the party can DATE → `datecount++` (Step_0:1648-1668). `dokimax`
is 15 for datecount 0-1, **20 for datecount ≥ 2** (Step_0:6-12). On each new turn
`global.monsterhp = monstermaxhp`, except **datecount==3 → hp = 0.33 × max**
(Step_0:1-4). HP is effectively invincible (dialogue "This body is invincible")
until the date sequence completes each phase.

Phase meanings:
- **datecount 0** — Pink whole, intro taunts. dokimax 15.
- **datecount 1** — after first DATE; "reeling from impact, TP reset". dokimax 15.
- **datecount 2** — Pink SPLITS into GHOST + BODY (ghostintrocon sequence). dokimax 20.
- **datecount 3** — GHOST gone, BODY breaking down (`spr_pink_very_hurt`, heartbeat
  sfx, red distortion). HP=0.33×max. `phaseturns` capped at 2; final DATE ends fight.

Transition trigger (Step_0:1615-1668, phase "bullets", `attacked==0`):
`rtimer` counts up each bullets-phase frame; at `rtimer==12` (or 15 if doki full):
if `doki>=dokimax` OR `(datecount==3 && phaseturns>=3)` → `datecount++` and spawn
`obj_date_controller`. Otherwise fire the selected attack (§6) and `scr_turntimer(300)`
(datecount==3 forces turntimer=2, i.e. skip), `turns++`, `attacked=1`.

### 5.3 phaseturns
Incremented each enemy-talk (Step_0:607). Drives which taunt dialogue AND (via
event_user0) which attack fires. datecount==1 wraps `phaseturns>4→0`;
datecount 2/3 wrap `phaseturns>=6→2`; datecount==3 caps `phaseturns>2→2`.

### 5.4 DOKI meter fill (scr_dokiadd, obj_date_ui)
FLIRT ACT values (Step_0 `global.myfight==3` block):
- Kris flirt +1 (or +2/+3 if allies downed); flirt-hard +5; everyone flirt-hard +5;
  GIGA FLIRT +10 (2187-2278). Susie/Ralsei flirt +1..5 similarly.
- Susie "share item" → `scr_item_to_doki(item)` = +0/1/2/3/4/15 (2434-2457).
- Ralsei "lovelyboy" raises MAX TP.
Each flirt spawns `spr_dokiheart` particles (blend #FF88AA = RGB 255,136,170) rising
off the flirting hero, swaps them into `spr_*_uniform1/2` (outfit_select toggles),
plays `snd_magicsprinkle` + `snd_explosion_mmx3`, afterimages.
datecount==3 → all flirts "had no effect".

### 5.5 Turn/battle-message flow
`global.mnfight` 0=menu, 1.5=setup bullets, 2=bullets running. When `mnfight==1.5`
and not datecount 3 and not a purple/box attack, spawns `obj_growtangle`+`obj_moveheart`
+`obj_purplecontrols` (the PURPLE-soul box) — Step_0:1579-1613. Battle messages per
datecount (Step_0:1835-1908): e.g. "Pink mews madly!", "Pink's BODY winks! GHOST
sticks out tongue!", plus "The DOKI meter is almost full!" when doki>=12, and TP-reset
messages on `firstphaseturn`.

### 5.6 Intro (introcon/talked machine) — Step_0:2970-3124
introcon 0→ show `pink_battle_dialogue1`; ballooncon drives a long scripted dialogue
tree (Step_0:649-1563, ballooncon values 1..39 map to `pink_battle_dialogue*`). Intro
jump-in: Pink balls up (`spr_pink_ball`) and arcs onto the box, pours purple tea
(`obj_purple_tea` droplets), fires attack **type 199** ("purple intro"), then reveals
she's PURPLE. On revisit (`introcon==3`) intro is skipped.

================================================================================
## 6. ATTACK SELECTION & TYPE NUMBERS
================================================================================

### 6.1 event_user0 (Other_10) — picks `myattackchoice` + `difficulty` by phase
**datecount 0** (`phaseturns>=5 → looping`):
| phaseturns | attack | diff |
|---|---|---|
| 0 | 1 (cats)      | 0 |
| 1 | 6 (bomb v2)   | 1 |
| 2 | 1 (cats)      | 1 |
| 3 | 6 (bomb v2)   | 0 |
| 4 | 5 (sing)      | 0 |
| >4| choose(1 diff4, 6 diff0) | |

**datecount 1** (`phaseturns>4→0`):
| 0 | 3 (rotating box) | 0 |
| 1 | 4 (3d tunnel)    | 0 |
| 2 | 6 (bomb v2)      | 4 |
| 3 | 5 (sing)         | 1 |
| 4 | 3 (rotating box) | 2, looping |

**datecount 2 & 3** (`phaseturns>=6→2`):
| 0 | 3 (rotating box) | 1 |
| 1 | 6 (bomb v2)      | 2 |
| 2 | 1 (cats)         | 2 |
| 3 | 4 (3d tunnel)    | 1 |
| 4 | 1 (cats)         | 3 |
| 5 | 6 (bomb v2)      | 3 |
| 6+| 5 (sing)         | 2, phaseturns→2 |

### 6.2 myattackchoice → bullet-controller type (Step_0:1674-1809)
The attack spawns `dc = scr_bulletspawner(x, y, obj_dbulletcontroller)`; `dc.type`:
| choice | monsterattackname | dc.type | notes |
|---|---|---|---|
| 1 | "cat"          | 200 | |
| 2 | "bomb"         | 206 | purplecontrols.mode=2 |
| 3 | "rotating box" | 202 | datecount==1 also spawns obj_heartmarker at (cam+300,cam+210) |
| 4 | "3d tunnel"    | 208 | growtangle maxscale 3.75; purplecontrols.mode=7 |
| 5 | "singing"      | 209 | spawns obj_pink_curtains stage |
| 6 | "bomb"         | 203 | obj_heartmarker at (cam+280,cam+160); purplecontrols.mode=2 |
| 7 | "vertical lanes" | 204 | (not selected by event_user0) |
| 8 | "vertical lanes" | 205 | (not selected by event_user0) |
| intro | "purple intro" | 199 | fired during talked==0.41 |
Most attacks first create `obj_growtangle` at `(XView+320, YView+170)` and
`scr_moveheart()` if the box/heart don't exist.

================================================================================
## 7. TIMING / CADENCE CONSTANTS
================================================================================
- Pink base image_speed 0.16667; battlemovement 0.334.
- ghostmarker image_speed 0.16667 (spr_pink_ghost 5f).
- mewers_live glow: dim base alpha 1; bright alpha `0.6+sin(t*0.12)*0.5`; bob
  `sin(t*0.1)`. y-slide 400→120 / 460→120 over 8 frames.
- dummy dance pattern reselect every 120 frames; wave hop every 60f (vspeed −8,
  gravity 1); "every other jump" 30/45f; glowstick up/down 30f loop, angle jitter ±3/±8.
- petals: one every 5 frames (`freezable`), lifetime 120f, image_speed 0.1-0.3,
  gravity 0.06, dir 175±5.
- turn-red flash alpha `0.2 + sin(turnredtimer*0.35)*0.2`; smoke every 5f (red) / 15f.
- electricity 30-frame burst; `snd_electroshock_loop`.
- datecount==3 heartbeat: `snd_heartbeat` every 40f; random doki `irandom(19)` +
  date_ui electricity every 90f while phaseturns<3 (Step_0:2870-2884).
- curtain open: `closed` 2→0 at −0.05/step; speaker pulse every 10 steps to 1.15.
- box push: `box_pushdown_dest=56` when Pink lands on box; eased at
  `(|dest-real|/6)+0.2` per step.
- very-hurt strip distortion: `sin((wave_siner + i*8)/30)*3`, thickness 2.

================================================================================
## 8. ASSET LIST (import from PNG export)
================================================================================
### 8.1 Sprites — scenery/background
```
spr_whitepixel (1×1)            spr_battlebg_0 (75×75) [box]
spr_pink_mewers_live (119×53)   spr_pink_mewers_live_dim (119×53)
spr_pink_bg_dummy (25×33)       spr_pink_bg_dummy_shocked (30×33)
spr_pink_bg_dummy_glowstick (20×18)
spr_pink_fg_dummy (61×38,5f)    spr_pink_fg_dummy_shocked (61×38,5f)
spr_pink_fg_dummy_hlowstick (32×46,3f)
spr_pink_spotlight_kris (36×42) spr_pink_spotlight_susie (53×46)
spr_pink_spotlight_ralsei (53×26) spr_pink_spotlight_pink (41×48)
spr_spin_petal (9×8,5f)         spr_cakesmoke   spr_pink_curtain (32×32)
spr_dw_castle_tv_speaker        spr_dokiheart   spr_heart_pop
```
### 8.2 Sprites — Pink body/expressions
```
spr_pink_idle (41×42,5f)  spr_pink_ball  spr_pink_laugh  spr_pink_laugh_pouring
spr_pink_front_ohoho  spr_pink_front_angry  spr_pink_front_angry_blink
spr_pink_front_sweat  spr_pink_sweat_drop  spr_pink_shocked  spr_pink_shocked_r
spr_pink_yelling  spr_pink_yelling_r  spr_pink_run  spr_pink_walk_right
spr_pink_peace_sign  spr_pink_kneeling_sad  spr_pink_kneeling_sad2
spr_pink_kneeling_crying_loop  spr_mew_stomp  spr_mew_stomp2  spr_mew_stomp_angrier
spr_mew_kick  spr_mew_kick_r  spr_mew_pushing
spr_pink_front_surprised  spr_pink_front_surprised_nohead (37×44)
spr_pink_front_surprised_topleftorign  spr_pink_wistful  spr_pink_very_hurt (46×32,5f)
spr_pink_very_hurt_2xscale (92×64,5f)  spr_pink_electricity (60×60,5f)
spr_pink_ghost (41×42,5f)  spr_pink_front_throw_bomb  spr_pink_throw_bomb
spr_pink_throw_bomb2  spr_pink_front_burnt  spr_pink_sing (36×46,9f)
spr_pink_sing_idle  spr_pink_sing_turn
```
### 8.3 Sounds
```
pink.ogg (battle music, mus_loop_ext)
snd_pink_laugh_short  snd_pink_laugh_long  snd_pink_gasp  snd_pink_throw
snd_pink_throw2  snd_pink_huh  snd_pink_trip  snd_electroshock_loop
snd_pink_stretch_2_troubled  snd_pink_stretch_2_fixed  snd_ghostappear
snd_heartbeat  snd_awkward  snd_impact  snd_punchweak  snd_punchheavythunder
snd_wing  snd_jump  snd_slidewhistle  snd_hurt1  snd_magicsprinkle
snd_explosion_mmx3  snd_explosion  snd_realisticexplosion(sprite)  snd_coin
snd_whip_throw_only  snd_bump  snd_drumroll  snd_rumble  snd_chain_wave
```
### 8.4 Colors (RGB)
```
c_pink        = (230, 36,123)   Create_0:34
purple_color  = (192,  0,192)   Create_0:92 (intro purple rect / PURPLE soul)
doki heart    = (255,136,170)   #FF88AA
heart-pop pink= (255,181,153)   make_color_rgb
black rects   = c_black (0,0,0)
```

================================================================================
## 9. NON-BATTLE (overworld/concert) SCENERY — for reference only
================================================================================
These objects appear in the OVERWORLD pink room / concert cutscene
(`room_dw_pink_encounter`, `room_dw_fcastle_pinkroom`, `room_dw_rhythm`), NOT the
boss battle background. Enumerated so they aren't confused with battle scenery:
- `obj_pinktree`, `obj_pinktree_tall`, `obj_pinktree_bottomorigin` — platform-swap
  cherry trees (scr_platswap), scale2, hp 0.5. Overworld decor.
- `obj_blocktree_pink_bg`, `obj_blocktree_pink_platform` — animated pink block-trees;
  draw frames 1/2/3 with sine sway `sin(siner/12)*2`, `sin(siner/14)*1`; platform
  version adds `obj_plat_floor` + two front leaf markers. Overworld.
- `obj_spotlight`, `obj_spotlight_backlighting`, `obj_spotlight_wall`,
  `obj_spotlight_blocker`, `obj_spotlight_darkobj` — the cutscene stage-lighting
  system (references `obj_stage_darkness`); light_color 14482087 = RGB(167,250,220).
  Additive light cones + shadow casting. Concert/cutscene, not battle.
- `obj_rhythmgame_spotlights`, `obj_rhythmgame_spotlight_solo` — rhythm-minigame
  spotlights (reference `obj_rhythmgame`); light_color 15245445 = RGB(133,160,232).
- `obj_pinkspeaker` — the giant Pink-face TV speaker in the encounter room
  (obj_dw_pink_encounter spawns `pinkface` at (room_width-224, room_height), depth
  −50). Silhouette/expression system keyed on `global.fe`; tail/sweat/tears extras.
- `obj_pinkdust` — floating pink dust mote; draw mirrors sprite twice at
  `image_angle+270`, alpha fades by `image_index/10`, image_speed 1.
- `obj_pink_tension_glow` — TP-bar glow overlay (reads global.tension), fades out.
- `obj_fx_pinksparkle` — sparkle particle, random frame, self-destructs after
  7-21f alarm; velocity ×0.75/step.
- `obj_pinktrail` — motion-trail marker, alpha −0.0625/step then destroys.

The boss-battle background is ENTIRELY: the two black rects + growtangle box +
mewers_live sign + bg/fg pink_dummy dancers + 4 pink_spotlights + falling petals
(+ pink_curtains stage during the singing attack). Reproduce those, not the
overworld tree/rhythm objects.
```
