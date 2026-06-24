import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const mapsDir = path.join(publicDir, 'maps');
const previewsDir = path.join(mapsDir, 'previews');
const tilesetsDir = path.join(publicDir, 'tilesets');
const assetTilesetsDir = path.join(publicDir, 'assets', 'tilesets');
const docsDir = path.join(rootDir, 'docs');

const TILE = 32;
const REGION_TILES = 800;
const REGION_GRID = 5;
const WORLD_TILES = REGION_TILES * REGION_GRID;
const TILESET_COLUMNS = 16;
const TILESET_ROWS = 2;
const TILESET_TILES = TILESET_COLUMNS * TILESET_ROWS;
const WORLD_ID = 'world-box-teszt';
const FILE_PREFIX = 'world-box-teszt';

const TILES = {
  oceanDeep: 0,
  oceanDark: 1,
  oceanMid: 2,
  oceanShallow: 3,
  coastFoam: 4,
  sand: 5,
  rockyShore: 6,
  grassDark: 7,
  grass: 8,
  grassLight: 9,
  forest: 10,
  denseForest: 11,
  oldForest: 12,
  hill: 13,
  rock: 14,
  mountain: 15,
  mountainSnow: 16,
  crystalField: 17,
  lake: 18,
  lakeEdge: 19,
  marshWater: 20,
  marshGrass: 21,
  ashDark: 22,
  ashRock: 23,
  mud: 24,
  tundra: 25,
  moss: 26,
  reef: 27,
  cloudShadow: 28,
  deepForestSpeckle: 29,
  wetGrass: 30,
  collision: 31,
};

const REGION_THEMES = [
  ['Northwest Deep Sea', 'ocean', 'open dark ocean and shallow shelf'],
  ['Western Crownwood', 'forest', 'northern old forest mass from the reference layout'],
  ['North Gate Channel', 'coast', 'broken coast and northern sea channel'],
  ['Crystal Crown', 'crystal_mountain', 'snowy purple crystal ridge'],
  ['Northeast Wildwood', 'old_forest', 'green eastern peninsula'],
  ['Westwatch Coast', 'forest_coast', 'western coastal forest and cliffs'],
  ['Central Greenbelt', 'dense_forest', 'continuous forest core'],
  ['Grey Spine', 'mountain', 'grey mountain belt and upland pass'],
  ['Eastern Inlet', 'coast', 'inner sea inlet and shore wetlands'],
  ['East Hook Coast', 'forest_coast', 'curved eastern shore and shallow bay'],
  ['Southwest Woods', 'dense_forest', 'large south-west woodland lobe'],
  ['Obsidian Scar', 'ashlands', 'dark volcanic scar in the central woods'],
  ['Bluefen Basin', 'lake_forest', 'small lake basin and wet forest'],
  ['Inner Bay', 'coast', 'major inner bay dividing the island'],
  ['Eastfen Woods', 'swamp_forest', 'wet forest toward the eastern lobe'],
  ['Western Shelf', 'coast', 'southern western shelf and beaches'],
  ['South Greenreach', 'forest', 'lower forest transition and coves'],
  ['Darkroot Hollow', 'ashlands', 'southern dark hollow and black stone'],
  ['Southfen Coast', 'swamp', 'mossy bay and marsh coast'],
  ['Southeast Wilds', 'old_forest', 'isolated eastern green lobe'],
  ['Far South Sea', 'ocean', 'southern ocean and island shelf'],
  ['Little South Isle', 'island_forest', 'separate southern island'],
  ['South Cape', 'coast_forest', 'long southern cape of the main landmass'],
  ['Southeast Lagoon', 'coast', 'large lagoon and broken coast'],
  ['Far East Sea', 'ocean', 'outer ocean beyond the eastern lobe'],
].map(([displayName, biomeType, description], index) => ({
  rx: index % REGION_GRID,
  ry: Math.floor(index / REGION_GRID),
  zoneId: `world_box_${index % REGION_GRID}_${Math.floor(index / REGION_GRID)}`,
  displayName,
  biomeType,
  description,
}));

function gid(tile) {
  return tile + 1;
}

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
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function rgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16), alpha];
}

function mix(a, b, amount) {
  return [
    Math.round(a[0] * (1 - amount) + b[0] * amount),
    Math.round(a[1] * (1 - amount) + b[1] * amount),
    Math.round(a[2] * (1 - amount) + b[2] * amount),
    Math.round(a[3] * (1 - amount) + b[3] * amount),
  ];
}

