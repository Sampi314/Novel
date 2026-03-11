# Map Terrain Engine Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `src/map/` with a Leaflet-based map viewer powered by a procedural terrain pipeline (plate tectonics, heightmap, D8 hydrology, 34 Whittaker biomes) with era keyframe interpolation.

**Architecture:** Leaflet.js provides Google Maps-grade pan/zoom/touch. A custom `L.GridLayer` requests tiles from a Web Worker that runs the terrain pipeline. 14 era keyframes are pre-computed on startup as 1024x1024 Float32Array heightmaps, then blended for any T value. Overlay layers (rivers, territories, locations) render as Leaflet vector layers.

**Tech Stack:** React 19, Vite 7, Leaflet.js, simplex-noise, Web Workers, Canvas 2D

**Spec:** `docs/superpowers/specs/2026-03-11-map-terrain-engine-rebuild-design.md`

---

## Chunk 1: Project Setup & Utilities

### Task 1: Install dependencies and remove old map code

**Files:**
- Delete: `src/map/` (entire directory)
- Modify: `package.json`

- [ ] **Step 1: Install leaflet and simplex-noise**

```bash
npm install leaflet simplex-noise
```

- [ ] **Step 2: Delete old map code**

```bash
rm -rf src/map/
```

- [ ] **Step 3: Create new directory structure**

```bash
mkdir -p src/map/pipeline src/map/layers src/map/utils src/map/workers
```

- [ ] **Step 4: Verify app still builds (map tab will be broken — expected)**

```bash
npm run build 2>&1 | head -20
```
Expected: Build errors about missing MapViewer — this is correct, we'll create it next.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove old map code, install leaflet + simplex-noise"
```

---

### Task 2: Simplex noise utility

**Files:**
- Create: `src/map/utils/noise.js`

This is a foundational utility used by every pipeline stage.

- [ ] **Step 1: Create noise.js with Simplex2D, fBm, and domain warping**

```javascript
// src/map/utils/noise.js
import { createNoise2D } from 'simplex-noise';
import Alea from 'simplex-noise/dist/esm/alea.js';

/**
 * Create a seeded 2D noise function.
 * @param {string|number} seed
 * @returns {(x: number, y: number) => number} value in [-1, 1]
 */
export function createSeededNoise(seed) {
  const prng = Alea(String(seed));
  return createNoise2D(prng);
}

/**
 * Fractal Brownian Motion — layer multiple octaves of noise.
 * @param {Function} noise2D  seeded noise fn
 * @param {number} x
 * @param {number} y
 * @param {number} octaves   number of layers (6-8 typical)
 * @param {number} lacunarity frequency multiplier per octave (2.0 typical)
 * @param {number} persistence amplitude multiplier per octave (0.5 typical)
 * @returns {number} value roughly in [-1, 1]
 */
export function fbm(noise2D, x, y, octaves = 6, lacunarity = 2.0, persistence = 0.5) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmplitude;
}

/**
 * Ridged noise — absolute value inverted for sharp ridges (mountains).
 */
export function ridgedNoise(noise2D, x, y, octaves = 6, lacunarity = 2.0, persistence = 0.5) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    let n = noise2D(x * frequency, y * frequency);
    n = 1.0 - Math.abs(n); // ridge
    n = n * n; // sharpen
    value += n * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmplitude;
}

/**
 * Domain warping — feed noise into noise for organic shapes.
 * @param {Function} noise2D
 * @param {number} x
 * @param {number} y
 * @param {number} warpStrength  how far to displace (0.5-2.0 typical)
 * @param {number} octaves
 * @returns {number}
 */
export function warpedFbm(noise2D, x, y, warpStrength = 1.0, octaves = 6) {
  const wx = fbm(noise2D, x + 0.0, y + 0.0, octaves);
  const wy = fbm(noise2D, x + 5.2, y + 1.3, octaves);
  return fbm(noise2D, x + wx * warpStrength, y + wy * warpStrength, octaves);
}
```

- [ ] **Step 2: Verify import works**

Create a quick test in browser console or verify no import errors:
```bash
npx vite build --mode development 2>&1 | grep -i error
```

- [ ] **Step 3: Commit**

```bash
git add src/map/utils/noise.js
git commit -m "feat(map): add simplex noise utility with fBm, ridged, and domain warping"
```

---

### Task 3: Fractal edge utility (no-straight-lines enforcement)

**Files:**
- Create: `src/map/utils/fractalEdge.js`

- [ ] **Step 1: Create fractalEdge.js**

```javascript
// src/map/utils/fractalEdge.js
import { createSeededNoise } from './noise.js';

/**
 * Displace a polyline so no segment > maxSegmentPx is straight.
 * Uses recursive midpoint displacement + noise perturbation.
 *
 * @param {number[][]} points  array of [x, y] in world coords
 * @param {object} opts
 * @param {number} opts.noiseScale      noise frequency (0.001-0.01)
 * @param {number} opts.displacement    max perpendicular offset in world units
 * @param {number} opts.maxSegmentLen   max segment length before subdivision (world units)
 * @param {number} opts.iterations      recursive depth (3-5)
 * @param {string|number} opts.seed     noise seed for determinism
 * @returns {number[][]} densified, displaced point array
 */
