import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
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
const TILED_GID_MASK = 0x1fffffff;

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

const WATER_FX_FIRST_GID = 25000;
const WATER_FX_TILESET_SOURCE = '../tilesets/continent_01_water_fx.tsx';

const LOCAL = {
  base: 1,
  alt: 2,
  dark: 3,
  dirt: 4,
  road: 5,
  path: 6,
  water: 7,
  bank: 8,
  stone: 9,
  plaza: 10,
  field: 11,
  mud: 12,
  light: 13,
  flowers: 14,
  reeds: 15,
  shallowWater: 16,
  forestFloor: 17,
  cliffDirt: 18,
  mossStone: 19,
  sand: 20,
  tallGrass: 21,
  crop: 22,
  roadEdge: 23,
  ruinFloor: 24,
  tree: 33,
  treeAlt: 34,
  pine: 35,
  bush: 36,
  rock: 37,
  stump: 38,
  log: 39,
  mushroom: 40,
  mountain: 49,
  mountainSnow: 50,
  cliff: 51,
  scree: 52,
};

const BIOMES = [
  { key: 'emerald', file: 'world_v3_emerald_vale', firstgid: 1, colors: ['#5f9f54', '#82b763', '#3f7446', '#bda567', '#56625a'], road: '#b99c66', family: 'plains' },
  { key: 'golden', file: 'world_v3_golden_fields', firstgid: 257, colors: ['#8fad55', '#b7bc66', '#6f8546', '#c8aa68', '#746f52'], road: '#c7a86b', family: 'plains' },
  { key: 'elderwood', file: 'world_v3_elderwood', firstgid: 513, colors: ['#477f49', '#6fa05a', '#2c5738', '#927b52', '#354d43'], road: '#866a49', family: 'forest' },
  { key: 'silver', file: 'world_v3_silver_river', firstgid: 769, colors: ['#689967', '#8fb579', '#47765a', '#b7aa75', '#647872'], road: '#bda26e', family: 'river' },
  { key: 'sunhill', file: 'world_v3_sunhill', firstgid: 1025, colors: ['#87965a', '#adb466', '#647746', '#bea465', '#70725b'], road: '#ad915d', family: 'plains' },
  { key: 'cloudspine', file: 'world_v3_cloudspine', firstgid: 1281, colors: ['#777d67', '#9e9a75', '#585f55', '#c8bd93', '#4b514d'], road: '#9d8258', family: 'rock' },
  { key: 'ironcrag', file: 'world_v3_ironcrag', firstgid: 1537, colors: ['#747669', '#979278', '#555850', '#b9aa78', '#464b48'], road: '#967b56', family: 'rock' },
  { key: 'murkfen', file: 'world_v3_murkfen', firstgid: 1793, colors: ['#56795e', '#7e9469', '#334f46', '#7e7252', '#405d55'], road: '#7a6a4c', family: 'marsh' },
  { key: 'oldEmpire', file: 'world_v3_old_empire', firstgid: 2049, colors: ['#777267', '#969074', '#53564f', '#b29f69', '#5a5b56'], road: '#93825f', family: 'ruin' },
  { key: 'saltwind', file: 'world_v3_saltwind', firstgid: 2305, colors: ['#7d9b6a', '#a5b476', '#5f7c59', '#cfb774', '#707970'], road: '#c7ad70', family: 'coast' },
  { key: 'amber', file: 'world_v3_amber_steppe', firstgid: 2561, colors: ['#a79a53', '#c5b666', '#7a7c43', '#d0b978', '#776648'], road: '#b8955e', family: 'dry' },
  { key: 'shadowfen', file: 'world_v3_shadowfen', firstgid: 2817, colors: ['#586d55', '#77835f', '#354539', '#927b5b', '#44433f'], road: '#80694b', family: 'marsh' },
];

const BIOME_BY_KEY = Object.fromEntries(BIOMES.map((biome) => [biome.key, biome]));
const BIOMES_BY_FIRSTGID = [...BIOMES].sort((a, b) => a.firstgid - b.firstgid);

