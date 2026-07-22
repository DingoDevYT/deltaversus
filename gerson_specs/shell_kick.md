# Gerson "Shell Kick" (Pinball) Attack — EXACT Port Spec

Source objects (DELTARUNE Ch4 GML):
- `obj_gerson_shell_kick_controller` (Create_0, Step_0, Step_1, Step_2)
- `obj_gerson_shell_pinball` (Create_0, Step_0, Draw_0, Other_15, CleanUp_0)
- Invocation: `obj_hammer_of_justice_enemy_Other_10.gml`

GML angle convention: 0=right, 90=UP, 180=left, 270=DOWN. GML colors are BGR ints
(R=int&255, G=(int>>8)&255, B=(int>>16)&255).

---

## INVOCATION

- Attack patterns **16** and **72** call `scr_spearpattern(x, y, 60, 52, 9999)`
  (`gml_Object_obj_hammer_of_justice_enemy_Other_10.gml:945` and `:2262`).
- The special code **52** routes through `scr_spearshot`:
  `gml_GlobalScript_scr_spearshot.gml:695-698` → `else if (arg3 == 52) { instance_create(arg0, arg1, obj_gerson_shell_kick_controller); }`.
- (Attackpattern `52` itself at `:2020` is an UNRELATED spear pattern — do not confuse. The
  shell-kick controller is spawned by SPECIAL 52 via patterns 16/72.)

---

## OBJECT HIERARCHY / DEFAULTS (objects.tsv)

- `obj_gerson_shell_pinball`  → sprite `spr_bounce_shell_idle_old2`, parent `obj_regularbullet`, depth 0, visible.
- `obj_gerson_shell_kick_controller` → sprite `spr_gerson_idle`, no parent, depth 0, visible.

---

## CONTROLLER — `obj_gerson_shell_kick_controller`

### Create (`Create_0.gml:1-9`)
```
timer = 0; full_timer = 999; shell_counter = 1; my_flash = -1; ending_counter = 0;
scr_darksize(); image_speed = 0; visible = false; global.turntimer = 9999;
```
`scr_darksize()` = dark-world 2x scale (image_xscale=image_yscale≈2). Controller invisible at start.

### Step (`Step_0.gml`) — timing cadence (per-step `timer++`, `Step_0.gml:12`)
- **timer 12** (`:17-28`): snap to hammer pos `x=obj_hammer_of_justice_enemy.x; y=.y`; `visible=true`;
  `sprite_index=spr_gerson_swing`, `image_index=0`; hide the hammer enemy; `snd_play(snd_boost)`;
  `my_flash=scr_oflash()`; lerp `x → x+48` over 12 frames (ease "out", mode 2).
- **timer 12..23, every 3** (`:30-37`): spawn `scr_oflash()` afterimage, `depth+=1`, `flashcolor=c_lime`
  (c_lime BGR 65280 → **RGB(0,255,0)**).
- **timer 24** (`:39-43`): lerp `image_index 0 → 6` over 12; `snd_play(motor_upper_quick_mid)` (windup).
- **timer 32** (`:45-65`): `snd_play(snd_rudebuster_swing)`; `scr_shakeobj()`; **SPAWN pinball**:
  ```
  instance_create((x+100)-42, (y+90)-86, obj_gerson_shell_pinball)  // = (x+58, y+4)
  scr_bullet_init();  direction = scr_at_player(x, y);  speed = 12;  depth -= 1;
  image_xscale += 0.25;  image_yscale += 0.25;   // on top of darksize base
  active = 1;  target = 3;  damage = 1;  grazed = 0;  grazepoints = 2.5;  destroyonhit = false;
  ```
- **timer 40** (`:67-81`): `shell_counter==1` → hide controller + spawn `obj_gerson_teleport_generic`
  at `(x+58, y+36)` (self-destroys after 7). ELSE `timer=23; shell_counter++` (re-kick loop; default
  fires **only 1 pinball** since shell_counter starts at 1).
- **full_timer** stays 999 until the pinball's final slam sets it to 80 (see pinball `Step_0.gml:89-90`),
  then decrements each step (`:14-15`).
- **full_timer < 4** (`:83-87`): spawn ending teleport puff at `(hammer.x+68, hammer.y+36)`.
- **full_timer < 2** (`:89-93`): `global.turntimer = 1` → ends turn.
- **turntimer < 1** (`:95-104`): destroy teleport puffs, re-show hammer enemy, destroy self.
- Fade-out guard (`:1-10`): if `turntimer<1 || fighting==0`, `image_alpha-=0.2`, destroy at <0.1.

### Step_1 (`Step_1.gml`): couples motion to `obj_growtangle` (moving box). Applies box y-delta to
`obj_heart` (clamped to box) and to `obj_gerson_shell_pinball`; keeps `my_flash.x = x`.
### Step_2 (`Step_2.gml`): `exit;` (no-op).

---

## PINBALL — `obj_gerson_shell_pinball`

