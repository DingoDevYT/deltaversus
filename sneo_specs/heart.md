# Spamton NEO — "Heart Attack" (HeartAttackNeo)

Dispatch: `obj_spamton_neo_enemy_Step_0.gml:808-814` — `rr == 2` → `global.monsterattackname="HeartAttackNeo"`, spawns `obj_sneo_bulletcontroller` with `dc.type = 1.5`, `dc.special = hellmode`.

## WHAT IT IS
Wire-frame heart(s) detach from Spamton NEO's chest (`spr_sneo_wireheart`), fly out across the arena on ease-out/ease-in arcs, and fire diamond-bullet fans while extended. On harder difficulties the emitted hearts are **biter hearts** (fire red lasers) and **bomb hearts** (explode into a diamond ring barrage). Attacking a heart with your SOUL's shots damages it / drains the turn timer. This is the classic "beautiful HEART" attack.

## DISPATCH / CONTROL FLOW
- `obj_sneo_bulletcontroller_Step_0.gml:150-173` (type 1.5): decrement `hearttargettimer`; at `init==1` set `obj_spamton_neo_enemy.partmode = 34`, `init=2`, `btimer=100`. At `btimer==110`: `with obj_spamton_neo_enemy { heart_release_con++; if(heart_release_con==1) makeheart = 1; }`.
- Real spawn logic lives in enemy Draw (`partmode == 34` block): `gml_Object_obj_spamton_neo_enemy_Draw_0.gml:618-994`.
- `hearttype` chosen by difficulty (`:620-632`): diff0→0, diff1→1, diff2→2, diff3→3, diff4→4.
- Enemy Create defaults (`obj_spamton_neo_enemy_Create_0.gml:105,175-179`): `heart_release_con=0, makeheart=0, makeheartinit=0, makehearttype=0, makehearttimer=0, makeheartalt=0`.
- Controller Destroy (`obj_sneo_bulletcontroller_Destroy_0.gml`): resets `makeheartinit=0, makeheartalt=0, partmode=1, heart_release_con=0`; `sneo.x=sneo.xstart`.

## BODY POSE / ANIM (partmode 34, enemy Draw)
- 8 body parts lerp to `idealrot[]`/`idealx[]` pose sets that alternate with `heart_release_con` (0 vs 1): pose arrays at `:651-666` (con0) and `:684-699` (con1). Under `global.turntimer<20` all ideals zero out (`:704-719`).
- `flyx`: `heart_release_con==1 → -20`, else 0 (`:634-640`).
- Part motion (`:972-993`): turntimer<20 → lerp parts/`x` back home (`x→xstart`, factor 0.1); else parts lerp toward ideals, `heartattackoffsetx` lerps to -10 (con0) / -60 (con1) at 0.01·f, `x→xstart+60` (0.1). `partrot` lerp 0.14·f (+random(4)), `partx` 0.1·f, `party` 0.06·f.
- `makeheart` spawn gate for biter/bomb types (`:668-679`): if `hearttype>2 && instance_number(obj_sneo_wireheart)<3 && makehearttimer<1 && global.turntimer>100 && makeheartinit==1` → `makehearttimer=80, makeheart=1, makehearttype=choose(3,4)`; if `makeheartalt!=0` override `makehearttype=makeheartalt, makehearttimer=120`.
- On `makeheart` fire (`:725-968`): if `makeheartinit==0` set it =1, `makehearttype=0`. Then spawn `obj_sneo_wireheart` at `(x+10, y+80)` per hearttype (see below). After spawns: 6× `obj_afterimage` shards (`spr_bullet_laser_circle`, speed 10+random(2), dir 140±40, gravity 1, xscale=yscale=0.5+random(0.5)) `:957-966`; then `makeheart=0`.

### Heart-spawn table (all wirehearts spawn at boss x+10, y+80, target=3)
- **hearttype 0** (diff0): 1 heart, `type=0`, `special=hellmode`. Damage below.
- **hearttype 1** (diff1): 1 heart, `type=0`.
- **hearttype 2** (diff2): 1 heart, `type=0`, `bighearttype=1`.
- **hearttype 3** (diff3): `makehearttype==0`→ type1 + type3(altbiter3) + type3(altbiter4); `==3`→ type3 altbiter3; `==4`→ type3 altbiter4 (`:828-893`).
- **hearttype 4** (diff4): `makehearttype==0`→ type1 + type4 + type4; `==3/4` variants type4 (`:894-954`).
- Damage per heart (`:743-751` pattern, repeated): `scr_sideb_get_phase()>2` → `target=obj_sneo_bulletcontroller.target`, `damage=floor(global.monsterat[myself]*5*0.8)`; else `damage=floor(global.monsterat[myself]*5*0.6)`.

