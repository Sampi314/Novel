# FMG Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace CoNguyenGioiMap.jsx with a forked Azgaar's Fantasy Map Generator, fully re-skinned with xianxia Vietnamese-Chinese theme, embedded as iframe in the map tab.

**Architecture:** Clone FMG repo as `fmg/` subfolder. FMG runs its own Vite dev server on port 5174, proxied through the main app's Vite at `/fmg/`. React app renders an iframe when map tab is active. postMessage API bridges communication between the two.

**Tech Stack:** FMG (TypeScript, D3, Vite, Delaunator), React app (JSX, D3, Vite), postMessage IPC

---

### Task 1: Clone FMG and verify it runs

**Files:**
- Create: `fmg/` (git clone)

**Step 1: Clone the FMG repo into project**

```bash
cd "/Users/sampi_wu/Downloads/Claude Code"
git clone https://github.com/Sampi314/Fantasy-Map-Generator.git fmg
```

**Step 2: Install FMG dependencies**

```bash
cd fmg && npm install
```

Note: FMG requires Node.js 24+. If current Node is older, use `nvm use 24` or install it.

**Step 3: Fix FMG vite config for local dev**

Modify `fmg/vite.config.ts` — change `base` to `'/'` for local development:

```typescript
export default {
    root: './src',
    base: '/',
    build: {
        outDir: '../dist',
        assetsDir: './',
    },
    publicDir: '../public',
    server: {
        port: 5174,
        strictPort: true,
    },
}
```

**Step 4: Start FMG dev server and verify**

```bash
cd fmg && npm run dev
```

Expected: FMG loads at http://localhost:5174 with the default map generator UI.

**Step 5: Commit**

```bash
cd "/Users/sampi_wu/Downloads/Claude Code"
# Add fmg as a tracked folder (or .gitmodules if using submodule)
echo "fmg/node_modules" >> .gitignore
echo "fmg/dist" >> .gitignore
git add fmg/ .gitignore
git commit -m "feat: clone FMG as subfolder for map integration"
```

---

### Task 2: Set up Vite proxy and iframe embed

**Files:**
- Modify: `vite.config.js` (add proxy)
- Create: `src/components/FMGEmbed.jsx` (iframe wrapper)
- Modify: `src/App.jsx` (replace CoNguyenGioiMap with FMGEmbed)

**Step 1: Add proxy to main Vite config**

Modify `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Thien Hoang Dai Luc · 天荒大陸',
        short_name: '天荒大陸',
        description: 'Interactive historical fantasy world map',
        theme_color: '#1a1209',
        background_color: '#1a1209',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,csv}']
      }
    })
  ],
  server: {
    proxy: {
      '/fmg': {
        target: 'http://localhost:5174',
        rewrite: (path) => path.replace(/^\/fmg/, ''),
      },
    },
  },
})
```

**Step 2: Create FMGEmbed component**

Create `src/components/FMGEmbed.jsx`:

```jsx
import React, { useRef, useEffect } from 'react';

export default function FMGEmbed({ theme, mapZoomTarget }) {
  const iframeRef = useRef(null);

  // Sync theme to FMG
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'themeChange', theme },
        '*'
      );
    }
  }, [theme]);

  // Handle zoom-to-location requests from content pages
  useEffect(() => {
    if (mapZoomTarget && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'flyTo', x: mapZoomTarget.x, y: mapZoomTarget.y, zoom: mapZoomTarget.zoom || 4 },
        '*'
      );
    }
  }, [mapZoomTarget]);

  return (
    <iframe
      ref={iframeRef}
      src="/fmg/"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
      }}
      title="Thien Hoang Dai Luc Map"
      allow="fullscreen"
    />
  );
}
```

**Step 3: Replace CoNguyenGioiMap in App.jsx**

In `src/App.jsx`:

1. Replace the import:
   - Remove: `const CoNguyenGioiMap = lazy(() => import('./CoNguyenGioiMap'));`
   - Add: `import FMGEmbed from './components/FMGEmbed';`

