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
  cliffDirt: 18,
  mossStone: 19,
  sand: 20,
  tallGrass: 21,
  roadEdge: 23,
  ruinFloor: 24,
  rock: 37,
  cliff: 51,
  scree: 52,
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
  oldEmpire: { firstgid: 2049 },
  saltwind: { firstgid: 2305 },
  amber: { firstgid: 2561 },
  shadowfen: { firstgid: 2817 },
};

const riverRoutes = [
  {
    name: 'north_run',
    width: 7,
    points: [
      [780, 610], [1025, 735], [1285, 805], [1535, 925], [1805, 1085],
      [2090, 1208], [2380, 1305], [2700, 1370], [3045, 1332], [3400, 1285],
      [3715, 1268], [3994, 1242],
    ],
  },
  {
    name: 'old_vale_outflow',
    width: 9,
    points: [
      [970, 2760], [1130, 2615], [1325, 2460], [1505, 2265], [1740, 2115],
      [1990, 1995], [2255, 1840], [2430, 1700], [2650, 1745], [2915, 1935],
      [3150, 2195], [3400, 2440], [3690, 2680], [3993, 2860],
    ],
  },
  {
    name: 'south_marsh_drain',
    width: 7,
    points: [
      [1940, 3155], [2180, 2995], [2445, 2998], [2700, 3135], [2970, 3330],
      [3270, 3510], [3610, 3745], [3988, 3890],
    ],
  },
  {
    name: 'vale_tributary_north',
    width: 4,
    points: [
      [1350, 2110], [1510, 2225], [1675, 2260], [1840, 2200],
    ],
  },
  {
    name: 'highland_spring',
    width: 4,
    points: [
      [700, 3220], [875, 3040], [1055, 2895], [1180, 2635],
    ],
  },
  {
    name: 'marsh_feed',
    width: 5,
    points: [
      [2820, 2900], [3010, 3060], [3195, 3240], [3375, 3385],
    ],
  },
];

const mainPass = [
  [260, 3210], [560, 3065], [900, 2950], [1250, 2870], [1600, 2775], [1960, 2600], [2300, 2400],
];
const sidePasses = [
  [[760, 3470], [1000, 3290], [1285, 3090], [1510, 2910]],
];
const reserveClearings = [
  { cx: 1035, cy: 3035, rx: 90, ry: 60, kind: 'mine' },
  { cx: 1415, cy: 3110, rx: 105, ry: 70, kind: 'ruin' },
  { cx: 1710, cy: 2800, rx: 95, ry: 64, kind: 'cave' },
];

const marshLakes = [
  { cx: 3180, cy: 3290, rx: 280, ry: 145, type: 3 },
  { cx: 3550, cy: 3610, rx: 230, ry: 160, type: 3 },
  { cx: 3360, cy: 3890, rx: 360, ry: 120, type: 3 },
  { cx: 3780, cy: 3370, rx: 120, ry: 90, type: 1 },
  { cx: 2980, cy: 3740, rx: 155, ry: 105, type: 3 },
];

