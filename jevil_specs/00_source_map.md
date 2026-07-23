# Jevil (obj_joker) — Attack Sequencer Source Map

Source: `DELTARUNE - GML/DELTARUNE Chapter 1 - GML/`. All dialogue paraphrased.
The battle enemy is **obj_joker** (+ child `obj_joker_body`). `obj_jokerbattleevent` is only the
pre-battle overworld cutscene driver — it does NOT run attacks. The real attack sequencer lives in
`obj_joker`: turn selection in `Step_0`, attack spawning in `Other_15` (User Event 5), all spawns go
through `obj_dbulletcontroller` keyed by a `dc.type` number.

---

## 1. Stats / win condition

- `scr_monstersetup.gml:611-617` (type 25): **HP 2800**, AT 8, DF 0, mercymax 999.
- Spared via ACT (Pirouette / Hypnosis) not required-damage — but reducing HP to 0 also ends it.
  `obj_joker_Draw_0.gml:25-29`: `mhpratio <= 0` → `event_user(10)` (Other_20 defeat) + `flag[241]=6`.
- Body dance level escalates with HP: `Draw_0.gml:16-24` / `Step_0.gml:12-43`.

## 2. Turn / attack selection — `obj_joker_Step_0.gml`

`jturn` = turn counter (starts 0, `Create_0.gml:55`). `jattack` = attack id chosen each turn.
Selection ladder (`Step_0.gml:196-238`), evaluated top-down:

| jturn | jattack chosen | meaning |
|---|---|---|
| 0..3 | jattack = jturn (0,1,2,3); jturn++ | Round 1 intro, one new attack per turn |
| 4 | `choose(0,1,2,3)` | Round-1 recap (random of the four) |
| 5..8 | jattack = jturn-1 (4,5,6,7); jturn++ | Round 2 |
| 9 | `choose(4,5,6,7)` | Round-2 recap |
| 10..13 | jattack = jturn-2 (8,9,10,11); jturn++ | Round 3 |
| 14 | `choose(8,9,10,11)` | Round-3 recap |
| 15..18 | jattack = jturn-3 (12,13,14,15); jturn++ | Round 4 — 15 = jattack 15 = **CHAOS finale** |
| 19+ | `choose(0,4,7,8,10,11,12,13,13,13)` | Endless loop, weighted to 13; AT+0.5/turn, DF-3 |

**Escalation is HP-gated** (`Step_0.gml:12-37`): mhpratio ≤0.8→jturn 5, ≤0.6→jturn 10, ≤0.4→jturn 15,
≤0.15→jturn 17 (forces the endgame incl. the CHAOS finale near death). Hypnosis ACTs also fast-forward
jturn (`Step_0.gml:45-88`). So Jevil "combines" attacks by advancing rounds as its HP drops.
Targeting: jattack 2/5/9/13/15 → `scr_targetall()`, else `scr_randomtarget()` (`Step_0.gml:240-243`).

## 3. Attack spawn table — `obj_joker_Other_15.gml` (jattack → dc.type)

All create `obj_dbulletcontroller` at Jevil's x,y and set `.type`; damage = monsterAT (8) × mult.

| jattack | dc.type | Other_15 line | dmg | dur/turntimer | notes |
|---|---|---|---|---|---|
| 0 | 70 | :12 | AT×5 | dflt | graze2, body cond2 |
| 1 | 65 | :24 | AT×5 | dflt | graze3 |
| 2 | 49 | :33 | AT×4 | dflt | targetall, graze3 |
| 3 | 75 | :45 | AT×6 | dflt | graze3 |
| 4 | 62 | :57 | AT×5 | dflt | inv20, graze2 |
| 5 | 50 | :68 | AT×4 | 300 | targetall, graze3 |
| 6 | 73 | :81 | AT×5 | dflt | |
| 7 | 68 | :89 | AT×5 | dflt | graze2 |
| 8 | 61 | :98 | AT×5 | 240 | inv20, graze3 |
| 9 | 48 | :110 | AT×4 | 270 | targetall, graze4 |
| 10 | 72 | :123 | AT×5 | dflt | |
| 11 | 76 | :131 | AT×6 | dflt | graze3 |
| 12 | 71 | :143 | AT×5 | dflt | graze2 |
| 13 | 46 | :155 | AT×4 | 330 | targetall, graze4 |
| 14 | 74 | :168 | AT×4 | dflt | |
| 15 | 77 | :176 | AT×4 | **1500** | **CHAOS CHAOS finale** |
| 99* | 47 | :188 | AT×4 | 300 | *unused fallback (diamond bomb) |
| 999* | 25 | :200 | AT×4 | 300 | *unused fallback (spade ring) |

## 4. dc.type → manager logic → bullet objects — `obj_dbulletcontroller_Step_0.gml`

