/**
 * Auto-discovers ALL GML attack objects for Knight (Ch 3), Gerson (Ch 4), and SNEO (Ch 2)
 * and generates docs/js/gml_presets.js containing 100% raw GML source code for every attack.
 */

const fs = require('fs');
const path = require('path');

const BOSS_DIRS = [
  { name: 'Knight (Chapter 3)', dir: 'c:\\Users\\lando\\Desktop\\DELTARUNE - GML\\DELTARUNE Chapter 3 - GML', pattern: /^gml_Object_(obj_knight_[a-zA-Z0-9_]+|obj_roaringknight_[a-zA-Z0-9_]+)_Step_0\.gml$/ },
  { name: 'Gerson (Chapter 4)', dir: 'c:\\Users\\lando\\Desktop\\DELTARUNE - GML\\DELTARUNE Chapter 4 - GML', pattern: /^gml_Object_(obj_gerson_[a-zA-Z0-9_]+)_Step_0\.gml$/ },
  { name: 'Spamton NEO (Chapter 2)', dir: 'c:\\Users\\lando\\Desktop\\DELTARUNE - GML\\DELTARUNE Chapter 2 - GML', pattern: /^gml_Object_(obj_sneo_[a-zA-Z0-9_]+)_Step_0\.gml$/ }
];

const presets = {};

for (const boss of BOSS_DIRS) {
  if (!fs.existsSync(boss.dir)) continue;

  const files = fs.readdirSync(boss.dir);
  for (const file of files) {
    const match = file.match(boss.pattern);
    if (!match) continue;

    const objName = match[1];
    const prefix = `gml_Object_${objName}`;

    const createPath = path.join(boss.dir, `${prefix}_Create_0.gml`);
    const stepPath = path.join(boss.dir, `${prefix}_Step_0.gml`);
    const drawPath = path.join(boss.dir, `${prefix}_Draw_0.gml`);

    const createCode = fs.existsSync(createPath) ? fs.readFileSync(createPath, 'utf8') : '';
    const stepCode = fs.existsSync(stepPath) ? fs.readFileSync(stepPath, 'utf8') : '';
    const drawCode = fs.existsSync(drawPath) ? fs.readFileSync(drawPath, 'utf8') : '';

    const label = `${boss.name} — ${objName}`;

    presets[objName] = {
      name: objName,
      label: label,
      create: createCode,
      step: stepCode,
      draw: drawCode
    };

    console.log(`Discovered: [${objName}] (${createCode.length}B Create, ${stepCode.length}B Step, ${drawCode.length}B Draw)`);
  }
}

const outFile = 'c:\\Users\\lando\\Desktop\\DeltaVersus\\docs\\js\\gml_presets.js';
const content = `window.GML_MASTER_PRESETS = ${JSON.stringify(presets, null, 2)};\n`;
fs.writeFileSync(outFile, content, 'utf8');

console.log(`\nSuccessfully saved ${Object.keys(presets).length} raw GML attack presets to ${outFile}`);