## obj_sneo_wireheart (the HEART) — full events
Create (`_Create_0.gml`): `element=6, hp=300, image_xscale=image_yscale=0` (grows in), `moveframes=30, type=0, altbiter=1, hpos=5+random(1.5)`, `invincibility_timer=2`.
Step (`_Step_0.gml`):
- init (`:1-51`): `image_xscale=image_yscale=0.5`; `scr_lerpvar` scale 0.5→1 over 20f "out". Per type: **type1** `spr_sneo_wireheart_smaller`, `moveframes*=0.8`, `hp=10`; **type3** `spr_sneo_wireheart_biter`, `hp=3`, `moveframes=12`; **type4** `spr_sneo_wireheart_bomb`, `hp=1`.
- con1 target pick (`:53-108`): `targetx=camerax()+300+random(70)`, `targety=cameray()+145+random(-70,70)`; `bighearttype==1`→moveframes=16. type3 altbiter overrides: alt1→(cx+150, cy+240), alt2→(cx+150, cy+75), alt3→(cx+350, cy+130+rand(-45,0)), alt4→(cx+350, cy+160+rand(45,0)), else (cx+170+rand70, cy+145±60). If `obj_heart` exists & `hearttargettimer<1` & type!=3, 1/3 chance `targety=obj_heart.y+10` (homes on SOUL), set `hearttargettimer=6`. type0/1 set boss `heart_release_con=1`.
- con2 fly-out (`:110-121`): `movetimer += 1/moveframes`; `x=lerp_ease_out(bossx,targetx,mt,2)`, `y=lerp_ease_out(bossy,targety,mt,2)`; at mt≥1 → con3.
- con3 (`:123-161`): type3 alt1/2 sweep y between cy+240↔cy+75 over 21f then con10; type3 alt>2 spawns `obj_sneo_heart_laser` at movetimer==1, holds 16f; else con10 immediately.
- con10 return (`:163-181`): `x=lerp_ease_in(targetx,bossx,mt,2)` etc.; when mt>0.5 (type0, or type1 diff>2) boss `heart_release_con=0`; at mt≥1 → con1 (loop), `shottimer=0`.
- **Bullet fire** (`:183-276`, active during con 2/3/10): when `abs((x-targetx)/(targetx-bossx))<0.2` decrement `shottimer`; at ≤0:
  - **type0**: `firedtimer=4`; fan of `radial=5` `obj_collidebullet` `spr_diamondbullet`, `direction=(i/5)*180 + 110 + dir`, speed=1, `friction=-0.3`, depth-1, damage=wireheart.damage, element6. `bighearttype==1`: `dir=±(25+random10)` based on y vs obj_growtangle.y, friction=-0.23, shottimer=6 (else 10). `special==1`→ dir ±random(10). grazepoints: diff0→3, diff2→2.
  - **type1**: `firedtimer=4`; 5× `obj_collidebullet` `spr_diamondbullet` aimed `point_direction` at SOUL (`obj_heart.x+10,+10`), scale 0.5, speed=3, friction=-0.2; `shottimer=6`.
