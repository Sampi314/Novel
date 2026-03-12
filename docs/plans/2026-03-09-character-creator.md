# AI-Assisted Character Creator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an AI-assisted character creator modal to the Nhân Vật page that generates full character profiles via Claude API and saves to CSV + JSON files.

**Architecture:** Full-screen modal on CharactersPage with two phases: core input form + AI generation. Browser-side Claude API calls with user-provided API key. Vite dev middleware for file writing. All styling uses inline styles with CSS variables matching the existing xianxia theme.

**Tech Stack:** React 19, Anthropic Messages API (browser fetch), Vite plugin for dev file writing, d3 for CSV parsing

---

### Task 1: Claude API Helper

**Files:**
- Create: `src/utils/claudeApi.js`

**What it does:** A thin wrapper around `fetch` to call the Anthropic Messages API from the browser. Handles API key from localStorage, request formatting, response parsing, and errors.

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

export async function generateCharacterProfile({ coreFields, worldContext }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Chưa có API key. Vui lòng nhập Anthropic API key.');

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(coreFields, worldContext);

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
      max_tokens: 4096,
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
  return parseCharacterResponse(text);
}

function buildSystemPrompt() {
  return `You are "Tạo Nhân" — the character designer for Thiên Hoang Đại Lục (天荒大陸), an original xianxia world.

CRITICAL: This world is completely ORIGINAL. Do NOT use standard xianxia clichés, "young master" archetypes, or generic cultivation tropes.

Core Philosophy:
- The best character makes readers LOVE and HATE them simultaneously
- Every character is the protagonist of their own story
- Internal conflict creates depth: "wants A BUT also wants B — and A, B cannot coexist"

You MUST respond with ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "appearance": {
    "firstImpression": "one sentence - what others think on first sight",
    "distinctiveFeatures": "1-2 DISTINCTIVE features, not a face checklist",
    "bodyLanguage": "how they move, posture"
  },
  "personality": {
    "surface": "what they show the world",
    "true": "who they really are",
    "dark": "their shadow self",
    "coreValues": ["value1 (would die for)", "value2", "value3"],
    "coreConflict": "[Wants A] BUT [also wants B] — incompatible",
    "deepestFear": "not death — what they TRULY fear",
    "deepestDesire": "not power — what they TRULY want",
    "secret": "what they never tell anyone",
    "quirks": "habits, catchphrases"
  },
  "voice": {
    "style": "vocabulary, sentence style, tone",
    "lines": {
      "normal": "example dialogue in normal mood",
      "angry": "example dialogue when angry",
      "sad": "example dialogue when sad",
      "combat": "example dialogue in combat"
    },
    "speechTo": {
      "superiors": "how they address superiors",
      "subordinates": "how they address subordinates",
      "enemies": "how they address enemies",
      "loved": "how they address loved ones"
    }
  },
  "history": {
    "childhood": "event that shaped personality",
    "turningPoint": "event that changed their life",
    "pastSecret": "secret from their past"
  },
  "arc": {
    "startingState": "who they are at the beginning",
    "falseBelief": "what they wrongly believe",
    "journey": "what transforms them",
    "endState": "who they become",
    "type": "Positive/Negative/Flat/Tragic",
    "priceOfChange": "what they lose to grow"
  }
}

Write ALL content in Vietnamese. Names in Hán Việt style.`;
}

function buildUserMessage(coreFields, worldContext) {
  const { name, han, faction, role, qiAffinity, power, eraStart, eraEnd, location, concept } = coreFields;
  return `Create a full character profile for:

Name: ${name} (${han})
Faction: ${faction}
Role: ${role}
Qi Affinity: ${qiAffinity}
Power Level: ${power}/5
Era: ${eraStart}${eraEnd ? ' — ' + eraEnd : ' — nay'}
Location: ${location}

Character concept: ${concept}

World context:
${worldContext}

Respond with ONLY the JSON object. No markdown fences, no explanation.`;
}