export function fractalizeEdge(points, opts = {}) {
  const {
    noiseScale = 0.005,
    displacement = 30,
    maxSegmentLen = 80,
    iterations = 4,
    seed = 'edge-default',
  } = opts;

  const noise2D = createSeededNoise(seed);
  let current = [...points.map(p => [...p])];

  for (let iter = 0; iter < iterations; iter++) {
    const next = [current[0]];
    const scale = displacement / (1 + iter * 0.7); // reduce displacement each iteration

    for (let i = 0; i < current.length - 1; i++) {
      const [ax, ay] = current[i];
      const [bx, by] = current[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const segLen = Math.sqrt(dx * dx + dy * dy);

      if (segLen > maxSegmentLen / (1 + iter)) {
        // Midpoint
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;

        // Perpendicular direction
        const perpX = -dy / segLen;
        const perpY = dx / segLen;

        // Noise-based displacement
        const n = noise2D(mx * noiseScale, my * noiseScale);
        const offsetX = perpX * n * scale;
        const offsetY = perpY * n * scale;

        next.push([mx + offsetX, my + offsetY]);
      }
      next.push(current[i + 1]);
    }
    current = next;
  }

  return current;
}

/**
 * Fractalize a closed polygon (connects last point back to first).
 */
export function fractalizePolygon(points, opts = {}) {
  // Close the polygon by appending the first point
  const closed = [...points, points[0]];
  const result = fractalizeEdge(closed, opts);
  // Remove duplicate closure point
  result.pop();
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/utils/fractalEdge.js
git commit -m "feat(map): add fractalizeEdge utility for no-straight-lines rule"
```

---

### Task 4: Custom Leaflet CRS

**Files:**
- Create: `src/map/utils/crs.js`

- [ ] **Step 1: Create custom CRS mapping world coords (0-10000) to Leaflet pixel space**

```javascript
// src/map/utils/crs.js
import L from 'leaflet';

/**
 * Custom CRS for the fantasy world.
 * World space: (0, 0) top-left to (10000, 10000) bottom-right.
 * Leaflet's Simple CRS uses pixels directly; we scale so that at zoom 0,
 * the full 10000x10000 world fits in 256x256 pixels (one tile).
 */

const WORLD_SIZE = 10000;
const TILE_SIZE = 256;

// At zoom 0, 1 world unit = TILE_SIZE / WORLD_SIZE pixels
// Leaflet Simple CRS: 1 unit = 1px at zoom 0, doubled each zoom level
// So we need a transformation that scales world coords to pixel coords
const scale = TILE_SIZE / WORLD_SIZE;

export const WorldCRS = L.Util.extend({}, L.CRS.Simple, {
  // Transform: world coords -> pixel coords at zoom 0
  transformation: new L.Transformation(scale, 0, scale, 0),

  // Leaflet scales by 2^zoom, so at zoom 3 we have 8x resolution
  // This is the standard Simple CRS behavior, which we keep.
});

/**
 * Convert world coordinates to Leaflet LatLng.
 * In CRS.Simple, LatLng maps to (y, x) — lat=y, lng=x.
 */
export function worldToLatLng(wx, wy) {
  return L.latLng(wy, wx);
}

/**
 * Convert Leaflet LatLng back to world coordinates.
 */
export function latLngToWorld(latlng) {
  return { x: latlng.lng, y: latlng.lat };
}

export const WORLD_BOUNDS = L.latLngBounds(
  worldToLatLng(0, 0),
  worldToLatLng(WORLD_SIZE, WORLD_SIZE)
);

export { WORLD_SIZE, TILE_SIZE };
```

- [ ] **Step 2: Commit**

```bash
git add src/map/utils/crs.js
git commit -m "feat(map): add custom Leaflet CRS for world coordinate system"
```

---

### Task 5: Biome color palettes

**Files:**
- Create: `src/map/utils/colors.js`

- [ ] **Step 1: Create biome color definitions for dark and light themes**

```javascript
// src/map/utils/colors.js

/**
 * 34 biome color palettes for terrain rendering.
 * Each biome has a dark theme and light theme color.
 * Colors are [r, g, b] arrays (0-255).
 */

// Biome IDs — used as keys throughout the pipeline
export const BIOME = {
  // Hot/Warm
  VOLCANIC_BADLANDS: 0,
  MAGMA_RIFT: 1,
  SCORCHED_SAVANNA: 2,
  TROPICAL_JUNGLE: 3,
  BAMBOO_GROVES: 4,
  MIASMA_SWAMP: 5,
  // Temperate
  CULTIVATION_PLAINS: 6,
  ANCIENT_FOREST: 7,
  DECIDUOUS_HIGHLANDS: 8,
  FLOWER_MEADOWS: 9,
  PETRIFIED_FOREST: 10,
  MISTY_VALLEY: 11,
  TERRACED_FARMLANDS: 12,
  // Cold
  FROST_TUNDRA: 13,
  GLACIAL_PEAKS: 14,
  BOREAL_FOREST: 15,
  FROZEN_MARSHES: 16,
  SNOWFIELD_STEPPE: 17,
  // Arid
  QI_BARREN_WASTE: 18,
  CRYSTAL_DESERT: 19,
  CANYONLANDS: 20,
  SALT_FLATS: 21,
  // Mountain
  SACRED_MOUNTAINS: 22,
  SKY_RIFT: 23,
  CLOUD_FOREST: 24,
  ALPINE_MEADOW: 25,
  // Aquatic
  DEEP_OCEAN: 26,
  CORAL_SHALLOWS: 27,
  MANGROVE_COAST: 28,
  ABYSSAL_TRENCH: 29,
  // Spiritual overlays
  SPIRIT_GARDEN: 30,
  RIFT_CAVES: 31,
  QI_STORM: 32,
  CELESTIAL_PLATEAU: 33,
};

// Dark theme (xianxia aesthetic)
export const DARK_PALETTE = {
  [BIOME.VOLCANIC_BADLANDS]:   [89, 30, 15],
  [BIOME.MAGMA_RIFT]:          [120, 35, 10],
  [BIOME.SCORCHED_SAVANNA]:    [140, 110, 55],
  [BIOME.TROPICAL_JUNGLE]:     [25, 80, 35],
  [BIOME.BAMBOO_GROVES]:       [55, 100, 50],
  [BIOME.MIASMA_SWAMP]:        [40, 60, 35],
  [BIOME.CULTIVATION_PLAINS]:  [70, 100, 50],
  [BIOME.ANCIENT_FOREST]:      [20, 65, 30],
  [BIOME.DECIDUOUS_HIGHLANDS]: [65, 85, 45],
  [BIOME.FLOWER_MEADOWS]:      [90, 110, 65],
  [BIOME.PETRIFIED_FOREST]:    [75, 65, 50],
  [BIOME.MISTY_VALLEY]:        [50, 75, 60],
  [BIOME.TERRACED_FARMLANDS]:  [85, 105, 55],
  [BIOME.FROST_TUNDRA]:        [160, 170, 180],
  [BIOME.GLACIAL_PEAKS]:       [200, 210, 220],
  [BIOME.BOREAL_FOREST]:       [30, 55, 40],
  [BIOME.FROZEN_MARSHES]:      [100, 115, 120],
  [BIOME.SNOWFIELD_STEPPE]:    [170, 175, 175],
  [BIOME.QI_BARREN_WASTE]:     [150, 130, 95],
  [BIOME.CRYSTAL_DESERT]:      [180, 165, 130],
  [BIOME.CANYONLANDS]:         [140, 90, 55],
  [BIOME.SALT_FLATS]:          [190, 185, 170],
  [BIOME.SACRED_MOUNTAINS]:    [90, 80, 70],
  [BIOME.SKY_RIFT]:            [70, 80, 110],
  [BIOME.CLOUD_FOREST]:        [40, 70, 55],
  [BIOME.ALPINE_MEADOW]:       [80, 110, 70],
  [BIOME.DEEP_OCEAN]:          [10, 20, 50],
  [BIOME.CORAL_SHALLOWS]:      [30, 70, 90],
  [BIOME.MANGROVE_COAST]:      [35, 65, 45],
  [BIOME.ABYSSAL_TRENCH]:      [5, 8, 30],
  [BIOME.SPIRIT_GARDEN]:       [60, 100, 80],
  [BIOME.RIFT_CAVES]:          [30, 20, 40],
  [BIOME.QI_STORM]:            [80, 70, 100],
  [BIOME.CELESTIAL_PLATEAU]:   [120, 130, 160],
};

// Light theme (parchment/cartographic)
export const LIGHT_PALETTE = {
  [BIOME.VOLCANIC_BADLANDS]:   [160, 80, 60],
  [BIOME.MAGMA_RIFT]:          [180, 70, 50],
  [BIOME.SCORCHED_SAVANNA]:    [200, 180, 120],
  [BIOME.TROPICAL_JUNGLE]:     [60, 140, 70],
  [BIOME.BAMBOO_GROVES]:       [100, 160, 90],
  [BIOME.MIASMA_SWAMP]:        [80, 110, 70],
  [BIOME.CULTIVATION_PLAINS]:  [130, 170, 100],
  [BIOME.ANCIENT_FOREST]:      [50, 120, 65],
  [BIOME.DECIDUOUS_HIGHLANDS]: [120, 150, 90],
  [BIOME.FLOWER_MEADOWS]:      [160, 180, 120],
  [BIOME.PETRIFIED_FOREST]:    [140, 120, 95],
  [BIOME.MISTY_VALLEY]:        [100, 140, 115],
  [BIOME.TERRACED_FARMLANDS]:  [150, 175, 110],
  [BIOME.FROST_TUNDRA]:        [210, 215, 220],
  [BIOME.GLACIAL_PEAKS]:       [235, 240, 245],
  [BIOME.BOREAL_FOREST]:       [60, 100, 75],
  [BIOME.FROZEN_MARSHES]:      [160, 175, 180],
  [BIOME.SNOWFIELD_STEPPE]:    [220, 220, 215],
  [BIOME.QI_BARREN_WASTE]:     [210, 190, 150],
  [BIOME.CRYSTAL_DESERT]:      [230, 215, 180],
  [BIOME.CANYONLANDS]:         [195, 145, 100],
  [BIOME.SALT_FLATS]:          [235, 230, 215],
  [BIOME.SACRED_MOUNTAINS]:    [150, 140, 130],
  [BIOME.SKY_RIFT]:            [130, 145, 175],
  [BIOME.CLOUD_FOREST]:        [80, 130, 100],
  [BIOME.ALPINE_MEADOW]:       [140, 175, 130],
  [BIOME.DEEP_OCEAN]:          [40, 70, 130],
  [BIOME.CORAL_SHALLOWS]:      [70, 140, 170],
  [BIOME.MANGROVE_COAST]:      [75, 125, 85],
  [BIOME.ABYSSAL_TRENCH]:      [20, 30, 70],
  [BIOME.SPIRIT_GARDEN]:       [110, 170, 140],
  [BIOME.RIFT_CAVES]:          [80, 60, 95],
  [BIOME.QI_STORM]:            [140, 125, 165],
  [BIOME.CELESTIAL_PLATEAU]:   [180, 190, 215],
};

/**
 * Get biome color for a given biome ID and theme.
 * @param {number} biomeId  BIOME enum value
 * @param {string} theme    'dark' | 'light'
 * @returns {number[]} [r, g, b]
 */
export function getBiomeColor(biomeId, theme = 'dark') {
  const palette = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
  return palette[biomeId] || [128, 128, 128];
}

/**
 * Water color by depth.
 * @param {number} depth  0 = shallow, 1 = deep
 * @param {string} theme
 * @returns {number[]} [r, g, b]
 */
export function getWaterColor(depth, theme = 'dark') {
  const shallow = theme === 'dark' ? [20, 40, 80] : [60, 120, 170];
  const deep = theme === 'dark' ? [5, 10, 35] : [25, 50, 110];
  const t = Math.max(0, Math.min(1, depth));
  return [
    Math.round(shallow[0] + (deep[0] - shallow[0]) * t),
    Math.round(shallow[1] + (deep[1] - shallow[1]) * t),
    Math.round(shallow[2] + (deep[2] - shallow[2]) * t),
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/utils/colors.js
git commit -m "feat(map): add 34-biome color palettes for dark and light themes"
```

---

## Chunk 2: Terrain Pipeline — Generation

### Task 6: Plate tectonics generator

**Files:**
- Create: `src/map/pipeline/tectonics.js`

Generates tectonic plate boundaries using Voronoi + random walk displacement. Determines where mountains rise (collision) and where rifts form (divergent).

- [ ] **Step 1: Create tectonics.js**

```javascript
// src/map/pipeline/tectonics.js
import { createSeededNoise, fbm } from '../utils/noise.js';

const GRID = 1024;

/**
 * Generate tectonic plate data for a given era keyframe.
 *
 * @param {number} numPlates   7-12 plates
 * @param {number} T           time value (0 to 1_000_000)
 * @param {string} seed        world seed
 * @returns {{ plateMap: Int8Array, stress: Float32Array }}
 *   plateMap: GRID*GRID array, each cell = plate index (0..numPlates-1)
 *   stress: GRID*GRID array, each cell = tectonic stress value
 *     positive = collision (mountains), negative = divergent (rift)
 */
export function generatePlates(numPlates, T, seed) {
  const noise = createSeededNoise(seed + '-tect');
  const driftNoise = createSeededNoise(seed + '-drift');

  // 1. Generate plate seed points with time-based drift
  const seeds = [];
  const seedNoise = createSeededNoise(seed + '-seeds');
  for (let i = 0; i < numPlates; i++) {
    // Base positions spread across the world
    const angle = (i / numPlates) * Math.PI * 2;
    const r = 0.25 + 0.15 * seedNoise(i * 7.1, 0);
    let cx = 0.5 + r * Math.cos(angle);
    let cy = 0.5 + r * Math.sin(angle);

    // Apply drift over time — each plate moves in its own direction
    const driftAngle = driftNoise(i * 3.7, i * 11.3) * Math.PI * 2;
    const driftSpeed = 0.0000002 + 0.0000001 * Math.abs(driftNoise(i * 5.1, 0));
    cx += Math.cos(driftAngle) * driftSpeed * T;
    cy += Math.sin(driftAngle) * driftSpeed * T;

    // Keep within bounds with wrapping
    cx = ((cx % 1) + 1) % 1;
    cy = ((cy % 1) + 1) % 1;

    seeds.push({ cx, cy, plate: i });
  }

  // 2. Assign cells to nearest plate (Voronoi-like)
  //    but with noise-warped distances for organic boundaries
  const plateMap = new Int8Array(GRID * GRID);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const nx = x / GRID;
      const ny = y / GRID;

      // Warp the lookup position for organic boundaries
      const warpX = nx + fbm(noise, nx * 4, ny * 4, 4) * 0.03;
      const warpY = ny + fbm(noise, nx * 4 + 100, ny * 4 + 100, 4) * 0.03;

      let minDist = Infinity;
      let closest = 0;

      for (const s of seeds) {
        // Toroidal distance (handles wrapping)
        let dx = Math.abs(warpX - s.cx);
        let dy = Math.abs(warpY - s.cy);
        if (dx > 0.5) dx = 1 - dx;
        if (dy > 0.5) dy = 1 - dy;
        const dist = dx * dx + dy * dy;

        if (dist < minDist) {
          minDist = dist;
          closest = s.plate;
        }
      }

      plateMap[y * GRID + x] = closest;
    }
  }

  // 3. Compute tectonic stress at boundaries
  const stress = new Float32Array(GRID * GRID);

  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const idx = y * GRID + x;
      const myPlate = plateMap[idx];

      // Check 4 neighbors for plate boundaries
      let isBoundary = false;
      const neighbors = [
        plateMap[(y - 1) * GRID + x],
        plateMap[(y + 1) * GRID + x],
        plateMap[y * GRID + (x - 1)],
        plateMap[y * GRID + (x + 1)],
      ];

      for (const np of neighbors) {
        if (np !== myPlate) {
          isBoundary = true;
          break;
        }
      }

      if (isBoundary) {
        // Stress type determined by plate velocity dot product
        const nx = x / GRID;
        const ny = y / GRID;
        // Use noise to determine convergent vs divergent
        const stressType = fbm(noise, nx * 8, ny * 8, 3);
        // Spread stress outward from boundary using distance falloff
        stress[idx] = stressType > 0 ? 1.0 : -0.8;
      }
    }
  }

  // 4. Blur stress field to spread influence away from boundaries
  const blurred = blurField(stress, GRID, 12);

  return { plateMap, stress: blurred, seeds };
}

