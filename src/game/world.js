import { clamp, safeNumber } from './math';

const OFFLINE_DEMO = false;
const OFFLINE_USER = {
  uid: 'offline-demo',
  email: 'Offline demo',
  localOnly: true,
};

const WORLD = {
  width: 9600,
  height: 19200,
  tile: 32,
};

const RESOLUTION_OPTIONS = [
  { id: '1280x720', label: '1280 x 720', width: 1280, height: 720 },
  { id: '1366x768', label: '1366 x 768', width: 1366, height: 768 },
  { id: '1600x900', label: '1600 x 900', width: 1600, height: 900 },
  { id: '1920x1080', label: '1920 x 1080', width: 1920, height: 1080 },
  { id: '2560x1440', label: '2560 x 1440', width: 2560, height: 1440 },
];

const MAP_FILES = {
  world: 'world_map.tmj',
  human_starting: 'human_starting_zone_v4.tmj',
  dwarf_starting: 'dwarf_starting_zone.tmj',
  undead_starting: 'undead_starting_zone.tmj',
  elf_starting: 'elf_starting_zone.tmj',
  orc_starting: 'orc_starting_zone.tmj',
  dungeon_01: 'dungeon_01.tmj',
};

const WORLD_V2_REGION_GRID = 5;
const WORLD_V2_REGION_TILES = 800;
const WORLD_V2_REGION_PIXEL_SIZE = WORLD_V2_REGION_TILES * WORLD.tile;
const WORLD_V2_WORLD_TILES = WORLD_V2_REGION_GRID * WORLD_V2_REGION_TILES;
const WORLD_V2_WORLD_PIXEL_SIZE = WORLD_V2_REGION_GRID * WORLD_V2_REGION_PIXEL_SIZE;
const WORLD_V2_CHUNK_TILES = 128;
const WORLD_V2_CHUNK_PIXEL_SIZE = WORLD_V2_CHUNK_TILES * WORLD.tile;
const WORLD_V2_CHUNK_GRID = Math.ceil(WORLD_V2_WORLD_TILES / WORLD_V2_CHUNK_TILES);
const WORLD_V2_ACTIVE_CHUNK_RADIUS = 2;
const WORLD_V2_PRELOAD_CHUNK_RADIUS = 3;
const WORLD_V2_CHUNK_INDEX_FILE = 'world_v2_chunks/world_v2_chunks.json';
const WORLD_V2_CHUNK_ASSET_VERSION = 'v2-runtime-chunks-1';
const WORLD_V2_REGISTRY_FILE = 'world_regions_v2.json';
const WORLD_V3_HUB_MAP_ID = 'world_region_0_0_v3';
const WORLD_V3_QUEST_GIVER_ID = 'tamzia_town_hall_mayor';
const WORLD_V3_AFTER_STARTING_SPAWN_NAME = 'after_starting_zone_spawn';
const WORLD_V3_HUB_ARRIVAL = {
  x: 15652,
  y: 12910,
  facing: -Math.PI / 2,
};
const WORLD_V3_HUB_TURN_IN_MARKER = {
  type: 'point',
  mapId: WORLD_V3_HUB_MAP_ID,
  x: 15664,
  y: 12240,
  label: 'Mayor Alwen Tamz',
};
const WORLD_STREAM_GENERATIONS = {
  v2: {
    id: 'v2',
    mapSpaceId: 'world_v2',
    chunkIndexFile: WORLD_V2_CHUNK_INDEX_FILE,
    chunkAssetVersion: WORLD_V2_CHUNK_ASSET_VERSION,
    registryFile: WORLD_V2_REGISTRY_FILE,
  },
  v3: {
    id: 'v3',
    mapSpaceId: 'world_v3',
    chunkIndexFile: 'world_v3_chunks/world_v3_chunks.json',
    chunkAssetVersion: 'v3-runtime-chunks-12',
    registryFile: 'world_regions_v3.json',
  },
};
const WORLD_STREAM_GENERATION_IDS = Object.keys(WORLD_STREAM_GENERATIONS);
const WORLD_V2_MAP_IDS = WORLD_STREAM_GENERATION_IDS.flatMap((generationId) => (
  Array.from({ length: WORLD_V2_REGION_GRID * WORLD_V2_REGION_GRID }, (_, index) => {
    const x = index % WORLD_V2_REGION_GRID;
    const y = Math.floor(index / WORLD_V2_REGION_GRID);
    return `world_region_${x}_${y}_${generationId}`;
  })
));
const WORLD_V2_MAP_ID_SET = new Set(WORLD_V2_MAP_IDS);
WORLD_V2_MAP_IDS.forEach((mapId) => {
  MAP_FILES[mapId] = `${mapId}.tmj`;
});

