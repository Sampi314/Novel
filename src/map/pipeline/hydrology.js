// src/map/pipeline/hydrology.js
import { GRID } from './tectonics.js';

// D8 direction offsets: N, NE, E, SE, S, SW, W, NW
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

/**
 * Generate rivers using D8 flow direction algorithm.
 *
 * @param {Float32Array} heightmap  GRID*GRID
 * @param {number} flowThreshold   minimum accumulation to form a river (200-500)
 * @returns {{ rivers: object[], flowAccum: Float32Array }}
 */
export function generateRivers(heightmap, flowThreshold = 300) {
  const size = GRID;

  // 1. Compute D8 flow direction for each cell
  const flowDir = new Int8Array(size * size).fill(-1);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const h = heightmap[idx];

      if (h < 0) {
        flowDir[idx] = -1;
        continue;
      }

      let minH = h;
      let minDir = -1;

      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
          if (minH > -1) {
            minH = -1;
            minDir = d;
          }
          continue;
        }
        const nh = heightmap[ny * size + nx];
        if (nh < minH) {
          minH = nh;
          minDir = d;
        }
      }

      flowDir[idx] = minDir;
    }
  }

  // 2. Fill pits
  fillPits(heightmap, flowDir, size);

  // 3. Compute flow accumulation
  const flowAccum = new Float32Array(size * size).fill(1);

  // Sort cells by height descending
  const indices = [];
  for (let i = 0; i < size * size; i++) {
    if (heightmap[i] >= 0) indices.push(i);
  }
  indices.sort((a, b) => heightmap[b] - heightmap[a]);

  for (const idx of indices) {
    const dir = flowDir[idx];
    if (dir < 0) continue;

    const x = idx % size;
    const y = Math.floor(idx / size);
    const nx = x + DX[dir];
    const ny = y + DY[dir];

    if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
      flowAccum[ny * size + nx] += flowAccum[idx];
    }
  }

  // 4. Extract rivers
  const rivers = [];
  const visited = new Uint8Array(size * size);

  for (const idx of indices) {
    if (flowAccum[idx] < flowThreshold) continue;
    if (visited[idx]) continue;

    const path = [];
    let ci = idx;
    let maxSteps = 5000;

    while (ci >= 0 && maxSteps-- > 0) {
      if (visited[ci] && path.length > 5) break;
      visited[ci] = 1;

      const cx = ci % size;
      const cy = Math.floor(ci / size);
      path.push([
        (cx / size) * 10000,
        (cy / size) * 10000,
        flowAccum[ci],
      ]);

      if (heightmap[ci] < 0) break;

      const dir = flowDir[ci];
      if (dir < 0) break;

      const nx = cx + DX[dir];
      const ny = cy + DY[dir];

      if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
        path.push([(nx / size) * 10000, (ny / size) * 10000, flowAccum[ci]]);
        break;
      }

      ci = ny * size + nx;
    }

    if (path.length >= 5) {
      rivers.push({
        path,
        accumulation: flowAccum[idx],
      });
    }
  }

  return { rivers, flowAccum };
}

/**
 * Simple pit filling — raise pit cells to enable drainage.
 */
function fillPits(heightmap, flowDir, size) {
  let changed = true;
  let passes = 0;
  while (changed && passes < 10) {
    changed = false;
    passes++;
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = y * size + x;
        if (heightmap[idx] < 0) continue;
        if (flowDir[idx] >= 0) continue;

        let minH = Infinity;
        for (let d = 0; d < 8; d++) {
          const nx = x + DX[d];
          const ny = y + DY[d];
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
          minH = Math.min(minH, heightmap[ny * size + nx]);
        }

        if (minH < Infinity && heightmap[idx] <= minH) {
          heightmap[idx] = minH + 0.001;
          let bestDir = -1;
          let bestH = heightmap[idx];
          for (let d = 0; d < 8; d++) {
            const nx = x + DX[d];
            const ny = y + DY[d];
            if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
              bestDir = d;
              break;
            }
            if (heightmap[ny * size + nx] < bestH) {
              bestH = heightmap[ny * size + nx];
              bestDir = d;
            }
          }
          flowDir[idx] = bestDir;
          changed = true;
        }
      }
    }
  }
}