function parseCharacterResponse(text) {
  // Strip markdown fences if present
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

**Step 2: Verify file is valid JS**

Run: `cd "/Users/sampi_wu/Downloads/Claude Code" && node -e "import('./src/utils/claudeApi.js')" 2>&1 || echo "Check syntax"`

**Step 3: Commit**

```bash
git add src/utils/claudeApi.js
git commit -m "feat: add Claude API helper for character generation"
```

---

### Task 2: Vite Dev Middleware for File Writing

**Files:**
- Create: `src/utils/devFileWriter.js` (browser-side helper)
- Modify: `vite.config.js` (add middleware plugin)

**What it does:** A Vite plugin that adds POST endpoints during dev to write files. The browser helper calls these endpoints. In production (no dev server), falls back to download.

**Step 1: Add Vite middleware plugin to vite.config.js**

Add this plugin to the `plugins` array in `vite.config.js`:

```javascript
// Add to plugins array in vite.config.js, after react() and VitePWA()
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
            const { filePath, content, append } = JSON.parse(body);
            const fs = await import('fs');
            const path = await import('path');
            const fullPath = path.default.resolve(process.cwd(), filePath);
            // Security: only allow writing to public/data/
            if (!fullPath.startsWith(path.default.resolve(process.cwd(), 'public/data'))) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Can only write to public/data/' }));
              return;
            }
            // Ensure directory exists
            const dir = path.default.dirname(fullPath);
            fs.mkdirSync(dir, { recursive: true });
            if (append) {
              fs.appendFileSync(fullPath, content);
            } else {
              fs.writeFileSync(fullPath, content);
            }
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

Add `devFileWriterPlugin()` to the plugins array.

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
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filePath.split('/').pop();
  a.click();
  URL.revokeObjectURL(url);
}

export async function appendFile(filePath, content) {
  if (isDev) {
    const res = await fetch('/api/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content, append: true }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to append file');
    }
    return;
  }
  // Production: not supported, show message
  throw new Error('File writing not available in production mode');
}
```

**Step 3: Verify dev server still starts**

Run: `cd "/Users/sampi_wu/Downloads/Claude Code" && npx vite --port 5999 &` then `curl -X POST http://localhost:5999/api/write-file -H "Content-Type: application/json" -d '{"filePath":"public/data/characters/.gitkeep","content":""}' 2>&1` then kill the server.

**Step 4: Commit**

```bash
git add src/utils/devFileWriter.js vite.config.js
git commit -m "feat: add Vite dev middleware for writing character files"
```

---

### Task 3: Character Storage Helpers

**Files:**
- Create: `src/utils/characterStorage.js`
- Create: `public/data/characters/.gitkeep` (empty directory)

**What it does:** Functions to save a character (append CSV row + write JSON profile), generate next character ID, and build CSV row from form data.

**Step 1: Create the storage helper**

```jsx
// src/utils/characterStorage.js
import { writeFile, appendFile } from './devFileWriter.js';

export function getNextCharacterId(existingCharacters) {
  const maxNum = existingCharacters.reduce((max, c) => {
    const num = parseInt(c.id?.replace('c', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `c${String(maxNum + 1).padStart(2, '0')}`;
}

export function buildCsvRow(charData) {
  const { id, name, han, faction, role, qiAffinity, power, eraStart, eraEnd, locationId, journey } = charData;
  const journeyStr = (journey || []).join('|');
  // CSV fields: id,name,han,faction,role,qi_affinity,power,era_start,era_end,location_id,journey
  return `\n${id},${name},${han},${faction},${role},${qiAffinity},${power},${eraStart},${eraEnd || ''},${locationId},${journeyStr}`;
}

export async function saveCharacter(charData, profile) {
  // 1. Append CSV row
  const csvRow = buildCsvRow(charData);
  await appendFile('public/data/characters.csv', csvRow);

  // 2. Write extended profile JSON
  const jsonData = {
    id: charData.id,
    ...profile,
    tier: 'S',
    createdAt: new Date().toISOString(),
  };
  await writeFile(
    `public/data/characters/${charData.id}.json`,
    JSON.stringify(jsonData, null, 2)
  );

  return charData.id;
}
```

**Step 2: Create characters directory**

Run: `mkdir -p "/Users/sampi_wu/Downloads/Claude Code/public/data/characters" && touch "/Users/sampi_wu/Downloads/Claude Code/public/data/characters/.gitkeep"`

**Step 3: Commit**

```bash
git add src/utils/characterStorage.js public/data/characters/.gitkeep
git commit -m "feat: add character storage helpers (CSV append + JSON write)"
```

---

### Task 4: CharacterCreatorModal Component — Core Input Form

**Files:**
- Create: `src/components/CharacterCreatorModal.jsx`

**What it does:** The main modal component. This task implements Phase 1 (core input form) with all fields: name, han, faction, role, qi affinity, power, era, location, concept. Also includes the API key settings section.

**Step 1: Create the modal with core form**

Create `src/components/CharacterCreatorModal.jsx`. This is a large component. Key structure:

```jsx
import React, { useState, useMemo } from 'react';
import { getApiKey, setApiKey, generateCharacterProfile } from '../utils/claudeApi.js';
import { getNextCharacterId, saveCharacter } from '../utils/characterStorage.js';
```

**State:**
- `step`: 'input' | 'generating' | 'review' | 'saving' | 'done'
- `apiKeyInput`: string (for settings)
- `showApiKeySettings`: boolean
- `form`: object with all core fields (name, han, faction, role, qiAffinity, power, eraStart, eraEnd, locationId, concept)
- `profile`: object (AI-generated sections)
- `error`: string | null

**Layout:**
- Full-screen overlay (`position: fixed, inset: 0, z-index: 1000`)
- Dark backdrop with `backdrop-filter: blur(12px)`
- Modal panel (max-width 900px, centered, max-height 90vh, overflow-y auto)
- Header: "Tạo Nhân Vật Mới" with 創 watermark, close X button
- API Key settings: collapsible section at top with input + save button
- Core form: 2-column grid for fields
- Footer: "Tạo bằng AI" gold button (disabled without API key or empty required fields)

**Inline styles must use CSS variables** (`var(--bg-card)`, `var(--gold)`, `var(--border)`, etc.) to match the existing theme. Reference `src/index.css` for all available variables.

**Dropdowns for faction and location** should map over `data.factions` and `data.locations` respectively. QI affinity options: `['tối cao', 'cao', 'trung', 'âm']`. Power slider: 1-5.

The component receives props: `{ isOpen, onClose, data, onCharacterSaved }`.

If `!isOpen`, return null.

**Step 2: Verify it renders**

Manually test: import modal in CharactersPage temporarily, render with `isOpen={true}`, check browser.

**Step 3: Commit**

```bash
git add src/components/CharacterCreatorModal.jsx
git commit -m "feat: add CharacterCreatorModal with core input form"
```

---

### Task 5: CharacterCreatorModal — AI Generation + Review

**Files:**
- Modify: `src/components/CharacterCreatorModal.jsx`

**What it does:** Adds Phase 2 — when user clicks "Tạo bằng AI", calls Claude API, shows loading state, then renders the generated profile as editable fields for review.

**Step 1: Add generation handler**

In the modal component, add:

```jsx
const handleGenerate = async () => {
  setStep('generating');
  setError(null);
  try {
    const factionObj = data.factions.find(f => f.id === form.faction);
    const locationObj = data.locations.find(l => l.id === form.locationId);
    const worldContext = data.factions.map(f => `${f.name} (${f.han}): ${f.description}`).join('\n');

    const result = await generateCharacterProfile({
      coreFields: {
        name: form.name,
        han: form.han,
        faction: factionObj?.name || form.faction,
        role: form.role,
        qiAffinity: form.qiAffinity,
        power: form.power,
        eraStart: form.eraStart,
        eraEnd: form.eraEnd,
        location: locationObj?.name || form.locationId,
        concept: form.concept,
      },
      worldContext,
    });
    setProfile(result);
    setStep('review');
  } catch (err) {
    setError(err.message);
    setStep('input');
  }
};
```

**Step 2: Add generating state UI**

When `step === 'generating'`, show a centered loading animation:
- Large dim 創 character with `animation: breathe 2s ease-in-out infinite`
- "Đang tạo nhân vật..." text in gold, italic EB Garamond
- Cancel button (sets step back to 'input')

**Step 3: Add review UI**

When `step === 'review'`, render the generated profile sections:
- Each section (Appearance, Personality, Voice, History, Arc) as a card with:
  - Header: Vietnamese name + Hán tự watermark (外貌, 性格, 聲音, 歷史, 弧線)
  - Each field as an editable `<textarea>` pre-filled with AI content
  - Fields use `value={profile.appearance?.firstImpression}` with `onChange` updating profile state
- For arrays (coreValues), render 3 text inputs
- For nested objects (voice.lines), render each sub-field

Footer buttons: "Quay lại" (back to input) and "Lưu Nhân Vật" (save).

**Step 4: Commit**

```bash
git add src/components/CharacterCreatorModal.jsx
git commit -m "feat: add AI generation and review phase to character creator"
```

---

### Task 6: CharacterCreatorModal — Save Flow

**Files:**
- Modify: `src/components/CharacterCreatorModal.jsx`

**What it does:** When user clicks "Lưu Nhân Vật", saves the character to CSV + JSON, shows success state, and notifies parent to refresh data.

**Step 1: Add save handler**

```jsx
const handleSave = async () => {
  setStep('saving');
  setError(null);
  try {
    const newId = getNextCharacterId(data.characters);
    const charData = {
      id: newId,
      name: form.name,
      han: form.han,
      faction: form.faction,
      role: form.role,
      qiAffinity: form.qiAffinity,
      power: form.power,
      eraStart: form.eraStart,
      eraEnd: form.eraEnd,
      locationId: form.locationId,
      journey: form.locationId ? [form.locationId] : [],
    };
    await saveCharacter(charData, profile);
    setStep('done');
    // Notify parent to reload data
    if (onCharacterSaved) onCharacterSaved(newId);
  } catch (err) {
    setError(err.message);
    setStep('review');
  }
};
```

**Step 2: Add done state UI**

When `step === 'done'`:
- Success message: "Đã tạo nhân vật thành công!"
- Character name + han in gold
- "Đóng" button that calls onClose

**Step 3: Add saving state UI**

When `step === 'saving'`:
- "Đang lưu..." with gold spinner

**Step 4: Commit**

```bash
git add src/components/CharacterCreatorModal.jsx
git commit -m "feat: add save flow to character creator modal"
```

---

### Task 7: Wire Modal into CharactersPage

**Files:**
- Modify: `src/pages/CharactersPage.jsx` (lines 88-207)
- Modify: `src/App.jsx` (add data refresh capability)

**What it does:** Adds a "Tạo Nhân Vật" button to CharactersPage, imports and renders the modal, and handles data refresh after save.

**Step 1: Modify CharactersPage.jsx**

Add at top:
```jsx
import CharacterCreatorModal from '../components/CharacterCreatorModal';
```

Add state:
```jsx
const [showCreator, setShowCreator] = useState(false);
```

Add button after the filters div (around line 153), before the grid:
```jsx
<button
  onClick={() => setShowCreator(true)}
  style={{
    marginBottom: 20,
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
  + Tạo Nhân Vật
</button>
```

Add modal render at end of the page div (before closing `</div>`):
```jsx
<CharacterCreatorModal
  isOpen={showCreator}
  onClose={() => setShowCreator(false)}
  data={data}
  onCharacterSaved={() => {
    setShowCreator(false);
    // Trigger page reload to pick up new CSV data
    window.location.reload();
  }}
/>
```

**Step 2: Test end-to-end**

Run: `npm run dev`, navigate to Nhân Vật page, click "Tạo Nhân Vật", fill in fields, enter API key, click generate, review, save.

**Step 3: Commit**

```bash
git add src/pages/CharactersPage.jsx
git commit -m "feat: wire character creator modal into CharactersPage"
```

---

## Task Order & Dependencies

```
Task 1 (API helper) ─────────────────────┐
Task 2 (Dev middleware) ──┐               │
Task 3 (Storage helpers) ─┤               │
                          ├─ Task 4 (Modal core form)
                          │     │
                          │     ├─ Task 5 (AI generation + review)
                          │     │     │
                          │     │     └─ Task 6 (Save flow)
                          │     │           │
                          │     │           └─ Task 7 (Wire into page)
```

Tasks 1, 2, 3 are independent and can run in parallel.
Tasks 4-7 are sequential.

## Verification Checklist

After all tasks:
1. Open http://localhost:5173, go to Nhân Vật
2. Click "Tạo Nhân Vật" — modal opens with xianxia styling
3. Enter API key in settings — key persists in localStorage
4. Fill all core fields (name, faction, role, etc.)
5. Click "Tạo bằng AI" — loading animation shows
6. AI generates profile — all sections populate with Vietnamese text
7. Edit any field — changes persist
8. Click "Lưu Nhân Vật" — character saved
9. Modal closes, page reloads, new character appears in grid
10. Check `public/data/characters.csv` — new row appended
11. Check `public/data/characters/c16.json` — full profile JSON exists