function put(pixels, width, height, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const p = (Math.floor(y) * width + Math.floor(x)) * 4;
  pixels[p] = color[0];
  pixels[p + 1] = color[1];
  pixels[p + 2] = color[2];
  pixels[p + 3] = color[3];
}

function fill(pixels, width, height, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) put(pixels, width, height, xx, yy, color);
  }
}

function rect(pixels, width, height, x, y, w, h, color) {
  fill(pixels, width, height, x, y, w, 1, color);
  fill(pixels, width, height, x, y + h - 1, w, 1, color);
  fill(pixels, width, height, x, y, 1, h, color);
  fill(pixels, width, height, x + w - 1, y, 1, h, color);
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
  let n = Math.imul(Math.floor(x) + 374761393, 668265263)
    ^ Math.imul(Math.floor(y) + 1274126177, 2246822519)
    ^ Math.imul(salt + 1013904223, 374761393);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function valueNoise(x, y, scale, salt = 0) {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = smoothstep(gx - x0);
  const ty = smoothstep(gy - y0);
  const a = hash(x0, y0, salt);
  const b = hash(x0 + 1, y0, salt);
  const c = hash(x0, y0 + 1, salt);
  const d = hash(x0 + 1, y0 + 1, salt);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

function fbm(x, y, salt = 0) {
  return valueNoise(x, y, 260, salt) * 0.48
    + valueNoise(x, y, 120, salt + 11) * 0.28
    + valueNoise(x, y, 58, salt + 23) * 0.16
    + valueNoise(x, y, 26, salt + 37) * 0.08;
}

function softEllipse(x, y, cx, cy, rx, ry) {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return 1 - (nx * nx + ny * ny);
}

function distPointToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const cx = ax + vx * t;
  const cy = ay + vy * t;
  return Math.hypot(px - cx, py - cy);
}

function distanceToPolyline(x, y, points) {
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    best = Math.min(best, distPointToSegment(x, y, ax, ay, bx, by));
  }
  return best;
}

function landScore(x, y) {
  const masses = Math.max(
    softEllipse(x, y, 1080, 1680, 680, 1120),
    softEllipse(x, y, 1320, 940, 470, 460),
    softEllipse(x, y, 1950, 1640, 770, 510),
    softEllipse(x, y, 2350, 980, 560, 790),
    softEllipse(x, y, 3180, 1220, 720, 470),
    softEllipse(x, y, 2250, 2620, 730, 870),
    softEllipse(x, y, 980, 2560, 560, 730),
    softEllipse(x, y, 3130, 2620, 600, 670),
    softEllipse(x, y, 1420, 3440, 270, 220),
  );
  const bridges = Math.max(
    softEllipse(x, y, 1700, 1500, 620, 280),
    softEllipse(x, y, 2660, 1510, 620, 240),
    softEllipse(x, y, 2550, 2250, 530, 380),
    softEllipse(x, y, 1500, 2740, 570, 300),
  ) * 0.36;
  const cuts = Math.max(
    softEllipse(x, y, 1770, 850, 460, 350) * 0.95,
    softEllipse(x, y, 1710, 1270, 330, 240) * 0.72,
    softEllipse(x, y, 2740, 1910, 285, 530) * 1.12,
    softEllipse(x, y, 1690, 3030, 560, 335) * 0.82,
    softEllipse(x, y, 3080, 3190, 300, 470) * 0.82,
    softEllipse(x, y, 3490, 1920, 430, 350) * 0.7,
    softEllipse(x, y, 1000, 3380, 310, 250) * 0.55,
  );
  const coastNoise = (fbm(x, y, 910) - 0.5) * 0.46 + (fbm(x + 400, y - 280, 1120) - 0.5) * 0.2;
  return masses + bridges - Math.max(0, cuts) + coastNoise;
}

function lakeScore(x, y) {
  return Math.max(
    softEllipse(x, y, 2100, 2020, 145, 65),
    softEllipse(x, y, 2920, 2530, 105, 190),
    softEllipse(x, y, 3220, 2860, 150, 240),
    softEllipse(x, y, 2540, 1180, 88, 145) * 0.72,
  );
}

