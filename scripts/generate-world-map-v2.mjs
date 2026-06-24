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
const BIOME_TILESET_TILES = 256;
const BUILDING_TILESET_TILES = 768;
const PROP_TILESET_TILES = 256;

const BIOMES = [
  { id: 'starter_forest', name: 'Lush Starter Forest', firstgid: 1, colors: ['#6f9b42', '#99b85a', '#3f6b32', '#bba768', '#56694a'], road: '#b89d65', density: 0.62 },
  { id: 'countryside', name: 'Human Countryside', firstgid: 257, colors: ['#84a94f', '#b1c36a', '#5b7d38', '#cdb774', '#6f7356'], road: '#c1a66d', density: 0.36 },
  { id: 'old_forest', name: 'Dense Old Forest', firstgid: 513, colors: ['#4f7e38', '#759b46', '#254d28', '#9b8d55', '#3c5140'], road: '#876f49', density: 0.82 },
  { id: 'riverlands', name: 'Riverlands', firstgid: 769, colors: ['#6f994f', '#9db967', '#3e6e46', '#b8a86e', '#57715a'], road: '#b59f70', density: 0.48 },
  { id: 'hills', name: 'Rolling Hills', firstgid: 1025, colors: ['#80934d', '#a9b466', '#596b3d', '#bca767', '#6b7254'], road: '#a78d5d', density: 0.42 },
  { id: 'mountain_pass', name: 'Mountain Pass', firstgid: 1281, colors: ['#7b7d59', '#a59d68', '#565c4e', '#d6cfaa', '#4d5048'], road: '#9e8558', density: 0.28 },
  { id: 'rocky_highlands', name: 'Rocky Highlands', firstgid: 1537, colors: ['#777864', '#9a9675', '#54574e', '#c5b883', '#464a45'], road: '#9c8258', density: 0.24 },
  { id: 'swamp', name: 'Swamp Marsh', firstgid: 1793, colors: ['#547854', '#839861', '#2d5246', '#7f7652', '#405b50'], road: '#7e704f', density: 0.58 },
  { id: 'ancient_ruins', name: 'Ancient Ruined Zone', firstgid: 2049, colors: ['#72705f', '#97906f', '#4f5145', '#b69e68', '#595a55'], road: '#91815f', density: 0.35 },
  { id: 'coastal', name: 'Coastal Harbor Zone', firstgid: 2305, colors: ['#78965d', '#a6b06b', '#4f714b', '#d2bd79', '#6e7260'], road: '#c7ad70', density: 0.38 },
  { id: 'dry_grassland', name: 'Dry Grassland Edge', firstgid: 2561, colors: ['#a39a4c', '#c4b765', '#707d3f', '#d4bd78', '#716143'], road: '#b5965d', density: 0.30 },
  { id: 'wild_end', name: 'Wild End Zone', firstgid: 2817, colors: ['#5f704d', '#7f8b56', '#354435', '#9c875d', '#43413d'], road: '#806a4b', density: 0.68 },
];

const BUILDINGS_FIRSTGID = 3073;
const PROPS_FIRSTGID = BUILDINGS_FIRSTGID + BUILDING_TILESET_TILES;
const COLLISION_FIRSTGID = PROPS_FIRSTGID + PROP_TILESET_TILES;

const BIOME_BY_ID = Object.fromEntries(BIOMES.map((biome) => [biome.id, biome]));

