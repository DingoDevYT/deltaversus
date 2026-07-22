# Pink Boss — The Node MAZE (obj_purplecontrols mode 8) — EXACT PORT SPEC

Decompiled source: `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter 5 - GML\`
Refdata: `C:\Users\lando\Desktop\DELTARUNE - REF DATA\DELTARUNE Chapter 5 - REFDATA\`

The MAZE is the final attack of the Pink (Mad Mew Mew) fight: bullet **type 210** on
`obj_dbulletcontroller`, which drives `obj_purplecontrols` **mode 8**. `obj_purplecontrols` is
a general "guided-soul mini-controller" with 9 modes (0..8); modes 1,2,3,4,5,6,7 are other
Pink attacks. This spec covers ONLY mode 8 plus the shared plumbing it uses. All other-mode code
is noted but not reproduced.

Room/battle coordinates: everything lives in absolute room coords. `camerax()`/`cameray()` are the
top-left of the 640x480 battle view. `scr_get_box(4)`/`scr_get_box(5)` = battle-box center x/y.

---

## 1. ENTRY / SETUP (how mode 8 begins)

`gml_Object_obj_dbulletcontroller_Step_0.gml:3305-3328` — bullet type 210:
```
if (type == 210 && made == 0) {
    made = 1;
    with (obj_heart) { sprite_index = spr_purpleheart; canmove = 0; }
    with (obj_growtangle) instance_destroy();     // no battle box in maze
    if (!i_ex(obj_purplecontrols)) instance_create_depth(x, y, 4, obj_purplecontrols);
    obj_purplecontrols.mode = 8;
    obj_purplecontrols.difficulty = other.difficulty;  // 0..3
    global.turntimer = 1000;                        // effectively "no auto-end"
}
```
`difficulty` is the phase counter; the maze is played FOUR times in a row, difficulty 0 → 1 → 2 → 3,
promoted by the mode-1 "success" node (see §7). `difficulty 3` is the hardest, single long snake maze
with a moving hunter.

`obj_purplecontrols` default sprite = `spr_purpleheart` (objects.tsv:540). The real player soul is
`obj_heart`; `obj_purplecontrols` just draws a `-1` (previous) frame of the heart sprite each Draw
(`Draw_0.gml:535-536`). During mode 8 the heart's `visible` stays 1; its position is written every
step from `x_ongrid/y_ongrid` (see §4).

### Create (obj_purplecontrols) — `gml_Object_obj_purplecontrols_Create_0.gml`
Relevant defaults for mode 8: `life_time=0`, `mode=1`(overwritten to 8), `difficulty=0`,
`hits=0`, `made=0`, `x_ongrid=0`, `y_ongrid=0`, `x_target=0`, `y_target=0`, `heart_travel=0`,
`node_id=-4`, `can_move=true`, `can_spin=true`, `heartshake_x/y=0`, `heartbump_x/y=0`, `x_shake=0`,
`ds_bullet_list=ds_list_create()`, `surface_effect`/`surface_box` created 32x32 then immediately
freed (they are lazily re-created per mode). Input buffers all 0.

---

## 2. SHARED SOUL-INPUT PLUMBING (runs every step, all modes) — `Step_0.gml:1-161`

Heart smoothing (applies in maze):
- `heartshake_x = scr_approach(-heartshake_x, 0, 2)`, same for y (`:12-13`) — a decaying bounce that
  FLIPS sign each frame (spring). Set to ±5 on arrival at a node (see §4), ±3 on blocked move.
- `heartbump_x/y` approach 0 by 2 if |v|>2 else by 1 (`:15-23`). (Unused in maze; kept for parity.)

Input buffering (`:25-149`):
- `_input_buffer_length` = 2 for mode 8 (default case, `:41-43`).
- Per-direction `press_*` = consecutive frames held (`:54-72`).
- `buffer_*` = a "just pressed" window of length 2; set to 2 on `*_p()` press (`:88-114`),
  decremented and clamped each frame (`:74-84`). Hold-repeat: if held ≥ `_hold_repeat_delay=9`
  frames it re-buffers to 1 (`:116-133`). On a fresh press, non-matching buffers <full are zeroed
  (`:135-148`). This is the exact "coyote/repeat" feel — port it verbatim; mode 8 reads `buffer_* >= 1`.
- Frozen for first frames: block input while `life_time < 5`, or `<13` if a type-203 controller
  exists (`:49-51`) — for the maze `life_time` resets to 0 at `made==0`, so ~5 frames of no input.

`input_activated_*`, `px`, `py`, `squished` reset to 0 each step (`:151-157`).

---

## 3. MODE 8 MAZE CONSTRUCTION (`made==0`, one-time) — `Step_0.gml:2139-2569`

`_laneswap_speed = 22` (soul travel speed, px/frame). On first frame: `life_time=0`,
`pattern_phase=0`, `pattern_time=0`, build a `ds_list` of nodes `_li_nodes`.
`_node_dist = 54`, `_h_multi = 2.125` (so long edges = 54*2.125 = 114.75).

### Node primitive — `obj_pinknode`
Create (`gml_Object_obj_pinknode_Create_0.gml`):
```
child[0..3] = -4;                 // 0=Right, 1=Up, 2=Left, 3=Down (dir*90)
draw_connection[0..3] = true;
darkify=0; dest_x=x; dest_y=y;    // dest_* = "home" position (drift target)
doki_delay=0; doki_backup_node=-4; act_to_change=-4;
hp=0; pulse=-1; pulse_length=156; checkpoint=0;
function fnc_make_node(dir, dist) {   // dir in {0,1,2,3}
    child[dir] = instance_create_depth(x+lengthdir_x(dist, dir*90),
                                       y+lengthdir_y(dist, dir*90), depth, obj_pinknode);
    return child[dir];
}
```
`child[i]` direction convention: **0=east(+x), 1=north(−y, since lengthdir_y(d,90)=−d), 2=west(−x),
3=south(+y)**. Movement mapping in §4 uses child[2]=Left, child[0]=Right, child[1]=Up, child[3]=Down.

Root node always created at `camerax()+320, cameray()+360` (view center-ish) with `checkpoint=2`
(the active start/anchor). Node depth 0; act depth 2.

### Difficulty 0 (`:2153-2212`) — small tree
Root (idx0, checkpoint=2) spawns 4 children: `fnc_make_node(0, 114.75)`, `(1,54)`, `(2,114.75)`, `(3,54)`.
idx1 spawns `(1,54)`,`(3,54)`; idx3 spawns `(1,54)`,`(3,54)`.
`obj_pinknodeact` (goal nodes, mode 0 = "DIE!" trap by default) placed on idx4, idx5, idx7 →
`_acts[0..2]`. Then a random leaf `_randnode = choose(2,6,8)` gets `doki_delay=45`,
`act_to_change=_acts[irandom(2)]`, and a `doki_backup_node` = one of the OTHER two leaves
(`choose` per case, `:2196-2209`). (The doki collectible converts a trap node into a mode-1 "success"
node — see §6.)

### Difficulty 1 (`:2214-2279`)
Root children as diff0. idx1→(1,54),(3,54); idx3→(1,54),(3,54). Extra cross-links:
`idx2.child[2]=idx7`, `idx4.child[0]=idx6` (`:2240-2244`) forming loops. Root `hp=2`.
Two `pinknodeact` with `pattern=1` (orbiting, see §5) on idx1 and idx3 (idx3 `pattern_dir=180`).
Dokis: idx5 `doki_delay=30 act_to_change=idx0`; idx8 `doki_delay=30 act_to_change=idx0`.

### Difficulty 2 (`:2281-2372`)
Larger graph (13 nodes). Root children as before, `hp=4`. idx1→(0,114.75),(1,54),(3,54);
idx5→(1,54); idx3→(1,54),(2,114.75),(3,54); idx10→(3,54).
`pinknodeact`: idx1 `pattern=1`; idx3 `pattern=1 pattern_dir=180`; idx5 `pattern=2 pattern_dir=210`
(the SWEEP, see §5). Dokis: idx7 `doki_delay=60`, idx8 `30`, idx9 `60`, idx12 `30`, all
`act_to_change=idx0`.

### Difficulty 3 (`:2374-2562`) — single long snake + hunter
`node_start = idx0` (idx0 gets `fnc_make_node(0,54)` then `checkpoint=2`). Then a long serpentine
chain idx1..idx39 each adding exactly one child; the directions/lengths are a fixed hand-authored
path (`:2386-2498`), e.g. idx11 `(1, 54*1.5)`, idx15 `(1,54*2.5)`, idx16 `(2,54*1.75)`, idx24
`(2,54*2.75)`, idx35 `(3,54*3)`, idx38 `(0,54*2.375)`. **Reproduce this list verbatim.**
idx39 gets a `pinknodeact` with `mode=1` (the SUCCESS node that promotes difficulty).

Three checkpoint shortcuts (`:2514-2554`): from idx5, idx12, idx23 add a branch node that is wired
back into the chain (`child[dir]=other.id`, `draw_connection` toggled) with `checkpoint=1` and
`darkify=1` (mid-maze checkpoints).

**Node drift** (`:2556-2560`): after building, `with (obj_pinknode){ direction=random(360); speed=0.25; }`
— every node wanders at speed 0.25 (see §8). Only difficulty 3 sets speed>0 (others are static).

Finalize (`:2565-2568`): `ds_list_destroy(_li_nodes)`; `with (obj_pinknode) event_user(0)`
(builds reverse connections, §3.1).

### 3.1 Reverse-connection linking — `obj_pinknode` Other_10 (event_user0) `:1-19`
For every OTHER node, if this node has an empty child slot `i` and that other node's opposite-dir
child (`child[(i+2)%4]`) points back at this node, then set `other.draw_connection[i]=false;
other.child[i]=id`. This makes edges traversable both ways while only drawing each edge once
(the return edge has `draw_connection=false`).

---

## 4. SOUL MOVEMENT ON THE GRAPH (`instance_exists(node_id)`) — `Step_0.gml:2616-2717`

The soul is always either sitting on `node_id` or sliding along an edge (`heart_travel > 0`).

**Choosing a move** (only when `can_move && heart_travel <= 0`, `:2618-2666`):
```
buffer_l>=1 & child[2] exists → node_id=child[2]; direction=180
buffer_r>=1 & child[0] exists → node_id=child[0]; direction=0
buffer_u>=1 & child[1] exists → node_id=child[1]; direction=90
buffer_d>=1 & child[3] exists → node_id=child[3]; direction=270
```
Each move: `snd_play(snd_wing)`, spawn `obj_pinkdust` at soul pos with matching `image_angle`,
and set `heart_travel = point_distance(oldNode.dest_x,dest_y, newNode.dest_x,dest_y)` (`:2665`).

**Sliding** (`:2668-2713`): `_move_dir = point_direction(soul, node_id.x, node_id.y)` (uses LIVE node
x/y, which drift). Each frame `_move_amount = min(22, max(1, dist(soul,node)))`; spawn an
`obj_pinktrail` heading `_move_dir` speed 1; `heart_travel -= _move_amount`. On arrival
(`heart_travel<=0`): clamp to 0; set `heartshake_*` = ±5 depending on `direction`
(`:2687-2698`, E→+x, N→−y, W→−x, S→+y). Then checkpoint promotion (§7): if the arrived node has
`checkpoint==1`, demote every node with `checkpoint>1` to 1 and set this node `checkpoint=2`
(`:2699-2711`).

**Position write** (`:2715-2716`, every frame):
```
x_ongrid = node_id.x - lengthdir_x(heart_travel, _move_dir) - x;
y_ongrid = node_id.y - lengthdir_y(heart_travel, _move_dir) - y;
```
i.e. the soul is `heart_travel` px behind the target node along `_move_dir`. Because nodes drift,
`_move_dir` is recomputed live so the soul tracks a moving node.

**Global heart placement** (`:2730-2734`, after switch, all modes):
```
with (obj_heart) { x = (ctrl.x + ctrl.x_ongrid) - 9*image_xscale;
                   y = (ctrl.y + ctrl.y_ongrid) - 9*image_yscale; }
