# Roster synthesis — 16 contributed fights vs. the generator

**Measured against `scripts/gen_attacks.js` at md5 `8fe197911743cc86a5076f743c8f1225`,
974 lines / 48,535 bytes, mtime 2026-07-26 21:58:21.**

> ⚠️ `gen_attacks.js` was rewritten **during** this analysis — it grew from 860 to 974
> lines at 21:58 while I was measuring, adding roster-row variant fan-out, a
> `parseControllerCell()` prose parser, an `applyRosterRow()` folder, unreached-row
> emission, and `set` → `controllerSet` merging at dedupe time. Everything below is
> re-measured against the **new** version; where a capability I would otherwise have
> asked for is now present, it is marked **CLOSED**. Re-check section 3 against the
> current md5 before acting on it.

Method. Every claim was produced by **executing `gen_attacks.js` itself** in-process with
`fs.writeFileSync(OUT, …)` neutered, so nothing under `docs/` was touched, and inspecting
`final`, `boxSetups`, `turnSetups` and `notes` directly. Anchor checks additionally replay
`strip()`, `ifStatementEnd()`, `extractBoxBlock()` and `extractTurnBlock()` against the raw
GML. Nothing here is taken on trust from the roster `.md` files; where a `.md` disagrees
with what the generator produces, the generator wins and the disagreement is called out.

---

## 0. Validation results (all 16 rosters)

**Enemy objects — all pass.** All 16 `enemy` values and all 17 `extraEnemies` values exist
in the matching chapter's `objects.tsv`. Two `enemy` values are deliberately not
`obj_monsterparent` children and that is correct: `obj_elnina_lanino_controller` and
`obj_orange_green_controller` (both blank `parent`) are the fights' controllers, and
`monsterTypeOf()` correctly falls through to `extraEnemies` and resolves 61 and 113.

**Anchors — all pass.** Every `boxBlock.anchor`, `boxBlock.endAnchor`, `turnBlock.anchor`
and `turnBlock.endAnchor` in all 16 files appears **verbatim in the raw, unstripped
source**. Zero misses. Every `selectorScan.file` and every `extraAttackFiles` entry exists.
**Nothing needs rejecting or correcting for a bad anchor.**

Three anchors are non-unique in raw source; all three resolve to the intended line because
`indexOf` takes the first hit and the first hit is right — verified by line number:

| roster | anchor | raw count | resolves to | correct? |
|---|---|---|---|---|
| `flowery` | `scr_turntimer(90);` | 2 | Step_0:1178 | yes (1193 is a duplicated paragraph) |
| `kround` | `global.turntimer = 999;` | 3 | Step_0:94 | yes (160/299 are the milk cutscene) |
| `cround` | `global.turntimer = 1;` | 2 | Step_0:44 | yes (roster is excluded anyway) |

Several `endAnchor`s are very common tokens (`}` ×67 berdly, ×76 yellow_blue, ×126
aqua_seth; `if (!instance_exists(obj_moveheart))` ×3 flowery). All resolve correctly
because `indexOf(endAnchor, at)` starts at the anchor — verified by slicing.

**Slices — all pass.** All 14 extracted box blocks and all 11 extracted turn blocks are
brace- **and** paren-balanced, all 14 box blocks contain an `obj_growtangle` create, and —
the trap that broke the Knight — **not one box or turn slice contains a
`scr_bulletspawner`, an `instance_create(…obj_*bulletcontroller)` or an `event_user(N)`
call.** No double-spawn risk and no chooser re-roll risk anywhere in the set.

**Counts.** Emitted `inFight` now equals the roster JSON's own `real` count for **14 of 15**
listed fights (cround is correctly excluded with 0 real). The one mismatch is `tenna`
(14 emitted vs 13 declared — see §1).

