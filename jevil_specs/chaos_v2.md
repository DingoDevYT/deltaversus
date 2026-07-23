# Jevil "CHAOS, CHAOS!" Finale (type 77) — Fine-Fidelity Re-Extract

Source: Chapter 1 GML. Angles are GML y-up (image_angle 0 = right, CCW positive).
Controller block: `gml_Object_obj_dbulletcontroller_Step_0.gml:1466-1674` (type==77).
`btimer += 1` runs every frame at top of Step: line 1.

---

## 0. PORTER'S BUGS — direct answers

### BUG 1 — SPRITE for the falling scythes
The normal falling scythes AND the giant final scythe are the SAME object
(`obj_laserscythe`) and use the SAME sprite drawn at different scale:

- Sprite drawn = **`spr_joker_scythebody`** (48 x 45 px, origin 22,21) — see
  `gml_Object_obj_laserscythe_Draw_0.gml:2` (`draw_sprite_ext(spr_joker_scythebody, ...)`).
- Collision mask = **`spr_joker_scythebody_mask`** (46 x 43 px, origin 21,20),
  set in Create line 13.
- **`spr_jokerscythe_big` (72 x 67, origin 32,33) is NOT used in the finale.**
  It belongs to `obj_bigscythe` (the orbiting-scythe phase), drawn in
  `gml_Object_obj_bigscythe_Draw_0.gml:1`. Using it for the finale is the wrong sprite.
- Normal falling scythe: `spr_joker_scythebody` at `scale = 2` (48*2 = 96px visual),
  Create lines 8-9 & 20.
- Giant final scythe ("lastscythe"): STILL `spr_joker_scythebody`, at
  `image_xscale = image_yscale = scale = 16` (48*16 = 768px visual), controller lines 1611-1613.

### BUG 2 — LIGHT BEAM / PILLAR (spr_tallpx)
When a scythe reaches the floor it converts itself into an upward pillar of light.
All in `gml_Object_obj_laserscythe_Step_0.gml`.

- Sprite/mask swapped to **`spr_tallpx`** (5 wide x **640 tall**, origin 2,0 = top-center).
  Step lines 21-22. It is a tall vertical column; y is snapped to `0` (top of room),
  origin-y 0 so it hangs the full room height downward. `image_angle = 0`, `image_yscale`
  stays at its Create value **2** (never changed) → 640*2 = 1280px tall column.
- Trigger: `y >= room_height - 100 && explode == 0` (Step line 9). Also plays snd_scytheburst.
- GROW (explode==1, Step 28-38): `image_xscale += 8` **per frame**. Beam is NOT damaging
  until `image_xscale >= 16` (`active = 1`, line 33-34). At `image_xscale >= 32` → `explode = 2`.
  Width = 5 * xscale, so damaging when 80px..160px wide.
- SHRINK / DISAPPEAR (explode==2, Step 40-52): **`image_xscale -= 4` per frame** —
  the beam shrinks WIDTH-WISE. When `image_xscale <= 16`: `image_alpha -= 0.25` and
  `active = 0` (hitbox off). When `image_xscale <= 0`: `instance_destroy()`.
  So the hitbox literally shrinks with the visible width and turns off at xscale 16, gone at 0.
- Damage = 124 (Create line 6). Damage handler: `obj_laserscythe_Other_15.gml` (only if active==1).

### BUG 3 — THE GIANT FINAL DEVILSKNIFE
Controller lines 1599-1625, spawned at `jokertimer == 130` (special==2).

