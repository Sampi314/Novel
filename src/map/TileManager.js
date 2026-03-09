/**
 * TileManager — manages the tile lifecycle for the map renderer.
 *
 * Responsibilities:
 *   1. Determine which tiles are visible in the current viewport
 *   2. Check the LRU cache for already-rendered tiles
 *   3. Dispatch cache-misses to the tile worker (off main thread)
 *   4. Receive rendered ImageData back, wrap in OffscreenCanvas, cache it
 *   5. Draw cached tiles to the main canvas at the correct screen positions
 */

import { TileCache } from './utils/tileCache.js';

const TILE_SIZE = 256;

export class TileManager {
  constructor() {
    /** @type {TileCache} LRU cache for rendered tile bitmaps */
    this.cache = new TileCache(200);

    /** @type {Worker} Off-main-thread tile renderer */
    this.worker = new Worker(
      new URL('./workers/tileWorker.js', import.meta.url),
      { type: 'module' }
    );

    /**
     * Tracks in-flight tile requests that have been sent to the worker
     * but have not yet returned.
     * @type {Map<number, { tx: number, ty: number, zoom: number, eraIndex: number, onReady: Function|undefined }>}
     */
    this.pending = new Map();

    /** @type {number} Auto-incrementing request ID */
    this.nextId = 0;

    // Wire up worker responses
    this.worker.onmessage = (e) => this._onWorkerMessage(e);
  }

  // ---------------------------------------------------------------------------
  // Worker message handler
  // ---------------------------------------------------------------------------

  /**
   * Called when the tile worker posts a message back with rendered tile data.
   * Reconstructs the ImageData from the transferred buffer, wraps it in an
   * OffscreenCanvas, stores it in the cache, and triggers a redraw callback.
   *
   * @param {MessageEvent} e
   */
  _onWorkerMessage(e) {
    const { id, imageData, error } = e.data;

    const req = this.pending.get(id);
    this.pending.delete(id);

    if (!req) return;

    if (error) {
      console.warn(`TileManager: worker error for tile (${req.tx},${req.ty}) z${req.zoom}:`, error);
      return;
    }

    // The worker transfers the underlying ArrayBuffer, so imageData.data
    // arrives as a raw ArrayBuffer rather than a Uint8ClampedArray.
    // Reconstruct proper ImageData from the transferred buffer.
    const reconstructed = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Paint onto a regular canvas (OffscreenCanvas has poor iOS Safari support)
    const bitmap = document.createElement('canvas');
    bitmap.width = TILE_SIZE;
    bitmap.height = TILE_SIZE;
    const bctx = bitmap.getContext('2d');
    bctx.putImageData(reconstructed, 0, 0);

    // Store in cache
    this.cache.set(req.zoom, req.tx, req.ty, req.eraIndex, bitmap);

    // Notify caller that a tile is ready (typically triggers canvas redraw)
    if (req.onReady) {
      req.onReady();
    }
  }

  // ---------------------------------------------------------------------------
  // Tile requesting
  // ---------------------------------------------------------------------------

  /**
   * Request a single tile. Returns the cached OffscreenCanvas immediately if
   * available, otherwise dispatches to the worker and returns null.
   *
   * @param {number} tx        — tile column
   * @param {number} ty        — tile row
   * @param {number} zoom      — zoom level
   * @param {number} eraIndex  — era index
   * @param {object} theme     — theme/style config passed to the worker
   * @param {Function} [onReady] — callback when the tile finishes rendering
   * @returns {OffscreenCanvas|null} cached bitmap or null if pending
   */
  requestTile(tx, ty, zoom, eraIndex, theme, onReady) {
    // 1. Check cache
    const cached = this.cache.get(zoom, tx, ty, eraIndex);
    if (cached) return cached;

    // 2. Check if already in-flight (avoid duplicate worker requests)
    for (const pending of this.pending.values()) {
      if (
        pending.tx === tx &&
        pending.ty === ty &&
        pending.zoom === zoom &&
        pending.eraIndex === eraIndex
      ) {
        return null;
      }
    }

    // 3. Dispatch to worker
    const id = this.nextId++;
    this.worker.postMessage({ id, tx, ty, zoom, eraIndex, theme });
    this.pending.set(id, { tx, ty, zoom, eraIndex, onReady });

    return null;
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  /**
   * Draw all visible tiles for the given viewport onto a canvas 2D context.
   *
   * @param {CanvasRenderingContext2D} ctx — destination canvas context
   * @param {{ x: number, y: number, width: number, height: number, scale: number }} viewport
   *        Viewport in world coordinates. `scale` converts world units to screen pixels.
   * @param {number} zoom      — current zoom level
   * @param {number} eraIndex  — active era index
   * @param {object} theme     — theme config forwarded to workers on cache miss
   * @param {Function} [onReady] — callback when any tile finishes rendering
   */
  drawTiles(ctx, viewport, zoom, eraIndex, theme, onReady) {
    // Each zoom level divides the 10000x10000 world into 2^zoom tiles per axis
    const tilesPerAxis = Math.pow(2, zoom);
    const tileWorldSize = 10000 / tilesPerAxis;

    const vpX = viewport.x;
    const vpY = viewport.y;
    const scale = viewport.scale;

    // Determine visible tile range
    let startTx = Math.floor(vpX / tileWorldSize);
    let startTy = Math.floor(vpY / tileWorldSize);
    let endTx = Math.floor((vpX + viewport.width) / tileWorldSize);
    let endTy = Math.floor((vpY + viewport.height) / tileWorldSize);

    // Clamp to valid range [0, 2^zoom - 1]
    const maxTile = tilesPerAxis - 1;
    startTx = Math.max(0, Math.min(startTx, maxTile));
    startTy = Math.max(0, Math.min(startTy, maxTile));
    endTx = Math.max(0, Math.min(endTx, maxTile));
    endTy = Math.max(0, Math.min(endTy, maxTile));

    // Iterate over all visible tiles
    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const tileBitmap = this.requestTile(tx, ty, zoom, eraIndex, theme, onReady);

        if (tileBitmap) {
          // Calculate screen position
          const screenX = (tx * tileWorldSize - vpX) * scale;
          const screenY = (ty * tileWorldSize - vpY) * scale;
          const screenSize = tileWorldSize * scale;

          ctx.drawImage(tileBitmap, screenX, screenY, screenSize, screenSize);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Terminate the worker and clear the cache. Call when the map is unmounted.
   */
  destroy() {
    this.worker.terminate();
    this.cache.clear();
  }
}
