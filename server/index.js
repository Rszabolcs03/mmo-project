import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Room, Server } from 'colyseus';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const WORLD = {
  width: 6400,
  height: 6400,
};

const MAP_IDS = {
  WORLD: 'world',
  DUNGEON_01: 'dungeon_01',
};

const PLAYER = {
  radius: 18,
};

const ENEMY = {
  maxCount: 12,
  radius: 17,
  speed: 82,
  spawnEvery: 1800,
  wanderSpeed: 34,
};

const WORLD_BROADCAST_MS = 50;
const PARTY_INVITE_COOLDOWN_MS = 8000;

const ENEMY_XP = 35;
const BOSS_XP = 180;
const BOSS_SPAWN_MIN = 18000;
const BOSS_SPAWN_MAX = 34000;
const BOSS_RESPAWN_DELAY = 60000;
const DUNGEON_PACK_SIZE = 5;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point, start, end) {
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

function loadMapObjectLayers(fileName) {
  const mapPath = path.join(rootDir, 'public', 'maps', fileName);
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  return (map.layers ?? []).filter((layer) => layer.type === 'objectgroup');
}

function readObjects(objectLayers, layerName) {
  return objectLayers
    .find((layer) => layer.name === layerName)
    ?.objects
    ?.map((object) => ({ ...object, props: getProperties(object) })) ?? [];
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
    const worldLayers = loadMapObjectLayers('world.tmj');
    const dungeonLayers = loadMapObjectLayers('dungeon_01.tmj');
    const worldSpawnsLayer = worldLayers.find((layer) => layer.name === 'Spawns');
    const worldBossSpawnsLayer = worldLayers.find((layer) => layer.name === 'BossSpawns');
    const spawns = [
      ...(worldSpawnsLayer?.objects ?? []),
      ...(worldBossSpawnsLayer?.objects ?? []),
    ].map((spawn) => ({ ...spawn, props: getProperties(spawn) }));
    const dungeonSpawns = readObjects(dungeonLayers, 'Spawns');
    const worldBossSpawns = spawns.filter((spawn) => (
      spawn.props.bossType || objectHasAnyTag(spawn, ['boss'])
    ));
    const worldEnemySpawns = spawns.filter((spawn) => (
      !worldBossSpawns.includes(spawn)
      && (spawn.props.enemyType || objectHasAnyTag(spawn, ['spawn', 'mob', 'mobs', 'enemy']))
    ));
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
    console.warn('Map spawns could not be loaded, using fallback spawns:', error.message);
    return {
      enemySpawns: [{ x: 720, y: 520, width: 420, height: 320, name: 'fallback_spawn' }],
      bossSpawns: [{ x: 1200, y: 720, width: 520, height: 420, name: 'fallback_boss' }],
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
  return String(spawnObject?.props?.spawnId ?? spawnObject?.name ?? spawnObject?.id ?? fallbackId);
}

function getSpawnEnemyType(spawnObject) {
  const spawnName = String(spawnObject?.name ?? '').toLowerCase();
  return String(spawnObject?.props?.enemyType ?? (spawnName.includes('desert') ? 'scarab' : 'wolf')).toLowerCase();
}

function getSpawnMaxAlive(spawnObject) {
  return Math.max(1, Math.floor(numberProp(spawnObject, 'maxAlive', ENEMY.maxCount)));
}

function getSpawnRespawnMin(spawnObject) {
  return Math.max(1000, numberProp(spawnObject, 'respawnMin', ENEMY.spawnEvery));
}

function getSpawnRespawnMax(spawnObject) {
  return Math.max(getSpawnRespawnMin(spawnObject), numberProp(spawnObject, 'respawnMax', getSpawnRespawnMin(spawnObject)));
}

function getSpawnRespawnDelay(spawnObject) {
  const min = getSpawnRespawnMin(spawnObject);
  const max = getSpawnRespawnMax(spawnObject);
  return min + Math.random() * (max - min);
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

function makeEnemyMovementState(spawnObject, bounds, slotIndex, maxAlive, radius = ENEMY.radius) {
  const home = clampPointToBounds(pointForSpawnSlot(bounds, slotIndex, maxAlive), bounds, radius);
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

  return {
    ...enemy,
    wanderTarget: target,
    patrolIndex,
    pauseUntil,
    nextWanderAt,
    x: clamp(enemy.x + (toTargetX / length) * wanderSpeed * delta, bounds.x + radius, bounds.x + bounds.width - radius),
    y: clamp(enemy.y + (toTargetY / length) * wanderSpeed * delta, bounds.y + radius, bounds.y + bounds.height - radius),
  };
}

function createWorldSpawnPacks(spawns) {
  const sourceSpawns = spawns.length
    ? spawns
    : [{ x: 720, y: 520, width: 420, height: 320, name: 'fallback_spawn' }];

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

function nextBossDelay() {
  return BOSS_SPAWN_MIN + Math.random() * (BOSS_SPAWN_MAX - BOSS_SPAWN_MIN);
}

function createEnemy(id, spawnObject, fallbackPosition, spawnSlot = 0, maxAlive = getSpawnMaxAlive(spawnObject)) {
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition);
  const enemyKind = getSpawnEnemyType(spawnObject);
  const movement = makeEnemyMovementState(spawnObject, spawnBounds, spawnSlot, maxAlive, ENEMY.radius);
  const spawnPoint = movement.home;

  return {
    id: String(id),
    type: 'enemy',
    enemyKind,
    mapId: MAP_IDS.WORLD,
    instanceId: null,
    name: enemyKind === 'scarab' ? 'Glass Scarab' : 'Wolf',
    spawnName: spawnObject?.name,
    spawnId: getSpawnPackId(spawnObject),
    spawnSlot,
    spawnBounds,
    ...movement,
    x: clamp(spawnPoint.x, ENEMY.radius, WORLD.width - ENEMY.radius),
    y: clamp(spawnPoint.y, ENEMY.radius, WORLD.height - ENEMY.radius),
    radius: ENEMY.radius,
    hp: 100,
    maxHp: 100,
    speed: ENEMY.speed,
    xp: ENEMY_XP,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createBoss(id, spawnObject, fallbackPosition) {
  const spawnPoint = randomPointInObject(spawnObject, fallbackPosition);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition, 620);

  return {
    id: String(id),
    type: 'boss',
    mapId: MAP_IDS.WORLD,
    instanceId: null,
    name: 'Elder Briarheart',
    spawnName: spawnObject?.name,
    spawnBounds,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: 0,
    x: clamp(spawnPoint.x, 42, WORLD.width - 42),
    y: clamp(spawnPoint.y, 42, WORLD.height - 42),
    radius: 42,
    hp: 620,
    maxHp: 620,
    speed: 58,
    xp: BOSS_XP,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createDungeonEnemy(id, spawnObject, instanceId, index) {
  const fallbackPosition = {
    x: Number(spawnObject?.x ?? 640) + Number(spawnObject?.width ?? 260) / 2,
    y: Number(spawnObject?.y ?? 360) + Number(spawnObject?.height ?? 180) / 2,
  };
  const spawnPoint = randomPointInObject(spawnObject, fallbackPosition);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition, 260);

  return {
    id: `dungeon-${instanceId}-${id}`,
    type: 'dungeon_enemy',
    mapId: MAP_IDS.DUNGEON_01,
    instanceId,
    name: 'Cave Stalker',
    packIndex: index,
    spawnName: spawnObject?.name,
    spawnBounds,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: 0,
    x: clamp(spawnPoint.x, ENEMY.radius, WORLD.width - ENEMY.radius),
    y: clamp(spawnPoint.y, ENEMY.radius, WORLD.height - ENEMY.radius),
    radius: 18,
    hp: 185,
    maxHp: 185,
    speed: 76,
    xp: 55,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createDungeonMiniboss(id, spawnObject, instanceId) {
  const spawnPoint = {
    x: Number(spawnObject?.x ?? 1450),
    y: Number(spawnObject?.y ?? 700),
  };
  const spawnBounds = getSpawnBounds(spawnObject, spawnPoint, 420);

  return {
    id: `dungeon-${instanceId}-${id}`,
    type: 'dungeon_miniboss',
    mapId: MAP_IDS.DUNGEON_01,
    instanceId,
    name: 'Stone Warden',
    spawnName: spawnObject?.name,
    spawnBounds,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: 0,
    x: spawnPoint.x,
    y: spawnPoint.y,
    radius: 44,
    hp: 840,
    maxHp: 840,
    speed: 52,
    xp: 260,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createDungeonFinalBoss(id, spawnObject, instanceId) {
  const spawnPoint = {
    x: Number(spawnObject?.x ?? 96),
    y: Number(spawnObject?.y ?? 590),
  };
  const spawnBounds = getSpawnBounds(spawnObject, spawnPoint, 460);

  return {
    id: `dungeon-${instanceId}-${id}`,
    type: 'dungeon_final_boss',
    mapId: MAP_IDS.DUNGEON_01,
    instanceId,
    name: 'Void Gatekeeper',
    spawnName: spawnObject?.name,
    spawnBounds,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: 0,
    nextAoEAt: Date.now() + 3200,
    nextLaserAt: Date.now() + 5200,
    x: spawnPoint.x,
    y: spawnPoint.y,
    radius: 52,
    hp: 1450,
    maxHp: 1450,
    speed: 44,
    xp: 460,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function abilityHitsEnemy(ability, origin, facing, enemy) {
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const hitRadius = (enemy.radius ?? ENEMY.radius) + 7;

  if (ability.type === 'bolt') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * 220, y: origin.y + fy * 220 }) < hitRadius;
  }
  if (ability.type === 'shot') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * 270, y: origin.y + fy * 270 }) < hitRadius - 4;
  }
  if (ability.type === 'trap') {
    return distance(enemy, { x: origin.x + fx * 95, y: origin.y + fy * 95 }) < 58 + hitRadius;
  }
  if (ability.type === 'strike') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * 110, y: origin.y + fy * 110 }) < 44 + hitRadius;
  }
  if (ability.type === 'cleave') {
    const enemyAngle = Math.atan2(enemy.y - origin.y, enemy.x - origin.x);
    return distance(enemy, origin) < 90 + hitRadius && Math.abs(angleDifference(enemyAngle, facing)) < 1.05;
  }
  if (ability.type === 'channel') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * 280, y: origin.y + fy * 280 }) < hitRadius + 3;
  }

  return distance(enemy, origin) < 118 + hitRadius;
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

  return distance(player, origin) < 120;
}

