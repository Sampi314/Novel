/**
 * colors.js — Biome-aware terrain color system
 *
 * Uses dual height-stop gradients (dry + wet) per theme.
 * Final color = lerp(dryColor, wetColor, moisture).
 * This produces natural biome transitions: deserts in dry areas,
 * forests in wet areas, with smooth blending.
 */

// ---------------------------------------------------------------------------
// Dark theme — atmospheric xianxia style
// ---------------------------------------------------------------------------
const DARK_DRY = [
  { h: -1.0,  c: [4, 10, 22] },    // abyss
  { h: -0.3,  c: [8, 22, 48] },    // deep ocean
  { h: -0.08, c: [14, 38, 62] },   // ocean
  { h: -0.02, c: [22, 52, 72] },   // shallow water
  { h:  0.0,  c: [62, 56, 42] },   // shore
  { h:  0.02, c: [72, 64, 45] },   // beach
  { h:  0.08, c: [68, 60, 40] },   // dry lowland
  { h:  0.2,  c: [58, 50, 35] },   // steppe
  { h:  0.35, c: [52, 46, 36] },   // dry highland
  { h:  0.55, c: [58, 55, 48] },   // bare rock
  { h:  0.72, c: [78, 74, 68] },   // high rock
  { h:  0.85, c: [110, 106, 98] }, // alpine
  { h:  1.0,  c: [168, 162, 155] },// snow
];

const DARK_WET = [
  { h: -1.0,  c: [4, 10, 22] },
  { h: -0.3,  c: [8, 22, 48] },
  { h: -0.08, c: [14, 38, 62] },
  { h: -0.02, c: [22, 52, 72] },
  { h:  0.0,  c: [55, 58, 42] },   // marshy shore
  { h:  0.02, c: [42, 55, 32] },   // wet lowland
  { h:  0.08, c: [28, 52, 22] },   // grassland
  { h:  0.2,  c: [20, 44, 16] },   // forest
  { h:  0.35, c: [18, 40, 18] },   // dense forest
  { h:  0.55, c: [32, 46, 30] },   // cloud forest
  { h:  0.72, c: [65, 62, 56] },   // rocky peaks
  { h:  0.85, c: [105, 100, 92] }, // alpine
  { h:  1.0,  c: [168, 162, 155] },// snow
];

// ---------------------------------------------------------------------------
// Light theme — parchment cartographic style
// ---------------------------------------------------------------------------
const LIGHT_DRY = [
  { h: -1.0,  c: [50, 82, 128] },
  { h: -0.3,  c: [68, 108, 152] },
  { h: -0.08, c: [90, 135, 172] },
  { h: -0.02, c: [115, 160, 190] },
  { h:  0.0,  c: [198, 188, 160] },
  { h:  0.02, c: [205, 195, 165] },
  { h:  0.08, c: [195, 180, 140] },
  { h:  0.2,  c: [178, 162, 125] },
  { h:  0.35, c: [162, 150, 128] },
  { h:  0.55, c: [148, 140, 125] },
  { h:  0.72, c: [170, 164, 152] },
  { h:  0.85, c: [198, 192, 182] },
  { h:  1.0,  c: [238, 234, 225] },
];

const LIGHT_WET = [
  { h: -1.0,  c: [50, 82, 128] },
  { h: -0.3,  c: [68, 108, 152] },
  { h: -0.08, c: [90, 135, 172] },
  { h: -0.02, c: [115, 160, 190] },
  { h:  0.0,  c: [175, 185, 155] },
  { h:  0.02, c: [135, 172, 108] },
  { h:  0.08, c: [115, 162, 88] },
  { h:  0.2,  c: [92, 145, 68] },
  { h:  0.35, c: [80, 132, 62] },
  { h:  0.55, c: [95, 128, 78] },
  { h:  0.72, c: [155, 150, 138] },
  { h:  0.85, c: [192, 186, 175] },
  { h:  1.0,  c: [238, 234, 225] },
];

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

function lerpRGB(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function interpolateStops(stops, h) {
  if (h <= stops[0].h) return stops[0].c;
  const last = stops.length - 1;
  if (h >= stops[last].h) return stops[last].c;

  for (let i = 1; i <= last; i++) {
    if (h <= stops[i].h) {
      const a = stops[i - 1];
      const b = stops[i];
      const t = (h - a.h) / (b.h - a.h);
      return lerpRGB(a.c, b.c, t);
    }
  }
  return stops[last].c;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Map a height + moisture value to an [r, g, b] biome color.
 *
 * @param {number} height   — terrain height, roughly [-1, 1]
 * @param {number} moisture — moisture noise, [-1, 1]
 * @param {'dark'|'light'} theme
 * @returns {[number, number, number]}
 */
export function getBiomeColor(height, moisture, theme) {
  const dryStops = theme === 'light' ? LIGHT_DRY : DARK_DRY;
  const wetStops = theme === 'light' ? LIGHT_WET : DARK_WET;

  const m = moisture < -1 ? 0 : moisture > 1 ? 1 : (moisture + 1) * 0.5;

  const dry = interpolateStops(dryStops, height);
  const wet = interpolateStops(wetStops, height);

  return [
    Math.round(dry[0] + (wet[0] - dry[0]) * m),
    Math.round(dry[1] + (wet[1] - dry[1]) * m),
    Math.round(dry[2] + (wet[2] - dry[2]) * m),
  ];
}

/**
 * Convert a hex color string to an rgba() CSS string.
 */
export function territoryColor(hexColor, alpha = 1) {
  const hex = hexColor.replace(/^#/, '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
