# Overnight fidelity pass — what happened

**Branch:** `studio-fidelity-overnight` (branched from `main` at `91969ca`).
`main` is untouched. Restore point is `62683237`; every change since is a
separate commit you can revert individually.

**Server:** `node scripts/serve.js` → <http://localhost:8399/gml_studio.html>

---

## The headline

**The measurement harness was lying, and it had been lying for several rounds.**

The night's plan was "diff what the GML promises against what the engine does."
The first three things that diff found were defects in the *diff*, not the
engine. That matters more than any individual fix, because every "145/147 clean"
in the old notes was produced by an observer that could not see whole categories
of behaviour.

### 1. The probe was starving Draw events

`VISUAL_PROBE.stepTo()` ran N steps and drew **once**, at the end. GameMaker runs
Draw every frame — and **Deltarune creates objects from Draw events**.
`obj_gerson_green_chevron`'s Draw is what spawns `obj_spearblocker`, the shield
that every green-soul spear is aimed at.

So under the probe the shield never existed, all 18 of Gerson pattern 20's
`scr_spearshot(..., special 14, ...)` rows found `i_ex(obj_spearblocker)` false,
and the attack fired into nothing.

| | before | after |
|---|---|---|
| Gerson green20 spears | **0** | **36** |
| green21 | 0 | 14 |
| green50 | 0 | 24 |

This is also why the baseline had dozens of green patterns with byte-identical
ink profiles — I nearly filed that as "the `attackpattern` selector isn't
differentiating," which would have been a hunt through correct code. The only
thing the probe ever let those attacks draw was the furniture.

### 2. Measurements were machine-speed dependent

Both probes wait ~350ms after launching for sprite bitmaps to decode. The
studio's live rAF loop kept running through that wait, so "frame 8" meant "frame
8 plus however many frames this machine got through." Most visibly
`global.turntimer` read ~11 short (350ms at 30fps), failing **32 turn-length
assertions that were all correct**.

### 3. Pausing had to stop drawing too

Deltarune mutates state in Draw — `obj_dbullet_vert` fades itself in with
`image_alpha += 0.1` from its Draw. A paused-but-still-drawing loop kept
advancing the game ~20 free Draw passes during the settle: Jevil's type 25 spades
read `image_alpha` **3.8** where Create sets 0.

> The lesson is the one this project keeps relearning in new clothes: **a check
> that is wrong in the same direction as the thing it checks reports success.**

---

## Real engine bugs found and fixed

All verified against source, all with the full battery green afterwards.

1. **`instance_exists()` disagreed with `with`, at 392 call sites.**
   The soul *is* a real `obj_heart` instance but is kept out of the stepped list,
   and `getInstances()` aliased it while `instance_exists()` scanned `instances`
   by name. `obj_heart.x` read fine; `instance_exists(obj_heart)` was **false** —
   skipping every one of 172 `i_ex(obj_heart)` + 220 `instance_exists(obj_heart)`
   guarded blocks in the corpus. Identical to the trap Round 8 fixed for
   `obj_growtangle`. The soul aliases were also masking **real** objects:
   `obj_heart_follower` is an object the Knight's Stars attack spawns.

2. **Blend factors, the dest-alpha family** — derived from
   `result = src*srcFactor + dst*dstFactor`:
   - `(7,8)` → `source-atop`. Deltarune's mask-clipping idiom
     (`scr_draw_in_mask`, `scr_draw_in_box_begin`); as `source-over` the mask did
     nothing and content drew everywhere.
   - `(7,7)` → `source-atop`. `obj_roaringknight_boxsplitter` tiles a flow
     texture through a slash shape. Keeping the clip loses the additive glow;
     `lighter` would flood the surface and destroy the shape.
   - `(8,7)` → `destination-over`. `obj_purplecontrols` lays its purple field in
     **behind** the lane grid; as `source-over` it painted over and hid it.

3. **`surface_copy` / `surface_copy_part`** implemented — 15 call sites that had
   been returning 0, so every surface snapshot was empty.

4. **`sync_sprites` rejected art that was correct on the axis that mattered.**
   Requiring *both* dimensions to equal the declared frame kept the export's
   68×315 `spr_gerson_swing_down_telegraph` over NEW RIP's 80×360 — leaving
   Gerson's swing telegraph **45px (12.5%) short** on the axis you read to dodge.

