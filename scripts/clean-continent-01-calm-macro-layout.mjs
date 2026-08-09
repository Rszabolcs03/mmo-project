import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const continentRoot = path.join(rootDir, 'public', 'maps', 'world_map', 'continents', 'continent_01');
const regionsDir = path.join(continentRoot, 'regions');

const TILE_SIZE = 32;
const REGION_GRID = 5;
const REGION_TILES = 800;
const WORLD_TILES = REGION_GRID * REGION_TILES;
const WORLD_TILE_COUNT = WORLD_TILES * WORLD_TILES;
const TILED_GID_MASK = 0x1fffffff;

const WATER_FIRST_GID = 3073;
const STILL_WATER_GID = WATER_FIRST_GID;
const RIVER_WATER_GID = WATER_FIRST_GID + 2;
const SHALLOW_WATER_GID = WATER_FIRST_GID + 4;
const SHORE_NORTH_GID = WATER_FIRST_GID + 8;
const SHORE_SOUTH_GID = WATER_FIRST_GID + 9;
const SHORE_WEST_GID = WATER_FIRST_GID + 10;
const SHORE_EAST_GID = WATER_FIRST_GID + 11;
const SHORE_NW_GID = WATER_FIRST_GID + 12;
const SHORE_NE_GID = WATER_FIRST_GID + 13;
const SHORE_SW_GID = WATER_FIRST_GID + 14;
const SHORE_SE_GID = WATER_FIRST_GID + 15;
const WATER_FX_FIRST_GID = 25000;

const LOCAL = {
  base: 1,
  alt: 2,
  dark: 3,
  dirt: 4,
  road: 5,
  path: 6,
  bank: 8,
  stone: 9,
  mud: 12,
  light: 13,
  reeds: 15,
  forestFloor: 17,
  sand: 20,
  tallGrass: 21,
  roadEdge: 23,
};

const BIOMES = {
  emerald: { firstgid: 1 },
  golden: { firstgid: 257 },
  elderwood: { firstgid: 513 },
  silver: { firstgid: 769 },
  sunhill: { firstgid: 1025 },
  cloudspine: { firstgid: 1281 },
  ironcrag: { firstgid: 1537 },
  murkfen: { firstgid: 1793 },
  saltwind: { firstgid: 2305 },
  amber: { firstgid: 2561 },
  shadowfen: { firstgid: 2817 },
};

const BIOME_KEYS = Object.keys(BIOMES);

const lakes = [
  { id: 'brightwater_lake', cx: 1125, cy: 555, rx: 165, ry: 96, classId: 1 },
  { id: 'glassmere_lake', cx: 2375, cy: 1770, rx: 150, ry: 88, classId: 1 },
  { id: 'southfield_pond', cx: 1035, cy: 2255, rx: 96, ry: 62, classId: 1 },
  { id: 'reedmere_lake', cx: 3180, cy: 3225, rx: 250, ry: 135, classId: 3 },
  { id: 'blackreed_lake', cx: 3525, cy: 3540, rx: 250, ry: 145, classId: 3 },
  { id: 'southmere_lake', cx: 3310, cy: 3820, rx: 300, ry: 112, classId: 3 },
  { id: 'tidefen_pool', cx: 3770, cy: 3820, rx: 165, ry: 102, classId: 3 },
];

const riverRoutes = [
  {
    id: 'northwood_spring_to_brightwater',
    width: 4.8,
    points: [[835, 240], [930, 360], [1030, 480], [1090, 540]],
  },
  {
    id: 'brightwater_outflow_to_east_sea',
    width: 6.5,
    points: [[1245, 565], [1580, 720], [2050, 960], [2650, 1110], [3250, 1130], [3994, 1115]],
  },
  {
    id: 'stonegrass_spring_to_glassmere',
    width: 4.8,
    points: [[1520, 2860], [1760, 2570], [2030, 2225], [2260, 1850]],
  },
  {
    id: 'glassmere_outflow_to_east_sea',
    width: 5.8,
    points: [[2480, 1795], [2890, 1930], [3350, 2070], [3994, 2075]],
  },
  {
    id: 'westfall_creek_to_southwest_sea',
    width: 4.2,
    points: [[610, 2470], [510, 2920], [395, 3400], [330, 3994]],
  },
  {
    id: 'southfield_runoff_to_marsh',
    width: 4.7,
    points: [[1660, 3180], [1970, 3045], [2370, 2980], [2820, 3090], [3075, 3240]],
  },
  {
    id: 'marsh_lake_outlet_to_southeast_sea',
    width: 5.2,
    points: [[3500, 3500], [3710, 3680], [3920, 3850], [3994, 3915]],
  },
];

