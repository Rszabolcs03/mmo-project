import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const oldMapsDir = path.join(publicDir, 'maps_old');
const newMapsDir = path.join(publicDir, 'maps');
const publicTilesetsDir = path.join(publicDir, 'tilesets');
const publicAssetsTilesetsDir = path.join(publicDir, 'assets', 'tilesets');

const TILE_SIZE = 32;
const REGION_GRID = 5;
const REGION_TILES = 800;
const WORLD_TILES = REGION_GRID * REGION_TILES;
const CHUNK_TILES = 128;
const CHUNK_GRID = Math.ceil(WORLD_TILES / CHUNK_TILES);
const VERSION = 'v4-continent-01-runtime-chunks-1';
const TILED_GID_MASK = 0x1fffffff;

const TILE_LAYER_NAMES = [
  'Ground',
  'Water',
  'TerrainDetails',
  'Roads',
  'CityBase',
  'CityInteriors',
  'Decor',
  'Buildings',
  'CityRoofs',
  'Collision',
];

const OBJECT_LAYER_NAMES = [
  'Zones',
  'Spawns',
  'BossSpawns',
  'NPCs',
  'QuestGiver',
  'raceStart',
  'Graveyards',
  'InteriorZones',
  'RegionMarkers',
  'RoadMarkers',
  'Landmarks',
  'Props',
  'Transitions',
  'MajorZones',
  'PoiPlaceholders',
  'MacroBlockers',
];

const sharedTilesetNames = [
  'collision_debug.tsx',
  'collision_debug_v3.tsx',
  'dungeon_cavern.tsx',
  'dwarf_starting_zone.tsx',
  'elf_starting_zone.tsx',
  'human_buildings_v1.tsx',
  'human_starting_animated_v2.tsx',
  'human_starting_bridge_v4.tsx',
  'human_starting_foliage_v4.tsx',
  'human_starting_props_v2.tsx',
  'human_starting_props_v4.tsx',
  'human_starting_zone_v2.tsx',
  'orc_starting_zone.tsx',
  'race_buildings_v1.tsx',
  'terrain.tsx',
  'undead_starting_zone.tsx',
];

const continentTilesetNames = [
  'collision_debug_v3.tsx',
  'tamzia_building_interiors_v1.tsx',
  'tamzia_buildings_v2.tsx',
  'tamzia_city_bank_exterior.tsx',
  'tamzia_city_bank_interior.tsx',
  'tamzia_lights_large_v1.tsx',
  'tamzia_lights_v1.tsx',
  'tamzia_props_v1.tsx',
  'tamzia_town_hall_exterior.tsx',
  'tamzia_town_hall_interior.tsx',
  'world_v3_amber_steppe.tsx',
  'world_v3_cloudspine.tsx',
  'world_v3_elderwood.tsx',
  'world_v3_emerald_vale.tsx',
  'world_v3_golden_fields.tsx',
  'world_v3_ironcrag.tsx',
  'world_v3_murkfen.tsx',
  'world_v3_old_empire.tsx',
  'world_v3_props.tsx',
  'world_v3_saltwind.tsx',
  'world_v3_shadowfen.tsx',
  'world_v3_silver_river.tsx',
  'world_v3_sunhill.tsx',
  'world_v3_water.tsx',
  'world_v4_buildings.tsx',
  'world_v6_city.tsx',
];

const startingMaps = [
  {
    source: 'human_starting_zone_v4.tmj',
    destination: 'starting_zones/human/starting_human.tmj',
    canonicalId: 'starting_human',
  },
  {
    source: 'dwarf_starting_zone.tmj',
    destination: 'starting_zones/dwarf/starting_dwarf.tmj',
    canonicalId: 'starting_dwarf',
  },
  {
    source: 'elf_starting_zone.tmj',
    destination: 'starting_zones/elf/starting_elf.tmj',
    canonicalId: 'starting_elf',
  },
  {
    source: 'orc_starting_zone.tmj',
    destination: 'starting_zones/orc/starting_orc.tmj',
    canonicalId: 'starting_orc',
  },
  {
    source: 'undead_starting_zone.tmj',
    destination: 'starting_zones/neutral/starting_neutral.tmj',
    canonicalId: 'starting_neutral',
  },
];