const TILES = {
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

const PROPS = {
  barrel: 0,
  crate: 1,
  hay: 2,
  cart: 3,
  sign: 4,
  fenceH: 5,
  fenceV: 6,
  brokenFence: 7,
  lamp: 8,
  flowerPatch: 9,
  reeds: 10,
  mushroom: 11,
  rockSmall: 12,
  rockLarge: 13,
  stump: 14,
  log: 15,
  oak2x2: 16,
  pine2x2: 20,
  forestCluster3x3: 48,
  bridgeH: 80,
  bridgeV: 96,
  dock: 112,
  boat: 128,
  ruinsPillar: 144,
  ruinsWall: 145,
  mineEntrance: 160,
  caveEntrance: 176,
  marketStall: 192,
  well: 208,
  torch: 209,
  campfire: 210,
  torchFrame2: 211,
  campfireFrame2: 212,
  campfireFrame3: 213,
};

const BUILDINGS = {
  townHall: { start: 0, w: 8, h: 6, label: 'Town Hall', palette: 'civic' },
  inn: { start: 112, w: 6, h: 5, label: 'Inn', palette: 'warm' },
  shop: { start: 208, w: 5, h: 4, label: 'Shop', palette: 'green' },
  chapel: { start: 304, w: 5, h: 6, label: 'Chapel', palette: 'stone' },
  blacksmith: { start: 416, w: 5, h: 4, label: 'Blacksmith', palette: 'dark' },
  farmhouse: { start: 512, w: 4, h: 4, label: 'Farmhouse', palette: 'farm' },
  stable: { start: 608, w: 5, h: 3, label: 'Stable', palette: 'wood' },
  barracks: { start: 672, w: 4, h: 5, label: 'Barracks', palette: 'stone' },
  warehouse: { start: 736, w: 4, h: 2, label: 'Warehouse', palette: 'dock' },
};

const REGION_THEMES = [
  ['Western Wildwood', 'starter_forest', 'small hunting lodge and old trees'],
  ['Miller River Crossing', 'riverlands', 'bridge village and riverside farms'],
  ['Greyspur Foothills', 'hills', 'foothills below the mountain road'],
  ['Northgate Trade Road', 'countryside', 'northern market city and trade fields'],
  ['Saltcliff Harbor', 'coastal', 'coastal cliffs and a working harbor'],
  ['Deepbough Forest', 'old_forest', 'dense forest and hidden clearings'],
  ['Hearthfield Farms', 'countryside', 'human farms and windbreak fences'],
  ['Stonebridge Heartlands', 'countryside', 'main hub approach and river road'],
  ['Eldergate Ruins', 'ancient_ruins', 'old ruined road and broken towers'],
  ['Eastpine Wood', 'old_forest', 'eastern forest and hunter trails'],
  ['Mirrorlake Shores', 'riverlands', 'large lake region and fishing spots'],
  ['Redbanner Fields', 'hills', 'old battlefield and memorial hills'],
  ['Stonebridge City', 'countryside', 'large central city and crossroads'],
  ['Mirewatch Border', 'swamp', 'swamp edge and raised road'],
  ['Seabright Road', 'coastal', 'coastal road and cliffside lookout'],
  ['Westwall Mountains', 'mountain_pass', 'western mountains and high passes'],
  ['Coppervein Mining Town', 'rocky_highlands', 'mining town and quarry roads'],
  ['Highpass Ridge', 'mountain_pass', 'major highland pass and bridges'],
  ['Blackfen Marsh', 'swamp', 'marshland and dark forest pools'],
  ['Drowned Coast', 'ancient_ruins', 'ruined coast and old docks'],
  ['Farwatch Isles', 'coastal', 'remote islands and sea road'],
  ['Southbarley Farms', 'dry_grassland', 'southern farms and dry fields'],
  ['Sunward Fortress', 'dry_grassland', 'southern fortress and road camp'],
  ['Oldstone Expanse', 'ancient_ruins', 'ancient temples and broken causeways'],
  ['Thornwild End', 'wild_end', 'dangerous wild biome and final frontier'],
].map(([name, biome, role], index) => ({
  rx: index % REGION_GRID,
  ry: Math.floor(index / REGION_GRID),
  id: `region_${index % REGION_GRID}_${Math.floor(index / REGION_GRID)}`,
  name,
  biome,
  role,
}));

const LANDMARKS = [
  { id: 'hollowpine_lodge', displayName: 'Hollowpine Lodge', kind: 'lodge', x: 370, y: 360, radius: 70, biome: 'starter_forest', showOnMap: true },
  { id: 'miller_crossing', displayName: 'Miller Crossing', kind: 'village', x: 1080, y: 520, radius: 90, biome: 'riverlands', showOnMap: true },
  { id: 'greyspur_watch', displayName: 'Greyspur Watch', kind: 'fort', x: 1860, y: 520, radius: 82, biome: 'hills', showOnMap: true },
  { id: 'northgate', displayName: 'Northgate', kind: 'town', x: 2820, y: 430, radius: 120, biome: 'countryside', showOnMap: true },
  { id: 'saltcliff_harbor', displayName: 'Saltcliff Harbor', kind: 'harbor', x: 3570, y: 600, radius: 130, biome: 'coastal', showOnMap: true },
  { id: 'deepbough_grove', displayName: 'Deepbough Grove', kind: 'grove', x: 510, y: 1040, radius: 80, biome: 'old_forest', showOnMap: true },
  { id: 'hearthfield', displayName: 'Hearthfield', kind: 'farmstead', x: 1160, y: 1210, radius: 115, biome: 'countryside', showOnMap: true },
  { id: 'riverwatch_mill', displayName: 'Riverwatch Mill', kind: 'mill', x: 1940, y: 1180, radius: 90, biome: 'riverlands', showOnMap: true },
  { id: 'eldergate_ruins', displayName: 'Eldergate Ruins', kind: 'ruins', x: 2740, y: 1130, radius: 120, biome: 'ancient_ruins', showOnMap: true },
  { id: 'eastpine_camp', displayName: 'Eastpine Camp', kind: 'camp', x: 3500, y: 1180, radius: 75, biome: 'old_forest', showOnMap: true },
  { id: 'mirrorlake_ferry', displayName: 'Mirrorlake Ferry', kind: 'dock', x: 620, y: 1860, radius: 80, biome: 'riverlands', showOnMap: true },
  { id: 'redbanner_memorial', displayName: 'Redbanner Memorial', kind: 'battlefield', x: 1250, y: 2030, radius: 115, biome: 'hills', showOnMap: true },
  { id: 'stonebridge_city', displayName: 'Stonebridge City', kind: 'city', x: 2010, y: 1940, radius: 190, biome: 'countryside', showOnMap: true },
  { id: 'mirewatch', displayName: 'Mirewatch', kind: 'village', x: 2880, y: 2010, radius: 90, biome: 'swamp', showOnMap: true },
  { id: 'seabright_lookout', displayName: 'Seabright Lookout', kind: 'watchtower', x: 3620, y: 2050, radius: 70, biome: 'coastal', showOnMap: true },
  { id: 'westwall_gate', displayName: 'Westwall Gate', kind: 'fort', x: 510, y: 2710, radius: 90, biome: 'mountain_pass', showOnMap: true },
  { id: 'coppervein', displayName: 'Coppervein', kind: 'mining_town', x: 1210, y: 2840, radius: 115, biome: 'rocky_highlands', showOnMap: true },
  { id: 'highpass_bridge', displayName: 'Highpass Bridge', kind: 'bridge_landmark', x: 2020, y: 2790, radius: 80, biome: 'mountain_pass', showOnMap: true },
  { id: 'blackfen_crossing', displayName: 'Blackfen Crossing', kind: 'marsh_camp', x: 2920, y: 2920, radius: 90, biome: 'swamp', showOnMap: true },
  { id: 'drowned_abbey', displayName: 'Drowned Abbey', kind: 'ruins', x: 3500, y: 2870, radius: 100, biome: 'ancient_ruins', showOnMap: true },
  { id: 'farwatch_landing', displayName: 'Farwatch Landing', kind: 'harbor', x: 520, y: 3530, radius: 95, biome: 'coastal', showOnMap: true },
  { id: 'southbarley', displayName: 'Southbarley', kind: 'farmstead', x: 1180, y: 3470, radius: 115, biome: 'dry_grassland', showOnMap: true },
  { id: 'sunward_keep', displayName: 'Sunward Keep', kind: 'fortress', x: 2000, y: 3400, radius: 145, biome: 'dry_grassland', showOnMap: true },
  { id: 'oldstone_temple', displayName: 'Oldstone Temple', kind: 'temple_ruins', x: 2870, y: 3460, radius: 135, biome: 'ancient_ruins', showOnMap: true },
  { id: 'thornwild_edge', displayName: 'Thornwild Edge', kind: 'wild_camp', x: 3550, y: 3520, radius: 100, biome: 'wild_end', showOnMap: true },
  { id: 'cave_emberdeep', displayName: 'Emberdeep Cave', kind: 'cave_entrance', x: 1540, y: 2890, radius: 44, biome: 'rocky_highlands', transitionTarget: 'emberdeep_cave' },
  { id: 'dungeon_oldstone', displayName: 'Oldstone Depths', kind: 'dungeon_entrance', x: 2890, y: 3540, radius: 52, biome: 'ancient_ruins', transitionTarget: 'oldstone_depths' },
  { id: 'boat_farwatch_saltcliff', displayName: 'Farwatch Ferry', kind: 'boat_route', x: 560, y: 3575, radius: 48, biome: 'coastal', transitionTarget: 'saltcliff_harbor' },
  { id: 'whispering_hideaway', displayName: 'Whispering Hideaway', kind: 'hidden_cabin', x: 720, y: 735, radius: 36, biome: 'starter_forest', showOnMap: false },
  { id: 'moonwell_garden', displayName: 'Moonwell Garden', kind: 'hidden_garden', x: 740, y: 1320, radius: 42, biome: 'old_forest', showOnMap: false },
  { id: 'willowbend_camp', displayName: 'Willowbend Camp', kind: 'forest_camp', x: 1460, y: 1540, radius: 48, biome: 'countryside', showOnMap: false },
  { id: 'crooked_cart', displayName: 'Crooked Cart', kind: 'roadside_camp', x: 1560, y: 2200, radius: 34, biome: 'hills', showOnMap: false },
  { id: 'mossgate_shrine', displayName: 'Mossgate Shrine', kind: 'shrine', x: 2630, y: 1510, radius: 44, biome: 'ancient_ruins', showOnMap: false },
  { id: 'reedhook_fishing_spot', displayName: 'Reedhook Fishing Spot', kind: 'fishing_spot', x: 3060, y: 2240, radius: 38, biome: 'swamp', showOnMap: false },
  { id: 'old_watch_underpass', displayName: 'Old Watch Underpass', kind: 'watchtower_ruin', x: 1890, y: 2660, radius: 46, biome: 'mountain_pass', showOnMap: false },
  { id: 'emberdeep_overlook', displayName: 'Emberdeep Overlook', kind: 'cave_mouth', x: 1680, y: 3090, radius: 42, biome: 'rocky_highlands', showOnMap: false },
  { id: 'sunken_garden', displayName: 'Sunken Garden', kind: 'hidden_garden', x: 3220, y: 3200, radius: 46, biome: 'ancient_ruins', showOnMap: false },
  { id: 'thornroot_cache', displayName: 'Thornroot Cache', kind: 'forest_camp', x: 3750, y: 3740, radius: 42, biome: 'wild_end', showOnMap: false },
];

const ROADS = [
  { id: 'main_west_road', kind: 'main', width: 10, points: [[370, 360], [640, 520], [1080, 520], [1480, 760], [1940, 1180], [2010, 1940]] },
  { id: 'main_north_trade', kind: 'main', width: 10, points: [[2010, 1940], [2180, 1500], [2420, 960], [2820, 430], [3570, 600]] },
  { id: 'main_east_road', kind: 'main', width: 10, points: [[2010, 1940], [2440, 1900], [2880, 2010], [3320, 2040], [3620, 2050]] },
  { id: 'main_south_road', kind: 'main', width: 10, points: [[2010, 1940], [2020, 2390], [2020, 2790], [2000, 3400], [2870, 3460], [3550, 3520]] },
  { id: 'forest_trail', kind: 'trail', width: 5, points: [[370, 360], [500, 760], [510, 1040], [790, 1320], [1160, 1210]] },
  { id: 'farmland_loop', kind: 'secondary', width: 7, points: [[1080, 520], [1160, 1210], [1250, 2030], [2010, 1940]] },
  { id: 'mirrorlake_road', kind: 'secondary', width: 7, points: [[510, 1040], [620, 1860], [1250, 2030], [2010, 1940]] },
  { id: 'westwall_pass', kind: 'pass', width: 7, points: [[620, 1860], [510, 2710], [1210, 2840], [2020, 2790]] },
  { id: 'copper_road', kind: 'secondary', width: 7, points: [[510, 2710], [1210, 2840], [1540, 2890], [2020, 2790]] },
  { id: 'southern_farm_road', kind: 'secondary', width: 7, points: [[1210, 2840], [1180, 3470], [2000, 3400]] },
  { id: 'oldstone_causeway', kind: 'secondary', width: 8, points: [[2000, 3400], [2450, 3380], [2870, 3460], [3550, 3520]] },
  { id: 'marsh_raised_road', kind: 'secondary', width: 7, points: [[2880, 2010], [2920, 2920], [2870, 3460]] },
  { id: 'coastal_road', kind: 'secondary', width: 7, points: [[3570, 600], [3500, 1180], [3620, 2050], [3500, 2870], [3550, 3520]] },
  { id: 'saltcliff_dock_road', kind: 'trail', width: 5, points: [[3570, 600], [3720, 680], [3840, 740]] },
  { id: 'farwatch_coast_track', kind: 'trail', width: 5, points: [[520, 3530], [820, 3640], [1180, 3470]] },
];

const RIVERS = [
  { id: 'miller_river', width: 13, points: [[1040, 0], [1060, 520], [930, 880], [990, 1380], [760, 1780], [620, 1860], [520, 2240], [450, 2600], [510, 3200], [520, 4000]] },
  { id: 'stonebridge_river', width: 16, points: [[2400, 0], [2420, 520], [2320, 980], [2140, 1420], [2010, 1940], [2030, 2360], [2020, 2790], [2070, 3300], [2100, 4000]] },
  { id: 'eastfen_river', width: 14, points: [[3300, 880], [3220, 1320], [3150, 1700], [2880, 2010], [2920, 2500], [2920, 2920], [3000, 3400], [3120, 4000]] },
];

const LAKES = [
  { id: 'mirrorlake', x: 520, y: 1900, rx: 260, ry: 180, biome: 'riverlands' },
  { id: 'north_mill_pond', x: 1180, y: 590, rx: 110, ry: 75, biome: 'riverlands' },
  { id: 'blackfen_pool', x: 3060, y: 2460, rx: 210, ry: 170, biome: 'swamp' },
  { id: 'drowned_bay', x: 3680, y: 2920, rx: 210, ry: 210, biome: 'coastal' },
  { id: 'thornwild_lake', x: 3520, y: 3480, rx: 160, ry: 130, biome: 'wild_end' },
];

const BRIDGES = [
  { id: 'miller_bridge', x: 1080, y: 520, w: 8, h: 5, orientation: 'horizontal', roadId: 'main_west_road' },
  { id: 'mirrorlake_bridge', x: 620, y: 1860, w: 9, h: 5, orientation: 'horizontal', roadId: 'mirrorlake_road' },
  { id: 'stonebridge_main_bridge', x: 2010, y: 1940, w: 7, h: 10, orientation: 'vertical', roadId: 'main_south_road' },
  { id: 'highpass_bridge', x: 2020, y: 2790, w: 8, h: 5, orientation: 'horizontal', roadId: 'westwall_pass' },
  { id: 'fen_raised_bridge', x: 2880, y: 2010, w: 8, h: 5, orientation: 'horizontal', roadId: 'main_east_road' },
  { id: 'blackfen_bridge', x: 2920, y: 2920, w: 5, h: 9, orientation: 'vertical', roadId: 'marsh_raised_road' },
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
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) setTile(layer, xx, yy, gid);
  }
}

function softEllipse(x, y, cx, cy, rx, ry) {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return 1 - (nx * nx + ny * ny);
}

function landScore(x, y) {
  const continent = Math.max(
    softEllipse(x, y, 1350, 1450, 1180, 1050),
    softEllipse(x, y, 2400, 1720, 1200, 1050),
    softEllipse(x, y, 1950, 2820, 1260, 820),
    softEllipse(x, y, 3100, 2920, 820, 800),
    softEllipse(x, y, 680, 2760, 520, 850),
  );
  const northern = Math.max(
    softEllipse(x, y, 2850, 540, 920, 420),
    softEllipse(x, y, 970, 470, 720, 390),
  );
  const islands = Math.max(
    softEllipse(x, y, 520, 3530, 280, 230),
    softEllipse(x, y, 720, 3710, 140, 110),
    softEllipse(x, y, 3680, 2950, 310, 300),
    softEllipse(x, y, 3790, 720, 170, 130),
  );
  const bays = Math.max(
    softEllipse(x, y, 360, 2180, 250, 260),
    softEllipse(x, y, 3670, 1530, 260, 340),
    softEllipse(x, y, 2160, 3580, 300, 170),
  );
  return Math.max(continent, northern, islands)
    - Math.max(0, bays) * 0.42
    + (hash(x / 24, y / 24, 1) - 0.5) * 0.22
    + (hash(x / 69, y / 69, 2) - 0.5) * 0.16;
}

function isLand(x, y) {
  return landScore(x, y) > 0.045;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pathDistance(x, y, points) {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    best = Math.min(best, distanceToSegment(x, y, ax, ay, bx, by));
  }
  return best;
}