2. Replace the map rendering block (around line 180-182):
   - Remove: `<CoNguyenGioiMap externalData={data} mapZoomTarget={mapZoomTarget} />`
   - Add: `<FMGEmbed theme={theme} mapZoomTarget={mapZoomTarget} />`

3. The `navigateToMap` function stays the same since FMGEmbed accepts `mapZoomTarget`.

**Step 4: Verify both servers work together**

Start both servers:
```bash
# Terminal 1
cd "/Users/sampi_wu/Downloads/Claude Code/fmg" && npm run dev

# Terminal 2
cd "/Users/sampi_wu/Downloads/Claude Code" && npm run dev
```

Expected: Open http://localhost:5173, click "Ban Do" tab, see FMG loaded inside iframe.

**Step 5: Commit**

```bash
git add vite.config.js src/components/FMGEmbed.jsx src/App.jsx
git commit -m "feat: embed FMG via iframe with Vite proxy"
```

---

### Task 3: Vietnamese-Chinese UI translation

**Files:**
- Modify: `fmg/src/index.html` (translate ALL English UI text)

**Step 1: Translate menu tabs and primary navigation**

In `fmg/src/index.html`, find and replace these strings:

| English | Vietnamese | Han tu |
|---------|-----------|--------|
| Layers | Tang Lop | 層 |
| Style | Phong Cach | 風格 |
| Options | Tuy Chon | 選項 |
| Tools | Cong Cu | 工具 |
| About | Gioi Thieu | 介紹 |

**Step 2: Translate layer names**

| English | Vietnamese |
|---------|-----------|
| Texture | Nen |
| Heightmap | Dia Hinh |
| Biomes | Sinh Thai |
| Cells | O Voronoi |
| Grid | Luoi |
| Coordinates | Toa Do |
| Wind Rose | Hoa Gio |
| Rivers | Song Ngoi |
| Relief | Dia Mao |
| Religions | Ton Giao |
| Cultures | Van Hoa |
| States | Quoc Gia |
| Provinces | Tinh |
| Zones | Vung |
| Borders | Bien Gioi |
| Routes | Tuyen Duong |
| Temperature | Nhiet Do |
| Population | Dan So |
| Ice | Bang |
| Precipitation | Luong Mua |
| Emblems | Huy Hieu |
| Icons | Bieu Tuong |
| Labels | Nhan |
| Military | Quan Su |
| Markers | Dau Moc |
| Scale Bar | Thuoc Ty Le |
| Vignette | Vien |

**Step 3: Translate tools panel**

| English | Vietnamese |
|---------|-----------|
| Edit | Chinh Sua |
| Biomes | Sinh Thai |
| Burgs | Thanh Tri |
| Cultures | Van Hoa |
| Diplomacy | Ngoai Giao |
| Emblems | Huy Hieu |
| Heightmap | Dia Hinh |
| Markers | Dau Moc |
| Military | Quan Su |
| Namesbase | Ten Goi |
| Notes | Ghi Chu |
| Provinces | Tinh |
| Religions | Ton Giao |
| Rivers | Song Ngoi |
| Routes | Tuyen Duong |
| States | Quoc Gia |
| Units | Don Vi |
| Zones | Vung |
| Regenerate | Tao Lai |
| Add | Them |
| Show | Hien |
| Create | Tao |

**Step 4: Translate options panel**

Key settings labels:
- "Map settings" -> "Cai Dat Ban Do 地圖設定"
- "Canvas size" -> "Kich Thuoc"
- "Map seed" -> "Hat Giong"
- "Points number" -> "So Diem"
- "Map name" -> "Ten Ban Do"
- "Year and era" -> "Nam va Ky Nguyen"
- "Cultures number" -> "So Van Hoa"
- "States number" -> "So Quoc Gia"
- "Burgs number" -> "So Thanh Tri"

**Step 5: Translate layer presets**

