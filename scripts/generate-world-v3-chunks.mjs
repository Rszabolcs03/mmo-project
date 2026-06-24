import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mapsDir = path.join(rootDir, 'public', 'maps');
const chunksDir = path.join(mapsDir, 'world_v3_chunks');

const TILE_SIZE = 32;
const REGION_GRID = 5;
const REGION_TILES = 800;
const WORLD_TILES = REGION_GRID * REGION_TILES;
const CHUNK_TILES = 128;
const CHUNK_GRID = Math.ceil(WORLD_TILES / CHUNK_TILES);
const VERSION = 'v3-runtime-chunks-12';

const TILE_LAYER_NAMES = [
  'Ground',
  'Water',
  'TerrainDetails',
  'Roads',
  'CityBase',
  'CityInteriors',
  'Decor',
  'Buildings',
  'CityRoofs',
  'Collision',
];

const OBJECT_LAYER_NAMES = [
  'Zones',
  'Spawns',
  'BossSpawns',
  'NPCs',
  'QuestGiver',
  'raceStart',
  'Graveyards',
  'InteriorZones',
  'RegionMarkers',
  'RoadMarkers',
  'Landmarks',
  'Transitions',
];

function decodeLayerData(layer) {
  if (ArrayBuffer.isView(layer?.data)) return layer.data;
  if (Array.isArray(layer?.data)) return Uint32Array.from(layer.data);
  if (layer?.encoding !== 'base64' || layer?.compression !== 'zlib' || typeof layer.data !== 'string') {
    return new Uint32Array(0);
  }

  const inflated = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(Math.floor(inflated.length / 4));
  for (let index = 0; index < data.length; index += 1) {
    data[index] = inflated.readUInt32LE(index * 4);
  }
  return data;
}

function encodeLayerData(data) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let index = 0; index < data.length; index += 1) {
    buffer.writeUInt32LE(data[index] >>> 0, index * 4);
  }
  return zlib.deflateSync(buffer, { level: 6 }).toString('base64');
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function getRegionKey(regionX, regionY) {
  return `${regionX},${regionY}`;
}

function getChunkIndexTilesets(tilesets) {
  return tilesets.map((tileset) => ({
    ...tileset,
    source: tileset.source?.startsWith('../tilesets/')
      ? tileset.source.replace('../tilesets/', '../../tilesets/')
      : tileset.source,
  }));
}

async function loadRegion(regionX, regionY) {
  const mapId = `world_region_${regionX}_${regionY}_v3`;
  const fileName = `${mapId}.tmj`;
  const map = JSON.parse(await fs.readFile(path.join(mapsDir, fileName), 'utf8'));
  const tileLayers = new Map();
  TILE_LAYER_NAMES.forEach((name) => {
    const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
    if (layer) tileLayers.set(name, { ...layer, data: decodeLayerData(layer) });
  });
  const objectLayers = new Map();
  OBJECT_LAYER_NAMES.forEach((name) => {
    const layer = map.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === name);
    objectLayers.set(name, layer ? { ...layer, objects: layer.objects ?? [] } : { type: 'objectgroup', name, objects: [] });
  });

  return {
    mapId,
    map,
    tileLayers,
    objectLayers,
    offsetTileX: regionX * REGION_TILES,
    offsetTileY: regionY * REGION_TILES,
    offsetPixelX: regionX * REGION_TILES * TILE_SIZE,
    offsetPixelY: regionY * REGION_TILES * TILE_SIZE,
  };
}

function getRegionForGlobalTile(regions, tileX, tileY) {
  const regionX = Math.floor(tileX / REGION_TILES);
  const regionY = Math.floor(tileY / REGION_TILES);
  return regions.get(getRegionKey(regionX, regionY)) ?? null;
}

