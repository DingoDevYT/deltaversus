# DELTAVERSUS — GML→JS boss-porting PLAYBOOK

Reusable, character-agnostic knowledge for rebuilding a DELTARUNE boss fight into the DeltaVersus engine at
100% mechanical + visual accuracy from the decompiled GML. Written after the full Pink (Mad Mew Mew) V3
rebuild. Read this in full before starting a new boss (e.g. Gerson). The per-boss handover (e.g.
`GERSON_REBUILD_HANDOVER.md`) adds the specifics.

---

## 0. THE GOLDEN RULES (learned the hard way)

1. **Read the WHOLE GML file for an object before porting it.** No approximations, no invented cadences.
   Replicate every draw call, formula, and exact number.
2. **Verify each attack HEADLESS first, then ONE screenshot.** Never spam screenshots. (§4)
3. **Paraphrase all copyrighted dialogue.** Match mechanics/visuals exactly; never reproduce the script
   verbatim, and never store the verbatim text in a data table (delete it if you find it).
4. **Commit in small, described batches; deploy in verified batches.** It's a git repo → GitHub Pages.
5. **Namespace a from-scratch rebuild** (e.g. `pinkn3_*`) and keep the old ids until the new set is verified,
   then delete the old ones and make the new set self-contained.
6. **Extraction agents WRITE their spec to a file and return only a 1-line summary + path.** Never paste
   giant specs into the main context. (§5)

---

## 1. SOURCE OF TRUTH (on disk — read, don't guess)

- **GML code:** `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 5 - GML\`
  Files: `gml_Object_<obj>_<Event>.gml`. Events: `Create_0`, `Step_0`, `Step_1`(begin step), `Step_2`(end step),
  `Draw_0`, `Alarm_N`, `Other_10`=event_user0, `Other_11`=event_user1 … `CleanUp_0`, `PreCreate_0`.
  Global scripts: `gml_GlobalScript_<name>.gml`. Room CC: `gml_RoomCC_<room>_<i>_PreCreate.gml`.
  Chapters 1–4 exist too (same layout) if a shared/base object is needed.
  Use **Glob** (`gml_Object_obj_<name>_*.gml`) to list every event for an object, then Read whole files.
- **Refdata (TSV):** `C:\Users\lando\Desktop\DELTARUNE - REF DATA\DELTARUNE Chapter 5 - REFDATA\`
  - `objects.tsv` — object → default sprite_index/mask/parent/depth/visible/persistent. **The GML decompile
    OMITS the default `sprite_index`, so this is the ONLY source for it.**
  - `sprites.tsv` — `name  frames  width  height  originX  originY`. (Origins matter for placement.)
  - `sounds.tsv` — name → file/type/group.
- **Full PNG/audio export:** `C:\Users\lando\Desktop\DELTARUNE - EXPORT\DELTARUNE Chapter 5 - EXPORT\`
  `sprites\<spr_name>_<frame>.png` (every sprite, every frame, real trim), `sounds\<snd>.ogg|.wav`.
  Note: a sprite `spr_x` with frames is exported as `spr_x_0.png`, `spr_x_1.png`… A sprite whose *name*
  ends in a number (e.g. `spr_pinkroll_background`) may export as `spr_pinkroll_background_0.png` where the
  `_0` is the frame — import as the base name.

### GML conventions to convert
- **Colors are BGR ints:** `R = int & 255`, `G = (int>>8)&255`, `B = (int>>16)&255`. GML `#RRGGBB` literals
  and `make_color_rgb(r,g,b)` are already RGB.
- **GM angles are y-DOWN:** `lengthdir_x(d,a)=d*cos(a)`, `lengthdir_y(d,a)=-d*sin(a)`; dir 0=right, 90=up,
  180=left, 270=down. (Our canvas is y-down too, so `y = -sin` when copying lengthdir.)