function nearestRoad(x, y) {
  let nearest = null;
  for (const road of ROADS) {
    const dist = pathDistance(x, y, road.points);
    if (!nearest || dist < nearest.distance) nearest = { road, distance: dist };
  }
  return nearest;
}

function nearestRiver(x, y) {
  let nearest = null;
  for (const river of RIVERS) {
    const dist = pathDistance(x, y, river.points);
    if (!nearest || dist < nearest.distance) nearest = { river, distance: dist };
  }
  return nearest;
}

function lakeAt(x, y) {
  return LAKES.find((lake) => softEllipse(x, y, lake.x, lake.y, lake.rx, lake.ry) > 0) ?? null;
}

function bridgeAt(x, y) {
  return BRIDGES.find((bridge) => (
    Math.abs(x - bridge.x) <= bridge.w / 2 && Math.abs(y - bridge.y) <= bridge.h / 2
  )) ?? null;
}

function sampleWorld(x, y) {
  const score = landScore(x, y);
  const land = score > 0.045;
  const bridge = bridgeAt(x, y);
  const river = nearestRiver(x, y);
  const lake = lakeAt(x, y);
  const water = !land || (river && river.distance <= river.river.width + (hash(x / 8, y / 8, 20) - 0.5) * 2) || Boolean(lake);
  const mountain = mountainScore(x, y);
  const theme = regionThemeFor(x, y);
  let biome = BIOME_BY_ID[theme.biome] ?? BIOME_BY_ID.countryside;
  if (water) {
    biome = BIOME_BY_ID[lake?.biome ?? theme.biome] ?? BIOME_BY_ID.riverlands;
  } else if (score < 0.18 || x > 3500 || y > 3600 || x < 180) {
    biome = BIOME_BY_ID.coastal;
  } else if (mountain > 0.45) {
    biome = BIOME_BY_ID.mountain_pass;
  } else if (mountain > 0.23 && x > 820) {
    biome = BIOME_BY_ID.rocky_highlands;
  } else if (softEllipse(x, y, 3050, 2480, 560, 640) > 0.08) {
    biome = BIOME_BY_ID.swamp;
  } else if (softEllipse(x, y, 3040, 3400, 650, 480) > 0.08) {
    biome = BIOME_BY_ID.ancient_ruins;
  } else if (softEllipse(x, y, 560, 1000, 540, 580) > 0.05 || softEllipse(x, y, 3500, 1180, 540, 500) > 0.05) {
    biome = BIOME_BY_ID.old_forest;
  } else if (softEllipse(x, y, 1300, 3480, 640, 330) > 0.02 || softEllipse(x, y, 2000, 3370, 680, 330) > 0.05) {
    biome = BIOME_BY_ID.dry_grassland;
  } else if (softEllipse(x, y, 3600, 3500, 430, 430) > 0.02) {
    biome = BIOME_BY_ID.wild_end;
  } else if (river?.distance < 80 || lake) {
    biome = BIOME_BY_ID.riverlands;
  }
  const road = land || bridge ? nearestRoad(x, y) : null;
  return { x, y, score, land, water, bridge, river, lake, mountain, theme, biome, road };
}

function groundTileFromSample(sample) {
  const { x, y, biome, road, mountain, score } = sample;
  if (sample.water) return gid(biome, TILES.bank);
  if (score < 0.18) return gid(biome, TILES.sand);
  if (mountain > 0.45) return gid(biome, TILES.stone);
  if (mountain > 0.22) return gid(biome, TILES.cliffDirt);
  if (road && road.distance < road.road.width + 4) return gid(biome, TILES.dirt);
  if (biome.id === 'swamp') return gid(biome, hash(x / 9, y / 9, 7) > 0.45 ? TILES.mud : TILES.dark);
  if (biome.id === 'ancient_ruins') return gid(biome, hash(x / 10, y / 10, 8) > 0.62 ? TILES.ruinFloor : TILES.base);
  if (biome.id === 'dry_grassland') return gid(biome, hash(x / 10, y / 10, 9) > 0.55 ? TILES.dirt : TILES.base);
  const n = hash(x / 8, y / 8, biome.firstgid);
  if (n > 0.90) return gid(biome, TILES.flowers);
  if (n > 0.76) return gid(biome, TILES.dark);
  if (n > 0.55) return gid(biome, TILES.alt);
  return gid(biome, TILES.base);
}

function detailTileFromSample(sample) {
  const { x, y, biome, river, lake, road, mountain } = sample;
  if (sample.water) return 0;
  const waterEdge = river && river.distance < river.river.width + 6;
  if (waterEdge || lakeAt(x + 2, y) || lakeAt(x - 2, y)) return gid(biome, TILES.bank);
  if (road && road.distance > road.road.width && road.distance < road.road.width + 4) return gid(biome, TILES.roadEdge);
  if (mountain > 0.5 && hash(x, y, 42) > 0.65) return gid(biome, TILES.scree);
  const n = hash(x, y, 43);
  if (biome.id === 'swamp' && n > 0.935) return gid(biome, TILES.reeds);
  if (biome.id === 'countryside' && n > 0.965) return gid(biome, TILES.flowers);
  if (biome.id === 'old_forest' && n > 0.955) return gid(biome, TILES.forestFloor);
  if (biome.id === 'ancient_ruins' && n > 0.965) return gid(biome, TILES.mossStone);
  if (n > 0.975) return gid(biome, TILES.tallGrass);
  return 0;
}

function roadTileFromSample(sample) {
  if (sample.water && !sample.bridge) return 0;
  const { road, biome } = sample;
  if (!road || road.distance > road.road.width) return 0;
  if (road.road.kind === 'trail') return gid(biome, TILES.path);
  if (road.road.kind === 'pass') return gid(biome, TILES.dirt);
  return gid(biome, TILES.road);
}

function waterTileFromSample(sample) {
  if (!sample.water) return 0;
  if (sample.bridge) return gid(sample.biome, TILES.shallowWater);
  if (sample.river && sample.river.distance < sample.river.river.width + 3) return gid(sample.biome, TILES.water);
  if (sample.score < 0.1) return gid(sample.biome, TILES.water);
  return gid(sample.biome, TILES.shallowWater);
}

function isWater(x, y) {
  if (!isLand(x, y)) return true;
  const river = nearestRiver(x, y);
  if (river && river.distance <= river.river.width + (hash(x / 8, y / 8, 20) - 0.5) * 2) return true;
  if (lakeAt(x, y)) return true;
  return false;
}

function mountainScore(x, y) {
  return Math.max(
    softEllipse(x, y, 1550, 430, 580, 190),
    softEllipse(x, y, 1880, 680, 660, 220),
    softEllipse(x, y, 2120, 1020, 480, 170),
    softEllipse(x, y, 540, 2650, 250, 640),
    softEllipse(x, y, 1120, 2770, 450, 180),
    softEllipse(x, y, 1950, 2740, 530, 160),
    softEllipse(x, y, 2740, 2860, 520, 170),
  );
}

function regionThemeFor(x, y) {
  const rx = Math.max(0, Math.min(REGION_GRID - 1, Math.floor(x / REGION_TILES)));
  const ry = Math.max(0, Math.min(REGION_GRID - 1, Math.floor(y / REGION_TILES)));
  return REGION_THEMES[ry * REGION_GRID + rx];
}

function biomeFor(x, y) {
  const coast = landScore(x, y);
  const mountain = mountainScore(x, y);
  const theme = regionThemeFor(x, y);
  if (isWater(x, y)) {
    const lake = lakeAt(x, y);
    return BIOME_BY_ID[lake?.biome ?? theme.biome] ?? BIOME_BY_ID.riverlands;
  }
  if (coast < 0.18 || x > 3500 || y > 3600 || x < 180) return BIOME_BY_ID.coastal;
  if (mountain > 0.45) return BIOME_BY_ID.mountain_pass;
  if (mountain > 0.23 && x > 820) return BIOME_BY_ID.rocky_highlands;
  if (softEllipse(x, y, 3050, 2480, 560, 640) > 0.08) return BIOME_BY_ID.swamp;
  if (softEllipse(x, y, 3040, 3400, 650, 480) > 0.08) return BIOME_BY_ID.ancient_ruins;
  if (softEllipse(x, y, 560, 1000, 540, 580) > 0.05 || softEllipse(x, y, 3500, 1180, 540, 500) > 0.05) return BIOME_BY_ID.old_forest;
  if (softEllipse(x, y, 1300, 3480, 640, 330) > 0.02 || softEllipse(x, y, 2000, 3370, 680, 330) > 0.05) return BIOME_BY_ID.dry_grassland;
  if (softEllipse(x, y, 3600, 3500, 430, 430) > 0.02) return BIOME_BY_ID.wild_end;
  if (nearestRiver(x, y)?.distance < 80 || lakeAt(x, y)) return BIOME_BY_ID.riverlands;
  return BIOME_BY_ID[theme.biome] ?? BIOME_BY_ID.countryside;
}

function gid(biome, tile) {
  return biome.firstgid + tile - 1;
}

function landmarkAt(x, y) {
  return LANDMARKS.find((landmark) => Math.hypot(x - landmark.x, y - landmark.y) <= landmark.radius) ?? null;
}

function groundTileFor(x, y) {
  const biome = biomeFor(x, y);
  const road = nearestRoad(x, y);
  const mountain = mountainScore(x, y);
  const landmark = landmarkAt(x, y);
  if (landmark?.kind === 'city' || landmark?.kind === 'town') return gid(biome, TILES.light);
  if (isWater(x, y)) return gid(biome, TILES.bank);
  if (landScore(x, y) < 0.18) return gid(biome, TILES.sand);
  if (mountain > 0.45) return gid(biome, TILES.stone);
  if (mountain > 0.22) return gid(biome, TILES.cliffDirt);
  if (road && road.distance < road.road.width + 4) return gid(biome, TILES.dirt);
  if (biome.id === 'swamp') return gid(biome, hash(x / 9, y / 9, 7) > 0.45 ? TILES.mud : TILES.dark);
  if (biome.id === 'ancient_ruins') return gid(biome, hash(x / 10, y / 10, 8) > 0.62 ? TILES.ruinFloor : TILES.base);
  if (biome.id === 'dry_grassland') return gid(biome, hash(x / 10, y / 10, 9) > 0.55 ? TILES.dirt : TILES.base);
  const n = hash(x / 8, y / 8, biome.firstgid);
  if (n > 0.90) return gid(biome, TILES.flowers);
  if (n > 0.76) return gid(biome, TILES.dark);
  if (n > 0.55) return gid(biome, TILES.alt);
  return gid(biome, TILES.base);
}

