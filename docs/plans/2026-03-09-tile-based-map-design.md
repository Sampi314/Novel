# Tile-based Procedural World Map — Design Document

## Goal

Replace FMG iframe with a custom tile-based canvas map (Google Maps style) that:
- Procedurally generates terrain using noise functions
- Supports multi-scale zoom from world view down to street level
- Evolves gradually across 7 eras (terrain, rivers, cities, territories)
- Generates city/village layouts procedurally when zooming in
- Performs well via tile caching and web workers

## Architecture

```
┌─────────────────────────────────────────────┐
│  MapViewer.jsx (viewport, pan/zoom, input)  │
├─────────────────────────────────────────────┤
│  TileManager.js (load/cache/render tiles)   │
├─────────────────────────────────────────────┤
│  Tile Generators (per zoom level range)     │
│  ┌───────┬──────────┬───────────┬────────┐  │
│  │ Z0-3  │  Z4-7    │  Z8-11    │ Z12-15 │  │
│  │World  │ Region   │ City      │ Street │  │
│  │terrain│ rivers   │ buildings │ detail │  │
│  │coasts │ roads    │ walls     │ people │  │
│  └───────┴──────────┴───────────┴────────┘  │
├─────────────────────────────────────────────┤
│  WorldSeed.js (deterministic noise + era)   │
└─────────────────────────────────────────────┘
```

## File Structure

```
src/map/
├── MapViewer.jsx            # Canvas viewport, zoom/pan, era slider, UI
├── TileManager.js           # Tile lifecycle: request, generate, cache, render
├── WorldSeed.js             # Deterministic seed system + era offset
├── generators/
│   ├── TerrainGenerator.js  # Heightmap, biomes, coastlines (zoom 0-3)
│   ├── RegionGenerator.js   # Rivers, forests, roads (zoom 4-7)
│   ├── CityGenerator.js     # City layouts, walls, districts (zoom 8-11)
│   └── DetailGenerator.js   # Buildings, streets, markets (zoom 12-15)
├── workers/
│   └── tileWorker.js        # Web Worker for off-thread tile generation
├── utils/
│   ├── noise.js             # Simplex noise implementation
│   ├── tileCache.js         # LRU cache (~200 tiles)
│   └── colors.js            # Xianxia color palette per biome
└── layers/
    ├── TerritoryLayer.js    # Territory polygon overlays per era
    ├── LabelLayer.js        # City/region name labels (scale-dependent)
    └── MarkerLayer.js       # POI markers, quest locations
```

## Zoom Level Breakdown

| Zoom | Scale | Shows | Generation |
|------|-------|-------|------------|
| 0-3 | World | Continents, oceans, major mountain ranges | Heightmap noise → biome colors |
| 4-7 | Region | Rivers, forests, deserts, territory borders | River tracing, forest noise, borders |
| 8-11 | City | City outlines, roads, walls, districts | Procedural city layout (grid/organic) |
| 12-15 | Street | Individual buildings, markets, temples | Building footprints, street detail |

## Era System

### Seed Offset Approach
Each era uses a small offset added to the world seed, producing gradual terrain drift:

```
era_offset = era_index * 0.05
terrain_value = noise(x, y, base_seed + era_offset)
```

### Per-Era Changes
- **Terrain**: Coastlines shift slightly, new islands/lakes appear, mountains erode
- **Rivers**: Main rivers persist but tributaries change, new rivers form
- **Cities**: Cities from world.json data — founded/destroyed per era_founded/era_destroyed
- **Territories**: Territory polygons from world.json — era_start/era_end filtering
- **Biomes**: Forest coverage changes (deforestation in war eras, regrowth in peace)

### Era Definitions (from world.json)
1. Khai Linh Ky (-500,000) — primordial, dense forests, few settlements
2. Thai So Ky (0) — first civilizations, rivers define borders
3. Hon Don Ky (40,000) — chaotic zones appear, terrain scarred
4. Linh Nguyen Ky (80,000) — spiritual energy shapes terrain, ley lines visible
5. Van Toc Ky (130,000) — many races, diverse cities
6. Chien Loan Ky (170,000) — war damage, destroyed cities, burnt forests
7. Hien Dai Ky (200,000) — modern reconstruction, new cities