```
(9 = half of the 18px purpleheart.)

**Input consumption** (`:2736-2768`): if any `input_activated_*`, zero that buffer; and if ANY
activated, set all `press_*=1` (prevents immediate re-trigger from a held key).

**End housekeeping** (`:2722-2785`): `x_shake = -scr_approach(x_shake,0,0.5)`; keep `obj_growtangle`
glued to controller (unused in maze, box was destroyed); `made=1`; `life_time++`; and once
`life_time>=30`, if `obj_heart` no longer exists, restore box/heart visibility and destroy controller
(cleanup path). Note: mode 8 sets `made=1` only after the first full step, so construction happens once.

---

## 5. NODE-ACT OBJECTS (traps, goals, orbiters, sweep, hunter) — `obj_pinknodeact`

Create (`gml_Object_obj_pinknodeact_Create_0.gml`): `active=1; mode=0; pattern=0; pattern_dir=0;
dest_x=x; dest_y=y; node_id=-4; heart_travel=0; life_time=0; image_alpha=0; whiteflash=0;
fading_away=-1;` plus a full purple/pink palette table (`:20-36`) used by Draw. `mode=0` = "DIE!"
trap; `mode=1` = "Stop!/Calm down!/Don't cry!/It's OK!" SUCCESS node (text per difficulty,
Draw `:75-91`).

Step (`gml_Object_obj_pinknodeact_Step_0.gml`):

**pattern 1 — orbiter** (`:9-23`): while `timer<0`, `x=dest_x; y=dest_y+lengthdir_y(54+8, pattern_dir)`;
`pattern_dir += 4` per frame (wraps 360). It bobs vertically around its home node.

**pattern 2 — horizontal SWEEP** (`:25-42`): while `timer<0`, spawn from off-screen side chosen by
`pattern_dir`: if `90<pattern_dir<270` start at `camerax()+640+64` else `camerax()-64`, then
`x += lengthdir_x(288, pattern_dir); y = dest_y`. `pattern_dir += 1.5` per frame. This makes the act
box slide fully across the play area horizontally at its node's y.

**pattern 3 — the HUNTER (difficulty 3 only)** (`:44-107`): moves along the node graph toward the
soul. `_travel_speed = min(4 + life_time/2, clamp(15 - (hits-1)*0.75, 12, 15))`. Each frame steps
`_move_amount = min(_travel_speed, max(1, dist to node_id.dest))` toward `node_id.dest_x/y`; when it
reaches a node it picks that node's first available `draw_connection` child and continues (carrying
`_overtravel`); if none, `instance_destroy()`. It relentlessly walks the maze.

**Goal timer (mode 1) — COUNTS TWICE PER FRAME** (`:110-163`): once `timer>=0`, `timer++` (`:112`).
For `mode==1` there is a SECOND `timer++` (`:127`) → mode-1 acts advance at 2/frame, hitting
`_nextpatterntime=50` in ~25 real frames. At `timer>=50` the mode-1 act (`:142-162`): destroy all
nodes/dokihearts, `obj_dbulletcontroller.difficulty++`, and on the controller `hits=0; difficulty++;
can_move=true; made=0` → rebuilds the next-harder maze. Color-flash of the dialogue box during
`timer<8` (`:130-140`).

**Trap timer (mode 0)** (`:164-294`): `timer++` again (also 2/frame) then at `timer==1` triggers the
choice UI (`hero_state="choose"`, `:168-176`). At `timer == 10 + _questiondowntime(=10) = 20`:
if a `obj_date_controller` exists run its event_user0, else deal damage
(`scr_shakescreen; snd_play(snd_hurt1); global.inv = global.invc*40`). Then find a node with
`checkpoint==2` and **respawn the soul there** (`:205-274`): teleport `obj_heart` to that node,
laying a trail; `obj_purplecontrols.hits++; node_id=checkpointNode; can_move=true`. If no checkpoint
exists, wipe the maze and `made=0`. (This is the "you hit a DIE node → bumped back to last checkpoint"
loop.)

**Collision with soul** (`:297-342`): if `active==1`, test a 48x32 rect around the act vs `obj_heart`.
Trap (mode 0) fires only when `global.inv<0` (i-frames elapsed); mode 1 fires always. mode 0 →
`snd_error`, `whiteflash=1`; mode 1 → `snd_coin`, `whiteflash=1`, clears all acts, sets
`obj_date_controller.changecolorcon=1`. Both set `active=0; timer=0` on all acts.

Fade/alpha (`:344-367`): `image_alpha += 0.5` (mode1) / `0.2` (else) toward 1; `fading_away` ramps
alpha down and destroys (except mode1).

Step_2 (`:1-5`): if `mother` node exists, snap `x=mother.x; y=mother.y` (acts follow their drifting node).

Draw (`gml_Object_obj_pinknodeact_Draw_0.gml`): draws a 96x48 box (outline thickness pulsing 1..3
on a 40-frame `explosiontimer` cycle), colored yellow↔red (mode0) or white↔dialoguecolor (mode1),
plus centered "DIE!" (red) / success text. Coords floored (`:9-10`). See §9 for exact draw calls.

---

## 6. DOKIHEART — the collectible that converts trap → success — `obj_dokiheart`

Spawned by a node's `doki_delay` countdown, NOT by the controller in maze mode.
`obj_pinknode` Step (`gml_Object_obj_pinknode_Step_0.gml:28-81`): when `doki_delay` hits 0, spawn an
`obj_dokiheart` at the node (or, if `doki_backup_node` exists AND the soul is currently on/adjacent
to this node, spawn it at the backup node instead — **doki relocation**, `:37-70`). The doki gets
`mother=node`, `act_to_change = node.act_to_change`, `image_alpha=0`, `maxlifetime=-1`, `visible=0`.

Doki Create (`gml_Object_obj_dokiheart_Create_0.gml`): `event_inherited()` (parent
`obj_bullet_healing`), `maxlifetime=90`, scale 1, `mode=0`, `mother=-4`, `act_to_change=-4`,
`xdraw=x; ydraw=y`, `visual_scale=1`, `pulse=0`, `tension_value=1`. Default sprite `spr_dokiheart`
(objects.tsv:809), 24x24, origin (12,10).

Doki Step (`gml_Object_obj_dokiheart_Step_0.gml`): mode 1 branch is only for the tunnel attack
(physics, mutual repulsion, magnet to heart) — **not used in the maze** (maze dokis are mode 0,
mother-locked). Maze-relevant part (`:58-149`): collision test vs a shrunk `obj_heart` box
(`heart.x+2..+18`); on pickup → `snd_power`, `scr_healall(1)`, and **convert the target act**:
```
if act_to_change is obj_pinknodeact: act.mode=1; act.life_time=0;   // trap → SUCCESS
else: act.hp-=1; act.event_user(1);
```
plus TP heal (`scr_tensionheal(tension_value*2.5)`, tensionbar max bumps), `snd_swallow`, a
`spr_finisher_explosion` burst, `obj_pink_tension_glow`, then `instance_destroy()`. Lifetime:
if `!i_ex(obj_heart)` destroy; else fade in `image_alpha += 0.1` (maxlifetime=-1 never times out in
maze). `pulse` cycles 0..14 (`:151-154`).

Doki Step_2 (`:1-19`): smooth visual position `xdraw/ydraw` lerp toward `x/y`
(`xdraw += lengthdir_x(dist*0.2 + speed, dir)` when far), then if `mother` exists snap `x=mother.x;
y=mother.y` (doki glued to its node).

Doki Draw (`gml_Object_obj_dokiheart_Draw_0.gml`): pulse-scaled sprite. `_scale` steps
1.5,1.25,1.2,1.15,1.1,1.05 for `pulse` 0..5 else 1, times `visual_scale`. Draws
`spr_dokiheart` at `xdraw, ydraw(+lengthdir_y(2, lifetime*10))` with rotation
`image_angle + lengthdir_x(15, lifetime*15)`, blend `#FF88AA`, plus a black outline via
`scr_draw_outline_ext(...,c_black, image_alpha*0.5, 8)` when `obj_huge_anime_face` exists.
In the maze the controller draws hidden (`visible==0`) dokis itself inside the glow surface
(see §9, Draw case 8 `:461-471`).

