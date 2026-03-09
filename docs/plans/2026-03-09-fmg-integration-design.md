# FMG Integration Design

## Summary

Replace CoNguyenGioiMap.jsx with a forked Azgaar's Fantasy Map Generator (FMG), keeping the full FMG feature set re-skinned with xianxia Vietnamese-Chinese theme. The FMG runs as a separate Vite project embedded via iframe in the map tab.

## Decisions

- **Integration**: Fork & heavily customize FMG
- **Generation**: Fully procedural (seed-based, no world.json dependency)
- **App structure**: Keep multi-tab React app, FMG replaces map tab only
- **Features**: Full FMG editing tools, re-themed
- **Approach**: Clone FMG as subfolder, iframe embed, Vite proxy

## Architecture

```
project-root/
├── src/                     # React app (existing)
│   ├── App.jsx              # iframe for map tab
│   ├── components/
│   │   └── FMGEmbed.jsx     # NEW: iframe wrapper component
│   └── pages/               # Content pages (unchanged)
├── fmg/                     # Cloned FMG fork
│   ├── src/
│   │   ├── index.html       # Customized entry point
│   │   ├── modules/         # Generation (customize names-generator)
│   │   └── renderers/       # SVG rendering (customize styles)
│   ├── public/              # Assets
│   ├── package.json
│   └── vite.config.ts
├── package.json
└── vite.config.js           # Proxy /fmg → port 5174
```

## Vietnamese-Chinese Naming

1. Replace all English UI in FMG index.html with Vietnamese
2. Add Vietnamese-Chinese name bases to names-generator.ts
3. Map biome/feature names to Vietnamese
4. State/province naming: [Han tu] + Vietnamese
5. River/lake/mountain: Vietnamese + Han tu pattern

## Xianxia Theme

- Background: #05080f dark / #f4ede0 light
- Gold accents: #c4a35a
- Fonts: Playfair Display, EB Garamond, Noto Serif TC
- SVG filters: grain/parchment overlay
- Menu/toolbar: dark panels with gold borders

## Communication (postMessage)

- `flyTo(x, y, zoom)` — navigate map from content pages
- `navigate(tab, id)` — open content page from map
- `themeChange(theme)` — sync dark/light theme

## Deployment

- Dev: FMG on port 5174, proxied at /fmg/ through main Vite (5173)
- Build: FMG builds to dist/fmg/, React app builds to dist/
- Single `npm run dev` script starts both servers
