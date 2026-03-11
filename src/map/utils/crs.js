// src/map/utils/crs.js
import L from 'leaflet';

/**
 * Custom CRS for the fantasy world.
 * World space: (0, 0) top-left to (10000, 10000) bottom-right.
 *
 * Leaflet's Simple CRS uses negative y-scale (lat increases upward).
 * We follow the same convention but flip our world-y so that
 * world y=0 (top) maps to high lat and world y=10000 (bottom) maps to low lat.
 */

const WORLD_SIZE = 10000;
const TILE_SIZE = 256;

const scale = TILE_SIZE / WORLD_SIZE;

export const WorldCRS = L.Util.extend({}, L.CRS.Simple, {
  // Negative y-scale matches Leaflet's convention (lat increases upward)
  transformation: new L.Transformation(scale, 0, -scale, TILE_SIZE),
});

/**
 * Convert world coordinates to Leaflet LatLng.
 * World y=0 (top) → high lat, world y=10000 (bottom) → low lat.
 */
export function worldToLatLng(wx, wy) {
  return L.latLng(WORLD_SIZE - wy, wx);
}

/**
 * Convert Leaflet LatLng back to world coordinates.
 */
export function latLngToWorld(latlng) {
  return { x: latlng.lng, y: WORLD_SIZE - latlng.lat };
}

export const WORLD_BOUNDS = L.latLngBounds(
  worldToLatLng(0, 0),
  worldToLatLng(WORLD_SIZE, WORLD_SIZE)
);

export { WORLD_SIZE, TILE_SIZE };
