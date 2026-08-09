

import { clamp, safeNumber } from '../game/math';
import {
  WORLD,
  getWorldGenerationIdFromMapId,
  getWorldV2MapIdFromPoint,
  getWorldV2ChunkCoordsFromPoint,
  getWorldV2ChunkId,
} from '../game/world';
import { PLAYER, ENEMY, SHOPKEEPER } from '../game/gameData';

import { hasTileData, resolveAssetUrl } from '../game/mapAssets';
import { getLampLightState, getLightingForPhase } from '../systems/dayNightSystem';
import { getNpcDisplayName, getNpcRole, getTamziaNpcPalette } from '../game/worldEntities';
import { getAbilityVisualImage } from './abilityRendering';
import { pixelRect } from './primitives';

const STREET_LAMP_TILE_WIDTH = 32;
const STREET_LAMP_TILE_HEIGHT = 64;
const STREET_LAMP_HEAD_OFFSET_Y = 42;
const STREET_LAMP_SPRITES = {
  standard: {
    image: null,
    src: 'assets/tilesets/tamzia_lights_v1.png',
    tileWidth: STREET_LAMP_TILE_WIDTH,
    tileHeight: STREET_LAMP_TILE_HEIGHT,
    headOffsetY: STREET_LAMP_HEAD_OFFSET_Y,
  },
  big: {
    image: null,
    src: 'assets/tilesets/tamzia_lights_large_v1.png',
    tileWidth: 64,
    tileHeight: 128,
    headOffsetY: 84,
  },
};
const TAMZIA_FOUNTAIN_SPRITE = {
  image: null,
  src: 'assets/tilesets/tamzia_fountain_v1.png',
  version: 'tamzia-fountain-v1',
  frameWidth: 176,
  frameHeight: 176,
  frameCount: 6,
  frameDuration: 140,
};
const TAMZIA_FOUNTAIN_GLOW_BY_PHASE = {
  day: 0.025,
  dawn: 0.28,
  evening: 0.46,
  night: 1,
};
const TILED_GID_MASK = 0x1fffffff;

function normalizeTiledGid(rawGid) {
  return Number(rawGid ?? 0) & TILED_GID_MASK;
}

function getTilesetForGid(tilesets = [], gid) {
  return [...tilesets].reverse().find((candidate) => gid >= candidate.firstgid);
}