Draw (`_Draw_0.gml`):
- `rembossx` lerps to `boss.x + (50 - heart_release_con*100)` (0 if turntimer<20) factor 0.16; `rembossy=boss.y+80`.
- Invincibility flicker: hides sprite on `invincibility_timer` ∈{10,9,6,5,3,2}.
- **Trail**: type3 altbiter1/2 → 7× `draw_sprite_ext(spr_sneo_wireheart, frame 5, lerp(x→rembossx i/5or6), lerp(y→rembossy i/hpos), 0.75,0.75)`. Else → 11× `draw_sprite_ext(spr_sneo_wireheart, frame 4, lerp i/9, i/9, image_xscale,image_yscale)` (a wire/chain trailing back to boss). Uses `image_blend` (white), `image_alpha`.
- Anim: `image_index` toggles 0↔1 every 5f (animtimer≥5→1, ≥10→0); `firedtimer>4`→frame 3; then `draw_self()`. Damage flash: `draw_sprite_ext(sprite_index,2,...,alpha=damagetimer/5)`, damagetimer--.
- **On destroyed** (`:68-128`): `snd_play(snd_bomb)`; if type4 & turntimer>20 → spawn `obj_sneo_heart_bomb_explode` (depth-2), else `scr_afterimage_cut()`. 11× `scr_marker(spr_sneo_wireheart frame4)` pieces along wire, each delayed `scr_afterimage_cut`, `snd_bomb`, `snd_volume(142,0.5,0)`, `scr_doom` at i*2. altbiter1/2 → `makeheartalt = altbiter+2`. type0 (or type1 diff>2): if monster at full HP & phase<3 → mercy +3 (dmgwriter type5); else `global.monsterhp[0] -= ceil(maxhp*0.03)`. `instance_destroy()`.

### Heart HP / hit response (`_Collision_obj_yheart_shot.gml`)
- `invincibility_timer>0 && other.big==0` → destroy shot, exit. On hit set `invincibility_timer=10`, flash `damagetimer=5`, `snd_damage`.
- `turntimer<150`: `hp=0`; type0 (or type1 diff>2, turntimer>20) → `global.turntimer=20` and destroy ALL wirehearts.
- else type0/type1(diff>2): drain turntimer — big shot: `turntimer -= (80 - chargeshothitcount*10)` (cap 3 hits); normal: `turntimer -= (20 - normalshothitcount)` (cap 10). Other types: big→`hp-=5`, normal→`hp--`. `hp<=0`→destroyed=1.
- vs `obj_sneo_tiny_ralsei` (`_Collision_..ralsei`): turntimer drain 80 (type0/1>2) / else `hp-=5, ralsei.hp-=10`. vs `obj_sneo_tiny_susie_axe`: turntimer<150→destroy all; else `turntimer-=5` or `hp-=0.25`.

## SUB-PROJECTILES
- **obj_collidebullet + spr_diamondbullet** — the heart's fan bullets (33×32, origin 16,15). Accelerating (negative friction), element 6.
- **obj_sneo_heart_laser** (type3 biter, altbiter>2) — Create: `image_speed 0.25`, `image_xscale=image_yscale=0.1`, `image_angle=point_direction→SOUL ±20`. Step: t1-7 spawn `obj_rouxls_power_up_orb` (dir irandom360, lifetime12); t1-13 scale +0.025/f; **t==14** `snd_wallclaw`, spawn `obj_queen_laser` at image_angle, destroy. Draw: red telegraph `spr_lasergun_laser_telegraph` xscale 999 yscale 0.7 alpha 0.3, pulsing.
- **obj_sneo_heart_bomb_explode** (type4 bomb) — Create: `image_index=1, image_speed=0`. Step: flip image_index 0↔1 every 3f; `siner+=4`, `image_xscale=image_yscale = 2 + sin(siner/6)*0.5` (pulse). **At siner==96**: `snd_rocket`; ring of 8 pairs of `obj_sneo_heatattack_bullet` (spr_diamondbullet): base angle `a=random(44)`, per step +45°; pair A dir=a friction=-0.34, pair B dir=a+10 friction=-0.1; speed=1, newtype=1, element6, damage=`monsterat*5`. Destroy.
- **obj_sneo_heatattack_bullet** — Create: `f=1, damage=monsterat*5, grazepoints=2`. Step: `f+=1.4`, moves `lengthdir(f,dir)` (accelerating), destroy if turntimer<1.
- **obj_sneo_heart_biter_bullet** — Create: `damage=monsterat*5, grazepoints=2`. Step: `image_angle=direction`, after t50 alpha-=0.1, destroy at alpha<0 or turntimer<1.

