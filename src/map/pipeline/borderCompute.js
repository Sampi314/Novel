// src/map/pipeline/borderCompute.js

/**
 * Compute terrain-following territory borders using heightmap data.
 * Borders are clipped to land only — segments over ocean are removed,
 * creating natural coastline-following boundaries.
 *
 * @param {object[]} territories  from world.json
 * @param {Float32Array} heightmap  GRID*GRID heightmap
 * @param {object[]} rivers  D8 river paths
 * @param {number} GRID  heightmap resolution (1024)
 * @returns {object[]} borders — each { id, color, segments: [[[x,y],...], ...] }
 */
export function computeTerrainBorders(territories, heightmap, rivers, GRID) {
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

    // Detect if this is a sea/water territory by checking how many control points
    // are over water. Sea races (Hải Tộc, etc.) have territories on ocean tiles.
    const name = (territory.name || '').toLowerCase();
    const isSeaTerritory = name.includes('hải') || name.includes('海') ||
      name.includes('đông hải') || name.includes('biển');

    // Build full border path
    const fullPath = [];
    for (let i = 0; i < controlPts.length; i++) {
      const a = controlPts[i];
      const b = controlPts[(i + 1) % controlPts.length];

      const edgePath = computeTerrainEdge(a, b, heightmap, gradMag, riverIndex, GRID);
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

    results.push({
      id: territory.id || territory.name,
      color: territory.color,
      segments,
      // Keep single path for backward compat
      path: fullPath,
    });
  }

  return results;
}

/**
 * Compute a single terrain-following edge between two control points.
 */
function computeTerrainEdge(a, b, heightmap, gradMag, riverIndex, GRID) {
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

      // 3. Micro-jitter for hand-drawn look
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
