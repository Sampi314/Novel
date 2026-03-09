# Tile-based Procedural World Map — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken FMG iframe with a custom tile-based canvas map that procedurally generates terrain, supports Google Maps-style multi-scale zoom (world → street), evolves gradually across 7 eras, and generates city layouts when zooming in.

**Architecture:** Tile-based Canvas 2D rendering with a Web Worker for off-thread procedural generation. World coordinates (0-10000) map to slippy-map tiles. Each zoom level range has a dedicated generator. An LRU cache stores ~200 rendered tiles. Era changes use seed offsets for gradual terrain drift.

**Tech Stack:** React 19, Canvas 2D API, Web Workers, Simplex noise (custom ~100 lines), no new npm dependencies.

---

## Phase 1: Core Map Engine

### Task 1: Simplex Noise Utility

**Files:**
- Create: `src/map/utils/noise.js`

**Step 1: Create noise module**

```js
// src/map/utils/noise.js
// 2D Simplex noise — deterministic, seedable
// Adapted from Stefan Gustavson's implementation (public domain)

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const GRAD = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

export function createNoise(seed = 0) {
  // Build permutation table from seed
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates shuffle with seed
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function noise2D(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = x - X0, y0 = y - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const gi0 = perm[ii + perm[jj]] % 8;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 8;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 8;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * (GRAD[gi0][0]*x0 + GRAD[gi0][1]*y0); }
    let t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * (GRAD[gi1][0]*x1 + GRAD[gi1][1]*y1); }
    let t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * (GRAD[gi2][0]*x2 + GRAD[gi2][1]*y2); }
    return 70 * (n0 + n1 + n2); // range roughly [-1, 1]
  }

  // Fractal Brownian Motion — layered noise for natural terrain
  function fbm(x, y, octaves = 6, lacunarity = 2, gain = 0.5) {
    let sum = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise2D(x * freq, y * freq);
      max += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / max; // normalized to [-1, 1]
  }

  return { noise2D, fbm };
}
```

**Step 2: Verify it works**

Open browser console and test:
```
import('/src/map/utils/noise.js').then(m => {
  const n = m.createNoise(42);
  console.log(n.fbm(1.5, 2.3)); // should return a number in [-1, 1]
  console.log(n.fbm(1.5, 2.3)); // same number (deterministic)
  console.log(n.fbm(1.5, 2.3) === n.fbm(1.5, 2.3)); // true
});
```

**Step 3: Commit**

```bash
git add src/map/utils/noise.js
git commit -m "feat(map): add simplex noise utility with fbm"
```

---

### Task 2: Color Palette

**Files:**
- Create: `src/map/utils/colors.js`

**Step 1: Create color palette**

```js
// src/map/utils/colors.js
// Xianxia-themed terrain colors

// height ranges: [-1, 1] mapped to terrain type
// deep ocean → shallow → beach → lowland → highland → mountain → peak
export const TERRAIN_COLORS = {
  dark: [
    { h: -1.0,  r: 8,   g: 15,  b: 30  },  // deep ocean
    { h: -0.4,  r: 15,  g: 30,  b: 55  },  // ocean
    { h: -0.05, r: 25,  g: 50,  b: 70  },  // shallow water
    { h: 0.0,   r: 50,  g: 55,  b: 40  },  // beach/shore
    { h: 0.05,  r: 30,  g: 50,  b: 25  },  // lowland (grass)
    { h: 0.2,   r: 25,  g: 45,  b: 20  },  // forest
    { h: 0.4,   r: 55,  g: 50,  b: 35  },  // highland
    { h: 0.6,   r: 70,  g: 65,  b: 55  },  // mountain
    { h: 0.8,   r: 90,  g: 85,  b: 80  },  // high mountain
    { h: 1.0,   r: 180, g: 175, b: 170 },  // snow peak
  ],
  light: [
    { h: -1.0,  r: 100, g: 140, b: 180 },
    { h: -0.4,  r: 120, g: 165, b: 200 },
    { h: -0.05, r: 150, g: 190, b: 210 },
    { h: 0.0,   r: 210, g: 200, b: 170 },
    { h: 0.05,  r: 160, g: 180, b: 120 },
    { h: 0.2,   r: 130, g: 160, b: 100 },
    { h: 0.4,   r: 170, g: 160, b: 130 },
    { h: 0.6,   r: 180, g: 170, b: 150 },
    { h: 0.8,   r: 200, g: 195, b: 185 },
    { h: 1.0,   r: 240, g: 238, b: 235 },
  ],
};

// Interpolate color from height value
export function heightToColor(height, theme = 'dark') {
  const palette = TERRAIN_COLORS[theme] || TERRAIN_COLORS.dark;
  // Clamp height
  const h = Math.max(-1, Math.min(1, height));
  // Find surrounding stops
  let i = 0;
  while (i < palette.length - 1 && palette[i + 1].h < h) i++;
  if (i >= palette.length - 1) {
    const c = palette[palette.length - 1];
    return [c.r, c.g, c.b];
  }
  const a = palette[i], b = palette[i + 1];
  const t = (h - a.h) / (b.h - a.h);
  return [
    Math.round(a.r + t * (b.r - a.r)),
    Math.round(a.g + t * (b.g - a.g)),
    Math.round(a.b + t * (b.b - a.b)),
  ];
}

// Territory colors with alpha for overlay
export function territoryColor(hexColor, alpha = 0.25) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
```

