// src/map/layers/TerritoryLayer.js
import L from 'leaflet';
import { worldToLatLng } from '../utils/crs.js';
import { fractalizePolygon } from '../utils/fractalEdge.js';

/**
 * Create a Leaflet layer for faction territory borders.
 *
 * When terrain-computed borders are available (from worker), use those
 * and render as land-only polyline segments (clipped at coastlines).
 * Otherwise fall back to fractalized world.json polygons.
 *
 * @param {object[]} territories  from data.territories
 * @param {string} theme
 * @param {number} currentT
 * @param {object[]} eras
 * @param {object[]} [computedBorders]  terrain-following borders from worker
 * @returns {L.LayerGroup}
 */
export function createTerritoryLayer(territories, theme, currentT, eras, computedBorders) {
  const group = L.layerGroup();
  if (!territories) return group;

  // Index computed borders by territory ID
  const borderMap = new Map();
  if (computedBorders) {
    for (const b of computedBorders) {
      borderMap.set(b.id, b);
    }
  }

  for (const territory of territories) {
    if (!territory.pts || territory.pts.length < 3) continue;

    const color = territory.color || (theme === 'dark' ? '#c4a35a' : '#5a4a2a');
    const id = territory.id || territory.name;
    const computed = borderMap.get(id);

    if (computed && computed.segments && computed.segments.length > 0) {
      // Check if sea territory (name contains sea-related terms)
      const name = (territory.name || '').toLowerCase();
      const isSea = name.includes('hải') || name.includes('海') ||
        name.includes('đông hải') || name.includes('biển');

      for (const seg of computed.segments) {
        if (seg.length < 2) continue;
        const latlngs = seg.map(([x, y]) => worldToLatLng(x, y));

        const polyline = L.polyline(latlngs, {
          color,
          weight: isSea ? 2 : 2.5,
          opacity: isSea ? 0.4 : 0.65,
          smoothFactor: 1.5,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: isSea ? '6 8' : '8 4',
        });
        group.addLayer(polyline);
      }
    } else {
      // Fallback: fractalize the simple polygon
      const points = territory.pts.map((pt) => {
        if (Array.isArray(pt)) return pt;
        if (typeof pt === 'string') {
          const [x, y] = pt.split(',').map(Number);
          return [x, y];
        }
        return [pt.x, pt.y];
      }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

      if (points.length < 3) continue;

      const fractalized = fractalizePolygon(points, {
        noiseScale: 0.004,
        displacement: 40,
        maxSegmentLen: 100,
        iterations: 4,
        seed: 'territory-' + id,
      });

      const latlngs = fractalized.map(([x, y]) => worldToLatLng(x, y));

      const polygon = L.polygon(latlngs, {
        color,
        weight: 2.5,
        opacity: 0.7,
        fillColor: color,
        fillOpacity: 0.06,
        smoothFactor: 1.5,
        lineCap: 'round',
        lineJoin: 'round',
      });

      group.addLayer(polygon);
    }
  }

  return group;
}
