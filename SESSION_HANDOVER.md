# Handover — the fidelity suite goes fight-wide, 2026-07-29

Picks up from the 2026-07-28 session (`7cae9d3e`), which a machine crash ended
mid-flight. Recovery notes are at the bottom; read them before trusting any
"it was all lost" instinct.

## Start here

```bash
node scripts/serve.js          # -> http://localhost:8399/gml_studio.html
```

All four must be green before a commit:

```bash
node scripts/test_compiler.js   # 154/154, 0 GML parse errors, 0 JS syntax errors
node scripts/test_semantics.js  # 34/34
node scripts/test_runtime.js    # 154/154 clean, hard failures 0
node scripts/test_engine.js     # SUCCESS, 7 instances — sets NO exit code, read it
```

In the browser (front the tab; `SPEC_CHECK.load` MUST take the array):

```js
SPEC_CHECK.load(window.ATTACK_SPECS)
await SPEC_CHECK.runAll('titan')           // per boss, never the whole roster
```

**Long sweeps must checkpoint to disk.** `scripts/serve.js` now takes
`POST /specrun` and writes `spec_run.json` (gitignored) at the repo root. Drive a
sweep from the page, post after each boss, and read progress from the shell —
a sweep that lives only in page memory is exactly what the crash destroyed.

## Coverage

**142 -> 276 attacks, 3,577 assertions**, every one carrying the file:line the
number came from. 134 attacks were authored by one pass of agents and re-checked
by a second that had to open every citation (158 recorded corrections).

Rebuild the merged file with:

```bash
node scripts/build_attack_specs.js <existing.json> <units>/*.json <journal.jsonl> scripts/spec_overrides.json
```

Order matters — later sources win the by-id merge, and the overrides go last.

## Engine bugs the suite found

Each was found by an assertion failing, and each is a thing the studio got wrong
about the game, not a thing the suite got wrong about the studio.

1. **`global.inv` was never maintained.** obj_heart's Step does
   `global.inv -= 1` unconditionally (obj_heart_Step_0.gml:271), so it is
   negative for almost a whole turn and the corpus's many `if (global.inv < 0)`
   tests are true. The studio drives its own soul, so the variable stayed
   undefined and every one of those tests was false — the Titan's light aura
   settled at 38.4 instead of 48 across five attacks.
2. **A pinned difficulty was overridden by the UI selector.** 41 roster entries
   carry a `difficultyLiteral`; 24 pin a non-zero value. The Queen picks Plug's
   variant on the boss's own `difficulty` and the box block reads the same
   variable, so the HARD Plug ran its hard bullets in the EASY 150x150 box.
3. **Two fallback boxes overruled the game's own answer.** The Titan's heal turn
   is `if (myattackchoice == 20) { } else { ...box... }` — an empty arm — and
   the studio fabricated a box anyway. Also `titan.json` anchored its box slice
   INSIDE the else arm, dropping the guard: an enclosing condition is part of
   the box logic.
4. **The default box pre-empted per-attack boxes.** The Chaos King builds his own
   box per attack (`instance_create(xx + 310, yy + 165, obj_growtangle)`); the
   studio's box existed first, so `if (!instance_exists(obj_growtangle))` skipped
   his. Now suppressed when the attack's setup creates one.
5. **`variable_instance_exists` did not exist** (148 ch5 files use it), so every
   feature-flag guard took the negative branch. Implemented with `in`, which
   reaches the target without tripping the instance Proxy's auto-materialising
   `get` trap.
6. **String instance variables could never pass.** `spec_check.js`'s `ivar`
   compared through `Number()`, so `state == "idle"` failed while printing
   `GOT idle`. Three fights were affected.

## Roster mechanisms added

Data, not special cases. Each is declared in a roster JSON and consumed generically.

- **`enemySet`** — boss state the ENCOUNTER establishes. `obj_aqua_enemy`
  defaults to `fight_type = "solo"`, and the attack code branches on the live
  value (`knife_setup(..., 60, 6)` vs `(..., 50, 8)`), so the paired fight was
  dispatching the SOLO fight's bullets under the paired fight's name.