const roadRoutes = [
  {
    id: 'north_trade_road',
    width: 3.2,
    points: [[560, 450], [1110, 530], [1850, 620], [2760, 470], [3550, 600], [3820, 820]],
  },
  {
    id: 'green_road_to_central_crossing',
    width: 3,
    points: [[560, 450], [915, 835], [1160, 1260], [1700, 1450], [2050, 1970], [2040, 2800], [2000, 3420]],
  },
  {
    id: 'west_coast_road',
    width: 2.7,
    points: [[560, 450], [430, 1040], [640, 1860], [520, 2700], [520, 3540]],
  },
  {
    id: 'south_caravan_road',
    width: 3.1,
    points: [[520, 3540], [1160, 3480], [2000, 3420], [2870, 3460], [3560, 3520]],
  },
  {
    id: 'east_wild_trail',
    width: 2.6,
    points: [[2760, 470], [3240, 880], [3480, 1220], [3620, 2100]],
  },
  {
    id: 'marsh_causeway',
    width: 2.6,
    points: [[2050, 1970], [2460, 2320], [2920, 2900], [3500, 2860], [3560, 3520]],
  },
];

const protectedObjectLayers = new Set([
  'CityArea',
  'Buildings',
  'Props',
  'Spawns',
  'BossSpawns',
  'NPCs',
  'QuestGiver',
  'raceStart',
  'Graveyards',
  'InteriorZones',
  'Landmarks',
  'Transitions',
]);

function globalIndex(x, y) {
  return y * WORLD_TILES + x;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function gid(biomeKey, localId) {
  return BIOMES[biomeKey].firstgid + localId - 1;
}

function familyForGid(value) {
  const clean = Number(value ?? 0) & TILED_GID_MASK;
  for (const key of BIOME_KEYS) {
    const firstgid = BIOMES[key].firstgid;
    if (clean >= firstgid && clean < firstgid + 256) return key;
  }
  return 'emerald';
}

function wave(value, scale, amount, phase = 0) {
  return Math.sin((value + phase) / scale) * amount;
}

function organicLine(value, scaleA, scaleB, amountA, amountB, phase = 0) {
  return wave(value, scaleA, amountA, phase) + wave(value, scaleB, amountB, phase * 1.7);
}

function ellipseValue(x, y, cx, cy, rx, ry) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
}

function distanceToSegmentSquared(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return (px - ax) ** 2 + (py - ay) ** 2;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const sx = ax + t * dx;
  const sy = ay + t * dy;
  return (px - sx) ** 2 + (py - sy) ** 2;
}

function routeDistanceSquared(x, y, points) {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    best = Math.min(best, distanceToSegmentSquared(x, y, ax, ay, bx, by));
  }
  return best;
}

function decodeLayer(layer) {
  if (Array.isArray(layer.data)) return Uint32Array.from(layer.data);
  if (layer.encoding !== 'base64' || layer.compression !== 'zlib' || typeof layer.data !== 'string') {
    throw new Error(`Unsupported layer encoding for ${layer.name}`);
  }
  const inflated = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(Math.floor(inflated.length / 4));
  for (let index = 0; index < data.length; index += 1) data[index] = inflated.readUInt32LE(index * 4);
  return data;
}

function encodeLayer(layer, data) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let index = 0; index < data.length; index += 1) buffer.writeUInt32LE(data[index] >>> 0, index * 4);
  layer.encoding = 'base64';
  layer.compression = 'zlib';
  layer.data = zlib.deflateSync(buffer, { level: 6 }).toString('base64');
}

function getTileLayer(map, name) {
  const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
  if (!layer) throw new Error(`Missing tile layer ${name}`);
  return layer;
}

function waterClassForGid(value) {
  const clean = Number(value ?? 0) & TILED_GID_MASK;
  if (!clean) return 0;
  if (clean === RIVER_WATER_GID || clean === RIVER_WATER_GID + 1) return 2;
  if (clean === SHALLOW_WATER_GID || clean === SHALLOW_WATER_GID + 1) return 3;
  return 1;
}

function waterGidForClass(classId) {
  if (classId === 2) return RIVER_WATER_GID;
  if (classId === 3) return SHALLOW_WATER_GID;
  return STILL_WATER_GID;
}

function markCircle(mask, cx, cy, radius) {
  const minX = clamp(Math.floor(cx - radius), 0, WORLD_TILES - 1);
  const maxX = clamp(Math.ceil(cx + radius), 0, WORLD_TILES - 1);
  const minY = clamp(Math.floor(cy - radius), 0, WORLD_TILES - 1);
  const maxY = clamp(Math.ceil(cy + radius), 0, WORLD_TILES - 1);
  const radiusSquared = radius * radius;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radiusSquared) mask[globalIndex(x, y)] = 1;
    }
  }
}

