// ============================================================
// colors.js — Xianxia-themed terrain color palette
// Height-to-color interpolation for dark and light themes
// ============================================================

/**
 * Terrain color stops for dark and light themes.
 * Each stop: { h: normalized height [-1..1], r, g, b } (0-255).
 * Stops MUST be sorted ascending by h.
 */
export const TERRAIN_COLORS = {
  dark: [
    { h: -1.0,  r:   8, g:  15, b:  30 },  // deep ocean
    { h: -0.4,  r:  15, g:  30, b:  55 },  // ocean
    { h: -0.05, r:  25, g:  50, b:  70 },  // shallow water
    { h:  0.0,  r:  50, g:  55, b:  40 },  // beach / shore
    { h:  0.05, r:  30, g:  50, b:  25 },  // lowland grass
    { h:  0.2,  r:  25, g:  45, b:  20 },  // forest
    { h:  0.4,  r:  55, g:  50, b:  35 },  // highland
    { h:  0.6,  r:  70, g:  65, b:  55 },  // mountain
    { h:  0.8,  r:  90, g:  85, b:  80 },  // high mountain
    { h:  1.0,  r: 180, g: 175, b: 170 },  // snow peak
  ],
  light: [
    { h: -1.0,  r:  60, g:  90, b: 130 },  // deep ocean (parchment blue)
    { h: -0.4,  r:  80, g: 120, b: 160 },  // ocean
    { h: -0.05, r: 110, g: 155, b: 185 },  // shallow water
    { h:  0.0,  r: 190, g: 180, b: 150 },  // beach / shore
    { h:  0.05, r: 140, g: 170, b: 110 },  // lowland grass
    { h:  0.2,  r: 110, g: 150, b:  85 },  // forest
    { h:  0.4,  r: 170, g: 155, b: 120 },  // highland
    { h:  0.6,  r: 155, g: 145, b: 130 },  // mountain
    { h:  0.8,  r: 185, g: 180, b: 170 },  // high mountain
    { h:  1.0,  r: 240, g: 235, b: 225 },  // snow peak (parchment white)
  ],
};

/**
 * Interpolate a height value to an [r, g, b] color using the given theme's
 * color stops. Heights outside [-1, 1] are clamped.
 *
 * @param {number} height  Normalized height in [-1, 1]
 * @param {'dark'|'light'} theme  Theme name (defaults to 'dark')
 * @returns {[number, number, number]}  Interpolated [r, g, b] (0-255)
 */
export function heightToColor(height, theme = 'dark') {
  const stops = TERRAIN_COLORS[theme] || TERRAIN_COLORS.dark;

  // Clamp to valid range
  const h = Math.max(-1, Math.min(1, height));

  // Below first stop — return first color
  if (h <= stops[0].h) {
    return [stops[0].r, stops[0].g, stops[0].b];
  }

  // Above last stop — return last color
  if (h >= stops[stops.length - 1].h) {
    const last = stops[stops.length - 1];
    return [last.r, last.g, last.b];
  }

  // Find the two surrounding stops and lerp
  for (let i = 1; i < stops.length; i++) {
    if (h <= stops[i].h) {
      const a = stops[i - 1];
      const b = stops[i];
      const t = (h - a.h) / (b.h - a.h);
      return [
        Math.round(a.r + (b.r - a.r) * t),
        Math.round(a.g + (b.g - a.g) * t),
        Math.round(a.b + (b.b - a.b) * t),
      ];
    }
  }

  // Fallback (should never reach here)
  const last = stops[stops.length - 1];
  return [last.r, last.g, last.b];
}

/**
 * Convert a hex color string to an rgba() CSS string.
 *
 * @param {string} hexColor  Hex color (e.g. '#c4a35a' or 'c4a35a')
 * @param {number} alpha     Opacity in [0, 1] (defaults to 1)
 * @returns {string}         CSS rgba string, e.g. 'rgba(196,163,90,0.6)'
 */
export function territoryColor(hexColor, alpha = 1) {
  const hex = hexColor.replace(/^#/, '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
