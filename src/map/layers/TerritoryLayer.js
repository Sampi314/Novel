// src/map/layers/TerritoryLayer.js
import L from 'leaflet';
import { worldToLatLng } from '../utils/crs.js';
import { fractalizePolygon } from '../utils/fractalEdge.js';

/**
 * Compute expansion progress for a territory based on current time T.
 * Ancient territories (era_start < 0) get a head start; newer ones grow from zero.
 * Returns 0..1 with smoothstep easing.
 */
const EXPANSION_DURATION = 60000; // T units to grow from initial to full size

function getExpansionProgress(territory, currentT) {
  const eraStart = territory.era_start != null ? territory.era_start : -500000;
  const startT = Math.max(0, eraStart);

  // Territory not yet founded
  if (currentT < startT) return 0;

  // Pre-era territories get a head start (they existed before T=0)
  const initialProgress = eraStart < 0 ? 0.3 : 0;

  const elapsed = currentT - startT;
  const linear = Math.min(1, elapsed / EXPANSION_DURATION + initialProgress);

  // Smoothstep for organic growth curve
  return linear * linear * (3 - 2 * linear);
}

/**
 * Scale a set of world-coordinate points from a center by expansion progress.
 */
function scaleFromCenter(points, cx, cy, progress) {
  return points.map(([x, y]) => [
    cx + (x - cx) * progress,
    cy + (y - cy) * progress,
  ]);
}

/**
 * Create a Leaflet layer for faction territory borders.
 *
 * When terrain-computed borders are available (from worker), use those
 * and render as land-only polyline segments (clipped at coastlines).
 * Otherwise fall back to fractalized world.json polygons.
 *
 * Territory size scales with time T — territories start small and expand.
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

    // Time-based expansion: skip territories not yet founded
    const progress = getExpansionProgress(territory, currentT);
    if (progress <= 0) continue;

    const cx = territory.cx != null ? territory.cx : 5000;
    const cy = territory.cy != null ? territory.cy : 5000;
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

        // Scale segment from territory center based on expansion progress
        const scaled = progress < 1 ? scaleFromCenter(seg, cx, cy, progress) : seg;
        const latlngs = scaled.map(([x, y]) => worldToLatLng(x, y));

        const polyline = L.polyline(latlngs, {
          color,
          weight: isSea ? 2 : 2.5,
          opacity: (isSea ? 0.4 : 0.65) * Math.min(1, progress * 1.5),
          smoothFactor: 1.5,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: isSea ? '6 8' : '8 4',
        });
        group.addLayer(polyline);
      }
    } else {
      // Fallback: fractalize the simple polygon
      let points = territory.pts.map((pt) => {
        if (Array.isArray(pt)) return pt;
        if (typeof pt === 'string') {
          const [x, y] = pt.split(',').map(Number);
          return [x, y];
        }
        return [pt.x, pt.y];
      }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

      if (points.length < 3) continue;

      // Scale polygon from center based on expansion progress
      if (progress < 1) {
        points = scaleFromCenter(points, cx, cy, progress);
      }

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
        opacity: 0.7 * Math.min(1, progress * 1.5),
        fillColor: color,
        fillOpacity: 0.06 * progress,
        smoothFactor: 1.5,
        lineCap: 'round',
        lineJoin: 'round',
      });

      group.addLayer(polygon);
    }
  }

  return group;
}
