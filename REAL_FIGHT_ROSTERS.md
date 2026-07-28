# The REAL fight rosters — derived from the choosers, not the dispatchers

The studio's 142-attack roster was built by scanning dispatcher branches
(`monsterattackname` announcements). That inventories every attack that EXISTS,
including cut content — Deltarune's dispatchers are full of branches nothing
ever selects. This document derives what each fight actually PLAYS by reading
the code that assigns the selector variable, with file:line evidence for every
claim. Landon called this: he recognised the roster as full of unused attacks
and put Gerson at ~21 real entries. Measured: exactly 21.

**Summary (current): 193 of the 294 roster entries appear in real fights. 101 are cut.**

> The 63-of-142 figure this document was written around was correct for the FIVE
> fights that existed then. The roster is now 20 fights. The per-fight
> derivations below are still the authority for *which* types are real — they are
> literally the source of `REAL` in `scripts/gen_attacks.js` — but the headline
> totals were stale. Tenna's count has since been corrected from 14 to 13: three
> dispatches produce `obj_dbulletcontroller.type = 150`, and the generic
> type-keyed rule stamped the CUT choice-20 branch real as well.
>
> Regenerate with `node scripts/gen_attacks.js`.

| fight | real | cut |
|---|---:|---:|
| Aqua & Seth | 9 | 0 |
| Berdly | 10 | 0 |
| Flowery | 14 | 9 |
| Gerson / Hammer of Justice | 21 | 68 |
| Jackenstein | 11 | 0 |
| Jevil | 16 | 2 |
| K. Round | 4 | 0 |
| Lancer | 7 | 0 |
| Lanino & Elnina | 5 | 0 |
| Orange & Green | 5 | 0 |
| Pink | 11 | 3 |
| Queen | 16 | 2 |
| Spamton NEO | 8 | 3 |
| Tasque Manager | 5 | 0 |
| Tenna (final fight) | 13 | 1 |
| The Chaos King | 11 | 0 |
| The Roaring Knight | 7 | 8 |
| The Titan | 15 | 5 |
| Watercooler | 1 | 0 |
| Yellow & Blue | 4 | 0 |
| **TOTAL** | **193** | **101** |

C. Round contributes 0 attacks, and that is correct — its enemy turn was
deliberately gutted (the bullet guard is `if (rr == 999)` while
`rr = scr_monsterpop()` can only return 0–3, so the branch is unreachable, and
the turn length is a literal `global.turntimer = 1`). Evidence in
`scripts/rosters/cround.md`.

---

## The Roaring Knight (ch3) — `obj_knight_enemy`, chooser in `Other_10`

The chooser (`event_user(0)`) runs before EVERY attack — the box block opens
with it — so Create's `myattackchoice = 0` never survives to a turn.
**Swordslash (type 109), the studio's headline demo attack, never plays.**

Scripted phases (`Other_10`, all conditions are `phaseturn == N`):

| phase | sequence (choice → type, difficulty) |
|---|---|
| 1 | 1→98 Stars d0 · 11→151 tracking d0 · 2→99 Flurry d0 · 13→153 tunnel d0 · 5→104 rotating d0 → phase 2 |
| 2 | 1→98 d1 · 2→99 d1 · 13→153 **d3** · 15→**154 vortex + 151 tracking combo** d0 · 5→104 d1 → phase 3 |
| 3 (loops) | 1→98 d2 · 2→99 **d3** · 14→151 tracking **d3** · 13→153 **d4** · 5→104 d2 |
| 4 (event) | 5→104 d2 (skipped if used) · **−1 = charge-up turn** (`chargeupcon = 1`) · 9→**107 roaring** d0 → back to phase 3 |

Phase 1 turns 6–9 (choices 12, 16, 17, 7) are DEAD CODE — `phaseturn == 5`
resets `phaseturn` and advances the phase, so 6–9 are unreachable
(`Other_10:35-64`). Choice 15 fires TWO controllers in one branch
(`Step_0:527-540`): sword vortex d3 + tracking swords d0 simultaneously.

- **Used (7 entries):** 98, 99, 104, 151, 153, 154, 107
- **Cut (8):** 109 Swordslash, 102 swordtunnel, 103 xattacks, 106 underbox,
  105 combination, 108 swords falling, 152 diagonal bullets, 101 knightlines
- **Note:** real difficulties run 0–4; the studio's DIFF selector stops at 2,
  and every spec was written at d0. The real fight's later phases are unspecced.

## Spamton NEO (ch2) — `obj_spamton_neo_enemy`, chooser in `Other_10`

Every turn: `rr = -1; event_user(0);` (`Step_0:67-68`) — the ladder is
authoritative. The trailing `rr = choose(0, 1, 2, 3)` at `Step_0:924` (and its
four battle messages) is overwritten before it is ever read: vestigial.

