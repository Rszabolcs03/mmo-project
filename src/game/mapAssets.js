import { clamp, safeNumber } from './math';
import {
  WORLD,
  MAP_FILES,
  WORLD_V2_WORLD_TILES,
  WORLD_V2_WORLD_PIXEL_SIZE,
  WORLD_V2_CHUNK_TILES,
  QUEST_GIVER_PROFILES,
  normalizeMapId,
  getWorldGenerationIdFromMapId,
  getWorldGenerationConfig,
  getWorldV2RegionCoordsFromMapId,
  getWorldV2MapIdFromPoint,
  getWorldV2RegionOffset,
} from './world';
import {
  CLASSES,
  CHARACTER_SPRITE_EXPECTED_WIDTH,
  CHARACTER_SPRITE_EXPECTED_HEIGHT,
  CHARACTER_SPRITE_VERSION,
  CHARACTER_SPRITE_VARIANTS,
  CHARACTER_SPRITES,
  CHARACTER_SPRITE_LOADS,
  CHARACTER_LAYER_ORDER,
  CHARACTER_LAYER_DIRS,
  CHARACTER_LAYER_IMAGES,
  CHARACTER_LAYER_LOADS,
  ENEMY_SPRITES,
  ENEMY_SPRITE_LOADS,
  PET_SPRITES,
  PET_SPRITE_LOADS,
  ENEMY_SPRITE_VERSION,
  ENEMY_SPRITE_CONFIG,
  PET_SPRITE_CONFIG,
} from './gameData';

function getProperties(object) {
  return Object.fromEntries((object.properties ?? []).map((property) => [property.name, property.value]));
}

function getQuestGiverProfile(mapId) {
  return QUEST_GIVER_PROFILES[normalizeMapId(mapId)] ?? QUEST_GIVER_PROFILES.world;
}

function normalizeQuestGiver(object, mapId, index = 0) {
  const props = getProperties(object);
  const profile = getQuestGiverProfile(mapId);
  const point = object?.point ? { x: Number(object.x ?? 0), y: Number(object.y ?? 0) } : {
    x: Number(object?.x ?? 0) + Number(object?.width ?? 0) / 2,
    y: Number(object?.y ?? 0) + Number(object?.height ?? 0) / 2,
  };
  return {
    ...object,
    ...point,
    mapId,
    id: String(props.questGiverId ?? props.id ?? profile.id ?? `${mapId}-questgiver-${index}`),
    name: String(props.displayName ?? props.name ?? object?.name ?? profile.name ?? 'Quest Giver'),
    title: String(props.title ?? profile.title ?? 'Quest Giver'),
    dialogue: String(props.dialogue ?? profile.dialogue ?? 'I have work for you.'),
    interactRange: safeNumber(props.interactRange, 92),
    props: {
      ...props,
      type: props.type ?? 'questgiver',
      questGiverId: props.questGiverId ?? profile.id,
    },
  };
}

function parseTsxTileset(xmlText) {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml');
  const tileset = document.querySelector('tileset');
  const image = document.querySelector('image');
  if (!tileset || !image) {
    throw new Error('Invalid TSX tileset response');
  }

  return {
    columns: Number(tileset.getAttribute('columns')),
    tilewidth: Number(tileset.getAttribute('tilewidth')),
    tileheight: Number(tileset.getAttribute('tileheight')),
    imageSource: image.getAttribute('source'),
  };
}

function hasTileData(layer) {
  return Array.isArray(layer?.data) || ArrayBuffer.isView(layer?.data);
}

async function inflateBase64Zlib(base64Data) {
  if (!globalThis.DecompressionStream) {
    throw new Error('This browser cannot decode Tiled zlib-compressed layers.');
  }

  const binary = atob(String(base64Data ?? '').trim());
  const compressed = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    compressed[index] = binary.charCodeAt(index);
  }

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeUint32LittleEndian(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const data = new Uint32Array(Math.floor(bytes.byteLength / 4));
  for (let index = 0; index < data.length; index += 1) {
    data[index] = view.getUint32(index * 4, true);
  }
  return data;
}

async function decodeTiledTileLayer(layer) {
  if (layer?.type !== 'tilelayer' || hasTileData(layer)) return layer;
  if (layer.encoding !== 'base64' || layer.compression !== 'zlib' || typeof layer.data !== 'string') return layer;

  const bytes = await inflateBase64Zlib(layer.data);
  layer.data = decodeUint32LittleEndian(bytes);
  return layer;
}