**Step 2: Commit**

```bash
git add src/map/utils/colors.js
git commit -m "feat(map): add xianxia terrain color palette"
```

---

### Task 3: LRU Tile Cache

**Files:**
- Create: `src/map/utils/tileCache.js`

**Step 1: Create LRU cache**

```js
// src/map/utils/tileCache.js

export class TileCache {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.map = new Map(); // key → { bitmap, lastUsed }
  }

  key(z, x, y, era) {
    return `${era}:${z}:${x}:${y}`;
  }

  get(z, x, y, era) {
    const k = this.key(z, x, y, era);
    const entry = this.map.get(k);
    if (!entry) return null;
    entry.lastUsed = performance.now();
    return entry.bitmap;
  }

  set(z, x, y, era, bitmap) {
    const k = this.key(z, x, y, era);
    this.map.set(k, { bitmap, lastUsed: performance.now() });
    if (this.map.size > this.maxSize) this._evict();
  }

  has(z, x, y, era) {
    return this.map.has(this.key(z, x, y, era));
  }

  _evict() {
    // Remove oldest 25% by lastUsed
    const entries = [...this.map.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const removeCount = Math.floor(this.maxSize * 0.25);
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      this.map.delete(entries[i][0]);
    }
  }

  clear() {
    this.map.clear();
  }
}
```

**Step 2: Commit**

```bash
git add src/map/utils/tileCache.js
git commit -m "feat(map): add LRU tile cache"
```

---

### Task 4: WorldSeed — Deterministic Seed + Era Offset

**Files:**
- Create: `src/map/WorldSeed.js`

**Step 1: Create WorldSeed module**

```js
// src/map/WorldSeed.js
// Manages deterministic world generation with era-based evolution
import { createNoise } from './utils/noise.js';

const BASE_SEED = 42;

// Era indices for offset calculation
const ERA_YEARS = [-500000, 0, 40000, 80000, 130000, 170000, 200000];

export function getEraIndex(year) {
  for (let i = ERA_YEARS.length - 1; i >= 0; i--) {
    if (year >= ERA_YEARS[i]) return i;
  }
  return 0;
}

export function createWorldNoise(eraIndex = 0) {
  // Small offset per era = gradual terrain evolution
  const seed = BASE_SEED + eraIndex * 7;
  return createNoise(seed);
}

// Convert world coordinates (0-10000) to tile coordinates
export function worldToTile(wx, wy, zoom) {
  const tilesPerSide = Math.pow(2, zoom);
  const tx = (wx / 10000) * tilesPerSide;
  const ty = (wy / 10000) * tilesPerSide;
  return { tx: Math.floor(tx), ty: Math.floor(ty) };
}

// Convert tile coordinates to world coordinates (top-left corner)
export function tileToWorld(tx, ty, zoom) {
  const tilesPerSide = Math.pow(2, zoom);
  const wx = (tx / tilesPerSide) * 10000;
  const wy = (ty / tilesPerSide) * 10000;
  return { wx, wy };
}

// Get the world-coordinate range covered by one tile
export function tileWorldSize(zoom) {
  return 10000 / Math.pow(2, zoom);
}
```

**Step 2: Commit**

```bash
git add src/map/WorldSeed.js
git commit -m "feat(map): add WorldSeed with era offset and coordinate helpers"
```

---

### Task 5: Terrain Generator (Zoom 0-7)

**Files:**
- Create: `src/map/generators/TerrainGenerator.js`

**Step 1: Create terrain generator**

This generator produces a 256x256 ImageData for a given tile. It uses fbm noise for heightmap, then maps height to color.

