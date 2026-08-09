import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTINENT_DIR = path.join(ROOT, 'public', 'maps', 'world_map', 'continents', 'continent_01');
const REGIONS_DIR = path.join(CONTINENT_DIR, 'regions');
const CONTINENT_TILESET_DIR = path.join(CONTINENT_DIR, 'tilesets');
const PROJECT_TILESET_DIR = path.join(ROOT, 'public', 'tilesets');
const ASSET_DIR = path.join(ROOT, 'public', 'assets', 'tilesets');

const REGION_TILES = 800;
const REGION_GRID = 5;
const WORLD_TILES = REGION_TILES * REGION_GRID;
const CELL_COUNT = WORLD_TILES * WORLD_TILES;
const WATER_GID = 3073;
const RIVER_BASE_GID = 3075;
const FLOW_FIRST_GID = 30000;
const FLOW_TILESET_NAME = 'continent_01_river_flow_v1';
const FLOW_TILESET_SOURCE = `../tilesets/${FLOW_TILESET_NAME}.tsx`;
const FLOW_COLUMNS = 22;
const TILE_SIZE = 32;
const WIDE_WATER_DEPTH = 14;
const WIDE_WATER_BUFFER = 16;
const MIN_FLOW_DISTANCE_FROM_SEA = 18;
const RIVER_MAX_HALF_WIDTH = 8;

const DIRECTIONS = [
  { dx: 1, dy: 0, tileId: 0 }, // east
  { dx: -1, dy: 0, tileId: 2 }, // west
  { dx: 0, dy: 1, tileId: 4 }, // south
  { dx: 0, dy: -1, tileId: 6 }, // north
  { dx: 1, dy: 1, tileId: 8 }, // south-east
  { dx: -1, dy: -1, tileId: 10 }, // north-west
  { dx: -1, dy: 1, tileId: 12 }, // south-west
  { dx: 1, dy: -1, tileId: 14 }, // north-east
];

function decodeLayer(layer) {
  if (ArrayBuffer.isView(layer?.data)) return Uint32Array.from(layer.data);
  if (Array.isArray(layer?.data)) return Uint32Array.from(layer.data);
  if (layer?.encoding !== 'base64' || layer?.compression !== 'zlib' || typeof layer.data !== 'string') {
    return new Uint32Array(0);
  }
  const buffer = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(buffer.length / 4);
  for (let index = 0; index < data.length; index += 1) data[index] = buffer.readUInt32LE(index * 4);
  return data;
}

function encodeLayer(layer, data) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let index = 0; index < data.length; index += 1) buffer.writeUInt32LE(data[index] >>> 0, index * 4);
  layer.encoding = 'base64';
  layer.compression = 'zlib';
  layer.data = zlib.deflateSync(buffer, { level: 6 }).toString('base64');
  delete layer.chunks;
}

function makeEmptyLayer(id, name, width, height) {
  return {
    id,
    name,
    type: 'tilelayer',
    x: 0,
    y: 0,
    width,
    height,
    visible: true,
    opacity: 1,
    encoding: 'base64',
    compression: 'zlib',
    data: '',
  };
}

function findLayer(map, name) {
  return map.layers.find((layer) => layer.type === 'tilelayer' && layer.name === name) ?? null;
}

function ensureFlowLayers(map) {
  const maxId = Math.max(0, ...map.layers.map((layer) => Number(layer.id ?? 0)));
  let nextId = Math.max(Number(map.nextlayerid ?? 1), maxId + 1);
  let riverFlow = findLayer(map, 'RiverFlow');
  let waterFx = findLayer(map, 'WaterFX');
  const waterIndex = Math.max(0, map.layers.findIndex((layer) => layer.type === 'tilelayer' && layer.name === 'Water'));

  if (!riverFlow) {
    riverFlow = makeEmptyLayer(nextId++, 'RiverFlow', map.width, map.height);
    map.layers.splice(waterIndex + 1, 0, riverFlow);
  }
  if (!waterFx) {
    waterFx = makeEmptyLayer(nextId++, 'WaterFX', map.width, map.height);
    const flowIndex = map.layers.indexOf(riverFlow);
    map.layers.splice(flowIndex + 1, 0, waterFx);
  }
  map.nextlayerid = nextId;
  return { riverFlow, waterFx };
}

function ensureTileset(map) {
  const existing = map.tilesets.find((tileset) => tileset.source === FLOW_TILESET_SOURCE);
  if (existing) {
    existing.firstgid = FLOW_FIRST_GID;
    return;
  }
  map.tilesets.push({ firstgid: FLOW_FIRST_GID, source: FLOW_TILESET_SOURCE });
  map.tilesets.sort((a, b) => Number(a.firstgid) - Number(b.firstgid));
}

