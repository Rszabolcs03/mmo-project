import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const REGION_ROOT = new URL('../public/maps/world_map/continents/continent_01/regions/', import.meta.url);
const MAP_PATH = new URL('continent_01_region_0_0.tmj', REGION_ROOT);
const CHUNK_INDEX_PATH = new URL('chunks/continent_01_chunks.json', REGION_ROOT);
const CHUNK_PATH = new URL('chunks/chunk_3_2.json', REGION_ROOT);
const CHUNK_TILE_OFFSET = Object.freeze({ x: 3 * 128, y: 2 * 128 });
const WATER_GID = 3073;
const OLD_GENERATED_BY = 'tideglass_cove_decor_v1';

// Three small asymmetric puddles around the arena edge. The central combat area stays dry.
const LOCAL_WATER_CELLS = [
  [48, 15], [49, 15], [50, 15], [48, 16], [49, 16],
  [71, 20], [70, 21], [71, 21], [72, 21], [71, 22],
  [59, 27], [60, 27], [61, 27], [62, 27], [60, 28], [61, 28],
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function decodeLayer(layer) {
  if (layer?.encoding !== 'base64' || layer?.compression !== 'zlib') {
    throw new Error(`Cannot decode ${layer?.name ?? 'unknown'} layer.`);
  }
  const bytes = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(layer.width * layer.height);
  for (let index = 0; index < data.length; index += 1) data[index] = bytes.readUInt32LE(index * 4);
  return data;
}

function encodeLayer(layer, data) {
  const bytes = Buffer.alloc(data.length * 4);
  for (let index = 0; index < data.length; index += 1) bytes.writeUInt32LE(data[index] >>> 0, index * 4);
  layer.encoding = 'base64';
  layer.compression = 'zlib';
  layer.data = zlib.deflateSync(bytes, { level: 6 }).toString('base64');
}

function removeOldDecor(map) {
  map.tilesets = (map.tilesets ?? []).filter(
    (tileset) => !String(tileset.source ?? '').endsWith('tideglass_cove_decor.tsx'),
  );
  const props = map.layers.find((layer) => layer.type === 'objectgroup' && layer.name === 'Props');
  if (!props) return 0;
  const before = props.objects?.length ?? 0;
  props.objects = (props.objects ?? []).filter((object) => !(object.properties ?? []).some(
    (property) => property.name === 'generatedBy' && property.value === OLD_GENERATED_BY,
  ));
  return before - props.objects.length;
}

function paintWater(map, tileOffset = { x: 0, y: 0 }) {
  const water = map.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'Water');
  if (!water) throw new Error('Missing Water tile layer.');
  const data = decodeLayer(water);
  LOCAL_WATER_CELLS.forEach(([localX, localY]) => {
    const x = localX + tileOffset.x;
    const y = localY + tileOffset.y;
    if (x < 0 || y < 0 || x >= water.width || y >= water.height) {
      throw new Error(`Water cell ${x},${y} is outside ${water.width}x${water.height}.`);
    }
    data[y * water.width + x] = WATER_GID;
  });
  encodeLayer(water, data);
}

const map = readJson(MAP_PATH);
const removedFromMap = removeOldDecor(map);
paintWater(map, CHUNK_TILE_OFFSET);
writeFileSync(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`);

const chunkIndex = readJson(CHUNK_INDEX_PATH);
chunkIndex.tilesets = (chunkIndex.tilesets ?? []).filter(
  (tileset) => !String(tileset.source ?? '').endsWith('tideglass_cove_decor.tsx'),
);
chunkIndex.version = 'v4-continent-01-runtime-chunks-11';
writeFileSync(CHUNK_INDEX_PATH, `${JSON.stringify(chunkIndex, null, 2)}\n`);

const chunk = readJson(CHUNK_PATH);
const removedFromChunk = removeOldDecor(chunk);
paintWater(chunk);
writeFileSync(CHUNK_PATH, JSON.stringify(chunk));

console.log(
  `Removed ${removedFromMap}/${removedFromChunk} cove props and painted ${LOCAL_WATER_CELLS.length} tiles across 3 water patches.`,
);
