# Gerson — Hammer Throw (Hammer Bro) — EXACT PORT SPEC

Source: `DELTARUNE Chapter 4 - GML`. All refs are `file:line`.

Two related delivery systems use the same projectile object `obj_gerson_hammer_bro_hammer`:
1. **`obj_gerson_hammer_bro_attack_controller`** — the standalone "hammer bro" throw attack (patterns 0/1/2). This is the primary attack this spec covers.
2. **`obj_box_throw_controller`** — a longer box-throw sequence that reuses the same hammer projectile and ends with the **giant hammer (gigahammer) finisher**. Covered under TIMING + FINISHER.

`obj_giant_hammer` is a SEPARATE object (the "hammer of justice" shield-break cinematic, spawned from `scr_spearshot`), NOT the hammer-bro finisher. It is documented at the end for completeness but is not part of the thrown-hammer attack.

---

## INVOCATION

- `scr_spearshot.gml:176` — `arg3 == 7` → `instance_create(arg0, arg1, obj_gerson_hammer_bro_attack_controller)`. Spawned at Gerson's overworld position (arg0/arg1). Controller is the on-screen Gerson body during the attack.
- On attack end / turn change, `obj_hammer_of_justice_enemy` Other_24 (`..._Other_24.gml:7-11`) destroys the controller and all live hammers.
- Controller Other_10 (User Event 0) toggles `obj_hammer_of_justice_enemy.visible = true` (the "real" enemy sprite is hidden during attack — Create_0:23-24 sets it invisible).

---

## VISUALS

### Controller (`obj_gerson_hammer_bro_attack_controller`) — Gerson body
- Default sprite: **`spr_gerson_hammer_throw`** (objects.tsv:354). Sprite: 3 frames, 68×55, origin (-5,19) (sprites.tsv:3285).
- `image_xscale = image_yscale = 2` (Create_0:17-18). **Draw at x2.** `image_speed = 0` (manual frame control).
- Draw: plain `draw_self()` (Draw_0:1).
- Frame animation during a throw (Step_0):
  - On throw fire: `image_index = 1`, set `timerb = 3` (Step_0:121-122).
  - `timerb` counts down; when `timerb == 1 && image_index == 1` → `image_index = 2` (Step_0:128-129) (wind-through frame).
  - At `timer == throwsframes*2`: `image_index = 0` (reset to idle) (Step_0:133).
  - At attack end (`lerpdowntimer >= attackduration-20`): `image_index = 0` (Step_0:232).
- Body has a small hop-jump loop in pattern 0 (Step_0:157-201) — sinusoidal `fakey` bob + lerp left/right ±50px, plays `snd_jump` pitch 2.

### Projectile (`obj_gerson_hammer_bro_hammer`)
- Default sprite: **`spr_gerson_hammer_trowable4`** (objects.tsv:231). Sprite: 1 frame, 15×18, origin (6,10) (sprites.tsv:3528). Parent obj_regularbullet.
- Set to `image_xscale = image_yscale = 2` on every spawn (Step_0:18-19 etc). **Draw at x2** (giant variant much larger, see finisher).
- Rotation (Step_0 of hammer):
  - Normal hammer: `anim_index++` each step; when `anim_index == 3` → `image_angle += 40`, reset anim_index (spins +40° every 3 frames) (hammer Step_0:24-28).
  - Gigahammer while rising (`fakevspeed < 0`): `image_angle += 60` per step (fast spin); once falling (`fakevspeed >= 0`): locked to `image_angle = 202.5` (hammer Step_0:17-23).
- Fade-out (normal only): once `y > obj_growtangle.y + 120` → `image_alpha -= 0.3`/step; when `image_alpha < 0.8` → `active = 0` (harmless); `image_alpha < 0` → destroy (hammer Step_0:3-13).
- No custom Draw event on the normal hammer (uses inherited draw). Giant hammer uses same object; its shockwave visuals come from screen shake + sounds (Step_2).

### Colors
- No `image_blend` overrides on the hammer — drawn at default `c_white` (BGR int 16777215 → RGB 255,255,255). No color math needed for this attack.

### Depth / layer order
- Each hammer: `depth = controller.depth - 1` (drawn in front of Gerson) (Step_0:24, Other_10:? , box:112 `depth -= 1`).
- Gigahammer: `depth = box_controller.depth + 1` (behind) (box:238).

---

## MECHANICS (projectile fake-physics)

Bullets use **fake** physics (not GM built-in hspeed/vspeed) so they ignore the bullet-box transform:
- Each step (hammer Step_0:30-35, guarded so a landed gigahammer freezes):
  ```
  x += fakehspeed
  y += fakevspeed
  fakevspeed += fakegravity      // fakegravity = 0.6
  ```
