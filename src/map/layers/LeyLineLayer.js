/**
 * LeyLineLayer — draws animated ley lines (spiritual energy flows) on the
 * map canvas.
 *
 * Each ley line from world.json has:
 *   { id, name, han, pts: [[x,y], ...], color: "#hexcolor", dur: number }
 */

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
 * Build a smooth quadratic-curve sub-path through the given screen points.
 *
 * Uses the midpoint technique: for each pair of consecutive control points,
 * draw a quadraticCurveTo where the "on-curve" point is the midpoint between
 * them. This produces a smooth C1-continuous spline through all midpoints,
 * starting exactly at the first point and ending at the last.
 */
function traceSmoothCurve(ctx, screenPts) {
  if (screenPts.length < 2) return;

  ctx.moveTo(screenPts[0].sx, screenPts[0].sy);

  if (screenPts.length === 2) {
    // Only two points — straight line
    ctx.lineTo(screenPts[1].sx, screenPts[1].sy);
    return;
  }

  // First segment: line to midpoint of first two control points
  const mid0x = (screenPts[0].sx + screenPts[1].sx) / 2;
  const mid0y = (screenPts[0].sy + screenPts[1].sy) / 2;
  ctx.lineTo(mid0x, mid0y);

  // Middle segments: quadratic curves through midpoints
  for (let i = 1; i < screenPts.length - 1; i++) {
    const cpx = screenPts[i].sx;
    const cpy = screenPts[i].sy;
    const nextX = screenPts[i + 1].sx;
    const nextY = screenPts[i + 1].sy;

    // End-point is midpoint between current and next control point,
    // except for the very last segment where we go to the final point.
    if (i < screenPts.length - 2) {
      const midX = (cpx + nextX) / 2;
      const midY = (cpy + nextY) / 2;
      ctx.quadraticCurveTo(cpx, cpy, midX, midY);
    } else {
      // Last segment — curve ends at the final point exactly
      ctx.quadraticCurveTo(cpx, cpy, nextX, nextY);
    }
  }
}

/**
 * Draw animated ley lines onto the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx   — canvas 2D context
 * @param {{ x: number, y: number, width: number, height: number, scale: number }} viewport
 *        — viewport in world coordinates
 * @param {Array} leyLines — ley line array from world.json
 * @param {number} zoom    — current zoom level
 * @param {number} time    — timestamp from performance.now()
 */
export function drawLeyLines(ctx, viewport, leyLines, zoom, time) {
  // Only render when zoomed in enough to see detail
  if (zoom < 1) return;
  if (!leyLines || leyLines.length === 0) return;

  const { x: vpX, y: vpY, scale } = viewport;

  ctx.save();
  ctx.lineCap = 'round';

  for (const line of leyLines) {
    const pts = line.pts;
    if (!pts || pts.length < 2) continue;

    // Convert all world-space points to screen-space
    const screenPts = pts.map(([wx, wy]) => worldToScreen(wx, wy, vpX, vpY, scale));

    // --- Pass 1: Outer glow stroke ---
    ctx.beginPath();
    traceSmoothCurve(ctx, screenPts);
    ctx.strokeStyle = line.color + '30'; // ~19% alpha
    ctx.lineWidth = 6;
    ctx.stroke();

    // --- Pass 2: Inner glow stroke ---
    ctx.beginPath();
    traceSmoothCurve(ctx, screenPts);
    ctx.strokeStyle = line.color + '80'; // ~50% alpha
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}