function globalIndex(x, y) {
  return y * WORLD_TILES + x;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function gid(biomeKey, localId) {
  return BIOMES[biomeKey].firstgid + localId - 1;
}

function hash2(x, y, seed = 0) {
  let value = ((x + seed * 101) * 374761393 + (y - seed * 37) * 668265263) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function lowWave(x, y, scale, seed = 0) {
  return Math.sin((x + seed * 43) / scale) * 0.5 + Math.cos((y - seed * 29) / (scale * 1.31)) * 0.5;
}

function patchValue(x, y, seed = 0) {
  return lowWave(x, y, 128, seed) * 0.56
    + lowWave(x - 37, y + 41, 265, seed + 3) * 0.34
    + (hash2(Math.floor(x / 44), Math.floor(y / 44), seed + 13) - 0.5) * 0.18;
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

function nearestRiverSegment(x, y) {
  let best = null;
  for (const route of riverRoutes) {
    for (let index = 1; index < route.points.length; index += 1) {
      const [ax, ay] = route.points[index - 1];
      const [bx, by] = route.points[index];
      const distanceSquared = distanceToSegmentSquared(x, y, ax, ay, bx, by);
      if (!best || distanceSquared < best.distanceSquared) {
        best = { route, distanceSquared, dx: bx - ax, dy: by - ay };
      }
    }
  }
  return best;
}

function nearestRiverDistanceSquared(x, y) {
  return nearestRiverSegment(x, y)?.distanceSquared ?? Number.POSITIVE_INFINITY;
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

function getLayer(map, name) {
  const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
  if (!layer) throw new Error(`Missing tile layer ${name}`);
  return layer;
}

function waterClassForGid(value) {
  const gidValue = Number(value ?? 0) & TILED_GID_MASK;
  if (!gidValue) return 0;
  if (gidValue === RIVER_WATER_GID || gidValue === RIVER_WATER_GID + 1) return 2;
  if (gidValue === SHALLOW_WATER_GID || gidValue === SHALLOW_WATER_GID + 1) return 3;
  return 1;
}

function waterGidForClass(classId) {
  if (classId === 2) return RIVER_WATER_GID;
  if (classId === 3) return SHALLOW_WATER_GID;
  return STILL_WATER_GID;
}

function waterNeighborCount(waterClass, x, y, radius = 1) {
  let count = 0;
  for (let yy = Math.max(0, y - radius); yy <= Math.min(WORLD_TILES - 1, y + radius); yy += 1) {
    for (let xx = Math.max(0, x - radius); xx <= Math.min(WORLD_TILES - 1, x + radius); xx += 1) {
      if (xx === x && yy === y) continue;
      if (waterClass[globalIndex(xx, yy)]) count += 1;
    }
  }
  return count;
}

function buildInfluence(mask, radius, maxDistanceSquared) {
  const influence = new Uint8Array(WORLD_TILE_COUNT);
  for (let y = 0; y < WORLD_TILES; y += 1) {
    for (let x = 0; x < WORLD_TILES; x += 1) {
      const index = globalIndex(x, y);
      if (!mask[index]) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= WORLD_TILES) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > maxDistanceSquared) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= WORLD_TILES) continue;
          influence[globalIndex(xx, yy)] = 1;
        }
      }
    }
  }
  return influence;
}

function isInsideProtectedCity(globalTileX, globalTileY, protectedCityRects) {
  return protectedCityRects.some((rect) => (
    globalTileX >= rect.x
    && globalTileX <= rect.x + rect.width
    && globalTileY >= rect.y
    && globalTileY <= rect.y + rect.height
  ));
}

function legacyHighlandValue(x, y) {
  const west = ellipseValue(x, y, 1040, 3010, 880, 650);
  const east = ellipseValue(x, y, 1740, 2850, 760, 560);
  const south = ellipseValue(x, y, 1220, 3320, 680, 360);
  return Math.min(west, east, south) + lowWave(x, y, 171, 41) * 0.07 + patchValue(x, y, 173) * 0.04;
}

function highlandValue(x, y) {
  const west = ellipseValue(x, y, 1015, 3035, 760, 555);
  const east = ellipseValue(x, y, 1630, 2875, 640, 470);
  const south = ellipseValue(x, y, 1165, 3330, 560, 305);
  const northPlainNotch = Math.max(0, 1 - ellipseValue(x, y, 760, 2475, 430, 240)) * 0.16;
  const eastPlainNotch = Math.max(0, 1 - ellipseValue(x, y, 2180, 3090, 430, 320)) * 0.18;
  const coastNotch = Math.max(0, 1 - ellipseValue(x, y, 705, 3630, 420, 300)) * 0.12;
  return Math.min(west, east, south)
    + lowWave(x, y, 171, 41) * 0.08
    + patchValue(x, y, 173) * 0.06
    + northPlainNotch
    + eastPlainNotch
    + coastNotch;
}

function isInHighland(x, y) {
  return highlandValue(x, y) < 0.86;
}

function isHighlandFootprint(x, y) {
  return highlandValue(x, y) < 1.02;
}

function isLegacyHighlandFootprint(x, y) {
  return legacyHighlandValue(x, y) < 1.11;
}

function isMountainAdjustmentArea(x, y) {
  return x >= 0 && x <= 2550 && y >= 2200 && y <= 3975;
}

