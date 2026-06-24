# World Map V3 Notes

## Scale

- Logical world size: 4000x4000 tiles.
- Tile size: 32px.
- Region split: 5x5.
- Region size: 800x800 tiles.
- Tiled world file: `public/maps/world_continent_v3.world`
- Region registry: `public/maps/world_regions_v3.json`
- Region files: `public/maps/world_region_X_Y_v3.tmj`

## Regions

- `0,0`: Asterfall Green - gentle starter woodland and hidden groves
- `1,0`: Brightwater Ford - river crossing village, mills, and bridges
- `2,0`: Sunhill Marches - rolling hills and watch roads
- `3,0`: Crownroad Fields - northern farm road and market hamlets
- `4,0`: Saltwind Quay - cliff harbor, beaches, and dockyards
- `0,1`: Elderbough Wilds - dense old forest with glades and shrines
- `1,1`: Hearthmere Farms - wide farms, hedges, and rural lanes
- `2,1`: Lionsgate Approach - outer city fields and river road
- `3,1`: Velorian Ruins - fallen imperial avenue and broken towers
- `4,1`: Pinewatch Weald - eastern pine forest and hunter tracks
- `0,2`: Glassmere Lakes - lake district with fishing docks and reeds
- `1,2`: Bannerfall Downs - old battlefield, meadows, and memorial stones
- `2,2`: Lionsgate City - large central city and trade crossroads
- `3,2`: Murkfen Verge - wetland border, raised roads, and stilt huts
- `4,2`: Seabriar Coast - coastal road, sea caves, and lookouts
- `0,3`: Cloudspine Foothold - western mountain gate and high trails
- `1,3`: Ironcrag Hold - mining town, quarry yards, and cliff paths
- `2,3`: Frostgate Pass - major mountain pass and stone bridge
- `3,3`: Blackreed Marsh - dark marsh pools and old causeways
- `4,3`: Tidefallen Shore - ruined coast and drowned imperial docks
- `0,4`: Windbreak Isles - remote coast, ferry landing, and sea road
- `1,4`: Ambergrain Reach - dry southern farms and amber fields
- `2,4`: Dawnwatch Bastion - southern fortress and caravan road
- `3,4`: Old Crown Expanse - ancient temples, causeways, and gardens
- `4,4`: Shadowfen Frontier - dangerous wild end zone with dark woods

## Biomes

- `emerald_vale`: Emerald Starter Vale, tileset `world_v3_emerald_vale.tsx`
- `golden_fields`: Golden Countryside, tileset `world_v3_golden_fields.tsx`
- `elderwood`: Elderwood Deep Forest, tileset `world_v3_elderwood.tsx`
- `silver_river`: Silver Riverlands, tileset `world_v3_silver_river.tsx`
- `sunhill`: Sunhill Downs, tileset `world_v3_sunhill.tsx`
- `cloudspine`: Cloudspine Pass, tileset `world_v3_cloudspine.tsx`
- `ironcrag`: Ironcrag Highlands, tileset `world_v3_ironcrag.tsx`
- `murkfen`: Murkfen Marsh, tileset `world_v3_murkfen.tsx`
- `old_empire`: Old Empire Ruins, tileset `world_v3_old_empire.tsx`
- `saltwind`: Saltwind Coast, tileset `world_v3_saltwind.tsx`
- `amber_steppe`: Amber Steppe, tileset `world_v3_amber_steppe.tsx`
- `shadowfen`: Shadowfen Wilds, tileset `world_v3_shadowfen.tsx`

## Terrain Shape Pass

The current V3 terrain pass focuses on organic natural shapes:

