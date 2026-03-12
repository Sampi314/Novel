# AI-Assisted Literature Creator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an AI-assisted literature creator modal to the Văn Chương page that generates poems, songs, and prose via Claude API. Poems/prose use 4 sections (原文 → Hán Việt → Trực Dịch → Phân Tích). Songs use 5 sections (adding a Suno Style Prompt) with modern song structure. Songs also support audio upload and inline playback.

**Architecture:** Full-screen modal on LiteraturePage with two phases: core input (type, era, related entities, concept) then AI generation. Shares `claudeApi.js` helper and Vite dev middleware with the Character Creator. Each section is independently editable with AI regeneration. Saves to `literature-index.json` + individual `.md` files via Vite dev middleware. Songs can have uploaded audio (.mp3/.wav) saved alongside the .md file.

**Tech Stack:** React 19, Anthropic Messages API (browser fetch), Vite plugin for dev file writing (text + binary), lightweight markdown renderer (custom, no library), HTML5 Audio API

**Dependencies:** Tasks 1-3 are shared infrastructure with the Character Creator. If Character Creator Tasks 1-3 have already been implemented, skip to Task 4.

---

### Task 1: Claude API Helper (shared with Character Creator)

**Files:**
- Create: `src/utils/claudeApi.js`

**What it does:** A thin wrapper around `fetch` to call the Anthropic Messages API from the browser. Handles API key from localStorage, request formatting, response parsing, and errors. Generic enough for both character and literature generation.

**Step 1: Create the API helper**

```jsx
// src/utils/claudeApi.js

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export function getApiKey() {
  return localStorage.getItem('cng-api-key') || '';
}

export function setApiKey(key) {
  localStorage.setItem('cng-api-key', key);
}

/**
 * Generic Claude API call. Accepts system prompt and user message.
 * Returns parsed JSON from the response text.
 */
export async function callClaude({ systemPrompt, userMessage, maxTokens = 4096 }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Chưa có API key. Vui lòng nhập Anthropic API key.');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  return parseJsonResponse(text);
}

/**
 * Call Claude and return raw text (no JSON parsing).
 * Used for per-section regeneration where output is plain text.
 */
export async function callClaudeText({ systemPrompt, userMessage, maxTokens = 4096 }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Chưa có API key. Vui lòng nhập Anthropic API key.');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

function parseJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Không thể phân tích phản hồi từ AI. Vui lòng thử lại.');
  }
}
```

**Step 2: Commit**

```bash
git add src/utils/claudeApi.js
git commit -m "feat: add Claude API helper for AI-assisted generation"
```

---

### Task 2: Vite Dev Middleware for File Writing (shared with Character Creator)

**Files:**
- Create: `src/utils/devFileWriter.js`
- Modify: `vite.config.js`

**What it does:** A Vite plugin that adds POST endpoints during dev to write files to `public/data/`. Browser helper calls these endpoints. Production fallback: download.

**Step 1: Add Vite middleware plugin to `vite.config.js`**

Add this function before `export default defineConfig(...)`:

```javascript
function devFileWriterPlugin() {
  return {
    name: 'dev-file-writer',
    configureServer(server) {
      server.middlewares.use('/api/write-file', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { filePath, content } = JSON.parse(body);
            const fs = await import('fs');
            const path = await import('path');
            const fullPath = path.default.resolve(process.cwd(), filePath);
            if (!fullPath.startsWith(path.default.resolve(process.cwd(), 'public/data'))) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Can only write to public/data/' }));
              return;
            }
            const dir = path.default.dirname(fullPath);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(fullPath, content, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}
```

Then add `devFileWriterPlugin()` to the `plugins` array:

```javascript
plugins: [
  react(),
  VitePWA({ ... }),
  devFileWriterPlugin(),
],
```

**Step 2: Create browser-side helper**

```jsx
// src/utils/devFileWriter.js

const isDev = import.meta.env.DEV;

export async function writeFile(filePath, content) {
  if (isDev) {
    const res = await fetch('/api/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to write file');
    }
    return;
  }
  // Production fallback: download
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filePath.split('/').pop();
  a.click();
  URL.revokeObjectURL(url);
}
```

**Step 3: Restart dev server and verify**

After modifying `vite.config.js`, the dev server must be restarted. Then test:

```bash
curl -X POST http://localhost:5173/api/write-file \
  -H "Content-Type: application/json" \
  -d '{"filePath":"public/data/test-write.txt","content":"hello"}'
```

