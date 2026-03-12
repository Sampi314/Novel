// src/map/pipeline/borderCompute.js

/**
 * Race-biome affinity map.
 * Defines which biome IDs each race's territory naturally gravitates toward.
 * Border points near preferred biomes get attracted toward them.
 */
const RACE_BIOME_AFFINITY = {
  // Long Tộc — dragons: sacred mountains, sky rifts, high altitude
  long: [22, 23, 24, 25, 14], // SACRED_MOUNTAINS, SKY_RIFT, CLOUD_FOREST, ALPINE_MEADOW, GLACIAL_PEAKS
  // Nhân Tộc — humans: plains, farmlands, temperate
  nhan: [6, 12, 8, 9, 7, 4, 11], // CULTIVATION_PLAINS, TERRACED_FARMLANDS, DECIDUOUS_HIGHLANDS, FLOWER_MEADOWS, ANCIENT_FOREST, BAMBOO_GROVES, MISTY_VALLEY
  // Yêu Tộc — demons: forests, jungles, swamps
  yeu: [7, 3, 5, 4, 11, 24], // ANCIENT_FOREST, TROPICAL_JUNGLE, MIASMA_SWAMP, BAMBOO_GROVES, MISTY_VALLEY, CLOUD_FOREST
  // Tinh Linh — spirits: forests, gardens, ethereal
  tinh: [7, 9, 11, 24, 25], // ANCIENT_FOREST, FLOWER_MEADOWS, MISTY_VALLEY, CLOUD_FOREST, ALPINE_MEADOW
  // Trùng Tộc — insects: swamps, marshes, dark forests
  trung: [5, 16, 3, 28, 7], // MIASMA_SWAMP, FROZEN_MARSHES, TROPICAL_JUNGLE, MANGROVE_COAST, ANCIENT_FOREST
  // Cự Tộc — giants: tundra, cold regions
  cu: [13, 14, 17, 15, 16], // FROST_TUNDRA, GLACIAL_PEAKS, SNOWFIELD_STEPPE, BOREAL_FOREST, FROZEN_MARSHES
  // Thạch Tộc — stone race: mountains, canyons, rocky
  thach: [22, 20, 0, 18, 1, 14], // SACRED_MOUNTAINS, CANYONLANDS, VOLCANIC_BADLANDS, QI_BARREN_WASTE, MAGMA_RIFT, GLACIAL_PEAKS
  // Hải Tộc — sea race: all water biomes
  hai: [26, 27, 28, 29], // DEEP_OCEAN, CORAL_SHALLOWS, MANGROVE_COAST, ABYSSAL_TRENCH
};

/**
 * Detect the race key from territory name for biome affinity lookup.
 */
function detectRaceKey(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('long') || n.includes('龍')) return 'long';
  if (n.includes('nhân') || n.includes('人')) return 'nhan';
  if (n.includes('yêu') || n.includes('妖')) return 'yeu';
  if (n.includes('tinh') || n.includes('精')) return 'tinh';
  if (n.includes('trùng') || n.includes('蟲')) return 'trung';
  if (n.includes('cự') || n.includes('巨')) return 'cu';
  if (n.includes('thạch') || n.includes('石')) return 'thach';
  if (n.includes('hải') || n.includes('海') || n.includes('đông')) return 'hai';
  return null;
}

/**
 * Compute terrain-following territory borders using heightmap data.
 * Borders are clipped to land only — segments over ocean are removed,
 * creating natural coastline-following boundaries.
 * Race-biome affinity nudges border points toward preferred terrain.
 *
 * @param {object[]} territories  from world.json
 * @param {Float32Array} heightmap  GRID*GRID heightmap
 * @param {object[]} rivers  D8 river paths
 * @param {number} GRID  heightmap resolution (1024)
 * @param {Int8Array} [biomes]  GRID*GRID biome map (optional)
 * @returns {object[]} borders — each { id, color, segments: [[[x,y],...], ...] }
 */