- Lakes use asymmetric lobe/cut/island masks instead of clean ellipses.
- Rivers use deterministic meander paths, variable width, local widenings, small branches, and noisy bank edges.
- Small fordable stream branches add riverland texture without blocking movement.
- Mountains are generated from ridge polylines with foothill shoulders, not isolated grey blobs.
- Biome borders use noisy transition bands and region-edge blending so neighboring zones mix more naturally.
- Shorelines mix sandy, grassy, and rocky sections with extra bank/reed/stone detail around rivers, lakes, marshes, and coast-adjacent areas.
- Ground tile noise is intentionally reduced; most small texture lives on `TerrainDetails` or `Decor`.
- Roads use narrower main/secondary/trail widths with meandered paths and subtle width wobble.
- Playable natural detail is placed on `TerrainDetails` and `Decor`: forest edges, clearings, shore props, foothill rocks, reeds, logs, stumps, and hidden camp-like details.
- Settlement landmarks add plaza/courtyard/path/farm/dock readability patches around the prefab buildings.
- Asterfall City in `world_region_0_0_v3` is the post-starting-zone level 10-15 hub with a city safe zone, an outskirts leveling zone, NPCs, quest givers, and nearby enemy spawn areas.

## Landmarks

- `asterfall_city`: Asterfall City, city_hub, world tile 560,420
- `greenwake_lodge`: Greenwake Lodge, lodge, world tile 185,625
- `brightwater_ford`: Brightwater Ford, village, world tile 1110,530
- `sunhill_watch`: Sunhill Watch, fort, world tile 1850,620
- `crownroad_market`: Crownroad Market, town, world tile 2760,470
- `saltwind_quay`: Saltwind Quay, harbor, world tile 3550,600
- `elderbough_sanctum`: Elderbough Sanctum, grove, world tile 560,1120
- `hearthmere`: Hearthmere, farmstead, world tile 1160,1260
- `willowmill`: Willowmill, mill, world tile 1900,1240
- `velorian_gate`: Velorian Gate, ruins, world tile 2740,1160
- `pinewatch_camp`: Pinewatch Camp, camp, world tile 3480,1220
- `glassmere_ferry`: Glassmere Ferry, dock, world tile 640,1860
- `bannerfall_memorial`: Bannerfall Memorial, battlefield, world tile 1260,2040
- `lionsgate_city`: Lionsgate City, city, world tile 2050,1970
- `reedmere`: Reedmere, village, world tile 2910,2040
- `seabriar_light`: Seabriar Light, watchtower, world tile 3620,2100
- `cloudspine_gate`: Cloudspine Gate, fort, world tile 520,2700
- `ironcrag_hold`: Ironcrag Hold, mining_town, world tile 1210,2850
- `frostgate_span`: Frostgate Span, bridge_landmark, world tile 2040,2800
- `blackreed_crossing`: Blackreed Crossing, marsh_camp, world tile 2920,2900
- `tidefallen_abbey`: Tidefallen Abbey, ruins, world tile 3500,2860
- `windbreak_landing`: Windbreak Landing, harbor, world tile 520,3540
- `ambergrain`: Ambergrain, farmstead, world tile 1160,3480
- `dawnwatch_bastion`: Dawnwatch Bastion, fortress, world tile 2000,3420
- `old_crown_temple`: Old Crown Temple, temple_ruins, world tile 2870,3460
- `shadowfen_edge`: Shadowfen Edge, wild_camp, world tile 3560,3520
- `cave_starfall`: Starfall Cave, cave_entrance, world tile 1540,2920, transition target `starfall_cave`
- `dungeon_old_crown`: Old Crown Depths, dungeon_entrance, world tile 2890,3540, transition target `old_crown_depths`
- `boat_windbreak_saltwind`: Windbreak Ferry, boat_route, world tile 560,3580, transition target `saltwind_quay`
- `fernroot_hideout`: Fernroot Hideout, hidden_cabin, world tile 730,720
- `moonpetal_garden`: Moonpetal Garden, hidden_garden, world tile 760,1330
- `brookbend_camp`: Brookbend Camp, forest_camp, world tile 1460,1540
- `broken_wagon`: Broken Wagon, roadside_camp, world tile 1560,2200
- `mossveil_shrine`: Mossveil Shrine, shrine, world tile 2630,1510
- `reedhook_spot`: Reedhook Spot, fishing_spot, world tile 3060,2240
- `highroad_watch`: Highroad Watch, watchtower_ruin, world tile 1890,2660
- `starfall_overlook`: Starfall Overlook, cave_mouth, world tile 1680,3090
- `sunken_court`: Sunken Court, hidden_garden, world tile 3220,3200
- `shadowroot_cache`: Shadowroot Cache, forest_camp, world tile 3750,3740
- `old_willow_ruins`: Old Willow Ruins, ruins, world tile 930,920
- `northspring_cave`: Northspring Cave, cave_mouth, world tile 2200,940
- `lakebend_shrine`: Lakebend Shrine, shrine, world tile 500,1980
- `greywatch_pass`: Greywatch Pass, watchtower_ruin, world tile 1725,2730
- `hollowfen_cabin`: Hollowfen Cabin, hidden_cabin, world tile 3240,2650
- `whispering_camp`: Whispering Camp, forest_camp, world tile 3350,1450
- `saltcliff_overlook`: Saltcliff Overlook, watchtower, world tile 3820,940
- `amber_copse`: Amber Copse, hidden_garden, world tile 1550,3560
- `old_bridge_camp`: Old Bridge Camp, roadside_camp, world tile 2100,2300
- `southmere_fishing`: Southmere Fishing Spot, fishing_spot, world tile 3330,3280
- `stormfall_cave`: Stormfall Cave, cave_mouth, world tile 2460,2920
- `mossroot_ruins`: Mossroot Ruins, ruins, world tile 780,2520

