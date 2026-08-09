import { clamp } from './math';
import {
  WORLD,
  getWorldGenerationIdFromMapId,
  getWorldV2ChunkCoordsFromPoint,
  getWorldV2ChunkId,
  getWorldV2MapIdFromPoint,
} from './world';
import { ENEMY, PLAYER } from './gameData';

function getTiledWorldPixelWidth(tiledWorld) {
  if (tiledWorld?.isRegionWorld || tiledWorld?.isChunkWorld) return tiledWorld.worldPixelWidth;
  const map = tiledWorld?.map;
  return map ? map.width * map.tilewidth : WORLD.width;
}

function getTiledWorldPixelHeight(tiledWorld) {
  if (tiledWorld?.isRegionWorld || tiledWorld?.isChunkWorld) return tiledWorld.worldPixelHeight;
  const map = tiledWorld?.map;
  return map ? map.height * map.tileheight : WORLD.height;
}

function isTileBlocked(tiledWorld, x, y) {
  if (tiledWorld?.isChunkWorld) {
    if (x < 0 || y < 0 || x >= tiledWorld.worldPixelWidth || y >= tiledWorld.worldPixelHeight) return true;
    const chunkCoords = getWorldV2ChunkCoordsFromPoint(x, y);
    const chunkId = getWorldV2ChunkId(chunkCoords.chunkX, chunkCoords.chunkY);
    const chunk = tiledWorld.loadedChunkMap?.get(chunkId);
    if (!chunk?.map) return true;
    const collisionLayer = chunk.map.layers.find((layer) => layer.name === 'Collision');
    if (!collisionLayer?.data) return false;
    const localX = x - chunk.offsetX;
    const localY = y - chunk.offsetY;
    if (localX < 0 || localY < 0 || localX >= chunk.map.width * chunk.map.tilewidth || localY >= chunk.map.height * chunk.map.tileheight) return true;
    const col = Math.floor(localX / chunk.map.tilewidth);
    const row = Math.floor(localY / chunk.map.tileheight);
    return Boolean(collisionLayer.data[row * collisionLayer.width + col]);
  }

  if (tiledWorld?.isRegionWorld) {
    if (x < 0 || y < 0 || x >= tiledWorld.worldPixelWidth || y >= tiledWorld.worldPixelHeight) return true;
    const generationId = tiledWorld.worldGenerationId ?? getWorldGenerationIdFromMapId(tiledWorld.mapId);
    const regionMapId = getWorldV2MapIdFromPoint(x, y, generationId);
    const region = tiledWorld.loadedRegionMap?.get(regionMapId);
    if (!region?.map) return true;
    const collisionLayer = region.map.layers.find((layer) => layer.name === 'Collision');
    if (!collisionLayer?.data) return false;
    const localX = x - region.offsetX;
    const localY = y - region.offsetY;
    if (localX < 0 || localY < 0 || localX >= region.map.width * region.map.tilewidth || localY >= region.map.height * region.map.tileheight) return true;
    const col = Math.floor(localX / region.map.tilewidth);
    const row = Math.floor(localY / region.map.tileheight);
    return Boolean(collisionLayer.data[row * collisionLayer.width + col]);
  }

  const map = tiledWorld?.map;
  const collisionLayer = map?.layers.find((layer) => layer.name === 'Collision');
  if (!map || !collisionLayer?.data) return false;
  if (x < 0 || y < 0 || x >= map.width * map.tilewidth || y >= map.height * map.tileheight) return true;

  const col = Math.floor(x / map.tilewidth);
  const row = Math.floor(y / map.tileheight);
  return Boolean(collisionLayer.data[row * collisionLayer.width + col]);
}

function getLayerProps(layer) {
  if (layer?.props && typeof layer.props === 'object') return layer.props;
  if (Array.isArray(layer?.properties)) {
    return Object.fromEntries(layer.properties.map((property) => [property.name, property.value]));
  }
  return {};
}