## VISUALS / SPRITE REFDATA (darksize=2 → HALVE for dark-world 1:1)
- `spr_sneo_wireheart` 6f, **52×52**, origin (26,26). Drawn at image_xscale/yscale ~1 (grows 0.5→1). frames: 0/1 idle anim, 2 damage-flash, 3 fired, 4 wire-trail, 5 biter-trail.
- `spr_sneo_wireheart_smaller` 6f, **34×34**, origin (17,17) (type1).
- `spr_sneo_wireheart_biter` 5f, **32×32**, origin (16,16) (type3).
- `spr_sneo_wireheart_bomb` 5f, **32×32**, origin (16,16) (type4).
- `spr_diamondbullet` 1f, **33×32**, origin (16,15) — fan/ring bullets (type0/1 fire at scale 0.5).
- `spr_bullet_laser_circle` 1f, **15×15**, origin (6,7) — 6 spawn-shards, scale 0.5–1.0.
- `spr_lasergun_laser_telegraph` 1f, **2×13**, origin (0,6) — biter laser telegraph, drawn xscale 999.
- `spr_sneo_head` 4f, **82×89**, origin (30,29) — body part 5.
- Color: hearts drawn with `image_blend` (white default) + `image_alpha`; biter laser telegraph `c_red`; diamond bullets default (yellow-ish element-6). depth of fan bullets = heart.depth-1.

## MECHANICS SUMMARY (difficulty 0/1/2, in-game = diff 0/1/2/3/4 internal)
- **diff0 (hearttype0)**: 1 big heart type0, loops out/back firing 5-bullet 180° fan every 10f (dir base 110°). Hit it to drain turntimer (20/hit, or big-shot up to 80). grazepoints 3.
- **diff1 (hearttype1)**: 1 heart type0, harder; type1 subheart aims 5 bullets straight at SOUL. hit-drain only counts for diff>2 on type1.
- **diff2 (hearttype2)**: 1 heart type0 `bighearttype=1` → tighter/faster fan (dir tilts ±25-35 by y, friction -0.23, shottimer 6), moveframes 16. grazepoints 2.
- **diff3 (hearttype3)**: biter hearts (`spr_sneo_wireheart_biter`, hp3) fire red `obj_queen_laser` after 14f telegraph; up to 3 alive; respawn via makeheart choose(3,4).
- **diff4 (hearttype4)**: bomb hearts (`spr_sneo_wireheart_bomb`, hp1) fly out & explode into 16-diamond accelerating ring barrage.
- Collision radius: default `scr_bullet_init` bbox of each sprite.

## TIMING
- Controller: `init` at btimer≈100→ init2 (btimer set 100); at `btimer==110` fire first makeheart (heart_release_con→1).
- Heart cycle `moveframes`: type0=30, type1=24 (30·0.8), type3=12, bighearttype=16. con2 out + con3 hold + con10 return, then loops (con1) until destroyed or turntimer expires.
- Fan cadence: type0 shottimer 10 (6 if bighearttype), type1 shottimer 6. Only fires while heart is >80% toward target.
- Bomb pulse: explodes at siner==96 (siner+=4 ⇒ 24 steps).
- Biter laser: fires at timer==14.
- Attack ends when `global.turntimer` counts to <1 (turntimer<20 pulls body home; <150 lets a hit end it). Type-1.5 block sets no explicit turntimer — inherits battle default (type0 reference sets 240/300/360 by difficulty).

## SFX
`snd_bomb` (heart destroyed + wire pieces), `snd_damage` (heart hit), `snd_rocket` (bomb explode), `snd_wallclaw` (biter laser fire), `snd_hurt1` (ralsei collision), `snd_volume` (wire-piece fade). Body settle uses `snd_bump` (partmode reset).

## ASSETS
Objects: obj_sneo_bulletcontroller, obj_spamton_neo_enemy, **obj_sneo_wireheart**, obj_collidebullet, obj_sneo_heart_laser, obj_queen_laser, obj_rouxls_power_up_orb, obj_sneo_heart_bomb_explode, obj_sneo_heatattack_bullet, obj_sneo_heart_biter_bullet, obj_afterimage, obj_marker, obj_heart, obj_growtangle.
Sprites: spr_sneo_wireheart, spr_sneo_wireheart_smaller, spr_sneo_wireheart_biter, spr_sneo_wireheart_bomb, spr_diamondbullet, spr_bullet_laser_circle, spr_lasergun_laser_telegraph.
Scripts: scr_bullet_init, scr_lerpvar, lerp_ease_out, lerp_ease_in, scr_marker, scr_afterimage_cut, scr_doom, scr_script_delayed, scr_sideb_get_phase, scr_move_to_rememberxy.
