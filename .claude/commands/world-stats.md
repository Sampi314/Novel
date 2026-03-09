# World Stats Skill

Quickly scan all data files and report a summary of the Cố Nguyên Giới world data.

## Steps

1. Read all data files in `public/data/`:
   - `world.json` — count eras, territories, leyLines, mistZones, rivers, factions, fauna, divineSites
   - `locations.csv` — count locations by type, race, qi level
   - `characters.csv` — count characters by faction, role
   - `events.csv` — count events by era, type
   - `trade_routes.csv` — count routes by type (land/sea)

2. Present a clean summary table showing:
   - Total counts per category
   - Breakdown by sub-type
   - Any gaps or imbalances (e.g. "No events in Thái Sơ Kỷ era", "Only 1 port location")
   - Data quality notes (empty fields, missing descriptions)

3. Suggest areas that need more content based on gaps found

## Output Format

```
=== Cố Nguyên Giới World Stats ===

Locations: X total
  - capital: X | city: X | port: X | sacred: X | ...
  - By race: Long Tộc X | Nhân Tộc X | ...

Characters: X total
  - By faction: ...

Events: X total
  - By era: ...

Trade Routes: X total
  - land: X | sea: X

World Data:
  - Territories: X | Ley Lines: X | Rivers: X | ...

Gaps & Suggestions:
  - ...
```

$ARGUMENTS