function indexOf(x, y) {
  return y * WORLD_TILES + x;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < WORLD_TILES && y < WORLD_TILES;
}

function isSandGid(gid) {
  return gid >= 2305 && gid < 2561;
}

function grassifyRiverTribeBank(region) {
  if (region.rx !== 0 || region.ry !== 0) return 0;
  const { ground, water, shallow, map } = region;
  let changed = 0;
  // The Reedwater camp and bridge sit around this stretch. Keep the distant coast intact,
  // but turn the artificial sandy river apron into the same Emerald Vale grass as its banks.
  for (let y = 185; y < 340; y += 1) {
    for (let x = 645; x < 790; x += 1) {
      const local = y * map.width + x;
      if (water[local] || shallow[local] || !isSandGid(ground[local])) continue;
      ground[local] = 1;
      changed += 1;
    }
  }
  return changed;
}

function setPixel(image, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= image.width || py >= image.height) return;
  const index = (py * image.width + px) * 4;
  image.data[index] = color[0];
  image.data[index + 1] = color[1];
  image.data[index + 2] = color[2];
  image.data[index + 3] = color[3];
}

function line(image, x0, y0, x1, y1, color, thickness = 1) {
  const length = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let step = 0; step <= length; step += 1) {
    const t = step / length;
    for (let oy = -Math.floor(thickness / 2); oy <= Math.floor(thickness / 2); oy += 1) {
      for (let ox = -Math.floor(thickness / 2); ox <= Math.floor(thickness / 2); ox += 1) {
        setPixel(image, x0 + (x1 - x0) * t + ox, y0 + (y1 - y0) * t + oy, color);
      }
    }
  }
}

function tileOrigin(tileId) {
  return { x: tileId * TILE_SIZE, y: 0 };
}

function drawFlowFrame(image, tileId, dx, dy, phase) {
  const { x, y } = tileOrigin(tileId);
  const bright = [146, 229, 229, 125];
  const dark = [29, 103, 147, 82];
  const perpendicularX = -dy;
  const perpendicularY = dx;
  const distance = phase === 0 ? -2 : 4;
  const anchors = [-8, 1, 10];
  anchors.forEach((anchor, index) => {
    const along = anchor + distance;
    const side = (index - 1) * 5;
    const startX = x + 16 + dx * (along - 4) + perpendicularX * side;
    const startY = y + 16 + dy * (along - 4) + perpendicularY * side;
    const endX = x + 16 + dx * (along + 4) + perpendicularX * side;
    const endY = y + 16 + dy * (along + 4) + perpendicularY * side;
    line(image, startX, startY, endX, endY, dark, 2);
    line(image, startX + perpendicularX, startY + perpendicularY, endX + perpendicularX, endY + perpendicularY, bright, 1);
  });
  // A small leading glint makes the direction readable even on a narrow 32px river.
  const glint = phase === 0 ? 10 : 16;
  line(image, x + 16 + dx * glint - perpendicularX * 2, y + 16 + dy * glint - perpendicularY * 2,
    x + 16 + dx * (glint + 3) + perpendicularX * 2, y + 16 + dy * (glint + 3) + perpendicularY * 2, bright, 1);
}

function drawRippleFrame(image, tileId, phase, lake = false) {
  const { x, y } = tileOrigin(tileId);
  const light = lake ? [133, 213, 224, 110] : [188, 239, 230, 150];
  const dark = lake ? [37, 117, 149, 75] : [31, 98, 137, 92];
  const radius = lake ? (phase === 0 ? 6 : 10) : (phase === 0 ? 8 : 12);
  for (let side = -1; side <= 1; side += 2) {
    line(image, x + 16 + side * radius, y + 16 - radius + 3, x + 16 + side * radius, y + 16 + radius - 3, dark, 1);
    line(image, x + 16 - radius + 3, y + 16 + side * radius, x + 16 + radius - 3, y + 16 + side * radius, light, 1);
  }
  if (phase === 0) setPixel(image, x + 16, y + 16, light);
}

