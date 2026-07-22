# GERSON — full rebuild handover (for the next AI)

**Mission:** Completely redo the Gerson fight in DeltaVersus — delete his old (not-working) attacks and
rebuild EVERY attack at 100% accuracy, mechanically AND visually, by reading and copying directly from the
decompiled DELTARUNE Chapter 5 GML. Same methodology that produced the finished Pink (Mad Mew Mew) fight.

**READ FIRST:** `DELTAVERSUS_PORTING_PLAYBOOK.md` — the character-agnostic engine/GML/tooling/verification/
agent-strategy/gotchas doc. It is the source of truth for HOW to do this. `PINK_V3_HANDOVER.md` +
`pink_v3_specs/*.md` are a fully worked example of the same process.

---

## 0. CURRENT GERSON STATE (what to delete)

`CHARS.gerson` (in `docs/js/characters.js`) and these patterns in `docs/js/patterns.js` are the OLD,
not-working set — delete them (kit entries + `PATTERNS.gerson_*` + any tester entries), the same way the old
Pink attacks were stripped (see the "remove ALL old pink attacks" commit `9e56d66` for the exact safe
procedure: make new self-contained → comment-aware brace-balanced deletion → verify with `node --check` +
headless run-all + grep that nothing's orphaned; revert with `git checkout` if a script over-deletes):

```
fight: gerson_spears      spells: gerson_barrage, gerson_spearsweep, gerson_shellvolley, gerson_shellkick,
                                  gerson_swingdown, gerson_boxthrow, gerson_squish, gerson_rudebuster
ult:   gerson_finale
```
The old kit describes a GREEN-SOUL "Hammer of Justice — BLOCK, don't dodge" mechanic (spears/shells/hammers).
Namespace the rebuild (suggest `gn_*` or `gerson2_*`) and keep the old ids until the new set is verified,
then delete the old set and make the new patterns self-contained. Green-soul mechanics already exist in the
engine (`CHARS.greentest` in the tester, `B.soulGreen` in `battle.js`) — reuse/extend them.

## 1. STEP ZERO — LOCATE GERSON'S REAL GML (do this before anything else)

⚠️ Gerson's boss objects are NOT obvious by name (a quick `obj_*gerson*` search found nothing; `obj_npc_
hammerguy_*` and `obj_dw_cliff_silver_hammer_*` exist and are candidates/leads, not confirmed). Your FIRST
task is to positively identify the source:
- Grep the GML for Gerson's dialogue, "HAMMER OF JUSTICE", green-soul scripts, spear/shell/hammer bullet
  objects, and the encounter room. Check `objects.tsv` for a Gerson controller and its default sprite.
- Determine whether Gerson maps to a **real Ch5 boss fight** (port it 1:1) or whether the DeltaVersus Gerson
  is a **custom green-soul design** assembled from real DELTARUNE assets/mechanics (then port the closest
  real green-soul/hammer mechanics + assets and design faithful attacks in that spirit).
- If Ch5 doesn't have it, check Chapters 1–4 GML/exports (same folder layout) for the source.
- Write your findings to `gerson_specs/00_source_map.md` (which objects, which room, which controller/type
  numbers, green-soul mechanic scripts, asset names). This gates everything else.

## 2. PLAN

1. **Extraction pass** — create `gerson_specs/` and run parallel background agents (playbook §5), one per
   subsystem/attack group + one for fight-flow/scenery/green-soul mechanic. Each writes an EXACT spec to
   `gerson_specs/<name>.md` and returns only a 1-line summary + path.
2. **Delete the old Gerson attacks** (or namespace new + remove old after verification).
3. **Build any scenery/backdrop layer** (fight staging), if applicable, as a reusable `fx.*` layer.
4. **Port attack-by-attack** from the specs. Verify each: `node --check` → headless `Battle.update` +
   `Battle.render` in try/catch → canvas-sample the key visuals → ONE screenshot. Commit per attack/batch.
5. **Green-soul mechanic:** port the exact block/timing rules (the fight is BLOCK-don't-dodge). Reuse
   `B.soulGreen` / the green shield box + Susie's axe block; match the GML's block window/damage exactly.
6. **Wire `CHARS.gerson`** to the new ids; balance damage to ~50 baseline (more for the finale/ult),
   comparable to Spamton Neo (playbook §2 damage flow).
7. **Deploy in verified batches** — bump the `?v=` on changed JS in `docs/index.html` + `ASSET_V` if sprites
   changed; version-bump the tester's `?v=` script stamps too. `git push origin main` → GitHub Pages.

## 3. HARD RULES (from the playbook — repeated because they matter)
- Read the WHOLE GML file before porting. Exact numbers, exact draw calls, exact colors (BGR→RGB), layer order.
- Paraphrase any copyrighted dialogue; never store the verbatim script.
- Sounds only play if the key is in `manifest.sfx`. 30 Hz sims must read input via press-edge on `Input.down`.
  Grep for existing function names before defining globals. Bump the tester `?v=` when JS changes (stale-cache).
- Verify headless before screenshots. Commit small, deploy verified. Recoverable from git history.

---

## AGENTIC HANDOVER PROMPT (paste this to the new AI to run recursively/agentically)

> You are rebuilding the **Gerson** boss fight in the DeltaVersus engine (`C:\Users\lando\Desktop\DeltaVersus`)
> at 100% mechanical + visual accuracy, ported directly from the decompiled DELTARUNE Chapter 5 GML. Work
> autonomously and recursively until Gerson is fully rebuilt, verified, and deployed.
>
> **Read first, in full:** `DELTAVERSUS_PORTING_PLAYBOOK.md` (how to do everything — engine, GML conventions,
> tooling, verification, agent strategy, gotchas) and `GERSON_REBUILD_HANDOVER.md` (this mission). Also skim
> `PINK_V3_HANDOVER.md` + a couple `pink_v3_specs/*.md` as a worked example.
>
> **Then execute the plan:**
> 1. STEP ZERO: positively identify Gerson's real GML source objects/room/controller and the green-soul
>    mechanic scripts (playbook §1 search strategy). Write `gerson_specs/00_source_map.md`. Do not proceed
>    until the source is confirmed.
> 2. Launch parallel background extraction agents (playbook §5) — one per attack/subsystem + one for
>    fight-flow/scenery/green-soul — each WRITING an exact spec to `gerson_specs/<name>.md` and returning
>    ONLY a 1-line summary + path. Do not let agents paste specs into your context.
> 3. Delete the old, not-working Gerson attacks (kit + `PATTERNS.gerson_*` + tester), following the safe
>    procedure in `GERSON_REBUILD_HANDOVER.md` §0 (make new self-contained → careful deletion → verify →
>    revert if a script over-deletes).
> 4. Port attack-by-attack from the specs into new namespaced patterns. After EACH: `node --check`, then a
>    headless `Battle.update`/`Battle.render` in a try/catch via the dev tester, then canvas-sample the key
>    visuals, then ONE screenshot. Fix, then commit that attack/batch with a clear message.
> 5. Port the green-soul BLOCK mechanic exactly (reuse `B.soulGreen`); wire `CHARS.gerson` to the new ids;
>    balance damage to ~50 baseline (more for the ult/finale).
> 6. Deploy in verified batches: bump `?v=` on changed JS in `docs/index.html` + `ASSET_V` if sprites
>    changed + the tester `?v=` stamps; `git push origin main`.
>
> **Rules:** Read whole GML files (no approximations). Paraphrase any copyrighted dialogue — never store the
> verbatim script. Verify headless before screenshots; don't spam screenshots. Watch the gotchas (sound keys
> must be in `manifest.sfx`; 30 Hz input via press-edge on `Input.down`; grep for name collisions before
> defining globals; bump the tester `?v=` when JS changes or the browser serves stale code; never reallocate
> a canvas every frame). Commit small and often; everything is recoverable from git. Keep your own context
> lean — read spec files on demand, prefer Grep/targeted Reads, don't paste large files. Work through the
> whole boss without stopping for confirmation; report progress as you deploy each verified batch.