| id | emitted | inFight | roster.real | boxSetup | turnSetup | entries with `selector: null` |
|---|---|---|---|---|---|---|
| aqua_seth | 9 | 9 | 9 | yes | yes | 0 |
| berdly | 10 | 10 | 10 | yes | **no** | 0 |
| chaosking | 11 | 11 | 11 | *n/a* | yes | 0 |
| flowery | 23 | 14 | 14 | yes | yes | 0 |
| jackenstein | 11 | 11 | 11 | yes | yes | 0 |
| kround | 4 | 4 | 4 | yes | yes | 0 |
| lancer | 7 | 7 | 7 | yes | yes | **7** |
| lanino_elnina | 5 | 5 | 5 | yes | yes | 0 |
| orange_green | 5 | 5 | 5 | yes | **no** | **5** |
| queen | 18 | 16 | 16 | yes | **no** | 0 |
| tasque_manager | 5 | 5 | 5 | yes | yes | 0 |
| tenna | 14 | 14 | 13 | yes | **no** | 0 |
| titan | 20 | 15 | 15 | yes | yes | 0 |
| watercooler | 1 | 1 | 1 | yes | yes | 0 |
| yellow_blue | 4 | 4 | 4 | yes | yes | 0 |

The counts are now right. **The remaining problems are all about what is attached to each
entry** — which `setup` slice, from which file, from which encounter, and whether the
studio will replay the box at all.

---

## 1. The one defect that matters most (NEW, introduced by the 21:58 rewrite)

### A roster row can override an entry's `type` without invalidating the scan's `setup`.

`applyRosterRow()` rewrites `a.controller`, `a.type` and `a.name` from the roster row, and
the fan-out at the variant expansion clones an entry per row — but the clone keeps the
**original branch's verbatim `setup` slice**. The unreached-row path is worse: it does
`setup: base.setup || null` where `base = roster.find(a => a.boss === j.id)` — literally
the boss's *first* entry, whatever that happens to be.

The studio replays `setup` **verbatim** with self = the boss. So an entry whose setup
spawns a different controller type launches the wrong attack **in addition to** the right
one. This is the same class of bug as the Knight's doubled controllers, and it is silent.

**Measured — 15 entries across 4 fights currently carry a setup that spawns the wrong type:**

| entry | its `type` | the type its `setup` actually spawns |
|---|---|---|
| `queen_type3` "Stomp" | 3 | **7.5** (`BerdlyFeather`) |
| `aqua_seth_type313` "SupportFire" | 313 | **308** (`KnifeChain`) |
| `aqua_seth_type306` "OmegaBook" | 306 | **309** (`FanOfKnives`) |
| `aqua_seth_type306_omegabookex` "OmegaBookEx" | 306 | **310** (`KnifePetal`) |
| `berdly_type10` "Chirashi (fight 2, d1)" | 10 | **9** (`SpearBlast`) |
| `berdly_type10_chirashi_fight` "Chirashi (fight 2, d0)" | 10 | **9** (`SpearBlast`) |
| `tenna_rhythmgame` … and 8 more declared Tenna rows | null / 150 | **125** (`all star cast`) |

Root cause is that rows are matched to scanned entries **by `choice` alone**, and `choice`
is not a unique key here: aqua_seth's choice 0 covers Aqua's `KnifeChain` *and* Seth's
`SupportFire` (two different enemies, one shared `myattackchoice` namespace); berdly's
`rr` 1 maps to `Chirashi` in fight 2 and `SpearBlast` in fight 1 (the two-hop
`rr` → `chosenattack` map is deliberately not the identity); queen's `Stomp` picked up
choice 3 from a `difficulty == 3)` backscan inside the `BerdlyFeather` case.

**Fix (G-A, top priority).** After `applyRosterRow()` changes `type` or `controller`, drop
the inherited `setup` unless it still contains a matching `.type = <newtype>` /
`instance_create(…<newcontroller>)`. One predicate, and it converts 15 wrong launches into
15 correct manual spawns. For the unreached-row path, `setup` should simply be `null` — an
arbitrary sibling's branch is never the right thing to replay.

---

## 2. Per-fight verdict

### READY — correct end to end today

| id | inFight | box | turn | notes |
|---|---|---|---|---|
| **jackenstein** | 11 | 2686ch | `scr_turntimer(200);` | exact; zero cut content in the fight |
| **titan** | 15 | 415ch | 105ch | exact, including the declared `obj_titan_heal` turn |
| **flowery** | 14 (of 23) | 2831ch | 18ch | exact real *and* cut split |
| **chaosking** | 11 | *none, by design* | `global.turntimer = 180;` | `selectorScan` + reconcile repair all 11 |
| **kround** | 4 | 154ch | 23ch | `selectorScan` + reconcile repair all 4 |
| **yellow_blue** | 4 | 1249ch | 18ch | exact |
| **watercooler** | 1 | 442ch | `scr_turntimer(200);` | exact |
| **lanino_elnina** | 5 | 331ch | 241ch | exact — *but see the prose-`set` defect below* |
| **tasque_manager** | 5 | 154ch | `scr_turntimer(140);` | counts exact — *but 3 of 5 come from a dead file* |

