# Jevil — SPADES attacks (types 70 / 71 / 65 / 68)

Exact port spec from decompiled DELTARUNE Chapter 1 GML.
Dispatch: `obj_joker` Other_15 (`gml_Object_obj_joker_Other_15.gml`) creates `obj_dbulletcontroller`, sets `dc.type`, `dc.damage = global.monsterat[myself] * 5`, and later `joker = 1` (line 209).
Controller logic: `gml_Object_obj_dbulletcontroller_Step_0.gml`. `btimer += 1` every frame (line 1). All four spade types live inside `if (joker == 1)` (line 1001).

Angle convention: GML angles are y-up. `vx = spd*cos(dir°)`, `vy = -spd*sin(dir°)`. `lengthdir_x(r,a)=r*cos(a)`, `lengthdir_y(r,a)=-r*sin(a)`.
Scale note: Jevil sets raw `image_xscale/yscale` on bullets (values below are baseline GML). Our port uses JS(g)=g/1.6 for gravity; bullet scales carry over 1:1 unless noted.

---

## TYPE 70 & 71 — obj_joker_teleport clones (throw bullets)

Dispatched: jattack 0 → type 70 (grazepoints 2), jattack 12 → type 71 (grazepoints 2). Both `damage = monsterat*5`.

### Spawn / teleport (dbulletcontroller Step)
- **type 70** (`Step_0.gml:1341-1353`): fires when `btimer >= 20 && global.turntimer >= 30`. Cadence = **20 frames**. Sets `jokern.type = 1` (SPADE fan). One clone per fire.
- **type 71** (`Step_0.gml:1355-1366`): fires when `btimer >= 9 && global.turntimer >= 20`. Cadence = **9 frames**. Leaves `jokern.type = 0` (DIAMOND, default from Create). One clone per fire.
- Clone position (both), `Step_0.gml:1345-1346` / `1359-1360`:
  - `jokerx = choose(battlesolid.x - 100 - random(100), battlesolid.x + 100 + random(100))` → left band [-200,-100] or right band [+100,+200] from arena center.
  - `jokery = choose(battlesolid.y - random(100), battlesolid.y + random(100))` → within ±100 of arena center Y.
  - `scr_bullet_inherit(jokern)` copies damage/grazepoints/timepoints/inv/target. `jokern.active = 0`.

### obj_joker_teleport Create (`gml_Object_obj_joker_teleport_Create_0.gml`)
- `type=0`, `damage=100` (overwritten by inherit), `grazepoints=4`, `timepoints=2`, `inv=60`, `image_xscale=0` (grows in), `image_yscale=2`, `image_speed=0`.
- Sprite faces: if clone x < view center → `spr_joker_teleport_r`, else `spr_joker_teleport` (42x41, 2 frames, origin 21,20).

### obj_joker_teleport Step (`gml_Object_obj_joker_teleport_Step_0.gml`) — appear→fire→vanish
- **con 0** (appear): plays `snd_swing` (restart). `image_xscale += 0.4` until >=2 (≈5 frames), then con 1.
- **con 1** (fire, after `timer >= 8`): if `type < 3` plays `snd_joker_oh`. Sets `image_index = 1`, con 2.
  - **type 0 (DIAMOND, used by dispatch 71)** `Step_0.gml:40-54`: 1 bullet `obj_collidebullet`, `sprite_index=spr_diamondbullet`, `active=1`, `scr_bullet_inherit`. `move_towards_point(heart.x+10, heart.y+10, 8)` → **fast aimed, speed 8**. `image_angle=direction`. Scale **0.7 / 0.7**. No gravity.
  - **type 1 (SPADE fan, used by dispatch 70)** `Step_0.gml:56-75`: loop `i=0..4` → **5 bullets** `obj_collidebullet`, `sprite_index=spr_spadebullet`, `offset=18*i`. Each: `move_towards_point(heart.x+10, heart.y+10, 4.5)` then `direction = (direction - 36) + offset`. Offsets 0,18,36,54,72 minus 36 → **-36,-18,0,+18,+36° fan** around aim. **Speed 4.5** (slow). `image_angle=direction`. Scale **0.4 / 0.4**. No gravity.
- **con 2** → after `timer >= 10` → con 4.
- **con 4** (vanish): plays `snd_swing` again; `image_xscale -= 0.4`, `image_yscale += 0.2` until <=0 → `instance_destroy()`.
- Bullets are `obj_collidebullet`: on hit (`Other_15`) call `scr_damage()` (or `scr_damage_all()` if target==3) then destroy. Straight-line, no gravity/spin.

---

## TYPE 65 & 68 — obj_spadering (spade rings)

Dispatched: jattack 1 → type 65 (grazepoints 3), jattack 7 → type 68 (grazepoints 2). Both `damage = monsterat*5`.

