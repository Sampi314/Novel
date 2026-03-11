// src/map/utils/noise.js
import { createNoise2D } from 'simplex-noise';

/**
 * Simple seeded PRNG (Mulberry32).
 * @param {string|number} seed
 * @returns {() => number} random function returning [0, 1)
 */
function mulberry32(seed) {
  let h = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  let s = Math.abs(h) || 1;
  return () => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded 2D noise function.
 * @param {string|number} seed
 * @returns {(x: number, y: number) => number} value in [-1, 1]
 */
export function createSeededNoise(seed) {
  const prng = mulberry32(seed);
  return createNoise2D(prng);
}

/**
 * Fractal Brownian Motion — layer multiple octaves of noise.
 * @param {Function} noise2D  seeded noise fn
 * @param {number} x
 * @param {number} y
 * @param {number} octaves   number of layers (6-8 typical)
 * @param {number} lacunarity frequency multiplier per octave (2.0 typical)
 * @param {number} persistence amplitude multiplier per octave (0.5 typical)
 * @returns {number} value roughly in [-1, 1]
 */
export function fbm(noise2D, x, y, octaves = 6, lacunarity = 2.0, persistence = 0.5) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmplitude;
}

/**
 * Ridged noise — absolute value inverted for sharp ridges (mountains).
 */
export function ridgedNoise(noise2D, x, y, octaves = 6, lacunarity = 2.0, persistence = 0.5) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    let n = noise2D(x * frequency, y * frequency);
    n = 1.0 - Math.abs(n); // ridge
    n = n * n; // sharpen
    value += n * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmplitude;
}

/**
 * Domain warping — feed noise into noise for organic shapes.
 * @param {Function} noise2D
 * @param {number} x
 * @param {number} y
 * @param {number} warpStrength  how far to displace (0.5-2.0 typical)
 * @param {number} octaves
 * @returns {number}
 */
export function warpedFbm(noise2D, x, y, warpStrength = 1.0, octaves = 6) {
  const wx = fbm(noise2D, x + 0.0, y + 0.0, octaves);
  const wy = fbm(noise2D, x + 5.2, y + 1.3, octaves);
  return fbm(noise2D, x + wx * warpStrength, y + wy * warpStrength, octaves);
}
