# Spamton NEO — Phone Attacks Spec

Extracted from decompiled DELTARUNE Ch2 GML. Two related attacks share the "phone"
theme but are mechanically separate.

- **(A) Phonecall** — `global.monsterattackname = "Phonecall"`, dispatched at `rr == 8`.
  Manager: `obj_sneo_phonecall`. A ringing telephone drops on a cord from Spamton's hand,
  Spamton "answers" (dialogue), then it turns into a bullet phase (FootballPipis, or a
  head-spray stream on the hardest difficulty).
- **(B) Phonehands** — `global.monsterattackname = "Phonehands"`, dispatched at `rr == 8.5`
  (also reused at `rr == 4`). Manager `obj_sneo_bulletcontroller` type `8.5` spawns
  `obj_sneo_phonehand_master`. Spamton's sad head, on green phone-cord arms, hovers at the
  right edge and fires shots leftward at the party; two green "hand" limbs crawl the box
  top & bottom edges connected by cord segments.

GML angles are y-up (subtract from y to go visually down). REFDATA: `w×h origin(ox,oy)`.
darksize/`image_xscale=2` sprites are drawn at 2× the listed dims (HALVE the refdata to
get the base art size when needed).

---

## DISPATCH (`obj_spamton_neo_enemy_Step_0.gml`)

- rr assignment per turn: `obj_spamton_neo_enemy_Other_10.gml`:
  - Phonecall (rr=8): `Other_10:36` phaseturn4 diff0 · `:87` phaseturn11 diff1 · phase4 pt2 diff3 (`Step_0:108`) · (also intro dialogue rr=8 diff3 at `:273`).
  - Phonehands (rr=8.5): `Other_10:42` phaseturn5 diff0 (`:46` diff2 if hellmode) · `:75` phaseturn10 diff2 (diff1 if `nothitduringphonehands`==1 or hellmode). Also rr=4 → type 8.5 (`Step_0:821`).
- Bullet spawn gate: `Step_0:794` `if (rtimer == 15)` — 15-frame delay after "bullets" phase begins.
- **Phonecall** `Step_0:849`:
  `dc = instance_create(x - 10, y + 20, obj_sneo_phonecall); dc.isattack = 1; dc.target = mytarget;`
  diff3 → `phoneevent = 2`; else if `phoneevent >= 1` set `dc.skipintro = 1`, then `phoneevent++`.
- **Phonehands** `Step_0:868` (and rr=4 `:821`):
  `dc = scr_bulletspawner(x, y, obj_sneo_bulletcontroller); dc.type = 8.5;`
  `scr_bulletspawner` (`gml_GlobalScript_scr_bulletspawner.gml:6`) sets `dc.damage = global.monsterat[myself]*5`, `dc.target = mytarget`.

---

# (A) PHONECALL  (rr = 8)

Manager `obj_sneo_phonecall`. Sprite `spr_sneo_phone` = **64×64 origin(29,5), 4 frames**.

### VISUALS — `obj_sneo_phonecall_Draw_0.gml`
- `:1` `draw_set_alpha(fadealpha)` (fadealpha=1), `:2` `draw_set_color(c_white)`.
- Hanging/ringing state (`state==0`, or `state==1 && sneo.partframe[1]==0`), `:4-26`:
  - `:6` `siner++`; `:7` `draw_self()` (the phone sprite).
  - `:8` cord: `draw_line_width(x, y, sneo.x+partx[5], -20, 2)` — 2px line from phone up to Spamton's hand (part 5), top at y=-20.
  - `:9` `image_angle = sin(siner/20)*10` — phone sways ±10°.
  - `:11-18` ring wobble: while `ringtimer>0`, `image_angle += (ringtimer%2==0 ? 1 : -1)`, decrement; when `ringtimer<=6` set `sneo.partmode = 5`.
  - `:20` `x = xstart + sin((siner)/20)*10` (horizontal sway ±10px).
  - `:22-25` drop-in: `ydrop += 0.02` (cap 1); `y = lerp(-30, ystart, scr_ease_out(ydrop, -2))` — eases down from y=-30 to ystart.
- Answered/held state (else, `:28-32`): phone anchored to Spamton's arm via orbit:
  - `xx = scr_orbitx(0,0,20,50, sneo.partrot[1]) + sneo.x + partx[1] + partxoff[1]`, `yy = scr_orbity(...)` (`:29-30`).
  - `:31` cord `draw_line_width(xx, yy, sneo.x+partx[5], -20, 2)`.
