import fs from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const continentRoot = path.join(rootDir, 'public', 'maps', 'world_map', 'continents', 'continent_01');
const regionsDir = path.join(continentRoot, 'regions');
const tilesetsDir = path.join(continentRoot, 'tilesets');

const TILE_SIZE = 32;
const REGION_GRID = 5;
const REGION_TILES = 800;
const WORLD_TILES = REGION_GRID * REGION_TILES;
const WORLD_TILE_COUNT = WORLD_TILES * WORLD_TILES;
const WATER_FIRST_GID = 3073;
const STILL_WATER_GID = WATER_FIRST_GID;
const RIVER_WATER_GID = WATER_FIRST_GID + 2;
const SHALLOW_WATER_GID = WATER_FIRST_GID + 4;
const WATER_FX_GID = WATER_FIRST_GID + 6;
const SHORE_NORTH_GID = WATER_FIRST_GID + 8;
const SHORE_SOUTH_GID = WATER_FIRST_GID + 9;
const SHORE_WEST_GID = WATER_FIRST_GID + 10;
const SHORE_EAST_GID = WATER_FIRST_GID + 11;
const SHORE_NW_GID = WATER_FIRST_GID + 12;
const SHORE_NE_GID = WATER_FIRST_GID + 13;
const SHORE_SW_GID = WATER_FIRST_GID + 14;
const SHORE_SE_GID = WATER_FIRST_GID + 15;

const TILESETS = {
  emerald: 1,
  golden: 257,
  elderwood: 513,
  silver: 769,
  sunhill: 1025,
  cloudspine: 1281,
  ironcrag: 1537,
  murkfen: 1793,
  oldEmpire: 2049,
  saltwind: 2305,
  amber: 2561,
  shadowfen: 2817,
};

const BIOME_TILES = {
  emerald: [1, 3, 5, 13],
  golden: [257, 258, 260, 269],
  elderwood: [513, 514, 515, 516],
  silver: [769, 770, 771, 772],
  sunhill: [1025, 1026, 1028, 1037],
  cloudspine: [1281, 1282, 1283, 1289],
  ironcrag: [1537, 1538, 1540, 1554],
  murkfen: [1793, 1795, 1800, 1804],
  oldEmpire: [2049, 2052, 2067, 2072],
  saltwind: [2305, 2306, 2307, 2324],
  amber: [2561, 2564, 2579, 2580],
  shadowfen: [2817, 2824, 2825, 2826],
};

const DETAIL_TILES = {
  emerald: [17, 525, 529, 535],
  golden: [270, 277, 278, 279],
  elderwood: [529, 531, 535],
  silver: [776, 787, 791],
  sunhill: [1038, 1045, 1047],
  cloudspine: [1301, 1303],
  ironcrag: [1557, 1559, 1573, 1588],
  murkfen: [1807, 1811, 1815],
  oldEmpire: [2056, 2067, 2071, 2072],
  saltwind: [2317, 2323, 2325, 2327],
  amber: [2568, 2574, 2581, 2583],
  shadowfen: [2824, 2825],
};

const riverRoutes = [
  {
    name: 'north_silver_run',
    width: 7,
    points: [
      [820, 620],
      [1080, 720],
      [1380, 840],
      [1720, 1040],
      [2130, 1260],
      [2550, 1390],
      [3090, 1360],
      [3590, 1280],
      [3990, 1260],
    ],
  },
  {
    name: 'old_vale_outflow',
    width: 8,
    points: [
      [1160, 2520],
      [1380, 2300],
      [1640, 2080],
      [1980, 1910],
      [2320, 1810],
      [2660, 1900],
      [2980, 2150],
      [3330, 2480],
      [3720, 2780],
      [3995, 2920],
    ],
  },
  {
    name: 'south_marsh_drain',
    width: 6,
    points: [
      [2240, 2860],
      [2500, 3050],
      [2860, 3230],
      [3210, 3380],
      [3540, 3580],
      [3870, 3830],
    ],
  },
];

const lakeShapes = [
  { cx: 2380, cy: 1640, rx: 150, ry: 88, classId: 1 },
  { cx: 3140, cy: 3180, rx: 210, ry: 124, classId: 3 },
  { cx: 1190, cy: 2260, rx: 94, ry: 62, classId: 1 },
  { cx: 3420, cy: 3460, rx: 132, ry: 72, classId: 3 },
];