### Create (`Create_0.gml`)
```
event_inherited();                              // obj_regularbullet
damage = lerp(12, 90, clamp((global.hp[2]-30)/250, 0, 1));   // :2-7
left_timer = -1; right_timer = -1; top_timer = -1;
image_speed = 8; timer = 0; im_done = false;
xpprevious = x; ypprevious = y; gerson_x = x; gerson_y = y;
counter = choose(0, -1);                        // :18  START kick-count 0 OR -1 (random)
grazetimer = 0; grazepoints = 4;
check_bounds(dir) = ray-march 0..200px in `dir` step 2, TRUE if any point inside growtangle box
                    (x∈[gt.x-72, gt.x+72], y∈[gt.y-75, gt.y+75]);   // :22-34
```
Sprite `spr_bounce_shell_idle_old2` (45x45, 14 frames, origin 22,22). Spins via `image_speed`
which decays each step: `image_speed = scr_approach(image_speed, 0.5, 0.4)` (`Step_0.gml:13`).

### Draw (`Draw_0.gml`) — motion-trail (green fog)
Two `d3d_set_fog(true, c_lime,…)` passes drawing the shell at `xpprevious/ypprevious` (alpha 0.5) and
`xprevious/yprevious` (alpha=image_alpha) at 0.85 scale, then `draw_self()`. c_lime = **RGB(0,255,0)**.
Trail history advanced each Draw.

### Trailing star bullets (`Step_0.gml:15-38`) — every 4 steps while airborne
`if ((timer%4)==0 && !top_timer)` fire `spr_thrash_star` (26x24, origin 13,13) at shell pos:
darksize, scale 1.5→0 over 4 (delayed 22), self-destroy at 26, spinspeed 15, damage=lerp(12,90,…),
armor-id-23 → damage*0.15.

### WALL BOUNCE — box left/right (the "kicks")
- Left trigger (`:308-309`): `x < gt.x-73 && hspeed<0 && left_timer==-1` → `left_timer=0`.
- Right trigger (`:311-312`): `x > gt.x+92 && hspeed>0 && right_timer==-1` → `right_timer=0`.
- Timers increment each step. Bounce state machine (`left_timer` `:323-385`, mirror `right_timer` `:387-448`):
  - **case 1**: record projected gerson spawn `gerson_x=x+hspeed*6, gerson_y=y+vspeed*6`; spawn teleport puff.
  - **case 5**: spawn `obj_battle_marker` w/ `spr_gerson_swing` frame 3→6 over 6 (the KICK visual;
    left flips xscale `*-1`), self-destroy at 10.
  - **case 7 = THE KICK** (`:349-377`): `snd_play(snd_queen_punched_lower)`; `counter++`;
    - IF `counter < 7`: **re-aim** `direction = scr_at_player(x,y)`; then 50% chance (`irandom(1)`)
      to instead aim at a bank-shot that reflects off box top/bottom via `check_bounds` +
      `point_direction` to mirrored heart-y (`:357-364`). **Speed ramp:** `speed = scr_approach(speed, 15, 1.5)`
      (ramps toward 15 by +1.5 per kick). `image_speed = 8` (re-spin).
    - ELSE (`counter >= 7`, i.e. the 8th kick / after 7 bounces): aim at top-right launch anchor
      `point_direction(x,y, scr_get_box(4), scr_get_box(1)-80)`, `speed = dist/30`, `top_timer = 0`
      → begins the SLAM sequence.
  - **case 15**: spawn trailing teleport puff; reset `left/right_timer = -1`.

### CEILING / FLOOR bounce (soft, while `counter < 7`) — `Step_0.gml:40-80`
Only when `x` inside box x-range. On hitting `scr_get_box(3)-16` (floor, vspeed>0) or
`scr_get_box(1)+16` (ceiling, vspeed<0): squash-stretch (xscale*1.5 / yscale*0.5 over 3, ease),
delayed velocity flip `vspeed → -vspeed` at frame 6, zero velocity meanwhile,
`snd_play(snd_parry_fast_nodelay)`, nudge box `obj_growtangle.y ±10`.

### SLAM sequence — `top_timer` state machine (`Step_0.gml:450-511`)
- **case 0** (`:452-471`): lerp `image_angle += 270` over 30; spawn `spr_gerson_swing_down_new` marker
  at `(scr_get_box(4), scr_get_box(1)+80)` depth `growtangle.depth+1`, fade in over 4, image_index 0→1
  over 6, rise `y → y-240` over 29 (ease out), `snd_play(snd_jump)`.
- **case 29** (`:473-484`): marker drops — depth `growtangle.depth-1`, image_index 2→4 over 2, `y→y+80` over 8.
- **case 30 = SLAM** (`:486-501`): `scr_shakescreen()`; `snd_play(snd_queen_punched_lower_heavy)`;
  `snd_play(snd_rudebuster_swing)`; two `scr_sonic_boom(270, 2)`/`(270, 3)`;
  **`direction = 270` (down), `image_angle = 90`, `speed = 30`, `image_speed = 8`.**
- **case 36** (`:503-510`): destroy the swing-down marker.

