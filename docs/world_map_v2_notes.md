# World Map V2 Notes

## Scale

- Logical world size: 4000x4000 tiles.
- Tile size: 32px.
- Region split: 5x5.
- Region size: 800x800 tiles.
- Tiled world file: `public/maps/world_continent_v2.world`
- Region registry: `public/maps/world_regions_v2.json`
- Region files: `public/maps/world_region_X_Y_v2.tmj`

## Regions

- `0,0`: Western Wildwood - small hunting lodge and old trees
- `1,0`: Miller River Crossing - bridge village and riverside farms
- `2,0`: Greyspur Foothills - foothills below the mountain road
- `3,0`: Northgate Trade Road - northern market city and trade fields
- `4,0`: Saltcliff Harbor - coastal cliffs and a working harbor
- `0,1`: Deepbough Forest - dense forest and hidden clearings
- `1,1`: Hearthfield Farms - human farms and windbreak fences
- `2,1`: Stonebridge Heartlands - main hub approach and river road
- `3,1`: Eldergate Ruins - old ruined road and broken towers
- `4,1`: Eastpine Wood - eastern forest and hunter trails
- `0,2`: Mirrorlake Shores - large lake region and fishing spots
- `1,2`: Redbanner Fields - old battlefield and memorial hills
- `2,2`: Stonebridge City - large central city and crossroads
- `3,2`: Mirewatch Border - swamp edge and raised road
- `4,2`: Seabright Road - coastal road and cliffside lookout
- `0,3`: Westwall Mountains - western mountains and high passes
- `1,3`: Coppervein Mining Town - mining town and quarry roads
- `2,3`: Highpass Ridge - major highland pass and bridges
- `3,3`: Blackfen Marsh - marshland and dark forest pools
- `4,3`: Drowned Coast - ruined coast and old docks
- `0,4`: Farwatch Isles - remote islands and sea road
- `1,4`: Southbarley Farms - southern farms and dry fields
- `2,4`: Sunward Fortress - southern fortress and road camp
- `3,4`: Oldstone Expanse - ancient temples and broken causeways
- `4,4`: Thornwild End - dangerous wild biome and final frontier

## Biomes

- `starter_forest`: Lush Starter Forest, tileset `world_v2_starter_forest.tsx`
- `countryside`: Human Countryside, tileset `world_v2_countryside.tsx`
- `old_forest`: Dense Old Forest, tileset `world_v2_old_forest.tsx`
- `riverlands`: Riverlands, tileset `world_v2_riverlands.tsx`
- `hills`: Rolling Hills, tileset `world_v2_hills.tsx`
- `mountain_pass`: Mountain Pass, tileset `world_v2_mountain_pass.tsx`
- `rocky_highlands`: Rocky Highlands, tileset `world_v2_rocky_highlands.tsx`
- `swamp`: Swamp Marsh, tileset `world_v2_swamp.tsx`
- `ancient_ruins`: Ancient Ruined Zone, tileset `world_v2_ancient_ruins.tsx`
- `coastal`: Coastal Harbor Zone, tileset `world_v2_coastal.tsx`
- `dry_grassland`: Dry Grassland Edge, tileset `world_v2_dry_grassland.tsx`
- `wild_end`: Wild End Zone, tileset `world_v2_wild_end.tsx`

## Landmarks

