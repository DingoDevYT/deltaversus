# Roaring Knight — On-Field Body Visual/Animation Spec

Source: `DELTARUNE - GML/DELTARUNE Chapter 3 - GML/gml_Object_obj_knight_enemy_*.gml`
Sprite dims from `DELTARUNE Chapter 3 - REFDATA/sprites.tsv`. Frame files in EXPORT are `spr_<name>_<i>.png`.

Drives the DeltaVersus `fx.bossSprite {key,n,rate,ttl}` channel so the Knight reacts on-field.

---

## 0. TL;DR of how the body behaves

The **on-field body is almost always just `spr_roaringknight_idle`** (a single-frame sprite) bobbing vertically. It never itself swaps to an "attack pose". All the flashy attack/sword/roar poses are drawn by **separate spawned objects** (`obj_knight_swordfall`, `obj_knight_rotating_slash`, `obj_roaringknight_quickslash_attack`, `obj_knight_tunnel_slasher_*`, `obj_knight_roaring2`) that `obj_knight_warp` in near the arena box while the real body keeps bobbing. The body only visibly changes for **block** and **hurt**. For the port, if we want the boss to "react while attacking" we drive `bossSprite` to those attack-pose keys ourselves — the reference only does it via decoy objects.

Default `sprite_index` (objects.tsv): `obj_knight_enemy → spr_roaringknight_idle`.

---

## 1. Idle (default) — `spr_roaringknight_idle`

- `Create_0:5-6` — `idlesprite = spr_roaringknight_idle; hurtsprite = spr_roaringknight_idle;` (hurtsprite is later reassigned to `spr_roaringknight_hurt`, see §3). `sparedsprite = spr_roaringknight_hurt`.
- `Create_0:4` — `image_speed = 0.16666` (1/6), but **idle sprite has only 1 frame** (`sprites.tsv`: `spr_roaringknight_idle 1 117 115 origin 7,23`), so there is **no frame cycling** — idle is a static pose.
- **Bob:** `Draw_0:30` (state 0/3) `image_index = 0; y = ystart + cos(siner2 / 8) * 8;` where `siner2++` every step (`Draw_0:1-2`). Vertical sine bob, **amplitude 8 px in world units, period = 2π·8 ≈ 50 steps**. Drawn at **scale 2** (`draw_sprite_ext(...,2,2,...)`), so on-screen bob ≈ ±16 px.
- **Constant afterimage trail:** `Draw_0:33-64` every `aetimer%4==0` (while alpha≠0, not charging) spawns `obj_afterimage` of `spr_roaringknight_idle` at `image_alpha 0.6, fadeSpeed 0.02, hspeed 2` — a persistent rightward motion-blur ghost. Signature look; optional to replicate.
- Draw path: `scr_enemy_drawidle_generic(0.16666)` (`Draw_0:133`) → draws `idlesprite` at `image_index = siner` (wraps to 0 on 1-frame sprite).
- **Port `bossSprite` idle:** `{key:'knight_idle', n:1, rate:0, ttl:∞}` + a sine y-offset `cos(t/8)*8` (scale to your body scale).

## 2. Block reaction (Step_0 `blockanim`) — `spr_roaringknight_block_ol`

Trigger: incoming attack while `blocking`. Handled in `Step_0:48-103`.
- `blockanim==1` (`:48`): stop+play `snd_bell`; `idlesprite = spr_roaringknight_block_ol`; `whiteflash = 2`; `shakex = 5`; `state = 3`; `hurttimer = 30`; → `blockanim=2`.
- `blockanim==2` (`:61`): `blocktimer++`; spawns `obj_block_vfx` using `spr_roaringknight_block_vfx` (7f, 39x39): at `blocktimer==1` two puffs (vspeed ∓8, xy-scale 1.3, image_speed 0.5), extra puffs at `blocktimer==3` and `==6` (`choose(-8,8)`).
- `blocktimer==15` (`:97`): reset `blockanim=0`, `idlesprite = spr_roaringknight_idle`.
- **Visual summary:** bell *ding*, body snaps to `block_ol` pose, one white flash (2 frames), horizontal shake (shakex 5), sparks/`block_vfx` puffs fly up+down for ~15 frames, then back to idle. `block_ol` = 1 frame (82x76, origin -4,-5).
- **Port `bossSprite`:** `{key:'knight_block', n:1, rate:0, ttl:15}` + whiteflash(2) + shakeX(5) + block_vfx particles.

## 3. Hurt reaction — `spr_roaringknight_hurt` / `state 3`

- `Step_0:42` — on first turn `hurtsprite = spr_roaringknight_hurt` (3f, 100x93, origin 0,0). `blocking = 0` also set here (`:41`) so later hits actually hurt instead of block.
- Entering hurt: `state = 3`, `hurttimer` (e.g. 30). `Step_0:888` `if (state==3) scr_enemy_hurt();` decrements hurttimer / restores state.
- Draw (`Draw_0:74-131`): while `state==3 && hurttimer>=0`, every other frame alternate **`idlesprite`** ↔ **`spr_roaringknight_ball_transition` frame 7** (jitter) at `x+shakex+hurtspriteoffx`; if `stronghurtanim==false` it just shows idle.
  - `hurttimer==29 && stronghurtanim`: `snd_knight_hurtb`.
  - `hurttimer==15`: `stronghurtanim = false`.
