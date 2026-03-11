/**
 * RoadLayer.js — draws roads and trade routes on the map canvas.
 *
 * Renders two types:
 *   1. Procedurally generated roads (from RoadGenerator) — thinner, subtle
 *   2. Trade routes (from CSV data) — thicker, era-filtered, named
 *
 * Both use smooth quadratic Bezier curves through waypoints.
 */

const COLORS = {
  dark: {
    major:      { r: 160, g: 130, b: 80 },  // golden-brown
    minor:      { r: 130, g: 115, b: 85 },  // muted tan
    trade_land: { r: 196, g: 163, b: 90 },  // bright gold
    trade_sea:  { r: 90,  g: 150, b: 196 }, // sea blue
  },
  light: {
    major:      { r: 120, g: 90,  b: 50 },
    minor:      { r: 110, g: 95,  b: 65 },
    trade_land: { r: 160, g: 120, b: 50 },
    trade_sea:  { r: 60,  g: 120, b: 170 },
  },
};

// ---------------------------------------------------------------------------
// Smooth path drawing (same quadratic Bezier approach as RiverLayer)
// ---------------------------------------------------------------------------

function drawSmoothPath(ctx, pts, vpX, vpY, scale) {
  if (pts.length < 2) return;

  let sx = (pts[0][0] - vpX) * scale;
  let sy = (pts[0][1] - vpY) * scale;

  ctx.beginPath();
  ctx.moveTo(sx, sy);

  for (let j = 1; j < pts.length - 1; j++) {
    const cpx = (pts[j][0] - vpX) * scale;
    const cpy = (pts[j][1] - vpY) * scale;
    const nextSx = (pts[j + 1][0] - vpX) * scale;
    const nextSy = (pts[j + 1][1] - vpY) * scale;
    const midX = (cpx + nextSx) / 2;
    const midY = (cpy + nextSy) / 2;
    ctx.quadraticCurveTo(cpx, cpy, midX, midY);
  }

  const last = pts[pts.length - 1];
  ctx.lineTo((last[0] - vpX) * scale, (last[1] - vpY) * scale);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Public draw function
// ---------------------------------------------------------------------------

/**
 * Draw roads and trade routes on the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, scale: number }} viewport
 * @param {Array<{ rank: number, pts: number[][] }>} roads — generated roads
 * @param {Array<{ type: string, pts: number[][], era_start: number, era_end: number|null }>} tradeRoutes
 * @param {number} zoom
 * @param {'dark'|'light'} theme
 * @param {number|null} currentEraYear — for filtering era-dependent routes
 */
export function drawRoads(ctx, viewport, roads, tradeRoutes, zoom, theme, currentEraYear) {
  // Roads only visible at zoom >= 2, trade routes at zoom >= 1
  if (zoom < 1) return;

  const palette = COLORS[theme] || COLORS.dark;
  const vpX = viewport.x;
  const vpY = viewport.y;
  const scale = viewport.scale;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // --- 1. Generated roads (draw first = underneath) ---
  if (roads && roads.length > 0 && zoom >= 2) {
    for (let i = 0; i < roads.length; i++) {
      const road = roads[i];
      const pts = road.pts;
      if (!pts || pts.length < 2) continue;

      const c = road.rank === 1 ? palette.major : palette.minor;
      const alpha = road.rank === 1 ? 0.55 : 0.35;

      ctx.lineWidth = road.rank === 1 ? 1.8 : 1.0;
      ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;

      if (road.rank === 2) {
        ctx.setLineDash([5, 4]);
      } else {
        ctx.setLineDash([]);
      }

      drawSmoothPath(ctx, pts, vpX, vpY, scale);
    }
  }

  // --- 2. Trade routes (draw on top = more prominent) ---
  if (tradeRoutes && tradeRoutes.length > 0 && zoom >= 1) {
    for (let i = 0; i < tradeRoutes.length; i++) {
      const route = tradeRoutes[i];

      // Era filtering
      if (currentEraYear != null) {
        if (route.era_start > currentEraYear) continue;
        if (route.era_end != null && route.era_end < currentEraYear) continue;
      }

      const pts = route.pts;
      if (!pts || pts.length < 2) continue;

      // Skip routes with invalid waypoints (NaN from broken parsing)
      if (isNaN(pts[0][0]) || isNaN(pts[0][1])) continue;

      const isSea = route.type === 'sea';
      const c = isSea ? palette.trade_sea : palette.trade_land;
      const alpha = isSea ? 0.5 : 0.65;

      ctx.lineWidth = 2.2;
      ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;

      if (isSea) {
        ctx.setLineDash([7, 5]);
      } else {
        ctx.setLineDash([]);
      }

      drawSmoothPath(ctx, pts, vpX, vpY, scale);
    }
  }

  // Reset dash
  ctx.setLineDash([]);
  ctx.restore();
}
