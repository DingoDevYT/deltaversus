# Gerson Ch4 Port Spec — HAMMER THROW + SQUISH/SLASH

Source: `DELTARUNE Chapter 4 - GML/` (decompiled GML). Refdata: `DELTARUNE Chapter 4 - REFDATA/` (objects.tsv, sprites.tsv).
Battle box object = **obj_growtangle** (default sprite `spr_battlebg_0`, collision `obj_battlesolid`, default image_angle 0, image_xscale/yscale set by battle to ~2).
`scr_darksize()` = sets `image_xscale = 2; image_yscale = 2` on the instance.

---

## TOPIC A — HAMMER THROW (obj_box_throw_controller)

Spawned by `scr_spearshot(x, y, _, 50)` → `instance_create(arg0, arg1, obj_box_throw_controller)` (scr_spearshot.gml:687-690).

### Create (gml_Object_obj_box_throw_controller_Create_0.gml)
- `timer=0; full_timer=0; hammer_timer=0; hammer_timer_goal=10; hammer_counter=0; hammer_phase=0; ending_counter=0; z=0; my_flash=-1;`
- `anchor_x=x; anchor_y=y;` `scr_darksize()` (scale 2). `image_speed=0.5`.
- `snd_play(snd_gerlaugh_clear, 1, 1.1)`. Hides `obj_hammer_of_justice_enemy`. `global.turntimer=9999`.

### Intro + BOX ROTATE/SHIFT — Step_0, `switch(timer)` (lines 4-45)
- **timer==15**: controller `visible=false`; spawn `obj_gerson_teleport_generic` at (x+64, y+36); teleport controller onto box: `x = obj_growtangle.x + 80; y = obj_growtangle.y - 20;` reset anchor.
- **timer==19**: destroy teleport_generic; `sprite_index = spr_gerson_swing`; spawn teleport_generic at (x+58, y+36).
- **timer==23**: destroy teleport_generic; `visible=true; image_index=0; image_speed=0`; `scr_lerpvar("image_index",0,6,12)` (wind-up swing anim over 12 frames); `snd_play(motor_upper_quick_mid)`.
- **timer==31 — THE HIT THAT ROTATES + SHIFTS THE BOX**:
  - `snd_play(snd_queen_punched_lower)`; `scr_shakeobj()`.
  - `with(obj_growtangle){ scr_lerpvar("x", x, x - 80, 10, 2, "out");  scr_lerpvar("image_angle", image_angle, image_angle + 135, 12, 2, "out"); }`
  - **Box shifts LEFT by 80px over 10 frames (ease out), and rotates +135° over 12 frames (ease out).** (Square box → looks like a ~45° diamond tilt.)
- timer 31-40: `with(obj_growtangle) scr_afterimagefast()` with `fadeSpeed *= 3`.
- Step_1 (lines 1-32): while `timer 30..42`, keeps `obj_heart` inside the rotated box via `obj_marker` (mask `spr_battlebg_collision_checker`, copies box angle/scale) — pushes heart out along point_direction so it stays contained during rotation.

### Gerson bounce/hop between throws — Step_0 (lines 56-73)
- Only in `hammer_phase==0`, when `timer>84`: `timer -= (30 + irandom(12))`; `snd_play_pitch(snd_jump, 2)`; `scr_jump_arc(id, x, y, anchor_x + new_x, anchor_y + irandom_range(-20,20), 70 + irandom(30), 24)`. new_x = ±(30..60) depending on side.

### Throwing anim / sprite
- Each throw sets `sprite_index = spr_gerson_hammer_throw; image_index = 0.1` (spr_gerson_hammer_throw = 3 frames, 68x55, origin -5,19).
- Step_0 lines 295-306: when throw sprite & image_index>0, `image_index = scr_approach(image_index, 3, 0.5)`; on reaching 3 → reset to 0 (phase 0/1) or hold at 2 (phase 2).
- `if(timer>36) hammer_timer++`.

