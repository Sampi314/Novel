/**
 * TerritoryLayer — draws territory polygon overlays on the map canvas.
 *
 * Each territory from world.json has:
 *   { id, name, han, color, cx, cy, era_start, era_end, pts: [[x,y], ...] }
 */

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

    // Build polygon path
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const { sx, sy } = worldToScreen(pts[i][0], pts[i][1], vpX, vpY, scale);
      if (i === 0) {
        ctx.moveTo(sx, sy);
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.closePath();

    // Fill with transparent territory color
    ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
    ctx.fill();

    // Stroke with dashed border
    ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();

    // Reset line dash
    ctx.setLineDash([]);

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
