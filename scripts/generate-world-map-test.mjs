import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const mapsDir = path.join(publicDir, 'maps');
const tilesetsDir = path.join(publicDir, 'tilesets');
const assetTilesetsDir = path.join(publicDir, 'assets', 'tilesets');
const docsDir = path.join(rootDir, 'docs');

const TILE = 32;
const REGION_TILES = 800;
const REGION_GRID = 5;
const WORLD_TILES = REGION_TILES * REGION_GRID;
const TILESET_COLUMNS = 16;
const TILESET_TILES = 256;

const BIOMES = [
  { id: 'greenvale', name: 'Greenvale Lowlands', firstgid: 1, colors: ['#6f9b42', '#96b858', '#3f6d32', '#b6a35b', '#5f6f4b'], enemyType: 'plainstrider', level: 10 },
  { id: 'westreach', name: 'Westreach Coast', firstgid: 257, colors: ['#7e9b45', '#b2a35c', '#426c34', '#d0bd75', '#6e6a50'], enemyType: 'road-bandit', level: 12 },
  { id: 'spinebreak', name: 'Spinebreak Highlands', firstgid: 513, colors: ['#7f8154', '#a99555', '#626658', '#e4dfc9', '#4f544b'], enemyType: 'stone-gnoll', level: 16 },
  { id: 'verdant', name: 'Verdant Reach', firstgid: 769, colors: ['#5f8f3d', '#85a84a', '#27592c', '#b5ab6b', '#4f6b48'], enemyType: 'forest-sprite', level: 18 },
  { id: 'silverpeak', name: 'Silverpeak Crown', firstgid: 1025, colors: ['#778766', '#aeb78e', '#606f62', '#f0ecd8', '#51584d'], enemyType: 'snow-wolf', level: 21 },
  { id: 'bogmire', name: 'Bogmire Fen', firstgid: 1281, colors: ['#537b50', '#82975d', '#2e5546', '#8a8154', '#40584c'], enemyType: 'plaguehound', level: 22 },
  { id: 'sunbreak', name: 'Sunbreak Expanse', firstgid: 1537, colors: ['#a9994c', '#c9b260', '#6d813f', '#d8bf78', '#725f3b'], enemyType: 'scorpion', level: 24 },
  { id: 'stormroot', name: 'Stormroot Basin', firstgid: 1793, colors: ['#739a4a', '#98ad58', '#3c6435', '#b1a46f', '#576348'], enemyType: 'corrupted-treant', level: 26 },
  { id: 'ashen', name: 'Ashen Frontier', firstgid: 2049, colors: ['#6e6658', '#958b68', '#464339', '#b08a58', '#373431'], enemyType: 'ember-wraith', level: 28 },
];

const BUILDINGS_FIRSTGID = 2305;
const PROPS_FIRSTGID = 2561;
const COLLISION_FIRSTGID = 2817;

const BIOME_BY_ID = Object.fromEntries(BIOMES.map((biome) => [biome.id, biome]));

const TILES = {
  base: 1,
  alt: 2,
  dark: 3,
  dirt: 4,
  road: 5,
  roadLight: 6,
  water: 7,
  bank: 8,
  stone: 9,
  plaza: 10,
  field: 11,
  ash: 12,
  snow: 13,
  flowers: 14,
  reeds: 15,
  tree: 33,
  treeAlt: 34,
  pine: 35,
  bush: 36,
  rock: 37,
  stump: 38,
  log: 39,
  mountain: 49,
  mountainSnow: 50,
  cliff: 51,
  fenceH: 53,
  fenceV: 54,
  well: 65,
  lamp: 66,
  crate: 67,
  barrel: 68,
  sign: 69,
  crop: 81,
  hay: 82,
  grave: 83,
  campfire: 84,
  dock: 85,
  mine: 96,
};

const LANDMARKS = [
  { id: 'stoneford_city', name: 'Stoneford City', kind: 'city', x: 1960, y: 1880, biome: 'greenvale', radius: 120 },
  { id: 'westwatch', name: 'Westwatch', kind: 'village', x: 660, y: 1450, biome: 'westreach', radius: 70 },
  { id: 'pineharbor', name: 'Pineharbor', kind: 'village', x: 880, y: 2420, biome: 'westreach', radius: 64 },
  { id: 'ironpass_hold', name: 'Ironpass Hold', kind: 'fort', x: 1120, y: 760, biome: 'spinebreak', radius: 80 },
  { id: 'moonwell_grove', name: 'Moonwell Grove', kind: 'village', x: 2720, y: 720, biome: 'verdant', radius: 76 },
  { id: 'snowcap_watch', name: 'Snowcap Watch', kind: 'fort', x: 2420, y: 1060, biome: 'silverpeak', radius: 72 },
  { id: 'fenwick_crossing', name: 'Fenwick Crossing', kind: 'village', x: 3320, y: 1660, biome: 'bogmire', radius: 64 },
  { id: 'sunspire_camp', name: 'Sunspire Camp', kind: 'camp', x: 1700, y: 3070, biome: 'sunbreak', radius: 62 },
  { id: 'stormroot_refuge', name: 'Stormroot Refuge', kind: 'village', x: 2940, y: 2920, biome: 'stormroot', radius: 78 },
  { id: 'emberfall_ruins', name: 'Emberfall Ruins', kind: 'ruins', x: 560, y: 3200, biome: 'ashen', radius: 88 },
];

