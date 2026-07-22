# GML → DELTAVERSUS Porting Guide (the method that works)

> **➜ For a NEW boss rebuild, start with `DELTAVERSUS_PORTING_PLAYBOOK.md`** — the up-to-date, character-
> agnostic playbook (engine, GML conventions, tooling, verification, agent strategy, and hard-won gotchas)
> written after the full Pink V3 rebuild. `GERSON_REBUILD_HANDOVER.md` is the current mission + agentic prompt.


This is the distilled process after Pink. It applies to every future boss (Landon plans many more).

## Rules of engagement
1. **1:1 or nothing.** Landon rejects approximations instantly. "Mechanically sound but not the actual attack" = failure.
2. **Read the ENTIRE relevant GML files yourself** (Read tool, full files, in chunks). Never rely on grep snippets alone or subagent summaries for engine-critical logic — that caused every failure so far.
3. **Wiki + GML together**: he pastes wiki sections — they give intent, phases, and what things should LOOK like. The GML gives exact values. When they seem to conflict, the GML wins; the wiki tells you which variant/phase you're looking at.
4. **Native 640×480 metrics.** Measure sprites with PIL, don't eyeball. Battle box = `spr_battlebg_stretch_hitbox` (75×75) × image_xscale. Souls at scale 1 (red 16px, purple 20px).
5. **Exact sprites & sounds**: GML names = file names in `NEW RIP/**` and the SFX dumps. Rip with PIL (trim via getbbox unless it's a UI frame), register in `docs/assets/manifest.json`.
6. **30fps**: author patterns with RAW GML numbers + `hz30:1`. GML `round(0.5)=0` (banker's) — 0-interval chart entries are SAME-frame.
7. Where GML is data-driven (`ds_list_add` charts), **extract the numbers programmatically** (python regex + eval of the `var _x = ...` env) and embed verbatim as JS consts. Where it's procedural, port the state machine line-by-line.

## GML → engine translation cheatsheet
- `lengthdir_x(r,d)` = `r*cos(d°)`; `lengthdir_y(r,d)` = **`-r*sin(d°)`** (y-flip!). GML angle 0=right, 90=UP, 270=DOWN.
- `image_xscale g` on a bullet → our `scale: PS(g)` where `PS = g => g/1.6` (drawBullet multiplies by 1.6).
- `choose(a,b,...)` → pick(); `irandom(n)` → `Math.floor(rng()*(n+1))` (inclusive!). Use the pattern's seeded `rng` for determinism (multiplayer lockstep).
- `image_blend` tint → `b.tint` + `b.tintMul:true` (keeps art). Flat flash → `b.tint` without mul.
- `scr_get_box(0..5)` = right/top/left/bottom/centerx/centery of the dodge box.
- Controller objects that spawn per-frame (`with(obj_x){...}` Step logic) → bullet `emit(b, out, soul, box, fx)` closures, often closing over the pattern's state object `S`.
- Patterns are objects `{dur, box:{w,h}, hz30, tick(api)}` in `docs/js/patterns.js`; api = `{f, rng, box, tier, soul, add, imgs, fx}`. `fx` is the engine control channel (purpleSoul, boxTarget, date, greenSoul, boss, shake, ...) — battle.js consumes it next frame (`CF = B.fx`).

## Pipeline per attack
1. Find the dispatcher (e.g. `obj_<boss>_enemy_Step_0.gml`: `myattackchoice` → `dc.type = N`) to learn the REAL roster (some coded attacks are unused — check `grep "myattackchoice = "` across the enemy object).
2. Read the `type == N` block of `obj_dbulletcontroller_Step_0.gml` **fully** + every object it spawns (Create + Step + Draw + Alarms) + any soul-mode logic in `obj_purplecontrols`/equivalent.
3. Extract charts with python; port logic; use exact fuses/speeds/intervals/offsets.
4. Rip needed sprites, wire manifest, bump ASSET_V.
5. Headless-verify counts vs a hand-trace of the GML (node harness — stub A/Snd/Battle/Input, eval patterns.js).
6. One browser screenshot + `Battle` state probes in the tester (`CHARS.<boss>new` entries in attack_tester.html — dmg must be >0 or isAttack filters the button out).
7. Bump `?v=` in index.html, commit, push (auto-deploys Pages).

## Known landmines
- Tester tab rAF throttles unfocused → never infer timing from wall-clock screenshots; probe or go headless.
- `attack_preview.html` (showcase) has a SEPARATE mini-engine — new engine features must be mirrored there or showcase entries will misbehave.
- Old approximation sets still exist (`pink_*` old, `jx_*`, `kx_*`, greentest) — don't confuse `pink_` with `pinkn_`.
- The tester's ULT slot has a moveDef.id quirk where pattern `box` didn't apply once (concert); spells resolve fine.
- `Battle` is a top-level const (not on window) — in page JS probes reference `Battle` directly, not `window.Battle`.
- multiplayer: patterns must stay deterministic from `rng(seed)` — no Math.random in tick paths (Math.random only allowed in cosmetic engine bits).

## Boss-status snapshot (2026-07-22)
- **Pink**: see HANDOFF_PINK.md (nearly done; tunnel/date rewrites need browser verification; small TODO list there).
- **Gerson / Jevil**: rebuilt from GML earlier but at the OLD (pre-strict) bar — Landon flagged: Gerson green-soul sprites + box mask (mask since fixed engine-wide), Box Throw must tilt the box 45° left (box-rotation feature now exists via fx.purpleSoul.rot pattern — generalize to fx.boxRot), dialogue box should LOWER during dodge. Jevil ULT needs work.
- **Spamton NEO / Knight**: Landon wants FULL redos from GML at the new 1:1 bar (parallel "— NEW" sets, tester-only first). Knight Stars was specifically called out as wrong; Knight ULT is very complex.
- Rollout agreement: autonomous, deploy per boss, "— NEW" sets tester/showcase only until approved.