async function decodeTiledMapLayers(map) {
  await Promise.all((map.layers ?? []).map((layer) => decodeTiledTileLayer(layer)));
  return map;
}

async function loadImage(src) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

async function loadImageCached(src) {
  const key = String(src);
  if (TILED_IMAGE_CACHE.has(key)) return TILED_IMAGE_CACHE.get(key);
  if (TILED_IMAGE_LOADS.has(key)) return TILED_IMAGE_LOADS.get(key);
  const promise = loadImage(key)
    .then((image) => {
      TILED_IMAGE_CACHE.set(key, image);
      return image;
    })
    .finally(() => {
      TILED_IMAGE_LOADS.delete(key);
    });
  TILED_IMAGE_LOADS.set(key, promise);
  return promise;
}

async function loadTiledTilesets(tilesetRefs = [], mapUrl, { cacheBust = null, fetchCache = 'force-cache' } = {}) {
  const query = cacheBust ? `?${cacheBust}` : '';
  return Promise.all(
    tilesetRefs.map(async (tileset) => {
      const tilesetUrl = resolveAssetUrl(tileset.source, mapUrl);
      const cacheKey = `${tileset.firstgid}:${tilesetUrl}:${query}`;
      if (TILED_TILESET_CACHE.has(cacheKey)) return TILED_TILESET_CACHE.get(cacheKey);
      if (TILED_TILESET_LOADS.has(cacheKey)) return TILED_TILESET_LOADS.get(cacheKey);

      const promise = fetch(`${tilesetUrl}${query}`, { cache: fetchCache })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Tileset load failed: ${response.status} ${tilesetUrl}`);
          }
          return response.text();
        })
        .then(async (tilesetText) => {
          const parsedTileset = parseTsxTileset(tilesetText);
          const imageUrl = resolveAssetUrl(parsedTileset.imageSource, tilesetUrl);
          const image = await loadImageCached(`${imageUrl}${query}`);
          const loadedTileset = {
            firstgid: tileset.firstgid,
            ...parsedTileset,
            image,
          };
          TILED_TILESET_CACHE.set(cacheKey, loadedTileset);
          return loadedTileset;
        })
        .finally(() => {
          TILED_TILESET_LOADS.delete(cacheKey);
        });
      TILED_TILESET_LOADS.set(cacheKey, promise);
      return promise;
    }),
  );
}

function hexToRgb(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) return null;
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function shiftHexColor(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const shifted = rgb.map((channel) => clamp(Math.round(channel * amount), 0, 255));
  return `#${shifted.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function colorDistanceSquared(red, green, blue, target) {
  if (!target) return Number.POSITIVE_INFINITY;
  return (red - target[0]) ** 2 + (green - target[1]) ** 2 + (blue - target[2]) ** 2;
}

function getCharacterSpriteBaseClass(spriteId) {
  if (typeof spriteId !== 'string') return null;
  return spriteId.split('-')[0];
}

function getCharacterSpriteCandidates(selectedClass, appearance = {}) {
  const classId = normalizeCharacterLayerId(selectedClass) ?? 'warrior';
  const gender = normalizeCharacterLayerId(appearance.gender);
  const candidates = [];
  if (gender) candidates.push(`${classId}-${gender}`);
  candidates.push(classId);
  return [...new Set(candidates)];
}

function loadCharacterSprite(spriteId) {
  const baseClassId = getCharacterSpriteBaseClass(spriteId);
  if (!spriteId || !baseClassId || !CLASSES[baseClassId]) return Promise.resolve(null);
  if (CHARACTER_SPRITES.has(spriteId)) return Promise.resolve(CHARACTER_SPRITES.get(spriteId));
  if (CHARACTER_SPRITE_LOADS.has(spriteId)) return CHARACTER_SPRITE_LOADS.get(spriteId);

  const promise = loadImage(`${resolveAssetUrl(`assets/characters/${spriteId}.png`)}?v=${CHARACTER_SPRITE_VERSION}`)
    .then((image) => {
      if (image.naturalWidth !== CHARACTER_SPRITE_EXPECTED_WIDTH || image.naturalHeight !== CHARACTER_SPRITE_EXPECTED_HEIGHT) {
        console.warn(`Character spritesheet for ${spriteId} should be ${CHARACTER_SPRITE_EXPECTED_WIDTH}x${CHARACTER_SPRITE_EXPECTED_HEIGHT}, got ${image.naturalWidth}x${image.naturalHeight}.`);
      }
      CHARACTER_SPRITES.set(spriteId, image);
      return image;
    })
    .catch((error) => {
      console.warn(`Missing character spritesheet for ${spriteId}; using generated fallback.`, error);
      CHARACTER_SPRITES.set(spriteId, null);
      return null;
    });

  CHARACTER_SPRITE_LOADS.set(spriteId, promise);
  return promise;
}

function loadCharacterSprites() {
  const spriteIds = Object.keys(CLASSES).flatMap((classId) => [
    classId,
    ...CHARACTER_SPRITE_VARIANTS.map((variant) => `${classId}-${variant}`),
  ]);
  return Promise.all(spriteIds.map(loadCharacterSprite));
}

function loadEnemySprite(spriteId) {
  const config = ENEMY_SPRITE_CONFIG[spriteId];
  if (!config) return Promise.resolve(null);
  if (ENEMY_SPRITES.has(spriteId)) return Promise.resolve(ENEMY_SPRITES.get(spriteId));
  if (ENEMY_SPRITE_LOADS.has(spriteId)) return ENEMY_SPRITE_LOADS.get(spriteId);

  const promise = loadImage(`${resolveAssetUrl(config.path)}?v=${ENEMY_SPRITE_VERSION}`)
    .then((image) => {
      ENEMY_SPRITES.set(spriteId, image);
      return image;
    })
    .catch((error) => {
      console.warn(`Missing enemy spritesheet for ${spriteId}; using generated fallback.`, error);
      ENEMY_SPRITES.set(spriteId, null);
      return null;
    });

  ENEMY_SPRITE_LOADS.set(spriteId, promise);
  return promise;
}

function loadEnemySprites() {
  return Promise.all(Object.keys(ENEMY_SPRITE_CONFIG).map(loadEnemySprite));
}

function loadPetSprite(raceId) {
  const spriteId = PET_SPRITE_CONFIG[raceId] ? raceId : 'human';
  const config = PET_SPRITE_CONFIG[spriteId];
  if (PET_SPRITES.has(spriteId)) return Promise.resolve(PET_SPRITES.get(spriteId));
  if (PET_SPRITE_LOADS.has(spriteId)) return PET_SPRITE_LOADS.get(spriteId);

  const promise = loadImage(resolveAssetUrl(config.path))
    .then((image) => {
      PET_SPRITES.set(spriteId, image);
      return image;
    })
    .catch((error) => {
      console.warn(`Missing pet spritesheet for ${spriteId}; using generated fallback.`, error);
      PET_SPRITES.set(spriteId, null);
      return null;
    });

  PET_SPRITE_LOADS.set(spriteId, promise);
  return promise;
}

function loadPetSprites() {
  return Promise.all(Object.keys(PET_SPRITE_CONFIG).map(loadPetSprite));
}

function getPetSpriteImage(raceId) {
  const spriteId = PET_SPRITE_CONFIG[raceId] ? raceId : 'human';
  if (!PET_SPRITES.has(spriteId) && !PET_SPRITE_LOADS.has(spriteId)) {
    loadPetSprite(spriteId);
  }
  return PET_SPRITES.get(spriteId) ?? null;
}

function getEnemySpriteId(enemy) {
  if (!enemy) return null;
  const explicitSprite = normalizeEnemyKind(enemy.spriteId);
  if (explicitSprite && ENEMY_SPRITE_CONFIG[explicitSprite]) return explicitSprite;

  if (enemy.type === 'boss') {
    const bossType = normalizeEnemyKind(enemy.bossType ?? enemy.enemyKind ?? enemy.name);
    return ENEMY_SPRITE_CONFIG[bossType] ? bossType : 'elder-briarheart';
  }

  const enemyKind = normalizeEnemyKind(enemy.enemyKind ?? enemy.type);
  return ENEMY_SPRITE_CONFIG[enemyKind] ? enemyKind : null;
}

function getEnemySpriteImage(spriteId) {
  if (!spriteId) return null;
  if (!ENEMY_SPRITES.has(spriteId) && !ENEMY_SPRITE_LOADS.has(spriteId)) {
    loadEnemySprite(spriteId);
  }
  return ENEMY_SPRITES.get(spriteId) ?? null;
}

function normalizeCharacterLayerId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  return trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function normalizeOptionalCharacterLayerId(value) {
  const normalized = normalizeCharacterLayerId(value);
  return normalized === 'none' ? null : normalized;
}

function getCharacterLayerSelection(selectedClass, selectedRace, appearance = {}) {
  const classId = normalizeCharacterLayerId(selectedClass) ?? 'warrior';
  const genderId = normalizeCharacterLayerId(appearance.gender) ?? 'male';
  const bodyId = normalizeCharacterLayerId(appearance.body);
  const outfitId = normalizeCharacterLayerId(appearance.outfit);
  const weaponId = normalizeCharacterLayerId(appearance.weapon);
  const outfitVariant = normalizeCharacterLayerId(appearance.outfitVariant) ?? 'classic';
  const weaponVariant = normalizeCharacterLayerId(appearance.weaponVariant) ?? 'classic';
  const raceId = normalizeCharacterLayerId(appearance.race)
    ?? (bodyId && !bodyId.includes('-') ? bodyId : null)
    ?? normalizeCharacterLayerId(selectedRace)
    ?? 'human';

  return {
    base: bodyId && bodyId.includes('-') ? bodyId : `${raceId}-${genderId}`,
    hair: normalizeCharacterLayerId(appearance.hairAsset) ?? normalizeCharacterLayerId(appearance.hairStyle),
    beard: normalizeOptionalCharacterLayerId(appearance.beard),
    outfit: outfitId && outfitId.includes('-') ? outfitId : `${classId}-${outfitVariant}`,
    weapon: weaponId && weaponId.includes('-') ? weaponId : `${classId}-${weaponVariant}`,
    cape: normalizeOptionalCharacterLayerId(appearance.cape) ?? normalizeOptionalCharacterLayerId(appearance.capeStyle),
  };
}

function getCharacterLayerCacheKey(layer, layerId) {
  return `${layer}:${layerId}`;
}

function loadCharacterLayer(layer, layerId) {
  if (!layer || !layerId || !CHARACTER_LAYER_DIRS[layer]) return Promise.resolve(null);

  const cacheKey = getCharacterLayerCacheKey(layer, layerId);
  if (CHARACTER_LAYER_IMAGES.has(cacheKey)) return Promise.resolve(CHARACTER_LAYER_IMAGES.get(cacheKey));
  if (CHARACTER_LAYER_LOADS.has(cacheKey)) return CHARACTER_LAYER_LOADS.get(cacheKey);

  const promise = loadImage(`${resolveAssetUrl(`assets/characters/${CHARACTER_LAYER_DIRS[layer]}/${layerId}.png`)}?v=${CHARACTER_SPRITE_VERSION}`)
    .then((image) => {
      if (image.naturalWidth !== CHARACTER_SPRITE_EXPECTED_WIDTH || image.naturalHeight !== CHARACTER_SPRITE_EXPECTED_HEIGHT) {
        console.warn(`Character layer ${cacheKey} should be ${CHARACTER_SPRITE_EXPECTED_WIDTH}x${CHARACTER_SPRITE_EXPECTED_HEIGHT}, got ${image.naturalWidth}x${image.naturalHeight}.`);
      }
      CHARACTER_LAYER_IMAGES.set(cacheKey, image);
      return image;
    })
    .catch(() => {
      CHARACTER_LAYER_IMAGES.set(cacheKey, null);
      return null;
    });

  CHARACTER_LAYER_LOADS.set(cacheKey, promise);
  return promise;
}

function loadCharacterLayersForAppearance(selectedClass, selectedRace, appearance = {}) {
  const selection = getCharacterLayerSelection(selectedClass, selectedRace, appearance);
  return Promise.all(
    CHARACTER_LAYER_ORDER
      .filter((layer) => selection[layer])
      .map((layer) => loadCharacterLayer(layer, selection[layer])),
  );
}

function getCharacterLayerImage(layer, layerId) {
  if (!layer || !layerId) return null;
  const cacheKey = getCharacterLayerCacheKey(layer, layerId);
  if (!CHARACTER_LAYER_IMAGES.has(cacheKey) && !CHARACTER_LAYER_LOADS.has(cacheKey)) {
    loadCharacterLayer(layer, layerId);
  }
  return CHARACTER_LAYER_IMAGES.get(cacheKey) ?? null;
}

function resolveAssetUrl(relativePath, baseUrl = null) {
  const appBaseUrl = new URL(import.meta.env.BASE_URL || './', window.location.href);
  return new URL(relativePath, baseUrl ?? appBaseUrl).href;
}

function normalizeEnemyKind(value) {
  return String(value ?? '').toLowerCase().trim().replace(/[_\s]+/g, '-');
}

const TILED_IMAGE_CACHE = new globalThis.Map();
const TILED_IMAGE_LOADS = new globalThis.Map();
const TILED_TILESET_CACHE = new globalThis.Map();
const TILED_TILESET_LOADS = new globalThis.Map();
const WORLD_V2_CHUNK_INDEX_LOADS = new globalThis.Map();
const WORLD_V2_REGISTRY_LOADS = new globalThis.Map();

async function loadTiledMap(mapId = 'world') {
  const normalizedMapId = normalizeMapId(mapId);
  const cacheBust = `v=${Date.now()}`;
  const fileName = MAP_FILES[normalizedMapId] ?? MAP_FILES.world;
  const mapUrl = resolveAssetUrl(`maps/${fileName}`);
  const map = await fetch(`${mapUrl}?${cacheBust}`, { cache: 'no-store' }).then((response) => response.json());
  await decodeTiledMapLayers(map);
  const tilesets = await loadTiledTilesets(map.tilesets, mapUrl, { cacheBust, fetchCache: 'no-store' });
  const zonesLayer = map.layers.find((layer) => layer.name === 'Zones');
  const spawnsLayer = map.layers.find((layer) => layer.name === 'Spawns');
  const bossSpawnsLayer = map.layers.find((layer) => layer.name === 'BossSpawns');
  const npcsLayer = map.layers.find((layer) => layer.name === 'NPCs');
  const questGiversLayer = map.layers.find((layer) => layer.name === 'QuestGiver');
  const raceStartsLayer = map.layers.find((layer) => layer.name === 'raceStart');
  const interiorZonesLayer = map.layers.find((layer) => layer.name === 'InteriorZones');
  const regionMarkersLayer = map.layers.find((layer) => layer.name === 'RegionMarkers');
  const roadMarkersLayer = map.layers.find((layer) => layer.name === 'RoadMarkers');
  const landmarksLayer = map.layers.find((layer) => layer.name === 'Landmarks');
  const transitionLayers = map.layers.filter((layer) => (
    layer.type === 'objectgroup'
    && ['Transitions', 'Dungeon_transition', 'Dungeon_transitions', 'DungeonTransitions'].includes(layer.name)
  ));
  const graveyardsLayer = map.layers.find((layer) => ['Graveyard', 'Graveyards', 'graveyard'].includes(layer.name));
  const spawns = [
    ...(spawnsLayer?.objects ?? []),
    ...(bossSpawnsLayer?.objects ?? []),
  ].map((spawn) => ({ ...spawn, props: getProperties(spawn), mapId: normalizedMapId }));
  const bossSpawns = spawns.filter((spawn) => spawn.props.bossType || String(spawn.name ?? '').toLowerCase().includes('boss'));
  const enemySpawns = spawns.filter((spawn) => !bossSpawns.includes(spawn) && spawn.props.enemyType);

  return {
    mapId: normalizedMapId,
    map,
    tilesets,
    zones: (zonesLayer?.objects ?? []).map((zone) => ({ ...zone, props: getProperties(zone), mapId: normalizedMapId })),
    spawns,
    enemySpawns,
    bossSpawns,
    npcs: (npcsLayer?.objects ?? []).map((npc) => ({ ...npc, props: getProperties(npc), mapId: normalizedMapId })),
    questGivers: (questGiversLayer?.objects ?? []).map((giver, index) => normalizeQuestGiver(giver, normalizedMapId, index)),
    raceStarts: (raceStartsLayer?.objects ?? []).map((start) => ({ ...start, props: getProperties(start), mapId: normalizedMapId })),
    interiorZones: (interiorZonesLayer?.objects ?? []).map((zone) => ({ ...zone, props: getProperties(zone), mapId: normalizedMapId })),
    transitions: transitionLayers.flatMap((layer) => (
      (layer.objects ?? []).map((transition) => ({ ...transition, props: getProperties(transition), mapId: normalizedMapId, layerName: layer.name }))
    )),
    graveyards: (graveyardsLayer?.objects ?? []).map((graveyard) => ({ ...graveyard, props: getProperties(graveyard), mapId: normalizedMapId })),
    regionMarkers: (regionMarkersLayer?.objects ?? []).map((marker) => ({ ...marker, props: getProperties(marker), mapId: normalizedMapId })),
    roadMarkers: (roadMarkersLayer?.objects ?? []).map((marker) => ({ ...marker, props: getProperties(marker), mapId: normalizedMapId })),
    landmarks: (landmarksLayer?.objects ?? []).map((landmark) => ({ ...landmark, props: getProperties(landmark), mapId: normalizedMapId })),
  };
}

async function loadWorldV2ChunkIndex(generationId = 'v2') {
  const generation = getWorldGenerationConfig(generationId);
  if (WORLD_V2_CHUNK_INDEX_LOADS.has(generation.id)) return WORLD_V2_CHUNK_INDEX_LOADS.get(generation.id);
  const loadPromise = (async () => {
    const indexUrl = resolveAssetUrl(`maps/${generation.chunkIndexFile}`);
    const query = `v=${generation.chunkAssetVersion}`;
    const index = await fetch(`${indexUrl}?${query}`, { cache: 'force-cache' }).then((response) => response.json());
    const tilesets = await loadTiledTilesets(index.tilesets, indexUrl, {
      cacheBust: query,
      fetchCache: 'force-cache',
    });
    return {
      ...index,
      indexUrl,
      tilesets,
      chunkById: new globalThis.Map((index.chunks ?? []).map((chunk) => [chunk.id, chunk])),
    };
  })();
  WORLD_V2_CHUNK_INDEX_LOADS.set(generation.id, loadPromise);
  return loadPromise;
}

async function loadWorldV2Registry(generationId = 'v2') {
  const generation = getWorldGenerationConfig(generationId);
  if (WORLD_V2_REGISTRY_LOADS.has(generation.id)) return WORLD_V2_REGISTRY_LOADS.get(generation.id);
  const loadPromise = fetch(`${resolveAssetUrl(`maps/${generation.registryFile}`)}?v=${generation.chunkAssetVersion}`, {
    cache: 'force-cache',
  }).then((response) => response.json());
  WORLD_V2_REGISTRY_LOADS.set(generation.id, loadPromise);
  return loadPromise;
}

async function loadWorldV2ChunkMap(chunkId, generationId = 'v2') {
  const generation = getWorldGenerationConfig(generationId);
  const index = await loadWorldV2ChunkIndex(generation.id);
  const chunkInfo = index.chunkById.get(chunkId);
  if (!chunkInfo) throw new Error(`Missing ${generation.id} chunk: ${chunkId}`);
  const chunkUrl = resolveAssetUrl(chunkInfo.file, index.indexUrl);
  const map = await fetch(`${chunkUrl}?v=${index.version ?? generation.chunkAssetVersion}`, { cache: 'force-cache' })
    .then((response) => response.json());
  await decodeTiledMapLayers(map);
  const offsetX = safeNumber(chunkInfo.x, map.chunkX * WORLD_V2_CHUNK_TILES) * WORLD.tile;
  const offsetY = safeNumber(chunkInfo.y, map.chunkY * WORLD_V2_CHUNK_TILES) * WORLD.tile;
  const mapId = getWorldV2MapIdFromPoint(
    offsetX + (map.width * map.tilewidth) / 2,
    offsetY + (map.height * map.tileheight) / 2,
    generation.id,
  ) ?? `world_region_2_2_${generation.id}`;
  const chunk = {
    chunkId,
    generationId: generation.id,
    chunkX: safeNumber(map.chunkX, chunkInfo.chunkX),
    chunkY: safeNumber(map.chunkY, chunkInfo.chunkY),
    offsetX,
    offsetY,
    mapId,
    map,
    tilesets: index.tilesets,
  };

  chunk.zones = normalizeWorldV2ChunkObjects(chunk, 'Zones', generation.id);
  chunk.spawns = [
    ...normalizeWorldV2ChunkObjects(chunk, 'Spawns', generation.id),
    ...normalizeWorldV2ChunkObjects(chunk, 'BossSpawns', generation.id),
  ];
  chunk.bossSpawns = chunk.spawns.filter((spawn) => spawn.props.bossType || String(spawn.name ?? '').toLowerCase().includes('boss'));
  chunk.enemySpawns = chunk.spawns.filter((spawn) => !chunk.bossSpawns.includes(spawn) && spawn.props.enemyType);
  chunk.npcs = normalizeWorldV2ChunkObjects(chunk, 'NPCs', generation.id);
  chunk.questGivers = normalizeWorldV2ChunkObjects(chunk, 'QuestGiver', generation.id)
    .map((giver, indexInLayer) => normalizeQuestGiver(giver, chunk.mapId, indexInLayer));
  chunk.raceStarts = normalizeWorldV2ChunkObjects(chunk, 'raceStart', generation.id);
  chunk.interiorZones = normalizeWorldV2ChunkObjects(chunk, 'InteriorZones', generation.id);
  chunk.transitions = normalizeWorldV2ChunkObjects(chunk, 'Transitions', generation.id)
    .map((transition) => ({ ...transition, layerName: 'Transitions' }));
  chunk.graveyards = normalizeWorldV2ChunkObjects(chunk, 'Graveyards', generation.id);
  chunk.regionMarkers = normalizeWorldV2ChunkObjects(chunk, 'RegionMarkers', generation.id);
  chunk.roadMarkers = normalizeWorldV2ChunkObjects(chunk, 'RoadMarkers', generation.id);
  chunk.landmarks = normalizeWorldV2ChunkObjects(chunk, 'Landmarks', generation.id);
  return chunk;
}

function offsetWorldV2Object(object, region) {
  const localX = safeNumber(object?.x, 0);
  const localY = safeNumber(object?.y, 0);
  const objectMapId = normalizeMapId(object?.sourceMapId ?? object?.mapId ?? region.mapId);
  return {
    ...object,
    x: region.offsetX + localX,
    y: region.offsetY + localY,
    localX,
    localY,
    mapId: objectMapId,
    regionMapId: objectMapId,
    props: {
      ...(object?.props ?? {}),
      mapId: objectMapId,
      regionMapId: objectMapId,
    },
  };
}

function createWorldV2Composite(regionMaps, centerMapId) {
  const generationId = getWorldGenerationIdFromMapId(centerMapId);
  const loadedRegions = regionMaps
    .filter((entry) => entry?.tiled?.map)
    .map((entry) => {
      const coords = getWorldV2RegionCoordsFromMapId(entry.mapId);
      const offset = getWorldV2RegionOffset(coords);
      return {
        mapId: entry.mapId,
        regionX: coords?.regionX ?? 0,
        regionY: coords?.regionY ?? 0,
        offsetX: offset.x,
        offsetY: offset.y,
        map: entry.tiled.map,
        tilesets: entry.tiled.tilesets,
        tiled: entry.tiled,
      };
    })
    .sort((a, b) => (a.regionY - b.regionY) || (a.regionX - b.regionX));
  const sampleMap = loadedRegions[0]?.map;
  const map = {
    ...(sampleMap ?? {}),
    width: WORLD_V2_WORLD_TILES,
    height: WORLD_V2_WORLD_TILES,
    tilewidth: sampleMap?.tilewidth ?? WORLD.tile,
    tileheight: sampleMap?.tileheight ?? WORLD.tile,
    layers: [],
  };
  const loadedRegionMap = new globalThis.Map(loadedRegions.map((region) => [region.mapId, region]));
  const mergeObjects = (key) => loadedRegions.flatMap((region) => (
    (region.tiled?.[key] ?? []).map((object) => offsetWorldV2Object(object, region))
  ));

  return {
    isRegionWorld: true,
    worldGenerationId: generationId,
    mapId: normalizeMapId(centerMapId),
    map,
    tilesets: loadedRegions[0]?.tilesets ?? [],
    loadedRegions,
    loadedRegionMap,
    worldPixelWidth: WORLD_V2_WORLD_PIXEL_SIZE,
    worldPixelHeight: WORLD_V2_WORLD_PIXEL_SIZE,
    zones: mergeObjects('zones'),
    spawns: mergeObjects('spawns'),
    enemySpawns: mergeObjects('enemySpawns'),
    bossSpawns: mergeObjects('bossSpawns'),
    npcs: mergeObjects('npcs'),
    questGivers: mergeObjects('questGivers'),
    raceStarts: mergeObjects('raceStarts'),
    interiorZones: mergeObjects('interiorZones'),
    transitions: mergeObjects('transitions'),
    graveyards: mergeObjects('graveyards'),
    regionMarkers: mergeObjects('regionMarkers'),
    roadMarkers: mergeObjects('roadMarkers'),
    landmarks: mergeObjects('landmarks'),
  };
}

function normalizeWorldV2ChunkObjects(chunk, layerName, generationId = chunk?.generationId ?? 'v2') {
  const generation = getWorldGenerationConfig(generationId);
  const layer = chunk.map.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === layerName);
  return (layer?.objects ?? []).map((object) => ({
    ...object,
    props: getProperties(object),
    mapId: getWorldV2MapIdFromPoint(
      chunk.offsetX + safeNumber(object.x, 0),
      chunk.offsetY + safeNumber(object.y, 0),
      generation.id,
    ) ?? chunk.mapId,
  }));
}

function createWorldV2ChunkComposite(chunks, centerMapId, tilesets, generationId = 'v2') {
  const generation = getWorldGenerationConfig(generationId);
  const loadedRegions = chunks
    .filter((chunk) => chunk?.map)
    .map((chunk) => ({
      mapId: chunk.mapId,
      chunkId: chunk.chunkId,
      chunkX: chunk.chunkX,
      chunkY: chunk.chunkY,
      offsetX: chunk.offsetX,
      offsetY: chunk.offsetY,
      map: chunk.map,
      tilesets,
      tiled: chunk,
    }))
    .sort((a, b) => (a.chunkY - b.chunkY) || (a.chunkX - b.chunkX));
  const sampleMap = loadedRegions[0]?.map;
  const map = {
    ...(sampleMap ?? {}),
    width: WORLD_V2_WORLD_TILES,
    height: WORLD_V2_WORLD_TILES,
    tilewidth: sampleMap?.tilewidth ?? WORLD.tile,
    tileheight: sampleMap?.tileheight ?? WORLD.tile,
    layers: [],
  };
  const loadedChunkMap = new globalThis.Map(loadedRegions.map((chunk) => [chunk.chunkId, chunk]));
  const mergeObjects = (key) => loadedRegions.flatMap((chunk) => (
    (chunk.tiled?.[key] ?? []).map((object) => offsetWorldV2Object(object, chunk))
  ));

  return {
    isRegionWorld: true,
    isChunkWorld: true,
    worldGenerationId: generation.id,
    mapId: normalizeMapId(centerMapId),
    map,
    tilesets,
    loadedRegions,
    loadedChunkMap,
    worldPixelWidth: WORLD_V2_WORLD_PIXEL_SIZE,
    worldPixelHeight: WORLD_V2_WORLD_PIXEL_SIZE,
    zones: mergeObjects('zones'),
    spawns: mergeObjects('spawns'),
    enemySpawns: mergeObjects('enemySpawns'),
    bossSpawns: mergeObjects('bossSpawns'),
    npcs: mergeObjects('npcs'),
    questGivers: mergeObjects('questGivers'),
    raceStarts: mergeObjects('raceStarts'),
    interiorZones: mergeObjects('interiorZones'),
    transitions: mergeObjects('transitions'),
    graveyards: mergeObjects('graveyards'),
    regionMarkers: mergeObjects('regionMarkers'),
    roadMarkers: mergeObjects('roadMarkers'),
    landmarks: mergeObjects('landmarks'),
  };
}

export {
  getProperties,
  getQuestGiverProfile,
  normalizeQuestGiver,
  parseTsxTileset,
  hasTileData,
  inflateBase64Zlib,
  decodeUint32LittleEndian,
  decodeTiledTileLayer,
  decodeTiledMapLayers,
  loadImage,
  loadImageCached,
  loadTiledTilesets,
  hexToRgb,
  shiftHexColor,
  colorDistanceSquared,
  getCharacterSpriteBaseClass,
  getCharacterSpriteCandidates,
  loadCharacterSprite,
  loadCharacterSprites,
  loadEnemySprite,
  loadEnemySprites,
  loadPetSprite,
  loadPetSprites,
  getPetSpriteImage,
  getEnemySpriteId,
  getEnemySpriteImage,
  normalizeCharacterLayerId,
  normalizeOptionalCharacterLayerId,
  getCharacterLayerSelection,
  getCharacterLayerCacheKey,
  loadCharacterLayer,
  loadCharacterLayersForAppearance,
  getCharacterLayerImage,
  resolveAssetUrl,
  normalizeEnemyKind,
  TILED_IMAGE_CACHE,
  TILED_IMAGE_LOADS,
  TILED_TILESET_CACHE,
  TILED_TILESET_LOADS,
  WORLD_V2_CHUNK_INDEX_LOADS,
  WORLD_V2_REGISTRY_LOADS,
  loadTiledMap,
  loadWorldV2ChunkIndex,
  loadWorldV2Registry,
  loadWorldV2ChunkMap,
  offsetWorldV2Object,
  createWorldV2Composite,
  normalizeWorldV2ChunkObjects,
  createWorldV2ChunkComposite,
};
