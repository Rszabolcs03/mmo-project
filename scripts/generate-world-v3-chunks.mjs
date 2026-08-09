import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mapsDir = path.join(rootDir, 'public', 'maps');
const continentRoot = path.join(mapsDir, 'world_map', 'continents', 'continent_01');
const regionsDir = path.join(continentRoot, 'regions');
const chunksDir = path.join(regionsDir, 'chunks');

const TILE_SIZE = 32;
const REGION_GRID = 5;
const REGION_TILES = 800;
const WORLD_TILES = REGION_GRID * REGION_TILES;
const CHUNK_TILES = 128;
const CHUNK_GRID = Math.ceil(WORLD_TILES / CHUNK_TILES);
const VERSION = 'v4-continent-01-runtime-chunks-9';
const TILED_GID_MASK = 0x1fffffff;

const TILE_LAYER_NAMES = [
  'Ground',
  'Water',
  'RiverFlow',
  'WaterEdges',
  'WaterFX',
  'TerrainDetails',
  'Roads',
  'BrightwaterBridge',
  'SubmergedRoad',
  'ShallowWater',
  'CityBase',
  'CityInteriors',
  'CaveInteriors',
  'CaveDetails',
  'Decor',
  'Buildings',
  'CityRoofs',
  'CaveRoofs',
  'CaveEntrances',
  'CaveCollision',
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
  'Buildings',
  'Props',
  'BrightwaterLakesideProps',
  'LightMarkers',
  'tamzia_river_tribe',
  'tamzia_forest',
  'tamzia_bandit_forest',
  'tamzia_dense_forest',
  'Caves',
  'CaveSpawns',
  'CaveProps',
  'Transitions',
];