const majorZones = [
  {
    id: 'wardens_landing',
    displayName: "Warden's Landing",
    kind: 'arrival_training',
    x: 14920,
    y: 12740,
    width: 1720,
    height: 1240,
    recommendedLevel: 1,
    biomeId: 'emerald_vale',
    description: 'arrival and training grounds for future tutorial flow',
  },
  {
    id: 'greenward_forest',
    displayName: 'Greenward Forest',
    kind: 'beginner_forest',
    x: 10680,
    y: 10920,
    width: 3480,
    height: 3320,
    recommendedLevel: 1,
    biomeId: 'elderwood',
    description: 'beginner forest with hunting, gathering, bears, and bandits',
  },
  {
    id: 'tamzia_outskirts',
    displayName: 'Tamzia Outskirts',
    kind: 'city_outskirts',
    x: 14320,
    y: 11220,
    width: 2760,
    height: 2600,
    recommendedLevel: 1,
    biomeId: 'emerald_vale',
    description: 'fields, roads, and quest space around Tamzia',
  },
  {
    id: 'tamzia_city',
    displayName: 'Tamzia City',
    kind: 'city',
    x: 15040,
    y: 11840,
    width: 1480,
    height: 1240,
    recommendedLevel: 1,
    biomeId: 'emerald_vale',
    description: 'preserved city core with existing NPCs, interiors, lamps, props, and collision',
  },
  {
    id: 'river_crossing',
    displayName: 'River Crossing',
    kind: 'bridge_landmark',
    x: 25720,
    y: 1000,
    width: 4280,
    height: 3520,
    recommendedLevel: 2,
    biomeId: 'silver_river',
    description: 'bridge, lake, and road landmark area',
  },
  {
    id: 'old_vale_highlands',
    displayName: 'Old Vale Highlands',
    kind: 'mountain_highlands',
    x: 5200,
    y: 66000,
    width: 24600,
    height: 21200,
    recommendedLevel: 8,
    biomeId: 'ironcrag',
    description: 'cliff blockers, mountain pass, mines, caves, and ruin placeholders',
  },
  {
    id: 'south_fields',
    displayName: 'South Fields',
    kind: 'fields',
    x: 61000,
    y: 4600,
    width: 50600,
    height: 23500,
    recommendedLevel: 4,
    biomeId: 'golden_fields',
    description: 'open fields, farms, caravan routes, and road branches',
  },
  {
    id: 'east_wilds',
    displayName: 'East Wilds',
    kind: 'wilderness',
    x: 81400,
    y: 30000,
    width: 36800,
    height: 40400,
    recommendedLevel: 10,
    biomeId: 'elderwood',
    description: 'mid-level forest and wilderness zone',
  },
  {
    id: 'southern_marsh_lake_district',
    displayName: 'Southern Marsh / Lake District',
    kind: 'wetland_lakes',
    x: 56000,
    y: 80500,
    width: 54000,
    height: 36200,
    recommendedLevel: 12,
    biomeId: 'shadowfen',
    description: 'wetland, fishing, lake, and marsh content area',
  },
  {
    id: 'coastal_ruins',
    displayName: 'Coastal Ruins',
    kind: 'coastal_ruins',
    x: 93000,
    y: 106000,
    width: 28200,
    height: 19800,
    recommendedLevel: 14,
    biomeId: 'saltwind',
    description: 'coast, old watchtower, shipwreck, and ruin placeholders',
  },
];

const poiPlaceholders = [
  {
    id: 'old_vale_main_pass',
    displayName: 'Old Vale Main Pass',
    kind: 'mountain_pass',
    x: 16400,
    y: 76000,
    width: 2120,
    height: 8200,
    showOnMap: true,
    note: 'primary readable pass through the highlands',
  },
  {
    id: 'old_vale_side_path_west',
    displayName: 'Old Vale West Side Path',
    kind: 'side_path',
    x: 9800,
    y: 70600,
    width: 1320,
    height: 5600,
    showOnMap: false,
    note: 'secondary mountain route placeholder',
  },
  {
    id: 'old_vale_side_path_east',
    displayName: 'Old Vale East Side Path',
    kind: 'side_path',
    x: 23600,
    y: 82000,
    width: 1380,
    height: 5200,
    showOnMap: false,
    note: 'secondary mountain route placeholder',
  },
  {
    id: 'old_vale_mine_entrance',
    displayName: 'Old Vale Mine Entrance',
    kind: 'mine_entrance',
    x: 12840,
    y: 78240,
    width: 260,
    height: 220,
    showOnMap: true,
    note: 'future mine entrance placeholder',
  },
  {
    id: 'old_vale_cave_mouth',
    displayName: 'Old Vale Cave Mouth',
    kind: 'cave_entrance',
    x: 22180,
    y: 73400,
    width: 280,
    height: 230,
    showOnMap: true,
    note: 'future cave entrance placeholder',
  },
  {
    id: 'old_vale_ancient_ruin',
    displayName: 'Old Vale Ancient Ruin',
    kind: 'ancient_ruin',
    x: 18480,
    y: 89840,
    width: 960,
    height: 720,
    showOnMap: true,
    note: 'future ruin encounter placeholder',
  },
  {
    id: 'dungeon_01_entrance',
    displayName: 'Rift-Cavern Entrance',
    kind: 'dungeon_entrance',
    x: 16280,
    y: 13280,
    width: 220,
    height: 180,
    showOnMap: true,
    transitionTarget: 'dungeon_01',
    note: 'preserved working dungeon entry point near Tamzia outskirts',
  },
  {
    id: 'river_crossing_bridge',
    displayName: 'River Crossing Bridge',
    kind: 'bridge',
    x: 27040,
    y: 1980,
    width: 680,
    height: 260,
    showOnMap: true,
    note: 'bridge landmark and road junction placeholder',
  },
  {
    id: 'coastal_watchtower_ruin',
    displayName: 'Coastal Watchtower Ruin',
    kind: 'watchtower_ruin',
    x: 103200,
    y: 113500,
    width: 560,
    height: 520,
    showOnMap: true,
    note: 'future coastal ruin marker',
  },
  {
    id: 'south_fields_caravan_stop',
    displayName: 'South Fields Caravan Stop',
    kind: 'caravan_stop',
    x: 77900,
    y: 18800,
    width: 920,
    height: 600,
    showOnMap: false,
    note: 'future road POI marker',
  },
  {
    id: 'lake_district_fishing_camp',
    displayName: 'Lake District Fishing Camp',
    kind: 'fishing_camp',
    x: 94400,
    y: 101900,
    width: 900,
    height: 680,
    showOnMap: false,
    note: 'future marsh/lake POI marker',
  },
];

