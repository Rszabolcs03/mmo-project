import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 32;
const TILESET_NAME = 'tamzia_fountain_v1';
const MAP_ID = 'continent_01_region_0_0';
const MAP_PATH = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions/continent_01_region_0_0.tmj');
const CHUNK_DIR = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions/chunks');
const CHUNK_INDEX_PATH = path.join(CHUNK_DIR, 'continent_01_chunks.json');
const CHUNK_PATH = path.join(CHUNK_DIR, 'chunk_3_3.json');
const CONTINENT_TILESET_DIR = path.join(ROOT, 'public/maps/world_map/continents/continent_01/tilesets');
const MAP_TILESET_SOURCE = `../tilesets/${TILESET_NAME}.tsx`;
const CHUNK_TILESET_SOURCE = `../../tilesets/${TILESET_NAME}.tsx`;

const FOUNTAIN = {
  objectId: 144,
  lightId: 169,
  name: 'tamzia_city_fountain',
  lightName: 'tamzia_city_fountain_light',
  displayName: 'Tamzia City Fountain',
  x: 15392,
  y: 14112,
  width: 352,
  height: 352,
  lightX: 15568,
  lightY: 14288,
  chunkX: 3,
  chunkY: 3,
};

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function prop(name, type, value) {
  return { name, type, value };
}

function normalizeSource(source) {
  return String(source ?? '').replace(/\\/g, '/');
}

function resolveTilesetPath(baseFilePath, source) {
  return path.resolve(path.dirname(baseFilePath), normalizeSource(source));
}

function getTileCount(baseFilePath, source) {
  const tilesetPath = resolveTilesetPath(baseFilePath, source);
  if (!existsSync(tilesetPath)) return 1;
  const text = readFileSync(tilesetPath, 'utf8');
  const tilecount = Number(text.match(/tilecount="(\d+)"/)?.[1] ?? 0);
  return Number.isFinite(tilecount) && tilecount > 0 ? tilecount : 1;
}

function getNextFirstgid(tilesets, baseFilePath) {
  return (tilesets ?? []).reduce((next, tileset) => {
    const firstgid = Number(tileset.firstgid ?? 0);
    if (!Number.isFinite(firstgid) || firstgid <= 0) return next;
    return Math.max(next, firstgid + getTileCount(baseFilePath, tileset.source));
  }, 1);
}

function upsertTileset(tilesets, source, baseFilePath) {
  const normalized = normalizeSource(source);
  const existing = (tilesets ?? []).find((tileset) => normalizeSource(tileset.source) === normalized);
  if (existing) return Number(existing.firstgid);
  const firstgid = getNextFirstgid(tilesets, baseFilePath);
  tilesets.push({ firstgid, source: normalized });
  return firstgid;
}

function objectLayer(map, name, insertAfterName = null) {
  const existing = map.layers.find((layer) => layer.type === 'objectgroup' && layer.name === name);
  if (existing) {
    existing.visible ??= true;
    existing.opacity ??= 1;
    existing.objects ??= [];
    return existing;
  }
  const layer = { type: 'objectgroup', name, visible: true, opacity: 1, objects: [] };
  const insertAfterIndex = insertAfterName
    ? map.layers.findIndex((candidate) => candidate.name === insertAfterName)
    : -1;
  map.layers.splice(insertAfterIndex >= 0 ? insertAfterIndex + 1 : map.layers.length, 0, layer);
  return layer;
}

function upsertObject(objects, object, match) {
  const index = objects.findIndex(match);
  if (index >= 0) {
    objects[index] = { ...objects[index], ...object };
    return objects[index];
  }
  objects.push(object);
  return object;
}

function maxObjectId(map) {
  return Math.max(
    0,
    ...(map.layers ?? [])
      .filter((layer) => Array.isArray(layer.objects))
      .flatMap((layer) => layer.objects.map((object) => Number(object.id ?? 0))),
  );
}

function fountainProperties() {
  return [
    prop('type', 'string', 'tamzia_fountain'),
    prop('displayName', 'string', FOUNTAIN.displayName),
    prop('spriteSheet', 'string', TILESET_NAME),
    prop('glowColor', 'string', '#6df6ff'),
    prop('color', 'string', '#9fefff'),
    prop('radius', 'int', 470),
    prop('intensity', 'float', 0.72),
    prop('activeFrom', 'string', 'evening'),
    prop('activeTo', 'string', 'dawn'),
    prop('showOnMap', 'bool', false),
  ];
}

function fountainLightProperties() {
  return [
    prop('type', 'string', 'tamzia_fountain_light'),
    prop('displayName', 'string', `${FOUNTAIN.displayName} Light`),
    prop('color', 'string', '#9fefff'),
    prop('radius', 'int', 470),
    prop('intensity', 'float', 0.72),
    prop('activeFrom', 'string', 'evening'),
    prop('activeTo', 'string', 'dawn'),
  ];
}

