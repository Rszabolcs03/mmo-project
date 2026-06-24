

import { clamp, safeNumber } from '../game/math';
import {
  WORLD,
  getWorldGenerationIdFromMapId,
  getWorldV2MapIdFromPoint,
  getWorldV2ChunkCoordsFromPoint,
  getWorldV2ChunkId,
} from '../game/world';
import { PLAYER, ENEMY, SHOPKEEPER } from '../game/gameData';

import { hasTileData } from '../game/mapAssets';
import { getNpcDisplayName, getNpcRole, getTamziaNpcPalette } from '../game/worldEntities';
import { getAbilityVisualImage } from './abilityRendering';
import { pixelRect } from './primitives';

function drawTiledLayer(context, layer, tilesets, map, cameraX, cameraY, viewWidth, viewHeight, offsetX = 0, offsetY = 0) {
  if (layer.type !== 'tilelayer' || !hasTileData(layer) || layer.visible === false) return false;

  const localCameraX = cameraX - offsetX;
  const localCameraY = cameraY - offsetY;
  const startCol = Math.max(0, Math.floor(localCameraX / map.tilewidth) - 1);
  const endCol = Math.min(map.width - 1, Math.ceil((localCameraX + viewWidth) / map.tilewidth) + 1);
  const startRow = Math.max(0, Math.floor(localCameraY / map.tileheight) - 1);
  const endRow = Math.min(map.height - 1, Math.ceil((localCameraY + viewHeight) / map.tileheight) + 1);
  if (startCol > endCol || startRow > endRow) return false;

  let drewTile = false;
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const gid = layer.data[row * layer.width + col];
      if (!gid) continue;

      const tileset = [...tilesets].reverse().find((candidate) => gid >= candidate.firstgid);
      if (!tileset) continue;
      if (!tileset.image || !tileset.image.complete || !tileset.image.naturalWidth) continue;

      const localId = gid - tileset.firstgid;
      const sourceX = (localId % tileset.columns) * tileset.tilewidth;
      const sourceY = Math.floor(localId / tileset.columns) * tileset.tileheight;
      if (
        sourceX < 0
        || sourceY < 0
        || sourceX + tileset.tilewidth > tileset.image.naturalWidth
        || sourceY + tileset.tileheight > tileset.image.naturalHeight
      ) {
        continue;
      }
      const targetX = offsetX + col * map.tilewidth;
      const targetY = offsetY + row * map.tileheight;

      if (layer.name === 'Ground') {
        context.fillStyle = gid >= 1300 ? '#7d6b58' : '#89945e';
        context.fillRect(targetX, targetY, map.tilewidth, map.tileheight);
      }

      context.drawImage(
        tileset.image,
        sourceX,
        sourceY,
        tileset.tilewidth,
        tileset.tileheight,
        targetX,
        targetY,
        map.tilewidth,
        map.tileheight,
      );
      drewTile = true;
    }
  }
  return drewTile;
}