function writeFlowTileset() {
  mkdirSync(CONTINENT_TILESET_DIR, { recursive: true });
  mkdirSync(PROJECT_TILESET_DIR, { recursive: true });
  mkdirSync(ASSET_DIR, { recursive: true });
  const image = new PNG({ width: FLOW_COLUMNS * TILE_SIZE, height: TILE_SIZE });
  DIRECTIONS.forEach(({ dx, dy, tileId }) => {
    drawFlowFrame(image, tileId, dx, dy, 0);
    drawFlowFrame(image, tileId + 1, dx, dy, 1);
  });
  drawRippleFrame(image, 16, 0, false);
  drawRippleFrame(image, 17, 1, false);
  drawRippleFrame(image, 18, 0, true);
  drawRippleFrame(image, 19, 1, true);
  drawRippleFrame(image, 20, 0, false);
  drawRippleFrame(image, 21, 1, false);

  const png = PNG.sync.write(image);
  const pngName = `${FLOW_TILESET_NAME}.png`;
  [CONTINENT_TILESET_DIR, PROJECT_TILESET_DIR, ASSET_DIR].forEach((directory) => writeFileSync(path.join(directory, pngName), png));

  const animations = DIRECTIONS.map(({ tileId }) => ` <tile id="${tileId}"><animation><frame tileid="${tileId}" duration="170"/><frame tileid="${tileId + 1}" duration="170"/></animation></tile>`)
    .concat([
      ' <tile id="16"><animation><frame tileid="16" duration="420"/><frame tileid="17" duration="420"/></animation></tile>',
      ' <tile id="18"><animation><frame tileid="18" duration="760"/><frame tileid="19" duration="760"/></animation></tile>',
      ' <tile id="20"><animation><frame tileid="20" duration="620"/><frame tileid="21" duration="620"/></animation></tile>',
    ]).join('\n');
  const tsx = `<?xml version="1.0" encoding="UTF-8"?>\n<tileset version="1.10" tiledversion="1.11.2" name="${FLOW_TILESET_NAME}" tilewidth="32" tileheight="32" tilecount="22" columns="22">\n <image source="${pngName}" width="704" height="32"/>\n${animations}\n</tileset>\n`;
  [CONTINENT_TILESET_DIR, PROJECT_TILESET_DIR].forEach((directory) => writeFileSync(path.join(directory, `${FLOW_TILESET_NAME}.tsx`), tsx));
}

function buildDistanceToLand(fluid) {
  const distance = new Int16Array(CELL_COUNT);
  for (let index = 0; index < CELL_COUNT; index += 1) distance[index] = fluid[index] ? 30000 : 0;
  for (let y = 0; y < WORLD_TILES; y += 1) {
    const row = y * WORLD_TILES;
    for (let x = 0; x < WORLD_TILES; x += 1) {
      const index = row + x;
      if (!fluid[index]) continue;
      let value = distance[index];
      if (x > 0) value = Math.min(value, distance[index - 1] + 1);
      if (y > 0) value = Math.min(value, distance[index - WORLD_TILES] + 1);
      distance[index] = value;
    }
  }
  for (let y = WORLD_TILES - 1; y >= 0; y -= 1) {
    const row = y * WORLD_TILES;
    for (let x = WORLD_TILES - 1; x >= 0; x -= 1) {
      const index = row + x;
      if (!fluid[index]) continue;
      let value = distance[index];
      if (x < WORLD_TILES - 1) value = Math.min(value, distance[index + 1] + 1);
      if (y < WORLD_TILES - 1) value = Math.min(value, distance[index + WORLD_TILES] + 1);
      distance[index] = value;
    }
  }
  return distance;
}

function distanceFromSeeds(fluid, seedPredicate, allowPredicate = () => true) {
  const distance = new Int32Array(CELL_COUNT);
  distance.fill(-1);
  const queue = new Int32Array(CELL_COUNT);
  let head = 0;
  let tail = 0;
  for (let y = 0; y < WORLD_TILES; y += 1) {
    for (let x = 0; x < WORLD_TILES; x += 1) {
      if (x !== 0 && y !== 0 && x !== WORLD_TILES - 1 && y !== WORLD_TILES - 1) continue;
      const index = indexOf(x, y);
      if (!fluid[index] || !allowPredicate(index) || !seedPredicate(index)) continue;
      distance[index] = 0;
      queue[tail++] = index;
    }
  }
  // Non-edge source sets (the lake cores) are added in a second scan when needed.
  if (seedPredicate.includeInterior) {
    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (!fluid[index] || !allowPredicate(index) || !seedPredicate(index) || distance[index] >= 0) continue;
      distance[index] = 0;
      queue[tail++] = index;
    }
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % WORLD_TILES;
    const y = (index - x) / WORLD_TILES;
    const nextDistance = distance[index] + 1;
    const neighbours = [
      x > 0 ? index - 1 : -1,
      x < WORLD_TILES - 1 ? index + 1 : -1,
      y > 0 ? index - WORLD_TILES : -1,
      y < WORLD_TILES - 1 ? index + WORLD_TILES : -1,
    ];
    for (const neighbour of neighbours) {
      if (neighbour < 0 || distance[neighbour] >= 0 || !fluid[neighbour] || !allowPredicate(neighbour)) continue;
      distance[neighbour] = nextDistance;
      queue[tail++] = neighbour;
    }
  }
  return distance;
}