Details worth recording:

* **titan** — the `endAnchor: 'if (myattackchoice == 0)'` is doing exactly its job: the
  slice is 105 chars and contains no spawner. Without it there is no trailing
  `else scr_turntimer(N);` for `extractTurnBlock` to stop on, and the slice would run
  through the whole dispatcher and spawn a second controller every turn. The real/cut
  overlaps (type 456, choices 5 and 6) are **not** roster errors — `obj_titan_enemy` and
  `obj_titan_spawn_enemy` share a `myattackchoice` namespace, so 456 is real via the spawn
  while the boss's own choice-6 branch is cut, and 455 is cut for the mirror reason. The
  type-keyed auto `REAL` filter resolves both correctly. Not capturable, and worth knowing:
  `if (myattackchoice == 4 && phase == 8) global.turntimer = 240;` (Step_0:319-320) sits
  after `turns += 1`, outside every branch — choice 4 will run at 360 in the studio.
* **flowery** — the only roster that reproduces its `.md` exactly (14/9). Omitting
  `selectorVar` is load-bearing and correct: `attackAnnouncements()` records the intro dash
  tutorial (hard-spawned at Step_0:512-515) as `selector: "introtimer", choice: 21`, and with
  a `selectorVar` set the reconcile pass would rewrite the choice-21 `AquaKnives` entry
  (type 641) to type 637 — launching AquaKnives would replay the dash tutorial. Verified
  both ways. Also correct: the obvious anchor `if (!instance_exists(obj_growtangle))`
  appears **twice** in that file (Step_0:500 intro, :1112 real) and `indexOf` would take the
  intro one; the `mnfight == 1.5` gate is unique and carries the
  `obj_orangeheart_floweryjarona` create that **seven of the fourteen real attacks** depend
  on.
* **chaosking** — the scan reports `controller: obj_growtangle` for 6 of 11 branches
  (those build the box first); reconcile repairs every one. The `.md`'s "DEDUPE-KEY
  COLLISION" blocker is **stale**: the dedupe key includes `a.name`, and `selectorScan`
  names entries `attack 2 (type 1)` / `attack 5 (type 1)` / `attack 10 (type 1)`, so the
  three `obj_chainking` type-1 attacks survive as distinct entries. Measured 11 in, 11 out.
* **kround** — the `.md` correctly predicted `obj_shake` / `obj_regularbullet` as the
  mis-detected controllers and that leapmode 4 would be dropped (its window has no
  `instance_create`); both confirmed, and reconcile rewrites all four to
  `obj_checkers_leap` with `set = {leapmode: N}`.
* **yellow_blue** — the box anchor is the *healing-rain* condition, which looks wrong and
  is not: the growtangle create is that `if`'s `else if`, so the slice is the whole
  self-selecting chain. It is also fail-safe — with `obj_yellow_enemy` absent, or
  `global.monsterhp` unseeded, the guard is false/NaN and the box is still created.

### NEEDS WORK — configs are sound, attachment is not

**tasque_manager — CONFIRMED, and the sneakiest failure in the set.**
`readdirSync` returns `…_Other_24.gml` before `…_Step_0.gml`, so the dead 368-line
duplicate Step (user event 14, never called in ch2) wins the dedupe. Measured from the
emitted entries' `source`: `tasque_manager_type32`, `tasque_manager_type32_quizattack_doj`
and `tasque_manager_type3` all carry `gml_Object_obj_tasque_manager_enemy_Other_24.gml`.
The dead `QuizAttack` has `extraFields: []`; the live one carries `["element","special"]`,
`hasSpecial: true` and `difficulty: 4` — the studio's only handle on the encounter-89 dojo
variant, which the `.md` establishes is real shipped content behind `global.flag[642]`.
Needs **G1**.

