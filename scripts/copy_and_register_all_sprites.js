/**
 * Scans all GML presets for spr_* references, copies matching sprite PNGs
 * from EXPORT folders into docs/sprites/, and generates an exhaustive gml_asset_db.js.
 */

const fs = require('fs');
const path = require('path');

const DEST_DIR = 'c:\\Users\\lando\\Desktop\\DeltaVersus\\docs\\sprites';
if (!fs.existsSync(DEST_DIR)) fs.mkdirSync(DEST_DIR, { recursive: true });

const EXPORT_DIRS = [
  'c:\\Users\\lando\\Desktop\\DELTARUNE - EXPORT\\DELTARUNE Chapter 3 - EXPORT\\sprites',
  'c:\\Users\\lando\\Desktop\\DELTARUNE - EXPORT\\DELTARUNE Chapter 4 - EXPORT\\sprites',
  'c:\\Users\\lando\\Desktop\\DELTARUNE - EXPORT\\DELTARUNE Chapter 2 - EXPORT\\sprites'
];

// Load presets code to discover all referenced spr_* names
const presetsFile = 'c:\\Users\\lando\\Desktop\\DeltaVersus\\docs\\js\\gml_presets.js';
const content = fs.readFileSync(presetsFile, 'utf8');
const matches = content.match(/spr_[a-zA-Z0-9_]+/g) || [];
const uniqueSprites = new Set(matches);

// Also add core standard battle sprites
[
  'spr_heart', 'spr_heart_gt', 'spr_heart_yellow', 'spr_growtangle',
  'spr_knight_bullet_star', 'spr_knight_bullet_star_mask', 'spr_knight_starchild', 'spr_knight_starchild_parts',
  'spr_knight_diamondbullet_m', 'spr_knight_diamondbullet_l', 'spr_knight_diamondswordbullet',
  'spr_gerson_dodge_origin_top_bottom', 'spr_gerson_hammer_bullet', 'spr_gerson_spin', 'spr_gerson_teleport',
  'spr_sneo_head', 'spr_sneo_bomb', 'spr_sneo_mail', 'spr_sneo_phone', 'spr_sneo_phonebullet'
].forEach(s => uniqueSprites.add(s));

console.log(`Discovered ${uniqueSprites.size} unique sprite references across GML presets.`);

const spriteMap = {}; // sprName -> array of frame filenames relative to docs/sprites/
let totalCopied = 0;

for (const sprName of uniqueSprites) {
  let found = false;

  for (const expDir of EXPORT_DIRS) {
    if (!fs.existsSync(expDir)) continue;

    const files = fs.readdirSync(expDir);
    // Find files like sprName_0.png, sprName_1.png or sprName.png
    const matchingFiles = files.filter(f => f.startsWith(sprName + '_') || f === (sprName + '.png'));

    if (matchingFiles.length > 0) {
      found = true;
      spriteMap[sprName] = [];

      for (const mf of matchingFiles) {
        const srcPath = path.join(expDir, mf);
        const destPath = path.join(DEST_DIR, mf);
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(srcPath, destPath);
          totalCopied++;
        }
        spriteMap[sprName].push(mf);
      }
      break;
    }
  }

  if (!found) {
    // console.log(`Notice: Sprite [${sprName}] not found in export folders.`);
  }
}

console.log(`Copied ${totalCopied} new sprite PNG files to docs/sprites/. Total mapped sprites: ${Object.keys(spriteMap).length}`);

// Generate gml_asset_db.js content
const dbContent = `/**
 * GML Asset Database — Maps GML sprite names to exported PNG frame files.
 */
(function(global) {
  'use strict';

  class GMLAssetDatabase {
    constructor() {
      this.sprites = {};
      this.loadedCount = 0;
      this.totalRequested = 0;
      this.failedCount = 0;
      this._init();
    }

    _init() {
      const spriteFiles = ${JSON.stringify(spriteMap, null, 2)};

      for (const [name, files] of Object.entries(spriteFiles)) {
        this.sprites[name] = {
          frames: [],
          frameCount: files.length,
          loaded: false
        };

        files.forEach((f, idx) => {
          this.totalRequested++;
          const img = new Image();
          img.onload = () => {
            this.loadedCount++;
            if (idx === 0) this.sprites[name].loaded = true;
          };
          img.onerror = () => {
            this.failedCount++;
          };
          img.src = 'sprites/' + f;
          this.sprites[name].frames.push(img);
        });
      }
    }

    getSprite(spriteName) {
      if (!spriteName) return null;
      if (typeof spriteName !== 'string') spriteName = String(spriteName);
      return this.sprites[spriteName] || null;
    }

    drawSprite(ctx, spriteName, frameIdx, x, y, xscale = 1, yscale = 1, rotDeg = 0, alpha = 1, blendColor = null) {
      const spr = this.getSprite(spriteName);
      if (!spr || spr.frames.length === 0) {
        // Fallback placeholder rectangle if sprite image is not loaded
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((rotDeg * Math.PI) / 180);
        ctx.fillStyle = blendColor || '#ff00ff';
        ctx.globalAlpha = alpha;
        ctx.fillRect(-12 * xscale, -12 * yscale, 24 * xscale, 24 * yscale);
        ctx.restore();
        return;
      }

      const idx = Math.floor(Math.abs(frameIdx || 0)) % spr.frames.length;
      const img = spr.frames[idx];
      if (!img || !img.complete || img.naturalWidth === 0) return;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.scale(xscale, yscale);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();
    }

    getLoadStatus() {
      return {
        loaded: this.loadedCount,
        requested: this.totalRequested,
        failed: this.failedCount
      };
    }
  }

  global.GMLAssetDatabase = GMLAssetDatabase;
  global.gmlAssets = new GMLAssetDatabase();

})(typeof window !== 'undefined' ? window : global);
`;

fs.writeFileSync('c:\\Users\\lando\\Desktop\\DeltaVersus\\docs\\js\\gml_asset_db.js', dbContent, 'utf8');
console.log(`Updated docs/js/gml_asset_db.js with ${Object.keys(spriteMap).length} sprite registrations!`);
