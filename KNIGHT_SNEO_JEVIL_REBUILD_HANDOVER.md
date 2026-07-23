# KNIGHT / SPAMTON NEO / JEVIL — GML REFACTOR HANDOVER

Mission: refactor + complete the **Roaring Knight**, **Spamton NEO**, and **Jevil** boss kits in DeltaVersus so
every attack is a faithful port of the decompiled DELTARUNE GML — exact positions, speeds, timings, cadence,
visuals, and sounds. The current kits for all three were built from *observation* (footage/wiki) and are
missing attacks and wrong on specifics. This is the SAME job we just finished for Gerson (Ch4 Hammer of Justice).

## READ FIRST (methodology — don't re-derive it)
- `DELTAVERSUS_PORTING_PLAYBOOK.md` — engine, tooling, verification, agent strategy, gotchas. Source of truth for HOW.
- `gerson_specs/GML_LEARNINGS.md` — the porting CHECKLIST + hard-won lessons. **Follow the checklist for every attack.**
- `gerson_specs/*.md` + `GERSON_REBUILD_HANDOVER.md` — a fully worked example of this exact process.

The #1 lesson from Gerson: **READ THE COMPLETE OBJECT GML YOURSELF (every event) before porting — port from the
CODE, not the wiki's shape or an agent's summary.** Guessing scales/speeds/sounds/animation is how it goes wrong.

