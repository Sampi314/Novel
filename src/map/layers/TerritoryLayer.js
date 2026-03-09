/**
 * TerritoryLayer — draws territory polygon overlays on the map canvas.
 *
 * Each territory from world.json has:
 *   { id, name, han, color, cx, cy, era_start, era_end, pts: [[x,y], ...] }
 *
 * Borders use fractal noise displacement for natural-looking edges
 * instead of straight lines between vertices.
 */

import { createNoise } from '../utils/noise.js';

// Persistent noise generator for border displacement (seed 137 for borders)
const borderNoise = createNoise(137);

/**
 * Parse a hex color string (#rrggbb) into { r, g, b }.
 */
function parseHex(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/**
 * Convert a world-coordinate point to screen-coordinate.
 */
function worldToScreen(wx, wy, vpX, vpY, scale) {
  return {
    sx: (wx - vpX) * scale,
    sy: (wy - vpY) * scale,
  };
}

/**
 * Generate fractal-displaced points along a line segment between two world points.
 * Uses simplex noise to displace points perpendicular to the edge direction.
 *
 * @param {number} x0 — start X (world coords)
 * @param {number} y0 — start Y (world coords)
 * @param {number} x1 — end X (world coords)
 * @param {number} y1 — end Y (world coords)
 * @param {number} amplitude — max displacement in world units
 * @param {number} subdivisions — number of intermediate points
 * @returns {Array<[number, number]>} — displaced intermediate points (excludes start)
 */
function fractalEdge(x0, y0, x1, y1, amplitude, subdivisions) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return [[x1, y1]];

  // Normal perpendicular to the edge
  const nx = -dy / len;
  const ny = dx / len;

  // Noise sampling frequency — controls the "wiggliness"
  const noiseScale = 0.003;

  const points = [];
  for (let i = 1; i <= subdivisions; i++) {
    const t = i / subdivisions;
    // Interpolated position along the straight edge
    const mx = x0 + dx * t;
    const my = y0 + dy * t;

    // Taper displacement to zero at endpoints so borders connect cleanly
    const taper = Math.sin(t * Math.PI);

    // Multi-octave noise for natural look
    const n = borderNoise.fbm(mx * noiseScale, my * noiseScale, 4, 2.0, 0.5);

    // Displace perpendicular to edge
    const disp = n * amplitude * taper;
    points.push([mx + nx * disp, my + ny * disp]);
  }

  return points;
}

/**
 * Build a fractal polygon path from territory vertices.
 * Each edge is subdivided and displaced with noise.
 *
 * @param {Array<[number, number]>} pts — polygon vertices in world coords
 * @param {number} scale — viewport scale (pixels per world unit)
 * @returns {Array<[number, number]>} — all points for the fractal polygon
 */
function buildFractalPolygon(pts, scale) {
  // Adapt subdivision count and amplitude to zoom level
  // More subdivisions when zoomed in, fewer when zoomed out
  const baseSubdivisions = Math.max(8, Math.min(40, Math.round(scale * 400)));
  const amplitude = 120; // World units of max displacement

  const allPoints = [];

  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];

    // Start point
    if (i === 0) allPoints.push([x0, y0]);

    // Edge length determines actual subdivision count
    const edgeLen = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
    const subs = Math.max(4, Math.round(baseSubdivisions * edgeLen / 2000));

    const edgePoints = fractalEdge(x0, y0, x1, y1, amplitude, subs);
    allPoints.push(...edgePoints);
  }

  return allPoints;
}

/**
 * Draw territory polygon overlays for the current era.
 *
 * @param {CanvasRenderingContext2D} ctx   — canvas 2D context
 * @param {{ x: number, y: number, width: number, height: number, scale: number }} viewport
 *        — viewport in world coordinates
 * @param {Array} territories — territory array from world.json
 * @param {Array} eras        — era array from world.json
 * @param {number} currentEraIndex — selected era index
 */
export function drawTerritories(ctx, viewport, territories, eras, currentEraIndex) {
  if (!territories || !eras || territories.length === 0) return;

  const { x: vpX, y: vpY, scale } = viewport;
  const eraYear = eras[currentEraIndex]?.year ?? 0;

  // Filter territories visible in the current era
  const visible = territories.filter(
    (t) => t.era_start <= eraYear && (t.era_end == null || t.era_end > eraYear)
  );

  for (const ter of visible) {
    const pts = ter.pts;
    if (!pts || pts.length < 3) continue;

    const { r, g, b } = parseHex(ter.color || '#888888');

    // Build fractal polygon path
    const fractalPts = buildFractalPolygon(pts, scale);

    ctx.beginPath();
    for (let i = 0; i < fractalPts.length; i++) {
      const { sx, sy } = worldToScreen(fractalPts[i][0], fractalPts[i][1], vpX, vpY, scale);
      if (i === 0) {
        ctx.moveTo(sx, sy);
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.closePath();

    // Fill with transparent territory color
    ctx.fillStyle = `rgba(${r},${g},${b},0.12)`;
    ctx.fill();

    // Stroke border — solid line for fractal borders (dashes don't look good with jagged edges)
    ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Draw territory name labels when zoomed in enough
    if (scale > 0.04) {
      const { sx: cx, sy: cy } = worldToScreen(ter.cx, ter.cy, vpX, vpY, scale);

      // Vietnamese name (primary)
      const nameFontSize = Math.max(10, Math.min(16, 14 * scale * 10));
      ctx.font = `${nameFontSize}px 'EB Garamond', serif`;
      ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ter.name, cx, cy);

      // Han characters (smaller, dimmer, below)
      if (ter.han) {
        const hanFontSize = Math.max(8, nameFontSize * 0.7);
        ctx.font = `${hanFontSize}px 'Noto Serif TC', serif`;
        ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
        ctx.fillText(ter.han, cx, cy + nameFontSize * 0.9);
      }
    }
  }
}