function markRect(mask, x, y, width, height, margin = 0) {
  const minX = clamp(Math.floor(x - margin), 0, WORLD_TILES - 1);
  const maxX = clamp(Math.ceil(x + width + margin), 0, WORLD_TILES - 1);
  const minY = clamp(Math.floor(y - margin), 0, WORLD_TILES - 1);
  const maxY = clamp(Math.ceil(y + height + margin), 0, WORLD_TILES - 1);
  for (let yy = minY; yy <= maxY; yy += 1) {
    for (let xx = minX; xx <= maxX; xx += 1) mask[globalIndex(xx, yy)] = 1;
  }
}

function buildIntegral(mask) {
  const stride = WORLD_TILES + 1;
  const integral = new Uint32Array(stride * stride);
  for (let y = 1; y <= WORLD_TILES; y += 1) {
    let row = 0;
    for (let x = 1; x <= WORLD_TILES; x += 1) {
      row += mask[globalIndex(x - 1, y - 1)];
      integral[y * stride + x] = integral[(y - 1) * stride + x] + row;
    }
  }
  return integral;
}

function areaSum(integral, x0, y0, x1, y1) {
  const stride = WORLD_TILES + 1;
  const left = clamp(x0, 0, WORLD_TILES);
  const top = clamp(y0, 0, WORLD_TILES);
  const right = clamp(x1, 0, WORLD_TILES);
  const bottom = clamp(y1, 0, WORLD_TILES);
  return integral[bottom * stride + right]
    - integral[top * stride + right]
    - integral[bottom * stride + left]
    + integral[top * stride + left];
}

function expandWithinMask(seedMask, allowedMask, limit) {
  const output = new Uint8Array(WORLD_TILE_COUNT);
  const distance = new Uint8Array(WORLD_TILE_COUNT);
  const queue = new Int32Array(WORLD_TILE_COUNT);
  let head = 0;
  let tail = 0;

  for (let index = 0; index < WORLD_TILE_COUNT; index += 1) {
    if (!seedMask[index]) continue;
    output[index] = 1;
    distance[index] = 1;
    queue[tail] = index;
    tail += 1;
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const nextDistance = distance[index] + 1;
    if (nextDistance > limit + 1) continue;
    const x = index % WORLD_TILES;
    const y = Math.floor(index / WORLD_TILES);
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x < WORLD_TILES - 1 ? index + 1 : -1,
      y > 0 ? index - WORLD_TILES : -1,
      y < WORLD_TILES - 1 ? index + WORLD_TILES : -1,
    ];
    for (const neighbor of neighbors) {
      if (neighbor < 0 || distance[neighbor] || !allowedMask[neighbor]) continue;
      output[neighbor] = 1;
      distance[neighbor] = nextDistance;
      queue[tail] = neighbor;
      tail += 1;
    }
  }

  return output;
}

function expandMask(seedMask, limit) {
  const allowed = new Uint8Array(WORLD_TILE_COUNT);
  allowed.fill(1);
  return expandWithinMask(seedMask, allowed, limit);
}