- Terminal fall clamp: `if (fakevspeed > 11) fakevspeed = 11` (hammer Step_0:49-50).
- `gravity_direction = 270` is set but the real gravity is the manual `fakegravity` add (270 = "up" in GM, matched by negative-then-positive fakevspeed producing an arc).
- Off-top nudge before drop: while `!drop` and `y < cameray()+20` → `x += 1; y += 2` (keeps it from flying off top) (hammer Step_0:52-59).

### Spawn position
- Controller throw: `instance_create((x + 100) - 42, (y + 90) - 86, ...)` = **offset (+58, +4)** from controller x/y (Step_0:12,54,87). (Other_10 variant uses raw `x+100, y+90`.)

### Targeting / homing
- No continuous homing. Aim is **encoded into `fakehspeed` at spawn** (see pattern formulas). Certain shots re-aim once based on `obj_heart.x` vs `obj_growtangle.x` (the bullet box center ±37.5) — see NUMBERS.
- `target = 3` on every hammer → collision calls `scr_damage_all()` (hits whole party) (hammer Other_15:9-12).

### Damage / graze
- `damage = 1` at spawn, but collision (Other_15) recomputes: `a = clamp((global.hp[2]-30)/250, 0..)`, `damage = lerp(12, 90, a)` (hammer Other_15:1-6). So real damage scales 12→90 with party HP.
- `grazepoints = 2.5`, `grazed = 0` (Step_0:28). `destroyonhit` default true → hammer destroyed on hit (Other_15:14-16); gigahammer sets `destroyonhit = false` (box:234).

### Lifetime
- Normal hammer self-destroys when it fades below `image_alpha < 0` after passing the box bottom, or is mass-destroyed at turn end (Other_24).

---

## TIMING — controller cadence (`..._Step_0.gml` + `_Alarm_0.gml`)

Create defaults (Create_0): `throwsframes = 5`, `pausecount = 10`, `attackduration = 240`, `pattern = choose(0,1,2)`.

Per-step `timer++`. A **throw fires at `timer == throwsframes`** (Step_0:3), animation resets and `count++` at `timer == throwsframes*2` (Step_0:131-134).

- **Shots per throw event:** 1 base hammer, PLUS (when `throwsframes != 1`) 2 additional hammers → **up to 3 hammers per throw** (Step_0:52-119). In pattern 0 `throwsframes = 6` so all 3 fire; in patterns 1/2 `throwsframes = 1` so only 1 fires.
- After each throw, `count++`. When `count >= pausecount(10)`: reset count=0 and branch (Step_0:136-155):
  - pattern 0: `timer = -11; alarm[0] = 30` (long pause, re-pick).
  - pattern >0: `timer = -23; alarm[0] = 5`.

### Alarm_0 (pattern re-selection) — `..._Alarm_0.gml`
- Rotates pattern: 0→choose(1,2); 1→choose(0,2); 2→choose(0,1) (Alarm_0:3-8).
- `forcepattern` increments while pattern>0; after 3 forced non-zero it forces pattern 0 (Alarm_0:10-19).
- Sets tempo: pattern>0 → `timer=-20, throwsframes=1` (fast single shots; `timer=-(5+irandom(5))` if forcepattern>1). pattern 0 → `timer=0, throwsframes=6` (slow triple shots) (Alarm_0:21-36).

### Pattern differences (hspeed aim)
- **Pattern 0** (default/triple): base `fakehspeed = -2 - random(4.8)`; slow lob, 3 hammers, wide bob movement.
- **Pattern 1**: `fakehspeed = -2.8 - (count / 4)` (Step_0:33-34) — angle tightens as count rises.
- **Pattern 2**: `fakehspeed = -6.8 + (count / 3)` (Step_0:36-37) — starts steep, opens up.
- On `count == 2 || 4` (all patterns), re-aim toward heart (Step_0:39-49). See NUMBERS.

### End of attack
- `lerpdowntimer++` each step. At `lerpdowntimer == 1`: Gerson hops (`vspeed = -14, gravity = 2`) (Step_0:220-227).
- At `lerpdowntimer >= attackduration-20 (=220)` and not mid-hop: clamp `global.turntimer` to 20, `endtimer++`, big jump `vspeed = -20.6` and eventually `instance_destroy()` (Step_0:203-248). Attack ends when `global.turntimer < 1` (Step_0:247-248).