Expected: `{"success":true}` and file created at `public/data/test-write.txt`. Delete the test file afterward.

**Step 4: Commit**

```bash
git add src/utils/devFileWriter.js vite.config.js
git commit -m "feat: add Vite dev middleware and helper for file writing"
```

---

### Task 3: Literature Storage Helper

**Files:**
- Create: `src/utils/literatureStorage.js`
- Modify: `public/data/literature-index.json` (populate with existing Phàm Nhân Dao)

**What it does:** Functions to save a literature piece: update `literature-index.json` and write the `.md` file with YAML frontmatter + 4-layer content.

**Step 1: Populate literature-index.json with existing content**

Replace the empty `public/data/literature-index.json` with:

```json
{
  "tho": [
    {
      "id": "tho-001",
      "title": "Phàm Nhân Dao",
      "description": "Dân dao Chiến Loạn Kỷ — lời than phàm nhân",
      "era": "Chiến Loạn Kỷ",
      "file": "/data/Thơ/Chiến Loạn Kỷ/Phàm Nhân Dao.md",
      "relatedCharacters": ["c01", "c07"],
      "relatedEvents": ["e11", "e12"],
      "relatedLocations": ["l19", "l01"],
      "tags": ["thể_thơ/dân_dao", "ngôn_ngữ/hán_văn", "cảm_xúc/bi"]
    }
  ],
  "nhac": [],
  "van": []
}
```

**Step 2: Create the storage helper**

```jsx
// src/utils/literatureStorage.js
import { writeFile } from './devFileWriter.js';

const TYPE_FOLDERS = {
  tho: 'Thơ',
  nhac: 'Nhạc',
  van: 'Văn',
};

export function getNextLiteratureId(type, existingIndex) {
  const items = existingIndex[type] || [];
  const prefix = type; // "tho", "nhac", "van"
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

export function buildMarkdownContent({ title, sections }) {
  // sections = { original, hanViet, translation, analysis }
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
  parts.push('## 析義 Phân Tích & Ý Nghĩa\n');
  parts.push(sections.analysis);
  return parts.join('\n');
}

export async function saveLiterature({ id, type, title, description, era, relatedCharacters, relatedEvents, relatedLocations, tags, sections }) {
  const folder = TYPE_FOLDERS[type];
  const filePath = `public/data/${folder}/${era}/${title}.md`;

  // 1. Build and write .md file
  const frontmatter = buildFrontmatter({ type, title, era, relatedCharacters, relatedEvents, relatedLocations });
  const markdownBody = buildMarkdownContent({ title, sections });
  const fullContent = frontmatter + '\n\n' + markdownBody;
  await writeFile(filePath, fullContent);

  // 2. Update literature-index.json
  const indexRes = await fetch('/data/literature-index.json');
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
  if (!index[type]) index[type] = [];
  index[type].push(entry);
  await writeFile('public/data/literature-index.json', JSON.stringify(index, null, 2) + '\n');

  return { id, filePath };
}
```

**Step 3: Commit**

```bash
git add src/utils/literatureStorage.js public/data/literature-index.json
git commit -m "feat: add literature storage helper and populate index with existing poem"
```

---

### Task 4: LiteratureCreatorModal — Core Input Form

**Files:**
- Create: `src/components/LiteratureCreatorModal.jsx`

**What it does:** The main modal component, Phase 1: type selection (Thơ/Nhạc/Văn), title, era dropdown, multi-select for related entities, concept textarea, and API key settings.

**Step 1: Create the modal component**

```jsx
// src/components/LiteratureCreatorModal.jsx
import React, { useState, useMemo } from 'react';
import { getApiKey, setApiKey } from '../utils/claudeApi.js';

const TYPES = [
  { id: 'tho', vi: 'Thơ', han: '詩' },
  { id: 'nhac', vi: 'Nhạc', han: '樂' },
  { id: 'van', vi: 'Văn', han: '文' },
];

const BASE_SECTIONS = [
  { key: 'original', vi: 'Nguyên Văn', han: '原', desc: 'Classical Chinese original' },
  { key: 'hanViet', vi: 'Hán Việt Âm', han: '漢', desc: 'Sino-Vietnamese reading' },
  { key: 'translation', vi: 'Trực Dịch', han: '直', desc: 'Literal Vietnamese translation' },
];

const STYLE_PROMPT_SECTION = { key: 'stylePrompt', vi: 'Style Prompt', han: '🎹', desc: 'Suno AI generation prompt' };

const ANALYSIS_SECTION = { key: 'analysis', vi: 'Phân Tích', han: '析', desc: 'Analysis & lore connections' };

// Songs get 5 sections (with Style Prompt before Analysis), others get 4
function getSectionLabels(type) {
  if (type === 'nhac') return [...BASE_SECTIONS, STYLE_PROMPT_SECTION, ANALYSIS_SECTION];
  return [...BASE_SECTIONS, ANALYSIS_SECTION];
}
```

