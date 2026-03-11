// src/map/pipeline/interpolator.js
import { GRID } from './tectonics.js';

/**
 * Interpolate between two keyframe heightmaps for a given T value.
 *
 * @param {object[]} keyframes  sorted by T
 * @param {number} T            current time value
 * @returns {{ heightmap: Float32Array, biomes: Int8Array, rivers: object[] }}
 */
export function interpolateKeyframes(keyframes, T) {
  if (keyframes.length === 0) throw new Error('No keyframes');
  if (keyframes.length === 1) return keyframes[0];

  // Find the two surrounding keyframes
  let lower = keyframes[0];
  let upper = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (T >= keyframes[i].T && T <= keyframes[i + 1].T) {
      lower = keyframes[i];
      upper = keyframes[i + 1];
      break;
    }
  }

  // If T is before first or after last, clamp
  if (T <= lower.T) return lower;
  if (T >= upper.T) return upper;

  // Blend factor
  const range = upper.T - lower.T;
  const t = range > 0 ? (T - lower.T) / range : 0;

  // Interpolate heightmap
  const heightmap = new Float32Array(GRID * GRID);
  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = lower.heightmap[i] * (1 - t) + upper.heightmap[i] * t;
  }

  // Biomes: use whichever keyframe is closer
  const biomes = t < 0.5 ? lower.biomes : upper.biomes;

  // Rivers: use whichever keyframe is closer
  const rivers = t < 0.5 ? lower.rivers : upper.rivers;

  return { heightmap, biomes, rivers, T };
}
