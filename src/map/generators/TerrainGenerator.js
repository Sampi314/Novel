/**
 * TerrainGenerator.js — Generates 256x256 terrain tile ImageData using noise.
 *
 * Each tile is rendered by converting pixel positions to world coordinates,
 * computing terrain height via fractal Brownian motion, applying a continent
 * mask (low-frequency noise + center-distance falloff), and mapping the
 * combined height to a theme-aware color.
 */

import { createWorldNoise, tileToWorld, tileWorldSize } from '../WorldSeed.js';
import { heightToColor } from '../utils/colors.js';

/** Tile resolution in pixels. */
const TILE_SIZE = 256;

/** World center (both axes). */
const WORLD_CENTER = 5000;

/** World half-extent for distance normalization. */
const WORLD_HALF = 5000;

/**
 * Generate a 256x256 terrain tile as ImageData.
 *
 * @param {number} tx       — tile column index
 * @param {number} ty       — tile row index
 * @param {number} zoom     — zoom level
 * @param {number} eraIndex — era index (0-6) for noise seeding
 * @param {'dark'|'light'} theme — color theme
 * @returns {ImageData} 256x256 RGBA pixel data
 */
export function generateTerrainTile(tx, ty, zoom, eraIndex, theme) {
  const noise = createWorldNoise(eraIndex);
  const { wx: tileWx, wy: tileWy } = tileToWorld(tx, ty, zoom);
  const worldSize = tileWorldSize(zoom);

  const imageData = new ImageData(TILE_SIZE, TILE_SIZE);
  const data = imageData.data;

  for (let py = 0; py < TILE_SIZE; py++) {
    const wy = tileWy + (py / TILE_SIZE) * worldSize;

    for (let px = 0; px < TILE_SIZE; px++) {
      const wx = tileWx + (px / TILE_SIZE) * worldSize;

      // --- Base terrain height (high-frequency detail) ---
      const height = noise.fbm(wx * 0.001, wy * 0.001, 6, 2, 0.5);

      // --- Continent mask (low-frequency landmass shapes) ---
      const maskNoise = noise.fbm(wx * 0.0004, wy * 0.0004, 4);

      // Center-distance falloff: creates roughly circular continent(s)
      const dx = (wx - WORLD_CENTER) / WORLD_HALF;
      const dy = (wy - WORLD_CENTER) / WORLD_HALF;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, 1);
      const falloff = 1 - clampedDist * clampedDist;

      // Combine noise and falloff into continent mask
      const mask = maskNoise * 0.6 + falloff * 0.4;

      // --- Final height ---
      const finalHeight = height * 0.5 + (mask - 0.3) * 1.0;

      // --- Map to color ---
      const [r, g, b] = heightToColor(finalHeight, theme);

      // --- Write RGBA into ImageData ---
      const idx = (py * TILE_SIZE + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  return imageData;
}