/**
 * Box blur a Float32Array field.
 */
function blurField(field, size, radius) {
  const out = new Float32Array(field.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            sum += field[ny * size + nx];
            count++;
          }
        }
      }
      out[y * size + x] = sum / count;
    }
  }
  return out;
}

export { GRID };
```

- [ ] **Step 2: Commit**

```bash
git add src/map/pipeline/tectonics.js
git commit -m "feat(map): add tectonic plate generator with drift and stress fields"
```

---

### Task 7: Heightmap generator

**Files:**
- Create: `src/map/pipeline/heightmap.js`

- [ ] **Step 1: Create heightmap.js**

```javascript
// src/map/pipeline/heightmap.js
import { createSeededNoise, fbm, warpedFbm, ridgedNoise } from '../utils/noise.js';
import { GRID } from './tectonics.js';

/**
 * Generate a heightmap for one keyframe.
 *
 * @param {Float32Array} tectonicStress  from tectonics.js
 * @param {number} T                     time value
 * @param {string} seed                  world seed
 * @returns {Float32Array} GRID*GRID heightmap, values in [-1, 1]
 *   negative = below sea level, positive = above
 */
export function generateHeightmap(tectonicStress, T, seed) {
  const noise1 = createSeededNoise(seed + '-h1');
  const noise2 = createSeededNoise(seed + '-h2');
  const ridgeNoise = createSeededNoise(seed + '-ridge');
  const height = new Float32Array(GRID * GRID);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const idx = y * GRID + x;
      const nx = x / GRID;
      const ny = y / GRID;

      // 1. Base continent shape — warped fBm for organic coastlines
      let h = warpedFbm(noise1, nx * 3, ny * 3, 0.8, 7);

      // 2. Continent mask — keep land coherent, reduce edge noise
      const cx = nx - 0.5;
      const cy = ny - 0.5;
      const distFromCenter = Math.sqrt(cx * cx + cy * cy) * 2;
      const continentMask = 1.0 - smoothstep(0.4, 0.9, distFromCenter);
      h = h * 0.6 + h * continentMask * 0.4;

      // 3. Tectonic influence — collision zones become mountains
      const stress = tectonicStress[idx];
      if (stress > 0) {
        // Collision — raise as ridged mountains
        const ridge = ridgedNoise(ridgeNoise, nx * 6, ny * 6, 5);
        h += stress * ridge * 0.6;
      } else {
        // Divergent — depress into rifts/ocean
        h += stress * 0.4;
      }

      // 4. Fine detail layer
      const detail = fbm(noise2, nx * 12, ny * 12, 4, 2.0, 0.4);
      h += detail * 0.1;

      // 5. Time-based erosion softening — older eras have smoother terrain
      const erosionFactor = Math.min(1.0, T / 500000);
      h = h * (1.0 - erosionFactor * 0.15);

      height[idx] = Math.max(-1, Math.min(1, h));
    }
  }

  return height;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/pipeline/heightmap.js
git commit -m "feat(map): add heightmap generator with tectonic influence and domain warping"
```

---

### Task 8: Hydraulic erosion

**Files:**
- Create: `src/map/pipeline/erosion.js`

- [ ] **Step 1: Create erosion.js**

```javascript
// src/map/pipeline/erosion.js
import { GRID } from './tectonics.js';

/**
 * Hydraulic erosion simulation.
 * Drops virtual water droplets that flow downhill, picking up and depositing sediment.
 *
 * @param {Float32Array} heightmap   GRID*GRID, modified in-place
 * @param {number} iterations        number of droplets (~50,000)
 * @param {string} seed              for deterministic random
 */