---

## 7. CHECKPOINTS, PROMOTION/DEMOTION, WIN/LOSE FLOW

`checkpoint` values on `obj_pinknode`: `0`=normal, `1`=dormant checkpoint, `2`=ACTIVE anchor
(only one active at a time). Root always starts `checkpoint=2`. Difficulty-3 mid-maze shortcut nodes
start `checkpoint=1, darkify=1`.

**Promotion on arrival** (`Step_0.gml:2699-2711`): when soul lands on a `checkpoint==1` node, ALL
nodes with `checkpoint>1` demote to 1, then this node becomes `checkpoint==2`. So the "active" anchor
walks forward with you.

**Death → respawn** (`obj_pinknodeact` mode0 `:205-274`): on hitting a DIE node, the soul is thrown
back to the current `checkpoint==2` node, `hits++`.

**Phase progression** (difficulty promotes the whole maze): reaching the mode-1 SUCCESS act
(diff3 idx39, or a doki-converted act in diff0/1/2) runs the mode-1 goal timer (2/frame → 50), which
does `difficulty++` on both `obj_dbulletcontroller` and `obj_purplecontrols` and rebuilds
(`made=0`). Sequence: **difficulty 0 → 1 → 2 → 3 → (after diff-3 success) ending**. The controller
self-destructs via the `life_time>=30 && !obj_heart` cleanup and CleanUp.

