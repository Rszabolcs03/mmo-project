import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Room, Server } from 'colyseus';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const WORLD = {
  width: 9600,
  height: 19200,
};

const MAP_IDS = {
  WORLD: 'world',
  DUNGEON_01: 'dungeon_01',
};

const CONTINENT_01_ID = 'continent_01';
const CONTINENT_01_REGION_PREFIX = 'continent_01_region';
const CONTINENT_01_REGION_PATH = 'world_map/continents/continent_01/regions';
const WORLD_V3_HUB_MAP_ID = 'continent_01_region_0_0';

const MAP_FILES = {
  starting_human: 'starting_zones/human/starting_human.tmj',
  starting_dwarf: 'starting_zones/dwarf/starting_dwarf.tmj',
  starting_neutral: 'starting_zones/neutral/starting_neutral.tmj',
  starting_elf: 'starting_zones/elf/starting_elf.tmj',
  starting_orc: 'starting_zones/orc/starting_orc.tmj',
  [MAP_IDS.DUNGEON_01]: 'dungeons/dungeon_01/dungeon_01.tmj',
};

const WORLD_V2_REGION_GRID = 5;
const WORLD_V2_REGION_TILES = 800;
const WORLD_V2_TILE_SIZE = 32;
const WORLD_V2_REGION_PIXEL_SIZE = WORLD_V2_REGION_TILES * WORLD_V2_TILE_SIZE;
const WORLD_V2_WORLD_PIXEL_SIZE = WORLD_V2_REGION_GRID * WORLD_V2_REGION_TILES * WORLD_V2_TILE_SIZE;
const WORLD_STREAM_GENERATIONS = {
  v2: { id: 'v2', mapSpaceId: CONTINENT_01_ID, aliasOf: 'v3' },
  v3: { id: 'v3', mapSpaceId: CONTINENT_01_ID },
};
const WORLD_STREAM_GENERATION_IDS = Object.keys(WORLD_STREAM_GENERATIONS);
const WORLD_V2_MAP_IDS = WORLD_STREAM_GENERATION_IDS.flatMap((generationId) => (
  Array.from({ length: WORLD_V2_REGION_GRID * WORLD_V2_REGION_GRID }, (_, index) => {
    const x = index % WORLD_V2_REGION_GRID;
    const y = Math.floor(index / WORLD_V2_REGION_GRID);
    return generationId === 'v3'
      ? `${CONTINENT_01_REGION_PREFIX}_${x}_${y}`
      : `world_region_${x}_${y}_${generationId}`;
  })
));
const WORLD_V2_MAP_ID_SET = new Set(WORLD_V2_MAP_IDS);
WORLD_V2_MAP_IDS.forEach((mapId) => {
  if (mapId.startsWith(CONTINENT_01_REGION_PREFIX)) {
    MAP_FILES[mapId] = `${CONTINENT_01_REGION_PATH}/${mapId}.tmj`;
  }
});

const WORLD_LIKE_MAP_IDS = new Set([
  'starting_human',
  'starting_dwarf',
  'starting_neutral',
  'starting_elf',
  'starting_orc',
]);
WORLD_V2_MAP_IDS.forEach((mapId) => WORLD_LIKE_MAP_IDS.add(mapId));
const STARTING_MAP_IDS = new Set([
  'starting_human',
  'starting_dwarf',
  'starting_neutral',
  'starting_elf',
  'starting_orc',
]);

const MAP_ALIASES = {
  [MAP_IDS.WORLD]: WORLD_V3_HUB_MAP_ID,
  old_world: WORLD_V3_HUB_MAP_ID,
  old_world_map: WORLD_V3_HUB_MAP_ID,
  main_world: WORLD_V3_HUB_MAP_ID,
  world_map: WORLD_V3_HUB_MAP_ID,
  world_map_tmj: WORLD_V3_HUB_MAP_ID,
  new_world: WORLD_V3_HUB_MAP_ID,
  new_world_v3: WORLD_V3_HUB_MAP_ID,
  world_v3: WORLD_V3_HUB_MAP_ID,
  world_continent_v3: WORLD_V3_HUB_MAP_ID,
  world_continent_v4: WORLD_V3_HUB_MAP_ID,
  continent_01: WORLD_V3_HUB_MAP_ID,
  human_starting: 'starting_human',
  dwarf_starting: 'starting_dwarf',
  undead_starting: 'starting_neutral',
  elf_starting: 'starting_elf',
  orc_starting: 'starting_orc',
  starting_undead: 'starting_neutral',
  human_starting_zone_v4: 'starting_human',
  dwarf_starting_zone: 'starting_dwarf',
  undead_starting_zone: 'starting_neutral',
  elf_starting_zone: 'starting_elf',
  orc_starting_zone: 'starting_orc',
};

for (let regionY = 0; regionY < WORLD_V2_REGION_GRID; regionY += 1) {
  for (let regionX = 0; regionX < WORLD_V2_REGION_GRID; regionX += 1) {
    const canonicalMapId = `${CONTINENT_01_REGION_PREFIX}_${regionX}_${regionY}`;
    [`world_region_${regionX}_${regionY}`, `world_region_${regionX}_${regionY}_v2`, `world_region_${regionX}_${regionY}_v3`].forEach((legacyMapId) => {
      MAP_ALIASES[legacyMapId] = canonicalMapId;
    });
  }
}

function normalizeMapId(mapId) {
  const rawMapId = String(mapId ?? MAP_IDS.WORLD).trim().replace(/\\/g, '/').replace(/\.tmj$/i, '');
  const bareMapId = rawMapId.split('/').pop() ?? rawMapId;
  const aliasedMapId = MAP_ALIASES[rawMapId]
    ?? MAP_ALIASES[rawMapId.toLowerCase()]
    ?? MAP_ALIASES[bareMapId]
    ?? MAP_ALIASES[bareMapId.toLowerCase()];
  if (aliasedMapId && MAP_FILES[aliasedMapId]) return aliasedMapId;
  if (MAP_FILES[rawMapId]) return rawMapId;
  if (MAP_FILES[bareMapId]) return bareMapId;
  return WORLD_V3_HUB_MAP_ID;
}

function isWorldLikeMap(mapId) {
  return WORLD_LIKE_MAP_IDS.has(normalizeMapId(mapId));
}

function isWorldV2Map(mapId) {
  return WORLD_V2_MAP_ID_SET.has(normalizeMapId(mapId));
}

function getWorldGenerationIdFromMapId(mapId, fallback = 'v2') {
  const normalizedMapId = normalizeMapId(mapId);
  if (new RegExp(`^${CONTINENT_01_REGION_PREFIX}_\\d+_\\d+$`).test(normalizedMapId)) return 'v3';
  const match = String(normalizedMapId ?? '').match(/^world_region_\d+_\d+_(v\d+)$/);
  return WORLD_STREAM_GENERATIONS[match?.[1]] ? match[1] : fallback;
}

function isStartingMapId(mapId) {
  return STARTING_MAP_IDS.has(normalizeMapId(mapId));
}

function getGameplayMapSpaceId(mapId) {
  return isWorldV2Map(mapId)
    ? WORLD_STREAM_GENERATIONS[getWorldGenerationIdFromMapId(mapId)].mapSpaceId
    : normalizeMapId(mapId);
}

function normalizeEnemyKind(value) {
  return String(value ?? '').toLowerCase().trim().replace(/[_\s]+/g, '-');
}

const PLAYER = {
  radius: 18,
};

const ENEMY = {
  maxCount: 18,
  radius: 17,
  speed: 155,
  spawnEvery: 1200,
  wanderSpeed: 72,
};

const ENEMY_LEASH_GRACE_MS = 4200;
const ENEMY_LEASH_DISTANCE = 760;
const BOSS_LEASH_DISTANCE = 980;
const DUNGEON_FINAL_BOSS_LEASH_DISTANCE = 1180;
const ENEMY_AGGRO_RESET_COOLDOWN_MS = 2500;
const ENEMY_ATTACK_ANIMATION_MS = 420;
const ENEMY_ATTACK_IMPACT_MS = 210;
const WORLD_BOSS_MECHANICS = Object.freeze({
  'tideglass-matriarch': Object.freeze({
    type: 'tidal-volley',
    damage: 78,
    initialDelay: 2200,
    telegraphDuration: 520,
    recoveryDuration: 320,
    cooldown: 5600,
    activationRange: 500,
    maxTravelDistance: 680,
    projectileSpeed: 540,
    projectileRadius: 24,
    projectileCountMin: 3,
    projectileCountMax: 4,
    projectileSpread: 0.14,
    targetLeadMs: 140,
    targetLeadMaxDistance: 56,
    slowDuration: 2400,
    slowMultiplier: 0.58,
    rangedAttack: Object.freeze({
      type: 'water-bolt',
      range: 620,
      attackStartRange: 445,
      preferredRange: 335,
      projectileSpeed: 680,
      projectileRadius: 22,
      launchDelay: 180,
      recoveryDuration: 180,
      cooldown: 1150,
      targetLeadMs: 180,
      targetLeadMaxDistance: 72,
      slowDuration: 1800,
      slowMultiplier: 0.68,
    }),
  }),
  'old-quarry-giant': Object.freeze({
    type: 'ground-slam',
    radius: 175,
    damage: 96,
    initialDelay: 2400,
    telegraphDuration: 900,
    totalDuration: 1200,
    cooldown: 7000,
    secondary: Object.freeze({
      type: 'boulder-toss',
      damage: 72,
      initialDelay: 3400,
      telegraphDuration: 650,
      recoveryDuration: 380,
      cooldown: 6100,
      activationRange: 760,
      minRange: 105,
      maxTravelDistance: 700,
      projectileSpeed: 430,
      projectileRadius: 42,
      projectileCountMin: 3,
      projectileCountMax: 4,
      projectileSpread: 0.22,
      slowDuration: 3000,
      slowMultiplier: 0.52,
    }),
  }),
});
const WORLD_BROADCAST_MS = 50;
const PARTY_INVITE_COOLDOWN_MS = 8000;
const PARTY_MAX_MEMBERS = 5;
const MAX_LEVEL = 30;
const ADMIN_EMAILS = new Set(['romvariszabi03@gmail.com']);
const WORLD_TIME_PHASES = new Set(['dawn', 'day', 'evening', 'night']);
const WORLD_WEATHER_PHASES = new Set(['clear', 'cloudy', 'rain', 'storm']);

const ENEMY_XP = 35;
const BOSS_XP = 180;
const BOSS_SPAWN_MIN = 18000;
const BOSS_SPAWN_MAX = 34000;

function getWorldBossMechanicConfig(enemy) {
  const kind = normalizeEnemyKind(enemy?.bossType ?? enemy?.enemyKind ?? enemy?.spriteId ?? enemy?.name);
  return WORLD_BOSS_MECHANICS[kind] ?? null;
}

function getActiveWorldBossMechanicConfig(mechanicConfig, mechanicType) {
  if (!mechanicConfig || !mechanicType) return null;
  if (mechanicConfig.type === mechanicType) return mechanicConfig;
  return mechanicConfig.secondary?.type === mechanicType ? mechanicConfig.secondary : null;
}

function createBossProjectilePattern(source, target, config, now) {
  const originX = safeNumber(source?.x, 0);
  const originY = safeNumber(source?.y, 0);
  const targetLeadSeconds = Math.max(0, safeNumber(config?.targetLeadMs, 0)) / 1000;
  const targetLeadMaxDistance = Math.max(0, safeNumber(config?.targetLeadMaxDistance, 0));
  const rawLeadX = safeNumber(target?.vx, 0) * targetLeadSeconds;
  const rawLeadY = safeNumber(target?.vy, 0) * targetLeadSeconds;
  const rawLeadDistance = Math.hypot(rawLeadX, rawLeadY);
  const leadScale = rawLeadDistance > targetLeadMaxDistance && rawLeadDistance > 0
    ? targetLeadMaxDistance / rawLeadDistance
    : 1;
  const targetX = safeNumber(target?.x, originX + 1) + rawLeadX * leadScale;
  const targetY = safeNumber(target?.y, originY) + rawLeadY * leadScale;
  const baseAngle = Math.atan2(targetY - originY, targetX - originX);
  const targetDistance = Math.hypot(targetX - originX, targetY - originY);
  const maxTravelDistance = Math.max(96, safeNumber(config?.maxTravelDistance, config?.activationRange ?? 720));
  const travelDistance = clamp(targetDistance, 96, maxTravelDistance);
  const projectileSpeed = Math.max(80, safeNumber(config?.projectileSpeed, 420));
  const projectileCountMin = clamp(Math.floor(safeNumber(config?.projectileCountMin, config?.projectileCount ?? 1)), 1, 7);
  const projectileCountMax = clamp(Math.floor(safeNumber(config?.projectileCountMax, projectileCountMin)), projectileCountMin, 7);
  const projectileCount = projectileCountMin + Math.floor(Math.random() * (projectileCountMax - projectileCountMin + 1));
  const projectileSpread = safeNumber(config?.projectileSpread, 0);
  const launchAt = now + Math.max(0, safeNumber(config?.telegraphDuration, config?.launchDelay ?? 0));

  return Array.from({ length: projectileCount }, (_, index) => {
    const offset = index - (projectileCount - 1) / 2;
    const angle = baseAngle + offset * projectileSpread;
    const projectileTargetX = originX + Math.cos(angle) * travelDistance;
    const projectileTargetY = originY + Math.sin(angle) * travelDistance;
    return {
      id: `${String(config?.type ?? 'projectile')}-${index}`,
      type: String(config?.type ?? 'projectile'),
      originX,
      originY,
      targetX: projectileTargetX,
      targetY: projectileTargetY,
      launchAt,
      impactAt: launchAt + (travelDistance / projectileSpeed) * 1000,
      radius: Math.max(4, safeNumber(config?.projectileRadius, 18)),
    };
  });
}

function getBossProjectilePoint(projectile, at) {
  const launchAt = safeNumber(projectile?.launchAt, 0);
  const impactAt = Math.max(launchAt + 1, safeNumber(projectile?.impactAt, launchAt + 1));
  const progress = clamp((at - launchAt) / (impactAt - launchAt), 0, 1);
  return {
    x: safeNumber(projectile?.originX, 0) + (safeNumber(projectile?.targetX, 0) - safeNumber(projectile?.originX, 0)) * progress,
    y: safeNumber(projectile?.originY, 0) + (safeNumber(projectile?.targetY, 0) - safeNumber(projectile?.originY, 0)) * progress,
  };
}

function bossProjectileSweptHit(projectile, target, previousTime, now, extraRadius = 0) {
  const launchAt = safeNumber(projectile?.launchAt, 0);
  const impactAt = safeNumber(projectile?.impactAt, launchAt);
  if (now < launchAt || previousTime > impactAt) return false;
  const from = getBossProjectilePoint(projectile, Math.max(launchAt, Math.min(previousTime, impactAt)));
  const to = getBossProjectilePoint(projectile, Math.max(launchAt, Math.min(now, impactAt)));
  const segmentX = to.x - from.x;
  const segmentY = to.y - from.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  const projection = segmentLengthSquared > 0
    ? clamp(((safeNumber(target?.x, 0) - from.x) * segmentX + (safeNumber(target?.y, 0) - from.y) * segmentY) / segmentLengthSquared, 0, 1)
    : 0;
  const closestX = from.x + segmentX * projection;
  const closestY = from.y + segmentY * projection;
  return Math.hypot(safeNumber(target?.x, 0) - closestX, safeNumber(target?.y, 0) - closestY)
    <= Math.max(4, safeNumber(projectile?.radius, 18)) + Math.max(0, extraRadius);
}
const BOSS_RESPAWN_DELAY = 60000;
const DUNGEON_PACK_SIZE = 6;
const DUNGEON_HP_SCALE_BY_PARTY_SIZE = new Map([
  [1, 0.70],
  [2, 0.82],
  [3, 0.94],
  [4, 1.08],
  [5, 1.22],
]);
const DUNGEON_EXTRA_DPS_HP_SCALE = 0.20;
const DUNGEON_TRINITY_HP_DISCOUNT = 0.08;
const DUNGEON_MIN_HP_SCALE = 0.62;
const DUNGEON_MAX_HP_SCALE = 2.20;

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getMessageEmail(message) {
  return normalizeEmail(message?.auth?.email ?? message?.email ?? message?.authEmail);
}

function isAdminEmail(value) {
  return ADMIN_EMAILS.has(normalizeEmail(value));
}

function normalizeWorldControlPhase(value, validPhases) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'auto') return null;
  return validPhases.has(normalized) ? normalized : undefined;
}

function normalizeWorldControlSpeed(value) {
  return clamp(safeNumber(value, 1), 0, 600);
}

function normalizeInteriorSpaceId(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized || ['none', 'null', 'outside', 'overworld'].includes(normalized.toLowerCase())) return null;
  return normalized;
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safePoint(point, fallback = { x: 0, y: 0 }) {
  return {
    x: safeNumber(point?.x, fallback.x),
    y: safeNumber(point?.y, fallback.y),
  };
}

function isFinitePoint(point) {
  return Boolean(point) && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
}

function clamp(value, min, max) {
  const numeric = safeNumber(value, min);
  return Math.min(Math.max(numeric, min), max);
}

