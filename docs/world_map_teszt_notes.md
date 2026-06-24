# Region-Based World Map Teszt

- World size: 4000x4000 tiles, 32px tiles.
- Region split: 5x5 files, each 800x800 tiles.
- Tiled world file: `public/maps/world_continent_teszt.world`
- Region registry: `public/maps/world_regions_teszt.json`
- Region files: `public/maps/world_region_X_Y_teszt.tmj`

The region maps are generated from global world coordinates, so terrain, roads, coastlines, and biome transitions line up across file borders.

## Biome Zones

- `greenvale`: Greenvale Lowlands, level 10, enemy `plainstrider`, tileset `world_test_greenvale.tsx`
- `westreach`: Westreach Coast, level 12, enemy `road-bandit`, tileset `world_test_westreach.tsx`
- `spinebreak`: Spinebreak Highlands, level 16, enemy `stone-gnoll`, tileset `world_test_spinebreak.tsx`
- `verdant`: Verdant Reach, level 18, enemy `forest-sprite`, tileset `world_test_verdant.tsx`
- `silverpeak`: Silverpeak Crown, level 21, enemy `snow-wolf`, tileset `world_test_silverpeak.tsx`
- `bogmire`: Bogmire Fen, level 22, enemy `plaguehound`, tileset `world_test_bogmire.tsx`
- `sunbreak`: Sunbreak Expanse, level 24, enemy `scorpion`, tileset `world_test_sunbreak.tsx`
- `stormroot`: Stormroot Basin, level 26, enemy `corrupted-treant`, tileset `world_test_stormroot.tsx`
- `ashen`: Ashen Frontier, level 28, enemy `ember-wraith`, tileset `world_test_ashen.tsx`

## Settlements And Landmarks

- `stoneford_city`: Stoneford City, city, world tile 1960,1880
- `westwatch`: Westwatch, village, world tile 660,1450
- `pineharbor`: Pineharbor, village, world tile 880,2420
- `ironpass_hold`: Ironpass Hold, fort, world tile 1120,760
- `moonwell_grove`: Moonwell Grove, village, world tile 2720,720
- `snowcap_watch`: Snowcap Watch, fort, world tile 2420,1060
- `fenwick_crossing`: Fenwick Crossing, village, world tile 3320,1660
- `sunspire_camp`: Sunspire Camp, camp, world tile 1700,3070
- `stormroot_refuge`: Stormroot Refuge, village, world tile 2940,2920
- `emberfall_ruins`: Emberfall Ruins, ruins, world tile 560,3200

## Editing Notes

- Open `world_continent_teszt.world` in Tiled to see all regions together.
- Edit one 800x800 region at a time for performance.
- Tile layers use Tiled `base64` + `zlib` compression to keep files small; the current game runtime will need loader support before these test regions can be played directly.
- If a border is edited by hand, mirror the same edge detail in the neighboring region or regenerate both from the script.
- Larger buildings are coherent multi-tile prefabs from `world_test_buildings.tsx`, not repeated 1x1 single-house tiles.