**aqua_seth — CONFIRMED against the source.** `obj_aqua_enemy_Step_0.gml` contains both
encounters: the solo fight at `:391–473` (`if (fight_type == "solo")`) and the paired fight
this roster is about at `:474–541` (`else if (fight_type == "seth")`). Announcement names
*and* types are identical, so first-wins dedupe keeps the **solo** arm:

| entry | captured `scr_turntimer` | solo source | paired source |
|---|---|---|---|
| `type308` KnifeChain | 240 | `:400` = 240 | `:485/:487` = 260 on turn 4, else 240 |
| `type309` FanOfKnives | 240 | `:408` = 240 | `:495` = 240 |
| `type310` KnifePetal | 240 | `:416` = 240 | `:503` = 240 |
| `type300` OmegaKnife | **300** | `:424` = 300 | `:511` = **245** |

So OmegaKnife would run 55 frames long, KnifeChain would lose its turn-4 260, and the
paired arms' `knife_number 3/6` never gets set. Needs **G2**. Compounded by **G-A** (three
of Seth's entries also carry Aqua's setups).

**lancer / orange_green — the null-selector trap, still open.**
`DECLARED_FALLBACK` emits
`selector: (cfg.selectorVar && typeof r.choice === 'number') ? cfg.selectorVar : null`.
`lancer.json` has no `selectorVar`; `orange_green.json`'s choices are prose
(`"uppercut_life >= 1"`). Both therefore emit `selector: null` on **every** entry, and the
studio gates both replays on it:

```js
// docs/gml_studio.html:1736
const bossDispatched = !!(pendingAttack && pendingAttack.selector !== null
                          && pendingAttack.selector !== undefined);
// :1742  if (… && !isDate && bossDispatched)  → box block
// :1929  if (… && bossDispatched)             → turn block
```

**12 attacks across two fights get no battle box and no turn length**, despite both rosters
supplying verified, balanced, spawner-free blocks (154ch and 1005ch). For orange_green this
is fatal: its box block is the only caller of `scr_moveheart()`, so there is no soul either.
Needs **G9**.

**Prose written straight onto the controller — 19 values across 2 fights.**
`parseControllerCell()` (new) sanitises the `controller` cell, but `r.set` is folded in raw
and then merged into `controllerSet` at dedupe. Measured, currently shipping:

```
lanino_elnina  ×5   side    = "0 = Lanino favored, 1 = Elnina favored"     (must be 0 or 1)
orange_green   ×4   creator = "obj_green_enemy.myself" / "obj_orange_enemy.myself"
orange_green   ×3   creatorid = "obj_green_enemy.id"  ×3 target = "obj_*.mytarget"
orange_green   ×2   damage  = "global.monsterat[green] * 5 = 80"
```

`side` is the difference between Lanino-favoured and Elnina-favoured on **every one of that
fight's five attacks**. Needs a JSON fix in both rosters, plus **G10** so the next one is
caught automatically.

**76 declared turn lengths are silently ignored.** `applyRosterRow()` reads
`r.turnOverride` and `r.turn`. Only **berdly, kround and queen** use those names; the other
eleven rosters use **`turntimer`** — 76 numeric values, unread. Consequence: berdly, queen
and kround get per-entry `turnTimer`, while orange_green (270/360/500/615/999),
aqua_seth (245/244/180/300…), tenna, titan, jackenstein, flowery, lancer, chaosking,
yellow_blue and lanino_elnina do not. For the fights that also have no `turnSetup`
(berdly, orange_green, queen, tenna) this is the *only* source of turn length. Needs
**G4** — accept `turntimer` as an alias; one line.

**berdly — still one boss, and it is the wrong one.** `obj_berdlyb2_enemy` sorts before
`obj_berdlyb_enemy` (`'2'` 0x32 < `'_'` 0x5F) and is listed in both `extraEnemies` and
`extraAttackFiles`. Every scanned entry carries
`src = gml_Object_obj_berdlyb2_enemy_Step_0.gml` — **fight 2** — while the `boxBlock` is
sliced from **fight 1**, and the fan-out then labels three of them "(fight 1, …)". The
counts now look right (10/10) but the fights are mixed. Needs **G3**.

