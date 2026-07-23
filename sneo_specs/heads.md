# Spamton NEO — "Flying Heads" (rr=0) + Yellow-Soul BIG SHOT shooter

Exact port spec decompiled from DELTARUNE Chapter 2 GML. All `file:line` refer to
`C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 2 - GML\`.
Angles are GML y-up: `vx = spd*cos(dir)`, `vy = -spd*sin(dir)`. Color ints decoded BGR
(`R=int&255, G=(int>>8)&255, B=(int>>16)&255`); `#RRGGBB` hex literals are plain RGB.
`scr_darksize` baseline = 2 → any scale expressed against darksize should be HALVED; the
head/shot objects below draw at native `image_xscale=1` (via `draw_self`) so no halving
needed for them.

---

## 1. DISPATCH — how rr=0 selects Flying Heads

`gml_Object_obj_spamton_neo_enemy_Step_0.gml`
- **:796-801** `if (rr == 0)`: `global.monsterattackname = "FlyingHeads"`, then
  `dc = scr_bulletspawner(x, y, obj_sneo_bulletcontroller); dc.type = 0;`
- **:898** `scr_turntimer(260)` is set here, but the bulletcontroller overrides it (below).
- Attack fires at `rtimer == 15` inside the `scr_isphase("bullets")` block (**:790-794**).

**Which difficulty rr=0 runs with** (`gml_Object_obj_spamton_neo_enemy_Other_10.gml`, the
turn-selector):
- **:16-20** phaseturn 1 → `rr=0, difficulty=1`  (the first / canonical Flying Heads)
- **:61-65** phaseturn 8 → `rr=0, difficulty=3`  (harder Flying Heads variant)
- No rr=0 in phase-4 loop. So Flying Heads is seen at difficulty 1 and 3 only in normal play
  (difficulty 0/2 reachable via debug/`attackdebug`).

`obj_sneo_bulletcontroller` Create (`..._Create_0.gml:14`) copies
`difficulty = obj_spamton_neo_enemy.difficulty`.

**bulletcontroller type==0 driver** (`gml_Object_obj_sneo_bulletcontroller_Step_0.gml:29-93`):
- **:31-43** on init: `btimer=0; instance_create(0,0,obj_sneo_guymaker); init=2;`
  - `global.turntimer = 240` (default Flying Heads turn length)
  - `difficulty==2 → global.turntimer = 360`
  - `difficulty==3 → global.turntimer = 300`
- **:44-87 (difficulty==2 only) ARM BIG-LASERS** — the higher-difficulty add-on:
  - btimer 40 / 150 / 260: spawn `obj_sneo_biglaser` at Spamton's left-arm socket
    `sneo.x+partxoff[1], sneo.y+partyoff[1]` offset `lengthdir(60, armangle-90)`,
    `armangle = -68 - random(32)`; `d.direction = d.image_angle = armangle-90`;
    `d.damage = damage*2` (double); `sneo.aimmode=1; sneo.partmode=3`.
  - btimer 90 / 200 / 310: `with obj_sneo_biglaser { firecon=1; active=1; image_blend=c_white } sneo.partmode=12` (laser fires).
  - btimer in [90,120)/[200,230)/[310,340): laser re-anchors to arm each step.
  - btimer 130 / 240 / 350: `firecon=2; sneo.partmode=4` (laser retract).
- **:88-92 (difficulty==3)** btimer==1 → `sneo.partmode=36` (pose only; no extra lasers — the
  extra danger is head `type 4`, see below).

`obj_sneo_biglaser` Create: `spr_sneo_laser` 400x150 origin(0,75); starts `image_xscale=0,
image_yscale=0.05, active=0, mask_index=spr_nothing`; `damage = global.monsterat*5`
(then ×2 from dispatch); grazepoints=10.

---

## 2. obj_sneo_guymaker — the head spawner (controls the whole pattern)

### Create (`gml_Object_obj_sneo_guymaker_Create_0.gml`)
Maps `obj_spamton_neo_enemy.difficulty` → `type`:
- **:3-4** difficulty 0 → type 1
- **:6-7** difficulty 1 → type 2   ← canonical Flying Heads
- **:9-10** difficulty 2 → type 3
- **:12-13** difficulty 3 → type 4   ← hard Flying Heads
- **:15-16** `if instance_exists(obj_sneo_heartattack) → type 5`
- **:18-19** difficulty 6 → type 6
- **:21-22** difficulty 7 → type 7
- **:24-29** `timer=0; prevrow=0; row=0; prevrowy=0; spawncount=0; firstspawn=0;`

### Alarm_0 (`..._Alarm_0.gml`) — `instance_destroy();` (guymaker self-terminates when turn ends; no alarm set in Create so this is unused-ish / external).