function detailTileFor(x, y) {
  const biome = biomeFor(x, y);
  if (isWater(x, y)) return 0;
  const river = nearestRiver(x, y);
  const waterEdge = river && river.distance < river.river.width + 6;
  if (waterEdge || lakeAt(x + 2, y) || lakeAt(x - 2, y)) return gid(biome, TILES.bank);
  const road = nearestRoad(x, y);
  if (road && road.distance > road.road.width && road.distance < road.road.width + 4) return gid(biome, TILES.roadEdge);
  const mountain = mountainScore(x, y);
  if (mountain > 0.5 && hash(x, y, 42) > 0.65) return gid(biome, TILES.scree);
  const n = hash(x, y, 43);
  if (biome.id === 'swamp' && n > 0.935) return gid(biome, TILES.reeds);
  if (biome.id === 'countryside' && n > 0.965) return gid(biome, TILES.flowers);
  if (biome.id === 'old_forest' && n > 0.955) return gid(biome, TILES.forestFloor);
  if (biome.id === 'ancient_ruins' && n > 0.965) return gid(biome, TILES.mossStone);
  if (n > 0.975) return gid(biome, TILES.tallGrass);
  return 0;
}

function roadTileFor(x, y) {
  if (isWater(x, y) && !bridgeAt(x, y)) return 0;
  const nearest = nearestRoad(x, y);
  if (!nearest || nearest.distance > nearest.road.width) return 0;
  const biome = biomeFor(x, y);
  if (nearest.road.kind === 'trail') return gid(biome, TILES.path);
  if (nearest.road.kind === 'pass') return gid(biome, TILES.dirt);
  return gid(biome, TILES.road);
}

function waterTileFor(x, y) {
  if (!isWater(x, y)) return 0;
  const biome = biomeFor(x, y);
  const bridge = bridgeAt(x, y);
  if (bridge) return gid(biome, TILES.shallowWater);
  const river = nearestRiver(x, y);
  if (river && river.distance < river.river.width + 3) return gid(biome, TILES.water);
  if (landScore(x, y) < 0.1) return gid(biome, TILES.water);
  return gid(biome, TILES.shallowWater);
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

function drawTileBase(pixels, width, height, tile, biome, mode) {
  const tx = (tile % TILESET_COLUMNS) * TILE;
  const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
  const [base, light, dark, sand, stone] = biome.colors.map((color) => rgba(color));
  const water = rgba('#1f677b');
  const shallow = rgba('#3b8391');
  const mud = rgba('#685f47');
  const road = rgba(biome.road);
  const color = mode === 'water' ? water
    : mode === 'shallowWater' ? shallow
      : mode === 'bank' || mode === 'sand' ? sand
        : mode === 'road' || mode === 'path' ? road
          : mode === 'plaza' ? rgba('#9c9179')
            : mode === 'stone' || mode === 'mountain' ? stone
              : mode === 'mud' ? mud
                : mode === 'dark' ? dark
                  : mode === 'light' ? light
                    : base;
  fill(pixels, width, height, tx, ty, TILE, TILE, color);
  for (let i = 0; i < 42; i += 1) {
    const px = tx + Math.floor(hash(tile, i, biome.firstgid) * TILE);
    const py = ty + Math.floor(hash(tile, i, biome.firstgid + 3) * TILE);
    const shade = blend(color, hash(tile, i, 5) > 0.5 ? light : dark, mode === 'water' ? 0.12 : 0.25);
    put(pixels, width, height, px, py, shade);
  }
}

function makeBiomeTilesheet(biome) {
  const width = TILE * TILESET_COLUMNS;
  const height = TILE * Math.ceil(BIOME_TILESET_TILES / TILESET_COLUMNS);
  const pixels = Buffer.alloc(width * height * 4);
  for (let tile = 0; tile < BIOME_TILESET_TILES; tile += 1) {
    const id = tile + 1;
    const mode = id === TILES.water ? 'water'
      : id === TILES.shallowWater ? 'shallowWater'
        : [TILES.bank, TILES.sand].includes(id) ? 'bank'
          : [TILES.road, TILES.path, TILES.roadEdge].includes(id) ? 'road'
            : id === TILES.plaza || id === TILES.ruinFloor ? 'plaza'
              : [TILES.stone, TILES.mountain, TILES.mountainSnow, TILES.cliff, TILES.scree, TILES.mossStone].includes(id) ? 'stone'
                : [TILES.mud, TILES.reeds].includes(id) ? 'mud'
                  : [TILES.dark, TILES.forestFloor, TILES.tree, TILES.treeAlt, TILES.pine, TILES.bush].includes(id) ? 'dark'
                    : [TILES.alt, TILES.field, TILES.flowers, TILES.tallGrass, TILES.crop, TILES.light].includes(id) ? 'light'
                      : null;
    drawTileBase(pixels, width, height, tile, biome, mode);
    const tx = (tile % TILESET_COLUMNS) * TILE;
    const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
    if ([TILES.tree, TILES.treeAlt, TILES.pine].includes(id)) {
      fill(pixels, width, height, tx + 14, ty + 18, 4, 9, rgba('#6c4b31'));
      for (let yy = 4; yy < 22; yy += 3) fill(pixels, width, height, tx + 7 + Math.floor(yy / 4), ty + yy, 18 - Math.floor(yy / 2), 4, rgba(biome.colors[2]));
    }
    if ([TILES.mountain, TILES.mountainSnow].includes(id)) {
      line(pixels, width, height, tx + 3, ty + 27, tx + 15, ty + 5, rgba('#f0ead8'));
      line(pixels, width, height, tx + 15, ty + 5, tx + 29, ty + 27, rgba('#55564f'));
      fill(pixels, width, height, tx + 10, ty + 8, 9, 5, rgba('#f4f1e6'));
    }
    if ([TILES.road, TILES.path].includes(id)) {
      fill(pixels, width, height, tx, ty + 10, TILE, 12, rgba(biome.road));
      for (let xx = 2; xx < 31; xx += 6) put(pixels, width, height, tx + xx, ty + 15, rgba('#e1c98e'));
    }
    if (id === TILES.water || id === TILES.shallowWater) {
      for (let yy = 7; yy < 28; yy += 8) line(pixels, width, height, tx + 3, ty + yy, tx + 27, ty + yy - 2, rgba('#75aeba', 190));
    }
    if (id === TILES.plaza) {
      for (let yy = 0; yy < TILE; yy += 8) line(pixels, width, height, tx, ty + yy, tx + TILE - 1, ty + yy, rgba('#777266'));
      for (let xx = 0; xx < TILE; xx += 8) line(pixels, width, height, tx + xx, ty, tx + xx, ty + TILE - 1, rgba('#777266'));
    }
  }
  return encodePng(width, height, pixels);
}

function drawBuildingPrefab(pixels, width, height, prefab) {
  const sx = (prefab.start % TILESET_COLUMNS) * TILE;
  const sy = Math.floor(prefab.start / TILESET_COLUMNS) * TILE;
  const w = prefab.w * TILE;
  const h = prefab.h * TILE;
  const wall = prefab.palette === 'stone' ? rgba('#938c7a')
    : prefab.palette === 'dark' ? rgba('#6f6255')
      : prefab.palette === 'dock' ? rgba('#7a5a35')
        : rgba('#b88d58');
  const roof = prefab.palette === 'green' ? rgba('#536b3d')
    : prefab.palette === 'stone' ? rgba('#706f68')
      : prefab.palette === 'farm' ? rgba('#8a5c30')
        : prefab.palette === 'dark' ? rgba('#4f3130')
          : rgba('#7d3431');
  const roofHi = blend(roof, rgba('#f3d18c'), 0.18);
  const wood = rgba('#5f3e28');
  fill(pixels, width, height, sx + 5, sy + 17, w - 10, h - 22, wall);
  fill(pixels, width, height, sx + 3, sy + 9, w - 6, 12, roof);
  line(pixels, width, height, sx + 3, sy + 9, sx + Math.floor(w / 2), sy + 2, roofHi);
  line(pixels, width, height, sx + Math.floor(w / 2), sy + 2, sx + w - 3, sy + 9, roof);
  fill(pixels, width, height, sx + Math.floor(w / 2) - 6, sy + h - 22, 12, 20, wood);
  fill(pixels, width, height, sx + Math.floor(w / 2) - 4, sy + h - 14, 8, 12, rgba('#2c1b15'));
  for (let col = 0; col < prefab.w; col += 1) {
    if (col === Math.floor(prefab.w / 2)) continue;
    if (col % 2 === 0 || prefab.w <= 5) fill(pixels, width, height, sx + col * TILE + 10, sy + h - 36, 10, 12, rgba('#f2d890'));
  }
  if (prefab.palette === 'stone' || prefab.palette === 'civic') {
    fill(pixels, width, height, sx + w - 26, sy + 1, 13, 34, rgba('#716d65'));
    fill(pixels, width, height, sx + w - 24, sy - 1, 9, 6, rgba('#534f4a'));
  }
  if (prefab.label === 'Blacksmith') {
    fill(pixels, width, height, sx + 9, sy + h - 30, 14, 12, rgba('#2d2b2a'));
    fill(pixels, width, height, sx + 11, sy + h - 34, 10, 5, rgba('#e19145'));
  }
  if (prefab.label === 'Chapel') {
    fill(pixels, width, height, sx + Math.floor(w / 2) - 2, sy + 3, 4, 18, rgba('#ddd3b5'));
    fill(pixels, width, height, sx + Math.floor(w / 2) - 8, sy + 9, 16, 4, rgba('#ddd3b5'));
  }
}

function makeBuildingsTilesheet() {
  const width = TILE * TILESET_COLUMNS;
  const height = TILE * Math.ceil(BUILDING_TILESET_TILES / TILESET_COLUMNS);
  const pixels = Buffer.alloc(width * height * 4);
  fill(pixels, width, height, 0, 0, width, height, [0, 0, 0, 0]);
  Object.values(BUILDINGS).forEach((prefab) => drawBuildingPrefab(pixels, width, height, prefab));
  return encodePng(width, height, pixels);
}

function drawPropTile(pixels, width, height, tile, draw) {
  const tx = (tile % TILESET_COLUMNS) * TILE;
  const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
  draw(tx, ty);
}

function drawMultiBox(pixels, width, height, tile, tw, th, color, trim = '#4a3424') {
  const tx = (tile % TILESET_COLUMNS) * TILE;
  const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
  fill(pixels, width, height, tx + 4, ty + 8, tw * TILE - 8, th * TILE - 12, rgba(color));
  fill(pixels, width, height, tx + 4, ty + 8, tw * TILE - 8, 5, rgba(trim));
  fill(pixels, width, height, tx + 4, ty + th * TILE - 10, tw * TILE - 8, 5, rgba(trim));
}

function makePropsTilesheet() {
  const width = TILE * TILESET_COLUMNS;
  const height = TILE * Math.ceil(PROP_TILESET_TILES / TILESET_COLUMNS);
  const pixels = Buffer.alloc(width * height * 4);
  fill(pixels, width, height, 0, 0, width, height, [0, 0, 0, 0]);
  const simple = [
    [PROPS.barrel, '#7b5437'], [PROPS.crate, '#8a623a'], [PROPS.hay, '#c8ae52'], [PROPS.cart, '#6d4930'],
    [PROPS.sign, '#7a5433'], [PROPS.fenceH, '#79542f'], [PROPS.fenceV, '#79542f'], [PROPS.brokenFence, '#5f4329'],
    [PROPS.lamp, '#d6b25d'], [PROPS.flowerPatch, '#d86a83'], [PROPS.reeds, '#607540'], [PROPS.mushroom, '#d7d1bd'],
    [PROPS.rockSmall, '#7a7c73'], [PROPS.rockLarge, '#696c65'], [PROPS.stump, '#6a482f'], [PROPS.log, '#68462f'],
  ];
  for (const [tile, color] of simple) {
    drawPropTile(pixels, width, height, tile, (tx, ty) => {
      fill(pixels, width, height, tx + 8, ty + 13, 16, 12, rgba(color));
      fill(pixels, width, height, tx + 10, ty + 9, 12, 5, blend(rgba(color), rgba('#f2d990'), 0.24));
      if (tile === PROPS.fenceH) fill(pixels, width, height, tx + 1, ty + 14, 30, 5, rgba(color));
      if (tile === PROPS.fenceV) fill(pixels, width, height, tx + 14, ty + 1, 5, 30, rgba(color));
      if (tile === PROPS.sign) fill(pixels, width, height, tx + 14, ty + 9, 4, 19, rgba('#5f3b24'));
    });
  }
  drawMultiBox(pixels, width, height, PROPS.oak2x2, 2, 2, '#32612f', '#644629');
  drawMultiBox(pixels, width, height, PROPS.pine2x2, 2, 2, '#294f38', '#60432b');
  drawMultiBox(pixels, width, height, PROPS.forestCluster3x3, 3, 3, '#2b5730', '#4d3a25');
  drawMultiBox(pixels, width, height, PROPS.bridgeH, 4, 2, '#8b6338', '#4d3424');
  drawMultiBox(pixels, width, height, PROPS.bridgeV, 2, 4, '#8b6338', '#4d3424');
  drawMultiBox(pixels, width, height, PROPS.dock, 4, 2, '#765437', '#34261b');
  drawMultiBox(pixels, width, height, PROPS.boat, 3, 2, '#714a31', '#d9c790');
  drawMultiBox(pixels, width, height, PROPS.mineEntrance, 3, 3, '#4c4c46', '#272722');
  drawMultiBox(pixels, width, height, PROPS.caveEntrance, 3, 3, '#3f403b', '#22231f');
  drawMultiBox(pixels, width, height, PROPS.marketStall, 2, 2, '#a7443c', '#f1d58b');
  drawPropTile(pixels, width, height, PROPS.well, (tx, ty) => {
    fill(pixels, width, height, tx + 8, ty + 13, 16, 12, rgba('#77736a'));
    fill(pixels, width, height, tx + 6, ty + 8, 20, 6, rgba('#6b4630'));
  });
  const drawTorch = (tile, flameColor, glowColor) => drawPropTile(pixels, width, height, tile, (tx, ty) => {
    fill(pixels, width, height, tx + 15, ty + 9, 3, 19, rgba('#5f3c25'));
    fill(pixels, width, height, tx + 10, ty + 3, 12, 9, rgba(glowColor, 105));
    fill(pixels, width, height, tx + 12, ty + 4, 8, 7, rgba(flameColor));
    fill(pixels, width, height, tx + 15, ty + 2, 3, 5, rgba('#ffd86a'));
  });
  const drawCampfire = (tile, flameColor, offset = 0) => drawPropTile(pixels, width, height, tile, (tx, ty) => {
    fill(pixels, width, height, tx + 9, ty + 19, 14, 4, rgba('#5a3d28'));
    fill(pixels, width, height, tx + 8, ty + 15, 16, 8, rgba('#5a3d28', 150));
    fill(pixels, width, height, tx + 12 + offset, ty + 12, 8, 8, rgba(flameColor));
    fill(pixels, width, height, tx + 15 - offset, ty + 9, 4, 8, rgba('#ffd86a'));
  });
  drawTorch(PROPS.torch, '#ef8b32', '#ef8b32');
  drawTorch(PROPS.torchFrame2, '#f6a23a', '#facc15');
  drawCampfire(PROPS.campfire, '#ef8b32', 0);
  drawCampfire(PROPS.campfireFrame2, '#f6a23a', -1);
  drawCampfire(PROPS.campfireFrame3, '#dc6428', 1);
  return encodePng(width, height, pixels);
}

function makeCollisionTilesheet() {
  const pixels = Buffer.alloc(TILE * TILE * 4);
  fill(pixels, TILE, TILE, 0, 0, TILE, TILE, rgba('#ff3333', 125));
  return encodePng(TILE, TILE, pixels);
}

function makeTsx(name, image, tileCount, columns = TILESET_COLUMNS, animations = []) {
  const animationXml = animations.map(({ tileId, frames }) => ` <tile id="${tileId}">
  <animation>
${frames.map((frame) => `   <frame tileid="${frame.tileId}" duration="${frame.duration}"/>`).join('\n')}
  </animation>
 </tile>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${name}" tilewidth="32" tileheight="32" tilecount="${tileCount}" columns="${columns}">
 <image source="../assets/tilesets/${image}" width="${columns * TILE}" height="${Math.ceil(tileCount / columns) * TILE}"/>
${animationXml ? `${animationXml}\n` : ''}</tileset>
`;
}

function propGid(localTile) {
  return PROPS_FIRSTGID + localTile;
}

function buildingGid(localTile) {
  return BUILDINGS_FIRSTGID + localTile;
}

function createRegion(rx, ry) {
  objectId = 1;
  const worldX = rx * REGION_TILES;
  const worldY = ry * REGION_TILES;
  const theme = REGION_THEMES[ry * REGION_GRID + rx];
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
    decor: makeLayer(),
    buildings: makeLayer(),
    collision: makeLayer(),
    objects: {
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
      if (sample.water && !sample.bridge) setTile(region.collision, x, y, COLLISION_FIRSTGID);
    }
  }

  placeNaturalDecor(region);
  placeBridges(region);
  placeRegionalDetails(region);
  for (const landmark of LANDMARKS) placeLandmark(region, landmark);
  addRegionMarkers(region);
  addRoadMarkers(region);

  return region;
}

function toLocal(region, gx, gy) {
  return { x: Math.round(gx - region.worldX), y: Math.round(gy - region.worldY) };
}

function inRegion(region, gx, gy, margin = 0) {
  return gx >= region.worldX - margin
    && gy >= region.worldY - margin
    && gx < region.worldX + REGION_TILES + margin
    && gy < region.worldY + REGION_TILES + margin;
}

function placeProp(region, gx, gy, localTile, solid = false) {
  const { x, y } = toLocal(region, gx, gy);
  if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) return;
  setTile(region.decor, x, y, propGid(localTile));
  if (solid) setTile(region.collision, x, y, COLLISION_FIRSTGID);
}