### GIANT HAMMER FINISHER (`obj_box_throw_controller` phases)
Long variant sequence (`..._box_throw_controller_Step_0.gml`):
- **Phase 0** (:78-133): 16 throw-events, each spawns `hammer_amount = 3 + irandom(1)` hammers, aimed across the box by index `a`; `hammer_timer_goal` gates each throw. After 16 → phase 1 (`hammer_timer = -12, goal = 3`).
- **Phase 1** (:135-189): 25 single fast hammers (`image_xscale/yscale ++` → x3 size), aim sweeps via `sin(full_timer*0.325)*80`. Every 5th adds `-4` timer skip. After 25 → phase 2.
- **Phase 2 finisher** (:191-256):
  - `hammer_timer == 1`: Gerson jump-arc (`scr_jump_arc`), boost sfx, oflash afterimage.
  - `hammer_timer == 9`: spawn the **GIGAHAMMER** (box:225-243): `image_xscale/yscale += 6` (base 2 +... actually base then +6 → very large), `mask_index = spr_gerson_gigahammer_mask` (15×18 origin 6,10, sprites.tsv:4775), `fakehspeed = -abs((x - obj_growtangle.x)/25.5)` (homes on box center, gentle), `fakevspeed = -16`, `fakegravity = 0.6`, `gigahammer = true`, `destroyonhit = false`, `depth = controller.depth + 1`.
  - `hammer_timer == 36`: Gerson switches to `spr_gerson_spin`, moves +60,+60.

### Gigahammer landing (`obj_gerson_hammer_bro_hammer` Step_0 + Step_2)
- Rises spinning (+60°/step) until `fakevspeed >= 0`, then locks `image_angle = 202.5` and, on first frame falling & `!drop`: zeroes all speeds, `drop = true`, `alarm[0] = 12` (hammer Step_0:37-47).
- **Alarm_0** (hammer): `gravity_direction = 270; gravity = 2;` play `snd_fall` pitch 2 — the giant hammer then falls with real gravity (hammer Alarm_0:1-3).
- **Step_2** (hammer, gigahammer only): pushes `obj_growtangle` (the box) and `obj_heart` downward with it while `y > box.y+20` (crushing effect); when it passes `YView+220` → `true_drop`, `vspeed = -16`, play `snd_impact` + `snd_metal_hit_reverb` pitch 1 + `scr_shakescreen()`; when past `YView+720` → `scr_shakescreen`, `snd_glassbreak` pitch 0.5, `snd_explosion_firework` pitch 0.75, destroy (hammer Step_2:1-34).

---

## ASSET LIST

### Sprites (name — frames, w×h, origin)
- `spr_gerson_hammer_throw` — 3, 68×55, (-5,19) — Gerson body during throw (controller default).
- `spr_gerson_hammer_trowable4` — 1, 15×18, (6,10) — the thrown hammer (projectile default).
- `spr_gerson_gigahammer_mask` — 1, 15×18, (6,10) — collision mask for the giant finisher hammer.
- `spr_gerson_hammer_throw2` — 2, 101×96, (21,43) — (alt throw pose, referenced elsewhere).
- (finisher extras) `spr_gerson_spin` — Gerson spin pose after gigahammer; `obj_oflash` afterimages, `c_lime` flash.
- Related lower tiers exist: `spr_gerson_hammer_trowable2` (18×23), `..._trowable3` (16×20) — smaller hammer variants used by other Gerson attacks.

### Sounds
- `snd_smallswing` — swing on each throw (`snd_play_pitch(snd_smallswing, 1 + random(0.3))`).
- `snd_jump` — Gerson hop / jump (pitch 2).
- `snd_fall` — gigahammer starts falling (pitch 2).
- `snd_impact` — gigahammer crushes box.
- `snd_metal_hit_reverb` — gigahammer metal clang (pitch 1).
- `snd_glassbreak` — gigahammer final smash (pitch 0.5).
- `snd_explosion_firework` — gigahammer final smash (pitch 0.75).
- (finisher extras) `snd_boost`, `motor_upper_quick` (giant_hammer obj), `snd_break2`, `snd_punchheavythunder`.

### `obj_giant_hammer` (separate — shield-break cinematic, NOT this attack)
Spawned by `scr_spearshot.gml:9` at `obj_heart.x-20, obj_heart.y-20`. Create: `damage=40, image_angle=180, image_alpha=0, depth=-99999, fakehspeed=-10`. Multi-phase swing (con 0/1/2) with dir-based angle lerps, breaks `obj_spearblocker`, spawns pieces, `spr_finisher_explosion` on heart. Draw_0 double-draws with `d3d_set_fog` white flash (`fadealpha`). Included for reference only.
