/**
 * tileWorker.js — Web Worker for off-main-thread terrain tile generation.
 *
 * Message protocol:
 *   IN:  { id, tx, ty, zoom, eraIndex, theme }
 *   OUT: { id, imageData: { data, width, height } }   (ArrayBuffer transferred)
 *   ERR: { id, error: string }
 */

import { generateTerrainTile } from '../generators/TerrainGenerator.js';

self.onmessage = (e) => {
  const { id, tx, ty, zoom, eraIndex, theme } = e.data;

  try {
    const imageData = generateTerrainTile(tx, ty, zoom, eraIndex, theme);

    self.postMessage(
      {
        id,
        imageData: {
          data: imageData.data,
          width: imageData.width,
          height: imageData.height,
        },
      },
      [imageData.data.buffer]
    );
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
