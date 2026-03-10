import { writeFile } from './devFileWriter.js';

export function getNextFaunaId(existingFauna) {
  const nums = existingFauna
    .map(f => parseInt(f.id?.replace('beast', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `beast${String(next).padStart(2, '0')}`;
}

export async function saveFauna({ id, name, han, biome, danger, icon, description, era_start, era_end }, currentWorldData) {
  const world = { ...currentWorldData };
  const fauna = [...(world.fauna || [])];
  const existing = fauna.findIndex(f => f.id === id);

  const entry = {
    id, name, han, biome,
    danger: Number(danger) || 1,
    icon: icon || 'beast',
    description: description || '',
    era_start: era_start != null ? Number(era_start) : 0,
    era_end: era_end != null && era_end !== '' ? Number(era_end) : null,
  };

  if (existing >= 0) {
    fauna[existing] = entry;
  } else {
    fauna.push(entry);
  }

  world.fauna = fauna;
  await writeFile('public/data/world.json', JSON.stringify(world, null, 2) + '\n');
  return id;
}

export async function deleteFauna(id, currentWorldData) {
  const world = { ...currentWorldData };
  world.fauna = (world.fauna || []).filter(f => f.id !== id);
  await writeFile('public/data/world.json', JSON.stringify(world, null, 2) + '\n');
  return id;
}