5. **The studio ran every attack on DIFF 1.** The header select had
   `<option value="1" selected>`. The game's own default is **0**:
   `obj_dbulletcontroller`'s Create sets `difficulty = 0` (line 21), and so does
   `obj_spamton_neo_enemy`'s (line 54). So every attack had been taking its
   *harder* branch — Spamton NEO's HeartAttackNeo took the
   `rr == 2 && difficulty == 1` path for turntimer 850 instead of 750, and the
   Knight's boxsplitter and rotating slash both read difficulty 1 where the
   source says 0. Now defaults to 0; DIFF 1/2 remain selectable.

6. **Spamton NEO's turn lengths are applied again.** Only the Knight had a
   `turnBlock` because `extractTurnBlock()` was hard-coded to the Knight's
   shape — it required a trailing `else scr_turntimer(N);`. Spamton's ladder is
   a flat default followed by `if (rr == N)` overrides, ending at `turns += 1`.
   The extractor now accepts an `endAnchor`, and SNEO has a turn block.
   Verified live: 260 / 850 / 330 / 300 where all eight previously read 120.

   **A spec was wrong here, and the source settled it.** `scr_turntimer` only
   RAISES (`if (global.turntimer < arg0) global.turntimer = arg0`), so
   `if (rr == 5) scr_turntimer(90)` *after* the 260 default is a **no-op** —
   PipisExplosion really does get 260, not the 90 the spec claimed. Replaying
   the block verbatim gets that right without anyone having to notice.

8. **Every Knight attack was spawning its controller TWICE.**
   `extractTurnBlock` anchors the Knight's turn ladder on
   `if (myattackchoice == 7)` — but that string appears **twice** in
   `obj_knight_enemy`'s Step: first as combinationattack's *dispatcher* branch,
   then ~170 lines later as the first arm of the actual turn-length ladder.
   `indexOf` took the first, so the extracted "turn block" was **5,027
   characters starting at the dispatcher**, containing four
   `scr_bulletspawner(x, y, obj_dbulletcontroller)` calls. The studio replays
   that block, so a second controller was created on every launch.

   Symptoms this explains at once: `obj_knight_swordfall` live=2 where the
   source says one, `obj_fallingsword` at 14 where the chart says 6-8,
   `obj_tracking_swords_manager` doubled, and `local_turntimer` reading ~60
   frames stale because a second copy had been stepping all along. It is very
   likely also the "two chevrons and two shields" I had flagged on Gerson.

   The anchor now only accepts an occurrence with `scr_turntimer` within 80
   characters — i.e. one that actually introduces a turn ladder. Block went
   5,027 → 976 chars. Verified: one controller, one swordfall, one manager, one
   cone per launch, and the `global.turntimer = 999999` pins on types
   105/107/108 finally apply (999996 at frame 3, previously stuck at 240).

   **Found because Landon asked about shader work on the Stars cone** — chasing
   that led into the Knight's turn handling.

7. **Parent-typed instance queries were a no-op — the biggest one.**
   In GameMaker, naming an object in `with`, `instance_exists`,
   `instance_number` or `place_meeting` selects that object **and every
   descendant of it**. `getInstances()` matched `object_name` exactly, so every
   parent-typed query in the corpus returned nothing:

   | parent | refs | what broke |
   |---|---|---|
   | `obj_battlesolid` | 255 | `obj_growtangle`'s parent — the battle box was invisible to `with (obj_battlesolid)` **and to the soul's containment `place_meeting`** |
   | `obj_bulletparent` | 146 (40 children in ch3) | what `obj_battlecontroller` clears at turn end, so bullets were never torn down |
   | `obj_monsterparent` | 206 | every query against the boss's parent type |

   Fixed with memoised ancestor sets. Deliberately *no* "does this parent have
   children" cache — that would be an answer about a world that changes every
   time something spawns.

   Verified: `obj_battlesolid` now resolves to `obj_growtangle@320,170`,
   `obj_bulletparent` matches 11 live instances, and Jevil's `obj_spadering`
   spawns at **320,170** exactly as its spec asserts (it read 320,240 before).

---

## New tooling

- **`docs/js/spec_check.js`** — the oracle. Diffs GML promises against engine
  behaviour as numbers, per attack. Every assertion cites the `file.gml:line` it
  came from, so a failure can be argued with. Kinds: `spawns` / `absent` /
  `count` / `pos` / `ivar` / `sprite` / **`draw`** / `box` / `turntimer`.
