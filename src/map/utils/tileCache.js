/**
 * LRU (Least Recently Used) cache for rendered map tiles.
 *
 * Stores OffscreenCanvas bitmaps keyed by (z, x, y, era) so that
 * previously rendered tiles can be reused when panning/zooming
 * without re-running the tile renderer.
 *
 * When the cache exceeds maxSize, the oldest 25% of entries
 * (by lastUsed timestamp) are evicted.
 */
export class TileCache {
  /**
   * @param {number} maxSize — maximum number of cached tiles (default 200)
   */
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    /** @type {Map<string, { bitmap: OffscreenCanvas | ImageBitmap, lastUsed: number }>} */
    this._store = new Map();
  }

  /**
   * Build a cache key string from tile coordinates and era index.
   * @param {number} z — zoom level
   * @param {number} x — tile column
   * @param {number} y — tile row
   * @param {number|string} era — era index or identifier
   * @returns {string} key in the form "era:z:x:y"
   */
  key(z, x, y, era) {
    return `${era}:${z}:${x}:${y}`;
  }

  /**
   * Retrieve a cached bitmap. Updates the lastUsed timestamp on hit.
   * @param {number} z
   * @param {number} x
   * @param {number} y
   * @param {number|string} era
   * @returns {OffscreenCanvas | ImageBitmap | null}
   */
  get(z, x, y, era) {
    const k = this.key(z, x, y, era);
    const entry = this._store.get(k);
    if (!entry) return null;
    entry.lastUsed = performance.now();
    return entry.bitmap;
  }

  /**
   * Store a rendered bitmap in the cache.
   * Triggers eviction if the cache exceeds maxSize after insertion.
   * @param {number} z
   * @param {number} x
   * @param {number} y
   * @param {number|string} era
   * @param {OffscreenCanvas | ImageBitmap} bitmap
   */
  set(z, x, y, era, bitmap) {
    const k = this.key(z, x, y, era);
    this._store.set(k, {
      bitmap,
      lastUsed: performance.now(),
    });
    if (this._store.size > this.maxSize) {
      this._evict();
    }
  }

  /**
   * Check whether a tile is already cached.
   * @param {number} z
   * @param {number} x
   * @param {number} y
   * @param {number|string} era
   * @returns {boolean}
   */
  has(z, x, y, era) {
    return this._store.has(this.key(z, x, y, era));
  }

  /**
   * Remove all entries from the cache.
   */
  clear() {
    this._store.clear();
  }

  /**
   * Evict the oldest 25% of entries by lastUsed timestamp.
   * Called automatically when cache size exceeds maxSize.
   */
  _evict() {
    const evictCount = Math.ceil(this._store.size * 0.25);

    // Sort entries by lastUsed ascending (oldest first)
    const sorted = [...this._store.entries()].sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed
    );

    for (let i = 0; i < evictCount; i++) {
      this._store.delete(sorted[i][0]);
    }
  }
}
