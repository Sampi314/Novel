// src/map/utils/fractalEdge.js
import { createSeededNoise } from './noise.js';

/**
 * Displace a polyline so no segment > maxSegmentPx is straight.
 * Uses recursive midpoint displacement + noise perturbation.
 *
 * @param {number[][]} points  array of [x, y] in world coords
 * @param {object} opts
 * @param {number} opts.noiseScale      noise frequency (0.001-0.01)
 * @param {number} opts.displacement    max perpendicular offset in world units
 * @param {number} opts.maxSegmentLen   max segment length before subdivision (world units)
 * @param {number} opts.iterations      recursive depth (3-5)
 * @param {string|number} opts.seed     noise seed for determinism
 * @returns {number[][]} densified, displaced point array
 */
export function fractalizeEdge(points, opts = {}) {
  const {
    noiseScale = 0.005,
    displacement = 30,
    maxSegmentLen = 80,
    iterations = 4,
    seed = 'edge-default',
  } = opts;

  const noise2D = createSeededNoise(seed);
  let current = [...points.map(p => [...p])];

  for (let iter = 0; iter < iterations; iter++) {
    const next = [current[0]];
    const scale = displacement / (1 + iter * 0.7); // reduce displacement each iteration

    for (let i = 0; i < current.length - 1; i++) {
      const [ax, ay] = current[i];
      const [bx, by] = current[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const segLen = Math.sqrt(dx * dx + dy * dy);

      if (segLen > maxSegmentLen / (1 + iter)) {
        // Midpoint
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;

        // Perpendicular direction
        const perpX = -dy / segLen;
        const perpY = dx / segLen;

        // Noise-based displacement
        const n = noise2D(mx * noiseScale, my * noiseScale);
        const offsetX = perpX * n * scale;
        const offsetY = perpY * n * scale;

        next.push([mx + offsetX, my + offsetY]);
      }
      next.push(current[i + 1]);
    }
    current = next;
  }

  return current;
}

/**
 * Fractalize a closed polygon (connects last point back to first).
 */
export function fractalizePolygon(points, opts = {}) {
  // Close the polygon by appending the first point
  const closed = [...points, points[0]];
  const result = fractalizeEdge(closed, opts);
  // Remove duplicate closure point
  result.pop();
  return result;
}