function getRenderTime(now = null) {
  if (Number.isFinite(now)) return now;
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function getAnimatedTileGid(tileset, gid, now) {
  const localId = gid - tileset.firstgid;
  const animation = tileset.animations?.[localId];
  if (!animation?.frames?.length || !(animation.totalDuration > 0)) return gid;
  const elapsed = getRenderTime(now) % animation.totalDuration;
  let frameTime = 0;
  for (const frame of animation.frames) {
    frameTime += frame.duration;
    if (elapsed < frameTime) return tileset.firstgid + frame.tileid;
  }
  return tileset.firstgid + animation.frames[animation.frames.length - 1].tileid;
}

function getTileSourceRect(tileset, gid) {
  if (!tileset?.image || !tileset.image.complete || !tileset.image.naturalWidth) return null;
  const columns = Math.max(1, safeNumber(tileset.columns, Math.floor(tileset.image.naturalWidth / tileset.tilewidth)));
  const localId = gid - tileset.firstgid;
  const sourceX = (localId % columns) * tileset.tilewidth;
  const sourceY = Math.floor(localId / columns) * tileset.tileheight;
  if (
    sourceX < 0
    || sourceY < 0
    || sourceX + tileset.tilewidth > tileset.image.naturalWidth
    || sourceY + tileset.tileheight > tileset.image.naturalHeight
  ) {
    return null;
  }
  return {
    sourceX,
    sourceY,
    sourceWidth: tileset.tilewidth,
    sourceHeight: tileset.tileheight,
  };
}

function drawTiledLayer(context, layer, tilesets, map, cameraX, cameraY, viewWidth, viewHeight, offsetX = 0, offsetY = 0, now = null) {
  if (layer.type !== 'tilelayer' || !hasTileData(layer) || layer.visible === false) return false;
  const opacity = clamp(safeNumber(layer.opacity, 1), 0, 1);
  if (opacity <= 0) return false;

  const localCameraX = cameraX - offsetX;
  const localCameraY = cameraY - offsetY;
  const startCol = Math.max(0, Math.floor(localCameraX / map.tilewidth) - 1);
  const endCol = Math.min(map.width - 1, Math.ceil((localCameraX + viewWidth) / map.tilewidth) + 1);
  const startRow = Math.max(0, Math.floor(localCameraY / map.tileheight) - 1);
  const endRow = Math.min(map.height - 1, Math.ceil((localCameraY + viewHeight) / map.tileheight) + 1);
  if (startCol > endCol || startRow > endRow) return false;

  let drewTile = false;
  context.save();
  try {
    context.globalAlpha *= opacity;
    for (let row = startRow; row <= endRow; row += 1) {
      for (let col = startCol; col <= endCol; col += 1) {
        const gid = normalizeTiledGid(layer.data[row * layer.width + col]);
        if (!gid) continue;

        const tileset = getTilesetForGid(tilesets, gid);
        if (!tileset) continue;
        const sourceRect = getTileSourceRect(tileset, getAnimatedTileGid(tileset, gid, now));
        if (!sourceRect) continue;
        const targetX = offsetX + col * map.tilewidth;
        const targetY = offsetY + row * map.tileheight;

        if (layer.name === 'Ground') {
          context.fillStyle = gid >= 1300 ? '#7d6b58' : '#89945e';
          context.fillRect(targetX, targetY, map.tilewidth, map.tileheight);
        }

        context.drawImage(
          tileset.image,
          sourceRect.sourceX,
          sourceRect.sourceY,
          sourceRect.sourceWidth,
          sourceRect.sourceHeight,
          targetX,
          targetY,
          map.tilewidth,
          map.tileheight,
        );
        drewTile = true;
      }
    }
  } finally {
    context.restore();
  }
  return drewTile;
}

function drawTiledObjectLayer(context, layer, tilesets, cameraX, cameraY, viewWidth, viewHeight, offsetX = 0, offsetY = 0, now = null) {
  if (layer.type !== 'objectgroup' || layer.visible === false || !Array.isArray(layer.objects)) return false;

  const opacity = clamp(safeNumber(layer.opacity, 1), 0, 1);
  if (opacity <= 0) return false;

  let drewObject = false;
  context.save();
  try {
    context.globalAlpha *= opacity;
    context.imageSmoothingEnabled = false;
    layer.objects.forEach((object) => {
      const gid = normalizeTiledGid(object?.gid);
      if (!gid) return;

      const tileset = getTilesetForGid(tilesets, gid);
      if (!tileset) return;
      const sourceRect = getTileSourceRect(tileset, getAnimatedTileGid(tileset, gid, now));
      if (!sourceRect) return;

      const targetWidth = Math.max(1, safeNumber(object.width, tileset.tilewidth));
      const targetHeight = Math.max(1, safeNumber(object.height, tileset.tileheight));
      const targetX = offsetX + safeNumber(object.x, 0);
      const targetY = offsetY + safeNumber(object.y, 0) - targetHeight;

      if (
        targetX + targetWidth < cameraX
        || targetX > cameraX + viewWidth
        || targetY + targetHeight < cameraY
        || targetY > cameraY + viewHeight
      ) {
        return;
      }

      context.drawImage(
        tileset.image,
        sourceRect.sourceX,
        sourceRect.sourceY,
        sourceRect.sourceWidth,
        sourceRect.sourceHeight,
        Math.round(targetX),
        Math.round(targetY),
        targetWidth,
        targetHeight,
      );
      drewObject = true;
    });
  } finally {
    context.restore();
  }
  return drewObject;
}

function drawTiledWorld(context, tiled, cameraX, cameraY, viewWidth, viewHeight, onLayerError = null, options = {}) {
  if (!tiled) return 0;
  let drawnLayers = 0;
  const activeInteriorZone = options.activeInteriorZone ?? null;
  const activeCaveEntranceZones = options.activeCaveEntranceZones ?? [];
  const renderTime = getRenderTime(options.now);
  const normalizeLayerName = (layer) => String(layer?.name ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const isInteriorLayer = (layer) => {
    const name = normalizeLayerName(layer);
    return [
      'cityinteriors',
      'city_interiors',
      'caveinteriors',
      'cave_interiors',
      'interiordetails',
      'interior_details',
      'cavedetails',
      'cave_details',
      'caveprops',
      'cave_props',
      'interiorprops',
      'interior_props',
    ].includes(name);
  };
  const isCaveRoofLayer = (layer) => ['caveroofs', 'cave_roofs'].includes(normalizeLayerName(layer));
  const isCaveEntranceLayer = (layer) => ['caveentrances', 'cave_entrances'].includes(normalizeLayerName(layer));
  const drawInteriorOnly = Boolean(options.interiorOnly && activeInteriorZone);
  const shouldDrawLayer = (layer) => {
    if (isCaveRoofLayer(layer)) return false;
    if (isCaveEntranceLayer(layer)) return Boolean(activeInteriorZone);
    if (drawInteriorOnly) return isInteriorLayer(layer) || isCaveEntranceLayer(layer);
    return !isInteriorLayer(layer) || Boolean(activeInteriorZone);
  };
  const isCollisionLayer = (layer) => normalizeLayerName(layer).includes('collision');
  const getRoofLayerName = () => String(activeInteriorZone?.props?.roofLayer ?? '').trim();
  const shouldFadeLayer = (layer) => {
    if (!options.fadeBuildings || !activeInteriorZone) return false;
    const roofLayerName = getRoofLayerName();
    if (roofLayerName && layer?.name === roofLayerName) return true;
    return ['Buildings', 'CityRoofs', 'CaveRoofs'].includes(layer?.name);
  };
  const clipInteriorLayer = (layer) => {
    if ((!isInteriorLayer(layer) && !isCaveEntranceLayer(layer)) || !activeInteriorZone) return true;
    context.beginPath();
    const hasInteriorPath = addObjectPath(context, activeInteriorZone);
    activeCaveEntranceZones.forEach((zone) => {
      addObjectPath(context, zone);
      addCaveConnectorPath(context, getCaveConnector(activeInteriorZone, zone));
    });
    if (!hasInteriorPath) return false;
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
  const drawMapLayer = (layer, tilesets, map, offsetX = 0, offsetY = 0) => {
    if (isCollisionLayer(layer)) return false;
    const drawableLayer = (isInteriorLayer(layer) || isCaveEntranceLayer(layer)) ? { ...layer, visible: true } : layer;
    if (drawableLayer.type === 'tilelayer') {
      return drawTiledLayer(context, drawableLayer, tilesets, map, cameraX, cameraY, viewWidth, viewHeight, offsetX, offsetY, renderTime);
    }
    if (drawableLayer.type === 'objectgroup') {
      return drawTiledObjectLayer(context, drawableLayer, tilesets, cameraX, cameraY, viewWidth, viewHeight, offsetX, offsetY, renderTime);
    }
    return false;
  };
  const drawRegionLayer = (region, layer) => {
    drawVisibleLayer(layer, () => {
      return drawMapLayer(layer, region.tilesets, region.map, region.offsetX, region.offsetY);
    });
  };

  if (tiled.isRegionWorld) {
    tiled.loadedRegions.forEach((region) => {
      region.map.layers
        .forEach((layer) => drawRegionLayer(region, layer));
    });
    return drawnLayers;
  }

  tiled.map?.layers
    .forEach((layer) => {
      drawVisibleLayer(layer, () => {
        return drawMapLayer(layer, tiled.tilesets, tiled.map);
      });
    });
  return drawnLayers;
}

function getStreetLampSpriteImage(config = STREET_LAMP_SPRITES.standard) {
  if (typeof Image === 'undefined') return null;
  if (!config.image) {
    config.image = new Image();
    config.image.decoding = 'async';
    config.image.src = resolveAssetUrl(config.src);
  }
  return config.image.complete && config.image.naturalWidth
    ? config.image
    : null;
}

function normalizeMarkerLabel(marker) {
  return `${marker?.type ?? ''} ${marker?.props?.type ?? ''} ${marker?.name ?? ''}`.toLowerCase();
}

function isStreetLampMarker(marker) {
  const label = normalizeMarkerLabel(marker);
  return label.includes('street_lamp') || label.includes('street-lamp') || label.includes('street lamp');
}

function isBigStreetLampMarker(marker) {
  const label = normalizeMarkerLabel(marker);
  return label.includes('big_street_lamp') || label.includes('big-street-lamp') || label.includes('big street lamp');
}

function isCampFireMarker(marker) {
  const label = normalizeMarkerLabel(marker);
  return label.includes('camp_fire') || label.includes('camp-fire') || label.includes('camp fire');
}

function isStandaloneLightMarker(marker) {
  if (isStreetLampMarker(marker) || isCampFireMarker(marker)) return false;
  const label = normalizeMarkerLabel(marker);
  return (
    label.includes('light')
    || label.includes('glow')
    || Number.isFinite(Number(marker?.radius ?? marker?.props?.radius))
    || Number.isFinite(Number(marker?.intensity ?? marker?.props?.intensity))
  );
}

function isLightSourceMarker(marker) {
  return isStreetLampMarker(marker) || isCampFireMarker(marker) || isStandaloneLightMarker(marker);
}

function getStreetLampSpriteConfig(marker) {
  return isBigStreetLampMarker(marker) ? STREET_LAMP_SPRITES.big : STREET_LAMP_SPRITES.standard;
}

function parseHexColor(value, fallback = [255, 211, 122]) {
  const clean = String(value ?? '').trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return fallback;
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbaFromRgb(rgb, alpha) {
  const [red, green, blue] = rgb;
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

function getStreetLampDrawPosition(marker) {
  const config = getStreetLampSpriteConfig(marker);
  const markerWidth = safeNumber(marker?.width, 0);
  const markerHeight = safeNumber(marker?.height, 0);
  const isTileObject = Number(marker?.gid ?? 0) > 0;
  const spriteWidth = isTileObject && markerWidth > 0 ? markerWidth : config.tileWidth;
  const spriteHeight = isTileObject && markerHeight > 0 ? markerHeight : config.tileHeight;
  const headOffsetY = config.headOffsetY * (spriteHeight / config.tileHeight);
  const usesPlacementBounds = !isTileObject && markerWidth >= 48 && markerHeight >= config.tileHeight + 32;
  const headX = usesPlacementBounds
    ? safeNumber(marker?.x, safeNumber(marker?.anchorX, 0))
    : safeNumber(marker?.anchorX, safeNumber(marker?.x, 0));
  const headY = usesPlacementBounds
    ? safeNumber(marker?.y, safeNumber(marker?.anchorY, 0))
    : safeNumber(marker?.anchorY, safeNumber(marker?.y, 0)) - headOffsetY;
  return {
    anchorX: headX,
    anchorY: headY + headOffsetY,
    headX,
    headY,
    spriteWidth,
    spriteHeight,
    spriteConfig: config,
  };
}

function getCampFireDrawPosition(marker) {
  const markerWidth = Math.max(1, safeNumber(marker?.width, 128));
  const markerHeight = Math.max(1, safeNumber(marker?.height, 128));
  const anchorX = safeNumber(marker?.x, safeNumber(marker?.anchorX, 0));
  const anchorY = safeNumber(marker?.y, safeNumber(marker?.anchorY, 0) - markerHeight / 2);
  return {
    anchorX,
    anchorY,
    headX: anchorX,
    headY: anchorY,
    spriteWidth: markerWidth,
    spriteHeight: markerHeight,
  };
}

function getPointLightDrawPosition(marker) {
  const x = safeNumber(marker?.anchorX, safeNumber(marker?.x, 0));
  const y = safeNumber(marker?.anchorY, safeNumber(marker?.y, 0));
  return {
    anchorX: x,
    anchorY: y,
    headX: x,
    headY: y,
    spriteWidth: 0,
    spriteHeight: 0,
  };
}

function drawStreetLampGlow(context, marker, lightState, position, options = {}) {
  if (!lightState.active) return;
  const radius = Math.max(48, safeNumber(lightState.radius ?? marker?.radius, 128)) * Math.max(0.1, safeNumber(options.radiusMultiplier, 1));
  const intensity = clamp(lightState.intensity * Math.max(0, safeNumber(options.intensityMultiplier, 1)), 0, 1.4);
  const alphaMultiplier = Math.max(0, safeNumber(options.alphaMultiplier, 1));
  const rgb = parseHexColor(lightState.color ?? marker?.color);

  context.save();
  context.globalCompositeOperation = 'lighter';
  const glow = context.createRadialGradient(
    position.headX,
    position.headY,
    4,
    position.headX,
    position.headY,
    radius,
  );
  glow.addColorStop(0, rgbaFromRgb(rgb, 0.34 * intensity * alphaMultiplier));
  glow.addColorStop(0.24, rgbaFromRgb(rgb, 0.16 * intensity * alphaMultiplier));
  glow.addColorStop(0.58, rgbaFromRgb(rgb, 0.055 * intensity * alphaMultiplier));
  glow.addColorStop(1, rgbaFromRgb(rgb, 0));
  context.fillStyle = glow;
  context.beginPath();
  context.arc(position.headX, position.headY, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawStreetLampFallback(context, position, active, intensity) {
  const glowAlpha = clamp(intensity, 0, 1);
  const scale = Math.max(0.5, Math.min(4, safeNumber(position.spriteHeight, STREET_LAMP_TILE_HEIGHT) / STREET_LAMP_TILE_HEIGHT));
  context.save();
  context.translate(Math.round(position.anchorX), Math.round(position.anchorY));
  context.scale(scale, scale);
  pixelRect(context, -9, -5, 18, 4, 'rgba(0, 0, 0, 0.2)');
  pixelRect(context, -5, -8, 10, 5, '#332116');
  pixelRect(context, -7, -4, 14, 3, '#1e1712');
  pixelRect(context, -2, -40, 4, 34, '#2b1d15');
  pixelRect(context, -1, -40, 2, 34, '#6b4527');
  pixelRect(context, -4, -13, 8, 3, '#1b130f');
  pixelRect(context, -8, -49, 16, 4, '#1d1510');
  pixelRect(context, -6, -53, 12, 4, '#4a2f1e');
  pixelRect(context, -4, -56, 8, 3, '#231811');
  pixelRect(context, -9, -45, 18, 3, '#2b1d15');
  pixelRect(context, -7, -42, 14, 14, '#201712');
  pixelRect(context, -5, -41, 10, 11, active ? `rgba(255, 211, 111, ${0.85 * glowAlpha})` : '#3d4a4d');
  pixelRect(context, -3, -40, 6, 9, active ? `rgba(255, 240, 166, ${0.9 * glowAlpha})` : '#263238');
  pixelRect(context, -6, -40, 2, 10, '#2b1d15');
  pixelRect(context, 4, -40, 2, 10, '#2b1d15');
  pixelRect(context, -7, -30, 14, 3, '#1b130f');
  pixelRect(context, -4, -27, 8, 3, '#4a2f1e');
  context.restore();
}

function drawStreetLampSprite(context, marker, lightState, position) {
  const active = lightState.active && lightState.intensity > 0.08;
  const config = position.spriteConfig ?? getStreetLampSpriteConfig(marker);
  const image = getStreetLampSpriteImage(config);
  if (!image) {
    drawStreetLampFallback(context, position, active, lightState.intensity);
    return;
  }

  const frame = active ? 1 : 0;
  const targetWidth = Math.max(1, safeNumber(position.spriteWidth, config.tileWidth));
  const targetHeight = Math.max(1, safeNumber(position.spriteHeight, config.tileHeight));
  context.drawImage(
    image,
    frame * config.tileWidth,
    0,
    config.tileWidth,
    config.tileHeight,
    Math.round(position.anchorX - targetWidth / 2),
    Math.round(position.anchorY - targetHeight),
    targetWidth,
    targetHeight,
  );
}

function drawStreetLamps(context, lightMarkers = [], cameraX = 0, cameraY = 0, viewWidth = 0, viewHeight = 0, options = {}) {
  const glowOnly = Boolean(options.glowOnly);
  const phaseFilter = typeof options.phaseFilter === 'string' ? options.phaseFilter : null;
  const lightSources = lightMarkers
    .filter((marker) => marker && isLightSourceMarker(marker))
    .map((marker) => {
      const lightState = getLampLightState(marker);
      const campFire = isCampFireMarker(marker);
      const streetLamp = isStreetLampMarker(marker);
      const position = campFire
        ? getCampFireDrawPosition(marker)
        : streetLamp
          ? getStreetLampDrawPosition(marker)
          : getPointLightDrawPosition(marker);
      const radius = Math.max(48, safeNumber(lightState.radius ?? marker.radius, 128));
      return { marker, lightState, position, radius, campFire, streetLamp };
    })
    .filter(({ position, radius }) => (
      position.anchorX + radius >= cameraX - 32
      && position.anchorX - radius <= cameraX + viewWidth + 32
      && position.anchorY + radius >= cameraY - 64
      && position.anchorY - radius <= cameraY + viewHeight + 64
    ));

  lightSources.forEach(({ marker, lightState, position }) => {
    if (phaseFilter && lightState.phase !== phaseFilter) return;
    drawStreetLampGlow(context, marker, lightState, position, options);
  });
  if (glowOnly) return;
  lightSources.forEach(({ marker, lightState, position, campFire, streetLamp }) => {
    if (campFire || !streetLamp) return;
    if (Number(marker?.gid ?? 0) > 0 && !lightState.active) return;
    drawStreetLampSprite(context, marker, lightState, position);
  });
}

function getTamziaFountainSpriteImage() {
  if (typeof Image === 'undefined') return null;
  if (!TAMZIA_FOUNTAIN_SPRITE.image) {
    TAMZIA_FOUNTAIN_SPRITE.image = new Image();
    TAMZIA_FOUNTAIN_SPRITE.image.decoding = 'async';
    TAMZIA_FOUNTAIN_SPRITE.image.src = `${resolveAssetUrl(TAMZIA_FOUNTAIN_SPRITE.src)}?v=${TAMZIA_FOUNTAIN_SPRITE.version}`;
  }
  return TAMZIA_FOUNTAIN_SPRITE.image.complete && TAMZIA_FOUNTAIN_SPRITE.image.naturalWidth
    ? TAMZIA_FOUNTAIN_SPRITE.image
    : null;
}

function isTamziaFountainProp(prop) {
  const label = [
    prop?.props?.type,
    prop?.props?.displayName,
    prop?.type,
    prop?.name,
  ].filter(Boolean).join(' ').toLowerCase();
  return label.includes('tamzia') && label.includes('fountain');
}

function getTamziaFountainBounds(prop) {
  const width = Math.max(96, safeNumber(prop?.width, 352));
  const height = Math.max(96, safeNumber(prop?.height, width));
  const x = safeNumber(prop?.x, 0);
  const sourceY = safeNumber(prop?.y, 0);
  const isTileObject = normalizeTiledGid(prop?.gid) > 0;
  const y = isTileObject ? sourceY - height : sourceY;
  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };
}

function isBoundsInView(bounds, cameraX, cameraY, viewWidth, viewHeight, padding = 96) {
  return (
    bounds.x + bounds.width >= cameraX - padding
    && bounds.x <= cameraX + viewWidth + padding
    && bounds.y + bounds.height >= cameraY - padding
    && bounds.y <= cameraY + viewHeight + padding
  );
}

function getTamziaFountainGlowIntensity(lighting, fountain, now, options = {}) {
  const phase = lighting?.phase ?? getLightingForPhase().phase;
  const base = TAMZIA_FOUNTAIN_GLOW_BY_PHASE[phase] ?? 0;
  const pulse = 0.88 + Math.sin(now / 620 + safeNumber(fountain?.x, 0) * 0.003) * 0.12;
  return clamp(base * pulse * Math.max(0, safeNumber(options.intensityMultiplier, 1)), 0, 1.25);
}

function drawTamziaFountainGlow(context, fountain, bounds, lighting, now, options = {}) {
  const intensity = getTamziaFountainGlowIntensity(lighting, fountain, now, options);
  if (intensity <= 0.035) return;

  const radiusMultiplier = Math.max(0.1, safeNumber(options.radiusMultiplier, options.postOverlay ? 1.15 : 1));
  const alphaMultiplier = Math.max(0, safeNumber(options.alphaMultiplier, options.postOverlay ? 1.18 : 0.72));
  const radius = Math.max(bounds.width, bounds.height) * 0.56 * radiusMultiplier;
  const waterRadius = Math.max(bounds.width, bounds.height) * 0.28;
  const glowCenterY = bounds.y + bounds.height * 0.51;
  const rgb = parseHexColor(fountain?.props?.glowColor ?? fountain?.props?.color ?? '#69f2ff', [105, 242, 255]);

  context.save();
  context.globalCompositeOperation = 'lighter';
  const wideGlow = context.createRadialGradient(
    bounds.centerX,
    glowCenterY,
    8,
    bounds.centerX,
    glowCenterY,
    radius,
  );
  wideGlow.addColorStop(0, rgbaFromRgb(rgb, 0.25 * intensity * alphaMultiplier));
  wideGlow.addColorStop(0.22, rgbaFromRgb(rgb, 0.14 * intensity * alphaMultiplier));
  wideGlow.addColorStop(0.62, rgbaFromRgb(rgb, 0.045 * intensity * alphaMultiplier));
  wideGlow.addColorStop(1, rgbaFromRgb(rgb, 0));
  context.fillStyle = wideGlow;
  context.fillRect(bounds.centerX - radius, glowCenterY - radius, radius * 2, radius * 2);

  const waterGlow = context.createRadialGradient(
    bounds.centerX,
    glowCenterY,
    4,
    bounds.centerX,
    glowCenterY,
    waterRadius,
  );
  waterGlow.addColorStop(0, rgbaFromRgb(rgb, 0.36 * intensity * alphaMultiplier));
  waterGlow.addColorStop(0.5, rgbaFromRgb(rgb, 0.13 * intensity * alphaMultiplier));
  waterGlow.addColorStop(1, rgbaFromRgb(rgb, 0));
  context.fillStyle = waterGlow;
  context.beginPath();
  context.ellipse(bounds.centerX, glowCenterY, bounds.width * 0.34, bounds.height * 0.22, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawTamziaFountainFallback(context, bounds, now) {
  const pulse = Math.sin(now / 160) * 4;
  context.save();
  context.translate(bounds.centerX, bounds.centerY);
  context.scale(bounds.width / 352, bounds.height / 352);

  context.fillStyle = 'rgba(0, 0, 0, 0.25)';
  context.beginPath();
  context.ellipse(0, 88, 142, 34, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#2c2b27';
  context.beginPath();
  context.ellipse(0, 4, 142, 104, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#9b9384';
  context.beginPath();
  context.ellipse(0, -4, 132, 90, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#11657a';
  context.beginPath();
  context.ellipse(0, -5, 96, 58, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#bffbff';
  context.lineWidth = 6;
  context.beginPath();
  context.ellipse(0, -5 + pulse * 0.2, 76, 38, 0, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = '#a69b89';
  context.fillRect(-14, -76, 28, 60);
  context.fillStyle = '#e9faff';
  context.fillRect(-3, -116 + pulse, 6, 36);
  context.restore();
}

function drawTamziaFountainSprite(context, fountain, bounds, now) {
  const image = getTamziaFountainSpriteImage();
  if (!image) {
    drawTamziaFountainFallback(context, bounds, now);
    return;
  }

  const frame = Math.floor(now / TAMZIA_FOUNTAIN_SPRITE.frameDuration) % TAMZIA_FOUNTAIN_SPRITE.frameCount;
  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(
    image,
    frame * TAMZIA_FOUNTAIN_SPRITE.frameWidth,
    0,
    TAMZIA_FOUNTAIN_SPRITE.frameWidth,
    TAMZIA_FOUNTAIN_SPRITE.frameHeight,
    Math.round(bounds.x),
    Math.round(bounds.y),
    Math.round(bounds.width),
    Math.round(bounds.height),
  );
  context.restore();
}

function drawTamziaFountains(context, props = [], cameraX = 0, cameraY = 0, viewWidth = 0, viewHeight = 0, now = performance.now(), options = {}) {
  const lighting = options.lighting ?? getLightingForPhase();
  const glowOnly = Boolean(options.glowOnly);
  const fountains = props
    .filter((prop) => prop?.visible !== false)
    .filter(isTamziaFountainProp)
    .map((prop) => ({ prop, bounds: getTamziaFountainBounds(prop) }))
    .filter(({ bounds }) => isBoundsInView(bounds, cameraX, cameraY, viewWidth, viewHeight));

  fountains.forEach(({ prop, bounds }) => {
    if (glowOnly) {
      drawTamziaFountainGlow(context, prop, bounds, lighting, now, {
        ...options,
        alphaMultiplier: safeNumber(options.alphaMultiplier, 1.18),
        radiusMultiplier: safeNumber(options.radiusMultiplier, 1.15),
      });
      return;
    }

    drawTamziaFountainGlow(context, prop, bounds, lighting, now, options);
    if (normalizeTiledGid(prop?.gid) <= 0) {
      drawTamziaFountainSprite(context, prop, bounds, now);
    }
  });
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

function addObjectPath(context, object) {
  const objectX = safeNumber(object?.x, 0);
  const objectY = safeNumber(object?.y, 0);
  const polygon = Array.isArray(object?.polygon) ? object.polygon : null;
  if (polygon?.length >= 3) {
    polygon.forEach((point, index) => {
      const x = objectX + safeNumber(point.x, 0);
      const y = objectY + safeNumber(point.y, 0);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    return true;
  }

  const width = safeNumber(object?.width, 0);
  const height = safeNumber(object?.height, 0);
  if (width <= 0 || height <= 0) return false;
  context.rect(objectX, objectY, width, height);
  return true;
}

function getObjectBounds(object) {
  const objectX = safeNumber(object?.x, 0);
  const objectY = safeNumber(object?.y, 0);
  const polygon = Array.isArray(object?.polygon) ? object.polygon : null;
  if (polygon?.length >= 3) {
    const points = polygon.map((point) => ({
      x: objectX + safeNumber(point.x, 0),
      y: objectY + safeNumber(point.y, 0),
    }));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return {
    x: objectX,
    y: objectY,
    width: Math.max(0, safeNumber(object?.width, 0)),
    height: Math.max(0, safeNumber(object?.height, 0)),
  };
}

function getObjectCenter(object) {
  const bounds = getObjectBounds(object);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function getObjectPolygonPoints(object) {
  const objectX = safeNumber(object?.x, 0);
  const objectY = safeNumber(object?.y, 0);
  return (object?.polygon ?? []).map((point) => ({
    x: objectX + safeNumber(point.x, 0),
    y: objectY + safeNumber(point.y, 0),
  }));
}

function closestPointOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.0001) return { ...start };
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
}

function closestPointOnPolygon(point, polygon) {
  if (!polygon.length) return null;
  let closest = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const candidate = closestPointOnSegment(point, start, end);
    const dx = candidate.x - point.x;
    const dy = candidate.y - point.y;
    const candidateDistance = dx * dx + dy * dy;
    if (candidateDistance < closestDistance) {
      closest = candidate;
      closestDistance = candidateDistance;
    }
  }
  return closest;
}

function getCaveConnector(caveZone, entranceZone) {
  if (!caveZone || !entranceZone) return null;
  const start = getObjectCenter(entranceZone);
  const cavePolygon = getObjectPolygonPoints(caveZone);
  const end = closestPointOnPolygon(start, cavePolygon) ?? getObjectCenter(caveZone);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1) return null;
  return {
    start,
    end,
    width: clamp(
      safeNumber(entranceZone?.props?.connectorWidth ?? caveZone?.props?.connectorWidth, 280),
      96,
      960,
    ),
  };
}

function addCaveConnectorPath(context, connector) {
  if (!connector) return false;
  const dx = connector.end.x - connector.start.x;
  const dy = connector.end.y - connector.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1) return false;
  const halfWidth = connector.width / 2;
  const nx = -dy / length;
  const ny = dx / length;
  context.moveTo(connector.start.x + nx * halfWidth, connector.start.y + ny * halfWidth);
  context.lineTo(connector.end.x + nx * halfWidth, connector.end.y + ny * halfWidth);
  context.lineTo(connector.end.x - nx * halfWidth, connector.end.y - ny * halfWidth);
  context.lineTo(connector.start.x - nx * halfWidth, connector.start.y - ny * halfWidth);
  context.closePath();
  return true;
}

function seededCaveNoise(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function drawCaveStroke(context, points, width, color, alpha = 1) {
  if (!points.length) return;
  context.save();
  context.globalAlpha *= alpha;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();
  context.restore();
}

function drawCaveInteriorOverlay(context, caveZone, entranceZones = [], now = performance.now()) {
  if (!caveZone) return;
  const bounds = getObjectBounds(caveZone);
  if (bounds.width <= 0 || bounds.height <= 0) return;
  const center = {
    x: bounds.x + bounds.width * 0.5,
    y: bounds.y + bounds.height * 0.52,
  };
  const entranceBounds = getObjectBounds(entranceZones[0] ?? caveZone);
  const entrance = {
    x: entranceBounds.x + entranceBounds.width * 0.5,
    y: entranceBounds.y + entranceBounds.height * 0.5,
  };
  const connectors = entranceZones
    .map((zone) => getCaveConnector(caveZone, zone))
    .filter(Boolean);
  const entryPoint = connectors[0]?.end ?? {
    x: bounds.x + bounds.width * 0.24,
    y: bounds.y + bounds.height * 0.43,
  };
  const far = {
    x: bounds.x + bounds.width * 0.78,
    y: bounds.y + bounds.height * 0.58,
  };
  const seed = Math.abs(String(caveZone.name ?? caveZone.id ?? 'cave')
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0));

  context.save();
  try {
    context.beginPath();
    const hasCavePath = addObjectPath(context, caveZone);
    entranceZones.forEach((zone) => addObjectPath(context, zone));
    connectors.forEach((connector) => addCaveConnectorPath(context, connector));
    if (!hasCavePath) return;
    context.clip();

    context.fillStyle = '#171714';
    context.fillRect(bounds.x - 64, bounds.y - 64, bounds.width + 128, bounds.height + 128);

    const vignette = context.createRadialGradient(center.x, center.y, 32, center.x, center.y, Math.max(bounds.width, bounds.height) * 0.72);
    vignette.addColorStop(0, 'rgba(82, 75, 61, 0.58)');
    vignette.addColorStop(0.58, 'rgba(47, 45, 39, 0.88)');
    vignette.addColorStop(1, 'rgba(11, 12, 12, 0.96)');
    context.fillStyle = vignette;
    context.fillRect(bounds.x - 64, bounds.y - 64, bounds.width + 128, bounds.height + 128);

    const mainPath = [
      entrance,
      entryPoint,
      center,
      { x: bounds.x + bounds.width * 0.62, y: bounds.y + bounds.height * 0.38 },
      far,
    ];
    drawCaveStroke(context, mainPath, 260, '#272720', 0.98);
    drawCaveStroke(context, mainPath, 184, '#454133', 0.92);
    drawCaveStroke(context, mainPath, 106, '#5c5543', 0.54);

    const branches = [
      [center, { x: bounds.x + bounds.width * 0.34, y: bounds.y + bounds.height * 0.18 }, { x: bounds.x + bounds.width * 0.18, y: bounds.y + bounds.height * 0.16 }],
      [center, { x: bounds.x + bounds.width * 0.47, y: bounds.y + bounds.height * 0.74 }, { x: bounds.x + bounds.width * 0.37, y: bounds.y + bounds.height * 0.9 }],
      [{ x: bounds.x + bounds.width * 0.62, y: bounds.y + bounds.height * 0.38 }, { x: bounds.x + bounds.width * 0.82, y: bounds.y + bounds.height * 0.3 }, { x: bounds.x + bounds.width * 0.92, y: bounds.y + bounds.height * 0.18 }],
      [{ x: bounds.x + bounds.width * 0.72, y: bounds.y + bounds.height * 0.55 }, { x: bounds.x + bounds.width * 0.62, y: bounds.y + bounds.height * 0.78 }, { x: bounds.x + bounds.width * 0.68, y: bounds.y + bounds.height * 0.93 }],
    ];
    branches.forEach((branch, index) => {
      drawCaveStroke(context, branch, 150 - index * 12, '#25251f', 0.94);
      drawCaveStroke(context, branch, 88 - index * 7, '#4a4435', 0.72);
    });

    const shimmer = 0.1 + Math.sin(now / 900) * 0.03;
    for (let index = 0; index < 90; index += 1) {
      const x = bounds.x + seededCaveNoise(seed + index * 17) * bounds.width;
      const y = bounds.y + seededCaveNoise(seed + index * 29) * bounds.height;
      const size = 2 + Math.floor(seededCaveNoise(seed + index * 41) * 5);
      const tint = seededCaveNoise(seed + index * 53) > 0.72 ? '128, 116, 84' : '35, 34, 31';
      context.fillStyle = `rgba(${tint}, ${0.12 + shimmer})`;
      context.fillRect(Math.round(x), Math.round(y), size, size);
    }
  } finally {
    context.restore();
  }

  context.save();
  try {
    context.strokeStyle = 'rgba(7, 8, 8, 0.82)';
    context.lineWidth = 16;
    context.lineJoin = 'round';
    context.beginPath();
    if (addObjectPath(context, caveZone)) context.stroke();
    context.strokeStyle = 'rgba(130, 120, 86, 0.34)';
    context.lineWidth = 3;
    context.setLineDash([18, 10]);
    context.beginPath();
    if (addObjectPath(context, caveZone)) context.stroke();
  } finally {
    context.restore();
  }
}

function drawInteriorFocusOverlay(context, zone, worldWidth, worldHeight, now = performance.now(), entranceZones = []) {
  if (!zone) return;
  const x = Number(zone.x ?? 0);
  const y = Number(zone.y ?? 0);
  const width = Number(zone.width ?? 0);
  const height = Number(zone.height ?? 0);
  const zoneKind = String(zone?.props?.type ?? zone?.props?.kind ?? zone?.type ?? zone?.name ?? '').toLowerCase();
  const zoneInteriorId = String(zone?.props?.interiorId ?? zone?.props?.caveId ?? zone?.name ?? '').toLowerCase();
  const isCaveFocus = zoneKind.includes('cave') || zoneInteriorId.startsWith('cave_');

  const pulse = 0.45 + Math.sin(now / 420) * 0.08;
  context.save();
  try {
    if (isCaveFocus) {
      context.beginPath();
      context.rect(0, 0, worldWidth, worldHeight);
      const hasCavePath = addObjectPath(context, zone);
      if (!hasCavePath) return;
      context.fillStyle = 'rgba(0, 0, 0, 0.96)';
      context.fill('evenodd');
      context.strokeStyle = `rgba(139, 233, 253, ${(pulse * 0.24).toFixed(3)})`;
      context.lineWidth = 2;
      context.setLineDash([18, 14]);
      context.beginPath();
      if (addObjectPath(context, zone)) context.stroke();
      return;
    }

    context.fillStyle = 'rgba(8, 13, 15, 0.24)';
    context.beginPath();
    context.rect(0, 0, worldWidth, worldHeight);
    let hasFocusPath = false;
    if (width > 0 && height > 0) {
      context.rect(x - 18, y - 18, width + 36, height + 36);
      hasFocusPath = true;
    } else {
      hasFocusPath = addObjectPath(context, zone);
    }
    if (!hasFocusPath) return;
    context.fill('evenodd');

    if (width <= 0 || height <= 0) return;
    context.fillStyle = 'rgba(246, 241, 223, 0.07)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = `rgba(139, 233, 253, ${pulse})`;
    context.lineWidth = 3;
    context.setLineDash([12, 7]);
    context.strokeRect(x - 4, y - 4, width + 8, height + 8);
  } finally {
    context.restore();
  }
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
  drawTiledObjectLayer,
  drawTiledWorld,
  drawStreetLamps,
  drawTamziaFountains,
  drawTiledZones,
  drawCaveInteriorOverlay,
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
