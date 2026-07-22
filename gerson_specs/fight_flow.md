# Gerson ("Hammer of Justice") Boss Fight — EXACT Port Spec

Source enemy object: `obj_hammer_of_justice_enemy` (DELTARUNE Chapter 4 GML).
All dialogue below is PARAPHRASED — never ship verbatim strings.

---

## 1. Enemy / turn model

This is a **MERCY/progress fight, not an HP-drain fight.** You do not kill Gerson; you fill a
golden "progress" meter (his desired "haircut") by ACTing and landing attacks. The fight ends in a
spare.

- `obj_hammer_of_justice_enemy` extends `obj_monsterparent` (REFDATA `objects.tsv:1438`, default sprite `spr_gerson_idle`, no HP-based defeat).
- Create defaults: `gml_Object_obj_hammer_of_justice_enemy_Create_0.gml`
  - `image_speed = 0.1667`, `idlesprite = hurtsprite = sparedsprite = spr_gerson_idle` (Create:17-20)
  - `progress = 0`, `phase = 1`, `turn = 0`, `trueturn = 0`, `attackpattern = 0` (Create:3,23,27-29)
  - `talkmax = 90`, `recruitcount = 1` (Create:15-16)
  - `swingdownbeatspeed = 23` (ramps down to floor 19 each swing turn) (Create:71)
  - If flag 853 set: skips intro → `trueturn=1, turn=1, attackpattern=1, repeatonce=1` (Create:97-103)
- **Progress → phase gate:** in enemytalk phase, `if (progress >= 84) { phase = 4; trueturn = 20; }`
  (`Step_0.gml:125-129`). trueturn 20 is the final attack.
- Progress is also awarded by ACTing: the "haircut/ATTACK" dodge (`state 13`) grants `progress += 4`
  + tension heal (`Step_2`→ actually Draw_0.gml:353-403, state 13). Mercy-laugh (`state 12`) and
  `obj_gerson_progress_star` bursts add progress (Draw_0.gml:1106-1126).
- First-time flavor thresholds at progress 25 / 50 / 75 (`Step_0.gml:711-725`, one-shot globals
  `global.justice_reached_25/50/75_first_time`).

### ACT options
The spell/act menu is wiped and rebuilt custom each battle: `Step_0.gml:21-35` clears
`global.canactsus`, `global.battlespell[1]`, `global.battleactcount[1]` then `scr_spellmenu_setup()`.
`scr_spellget(2, 11)` in Create:90. The signature ACT is the **"haircut" / ATTACK** prompt
(paraphrased flavor in `dialogue_string79`, Create:206) which triggers Gerson's dodge-and-reward.

---

## 2. Attack roster & ORDER (this is the canonical sequence)

Each enemy turn, `event_user(0)` (= `Other_10.gml`) builds a spear queue from `attackpattern`, then at
the very end (`Other_10.gml:2276-2356`) it OVERRIDES `attackpattern` from `trueturn`, and increments
`trueturn`/`turn`. So the fixed ordered roster is keyed by **trueturn**:

| trueturn | attackpattern used | notes |
|---|---|---|
| 0 | 1 | opening spear waltz (`Other_10.gml:510`) |
| 1 | 2 | (`:548`) |
| 2 | 3 | diagonal-transform spears (`:573`) |
| 3 | 4 | (`:599`) |
| 4 | 72 | **Shell Kick** — `scr_spearpattern(x,y,60,52,9999)`→special52→`obj_gerson_shell_kick_controller` (`:2261`) |
| 5 | 70 | **Box Throw** — special50→`obj_box_throw_controller` (`:2255`) |
| 6 | 6 | (`:659`) |
| 7 | 7 | (`:686`) |
| 8 | 12 | (`:820`) |
| 9 | 9 | swing-down + hammer set (`:719`) |
| 10 | 47 | (`:1904`) |
| 11 | 70 | **Box Throw** again (`:2255`) |
| 12 | 13 | (`:858`) |
| 13 | 14 | (`:886`) |
| 14 | 53 | (`:2028`) |
| 15 | 55 | (`:2113`) |
| 16 | 56 | (`:2136`) |
| 17 | 220 | big finale-tier pattern (`:337`) |
| **20** | **19** | **FINAL attack**; sets `reachedendphase=1`, then `trueturn=14` (`:2348-2352`). After this, `have_used_final_attack` ends the fight. |