const ROADS = [
  [[1960, 1880], [1560, 1740], [1120, 1460], [660, 1450]],
  [[660, 1450], [720, 1980], [880, 2420]],
  [[1960, 1880], [1740, 1450], [1420, 1080], [1120, 760]],
  [[1960, 1880], [2250, 1530], [2420, 1060], [2720, 720]],
  [[2420, 1060], [2860, 1280], [3320, 1660]],
  [[1960, 1880], [2100, 2420], [1700, 3070]],
  [[1700, 3070], [2300, 3000], [2940, 2920]],
  [[2940, 2920], [3240, 2460], [3320, 1660]],
  [[880, 2420], [700, 2820], [560, 3200]],
];

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(width, height, pixels) {
  const rowBytes = width * 4 + 1;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * rowBytes] = 0;
    pixels.copy(raw, y * rowBytes + 1, y * width * 4, (y + 1) * width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function rgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16), alpha];
}

function blend(a, b, amount) {
  return [
    Math.round(a[0] * (1 - amount) + b[0] * amount),
    Math.round(a[1] * (1 - amount) + b[1] * amount),
    Math.round(a[2] * (1 - amount) + b[2] * amount),
    Math.round(a[3] * (1 - amount) + b[3] * amount),
  ];
}

function put(pixels, width, height, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const index = (Math.floor(y) * width + Math.floor(x)) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function fill(pixels, width, height, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) put(pixels, width, height, xx, yy, color);
}

function line(pixels, width, height, x0, y0, x1, y1, color) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = Math.round(x0);
  let y = Math.round(y0);
  while (true) {
    put(pixels, width, height, x, y, color);
    if (x === Math.round(x1) && y === Math.round(y1)) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function hash(x, y, salt = 0) {
  let n = Math.imul(Math.floor(x) + 374761393, 668265263) ^ Math.imul(Math.floor(y) + 1274126177, 2246822519) ^ salt;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function makeLayer(fillValue = 0) {
  return Array.from({ length: REGION_TILES * REGION_TILES }, () => fillValue);
}

function encodeTileData(data) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let i = 0; i < data.length; i += 1) buffer.writeUInt32LE(data[i] >>> 0, i * 4);
  return zlib.deflateSync(buffer).toString('base64');
}

function localIndex(x, y) {
  return y * REGION_TILES + x;
}

function setTile(layer, x, y, gid) {
  if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) return;
  layer[localIndex(x, y)] = gid;
}

function getTile(layer, x, y) {
  if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) return 0;
  return layer[localIndex(x, y)];
}

function fillRectLayer(layer, x, y, w, h, gid) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) setTile(layer, xx, yy, gid);
}

function softEllipse(x, y, cx, cy, rx, ry) {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return 1 - (nx * nx + ny * ny);
}

function landScore(x, y) {
  const western = Math.max(
    softEllipse(x, y, 660, 820, 410, 660),
    softEllipse(x, y, 700, 1630, 430, 950),
    softEllipse(x, y, 740, 2560, 360, 640),
    softEllipse(x, y, 520, 3310, 280, 420),
  );
  const middle = Math.max(
    softEllipse(x, y, 1880, 1770, 780, 720),
    softEllipse(x, y, 1960, 2950, 860, 540),
    softEllipse(x, y, 1460, 3170, 460, 440),
  );
  const east = Math.max(
    softEllipse(x, y, 2630, 700, 860, 480),
    softEllipse(x, y, 3220, 940, 740, 460),
    softEllipse(x, y, 3160, 1830, 660, 560),
    softEllipse(x, y, 3070, 2890, 820, 620),
    softEllipse(x, y, 3590, 2750, 360, 390),
  );
  const islands = Math.max(
    softEllipse(x, y, 3580, 1830, 140, 120),
    softEllipse(x, y, 3440, 2180, 110, 100),
    softEllipse(x, y, 1860, 3600, 140, 95),
    softEllipse(x, y, 1030, 2790, 110, 100),
    softEllipse(x, y, 1190, 1700, 95, 95),
  );
  return Math.max(western, middle, east, islands)
    + (hash(x / 18, y / 18, 1) - 0.5) * 0.36
    + (hash(x / 53, y / 53, 2) - 0.5) * 0.22;
}

