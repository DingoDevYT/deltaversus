# GERSON — SOURCE MAP (STEP ZERO)

**RESOLVED: Gerson is a REAL DELTARUNE Chapter 4 boss.** The "Hammer of Justice / Sound of Justice"
green-soul fight. NOT a custom design — this is a true 1:1 port target.

- GML root: `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 4 - GML\`
- REFDATA: `C:\Users\lando\Desktop\DELTARUNE - REF DATA\DELTARUNE Chapter 4 - REFDATA\` (sprites.tsv/objects.tsv/sounds.tsv)
- EXPORT: `C:\Users\lando\Desktop\DELTARUNE - EXPORT\DELTARUNE Chapter 4 - EXPORT\` (sprite PNGs, sounds)

## Enemy / battle object
- `obj_hammer_of_justice_enemy` — the enemy (ACT/turn/attack sequencing lives here or nearby).
- Green soul: `scr_guardpeek.gml`, `obj_gerson_green_switch` (toggles green mode), `obj_gerson_green_chevron` (the green spears you BLOCK).

## Attack objects (map to current DeltaVersus kit)
| Kit id | Real GML source object(s) | Soul |
|---|---|---|
| gerson_spears / barrage / spearsweep / shellvolley | `obj_gerson_green_chevron` (+ green_switch, shell variant) | GREEN block |
| gerson_shellkick | `obj_gerson_shell_kick_controller` + `obj_gerson_shell_pinball` | RED |
| gerson_swingdown | `obj_gerson_swing_down_new` (+ `_mask`), red hammers | RED |
| gerson_boxthrow | `obj_gerson_hammer_bro_attack_controller` + `obj_gerson_hammer_bro_hammer` (CONFIRMED read: 3-hammer arced throws, fakehspeed/fakevspeed/fakegravity 0.6, pattern 0/1/2) | RED |
| gerson_squish | `obj_gerson_squishes_box` (+ box_hit / box_rumble_controller) | RED |
| gerson_rudebuster | `obj_gerson_rudebuster` (+ rudebuster_anim, oflash_gerson_buster) | RED |
| gerson_finale (ult) | composite / `obj_giant_hammer` finisher | RED |
| (BONUS, not yet in kit) | `obj_gerson_bell_attack_controller` + bell_bullet(_radial), `obj_gerson_cane_bullet`, `obj_gerson_growtangle` (vines) | mixed |

## Scenery
- `bg_dw_gerson_arena_battle`, `bg_dw_gerson_arena_stained_glass`, `bg_dw_gerson_ch4`, statue L/R, fountain.

## Key mechanic facts (confirmed)
- 30 fps sim (hz30:1 in engine). GML numbers used raw.
- Hammers use fake physics: `fakehspeed`, `fakevspeed`, `fakegravity=0.6`, gravity_direction=270 (up-is-negative).
- Bullet damage in GML is `damage=1` (a multiplier vs the enemy's ATK) → balance to ~50 in the port.
- Green mode: block chevrons by facing their side with Susie's axe (engine `B.soulGreen` already implements this exactly; block-efficacy verified: perfect aim = 0 dmg, miss = full).

## STATUS OF EXISTING KIT (verified 2026-07-23)
All 10 attacks RUN without update/render errors; green block mechanic works (0 dmg perfect / 72+ miss).
They were already functional GML-derived ports — the handover's "not working" premise did NOT hold up
(no crashes, block mechanic correct). So the work became a FIDELITY + BALANCE pass, not a teardown.

### DONE (verified headless + canvas-sampled, deployed in 2 batches, live on GitHub Pages)
- **gerson_squish** — REBUILT to the real GML (`obj_gerson_box_hit`, code 13): box snaps WIDE + shoves L/R;
  rows of white DIAMONDS fire HORIZONTALLY from alternating edges with friction-0.14 decel. (Was wrongly
  raining vertical columns — the spec explicitly says no gravity-rain exists.) Added a `diamond` bullet shape.
- **gerson_rudebuster** — UPGRADED to real accel-homing orb (speed→9, homing) that BURSTS into 8 radial
  bolts (GML 8 shots @45+90i) if it reaches you undeflected; still Z-deflectable. Verified burst fires.
- **gerson_boxthrow** — tuned to spec physics (fakevspeed clamp 11, phase-1 sin amplitude 80, x1.5 hammers).
- **gerson_finale** — REBUILT as an escalating all-blockable green climax (rotating spear volleys →
  multi-block shells → giant "holy hammer" overhead). FIXED a real bug: old version spawned `line` cuts
  through centre while in green (can't-move) mode = unavoidable damage. Now everything is blockable.
- **Green spears tinted c_lime** (`gSpear`): the chevron sprite was grey; now renders green (RGB 0,192,0),
  matching the GML `c_lime` blend. Affects spears/barrage/spearsweep/shellvolley/finale.
- **Damage balanced** to peer parity (green ~38-42, red ~46-52, ult 58) — was badly under-tuned (18-22).

### ALREADY ACCURATE (left as-is, confirmed against specs)
- gerson_shellkick — starburst arcs match GML EXACTLY ([4,0,12.0,0.535],[10,24,13.25,0.5],[8,0,14.5,0.465],[6,-24,15.75,0.43]).
- gerson_spears/barrage/spearsweep/shellvolley — volley cadence + 50° block arc + 4-frame parry match GML.

### KNOWN STYLIZATION / FUTURE WORK
- gerson_swingdown — uses abstract red telegraph-lines (Knight red-slash mechanic) instead of the
  `spr_gerson_swing_down_new` blade sprite lunge. Mechanic (telegraph→cut) is faithful; visual is stylized.
- NOT YET IN KIT (real attacks, sprites already imported): BELL (musical-note radial, `gbell`+notes),
  CANE (belongs to obj_guei_enemy, not the hammer boss), GROWTANGLE vines. Additive scope — see specs.
