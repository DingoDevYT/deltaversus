# ROARING KNIGHT — SOURCE MAP (Chapter 3)

GML: `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 3 - GML\`
REFDATA: `...DELTARUNE Chapter 3 - REFDATA\` (sprites.tsv / sounds.tsv / objects.tsv)
EXPORT: `...DELTARUNE Chapter 3 - EXPORT\sprites\`

## SEQUENCER
`obj_knight_enemy_Step_0.gml` — dispatches by `myattackchoice` at `rtimer==12` while phase=="bullets".
Each choice spawns `obj_dbulletcontroller` with a `type` (a manager object per type).
`obj_knight_enemy_Other_10.gml` (event_user0) = the turn chooser: sets `myattackchoice` + `difficulty` by `phase`/`phaseturn`.

### Turn order (what a player actually faces)
- **Phase 1** (silver stars): t1 Stars(d0) → t2 TrackingSwords(d0) → t3 Flurry(d0) → t4 SwordTunnelNew(d0) → t5 RotatingSlash(d0)→phase2
- **Phase 2** (golden): t1 Stars(d1) → t2 Flurry(d1) → t3 SwordTunnelNew(d3) → t4 SwordVortex(d0)+Tracking → t5 RotatingSlash(d1)→phase3
- **Phase 3** (tempest): t1 Stars(d2) → t2 Flurry(d3) → t3 TrackingSwords(d3) → t4 SwordTunnelNew(d4) → t5 RotatingSlash(d2)→phase4-approach
- **Phase 4** (≤80% HP, THE ROARING): rotslash → chargeup(-1) → **Roaring(107)** ULT, then phase=3 loop.
(Phase1 turns 6-9 = choices 12/16/17/7 are NEVER reached in normal play — phase advances at t5. They are leftover/unused.)

### myattackchoice → dc.type → manager object → my DeltaVersus id
| choice | type | GML name | manager object (Ch3 GML) | DV kit id |
|--------|------|----------|--------------------------|-----------|
| 1  | 98  | Stars           | obj_knight_pointing_cone + obj_knight_pointing_star (+obj_heart_follower) | **knight_stars** |
| 11/14/17 | 151 | tracking swords | obj_tracking_swords_manager | **knight_tracking** |
| 2  | 99  | Flurry          | obj_roaringknight_boxsplitter_attack (turn_type "full") | **knight_flurry** |
| 13 | 153 | sword tunnel new | obj_sword_tunnel_manager | **knight_tunnel** |
| 5  | 104 | rotatingslash   | obj_knight_rotating_slash | **knight_rotslash** |
| 15 | 154 | sword vortex    | obj_sword_vortex_manager | **knight_vortex** |
| 9  | 107 | roaring (ULT)   | obj_knight_roaring2 (+ obj_knight_bullethell1/2) | **knight_roar** |
| 12 | 152 | diagonal bullets | obj_diagonal_bullet_manager | (bonus, unused-in-rotation) |
| 0  | 109 | Swordslash      | obj_bullet_knight_crescentGenerator + obj_knight_warp | (unused) |
| 3  | 102 | swordtunnel(old) | obj_knight_tunnel_slasher_2_revised | (unused) |
| 4  | 103 | xattacks        | obj_knight_stream | (unused) |
| 6  | 106 | underboxattack  | obj_knight_weird_bottom_manager | (unused) |
| 7  | 105 | combinationattack | obj_knight_combinations | (unused) |
| 10 | 108 | swords falling  | obj_knight_swordfall | (unused) |
| 20 | 101 | knightlines     | obj_knight_tunnel_slasher | (unused) |

`difficulty` ramps by phase (0→4). Tracking/vortex pass `dc.damage=206`; sword-tunnel-new `dc.damage=62`.

## TARGET DV KIT (6 spells + ult) — the canonical rotation
1. **knight_stars** — Stars (98). Every-phase opener.
2. **knight_tracking** — Tracking swords (151). Homing swords manager.
3. **knight_flurry** — Flurry / box splitter (99). obj_roaringknight_boxsplitter_attack.
4. **knight_tunnel** — Sword tunnel new (153). obj_sword_tunnel_manager.
5. **knight_rotslash** — Rotating slash (104). obj_knight_rotating_slash. (phase-ender)
6. **knight_vortex** — Sword vortex (154). obj_sword_vortex_manager.
7. **knight_roar** (ULT) — Roaring (107). obj_knight_roaring2 + bullethell.

## KEY SPRITES (REFDATA sprites.tsv: name frames w h originX originY)
- spr_roaringknight_idle 1 117 115 7 23 ; _attack_ol 6 117 115 67 23 ; _hurt 3 100 93 0 0
- spr_roaringknight_front 1 70 80 35 30 ; _front_roar 2 70 80 35 30 ; _front_filled 1 70 80 35 30
- spr_roaringknight_flurry 3 113 78 0 0
- spr_knight_diamondswordbullet 2 33 32 16 15 ; spr_knight_diamondbullet_l 3 99 32 49 15
- spr_knight_starchild 1 33 32 16 16 ; spr_knight_triangle 1 16 16 0 8 ; spr_knight_triangle_bullet 2 16 16 7 8
- spr_knight_slash_mark 1 160 150 80 75 ; spr_roaringknight_slash_tunnel 1 99 21 49 10
- spr_roaringknight_slash_white_horizontal 1 262 19 129 11 ; spr_roaringknight_slash_red_alt 14 80 120 0 0
- spr_knight_bullet_star_easy 3 64 64 32 32 ; _hard_b 3 64 64 32 32 ; spr_knight_weird_shape 4 55 20 27 10
- spr_roaringknight_tooth 2 36 36 18 18 ; spr_roaringknight_sword_appear 3 83 95 -10 17

## ALREADY IN DV MANIFEST (docs/assets/manifest.json)
knight, knightcross, knightflourish0..6, knightfront, knightknife, knightroar0/1, knightslash, knightslashf0..5,
knightstar, knightsword, knightswordol, knighttooth, knighttri, rkflame*/rkflamebig* (split flames).
Sounds: knightlaugh, knightsword, black_knife_the_roaring_knight (music).

## SCALE/CONVENTION REMINDERS
scr_darksize = image_xscale 2 baseline (HALVE GML scales; drawSpr already ×1.6, PS(g)=g/1.6).
GM angles y-up: vx=spd*cos, vy=-spd*sin. Colors BGR. Far-spawners EXEMPT from bounds cull.
