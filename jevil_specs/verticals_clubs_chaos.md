# Jevil Port Spec — Vertical Diamonds / Corner Clubs / CHAOS CHAOS finale

Source: `DELTARUNE Chapter 1 - GML\`. Battle view = 640x480. `obj_heart` origin is top-left of the 16x16 soul, so soul center = `obj_heart.x+8, obj_heart.y+8`.
Scale rule: **JS(g) = g/1.6** (GML `image_xscale` → JS scale). GML angles are y-up (0°=right, 90°=up, 270°=down).
Damage 124 is the raw attack stat; port applies its own DEF formula.

---

## A. VERTICAL DIAMONDS — dc.type 73 & 74 → `obj_dbullet_vert`

Dense curtain of diamonds that fade/scale in, then shoot vertically. Two sub-variants.

### Spawn cadence (from `gml_Object_obj_dbulletcontroller_Step_0.gml`)
- **type 73** (line 1401): every `btimer >= 4` frames (very dense).
  - `radius = 140 + random(40)`, `xx = -100 + random(200)`, `num = choose(0,1,2,3)`; if `num==3` then `xx = -10 + random(20)` (bias a spawn to near the soul's x-column).
  - Requires `obj_battlesolid`. Spawns ONE diamond at `x = obj_heart.x + 8 + xx`, **`y = obj_battlesolid.y + 100`** (fixed low spawn, NOT radius-based).
  - Sets `db.type = 1`, `db.timepoints = 2`. (line 1416-1424)
- **type 74** (line 1428): every `btimer >= 9` frames.
  - Same `radius/xx/num` logic. Spawns at `x = obj_heart.x + 8 + xx`, **`y = obj_heart.y + 8 + (radius*side)`** where `side` = the controller's ±1 field (top or bottom of soul).
  - Sets `d.grazepoints = 12`, `d.timepoints = 2`. `d.type` stays **0**. (line 1441-1446)

So: 73 = fast dense column from a low fixed line moving UP; 74 = spread above/below the soul at ~140-180px, moving based on soul position.

### Bullet behavior (`obj_dbullet_vert` — Create + Draw only, no Step)
Create (`..._Create_0.gml`): clamps `y` into `[YView+20, YView+460]`; `grazepoints=5, timepoints=5, inv=120, damage=124, active=0, image_alpha=0, type=0`.
Draw (`..._Draw_0.gml`) drives everything (runs each frame after 1-frame `dont` delay):
- **Fade/scale-in:** while `active==0`, draw at scale `3 - image_alpha*2` (starts 3.0 shrinks to ~1.0), `image_alpha += 0.1` per frame (10 frames to appear).
- During fade-in, **if type==1**: set `vspeed = 3; gravity = -0.5;` (launches UP and decelerates — the 73 variant rises from the low line).
- When `image_alpha>=1` (activation), **if type==0** (the 74 variant): if soul is ABOVE bullet (`obj_heart.y+8 < y`) → `vspeed=1; gravity=-0.2` (drift up); else → `vspeed=-2; gravity=1` (shoot up then fall). Then `active=1`.
- Every frame also draws a second sprite at scale `2 - image_alpha` (settles to 1.0).
- type==0 caps `speed` at 8.
- Destroy when `y > YView+500` or `y < YView-20`.
- Sprite: **`spr_diamondbullet_vert`** 33x33, origin 16,16, 1 frame. Base scale 1.0 (JS ~0.625 of... note: drawn at native scale, so render 33x33 at scale 1). Damage 124, grazepoints 5(t0)/12(t74), timepoints 2.
- The soul threads the vertical gaps between columns; the `num==3` bias (line 1411/1438) deliberately drops some diamonds right in the soul's x-lane.

---

## B. CORNER CLUBS — dc.type 72 → `obj_clubsbullet_dark` (type 2 variant)

Spinning club emblem fired from a screen corner toward center, decelerating, then bursts a 3-way clubs spread aimed at the soul.

### Spawn (`gml_Object_obj_dbulletcontroller_Step_0.gml` line 1368-1398)
- Cadence: every `btimer >= 18` frames.
- Corner select via `side` (±1, flips each spawn):
  - `side==1` → `dir = choose(225, 315)` (down-left / down-right corners, y-up angles).
  - `side==-1` → `dir = choose(45, 135)` (up-right / up-left corners).
- `radius = 360`; spawn at `obj_heart.x+8 + lengthdir_x(360,dir)`, `obj_heart.y+8 + lengthdir_y(360,dir)` (a corner 360px from soul).
- Bullet: `direction = dir + 180` (fly toward soul/center), `speed = 20`, `friction = 1` (decelerates 1/frame → stops after 20 frames), `type = 2`, `damage = 124`, `image_angle = direction`.
- `side` flips ±1 each spawn so corners alternate.

### Bullet behavior (`obj_clubsbullet_dark_Step_0.gml`, type==2 branch, line 60)
- Create defaults: `grazepoints=1, timepoints=1, inv=120, damage=124, initangle=0, dtimer=0`.
- `dtimer += 1` each step. At **`dtimer == 20, 22, 24`** (3 volleys): `move_towards_point(soul, 0.1)` to re-aim, then fire **3 `obj_regularbullet`** clubs:
  - center: `spr_clubsball_b`, `direction = (direction-2)+initangle`
  - `spr_clubsball_c`, `direction = (direction-19-2)+initangle`
  - `spr_clubsball_a`, `direction = ((direction+19)-2)+initangle`
  - all `speed = 5` (type==2), `image_angle = direction`, inherit damage/target.
  - `initangle += 2` after each volley (spread rotates 2° per volley).
- At `dtimer == 26`: spawn `obj_afterimage` (fading trail) and `instance_destroy()`.
- Club-ball sprites: `spr_clubsball_a/b/c` all 34x34, origin 17,17. The dark carrier uses spr_clubsball (spinning club emblem). No explicit spin field on the carrier in type 2 (image_angle fixed to direction); spin visual is the 3 sub-shots' 19° fan.

---

## C. CHAOS CHAOS FINALE — dc.type 77 → `obj_laserscythe` + `obj_joker_teleport(t66)` + finale scythe

The ultimate. `global.turntimer` is set to a huge value (~1500) so it runs long. All timing below is `realtimer` (increments once per step, starts at 0) and later `jokertimer`. From `gml_Object_obj_dbulletcontroller_Step_0.gml` lines 1466-1674.

### Setup (special==0, once)
- `snd_play(snd_joker_byebye)`. `global.sp = 10`; force `obj_heart.wspeed = 10` (fast soul).
- Init: `rank = 16`, `realtimer=0`, `chase=0`, `made=0`, `amount=0`, `jokertimer=0`.
- Create `darkfader` = `scr_dark_marker(XView+320, YView-10, spr_tallpx)` at `depth=2, image_alpha=0, image_blend=c_black, image_xscale=200, image_yscale=2` (full-screen black overlay that fades in).

### Phase 1 — box dissolve (realtimer 0-10)
- realtimer 0-9: `darkfader.image_alpha += 0.1`; `obj_battlesolid.image_alpha -= 0.1` (battle box fades out); soul `y += 16` each frame, `boundaryup = 160`.
- realtimer == 10: destroy `obj_battlesolid` (arena walls gone — full-screen play).

### Phase 2 — scythe rain (realtimer 20 → until amount==30)
- realtimer == 20: spawn `obj_laserscythe` at `XView+40, -60` (left).
- realtimer == 40: spawn `obj_laserscythe` at `XView+570, -60` (right).
- realtimer >= 60 AND `amount < 30`: every `btimer >= rank` frames:
  - `rank -= 1` while `rank > 7` (interval speeds up from 16 down to 7 frames — accelerating rain).
  - `which = floor(random(5))` (5 columns, avoid repeating `prevmake`).
  - If `chase == 3`: `which = floor((obj_heart.x+8)/90)` (every 4th drop TARGETS the soul's column), reset chase.
  - Spawn scythe at `x = XView + 40 + 90*which`, `y=-60`. Columns are 90px apart starting at XView+40 (5 lanes: +40,+130,+220,+310,+400).
  - Pairing: `which==1` → also spawn at `XView+40+450` (=+490); `which==0` → also at `XView+40+540` (=+580).
  - `prevmake=which; btimer=0; chase+=1; amount+=1`.

### obj_laserscythe behavior (Create/Step/Draw/Other_15)
- Create: `grazepoints=15, timepoints=0, inv=120, damage=124, image_xscale=2, image_yscale=2, image_angle=random(360), rotspeed=14, vspeed=5, gravity=1, mask=spr_joker_scythebody_mask, scale=2`. Sprite `spr_joker_scythebody` 48x45, origin 22,21 (JS scale 2/1.6=1.25).
- Step: falls (`vspeed=5, gravity=1`), spins `image_angle += 14`/frame.
- **On landing** (`y >= room_height - 100`): `snd_play(snd_scytheburst)`, switch to explosion: `sprite/mask = spr_tallpx` (thin tall column, 5x640), `image_angle=0, y=0, speed=0, gravity=0`, `explode=1`. This is the **laser pillar tell** — the vertical `spr_tallpx` column that erupts where the scythe struck.
  - explode==1: `image_xscale += 8`/frame; becomes ACTIVE (hurtbox on) at `image_xscale>=16`; at `>=32` → explode=2.
  - explode==2: `image_xscale -= 4`; at `<=16` fade `image_alpha -= 0.25` + deactivate; at `<=0` destroy.
- Graze pushes finale forward: `grazed==1` → `obj_dbulletcontroller.made += 0.2` (grazing scythes shortens the sequence via the `29 - made` check).
- Other_15 (collision) = standard party-wide damage: on hit `global.inv = invc*40`, snd_hurt1, shake; if avg HP >= 10 chip 30%, else `scr_damage_all()`.

### Phase 3 — Jevil reappears + patterned scythe waves (special==2)
- Trigger when `amount >= (29 - made)`: spawn `obj_joker_teleport` at `XView+320, YView+100` with `type=66, depth=-30` (Jevil's teleport-in laugh animation; type 66 → no bullets, just swing/anim). `special=2`.
- `jokertimer += 1`. At `jokertimer == 10`: `snd_play(snd_joker_neochaos)` (the CHAOS CHAOS voice).
- Symmetric scythe volleys (each pair drops at `y=-60`, columns mirror around center XView+320):
  - jokertimer 40 & 98: `XView+40` & `XView+580`
  - jokertimer 46 & 86: `XView+130` & `XView+490`
  - jokertimer 52 & 80: `XView+220` & `XView+400`
  - jokertimer 66 & 98: `XView+310` (center)

### Phase 4 — the giant finale scythe (jokertimer 130+)
- jokertimer == 130: spawn `lastscythe = obj_laserscythe` at `XView+320, -320` with:
  - `vspeed=1, gravity=0.02, image_xscale=16, image_yscale=16, scale=16, rotspeed=0, remrot=160, image_angle=160`.
  - Start `snd_rumble` (`rumnoise = audio_play_sound(snd_rumble,50,1)`), `vol=0, vol2=1, p=0`.
  - Spawn `fadewhite` = obj_marker, `spr_tallpx`, `image_xscale=400, image_yscale=2, depth=-100, image_alpha=-0.3` (full-screen WHITEOUT overlay, at XView+320, YView-40).
- jokertimer >= 131: `lastscythe.x = xstart + random(8)` (screen-filling scythe jitters), `fadewhite.image_alpha += 0.01`, `vol += 0.01`.
  - When `fadewhite.image_alpha >= 1`: destroy `darkfader` and `lastscythe` (scythe consumed by white).
  - When `fadewhite.image_alpha >= 1.3`: `special = 3`.

### Phase 5 — recover (special==3 → 4)
- Soul recentered to `XView+320, YView+120`. `vol -= 0.1`, fade rumble gain out. `fadewhite.image_alpha -= 0.1`.
- When `fadewhite.image_alpha <= 0`: `audio_stop_sound(rumnoise)`, `global.turntimer = 11` (ends the turn), `special = 4`.

### Screen effects summary
- Battle box dissolves to a full-screen black field (darkfader, spr_tallpx xscale 200).
- Scythes fall from `y=-60`, spin at 14°/frame, land → vertical `spr_tallpx` LASER PILLARS that widen (xscale 8/frame to 32) then collapse.
- Giant 16x-scale scythe descends over a whiteout, `snd_rumble` swelling.
- Full whiteout (fadewhite xscale 400) at climax, then fade back and end turn.

---

## SPRITES / SOUNDS
| sprite | frames | w×h | origin | GML scale used |
|---|---|---|---|---|
| spr_diamondbullet_vert | 1 | 33×33 | 16,16 | fade 3→1, settle 1 |
| spr_clubsball_a/b/c | 1 | 34×34 | 17,17 | native |
| spr_joker_scythebody | 1 | 48×45 | 22,21 | 2 (JS 1.25) |
| spr_joker_scythebody_mask | 1 | 46×43 | 21,20 | mask |
| spr_jokerscythe_big | 1 | 72×67 | 32,33 | 2 |
| spr_joker_teleport(_r) | 2 | 42×41 | 21,20 | 0→2 grow |
| spr_tallpx | 1 | 5×640 | 2,0 | pillar/overlay |

Sounds: snd_joker_byebye (finale start), snd_joker_neochaos (jokertimer 10), snd_rumble (giant scythe), snd_scytheburst (pillar erupt), snd_swing + snd_joker_oh (teleport), snd_spearappear.
