# World Box Teszt

Terrain-only test world generated from the God-simulator-style reference layout.

## Files

- Tiled world: `public/maps/world-box-teszt.world`
- Region registry: `public/maps/world-box-teszt-regions.json`
- Regions: `public/maps/world-box-teszt-region_X_Y.tmj`
- Terrain tileset: `public/tilesets/world-box-teszt-terrain.tsx`
- Terrain image: `public/assets/tilesets/world-box-teszt-terrain.png`
- Preview: `public/maps/previews/world-box-teszt-preview.png`
- Generator: `scripts/generate-world-box-teszt.mjs`

## Size

- Logical world size: 4000x4000 tiles
- Region grid: 5x5
- Region size: 800x800 tiles
- Tile size: 32x32

## Layers

- `Ground`: ocean, coast, grass, forest, ash, mountain base
- `Water`: shallow sea, foam, lakes, marsh pools
- `TerrainDetails`: dense forest, mountain, crystal, swamp and ash overlays
- `Roads`: empty for now
- `Decor`: empty for now
- `Buildings`: empty for now
- `Collision`: hidden water collision mask
- `RegionMarkers`: debug/player-facing zone metadata
- `RoadMarkers`, `Landmarks`, `Transitions`: empty for now

## Region List

- 0,0: Northwest Deep Sea (ocean)
- 1,0: Western Crownwood (forest)
- 2,0: North Gate Channel (coast)
- 3,0: Crystal Crown (crystal_mountain)
- 4,0: Northeast Wildwood (old_forest)
- 0,1: Westwatch Coast (forest_coast)
- 1,1: Central Greenbelt (dense_forest)
- 2,1: Grey Spine (mountain)
- 3,1: Eastern Inlet (coast)
- 4,1: East Hook Coast (forest_coast)
- 0,2: Southwest Woods (dense_forest)
- 1,2: Obsidian Scar (ashlands)
- 2,2: Bluefen Basin (lake_forest)
- 3,2: Inner Bay (coast)
- 4,2: Eastfen Woods (swamp_forest)
- 0,3: Western Shelf (coast)
- 1,3: South Greenreach (forest)
- 2,3: Darkroot Hollow (ashlands)
- 3,3: Southfen Coast (swamp)
- 4,3: Southeast Wilds (old_forest)
- 0,4: Far South Sea (ocean)
- 1,4: Little South Isle (island_forest)
- 2,4: South Cape (coast_forest)
- 3,4: Southeast Lagoon (coast)
- 4,4: Far East Sea (ocean)

## Notes

- No cities, buildings, props, NPCs, enemies, roads, dungeons, or teleport transitions are generated.
- The 25 regions are generated from global coordinates, so coastlines, forests, mountains, lakes, and biome borders continue across region edges.
- This map is intentionally separate from the current v3 playable world and does not replace it.
