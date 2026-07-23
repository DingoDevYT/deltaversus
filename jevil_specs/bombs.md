# Jevil — Suit Bombs (obj_suitbomb) — EXACT port spec

Decompiled from DELTARUNE Chapter 1 GML. All angles GML y-up (0=right, 90=up, CCW).
Scale helper: **JS(g) = g / 1.6** (GML px -> DeltaVersus px).

Files:
- `gml_Object_obj_dbulletcontroller_Step_0.gml` (spawner types 46/47/48/49/50)
- `gml_Object_obj_suitbomb_Create_0.gml`, `_Step_0.gml`, `_Draw_0.gml`
- `gml_Object_obj_heartbomb_blast_Create_0.gml`, `_Step_0.gml`
- `gml_Object_obj_joker_Step_0.gml` (sounds), `gml_Object_obj_regularbullet_Create_0.gml` (default dmg)

---

## Spawner block (obj_dbulletcontroller Step, types 46–50)

Every type uses the SAME spawn placement (line 1029–1145):
```
xx = choose(0, 1);
basex = view_x + 320;   // or obj_growtangle.x if it exists
idealx = (xx==0) ? basex - 180 - random(100)   // left side
                 : basex + 180 + random(100);  // right side
bomb = instance_create(idealx, -20, obj_suitbomb);  // spawn Y = -20
scr_bullet_inherit(bomb);
```
Cadence (btimer gate) + forced suit:
- **type 46** (Step:1029), btimer>=**12**: RANDOM-SUIT. Leaves Create's `type=choose(0,1,2,3)`; if it rolled 2 (heart) it re-rolls `choose(0,1,2,3)` (heart still possible, just deweighted).
- type 47 (1055), btimer>=12: `bomb.type = 1` (diamond). *(not in target set)*
- **type 48** (1078), btimer>=**12**: `bomb.type = 0` -> **SPADE** ring bomb. ✔
- **type 49** (1101), btimer>=**20**: `bomb.type = 2` -> **HEART** bomb blast. ✔ (slower cadence)
- **type 50** (1124), btimer>=**12**: `bomb.type = 3` -> **CLUB** aimed-spread. ✔

Suit id map: **0=spade, 1=diamond, 2=heart, 3=club**.

---

## obj_suitbomb — the falling bomb

### Create (Create_0.gml)
```
visible = 0;
type = choose(0,1,2,3);      // overridden by spawner (except 46)
y = -80;                      // NOTE: overrides the -20 from instance_create
image_xscale = 2; image_yscale = 2;   // bomb sprite drawn at 2x
con = 0; timer = 0; image_speed = 0;
vspeed = 10;                 // constant fall, 10 px/frame down (screen-down)
maxtimer = 20 + random(16);  // FUSE = 20..36 frames
explodedraw = 0;
```
No gravity — constant vspeed=10. Falls straight down.

### Step (Step_0.gml)
- **con 0** (line 1): assign sprite by type: spr_bomb_spade / spr_bomb_diamond / spr_bomb_heart / spr_bomb_club; `visible=1`; con=1.
- **con 1** (19): `timer += 1`. When `timer>=10`: set `obj_joker.beepnoise=1` and `image_speed = timer/maxtimer` (anim spins up). When `timer>=maxtimer`: con=2, timer=0, **speed=0** (stops falling — detonates in place).
- **con 2** (39): DETONATE. `obj_joker.burstnoise=1`. Spawns burst per suit (below). con=3.
- **con 3 / explodedraw>=40** (109): `instance_destroy()`.

### Draw (Draw_0.gml)
- con<2: `draw_self()` (2x bomb sprite).
- con>=2: white expanding shockwave ring: `explodedraw+=1`; alpha `1.5-(explodedraw/10)`; `draw_circle(x,y, sprite_width/2 + explodedraw*2, outline=false)`. Ring grows +2px/frame, fades over ~15 frames, object gone at explodedraw 40.

---

## Detonation bursts (obj_suitbomb Step con==2)

Default bullet damage = **124** (obj_regularbullet Create line 7) unless overridden.
All burst bullets are obj_regularbullet spawned at the bomb's (x,y).

### SPADE (type 0, line 44) — random ring, NOT aimed
```
dir = random(360);  maxe = 12;
for i in 0..11:
  b = obj_regularbullet at (x,y); scr_bullet_inherit; active=1;
  b.direction = dir + i*(360/12);   // 12 evenly, 30° apart, random rotation
  b.speed = 8;
  b.image_angle = b.direction;
  b.sprite_index = spr_spadebullet;
```
- Count **12**, 30° spacing, full 360° ring, random start offset. Speed **8**. Damage **124** (default). Not aimed at soul.