**Props:** `{ isOpen, onClose, data, onLiteratureSaved }`

**State:**
- `step`: `'input'` | `'generating'` | `'review'` | `'saving'` | `'done'`
- `apiKeyInput`: string
- `showApiKeySettings`: boolean
- `form`: `{ type: 'tho', title: '', era: '', relatedCharacters: [], relatedEvents: [], relatedLocations: [], concept: '' }`
- `sections`: `{ original: '', hanViet: '', translation: '', stylePrompt: '', analysis: '' }` (stylePrompt only used for songs)
- `error`: string | null
- `regeneratingSection`: string | null (which section is being regenerated)

**Layout (Phase 1 — input):**
- Full-screen fixed overlay (same pattern as character creator)
- Dark backdrop with `backdropFilter: 'blur(12px)'`
- Modal panel: max-width 900px, centered, max-height 90vh, overflowY auto
- Header: "Tạo Tác Phẩm" with 文 watermark, close X button
- API key settings: collapsible section with input + save
- Type selector: 3 tabs (Thơ/Nhạc/Văn) with Hán tự subtitles
- Title input
- Era dropdown: populated from `data.eras` (use `era.name` for display)
- Related entities: 3 multi-select dropdowns (characters, events, locations) — simple implementation: render all options as checkboxes in a scrollable div
- Concept textarea (1-3 sentences)
- Footer: "Tạo bằng AI" gold gradient button

**Inline styles** must use CSS variables: `var(--bg-card)`, `var(--gold)`, `var(--border)`, `var(--gold-glow)`, `var(--text)`, `var(--text-dim)`, `var(--gold-dim)`, `var(--font-body)`, `var(--font-han)`, `var(--bg-input)`, `var(--shadow-gold-strong)`.

If `!isOpen`, return `null`.

**Step 2: Test rendering**

Import modal temporarily in LiteraturePage, render with `isOpen={true}`, verify in browser at `http://localhost:5173` → Văn Chương tab.

**Step 3: Commit**

```bash
git add src/components/LiteratureCreatorModal.jsx
git commit -m "feat: add LiteratureCreatorModal with core input form"
```

---

### Task 5: LiteratureCreatorModal — AI Generation + Review with Per-Section Regeneration

**Files:**
- Modify: `src/components/LiteratureCreatorModal.jsx`

**What it does:** Adds Phase 2 — calls Claude API with type-specific system prompt, renders 4 sections as editable textareas, and adds per-section AI regeneration buttons.

**Step 1: Add system prompt builders**

Add these functions inside the file (before the component):

```jsx
function buildLiteratureSystemPrompt(type) {
  const base = `You are a master writer for Thiên Hoang Đại Lục (天荒大陸), an original xianxia world.

CRITICAL: This world is completely ORIGINAL. Do NOT use cultivation systems, names, or tropes from other novels.

You MUST respond with ONLY valid JSON matching this structure (no markdown, no explanation):
{
  "original": "Classical Chinese text (文言文). For poetry: proper tonal and rhyme rules. For songs: structured with sections. For prose: narrative.",
  "hanViet": "Precise Hán Việt phonetic reading, character by character, preserving Chinese character order. Full Vietnamese diacritics.",
  "translation": "Stanza-by-stanza (or section-by-section) literal Vietnamese translation. Use bold (**) for stanza labels.",
  "analysis": "Poetic form & rhyme scheme, historical context, line-by-line analysis, allusions, metaphors, deeper meaning, lore connections with entity IDs."
}`;

  if (type === 'tho') {
    return base + `\n\nYou are "Thi Tiên" — the poet. Poetry types: 绝句 (quatrain), 律诗 (regulated verse), 词 (ci), 童谣 (nursery rhyme), 碑铭 (inscription), 谶语 (prophecy), 道歌 (cultivation verse), 战诗 (war poetry).
