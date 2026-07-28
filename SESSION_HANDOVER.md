# Handover — the recursive audit-fix loop, 2026-07-28

Picks up from `OVERNIGHT_HANDOVER.md`. That session ended at `3e2485e6`; this one
runs from `60373208` to HEAD.

## Start here

```bash
node scripts/serve.js          # -> http://localhost:8399/gml_studio.html
```

Verification chain, from the repo root. All four must be green before a commit:

```bash
node scripts/test_compiler.js   # 154/154, 0 GML parse errors, 0 JS syntax errors
node scripts/test_semantics.js  # 34/34
node scripts/test_runtime.js    # hard failures: 0  (and now clean: 154/154)
node scripts/test_engine.js     # SUCCESS, 7 instances — sets NO exit code, read it
```

In the browser (front the tab; `SPEC_CHECK.load` MUST take the array):

```js
SPEC_CHECK.load(window.ATTACK_SPECS)
await SPEC_CHECK.runAll('knight')          // per boss, never the whole roster
r = await VISUAL_PROBE.runAll()
await VISUAL_PROBE.saveBaselineToDisk(r.results)   // NEW: writes the file, not just localStorage
```

## What was wrong, and what it cost

**The synthesized Draw fallback recursed forever.** The previous session's last
commit added a fallback that defers to an inherited Draw, and found the parent
with `Object.getPrototypeOf(Object.getPrototypeOf(this))`. That is computed from
the *instance*, so it yields the same prototype at every level and never
advances: when two objects in one chain both landed on it, the parent's copy
called itself. 1377 RangeErrors per 60-frame sweep across 28 presets in Spamton
NEO, Gerson and the Roaring Knight. Masked, because `runtime.draw` catches and
falls back to `drawSelf` — bullets still drew their sprite while every inherited
Draw behaviour was silently lost. `super.draw` is the construct that walks up one
level per class.

**The Pink `instance_create_depth` mystery was a dropped argument.** Not a
precedence question at all. `createInstance`'s 4th parameter applies the depth
before Create; the JIT wrapper declared three parameters and forwarded three, so
that path was unreachable and "before Create" meant "never applied". Depths fell
back to the object table, `obj_marker`'s entry is 0, and Pink's two full-screen
black backgrounds (`obj_pink_enemy` Create_0:8,13, made at `depth+999` and
`depth+9999`) came forward over everything — a black screen still issuing ~1100
sprite draws with no error. `flight_recorder.js` had the same defect.
**Wrap engine methods with `.apply(this, arguments)`.**

**77 of 194 attacks ran on an invented 90-frame turn.** Six fights had no turn
block. Two were derived and survived an adversarial audit (Gerson
`scr_turntimer(999)`, Pink `scr_turntimer(300)`); four were rejected with reasons
— Queen and Orange & Green admit no valid slice (every one contains the Knight
trap, and Orange & Green's also writes the fight's own selector), Tenna's carries
`minigametransition_con = 1` which gates off LIGHT 'EM UP's bullet generation.
Separately, `gen_attacks` had been emitting 47 per-attack turn values that
**nothing read**. Coverage is now 193/193.

**Every probe run launched twice.** Both probes dispatched `change` on
`#presetSelect` *and* clicked `#btnTranslate`; the change handler already ends in
`translateAndPlay()`. Sweeps ran at half speed and measured the second spawn.

## Current state

- Turn lengths: **193/193** attacks have a real one; 0 on the invented floor.
- `test_runtime`: **154/154 clean** (was 113/154).
- Natives: stubbed builtins **70 -> 58**; unresolved calls in the 194-attack
  closure **396 -> 323**, distinct names **96 -> 74**.
- Roster: 294 entries, **193 in-fight / 101 cut** (Tenna corrected 14 -> 13).

## Traps worth keeping

- **A slice is not a pass.** Use `verify_turnblock.js`-style checking: a turn
  block must set the clock and have NO other side effect. The Knight trap is a
  slice containing `scr_bulletspawner` (spawns a second controller); the Jevil
  trap is one containing the boss's own `event_user` attack chooser.
- **Check the corpus before fixing a "gap".** Constructor inheritance
  (`function A() : B() constructor`) genuinely failed to parse — and appears
  **zero** times in all five chapters; an apparent 344 uses was a regex matching
  ternaries. `#macro Config:NAME` likewise: zero uses, left unfixed on purpose.
  Template strings `$"{x}"` were worth it: 78 across 41 files.
- **Prefer a script over a builtin only when the builtin is HOLLOW.** 109 names
  are both a shipped GlobalScript and a `BUILTIN_FN`; for 106 the native is what
  we want (`__view_get` is a GM 2.2->2.3 compat shim this engine deliberately
  bypasses). `GML_STUBBED_BUILTINS` records which are return-0 stubs.
- **Suspect the checker.** `pink_type210 NO_BOX` was the sixth case of a correct
  engine looking wrong — it is dispatched inside `obj_date_controller`, which
  never creates a growtangle, so it correctly has no box.

## What is still open

1. **135 of 193 in-fight attacks have no fidelity spec.** `attack_specs.js`
   covers only the 5 original bosses. `VISUAL_PROBE` gives those 135 liveness and
   render coverage (BLANK/STATIC/WASH/NO_BOX) — it does **not** prove any of them
   is pixel- or mechanically correct. This is the single biggest gap.
2. **Native clusters still unimplemented**, ranked by real reach: palette-swap /
   shader (38 calls — `scr_retro_pal_swapper`, Tenna's channel change: no palette
   swap happens at all), `animcurve_*` (10, `obj_ripples`), audio streaming (11).
   The ch3 vertex-buffer cluster (34 calls) reaches ONE attack — `obj_rhythmgame`
   uses `scr_perspective_shadow_ext` for shadows; every other quad-draw function
   in that file has zero callers.
3. **`scr_text` (27 calls) is pruned on purpose** — 616 KB of dialogue. Battle
   dialogue content is empty everywhere while the typewriter works. Do not let it
   head a gap list.
4. **Turn-replacement fights need an ACT driver** to be playable end to end:
   C. Round's three ACT turns, Orange & Green's HEALING EGG, the Tenna minigames.
5. **Gerson's 999 is a ceiling, not a duration.** His turn ends dynamically when
   the chart drains (Step_0:1060-1063 cuts the clock to 10). The studio has no
   equivalent, so his attacks run long with dead air at the tail.
