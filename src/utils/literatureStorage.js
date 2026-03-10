import { writeFile } from './devFileWriter.js';

const TYPE_FOLDERS = {
  tho: 'Thơ',
  nhac: 'Nhạc',
  van: 'Văn',
};

export function getNextLiteratureId(type, existingIndex) {
  const items = existingIndex[type] || [];
  const prefix = type;
  const maxNum = items.reduce((max, item) => {
    const num = parseInt(item.id?.replace(`${prefix}-`, ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

export function buildFrontmatter({ type, title, era, relatedCharacters, relatedEvents, relatedLocations }) {
  const tags = [`loại/${type === 'tho' ? 'thơ' : type === 'nhac' ? 'nhạc' : 'văn'}`, `kỷ/${era.toLowerCase().replace(/ /g, '_')}`];
  const lines = [
    '---',
    `tags:`,
    ...tags.map(t => `  - ${t}`),
    `kỷ_nguyên: ${era}`,
    `thể_loại: ${type === 'tho' ? 'thơ' : type === 'nhac' ? 'nhạc' : 'văn_xuôi'}`,
  ];
  if (relatedEvents?.length) lines.push(`sự_kiện_liên_quan: ${relatedEvents.join(', ')}`);
  if (relatedLocations?.length) lines.push(`địa_điểm_liên_quan: ${relatedLocations.join(', ')}`);
  if (relatedCharacters?.length) lines.push(`nhân_vật_liên_quan: ${relatedCharacters.join(', ')}`);
  lines.push(`trạng_thái: hoàn_thành`);
  lines.push('---');
  return lines.join('\n');
}

export function buildMarkdownContent({ title, sections, type }) {
  const parts = [];
  parts.push(`# ${title}\n`);
  parts.push('---\n');
  parts.push('## 原文 Nguyên Văn\n');
  parts.push('```');
  parts.push(sections.original);
  parts.push('```\n');
  parts.push('---\n');
  parts.push('## 漢越音 Hán Việt Âm\n');
  parts.push('```');
  parts.push(sections.hanViet);
  parts.push('```\n');
  parts.push('---\n');
  parts.push('## 直譯 Trực Dịch\n');
  parts.push(sections.translation);
  parts.push('\n---\n');

  if (type === 'nhac' && sections.stylePrompt) {
    parts.push('## 🎹 Style Prompt\n');
    parts.push('```');
    parts.push(sections.stylePrompt);
    parts.push('```\n');
    parts.push('---\n');
  }

  parts.push('## 析義 Phân Tích & Ý Nghĩa\n');
  parts.push(sections.analysis);
  return parts.join('\n');
}

export async function saveLiterature({ id, type, title, description, era, relatedCharacters, relatedEvents, relatedLocations, tags, sections }) {
  const folder = TYPE_FOLDERS[type];
  const filePath = `public/data/${folder}/${era}/${title}.md`;

  const frontmatter = buildFrontmatter({ type, title, era, relatedCharacters, relatedEvents, relatedLocations });
  const markdownBody = buildMarkdownContent({ title, sections, type });
  const fullContent = frontmatter + '\n\n' + markdownBody;
  await writeFile(filePath, fullContent);

  const indexRes = await fetch(import.meta.env.BASE_URL + 'data/literature-index.json');
  const index = await indexRes.json();
  const entry = {
    id,
    title,
    description: description || '',
    era,
    file: `/data/${folder}/${era}/${title}.md`,
    relatedCharacters: relatedCharacters || [],
    relatedEvents: relatedEvents || [],
    relatedLocations: relatedLocations || [],
    tags: tags || [],
  };
  if (type === 'nhac' && sections.audioFile) {
    entry.audioFile = sections.audioFile;
  }
  if (!index[type]) index[type] = [];
  index[type].push(entry);
  await writeFile('public/data/literature-index.json', JSON.stringify(index, null, 2) + '\n');

  return { id, filePath };
}

export async function deleteLiterature(id, type) {
  const indexRes = await fetch(import.meta.env.BASE_URL + 'data/literature-index.json');
  const index = await indexRes.json();
  if (index[type]) {
    index[type] = index[type].filter(item => item.id !== id);
  }
  await writeFile('public/data/literature-index.json', JSON.stringify(index, null, 2) + '\n');
  return id;
}

export async function updateLiterature({ id, type, title, description, era, relatedCharacters, relatedEvents, relatedLocations, tags, sections }) {
  const indexRes = await fetch(import.meta.env.BASE_URL + 'data/literature-index.json');
  const index = await indexRes.json();
  const items = index[type] || [];
  const idx = items.findIndex(item => item.id === id);
  if (idx < 0) throw new Error('Không tìm thấy tác phẩm');

  const oldEntry = items[idx];
  const folder = TYPE_FOLDERS[type];
  const filePath = `public/data/${folder}/${era}/${title}.md`;

  const entry = {
    ...oldEntry,
    title,
    description: description || '',
    era,
    file: `/data/${folder}/${era}/${title}.md`,
    relatedCharacters: relatedCharacters || [],
    relatedEvents: relatedEvents || [],
    relatedLocations: relatedLocations || [],
    tags: tags || [],
  };
  if (type === 'nhac' && sections?.audioFile) {
    entry.audioFile = sections.audioFile;
  }
  items[idx] = entry;
  index[type] = items;
  await writeFile('public/data/literature-index.json', JSON.stringify(index, null, 2) + '\n');

  if (sections) {
    const frontmatter = buildFrontmatter({ type, title, era, relatedCharacters, relatedEvents, relatedLocations });
    const markdownBody = buildMarkdownContent({ title, sections, type });
    const fullContent = frontmatter + '\n\n' + markdownBody;
    await writeFile(filePath, fullContent);
  }

  return { id, filePath };
}
