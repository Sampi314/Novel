/**
 * RoadGenerator.js — Procedural road network connecting locations.
 *
 * Algorithm:
 *   1. Build minimum spanning tree (MST) of all locations (ensures connectivity)
 *   2. Add extra short edges for redundancy (cities/capitals get more connections)
 *   3. Generate smooth waypoints with noise displacement for organic curves
 *   4. Sample terrain to push roads away from water
 *
 * Returns an array of road objects with waypoints, ready for RoadLayer.
 */

import { createNoise } from '../utils/noise.js';
import { BASE_SEED } from '../WorldSeed.js';
import { sampleHeight } from './TerrainGenerator.js';

const ROAD_SEED = BASE_SEED + 2000;
const MAX_ROAD_DIST = 4000;
const MAX_EXTRA_EDGES = 12;
const EXTRA_EDGE_MAX_DIST = 2800;

// ---------------------------------------------------------------------------
// Union-Find for Kruskal's MST
// ---------------------------------------------------------------------------

function makeUnionFind(n) {
  const parent = new Int32Array(n);
  const rank = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path halving
      x = parent[x];
    }
    return x;
  }

  function union(a, b) {
    const pa = find(a), pb = find(b);
    if (pa === pb) return false;
    if (rank[pa] < rank[pb]) parent[pa] = pb;
    else if (rank[pa] > rank[pb]) parent[pb] = pa;
    else { parent[pb] = pa; rank[pa]++; }
    return true;
  }

  return { find, union };
}

// ---------------------------------------------------------------------------
// Path generation
// ---------------------------------------------------------------------------

/**
 * Generate smooth waypoints between two locations.
 * Uses noise displacement + terrain avoidance.
 */
function generateRoadPath(x1, y1, x2, y2, dist, noise) {
  const numSegments = Math.max(4, Math.floor(dist / 350));
  const pts = [[x1, y1]];

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  // Perpendicular direction for displacement
  const perpX = -dy / len;
  const perpY = dx / len;

  // Max perpendicular displacement scales with distance
  const maxDisp = dist * 0.12;

  for (let i = 1; i < numSegments; i++) {
    const t = i / numSegments;
    let px = x1 + dx * t;
    let py = y1 + dy * t;

    // Noise-based perpendicular displacement for organic curve
    const n = noise.fbm(px * 0.0008 + 50, py * 0.0008 + 50, 3);
    px += perpX * n * maxDisp;
    py += perpY * n * maxDisp;

    // Terrain avoidance: push away from water
    const h = sampleHeight(px, py);
    if (h < 0) {
      // Sample 4 directions and move toward highest terrain
      const step = 150;
      let bestH = h;
      let bestDx = 0, bestDy = 0;

      const offsets = [[step, 0], [-step, 0], [0, step], [0, -step]];
      for (const [ox, oy] of offsets) {
        const sh = sampleHeight(px + ox, py + oy);
        if (sh > bestH) {
          bestH = sh;
          bestDx = ox;
          bestDy = oy;
        }
      }

      // Move toward land (repeat up to 3 times for deeper water)
      for (let attempt = 0; attempt < 3 && sampleHeight(px, py) < 0; attempt++) {
        px += bestDx * 0.6;
        py += bestDy * 0.6;
      }
    }

    // Clamp to world bounds
    px = Math.max(200, Math.min(9800, px));
    py = Math.max(200, Math.min(9800, py));

    pts.push([px, py]);
  }

  pts.push([x2, y2]);
  return pts;
}

// ---------------------------------------------------------------------------
// Network generation
// ---------------------------------------------------------------------------

/**
 * Generate a procedural road network connecting locations.
 *
 * @param {Array<{id: string, x: number, y: number, type: string}>} locations
 * @returns {Array<{from: string, to: string, rank: number, pts: number[][]}>}
 */
export function generateRoadNetwork(locations) {
  if (!locations || locations.length < 2) return [];

  const noise = createNoise(ROAD_SEED);

  // 1. Compute candidate edges (filter by max distance)
  const edges = [];
  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const dx = locations[i].x - locations[j].x;
      const dy = locations[i].y - locations[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MAX_ROAD_DIST) {
        edges.push({ i, j, dist });
      }
    }
  }

  // Sort by distance (shortest first)
  edges.sort((a, b) => a.dist - b.dist);

  // 2. Build MST using Kruskal's algorithm
  const uf = makeUnionFind(locations.length);
  const mstEdges = [];
  const extraEdges = [];

  for (const edge of edges) {
    if (uf.union(edge.i, edge.j)) {
      mstEdges.push(edge);
    } else if (
      edge.dist < EXTRA_EDGE_MAX_DIST &&
      extraEdges.length < MAX_EXTRA_EDGES
    ) {
      // Important locations get priority for extra connections
      const li = locations[edge.i];
      const lj = locations[edge.j];
      const important =
        li.type === 'capital' || lj.type === 'capital' ||
        li.type === 'city' || lj.type === 'city' ||
        li.type === 'port' || lj.type === 'port';

      if (important || edge.dist < 2000) {
        extraEdges.push(edge);
      }
    }
  }

  const allEdges = [...mstEdges, ...extraEdges];

  // 3. Generate waypoints for each road
  return allEdges.map(edge => {
    const from = locations[edge.i];
    const to = locations[edge.j];
    const pts = generateRoadPath(from.x, from.y, to.x, to.y, edge.dist, noise);

    // Rank: 1 = major (connects capitals/cities), 2 = minor
    const isMajor =
      from.type === 'capital' || to.type === 'capital' ||
      (from.type === 'city' && to.type === 'city');

    return {
      from: from.id,
      to: to.id,
      rank: isMajor ? 1 : 2,
      pts,
    };
  });
}