Era style: Thái Sơ=primal, Hỗn Độn=rough/powerful, Linh Nguyên=classical/glorious, Vạn Tộc=refined/diverse, Chiến Loạn=rebellious, Hiện Đại=complex/reflective.`;
  }
  if (type === 'nhac') {
    return base.replace(
      // Override the JSON structure for songs — 5 sections instead of 4
      '"analysis": "',
      '"stylePrompt": "Suno AI prompt. Format: Style: [genre]. Instruments: [list]. Mood: [mood]. Tempo: [BPM]. Vocals: [description]. Tags: [comma-separated tags]",\n  "analysis": "'
    ) + `\n\nYou are "Nhạc Sư" — the musician. Write songs in MODERN SONG STRUCTURE:

REQUIRED STRUCTURE for "original" (Chinese lyrics):
- Use section markers: [Verse 1] [Chorus] [Verse 2] [Chorus] [Bridge] [Outro]
- This is flexible — you can add [Intro], [Pre-Chorus], [Verse 3], etc. as the song needs
- Priority: meaningful lyrics with good melodic flow. The song must have emotional weight.
- 5-7 characters per line works well for Chinese singing
- ALL Chinese lyrics go in "original", ALL Hán Việt in "hanViet", ALL translation in "translation"

For "stylePrompt": Write a complete Suno AI generation prompt. Be SPECIFIC:
- Style: Chinese ancient style / xianxia orchestral / guzheng ballad / etc.
- Instruments: guzheng, erhu, bamboo flute, pipa, drums, etc.
- Mood: melancholic, epic, ethereal, etc.
- Tempo: exact BPM
- Vocals: male/female, register, singing style
- Tags: comma-separated genre tags

Era sound: Thái Sơ=drums/chanting, Hỗn Độn=tribal/wild, Linh Nguyên=grand orchestra, Vạn Tộc=guzheng/flute/erhu, Chiến Loạn=ancient-meets-new, Hiện Đại=fusion.`;
  }
  // van (prose)
  return base + `\n\nYou are "Mặc Khách" — the prose writer. Write narrative prose in classical Chinese style. The "original" field should contain the Chinese text, "hanViet" the reading, "translation" the Vietnamese version, and "analysis" should cover narrative technique, character development, thematic connections, and lore links.`;
}

function buildLiteratureUserMessage(form, data) {
  const eraObj = data.eras?.find(e => e.name === form.era);
  const charNames = form.relatedCharacters.map(id => {
    const c = data.characters?.find(ch => ch.id === id);
    return c ? `${c.name} (${c.han}) — ${c.role}` : id;
  }).join(', ');
  const eventNames = form.relatedEvents.map(id => {
    const e = data.events?.find(ev => ev.id === id);
    return e ? `${e.name} (${e.han})` : id;
  }).join(', ');
  const locationNames = form.relatedLocations.map(id => {
    const l = data.locations?.find(loc => loc.id === id);
    return l ? `${l.name} (${l.han})` : id;
  }).join(', ');

  return `Create a ${form.type === 'tho' ? 'poem' : form.type === 'nhac' ? 'song' : 'prose piece'} for Thiên Hoang Đại Lục:

Title: ${form.title}
Era: ${form.era}${eraObj?.description ? ` — ${eraObj.description}` : ''}
Related Characters: ${charNames || 'none'}
Related Events: ${eventNames || 'none'}
Related Locations: ${locationNames || 'none'}

Concept: ${form.concept}

World factions: ${data.factions?.map(f => `${f.name} (${f.han})`).join(', ') || 'N/A'}

Respond with ONLY the JSON object. No markdown fences, no explanation.`;
}
```

**Step 2: Add generation handler**

```jsx
const handleGenerate = async () => {
  setStep('generating');
  setError(null);
  try {
    const systemPrompt = buildLiteratureSystemPrompt(form.type);
    const userMessage = buildLiteratureUserMessage(form, data);
    const result = await callClaude({ systemPrompt, userMessage, maxTokens: 8192 });
    setSections({
      original: result.original || '',
      hanViet: result.hanViet || '',
      translation: result.translation || '',
      stylePrompt: result.stylePrompt || '', // only populated for songs
      analysis: result.analysis || '',
    });
    setStep('review');
  } catch (err) {
    setError(err.message);
    setStep('input');
  }
};
```

