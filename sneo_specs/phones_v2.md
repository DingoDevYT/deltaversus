# Spamton NEO — "Gripping Phones" (rr = 8.5) — v2 fine re-extract

Source: `DELTARUNE - GML\DELTARUNE Chapter 2 - GML\` + `DELTARUNE - REF DATA\...\objects.tsv`.
GML angle convention is **y-up** (0 = right, 90 = up, 180 = left, 270 = down). All file:line refs are exact.

Object-name reality check (the prompt's names are the port's names; the real objects are):
- head master = **obj_sneo_phonehand_master** (not "…phonehand"), default sprite **spr_sneo_head_sad** (objects.tsv:655)
- gripping hands = **obj_sneo_phonehand**, sprite **spr_sneo_phonehand** (objects.tsv:657)
- **yellow emitter projectile = obj_sneo_mmx_spreadshot**, default sprite **spr_sneo_bullet0** drawn tinted `c_yellow` (objects.tsv:658) — THIS is "the yellow projectile"
- soundwaves = **obj_regularbullet** re-sprited to **spr_sneo_soundbullet** (there is no distinct obj_sneo_soundbullet in this attack)
- head hurtbox = obj_sneo_phonehand_master_hurtbox (spr_hitbox_10px)

---

## THE ATTACK CHAIN (diff 0/1 = the "real" attack the user remembers)

### 0. Dispatch
`obj_sneo_bulletcontroller_Step_0.gml:786-805` — `type == 8.5`: at `btimer == 115` spawns
`obj_sneo_phonehand_master` at `obj_growtangle.x + 40 + growtangle.sprite_width/2, obj_growtangle.y`
(i.e. pinned to the **right edge** of the box), `d.target = target`. rr==8.5 dialogue confirm:
`obj_spamton_neo_enemy_Step_0.gml:219` ("MY [Heart]… MY [Hands]").

### 1. THE YELLOW PROJECTILE (emitter) — fired by the HEAD
Fired in `obj_sneo_phonehand_master_Step_0.gml:52-88`. Every step `btimer++`; when
`btimer >= threshold && image_alpha >= 1` (line 63) the head fires ONE bullet then resets:
- diff 0/1 (`difficulty < 2`, line 67-68): `shot = obj_sneo_mmx_spreadshot` ← the yellow emitter
- diff 2 (line 70): `shot = obj_basicbullet_sneo` (plain straight bullet, NO soundwave spread)

Shared setup (line 72-86): `speed = 12`, `image_xscale = image_yscale = 3`,
`friction = 1` (diff<2, line 77) so it **decelerates and parks** — this is what "marks the emitter point";
`alarm[0] = 25` (line 81); `direction = 180 + random_range(-5,5)` = **fires LEFT into the box** (line 82),
`depth = depth-1`, `target = target`. Head sprite → `spr_sneo_head_open` (line 85), then `alarm[0]=10`
→ Alarm_0 resets sprite to `spr_sneo_head` (`..._Alarm_0.gml:1`).
Emitter Create: `obj_sneo_mmx_spreadshot_Create_0.gml` — inherits obj_basicbullet_sneo (damage = monsterat*5),
grazepoints 2, inv 120. Draw (`..._Draw_0.gml`) = draw_self + `c_yellow` fog overlay = the yellow glow.

### 2. THE 3 SOUNDWAVES — emitted BY the parked yellow projectile, on its ALARM (fixed timer)
`obj_sneo_mmx_spreadshot_Alarm_0.gml:1-20` — 25 frames after it was fired (alarm[0]=25 above),
`for i in 0..2`: spawn `obj_regularbullet` at the emitter's parked (x,y):
- `direction = 120 + i*60` → **120, 180, 240** — FIXED, hardcoded, **NOT aimed at the soul/target**.
  Centre = 180 (GML-left = screen-left, toward the play area), spread = **±60° (120° total arc), 60° apart**.
  (User said "90°/±45/right"; the actual code is 120°/±60 centred on GML-180. It never rotates to face the soul — that "fixed, un-aimed" property is the port's bug.)
- `speed = 2`, `friction = -0.6` (accelerates outward), `sprite_index = spr_sneo_soundbullet`,
  `image_angle = direction`, `grazepoints = 7`, `element = 6`; `scr_bullet_inherit(shot)` copies damage/target.
- Emitter then `instance_destroy()` (line 20). So: 1 yellow bullet → after 25f → 3 soundwaves → gone.
  Cadence of soundwave *bursts* = the head's fire rate (below), because each yellow bullet = one 3-wave burst.

### 3. FIRE RATE of the head emitter — the difficulty variant the user sensed
`obj_sneo_phonehand_master_Step_0.gml:55-61`: `threshold = 20` base;
`if difficulty==1 -> threshold = 15` (**faster**); `if difficulty==2 -> threshold = 30`.
btimer counts every step, gated on `image_alpha >= 1`. So burst cadence:
**diff0 = every 20f, diff1 = every 15f (the sped-up variant), diff2 = every 30f (and fires basicbullet, no spread).**

### 4. HEAD + TWO GRIPPING HANDS
Head master Create (`..._master_Create_0.gml`): `image_xscale=image_yscale=2`, `xdist=70`, `hp=200`,
`difficulty = obj_spamton_neo_enemy.difficulty`, `image_alpha=0` (fades in via Draw, +0.1/f).
Hands spawned: **top** at `(x-70, y-70)`, **bottom** at `(x-70, y+60)` (lines 9-16), each `.boss=head`.
Head bob (Step 38-42): diff0 `y = ystart + sin(siner/8)*40`; diff1/2 `sin(siner/10)*60`.
Head x tracks hands: diff<2 `x = lerp(x, phonehand_top.x + xdist, 0.2)`; diff2 `x -= 1` (Step 44-50).
Head clamps to `camerax()+480` (Step 5-6, 21-22 also clamps obj_heart to head.x-36 — soul kept left of head).
Head hurtbox = obj_sneo_phonehand_master_hurtbox (`spr_hitbox_10px`, xscale 4, yscale 20).
**Head IS shootable & pushes back**: `..._master_Collision_obj_yheart_shot.gml` — `hp--`, `friction=0.5`,
`hspeed += 4` (or `+8` if `other.big`), and every obj_sneo_phonehand gets `hspeed += 2` (`+4` if big);
clamped back to camerax+480; plays `snd_play(snd_damage)`.
Hand crawl (`obj_sneo_phonehand_Step_0.gml`, alt==0 branch, lines 40-71): `crawlsiner++`, `period=5`,
`amplitude=4`; top hand only advances while `sin(crawlsiner/period) < 0` (grip-and-drag crawl),
`y += cos()*amp*2; x += sin()*amp`; bottom mirrored with +π/2 phase, `image_yscale = -1`.
Green "cord" drawn hand→joint→boss with spr_sneo_bullet0 dots (`obj_sneo_phonehand_Draw_0.gml`).
(diff2 only: hands go `alt=1`, sweep between camerax+200 and boss.x-20, firing spr_sneo_soundbullet
straight up 270 / down 90 at threshold 28/18 — different pattern, not the yellow-emitter one.)

### 5. DAMAGE / SCALES / SFX
- Damage: `obj_basicbullet_sneo_Create_0.gml:10` `damage = global.monsterat[obj_spamton_neo_enemy.myself] * 5`;
  the yellow emitter inherits it and passes it to the soundwaves via scr_bullet_inherit. So **all = monsterat*5**.
- Scales: head ×2; yellow emitter ×3; soundwaves = sprite default. **No `darksize` multiplier is applied** to these
  objects (darksize is not referenced anywhere in the phone objects or scr_bullet_init).
- SFX: `snd_damage` on shooting the head (Collision:24). No fire/emit sound in the emitter or hand Step events;
  `snd_hurt1` only appears in the unrelated tiny-ralsei collision. (The phone "ring" audio is the turn BGM/voice, not a per-bullet snd_.)

---

## KEY NUMBERS
```
DISPATCH          bulletcontroller type==8.5, spawn obj_sneo_phonehand_master at btimer==115, box RIGHT edge
YELLOW EMITTER    obj_sneo_mmx_spreadshot, spr_sneo_bullet0 tinted c_yellow, xscale/yscale=3
  fired by        the HEAD (obj_sneo_phonehand_master), Step:68 (diff<2 only)
  speed/dir       speed=12, direction=180 +/- 5 (LEFT into box), friction=1 -> parks = emitter point
  lifetime        alarm[0]=25 -> emits soundwaves then instance_destroy