- **The `draw` kind is the one you asked for.** You were right that the GML is
  the visual oracle: it states not just *that* a sprite is drawn but *where, how
  big, how rotated, how transparent*. `draw` asserts those directly, so "visually
  correct" is checkable from source with no reference footage.
  `await SPEC_CHECK.draws('<id>', <frame>)` in the console dumps what an attack
  actually drew on a frame.
- **`docs/SPEC_AUTHORING_BRIEF.md`** — the contract specs are written to.
- **`scripts/build_attack_specs.js`** — merges spec workflow output, validates
  every assertion against the vocabulary, drops vacuous ones loudly.
- **`scripts/audit_trimmed_sprites.js`** — quantifies the trimmed-PNG gap.

**Current spec suite: 621/768 assertions passing across 59 attacks.**

---

## Diagnosed precisely, deliberately NOT fixed

I stopped short on these rather than half-land them at the end of a long session.
Each is pinned to a line.

1. **Jevil, Gerson and Pink still have no `turnBlock`.** (Knight and Spamton NEO
   now do — see fix 6 above.) Four Jevil attacks fall back to the studio's
   90-frame floor against a real 240.
   *Why I didn't just add Jevil's:* his `global.turntimer = 240`
   (`obj_joker_Step_0.gml:267`) sits inside a block that also runs
   `event_user(5)` and `rr = choose(...)` — his own attack chooser. Replaying it
   wholesale would override the roster's pick, the exact trap the notes record
   for the Knight's `event_user(0)`. It needs a narrow anchor and verification,
   which is a change to make awake.