### DIAMOND (type 1, line 63) — 3 aimed at soul
```
for i in 0..2:
  d = obj_regularbullet at (x,y); d.damage=100; scr_bullet_inherit;
  with(d) move_towards_point(obj_heart.x+8, obj_heart.y+8, 11);  // AIMED at soul, speed 11
  d.speed -= i;             // speeds 11, 10, 9
  d.image_angle = d.direction;
  d.sprite_index = spr_diamondbullet;
```
- Count **3**, all aimed at soul center, speeds **11 / 10 / 9**. Damage **100**. *(type 47 spawner; part of 46 random pool)*

### HEART (type 2, line 82) — spawns obj_heartbomb_blast
```
h = obj_heartbomb_blast at (x,y); scr_bullet_inherit;
```
See obj_heartbomb_blast below.

### CLUB (type 3, line 89) — 3 aimed spread
```
dir = point_direction(x, y, obj_heart.x+8, obj_heart.y+8);   // aim at soul
for i in 0..2:
  c = obj_regularbullet at (x,y); c.sprite_index=spr_clubsbullet; c.damage=100;
  scr_bullet_inherit; c.active=1;
  c.direction = (dir - 20) + i*20;    // dir-20, dir, dir+20  (40° fan)
  c.image_angle = c.direction;
  c.speed = 8;
```
- Count **3**, fan of **±20°** (40° total) centered on soul direction. Speed **8**. Damage **100**.

---

## obj_heartbomb_blast — heart burst (rotating orbiters homing on soul)

### Create
```
made=0; active=0; pausetimer=0; con=0; siner=0; maxlength=0; visible=0;
```
### Step
```
if made==0:  spawn 4x obj_regularbullet (son[0..3]), sprite spr_heartbullet, scr_bullet_inherit; made=1;
pausetimer += 1;
if pausetimer>=10 && con==0:  move_towards_point(obj_heart.x+8, obj_heart.y+8, 7); con=1;  // blast body homes at soul, speed 7, after 10-frame pause
siner += 1;
if maxlength < 40:  maxlength += 4;   // orbit radius grows 0->40 over 10 frames (+4/frame)
for i in 0..3 (son exists):
  son[i].x = x + lengthdir_x(maxlength, siner*3 + i*90);
  son[i].y = y + lengthdir_y(maxlength, siner*3 + i*90);
```
- **4** heart bullets orbit the blast center, 90° apart, rotating **3°/frame** (siner*3), radius expanding to **40** px. The blast body drifts toward the soul at speed **7** after a 10-frame pause. Orbiters are positioned each frame (their own speed unused). Damage **124** (default, no override). Blast object never self-destructs here (persists until off-field / cleanup).

---

## Sprites (REFDATA sprites.tsv) — cols: name, frames, w, h, xorigin, yorigin

| sprite | frames | w×h | origin | drawn scale |
|---|---|---|---|---|
| spr_bomb_spade | 2 | 23×23 | 11,11 | image_scale **2** (46×46) |
| spr_bomb_diamond | 2 | 23×23 | 11,11 | 2 |
| spr_bomb_heart | 2 | 23×23 | 11,11 | 2 |
| spr_bomb_club | 2 | 23×23 | 11,11 | 2 |
| spr_spadebullet | 1 | 36×34 | 18,17 | 1 |
| spr_diamondbullet | 1 | 33×32 | 16,15 | 1 |
| spr_clubsbullet | 1 | 34×34 | 17,17 | 1 |
| spr_heartbullet | 1 | 18×18 | 9,9 | 1 |

Bomb anim: 2 frames, `image_speed` ramps from 0 to `timer/maxtimer` after timer>=10 (visual spin before pop).

DeltaVersus px = native × scale / 1.6. E.g. bomb body = 23×2/1.6 = **28.75px**; spadebullet ≈ 22.5px.

---

## Sounds

- **snd_bombfall** — bomb falling/beep. suitbomb sets `obj_joker.beepnoise=1` (timer>=10); joker Step:612 plays `snd_bombfall` (stop+play) gated on `beepnoise==4 && beepbuffer<0`, then beepbuffer=5.
- **snd_bomb** — detonation. suitbomb sets `obj_joker.burstnoise=1` at con==2; joker Step:620 stop+plays `snd_bomb`.

(sounds.tsv: snd_bomb, snd_bombfall — audiogroup_default.)

---

## targetall / soul-aim summary
- **Spade**: NOT aimed — random 360° ring.
- **Diamond**: AIMED — 3 homing shots at soul center (x+8,y+8).
- **Club**: AIMED — 3-shot 40° fan centered on soul direction.
- **Heart**: blast body AIMED at soul (speed 7); 4 orbiters rotate around blast, not individually aimed.