const riverRoutes = [
  {
    width: 7,
    points: [
      [820, 620], [1080, 720], [1380, 840], [1720, 1040], [2130, 1260],
      [2550, 1390], [3090, 1360], [3590, 1280], [3990, 1260],
    ],
  },
  {
    width: 8,
    points: [
      [1160, 2520], [1380, 2300], [1640, 2080], [1980, 1910], [2320, 1810],
      [2660, 1900], [2980, 2150], [3330, 2480], [3720, 2780], [3995, 2920],
    ],
  },
  {
    width: 6,
    points: [
      [2240, 2860], [2500, 3050], [2860, 3230], [3210, 3380], [3540, 3580], [3870, 3830],
    ],
  },
];

function globalIndex(x, y) {
  return y * WORLD_TILES + x;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rgba(hex, alpha = 255) {
  const clean = String(hex).replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function blend(a, b, amount) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount),
    Math.round(a[3] + (b[3] - a[3]) * amount),
  ];
}

function shade(color, amount) {
  return [
    clamp(Math.round(color[0] * amount), 0, 255),
    clamp(Math.round(color[1] * amount), 0, 255),
    clamp(Math.round(color[2] * amount), 0, 255),
    color[3],
  ];
}

function put(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const offset = ((y * png.width) + x) * 4;
  png.data[offset] = color[0];
  png.data[offset + 1] = color[1];
  png.data[offset + 2] = color[2];
  png.data[offset + 3] = color[3];
}