export function computeTerrainBorders(territories, heightmap, rivers, GRID, biomes) {
  if (!territories || !heightmap) return [];

  const worldScale = 10000 / GRID;

  // Build spatial index of river points for snapping
  const riverIndex = buildRiverIndex(rivers, 200);

  // Precompute gradient magnitude for ridge detection
  const gradMag = computeGradientMagnitude(heightmap, GRID);

  const results = [];

  for (const territory of territories) {
    if (!territory.pts || territory.pts.length < 3) continue;

    const controlPts = territory.pts.map(pt => {
      if (Array.isArray(pt)) return [pt[0], pt[1]];
      if (typeof pt === 'string') {
        const [x, y] = pt.split(',').map(Number);
        return [x, y];
      }
      return [pt.x, pt.y];
    }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

    if (controlPts.length < 3) continue;

    // Detect if this is a sea/water territory
    const name = (territory.name || '').toLowerCase();
    const isSeaTerritory = name.includes('hải') || name.includes('海') ||
      name.includes('đông hải') || name.includes('biển');

    // Detect race for biome affinity
    const raceKey = detectRaceKey(territory.name);
    const preferredBiomes = raceKey ? RACE_BIOME_AFFINITY[raceKey] : null;

    // Build full border path
    const fullPath = [];
    for (let i = 0; i < controlPts.length; i++) {
      const a = controlPts[i];
      const b = controlPts[(i + 1) % controlPts.length];

      const edgePath = computeTerrainEdge(a, b, heightmap, gradMag, riverIndex, GRID, biomes, preferredBiomes);
      if (fullPath.length > 0 && edgePath.length > 0) {
        edgePath.shift();
      }
      fullPath.push(...edgePath);
    }

    // Split border into segments based on domain:
    // - Sea territories: keep ALL points (both land and water)
    // - Land territories: only keep land points (clip at coastlines)
    const segments = [];
    if (isSeaTerritory) {
      // Sea territory: keep entire border as one segment
      if (fullPath.length >= 2) {
        segments.push(fullPath);
      }
    } else {
      // Land territory: split into land-only segments
      let current = [];
      for (const pt of fullPath) {
        const gx = Math.min(GRID - 1, Math.max(0, Math.floor((pt[0] / 10000) * GRID)));
        const gy = Math.min(GRID - 1, Math.max(0, Math.floor((pt[1] / 10000) * GRID)));
        const h = heightmap[gy * GRID + gx];

        if (h >= 0) {
          current.push(pt);
        } else {
          if (current.length >= 2) {
            segments.push(current);
          }
          current = [];
        }
      }
      if (current.length >= 2) {
        segments.push(current);
      }
    }

    // Apply fractal midpoint displacement to each segment for organic look
    const fractalSegments = segments.map(seg =>
      fractalDisplace(seg, 3, 35, territory.id || territory.name)
    );

    results.push({
      id: territory.id || territory.name,
      color: territory.color,
      segments: fractalSegments,
      path: fullPath,
    });
  }

  return results;
}

/**
 * Compute a single terrain-following edge between two control points.
 * When biomes + preferredBiomes are provided, nudges border points
 * toward cells with race-preferred biome types.
 */
function computeTerrainEdge(a, b, heightmap, gradMag, riverIndex, GRID, biomes, preferredBiomes) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Densify: one point every ~30 world units for smoother curves
  const numSteps = Math.max(2, Math.ceil(dist / 30));
  const points = [];
  const worldScale = 10000 / GRID;

  for (let s = 0; s <= numSteps; s++) {
    const t = s / numSteps;
    let x = a[0] + dx * t;
    let y = a[1] + dy * t;

    // Convert to grid coordinates
    const gx = Math.min(GRID - 1, Math.max(0, Math.floor((x / 10000) * GRID)));
    const gy = Math.min(GRID - 1, Math.max(0, Math.floor((y / 10000) * GRID)));

    // Only apply terrain features on land
    if (heightmap[gy * GRID + gx] >= 0) {
      // 1. Ridge attraction: push point toward nearby heightmap ridges
      const ridgeOffset = findRidgeAttraction(gx, gy, heightmap, gradMag, GRID);
      x += ridgeOffset[0] * worldScale * 0.5;
      y += ridgeOffset[1] * worldScale * 0.5;

      // 2. River snapping: snap toward nearby rivers
      const riverSnap = findNearestRiver(x, y, riverIndex, 120);
      if (riverSnap) {
        x += (riverSnap[0] - x) * 0.6;
        y += (riverSnap[1] - y) * 0.6;
      }

      // 3. Biome affinity attraction: nudge toward preferred biome cells
      if (biomes && preferredBiomes) {
        const biomeOffset = findBiomeAttraction(gx, gy, biomes, preferredBiomes, GRID);
        x += biomeOffset[0] * worldScale * 0.4;
        y += biomeOffset[1] * worldScale * 0.4;
      }

      // 4. Micro-jitter for hand-drawn look
      const jitterSeed = (x * 7.31 + y * 13.17) % 1;
      const jitterAmount = 10;
      x += (Math.sin(jitterSeed * 47.3) * 2 - 1) * jitterAmount;
      y += (Math.cos(jitterSeed * 31.7) * 2 - 1) * jitterAmount;
    }

    x = Math.max(0, Math.min(10000, x));
    y = Math.max(0, Math.min(10000, y));
    points.push([x, y]);
  }

  return points;
}

/**
 * Find the direction toward the nearest cell with a preferred biome.
 * Returns a normalized offset vector scaled by attraction strength.
 */