function distance(a, b) {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point, start, end) {
  if (!isFinitePoint(point) || !isFinitePoint(start) || !isFinitePoint(end)) return Number.POSITIVE_INFINITY;
  const lineX = end.x - start.x;
  const lineY = end.y - start.y;
  const lengthSquared = lineX * lineX + lineY * lineY;
  if (lengthSquared === 0) return distance(point, start);

  const t = clamp(((point.x - start.x) * lineX + (point.y - start.y) * lineY) / lengthSquared, 0, 1);
  return distance(point, { x: start.x + t * lineX, y: start.y + t * lineY });
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function getProperties(object) {
  return Object.fromEntries((object?.properties ?? []).map((property) => [property.name, property.value]));
}

function decodeUint32LittleEndian(buffer) {
  const data = new Uint32Array(Math.floor(buffer.length / 4));
  for (let index = 0; index < data.length; index += 1) {
    data[index] = buffer.readUInt32LE(index * 4);
  }
  return data;
}

function decodeTiledTileLayers(map, layerNames = null) {
  const allowedLayerNames = layerNames ? new Set(layerNames) : null;
  (map.layers ?? []).forEach((layer) => {
    if (allowedLayerNames && !allowedLayerNames.has(layer.name)) return;
    if (layer?.type !== 'tilelayer' || Array.isArray(layer.data) || ArrayBuffer.isView(layer.data)) return;
    if (layer.encoding !== 'base64' || layer.compression !== 'zlib' || typeof layer.data !== 'string') return;
    layer.data = decodeUint32LittleEndian(zlib.inflateSync(Buffer.from(layer.data, 'base64')));
  });
  return map;
}

function loadTiledMapFile(fileName, { decodeTiles = false, tileLayerNames = null } = {}) {
  const mapPath = path.join(rootDir, 'public', 'maps', fileName);
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  return decodeTiles ? decodeTiledTileLayers(map, tileLayerNames) : map;
}

function loadMapObjectLayers(fileName) {
  const map = loadTiledMapFile(fileName);
  return (map.layers ?? []).filter((layer) => layer.type === 'objectgroup');
}

function getSpawnDataSignature() {
  return Object.values(MAP_FILES)
    .map((fileName) => {
      try {
        const stat = fs.statSync(path.join(rootDir, 'public', 'maps', fileName));
        return `${fileName}:${stat.size}:${Math.floor(stat.mtimeMs)}`;
      } catch {
        return `${fileName}:missing`;
      }
    })
    .join('|');
}

function getWorldV2RegionCoordsFromMapId(mapId) {
  const normalizedMapId = normalizeMapId(mapId);
  const match = String(normalizedMapId).match(new RegExp(`^${CONTINENT_01_REGION_PREFIX}_(\\d+)_(\\d+)$`));
  if (!match) return null;
  return {
    regionX: Number(match[1]),
    regionY: Number(match[2]),
  };
}

function getWorldV2RegionOffset(mapId) {
  const coords = getWorldV2RegionCoordsFromMapId(mapId);
  if (!coords) return { x: 0, y: 0 };
  return {
    x: coords.regionX * WORLD_V2_REGION_PIXEL_SIZE,
    y: coords.regionY * WORLD_V2_REGION_PIXEL_SIZE,
  };
}

function readObjects(objectLayers, layerName, mapId = MAP_IDS.WORLD) {
  const normalizedMapId = normalizeMapId(mapId);
  const layer = objectLayers.find((candidate) => candidate.name === layerName);
  const layerProps = getProperties(layer ?? {});
  const offset = getWorldV2RegionOffset(normalizedMapId);
  return layer
    ?.objects
    ?.map((object) => {
      const localX = safeNumber(object.x, 0);
      const localY = safeNumber(object.y, 0);
      return {
        ...object,
        x: localX + offset.x,
        y: localY + offset.y,
        localX,
        localY,
        layerName,
        regionMapId: normalizedMapId,
        mapId: normalizedMapId,
        props: {
          ...layerProps,
          ...getProperties(object),
          mapId: normalizedMapId,
          regionMapId: normalizedMapId,
        },
      };
    }) ?? [];
}

function readObjectsFromLayers(objectLayers, layerNames, mapId = MAP_IDS.WORLD) {
  return layerNames.flatMap((layerName) => readObjects(objectLayers, layerName, mapId));
}

function normalizeTiledLayerName(value) {
  return String(value ?? '').toLowerCase().replace(/[\s_-]+/g, '');
}

function isInteriorCollisionLayer(layer) {
  const name = normalizeTiledLayerName(layer?.name);
  const props = getProperties(layer ?? {});
  const layerType = normalizeTiledLayerName(props.type ?? props.kind);
  return ['interiorcollision', 'cavecollision', 'cavecollisions'].includes(name)
    || ['interiorcollision', 'cavecollision'].includes(layerType)
    || props.collision === true;
}

function isInteriorWalkableLayer(layer) {
  const name = normalizeTiledLayerName(layer?.name);
  const props = getProperties(layer ?? {});
  const layerType = normalizeTiledLayerName(props.type ?? props.kind);
  return ['caveinteriors', 'caveentrances', 'cityinteriors', 'interiors', 'interiorfloor'].includes(name)
    || ['caveinterior', 'caveentrance', 'cityinterior', 'interiorfloor'].includes(layerType);
}

function interiorLayerMatches(layer, activeInteriorId, predicate) {
  const normalizedInteriorId = normalizeInteriorSpaceId(activeInteriorId);
  if (!normalizedInteriorId || !predicate(layer)) return false;
  const props = getProperties(layer ?? {});
  const layerInteriorId = normalizeInteriorSpaceId(props.interiorId ?? props.caveId ?? props.targetInteriorId);
  return !layerInteriorId || layerInteriorId === normalizedInteriorId;
}

function layerMatchesInteriorCollision(layer, activeInteriorId) {
  return interiorLayerMatches(layer, activeInteriorId, isInteriorCollisionLayer);
}

function layerMatchesInteriorWalkable(layer, activeInteriorId) {
  return interiorLayerMatches(layer, activeInteriorId, isInteriorWalkableLayer);
}

function offsetObjectLayer(layer, offset) {
  if (!layer) return null;
  return {
    ...layer,
    objects: (layer.objects ?? []).map((object) => ({
      ...object,
      x: safeNumber(object.x, 0) + offset.x,
      y: safeNumber(object.y, 0) + offset.y,
      localX: safeNumber(object.x, 0),
      localY: safeNumber(object.y, 0),
    })),
  };
}

function loadCollisionMap(fileName, mapId = MAP_IDS.WORLD) {
  try {
    const map = loadTiledMapFile(fileName, {
      decodeTiles: true,
      tileLayerNames: ['Collision', 'CaveCollision', 'CaveInteriors', 'CaveEntrances', 'CityInteriors'],
    });
    const normalizedMapId = normalizeMapId(mapId);
    const offset = getWorldV2RegionOffset(normalizedMapId);
    const tileLayers = (map.layers ?? []).filter((layer) => layer.type === 'tilelayer');
    return {
      width: map.width,
      height: map.height,
      tilewidth: map.tilewidth,
      tileheight: map.tileheight,
      pixelWidth: map.width * map.tilewidth,
      pixelHeight: map.height * map.tileheight,
      offsetX: offset.x,
      offsetY: offset.y,
      tileLayer: (map.layers ?? []).find((layer) => layer.type === 'tilelayer' && layer.name === 'Collision') ?? null,
      objectLayer: offsetObjectLayer((map.layers ?? []).find((layer) => layer.type === 'objectgroup' && layer.name === 'Collision') ?? null, offset),
      interiorCollisionLayers: tileLayers.filter(isInteriorCollisionLayer),
      interiorWalkableLayers: tileLayers.filter(isInteriorWalkableLayer),
    };
  } catch (error) {
    console.warn(`Collision map ${fileName} could not be loaded:`, error.message);
    return null;
  }
}

const COLLISION_MAPS = Object.fromEntries(
  Object.entries(MAP_FILES).map(([mapId, fileName]) => [mapId, loadCollisionMap(fileName, mapId)]),
);

function getCollisionMap(mapId = MAP_IDS.WORLD) {
  return COLLISION_MAPS[normalizeMapId(mapId)] ?? COLLISION_MAPS[MAP_IDS.WORLD] ?? null;
}

function getMapPixelBounds(mapId = MAP_IDS.WORLD) {
  if (isWorldV2Map(mapId)) {
    return {
      width: WORLD_V2_WORLD_PIXEL_SIZE,
      height: WORLD_V2_WORLD_PIXEL_SIZE,
    };
  }
  const collisionMap = getCollisionMap(mapId);
  return {
    width: collisionMap?.pixelWidth ?? WORLD.width,
    height: collisionMap?.pixelHeight ?? WORLD.height,
  };
}

function pointIntersectsCollisionObject(object, x, y, radius) {
  const objectX = Number(object.x ?? 0);
  const objectY = Number(object.y ?? 0);
  const objectWidth = Number(object.width ?? 0);
  const objectHeight = Number(object.height ?? 0);
  if (objectWidth <= 0 || objectHeight <= 0) return false;

  const closestX = clamp(x, objectX, objectX + objectWidth);
  const closestY = clamp(y, objectY, objectY + objectHeight);
  return Math.hypot(x - closestX, y - closestY) <= radius;
}

function isTileFilledInLayer(collisionMap, layer, x, y, outsideValue = false) {
  if (!collisionMap || !layer?.data) return false;
  const tileWidth = collisionMap.tilewidth || 32;
  const tileHeight = collisionMap.tileheight || 32;
  const localX = x - safeNumber(collisionMap.offsetX, 0);
  const localY = y - safeNumber(collisionMap.offsetY, 0);
  if (localX < 0 || localY < 0 || localX >= collisionMap.pixelWidth || localY >= collisionMap.pixelHeight) return outsideValue;
  const column = Math.floor(localX / tileWidth);
  const row = Math.floor(localY / tileHeight);
  return Boolean(layer.data[row * layer.width + column]);
}

function isTileBlocked(collisionMap, x, y) {
  return isTileFilledInLayer(collisionMap, collisionMap?.tileLayer, x, y, true);
}

function isInteriorWalkableTile(collisionMap, x, y, activeInteriorId) {
  const normalizedInteriorId = normalizeInteriorSpaceId(activeInteriorId);
  if (!normalizedInteriorId) return true;
  return (collisionMap?.interiorWalkableLayers ?? [])
    .filter((layer) => layerMatchesInteriorWalkable(layer, normalizedInteriorId))
    .some((layer) => isTileFilledInLayer(collisionMap, layer, x, y, false));
}

function isInteriorTileBlocked(collisionMap, x, y, activeInteriorId) {
  const normalizedInteriorId = normalizeInteriorSpaceId(activeInteriorId);
  if (!normalizedInteriorId) return false;
  return (collisionMap?.interiorCollisionLayers ?? [])
    .filter((layer) => layerMatchesInteriorCollision(layer, normalizedInteriorId))
    .some((layer) => isTileFilledInLayer(collisionMap, layer, x, y, false));
}

function canMoveToCollision(collisionMap, x, y, radius, options = {}) {
  const activeInteriorId = normalizeInteriorSpaceId(options.activeInteriorId);
  if (!collisionMap) return !activeInteriorId;

  const points = [
    { x, y },
    { x: x - radius, y },
    { x: x + radius, y },
    { x, y: y - radius },
    { x, y: y + radius },
    { x: x - radius * 0.7, y: y - radius * 0.7 },
    { x: x + radius * 0.7, y: y - radius * 0.7 },
    { x: x - radius * 0.7, y: y + radius * 0.7 },
    { x: x + radius * 0.7, y: y + radius * 0.7 },
  ];

  if (activeInteriorId && points.some((point) => !isInteriorWalkableTile(collisionMap, point.x, point.y, activeInteriorId))) return false;
  if (!options.ignoreWorldCollision && points.some((point) => isTileBlocked(collisionMap, point.x, point.y))) return false;
  if (activeInteriorId && points.some((point) => isInteriorTileBlocked(collisionMap, point.x, point.y, activeInteriorId))) return false;

  if (options.ignoreWorldCollision) return true;
  const collisionObjects = collisionMap?.objectLayer?.objects ?? [];
  return !collisionObjects.some((object) => pointIntersectsCollisionObject(object, x, y, radius));
}

function moveEnemyWithCollision(enemy, nextX, nextY, bounds = null) {
  const radius = enemy.radius ?? ENEMY.radius;
  const mapBounds = getMapPixelBounds(enemy.mapId);
  const interiorId = normalizeInteriorSpaceId(enemy?.interiorId);
  const movementBounds = bounds ?? (interiorId ? enemy.spawnBounds : null);
  const minX = movementBounds ? movementBounds.x + radius : radius;
  const maxX = movementBounds ? movementBounds.x + movementBounds.width - radius : mapBounds.width - radius;
  const minY = movementBounds ? movementBounds.y + radius : radius;
  const maxY = movementBounds ? movementBounds.y + movementBounds.height - radius : mapBounds.height - radius;
  const collisionMap = getCollisionMap(enemy.mapId);
  const collisionOptions = interiorId ? { activeInteriorId: interiorId, ignoreWorldCollision: true } : {};
  const targetX = clamp(nextX, minX, maxX);
  const targetY = clamp(nextY, minY, maxY);

  if (canMoveToCollision(collisionMap, targetX, targetY, radius, collisionOptions)) {
    return { x: targetX, y: targetY, blocked: false };
  }
  if (canMoveToCollision(collisionMap, targetX, enemy.y, radius, collisionOptions)) {
    return { x: targetX, y: enemy.y, blocked: true };
  }
  if (canMoveToCollision(collisionMap, enemy.x, targetY, radius, collisionOptions)) {
    return { x: enemy.x, y: targetY, blocked: true };
  }
  return { x: enemy.x, y: enemy.y, blocked: true };
}

function objectSearchText(object) {
  return [
    object?.name,
    object?.type,
    object?.class,
    ...Object.entries(object?.props ?? {}).flat(),
  ].filter(Boolean).join(' ').toLowerCase();
}

function objectHasAnyTag(object, tags) {
  const text = objectSearchText(object);
  return tags.some((tag) => text.includes(tag));
}

function loadTiledSpawns() {
  try {
    const worldEnemySpawns = [];
    const worldBossSpawns = [];

    Object.entries(MAP_FILES).forEach(([mapId, fileName]) => {
      const normalizedMapId = normalizeMapId(mapId);
      if (!isWorldLikeMap(normalizedMapId)) return;

      const layers = loadMapObjectLayers(fileName);
      const spawns = [
        ...readObjectsFromLayers(layers, ['Spawns', 'CaveSpawns', 'InteriorSpawns'], normalizedMapId),
        ...readObjectsFromLayers(layers, ['BossSpawns', 'CaveBossSpawns', 'InteriorBossSpawns'], normalizedMapId),
      ];
      const bossSpawns = spawns.filter((spawn) => (
        spawn.props.bossType || objectHasAnyTag(spawn, ['boss'])
      ));
      worldBossSpawns.push(...bossSpawns);
      worldEnemySpawns.push(...spawns.filter((spawn) => (
        !bossSpawns.includes(spawn)
        && (spawn.props.enemyType || objectHasAnyTag(spawn, ['spawn', 'mob', 'mobs', 'enemy']))
      )));
    });

    const dungeonLayers = loadMapObjectLayers(MAP_FILES[MAP_IDS.DUNGEON_01]);
    const dungeonSpawns = readObjects(dungeonLayers, 'Spawns', MAP_IDS.DUNGEON_01);
    const dungeonFinalBosses = dungeonSpawns.filter((spawn) => (
      objectHasAnyTag(spawn, ['finalboss', 'final_boss', 'final boss', 'endboss'])
      || String(spawn.props.bossType ?? '').toLowerCase() === 'final'
    ));
    const dungeonMinibosses = dungeonSpawns.filter((spawn) => (
      !dungeonFinalBosses.includes(spawn)
      && (
        objectHasAnyTag(spawn, ['miniboss', 'mini_boss', 'mini boss'])
        || String(spawn.props.bossType ?? '').toLowerCase() === 'mini'
      )
    ));
    const dungeonPacks = dungeonSpawns.filter((spawn) => (
      !dungeonFinalBosses.includes(spawn)
      && !dungeonMinibosses.includes(spawn)
      && objectHasAnyTag(spawn, ['enemy_pack', 'mob_pack', 'pack', 'spawn', 'enemy', 'trash'])
    ));

    return {
      enemySpawns: worldEnemySpawns,
      bossSpawns: worldBossSpawns,
      dungeonPacks,
      dungeonMinibosses,
      dungeonFinalBosses,
    };
  } catch (error) {
    console.warn('Map spawns could not be loaded; enemy spawns disabled:', error.message);
    return {
      enemySpawns: [],
      bossSpawns: [],
      dungeonPacks: [],
      dungeonMinibosses: [],
      dungeonFinalBosses: [],
    };
  }
}

function randomPointInBounds(bounds) {
  return {
    x: bounds.x + Math.random() * Math.max(1, bounds.width),
    y: bounds.y + Math.random() * Math.max(1, bounds.height),
  };
}

function getObjectPolygonPoints(object) {
  const objectX = safeNumber(object?.x, 0);
  const objectY = safeNumber(object?.y, 0);
  return (object?.polygon ?? []).map((point) => ({
    x: objectX + safeNumber(point?.x, 0),
    y: objectY + safeNumber(point?.y, 0),
  }));
}

function getPolygonBounds(points) {
  return {
    x: Math.min(...points.map((point) => point.x)),
    y: Math.min(...points.map((point) => point.y)),
    width: Math.max(1, Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))),
    height: Math.max(1, Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y))),
  };
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index];
    const prior = polygon[previous];
    const denominator = prior.y - current.y;
    const safeDenominator = Math.abs(denominator) < 0.0001 ? (denominator < 0 ? -0.0001 : 0.0001) : denominator;
    if (((current.y > point.y) !== (prior.y > point.y))
      && point.x < ((prior.x - current.x) * (point.y - current.y)) / safeDenominator + current.x) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToPolygon(point, polygon) {
  let closest = Number.POSITIVE_INFINITY;
  polygon.forEach((start, index) => {
    closest = Math.min(closest, distanceToSegment(point, start, polygon[(index + 1) % polygon.length]));
  });
  return closest;
}

function isPointInsideSpawnArea(point, spawnObject, bounds, radius = 0) {
  if (Array.isArray(spawnObject?.polygon) && spawnObject.polygon.length >= 3) {
    const polygon = getObjectPolygonPoints(spawnObject);
    return pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius;
  }
  if (spawnObject?.ellipse && bounds.width > 0 && bounds.height > 0) {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const radiusX = Math.max(1, bounds.width / 2 - radius);
    const radiusY = Math.max(1, bounds.height / 2 - radius);
    return ((point.x - centerX) / radiusX) ** 2 + ((point.y - centerY) / radiusY) ** 2 <= 1;
  }
  return point.x >= bounds.x + radius
    && point.x <= bounds.x + bounds.width - radius
    && point.y >= bounds.y + radius
    && point.y <= bounds.y + bounds.height - radius;
}

function findSpawnAreaAnchor(spawnObject, bounds, radius = 0) {
  const center = clampPointToBounds({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, bounds, radius);
  if (isPointInsideSpawnArea(center, spawnObject, bounds, radius)) return center;
  for (let row = 0; row < 12; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      const candidate = clampPointToBounds({
        x: bounds.x + ((column + 0.5) / 12) * bounds.width,
        y: bounds.y + ((row + 0.5) / 12) * bounds.height,
      }, bounds, radius);
      if (isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)) return candidate;
    }
  }
  return center;
}

function constrainPointToSpawnArea(point, spawnObject, bounds, radius = ENEMY.radius, fallbackPoint = null) {
  const bounded = clampPointToBounds(point, bounds, radius);
  if (isPointInsideSpawnArea(bounded, spawnObject, bounds, radius)) return bounded;
  const anchor = fallbackPoint && isPointInsideSpawnArea(fallbackPoint, spawnObject, bounds, radius)
    ? fallbackPoint
    : findSpawnAreaAnchor(spawnObject, bounds, radius);
  if (!isPointInsideSpawnArea(anchor, spawnObject, bounds, radius)) return bounded;
  let insidePoint = anchor;
  let outsidePoint = bounded;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const candidate = { x: (insidePoint.x + outsidePoint.x) / 2, y: (insidePoint.y + outsidePoint.y) / 2 };
    if (isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)) insidePoint = candidate;
    else outsidePoint = candidate;
  }
  return insidePoint;
}

function getSpawnBounds(spawnObject, fallbackPosition, fallbackSize = 360) {
  if (!spawnObject) {
    return {
      x: fallbackPosition.x - fallbackSize / 2,
      y: fallbackPosition.y - fallbackSize / 2,
      width: fallbackSize,
      height: fallbackSize,
    };
  }

  if (Array.isArray(spawnObject.polygon) && spawnObject.polygon.length >= 3) {
    return getPolygonBounds(getObjectPolygonPoints(spawnObject));
  }

  return {
    x: Number(spawnObject.x ?? fallbackPosition.x - fallbackSize / 2),
    y: Number(spawnObject.y ?? fallbackPosition.y - fallbackSize / 2),
    width: Number(spawnObject.width) > 0 ? Number(spawnObject.width) : fallbackSize,
    height: Number(spawnObject.height) > 0 ? Number(spawnObject.height) : fallbackSize,
  };
}

function expandBoundsAroundCenter(bounds, minWidth, minHeight, mapId = MAP_IDS.WORLD) {
  const mapBounds = getMapPixelBounds(mapId);
  const pixelWidth = mapBounds.width;
  const pixelHeight = mapBounds.height;
  const width = Math.max(Number(bounds?.width ?? 0), minWidth);
  const height = Math.max(Number(bounds?.height ?? 0), minHeight);
  const centerX = Number(bounds?.x ?? 0) + Number(bounds?.width ?? width) / 2;
  const centerY = Number(bounds?.y ?? 0) + Number(bounds?.height ?? height) / 2;
  return {
    x: clamp(centerX - width / 2, 0, Math.max(0, pixelWidth - width)),
    y: clamp(centerY - height / 2, 0, Math.max(0, pixelHeight - height)),
    width,
    height,
  };
}

function randomPointInObject(spawnObject, fallbackPosition) {
  return randomPointInBounds(getSpawnBounds(spawnObject, fallbackPosition));
}

function pickSpawn(spawns) {
  if (!spawns.length) return null;
  return spawns[Math.floor(Math.random() * spawns.length)];
}

function numberProp(object, name, fallback) {
  const value = Number(object?.props?.[name]);
  return Number.isFinite(value) ? value : fallback;
}

const DEFAULT_ENEMY_MOVEMENT_SPEED_MULTIPLIER = 1.1;
const MAX_ENEMY_MOVEMENT_SPEED = 1200;

// Tiled enemy-spawn movementSpeed is expressed in world pixels per second.
function getSpawnMovementSpeed(spawnObject, fallbackSpeed = ENEMY.speed) {
  const rawValue = spawnObject?.props?.movementSpeed
    ?? spawnObject?.props?.moveSpeed
    ?? spawnObject?.props?.movement_speed
    ?? spawnObject?.props?.speed;
  const configuredSpeed = Number(rawValue);
  if (Number.isFinite(configuredSpeed)) return clamp(configuredSpeed, 0, MAX_ENEMY_MOVEMENT_SPEED);
  return clamp(
    safeNumber(fallbackSpeed, ENEMY.speed) * DEFAULT_ENEMY_MOVEMENT_SPEED_MULTIPLIER,
    0,
    MAX_ENEMY_MOVEMENT_SPEED,
  );
}

function getSpawnPackId(spawnObject, fallbackId = 'fallback_spawn') {
  const mapId = normalizeMapId(spawnObject?.mapId ?? spawnObject?.props?.mapId ?? MAP_IDS.WORLD);
  const baseId = String(spawnObject?.props?.spawnId ?? spawnObject?.name ?? spawnObject?.id ?? fallbackId);
  return `${mapId}:${baseId}`;
}

function getSpawnEnemyType(spawnObject) {
  const spawnName = String(spawnObject?.name ?? '').toLowerCase();
  return normalizeEnemyKind(spawnObject?.props?.enemyType ?? (spawnName.includes('desert') ? 'scarab' : 'wolf'));
}

function getSpawnRecommendedLevel(spawnObject) {
  return Math.max(0, Math.floor(numberProp(spawnObject, 'recommendedLevel', 0)));
}

function getSpawnArea(spawnObject) {
  if (Array.isArray(spawnObject?.polygon) && spawnObject.polygon.length >= 3) {
    const polygon = getObjectPolygonPoints(spawnObject);
    let twiceArea = 0;
    polygon.forEach((point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      twiceArea += point.x * next.y - next.x * point.y;
    });
    return Math.abs(twiceArea) / 2;
  }
  const width = Math.max(0, safeNumber(spawnObject?.width, 0));
  const height = Math.max(0, safeNumber(spawnObject?.height, 0));
  return width * height;
}

function isAdvancedWorldSpawn(spawnObject) {
  const mapId = normalizeMapId(spawnObject?.mapId ?? spawnObject?.props?.mapId ?? MAP_IDS.WORLD);
  return isWorldV2Map(mapId) && getSpawnRecommendedLevel(spawnObject) >= 10;
}

function isInteriorSpawn(spawnObject) {
  return Boolean(normalizeInteriorSpaceId(spawnObject?.props?.interiorId ?? spawnObject?.props?.caveId));
}

function getSpawnMaxAlive(spawnObject) {
  const configured = Math.max(1, Math.floor(numberProp(spawnObject, 'maxAlive', numberProp(spawnObject, 'maxEnemies', ENEMY.maxCount))));
  if (isInteriorSpawn(spawnObject)) return configured;
  if (!isAdvancedWorldSpawn(spawnObject)) return configured;

  const scaledByArea = Math.ceil(getSpawnArea(spawnObject) / 900000);
  const scaledConfigured = Math.ceil(configured * 1.15);
  return clamp(Math.max(configured, scaledConfigured, scaledByArea), configured, 28);
}

function getSpawnRespawnMin(spawnObject) {
  const configured = Math.max(1000, numberProp(spawnObject, 'respawnMin', numberProp(spawnObject, 'respawnTime', ENEMY.spawnEvery)));
  if (isInteriorSpawn(spawnObject)) return Math.max(12000, configured);
  return isAdvancedWorldSpawn(spawnObject) ? Math.max(7000, Math.floor(configured * 1.35)) : configured;
}

function getSpawnRespawnMax(spawnObject) {
  const min = getSpawnRespawnMin(spawnObject);
  const configured = Math.max(min, numberProp(spawnObject, 'respawnMax', min));
  if (isInteriorSpawn(spawnObject)) return Math.max(min + 3000, configured);
  return isAdvancedWorldSpawn(spawnObject) ? Math.max(min + 3000, Math.floor(configured * 1.35)) : configured;
}

function getSpawnRespawnDelay(spawnObject) {
  const min = getSpawnRespawnMin(spawnObject);
  const max = getSpawnRespawnMax(spawnObject);
  return min + Math.random() * (max - min);
}