const WORLD_MAP_VERSION = 2;
const WORLD_QUEST_GIVER_ID = 'world-arrivals-quartermaster';
const WORLD_QUEST_TURN_IN_MARKER = {
  type: 'point',
  mapId: 'world',
  x: 4116,
  y: 1632,
  label: 'Quartermaster Vale',
};
const DUNGEON_ENTRANCE_MARKER = {
  type: 'point',
  mapId: 'world',
  x: 8048,
  y: 3054,
  label: 'Dungeon Entrance',
};
const DUNGEON_EXIT_MARKER = {
  type: 'point',
  mapId: 'dungeon_01',
  x: 2832,
  y: 7264,
  label: 'Dungeon Exit',
};

const RACE_START_MAPS = {
  human: 'human_starting',
  dwarf: 'dwarf_starting',
  undead: 'undead_starting',
  elf: 'elf_starting',
  orc: 'orc_starting',
};
const STARTING_MAP_IDS = new Set(Object.values(RACE_START_MAPS));

const WORLD_LIKE_MAP_IDS = new Set([
  'world',
  'human_starting',
  'dwarf_starting',
  'undead_starting',
  'elf_starting',
  'orc_starting',
]);
WORLD_V2_MAP_IDS.forEach((mapId) => WORLD_LIKE_MAP_IDS.add(mapId));

const WORLD_MAP_BIOME_COLORS = {
  starter_forest: '#6f9b42',
  countryside: '#9eb15e',
  old_forest: '#4f7e38',
  riverlands: '#5f9aa3',
  hills: '#8b9657',
  mountain_pass: '#8a856c',
  rocky_highlands: '#7f7f71',
  swamp: '#55785c',
  ancient_ruins: '#7d7768',
  coastal: '#78a293',
  dry_grassland: '#b4a957',
  wild_end: '#627150',
  emerald_vale: '#6fa858',
  golden_fields: '#b2b865',
  elderwood: '#4c8547',
  silver_river: '#5d9ba5',
  sunhill: '#919c59',
  cloudspine: '#8a856c',
  ironcrag: '#7d7d70',
  murkfen: '#547b61',
  old_empire: '#817867',
  saltwind: '#7fa492',
  amber_steppe: '#b9a85b',
  shadowfen: '#5f7355',
};

const QUEST_GIVER_PROFILES = {
  human_starting: {
    id: 'human-starting-warden',
    name: 'Marshal Elowen',
    title: 'Northshire Warden',
    dialogue: 'The road is not safe yet. Prove yourself here, then I will send you onward.',
  },
  dwarf_starting: {
    id: 'dwarf-starting-warden',
    name: 'Borin Stonewatch',
    title: 'Mountain Warden',
    dialogue: 'The holds need steady hands. Clear the passes and earn your road writ.',
  },
  elf_starting: {
    id: 'elf-starting-warden',
    name: 'Lethariel Moonbough',
    title: 'Grove Warden',
    dialogue: 'The forest whispers of trouble. Hunt cleanly, then carry our word beyond the boughs.',
  },
  orc_starting: {
    id: 'orc-starting-warden',
    name: 'Gorvak Dustcaller',
    title: 'Clan Warden',
    dialogue: 'Strength first. Clear the hunting grounds, then take the road to the wider war.',
  },
  undead_starting: {
    id: 'undead-starting-warden',
    name: 'Mirella Gravehand',
    title: 'Crypt Warden',
    dialogue: 'The dead do not rest, and neither do we. Finish these tasks and report beyond the grave road.',
  },
  world: {
    id: WORLD_QUEST_GIVER_ID,
    name: 'Quartermaster Vale',
    title: 'Arrival Quartermaster',
    dialogue: 'New arrivals report here. I will record your transfer and send word that you survived the road.',
  },
};