function buildOceanMask(oldWater) {
  const integral = buildIntegral(oldWater);
  const wideWater = new Uint8Array(WORLD_TILE_COUNT);

  for (let y = 0; y < WORLD_TILES; y += 1) {
    for (let x = 0; x < WORLD_TILES; x += 1) {
      const index = globalIndex(x, y);
      if (!oldWater[index]) continue;
      const left = clamp(x - 12, 0, WORLD_TILES);
      const top = clamp(y - 12, 0, WORLD_TILES);
      const right = clamp(x + 13, 0, WORLD_TILES);
      const bottom = clamp(y + 13, 0, WORLD_TILES);
      const area = Math.max(1, (right - left) * (bottom - top));
      if (areaSum(integral, left, top, right, bottom) >= area * 0.88) wideWater[index] = 1;
    }
  }

  const oceanCore = new Uint8Array(WORLD_TILE_COUNT);
  const queue = new Int32Array(WORLD_TILE_COUNT);
  let head = 0;
  let tail = 0;
  const push = (index) => {
    if (!wideWater[index] || oceanCore[index]) return;
    oceanCore[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < WORLD_TILES; x += 1) {
    push(globalIndex(x, 0));
    push(globalIndex(x, WORLD_TILES - 1));
  }
  for (let y = 0; y < WORLD_TILES; y += 1) {
    push(globalIndex(0, y));
    push(globalIndex(WORLD_TILES - 1, y));
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % WORLD_TILES;
    const y = Math.floor(index / WORLD_TILES);
    if (x > 0) push(index - 1);
    if (x < WORLD_TILES - 1) push(index + 1);
    if (y > 0) push(index - WORLD_TILES);
    if (y < WORLD_TILES - 1) push(index + WORLD_TILES);
  }

  const ocean = expandWithinMask(oceanCore, oldWater, 16);
  for (let y = 0; y < WORLD_TILES; y += 1) {
    for (let x = 0; x < WORLD_TILES; x += 1) {
      const index = globalIndex(x, y);
      const southernSea = y > 3470 + organicLine(x, 480, 1160, 42, 24, 35);
      if (southernSea && oldWater[index]) ocean[index] = 1;

      const legacyCanal = distanceToSegmentSquared(x, y, 2368, 250, 2368, 900) < 34 ** 2
        || distanceToSegmentSquared(x, y, 3292, 850, 3286, 1450) < 65 ** 2
        || distanceToSegmentSquared(x, y, 3540, 2700, 3994, 3000) < 44 ** 2
        || distanceToSegmentSquared(x, y, 3440, 3030, 3994, 3400) < 44 ** 2
        || distanceToSegmentSquared(x, y, 3260, 3450, 3994, 3980) < 44 ** 2
        || distanceToSegmentSquared(x, y, 3070, 3150, 3994, 3335) < 70 ** 2
        || distanceToSegmentSquared(x, y, 3320, 3660, 3994, 3920) < 60 ** 2
        || distanceToSegmentSquared(x, y, 3700, 3000, 3994, 3180) < 60 ** 2;
      if (legacyCanal && !southernSea) ocean[index] = 0;
    }
  }
  return ocean;
}

function paintLake(waterClass, protectionMask, lake) {
  const minX = clamp(Math.floor(lake.cx - lake.rx - 8), 0, WORLD_TILES - 1);
  const maxX = clamp(Math.ceil(lake.cx + lake.rx + 8), 0, WORLD_TILES - 1);
  const minY = clamp(Math.floor(lake.cy - lake.ry - 8), 0, WORLD_TILES - 1);
  const maxY = clamp(Math.ceil(lake.cy + lake.ry + 8), 0, WORLD_TILES - 1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const index = globalIndex(x, y);
      if (protectionMask[index]) continue;
      const bendX = x + organicLine(y, 95, 210, lake.rx * 0.025, lake.rx * 0.018, lake.cx);
      const bendY = y + organicLine(x, 120, 260, lake.ry * 0.026, lake.ry * 0.015, lake.cy);
      if (ellipseValue(bendX, bendY, lake.cx, lake.cy, lake.rx, lake.ry) < 1) waterClass[index] = lake.classId;
    }
  }
}

function paintRoute(mask, route, value) {
  for (let segment = 1; segment < route.points.length; segment += 1) {
    const [ax, ay] = route.points[segment - 1];
    const [bx, by] = route.points[segment];
    const margin = Math.ceil(route.width + 4);
    const minX = clamp(Math.floor(Math.min(ax, bx) - margin), 0, WORLD_TILES - 1);
    const maxX = clamp(Math.ceil(Math.max(ax, bx) + margin), 0, WORLD_TILES - 1);
    const minY = clamp(Math.floor(Math.min(ay, by) - margin), 0, WORLD_TILES - 1);
    const maxY = clamp(Math.ceil(Math.max(ay, by) + margin), 0, WORLD_TILES - 1);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.sqrt(distanceToSegmentSquared(x, y, ax, ay, bx, by));
        if (distance <= route.width) mask[globalIndex(x, y)] = value;
      }
    }
  }
}

function paintRiver(waterClass, protectionMask, route) {
  for (let segment = 1; segment < route.points.length; segment += 1) {
    const [ax, ay] = route.points[segment - 1];
    const [bx, by] = route.points[segment];
    const margin = Math.ceil(route.width + 4);
    const minX = clamp(Math.floor(Math.min(ax, bx) - margin), 0, WORLD_TILES - 1);
    const maxX = clamp(Math.ceil(Math.max(ax, bx) + margin), 0, WORLD_TILES - 1);
    const minY = clamp(Math.floor(Math.min(ay, by) - margin), 0, WORLD_TILES - 1);
    const maxY = clamp(Math.ceil(Math.max(ay, by) + margin), 0, WORLD_TILES - 1);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const index = globalIndex(x, y);
        if (protectionMask[index]) continue;
        const distance = Math.sqrt(distanceToSegmentSquared(x, y, ax, ay, bx, by));
        if (distance <= route.width) waterClass[index] = 2;
        else if (distance <= route.width + 2 && waterClass[index] === 0) waterClass[index] = 3;
      }
    }
  }
}

