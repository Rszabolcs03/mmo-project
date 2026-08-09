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
  RACES,
  CLASSES,
  TALENTS,
  CHARACTER_SPRITE_EXPECTED_WIDTH,
  CHARACTER_SPRITE_EXPECTED_HEIGHT,
  CHARACTER_SPRITE_EIGHT_DIRECTION_HEIGHT,
  HUMAN_CHARACTER_SPRITE_EXPECTED_WIDTH,
  HUMAN_CHARACTER_SPRITE_EXPECTED_HEIGHT,
  CHARACTER_SPRITE_VERSION,
  CHARACTER_SPRITE_VARIANTS,
  CHARACTER_SPRITES,
  CHARACTER_SPRITE_LOADS,
  CHARACTER_LAYER_ORDER,
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

function getObjectsWithLayerProps(layer, mapId) {
  const layerProps = getProperties(layer ?? {});
  return (layer?.objects ?? []).map((object) => ({
    ...object,
    props: {
      ...layerProps,
      ...getProperties(object),
    },
    mapId,
    layerName: layer?.name,
  }));
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

function isStreetLampPlaceholder(object, props = null) {
  const markerProps = props ?? (object?.props && typeof object.props === 'object' ? object.props : getProperties(object ?? {}));
  const label = [
    markerProps.type,
    markerProps.name,
    object?.type,
    object?.name,
  ].filter(Boolean).join(' ').toLowerCase();
  return label.includes('street_lamp') || label.includes('street-lamp') || label.includes('street lamp');
}

function isBigStreetLampPlaceholder(object, props = null) {
  const markerProps = props ?? (object?.props && typeof object.props === 'object' ? object.props : getProperties(object ?? {}));
  const label = [
    markerProps.type,
    markerProps.name,
    object?.type,
    object?.name,
  ].filter(Boolean).join(' ').toLowerCase();
  return label.includes('big_street_lamp') || label.includes('big-street-lamp') || label.includes('big street lamp');
}

function isCampFireLightPlaceholder(object, props = null) {
  const markerProps = props ?? (object?.props && typeof object.props === 'object' ? object.props : getProperties(object ?? {}));
  const label = [
    markerProps.type,
    markerProps.name,
    object?.type,
    object?.name,
  ].filter(Boolean).join(' ').toLowerCase();
  return label.includes('camp_fire') || label.includes('camp-fire') || label.includes('camp fire');
}

function isAmbientLightPlaceholder(object, props = null) {
  return isStreetLampPlaceholder(object, props) || isCampFireLightPlaceholder(object, props);
}

function withStreetLampDefaults(object, props) {
  if (!isStreetLampPlaceholder(object, props)) return props;
  const isBigLamp = isBigStreetLampPlaceholder(object, props);
  return {
    ...props,
    type: props.type || (isBigLamp ? 'big_street_lamp' : 'street_lamp'),
    radius: props.radius ?? (isBigLamp ? 188 : 132),
    intensity: props.intensity ?? (isBigLamp ? 0.9 : 0.82),
    color: props.color ?? '#ffd37a',
    activeFrom: props.activeFrom ?? 'evening',
    activeTo: props.activeTo ?? 'dawn',
  };
}

function normalizeLightMarker(object, mapId, index = 0) {
  const baseProps = object?.props && typeof object.props === 'object' ? object.props : getProperties(object);
  const props = withStreetLampDefaults(object, baseProps);
  const layerKey = object?.layerName ? `${object.layerName}-` : '';
  const isTileObject = Number.isFinite(Number(object?.gid)) && Number(object.gid) > 0;
  const sourceX = Number(object?.sourceX ?? object?.x ?? 0);
  const sourceY = Number(object?.sourceY ?? object?.y ?? 0);
  const width = Number(object?.width ?? 0);
  const height = Number(object?.height ?? 0);
  const x = object?.point
    ? sourceX
    : sourceX + width / 2;
  const y = object?.point
    ? sourceY
    : isTileObject
      ? sourceY - height / 2
      : sourceY + height / 2;
  const anchorX = Number.isFinite(Number(object?.anchorX))
    ? Number(object.anchorX)
    : x;
  const anchorY = Number.isFinite(Number(object?.anchorY))
    ? Number(object.anchorY)
    : object?.point
      ? y
      : isTileObject
        ? sourceY
        : sourceY + height;
  const markerType = props.type || object?.type || object?.name || 'light';

  return {
    ...object,
    x,
    y,
    sourceX,
    sourceY,
    anchorX,
    anchorY,
    mapId: object?.mapId ?? mapId,
    id: String(props.id ?? object?.id ?? object?.name ?? `${mapId}-${layerKey}light-${index}`),
    type: markerType,
    radius: props.radius,
    intensity: props.intensity,
    color: props.color,
    activeFrom: props.activeFrom,
    activeTo: props.activeTo,
    alwaysOn: props.alwaysOn,
    props,
  };
}

function normalizeMapProp(object, mapId, layerName = 'Props') {
  const props = object?.props && typeof object.props === 'object' ? object.props : getProperties(object);
  return {
    ...object,
    props,
    mapId,
    layerName,
  };
}

function parseTsxTileset(xmlText) {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml');
  const tileset = document.querySelector('tileset');
  const image = document.querySelector('image');
  if (!tileset || !image) {
    throw new Error('Invalid TSX tileset response');
  }

  const animations = {};
  document.querySelectorAll('tile').forEach((tile) => {
    const tileId = Number(tile.getAttribute('id'));
    const frames = [...tile.querySelectorAll('animation frame')]
      .map((frame) => ({
        tileid: Number(frame.getAttribute('tileid')),
        duration: Number(frame.getAttribute('duration')),
      }))
      .filter((frame) => Number.isFinite(frame.tileid) && frame.duration > 0);
    if (!Number.isFinite(tileId) || frames.length === 0) return;
    animations[tileId] = {
      frames,
      totalDuration: frames.reduce((sum, frame) => sum + frame.duration, 0),
    };
  });

  return {
    columns: Number(tileset.getAttribute('columns')),
    tilewidth: Number(tileset.getAttribute('tilewidth')),
    tileheight: Number(tileset.getAttribute('tileheight')),
    imageSource: image.getAttribute('source'),
    animations,
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

function getAssetFetchOptions(cacheMode = 'force-cache') {
  return {
    cache: import.meta.env.DEV ? 'no-store' : cacheMode,
  };
}

async function loadTiledTilesets(tilesetRefs = [], mapUrl, { cacheBust = null, fetchCache = 'force-cache' } = {}) {
  const query = cacheBust ? `?${cacheBust}` : '';
  return Promise.all(
    tilesetRefs.map(async (tileset) => {
      const tilesetUrl = resolveAssetUrl(tileset.source, mapUrl);
      const cacheKey = `${tileset.firstgid}:${tilesetUrl}:${query}`;
      if (TILED_TILESET_CACHE.has(cacheKey)) return TILED_TILESET_CACHE.get(cacheKey);
      if (TILED_TILESET_LOADS.has(cacheKey)) return TILED_TILESET_LOADS.get(cacheKey);

      const promise = fetch(`${tilesetUrl}${query}`, getAssetFetchOptions(fetchCache))
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
  return [`${classId}-${gender === 'female' ? 'female' : 'male'}`];
}

function loadCharacterSprite(spriteId) {
  const baseClassId = getCharacterSpriteBaseClass(spriteId);
  if (!spriteId || !baseClassId || !CLASSES[baseClassId]) return Promise.resolve(null);
  if (CHARACTER_SPRITES.has(spriteId)) return Promise.resolve(CHARACTER_SPRITES.get(spriteId));
  CHARACTER_SPRITES.set(spriteId, null);
  return Promise.resolve(null);
}

function loadCharacterSprites() {
  const spriteIds = Object.keys(CLASSES).flatMap((classId) => (
    CHARACTER_SPRITE_VARIANTS.map((variant) => `${classId}-${variant}`)
  ));
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

const HUMAN_FRESH_HAIR_STYLES = new Set([
  'cropped',
  'windswept',
  'tousled',
  'tied',
  'long',
  'side-bangs',
  'bun',
  'ponytail',
]);
const HUMAN_FRESH_FACE_STYLES = new Set([
  'natural', 'focused', 'scarred', 'cheerful', 'freckled',
]);

function getCharacterLayerSelection(selectedClass, selectedRace, appearance = {}) {
  const classId = normalizeCharacterLayerId(selectedClass) ?? 'warrior';
  const genderId = normalizeCharacterLayerId(appearance.gender) ?? 'male';
  const bodyId = normalizeCharacterLayerId(appearance.body);
  const outfitId = normalizeCharacterLayerId(appearance.outfit);
  const weaponId = normalizeCharacterLayerId(appearance.weapon);
  const hairId = normalizeCharacterLayerId(appearance.hairAsset) ?? normalizeCharacterLayerId(appearance.hairStyle);
  const beardId = normalizeOptionalCharacterLayerId(appearance.beard);
  const capeId = normalizeOptionalCharacterLayerId(appearance.cape) ?? normalizeOptionalCharacterLayerId(appearance.capeStyle);
  const outfitVariant = normalizeCharacterLayerId(appearance.outfitVariant) ?? 'classic';
  const weaponVariant = normalizeCharacterLayerId(appearance.weaponVariant) ?? 'classic';
  const raceId = normalizeCharacterLayerId(appearance.race)
    ?? (bodyId && !bodyId.includes('-') ? bodyId : null)
    ?? normalizeCharacterLayerId(selectedRace)
    ?? 'human';
  // Every playable race uses one paper-doll contract: cosmetics, clothing and held
  // equipment are independent 96px atlases sharing the same frame grid.
  const usesHumanEightDirectionAssets = Boolean(RACES[raceId]?.allowedClasses?.includes(classId));
  const combatSpec = normalizeCharacterLayerId(
    appearance.combatSpec ?? appearance.talentSpec ?? appearance.spec,
  );
  const usesTankOffhand = usesHumanEightDirectionAssets
    && ['warrior', 'paladin'].includes(classId)
    && TALENTS[classId]?.specs?.[combatSpec]?.role === 'Tank';
  const requestedFaceStyle = normalizeCharacterLayerId(appearance.faceVariant)
    ?.replace(/^(?:male|female)-/, '');
  const faceStyle = HUMAN_FRESH_FACE_STYLES.has(requestedFaceStyle)
    ? requestedFaceStyle
    : 'natural';
  const humanHairAliases = {
    parted: 'windswept',
    bob: 'long',
    wavy: 'bun',
    braid: 'ponytail',
  };
  const rawHumanHairStyleId = hairId?.replace(/^(?:male|female)-/, '');
  const humanHairStyleId = humanHairAliases[rawHumanHairStyleId] ?? rawHumanHairStyleId;
  const fallbackHairStyle = genderId === 'female' ? 'long' : 'cropped';
  const selectedHairStyle = HUMAN_FRESH_HAIR_STYLES.has(humanHairStyleId)
    ? humanHairStyleId
    : fallbackHairStyle;
  const selectedOutfit = usesHumanEightDirectionAssets
    ? `${raceId}-fresh-${classId}-${genderId}-${outfitVariant}`
    : (outfitId && outfitId.includes('-') ? outfitId : `${classId}-${outfitVariant}`);
  const selectedWeapon = usesHumanEightDirectionAssets
    ? `${raceId}-fresh-${classId}-${genderId}-${weaponVariant}`
    : (weaponId && weaponId.includes('-') ? weaponId : `${classId}-${weaponVariant}`);
  const humanCosmeticId = (layerId, gendered = false) => {
    if (!usesHumanEightDirectionAssets || !layerId) return layerId;
    const cosmeticId = layerId.replace(/^human-(?:female-)?/, '');
    return `human-${gendered && genderId === 'female' ? 'female-' : ''}${cosmeticId}`;
  };
  return {
    base: usesHumanEightDirectionAssets
      ? `${raceId}-fresh-body-${genderId}`
      : (bodyId && bodyId.includes('-') ? bodyId : `${raceId}-${genderId}`),
    hair: usesHumanEightDirectionAssets
      ? `${raceId}-fresh-hair-${genderId}-${selectedHairStyle}`
      : humanCosmeticId(hairId, true),
    beard: usesHumanEightDirectionAssets
      ? genderId === 'female' || !beardId
        ? null
        : `${raceId}-fresh-beard-${beardId}`
      : humanCosmeticId(beardId),
    outfit: selectedOutfit,
    face: usesHumanEightDirectionAssets
      ? `${raceId}-fresh-face-${genderId}-${faceStyle}`
      : null,
    weapon: selectedWeapon,
    offhand: usesTankOffhand
      ? `${raceId}-fresh-${classId}-${genderId}-${weaponVariant}`
      : null,
    cape: usesHumanEightDirectionAssets
      ? !capeId
        ? null
        : `${raceId}-fresh-cape-${capeId}`
      : humanCosmeticId(capeId),
    headwear: null,
  };
}

function getHumanLayerPrefix(layerId) {
  return layerId?.match(/^([a-z]+)-fresh-/)?.[0] ?? null;
}

function getHumanClassLayerId(layerId) {
  if (typeof layerId !== 'string' || !getHumanLayerPrefix(layerId)) return null;
  const prefix = getHumanLayerPrefix(layerId);
  return Object.keys(CLASSES).find((classId) => (
    layerId === `${prefix}${classId}` || layerId.startsWith(`${prefix}${classId}-`)
  )) ?? null;
}

function getHumanClassLayerGenderId(layerId, humanClassId = getHumanClassLayerId(layerId)) {
  if (!humanClassId) return null;
  const prefix = getHumanLayerPrefix(layerId);
  const suffix = layerId.slice(`${prefix}${humanClassId}-`.length);
  const genderId = suffix.split('-')[0];
  return genderId === 'female' ? 'female' : 'male';
}

function getHumanClassLayerVariantId(layerId, humanClassId = getHumanClassLayerId(layerId)) {
  if (!humanClassId) return 'classic';
  const prefix = getHumanLayerPrefix(layerId);
  const suffix = layerId.slice(`${prefix}${humanClassId}-`.length);
  const parts = suffix.split('-');
  return parts.length > 1 ? parts.slice(1).join('-') : 'classic';
}

function getCharacterLayerSourceId(layer, layerId) {
  return layerId;
}

function getCharacterLayerAssetPath(layer, layerId) {
  if (!layer || !layerId) return null;

  if (layer === 'face') {
    const freshMatch = layerId.match(/^([a-z]+)-fresh-face-(male|female)-(.+)$/);
    if (!freshMatch || !RACES[freshMatch[1]] || !HUMAN_FRESH_FACE_STYLES.has(freshMatch[3])) return null;
    return `${freshMatch[1]}_fresh/faces/${freshMatch[2]}/${freshMatch[3]}.png`;
  }

  if (layer === 'headwear') return null;

  if (layer === 'base') {
    const freshMatch = layerId.match(/^([a-z]+)-fresh-body-(male|female)$/);
    if (freshMatch && RACES[freshMatch[1]]) return `${freshMatch[1]}_fresh/bodies/${freshMatch[2]}.png`;
    const match = layerId.match(/^(.+)-(male|female)$/);
    return match ? `bases/${match[1]}/${match[2]}.png` : null;
  }

  if (layer === 'hair' || layer === 'beard' || layer === 'cape') {
    const category = layer === 'hair' ? 'hair' : layer === 'beard' ? 'beards' : 'capes';
    if (layer === 'hair') {
      const freshMatch = layerId.match(
        /^([a-z]+)-fresh-hair-(male|female)-(cropped|windswept|tousled|tied|long|side-bangs|bun|ponytail)$/,
      );
      if (freshMatch && RACES[freshMatch[1]]) return `${freshMatch[1]}_fresh/hair/${freshMatch[2]}/${freshMatch[3]}.png`;
    }
    const beardMatch = layerId.match(/^([a-z]+)-fresh-beard-(short|full)$/);
    if (layer === 'beard' && beardMatch && RACES[beardMatch[1]]) {
      return `${beardMatch[1]}_fresh/beards/${beardMatch[2]}.png`;
    }
    const capeMatch = layerId.match(/^([a-z]+)-fresh-cape-(short|long)$/);
    if (layer === 'cape' && capeMatch && RACES[capeMatch[1]]) {
      return `${capeMatch[1]}_fresh/capes/${capeMatch[2]}.png`;
    }
    return `cosmetics/${category}/${layerId}.png`;
  }

  const humanClassId = getHumanClassLayerId(layerId);
  if ((layer === 'outfit' || layer === 'weapon' || layer === 'offhand') && humanClassId) {
    const genderId = getHumanClassLayerGenderId(layerId, humanClassId);
    const variantId = getHumanClassLayerVariantId(layerId, humanClassId);
    const freshPrefix = getHumanLayerPrefix(layerId);
    if (freshPrefix) {
      const freshRaceId = freshPrefix.slice(0, -'-fresh-'.length);
      const category = layer === 'outfit' ? 'outfits' : layer === 'offhand' ? 'offhands' : 'weapons';
      return `${freshRaceId}_fresh/classes/${humanClassId}/${genderId}/${category}/${variantId}.png`;
    }
    return null;
  }

  if (layer === 'outfit' || layer === 'weapon') {
    const classId = Object.keys(CLASSES).find((candidate) => layerId.startsWith(`${candidate}-`));
    if (!classId) return null;
    const variantId = layerId.slice(classId.length + 1);
    const category = layer === 'outfit' ? 'outfits' : 'weapons';
    return variantId ? `classes/${classId}/shared/${category}/${variantId}.png` : null;
  }

  return null;
}

function getCharacterLayerCacheKey(layer, layerId) {
  return `${layer}:${getCharacterLayerSourceId(layer, layerId)}`;
}

function loadCharacterLayer(layer, layerId) {
  const assetPath = getCharacterLayerAssetPath(layer, layerId);
  if (!assetPath) return Promise.resolve(null);

  const cacheKey = getCharacterLayerCacheKey(layer, layerId);
  if (CHARACTER_LAYER_IMAGES.has(cacheKey)) return Promise.resolve(CHARACTER_LAYER_IMAGES.get(cacheKey));
  if (CHARACTER_LAYER_LOADS.has(cacheKey)) return CHARACTER_LAYER_LOADS.get(cacheKey);

  const promise = loadImage(`${resolveAssetUrl(`assets/characters/${assetPath}`)}?v=${CHARACTER_SPRITE_VERSION}`)
    .then((image) => {
      const isLargeHuman = Boolean(getHumanLayerPrefix(layerId));
      const supportedHeight = isLargeHuman
        ? image.naturalHeight === HUMAN_CHARACTER_SPRITE_EXPECTED_HEIGHT
        : image.naturalHeight === CHARACTER_SPRITE_EXPECTED_HEIGHT
          || image.naturalHeight === CHARACTER_SPRITE_EIGHT_DIRECTION_HEIGHT;
      const expectedWidth = isLargeHuman
        ? HUMAN_CHARACTER_SPRITE_EXPECTED_WIDTH
        : CHARACTER_SPRITE_EXPECTED_WIDTH;
      if (image.naturalWidth !== expectedWidth || !supportedHeight) {
        console.warn(`Character layer ${cacheKey} should be ${expectedWidth}px wide with a supported character-sheet height, got ${image.naturalWidth}x${image.naturalHeight}.`);
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
const LIGHT_MARKER_LAYER_NAMES = ['LightMarkers', 'Lights', 'LightObjects', 'Lighting'];

async function loadTiledMap(mapId = 'world') {
  const normalizedMapId = normalizeMapId(mapId);
  const cacheBust = `v=${Date.now()}`;
  const fileName = MAP_FILES[normalizedMapId] ?? MAP_FILES.world;
  const mapUrl = resolveAssetUrl(`maps/${fileName}`);
  const map = await fetch(`${mapUrl}?${cacheBust}`, getAssetFetchOptions('no-store')).then((response) => response.json());
  await decodeTiledMapLayers(map);
  const tilesets = await loadTiledTilesets(map.tilesets, mapUrl, { cacheBust, fetchCache: 'no-store' });
  const zonesLayer = map.layers.find((layer) => layer.name === 'Zones');
  const spawnsLayers = map.layers.filter((layer) => ['Spawns', 'CaveSpawns', 'InteriorSpawns'].includes(layer.name));
  const bossSpawnsLayers = map.layers.filter((layer) => ['BossSpawns', 'CaveBossSpawns', 'InteriorBossSpawns'].includes(layer.name));
  const npcsLayer = map.layers.find((layer) => layer.name === 'NPCs');
  const questGiversLayer = map.layers.find((layer) => layer.name === 'QuestGiver');
  const raceStartsLayer = map.layers.find((layer) => layer.name === 'raceStart');
  const interiorZonesLayer = map.layers.find((layer) => layer.name === 'InteriorZones');
  const cavesLayer = map.layers.find((layer) => layer.type === 'objectgroup' && layer.name === 'Caves');
  const regionMarkersLayer = map.layers.find((layer) => layer.name === 'RegionMarkers');
  const roadMarkersLayer = map.layers.find((layer) => layer.name === 'RoadMarkers');
  const landmarksLayer = map.layers.find((layer) => layer.name === 'Landmarks');
  const propsLayers = map.layers.filter((layer) => (
    layer.type === 'objectgroup' && ['Props', 'CaveProps', 'InteriorProps'].includes(layer.name)
  ));
  const lightMarkerLayers = map.layers.filter((layer) => (
    layer.type === 'objectgroup' && LIGHT_MARKER_LAYER_NAMES.includes(layer.name)
  ));
  const streetLampPlaceholderLayers = map.layers.filter((layer) => (
    layer.type === 'objectgroup' && !LIGHT_MARKER_LAYER_NAMES.includes(layer.name)
  ));
  const transitionLayers = map.layers.filter((layer) => (
    layer.type === 'objectgroup'
    && ['Transitions', 'Dungeon_transition', 'Dungeon_transitions', 'DungeonTransitions'].includes(layer.name)
  ));
  const graveyardsLayer = map.layers.find((layer) => ['Graveyard', 'Graveyards', 'graveyard'].includes(layer.name));
  const spawns = [
    ...spawnsLayers.flatMap((layer) => getObjectsWithLayerProps(layer, normalizedMapId)),
    ...bossSpawnsLayers.flatMap((layer) => getObjectsWithLayerProps(layer, normalizedMapId)),
  ];
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
    caveZones: (cavesLayer?.objects ?? []).map((zone) => ({ ...zone, props: getProperties(zone), mapId: normalizedMapId, layerName: 'Caves' })),
    transitions: transitionLayers.flatMap((layer) => (
      (layer.objects ?? []).map((transition) => ({ ...transition, props: getProperties(transition), mapId: normalizedMapId, layerName: layer.name }))
    )),
    graveyards: (graveyardsLayer?.objects ?? []).map((graveyard) => ({ ...graveyard, props: getProperties(graveyard), mapId: normalizedMapId })),
    regionMarkers: (regionMarkersLayer?.objects ?? []).map((marker) => ({ ...marker, props: getProperties(marker), mapId: normalizedMapId })),
    roadMarkers: (roadMarkersLayer?.objects ?? []).map((marker) => ({ ...marker, props: getProperties(marker), mapId: normalizedMapId })),
    landmarks: (landmarksLayer?.objects ?? []).map((landmark) => ({ ...landmark, props: getProperties(landmark), mapId: normalizedMapId })),
    props: propsLayers.flatMap((layer) => (
      getObjectsWithLayerProps(layer, normalizedMapId).map((prop) => normalizeMapProp(prop, normalizedMapId, layer.name))
    )),
    lightMarkers: [
      ...lightMarkerLayers.flatMap((layer, layerIndex) => (
        (layer.objects ?? []).map((marker, index) => normalizeLightMarker(
          { ...marker, layerName: layer.name },
          normalizedMapId,
          `${layerIndex}-${index}`,
        ))
      )),
      ...streetLampPlaceholderLayers.flatMap((layer, layerIndex) => (
        (layer.objects ?? [])
          .filter((marker) => isAmbientLightPlaceholder(marker))
          .map((marker, index) => normalizeLightMarker(
            { ...marker, layerName: layer.name },
            normalizedMapId,
            `street-lamp-${layerIndex}-${index}`,
          ))
      )),
    ],
  };
}

async function loadWorldV2ChunkIndex(generationId = 'v2') {
  const generation = getWorldGenerationConfig(generationId);
  if (WORLD_V2_CHUNK_INDEX_LOADS.has(generation.id)) return WORLD_V2_CHUNK_INDEX_LOADS.get(generation.id);
  const loadPromise = (async () => {
    const indexUrl = resolveAssetUrl(`maps/${generation.chunkIndexFile}`);
    const query = import.meta.env.DEV ? `v=${Date.now()}` : `v=${generation.chunkAssetVersion}`;
    const index = await fetch(`${indexUrl}?${query}`, getAssetFetchOptions(import.meta.env.DEV ? 'no-store' : 'force-cache'))
      .then((response) => response.json());
    const tilesets = await loadTiledTilesets(index.tilesets, indexUrl, {
      cacheBust: query,
      fetchCache: import.meta.env.DEV ? 'no-store' : 'force-cache',
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
  const loadPromise = fetch(`${resolveAssetUrl(`maps/${generation.registryFile}`)}?v=${import.meta.env.DEV ? Date.now() : generation.chunkAssetVersion}`, getAssetFetchOptions(import.meta.env.DEV ? 'no-store' : 'force-cache'))
    .then((response) => response.json());
  WORLD_V2_REGISTRY_LOADS.set(generation.id, loadPromise);
  return loadPromise;
}

async function loadWorldV2ChunkMap(chunkId, generationId = 'v2') {
  const generation = getWorldGenerationConfig(generationId);
  const index = await loadWorldV2ChunkIndex(generation.id);
  const chunkInfo = index.chunkById.get(chunkId);
  if (!chunkInfo) throw new Error(`Missing ${generation.id} chunk: ${chunkId}`);
  const chunkUrl = resolveAssetUrl(chunkInfo.file, index.indexUrl);
  const chunkVersion = import.meta.env.DEV ? Date.now() : (index.version ?? generation.chunkAssetVersion);
  const map = await fetch(`${chunkUrl}?v=${chunkVersion}`, getAssetFetchOptions(import.meta.env.DEV ? 'no-store' : 'force-cache'))
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
    ...normalizeWorldV2ChunkObjectsFromLayers(chunk, ['Spawns', 'CaveSpawns', 'InteriorSpawns'], generation.id),
    ...normalizeWorldV2ChunkObjectsFromLayers(chunk, ['BossSpawns', 'CaveBossSpawns', 'InteriorBossSpawns'], generation.id),
  ];
  chunk.bossSpawns = chunk.spawns.filter((spawn) => spawn.props.bossType || String(spawn.name ?? '').toLowerCase().includes('boss'));
  chunk.enemySpawns = chunk.spawns.filter((spawn) => !chunk.bossSpawns.includes(spawn) && spawn.props.enemyType);
  chunk.npcs = normalizeWorldV2ChunkObjects(chunk, 'NPCs', generation.id);
  chunk.questGivers = normalizeWorldV2ChunkObjects(chunk, 'QuestGiver', generation.id)
    .map((giver, indexInLayer) => normalizeQuestGiver(giver, chunk.mapId, indexInLayer));
  chunk.raceStarts = normalizeWorldV2ChunkObjects(chunk, 'raceStart', generation.id);
  chunk.interiorZones = normalizeWorldV2ChunkObjects(chunk, 'InteriorZones', generation.id);
  chunk.caveZones = normalizeWorldV2ChunkObjects(chunk, 'Caves', generation.id)
    .map((zone) => ({ ...zone, layerName: 'Caves' }));
  chunk.transitions = normalizeWorldV2ChunkObjects(chunk, 'Transitions', generation.id)
    .map((transition) => ({ ...transition, layerName: 'Transitions' }));
  chunk.graveyards = normalizeWorldV2ChunkObjects(chunk, 'Graveyards', generation.id);
  chunk.regionMarkers = normalizeWorldV2ChunkObjects(chunk, 'RegionMarkers', generation.id);
  chunk.roadMarkers = normalizeWorldV2ChunkObjects(chunk, 'RoadMarkers', generation.id);
  chunk.landmarks = normalizeWorldV2ChunkObjects(chunk, 'Landmarks', generation.id);
  chunk.props = normalizeWorldV2ChunkObjectsFromLayers(chunk, ['Props', 'CaveProps', 'InteriorProps'], generation.id);
  chunk.lightMarkers = [
    ...normalizeWorldV2ChunkObjectsFromLayers(chunk, LIGHT_MARKER_LAYER_NAMES, generation.id),
    ...normalizeWorldV2ChunkStreetLampPlaceholders(chunk, generation.id),
  ]
    .map((marker, index) => normalizeLightMarker(marker, marker.mapId ?? chunk.mapId, index));
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
    ...(Number.isFinite(Number(object?.sourceX)) ? { sourceX: region.offsetX + safeNumber(object.sourceX, localX) } : {}),
    ...(Number.isFinite(Number(object?.sourceY)) ? { sourceY: region.offsetY + safeNumber(object.sourceY, localY) } : {}),
    ...(Number.isFinite(Number(object?.anchorX)) ? { anchorX: region.offsetX + safeNumber(object.anchorX, localX) } : {}),
    ...(Number.isFinite(Number(object?.anchorY)) ? { anchorY: region.offsetY + safeNumber(object.anchorY, localY) } : {}),
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
    caveZones: mergeObjects('caveZones'),
    transitions: mergeObjects('transitions'),
    graveyards: mergeObjects('graveyards'),
    regionMarkers: mergeObjects('regionMarkers'),
    roadMarkers: mergeObjects('roadMarkers'),
    landmarks: mergeObjects('landmarks'),
    props: mergeObjects('props'),
    lightMarkers: mergeObjects('lightMarkers'),
  };
}

function normalizeWorldV2ChunkObjectsFromLayers(chunk, layerNames, generationId = chunk?.generationId ?? 'v2') {
  return layerNames.flatMap((layerName) => (
    normalizeWorldV2ChunkObjects(chunk, layerName, generationId)
      .map((object) => ({ ...object, layerName }))
  ));
}

function normalizeWorldV2ChunkStreetLampPlaceholders(chunk, generationId = chunk?.generationId ?? 'v2') {
  const generation = getWorldGenerationConfig(generationId);
  return chunk.map.layers
    .filter((layer) => layer.type === 'objectgroup' && !LIGHT_MARKER_LAYER_NAMES.includes(layer.name))
    .flatMap((layer) => (
      (layer.objects ?? [])
        .filter((object) => isAmbientLightPlaceholder(object))
        .map((object) => ({
          ...object,
          layerName: layer.name,
          props: getProperties(object),
          mapId: getWorldV2MapIdFromPoint(
            chunk.offsetX + safeNumber(object.x, 0),
            chunk.offsetY + safeNumber(object.y, 0),
            generation.id,
          ) ?? chunk.mapId,
        }))
    ));
}

function normalizeWorldV2ChunkObjects(chunk, layerName, generationId = chunk?.generationId ?? 'v2') {
  const generation = getWorldGenerationConfig(generationId);
  const layer = chunk.map.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === layerName);
  const layerProps = getProperties(layer ?? {});
  return (layer?.objects ?? []).map((object) => ({
    ...object,
    props: {
      ...layerProps,
      ...getProperties(object),
    },
    mapId: getWorldV2MapIdFromPoint(
      chunk.offsetX + safeNumber(object.x, 0),
      chunk.offsetY + safeNumber(object.y, 0),
      generation.id,
    ) ?? chunk.mapId,
  }));
}

function createWorldV2ChunkComposite(chunks, centerMapId, tilesets, generationId = 'v2', chunkIndex = null) {
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
  const indexedGraveyards = Array.isArray(chunkIndex?.graveyards)
    ? chunkIndex.graveyards.map((graveyard) => ({
        ...graveyard,
        props: graveyard?.props && typeof graveyard.props === 'object'
          ? graveyard.props
          : getProperties(graveyard ?? {}),
        mapId: normalizeMapId(graveyard?.mapId ?? graveyard?.sourceMapId ?? centerMapId),
      }))
    : [];

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
    caveZones: mergeObjects('caveZones'),
    transitions: mergeObjects('transitions'),
    graveyards: indexedGraveyards.length ? indexedGraveyards : mergeObjects('graveyards'),
    regionMarkers: mergeObjects('regionMarkers'),
    roadMarkers: mergeObjects('roadMarkers'),
    landmarks: mergeObjects('landmarks'),
    props: mergeObjects('props'),
    lightMarkers: mergeObjects('lightMarkers'),
  };
}

export {
  getProperties,
  getQuestGiverProfile,
  normalizeQuestGiver,
  normalizeLightMarker,
  normalizeMapProp,
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
  getCharacterLayerAssetPath,
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
  normalizeWorldV2ChunkObjectsFromLayers,
  normalizeWorldV2ChunkObjects,
  createWorldV2ChunkComposite,
};