`obj_purplecontrols` Destroy (`gml_Object_obj_purplecontrols_Destroy_0.gml`): restore
growtangle scale, `obj_heart.visible=1`, destroy all `obj_pinknode` and `obj_pinknodeact`.
CleanUp (`gml_Object_obj_purplecontrols_CleanUp_0.gml`): free surfaces; only modes 6/7 destroy their
ds_lists (mode 8 stores its lists locally and already destroyed `_li_nodes`; node acts/dokis clean
themselves).

**Other_10 (event_user0) / Other_11 (event_user1)** on the controller are the SPIN mode-3 helpers
(`:1-19`) — irrelevant to mode 8. Step_1 (Begin Step) just `iframes = max(0, iframes-1)`.

---

## 8. NODE DRIFT (difficulty 3) — `obj_pinknode` Step_0 `:83-105`

Only nodes with `speed>0` (diff3, speed 0.25) drift. `_steer = 10` (degrees/frame):
```
if dist(x,y, dest_x,dest_y) >= speed*6 (=1.5):
    aim direction toward dest (unwrapped to nearest ±180), then
    turn `direction` by ±10 toward that aim (no easing, hard ±10 step)
else:
    direction += choose(-1,1)*10   // wander when already home
```
Movement itself is GameMaker's built-in `speed`/`direction` (x += lengthdir_x(0.25, direction) each
frame). Net effect: nodes hover/jitter within ~1.5px of their home `dest`, drifting slowly. The soul
and all acts/dokis track the live (drifting) node positions. **"steering speed 0.25" = node move speed;
angular steer = 10°/frame.**