2. ~~The battle box is misplaced for Jevil and Gerson.~~ **I WAS WRONG — and
   the real cause turned out to be much bigger. See fix 7 below.**

   The boxes were always in the right place (Jevil 320,170; Gerson 320,170;
   Knight's slit 168,170). What was broken was `obj_battlesolid`, the box's
   PARENT, which had no instances at all — so everything positioned relative to
   it fell back to the canvas centre and read as "the box is at y=240".

   *Caveat still worth keeping:* "the box is always at y=170" is too broad.
   Knight `myattackchoice 13` (sword tunnel new) creates its growtangle at
   `cameray() + 190`. Check the attack's own branch before calling a non-170
   box a bug.

3. **Centre-origin trimmed sprites are drawn half-a-trim off.**
   `gml_asset_db.drawSprite` ends in `ctx.drawImage(img, -ox, -oy)`, anchoring a
   *trimmed* bitmap's top-left on the *full-frame* origin. `spr_donut_bullet` is
   declared 48×50, origin (24,25) — the exact centre — and ships as a complete
   24×25 donut, so it renders a **full half-sprite up-left**. **277 shipped
   frames** have a centre origin and are trimmed.
   *Why I didn't fix it:* `maskGeom` in `gml_helpers.js` uses the same declared
   origin, so draw and collision currently **agree with each other** while both
   being offset. Changing the draw alone desynchronises them — both must move
   together, then be proven against the full baseline.

4. **Knight types 102/107/108** pin `global.turntimer = 999999` inside the
   controller branch (not the boss ladder); engine reads 240.

---

## Measured state

| Check | Result |
|---|---|
| Semantics | **34/34** |
| Compile | **154/154** (0 GML parse, 0 JS syntax) |
| Visual probe | **146/147 clean** (was 145) |
| Runtime | **154/154** clean, 0 errors, 0 hard failures |
| Spec suite | **1635/1846** assertions (88.6%), **49 of 142** attacks fully clean |
| Native call-site coverage | 99.27% |

Spec suite progression through the night, each step a real fix:

| after | passing | failing | clean attacks |
|---|---|---|---|
| first run (59 attacks) | 567 | 201 | 1 |
| freeze the live loop | 619 | 149 | 8 |
| pause stops drawing | 621 | 147 | 8 |
| SNEO turn block + DIFF 0 | 646 | 122 | 14 |
| + Gerson's 82 green charts (141 attacks) | 1627 | 208 | 49 |
| + triage corrections (142 attacks) | 1630 | 216 | 48 |
| + parent-chain fix | **1635** | **211** | **49** |

Pass rate by assertion kind, after triage:

| kind | passing | note |
|---|---|---|
| `absent` | 122/122 | |
| `count` | 147/148 | |
| `sprite` | 110/111 | |
| `box` | 47/50 | |
| `spawns` | 375/394 | |
| **`draw`** (visual) | **164/183** | the new visual oracle |
| `ivar` | 608/734 | |
| `pos` | 28/45 | hardest to assert; most remaining are real |
| `turntimer` | 29/59 | **got worse on purpose** — see below |

`turntimer` went 30/45 → 29/59 because triage *added* 14 turn-length assertions
for Jevil, Gerson and Pink. They fail because those three bosses still have no
`turnBlock` (open item 1). That is the suite correctly describing a known engine
gap rather than hiding it, and it is exactly what a fix list should do.

**The specs survive adversarial re-reading.** A triage pass re-opened every
cited line and returned **344 KEPT, 12 FIXED, 2 DROPPED** — so the large
majority of remaining failures are *engine*-wrong, not spec-wrong. That is the
list to work from.

The `draw` oracle earned its place on its first run: it caught
`spr_gerson_swing` never being drawn on frames the source says it should be, and
`spr_spearblocker` rendering at yscale 0.67 where the chart says 0.6.

Some of the remaining 122 are *specs* that are wrong, not engine faults — the
`scr_turntimer` max-clamp case above is a proven example. A triage pass
(`spec-triage` workflow) is re-validating every assertion against its cited line
so that what remains is engine-wrong by construction.

The single visual flag is `pink_type210`, which destroys its own battle box on
purpose. Jevil's BYE BYE stopped flagging once the observer was fixed.

`docs/js/visual_baseline.json` was **regenerated** after the observer fixes. The
previous baseline measured a broken observation — do not compare against it.

> **One housekeeping item:** the DIFF 1→0 fix landed after that file was
> written, and legitimately moved 20 attacks (they now take their correct
> *easier* branches — `pink_type202` drops sharply because
> `obj_huge_anime_face` and `obj_pink_battlemovement` only spawn on the
> difficulty-1 path). `localStorage` holds the current baseline; to refresh the
> disk copy, run this in the studio console and paste the result over the file:
> ```js
> await VISUAL_PROBE.runAll().then(r => { const d={}; for (const x of r.results) d[x.id]=x.captures.map(c=>c.inkPct); return JSON.stringify(d); })
> ```

---

## Two things I got wrong, corrected

Recording these because both were *my* errors, and the second nearly became a
wrong entry in this file:

1. **"Jevil's box is at y=240, Gerson's is 60px off in x."** Wrong. Both boxes
   were always at 320,170. Their PARENT `obj_battlesolid` had no instances, so
   everything positioned relative to it fell back to the canvas centre. Finding
   that turned a wrong bug report into the largest fix of the night.
2. **"The parent-chain fix caused a performance regression."** Wrong. The
   runtime suite has always run past 600s — the very first invocation this
   session, before any change, timed out identically. I had also stacked three
   copies of it concurrently, and its stdout is BUFFERED when redirected, so a
   file that looked frozen at 178 bytes was simply un-flushed. The hunt still
   paid for itself: it exposed a real O(depth²)-with-allocations walk in the
   new code, now fixed.

## What still needs your eyes

Nothing here is verifiable from source alone:

- **Fonts are genuinely absent from the export** — no `fonts.tsv` in any REFDATA
  chapter, no font directory in any EXPORT chapter. Text renders and the
  typewriter works, but glyph metrics are a substitute face. This cannot be
  fixed without font data.
- **`pink_date3` reaches 100% ink at frame 180** — a full-screen wash. Could be a
  correct scripted transition; I could not tell from source.
- **`knight_type107` (Roaring) drops to 0.15% ink at frame 90** then 99.38% at
  180. Plausibly the documented build-up-then-flood, but worth one look.
- **Two chevrons and two shields** spawn per Gerson green attack where I'd expect
  one each. May be correct (the pattern re-arms), may be a double-replay.
- **`pink_date1` ink dropped from ~52% to ~26%** after the parent-chain fix.
  The date still renders correctly (portrait, dialogue, HP hearts, timer bar —
  verified by eye earlier), and the likely cause is masking finally clipping the
  backdrop instead of letting it cover the frame. But it is a large change and I
  could not confirm from source which is right, so give it one look.