## SOURCE MAP (confirmed on disk 2026-07-23)
GML root: `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter <N> - GML\`
REFDATA: `...\DELTARUNE - REF DATA\DELTARUNE Chapter <N> - REFDATA\` (objects.tsv default sprite_index, sprites.tsv dims/origins, sounds.tsv)
EXPORT: `...\DELTARUNE - EXPORT\DELTARUNE Chapter <N> - EXPORT\sprites\` + sounds. Import via `tools/import_spr.py` with `EXPORT_CH=<N>`.

### JEVIL — Chapter 1
- Enemy/sequencer: `obj_joker` (+ `obj_joker_body`, `obj_joker_teleport`), attack driver `obj_jokerbattleevent` (Step_0 = 508 lines — the attack sequence table).
- Current kit (docs/js/characters.js, base `jevil`): `jevil_spade, jevil_ring, jevil_bombs, jevil_diamond, jevil_scythes, jevil_carousel, jevil_ult`.
- Jevil is a DARKNER (CHARGE mechanic) + secretBoss in DeltaVersus. Bullets: spades/diamonds/hearts/clubs/scythes/carousel horses. Grep `obj_joker*` and the bullet objects it spawns.

### SPAMTON NEO — Chapter 2 (415 objects — the biggest)
- Enemy: `obj_spamton_neo_enemy` (main), plus `obj_spamton_enemy` (phase 1?), sequencer `obj_spamton_attack_mode` (Step_0 = 174 lines). Word bullets `obj_spamton_wordbullet`.
- Current kit (base `spamton`): `sneo_heads, sneo_heart, sneo_mail, sneo_phones, sneo_face, sneo_bigshot`.
- YELLOW SOUL shooter mechanic already exists in the engine (`B.soulYellow`, hold-to-charge/release BIG SHOT). NEO is a
  layered marionette (Parts folder composite). Lots of attacks — expect to ADD several missing ones.

### ROARING KNIGHT — Chapter 3 (234 objects)
- Enemy/sequencer: `obj_knight_enemy` (Step_0 = 981 lines — the attack table). Bullet-hell controllers `obj_knight_bullethell1/2` (+ `_bullet`, `_bullet2`, `_bullet_bounce`). Attack objects: `obj_roaringknight_boxsplitter_attack`, `obj_roaringknight_quickslash_attack`, `obj_roaringknight_fountain_bullet`, `obj_roaringknight_split_bullet`, `obj_knight_weird_circle_bullet`, `obj_knight_diamondswordbullet_ext`, bullets `obj_bullet_knight`, `obj_bullet_knight_slash`, `obj_bullet_knight_stream`, `obj_bullet_knight_tunnelslash`, `obj_bullet_knightcrescent`.
- Current kit (base `knight`): `knight_corridor, knight_stars, knight_circle, knight_slash, knight_board, knight_roar`.
- Knight has `bob` + `afterimage` + `dscale` in its def; RED soul (free move). (9 knight objects also exist in Ch4 — the Ch3 fight is the real one; check which the DeltaVersus Knight represents.)

## THE ENGINE HOOKS ALREADY BUILT (reuse — don't reinvent; docs/js/battle.js + patterns.js)
Many mechanics from Gerson/Spamton/Knight already exist. Grep before adding a global.
- Souls: RED (free), GREEN (`B.soulGreen` shield/block), YELLOW (`B.soulYellow` shooter), PURPLE (`CF.purpleSoul` grid). 
- `fx.*` channels (set by pattern on `a.fx`, consumed in updDodge/render, persist frame-to-frame — CLEAR them when done):
  boxTarget (animate/warp box), boxRot (+ rotated soul-clamp), split, pinch, arena/hideBox, arms, faceBox, boss (giant sprite behind box), bombWarn, shake, bgHue, bgStars, attackDone, **bossSprite** {key,n,rate,ttl} (drive the boss's on-field attack pose).
- Bullet fields: img/tint/tintMul/alpha/scale/sx-sy(stretch)/rot/spin/spinDecay, ax/ay/fric/maxv, homing, orbit{cx,cy,R,w...}, carousel, swing, aim (axis-track), fireAt/fireVX/fireVY, hitW/hitH/hitDX-DY (rect), lerpY, grow/growMax, shrink/shrinkAfter/shrinkStep, burst*/burstChildren, bomb->pendingLasers, deflectable, transform (red<->green), shape:'line'(tell->armed, tellRamp red->white) / shell / crescent / star / note / ring / diamond, **boxClip** (draw masked inside the box, with the tell-lines).
- `emit(b, out, soul, box, fx)` = controller bullet spawns children. `noHit` = cosmetic.
- GOTCHAS THAT BIT US (in GML_LEARNINGS.md): `scr_darksize()` = image_xscale 2 (baseline — halve GML scales); spear/shell
  speed is PER ATTACK (`len = speed*frames`, spawn far offscreen); bullets that spawn far are EXEMPT from the -130..790
  bounds cull only if flagged (see the isSpear/shellRadial exemption ~battle.js 1247 — add your boss's far-spawners); 30 Hz
  input via press-edge on Input.down; bump the tester `?v=` AND `?bust=` the URL after JS edits (the stamp burns); ease,
  don't snap; pull attack DURATIONS so there's no dead time (end via fx.attackDone when content is done).

## PLAN (loop until all three are done — do NOT stop early)
For EACH boss (do Knight, then Spamton NEO, then Jevil — or as the user prioritises):
1. **STEP ZERO**: read the enemy Step_0 attack sequencer to get the ORDERED attack list + which object each spawns + HP/turn
   structure. Write `<boss>_specs/00_source_map.md`. Grep REFDATA for every sprite's default index/dims/origin and sounds.
2. **Fan out background extraction agents** (playbook §5), one per attack/subsystem. Each reads the COMPLETE GML for its
   objects (every event) and writes an EXACT port spec to `<boss>_specs/<name>.md` — VISUALS (every draw call, sprite,
   scale w/ darksize halving, colour BGR->RGB, image_index, depth), MECHANICS (every formula + exact numbers), TIMING/cadence
   (raw GML frames), per-attack SPEEDS, and asset+sound lists. Return ONLY a 1-line summary + path + a ~14-line KEY-NUMBERS block.
3. **Refactor attack-by-attack** from the specs (keep the old ids working; namespace new if needed, then swap). After EACH:
   `node --check` -> headless `Battle.update`/`render` in try/catch via the tester -> canvas-sample the key visual -> ONE
   screenshot if the pane is displayed (else rely on canvas sampling; the screenshot tool needs the browser pane visible).
   Verify blockable/dodgeable, correct sprites, correct durations (no dead tail). Commit per attack/batch.
4. **Add the MISSING attacks** the observation-built kit skipped (the enemy Step_0 list is the ground truth for how many).
5. **Balance** damage to peer parity (~44-64 per hit; ults higher). Wire the kit; bump `?v=` in docs/index.html + `ASSET_V`
   if sprites changed + the tester `?v=` stamps. `git push origin main` -> GitHub Pages. Deploy in verified batches.
6. Keep your OWN context lean: read spec files on demand, prefer Grep/targeted Reads, never paste whole GML/specs.

## HARD RULES
Read whole GML files (no approximations). PARAPHRASE any dialogue — never store the verbatim script. Verify headless
before screenshots; don't spam them. Sounds only play if the key is in `manifest.sfx` (map GML snd_* to a registered key
or import it). Commit small; everything is recoverable from git. Update `<boss>_specs/GML_LEARNINGS.md` as you learn.

## DEV SETUP
Launch config `deltaversus` (port 8399) serving `docs/`. Tester: `attack_tester.html` (drives the real engine; add a
tester char listing new ids, or drive via `startAttack('<base>', move)` headless). `attack_preview.html` = passive review
grid. Py312: `C:\Users\lando\AppData\Local\Programs\Python\Python312\python.exe`. Import: `EXPORT_CH=<N> python tools/import_spr.py spr_x:key[:notrim] ...`.
