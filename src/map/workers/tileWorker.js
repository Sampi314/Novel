// src/map/workers/tileWorker.js
import { computeKeyframes, GRID } from '../pipeline/keyframes.js';
import { interpolateKeyframes } from '../pipeline/interpolator.js';
import { renderTile } from '../pipeline/renderer.js';
import { computeTerrainBorders } from '../pipeline/borderCompute.js';

let keyframes = null;

/**
 * Downsample a river path, keeping every Nth point + always keeping first/last.
 * Short paths (< 3*step) are kept as-is.
 */
function downsamplePath(path, step) {
  if (path.length <= step * 3) return path;
  const result = [path[0]];
  for (let i = step; i < path.length - 1; i += step) {
    result.push(path[i]);
  }
  result.push(path[path.length - 1]);
  return result;
}

/**
 * Compute the total world-space length of a river path.
 */
function pathLength(path) {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i - 1][0];
    const dy = path[i][1] - path[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

self.onmessage = function (e) {
  const { type } = e.data;

  if (type === 'init') {
    const { eras, worldSeed } = e.data;
    keyframes = computeKeyframes(eras, worldSeed, (done, total) => {
      self.postMessage({ type: 'init-progress', done, total });
    });

    // Export D8 river paths for each keyframe
    // Keep rivers with meaningful length, downsample for transfer size
    const riverData = keyframes.map(kf => {
      const filtered = kf.rivers
        .filter(r => r.path.length >= 10)
        .map(r => ({
          path: downsamplePath(r.path, 4),
          accumulation: r.accumulation,
        }))
        .filter(r => r.path.length >= 3);
      return { T: kf.T, rivers: filtered };
    });

    self.postMessage({ type: 'init-complete', keyframeCount: keyframes.length, riverData });
    return;
  }

  if (type === 'compute-borders') {
    const { territories, T } = e.data;
    if (!keyframes) {
      self.postMessage({ type: 'borders', borders: [] });
      return;
    }
    const { heightmap } = interpolateKeyframes(keyframes, T);

    // Find nearest keyframe rivers for border snapping
    let nearestKf = keyframes[0];
    let minDist = Math.abs(T - nearestKf.T);
    for (const kf of keyframes) {
      const d = Math.abs(T - kf.T);
      if (d < minDist) { minDist = d; nearestKf = kf; }
    }

    const borders = computeTerrainBorders(territories, heightmap, nearestKf.rivers, GRID);
    self.postMessage({ type: 'borders', borders });
    return;
  }

  if (type === 'tile') {
    const { zoom, x, y, T, theme, requestId } = e.data;

    if (!keyframes) {
      self.postMessage({ type: 'error', requestId, error: 'Not initialized' });
      return;
    }

    // Interpolate to current T
    const { heightmap, biomes, flowAccum } = interpolateKeyframes(keyframes, T);

    // Render the tile — returns { data: Uint8ClampedArray, width, height }
    const tileData = renderTile(heightmap, biomes, x, y, zoom, theme, flowAccum);

    // Transfer the pixel buffer (zero-copy)
    self.postMessage(
      { type: 'tile', requestId, zoom, x, y, tileData },
      [tileData.data.buffer]
    );
    return;
  }
};