function globalIndex(x, y) {
  return y * WORLD_TILES + x;
}

function hash2(x, y, seed = 0) {
  let value = ((x + seed * 101) * 374761393 + (y - seed * 37) * 668265263) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function lowWave(x, y, scale, seed = 0) {
  return Math.sin((x + seed * 43) / scale) * 0.5 + Math.cos((y - seed * 29) / (scale * 1.31)) * 0.5;
}

function ellipseValue(x, y, cx, cy, rx, ry) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
}

function distanceToSegmentSquared(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return (px - ax) ** 2 + (py - ay) ** 2;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const sx = ax + t * dx;
  const sy = ay + t * dy;
  return (px - sx) ** 2 + (py - sy) ** 2;
}

function distanceToRouteSquared(x, y, route) {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.points.length; index += 1) {
    const [ax, ay] = route.points[index - 1];
    const [bx, by] = route.points[index];
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

function getLayer(map, name) {
  const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
  if (!layer) throw new Error(`Missing tile layer ${name}`);
  return layer;
}

function ensureLayerAfter(map, name, afterName, opacity = 1) {
  let layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
  if (!layer) {
    const maxId = Math.max(0, ...(map.layers ?? []).map((candidate) => Number(candidate.id ?? 0)));
    layer = {
      id: maxId + 1,
      name,
      type: 'tilelayer',
      visible: true,
      opacity,
      x: 0,
      y: 0,
      width: REGION_TILES,
      height: REGION_TILES,
      encoding: 'base64',
      compression: 'zlib',
      data: '',
    };
    const afterIndex = map.layers.findIndex((candidate) => candidate.name === afterName);
    map.layers.splice(afterIndex >= 0 ? afterIndex + 1 : map.layers.length, 0, layer);
  }
  layer.visible = true;
  layer.opacity = opacity;
  layer.width = REGION_TILES;
  layer.height = REGION_TILES;
  map.nextlayerid = Math.max(Number(map.nextlayerid ?? 1), Number(layer.id ?? 0) + 1);
  return layer;
}

function tileFrom(biome, x, y, seed = 0) {
  const variants = BIOME_TILES[biome] ?? BIOME_TILES.emerald;
  const roll = hash2(Math.floor(x / 3), Math.floor(y / 3), seed);
  const index = roll < 0.7 ? 0 : roll < 0.86 ? 1 : roll < 0.96 ? 2 : variants.length - 1;
  return variants[Math.min(index, variants.length - 1)];
}

function detailFrom(biome, x, y) {
  const variants = DETAIL_TILES[biome] ?? DETAIL_TILES.emerald;
  return variants[Math.floor(hash2(x, y, 88) * variants.length) % variants.length];
}

function getCollisionGid(map) {
  return Number((map.tilesets ?? []).find((tileset) => /collision_debug/i.test(tileset.source ?? ''))?.firstgid ?? 0);
}

function getWaterGid(classId) {
  if (classId === 2) return RIVER_WATER_GID;
  if (classId === 3) return SHALLOW_WATER_GID;
  return STILL_WATER_GID;
}

function isInsideProtectedCity(globalTileX, globalTileY, protectedCityRects) {
  return protectedCityRects.some((rect) => (
    globalTileX >= rect.x
    && globalTileX <= rect.x + rect.width
    && globalTileY >= rect.y
    && globalTileY <= rect.y + rect.height
  ));
}

function drawTile(png, tileId, drawer) {
  const startX = tileId * TILE_SIZE;
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const [red, green, blue, alpha] = drawer(x, y);
      const offset = ((y * png.width) + startX + x) * 4;
      png.data[offset] = red;
      png.data[offset + 1] = green;
      png.data[offset + 2] = blue;
      png.data[offset + 3] = alpha;
    }
  }
}

