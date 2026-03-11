// src/map/utils/crs.js
import L from 'leaflet';

/**
 * Custom CRS for the fantasy world.
 * World space: (0, 0) top-left to (10000, 10000) bottom-right.
 * Leaflet's Simple CRS uses pixels directly; we scale so that at zoom 0,
 * the full 10000x10000 world fits in 256x256 pixels (one tile).
 */

const WORLD_SIZE = 10000;
const TILE_SIZE = 256;

// At zoom 0, 1 world unit = TILE_SIZE / WORLD_SIZE pixels
const scale = TILE_SIZE / WORLD_SIZE;

export const WorldCRS = L.Util.extend({}, L.CRS.Simple, {
  // Transform: world coords -> pixel coords at zoom 0
  transformation: new L.Transformation(scale, 0, scale, 0),
});

/**
 * Convert world coordinates to Leaflet LatLng.
 * In CRS.Simple, LatLng maps to (y, x) — lat=y, lng=x.
 */
export function worldToLatLng(wx, wy) {
  return L.latLng(wy, wx);
}

/**
 * Convert Leaflet LatLng back to world coordinates.
 */
export function latLngToWorld(latlng) {
  return { x: latlng.lng, y: latlng.lat };
}

export const WORLD_BOUNDS = L.latLngBounds(
  worldToLatLng(0, 0),
  worldToLatLng(WORLD_SIZE, WORLD_SIZE)
);

export { WORLD_SIZE, TILE_SIZE };
