# World Map

- File: `public/maps/world_map.tmj`
- Size: 300x600 tiles, 32px tiles.
- Main city arrival points: `human_road_arrival`, `dwarf_road_arrival`, `undead_road_arrival`, `elf_road_arrival`, `orc_road_arrival`.
- Progression zones:
  - `greenbelt_fields` level 10, enemy `road-bandit`
  - `pinewood_hollow` level 14, enemy `dire-wolf`
  - `stormhill_highlands` level 17, enemy `stone-gnoll`
  - `ashen_frontier` level 20, enemy `ember-wraith`
- Bosses:
  - `varro-the-tollkeeper`
  - `thornmaw-alpha`
  - `granite-ogre`
  - `ash-witch`

The city and villages use prefab building tiles from `world_buildings_v1.tsx`. The dwarf, undead, elf, and orc starting maps now use `race_buildings_v1.tsx` to replace the small generated house clusters with larger readable prefab buildings.