function makeWaterTileset() {
  const png = new PNG({ width: 512, height: 32, colorType: 6 });
  png.data.fill(0);

  const waterColor = (base, x, y, seed = 0) => {
    const ripple = Math.sin((x * 0.62 + y * 0.17 + seed) * Math.PI) * 8
      + Math.cos((x * 0.19 - y * 0.31 + seed) * Math.PI) * 5;
    return [
      Math.max(0, Math.min(255, base[0] + ripple)),
      Math.max(0, Math.min(255, base[1] + ripple)),
      Math.max(0, Math.min(255, base[2] + ripple)),
      255,
    ];
  };

  drawTile(png, 0, (x, y) => {
    const line = (y === 10 && x % 9 < 5) || (y === 22 && (x + 4) % 13 < 6);
    const base = waterColor([48, 126, 147], x, y, 0.1);
    if (line) return [103, 174, 188, 180];
    return base;
  });
  drawTile(png, 1, (x, y) => {
    const line = (y === 8 && (x + 5) % 10 < 5) || (y === 24 && x % 12 < 5);
    const base = waterColor([45, 119, 141], x, y, 0.55);
    if (line) return [97, 165, 181, 160];
    return base;
  });
  drawTile(png, 2, (x, y) => {
    const streak = ((x * 2 + y + 2) % 13) < 4;
    const base = waterColor([36, 116, 151], x + y, y, 0.2);
    if (streak && y % 3 !== 0) return [128, 196, 211, 205];
    return base;
  });
  drawTile(png, 3, (x, y) => {
    const streak = ((x * 2 + y + 8) % 13) < 4;
    const base = waterColor([34, 111, 146], x + y, y, 0.75);
    if (streak && y % 3 !== 1) return [119, 187, 205, 198];
    return base;
  });
  drawTile(png, 4, (x, y) => {
    const reed = ((x + y * 3) % 23) === 0 || ((x * 7 + y) % 41) === 0;
    const base = waterColor([70, 131, 117], x, y, 0.35);
    if (reed) return [75, 116, 76, 210];
    return base;
  });
  drawTile(png, 5, (x, y) => {
    const reed = ((x + 5 + y * 3) % 23) === 0 || ((x * 7 + y + 9) % 41) === 0;
    const base = waterColor([65, 124, 112], x, y, 0.9);
    if (reed) return [86, 126, 78, 210];
    return base;
  });
  drawTile(png, 6, (x, y) => {
    const band = Math.abs(y - (10 + Math.sin((x + 3) / 5) * 3)) < 1.4 || Math.abs(y - (23 + Math.cos(x / 4) * 2)) < 1.2;
    if (!band) return [0, 0, 0, 0];
    return [196, 231, 235, 150];
  });
  drawTile(png, 7, (x, y) => {
    const band = Math.abs(y - (8 + Math.sin((x + 10) / 5) * 3)) < 1.4 || Math.abs(y - (21 + Math.cos((x + 5) / 4) * 2)) < 1.2;
    if (!band) return [0, 0, 0, 0];
    return [202, 237, 241, 150];
  });

  const edge = (x, y, side) => {
    const sand = [160, 151, 98, 180];
    const foam = [205, 228, 215, 150];
    if (side === 'north' && y < 7) return y < 3 ? foam : sand;
    if (side === 'south' && y >= 25) return y > 28 ? foam : sand;
    if (side === 'west' && x < 7) return x < 3 ? foam : sand;
    if (side === 'east' && x >= 25) return x > 28 ? foam : sand;
    return [0, 0, 0, 0];
  };
  drawTile(png, 8, (x, y) => edge(x, y, 'north'));
  drawTile(png, 9, (x, y) => edge(x, y, 'south'));
  drawTile(png, 10, (x, y) => edge(x, y, 'west'));
  drawTile(png, 11, (x, y) => edge(x, y, 'east'));
  drawTile(png, 12, (x, y) => {
    const n = edge(x, y, 'north');
    const w = edge(x, y, 'west');
    return n[3] || w[3] ? (n[3] > w[3] ? n : w) : [0, 0, 0, 0];
  });
  drawTile(png, 13, (x, y) => {
    const n = edge(x, y, 'north');
    const e = edge(x, y, 'east');
    return n[3] || e[3] ? (n[3] > e[3] ? n : e) : [0, 0, 0, 0];
  });
  drawTile(png, 14, (x, y) => {
    const s = edge(x, y, 'south');
    const w = edge(x, y, 'west');
    return s[3] || w[3] ? (s[3] > w[3] ? s : w) : [0, 0, 0, 0];
  });
  drawTile(png, 15, (x, y) => {
    const s = edge(x, y, 'south');
    const e = edge(x, y, 'east');
    return s[3] || e[3] ? (s[3] > e[3] ? s : e) : [0, 0, 0, 0];
  });

  writeFileSync(path.join(tilesetsDir, 'world_v3_water.png'), PNG.sync.write(png, { colorType: 6, inputColorType: 6, deflateLevel: 9 }));
  writeFileSync(path.join(tilesetsDir, 'world_v3_water.tsx'), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="world_v3_water" tilewidth="32" tileheight="32" tilecount="16" columns="16">
 <image source="world_v3_water.png" width="512" height="32"/>
 <tile id="0">
  <animation>
   <frame tileid="0" duration="460"/>
   <frame tileid="1" duration="460"/>
  </animation>
 </tile>
 <tile id="2">
  <animation>
   <frame tileid="2" duration="130"/>
   <frame tileid="3" duration="130"/>
  </animation>
 </tile>
 <tile id="4">
  <animation>
   <frame tileid="4" duration="520"/>
   <frame tileid="5" duration="520"/>
  </animation>
 </tile>
 <tile id="6">
  <animation>
   <frame tileid="6" duration="180"/>
   <frame tileid="7" duration="180"/>
  </animation>
 </tile>
</tileset>
`, 'utf8');
}

function classifyBiome(x, y, roadInfluence, nearWater, waterClass) {
  if (waterClass) return 'saltwind';
  const wave = lowWave(x, y, 310, 4);
  const coastal = x < 90 || y < 90 || x > WORLD_TILES - 90 || y > WORLD_TILES - 90;
  if (coastal && nearWater) return 'saltwind';
  if (nearWater && y > 2250 && x > 2250) return hash2(x, y, 9) < 0.55 ? 'murkfen' : 'shadowfen';
  if (nearWater) return y > 2750 ? 'silver' : 'silver';

  const oldVale = Math.min(
    ellipseValue(x, y, 1120, 2540, 760, 620),
    ellipseValue(x, y, 1600, 2380, 560, 500),
  );
  if (oldVale < 0.74 + wave * 0.08) return hash2(x, y, 2) < 0.58 ? 'ironcrag' : 'cloudspine';
  if (oldVale < 1.06 + wave * 0.08) return 'cloudspine';

  const eastWilds = ellipseValue(x, y, 3190, 1660, 720, 950);
  if (eastWilds < 0.92 + wave * 0.09) return hash2(x, y, 3) < 0.7 ? 'elderwood' : 'murkfen';

  const southeastMarsh = ellipseValue(x, y, 3150, 3050, 760, 690);
  if (southeastMarsh < 0.96 + wave * 0.08) return hash2(x, y, 5) < 0.68 ? 'murkfen' : 'shadowfen';

  const corruptedEast = ellipseValue(x, y, 3180, 2630, 700, 840);
  if (corruptedEast < 0.92 + wave * 0.05) return hash2(x, y, 12) < 0.58 ? 'oldEmpire' : 'murkfen';

  const northwestForest = ellipseValue(x, y, 560, 930, 760, 770);
  if (northwestForest < 0.95 + wave * 0.1) return hash2(x, y, 7) < 0.7 ? 'elderwood' : 'emerald';

  const southernDry = y > 3060 + wave * 95 || ellipseValue(x, y, 1900, 3460, 1020, 490) < 1.0;
  if (southernDry) return hash2(x, y, 8) < 0.64 ? 'amber' : 'golden';

  if (roadInfluence) {
    if (y > 2780) return 'golden';
    if (x > 2100 && y > 1500) return 'sunhill';
    return hash2(x, y, 11) < 0.78 ? 'emerald' : 'golden';
  }

  if (y < 820 && x > 2400) return hash2(x, y, 13) < 0.54 ? 'golden' : 'saltwind';
  if (x < 1050 && y < 1850) return hash2(x, y, 14) < 0.6 ? 'emerald' : 'elderwood';
  if (x > 2750 && y > 3300) return hash2(x, y, 15) < 0.55 ? 'oldEmpire' : 'saltwind';
  return hash2(x, y, 16) < 0.64 ? 'emerald' : 'sunhill';
}

function buildRoadInfluence(roadMask) {
  const influence = new Uint8Array(WORLD_TILE_COUNT);
  for (let y = 0; y < WORLD_TILES; y += 1) {
    for (let x = 0; x < WORLD_TILES; x += 1) {
      const index = globalIndex(x, y);
      if (!roadMask[index]) continue;
      for (let dy = -8; dy <= 8; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= WORLD_TILES) continue;
        for (let dx = -8; dx <= 8; dx += 1) {
          if (dx * dx + dy * dy > 72) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= WORLD_TILES) continue;
          influence[globalIndex(xx, yy)] = 1;
        }
      }
    }
  }
  return influence;
}

function waterNeighborCount(mask, x, y, radius = 1) {
  let count = 0;
  for (let yy = Math.max(0, y - radius); yy <= Math.min(WORLD_TILES - 1, y + radius); yy += 1) {
    for (let xx = Math.max(0, x - radius); xx <= Math.min(WORLD_TILES - 1, x + radius); xx += 1) {
      if (xx === x && yy === y) continue;
      if (mask[globalIndex(xx, yy)]) count += 1;
    }
  }
  return count;
}

async function main() {
  makeWaterTileset();

  const regionEntries = [];
  const oldWater = new Uint8Array(WORLD_TILE_COUNT);
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
          if (water[localIndex]) oldWater[index] = 1;
          if (roads[localIndex]) roadMask[index] = 1;
        }
      }

      regionEntries.push({ file, map, regionX, regionY });
    }
  }

  const roadInfluence = buildRoadInfluence(roadMask);
  const waterClass = new Uint8Array(WORLD_TILE_COUNT);

  for (let y = 0; y < WORLD_TILES; y += 1) {
    for (let x = 0; x < WORLD_TILES; x += 1) {
      const index = globalIndex(x, y);
      const neighbors = waterNeighborCount(oldWater, x, y, 1);
      if (oldWater[index]) {
        waterClass[index] = neighbors <= 1 && x > 0 && y > 0 && x < WORLD_TILES - 1 && y < WORLD_TILES - 1 ? 0 : 1;
      } else if (neighbors >= 7) {
        waterClass[index] = 1;
      }
    }
  }

  for (let y = 0; y < WORLD_TILES; y += 1) {
    for (let x = 0; x < WORLD_TILES; x += 1) {
      let classId = waterClass[globalIndex(x, y)];
      for (const lake of lakeShapes) {
        const edgeNoise = lowWave(x, y, 41, Math.floor(lake.cx / 17)) * 0.08 + (hash2(x, y, 21) - 0.5) * 0.08;
        if (ellipseValue(x, y, lake.cx, lake.cy, lake.rx, lake.ry) < 1 + edgeNoise) classId = lake.classId;
      }
      for (const route of riverRoutes) {
        const distanceSquared = distanceToRouteSquared(x, y, route);
        const routeWidth = route.width + Math.max(0, lowWave(x, y, 75, route.width) * 2.2);
        if (distanceSquared <= routeWidth * routeWidth) classId = 2;
        else if (distanceSquared <= (routeWidth + 3) * (routeWidth + 3) && classId === 0 && hash2(x, y, 31) < 0.25) classId = 3;
      }
      const marshLowland = ellipseValue(x, y, 3140, 3100, 760, 690);
      if (classId && marshLowland < 1.1 && classId !== 2) classId = 3;
      waterClass[globalIndex(x, y)] = classId;
    }
  }

  const changedFiles = [];
  for (const entry of regionEntries) {
    const { file, map, regionX, regionY } = entry;
    const groundLayer = getLayer(map, 'Ground');
    const waterLayer = getLayer(map, 'Water');
    const terrainLayer = getLayer(map, 'TerrainDetails');
    const roadsLayer = getLayer(map, 'Roads');
    const collisionLayer = getLayer(map, 'Collision');
    const waterEdgesLayer = ensureLayerAfter(map, 'WaterEdges', 'Water', 1);
    const waterFxLayer = ensureLayerAfter(map, 'WaterFX', 'WaterEdges', 0.88);

    const oldGround = decodeLayer(groundLayer);
    const oldWaterLayer = decodeLayer(waterLayer);
    const oldTerrain = decodeLayer(terrainLayer);
    const roads = decodeLayer(roadsLayer);
    const collision = decodeLayer(collisionLayer);
    const nextGround = new Uint32Array(oldGround.length);
    const nextWater = new Uint32Array(oldGround.length);
    const nextTerrain = new Uint32Array(oldGround.length);
    const waterEdges = new Uint32Array(oldGround.length);
    const waterFx = new Uint32Array(oldGround.length);
    const nextCollision = new Uint32Array(collision);
    const collisionGid = getCollisionGid(map);
    const offsetX = regionX * REGION_TILES;
    const offsetY = regionY * REGION_TILES;

    for (let localY = 0; localY < REGION_TILES; localY += 1) {
      for (let localX = 0; localX < REGION_TILES; localX += 1) {
        const localIndex = localY * REGION_TILES + localX;
        const x = offsetX + localX;
        const y = offsetY + localY;
        const index = globalIndex(x, y);

        if (isInsideProtectedCity(x, y, protectedCityRects)) {
          nextGround[localIndex] = oldGround[localIndex];
          nextWater[localIndex] = oldWaterLayer[localIndex];
          nextTerrain[localIndex] = oldTerrain[localIndex];
          nextCollision[localIndex] = collision[localIndex];
          continue;
        }

        const classId = waterClass[index];
        const nearWater = classId || waterNeighborCount(waterClass, x, y, 2) > 0;
        const biome = classifyBiome(x, y, roadInfluence[index], nearWater, classId);
        nextGround[localIndex] = tileFrom(biome, x, y, 40);

        if (classId) {
          nextWater[localIndex] = getWaterGid(classId);
          nextTerrain[localIndex] = 0;
          if (collisionGid && !roadMask[index]) nextCollision[localIndex] = collisionGid;
          if (roadMask[index]) nextCollision[localIndex] = 0;
          const fxRoll = hash2(x, y, 50);
          if ((classId === 2 && fxRoll < 0.085) || (classId !== 2 && waterNeighborCount(waterClass, x, y, 1) < 8 && fxRoll < 0.035)) {
            waterFx[localIndex] = WATER_FX_GID;
          }
          continue;
        }

        if (oldWater[index] && collision[localIndex] === collisionGid) nextCollision[localIndex] = 0;

        const north = y > 0 && waterClass[globalIndex(x, y - 1)];
        const south = y < WORLD_TILES - 1 && waterClass[globalIndex(x, y + 1)];
        const west = x > 0 && waterClass[globalIndex(x - 1, y)];
        const east = x < WORLD_TILES - 1 && waterClass[globalIndex(x + 1, y)];
        if (north && west) waterEdges[localIndex] = SHORE_NW_GID;
        else if (north && east) waterEdges[localIndex] = SHORE_NE_GID;
        else if (south && west) waterEdges[localIndex] = SHORE_SW_GID;
        else if (south && east) waterEdges[localIndex] = SHORE_SE_GID;
        else if (north) waterEdges[localIndex] = SHORE_NORTH_GID;
        else if (south) waterEdges[localIndex] = SHORE_SOUTH_GID;
        else if (west) waterEdges[localIndex] = SHORE_WEST_GID;
        else if (east) waterEdges[localIndex] = SHORE_EAST_GID;

        const detailChance = roadInfluence[index] ? 0.006 : nearWater ? 0.025 : 0.016;
        if (hash2(x, y, 71) < detailChance) nextTerrain[localIndex] = detailFrom(biome, x, y);
      }
    }

    encodeLayer(groundLayer, nextGround);
    encodeLayer(waterLayer, nextWater);
    encodeLayer(waterEdgesLayer, waterEdges);
    encodeLayer(waterFxLayer, waterFx);
    encodeLayer(terrainLayer, nextTerrain);
    encodeLayer(collisionLayer, nextCollision);
    collisionLayer.visible = false;

    await fs.writeFile(file, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
    changedFiles.push(path.relative(rootDir, file).replaceAll(path.sep, '/'));
  }

  console.log(JSON.stringify({
    changedFiles,
    waterTileset: path.relative(rootDir, path.join(tilesetsDir, 'world_v3_water.tsx')).replaceAll(path.sep, '/'),
    waterSpritesheet: path.relative(rootDir, path.join(tilesetsDir, 'world_v3_water.png')).replaceAll(path.sep, '/'),
    newLayers: ['WaterEdges', 'WaterFX'],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