### Step_0 (`..._Step_0.gml`) — the loop. `xx,yy = view origin` (:1-2). `timer++` (:3).
Row is chosen at `timer==1`; heads spawned at `timer == 5,10,15,20`; timer wraps.

**Row selection @ timer==1** (all rows spawn heads from the RIGHT unless noted):
- type 1 (:9-15): `row = choose(0,1)` (repick if prevrow==2).
- type 2 (:17-33): `aa = choose(0,1,2)` avoiding previous lane; `rowy = (yy+210) - 46*aa;
  prevrowy=aa; row=2`  → **3 vertical lanes, single sweeping head each cycle**.
- type 3 / 4 (:35-50): `rowy = (yy+210) - 40*choose(0,1)`;
  `row = choose(0,1,3,6)` (prevrow==2→choose(0,1,3,6); prevrow==3→choose(0,1);
  first spawn never row 3). Mixes side-sweeps (0/1), the vertical pair (3), and the
  double-column burst (6).
- type 5 (:52-62): `rowy = (yy+210) - 40*choose(0,1,2)`; `row = choose(0,1,2,2,3,6)`.
- type 6 (:64-65): `row = 6`. type 7 (:67-68): `row = 7`.

**Head spawns @ timer 5/10/15/20:**

- **rows 0/1/2 — single side-sweep head** (:73-120):
  `guy = instance_create(xx+700, yy+280, obj_sneo_lilguy)` (spawns off-screen right):
  `hspeed=-18; friction=-0.1; vspeed=-2; gravity=0.5; gravity_direction=0;`
  `alarm[0]=44; alarm[1]=40; alarm[2]=32; destroyable=1; image_blend=#00A2E8;`
  `changedirection=0; altdirection=0; altspeed=4; altfriction=-0.2; altgravity=0;`
  - row 1 (:95-99): `y -= 240; vspeed = +2` (top lane, arcs down).
  - row 2 (:101-106): `y -= 120; vspeed=0; hspeed=-21` (faster, mid lane).
  - row 2 & type 2 (:108-116): `hspeed=-21; gravity=0; friction=0.5; alarm[0]=36;
    changedirection=1; altdirection=direction` (decelerate-then-redirect head).
  - types 2/3/4/5 & row 2 (:118-119): `guy.y = rowy` (snap to chosen lane).
- **row 3 — vertical pincer pair** (:122-135, skipped when timer==20):
  loop i=0..1: `instance_create(xx+300, (yy-40)+400*i, obj_sneo_lilguy)`;
  `vspeed = 18 - 36*i` (one flies up, one down); `gravity = 0.8 - 1.6*i`;
  `gravity_direction=90; alarm[0]=44; alarm[1]=40; alarm[2]=32; destroyable=1`.
- **row 6 — double-column burst** (:137-162, only timer==5): `spawncount=2`, repeat 2 (a=0,1):
  top head `instance_create(xx+410+a*70, yy-20, ...) vspeed=15 gravity=0.53 grav_dir=90 alarm[1]=30`
  and bottom head `instance_create(xx+445+a*70, yy-20+400, ...) vspeed=-15 gravity=-0.53`.
- **row 7 — path head** (:164-174, skipped when timer==20):
  `guy = instance_create(xx+630, yy+100, obj_sneo_lilguy)` alarms 44/40/32;
  `with guy path_start(path_sneo_head_path1, 11, path_action_stop, 0)`.

**Timer wrap / cadence** (:177-196):
- type 2: `timer>=41 → timer=0`  (cycle = 41 frames, 4 heads per cycle)
- type 3: `timer>=69 → 0`
- type 4: `timer>=50 → 0`
- type 5: `timer>=69 → 0`
- type 6: `timer>=69 → 0`
- fallthrough default (:192): `timer>=50 → 0`
- `timer==0 → prevrow = row` (:195-196).

---

## 3. obj_sneo_lilguy — a single flying head

### Create (`..._Create_0.gml`)
`scr_bullet_init(); element=6; f=2; destroyable=0(default, guymaker sets 1);`
`bulletspeed=8;` (:20) `image_speed=0; cutscene=0;`
`damage = global.monsterat[myself] * 5` (:24-25) — contact damage to player.
`target = obj_sneo_bulletcontroller.target` (:27-28). `grazepoints=2`.
Sprite = **spr_sneo_crew** (objects.tsv default): 4 frames, **40×48, origin (18,22)**.
Parent `obj_collidebullet`. `bighead=0, bighitbox=0` (Flying Heads never set these).

