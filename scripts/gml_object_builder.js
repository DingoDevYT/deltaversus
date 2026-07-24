/**
 * Node.js CLI Utility: gml_object_builder.js
 * Assembles and transpiles full multi-script GameMaker objects from decompiled .gml files into JS classes.
 * Usage: node scripts/gml_object_builder.js <object_name> [chapter_number]
 * Example: node scripts/gml_object_builder.js obj_knight_pointing_star 3
 */

const fs = require('fs');
const path = require('path');

// Include DB, Runtime, and Translator
const dbCode = fs.readFileSync(path.join(__dirname, '../docs/js/gml_asset_db.js'), 'utf8');
const runtimeCode = fs.readFileSync(path.join(__dirname, '../docs/js/gml_runtime.js'), 'utf8');
const translatorCode = fs.readFileSync(path.join(__dirname, '../docs/js/gml_translator.js'), 'utf8');

eval(dbCode);
eval(runtimeCode);
eval(translatorCode);

// Load TSV Reference Data if available
const refDataDir = path.join(__dirname, '../../DELTARUNE - REF DATA/DELTARUNE Chapter 3 - REFDATA');
if (fs.existsSync(refDataDir)) {
  const spritesTSV = fs.readFileSync(path.join(refDataDir, 'sprites.tsv'), 'utf8');
  const objectsTSV = fs.readFileSync(path.join(refDataDir, 'objects.tsv'), 'utf8');
  const soundsTSV = fs.readFileSync(path.join(refDataDir, 'sounds.tsv'), 'utf8');
  gmlAssets.initFromTSV(spritesTSV, objectsTSV, soundsTSV);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/gml_object_builder.js <object_name> [chapter_num]');
  process.exit(1);
}

const objName = args[0];
const chNum = args[1] || '3';
const gmlDir = path.join(__dirname, `../../DELTARUNE - GML/DELTARUNE Chapter ${chNum} - GML`);

if (!fs.existsSync(gmlDir)) {
  console.error(`Error: GML Directory does not exist: ${gmlDir}`);
  process.exit(1);
}

console.log(`Scanning for object scripts: [${objName}] in Chapter ${chNum}...`);

const files = fs.readdirSync(gmlDir).filter(f => f.startsWith(`gml_Object_${objName}_`));

if (files.length === 0) {
  console.error(`No GML scripts found matching pattern: gml_Object_${objName}_*.gml`);
  process.exit(1);
}

const events = {};
files.forEach(f => {
  const content = fs.readFileSync(path.join(gmlDir, f), 'utf8');
  if (f.includes('_Create_0.gml')) events.create = content;
  else if (f.includes('_Step_0.gml')) events.step = content;
  else if (f.includes('_Draw_0.gml')) events.draw = content;
  else {
    const alarmMatch = f.match(/_Alarm_([0-9]+)\.gml$/);
    if (alarmMatch) {
      events[`alarm_${alarmMatch[1]}`] = content;
    }
  }
});

const translator = new GMLTranslator();
const result = translator.compileObject(objName, events);

console.log(`\n======================================================`);
console.log(`Successfully compiled GML Object: ${objName}`);
console.log(`Events found: ${Object.keys(events).join(', ')}`);
console.log(`Parent object: ${gmlAssets.getObjectInfo(objName)?.parent || 'GMLInstance'}`);
console.log(`Default sprite: ${gmlAssets.getObjectInfo(objName)?.sprite || 'none'}`);
console.log(`======================================================\n`);

console.log(result.code);