Patterns 100-240 and 20-73 are the pattern *library* (`Other_10.gml`). The special-attack "types"
map (in `gml_GlobalScript_scr_spearshot.gml`, dispatch on `arg3`):

- `1` → `obj_gerson_green_switch` (GREEN transition, see §4) — **prepended to nearly every pattern** via `scr_spearpattern(0,0,0,1,…)`.
- `2` → `obj_giant_hammer` (spearshot.gml:9)
- `3` → diagonal transform enable (`:13-20`)
- `5` → `obj_gerson_box_hit_controller` (`:168`)
- `6` → `obj_gerson_bell_attack_controller` (`:172`)  ← BELL attack
- `7` → `obj_gerson_hammer_bro_attack_controller` (`:176`)  ← HAMMER-BRO attack
- `8` → `goldcon=1` (gold aura, Step_2 draw) (`:180`)
- `9` → laugh, `state=12` (`:184`)
- `10 / 10.5` → teleport Gerson off box, `type=10` (`:187-203`)
- `11 / 12` → teleport + `obj_gerson_hits_box` (box-shove L/R) (`:204-224`)
- `32` → hammer **SWING DOWN** (`obj_gerson_swing_down` via `obj_gerson_teleport type 2`) (`:159-163`)
- `50` → `obj_box_throw_controller` (`:689`)
- `51` → `obj_hammer_bounce_controller` (`:693`)
- `52` → `obj_gerson_shell_kick_controller` (`:697`)
- `53` → `obj_gerson_box_rumble_controller` (`:701`)
- Plain spear specials (bouncers/growers): 14,19,20,21,25,26,35,40.x,41.x,42.x,43.

`scr_spearpattern(dir,speed,frames,special,wait[,dist])` just enqueues into
`list_attackdirection/speed/frames/special/special2/wait`; `Step_0.gml:1029-1064` walks the queue
(`scr_spearshot`), waiting `list_attackwait[i]` between entries.

---

## 3. Gerson battle sprite states (sizes = `w×h`, origin `ox,oy`, from `sprites.tsv`)

Enemy body is drawn at **2× scale** (`image_xscale=image_yscale=2`).

| state | sprite | frames | w×h | origin | ref |
|---|---|---|---|---|---|
| 0 idle | `spr_gerson_idle` | 14 | 67×39 | 0,0 | sprites.tsv:3156 |
| hair overlay | `spr_gerson_hair` | 5 | 55×33 | 0,18 | :5729 (drawn on top, Draw_0:100) |
| 10/11 rudebuster hitback | `spr_gerson_idle` (index-driven) + `spr_gerson_rude_orb1` | — | — | — | Draw_0.gml:212-329 |
| 12 laugh | `spr_gerson_laugh` | 3 | 73×61 | 8,22 | :835 (offset set 14,22 in code Draw_0:1110) |
| 13 dodge/haircut | `spr_gerson_dodge` | 1 | 49×67 | -18,28 | :5306 (Draw_0:353-403) |
| 14 spin | `spr_gerson_spin` (+`spr_gerson_spin_smear`) | 14 | 83×60 | 43,59 | :2384 / :4677 |
| on-field teleport | `spr_gerson_teleport` | 7 | 84×60 | 43,34 | :1739 |
| end headtilt | `spr_gerson_headtilt` / `_nohair` | 1 | 67×39 / 67×50 | 0,0 / 0,11 | :33 / :5707 |