```js
// src/map/generators/TerrainGenerator.js
import { createWorldNoise, tileToWorld, tileWorldSize } from '../WorldSeed.js';
import { heightToColor } from '../utils/colors.js';

// Continent shape mask — uses a separate low-frequency noise to define land vs ocean
function continentMask(noise, wx, wy) {
  // Large-scale continent shape
  const scale = 0.0004;
  const v = noise.fbm(wx * scale, wy * scale, 4, 2, 0.5);
  // Distance from center falloff (keeps land mostly central)
  const cx = (wx - 5000) / 5000;
  const cy = (wy - 5000) / 5000;
  const dist = Math.sqrt(cx * cx + cy * cy);
  const falloff = 1 - Math.pow(Math.min(dist, 1), 2);
  return v * 0.6 + falloff * 0.4;
}

export function generateTerrainTile(tx, ty, zoom, eraIndex, theme = 'dark') {
  const TILE = 256;
  const imageData = new ImageData(TILE, TILE);
  const data = imageData.data;

  const noise = createWorldNoise(eraIndex);
  const { wx: tileWx, wy: tileWy } = tileToWorld(tx, ty, zoom);
  const worldSize = tileWorldSize(zoom);

  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      // Map pixel to world coordinate
      const wx = tileWx + (px / TILE) * worldSize;
      const wy = tileWy + (py / TILE) * worldSize;

      // Base terrain height from fbm
      const detailScale = 0.001;
      const height = noise.fbm(wx * detailScale, wy * detailScale, 6, 2, 0.5);

      // Apply continent mask
      const mask = continentMask(noise, wx, wy);
      // Combine: mask shifts height down for ocean areas
      const finalHeight = height * 0.5 + (mask - 0.3) * 1.0;

      const [r, g, b] = heightToColor(finalHeight, theme);
      const idx = (py * TILE + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  return imageData;
}
```

**Step 2: Commit**

```bash
git add src/map/generators/TerrainGenerator.js
git commit -m "feat(map): add terrain generator with continent mask and fbm heightmap"
```

---

### Task 6: Tile Worker

**Files:**
- Create: `src/map/workers/tileWorker.js`

**Step 1: Create web worker**

The worker imports generators and responds to tile generation requests. Note: Vite supports `new Worker(url, { type: 'module' })` natively.

```js
// src/map/workers/tileWorker.js
import { generateTerrainTile } from '../generators/TerrainGenerator.js';

self.onmessage = function(e) {
  const { id, tx, ty, zoom, eraIndex, theme } = e.data;

  try {
    const imageData = generateTerrainTile(tx, ty, zoom, eraIndex, theme);
    // Transfer the ImageData buffer back (zero-copy)
    const bitmap = imageData;
    self.postMessage({ id, imageData: bitmap }, [bitmap.data.buffer]);
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
```

**Step 2: Commit**

```bash
git add src/map/workers/tileWorker.js
git commit -m "feat(map): add tile generation web worker"
```

---

### Task 7: TileManager

**Files:**
- Create: `src/map/TileManager.js`

**Step 1: Create TileManager**

Manages tile lifecycle: determines visible tiles, checks cache, dispatches to worker, draws to canvas.

