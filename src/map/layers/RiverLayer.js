// src/map/layers/RiverLayer.js
import L from 'leaflet';
import { worldToLatLng } from '../utils/crs.js';
import { fractalizeEdge } from '../utils/fractalEdge.js';

/**
 * Create a Leaflet layer for river rendering from world.json rivers.
 *
 * @param {object[]} rivers  from data.rivers (world.json)
 * @param {string} theme
 * @returns {L.LayerGroup}
 */
export function createRiverLayer(rivers, theme) {
  const group = L.layerGroup();

  if (!rivers) return group;

  for (const river of rivers) {
    if (!river.pts || river.pts.length < 2) continue;

    // Parse waypoints
    const points = river.pts.map((pt) => {
      if (Array.isArray(pt)) return pt;
      if (typeof pt === 'string') {
        const [x, y] = pt.split(',').map(Number);
        return [x, y];
      }
      return [pt.x, pt.y];
    }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

    if (points.length < 2) continue;

    // Fractalize the river path for organic look
    const fractalized = fractalizeEdge(points, {
      noiseScale: 0.003,
      displacement: 15,
      maxSegmentLen: 60,
      iterations: 3,
      seed: 'river-' + (river.id || river.name || ''),
    });

    // Convert to Leaflet LatLng
    const latlngs = fractalized.map(([x, y]) => worldToLatLng(x, y));

    // Determine style by rank
    const isMain = river.rank === 1 || river.rank === '1';
    const color = theme === 'dark' ? '#3a6a9a' : '#4a8ac4';
    const weight = isMain ? 3 : 1.5;
    const opacity = isMain ? 0.8 : 0.5;

    const polyline = L.polyline(latlngs, {
      color,
      weight,
      opacity,
      smoothFactor: 1.5,
      lineCap: 'round',
      lineJoin: 'round',
    });

    group.addLayer(polyline);
  }

  return group;
}
