/**
 * WorldSeed.js — Deterministic seed system with era offset and coordinate
 * conversion helpers.
 *
 * Connects the 7-era timeline to the noise generator so each era produces
 * slightly different (but deterministic) terrain. Also provides helpers to
 * convert between world-space coordinates (0-10000) and slippy-map tile
 * coordinates.
 */

import { createNoise } from './utils/noise.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base seed shared by all eras. */
export const BASE_SEED = 42;

/**
 * Boundary years for the 7 eras (start years).
 * Index 0 = earliest era, index 6 = latest.
 */
export const ERA_YEARS = [-500000, 0, 40000, 80000, 130000, 170000, 200000];

/** World coordinate extent in both x and y. */
const WORLD_SIZE = 10000;

// ---------------------------------------------------------------------------
// Era helpers
// ---------------------------------------------------------------------------

/**
 * Find which era a given year belongs to.
 *
 * Returns the index (0-6) of the latest era whose start year is <= `year`.
 * If `year` is before the very first era, returns 0.
 *
 * @param {number} year
 * @returns {number} Era index in the range [0, 6].
 */
export function getEraIndex(year) {
  let index = 0;
  for (let i = ERA_YEARS.length - 1; i >= 0; i--) {
    if (year >= ERA_YEARS[i]) {
      index = i;
      break;
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// Noise factory
// ---------------------------------------------------------------------------

/**
 * Create a noise generator seeded for the given era.
 *
 * Each era gets a unique but deterministic seed: BASE_SEED + eraIndex * 7.
 * This produces gradual terrain evolution across eras while remaining fully
 * reproducible.
 *
 * @param {number} eraIndex — 0-6
 * @returns {{ noise2D: Function, fbm: Function }}
 */
export function createWorldNoise(eraIndex) {
  return createNoise(BASE_SEED + eraIndex * 7);
}

// ---------------------------------------------------------------------------
// Coordinate conversion
// ---------------------------------------------------------------------------

/**
 * Return the world-coordinate size of one tile at the given zoom level.
 *
 * At zoom N the world (0-10000) is divided into 2^N tiles along each axis,
 * so each tile covers 10000 / 2^N world units.
 *
 * @param {number} zoom
 * @returns {number}
 */
export function tileWorldSize(zoom) {
  return WORLD_SIZE / Math.pow(2, zoom);
}

/**
 * Convert world coordinates to tile coordinates.
 *
 * @param {number} wx — world x (0-10000)
 * @param {number} wy — world y (0-10000)
 * @param {number} zoom
 * @returns {{ tx: number, ty: number }} tile column and row (may be fractional)
 */
export function worldToTile(wx, wy, zoom) {
  const numTiles = Math.pow(2, zoom);
  return {
    tx: (wx / WORLD_SIZE) * numTiles,
    ty: (wy / WORLD_SIZE) * numTiles,
  };
}

/**
 * Convert tile coordinates back to world coordinates (top-left corner of the
 * tile).
 *
 * @param {number} tx — tile column
 * @param {number} ty — tile row
 * @param {number} zoom
 * @returns {{ wx: number, wy: number }}
 */
export function tileToWorld(tx, ty, zoom) {
  const size = tileWorldSize(zoom);
  return {
    wx: tx * size,
    wy: ty * size,
  };
}