function drawTiledWorld(context, tiled, cameraX, cameraY, viewWidth, viewHeight, onLayerError = null, options = {}) {
  if (!tiled) return 0;
  let drawnLayers = 0;
  const activeInteriorZone = options.activeInteriorZone ?? null;
  const isInteriorLayer = (layer) => layer?.name === 'CityInteriors';
  const shouldDrawLayer = (layer) => !isInteriorLayer(layer) || Boolean(activeInteriorZone);
  const shouldFadeLayer = (layer) => options.fadeBuildings && ['Buildings', 'CityRoofs'].includes(layer?.name);
  const clipInteriorLayer = (layer) => {
    if (!isInteriorLayer(layer) || !activeInteriorZone) return true;
    const x = safeNumber(activeInteriorZone.x, 0);
    const y = safeNumber(activeInteriorZone.y, 0);
    const width = safeNumber(activeInteriorZone.width, 0);
    const height = safeNumber(activeInteriorZone.height, 0);
    if (width <= 0 || height <= 0) return false;
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    return true;
  };
  const drawVisibleLayer = (layer, drawLayer) => {
    if (!shouldDrawLayer(layer)) return;
    context.save();
    try {
      if (!clipInteriorLayer(layer)) return;
      if (shouldFadeLayer(layer)) context.globalAlpha = layer.name === 'CityRoofs' ? 0.12 : 0.32;
      if (drawLayer() !== false) drawnLayers += 1;
    } catch (error) {
      onLayerError?.(error, layer);
    } finally {
      context.restore();
    }
  };
  const drawRegionLayer = (region, layer) => {
    drawVisibleLayer(layer, () => {
      return drawTiledLayer(
        context,
        layer,
        region.tilesets,
        region.map,
        cameraX,
        cameraY,
        viewWidth,
        viewHeight,
        region.offsetX,
        region.offsetY,
      );
    });
  };

  if (tiled.isRegionWorld) {
    tiled.loadedRegions.forEach((region) => {
      region.map.layers
        .filter((layer) => layer.type === 'tilelayer' && layer.name !== 'Collision')
        .forEach((layer) => drawRegionLayer(region, layer));
    });
    return drawnLayers;
  }

  tiled.map?.layers
    ?.filter((layer) => layer.type === 'tilelayer' && layer.name !== 'Collision')
    .forEach((layer) => {
      drawVisibleLayer(layer, () => {
        return drawTiledLayer(context, layer, tiled.tilesets, tiled.map, cameraX, cameraY, viewWidth, viewHeight);
      });
    });
  return drawnLayers;
}

function drawTiledZones(context, zones) {
  context.save();
  context.strokeStyle = 'rgba(139, 233, 253, 0.85)';
  context.fillStyle = 'rgba(139, 233, 253, 0.08)';
  context.lineWidth = 3;
  context.font = '800 15px Inter, Arial';
  context.textAlign = 'left';

  zones.forEach((zone) => {
    context.fillRect(zone.x, zone.y, zone.width, zone.height);
    context.strokeRect(zone.x, zone.y, zone.width, zone.height);
    context.fillStyle = '#e0fbff';
    context.fillText(zone.props.displayName ?? zone.name, zone.x + 10, zone.y + 22);
    context.fillStyle = 'rgba(139, 233, 253, 0.08)';
  });

  context.restore();
}

function drawInteriorFocusOverlay(context, zone, worldWidth, worldHeight, now = performance.now()) {
  if (!zone) return;
  const x = Number(zone.x ?? 0);
  const y = Number(zone.y ?? 0);
  const width = Number(zone.width ?? 0);
  const height = Number(zone.height ?? 0);
  if (width <= 0 || height <= 0) return;

  const pulse = 0.45 + Math.sin(now / 420) * 0.08;
  context.save();
  context.fillStyle = 'rgba(4, 8, 13, 0.48)';
  context.beginPath();
  context.rect(0, 0, worldWidth, worldHeight);
  context.rect(x - 18, y - 18, width + 36, height + 36);
  context.fill('evenodd');

  context.fillStyle = 'rgba(246, 241, 223, 0.07)';
  context.fillRect(x, y, width, height);
  context.strokeStyle = `rgba(139, 233, 253, ${pulse})`;
  context.lineWidth = 3;
  context.setLineDash([12, 7]);
  context.strokeRect(x - 4, y - 4, width + 8, height + 8);
  context.restore();
}

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

