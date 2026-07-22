# PINK V3 — Full rebuild handover & porting guide

**Goal:** Rebuild EVERY attack in DELTARUNE Ch5's Pink (Mad Mew Mew) boss fight into the DeltaVersus
engine at **100% accuracy, mechanically AND visually**, from the decompiled source — not approximations.
Namespace the rebuild as **`pinkn3_*` / "PINK V3"** so it can live beside the current attacks and be swapped
in once verified. Be meticulous: read the FULL GML for each object, replicate every draw call and formula,
and include the fight's **background/scenery assets** (previously missed).

This document + the per-attack spec files (see §5) are the source of truth. Read them before touching code.

---

## 0. WHY V2 FELL SHORT (fix these first — they're the graded feedback)

1. **The maze (final attack) is laggy.** Root cause: `drawMaze` re-sets `canvas.width/height` every frame
   (reallocates+clears a 640×480 offscreen) and blits it **9×** for the bloom. Fix: allocate the offscreen
   ONCE, use `clearRect`, cut the bloom to 2–3 cheap passes (or a single `shadowBlur`/pre-rendered glow).
2. **Maze mechanics were "a bit messed up."** Re-port `obj_purplecontrols` mode 8 + `obj_pinknode` +
   `obj_pinknodeact` LINE BY LINE. Things likely wrong/missing in V2: exact `heart_travel` movement feel,
   the mode-1 goal timer counting **twice per frame**, checkpoint demotion, `doki_backup_node` relocation,
   the difficulty-3 hunter launched periodically from `node_start`, node **drift** (speed 0.25 steering),
   pattern-2 sweep geometry, and the Pink body/ghost being placed at ARBITRARY coords instead of the real
   `obj_pink_enemy`/`obj_pink_ghost_marker` positions.
3. **The fight has BACKGROUND / SCENERY assets that were never ported.** The Pink fight is a whole stage
   scene (dancers `obj_pink_dummy`, `obj_pinktree`/`_tall`, `obj_pink_spotlight`, crowd, curtains, the
   room background/tiles, `obj_pinkdust`, etc.). V2 rendered attacks on the default battle bg. **An early
   agent task must map every background/scenery object drawn during the fight and each phase.**
4. **Date visuals still wrong.** V2 uses one idle face for all lines. The real date swaps `pinkportrait`
   (a sprite id) **per dialogue line** (shocked/sweat/angry/etc.), layers the **possessed Mew Mew** form
   (`spr_possessed_mewmew_*`) for later dates, and has its own animated portraits, background (`spr_date_reel`,
   `spr_date_sun`, `spr_datingsim_ui_bg`), diamonds, and a real 3-lives + timer HUD. Port the date Draw/Step
   faithfully. (Do NOT reproduce the dialogue verbatim — it's copyrighted; paraphrase the text, match
   everything else exactly.)

---

## 1. SOURCE OF TRUTH (on disk — do not guess, read these)