function nearestRiverSegment(x, y) {
  let best = null;
  for (const route of riverRoutes) {
    for (let index = 1; index < route.points.length; index += 1) {
      const [ax, ay] = route.points[index - 1];
      const [bx, by] = route.points[index];
      const distanceSquared = distanceToSegmentSquared(x, y, ax, ay, bx, by);
      if (!best || distanceSquared < best.distanceSquared) best = { distanceSquared, dx: bx - ax, dy: by - ay };
    }
  }
  return best;
}

function flowGidForTile(x, y) {
  const segment = nearestRiverSegment(x, y);
  const dx = segment?.dx ?? 1;
  const dy = segment?.dy ?? 0;
  if (Math.abs(dx) > Math.abs(dy) * 1.35) return WATER_FX_FIRST_GID;
  if (Math.abs(dy) > Math.abs(dx) * 1.35) return WATER_FX_FIRST_GID + 2;
  return dx * dy >= 0 ? WATER_FX_FIRST_GID + 4 : WATER_FX_FIRST_GID + 6;
}

function macroRegion(x, y, masks) {
  const index = globalIndex(x, y);
  const warpedX = x
    + organicLine(y, 420, 930, 76, 38, 18)
    + organicLine(x + y, 760, 1420, 22, 12, 110);
  const warpedY = y
    + organicLine(x, 390, 870, 72, 34, 240)
    + organicLine(y - x, 720, 1360, 20, 12, 30);

  const nwScore = 1.08 - ellipseValue(warpedX, warpedY, 710, 850, 690, 930);
  const northMeadowScore = 1.02 - ellipseValue(warpedX, warpedY, 2800, 430, 900, 440);
  const eastWildScore = 1.0 - ellipseValue(warpedX, warpedY, 3420, 1500, 650, 930);
  const southFieldScore = (warpedY - (2630 + organicLine(x, 560, 1200, 88, 50, 80))) / 260;
  const marshWest = 3070
    + organicLine(y, 430, 980, 94, 52, 80)
    - Math.max(0, y - 2700) * 0.46;
  const marshNorth = 2520
    + organicLine(x, 430, 920, 100, 54, 250)
    + Math.max(0, 3160 - x) * 0.16;
  const marshLowland = x > marshWest && y > marshNorth;
  const marshLakeBasin = ellipseValue(warpedX, warpedY, 3440, 3520, 630, 390) < 0.92;
  const stoneScore = Math.max(
    0.72 - ellipseValue(warpedX, warpedY, 1410, 2870, 270, 170),
    0.62 - ellipseValue(warpedX, warpedY, 2080, 2820, 220, 145),
    0.48 - ellipseValue(warpedX, warpedY, 820, 3160, 175, 130),
  );

  const marsh = marshLowland || marshLakeBasin;
  const stonegrass = !marsh && stoneScore > 0;
  const southFields = !marsh && !stonegrass && southFieldScore > 0;
  const nwForest = !marsh && !southFields && nwScore > 0;
  const eastWilds = !marsh && !southFields && eastWildScore > 0;
  const northMeadow = !marsh && !southFields && northMeadowScore > 0;

  return {
    nwForest,
    southFields,
    eastWilds,
    marsh,
    stonegrass,
    northMeadow,
    coast: Boolean(masks.oceanNear[index]),
    waterEdge: Boolean(masks.waterEdge[index]),
    riverMeadow: Boolean(masks.riverNear[index]),
    roadNear: Boolean(masks.roadNear[index]),
  };
}

function chooseGroundGid(x, y, classId, masks) {
  const region = macroRegion(x, y, masks);

  if (classId) {
    if (classId === 3 || region.marsh) return gid('murkfen', LOCAL.base);
    if (region.coast) return gid('saltwind', LOCAL.base);
    return gid('silver', LOCAL.light);
  }

  if (region.waterEdge) {
    if (region.marsh) return gid('murkfen', LOCAL.mud);
    if (region.coast) return gid('saltwind', LOCAL.sand);
    return gid('silver', LOCAL.bank);
  }

  if (region.roadNear) {
    if (region.marsh) return gid('murkfen', LOCAL.base);
    if (region.southFields) return gid('golden', LOCAL.base);
    if (region.nwForest || region.eastWilds) return gid('emerald', LOCAL.base);
    return gid('emerald', LOCAL.light);
  }

  if (region.riverMeadow) {
    if (region.marsh) return gid('murkfen', LOCAL.base);
    if (region.southFields) return gid('golden', LOCAL.base);
    return gid('silver', LOCAL.light);
  }

  if (region.stonegrass) {
    if (ellipseValue(x, y, 1420, 2850, 185, 105) < 0.42) return gid('cloudspine', LOCAL.base);
    if (ellipseValue(x, y, 2080, 2830, 155, 95) < 0.38) return gid('ironcrag', LOCAL.stone);
    return gid('sunhill', LOCAL.base);
  }

  if (region.marsh) {
    const deepMarsh = x > 3380 + organicLine(y, 360, 840, 78, 42, 170)
      && y > 3060 + organicLine(x, 390, 760, 86, 44, 70);
    if (deepMarsh) return gid('shadowfen', LOCAL.base);
    return gid('murkfen', LOCAL.base);
  }

  if (region.nwForest) {
    const deep = x < 780 + organicLine(y, 260, 620, 90, 40, 0)
      || y < 720 + organicLine(x, 280, 710, 80, 45, 40);
    return gid(deep ? 'elderwood' : 'emerald', deep ? LOCAL.base : LOCAL.base);
  }

  if (region.eastWilds) {
    const deep = x > 3320 + organicLine(y, 260, 600, 80, 45, 200)
      || y > 1580 + organicLine(x, 320, 680, 90, 45, 90);
    return gid(deep ? 'elderwood' : 'emerald', deep ? LOCAL.base : LOCAL.base);
  }

  if (region.southFields) {
    if (y > 3140 + organicLine(x, 360, 720, 95, 45, 70)) return gid('amber', LOCAL.base);
    return gid('sunhill', LOCAL.base);
  }

  if (region.coast) return gid('saltwind', LOCAL.base);

  if (region.northMeadow) return gid('golden', LOCAL.base);
  return gid('emerald', LOCAL.base);
}

