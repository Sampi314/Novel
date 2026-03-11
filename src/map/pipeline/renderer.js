// src/map/pipeline/renderer.js
import { GRID } from './tectonics.js';
import { getBiomeColor, getWaterColor } from '../utils/colors.js';

const TILE_SIZE = 256;

/**
 * Render a single map tile from cached heightmap data.
 *
 * @param {Float32Array} heightmap  full GRID*GRID heightmap
 * @param {Int8Array} biomes        full GRID*GRID biome map
 * @param {number} tileX            tile column
 * @param {number} tileY            tile row
 * @param {number} zoom             zoom level (0-8)
 * @param {string} theme            'dark' | 'light'
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export function renderTile(heightmap, biomes, tileX, tileY, zoom, theme) {
  const pixels = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);

  // How many tiles exist at this zoom level
  const tilesPerSide = Math.pow(2, zoom);

  // Out-of-bounds tile — return transparent
  if (tileX < 0 || tileY < 0 || tileX >= tilesPerSide || tileY >= tilesPerSide) {
    return { data: pixels, width: TILE_SIZE, height: TILE_SIZE };
  }

  // Each tile covers a portion of the GRID
  const cellsPerTile = GRID / tilesPerSide;
  const startCellX = tileX * cellsPerTile;
  const startCellY = tileY * cellsPerTile;

  // Sun direction for hillshading
  const sunX = -1;
  const sunY = -1;
  const sunLen = Math.sqrt(2);

  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      const cellX = startCellX + (px / TILE_SIZE) * cellsPerTile;
      const cellY = startCellY + (py / TILE_SIZE) * cellsPerTile;

      const ix = Math.min(Math.floor(cellX), GRID - 1);
      const iy = Math.min(Math.floor(cellY), GRID - 1);
      const idx = iy * GRID + ix;

      const h = heightmap[idx];
      const biomeId = biomes[idx];
      let r, g, b;

      if (h < 0) {
        const depth = Math.min(1, Math.abs(h));
        [r, g, b] = getWaterColor(depth, theme);
      } else {
        [r, g, b] = getBiomeColor(biomeId, theme);

        // Hillshading
        const hL = ix > 0 ? heightmap[iy * GRID + ix - 1] : h;
        const hR = ix < GRID - 1 ? heightmap[iy * GRID + ix + 1] : h;
        const hU = iy > 0 ? heightmap[(iy - 1) * GRID + ix] : h;
        const hD = iy < GRID - 1 ? heightmap[(iy + 1) * GRID + ix] : h;

        const gradX = (hR - hL) * 0.5;
        const gradY = (hD - hU) * 0.5;

        const shade = 0.5 + ((-gradX * sunX - gradY * sunY) / sunLen) * 2.0;
        const sf = Math.max(0.4, Math.min(1.3, shade));

        r = Math.min(255, Math.round(r * sf));
        g = Math.min(255, Math.round(g * sf));
        b = Math.min(255, Math.round(b * sf));
      }

      const pi = (py * TILE_SIZE + px) * 4;
      pixels[pi] = r;
      pixels[pi + 1] = g;
      pixels[pi + 2] = b;
      pixels[pi + 3] = 255;
    }
  }

  return { data: pixels, width: TILE_SIZE, height: TILE_SIZE };
}
