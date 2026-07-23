# Spamton NEO — "RECREW Columns / pillar-car wall" (rr = 6, type 6)

Attack name string: `RECREWColumns` (`gml_Object_obj_spamton_neo_enemy_Step_0.gml:837`).
Manager for difficulty 0/1: **obj_sneo_wall_controller_new**. (obj_sneo_wall_controller only spawns when difficulty==9; difficulty 2/3/99 are the hard/hell variants inside the same _new controller — see below.)

GML uses **y-up** angles. Battle view is 640x480 (`camerawidth()`=WView=640, `cameraheight()`=HView=480). darksize is NOT used here (world-space bullets), so no HALVE needed on scales — scales below are literal.

---

## WHAT IT IS
Full-height vertical **walls of mailbox/bullet bricks slide in from the RIGHT edge and race LEFT** across the arena toward the yellow SOUL, like semi-trucks on a highway. Each wall is 7 tiles tall. Some tiles are **gaps** (empty), some are **"RECREW" crew members** (destroyable — shoot to clear a hole), some are **red crew** (shooting one clears the whole wall's row of that color), and some are **bomb pillars** (obj_sneo_rotatingwall_bomb) that explode in a cross. A scrolling road/track is drawn under everything. The SOUL survives by lining up with the moving gaps and shooting open the crew tiles. Dispatch: `obj_spamton_neo_enemy_Step_0.gml:835-840` → `scr_bulletspawner(x,y,obj_sneo_bulletcontroller); dc.type=6`. Controller spawned in `obj_sneo_bulletcontroller_Step_0.gml:577-587`.

---

## MANAGER — obj_sneo_wall_controller_new

### Create (`..._new_Create_0.gml`)
- `wallsize = 7` (rows per wall), `wallcountmax = 35` (max walls), `wallcreatetimermax = 30`.
- `track1_x=camerax()`, `track2_x=camerax()+320`, `track3_x=camerax()+640` (3 scrolling road sprites, 320px apart).
- Per-wall arrays sized [35], init to -1: breakspot1..5, pipispot1..5, emptyspot1..5, redbreakspot1..5.
- `wallcreatetimer[a]=30`, `wallspeed[a]=-7`, `walltype[a]=0` for all; then overwritten per wall.
- `difficulty = obj_spamton_neo_enemy.difficulty`.

### Wall layout script `scr_sneo_wall_create(a0,a1,a2,a3,a4, timer, type)` (`gml_GlobalScript_scr_sneo_wall_create.gml`)
5 code args map to tile rows **1,2,3,4,5** (the interior rows; rows 0 and 6 are always solid box+car). Each arg value:
`0`=solid mail brick, `1`=empty gap, `2`=crew (destroyable), `3`=pipis bomb pillar, `4`=red crew.
`arg5`=wallcreatetimer (frames until this wall spawns after prev), `arg6`=walltype (0 or 1 speed profile).

### Difficulty 0 (`..._new_Create_0.gml:61-168`)
All walls walltype=1. Choreographed: three `choose(1,2,3)` blocks each queue a 3–4 wall sub-pattern, always following an opener wall then bursts of 4 quick walls at timer=40 then 6,6,6. Final wall `scr_sneo_wall_create(1,1,1,1,1,9999,0)` = all-gap closer.

### Difficulty 1 (`..._new_Create_0.gml:170-331`)
Same structure but `choose(1,2,3,4)` (adds row-4 patterns), openers use crew(2)+pipis(3) mixes, burst opener timer=32 instead of 40, sub-wall timers=20 instead of 30 → tighter/faster. Closer identical.

### Difficulty 2 / 3 / 99 (harder, same controller)
- diff 2 (`:385-401`): 6 random walls (timer 7) → 1 wall timer 63 → 5 → 63 → 5, each row `choose(2,2,1,1,1,4,3,0)`. Heavy crew+red+bomb.
- diff 3 (`:403-419`): same cadence, pool `choose(2,2,1,1,1,3,0)` (no red).
- diff 99 (`:333-383`): long hand-authored gauntlet ~24 walls.

### Step (`..._new_Step_0.gml`) — spawn loop
- `timer++`. `if global.turntimer<1 instance_destroy()`.
- When `wallcount<35 && timer==wallcreatetimer[wallcount]`: build one wall, loop i=0..6:
  - **i==0 or i==6 (top/bottom edge):** spawn `obj_sneo_wallbullet_new` at `(camerax()+640, yy+240+i*34-172)`, sprite=`spr_sneo_bullet_box`, xscale 1.25 yscale 1.6, destroyable=0, blend white, wallnumber=wallcount. i==0 also gets `wallcontroller=1` (this instance drives the wall's speed profile). i==6 is REPLACED by a **car**: spawn at `(camerax()+640-50, yy+240+6*34-180)`, sprite=`spr_sneo_wall_car`, xscale 1.25 yscale 1.6, depth=depth-1.
  - **emptyspot row:** nothing (gap).
  - **pipisspot row:** spawn `obj_sneo_rotatingwall_bomb` at `(camerax()+640, yy+240+i*34-170)`, wallnumber set.
  - **else (solid):** spawn `obj_sneo_wallbullet_new`, sprite=`spr_sneo_mail`, xscale 1.2 yscale 1.71, destroyable=0.
    - **breakspot:** destroyable=1, sprite=`spr_sneo_crew`, image_speed=0.5, yscale=1.2.
    - **redbreakspot:** destroyable=1, red=1, sprite=`spr_sneo_crew`, image_speed=0.5, yscale=1.2, blend=c_red.
  - After loop: `timer=0; wallcount++`.
- Row Y = `yy + (HView/2) + i*34 - 172` (yy=cameray() at create). 7 rows, 34px pitch, centered on arena mid.

### Draw (`..._new_Draw_0.gml`) — the road
- Each frame `track1_x/track2_x/track3_x += 4`; when a track_x > camerax()+640 it wraps `-= 960`.
- `draw_sprite(spr_sneo_wall_track, 0, trackN_x, cameray()+480-180)` ×3. Road scrolls right→ (parallax; walls move left).

---

## BULLET — obj_sneo_wallbullet_new
### Create (`..._new_Create_0.gml`)
- `element=6`, destroyable=1(default, overridden), red=0, bighitbox=1, image_speed=0, grazepoints=2.
- `image_blend = merge_color(#00A2E8, c_aqua, 0.375)` (cyan; #00A2E8 = RGB **0,162,232**; c_aqua=0,255,255).
- `damage = global.monsterat[myself] * 5`.
- wallspeed=-7, wallnumber=0, walltype=0, timer=0, hp=1.

### Step (`..._new_Step_0.gml`) — movement + speed profiles
- `if global.turntimer<1 destroy`.
- Every frame: `x += obj_sneo_wall_controller_new.wallspeed[wallnumber]` (all tiles of a wall share one speed slot).
- Only the `wallcontroller>-1` tile (i==0 box) drives that slot:
  - **walltype==0:** timer++. `timer<9`: wallspeed = lerp(-16,-6, timer/9) (fast entry decel). `timer<150`: hold -6.
  - **walltype==1:** timer++. `timer<16`: wallspeed = lerp(-21,-5, timer/15) (harder snap-in). `timer<90`: lerp(-5,-13, (timer-15)/70) — **accelerates to -13** (speeds up as it crosses). This is the diff 0/1 profile.
- **Crew destruction (`spr_sneo_crew` only):** `collision_rectangle(x-18,y-22, x+19,y+22, obj_yheart_shot)`. Solid (destroyable==0) tiles block big shots unless a mail tile is 40px above/below or |dy|>12. Destroyable crew hit → snd_bomb (pitch 1.1+rand0.2), afterimage cut, spawn obj_yshot_anim (spr_yheart_shot_hit3), destroy.

### Collision obj_yheart_shot (`..._new_Collision_obj_yheart_shot.gml`)
Same gating as Step; destroyable crew → snd_bomb (vol 0.7), flash cut, hit anim, destroy.

### Other_10 (user event 0, hit reaction, `..._new_Other_10.gml`)
- `spr_sneo_bullet_box` → exit (indestructible edge).
- destroyable crew: if `red==1`, `with obj_sneo_wallbullet_new where wallnumber==other.wallnumber` → snd_bomb + destroy (clears whole red row of that wall); also `obj_sneo_rotatingwall_pipis` same wallnumber event_user+destroy. Then hit anim.
- Non-destroyable: bounce the shot (`with hitshot event_user(0)`) + `snd_bell`.

### Draw: `draw_self()` only.

---

## BOMB PILLAR — obj_sneo_rotatingwall_bomb (pipisspot / arg==3)
- Default sprite `spr_mettaton_bomb1`; Create: element=6, destroyable=0, bighitbox=1, image_speed=0, grazepoints=2, wallspeed=-7, damage=monsterat*5.
- Step: while `timer==0` moves with wall (`x += wallspeed[wallnumber]`). When triggered, timer counts; at `timer==6` snd_bomb, sprite→`spr_mettaton_bomb2`, spawn obj_shake + two obj_mettaton_bomb_hitbox (horizontal xscale 500 yscale 0.5; vertical xscale 0.2 yscale 500) = full-screen **cross explosion**. `timer==12` destroy.
- Draw: draw_self + when bomb2, tile `spr_mettaton_bomb3` (frame image_index) along the cross, 24px steps, i=1..23, up/down rotated 0°, left/right rotated 90°, white.

---

## KEY NUMBERS
```
Attack: rr=6, type=6, name "RECREWColumns". Manager obj_sneo_wall_controller_new (diff!=9)
turntimer = 330 (scr_turntimer, enemy Step_0:912-913). Warmup rtimer==15 before spawn.
Wall: wallsize=7 rows, pitch 34px, wallcountmax=35. Spawn X = camerax()+640 (off right).
  Row Y = cameray()+ (480/2) + i*34 - 172, i=0..6  (car row uses -180; car X = right-50)
Speed slot wallspeed[wall], base -7. wallcontroller = i==0 tile drives it:
  walltype0: t<9 lerp(-16→-6); t<150 hold -6
  walltype1 (diff0/1): t<16 lerp(-21→-5); t<90 lerp(-5→-13)  (accelerates)
Tiles: 0 solid spr_sneo_mail(20x20,org10,10) xs1.2 ys1.71; edges spr_sneo_bullet_box(20x20)
  xs1.25 ys1.6; bottom = spr_sneo_wall_car(58x24,org0,0) xs1.25 ys1.6 depth-1
  crew(2)=spr_sneo_crew(40x48,4fr,org18,22) imgspd0.5 ys1.2 destroyable; red(4)=+c_red;
  gap(1)=empty; bomb(3)=obj_sneo_rotatingwall_bomb
Blend cyan merge(#00A2E8=(0,162,232), aqua, 0.375). damage = monsterat*5. grazepoints 2. bighitbox.
Crew hitbox collision_rectangle(x-18,y-22,x+19,y+22). Cadence: wallcreatetimer per wall
  (diff0 openers 30/40 then 6,6,6; diff1 20/32 then 6,6,6). Closer = all-gap (1,1,1,1,1,9999,0).
Road: 3x spr_sneo_wall_track(320x8) at 320px apart, +=4/frame wrap -960, y=cameray()+480-180.
SFX: snd_bomb (crew/red break, pitch 1.1+rnd0.2), snd_bell (shot bounce off solid).
```
