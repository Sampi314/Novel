// src/map/workers/tileWorker.js
import { computeKeyframes, GRID } from '../pipeline/keyframes.js';
import { interpolateKeyframes } from '../pipeline/interpolator.js';
import { renderTile } from '../pipeline/renderer.js';

let keyframes = null;

self.onmessage = function (e) {
  const { type } = e.data;

  if (type === 'init') {
    const { eras, worldSeed } = e.data;
    keyframes = computeKeyframes(eras, worldSeed, (done, total) => {
      self.postMessage({ type: 'init-progress', done, total });
    });
    self.postMessage({ type: 'init-complete', keyframeCount: keyframes.length });
    return;
  }

  if (type === 'tile') {
    const { zoom, x, y, T, theme, requestId } = e.data;

    if (!keyframes) {
      self.postMessage({ type: 'error', requestId, error: 'Not initialized' });
      return;
    }

    // Interpolate to current T
    const { heightmap, biomes } = interpolateKeyframes(keyframes, T);

    // Render the tile — returns { data: Uint8ClampedArray, width, height }
    const tileData = renderTile(heightmap, biomes, x, y, zoom, theme);

    // Transfer the pixel buffer (zero-copy)
    self.postMessage(
      { type: 'tile', requestId, zoom, x, y, tileData },
      [tileData.data.buffer]
    );
    return;
  }
};