### Spawn (dbulletcontroller Step, inside `joker==1`)
- **type 65** (`Step_0.gml:1287-1297`): fires when `btimer >= 60`. Cadence = **60 frames**. `ring.maxspade = 10`, `ring.grav = 0.4`. (size default 1, side default 0.)
- **type 68** (`Step_0.gml:1325-1339`): sets `obj_heart.wspeed = 5` each step. Fires when `btimer >= 54`. Cadence = **54 frames**. `ring.side = choose(0,1)` (alternating-side mirror), `ring.grav = 0.45`, `ring.maxspade = 10`.
- Both: `instance_create(battlesolid.x, battlesolid.y, obj_spadering)`, then `scr_bullet_inherit(ring)`.

### obj_spadering Create (`gml_Object_obj_spadering_Create_0.gml`)
- `ringno=0`, `maxspade=8` (overridden), `t=0`, `con=0`, `startspade=0`, `spadet=0`, `startang=random(360)`, `grav=0.2` (overridden), `size=1`, `special=0`, `side=0`.

### obj_spadering Step (`gml_Object_obj_spadering_Step_0.gml`)
- **t==0** (build ring): if `size>1` → `startang=-random(180)` (n/a for 65/68, size=1). Loop `i=0..maxspade-1`:
  - `spadeang = (360/maxspade)*i + startang` → for maxspade 10, spades every **36°**.
  - if `side==1` → `spadeang = -spadeang` (type 68 alternates via choose(0,1)).
  - Spawn `obj_collidebullet` at `(lengthdir_x(300, spadeang+180)+battlesolid.x, lengthdir_y(300, spadeang+180)+battlesolid.y)` → placed on **radius-300 ring**, on the far side.
  - Per spade: `sprite_index=spr_spadebullet`, `image_alpha=0`, `active=1`, `image_blend=c_ltgray`, `direction=spadeang`, `image_angle=spadeang`, **`speed=26`**, `image_xscale=image_yscale=size` (=1).
- **t 1..14**: each spade `speed *= 0.87` (decays), `image_alpha += 0.1` (fade in).
- **t==15**: `speed=0`, `image_alpha+=0.1` (ring frozen, fully visible).
- **t>=15, con==0** (release inward one-by-one): `spadet += 1` (`+= 6` more if special==1 — not used by 65/68). When `spadet >= 4` (**every 4 frames**): current `spade[startspade]` → `image_blend=c_white`, `gravity_direction=direction`, `speed=-3.4`, `gravity=grav`. `startspade += 1`; reset `spadet=0`. When `startspade>=maxspade` → con 1, `instance_destroy()`.
  - Net: each spade sits on the ring, then fires with initial `speed=-3.4` (reverses to move outward-then-inward) accelerated by `gravity=grav` along its `direction` (toward/through center). **No image spin** (image_angle fixed at spawn).
- Spades are `obj_collidebullet` (same hit behavior as above).

---

## SPRITES  (REFDATA sprites.tsv: w h ox oy)
- `spr_spadebullet` — 36 x 34, origin 18,17 (sprites.tsv:691)
- `spr_diamondbullet` — 33 x 32, origin 16,15 (sprites.tsv:424)
- `spr_joker_teleport` / `spr_joker_teleport_r` — 42 x 41, 2 frames, origin 21,20 (sprites.tsv:588-589)

## SOUNDS  (REFDATA sounds.tsv)
- `snd_swing` — teleport appear + vanish (sounds.tsv:81)
- `snd_joker_oh` — teleport fire moment, type<3 (sounds.tsv:125)
- Spade rings play no sound of their own; bullets are silent `obj_collidebullet`.

---

## KEY NUMBERS
```
TYPE 70 (jattack0, gp2): clone every 20f (turntimer>=30); 1 teleport clone → type1 SPADE FAN
  fan = 5 spades, dirs aim-36/-18/0/+18/+36, speed 4.5, scale 0.4, NO gravity/spin
  dmg = monsterat*5; sprite spr_spadebullet(36x34); sfx snd_swing+snd_joker_oh
TYPE 71 (jattack12, gp2): clone every 9f (turntimer>=20); 1 teleport clone → type0 DIAMOND
  1 bullet aimed at heart, speed 8, scale 0.7, NO gravity/spin
  dmg = monsterat*5; sprite spr_diamondbullet(33x32); sfx snd_swing+snd_joker_oh
TYPE 65 (jattack1, gp3): ring every 60f; maxspade 10 (36° apart), grav 0.4, size 1, side 0
  spade init speed 26 → *0.87 decay t1-14 → freeze t15; release 1 every 4f, launch speed -3.4 +grav
TYPE 68 (jattack7, gp2): ring every 54f; maxspade 10 (36°), grav 0.45, side choose(0,1) mirror
  heart.wspeed=5; same build/decay/release as 65 (26→decay→freeze→-3.4 @grav 0.45 every 4f)
  ring radius 300 around battlesolid; spades spr_spadebullet(36x34), no spin, dmg monsterat*5
```