- **`call`** -> `controllerCall` — a controller configured by a METHOD, not
  fields. `obj_susiezilla_gamecontroller.setup(mode)` derives width 640 and
  bgxoffset 320 and spawns the player; spawned raw it sat at mode 0 / 1280,
  which is a different minigame, running happily.
- **`at`** -> `controllerAt` — where the real caller creates the controller.
  A minigame controller's own x is the playfield origin: obj_tenna_zoom makes it
  at `camerax(), cameray()` = (0,0), and spawning it at the boss shifted the
  player, the statue and every background draw by +520.

## Traps worth keeping

- **A cluster of failures is usually ONE cause.** 33 in Aqua & Seth, 34 in
  Tenna, 23 in Flowery — each was a single fact, not dozens of bugs.
- **Suspect the spec too.** Flowery's 23 were the SPEC: the box block does
  `x -= 5` three lines after creating the box at 320
  (obj_flowery_enemy_Step_0.gml:1119), so the box is at 315 and everything
  derived from it was 5 too high. The engine was right.
- **Never fit a spec to the engine.** Corrections go in
  `scripts/spec_overrides.json`, regenerated by `scripts/make_spec_overrides.js`,
  and each must cite a line that states the fact. The generator exists because
  the merge replaces a spec WHOLESALE by id — a hand-written partial override
  silently deletes every assertion it does not restate.
- **Measure box presence by CREATIONS, not survivors.** A turn that ends
  destroys its box in teardown, so an end-of-run count reads 0 for a healthy
  fight (Lancer's bike attack looked boxless for exactly this reason).
- **A verifier that changes nothing has not been proven lazy.** An early read of
  "0 corrections" was wrong: those journal entries were the AUTHORS' (no
  `changes` field). Check which stage a result came from before concluding.

## What is still open

1. **Aqua & Seth: 21 failures**, cause known and half-fixed. Attacks dispatched
   by a CO-BOSS (Seth's live in `obj_purple_enemy_Step_0.gml`) were kept from the
   boss scan with `setup: null`, throwing away the branch that does
   `dc.omega_ex_mode = true` and `scr_turntimer(480)`. The dedup now fills that
   gap FROM A CO-BOSS FILE ONLY — `setupSelf` — and the studio replays the branch
   as that monster. SupportFire and both Titan spawn-enemy attacks are fixed by
   it; the two OmegaBook rows still come out setup-less because their duplicate
   arrives by a different path, which is the next thing to trace.
   **Do not widen this rule.** Filling from any same-file duplicate was tried and
   measured: it handed queen_type3 and queen_type113 branches the scan had
   dropped on purpose and cost 10 assertions (211/211 -> 201/211).
2. **Flowery: 5 failures** that are NOT the 5px class — `spr_bamboo_wall` and
   `spr_flowery_vase` are never drawn (they go through `draw_sprite_part_ext`),
   and `obj_orangeheart_floweryjarona` appears where the branch says it should
   not.
3. Small clusters: tasque_manager 6 (quiz difficulty/turnspeed, and
   obj_tm_quizzap never spawning), lanino_elnina 4 (bullet count 10 vs 4-8),
   orange_green 2, yellow_blue 1 (box y off by 6).
4. **Palette swapping is implemented and correct but never fires in-fight.**
   Verified by pixel conservation on the LUT; a 20-attack ch3 sweep recorded
   zero binds. `obj_rhythmgame` disables its own palette branch on frame 1 when
   `bg_con == 1`, and `obj_actor_tenna` only swaps under `golden_mode`.
   Reachable != executed.

## Recovering from a crash

Both of the previous session's Claude processes died at the same minute. What
survived, and where:

- **Subagent transcripts** — `~/.claude/projects/<project>/<session>/subagents/`.
  A dead workflow's agents leave their full reasoning on disk even when the
  journal has no results.
- **The workflow journal** — `journal.jsonl`, one `{"type":"result"}` per agent.
  Check whether a result is an author's or a verifier's before reading meaning
  into it.
- **Scratchpad inputs** — the crashed session's `spec_targets.json` and
  `existing_specs.json` made the re-run cheap to set up.
- **Nothing uncommitted was lost**, because the work had been committed as it
  landed. That is the real lesson, and it is why agents in this session
  checkpoint their output to disk after every attack rather than at the end.
