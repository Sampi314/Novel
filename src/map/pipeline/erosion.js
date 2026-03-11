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

      const { gradX, gradY, height } = gradient(heightmap, posX, posY);

      dirX = dirX * inertia - gradX * (1 - inertia);
      dirY = dirY * inertia - gradY * (1 - inertia);

      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len < 0.0001) {
        const angle = rand() * Math.PI * 2;
        dirX = Math.cos(angle);
        dirY = Math.sin(angle);
      } else {
        dirX /= len;
        dirY /= len;
      }

      const newX = posX + dirX;
      const newY = posY + dirY;

      if (newX < 1 || newX >= GRID - 1 || newY < 1 || newY >= GRID - 1) break;

      const newHeight = sampleHeight(heightmap, newX, newY);
      const heightDiff = newHeight - height;

      const cap = Math.max(-heightDiff * speed * water * capacity, 0.01);

      if (sediment > cap || heightDiff > 0) {
        const amount = heightDiff > 0
          ? Math.min(heightDiff, sediment)
          : (sediment - cap) * deposition;
        sediment -= amount;
        deposit(heightmap, posX, posY, amount, dropRadius);
      } else {
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
