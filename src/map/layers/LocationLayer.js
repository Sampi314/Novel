// src/map/layers/LocationLayer.js
import L from 'leaflet';
import { worldToLatLng } from '../utils/crs.js';

// Pin icon colors by location type
const TYPE_COLORS = {
  capital: '#c4a35a',
  city: '#a0906a',
  sect: '#7a5aaa',
  sacred_site: '#5ac4a3',
  port: '#5a8ac4',
  outpost: '#888',
  village: '#6a8a5a',
  ruin: '#8a5a5a',
  default: '#999',
};

function createPinIcon(type, theme) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.default;
  const size = type === 'capital' ? 12 : type === 'city' ? 10 : 8;

  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
      box-shadow: 0 0 6px ${color}80;
    "></div>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  });
}

/**
 * Create a Leaflet LayerGroup with location pins.
 *
 * @param {object[]} locations  from data.locations
 * @param {string} language     'vi' | 'zh' | 'vi-zh'
 * @param {number} currentT     current time value
 * @param {object[]} eras        era definitions
 * @returns {L.LayerGroup}
 */
export function createLocationLayer(locations, language, currentT, eras) {
  const group = L.layerGroup();

  if (!locations) return group;

  for (const loc of locations) {
    const x = parseFloat(loc.x);
    const y = parseFloat(loc.y);
    if (isNaN(x) || isNaN(y)) continue;

    const latlng = worldToLatLng(x, y);
    const icon = createPinIcon(loc.type, 'dark');

    // Label text based on language
    let label = loc.name || '';
    if (language === 'zh' && loc.han) {
      label = loc.han;
    } else if (language === 'vi-zh' && loc.han) {
      label = `${loc.name} ${loc.han}`;
    }

    const marker = L.marker(latlng, { icon });

    marker.bindPopup(`
      <div style="font-family: var(--font-body); min-width: 120px;">
        <strong style="font-family: var(--font-display);">${label}</strong>
        <br/><span style="color: #888; font-size: 0.85em;">${loc.type || ''}</span>
        ${loc.description ? `<br/><span style="font-size: 0.8em; opacity: 0.8;">${loc.description.substring(0, 100)}...</span>` : ''}
      </div>
    `, { className: 'map-popup' });

    marker.bindTooltip(label, {
      permanent: false,
      direction: 'top',
      offset: [0, -8],
      className: 'map-tooltip',
    });

    group.addLayer(marker);
  }

  return group;
}