Pulse propagation (`obj_pinknode` Step_0 `:1-26`): when `pulse>=0`, `pulse += 26`/frame and
propagates down the first drawn child edge (`child[i].pulse = pulse - edge_dist` once `pulse>=dist`),
terminating after `pulse >= dist + pulse_length(156)`. Diff3 triggers pulses on `node_start` every
12 frames (`Step_0.gml:2604-2608`). This drives the animated red energy running down edges (§9).

---

## 9. DIFFICULTY-3 HUNTER CADENCE — `Step_0.gml:2571-2614`

Only difficulty 3 runs a `pattern_phase` state machine each step:
`_frequency = 36 + clamp(hits-1, 0, 4) * 2`  (36..44 frames; faster as `hits` grows).
- phase 0 (`:2578-2585`): wait until the soul's screen x `(x + x_ongrid) > camerax()+320+96`
  (soul crossed to the right side), then advance; sets `pattern_time=_frequency`.
- phase 1 (`:2587-2610`): `pattern_time++`; every `_frequency` frames spawn a HUNTER —
  `obj_pinknodeact` at `camerax()+320, cameray()+140`, `pattern=3`, `node_id = node_start`,
  `heart_travel = point_distance(self, node_start.dest)`. Reset `pattern_time=0`. Also every 12
  frames pulse `node_start` (`pulse = irandom(8)`).