```js
// src/map/TileManager.js
import { TileCache } from './utils/tileCache.js';

const TILE_SIZE = 256;

export class TileManager {
  constructor() {
    this.cache = new TileCache(200);
    this.worker = new Worker(
      new URL('./workers/tileWorker.js', import.meta.url),
      { type: 'module' }
    );
    this.pending = new Map(); // id → { resolve, tx, ty, zoom }
    this.nextId = 0;
    this.worker.onmessage = (e) => this._onWorkerMessage(e);
  }

  _onWorkerMessage(e) {
    const { id, imageData, error } = e.data;
    const req = this.pending.get(id);
    if (!req) return;
    this.pending.delete(id);

    if (error) {
      console.warn('Tile generation error:', error);
      return;
    }

    // Reconstruct ImageData from transferred buffer
    const img = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Create an offscreen canvas to store as bitmap
    const osc = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    const octx = osc.getContext('2d');
    octx.putImageData(img, 0, 0);

    // Cache the canvas
    this.cache.set(req.zoom, req.tx, req.ty, req.eraIndex, osc);

    // Trigger redraw
    if (req.onReady) req.onReady();
  }

  // Request a tile — returns cached canvas or dispatches to worker
  requestTile(tx, ty, zoom, eraIndex, theme, onReady) {
    const cached = this.cache.get(zoom, tx, ty, eraIndex);
    if (cached) return cached;

    // Already pending?
    const pendingKey = `${eraIndex}:${zoom}:${tx}:${ty}`;
    for (const [, req] of this.pending) {
      if (`${req.eraIndex}:${req.zoom}:${req.tx}:${req.ty}` === pendingKey) return null;
    }

    const id = this.nextId++;
    this.pending.set(id, { tx, ty, zoom, eraIndex, onReady });
    this.worker.postMessage({ id, tx, ty, zoom, eraIndex, theme });
    return null; // not ready yet
  }

  // Draw all visible tiles onto main canvas
  drawTiles(ctx, viewport, zoom, eraIndex, theme, onReady) {
    const { x: vpX, y: vpY, width, height, scale } = viewport;
    const tileWorldSize = 10000 / Math.pow(2, zoom);

    // Calculate visible tile range
    const startTx = Math.max(0, Math.floor(vpX / tileWorldSize));
    const startTy = Math.max(0, Math.floor(vpY / tileWorldSize));
    const endTx = Math.min(Math.pow(2, zoom) - 1, Math.floor((vpX + width) / tileWorldSize));
    const endTy = Math.min(Math.pow(2, zoom) - 1, Math.floor((vpY + height) / tileWorldSize));

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const tile = this.requestTile(tx, ty, zoom, eraIndex, theme, onReady);
        if (tile) {
          // Convert tile world position to screen position
          const screenX = (tx * tileWorldSize - vpX) * scale;
          const screenY = (ty * tileWorldSize - vpY) * scale;
          const screenSize = tileWorldSize * scale;
          ctx.drawImage(tile, screenX, screenY, screenSize, screenSize);
        }
      }
    }
  }

  destroy() {
    this.worker.terminate();
    this.cache.clear();
  }
}
```

**Step 2: Commit**

```bash
git add src/map/TileManager.js
git commit -m "feat(map): add TileManager with worker dispatch and cache"
```

---

### Task 8: MapViewer Component (Core Canvas + Zoom/Pan)

**Files:**
- Create: `src/map/MapViewer.jsx`

**Step 1: Create MapViewer**

The main React component. Renders a canvas, handles zoom/pan, integrates TileManager.

