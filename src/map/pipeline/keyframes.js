// src/map/pipeline/keyframes.js
import { generatePlates, GRID } from './tectonics.js';
import { generateHeightmap } from './heightmap.js';
import { erode } from './erosion.js';
import { generateRivers } from './hydrology.js';
import { assignBiomes } from './biomes.js';

/**
 * Pre-compute all era keyframe heightmaps.
 *
 * @param {object[]} eras  array of era objects (uses .year field, falls back to even spacing)
 * @param {string} worldSeed
 * @param {Function} [onProgress]  callback(eraIndex, totalEras) for progress reporting
 * @returns {object[]} keyframes, each with { T, heightmap, biomes, rivers, plates }
 */
export function computeKeyframes(eras, worldSeed, onProgress) {
  const keyframes = [];

  for (let i = 0; i < eras.length; i++) {
    // Use .year field from world.json, remap to 0-1M range, or fall back to even spacing
    const T = eras[i].year != null
      ? remapYear(eras[i].year, eras)
      : (i / (eras.length - 1)) * 1000000;

    // 1. Plate tectonics
    const { plateMap, stress } = generatePlates(9, T, worldSeed);

    // 2. Heightmap
    const heightmap = generateHeightmap(stress, T, worldSeed);

    // 3. Erosion — more iterations for older eras
    const erosionIterations = Math.floor(30000 + (T / 1000000) * 30000);
    erode(heightmap, erosionIterations, worldSeed + '-e' + i);

    // 4. Rivers
    const { rivers, flowAccum } = generateRivers(heightmap, 250);

    // 5. Biomes
    const biomes = assignBiomes(heightmap, stress, flowAccum, worldSeed);

    keyframes.push({
      T,
      heightmap,
      biomes,
      rivers,
      plateMap,
      stress,
    });

    if (onProgress) onProgress(i + 1, eras.length);
  }

  return keyframes;
}

/**
 * Remap existing era year values to 0-1,000,000 range.
 * Current world.json uses years like -500000 to 200000.
 */
function remapYear(year, eras) {
  const years = eras.map(e => e.year).filter(y => y != null);
  if (years.length < 2) return 500000;
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const range = maxYear - minYear;
  if (range === 0) return 500000;
  return ((year - minYear) / range) * 1000000;
}

export { GRID };
