/**
 * GML Asset & Metadata Database (gml_asset_db.js)
 * Manages sprite metadata (originX, originY, dimensions, frames), object inheritance trees, and audio mapping for GML translation.
 * Designed to safely load assets under both http:// and file:/// protocols without recursive error loops.
 */

(function(global) {
  'use strict';

  class GMLAssetDatabase {
    constructor() {
      this.sprites = {};
      this.objects = {};
      this.sounds = {};
      this.imageCache = {};
      this.failedImages = new Set();
      this.chapter = '3';
      this.initialized = false;
    }

    /**
     * Initializes metadata from TSV data format (sprites.tsv, objects.tsv, sounds.tsv).
     */
    initFromTSV(spritesTSV = '', objectsTSV = '', soundsTSV = '') {
      if (spritesTSV) this.parseSpritesTSV(spritesTSV);
      if (objectsTSV) this.parseObjectsTSV(objectsTSV);
      if (soundsTSV) this.parseSoundsTSV(soundsTSV);
      this.initialized = true;
    }

    parseSpritesTSV(tsv) {
      const lines = tsv.trim().split(/\r?\n/);
      if (lines.length <= 1) return;
      
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split('\t');
        if (parts.length >= 6) {
          const name = parts[0].trim();
          this.sprites[name] = {
            name,
            frames: parseInt(parts[1], 10) || 1,
            width: parseInt(parts[2], 10) || 32,
            height: parseInt(parts[3], 10) || 32,
            originX: parseInt(parts[4], 10) || 0,
            originY: parseInt(parts[5], 10) || 0
          };
        }
      }
    }

    parseObjectsTSV(tsv) {
      const lines = tsv.trim().split(/\r?\n/);
      if (lines.length <= 1) return;

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split('\t');
        if (parts.length >= 7) {
          const name = parts[0].trim();
          this.objects[name] = {
            name,
            sprite: parts[1].trim(),
            maskSprite: parts[2].trim(),
            parent: parts[3].trim(),
            depth: parseInt(parts[4], 10) || 0,
            visible: parts[5].trim().toLowerCase() === 'true',
            persistent: parts[6].trim().toLowerCase() === 'true'
          };
        }
      }
    }

    parseSoundsTSV(tsv) {
      const lines = tsv.trim().split(/\r?\n/);
      if (lines.length <= 1) return;

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split('\t');
        if (parts.length >= 6) {
          const name = parts[0].trim();
          this.sounds[name] = {
            name,
            file: parts[1].trim(),
            volume: parseFloat(parts[4]) || 1.0,
            pitch: parseFloat(parts[5]) || 1.0
          };
        }
      }
    }

    getSpriteInfo(sprName) {
      if (!sprName) return null;
      if (this.sprites[sprName]) return this.sprites[sprName];
      
      return {
        name: sprName,
        frames: 1,
        width: 32,
        height: 32,
        originX: 16,
        originY: 16
      };
    }

    getObjectInfo(objName) {
      if (!objName) return null;
      if (this.objects[objName]) return this.objects[objName];

      return {
        name: objName,
        sprite: '',
        parent: 'obj_bulletparent',
        depth: 0,
        visible: true,
        persistent: false
      };
    }

    /**
     * Resolves Image Element for GML sprite & frame index.
     * Handles file:/// and http:// protocols safely.
     */
    getSpriteImage(sprName, frameIdx = 0) {
      if (!sprName) return null;
      const frame = Math.max(0, Math.floor(frameIdx || 0));
      const cacheKey = `${sprName}_${frame}`;

      if (this.failedImages.has(cacheKey)) return null;

      if (this.imageCache[cacheKey]) {
        const img = this.imageCache[cacheKey];
        return (img.complete && img.naturalWidth > 0) ? img : null;
      }

      const img = new Image();
      let path = '';

      if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        // Absolute file:/// path for local file protocol execution
        path = `file:///C:/Users/lando/Desktop/DELTARUNE - EXPORT/DELTARUNE Chapter ${this.chapter} - EXPORT/sprites/${sprName}_${frame}.png`;
      } else {
        path = `../DELTARUNE - EXPORT/DELTARUNE Chapter ${this.chapter} - EXPORT/sprites/${sprName}_${frame}.png`;
      }

      img.onload = () => {
        // Successfully loaded exported sprite
      };

      img.onerror = () => {
        // If exported PNG fails, try local bullets folder once without recursive loop
        img.onerror = () => {
          this.failedImages.add(cacheKey);
        };
        const fallbackName = this.resolveAssetFilename(sprName);
        img.src = `assets/bullets/${fallbackName}`;
      };

      img.src = path;
      this.imageCache[cacheKey] = img;
      return null;
    }

    resolveAssetFilename(sprName) {
      if (!sprName) return 'diamond.png';
      let clean = sprName.replace(/^spr_/, '').toLowerCase();
      clean = clean.replace(/_ol$/, '');
      clean = clean.replace(/_dw$/, '');
      clean = clean.replace(/_bullet$/, '');

      if (clean.includes('knight_bullet_star') || clean.includes('knight_star')) return 'knightstar.png';
      if (clean.includes('knight_pointing_cone') || clean.includes('knight_cone')) return 'knightpoint0.png';
      if (clean.includes('knight_tunnel') || clean.includes('knight_sword')) return 'knightsword.png';
      if (clean.includes('gerson_hammer')) return 'ghammer.png';
      if (clean.includes('gerson_squish') || clean.includes('gerson_slash')) return 'gswdown.png';
      if (clean.includes('sneo_head')) return 'sneohead.png';
      if (clean.includes('sneo_mail')) return 'sneomail.png';
      if (clean.includes('sneo_crew')) return 'sneocrew.png';
      if (clean.includes('sneo_bomb')) return 'sneobomb.png';
      if (clean.includes('growtangle')) return 'sneobox.png';

      return 'diamond.png';
    }
  }

  global.GMLAssetDatabase = GMLAssetDatabase;
  global.gmlAssets = new GMLAssetDatabase();

})(typeof window !== 'undefined' ? window : global);