### PHASE 0 — arced hammer volleys (Step_0 lines 78-133)
- Fires when `hammer_timer == hammer_timer_goal` (goal=10).
- `snd_stop/snd_play_pitch(snd_smallswing, 1 + random(0.3))`.
- `hammer_amount = 3 + irandom(1)` (occasionally 2 via the typo'd `hammer_cmount`).
- Spawn pos: `((x+100)-42, (y+90)-86)` = `obj_gerson_hammer_bro_hammer` per hammer.
  - `scr_bullet_init(); active=1; scr_darksize()` (scale 2).
  - `fakehspeed = (-abs(x-(obj_growtangle.x+small_offset))/45) + (-2 + (4/(amount-1))*a) + rand(-0.5,0.5)` (small_offset = irandom_range(-30,30)).
  - `fakevspeed = -14 + (-1 + (2/(amount-1))*a) + rand(-1,1)`.
  - `gravity_direction=270; fakegravity=0.6; depth-=1; target=3; damage=1; grazepoints=2.5`.
- `hammer_counter++`; at **hammer_counter==16** → `hammer_phase=1; hammer_timer=-12; hammer_timer_goal=3`.

### PHASE 1 — rapid single big-ish hammers (Step_0 lines 135-189)
- Fires when `hammer_timer==goal` (3). `snd_play_pitch(snd_smallswing, 0.75+random(0.3))`.
- 1 hammer, `image_xscale++; image_yscale++` (scale 2→3).
- `fakehspeed = -abs((x-(obj_growtangle.x + sin(full_timer*0.325)*80))/45) + rand(-0.25,0.25)` (sine-swept aim ±80px); `fakevspeed=-14 + rand(-0.5,0.5)`. Same grav 0.6.
- every 5th throw pauses (`hammer_counter%5==0 → hammer_timer=-4`).
- at **hammer_counter==25** → `hammer_phase=2; hammer_timer=0`.

### PHASE 2 — THE GIANT FINALE HAMMER (Step_0 lines 191-256)
- hammer_timer==1: `snd_play_pitch(snd_jump,2)`; Gerson jumps back `scr_jump_arc(id, x, y, xstart-30, ystart, 80, 32)`; `snd_play(snd_boost)`; spawns green afterimage flash (`scr_custom_afterimage_ext(obj_oflash,...)`, c_lime).
- hammer_timer 2..23 every 3rd: green `scr_oflash()` (c_lime charge flashes).
- **hammer_timer==9 — SPAWN GIANT HAMMER**:
  - `snd_stop(snd_smallswing); snd_play_pitch(snd_smallswing, 0.5)`.
  - `instance_create((x+100)-42, (y+90)-86, obj_gerson_hammer_bro_hammer)`:
    - `scr_bullet_init(); scr_darksize()` (2) then `image_xscale += 6; image_yscale += 6;` → **final scale 8** (normal thrown hammer = 2; so 4× larger).
    - **SAME sprite** = object default `spr_gerson_hammer_trowable4` (15x18, origin 6,10) — just scaled. `mask_index = spr_gerson_gigahammer_mask` (15x18, origin 6,10).
    - `fakehspeed = -abs((x - obj_growtangle.x)/25.5)` (aims at box center, steeper divisor); `fakevspeed = -16`.
    - `destroyonhit=false; gigahammer=true; gravity_direction=270; fakegravity=0.6; depth=controller.depth+1; target=3; damage=1; grazepoints=2.5`.
  - sets throw sprite again.
- hammer_timer==36: `sprite_index = spr_gerson_spin; image_speed=0.125; x+=60; y+=60` (Gerson spins off).

### Ending (Step_0 lines 258-290)
- `403 - full_timer < 8`: hide, spawn teleport_generic (x, y-40).
- `<4`: destroy teleport, spawn teleport at hammer_of_justice_enemy (x+68,y+36).
- `<2`: `global.turntimer=1`. Then when `turntimer<1`: destroy teleports, re-show enemy, `instance_destroy()`.

### obj_gerson_hammer_bro_hammer (the hammer projectile)
- Default sprite `spr_gerson_hammer_trowable4`; parent `obj_regularbullet`.
- Create: `con=0; timer=0; anim_index=0; fakehspeed/vspeed/gravity=0; gigahammer=false; drop=false; true_drop=false`.
- **Step_0 (arc physics + spin):**
  - Non-giga: fades when `y > obj_growtangle.y + 120` (`image_alpha -= 0.3`), deactivates <0.8, destroys <0.
  - `anim_index++`. Non-giga: every 3 frames `image_angle += 40` (tumbling spin). Giga: while rising (`fakevspeed<0`) `image_angle += 60`; once falling `image_angle = 202.5` (locked head-down).
  - Movement (unless giga & falling): `x+=fakehspeed; y+=fakevspeed; fakevspeed+=fakegravity`. `fakevspeed` capped at 11.
  - **Giga transition to drop:** when `gigahammer && fakevspeed>=0 && !drop`: zero all speeds, `drop=true; gravity=0; alarm[0]=12`.
- **Alarm_0:** `gravity_direction=270; gravity=2; snd_play_pitch(snd_fall,2)` (giant hammer begins its slow fall).
- **Step_2 (giant hammer impact / DOWNWARD box push — the "visual weight"):**
  - While `gigahammer && y > obj_growtangle.y+20 && !true_drop`: **pushes the box DOWN** — `with(obj_growtangle){ y += (hammer.y - hammer.yprevious); y = min(y, YView+220); with(obj_heart) y += box delta; }`. Box (and heart) ride down with the hammer, clamped to YView+220.
  - When `!true_drop && y > YView+220`: **LANDING** → `true_drop=true; vspeed=-16` (recoil bounce up); `snd_play(snd_impact); snd_play_pitch(snd_metal_hit_reverb, 1); scr_shakescreen()`.
  - When `true_drop && y > YView+720`: `scr_shakescreen(); snd_play_pitch(snd_glassbreak,0.5); snd_play_pitch(snd_explosion_firework,0.75); instance_destroy()`.
- **Other_15 (hit / damage):** `damage = lerp(12, 90, clamp((global.hp[2]-30)/250))`. target==3 → `scr_damage_all()`; destroyonhit → destroy (giant hammer has destroyonhit=false so it persists).
- Draw = default (draw_self via parent).

---

## TOPIC B — SQUISH + SLASH

> IMPORTANT DISTINCTION (verified in GML): the two files named in the task are **two DIFFERENT attacks**:
> - **obj_gerson_squishes_box** (via `scr_spearshot(x,y,5,13)`) = the **SQUISH** (flatten board wide+thin). It only squishes; the actual sweeping **SLASHES** on the squished board are **obj_gerson_swing_down** blades, spawned separately by `scr_spearshot(...,swingdowntype,4)` → `obj_gerson_teleport type=2`.
> - **obj_gerson_box_hit_controller** (via `scr_spearshot(x,y,_,5)`) = the **STAR side-barrage** (alternating left/right Gerson swings firing `obj_box_hit_bullet` = `spr_gerson_star7` stars that decelerate before the far edge). This is the "star-barrage box_hit_bullet version," NOT slashes. The wiki's "slashes L→R then R→L" visual most closely maps to obj_gerson_swing_down sweeps; the box_hit_controller alternating-side volleys are the star version.

### B1 — SQUISH: obj_gerson_squishes_box
Spawned by scr_spearshot arg3==13: `instance_create_depth(x,y,depth,obj_gerson_squishes_box); .type=5`.
- **Create:** `timer=0; con=0; image_xscale=2; image_yscale=2; image_speed=0`; hides hammer_of_justice_enemy.
- **Step_0 con==0 (Gerson leaps in):** timer==1 → `vspeed=-48; snd_play(snd_jump); snd_play(snd_rocket); snd_play(snd_screenshake)`, `obj_shake` shakex/y=2. Each frame spawns afterimage. `vspeed += 0.8` while rising. timer==14 → con=1, `x=obj_growtangle.x; y=cameray(); sprite_index=spr_gerson_dodge_origin_top_bottom`.
- **con==1 (drop onto box top):** over 5 frames `y = lerp(cameray(), obj_growtangle.y - 70, timer/5)`. At timer==5 → con=2, screenshake, obj_shake 2/2.
- **con==2 — THE SQUISH (lines 60-91):**
  - `with(obj_hammer_of_justice_enemy) squishbox = true`.
  - `timermax = 10`.
  - **Frames timer 1..10 (squash in):**
    - `maxscalex = lerp(9, 6, timer/10)`  → target X grows toward wide
    - `maxscaley = lerp(0.2, 1, timer/10)` → target Y starts razor-thin (0.2)
    - `obj_growtangle.image_xscale = lerp(cur, maxscalex, timer/10)`
    - `obj_growtangle.image_yscale = lerp(cur, maxscaley, timer/10)`
    - **Peak squish ≈ xscale 9 (WIDE), yscale 0.2 (THIN).**
  - **Frames timer >10 (settle):** `maxscalex = lerp(5,6,timer/15)`, `maxscaley = lerp(1.2,1,timer/15)`; box eases toward **xscale ~6, yscale ~1**.
  - Gerson rides top: `y = obj_growtangle.y - (35 * obj_growtangle.image_yscale)`.
  - **timer>=15** → spawn `obj_gerson_teleport` at (x, y-67) and `instance_destroy()` (Gerson teleports away, leaving the flattened board).

### B2 — SLASH blade: obj_gerson_swing_down (the sweeping slashes across the flattened board)
Spawned via scr_spearshot arg3==4 (→ obj_gerson_teleport type=2, swingdowntype passed) — Alarm_0 lines 25-75 create obj_gerson_swing_down at the teleport with `image_angle = image_angle-90`.
- **Sprite:** `spr_gerson_swing_down` (4 frames, 52x112) → auto-switches to `spr_gerson_swing_down_loop` (52x112) when image_index>3.5. Scale 2/2, image_alpha 1.4, depth = growtangle.depth+1 (then -999999 after 10f).
- **Create:** `speed=-6; direction=270; friction=0.4; timetoswing=8; grazepoints=4`.
- **event_user(0) sets cadence by swingdowntype** (Other_10):
  - `0`: speed-6, fric0.4 (default, timetoswing 8)
  - `1`: **timetoswing=3** (fast), speed-6
  - `10`: timetoswing=16; `11+`: timetoswing=22, speed-7
  - `-1`: tts22 spd-7; `-2`: tts32 spd-4.7 fric0.17; `-3/-4/-5`: tts999 spd-4.7 fric~0.17-0.2 (held telegraph variants)
- **Swing mechanic (Step_0):** rises then at `image_index>1` (con 0→1): `active=1`, lunge `x/y += lengthdir(30, direction)`, `speed=45` (30 if angled), `friction=10`. Blade slams down through the board, `image_alpha -= 0.2` per frame, plays `snd_impact` at alpha 1.2, deactivates ≤0.8, destroys <0.
- **Telegraph (Draw_0):** on `eye_con`, spawns 4 `obj_afterimage_gerson` + `snd_eye_telegraph`, and an `obj_gerson_growtangle_telegraph` rectangle showing the hit column/zone. Column x-position picked per swingdowntype / Gerson x — this is how the **safe gap** is defined (telegraph rect covers the slashed portion; the uncovered strip is safe).
- **Swing sounds:** `motor_upper_quick_mid` (timetoswing+2), `motor_swing_down` (timetoswing+5), `snd_impact` on contact.
- **L→R / R→L sequencing** is driven by the boss attack-pattern data (repeated `scr_spearshot(dx, dy, swingdowntype, 4)` calls stepping the x-offset across the board and alternating side/angle) — the swing object itself only knows its single column + cadence.

### B3 — box_hit_controller (the STAR side-barrage — distinct from the slashes)
Spawned by scr_spearshot arg3==5.
- **Create:** `timer=15; con=choose(0,1); count=7; countmax=7; first=0`.
- **Step_0:** timer==16 → hide enemy, teleport in. Every cycle at **timer==25**: `count--` (7 volleys); alternate side — con==0 spawns **leftgerson** at `(obj_growtangle.x-180, y+20)` type=1; else **rightgerson** at `(x+180, y+20)` type=1 (xscale -2). Toggles con each time (50% random reshuffle). So volleys alternate **left→right→left…** matching "left side to right, then right to left." `count==-1` → `global.turntimer=12`. timer==36 → final teleport type=10, destroy.
- type=1 teleport (obj_gerson_teleport Alarm_0 lines 6-23) spawns **obj_gerson_box_hit** at ±70 from the side.
- **obj_gerson_box_hit** (sprite `spr_gerson_swing`, scale 2): at con0 timer 16-20 winds up (`image_index+=0.5`, `motor_upper_quick_mid`), timer==20 → `snd_queen_punched_lower`, `scr_shakeobj`, directional box shake, then fires one of `rand=choose(1..6)` patterns of **10 `obj_box_hit_bullet`** across a column at `(obj_growtangle.x ± 80, obj_growtangle.y-70 + 15*i)` for i=0..9.
  - Bullets: `direction = 0 (from left) or 180 (from right)`, `speed ≈ 4-7.6`, `friction = 0.14` → they **decelerate and STOP before the far edge** ("stopping before they hit the edge"), destroyed when `speed<1`. Certain rows are slowed (`speed 2-3, friction 0.08`) to open **safe gaps** ("keeping only a small area safe").
  - **obj_box_hit_bullet** = `spr_gerson_star7` (16x16 spinning star), `image_angle += 10`/frame, grows in via scr_lerpvar over 5-10f. NOT a blade — this is the star version.

---

## KEY SPRITE/SIZE REFERENCE (sprites.tsv: name, frames, w, h, xorigin, yorigin)
- spr_gerson_hammer_trowable4 = 1, 15, 18, 6, 10  (giant hammer & normal thrown hammer sprite)
- spr_gerson_gigahammer_mask = 1, 15, 18, 6, 10
- spr_gerson_hammer_throw = 3, 68, 55, -5, 19  (Gerson throwing pose)
- spr_gerson_swing = 7, 101, 96, 21, 43  (Gerson swing pose, used by box_hit + box rotate hit)
- spr_gerson_swing_down = 4, 52, 112, 0, 0 ; spr_gerson_swing_down_loop = 2, 52, 112, 0, 0  (SLASH blade)
- spr_gerson_star7 = 1, 16, 16, 8, 9  (box_hit_bullet star)
- obj_gerson_hammer_bro_hammer default sprite = spr_gerson_hammer_trowable4, parent obj_regularbullet
- obj_growtangle default sprite = spr_battlebg_0, collision obj_battlesolid