const ENEMY_KIND_STATS = {
  wolf: { name: 'Wolf', hp: 220, radius: 17, speed: 150, xp: 45, damage: 14, attackCooldown: 820 },
  kobold: { name: 'Kobold Miner', hp: 250, radius: 17, speed: 145, xp: 50, damage: 16, attackCooldown: 820 },
  bandit: { name: 'Field Bandit', hp: 280, radius: 18, speed: 155, xp: 55, damage: 18, attackCooldown: 800 },
  undead: { name: 'Undead', hp: 300, radius: 18, speed: 135, xp: 58, damage: 19, attackCooldown: 880 },
  'restless-dead': { name: 'Restless Dead', hp: 300, radius: 18, speed: 135, xp: 58, damage: 19, attackCooldown: 880 },
  scarab: { name: 'Glass Scarab', hp: 240, radius: 16, speed: 145, xp: 48, damage: 16, attackCooldown: 840 },
  'snow-wolf': { name: 'Snow Wolf', hp: 240, radius: 17, speed: 160, xp: 48, damage: 15, attackCooldown: 800 },
  'frost-trogg': { name: 'Frost Trogg', hp: 330, radius: 19, speed: 138, xp: 62, damage: 22, attackCooldown: 900 },
  'cave-spider': { name: 'Cave Spider', hp: 260, radius: 17, speed: 170, xp: 54, damage: 18, attackCooldown: 780 },
  'grave-rat': { name: 'Grave Rat', hp: 170, radius: 15, speed: 185, xp: 42, damage: 13, attackCooldown: 720 },
  plaguehound: { name: 'Plaguehound', hp: 280, radius: 18, speed: 165, xp: 56, damage: 18, attackCooldown: 790 },
  'forest-sprite': { name: 'Forest Sprite', hp: 230, radius: 15, speed: 175, xp: 48, damage: 16, attackCooldown: 760 },
  'corrupted-treant': { name: 'Corrupted Treant', hp: 460, radius: 21, speed: 118, xp: 78, damage: 27, attackCooldown: 960 },
  nightstalker: { name: 'Nightstalker', hp: 290, radius: 17, speed: 185, xp: 62, damage: 21, attackCooldown: 750 },
  plainstrider: { name: 'Plainstrider', hp: 260, radius: 18, speed: 190, xp: 50, damage: 16, attackCooldown: 760 },
  scorpion: { name: 'Dust Scorpion', hp: 285, radius: 17, speed: 135, xp: 56, damage: 19, attackCooldown: 850 },
  quilboar: { name: 'Razor Quilboar', hp: 360, radius: 20, speed: 130, xp: 70, damage: 23, attackCooldown: 900 },
  'road-bandit': { name: 'Road Bandit', hp: 520, radius: 18, speed: 170, xp: 110, damage: 30, attackCooldown: 790 },
  'dire-wolf': { name: 'Dire Wolf', hp: 680, radius: 19, speed: 205, xp: 140, damage: 34, attackCooldown: 740 },
  'stone-gnoll': { name: 'Stone Gnoll', hp: 920, radius: 21, speed: 150, xp: 180, damage: 42, attackCooldown: 900 },
  'ember-wraith': { name: 'Ember Wraith', hp: 1050, radius: 20, speed: 165, xp: 210, damage: 48, attackCooldown: 850 },
  'cave-stalker': { name: 'Cave Stalker', hp: 1450, radius: 21, speed: 150, xp: 255, damage: 52, attackCooldown: 820 },
  'magma-crawler': { name: 'Magma Crawler', hp: 1600, radius: 22, speed: 130, xp: 285, damage: 58, attackCooldown: 930 },
  'deep-burrower': { name: 'Deep Burrower', hp: 1520, radius: 22, speed: 145, xp: 275, damage: 54, attackCooldown: 880 },
  'obsidian-sentinel': { name: 'Obsidian Sentinel', hp: 1900, radius: 25, speed: 105, xp: 330, damage: 64, attackCooldown: 980 },
  'reedwater-marauder': { name: 'Reedwater Marauder', hp: 720, radius: 19, speed: 178, xp: 110, damage: 34, attackCooldown: 800 },
  'bramblehide-bear': { name: 'Bramblehide Bear', hp: 1150, radius: 24, speed: 145, xp: 145, damage: 44, attackCooldown: 960 },
  'moonbrook-prowler': { name: 'Moonbrook Prowler', hp: 780, radius: 19, speed: 210, xp: 120, damage: 36, attackCooldown: 760 },
  'redscar-highwayman': { name: 'Redscar Highwayman', hp: 900, radius: 19, speed: 185, xp: 135, damage: 40, attackCooldown: 780 },
  'saltspine-crawler': { name: 'Saltspine Crawler', hp: 820, radius: 18, speed: 160, xp: 120, damage: 35, attackCooldown: 820 },
};

const BOSS_KIND_STATS = {
  'elder-briarheart': { name: 'Elder Briarheart', hp: 1200, radius: 42, speed: 76, xp: 260, damage: 34, attackCooldown: 1050 },
  'granite-matriarch': { name: 'Granite Matriarch', hp: 1450, radius: 44, speed: 66, xp: 290, damage: 38, attackCooldown: 1120 },
  'crypt-warden': { name: 'Crypt Warden', hp: 1380, radius: 42, speed: 70, xp: 290, damage: 38, attackCooldown: 1080 },
  'moonshade-stag': { name: 'Moonshade Stag', hp: 1300, radius: 40, speed: 92, xp: 290, damage: 36, attackCooldown: 980 },
  'bloodtusk-chief': { name: 'Bloodtusk Chief', hp: 1450, radius: 44, speed: 78, xp: 290, damage: 40, attackCooldown: 1060 },
  'varro-the-tollkeeper': { name: 'Varro the Tollkeeper', hp: 2600, radius: 38, speed: 95, xp: 360, damage: 48, attackCooldown: 980 },
  'thornmaw-alpha': { name: 'Thornmaw Alpha', hp: 3400, radius: 40, speed: 105, xp: 440, damage: 54, attackCooldown: 940 },
  'granite-ogre': { name: 'Granite Ogre', hp: 4600, radius: 46, speed: 78, xp: 540, damage: 62, attackCooldown: 1120 },
  'ash-witch': { name: 'Ash Witch', hp: 5200, radius: 38, speed: 96, xp: 620, damage: 66, attackCooldown: 980 },
  'gloomfang-matriarch': { name: 'Gloomfang Matriarch', hp: 9800, radius: 48, speed: 92, xp: 1050, damage: 68, attackCooldown: 920 },
  'lava-forged-warden': { name: 'Lava-Forged Warden', hp: 11200, radius: 52, speed: 72, xp: 1140, damage: 76, attackCooldown: 1040 },
  'crystal-horror': { name: 'Crystal Horror', hp: 10600, radius: 50, speed: 82, xp: 1100, damage: 72, attackCooldown: 980 },
  'rift-heart': { name: 'Rift Heart', hp: 24000, radius: 60, speed: 64, xp: 2200, damage: 92, attackCooldown: 1080 },
  'old-quarry-giant': { name: 'Old Quarry Giant', hp: 14000, radius: 48, speed: 70, xp: 550, damage: 72, attackCooldown: 960 },
  'tideglass-matriarch': { name: 'Tideglass Matriarch', hp: 13200, radius: 46, speed: 86, xp: 550, damage: 74, attackCooldown: 900 },
};

function getEnemyKindStats(kind) {
  return ENEMY_KIND_STATS[normalizeEnemyKind(kind)] ?? ENEMY_KIND_STATS.wolf;
}

function getBossKindStats(kind) {
  return BOSS_KIND_STATS[normalizeEnemyKind(kind)] ?? BOSS_KIND_STATS['elder-briarheart'];
}

function getDungeonHpMultiplier(dungeonScale) {
  return clamp(safeNumber(dungeonScale?.hpMultiplier, 1), DUNGEON_MIN_HP_SCALE, DUNGEON_MAX_HP_SCALE);
}

function scaleDungeonStats(stats, dungeonScale) {
  const hpMultiplier = getDungeonHpMultiplier(dungeonScale);
  return {
    ...stats,
    hp: Math.max(1, Math.round(safeNumber(stats?.hp, 1) * hpMultiplier)),
  };
}

function hashNumber(value) {
  const text = String(value ?? '0');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed, salt = 0) {
  const value = Math.sin(hashNumber(`${seed}:${salt}`) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function pointForSpawnSlot(bounds, slotIndex, maxAlive) {
  const aspect = Math.max(0.35, bounds.width / Math.max(1, bounds.height));
  const columns = Math.max(1, Math.ceil(Math.sqrt(maxAlive * aspect)));
  const rows = Math.max(1, Math.ceil(maxAlive / columns));
  const column = slotIndex % columns;
  const row = Math.floor(slotIndex / columns) % rows;
  const cellWidth = bounds.width / columns;
  const cellHeight = bounds.height / rows;
  const seed = `${bounds.x}:${bounds.y}:${slotIndex}`;
  return {
    x: bounds.x + cellWidth * (column + 0.5) + (seededUnit(seed, 1) - 0.5) * Math.max(10, cellWidth * 0.36),
    y: bounds.y + cellHeight * (row + 0.5) + (seededUnit(seed, 2) - 0.5) * Math.max(10, cellHeight * 0.36),
  };
}

function pointForDungeonPackSlot(spawnObject, bounds, slotIndex, maxAlive, radius = ENEMY.radius) {
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const packRadius = Math.max(32, numberProp(
    spawnObject,
    'packRadius',
    Math.min(86, Math.max(46, Math.min(bounds.width, bounds.height) * 0.32)),
  ));
  if (slotIndex === 0) return clampPointToBounds(center, bounds, radius);

  const ringIndex = slotIndex - 1;
  const ringCount = Math.max(1, maxAlive - 1);
  const angle = (Math.PI * 2 * ringIndex) / ringCount + seededUnit(`${bounds.x}:${bounds.y}:pack`, 5) * 0.7;
  const jitter = 0.82 + seededUnit(`${bounds.x}:${bounds.y}:${slotIndex}:pack`, 9) * 0.34;
  return clampPointToBounds({
    x: center.x + Math.cos(angle) * packRadius * jitter,
    y: center.y + Math.sin(angle) * packRadius * jitter,
  }, bounds, radius);
}

function getSpawnMovementMode(spawnObject, slotIndex = 0) {
  const configured = String(
    spawnObject?.props?.movement
    ?? spawnObject?.props?.movementMode
    ?? spawnObject?.props?.patrol
    ?? '',
  ).toLowerCase();

  if (['still', 'stationary', 'guard', 'sentinel'].includes(configured)) return 'sentinel';
  if (['pause', 'wander_pause', 'roam_pause', 'stop'].includes(configured)) return 'roam-pause';
  if (['patrol', 'path', 'loop'].includes(configured)) return 'patrol';

  if (slotIndex % 4 === 0) return 'roam-pause';
  return 'patrol';
}

function clampPointToBounds(point, bounds, radius = ENEMY.radius) {
  return {
    x: clamp(point.x, bounds.x + radius, bounds.x + bounds.width - radius),
    y: clamp(point.y, bounds.y + radius, bounds.y + bounds.height - radius),
  };
}

function buildPatrolPoints(home, bounds, slotIndex, radius = ENEMY.radius) {
  const seed = `${bounds.x}:${bounds.y}:${slotIndex}:patrol`;
  const spreadX = Math.min(Math.max(bounds.width * 0.12, 36), 170);
  const spreadY = Math.min(Math.max(bounds.height * 0.12, 36), 140);
  const direction = seededUnit(seed, 7) > 0.5 ? 1 : -1;
  const offsets = [
    { x: -spreadX, y: -spreadY * 0.25 },
    { x: spreadX * 0.7, y: -spreadY * 0.9 },
    { x: spreadX, y: spreadY * 0.45 },
    { x: -spreadX * 0.55, y: spreadY },
  ];
  return offsets.map((offset, index) => clampPointToBounds({
    x: home.x + offset.x * direction + (seededUnit(seed, index) - 0.5) * 18,
    y: home.y + offset.y + (seededUnit(seed, index + 10) - 0.5) * 18,
  }, bounds, radius));
}

function findOpenSpawnPoint(
  mapId,
  spawnObject,
  bounds,
  slotIndex,
  maxAlive,
  radius = ENEMY.radius,
  preferredPoint = null,
  collisionOptions = {},
) {
  const collisionMap = getCollisionMap(mapId);
  const basePoint = constrainPointToSpawnArea(
    preferredPoint ?? pointForSpawnSlot(bounds, slotIndex, maxAlive),
    spawnObject,
    bounds,
    radius,
  );
  if (
    isPointInsideSpawnArea(basePoint, spawnObject, bounds, radius)
    && canMoveToCollision(collisionMap, basePoint.x, basePoint.y, radius, collisionOptions)
  ) return basePoint;

  const seed = `${bounds.x}:${bounds.y}:${slotIndex}:open`;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const angle = seededUnit(seed, attempt) * Math.PI * 2;
    const spread = 18 + attempt * 8;
    const candidate = constrainPointToSpawnArea({
      x: basePoint.x + Math.cos(angle) * spread,
      y: basePoint.y + Math.sin(angle) * spread,
    }, spawnObject, bounds, radius, basePoint);
    if (
      isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)
      && canMoveToCollision(collisionMap, candidate.x, candidate.y, radius, collisionOptions)
    ) return candidate;
  }

  // Collision-heavy forests used to send every blocked slot through the same
  // top-left fallback cell. This slot-specific area search keeps them spread.
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const candidate = constrainPointToSpawnArea({
      x: bounds.x + seededUnit(seed, 1000 + attempt * 2) * bounds.width,
      y: bounds.y + seededUnit(seed, 1001 + attempt * 2) * bounds.height,
    }, spawnObject, bounds, radius, basePoint);
    if (
      isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)
      && canMoveToCollision(collisionMap, candidate.x, candidate.y, radius, collisionOptions)
    ) return candidate;
  }

  const columns = Math.max(1, Math.floor(bounds.width / Math.max(radius * 2, 24)));
  const rows = Math.max(1, Math.floor(bounds.height / Math.max(radius * 2, 24)));
  const cellCount = columns * rows;
  const startCell = Math.floor(seededUnit(seed, 4001) * cellCount);
  for (let step = 0; step < cellCount; step += 1) {
    const cellIndex = (startCell + step) % cellCount;
    const column = cellIndex % columns;
    const row = Math.floor(cellIndex / columns);
    const candidate = constrainPointToSpawnArea({
      x: bounds.x + ((column + 0.5) / columns) * bounds.width,
      y: bounds.y + ((row + 0.5) / rows) * bounds.height,
    }, spawnObject, bounds, radius, basePoint);
    if (
      isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)
      && canMoveToCollision(collisionMap, candidate.x, candidate.y, radius, collisionOptions)
    ) return candidate;
  }

  return basePoint;
}

function isSameEnemyMovementSpace(left, right) {
  if (!left || !right || left === right || String(left.id) === String(right.id)) return false;
  return normalizeInteriorSpaceId(left.interiorId) === normalizeInteriorSpaceId(right.interiorId)
    && getGameplayMapSpaceId(left.mapId ?? MAP_IDS.WORLD) === getGameplayMapSpaceId(right.mapId ?? MAP_IDS.WORLD)
    && (left.instanceId ?? null) === (right.instanceId ?? null);
}

function getEnemySeparationVector(enemy, nearbyEnemies = []) {
  const enemyRadius = Math.max(1, safeNumber(enemy?.radius, ENEMY.radius));
  const crowdRadius = Math.max(170, enemyRadius * 8.5);
  let pushX = 0;
  let pushY = 0;
  let personalStrength = 0;
  const crowd = [];

  nearbyEnemies.forEach((neighbor) => {
    if (!isSameEnemyMovementSpace(enemy, neighbor) || safeNumber(neighbor.hp, 1) <= 0 || !isFinitePoint(neighbor)) return;
    let dx = safeNumber(enemy.x) - safeNumber(neighbor.x);
    let dy = safeNumber(enemy.y) - safeNumber(neighbor.y);
    let separationDistance = Math.hypot(dx, dy);
    if (separationDistance < 0.001) {
      const enemyId = String(enemy.id ?? 'enemy');
      const neighborId = String(neighbor.id ?? 'neighbor');
      const orderedIds = [enemyId, neighborId].sort();
      const angle = seededUnit(`${orderedIds[0]}:${orderedIds[1]}:separation`, 1) * Math.PI * 2;
      const direction = enemyId === orderedIds[0] ? 1 : -1;
      dx = Math.cos(angle) * direction;
      dy = Math.sin(angle) * direction;
      separationDistance = 1;
    }

    if (separationDistance < crowdRadius) crowd.push({ dx, dy, distance: separationDistance });
    const personalDistance = Math.max(60, enemyRadius + Math.max(1, safeNumber(neighbor.radius, ENEMY.radius)) + 24);
    if (separationDistance >= personalDistance) return;
    const closeness = 1 - separationDistance / personalDistance;
    const weight = 0.8 + closeness * 1.8;
    pushX += (dx / separationDistance) * weight;
    pushY += (dy / separationDistance) * weight;
    personalStrength = Math.max(personalStrength, 0.55 + closeness * 1.05);
  });

  let crowdStrength = 0;
  if (crowd.length > 3) {
    crowdStrength = clamp((crowd.length - 3) / 3, 0, 1);
    crowd.forEach(({ dx, dy, distance: neighborDistance }) => {
      const falloff = 1 - neighborDistance / crowdRadius;
      pushX += (dx / neighborDistance) * falloff * crowdStrength;
      pushY += (dy / neighborDistance) * falloff * crowdStrength;
    });
  }

  const pushLength = Math.hypot(pushX, pushY);
  if (pushLength < 0.001) return { x: 0, y: 0, strength: 0, nearbyCount: crowd.length };
  return {
    x: pushX / pushLength,
    y: pushY / pushLength,
    strength: clamp(personalStrength + crowdStrength * 1.35, 0, 1.6),
    nearbyCount: crowd.length,
  };
}

function getMinimumDistanceFromEnemies(point, enemy, occupiedEnemies) {
  let minimumDistance = Number.POSITIVE_INFINITY;
  occupiedEnemies.forEach((neighbor) => {
    if (!isSameEnemyMovementSpace(enemy, neighbor) || safeNumber(neighbor.hp, 1) <= 0 || !isFinitePoint(neighbor)) return;
    minimumDistance = Math.min(minimumDistance, Math.hypot(point.x - neighbor.x, point.y - neighbor.y));
  });
  return minimumDistance;
}

function findDistributedSpawnPoint(
  initialPoint,
  enemy,
  occupiedEnemies,
  mapId,
  spawnObject,
  bounds,
  slotIndex,
  maxAlive,
  radius,
  collisionOptions,
) {
  if (!Array.isArray(occupiedEnemies) || occupiedEnemies.length === 0) return initialPoint;
  const spacingFromArea = Math.sqrt(Math.max(1, getSpawnArea(spawnObject)) / Math.max(1, maxAlive)) * 0.5;
  const preferredSpacing = clamp(spacingFromArea, radius * 2 + 22, 170);
  let bestPoint = initialPoint;
  let bestDistance = getMinimumDistanceFromEnemies(initialPoint, enemy, occupiedEnemies);
  if (bestDistance >= preferredSpacing) return initialPoint;

  const collisionMap = getCollisionMap(mapId);
  const seed = `${getSpawnPackId(spawnObject)}:${slotIndex}:distributed`;
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const candidate = constrainPointToSpawnArea({
      x: bounds.x + seededUnit(seed, attempt * 2 + 1) * bounds.width,
      y: bounds.y + seededUnit(seed, attempt * 2 + 2) * bounds.height,
    }, spawnObject, bounds, radius, initialPoint);
    if (
      !isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)
      || !canMoveToCollision(collisionMap, candidate.x, candidate.y, radius, collisionOptions)
    ) continue;
    const candidateDistance = getMinimumDistanceFromEnemies(candidate, enemy, occupiedEnemies);
    if (candidateDistance > bestDistance) {
      bestPoint = candidate;
      bestDistance = candidateDistance;
    }
    if (candidateDistance >= preferredSpacing) return candidate;
  }
  return bestPoint;
}

function makeEnemyMovementState(
  spawnObject,
  bounds,
  slotIndex,
  maxAlive,
  radius = ENEMY.radius,
  mapId = MAP_IDS.WORLD,
  occupiedEnemies = [],
  enemyIdentity = null,
) {
  const interiorId = normalizeInteriorSpaceId(spawnObject?.props?.interiorId ?? spawnObject?.props?.caveId);
  const collisionOptions = interiorId ? { activeInteriorId: interiorId, ignoreWorldCollision: true } : {};
  const openPoint = findOpenSpawnPoint(mapId, spawnObject, bounds, slotIndex, maxAlive, radius, null, collisionOptions);
  const home = findDistributedSpawnPoint(
    openPoint,
    {
      id: enemyIdentity ?? `spawn-slot-${slotIndex}`,
      mapId,
      interiorId,
      radius,
      spawnArea: spawnObject,
    },
    occupiedEnemies,
    mapId,
    spawnObject,
    bounds,
    slotIndex,
    maxAlive,
    radius,
    collisionOptions,
  );
  const movementMode = getSpawnMovementMode(spawnObject, slotIndex);
  const patrolPoints = movementMode === 'sentinel'
    ? [home]
    : buildPatrolPoints(home, bounds, slotIndex, radius)
      .map((point, index) => findOpenSpawnPoint(
        mapId,
        spawnObject,
        bounds,
        slotIndex + index + 1,
        maxAlive,
        radius,
        point,
        collisionOptions,
      ));
  return {
    home,
    movementMode,
    patrolPoints,
    patrolIndex: Math.floor(seededUnit(`${slotIndex}:patrol`, 3) * patrolPoints.length),
    pauseUntil: 0,
    wanderTarget: patrolPoints[0] ?? home,
    nextWanderAt: 0,
  };
}

function getReadyRespawnSlots(pack, now, occupiedSlots) {
  const readySlots = [];
  const waitingRespawns = [];
  pack.pendingRespawns.forEach((respawn) => {
    const normalizedRespawn = typeof respawn === 'number'
      ? { at: respawn, slotIndex: null }
      : respawn;
    if (normalizedRespawn.at > now) {
      waitingRespawns.push(normalizedRespawn);
      return;
    }
    if (normalizedRespawn.slotIndex != null && !occupiedSlots.has(normalizedRespawn.slotIndex)) {
      readySlots.push(normalizedRespawn.slotIndex);
      occupiedSlots.add(normalizedRespawn.slotIndex);
    } else {
      const openSlot = Array.from({ length: pack.maxAlive }).findIndex((_, index) => !occupiedSlots.has(index));
      if (openSlot >= 0) {
        readySlots.push(openSlot);
        occupiedSlots.add(openSlot);
      }
    }
  });
  pack.pendingRespawns = waitingRespawns;
  return readySlots;
}