function placePropPrefab(region, gx, gy, localTile, w, h, solid = false) {
  const { x, y } = toLocal(region, gx, gy);
  if (x < -w || y < -h || x >= REGION_TILES || y >= REGION_TILES) return;
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      setTile(region.decor, x + xx, y + yy, propGid(localTile + yy * TILESET_COLUMNS + xx));
      if (solid) setTile(region.collision, x + xx, y + yy, COLLISION_FIRSTGID);
    }
  }
}

function placeBuilding(region, gx, gy, key, objectName) {
  const prefab = BUILDINGS[key];
  if (!prefab) return;
  const { x, y } = toLocal(region, gx, gy);
  if (x < -prefab.w || y < -prefab.h || x >= REGION_TILES || y >= REGION_TILES) return;
  for (let yy = 0; yy < prefab.h; yy += 1) {
    for (let xx = 0; xx < prefab.w; xx += 1) {
      setTile(region.buildings, x + xx, y + yy, buildingGid(prefab.start + yy * TILESET_COLUMNS + xx));
      setTile(region.collision, x + xx, y + yy, COLLISION_FIRSTGID);
    }
  }
  fillRectLayer(region.collision, x + Math.floor(prefab.w / 2) - 1, y + prefab.h - 1, 3, 2, 0);
  region.objects.landmarks.push(rectObject(objectName, x, y, prefab.w, prefab.h, {
    type: 'building',
    buildingType: key,
    displayName: prefab.label,
    showOnMap: false,
    debugOnly: true,
  }));
}

function placeRoadPatch(region, gx, gy, radius, plaza = false) {
  const biome = biomeFor(gx, gy);
  const { x: cx, y: cy } = toLocal(region, gx, gy);
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) continue;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= radius) {
        setTile(region.roads, x, y, gid(biome, plaza ? TILES.plaza : TILES.road));
        if (getTile(region.collision, x, y) === COLLISION_FIRSTGID && getTile(region.water, x, y)) setTile(region.collision, x, y, 0);
      }
    }
  }
}

function placeFenceLine(region, gx, gy, length, horizontal = true) {
  for (let i = 0; i < length; i += 1) placeProp(region, gx + (horizontal ? i : 0), gy + (horizontal ? 0 : i), horizontal ? PROPS.fenceH : PROPS.fenceV, true);
}

function placeNaturalDecor(region) {
  for (let y = 2; y < REGION_TILES - 2; y += 5) {
    for (let x = 2; x < REGION_TILES - 2; x += 5) {
      const gx = region.worldX + x;
      const gy = region.worldY + y;
      const sample = sampleWorld(gx, gy);
      if (sample.water || sample.bridge || landmarkAt(gx, gy) || sample.road?.distance < 18) continue;
      const biome = sample.biome;
      const n = hash(gx, gy, 100);
      const mountain = sample.mountain;
      if (n > 0.997 && biome.density > 0.5) placePropPrefab(region, gx, gy, PROPS.forestCluster3x3, 3, 3, false);
      else if (n > 0.988 && ['starter_forest', 'old_forest', 'wild_end'].includes(biome.id)) placePropPrefab(region, gx, gy, PROPS.oak2x2, 2, 2, false);
      else if (n > 0.986 && ['mountain_pass', 'rocky_highlands'].includes(biome.id)) placeProp(region, gx, gy, PROPS.rockLarge, false);
      else if (n > 0.984 && biome.id === 'swamp') placeProp(region, gx, gy, PROPS.reeds, false);
      else if (n > 0.982 && biome.id === 'ancient_ruins') placeProp(region, gx, gy, PROPS.ruinsPillar, false);
      else if (n > 0.978 && mountain < 0.25) placeProp(region, gx, gy, ['old_forest', 'starter_forest'].includes(biome.id) ? PROPS.stump : PROPS.rockSmall, false);
      else if (n > 0.972 && biome.density > 0.45) placeProp(region, gx, gy, PROPS.log, false);
    }
  }
}

