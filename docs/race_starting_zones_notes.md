# Race Starting Zones

Generated 200x200 Tiled maps for dwarf, undead, elf, and orc starting areas.

## Files
- `public/maps/dwarf_starting_zone.tmj` with `public/tilesets/dwarf_starting_zone.tsx` and `public/assets/tilesets/dwarf_starting_zone.png`
- `public/maps/undead_starting_zone.tmj` with `public/tilesets/undead_starting_zone.tsx` and `public/assets/tilesets/undead_starting_zone.png`
- `public/maps/elf_starting_zone.tmj` with `public/tilesets/elf_starting_zone.tsx` and `public/assets/tilesets/elf_starting_zone.png`
- `public/maps/orc_starting_zone.tmj` with `public/tilesets/orc_starting_zone.tsx` and `public/assets/tilesets/orc_starting_zone.png`

## Race Starts
- dwarf: object layer `raceStart`, point `dwarf_start`, zone `dwarf_starting_area`
- undead: object layer `raceStart`, point `undead_start`, zone `undead_starting_area`
- elf: object layer `raceStart`, point `elf_start`, zone `elf_starting_area`
- orc: object layer `raceStart`, point `orc_start`, zone `orc_starting_area`

## Enemy Types
- dwarf: `snow-wolf` in `snow_wolf_spawn_frostwood`
- dwarf: `frost-trogg` in `frost_trogg_spawn_pass`
- dwarf: `cave-spider` in `cave_spider_spawn_mine`
- undead: `grave-rat` in `grave_rat_spawn_cryptroad`
- undead: `plaguehound` in `plaguehound_spawn_plaguewood`
- undead: `restless-dead` in `restless_dead_spawn_crypt`
- elf: `forest-sprite` in `forest_sprite_spawn_grove`
- elf: `corrupted-treant` in `corrupted_treant_spawn_moonpond`
- elf: `nightstalker` in `nightstalker_spawn_shadowwoods`
- orc: `plainstrider` in `plainstrider_spawn_plains`
- orc: `scorpion` in `scorpion_spawn_dustwash`
- orc: `quilboar` in `quilboar_spawn_thorncamp`
- dwarf boss: `granite-matriarch` in `granite_matriarch_01`
- undead boss: `crypt-warden` in `crypt_warden_01`
- elf boss: `moonshade-stag` in `moonshade_stag_01`
- orc boss: `bloodtusk-chief` in `bloodtusk_chief_01`

Human-zone enemy sprites were also generated for wolf, kobold, bandit, restless-dead, and elder-briarheart.

## Extension
Add new spawn rectangles to the Spawns layer with `enemyType`, `spawnId`, `maxAlive`, `respawnMin`, and `respawnMax` custom properties. Add boss rectangles to BossSpawns with `bossType`.