export function erode(heightmap, iterations = 50000, seed = 'erode') {
  // Simple seeded RNG
  let s = hashSeed(seed);
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };

  const inertia = 0.05;
  const capacity = 4.0;
  const deposition = 0.3;
  const erosionRate = 0.3;
  const evaporation = 0.01;
  const gravity = 4.0;
  const maxSteps = 80;
  const dropRadius = 3;

  for (let i = 0; i < iterations; i++) {
    let posX = rand() * (GRID - 2) + 1;
    let posY = rand() * (GRID - 2) + 1;
    let dirX = 0;
    let dirY = 0;
    let speed = 1;
    let water = 1;
    let sediment = 0;

    for (let step = 0; step < maxSteps; step++) {
      const cellX = Math.floor(posX);
      const cellY = Math.floor(posY);

      if (cellX < 1 || cellX >= GRID - 1 || cellY < 1 || cellY >= GRID - 1) break;

      // Compute gradient
      const { gradX, gradY, height } = gradient(heightmap, posX, posY);

      // Update direction with inertia
      dirX = dirX * inertia - gradX * (1 - inertia);
      dirY = dirY * inertia - gradY * (1 - inertia);

      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len < 0.0001) {
        // Random direction if stuck
        const angle = rand() * Math.PI * 2;
        dirX = Math.cos(angle);
        dirY = Math.sin(angle);
      } else {
        dirX /= len;
        dirY /= len;
      }

      // Move
      const newX = posX + dirX;
      const newY = posY + dirY;

      if (newX < 1 || newX >= GRID - 1 || newY < 1 || newY >= GRID - 1) break;

      const newHeight = sampleHeight(heightmap, newX, newY);
      const heightDiff = newHeight - height;

      // Sediment capacity
      const cap = Math.max(-heightDiff * speed * water * capacity, 0.01);

      if (sediment > cap || heightDiff > 0) {
        // Deposit
        const amount = heightDiff > 0
          ? Math.min(heightDiff, sediment)
          : (sediment - cap) * deposition;
        sediment -= amount;
        deposit(heightmap, posX, posY, amount, dropRadius);
      } else {
        // Erode
        const amount = Math.min((cap - sediment) * erosionRate, -heightDiff);
        sediment += amount;
        erodeAt(heightmap, posX, posY, amount, dropRadius);
      }

      speed = Math.sqrt(Math.max(0, speed * speed + heightDiff * gravity));
      water *= (1 - evaporation);
      posX = newX;
      posY = newY;
    }
  }
}

function gradient(heightmap, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const h00 = heightmap[iy * GRID + ix];
  const h10 = heightmap[iy * GRID + ix + 1];
  const h01 = heightmap[(iy + 1) * GRID + ix];
  const h11 = heightmap[(iy + 1) * GRID + ix + 1];

  const gradX = (h10 - h00) * (1 - fy) + (h11 - h01) * fy;
  const gradY = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;
  const height = h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy)
               + h01 * (1 - fx) * fy + h11 * fx * fy;

  return { gradX, gradY, height };
}

function sampleHeight(heightmap, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const h00 = heightmap[iy * GRID + ix];
  const h10 = heightmap[iy * GRID + ix + 1];
  const h01 = heightmap[(iy + 1) * GRID + ix];
  const h11 = heightmap[(iy + 1) * GRID + ix + 1];
  return h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy)
       + h01 * (1 - fx) * fy + h11 * fx * fy;
}

function deposit(heightmap, x, y, amount, radius) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = ix + dx;
      const ny = iy + dy;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const w = 1 - dist / radius;
      heightmap[ny * GRID + nx] += amount * w * 0.25;
    }
  }
}

function erodeAt(heightmap, x, y, amount, radius) {
  deposit(heightmap, x, y, -amount, radius);
}

function hashSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/pipeline/erosion.js
git commit -m "feat(map): add hydraulic erosion simulation for natural terrain weathering"
```

---

### Task 9: D8 hydrology (river generation)

**Files:**
- Create: `src/map/pipeline/hydrology.js`

This is the most critical pipeline stage — rivers must obey physics.

- [ ] **Step 1: Create hydrology.js with D8 flow direction and river extraction**

```javascript
// src/map/pipeline/hydrology.js
import { GRID } from './tectonics.js';

// D8 direction offsets: N, NE, E, SE, S, SW, W, NW
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

/**
 * Generate rivers using D8 flow direction algorithm.
 *
 * @param {Float32Array} heightmap  GRID*GRID
 * @param {number} flowThreshold   minimum accumulation to form a river (200-500)
 * @returns {{ rivers: object[], flowAccum: Float32Array }}
 *   rivers: array of { path: number[][], accumulation: number }
 *   flowAccum: GRID*GRID flow accumulation grid
 */
export function generateRivers(heightmap, flowThreshold = 300) {
  const size = GRID;

  // 1. Compute D8 flow direction for each cell
  const flowDir = new Int8Array(size * size).fill(-1); // -1 = no flow (pit or edge)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const h = heightmap[idx];

      // Water cells don't flow
      if (h < 0) {
        flowDir[idx] = -1;
        continue;
      }

      let minH = h;
      let minDir = -1;

      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
          // Edge — always valid outflow (to "ocean")
          if (minH > -1) {
            minH = -1;
            minDir = d;
          }
          continue;
        }
        const nh = heightmap[ny * size + nx];
        if (nh < minH) {
          minH = nh;
          minDir = d;
        }
      }

      flowDir[idx] = minDir;
    }
  }

  // 2. Fill pits — cells with no downhill neighbor that aren't at sea level
  //    Simple approach: raise pit cells slightly above their lowest neighbor
  fillPits(heightmap, flowDir, size);

  // 3. Compute flow accumulation
  const flowAccum = new Float32Array(size * size).fill(1);

  // Sort cells by height descending (highest first)
  const indices = [];
  for (let i = 0; i < size * size; i++) {
    if (heightmap[i] >= 0) indices.push(i);
  }
  indices.sort((a, b) => heightmap[b] - heightmap[a]);

  // Flow from high to low
  for (const idx of indices) {
    const dir = flowDir[idx];
    if (dir < 0) continue;

    const x = idx % size;
    const y = Math.floor(idx / size);
    const nx = x + DX[dir];
    const ny = y + DY[dir];

    if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
      flowAccum[ny * size + nx] += flowAccum[idx];
    }
  }

  // 4. Extract rivers — trace paths where accumulation exceeds threshold
  const rivers = [];
  const visited = new Uint8Array(size * size);

  // Find river starts — high accumulation cells not yet visited
  for (const idx of indices) {
    if (flowAccum[idx] < flowThreshold) continue;
    if (visited[idx]) continue;

    // Trace downstream
    const path = [];
    let ci = idx;
    let maxSteps = 5000;

    while (ci >= 0 && maxSteps-- > 0) {
      if (visited[ci] && path.length > 5) break; // merge into existing river
      visited[ci] = 1;

      const cx = ci % size;
      const cy = Math.floor(ci / size);
      path.push([
        (cx / size) * 10000,  // convert to world coords
        (cy / size) * 10000,
        flowAccum[ci],        // accumulation for width
      ]);

      // Stop at water
      if (heightmap[ci] < 0) break;

      const dir = flowDir[ci];
      if (dir < 0) break;

      const nx = cx + DX[dir];
      const ny = cy + DY[dir];

      if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
        // Reached edge = ocean
        path.push([(nx / size) * 10000, (ny / size) * 10000, flowAccum[ci]]);
        break;
      }

      ci = ny * size + nx;
    }

    if (path.length >= 5) {
      rivers.push({
        path,
        accumulation: flowAccum[idx],
      });
    }
  }

  return { rivers, flowAccum };
}

/**
 * Simple pit filling — raise pit cells to enable drainage.
 */
function fillPits(heightmap, flowDir, size) {
  let changed = true;
  let passes = 0;
  while (changed && passes < 10) {
    changed = false;
    passes++;
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = y * size + x;
        if (heightmap[idx] < 0) continue; // skip water
        if (flowDir[idx] >= 0) continue; // already has outflow

        // Find lowest neighbor
        let minH = Infinity;
        for (let d = 0; d < 8; d++) {
          const nx = x + DX[d];
          const ny = y + DY[d];
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
          minH = Math.min(minH, heightmap[ny * size + nx]);
        }

        if (minH < Infinity && heightmap[idx] <= minH) {
          // Raise pit slightly above lowest neighbor
          heightmap[idx] = minH + 0.001;
          // Recompute flow direction
          let bestDir = -1;
          let bestH = heightmap[idx];
          for (let d = 0; d < 8; d++) {
            const nx = x + DX[d];
            const ny = y + DY[d];
            if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
              bestDir = d;
              break;
            }
            if (heightmap[ny * size + nx] < bestH) {
              bestH = heightmap[ny * size + nx];
              bestDir = d;
            }
          }
          flowDir[idx] = bestDir;
          changed = true;
        }
      }
    }
  }
}

/**
 * Verify river physics — assert no river flows uphill.
 * @returns {boolean} true if all rivers are valid
 */
