// src/map/pipeline/heightmap.js
import { createSeededNoise, fbm, warpedFbm, ridgedNoise } from '../utils/noise.js';
import { GRID } from './tectonics.js';

/**
 * Generate a heightmap for one keyframe.
 *
 * @param {Float32Array} tectonicStress  from tectonics.js
 * @param {number} T                     time value
 * @param {string} seed                  world seed
 * @returns {Float32Array} GRID*GRID heightmap, values in [-1, 1]
 */
export function generateHeightmap(tectonicStress, T, seed) {
  const noise1 = createSeededNoise(seed + '-h1');
  const noise2 = createSeededNoise(seed + '-h2');
  const ridgeNoise = createSeededNoise(seed + '-ridge');
  const height = new Float32Array(GRID * GRID);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const idx = y * GRID + x;
      const nx = x / GRID;
      const ny = y / GRID;

      // 1. Base continent shape — warped fBm for organic coastlines
      let h = warpedFbm(noise1, nx * 3, ny * 3, 0.8, 7);

      // 2. Continent mask — keep land coherent, reduce edge noise
      const cx = nx - 0.5;
      const cy = ny - 0.5;
      const distFromCenter = Math.sqrt(cx * cx + cy * cy) * 2;
      const continentMask = 1.0 - smoothstep(0.4, 0.9, distFromCenter);
      h = h * 0.6 + h * continentMask * 0.4;

      // 3. Tectonic influence — collision zones become mountains
      const stress = tectonicStress[idx];
      if (stress > 0) {
        const ridge = ridgedNoise(ridgeNoise, nx * 6, ny * 6, 5);
        h += stress * ridge * 0.6;
      } else {
        h += stress * 0.4;
      }

      // 4. Fine detail layer
      const detail = fbm(noise2, nx * 12, ny * 12, 4, 2.0, 0.4);
      h += detail * 0.1;

      // 5. Time-based erosion softening
      const erosionFactor = Math.min(1.0, T / 500000);
      h = h * (1.0 - erosionFactor * 0.15);

      height[idx] = Math.max(-1, Math.min(1, h));
    }
  }

  return height;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