## Layers

- `Ground`: base biome terrain.
- `Water`: rivers, lakes, ocean, shallow water.
- `TerrainDetails`: banks, flowers, tall grass, crops, road edge blends, ruin floor detail.
- `Roads`: main roads, trails, mountain passes, plaza tiles.
- `Decor`: foliage, props, fences, bridges, docks, boats, rocks, ruins props.
- `Buildings`: multi-tile prefab buildings.
- `Collision`: hidden gameplay collision. V3 keeps collision minimal: water, buildings, and fences. Bridges clear water collision.
- `Zones`: gameplay zone rectangles such as the Asterfall hub and its level 10-15 outskirts.
- `Spawns`: enemy spawn areas. V3 currently uses these only around Asterfall City for level 10-15 progression.
- `BossSpawns`: reserved for future boss objects.
- `NPCs`: city/service/flavor NPC markers.
- `QuestGiver`: functional quest giver markers parsed by the game.
- `raceStart`: player arrival markers, including `asterfall_city_arrival`.
- `Graveyards`: respawn markers.
- `RegionMarkers`: region identity and neighbor debug markers.
- `RoadMarkers`: debug-only road continuation markers at region borders.
- `Landmarks`: player-facing landmark/building markers.
- `Transitions`: only real transition-like entries such as caves, dungeons, or boat routes.

## Asterfall City Hub

- Region: `world_region_0_0_v3.tmj`.
- Landmark: `asterfall_city`, display name `Asterfall City`.
- Arrival marker: `raceStart/asterfall_city_arrival`.
- Safe hub zone: `zone_asterfall_city_hub`.
- Leveling zone: `leveling_zone_asterfall_outskirts_10_15`.
- Quest givers: Quartermaster Vale, Captain Arden, Huntmaster Brann, Sister Maera.
- Nearby level 10-15 enemy spawns: road bandits, dire wolves, corrupted treants, and field ambushers.

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

There are no `road_transition_*` objects in V3. Roads are seamless world geometry; region streaming should use global coordinates, not teleport objects.

## Adding Enemies And NPCs Later

Add future gameplay layers separately, for example `EnemySpawns`, `NpcSpawns`, or `QuestGivers`. Keep them out of V3 terrain generation unless gameplay placement is being intentionally authored.

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

Use `world_regions_v3.json` as the registry.

## Building Art

V3 region maps now use the standalone V4 building art pack:

- Tileset: `public/tilesets/world_v4_buildings.tsx`
- Source image: `public/assets/tilesets/world_v4_buildings.png`
- Prefab metadata: `public/maps/tilesets/world_v4_building_prefabs.json`

The full V3 world layout remains the same, but all settlement building placements use V4 prefab GIDs.

1. Store player position as global world tile or pixel coordinates.
2. Compute region with `floor(tileX / 800)`, `floor(tileY / 800)`.
3. Load the current region plus neighboring regions.
4. Draw each map at `region.x * 32`, `region.y * 32`.
5. Collision lookup should resolve global tile coordinates into the correct region-local tile.
6. Bridges are walkable because their generated areas clear water collision.