function updateIdleEnemyMovement(enemy, now, delta, isBoss = false, nearbyEnemies = []) {
  const bounds = enemy.spawnBounds;
  if (!bounds) return enemy;

  const spawnArea = enemy.spawnArea ?? null;
  const radius = enemy.radius ?? ENEMY.radius;
  const mode = enemy.movementMode ?? 'patrol';
  let target = enemy.wanderTarget;
  let patrolIndex = enemy.patrolIndex ?? 0;
  let pauseUntil = enemy.pauseUntil ?? 0;
  let nextWanderAt = enemy.nextWanderAt ?? 0;
  const patrolPoints = enemy.patrolPoints?.length ? enemy.patrolPoints : [enemy.home ?? randomPointInBounds(bounds)];
  const separation = getEnemySeparationVector(enemy, nearbyEnemies);
  let movementPaused = false;

  if (mode === 'sentinel') {
    if (!target || now >= nextWanderAt || distance(enemy, target) < 5) {
      const home = enemy.home ?? patrolPoints[0];
      target = clampPointToBounds({
        x: home.x + (seededUnit(`${enemy.id}:${now}`, 1) - 0.5) * 34,
        y: home.y + (seededUnit(`${enemy.id}:${now}`, 2) - 0.5) * 34,
      }, bounds, radius);
      nextWanderAt = now + 3000 + Math.random() * 4000;
    }
  } else if (mode === 'roam-pause') {
    if (pauseUntil <= now && (!target || distance(enemy, target) < 10 || now >= nextWanderAt)) {
      patrolIndex = (patrolIndex + 1) % patrolPoints.length;
      target = patrolPoints[patrolIndex];
      pauseUntil = now + 900 + Math.random() * 1900;
      nextWanderAt = now + 6500 + Math.random() * 2500;
    }
    movementPaused = pauseUntil > now;
  } else if (!target || distance(enemy, target) < 10 || now >= nextWanderAt) {
    patrolIndex = (patrolIndex + 1) % patrolPoints.length;
    target = patrolPoints[patrolIndex];
    nextWanderAt = now + 9000 + Math.random() * 3000;
  }

  const toTargetX = target.x - enemy.x;
  const toTargetY = target.y - enemy.y;
  const targetLength = Math.hypot(toTargetX, toTargetY);
  let steeringX = movementPaused || targetLength < 0.001 ? 0 : toTargetX / targetLength;
  let steeringY = movementPaused || targetLength < 0.001 ? 0 : toTargetY / targetLength;
  if (separation.strength > 0) {
    const separationWeight = movementPaused ? 1.35 : 1.1;
    steeringX += separation.x * separation.strength * separationWeight;
    steeringY += separation.y * separation.strength * separationWeight;
  }
  const steeringLength = Math.hypot(steeringX, steeringY);
  if (steeringLength < 0.001) {
    return { ...enemy, wanderTarget: target, patrolIndex, pauseUntil, nextWanderAt };
  }
  const speedMultiplier = mode === 'sentinel' ? 0.24 : mode === 'roam-pause' ? 0.52 : 0.78;
  const baseMovementSpeed = Math.max(0, safeNumber(enemy.speed, ENEMY.speed));
  const wanderSpeed = baseMovementSpeed
    * (isBoss ? 0.65 : 1)
    * speedMultiplier
    * (movementPaused ? 0.55 : 1);
  const movement = moveEnemyWithCollision(
    enemy,
    enemy.x + (steeringX / steeringLength) * wanderSpeed * delta,
    enemy.y + (steeringY / steeringLength) * wanderSpeed * delta,
    bounds,
  );
  const nextPosition = constrainPointToSpawnArea(movement, spawnArea, bounds, radius, enemy.home);
  const constrainedBySpawnArea = Math.abs(nextPosition.x - movement.x) > 0.01 || Math.abs(nextPosition.y - movement.y) > 0.01;

  return {
    ...enemy,
    wanderTarget: target,
    patrolIndex,
    pauseUntil,
    nextWanderAt: movement.blocked || constrainedBySpawnArea ? Math.min(nextWanderAt, now + 600) : nextWanderAt,
    x: nextPosition.x,
    y: nextPosition.y,
  };
}

function createWorldSpawnPacks(spawns) {
  const sourceSpawns = Array.isArray(spawns) ? spawns : [];

  return new Map(sourceSpawns.map((spawn, index) => {
    const id = getSpawnPackId(spawn, `fallback_spawn_${index}`);
    return [id, {
      id,
      spawn,
      maxAlive: getSpawnMaxAlive(spawn),
      pendingRespawns: [],
    }];
  }));
}

function createBossSpawnPacks(spawns) {
  return new Map((spawns ?? []).map((spawn, index) => {
    const id = getSpawnPackId(spawn, `fallback_boss_${index}`);
    return [id, {
      id,
      spawn,
      pendingRespawnAt: 0,
    }];
  }));
}

function nextBossDelay() {
  return BOSS_SPAWN_MIN + Math.random() * (BOSS_SPAWN_MAX - BOSS_SPAWN_MIN);
}

function createEnemy(
  id,
  spawnObject,
  fallbackPosition,
  spawnSlot = 0,
  maxAlive = getSpawnMaxAlive(spawnObject),
  occupiedEnemies = [],
) {
  const mapId = normalizeMapId(spawnObject?.mapId ?? spawnObject?.props?.mapId ?? fallbackPosition?.mapId ?? MAP_IDS.WORLD);
  const interiorId = normalizeInteriorSpaceId(spawnObject?.props?.interiorId ?? spawnObject?.props?.caveId);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition);
  const enemyKind = getSpawnEnemyType(spawnObject);
  const stats = getEnemyKindStats(enemyKind);
  const movement = makeEnemyMovementState(
    spawnObject,
    spawnBounds,
    spawnSlot,
    maxAlive,
    stats.radius,
    mapId,
    occupiedEnemies,
    id,
  );
  const spawnPoint = movement.home;
  const mapBounds = getMapPixelBounds(mapId);

  return {
    id: String(id),
    type: 'enemy',
    enemyKind,
    spriteId: enemyKind,
    mapId,
    instanceId: null,
    interiorId,
    name: stats.name,
    spawnName: spawnObject?.name,
    spawnId: getSpawnPackId(spawnObject),
    spawnSlot,
    spawnBounds,
    spawnArea: spawnObject,
    ...movement,
    x: clamp(spawnPoint.x, stats.radius, mapBounds.width - stats.radius),
    y: clamp(spawnPoint.y, stats.radius, mapBounds.height - stats.radius),
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: getSpawnMovementSpeed(spawnObject, stats.speed),
    xp: stats.xp,
    damage: stats.damage,
    attackCooldown: stats.attackCooldown,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createBoss(id, spawnObject, fallbackPosition) {
  const mapId = normalizeMapId(spawnObject?.mapId ?? spawnObject?.props?.mapId ?? fallbackPosition?.mapId ?? MAP_IDS.WORLD);
  const interiorId = normalizeInteriorSpaceId(spawnObject?.props?.interiorId ?? spawnObject?.props?.caveId);
  const bossType = normalizeEnemyKind(
    spawnObject?.props?.bossType
      ?? spawnObject?.props?.enemyType
      ?? spawnObject?.name
      ?? 'elder-briarheart',
  );
  const stats = getBossKindStats(bossType);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition, 620);
  const spawnPoint = findOpenSpawnPoint(mapId, spawnObject, spawnBounds, 0, 1, stats.radius);
  const mapBounds = getMapPixelBounds(mapId);

  return {
    id: String(id),
    type: 'boss',
    mapId,
    instanceId: null,
    interiorId,
    bossType,
    questKind: spawnObject?.props?.enemyType ? normalizeEnemyKind(spawnObject.props.enemyType) : bossType,
    spriteId: bossType,
    name: spawnObject?.props?.displayName ?? stats.name,
    spawnName: spawnObject?.name,
    spawnId: getSpawnPackId(spawnObject),
    spawnSlot: 0,
    spawnBounds,
    spawnPoint,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: 0,
    x: clamp(spawnPoint.x, stats.radius, mapBounds.width - stats.radius),
    y: clamp(spawnPoint.y, stats.radius, mapBounds.height - stats.radius),
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: getSpawnMovementSpeed(spawnObject, stats.speed),
    xp: stats.xp,
    damage: stats.damage,
    attackCooldown: stats.attackCooldown,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createDungeonEnemy(id, spawnObject, instanceId, index, dungeonScale = null) {
  const enemyKind = getSpawnEnemyType(spawnObject);
  const baseStats = getEnemyKindStats(enemyKind);
  const stats = scaleDungeonStats(baseStats, dungeonScale);
  const fallbackPosition = {
    x: Number(spawnObject?.x ?? 640) + Number(spawnObject?.width ?? 260) / 2,
    y: Number(spawnObject?.y ?? 360) + Number(spawnObject?.height ?? 180) / 2,
  };
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition, 260);
  const packPoint = pointForDungeonPackSlot(spawnObject, spawnBounds, index, DUNGEON_PACK_SIZE, stats.radius);
  const spawnPoint = findOpenSpawnPoint(
    MAP_IDS.DUNGEON_01,
    spawnObject,
    spawnBounds,
    index,
    DUNGEON_PACK_SIZE,
    stats.radius,
    packPoint,
  );
  const dungeonBounds = getMapPixelBounds(MAP_IDS.DUNGEON_01);

  return {
    id: `dungeon-${instanceId}-${id}`,
    type: 'dungeon_enemy',
    enemyKind,
    spriteId: enemyKind,
    mapId: MAP_IDS.DUNGEON_01,
    instanceId,
    name: stats.name,
    packIndex: index,
    spawnName: spawnObject?.name,
    spawnBounds,
    home: spawnPoint,
    movementMode: 'sentinel',
    patrolPoints: [spawnPoint],
    patrolIndex: 0,
    pauseUntil: 0,
    wanderTarget: spawnPoint,
    nextWanderAt: 0,
    x: clamp(spawnPoint.x, stats.radius, dungeonBounds.width - stats.radius),
    y: clamp(spawnPoint.y, stats.radius, dungeonBounds.height - stats.radius),
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    baseMaxHp: baseStats.hp,
    dungeonHpMultiplier: getDungeonHpMultiplier(dungeonScale),
    speed: getSpawnMovementSpeed(spawnObject, stats.speed),
    xp: stats.xp,
    damage: stats.damage,
    attackCooldown: stats.attackCooldown,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createDungeonMiniboss(id, spawnObject, instanceId, dungeonScale = null) {
  const bossType = normalizeEnemyKind(spawnObject?.props?.bossType ?? spawnObject?.props?.enemyType ?? spawnObject?.name ?? 'gloomfang-matriarch');
  const baseStats = getBossKindStats(bossType);
  const stats = scaleDungeonStats(baseStats, dungeonScale);
  const requestedSpawnPoint = {
    x: Number(spawnObject?.x ?? 1450) + Number(spawnObject?.width ?? 0) / 2,
    y: Number(spawnObject?.y ?? 700) + Number(spawnObject?.height ?? 0) / 2,
  };
  const spawnBounds = getSpawnBounds(spawnObject, requestedSpawnPoint, 420);
  const spawnPoint = findOpenSpawnPoint(
    MAP_IDS.DUNGEON_01,
    spawnObject,
    spawnBounds,
    0,
    1,
    stats.radius,
    requestedSpawnPoint,
  );

  return {
    id: `dungeon-${instanceId}-${id}`,
    type: 'dungeon_miniboss',
    mapId: MAP_IDS.DUNGEON_01,
    instanceId,
    bossType,
    questKind: spawnObject?.props?.enemyType ? normalizeEnemyKind(spawnObject.props.enemyType) : bossType,
    spriteId: bossType,
    name: stats.name,
    spawnName: spawnObject?.name,
    spawnBounds,
    spawnPoint,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: 0,
    nextAoEAt: Date.now() + 2200,
    nextLaserAt: Date.now() + 4200,
    x: spawnPoint.x,
    y: spawnPoint.y,
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    baseMaxHp: baseStats.hp,
    dungeonHpMultiplier: getDungeonHpMultiplier(dungeonScale),
    speed: getSpawnMovementSpeed(spawnObject, stats.speed),
    xp: stats.xp,
    damage: stats.damage,
    attackCooldown: stats.attackCooldown,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createDungeonFinalBoss(id, spawnObject, instanceId, dungeonScale = null) {
  const bossType = normalizeEnemyKind(spawnObject?.props?.bossType ?? spawnObject?.props?.enemyType ?? spawnObject?.name ?? 'rift-heart');
  const baseStats = getBossKindStats(bossType);
  const stats = scaleDungeonStats(baseStats, dungeonScale);
  const requestedSpawnPoint = {
    x: Number(spawnObject?.x ?? 96) + Number(spawnObject?.width ?? 0) / 2,
    y: Number(spawnObject?.y ?? 590) + Number(spawnObject?.height ?? 0) / 2,
  };
  const spawnBounds = getSpawnBounds(spawnObject, requestedSpawnPoint, 460);
  const spawnPoint = findOpenSpawnPoint(
    MAP_IDS.DUNGEON_01,
    spawnObject,
    spawnBounds,
    0,
    1,
    stats.radius,
    requestedSpawnPoint,
  );

  return {
    id: `dungeon-${instanceId}-${id}`,
    type: 'dungeon_final_boss',
    mapId: MAP_IDS.DUNGEON_01,
    instanceId,
    bossType,
    questKind: spawnObject?.props?.enemyType ? normalizeEnemyKind(spawnObject.props.enemyType) : bossType,
    spriteId: bossType,
    name: stats.name,
    spawnName: spawnObject?.name,
    spawnBounds,
    spawnPoint,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: 0,
    nextAoEAt: Date.now() + 3200,
    nextLaserAt: Date.now() + 5200,
    nextRingAt: Date.now() + 8400,
    x: spawnPoint.x,
    y: spawnPoint.y,
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    baseMaxHp: baseStats.hp,
    dungeonHpMultiplier: getDungeonHpMultiplier(dungeonScale),
    speed: getSpawnMovementSpeed(spawnObject, stats.speed),
    xp: stats.xp,
    damage: stats.damage,
    attackCooldown: stats.attackCooldown,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function abilityHitsEnemy(ability, origin, facing, enemy) {
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const hitRadius = (enemy.radius ?? ENEMY.radius) + 7;
  const range = Math.max(
    20,
    safeNumber(
      ability.range,
      ability.type === 'shot' ? 560
        : ability.type === 'bolt' || ability.type === 'channel' ? 520
          : ability.type === 'strike' ? 112
            : 118,
    ),
  );
  const width = Math.max(
    0,
    safeNumber(
      ability.width,
      ability.type === 'shot' ? 26
        : ability.type === 'channel' ? 12
          : ability.type === 'strike' ? 44
            : 18,
    ),
  );

  if (ability.type === 'bolt') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * range, y: origin.y + fy * range }) < hitRadius + width;
  }
  if (ability.type === 'shot') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * range, y: origin.y + fy * range }) < hitRadius + width;
  }
  if (ability.type === 'chain') {
    return distance(enemy, origin) < range + hitRadius;
  }
  if (ability.type === 'aura') {
    return distance(enemy, origin) < (ability.radius ?? 112) + hitRadius;
  }
  if (ability.type === 'nova') {
    return distance(enemy, origin) < (ability.radius ?? 118) + hitRadius;
  }
  if (ability.type === 'ground') {
    return distance(enemy, origin) < (ability.radius ?? 110) + hitRadius;
  }
  if (ability.type === 'trap') {
    const trapOffset = Math.max(0, safeNumber(ability.trapOffset, 95));
    return distance(enemy, { x: origin.x + fx * trapOffset, y: origin.y + fy * trapOffset }) < (ability.radius ?? 58) + hitRadius;
  }
  if (ability.type === 'strike') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * range, y: origin.y + fy * range }) < width + hitRadius;
  }
  if (ability.type === 'cleave') {
    const enemyAngle = Math.atan2(enemy.y - origin.y, enemy.x - origin.x);
    return distance(enemy, origin) < range + hitRadius && Math.abs(angleDifference(enemyAngle, facing)) < (ability.arc ?? 1.05);
  }
  if (ability.type === 'channel') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * range, y: origin.y + fy * range }) < hitRadius + width;
  }

  return distance(enemy, origin) < (ability.radius ?? range) + hitRadius;
}

function selectChainTargets(enemiesToCheck, ability, origin, facing, casterId = null) {
  const maxTargets = Math.max(1, ability.maxTargets ?? 5);
  const chainRange = ability.chainRange ?? 190;
  const combatIds = [casterId, ability.casterId]
    .filter((id) => id != null)
    .map((id) => String(id));
  const isCombatEligible = (enemy) => {
    if (!ability.combatOnly) return true;
    if (!enemy) return false;
    if (combatIds.length > 0) {
      if (enemy.targetPlayerId != null && combatIds.includes(String(enemy.targetPlayerId))) return true;
      if (enemy.firstHitPlayerId != null && combatIds.includes(String(enemy.firstHitPlayerId))) return true;
    }
    return enemy.state === 'aggro' && enemy.targetPlayerId == null && enemy.firstHitPlayerId == null;
  };

  let eligibleEnemies = enemiesToCheck.filter(isCombatEligible);
  let firstTarget = eligibleEnemies
    .filter((enemy) => abilityHitsEnemy(ability, origin, facing, enemy))
    .sort((a, b) => distance(a, origin) - distance(b, origin))[0];

  if (!firstTarget && ability.combatOnly) {
    eligibleEnemies = enemiesToCheck.filter((enemy) => enemy && enemy.hp > 0);
    firstTarget = eligibleEnemies
      .filter((enemy) => abilityHitsEnemy(ability, origin, facing, enemy))
      .sort((a, b) => distance(a, origin) - distance(b, origin))[0];
  }

  if (!firstTarget) return new Set();

  const selected = [firstTarget];
  while (selected.length < maxTargets) {
    const previous = selected[selected.length - 1];
    const nextTarget = eligibleEnemies
      .filter((enemy) => !selected.some((target) => target.id === enemy.id))
      .filter((enemy) => distance(enemy, previous) < chainRange + (enemy.radius ?? ENEMY.radius))
      .sort((a, b) => distance(a, previous) - distance(b, previous))[0];
    if (!nextTarget) break;
    selected.push(nextTarget);
  }

  return new Set(selected.map((enemy) => enemy.id));
}

function sanitizeBroadcastPlayer(player) {
  if (!player?.id || !isFinitePoint(player)) return null;
  const maxHp = Math.max(1, safeNumber(player.maxHp, 100));
  return {
    id: String(player.id),
    name: player.name ?? 'Adventurer',
    classId: player.classId ?? 'warrior',
    raceId: player.raceId ?? 'human',
    appearance: player.appearance ?? {},
    talents: player.talents ?? { spec: null },
    level: Math.max(1, Math.floor(safeNumber(player.level, 1))),
    x: safeNumber(player.x),
    y: safeNumber(player.y),
    vx: safeNumber(player.vx, 0),
    vy: safeNumber(player.vy, 0),
    facing: safeNumber(player.facing, 0),
    hp: clamp(player.hp ?? maxHp, 0, maxHp),
        maxHp,
        mapId: normalizeMapId(player.mapId),
        instanceId: player.instanceId ?? null,
        interiorId: normalizeInteriorSpaceId(player.interiorId),
        partyId: player.partyId ?? null,
    partyLeaderId: player.partyLeaderId ?? null,
    pet: player.pet && isFinitePoint(player.pet) ? {
      x: safeNumber(player.pet.x),
      y: safeNumber(player.pet.y),
      vx: safeNumber(player.pet.vx, 0),
      vy: safeNumber(player.pet.vy, 0),
      facing: safeNumber(player.pet.facing, player.facing ?? 0),
      walk: safeNumber(player.pet.walk, 0),
      moving: Boolean(player.pet.moving),
      attackStartedAt: safeNumber(player.pet.attackStartedAt, 0),
      attackUntil: safeNumber(player.pet.attackUntil, 0),
    } : null,
  };
}

function sanitizeBroadcastEnemy(enemy) {
  if (!enemy?.id || !isFinitePoint(enemy)) return null;
  const isBoss = enemy.type === 'boss' || enemy.type === 'dungeon_miniboss' || enemy.type === 'dungeon_final_boss';
  const maxHp = Math.max(1, safeNumber(enemy.maxHp, isBoss ? 620 : 100));
  return {
    ...enemy,
    id: String(enemy.id),
    x: safeNumber(enemy.x),
    y: safeNumber(enemy.y),
    targetX: isFinitePoint({ x: enemy.targetX, y: enemy.targetY }) ? safeNumber(enemy.targetX) : safeNumber(enemy.x),
    targetY: isFinitePoint({ x: enemy.targetX, y: enemy.targetY }) ? safeNumber(enemy.targetY) : safeNumber(enemy.y),
    radius: clamp(enemy.radius ?? ENEMY.radius, 6, 180),
    hp: clamp(enemy.hp ?? maxHp, 0, maxHp),
    maxHp,
    speed: safeNumber(enemy.speed, ENEMY.speed),
    xp: safeNumber(enemy.xp, isBoss ? BOSS_XP : ENEMY_XP),
    damage: Math.max(1, safeNumber(enemy.damage, isBoss ? 28 : 9)),
    attackCooldown: clamp(enemy.attackCooldown ?? (isBoss ? 1100 : 850), 250, 5000),
    facing: safeNumber(enemy.facing, 0),
    hitAt: safeNumber(enemy.hitAt, 0),
    wobble: safeNumber(enemy.wobble, 0),
    mapId: normalizeMapId(enemy.mapId),
    interiorId: normalizeInteriorSpaceId(enemy.interiorId),
    enemyKind: enemy.enemyKind ? normalizeEnemyKind(enemy.enemyKind) : undefined,
    bossType: enemy.bossType ? normalizeEnemyKind(enemy.bossType) : undefined,
    questKind: enemy.questKind ? normalizeEnemyKind(enemy.questKind) : undefined,
    spriteId: enemy.spriteId ? normalizeEnemyKind(enemy.spriteId) : undefined,
  };
}

function enemyKillInfo(enemy) {
  const enemyKind = normalizeEnemyKind(enemy?.enemyKind ?? enemy?.bossType ?? enemy?.spriteId ?? enemy?.type);
  return {
    id: String(enemy?.id ?? ''),
    type: enemy?.type ?? 'enemy',
    enemyKind,
    bossType: enemy?.bossType ? normalizeEnemyKind(enemy.bossType) : undefined,
    questKind: enemy?.questKind ? normalizeEnemyKind(enemy.questKind) : undefined,
    spawnName: enemy?.spawnName,
    spawnId: enemy?.spawnId,
    name: enemy?.name ?? enemyKind,
  };
}

function abilityHealsPlayer(ability, origin, facing, player) {
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);

  if (ability.type === 'nova') {
    return distance(player, origin) < 150;
  }

  if (ability.type === 'heal') {
    const lineEnd = { x: origin.x + fx * 260, y: origin.y + fy * 260 };
    return distanceToSegment(player, origin, lineEnd) < 54 || distance(player, origin) < 92;
  }
  if (ability.type === 'healGround') {
    return distance(player, origin) < (ability.radius ?? 118) + PLAYER.radius;
  }
  if (ability.type === 'hot') {
    return distance(player, origin) < 220;
  }

  return distance(player, origin) < 120;
}

function sameParty(a, b) {
  return Boolean(a?.partyId && b?.partyId && a.partyId === b.partyId);
}

function isEnemyImpaired(enemy, now) {
  return now < (enemy?.coldUntil ?? 0)
    || now < (enemy?.slowUntil ?? 0)
    || now < (enemy?.frozenUntil ?? 0)
    || now < (enemy?.stunnedUntil ?? 0);
}

