# Overnight handover — 20 fights, 194 attacks, all clean

## Where it landed

**20 boss fights, 194 attacks, 194/194 launching and rendering.** Every one of
the 15 fights you asked for is in, plus the original five, verified twice with a
full sweep after the last engine change.

| | fight | attacks | | fight | attacks |
|---|---|---|---|---|---|
| **ch1** | Lancer | 7 | **ch4** | Jackenstein | 11 |
| | K. Round | 4 | | The Titan | 15 |
| | The Chaos King | 11 | | Gerson | 21 |
| **ch2** | Berdly | 10 | **ch5** | Aqua & Seth | 9 |
| | Tasque Manager | 5 | | Yellow & Blue | 4 |
| | Queen | 16 | | Orange & Green | 5 |
| **ch3** | Watercooler | 1 | | Flowery | 14 |
| | Lanino & Elnina | 5 | | Pink | 11 |
| | Tenna (final fight) | 14 | | The Roaring Knight | 7 |
| | | | | Spamton NEO | 8 |
| | | | | Jevil | 16 |

**C. Round has no attacks and that is correct** — you were right to switch to
K. Round. It is the scripted ACT tutorial when Susie rejoins, and its enemy turn
was deliberately gutted: the bullet guard was changed to `if (rr == 999)` while
`rr = scr_monsterpop()` can only be 0–3, so the one branch is unreachable, and
the turn length is a literal `global.turntimer = 1`. Evidence in
`scripts/rosters/cround.md`.

## Your two reported bugs, both fixed

**Pink's date 3 — the DIE! / IT'S OK buttons.** You were right that it is one
attack. `obj_date_controller` reaches `draw_box_timer >= 340` and creates the
type-210 controller itself, which puts `obj_purplecontrols` into mode 8 and
spawns the node graph. That part was already working; the buttons were the
missing half.

The cause was not in Pink's code at all. **Every `ev_*` constant was missing from
the engine.** `obj_purplecontrols` draws the buttons with
`with (obj_pinknodeact) event_perform(ev_draw, ev_draw_normal)`. With `ev_draw`
undefined that became `event_perform(0, 0)` — and 0 is `ev_create`. So a call
meant to DRAW each button re-ran its CREATE event every frame, resetting
`image_alpha` to 0 and `life_time` to 0. The buttons existed at the right
positions the whole time and could never become visible. `ev_draw` has 24 call
sites, so this was quietly corrupting other objects too.

**The Roaring Knight's roar was never broken.** My checker was sampling frame
120, which lands in the dark wind-up between the box closing and the roar
starting. At frame 180 it is the full effect — red shader field, the knight
silhouette, star bursts and light rays. I changed the checker to take the peak
across several frames instead of one late sample.

## The engine gaps behind all of it

Everything below was missing entirely, not subtly wrong. This is what "not
working as per their GML" actually was:

- **`ev_*` event constants** — the Create-instead-of-Draw bug above.
- **`vk_*` virtual keys** (50 of them). `vk_space` threw ReferenceError out of
  the whole Draw event, so Flowery's tower drew nothing.
- **`keyboard_check`** — the most-used of its family (561 call sites in the
  corpus) and defined nowhere; only `_pressed` and `_released` existed. The
  studio now feeds real VK-keyed held/pressed/released state per game step.
- **`application_surface`** (215 call sites). Full-screen effects read it to grab
  "the frame so far". Tenna's smashcut copies it, fills the screen black, then
  redraws the copy offset — with the copy empty, only the black fill survived
  and the attack was a black screen from frame 60 on.
- **Five draw slots** — only Draw, Draw Begin and Draw End were extracted. Added
  Pre Draw, Post Draw, Draw GUI and GUI Begin/End: 202 objects had code there,
  including every HUD readout, which is where Tenna's game show draws its set.
- **`path_*` queries** — the positional ones interpolate by arc length, matching
  how path following actually moves, so a query and a follower agree.
- **`arr[i](...)`** called the array itself with an empty method name, which is
  not a function, so the call silently evaluated to 0. Orange & Green drives
  every one of its behaviours through `orangeBehaviors[n]()`.

## Two bugs worth knowing about

**Exponential codegen.** `genBinary` generated both operands eagerly, then for
`&&` / `||` threw them away and regenerated each side through `genCondition`.
Every boolean node emitted its children twice, so a condition with N nested
`&&`/`||` cost 2^N. `obj_elnina_lanino_controller` has one deep enough that
compiling it never finished — and because objects compile just-in-time on first
spawn, that froze the tab during *launch* of Lanino & Elnina, before a frame
ran, with no error. That file went from never-completing to 14ms.

**A 1600× draw stall.** Tinting a sprite writes an offscreen canvas and
immediately reads it back as a draw source; sharing one buffer forced a GPU
flush before every reuse — 5.0ms per tinted draw against 0.004ms untinted.
Flowery's tower draws 50 tinted decorations twice each, so a frame cost 144ms.
Now 0.003ms per draw. Flowery's parkour section runs at **29.2ms/frame against
the 33.3ms budget for 30fps**.

Caching is restricted to sprite images. A surface is a canvas whose pixels are
rewritten every frame, so caching a tint of one by identity would hand back a
frame that no longer exists.

## Also added, so failures are legible next time

- Compiled `for` and `repeat` now carry the iteration guard `while` already had,
  and the guard is time-bounded rather than counting to 500k.
- `createInstance` has a runaway-spawn ceiling that names the most numerous
  object instead of burying the tab.
- Launch breadcrumbs go to console, which survives a blocked main thread — that
  is what located the exponential.

## Roster generation

A dispatcher choice can cover several playable attacks — Queen's `case 2` is
Wine at three tilt speeds, Tenna's `case 3` is every PHYSICAL CHALLENGE — and
collapsing them lost 27 attacks. The generator now fans a choice out into one
attack per roster row. All 16 rosters are fully represented.

## What I'd look at next

- **Flowery's parkour is at 29.2ms of a 33.3ms budget.** Fine on this machine,
  no headroom on a slower one. The remaining cost is spread across the tower
  decorations and parallax layers rather than one hot spot.
- **The turn-replacement fights need an ACT driver** to be playable end to end
  rather than attack-by-attack: C. Round's three ACT turns, Orange & Green's
  HEALING EGG, and the Tenna minigames that replace a turn outright.
- `REAL_FIGHT_ROSTERS.md` still has the old counts.

Commits are one per fix with the evidence in the message; `git log` from
`62b0ace7` reads as the full story.