function normalizeMapId(mapId) {
  return MAP_FILES[mapId] ? mapId : 'world';
}

function isWorldLikeMap(mapId) {
  return WORLD_LIKE_MAP_IDS.has(normalizeMapId(mapId));
}

function isWorldV2Map(mapId) {
  return WORLD_V2_MAP_ID_SET.has(normalizeMapId(mapId));
}

function getWorldGenerationIdFromMapId(mapId, fallback = 'v2') {
  const match = String(normalizeMapId(mapId) ?? '').match(/^world_region_\d+_\d+_(v\d+)$/);
  return WORLD_STREAM_GENERATIONS[match?.[1]] ? match[1] : fallback;
}

function getWorldGenerationConfig(generationId = 'v2') {
  return WORLD_STREAM_GENERATIONS[generationId] ?? WORLD_STREAM_GENERATIONS.v2;
}

function isStartingMapId(mapId) {
  return STARTING_MAP_IDS.has(normalizeMapId(mapId));
}

function getRandomWorldV2MapId(generationId = 'v2') {
  const generationMapIds = WORLD_V2_MAP_IDS.filter((mapId) => mapId.endsWith(`_${generationId}`));
  return generationMapIds[Math.floor(Math.random() * generationMapIds.length)] ?? `world_region_2_2_${generationId}`;
}

function getWorldV2RegionCoordsFromMapId(mapId) {
  const match = String(mapId ?? '').match(/^world_region_(\d+)_(\d+)_(v\d+)$/);
  if (!match) return null;
  const regionX = Number(match[1]);
  const regionY = Number(match[2]);
  const generationId = WORLD_STREAM_GENERATIONS[match[3]] ? match[3] : 'v2';
  if (
    !Number.isInteger(regionX)
    || !Number.isInteger(regionY)
    || regionX < 0
    || regionY < 0
    || regionX >= WORLD_V2_REGION_GRID
    || regionY >= WORLD_V2_REGION_GRID
  ) {
    return null;
  }
  return { regionX, regionY, generationId };
}

function getWorldV2MapIdFromRegionCoords(regionX, regionY, generationId = 'v2') {
  const x = Number(regionX);
  const y = Number(regionY);
  if (
    !Number.isInteger(x)
    || !Number.isInteger(y)
    || x < 0
    || y < 0
    || x >= WORLD_V2_REGION_GRID
    || y >= WORLD_V2_REGION_GRID
  ) {
    return null;
  }
  return `world_region_${x}_${y}_${getWorldGenerationConfig(generationId).id}`;
}

function getWorldV2RegionCoordsFromPoint(x, y) {
  if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return { regionX: 0, regionY: 0 };
  return {
    regionX: clamp(Math.floor(Number(x) / WORLD_V2_REGION_PIXEL_SIZE), 0, WORLD_V2_REGION_GRID - 1),
    regionY: clamp(Math.floor(Number(y) / WORLD_V2_REGION_PIXEL_SIZE), 0, WORLD_V2_REGION_GRID - 1),
  };
}

function getWorldV2MapIdFromPoint(x, y, generationId = 'v2') {
  const coords = getWorldV2RegionCoordsFromPoint(x, y);
  return getWorldV2MapIdFromRegionCoords(coords.regionX, coords.regionY, generationId);
}

