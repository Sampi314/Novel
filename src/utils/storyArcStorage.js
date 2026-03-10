import { writeFile } from './devFileWriter.js';
import * as d3 from 'd3';

export function getNextStoryArcId(existingArcs) {
  const nums = existingArcs
    .map(a => parseInt(a.id?.replace('sa', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `sa${String(next).padStart(2, '0')}`;
}

export async function saveStoryArc({
  id, name, han, description, events, characters, era_start, era_end, color,
}) {
  const csvRes = await fetch(import.meta.env.BASE_URL + 'data/story_arcs.csv');
  const csvText = await csvRes.text();
  const rows = d3.csvParse(csvText);

  const existing = rows.findIndex(r => r.id === id);
  const eventsStr = Array.isArray(events) ? events.join('|') : (events || '');
  const charsStr = Array.isArray(characters) ? characters.join('|') : (characters || '');
  const newRow = {
    id, name, han: han || '',
    description: description || '',
    events: eventsStr,
    characters: charsStr,
    era_start: String(era_start ?? ''),
    era_end: era_end != null && era_end !== '' ? String(era_end) : '',
    color: color || '#c4a35a',
  };

  if (existing >= 0) {
    rows[existing] = newRow;
  } else {
    rows.push(newRow);
  }

  const header = 'id,name,han,description,events,characters,era_start,era_end,color';
  const lines = rows.map(r =>
    [r.id, r.name, r.han, r.description, r.events, r.characters, r.era_start, r.era_end, r.color].join(',')
  );
  const newCsv = header + '\n' + lines.join('\n') + '\n';
  await writeFile('public/data/story_arcs.csv', newCsv);
  return id;
}

export async function deleteStoryArc(id) {
  const csvRes = await fetch(import.meta.env.BASE_URL + 'data/story_arcs.csv');
  const csvText = await csvRes.text();
  const rows = d3.csvParse(csvText).filter(r => r.id !== id);

  const header = 'id,name,han,description,events,characters,era_start,era_end,color';
  const lines = rows.map(r =>
    [r.id, r.name, r.han, r.description, r.events, r.characters, r.era_start, r.era_end, r.color].join(',')
  );
  const newCsv = header + '\n' + lines.join('\n') + '\n';
  await writeFile('public/data/story_arcs.csv', newCsv);
  return id;
}
