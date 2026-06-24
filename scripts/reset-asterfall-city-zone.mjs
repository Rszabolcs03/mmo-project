import fs from 'node:fs/promises';
import zlib from 'node:zlib';

const MAP_PATH = 'public/maps/world_region_0_0_v3.tmj';
const BASE_BACKUP_PATH = 'public/maps/world_region_0_0_v3.tmj.backup-asterfall-20260622';

const REGION_TILES = 800;
const TILE = 32;
const COLLISION_GID = 5393;

const RESET_RECT = { x: 402, y: 214, w: 392, h: 410 };
const CITY_OBJECT_RE = /asterfall_city|interior_|npc_|questgiver_|gate_guard|patrol_guard|city_citizen|marker_asterfall_city|west_watchtower|east_watchtower|north_gatehouse/i;

const idx = (x, y) => y * REGION_TILES + x;
const EMERALD_FIRSTGID = 1;
const ELDERWOOD_FIRSTGID = 513;
const SILVER_RIVER_FIRSTGID = 769;

function decodeLayer(layer) {
  if (Array.isArray(layer.data)) return layer.data.slice();
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

function set(layer, x, y, value) {
  if (!layer || x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) return;
  layer[idx(x, y)] = value;
}

function get(layer, x, y) {
  if (!layer || x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) return 0;
  return layer[idx(x, y)] ?? 0;
}

function hash(x, y, seed = 0) {
  let n = Math.imul(x + seed * 374761393, 668265263) ^ Math.imul(y + seed * 1442695041, 2246822519);
  n ^= n >>> 13;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function naturalGrassGid(x, y) {
  const transition = 500 + Math.floor((hash(Math.floor(x / 20), Math.floor(y / 20), 91) - 0.5) * 54);
  const firstgid = y > transition ? ELDERWOOD_FIRSTGID : EMERALD_FIRSTGID;
  const n = hash(Math.floor(x / 18), Math.floor(y / 18), firstgid);
  const tile = n > 0.88 ? 2 : 1;
  return firstgid + tile - 1;
}

function riverBankGid(x, y) {
  const n = hash(Math.floor(x / 12), Math.floor(y / 12), 144);
  const tile = n > 0.8 ? 2 : 1;
  return SILVER_RIVER_FIRSTGID + tile - 1;
}

function nearWater(layers, x, y, radius = 9) {
  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (get(layers.Water, xx, yy)) return true;
    }
  }
  return false;
}

function layerMap(map) {
  return Object.fromEntries(map.layers.filter((layer) => layer.type === 'tilelayer').map((layer) => [layer.name, layer]));
}

function decodedLayers(map) {
  return Object.fromEntries(Object.entries(layerMap(map)).map(([name, layer]) => [name, decodeLayer(layer)]));
}

function objectLayer(map, name) {
  const layer = map.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === name);
  if (layer) {
    layer.objects ??= [];
    return layer;
  }
  const created = { type: 'objectgroup', name, visible: false, opacity: 1, objects: [] };
  map.layers.push(created);
  return created;
}

function objectTouchesRect(object, rect) {
  const x = Number(object.x ?? 0) / TILE;
  const y = Number(object.y ?? 0) / TILE;
  const w = Math.max(1 / TILE, Number(object.width ?? 1) / TILE);
  const h = Math.max(1 / TILE, Number(object.height ?? 1) / TILE);
  return x < rect.x + rect.w && x + w > rect.x && y < rect.y + rect.h && y + h > rect.y;
}

function resetTerrain(layers, previousLayers) {
  for (let y = RESET_RECT.y; y < RESET_RECT.y + RESET_RECT.h; y += 1) {
    for (let x = RESET_RECT.x; x < RESET_RECT.x + RESET_RECT.w; x += 1) {
      const water = get(previousLayers.Water, x, y);
      const road = get(previousLayers.Roads, x, y);
      const ground = water || nearWater(previousLayers, x, y, 8)
        ? riverBankGid(x, y)
        : naturalGrassGid(x, y);

      set(layers.Ground, x, y, ground);
      set(layers.Water, x, y, water);
      set(layers.TerrainDetails, x, y, 0);
      set(layers.Roads, x, y, road ? EMERALD_FIRSTGID + 5 - 1 : 0);
      set(layers.CityBase, x, y, 0);
      set(layers.CityInteriors, x, y, 0);
      set(layers.Decor, x, y, 0);
      set(layers.Buildings, x, y, 0);
      set(layers.CityRoofs, x, y, 0);
      set(layers.Collision, x, y, water ? COLLISION_GID : 0);
    }
  }
}

function removeCityObjects(map) {
  for (const name of ['NPCs', 'QuestGiver', 'raceStart', 'Graveyards', 'InteriorZones']) {
    objectLayer(map, name).objects = [];
  }

  for (const name of ['Zones', 'Landmarks']) {
    const layer = objectLayer(map, name);
    layer.objects = layer.objects.filter((object) => {
      const cityNamed = CITY_OBJECT_RE.test(object.name ?? '');
      const cityTouching = objectTouchesRect(object, RESET_RECT);
      return !(cityNamed || cityTouching);
    });
  }

  const spawns = objectLayer(map, 'Spawns');
  spawns.objects = spawns.objects.filter((object) => !objectTouchesRect(object, RESET_RECT));
}

function hideObjectLayers(map) {
  for (const layer of map.layers) {
    if (layer.type === 'objectgroup') layer.visible = false;
    if (layer.name === 'Collision') layer.visible = false;
  }
}

async function main() {
  const previous = JSON.parse(await fs.readFile(MAP_PATH, 'utf8'));
  const base = JSON.parse(await fs.readFile(BASE_BACKUP_PATH, 'utf8'));
  const map = JSON.parse(JSON.stringify(base));
  const tileLayers = layerMap(map);
  const layers = decodedLayers(map);
  const previousLayers = decodedLayers(previous);

  map.tilesets = (map.tilesets ?? [])
    .filter((tileset) => !/asterfall_city_hub_overlay|asterfall_city_buildings|world_v6_city/.test(tileset.source ?? ''))
    .sort((a, b) => a.firstgid - b.firstgid);

  resetTerrain(layers, previousLayers);
  removeCityObjects(map);
  hideObjectLayers(map);

  for (const [name, layer] of Object.entries(tileLayers)) encodeLayer(layer, layers[name]);
  map.nextobjectid = Math.max(1, ...map.layers.flatMap((layer) => (layer.objects ?? []).map((object) => object.id ?? 0))) + 1;
  await fs.writeFile(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`, 'utf8');

  console.log(`Reset Asterfall city zone to base terrain: ${RESET_RECT.x},${RESET_RECT.y},${RESET_RECT.w}x${RESET_RECT.h}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