So on diff3 a fresh hunter launches from the top-center toward `node_start` roughly every 36–44
frames while the player is in the right half of the maze. Hunter movement/repathing is §5 pattern 3.

---

## 10. RENDERING — mode 8 Draw (THE PERF-CRITICAL PART) — `gml_Object_obj_purplecontrols_Draw_0.gml`

Palette (top of Draw, `:1-14`) — GM BGR-packed ints (`$00BBGGRR`) → RGB.
Decode: `R = int & 0xFF`, `G = (int>>8)&0xFF`, `B = (int>>16)&0xFF`. All five have G=0 (pure
magenta-purples). Verified:
| var | int | hex | RGB | web |
|---|---|---|---|---|
| `_prpl_light`    | 11141290 | 0xAA00AA | (170,0,170) | `#AA00AA` |
| `_prpl_dark`     | 5570645  | 0x550055 | (85,0,85)   | `#550055` |
| `_prpl_darker`   | 3866683  | 0x3B003B | (59,0,59)   | `#3B003B` |
| `_prpl_darkest`  | 3342387  | 0x330033 | (51,0,51)   | `#330033` |
| `_prpl_backdrop` | 2228258  | 0x220022 | (34,0,34)   | `#220022` |

(`_prpl_darkest`/`_prpl_backdrop` are unused by case 8; `_prpl_backdrop` is the tunnel mode's star
color. Case 8 uses light/dark/darker + literal `lightpink=rgb(247,91,200)`, `c_red`, `c_white`,
and the pulse core `_col=255` = pure blue `#0000FF`? No — `255=0x0000FF` decodes BGR→ R=255,G=0,B=0
= **red** `#FF0000`; but here `255` is passed as a vertex color where GM treats it as BGR too →
RGB(255,0,0) red. It is used only as the bright pulse-core tint blended over white geometry.)

If `!can_move` (frozen after a hit), all four purples are `merge_color(col, c_black, 0.5)` (darkened).

### Draw case 8 (`:365-529`) — offscreen surface + 9-pass bloom
```
_cx = camerax(); _cy = cameray();
if (!surface_exists(surface_effect)) surface_effect = surface_create(640, 480);   // FULL-SCREEN surface
surface_set_target(surface_effect);
draw_clear_alpha(c_black, 0);
```
All maze geometry is drawn INTO this 640x480 surface in view-local coords (`world - _cx/_cy`):

1. **Edges** (`:377-426`, `with obj_pinknode`): for each `draw_connection[i]` with a live child,
   draw the edge as THREE parallel `d_line`s offset (0,0),(+.5,+.5),(+1,+1) in `_prpl_dark`
   (a 3px-ish thick line). If `pulse>=0`, draw the animated energy pulse as three `pr_trianglestrip`
   quads along the edge: a `merge_color(c_red,_prpl_dark,0.667)` trailing segment
   (`_drawdist` from `pulse-pulse_length` to `+48`), a bright white core (`_col=255`, from `+48`
   to `pulse-24`), and another red-tint leading segment (to `pulse`). 2px wide (±1 perp).

2. **Node dots** (`:428-459`, `with obj_pinknode`) with animated glow color:
   `lightpink = rgb(247,91,200)`; `_glow_color` oscillates lightpink↔white on a 60-frame
   triangle wave (`life_time%60`). Per node:
   - `checkpoint<1`: solid `_prpl_light` `d_circle(r=4)`.
   - `checkpoint==2` (active): `merge_color(_prpl_light,_glow_color,0.5)` — a soft ring at alpha
     0.667 radius `(5.2 - lengthdir_x(0.5, life_time/60*360)) + 2`, then a solid ring radius
     `5.2 - lengthdir_x(0.5, ...)` (pulsating ~4.7..5.7).
   - `checkpoint==1` (dormant): `_glow_color`, alpha .667 ring radius `(7.3 - lengthdir_x(1,...)) + 2`,
     then solid radius `7.3 - lengthdir_x(1,...)`.
   All centers `floor(0.5 + x - _cx)` (pixel-snapped).