### IMPACT STARBURST — pinball hits floor with `top_timer >= 20` (`Step_0.gml:82-306`)
Trigger: `y > scr_get_box(3)-16 && top_timer >= 20` → snap `y=scr_get_box(3)-16`.
- `snd_play(snd_explosion_firework)`; `snd_play(snd_stardrop, 0.5, 0.75)`; `scr_shakescreen()`.
- Tell controller `full_timer = 80` (`:89-90`) → starts turn-end countdown.
- `spr_finisher_explosion` marker (314x227, 7 frames) index→6 over 6, gone at 6 (`:92-100`).
- **Launch smoke** (`:102-126`): `spr_launchsmoke` (23x26), a from -6..5 (skip 0) = 11 puffs,
  random angle, xscale/yscale 1+abs(a)*0.5, gravity down (abs(a)*0.05+rand), hspeed a*3, all lerping out.
- **4 STAR ARCS** — sprite `spr_gerson_star7` (16x16, 1 frame, origin 8,9). Each star:
  `active=false` (activates frame 11), `image_blend=c_gray` then ramp
  `10855845→13421772→15921906→16777215` at frames 8/9/10/11
  (BGR: **RGB(165,165,165)→(204,204,204)→(242,242,242)→(255,255,255)** white), spinspeed 15,
  grazepoints 2, damage=lerp(12,90,…) (armor-23 → *0.15), darksize, scale 1.5 (50% chance 1.0),
  `direction += random_range(-1,1)`, `speed += random_range(-1,1)`, `hspeed *= 0.5`,
  **`gravity_direction = 270` (down)** — stars fire UP (dir≈90) and rain back down (fountain).

  | Arc | Loop (`a`)      | Count | Spawn x | direction   | speed  | gravity | spread/step |
  |-----|-----------------|-------|---------|-------------|--------|---------|-------------|
  | 1   | -2 .. 1         | 4     | x       | 90 + 4*a    | 12.0   | 0.535   | 4°          |
  | 2   | -5 .. 4         | 10    | x + 24  | 90 + 7*a    | 13.25  | 0.5     | 7°          |
  | 3   | -4 .. 3         | 8     | x       | 90 + 6*a    | 14.5   | 0.465   | 6°          |
  | 4   | -3 .. 2         | 6     | x - 24  | 90 + 5*a    | 15.75  | 0.43    | 5°          |

  (Total 28 stars. All ± up to 1 jitter on dir & speed. Faster arcs = flatter gravity.)
- After starburst: `im_done = true` → pinball freezes (Draw/Step early-exit), controller ends turn.

### Collision / Damage (`Step_0` in `_Step_0.gml` of pinball via parent + `Draw`/Other_15)
`obj_gerson_shell_pinball_Step_0` is the bounce logic above; damage each active step:
`damage = lerp(12,90,clamp((hp[2]-30)/250,0,1))`, `active` → `scr_damage_all()` when `target==3`.
### CleanUp (`CleanUp_0.gml`): destroy all `shell_controlled` `obj_battle_marker` instances.
### Other_15 (Animation End): `scr_darksize()`-related reset (bullet housekeeping).

---

## ASSET LIST

### Sprites (sprites.tsv: name  frames  w  h  originX  originY)
- `spr_bounce_shell_idle_old2` — 14, 45x45, origin 22,22   (the pinball shell)
- `spr_gerson_swing`           — 7, 101x96, origin 21,43   (windup + kick markers)
- `spr_gerson_swing_down_new`  — 5, 52x112, origin 28,62   (slam-down marker)
- `spr_gerson_star7`           — 1, 16x16, origin 8,9      (starburst stars)
- `spr_thrash_star`            — 1, 26x24, origin 13,13    (trailing stars)
- `spr_finisher_explosion`     — 7, 314x227, origin 158,117 (impact flash)
- `spr_launchsmoke`            — 1, 23x26, origin 12,14    (impact smoke)
- `spr_gerson_idle`            — 14, 67x39, origin 0,0     (controller default, unused visually)

### Sounds (sounds.tsv)
- `snd_boost`                       (audio_sfx)        — timer 12 appear
- `motor_upper_quick_mid`           (default)          — timer 24 windup
- `snd_rudebuster_swing`            (audio_sfx)        — timer 32 launch AND slam
- `snd_queen_punched_lower`         (default)          — each wall kick
- `snd_parry_fast_nodelay`          (default)          — soft ceiling/floor bounce
- `snd_jump`                        (audio_sfx)        — slam rise
- `snd_queen_punched_lower_heavy`   (default)          — slam impact
- `snd_explosion_firework`          (default)          — starburst
- `snd_stardrop`                    (default, vol 0.5 pitch 0.75) — starburst

### Other objects referenced
`obj_gerson_teleport_generic` (spawn/despawn puffs), `obj_battle_marker` (kick/slam visual markers,
tagged `shell_controlled`), `obj_growtangle` (the moving battle box), `obj_heart` (soul),
`obj_regularbullet` (bullet parent), `obj_hammer_of_justice_enemy` (Gerson).
