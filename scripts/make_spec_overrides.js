/**
 * Build scripts/spec_overrides.json from the CURRENT merged specs, so an
 * override carries the attack's whole assertion list. build_attack_specs.js
 * merges by id and the later source replaces the spec WHOLESALE, so a partial
 * override would silently delete every assertion it did not restate.
 */
const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/lando/Desktop/DeltaVersus';

const src = fs.readFileSync(path.join(ROOT, 'docs/js/attack_specs.js'), 'latin1');
const specs = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;\s*$/, ''));

const NOTE_110 = 'Box POSITION is not assertable on this attack. The controller branch creates obj_growtangle_electric on top of the box (obj_queen_bulletcontroller_Step_0.gml:934-947), and that object drives the box around BY DESIGN: obj_growtangle_electric_Step_0.gml:33-34 sets obj_growtangle.x = xstart + random_range((-35 + timer) / 2, (35 - timer) / 2) — a decaying RANDOM shake — and :140/:145 then slide it to xstart + moveamount. So x/y have no single right answer once the attack runs; 320,200 is true only at the instant of creation. The SIZE is fully determined and is kept.';
const NOTE_111 = 'Same as queen_type110: obj_growtangle_electric shakes and then slides the box (Step_0:33-34, :140, :145), so only the SIZE is assertable. The width is the half that matters anyway — it is what proves the difficulty-1 branch ran.';

const WHY_110 = 'rr 9 creates the box with the default maxxscale/maxyscale 2 on the 75x75 sprite; only difficulty 1 rescales it, and type 110 IS the difficulty-0 variant';
const WHY_111 = 'rr 9 at difficulty 1 rescales obj_growtangle to maxxscale 1.5 / maxyscale 2; the custom-box quantiser snaps 1.5 to 56/37.5, so the 75x75 sprite measures 112 wide by 150 tall';

const out = [];
for (const [id, note, why] of [['queen_type110', NOTE_110, WHY_110], ['queen_type111', NOTE_111, WHY_111]]) {
  const a = specs.find(s => s.id === id);
  if (!a) throw new Error('missing ' + id);
  const copy = JSON.parse(JSON.stringify(a));
  let touched = 0;
  copy.assertions = copy.assertions.map(x => {
    if (x.kind !== 'box') return x;
    touched++;
    const { x: _x, y: _y, ...rest } = x;      // drop position, keep w/h/tol
    return { ...rest, why, src: x.src };
  });
  if (touched !== 1) throw new Error(id + ': expected exactly 1 box assertion, found ' + touched);
  copy.note = copy.note ? copy.note + ' — ' + note : note;
  out.push(copy);
  console.log(id + ': ' + copy.assertions.length + ' assertions kept, box position dropped');
}

const doc = {
  _what: 'Hand-corrected specs, merged LAST by build_attack_specs.js so they win the by-id merge. attack_specs.js is generated and must never be hand-edited; a correction found by triaging a failure belongs here, held to the same evidence bar as an authored assertion — a file:line that states the fact.',
  _careful: 'The merge replaces a spec WHOLESALE by id, so every entry here must carry the attack\'s COMPLETE assertion list, not just the corrected one. Regenerate with scripts/make_spec_overrides.js rather than editing by hand.',
  _when: 'ONLY when the assertion is wrong about the GAME. An assertion that fails because the ENGINE is wrong must stay, and the engine must be fixed instead.',
  specs: out,
};
fs.writeFileSync(path.join(ROOT, 'scripts/spec_overrides.json'), JSON.stringify(doc, null, 2) + '\n');
console.log('wrote scripts/spec_overrides.json');
