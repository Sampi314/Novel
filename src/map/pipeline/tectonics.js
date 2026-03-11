// src/map/pipeline/tectonics.js
import { createSeededNoise, fbm } from '../utils/noise.js';

const GRID = 1024;

/**
 * Generate tectonic plate data for a given era keyframe.
 *
 * @param {number} numPlates   7-12 plates
 * @param {number} T           time value (0 to 1_000_000)
 * @param {string} seed        world seed
 * @returns {{ plateMap: Int8Array, stress: Float32Array, seeds: object[] }}
 */
export function generatePlates(numPlates, T, seed) {
  const noise = createSeededNoise(seed + '-tect');
  const driftNoise = createSeededNoise(seed + '-drift');

  // 1. Generate plate seed points with time-based drift
  const seeds = [];
  const seedNoise = createSeededNoise(seed + '-seeds');
  for (let i = 0; i < numPlates; i++) {
    const angle = (i / numPlates) * Math.PI * 2;
    const r = 0.25 + 0.15 * seedNoise(i * 7.1, 0);
    let cx = 0.5 + r * Math.cos(angle);
    let cy = 0.5 + r * Math.sin(angle);

    // Apply drift over time
    const driftAngle = driftNoise(i * 3.7, i * 11.3) * Math.PI * 2;
    const driftSpeed = 0.0000002 + 0.0000001 * Math.abs(driftNoise(i * 5.1, 0));
    cx += Math.cos(driftAngle) * driftSpeed * T;
    cy += Math.sin(driftAngle) * driftSpeed * T;

    // Keep within bounds with wrapping
    cx = ((cx % 1) + 1) % 1;
    cy = ((cy % 1) + 1) % 1;

    seeds.push({ cx, cy, plate: i });
  }

  // 2. Assign cells to nearest plate (Voronoi-like) with noise-warped distances
  const plateMap = new Int8Array(GRID * GRID);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const nx = x / GRID;
      const ny = y / GRID;

      const warpX = nx + fbm(noise, nx * 4, ny * 4, 4) * 0.03;
      const warpY = ny + fbm(noise, nx * 4 + 100, ny * 4 + 100, 4) * 0.03;

      let minDist = Infinity;
      let closest = 0;

      for (const s of seeds) {
        let dx = Math.abs(warpX - s.cx);
        let dy = Math.abs(warpY - s.cy);
        if (dx > 0.5) dx = 1 - dx;
        if (dy > 0.5) dy = 1 - dy;
        const dist = dx * dx + dy * dy;

        if (dist < minDist) {
          minDist = dist;
          closest = s.plate;
        }
      }

      plateMap[y * GRID + x] = closest;
    }
  }

  // 3. Compute tectonic stress at boundaries
  const stress = new Float32Array(GRID * GRID);

  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const idx = y * GRID + x;
      const myPlate = plateMap[idx];

      let isBoundary = false;
      const neighbors = [
        plateMap[(y - 1) * GRID + x],
        plateMap[(y + 1) * GRID + x],
        plateMap[y * GRID + (x - 1)],
        plateMap[y * GRID + (x + 1)],
      ];

      for (const np of neighbors) {
        if (np !== myPlate) {
          isBoundary = true;
          break;
        }
      }

      if (isBoundary) {
        const nx = x / GRID;
        const ny = y / GRID;
        const stressType = fbm(noise, nx * 8, ny * 8, 3);
        stress[idx] = stressType > 0 ? 1.0 : -0.8;
      }
    }
  }

  // 4. Blur stress field to spread influence
  const blurred = blurField(stress, GRID, 12);

  return { plateMap, stress: blurred, seeds };
}

/**
 * Box blur a Float32Array field.
 */
function blurField(field, size, radius) {
  const out = new Float32Array(field.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            sum += field[ny * size + nx];
            count++;
          }
        }
      }
      out[y * size + x] = sum / count;
    }
  }
  return out;
}

export { GRID };