function placeBridges(region) {
  for (const bridge of BRIDGES) {
    if (!inRegion(region, bridge.x, bridge.y, 12)) continue;
    const start = bridge.orientation === 'horizontal' ? PROPS.bridgeH : PROPS.bridgeV;
    placePropPrefab(region, bridge.x - Math.floor(bridge.w / 2), bridge.y - Math.floor(bridge.h / 2), start, bridge.orientation === 'horizontal' ? 4 : 2, bridge.orientation === 'horizontal' ? 2 : 4, false);
    const { x, y } = toLocal(region, bridge.x - Math.floor(bridge.w / 2), bridge.y - Math.floor(bridge.h / 2));
    fillRectLayer(region.collision, x - 2, y - 2, bridge.w + 4, bridge.h + 4, 0);
    region.objects.landmarks.push(rectObject(`landmark_${bridge.id}`, x, y, bridge.w, bridge.h, {
      type: 'landmark',
      landmarkId: bridge.id,
      displayName: bridge.id.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' '),
      showOnMap: false,
      debugOnly: false,
    }));
  }
}

function placeRegionalDetails(region) {
  const theme = region.theme;
  const centerX = region.worldX + REGION_TILES / 2;
  const centerY = region.worldY + REGION_TILES / 2;
  region.objects.regionMarkers.push(rectObject(`region_marker_${region.rx}_${region.ry}`, 0, 0, REGION_TILES, REGION_TILES, {
    type: 'region',
    zoneId: theme.id,
    regionId: `world_region_${region.rx}_${region.ry}`,
    displayName: theme.name,
    biomeId: theme.biome,
    biomeType: theme.biome,
    description: theme.role,
    role: theme.role,
    recommendedLevel: Math.max(1, 1 + region.ry * 3 + Math.floor(region.rx / 2)),
    showOnMap: true,
    debugOnly: false,
  }));

  if (theme.name.includes('Farms') || theme.name.includes('Countryside') || theme.name.includes('Southbarley')) {
    for (let i = 0; i < 7; i += 1) {
      const gx = centerX - 160 + i * 48 + Math.floor((hash(i, region.rx, 20) - 0.5) * 40);
      const gy = centerY + 120 + Math.floor((hash(i, region.ry, 21) - 0.5) * 90);
      const { x, y } = toLocal(region, gx, gy);
      fillRectLayer(region.terrainDetails, x, y, 24, 18, gid(BIOME_BY_ID.countryside, TILES.crop));
      placeFenceLine(region, gx - 1, gy - 1, 26, true);
      placeFenceLine(region, gx - 1, gy + 18, 26, true);
      placeFenceLine(region, gx - 1, gy, 18, false);
      placeFenceLine(region, gx + 24, gy, 18, false);
    }
  }

  if (theme.name.includes('Lake') || theme.name.includes('Coast') || theme.name.includes('Harbor')) {
    for (let i = 0; i < 5; i += 1) {
      const gx = centerX + Math.floor((hash(i, region.rx, 30) - 0.5) * 460);
      const gy = centerY + Math.floor((hash(i, region.ry, 31) - 0.5) * 460);
      if (isWater(gx, gy) || nearestRiver(gx, gy)?.distance < 28 || landScore(gx, gy) < 0.2) {
        placePropPrefab(region, gx, gy, PROPS.dock, 4, 2, false);
        placePropPrefab(region, gx + 5, gy + 2, PROPS.boat, 3, 2, false);
      }
    }
  }

  for (let i = 0; i < 10; i += 1) {
    const gx = centerX + Math.floor((hash(i, region.rx, 41) - 0.5) * 620);
    const gy = centerY + Math.floor((hash(i, region.ry, 42) - 0.5) * 620);
    const road = nearestRoad(gx, gy);
    if (!road || road.distance > road.road.width + 10 || isWater(gx, gy)) continue;
    if (hash(gx, gy, 43) > 0.55) {
      placeProp(region, gx + 2, gy + 2, PROPS.sign, false);
      placeProp(region, gx - 3, gy + 4, PROPS.barrel, false);
    } else {
      placeProp(region, gx - 2, gy + 3, PROPS.campfire, false);
      placeProp(region, gx + 4, gy + 5, PROPS.log, false);
    }
  }

  if (['starter_forest', 'old_forest', 'wild_end'].includes(theme.biome)) {
    for (let i = 0; i < 9; i += 1) {
      const gx = centerX + Math.floor((hash(i, region.rx, 50) - 0.5) * 620);
      const gy = centerY + Math.floor((hash(i, region.ry, 51) - 0.5) * 620);
      if (isWater(gx, gy) || nearestRoad(gx, gy)?.distance < 20) continue;
      placeProp(region, gx - 4, gy - 2, PROPS.stump, false);
      placeProp(region, gx + 3, gy + 1, PROPS.log, false);
      placeProp(region, gx, gy + 6, PROPS.mushroom, false);
    }
  }

  if (theme.biome === 'ancient_ruins') {
    for (let i = 0; i < 11; i += 1) {
      const gx = centerX + Math.floor((hash(i, region.rx, 60) - 0.5) * 640);
      const gy = centerY + Math.floor((hash(i, region.ry, 61) - 0.5) * 640);
      if (isWater(gx, gy) || nearestRoad(gx, gy)?.distance < 12) continue;
      placeProp(region, gx, gy, i % 2 ? PROPS.ruinsPillar : PROPS.ruinsWall, false);
    }
  }

  if (theme.biome === 'swamp') {
    for (let i = 0; i < 12; i += 1) {
      const gx = centerX + Math.floor((hash(i, region.rx, 70) - 0.5) * 620);
      const gy = centerY + Math.floor((hash(i, region.ry, 71) - 0.5) * 620);
      const river = nearestRiver(gx, gy);
      if (!isWater(gx, gy) && (!river || river.distance > 24)) continue;
      placeProp(region, gx + 2, gy + 2, PROPS.reeds, false);
      if (i % 4 === 0) placeProp(region, gx - 3, gy + 3, PROPS.rockSmall, false);
    }
  }
}

function placeLandmark(region, landmark) {
  if (!inRegion(region, landmark.x, landmark.y, 0)) return;
  placeRoadPatch(region, landmark.x, landmark.y, Math.max(12, Math.floor(landmark.radius / 4)), landmark.kind === 'city' || landmark.kind === 'town');
  const { x, y } = toLocal(region, landmark.x, landmark.y);
  region.objects.landmarks.push(pointObject(`marker_${landmark.id}`, x, y, {
    type: 'landmark',
    landmarkId: landmark.id,
    displayName: landmark.displayName,
    landmarkKind: landmark.kind,
    showOnMap: Boolean(landmark.showOnMap),
    debugOnly: false,
  }));
  if (landmark.transitionTarget) {
    region.objects.transitions.push(rectObject(`transition_${landmark.id}`, x - 2, y - 2, 4, 4, {
      type: 'transition',
      transitionKind: landmark.kind,
      target: landmark.transitionTarget,
      displayName: landmark.displayName,
      showOnMap: true,
      debugOnly: false,
    }));
  }

  const plans = getLandmarkPlan(landmark);
  for (const item of plans.buildings) placeBuilding(region, landmark.x + item.x, landmark.y + item.y, item.key, `${landmark.id}_${item.key}_${item.x}_${item.y}`);
  for (const item of plans.props) {
    if (item.prefab) placePropPrefab(region, landmark.x + item.x, landmark.y + item.y, item.tile, item.w, item.h, Boolean(item.solid));
    else placeProp(region, landmark.x + item.x, landmark.y + item.y, item.tile, Boolean(item.solid));
  }
  for (const fence of plans.fences) placeFenceLine(region, landmark.x + fence.x, landmark.y + fence.y, fence.length, fence.horizontal);
  for (const field of plans.fields) {
    const { x: fx, y: fy } = toLocal(region, landmark.x + field.x, landmark.y + field.y);
    fillRectLayer(region.terrainDetails, fx, fy, field.w, field.h, gid(BIOME_BY_ID.countryside, TILES.crop));
  }
}