function sameParty(a, b) {
  return Boolean(a?.partyId && b?.partyId && a.partyId === b.partyId);
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
    this.dungeonInstances = new Set();
    this.nextEnemyId = 1;
    this.nextSpawnAt = Date.now() + 800;
    this.nextBossSpawnAt = Date.now() + nextBossDelay();
    this.spawnData = loadTiledSpawns();
    this.worldSpawnPacks = createWorldSpawnPacks(this.spawnData.enemySpawns);

    this.onMessage('joinGame', (client, message) => {
      const character = message?.character ?? {};
      this.players.set(client.sessionId, {
        id: client.sessionId,
        name: character.name ?? 'Adventurer',
        classId: character.classId ?? 'warrior',
        raceId: character.raceId ?? 'human',
        appearance: character.appearance ?? {},
        talents: character.talents ?? { spec: null },
        level: character.level ?? 1,
        x: Number(message?.x ?? 420),
        y: Number(message?.y ?? 420),
        facing: Number(message?.facing ?? 0),
        hp: Number(message?.hp ?? message?.maxHp ?? 100),
        maxHp: Number(message?.maxHp ?? 100),
        mapId: message?.mapId === MAP_IDS.DUNGEON_01 ? MAP_IDS.DUNGEON_01 : MAP_IDS.WORLD,
        instanceId: null,
        partyId: null,
        partyLeaderId: null,
        updatedAt: Date.now(),
      });
      this.updatePlayerInstance(this.players.get(client.sessionId));
    });

    this.onMessage('player', (client, message) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;
      const now = Date.now();
      const previousX = player.x;
      const previousY = player.y;
      const elapsed = Math.max(16, now - (player.updatedAt ?? now));
      player.x = clamp(Number(message?.x ?? player.x), PLAYER.radius, WORLD.width - PLAYER.radius);
      player.y = clamp(Number(message?.y ?? player.y), PLAYER.radius, WORLD.height - PLAYER.radius);
      player.vx = ((player.x - previousX) / elapsed) * 1000;
      player.vy = ((player.y - previousY) / elapsed) * 1000;
      player.facing = Number(message?.facing ?? player.facing);
      player.name = message?.name ?? player.name;
      player.classId = message?.classId ?? player.classId;
      player.raceId = message?.raceId ?? player.raceId;
      player.appearance = message?.appearance ?? player.appearance ?? {};
      player.talents = message?.talents ?? player.talents ?? { spec: null };
      player.level = message?.level ?? player.level;
      player.maxHp = Math.max(1, Number(message?.maxHp ?? player.maxHp ?? 100));
      player.hp = clamp(Number(message?.hp ?? player.hp ?? player.maxHp), 0, player.maxHp);
      player.mapId = message?.mapId === MAP_IDS.DUNGEON_01 ? MAP_IDS.DUNGEON_01 : MAP_IDS.WORLD;
      this.updatePlayerInstance(player);
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

    this.onMessage('resurrect', (client, message) => {
      const healer = this.players.get(client.sessionId);
      const target = this.players.get(message?.targetId);
      if (!healer || !target || target.hp > 0) return;
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
        x: Number(message?.origin?.x ?? player.x),
        y: Number(message?.origin?.y ?? player.y),
      };
      const facing = Number(message?.facing ?? player.facing ?? 0);
      const damage = Number(message?.damage ?? ability.damage ?? 0);
      const healing = Number(message?.healing ?? ability.healing ?? 0);
      const xpAwards = new Map();
      const now = Date.now();

      if (!message?.effectOnly && damage > 0) {
        let defeatedWorldBoss = false;
              const defeatedSpawnRefs = [];
        this.enemies = this.enemies
          .map((enemy) => {
            if (!this.canShareSpace(player, enemy)) return enemy;
            if (!abilityHitsEnemy(ability, origin, facing, enemy)) return enemy;
            const firstHitPlayerId = enemy.firstHitPlayerId ?? client.sessionId;
            const focusTargetId = this.findTankTauntTarget(enemy, player)?.id ?? enemy.targetPlayerId ?? client.sessionId;
            if (enemy.hp - damage <= 0) {
              const previousAward = xpAwards.get(firstHitPlayerId) ?? { amount: 0, bossKills: 0 };
              if (enemy.type === 'boss' && (enemy.mapId ?? MAP_IDS.WORLD) === MAP_IDS.WORLD) {
                defeatedWorldBoss = true;
              }
              if (enemy.type === 'enemy' && (enemy.mapId ?? MAP_IDS.WORLD) === MAP_IDS.WORLD && enemy.spawnId) {
                defeatedSpawnRefs.push({ spawnId: enemy.spawnId, spawnSlot: enemy.spawnSlot });
              }
              xpAwards.set(firstHitPlayerId, {
                amount: previousAward.amount + (enemy.xp ?? ENEMY_XP),
                bossKills: previousAward.bossKills + (this.isBossEnemy(enemy) ? 1 : 0),
              });
            }
            return {
              ...enemy,
              firstHitPlayerId,
              hp: enemy.hp - damage,
              state: 'aggro',
              targetPlayerId: focusTargetId,
              hitAt: now,
            };
          })
          .filter((enemy) => enemy.hp > 0);

        if (defeatedWorldBoss) {
          this.nextBossSpawnAt = now + BOSS_RESPAWN_DELAY;
        }
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
            : ability.type === 'shield' || ability.type === 'heal'
              ? 900
              : 650,
        });
      }

      xpAwards.forEach((award, firstHitPlayerId) => {
        this.awardXpForEnemyKill(firstHitPlayerId, award.amount, award.bossKills);
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

  updatePlayerInstance(player) {
    if (!player) return;
    if (player.mapId !== MAP_IDS.DUNGEON_01) {
      player.instanceId = null;
      return;
    }

    player.instanceId = player.partyId ? `party:${player.partyId}` : `solo:${player.id}`;
    this.ensureDungeonInstance(player.instanceId);
  }

  ensureDungeonInstance(instanceId) {
    if (!instanceId || this.dungeonInstances.has(instanceId)) return;
    this.dungeonInstances.add(instanceId);

    this.spawnData.dungeonPacks.forEach((pack, packIndex) => {
      for (let index = 0; index < DUNGEON_PACK_SIZE; index += 1) {
        this.enemies.push(createDungeonEnemy(this.nextEnemyId, pack, instanceId, packIndex));
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

  resetEmptyDungeonInstances() {
    const activeInstances = new Set(
      [...this.players.values()]
        .filter((player) => player.mapId === MAP_IDS.DUNGEON_01 && player.instanceId)
        .map((player) => player.instanceId),
    );

    this.dungeonInstances.forEach((instanceId) => {
      if (activeInstances.has(instanceId)) return;
      this.dungeonInstances.delete(instanceId);
      this.enemies = this.enemies.filter((enemy) => enemy.instanceId !== instanceId);
      this.hazards = this.hazards.filter((hazard) => hazard.instanceId !== instanceId);
    });
  }

  canShareSpace(a, b) {
    if (!a || !b) return false;
    const mapId = a.mapId ?? MAP_IDS.WORLD;
    const otherMapId = b.mapId ?? MAP_IDS.WORLD;
    if (mapId !== otherMapId) return false;
    if (mapId !== MAP_IDS.DUNGEON_01) return true;
    return a.instanceId && a.instanceId === b.instanceId;
  }

  canSeePlayer(viewer, otherPlayer) {
    if (!viewer || !otherPlayer) return false;
    if (viewer.id === otherPlayer.id) return true;
    return this.canShareSpace(viewer, otherPlayer);
  }

  sendEffectToVisiblePlayers(sourcePlayer, effect) {
    this.clients.forEach((client) => {
      const targetPlayer = this.players.get(client.sessionId);
      if (this.canShareSpace(sourcePlayer, targetPlayer)) {
        client.send('effect', effect);
      }
    });
  }

  scheduleWorldSpawnRespawn(spawnId, now, spawnSlot = null) {
    const pack = this.worldSpawnPacks.get(spawnId);
    if (!pack) return;
    pack.pendingRespawns.push({ at: now + getSpawnRespawnDelay(pack.spawn), slotIndex: spawnSlot });
  }

  updateWorldSpawnPacks(now, fallbackPlayer) {
    this.worldSpawnPacks.forEach((pack) => {
      const aliveEnemies = this.enemies.filter((enemy) => (
        enemy.type === 'enemy'
        && (enemy.mapId ?? MAP_IDS.WORLD) === MAP_IDS.WORLD
        && enemy.spawnId === pack.id
      ));
      let aliveCount = aliveEnemies.length;
      const occupiedSlots = new Set(aliveEnemies.map((enemy) => enemy.spawnSlot).filter((slot) => Number.isFinite(slot)));

      const readySlots = getReadyRespawnSlots(pack, now, occupiedSlots);
      readySlots.forEach((slotIndex) => {
        if (aliveCount >= pack.maxAlive) return;
        this.enemies.push(createEnemy(this.nextEnemyId, pack.spawn, fallbackPlayer, slotIndex, pack.maxAlive));
        this.nextEnemyId += 1;
        aliveCount += 1;
      });

      while (aliveCount + pack.pendingRespawns.length < pack.maxAlive) {
        const openSlot = Array.from({ length: pack.maxAlive }).find((_, index) => !occupiedSlots.has(index));
        if (openSlot == null) break;
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
    const fallbackPlayer = [...this.players.values()].find((player) => player.mapId !== MAP_IDS.DUNGEON_01) ?? { x: 600, y: 480 };

    if (this.players.size > 0) {
      this.updateWorldSpawnPacks(now, fallbackPlayer);
    }

    const bossAlive = this.enemies.some((enemy) => enemy.type === 'boss' && (enemy.mapId ?? MAP_IDS.WORLD) === MAP_IDS.WORLD);
    if (this.players.size > 0 && !bossAlive && now >= this.nextBossSpawnAt) {
      this.enemies.push(createBoss(this.nextEnemyId, pickSpawn(this.spawnData.bossSpawns), fallbackPlayer));
      this.nextEnemyId += 1;
      this.nextBossSpawnAt = Number.POSITIVE_INFINITY;
      this.broadcast('notice', { text: 'Boss spawned: Elder Briarheart' });
    }

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

      return {
        ...enemy,
        x: clamp(
          enemy.x + (dirX - dirY * drift) * (enemy.speed ?? ENEMY.speed) * delta,
          enemy.radius ?? ENEMY.radius,
          WORLD.width - (enemy.radius ?? ENEMY.radius),
        ),
        y: clamp(
          enemy.y + (dirY + dirX * drift) * (enemy.speed ?? ENEMY.speed) * delta,
          enemy.radius ?? ENEMY.radius,
          WORLD.height - (enemy.radius ?? ENEMY.radius),
        ),
      };
    });

    this.updateHazards(now);
  }

  isBossEnemy(enemy) {
    return enemy?.type === 'boss' || enemy?.type === 'dungeon_miniboss' || enemy?.type === 'dungeon_final_boss';
  }

  getEnemyAttackDamage(enemy) {
    if (enemy?.type === 'dungeon_final_boss') return 34;
    if (enemy?.type === 'dungeon_miniboss') return 24;
    if (enemy?.type === 'boss') return 28;
    if (enemy?.type === 'dungeon_enemy') return 14;
    return 9;
  }

  getPlayersInEnemySpace(enemy) {
    return [...this.players.values()].filter((player) => this.canShareSpace(enemy, player));
  }

  isTankPaladin(player) {
    return player?.classId === 'paladin' && player?.talents?.spec === 'aegis';
  }

  findTankTauntTarget(enemy, currentTarget) {
    const players = this.getPlayersInEnemySpace(enemy);
    const partyId = currentTarget?.partyId ?? null;
    const eligibleTanks = players
      .filter((player) => this.isTankPaladin(player))
      .filter((player) => (partyId ? player.partyId === partyId : player.id === currentTarget?.id))
      .filter((player) => distance(player, enemy) < 420);

    if (!eligibleTanks.length) return null;
    return eligibleTanks.sort((a, b) => distance(a, enemy) - distance(b, enemy))[0];
  }

  updateDungeonBossMechanics(enemy, targetPlayer, now) {
    if (enemy.type !== 'dungeon_final_boss') return enemy;
    if (enemy.state !== 'aggro') return enemy;
    const candidates = this.getPlayersInEnemySpace(enemy);
    const target = targetPlayer && this.canShareSpace(enemy, targetPlayer)
      ? targetPlayer
      : candidates[Math.floor(Math.random() * candidates.length)];
    if (!target) return enemy;

    let updatedEnemy = enemy;
    if (now >= (enemy.nextAoEAt ?? 0)) {
      const hazard = {
        id: `aoe-${enemy.id}-${now}`,
        type: 'dungeon_aoe',
        mapId: enemy.mapId,
        instanceId: enemy.instanceId,
        x: target.x,
        y: target.y,
        radius: 92,
        damage: 18,
        expiresAt: now + 2300,
        nextDamageAt: now + 700,
      };
      this.hazards.push(hazard);
      this.sendEffectToVisiblePlayers(enemy, {
        type: 'dungeon_aoe',
        color: '#ef4444',
        x: hazard.x,
        y: hazard.y,
        radius: hazard.radius,
        start: now,
        duration: 2300,
      });
      updatedEnemy = { ...updatedEnemy, nextAoEAt: now + 5000 + Math.random() * 1400 };
    }

    if (now >= (enemy.nextLaserAt ?? 0)) {
      const facing = Math.atan2(target.y - enemy.y, target.x - enemy.x);
      const hazard = {
        id: `laser-${enemy.id}-${now}`,
        type: 'dungeon_laser',
        mapId: enemy.mapId,
        instanceId: enemy.instanceId,
        x: enemy.x,
        y: enemy.y,
        facing,
        length: 520,
        width: 42,
        damage: 24,
        expiresAt: now + 1300,
        nextDamageAt: now + 450,
      };
      this.hazards.push(hazard);
      this.sendEffectToVisiblePlayers(enemy, {
        type: 'dungeon_laser',
        color: '#f43f5e',
        x: hazard.x,
        y: hazard.y,
        facing,
        length: hazard.length,
        width: hazard.width,
        start: now,
        duration: 1300,
      });
      updatedEnemy = { ...updatedEnemy, nextLaserAt: now + 7200 + Math.random() * 1800 };
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
      client.send('world', {
        players: [...this.players.values()].filter((player) => this.canSeePlayer(viewer, player)),
        onlinePlayers: [...this.players.values()].map((player) => ({
          id: player.id,
          name: player.name,
          classId: player.classId,
          level: player.level,
          partyId: player.partyId,
          partyLeaderId: player.partyLeaderId,
        })),
        enemies: this.enemies.filter((enemy) => this.canShareSpace(viewer, enemy)),
        serverTime: Date.now(),
      });
    });
  }

  awardXpForEnemyKill(firstHitPlayerId, amount, bossKills) {
    const owner = this.players.get(firstHitPlayerId);
    if (!owner) return;

    const recipients = [...this.players.values()].filter((player) => (
      (player.id === firstHitPlayerId || sameParty(player, owner)) && this.canShareSpace(player, owner)
    ));

    recipients.forEach((player) => {
      const recipientClient = this.clients.find((client) => client.sessionId === player.id);
      recipientClient?.send('xp', { amount, bossKills });
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
