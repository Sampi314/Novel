# Map Developer Skill

You are the dedicated developer for the **Thiên Hoang Đại Lục (天荒大陸)** interactive fantasy world map. You have deep knowledge of every file, data format, and convention in this project.

## Project at a Glance

- **Stack**: React 19 + Vite 7 + D3 v7
- **Dev server**: `npm run dev` → http://localhost:5173
- **Main component**: `src/CoNguyenGioiMap.jsx` (~large file, always read before editing)
- **Entry**: `src/main.jsx` → `src/App.jsx` → `<CoNguyenGioiMap />`

## Data Files (all in `public/data/`)

| File | Format | Purpose |
|------|--------|---------|
| `world.json` | JSON | eras, territories, leyLines, mistZones, rivers, tectonic, factions, fauna, divineSites |
| `locations.csv` | CSV | 30 locations — id, name, han, type, x, y, era_founded, era_destroyed, race, qi, power, population, description |
| `characters.csv` | CSV | Characters — id, name, han, faction, role, qi_affinity, power, era_start, era_end, journey |
| `events.csv` | CSV | Timeline events — id, year, type, name, han, location_id, x, y, factions, description |
| `trade_routes.csv` | CSV | Routes — id, name, type, waypoints(x:y pipes), era_start, era_end, description |

## Coordinate System

- World space: **0–10000 × 0–10000**
- Centre: `(5000, 5000)` = Cố Nguyên Thành (capital)
- North = low Y, South = high Y
- Zoom variable `k` used for responsive sizing: always use `Math.max(minPx, value/k)`

## Naming Convention

Every entity needs **two names**:
- `name`: Vietnamese (e.g. "Thiên Sơn Thánh Địa")
- `han`: Chinese characters (e.g. "天山聖地")

## Location Types
`capital` · `city` · `port` · `sacred` · `secret_realm` · `resource` · `ruin` · `dungeon`

## Qi Levels (spiritual power)
`tối cao` (highest) · `cao` · `trung` · `âm` (lowest/dark)

## Races / Factions
`Long Tộc` (Dragon) · `Nhân Tộc` (Human) · `Yêu Tộc` (Demon) · `Hải Tộc` (Sea) · `Vi Tộc` (Micro/Hidden)

## Eras (year ranges)
| Era | Year | Colour |
|-----|------|--------|
| Thái Sơ Kỷ 太初紀 | 0 | #c4a35a |
| Hỗn Độn Kỷ 混沌紀 | 40,000 | #9b7fba |
| Linh Nguyên Kỷ 靈元紀 | 80,000 | #5a9c6e |
| Vạn Tộc Kỷ 萬族紀 | 130,000 | #5a8cc4 |
| Chiến Loạn Kỷ 戰亂紀 | 170,000 | #c45a5a |
| Hiện Đại Kỷ 現代紀 | 200,000 | #c4a35a |

## Architecture Rules

- `CONTINENT`, `LAKE`, `ISLANDS` — hardcoded geometry, never move to data files
- All lore/world data loaded via `fetch('/data/...')` in a `useEffect` on mount
- `parseCSV(text)` utility is defined at top of component — handles quoted fields
- Data loading sets `dataLoaded = true` after all fetches complete
- Loading screen renders until `dataLoaded` is true
- All hooks run before the `if (!dataLoaded) return` guard — never put hooks after it
- D3 zoom useEffect depends on `[dataLoaded]` — do not change this
- Terrain canvas `useMemo` depends on `[dataLoaded]` — do not change this
- `T` = theme object · `k` = zoom scale · `currentYear` = active timeline year
- Layer toggles live in `layers` state object

## Completed Features
✅ Map legend · ✅ localStorage auto-save · ✅ Keyboard shortcuts · ✅ External data files
✅ 30 locations · ✅ Factions & politics · ✅ Flora & fauna icons · ✅ Divine sites
✅ Timeline events · ✅ Trade routes · ✅ JSON export/import · ✅ SVG screenshot
✅ Visual noise reduction · ✅ Search filters · ✅ PWA offline support

## Pending Tasks (priority order)
1. `#30` Mobile & touch support
2. `#28` Print / export PDF
3. `#33` Dark/light UI themes
4. `#29` Embed / read-only mode
5. `#14` Custom location icons
6. `#9`  Story arcs system
7. `#10` Lore journal
8. `#8`  Character tracker
9. `#15` Animate timeline-driven map changes
10. `#12` Undo/redo
11. `#18` Biome zones
12. `#19` Depth-shaded ocean & natural rivers
13. `#17` Mountain ranges with visible peaks
14. `#16` Fractal coastline generation
15. `#31` Web Worker terrain generation

## How to Use This Skill

Pass an argument to focus the task:

- `/map-dev` — general assistance, read context and help with whatever is needed
- `/map-dev add-location` — add new locations to `locations.csv` following conventions
- `/map-dev add-event` — add new events to `events.csv`
- `/map-dev debug` — diagnose and fix bugs in the component
- `/map-dev implement #30` — implement a specific task by number
- `/map-dev next` — implement the next pending task in priority order
- `/map-dev data-check` — validate all CSV/JSON files for consistency and integrity

## Your Behaviour

1. **Always read the file before editing** — never assume structure, the component is large and evolving
2. **Read data files** relevant to the task before writing to them
3. **Surgical edits only** — do not rewrite working sections
4. **Match existing style** — Vietnamese UI text, same JSX patterns, same `T.*` theme colours
5. **Zoom-responsive sizing** — always `Math.max(minVal, displayVal/k)` for SVG element sizes
6. **Report clearly** — after edits, summarise exactly what changed and why

---

$ARGUMENTS
