// src/map/pipeline/hydrology.js
import { GRID } from './tectonics.js';

// D8 direction offsets: N, NE, E, SE, S, SW, W, NW
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

/**
 * Priority-Flood depression filling (Barnes et al. 2014).
 * Guarantees every land cell has a valid downhill flow path to ocean or edge.
 *
 * Uses a min-heap priority queue to process cells from boundaries inward,
 * raising any cell that sits in a depression to the pour-point elevation + epsilon.
 *
 * @param {Float32Array} heightmap  GRID*GRID (modified in place)
 * @param {number} size  grid dimension
 * @returns {Float32Array} filled heightmap (same reference, modified in place)
 */
function priorityFloodFill(heightmap, size) {
  const n = size * size;
  const visited = new Uint8Array(n);

  // Simple binary min-heap on elevation
  const heap = [];
  function heapPush(idx, elev) {
    heap.push({ idx, elev });
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].elev <= heap[i].elev) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  }
  function heapPop() {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < heap.length && heap[l].elev < heap[smallest].elev) smallest = l;
        if (r < heap.length && heap[r].elev < heap[smallest].elev) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  }

  // Seed: all boundary cells + all ocean cells (h < 0) are starting points
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (x === 0 || x === size - 1 || y === 0 || y === size - 1 || heightmap[idx] < 0) {
        visited[idx] = 1;
        heapPush(idx, heightmap[idx]);
      }
    }
  }

  // Process cells in elevation order
  while (heap.length > 0) {
    const { idx, elev } = heapPop();
    const x = idx % size;
    const y = (idx - x) / size;

    for (let d = 0; d < 8; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      const ni = ny * size + nx;
      if (visited[ni]) continue;
      visited[ni] = 1;

      // If neighbor is lower than current pour point, raise it
      if (heightmap[ni] < elev) {
        heightmap[ni] = elev + 0.0001;
      }
      heapPush(ni, heightmap[ni]);
    }
  }

  return heightmap;
}

/**
 * Generate rivers using D8 flow direction algorithm with proper pit filling.
 *
 * @param {Float32Array} heightmap  GRID*GRID (will be modified by pit filling)
 * @param {number} flowThreshold   minimum accumulation to form a river
 * @returns {{ rivers: object[], flowAccum: Float32Array }}
 */
export function generateRivers(heightmap, flowThreshold = 300) {
  const size = GRID;

  // 1. Priority-Flood fill all depressions
  priorityFloodFill(heightmap, size);

  // 2. Compute D8 flow direction for each land cell
  const flowDir = new Int8Array(size * size).fill(-1);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const h = heightmap[idx];

      // Ocean cells don't flow
      if (h < 0) continue;

      let minH = h;
      let minDir = -1;

      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
          // Edge of map = drain point
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

  // 3. Compute flow accumulation (topological sort by height descending)
  const flowAccum = new Float32Array(size * size).fill(1);

  const indices = [];
  for (let i = 0; i < size * size; i++) {
    if (heightmap[i] >= 0) indices.push(i);
  }
  indices.sort((a, b) => heightmap[b] - heightmap[a]);

  for (const idx of indices) {
    const dir = flowDir[idx];
    if (dir < 0) continue;

    const x = idx % size;
    const y = (idx - x) / size;
    const nx = x + DX[dir];
    const ny = y + DY[dir];

    if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
      flowAccum[ny * size + nx] += flowAccum[idx];
    }
  }

  // 4. Extract river paths by tracing from high-accumulation sources downstream
  const rivers = [];
  const visited = new Uint8Array(size * size);

  for (const idx of indices) {
    if (flowAccum[idx] < flowThreshold) continue;
    if (visited[idx]) continue;

    const path = [];
    let ci = idx;
    let maxSteps = 5000;

    while (ci >= 0 && maxSteps-- > 0) {
      if (visited[ci]) break;
      visited[ci] = 1;

      const cx = ci % size;
      const cy = (ci - cx) / size;
      path.push([
        (cx / size) * 10000,
        (cy / size) * 10000,
        flowAccum[ci],
      ]);

      // Reached ocean
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

    if (path.length >= 3) {
      rivers.push({
        path,
        accumulation: flowAccum[idx],
      });
    }
  }

  return { rivers, flowAccum };
}