function findBiomeAttraction(gx, gy, biomes, preferredBiomes, GRID) {
  const searchR = 8;
  let bestDist = searchR * searchR + 1;
  let bestDx = 0;
  let bestDy = 0;

  // Check if current cell already has preferred biome — no attraction needed
  const currentBiome = biomes[gy * GRID + gx];
  if (preferredBiomes.includes(currentBiome)) return [0, 0];

  for (let dy = -searchR; dy <= searchR; dy++) {
    for (let dx = -searchR; dx <= searchR; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;

      const biome = biomes[ny * GRID + nx];
      if (!preferredBiomes.includes(biome)) continue;

      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  if (bestDist > searchR * searchR) return [0, 0];

  const len = Math.sqrt(bestDx * bestDx + bestDy * bestDy);
  if (len < 1) return [0, 0];
  // Stronger attraction for closer preferred biome cells
  const strength = 2 * (1 - Math.sqrt(bestDist) / searchR);
  return [bestDx / len * strength, bestDy / len * strength];
}

/**
 * Find the direction toward the nearest heightmap ridge within a search radius.
 */
function findRidgeAttraction(gx, gy, heightmap, gradMag, GRID) {
  const searchR = 6;
  let bestGrad = 0;
  let bestDx = 0;
  let bestDy = 0;

  for (let dy = -searchR; dy <= searchR; dy++) {
    for (let dx = -searchR; dx <= searchR; dx++) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;

      const g = gradMag[ny * GRID + nx];
      if (g > bestGrad && heightmap[ny * GRID + nx] > 0.05) {
        bestGrad = g;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  const len = Math.sqrt(bestDx * bestDx + bestDy * bestDy);
  if (len < 1) return [0, 0];
  return [bestDx / len * 3, bestDy / len * 3];
}

/**
 * Compute gradient magnitude for ridge detection.
 */
function computeGradientMagnitude(heightmap, GRID) {
  const gradMag = new Float32Array(GRID * GRID);

  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const idx = y * GRID + x;
      const gx = (heightmap[idx + 1] - heightmap[idx - 1]) * 0.5;
      const gy = (heightmap[(y + 1) * GRID + x] - heightmap[(y - 1) * GRID + x]) * 0.5;
      gradMag[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  return gradMag;
}

/**
 * Build a spatial hash index for river segments.
 */
function buildRiverIndex(rivers, cellSize) {
  const index = new Map();
  if (!rivers) return index;

  for (const river of rivers) {
    for (const pt of river.path) {
      const cx = Math.floor(pt[0] / cellSize);
      const cy = Math.floor(pt[1] / cellSize);
      const key = `${cx},${cy}`;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push([pt[0], pt[1]]);
    }
  }

  return index;
}

/**
 * Find the nearest river point within maxDist world units.
 */
function findNearestRiver(x, y, riverIndex, maxDist) {
  const cellSize = 200;
  const cx = Math.floor(x / cellSize);
  const cy = Math.floor(y / cellSize);

  let bestDist = maxDist * maxDist;
  let bestPt = null;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const key = `${cx + dx},${cy + dy}`;
      const pts = riverIndex.get(key);
      if (!pts) continue;

      for (const pt of pts) {
        const d2 = (pt[0] - x) * (pt[0] - x) + (pt[1] - y) * (pt[1] - y);
        if (d2 < bestDist) {
          bestDist = d2;
          bestPt = pt;
        }
      }
    }
  }

  return bestPt;
}

/**
 * Recursive midpoint displacement for fractal border edges.
 * Takes a polyline and inserts displaced midpoints between each pair of points,
 * creating organic, natural-looking borders.
 *
 * @param {number[][]} points  [[x,y], ...]
 * @param {number} iterations  recursion depth (3-4 recommended)
 * @param {number} displacement  max displacement in world units
 * @param {string} seed  deterministic seed string
 * @returns {number[][]}
 */
function fractalDisplace(points, iterations, displacement, seed) {
  if (points.length < 2 || iterations <= 0) return points;

  // Simple deterministic hash for reproducible displacement
  function hash(x, y, i) {
    let h = 2166136261;
    h ^= (x * 374761393 + y * 668265263 + i * 2147483647) | 0;
    h = Math.imul(h, 16777619);
    h ^= seed.length * 31;
    for (let c = 0; c < seed.length; c++) {
      h ^= seed.charCodeAt(c);
      h = Math.imul(h, 16777619);
    }
    return ((h & 0x7fffffff) / 0x7fffffff) * 2 - 1; // -1 to 1
  }

  let result = points;
  let disp = displacement;

  for (let iter = 0; iter < iterations; iter++) {
    const next = [result[0]];

    for (let i = 0; i < result.length - 1; i++) {
      const ax = result[i][0];
      const ay = result[i][1];
      const bx = result[i + 1][0];
      const by = result[i + 1][1];

      // Midpoint
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;

      // Perpendicular direction
      const edx = bx - ax;
      const edy = by - ay;
      const len = Math.sqrt(edx * edx + edy * edy);
      if (len < 1) {
        next.push(result[i + 1]);
        continue;
      }
      const nx = -edy / len;
      const ny = edx / len;

      // Deterministic displacement
      const d = hash(Math.round(mx), Math.round(my), iter) * disp;

      next.push([
        Math.max(0, Math.min(10000, mx + nx * d)),
        Math.max(0, Math.min(10000, my + ny * d)),
      ]);
      next.push(result[i + 1]);
    }

    result = next;
    disp *= 0.5; // Halve displacement each iteration
  }

  return result;
}