function getWorldV2ChunkCoordsFromPoint(x, y) {
  if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return { chunkX: 0, chunkY: 0 };
  return {
    chunkX: clamp(Math.floor(Number(x) / WORLD_V2_CHUNK_PIXEL_SIZE), 0, WORLD_V2_CHUNK_GRID - 1),
    chunkY: clamp(Math.floor(Number(y) / WORLD_V2_CHUNK_PIXEL_SIZE), 0, WORLD_V2_CHUNK_GRID - 1),
  };
}

function getWorldV2ChunkId(chunkX, chunkY) {
  const x = Number(chunkX);
  const y = Number(chunkY);
  if (
    !Number.isInteger(x)
    || !Number.isInteger(y)
    || x < 0
    || y < 0
    || x >= WORLD_V2_CHUNK_GRID
    || y >= WORLD_V2_CHUNK_GRID
  ) {
    return null;
  }
  return `chunk_${x}_${y}`;
}

function getWorldV2ChunkCacheKey(chunkId, generationId = 'v2') {
  return `${getWorldGenerationConfig(generationId).id}:${chunkId}`;
}

function formatWorldGenerationLabel(generationId = 'v2') {
  return getWorldGenerationConfig(generationId).id.toUpperCase();
}

function getWorldV2ChunkIdsAround(point, radius = WORLD_V2_ACTIVE_CHUNK_RADIUS) {
  const center = getWorldV2ChunkCoordsFromPoint(point?.x, point?.y);
  const chunkIds = [];
  for (let chunkY = center.chunkY - radius; chunkY <= center.chunkY + radius; chunkY += 1) {
    for (let chunkX = center.chunkX - radius; chunkX <= center.chunkX + radius; chunkX += 1) {
      const chunkId = getWorldV2ChunkId(chunkX, chunkY);
      if (chunkId) chunkIds.push(chunkId);
    }
  }
  return chunkIds;
}

function getWorldV2RegionOffset(mapIdOrCoords) {
  const coords = typeof mapIdOrCoords === 'string'
    ? getWorldV2RegionCoordsFromMapId(mapIdOrCoords)
    : mapIdOrCoords;
  if (!coords) return { x: 0, y: 0 };
  return {
    x: coords.regionX * WORLD_V2_REGION_PIXEL_SIZE,
    y: coords.regionY * WORLD_V2_REGION_PIXEL_SIZE,
  };
}

function toWorldV2GlobalPosition(mapId, point) {
  const offset = getWorldV2RegionOffset(mapId);
  return {
    ...point,
    x: offset.x + safeNumber(point?.x, 0),
    y: offset.y + safeNumber(point?.y, 0),
  };
}

function toWorldV2LocalPosition(mapId, point) {
  const offset = getWorldV2RegionOffset(mapId);
  return {
    ...point,
    x: safeNumber(point?.x, 0) - offset.x,
    y: safeNumber(point?.y, 0) - offset.y,
  };
}

function normalizeWorldV2PositionForMap(mapId, point) {
  if (!isWorldV2Map(mapId) || !point) return point;
  const x = safeNumber(point.x, 0);
  const y = safeNumber(point.y, 0);
  const offset = getWorldV2RegionOffset(mapId);
  const looksLikeLegacyLocalPosition = x >= 0
    && y >= 0
    && x < WORLD_V2_REGION_PIXEL_SIZE
    && y < WORLD_V2_REGION_PIXEL_SIZE
    && (offset.x !== 0 || offset.y !== 0);
  return looksLikeLegacyLocalPosition ? toWorldV2GlobalPosition(mapId, point) : { ...point, x, y };
}

function getGameplayMapSpaceId(mapId) {
  return isWorldV2Map(mapId)
    ? getWorldGenerationConfig(getWorldGenerationIdFromMapId(mapId)).mapSpaceId
    : normalizeMapId(mapId);
}

function getRaceStartMapId(raceId) {
  return RACE_START_MAPS[String(raceId ?? '').toLowerCase()] ?? 'human_starting';
}