- **GML code:** `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 5 - GML\`
  Files: `gml_Object_<obj>_<Event>.gml` (Create_0, Step_0, Draw_0, Alarm_N, Other_N=event_user, Step_2). Global
  scripts: `gml_GlobalScript_<name>.gml`. **This is authoritative — read whole files, never fragments.**
- **Refdata (TSV):** `C:\Users\lando\Desktop\DELTARUNE - REF DATA\DELTARUNE Chapter 5 - REFDATA\`
  `objects.tsv` (object→default sprite/mask/parent/depth/visible/persistent — the GML decompile OMITS default
  sprite_index, so this is the ONLY source for it), `sprites.tsv` (name→frames/w/h/originX/originY),
  `sounds.tsv` (name→file/type/group).
- **Full PNG/audio export:** `C:\Users\lando\Desktop\DELTARUNE - EXPORT\DELTARUNE Chapter 5 - EXPORT\`
  `sprites\<spr_name>_<frame>.png` (every sprite, every frame, real trim), `sounds\<snd>.ogg|.wav`.
- **Chapters 1-4** of all three exist too (same layout) if a shared/base object is needed.
- **Already-extracted chart data:** repo `PINK_SOURCE_SPEC.md` (cat/lane/bomb `ds_bullet_list` charts fully
  resolved to numbers + thrower/cadence logic). Reuse it; it's correct.

Colors in GML are BGR ints: `R + G*256 + B*65536` → decode to RGB. GM angles are y-DOWN
(`lengthdir_x(d,a)=d*cos(a)`, `lengthdir_y(d,a)=-d*sin(a)`; dir 0=right,90=up,180=left,270=down).
`round(0.5)=0` (banker's/round-half-to-even) — matters for interval-0 volleys.

---

## 2. THE ENGINE (DeltaVersus) — how attacks work

Vanilla JS + canvas, 640×480, no build step. Key files in `docs/js/`:
- **`patterns.js`** — every attack is `PATTERNS.<id> = { box:{w,h}, hz30, dur, tick(a) }`.
  `a = { f (frame), box, add(bullet), rng(), fx, tier, soul }`. `hz30:1` → sim ticks at 30 Hz (use raw GML
  numbers). `hz30:false` → 60 Hz (menu input). `PS(g)=g/1.6` converts GML image_xscale→our scale (drawBullet ×1.6).
  A bullet: `{x,y,vx,vy,r,grazeR,scale,dmg,life, animKeys:[...],animRate:N (frame-cycled sprite), rot, tint,
  pickup,tp,doki, emit(b,out,soul,box,fx) (controller bullets), noHit,...}`. `bulletProps('key')` →
  `{img,r,scale}` from the manifest.
- **`battle.js`** — the sim/render. `fx.*` channels are per-frame telegraph/render data the pattern writes and
  the renderer consumes (reset each frame ~line 1024). Full-screen "takeover" attacks (date, maze) set a flag
  (`fx.date`/`fx.maze`) → engine skips box+HUD and calls a dedicated draw fn; end via `fx.X.done → phase='boxout'`.
  **Purple-soul modes** (obj_purplecontrols): set `fx.purpleSoul={mode:N,...}`; engine moves the soul.
  mode 1 = 3 vertical lanes (56px) + x-wiggle ±63; 2 = 4×4 grid (40px); 3 = rotating cross (box rotates);
  4/5 = 2 vertical lanes/conveyor; 7 = 3-D tunnel; 8 = node maze (V2 = full-screen `fx.maze`).
- **`assets.js`** — `A.manifest`, `A.img`, `drawText(ctx,'main'|'big',str,x,y,{color,align,scale})` (DELTARUNE
  bitmap font — use this for ALL fight text, never ctx.font), `drawSpr`, `mixHex`, `A.soul(key)`. `ASSET_V`
  const — **bump it after importing sprites** so the browser refetches the manifest.
- **`characters.js`** — the live Pink fight roster (`CHARS.pink` / tester `CHARS.pinknew`): fight/spells/ult +
  doki-spare config. Attacks referenced by id.

### Tools
- **Sprite import:** `python tools/import_spr.py spr_name:key[:notrim] ...` (use the Py312 exe at
  `C:\Users\lando\AppData\Local\Programs\Python\Python312\python.exe`). Copies every frame
  `spr_name_<i>.png` from the export → `docs/assets/bullets/key<i>.png` + registers in manifest.bullets.
  Use `:notrim` for ANIMATED sprites/portraits (per-frame trim breaks alignment). Then bump `ASSET_V`.
- **Tester:** `docs/attack_tester.html`. Dev server is launch config name **`deltaversus`** on port **8399**
  serving `Desktop\DeltaVersus\docs` → open `http://localhost:8399/attack_tester.html`. Select PINK·NEW
  (`pinknew`) in the dropdown. Drive headless via `Battle.update(1/60)` in a loop; launch an attack with
  `startAttack('pinknew', CHARS.pinknew.spells.find(s=>s.id==='<id>'))` (or `.fight` / `.ult`).
- **Deploy:** it's a git repo; `git push origin main` → GitHub Pages (dingodevyt.github.io/deltaversus).
  Bump the `?v=` query on patterns.js/battle.js in `docs/index.html` so players refetch.

---

## 3. VERIFICATION (how to check without burning tokens)

- **Headless first:** run `Battle.update(1/60)` N times, inspect `Battle.bullets`, `Battle.fx.*`, pattern state
  via `javascript_tool`. Catches errors + confirms mechanics cheaply. Remember hz30:1 → 2 update calls = 1 sim frame.
- **Then ONE screenshot** per attack for the visual (the in-app Browser pane; resize to mobile/tablet if the
  desktop screenshot times out). Don't spam screenshots.
- **Visual reference:** you MAY browse the DELTARUNE wiki / YouTube for the real fight to compare framing,
  colors, scenery, and attack look. Use it to verify, don't copy text.

---

## 4. AGENT STRATEGY (token-efficient — this is important)

The V2 mistake was agents returning giant specs into the main context. Do this instead:

- **Extraction agents WRITE their spec to a file and return only a 1-line summary + path.** The main agent
  reads the spec file's relevant sections on demand while porting. Prompt template:
  > "Read the COMPLETE GML for `<objects/events>` in `C:\...\DELTARUNE Chapter 5 - GML\`. Write an EXACT port
  > spec to `C:\Users\lando\Desktop\DeltaVersus\pink_v3_specs\<name>.md` — VISUALS (every draw_sprite/
  > draw_rectangle/draw_line call with sprite name, coordinates, scale, color-int→RGB, layer order),
  > MECHANICS (every movement/collision formula, exact numbers), TIMING/cadence, and asset list (sprite +
  > sound names). Use exact file:line refs. **Return ONLY a one-line summary and the file path — do NOT paste
  > the spec into your reply.**"
