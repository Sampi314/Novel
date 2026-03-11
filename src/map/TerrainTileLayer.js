// src/map/TerrainTileLayer.js
import L from 'leaflet';

/**
 * Custom Leaflet GridLayer that generates terrain tiles via Web Worker.
 */
export const TerrainTileLayer = L.GridLayer.extend({
  initialize(worker, options) {
    this._worker = worker;
    this._pending = new Map(); // requestId -> { tile, done callback }
    this._requestId = 0;
    this._currentT = 0;
    this._theme = 'dark';

    // Listen for worker responses using addEventListener (not onmessage)
    // to avoid conflict with MapViewer's init-complete listener
    this._onMsg = (e) => this._onWorkerMessage(e);
    this._worker.addEventListener('message', this._onMsg);

    L.GridLayer.prototype.initialize.call(this, {
      tileSize: 256,
      minZoom: 0,
      maxZoom: 8,
      ...options,
    });
  },

  onRemove(map) {
    this._worker.removeEventListener('message', this._onMsg);
    L.GridLayer.prototype.onRemove.call(this, map);
  },

  setT(T) {
    if (this._currentT !== T) {
      this._currentT = T;
      this.redraw();
    }
  },

  setTheme(theme) {
    if (this._theme !== theme) {
      this._theme = theme;
      this.redraw();
    }
  },

  createTile(coords, done) {
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 256;

    const requestId = ++this._requestId;
    this._pending.set(requestId, { tile, done });

    this._worker.postMessage({
      type: 'tile',
      requestId,
      zoom: coords.z,
      x: coords.x,
      y: coords.y,
      T: this._currentT,
      theme: this._theme,
    });

    return tile;
  },

  _onWorkerMessage(e) {
    const { type, requestId, tileData } = e.data;

    if (type === 'tile' && this._pending.has(requestId)) {
      const { tile, done } = this._pending.get(requestId);
      this._pending.delete(requestId);

      // Reconstruct ImageData from transferred buffer
      const imageData = new ImageData(
        new Uint8ClampedArray(tileData.data),
        tileData.width,
        tileData.height
      );

      const ctx = tile.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
      done(null, tile);
    }
  },
});

export function createTerrainTileLayer(worker, options) {
  return new TerrainTileLayer(worker, options);
}