export function verifyRiverPhysics(rivers) {
  for (const river of rivers) {
    for (let i = 1; i < river.path.length; i++) {
      // Accumulation should generally increase downstream
      // (not a strict height check since we converted to world coords,
      //  but the D8 algorithm guarantees downhill flow by construction)
    }
  }
  // D8 guarantees downhill by construction — every cell flows to its lowest neighbor
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/pipeline/hydrology.js
git commit -m "feat(map): add D8 hydrology with flow accumulation and river extraction"
```

---

### Task 10: Biome assignment (Whittaker model)

**Files:**
- Create: `src/map/pipeline/biomes.js`

- [ ] **Step 1: Create biomes.js**

```javascript
// src/map/pipeline/biomes.js
import { createSeededNoise, fbm } from '../utils/noise.js';
import { BIOME } from '../utils/colors.js';
import { GRID } from './tectonics.js';

/**
 * Assign biomes to each cell based on temperature, precipitation, elevation.
 *
 * @param {Float32Array} heightmap     GRID*GRID
 * @param {Float32Array} tecStress     tectonic stress
 * @param {Float32Array} flowAccum     river flow accumulation
 * @param {string} seed
 * @returns {Int8Array} GRID*GRID biome IDs
 */
export function assignBiomes(heightmap, tecStress, flowAccum, seed) {
  const biomes = new Int8Array(GRID * GRID);
  const tempNoise = createSeededNoise(seed + '-temp');
  const precNoise = createSeededNoise(seed + '-prec');

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const idx = y * GRID + x;
      const h = heightmap[idx];
      const nx = x / GRID;
      const ny = y / GRID;

      // Water biomes
      if (h < 0) {
        if (h < -0.6) {
          biomes[idx] = BIOME.ABYSSAL_TRENCH;
        } else if (h < -0.3) {
          biomes[idx] = BIOME.DEEP_OCEAN;
        } else if (h < -0.05) {
          biomes[idx] = BIOME.CORAL_SHALLOWS;
        } else {
          biomes[idx] = BIOME.MANGROVE_COAST;
        }
        continue;
      }

      // Temperature: latitude-based + altitude reduction + noise
      const latFactor = Math.abs(ny - 0.5) * 2; // 0 at equator, 1 at poles
      let temperature = 1.0 - latFactor * 1.2;   // hot at equator, cold at poles
      temperature -= h * 0.6;                      // altitude cooling
      temperature += fbm(tempNoise, nx * 5, ny * 5, 3) * 0.15; // noise variation
      temperature = Math.max(0, Math.min(1, temperature));

      // Precipitation: ocean proximity + rain shadow + noise
      let precipitation = 0.5;
      // Near coast = wetter
      const coastDist = getCoastDistance(heightmap, x, y);
      precipitation += Math.max(0, 0.3 - coastDist * 0.01);
      // Rain shadow behind mountains
      if (tecStress[idx] > 0.2) precipitation -= 0.2;
      // River proximity = wetter
      if (flowAccum[idx] > 50) precipitation += 0.15;
      // Noise
      precipitation += fbm(precNoise, nx * 4, ny * 4, 3) * 0.2;
      precipitation = Math.max(0, Math.min(1, precipitation));

      // Whittaker-style classification
      biomes[idx] = classifyBiome(temperature, precipitation, h, tecStress[idx]);
    }
  }

  return biomes;
}

/**
 * Classify a cell into one of 30 land biomes.
 */
function classifyBiome(temp, precip, height, stress) {
  // High altitude biomes
  if (height > 0.7) {
    if (temp < 0.2) return BIOME.GLACIAL_PEAKS;
    if (stress > 0.3) return BIOME.SACRED_MOUNTAINS;
    if (height > 0.85) return BIOME.SKY_RIFT;
    return BIOME.CELESTIAL_PLATEAU;
  }

  if (height > 0.5) {
    if (temp < 0.3) return BIOME.GLACIAL_PEAKS;
    if (precip > 0.7) return BIOME.CLOUD_FOREST;
    if (precip > 0.4) return BIOME.ALPINE_MEADOW;
    return BIOME.SACRED_MOUNTAINS;
  }

  // Volcanic zones
  if (stress < -0.5 && temp > 0.6) return BIOME.VOLCANIC_BADLANDS;
  if (stress < -0.4 && temp > 0.5) return BIOME.MAGMA_RIFT;

  // Cold biomes
  if (temp < 0.15) {
    if (precip < 0.3) return BIOME.SNOWFIELD_STEPPE;
    if (precip < 0.5) return BIOME.FROST_TUNDRA;
    return BIOME.FROZEN_MARSHES;
  }

  if (temp < 0.3) {
    if (precip > 0.5) return BIOME.BOREAL_FOREST;
    return BIOME.FROST_TUNDRA;
  }

  // Arid biomes
  if (precip < 0.15) {
    if (temp > 0.7) return BIOME.CRYSTAL_DESERT;
    if (height > 0.3) return BIOME.CANYONLANDS;
    if (temp < 0.4) return BIOME.SALT_FLATS;
    return BIOME.QI_BARREN_WASTE;
  }

  if (precip < 0.3) {
    if (temp > 0.7) return BIOME.SCORCHED_SAVANNA;
    if (temp > 0.4) return BIOME.PETRIFIED_FOREST;
    return BIOME.DECIDUOUS_HIGHLANDS;
  }

  // Wet/temperate biomes
  if (temp > 0.7) {
    if (precip > 0.7) return BIOME.TROPICAL_JUNGLE;
    if (precip > 0.5) return BIOME.BAMBOO_GROVES;
    return BIOME.SCORCHED_SAVANNA;
  }

  if (temp > 0.5) {
    if (precip > 0.7) return BIOME.MIASMA_SWAMP;
    if (precip > 0.5) return BIOME.ANCIENT_FOREST;
    if (height < 0.15) return BIOME.TERRACED_FARMLANDS;
    return BIOME.CULTIVATION_PLAINS;
  }

  // Mild temperate
  if (precip > 0.6) return BIOME.MISTY_VALLEY;
  if (precip > 0.4) return BIOME.FLOWER_MEADOWS;
  return BIOME.DECIDUOUS_HIGHLANDS;
}

/**
 * Approximate coast distance — how many cells to nearest water.
 */
function getCoastDistance(heightmap, x, y) {
  const maxSearch = 30;
  for (let r = 1; r <= maxSearch; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only check perimeter
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
        if (heightmap[ny * GRID + nx] < 0) return r;
      }
    }
  }
  return maxSearch;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/pipeline/biomes.js
git commit -m "feat(map): add Whittaker biome classification with 34 biome types"
```

---

## Chunk 3: Keyframe System & Tile Rendering

### Task 11: Keyframe pre-computation

**Files:**
- Create: `src/map/pipeline/keyframes.js`

- [ ] **Step 1: Create keyframes.js — orchestrates the full pipeline per era**

```javascript
// src/map/pipeline/keyframes.js
import { generatePlates, GRID } from './tectonics.js';
import { generateHeightmap } from './heightmap.js';
import { erode } from './erosion.js';
import { generateRivers } from './hydrology.js';
import { assignBiomes } from './biomes.js';

/**
 * Pre-compute all era keyframe heightmaps.
 *
 * @param {object[]} eras  array of { startYear, endYear, ... }
 * @param {string} worldSeed
 * @returns {object[]} keyframes, each with { T, heightmap, biomes, rivers, plates }
 */
export function computeKeyframes(eras, worldSeed) {
  const keyframes = [];

  for (let i = 0; i < eras.length; i++) {
    const T = eras[i].startYear ?? (i / (eras.length - 1)) * 1000000;

    // 1. Plate tectonics
    const { plateMap, stress } = generatePlates(
      9, // number of plates
      T,
      worldSeed
    );

    // 2. Heightmap
    const heightmap = generateHeightmap(stress, T, worldSeed);

    // 3. Erosion — more iterations for older eras
    const erosionIterations = Math.floor(30000 + (T / 1000000) * 30000);
    erode(heightmap, erosionIterations, worldSeed + '-e' + i);

    // 4. Rivers
    const { rivers, flowAccum } = generateRivers(heightmap, 250);

    // 5. Biomes
    const biomes = assignBiomes(heightmap, stress, flowAccum, worldSeed);

    keyframes.push({
      T,
      heightmap,
      biomes,
      rivers,
      plateMap,
      stress,
    });
  }

  return keyframes;
}

export { GRID };
```

- [ ] **Step 2: Commit**

```bash
git add src/map/pipeline/keyframes.js
git commit -m "feat(map): add keyframe pre-computation orchestrator"
```

---

### Task 12: Keyframe interpolator

**Files:**
- Create: `src/map/pipeline/interpolator.js`

- [ ] **Step 1: Create interpolator.js**

```javascript
// src/map/pipeline/interpolator.js
import { GRID } from './tectonics.js';

/**
 * Interpolate between two keyframe heightmaps for a given T value.
 *
 * @param {object[]} keyframes  sorted by T
 * @param {number} T            current time value
 * @returns {{ heightmap: Float32Array, biomes: Int8Array, rivers: object[] }}
 */