function isMountainGround(value) {
  const gidValue = Number(value ?? 0) & TILED_GID_MASK;
  return (gidValue >= BIOMES.cloudspine.firstgid && gidValue < BIOMES.cloudspine.firstgid + 256)
    || (gidValue >= BIOMES.ironcrag.firstgid && gidValue < BIOMES.ironcrag.firstgid + 256);
}

function isOldTransitionResidueGround(value) {
  const gidValue = Number(value ?? 0) & TILED_GID_MASK;
  return gidValue >= BIOMES.oldEmpire.firstgid && gidValue < BIOMES.oldEmpire.firstgid + 256;
}

function highlandOuterEdge(x, y) {
  const value = highlandValue(x, y);
  return value > 0.66 && value < 0.9;
}

function smoothField(x, y, seed = 0) {
  return Math.sin((x + seed * 37) / 211) * 0.28
    + Math.cos((y - seed * 29) / 247) * 0.24
    + Math.sin((x * 0.42 + y * 0.31 + seed * 53) / 331) * 0.22
    + Math.cos((x * 0.27 - y * 0.39 - seed * 41) / 173) * 0.18;
}

function smoothStep(value) {
  return value * value * (3 - 2 * value);
}

function valueNoise(x, y, cellSize, seed = 0) {
  const fx = x / cellSize;
  const fy = y / cellSize;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smoothStep(fx - x0);
  const ty = smoothStep(fy - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

function southTransitionNorthEdge(x) {
  return 2380
    + smoothField(x, 2310, 17) * 78
    + Math.sin(x / 117) * 24;
}

function southTransitionEastEdge(y) {
  if (y < 2860) return 1980 + smoothField(y, 0, 19) * 120;
  if (y < 3300) return 2320 + smoothField(y, 0, 23) * 115;
  return 2550 + smoothField(y, 0, 29) * 90;
}

function southTransitionWestEdge(y) {
  return 85 + smoothField(0, y, 31) * 42;
}

function southTransitionSouthEdge(x) {
  return 3925 + smoothField(x, 0, 37) * 46;
}

function isSouthTransitionCleanupArea(x, y) {
  if (x < southTransitionWestEdge(y) || x > southTransitionEastEdge(y)) return false;
  if (y < southTransitionNorthEdge(x) || y > southTransitionSouthEdge(x)) return false;
  return true;
}

function isSimplifiedTransitionFootprint(x, y, oldGroundValue) {
  if (!isMountainAdjustmentArea(x, y)) return false;
  if (isSouthTransitionCleanupArea(x, y)) return true;
  return isMountainGround(oldGroundValue) || isOldTransitionResidueGround(oldGroundValue);
}

function highlandPassInfo(x, y, roadNear) {
  const mainDistance = Math.sqrt(routeDistanceSquared(x, y, mainPass));
  const sideDistances = sidePasses.map((pass) => Math.sqrt(routeDistanceSquared(x, y, pass)));
  const clearing = reserveClearings.find((entry) => ellipseValue(x, y, entry.cx, entry.cy, entry.rx, entry.ry) < 1);
  const inMainPass = mainDistance < 48;
  const inSidePass = sideDistances.some((distance) => distance < 30);
  return {
    clearing,
    inPass: inMainPass || inSidePass || Boolean(roadNear),
    mainDistance,
    sideDistance: Math.min(...sideDistances),
  };
}

function highlandStyle(x, y, roadNear) {
  if (!isHighlandFootprint(x, y)) return null;
  const pass = highlandPassInfo(x, y, roadNear);
  const rock = patchValue(x, y, 501);
  if (pass.clearing) return { kind: pass.clearing.kind, blocked: false };
  if (pass.inPass) return { kind: pass.mainDistance < 58 ? 'main_pass' : 'side_pass', blocked: false };
  if (!isInHighland(x, y)) return null;
  if (highlandOuterEdge(x, y) && rock > 0.02) return { kind: 'outer_cliff', blocked: true };
  if (rock > 0.34 || ellipseValue(x, y, 1170, 2975, 330, 235) < 0.54 || ellipseValue(x, y, 1760, 2860, 350, 260) < 0.48) {
    return { kind: 'rock_mass', blocked: true };
  }
  if (rock > -0.06) return { kind: 'scree', blocked: false };
  return { kind: 'highland_floor', blocked: false };
}

function marshDistrictValue(x, y) {
  return Math.min(
    ellipseValue(x, y, 3260, 3400, 830, 700),
    ellipseValue(x, y, 3520, 3650, 700, 570),
  );
}

function marshWaterClass(x, y, previousClass) {
  const district = marshDistrictValue(x, y);
  if (district > 1.22 || x > 3930 || y > 3970) return previousClass;
  const wave = lowWave(x, y, 61, 91) * 0.16 + lowWave(x, y, 143, 97) * 0.18 + patchValue(x, y, 733) * 0.12;
  let lakeClass = 0;
  for (const lake of marshLakes) {
    const warpedX = x + lowWave(y, x, 47, lake.cx) * 34 + lowWave(x, y, 113, lake.cy) * 18;
    const warpedY = y + lowWave(x, y, 53, lake.cy) * 26 + lowWave(y, x, 127, lake.cx) * 16;
    const value = ellipseValue(warpedX, warpedY, lake.cx, lake.cy, lake.rx, lake.ry);
    if (value < 1 + wave) lakeClass = lake.type;
    else if (value < 1.32 + wave && lakeClass === 0) lakeClass = 3;
  }
  const channelDistance = Math.sqrt(Math.min(
    routeDistanceSquared(x, y, [[2920, 3000], [3110, 3210], [3340, 3425], [3560, 3650], [3830, 3850]]),
    routeDistanceSquared(x, y, [[3240, 3250], [3060, 3520], [2975, 3800], [2925, 3990]]),
  ));
  if (channelDistance < 9 + lowWave(x, y, 43, 33) * 2) return 3;
  if (lakeClass) return lakeClass;
  if (previousClass && district < 1.05) return 0;
  return previousClass;
}

function flowGidForTile(x, y) {
  const segment = nearestRiverSegment(x, y);
  let dx = segment?.dx ?? 1;
  let dy = segment?.dy ?? 0;
  if (Math.abs(dx) > Math.abs(dy) * 1.35) return WATER_FX_FIRST_GID;
  if (Math.abs(dy) > Math.abs(dx) * 1.35) return WATER_FX_FIRST_GID + 2;
  return dx * dy >= 0 ? WATER_FX_FIRST_GID + 4 : WATER_FX_FIRST_GID + 6;
}

function terrainForHighland(style, x, y) {
  const roll = hash2(Math.floor(x / 19), Math.floor(y / 19), 611);
  if (!style) return null;
  if (style.kind === 'main_pass') return gid('cloudspine', roll > 0.72 ? LOCAL.dirt : LOCAL.light);
  if (style.kind === 'side_pass') return gid('cloudspine', roll > 0.68 ? LOCAL.cliffDirt : LOCAL.light);
  if (style.kind === 'mine') return gid('ironcrag', roll > 0.7 ? LOCAL.mossStone : LOCAL.stone);
  if (style.kind === 'cave') return gid('ironcrag', roll > 0.62 ? LOCAL.scree : LOCAL.stone);
  if (style.kind === 'ruin') return gid('oldEmpire', roll > 0.55 ? LOCAL.ruinFloor : LOCAL.stone);
  if (style.kind === 'outer_cliff') {
    if (roll > 0.93) return gid('ironcrag', LOCAL.cliff);
    return gid('ironcrag', roll > 0.62 ? LOCAL.stone : LOCAL.scree);
  }
  if (style.kind === 'rock_mass') {
    if (roll > 0.9) return gid('ironcrag', LOCAL.rock);
    return gid('ironcrag', roll > 0.46 ? LOCAL.stone : LOCAL.scree);
  }
  if (style.kind === 'scree') return gid('cloudspine', roll > 0.68 ? LOCAL.stone : LOCAL.alt);
  return gid('cloudspine', roll > 0.72 ? LOCAL.light : roll > 0.28 ? LOCAL.alt : LOCAL.base);
}

function terrainForHighlandFoothill(x, y, roadNear) {
  if (!isHighlandFootprint(x, y) || isInHighland(x, y)) return null;
  const roll = hash2(Math.floor(x / 23), Math.floor(y / 23), 733);
  const nearPass = Math.sqrt(routeDistanceSquared(x, y, mainPass)) < 150
    || sidePasses.some((pass) => Math.sqrt(routeDistanceSquared(x, y, pass)) < 92);
  if (roadNear || nearPass) return gid('cloudspine', roll > 0.78 ? LOCAL.cliffDirt : LOCAL.light);
  if (y > 3300 || x < 720) return gid('sunhill', roll > 0.84 ? LOCAL.alt : LOCAL.base);
  return gid('cloudspine', roll > 0.74 ? LOCAL.alt : LOCAL.base);
}

function terrainForRetiredHighland(x, y, roadNear, nearWater) {
  const roll = hash2(Math.floor(x / 31), Math.floor(y / 31), 839);
  const value = highlandValue(x, y);
  const nearPass = Math.sqrt(routeDistanceSquared(x, y, mainPass)) < 190
    || sidePasses.some((pass) => Math.sqrt(routeDistanceSquared(x, y, pass)) < 120);
  if (nearWater) return gid('silver', roll > 0.82 ? LOCAL.bank : LOCAL.light);
  if (roadNear || nearPass) return gid('sunhill', roll > 0.78 ? LOCAL.dirt : LOCAL.light);
  if (value < 1.24) return gid('sunhill', roll > 0.7 ? LOCAL.alt : LOCAL.base);
  if (y > 3360 || x < 620) return gid('amber', roll > 0.82 ? LOCAL.alt : LOCAL.base);
  return gid('emerald', roll > 0.84 ? LOCAL.light : LOCAL.base);
}

function nearestRouteDistance(x, y, routes) {
  return Math.sqrt(Math.min(...routes.map((route) => routeDistanceSquared(x, y, route))));
}

function terrainForSimplifiedTransitionZone(x, y, roadNear, nearWater) {
  const roll = hash2(x, y, 947);
  const rough = valueNoise(x, y, 115, 101) * 0.52
    + valueNoise(x + 71, y - 37, 185, 103) * 0.32
    + valueNoise(x - 23, y + 61, 72, 107) * 0.16;
  const dryScore = valueNoise(x + 140, y - 90, 145, 109) * 0.56
    + clamp((520 - x) / 620, 0, 1) * 0.2
    + clamp((y - 3480) / 520, 0, 1) * 0.18
    + clamp((2730 - y) / 620, 0, 1) * 0.08;
  const greenScore = valueNoise(x - 80, y + 120, 155, 113) * 0.58
    + clamp((x - 1770) / 820, 0, 1) * 0.2
    + clamp((2860 - y) / 560, 0, 1) * 0.12;
  const futureContentDistance = nearestRouteDistance(x, y, [
    [[990, 3025], [1115, 3060]],
    [[1340, 3085], [1495, 3130]],
    [[1640, 2785], [1775, 2820]],
  ]);
  const eastLowlandBlend = x > 1840 + smoothField(0, y, 79) * 120
    && y > 2860 + smoothField(x, 0, 83) * 70;

  if (nearWater) return gid('silver', roll > 0.94 ? LOCAL.bank : LOCAL.light);
  if (roadNear) return gid('sunhill', roll > 0.95 ? LOCAL.dirt : LOCAL.light);
  if (futureContentDistance < 36) return gid('oldEmpire', roll > 0.7 ? LOCAL.stone : LOCAL.ruinFloor);
  if (eastLowlandBlend) return gid('emerald', roll > 0.985 ? LOCAL.light : LOCAL.base);
  if (dryScore > 0.72 && greenScore < 0.58) return gid('amber', roll > 0.98 ? LOCAL.alt : LOCAL.base);
  if (greenScore > 0.6 && dryScore < 0.72) return gid('emerald', roll > 0.98 ? LOCAL.light : LOCAL.base);
  if (rough > 0.62 || dryScore > 0.54) return gid('golden', roll > 0.98 ? LOCAL.light : LOCAL.base);
  return gid('emerald', roll > 0.985 ? LOCAL.light : LOCAL.base);
}

function terrainForMarsh(x, y, waterClassValue, nearRoad) {
  const roll = hash2(Math.floor(x / 17), Math.floor(y / 17), 707);
  if (waterClassValue) return gid('murkfen', roll > 0.74 ? LOCAL.mud : LOCAL.base);
  if (nearRoad) return gid('murkfen', roll > 0.82 ? LOCAL.dirt : LOCAL.base);
  if (marshDistrictValue(x, y) < 1.2) {
    if (patchValue(x, y, 711) > 0.28) return gid('shadowfen', roll > 0.54 ? LOCAL.forestFloor : LOCAL.dark);
    if (roll > 0.82) return gid('murkfen', LOCAL.mud);
    return gid('murkfen', LOCAL.base);
  }
  return null;
}

function terrainForRoadPurpose(x, y, nearRoad, nearWater, oldGround) {
  if (!nearRoad) return oldGround;
  const roll = hash2(Math.floor(x / 21), Math.floor(y / 21), 801);
  if (isMountainAdjustmentArea(x, y) && (isLegacyHighlandFootprint(x, y) || highlandValue(x, y) < 1.08)) {
    return gid('sunhill', roll > 0.78 ? LOCAL.dirt : LOCAL.light);
  }
  if (isInHighland(x, y)) return gid('cloudspine', roll > 0.76 ? LOCAL.roadEdge : LOCAL.light);
  if (nearWater) return gid('silver', roll > 0.76 ? LOCAL.bank : LOCAL.light);
  if (y > 3180) return gid('amber', roll > 0.82 ? LOCAL.dirt : LOCAL.light);
  if (x > 2850 && y > 2600) return gid('murkfen', roll > 0.84 ? LOCAL.mud : LOCAL.base);
  if (x > 2700 && y < 1250) return gid('golden', roll > 0.8 ? LOCAL.alt : LOCAL.light);
  return oldGround;
}

async function main() {
  const regionEntries = [];
  const waterClass = new Uint8Array(WORLD_TILE_COUNT);
  const roadMask = new Uint8Array(WORLD_TILE_COUNT);
  const protectedCityRects = [];

  for (let regionY = 0; regionY < REGION_GRID; regionY += 1) {
    for (let regionX = 0; regionX < REGION_GRID; regionX += 1) {
      const file = path.join(regionsDir, `continent_01_region_${regionX}_${regionY}.tmj`);
      const map = JSON.parse(await fs.readFile(file, 'utf8'));
      const water = decodeLayer(getLayer(map, 'Water'));
      const roads = decodeLayer(getLayer(map, 'Roads'));
      const offsetX = regionX * REGION_TILES;
      const offsetY = regionY * REGION_TILES;

      if (regionX === 0 && regionY === 0) {
        const cityObjects = map.layers.find((layer) => layer.name === 'CityArea')?.objects ?? [];
        cityObjects.forEach((object) => {
          protectedCityRects.push({
            x: Math.max(0, Math.floor(Number(object.x ?? 0) / TILE_SIZE) - 8),
            y: Math.max(0, Math.floor(Number(object.y ?? 0) / TILE_SIZE) - 8),
            width: Math.ceil(Number(object.width ?? 0) / TILE_SIZE) + 16,
            height: Math.ceil(Number(object.height ?? 0) / TILE_SIZE) + 16,
          });
        });
      }

      for (let localY = 0; localY < REGION_TILES; localY += 1) {
        for (let localX = 0; localX < REGION_TILES; localX += 1) {
          const localIndex = localY * REGION_TILES + localX;
          const index = globalIndex(offsetX + localX, offsetY + localY);
          waterClass[index] = waterClassForGid(water[localIndex]);
          if (roads[localIndex]) roadMask[index] = 1;
        }
      }

      regionEntries.push({ file, map, regionX, regionY });
    }
  }

  const originalWaterClass = new Uint8Array(waterClass);
  const roadInfluence = buildInfluence(roadMask, 7, 54);

  for (let y = 0; y < WORLD_TILES; y += 1) {
    for (let x = 0; x < WORLD_TILES; x += 1) {
      const index = globalIndex(x, y);
      let classId = waterClass[index];

      if (classId === 2 && nearestRiverDistanceSquared(x, y) > 26 ** 2 && marshDistrictValue(x, y) > 1.25) {
        classId = 0;
      }

      for (const route of riverRoutes) {
        const distance = Math.sqrt(routeDistanceSquared(x, y, route.points));
        const width = route.width + lowWave(x, y, 83, route.width) * 1.7;
        if (distance <= width) classId = 2;
        else if (distance <= width + 4 && classId === 0 && hash2(x, y, route.width + 31) > 0.68) classId = 3;
      }

      classId = marshWaterClass(x, y, classId);
      if (roadMask[index] && classId) classId = 0;
      waterClass[index] = classId;
    }
  }

  const stats = {
    highlandBlockedTiles: 0,
    highlandPassTiles: 0,
    highlandClearings: 0,
    riverTilesAdded: 0,
    oldRiverTilesCleared: 0,
    bridgeRoadTiles: 0,
    marshWaterTilesCleared: 0,
    marshShallowTiles: 0,
    roadPurposeTiles: 0,
    retiredMountainTiles: 0,
    retiredMountainCollisionCleared: 0,
    simplifiedTransitionTiles: 0,
    simplifiedMountainTilesReplaced: 0,
    simplifiedCollisionCleared: 0,
  };

  const changedFiles = [];
  for (const entry of regionEntries) {
    const { file, map, regionX, regionY } = entry;
    const groundLayer = getLayer(map, 'Ground');
    const waterLayer = getLayer(map, 'Water');
    const riverFlowLayer = getLayer(map, 'RiverFlow');
    const waterEdgesLayer = getLayer(map, 'WaterEdges');
    const waterFxLayer = getLayer(map, 'WaterFX');
    const terrainLayer = getLayer(map, 'TerrainDetails');
    const roadsLayer = getLayer(map, 'Roads');
    const collisionLayer = getLayer(map, 'Collision');
    const oldGround = decodeLayer(groundLayer);
    const oldWater = decodeLayer(waterLayer);
    const oldTerrain = decodeLayer(terrainLayer);
    const roads = decodeLayer(roadsLayer);
    const oldCollision = decodeLayer(collisionLayer);
    const nextGround = new Uint32Array(oldGround);
    const nextWater = new Uint32Array(oldWater.length);
    const nextRiverFlow = new Uint32Array(oldWater.length);
    const nextWaterEdges = new Uint32Array(oldWater.length);
    const nextWaterFx = new Uint32Array(oldWater.length);
    const nextTerrain = new Uint32Array(oldTerrain);
    const nextCollision = new Uint32Array(oldCollision);
    const collisionGid = Number((map.tilesets ?? []).find((tileset) => /collision_debug/i.test(tileset.source ?? ''))?.firstgid ?? 0);
    const offsetX = regionX * REGION_TILES;
    const offsetY = regionY * REGION_TILES;

    for (let localY = 0; localY < REGION_TILES; localY += 1) {
      for (let localX = 0; localX < REGION_TILES; localX += 1) {
        const localIndex = localY * REGION_TILES + localX;
        const x = offsetX + localX;
        const y = offsetY + localY;
        const index = globalIndex(x, y);
        const classId = waterClass[index];

        if (isInsideProtectedCity(x, y, protectedCityRects)) {
          nextGround[localIndex] = oldGround[localIndex];
          nextWater[localIndex] = oldWater[localIndex];
          nextTerrain[localIndex] = oldTerrain[localIndex];
          nextCollision[localIndex] = oldCollision[localIndex];
          continue;
        }

        const roadHere = Boolean(roads[localIndex]);
        const roadNear = Boolean(roadInfluence[index]);
        const originalClass = originalWaterClass[index];
        const nearWater = Boolean(classId) || waterNeighborCount(waterClass, x, y, 2) > 0;
        const simplifiedTransition = !classId
          && isSimplifiedTransitionFootprint(x, y, oldGround[localIndex]);

        if (classId) {
          nextWater[localIndex] = waterGidForClass(classId);
          if (isMountainAdjustmentArea(x, y) && isMountainGround(oldGround[localIndex])) {
            nextGround[localIndex] = terrainForSimplifiedTransitionZone(x, y, roadNear, true);
            stats.simplifiedMountainTilesReplaced += 1;
          }
          nextTerrain[localIndex] = 0;
          if (classId === 2) {
            nextRiverFlow[localIndex] = flowGidForTile(x, y);
            if (!originalClass) stats.riverTilesAdded += 1;
          } else if (classId === 3) {
            stats.marshShallowTiles += marshDistrictValue(x, y) < 1.22 ? 1 : 0;
            if (hash2(x, y, 901) > 0.985) nextWaterFx[localIndex] = WATER_FX_FIRST_GID + 12;
          } else if (waterNeighborCount(waterClass, x, y, 1) < 8 && hash2(x, y, 902) > 0.988) {
            nextWaterFx[localIndex] = WATER_FX_FIRST_GID + 8;
          }
          if (collisionGid && !roadHere) nextCollision[localIndex] = collisionGid;
          if (roadHere) nextCollision[localIndex] = 0;
        } else {
          if (originalClass === 2) stats.oldRiverTilesCleared += 1;
          if (originalClass && marshDistrictValue(x, y) < 1.22) stats.marshWaterTilesCleared += 1;
          if (originalClass && roadHere) stats.bridgeRoadTiles += 1;
          if (originalClass && oldCollision[localIndex] === collisionGid) nextCollision[localIndex] = 0;
        }

        const north = y > 0 && waterClass[globalIndex(x, y - 1)];
        const south = y < WORLD_TILES - 1 && waterClass[globalIndex(x, y + 1)];
        const west = x > 0 && waterClass[globalIndex(x - 1, y)];
        const east = x < WORLD_TILES - 1 && waterClass[globalIndex(x + 1, y)];
        if (!classId) {
          if (north && west) nextWaterEdges[localIndex] = SHORE_NW_GID;
          else if (north && east) nextWaterEdges[localIndex] = SHORE_NE_GID;
          else if (south && west) nextWaterEdges[localIndex] = SHORE_SW_GID;
          else if (south && east) nextWaterEdges[localIndex] = SHORE_SE_GID;
          else if (north) nextWaterEdges[localIndex] = SHORE_NORTH_GID;
          else if (south) nextWaterEdges[localIndex] = SHORE_SOUTH_GID;
          else if (west) nextWaterEdges[localIndex] = SHORE_WEST_GID;
          else if (east) nextWaterEdges[localIndex] = SHORE_EAST_GID;
        }

        const marshTerrain = terrainForMarsh(x, y, classId, roadNear);
        if (simplifiedTransition) {
          if (isMountainGround(oldGround[localIndex])) stats.simplifiedMountainTilesReplaced += 1;
          nextGround[localIndex] = terrainForSimplifiedTransitionZone(x, y, roadNear, nearWater);
          nextTerrain[localIndex] = 0;
          stats.simplifiedTransitionTiles += 1;
          if (collisionGid && nextCollision[localIndex] === collisionGid) {
            nextCollision[localIndex] = 0;
            stats.simplifiedCollisionCleared += 1;
          }
        } else if (!classId && marshTerrain) {
          nextGround[localIndex] = marshTerrain;
          if (hash2(x, y, 903) > 0.992) nextTerrain[localIndex] = gid('murkfen', LOCAL.reeds);
        }

        const roadTerrain = terrainForRoadPurpose(x, y, roadNear, nearWater, nextGround[localIndex]);
        if (!classId && roadTerrain !== nextGround[localIndex]) {
          nextGround[localIndex] = roadTerrain;
          if (hash2(x, y, 904) > 0.985) nextTerrain[localIndex] = 0;
          stats.roadPurposeTiles += 1;
        }

        if (roadHere) nextCollision[localIndex] = 0;
      }
    }

    encodeLayer(groundLayer, nextGround);
    encodeLayer(waterLayer, nextWater);
    encodeLayer(riverFlowLayer, nextRiverFlow);
    encodeLayer(waterEdgesLayer, nextWaterEdges);
    encodeLayer(waterFxLayer, nextWaterFx);
    encodeLayer(terrainLayer, nextTerrain);
    encodeLayer(collisionLayer, nextCollision);
    collisionLayer.visible = false;
    await fs.writeFile(file, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
    changedFiles.push(path.relative(rootDir, file).replaceAll(path.sep, '/'));
  }

  console.log(JSON.stringify({ changedFiles, stats }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