function buildWideWaterBuffer(fluid, depth) {
  const buffer = new Int16Array(CELL_COUNT);
  buffer.fill(32767);
  const queue = new Int32Array(CELL_COUNT);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (!fluid[index] || depth[index] < WIDE_WATER_DEPTH) continue;
    buffer[index] = 0;
    queue[tail++] = index;
  }
  while (head < tail) {
    const index = queue[head++];
    const current = buffer[index];
    if (current >= WIDE_WATER_BUFFER) continue;
    const x = index % WORLD_TILES;
    const y = (index - x) / WORLD_TILES;
    const neighbours = [
      x > 0 ? index - 1 : -1,
      x < WORLD_TILES - 1 ? index + 1 : -1,
      y > 0 ? index - WORLD_TILES : -1,
      y < WORLD_TILES - 1 ? index + WORLD_TILES : -1,
    ];
    for (const neighbour of neighbours) {
      if (neighbour < 0 || !fluid[neighbour] || buffer[neighbour] <= current + 1) continue;
      buffer[neighbour] = current + 1;
      queue[tail++] = neighbour;
    }
  }
  return buffer;
}

function nearestFlowDirection(index, distance, fluid) {
  const x = index % WORLD_TILES;
  const y = (index - x) / WORLD_TILES;
  const current = distance[index];
  let best = null;
  DIRECTIONS.forEach((direction) => {
    const nx = x + direction.dx;
    const ny = y + direction.dy;
    if (!inBounds(nx, ny)) return;
    const neighbour = indexOf(nx, ny);
    if (!fluid[neighbour] || distance[neighbour] < 0 || distance[neighbour] >= current) return;
    if (!best || distance[neighbour] < best.distance) best = { ...direction, distance: distance[neighbour], index: neighbour };
  });
  return best;
}

function getRegionCell(regions, globalIndex) {
  const x = globalIndex % WORLD_TILES;
  const y = (globalIndex - x) / WORLD_TILES;
  const rx = Math.floor(x / REGION_TILES);
  const ry = Math.floor(y / REGION_TILES);
  const region = regions.get(`${rx},${ry}`);
  return { region, local: (y % REGION_TILES) * REGION_TILES + (x % REGION_TILES) };
}