```jsx
// src/map/MapViewer.jsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TileManager } from './TileManager.js';
import { getEraIndex } from './WorldSeed.js';

const WORLD_SIZE = 10000;
const MIN_ZOOM = 0;
const MAX_ZOOM = 8; // Start with zoom 0-8, extend later

export default function MapViewer({ data, theme, mapZoomTarget }) {
  const canvasRef = useRef(null);
  const tileManagerRef = useRef(null);
  const viewportRef = useRef({
    x: 0, y: 0,       // world coords of viewport top-left
    width: WORLD_SIZE, // world coords visible
    height: WORLD_SIZE,
    scale: 1,          // pixels per world unit
  });
  const zoomRef = useRef(0);
  const draggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);

  const [currentEra, setCurrentEra] = useState(0); // era index
  const eras = data?.eras || [];

  // Initialize TileManager
  useEffect(() => {
    tileManagerRef.current = new TileManager();
    return () => tileManagerRef.current?.destroy();
  }, []);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const tm = tileManagerRef.current;
    if (!canvas || !tm) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const vp = viewportRef.current;

    // Clear
    ctx.fillStyle = theme === 'dark' ? '#05080f' : '#f4ede0';
    ctx.fillRect(0, 0, width, height);

    // Determine appropriate zoom level from scale
    const zoom = zoomRef.current;

    // Draw terrain tiles
    tm.drawTiles(ctx, vp, zoom, currentEra, theme, () => {
      // When a new tile is ready, re-draw
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    });

    // Draw location markers (at appropriate zoom levels)
    if (zoom >= 2 && data?.locations) {
      const locations = data.locations.filter(l => {
        const eraYear = eras[currentEra]?.year ?? 0;
        return l.era_founded <= eraYear && (l.era_destroyed == null || l.era_destroyed > eraYear);
      });
      drawMarkers(ctx, vp, locations, zoom);
    }
  }, [currentEra, theme, data, eras]);

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      updateViewport(rect.width, rect.height);
      draw();
    };

    const updateViewport = (screenW, screenH) => {
      const vp = viewportRef.current;
      vp.scale = screenW / vp.width;
      vp.height = screenH / vp.scale;
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  // Mouse/wheel handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const vp = viewportRef.current;

      // Mouse position in world coords
      const worldMouseX = vp.x + mouseX / vp.scale;
      const worldMouseY = vp.y + mouseY / vp.scale;

      // Zoom step
      const delta = e.deltaY > 0 ? -1 : 1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current + delta));
      if (newZoom === zoomRef.current) return;
      zoomRef.current = newZoom;

      // New world width based on zoom level
      const newWorldWidth = WORLD_SIZE / Math.pow(2, newZoom);
      const scaleRatio = vp.width / newWorldWidth;

      // Keep mouse position fixed
      vp.width = newWorldWidth;
      vp.height = (rect.height / rect.width) * newWorldWidth;
      vp.x = worldMouseX - mouseX / (rect.width / newWorldWidth);
      vp.y = worldMouseY - mouseY / (rect.width / newWorldWidth);
      vp.scale = rect.width / newWorldWidth;

      // Clamp to world bounds
      vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
      vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));

      draw();
    };

    const onMouseDown = (e) => {
      draggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      const vp = viewportRef.current;
      vp.x -= dx / vp.scale;
      vp.y -= dy / vp.scale;
      vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
      vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));

      draw();
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      canvas.style.cursor = 'grab';
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [draw]);

  // Handle mapZoomTarget (fly-to from other pages)
  useEffect(() => {
    if (!mapZoomTarget) return;
    const vp = viewportRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Zoom to level 4 centered on target
    zoomRef.current = 4;
    const newWorldWidth = WORLD_SIZE / Math.pow(2, 4);
    vp.width = newWorldWidth;
    vp.height = (rect.height / rect.width) * newWorldWidth;
    vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, mapZoomTarget.x - vp.width / 2));
    vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, mapZoomTarget.y - vp.height / 2));
    vp.scale = rect.width / newWorldWidth;

    draw();
  }, [mapZoomTarget, draw]);

  // Redraw when era changes
  useEffect(() => { draw(); }, [currentEra, draw]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--bg)' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: 'grab', display: 'block' }}
      />

      {/* Era Slider */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-panel)', backdropFilter: 'blur(12px)',
        borderRadius: 12, padding: '8px 16px',
        border: '1px solid var(--border)',
      }}>
        {eras.map((era, i) => (
          <button
            key={i}
            onClick={() => setCurrentEra(i)}
            style={{
              background: currentEra === i ? era.accent : 'transparent',
              color: currentEra === i ? '#fff' : 'var(--text-dim)',
              border: `1px solid ${currentEra === i ? era.accent : 'var(--border)'}`,
              borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 12,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {era.name}
          </button>
        ))}
      </div>

      {/* Zoom Controls */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {['+', '−'].map((label, i) => (
          <button
            key={label}
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              const vp = viewportRef.current;
              const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current + (i === 0 ? 1 : -1)));
              if (newZoom === zoomRef.current) return;
              const centerX = vp.x + vp.width / 2;
              const centerY = vp.y + vp.height / 2;
              zoomRef.current = newZoom;
              const newWorldWidth = WORLD_SIZE / Math.pow(2, newZoom);
              vp.width = newWorldWidth;
              vp.height = (rect.height / rect.width) * newWorldWidth;
              vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, centerX - vp.width / 2));
              vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, centerY - vp.height / 2));
              vp.scale = rect.width / newWorldWidth;
              draw();
            }}
            style={{
              width: 32, height: 32,
              background: 'var(--bg-panel)', backdropFilter: 'blur(12px)',
              border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--gold)', cursor: 'pointer',
              fontSize: 18, fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Draw location markers on canvas
function drawMarkers(ctx, viewport, locations, zoom) {
  const { x: vpX, y: vpY, scale } = viewport;
  const markerSize = Math.max(4, Math.min(12, 6 * Math.pow(2, zoom - 3)));

  for (const loc of locations) {
    const sx = (loc.x - vpX) * scale;
    const sy = (loc.y - vpY) * scale;

    // Skip if off-screen
    if (sx < -20 || sy < -20 || sx > ctx.canvas.width + 20 || sy > ctx.canvas.height + 20) continue;

    // Only show capitals/sacred at low zoom, everything at high zoom
    if (zoom < 4 && loc.type !== 'capital' && loc.type !== 'sacred') continue;

    // Marker dot
    ctx.beginPath();
    ctx.arc(sx, sy, markerSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#c4a35a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(196, 163, 90, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label (only at zoom >= 3)
    if (zoom >= 3) {
      ctx.font = `${Math.max(10, 12)}px 'EB Garamond', serif`;
      ctx.fillStyle = 'var(--text)' === 'var(--text)' ? '#d4c4a0' : '#4a3518';
      ctx.textAlign = 'center';
      ctx.fillText(loc.name, sx, sy - markerSize / 2 - 4);
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/map/MapViewer.jsx
git commit -m "feat(map): add MapViewer with canvas zoom/pan, era slider, markers"
```