**tenna — 14 emitted vs 13 declared, and all 9 declared rows carry the wrong setup.**
The unreached-row path now emits the nine `PHYSICAL CHALLENGE` minigames with correct
`controllerSet` (`{shootout_type: 2, difficulty: 0}` etc., thanks to
`parseControllerCell()`), which is a real improvement. But every one of them inherits
`base.setup` = *all star cast*'s branch (spawns `obj_dbulletcontroller.type = 125`) — see
**G-A**. The extra 14th entry is the **cut** choice-20 `type 150` dispatch, which the
type-keyed auto `REAL` filter stamps `inFight` because 150 is also the real LIGHT 'EM UP
type; the two are now separate entries (`tenna_type150` and `tenna_type150_light_em_up_th`)
but the cut one is mislabelled. Needs a hand-written `REAL` entry (§4).

**queen — 16/16, which is a genuine win from the rewrite.** The variant fan-out recovered
every sub-type (2 ×3 tilt speeds, 6 ×2, 100/115/116, 106/107, 110/111, 112/113) from the
roster rows. Two residual issues: the emitted `selector` is `difficulty` on 8 of 18 entries
and `rtimer` on one, because the backward `<var> == N)` scan finds a `difficulty == N)`
inside the case body before the enclosing `case N:` is considered (the switch path at
`gen_attacks.js:361–375` is gated on `!cond` and so never runs); and `queen_type3` carries
`BerdlyFeather`'s setup (**G-A**). Wine still cannot be launched standalone — it stalls at
controller `init == 2` until the boss's `wineglasscon` 1→2→3 animation sets `init = 3`.

### DOCUMENTED ONLY — correct as shipped

**cround** — `real: []`, so the loader skips it with
`"[rosters] cround: 0 real attacks — documented only, not added"`; verified as the only
console line the roster directory produces at load. C. Round has no reachable attack: its
Step is a copy of `obj_heartenemy`'s with the bullet guard changed from `if (rr == 1)` to
`if (rr == 999)` while `rr` is still `scr_monsterpop()` (range 0–3), the growtangle create
and `scr_moveheart()` deleted, and the turn dropped to a literal `global.turntimer = 1`.
Its anchors are valid (turn slice = `global.turntimer = 1;`; the `rr` scan yields exactly
one entry, `999 → obj_spinheart type 0`, correctly skipping the `rr == 0` battle-message
hit) — they simply describe cut content. Leave it exactly as it is, and note that any
`REAL[]` judge added for it must return false for everything.

---

## 3. Ranked implementation order

Ranked by real attacks unlocked per unit of work. **G-A first — it is a correctness fix
for fights that otherwise look finished.**