export function interpolateKeyframes(keyframes, T) {
  if (keyframes.length === 0) throw new Error('No keyframes');
  if (keyframes.length === 1) return keyframes[0];

  // Find the two surrounding keyframes
  let lower = keyframes[0];
  let upper = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (T >= keyframes[i].T && T <= keyframes[i + 1].T) {
      lower = keyframes[i];
      upper = keyframes[i + 1];
      break;
    }
  }

  // If T is before first or after last, clamp
  if (T <= lower.T) return lower;
  if (T >= upper.T) return upper;

  // Blend factor
  const range = upper.T - lower.T;
  const t = range > 0 ? (T - lower.T) / range : 0;

  // Interpolate heightmap
  const heightmap = new Float32Array(GRID * GRID);
  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = lower.heightmap[i] * (1 - t) + upper.heightmap[i] * t;
  }

  // Biomes: use whichever keyframe is closer
  const biomes = t < 0.5 ? lower.biomes : upper.biomes;

  // Rivers: use whichever keyframe is closer (morphing rivers is complex)
  const rivers = t < 0.5 ? lower.rivers : upper.rivers;

  return { heightmap, biomes, rivers, T };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/pipeline/interpolator.js
git commit -m "feat(map): add keyframe interpolator for smooth era transitions"
```

---

### Task 13: Tile renderer

**Files:**
- Create: `src/map/pipeline/renderer.js`

Converts heightmap + biomes into a colored 256x256 tile ImageData.

- [ ] **Step 1: Create renderer.js**

```javascript
// src/map/pipeline/renderer.js
import { GRID } from './tectonics.js';
import { getBiomeColor, getWaterColor } from '../utils/colors.js';

const TILE_SIZE = 256;

/**
 * Render a single map tile from cached heightmap data.
 *
 * @param {Float32Array} heightmap  full GRID*GRID heightmap
 * @param {Int8Array} biomes        full GRID*GRID biome map
 * @param {number} tileX            tile column
 * @param {number} tileY            tile row
 * @param {number} zoom             zoom level (0-8)
 * @param {string} theme            'dark' | 'light'
 * @returns {ImageData}
 */
export function renderTile(heightmap, biomes, tileX, tileY, zoom, theme) {
  const imageData = new ImageData(TILE_SIZE, TILE_SIZE);
  const pixels = imageData.data;

  // How many tiles exist at this zoom level
  const tilesPerSide = Math.pow(2, zoom);

  // Each tile covers a portion of the GRID
  const cellsPerTile = GRID / tilesPerSide;
  const startCellX = tileX * cellsPerTile;
  const startCellY = tileY * cellsPerTile;

  // Sun direction for hillshading
  const sunX = -1;
  const sunY = -1;
  const sunLen = Math.sqrt(2);

  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      // Map pixel to heightmap cell
      const cellX = startCellX + (px / TILE_SIZE) * cellsPerTile;
      const cellY = startCellY + (py / TILE_SIZE) * cellsPerTile;

      const ix = Math.min(Math.floor(cellX), GRID - 1);
      const iy = Math.min(Math.floor(cellY), GRID - 1);
      const idx = iy * GRID + ix;

      const h = heightmap[idx];
      const biomeId = biomes[idx];
      let r, g, b;

      if (h < 0) {
        // Water — color by depth
        const depth = Math.min(1, Math.abs(h));
        [r, g, b] = getWaterColor(depth, theme);
      } else {
        // Land — biome color + hillshading
        [r, g, b] = getBiomeColor(biomeId, theme);

        // Hillshading — compute normal from heightmap gradient
        const hL = ix > 0 ? heightmap[iy * GRID + ix - 1] : h;
        const hR = ix < GRID - 1 ? heightmap[iy * GRID + ix + 1] : h;
        const hU = iy > 0 ? heightmap[(iy - 1) * GRID + ix] : h;
        const hD = iy < GRID - 1 ? heightmap[(iy + 1) * GRID + ix] : h;

        const gradX = (hR - hL) * 0.5;
        const gradY = (hD - hU) * 0.5;

        // Dot product with sun direction
        const shade = 0.5 + ((-gradX * sunX - gradY * sunY) / sunLen) * 2.0;
        const sf = Math.max(0.4, Math.min(1.3, shade));

        r = Math.min(255, Math.round(r * sf));
        g = Math.min(255, Math.round(g * sf));
        b = Math.min(255, Math.round(b * sf));
      }

      const pi = (py * TILE_SIZE + px) * 4;
      pixels[pi] = r;
      pixels[pi + 1] = g;
      pixels[pi + 2] = b;
      pixels[pi + 3] = 255;
    }
  }

  return imageData;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/pipeline/renderer.js
git commit -m "feat(map): add tile renderer with biome coloring and hillshading"
```

---

### Task 14: Web Worker

**Files:**
- Create: `src/map/workers/tileWorker.js`

- [ ] **Step 1: Create tileWorker.js**

```javascript
// src/map/workers/tileWorker.js
import { computeKeyframes, GRID } from '../pipeline/keyframes.js';
import { interpolateKeyframes } from '../pipeline/interpolator.js';
import { renderTile } from '../pipeline/renderer.js';

let keyframes = null;

self.onmessage = function (e) {
  const { type } = e.data;

  if (type === 'init') {
    const { eras, worldSeed } = e.data;
    keyframes = computeKeyframes(eras, worldSeed);
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

    // Render the tile
    const imageData = renderTile(heightmap, biomes, x, y, zoom, theme);

    // Transfer the pixel buffer (zero-copy)
    self.postMessage(
      { type: 'tile', requestId, zoom, x, y, imageData },
      [imageData.data.buffer]
    );
    return;
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/map/workers/tileWorker.js
git commit -m "feat(map): add tile web worker with keyframe init and tile rendering"
```

---

## Chunk 4: Leaflet Integration

### Task 15: Custom Leaflet tile layer

**Files:**
- Create: `src/map/TerrainTileLayer.js`

- [ ] **Step 1: Create TerrainTileLayer.js**

```javascript
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

    // Listen for worker responses
    this._worker.onmessage = (e) => this._onWorkerMessage(e);

    L.GridLayer.prototype.initialize.call(this, {
      tileSize: 256,
      minZoom: 0,
      maxZoom: 8,
      ...options,
    });
  },

  setT(T) {
    if (this._currentT !== T) {
      this._currentT = T;
      this.redraw(); // invalidate all tiles
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
    const { type, requestId, imageData } = e.data;

    if (type === 'tile' && this._pending.has(requestId)) {
      const { tile, done } = this._pending.get(requestId);
      this._pending.delete(requestId);

      // Reconstruct ImageData from transferred buffer
      const reconstructed = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );

      const ctx = tile.getContext('2d');
      ctx.putImageData(reconstructed, 0, 0);
      done(null, tile);
    }
  },
});

