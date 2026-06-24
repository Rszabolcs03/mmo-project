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

const MAP_FILES = {
  [MAP_IDS.WORLD]: 'world_map.tmj',
  human_starting: 'human_starting_zone_v4.tmj',
  dwarf_starting: 'dwarf_starting_zone.tmj',
  undead_starting: 'undead_starting_zone.tmj',
  elf_starting: 'elf_starting_zone.tmj',
  orc_starting: 'orc_starting_zone.tmj',
  [MAP_IDS.DUNGEON_01]: 'dungeon_01.tmj',
};

const WORLD_V2_REGION_GRID = 5;
const WORLD_V2_REGION_TILES = 800;
const WORLD_V2_TILE_SIZE = 32;
const WORLD_V2_WORLD_PIXEL_SIZE = WORLD_V2_REGION_GRID * WORLD_V2_REGION_TILES * WORLD_V2_TILE_SIZE;
const WORLD_STREAM_GENERATIONS = {
  v2: { id: 'v2', mapSpaceId: 'world_v2' },
  v3: { id: 'v3', mapSpaceId: 'world_v3' },
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

const WORLD_LIKE_MAP_IDS = new Set([
  MAP_IDS.WORLD,
  'human_starting',
  'dwarf_starting',
  'undead_starting',
  'elf_starting',
  'orc_starting',
]);
WORLD_V2_MAP_IDS.forEach((mapId) => WORLD_LIKE_MAP_IDS.add(mapId));
const STARTING_MAP_IDS = new Set([
  'human_starting',
  'dwarf_starting',
  'undead_starting',
  'elf_starting',
  'orc_starting',
]);

function normalizeMapId(mapId) {
  const value = String(mapId ?? MAP_IDS.WORLD);
  return MAP_FILES[value] ? value : MAP_IDS.WORLD;
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
  maxCount: 12,
  radius: 17,
  speed: 105,
  spawnEvery: 1800,
  wanderSpeed: 48,
};

const WORLD_BROADCAST_MS = 50;
const PARTY_INVITE_COOLDOWN_MS = 8000;
const MAX_LEVEL = 30;
const ADMIN_EMAILS = new Set(['romvariszabi03@gmail.com']);

const ENEMY_XP = 35;
const BOSS_XP = 180;
const BOSS_SPAWN_MIN = 18000;
const BOSS_SPAWN_MAX = 34000;
const BOSS_RESPAWN_DELAY = 60000;
const DUNGEON_PACK_SIZE = 6;

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getMessageEmail(message) {
  return normalizeEmail(message?.auth?.email ?? message?.email ?? message?.authEmail);
}

function isAdminEmail(value) {
  return ADMIN_EMAILS.has(normalizeEmail(value));
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

function readObjects(objectLayers, layerName, mapId = MAP_IDS.WORLD) {
  const normalizedMapId = normalizeMapId(mapId);
  return objectLayers
    .find((layer) => layer.name === layerName)
    ?.objects
    ?.map((object) => ({
      ...object,
      mapId: normalizedMapId,
      props: {
        ...getProperties(object),
        mapId: normalizedMapId,
      },
    })) ?? [];
}

function loadCollisionMap(fileName) {
  try {
    const map = loadTiledMapFile(fileName, { decodeTiles: true, tileLayerNames: ['Collision'] });
    return {
      width: map.width,
      height: map.height,
      tilewidth: map.tilewidth,
      tileheight: map.tileheight,
      pixelWidth: map.width * map.tilewidth,
      pixelHeight: map.height * map.tileheight,
      tileLayer: (map.layers ?? []).find((layer) => layer.type === 'tilelayer' && layer.name === 'Collision') ?? null,
      objectLayer: (map.layers ?? []).find((layer) => layer.type === 'objectgroup' && layer.name === 'Collision') ?? null,
    };
  } catch (error) {
    console.warn(`Collision map ${fileName} could not be loaded:`, error.message);
    return null;
  }
}

const COLLISION_MAPS = Object.fromEntries(
  Object.entries(MAP_FILES).map(([mapId, fileName]) => [mapId, loadCollisionMap(fileName)]),
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

function isTileBlocked(collisionMap, x, y) {
  if (!collisionMap) return false;
  const tileWidth = collisionMap.tilewidth || 32;
  const tileHeight = collisionMap.tileheight || 32;
  if (x < 0 || y < 0 || x >= collisionMap.pixelWidth || y >= collisionMap.pixelHeight) return true;

  const tileLayer = collisionMap.tileLayer;
  if (!tileLayer?.data) return false;
  const column = Math.floor(x / tileWidth);
  const row = Math.floor(y / tileHeight);
  return Boolean(tileLayer.data[row * tileLayer.width + column]);
}

function canMoveToCollision(collisionMap, x, y, radius) {
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

  const tileBlocked = points.some((point) => isTileBlocked(collisionMap, point.x, point.y));
  if (tileBlocked) return false;

  const collisionObjects = collisionMap?.objectLayer?.objects ?? [];
  return !collisionObjects.some((object) => pointIntersectsCollisionObject(object, x, y, radius));
}

function moveEnemyWithCollision(enemy, nextX, nextY, bounds = null) {
  const radius = enemy.radius ?? ENEMY.radius;
  const mapBounds = getMapPixelBounds(enemy.mapId);
  const minX = bounds ? bounds.x + radius : radius;
  const maxX = bounds ? bounds.x + bounds.width - radius : mapBounds.width - radius;
  const minY = bounds ? bounds.y + radius : radius;
  const maxY = bounds ? bounds.y + bounds.height - radius : mapBounds.height - radius;
  const collisionMap = getCollisionMap(enemy.mapId);
  const targetX = clamp(nextX, minX, maxX);
  const targetY = clamp(nextY, minY, maxY);

  if (canMoveToCollision(collisionMap, targetX, targetY, radius)) {
    return { x: targetX, y: targetY, blocked: false };
  }
  if (canMoveToCollision(collisionMap, targetX, enemy.y, radius)) {
    return { x: targetX, y: enemy.y, blocked: true };
  }
  if (canMoveToCollision(collisionMap, enemy.x, targetY, radius)) {
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
        ...readObjects(layers, 'Spawns', normalizedMapId),
        ...readObjects(layers, 'BossSpawns', normalizedMapId),
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

function getSpawnBounds(spawnObject, fallbackPosition, fallbackSize = 360) {
  if (!spawnObject) {
    return {
      x: fallbackPosition.x - fallbackSize / 2,
      y: fallbackPosition.y - fallbackSize / 2,
      width: fallbackSize,
      height: fallbackSize,
    };
  }

  return {
    x: Number(spawnObject.x ?? fallbackPosition.x - fallbackSize / 2),
    y: Number(spawnObject.y ?? fallbackPosition.y - fallbackSize / 2),
    width: Number(spawnObject.width) > 0 ? Number(spawnObject.width) : fallbackSize,
    height: Number(spawnObject.height) > 0 ? Number(spawnObject.height) : fallbackSize,
  };
}

function expandBoundsAroundCenter(bounds, minWidth, minHeight, mapId = MAP_IDS.WORLD) {
  const collisionMap = getCollisionMap(mapId);
  const pixelWidth = collisionMap?.pixelWidth ?? WORLD.width;
  const pixelHeight = collisionMap?.pixelHeight ?? WORLD.height;
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

function getSpawnPackId(spawnObject, fallbackId = 'fallback_spawn') {
  const mapId = normalizeMapId(spawnObject?.mapId ?? spawnObject?.props?.mapId ?? MAP_IDS.WORLD);
  const baseId = String(spawnObject?.props?.spawnId ?? spawnObject?.name ?? spawnObject?.id ?? fallbackId);
  return `${mapId}:${baseId}`;
}

function getSpawnEnemyType(spawnObject) {
  const spawnName = String(spawnObject?.name ?? '').toLowerCase();
  return normalizeEnemyKind(spawnObject?.props?.enemyType ?? (spawnName.includes('desert') ? 'scarab' : 'wolf'));
}

function getSpawnMaxAlive(spawnObject) {
  return Math.max(1, Math.floor(numberProp(spawnObject, 'maxAlive', numberProp(spawnObject, 'maxEnemies', ENEMY.maxCount))));
}

function getSpawnRespawnMin(spawnObject) {
  return Math.max(1000, numberProp(spawnObject, 'respawnMin', numberProp(spawnObject, 'respawnTime', ENEMY.spawnEvery)));
}

function getSpawnRespawnMax(spawnObject) {
  return Math.max(getSpawnRespawnMin(spawnObject), numberProp(spawnObject, 'respawnMax', getSpawnRespawnMin(spawnObject)));
}

function getSpawnRespawnDelay(spawnObject) {
  const min = getSpawnRespawnMin(spawnObject);
  const max = getSpawnRespawnMax(spawnObject);
  return min + Math.random() * (max - min);
}

const ENEMY_KIND_STATS = {
  wolf: { name: 'Wolf', hp: 100, radius: 17, speed: 82, xp: 35 },
  kobold: { name: 'Kobold Miner', hp: 115, radius: 17, speed: 76, xp: 40 },
  bandit: { name: 'Field Bandit', hp: 125, radius: 18, speed: 84, xp: 42 },
  undead: { name: 'Undead', hp: 130, radius: 18, speed: 62, xp: 45 },
  'restless-dead': { name: 'Restless Dead', hp: 130, radius: 18, speed: 62, xp: 45 },
  scarab: { name: 'Glass Scarab', hp: 110, radius: 16, speed: 88, xp: 38 },
  'snow-wolf': { name: 'Snow Wolf', hp: 110, radius: 17, speed: 86, xp: 38 },
  'frost-trogg': { name: 'Frost Trogg', hp: 145, radius: 19, speed: 66, xp: 48 },
  'cave-spider': { name: 'Cave Spider', hp: 120, radius: 17, speed: 90, xp: 44 },
  'grave-rat': { name: 'Grave Rat', hp: 90, radius: 15, speed: 96, xp: 34 },
  plaguehound: { name: 'Plaguehound', hp: 125, radius: 18, speed: 86, xp: 42 },
  'forest-sprite': { name: 'Forest Sprite', hp: 95, radius: 15, speed: 92, xp: 36 },
  'corrupted-treant': { name: 'Corrupted Treant', hp: 165, radius: 21, speed: 54, xp: 55 },
  nightstalker: { name: 'Nightstalker', hp: 120, radius: 17, speed: 94, xp: 43 },
  plainstrider: { name: 'Plainstrider', hp: 115, radius: 18, speed: 96, xp: 39 },
  scorpion: { name: 'Dust Scorpion', hp: 125, radius: 17, speed: 74, xp: 42 },
  quilboar: { name: 'Razor Quilboar', hp: 150, radius: 20, speed: 70, xp: 50 },
  'road-bandit': { name: 'Road Bandit', hp: 220, radius: 18, speed: 86, xp: 70 },
  'dire-wolf': { name: 'Dire Wolf', hp: 310, radius: 19, speed: 96, xp: 90 },
  'stone-gnoll': { name: 'Stone Gnoll', hp: 430, radius: 21, speed: 74, xp: 125 },
  'ember-wraith': { name: 'Ember Wraith', hp: 520, radius: 20, speed: 82, xp: 155 },
  'cave-stalker': { name: 'Cave Stalker', hp: 1100, radius: 21, speed: 98, xp: 205 },
  'magma-crawler': { name: 'Magma Crawler', hp: 1260, radius: 22, speed: 82, xp: 230 },
  'deep-burrower': { name: 'Deep Burrower', hp: 1180, radius: 22, speed: 88, xp: 220 },
  'obsidian-sentinel': { name: 'Obsidian Sentinel', hp: 1520, radius: 25, speed: 64, xp: 265 },
};

const BOSS_KIND_STATS = {
  'elder-briarheart': { name: 'Elder Briarheart', hp: 620, radius: 42, speed: 58, xp: 180 },
  'granite-matriarch': { name: 'Granite Matriarch', hp: 760, radius: 44, speed: 52, xp: 210 },
  'crypt-warden': { name: 'Crypt Warden', hp: 720, radius: 42, speed: 56, xp: 210 },
  'moonshade-stag': { name: 'Moonshade Stag', hp: 680, radius: 40, speed: 70, xp: 210 },
  'bloodtusk-chief': { name: 'Bloodtusk Chief', hp: 750, radius: 44, speed: 60, xp: 210 },
  'varro-the-tollkeeper': { name: 'Varro the Tollkeeper', hp: 1300, radius: 38, speed: 70, xp: 260 },
  'thornmaw-alpha': { name: 'Thornmaw Alpha', hp: 1700, radius: 40, speed: 78, xp: 320 },
  'granite-ogre': { name: 'Granite Ogre', hp: 2300, radius: 46, speed: 58, xp: 390 },
  'ash-witch': { name: 'Ash Witch', hp: 2800, radius: 38, speed: 72, xp: 460 },
  'gloomfang-matriarch': { name: 'Gloomfang Matriarch', hp: 8600, radius: 48, speed: 78, xp: 1050 },
  'lava-forged-warden': { name: 'Lava-Forged Warden', hp: 9800, radius: 52, speed: 60, xp: 1140 },
  'crystal-horror': { name: 'Crystal Horror', hp: 9300, radius: 50, speed: 68, xp: 1100 },
  'rift-heart': { name: 'Rift Heart', hp: 22000, radius: 60, speed: 56, xp: 2200 },
};

function getEnemyKindStats(kind) {
  return ENEMY_KIND_STATS[normalizeEnemyKind(kind)] ?? ENEMY_KIND_STATS.wolf;
}

function getBossKindStats(kind) {
  return BOSS_KIND_STATS[normalizeEnemyKind(kind)] ?? BOSS_KIND_STATS['elder-briarheart'];
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

  if (slotIndex % 5 === 0) return 'sentinel';
  if (slotIndex % 3 === 0) return 'roam-pause';
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

function findOpenSpawnPoint(mapId, bounds, slotIndex, maxAlive, radius = ENEMY.radius, preferredPoint = null) {
  const collisionMap = getCollisionMap(mapId);
  const basePoint = clampPointToBounds(preferredPoint ?? pointForSpawnSlot(bounds, slotIndex, maxAlive), bounds, radius);
  if (canMoveToCollision(collisionMap, basePoint.x, basePoint.y, radius)) return basePoint;

  const seed = `${bounds.x}:${bounds.y}:${slotIndex}:open`;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const angle = seededUnit(seed, attempt) * Math.PI * 2;
    const spread = 18 + attempt * 8;
    const candidate = clampPointToBounds({
      x: basePoint.x + Math.cos(angle) * spread,
      y: basePoint.y + Math.sin(angle) * spread,
    }, bounds, radius);
    if (canMoveToCollision(collisionMap, candidate.x, candidate.y, radius)) return candidate;
  }

  const columns = Math.max(1, Math.floor(bounds.width / Math.max(radius * 2, 24)));
  const rows = Math.max(1, Math.floor(bounds.height / Math.max(radius * 2, 24)));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const candidate = clampPointToBounds({
        x: bounds.x + ((column + 0.5) / columns) * bounds.width,
        y: bounds.y + ((row + 0.5) / rows) * bounds.height,
      }, bounds, radius);
      if (canMoveToCollision(collisionMap, candidate.x, candidate.y, radius)) return candidate;
    }
  }

  return basePoint;
}

function makeEnemyMovementState(spawnObject, bounds, slotIndex, maxAlive, radius = ENEMY.radius, mapId = MAP_IDS.WORLD) {
  const home = findOpenSpawnPoint(mapId, bounds, slotIndex, maxAlive, radius);
  const movementMode = getSpawnMovementMode(spawnObject, slotIndex);
  const patrolPoints = movementMode === 'sentinel'
    ? [home]
    : buildPatrolPoints(home, bounds, slotIndex, radius);
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

function updateIdleEnemyMovement(enemy, now, delta, isBoss = false) {
  const bounds = enemy.spawnBounds;
  if (!bounds) return enemy;

  const radius = enemy.radius ?? ENEMY.radius;
  const mode = enemy.movementMode ?? 'patrol';
  let target = enemy.wanderTarget;
  let patrolIndex = enemy.patrolIndex ?? 0;
  let pauseUntil = enemy.pauseUntil ?? 0;
  let nextWanderAt = enemy.nextWanderAt ?? 0;
  const patrolPoints = enemy.patrolPoints?.length ? enemy.patrolPoints : [enemy.home ?? randomPointInBounds(bounds)];

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
    if (pauseUntil > now && target && distance(enemy, target) < 10) {
      return { ...enemy, pauseUntil };
    }
    if (!target || distance(enemy, target) < 10 || now >= nextWanderAt) {
      patrolIndex = (patrolIndex + 1) % patrolPoints.length;
      target = patrolPoints[patrolIndex];
      pauseUntil = now + 900 + Math.random() * 1900;
      nextWanderAt = now + 6500 + Math.random() * 2500;
    }
  } else if (!target || distance(enemy, target) < 10 || now >= nextWanderAt) {
    patrolIndex = (patrolIndex + 1) % patrolPoints.length;
    target = patrolPoints[patrolIndex];
    nextWanderAt = now + 9000 + Math.random() * 3000;
  }

  const toTargetX = target.x - enemy.x;
  const toTargetY = target.y - enemy.y;
  const length = Math.hypot(toTargetX, toTargetY) || 1;
  const speedMultiplier = mode === 'sentinel' ? 0.24 : mode === 'roam-pause' ? 0.52 : 0.78;
  const wanderSpeed = (isBoss ? ENEMY.wanderSpeed * 0.65 : ENEMY.wanderSpeed) * speedMultiplier;
  const movement = moveEnemyWithCollision(
    enemy,
    enemy.x + (toTargetX / length) * wanderSpeed * delta,
    enemy.y + (toTargetY / length) * wanderSpeed * delta,
    bounds,
  );

  return {
    ...enemy,
    wanderTarget: target,
    patrolIndex,
    pauseUntil,
    nextWanderAt: movement.blocked ? Math.min(nextWanderAt, now + 600) : nextWanderAt,
    x: movement.x,
    y: movement.y,
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

function createEnemy(id, spawnObject, fallbackPosition, spawnSlot = 0, maxAlive = getSpawnMaxAlive(spawnObject)) {
  const mapId = normalizeMapId(spawnObject?.mapId ?? spawnObject?.props?.mapId ?? fallbackPosition?.mapId ?? MAP_IDS.WORLD);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition);
  const enemyKind = getSpawnEnemyType(spawnObject);
  const stats = getEnemyKindStats(enemyKind);
  const movement = makeEnemyMovementState(spawnObject, spawnBounds, spawnSlot, maxAlive, stats.radius, mapId);
  const spawnPoint = movement.home;
  const mapBounds = getMapPixelBounds(mapId);

  return {
    id: String(id),
    type: 'enemy',
    enemyKind,
    spriteId: enemyKind,
    mapId,
    instanceId: null,
    name: stats.name,
    spawnName: spawnObject?.name,
    spawnId: getSpawnPackId(spawnObject),
    spawnSlot,
    spawnBounds,
    ...movement,
    x: clamp(spawnPoint.x, stats.radius, mapBounds.width - stats.radius),
    y: clamp(spawnPoint.y, stats.radius, mapBounds.height - stats.radius),
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    xp: stats.xp,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createBoss(id, spawnObject, fallbackPosition) {
  const mapId = normalizeMapId(spawnObject?.mapId ?? spawnObject?.props?.mapId ?? fallbackPosition?.mapId ?? MAP_IDS.WORLD);
  const bossType = normalizeEnemyKind(
    spawnObject?.props?.bossType
      ?? spawnObject?.props?.enemyType
      ?? spawnObject?.name
      ?? 'elder-briarheart',
  );
  const stats = getBossKindStats(bossType);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition, 620);
  const spawnPoint = findOpenSpawnPoint(mapId, spawnBounds, 0, 1, stats.radius);
  const mapBounds = getMapPixelBounds(mapId);

  return {
    id: String(id),
    type: 'boss',
    mapId,
    instanceId: null,
    bossType,
    questKind: spawnObject?.props?.enemyType ? normalizeEnemyKind(spawnObject.props.enemyType) : bossType,
    spriteId: bossType,
    name: spawnObject?.props?.displayName ?? stats.name,
    spawnName: spawnObject?.name,
    spawnId: getSpawnPackId(spawnObject),
    spawnSlot: 0,
    spawnBounds,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: 0,
    x: clamp(spawnPoint.x, stats.radius, mapBounds.width - stats.radius),
    y: clamp(spawnPoint.y, stats.radius, mapBounds.height - stats.radius),
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    xp: stats.xp,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createDungeonEnemy(id, spawnObject, instanceId, index) {
  const enemyKind = getSpawnEnemyType(spawnObject);
  const stats = getEnemyKindStats(enemyKind);
  const fallbackPosition = {
    x: Number(spawnObject?.x ?? 640) + Number(spawnObject?.width ?? 260) / 2,
    y: Number(spawnObject?.y ?? 360) + Number(spawnObject?.height ?? 180) / 2,
  };
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition, 260);
  const packPoint = pointForDungeonPackSlot(spawnObject, spawnBounds, index, DUNGEON_PACK_SIZE, stats.radius);
  const spawnPoint = findOpenSpawnPoint(MAP_IDS.DUNGEON_01, spawnBounds, index, DUNGEON_PACK_SIZE, stats.radius, packPoint);

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
    x: clamp(spawnPoint.x, stats.radius, WORLD.width - stats.radius),
    y: clamp(spawnPoint.y, stats.radius, WORLD.height - stats.radius),
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    xp: stats.xp,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createDungeonMiniboss(id, spawnObject, instanceId) {
  const bossType = normalizeEnemyKind(spawnObject?.props?.bossType ?? spawnObject?.props?.enemyType ?? spawnObject?.name ?? 'gloomfang-matriarch');
  const stats = getBossKindStats(bossType);
  const requestedSpawnPoint = {
    x: Number(spawnObject?.x ?? 1450) + Number(spawnObject?.width ?? 0) / 2,
    y: Number(spawnObject?.y ?? 700) + Number(spawnObject?.height ?? 0) / 2,
  };
  const spawnBounds = getSpawnBounds(spawnObject, requestedSpawnPoint, 420);
  const spawnPoint = findOpenSpawnPoint(MAP_IDS.DUNGEON_01, spawnBounds, 0, 1, stats.radius, requestedSpawnPoint);

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
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: 0,
    nextAoEAt: Date.now() + 2200,
    nextLaserAt: Date.now() + 4200,
    x: spawnPoint.x,
    y: spawnPoint.y,
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    xp: stats.xp,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createDungeonFinalBoss(id, spawnObject, instanceId) {
  const bossType = normalizeEnemyKind(spawnObject?.props?.bossType ?? spawnObject?.props?.enemyType ?? spawnObject?.name ?? 'rift-heart');
  const stats = getBossKindStats(bossType);
  const requestedSpawnPoint = {
    x: Number(spawnObject?.x ?? 96) + Number(spawnObject?.width ?? 0) / 2,
    y: Number(spawnObject?.y ?? 590) + Number(spawnObject?.height ?? 0) / 2,
  };
  const spawnBounds = getSpawnBounds(spawnObject, requestedSpawnPoint, 460);
  const spawnPoint = findOpenSpawnPoint(MAP_IDS.DUNGEON_01, spawnBounds, 0, 1, stats.radius, requestedSpawnPoint);

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
    speed: stats.speed,
    xp: stats.xp,
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
    facing: safeNumber(enemy.facing, 0),
    hitAt: safeNumber(enemy.hitAt, 0),
    wobble: safeNumber(enemy.wobble, 0),
    mapId: normalizeMapId(enemy.mapId),
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

    this.onMessage('joinGame', (client, message) => {
      const character = message?.character ?? {};
      const authEmail = getMessageEmail(message);
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
        x: clamp(message?.x ?? 420, PLAYER.radius, WORLD.width - PLAYER.radius),
        y: clamp(message?.y ?? 420, PLAYER.radius, WORLD.height - PLAYER.radius),
        facing: safeNumber(message?.facing, 0),
        hp: clamp(message?.hp ?? message?.maxHp ?? 100, 0, Math.max(1, safeNumber(message?.maxHp, 100))),
        maxHp: Math.max(1, safeNumber(message?.maxHp, 100)),
        mapId: normalizeMapId(message?.mapId),
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
      const requestedMapId = normalizeMapId(message?.mapId ?? player.mapId);
      const requestedMapBounds = getMapPixelBounds(requestedMapId);
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
      target.x = clamp(healer.x + 34, PLAYER.radius, WORLD.width - PLAYER.radius);
      target.y = clamp(healer.y + 18, PLAYER.radius, WORLD.height - PLAYER.radius);
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
    this.enemies = this.enemies.map((enemy) => (
      enemy.targetPlayerId === client.sessionId ? { ...enemy, state: 'idle', targetPlayerId: null } : enemy
    ));
    if (oldPartyId) this.normalizeParty(oldPartyId);
    this.resetEmptyDungeonInstances();
  }

  getPartyMembers(partyId) {
    if (!partyId) return [];
    return [...this.players.values()].filter((player) => player.partyId === partyId);
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
        this.enemies = this.enemies.map((enemy) => (
          enemy.targetPlayerId === sessionId ? { ...enemy, state: 'idle', targetPlayerId: null } : enemy
        ));
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
    this.ensureDungeonInstance(player.instanceId);
  }

  isAuthorizedAdminRequest(player, message) {
    if (!player?.isAdmin) return false;
    const requestEmail = getMessageEmail(message);
    return !requestEmail || requestEmail === player.email;
  }

  ensureDungeonInstance(instanceId) {
    if (!instanceId) return;
    this.refreshSpawnDataIfChanged();
    const existingInstance = this.dungeonInstances.get(instanceId);
    if (existingInstance) {
      existingInstance.resetAt = 0;
      return;
    }
    this.dungeonInstances.set(instanceId, { resetAt: 0, createdAt: Date.now() });

    this.spawnData.dungeonPacks.forEach((pack, packIndex) => {
      for (let index = 0; index < DUNGEON_PACK_SIZE; index += 1) {
        this.enemies.push(createDungeonEnemy(this.nextEnemyId, pack, instanceId, index));
        this.nextEnemyId += 1;
      }
    });

    this.spawnData.dungeonMinibosses.forEach((spawn) => {
      this.enemies.push(createDungeonMiniboss(this.nextEnemyId, spawn, instanceId));
      this.nextEnemyId += 1;
    });

    this.spawnData.dungeonFinalBosses.forEach((spawn) => {
      this.enemies.push(createDungeonFinalBoss(this.nextEnemyId, spawn, instanceId));
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
    if (mapId !== MAP_IDS.DUNGEON_01 && otherMapId !== MAP_IDS.DUNGEON_01) return true;
    return a.instanceId && a.instanceId === b.instanceId;
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
        this.enemies.push(createEnemy(this.nextEnemyId, pack.spawn, fallbackPlayer, slotIndex, pack.maxAlive));
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
        this.enemies.push(createEnemy(this.nextEnemyId, pack.spawn, fallbackPlayer, openSlot, pack.maxAlive));
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

    this.enemies = this.enemies.map((enemy) => {
      let targetPlayer = enemy.targetPlayerId ? this.players.get(enemy.targetPlayerId) : null;
      if ((!targetPlayer || !this.canShareSpace(enemy, targetPlayer)) && enemy.state === 'aggro') {
        return { ...enemy, state: 'idle', targetPlayerId: null };
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
        if (canAutoAggro) {
          const aggroRange = enemy.type === 'dungeon_final_boss' ? 480 : this.isBossEnemy(enemy) ? 400 : 320;
          const aggroTarget = this.getPlayersInEnemySpace(enemy)
            .filter((player) => distance(player, enemy) < aggroRange)
            .sort((a, b) => distance(a, enemy) - distance(b, enemy))[0];
          if (aggroTarget) {
            enemy = {
              ...enemy,
              state: 'aggro',
              targetPlayerId: this.findTankTauntTarget(enemy, aggroTarget)?.id ?? aggroTarget.id,
              firstHitPlayerId: enemy.firstHitPlayerId ?? aggroTarget.id,
            };
            targetPlayer = this.players.get(enemy.targetPlayerId) ?? aggroTarget;
          } else {
            return updateIdleEnemyMovement(enemy, now, delta, this.isBossEnemy(enemy));
          }
        } else {
          return updateIdleEnemyMovement(enemy, now, delta, this.isBossEnemy(enemy));
        }
      }

      if (enemy.state !== 'aggro') {
        return updateIdleEnemyMovement(enemy, now, delta, this.isBossEnemy(enemy));
      }

      const toPlayerX = targetPlayer.x - enemy.x;
      const toPlayerY = targetPlayer.y - enemy.y;
      const length = Math.hypot(toPlayerX, toPlayerY) || 1;
      const drift = Math.sin(now / 520 + enemy.wobble) * 0.35;
      const dirX = toPlayerX / length;
      const dirY = toPlayerY / length;
      const attackRange = (enemy.radius ?? ENEMY.radius) + PLAYER.radius + 8;
      const nextAttackAt = enemy.nextAttackAt ?? 0;
      const movementMultiplier = getEnemyMovementMultiplier(enemy, now);

      if (movementMultiplier <= 0) {
        return {
          ...enemy,
          targetX: targetPlayer.x,
          targetY: targetPlayer.y,
        };
      }

      if (length <= attackRange && now >= nextAttackAt) {
        const damage = this.getEnemyAttackDamage(enemy);
        targetPlayer.hp = clamp((targetPlayer.hp ?? targetPlayer.maxHp ?? 100) - damage, 0, targetPlayer.maxHp ?? 100);
        targetPlayer.updatedAt = now;
        const targetClient = this.clients.find((client) => client.sessionId === enemy.targetPlayerId);
        targetClient?.send('hit', { damage });
        return {
          ...enemy,
          nextAttackAt: now + (this.isBossEnemy(enemy) ? 1100 : 850),
        };
      }
      const movement = moveEnemyWithCollision(
        enemy,
        enemy.x + (dirX - dirY * drift) * (enemy.speed ?? ENEMY.speed) * movementMultiplier * delta,
        enemy.y + (dirY + dirX * drift) * (enemy.speed ?? ENEMY.speed) * movementMultiplier * delta,
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
    if (enemy?.type === 'dungeon_final_boss') return 74;
    if (enemy?.type === 'dungeon_miniboss') return 54;
    if (enemy?.type === 'boss') return 28;
    if (enemy?.type === 'dungeon_enemy') return 34;
    return 9;
  }

  getPlayersInEnemySpace(enemy) {
    return [...this.players.values()].filter((player) => this.canShareSpace(enemy, player));
  }

  isTankPlayer(player) {
    return (player?.classId === 'paladin' && player?.talents?.spec === 'aegis')
      || (player?.classId === 'warrior' && player?.talents?.spec === 'ironward');
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
