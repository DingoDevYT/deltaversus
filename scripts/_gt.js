const fs = require('fs');
const p = 'docs/js/gml_runtime.js';
let s = fs.readFileSync(p, 'utf8');
const a = "      this.instances.push(gtInst);\n      this.growtangle = gtInst;";
if (!s.includes(a)) { console.error('anchor not found'); process.exit(1); }
s = s.replace(a, [
  "      this.instances.push(gtInst);",
  "      // MUST be indexed too. This is the one instance that does not go through",
  "      // createInstance, so without it the id map never learns about the BATTLE",
  "      // BOX and instanceById(99999) returns null - which makes every $R.d(id)",
  "      // dereference of the box yield NaN coordinates, and Canvas silently skips",
  "      // any draw containing a NaN.",
  "      this.$byId.set(gtInst.id, gtInst);",
  "      this.growtangle = gtInst;",
].join('\n'));
fs.writeFileSync(p, s);
console.log('growtangle indexed in $byId');