function normalizeInteriorCollisionId(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized || ['none', 'null', 'outside', 'overworld'].includes(normalized.toLowerCase())) return null;
  return normalized;
}

function isInteriorCollisionLayer(layer) {
  const name = String(layer?.name ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  const props = getLayerProps(layer);
  const layerType = String(props.type ?? props.kind ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  return ['interiorcollision', 'interior_collision', 'cavecollision', 'cave_collision', 'cavecollisions', 'cave_collisions'].includes(name)
    || ['interiorcollision', 'interior_collision', 'cavecollision', 'cave_collision'].includes(layerType)
    || props.collision === true;
}

function isInteriorWalkableLayer(layer) {
  const name = String(layer?.name ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  const props = getLayerProps(layer);
  const layerType = String(props.type ?? props.kind ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  return ['caveinteriors', 'cave_interiors', 'caveentrances', 'cave_entrances', 'cityinteriors', 'city_interiors', 'interiors', 'interior_floor'].includes(name)
    || ['caveinterior', 'cave_interior', 'caveentrance', 'cave_entrance', 'cityinterior', 'city_interior', 'interior_floor'].includes(layerType);
}

function interiorCollisionLayerMatches(layer, activeInteriorId) {
  const normalizedInteriorId = normalizeInteriorCollisionId(activeInteriorId);
  if (!normalizedInteriorId || !isInteriorCollisionLayer(layer)) return false;
  const props = getLayerProps(layer);
  const layerInteriorId = normalizeInteriorCollisionId(props.interiorId ?? props.caveId ?? props.targetInteriorId);
  return !layerInteriorId || layerInteriorId === normalizedInteriorId;
}

function interiorWalkableLayerMatches(layer, activeInteriorId) {
  const normalizedInteriorId = normalizeInteriorCollisionId(activeInteriorId);
  if (!normalizedInteriorId || !isInteriorWalkableLayer(layer)) return false;
  const props = getLayerProps(layer);
  const layerInteriorId = normalizeInteriorCollisionId(props.interiorId ?? props.caveId ?? props.targetInteriorId);
  return !layerInteriorId || layerInteriorId === normalizedInteriorId;
}

function isTileBlockedInLayer(layer, map, localX, localY) {
  if (!layer?.data || !map) return false;
  if (localX < 0 || localY < 0 || localX >= map.width * map.tilewidth || localY >= map.height * map.tileheight) return false;
  const col = Math.floor(localX / map.tilewidth);
  const row = Math.floor(localY / map.tileheight);
  return Boolean(layer.data[row * layer.width + col]);
}

function getRegionAtPoint(tiledWorld, x, y) {
  const generationId = tiledWorld.worldGenerationId ?? getWorldGenerationIdFromMapId(tiledWorld.mapId);
  const regionMapId = getWorldV2MapIdFromPoint(x, y, generationId);
  return tiledWorld.loadedRegionMap?.get(regionMapId) ?? null;
}

function isInteriorTileBlocked(tiledWorld, x, y, activeInteriorId) {
  if (!normalizeInteriorCollisionId(activeInteriorId)) return false;

  if (tiledWorld?.isChunkWorld) {
    const chunkCoords = getWorldV2ChunkCoordsFromPoint(x, y);
    const chunkId = getWorldV2ChunkId(chunkCoords.chunkX, chunkCoords.chunkY);
    const chunk = tiledWorld.loadedChunkMap?.get(chunkId);
    if (!chunk?.map) return false;
    const localX = x - chunk.offsetX;
    const localY = y - chunk.offsetY;
    return chunk.map.layers
      .filter((layer) => layer.type === 'tilelayer' && interiorCollisionLayerMatches(layer, activeInteriorId))
      .some((layer) => isTileBlockedInLayer(layer, chunk.map, localX, localY));
  }

  if (tiledWorld?.isRegionWorld) {
    const region = getRegionAtPoint(tiledWorld, x, y);
    if (!region?.map) return false;
    const localX = x - region.offsetX;
    const localY = y - region.offsetY;
    return region.map.layers
      .filter((layer) => layer.type === 'tilelayer' && interiorCollisionLayerMatches(layer, activeInteriorId))
      .some((layer) => isTileBlockedInLayer(layer, region.map, localX, localY));
  }

  const map = tiledWorld?.map;
  return (map?.layers ?? [])
    .filter((layer) => layer.type === 'tilelayer' && interiorCollisionLayerMatches(layer, activeInteriorId))
    .some((layer) => isTileBlockedInLayer(layer, map, x, y));
}

function isInteriorWalkableTile(tiledWorld, x, y, activeInteriorId) {
  if (!normalizeInteriorCollisionId(activeInteriorId)) return true;

  if (tiledWorld?.isChunkWorld) {
    const chunkCoords = getWorldV2ChunkCoordsFromPoint(x, y);
    const chunkId = getWorldV2ChunkId(chunkCoords.chunkX, chunkCoords.chunkY);
    const chunk = tiledWorld.loadedChunkMap?.get(chunkId);
    if (!chunk?.map) return false;
    const localX = x - chunk.offsetX;
    const localY = y - chunk.offsetY;
    return chunk.map.layers
      .filter((layer) => layer.type === 'tilelayer' && interiorWalkableLayerMatches(layer, activeInteriorId))
      .some((layer) => isTileBlockedInLayer(layer, chunk.map, localX, localY));
  }

  if (tiledWorld?.isRegionWorld) {
    const region = getRegionAtPoint(tiledWorld, x, y);
    if (!region?.map) return false;
    const localX = x - region.offsetX;
    const localY = y - region.offsetY;
    return region.map.layers
      .filter((layer) => layer.type === 'tilelayer' && interiorWalkableLayerMatches(layer, activeInteriorId))
      .some((layer) => isTileBlockedInLayer(layer, region.map, localX, localY));
  }

  const map = tiledWorld?.map;
  return (map?.layers ?? [])
    .filter((layer) => layer.type === 'tilelayer' && interiorWalkableLayerMatches(layer, activeInteriorId))
    .some((layer) => isTileBlockedInLayer(layer, map, x, y));
}

function getInteriorCollisionObjects(tiledWorld, activeInteriorId) {
  if (!normalizeInteriorCollisionId(activeInteriorId)) return [];
  const getLayerObjects = (map, offsetX = 0, offsetY = 0) => (map?.layers ?? [])
    .filter((layer) => layer.type === 'objectgroup' && interiorCollisionLayerMatches(layer, activeInteriorId))
    .flatMap((layer) => (layer.objects ?? []).map((object) => ({
      ...object,
      x: (object.x ?? 0) + offsetX,
      y: (object.y ?? 0) + offsetY,
    })));

  if (tiledWorld?.isChunkWorld) {
    return [...(tiledWorld.loadedChunkMap?.values() ?? [])].flatMap((chunk) => getLayerObjects(chunk.map, chunk.offsetX, chunk.offsetY));
  }
  if (tiledWorld?.isRegionWorld) {
    return [...(tiledWorld.loadedRegionMap?.values() ?? [])].flatMap((region) => getLayerObjects(region.map, region.offsetX, region.offsetY));
  }
  return getLayerObjects(tiledWorld?.map);
}

function canMoveTo(tiledWorld, x, y, radius, options = {}) {
  const activeInteriorId = normalizeInteriorCollisionId(options.activeInteriorId);
  const points = [
    { x, y },
    { x: x - radius, y },
    { x: x + radius, y },
    { x, y: y - radius },
    { x, y: y + radius },
  ];

  if (!options.ignoreWorldCollision && points.some((point) => isTileBlocked(tiledWorld, point.x, point.y))) return false;
  if (activeInteriorId && points.some((point) => !isInteriorWalkableTile(tiledWorld, point.x, point.y, activeInteriorId))) return false;
  if (activeInteriorId && points.some((point) => isInteriorTileBlocked(tiledWorld, point.x, point.y, activeInteriorId))) return false;
  return !getInteriorCollisionObjects(tiledWorld, activeInteriorId)
    .some((object) => pointIntersectsCollisionObject(object, x, y, radius));
}

function findOpenPointNear(tiledWorld, origin, radius = PLAYER.radius) {
  const map = tiledWorld?.map;
  if (!map) return { x: origin?.x ?? 420, y: origin?.y ?? 420 };
  const worldWidth = getTiledWorldPixelWidth(tiledWorld);
  const worldHeight = getTiledWorldPixelHeight(tiledWorld);
  const maxX = worldWidth - radius;
  const maxY = worldHeight - radius;
  const start = {
    x: clamp(origin?.x ?? worldWidth / 2, radius, maxX),
    y: clamp(origin?.y ?? worldHeight / 2, radius, maxY),
  };
  if (canMoveTo(tiledWorld, start.x, start.y, radius)) return start;

  for (let distanceToCheck = 48; distanceToCheck <= 640; distanceToCheck += 48) {
    for (let step = 0; step < 16; step += 1) {
      const angle = (Math.PI * 2 * step) / 16;
      const candidate = {
        x: clamp(start.x + Math.cos(angle) * distanceToCheck, radius, maxX),
        y: clamp(start.y + Math.sin(angle) * distanceToCheck, radius, maxY),
      };
      if (canMoveTo(tiledWorld, candidate.x, candidate.y, radius)) return candidate;
    }
  }

  return start;
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

function canEnemyMoveTo(tiledWorld, x, y, radius, options = {}) {
  if (!canMoveTo(tiledWorld, x, y, radius, options)) return false;
  const collisionObjects = tiledWorld?.map?.layers
    ?.find((layer) => layer.type === 'objectgroup' && layer.name === 'Collision')
    ?.objects ?? [];
  return !collisionObjects.some((object) => pointIntersectsCollisionObject(object, x, y, radius));
}

function moveEnemyWithCollision(tiledWorld, enemy, nextX, nextY, bounds = null) {
  const radius = enemy.radius ?? ENEMY.radius;
  const interiorId = normalizeInteriorCollisionId(enemy?.interiorId);
  const collisionOptions = interiorId ? { activeInteriorId: interiorId, ignoreWorldCollision: true } : {};
  const worldWidth = getTiledWorldPixelWidth(tiledWorld);
  const worldHeight = getTiledWorldPixelHeight(tiledWorld);
  const movementBounds = bounds ?? (interiorId ? enemy.spawnBounds : null);
  const minX = movementBounds ? movementBounds.x + radius : radius;
  const maxX = movementBounds ? movementBounds.x + movementBounds.width - radius : worldWidth - radius;
  const minY = movementBounds ? movementBounds.y + radius : radius;
  const maxY = movementBounds ? movementBounds.y + movementBounds.height - radius : worldHeight - radius;
  const targetX = clamp(nextX, minX, maxX);
  const targetY = clamp(nextY, minY, maxY);

  if (canEnemyMoveTo(tiledWorld, targetX, targetY, radius, collisionOptions)) {
    return { x: targetX, y: targetY, blocked: false };
  }
  if (canEnemyMoveTo(tiledWorld, targetX, enemy.y, radius, collisionOptions)) {
    return { x: targetX, y: enemy.y, blocked: true };
  }
  if (canEnemyMoveTo(tiledWorld, enemy.x, targetY, radius, collisionOptions)) {
    return { x: enemy.x, y: targetY, blocked: true };
  }
  return { x: enemy.x, y: enemy.y, blocked: true };
}

export {
  getTiledWorldPixelWidth,
  getTiledWorldPixelHeight,
  isTileBlocked,
  canMoveTo,
  findOpenPointNear,
  pointIntersectsCollisionObject,
  canEnemyMoveTo,
  moveEnemyWithCollision,
};