- **Batch the upfront extraction** into a few agents run in parallel (background), one per subsystem, each
  writing its own `pink_v3_specs/*.md`. Suggested split (keeps each agent focused, avoids overlap):
  1. **Fight flow + scenery/background** — obj_pink_enemy (all events), the battle bg/room, obj_pink_dummy,
     obj_pinktree(_tall), obj_pink_spotlight, obj_pinkdust, curtains, crowd, phase/datecount/doki structure,
     which attack plays when. → `pink_v3_specs/00_flow_and_scenery.md`
  2. **Maze** — obj_purplecontrols mode 8 (Create/Step/Draw), obj_pinknode, obj_pinknodeact, obj_dokiheart,
     obj_pink_ghost_marker + obj_pink_enemy maze-split draw. → `pink_v3_specs/maze.md` (heaviest).
  3. **Concert** — obj_pink_curtains (all), obj_audience_hitbox, obj_audiencehater, obj_audienceheart.
  4. **Bombs** — types 203/206, obj_pink_battlemovement mode 5 + interlude modes, obj_fusebomb(_big),
     obj_pinkbombexplosion.
  5. **Plus-grid + rotbox + P3 ghost** — type 202, obj_pinklanebullet, obj_pinkcirclestar?, obj_huge_anime_face.
  6. **Tunnel** — type 208 obj_purplecontrols mode 7, obj_pinkzap/_arrow/obj_pink3durgenter.
  7. **Date** — obj_date_controller (Create/Step/Draw), obj_date_heart, obj_date_ui, the per-line
     `pinkportrait` sprite mapping, possessed form, portraits/bg/diamonds/lives/timer. (Cats charts already in
     `PINK_SOURCE_SPEC.md`.)
- Then **port attack-by-attack** reading only the relevant spec file. Verify each (headless + 1 screenshot),
  commit, move on. Don't hold all specs in context at once.
- Keep the main loop lean: don't re-read GML you've already spec'd; don't paste large file contents; prefer
  Grep/targeted Reads.

---

## 5. THE PLAN (Pink V3)

1. **Extraction pass** — run the §4 agents; they populate `pink_v3_specs/`. (Create the dir.)
2. **Scenery first** — build the Pink fight's background/stage layers so every attack renders in the real scene
   (this was entirely missing). Likely a reusable `fx.pinkScene` render layer.
3. **Port attacks** into `PATTERNS.pinkn3_*`, one at a time, from the specs. Order: start with the ones V2 got
   wrong (maze, date), then re-verify the "good" ones (cats/bombs/plusgrid/tunnel/concert) against their specs
   and copy/upgrade to V3.
4. **Wire** `characters.js` `pinknew` (and live `pink`) to the `pinkn3_*` ids; keep old ids until V3 verified.
5. **Fix the maze lag** (see §0.1) and re-verify the maze mechanics end-to-end (0→1→2→3→ending) + feel.
6. **Deploy in verified batches**, bumping `?v=`/`ASSET_V`.

### Per-attack status carried over from V2 (what to trust / redo)
| Attack | GML | V2 state | V3 action |
|---|---|---|---|
| Cats / purple lanes (200) | type 200, purple mode 1, `PINK_CATS_D0/D1` | exact chart, WORKS | verify vs spec, copy to V3 |
| Piñata bombs (203/206) | thrower mode 5, `PINK_BOMB_D0-4` | charts exact (D0 fixed), works | verify vs spec, copy |
| Plus-grid / rotbox (202) | obj_pinklanebullet | worked well | verify vs spec |
| 3-D tunnel (208) | purple mode 7 | worked well, real zaps | verify vs spec |
| Idol concert (209) | obj_pink_curtains | U-ring ported, real sprites | verify vs spec; add scenery |
| P3 ghost | obj_huge_anime_face | ported | verify vs spec |
| **Date 1/2** | obj_date_controller | **visuals wrong** | REDO from spec (portraits/bg/lives) |
| **Final maze** (210) | obj_purplecontrols mode 8 | **laggy + mechanics off** | REDO (perf + exact port) |
| 204/205 vlanes | cut variants | not in fight | skip unless fight uses them |

---

## 6. HARD RULES
- Read the **whole** GML file for an object before porting it. No approximations, no invented cadences.
- Use the **real sprites** from the export for everything (import via the tool). If an element is drawn
  procedurally in GML (draw_rectangle/line/text), replicate that draw exactly (colors, sizes, pulsing).
- Match **layer order** and **backgrounds** — the fight is a scene, not bullets on black.
- **Do not reproduce copyrighted dialogue** (date/story text) verbatim — paraphrase the words, match the
  mechanics/visuals exactly.
- Verify every attack (headless + screenshot) before deploying. Commit in small, described batches.
