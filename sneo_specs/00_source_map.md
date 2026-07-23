# Spamton NEO — Source Map (attack sequencer)

Boss object: `obj_spamton_neo_enemy`. GML dir: `DELTARUNE - GML\DELTARUNE Chapter 2 - GML\`.
Encounter `case 61` → `obj_spamton_neo_enemy`, monstertype **50**
(`gml_GlobalScript_scr_encountersetup.gml:615`).

All `file:line` refs below are to files in `DELTARUNE - GML\DELTARUNE Chapter 2 - GML\`.
Dialogue is PARAPHRASED throughout — no verbatim script text copied.

---

## 1. Stats / HP (`gml_GlobalScript_scr_monstersetup.gml:1419`)

| Stat | Value |
|---|---|
| Name | "Spamton NEO" |
| MaxHP / HP | **4809** |
| AT | 13 (ramps via "funnycheat" hellmode, Other_14, up to 15–26) |
| DF | **0** (normal) / **-27** on weird/Snowgrave route (`:1436`) |
| mercymax | 100 |
| SP (soul speed) | `global.sp = 5`, set when `bigshot==1` (Step_0:1) |

ACT menu (normal): Check / **Snap** / **SnapAll** (`:1449`). Susie: Snap / SuperCharge.
Ralsei: Snap / Pacify(fluff). Weird route swaps to X-Slash / FriedPipis (`:1438`).

---

## 2. Turn/phase controller — **`Other_10` = User Event 0** (the sequencer)

Called from `Step_0.gml:68` (`event_user(0)`) each `enemytalk` turn.
It sets **`rr`** (attack id) and **`difficulty`** from `phaseturn`, then Step_0 dispatches on `rr`.

### Phase transitions (`Other_10.gml:1-11`)
| → Phase | Trigger |
|---|---|
| 1→2 | `mercy>25` OR `hp < 75%` |
| 2→3 | `mercy>50` OR `hp < 50%` |
| 3→4 | `mercy>70` OR `hp < 30%`  (resets `phaseturn=0`) |
| **Finale override** | `hp < 10%` OR `mercy>90` (& not yet used) → `rr=9`, `phaseturn=3` (`Other_10.gml:139`) |
| Weird-route override | `weirdpathendcon>0` → force `rr=5` (`Other_10.gml:147`) |

`phaseturn` increments every turn and is **not** reset across phases 1–3 — the
phase-1/2/3 script (`:16-96`) just runs 1→12 then loops back to **7**.
Phase 4 (`:98-137`) has its own 1→6 loop that loops back to **3**.

### Ordered sequence — phases 1–3 (`Other_10.gml:16-96`)
| phaseturn | rr | difficulty | attack |
|---|---|---|---|
| 1 | 0 | 1 | FlyingHeads |
| 2 | 6 | 0 | RECREWColumns |
| 3 | 2 | 0 | HeartAttackNeo |
| 4 | 8 | 0 | Phonecall |
| 5 | 8.5 | 0 (hell→2) | Phonehands |
| 6 | 7 | 0 | FaceAttack |
| 7 | 2 | 2 | HeartAttackNeo |
| 8 | 0 | 3 | FlyingHeads |
| 9 | 7 | 0 | FaceAttack |
| 10 | 8.5 | 2 (if unhit-in-phonehands OR hell→1) | Phonehands |
| 11 | 8 | 1 | Phonecall |
| 12 | 6 | 1 | RECREWColumns → **loops to phaseturn 7** |

### Ordered sequence — phase 4 (`Other_10.gml:98-137`)
| phaseturn | rr | difficulty | attack |
|---|---|---|---|
| 1 | 2 | 1 | HeartAttackNeo |
| 2 | 8 | 3 | Phonecall |
| 3 | 9 | 0 | **NeoFinale** (`haveusedfinalattack=1`) |
| 4 | 2 | 1 | HeartAttackNeo |
| 5 | 7 | 0 | FaceAttack |
| 6 | 9 | 0 | NeoFinale → **loops to phaseturn 3** |

---

## 3. Dispatch — `Step_0.gml:790-944` (fires at `rtimer==15` in "bullets" phase)

Each turn: `dc = scr_bulletspawner(x, y, obj_sneo_bulletcontroller); dc.type = <t>`,
then `scr_heartcolor("yellow")`, `obj_heart.wspeed = global.sp`, `scr_turntimer(N)`.

| rr | attackname | dispatch (Step_0 line) | turntimer |
|---|---|---|---|
| 0 | FlyingHeads | `obj_sneo_bulletcontroller` **type 0** (:799) | 260 (ctrl sets 240; d2=360; d3=300) |
| 1 | FootballPipis | type 1 (:805) | 300 |
| 2 | HeartAttackNeo | **type 1.5**, `special=hellmode` (:811) | 750+`hellmode*450`; d1=850+; d6=150 |
| 3 | FootballPipis | type 1 (:818) | 260 |
| 4 | Phonehands | type 8.5 (:824) | 260 |
| 5 | PipisExplosion | **`obj_dbulletcontroller` type 51**, `damage=3`, `btimer=35-random(30)` (:830) | 90 |
| 6 | RECREWColumns | type 6 (:838) | 330 |
| 7 | SneoFaceAttack | **type 12**, `special=hellmode`, `faceattackcount++` (:844) | 300 |
| 8 | Phonecall | `instance_create obj_sneo_phonecall`, `isattack=1` (:852) | 260 |
| 8.5 | Phonehands | type 8.5 (:871) | 260 |
| 9 | NeoFinale | **type 9**, `target=3` (:877) | 260 (ctrl sets 1200) |
| 10 | diamonds | **`obj_dbulletcontroller` type 1**, `target=3` (:884) | 260 |

Bullet `damage` is `-1` at spawn (`obj_sneo_bulletcontroller_Create_0.gml:5`) and computed
per-bullet from `monsterat` (13) inside each sub-object; only rr=5 (`damage=3`) is explicit.

---

## 4. attack → manager object → bullet objects
(manager routing in `gml_Object_obj_sneo_bulletcontroller_Step_0.gml`)

| Attack (type) | Manager object(s) | Bullet / entity objects |
|---|---|---|
| FlyingHeads (0) | `obj_sneo_guymaker` (Step:34) | **`obj_sneo_lilguy`** (flying heads); d2 adds `obj_sneo_biglaser` arm lasers |
| FootballPipis (1) | `obj_pipis_controller` (Step:126) | `obj_pipis_egg_bullet` (spr_pipis_egg) |
| HeartAttackNeo (1.5) | partmode 34 + `makeheart=1` (Step:150) | heart-bomb bullets via `obj_basicbullet_sneo` (spr_sneo_head_heartattack) |
| crushers (2)* | (Step:175) | `obj_sneo_crusher` / `obj_sneo_crusher_nohead` / `obj_crusher_leeway` |
| pendulum (3)* | `obj_sneo_pendulum_controller` (Step:536) | — |
| cshot (4)* | (Step:548) | `obj_sneo_cshot` |
| somn (5)* | `obj_sneo_bulletcontroller_somn` (Step:563) | — |
| RECREWColumns (6) | `obj_sneo_wall_controller` / `obj_sneo_wall_controller_new` (Step:582) | pillar/car bullets (spr_sneo_pillar_*, spr_sneo_wall_car, spr_sneo_crew_bullet) |
| elevator (7)* | `obj_sneo_elevator_test` (Step:618) | (spr_sneo_box_elevator, spr_sneo_elevator_button*) |
| macaroni-hands (8)* | partmode 10/11 (Step:776) | — |
| **Phonehands (8.5)** | `obj_sneo_phonehand_master` (Step:801) | phone-hand bullets (spr_sneo_phone, spr_sneo_phonebullet) |
| **NeoFinale (9)** | `obj_finale_growtangle` + `obj_sneo_warped_box` (Step:812/822) | `obj_sneo_dollar` (spr_sneo dollar), `obj_basicbullet_sneo_finale` |
| headwave (10)* | (Step:928) | `obj_sneo_headwave` |
| split (11)* | `obj_shrinktangle` + `obj_sneo_splitbouncer` (Step:950) | — |
| **SneoFaceAttack (12)** | `obj_sneo_faceattack` (Step:984) | eyes/nose/mouth weakpoints (spr_sneo eye/nose/mouth) |
| Phonecall (rr8) | `obj_sneo_phonecall` (direct, Step_0:852) | phone-ring bullets |
| PipisExplosion (rr5) | `obj_dbulletcontroller` type 51 | pipis explosion |
| diamonds (rr10) | `obj_dbulletcontroller` type 1 | diamond bullets |

\* = type exists in the manager but is NOT reached by the normal rr rotation (dev/variant/legacy).

> NOTE: the task's `obj_spamton_attack_mode` (attacks 0=jumper /1=wordbullet /2=inhale)
> is the **phase‑1 Spamton (`obj_spamton_enemy`)** fight, a *different* boss. For **NEO**
> the "flying heads" are `obj_sneo_lilguy` spawned by `obj_sneo_guymaker`.

---

## 5. BIG SHOT / yellow-soul mechanic

- `bigshot = 1` always (Create_0:35); soul is **yellow** every turn
  (`Step_0:896 scr_heartcolor("yellow")`), speed `global.sp=5`.
- Player holds the FIRE input to **charge**, releases to fire — status prompt
  "Hold and release to fire a BIG SHOT" (`Step_0:968`).
- Charge/fire lives in the SOUL: `obj_heart_Step_0.gml:298-335` → spawns
  **`obj_yheart_shot`** (`spr_yheart_bigshot`); on fire sets
  `obj_spamton_neo_enemy.bigshotused = 1` (`:325`). This shot is what damages NEO's body/wires.
- Susie ACT **SuperCharge** sets `bigshotcount = 20` → 20 faster/trailing shots
  (`Step_0:1606`; consumed in `obj_heart_Step_0.gml:327-335`, ends via `obj_supercharge_end`).
- `obj_sneo_bigshot` is a separate entity: `damage=50` default, else `floor(monsterat*5/3)`
  (`obj_sneo_bigshot_Create_0.gml:9,25`).

## 6. "NEO" ultimate / defeat cutscenes  (`Step_0.gml:1792-2347`, `Alarm_6`)

- **NeoFinale** (rr9, type 9): the phase-4 recurring ultimate — `obj_finale_growtangle`
  + warped box + dollar bullets, `global.turntimer=1200`, targets all party (`target=3`),
  and on final low-HP hit runs `scr_damage_sneo_final_attack` per party member (`Other_12`).
- **Defeat, normal route** (`sneo_defeat_cutscene_version==0`, `Step_0:1850`): after HP depleted,
  Spamton refuses to die and transforms toward "Spamton EX" (paraphrased boast about a
  Second Form / filling his body with electricity), ramps bg speed, then explodes/whiteout,
  party HP floored to ≥1 (`:2074-2093`) → hands off to `obj_ch2_sceneex2`.
- **Defeat, pacifist (mercy>99)** (`version==1`, `Step_0:2098`): wires cut, "friendship"
  ending, `spamton_happy.ogg`, then vine-cut fade to `obj_ch2_sceneex2.con=13`.
- **Weird/Snowgrave route** (`version==2`, side-B phase>2): HP clamped to ≥1 (`Step_0:23`),
  Noelle "IceShock" sequence (`global.myfight==3`, `Step_0:1093-1295`) deals 3×~684 dmg and
  force-wins via `scr_wincombat()`.
- Music: enters NEO theme `spamton_neo_meeting.ogg` at pitch 1.8 (`Step_0:552`).

---

## 7. Marionette body sprites (from `REFDATA/sprites.tsv`)  — cols: sprite, frames, w, h, xoff, yoff

Assembled in Create_0:127-134 as `partsprite[0..7]`:
`[0]wingl [1]arml [2]legl [3]legr [4]body [5]head [6]armr [7]wingr`. All parts share a **82×89** canvas.

| part | sprite | frames | w×h | origin (x,y) |
|---|---|---|---|---|
| wing L | `spr_sneo_wingl` | 1 | 82×89 | 20,40 |
| arm L | `spr_sneo_arml` | 5 | 82×89 | 20,37 |
| leg L | `spr_sneo_legl` | 1 | 82×89 | 23,52 |
| leg R | `spr_sneo_legr` | 1 | 82×89 | 30,51 |
| body | `spr_sneo_body` | 1 | 82×89 | 18,40 |
| head | `spr_sneo_head` (+_open,_sad,_joke,_blue,_heartattack) | 1 | 82×89 | 30,29 |
| arm R | `spr_sneo_armr` | 1 | 82×89 | 35,35 |
| wing R | `spr_sneo_wingr` | 1 | 82×89 | 30,30 |
| (idle placeholder) | `spr_sneo_example` | 1 | 82×89 | 0,0 |

Key attack sprites: `spr_sneo_bullet0/1`, `spr_pipis_egg` (16×12), `spr_sneo_phone` (64×64 ×4),
`spr_sneo_phonebullet` (20×20 ×4), `spr_sneo_crew_bullet`/`spr_sneo_wall_car`/`spr_sneo_pillar_*`
(RECREW), `spr_sneo_c_weakpoint*` (crusher), `spr_sneo_laser` (400×150), `spr_sneo_dollar`,
`spr_sneo_bigshot_l/s`, `spr_sneo_head_heartattack`, `spr_sneo_bigcircle`, `spr_sneo_neobuster(_bouncy)`,
`spr_sneo_final_forme_*`, `spr_sneo_lastattack_head*`, `spr_sneo_smoke`.

---

## 8. Manifest coverage (`DeltaVersus/docs/assets/manifest.json`)

**Already present** (DeltaVersus renamed assets, ~28 sneo entries):
`sneohead, sneoball, sneoarrow, sneobig, sneobomb, sneobox, sneocar, sneocrew, sneodollar,
sneoeye, sneomouth(k), sneonose(tri), sneofacebg, sneofinal, sneofinalsuck, sneophone, sneowire,
sneowisp, sneomail, sneolaser, sneoheart, sneosound`; sfx `sneocharge/fire/gun/over`;
music `big_shot_spamton_neo`, `now_s_your_chance_to_be_a_big_spamton`.

**Missing — need importing** (no manifest hits):
- **Marionette body parts** — only `sneohead` exists; **`wingl, wingr, arml, armr, legl, legr, body`
  are all absent** (import from `spr_sneo_wingl/wingr/arml/armr/legl/legr/body`, 82×89 each).
- Pipis: `spr_pipis_egg`, `spr_pipis_wall`, `spr_pipis_egg_piece`.
- Crusher weakpoints: `spr_sneo_c_barrier`, `spr_sneo_c_weakpoint*`.
- Pillars: `spr_sneo_pillar_head_top/bottom`, `spr_sneo_pillar_multi_*`, `spr_sneo_pillar_thick/piston`.
- `spr_sneo_bigcircle`, `spr_sneo_neobuster(_bouncy)`, `spr_sneo_smoke`, `spr_sneo_final_forme_*`,
  `spr_sneo_lastattack_head*`, head variants (`_open/_sad/_joke/_blue/_heartattack/_preview`).