function collectChunkObjects(regions, chunkBounds) {
  return OBJECT_LAYER_NAMES.map((layerName) => {
    const objects = [];
    regions.forEach((region) => {
      const sourceLayer = region.objectLayers.get(layerName);
      (sourceLayer?.objects ?? []).forEach((object) => {
        const globalX = region.offsetPixelX + Number(object.x ?? 0);
        const globalY = region.offsetPixelY + Number(object.y ?? 0);
        const bounds = {
          x: globalX,
          y: globalY,
          width: Math.max(1, Number(object.width ?? 1)),
          height: Math.max(1, Number(object.height ?? 1)),
        };
        if (!rectsIntersect(bounds, chunkBounds)) return;
        objects.push({
          ...object,
          x: globalX - chunkBounds.x,
          y: globalY - chunkBounds.y,
          sourceMapId: region.mapId,
        });
      });
    });

    return {
      type: 'objectgroup',
      name: layerName,
      visible: true,
      opacity: 1,
      objects,
    };
  });
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

async function main() {
  await fs.rm(chunksDir, { recursive: true, force: true });
  await fs.mkdir(chunksDir, { recursive: true });

  const regions = new Map();
  for (let regionY = 0; regionY < REGION_GRID; regionY += 1) {
    for (let regionX = 0; regionX < REGION_GRID; regionX += 1) {
      regions.set(getRegionKey(regionX, regionY), await loadRegion(regionX, regionY));
    }
  }

  const sampleRegion = regions.get(getRegionKey(0, 0));
  const chunks = [];

  for (let chunkY = 0; chunkY < CHUNK_GRID; chunkY += 1) {
    for (let chunkX = 0; chunkX < CHUNK_GRID; chunkX += 1) {
      const tileX = chunkX * CHUNK_TILES;
      const tileY = chunkY * CHUNK_TILES;
      const width = Math.min(CHUNK_TILES, WORLD_TILES - tileX);
      const height = Math.min(CHUNK_TILES, WORLD_TILES - tileY);
      const chunkBounds = {
        x: tileX * TILE_SIZE,
        y: tileY * TILE_SIZE,
        width: width * TILE_SIZE,
        height: height * TILE_SIZE,
      };

      const layers = TILE_LAYER_NAMES.map((layerName) => {
        const data = new Uint32Array(width * height);
        for (let localY = 0; localY < height; localY += 1) {
          const globalTileY = tileY + localY;
          for (let localX = 0; localX < width; localX += 1) {
            const globalTileX = tileX + localX;
            const region = getRegionForGlobalTile(regions, globalTileX, globalTileY);
            const sourceLayer = region?.tileLayers.get(layerName);
            if (!region || !sourceLayer?.data) continue;
            const sourceX = globalTileX - region.offsetTileX;
            const sourceY = globalTileY - region.offsetTileY;
            data[localY * width + localX] = sourceLayer.data[sourceY * REGION_TILES + sourceX] ?? 0;
          }
        }

        return {
          type: 'tilelayer',
          name: layerName,
          visible: true,
          opacity: 1,
          width,
          height,
          encoding: 'base64',
          compression: 'zlib',
          data: encodeLayerData(data),
        };
      });

      layers.push(...collectChunkObjects(regions, chunkBounds));

      const file = `chunk_${chunkX}_${chunkY}.json`;
      await writeJson(path.join(chunksDir, file), {
        version: VERSION,
        type: 'map',
        orientation: 'orthogonal',
        renderorder: 'right-down',
        infinite: false,
        chunkX,
        chunkY,
        tileX,
        tileY,
        width,
        height,
        tilewidth: TILE_SIZE,
        tileheight: TILE_SIZE,
        layers,
      });

      chunks.push({
        id: `chunk_${chunkX}_${chunkY}`,
        file,
        chunkX,
        chunkY,
        x: tileX,
        y: tileY,
        width,
        height,
      });
    }
  }

  await writeJson(path.join(chunksDir, 'world_v3_chunks.json'), {
    version: VERSION,
    tileSize: TILE_SIZE,
    chunkTiles: CHUNK_TILES,
    worldTiles: {
      width: WORLD_TILES,
      height: WORLD_TILES,
    },
    chunkGrid: {
      width: CHUNK_GRID,
      height: CHUNK_GRID,
    },
    tilesets: getChunkIndexTilesets(sampleRegion.map.tilesets),
    layers: TILE_LAYER_NAMES,
    objectLayers: OBJECT_LAYER_NAMES,
    chunks,
  });

  console.log(`Generated ${chunks.length} runtime chunks in ${path.relative(rootDir, chunksDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

