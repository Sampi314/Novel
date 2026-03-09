# AI-Assisted Literature Creator — Design

## Goal
Add an in-app literature creation modal on the Văn Chương page that combines user input with Claude AI-powered generation for poems (Thơ), songs (Nhạc), and prose (Văn), with inline editing and per-section AI regeneration. Also improve the Literature page UI with markdown rendering, era grouping, and metadata display.

## Architecture
Full-screen modal triggered from LiteraturePage. Two-phase workflow: user fills core input (type, era, related entities, concept), then Claude API generates the 4-layer content. User reviews with inline edit + AI regeneration per section before saving. Shares the same `claudeApi.js` helper and localStorage API key (`cng-api-key`) from Character Creator.

## Modal Structure

### Phase 1: Core Input (User fills in)

| Field | Type | Source |
|-------|------|--------|
| Type | tabs: Thơ / Nhạc / Văn | user selects |
| Title | text input | user |
| Era | dropdown | from `data.eras` |
| Related Characters | multi-select | from `data.characters` |
| Related Events | multi-select | from `data.events` |
| Related Locations | multi-select | from `data.locations` |
| Brief concept | textarea | user (1-3 sentences) |

### Phase 2: AI Generation + Review (Claude fills, user edits)

**For Thơ (Poetry) and Văn (Prose) — 4 sections:**

1. **原文 Nguyên Văn** — Classical Chinese original text
2. **漢越音 Hán Việt Âm** — Sino-Vietnamese phonetic reading
3. **直譯 Trực Dịch** — Literal Vietnamese translation with stanza-by-stanza breakdown
4. **析義 Phân Tích** — Analysis: meter, historical context, stanza analysis, allusions, symbolism, lore links

**For Nhạc (Songs) — 5 sections:**

1. **原文 Nguyên Văn** — Full song in Chinese with modern song structure: [Verse 1] [Chorus] [Verse 2] [Chorus] [Bridge] [Outro] — flexible, but must have meaning and good melodic flow
2. **漢越音 Hán Việt Âm** — Complete Sino-Vietnamese reading of the full song
3. **直譯 Trực Dịch** — Section-by-section Vietnamese translation
4. **🎹 Style Prompt** — Suno AI generation prompt: genre, instruments, tempo, vocals, mood, tags. Ready to paste into Suno.
5. **析義 Phân Tích** — Analysis: song structure, melody notes, lore connections, symbolism

**Song structure rules:**
- The Chinese original (原文) must be a complete song — all Chinese lyrics first, then all Hán Việt, then all translation
- Modern song structure (verse/chorus/bridge) but flexible — the priority is meaningful lyrics with good melodic potential
- Style prompt must be specific enough for Suno to produce quality output

Each section has:
- Editable textarea for manual editing
- AI Regenerate button (sends current content + context, regenerates only that section)
- Section header with large dim Hán tự watermark (原, 漢, 直, 🎹, 析)

### Audio Upload & Playback (Songs only)

After generating a song with Suno (using the style prompt), the user can:
- **Upload audio** (.mp3/.wav) via a file input on the song's detail view
- Audio is saved to `public/data/Nhạc/{era}/{title}.mp3` via dev middleware
- `literature-index.json` entry gets an `audioFile` field
- **Audio player** renders inline when viewing a song — custom styled player with play/pause, progress bar, gold theme
- Audio persists — next time the user visits the song, the player loads the saved file

## API Integration

- **Key storage:** Shared with Character Creator — `localStorage.getItem('cng-api-key')`
- **Helper:** Shared `src/utils/claudeApi.js`
- **Model:** claude-sonnet-4-6
- **System prompt:** Embed relevant skill content based on type:
  - Thơ → poem.md (Thi Tiên skill)
  - Nhạc → song.md (Nhạc Sư skill)
  - Văn → lore-writer.md style
- **User message:** Core fields + concept + world context (era descriptions, related character/event/location details)
- **Response format:** Structured JSON with 4 sections
- **Per-section regeneration:** Send current full content + instruction to regenerate specific section

## Data Storage

### literature-index.json (update)
Add entry to the appropriate category array:
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
      "relatedLocations": ["l19", "l01"]
    }
  ],
  "nhac": [
    {
      "id": "nhac-001",
      "title": "Example Song",
      "era": "Chiến Loạn Kỷ",
      "file": "/data/Nhạc/Chiến Loạn Kỷ/Example Song.md",
      "audioFile": "/data/Nhạc/Chiến Loạn Kỷ/Example Song.mp3",
      "relatedCharacters": [],
      "relatedEvents": [],
      "relatedLocations": []
    }
  ]
}
```

Note: `audioFile` field is optional — only present after user uploads audio from Suno.

### .md file (new file per piece)
Created at `public/data/{Thơ|Nhạc|Văn}/{era}/{title}.md` with:
- YAML frontmatter (tags, era, related entities, status)
- 4-layer content sections
- Same format as existing `Phàm Nhân Dao.md`

Uses the Vite dev middleware (shared with Character Creator) for file writing.

## Literature Page UI Improvements

### Markdown Rendering
- Render `.md` content with a lightweight markdown renderer (not raw `pre` text)
- Support code blocks (for Chinese text), headers, bold/italic, lists

### Era Grouping
- Within each category tab (Thơ/Nhạc/Văn), group items by era
- Era headers with era name and Hán tự
- Collapsible era sections

### Metadata Display
- Show frontmatter tags as chips below title
- Related characters/events/locations as clickable links (navigate to respective pages)

### "Tạo Tác Phẩm" Button
- Gold gradient button in page header
- Opens the Literature Creator modal

## Visual Design

- Same xianxia aesthetic as Character Creator modal
- Dark overlay with `backdrop-filter: blur(12px)`
- Gold borders, EB Garamond/serif fonts
- Section headers with large dim Hán tự watermarks (原, 漢, 直, 析)
- AI regenerate buttons: subtle, secondary style
- Loading animation: breathing gold glow with "Đang sáng tác..." text

## File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `src/components/LiteratureCreatorModal.jsx` | Main modal component |
| Create | `src/components/AudioPlayer.jsx` | Custom xianxia-styled audio player for songs |
| Modify | `src/pages/LiteraturePage.jsx` | Add button, markdown rendering, era grouping, metadata, audio upload/playback |
| Modify | `src/utils/claudeApi.js` | May need to extend for per-section regeneration |
| Modify | `src/utils/devFileWriter.js` | Add binary file upload support for audio |
| Modify | `vite.config.js` | Extend middleware to handle binary uploads |
| Modify | `public/data/literature-index.json` | Populate with existing Phàm Nhân Dao entry |

## Constraints

- Shares API key and Claude helper with Character Creator
- Shares Vite dev middleware for file writing (extended for binary audio uploads)
- literature-index.json must be populated with at least the existing Phàm Nhân Dao entry
- Markdown rendering should be lightweight (no heavy library)
- Audio files stored alongside .md files in `public/data/Nhạc/{era}/`
- Supported audio formats: .mp3, .wav, .m4a