function roadGidForTile(groundGidValue, roadClassValue, bridge) {
  if (bridge) return gid('oldEmpire' in BIOMES ? 'oldEmpire' : 'cloudspine', LOCAL.stone);
  const family = familyForGid(groundGidValue);
  if (family === 'murkfen' || family === 'shadowfen') return gid('murkfen', LOCAL.dirt);
  if (family === 'amber') return gid('amber', roadClassValue === 1 ? LOCAL.path : LOCAL.road);
  if (family === 'saltwind') return gid('saltwind', roadClassValue === 1 ? LOCAL.path : LOCAL.road);
  if (family === 'cloudspine' || family === 'ironcrag') return gid('cloudspine', roadClassValue === 1 ? LOCAL.roadEdge : LOCAL.road);
  return gid(family, roadClassValue === 1 ? LOCAL.path : LOCAL.road);
}

async function main() {
  const regionEntries = [];
  const oldWaterMask = new Uint8Array(WORLD_TILE_COUNT);
  const protectionMask = new Uint8Array(WORLD_TILE_COUNT);
  const strictCityMask = new Uint8Array(WORLD_TILE_COUNT);
  const objectLayerSignatureBefore = [];
  const objectLayerSignatureAfter = [];

  for (let regionY = 0; regionY < REGION_GRID; regionY += 1) {
    for (let regionX = 0; regionX < REGION_GRID; regionX += 1) {
      const file = path.join(regionsDir, `continent_01_region_${regionX}_${regionY}.tmj`);
      const map = JSON.parse(await fs.readFile(file, 'utf8'));
      const water = decodeLayer(getTileLayer(map, 'Water'));
      const offsetX = regionX * REGION_TILES;
      const offsetY = regionY * REGION_TILES;

      for (let localY = 0; localY < REGION_TILES; localY += 1) {
        for (let localX = 0; localX < REGION_TILES; localX += 1) {
          const localIndex = localY * REGION_TILES + localX;
          if (waterClassForGid(water[localIndex])) oldWaterMask[globalIndex(offsetX + localX, offsetY + localY)] = 1;
        }
      }

      for (const layer of map.layers) {
        if (layer.type === 'objectgroup') objectLayerSignatureBefore.push(`${regionX}_${regionY}:${layer.name}:${(layer.objects ?? []).length}`);
        if (layer.type !== 'objectgroup' || !protectedObjectLayers.has(layer.name)) continue;
        for (const object of layer.objects ?? []) {
          const objectX = offsetX + Number(object.x ?? 0) / TILE_SIZE;
          const objectY = offsetY + Number(object.y ?? 0) / TILE_SIZE;
          const width = Number(object.width ?? 0) / TILE_SIZE;
          const height = Number(object.height ?? 0) / TILE_SIZE;
          if (layer.name === 'CityArea') {
            markRect(strictCityMask, objectX - 12, objectY - 12, width + 24, height + 24);
            markRect(protectionMask, objectX - 16, objectY - 16, width + 32, height + 32);
          } else if (width > 0 || height > 0) {
            markRect(protectionMask, objectX, objectY, Math.max(1, width), Math.max(1, height), 5);
          } else {
            markCircle(protectionMask, objectX, objectY, layer.name === 'BossSpawns' ? 14 : 7);
          }
        }
      }

      regionEntries.push({ file, map, regionX, regionY });
    }
  }

  const oceanMask = buildOceanMask(oldWaterMask);
  const waterClass = new Uint8Array(WORLD_TILE_COUNT);
  for (let index = 0; index < WORLD_TILE_COUNT; index += 1) {
    if (oceanMask[index]) waterClass[index] = 1;
  }

  for (const route of riverRoutes) paintRiver(waterClass, protectionMask, route);
  for (const lake of lakes) paintLake(waterClass, protectionMask, lake);

  for (let index = 0; index < WORLD_TILE_COUNT; index += 1) {
    if (protectionMask[index] && !strictCityMask[index]) waterClass[index] = 0;
  }

  const roadClass = new Uint8Array(WORLD_TILE_COUNT);
  for (const route of roadRoutes) {
    paintRoute(roadClass, route, 2);
    const edgeRoute = { ...route, width: route.width + 1.2 };
    paintRoute(roadClass, edgeRoute, 1);
    paintRoute(roadClass, route, 2);
  }

  const waterEdge = new Uint8Array(WORLD_TILE_COUNT);
  const riverMask = new Uint8Array(WORLD_TILE_COUNT);
  for (let y = 0; y < WORLD_TILES; y += 1) {
    for (let x = 0; x < WORLD_TILES; x += 1) {
      const index = globalIndex(x, y);
      if (waterClass[index] === 2) riverMask[index] = 1;
      if (waterClass[index]) continue;
      if ((x > 0 && waterClass[index - 1])
        || (x < WORLD_TILES - 1 && waterClass[index + 1])
        || (y > 0 && waterClass[index - WORLD_TILES])
        || (y < WORLD_TILES - 1 && waterClass[index + WORLD_TILES])) {
        waterEdge[index] = 1;
      }
    }
  }

  const roadSeed = new Uint8Array(WORLD_TILE_COUNT);
  for (let index = 0; index < WORLD_TILE_COUNT; index += 1) {
    if (roadClass[index]) roadSeed[index] = 1;
  }

  const masks = {
    oceanNear: expandMask(oceanMask, 8),
    waterEdge,
    riverNear: expandMask(riverMask, 8),
    roadNear: expandMask(roadSeed, 5),
  };

  const stats = {
    changedRegions: [],
    water: { ocean: 0, river: 0, shallow: 0, still: 0 },
    roads: { tiles: 0, bridgeTiles: 0 },
    groundFamilies: Object.fromEntries(BIOME_KEYS.map((key) => [key, 0])),
    objectLayerCountsChanged: 0,
    terrainDetailsCleared: 0,
  };

  for (const entry of regionEntries) {
    const { file, map, regionX, regionY } = entry;
    const groundLayer = getTileLayer(map, 'Ground');
    const waterLayer = getTileLayer(map, 'Water');
    const riverFlowLayer = getTileLayer(map, 'RiverFlow');
    const waterEdgesLayer = getTileLayer(map, 'WaterEdges');
    const waterFxLayer = getTileLayer(map, 'WaterFX');
    const terrainLayer = getTileLayer(map, 'TerrainDetails');
    const roadsLayer = getTileLayer(map, 'Roads');
    const collisionLayer = getTileLayer(map, 'Collision');

    const oldGround = decodeLayer(groundLayer);
    const oldWater = decodeLayer(waterLayer);
    const oldRiverFlow = decodeLayer(riverFlowLayer);
    const oldWaterEdges = decodeLayer(waterEdgesLayer);
    const oldWaterFx = decodeLayer(waterFxLayer);
    const oldTerrain = decodeLayer(terrainLayer);
    const oldRoads = decodeLayer(roadsLayer);
    const oldCollision = decodeLayer(collisionLayer);

    const nextGround = new Uint32Array(oldGround.length);
    const nextWater = new Uint32Array(oldWater.length);
    const nextRiverFlow = new Uint32Array(oldRiverFlow.length);
    const nextWaterEdges = new Uint32Array(oldWaterEdges.length);
    const nextWaterFx = new Uint32Array(oldWaterFx.length);
    const nextTerrain = new Uint32Array(oldTerrain.length);
    const nextRoads = new Uint32Array(oldRoads.length);
    const nextCollision = new Uint32Array(oldCollision);
    const collisionGid = Number((map.tilesets ?? []).find((tileset) => /collision_debug/i.test(tileset.source ?? ''))?.firstgid ?? 0);
    const offsetX = regionX * REGION_TILES;
    const offsetY = regionY * REGION_TILES;
    let changedThisRegion = false;

    for (let localY = 0; localY < REGION_TILES; localY += 1) {
      for (let localX = 0; localX < REGION_TILES; localX += 1) {
        const localIndex = localY * REGION_TILES + localX;
        const x = offsetX + localX;
        const y = offsetY + localY;
        const index = globalIndex(x, y);

        if (strictCityMask[index]) {
          nextGround[localIndex] = oldGround[localIndex];
          nextWater[localIndex] = oldWater[localIndex];
          nextRiverFlow[localIndex] = oldRiverFlow[localIndex];
          nextWaterEdges[localIndex] = oldWaterEdges[localIndex];
          nextWaterFx[localIndex] = oldWaterFx[localIndex];
          nextTerrain[localIndex] = oldTerrain[localIndex];
          nextRoads[localIndex] = oldRoads[localIndex];
          nextCollision[localIndex] = oldCollision[localIndex];
          continue;
        }

        const classId = waterClass[index];
        const isOcean = Boolean(oceanMask[index]);
        const roadClassValue = isOcean ? 0 : roadClass[index];
        const bridge = Boolean(classId && roadClassValue && !isOcean);
        const groundGidValue = chooseGroundGid(x, y, classId, masks);

        nextGround[localIndex] = groundGidValue;
        nextWater[localIndex] = classId ? waterGidForClass(classId) : 0;
        if (classId === 2) nextRiverFlow[localIndex] = flowGidForTile(x, y);
        if (classId === 3 && (x + y) % 97 === 0) nextWaterFx[localIndex] = WATER_FX_FIRST_GID + 12;
        if (classId === 1 && waterEdge[index] && (x + y) % 181 === 0) nextWaterFx[localIndex] = WATER_FX_FIRST_GID + 8;

        if (!classId) {
          const north = y > 0 && waterClass[index - WORLD_TILES];
          const south = y < WORLD_TILES - 1 && waterClass[index + WORLD_TILES];
          const west = x > 0 && waterClass[index - 1];
          const east = x < WORLD_TILES - 1 && waterClass[index + 1];
          if (north && west) nextWaterEdges[localIndex] = SHORE_NW_GID;
          else if (north && east) nextWaterEdges[localIndex] = SHORE_NE_GID;
          else if (south && west) nextWaterEdges[localIndex] = SHORE_SW_GID;
          else if (south && east) nextWaterEdges[localIndex] = SHORE_SE_GID;
          else if (north) nextWaterEdges[localIndex] = SHORE_NORTH_GID;
          else if (south) nextWaterEdges[localIndex] = SHORE_SOUTH_GID;
          else if (west) nextWaterEdges[localIndex] = SHORE_WEST_GID;
          else if (east) nextWaterEdges[localIndex] = SHORE_EAST_GID;
        }

        if (roadClassValue) {
          nextRoads[localIndex] = roadGidForTile(groundGidValue, roadClassValue, bridge);
          stats.roads.tiles += 1;
          if (bridge) stats.roads.bridgeTiles += 1;
        }

        if (classId && collisionGid && !bridge) nextCollision[localIndex] = collisionGid;
        else if (roadClassValue || (oldWaterMask[index] && !classId && oldCollision[localIndex] === collisionGid)) nextCollision[localIndex] = 0;

        if (oldTerrain[localIndex]) stats.terrainDetailsCleared += 1;
        if (classId === 1) {
          if (isOcean) stats.water.ocean += 1;
          else stats.water.still += 1;
        } else if (classId === 2) stats.water.river += 1;
        else if (classId === 3) stats.water.shallow += 1;

        const family = familyForGid(groundGidValue);
        if (stats.groundFamilies[family] !== undefined) stats.groundFamilies[family] += 1;

        changedThisRegion ||= oldGround[localIndex] !== nextGround[localIndex]
          || oldWater[localIndex] !== nextWater[localIndex]
          || oldRoads[localIndex] !== nextRoads[localIndex]
          || oldTerrain[localIndex] !== 0;
      }
    }

    encodeLayer(groundLayer, nextGround);
    encodeLayer(waterLayer, nextWater);
    encodeLayer(riverFlowLayer, nextRiverFlow);
    encodeLayer(waterEdgesLayer, nextWaterEdges);
    encodeLayer(waterFxLayer, nextWaterFx);
    encodeLayer(terrainLayer, nextTerrain);
    encodeLayer(roadsLayer, nextRoads);
    encodeLayer(collisionLayer, nextCollision);
    collisionLayer.visible = false;

    await fs.writeFile(file, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
    if (changedThisRegion) stats.changedRegions.push(path.relative(rootDir, file).replaceAll(path.sep, '/'));

    for (const layer of map.layers) {
      if (layer.type === 'objectgroup') objectLayerSignatureAfter.push(`${regionX}_${regionY}:${layer.name}:${(layer.objects ?? []).length}`);
    }
  }

  stats.objectLayerCountsChanged = objectLayerSignatureBefore.join('|') === objectLayerSignatureAfter.join('|') ? 0 : 1;
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