- Object `obj_laserscythe` → sprite `spr_joker_scythebody` at scale 16 (see BUG 1).
- Spawn position: `(XView + 320, -320)` — horizontally centered, well above the screen.
- Fall: `vspeed = 1`, `gravity = 0.02`, `rotspeed = 0` (no spin), `image_angle = 160`,
  `remrot = 160`. Very slow accel → it never reaches the floor before whiteout ends
  (easy to dodge, can't reach the bottom lanes).
- Horizontal jitter each frame from jokertimer>=131: `x = xstart + random(8)` (lines 1629-1630).
- SFX: **`audio_play_sound(snd_rumble, 50, 1)`** at spawn (line 1605), looping, held in `rumnoise`.
  Gain fades out later (special==3) via `audio_sound_gain(rumnoise, vol, 0)`.
- WHITEOUT is created the SAME frame (line 1619-1624) but fades in slowly AFTER the scythe
  is already falling: `fadewhite = obj_marker`, `sprite = spr_tallpx`, `image_xscale = 400`
  (5*400 = 2000px wide full-screen), `image_yscale = 2`, `depth = -100`, `image_alpha = -0.3`,
  at `(XView+320, YView-40)`. Fade-in: `image_alpha += 0.01` per frame (line 1632-1633).
  At alpha>=1 destroy darkfader + lastscythe; at alpha>=1.3 → special=3 (fade back out).
  ORDER: giant scythe + rumble + whiteout all spawn f130; scythe falls ~100+ frames while
  the white slowly covers the screen; then white fades out and the turn ends.

---

## 1. FULL TIMELINE (type 77) — realtimer / jokertimer frames

special==0 (first frame, lines 1473-1494):
- `snd_play(snd_joker_byebye)`; init rank=16, realtimer=0, chase=0, made=0, amount=0.
- Create `darkfader = scr_dark_marker(XView+320, YView-10, spr_tallpx)`:
  depth 2, image_alpha 0, image_blend c_black, image_xscale 200, image_yscale 2 (black backdrop).

realtimer 0-9 (lines 1496-1509): darkfader alpha +=0.1; battlesolid alpha -=0.1;
  heart y+=16, boundaryup=160 (box fades black, soul drops to bottom).
realtimer 10 (1511-1515): `instance_destroy` obj_battlesolid.
realtimer 20 (1518): scythe at `XView+40` (lane 0), y=-60.
realtimer 40 (1521): scythe at `XView+570`, y=-60.

realtimer >= 60 && amount < 30 — MAIN SCYTHE-RAIN (lines 1523-1554):
- Cadence gated by `btimer >= rank`; rank starts 16, `rank -= 1` each spawn until floor of 7.
- 5 lanes: `x = XView + 40 + 90*which`, which = floor(random(5)) (0..4) → 40,130,220,310,400.
  Re-rolls once if which==prevmake.
- SOUL-CHASE: every 3rd spawn (`chase == 3`) `which = floor((obj_heart.x + 8) / 90)` — aims the
  lane at the soul — then chase reset to 0. chase increments each spawn.
- Doubles: which==1 also spawns lane at `XView+490` (40+450); which==0 also spawns `XView+580` (40+540).
- amount++ per cycle, up to 30.

amount >= (29 - made) && special==1 (lines 1556-1569):  ( `made` grows +0.2 per graze,
  see `obj_laserscythe_Step_0.gml:54-59` → `with(obj_dbulletcontroller) made += 0.2` )
- Spawn `jokerin = obj_joker_teleport` at `(XView+320, YView+100)`, `type = 66`, `depth = -30`
  (Jevil's teleport-in appearance; type 66 = visual only, no bullets, no "oh"). special=2, jokertimer=0.

special==2 — jokertimer waves (lines 1571-1648):
- jokertimer 10: `snd_play(scr_84_get_sound("snd_joker_neochaos"))`.
- 40 & 98:  scythes at XView+40 and XView+580.
- 46 & 86:  scythes at XView+130 and XView+490.
- 52 & 80:  scythes at XView+220 and XView+400.
- 66 & 98:  scythe  at XView+310 (center).
- jokertimer 130: GIANT scythe + snd_rumble + fadewhite whiteout (see BUG 3).
- jokertimer >= 131: whiteout alpha +=0.01; giant scythe x-jitter; alpha>=1 → kill darkfader+giant;
  alpha>=1.3 → special=3.

special==3 (lines 1651-1671): recenter heart to (XView+320, YView+120); vol -=0.1 → rumble gain fades;
  fadewhite alpha -=0.1; at alpha<=0: `audio_stop_sound(rumnoise)`, `global.turntimer = 11`, special=4 (END).

`realtimer += 1` every frame (line 1673).

---

## 2. SFX — every sound + its event
| Sound | When | File:line |
|-------|------|-----------|
| `snd_joker_byebye`   | special==0, very first frame of type 77            | dbullet Step 1475 |
| `snd_scytheburst`    | each scythe hits floor (stop+replay)               | obj_laserscythe_Step_0 11-12 |
| `snd_joker_neochaos` | jokertimer==10 (via scr_84_get_sound)              | dbullet Step 1576 |
| `snd_rumble`         | jokertimer==130, `audio_play_sound(snd_rumble,50,1)` looped, held in rumnoise; gain-faded then stopped in special==3 | dbullet Step 1605 / 1660 / 1667 |
| `snd_swing`          | obj_joker_teleport appears/vanishes (con 0 & con 4) | obj_joker_teleport_Step_0 5-7, 94-96 |
| `snd_joker_oh`       | joker_teleport con==1 ONLY if type<3 (so NOT for the type-66 finale spawn) | obj_joker_teleport_Step_0 32 |

Porter note: finale opens on `snd_joker_byebye` (not neochaos); `snd_joker_neochaos` fires
later at jokertimer 10 after Jevil teleports in; `snd_rumble` is tied ONLY to the giant scythe;
`snd_scytheburst` fires on every pillar impact. Do not swap these.

---

## KEY NUMBERS (quick reference)
- Falling scythe: obj_laserscythe, spr_joker_scythebody 48x45 (mask spr_joker_scythebody_mask 46x43), scale 2, vspeed 5, gravity 1, rotspeed 14, image_angle random(360), damage 124.
- Giant scythe: SAME sprite spr_joker_scythebody at scale/xscale/yscale 16 (NOT spr_jokerscythe_big); spawn (XView+320,-320); vspeed 1, gravity 0.02, rotspeed 0, angle 160; x-jitter xstart+random(8).
- Pillar: spr_tallpx 5w x 640h (origin 2,0 top-center); on impact y=0, angle 0, yscale stays 2 (1280px tall); GROW xscale +=8/frame, damaging (active) at xscale>=16, explode2 at >=32.
- Pillar SHRINK: xscale -=4/frame; alpha -=0.25 & active(hitbox) OFF at xscale<=16; destroy at xscale<=0. Damage 124.
- Whiteout: obj_marker, spr_tallpx, xscale 400 (~2000px), yscale 2, depth -100, alpha start -0.3, +=0.01/frame; kills darkfader+giant at alpha>=1, special=3 at alpha>=1.3, fades out -=0.1/frame.
- Rumble: snd_rumble looped (audio_play_sound(...,50,1)) at f130; gain fades in special==3; audio_stop at end.
- Timeline: f0 byebye+darkfader; f0-9 box fade/heart drop; f10 destroy battlesolid; f20 & f40 warmup scythes; f60+ rain (btimer>=rank, rank 16→7, 5 lanes @XView+40+90*which, chase==3 targets soul, amount→30); amount>=29-made → joker_teleport t66 @center; jokertimer waves 40/46/52/66/80/86/98; f130 giant+rumble+whiteout; whiteout done → turntimer=11 end.
- SFX order: joker_byebye → scytheburst(per hit) → joker_neochaos(jokertimer10) → rumble(f130). swing = teleport in/out.