| # | item | attacks | work | why here |
|---|---|---|---|---|
| **0** | **G-A** — invalidate inherited `setup` on type/controller override | fixes 15 | tiny | Nothing else should ship first. Queen, Tenna, Berdly and Aqua & Seth currently report correct counts while launching the wrong controller. A silently-wrong attack is worse than a missing one. |
| **0b** | **G4** — accept `turntimer` as an alias for `turn` | fixes 76 | one line | Eleven of sixteen rosters spell it `turntimer`. Four fights have no turn block at all, so this is their only turn length. |
| 1 | **watercooler** | 1 | none | Cheapest end-to-end proof that a contributed JSON lights up: plain red soul, stock box, one attack, no phases, no partner. Risk is transpiler-level only (`destroybulletid` assigned inside a `with`, raw sprite id 857). |
| 2 | **kround** | 4 | none | Already correct. Validates the `selectorScan` + reconcile path on ch1 dialect. |
| 3 | **chaosking** | 11 | none | Best ratio in the set. Engine gaps are enumerable: suppress the studio's default box (this fight has **no** `boxBlock` because every branch builds its own arena), teach `syncGrowtangle()` about `obj_nonsolid_growtangle`, add the event-less `obj_heartmarker`, reset `global.invc` per launch. |
| 4 | **yellow_blue** | 4 | none | Small and clean, and it forces two things every later ch5 fight needs: a positioned partner enemy, and an externally writable `obj_growtangle` (three attacks lerp/sine its scale and `y` directly). First fight where turn length matters *downward* — three attacks exit on `global.turntimer <= 20/30`. |
| 5 | **titan** | 15 | none | Complete, heal turn included. Engine: `surface_create(640,480)` for the hands manager, function-valued instance variables on `obj_darkshape_manager`, soft failure for its three undefined patterns. |
| 6 | **lanino_elnina** | 5 | JSON fix (`side` → 0/1) | Box and turn already replay. One data fix and it is done. |
| 7 | **tasque_manager** | 5 | **G1** | One config field buys three correct entries and the dojo quiz. Engine cost is the rotated 45° box, which is genuinely new: `obj_heart` confines by `place_meeting` against `obj_battlesolid`, so an axis-aligned box destroys the quadrant mechanic. |
| 8 | **lancer** | 7 | **G9** | Blocks are already verified; one flag turns 7 boxless attacks into 7 correct ones. Per-attack controller flags (`racecon`/`lcon`) already ride in `set`. |
| 9 | **aqua_seth** | 9 | **G2** (+ G-A) | Do not ship before both land — 4 of 9 are quietly the *other* encounter and 3 more spawn the wrong type. |
| 10 | **orange_green** | 5 | **G9 + G4** + JSON fix | Two cheap fixes and a data fix. Heavy engine: Draw-event-only attacks, damage routed through user events, surfaces, box sprite/mask swap. Also needs `monsterhp` seeded to 2060 before the box block, or the chain takes the healing-egg arm and never creates box or soul. |
| 11 | **queen** | 16 | **G-A + G4 + G5** | Counts are already right thanks to the fan-out; what remains is the setup leak, the turn table, and the switch-selector fix. Wine and the Ultimate are set pieces that cannot be launched standalone. |
| 12 | **berdly** | 10 (8 distinct) | **G3 + G-A** | Mechanical: the JSON already ships two ready-made configs under `fights[]`. Ship fight 2 first — fight 1's ACT is a real-time bumper-car minigame. |
| 13 | **jackenstein** | 11 | none | Zero generator work and 11 clean attacks, which is why it is not lower — but it is a ghost-house maze: GameMaker `path_*`, per-pixel solid collision against the maze artwork, a darkness renderer, and turns that end on a collision. Park until the engine has paths and mask collision. |
| 14 | **tenna** | 13 | **G-A + G10** | Nine of thirteen are whole minigames (rhythm chart, kitchen, cowboy layers, susiezilla sub-world). The three bullet attacks work today and could ship alone. |
| 15 | **flowery** | 14 | none | Perfect extraction; ~4000 lines of orange-soul runtime before a single attack renders, plus a three-engine finale and missing room data. Last. |
| 16 | **cround** | 0 | none | Nothing to launch. |

**Suggested first slice:** G-A + G4, then fights 1–5 (`watercooler`, `kround`, `chaosking`,
`yellow_blue`, `titan`) — **35 real attacks, two small generator fixes.**
**Second slice:** G1 + G9 + the two JSON fixes unlocks `lanino_elnina`, `tasque_manager`,
`lancer` and `orange_green` — another **22**.

---

## 4. Generator capabilities required (deduped)

Ordered by cost. **CLOSED** = implemented by the 21:58 rewrite; listed so nobody re-does it.

