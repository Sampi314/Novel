// src/map/layers/ProceduralRiverLayer.js
import L from 'leaflet';
import { worldToLatLng } from '../utils/crs.js';

/**
 * Create a Leaflet layer for D8-generated rivers.
 * Each river is rendered as a single polyline with width based on accumulation.
 *
 * @param {object[]} rivers  D8 rivers: [{path: [[x,y,accum],...], accumulation}]
 * @param {string} theme     'dark' | 'light'
 * @returns {L.LayerGroup}
 */
export function createProceduralRiverLayer(rivers, theme) {
  const group = L.layerGroup();
  if (!rivers || rivers.length === 0) return group;

  // Sort by accumulation so larger rivers render on top
  const sorted = [...rivers].sort((a, b) => a.accumulation - b.accumulation);

  // Find max accumulation for normalization
  const maxAccum = Math.max(...sorted.map(r => r.accumulation));
  if (maxAccum === 0) return group;

  for (const river of sorted) {
    if (!river.path || river.path.length < 3) continue;

    // Convert path points to LatLng
    const latlngs = river.path.map(([x, y]) => worldToLatLng(x, y));

    // Width and opacity based on overall river accumulation
    const normalized = Math.sqrt(river.accumulation / maxAccum);
    const weight = Math.max(1, normalized * 5);
    const opacity = 0.4 + normalized * 0.4;

    const color = theme === 'dark'
      ? `rgba(58, 140, 200, ${opacity})`
      : `rgba(40, 100, 170, ${opacity})`;

    const polyline = L.polyline(latlngs, {
      color,
      weight,
      opacity: 1,
      smoothFactor: 0.5,
      lineCap: 'round',
      lineJoin: 'round',
    });

    group.addLayer(polyline);
  }

  return group;
}
