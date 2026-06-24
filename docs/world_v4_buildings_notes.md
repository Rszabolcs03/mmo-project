# World V4 Building Art Notes

## Goal

This is a standalone V4 building art pass. It does not regenerate the full world map yet.

## Files

- `public/maps/tilesets/world_v4_buildings.png`
- `public/maps/tilesets/world_v4_buildings.tsx`
- `public/maps/tilesets/world_v4_props.png`
- `public/maps/tilesets/world_v4_props.tsx`
- `public/maps/tilesets/world_v4_preview_terrain.png`
- `public/maps/tilesets/world_v4_preview_terrain.tsx`
- `public/maps/tilesets/world_v4_building_prefabs.json`
- `public/maps/building_preview_v4.tmj`

Generator-compatible mirrors are also written to:

- `public/assets/tilesets/world_v4_buildings.png`
- `public/tilesets/world_v4_buildings.tsx`
- `public/assets/tilesets/world_v4_props.png`
- `public/tilesets/world_v4_props.tsx`

## Building Prefabs

- `small_cottage`: Small Cottage, 3x3, village, start tile 0
- `medium_house`: Medium House, 4x4, village, start tile 4
- `large_house`: Large House, 5x4, town, start tile 9
- `town_hall`: Town Hall, 7x6, civic, start tile 15
- `inn_tavern`: Inn / Tavern, 6x5, town, start tile 23
- `blacksmith`: Blacksmith, 5x4, crafting, start tile 224
- `chapel_temple`: Chapel / Temple, 5x6, civic, start tile 230
- `stable`: Stable, 6x4, farm, start tile 236
- `warehouse`: Warehouse, 6x5, dock, start tile 243
- `farm_house`: Farm House, 4x4, farm, start tile 250
- `barn`: Barn, 6x5, farm, start tile 448
- `market_stall_set`: Market Stall Set, 5x3, market, start tile 455
- `guard_post`: Guard Post, 4x4, military, start tile 461
- `watchtower`: Watchtower, 3x6, military, start tile 466
- `dock_building`: Dock Building, 6x4, dock, start tile 470
- `ruined_house_small`: Ruined House Small, 4x4, ruins, start tile 672
- `ruined_house_large`: Ruined House Large, 5x4, ruins, start tile 677
- `city_house_row`: City House Row, 8x5, city, start tile 683
- `gatehouse`: Gatehouse, 7x5, military, start tile 692
- `asterfall_villa`: Asterfall Villa, 6x5, city, start tile 896
- `blue_roof_shop`: Blue Roof Shop, 5x4, city, start tile 903
- `apothecary_house`: Apothecary House, 4x4, city, start tile 909
- `corner_townhouse`: Corner Townhouse, 5x5, city, start tile 914
- `guild_hall`: Guild Hall, 7x6, civic, start tile 920
- `red_townhouse`: Red Townhouse, 4x5, city, start tile 1120
- `green_townhouse`: Green Townhouse, 4x5, city, start tile 1125
- `city_bakery`: City Bakery, 5x4, city, start tile 1130
- `courtyard_house`: Courtyard House, 6x5, city, start tile 1136
- `tower_house`: Tower House, 4x6, city, start tile 1143
- `stone_manse`: Stone Manse, 5x5, civic, start tile 1147
- `city_bank`: Asterfall Bank, 7x6, service, start tile 1344
- `auction_house`: Auction House, 8x6, service, start tile 1352
- `weaponsmith_shop`: Weaponsmith, 5x4, service, start tile 1361
- `armorer_shop`: Armorer, 5x4, service, start tile 1367
- `arcane_shop`: Arcane Shop, 5x5, service, start tile 1600
- `alchemy_shop`: Alchemy Shop, 5x4, service, start tile 1606
- `profession_hall`: Profession Hall, 7x5, service, start tile 1612
- `tailor_shop`: Tailor Shop, 5x4, service, start tile 1620
- `leatherworker_shop`: Leatherworker, 5x4, service, start tile 1626
- `fishing_lodge`: Fishing Lodge, 5x4, service, start tile 1792
- `mining_office`: Mining Office, 5x4, service, start tile 1798
- `city_storage`: City Storage, 6x4, service, start tile 1804
- `service_kiosk`: Service Kiosk, 3x3, service, start tile 1811
- `canal_house`: Canal House, 5x4, city, start tile 1815

## Props

- well
- horizontal and vertical fence
- lamp post with animation
- torch with animation
- campfire with animation
- chimney smoke placeholder animation
- crates, barrels, cart, sign, flower patch, yard basket
- market crate and awning
- hay bale, trough, anvil, wood pile
- dock crate, rope coil, dock post, dock planks, boat

## Preview Map

Open `public/maps/building_preview_v4.tmj` in Tiled.

The preview contains:

- village square
- cottages and town houses
- town hall
- inn / tavern
- blacksmith
- chapel
- farm house, barn, stable, crop fields
- market stalls and market props
- guard post, watchtower, gatehouse
- dock building, warehouse, dock props, water corner
- ruined house variants

## Generator Integration Later

Use `world_v4_building_prefabs.json` to place prefabs by `prefabId`.

Placement rule:

1. Find prefab metadata.
2. Place tiles from `startTile + localY * columns + localX`.
3. Write those GIDs to the `Buildings` layer.
4. Apply only the prefab collision rectangle to the `Collision` layer.
5. Keep small props mostly non-colliding except fences/buildings/water.

This keeps the system compatible with the existing region world generator while allowing better visual building art.