Import `callClaude` and `callClaudeText` from `../utils/claudeApi.js`.

**Step 3: Add generating state UI**

When `step === 'generating'`:
- Centered loading animation
- Large dim 文 character with CSS animation: `@keyframes breathe` (opacity 0.3 → 0.7, scale 0.95 → 1.05)
- "Đang sáng tác..." text in gold italic
- Cancel button (sets step back to 'input')

Use inline styles for the keyframe animation via a `<style>` tag inside the component.

**Step 4: Add review UI with per-section regeneration**

When `step === 'review'`, render 4 sections. Each section:

```jsx
{getSectionLabels(form.type).map(sec => (
  <div key={sec.key} style={{ position: 'relative', marginBottom: 24, padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}>
    {/* Watermark */}
    <div style={{ position: 'absolute', top: 8, right: 16, fontSize: 64, fontFamily: 'var(--font-han)', color: 'var(--gold)', opacity: 0.06 }}>{sec.han}</div>
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--gold)' }}>{sec.vi}</span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>{sec.han}</span>
      </div>
      <button
        onClick={() => handleRegenerateSection(sec.key)}
        disabled={regeneratingSection === sec.key}
        style={{ padding: '4px 12px', fontSize: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--gold-dim)', cursor: 'pointer' }}
      >
        {regeneratingSection === sec.key ? 'Đang tạo lại...' : '↻ Tạo lại'}
      </button>
    </div>
    {/* Editable content */}
    <textarea
      value={sections[sec.key]}
      onChange={e => setSections(prev => ({ ...prev, [sec.key]: e.target.value }))}
      style={{ width: '100%', minHeight: 150, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.8, padding: 12, resize: 'vertical' }}
    />
  </div>
))}
```

**Step 5: Add per-section regeneration handler**

```jsx
const handleRegenerateSection = async (sectionKey) => {
  setRegeneratingSection(sectionKey);
  try {
    const sectionLabel = getSectionLabels(form.type).find(s => s.key === sectionKey);
    const systemPrompt = buildLiteratureSystemPrompt(form.type);
    const userMessage = `I have an existing ${form.type === 'tho' ? 'poem' : form.type === 'nhac' ? 'song' : 'prose piece'} for Thiên Hoang Đại Lục.

Title: ${form.title}
Era: ${form.era}
Concept: ${form.concept}

Current content of all sections:
原文: ${sections.original}
漢越音: ${sections.hanViet}
直譯: ${sections.translation}
析義: ${sections.analysis}

Please REGENERATE ONLY the "${sectionLabel.vi}" (${sectionLabel.han}) section. Keep the same style and tone but create a new version. Return ONLY the new text for this section, no JSON, no markdown fences, no labels.`;

    const newText = await callClaudeText({ systemPrompt, userMessage, maxTokens: 4096 });
    setSections(prev => ({ ...prev, [sectionKey]: newText.trim() }));
  } catch (err) {
    setError(err.message);
  } finally {
    setRegeneratingSection(null);
  }
};
```

**Step 6: Add footer buttons**

In review step, footer has:
- "← Quay lại" button (sets step to 'input', keeps sections)
- "Lưu Tác Phẩm" gold gradient button (triggers save)

**Step 7: Commit**

```bash
git add src/components/LiteratureCreatorModal.jsx
git commit -m "feat: add AI generation, review, and per-section regeneration to literature creator"
```

---

### Task 6: LiteratureCreatorModal — Save Flow

**Files:**
- Modify: `src/components/LiteratureCreatorModal.jsx`

**What it does:** When user clicks "Lưu Tác Phẩm", saves the literature piece to `.md` file + `literature-index.json`, shows success state.

**Step 1: Add save handler**

Import `{ getNextLiteratureId, saveLiterature }` from `../utils/literatureStorage.js`.

```jsx
const handleSave = async () => {
  setStep('saving');
  setError(null);
  try {
    // Fetch current index to determine next ID
    const indexRes = await fetch('/data/literature-index.json');
    const currentIndex = await indexRes.json();
    const newId = getNextLiteratureId(form.type, currentIndex);

    await saveLiterature({
      id: newId,
      type: form.type,
      title: form.title,
      description: form.concept.substring(0, 80),
      era: form.era,
      relatedCharacters: form.relatedCharacters,
      relatedEvents: form.relatedEvents,
      relatedLocations: form.relatedLocations,
      tags: [],
      sections,
    });

    setStep('done');
    if (onLiteratureSaved) onLiteratureSaved(newId);
  } catch (err) {
    setError(err.message);
    setStep('review');
  }
};
```