- "Political map" -> "Ban Do Chinh Tri 政治圖"
- "Cultural map" -> "Ban Do Van Hoa 文化圖"
- "Religions map" -> "Ban Do Ton Giao 宗教圖"
- "Provinces map" -> "Ban Do Tinh 省份圖"
- "Biomes map" -> "Ban Do Sinh Thai 生態圖"
- "Heightmap" -> "Ban Do Dia Hinh 地形圖"
- "Physical map" -> "Ban Do Dia Ly 地理圖"
- "Military map" -> "Ban Do Quan Su 軍事圖"

**Step 6: Commit**

```bash
cd "/Users/sampi_wu/Downloads/Claude Code"
git add fmg/src/index.html
git commit -m "feat: translate FMG UI to Vietnamese-Chinese"
```

---

### Task 4: Vietnamese-Chinese name generation

**Files:**
- Modify: `fmg/src/modules/names-generator.ts` (add Vietnamese name bases)
- Modify: `fmg/src/modules/cultures-generator.ts` (add Vietnamese culture type)

**Step 1: Add Vietnamese name bases to names-generator**

Add new name base entries for Vietnamese-Chinese naming. Each base needs:
- `name`: culture name
- `min`/`max`: syllable count range
- `d`: delimiter (space for Vietnamese)
- `m`/`f`: male/female syllable chains (Markov chain data)

Vietnamese name patterns to add:
- **Long Toc** (Dragon): Long, Thien, Van, Phong, Lam, Hao, Vuong, Minh
- **Nhan Toc** (Human): Nguyen, Tran, Le, Pham, Hoang, Phan, Vu, Dang + given names
- **Yeu Toc** (Demon): mystical compounds: Huyen, Am, Ma, Quang, Linh, Dieu
- **Tinh Linh** (Spirit): Tinh, Linh, Hoa, Ngoc, Tuyet, Suong, Lan
- **Trung Toc** (Insect): Cau, Trung, Du, Ky, Doc, Chau
- **Cu Toc** (Giant): Son, Nham, Cuong, Hung, Dai, Thach
- **Vi Toc** (Micro): Vi, Tieu, Hao, Mieu, Tho, An
- **Hai Toc** (Sea): Hai, Duong, Ba, Thuy, Lan, Trieu
- **Thach Toc** (Stone): Thach, Nham, Kim, Cuong, Co, Phien
- **Vu Toc** (Feather): Vu, Dieu, Phi, Phuong, Canh, Luong

**Step 2: Set Vietnamese as default culture set**

In `cultures-generator.ts`, modify the default culture set selection to use the Vietnamese bases we added.

**Step 3: Add Vietnamese biome names**

In `fmg/src/modules/biomes.ts`, replace English biome names:

```typescript
const defaultBiomeNames = [
  "Hai Duong",           // Marine (海洋)
  "Sa Mac Nong",         // Hot desert (熱沙漠)
  "Sa Mac Lanh",         // Cold desert (寒沙漠)
  "Thao Nguyen",         // Savanna (草原)
  "Dong Co",             // Grassland (草地)
  "Rung Mua Mua",        // Tropical seasonal forest (熱帶季風林)
  "Rung On Doi",         // Temperate deciduous forest (溫帶落葉林)
  "Rung Mua Nhiet Doi",  // Tropical rainforest (熱帶雨林)
  "Rung On Doi Am",      // Temperate rainforest (溫帶雨林)
  "Rung Tai Ga",         // Taiga (泰加林)
  "Dong Tundra",         // Tundra (凍原)
  "Bang Ha",             // Glacier (冰川)
  "Dam Lay",             // Wetland (濕地)
];
```

**Step 4: Commit**

```bash
git add fmg/src/modules/names-generator.ts fmg/src/modules/cultures-generator.ts fmg/src/modules/biomes.ts
git commit -m "feat: add Vietnamese-Chinese name bases and biome names"
```

---

### Task 5: Xianxia dark theme for FMG

**Files:**
- Modify: `fmg/src/index.html` (CSS overrides)
- Create: `fmg/public/styles/xianxia-dark.css` (custom theme stylesheet)

