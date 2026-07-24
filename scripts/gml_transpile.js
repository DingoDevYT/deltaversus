/**
 * Node.js CLI Utility: gml_transpile.js
 * Transpiles GML files or GML attack scripts into JavaScript pattern objects.
 * Usage: node scripts/gml_transpile.js <path-to-gml-file>
 */

const fs = require('fs');
const path = require('path');

// Include runtime & translator modules
const gmlRuntimeCode = fs.readFileSync(path.join(__dirname, '../docs/js/gml_runtime.js'), 'utf8');
const gmlTranslatorCode = fs.readFileSync(path.join(__dirname, '../docs/js/gml_translator.js'), 'utf8');

// Evaluate in Node environment
eval(gmlRuntimeCode);
eval(gmlTranslatorCode);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/gml_transpile.js <path-to-gml-file-or-directory>');
  process.exit(1);
}

const targetPath = path.resolve(args[0]);

if (!fs.existsSync(targetPath)) {
  console.error(`Error: Path does not exist: ${targetPath}`);
  process.exit(1);
}

const translator = new GMLTranslator();

if (fs.statSync(targetPath).isFile()) {
  console.log(`Transpiling file: ${targetPath}`);
  const gmlContent = fs.readFileSync(targetPath, 'utf8');
  const jsOutput = translator.translate(gmlContent);

  console.log('\n--- Transpiled JS Output ---\n');
  console.log(jsOutput);
} else {
  console.log(`Transpiling directory: ${targetPath}`);
  const files = fs.readdirSync(targetPath).filter(f => f.endsWith('.gml'));
  console.log(`Found ${files.length} .gml files.`);
  
  files.slice(0, 5).forEach(file => {
    const filePath = path.join(targetPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const out = translator.translate(content);
    console.log(`\n=== Transpiled [${file}] ===\n${out.slice(0, 300)}...`);
  });
}