function getLandmarkPlan(landmark) {
  const base = { buildings: [], props: [], fences: [], fields: [] };
  const marketProps = [
    { x: -12, y: 8, tile: PROPS.marketStall, prefab: true, w: 2, h: 2 },
    { x: -5, y: 10, tile: PROPS.marketStall, prefab: true, w: 2, h: 2 },
    { x: 10, y: 8, tile: PROPS.marketStall, prefab: true, w: 2, h: 2 },
    { x: 2, y: -2, tile: PROPS.well },
    { x: -18, y: -10, tile: PROPS.lamp },
    { x: 18, y: -10, tile: PROPS.lamp },
    { x: -18, y: 18, tile: PROPS.lamp },
    { x: 18, y: 18, tile: PROPS.lamp },
  ];
  if (landmark.kind === 'city') {
    base.buildings.push(
      { key: 'townHall', x: -4, y: -22 },
      { key: 'inn', x: -22, y: -5 },
      { key: 'shop', x: 14, y: -5 },
      { key: 'chapel', x: -3, y: 16 },
      { key: 'blacksmith', x: 26, y: 16 },
      { key: 'stable', x: -30, y: 22 },
      { key: 'warehouse', x: -36, y: -22 },
      { key: 'barracks', x: 32, y: -24 },
      { key: 'farmhouse', x: -44, y: 8 },
      { key: 'shop', x: 42, y: 4 },
      { key: 'warehouse', x: 10, y: 34 },
      { key: 'farmhouse', x: -50, y: -10 },
    );
    base.props.push(
      ...marketProps,
      { x: -36, y: 34, tile: PROPS.crate },
      { x: -33, y: 35, tile: PROPS.barrel },
      { x: 30, y: 36, tile: PROPS.flowerPatch },
      { x: 37, y: 36, tile: PROPS.flowerPatch },
      { x: 0, y: 30, tile: PROPS.sign },
    );
    base.fences.push(
      { x: -56, y: -36, length: 112, horizontal: true },
      { x: -56, y: 42, length: 112, horizontal: true },
      { x: -56, y: -36, length: 78, horizontal: false },
      { x: 56, y: -36, length: 78, horizontal: false },
    );
  } else if (landmark.kind === 'town') {
    base.buildings.push(
      { key: 'townHall', x: -4, y: -18 },
      { key: 'inn', x: -18, y: 4 },
      { key: 'shop', x: 12, y: 6 },
      { key: 'stable', x: -28, y: 20 },
      { key: 'blacksmith', x: 22, y: -16 },
      { key: 'farmhouse', x: -34, y: -10 },
    );
    base.props.push(...marketProps.slice(0, 5), { x: 18, y: 22, tile: PROPS.crate }, { x: -24, y: 28, tile: PROPS.hay });
  } else if (landmark.kind === 'village') {
    base.buildings.push(
      { key: 'inn', x: -12, y: -10 },
      { key: 'farmhouse', x: 12, y: -4 },
      { key: 'stable', x: -24, y: 12 },
      { key: 'shop', x: 16, y: 16 },
    );
    base.props.push(
      { x: -2, y: 8, tile: PROPS.well },
      { x: -16, y: -16, tile: PROPS.sign },
      { x: -20, y: 22, tile: PROPS.hay },
      { x: 28, y: 22, tile: PROPS.flowerPatch },
      { x: 7, y: 18, tile: PROPS.marketStall, prefab: true, w: 2, h: 2 },
    );
    base.fences.push({ x: -32, y: -22, length: 64, horizontal: true }, { x: -32, y: 34, length: 64, horizontal: true });
  } else if (landmark.kind === 'harbor') {
    base.buildings.push(
      { key: 'warehouse', x: -18, y: -12 },
      { key: 'inn', x: 8, y: -16 },
      { key: 'shop', x: -6, y: 14 },
    );
    base.props.push(
      { x: 18, y: 18, tile: PROPS.dock, prefab: true, w: 4, h: 2 },
      { x: 25, y: 22, tile: PROPS.boat, prefab: true, w: 3, h: 2 },
      { x: -18, y: 10, tile: PROPS.crate },
      { x: -15, y: 12, tile: PROPS.barrel },
      { x: -12, y: 14, tile: PROPS.crate },
    );
  } else if (landmark.kind === 'farmstead' || landmark.kind === 'mill') {
    base.buildings.push(
      { key: 'farmhouse', x: -4, y: -8 },
      { key: 'stable', x: 13, y: -4 },
    );
    base.fields.push({ x: -38, y: -22, w: 24, h: 18 }, { x: -38, y: 8, w: 26, h: 20 }, { x: 26, y: 10, w: 24, h: 18 });
    base.fences.push({ x: -42, y: -26, length: 33, horizontal: true }, { x: -42, y: 30, length: 33, horizontal: true }, { x: 22, y: 6, length: 30, horizontal: true });
    base.props.push({ x: 6, y: 9, tile: PROPS.hay }, { x: 10, y: 10, tile: PROPS.cart }, { x: -8, y: 11, tile: PROPS.well });
  } else if (landmark.kind === 'lodge') {
    base.buildings.push({ key: 'farmhouse', x: -8, y: -10 }, { key: 'stable', x: 12, y: 6 });
    base.props.push(
      { x: -20, y: 10, tile: PROPS.log },
      { x: -18, y: -16, tile: PROPS.stump },
      { x: 16, y: -14, tile: PROPS.campfire },
      { x: -2, y: 14, tile: PROPS.sign },
    );
  } else if (['fort', 'fortress'].includes(landmark.kind)) {
    base.buildings.push(
      { key: landmark.kind === 'fortress' ? 'townHall' : 'barracks', x: -5, y: -14 },
      { key: 'barracks', x: 16, y: 8 },
      { key: 'stable', x: -26, y: 12 },
      { key: 'blacksmith', x: 12, y: -18 },
    );
    base.fences.push({ x: -36, y: -28, length: 72, horizontal: true }, { x: -36, y: 32, length: 72, horizontal: true }, { x: -36, y: -28, length: 60, horizontal: false }, { x: 36, y: -28, length: 60, horizontal: false });
    base.props.push({ x: -34, y: -30, tile: PROPS.torch }, { x: 34, y: -30, tile: PROPS.torch }, { x: -34, y: 34, tile: PROPS.torch }, { x: 34, y: 34, tile: PROPS.torch });
  } else if (landmark.kind.includes('ruins') || landmark.kind === 'battlefield') {
    base.buildings.push({ key: 'chapel', x: -8, y: -12 }, { key: 'barracks', x: 18, y: 5 });
    base.props.push(
      { x: -26, y: -14, tile: PROPS.ruinsPillar },
      { x: -18, y: 12, tile: PROPS.ruinsWall },
      { x: 18, y: -22, tile: PROPS.ruinsPillar },
      { x: 30, y: 14, tile: PROPS.ruinsWall },
      { x: -4, y: 20, tile: PROPS.campfire },
    );
  } else if (landmark.kind === 'mining_town') {
    base.buildings.push({ key: 'inn', x: -12, y: -8 }, { key: 'blacksmith', x: 12, y: -6 }, { key: 'warehouse', x: -4, y: 16 });
    base.props.push({ x: 28, y: -12, tile: PROPS.mineEntrance, prefab: true, w: 3, h: 3 }, { x: -24, y: 15, tile: PROPS.cart }, { x: -20, y: 17, tile: PROPS.crate });
  } else if (landmark.kind === 'forest_camp' || landmark.kind === 'roadside_camp') {
    base.props.push(
      { x: -3, y: -2, tile: PROPS.campfire },
      { x: -10, y: 5, tile: PROPS.log },
      { x: 8, y: 5, tile: PROPS.crate },
      { x: 12, y: -3, tile: PROPS.cart },
      { x: -13, y: -6, tile: PROPS.sign },
    );
  } else if (landmark.kind === 'hidden_cabin') {
    base.buildings.push({ key: 'farmhouse', x: -5, y: -8 });
    base.props.push(
      { x: -16, y: 6, tile: PROPS.log },
      { x: 13, y: 7, tile: PROPS.flowerPatch },
      { x: -12, y: -12, tile: PROPS.stump },
      { x: 10, y: -13, tile: PROPS.campfire },
    );
  } else if (landmark.kind === 'hidden_garden' || landmark.kind === 'shrine') {
    base.props.push(
      { x: -2, y: -3, tile: PROPS.ruinsPillar },
      { x: 5, y: -3, tile: PROPS.ruinsPillar },
      { x: -7, y: 7, tile: PROPS.flowerPatch },
      { x: 2, y: 8, tile: PROPS.flowerPatch },
      { x: 10, y: 7, tile: PROPS.flowerPatch },
    );
  } else if (landmark.kind === 'watchtower_ruin') {
    base.buildings.push({ key: 'barracks', x: -4, y: -8 });
    base.props.push({ x: -12, y: -12, tile: PROPS.ruinsWall }, { x: 10, y: 10, tile: PROPS.ruinsPillar }, { x: -10, y: 12, tile: PROPS.campfire });
  } else if (landmark.kind === 'fishing_spot') {
    base.props.push(
      { x: -4, y: -2, tile: PROPS.dock, prefab: true, w: 4, h: 2 },
      { x: 5, y: 3, tile: PROPS.barrel },
      { x: 8, y: 3, tile: PROPS.crate },
      { x: -10, y: 5, tile: PROPS.reeds },
    );
  } else if (landmark.kind === 'cave_mouth') {
    base.props.push({ x: -2, y: -2, tile: PROPS.caveEntrance, prefab: true, w: 3, h: 3 }, { x: 8, y: 5, tile: PROPS.rockLarge }, { x: -8, y: 6, tile: PROPS.rockSmall });
  } else if (landmark.kind === 'cave_entrance' || landmark.kind === 'dungeon_entrance') {
    base.props.push({ x: -2, y: -2, tile: landmark.kind === 'cave_entrance' ? PROPS.caveEntrance : PROPS.mineEntrance, prefab: true, w: 3, h: 3 });
  } else {
    base.buildings.push({ key: 'inn', x: -8, y: -10 }, { key: 'farmhouse', x: 12, y: 4 }, { key: 'stable', x: -18, y: 8 });
    base.props.push({ x: -2, y: 7, tile: PROPS.well }, { x: 18, y: 12, tile: PROPS.cart }, { x: -16, y: -14, tile: PROPS.sign });
  }
  return base;
}

function addRegionMarkers(region) {
  const neighbors = [
    [region.rx - 1, region.ry, 'west'],
    [region.rx + 1, region.ry, 'east'],
    [region.rx, region.ry - 1, 'north'],
    [region.rx, region.ry + 1, 'south'],
  ].filter(([rx, ry]) => rx >= 0 && ry >= 0 && rx < REGION_GRID && ry < REGION_GRID);
  for (const [rx, ry, direction] of neighbors) {
    const markerX = direction === 'west' ? 0 : direction === 'east' ? REGION_TILES - 2 : Math.floor(REGION_TILES / 2);
    const markerY = direction === 'north' ? 0 : direction === 'south' ? REGION_TILES - 2 : Math.floor(REGION_TILES / 2);
    region.objects.regionMarkers.push(rectObject(`region_marker_${region.rx}_${region.ry}_${direction}`, markerX, markerY, 2, 2, {
      type: 'regionNeighbor',
      direction,
      connectsToRegion: `${rx},${ry}`,
      showOnMap: false,
      debugOnly: true,
    }));
  }
}

function addRoadMarkers(region) {
  const edges = [
    { direction: 'west', x: region.worldX, y0: region.worldY, y1: region.worldY + REGION_TILES },
    { direction: 'east', x: region.worldX + REGION_TILES - 1, y0: region.worldY, y1: region.worldY + REGION_TILES },
    { direction: 'north', y: region.worldY, x0: region.worldX, x1: region.worldX + REGION_TILES },
    { direction: 'south', y: region.worldY + REGION_TILES - 1, x0: region.worldX, x1: region.worldX + REGION_TILES },
  ];
  for (const road of ROADS) {
    for (const edge of edges) {
      const samples = [];
      for (let i = 20; i < REGION_TILES; i += 40) {
        const gx = edge.x ?? region.worldX + i;
        const gy = edge.y ?? region.worldY + i;
        if (pathDistance(gx, gy, road.points) <= road.width + 2) samples.push([gx, gy]);
      }
      if (!samples.length) continue;
      const [gx, gy] = samples[Math.floor(samples.length / 2)];
      const { x, y } = toLocal(region, gx, gy);
      const nx = edge.direction === 'west' ? region.rx - 1 : edge.direction === 'east' ? region.rx + 1 : region.rx;
      const ny = edge.direction === 'north' ? region.ry - 1 : edge.direction === 'south' ? region.ry + 1 : region.ry;
      if (nx < 0 || ny < 0 || nx >= REGION_GRID || ny >= REGION_GRID) continue;
      region.objects.roadMarkers.push(rectObject(`road_marker_${road.id}_${region.rx}_${region.ry}_${edge.direction}`, x - 2, y - 2, 4, 4, {
        type: 'roadMarker',
        roadId: road.id,
        connectsToRegion: `${nx},${ny}`,
        showOnMap: false,
        debugOnly: true,
      }));
    }
  }
}