**G-A. Invalidate an inherited `setup` when a roster row overrides `type`/`controller`.**
*Open. Highest priority.* After `applyRosterRow()` changes `a.type` or `a.controller`, drop
`a.setup` unless it still contains a matching `.type = <newtype>` or
`instance_create(…<newcontroller>)`. In the unreached-row path, set `setup: null` outright
rather than `base.setup` (`base` is the boss's arbitrary first entry). *Fixes 15 measured
entries across queen, aqua_seth, berdly and tenna, all of which currently replay a branch
that spawns a different controller type.* Cost: one predicate.

**G1. `excludeFiles: ['…']` on a BOSSES entry.**
*Open.* Skip named event files in the announcement scan. *Needed by:* tasque_manager
(`gml_Object_obj_tasque_manager_enemy_Other_24.gml` — a dead duplicate Step that
`readdirSync` sorts ahead of the live `Step_0`, currently winning three entries and
stripping the dojo quiz's `special`/`difficulty 4`). Cost: one `.filter()`.

**G2. Announcement-scan scoping — `scanFrom` / `scanTo` verbatim anchors per file, or
`preferLast: true`.**
*Open.* One event file can hold two complete copies of a dispatcher, one per encounter.
*Needed by:* aqua_seth (`fight_type == "solo"` at `:391–473` shadows
`fight_type == "seth"` at `:474–541`; identical names and types, so first-wins picks the
wrong encounter and OmegaKnife runs 300 instead of 245). Cost: small.

**G3. `fights: [ … ]` — one roster JSON producing several BOSSES entries.**
*Open.* Each with its own `enemy`, `boxBlock`, `turnBlock`, `extraEnemies` and `REAL`
filter. *Needed by:* berdly (two encounters; fight 2 currently shadows fight 1 while the
box block comes from fight 1). *Would also serve:* lancer (three encounters), aqua_seth as
an alternative to G2. Cost: medium — mostly a loop around the existing per-boss body.

**G4. Accept `turntimer` as an alias for `turn` / `turnOverride`.**
*Open, one line.* `applyRosterRow()` reads only `r.turnOverride` and `r.turn`; eleven of
sixteen rosters spell it `turntimer`, so **76 numeric turn values are ignored**. Critical
for the four fights with no `turnSetup` at all (berdly, orange_green, queen, tenna), where
it is the only source of turn length.

**G5. Switch-dispatch selector resolution.**
*Open.* The `case N:` → `switch (var)` path at `gen_attacks.js:361–375` exists but is gated
on `!cond`, and `cond`'s backward `<var> == N)` scan finds a `difficulty == N)` *inside* the
case body first — so the path never runs. Prefer an enclosing `case N:` over a `<var> == N)`
that lies within the case body. *Needed by:* queen — 9 of 18 entries carry `difficulty` or
`rtimer` as their selector instead of `rr`, and the studio writes that variable onto the
boss to pick the branch. Cost: medium.

**G6. Variant fan-out — one entry per roster row when a choice covers several attacks.**
**CLOSED** by the 21:58 rewrite. Recovered Queen's nine sub-types (2/2.1/2.2, 6/6.1,
100/115/116, 106/107, 110/111, 112/113) and Berdly's per-fight difficulty variants.

**G7. Declared rows merged with scanned rows, controller optional.**
**CLOSED** by the "rows whose choice the scan never reached" pass. Recovered Titan's
`obj_titan_heal` turn replacement, Orange & Green's HEALING EGG, Queen's `type113`/`type111`
and all nine Tenna minigames. *Caveat:* each of those rows inherits `base.setup` — see G-A.

**G8. `controllerSet` honoured on the declared path.**
**CLOSED** — `set` is now merged into `controllerSet` at dedupe (`a.controllerSet =
Object.assign({}, a.controllerSet || {}, a.set)`). Verified: lanino_elnina's entries now
carry `difficulty: 0`, Tenna's carry `{shootout_type: 2, difficulty: 0}`, etc.

**G9. A declared entry must be able to request box/turn replay.**
*Open.* `gml_studio.html:1736` gates both replays on `selector !== null`, and
`DECLARED_FALLBACK` emits `selector: null` whenever the roster has no `selectorVar` or the
`choice` is non-numeric. **12 attacks (lancer ×7, orange_green ×5) get no box and no turn
length**, despite both rosters supplying verified blocks — and orange_green's box block is
the only caller of `scr_moveheart()`, so those five also get no soul. Fix by emitting a
synthetic selector, or by adding `replayBox` / `replayTurn` flags and widening the studio
gate to `bossDispatched || replayBox`. Cost: small on both sides.

**G10. A roster validator, printed with `notes`.**
*Partly open.* `parseControllerCell()` now sanitises the `controller` cell (Tenna's
`"obj_rhythmgame (tenna_boss = true, turn_length = 360)"` correctly becomes
`obj_rhythmgame` + `{tenna_boss: true, turn_length: 360}`) — but `r.set` is still folded in
raw, so **19 prose values are currently written onto controllers** (lanino_elnina `side` ×5,
orange_green `creator`/`creatorid`/`target`/`damage` ×14). Add, per roster: anchor found /
occurrence count / slice brace- and paren-balanced / slice free of `scr_bulletspawner` and
`event_user(` / every `real` row's `type`-or-`choice` present in the emitted entries /
every `set` and `controllerSet` value numeric or boolean / every `controller` matching
`/^obj_[a-z0-9_]+$/` / every emitted `setup` containing its own entry's type. That last one
*is* G-A's check, reported instead of enforced. Cost: small, pays for itself immediately.

### Not generator work — engine prerequisites, recorded so they aren't misfiled as bugs

* **`suppressDefaultBox`** — chaosking has `boxBlock: null` deliberately (all eleven
  branches build their own arena); the studio's default growtangle pre-create at
  `gml_studio.html:1785–1789` must be skipped or six attacks get two boxes.
* **A seed hook before the box replay** — orange_green's growtangle create is the *third*
  arm of a chain testing `global.monsterhp[i] < global.monstermaxhp[i] * 0.7`; unseeded,
  the chain takes arm 1, sets `healing_egg_con = 1`, and never creates box or soul. Seed
  `2060/2060` on both enemies first.
* **Turn length is a ceiling, not a duration** — lancer, flowery, tenna, jackenstein and
  titan all contain attacks that end themselves by writing `global.turntimer` directly.
  The studio's 90-frame *floor* is fine; a *clamp* would not be.

---

## 5. `REAL` filter entries

The auto-derived filter (type-keyed, then choice-keyed, then controller-keyed) is
**correct for 14 of the 15 listed rosters**, including every real/cut *type* overlap that
resolves correctly (titan 456, chaosking 2/3, lanino_elnina 130, watercooler 135,
orange_green 131, lancer 24, berdly 8) and the real/cut *choice* overlaps that never
collide in practice (queen, tasque_manager, titan 5/6). Verified by running it.

Two need a hand-written entry, which wins because of the `if (REAL[j.id]) continue;` guard:

```js
  // ── Contributed rosters the auto-filter cannot judge ─────────────────────

  // TENNA. Type 150 is dispatched three times: LIGHT 'EM UP
  // (obj_tenna_zoom_Other_11.gml:358-377, reached only through minigame
  // insanity), the sharpshoot test (Other_11:251-267), and a CUT standalone
  // branch (obj_tenna_enemy_Step_0.gml:609-615, myattackchoice == 20, which no
  // chooser ever selects). Since 150 is in realTypes the type-keyed auto filter
  // stamps the CUT one inFight too — measured: tenna_type150 carries
  // source=obj_tenna_enemy_Step_0.gml, selector=myattackchoice, choice=20.
  // Judge by id/name so the cut dispatcher branch is visibly cut and the nine
  // declared PHYSICAL CHALLENGE rows stay in.
  tenna: a => ['tenna_type125', 'tenna_type126', 'tenna_type128'].includes(a.id)
    || /^PHYSICAL CHALLENGE|^LIGHT 'EM UP/.test(a.name || ''),

  // AQUA & SETH. Every emitted entry is currently inFight, but four of them
  // (types 308/309/310/300) carry the SOLO encounter-220 setup from
  // obj_aqua_enemy_Step_0.gml:391-473 rather than the paired encounter-223
  // setup at :474-541 — identical names and types, so first-wins dedupe picks
  // the solo arm, and OmegaKnife would run 300 frames against the paired
  // fight's 245. Until G2 lands, judge on SOURCE so the mis-sourced entries are
  // visibly cut rather than silently wrong. DELETE this once G2 (and G-A) land
  // and let the auto filter take over — all 9 are genuinely real.
  aqua_seth: a => a.source === 'gml_Object_obj_purple_enemy_Step_0.gml'
    || [311, 312].includes(a.type),
```

And one that becomes necessary the moment **G3** splits berdly:

```js
  // BERDLY. Two encounters share three controller types (8 Tornado,
  // 9 SpearBlast, 10 Chirashi) and obj_berdlyb2_enemy sorts before
  // obj_berdlyb_enemy ('2' 0x32 < '_' 0x5F), so every scanned entry is
  // fight 2's while the boxBlock is sliced from fight 1. All three types are
  // real in BOTH fights, so the auto filter is not wrong — it is meaningless
  // until G3 splits this into berdly_coaster / berdly_snowgrave. After the
  // split, give each its own one-liner:
  //   berdly_coaster:   a => [8, 9, 10].includes(a.type),
  //   berdly_snowgrave: a => [8, 9, 10].includes(a.type),
```

No hand entry is needed for: chaosking, cround (excluded), flowery, jackenstein, kround,
lancer, lanino_elnina, orange_green, queen, tasque_manager, titan, watercooler,
yellow_blue — all verified correct under the auto filter by running it.