function getEnemyMovementMultiplier(enemy, now) {
  if (now < (enemy?.frozenUntil ?? 0) || now < (enemy?.stunnedUntil ?? 0)) return 0;
  let multiplier = 1;
  if (now < (enemy?.coldUntil ?? 0)) multiplier = Math.min(multiplier, enemy.coldMultiplier ?? 0.55);
  if (now < (enemy?.slowUntil ?? 0)) multiplier = Math.min(multiplier, enemy.slowMultiplier ?? 0.45);
  return clamp(multiplier, 0, 1);
}

function getAbilityDamageAgainstEnemy(ability, baseDamage, enemy, now) {
  let damage = safeNumber(baseDamage, 0);
  const multiStrike = Math.max(1, safeNumber(ability?.multiStrike, 1));
  if (multiStrike > 1) damage *= multiStrike;
  if ((ability?.bonusVsControlledMultiplier ?? 0) > 0 && isEnemyImpaired(enemy, now)) {
    damage *= ability.bonusVsControlledMultiplier;
  }
  if (now < (enemy?.damageTakenUntil ?? 0)) {
    damage *= enemy.damageTakenMultiplier ?? 1;
  }
  return Math.max(0, Math.ceil(damage));
}

function applyAbilityDebuffs(enemy, ability, sourcePlayerId, now) {
  let nextEnemy = { ...enemy };

  if (ability.applyPoison) {
    const previous = nextEnemy.poisonDebuff ?? {};
    const stacks = clamp(safeNumber(previous.stacks, 0) + 1, 1, 30);
    const tickRate = Math.max(200, safeNumber(ability.poisonTickRate, 1000));
    nextEnemy.poisonDebuff = {
      sourcePlayerId,
      stacks,
      damage: Math.max(1, safeNumber(ability.poisonDamage, 9)),
      tickRate,
      nextTickAt: now + tickRate,
      expiresAt: now + Math.max(500, safeNumber(ability.poisonDuration, 5000)),
    };
  }

  if (ability.burnDamage) {
    const previous = nextEnemy.burnDebuff ?? {};
    const stacks = ability.burnStacking
      ? clamp(safeNumber(previous.stacks, 0) + 1, 1, 30)
      : 1;
    const tickRate = Math.max(200, safeNumber(ability.burnTickRate, 1000));
    nextEnemy.burnDebuff = {
      sourcePlayerId,
      stacks,
      damage: Math.max(1, safeNumber(ability.burnDamage, 8)),
      tickRate,
      nextTickAt: now + tickRate,
      expiresAt: now + Math.max(500, safeNumber(ability.burnDuration, 4000)),
    };
  }

  if (ability.bleedDamage) {
    const previous = nextEnemy.bleedDebuff ?? {};
    const stacks = clamp(safeNumber(previous.stacks, 0) + 1, 1, 30);
    const tickRate = Math.max(200, safeNumber(ability.bleedTickRate, 1000));
    nextEnemy.bleedDebuff = {
      sourcePlayerId,
      stacks,
      damage: Math.max(1, safeNumber(ability.bleedDamage, 16)),
      tickRate,
      nextTickAt: now + tickRate,
      expiresAt: ability.bleedDuration ? now + Math.max(500, safeNumber(ability.bleedDuration, 6000)) : null,
    };
  }

  if (ability.applyCold) {
    nextEnemy.coldUntil = now + Math.max(500, safeNumber(ability.coldDuration, 3000));
    nextEnemy.coldMultiplier = clamp(safeNumber(ability.coldMultiplier, 0.55), 0.05, 1);
  }

  if (ability.slowDuration) {
    nextEnemy.slowUntil = now + Math.max(500, safeNumber(ability.slowDuration, 2500));
    nextEnemy.slowMultiplier = clamp(safeNumber(ability.slowMultiplier, 0.45), 0.05, 1);
  }

  if (ability.freezeDuration) {
    const isBoss = nextEnemy.type === 'boss' || nextEnemy.type === 'dungeon_miniboss' || nextEnemy.type === 'dungeon_final_boss';
    if (!isBoss) {
      nextEnemy.frozenUntil = now + Math.max(250, safeNumber(ability.freezeDuration, 1800));
    }
  }

  if (ability.stunDuration) {
    nextEnemy.stunnedUntil = now + Math.max(250, safeNumber(ability.stunDuration, 1000));
  }

  if (ability.damageTakenMultiplier) {
    nextEnemy.damageTakenMultiplier = Math.max(1, safeNumber(ability.damageTakenMultiplier, 1.15));
    nextEnemy.damageTakenUntil = now + Math.max(500, safeNumber(ability.damageTakenDuration, 5000));
  }

  return nextEnemy;
}

function tickEnemyDebuffs(enemy, now) {
  let nextEnemy = { ...enemy };
  let damage = 0;
  let sourcePlayerId = null;

  const tickOne = (debuff) => {
    if (!debuff) return null;
    const tickRate = Math.max(200, safeNumber(debuff.tickRate, 1000));
    let nextTickAt = safeNumber(debuff.nextTickAt, now + tickRate);
    let ticks = 0;

    while (now >= nextTickAt && ticks < 8) {
      damage += Math.max(1, safeNumber(debuff.damage, 1)) * Math.max(1, safeNumber(debuff.stacks, 1));
      nextTickAt += tickRate;
      ticks += 1;
    }

    if (sourcePlayerId == null && debuff.sourcePlayerId != null) {
      sourcePlayerId = String(debuff.sourcePlayerId);
    }

    return { ...debuff, nextTickAt };
  };

  if (nextEnemy.poisonDebuff) {
    if (now >= safeNumber(nextEnemy.poisonDebuff.expiresAt, 0)) {
      delete nextEnemy.poisonDebuff;
    } else {
      nextEnemy.poisonDebuff = tickOne(nextEnemy.poisonDebuff);
    }
  }

  if (nextEnemy.bleedDebuff) {
    if (nextEnemy.bleedDebuff.expiresAt && now >= safeNumber(nextEnemy.bleedDebuff.expiresAt, 0)) {
      delete nextEnemy.bleedDebuff;
    } else {
      nextEnemy.bleedDebuff = tickOne(nextEnemy.bleedDebuff);
    }
  }

  if (nextEnemy.burnDebuff) {
    if (now >= safeNumber(nextEnemy.burnDebuff.expiresAt, 0)) {
      delete nextEnemy.burnDebuff;
    } else {
      nextEnemy.burnDebuff = tickOne(nextEnemy.burnDebuff);
    }
  }

  if (damage > 0) {
    nextEnemy.hp -= damage;
    nextEnemy.hitAt = now;
    nextEnemy.state = 'aggro';
    nextEnemy.firstHitPlayerId = nextEnemy.firstHitPlayerId ?? sourcePlayerId;
  }

  return { enemy: nextEnemy, damage, sourcePlayerId };
}

function getEnemyHomePoint(enemy) {
  if (isFinitePoint(enemy?.home)) {
    return {
      x: safeNumber(enemy.home.x),
      y: safeNumber(enemy.home.y),
    };
  }

  if (isFinitePoint(enemy?.spawnPoint)) {
    return {
      x: safeNumber(enemy.spawnPoint.x),
      y: safeNumber(enemy.spawnPoint.y),
    };
  }

  const patrolHome = Array.isArray(enemy?.patrolPoints)
    ? enemy.patrolPoints.find((point) => isFinitePoint(point))
    : null;
  if (patrolHome) {
    return {
      x: safeNumber(patrolHome.x),
      y: safeNumber(patrolHome.y),
    };
  }

  if (enemy?.spawnBounds) {
    const radius = enemy.radius ?? ENEMY.radius;
    return clampPointToBounds({
      x: safeNumber(enemy.spawnBounds.x) + safeNumber(enemy.spawnBounds.width, radius * 2) / 2,
      y: safeNumber(enemy.spawnBounds.y) + safeNumber(enemy.spawnBounds.height, radius * 2) / 2,
    }, enemy.spawnBounds, radius);
  }

  return safePoint(enemy);
}

function getEnemyLeashDistance(enemy) {
  if (enemy?.type === 'dungeon_final_boss') return DUNGEON_FINAL_BOSS_LEASH_DISTANCE;
  if (enemy?.type === 'boss' || enemy?.type === 'dungeon_miniboss') return BOSS_LEASH_DISTANCE;
  return ENEMY_LEASH_DISTANCE;
}

function clearEnemyCombatEffects(enemy) {
  const nextEnemy = { ...enemy };
  [
    'poisonDebuff',
    'burnDebuff',
    'bleedDebuff',
    'coldUntil',
    'coldMultiplier',
    'slowUntil',
    'slowMultiplier',
    'frozenUntil',
    'stunnedUntil',
    'damageTakenMultiplier',
    'damageTakenUntil',
  ].forEach((key) => {
    delete nextEnemy[key];
  });
  return nextEnemy;
}

function resetEnemyAggro(enemy, now = Date.now()) {
  const home = getEnemyHomePoint(enemy);
  const maxHp = Math.max(1, safeNumber(enemy.maxHp, enemy.hp ?? 1));
  return {
    ...clearEnemyCombatEffects(enemy),
    state: 'idle',
    targetPlayerId: null,
    firstHitPlayerId: null,
    leashStartedAt: null,
    aggroStartedAt: null,
    aggroDisabledUntil: now + ENEMY_AGGRO_RESET_COOLDOWN_MS,
    nextAttackAt: now + clamp(enemy.attackCooldown ?? 850, 250, 5000),
    attackStartedAt: 0,
    attackType: null,
    attackLaunchAt: 0,
    attackImpactAt: 0,
    attackUntil: 0,
    attackResolved: true,
    nextMechanicAt: null,
    nextSecondaryMechanicAt: null,
    mechanicType: null,
    mechanicStartedAt: 0,
    mechanicLaunchAt: 0,
    mechanicImpactAt: 0,
    mechanicUntil: 0,
    mechanicRadius: 0,
    mechanicProjectiles: [],
    mechanicHitPlayerIds: [],
    mechanicResolved: true,
    hp: maxHp,
    x: home.x,
    y: home.y,
    home,
    targetX: home.x,
    targetY: home.y,
    wanderTarget: home,
    pauseUntil: now + 500,
    nextWanderAt: now + 1400,
  };
}

class WorldRoom extends Room {
  maxClients = 40;

  onCreate() {
    this.autoDispose = false;
    this.patchRate = null;
    this.players = new Map();
    this.pendingInvites = new Map();
    this.partyInviteCooldowns = new Map();
    this.nextPartyId = 1;
    this.enemies = [];
    this.hazards = [];
    this.dungeonInstances = new Map();
    this.nextEnemyId = 1;
    this.nextSpawnAt = Date.now() + 800;
    this.nextBossSpawnAt = Date.now() + nextBossDelay();
    this.spawnDataSignature = getSpawnDataSignature();
    this.spawnData = loadTiledSpawns();
    this.worldSpawnPacks = createWorldSpawnPacks(this.spawnData.enemySpawns);
    this.bossSpawnPacks = createBossSpawnPacks(this.spawnData.bossSpawns);
    this.worldControls = {
      time: {
        forcedPhase: null,
        speedMultiplier: 1,
      },
      weather: {
        forcedWeather: null,
        speedMultiplier: 1,
      },
    };

    this.onMessage('joinGame', (client, message) => {
      const character = message?.character ?? {};
      const authEmail = getMessageEmail(message);
      const requestedMapId = normalizeMapId(message?.mapId);
      const requestedMapBounds = getMapPixelBounds(requestedMapId);
      this.disconnectExistingAccountSession(authEmail, client.sessionId);
      this.players.set(client.sessionId, {
        id: client.sessionId,
        email: authEmail,
        isAdmin: isAdminEmail(authEmail),
        name: character.name ?? 'Adventurer',
        classId: character.classId ?? 'warrior',
        raceId: character.raceId ?? 'human',
        appearance: character.appearance ?? {},
        talents: character.talents ?? { spec: null },
        level: character.level ?? 1,
        x: clamp(message?.x ?? 420, PLAYER.radius, requestedMapBounds.width - PLAYER.radius),
        y: clamp(message?.y ?? 420, PLAYER.radius, requestedMapBounds.height - PLAYER.radius),
        facing: safeNumber(message?.facing, 0),
        hp: clamp(message?.hp ?? message?.maxHp ?? 100, 0, Math.max(1, safeNumber(message?.maxHp, 100))),
        maxHp: Math.max(1, safeNumber(message?.maxHp, 100)),
        mapId: requestedMapId,
        interiorId: normalizeInteriorSpaceId(message?.interiorId),
        instanceId: null,
        overrideInstanceId: null,
        partyId: null,
        partyLeaderId: null,
        updatedAt: Date.now(),
      });
      const joinedPlayer = this.players.get(client.sessionId);
      this.updatePlayerInstance(joinedPlayer);
      if (isWorldLikeMap(joinedPlayer?.mapId)) {
        const now = Date.now();
        this.updateWorldSpawnPacks(now, joinedPlayer);
        this.updateWorldBossSpawns(now, joinedPlayer);
      }
      this.sendWorldControls(client);
    });

    this.onMessage('adminSetWorldTime', (client, message) => {
      const player = this.players.get(client.sessionId);
      if (!this.isAuthorizedAdminRequest(player, message)) {
        client.send('adminResult', {
          ok: false,
          action: 'worldTime',
          error: 'Not authorized',
        });
        return;
      }

      const forcedPhase = normalizeWorldControlPhase(message?.phase, WORLD_TIME_PHASES);
      if (forcedPhase === undefined) {
        client.send('adminResult', {
          ok: false,
          action: 'worldTime',
          error: 'Invalid world time phase',
        });
        return;
      }

      this.worldControls.time.forcedPhase = forcedPhase;
      this.broadcastWorldControls();
      client.send('adminResult', {
        ok: true,
        action: 'worldTime',
        phase: forcedPhase ?? 'auto',
      });
    });

    this.onMessage('adminSetWorldTimeSpeed', (client, message) => {
      const player = this.players.get(client.sessionId);
      if (!this.isAuthorizedAdminRequest(player, message)) {
        client.send('adminResult', {
          ok: false,
          action: 'worldTimeSpeed',
          error: 'Not authorized',
        });
        return;
      }

      const speedMultiplier = normalizeWorldControlSpeed(message?.multiplier);
      this.worldControls.time.speedMultiplier = speedMultiplier;
      this.broadcastWorldControls();
      client.send('adminResult', {
        ok: true,
        action: 'worldTimeSpeed',
        multiplier: speedMultiplier,
      });
    });

    this.onMessage('adminSetWeather', (client, message) => {
      const player = this.players.get(client.sessionId);
      if (!this.isAuthorizedAdminRequest(player, message)) {
        client.send('adminResult', {
          ok: false,
          action: 'weather',
          error: 'Not authorized',
        });
        return;
      }

      const forcedWeather = normalizeWorldControlPhase(message?.weather, WORLD_WEATHER_PHASES);
      if (forcedWeather === undefined) {
        client.send('adminResult', {
          ok: false,
          action: 'weather',
          error: 'Invalid weather',
        });
        return;
      }

      this.worldControls.weather.forcedWeather = forcedWeather;
      this.broadcastWorldControls();
      client.send('adminResult', {
        ok: true,
        action: 'weather',
        weather: forcedWeather ?? 'auto',
      });
    });

    this.onMessage('adminSetWeatherSpeed', (client, message) => {
      const player = this.players.get(client.sessionId);
      if (!this.isAuthorizedAdminRequest(player, message)) {
        client.send('adminResult', {
          ok: false,
          action: 'weatherSpeed',
          error: 'Not authorized',
        });
        return;
      }

      const speedMultiplier = normalizeWorldControlSpeed(message?.multiplier);
      this.worldControls.weather.speedMultiplier = speedMultiplier;
      this.broadcastWorldControls();
      client.send('adminResult', {
        ok: true,
        action: 'weatherSpeed',
        multiplier: speedMultiplier,
      });
    });

    this.onMessage('adminSetMaxLevel', (client, message) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;

      if (!this.isAuthorizedAdminRequest(player, message)) {
        client.send('adminResult', {
          ok: false,
          action: 'maxLevel',
          error: 'Not authorized',
        });
        return;
      }

      player.level = MAX_LEVEL;
      player.hp = player.maxHp ?? player.hp ?? 100;
      player.updatedAt = Date.now();
      client.send('adminResult', {
        ok: true,
        action: 'maxLevel',
        level: MAX_LEVEL,
      });
    });

    this.onMessage('adminLevelUpPlayer', (client, message) => {
      const admin = this.players.get(client.sessionId);
      if (!this.isAuthorizedAdminRequest(admin, message)) {
        client.send('adminResult', {
          ok: false,
          action: 'levelUpPlayer',
          error: 'Not authorized',
        });
        return;
      }

      const target = message?.targetId ? this.players.get(String(message.targetId)) : admin;
      if (!target) {
        client.send('adminResult', {
          ok: false,
          action: 'levelUpPlayer',
          error: 'Player is offline',
        });
        return;
      }

      const amount = clamp(Math.floor(safeNumber(message?.amount, 1)), 1, MAX_LEVEL);
      target.level = clamp(Math.floor(safeNumber(target.level, 1)) + amount, 1, MAX_LEVEL);
      target.hp = target.maxHp ?? target.hp ?? 100;
      target.updatedAt = Date.now();
      const targetClient = this.clients.find((candidate) => candidate.sessionId === target.id);
      targetClient?.send('adminLevelUp', {
        amount,
        level: target.level,
        sourceId: admin.id,
      });
      client.send('adminResult', {
        ok: true,
        action: 'levelUpPlayer',
        targetId: target.id,
        targetName: target.name,
        level: target.level,
      });
      this.broadcastWorld();
    });

    this.onMessage('adminListPlayers', (client, message) => {
      const player = this.players.get(client.sessionId);
      if (!this.isAuthorizedAdminRequest(player, message)) {
        client.send('adminResult', {
          ok: false,
          action: 'listPlayers',
          error: 'Not authorized',
        });
        return;
      }

      client.send('adminPlayers', {
        onlinePlayers: [...this.players.values()].map((onlinePlayer) => ({
          id: onlinePlayer.id,
          email: onlinePlayer.email,
          name: onlinePlayer.name,
          classId: onlinePlayer.classId,
          raceId: onlinePlayer.raceId,
          level: onlinePlayer.level,
          hp: onlinePlayer.hp,
          maxHp: onlinePlayer.maxHp,
          mapId: normalizeMapId(onlinePlayer.mapId),
          instanceId: onlinePlayer.instanceId ?? null,
          interiorId: normalizeInteriorSpaceId(onlinePlayer.interiorId),
          partyId: onlinePlayer.partyId ?? null,
          x: onlinePlayer.x,
          y: onlinePlayer.y,
          updatedAt: onlinePlayer.updatedAt,
        })),
      });
    });

    this.onMessage('adminTeleportTo', (client, message) => {
      const admin = this.players.get(client.sessionId);
      if (!this.isAuthorizedAdminRequest(admin, message)) {
        client.send('adminResult', {
          ok: false,
          action: 'teleportTo',
          error: 'Not authorized',
        });
        return;
      }

      const target = this.players.get(message?.targetId);
      if (!target) {
        client.send('adminResult', {
          ok: false,
          action: 'teleportTo',
          error: 'Player is offline',
        });
        return;
      }

      admin.mapId = normalizeMapId(target.mapId);
      admin.overrideInstanceId = admin.mapId === MAP_IDS.DUNGEON_01 ? target.instanceId ?? null : null;
      admin.instanceId = admin.overrideInstanceId;
      const adminBounds = getMapPixelBounds(admin.mapId);
      admin.x = clamp(target.x + 34, PLAYER.radius, adminBounds.width - PLAYER.radius);
      admin.y = clamp(target.y + 18, PLAYER.radius, adminBounds.height - PLAYER.radius);
      admin.updatedAt = Date.now();
      this.updatePlayerInstance(admin);
      client.send('adminTeleport', {
        targetId: target.id,
        targetName: target.name,
        mapId: admin.mapId,
        instanceId: admin.instanceId,
        x: admin.x,
        y: admin.y,
      });
      client.send('adminResult', {
        ok: true,
        action: 'teleportTo',
        targetName: target.name,
      });
      this.broadcastWorld();
    });

    this.onMessage('adminTeleportToLocation', (client, message) => {
      const admin = this.players.get(client.sessionId);
      if (!this.isAuthorizedAdminRequest(admin, message)) {
        client.send('adminResult', {
          ok: false,
          action: 'teleportToLocation',
          error: 'Not authorized',
        });
        return;
      }

      const targetMapId = normalizeMapId(message?.mapId ?? admin.mapId);
      const bounds = getMapPixelBounds(targetMapId);
      admin.mapId = targetMapId;
      admin.overrideInstanceId = targetMapId === MAP_IDS.DUNGEON_01
        ? message?.instanceId ?? admin.instanceId ?? admin.overrideInstanceId ?? null
        : null;
      admin.instanceId = admin.overrideInstanceId;
      admin.x = clamp(safeNumber(message?.x, admin.x), PLAYER.radius, bounds.width - PLAYER.radius);
      admin.y = clamp(safeNumber(message?.y, admin.y), PLAYER.radius, bounds.height - PLAYER.radius);
      admin.updatedAt = Date.now();
      this.updatePlayerInstance(admin);
      client.send('adminTeleport', {
        mapId: admin.mapId,
        instanceId: admin.instanceId,
        x: admin.x,
        y: admin.y,
        message: `Teleported to ${Math.round(admin.x)}, ${Math.round(admin.y)}`,
      });
      client.send('adminResult', {
        ok: true,
        action: 'teleportToLocation',
        x: admin.x,
        y: admin.y,
      });
      this.broadcastWorld();
    });

    this.onMessage('adminSummonPlayer', (client, message) => {
      const admin = this.players.get(client.sessionId);
      if (!this.isAuthorizedAdminRequest(admin, message)) {
        client.send('adminResult', {
          ok: false,
          action: 'summonPlayer',
          error: 'Not authorized',
        });
        return;
      }

      const target = this.players.get(message?.targetId);
      const targetClient = this.clients.find((candidate) => candidate.sessionId === target?.id);
      if (!target || !targetClient) {
        client.send('adminResult', {
          ok: false,
          action: 'summonPlayer',
          error: 'Player is offline',
        });
        return;
      }

      target.mapId = normalizeMapId(admin.mapId);
      target.overrideInstanceId = target.mapId === MAP_IDS.DUNGEON_01 ? admin.instanceId ?? null : null;
      target.instanceId = target.overrideInstanceId;
      const targetBounds = getMapPixelBounds(target.mapId);
      target.x = clamp(admin.x + 34, PLAYER.radius, targetBounds.width - PLAYER.radius);
      target.y = clamp(admin.y + 18, PLAYER.radius, targetBounds.height - PLAYER.radius);
      target.updatedAt = Date.now();
      this.updatePlayerInstance(target);
      targetClient.send('adminTeleport', {
        targetId: admin.id,
        targetName: admin.name,
        mapId: target.mapId,
        instanceId: target.instanceId,
        x: target.x,
        y: target.y,
        message: `Summoned by ${admin.name ?? 'admin'}`,
      });
      client.send('adminResult', {
        ok: true,
        action: 'summonPlayer',
        targetName: target.name,
      });
      this.broadcastWorld();
    });