function makeMap(region) {
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
      makeObjectLayer('RegionMarkers', 8, region.objects.regionMarkers),
      makeObjectLayer('RoadMarkers', 9, region.objects.roadMarkers),
      makeObjectLayer('Landmarks', 10, region.objects.landmarks),
      makeObjectLayer('Transitions', 11, region.objects.transitions),
    ],
    nextlayerid: 12,
    nextobjectid: objectId + 1,
    orientation: 'orthogonal',
    properties: [
      { name: 'regionX', type: 'int', value: region.rx },
      { name: 'regionY', type: 'int', value: region.ry },
      { name: 'worldX', type: 'int', value: region.worldX },
      { name: 'worldY', type: 'int', value: region.worldY },
      { name: 'zoneId', type: 'string', value: region.theme.id },
      { name: 'displayName', type: 'string', value: region.theme.name },
      { name: 'biomeId', type: 'string', value: region.theme.biome },
      { name: 'biomeType', type: 'string', value: region.theme.biome },
      { name: 'description', type: 'string', value: region.theme.role },
      { name: 'recommendedLevel', type: 'int', value: Math.max(1, 1 + region.ry * 3 + Math.floor(region.rx / 2)) },
      { name: 'testVersion', type: 'string', value: 'v2' },
    ],
    renderorder: 'right-down',
    tiledversion: '1.11.2',
    tileheight: TILE,
    tilesets: [
      ...BIOMES.map((biome) => ({ firstgid: biome.firstgid, source: `../tilesets/world_v2_${biome.id}.tsx` })),
      { firstgid: BUILDINGS_FIRSTGID, source: '../tilesets/world_v2_buildings.tsx' },
      { firstgid: PROPS_FIRSTGID, source: '../tilesets/world_v2_props.tsx' },
      { firstgid: COLLISION_FIRSTGID, source: '../tilesets/collision_debug_v2.tsx' },
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
        fileName: `world_region_${rx}_${ry}_v2.tmj`,
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
    version: 'v2',
    tileSize: TILE,
    worldTiles: { width: WORLD_TILES, height: WORLD_TILES },
    regionTiles: { width: REGION_TILES, height: REGION_TILES },
    regions: REGION_THEMES.map((theme) => ({
      id: `world_region_${theme.rx}_${theme.ry}`,
      zoneId: theme.id,
      file: `world_region_${theme.rx}_${theme.ry}_v2.tmj`,
      x: theme.rx * REGION_TILES,
      y: theme.ry * REGION_TILES,
      width: REGION_TILES,
      height: REGION_TILES,
      displayName: theme.name,
      biomeId: theme.biome,
      biomeType: theme.biome,
      description: theme.role,
      role: theme.role,
      recommendedLevel: Math.max(1, 1 + theme.ry * 3 + Math.floor(theme.rx / 2)),
    })),
    biomes: BIOMES.map(({ id, name, firstgid, density }) => ({ id, name, firstgid, density })),
    roads: ROADS.map(({ id, kind, width, points }) => ({ id, kind, width, points })),
    rivers: RIVERS,
    lakes: LAKES,
    bridges: BRIDGES,
    landmarks: LANDMARKS.map(({ id, displayName, kind, x, y, radius, biome, showOnMap, transitionTarget }) => ({
      id,
      displayName,
      kind,
      x,
      y,
      radius,
      biome,
      showOnMap: Boolean(showOnMap),
      transitionTarget: transitionTarget ?? null,
    })),
  };
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeNotes() {
  return `# World Map V2 Notes

## Scale

- Logical world size: 4000x4000 tiles.
- Tile size: 32px.
- Region split: 5x5.
- Region size: 800x800 tiles.
- Tiled world file: \`public/maps/world_continent_v2.world\`
- Region registry: \`public/maps/world_regions_v2.json\`
- Region files: \`public/maps/world_region_X_Y_v2.tmj\`

## Regions

${REGION_THEMES.map((theme) => `- \`${theme.rx},${theme.ry}\`: ${theme.name} - ${theme.role}`).join('\n')}

## Biomes

${BIOMES.map((biome) => `- \`${biome.id}\`: ${biome.name}, tileset \`world_v2_${biome.id}.tsx\``).join('\n')}

## Landmarks

${LANDMARKS.map((landmark) => `- \`${landmark.id}\`: ${landmark.displayName}, ${landmark.kind}, world tile ${landmark.x},${landmark.y}${landmark.transitionTarget ? `, transition target \`${landmark.transitionTarget}\`` : ''}`).join('\n')}

## Layers

- \`Ground\`: base biome terrain.
- \`Water\`: rivers, lakes, ocean, shallow water.
- \`TerrainDetails\`: banks, flowers, tall grass, crops, road edge blends, ruin floor detail.
- \`Roads\`: main roads, trails, mountain passes, plaza tiles.
- \`Decor\`: foliage, props, fences, bridges, docks, boats, rocks, ruins props.
- \`Buildings\`: multi-tile prefab buildings.
- \`Collision\`: hidden gameplay collision. V2 keeps collision minimal: water, buildings, and fences. Bridges clear water collision.
- \`RegionMarkers\`: region identity and neighbor debug markers.
- \`RoadMarkers\`: debug-only road continuation markers at region borders.
- \`Landmarks\`: player-facing landmark/building markers.
- \`Transitions\`: only real transition-like entries such as caves, dungeons, or boat routes.

## Map UI

- Normal map open (\`M\` or minimap click): zone map mode focused on the current or selected zone.
- Right click on the map panel: toggles full world map mode.
- Full world map mode: shows the whole 4000x4000 tile world with biome-colored zones, roads, rivers, lakes, and major landmarks.
- Clicking a zone in full world mode selects that zone, shows its \`displayName\`, and switches back to zone map mode.
- Player-facing names come from \`displayName\`; technical object names and debug markers stay hidden.

## Zone Metadata

Each region marker and registry region contains:

- \`zoneId\`
- \`displayName\`
- \`biomeType\`
- \`description\`
- \`recommendedLevel\`

## Marker Properties

Player-facing marker example:

\`\`\`json
{
  "type": "landmark",
  "landmarkId": "stonebridge_city",
  "displayName": "Stonebridge City",
  "showOnMap": true,
  "debugOnly": false
}
\`\`\`

Road marker example:

\`\`\`json
{
  "type": "roadMarker",
  "roadId": "main_east_road",
  "connectsToRegion": "3,2",
  "showOnMap": false,
  "debugOnly": true
}
\`\`\`

There are no \`road_transition_*\` objects in V2. Roads are seamless world geometry; region streaming should use global coordinates, not teleport objects.

## Adding Enemies And NPCs Later

Add future gameplay layers separately, for example \`EnemySpawns\`, \`NpcSpawns\`, or \`QuestGivers\`. Keep them out of V2 terrain generation unless gameplay placement is being intentionally authored.

Recommended object properties:

- \`spawnId\`
- \`displayName\`
- \`faction\`
- \`minLevel\`
- \`maxLevel\`
- \`population\`
- \`respawnMs\`
- \`debugOnly\`

## Region Streaming Hook

Use \`world_regions_v2.json\` as the registry.

1. Store player position as global world tile or pixel coordinates.
2. Compute region with \`floor(tileX / 800)\`, \`floor(tileY / 800)\`.
3. Load the current region plus neighboring regions.
4. Draw each map at \`region.x * 32\`, \`region.y * 32\`.
5. Collision lookup should resolve global tile coordinates into the correct region-local tile.
6. Bridges are walkable because their generated areas clear water collision.
`;
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
      fs.writeFile(path.join(assetTilesetsDir, `world_v2_${biome.id}.png`), makeBiomeTilesheet(biome)),
      fs.writeFile(path.join(tilesetsDir, `world_v2_${biome.id}.tsx`), makeTsx(`world_v2_${biome.id}`, `world_v2_${biome.id}.png`, BIOME_TILESET_TILES)),
    ]),
    fs.writeFile(path.join(assetTilesetsDir, 'world_v2_buildings.png'), makeBuildingsTilesheet()),
    fs.writeFile(path.join(tilesetsDir, 'world_v2_buildings.tsx'), makeTsx('world_v2_buildings', 'world_v2_buildings.png', BUILDING_TILESET_TILES)),
    fs.writeFile(path.join(assetTilesetsDir, 'world_v2_props.png'), makePropsTilesheet()),
    fs.writeFile(path.join(tilesetsDir, 'world_v2_props.tsx'), makeTsx('world_v2_props', 'world_v2_props.png', PROP_TILESET_TILES, TILESET_COLUMNS, [
      {
        tileId: PROPS.torch,
        frames: [
          { tileId: PROPS.torch, duration: 180 },
          { tileId: PROPS.torchFrame2, duration: 180 },
        ],
      },
      {
        tileId: PROPS.campfire,
        frames: [
          { tileId: PROPS.campfire, duration: 140 },
          { tileId: PROPS.campfireFrame2, duration: 140 },
          { tileId: PROPS.campfireFrame3, duration: 140 },
        ],
      },
    ])),
    fs.writeFile(path.join(assetTilesetsDir, 'collision_debug_v2.png'), makeCollisionTilesheet()),
    fs.writeFile(path.join(tilesetsDir, 'collision_debug_v2.tsx'), makeTsx('collision_debug_v2', 'collision_debug_v2.png', 1, 1)),
  ]);

  for (let ry = 0; ry < REGION_GRID; ry += 1) {
    for (let rx = 0; rx < REGION_GRID; rx += 1) {
      const region = createRegion(rx, ry);
      await writeJson(path.join(mapsDir, `world_region_${rx}_${ry}_v2.tmj`), makeMap(region));
    }
  }

  await writeJson(path.join(mapsDir, 'world_continent_v2.world'), makeWorldFile());
  await writeJson(path.join(mapsDir, 'world_regions_v2.json'), makeRegistry());
  await fs.writeFile(path.join(docsDir, 'world_map_v2_notes.md'), makeNotes());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