Ladder (phases advance on mercy/HP thresholds, `Other_10:1-11`):
`0 d1 · 6 d0 · 2 d0 · 8 d0 · 8.5 d0(d2 hell) · 7 d0 · [loop: 2 d2 · 0 d3 ·
7 d0 · 8.5 d2/d1 · 8 d1 · 6 d1]`, phase 4: `2 d1 · 8 d3 · 9 (finale) ·
[loop: 2 d1 · 7 d0 · 9 d0]`, plus low-HP/high-mercy trigger → 9, and
`weirdpathendcon > 0 → rr = 5` (Snowgrave-route pipis explosion).

- **Used (8):** rr 0 FlyingHeads, 2 HeartAttackNeo, 5 PipisExplosion
  (weird route only), 6 RECREW, 7 FaceAttack, 8 Phonecall, 8.5 Phonehands,
  9 NeoFinale. (The dispatcher shares one Phonehands branch for `rr == 8.5 ||
  rr == 4`, `Step_0:755` — the studio's `type8_5` entry is the used one.)
- **Cut (3):** rr 1 FootballPipis, rr 10 diamonds, and the
  `UnspecifiedSneoAttack` fallback (the vestigial choose's `else`).

## Jevil (ch1) — `obj_joker`, progression in `Step_0:196-238`

HP thresholds jump `jturn` to 5 / 10 / 15 / 17 (`Step_0:14-33`). Between
jumps, fixed runs alternate with random pools:

`jturn 0-3`: jattack 0,1,2,3 in order → `jturn 4`: choose(0,1,2,3) repeatedly →
HP → `5-8`: jattack 4,5,6,7 → `9`: choose(4,5,6,7) → HP → `10-13`: jattack
8,9,10,11 → `14`: choose(8,9,10,11) → HP → `15-18`: jattack **12,13,14,15**
(BYE BYE is jattack 15, played at jturn 18) → `19+`:
choose(0,4,7,8,10,11,12,13,13,13).

- **Used (16):** jattack 0–15, i.e. every numbered entry including type 77.
- **Cut (2):** jattack 99 (type 47) and 999 (type 25) — dispatcher branches
  with NO writer anywhere in ch1.

## Gerson / Hammer of Justice (ch4) — ladder at `Other_10:2276-2356`

One linear ladder on `trueturn` (no randomness), then an endphase loop:

`intro (0/1, Create:23/101) → 1 → 2 → 3 → 4 → 72 → 70 → 6 → 7 → 12 → 9 → 47 →
70 → 13 → 14 → 53 → 55 → 56 → 220 → [trueturn 20: 19, reset to 14 →
55, 56, 220, 19, …]`

Patterns 70–73 are one-row wrappers (`Other_10:2294-2300`) that fire
`scr_spearpattern(x, y, 60, 50..53, 9999)` → scr_spearshot arg3 50–53 → the
standalone controllers. The ladder uses **70 (box throw)** twice and **72
(shell kick)** once; 71 (hammer bounce) and 73 (box rumble) never.

The bell / box-hit / hammer-bro controllers are scr_spearshot arg3 **5/6/7**
(`scr_spearshot.gml:166-176`). No used chart passes 5, 6 or 7 as a special —
verified by scanning every used branch's `scr_spearpattern` args — so all
three are cut.

- **Used (21):** greens 0/1 (intro), 1, 2, 3, 4, 6, 7, 9, 12, 13, 14, 19, 47,
  53, 55, 56, 220, wrappers 70 + 72, controllers box_throw + shell_kick
  (the same two attacks, reachable by either roster entry).
- **Cut (~68):** the other 63 green patterns — including ALL of 20–46, 48–52,
  54, 57, 58 and every 100+ pattern — plus bell, box_hit, hammer_bro,
  hammer_bounce (71), box_rumble (73).
- The 100+ charts do NOT belong to the statue fight either:
  `obj_sound_of_justice_enemy` has its own Other_10 with its own 18 chart
  branches and its own ladder ({1,5} intro, then 2,3,4,5,8,11,12,13). The
  hammer enemy's high-numbered charts are simply dev leftovers.

## Pink (ch5) — `obj_pink_enemy`, chooser in `Other_10` (154 lines)

Chooser assigns only `{1, 3, 4, 5, 6}` (5×1, 3×3, 2×4, 3×5, 6×6):

- **Used (11):** choice 1→200 cat, 3→202 rotating box, 4→208 3d tunnel,
  5→209 singing, 6→203 bomb, plus the event-driven purple intro (199,
  `Step_0:3062`), the type-210 finale, and dates 1–4 (datecount).
- **Cut (3):** choice 2→206 (the second bomb variant), choice 7→204 and
  8→205 (both "vertical lanes") — dispatcher branches never selected.

---

## Consequences for the studio

1. `gen_attacks.js` now stamps every roster entry with `inFight`, derived from
   the tables above; the dropdown sorts real attacks first and prefixes cut
   ones with `[cut]`. Nothing is deleted — cut content is still launchable.
2. The 142/142-clean goal was misdirected: several remaining failures are in
   CUT attacks (109 Swordslash's shootrate, 101 knightlines' box, the SNEO
   fallback pair, greens 15/17/18). The number that matters is the REAL set.
3. The real fights run difficulties 0–4 with scripted per-turn values. Specs
   were authored at d0; a follow-up pass should spec the actual
   (choice, difficulty) pairs the ladders produce.