### Step_0 (`..._Step_0.gml`)
- :3-4 despawn if outside `camerax()-200..+1000`, `cameray()-200..+600`.
- :7 `direction += angle_speed` (angle_speed=0 for heads → straight).
- :12-16 **while destroyable==1**: `yellowsiner++;
  image_blend = merge_color(#00A2E8, c_aqua, 0.25 + sin(yellowsiner/3)*0.25)`
  → pulsing blue↔aqua tint (25%→50% toward aqua) marking it as shootable.
- :18-25 optional vertical wrap (`loop`; unused by Flying Heads).
- :27 `y += falsevspeed` (0 for heads).
- :29-35 `bighitbox` rectangle check (unused by Flying Heads).

### Alarms
- **Alarm_0** (`instance_destroy()` is in Other_8; Alarm_0 = `changedirection` block):
  `..._Alarm_0.gml` — if `changedirection`: `direction=altdirection; gravity=altgravity;
  friction=altfriction; speed=altspeed` (row-2/type-2 redirect at frame 44/36).
- **Alarm_1** (`..._Alarm_1.gml`) — **FIRE at player**: if `obj_heart` exists,
  `bullet = instance_create(x, y+12, obj_sneo_lilguy_bullet); bullet.bulletspeed=bulletspeed(8);
  bullet.depth=depth-1; with bullet move_towards_point(heart.x+8, heart.y+8, 8)`.
  Then `image_index=2; image_speed=1` (open-mouth shoot anim). Alarm[1] set to 40 (30 on row 6).
- **Alarm_2** (`..._Alarm_2.gml`) — `image_index=1` (windup frame). Alarm[2]=32.
- Alarm[0]=44 default (redirect timing).

### Collision / death (`..._Collision_obj_yheart_shot.gml` → `event_user(0)` = Other_10)
- Collision: `hitshot=other; event_user(0);` then tension reward
  `difficulty==3 ? scr_tensionheal(1) : scr_tensionheal(1.3)`.
- **Other_10** (`..._Other_10.gml`) resolves the hit:
  - `if bighead && hitshot.big==0` → head SURVIVES: `snd_play_x(snd_bell,0.8,0.7+rnd)`,
    knock the shot back (`hspeed=-8; vspeed=choose(-8,8,10,-10); scr_doom`). *(Flying Heads
    are never bighead, so this branch is unused here.)*
  - else → head DIES: if `hitshot.big==0` destroy the shot (`with hitshot event_user(0)`);
    `snd_bomb` @ pitch 1.1+rnd; `scr_afterimage_cut().flash=true; instance_destroy()`.
  - **⇒ a normal Flying Head dies in ONE hit from any yellow shot** (normal or big).
- Other_7 (`image_speed=0`), Other_8 (`instance_destroy()`).
- Draw_0: `draw_self();`

### obj_sneo_lilguy_bullet (the ring/note the head fires at you)
Sprite **spr_sneo_crew_bullet** 20×24 origin(10,12); parent obj_basicbullet_sneo.
Step_0 (`..._bullet_Step_0.gml`): despawn beyond room ±100; `image_angle += 36` (spins).

---

## 4. obj_yheart_shot — the yellow-SOUL projectile you fire

### Firing (`gml_Object_obj_heart_Step_0.gml`, color==1 = yellow soul)
- **:277-282** on `button1_p()` (Z tap) or short-charge release:
  `if instance_number(obj_yheart_shot) < 3 && chargeshot_delay==0`:
  `instance_create(x+10, y+10, obj_yheart_shot); snd_play(snd_heartshot_dr_b)`.
  → **max 3 normal shots on screen at once**; no cadence gate beyond the count + delay.

### obj_yheart_shot Create (`..._Create_0.gml`)
`f=2; makeanim=1; hspeed = 8*f = 16` (flies RIGHT); `big=0; damage=1; sucked=0; trail=0`.
Sprite **spr_yheart_shot** 25×9 origin(18,4).
`if obj_spamton_neo_enemy.upgrade > 0` (:10-24) auto-upgrades to big:
`big=1; sprite=spr_yheart_bigshot; hspeed=9; friction=-0.4; image_alpha=0.5;
image_xscale=0.1; image_yscale=2; damage=4; sets bigshotused=1`.

### Step_0 (`..._Step_0.gml`)
- :1-11 if big: `damage=4; image_alpha += 0.1*f; grow xscale→1, shrink yscale→1`
  (stretch-in effect).
- :13-20 despawn past `camerax()+700`, `cameray()+520`, `cameray()-40`.
- :40-58 if `trail==1` every 2 frames drop `obj_yheart_shot_afterimage`
  (spr_yheart_bigshot_trail, xscale 0.8 yscale 0.5, dir 180).

