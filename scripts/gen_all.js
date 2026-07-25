/**
 * gen_all.js — regenerate every derived table, in the right order.
 *
 * Run this instead of the individual generators. The passes are order-dependent
 * AND mutually dependent:
 *
 *   gen_attacks   reads the GML export            -> gml_attacks.js
 *   gen_objects   reads gml_attacks + gml_scripts -> gml_objects.js
 *   gen_scripts   reads gml_objects               -> gml_scripts.js
 *   gen_object_index                              -> gml_object_index.js
 *   sync_sprites  reads all of the above          -> sprites + manifest + origins
 *
 * Objects and scripts reference each other — an object event calls scripts, and a
 * script creates objects — so one pass each leaves gaps (the boss objects pulled
 * in by gen_attacks introduced calls to scripts gen_scripts had already finished
 * collecting). Repeat the pair until both stop growing.
 *
 *   node scripts/gen_all.js
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const JS = path.join(HERE, '..', 'docs', 'js');

function run(script) {
  process.stdout.write(`\n── ${script} ──\n`);
  const out = execFileSync(process.execPath, [path.join(HERE, script)], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  // Only echo the summary lines; these generators are chatty.
  for (const line of out.split('\n')) {
    if (/^(ch[0-9]:|wrote|copied|resolved|sprite (meta|names)|real attacks|pruned|skipped|\s+\(\+)/.test(line)) {
      console.log('  ' + line.trim());
    }
  }
  return out;
}

/** Counts that tell us whether a pass actually added anything. */
function fingerprint() {
  const read = f => (fs.existsSync(path.join(JS, f)) ? fs.statSync(path.join(JS, f)).size : 0);
  return `${read('gml_objects.js')}:${read('gml_scripts.js')}`;
}

run('gen_attacks.js');

let previous = '';
for (let round = 1; round <= 4; round++) {
  console.log(`\n═══ object/script round ${round} ═══`);
  run('gen_objects.js');
  run('gen_scripts.js');
  const now = fingerprint();
  if (now === previous) {
    console.log(`\nconverged after round ${round}.`);
    break;
  }
  previous = now;
  if (round === 4) console.log('\nstopped at the round cap; tables may still be growing.');
}

run('gen_object_index.js');
run('sync_sprites.js');

console.log('\nAll tables regenerated. Verify with:');
console.log('  node scripts/test_semantics.js && node scripts/test_compiler.js && node scripts/test_runtime.js');