---

### Task 9: Integrate MapViewer into App.jsx

**Files:**
- Modify: `src/App.jsx:5-7` (imports)
- Modify: `src/App.jsx:206-208` (replace FMGEmbed)

**Step 1: Update App.jsx imports**

Replace:
```jsx
import FMGEmbed from './components/FMGEmbed';
```
With:
```jsx
import MapViewer from './map/MapViewer';
```

**Step 2: Replace FMGEmbed usage**

Replace line 207:
```jsx
<FMGEmbed theme={theme} mapZoomTarget={mapZoomTarget} onNavigate={setActiveTab} />
```
With:
```jsx
<MapViewer data={data} theme={theme} mapZoomTarget={mapZoomTarget} />
```

**Step 3: Verify the app loads and map is visible**

Run `npm run dev:app` (not `npm run dev` — skip FMG for now).
Navigate to the map tab. You should see:
- Procedurally generated terrain (land and ocean)
- Era buttons at the bottom — clicking changes the terrain slightly
- Zoom with scroll wheel, pan with drag
- Location markers with names at zoom >= 3

**Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(map): integrate MapViewer, replace FMGEmbed"
```

---

### Task 10: Clean Up FMG References

**Files:**
- Modify: `src/App.jsx` — remove FMGEmbed import if not already
- Modify: `vite.config.js:91-97` — remove FMG proxy
- Modify: `package.json:2` — simplify dev script

**Step 1: Remove FMG proxy from vite.config.js**

Remove lines 91-97:
```js
  server: {
    proxy: {
      '/fmg': {
        target: 'http://localhost:5174',
        rewrite: (path) => path.replace(/^\/fmg/, ''),
      },
    },
  },
```

Replace with:
```js
  server: {},
```

**Step 2: Simplify package.json scripts**

Replace:
```json
"dev": "concurrently \"vite\" \"cd fmg && npm run dev\"",
```
With:
```json
"dev": "vite",
```

Also update build script — replace:
```json
"build": "vite build && cd fmg && npm run build && cp -r dist ../dist/fmg",
```
With:
```json
"build": "vite build",
```

Remove dev:app and dev:fmg scripts (no longer needed).

**Step 3: Verify dev server starts clean**

Run `npm run dev`. The app should start without errors on port 5173. Map tab should work.

**Step 4: Commit**

```bash
git add vite.config.js package.json src/App.jsx
git commit -m "refactor: remove FMG iframe, simplify build scripts"
```

---

## Phase 2: Region Detail & Overlays

### Task 11: Territory Layer Overlay

**Files:**
- Create: `src/map/layers/TerritoryLayer.js`
- Modify: `src/map/MapViewer.jsx` — add territory rendering

**Step 1: Create TerritoryLayer**

```js
// src/map/layers/TerritoryLayer.js

export function drawTerritories(ctx, viewport, territories, eras, currentEraIndex) {
  const eraYear = eras[currentEraIndex]?.year ?? 0;
  const { x: vpX, y: vpY, scale } = viewport;

  const visible = territories.filter(t =>
    t.era_start <= eraYear && (t.era_end == null || t.era_end > eraYear)
  );

  for (const ter of visible) {
    if (!ter.pts || ter.pts.length < 3) continue;

    ctx.beginPath();
    const pts = ter.pts;
    ctx.moveTo((pts[0][0] - vpX) * scale, (pts[0][1] - vpY) * scale);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo((pts[i][0] - vpX) * scale, (pts[i][1] - vpY) * scale);
    }
    ctx.closePath();

    // Fill with transparent territory color
    const r = parseInt(ter.color.slice(1, 3), 16);
    const g = parseInt(ter.color.slice(3, 5), 16);
    const b = parseInt(ter.color.slice(5, 7), 16);
    ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
    ctx.fill();

    // Border
    ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Territory name label at center
    if (scale > 0.04) {
      ctx.font = `600 ${Math.max(11, 14 * Math.min(scale * 100, 1))}px 'EB Garamond', serif`;
      ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
      ctx.textAlign = 'center';
      const cx = (ter.cx - vpX) * scale;
      const cy = (ter.cy - vpY) * scale;
      ctx.fillText(ter.name, cx, cy);
      // Han characters below
      ctx.font = `${Math.max(9, 11 * Math.min(scale * 100, 1))}px 'Noto Serif TC', serif`;
      ctx.fillStyle = `rgba(${r},${g},${b},0.4)`;
      ctx.fillText(ter.han, cx, cy + 16);
    }
  }
}
```

**Step 2: Integrate into MapViewer.jsx**

In the `draw` function, after `tm.drawTiles(...)` and before `drawMarkers(...)`, add:

```jsx
import { drawTerritories } from './layers/TerritoryLayer.js';