## Tile System Details

### Tile Coordinates
- Standard slippy map tile scheme: (x, y, zoom)
- World size at zoom 0: 1 tile (256x256px)
- World size at zoom N: 2^N x 2^N tiles
- Max zoom 15 → 32768 x 32768 tiles (but only generate visible ones)

### Tile Lifecycle
1. Viewport changes (pan/zoom) → TileManager calculates visible tile coords
2. Check LRU cache for each tile key `${era}-${z}-${x}-${y}`
3. Cache miss → send to Web Worker for generation
4. Worker returns ImageBitmap → cache and draw to main canvas
5. Tiles outside viewport + buffer → eligible for cache eviction

### Caching Strategy
- LRU cache, max ~200 tiles
- Key: `${era}-${z}-${x}-${y}` (era change = new tiles needed)
- Pre-fetch 1-tile buffer around viewport for smooth panning

### Web Worker
- Single worker handles generation requests via message queue
- Receives: { x, y, zoom, era, seed }
- Returns: ImageBitmap (transferable, zero-copy to main thread)
- Prioritizes tiles closest to viewport center

## MapViewer Component

### Props (from App.jsx)
```jsx
<MapViewer
  data={data}          // world.json + CSV data
  theme={theme}        // dark/light
  mapZoomTarget={mapZoomTarget}  // fly-to from other pages
/>
```

### UI Elements
- Canvas (full viewport)
- Era slider (bottom, 7 era markers)
- Zoom +/- buttons (corner)
- Mini-map (corner, optional)
- Location search
- Layer toggles (territories, labels, markers)
- Coordinates display

### Interactions
- Mouse wheel / pinch → zoom (centered on cursor)
- Click drag → pan
- Click location marker → info popup
- Double click → zoom in
- Era slider → crossfade between era terrain

## Integration with App.jsx

### Replace FMGEmbed
```jsx
// Before:
<FMGEmbed theme={theme} mapZoomTarget={mapZoomTarget} onNavigate={setActiveTab} />

// After:
<MapViewer data={data} theme={theme} mapZoomTarget={mapZoomTarget} />
```

### Keep existing data flow
- Locations from locations.csv (x, y, era_founded, era_destroyed)
- Territories from world.json (pts, era_start, era_end)
- Eras from world.json
- navigateToMap(x, y) still works — MapViewer accepts mapZoomTarget

### FMG cleanup
- Remove FMGEmbed.jsx
- Remove fmg/ directory (or keep for reference)
- Remove FMG proxy from vite.config.js
- Remove FMG build step from package.json
- Remove concurrently dependency

## Performance Targets

- 60fps pan/zoom on modern browsers
- Tile generation < 50ms per tile (via worker)
- Memory: ~200 cached tiles × 256KB ≈ 50MB max
- Initial load: show zoom 0-1 tiles within 500ms

## Implementation Phases

### Phase 1: Core Map Engine
- MapViewer with canvas, zoom/pan
- TileManager with cache
- TerrainGenerator (zoom 0-3): heightmap + biome coloring
- Era slider (basic, no crossfade yet)

### Phase 2: Region Detail
- RegionGenerator (zoom 4-7): rivers, forests
- TerritoryLayer overlay
- LabelLayer for city/region names
- Web Worker integration

### Phase 3: City Generation
- CityGenerator (zoom 8-11): procedural city layouts
- DetailGenerator (zoom 12-15): buildings, streets
- MarkerLayer for POIs

### Phase 4: Polish
- Era crossfade animation
- Mini-map
- Search functionality
- Fly-to animation (from other pages)
- Dark/light theme support
- Mobile touch support

## Dependencies
- No new npm dependencies needed
- Uses Canvas 2D API (built-in)
- Uses Web Workers API (built-in)
- Simplex noise implemented from scratch (small, ~100 lines)

## Decisions
- Tile size: 256x256px (standard, good balance of detail vs count)
- No WebGL — Canvas 2D is sufficient and simpler
- No external map library — custom implementation for full control
- Deterministic generation — same inputs always produce same output
- Era changes via seed offset — elegant, minimal data, natural-looking drift