function mountainScore(x, y) {
  const greySpine = Math.max(0, 1 - distanceToPolyline(x, y, [
    [1660, 1450],
    [2040, 1390],
    [2380, 1450],
    [2670, 1630],
    [2970, 1590],
  ]) / 155);
  const southRidge = Math.max(0, 1 - distanceToPolyline(x, y, [
    [1600, 2380],
    [1960, 2470],
    [2320, 2440],
  ]) / 125);
  return Math.max(
    greySpine,
    southRidge * 0.75,
    softEllipse(x, y, 3300, 1410, 170, 86) * 0.65,
  ) + (fbm(x, y, 3001) - 0.5) * 0.25;
}

function crystalScore(x, y) {
  const ridge = Math.max(0, 1 - distanceToPolyline(x, y, [
    [2520, 760],
    [2600, 1010],
    [2580, 1280],
    [2650, 1510],
  ]) / 125);
  return ridge + softEllipse(x, y, 2540, 1190, 135, 300) * 0.55 + (fbm(x, y, 4404) - 0.5) * 0.28;
}

function ashScore(x, y) {
  return Math.max(
    softEllipse(x, y, 1450, 2050, 360, 220),
    softEllipse(x, y, 1850, 1970, 300, 170) * 0.85,
    softEllipse(x, y, 2040, 2860, 250, 340) * 0.78,
    softEllipse(x, y, 3290, 2630, 150, 270) * 0.6,
  ) + (fbm(x, y, 5555) - 0.5) * 0.22;
}

function swampScore(x, y) {
  return Math.max(
    softEllipse(x, y, 3120, 2530, 600, 610),
    softEllipse(x, y, 2870, 3020, 440, 360),
    softEllipse(x, y, 2290, 2100, 300, 220) * 0.46,
  ) + (fbm(x, y, 6400) - 0.5) * 0.2;
}

function forestScore(x, y) {
  return Math.max(
    softEllipse(x, y, 1160, 1180, 850, 880),
    softEllipse(x, y, 910, 2410, 660, 760),
    softEllipse(x, y, 3210, 1210, 720, 520),
    softEllipse(x, y, 3180, 2620, 590, 620),
    softEllipse(x, y, 1400, 3440, 280, 230),
  ) + (fbm(x, y, 7300) - 0.5) * 0.5;
}

function classifyTile(x, y) {
  const score = landScore(x, y);
  const lake = lakeScore(x, y);
  const lakeNoise = (fbm(x, y, 8008) - 0.5) * 0.18;
  const isLake = score > 0.08 && lake + lakeNoise > 0.02;

  if (isLake) {
    const edge = lake + lakeNoise < 0.13;
    return {
      ground: edge ? TILES.wetGrass : TILES.grassDark,
      water: edge ? TILES.lakeEdge : TILES.lake,
      detail: 0,
      collision: true,
      preview: edge ? '#22495f' : '#12355a',
    };
  }

  if (score <= 0.08) {
    if (score > -0.08) {
      return { ground: TILES.oceanMid, water: TILES.oceanShallow, detail: 0, collision: true, preview: '#14355d' };
    }
    if (score > -0.18) {
      return { ground: TILES.oceanDark, water: TILES.oceanMid, detail: 0, collision: true, preview: '#10294d' };
    }
    return { ground: TILES.oceanDeep, water: 0, detail: 0, collision: true, preview: '#071b3b' };
  }

  const coast = score < 0.19;
  if (coast) {
    const rocky = fbm(x, y, 777) > 0.56;
    return {
      ground: rocky ? TILES.rockyShore : TILES.sand,
      water: score < 0.13 ? TILES.coastFoam : 0,
      detail: rocky ? TILES.reef : 0,
      collision: false,
      preview: rocky ? '#60664b' : '#8e7b48',
    };
  }

  const crystal = crystalScore(x, y);
  if (crystal > 0.42) {
    const snow = crystal > 0.78 || fbm(x, y, 4711) > 0.68;
    return {
      ground: snow ? TILES.mountainSnow : TILES.mountain,
      water: 0,
      detail: TILES.crystalField,
      collision: false,
      preview: snow ? '#9aa8b7' : '#7b62d9',
    };
  }

  const mountain = mountainScore(x, y);
  if (mountain > 0.32) {
    const high = mountain > 0.68 || fbm(x, y, 3002) > 0.73;
    return {
      ground: high ? TILES.mountain : TILES.rock,
      water: 0,
      detail: high ? TILES.mountainSnow : TILES.hill,
      collision: false,
      preview: high ? '#596066' : '#70725f',
    };
  }

  const ash = ashScore(x, y);
  if (ash > 0.28) {
    const cracked = ash > 0.58 || fbm(x, y, 5656) > 0.72;
    return {
      ground: cracked ? TILES.ashDark : TILES.ashRock,
      water: 0,
      detail: cracked ? TILES.cloudShadow : 0,
      collision: false,
      preview: cracked ? '#111924' : '#26303a',
    };
  }

  const swamp = swampScore(x, y);
  if (swamp > 0.32) {
    const wet = fbm(x, y, 6600) > 0.64;
    return {
      ground: wet ? TILES.marshGrass : TILES.wetGrass,
      water: wet && hash(x, y, 6060) > 0.74 ? TILES.marshWater : 0,
      detail: wet ? TILES.moss : TILES.marshGrass,
      collision: wet && hash(x + 9, y - 4, 6061) > 0.86,
      preview: wet ? '#274938' : '#3d603c',
    };
  }

  const forest = forestScore(x, y);
  if (forest > 0.28) {
    const n = fbm(x, y, 7400);
    return {
      ground: n > 0.64 ? TILES.grassDark : TILES.grass,
      water: 0,
      detail: n > 0.72 ? TILES.denseForest : n > 0.52 ? TILES.forest : TILES.deepForestSpeckle,
      collision: false,
      preview: n > 0.62 ? '#14361e' : '#25542e',
    };
  }

  const n = fbm(x, y, 8800);
  if (n > 0.72) return { ground: TILES.grassDark, water: 0, detail: TILES.moss, collision: false, preview: '#2f5a31' };
  if (n > 0.52) return { ground: TILES.grass, water: 0, detail: TILES.wetGrass, collision: false, preview: '#3f6d36' };
  return { ground: TILES.grassLight, water: 0, detail: 0, collision: false, preview: '#5d773d' };
}