- `:34` `draw_set_alpha(1)`.
- Spamton head/hand poses driven via `sneo.partmode` (5=ring, 6/7 talk, 9 hold) and `partframe[1]`/`partrot[1]` set in Step (`:104,:118,:132,:154,:169-177`).

### MECHANICS / STATE MACHINE — `obj_sneo_phonecall_Step_0.gml`
- Create (`_Create_0.gml`): `state=0, talktimer=-15, talkmax=45, resumeinterval=1.715, target=-1, damage=-1, fadealpha=1, textboxdistance=20`. Spawned at `(sneo.x-10, sneo.y+20)`.
- `:1-6` init: `y=-30; visible=true`.
- **turntimer** `:8-14`: while `state<7`, `global.turntimer = 430` (diff3 → `100`).
- Talking sub-loop `:16-43`: `talktimer++`; skippable with `button1_p()` (>5) or `button3_h()` (>1) **unless** diff3 & state>=5 (`aa=1`); at `talktimer>=talkmax(45)` destroy `obj_writer`, `state++`.
- State ladder:
  - `:88 state0` → `ringtimer=12`, play `snd_phone` at vol 0.7, `talktimer=-10`, state++.
  - `:100 state1` → `sneo.partmode=6`; if `skipintro==1` jump to state5.
  - `:109 state2/`:123` state3/`:136` state4 → dialogue lines ("WHAT!?", "WHAT? ARE YOU SERIOUS!?", etc.), `sneo.partmode=7`, `writeline=true`. diff3 shortcuts these.
  - `:140 state5` → if in "bullets" phase & `skipintro==0`: final line ("... IT'S FOR YOU." / diff3 "IT'S FOR ME!?"), `textboxdistance=40`; else `state=6`. Sets `sneo.partmode=9`, `partrot[1]=-180`, `partframe[1]=3` (diff3: partframe 4).
  - **`:45 state6` (attack trigger)** — when `scr_isphase("bullets") || isattack`:
    - `:49-55` `songtime` quantized to `resumeinterval` (music resume).
    - `:57` if `isattack`:
      - **diff3** `:59`: `instance_create(sneo.x+partx[5], sneo.y+party[5]+60, obj_sneo_phonecall_pipis_stream)` — the head-spray stream (see below).
      - **else** `:63`: destroy any `obj_sneo_bulletcontroller`; compute orbit anchor `xx/yy` (offset -26, radius 30 if secondtime else 70, at partrot[1]); `global.monsterattackname="FootballPipis"`; `d = instance_create(xx,yy, obj_sneo_bulletcontroller); d.type=1; d.damage = global.monsterat[myself]*5; d.target=target`. → i.e. non-diff3 Phonecall hands off to the **FootballPipis** attack (type 1).
    - `state=7`.
- `:181 writeline` block: `global.typer=72`; `scr_enemyblcon((x - textboxdistance + 22) - textboxoffsetx, y + 60 + textboxoffsety, 10)` places the speech box.
- Destroy (`_Destroy_0.gml`): `sneo.partmode=1`; `with(sneo) scr_move_to_rememberxy(8)`.
- Collision w/ `obj_yheart_shot` (`_Collision...gml:1`): `exit;` (phone itself is invulnerable/uninteractive).

### diff3 STREAM — head-spray bullets
- `obj_sneo_phonecall_pipis_stream_Step_0.gml` (spawns every frame):
  `part = instance_create((x-4)+random(8), (y-4)+random(8), obj_sneo_phonecall_sneohead)`;
  `part.direction = -5 + random(38)`; `part.speed = 7 + random(13)` (7–20); `part.image_angle = direction-180`.
- `obj_sneo_phonecall_sneohead` — sprite `spr_sneo_crew` **40×48 origin(18,22), 4 frames**.
  - Create: `image_xscale=0.5, image_yscale=-0.5` (drawn at HALF, y flipped), `maxhomingfactor=2`.
  - Step (`_Step_0.gml`): destroy if `global.turntimer<3`; `image_angle = direction-180`; `timer++`; at `timer >= 4+irandom(1)` destroy + spawn `obj_pipis_destroy_fx` (xscale/yscale 2, speed 1), play `snd_rocket_sneo` vol 0.1, jitter `sneo.partx[5]/party[5]=random(8)`.
- (`obj_sneo_phonecall_pipis`, sprite `spr_pipis_egg` 16×12 origin(8,6): a separate egg variant at 2× scale that at timer==5 bursts into 3 egg pieces + 8 `sneohead` fragments dir a+random(15), speed random(8); sets `sneo.partsprite[5]=spr_sneo_head_joke`. Used by the football-pipis branch, listed for completeness.)

### PHONECALL — TIMING / SFX / ASSETS
- turntimer: **430** frames (diff3: **100**). Dialogue gated separately (talkmax=45/skip).
- SFX: `snd_phone` (vol 0.7 on answer), `snd_rocket_sneo` (vol 0.1 per head pop).
- Sprites: `spr_sneo_phone`(64×64,o29,5,4f), `spr_sneo_crew`(40×48,o18,22,4f), `spr_pipis_egg`(16×12,o8,6,4f), `spr_sneo_head_joke`(82×89,o30,29). Cord = green? No — Phonecall cord drawn `c_white`, 2px.

---

# (B) PHONEHANDS  (rr = 8.5, also rr = 4)

Spawn chain: bulletcontroller `type 8.5` (`obj_sneo_bulletcontroller_Step_0.gml:786`):
at `btimer == 115` → `d = instance_create(obj_growtangle.x + 40 + sprite_width/2, obj_growtangle.y, obj_sneo_phonehand_master); d.target = target`. (While `btimer>=1` & turntimer>11, Spamton fades out: `image_alpha -= 0.2`.)

### THE HEAD — `obj_sneo_phonehand_master`
Sprite `spr_sneo_head_sad` = **82×89 origin(30,29), 1 frame**. (swaps to `spr_sneo_head_open` when firing, back to `spr_sneo_head` via Alarm0.)

VISUALS (`_Create_0.gml`, `_Draw_0.gml`):
- Create `:3-5` `image_speed=0, image_xscale=2, image_yscale=2` → drawn **2× (164×178)**. `element=6`.
- `:25` `image_blend = merge_color(#00A2E8, c_aqua, 0.25 + sin(bluesiner/3)*0.25)` — pulsing blue/aqua tint (Step `:3` updates each frame). #00A2E8 = RGB(0,162,232).
- Draw: `visibiliytimer++`; skip first frame; `image_alpha += 0.1` up to 1 (fade-in); `draw_self()` at that alpha.
- `hp = 200` (Create `:18`).

MECHANICS (`_Step_0.gml`):
- `:5-6` clamp `x` to `camerax()+480` (right edge).
- Bob: diff0 `y = ystart + sin(siner/8)*40`; diff1/2 `y = ystart + sin(siner/10)*60` (`:38-42`).
- `:44-49` follow hands: diff<2 `x = lerp(x, phonehand_top.x + xdist, 0.2)` (xdist=70); diff>=2 `x -= 1` (creeps left).
- `:19-23` pushes `obj_heart` back so it can't pass `master.x - 36`.
- **Firing** `:52-87` (diff 0/1/2): `btimer++`, `threshold = 20` (diff1→15, diff2→30); when `btimer>=threshold && image_alpha>=1`:
  - diff<2 → `shot = obj_sneo_mmx_spreadshot`; diff2 → `shot = obj_basicbullet_sneo`.
  - `shot.speed=12` (diff2 overridden to 10), `image_xscale=3, image_yscale=3`, `alarm[0]=25`, `direction = 180 + random_range(-5,5)` (leftward), `depth = depth-1`, `target=target`. diff<2 `shot.friction=1`.
  - `sprite_index = spr_sneo_head_open`; `alarm[0]=10` (Alarm0 → `spr_sneo_head`).
- Collision `obj_yheart_shot` (`_Collision...gml`): `hp--`; if left of edge, `friction=0.5`, knockback `hspeed += (big?8:4)`; each `obj_sneo_phonehand` gets `friction=0.5, hspeed += 2 (+4 if big)`; play `snd_damage`; re-clamp x; `with(other) event_user(0)`.
- Hurtbox `obj_sneo_phonehand_master_hurtbox`: sprite `spr_hitbox_10px` **10×10 origin(0,0)**, `image_xscale=4, image_yscale=20` → **40×200 px** collision column, `element=6`, `wall_destroy=1`, `destroyonhit=0`. `Other_15` applies `scr_damage()` (or `scr_damage_all()` if target==3) while active.

### THE HANDS — `obj_sneo_phonehand` (×2, top & bottom)
Sprite `spr_sneo_phonehand` = **58×27 origin(29,13), 1 frame**. Created in master `_Create_0.gml:9-16`:
- top at `(x - 70, y - 70)` orientation "top"; bottom at `(x - 70, y + 60)` orientation "bottom" (`image_yscale=-1`, flipped). Both `.boss = master`, `.target = bulletcontroller.target`. Master drawn `image_xscale/yscale=2`; hands inherit 2×.

VISUALS (`_Draw_0.gml`):
- fade-in `image_alpha += 0.1`.
- `:10-11` `draw_set_color(c_green)`; `draw_line_width(x, y, jointx, jointy, 4)` — 4px green cord from hand to elbow joint.
- `:15` `draw_line_width(jointx, jointy, boss.x, boss.y, 4)` — cord joint→head.
- `:17-21` beads: 4 iterations, `draw_sprite_ext(spr_sneo_bullet0, 0, lerp(x,jointx,i/4), lerp(y,jointy,i/4), 2,2,0, c_green,1)` and same joint→boss — green cord beads (`spr_sneo_bullet0` 11×11 o(5,5) at 2×).
- `:24` `draw_self()` (the hand sprite).

MECHANICS (`_Step_0.gml`):
- Init `:1-21`: elbow joint set — top `jointx = boss.x-10, jointy = y-30`; bottom `image_yscale=-1, jointx = boss.x-10, jointy = y+30`. `remjointy = jointy`.
- "pop" scale `:23-36`: at `btimer==13` snap `image_yscale` to ±2, then ease back toward ±1 by 0.2/frame.
- **Crawl (alt==0, default)** `:40-71`: `crawlsiner++`; grips/pulls along box edge —
  - top: while `sin(crawlsiner/period)<0` (period=5, amplitude=4): `y += cos(crawlsiner/period)*amp*2`, `x += sin(crawlsiner/period)*amp`, sets `wasmoving/movingcheck=1`.
  - bottom: analogous with `cos(crawlsiner/period + π/2)<0`.
  - joint tracks midpoint: `jointx=(x+boss.x)/2`, `jointy=(remjointy+y)/2`.
- **alt==1** (set when master diff==2, master `_Step_0.gml:27-31`) `:73-117`: hands sweep sinusoidally between `camerax()+200` and `boss.x-20` (`x = xx + (endx-xx)/2 + sin(crawlsiner/12)*((endx-xx)/2)`) and **fire sound bullets**: `btimer++`, threshold 18 (top 28); at threshold spawn `obj_basicbullet_sneo` dir 270±2 (top) / 90±2 (bottom), `speed=3`, `sprite_index=spr_sneo_soundbullet`, `grazepoints=3`, `target`. top resets btimer=10, bottom=0.
- diff==99 branches `:119-162` (unused in normal rotation): burst of 3 `basicbullet_sneo` speed 8 on stop-moving, plus rapid speed-4 stream every 6 frames — all `spr_sneo_soundbullet` dir 270/90.

### PHONEHANDS — bullets, damage, collision
- Head shots: `obj_sneo_mmx_spreadshot` (diff<2) / `obj_basicbullet_sneo` (diff2). Both parent `obj_basicbullet_sneo`; `damage = global.monsterat[sneo.myself]*5` (`obj_basicbullet_sneo_Create_0.gml:10`). spreadshot: grazepoints 2, inv 120, `alarm[0]` spread logic. Drawn xscale/yscale 3.
- Hand sound bullets (alt/diff99): `spr_sneo_soundbullet` **30×30 origin(15,15)**, speed 3–8, grazepoints 3.
- Head hurtbox collision column 40×200, `scr_damage()`. Head hp 200 (ACT/knockback interplay via yheart_shot).

### PHONEHANDS — TIMING / SFX / ASSETS
- Delay: master spawns at bulletcontroller `btimer == 115` (~115 frames after phase start). Fire cadence: head every 20f (diff1 15f / diff2 30f); alt hands every 18f (top 28f).
- `global.turntimer`: not overridden by type 8.5 (uses default bulletcontroller turn length; Spamton fades while turntimer>11).
- SFX: `snd_damage` on head hit. (Sound-bullet visuals only; no dedicated fire SFX in this branch.)
- Sprites: `spr_sneo_head_sad`(82×89,o30,29,1f) / `spr_sneo_head_open` / `spr_sneo_head`, `spr_sneo_phonehand`(58×27,o29,13,1f), `spr_sneo_soundbullet`(30×30,o15,15), `spr_sneo_bullet0`(11×11,o5,5), `spr_hitbox_10px`(10×10,o0,0).
- Colors: head blend RGB(0,162,232)↔aqua pulsing; hand cords + beads `c_green`; head 2× scale (HALVE 82×89 base is already art size — the 2× is the on-screen darksize).

---

## KEY NUMBERS SUMMARY (see block returned to caller).
