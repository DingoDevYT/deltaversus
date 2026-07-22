# HANDOFF — PINK 1:1 GML Port (DELTAVERSUS)

**Read this + `GML_PORTING_GUIDE.md` before touching anything.**

## The project
DELTAVERSUS = Deltarune 1v1/party PvP battler. Vanilla JS + canvas **640×480 native**, no build tools.
- Source: `docs/` (GitHub Pages, live at dingodevyt.github.io/deltaversus). Deploy = `git commit + push` on main.
- Key files: `docs/js/patterns.js` (all attack patterns), `docs/js/battle.js` (engine), `docs/js/characters.js` (live rosters), `docs/attack_tester.html` (playable tester, loads unversioned `js/*.js` — hard refresh picks up changes), `docs/index.html` (cache-bust `?v=N` per script; bump on every deploy), `docs/js/assets.js` (`ASSET_V` bump when sprites change).
- GML source dumps (ALL 5 chapters): `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter N - GML\` (one .gml file per object event).
- Sprite rips: `DeltaVersus/NEW RIP/**` (named exactly like GML `spr_*`). Rip via python scripts in `tools/` (PIL at `C:\Users\lando\AppData\Local\Programs\Python\Python312\python.exe`), save to `docs/assets/bullets/` + register in `docs/assets/manifest.json` (`bullets` section: `{f,w,h}` + `bullet_cost`). Souls go in `docs/assets/ui/soul/` + `manifest.souls`.

## THE PRIME DIRECTIVE (Landon has enforced this repeatedly, harshly)
**PERFECT 1:1 recreation of boss attacks, VISUALLY AND MECHANICALLY, translated DIRECTLY from the GML.**
- NO approximations, NO simplifications, NO invented cadences. If the GML has a data chart, IMPORT IT VERBATIM. If it has a state machine, PORT the state machine.
- READ ENTIRE GML FILES yourself (not greps, not agent summaries) before implementing. The wiki (he pastes it) gives intent; the GML gives exact numbers. Use both.
- All pixel metrics native 640×480. Measured facts: `spr_battlebg_stretch_hitbox` = 75×75 → battle box = 75 × GML `image_xscale` (base scale 2 = **150×150**). Purple soul = `spr_purpleheart` 20×20, 2 frames, scale 1. Red soul 16×16.
- Use the EXACT sprites/sounds the GML names (they exist in NEW RIP / assets SFX folders under the same names).
- DELTARUNE runs at 30fps: `hz30:1` on the pattern makes our sim tick at 30Hz so you use RAW GML numbers. `hz30:false` opts out (menus). GML `round(0.5)` = **0** (banker's) — interval-0 chart entries fire the SAME frame (that's how volleys form).

## Pink status per attack (tester char `CHARS.pinknew` in attack_tester.html; all tester-only, NOT in live characters.js yet)
Pink's real roster (verified: `myattackchoice` only ever 1/3/4/5/6 in obj_pink_enemy):

| Attack | Pattern ids | State |
|---|---|---|
| Cats (type 200) | `pinkn_cats`, `pinkn_cats2` | **1:1 DONE** — real ds_bullet_list charts D0/D1 + exact playback (15f lead, `round(0.5+13*i/1.25)` gaps, lane<3=cat+frac*10 trailing dokis, 6-8=doki rows, spawn box_center±416) |
| Pinata Bombs (203) | `pinkn_bombs/2/g/fin` | **1:1 DONE** — full obj_pink_battlemovement mode-5 + obj_fusebomb/_big port (charts D0-D4, PLUS/walk volleys, fuse 55+ammo*2-rep*2, air arc + flashing landing ring, burn-down frames pbomb0-4, contact=instant detonate, chain-detonate, pink `tintMul` heart bombs, giant ×8 crosses, slide FINALE). Headless-verified counts (D0: 15 bombs/4 hearts exact) |
| Plus-Grid/Rotating Box (202) | `pinkn_plusgrid`, `pinkn_plusgrid2`, `pinkn_rotbox` | **Mostly 1:1** — real charts PINK_PLUS_D0/D2, obj_pinklanebullet geometry (3 lanes/arm perp 52, pairs, dokis 66, spawn 352 out, speed*8, gap floor(0.5+32*i)), real circle/half-circle sprites (`plane`/`planeb`). **TODO**: D1 (P3) procedural chart generator (lines ~2103-2250 of dbulletcontroller, the doki-queue variant) not ported — rotbox currently plays D0 + timed 90° CW knocks; GML ties knocks to obj_huge_anime_face after circle groups, ammo=6 refills |
| 3-D Tunnel (208) | `pinkn_tunnel` | **REWRITTEN this session to true mechanics, NOT BROWSER-VERIFIED** — heart rides one of 8 expanding rings (`tunnel_lane_layer`), UP=hop inward (forward), DOWN=outward, L/R=±90° swings, heart zooms `radius/48`; exact ring growth `r*(1+r/(32000/spd))+0.0375*spd`, interval 188, recycle 224, moveLimit 35*scale, early flood + zoom-in boost + stall rules; box shrinks 281→~207 via fx.boxTarget; exact `_atk` chain wall generator (walls 10° spacing, harmless end caps, variants 6/15/29/moving±2.5-5/dual-180°, arrows=`pzaparrow`). Movement in battle.js purple block pm===7; zaps position themselves in emit from closured pattern state. **VERIFY + TUNE in tester first!** |
| IDOL CONCERT (209, ULT) | `pinkn_concert` | **Choreography ported** (l_patterns orders [4,1,5,2,0] etc + l_timings, audienceheart windup 32f aim-ease then launch speed 5, hearts past top → collectables). Box now 360×187. **TODO**: real seat positions from obj_pink_curtains Step (I estimated 6 seats), audience/hater sprites, Pink singing on stage, hater variant (P2 T4 red homing dummies) |
| DATE minigame | `pinkn_date1`, `pinkn_date2` | **REWRITTEN this session to real dating-sim screen, NOT BROWSER-VERIFIED** — full takeover: black + scrolling `dsimdiamond` tiles, `dsimbg` frame at (106,24)×2, talking portrait `dsimpink0/1`+`dsimtail`, typewriter question (+1 char/60Hz tick) centred (320,208) white 8-dir outline + near-black fill wrap 320 sep 28, purple gradient band (106..526, 210..273), **cylindrical option carousel** at y=291 (strip 200px apart, angle=lerp(0,180,(x+165)/970), screenX=240·cos+312, boxes 60 tall white-border black-fill, text squeezes with projection), LEFT/RIGHT scroll + Z confirm, purple `pkarrow` hint markers, wrong/timeout = party-wide 40 dmg + repeat. Engine: `fx.date` + `drawDateUI(ctx, D)` in battle.js; `hz30:false`; ends via `B._dateEnd` → boxout. **VERIFY VISUALLY + check carousel L/R direction feels like the game** |

Unused/cut content kept as labeled bonus: `pinkn_vrain`/`pinkn_conveyor` (types 204/205, soul modes 4/5).

## Engine features added for Pink (battle.js)
- Purple soul modes in the movement block (`B.soulPurple`, `B._pmode`): 1 (3 lanes ±56 + free X ±63), 2 (4×4 grid, lane 40), 3 (rotating "+" cross, rotation-compensated input, box rotates via fx.purpleSoul.rot), 4/5 (2 vertical lanes ±63, mode 5 conveyor), 7 (tunnel ring-rider, state on B.pLayer/B.pAng/B.pR/B.pHScale). hz30 input edge buffering via `B._pbuf`.
- `b.pickup` = doki-heart TP collectable (gravitates <42px, +TP +1HP team). `b.tint`+`b.tintMul` (GML image_blend multiply). `b.orbit.grow`. `shape:'ring'` (bomb landing telegraph). `fx.boxTarget` (mid-dodge box resize; tunnel shrink). `fx.date`/`drawDateUI`. hz30 opt-out `hz30:false`. Bullet cull bounds −130..790.
- Purple soul renders real `A.soul('pheart0/1')` frames; tunnel scale `B.pHScale`.

## Immediate next steps (in order)
1. **Verify tunnel in tester** (PINK·NEW → "3-D Tunnel"): press UP to start, hop rings, check walls ride rings + collision only on your ring, box shrink, heart zoom. Tune only if it deviates from the GML I ported (re-read `gml_Object_obj_purplecontrols_Step_0.gml` case 7, lines 1211-1810).
2. **Verify DATE visually** (buttons "DATE 1/2"): full takeover screen, carousel projection, typewriter, arrows. Fix L/R direction if inverted vs game footage.
3. Port type-202 **D1 generator** (P3 rotating variant) + tie knocks to groups.
4. Concert: real seat positions + audience sprites from `obj_pink_curtains` Create/Step; P2 T4 hater variant.
5. Per-attack `snd_*` SFX pass (GML names them; our Snd keys in manifest.sfx — map/rip what's missing).
6. When Landon approves: promote pinknew set into live `characters.js` Pink (currently old approximations) + showcase (`attack_preview.html` has its OWN mini-engine — pinkn ids regex'd for hz30 but new engine features NOT mirrored there).

## Verification workflow (IMPORTANT)
- Tester tab rAF **throttles when unfocused** → wall-clock screenshots lie. Use the **headless node harness**: stub `global.A/Snd/Battle/Input`, `eval(patterns.js + ';globalThis.__P=PATTERNS;')`, run tick+emit loops, assert counts. See HANDOFF examples in git log (commits around "Headless-verified").
- Browser check via `mcp preview` on `.claude/launch.json` server name `deltaversus` (port 8399), `attack_tester.html`, select PINK·NEW, use page JS to click buttons; screenshot once, probe `Battle` state via JS instead of timing screenshots.
- Deploy: bump `?v=` in index.html (+ ASSET_V if sprites), commit, push.
