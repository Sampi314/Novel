import { writeFile } from './devFileWriter.js';
import * as d3 from 'd3';

export function getNextEventId(existingEvents) {
  const nums = existingEvents
    .map(e => parseInt(e.id?.replace('e', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `e${String(next).padStart(2, '0')}`;
}

export async function saveEvent({
  id, year, type, name, han, location_id, x, y, factions, description,
}) {
  const csvRes = await fetch(import.meta.env.BASE_URL + 'data/events.csv');
  const csvText = await csvRes.text();
  const rows = d3.csvParse(csvText);

  const existing = rows.findIndex(r => r.id === id);
  const factionsStr = Array.isArray(factions) ? factions.join('|') : (factions || '');
  const newRow = {
    id, year: String(year ?? ''), type: type || '',
    name, han: han || '',
    location_id: location_id || '',
    x: String(x ?? ''), y: String(y ?? ''),
    factions: factionsStr,
    description: description || '',
  };

  if (existing >= 0) {
    rows[existing] = newRow;
  } else {
    rows.push(newRow);
  }

  const header = 'id,year,type,name,han,location_id,x,y,factions,description';
  const lines = rows.map(r =>
    [r.id, r.year, r.type, r.name, r.han, r.location_id, r.x, r.y, r.factions, r.description].join(',')
  );
  const newCsv = header + '\n' + lines.join('\n') + '\n';
  await writeFile('public/data/events.csv', newCsv);
  return id;
}

export async function deleteEvent(id) {
  const csvRes = await fetch(import.meta.env.BASE_URL + 'data/events.csv');
  const csvText = await csvRes.text();
  const rows = d3.csvParse(csvText).filter(r => r.id !== id);

  const header = 'id,year,type,name,han,location_id,x,y,factions,description';
  const lines = rows.map(r =>
    [r.id, r.year, r.type, r.name, r.han, r.location_id, r.x, r.y, r.factions, r.description].join(',')
  );
  const newCsv = header + '\n' + lines.join('\n') + '\n';
  await writeFile('public/data/events.csv', newCsv);
  return id;
}
