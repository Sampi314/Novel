// src/map/layers/TerritoryLayer.js
import L from 'leaflet';
import { worldToLatLng } from '../utils/crs.js';
import { fractalizePolygon } from '../utils/fractalEdge.js';

/**
 * Create a Leaflet layer for faction territory borders.
 * Territory polygons come from world.json, edges are fractalized.
 *
 * @param {object[]} territories  from data.territories
 * @param {string} theme
 * @param {number} currentT
 * @param {object[]} eras
 * @returns {L.LayerGroup}
 */
export function createTerritoryLayer(territories, theme, currentT, eras) {
  const group = L.layerGroup();

  if (!territories) return group;

  for (const territory of territories) {
    if (!territory.pts || territory.pts.length < 3) continue;

    // Parse points
    const points = territory.pts.map((pt) => {
      if (Array.isArray(pt)) return pt;
      if (typeof pt === 'string') {
        const [x, y] = pt.split(',').map(Number);
        return [x, y];
      }
      return [pt.x, pt.y];
    }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

    if (points.length < 3) continue;

    // Fractalize the polygon edges
    const fractalized = fractalizePolygon(points, {
      noiseScale: 0.004,
      displacement: 40,
      maxSegmentLen: 100,
      iterations: 4,
      seed: 'territory-' + (territory.id || territory.name || ''),
    });

    // Convert to Leaflet LatLng
    const latlngs = fractalized.map(([x, y]) => worldToLatLng(x, y));

    const color = territory.color || (theme === 'dark' ? '#c4a35a' : '#5a4a2a');

    const polygon = L.polygon(latlngs, {
      color,
      weight: 2,
      opacity: 0.6,
      fillColor: color,
      fillOpacity: 0.08,
      dashArray: '6 4',
      smoothFactor: 1,
    });

    group.addLayer(polygon);
  }

  return group;
}