- Idle bob: `x = xstart + sin(movesiner/5)*10` (Draw_0:4-5); `movesiner += 1/3` while state 0.
- Hair strand physics on defeat: `spr_gerson_hair2` (Step_0:1361-1377).
- `obj_gerson_teleport` (on-field appear): `Create_0.gml` sets `spr_gerson_teleport`, 2× scale,
  `depth=-999999`, plays `motor_swing_down` pitched 1.4. `type` in Step_0 dispatches the actual
  attack it drops: 1=box_hit, 2=swing_down, 3=bell_hit, 4/5=hits_box, 6=`obj_gerson_speen`, 10=make
  enemy visible.
- `obj_gerson_speen` (shell-spin puff): `spr_bounce_shell_idle` + colored `c_yellow` copy, lives 2
  frames (`Draw_0.gml`).

---

## 4. Green-soul toggling in the turn flow

- Nearly every `attackpattern` begins with `scr_spearpattern(0,0,0,1,<wait>)` → `arg3==1` in
  `scr_spearshot` → spawns **`obj_gerson_green_switch`** (spearshot.gml:3-6).
- `obj_gerson_green_switch` = the GREEN transition FX: 2× scale, `image_speed=1/3`, plays `snd_boost`,
  fades Gerson out (`Create_0.gml`). In Step it fires green chevrons
  (`obj_gerson_green_chevron`, `image_blend = merge_color(c_lime, c_black, 0.2*timer)`) as it lowers
  the box into place and brings Gerson back at `image_index>6.5` (`green_switch Step_0.gml:1-51`).
- Battle box `obj_growtangle` is itself green-tinted: `image_blend = merge_color(c_green, c_lime, 0.5)`
  (`obj_growtangle_Create_0.gml:8`).
- Thematic: string12 (paraphrased) — "while you're GREEN you can't flee; only by FACING DANGER
  head-on do the bullets miss." So the green state is the fight's identity; there is no separate
  green-shield input mode — it's a green-styled box fight.

---

## 5. Scenery / background layers (`obj_dw_church_arena_bg_Draw_0.gml`)

Draw order (back → front), all at camera origin `cx,cy`:
1. Gradient fill: `spr_pxwhite` full-screen tinted `gradient_bottom`; `spr_20px_white_gradient`
   band tinted `gradient_top` (bg-surface, :84-85). Colors are lerped each step (`colors_lerp`,
   `gradient_lerp`), green channel oscillates via `sin` (:19-26) — living stained-glass glow.
2. **Window surface** (302×122, drawn to `168,0` additively, mirrored reflection at y+416 α0.5):
   - `spr_dw_church_bell_Large_topcenter` (62×63, org 31,0) swinging, tinted **`c_green`**, α0.75 (:36)
   - prophecy hammer `hammerobj` via `shd_prophecy`/custom shader (:49-62)
   - city `cityobj` α×0.5
   - rain `spr_gersonwindow_water` (60×62) ×3 columns α0.4 (:77-79)
   - `bg_dw_gerson_arena_stained_glass` (107×62) α0.5 (:80)
3. Black side pillars: `ossafe_fill_rectangle` at `cx+257..266` and `cx+372..381`, full height (:93-94).
4. **Main arena**: `bg_dw_gerson_arena_battle` (320×240 → drawn 2× = 640×480) through a **palette
   swap** `pal_swap_set(spr_dw_gerson_arena_palette, colcon)` where `colcon` approaches `con+1`
   (:101-104). The palette sprite `spr_dw_gerson_arena_palette` (9×60) IS the color source — the
   arena recolors by `con` state, so there are no hardcoded BGR ints in the draw; colors come from
   the palette image + named consts (`c_green` bell, `c_white/c_black/c_yellow`).
5. Floor shadow: `spr_dw_gerson_arena_shadow` (156×76, org 78,0) at `cx+halfW-2, cy+200`, tinted
   `gradient_bottom` α0.4, plus an intro flash pulse (:105-111).

Related overworld/arena scenery objects (non-battle): `obj_dw_church_arena` places
`bg_dw_gerson_arena_anvil` (55×46) at 780,200 and `bg_dw_gerson_arena_axe` (27×21) markers
(`obj_dw_church_arena_Create_0.gml:4-44`). `obj_gerson_fountain` is **Gerson's SHOP menu**, NOT arena
scenery. There is no separate statue/fountain draw object in the battle bg — the "statues/glass" are
baked into `bg_dw_gerson_arena_battle` + the stained-glass window layer.