**Step 2: Add saving + done state UI**

When `step === 'saving'`:
- "Đang lưu..." with gold spinner animation

When `step === 'done'`:
- Success message: "Đã tạo tác phẩm thành công!"
- Title in gold
- "Đóng" button that calls onClose

**Step 3: Commit**

```bash
git add src/components/LiteratureCreatorModal.jsx
git commit -m "feat: add save flow to literature creator modal"
```

---

### Task 7: Improve LiteraturePage — Markdown Rendering + Era Grouping + Metadata

**Files:**
- Modify: `src/pages/LiteraturePage.jsx`

**What it does:** Upgrade the page to render `.md` content as formatted HTML (not raw text), group items by era, show metadata chips, and add the "Tạo Tác Phẩm" button.

**Step 1: Add lightweight markdown renderer**

Add a function inside `LiteraturePage.jsx` (no external library):

```jsx
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    // Code blocks (``` ... ```)
    .replace(/```([\s\S]*?)```/g, '<pre style="background:var(--bg-input);padding:16px;border-radius:6px;overflow-x:auto;font-family:var(--font-han);font-size:14px;line-height:1.8;color:var(--text)">$1</pre>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4 style="color:var(--gold);margin:16px 0 8px;font-size:14px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:var(--gold);margin:20px 0 10px;font-size:16px;border-bottom:1px solid var(--border);padding-bottom:6px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="color:var(--gold);font-size:20px;margin-bottom:12px">$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--gold)">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:16px 0" />')
    // Lists
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;margin-bottom:4px">$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p style="margin:8px 0">')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br/>');

  return '<p style="margin:8px 0">' + html + '</p>';
}
```

**Step 2: Replace raw text display with rendered markdown**

In the content area where `activeItem === item.id`, replace:
```jsx
{loadingContent ? 'Đang tải...' : content}
```
with:
```jsx
{loadingContent ? 'Đang tải...' : (
  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
)}
```

Also strip YAML frontmatter before rendering:
```jsx
// In loadContent function, after fetching text:
const stripped = text.replace(/^---[\s\S]*?---\s*/, '');
setContent(stripped);
```

**Step 3: Add era grouping**

Replace the flat `items.map(...)` with grouped rendering:

```jsx
const groupedByEra = useMemo(() => {
  const groups = {};
  items.forEach(item => {
    const era = item.era || 'Khác';
    if (!groups[era]) groups[era] = [];
    groups[era].push(item);
  });
  return groups;
}, [items]);
```

Render as:
```jsx
{Object.keys(groupedByEra).length === 0 ? (
  <div style={s.empty}>...</div>
) : (
  Object.entries(groupedByEra).map(([era, eraItems]) => (
    <div key={era} style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 14, color: 'var(--gold)', fontWeight: 600, marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
        {era}
      </div>
      <div style={s.itemList}>
        {eraItems.map((item, i) => (
          // existing item card code
        ))}
      </div>
    </div>
  ))
)}
```

Add `import { useMemo } from 'react'` to the existing imports.

**Step 4: Add metadata chips**

Below the item title, show related entities as small chips:

```jsx
{item.relatedCharacters?.length > 0 && (
  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
    {item.relatedCharacters.map(id => {
      const c = data?.characters?.find(ch => ch.id === id);
      return <span key={id} style={{ fontSize: 10, padding: '2px 6px', background: 'var(--gold-glow)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--gold-dim)' }}>{c?.name || id}</span>;
    })}
  </div>
)}
```

Similarly for `relatedEvents` and `relatedLocations`.

**Step 5: Commit**

```bash
git add src/pages/LiteraturePage.jsx
git commit -m "feat: add markdown rendering, era grouping, and metadata to Literature page"
```

---

### Task 8: Wire Modal into LiteraturePage

**Files:**
- Modify: `src/pages/LiteraturePage.jsx`

**What it does:** Adds the "Tạo Tác Phẩm" button and renders the LiteratureCreatorModal.

**Step 1: Add imports and state**

```jsx
import LiteratureCreatorModal from '../components/LiteratureCreatorModal';
// ... in component:
const [showCreator, setShowCreator] = useState(false);
```

**Step 2: Add "Tạo Tác Phẩm" button**

