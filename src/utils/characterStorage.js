import { writeFile } from './devFileWriter.js';
import * as d3 from 'd3';

export function getNextCharacterId(existingCharacters) {
  const nums = existingCharacters
    .map(c => parseInt(c.id?.replace('c', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `c${String(next).padStart(2, '0')}`;
}

export function buildCharacterBioMarkdown({ name, han, faction, role, appearance, backstory, abilities, personality }) {
  let md = `---
name: ${name}
han: ${han}
---

# ${name} (${han})

## Vai trò
${role}

## Thế lực
${faction}
`;
  if (appearance) md += `\n## Ngoại hình\n${appearance}\n`;
  md += `\n## Tính cách\n${personality}\n\n## Năng lực\n${abilities}\n\n## Tiểu sử\n${backstory}\n`;
  return md;
}

export async function deleteCharacter(id) {
  const csvRes = await fetch(import.meta.env.BASE_URL + 'data/characters.csv');
  const csvText = await csvRes.text();
  const rows = d3.csvParse(csvText).filter(r => r.id !== id);

  const header = 'id,name,han,faction,role,qi_affinity,power,era_start,era_end,location_id,journey';
  const lines = rows.map(r =>
    [r.id, r.name, r.han, r.faction, r.role, r.qi_affinity, r.power, r.era_start, r.era_end, r.location_id, r.journey].join(',')
  );
  const newCsv = header + '\n' + lines.join('\n') + '\n';
  await writeFile('public/data/characters.csv', newCsv);
  return id;
}

export async function saveCharacter({
  id, name, han, faction, role, qi_affinity, power,
  era_start, era_end, location_id, journey,
  appearance, backstory, abilities, personality,
}) {
  // Read current CSV
  const csvRes = await fetch(import.meta.env.BASE_URL + 'data/characters.csv');
  const csvText = await csvRes.text();
  const rows = d3.csvParse(csvText);

  // Check if already exists
  const existing = rows.findIndex(r => r.id === id);
  const newRow = {
    id, name, han, faction, role, qi_affinity,
    power: String(power),
    era_start: String(era_start),
    era_end: era_end != null ? String(era_end) : '',
    location_id: location_id || '',
    journey: Array.isArray(journey) ? journey.join('|') : (journey || ''),
  };

  if (existing >= 0) {
    rows[existing] = newRow;
  } else {
    rows.push(newRow);
  }

  // Rebuild CSV
  const header = 'id,name,han,faction,role,qi_affinity,power,era_start,era_end,location_id,journey';
  const lines = rows.map(r =>
    [r.id, r.name, r.han, r.faction, r.role, r.qi_affinity, r.power, r.era_start, r.era_end, r.location_id, r.journey].join(',')
  );
  const newCsv = header + '\n' + lines.join('\n') + '\n';
  await writeFile('public/data/characters.csv', newCsv);

  // Save biography markdown
  if (appearance || backstory || abilities || personality) {
    const factionName = faction || '';
    const md = buildCharacterBioMarkdown({ name, han, faction: factionName, role, appearance, backstory, abilities, personality });
    await writeFile(`public/data/characters/${id}.md`, md);
  }

  return id;
}
