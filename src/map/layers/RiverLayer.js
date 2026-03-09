/**
 * RiverLayer.js — draws rivers on the map canvas.
 *
 * Rivers are rendered as smooth curves using quadratic Bezier segments.
 * Major rivers (rank 1) are drawn thicker and more opaque than tributaries
 * (rank 2).
 */

const RIVER_COLOR_R = 60;
const RIVER_COLOR_G = 120;
const RIVER_COLOR_B = 180;

const RANK_STYLES = {
  1: { lineWidth: 2.5, alpha: 0.7 },
  2: { lineWidth: 1.5, alpha: 0.5 },
};

const DEFAULT_STYLE = RANK_STYLES[2];

/**
 * Draw all rivers onto the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx — destination canvas context
 * @param {{ x: number, y: number, scale: number }} viewport
 *        Viewport in world coordinates. `scale` converts world units to
 *        screen pixels.
 * @param {Array<{ id: string, name: string, han: string, rank: number, pts: number[][] }>} rivers
 *        River definitions from world.json.
 * @param {number} zoom — current zoom level
 */
export function drawRivers(ctx, viewport, rivers, zoom) {
  // Too zoomed out — skip river rendering
  if (zoom < 2) return;

  if (!rivers || rivers.length === 0) return;

  const vpX = viewport.x;
  const vpY = viewport.y;
  const scale = viewport.scale;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < rivers.length; i++) {
    const river = rivers[i];
    const pts = river.pts;
    if (!pts || pts.length < 2) continue;

    const style = RANK_STYLES[river.rank] || DEFAULT_STYLE;

    ctx.lineWidth = style.lineWidth;
    ctx.strokeStyle = `rgba(${RIVER_COLOR_R}, ${RIVER_COLOR_G}, ${RIVER_COLOR_B}, ${style.alpha})`;

    // Convert first point to screen coordinates
    let sx = (pts[0][0] - vpX) * scale;
    let sy = (pts[0][1] - vpY) * scale;

    ctx.beginPath();
    ctx.moveTo(sx, sy);

    // Draw smooth curve through intermediate points using quadraticCurveTo.
    // For each middle point, the control point is the point itself and the
    // end point is the midpoint between the current point and the next one.
    for (let j = 1; j < pts.length - 1; j++) {
      const cpx = (pts[j][0] - vpX) * scale;
      const cpy = (pts[j][1] - vpY) * scale;

      const nextSx = (pts[j + 1][0] - vpX) * scale;
      const nextSy = (pts[j + 1][1] - vpY) * scale;

      const midX = (cpx + nextSx) / 2;
      const midY = (cpy + nextSy) / 2;

      ctx.quadraticCurveTo(cpx, cpy, midX, midY);
    }

    // Line to the last point
    const lastPt = pts[pts.length - 1];
    ctx.lineTo((lastPt[0] - vpX) * scale, (lastPt[1] - vpY) * scale);

    ctx.stroke();
  }

  ctx.restore();
}
