# Pink Boss FINAL MAZE (type 210 / obj_purplecontrols mode 8) — CORRECTIONS to maze.md

Ground-truth-verified corrections. All line refs are into
`C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 5 - GML\`.
Colors are GM BGR ints: RGB = (int&255, (int>>8)&255, (int>>16)&255).

Read maze.md first. This file CORRECTS/EXTENDS §1, §3, §4 (input), §5, §10, §12 and
adds the possessed-portrait + eye-laser + dark-fill detail that maze.md was missing.

---

## 1. RENDER REGION / COMPOSITION — corrected

### 1a. growtangle IS destroyed; the maze is NOT drawn in a box.
`gml_Object_obj_dbulletcontroller_Step_0.gml:3318-3319` (type 210, made==0):
```
with (obj_growtangle) instance_destroy();
```
So there is **no battle box and no clip region at all** during the maze. maze.md was right
that growtangle is destroyed; the important correction is that **NOTHING replaces it as a
frame/clip**. Draw case 8 (`obj_purplecontrols_Draw_0.gml:365-529`) always renders the maze to a
**full 640x480 surface at (camerax, cameray)** for EVERY difficulty (`:366-370`), blitted over the
whole battle view (`:502-521`). There is no per-difficulty surface size, no scissor, no box.

### 1b. Why diff 0/1/2 "look boxed & low" but diff 3 is "full-screen": it is 100% emergent
from (a) node placement and (b) a per-difficulty black darkener. NOT a clip.

**(a) Node placement.** All graphs are rooted at `camerax()+320, cameray()+360`
(`Step_0.gml:2154/2215/2282/2375`) i.e. **screen x=320 (center), y=360 (lower third of the 480 view)**.
Draw case 8 draws each node at `x - camerax` (`:387-389, :441-457`) → nodes land at their RAW
screen coordinates. Small graphs (diff 0/1/2) therefore cluster in a compact patch in the
lower-center; the big serpentine (diff 3) sprawls up to y≈36, filling the screen.

Exact on-screen pixel extents of the node graphs (screen coords = room − camera; node dot radius
≈4–7px, so add ~7 for the drawn glow):

| diff | nodes | X extent | Y extent | look |
|---|---|---|---|---|
| 0 | 9  | 205.25 … 434.75 (w 229.5) | 306 … 414 (h 108) | small patch, lower-center |
| 1 | 9  | 205.25 … 434.75 | 306 … 414 | same footprint as diff 0 (adds cross-links, not nodes) |
| 2 | 13 | 90.5 … 549.5 (w 459) | 306 … 414 (h 108) | wide but still only lower third |
| 3 | 43 | 36.5 … 590 (w 553.5) | 36 … 414 (h 378) | near-fullscreen serpentine |

Root is at (320,360) in every case. Diff-0 play-area screen bounds ≈ **x∈[205,435], y∈[306,414]**
(the "box, lower portion"). There is no drawn rectangle around it — that impression is purely the
node cluster plus the possessed portrait sitting above at the top.

**(b) The dark fill is a per-difficulty ramp, NOT a fixed 50%.**
`gml_Object_obj_date_controller_Draw_0.gml:1031-1060`:
```
if (i_ex(obj_purplecontrols)) {
    var _targetalpha = 0.5;
    if (obj_purplecontrols.difficulty == 0) _targetalpha = 0;
    if (obj_purplecontrols.difficulty == 1) _targetalpha = 0.2;   // immediately overwritten...
    if (obj_purplecontrols.difficulty == 1) _targetalpha = 0.4;   // ...to 0.4
    if (obj_purplecontrols.difficulty == 2) _targetalpha = 0.6;
    if (obj_purplecontrols.difficulty == 3) _targetalpha = 0.8;
    if (obj_purplecontrols.difficulty == 4) _targetalpha = 0;
    date3darkner_alpha = lerp(date3darkner_alpha, _targetalpha, 0.4);   // eased
    draw_set_color(c_black); draw_set_alpha(date3darkner_alpha);
    d_rectangle(camx, camy, camx + camwidth, camy + camheight, false);   // FULL SCREEN
    draw_set_alpha(1);
}
```
So the full-screen black fill alpha is **diff0=0.0, diff1=0.4, diff2=0.6, diff3=0.8, diff4=0.0**,
eased toward target at 0.4/frame. **CORRECTION: the final maze's dark fill is 0.8 (80%), not ~50%.**
diff 0 has zero darkening (you see the full-brightness possessed background), which is exactly why
early mazes read as "a little graph over the scene" and diff 3 reads as "bright maze over a dark
screen."

**Draw order that produces the look** (all inside date_controller Draw, then purplecontrols on top):
possessed portrait `:208-210` → this black fill `:1056` (dims bg AND portrait) → green eye-lasers
`:1191-1200` (drawn AFTER the fill, so they stay bright) → obj_purplecontrols maze surface (separate
object, depth-4, draws on top of everything). Net: dimmed possessed Pink + dimmed portrait, with
bright green lasers and the bright neon maze layered over the dark fill.

(Note: a second, independent `date4darknessalpha` rectangle exists at `date_controller_Draw:585-587`
— it is ~0 during the maze and is NOT the maze darkener.)

---

## 2. HAZARD MOVEMENT — confirmed: acts do NOT home on the player.

`gml_Object_obj_pinknodeact_Step_0.gml`. Three patterns, none reference `obj_heart`/soul position
for steering:

**pattern 1 — orbiter (`:9-23`)**: `x=dest_x; y=dest_y+lengthdir_y(54+8, pattern_dir); pattern_dir+=4`.
Pure vertical bob around its home node. No soul reference.

**pattern 2 — horizontal sweep (`:25-42`)**: spawns off the left/right edge by `pattern_dir`,
`x += lengthdir_x(288, pattern_dir); y = dest_y; pattern_dir += 1.5`. Fixed lateral pass at its
node's y. No soul reference.

**pattern 3 — the "hunter" (diff 3) (`:44-107`)**: walks the node GRAPH along a FIXED route. It moves
toward `node_id.dest_x/y` at `_travel_speed` (`:52-56`), and on reaching a node picks the next node
purely by child-slot priority — the exact selection (`:63-82`):
```
var i = 0;
var _found_it = false;
with (node_id) {
    repeat (4) {
        if (instance_exists(child[i]) && draw_connection[i] == true) {
            _found_it = true;
            other.node_id = child[i];      // <-- next node = FIRST drawable child, order 0,1,2,3
            break;
        }
        i++;
        if (i >= 4) i -= 4;
    }
}
```
`i` starts at 0 every arrival, so it always prefers **child[0]=East, then [1]=Up, [2]=West, [3]=Down**
— a deterministic, fixed traversal of the directed graph (`draw_connection` edges), never a query of
where the soul is. If no child qualifies it `instance_destroy()`s (`:100-103`). **The travel SPEED
scales with `hits`/`life_time` (`:52`) but the PATH does not — it is not a pursuer.** Confirmed: no
pattern homes on the player. `_travel_speed = min(4 + life_time/2, clamp(15 - (hits-1)*0.75, 12, 15))`.

The soul only interacts via the collision rect (`:297-342`, a 48x32 box vs obj_heart) which is
symmetric contact, not tracking.

---

## 3. NODE COORDS — RAW absolute room coords. Re-centering/rescaling is WRONG.

Nodes are created at absolute room coordinates via `fnc_make_node(dir, dist)`
(`obj_pinknode_Create_0.gml:20-24`): `child[dir] = create(x + lengthdir_x(dist, dir*90),
y + lengthdir_y(dist, dir*90), ...)`. Direction map: **0=East(+x), 1=Up(−y), 2=West(−x), 3=Down(+y)**.
`_node_dist=54`, long edge `54*2.125 = 114.75`.

Draw uses them RAW, only subtracting the camera origin (`Draw_0.gml:387 d_line(x-_cx, ...)`,
`:441 d_circle(floor(0.5+x-_cx), ...)`). **There is NO re-center and NO scale.** The earlier port
that stretched the whole graph into a 596x336 area is incorrect — it distorts every edge length and
breaks the fixed 54px grid the collisions and slides assume. Port fix: place root at
(camerax+320, cameray+360) and lay out children with the raw ±54 / ±114.75 offsets; draw at
(nodeX − camerax, nodeY − cameray). No fit-to-rect.

True screen-space (room−camera) extents per difficulty are the table in §1b:
diff0/1 x[205.25,434.75] y[306,414]; diff2 x[90.5,549.5] y[306,414]; diff3 x[36.5,590] y[36,414].
(Diff 3 also drifts ±~1.5px per node, see maze.md §8; extents above are the rest positions.)

Diff-3 vertex walk (screen coords, root=(320,360), for verification):
idx0(320,360) 1(374,360) 2(374,306) 3(428,306) 4(428,360) 5(482,360) 6(482,414) 7(536,414)
8(536,360) 9(590,360) 10(590,306) 11(536,306) 12(536,225) 13(590,225) 14(590,171) 15(536,171)
16(536,36) 17(441.5,36) 18(441.5,90) 19(374,90) 20(374,36) 21(266,36) 22(266,90) 23(198.5,90)
24(198.5,36) 25(50,36) 26(50,90) 27(104,90) 28(104,144) 29(50,144) 30(50,198) 31(158,198)
32(158,306) 33(90.5,306) 34(90.5,252) 35(36.5,252) 36(36.5,414) 37(90.5,414) 38(90.5,360)
39(218.75,360, mode-1 SUCCESS act). Checkpoint shortcuts: 40 from idx5 (482,292.5), 41 from idx12
(468.5,225), 42 from idx23 (198.5,144), each checkpoint=1 darkify=1.

---

## 4. INPUT FEEL — the exact model, and why taps during a slide are dropped.

`gml_Object_obj_purplecontrols_Step_0.gml:25-149` (buffering) + `:2616-2717` (movement) +
`:2736-2768` (consumption).

Numbers (mode 8 = default case, `:41-43`): `_input_buffer_length = 2`; `_hold_repeat_delay = 9`.
Input frozen while `life_time < 5` (`:49-51`). `press_*` = consecutive held frames (`:54-72`).

**Buffer set on fresh press** (`:88-114`): `*_p()` → `buffer_* = 2`.

**Buffer decay with a hold-floor** (`:74-84`) — THIS is the crux:
```
if (buffer_l > 0) buffer_l = clamp(buffer_l - 1, min(press_l, 1), _input_buffer_length);
```
Each frame buffer drops by 1 but is clamped to a floor of `min(press_*,1)`:
- key STILL HELD → floor = 1 → buffer never decays below 1 → **survives an arbitrarily long slide**.
- key RELEASED (tap) → floor = 0 → buffer decays 2 → 1 → 0 over at most **2 frames**.

**Hold auto-repeat** (`:116-133`): if nothing freshly pressed and `press_* >= max(9, all press_*)`,
re-arm `buffer_* = max(1, buffer_*)` — i.e. after holding ≥9 frames it keeps re-buffering to 1.

**Fresh-press exclusivity** (`:135-148`): on any fresh press, every OTHER buffer that isn't at full
(2) is zeroed — a new direction cancels a stale one.

**Movement reads the buffer ONLY when `can_move && heart_travel <= 0`** (`:2618`). During a slide
(`heart_travel > 0`, `:2670-2713`) the buffer is NOT consumed but continues to decay per above.

**Slide durations** (edge px / min(22,dist) per frame): 54px edge → travel 54→32→10→0 = **3 frames**;
114.75px long edge → ~**6 frames**. Since a released tap's buffer only lives 2 frames, **a tap made
early in a 3–6-frame slide is gone before arrival** → the "laggy / have to mash" feel. Only a HELD
direction (floor=1) is honored on arrival.

**Consumption on a successful move** (`:2736-2768`): the moved direction sets `input_activated_*`,
which zeroes that buffer and sets ALL `press_* = 1` (so a held key can't instantly double-step; it
must re-press or clear the 9-frame repeat gate).

**Heart placement** (`:2715-2716, :2730-2734`): `x_ongrid = node_id.x − lengthdir_x(heart_travel,
_move_dir) − x`, then `obj_heart.x = (ctrl.x + ctrl.x_ongrid) − 9*xscale` (ctrl.x cancels), i.e. heart
sits `heart_travel` px behind the live target node along `_move_dir`.

**Port fix for snappiness:** give the buffer a floor that survives the whole slide regardless of
hold — i.e. when a direction is pressed while `heart_travel > 0`, store it as a queued "next move"
and apply it the frame `heart_travel` hits 0 (equivalently, buffer length ≥ longest slide ≈ 6, or an
explicit 1-slot queue). Keep 22px/frame slide speed and the 54px grid so timing matches.

---

## 5. POSSESSED-form assets above the maze (obj_date_controller Draw, date3 / pinkportrait==1103).

**Portrait — 3-layer alpha pulse** (`:202-211`), only when `pinkportrait == 1103`:
`_float_y = sin(tailindex)*2; portrait_offset_x = 10;` drawn at
`(xx + pinkportrait_x + 110 + portrait_offset_x, yy + pinkportrait_y + _float_y)`, xscale=yscale=2,
frame=`tailindex`:
```
spr_possessed_mewmew_greyscale_brighter  alpha 0.95
spr_possessed_mewmew_purple              alpha 0.7 + sin(tailindex)*0.3
spr_possessed_mewmew_pink                alpha 0.7 - sin(tailindex)*0.3
```
(purple and pink layers cross-fade in antiphase → the "possessed shimmer".)

**Green eye-lasers** (`:1173-1246`), gated `pinkportrait==1103 && draw_box_timer>20 && con!=7`:
`eyeshaft_alpha += 0.1` (→1). Ten straight beams via `d_line_color(..., 65280, 65280)` at global
alpha `eyeshaft_alpha`. `65280 = 0x00FF00 → RGB(0,255,0) = pure GREEN`. Anchored at
`_handx = camx+210, _handy = camy+395`; each beam runs from an outer point to a point near the eyes
(offset `+_float_y`), e.g.:
```
d_line_color(_handx-105, _handy-250, (_handx-15)+9, (_handy-193)+_float_y, 65280,65280);
... (10 lines total, symmetric left/right, endpoints at :1191-1200) ...
```
Then the eye sprite: `spr_possessed_mewmew_eyes2` (frame `tailindex`) at the portrait anchor,
scale 2, blend `eye_shaft_blend`, alpha `eyeshaft_alpha*0.7 - sin(tailindex)*0.3` (`:1245`).
On a success (mode-1 node hit → `obj_date_controller.changecolorcon = 1`, set in
`pinknodeact_Step_0:331-332`), `changecolorcon` cycles `eye_shaft_blend` through random HSV colors
(`:1211-1240`) for a rainbow flash, then resets to white (16777215).

**Sprite names to export:** `spr_possessed_mewmew_greyscale_brighter`, `spr_possessed_mewmew_purple`,
`spr_possessed_mewmew_pink`, `spr_possessed_mewmew_eyes2`.

---

## 6. Net corrections vs maze.md
- §1/§10: maze surface is full-screen for ALL diffs (was implied); add that there is NO clip box and
  the "boxed lower maze" is emergent node placement + the per-diff darkener.
- NEW: dark-fill alpha ramp 0 / 0.4 / 0.6 / 0.8 / 0 (diff 0-4), full-screen black, from
  date_controller_Draw:1031-1060. Final maze = 0.8, not ~50%.
- §3: node coords are RAW room coords; do not rescale/re-center to any fixed rect.
- §4 input: document the `clamp(buffer-1, min(press,1), 2)` hold-floor — HELD survives a slide, TAP
  dies in ≤2 frames vs 3–6-frame slides → the lag. Port should queue the press through the slide.
- §5 pattern 3: confirmed fixed child-slot route (0,1,2,3 priority), never soul-homing.