function makeLayer(fillValue = 0) {
  const data = new Uint32Array(REGION_TILES * REGION_TILES);
  if (fillValue) data.fill(fillValue);
  return data;
}

function encodeTileData(data) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let i = 0; i < data.length; i += 1) buffer.writeUInt32LE(data[i] >>> 0, i * 4);
  return zlib.deflateSync(buffer, { level: 6 }).toString('base64');
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
    type: typeof value === 'number' ? 'int' : typeof value === 'boolean' ? 'bool' : 'string',
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

function makeObjectLayer(name, id, objects = []) {
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

function makeRegion(rx, ry) {
  const theme = REGION_THEMES[ry * REGION_GRID + rx];
  const region = {
    rx,
    ry,
    worldX: rx * REGION_TILES,
    worldY: ry * REGION_TILES,
    theme,
    ground: makeLayer(),
    water: makeLayer(),
    terrainDetails: makeLayer(),
    roads: makeLayer(),
    decor: makeLayer(),
    buildings: makeLayer(),
    collision: makeLayer(),
  };

  for (let y = 0; y < REGION_TILES; y += 1) {
    const gy = region.worldY + y;
    for (let x = 0; x < REGION_TILES; x += 1) {
      const gx = region.worldX + x;
      const info = classifyTile(gx, gy);
      const index = y * REGION_TILES + x;
      region.ground[index] = gid(info.ground);
      if (info.water) region.water[index] = gid(info.water);
      if (info.detail) region.terrainDetails[index] = gid(info.detail);
      if (info.collision) region.collision[index] = gid(TILES.collision);
    }
  }

  return region;
}

function makeMap(region) {
  const marker = rectObject(`region_marker_${region.rx}_${region.ry}`, 0, 0, REGION_TILES, REGION_TILES, {
    type: 'regionMarker',
    zoneId: region.theme.zoneId,
    displayName: region.theme.displayName,
    biomeType: region.theme.biomeType,
    showOnMap: true,
    debugOnly: true,
  });

  return {
    compressionlevel: -1,
    height: REGION_TILES,
    infinite: false,
    layers: [
      makeTileLayer('Ground', 1, region.ground),
      makeTileLayer('Water', 2, region.water),
      makeTileLayer('TerrainDetails', 3, region.terrainDetails),
      makeTileLayer('Roads', 4, region.roads),
      makeTileLayer('Decor', 5, region.decor),
      makeTileLayer('Buildings', 6, region.buildings),
      makeTileLayer('Collision', 7, region.collision, false),
      makeObjectLayer('RegionMarkers', 8, [marker]),
      makeObjectLayer('RoadMarkers', 9, []),
      makeObjectLayer('Landmarks', 10, []),
      makeObjectLayer('Transitions', 11, []),
    ],
    nextlayerid: 12,
    nextobjectid: objectId + 1,
    orientation: 'orthogonal',
    properties: [
      { name: 'regionX', type: 'int', value: region.rx },
      { name: 'regionY', type: 'int', value: region.ry },
      { name: 'worldX', type: 'int', value: region.worldX },
      { name: 'worldY', type: 'int', value: region.worldY },
      { name: 'zoneId', type: 'string', value: region.theme.zoneId },
      { name: 'displayName', type: 'string', value: region.theme.displayName },
      { name: 'biomeType', type: 'string', value: region.theme.biomeType },
      { name: 'description', type: 'string', value: region.theme.description },
      { name: 'worldVersion', type: 'string', value: WORLD_ID },
    ],
    renderorder: 'right-down',
    tiledversion: '1.11.2',
    tileheight: TILE,
    tilesets: [
      { firstgid: 1, source: `../tilesets/${FILE_PREFIX}-terrain.tsx` },
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
        fileName: `${FILE_PREFIX}-region_${rx}_${ry}.tmj`,
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
    version: WORLD_ID,
    tileSize: TILE,
    worldTiles: { width: WORLD_TILES, height: WORLD_TILES },
    regionTiles: { width: REGION_TILES, height: REGION_TILES },
    regions: REGION_THEMES.map((theme) => ({
      id: `${FILE_PREFIX}-region_${theme.rx}_${theme.ry}`,
      zoneId: theme.zoneId,
      file: `${FILE_PREFIX}-region_${theme.rx}_${theme.ry}.tmj`,
      x: theme.rx * REGION_TILES,
      y: theme.ry * REGION_TILES,
      width: REGION_TILES,
      height: REGION_TILES,
      displayName: theme.displayName,
      biomeType: theme.biomeType,
      description: theme.description,
    })),
    tilesets: [
      { firstgid: 1, source: `../tilesets/${FILE_PREFIX}-terrain.tsx` },
    ],
    note: 'Terrain-only WorldBox-style test map. No cities, NPCs, enemies, gameplay props, roads, or transitions are generated.',
  };
}

function tileOrigin(tile) {
  return [(tile % TILESET_COLUMNS) * TILE, Math.floor(tile / TILESET_COLUMNS) * TILE];
}

function drawNoiseTile(pixels, width, height, tile, baseHex, lightHex, darkHex, salt, speckles = 58) {
  const [ox, oy] = tileOrigin(tile);
  const base = rgba(baseHex);
  const light = rgba(lightHex);
  const dark = rgba(darkHex);
  fill(pixels, width, height, ox, oy, TILE, TILE, base);
  for (let i = 0; i < speckles; i += 1) {
    const x = Math.floor(hash(i, tile, salt) * TILE);
    const y = Math.floor(hash(i + 99, tile, salt) * TILE);
    const amount = hash(i + 123, tile, salt) > 0.5 ? 0.42 : 0.34;
    const color = hash(i + 777, tile, salt) > 0.5 ? mix(base, light, amount) : mix(base, dark, amount);
    put(pixels, width, height, ox + x, oy + y, color);
    if (hash(i + 12, tile, salt) > 0.72) put(pixels, width, height, ox + Math.min(TILE - 1, x + 1), oy + y, color);
  }
}

function drawBlobTile(pixels, width, height, tile, baseHex, blobHex, salt) {
  drawNoiseTile(pixels, width, height, tile, baseHex, '#537a3e', '#183018', salt, 42);
  const [ox, oy] = tileOrigin(tile);
  const blob = rgba(blobHex);
  const shade = mix(blob, rgba('#000000'), 0.28);
  for (let i = 0; i < 9; i += 1) {
    const cx = ox + 3 + Math.floor(hash(i, tile, salt + 1) * 26);
    const cy = oy + 3 + Math.floor(hash(i + 30, tile, salt + 1) * 26);
    const r = 2 + Math.floor(hash(i + 60, tile, salt + 1) * 4);
    for (let yy = -r; yy <= r; yy += 1) {
      for (let xx = -r; xx <= r; xx += 1) {
        if (xx * xx + yy * yy <= r * r) put(pixels, width, height, cx + xx, cy + yy, blob);
      }
    }
    put(pixels, width, height, cx - 1, cy + r, shade);
    put(pixels, width, height, cx, cy + r, shade);
  }
}

function drawRockTile(pixels, width, height, tile, baseHex, lightHex, darkHex, salt) {
  drawNoiseTile(pixels, width, height, tile, baseHex, lightHex, darkHex, salt, 34);
  const [ox, oy] = tileOrigin(tile);
  const light = rgba(lightHex);
  const dark = rgba(darkHex);
  for (let i = 0; i < 6; i += 1) {
    const x = ox + 4 + Math.floor(hash(i, tile, salt + 2) * 23);
    const y = oy + 4 + Math.floor(hash(i + 40, tile, salt + 2) * 22);
    line(pixels, width, height, x - 3, y + 3, x, y - 3, light);
    line(pixels, width, height, x, y - 3, x + 4, y + 3, dark);
    line(pixels, width, height, x - 3, y + 3, x + 4, y + 3, dark);
  }
}

function drawWaterTile(pixels, width, height, tile, baseHex, lightHex, darkHex, salt) {
  drawNoiseTile(pixels, width, height, tile, baseHex, lightHex, darkHex, salt, 22);
  const [ox, oy] = tileOrigin(tile);
  const wave = rgba(lightHex, 190);
  for (let i = 0; i < 4; i += 1) {
    const y = oy + 5 + i * 7 + Math.floor(hash(i, tile, salt + 7) * 3);
    const x = ox + Math.floor(hash(i + 90, tile, salt + 7) * 12);
    line(pixels, width, height, x, y, x + 7, y, wave);
    if (hash(i, tile, salt + 9) > 0.42) line(pixels, width, height, x + 12, y + 1, x + 18, y + 1, wave);
  }
}

function drawCrystalTile(pixels, width, height, tile) {
  drawRockTile(pixels, width, height, tile, '#38485d', '#93a3b8', '#1d2533', 1700);
  const [ox, oy] = tileOrigin(tile);
  const glow = rgba('#58e3ff');
  const purple = rgba('#9a73ff');
  const white = rgba('#d5efff');
  for (let i = 0; i < 5; i += 1) {
    const x = ox + 5 + Math.floor(hash(i, tile, 1701) * 21);
    const y = oy + 8 + Math.floor(hash(i + 2, tile, 1701) * 17);
    const h = 7 + Math.floor(hash(i + 4, tile, 1701) * 10);
    line(pixels, width, height, x, y, x + 2, y - h, white);
    line(pixels, width, height, x + 2, y - h, x + 5, y, purple);
    line(pixels, width, height, x, y, x + 5, y, glow);
    put(pixels, width, height, x + 2, y - Math.floor(h / 2), glow);
  }
}

function drawTilesheet() {
  const width = TILESET_COLUMNS * TILE;
  const height = TILESET_ROWS * TILE;
  const pixels = Buffer.alloc(width * height * 4);
  fill(pixels, width, height, 0, 0, width, height, rgba('#ff00ff', 0));

  drawWaterTile(pixels, width, height, TILES.oceanDeep, '#071b3b', '#12365e', '#031027', 100);
  drawWaterTile(pixels, width, height, TILES.oceanDark, '#0a2144', '#1b4169', '#06142d', 101);
  drawWaterTile(pixels, width, height, TILES.oceanMid, '#0e3159', '#24537d', '#082242', 102);
  drawWaterTile(pixels, width, height, TILES.oceanShallow, '#164a6e', '#35789a', '#0c2d49', 103);
  drawWaterTile(pixels, width, height, TILES.coastFoam, '#245a74', '#87b5bf', '#0f354c', 104);
  drawNoiseTile(pixels, width, height, TILES.sand, '#807340', '#b3a764', '#4f4a31', 200);
  drawRockTile(pixels, width, height, TILES.rockyShore, '#586148', '#879174', '#323a32', 201);
  drawNoiseTile(pixels, width, height, TILES.grassDark, '#254b25', '#386b32', '#102711', 300);
  drawNoiseTile(pixels, width, height, TILES.grass, '#38642f', '#5e8744', '#1d3a1e', 301);
  drawNoiseTile(pixels, width, height, TILES.grassLight, '#526f36', '#7e9650', '#314222', 302);
  drawBlobTile(pixels, width, height, TILES.forest, '#264722', '#123518', 400);
  drawBlobTile(pixels, width, height, TILES.denseForest, '#173016', '#08210f', 401);
  drawBlobTile(pixels, width, height, TILES.oldForest, '#1c2d16', '#07190c', 402);
  drawRockTile(pixels, width, height, TILES.hill, '#566445', '#81906b', '#2f382d', 500);
  drawRockTile(pixels, width, height, TILES.rock, '#60665e', '#8e9588', '#373d39', 501);
  drawRockTile(pixels, width, height, TILES.mountain, '#4b535b', '#838d93', '#222932', 502);
  drawRockTile(pixels, width, height, TILES.mountainSnow, '#7d8a92', '#d1dce2', '#3f4b55', 503);
  drawCrystalTile(pixels, width, height, TILES.crystalField);
  drawWaterTile(pixels, width, height, TILES.lake, '#12355a', '#3e7ca2', '#071f38', 600);
  drawWaterTile(pixels, width, height, TILES.lakeEdge, '#22495f', '#6fa0a7', '#16313d', 601);
  drawWaterTile(pixels, width, height, TILES.marshWater, '#203d35', '#527d69', '#10231f', 602);
  drawNoiseTile(pixels, width, height, TILES.marshGrass, '#334f34', '#5b7650', '#1c2d20', 603);
  drawNoiseTile(pixels, width, height, TILES.ashDark, '#111924', '#2a3541', '#05080d', 700);
  drawRockTile(pixels, width, height, TILES.ashRock, '#27313a', '#4d5963', '#10161c', 701);
  drawNoiseTile(pixels, width, height, TILES.mud, '#4f4432', '#746248', '#2a241c', 800);
  drawNoiseTile(pixels, width, height, TILES.tundra, '#66716b', '#99a59b', '#3d4542', 801);
  drawNoiseTile(pixels, width, height, TILES.moss, '#375638', '#6f8c54', '#1d301f', 802);
  drawWaterTile(pixels, width, height, TILES.reef, '#184b54', '#62b1a7', '#0d2a34', 803);
  drawNoiseTile(pixels, width, height, TILES.cloudShadow, '#1a2230', '#384252', '#090d15', 804);
  drawBlobTile(pixels, width, height, TILES.deepForestSpeckle, '#1f3f1d', '#0c2c11', 805);
  drawNoiseTile(pixels, width, height, TILES.wetGrass, '#3b603e', '#67835b', '#223825', 806);

  const [cx, cy] = tileOrigin(TILES.collision);
  fill(pixels, width, height, cx, cy, TILE, TILE, rgba('#ff4a7a', 95));
  rect(pixels, width, height, cx + 1, cy + 1, TILE - 2, TILE - 2, rgba('#ffb0c3', 190));

  return encodePng(width, height, pixels);
}

function makeTsx() {
  const animations = [
    [TILES.oceanDeep, [TILES.oceanDeep, TILES.oceanDark, TILES.oceanDeep]],
    [TILES.oceanShallow, [TILES.oceanShallow, TILES.oceanMid, TILES.oceanShallow]],
    [TILES.lake, [TILES.lake, TILES.lakeEdge, TILES.lake]],
    [TILES.marshWater, [TILES.marshWater, TILES.wetGrass, TILES.marshWater]],
    [TILES.crystalField, [TILES.crystalField, TILES.mountainSnow, TILES.crystalField]],
  ].map(([tile, frames]) => ` <tile id="${tile}">
  <animation>
${frames.map((frame) => `   <frame tileid="${frame}" duration="260"/>`).join('\n')}
  </animation>
 </tile>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${FILE_PREFIX}-terrain" tilewidth="${TILE}" tileheight="${TILE}" tilecount="${TILESET_TILES}" columns="${TILESET_COLUMNS}">
 <image source="../assets/tilesets/${FILE_PREFIX}-terrain.png" width="${TILESET_COLUMNS * TILE}" height="${TILESET_ROWS * TILE}"/>
${animations}
</tileset>
`;
}

function makePreview() {
  const width = 1000;
  const height = 1000;
  const pixels = Buffer.alloc(width * height * 4);
  for (let py = 0; py < height; py += 1) {
    const gy = (py / height) * WORLD_TILES;
    for (let px = 0; px < width; px += 1) {
      const gx = (px / width) * WORLD_TILES;
      const color = rgba(classifyTile(gx, gy).preview);
      put(pixels, width, height, px, py, color);
    }
  }
  const grid = rgba('#ffffff', 55);
  for (let i = 1; i < REGION_GRID; i += 1) {
    const pos = Math.round((i / REGION_GRID) * width);
    line(pixels, width, height, pos, 0, pos, height - 1, grid);
    line(pixels, width, height, 0, pos, width - 1, pos, grid);
  }
  return encodePng(width, height, pixels);
}

function makeNotes() {
  return `# World Box Teszt

Terrain-only test world generated from the God-simulator-style reference layout.

## Files

- Tiled world: \`public/maps/${FILE_PREFIX}.world\`
- Region registry: \`public/maps/${FILE_PREFIX}-regions.json\`
- Regions: \`public/maps/${FILE_PREFIX}-region_X_Y.tmj\`
- Terrain tileset: \`public/tilesets/${FILE_PREFIX}-terrain.tsx\`
- Terrain image: \`public/assets/tilesets/${FILE_PREFIX}-terrain.png\`
- Preview: \`public/maps/previews/${FILE_PREFIX}-preview.png\`
- Generator: \`scripts/generate-world-box-teszt.mjs\`

## Size

- Logical world size: ${WORLD_TILES}x${WORLD_TILES} tiles
- Region grid: ${REGION_GRID}x${REGION_GRID}
- Region size: ${REGION_TILES}x${REGION_TILES} tiles
- Tile size: ${TILE}x${TILE}

## Layers

- \`Ground\`: ocean, coast, grass, forest, ash, mountain base
- \`Water\`: shallow sea, foam, lakes, marsh pools
- \`TerrainDetails\`: dense forest, mountain, crystal, swamp and ash overlays
- \`Roads\`: empty for now
- \`Decor\`: empty for now
- \`Buildings\`: empty for now
- \`Collision\`: hidden water collision mask
- \`RegionMarkers\`: debug/player-facing zone metadata
- \`RoadMarkers\`, \`Landmarks\`, \`Transitions\`: empty for now

## Region List

${REGION_THEMES.map((region) => `- ${region.rx},${region.ry}: ${region.displayName} (${region.biomeType})`).join('\n')}

## Notes

- No cities, buildings, props, NPCs, enemies, roads, dungeons, or teleport transitions are generated.
- The 25 regions are generated from global coordinates, so coastlines, forests, mountains, lakes, and biome borders continue across region edges.
- This map is intentionally separate from the current v3 playable world and does not replace it.
`;
}

async function writeJson(file, data) {
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  await fs.mkdir(mapsDir, { recursive: true });
  await fs.mkdir(previewsDir, { recursive: true });
  await fs.mkdir(tilesetsDir, { recursive: true });
  await fs.mkdir(assetTilesetsDir, { recursive: true });
  await fs.mkdir(docsDir, { recursive: true });

  await fs.writeFile(path.join(assetTilesetsDir, `${FILE_PREFIX}-terrain.png`), drawTilesheet());
  await fs.writeFile(path.join(tilesetsDir, `${FILE_PREFIX}-terrain.tsx`), makeTsx());
  await fs.writeFile(path.join(previewsDir, `${FILE_PREFIX}-preview.png`), makePreview());

  for (let ry = 0; ry < REGION_GRID; ry += 1) {
    for (let rx = 0; rx < REGION_GRID; rx += 1) {
      const region = makeRegion(rx, ry);
      await writeJson(path.join(mapsDir, `${FILE_PREFIX}-region_${rx}_${ry}.tmj`), makeMap(region));
    }
  }

  await writeJson(path.join(mapsDir, `${FILE_PREFIX}.world`), makeWorldFile());
  await writeJson(path.join(mapsDir, `${FILE_PREFIX}-regions.json`), makeRegistry());
  await fs.writeFile(path.join(docsDir, 'world_box_teszt_notes.md'), makeNotes());

  console.log(`Generated ${WORLD_ID}: ${WORLD_TILES}x${WORLD_TILES} tiles, ${REGION_GRID * REGION_GRID} regions.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