const macroBlockers = [
  {
    id: 'old_vale_west_cliffs',
    displayName: 'Old Vale West Cliffs',
    x: 7600,
    y: 69200,
    width: 4200,
    height: 17200,
    note: 'future cliff blocker mass; keep pass objects walkable',
  },
  {
    id: 'old_vale_east_cliffs',
    displayName: 'Old Vale East Cliffs',
    x: 21000,
    y: 70600,
    width: 5700,
    height: 18800,
    note: 'future cliff blocker mass; keep side path readable',
  },
  {
    id: 'old_vale_south_rockwall',
    displayName: 'Old Vale South Rockwall',
    x: 10300,
    y: 87200,
    width: 17200,
    height: 4400,
    note: 'future southern highland barrier',
  },
];

const copiedStartingMaps = [];
let copiedDungeon = null;

function toTiledProperties(props) {
  return Object.entries(props)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([name, value]) => ({
      name,
      type: typeof value === 'boolean'
        ? 'bool'
        : typeof value === 'number'
          ? 'float'
          : 'string',
      value,
    }));
}

function objectLayer(name, objects) {
  return {
    type: 'objectgroup',
    name,
    visible: true,
    opacity: 1,
    objects,
  };
}

function rectObject(id, name, x, y, width, height, props = {}) {
  return {
    id,
    name,
    type: props.type ?? props.kind ?? '',
    x,
    y,
    width,
    height,
    rotation: 0,
    visible: true,
    properties: toTiledProperties(props),
  };
}