3. **Hidden dokihearts** (`:461-471`): `with obj_dokiheart if visible==0` → temporarily subtract
   `_cx/_cy`, run its Draw event, restore. (Draws the doki INSIDE the surface so it blooms too.)

4. **finisher explosions** (`:473-483`): `obj_bulletparent` with `spr_finisher_explosion`, same
   local-coord draw_self trick.

5. **Node acts** (`:485-498`): `with obj_pinknodeact if life_time>0` → local-coord draw; capture
   `_alpha_master = image_alpha` if an act is `fading_away`.

```
surface_reset_target();
```

### Bloom blit (`:502-521`) — the multi-pass part
```
if (life_time < 30) _alpha_master = clamp(life_time/20, 0, 1);   // fade-in
_alpha = 0.25 * _alpha_master;  _bleed = 4;
// 4 axis-offset copies (up/down/left/right by 4px) in c_black at alpha .25
draw_surface_ext(surface_effect, camerax(),      cameray()-4, 1,1,0, c_black, _alpha);
draw_surface_ext(surface_effect, camerax(),      cameray()+4, ...);
draw_surface_ext(surface_effect, camerax()-4,    cameray(),   ...);
draw_surface_ext(surface_effect, camerax()+4,    cameray(),   ...);
_alpha = 0.5 * _alpha_master;   _bleed = 2;
// 4 diagonal copies (±2,±2) in c_black at alpha .5
draw_surface_ext(..., camerax()-2, cameray()-2, ..., c_black, _alpha);  // and the 3 other corners
// FINAL sharp pass in white:
if (_alpha_master < 1) draw_surface_ext(surface_effect, camerax(), cameray(), 1,1,0, c_white, _alpha_master);
else                   draw_surface(surface_effect, camerax(), cameray());
```
**Total = 8 black shadow/bloom blits (drawn as dark "drop-shadow" halo, 4 orthogonal @4px/.25α +
4 diagonal @2px/.5α) + 1 crisp full-color blit = 9 surface draws.** This is the glow. Port note:
the black offset copies act as a soft dark outline/shadow behind the bright maze, giving the neon
look. If perf is a concern, this is the exact structure to replicate (or fake with a blur/shadow),
but the mechanic depends only on the crisp final pass.

6. After bloom, draw trails and dust ON TOP of the bloom, in room coords (not in surface):
   `with obj_pinktrail draw_self()`; `with obj_pinkdust event_perform(ev_draw, ev_draw_normal)`
   (`:523-527`).

### Heart draw (all modes, `:532-536`)
```
if (i_ex(obj_date_controller)) image_alpha = 1;
with (obj_heart)
  draw_sprite_ext(sprite_index, -1,   // image_index -1 = previous/last frame
    x + ctrl.x_shake + ctrl.heartshake_x + ctrl.heartbump_x,
    y + ctrl.heartshake_y + ctrl.heartbump_y,
    image_xscale, image_yscale, image_angle, image_blend, image_alpha);
```
The purple soul (`spr_purpleheart`, 20x20 origin 0,0) is drawn by the controller with all the
shake/bump offsets applied. `obj_heart` itself is set non-visible-drawing during these attacks.

---

## 11. ASSET LIST