After the `<PageHeader>` and before the tabs:

```jsx
<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
  <button
    onClick={() => setShowCreator(true)}
    style={{
      padding: '10px 24px',
      background: 'linear-gradient(135deg, var(--gold-dim), var(--gold))',
      color: 'var(--bg)',
      border: 'none',
      borderRadius: 6,
      fontFamily: 'var(--font-body)',
      fontSize: 15,
      fontWeight: 600,
      cursor: 'pointer',
      letterSpacing: 1,
      transition: 'box-shadow 0.3s',
    }}
    onMouseEnter={e => e.target.style.boxShadow = 'var(--shadow-gold-strong)'}
    onMouseLeave={e => e.target.style.boxShadow = 'none'}
  >
    + Tạo Tác Phẩm
  </button>
</div>
```

**Step 3: Add modal render**

Before the closing `</div>` of the page:

```jsx
<LiteratureCreatorModal
  isOpen={showCreator}
  onClose={() => setShowCreator(false)}
  data={data}
  onLiteratureSaved={() => {
    setShowCreator(false);
    // Re-fetch index to show new item
    fetch('/data/literature-index.json')
      .then(r => r.json())
      .then(setIndex)
      .catch(() => {});
  }}
/>
```

**Step 4: Test end-to-end**

1. Run `npm run dev`, navigate to Văn Chương tab
2. Verify Phàm Nhân Dao shows in Thơ tab under "Chiến Loạn Kỷ" era group
3. Click it — content renders with markdown formatting (headers, code blocks, bold)
4. Click "Tạo Tác Phẩm" — modal opens
5. Fill in fields, enter API key, click "Tạo bằng AI"
6. AI generates 4 sections — review, edit, regenerate a section
7. Click "Lưu Tác Phẩm" — saves, modal closes, new item appears in list

**Step 5: Commit**

```bash
git add src/pages/LiteraturePage.jsx
git commit -m "feat: wire literature creator modal into LiteraturePage"
```

---

### Task 9: Audio Upload & Playback for Songs

**Files:**
- Create: `src/components/AudioPlayer.jsx`
- Modify: `src/pages/LiteraturePage.jsx` (add audio upload + player)
- Modify: `src/utils/devFileWriter.js` (add binary upload support)
- Modify: `vite.config.js` (extend middleware for binary uploads)

**What it does:** Songs (Nhạc) can have audio uploaded. The user generates a song with Suno using the Style Prompt, then uploads the resulting .mp3/.wav. The audio is saved alongside the .md file and plays inline when viewing the song.

**Step 1: Extend Vite middleware for binary file uploads**

In `vite.config.js`, add a second middleware route for binary uploads:

```javascript
// Add inside configureServer, after the /api/write-file middleware
server.middlewares.use('/api/upload-audio', async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }
  const chunks = [];
  req.on('data', chunk => { chunks.push(chunk); });
  req.on('end', async () => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = req.headers['x-file-path'];
      if (!filePath) throw new Error('Missing x-file-path header');
      const fullPath = path.default.resolve(process.cwd(), filePath);
      if (!fullPath.startsWith(path.default.resolve(process.cwd(), 'public/data'))) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: 'Can only write to public/data/' }));
        return;
      }
      const dir = path.default.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, Buffer.concat(chunks));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});
```

**Step 2: Add uploadAudio to devFileWriter.js**

```jsx
export async function uploadAudio(filePath, file) {
  if (isDev) {
    const arrayBuffer = await file.arrayBuffer();
    const res = await fetch('/api/upload-audio', {
      method: 'POST',
      headers: { 'x-file-path': filePath },
      body: arrayBuffer,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload audio');
    }
    return;
  }
  throw new Error('Audio upload not available in production mode');
}
```

**Step 3: Create AudioPlayer component**

```jsx
// src/components/AudioPlayer.jsx
import React, { useRef, useState, useEffect } from 'react';

export default function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => setPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const toggle = () => {
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 12 }}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--gold)', background: 'var(--gold-glow)', color: 'var(--gold)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {playing ? '⏸' : '▶'}
      </button>
      <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 36 }}>{fmt(progress)}</span>
      <div onClick={seek} style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, cursor: 'pointer', position: 'relative' }}>
        <div style={{ width: `${duration ? (progress / duration) * 100 : 0}%`, height: '100%', background: 'var(--gold)', borderRadius: 3, transition: 'width 0.1s' }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 36 }}>{fmt(duration)}</span>
    </div>
  );
}
```

