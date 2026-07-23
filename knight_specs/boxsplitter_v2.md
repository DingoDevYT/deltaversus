# Roaring Knight — BOX SPLITTER (type 99, wiki "Box Splitter") — FINE re-extract

Chapter 3 GML. All angles GML convention (y-up, 0=right, 90=up, CCW).
Files under `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 3 - GML\`.

Object graph:
- `obj_roaringknight_boxsplitter_attack` — the CONTROLLER (turn timer, spawns one slash every `spawn_speed` frames).
- `obj_roaringknight_splitslash` — ONE cleave: the swinging slash sprite + the 66%-maxHP hitbox. Spawns/re-arms the split box.
- `obj_knight_split_growtangle` — the box that wrenches apart AND spawns the diamonds. Persistent (one instance reused by every slash).
- `obj_roaringknight_split_bullet` — the DIAMONDS ("teeth"). Sprite is literally named tooth but is the diamond the wiki describes.

---

## PORTER-BUG CORRECTIONS (read first)

**Bug 1 — teeth face the wrong way.** The diamonds do NOT point/travel radially outward from a center. They spawn spread ALONG the cut line and each travels **PERPENDICULAR to the cut**, and the set is split into two groups that travel in **OPPOSITE** perpendicular directions (one group toward each half). So a HORIZONTAL cut throws diamonds straight UP and straight DOWN (±90); a VERTICAL cut throws them LEFT and RIGHT (0/180). Only in the P3 **diagonal** variant do they radiate 360° from center (`_direction += 360/bullet_count`). Reference: `gml_Object_obj_knight_split_growtangle_Step_0.gml:141-149`.

**Bug 2 — timing/stagger wrong.** There is NO per-position launch time offset. All 13 diamonds are created inert during con==1 and then **all activated on the SAME frame** (con==2, `timer==7`, `gml_Object_obj_knight_split_growtangle_Step_0.gml:172-183`). The "teeth fall at different times" appearance comes ENTIRELY from the **two speeds** alternating along the cut: fast diamonds outrun slow ones, so adjacent diamonds separate over time. Do not stagger spawn times; stagger the SPEED per the weight rule below.

---

## 1. THE CLEAVE / SLASH (obj_roaringknight_splitslash)

Spawned by controller at `growtangle.x, growtangle.y` every `spawn_speed` frames (`gml_Object_obj_roaringknight_boxsplitter_attack_Step_0.gml:66-98`).

Slash life (`..._splitslash_Step_0.gml`, `timer++` each step):
- timer 0–29: charging telegraph. Thickness lerps 10→1 over first 15f; blend eases black→red over 20f. A red beam preview drawn via `spr_pxwhite10_center` (Draw_0).
- **timer==30**: SNAP. Sets `x=xstart,y=ystart`; `image_angle += angleoffset` (angleoffset = `random_range(-12,12)` set at init:12); applies xoffset/yoffset; `image_blend=c_white`; `active=true; slash=true`. Creates/re-arms `obj_knight_split_growtangle` (`con=1, timer=0`), plays slash SFX, spits 16 `obj_afterimage` debris streaks (`spr_knight_slash_mark`). Sprite becomes `spr_rk_quickslash`, `image_speed=1`.
- **hitbox active window: timer 30 → 34** (`active=true` @30 line 77, `active=false` @34 line 168). ~4 frames only.
- On precise hit (`Other_15` = collision, `scr_precise_hit(3)`): `playerstrike=1`, records heart pos, `hurt_delay = split_wait`, nudges controller timers.
- **timer == 35 + hurt_delay & playerstrike**: `scr_damage_maxhp(0.66, false, true)` → **66% of MAX HP**, then `global.inv = invc*30`, destroy. (`..._splitslash_Step_0.gml:170-180`)

Cut ORIENTATION at init (`..._splitslash_Step_0.gml:14-33`, uses controller `slash_count%2`):
- horizontal (default, `vertical=false`): image_angle≈0; `yoffset = random_range(-8,8)*2` (±16).
- vertical: `direction = (slash_count%2==1) ? -90 : 90`; `xoffset = random_range(-8,8)*2` (±16).
- diagonal (P3): `direction = (slash_count%2==1) ? -45 : 45`; xoffset/yoffset `random_range(-2,2)*2`.
- Plus `angleoffset` random ±12° added on top at timer==30 → cut is orthogonal with slight deviation.

Cut count per turn (~7–8): controller `local_turntimer` starts **330**, `--` each step; turn ends when `<=30`. Active window ≈300f / `spawn_speed` (≈40) ≈ **7–8 cleaves**.

## 2. THE HALVES WRENCHING APART (obj_knight_split_growtangle, con state machine)

Set to con=1 by each slash. `split_wait=5, split_hold=30` (P-final/diff2: `split_wait=4, split_hold=26`). `max_distance=70`.
- **con==1** (WAIT): at `timer >= split_wait(+split_delay)` → box break: disable old bullets, `snd_knight_boxbreak`, spawn diamonds (section 3), then `event_user(0)` → con=2,timer=0.
- **con==2** (OPEN): halves move apart. `distance = scr_ease_out(timer/(split_hold/2),3) * 70`, over `split_hold/2` = **15f (13f diff2)**. Heart shoved by `(distance-old)*heart_dir*1.25` (×1 diagonal). Diamonds activate @ timer==7. → con=3.
- **con==3** (CLOSE): `distance = 70 - scr_ease_in(timer/(split_hold/2),3)*70` over `split_hold/2`. Picks random cut wobble `irandom_range(-3,3)`. → con=4.
- **con==4** (SETTLE): `distance = scr_movetowards(distance,0,12)` until 0 → con=0, `split=false`, `snd_locker`. Then TIGHTENS next cleave: diff3 → `split_wait--` (floor 3), `split_hold-=2` (floor 26); else floor 5 / floor 30. (`..._growtangle_Step_0.gml:227-255`)
- Direction of separation: `vertical` → halves split along X (a at x−dist, b at x+dist); horizontal → along Y. Displacement `distance` up to 70px each way. Cut line deviation per open: `_change = choose(-2,-1,1,2)` (Draw_0:66).

## 3. THE DIAMONDS (obj_roaringknight_split_bullet) — spawn loop

`gml_Object_obj_knight_split_growtangle_Step_0.gml:82-162`. Params (Create): `bullet_count=13`, `bullet_range=144`.
- Sprite: **`spr_roaringknight_tooth`** (objects.tsv:792) — 36×36, 2 frames, origin 18,18 (centered). NOT diamondswordbullet. Drawn at final `image_xscale=yscale=1` (bullet Step forces to 1 every frame) → 36px diamond. `image_speed=0.5`.
- Layout along the CUT LINE: `_total=14` (13 is odd → +1). `_trueangle = vertical ? angle+90 : angle`. Spread vector `_xrange/_yrange = lengthdir(144, _trueangle)`, centered on box (`_xstart = x - _xrange/2`). Spacing `_shift = 144/((14/2)-1) = 144/6 = 24px`.
- Two groups: `_flip` flips at `_i == 7` and `_xstart` resets → bullets 0–6 (7) go one perpendicular way, 7–12 (6) go the opposite → emit toward BOTH halves.
- Travel direction (`image_angle=direction`):
  - horizontal cut: `_direction = _flip ? 90 : -90` (up/down).
  - vertical cut: `_direction = _flip ? 180 : 0` (left/right).
  - diagonal (P3): `_direction += 360/13` per bullet → radiate evenly around a circle from box center (spawned at x,y, not spread).
- **TWO SPEEDS + "≤2 adjacent same speed" rule** (the weight machine, lines 121-158):
  - `if (_weight==0) _weight = choose(-2,-1,1,2);`
  - `_speed = inverselerp(-1,1, sign(-_weight))` → **positive weight = SLOW (_speed 0)**, **negative weight = FAST (_speed 1)**.
  - FAST: `top_speed = 4 (±0.2)`, `friction = -0.2` (keeps accelerating).
  - SLOW: `top_speed = 2 (±0.2)`, `friction = -0.05`.
  - After spawn: `if (abs(_weight)==1) _weight = choose(1,2)*sign(-_weight)` (flip sign → opposite speed next) `else _weight = scr_movetowards(_weight,0,1)` (same sign, step toward 0). A magnitude-2 seed emits the SAME speed exactly twice then flips; magnitude-1 flips immediately → **never more than 2 adjacent same speed.** Reset to 0 at group midpoint.
- Speed ramp (bullet Step_0): created inert (`speed=0, active=false`); after activation `speed_mult += 0.2/frame`, `speed = speed_mult*top_speed` (5f to reach top), then GM negative friction accelerates further. All activate together @ con2 timer==7 — the fast/slow split is the ONLY stagger.

## 4. PHASE VARIANTS (controller `difficulty`, passed to growtangle)

`obj_roaringknight_boxsplitter_attack_Step_0.gml:5-21, 71-91`:
- **P1 (difficulty 0)** FIXED ORTHOGONAL: `spawn_speed=50`; `vertical = force_oneside` (`irandom(1)` locked at create) → every cut on the SAME axis. No V/H switching.
- **P2 (difficulty 1)**: `spawn_speed=46`, `force_swap=irandom(2)+1`; `vertical = irandom(1)` each slash → switches Vertical/Horizontal.
- **P2-hard (difficulty 2)**: `spawn_speed=31` (fastest); still random V/H; growtangle `split_wait=4, split_hold=26`.
- **P3 (difficulty 3)** + DIAGONAL: alternates a diagonal cut in (`diagonal` toggles; on a diagonal slash `timer=-4` for extra spacing). Diagonal cut → box splits corner-to-corner, heart shoved on both axes, and **diamonds RADIATE 360° from center** (`_direction += 360/13`), `split_hold` gets `+2`. Timing floors drop to `split_wait 3 / split_hold 26`, decrementing faster each cleave.

## 5. SCALES & SFX

Scales: box surface is 170×170 (origin 85,85), box sprite drawn at `image_xscale=yscale=2`; markers/flames scale 2; diamonds normalized to `image_xscale=yscale=1` (36px) each step. **No `darksize` branch exists in any of these objects** — geometry is authored at full dark-world scale; do NOT halve. (grep `darksize` in all four objects = 0 hits.)

SFX (exact names + event):
- `snd_wideslash_low` — slash SNAP, `..._splitslash_Step_0.gml:120-122` (`snd_stop` then `snd_play_x(..,0.8, 0.9+random(4)/10)`). `snd_knight_hurtb` is stopped here, not played.
- `snd_knight_boxbreak` — box cleave, `..._growtangle_Step_0.gml:40` (`snd_play_x(..,1,1.1)`).
- `snd_chargeshot_fire` — diamonds launch, `..._growtangle_Step_0.gml:78,80` (extra `snd_play_pitch(..,0.5)` if `split_delay>0`, plus normal).
- `snd_locker` — box fully closes/resets, `..._growtangle_Step_0.gml:253`.

---

### KEY NUMBERS
- CUT: orthogonal (H default / V random / diagonal P3) + `angleoffset` random ±12°; offset ±16px along cut. Halves wrench apart `distance` 0→70px each side (`ease_out`), then close. `slash_count%2` sets ±90 (V) / ±45 (diag) polarity.
- CLEAVE TIMING (frames, per cut): con1 wait=5 (4 diff2) → con2 OPEN over split_hold/2 = 15 (13 diff2) → con3 CLOSE same → con4 settle (12px/f). Slash hitbox live only frames 30–34.
- CLEAVES/TURN: local_turntimer 330→30, one slash every spawn_speed (50/46/31) → ~7–8.
- DIAMOND sprite: `spr_roaringknight_tooth` 36×36 centered, 2f, image_speed 0.5, final xscale/yscale=1.
- DIAMOND direction: PERPENDICULAR to cut, TWO opposite groups (7 + 6). H-cut→±90 (up/down); V-cut→0/180 (L/R); diagonal→360/13 radial from center.
- DIAMOND count/spacing: 13 bullets along 144px cut line, 24px spacing (=144/6); centered on box.
- DIAMOND speeds: FAST top_speed 4 (±0.2), friction −0.2; SLOW top_speed 2 (±0.2), friction −0.05. Ramp speed_mult +0.2/f.
- SPEED RULE: weight seed choose(±1,±2); pos=slow, neg=fast; |2|→same speed twice then flip, |1|→flip → ≤2 adjacent same speed.
- STAGGER: none by time — ALL activate con2 timer==7; separation is purely from the two speeds.
- SLASH DAMAGE: `scr_damage_maxhp(0.66)` = 66% MAX HP, applied at timer 35+hurt_delay on precise-hit; inv = invc*30.
- VARIANTS: P1 diff0 fixed-axis spawn50; P2 diff1 spawn46 / diff2 spawn31 random V/H; P3 diff3 adds diagonal (radial diamonds) + faster timing floors (wait 3 / hold 26).
- SFX: snd_wideslash_low (snap), snd_knight_boxbreak (cleave), snd_chargeshot_fire (diamonds), snd_locker (close). No darksize halving.