Sprites (sprites.tsv: name, frames, w, h, xorigin, yorigin):
- `spr_purpleheart` — 2f 20x20 (0,0) — the soul in maze.
- `spr_dodgeheartmask` — 2f 20x20 — heart collision mask (restored after slides).
- `spr_dokiheart` — 1f 24x24 (12,10) — collectible; drawn blend `#FF88AA`.
- `spr_pink_ghost` — 5f 41x42 (20,20) — Pink's ghost marker sprite.
- `spr_pink_ghost_2xscale` — 5f 82x84 (40,40) — hi-res ghost for wavy draw.
- `spr_finisher_explosion` — doki pickup burst (blend = Pink's `c_pink`).
- `obj_pinknode` / `obj_pinknodeact` — **no sprite**, drawn procedurally (circles/lines/rects).
- `obj_pink_ghost_marker` — no default sprite; set to `spr_pink_ghost` at Create.
- (Referenced but tunnel-only, not maze: `spr_pinkarrows` 5f32x32, `spr_pinkspinarrow` 1f16x16,
  `spr_pinkzap*`.)
- Support FX (spawned): `obj_pinkdust`, `obj_pinktrail`, `obj_pink_tension_glow`.

Sounds (sounds.tsv):
- `snd_wing` (gain 1) — every node move / lane swap.
- `snd_error` — hit a DIE trap node.
- `snd_coin` — hit a success (mode1) node.
- `snd_power` — doki pickup heal.
- `snd_swallow` — doki eaten.
- `snd_hurt1` — damage tick when a trap resolves with no date_controller.
- `snd_impact` (gain 0.92) — spin-mode only (not maze).

---

## 12. GHOST / BODY REAL-COORDINATE DRAW (obj_pink_ghost_marker, obj_pink_enemy)

The prior port used arbitrary coords for Pink + ghost during the maze; here are the real ones.

`obj_pink_enemy` Create (`:60-84`) makes THREE ghost markers (`ghostmarker`, `ghostmarker2`,
`ghostmarker3`) at `x+0, y-35`, `depth-2`, `sprite_index=spr_pink_ghost`, `image_speed=1/6`,
`image_xscale=image_yscale=2`, `image_alpha=0`. They animate the 5-frame `spr_pink_ghost` loop.
During datecount phases they trail Pink's body at her real `x,y` (minus the −35 head offset), fading
in via `image_alpha`. The maze runs at `datecount==3` (final phase, `Step_0.gml:3-4` sets
`monsterhp = maxhp*0.33`).

`obj_pink_ghost_marker` Create (`gml_Object_obj_pink_ghost_marker_Create_0.gml`): `timer=0; con=0;
wave_siner=0; distortsiner=0; thickness=2`.
Draw (`gml_Object_obj_pink_ghost_marker_Draw_0.gml`): if `obj_pink_enemy.datecount==3` set `con=1`.
When `con==1`, draw the ghost as horizontal `thickness`-px slices of `spr_pink_ghost_2xscale`, each
slice x-offset by `sin((wave_siner + i*8)/30)*3` at `(x-40, y-40 + i*thickness)` — a watery vertical
wobble. Else `draw_self()`. `wave_siner`/`distortsiner` increment each frame while `con==1`.

`obj_pink_enemy` Draw idle body: `spr_pink_very_hurt` uses the same sliced-wave draw
(`_2xscale`, offset (−6,28), `sin((wave_siner+i*8)/30)*3`, thickness) with a red-fog flash overlay
(`Draw_0.gml:7-59`). Pink's body is drawn at her instance `x,y` (battle position), NOT relative to the
maze surface — the maze (drawn to a 640x480 surface at camera origin) and Pink's sprite are independent
layers. **Port: keep Pink's sprite at her real battle-box coordinates; draw the maze surface over the
full battle view at (camerax, cameray); ghost markers follow Pink's real x,(y-35).**

---

## 13. EXACT-NUMBER QUICK REFERENCE

| Quantity | Value | Source |
|---|---|---|
| Soul travel speed (px/frame) | 22 | Step_0:2140,2672 |
| Base node edge length | 54 | :2148 |
| Long edge multiplier | 2.125 (→114.75) | :2149 |
| Node drift speed | 0.25 | :2559 |
| Node steer angular step | 10°/frame | pinknode Step:85 |
| Node drift home tolerance | speed*6 = 1.5px | pinknode Step:87 |
| Input buffer length (mode8) | 2 | Step_0:42 |
| Hold-repeat delay | 9 frames | Step_0:116 |
| Arrival heartshake | ±5 | Step_0:2687-2698 |
| Root node spawn | camerax+320, cameray+360 | :2154 |
| Hunter spawn | camerax+320, cameray+140 | :2594 |
| Hunter cadence _frequency | 36 + clamp(hits-1,0,4)*2 | :2574 |
| Hunter travel speed | min(4+lt/2, clamp(15-(hits-1)*.75,12,15)) | act Step:52 |
| Pulse advance / length | +26/frame, len 156 | pinknode Step:3 / Create:17 |
| Diff3 pulse on node_start | every 12 frames | :2604 |
| pattern1 orbit rate | +4°/frame, radius 54+8 | act Step:15-18 |
| pattern2 sweep rate / span | +1.5°/frame, 288px, off-screen ±64 | act Step:29-37 |
| Goal (mode1) timer | 2/frame → 50 (≈25 real frames) | act Step:112,127,142 |
| Trap resolve frame | timer==20 | act Step:190 |
| Act collision box | 48 x 32 | act Step:299-300 |
| Act draw box | 96 x 48 | act Draw:11-12 |
| Doki maxlifetime (maze) | -1 (never expires) | pinknode Step:78 |
| Doki pickup box on heart | +2..+18 (scaled) | doki Step:60 |
| Doki tension heal | tension_value*2.5 (tv=1, or 3 tunnel) | doki Step:96 |
| Maze surface | 640 x 480 @ (camerax,cameray) | Draw:369-370 |
| Bloom passes | 8 black offset + 1 white = 9 blits | Draw:507-521 |
| Bloom offsets | ortho 4px@.25α, diag 2px@.5α | Draw:505-516 |
| Fade-in | life_time/20 clamp 0..1 over 30 frames | Draw:502-503 |
| Controller self-destruct check | life_time>=30 && !obj_heart | Step_0:2773 |
| difficulty flow | 0→1→2→3→ending | act Step:151-156 |
| Doki blend | #FF88AA | doki Draw:38,45 |
```