- `hollowpine_lodge`: Hollowpine Lodge, lodge, world tile 370,360
- `miller_crossing`: Miller Crossing, village, world tile 1080,520
- `greyspur_watch`: Greyspur Watch, fort, world tile 1860,520
- `northgate`: Northgate, town, world tile 2820,430
- `saltcliff_harbor`: Saltcliff Harbor, harbor, world tile 3570,600
- `deepbough_grove`: Deepbough Grove, grove, world tile 510,1040
- `hearthfield`: Hearthfield, farmstead, world tile 1160,1210
- `riverwatch_mill`: Riverwatch Mill, mill, world tile 1940,1180
- `eldergate_ruins`: Eldergate Ruins, ruins, world tile 2740,1130
- `eastpine_camp`: Eastpine Camp, camp, world tile 3500,1180
- `mirrorlake_ferry`: Mirrorlake Ferry, dock, world tile 620,1860
- `redbanner_memorial`: Redbanner Memorial, battlefield, world tile 1250,2030
- `stonebridge_city`: Stonebridge City, city, world tile 2010,1940
- `mirewatch`: Mirewatch, village, world tile 2880,2010
- `seabright_lookout`: Seabright Lookout, watchtower, world tile 3620,2050
- `westwall_gate`: Westwall Gate, fort, world tile 510,2710
- `coppervein`: Coppervein, mining_town, world tile 1210,2840
- `highpass_bridge`: Highpass Bridge, bridge_landmark, world tile 2020,2790
- `blackfen_crossing`: Blackfen Crossing, marsh_camp, world tile 2920,2920
- `drowned_abbey`: Drowned Abbey, ruins, world tile 3500,2870
- `farwatch_landing`: Farwatch Landing, harbor, world tile 520,3530
- `southbarley`: Southbarley, farmstead, world tile 1180,3470
- `sunward_keep`: Sunward Keep, fortress, world tile 2000,3400
- `oldstone_temple`: Oldstone Temple, temple_ruins, world tile 2870,3460
- `thornwild_edge`: Thornwild Edge, wild_camp, world tile 3550,3520
- `cave_emberdeep`: Emberdeep Cave, cave_entrance, world tile 1540,2890, transition target `emberdeep_cave`
- `dungeon_oldstone`: Oldstone Depths, dungeon_entrance, world tile 2890,3540, transition target `oldstone_depths`
- `boat_farwatch_saltcliff`: Farwatch Ferry, boat_route, world tile 560,3575, transition target `saltcliff_harbor`
- `whispering_hideaway`: Whispering Hideaway, hidden_cabin, world tile 720,735
- `moonwell_garden`: Moonwell Garden, hidden_garden, world tile 740,1320
- `willowbend_camp`: Willowbend Camp, forest_camp, world tile 1460,1540
- `crooked_cart`: Crooked Cart, roadside_camp, world tile 1560,2200
- `mossgate_shrine`: Mossgate Shrine, shrine, world tile 2630,1510
- `reedhook_fishing_spot`: Reedhook Fishing Spot, fishing_spot, world tile 3060,2240
- `old_watch_underpass`: Old Watch Underpass, watchtower_ruin, world tile 1890,2660
- `emberdeep_overlook`: Emberdeep Overlook, cave_mouth, world tile 1680,3090
- `sunken_garden`: Sunken Garden, hidden_garden, world tile 3220,3200
- `thornroot_cache`: Thornroot Cache, forest_camp, world tile 3750,3740

## Layers

- `Ground`: base biome terrain.
- `Water`: rivers, lakes, ocean, shallow water.
- `TerrainDetails`: banks, flowers, tall grass, crops, road edge blends, ruin floor detail.
- `Roads`: main roads, trails, mountain passes, plaza tiles.
- `Decor`: foliage, props, fences, bridges, docks, boats, rocks, ruins props.
- `Buildings`: multi-tile prefab buildings.
- `Collision`: hidden gameplay collision. V2 keeps collision minimal: water, buildings, and fences. Bridges clear water collision.
- `RegionMarkers`: region identity and neighbor debug markers.
- `RoadMarkers`: debug-only road continuation markers at region borders.
- `Landmarks`: player-facing landmark/building markers.
- `Transitions`: only real transition-like entries such as caves, dungeons, or boat routes.

## Map UI

- Normal map open (`M` or minimap click): zone map mode focused on the current or selected zone.
- Right click on the map panel: toggles full world map mode.
- Full world map mode: shows the whole 4000x4000 tile world with biome-colored zones, roads, rivers, lakes, and major landmarks.
- Clicking a zone in full world mode selects that zone, shows its `displayName`, and switches back to zone map mode.
- Player-facing names come from `displayName`; technical object names and debug markers stay hidden.

## Zone Metadata

Each region marker and registry region contains:

- `zoneId`
- `displayName`
- `biomeType`
- `description`
- `recommendedLevel`

## Marker Properties

Player-facing marker example:

```json
{
  "type": "landmark",
  "landmarkId": "stonebridge_city",
  "displayName": "Stonebridge City",
  "showOnMap": true,
  "debugOnly": false
}
```

Road marker example:

```json
{
  "type": "roadMarker",
  "roadId": "main_east_road",
  "connectsToRegion": "3,2",
  "showOnMap": false,
  "debugOnly": true
}
```

There are no `road_transition_*` objects in V2. Roads are seamless world geometry; region streaming should use global coordinates, not teleport objects.

## Adding Enemies And NPCs Later

Add future gameplay layers separately, for example `EnemySpawns`, `NpcSpawns`, or `QuestGivers`. Keep them out of V2 terrain generation unless gameplay placement is being intentionally authored.

Recommended object properties:

- `spawnId`
- `displayName`
- `faction`
- `minLevel`
- `maxLevel`
- `population`
- `respawnMs`
- `debugOnly`

## Region Streaming Hook

Use `world_regions_v2.json` as the registry.

1. Store player position as global world tile or pixel coordinates.
2. Compute region with `floor(tileX / 800)`, `floor(tileY / 800)`.
3. Load the current region plus neighboring regions.
4. Draw each map at `region.x * 32`, `region.y * 32`.
5. Collision lookup should resolve global tile coordinates into the correct region-local tile.
6. Bridges are walkable because their generated areas clear water collision.