function getCharacterTargetMapId(character) {
  return normalizeMapId(character?.position?.mapId ?? getRaceStartMapId(character?.raceId));
}

function formatZoneDisplayName(zone) {
  const rawName = String(zone?.props?.displayName ?? zone?.props?.label ?? zone?.name ?? '').trim();
  if (!rawName || /^[a-z]+_[a-z0-9_]+$/i.test(rawName)) return '';
  return rawName
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getZoneId(zone) {
  return String(zone?.props?.zoneId ?? zone?.props?.regionId ?? zone?.id ?? zone?.name ?? '').trim();
}

function getZoneBiomeId(zone) {
  return String(zone?.props?.biomeType ?? zone?.props?.biomeId ?? zone?.biomeId ?? zone?.biome ?? '').trim();
}

function getZoneDescription(zone) {
  return String(zone?.props?.description ?? zone?.props?.role ?? zone?.role ?? '').trim();
}

function getZoneLevelLabel(zone) {
  const minLevel = zone?.props?.recommendedLevel ?? zone?.props?.dangerLevel ?? zone?.recommendedLevel;
  return minLevel ? `Recommended ${minLevel}+` : '';
}

function isPointInsideZone(point, zone) {
  if (!point || !zone) return false;
  const x = safeNumber(zone.x, 0);
  const y = safeNumber(zone.y, 0);
  const width = safeNumber(zone.width, 0);
  const height = safeNumber(zone.height, 0);
  return point.x >= x && point.y >= y && point.x <= x + width && point.y <= y + height;
}

function zoneIntersectsView(zone, view) {
  if (!zone || !view) return false;
  const x = safeNumber(zone.x, 0);
  const y = safeNumber(zone.y, 0);
  const width = safeNumber(zone.width, 0);
  const height = safeNumber(zone.height, 0);
  return x + width >= view.x
    && y + height >= view.y
    && x <= view.x + view.width
    && y <= view.y + view.height;
}

function createRegistryZone(region, tileSize = WORLD.tile) {
  const x = safeNumber(region?.x, 0) * tileSize;
  const y = safeNumber(region?.y, 0) * tileSize;
  const width = safeNumber(region?.width, WORLD_V2_REGION_TILES) * tileSize;
  const height = safeNumber(region?.height, WORLD_V2_REGION_TILES) * tileSize;
  return {
    id: region?.id,
    name: region?.id,
    x,
    y,
    width,
    height,
    props: {
      zoneId: region?.zoneId ?? region?.id,
      regionId: region?.id,
      displayName: region?.displayName,
      biomeId: region?.biomeId,
      biomeType: region?.biomeType ?? region?.biomeId,
      description: region?.description ?? region?.role,
      role: region?.role,
      recommendedLevel: region?.recommendedLevel,
      showOnMap: true,
      debugOnly: false,
    },
    mapId: String(region?.file ?? '').replace(/\.tmj$/i, '') || undefined,
  };
}

function dedupeZones(zones) {
  const byId = new globalThis.Map();
  zones.filter(Boolean).forEach((zone) => {
    const id = getZoneId(zone) || `${Math.round(zone.x)}:${Math.round(zone.y)}:${Math.round(zone.width)}:${Math.round(zone.height)}`;
    if (!byId.has(id)) byId.set(id, zone);
  });
  return [...byId.values()];
}

function zoneViewFor(zone, worldWidth, worldHeight, zoom = 1) {
  if (!zone) {
    const fallbackSize = Math.min(worldWidth, worldHeight, WORLD_V2_REGION_PIXEL_SIZE);
    return {
      x: clamp((worldWidth - fallbackSize) / 2, 0, Math.max(0, worldWidth - fallbackSize)),
      y: clamp((worldHeight - fallbackSize) / 2, 0, Math.max(0, worldHeight - fallbackSize)),
      width: fallbackSize,
      height: fallbackSize,
    };
  }

  const padding = Math.min(WORLD_V2_REGION_PIXEL_SIZE * 0.16, 4096);
  const baseWidth = Math.min(worldWidth, Math.max(1, safeNumber(zone.width, 1) + padding * 2));
  const baseHeight = Math.min(worldHeight, Math.max(1, safeNumber(zone.height, 1) + padding * 2));
  const zoomValue = clamp(zoom, 1, 4);
  const width = Math.max(1, baseWidth / zoomValue);
  const height = Math.max(1, baseHeight / zoomValue);
  const centerX = safeNumber(zone.x, 0) + safeNumber(zone.width, 0) / 2;
  const centerY = safeNumber(zone.y, 0) + safeNumber(zone.height, 0) / 2;
  return {
    x: clamp(centerX - width / 2, 0, Math.max(0, worldWidth - width)),
    y: clamp(centerY - height / 2, 0, Math.max(0, worldHeight - height)),
    width: Math.min(width, worldWidth),
    height: Math.min(height, worldHeight),
  };
}

export {
  OFFLINE_DEMO,
  OFFLINE_USER,
  WORLD,
  RESOLUTION_OPTIONS,
  MAP_FILES,
  WORLD_V2_REGION_GRID,
  WORLD_V2_REGION_TILES,
  WORLD_V2_REGION_PIXEL_SIZE,
  WORLD_V2_WORLD_TILES,
  WORLD_V2_WORLD_PIXEL_SIZE,
  WORLD_V2_CHUNK_TILES,
  WORLD_V2_CHUNK_PIXEL_SIZE,
  WORLD_V2_CHUNK_GRID,
  WORLD_V2_ACTIVE_CHUNK_RADIUS,
  WORLD_V2_PRELOAD_CHUNK_RADIUS,
  WORLD_V2_CHUNK_INDEX_FILE,
  WORLD_V2_CHUNK_ASSET_VERSION,
  WORLD_V2_REGISTRY_FILE,
  WORLD_V3_HUB_MAP_ID,
  WORLD_V3_QUEST_GIVER_ID,
  WORLD_V3_AFTER_STARTING_SPAWN_NAME,
  WORLD_V3_HUB_ARRIVAL,
  WORLD_V3_HUB_TURN_IN_MARKER,
  WORLD_STREAM_GENERATIONS,
  WORLD_STREAM_GENERATION_IDS,
  WORLD_V2_MAP_IDS,
  WORLD_V2_MAP_ID_SET,
  WORLD_MAP_VERSION,
  WORLD_QUEST_GIVER_ID,
  WORLD_QUEST_TURN_IN_MARKER,
  DUNGEON_ENTRANCE_MARKER,
  DUNGEON_EXIT_MARKER,
  RACE_START_MAPS,
  STARTING_MAP_IDS,
  WORLD_LIKE_MAP_IDS,
  WORLD_MAP_BIOME_COLORS,
  QUEST_GIVER_PROFILES,
  normalizeMapId,
  isWorldLikeMap,
  isWorldV2Map,
  getWorldGenerationIdFromMapId,
  getWorldGenerationConfig,
  isStartingMapId,
  getRandomWorldV2MapId,
  getWorldV2RegionCoordsFromMapId,
  getWorldV2MapIdFromRegionCoords,
  getWorldV2RegionCoordsFromPoint,
  getWorldV2MapIdFromPoint,
  getWorldV2ChunkCoordsFromPoint,
  getWorldV2ChunkId,
  getWorldV2ChunkCacheKey,
  formatWorldGenerationLabel,
  getWorldV2ChunkIdsAround,
  getWorldV2RegionOffset,
  toWorldV2GlobalPosition,
  toWorldV2LocalPosition,
  normalizeWorldV2PositionForMap,
  getGameplayMapSpaceId,
  getRaceStartMapId,
  getCharacterTargetMapId,
  formatZoneDisplayName,
  getZoneId,
  getZoneBiomeId,
  getZoneDescription,
  getZoneLevelLabel,
  isPointInsideZone,
  zoneIntersectsView,
  createRegistryZone,
  dedupeZones,
  zoneViewFor,
};
