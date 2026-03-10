import { writeFile } from './devFileWriter.js';
import * as d3 from 'd3';

export function getNextLocationId(existingLocations) {
  const nums = existingLocations
    .map(l => parseInt(l.id?.replace('loc', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `loc${String(next).padStart(2, '0')}`;
}

export async function saveLocation({
  id, name, han, type, x, y, era_founded, era_destroyed, race, qi, power, population, description,
}) {
  const csvRes = await fetch(import.meta.env.BASE_URL + 'data/locations.csv');
  const csvText = await csvRes.text();
  const rows = d3.csvParse(csvText);

  const existing = rows.findIndex(r => r.id === id);
  const newRow = {
    id, name, han: han || '', type: type || '',
    x: String(x ?? ''), y: String(y ?? ''),
    era_founded: String(era_founded ?? ''), era_destroyed: String(era_destroyed ?? ''),
    race: race || '', qi: qi || '',
    power: String(power ?? ''), population: String(population ?? ''),
    description: description || '',
  };

  if (existing >= 0) {
    rows[existing] = newRow;
  } else {
    rows.push(newRow);
  }

  const header = 'id,name,han,type,x,y,era_founded,era_destroyed,race,qi,power,population,description';
  const lines = rows.map(r =>
    [r.id, r.name, r.han, r.type, r.x, r.y, r.era_founded, r.era_destroyed, r.race, r.qi, r.power, r.population, r.description].join(',')
  );
  const newCsv = header + '\n' + lines.join('\n') + '\n';
  await writeFile('public/data/locations.csv', newCsv);
  return id;
}

export async function deleteLocation(id) {
  const csvRes = await fetch(import.meta.env.BASE_URL + 'data/locations.csv');
  const csvText = await csvRes.text();
  const rows = d3.csvParse(csvText).filter(r => r.id !== id);

  const header = 'id,name,han,type,x,y,era_founded,era_destroyed,race,qi,power,population,description';
  const lines = rows.map(r =>
    [r.id, r.name, r.han, r.type, r.x, r.y, r.era_founded, r.era_destroyed, r.race, r.qi, r.power, r.population, r.description].join(',')
  );
  const newCsv = header + '\n' + lines.join('\n') + '\n';
  await writeFile('public/data/locations.csv', newCsv);
  return id;
}
