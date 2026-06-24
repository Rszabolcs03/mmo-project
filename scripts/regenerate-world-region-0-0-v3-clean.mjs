import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import vm from 'node:vm';

const MAP_PATH = 'public/maps/world_region_0_0_v3.tmj';
const BACKUP_PATH = 'public/maps/world_region_0_0_v3.tmj.backup-before-full-clean-regen-20260623';
const EAST_NEIGHBOR_PATH = 'public/maps/world_region_1_0_v3.tmj';
const SOUTH_NEIGHBOR_PATH = 'public/maps/world_region_0_1_v3.tmj';
const WORLD_GENERATOR_PATH = 'scripts/generate-world-map-v3.mjs';
const REGION_TILES = 800;
const EDGE_ALIGNED_LAYERS = ['Ground', 'Water', 'TerrainDetails', 'Roads', 'Collision'];

function decodeLayer(layer) {
  const inflated = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Array(inflated.length / 4);
  for (let i = 0; i < data.length; i += 1) data[i] = inflated.readUInt32LE(i * 4);
  return data;
}

function encodeLayer(layer, data) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let i = 0; i < data.length; i += 1) buffer.writeUInt32LE(data[i] >>> 0, i * 4);
  layer.data = zlib.deflateSync(buffer, { level: 6 }).toString('base64');
  layer.encoding = 'base64';
  layer.compression = 'zlib';
}

function tileLayer(map, name) {
  return map.layers.find((layer) => layer.type === 'tilelayer' && layer.name === name);
}

async function loadGeneratorContext() {
  const source = await fs.readFile(WORLD_GENERATOR_PATH, 'utf8');
  const start = source.indexOf('const TILE = 32;');
  const end = source.indexOf('async function main()');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Could not isolate generator body from ${WORLD_GENERATOR_PATH}`);
  }

  const sandbox = { Buffer, console, zlib };
  vm.createContext(sandbox);
  vm.runInContext(`${source.slice(start, end)}
globalThis.__regenerateCleanRegion00 = () => {
  const asterfallIndex = LANDMARKS.findIndex((landmark) => landmark.id === 'asterfall_city');
  if (asterfallIndex !== -1) LANDMARKS.splice(asterfallIndex, 1);

  objectId = 1;
  const rx = 0;
  const ry = 0;
  const worldX = 0;
  const worldY = 0;
  const theme = REGION_THEMES[0];
  const region = {
    rx,
    ry,
    worldX,
    worldY,
    theme,
    ground: makeLayer(),
    water: makeLayer(),
    terrainDetails: makeLayer(),
    roads: makeLayer(),
    cityBase: makeLayer(),
    cityInteriors: makeLayer(),
    decor: makeLayer(),
    buildings: makeLayer(),
    cityRoofs: makeLayer(),
    collision: makeLayer(),
    objects: {
      zones: [],
      spawns: [],
      bossSpawns: [],
      npcs: [],
      questGivers: [],
      raceStarts: [],
      graveyards: [],
      interiorZones: [],
      regionMarkers: [],
      roadMarkers: [],
      landmarks: [],
      transitions: [],
    },
  };

  for (let y = 0; y < REGION_TILES; y += 1) {
    for (let x = 0; x < REGION_TILES; x += 1) {
      const gx = worldX + x;
      const gy = worldY + y;
      const sample = sampleWorld(gx, gy);
      setTile(region.ground, x, y, groundTileFromSample(sample));
      setTile(region.water, x, y, waterTileFromSample(sample));
      setTile(region.terrainDetails, x, y, detailTileFromSample(sample));
      setTile(region.roads, x, y, roadTileFromSample(sample));
      if (sample.water && !sample.bridge && !sample.fordableWater) {
        setTile(region.collision, x, y, COLLISION_FIRSTGID);
      }
    }
  }

  placeNaturalDecor(region);
  placePlayableNaturalDetails(region);
  placeBridges(region);
  placeRegionalDetails(region);
  for (const landmark of LANDMARKS) placeLandmark(region, landmark);
  addRegionMarkers(region);
  addRoadMarkers(region);

  const map = makeMap(region);
  for (const layer of map.layers) {
    if (layer.type === 'objectgroup') layer.visible = false;
    if (layer.name === 'Collision') layer.visible = false;
  }
  map.nextobjectid = Math.max(1, ...map.layers.flatMap((layer) => (layer.objects ?? []).map((object) => object.id ?? 0))) + 1;
  return map;
};
`, sandbox, { filename: WORLD_GENERATOR_PATH });

  return sandbox;
}

async function main() {
  await fs.copyFile(MAP_PATH, BACKUP_PATH);
  const sandbox = await loadGeneratorContext();
  const map = vm.runInContext('__regenerateCleanRegion00()', sandbox);
  const eastNeighbor = JSON.parse(await fs.readFile(EAST_NEIGHBOR_PATH, 'utf8'));
  const southNeighbor = JSON.parse(await fs.readFile(SOUTH_NEIGHBOR_PATH, 'utf8'));

  for (const name of EDGE_ALIGNED_LAYERS) {
    const layer = tileLayer(map, name);
    const data = decodeLayer(layer);
    const east = decodeLayer(tileLayer(eastNeighbor, name));
    const south = decodeLayer(tileLayer(southNeighbor, name));

    for (let y = 0; y < REGION_TILES; y += 1) {
      data[y * REGION_TILES + (REGION_TILES - 1)] = east[y * REGION_TILES];
    }
    for (let x = 0; x < REGION_TILES; x += 1) {
      data[(REGION_TILES - 1) * REGION_TILES + x] = south[x];
    }
    encodeLayer(layer, data);
  }

  await fs.writeFile(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  console.log(`Regenerated clean world_region_0_0_v3 from generator without Asterfall city.`);
  console.log(`Backup: ${BACKUP_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