- `round(0.5)=0` (banker's / round-half-to-even) — matters for interval-0 volleys.
- `image_index -1` in a draw call = the previous/last frame.
- Depth: smaller depth = drawn more in front.

---

## 2. THE ENGINE (`docs/js/`)

Vanilla JS + canvas, **640×480**, no build step.

### `patterns.js` — every attack is a pattern
`PATTERNS.<id> = { box:{w,h}, hz30, dur, tick(a) }`.
- `a = { f (frame counter), box, add(bullet), rng(), fx, tier, soul, imgs }`.
- **`hz30:1`** → sim ticks at **30 Hz** (use raw GML numbers directly). `hz30:false` → 60 Hz (menu-style input).
  ⚠️ At 30 Hz the sim runs every OTHER 60 Hz frame — see the input gotcha in §6.
- **`PS(g) = g/1.6`** converts a GML `image_xscale` to our scale (drawBullet multiplies by 1.6).
- A **bullet**: `{x,y,vx,vy,r,grazeR,scale,dmg,life, animKeys:[...],animRate:N, rot, tint,tintMul, sx,sy,
  pickup,tp,doki, shape:'line'|'ring', noHit, emit(b,out,soul,box,fx), ...}`.
  - `animKeys` + `animRate` = a frame-cycled sprite. `bulletProps('key')` → `{img,r,scale}` from the manifest.
  - `emit(b,out,…)` = a **controller** bullet: runs each frame and pushes child bullets to `out`.
- **`box`** on the pattern reshapes the dodge box (wide/tall/square) for a solo attack.

### `battle.js` — the sim + renderer
- **`fx.*` channels** are transient per-frame data the pattern writes and the renderer consumes. They are
  **reset every frame** (~line 1024, `updDodge`). Set them each tick. Examples we added for Pink:
  `fx.pinkScene` (stage scenery), `fx.pinkRoll` (scrolling parallax bg), `fx.pinkSing`/`fx.audienceFront`
  (concert), `fx.pinkGhost` (ramming face), `fx.maze` / `fx.date` (full-screen takeovers), `fx.purpleSoul`
  (the engine moves the soul), `fx.attackDone` (see §6), `fx.bombWarn`, `fx.boxTarget`, `fx.shake`, etc.
- **Full-screen "takeover" attacks** (date, maze) set a flag (`fx.date`/`fx.maze`) → the engine skips the
  box + party HUD and calls a dedicated draw fn; end via `fx.X.done` → a frame counter → `phase='boxout'`.
- **Purple-soul modes** (`fx.purpleSoul = {mode:N,…}`): engine moves the soul. mode 1=3 vertical lanes,
  2=4×4 grid, 3=rotating cross (box rotates), 4/5=lanes/conveyor, 7=3-D tunnel, 8=node maze.
- **Render order** (`Battle.render`): bg → `renderChars` → `renderBoxAndBullets` → HUD → msg. Custom
  backdrops branch before `renderChars` (see `fx.pinkScene`/`fx.pinkRoll` in `Battle.render`).
- The dodge **ends** when `--B.dodgeT <= 0` (or team dead). `dodgeT = sim.dur`.

### `assets.js`
- `A.manifest.bullets[key] = {f,w,h,ow,oh,ox,oy}` (f=file; ow/oh=original canvas; ox/oy=trim offset).
- `A.img['assets/bullets/'+info.f]` → the Image. `A.soul(key)`, `A.ui(key)`.
- `drawText(ctx,'main'|'big',str,x,y,{color,align,scale})` — the DELTARUNE bitmap font. **Use this for ALL
  fight text, never `ctx.font` bitmap-wise** (but `ctx.fillText` with a monospace font is used for the date
  dialogue overlay). `drawSpr(ctx,im,x,y,{scale,flip,alpha,rot,sx,sy})` — centered, pixel-snapped.
- **`ASSET_V`** (top of file) — bump after importing sprites so the browser refetches the manifest.

### `characters.js` — the roster/kits
`CHARS.<id> = { name,color,hp,cost,level,secretBoss, fight:{…}, spells:[…], ult:{…}, dokiDates?:[…] }`.
Each move: `{ id, name, dmg, dur, tp?, kind:'attack', text }`. `id` maps to `PATTERNS[id]`.

### Damage flow (important for balancing)
- A move's `dmg` × `TIER_MULT[tier]` = **per-hit** damage → applied to bullets added via **`a.add(b)`**
  (the sim's add callback overwrites `b.dmg`). So the kit `dmg` controls "add-path" bullets.
- Bullets pushed via a controller's **`emit → out.push(b)`** keep the **`b.dmg` set in the pattern** (they do
  NOT get the kit dmg). So for bombs/explosions/homing bullets you must set/balance `dmg` in the pattern.
- Spamton Neo tier is ~28–66 per hit (mid ~44–52). "Balance to ~50" = set kit `dmg`≈50 AND the emit-path
  pattern `dmg`≈50.

---

## 3. TOOLING

- **Sprite import:** `python tools/import_spr.py spr_name:key[:notrim] …`
  Use the Py312 exe: `C:\Users\lando\AppData\Local\Programs\Python\Python312\python.exe`.
  Copies every frame `spr_name_<i>.png` from the export → `docs/assets/bullets/key<i>.png` + registers in
  `manifest.bullets`. **Use `:notrim` for ANIMATED sprites/portraits/backgrounds** (per-frame alpha-trim
  breaks frame alignment). Then bump `ASSET_V`.
- **Tester:** `docs/attack_tester.html`. Add a tester-only char (e.g. `CHARS.gersonnew`) listing the new
  attack ids; select it in the UI. Drive headless via `Battle.update(1/60)` in a loop; launch with
  `startAttack('<charId>', CHARS.<charId>.spells.find(s=>s.id==='<id>'))` (or `.fight`/`.ult`).
  ⚠️ **The tester `<script>` tags are version-stamped `?v=NNN`** (I added this) — bump that number whenever
  you edit JS or the browser serves a STALE copy (this bit me: a cached `battle.js` hid a real fix). A
  tester attack must have `dmg` truthy or `isAttack()` rejects it and no sim is built.
- **Dev server:** launch config name **`deltaversus`**, port **8399**, serving `Desktop\DeltaVersus\docs`.
  `preview_start({name:'deltaversus'})`; then navigate to `http://localhost:8399/attack_tester.html`.
  If another chat already holds the port, `preview_start({url:'http://localhost:8399/attack_tester.html'})`.
- **Deploy:** `git push origin main` → GitHub Pages (`dingodevyt.github.io/deltaversus`). Bump the `?v=` on
  the changed JS in `docs/index.html` (separate from the tester's stamps) so players refetch, and bump
  `ASSET_V` if sprites/manifest changed.

---

## 4. VERIFICATION (cheap → expensive)

1. **`node --check`** each edited JS file (catches syntax before the browser).
2. **Headless:** run `Battle.update(1/60)` N times, then `Battle.render(ctx)` in a try/catch, and inspect
   `Battle.bullets`, `Battle.fx.*`, pattern state via `javascript_tool`. **Render inside a try/catch** — a
   pattern can tick fine but the *renderer* can throw (that froze the Pink dates once). Remember `hz30:1`
   → 2 `update` calls = 1 sim frame.
3. **Sample the canvas** (`ctx.getImageData(x,y,1,1)`) to confirm a specific thing drew where expected —
   far cheaper/more precise than eyeballing a screenshot (used it to find the exact eye-y for the lasers).
4. **Then ONE screenshot** for the overall look. Resize to mobile/tablet if a desktop shot times out.
5. **Visual reference:** you MAY browse the DELTARUNE wiki / YouTube to compare framing/colors/scenery.
   Use it to verify; never copy text.

---

## 5. AGENT STRATEGY (token-efficient extraction)

- Run **extraction agents in parallel (background), one per subsystem.** Each reads the COMPLETE GML for its
  objects and **writes an EXACT port spec to `<boss>_specs/<name>.md`**, returning ONLY a 1-line summary +
  the path. The main loop reads a spec file's relevant sections on demand while porting — never hold all
  specs in context at once.
- Prompt template (works well):
  > "Read the COMPLETE GML for `<objects/events>` in `C:\…\DELTARUNE Chapter 5 - GML\`. Write an EXACT port
  > spec to `C:\…\<boss>_specs\<name>.md` — VISUALS (every draw_sprite/draw_rectangle/draw_line call with
  > sprite name, coords, scale, image_index, color-int→RGB, alpha, layer order), MECHANICS (every
  > movement/collision formula, exact numbers), TIMING/cadence, and an asset list (sprite + sound names).
  > Use exact `file:line` refs. **Return ONLY a one-line summary and the file path — do NOT paste the spec.**"
- If you need specific numbers back to act immediately (e.g. render-region bounds), also ask for a **concise
  ~12-line summary containing the actual answers** (not "see file") — the exception to "summary only".
- Then **port attack-by-attack**, reading only the relevant spec file, verify each, commit, move on.

---

## 6. GOTCHAS / HARD-WON LESSONS (don't rediscover these)

- **Sounds only play if the key is in `manifest.sfx`.** `Snd.play('foo')` silently no-ops for an unknown
  key. Check `Object.keys(A.manifest.sfx)` and map GML sound names to a *registered* key (e.g.
  `snd_pink_trip` isn't registered → use `heavyswing`/`bosshit`/`explosionmmx`, which are).
- **30 Hz input drops taps.** `Input.hit[k]` (just-pressed) is cleared every 60 Hz frame; a 30 Hz (`hz30:1`)
  sim ticks every other frame and randomly misses it (looked like "can't move sometimes"). Fix: detect the
  **press EDGE from the held state** yourself — `pressed = Input.down[k] && !wasDown[k]` — which survives
  across sim ticks. (`Input.down` = held, `Input.hit` = pressed-this-frame, `Input.flush` clears hit.)
- **Watch for name collisions.** I named a helper `wrapText` — but `battle.js` already had a text-*drawing*
  `wrapText()`; mine got shadowed and returned `undefined` → the renderer crashed and froze the dates.
  Grep for the name before defining a global function.
- **`fx.attackDone`** — a normal (non-takeover) attack can signal "wrap up now" by setting
  `a.fx.attackDone = true`; the engine drives `dodgeT` to end via the normal path. Use it to end an attack a
  fixed time after its last event (e.g. bombs: end exactly ~2 s after the final explosion) instead of
  guessing `dur`. Set `dur` to a generous cap as a backstop.
- **Perf: never reallocate a canvas every frame.** Assigning `canvas.width/height` reallocates + clears the
  whole backing store. Allocate an offscreen surface ONCE, `clearRect` each frame, cache its `getContext`.
  (This was the maze lag.)
- **Emit-path vs add-path damage** — see §2. Balance both.
- **Raw vs rescaled coordinates** — DELTARUNE draws at raw room coords (`camerax/y ≈ 0` in battle). Don't
  "helpfully" re-center/scale a graph to fit the screen; use the real coords (the maze looked wrong until we
  used raw coords with the root at its real `camerax+320, cameray+360`).
- **Scenery is a whole scene, not bullets on black.** A boss fight often has background/stage objects
  (dancers, marquee, curtains, spotlights, parallax). Map them FIRST and build a reusable render layer.
- **Bottom-anchor portraits/sprites of varying size** so swapping expressions doesn't make them jump.
- **When bulk-deleting code with a brace-counting script, strip `//` comments first** — parens inside
  comments throw the balance off and over-delete. Always re-verify (grep that every kept symbol survives,
  `node --check`, headless run-all) and be ready to `git checkout HEAD -- <file>` and retry.

---

## 7. THE WORKFLOW FOR A NEW BOSS (recipe)

1. **Locate the boss's GML objects** (Glob/Grep by attack theme + the boss name; check `objects.tsv` for the
   controller object). Identify the attack controller (often `obj_dbulletcontroller` with a `type` number)
   and the per-attack objects.
2. **Create `<boss>_specs/`** and run the §5 extraction agents in parallel (one per subsystem/attack group +
   one for fight-flow/scenery).
3. **Delete the old broken attacks** for this boss (patterns + kit + tester), OR namespace the new set and
   remove old once verified. Make the new patterns self-contained.
4. **Build the scenery/backdrop layer** first if the fight is a staged scene.
5. **Port attack-by-attack** from the specs. Verify each (node --check → headless render → canvas-sample →
   1 screenshot). Commit per attack/batch.
6. **Wire the kit** (`CHARS.<boss>`) to the new ids; balance damage (~50 baseline, more for specials).
7. **Deploy in verified batches** (bump `?v=` + `ASSET_V`).
8. Keep the main loop lean: read spec files on demand, don't re-read GML you've spec'd, prefer Grep/targeted
   Reads over pasting large files.

---

## 8. FILE MAP
- `docs/js/patterns.js` — all attack patterns (the bulk of the work).
- `docs/js/battle.js` — sim + renderer + `fx.*` consumers + full-screen takeover draws.
- `docs/js/characters.js` — rosters/kits.
- `docs/js/assets.js` — manifest load, font, `drawSpr`, `ASSET_V`.
- `docs/assets/manifest.json` — sprite/sound registry. `docs/assets/bullets/*.png` — imported sprites.
- `docs/attack_tester.html` — the dev tester (version-stamped script tags).
- `tools/import_spr.py` — sprite importer.
- `<boss>_specs/*.md` — per-subsystem extraction specs (source of truth for porting).
- Pink reference: `PINK_V3_HANDOVER.md`, `PINK_SOURCE_SPEC.md`, `pink_v3_specs/*.md` (a worked example).
