# Spec authoring brief — transcribing GML into checkable assertions

You are writing **assertions**, not opinions. Each one must be a number, name or
count that the DELTARUNE source *states*, carrying the file and line it came
from. If you cannot point at a line of GML, the assertion does not belong in the
output. A wrong assertion is worse than a missing one: it sends someone to
"fix" an engine that was already right.

## Where things are

| What | Path |
|---|---|
| GML source | `C:\Users\lando\Desktop\DELTARUNE - GML\DELTARUNE Chapter <N> - GML\` |
| Object/sprite/sound tables | `C:\Users\lando\Desktop\DELTARUNE - REF DATA\DELTARUNE Chapter <N> - REFDATA\` |
| Sprite + sound art | `C:\Users\lando\Desktop\DELTARUNE - EXPORT\DELTARUNE Chapter <N> - EXPORT\` |

File naming is flat: `gml_Object_<objectname>_<Event>.gml`,
`gml_GlobalScript_<scriptname>.gml`. Events are `Create_0`, `Step_0`, `Draw_0`,
`Alarm_0..11`, `Other_10` (= `event_user(0)`), `Other_15`, `Destroy_0`,
`CleanUp_0`, `Collision_<obj>`.

## How an attack is actually structured

**An attack is a controller object plus a `type`, not an object of its own.**
The dispatcher branch in the boss's Step sets `.type` on a controller; the
controller's Step has an `if (type == N)` branch. That branch is usually a thin
spawner — the real behaviour lives in the object it creates.

**Follow the chain.** For Knight Swordslash the whole controller branch is:

```gml
if (type == 109) {
    if (!made) {
        with (creatorid) { with (instance_create_depth(x, y, depth, obj_knight_warp))
            { master = other.id; event_user(1); } }
        made = true;
        d = instance_create((camerax() + 480 + 80) - 80, cameray() + 160,
                            obj_bullet_knight_crescentGenerator);
        if (difficulty == 1) d.type = 3;
    }
}
```

Everything interesting is in `obj_bullet_knight_crescentGenerator`'s Create and
Step. Read those. Then read what *they* spawn, one more hop.

Watch for values set in Create and then **overwritten** in Step's init block —
`crescentGenerator` Create says `yposcount = 7`, `shootrate = 30`, and the
`type == 2` init block resets them to `6` and `15`. Those overwrites make
excellent assertions: they prove init actually ran.

## Assertion kinds

Emit JSON. Every assertion needs `why` (one clause) and `src`
(`file.gml:line`).

| kind | fields | meaning |
|---|---|---|
| `spawns` | `obj`, `byFrame`, `min?`, `max?` | object appears by that frame (cumulative — counts even if since destroyed) |
| `absent` | `obj`, `byFrame` | object must NEVER appear |
| `count` | `obj`, `atFrame`, `min?`, `max?` | live instances at that exact frame |
| `pos` | `obj`, `atFrame`, `x?`, `y?`, `tol?` | position of the first live instance |
| `ivar` | `obj`, `atFrame`, `name`, `eq?`/`min?`/`max?`, `tol?` | an instance variable |
| `sprite` | `name`, `byFrame` | that sprite is drawn at least once |
| `draw` | `name`, `atFrame`, `x?`,`y?`,`xscale?`,`yscale?`,`angle?`,`alpha?`,`minCalls?`,`maxCalls?`,`tol?` | the sprite's actual DRAW CALL parameters |
| `box` | `x?`,`y?`,`w?`,`h?`,`tol?` | battle box geometry at its largest |
| `turntimer` | `eq?`/`min?`/`max?`, `tol?` | turn length the boss sets |

## Rules that keep assertions true

- **The view sits at the origin**, so `camerax()` and `cameray()` are `0`.
  `camerax() + 480` is x = 480. The canvas is 640×480.
- **The soul is TOP-LEFT anchored** (`spr_heart` origin is 0,0). The corpus
  writes `obj_heart.x + 10` to mean its centre. Do not "correct" this.
- **Assert positions only on axes that do not move.** An object created during
  a step phase also RUNS its own Step in that same phase, so "frame 1" is
  already after its first move — there is no frame at which an unmoved position
  can be sampled. The crescent generator is created at `cameray() + 160` and
  measured y = 160, 164 and 181 across three runs because it picks a random
  `ypos[]` slot immediately; its x never changes. So assert `x` and omit `y`.
  Give only the axes the source pins and the object does not touch.
- **Difficulty is 0** unless the dispatcher pins a literal. So
  `if (difficulty == 1) d.type = 3` does NOT apply; assert the `type = 2` path.
- **Do not assert on RNG.** `irandom_range(-51, 53)` has no single right answer.
  Assert the count, or a `min`/`max` band the randomness cannot leave.
- **Do not assert party/overworld objects** (`obj_herokris`, `obj_mainchara`,
  `obj_battlecontroller`, …). The studio deliberately keeps them invisible.
- Prefer **6–14 assertions per attack**, weighted to what would be visibly wrong
  if broken: spawn counts, cadence constants (`shootrate`, `alarm[0]`), the
  positions the source computes, the box size, and the sprites the attack draws.

## Visual correctness is checkable — use `draw`

The GML does not merely say a sprite is drawn. It says **where, how big, how
rotated and how transparent**:

```gml
draw_sprite_ext(spr_knight_slash, i, 320, 240, 2, 2, 45, c_white, 0.8);
```

That single line is a complete visual assertion already written down, and a
`draw` assertion transcribes it directly:

```json
{ "kind": "draw", "name": "spr_knight_slash", "atFrame": 60,
  "x": 320, "y": 240, "xscale": 2, "yscale": 2, "angle": 45, "alpha": 0.8,
  "why": "drawn at 2x on the box centre", "src": "gml_Object_x_Draw_0.gml:12" }
```

A sprite drawn at half scale, mirrored (`xscale: -2`), 40px left, or at the
wrong alpha is the exact class of bug that survives every other check here — it
renders, it moves, nothing throws, and it is still wrong. **Prefer `draw` over
`sprite`** whenever the source states any of those parameters.

Notes that keep `draw` assertions honest:
- Give only the fields the source pins. Omit anything computed from RNG or
  from the soul's live position.
- Any ONE matching call passes: attacks legitimately draw the same sprite many
  times (tiles, trails, a ring of bullets). Use `minCalls`/`maxCalls` when the
  COUNT is the thing the source determines.
- `image_xscale = -1` is a horizontal FLIP and is worth asserting — mirrored
  sprites are a common and very visible porting error.
- To see what an attack actually draws on a frame, run
  `await SPEC_CHECK.draws('<id>', <frame>)` in the studio console. Write the
  spec from the GML first, then use that to check yourself — never the reverse,
  or you will encode the current behaviour as correct.

## Output format

Return **only** a JSON array, no prose:

```json
[
  {
    "id": "knight_type109",
    "name": "Swordslash",
    "assertions": [
      { "kind": "pos", "obj": "obj_bullet_knight_crescentGenerator", "atFrame": 1,
        "x": 480, "y": 160, "tol": 2,
        "why": "(camerax()+480+80)-80 = 480, cameray()+160 = 160",
        "src": "gml_Object_obj_dbulletcontroller_Step_0.gml:2247" }
    ]
  }
]
```
