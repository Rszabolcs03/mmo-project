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

function canMoveTo(tiledWorld, x, y, radius) {
  const points = [
    { x, y },
    { x: x - radius, y },
    { x: x + radius, y },
    { x, y: y - radius },
    { x, y: y + radius },
  ];

  return points.every((point) => !isTileBlocked(tiledWorld, point.x, point.y));
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

function canEnemyMoveTo(tiledWorld, x, y, radius) {
  if (!canMoveTo(tiledWorld, x, y, radius)) return false;
  const collisionObjects = tiledWorld?.map?.layers
    ?.find((layer) => layer.type === 'objectgroup' && layer.name === 'Collision')
    ?.objects ?? [];
  return !collisionObjects.some((object) => pointIntersectsCollisionObject(object, x, y, radius));
}

function moveEnemyWithCollision(tiledWorld, enemy, nextX, nextY, bounds = null) {
  const radius = enemy.radius ?? ENEMY.radius;
  const worldWidth = getTiledWorldPixelWidth(tiledWorld);
  const worldHeight = getTiledWorldPixelHeight(tiledWorld);
  const minX = bounds ? bounds.x + radius : radius;
  const maxX = bounds ? bounds.x + bounds.width - radius : worldWidth - radius;
  const minY = bounds ? bounds.y + radius : radius;
  const maxY = bounds ? bounds.y + bounds.height - radius : worldHeight - radius;
  const targetX = clamp(nextX, minX, maxX);
  const targetY = clamp(nextY, minY, maxY);

  if (canEnemyMoveTo(tiledWorld, targetX, targetY, radius)) {
    return { x: targetX, y: targetY, blocked: false };
  }
  if (canEnemyMoveTo(tiledWorld, targetX, enemy.y, radius)) {
    return { x: targetX, y: enemy.y, blocked: true };
  }
  if (canEnemyMoveTo(tiledWorld, enemy.x, targetY, radius)) {
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