function makeRegionFountainObject(firstgid) {
  return {
    gid: firstgid,
    height: FOUNTAIN.height,
    id: FOUNTAIN.objectId,
    name: FOUNTAIN.name,
    opacity: 1,
    properties: fountainProperties(),
    rotation: 0,
    type: 'fountain',
    visible: true,
    width: FOUNTAIN.width,
    x: FOUNTAIN.x,
    y: FOUNTAIN.y + FOUNTAIN.height,
  };
}

function makeRegionLightObject(id = FOUNTAIN.lightId) {
  return {
    height: 0,
    id,
    name: FOUNTAIN.lightName,
    opacity: 1,
    point: true,
    properties: fountainLightProperties(),
    rotation: 0,
    type: 'light',
    visible: true,
    width: 0,
    x: FOUNTAIN.lightX,
    y: FOUNTAIN.lightY,
  };
}

function toChunkObject(object, chunk, chunkFirstgid, regionFirstgid) {
  const chunkOffsetX = chunk.tileX * TILE;
  const chunkOffsetY = chunk.tileY * TILE;
  return {
    ...object,
    gid: Number(object.gid ?? 0) >= regionFirstgid
      ? Number(object.gid) + (chunkFirstgid - regionFirstgid)
      : object.gid,
    x: Number(object.x ?? 0) - chunkOffsetX,
    y: Number(object.y ?? 0) - chunkOffsetY,
    sourceMapId: MAP_ID,
  };
}

function toChunkLight(object, chunk) {
  const chunkOffsetX = chunk.tileX * TILE;
  const chunkOffsetY = chunk.tileY * TILE;
  return {
    ...object,
    x: Number(object.x ?? 0) - chunkOffsetX,
    y: Number(object.y ?? 0) - chunkOffsetY,
    sourceMapId: MAP_ID,
  };
}

function assertGeneratedTilesetFiles() {
  const required = [
    path.join(ROOT, 'public/assets/tilesets', `${TILESET_NAME}.png`),
    path.join(ROOT, 'public/tilesets', `${TILESET_NAME}.tsx`),
    path.join(CONTINENT_TILESET_DIR, `${TILESET_NAME}.png`),
    path.join(CONTINENT_TILESET_DIR, `${TILESET_NAME}.tsx`),
  ];
  const missing = required.filter((filePath) => !existsSync(filePath));
  if (missing.length) {
    throw new Error(`Missing generated fountain assets. Run node scripts/generate-tamzia-fountain-sprite.mjs first.\n${missing.join('\n')}`);
  }
}

function updateRegionMap() {
  const map = readJson(MAP_PATH);
  const regionFirstgid = upsertTileset(map.tilesets, MAP_TILESET_SOURCE, MAP_PATH);

  const props = objectLayer(map, 'Props');
  upsertObject(
    props.objects,
    makeRegionFountainObject(regionFirstgid),
    (object) => Number(object.id) === FOUNTAIN.objectId || object.name === FOUNTAIN.name,
  );

  const lights = objectLayer(map, 'LightMarkers', 'Props');
  const existingLight = lights.objects.find((object) => object.name === FOUNTAIN.lightName);
  const lightId = existingLight?.id ?? Math.max(Number(map.nextobjectid ?? 1), FOUNTAIN.lightId, maxObjectId(map) + 1);
  upsertObject(
    lights.objects,
    makeRegionLightObject(lightId),
    (object) => object.name === FOUNTAIN.lightName,
  );

  map.nextobjectid = Math.max(Number(map.nextobjectid ?? 1), maxObjectId(map) + 1);
  writeJson(MAP_PATH, map);
  return { regionFirstgid, lightId };
}

function updateChunkIndex() {
  const index = readJson(CHUNK_INDEX_PATH);
  const chunkFirstgid = upsertTileset(index.tilesets, CHUNK_TILESET_SOURCE, CHUNK_INDEX_PATH);
  writeJson(CHUNK_INDEX_PATH, index);
  return chunkFirstgid;
}

function updateChunk(regionFirstgid, chunkFirstgid, lightId) {
  const chunk = readJson(CHUNK_PATH);
  const props = objectLayer(chunk, 'Props');
  const regionFountain = makeRegionFountainObject(regionFirstgid);
  upsertObject(
    props.objects,
    toChunkObject(regionFountain, chunk, chunkFirstgid, regionFirstgid),
    (object) => Number(object.id) === FOUNTAIN.objectId || object.name === FOUNTAIN.name,
  );

  const lights = objectLayer(chunk, 'LightMarkers', 'Props');
  const regionLight = makeRegionLightObject(lightId);
  upsertObject(
    lights.objects,
    toChunkLight(regionLight, chunk),
    (object) => object.name === FOUNTAIN.lightName,
  );

  chunk.nextobjectid = Math.max(Number(chunk.nextobjectid ?? 1), maxObjectId(chunk) + 1);
  writeJson(CHUNK_PATH, chunk);
}

assertGeneratedTilesetFiles();
const { regionFirstgid, lightId } = updateRegionMap();
const chunkFirstgid = updateChunkIndex();
updateChunk(regionFirstgid, chunkFirstgid, lightId);

console.log(`Applied ${FOUNTAIN.name}: region gid ${regionFirstgid}, chunk gid ${chunkFirstgid}, light id ${lightId}`);