// Inside draw():
if (data?.territories) {
  drawTerritories(ctx, vp, data.territories, eras, currentEra);
}
```

**Step 3: Commit**

```bash
git add src/map/layers/TerritoryLayer.js src/map/MapViewer.jsx
git commit -m "feat(map): add territory overlay with era filtering"
```

---

### Task 12: River Rendering

**Files:**
- Create: `src/map/layers/RiverLayer.js`
- Modify: `src/map/MapViewer.jsx` — add river rendering

**Step 1: Create RiverLayer**

```js
// src/map/layers/RiverLayer.js

export function drawRivers(ctx, viewport, rivers, zoom) {
  if (zoom < 2) return; // too zoomed out to show rivers
  const { x: vpX, y: vpY, scale } = viewport;

  for (const river of rivers) {
    if (!river.pts || river.pts.length < 2) continue;

    const width = river.rank === 1 ? 2.5 : 1.5;
    const alpha = river.rank === 1 ? 0.7 : 0.5;

    ctx.beginPath();
    const pts = river.pts;
    // Smooth curve through points
    ctx.moveTo((pts[0][0] - vpX) * scale, (pts[0][1] - vpY) * scale);
    for (let i = 1; i < pts.length - 1; i++) {
      const cx = ((pts[i][0] + pts[i + 1][0]) / 2 - vpX) * scale;
      const cy = ((pts[i][1] + pts[i + 1][1]) / 2 - vpY) * scale;
      ctx.quadraticCurveTo(
        (pts[i][0] - vpX) * scale,
        (pts[i][1] - vpY) * scale,
        cx, cy
      );
    }
    // Last point
    const last = pts[pts.length - 1];
    ctx.lineTo((last[0] - vpX) * scale, (last[1] - vpY) * scale);

    ctx.strokeStyle = `rgba(60, 120, 180, ${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}
```

**Step 2: Integrate into MapViewer.jsx draw()**

After territory drawing, add:
```jsx
import { drawRivers } from './layers/RiverLayer.js';

// Inside draw():
if (data?.rivers) {
  drawRivers(ctx, vp, data.rivers, zoom);
}
```

**Step 3: Commit**

```bash
git add src/map/layers/RiverLayer.js src/map/MapViewer.jsx
git commit -m "feat(map): add river rendering with smooth curves"
```

---

### Task 13: Ley Line Rendering

**Files:**
- Create: `src/map/layers/LeyLineLayer.js`
- Modify: `src/map/MapViewer.jsx` — add ley line rendering

**Step 1: Create LeyLineLayer**

```js
// src/map/layers/LeyLineLayer.js

export function drawLeyLines(ctx, viewport, leyLines, zoom, time) {
  if (zoom < 1) return;
  const { x: vpX, y: vpY, scale } = viewport;

  for (const line of leyLines) {
    if (!line.pts || line.pts.length < 2) continue;

    const pts = line.pts;

    // Animated glow effect
    const phase = (time / (line.dur * 1000)) % 1;

    // Draw the ley line as a glowing path
    ctx.beginPath();
    ctx.moveTo((pts[0][0] - vpX) * scale, (pts[0][1] - vpY) * scale);
    for (let i = 1; i < pts.length - 1; i++) {
      const cx = ((pts[i][0] + pts[i + 1][0]) / 2 - vpX) * scale;
      const cy = ((pts[i][1] + pts[i + 1][1]) / 2 - vpY) * scale;
      ctx.quadraticCurveTo(
        (pts[i][0] - vpX) * scale, (pts[i][1] - vpY) * scale,
        cx, cy
      );
    }
    const last = pts[pts.length - 1];
    ctx.lineTo((last[0] - vpX) * scale, (last[1] - vpY) * scale);

    // Outer glow
    ctx.strokeStyle = line.color + '30'; // 30 = ~19% alpha
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Inner glow
    ctx.strokeStyle = line.color + '80';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
```

**Step 2: Integrate and add animation loop**

In MapViewer.jsx, add a `requestAnimationFrame` loop for animated layers:

```jsx
import { drawLeyLines } from './layers/LeyLineLayer.js';

// Inside draw(), add time parameter and call:
if (data?.leyLines) {
  drawLeyLines(ctx, vp, data.leyLines, zoom, performance.now());
}

// Add animation loop in useEffect:
useEffect(() => {
  let running = true;
  const animate = () => {
    if (!running) return;
    draw();
    rafRef.current = requestAnimationFrame(animate);
  };
  // Only animate if ley lines exist
  if (data?.leyLines?.length) animate();
  return () => { running = false; };
}, [draw, data?.leyLines]);
```

**Step 3: Commit**

```bash
git add src/map/layers/LeyLineLayer.js src/map/MapViewer.jsx
git commit -m "feat(map): add animated ley line rendering"
```

---

### Task 14: Touch Support (Mobile)

**Files:**
- Modify: `src/map/MapViewer.jsx` — add touch event handlers

**Step 1: Add touch events alongside mouse events**

In the mouse/wheel useEffect, add touch handlers:

```jsx
// Touch state
let touchStartDist = 0;
let touchStartZoom = 0;
let lastTouchCenter = null;

const onTouchStart = (e) => {
  if (e.touches.length === 1) {
    draggingRef.current = true;
    lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  } else if (e.touches.length === 2) {
    // Pinch start
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    touchStartDist = Math.sqrt(dx * dx + dy * dy);
    touchStartZoom = zoomRef.current;
    lastTouchCenter = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    };
  }
};

const onTouchMove = (e) => {
  e.preventDefault();
  if (e.touches.length === 1 && draggingRef.current) {
    const dx = e.touches[0].clientX - lastMouseRef.current.x;
    const dy = e.touches[0].clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const vp = viewportRef.current;
    vp.x -= dx / vp.scale;
    vp.y -= dy / vp.scale;
    vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
    vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));
    draw();
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const zoomDelta = Math.log2(dist / touchStartDist);
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(touchStartZoom + zoomDelta)));
    if (newZoom !== zoomRef.current) {
      zoomRef.current = newZoom;
      const rect = canvas.getBoundingClientRect();
      const vp = viewportRef.current;
      const centerX = vp.x + vp.width / 2;
      const centerY = vp.y + vp.height / 2;
      const newWorldWidth = WORLD_SIZE / Math.pow(2, newZoom);
      vp.width = newWorldWidth;
      vp.height = (rect.height / rect.width) * newWorldWidth;
      vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, centerX - vp.width / 2));
      vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, centerY - vp.height / 2));
      vp.scale = rect.width / newWorldWidth;
      draw();
    }
  }
};

const onTouchEnd = () => { draggingRef.current = false; };

canvas.addEventListener('touchstart', onTouchStart, { passive: false });
canvas.addEventListener('touchmove', onTouchMove, { passive: false });
canvas.addEventListener('touchend', onTouchEnd);

// Cleanup:
canvas.removeEventListener('touchstart', onTouchStart);
canvas.removeEventListener('touchmove', onTouchMove);
canvas.removeEventListener('touchend', onTouchEnd);
```

**Step 2: Commit**

```bash
git add src/map/MapViewer.jsx
git commit -m "feat(map): add mobile touch support for pan and pinch-zoom"
```

---

## Phase 3: Verification & Testing

### Task 15: Manual Verification

**Step 1: Run the app**

```bash
cd "/Users/sampi_wu/Downloads/Claude Code" && npm run dev
```

**Step 2: Verify checklist**

Open http://localhost:5173 and check:
- [ ] Map tab loads without errors
- [ ] Terrain is visible (land + ocean)
- [ ] Mouse scroll zooms in/out (zoom 0-8)
- [ ] Mouse drag pans
- [ ] Era buttons at bottom change terrain slightly
- [ ] Location markers appear at zoom >= 2
- [ ] Location names appear at zoom >= 3
- [ ] Territory borders/names visible
- [ ] Rivers drawn on the map
- [ ] Ley lines drawn with glow
- [ ] Other pages still work (home, characters, etc.)
- [ ] navigateToMap from other pages zooms to correct location
- [ ] No console errors

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(map): complete Phase 1-2 tile-based procedural map"
```

---

## Future Phases (Not in this plan)

These are documented for future implementation:

### Phase 3: City Generation (zoom 8-11)
- `src/map/generators/CityGenerator.js` — procedural city layouts (grid for Nhân Tộc, organic for Yêu Tộc)
- City walls, districts, main roads
- Building density based on population data

### Phase 4: Street Detail (zoom 12-15)
- `src/map/generators/DetailGenerator.js` — individual buildings, market stalls
- Race-specific architecture styles
- NPC/activity markers

### Phase 5: Polish
- Era crossfade animation (blend between two eras)
- Mini-map widget
- Search bar for locations
- Smooth fly-to animation
- Map legend / layer toggle panel
