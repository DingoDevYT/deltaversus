/**
 * Build scripts/spec_overrides.json from the CURRENT merged specs.
 *
 * build_attack_specs.js merges by id and the later source replaces the spec
 * WHOLESALE, so an override must carry the attack's whole assertion list — a
 * hand-written partial would silently delete every assertion it did not restate.
 * That is why this is generated rather than edited.
 *
 * A correction belongs here ONLY when the assertion is wrong about the GAME.
 * An assertion that fails because the ENGINE is wrong stays, and the engine gets
 * fixed instead.
 *
 *   node scripts/make_spec_overrides.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const src = fs.readFileSync(path.join(ROOT, 'docs/js/attack_specs.js'), 'latin1');
const specs = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
const byId = new Map(specs.map(s => [s.id, s]));
const out = [];

// ── Queen: the Plug box moves, so only its SIZE is assertable ───────────────
const PLUG_NOTE = 'Box POSITION is not assertable on this attack. The controller branch creates obj_growtangle_electric on top of the box (obj_queen_bulletcontroller_Step_0.gml:934-947), and that object drives the box around BY DESIGN: obj_growtangle_electric_Step_0.gml:33-34 sets obj_growtangle.x = xstart + random_range((-35 + timer) / 2, (35 - timer) / 2) — a decaying RANDOM shake — and :140/:145 then slide it to xstart + moveamount. So x/y have no single right answer once the attack runs; 320,200 is true only at the instant of creation. The SIZE is fully determined and is kept.';

for (const [id, why] of [
  ['queen_type110', 'rr 9 creates the box with the default maxxscale/maxyscale 2 on the 75x75 sprite; only difficulty 1 rescales it, and type 110 IS the difficulty-0 variant'],
  ['queen_type111', 'rr 9 at difficulty 1 rescales obj_growtangle to maxxscale 1.5 / maxyscale 2; the custom-box quantiser snaps 1.5 to 56/37.5, so the 75x75 sprite measures 112 wide by 150 tall'],
]) {
  const a = byId.get(id);
  if (!a) throw new Error('missing ' + id);
  const copy = JSON.parse(JSON.stringify(a));
  let touched = 0;
  copy.assertions = copy.assertions.map(x => {
    if (x.kind !== 'box') return x;
    touched++;
    const { x: _x, y: _y, ...rest } = x;
    return { ...rest, why, src: x.src };
  });
  if (touched !== 1) throw new Error(id + ': expected 1 box assertion, found ' + touched);
  copy.note = PLUG_NOTE;
  out.push(copy);
}

// ── Flowery: the box is at 315, not 320 ────────────────────────────────────
//
// obj_flowery_enemy_Step_0.gml:1112-1119 creates obj_growtangle at view + 320
// and then, three lines later inside `with (obj_growtangle)`, does `x -= 5`.
// The authors read the creation and missed the shift, so every value derived
// from the box came out 5 too high — obj_orangeheart is created at
// `scr_get_box(4) - 75` = obj_growtangle.x - 75, and the soul's own draws and
// the markers placed at `obj_orangeheart.x + 10` inherit it.
//
// The correction is the FORMULA re-evaluated with the real box x (315), which
// works out to x - 5 for every affected assertion. The engine's measurement is
// used only to IDENTIFY which assertions carried the wrong premise, never to
// source the number, and anything failing for another reason is left alone.
const FLOWERY_NOTE = 'Corrected: obj_flowery_enemy_Step_0.gml:1119 does `x -= 5` on the growtangle inside the `with` block three lines after creating it at view + 320, so the box sits at 315. Every value derived from the box — obj_orangeheart at scr_get_box(4) - 75, and the draws anchored on the soul at +10 — is 5 lower than first authored.';
const RUN = path.join(ROOT, 'spec_run.json');
let floweryFixed = 0;
const floweryLeft = [];
if (fs.existsSync(RUN)) {
  const run = JSON.parse(fs.readFileSync(RUN, 'utf8'));
  const fl = run.bosses && run.bosses.flowery;
  if (fl && fl.failures) {
    const shift = new Map();                     // attack id -> failing assertion strings
    for (const f of fl.failures) {
      const want = /x=(-?\d+)/.exec(f.assertion);
      const got = /(-?\d+),(-?\d+)/.exec(String(f.got));
      const wantY = /y=(-?\d+)/.exec(f.assertion);
      // A PURE x shift of exactly 5, with y (when asserted) already correct.
      const pureShift = want && got && Number(want[1]) - Number(got[1]) === 5
        && (!wantY || Math.abs(Number(wantY[1]) - Number(got[2])) <= 2);
      if (!pureShift) { floweryLeft.push(f.id + ' | ' + f.assertion + '  GOT ' + f.got); continue; }
      if (!shift.has(f.id)) shift.set(f.id, new Set());
      shift.get(f.id).add(f.assertion);
    }
    for (const [id, assertions] of shift) {
      const a = byId.get(id);
      if (!a) continue;
      const copy = JSON.parse(JSON.stringify(a));
      copy.assertions = copy.assertions.map(x => {
        if (x.x == null) return x;
        const subject = x.obj || x.name;
        const hit = [...assertions].some(s =>
          s.startsWith(x.kind + '(') && s.includes(String(subject)) && s.includes('x=' + x.x));
        if (!hit) return x;
        floweryFixed++;
        return { ...x, x: x.x - 5, why: x.why + ' [box sits at 315: obj_flowery_enemy_Step_0.gml:1119 does x -= 5]' };
      });
      copy.note = copy.note ? copy.note + ' — ' + FLOWERY_NOTE : FLOWERY_NOTE;
      out.push(copy);
    }
  }
}

const doc = {
  _what: 'Hand-corrected specs, merged LAST by build_attack_specs.js so they win the by-id merge. attack_specs.js is generated and must never be hand-edited; a correction found by triaging a failure belongs here, held to the same evidence bar as an authored assertion — a file:line that states the fact.',
  _careful: "The merge replaces a spec WHOLESALE by id, so every entry here carries the attack's COMPLETE assertion list, not just the corrected one. Regenerate with scripts/make_spec_overrides.js rather than editing by hand.",
  _when: 'ONLY when the assertion is wrong about the GAME. An assertion that fails because the ENGINE is wrong must stay, and the engine must be fixed instead.',
  specs: out,
};
fs.writeFileSync(path.join(ROOT, 'scripts/spec_overrides.json'), JSON.stringify(doc, null, 2) + '\n');
console.log('queen: 2 box assertions narrowed to size only');
console.log(`flowery: ${floweryFixed} assertions shifted -5 in x across ${out.length - 2} attacks`);
console.log(`flowery: ${floweryLeft.length} failures LEFT ALONE (not a pure 5px shift — investigate these):`);
floweryLeft.forEach(f => console.log('   ' + f));
console.log('wrote scripts/spec_overrides.json');
