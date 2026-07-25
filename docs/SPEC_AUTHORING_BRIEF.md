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
| `box` | `x?`,`y?`,`w?`,`h?`,`tol?` | battle box geometry at its largest |
| `turntimer` | `eq?`/`min?`/`max?`, `tol?` | turn length the boss sets |

## Rules that keep assertions true

- **The view sits at the origin**, so `camerax()` and `cameray()` are `0`.
  `camerax() + 480` is x = 480. The canvas is 640×480.
- **The soul is TOP-LEFT anchored** (`spr_heart` origin is 0,0). The corpus
  writes `obj_heart.x + 10` to mean its centre. Do not "correct" this.
- **Assert positions only at a frame where the object has not moved yet**, or
  where the source pins the position. Objects with `speed`, `friction` or a
  movement block drift — an assertion at frame 8 on a moving object will fail
  for a reason that is not a bug. Prefer `atFrame: 1` or `2` for spawn
  positions.
- **Difficulty is 0** unless the dispatcher pins a literal. So
  `if (difficulty == 1) d.type = 3` does NOT apply; assert the `type = 2` path.
- **Do not assert on RNG.** `irandom_range(-51, 53)` has no single right answer.
  Assert the count, or a `min`/`max` band the randomness cannot leave.
- **Do not assert party/overworld objects** (`obj_herokris`, `obj_mainchara`,
  `obj_battlecontroller`, …). The studio deliberately keeps them invisible.
- Prefer **6–14 assertions per attack**, weighted to what would be visibly wrong
  if broken: spawn counts, cadence constants (`shootrate`, `alarm[0]`), the
  positions the source computes, the box size, and the sprites the attack draws.

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