### Hit resolution
- Other_10 (`..._Other_10.gml`): spawn `obj_yshot_anim` (spr_yheart_shot_hit, 5f 36×24
  origin(18,11)); if big → anim xscale/yscale=3; `instance_destroy()`.
- Other_12 (`..._Other_12.gml`): quiet hit → spr_yheart_shot_hit_noeffect (4f 36×24).
- afterimage Step: `image_alpha -= 0.1; destroy at <0`.

**Damage to heads = 1 (normal) / 4 (big)**; heads die in one hit regardless (§3), so 1 shot
per head. Big shot pierces nothing special here — value matters only vs bighead bosses.

---

## 5. BIG SHOT charge mechanic (`gml_Object_obj_heart_Step_0.gml:284-349`)

Hold Z (`z_hold`) charges the shot:
- :286-290 `z_hold==20`: start `snd_chargeshot_charge` loop, pitch 0.1, fade vol 0→0.3.
- :292-293 `z_hold 20..39`: pitch ramps `0.1 + (z_hold-20)/20`.
- :295-296 `z_hold>=40`: `image_index=2` (fully charged pose).
- :298-299 `z_charge<15 → chargeshotcount=0`.
- **:301-316 RELEASE (`z_hold>=40 && button1_r()`)** → fire BIG SHOT:
  `snd_stop(charge); snd_play(snd_chargeshot_fire);`
  `bigshot = instance_create(x+10, y+10, obj_yheart_shot); bigshot.big=1;`
  `sprite=spr_yheart_bigshot; hspeed = 4*f = 8; friction = -0.2*f = -0.4;`
  `image_alpha=0.5; image_xscale=0.1; image_yscale=2;`
  `z_hold=0; chargeshot_delay=5; chargeshotcount++`.
- :318-322 `chargeshotcount>1 → with obj_spamton_neo_enemy event_user(4)`.
- :324-325 sets `obj_spamton_neo_enemy.bigshotused = 1`.
- :327-349 **SUPERCHARGE**: if `bigshotcount > 0`:
  `bigshot.hspeed = 10*f = 20; bigshot.trail = 1; bigshotcount--`;
  when it hits 0: `obj_supercharge_end`, `snd_stardrop`, and 8 `obj_yheart_sneo_particle`
  spokes (spr_yheart_charge 7×7, dir spread 45°, speed 16, friction 0.8).

sprites: spr_yheart_bigshot 45×28 origin(32,14); spr_yheart_bigshot_trail same.
Enemy Create defaults (`obj_spamton_neo_enemy_Create_0.gml`): `upgrade=0; bigshot=1;
bigshotused=0; bigshotcount=0`.

---

## KEY NUMBERS

```
ATTACK        rr=0 "FlyingHeads" → obj_sneo_bulletcontroller.type=0 → spawns obj_sneo_guymaker
DIFF→TYPE     d0→t1, d1→t2(canonical), d2→t3, d3→t4(hard), heartattack→t5, d6→t6, d7→t7
TURNTIMER     240 (d1) / 360 (d2) / 300 (d3)   [dispatch's 260 is overridden]
HEAD SPRITE   spr_sneo_crew 40x48 origin(18,22) 4frames; blue #00A2E8=(R0,G162,B232) pulse→aqua
HEAD SPAWN    from xx+700,yy+280 (off right); hspeed -18 (rows0/1) / -21 (row2); friction -0.1
HEAD CADENCE  row picked @timer1; heads @timer 5,10,15,20; type2 wraps @41 (≈4 heads/41f)
HEAD FIRE     Alarm[0]=44,[1]=40,[2]=32; Alarm1 spawns obj_sneo_lilguy_bullet aimed at heart, spd 8
HEAD DEATH    1 yellow-shot hit kills (non-bighead); reward scr_tensionheal 1.3 (1.0 on d3)
LILGUY BULLET spr_sneo_crew_bullet 20x24 origin(10,12); image_angle+=36/frame; dmg=monsterat*5
YELLOW SHOT   spr_yheart_shot 25x9 origin(18,4); hspeed 8*f=16 right; damage 1; MAX 3 on screen
BIG SHOT      Z-hold>=40 release: spr_yheart_bigshot 45x28 org(32,14); hspeed 8 (super 20); dmg 4
BIGLASER      only difficulty==2: obj_sneo_biglaser @arm, btimer 40/150/260 fire 90/200/310, dmg×2
SFX           snd_heartshot_dr_b(fire), snd_bomb(head death), snd_bell(bighead block),
              snd_chargeshot_charge/_fire, snd_stardrop(supercharge)
ASSETS        obj_sneo_guymaker/_lilguy/_lilguy_bullet, obj_yheart_shot(+_afterimage/_sneo_particle),
              obj_yshot_anim, obj_sneo_biglaser, path_sneo_head_path1
```