---

## 6. Fight theme & spare (PARAPHRASED — do not quote)

Gerson is a jovial old warrior-shopkeeper who frames the whole duel as a bard's tale, narrating the
"prophecy" chapter by chapter between turns while ringing bells of "justice." He is not really trying
to win — he's testing the party's guts and coaxing Susie to embrace being a hero. The player never
depletes HP; instead each ACT/attack fills a golden progress meter (his wanted "haircut"). Once
progress ≥ 84 he enters his final phase (phase 4 / attackpattern 19), delivers a last flurry, and the
battle resolves warmly: Susie lands the finishing "haircut" and the fight is won as a spare, with
Gerson musing about hope, endings, and passing the pen to the next generation. Ending cutscene branch
lives in `Step_0.gml:896-1396` (`end_cutscene_version`, `endcon` states), granting `global.mag[2]+=4`
and setting victory flags (`:1177-1179`, `:1388-1390`).

---

## 7. ASSET LIST

**Gerson sprites:** spr_gerson_idle (14,67×39), spr_gerson_hair (5,55×33), spr_gerson_hair_strand
(8,8×9), spr_gerson_laugh (3,73×61), spr_gerson_dodge (1,49×67), spr_gerson_spin (14,83×60),
spr_gerson_spin_smear (2,83×60), spr_gerson_spin_outline/fix, spr_gerson_teleport (7,84×60),
spr_gerson_headtilt (67×39), spr_gerson_headtilt_nohair (67×50), spr_gerson_idle_spin (2,90×42),
spr_gerson_rude_orb1, spr_bounce_shell_idle(+_color).

**Arena/scenery:** bg_dw_gerson_arena_battle (320×240), bg_dw_gerson_arena (320×240),
bg_dw_gerson_arena_dark (640×480), bg_dw_gerson_arena_stained_glass (107×62),
spr_dw_gerson_arena_palette (9×60), spr_dw_gerson_arena_shadow (156×76), spr_dw_gerson_arena_unlit,
spr_dw_gerson_arena_stage2/3/4 (640×480), bg_dw_gerson_arena_rgb_floor, bg_dw_gerson_arena_anvil
(55×46), bg_dw_gerson_arena_axe (27×21), spr_dw_church_bell_Large_topcenter (62×63),
spr_dw_church_bell_Large_1/2/3, spr_gersonwindow_water (60×62), spr_pxwhite, spr_20px_white_gradient.
Shader: shd_prophecy.

**Attack / FX objects:** obj_gerson_green_switch, obj_gerson_green_chevron, obj_growtangle (box),
obj_gerson_swing_down(+_new,_mask), obj_gerson_bell_attack_controller, obj_gerson_bell(_hit,_bullet,
_bullet_radial), obj_gerson_hammer_bro_attack_controller, obj_gerson_hammer_bro_hammer,
obj_gerson_hammer_bounce_left, obj_hammer_bounce_controller, obj_gerson_shell_kick_controller,
obj_gerson_shell_pinball, obj_gerson_box_rumble_controller, obj_gerson_box_hit(_controller),
obj_box_throw_controller, obj_box_hit_bullet, obj_gerson_hits_box, obj_gerson_squishes_box,
obj_gerson_teleport(_generic), obj_gerson_speen, obj_gerson_progress_star, obj_giant_hammer,
obj_gerson_growtangle_telegraph(+_hit_fx,_transform), obj_gerson_rudebuster, obj_spearshot,
obj_spearblocker(+_piece), obj_gerson_darkener/darkness_overlay/slowdown, obj_gerson_fakeheart,
obj_green_heart_particle.

**Sounds:** snd_boost, snd_gerlaugh, snd_mercyadd, snd_criticalswing, snd_rudebuster_swing,
motor_swing_down, snd_eye_telegraph, snd_old_man_grunt, snd_chargeshot_charge, snd_heartshot_dr_b,
snd_laz_c.