| dc.type | line | manager spawns | leaf bullet(s) → sprite |
|---|---|---|---|
| 46 | 1029 | `obj_suitbomb`, type=choose(0..3) random suit | suit-specific (see suitbomb below) |
| 47 | 1055 | `obj_suitbomb` type1 (diamond) | aimed diamonds |
| 48 | 1078 | `obj_suitbomb` type0 (spade) | spade ring burst |
| 49 | 1101 | `obj_suitbomb` type2 (heart), slower | `obj_heartbomb_blast` |
| 50 | 1124 | `obj_suitbomb` type3 (club) | club spread |
| 61 | 1224 | 3×3 doubled `obj_carouselbullet` (altmode1/2, sinspeed1.1) | spr_carousel horses |
| 62 | 1265 | 7×3 `obj_carouselbullet` (altmode3, sinspeed1.15) | spr_carousel horses |
| 65 | 1287 | `obj_spadering` maxspade10 grav0.4 | spade bullets (spr_diamondbullet base sprite) |
| 68 | 1325 | `obj_spadering` alt-side maxspade10 grav0.45 | spade bullets |
| 70 | 1341 | `obj_joker_teleport` **type1** (btimer≥20 slow) | clone throws 5-fan `obj_collidebullet` spr_spadebullet |
| 71 | 1355 | `obj_joker_teleport` **type0** (btimer≥9 fast) | clone throws aimed `obj_collidebullet` spr_diamondbullet |
| 72 | 1368 | alternating-corner `obj_clubsbullet_dark` type2 | spr_clubsbullet_dark |
| 73 | 1401 | `obj_dbullet_vert` type1 (btimer≥4 dense) | spr_diamondbullet_vert |
| 74 | 1428 | `obj_dbullet_vert` (btimer≥9) graze12 | spr_diamondbullet_vert |
| 75/76 | 1449 | single `obj_centerscythe` (snd_spearappear) | spr_joker_scythebody |
| 77 | 1466 | **finale**: cascading `obj_laserscythe` columns → `obj_joker_teleport` type66 → giant `obj_laserscythe` slam + white-out | spr_joker_scythebody |
| 25 | 385/393 | `obj_regularbullet` spr_spadebullet, bmax4 (unused) | spade |

`obj_suitbomb_Step_0.gml:3-13,44-102`: bomb type 0=spade(ring), 1=diamond(aimed), 2=heart
(`obj_heartbomb_blast`), 3=club(spread). Bomb sprites spr_bomb_spade/diamond/heart/club.
`obj_joker_teleport` = the teleporting Jevil clones (spr_joker_teleport / _r); type66 is the finale cut-in.

## 5. CHAOS CHAOS ULT (dc.type 77, `_Step_0.gml:1466-1675`)

turntimer 1500. Sequence: fade arena to black (darkfader spr_tallpx) → destroy `obj_battlesolid` box →
rain `obj_laserscythe` columns across 5 lanes (rank speeds up 16→7) for ~30 → spawn `obj_joker_teleport`
type66 cut-in (`snd_joker_neochaos`) → scripted symmetric laserscythe volleys (jokertimer 40-98) → one
16× giant `obj_laserscythe` slams center with `snd_rumble` + white-out → arena restores, turntimer→11.
Intro line uses `snd_joker_byebye` (:1475). This is the finale reached at jturn 18 / low HP.

## 6. Key sprites (REFDATA sprites.tsv) — frames W×H origin(x,y)

Body: `spr_joker_main` 2f 42×41 (21,20) · `spr_joker_dance` 8f 46×48 (23,24) · `spr_joker_tired`
1f 42×41 (21,20) · `spr_joker_teleport`/`_r` 2f 42×41 (21,20).
Attacks: `spr_joker_scythebody` 1f 48×45 (22,21) [mask 46×43] · `spr_jokerscythe_big`/`jokerscythebig_mask`
72×67 (32,33) · `spr_carousel` 3f 36×29 (18,20) · `spr_suitsbomb` 24×24 (0,0) · `spr_spadebullet`
36×34 (18,17) · `spr_diamondbullet` 33×32 (16,15) · `spr_diamondbullet_vert` 33×33 (16,16) ·
`spr_clubsbullet_dark` 34×34 (17,17) · `spr_heart` 16×16 · `spr_tallpx` 5×640 (white-out bar).

## 7. Manifest coverage — `DeltaVersus/docs/assets/manifest.json`

Already present: `jevil`, `jevilcast`, `carousel`/`carousel0-2`, `scythe`, `scythebig`, `spade`,
`diamond`, `bspade`/`bdiamond`/`bclub`, `suitspade`/`suitdiamond`/`suitdiamondv`/`suitclub`/`suitheart`/
`suitclubball`, `fusebomb*`/`boardbomb`/`pbomb*`/`jbombclub*`/`jbombheart*`/`bombexpl*`; sounds
`jokerchaos`, `jokerha`, `jokerlaugh`, `the_world_revolving_jevil`.
Likely still to import/verify: idle/dance/tired body frames (`spr_joker_main`/`_dance`/`_tired` — only
generic `jevil` present), teleport-clone frames (`spr_joker_teleport`/`_r`), the scythe body/mask
(`spr_joker_scythebody`), vertical-diamond vs `suitdiamondv`, `spr_clubsbullet_dark` mapping, and
`snd_joker_neochaos` / `snd_joker_byebye` finale voices.