SOUNDWAVES        3x obj_regularbullet re-sprited spr_sneo_soundbullet, from emitter's parked (x,y)
  angles          FIXED 120 / 180 / 240 (center 180=GML-left, +/-60, 60 apart) — NOT aimed at soul
  speed/accel     speed=2, friction=-0.6 (accelerates), grazepoints=7
  timing          on emitter alarm (25f after fired); one burst per emitter bullet
FIRE RATE (head)  diff0 threshold=20f | diff1 threshold=15f (FASTER variant) | diff2 threshold=30f(+basicbullet)
HANDS             obj_sneo_phonehand spr_sneo_phonehand; top(x-70,y-70) bottom(x-70,y+60); xdist=70
  crawl           period=5 amplitude=4, advance only while sin<0 (grip-drag); bottom yscale=-1, +pi/2 phase
HEAD              spr_sneo_head_sad/_open/_head, xscale/yscale=2, hp=200, bob diff0 sin(siner/8)*40 / else *60
  hurtbox+push    shootable; hit -> hspeed+=4 (+8 if big), hands +=2 (+4 big); clamp camerax+480
DAMAGE            all bullets = global.monsterat[sneo.myself]*5 ; darksize NOT applied
SFX               snd_damage on shooting head; no per-bullet fire sfx
```
