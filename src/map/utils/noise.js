/**
 * noise.js — Seedable 2D Simplex noise with fractal Brownian motion (fbm)
 *
 * Pure implementation, no external dependencies.
 * Deterministic: same seed always produces the same output.
 *
 * Usage:
 *   import { createNoise } from './noise.js';
 *   const { noise2D, fbm } = createNoise(42);
 *   noise2D(3.5, 7.2);             // → value in [-1, 1]
 *   fbm(3.5, 7.2, 6, 2.0, 0.5);   // → layered noise in [-1, 1]
 */

// Gradients for 2D simplex noise (12 directions on the unit circle edges)
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

// Skewing / unskewing factors for 2D
const F2 = 0.5 * (Math.sqrt(3) - 1); // ≈ 0.3660254
const G2 = (3 - Math.sqrt(3)) / 6;   // ≈ 0.2113249

/**
 * Seeded pseudo-random number generator (mulberry32).
 * Returns a function that produces deterministic floats in [0, 1).
 */
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a permutation table using Fisher-Yates shuffle seeded by `seed`.
 * Returns a Uint8Array of length 512 (256 values doubled for wrapping).
 */
function buildPermTable(seed) {
  const rng = mulberry32(seed);

  // Initialize identity permutation [0..255]
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
  }

  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }

  // Double the table so we can avoid index wrapping with modulo
  for (let i = 0; i < 256; i++) {
    perm[i + 256] = perm[i];
  }

  return perm;
}

/**
 * Dot product of a gradient vector and (x, y) offset.
 */
function dot2(g, x, y) {
  return g[0] * x + g[1] * y;
}

/**
 * Create a seeded 2D Simplex noise generator.
 *
 * @param {number} seed — any integer (will be cast to int32)
 * @returns {{ noise2D: (x: number, y: number) => number, fbm: (x: number, y: number, octaves?: number, lacunarity?: number, gain?: number) => number }}
 */
export function createNoise(seed) {
  const perm = buildPermTable(seed);

  // Pre-compute gradient lookup (perm mod 12 → index into GRAD2)
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    permMod12[i] = perm[i] % 12;
  }

  /**
   * 2D Simplex noise at (x, y). Returns a value in roughly [-1, 1].
   */
  function noise2D(x, y) {
    // Skew input space to determine which simplex cell we are in
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    // Unskew back to (x, y) space
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;

    // Distances from cell origin in (x, y) coords
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine which simplex we are in (upper or lower triangle)
    let i1, j1;
    if (x0 > y0) {
      // Lower triangle, XY order: (0,0) → (1,0) → (1,1)
      i1 = 1;
      j1 = 0;
    } else {
      // Upper triangle, YX order: (0,0) → (0,1) → (1,1)
      i1 = 0;
      j1 = 1;
    }

    // Offsets for middle corner
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;

    // Offsets for last corner
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    // Hash coordinates of the three simplex corners
    const ii = i & 255;
    const jj = j & 255;

    const gi0 = permMod12[ii + perm[jj]];
    const gi1 = permMod12[ii + i1 + perm[jj + j1]];
    const gi2 = permMod12[ii + 1 + perm[jj + 1]];

    // Calculate contribution from each corner
    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * dot2(GRAD2[gi0], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * dot2(GRAD2[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * dot2(GRAD2[gi2], x2, y2);
    }

    // Scale to [-1, 1]. The factor 70.0 is the standard normalization
    // for 2D simplex noise to bring the output into approximately [-1, 1].
    return 70.0 * (n0 + n1 + n2);
  }

  /**
   * Fractal Brownian motion — layers multiple octaves of noise.
   *
   * @param {number} x
   * @param {number} y
   * @param {number} [octaves=6]      — number of layers
   * @param {number} [lacunarity=2.0] — frequency multiplier per octave
   * @param {number} [gain=0.5]       — amplitude multiplier per octave
   * @returns {number} value normalized to [-1, 1]
   */
  function fbm(x, y, octaves = 6, lacunarity = 2.0, gain = 0.5) {
    let value = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxAmplitude = 0; // Used for normalization

    for (let i = 0; i < octaves; i++) {
      value += amplitude * noise2D(x * frequency, y * frequency);
      maxAmplitude += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    // Normalize to [-1, 1]
    return value / maxAmplitude;
  }

  return { noise2D, fbm };
}
