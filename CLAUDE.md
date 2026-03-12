# Thiên Hoang Đại Lục — Project Guide

## Quick Start
```bash
npm run dev        # Main app (5173) + FMG (5174)
npm run build      # Build both apps
```

## Architecture
- **App shell**: `src/App.jsx` loads all data via `Promise.all`, passes `data` prop to pages
- **Map**: `src/CoNguyenGioiMap.jsx` (~56KB) — stays mounted via `display:none` to preserve D3 zoom state
- **Pages**: 10 lazy-loaded pages in `src/pages/`, each receives `data` prop
- **FMG**: Azgaar's Fantasy Map Generator in `fmg/`, served as iframe

## Conventions

### Language
- **Vietnamese** is the primary UI language for all labels, headings, descriptions
- **Chinese characters** (Hán tự) appear as small supporting text only — smaller font, dimmer color
- Never make Chinese the primary label

### Styling
- **Inline styles** everywhere (no CSS modules, no Tailwind)
- Use **CSS variables** from `src/index.css` (e.g., `var(--gold)`, `var(--bg-card)`)
- Xianxia aesthetic: dark bg (#05080f), gold accents (#c4a35a), serif fonts
- `backdropFilter: 'blur(12px)'` for panels
- Cards use `card-interactive` and `card-reveal` CSS classes

### Fonts
- Display: `var(--font-display)` — Playfair Display
- Body: `var(--font-body)` — EB Garamond
- Chinese: `var(--font-han)` — Noto Serif TC

### Data
- World data: `public/data/world.json` (eras, factions, territories, leyLines, etc.)
- CSVs: `public/data/*.csv` (locations, characters, events, trade_routes, story_arcs)
- Literature: `public/data/literature-index.json` → `.md` files in `public/data/Thơ/`, `Nhạc/`, `Văn/`
- All data parsed with `d3.csvParse`

### File Writing (Dev Mode Only)
- `src/utils/devFileWriter.js` — writes to `public/data/` via Vite middleware
- Vite plugin in `vite.config.js` handles `/api/write-file` and `/api/upload-audio`
- Production fallback: downloads file to user's computer

### AI Integration
- `src/utils/claudeApi.js` — calls Anthropic API (claude-sonnet-4-6)
- API key stored in localStorage (`cng-api-key`)
- Uses `anthropic-dangerous-direct-browser-access` header for browser-side calls

## Key Files
| File | Purpose |
|---|---|
| `src/App.jsx` | Shell, data loading, tab routing |
| `src/index.css` | All CSS variables, animations, utility classes |
| `src/components/Sidebar.jsx` | Navigation sidebar |
| `src/components/StarParticles.jsx` | Background star animation |
| `src/components/LiteratureCreatorModal.jsx` | AI literature creator (single/series/queue) |
| `src/components/CharacterCreatorModal.jsx` | AI character creator |
| `vite.config.js` | Vite config + dev file writer middleware |

## Don't
- Don't add react-router (tab switching via state is intentional)
- Don't use CSS modules or Tailwind
- Don't refactor inline styles to external stylesheets
- Don't add a backend server (this is a static site)
- Don't remove the FMG iframe approach