    this.onMessage('player', (client, message) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;
      const now = Date.now();
      const previousX = player.x;
      const previousY = player.y;
      const previousMapId = player.mapId;
      const previousHp = safeNumber(player.hp, player.maxHp ?? 100);
      const elapsed = Math.max(16, now - (player.updatedAt ?? now));
      player.facing = safeNumber(message?.facing, player.facing ?? 0);
      player.name = message?.name ?? player.name;
      player.classId = message?.classId ?? player.classId;
      player.raceId = message?.raceId ?? player.raceId;
      player.appearance = message?.appearance ?? player.appearance ?? {};
      player.talents = message?.talents ?? player.talents ?? { spec: null };
      player.level = message?.level ?? player.level;
      player.maxHp = Math.max(1, safeNumber(message?.maxHp, player.maxHp ?? 100));
      player.hp = clamp(message?.hp ?? player.hp ?? player.maxHp, 0, player.maxHp);
      if (previousHp > 0 && player.hp <= 0) {
        this.dropPlayerAggro(client.sessionId, now);
      }
      const requestedMapId = normalizeMapId(message?.mapId ?? player.mapId);
      const requestedMapBounds = getMapPixelBounds(requestedMapId);
      player.interiorId = normalizeInteriorSpaceId(message?.interiorId);
      player.pet = player.classId === 'hunter' && message?.pet && isFinitePoint(message.pet)
        ? {
          x: clamp(Number(message.pet.x), PLAYER.radius, requestedMapBounds.width - PLAYER.radius),
          y: clamp(Number(message.pet.y), PLAYER.radius, requestedMapBounds.height - PLAYER.radius),
          vx: safeNumber(message.pet.vx, 0),
          vy: safeNumber(message.pet.vy, 0),
          facing: safeNumber(message.pet.facing, player.facing ?? 0),
          walk: safeNumber(message.pet.walk, 0),
          moving: Boolean(message.pet.moving),
          attackStartedAt: safeNumber(message.pet.attackStartedAt, 0),
          attackUntil: safeNumber(message.pet.attackUntil, 0),
        }
        : null;
      const enteringDungeon = requestedMapId === MAP_IDS.DUNGEON_01 && previousMapId !== MAP_IDS.DUNGEON_01;
      const dungeonEntryError = enteringDungeon ? this.getDungeonEntryError(player) : null;
      const leavingStartingZone = isStartingMapId(previousMapId)
        && (requestedMapId === MAP_IDS.WORLD || isWorldV2Map(requestedMapId));
      const startingZoneExitReady = Boolean(message?.startingZoneExitReady) || Number(player.level ?? 1) >= 10;
      const startingZoneExitError = leavingStartingZone && !startingZoneExitReady
        ? 'Finish your starting-zone quests first'
        : null;

      if (dungeonEntryError || startingZoneExitError) {
        client.send('notice', { text: dungeonEntryError ?? startingZoneExitError });
        player.x = previousX;
        player.y = previousY;
        player.mapId = previousMapId;
      } else {
        player.x = clamp(Number(message?.x ?? player.x), PLAYER.radius, requestedMapBounds.width - PLAYER.radius);
        player.y = clamp(Number(message?.y ?? player.y), PLAYER.radius, requestedMapBounds.height - PLAYER.radius);
        player.mapId = requestedMapId;
      }
      player.vx = ((player.x - previousX) / elapsed) * 1000;
      player.vy = ((player.y - previousY) / elapsed) * 1000;
      this.updatePlayerInstance(player);
      if (isWorldLikeMap(player.mapId)) {
        this.updateWorldSpawnPacks(now, player);
      }
      player.updatedAt = now;
      this.resetEmptyDungeonInstances();
    });

    this.onMessage('partyInvite', (client, message) => {
      const fromPlayer = this.players.get(client.sessionId);
      const targetId = message?.targetId;
      const targetPlayer = this.players.get(targetId);
      const targetClient = this.clients.find((candidate) => candidate.sessionId === targetId);
      if (!fromPlayer || !targetPlayer || !targetClient || targetId === client.sessionId) return;
      if (fromPlayer.partyId && fromPlayer.partyId === targetPlayer.partyId) {
        client.send('notice', { text: `${targetPlayer.name} is already in your party` });
        return;
      }
      if (fromPlayer.partyId && targetPlayer.partyId && fromPlayer.partyId !== targetPlayer.partyId) {
        client.send('notice', { text: `${targetPlayer.name} is already in another party` });
        return;
      }
      if (this.getProspectivePartyMembers(fromPlayer, targetPlayer).length > PARTY_MAX_MEMBERS) {
        client.send('notice', { text: `Party is full (max ${PARTY_MAX_MEMBERS})` });
        return;
      }

      const now = Date.now();
      const inviteKey = `${client.sessionId}:${targetId}`;
      if ((this.pendingInvites.get(inviteKey) ?? 0) > now || (this.partyInviteCooldowns.get(inviteKey) ?? 0) > now) {
        client.send('notice', { text: 'Party invite already pending' });
        return;
      }

      this.partyInviteCooldowns.set(inviteKey, now + PARTY_INVITE_COOLDOWN_MS);
      this.pendingInvites.set(inviteKey, now + 30000);
      targetClient.send('partyInvite', {
        fromId: client.sessionId,
        fromName: fromPlayer.name,
      });
      client.send('notice', { text: `Party invite sent to ${targetPlayer.name}` });
    });

    this.onMessage('partyAccept', (client, message) => {
      const fromId = message?.fromId;
      const inviteKey = `${fromId}:${client.sessionId}`;
      const expiresAt = this.pendingInvites.get(inviteKey);
      const inviter = this.players.get(fromId);
      const accepter = this.players.get(client.sessionId);
      if (!expiresAt || expiresAt < Date.now() || !inviter || !accepter) return;

      this.pendingInvites.delete(inviteKey);
      if (inviter.partyId && accepter.partyId && inviter.partyId !== accepter.partyId) {
        client.send('notice', { text: 'You are already in another party' });
        const inviterClient = this.clients.find((candidate) => candidate.sessionId === fromId);
        inviterClient?.send('notice', { text: `${accepter.name} is already in another party` });
        return;
      }
      if (this.getProspectivePartyMembers(inviter, accepter).length > PARTY_MAX_MEMBERS) {
        client.send('notice', { text: `Party is full (max ${PARTY_MAX_MEMBERS})` });
        const inviterClient = this.clients.find((candidate) => candidate.sessionId === fromId);
        inviterClient?.send('notice', { text: `Party is full (max ${PARTY_MAX_MEMBERS})` });
        return;
      }

      const partyId = inviter.partyId ?? accepter.partyId ?? `party-${this.nextPartyId++}`;
      const partyLeaderId = inviter.partyLeaderId ?? accepter.partyLeaderId ?? inviter.id;
      inviter.partyId = partyId;
      accepter.partyId = partyId;
      this.getPartyMembers(partyId).forEach((partyMember) => {
        partyMember.partyLeaderId = partyLeaderId;
        this.updatePlayerInstance(partyMember);
        partyMember.updatedAt = Date.now();
      });
      inviter.updatedAt = Date.now();
      accepter.updatedAt = Date.now();

      this.clients
        .filter((candidate) => candidate.sessionId === fromId || candidate.sessionId === client.sessionId)
        .forEach((candidate) => candidate.send('notice', { text: `${inviter.name} and ${accepter.name} joined a party` }));
    });

    this.onMessage('partyLeave', (client) => {
      const player = this.players.get(client.sessionId);
      if (!player?.partyId) return;
      const oldPartyId = player.partyId;
      player.partyId = null;
      player.partyLeaderId = null;
      this.updatePlayerInstance(player);
      player.updatedAt = Date.now();
      client.send('notice', { text: 'You left the party' });
      this.normalizeParty(oldPartyId);
    });

    this.onMessage('partyKick', (client, message) => {
      const leader = this.players.get(client.sessionId);
      const target = this.players.get(message?.targetId);
      if (
        !leader?.partyId
        || !target?.partyId
        || leader.partyId !== target.partyId
        || leader.partyLeaderId !== leader.id
        || target.id === leader.id
      ) {
        return;
      }

      const oldPartyId = target.partyId;
      target.partyId = null;
      target.partyLeaderId = null;
      this.updatePlayerInstance(target);
      target.updatedAt = Date.now();
      const targetClient = this.clients.find((candidate) => candidate.sessionId === target.id);
      targetClient?.send('notice', { text: 'You were removed from the party' });
      client.send('notice', { text: `${target.name} was removed from the party` });
      this.normalizeParty(oldPartyId);
    });

    this.onMessage('dungeonReset', (client) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;
      const resetCount = this.resetDungeonInstancesForPlayer(player);
      const noticeText = resetCount > 0 ? 'Dungeon reset' : 'No dungeon instance to reset';
      const recipients = player.partyId ? this.getPartyMembers(player.partyId) : [player];
      recipients.forEach((recipient) => {
        const recipientClient = this.clients.find((candidate) => candidate.sessionId === recipient.id);
        recipientClient?.send('notice', { text: noticeText });
      });
      this.broadcastWorld();
    });

    this.onMessage('resurrect', (client, message) => {
      const healer = this.players.get(client.sessionId);
      const target = this.players.get(message?.targetId);
      if (!healer || !target || target.hp > 0) return;
      if (!(healer.classId === 'priest' && healer.talents?.spec === 'light')) return;
      if (!sameParty(healer, target) && healer.id !== target.id) return;
      if (!this.canShareSpace(healer, target)) return;
      if (distance(healer, target) > 140) return;

      target.hp = Math.max(1, Math.ceil((target.maxHp ?? 100) * 0.45));
      const healerMapBounds = getMapPixelBounds(healer.mapId);
      target.x = clamp(healer.x + 34, PLAYER.radius, healerMapBounds.width - PLAYER.radius);
      target.y = clamp(healer.y + 18, PLAYER.radius, healerMapBounds.height - PLAYER.radius);
      target.updatedAt = Date.now();
      const targetClient = this.clients.find((candidate) => candidate.sessionId === target.id);
      targetClient?.send('resurrected', {
        hp: target.hp,
        x: target.x,
        y: target.y,
        sourceId: healer.id,
      });
      client.send('notice', { text: `${target.name} resurrected` });
    });

    this.onMessage('ability', (client, message) => {
      const player = this.players.get(client.sessionId);
      const ability = message?.ability;
      if (!player || !ability) return;

      const origin = {
        x: safeNumber(message?.origin?.x, player.x),
        y: safeNumber(message?.origin?.y, player.y),
      };
      if (!isFinitePoint(origin)) return;
      const facing = safeNumber(message?.facing, player.facing ?? 0);
      const damage = clamp(message?.damage ?? ability.damage ?? 0, 0, 10000);
      const healing = clamp(message?.healing ?? ability.healing ?? 0, 0, 10000);
      const targetEnemyId = message?.targetEnemyId == null ? null : String(message.targetEnemyId);
      const xpAwards = new Map();
      const now = Date.now();

      if (!message?.effectOnly && damage > 0) {
        const defeatedBossSpawnIds = [];
        const defeatedSpawnRefs = [];
        const hittableEnemies = this.enemies.filter((enemy) => this.canShareSpace(player, enemy));
        const chainTargetIds = !targetEnemyId && ability.type === 'chain'
          ? selectChainTargets(hittableEnemies, ability, origin, facing, client.sessionId)
          : null;
        this.enemies = this.enemies
          .map((enemy) => {
            if (!this.canShareSpace(player, enemy)) return enemy;
            const hit = targetEnemyId
              ? String(enemy.id) === targetEnemyId
              : chainTargetIds
                ? chainTargetIds.has(enemy.id)
                : abilityHitsEnemy(ability, origin, facing, enemy);
            if (!hit) return enemy;
            const firstHitPlayerId = enemy.firstHitPlayerId ?? client.sessionId;
            const focusTargetId = this.findTankTauntTarget(enemy, player)?.id ?? enemy.targetPlayerId ?? client.sessionId;
            const finalDamage = getAbilityDamageAgainstEnemy(ability, damage, enemy, now);
            if (enemy.hp - finalDamage <= 0) {
              const previousAward = xpAwards.get(firstHitPlayerId) ?? { amount: 0, bossKills: 0, kills: [] };
              if (this.isBossEnemy(enemy) && isWorldLikeMap(enemy.mapId) && enemy.spawnId) {
                defeatedBossSpawnIds.push(enemy.spawnId);
              }
              if (enemy.type === 'enemy' && isWorldLikeMap(enemy.mapId) && enemy.spawnId) {
                defeatedSpawnRefs.push({ spawnId: enemy.spawnId, spawnSlot: enemy.spawnSlot });
              }
              xpAwards.set(firstHitPlayerId, {
                amount: previousAward.amount + (enemy.xp ?? ENEMY_XP),
                bossKills: previousAward.bossKills + (this.isBossEnemy(enemy) ? 1 : 0),
                kills: [...(previousAward.kills ?? []), enemyKillInfo(enemy)],
              });
            }
            const damagedEnemy = {
              ...enemy,
              firstHitPlayerId,
              hp: enemy.hp - finalDamage,
              state: 'aggro',
              targetPlayerId: focusTargetId,
              aggroStartedAt: now,
              leashStartedAt: null,
              aggroDisabledUntil: null,
              hitAt: now,
            };
            return damagedEnemy.hp > 0
              ? applyAbilityDebuffs(damagedEnemy, ability, client.sessionId, now)
              : damagedEnemy;
          })
          .filter((enemy) => enemy.hp > 0);

        defeatedBossSpawnIds.forEach((spawnId) => this.scheduleBossRespawn(spawnId, now));
        defeatedSpawnRefs.forEach(({ spawnId, spawnSlot }) => this.scheduleWorldSpawnRespawn(spawnId, now, spawnSlot));
      }

      if (healing > 0) {
        const directTargetId = message?.targetPlayerId;
        for (const [playerId, targetPlayer] of this.players.entries()) {
          if (playerId === client.sessionId) continue;
          if (!this.canShareSpace(player, targetPlayer)) continue;
          if (directTargetId) {
            if (playerId !== directTargetId) continue;
          } else if (!abilityHealsPlayer(ability, origin, facing, targetPlayer)) {
            continue;
          }

          targetPlayer.hp = clamp((targetPlayer.hp ?? targetPlayer.maxHp ?? 100) + healing, 0, targetPlayer.maxHp ?? 100);
          targetPlayer.updatedAt = now;

          const targetClient = this.clients.find((candidate) => candidate.sessionId === playerId);
          targetClient?.send('heal', {
            amount: healing,
            sourceId: client.sessionId,
            abilityName: ability.name,
          });
        }
      }

      if (!message?.silent) {
        this.sendEffectToVisiblePlayers(player, {
          ...ability,
          casterId: client.sessionId,
          x: origin.x,
          y: origin.y,
          facing,
          start: Date.now(),
          duration: ability.type === 'channel'
            ? ability.duration ?? 3000
            : ability.type === 'aura' || ability.type === 'ground' || ability.type === 'healGround' || ability.type === 'hot' || ability.type === 'buff'
              ? ability.duration ?? 5000
            : ability.type === 'shield' || ability.type === 'heal'
              ? 900
            : ability.type === 'chain'
              ? ability.duration ?? 900
              : ability.duration ?? 650,
        });
      }

      xpAwards.forEach((award, firstHitPlayerId) => {
        this.awardXpForEnemyKill(firstHitPlayerId, award.amount, award.bossKills, award.kills);
      });
    });

    this.onMessage('targeted-damage', (client, message) => {
      const result = this.applyTargetedEnemyDamage(client, message);
      if (!result?.hit || message?.silent) return;
      const player = this.players.get(client.sessionId);
      const ability = message?.ability;
      if (!player || !ability) return;
      const origin = safePoint(message?.origin, player);
      this.sendEffectToVisiblePlayers(player, {
        ...ability,
        casterId: client.sessionId,
        x: origin.x,
        y: origin.y,
        facing: safeNumber(message?.facing, player.facing ?? 0),
        start: Date.now(),
        duration: ability.duration ?? 650,
      });
    });

    this.onMessage('channelEnd', (client, message) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;
      this.sendMessageToVisiblePlayers(player, 'channelEnd', {
        casterId: client.sessionId,
        key: message?.key == null ? null : String(message.key),
        name: message?.name == null ? null : String(message.name),
      });
    });

    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / 30);
    this.clock.setInterval(() => this.broadcastWorld(), WORLD_BROADCAST_MS);
  }

  onJoin(client) {
    client.send('hello', { sessionId: client.sessionId });
  }

  onLeave(client) {
    const leavingPlayer = this.players.get(client.sessionId);
    const oldPartyId = leavingPlayer?.partyId ?? null;
    this.players.delete(client.sessionId);
    this.pendingInvites.forEach((_, key) => {
      if (key.startsWith(`${client.sessionId}:`) || key.endsWith(`:${client.sessionId}`)) {
        this.pendingInvites.delete(key);
      }
    });
    this.partyInviteCooldowns.forEach((_, key) => {
      if (key.startsWith(`${client.sessionId}:`) || key.endsWith(`:${client.sessionId}`)) {
        this.partyInviteCooldowns.delete(key);
      }
    });
    this.dropPlayerAggro(client.sessionId);
    if (oldPartyId) this.normalizeParty(oldPartyId);
    this.resetEmptyDungeonInstances();
  }

  dropPlayerAggro(sessionId, now = Date.now()) {
    const playerId = String(sessionId ?? '');
    if (!playerId) return;
    this.enemies = this.enemies.map((enemy) => {
      const targetPlayerId = enemy.targetPlayerId == null ? null : String(enemy.targetPlayerId);
      const firstHitPlayerId = enemy.firstHitPlayerId == null ? null : String(enemy.firstHitPlayerId);
      return targetPlayerId === playerId || firstHitPlayerId === playerId
        ? resetEnemyAggro(enemy, now)
        : enemy;
    });
  }

  getPartyMembers(partyId) {
    if (!partyId) return [];
    return [...this.players.values()].filter((player) => player.partyId === partyId);
  }

  getPartyOrSoloMembers(player) {
    if (!player) return [];
    return player.partyId ? this.getPartyMembers(player.partyId) : [player];
  }

  getProspectivePartyMembers(inviter, accepter) {
    const membersById = new Map();
    const addMember = (member) => {
      if (member?.id) membersById.set(member.id, member);
    };

    this.getPartyOrSoloMembers(inviter).forEach(addMember);
    this.getPartyOrSoloMembers(accepter).forEach(addMember);
    return [...membersById.values()];
  }

  normalizeParty(partyId) {
    const members = this.getPartyMembers(partyId);
    if (members.length <= 1) {
      members.forEach((member) => {
        member.partyId = null;
        member.partyLeaderId = null;
        this.updatePlayerInstance(member);
        member.updatedAt = Date.now();
      });
      return;
    }

    const existingLeader = members.find((member) => member.id === member.partyLeaderId);
    const leaderId = existingLeader?.id ?? members[Math.floor(Math.random() * members.length)].id;
    members.forEach((member) => {
      member.partyLeaderId = leaderId;
      this.updatePlayerInstance(member);
      member.updatedAt = Date.now();
    });
    this.resetEmptyDungeonInstances();
  }

  disconnectExistingAccountSession(authEmail, nextSessionId) {
    const email = normalizeEmail(authEmail);
    if (!email) return;

    [...this.players.entries()]
      .filter(([sessionId, player]) => sessionId !== nextSessionId && normalizeEmail(player.email) === email)
      .forEach(([sessionId, player]) => {
        const oldPartyId = player.partyId ?? null;
        this.players.delete(sessionId);
        this.dropPlayerAggro(sessionId);
        const oldClient = this.clients.find((candidate) => candidate.sessionId === sessionId);
        oldClient?.send('accountReplaced', { text: 'This account logged in elsewhere' });
        try {
          oldClient?.leave?.(4001, 'Account logged in elsewhere');
        } catch {
          oldClient?.leave?.();
        }
        if (oldPartyId) this.normalizeParty(oldPartyId);
      });

    this.resetEmptyDungeonInstances();
  }

  refreshSpawnDataIfChanged() {
    const nextSignature = getSpawnDataSignature();
    if (nextSignature === this.spawnDataSignature) return;

    this.spawnDataSignature = nextSignature;
    this.spawnData = loadTiledSpawns();
    this.worldSpawnPacks = createWorldSpawnPacks(this.spawnData.enemySpawns);
    this.bossSpawnPacks = createBossSpawnPacks(this.spawnData.bossSpawns);
  }

  updatePlayerInstance(player) {
    if (!player) return;
    if (player.mapId !== MAP_IDS.DUNGEON_01) {
      player.instanceId = null;
      player.overrideInstanceId = null;
      return;
    }

    player.instanceId = player.overrideInstanceId ?? (player.partyId ? `party:${player.partyId}` : `solo:${player.id}`);
    this.ensureDungeonInstance(player.instanceId, this.getDungeonBalanceProfile(player));
  }

  isAuthorizedAdminRequest(player, message) {
    if (!player?.isAdmin) return false;
    const requestEmail = getMessageEmail(message);
    return !requestEmail || requestEmail === player.email;
  }

  getWorldControlsMessage() {
    return {
      time: {
        forcedPhase: this.worldControls?.time?.forcedPhase ?? null,
        speedMultiplier: normalizeWorldControlSpeed(this.worldControls?.time?.speedMultiplier ?? 1),
      },
      weather: {
        forcedWeather: this.worldControls?.weather?.forcedWeather ?? null,
        speedMultiplier: normalizeWorldControlSpeed(this.worldControls?.weather?.speedMultiplier ?? 1),
      },
    };
  }

  sendWorldControls(client) {
    if (!client) return;
    client.send('worldControls', this.getWorldControlsMessage());
  }

  broadcastWorldControls() {
    this.broadcast('worldControls', this.getWorldControlsMessage());
  }

  getDungeonBalanceProfile(player) {
    const members = this.getPartyOrSoloMembers(player).slice(0, PARTY_MAX_MEMBERS);
    const partySize = clamp(members.length || 1, 1, PARTY_MAX_MEMBERS);
    const tanks = members.filter((member) => this.isTankPlayer(member)).length;
    const healers = members.filter((member) => this.isHealerPlayer(member)).length;
    const damage = Math.max(0, members.length - tanks - healers);
    const baseHpMultiplier = DUNGEON_HP_SCALE_BY_PARTY_SIZE.get(partySize) ?? 1;
    const extraDpsMultiplier = Math.max(0, damage - 1) * DUNGEON_EXTRA_DPS_HP_SCALE;
    const trinityDiscount = partySize === 3 && tanks >= 1 && healers >= 1 && damage >= 1
      ? DUNGEON_TRINITY_HP_DISCOUNT
      : 0;
    const hpMultiplier = clamp(
      baseHpMultiplier + extraDpsMultiplier - trinityDiscount,
      DUNGEON_MIN_HP_SCALE,
      DUNGEON_MAX_HP_SCALE,
    );

    return {
      partySize,
      tanks,
      healers,
      damage,
      hpMultiplier,
    };
  }

  rescaleDungeonInstance(instanceId, dungeonScale) {
    const hpMultiplier = getDungeonHpMultiplier(dungeonScale);
    this.enemies = this.enemies.map((enemy) => {
      if (enemy.instanceId !== instanceId) return enemy;

      const currentMaxHp = Math.max(1, safeNumber(enemy.maxHp, 1));
      const previousMultiplier = Math.max(0.01, safeNumber(enemy.dungeonHpMultiplier, 1));
      const baseMaxHp = Math.max(1, safeNumber(enemy.baseMaxHp, currentMaxHp / previousMultiplier));
      const hpRatio = clamp(safeNumber(enemy.hp, currentMaxHp) / currentMaxHp, 0, 1);
      const nextMaxHp = Math.max(1, Math.round(baseMaxHp * hpMultiplier));

      return {
        ...enemy,
        baseMaxHp,
        dungeonHpMultiplier: hpMultiplier,
        maxHp: nextMaxHp,
        hp: Math.min(nextMaxHp, Math.max(0, Math.ceil(nextMaxHp * hpRatio))),
      };
    });
  }

  ensureDungeonInstance(instanceId, dungeonScale = null) {
    if (!instanceId) return;
    this.refreshSpawnDataIfChanged();
    const scale = dungeonScale ?? { hpMultiplier: 1 };
    const existingInstance = this.dungeonInstances.get(instanceId);
    if (existingInstance) {
      existingInstance.resetAt = 0;
      const previousHpMultiplier = getDungeonHpMultiplier(existingInstance.scale);
      const nextHpMultiplier = getDungeonHpMultiplier(scale);
      existingInstance.scale = scale;
      if (Math.abs(previousHpMultiplier - nextHpMultiplier) > 0.001) {
        this.rescaleDungeonInstance(instanceId, scale);
      }
      return;
    }
    this.dungeonInstances.set(instanceId, { resetAt: 0, createdAt: Date.now(), scale });

    this.spawnData.dungeonPacks.forEach((pack, packIndex) => {
      for (let index = 0; index < DUNGEON_PACK_SIZE; index += 1) {
        this.enemies.push(createDungeonEnemy(this.nextEnemyId, pack, instanceId, index, scale));
        this.nextEnemyId += 1;
      }
    });

    this.spawnData.dungeonMinibosses.forEach((spawn) => {
      this.enemies.push(createDungeonMiniboss(this.nextEnemyId, spawn, instanceId, scale));
      this.nextEnemyId += 1;
    });

    this.spawnData.dungeonFinalBosses.forEach((spawn) => {
      this.enemies.push(createDungeonFinalBoss(this.nextEnemyId, spawn, instanceId, scale));
      this.nextEnemyId += 1;
    });
  }

  resetEmptyDungeonInstances(now = Date.now()) {
    this.dungeonInstances.forEach((instance) => {
      instance.resetAt = 0;
    });
  }

  resetDungeonInstancesForPlayer(player) {
    if (!player) return 0;
    const instanceIds = new Set();
    if (player.partyId) {
      instanceIds.add(`party:${player.partyId}`);
      this.getPartyMembers(player.partyId)
        .map((member) => member.instanceId)
        .filter(Boolean)
        .forEach((instanceId) => instanceIds.add(instanceId));
    } else {
      instanceIds.add(`solo:${player.id}`);
      if (player.instanceId) instanceIds.add(player.instanceId);
    }

    let resetCount = 0;
    instanceIds.forEach((instanceId) => {
      if (!instanceId) return;
      const hadInstance = this.dungeonInstances.has(instanceId)
        || this.enemies.some((enemy) => enemy.instanceId === instanceId)
        || this.hazards.some((hazard) => hazard.instanceId === instanceId);
      this.dungeonInstances.delete(instanceId);
      this.enemies = this.enemies.filter((enemy) => enemy.instanceId !== instanceId);
      this.hazards = this.hazards.filter((hazard) => hazard.instanceId !== instanceId);
      if (hadInstance) resetCount += 1;
    });

    const activeMembers = player.partyId ? this.getPartyMembers(player.partyId) : [player];
    activeMembers
      .filter((member) => member.mapId === MAP_IDS.DUNGEON_01)
      .forEach((member) => {
        this.updatePlayerInstance(member);
        member.updatedAt = Date.now();
      });

    return resetCount;
  }

  canShareSpace(a, b) {
    if (!a || !b) return false;
    const mapId = normalizeMapId(a.mapId);
    const otherMapId = normalizeMapId(b.mapId);
    if (getGameplayMapSpaceId(mapId) !== getGameplayMapSpaceId(otherMapId)) return false;
    if (mapId === MAP_IDS.DUNGEON_01 || otherMapId === MAP_IDS.DUNGEON_01) {
      return a.instanceId && a.instanceId === b.instanceId;
    }
    const interiorId = normalizeInteriorSpaceId(a.interiorId);
    const otherInteriorId = normalizeInteriorSpaceId(b.interiorId);
    return interiorId === otherInteriorId;
  }

  applyTargetedEnemyDamage(client, message) {
    const player = this.players.get(client.sessionId);
    const ability = message?.ability;
    const targetEnemyId = message?.targetEnemyId == null ? null : String(message.targetEnemyId);
    const damage = clamp(message?.damage ?? ability?.damage ?? 0, 0, 10000);
    if (!player || !ability || !targetEnemyId || !(damage > 0)) return { hit: false };

    const xpAwards = new Map();
    const defeatedSpawnRefs = [];
    const defeatedBossSpawnIds = [];
    const now = Date.now();
    let hit = false;

    this.enemies = this.enemies
      .map((enemy) => {
        if (String(enemy.id) !== targetEnemyId || enemy.hp <= 0 || !this.canShareSpace(player, enemy)) return enemy;
        hit = true;
        const firstHitPlayerId = enemy.firstHitPlayerId ?? client.sessionId;
        const focusTargetId = this.findTankTauntTarget(enemy, player)?.id ?? enemy.targetPlayerId ?? client.sessionId;
        const finalDamage = getAbilityDamageAgainstEnemy(ability, damage, enemy, now);
        if (enemy.hp - finalDamage <= 0) {
          const previousAward = xpAwards.get(firstHitPlayerId) ?? { amount: 0, bossKills: 0, kills: [] };
          if (this.isBossEnemy(enemy) && isWorldLikeMap(enemy.mapId) && enemy.spawnId) defeatedBossSpawnIds.push(enemy.spawnId);
          if (enemy.type === 'enemy' && isWorldLikeMap(enemy.mapId) && enemy.spawnId) {
            defeatedSpawnRefs.push({ spawnId: enemy.spawnId, spawnSlot: enemy.spawnSlot });
          }
          xpAwards.set(firstHitPlayerId, {
            amount: previousAward.amount + (enemy.xp ?? ENEMY_XP),
            bossKills: previousAward.bossKills + (this.isBossEnemy(enemy) ? 1 : 0),
            kills: [...(previousAward.kills ?? []), enemyKillInfo(enemy)],
          });
        }
        const damagedEnemy = {
          ...enemy,
          firstHitPlayerId,
          hp: enemy.hp - finalDamage,
          state: 'aggro',
          targetPlayerId: focusTargetId,
          aggroStartedAt: now,
          leashStartedAt: null,
          aggroDisabledUntil: null,
          hitAt: now,
        };
        return damagedEnemy.hp > 0
          ? applyAbilityDebuffs(damagedEnemy, ability, client.sessionId, now)
          : damagedEnemy;
      })
      .filter((enemy) => enemy.hp > 0);

    defeatedBossSpawnIds.forEach((spawnId) => this.scheduleBossRespawn(spawnId, now));
    defeatedSpawnRefs.forEach(({ spawnId, spawnSlot }) => this.scheduleWorldSpawnRespawn(spawnId, now, spawnSlot));
    xpAwards.forEach((award, firstHitPlayerId) => {
      this.awardXpForEnemyKill(firstHitPlayerId, award.amount, award.bossKills, award.kills);
    });

    return { hit };
  }

  canSeePlayer(viewer, otherPlayer) {
    if (!viewer || !otherPlayer) return false;
    if (viewer.id === otherPlayer.id) return true;
    return this.canShareSpace(viewer, otherPlayer);
  }

  sendEffectToVisiblePlayers(sourcePlayer, effect) {
    this.sendMessageToVisiblePlayers(sourcePlayer, 'effect', effect);
  }

  sendMessageToVisiblePlayers(sourcePlayer, type, payload) {
    this.clients.forEach((client) => {
      const targetPlayer = this.players.get(client.sessionId);
      if (this.canShareSpace(sourcePlayer, targetPlayer)) {
        client.send(type, payload);
      }
    });
  }

  scheduleWorldSpawnRespawn(spawnId, now, spawnSlot = null) {
    const pack = this.worldSpawnPacks.get(spawnId);
    if (!pack) return;
    pack.pendingRespawns.push({ at: now + getSpawnRespawnDelay(pack.spawn), slotIndex: spawnSlot });
  }

  scheduleBossRespawn(spawnId, now) {
    const pack = this.bossSpawnPacks.get(spawnId);
    if (!pack) return;
    pack.pendingRespawnAt = now + BOSS_RESPAWN_DELAY;
  }

  updateWorldBossSpawns(now, fallbackPlayer) {
    const activeMapId = normalizeMapId(fallbackPlayer?.mapId);
    if (!isWorldLikeMap(activeMapId)) return;

    const activeBossPackIds = new Set(
      [...this.bossSpawnPacks.values()]
        .filter((pack) => normalizeMapId(pack.spawn?.mapId ?? pack.spawn?.props?.mapId) === activeMapId)
        .map((pack) => pack.id),
    );
    if (activeBossPackIds.size === 0) {
      this.enemies = this.enemies.filter((enemy) => !(
        this.isBossEnemy(enemy)
        && normalizeMapId(enemy.mapId) === activeMapId
      ));
      return;
    }

    this.bossSpawnPacks.forEach((pack) => {
      const packMapId = normalizeMapId(pack.spawn?.mapId ?? pack.spawn?.props?.mapId);
      if (packMapId !== activeMapId) return;

      const alive = this.enemies.some((enemy) => (
        this.isBossEnemy(enemy)
        && normalizeMapId(enemy.mapId) === packMapId
        && enemy.spawnId === pack.id
      ));
      if (alive || safeNumber(pack.pendingRespawnAt, 0) > now) return;

      const boss = createBoss(this.nextEnemyId, pack.spawn, fallbackPlayer);
      this.enemies.push(boss);
      this.nextEnemyId += 1;
      pack.pendingRespawnAt = 0;
      this.broadcast('notice', { text: `Boss spawned: ${boss.name}` });
    });
  }

  updateWorldSpawnPacks(now, fallbackPlayer) {
    const activeMapId = normalizeMapId(fallbackPlayer?.mapId);
    if (!isWorldLikeMap(activeMapId)) return;

    const activePackIds = new Set(
      [...this.worldSpawnPacks.values()]
        .filter((pack) => normalizeMapId(pack.spawn?.mapId ?? pack.spawn?.props?.mapId) === activeMapId)
        .map((pack) => pack.id),
    );
    if (activePackIds.size === 0) {
      this.enemies = this.enemies.filter((enemy) => !(
        enemy.type === 'enemy'
        && normalizeMapId(enemy.mapId) === activeMapId
      ));
      return;
    }

    this.worldSpawnPacks.forEach((pack) => {
      const packMapId = normalizeMapId(pack.spawn?.mapId ?? pack.spawn?.props?.mapId);
      if (packMapId !== activeMapId) return;

      const aliveEnemies = this.enemies.filter((enemy) => (
        enemy.type === 'enemy'
        && normalizeMapId(enemy.mapId) === packMapId
        && enemy.spawnId === pack.id
      ));
      let aliveCount = aliveEnemies.length;
      const occupiedSlots = new Set(aliveEnemies.map((enemy) => enemy.spawnSlot).filter((slot) => Number.isFinite(slot)));

      const readySlots = getReadyRespawnSlots(pack, now, occupiedSlots);
      readySlots.forEach((slotIndex) => {
        if (aliveCount >= pack.maxAlive) return;
        occupiedSlots.add(slotIndex);
        this.enemies.push(createEnemy(
          this.nextEnemyId,
          pack.spawn,
          fallbackPlayer,
          slotIndex,
          pack.maxAlive,
          this.enemies,
        ));
        this.nextEnemyId += 1;
        aliveCount += 1;
      });

      while (aliveCount < pack.maxAlive) {
        const openSlot = Array.from({ length: pack.maxAlive }).findIndex((_, index) => !occupiedSlots.has(index));
        if (openSlot < 0) break;
        const slotHasPendingRespawn = pack.pendingRespawns.some((respawn) => {
          const normalizedRespawn = typeof respawn === 'number' ? { at: respawn, slotIndex: null } : respawn;
          return normalizedRespawn.slotIndex === openSlot;
        });
        if (slotHasPendingRespawn) {
          occupiedSlots.add(openSlot);
          continue;
        }
        occupiedSlots.add(openSlot);
        this.enemies.push(createEnemy(
          this.nextEnemyId,
          pack.spawn,
          fallbackPlayer,
          openSlot,
          pack.maxAlive,
          this.enemies,
        ));
        this.nextEnemyId += 1;
        aliveCount += 1;
      }
    });
  }

  update(deltaTime) {
    const now = Date.now();
    const delta = Math.min(deltaTime / 1000, 0.05);
    this.resetEmptyDungeonInstances(now);
    const activeWorldPlayers = [...this.players.values()].filter((player) => isWorldLikeMap(player.mapId));

    activeWorldPlayers.forEach((player) => {
      this.updateWorldSpawnPacks(now, player);
      this.updateWorldBossSpawns(now, player);
    });

    const defeatedDebuffSpawnRefs = [];
    const defeatedDebuffBossSpawnIds = [];
    const debuffXpAwards = new Map();

    this.enemies = this.enemies
      .map((enemy) => {
        const ticked = tickEnemyDebuffs(enemy, now);
        if (ticked.damage <= 0) return ticked.enemy;

        const firstHitPlayerId = ticked.enemy.firstHitPlayerId ?? ticked.sourcePlayerId;
        if (ticked.enemy.hp <= 0 && firstHitPlayerId) {
          const previousAward = debuffXpAwards.get(firstHitPlayerId) ?? { amount: 0, bossKills: 0, kills: [] };
          if (this.isBossEnemy(enemy) && isWorldLikeMap(enemy.mapId) && enemy.spawnId) {
            defeatedDebuffBossSpawnIds.push(enemy.spawnId);
          }
          if (enemy.type === 'enemy' && isWorldLikeMap(enemy.mapId) && enemy.spawnId) {
            defeatedDebuffSpawnRefs.push({ spawnId: enemy.spawnId, spawnSlot: enemy.spawnSlot });
          }
          debuffXpAwards.set(firstHitPlayerId, {
            amount: previousAward.amount + (enemy.xp ?? ENEMY_XP),
            bossKills: previousAward.bossKills + (this.isBossEnemy(enemy) ? 1 : 0),
            kills: [...(previousAward.kills ?? []), enemyKillInfo(enemy)],
          });
        }

        return ticked.enemy;
      })
      .filter((enemy) => enemy.hp > 0);

    defeatedDebuffBossSpawnIds.forEach((spawnId) => this.scheduleBossRespawn(spawnId, now));
    defeatedDebuffSpawnRefs.forEach(({ spawnId, spawnSlot }) => this.scheduleWorldSpawnRespawn(spawnId, now, spawnSlot));
    debuffXpAwards.forEach((award, firstHitPlayerId) => {
      this.awardXpForEnemyKill(firstHitPlayerId, award.amount, award.bossKills, award.kills);
    });

    const enemyMovementSnapshot = this.enemies;
    this.enemies = enemyMovementSnapshot.map((enemy) => {
      let targetPlayer = enemy.targetPlayerId ? this.players.get(enemy.targetPlayerId) : null;
      if (enemy.state === 'aggro') {
        if (
          !targetPlayer
          || !this.canShareSpace(enemy, targetPlayer)
          || safeNumber(targetPlayer.hp, targetPlayer.maxHp ?? 100) <= 0
        ) {
          return resetEnemyAggro(enemy, now);
        }

        const leashDistance = getEnemyLeashDistance(enemy);
        const distanceToTarget = distance(enemy, targetPlayer);
        const distanceFromHome = distance(enemy, getEnemyHomePoint(enemy));
        const outsideLeash = distanceToTarget > leashDistance || distanceFromHome > leashDistance * 1.25;
        if (outsideLeash) {
          const leashStartedAt = enemy.leashStartedAt ?? now;
          if (now - leashStartedAt >= ENEMY_LEASH_GRACE_MS || distanceFromHome > leashDistance * 1.8) {
            return resetEnemyAggro(enemy, now);
          }
          enemy = { ...enemy, leashStartedAt };
        } else if (enemy.leashStartedAt != null) {
          enemy = { ...enemy, leashStartedAt: null };
        }
      }

      if (enemy.state === 'aggro') {
        const tauntTarget = this.findTankTauntTarget(enemy, targetPlayer);
        if (tauntTarget && tauntTarget.id !== enemy.targetPlayerId) {
          enemy = { ...enemy, targetPlayerId: tauntTarget.id };
          targetPlayer = tauntTarget;
        }
      }

      const bossMechanicEnemy = this.updateDungeonBossMechanics(enemy, targetPlayer, now);
      if (bossMechanicEnemy !== enemy) {
        enemy = bossMechanicEnemy;
      }

      if (enemy.state !== 'aggro') {
        const isDungeonEnemy = ['dungeon_enemy', 'dungeon_miniboss', 'dungeon_final_boss'].includes(enemy.type);
        const canAutoAggro = (
          (enemy.type === 'enemy' || this.isBossEnemy(enemy))
          && isWorldLikeMap(enemy.mapId)
        ) || isDungeonEnemy;
        if (canAutoAggro && now >= safeNumber(enemy.aggroDisabledUntil, 0)) {
          const aggroRange = enemy.type === 'dungeon_final_boss' ? 480 : this.isBossEnemy(enemy) ? 400 : 320;
          const aggroTarget = this.getPlayersInEnemySpace(enemy)
            .filter((player) => safeNumber(player.hp, player.maxHp ?? 100) > 0)
            .filter((player) => distance(player, enemy) < aggroRange)
            .sort((a, b) => distance(a, enemy) - distance(b, enemy))[0];
          if (aggroTarget) {
            enemy = {
              ...enemy,
              state: 'aggro',
              targetPlayerId: this.findTankTauntTarget(enemy, aggroTarget)?.id ?? aggroTarget.id,
              firstHitPlayerId: enemy.firstHitPlayerId ?? aggroTarget.id,
              aggroStartedAt: now,
              leashStartedAt: null,
              aggroDisabledUntil: null,
            };
            targetPlayer = this.players.get(enemy.targetPlayerId) ?? aggroTarget;
          } else {
            return updateIdleEnemyMovement(enemy, now, delta, this.isBossEnemy(enemy), enemyMovementSnapshot);
          }
        } else {
          return updateIdleEnemyMovement(enemy, now, delta, this.isBossEnemy(enemy), enemyMovementSnapshot);
        }
      }

      if (enemy.state !== 'aggro') {
        return updateIdleEnemyMovement(enemy, now, delta, this.isBossEnemy(enemy), enemyMovementSnapshot);
      }

      const toPlayerX = targetPlayer.x - enemy.x;
      const toPlayerY = targetPlayer.y - enemy.y;
      const length = Math.hypot(toPlayerX, toPlayerY) || 1;
      const drift = Math.sin(now / 520 + enemy.wobble) * 0.35;
      const dirX = toPlayerX / length;
      const dirY = toPlayerY / length;
      const separation = getEnemySeparationVector(enemy, enemyMovementSnapshot);
      const meleeAttackRange = (enemy.radius ?? ENEMY.radius) + PLAYER.radius + 8;
      const nextAttackAt = enemy.nextAttackAt ?? 0;
      const movementMultiplier = getEnemyMovementMultiplier(enemy, now);
      const mechanicConfig = getWorldBossMechanicConfig(enemy);
      const rangedAttackConfig = mechanicConfig?.rangedAttack ?? null;
      const attackRange = rangedAttackConfig?.range ?? meleeAttackRange;
      const rangedAttackStartRange = rangedAttackConfig
        ? Math.min(attackRange, safeNumber(rangedAttackConfig.attackStartRange, attackRange))
        : attackRange;

      if (movementMultiplier <= 0) {
        return {
          ...enemy,
          targetX: targetPlayer.x,
          targetY: targetPlayer.y,
        };
      }

      if (mechanicConfig && !Number.isFinite(enemy.nextMechanicAt)) {
        enemy = {
          ...enemy,
          nextMechanicAt: now + mechanicConfig.initialDelay,
        };
      }
      if (mechanicConfig?.secondary && !Number.isFinite(enemy.nextSecondaryMechanicAt)) {
        enemy = {
          ...enemy,
          nextSecondaryMechanicAt: now + mechanicConfig.secondary.initialDelay,
        };
      }

      const mechanicUntil = safeNumber(enemy.mechanicUntil, 0);
      const activeMechanicConfig = getActiveWorldBossMechanicConfig(mechanicConfig, enemy.mechanicType);
      if (activeMechanicConfig && now < mechanicUntil) {
        const mechanicImpactAt = safeNumber(enemy.mechanicImpactAt, mechanicUntil);
        const projectiles = Array.isArray(enemy.mechanicProjectiles) ? enemy.mechanicProjectiles : [];
        if (projectiles.length > 0 && !enemy.mechanicResolved) {
          const previousTickAt = now - Math.max(1, delta * 1000);
          const hitPlayerIds = new Set(Array.isArray(enemy.mechanicHitPlayerIds) ? enemy.mechanicHitPlayerIds : []);
          this.getPlayersInEnemySpace(enemy).forEach((player) => {
            if (hitPlayerIds.has(player.id) || safeNumber(player.hp, player.maxHp ?? 100) <= 0) return;
            const projectileHit = projectiles.some((projectile) => (
              bossProjectileSweptHit(projectile, player, previousTickAt, now, PLAYER.radius)
            ));
            if (!projectileHit) return;
            hitPlayerIds.add(player.id);
            const damage = Math.max(1, Math.round(safeNumber(activeMechanicConfig.damage, 1)));
            player.hp = clamp((player.hp ?? player.maxHp ?? 100) - damage, 0, player.maxHp ?? 100);
            player.updatedAt = now;
            const victimClient = this.clients.find((client) => client.sessionId === player.id);
            victimClient?.send('hit', {
              damage,
              slowDuration: activeMechanicConfig.slowDuration,
              slowMultiplier: activeMechanicConfig.slowMultiplier,
              effect: 'slow',
            });
          });
          return {
            ...enemy,
            mechanicHitPlayerIds: [...hitPlayerIds],
            mechanicResolved: now >= mechanicImpactAt,
            attackResolved: now >= mechanicImpactAt,
            targetX: targetPlayer.x,
            targetY: targetPlayer.y,
          };
        }
        if (!enemy.mechanicResolved && now >= mechanicImpactAt) {
          const victims = this.getPlayersInEnemySpace(enemy).filter((player) => (
            safeNumber(player.hp, player.maxHp ?? 100) > 0
            && distance(player, enemy) <= activeMechanicConfig.radius
          ));
          victims.forEach((player) => {
            const damage = Math.max(1, Math.round(safeNumber(activeMechanicConfig.damage, 1)));
            player.hp = clamp((player.hp ?? player.maxHp ?? 100) - damage, 0, player.maxHp ?? 100);
            player.updatedAt = now;
            const victimClient = this.clients.find((client) => client.sessionId === player.id);
            victimClient?.send('hit', { damage });
          });
          return {
            ...enemy,
            mechanicResolved: true,
            attackResolved: true,
            targetX: targetPlayer.x,
            targetY: targetPlayer.y,
          };
        }
        return {
          ...enemy,
          targetX: targetPlayer.x,
          targetY: targetPlayer.y,
        };
      }

      const primaryActivationRange = mechanicConfig?.activationRange ?? safeNumber(mechanicConfig?.radius, 0) * 1.35;
      const primaryReady = Boolean(
        mechanicConfig
        && length <= primaryActivationRange
        && now >= safeNumber(enemy.nextMechanicAt, Number.POSITIVE_INFINITY)
      );
      const secondaryConfig = mechanicConfig?.secondary ?? null;
      const secondaryReady = Boolean(
        secondaryConfig
        && length >= safeNumber(secondaryConfig.minRange, 0)
        && length <= safeNumber(secondaryConfig.activationRange, 0)
        && now >= safeNumber(enemy.nextSecondaryMechanicAt, Number.POSITIVE_INFINITY)
      );
      const selectedMechanicConfig = secondaryReady && (!primaryReady || length > primaryActivationRange)
        ? secondaryConfig
        : primaryReady
          ? mechanicConfig
          : null;

      if (selectedMechanicConfig) {
        const mechanicProjectiles = selectedMechanicConfig.projectileSpeed
          ? createBossProjectilePattern(enemy, targetPlayer, selectedMechanicConfig, now)
          : [];
        const mechanicLaunchAt = mechanicProjectiles[0]?.launchAt
          ?? now + selectedMechanicConfig.telegraphDuration;
        const mechanicImpactAt = mechanicProjectiles.length > 0
          ? Math.max(...mechanicProjectiles.map((projectile) => projectile.impactAt))
          : now + selectedMechanicConfig.telegraphDuration;
        const mechanicUntilAt = mechanicProjectiles.length > 0
          ? mechanicImpactAt + safeNumber(selectedMechanicConfig.recoveryDuration, 300)
          : now + selectedMechanicConfig.totalDuration;
        const cooldownField = selectedMechanicConfig === secondaryConfig
          ? 'nextSecondaryMechanicAt'
          : 'nextMechanicAt';
        return {
          ...enemy,
          [cooldownField]: now + selectedMechanicConfig.cooldown,
          mechanicType: selectedMechanicConfig.type,
          mechanicStartedAt: now,
          mechanicLaunchAt,
          mechanicImpactAt,
          mechanicUntil: mechanicUntilAt,
          mechanicRadius: safeNumber(selectedMechanicConfig.radius, 0),
          mechanicProjectiles,
          mechanicHitPlayerIds: [],
          mechanicResolved: false,
          nextAttackAt: Math.max(safeNumber(enemy.nextAttackAt, 0), mechanicUntilAt + 250),
          attackStartedAt: now,
          attackType: selectedMechanicConfig.type,
          attackLaunchAt: mechanicLaunchAt,
          attackImpactAt: mechanicLaunchAt,
          attackUntil: mechanicUntilAt,
          attackResolved: false,
          targetX: targetPlayer.x,
          targetY: targetPlayer.y,
        };
      }

      const attackUntil = safeNumber(enemy.attackUntil, 0);
      if (now < attackUntil) {
        const attackImpactAt = safeNumber(enemy.attackImpactAt, attackUntil);
        if (enemy.attackType === 'water-bolt' && !enemy.attackResolved) {
          const attackProjectile = {
            originX: enemy.attackOriginX,
            originY: enemy.attackOriginY,
            targetX: enemy.attackTargetX,
            targetY: enemy.attackTargetY,
            launchAt: enemy.attackLaunchAt,
            impactAt: enemy.attackImpactAt,
            radius: enemy.attackProjectileRadius,
          };
          const previousTickAt = now - Math.max(1, delta * 1000);
          const attackHit = bossProjectileSweptHit(attackProjectile, targetPlayer, previousTickAt, now, PLAYER.radius);
          if (attackHit) {
            const damage = this.getEnemyAttackDamage(enemy);
            targetPlayer.hp = clamp((targetPlayer.hp ?? targetPlayer.maxHp ?? 100) - damage, 0, targetPlayer.maxHp ?? 100);
            targetPlayer.updatedAt = now;
            const targetClient = this.clients.find((client) => client.sessionId === enemy.targetPlayerId);
            targetClient?.send('hit', {
              damage,
              slowDuration: rangedAttackConfig?.slowDuration,
              slowMultiplier: rangedAttackConfig?.slowMultiplier,
              effect: 'slow',
            });
          }
          if (attackHit || now >= attackImpactAt) {
            return {
              ...enemy,
              attackResolved: true,
              targetX: targetPlayer.x,
              targetY: targetPlayer.y,
            };
          }
          return {
            ...enemy,
            targetX: targetPlayer.x,
            targetY: targetPlayer.y,
          };
        }
        if (!enemy.attackResolved && now >= attackImpactAt) {
          const attackHit = length <= meleeAttackRange;
          if (attackHit) {
            const damage = this.getEnemyAttackDamage(enemy);
            targetPlayer.hp = clamp((targetPlayer.hp ?? targetPlayer.maxHp ?? 100) - damage, 0, targetPlayer.maxHp ?? 100);
            targetPlayer.updatedAt = now;
            const targetClient = this.clients.find((client) => client.sessionId === enemy.targetPlayerId);
            targetClient?.send('hit', { damage });
          }
          return {
            ...enemy,
            attackResolved: true,
            targetX: targetPlayer.x,
            targetY: targetPlayer.y,
          };
        }
        return {
          ...enemy,
          targetX: targetPlayer.x,
          targetY: targetPlayer.y,
        };
      }
      if (length <= rangedAttackStartRange && now >= nextAttackAt) {
        if (rangedAttackConfig) {
          const [attackProjectile] = createBossProjectilePattern(enemy, targetPlayer, {
            ...rangedAttackConfig,
            telegraphDuration: rangedAttackConfig.launchDelay,
            maxTravelDistance: rangedAttackConfig.range,
            projectileCount: 1,
            projectileSpread: 0,
          }, now);
          const attackUntilAt = attackProjectile.impactAt + safeNumber(rangedAttackConfig.recoveryDuration, 180);
          return {
            ...enemy,
            nextAttackAt: now + safeNumber(rangedAttackConfig.cooldown, 1350),
            attackStartedAt: now,
            attackType: rangedAttackConfig.type,
            attackLaunchAt: attackProjectile.launchAt,
            attackImpactAt: attackProjectile.impactAt,
            attackUntil: attackUntilAt,
            attackResolved: false,
            attackOriginX: attackProjectile.originX,
            attackOriginY: attackProjectile.originY,
            attackTargetX: attackProjectile.targetX,
            attackTargetY: attackProjectile.targetY,
            attackProjectileRadius: attackProjectile.radius,
            targetX: targetPlayer.x,
            targetY: targetPlayer.y,
          };
        }
        return {
          ...enemy,
          nextAttackAt: now + clamp(enemy.attackCooldown ?? (this.isBossEnemy(enemy) ? 1100 : 850), 250, 5000),
          attackStartedAt: now,
          attackType: 'melee',
          attackLaunchAt: 0,
          attackImpactAt: now + ENEMY_ATTACK_IMPACT_MS,
          attackUntil: now + ENEMY_ATTACK_ANIMATION_MS,
          attackResolved: false,
          targetX: targetPlayer.x,
          targetY: targetPlayer.y,
        };
      }
      if (rangedAttackConfig && length <= safeNumber(rangedAttackConfig.preferredRange, rangedAttackConfig.range)) {
        return {
          ...enemy,
          targetX: targetPlayer.x,
          targetY: targetPlayer.y,
        };
      }
      let chaseX = dirX - dirY * drift + separation.x * separation.strength * 0.95;
      let chaseY = dirY + dirX * drift + separation.y * separation.strength * 0.95;
      const chaseLength = Math.hypot(chaseX, chaseY) || 1;
      chaseX /= chaseLength;
      chaseY /= chaseLength;
      const movement = moveEnemyWithCollision(
        enemy,
        enemy.x + chaseX * (enemy.speed ?? ENEMY.speed) * movementMultiplier * delta,
        enemy.y + chaseY * (enemy.speed ?? ENEMY.speed) * movementMultiplier * delta,
      );

      return {
        ...enemy,
        x: movement.x,
        y: movement.y,
      };
    });

    this.updateHazards(now);
  }

  isBossEnemy(enemy) {
    return enemy?.type === 'boss' || enemy?.type === 'dungeon_miniboss' || enemy?.type === 'dungeon_final_boss';
  }

  getEnemyAttackDamage(enemy) {
    let fallback = 9;
    if (enemy?.type === 'dungeon_final_boss') fallback = 74;
    else if (enemy?.type === 'dungeon_miniboss') fallback = 54;
    else if (enemy?.type === 'boss') fallback = 28;
    else if (enemy?.type === 'dungeon_enemy') fallback = 34;
    return Math.max(1, Math.round(safeNumber(enemy?.damage, fallback)));
  }

  getPlayersInEnemySpace(enemy) {
    return [...this.players.values()].filter((player) => this.canShareSpace(enemy, player));
  }

  isTankPlayer(player) {
    return (player?.classId === 'paladin' && player?.talents?.spec === 'aegis')
      || (player?.classId === 'warrior' && player?.talents?.spec === 'ironward');
  }

  isHealerPlayer(player) {
    return player?.classId === 'priest' && player?.talents?.spec === 'light';
  }

  getDungeonEntryError(player) {
    if (!player) return 'Dungeon entry failed';
    if (Number(player.level ?? 1) < 20) return 'Level 20 required';

    return null;
  }

  findTankTauntTarget(enemy, currentTarget) {
    const players = this.getPlayersInEnemySpace(enemy);
    const partyId = currentTarget?.partyId ?? null;
    const eligibleTanks = players
      .filter((player) => this.isTankPlayer(player))
      .filter((player) => safeNumber(player.hp, player.maxHp ?? 100) > 0)
      .filter((player) => (partyId ? player.partyId === partyId : player.id === currentTarget?.id))
      .filter((player) => distance(player, enemy) < 420);

    if (!eligibleTanks.length) return null;
    if (eligibleTanks.length === 1) return eligibleTanks[0];
    const rotationSeed = `${enemy.id}:${Math.floor(Date.now() / 20000)}`;
    const index = Math.floor(seededUnit(rotationSeed, eligibleTanks.length) * eligibleTanks.length) % eligibleTanks.length;
    return eligibleTanks.sort((a, b) => String(a.id).localeCompare(String(b.id)))[index];
  }

  updateDungeonBossMechanics(enemy, targetPlayer, now) {
    if (!['dungeon_miniboss', 'dungeon_final_boss'].includes(enemy.type)) return enemy;
    if (enemy.state !== 'aggro') return enemy;
    const candidates = this.getPlayersInEnemySpace(enemy);
    const target = targetPlayer && this.canShareSpace(enemy, targetPlayer)
      ? targetPlayer
      : candidates[Math.floor(Math.random() * candidates.length)];
    if (!target) return enemy;

    const spawnAoE = ({ idPrefix, x, y, radius, damage, duration, color }) => {
      const hazard = {
        id: `${idPrefix}-${enemy.id}-${now}-${Math.round(x)}-${Math.round(y)}`,
        type: 'dungeon_aoe',
        mapId: enemy.mapId,
        instanceId: enemy.instanceId,
        x,
        y,
        radius,
        damage,
        expiresAt: now + duration,
        nextDamageAt: now + 650,
      };
      this.hazards.push(hazard);
      this.sendEffectToVisiblePlayers(enemy, {
        type: 'dungeon_aoe',
        color,
        x: hazard.x,
        y: hazard.y,
        radius: hazard.radius,
        start: now,
        duration,
      });
    };

    const spawnLaser = ({ idPrefix, facing, length, width, damage, duration, color }) => {
      const hazard = {
        id: `${idPrefix}-${enemy.id}-${now}`,
        type: 'dungeon_laser',
        mapId: enemy.mapId,
        instanceId: enemy.instanceId,
        x: enemy.x,
        y: enemy.y,
        facing,
        length,
        width,
        damage,
        expiresAt: now + duration,
        nextDamageAt: now + 450,
      };
      this.hazards.push(hazard);
      this.sendEffectToVisiblePlayers(enemy, {
        type: 'dungeon_laser',
        color,
        x: hazard.x,
        y: hazard.y,
        facing,
        length: hazard.length,
        width: hazard.width,
        start: now,
        duration,
      });
    };

    let updatedEnemy = enemy;
    const bossType = normalizeEnemyKind(enemy.bossType ?? enemy.spriteId ?? enemy.name);

    if (enemy.type === 'dungeon_miniboss') {
      if (bossType === 'lava-forged-warden') {
        if (now >= (enemy.nextLaserAt ?? 0)) {
          spawnLaser({
            idPrefix: 'lava-fissure',
            facing: Math.atan2(target.y - enemy.y, target.x - enemy.x),
            length: 500,
            width: 48,
            damage: 38,
            duration: 1500,
            color: '#f97316',
          });
          updatedEnemy = { ...updatedEnemy, nextLaserAt: now + 6200 + Math.random() * 900 };
        }
      } else if (bossType === 'crystal-horror') {
        if (now >= (enemy.nextAoEAt ?? 0)) {
          spawnAoE({
            idPrefix: 'crystal-shards',
            x: target.x,
            y: target.y,
            radius: 78,
            damage: 30,
            duration: 1900,
            color: '#67e8f9',
          });
          spawnAoE({
            idPrefix: 'crystal-burst',
            x: enemy.x,
            y: enemy.y,
            radius: 96,
            damage: 25,
            duration: 1500,
            color: '#a5f3fc',
          });
          updatedEnemy = { ...updatedEnemy, nextAoEAt: now + 4800 + Math.random() * 800 };
        }
      } else if (now >= (enemy.nextAoEAt ?? 0)) {
        spawnAoE({
          idPrefix: 'gloomfang-venom',
          x: target.x,
          y: target.y,
          radius: 86,
          damage: 32,
          duration: 2200,
          color: '#a3e635',
        });
        updatedEnemy = { ...updatedEnemy, nextAoEAt: now + 5400 + Math.random() * 1000 };
      }

      return updatedEnemy;
    }

    const enraged = enemy.hp <= enemy.maxHp * 0.5;
    if (now >= (enemy.nextAoEAt ?? 0)) {
      spawnAoE({
        idPrefix: 'rift-collapse',
        x: target.x,
        y: target.y,
        radius: 104,
        damage: 36,
        duration: 2400,
        color: '#ef4444',
      });
      updatedEnemy = { ...updatedEnemy, nextAoEAt: now + (enraged ? 3600 : 5000) + Math.random() * 900 };
    }

    if (now >= (enemy.nextLaserAt ?? 0)) {
      spawnLaser({
        idPrefix: 'rift-beam',
        facing: Math.atan2(target.y - enemy.y, target.x - enemy.x),
        length: 580,
        width: 50,
        damage: 46,
        duration: 1400,
        color: '#f43f5e',
      });
      updatedEnemy = { ...updatedEnemy, nextLaserAt: now + (enraged ? 5200 : 7200) + Math.random() * 1300 };
    }

    if (now >= (enemy.nextRingAt ?? 0)) {
      const ringRadius = 145;
      for (let index = 0; index < 5; index += 1) {
        const angle = (Math.PI * 2 * index) / 5 + now / 1800;
        spawnAoE({
          idPrefix: 'rift-ring',
          x: enemy.x + Math.cos(angle) * ringRadius,
          y: enemy.y + Math.sin(angle) * ringRadius,
          radius: 68,
          damage: 31,
          duration: 2300,
          color: '#a855f7',
        });
      }
      updatedEnemy = { ...updatedEnemy, nextRingAt: now + (enraged ? 7000 : 9200) + Math.random() * 1200 };
    }

    return updatedEnemy;
  }

  updateHazards(now) {
    this.hazards = this.hazards.filter((hazard) => {
      if (now >= hazard.expiresAt) return false;
      if (now < (hazard.nextDamageAt ?? 0)) return true;

      const start = { x: hazard.x, y: hazard.y };
      const end = {
        x: hazard.x + Math.cos(hazard.facing ?? 0) * (hazard.length ?? 0),
        y: hazard.y + Math.sin(hazard.facing ?? 0) * (hazard.length ?? 0),
      };

      this.players.forEach((player) => {
        if (!this.canShareSpace(hazard, player)) return;
        const isHit = hazard.type === 'dungeon_aoe'
          ? distance(player, hazard) < (hazard.radius ?? 0) + PLAYER.radius
          : distanceToSegment(player, start, end) < (hazard.width ?? 32) / 2 + PLAYER.radius;
        if (!isHit) return;

        player.hp = clamp((player.hp ?? player.maxHp ?? 100) - hazard.damage, 0, player.maxHp ?? 100);
        player.updatedAt = now;
        const targetClient = this.clients.find((client) => client.sessionId === player.id);
        targetClient?.send('hit', { damage: hazard.damage });
      });

      hazard.nextDamageAt = now + 650;
      return true;
    });
  }

  broadcastWorld() {
    this.clients.forEach((client) => {
      const viewer = this.players.get(client.sessionId);
      if (!viewer) return;
      if (isWorldLikeMap(viewer.mapId)) {
        const viewerMapId = normalizeMapId(viewer.mapId);
        const hasVisibleWorldEnemies = this.enemies.some((enemy) => (
          enemy.type === 'enemy'
          && getGameplayMapSpaceId(enemy.mapId) === getGameplayMapSpaceId(viewerMapId)
        ));
        if (!hasVisibleWorldEnemies) {
          this.updateWorldSpawnPacks(Date.now(), viewer);
        }
      }
      client.send('world', {
        players: [...this.players.values()]
          .filter((player) => this.canSeePlayer(viewer, player))
          .map(sanitizeBroadcastPlayer)
          .filter(Boolean),
        onlinePlayers: [...this.players.values()].map((player) => ({
          id: player.id,
          name: player.name,
          classId: player.classId,
          talents: player.talents ?? { spec: null },
          level: player.level,
          hp: clamp(player.hp ?? player.maxHp ?? 100, 0, Math.max(1, player.maxHp ?? 100)),
          maxHp: Math.max(1, player.maxHp ?? 100),
          mapId: normalizeMapId(player.mapId),
          instanceId: player.instanceId ?? null,
          interiorId: normalizeInteriorSpaceId(player.interiorId),
          partyId: player.partyId,
          partyLeaderId: player.partyLeaderId,
        })),
        enemies: this.enemies
          .filter((enemy) => this.canShareSpace(viewer, enemy))
          .map(sanitizeBroadcastEnemy)
          .filter(Boolean),
        serverTime: Date.now(),
      });
    });
  }

  awardXpForEnemyKill(firstHitPlayerId, amount, bossKills, kills = []) {
    const owner = this.players.get(firstHitPlayerId);
    if (!owner) return;

    const recipients = [...this.players.values()].filter((player) => (
      (player.id === firstHitPlayerId || sameParty(player, owner)) && this.canShareSpace(player, owner)
    ));

    recipients.forEach((player) => {
      const recipientClient = this.clients.find((client) => client.sessionId === player.id);
      recipientClient?.send('xp', { amount, bossKills, kills });
    });
  }
}