function pointObject(id, name, x, y, props = {}) {
  return {
    id,
    name,
    type: props.type ?? props.kind ?? '',
    x,
    y,
    width: 0,
    height: 0,
    point: true,
    rotation: 0,
    visible: true,
    properties: toTiledProperties(props),
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function copyFileEnsuringDir(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findSourceFile(relativeSource, sourceBaseDir) {
  const direct = path.resolve(sourceBaseDir, relativeSource);
  if (await fileExists(direct)) return direct;

  const basename = path.basename(relativeSource);
  const candidates = [
    path.join(publicTilesetsDir, basename),
    path.join(publicAssetsTilesetsDir, basename),
    path.join(oldMapsDir, 'tilesets', basename),
    path.join(oldMapsDir, basename),
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  throw new Error(`Could not resolve source file ${relativeSource} from ${sourceBaseDir}`);
}

async function copyTilesetWithImage(tilesetName, destinationDir) {
  const sourceTsx = await findSourceFile(tilesetName, publicTilesetsDir);
  const tsxText = await fs.readFile(sourceTsx, 'utf8');
  const imageMatch = tsxText.match(/<image\b[^>]*\bsource="([^"]+)"/);
  let rewrittenText = tsxText;

  if (imageMatch) {
    const imageSource = imageMatch[1];
    const sourceImage = await findSourceFile(imageSource, path.dirname(sourceTsx));
    const destinationImageName = path.basename(sourceImage);
    await copyFileEnsuringDir(sourceImage, path.join(destinationDir, destinationImageName));
    rewrittenText = tsxText.replace(/(<image\b[^>]*\bsource=")([^"]+)(")/, `$1${destinationImageName}$3`);
  }

  await fs.mkdir(destinationDir, { recursive: true });
  await fs.writeFile(path.join(destinationDir, tilesetName), rewrittenText, 'utf8');
}

function withMapProperties(map, props) {
  const existing = new Map((map.properties ?? []).map((property) => [property.name, property]));
  Object.entries(props).forEach(([name, value]) => {
    existing.set(name, {
      name,
      type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'float' : 'string',
      value,
    });
  });
  map.properties = [...existing.values()];
}

function rewriteTilesetSources(map, sourcePrefix) {
  map.tilesets = (map.tilesets ?? []).map((tileset) => ({
    ...tileset,
    source: `${sourcePrefix}${path.basename(tileset.source ?? '')}`,
  }));
}

function setTransitionTargets(map, targetMapValue) {
  (map.layers ?? []).forEach((layer) => {
    if (layer.type !== 'objectgroup' || layer.name !== 'Transitions') return;
    (layer.objects ?? []).forEach((object) => {
      const properties = object.properties ?? [];
      properties.forEach((property) => {
        if (['targetMap', 'targetMapId', 'mapId', 'target'].includes(property.name)) {
          const raw = String(property.value ?? '').trim().toLowerCase();
          if (['world', 'world_map', 'old_world', 'main_world'].includes(raw)) {
            property.value = targetMapValue;
          }
        }
      });
      object.properties = properties;
    });
  });
}

function getNextObjectId(map) {
  let highest = Number(map.nextobjectid ?? 1);
  (map.layers ?? []).forEach((layer) => {
    (layer.objects ?? []).forEach((object) => {
      highest = Math.max(highest, Number(object.id ?? 0) + 1);
    });
  });
  return highest;
}

function addOrReplaceObjectLayer(map, layerName, objects) {
  map.layers = (map.layers ?? []).filter((layer) => layer.name !== layerName);
  map.layers.push(objectLayer(layerName, objects));
  map.nextobjectid = Math.max(getNextObjectId(map), ...objects.map((object) => Number(object.id ?? 0) + 1), 1);
}

function addOrReplaceObjectInLayer(map, layerName, object) {
  let layer = (map.layers ?? []).find((candidate) => candidate.type === 'objectgroup' && candidate.name === layerName);
  if (!layer) {
    layer = objectLayer(layerName, []);
    map.layers.push(layer);
  }
  layer.objects = (layer.objects ?? []).filter((candidate) => candidate.name !== object.name);
  layer.objects.push(object);
  map.nextobjectid = Math.max(getNextObjectId(map), Number(object.id ?? 0) + 1);
}

function getCollisionGid(map) {
  const collisionTileset = (map.tilesets ?? []).find((tileset) => /collision_debug/i.test(tileset.source ?? ''));
  return Number(collisionTileset?.firstgid ?? 0);
}

function pointInRect(point, rect, padding = 0) {
  return point.x >= rect.x - padding
    && point.x <= rect.x + rect.width + padding
    && point.y >= rect.y - padding
    && point.y <= rect.y + rect.height + padding;
}

function applyMacroCollision(map, regionX, regionY) {
  if (regionX === 0 && regionY === 0) return;

  const collisionLayer = (map.layers ?? []).find((layer) => layer.type === 'tilelayer' && layer.name === 'Collision');
  const collisionGid = getCollisionGid(map);
  if (!collisionLayer || !collisionGid) return;

  const data = decodeLayerData(collisionLayer);
  if (data.length !== REGION_TILES * REGION_TILES) return;

  const walkableCarveouts = poiPlaceholders
    .filter((poi) => ['mountain_pass', 'side_path', 'mine_entrance', 'cave_entrance', 'ancient_ruin'].includes(poi.kind))
    .map((poi) => ({
      x: poi.x,
      y: poi.y,
      width: poi.width,
      height: poi.height,
      padding: poi.kind === 'mountain_pass' ? 224 : 128,
    }));

  macroBlockers
    .filter((blocker) => rectIntersectsRegion(blocker, regionX, regionY))
    .forEach((blocker) => {
      const local = localizeRectForRegion(blocker, regionX, regionY);
      const startTileX = Math.max(0, Math.floor(local.x / TILE_SIZE));
      const startTileY = Math.max(0, Math.floor(local.y / TILE_SIZE));
      const endTileX = Math.min(REGION_TILES, Math.ceil((local.x + local.width) / TILE_SIZE));
      const endTileY = Math.min(REGION_TILES, Math.ceil((local.y + local.height) / TILE_SIZE));
      const regionOffsetX = regionX * REGION_TILES * TILE_SIZE;
      const regionOffsetY = regionY * REGION_TILES * TILE_SIZE;

      for (let tileY = startTileY; tileY < endTileY; tileY += 1) {
        for (let tileX = startTileX; tileX < endTileX; tileX += 1) {
          const globalPoint = {
            x: regionOffsetX + tileX * TILE_SIZE + TILE_SIZE / 2,
            y: regionOffsetY + tileY * TILE_SIZE + TILE_SIZE / 2,
          };
          if (walkableCarveouts.some((carveout) => pointInRect(globalPoint, carveout, carveout.padding))) continue;
          data[tileY * REGION_TILES + tileX] = collisionGid;
        }
      }
    });

  collisionLayer.encoding = 'base64';
  collisionLayer.compression = 'zlib';
  collisionLayer.data = encodeLayerData(data);
}

function globalToRegionPoint(point) {
  const regionX = Math.floor(point.x / (REGION_TILES * TILE_SIZE));
  const regionY = Math.floor(point.y / (REGION_TILES * TILE_SIZE));
  return {
    regionX,
    regionY,
    localX: point.x - regionX * REGION_TILES * TILE_SIZE,
    localY: point.y - regionY * REGION_TILES * TILE_SIZE,
  };
}

function rectIntersectsRegion(item, regionX, regionY) {
  const regionBounds = {
    x: regionX * REGION_TILES * TILE_SIZE,
    y: regionY * REGION_TILES * TILE_SIZE,
    width: REGION_TILES * TILE_SIZE,
    height: REGION_TILES * TILE_SIZE,
  };
  return item.x < regionBounds.x + regionBounds.width
    && item.x + item.width > regionBounds.x
    && item.y < regionBounds.y + regionBounds.height
    && item.y + item.height > regionBounds.y;
}

function localizeRectForRegion(item, regionX, regionY) {
  const offsetX = regionX * REGION_TILES * TILE_SIZE;
  const offsetY = regionY * REGION_TILES * TILE_SIZE;
  return {
    ...item,
    x: Math.max(item.x, offsetX) - offsetX,
    y: Math.max(item.y, offsetY) - offsetY,
    width: Math.min(item.x + item.width, offsetX + REGION_TILES * TILE_SIZE) - Math.max(item.x, offsetX),
    height: Math.min(item.y + item.height, offsetY + REGION_TILES * TILE_SIZE) - Math.max(item.y, offsetY),
  };
}

async function copyStartingMaps() {
  for (const entry of startingMaps) {
    const source = path.join(oldMapsDir, entry.source);
    const destination = path.join(newMapsDir, entry.destination);
    const map = await readJson(source);
    rewriteTilesetSources(map, '../../_shared/tilesets/');
    withMapProperties(map, {
      mapId: entry.canonicalId,
      mapCategory: 'starting_zone',
      mapStructureVersion: 'v4',
      legacySourceMap: entry.source,
    });
    setTransitionTargets(map, 'world_v3');
    await writeJson(destination, map);
    copiedStartingMaps.push({
      oldSource: path.relative(rootDir, source).replaceAll(path.sep, '/'),
      newDestination: path.relative(rootDir, destination).replaceAll(path.sep, '/'),
      mapId: entry.canonicalId,
    });
  }
}

async function copyDungeonMap() {
  const source = path.join(oldMapsDir, 'dungeon_01.tmj');
  const destination = path.join(newMapsDir, 'dungeons', 'dungeon_01', 'dungeon_01.tmj');
  const map = await readJson(source);
  rewriteTilesetSources(map, '../../_shared/tilesets/');
  withMapProperties(map, {
    mapId: 'dungeon_01',
    mapCategory: 'dungeon',
    mapStructureVersion: 'v4',
    legacySourceMap: 'dungeon_01.tmj',
  });
  (map.layers ?? []).forEach((layer) => {
    if (layer.type !== 'objectgroup' || layer.name !== 'Transitions') return;
    (layer.objects ?? []).forEach((object) => {
      const properties = object.properties ?? [];
      properties.forEach((property) => {
        if (['targetMap', 'targetMapId', 'mapId', 'target'].includes(property.name)) {
          const raw = String(property.value ?? '').trim().toLowerCase();
          if (['world', 'world_map', 'old_world', 'main_world'].includes(raw)) {
            property.value = 'continent_01_region_0_0';
          }
        }
        if (['targetSpawn', 'targetSpawnName', 'spawn', 'arrival'].includes(property.name)) {
          property.value = 'dungeon_01_entrance';
        }
      });
      object.properties = properties;
    });
  });
  await writeJson(destination, map);
  copiedDungeon = {
    oldSource: path.relative(rootDir, source).replaceAll(path.sep, '/'),
    newDestination: path.relative(rootDir, destination).replaceAll(path.sep, '/'),
    mapId: 'dungeon_01',
  };
}

async function copyWorldRegions() {
  const regionsDir = path.join(newMapsDir, 'world_map', 'continents', 'continent_01', 'regions');
  for (let regionY = 0; regionY < REGION_GRID; regionY += 1) {
    for (let regionX = 0; regionX < REGION_GRID; regionX += 1) {
      const oldId = `world_region_${regionX}_${regionY}_v3`;
      const newId = `continent_01_region_${regionX}_${regionY}`;
      const source = path.join(oldMapsDir, `${oldId}.tmj`);
      const destination = path.join(regionsDir, `${newId}.tmj`);
      const map = await readJson(source);
      rewriteTilesetSources(map, '../tilesets/');
      withMapProperties(map, {
        mapId: newId,
        continentId: 'continent_01',
        mapCategory: 'continent_region',
        mapStructureVersion: 'v4',
        legacyMapId: oldId,
        regionX,
        regionY,
      });

      const zoneObjects = [];
      let objectId = getNextObjectId(map) + 10000;
      majorZones.forEach((zone) => {
        if (!rectIntersectsRegion(zone, regionX, regionY)) return;
        const local = localizeRectForRegion(zone, regionX, regionY);
        zoneObjects.push(rectObject(
          objectId,
          zone.id,
          Math.round(local.x),
          Math.round(local.y),
          Math.round(local.width),
          Math.round(local.height),
          {
            type: 'major_zone',
            zoneId: zone.id,
            displayName: zone.displayName,
            kind: zone.kind,
            recommendedLevel: zone.recommendedLevel,
            biomeId: zone.biomeId,
            description: zone.description,
            macroPass: 'v4',
          },
        ));
        objectId += 1;
      });
      if (zoneObjects.length > 0) addOrReplaceObjectLayer(map, 'MajorZones', zoneObjects);

      const poiObjects = [];
      poiPlaceholders.forEach((poi) => {
        if (!rectIntersectsRegion(poi, regionX, regionY)) return;
        const local = localizeRectForRegion(poi, regionX, regionY);
        poiObjects.push(rectObject(
          objectId,
          poi.id,
          Math.round(local.x),
          Math.round(local.y),
          Math.max(1, Math.round(local.width)),
          Math.max(1, Math.round(local.height)),
          {
            type: poi.kind,
            poiId: poi.id,
            displayName: poi.displayName,
            kind: poi.kind,
            showOnMap: Boolean(poi.showOnMap),
            transitionTarget: poi.transitionTarget,
            note: poi.note,
            macroPass: 'v4',
          },
        ));
        objectId += 1;
      });
      if (poiObjects.length > 0) addOrReplaceObjectLayer(map, 'PoiPlaceholders', poiObjects);

      const blockerObjects = [];
      macroBlockers.forEach((blocker) => {
        if (!rectIntersectsRegion(blocker, regionX, regionY)) return;
        const local = localizeRectForRegion(blocker, regionX, regionY);
        blockerObjects.push(rectObject(
          objectId,
          blocker.id,
          Math.round(local.x),
          Math.round(local.y),
          Math.max(1, Math.round(local.width)),
          Math.max(1, Math.round(local.height)),
          {
            type: 'planned_cliff_blocker',
            blockerId: blocker.id,
            displayName: blocker.displayName,
            collisionPlanning: true,
            note: blocker.note,
            macroPass: 'v4',
          },
        ));
        objectId += 1;
      });
      if (blockerObjects.length > 0) addOrReplaceObjectLayer(map, 'MacroBlockers', blockerObjects);

      if (regionX === 0 && regionY === 0) {
        const dungeonEntrance = globalToRegionPoint({ x: 16280, y: 13280 });
        const transition = rectObject(
          objectId,
          'dungeon_01_entrance',
          Math.round(dungeonEntrance.localX),
          Math.round(dungeonEntrance.localY),
          220,
          180,
          {
            type: 'dungeon_entrance',
            targetMapId: 'dungeon_01',
            targetSpawn: 'dungeon_01_start',
            displayName: 'Rift-Cavern Entrance',
            recommendedLevel: 20,
            showOnMap: true,
            macroPass: 'v4',
          },
        );
        addOrReplaceObjectInLayer(map, 'Transitions', transition);
        objectId += 1;
        addOrReplaceObjectInLayer(map, 'Landmarks', pointObject(
          objectId,
          'marker_dungeon_01_entrance',
          Math.round(dungeonEntrance.localX + 110),
          Math.round(dungeonEntrance.localY + 90),
          {
            type: 'dungeon_entrance',
            landmarkId: 'dungeon_01_entrance',
            displayName: 'Rift-Cavern Entrance',
            showOnMap: true,
            macroPass: 'v4',
          },
        ));
      }

      applyMacroCollision(map, regionX, regionY);
      await writeJson(destination, map);
    }
  }
}

function decodeLayerData(layer) {
  if (ArrayBuffer.isView(layer?.data)) return layer.data;
  if (Array.isArray(layer?.data)) return Uint32Array.from(layer.data);
  if (layer?.encoding !== 'base64' || layer?.compression !== 'zlib' || typeof layer.data !== 'string') {
    return new Uint32Array(0);
  }

  const inflated = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(Math.floor(inflated.length / 4));
  for (let index = 0; index < data.length; index += 1) {
    data[index] = inflated.readUInt32LE(index * 4);
  }
  return data;
}

function encodeLayerData(data) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let index = 0; index < data.length; index += 1) {
    buffer.writeUInt32LE(data[index] >>> 0, index * 4);
  }
  return zlib.deflateSync(buffer, { level: 6 }).toString('base64');
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function hasTileObjectGid(object) {
  return (Number(object?.gid ?? 0) & TILED_GID_MASK) > 0;
}

function getRegionKey(regionX, regionY) {
  return `${regionX},${regionY}`;
}

function getChunkIndexTilesets(tilesets) {
  return tilesets.map((tileset) => ({
    ...tileset,
    source: tileset.source?.startsWith('../tilesets/')
      ? tileset.source.replace('../tilesets/', '../../tilesets/')
      : tileset.source,
  }));
}

async function loadRegion(regionX, regionY) {
  const mapId = `continent_01_region_${regionX}_${regionY}`;
  const fileName = `${mapId}.tmj`;
  const map = await readJson(path.join(newMapsDir, 'world_map', 'continents', 'continent_01', 'regions', fileName));
  const tileLayers = new Map();
  TILE_LAYER_NAMES.forEach((name) => {
    const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
    if (layer) tileLayers.set(name, { ...layer, data: decodeLayerData(layer) });
  });
  const objectLayers = new Map();
  OBJECT_LAYER_NAMES.forEach((name) => {
    const layer = map.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === name);
    objectLayers.set(name, layer ? { ...layer, objects: layer.objects ?? [] } : { type: 'objectgroup', name, objects: [] });
  });

  return {
    mapId,
    map,
    tileLayers,
    objectLayers,
    offsetTileX: regionX * REGION_TILES,
    offsetTileY: regionY * REGION_TILES,
    offsetPixelX: regionX * REGION_TILES * TILE_SIZE,
    offsetPixelY: regionY * REGION_TILES * TILE_SIZE,
  };
}

function getRegionForGlobalTile(regions, tileX, tileY) {
  const regionX = Math.floor(tileX / REGION_TILES);
  const regionY = Math.floor(tileY / REGION_TILES);
  return regions.get(getRegionKey(regionX, regionY)) ?? null;
}

function collectChunkObjects(regions, chunkBounds, layerNames = OBJECT_LAYER_NAMES) {
  return layerNames.map((layerName) => {
    const objects = [];
    regions.forEach((region) => {
      const sourceLayer = region.objectLayers.get(layerName);
      (sourceLayer?.objects ?? []).forEach((object) => {
        const globalX = region.offsetPixelX + Number(object.x ?? 0);
        const globalY = region.offsetPixelY + Number(object.y ?? 0);
        const width = Math.max(1, Number(object.width ?? 1));
        const height = Math.max(1, Number(object.height ?? 1));
        const bounds = {
          x: globalX,
          y: hasTileObjectGid(object) ? globalY - height : globalY,
          width,
          height,
        };
        if (!rectsIntersect(bounds, chunkBounds)) return;
        objects.push({
          ...object,
          x: globalX - chunkBounds.x,
          y: globalY - chunkBounds.y,
          sourceMapId: region.mapId,
        });
      });
    });

    return {
      type: 'objectgroup',
      name: layerName,
      visible: true,
      opacity: 1,
      objects,
    };
  });
}

async function generateChunks() {
  const chunksDir = path.join(newMapsDir, 'world_map', 'continents', 'continent_01', 'regions', 'chunks');
  await fs.mkdir(chunksDir, { recursive: true });

  const regions = new Map();
  for (let regionY = 0; regionY < REGION_GRID; regionY += 1) {
    for (let regionX = 0; regionX < REGION_GRID; regionX += 1) {
      regions.set(getRegionKey(regionX, regionY), await loadRegion(regionX, regionY));
    }
  }

  const sampleRegion = regions.get(getRegionKey(0, 0));
  const chunks = [];

  for (let chunkY = 0; chunkY < CHUNK_GRID; chunkY += 1) {
    for (let chunkX = 0; chunkX < CHUNK_GRID; chunkX += 1) {
      const tileX = chunkX * CHUNK_TILES;
      const tileY = chunkY * CHUNK_TILES;
      const width = Math.min(CHUNK_TILES, WORLD_TILES - tileX);
      const height = Math.min(CHUNK_TILES, WORLD_TILES - tileY);
      const chunkBounds = {
        x: tileX * TILE_SIZE,
        y: tileY * TILE_SIZE,
        width: width * TILE_SIZE,
        height: height * TILE_SIZE,
      };

      const layers = [];
      TILE_LAYER_NAMES.forEach((layerName) => {
        const data = new Uint32Array(width * height);
        for (let localY = 0; localY < height; localY += 1) {
          const globalTileY = tileY + localY;
          for (let localX = 0; localX < width; localX += 1) {
            const globalTileX = tileX + localX;
            const region = getRegionForGlobalTile(regions, globalTileX, globalTileY);
            const sourceLayer = region?.tileLayers.get(layerName);
            if (!region || !sourceLayer?.data) continue;
            const sourceX = globalTileX - region.offsetTileX;
            const sourceY = globalTileY - region.offsetTileY;
            data[localY * width + localX] = sourceLayer.data[sourceY * REGION_TILES + sourceX] ?? 0;
          }
        }

        layers.push({
          type: 'tilelayer',
          name: layerName,
          visible: true,
          opacity: 1,
          width,
          height,
          encoding: 'base64',
          compression: 'zlib',
          data: encodeLayerData(data),
        });

        if (layerName === 'Buildings') {
          layers.push(...collectChunkObjects(regions, chunkBounds, ['Props']));
        }
      });

      layers.push(...collectChunkObjects(
        regions,
        chunkBounds,
        OBJECT_LAYER_NAMES.filter((layerName) => layerName !== 'Props'),
      ));

      const file = `chunk_${chunkX}_${chunkY}.json`;
      await writeJson(path.join(chunksDir, file), {
        version: VERSION,
        type: 'map',
        orientation: 'orthogonal',
        renderorder: 'right-down',
        infinite: false,
        chunkX,
        chunkY,
        tileX,
        tileY,
        width,
        height,
        tilewidth: TILE_SIZE,
        tileheight: TILE_SIZE,
        layers,
      });

      chunks.push({
        id: `chunk_${chunkX}_${chunkY}`,
        file,
        chunkX,
        chunkY,
        x: tileX,
        y: tileY,
        width,
        height,
      });
    }
  }

  await writeJson(path.join(chunksDir, 'continent_01_chunks.json'), {
    version: VERSION,
    tileSize: TILE_SIZE,
    chunkTiles: CHUNK_TILES,
    worldTiles: {
      width: WORLD_TILES,
      height: WORLD_TILES,
    },
    chunkGrid: {
      width: CHUNK_GRID,
      height: CHUNK_GRID,
    },
    tilesets: getChunkIndexTilesets(sampleRegion.map.tilesets),
    layers: TILE_LAYER_NAMES,
    objectLayers: OBJECT_LAYER_NAMES,
    chunks,
  });

  return chunks.length;
}

async function copyTilesets() {
  const sharedDir = path.join(newMapsDir, '_shared', 'tilesets');
  const continentDir = path.join(newMapsDir, 'world_map', 'continents', 'continent_01', 'tilesets');
  for (const tilesetName of sharedTilesetNames) {
    await copyTilesetWithImage(tilesetName, sharedDir);
  }
  for (const tilesetName of continentTilesetNames) {
    await copyTilesetWithImage(tilesetName, continentDir);
  }
}

async function copyOptionalTamziaAssets() {
  const tamziaDir = path.join(newMapsDir, 'interiors', 'tamzia');
  await fs.mkdir(tamziaDir, { recursive: true });
  const candidates = [
    'tamzia_building_interiors_v1.tsx',
    'tamzia_city_bank_interior.tsx',
    'tamzia_town_hall_interior.tsx',
    'tamzia_lights_v1.tsx',
    'tamzia_lights_large_v1.tsx',
    'tamzia_props_v1.tsx',
  ];
  for (const name of candidates) {
    await copyTilesetWithImage(name, tamziaDir);
  }
}

async function createObjectsAndTemplatesDirs() {
  const dirs = [
    path.join(newMapsDir, '_shared', 'objects'),
    path.join(newMapsDir, '_shared', 'props'),
    path.join(newMapsDir, '_shared', 'templates'),
    path.join(newMapsDir, 'world_map', 'continents', 'continent_01', 'objects'),
    path.join(newMapsDir, 'world_map', 'continents', 'continent_01', 'markers'),
  ];
  await Promise.all(dirs.map((dir) => fs.mkdir(dir, { recursive: true })));
}

async function createRegistryAndManifests(chunkCount) {
  const oldRegistry = await readJson(path.join(oldMapsDir, 'world_regions_v3.json'));
  const regions = [];
  for (let regionY = 0; regionY < REGION_GRID; regionY += 1) {
    for (let regionX = 0; regionX < REGION_GRID; regionX += 1) {
      const oldRegion = (oldRegistry.regions ?? []).find((region) => region.x === regionX * REGION_TILES && region.y === regionY * REGION_TILES) ?? {};
      const oldMapId = `world_region_${regionX}_${regionY}_v3`;
      const newMapId = `continent_01_region_${regionX}_${regionY}`;
      regions.push({
        ...oldRegion,
        id: newMapId,
        zoneId: oldRegion.zoneId ?? `region_${regionX}_${regionY}`,
        file: `regions/${newMapId}.tmj`,
        legacyId: oldRegion.id ?? `world_region_${regionX}_${regionY}`,
        legacyMapId: oldMapId,
        aliases: [oldMapId, oldRegion.id].filter(Boolean),
      });
    }
  }

  const oldLandmarks = oldRegistry.landmarks ?? [];
  const landmarks = [
    ...oldLandmarks,
    ...poiPlaceholders.map((poi) => ({
      id: poi.id,
      displayName: poi.displayName,
      kind: poi.kind,
      x: Math.round(poi.x + poi.width / 2),
      y: Math.round(poi.y + poi.height / 2),
      radius: Math.max(24, Math.round(Math.max(poi.width, poi.height) / 2)),
      showOnMap: Boolean(poi.showOnMap),
      transitionTarget: poi.transitionTarget ?? null,
      macroPass: 'v4',
    })),
  ];

  const continentRoot = path.join(newMapsDir, 'world_map', 'continents', 'continent_01');
  const registry = {
    version: 'v4',
    continentId: 'continent_01',
    displayName: 'Continent 01',
    tileSize: TILE_SIZE,
    worldTiles: {
      width: WORLD_TILES,
      height: WORLD_TILES,
    },
    regionTiles: {
      width: REGION_TILES,
      height: REGION_TILES,
    },
    macroPass: {
      version: 'v4',
      intent: 'Clean structural continent layout with preserved Tamzia work and placeholder metadata for detailed passes.',
      preservesTamziaRegion: true,
      preservesExistingCollision: true,
      notes: [
        'Existing v3 organic terrain and seam-aware generation were retained as the safe base.',
        'Tamzia city/core object layers remain intact in continent_01_region_0_0.',
        'Old Vale highland cliff/rockwall blockers are stamped into Collision with the main pass and side paths carved open.',
        'Mountain/highland passes, caves, mine, ruins, bridges, roads, wetlands, and coast POIs are marked for detailed 80x80/100x100 passes.',
      ],
    },
    regions,
    majorZones,
    landmarks,
  };
  await writeJson(path.join(continentRoot, 'continent_01_regions.json'), registry);
  await writeJson(path.join(continentRoot, 'markers', 'major_zones.json'), { continentId: 'continent_01', majorZones });
  await writeJson(path.join(continentRoot, 'markers', 'poi_placeholders.json'), { continentId: 'continent_01', poiPlaceholders, macroBlockers });

  const regionEntries = regions.map((region) => ({
    id: region.id,
    file: region.file,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    displayName: region.displayName,
    biomeId: region.biomeId,
    recommendedLevel: region.recommendedLevel,
    aliases: region.aliases,
  }));

  await writeJson(path.join(continentRoot, 'continent_01_manifest.json'), {
    continentId: 'continent_01',
    displayName: 'Continent 01',
    structureVersion: 'v4',
    tileSize: TILE_SIZE,
    regionSizeTiles: REGION_TILES,
    gridSize: { cols: REGION_GRID, rows: REGION_GRID },
    totalSizeTiles: { width: WORLD_TILES, height: WORLD_TILES },
    runtime: {
      chunkIndexFile: 'regions/chunks/continent_01_chunks.json',
      chunkAssetVersion: VERSION,
      chunkTiles: CHUNK_TILES,
      chunkGrid: { cols: CHUNK_GRID, rows: CHUNK_GRID },
      chunkCount,
    },
    overviewImage: 'continent_01_overview.png',
    defaultSpawnPoints: [
      {
        id: 'after_starting_zone_spawn',
        mapId: 'continent_01_region_0_0',
        x: 15652,
        y: 12910,
        facing: -Math.PI / 2,
        description: 'Preserved Tamzia arrival spawn.',
      },
      {
        id: 'dungeon_01_entrance',
        mapId: 'continent_01_region_0_0',
        x: 16280,
        y: 13280,
        targetMapId: 'dungeon_01',
        targetSpawn: 'dungeon_01_start',
      },
    ],
    majorZones,
    poiSummary: poiPlaceholders.map((poi) => ({
      id: poi.id,
      displayName: poi.displayName,
      kind: poi.kind,
      x: poi.x,
      y: poi.y,
      showOnMap: Boolean(poi.showOnMap),
      transitionTarget: poi.transitionTarget ?? null,
    })),
    regions: regionEntries,
  });

  await writeJson(path.join(newMapsDir, 'world_map', 'world_map_manifest.json'), {
    version: 'v4',
    defaultContinent: 'continent_01',
    activeContinent: 'continent_01',
    continents: [
      {
        continentId: 'continent_01',
        displayName: 'Continent 01',
        manifest: 'continents/continent_01/continent_01_manifest.json',
        registry: 'continents/continent_01/continent_01_regions.json',
        runtimeChunkIndex: 'continents/continent_01/regions/chunks/continent_01_chunks.json',
        status: 'active',
      },
    ],
  });

  await writeJson(path.join(continentRoot, 'continent_01.world'), {
    type: 'world',
    orientation: 'orthogonal',
    onlyShowAdjacentMaps: false,
    maps: regionEntries.map((region) => ({
      fileName: region.file,
      x: region.x * TILE_SIZE,
      y: region.y * TILE_SIZE,
      width: region.width * TILE_SIZE,
      height: region.height * TILE_SIZE,
    })),
  });

  const oldOverview = path.join(oldMapsDir, 'world_v3_overview.png');
  if (await fileExists(oldOverview)) {
    await copyFileEnsuringDir(oldOverview, path.join(continentRoot, 'continent_01_overview.png'));
  }
}

async function main() {
  if (!(await fileExists(oldMapsDir))) {
    throw new Error('public/maps_old is required before running the v4 map migration.');
  }
  if (!(await fileExists(newMapsDir))) {
    await fs.mkdir(newMapsDir, { recursive: true });
  }

  await createObjectsAndTemplatesDirs();
  await copyTilesets();
  await copyOptionalTamziaAssets();
  await copyStartingMaps();
  await copyDungeonMap();
  await copyWorldRegions();
  const chunkCount = await generateChunks();
  await createRegistryAndManifests(chunkCount);

  const summary = {
    copiedStartingMaps,
    copiedDungeon,
    generatedRegions: REGION_GRID * REGION_GRID,
    generatedChunks: chunkCount,
    manifests: [
      'public/maps/world_map/world_map_manifest.json',
      'public/maps/world_map/continents/continent_01/continent_01_manifest.json',
      'public/maps/world_map/continents/continent_01/continent_01_regions.json',
      'public/maps/world_map/continents/continent_01/markers/major_zones.json',
      'public/maps/world_map/continents/continent_01/markers/poi_placeholders.json',
    ],
  };
  await writeJson(path.join(newMapsDir, 'migration_summary_v4.json'), summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
