/**
 * TerrainGenerator.js — High-quality 256x256 terrain tile generator.
 *
 * Features:
 *   - Domain warping for organic landmass shapes
 *   - Ridged noise for mountain ranges
 *   - Continent mask with center-distance falloff
 *   - Moisture-based biome coloring (deserts ↔ forests)
 *   - Directional hillshading for 3D relief
 *   - Gradual era evolution (same base terrain + subtle perturbation)
 */

import { createNoise } from '../utils/noise.js';
import { tileToWorld, tileWorldSize, BASE_SEED } from '../WorldSeed.js';
import { getBiomeColor } from '../utils/colors.js';

const TILE_SIZE = 256;
const PADDED = TILE_SIZE + 2; // 1px border for hillshade normals

const WORLD_CENTER = 5000;
const WORLD_HALF = 5000;

// Normalized light direction (upper-left, slightly elevated)
const LX = 0.4082;   // ~1/sqrt(6)
const LY = -0.4082;
const LZ = 0.8165;   // ~2/sqrt(6)

// Cache noise instances (avoids rebuilding perm tables per tile)
let _baseNoise = null;
let _moistureNoise = null;
const _pertNoises = {};

function getBaseNoise() {
  if (!_baseNoise) _baseNoise = createNoise(BASE_SEED);
  return _baseNoise;
}

function getMoistureNoise() {
  if (!_moistureNoise) _moistureNoise = createNoise(BASE_SEED + 500);
  return _moistureNoise;
}

function getPertNoise(eraIndex) {
  if (!_pertNoises[eraIndex]) {
    _pertNoises[eraIndex] = createNoise(BASE_SEED + 1000 + eraIndex * 7);
  }
  return _pertNoises[eraIndex];
}

// ---------------------------------------------------------------------------
// Height computation
// ---------------------------------------------------------------------------

/**
 * Compute terrain height at a world coordinate.
 * Returns a value roughly in [-0.5, 0.8].
 */
function computeHeight(noise, wx, wy) {
  // Domain warping — makes coastlines and terrain features more organic
  const warpX = noise.fbm(wx * 0.0004, wy * 0.0004, 3);
  const warpY = noise.fbm(wx * 0.0004 + 97, wy * 0.0004 + 97, 3);
  const wWx = wx + warpX * 500;
  const wWy = wy + warpY * 500;

  // Base terrain detail
  const base = noise.fbm(wWx * 0.001, wWy * 0.001, 6, 2.0, 0.5);

  // Ridged noise — creates mountain range shapes
  const ridgeRaw = noise.fbm(wWx * 0.0008, wWy * 0.0008, 5, 2.2, 0.5);
  const ridge = 1 - Math.abs(ridgeRaw);
  const ridgeSq = ridge * ridge;

  // Continent mask — large-scale landmass shapes
  const continent = noise.fbm(wx * 0.0003, wy * 0.0003, 4);

  // Center-distance falloff — keeps land near world center
  const dx = (wx - WORLD_CENTER) / WORLD_HALF;
  const dy = (wy - WORLD_CENTER) / WORLD_HALF;
  const distSq = dx * dx + dy * dy;
  const falloff = distSq < 1 ? 1 - distSq : 0;

  // Combined mask
  const mask = continent * 0.45 + falloff * 0.55;

  // Blend base terrain and ridged mountains
  const landHeight = base * 0.35 + ridgeSq * 0.35 + base * ridgeSq * 0.15;
  return landHeight * 0.5 + (mask - 0.28);
}

// ---------------------------------------------------------------------------
// Tile generation
// ---------------------------------------------------------------------------

/**
 * Generate a 256x256 terrain tile as ImageData.
 *
 * @param {number} tx       — tile column index
 * @param {number} ty       — tile row index
 * @param {number} zoom     — zoom level
 * @param {number} eraIndex — era index (0-6)
 * @param {'dark'|'light'} theme
 * @returns {ImageData}
 */
export function generateTerrainTile(tx, ty, zoom, eraIndex, theme) {
  const baseNoise = getBaseNoise();
  const moistureNoise = getMoistureNoise();

  const { wx: tileWx, wy: tileWy } = tileToWorld(tx, ty, zoom);
  const worldSize = tileWorldSize(zoom);
  const pixelSize = worldSize / TILE_SIZE;

  // Era perturbation — same base terrain + gradual shift
  const pertScale = eraIndex * 0.025;
  const pertNoise = pertScale > 0 ? getPertNoise(eraIndex) : null;

  // Step 1: Build padded height grid (258x258) for hillshade normals
  const heights = new Float32Array(PADDED * PADDED);
  for (let py = 0; py < PADDED; py++) {
    const wy = tileWy + (py - 1) * pixelSize;
    for (let px = 0; px < PADDED; px++) {
      const wx = tileWx + (px - 1) * pixelSize;
      let h = computeHeight(baseNoise, wx, wy);
      if (pertNoise) {
        h += pertNoise.fbm(wx * 0.0005, wy * 0.0005, 3) * pertScale;
      }
      heights[py * PADDED + px] = h;
    }
  }

  // Step 2: Render each pixel with biome color + hillshading
  const imageData = new ImageData(TILE_SIZE, TILE_SIZE);
  const data = imageData.data;

  // Normal strength scales with zoom for consistent visual relief
  const normalStrength = 35 + zoom * 15;

  for (let py = 0; py < TILE_SIZE; py++) {
    const wy = tileWy + py * pixelSize;
    for (let px = 0; px < TILE_SIZE; px++) {
      const wx = tileWx + px * pixelSize;

      const h = heights[(py + 1) * PADDED + (px + 1)];

      // Moisture for biome variation (offset coordinates to decorrelate from terrain)
      const moisture = moistureNoise.fbm(wx * 0.0006, wy * 0.0006, 4);

      // Biome color
      const [r, g, b] = getBiomeColor(h, moisture, theme);

      // Hillshading — skip for deep water (it's flat)
      let lighting = 1.0;
      if (h > -0.2) {
        const hL = heights[(py + 1) * PADDED + px];
        const hR = heights[(py + 1) * PADDED + (px + 2)];
        const hU = heights[py * PADDED + (px + 1)];
        const hD = heights[(py + 2) * PADDED + (px + 1)];

        // Surface normal from finite differences
        const nx = (hL - hR) * normalStrength;
        const ny = (hU - hD) * normalStrength;
        // nz = 1 (implicit)
        const invLen = 1 / Math.sqrt(nx * nx + ny * ny + 1);

        // Diffuse lighting
        const shade = (nx * LX + ny * LY + LZ) * invLen;

        // Blend ambient (0.35) + diffuse (0.65)
        lighting = 0.35 + 0.65 * (shade > 0 ? shade : 0);
      }

      const idx = (py * TILE_SIZE + px) * 4;
      data[idx]     = r * lighting > 255 ? 255 : (r * lighting + 0.5) | 0;
      data[idx + 1] = g * lighting > 255 ? 255 : (g * lighting + 0.5) | 0;
      data[idx + 2] = b * lighting > 255 ? 255 : (b * lighting + 0.5) | 0;
      data[idx + 3] = 255;
    }
  }

  return imageData;
}