function isLand(x, y) {
  return landScore(x, y) > 0.02;
}

function mountainScore(x, y) {
  return Math.max(
    softEllipse(x, y, 720, 520, 150, 410),
    softEllipse(x, y, 760, 1120, 145, 820),
    softEllipse(x, y, 780, 2020, 135, 760),
    softEllipse(x, y, 1180, 760, 260, 170),
    softEllipse(x, y, 2270, 720, 520, 170),
    softEllipse(x, y, 2600, 950, 590, 200),
    softEllipse(x, y, 2420, 1260, 360, 150),
    softEllipse(x, y, 1910, 2940, 480, 150),
    softEllipse(x, y, 2670, 2860, 560, 160),
    softEllipse(x, y, 3160, 2960, 470, 150),
  );
}

function biomeFor(x, y) {
  if (!isLand(x, y)) return BIOME_BY_ID.greenvale;
  const m = mountainScore(x, y);
  if (x < 1500 && m > 0.08) return BIOME_BY_ID.spinebreak;
  if (x >= 1800 && y < 1500 && m > 0.12) return BIOME_BY_ID.silverpeak;
  if (x < 1050 && y > 2750) return BIOME_BY_ID.ashen;
  if (x > 2920 && y > 1180 && y < 2350) return BIOME_BY_ID.bogmire;
  if (x > 2280 && y > 2180) return BIOME_BY_ID.stormroot;
  if (x > 1200 && y > 2500) return BIOME_BY_ID.sunbreak;
  if (x > 1700 && y < 1450) return BIOME_BY_ID.verdant;
  if (x < 1250) return BIOME_BY_ID.westreach;
  return BIOME_BY_ID.greenvale;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function roadDistance(x, y) {
  let best = Number.POSITIVE_INFINITY;
  for (const road of ROADS) {
    for (let i = 0; i < road.length - 1; i += 1) {
      const [ax, ay] = road[i];
      const [bx, by] = road[i + 1];
      best = Math.min(best, distanceToSegment(x, y, ax, ay, bx, by));
    }
  }
  return best;
}

function landmarkAt(x, y) {
  return LANDMARKS.find((landmark) => Math.hypot(x - landmark.x, y - landmark.y) <= landmark.radius) ?? null;
}

function gid(biome, tile) {
  return biome.firstgid + tile - 1;
}

function groundTileFor(x, y) {
  const biome = biomeFor(x, y);
  if (!isLand(x, y)) return gid(biome, TILES.water);
  const coast = landScore(x, y);
  const landmark = landmarkAt(x, y);
  const road = roadDistance(x, y);
  const mountain = mountainScore(x, y);
  if (landmark?.kind === 'city') return gid(biome, road < 22 ? TILES.road : TILES.plaza);
  if (landmark && road < 14) return gid(biome, TILES.road);
  if (road < 9) return gid(biome, TILES.road);
  if (road < 14) return gid(biome, TILES.roadLight);
  if (coast < 0.15) return gid(biome, TILES.bank);
  if (mountain > 0.52) return gid(biome, TILES.mountainSnow);
  if (mountain > 0.24) return gid(biome, TILES.mountain);
  if (biome.id === 'ashen') return gid(biome, hash(x / 7, y / 7, 13) > 0.25 ? TILES.ash : TILES.dirt);
  if (biome.id === 'sunbreak') return gid(biome, hash(x / 8, y / 8, 14) > 0.5 ? TILES.dirt : TILES.base);
  if (biome.id === 'bogmire') return gid(biome, hash(x / 9, y / 9, 15) > 0.55 ? TILES.reeds : TILES.dark);
  const n = hash(x / 9, y / 9, biome.firstgid);
  if (n > 0.92) return gid(biome, TILES.flowers);
  if (n > 0.78) return gid(biome, TILES.dark);
  if (n > 0.56) return gid(biome, TILES.alt);
  return gid(biome, TILES.base);
}

function shouldPlaceNaturalProp(x, y) {
  if (!isLand(x, y)) return false;
  if (roadDistance(x, y) < 18) return false;
  if (landmarkAt(x, y)) return false;
  return hash(x, y, 77) > 0.967;
}

function naturalPropTile(x, y) {
  const biome = biomeFor(x, y);
  const mountain = mountainScore(x, y);
  if (mountain > 0.26) return gid(biome, hash(x, y, 5) > 0.48 ? TILES.rock : TILES.mine);
  if (biome.id === 'silverpeak' || biome.id === 'spinebreak') return gid(biome, hash(x, y, 6) > 0.52 ? TILES.pine : TILES.rock);
  if (biome.id === 'sunbreak' || biome.id === 'ashen') return gid(biome, hash(x, y, 7) > 0.5 ? TILES.rock : TILES.stump);
  if (biome.id === 'bogmire') return gid(biome, hash(x, y, 8) > 0.45 ? TILES.reeds : TILES.log);
  return gid(biome, hash(x, y, 9) > 0.42 ? TILES.tree : TILES.treeAlt);
}

function makeTileLayer(name, id, data, visible = true) {
  return {
    compression: 'zlib',
    data: encodeTileData(data),
    encoding: 'base64',
    height: REGION_TILES,
    id,
    name,
    opacity: 1,
    type: 'tilelayer',
    visible,
    width: REGION_TILES,
    x: 0,
    y: 0,
  };
}

function objectProperties(props) {
  return Object.entries(props).map(([name, value]) => ({
    name,
    type: typeof value === 'number' ? 'int' : 'string',
    value,
  }));
}

let objectId = 1;
function rectObject(name, x, y, w, h, props = {}) {
  return {
    id: objectId += 1,
    name,
    x: x * TILE,
    y: y * TILE,
    width: w * TILE,
    height: h * TILE,
    properties: objectProperties(props),
  };
}

function pointObject(name, x, y, props = {}) {
  return {
    id: objectId += 1,
    name,
    point: true,
    x: x * TILE + TILE / 2,
    y: y * TILE + TILE / 2,
    properties: objectProperties(props),
  };
}

function makeObjectLayer(name, id, objects) {
  return {
    draworder: 'topdown',
    id,
    name,
    objects,
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
}

function tileDrawBase(pixels, width, height, tile, colors, mode) {
  const tx = (tile % TILESET_COLUMNS) * TILE;
  const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
  const [base, light, dark, sand, stone] = colors.map((color) => rgba(color));
  const water = rgba('#1e6578');
  const snow = rgba('#eee9d6');
  const ash = rgba('#756f66');
  const color = mode === 'water' ? water
    : mode === 'bank' ? sand
      : mode === 'stone' ? stone
        : mode === 'snow' ? snow
          : mode === 'ash' ? ash
            : mode === 'dark' ? dark
              : mode === 'light' ? light
                : base;
  fill(pixels, width, height, tx, ty, TILE, TILE, color);
  for (let i = 0; i < 40; i += 1) {
    const px = tx + Math.floor(hash(tile, i, 1) * TILE);
    const py = ty + Math.floor(hash(tile, i, 2) * TILE);
    const shade = blend(color, hash(tile, i, 3) > 0.5 ? light : dark, 0.28);
    put(pixels, width, height, px, py, shade);
    if (hash(tile, i, 4) > 0.7) put(pixels, width, height, px + 1, py, shade);
  }
}

function makeBiomeTilesheet(biome) {
  const width = TILE * TILESET_COLUMNS;
  const height = TILE * Math.ceil(TILESET_TILES / TILESET_COLUMNS);
  const pixels = Buffer.alloc(width * height * 4);
  for (let tile = 0; tile < TILESET_TILES; tile += 1) {
    const mode = tile + 1 === TILES.water ? 'water'
      : tile + 1 === TILES.bank ? 'bank'
        : [TILES.stone, TILES.mountain, TILES.cliff, TILES.rock, TILES.mine].includes(tile + 1) ? 'stone'
          : tile + 1 === TILES.mountainSnow || tile + 1 === TILES.snow ? 'snow'
            : tile + 1 === TILES.ash ? 'ash'
              : [TILES.dark, TILES.tree, TILES.treeAlt, TILES.pine, TILES.bush].includes(tile + 1) ? 'dark'
                : [TILES.roadLight, TILES.flowers, TILES.field, TILES.crop].includes(tile + 1) ? 'light'
                  : null;
    tileDrawBase(pixels, width, height, tile, biome.colors, mode);
    const tx = (tile % TILESET_COLUMNS) * TILE;
    const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
    if ([TILES.tree, TILES.treeAlt, TILES.pine].includes(tile + 1)) {
      fill(pixels, width, height, tx + 14, ty + 18, 4, 9, rgba('#6b4830'));
      for (let yy = 4; yy < 20; yy += 3) fill(pixels, width, height, tx + 8 + Math.floor(yy / 3), ty + yy, 16 - Math.floor(yy / 2), 4, rgba(biome.colors[2]));
    }
    if ([TILES.mountain, TILES.mountainSnow].includes(tile + 1)) {
      line(pixels, width, height, tx + 4, ty + 27, tx + 15, ty + 5, rgba('#efead8'));
      line(pixels, width, height, tx + 15, ty + 5, tx + 29, ty + 27, rgba('#595a54'));
      fill(pixels, width, height, tx + 11, ty + 8, 7, 5, rgba('#f2f1e8'));
    }
    if (tile + 1 === TILES.road || tile + 1 === TILES.roadLight) fill(pixels, width, height, tx, ty + 10, TILE, 12, rgba(biome.colors[3]));
    if (tile + 1 === TILES.plaza) {
      for (let yy = 0; yy < TILE; yy += 8) line(pixels, width, height, tx, ty + yy, tx + TILE - 1, ty + yy, rgba('#8d8878'));
      for (let xx = 0; xx < TILE; xx += 8) line(pixels, width, height, tx + xx, ty, tx + xx, ty + TILE - 1, rgba('#8d8878'));
    }
  }
  return encodePng(width, height, pixels);
}

function makeBuildingsTilesheet() {
  const width = TILE * TILESET_COLUMNS;
  const height = TILE * Math.ceil(TILESET_TILES / TILESET_COLUMNS);
  const pixels = Buffer.alloc(width * height * 4);
  const transparent = [0, 0, 0, 0];
  fill(pixels, width, height, 0, 0, width, height, transparent);
  const wall = rgba('#b78d58');
  const roof = rgba('#7d3431');
  const roofDark = rgba('#4f2628');
  const stone = rgba('#7f7b70');
  const wood = rgba('#6d4930');

  const drawPrefab = (startTile, tw, th, palette = 'house') => {
    const sx = (startTile % TILESET_COLUMNS) * TILE;
    const sy = Math.floor(startTile / TILESET_COLUMNS) * TILE;
    const w = tw * TILE;
    const h = th * TILE;
    fill(pixels, width, height, sx + 4, sy + 14, w - 8, h - 18, palette === 'stone' ? stone : wall);
    fill(pixels, width, height, sx + 2, sy + 7, w - 4, 13, palette === 'camp' ? rgba('#8b6b38') : roof);
    line(pixels, width, height, sx + 2, sy + 7, sx + Math.floor(w / 2), sy + 1, palette === 'stone' ? rgba('#d8d2bd') : roofDark);
    line(pixels, width, height, sx + Math.floor(w / 2), sy + 1, sx + w - 2, sy + 7, roofDark);
    fill(pixels, width, height, sx + Math.floor(w / 2) - 6, sy + h - 20, 12, 18, wood);
    for (let i = 0; i < tw; i += 1) {
      if (i === Math.floor(tw / 2)) continue;
      fill(pixels, width, height, sx + i * TILE + 10, sy + h - 34, 10, 11, rgba('#f1d38c'));
    }
    if (palette === 'stone') fill(pixels, width, height, sx + w - 22, sy + 2, 12, 28, stone);
  };

  drawPrefab(0, 4, 4, 'house');
  drawPrefab(32, 6, 5, 'inn');
  drawPrefab(96, 8, 7, 'stone');
  drawPrefab(160, 3, 3, 'camp');
  drawPrefab(192, 5, 5, 'stone');
  return encodePng(width, height, pixels);
}

function makePropsTilesheet() {
  const width = TILE * TILESET_COLUMNS;
  const height = TILE * Math.ceil(TILESET_TILES / TILESET_COLUMNS);
  const pixels = Buffer.alloc(width * height * 4);
  fill(pixels, width, height, 0, 0, width, height, [0, 0, 0, 0]);
  const props = [
    [0, '#6d4930'], [1, '#7b5635'], [2, '#a98242'], [3, '#b8ad7a'],
    [4, '#7e7c72'], [5, '#c6a15d'], [6, '#513d2c'], [7, '#8d5539'],
  ];
  for (const [tile, colorHex] of props) {
    const tx = (tile % TILESET_COLUMNS) * TILE;
    const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
    const color = rgba(colorHex);
    fill(pixels, width, height, tx + 8, ty + 12, 16, 14, color);
    fill(pixels, width, height, tx + 10, ty + 8, 12, 5, blend(color, rgba('#f2d990'), 0.35));
  }
  return encodePng(width, height, pixels);
}

function makeCollisionTilesheet() {
  const width = TILE;
  const height = TILE;
  const pixels = Buffer.alloc(width * height * 4);
  fill(pixels, width, height, 0, 0, width, height, rgba('#ff3b3b', 130));
  return encodePng(width, height, pixels);
}

function makeTsx(name, image, tileCount = TILESET_TILES, columns = TILESET_COLUMNS) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${name}" tilewidth="32" tileheight="32" tilecount="${tileCount}" columns="${columns}">
 <image source="../assets/tilesets/${image}" width="${columns * TILE}" height="${Math.ceil(tileCount / columns) * TILE}"/>
</tileset>
`;
}

function placeBuilding(region, gx, gy, startTile, w, h, name) {
  const x = gx - region.worldX;
  const y = gy - region.worldY;
  if (x < -w || y < -h || x >= REGION_TILES || y >= REGION_TILES) return;
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      const gidValue = BUILDINGS_FIRSTGID + startTile + yy * TILESET_COLUMNS + xx;
      setTile(region.decor, x + xx, y + yy, gidValue);
      setTile(region.collision, x + xx, y + yy, COLLISION_FIRSTGID);
    }
  }
  fillRectLayer(region.collision, x + Math.floor(w / 2) - 1, y + h - 1, 3, 2, 0);
  region.objects.decor.push(rectObject(name, x, y, w, h, { type: 'building' }));
}

function placeProp(region, gx, gy, localTile, solid = false) {
  const x = gx - region.worldX;
  const y = gy - region.worldY;
  if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) return;
  setTile(region.decor, x, y, PROPS_FIRSTGID + localTile);
  if (solid) setTile(region.collision, x, y, COLLISION_FIRSTGID);
}

function placeSettlement(region, landmark) {
  const localX = landmark.x - region.worldX;
  const localY = landmark.y - region.worldY;
  if (localX < -160 || localY < -160 || localX > REGION_TILES + 160 || localY > REGION_TILES + 160) return;
  const plans = landmark.kind === 'city'
    ? [
      [-5, -4, 96, 8, 7, 'stoneford_keep'],
      [-12, -8, 32, 6, 5, 'north_inn'],
      [8, -7, 32, 6, 5, 'east_inn'],
      [-14, 4, 0, 4, 4, 'market_house_w'],
      [-7, 7, 0, 4, 4, 'market_house_s'],
      [7, 6, 0, 4, 4, 'guild_house'],
      [15, 2, 192, 5, 5, 'watch_tower'],
      [-19, -1, 192, 5, 5, 'gate_tower'],
    ]
    : landmark.kind === 'fort'
      ? [[-4, -4, 192, 5, 5, `${landmark.id}_tower`], [4, 2, 0, 4, 4, `${landmark.id}_barracks`], [-9, 3, 0, 4, 4, `${landmark.id}_stable`]]
      : landmark.kind === 'camp'
        ? [[-3, -2, 160, 3, 3, `${landmark.id}_tent_a`], [3, -3, 160, 3, 3, `${landmark.id}_tent_b`], [-1, 4, 0, 4, 4, `${landmark.id}_supply`]]
        : landmark.kind === 'ruins'
          ? [[-5, -4, 192, 5, 5, `${landmark.id}_broken_tower`], [3, 2, 0, 4, 4, `${landmark.id}_collapsed_hall`]]
          : [[-5, -4, 32, 6, 5, `${landmark.id}_inn`], [4, -2, 0, 4, 4, `${landmark.id}_house_a`], [-9, 4, 0, 4, 4, `${landmark.id}_house_b`], [3, 6, 160, 3, 3, `${landmark.id}_shed`]];
  for (const [ox, oy, start, w, h, name] of plans) placeBuilding(region, landmark.x + ox, landmark.y + oy, start, w, h, name);
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    const px = Math.round(landmark.x + Math.cos(angle) * (landmark.radius * 0.5));
    const py = Math.round(landmark.y + Math.sin(angle) * (landmark.radius * 0.38));
    placeProp(region, px, py, i % 8, i % 4 === 0);
  }
}

function createRegion(rx, ry) {
  objectId = 1;
  const worldX = rx * REGION_TILES;
  const worldY = ry * REGION_TILES;
  const region = {
    rx,
    ry,
    worldX,
    worldY,
    ground: makeLayer(0),
    decor: makeLayer(0),
    collision: makeLayer(0),
    objects: {
      zones: [],
      transitions: [],
      spawns: [],
      starts: [],
      decor: [],
    },
  };

  for (let y = 0; y < REGION_TILES; y += 1) {
    for (let x = 0; x < REGION_TILES; x += 1) {
      const gx = worldX + x;
      const gy = worldY + y;
      const ground = groundTileFor(gx, gy);
      setTile(region.ground, x, y, ground);
      const localId = ((ground - 1) % TILESET_TILES) + 1;
      if (!isLand(gx, gy) || [TILES.mountain, TILES.mountainSnow].includes(localId)) setTile(region.collision, x, y, COLLISION_FIRSTGID);
      if (shouldPlaceNaturalProp(gx, gy)) {
        const prop = naturalPropTile(gx, gy);
        setTile(region.decor, x, y, prop);
        const propLocalId = ((prop - 1) % TILESET_TILES) + 1;
        if ([TILES.tree, TILES.treeAlt, TILES.pine, TILES.rock, TILES.mine].includes(propLocalId)) setTile(region.collision, x, y, COLLISION_FIRSTGID);
      }
    }
  }

  for (const landmark of LANDMARKS) placeSettlement(region, landmark);

  for (const biome of BIOMES) {
    const xs = [];
    const ys = [];
    for (let sy = 0; sy < REGION_TILES; sy += 40) {
      for (let sx = 0; sx < REGION_TILES; sx += 40) {
        const gx = worldX + sx;
        const gy = worldY + sy;
        if (isLand(gx, gy) && biomeFor(gx, gy).id === biome.id) {
          xs.push(sx);
          ys.push(sy);
        }
      }
    }
    if (xs.length) {
      const minX = Math.max(0, Math.min(...xs) - 24);
      const minY = Math.max(0, Math.min(...ys) - 24);
      const maxX = Math.min(REGION_TILES, Math.max(...xs) + 64);
      const maxY = Math.min(REGION_TILES, Math.max(...ys) + 64);
      region.objects.zones.push(rectObject(`${biome.id}_${rx}_${ry}`, minX, minY, maxX - minX, maxY - minY, {
        label: biome.name,
        zoneId: biome.id,
        recommendedLevel: biome.level,
      }));
      if (xs.length > 15) {
        region.objects.spawns.push(rectObject(`${biome.id}_spawn_${rx}_${ry}`, minX + 24, minY + 24, Math.max(18, Math.floor((maxX - minX) * 0.45)), Math.max(18, Math.floor((maxY - minY) * 0.35)), {
          enemyType: biome.enemyType,
          recommendedLevel: biome.level,
          maxEnemies: 8,
          respawnMs: 12000,
        }));
      }
    }
  }

  const regionRight = worldX + REGION_TILES;
  const regionBottom = worldY + REGION_TILES;
  for (const road of ROADS) {
    for (let i = 0; i < road.length - 1; i += 1) {
      const [ax, ay] = road[i];
      const [bx, by] = road[i + 1];
      const minX = Math.min(ax, bx);
      const minY = Math.min(ay, by);
      const maxX = Math.max(ax, bx);
      const maxY = Math.max(ay, by);
      if (maxX >= worldX && minX <= regionRight && maxY >= worldY && minY <= regionBottom) {
        const cx = Math.max(0, Math.min(REGION_TILES - 1, Math.round(((ax + bx) / 2) - worldX)));
        const cy = Math.max(0, Math.min(REGION_TILES - 1, Math.round(((ay + by) / 2) - worldY)));
        region.objects.transitions.push(rectObject(`road_transition_${rx}_${ry}_${i}`, cx - 8, cy - 8, 16, 16, {
          transitionType: 'seamless_road',
          fromRegion: `${rx}_${ry}`,
        }));
      }
    }
  }

  for (const landmark of LANDMARKS) {
    if (landmark.x >= worldX && landmark.y >= worldY && landmark.x < regionRight && landmark.y < regionBottom) {
      region.objects.starts.push(pointObject(`${landmark.id}_arrival`, landmark.x - worldX, landmark.y - worldY, {
        worldX: landmark.x,
        worldY: landmark.y,
        label: landmark.name,
        kind: landmark.kind,
      }));
    }
  }

  return region;
}

function makeMap(region) {
  return {
    compressionlevel: -1,
    height: REGION_TILES,
    infinite: false,
    layers: [
      makeTileLayer('Ground', 1, region.ground),
      makeTileLayer('Decor', 2, region.decor),
      makeTileLayer('Collision', 3, region.collision, false),
      makeObjectLayer('Zones', 4, region.objects.zones),
      makeObjectLayer('Transitions', 5, region.objects.transitions),
      makeObjectLayer('EnemySpawns', 6, region.objects.spawns),
      makeObjectLayer('RaceStart', 7, region.objects.starts),
      makeObjectLayer('DecorObjects', 8, region.objects.decor),
    ],
    nextlayerid: 9,
    nextobjectid: objectId + 1,
    orientation: 'orthogonal',
    properties: [
      { name: 'regionX', type: 'int', value: region.rx },
      { name: 'regionY', type: 'int', value: region.ry },
      { name: 'worldX', type: 'int', value: region.worldX },
      { name: 'worldY', type: 'int', value: region.worldY },
      { name: 'testMap', type: 'bool', value: true },
    ],
    renderorder: 'right-down',
    tiledversion: '1.11.2',
    tileheight: TILE,
    tilesets: [
      ...BIOMES.map((biome) => ({ firstgid: biome.firstgid, source: `../tilesets/world_test_${biome.id}.tsx` })),
      { firstgid: BUILDINGS_FIRSTGID, source: '../tilesets/world_test_buildings.tsx' },
      { firstgid: PROPS_FIRSTGID, source: '../tilesets/world_test_props.tsx' },
      { firstgid: COLLISION_FIRSTGID, source: '../tilesets/collision_debug_teszt.tsx' },
    ],
    tilewidth: TILE,
    type: 'map',
    version: '1.10',
    width: REGION_TILES,
  };
}

function makeWorldFile() {
  return {
    type: 'world',
    maps: Array.from({ length: REGION_GRID * REGION_GRID }, (_, index) => {
      const rx = index % REGION_GRID;
      const ry = Math.floor(index / REGION_GRID);
      return {
        fileName: `world_region_${rx}_${ry}_teszt.tmj`,
        x: rx * REGION_TILES * TILE,
        y: ry * REGION_TILES * TILE,
        width: REGION_TILES * TILE,
        height: REGION_TILES * TILE,
      };
    }),
    onlyShowAdjacentMaps: false,
    patterns: [],
  };
}

function makeRegistry() {
  return {
    tileSize: TILE,
    worldTiles: { width: WORLD_TILES, height: WORLD_TILES },
    regionTiles: { width: REGION_TILES, height: REGION_TILES },
    regions: Array.from({ length: REGION_GRID * REGION_GRID }, (_, index) => {
      const rx = index % REGION_GRID;
      const ry = Math.floor(index / REGION_GRID);
      return {
        id: `world_region_${rx}_${ry}`,
        file: `world_region_${rx}_${ry}_teszt.tmj`,
        x: rx * REGION_TILES,
        y: ry * REGION_TILES,
        width: REGION_TILES,
        height: REGION_TILES,
      };
    }),
    zones: BIOMES.map((biome) => ({
      id: biome.id,
      name: biome.name,
      recommendedLevel: biome.level,
      enemyType: biome.enemyType,
    })),
    landmarks: LANDMARKS,
  };
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  await Promise.all([
    fs.mkdir(mapsDir, { recursive: true }),
    fs.mkdir(tilesetsDir, { recursive: true }),
    fs.mkdir(assetTilesetsDir, { recursive: true }),
    fs.mkdir(docsDir, { recursive: true }),
  ]);

  await Promise.all([
    ...BIOMES.flatMap((biome) => [
      fs.writeFile(path.join(assetTilesetsDir, `world_test_${biome.id}.png`), makeBiomeTilesheet(biome)),
      fs.writeFile(path.join(tilesetsDir, `world_test_${biome.id}.tsx`), makeTsx(`world_test_${biome.id}`, `world_test_${biome.id}.png`)),
    ]),
    fs.writeFile(path.join(assetTilesetsDir, 'world_test_buildings.png'), makeBuildingsTilesheet()),
    fs.writeFile(path.join(tilesetsDir, 'world_test_buildings.tsx'), makeTsx('world_test_buildings', 'world_test_buildings.png')),
    fs.writeFile(path.join(assetTilesetsDir, 'world_test_props.png'), makePropsTilesheet()),
    fs.writeFile(path.join(tilesetsDir, 'world_test_props.tsx'), makeTsx('world_test_props', 'world_test_props.png')),
    fs.writeFile(path.join(assetTilesetsDir, 'collision_debug_teszt.png'), makeCollisionTilesheet()),
    fs.writeFile(path.join(tilesetsDir, 'collision_debug_teszt.tsx'), makeTsx('collision_debug_teszt', 'collision_debug_teszt.png', 1, 1)),
  ]);

  for (let ry = 0; ry < REGION_GRID; ry += 1) {
    for (let rx = 0; rx < REGION_GRID; rx += 1) {
      const region = createRegion(rx, ry);
      await writeJson(path.join(mapsDir, `world_region_${rx}_${ry}_teszt.tmj`), makeMap(region));
    }
  }

  await writeJson(path.join(mapsDir, 'world_continent_teszt.world'), makeWorldFile());
  await writeJson(path.join(mapsDir, 'world_regions_teszt.json'), makeRegistry());

  const notes = `# Region-Based World Map Teszt

- World size: 4000x4000 tiles, 32px tiles.
- Region split: 5x5 files, each 800x800 tiles.
- Tiled world file: \`public/maps/world_continent_teszt.world\`
- Region registry: \`public/maps/world_regions_teszt.json\`
- Region files: \`public/maps/world_region_X_Y_teszt.tmj\`

The region maps are generated from global world coordinates, so terrain, roads, coastlines, and biome transitions line up across file borders.

## Biome Zones

${BIOMES.map((biome) => `- \`${biome.id}\`: ${biome.name}, level ${biome.level}, enemy \`${biome.enemyType}\`, tileset \`world_test_${biome.id}.tsx\``).join('\n')}

## Settlements And Landmarks

${LANDMARKS.map((landmark) => `- \`${landmark.id}\`: ${landmark.name}, ${landmark.kind}, world tile ${landmark.x},${landmark.y}`).join('\n')}

## Editing Notes

- Open \`world_continent_teszt.world\` in Tiled to see all regions together.
- Edit one 800x800 region at a time for performance.
- Tile layers use Tiled \`base64\` + \`zlib\` compression to keep files small; the current game runtime will need loader support before these test regions can be played directly.
- If a border is edited by hand, mirror the same edge detail in the neighboring region or regenerate both from the script.
- Larger buildings are coherent multi-tile prefabs from \`world_test_buildings.tsx\`, not repeated 1x1 single-house tiles.
`;
  await fs.writeFile(path.join(docsDir, 'world_map_teszt_notes.md'), notes);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