**Step 4: Add audio upload + playback to LiteraturePage**

In the song item's expanded content area, add:

```jsx
{/* Audio player — show if song has audio */}
{activeCategory === 'nhac' && item.audioFile && (
  <AudioPlayer src={item.audioFile} />
)}

{/* Audio upload — show if song has NO audio */}
{activeCategory === 'nhac' && !item.audioFile && (
  <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--bg-input)', border: '1px dashed var(--border)', borderRadius: 8, textAlign: 'center' }}>
    <label style={{ cursor: 'pointer', color: 'var(--gold-dim)', fontSize: 13 }}>
      🎵 Tải lên bản nhạc (.mp3, .wav)
      <input
        type="file"
        accept=".mp3,.wav,.m4a"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            const ext = file.name.split('.').pop();
            const audioPath = item.file.replace('.md', '.' + ext);
            await uploadAudio('public' + audioPath, file);
            // Update index with audio path
            const idxRes = await fetch('/data/literature-index.json');
            const idx = await idxRes.json();
            const entry = idx.nhac?.find(n => n.id === item.id);
            if (entry) {
              entry.audioFile = audioPath;
              await writeFile('public/data/literature-index.json', JSON.stringify(idx, null, 2) + '\n');
              // Re-fetch index
              fetch('/data/literature-index.json').then(r => r.json()).then(setIndex);
            }
          } catch (err) {
            console.error('Audio upload failed:', err);
          }
        }}
      />
    </label>
  </div>
)}
```

Import at top:
```jsx
import AudioPlayer from '../components/AudioPlayer';
import { uploadAudio } from '../utils/devFileWriter';
import { writeFile } from '../utils/devFileWriter';
```

**Step 5: Commit**

```bash
git add src/components/AudioPlayer.jsx src/pages/LiteraturePage.jsx src/utils/devFileWriter.js vite.config.js
git commit -m "feat: add audio upload and playback for songs"
```

---

## Task Order & Dependencies

```
Task 1 (Claude API helper) ──────┐
Task 2 (Vite dev middleware) ─────┤
Task 3 (Literature storage) ──────┤
                                   ├── Task 4 (Modal core form)
                                   │     │
                                   │     └── Task 5 (AI generation + review + regeneration)
                                   │           │
                                   │           └── Task 6 (Save flow)
                                   │                 │
                                   │                 └── Task 7 (Page improvements)
                                   │                       │
                                   │                       ├── Task 8 (Wire modal)
                                   │                       │
                                   │                       └── Task 9 (Audio upload + playback)
```

Tasks 1, 2, 3 are independent and can run in parallel.
Tasks 4-6 are sequential (modal build).
Tasks 7-9 are sequential (page improvements → wiring → audio).
Tasks 8 and 9 can run in parallel after Task 7.

## Verification Checklist

After all tasks:
1. Open http://localhost:5173, go to Văn Chương tab
2. Phàm Nhân Dao shows under "Chiến Loạn Kỷ" era group in Thơ tab
3. Click Phàm Nhân Dao — content renders with proper markdown (headers, code blocks, bold)
4. Metadata chips show related characters/events below title
5. Click "Tạo Tác Phẩm" — modal opens with xianxia styling
6. API key settings works (saves to localStorage, persists)
7. Type tabs (Thơ/Nhạc/Văn) switch correctly
8. Era dropdown populated from data, multi-selects work
9. Click "Tạo bằng AI" — loading animation shows
10. **For Thơ/Văn:** AI generates 4 sections with Vietnamese content
11. **For Nhạc:** AI generates 5 sections (including Style Prompt for Suno)
12. **Nhạc song structure:** Chinese original uses modern song format ([Verse 1] [Chorus] [Bridge] etc.)
13. Each section is editable (textarea)
14. "↻ Tạo lại" button regenerates a single section
15. Click "Lưu Tác Phẩm" — success
16. New item appears in literature list under correct era
17. Check `public/data/literature-index.json` — new entry added
18. Check `.md` file — exists with frontmatter + all layers
19. **For Nhạc:** "Tải lên bản nhạc" upload area appears when viewing a song without audio
20. Upload a .mp3 — file saves, audio player appears
21. Audio player works: play/pause, progress bar, seek, time display
22. Refresh page — audio player still loads for that song