const PROP_DRAW_OBJECT_LAYER_NAMES = [
  'Props',
  'BrightwaterLakesideProps',
  'tamzia_river_tribe',
  'tamzia_forest',
  'tamzia_bandit_forest',
  'tamzia_dense_forest',
  'CaveProps',
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

function hasTileObjectGid(object) {
  return (Number(object?.gid ?? 0) & TILED_GID_MASK) > 0;
}

function getObjectBounds(object, objectX, objectY) {
  if (Array.isArray(object?.polygon) && object.polygon.length >= 3) {
    const points = object.polygon.map((point) => ({
      x: objectX + Number(point?.x ?? 0),
      y: objectY + Number(point?.y ?? 0),
    }));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }

  const width = Math.max(1, Number(object?.width ?? 1));
  const height = Math.max(1, Number(object?.height ?? 1));
  return {
    x: objectX,
    y: hasTileObjectGid(object) ? objectY - height : objectY,
    width,
    height,
  };
}

function getRegionKey(regionX, regionY) {
  return `${regionX},${regionY}`;
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

async function getTilesetTilecount(tsxPath, fallback = 1) {
  try {
    const content = await fs.readFile(tsxPath, 'utf8');
    const match = content.match(/tilecount="(\d+)"/);
    return match ? Math.max(1, Number(match[1])) : fallback;
  } catch {
    return fallback;
  }
}

function rangesOverlap(left, right) {
  return left.firstgid < right.firstgid + right.tilecount
    && left.firstgid + left.tilecount > right.firstgid;
}

function buildChunkTilesetRegistry(regions) {
  const bySource = new Map();
  const entries = [];

  regions.forEach((region) => {
    region.tilesets.forEach((tileset) => {
      const key = process.platform === 'win32'
        ? tileset.absoluteSource.toLowerCase()
        : tileset.absoluteSource;
      let entry = bySource.get(key);
      if (!entry) {
        let firstgid = tileset.firstgid;
        const requested = { firstgid, tilecount: tileset.tilecount };
        if (entries.some((candidate) => rangesOverlap(requested, candidate))) {
          firstgid = entries.reduce(
            (next, candidate) => Math.max(next, candidate.firstgid + candidate.tilecount),
            1,
          );
        }
        entry = {
          firstgid,
          source: tileset.chunkSource,
          tilecount: tileset.tilecount,
          absoluteSource: tileset.absoluteSource,
        };
        entries.push(entry);
        bySource.set(key, entry);
      } else {
        entry.tilecount = Math.max(entry.tilecount, tileset.tilecount);
      }
      tileset.chunkFirstgid = entry.firstgid;
    });
  });

  return entries
    .sort((left, right) => left.firstgid - right.firstgid)
    .map(({ firstgid, source }) => ({ firstgid, source }));
}

function remapRegionGid(region, rawGid) {
  const unsigned = Number(rawGid ?? 0) >>> 0;
  const baseGid = unsigned & TILED_GID_MASK;
  if (!baseGid) return unsigned;
  const flags = unsigned & (~TILED_GID_MASK >>> 0);
  const tileset = [...region.tilesets].reverse().find((candidate) => (
    baseGid >= candidate.firstgid
    && baseGid < candidate.firstgid + candidate.tilecount
  )) ?? [...region.tilesets].reverse().find((candidate) => baseGid >= candidate.firstgid);
  if (!tileset) return unsigned;
  return (flags | (tileset.chunkFirstgid + baseGid - tileset.firstgid)) >>> 0;
}

async function loadRegion(regionX, regionY) {
  const mapId = `continent_01_region_${regionX}_${regionY}`;
  const fileName = `${mapId}.tmj`;
  const mapPath = path.join(regionsDir, fileName);
  const map = JSON.parse(await fs.readFile(mapPath, 'utf8'));
  const tilesets = await Promise.all((map.tilesets ?? []).map(async (tileset, index) => {
    const absoluteSource = path.resolve(path.dirname(mapPath), tileset.source ?? '');
    const nextFirstgid = Number(map.tilesets?.[index + 1]?.firstgid ?? 0);
    const fallbackTilecount = nextFirstgid > Number(tileset.firstgid)
      ? nextFirstgid - Number(tileset.firstgid)
      : 1;
    return {
      ...tileset,
      firstgid: Number(tileset.firstgid),
      tilecount: await getTilesetTilecount(absoluteSource, fallbackTilecount),
      absoluteSource,
      chunkSource: toPosixPath(path.relative(chunksDir, absoluteSource)),
      chunkFirstgid: Number(tileset.firstgid),
    };
  }));
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
    tilesets,
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

function collectChunkObjects(regions, chunkBounds, layerNames = OBJECT_LAYER_NAMES) {
  return layerNames.map((layerName) => {
    const objects = [];
    regions.forEach((region) => {
      const sourceLayer = region.objectLayers.get(layerName);
      (sourceLayer?.objects ?? []).forEach((object) => {
        const globalX = region.offsetPixelX + Number(object.x ?? 0);
        const globalY = region.offsetPixelY + Number(object.y ?? 0);
        const bounds = getObjectBounds(object, globalX, globalY);
        if (!rectsIntersect(bounds, chunkBounds)) return;
        objects.push({
          ...object,
          ...(hasTileObjectGid(object) ? { gid: remapRegionGid(region, object.gid) } : {}),
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

function collectIndexObjects(regions, layerNames) {
  const objects = [];
  layerNames.forEach((layerName) => {
    regions.forEach((region) => {
      const sourceLayer = region.objectLayers.get(layerName);
      (sourceLayer?.objects ?? []).forEach((object) => {
        objects.push({
          ...object,
          x: region.offsetPixelX + Number(object.x ?? 0),
          y: region.offsetPixelY + Number(object.y ?? 0),
          sourceMapId: region.mapId,
          mapId: region.mapId,
          layerName,
        });
      });
    });
  });
  return objects;
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

async function main() {
  await fs.mkdir(chunksDir, { recursive: true });

  const regions = new Map();
  for (let regionY = 0; regionY < REGION_GRID; regionY += 1) {
    for (let regionX = 0; regionX < REGION_GRID; regionX += 1) {
      regions.set(getRegionKey(regionX, regionY), await loadRegion(regionX, regionY));
    }
  }

  const chunkTilesets = buildChunkTilesetRegistry(regions);
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

      const layers = [];
      TILE_LAYER_NAMES.forEach((layerName) => {
        const data = new Uint32Array(width * height);
        let layerMeta = null;
        for (let localY = 0; localY < height; localY += 1) {
          const globalTileY = tileY + localY;
          for (let localX = 0; localX < width; localX += 1) {
            const globalTileX = tileX + localX;
            const region = getRegionForGlobalTile(regions, globalTileX, globalTileY);
            const sourceLayer = region?.tileLayers.get(layerName);
            if (!region || !sourceLayer?.data) continue;
            layerMeta ??= sourceLayer;
            const sourceX = globalTileX - region.offsetTileX;
            const sourceY = globalTileY - region.offsetTileY;
            data[localY * width + localX] = remapRegionGid(
              region,
              sourceLayer.data[sourceY * REGION_TILES + sourceX] ?? 0,
            );
          }
        }

        layers.push({
          type: 'tilelayer',
          name: layerName,
          visible: layerMeta?.visible ?? true,
          opacity: layerMeta?.opacity ?? 1,
          width,
          height,
          encoding: 'base64',
          compression: 'zlib',
          data: encodeLayerData(data),
        });

        if (layerName === 'Buildings') {
          layers.push(...collectChunkObjects(regions, chunkBounds, PROP_DRAW_OBJECT_LAYER_NAMES));
        }
      });

      layers.push(...collectChunkObjects(
        regions,
        chunkBounds,
        OBJECT_LAYER_NAMES.filter((layerName) => !PROP_DRAW_OBJECT_LAYER_NAMES.includes(layerName)),
      ));

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

  await writeJson(path.join(chunksDir, 'continent_01_chunks.json'), {
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
    tilesets: chunkTilesets,
    layers: TILE_LAYER_NAMES,
    objectLayers: OBJECT_LAYER_NAMES,
    graveyards: collectIndexObjects(regions, ['Graveyards']),
    chunks,
  });

  console.log(`Generated ${chunks.length} continent_01 runtime chunks in ${path.relative(rootDir, chunksDir)}`);
  await import('./generate-cave-interior-assets.mjs');
  await import('./apply-brightwater-dungeon-content.mjs');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

