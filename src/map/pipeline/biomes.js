// src/map/pipeline/biomes.js
import { createSeededNoise, fbm } from '../utils/noise.js';
import { BIOME } from '../utils/colors.js';
import { GRID } from './tectonics.js';

/**
 * Assign biomes to each cell based on temperature, precipitation, elevation.
 *
 * @param {Float32Array} heightmap     GRID*GRID
 * @param {Float32Array} tecStress     tectonic stress
 * @param {Float32Array} flowAccum     river flow accumulation
 * @param {string} seed
 * @returns {Int8Array} GRID*GRID biome IDs
 */
export function assignBiomes(heightmap, tecStress, flowAccum, seed) {
  const biomes = new Int8Array(GRID * GRID);
  const tempNoise = createSeededNoise(seed + '-temp');
  const precNoise = createSeededNoise(seed + '-prec');

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const idx = y * GRID + x;
      const h = heightmap[idx];
      const nx = x / GRID;
      const ny = y / GRID;

      // Water biomes
      if (h < 0) {
        if (h < -0.6) {
          biomes[idx] = BIOME.ABYSSAL_TRENCH;
        } else if (h < -0.3) {
          biomes[idx] = BIOME.DEEP_OCEAN;
        } else if (h < -0.05) {
          biomes[idx] = BIOME.CORAL_SHALLOWS;
        } else {
          biomes[idx] = BIOME.MANGROVE_COAST;
        }
        continue;
      }

      // Temperature: latitude-based + altitude reduction + noise
      const latFactor = Math.abs(ny - 0.5) * 2;
      let temperature = 1.0 - latFactor * 1.2;
      temperature -= h * 0.6;
      temperature += fbm(tempNoise, nx * 5, ny * 5, 3) * 0.15;
      temperature = Math.max(0, Math.min(1, temperature));

      // Precipitation: ocean proximity + rain shadow + noise
      let precipitation = 0.5;
      const coastDist = getCoastDistance(heightmap, x, y);
      precipitation += Math.max(0, 0.3 - coastDist * 0.01);
      if (tecStress[idx] > 0.2) precipitation -= 0.2;
      if (flowAccum[idx] > 50) precipitation += 0.15;
      precipitation += fbm(precNoise, nx * 4, ny * 4, 3) * 0.2;
      precipitation = Math.max(0, Math.min(1, precipitation));

      biomes[idx] = classifyBiome(temperature, precipitation, h, tecStress[idx]);
    }
  }

  return biomes;
}

/**
 * Classify a cell into one of 30 land biomes.
 */
function classifyBiome(temp, precip, height, stress) {
  // High altitude biomes
  if (height > 0.7) {
    if (temp < 0.2) return BIOME.GLACIAL_PEAKS;
    if (stress > 0.3) return BIOME.SACRED_MOUNTAINS;
    if (height > 0.85) return BIOME.SKY_RIFT;
    return BIOME.CELESTIAL_PLATEAU;
  }

  if (height > 0.5) {
    if (temp < 0.3) return BIOME.GLACIAL_PEAKS;
    if (precip > 0.7) return BIOME.CLOUD_FOREST;
    if (precip > 0.4) return BIOME.ALPINE_MEADOW;
    return BIOME.SACRED_MOUNTAINS;
  }

  // Volcanic zones
  if (stress < -0.5 && temp > 0.6) return BIOME.VOLCANIC_BADLANDS;
  if (stress < -0.4 && temp > 0.5) return BIOME.MAGMA_RIFT;

  // Cold biomes
  if (temp < 0.15) {
    if (precip < 0.3) return BIOME.SNOWFIELD_STEPPE;
    if (precip < 0.5) return BIOME.FROST_TUNDRA;
    return BIOME.FROZEN_MARSHES;
  }

  if (temp < 0.3) {
    if (precip > 0.5) return BIOME.BOREAL_FOREST;
    return BIOME.FROST_TUNDRA;
  }

  // Arid biomes
  if (precip < 0.15) {
    if (temp > 0.7) return BIOME.CRYSTAL_DESERT;
    if (height > 0.3) return BIOME.CANYONLANDS;
    if (temp < 0.4) return BIOME.SALT_FLATS;
    return BIOME.QI_BARREN_WASTE;
  }

  if (precip < 0.3) {
    if (temp > 0.7) return BIOME.SCORCHED_SAVANNA;
    if (temp > 0.4) return BIOME.PETRIFIED_FOREST;
    return BIOME.DECIDUOUS_HIGHLANDS;
  }

  // Wet/temperate biomes
  if (temp > 0.7) {
    if (precip > 0.7) return BIOME.TROPICAL_JUNGLE;
    if (precip > 0.5) return BIOME.BAMBOO_GROVES;
    return BIOME.SCORCHED_SAVANNA;
  }

  if (temp > 0.5) {
    if (precip > 0.7) return BIOME.MIASMA_SWAMP;
    if (precip > 0.5) return BIOME.ANCIENT_FOREST;
    if (height < 0.15) return BIOME.TERRACED_FARMLANDS;
    return BIOME.CULTIVATION_PLAINS;
  }

  // Mild temperate
  if (precip > 0.6) return BIOME.MISTY_VALLEY;
  if (precip > 0.4) return BIOME.FLOWER_MEADOWS;
  return BIOME.DECIDUOUS_HIGHLANDS;
}

/**
 * Approximate coast distance — how many cells to nearest water.
 */
function getCoastDistance(heightmap, x, y) {
  const maxSearch = 30;
  for (let r = 1; r <= maxSearch; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
        if (heightmap[ny * GRID + nx] < 0) return r;
      }
    }
  }
  return maxSearch;
}