function line(png, x0, y0, x1, y1, color) {
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;
  while (true) {
    put(png, x, y, color);
    if (x === x1 && y === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y += sy;
    }
  }
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
  return lowWave(x, y, 74, seed) * 0.55
    + lowWave(x + 31, y - 17, 151, seed + 7) * 0.38
    + (hash2(Math.floor(x / 28), Math.floor(y / 28), seed + 17) - 0.5) * 0.22;
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

function nearestRouteSegment(x, y) {
  let best = null;
  for (const route of riverRoutes) {
    for (let index = 1; index < route.points.length; index += 1) {
      const [ax, ay] = route.points[index - 1];
      const [bx, by] = route.points[index];
      const distanceSquared = distanceToSegmentSquared(x, y, ax, ay, bx, by);
      if (!best || distanceSquared < best.distanceSquared) {
        best = { distanceSquared, dx: bx - ax, dy: by - ay, width: route.width };
      }
    }
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

function ensureWaterFxTileset(map) {
  const existing = (map.tilesets ?? []).find((tileset) => tileset.source === WATER_FX_TILESET_SOURCE);
  if (existing) {
    existing.firstgid = WATER_FX_FIRST_GID;
  } else {
    map.tilesets = [...(map.tilesets ?? []), { firstgid: WATER_FX_FIRST_GID, source: WATER_FX_TILESET_SOURCE }];
  }
  map.tilesets.sort((a, b) => Number(a.firstgid ?? 0) - Number(b.firstgid ?? 0));
}

function biomeForGid(gid) {
  const clean = Number(gid ?? 0) & TILED_GID_MASK;
  for (let index = BIOMES_BY_FIRSTGID.length - 1; index >= 0; index -= 1) {
    const biome = BIOMES_BY_FIRSTGID[index];
    if (clean >= biome.firstgid && clean < biome.firstgid + 256) return biome;
  }
  return BIOME_BY_KEY.emerald;
}

function gid(biome, localId) {
  return biome.firstgid + localId - 1;
}

function chooseTerrainGid(biome, x, y, nearRoad, nearWater, edgeWaterCount) {
  const rough = patchValue(x, y, biome.firstgid);
  const broad = patchValue(x + 300, y - 130, biome.firstgid + 13);
  const roll = hash2(Math.floor(x / 9), Math.floor(y / 9), biome.firstgid + 91);

  if (nearRoad) {
    if (roll > 0.91 && rough > 0.08) return gid(biome, LOCAL.dirt);
    if (roll > 0.83 && rough > -0.15) return gid(biome, LOCAL.light);
    return gid(biome, LOCAL.base);
  }

  if (nearWater) {
    if (edgeWaterCount > 0 && ['coast', 'dry', 'plains'].includes(biome.family) && rough > 0.1 && roll > 0.76) {
      return gid(biome, LOCAL.sand);
    }
    if (['marsh', 'river'].includes(biome.family) && broad > 0.04 && roll > 0.7) return gid(biome, LOCAL.mud);
    if (roll > 0.86) return gid(biome, LOCAL.alt);
    return gid(biome, LOCAL.base);
  }

  if (biome.family === 'forest') {
    if (rough > 0.26) return gid(biome, roll > 0.58 ? LOCAL.forestFloor : LOCAL.dark);
    if (rough > 0.08 && roll > 0.42) return gid(biome, LOCAL.alt);
    return gid(biome, LOCAL.base);
  }

  if (biome.family === 'marsh') {
    if (rough > 0.24 && roll > 0.35) return gid(biome, LOCAL.dark);
    if (broad > 0.2 && roll > 0.58) return gid(biome, LOCAL.mud);
    if (roll > 0.88) return gid(biome, LOCAL.alt);
    return gid(biome, LOCAL.base);
  }

  if (biome.family === 'rock' || biome.family === 'ruin') {
    if (rough > 0.34 && roll > 0.43) return gid(biome, LOCAL.stone);
    if (rough > 0.18 && roll > 0.62) return gid(biome, LOCAL.scree);
    if (biome.family === 'ruin' && broad > 0.28 && roll > 0.74) return gid(biome, LOCAL.ruinFloor);
    return gid(biome, LOCAL.base);
  }

  if (biome.family === 'dry' || biome.family === 'coast') {
    if (rough > 0.34 && roll > 0.54) return gid(biome, LOCAL.light);
    if (rough > 0.18 && roll > 0.82) return gid(biome, LOCAL.sand);
    return gid(biome, LOCAL.base);
  }

  if (rough > 0.36 && roll > 0.58) return gid(biome, LOCAL.light);
  if (rough > 0.18 && roll > 0.82) return gid(biome, LOCAL.alt);
  return gid(biome, LOCAL.base);
}

function chooseDetailGid(biome, x, y, nearRoad, nearWater, edgeWaterCount) {
  const cluster = patchValue(x - 41, y + 83, biome.firstgid + 131);
  const roll = hash2(x, y, biome.firstgid + 177);
  const localSparse = hash2(Math.floor(x / 4), Math.floor(y / 4), biome.firstgid + 199);

  if (nearWater && edgeWaterCount > 0) {
    const chance = ['marsh', 'river'].includes(biome.family) ? 0.011 : 0.006;
    if (cluster > 0.2 && roll < chance) return gid(biome, biome.family === 'marsh' ? LOCAL.reeds : LOCAL.tallGrass);
    return 0;
  }

  if (nearRoad) {
    if (cluster > 0.28 && roll < 0.004) return gid(biome, LOCAL.tallGrass);
    return 0;
  }

  if (biome.family === 'forest') {
    if (cluster > 0.34 && roll < 0.007 && localSparse > 0.35) return gid(biome, LOCAL.tallGrass);
    if (cluster > 0.45 && roll < 0.003) return gid(biome, LOCAL.bush);
    return 0;
  }

  if (biome.family === 'rock' || biome.family === 'ruin') {
    if (cluster > 0.34 && roll < 0.006) return gid(biome, LOCAL.rock);
    return 0;
  }

  if (biome.family === 'dry' || biome.family === 'coast') {
    if (cluster > 0.36 && roll < 0.004) return gid(biome, LOCAL.tallGrass);
    return 0;
  }

  if (cluster > 0.38 && roll < 0.0045) return gid(biome, LOCAL.flowers);
  return 0;
}

function waterClassForGid(gidValue) {
  const gidValueClean = Number(gidValue ?? 0) & TILED_GID_MASK;
  if (!gidValueClean) return 0;
  if (gidValueClean === RIVER_WATER_GID || gidValueClean === RIVER_WATER_GID + 1) return 2;
  if (gidValueClean === SHALLOW_WATER_GID || gidValueClean === SHALLOW_WATER_GID + 1) return 3;
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

function flowGidForTile(x, y, waterClass) {
  const segment = nearestRouteSegment(x, y);
  let dx = segment?.dx ?? 0;
  let dy = segment?.dy ?? 0;
  if (!segment || segment.distanceSquared > (segment.width + 16) ** 2) {
    const west = x > 0 && waterClass[globalIndex(x - 1, y)] ? 1 : 0;
    const east = x < WORLD_TILES - 1 && waterClass[globalIndex(x + 1, y)] ? 1 : 0;
    const north = y > 0 && waterClass[globalIndex(x, y - 1)] ? 1 : 0;
    const south = y < WORLD_TILES - 1 && waterClass[globalIndex(x, y + 1)] ? 1 : 0;
    dx = east - west;
    dy = south - north;
  }

  if (Math.abs(dx) > Math.abs(dy) * 1.35) return WATER_FX_FIRST_GID;
  if (Math.abs(dy) > Math.abs(dx) * 1.35) return WATER_FX_FIRST_GID + 2;
  return dx * dy >= 0 ? WATER_FX_FIRST_GID + 4 : WATER_FX_FIRST_GID + 6;
}

function makeBiomeTilesheets() {
  for (const biome of BIOMES) {
    const png = new PNG({ width: 512, height: 512, colorType: 6 });
    const [base, light, dark, sand, stone] = biome.colors.map((color) => rgba(color));
    const road = rgba(biome.road);
    const mud = blend(dark, sand, 0.38);
    const water = rgba('#2f7284');
    const shallow = rgba('#5b8f88');
    for (let tile = 0; tile < 256; tile += 1) {
      const localId = tile + 1;
      const tx = (tile % 16) * TILE_SIZE;
      const ty = Math.floor(tile / 16) * TILE_SIZE;
      const modeColor = [LOCAL.water].includes(localId) ? water
        : localId === LOCAL.shallowWater ? shallow
          : [LOCAL.bank, LOCAL.sand].includes(localId) ? sand
            : [LOCAL.road, LOCAL.path, LOCAL.roadEdge].includes(localId) ? road
              : [LOCAL.stone, LOCAL.mountain, LOCAL.mountainSnow, LOCAL.cliff, LOCAL.scree, LOCAL.mossStone, LOCAL.rock].includes(localId) ? stone
                : [LOCAL.mud, LOCAL.reeds].includes(localId) ? mud
                  : [LOCAL.dark, LOCAL.forestFloor, LOCAL.tree, LOCAL.treeAlt, LOCAL.pine, LOCAL.bush].includes(localId) ? dark
                    : [LOCAL.alt, LOCAL.field, LOCAL.flowers, LOCAL.tallGrass, LOCAL.crop, LOCAL.light].includes(localId) ? light
                      : [LOCAL.plaza, LOCAL.ruinFloor].includes(localId) ? blend(stone, sand, 0.42)
                        : base;

      for (let y = 0; y < TILE_SIZE; y += 1) {
        for (let x = 0; x < TILE_SIZE; x += 1) {
          const grain = Math.sin((x + tile * 0.7) / 13) * 0.012 + Math.cos((y - tile * 0.4) / 17) * 0.012;
          put(png, tx + x, ty + y, shade(modeColor, 1 + grain));
        }
      }

      const accentA = blend(modeColor, light, 0.11);
      const accentB = blend(modeColor, dark, 0.10);
      for (let index = 0; index < 6; index += 1) {
        if (hash2(tile, index, 802) < 0.38) continue;
        const px = tx + Math.floor(hash2(tile, index, 803) * TILE_SIZE);
        const py = ty + Math.floor(hash2(tile, index, 804) * TILE_SIZE);
        put(png, px, py, index % 2 ? accentA : accentB);
      }

      if ([LOCAL.road, LOCAL.path].includes(localId)) {
        const edge = blend(road, dark, 0.16);
        for (let y = 8; y <= 23; y += 1) {
          for (let x = 0; x < TILE_SIZE; x += 1) put(png, tx + x, ty + y, road);
        }
        line(png, tx, ty + 8, tx + 31, ty + 9, edge);
        line(png, tx, ty + 23, tx + 31, ty + 22, edge);
        for (let x = 5; x < 30; x += 9) put(png, tx + x, ty + 15, blend(road, sand, 0.28));
      }

      if ([LOCAL.tree, LOCAL.treeAlt, LOCAL.pine].includes(localId)) {
        for (let yy = 5; yy < 22; yy += 4) {
          const width = localId === LOCAL.pine ? 20 - Math.floor(yy / 2) : 18 - Math.floor(yy / 3);
          const startX = tx + Math.max(3, 16 - Math.floor(width / 2));
          for (let px = 0; px < width; px += 1) {
            for (let py = 0; py < 4; py += 1) put(png, startX + px, ty + yy + py, blend(dark, base, py * 0.04));
          }
        }
        for (let yy = 19; yy < 28; yy += 1) for (let xx = 14; xx < 18; xx += 1) put(png, tx + xx, ty + yy, rgba('#6b4a31'));
      }

      if ([LOCAL.mountain, LOCAL.mountainSnow, LOCAL.cliff].includes(localId)) {
        line(png, tx + 4, ty + 27, tx + 15, ty + 6, blend(stone, rgba('#eee6ce'), 0.4));
        line(png, tx + 15, ty + 6, tx + 28, ty + 27, blend(stone, dark, 0.35));
        if (localId === LOCAL.mountainSnow) {
          for (let yy = 8; yy < 13; yy += 1) for (let xx = 11; xx < 20; xx += 1) put(png, tx + xx, ty + yy, rgba('#e8e1cd'));
        }
      }
    }
    writeFileSync(path.join(tilesetsDir, `${biome.file}.png`), PNG.sync.write(png, { colorType: 6, inputColorType: 6, deflateLevel: 9 }));
  }
}

function drawWaterTile(png, tileId, drawer) {
  const startX = tileId * TILE_SIZE;
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      put(png, startX + x, y, drawer(x, y));
    }
  }
}

function makeWaterBaseTileset() {
  const png = new PNG({ width: 512, height: 32, colorType: 6 });
  png.data.fill(0);
  const calm = rgba('#2c7187');
  const calmAlt = rgba('#2a6b82');
  const river = rgba('#2e7893');
  const riverAlt = rgba('#2b738e');
  const shallow = rgba('#5b9288');
  const shallowAlt = rgba('#578c83');
  const shore = rgba('#b5aa72', 132);
  const foam = rgba('#c9e1db', 118);

  const waterBase = (base, x, y, seed = 0, amount = 1) => {
    const ripple = Math.sin((x + seed * 7) / 7.7) * 1.6 * amount + Math.cos((y - seed * 4) / 10.5) * 1.4 * amount;
    return shade(base, 1 + ripple / 255);
  };

  drawWaterTile(png, 0, (x, y) => {
    const color = waterBase(calm, x, y, 0.2, 0.8);
    if ((y === 11 && x > 5 && x < 18) || (y === 23 && x > 14 && x < 26)) return blend(color, rgba('#7fb2bd'), 0.18);
    return color;
  });
  drawWaterTile(png, 1, (x, y) => {
    const color = waterBase(calmAlt, x, y, 0.85, 0.8);
    if ((y === 12 && x > 8 && x < 21) || (y === 22 && x > 10 && x < 23)) return blend(color, rgba('#7aaeb9'), 0.16);
    return color;
  });
  drawWaterTile(png, 2, (x, y) => {
    const color = waterBase(river, x, y, 0.4, 0.65);
    if (((x + y * 2 + 2) % 34) < 5 && y % 5 !== 0) return blend(color, rgba('#96cbd2'), 0.1);
    return color;
  });
  drawWaterTile(png, 3, (x, y) => {
    const color = waterBase(riverAlt, x, y, 1.2, 0.65);
    if (((x + y * 2 + 18) % 34) < 5 && y % 5 !== 2) return blend(color, rgba('#8fc4cd'), 0.09);
    return color;
  });
  drawWaterTile(png, 4, (x, y) => {
    const color = waterBase(shallow, x, y, 0.6, 0.5);
    if (((x * 3 + y) % 43) === 0) return blend(color, rgba('#779b69'), 0.24);
    return color;
  });
  drawWaterTile(png, 5, (x, y) => {
    const color = waterBase(shallowAlt, x, y, 1.1, 0.5);
    if (((x * 3 + y + 19) % 47) === 0) return blend(color, rgba('#7a9e6d'), 0.22);
    return color;
  });
  drawWaterTile(png, 6, (x, y) => {
    const band = Math.abs(y - (11 + Math.sin(x / 5) * 2)) < 1.1 || Math.abs(y - (24 + Math.cos(x / 6) * 1.6)) < 1;
    return band ? rgba('#d2e8e3', 96) : [0, 0, 0, 0];
  });
  drawWaterTile(png, 7, (x, y) => {
    const band = Math.abs(y - (9 + Math.sin((x + 8) / 5) * 2)) < 1.1 || Math.abs(y - (22 + Math.cos((x + 7) / 6) * 1.6)) < 1;
    return band ? rgba('#d6ece7', 92) : [0, 0, 0, 0];
  });

  const edge = (x, y, side) => {
    if (side === 'north' && y < 6) return y < 2 ? foam : shore;
    if (side === 'south' && y >= 26) return y > 29 ? foam : shore;
    if (side === 'west' && x < 6) return x < 2 ? foam : shore;
    if (side === 'east' && x >= 26) return x > 29 ? foam : shore;
    return [0, 0, 0, 0];
  };
  drawWaterTile(png, 8, (x, y) => edge(x, y, 'north'));
  drawWaterTile(png, 9, (x, y) => edge(x, y, 'south'));
  drawWaterTile(png, 10, (x, y) => edge(x, y, 'west'));
  drawWaterTile(png, 11, (x, y) => edge(x, y, 'east'));
  drawWaterTile(png, 12, (x, y) => {
    const n = edge(x, y, 'north');
    const w = edge(x, y, 'west');
    return n[3] || w[3] ? blend(n[3] ? n : w, w[3] ? w : n, 0.42) : [0, 0, 0, 0];
  });
  drawWaterTile(png, 13, (x, y) => {
    const n = edge(x, y, 'north');
    const e = edge(x, y, 'east');
    return n[3] || e[3] ? blend(n[3] ? n : e, e[3] ? e : n, 0.42) : [0, 0, 0, 0];
  });
  drawWaterTile(png, 14, (x, y) => {
    const s = edge(x, y, 'south');
    const w = edge(x, y, 'west');
    return s[3] || w[3] ? blend(s[3] ? s : w, w[3] ? w : s, 0.42) : [0, 0, 0, 0];
  });
  drawWaterTile(png, 15, (x, y) => {
    const s = edge(x, y, 'south');
    const e = edge(x, y, 'east');
    return s[3] || e[3] ? blend(s[3] ? s : e, e[3] ? e : s, 0.42) : [0, 0, 0, 0];
  });

  writeFileSync(path.join(tilesetsDir, 'world_v3_water.png'), PNG.sync.write(png, { colorType: 6, inputColorType: 6, deflateLevel: 9 }));
  writeFileSync(path.join(tilesetsDir, 'world_v3_water.tsx'), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="world_v3_water" tilewidth="32" tileheight="32" tilecount="16" columns="16">
 <image source="world_v3_water.png" width="512" height="32"/>
 <tile id="0"><animation><frame tileid="0" duration="760"/><frame tileid="1" duration="760"/></animation></tile>
 <tile id="2"><animation><frame tileid="2" duration="220"/><frame tileid="3" duration="220"/></animation></tile>
 <tile id="4"><animation><frame tileid="4" duration="820"/><frame tileid="5" duration="820"/></animation></tile>
 <tile id="6"><animation><frame tileid="6" duration="360"/><frame tileid="7" duration="360"/></animation></tile>
</tileset>
`, 'utf8');
}

function makeWaterFxTileset() {
  const png = new PNG({ width: 512, height: 32, colorType: 6 });
  png.data.fill(0);
  const flow = rgba('#b8dfe4', 62);
  const ripple = rgba('#c9e6e4', 58);
  const foam = rgba('#e3f0e8', 82);
  const marsh = rgba('#abc78d', 64);

  const drawTransparentTile = (tileId, drawer) => drawWaterTile(png, tileId, (x, y) => drawer(x, y));
  const drawFlowLine = (tileId, offset, mode) => {
    drawTransparentTile(tileId, (x, y) => {
      if (mode === 'horizontal' && Math.abs(y - 16) <= 1 && ((x + offset) % 32) < 11) return flow;
      if (mode === 'vertical' && Math.abs(x - 16) <= 1 && ((y + offset) % 32) < 11) return flow;
      if (mode === 'diagDown' && Math.abs(((x - y + offset + 96) % 36) - 18) <= 1 && (x + y) % 5 !== 0) return flow;
      if (mode === 'diagUp' && Math.abs(((x + y + offset) % 36) - 18) <= 1 && (x - y + 96) % 5 !== 0) return flow;
      return [0, 0, 0, 0];
    });
  };

  drawFlowLine(0, 0, 'horizontal');
  drawFlowLine(1, 8, 'horizontal');
  drawFlowLine(2, 0, 'vertical');
  drawFlowLine(3, 8, 'vertical');
  drawFlowLine(4, 0, 'diagDown');
  drawFlowLine(5, 8, 'diagDown');
  drawFlowLine(6, 0, 'diagUp');
  drawFlowLine(7, 8, 'diagUp');
  drawTransparentTile(8, (x, y) => (
    ((Math.abs(y - 12) <= 1 && x > 7 && x < 21) || (Math.abs(y - 23) <= 1 && x > 14 && x < 27)) ? ripple : [0, 0, 0, 0]
  ));
  drawTransparentTile(9, (x, y) => (
    ((Math.abs(y - 11) <= 1 && x > 10 && x < 24) || (Math.abs(y - 22) <= 1 && x > 5 && x < 18)) ? ripple : [0, 0, 0, 0]
  ));
  drawTransparentTile(10, (x, y) => (Math.abs(y - (7 + Math.sin(x / 4) * 2)) < 1.1 ? foam : [0, 0, 0, 0]));
  drawTransparentTile(11, (x, y) => (Math.abs(y - (9 + Math.sin((x + 6) / 4) * 2)) < 1.1 ? foam : [0, 0, 0, 0]));
  drawTransparentTile(12, (x, y) => (((x * 5 + y * 3) % 37) === 0 ? marsh : [0, 0, 0, 0]));
  drawTransparentTile(13, (x, y) => (((x * 5 + y * 3 + 17) % 41) === 0 ? marsh : [0, 0, 0, 0]));
  drawTransparentTile(14, (x, y) => (Math.abs(y - 29) <= 1 && x % 8 < 4 ? foam : [0, 0, 0, 0]));
  drawTransparentTile(15, (x, y) => (Math.abs(y - 2) <= 1 && (x + 3) % 8 < 4 ? foam : [0, 0, 0, 0]));

  writeFileSync(path.join(tilesetsDir, 'continent_01_water_fx.png'), PNG.sync.write(png, { colorType: 6, inputColorType: 6, deflateLevel: 9 }));
  writeFileSync(path.join(tilesetsDir, 'continent_01_water_fx.tsx'), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="continent_01_water_fx" tilewidth="32" tileheight="32" tilecount="16" columns="16">
 <image source="continent_01_water_fx.png" width="512" height="32"/>
 <tile id="0"><animation><frame tileid="0" duration="150"/><frame tileid="1" duration="150"/></animation></tile>
 <tile id="2"><animation><frame tileid="2" duration="150"/><frame tileid="3" duration="150"/></animation></tile>
 <tile id="4"><animation><frame tileid="4" duration="150"/><frame tileid="5" duration="150"/></animation></tile>
 <tile id="6"><animation><frame tileid="6" duration="150"/><frame tileid="7" duration="150"/></animation></tile>
 <tile id="8"><animation><frame tileid="8" duration="900"/><frame tileid="9" duration="900"/></animation></tile>
 <tile id="10"><animation><frame tileid="10" duration="420"/><frame tileid="11" duration="420"/></animation></tile>
 <tile id="12"><animation><frame tileid="12" duration="840"/><frame tileid="13" duration="840"/></animation></tile>
 <tile id="14"><animation><frame tileid="14" duration="1100"/><frame tileid="15" duration="1100"/></animation></tile>
</tileset>
`, 'utf8');
}

async function main() {
  makeBiomeTilesheets();
  makeWaterBaseTileset();
  makeWaterFxTileset();

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

  const roadInfluence = buildInfluence(roadMask, 5, 30);
  const changedFiles = [];
  const stats = {
    terrainBase: 0,
    terrainSubtle: 0,
    terrainStrong: 0,
    terrainDetails: 0,
    riverFlowTiles: 0,
    stillWaterFxTiles: 0,
    shoreTiles: 0,
  };

  for (const entry of regionEntries) {
    const { file, map, regionX, regionY } = entry;
    const groundLayer = getLayer(map, 'Ground');
    const waterLayer = getLayer(map, 'Water');
    const terrainLayer = getLayer(map, 'TerrainDetails');
    const roadsLayer = getLayer(map, 'Roads');
    const waterEdgesLayer = ensureLayerAfter(map, 'WaterEdges', 'Water', 0.62);
    const riverFlowLayer = ensureLayerAfter(map, 'RiverFlow', 'Water', 0.32);
    const waterFxLayer = ensureLayerAfter(map, 'WaterFX', 'WaterEdges', 0.36);
    ensureWaterFxTileset(map);

    const oldGround = decodeLayer(groundLayer);
    const oldWaterLayer = decodeLayer(waterLayer);
    const oldTerrain = decodeLayer(terrainLayer);
    const roads = decodeLayer(roadsLayer);
    const nextGround = new Uint32Array(oldGround.length);
    const nextWater = new Uint32Array(oldWaterLayer.length);
    const nextTerrain = new Uint32Array(oldTerrain.length);
    const waterEdges = new Uint32Array(oldGround.length);
    const riverFlow = new Uint32Array(oldGround.length);
    const waterFx = new Uint32Array(oldGround.length);
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
          nextWater[localIndex] = oldWaterLayer[localIndex];
          nextTerrain[localIndex] = oldTerrain[localIndex];
          continue;
        }

        const biome = biomeForGid(oldGround[localIndex]);
        const edgeWaterCount = classId ? 0 : waterNeighborCount(waterClass, x, y, 1);
        const nearWater = Boolean(classId) || edgeWaterCount > 0 || waterNeighborCount(waterClass, x, y, 2) > 0;
        const nearRoad = Boolean(roadInfluence[index]);

        if (classId) {
          nextGround[localIndex] = chooseTerrainGid(biome, x, y, false, true, 0);
          nextWater[localIndex] = waterGidForClass(classId);
          if (classId === 2) {
            riverFlow[localIndex] = flowGidForTile(x, y, waterClass);
            stats.riverFlowTiles += 1;
            if (waterNeighborCount(waterClass, x, y, 1) < 8 && hash2(x, y, 412) < 0.018) {
              waterFx[localIndex] = WATER_FX_FIRST_GID + 10;
            }
          } else if (classId === 3) {
            if (hash2(x, y, 413) < 0.022) waterFx[localIndex] = WATER_FX_FIRST_GID + 12;
          } else if (waterNeighborCount(waterClass, x, y, 1) < 8 && hash2(x, y, 414) < 0.016) {
            waterFx[localIndex] = WATER_FX_FIRST_GID + 8;
            stats.stillWaterFxTiles += 1;
          }
          continue;
        }

        const groundGid = chooseTerrainGid(biome, x, y, nearRoad, nearWater, edgeWaterCount);
        nextGround[localIndex] = groundGid;
        const localGroundId = groundGid - biome.firstgid + 1;
        if (localGroundId === LOCAL.base) stats.terrainBase += 1;
        else if ([LOCAL.alt, LOCAL.light].includes(localGroundId)) stats.terrainSubtle += 1;
        else stats.terrainStrong += 1;

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
        if (waterEdges[localIndex]) stats.shoreTiles += 1;

        if (!roads[localIndex]) {
          const detailGid = chooseDetailGid(biome, x, y, nearRoad, nearWater, edgeWaterCount);
          nextTerrain[localIndex] = detailGid;
          if (detailGid) stats.terrainDetails += 1;
        }
      }
    }

    encodeLayer(groundLayer, nextGround);
    encodeLayer(waterLayer, nextWater);
    encodeLayer(waterEdgesLayer, waterEdges);
    encodeLayer(riverFlowLayer, riverFlow);
    encodeLayer(waterFxLayer, waterFx);
    encodeLayer(terrainLayer, nextTerrain);

    await fs.writeFile(file, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
    changedFiles.push(path.relative(rootDir, file).replaceAll(path.sep, '/'));
  }

  const totalTerrain = stats.terrainBase + stats.terrainSubtle + stats.terrainStrong;
  console.log(JSON.stringify({
    changedFiles,
    terrainRatio: {
      calmBase: totalTerrain ? Number((stats.terrainBase / totalTerrain).toFixed(3)) : 0,
      subtleVariation: totalTerrain ? Number((stats.terrainSubtle / totalTerrain).toFixed(3)) : 0,
      strongerPatches: totalTerrain ? Number((stats.terrainStrong / totalTerrain).toFixed(3)) : 0,
    },
    terrainDetailTiles: stats.terrainDetails,
    shoreTiles: stats.shoreTiles,
    riverFlowTiles: stats.riverFlowTiles,
    stillWaterFxTiles: stats.stillWaterFxTiles,
    waterTilesets: [
      path.relative(rootDir, path.join(tilesetsDir, 'world_v3_water.tsx')).replaceAll(path.sep, '/'),
      path.relative(rootDir, path.join(tilesetsDir, 'continent_01_water_fx.tsx')).replaceAll(path.sep, '/'),
    ],
    waterLayers: ['Water', 'RiverFlow', 'WaterEdges', 'WaterFX'],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