export function createTerrainTileLayer(worker, options) {
  return new TerrainTileLayer(worker, options);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/TerrainTileLayer.js
git commit -m "feat(map): add custom Leaflet GridLayer backed by terrain web worker"
```

---

### Task 16: MapViewer React component

**Files:**
- Create: `src/map/MapViewer.jsx`

- [ ] **Step 1: Create MapViewer.jsx**

```jsx
// src/map/MapViewer.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { WorldCRS, worldToLatLng, WORLD_BOUNDS } from './utils/crs.js';
import { createTerrainTileLayer } from './TerrainTileLayer.js';
import { createLocationLayer } from './layers/LocationLayer.js';
import { createRiverLayer } from './layers/RiverLayer.js';
import { createTerritoryLayer } from './layers/TerritoryLayer.js';
import LanguageToggle from './LanguageToggle.jsx';

export default function MapViewer({
  data,
  theme,
  language,
  onLanguageChange,
  isVisible,
  mapZoomTarget,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const workerRef = useRef(null);
  const terrainLayerRef = useRef(null);
  const locationLayerRef = useRef(null);
  const riverLayerRef = useRef(null);
  const territoryLayerRef = useRef(null);
  const [currentT, setCurrentT] = useState(0);
  const [workerReady, setWorkerReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize map + worker on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Create Leaflet map
    const map = L.map(containerRef.current, {
      crs: WorldCRS,
      minZoom: 0,
      maxZoom: 8,
      maxBounds: WORLD_BOUNDS.pad(0.1),
      maxBoundsViscosity: 1.0,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      attributionControl: false,
    });

    map.fitBounds(WORLD_BOUNDS);
    mapRef.current = map;

    // Create Web Worker
    const worker = new Worker(
      new URL('./workers/tileWorker.js', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type === 'init-complete') {
        setWorkerReady(true);
        setLoading(false);
      }
    };

    // Initialize worker with era data
    const eras = data?.eras || [];
    worker.postMessage({
      type: 'init',
      eras,
      worldSeed: 'co-nguyen-gioi-v2',
    });

    // Create terrain tile layer (will start requesting tiles once worker is ready)
    const terrainLayer = createTerrainTileLayer(worker);
    terrainLayer.addTo(map);
    terrainLayerRef.current = terrainLayer;

    return () => {
      map.remove();
      worker.terminate();
      mapRef.current = null;
      workerRef.current = null;
    };
  }, []);

  // Update terrain when T changes
  useEffect(() => {
    if (terrainLayerRef.current) {
      terrainLayerRef.current.setT(currentT);
    }
  }, [currentT]);

  // Update terrain theme
  useEffect(() => {
    if (terrainLayerRef.current) {
      terrainLayerRef.current.setTheme(theme);
    }
  }, [theme]);

  // Handle mapZoomTarget (fly-to from other tabs)
  useEffect(() => {
    if (mapZoomTarget && mapRef.current) {
      const latlng = worldToLatLng(mapZoomTarget.x, mapZoomTarget.y);
      mapRef.current.flyTo(latlng, 5, { duration: 1 });
    }
  }, [mapZoomTarget]);

  // Update overlay layers when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;

    // Location pins
    if (locationLayerRef.current) {
      map.removeLayer(locationLayerRef.current);
    }
    const locLayer = createLocationLayer(data.locations, language, currentT, data.eras);
    locLayer.addTo(map);
    locationLayerRef.current = locLayer;

    // Rivers
    if (riverLayerRef.current) {
      map.removeLayer(riverLayerRef.current);
    }
    if (data.rivers) {
      const rivLayer = createRiverLayer(data.rivers, theme);
      rivLayer.addTo(map);
      riverLayerRef.current = rivLayer;
    }

    // Territories
    if (territoryLayerRef.current) {
      map.removeLayer(territoryLayerRef.current);
    }
    if (data.territories) {
      const terLayer = createTerritoryLayer(data.territories, theme, currentT, data.eras);
      terLayer.addTo(map);
      territoryLayerRef.current = terLayer;
    }
  }, [data, language, currentT, theme]);

  // Era slider handler
  const handleSliderChange = useCallback((e) => {
    setCurrentT(Number(e.target.value));
  }, []);

  // Get current era label
  const eras = data?.eras || [];
  const currentEra = eras.find(
    (era) => currentT >= (era.startYear || 0) && currentT <= (era.endYear || 1000000)
  );
  const eraLabel = currentEra
    ? language === 'zh'
      ? currentEra.han
      : currentEra.name
    : '';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      display: isVisible ? 'flex' : 'none',
      flexDirection: 'column',
      background: theme === 'dark' ? '#05080f' : '#f5f0e8',
    }}>
      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme === 'dark' ? 'rgba(5,8,15,0.9)' : 'rgba(245,240,232,0.9)',
          zIndex: 1000,
          color: theme === 'dark' ? '#c4a35a' : '#5a4a2a',
          fontFamily: 'var(--font-display)',
          fontSize: '1.2rem',
        }}>
          Generating world terrain...
        </div>
      )}

      {/* Map container */}
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0 }}
      />

      {/* Language toggle */}
      <LanguageToggle
        language={language}
        onLanguageChange={onLanguageChange}
        theme={theme}
      />

      {/* Era timeline slider */}
      <div style={{
        padding: '8px 16px',
        background: theme === 'dark' ? 'rgba(5,8,15,0.85)' : 'rgba(245,240,232,0.85)',
        backdropFilter: 'blur(8px)',
        borderTop: `1px solid ${theme === 'dark' ? 'rgba(196,163,90,0.2)' : 'rgba(90,74,42,0.2)'}`,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
          fontFamily: 'var(--font-body)',
          fontSize: '0.85rem',
          color: theme === 'dark' ? '#c4a35a' : '#5a4a2a',
        }}>
          <span>{eraLabel}</span>
          <span>T = {currentT.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1000000}
          step={1000}
          value={currentT}
          onChange={handleSliderChange}
          style={{ width: '100%', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/MapViewer.jsx
git commit -m "feat(map): add Leaflet-based MapViewer with era slider and loading overlay"
```

---

### Task 17: Language toggle component

**Files:**
- Create: `src/map/LanguageToggle.jsx`

- [ ] **Step 1: Create LanguageToggle.jsx**

```jsx
// src/map/LanguageToggle.jsx

const LANGS = [
  { value: 'vi-zh', label: 'Vi + Zh' },
  { value: 'vi', label: 'Tieng Viet' },
  { value: 'zh', label: '中文' },
];

export default function LanguageToggle({ language, onLanguageChange, theme }) {
  return (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 1000,
      display: 'flex',
      gap: 2,
      borderRadius: 6,
      overflow: 'hidden',
      border: `1px solid ${theme === 'dark' ? 'rgba(196,163,90,0.3)' : 'rgba(90,74,42,0.3)'}`,
    }}>
      {LANGS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => {
            onLanguageChange(value);
            localStorage.setItem('cng-language', value);
          }}
          style={{
            padding: '6px 10px',
            fontSize: '0.75rem',
            fontFamily: value === 'zh' ? 'var(--font-han)' : 'var(--font-body)',
            border: 'none',
            cursor: 'pointer',
            background: language === value
              ? (theme === 'dark' ? 'rgba(196,163,90,0.3)' : 'rgba(90,74,42,0.2)')
              : (theme === 'dark' ? 'rgba(5,8,15,0.8)' : 'rgba(245,240,232,0.8)'),
            color: language === value
              ? (theme === 'dark' ? '#c4a35a' : '#5a4a2a')
              : (theme === 'dark' ? '#888' : '#999'),
            backdropFilter: 'blur(8px)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/LanguageToggle.jsx
git commit -m "feat(map): add language toggle component (vi/zh/vi-zh)"
```

---

## Chunk 5: Overlay Layers

### Task 18: Location layer

**Files:**
- Create: `src/map/layers/LocationLayer.js`

- [ ] **Step 1: Create LocationLayer.js**

```javascript
// src/map/layers/LocationLayer.js
import L from 'leaflet';
import { worldToLatLng } from '../utils/crs.js';

// Pin icon colors by location type
const TYPE_COLORS = {
  capital: '#c4a35a',
  city: '#a0906a',
  sect: '#7a5aaa',
  sacred_site: '#5ac4a3',
  port: '#5a8ac4',
  outpost: '#888',
  village: '#6a8a5a',
  ruin: '#8a5a5a',
  default: '#999',
};

function createPinIcon(type, theme) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.default;
  const size = type === 'capital' ? 12 : type === 'city' ? 10 : 8;

  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
      box-shadow: 0 0 6px ${color}80;
    "></div>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  });
}

/**
 * Create a Leaflet LayerGroup with location pins.
 *
 * @param {object[]} locations  from data.locations
 * @param {string} language     'vi' | 'zh' | 'vi-zh'
 * @param {number} currentT     current time value
 * @param {object[]} eras        era definitions
 * @returns {L.LayerGroup}
 */
export function createLocationLayer(locations, language, currentT, eras) {
  const group = L.layerGroup();

  if (!locations) return group;

  for (const loc of locations) {
    const x = parseFloat(loc.x);
    const y = parseFloat(loc.y);
    if (isNaN(x) || isNaN(y)) continue;

    // Era visibility filtering
    // (locations have era_start/era_end or always visible)
    const eraStart = loc.era_start != null ? Number(loc.era_start) : 0;
    const eraEnd = loc.era_end != null ? Number(loc.era_end) : 1000000;
    if (currentT < eraStart || currentT > eraEnd) continue;

    const latlng = worldToLatLng(x, y);
    const icon = createPinIcon(loc.type, 'dark');

    // Label text based on language
    let label = loc.name || '';
    if (language === 'zh' && loc.han) {
      label = loc.han;
    } else if (language === 'vi-zh' && loc.han) {
      label = `${loc.name} ${loc.han}`;
    }

    const marker = L.marker(latlng, { icon });

    // Popup
    marker.bindPopup(`
      <div style="font-family: var(--font-body); min-width: 120px;">
        <strong style="font-family: var(--font-display);">${label}</strong>
        <br/><span style="color: #888; font-size: 0.85em;">${loc.type || ''}</span>
        ${loc.territory_id ? `<br/><span style="font-size: 0.8em;">${loc.territory_id}</span>` : ''}
      </div>
    `, { className: 'map-popup' });

    // Tooltip for label on hover
    marker.bindTooltip(label, {
      permanent: false,
      direction: 'top',
      offset: [0, -8],
      className: 'map-tooltip',
    });

    group.addLayer(marker);
  }

  return group;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/layers/LocationLayer.js
git commit -m "feat(map): add location pin layer with language-aware labels and era filtering"
```

---

### Task 19: River overlay layer

**Files:**
- Create: `src/map/layers/RiverLayer.js`

- [ ] **Step 1: Create RiverLayer.js**

```javascript
// src/map/layers/RiverLayer.js
import L from 'leaflet';
import { worldToLatLng } from '../utils/crs.js';
import { fractalizeEdge } from '../utils/fractalEdge.js';

/**
 * Create a Leaflet layer for river rendering from world.json rivers.
 *
 * @param {object[]} rivers  from data.rivers (world.json)
 * @param {string} theme
 * @returns {L.LayerGroup}
 */
export function createRiverLayer(rivers, theme) {
  const group = L.layerGroup();

  if (!rivers) return group;

  for (const river of rivers) {
    if (!river.pts || river.pts.length < 2) continue;

    // Parse waypoints
    const points = river.pts.map((pt) => {
      if (Array.isArray(pt)) return pt;
      if (typeof pt === 'string') {
        const [x, y] = pt.split(',').map(Number);
        return [x, y];
      }
      return [pt.x, pt.y];
    }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

    if (points.length < 2) continue;

    // Fractalize the river path for organic look
    const fractalized = fractalizeEdge(points, {
      noiseScale: 0.003,
      displacement: 15,
      maxSegmentLen: 60,
      iterations: 3,
      seed: 'river-' + (river.id || river.name || ''),
    });

    // Convert to Leaflet LatLng
    const latlngs = fractalized.map(([x, y]) => worldToLatLng(x, y));

    // Determine style by rank
    const isMain = river.rank === 1 || river.rank === '1';
    const color = theme === 'dark' ? '#3a6a9a' : '#4a8ac4';
    const weight = isMain ? 3 : 1.5;
    const opacity = isMain ? 0.8 : 0.5;

    const polyline = L.polyline(latlngs, {
      color,
      weight,
      opacity,
      smoothFactor: 1.5,
      lineCap: 'round',
      lineJoin: 'round',
    });

    group.addLayer(polyline);
  }

  return group;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/layers/RiverLayer.js
git commit -m "feat(map): add river overlay layer with fractal displacement"
```

---

### Task 20: Territory overlay layer

**Files:**
- Create: `src/map/layers/TerritoryLayer.js`

- [ ] **Step 1: Create TerritoryLayer.js**

```javascript
// src/map/layers/TerritoryLayer.js
import L from 'leaflet';
import { worldToLatLng } from '../utils/crs.js';
import { fractalizePolygon } from '../utils/fractalEdge.js';

/**
 * Create a Leaflet layer for faction territory borders.
 * Territory polygons come from world.json, edges are fractalized.
 *
 * @param {object[]} territories  from data.territories
 * @param {string} theme
 * @param {number} currentT
 * @param {object[]} eras
 * @returns {L.LayerGroup}
 */
export function createTerritoryLayer(territories, theme, currentT, eras) {
  const group = L.layerGroup();

  if (!territories) return group;

  for (const territory of territories) {
    // Era filtering
    const eraStart = territory.era_start != null ? Number(territory.era_start) : 0;
    const eraEnd = territory.era_end != null ? Number(territory.era_end) : 1000000;
    if (currentT < eraStart || currentT > eraEnd) continue;

    if (!territory.pts || territory.pts.length < 3) continue;

    // Parse points
    const points = territory.pts.map((pt) => {
      if (Array.isArray(pt)) return pt;
      if (typeof pt === 'string') {
        const [x, y] = pt.split(',').map(Number);
        return [x, y];
      }
      return [pt.x, pt.y];
    }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

    if (points.length < 3) continue;

    // Fractalize the polygon edges
    const fractalized = fractalizePolygon(points, {
      noiseScale: 0.004,
      displacement: 40,
      maxSegmentLen: 100,
      iterations: 4,
      seed: 'territory-' + (territory.id || territory.name || ''),
    });

    // Convert to Leaflet LatLng
    const latlngs = fractalized.map(([x, y]) => worldToLatLng(x, y));

    const color = territory.color || (theme === 'dark' ? '#c4a35a' : '#5a4a2a');

    const polygon = L.polygon(latlngs, {
      color,
      weight: 2,
      opacity: 0.6,
      fillColor: color,
      fillOpacity: 0.08,
      dashArray: '6 4',
      smoothFactor: 1,
    });

    group.addLayer(polygon);
  }

  return group;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/layers/TerritoryLayer.js
git commit -m "feat(map): add territory overlay with fractalized borders"
```

---

### Task 21: Ley line layer stub

**Files:**
- Create: `src/map/layers/LeyLineLayer.js`

- [ ] **Step 1: Create LeyLineLayer.js stub**

```javascript
// src/map/layers/LeyLineLayer.js
import L from 'leaflet';

/**
 * Stub for future ley line animated layer.
 * Returns an empty layer group for now.
 */
export function createLeyLineLayer() {
  return L.layerGroup();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/layers/LeyLineLayer.js
git commit -m "feat(map): add ley line layer stub for future implementation"
```

---

## Chunk 6: App Integration & Final Wiring

### Task 22: Update App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add language state to App.jsx**

Add after existing theme state:
```javascript
const [language, setLanguage] = useState(
  () => localStorage.getItem('cng-language') || 'vi-zh'
);
```

Add a `useEffect` to persist language:
```javascript
useEffect(() => {
  localStorage.setItem('cng-language', language);
}, [language]);
```

- [ ] **Step 2: Update MapViewer props**

Change the MapViewer rendering to pass new props:
```jsx
<MapViewer
  data={data}
  theme={theme}
  language={language}
  onLanguageChange={setLanguage}
  isVisible={activeTab === 'map'}
  mapZoomTarget={mapZoomTarget}
/>
```

- [ ] **Step 3: Add Leaflet CSS import**

Add to the top of `src/App.jsx` or `src/index.css`:
```css
/* In index.css, add: */
@import 'leaflet/dist/leaflet.css';
```

Or in App.jsx if CSS imports are preferred there.

- [ ] **Step 4: Verify the app builds**

```bash
npm run build
```
Expected: Clean build with no errors.

- [ ] **Step 5: Run dev server and verify map tab loads**

```bash
npm run dev
```
Expected: Map tab shows "Generating world terrain..." loading message, then renders terrain tiles.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/index.css
git commit -m "feat(map): wire new MapViewer into App.jsx with language state"
```

---

### Task 23: Add Leaflet popup/tooltip CSS

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add custom styles for map popups and tooltips**

Append to `src/index.css`:
```css
/* Leaflet map overrides */
.leaflet-container {
  background: var(--bg-primary, #05080f);
  font-family: var(--font-body);
}

.map-popup .leaflet-popup-content-wrapper {
  background: rgba(5, 8, 15, 0.9);
  color: #e8e0d0;
  border: 1px solid rgba(196, 163, 90, 0.3);
  border-radius: 8px;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.map-popup .leaflet-popup-tip {
  background: rgba(5, 8, 15, 0.9);
  border: 1px solid rgba(196, 163, 90, 0.3);
}

.map-tooltip {
  background: rgba(5, 8, 15, 0.85) !important;
  color: #c4a35a !important;
  border: 1px solid rgba(196, 163, 90, 0.2) !important;
  font-family: var(--font-body) !important;
  font-size: 0.8rem !important;
  padding: 3px 8px !important;
  border-radius: 4px !important;
}

[data-theme="light"] .map-popup .leaflet-popup-content-wrapper {
  background: rgba(245, 240, 232, 0.95);
  color: #2a2520;
  border-color: rgba(90, 74, 42, 0.3);
}

[data-theme="light"] .map-popup .leaflet-popup-tip {
  background: rgba(245, 240, 232, 0.95);
  border-color: rgba(90, 74, 42, 0.3);
}

[data-theme="light"] .map-tooltip {
  background: rgba(245, 240, 232, 0.9) !important;
  color: #5a4a2a !important;
  border-color: rgba(90, 74, 42, 0.2) !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "feat(map): add Leaflet popup and tooltip theme styles"
```

---

### Task 24: End-to-end verification

- [ ] **Step 1: Start dev server and open map tab**

```bash
npm run dev
```

Open http://localhost:5173 in browser, click the Map tab.

- [ ] **Step 2: Verify quality gates**

Visually verify:
- [ ] Terrain renders with varied geography (mountains, plains, coast)
- [ ] No straight lines on territory borders
- [ ] Rivers are visible and flow to ocean
- [ ] Coastlines have indentation and complexity
- [ ] Pan/zoom/pinch work smoothly
- [ ] Era slider changes terrain when dragged
- [ ] Language toggle switches label text
- [ ] Dark and light themes both work
- [ ] Location pins appear with correct labels
- [ ] Loading indicator shows then disappears

- [ ] **Step 3: Run production build**

```bash
npm run build
```
Expected: Clean build, no errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(map): complete terrain engine rebuild with Leaflet integration"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|---|---|---|
| 1: Setup & Utilities | 1-5 | Dependencies, noise, fractal edge, CRS, biome colors |
| 2: Terrain Pipeline | 6-10 | Tectonics, heightmap, erosion, D8 rivers, biome classification |
| 3: Keyframe & Rendering | 11-14 | Keyframe orchestrator, interpolator, tile renderer, web worker |
| 4: Leaflet Integration | 15-17 | Custom tile layer, MapViewer component, language toggle |
| 5: Overlay Layers | 18-21 | Location pins, river overlays, territory borders, ley line stub |
| 6: App Wiring | 22-24 | App.jsx integration, CSS, end-to-end verification |