function main() {
  writeFlowTileset();
  const regions = new Map();
  const fluid = new Uint8Array(CELL_COUNT);
  const files = readdirSync(REGIONS_DIR).filter((file) => /^continent_01_region_[0-4]_[0-4]\.tmj$/.test(file)).sort();

  for (const file of files) {
    const match = file.match(/region_(\d+)_(\d+)/);
    const rx = Number(match[1]);
    const ry = Number(match[2]);
    const map = JSON.parse(readFileSync(path.join(REGIONS_DIR, file), 'utf8'));
    const waterLayer = findLayer(map, 'Water');
    const shallowLayer = findLayer(map, 'ShallowWater');
    const groundLayer = findLayer(map, 'Ground');
    const { riverFlow: riverFlowLayer, waterFx: waterFxLayer } = ensureFlowLayers(map);
    ensureTileset(map);
    const region = {
      file,
      rx,
      ry,
      map,
      waterLayer,
      shallowLayer,
      groundLayer,
      riverFlowLayer,
      waterFxLayer,
      water: decodeLayer(waterLayer),
      shallow: decodeLayer(shallowLayer),
      ground: decodeLayer(groundLayer),
      riverFlow: new Uint32Array(map.width * map.height),
      waterFx: new Uint32Array(map.width * map.height),
    };
    if (!region.water.length || !region.shallow.length || !region.ground.length) throw new Error(`Missing terrain layers in ${file}`);
    regions.set(`${rx},${ry}`, region);
    for (let y = 0; y < REGION_TILES; y += 1) {
      for (let x = 0; x < REGION_TILES; x += 1) {
        const local = y * REGION_TILES + x;
        if (region.water[local] || region.shallow[local]) fluid[indexOf(rx * REGION_TILES + x, ry * REGION_TILES + y)] = 1;
      }
    }
  }

  const grassifiedTiles = [...regions.values()].reduce((total, region) => total + grassifyRiverTribeBank(region), 0);
  const waterDepth = buildDistanceToLand(fluid);
  const wideBuffer = buildWideWaterBuffer(fluid, waterDepth);
  const oceanDistance = distanceFromSeeds(fluid, () => true);
  const basinSeed = (index) => oceanDistance[index] < 0 && waterDepth[index] >= WIDE_WATER_DEPTH;
  basinSeed.includeInterior = true;
  const basinDistance = distanceFromSeeds(fluid, basinSeed, (index) => oceanDistance[index] < 0);

  const riverCells = new Uint8Array(CELL_COUNT);
  let flowTiles = 0;
  let riverBaseTiles = 0;
  let seaMouthRipples = 0;
  let lakeInflowRipples = 0;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (!fluid[index] || waterDepth[index] > RIVER_MAX_HALF_WIDTH || wideBuffer[index] <= WIDE_WATER_BUFFER) continue;
    const isOceanConnected = oceanDistance[index] >= MIN_FLOW_DISTANCE_FROM_SEA;
    const isLakeConnected = oceanDistance[index] < 0 && basinDistance[index] > WIDE_WATER_BUFFER;
    if (!isOceanConnected && !isLakeConnected) continue;
    const direction = nearestFlowDirection(index, isOceanConnected ? oceanDistance : basinDistance, fluid);
    if (!direction) continue;
    const { region, local } = getRegionCell(regions, index);
    // The flow overlay belongs on deep river water only. A shallow tile is a shore
    // transition, so putting the current over it made green, striped river banks.
    if (!region.water[local]) continue;
    region.riverFlow[local] = FLOW_FIRST_GID + direction.tileId;
    region.water[local] = RIVER_BASE_GID;
    riverBaseTiles += 1;
    riverCells[index] = 1;
    flowTiles += 1;

    const nextWide = direction.index >= 0 && wideBuffer[direction.index] <= WIDE_WATER_BUFFER;
    if (nextWide && (index % 3 === 0)) {
      const target = getRegionCell(regions, direction.index);
      // Never place a ripple on a shore transition. River edits can move a
      // mouth by a few tiles, and an FX tile on ShallowWater/ground reads as
      // a floating animation rather than water movement.
      if (target.region.water[target.local]) {
        target.region.waterFx[target.local] = FLOW_FIRST_GID + (isOceanConnected ? 16 : 18);
        if (isOceanConnected) seaMouthRipples += 1;
        else lakeInflowRipples += 1;
      }
    }
  }

  const isNearRiverCell = (index, radius = 5) => {
    const x = index % WORLD_TILES;
    const y = (index - x) / WORLD_TILES;
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      const ny = y + offsetY;
      if (ny < 0 || ny >= WORLD_TILES) continue;
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const nx = x + offsetX;
        if (nx < 0 || nx >= WORLD_TILES || !riverCells[indexOf(nx, ny)]) continue;
        return true;
      }
    }
    return false;
  };

  let riverShallowTilesCleared = 0;
  for (const region of regions.values()) {
    for (let local = 0; local < region.shallow.length; local += 1) {
      if (!region.shallow[local]) continue;
      const x = region.rx * REGION_TILES + (local % REGION_TILES);
      const y = region.ry * REGION_TILES + Math.floor(local / REGION_TILES);
      if (!isNearRiverCell(indexOf(x, y))) continue;
      region.shallow[local] = 0;
      riverShallowTilesCleared += 1;
    }
  }

  for (const region of regions.values()) {
    encodeLayer(region.waterLayer, region.water);
    encodeLayer(region.groundLayer, region.ground);
    encodeLayer(region.shallowLayer, region.shallow);
    encodeLayer(region.riverFlowLayer, region.riverFlow);
    encodeLayer(region.waterFxLayer, region.waterFx);
    writeFileSync(path.join(REGIONS_DIR, region.file), `${JSON.stringify(region.map, null, 2)}\n`);
  }

  console.log(JSON.stringify({
    summary: 'Applied directional river current overlays; broad ocean and lake water remain calm.',
    flowTiles,
    riverBaseTiles,
    seaMouthRipples,
    lakeInflowRipples,
    riverShallowTilesCleared,
    grassifiedRiverTribeBankTiles: grassifiedTiles,
    tilesetFirstgid: FLOW_FIRST_GID,
  }, null, 2));
}

main();