**Step 1: Create xianxia dark theme CSS**

Create `fmg/public/styles/xianxia-dark.css`:

```css
/* Xianxia Dark Theme for FMG */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=EB+Garamond:wght@400;500;600&family=Noto+Serif+TC:wght@400;600&display=swap');

:root {
  --bg-color: #05080f;
  --bg-panel: rgba(10, 14, 24, 0.95);
  --bg-input: rgba(10, 14, 24, 0.7);
  --gold: #c4a35a;
  --gold-bright: #e8c96a;
  --gold-dim: #4a3518;
  --border: #1e1608;
  --text: #d4c4a0;
  --text-dim: #6a5a3a;
  --text-muted: #8a7a5a;
  --font-display: 'Playfair Display', 'Noto Serif TC', serif;
  --font-body: 'EB Garamond', serif;
  --font-han: 'Noto Serif TC', serif;
}

/* Override FMG body/background */
body {
  background: var(--bg-color) !important;
  color: var(--text) !important;
  font-family: var(--font-body) !important;
}

/* Override FMG options container */
#optionsContainer {
  background: var(--bg-panel) !important;
  border: 1px solid var(--border) !important;
  backdrop-filter: blur(12px);
}

/* Override tabs */
.tab {
  color: var(--text-dim) !important;
  font-family: var(--font-body) !important;
}
.tab.active, .tab:hover {
  color: var(--gold) !important;
}

/* Override buttons */
button, .button, input[type="button"] {
  background: var(--bg-input) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  border-radius: 4px !important;
  font-family: var(--font-body) !important;
}
button:hover, .button:hover {
  border-color: var(--gold-dim) !important;
  color: var(--gold) !important;
}

/* Override inputs */
input, select, textarea {
  background: var(--bg-input) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  border-radius: 4px !important;
  font-family: var(--font-body) !important;
}

/* Override labels/text */
label, span, div {
  color: var(--text) !important;
}

/* Override tooltips */
[data-tip]::after {
  background: var(--bg-panel) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
}

/* Override scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg-color); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--gold-dim); }
```

**Step 2: Link the theme CSS in FMG index.html**

Add to `<head>` in `fmg/src/index.html`:
```html
<link rel="stylesheet" href="/styles/xianxia-dark.css">
```

**Step 3: Update FMG's SVG filter definitions for xianxia atmosphere**

In `fmg/src/index.html`, within the SVG `<defs>`, add a parchment grain texture filter:

```html
<filter id="xianxiaGrain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise"/>
  <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
  <feBlend mode="multiply" in="SourceGraphic" in2="gray" result="blend"/>
  <feComponentTransfer in="blend">
    <feFuncA type="linear" slope="0.05"/>
  </feComponentTransfer>
</filter>
```

**Step 4: Commit**

```bash
git add fmg/public/styles/xianxia-dark.css fmg/src/index.html
git commit -m "feat: add xianxia dark theme to FMG"
```

---

### Task 6: postMessage communication bridge

**Files:**
- Modify: `src/components/FMGEmbed.jsx` (add message listener)
- Create: `fmg/src/bridge.js` (message handler inside FMG)
- Modify: `fmg/src/index.html` (load bridge script)

**Step 1: Create FMG-side message bridge**

Create `fmg/src/bridge.js`:

```javascript
// Bridge: receives messages from parent React app
window.addEventListener('message', (event) => {
  const { type, ...data } = event.data || {};

  switch (type) {
    case 'flyTo': {
      // Use FMG's zoom/pan to fly to coordinates
      const { x, y, zoom } = data;
      if (window.svg && x != null && y != null) {
        const scale = zoom || 4;
        const transform = d3.zoomIdentity.translate(window.graphWidth / 2 - x * scale, window.graphHeight / 2 - y * scale).scale(scale);
        window.svg.transition().duration(800).call(window.zoom.transform, transform);
      }
      break;
    }
    case 'themeChange': {
      // Swap between xianxia-dark and xianxia-light
      const { theme } = data;
      document.documentElement.setAttribute('data-theme', theme);
      break;
    }
  }
});

// Notify parent when FMG is ready
window.addEventListener('load', () => {
  window.parent.postMessage({ type: 'fmgReady' }, '*');
});
```