function findRandomOpenPoint(tiledWorld, radius = PLAYER.radius) {
  const map = tiledWorld?.map;
  if (!map) return { x: 420, y: 420 };
  const worldWidth = getTiledWorldPixelWidth(tiledWorld);
  const worldHeight = getTiledWorldPixelHeight(tiledWorld);
  const maxX = worldWidth - radius;
  const maxY = worldHeight - radius;

  for (let attempt = 0; attempt < 800; attempt += 1) {
    const candidate = {
      x: radius + Math.random() * Math.max(1, maxX - radius),
      y: radius + Math.random() * Math.max(1, maxY - radius),
    };
    if (canMoveTo(tiledWorld, candidate.x, candidate.y, radius)) return candidate;
  }

  return findOpenPointNear(tiledWorld, {
    x: worldWidth / 2,
    y: worldHeight / 2,
  }, radius);
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

function drawShopkeeper(context) {
  drawShopkeeperAt(context, SHOPKEEPER);
}

function drawQuestGiverAt(context, giver, now = performance.now()) {
  context.save();
  context.translate(giver.x, giver.y);

  context.fillStyle = 'rgba(0, 0, 0, 0.24)';
  context.beginPath();
  context.ellipse(0, 18, 18, 7, 0, 0, Math.PI * 2);
  context.fill();

  const image = getAbilityVisualImage('/assets/npcs/quest-giver.png');
  if (image) {
    const frameWidth = 64;
    const frame = Math.floor(now / 180) % Math.max(1, Math.floor(image.naturalWidth / frameWidth));
    context.imageSmoothingEnabled = false;
    context.drawImage(image, frame * frameWidth, 0, frameWidth, 64, -32, -48, 64, 64);
  } else {
    context.fillStyle = '#155e75';
    context.strokeStyle = '#082f49';
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(-13, -8, 26, 31, 7);
    context.fill();
    context.stroke();
    context.fillStyle = '#f0c7a1';
    context.beginPath();
    context.arc(0, -21, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#facc15';
    context.font = '900 18px Inter, Arial';
    context.textAlign = 'center';
    context.fillText('!', 0, -43);
  }

  context.fillStyle = '#facc15';
  context.font = '900 18px Inter, Arial';
  context.textAlign = 'center';
  context.fillText('!', 0, -52);
  context.fillStyle = '#f6f1df';
  context.font = '800 13px Inter, Arial';
  context.fillText(giver.name, 0, -66);
  context.fillStyle = '#8be9fd';
  context.font = '800 11px Inter, Arial';
  context.fillText('Quest Giver', 0, -34);

  context.restore();
}

function drawShopkeeperAt(context, shopkeeper) {
  context.save();
  context.translate(shopkeeper.x, shopkeeper.y);

  context.fillStyle = 'rgba(0, 0, 0, 0.24)';
  context.beginPath();
  context.ellipse(0, 18, 18, 7, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#7c3aed';
  context.strokeStyle = '#1f1235';
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(-13, -8, 26, 31, 7);
  context.fill();
  context.stroke();

  context.fillStyle = '#f0c7a1';
  context.beginPath();
  context.arc(0, -21, 11, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#4b2e1e';
  context.beginPath();
  context.arc(0, -28, 10, Math.PI, Math.PI * 2);
  context.fill();

  context.fillStyle = '#facc15';
  context.font = '900 16px Inter, Arial';
  context.textAlign = 'center';
  context.fillText('$', 0, 10);

  context.fillStyle = '#f6f1df';
  context.font = '800 13px Inter, Arial';
  context.fillText(shopkeeper.name, 0, -42);
  context.fillStyle = '#8be9fd';
  context.font = '800 11px Inter, Arial';
  context.fillText('Shopkeeper', 0, -28);

  context.restore();
}

function drawWantedBoardAt(context, board, now = performance.now()) {
  const x = safeNumber(board?.point ? board.x : board?.x + (board?.width ?? 0) / 2, board?.x ?? 0);
  const y = safeNumber(board?.point ? board.y : board?.y + (board?.height ?? 0) / 2, board?.y ?? 0);
  const pulse = Math.sin(now / 480 + x * 0.01) * 0.5 + 0.5;

  context.save();
  context.translate(Math.round(x), Math.round(y));

  pixelRect(context, -64, 43, 128, 13, 'rgba(0, 0, 0, 0.24)');
  pixelRect(context, -53, -11, 12, 68, '#2b1a12');
  pixelRect(context, 41, -11, 12, 68, '#2b1a12');
  pixelRect(context, -49, -7, 5, 62, '#6b3f25');
  pixelRect(context, 45, -7, 5, 62, '#6b3f25');

  pixelRect(context, -66, -62, 132, 92, '#1f130d');
  pixelRect(context, -61, -57, 122, 82, '#8a5130');
  pixelRect(context, -55, -51, 110, 70, '#6f3f25');
  pixelRect(context, -55, -27, 110, 3, '#4a2819');
  pixelRect(context, -55, -3, 110, 3, '#4a2819');
  pixelRect(context, -61, -57, 122, 5, '#b87945');
  pixelRect(context, -61, 20, 122, 5, '#3a2117');

  pixelRect(context, -51, -72, 102, 22, '#10212c');
  pixelRect(context, -46, -68, 92, 14, '#17364a');
  pixelRect(context, -39, -65, 78, 4, '#d6bd65');
  context.fillStyle = '#f6f1df';
  context.font = '900 12px Inter, Arial';
  context.textAlign = 'center';
  context.fillText('WANTED', 0, -56);

  const notes = [
    [-48, -43, 27, 31, '#f6e7b7', '#7f1d1d'],
    [-13, -45, 26, 36, '#efe0ae', '#1d4ed8'],
    [22, -42, 27, 30, '#f7e8b9', '#7f1d1d'],
    [-39, -5, 31, 20, '#e8d6a2', '#166534'],
    [9, -4, 37, 19, '#f3dfaa', '#7f1d1d'],
  ];
  notes.forEach(([noteX, noteY, noteWidth, noteHeight, paper, seal], index) => {
    pixelRect(context, noteX - 2, noteY - 2, noteWidth + 4, noteHeight + 4, '#2a170f');
    pixelRect(context, noteX, noteY, noteWidth, noteHeight, paper);
    pixelRect(context, noteX + 5, noteY + 6, noteWidth - 10, 3, '#8a6a3f');
    pixelRect(context, noteX + 5, noteY + 13, noteWidth - 14, 3, '#8a6a3f');
    if (noteHeight > 24) pixelRect(context, noteX + 5, noteY + 20, noteWidth - 12, 3, '#8a6a3f');
    pixelRect(context, noteX + noteWidth - 9, noteY + noteHeight - 9, 6, 6, seal);
    if (index < 3) pixelRect(context, noteX + 3, noteY + 2, 5, 5, '#d6bd65');
  });

  pixelRect(context, -66, -62, 9, 9, '#d6bd65');
  pixelRect(context, 57, -62, 9, 9, '#d6bd65');
  pixelRect(context, -66, 21, 9, 9, '#d6bd65');
  pixelRect(context, 57, 21, 9, 9, '#d6bd65');
  pixelRect(context, -8, -48, 16, 5, `rgba(103, 232, 249, ${0.35 + pulse * 0.3})`);
  pixelRect(context, -3, -52, 6, 14, `rgba(103, 232, 249, ${0.22 + pulse * 0.22})`);

  context.restore();
}

function drawTamziaNpcAt(context, npc, now = performance.now()) {
  const x = safeNumber(npc?.point ? npc.x : npc?.x + (npc?.width ?? 0) / 2, npc?.x ?? 0);
  const y = safeNumber(npc?.point ? npc.y : npc?.y + (npc?.height ?? 0) / 2, npc?.y ?? 0);
  const role = getNpcRole(npc);
  const name = getNpcDisplayName(npc);
  const palette = getTamziaNpcPalette(npc);
  const bob = Math.sin(now / 520 + x * 0.01 + y * 0.01) * 1.2;
  const leg = Math.sin(now / 360 + x * 0.02) * 1.5;

  context.save();
  context.translate(Math.round(x), Math.round(y + bob));

  pixelRect(context, -17, 13, 34, 9, 'rgba(0, 0, 0, 0.24)');
  pixelRect(context, -8, 12 + leg, 6, 13, palette.pants);
  pixelRect(context, 2, 12 - leg, 6, 13, palette.pants);
  pixelRect(context, -11, 20 + leg, 9, 5, '#171717');
  pixelRect(context, 2, 20 - leg, 9, 5, '#171717');

  pixelRect(context, -15, -12, 30, 32, '#111827');
  pixelRect(context, -12, -10, 24, 28, palette.coat);
  pixelRect(context, -12, -10, 24, 5, palette.trim);
  pixelRect(context, -3, -10, 6, 28, palette.trim);
  pixelRect(context, -18, -7, 6, 22, palette.coat);
  pixelRect(context, 12, -7, 6, 22, palette.coat);
  pixelRect(context, -17, 12, 5, 6, '#f0c7a1');
  pixelRect(context, 12, 12, 5, 6, '#f0c7a1');

  pixelRect(context, -10, -29, 20, 20, '#8a5f43');
  pixelRect(context, -8, -27, 16, 17, '#f0c7a1');
  pixelRect(context, -10, -31, 20, 8, palette.hair);
  pixelRect(context, -5, -22, 3, 3, '#111827');
  pixelRect(context, 4, -22, 3, 3, '#111827');
  pixelRect(context, -4, -16, 8, 2, '#7c2d12');

  if (role.includes('guard')) {
    pixelRect(context, -13, -35, 26, 5, '#1f2937');
    pixelRect(context, -8, -39, 16, 5, '#94a3b8');
    pixelRect(context, 17, -13, 7, 30, '#94a3b8');
    pixelRect(context, 19, -20, 3, 11, '#e5e7eb');
    pixelRect(context, -25, -2, 10, 18, '#334155');
    pixelRect(context, -23, 0, 6, 14, '#64748b');
  } else if (role.includes('mayor')) {
    pixelRect(context, -7, -38, 14, 8, '#d6bd65');
    pixelRect(context, -3, -43, 6, 6, '#fef3c7');
    pixelRect(context, -9, -1, 18, 4, '#d6bd65');
  } else if (role.includes('banker')) {
    pixelRect(context, -9, -34, 18, 5, '#2f2418');
    pixelRect(context, -14, 0, 9, 11, '#facc15');
    pixelRect(context, -12, 2, 5, 7, '#422006');
  } else if (role.includes('vault')) {
    pixelRect(context, 14, -1, 12, 15, '#475569');
    pixelRect(context, 17, 3, 6, 7, '#111827');
    pixelRect(context, -13, 1, 8, 10, '#d1d5db');
  } else if (role.includes('clerk') || role.includes('assistant')) {
    pixelRect(context, -21, -2, 13, 11, '#f8fafc');
    pixelRect(context, -19, 0, 9, 2, '#94a3b8');
    pixelRect(context, 12, -2, 12, 11, '#6b4b2a');
    pixelRect(context, 14, 0, 8, 3, '#fde68a');
  }

  if (role.includes('quest')) {
    pixelRect(context, -6, -56, 12, 24, '#facc15');
    pixelRect(context, -4, -54, 8, 14, '#7c2d12');
    pixelRect(context, -3, -35, 6, 5, '#7c2d12');
  }

  context.fillStyle = '#f6f1df';
  context.font = '800 12px Inter, Arial';
  context.textAlign = 'center';
  context.fillText(name, 0, -48);
  context.fillStyle = palette.accent;
  context.font = '800 10px Inter, Arial';
  const title = role.includes('quest') ? 'Quest Giver' : role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  context.fillText(title || 'NPC', 0, -35);

  context.restore();
}

export {
  drawTiledLayer,
  drawTiledWorld,
  drawTiledZones,
  drawInteriorFocusOverlay,
  getTiledWorldPixelWidth,
  getTiledWorldPixelHeight,
  isTileBlocked,
  canMoveTo,
  findOpenPointNear,
  findRandomOpenPoint,
  pointIntersectsCollisionObject,
  canEnemyMoveTo,
  moveEnemyWithCollision,
  drawShopkeeper,
  drawQuestGiverAt,
  drawShopkeeperAt,
  drawWantedBoardAt,
  drawTamziaNpcAt,
};
