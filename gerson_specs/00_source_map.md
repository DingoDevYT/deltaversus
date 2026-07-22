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
They are functional approximations already derived from this GML. The rebuild goal = raise each to exact
GML fidelity (spawn positions, speeds, cadence, visuals) and density, verifying each, deploying in batches.