**Step 2: Load bridge in FMG index.html**

Add before closing `</body>` in `fmg/src/index.html`:
```html
<script type="module" src="./bridge.js"></script>
```

**Step 3: Add message listener to FMGEmbed**

Update `src/components/FMGEmbed.jsx` to listen for messages from FMG:

```jsx
useEffect(() => {
  const handleMessage = (event) => {
    const { type, ...data } = event.data || {};
    if (type === 'fmgReady') {
      // FMG loaded, sync initial theme
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'themeChange', theme },
        '*'
      );
    }
    if (type === 'navigate' && data.tab) {
      // FMG wants to navigate to a content page
      // This requires onNavigate prop passed from App.jsx
    }
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [theme]);
```

**Step 4: Commit**

```bash
git add fmg/src/bridge.js fmg/src/index.html src/components/FMGEmbed.jsx
git commit -m "feat: add postMessage bridge between React app and FMG"
```

---

### Task 7: Add concurrent dev script

**Files:**
- Modify: `package.json` (add concurrent dev command)

**Step 1: Install concurrently**

```bash
cd "/Users/sampi_wu/Downloads/Claude Code"
npm install -D concurrently
```

**Step 2: Update package.json scripts**

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"cd fmg && npm run dev\"",
    "dev:app": "vite",
    "dev:fmg": "cd fmg && npm run dev",
    "build": "vite build && cd fmg && npm run build",
    "preview": "vite preview"
  }
}
```

**Step 3: Verify both servers start with single command**

```bash
npm run dev
```

Expected: Both Vite servers start. App at :5173, FMG at :5174. Map tab shows FMG iframe.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add concurrent dev script for app + FMG"
```

---

### Task 8: Clean up old map code

**Files:**
- Delete: `src/CoNguyenGioiMap.jsx` (old 2000-line map component)
- Modify: `src/App.jsx` (remove old map import and related state)

**Step 1: Remove CoNguyenGioiMap import from App.jsx**

Remove the lazy import line for CoNguyenGioiMap. The FMGEmbed import added in Task 2 replaces it.

**Step 2: Clean up mapZoomTarget state**

Keep `mapZoomTarget` state and `navigateToMap` function in App.jsx since FMGEmbed uses them.

**Step 3: Delete old map file**

```bash
rm src/CoNguyenGioiMap.jsx
```

**Step 4: Verify build**

```bash
npx vite build --logLevel error
```

Expected: No errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove old CoNguyenGioiMap, fully replaced by FMG"
```

---

### Task 9: Production build setup

**Files:**
- Modify: `vite.config.js` (build output for FMG)
- Modify: `fmg/vite.config.ts` (production base path)

**Step 1: Configure FMG build output**

Update `fmg/vite.config.ts` for production:

```typescript
export default {
    root: './src',
    base: '/fmg/',
    build: {
        outDir: '../dist',
        assetsDir: './',
    },
    publicDir: '../public',
    server: {
        port: 5174,
        strictPort: true,
    },
}
```

**Step 2: Update main build to copy FMG dist**

Add a post-build script to package.json:

```json
{
  "scripts": {
    "build": "vite build && cd fmg && npm run build && cp -r dist ../dist/fmg"
  }
}
```

**Step 3: Update FMGEmbed iframe src for production**

In `src/components/FMGEmbed.jsx`, use relative path:

```jsx
const isDev = import.meta.env.DEV;
const fmgSrc = isDev ? '/fmg/' : '/fmg/index.html';
```

**Step 4: Verify production build**

```bash
npm run build
npx vite preview
```

Expected: App loads, map tab shows FMG correctly.

**Step 5: Commit**

```bash
git add vite.config.js fmg/vite.config.ts package.json src/components/FMGEmbed.jsx
git commit -m "feat: configure production build for app + FMG"
```