- Whiteflash overlay (`Draw_0:135-147`): while `whiteflash>0`, draws `hurtsprite` frame 0 at alpha 0.62 under white fog (state 3), or idlesprite (state 0).
- **Port `bossSprite`:** `{key:'knight_hurt', n:1, rate:0, ttl:30}` + shakeX + optional 1-frame ball_transition jitter + white overlay flash.

## 4. Attack poses (drawn by decoy objects, not the body)

Body stays idle; these are the poses the reference shows during each attack. Import them so the port can drive `bossSprite` for reactions. Attack routing: `Other_10` picks `myattackchoice`; `Step_0:409-573` spawns the bullet controller by type.

| Attack (myattackchoice / name) | Pose sprite(s) used | Where |
|---|---|---|
| Quickslash / rotating-slash streams | `spr_roaringknight_attack_ol` (6f, 117x115, o 7,23) | objects.tsv: `obj_roaringknight_quickslash_attack`, `obj_roaringknight_boxsplitter_attack` |
| Swordfall (choice 10 "swords falling") | `spr_roaringknight_attack_ol_center` (6f, 117x115, o 67,23) + `spr_roaringknight_sword_ol` (1f, 75x31) | `obj_knight_swordfall_Draw_0:1-9` (centered variant drawn at `camerax()+544`, own bob `cos(_siner/8)*8`) |
| Flurry (choice 2) / rotating slash aim | `spr_roaringknight_flurry_prepare` (1f, 113x95) → `spr_roaringknight_flurry` (3f, 113x78) | `obj_knight_rotating_slash_Step_0:236, 546` |
| **Roar** (choice 9, phase-4 climax) | `spr_roaringknight_front_roar` (2f) → `spr_roaringknight_front_flourish` (7f) → `spr_roaringknight_front_slash` (6f, 133x141); build-up uses `spr_roaringknight_front_filled` (1f) | `obj_knight_roaring2_Step_0:418, 503, 532, +41` |

**Sword raise (`sword_appear` / `sword_grab`):** `spr_roaringknight_sword_appear` (3f, 83x95, o -10,17) and `spr_roaringknight_sword_grab` (10f, 83x110, o -5,32) are the "summon a sword in hand" frames — used by the sword-tunnel / sword-summon attack objects (grep hits in `obj_knight_swordfall`, `obj_knight_roaring_fx`, `obj_ch3_PTB02_roaringknight`). Not shown by the base body during normal turns.

Other body poses in the set: `spr_roaringknight_front` (1f neutral front), `spr_roaringknight_pose_ol` (2f), `spr_roaringknight_recoil` (2f, 62x88), plus slash-mark sprites `spr_roaringknight_slash_red_alt` (14f, 80x120), `spr_roaringknight_slash_white_horizontal` (1f, 262x19), `spr_roaringknight_slash_tunnel` (1f, 99x21) used as projectile/telegraph FX, not body poses.

## 5. Manifest status (`docs/assets/manifest.json`)

Currently present: **only** `anims.knight.idle` = `["idle_0.png"]`, dur 150 — a single idle frame. Nothing else Knight-body exists. All poses below need importing.

### Imports still needed (spr_name → suggested key; animated?)

| spr_name | suggested key | frames | notes |
|---|---|---|---|
| spr_roaringknight_idle | knight/idle *(have it)* | 1 | static; bob is positional |
| spr_roaringknight_block_ol | knight/block | 1 | :notrim (origin -4,-5) |
| spr_roaringknight_block_vfx | fx/knight_block_vfx | 7 | animated, particle |
| spr_roaringknight_hurt | knight/hurt | 3 | animated (draw uses f0) |
| spr_roaringknight_ball_transition | knight/ball_transition | 10 | draw uses frame 7 for hurt jitter |
| spr_roaringknight_attack_ol | knight/attack | 6 | animated; main attack pose |
| spr_roaringknight_attack_ol_center | knight/attack_center | 6 | animated; :notrim (origin 67,23) — swordfall |
| spr_roaringknight_sword_ol | knight/sword_ol | 1 | swordfall held blade |
| spr_roaringknight_flurry_prepare | knight/flurry_prepare | 1 | |
| spr_roaringknight_flurry | knight/flurry | 3 | animated |
| spr_roaringknight_front_roar | knight/roar | 2 | animated; roar start |
| spr_roaringknight_front_flourish | knight/roar_flourish | 7 | animated |
| spr_roaringknight_front_slash | knight/roar_slash | 6 | animated; :notrim (origin 60,68) |
| spr_roaringknight_front_filled | knight/front_filled | 1 | roar charge silhouette |
| spr_roaringknight_front | knight/front | 1 | neutral front |
| spr_roaringknight_sword_appear | knight/sword_appear | 3 | animated; :notrim (origin -10,17) |
| spr_roaringknight_sword_grab | knight/sword_grab | 10 | animated; :notrim (origin -5,32) |
| spr_roaringknight_recoil | knight/recoil | 2 | animated; :notrim (origin -22,11) |
| spr_roaringknight_pose_ol | knight/pose | 2 | animated |

Notes: sprites whose origin is non-trivial (marked :notrim) must keep their native canvas/origin so the pose lines up over the idle body; `attack_ol` shares idle's origin (7,23) so it drops in cleanly. All body sprites are authored ~117x115 and drawn at scale 2 in-battle.