const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? '0.0.0.0';
const updatesDir = path.join(rootDir, 'updates');

function resolveUpdateFile(fileName) {
  const decodedFileName = path.basename(decodeURIComponent(fileName));
  const exactPath = path.join(updatesDir, decodedFileName);
  if (exactPath.startsWith(updatesDir) && fs.existsSync(exactPath)) return exactPath;

  const normalizedRequest = decodedFileName.toLowerCase().replace(/[-_\s]+/g, '');
  const match = fs.existsSync(updatesDir)
    ? fs.readdirSync(updatesDir).find((candidate) => (
      candidate.toLowerCase().replace(/[-_\s]+/g, '') === normalizedRequest
    ))
    : null;

  return match ? path.join(updatesDir, match) : null;
}

const gameServer = new Server({
  express: (app) => {
    app.get('/', (_request, response) => {
      response.send('MMO Colyseus server is running');
    });

    app.get('/health', (_request, response) => {
      response.json({ ok: true, service: 'mmo-colyseus' });
    });

    app.get('/updates/:fileName', (request, response) => {
      const fileName = path.basename(request.params.fileName);
      const filePath = resolveUpdateFile(fileName);
      if (!filePath) {
        response.status(404).send('Update file not found');
        return;
      }

      response.setHeader('Cache-Control', fileName === 'latest.yml' ? 'no-store' : 'public, max-age=3600');
      response.sendFile(filePath);
    });
  },
});
gameServer.define('world', WorldRoom);

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((address) => address && address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
}

gameServer.listen(port, host).then(() => {
  console.log(`Colyseus MMO server listening on ws://localhost:${port}`);
  getLanAddresses().forEach((address) => {
    console.log(`LAN clients can use ws://${address}:${port}`);
  });
});
