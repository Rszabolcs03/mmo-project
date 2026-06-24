import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const mapsDir = path.join(rootDir, 'public', 'maps');
const mapTilesetsDir = path.join(mapsDir, 'tilesets');
const projectTilesetsDir = path.join(publicDir, 'tilesets');
const assetTilesetsDir = path.join(publicDir, 'assets', 'tilesets');
const docsDir = path.join(rootDir, 'docs');

const TILE = 32;
const BUILDING_COLUMNS = 32;
const BUILDING_ROWS = 64;
const BUILDING_TILE_COUNT = BUILDING_COLUMNS * BUILDING_ROWS;
const PROP_COLUMNS = 16;
const PROP_TILE_COUNT = 256;
const TERRAIN_COLUMNS = 16;
const TERRAIN_TILE_COUNT = 64;

const TERRAIN_FIRSTGID = 1;
const BUILDINGS_FIRSTGID = TERRAIN_FIRSTGID + TERRAIN_TILE_COUNT;
const PROPS_FIRSTGID = BUILDINGS_FIRSTGID + BUILDING_TILE_COUNT;

const TERRAIN = {
  grass: 0,
  grassAlt: 1,
  grassDark: 2,
  dirt: 3,
  path: 4,
  plaza: 5,
  water: 6,
  waterAlt: 7,
  sand: 8,
  crop: 9,
  flowers: 10,
  cobble: 11,
};

const PROPS = {
  barrel: 0,
  crate: 1,
  cart: 2,
  well: 3,
  fenceH: 4,
  fenceV: 5,
  lamp: 6,
  lampFrame2: 7,
  torch: 8,
  torchFrame2: 9,
  campfire: 10,
  campfireFrame2: 11,
  campfireFrame3: 12,
  flowerPatch: 13,
  sign: 14,
  yardBasket: 15,
  marketCrate: 16,
  marketAwning: 17,
  dockCrate: 18,
  ropeCoil: 19,
  hayBale: 20,
  trough: 21,
  anvil: 22,
  woodPile: 23,
  chimneySmoke: 24,
  chimneySmoke2: 25,
  chimneySmoke3: 26,
  smallBench: 27,
  dockPost: 28,
  sacks: 29,
  flowerTub: 30,
  trainingDummy: 31,
  boat: 32,
  dockPlanks: 48,
};

const BUILDING_PREFABS = [
  { id: 'small_cottage', displayName: 'Small Cottage', x: 0, y: 0, w: 3, h: 3, category: 'village', palette: 'thatch', role: 'starter village home' },
  { id: 'medium_house', displayName: 'Medium House', x: 4, y: 0, w: 4, h: 4, category: 'village', palette: 'red', role: 'common town house' },
  { id: 'large_house', displayName: 'Large House', x: 9, y: 0, w: 5, h: 4, category: 'town', palette: 'green', role: 'larger town residence' },
  { id: 'town_hall', displayName: 'Town Hall', x: 15, y: 0, w: 7, h: 6, category: 'civic', palette: 'blue', role: 'large civic centerpiece' },
  { id: 'inn_tavern', displayName: 'Inn / Tavern', x: 23, y: 0, w: 6, h: 5, category: 'town', palette: 'warm', role: 'village inn and social hub' },
  { id: 'blacksmith', displayName: 'Blacksmith', x: 0, y: 7, w: 5, h: 4, category: 'crafting', palette: 'dark', role: 'forge building with chimney' },
  { id: 'chapel_temple', displayName: 'Chapel / Temple', x: 6, y: 7, w: 5, h: 6, category: 'civic', palette: 'stone', role: 'small religious building' },
  { id: 'stable', displayName: 'Stable', x: 12, y: 7, w: 6, h: 4, category: 'farm', palette: 'wood', role: 'animal stable' },
  { id: 'warehouse', displayName: 'Warehouse', x: 19, y: 7, w: 6, h: 5, category: 'dock', palette: 'dock', role: 'storage / trade building' },
  { id: 'farm_house', displayName: 'Farm House', x: 26, y: 7, w: 4, h: 4, category: 'farm', palette: 'farm', role: 'rural farmhouse' },
  { id: 'barn', displayName: 'Barn', x: 0, y: 14, w: 6, h: 5, category: 'farm', palette: 'barn', role: 'large farm barn' },
  { id: 'market_stall_set', displayName: 'Market Stall Set', x: 7, y: 14, w: 5, h: 3, category: 'market', palette: 'canvas', role: 'multi-stall market prefab' },
  { id: 'guard_post', displayName: 'Guard Post', x: 13, y: 14, w: 4, h: 4, category: 'military', palette: 'guard', role: 'small fortified guard hut' },
  { id: 'watchtower', displayName: 'Watchtower', x: 18, y: 14, w: 3, h: 6, category: 'military', palette: 'tower', role: 'vertical town watchtower' },
  { id: 'dock_building', displayName: 'Dock Building', x: 22, y: 14, w: 6, h: 4, category: 'dock', palette: 'dock', role: 'coastal dock office' },
  { id: 'ruined_house_small', displayName: 'Ruined House Small', x: 0, y: 21, w: 4, h: 4, category: 'ruins', palette: 'ruin', role: 'small ruined building variant' },
  { id: 'ruined_house_large', displayName: 'Ruined House Large', x: 5, y: 21, w: 5, h: 4, category: 'ruins', palette: 'ruin', role: 'large ruined building variant' },
  { id: 'city_house_row', displayName: 'City House Row', x: 11, y: 21, w: 8, h: 5, category: 'city', palette: 'mixed', role: 'dense city block / row house' },
  { id: 'gatehouse', displayName: 'Gatehouse', x: 20, y: 21, w: 7, h: 5, category: 'military', palette: 'stone', role: 'larger town gatehouse special' },
  { id: 'asterfall_villa', displayName: 'Asterfall Villa', x: 0, y: 28, w: 6, h: 5, category: 'city', palette: 'slate', role: 'wealthier city residence with garden frontage' },
  { id: 'blue_roof_shop', displayName: 'Blue Roof Shop', x: 7, y: 28, w: 5, h: 4, category: 'city', palette: 'bluegold', role: 'merchant shop variant for city streets' },
  { id: 'apothecary_house', displayName: 'Apothecary House', x: 13, y: 28, w: 4, h: 4, category: 'city', palette: 'teal', role: 'small specialist shop with herb sign' },
  { id: 'corner_townhouse', displayName: 'Corner Townhouse', x: 18, y: 28, w: 5, h: 5, category: 'city', palette: 'burgundy', role: 'corner house for denser street blocks' },
  { id: 'guild_hall', displayName: 'Guild Hall', x: 24, y: 28, w: 7, h: 6, category: 'civic', palette: 'royal', role: 'large guild or command hall for the city hub' },
  { id: 'red_townhouse', displayName: 'Red Townhouse', x: 0, y: 35, w: 4, h: 5, category: 'city', palette: 'red', role: 'vertical townhouse variant' },
  { id: 'green_townhouse', displayName: 'Green Townhouse', x: 5, y: 35, w: 4, h: 5, category: 'city', palette: 'green', role: 'vertical townhouse variant' },
  { id: 'city_bakery', displayName: 'City Bakery', x: 10, y: 35, w: 5, h: 4, category: 'city', palette: 'warm', role: 'small food shop with awning' },
  { id: 'courtyard_house', displayName: 'Courtyard House', x: 16, y: 35, w: 6, h: 5, category: 'city', palette: 'ivory', role: 'residential house with courtyard garden' },
  { id: 'tower_house', displayName: 'Tower House', x: 23, y: 35, w: 4, h: 6, category: 'city', palette: 'tower', role: 'narrow tall city house with small tower roof' },
  { id: 'stone_manse', displayName: 'Stone Manse', x: 27, y: 35, w: 5, h: 5, category: 'civic', palette: 'stoneblue', role: 'stone administrative house variant' },
  { id: 'city_bank', displayName: 'Asterfall Bank', x: 0, y: 42, w: 7, h: 6, category: 'service', palette: 'stoneblue', role: 'bank building with stone frontage and secure vault feel' },
  { id: 'auction_house', displayName: 'Auction House', x: 8, y: 42, w: 8, h: 6, category: 'service', palette: 'royal', role: 'large trading hall for player auctions' },
  { id: 'weaponsmith_shop', displayName: 'Weaponsmith', x: 17, y: 42, w: 5, h: 4, category: 'service', palette: 'dark', role: 'weapon vendor and forge shop' },
  { id: 'armorer_shop', displayName: 'Armorer', x: 23, y: 42, w: 5, h: 4, category: 'service', palette: 'guard', role: 'armor vendor and repair service' },
  { id: 'arcane_shop', displayName: 'Arcane Shop', x: 0, y: 50, w: 5, h: 5, category: 'service', palette: 'bluegold', role: 'mage and caster item vendor' },
  { id: 'alchemy_shop', displayName: 'Alchemy Shop', x: 6, y: 50, w: 5, h: 4, category: 'service', palette: 'teal', role: 'potion and consumable vendor' },
  { id: 'profession_hall', displayName: 'Profession Hall', x: 12, y: 50, w: 7, h: 5, category: 'service', palette: 'ivory', role: 'profession trainer hall' },
  { id: 'tailor_shop', displayName: 'Tailor Shop', x: 20, y: 50, w: 5, h: 4, category: 'service', palette: 'warm', role: 'tailoring trainer and cloth vendor' },
  { id: 'leatherworker_shop', displayName: 'Leatherworker', x: 26, y: 50, w: 5, h: 4, category: 'service', palette: 'green', role: 'leatherworking trainer and workshop' },
  { id: 'fishing_lodge', displayName: 'Fishing Lodge', x: 0, y: 56, w: 5, h: 4, category: 'service', palette: 'dock', role: 'fishing trainer lodge near water' },
  { id: 'mining_office', displayName: 'Mining Office', x: 6, y: 56, w: 5, h: 4, category: 'service', palette: 'stone', role: 'mining trainer and ore office' },
  { id: 'city_storage', displayName: 'City Storage', x: 12, y: 56, w: 6, h: 4, category: 'service', palette: 'dock', role: 'urban warehouse and service storage' },
  { id: 'service_kiosk', displayName: 'Service Kiosk', x: 19, y: 56, w: 3, h: 3, category: 'service', palette: 'canvas', role: 'small plaza service kiosk' },
  { id: 'canal_house', displayName: 'Canal House', x: 23, y: 56, w: 5, h: 4, category: 'city', palette: 'slate', role: 'compact water-adjacent city house' },
].map((prefab) => ({
  ...prefab,
  startTile: prefab.y * BUILDING_COLUMNS + prefab.x,
  collision: { x: 0, y: Math.max(1, Math.floor(prefab.h * 0.38)), w: prefab.w, h: Math.max(1, prefab.h - Math.floor(prefab.h * 0.38)) },
}));

const BUILDING_BY_ID = Object.fromEntries(BUILDING_PREFABS.map((prefab) => [prefab.id, prefab]));

function rgba(hex, alpha = 255) {
  const value = String(hex).replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
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

function hash(x, y = 0, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function put(pixels, width, height, x, y, color) {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= width || py >= height) return;
  const offset = (py * width + px) * 4;
  const alpha = (color[3] ?? 255) / 255;
  const inv = 1 - alpha;
  pixels[offset] = Math.round(color[0] * alpha + pixels[offset] * inv);
  pixels[offset + 1] = Math.round(color[1] * alpha + pixels[offset + 1] * inv);
  pixels[offset + 2] = Math.round(color[2] * alpha + pixels[offset + 2] * inv);
  pixels[offset + 3] = Math.min(255, Math.round((color[3] ?? 255) + pixels[offset + 3] * inv));
}

function fill(pixels, width, height, x, y, w, h, color) {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const ex = Math.min(width, Math.ceil(x + w));
  const ey = Math.min(height, Math.ceil(y + h));
  for (let yy = sy; yy < ey; yy += 1) {
    for (let xx = sx; xx < ex; xx += 1) put(pixels, width, height, xx, yy, color);
  }
}

function line(pixels, width, height, x1, y1, x2, y2, color) {
  let x = Math.round(x1);
  let y = Math.round(y1);
  const tx = Math.round(x2);
  const ty = Math.round(y2);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  while (true) {
    put(pixels, width, height, x, y, color);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function polygon(pixels, width, height, points, color) {
  const minX = Math.max(0, Math.floor(Math.min(...points.map((point) => point[0]))));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map((point) => point[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]))));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map((point) => point[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const xi = points[i][0];
        const yi = points[i][1];
        const xj = points[j][0];
        const yj = points[j][1];
        const intersect = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / Math.max(0.0001, yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      if (inside) put(pixels, width, height, x, y, color);
    }
  }
}

function rectOutline(pixels, width, height, x, y, w, h, color) {
  line(pixels, width, height, x, y, x + w, y, color);
  line(pixels, width, height, x + w, y, x + w, y + h, color);
  line(pixels, width, height, x + w, y + h, x, y + h, color);
  line(pixels, width, height, x, y + h, x, y, color);
}

function tilePixel(prefab) {
  return {
    x: prefab.x * TILE,
    y: prefab.y * TILE,
    w: prefab.w * TILE,
    h: prefab.h * TILE,
  };
}

function paletteFor(prefab) {
  const palettes = {
    thatch: { roof: '#b58b45', roof2: '#d0aa5c', wall: '#c4a170', trim: '#624126', stone: '#8b8375' },
    red: { roof: '#88443b', roof2: '#b45b4d', wall: '#d2b78b', trim: '#5d3b27', stone: '#8d8576' },
    green: { roof: '#536b3d', roof2: '#71854e', wall: '#c9b083', trim: '#513829', stone: '#817b6e' },
    blue: { roof: '#4f647e', roof2: '#6f84a0', wall: '#b8ad95', trim: '#4a392d', stone: '#8b8a82' },
    warm: { roof: '#8a4b32', roof2: '#c06a3d', wall: '#d0ac75', trim: '#5a3823', stone: '#81796a' },
    dark: { roof: '#4a3433', roof2: '#704541', wall: '#9a8062', trim: '#37251d', stone: '#6f6d67' },
    stone: { roof: '#6e6c66', roof2: '#929088', wall: '#a49d8c', trim: '#4d463d', stone: '#77766f' },
    wood: { roof: '#7f5b34', roof2: '#a57945', wall: '#a97943', trim: '#4f321f', stone: '#857b69' },
    dock: { roof: '#6b5138', roof2: '#8b6845', wall: '#9b7144', trim: '#3d2a1e', stone: '#77736a' },
    farm: { roof: '#88562d', roof2: '#b0763f', wall: '#c9ad76', trim: '#614025', stone: '#817767' },
    barn: { roof: '#7d3d33', roof2: '#a85043', wall: '#a44537', trim: '#eee2be', stone: '#716a60' },
    canvas: { roof: '#c84f49', roof2: '#f0d280', wall: '#9c6b3c', trim: '#4b3425', stone: '#82786d' },
    guard: { roof: '#4e5968', roof2: '#758090', wall: '#9b8263', trim: '#46311f', stone: '#777873' },
    tower: { roof: '#6d3f35', roof2: '#9c5b48', wall: '#9b7651', trim: '#3f2c1f', stone: '#6f6d66' },
    ruin: { roof: '#5a4b43', roof2: '#77645b', wall: '#8a8173', trim: '#403832', stone: '#696963' },
    mixed: { roof: '#81423b', roof2: '#517050', wall: '#c4ad84', trim: '#503623', stone: '#82796b' },
    slate: { roof: '#40586f', roof2: '#698299', wall: '#c7b596', trim: '#473527', stone: '#7f7c72' },
    bluegold: { roof: '#355f86', roof2: '#5d8db5', wall: '#d6bd83', trim: '#4e3823', stone: '#827b6f' },
    teal: { roof: '#3f7467', roof2: '#67a190', wall: '#cbb987', trim: '#4a3527', stone: '#7b776c' },
    burgundy: { roof: '#74343f', roof2: '#a34e5b', wall: '#c9a980', trim: '#4d3224', stone: '#82786a' },
    royal: { roof: '#3b4f79', roof2: '#697ea8', wall: '#bcb39f', trim: '#47392e', stone: '#85847c' },
    ivory: { roof: '#7f6042', roof2: '#ad8155', wall: '#d5c5a2', trim: '#5b3b26', stone: '#8b8275' },
    stoneblue: { roof: '#536577', roof2: '#7d8fa0', wall: '#aaa59a', trim: '#4d4942', stone: '#76766f' },
  };
  return palettes[prefab.palette] ?? palettes.red;
}

function drawWindow(pixels, width, height, x, y, w = 10, h = 11, lit = true) {
  fill(pixels, width, height, x - 1, y - 1, w + 2, h + 2, rgba('#3b2a20', 230));
  fill(pixels, width, height, x, y, w, h, lit ? rgba('#f1d68a') : rgba('#5a665f'));
  line(pixels, width, height, x + Math.floor(w / 2), y, x + Math.floor(w / 2), y + h - 1, rgba('#6a452a'));
  line(pixels, width, height, x, y + Math.floor(h / 2), x + w - 1, y + Math.floor(h / 2), rgba('#6a452a'));
}

function drawDoor(pixels, width, height, x, y, w = 14, h = 22, color = '#4f3020') {
  fill(pixels, width, height, x - 2, y - 3, w + 4, h + 4, rgba('#2c2119', 210));
  fill(pixels, width, height, x, y, w, h, rgba(color));
  line(pixels, width, height, x + Math.floor(w / 2), y + 2, x + Math.floor(w / 2), y + h - 2, rgba('#7a5233'));
  put(pixels, width, height, x + w - 4, y + Math.floor(h / 2), rgba('#e0c779'));
}

function drawChimney(pixels, width, height, x, y, color = '#73503c') {
  fill(pixels, width, height, x - 1, y - 1, 9, 14, rgba('#2b201b', 120));
  fill(pixels, width, height, x, y, 7, 13, rgba(color));
  fill(pixels, width, height, x - 1, y, 9, 3, rgba('#4b3328'));
}

function drawDormer(pixels, width, height, x, y, palette) {
  polygon(pixels, width, height, [[x - 10, y + 14], [x, y], [x + 10, y + 14], [x + 7, y + 18], [x - 7, y + 18]], rgba(palette.roof2));
  fill(pixels, width, height, x - 5, y + 13, 10, 9, rgba(palette.wall));
  drawWindow(pixels, width, height, x - 3, y + 15, 6, 6);
}

function drawGableRoof(pixels, width, height, left, top, right, eave, palette, ridgeOffset = 0) {
  const center = Math.floor((left + right) / 2) + ridgeOffset;
  const roof = rgba(palette.roof);
  const roof2 = rgba(palette.roof2);
  const dark = blend(roof, rgba('#1d1713'), 0.25);
  polygon(pixels, width, height, [[left, eave], [center, top], [center, eave + 10], [left + 4, eave + 14]], dark);
  polygon(pixels, width, height, [[center, top], [right, eave], [right - 4, eave + 14], [center, eave + 10]], roof);
  line(pixels, width, height, center, top, center, eave + 10, roof2);
  line(pixels, width, height, left, eave, center, top, rgba('#38251f'));
  line(pixels, width, height, center, top, right, eave, rgba('#3f2a22'));
  for (let yy = top + 8; yy < eave + 10; yy += 7) {
    line(pixels, width, height, left + 8, yy + 3, right - 8, yy - 3, blend(roof2, rgba('#ffffff'), 0.05));
  }
  fill(pixels, width, height, left + 4, eave + 9, right - left - 8, 4, rgba('#2f211a', 160));
}

function drawWalls(pixels, width, height, left, top, right, bottom, palette, options = {}) {
  const wall = rgba(palette.wall);
  const wallDark = blend(wall, rgba('#4a3326'), 0.22);
  fill(pixels, width, height, left, top, right - left, bottom - top, wall);
  fill(pixels, width, height, left, bottom - 7, right - left, 7, wallDark);
  rectOutline(pixels, width, height, left, top, right - left, bottom - top, rgba('#3f3027', 180));
  if (options.timbers !== false) {
    for (let xx = left + 12; xx < right - 8; xx += 22) {
      fill(pixels, width, height, xx, top + 2, 3, bottom - top - 3, rgba(palette.trim));
    }
    line(pixels, width, height, left + 5, top + 6, right - 6, bottom - 9, rgba(palette.trim));
    line(pixels, width, height, right - 8, top + 6, left + 6, bottom - 9, rgba(palette.trim));
  }
}

function drawHouseLike(pixels, width, height, prefab, options = {}) {
  const p = paletteFor(prefab);
  const box = tilePixel(prefab);
  const left = box.x + 6;
  const right = box.x + box.w - 6;
  const top = box.y + 5;
  const bottom = box.y + box.h - 6;
  const wallTop = top + Math.floor(box.h * (options.wallRatio ?? 0.48));
  fill(pixels, width, height, left + 5, bottom - 10, right - left - 4, 10, rgba('#000000', 65));
  drawWalls(pixels, width, height, left + 4, wallTop - 3, right - 4, bottom - 4, p, options);
  drawGableRoof(pixels, width, height, left, top, right, wallTop + 4, p, options.ridgeOffset ?? 0);
  if (options.porch) {
    fill(pixels, width, height, Math.floor((left + right) / 2) - 18, bottom - 21, 36, 8, rgba('#7f5a34'));
    line(pixels, width, height, Math.floor((left + right) / 2) - 18, bottom - 13, Math.floor((left + right) / 2) + 18, bottom - 13, rgba('#3a271d'));
  }
  drawDoor(pixels, width, height, Math.floor((left + right) / 2) - 7, bottom - 27, 14, 22, options.doorColor ?? '#4f3020');
  const windowY = Math.min(bottom - 35, wallTop + 10);
  if (prefab.w >= 4) {
    drawWindow(pixels, width, height, left + 15, windowY, 10, 10);
    drawWindow(pixels, width, height, right - 27, windowY, 10, 10);
  } else {
    drawWindow(pixels, width, height, left + 10, windowY, 9, 9);
  }
  if (prefab.h >= 4 || options.chimney !== false) drawChimney(pixels, width, height, right - 31, top + 18, p.stone);
  if (prefab.w >= 4) drawDormer(pixels, width, height, Math.floor((left + right) / 2) - 20, top + 28, p);
  if (prefab.w >= 5) drawDormer(pixels, width, height, Math.floor((left + right) / 2) + 26, top + 33, p);
  if (options.sign) {
    fill(pixels, width, height, right - 28, bottom - 28, 17, 10, rgba('#6b4028'));
    fill(pixels, width, height, right - 26, bottom - 27, 13, 7, rgba('#e3c27a'));
  }
}

function drawTownHall(pixels, width, height, prefab) {
  drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.43, timbers: false, porch: true, ridgeOffset: -8 });
  const p = paletteFor(prefab);
  const box = tilePixel(prefab);
  const cx = box.x + Math.floor(box.w / 2);
  const baseY = box.y + box.h - 54;
  for (let i = 0; i < 4; i += 1) {
    const archX = box.x + 28 + i * 39;
    fill(pixels, width, height, archX, baseY, 19, 34, rgba('#8e8678'));
    fill(pixels, width, height, archX + 3, baseY + 9, 13, 24, rgba('#3c332d'));
    polygon(pixels, width, height, [[archX + 3, baseY + 12], [archX + 9, baseY + 4], [archX + 16, baseY + 12]], rgba('#3c332d'));
  }
  fill(pixels, width, height, box.x + 22, baseY + 36, box.w * TILE - 44, 7, rgba('#766b5f'));
  fill(pixels, width, height, cx - 20, box.y + 18, 40, 62, rgba(p.wall));
  drawGableRoof(pixels, width, height, cx - 27, box.y + 8, cx + 27, box.y + 45, p);
  fill(pixels, width, height, cx - 11, box.y + 54, 22, 22, rgba('#7b776d'));
  rectOutline(pixels, width, height, cx - 11, box.y + 54, 22, 22, rgba('#3d3834'));
  fill(pixels, width, height, cx - 3, box.y + 61, 6, 6, rgba('#f0d78a'));
  line(pixels, width, height, cx, box.y + 57, cx, box.y + 65, rgba('#3d3834'));
  line(pixels, width, height, cx - 4, box.y + 61, cx + 4, box.y + 61, rgba('#3d3834'));
  fill(pixels, width, height, cx - 40, box.y + 145, 80, 10, rgba('#85745a'));
  drawWindow(pixels, width, height, box.x + 32, box.y + 78, 12, 12);
  drawWindow(pixels, width, height, box.x + box.w * TILE - 45, box.y + 78, 12, 12);
  fill(pixels, width, height, box.x + 18, box.y + 116, 12, 25, rgba('#7c2f2b'));
  fill(pixels, width, height, box.x + box.w * TILE - 30, box.y + 116, 12, 25, rgba('#7c2f2b'));
}

function drawInn(pixels, width, height, prefab) {
  drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.45, porch: true, sign: true, ridgeOffset: 5 });
  const box = tilePixel(prefab);
  fill(pixels, width, height, box.x + 22, box.y + box.h - 36, 15, 8, rgba('#d86a4a'));
  fill(pixels, width, height, box.x + box.w - 47, box.y + box.h - 36, 15, 8, rgba('#d86a4a'));
  for (let i = 0; i < 3; i += 1) drawWindow(pixels, width, height, box.x + 48 + i * 25, box.y + 72, 9, 9);
}

function drawBlacksmith(pixels, width, height, prefab) {
  drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.44, timbers: true, doorColor: '#2b211c' });
  const box = tilePixel(prefab);
  fill(pixels, width, height, box.x + 20, box.y + box.h - 41, 26, 15, rgba('#302725'));
  fill(pixels, width, height, box.x + 24, box.y + box.h - 45, 17, 7, rgba('#d37b36'));
  fill(pixels, width, height, box.x + box.w - 40, box.y + box.h - 35, 13, 8, rgba('#383737'));
  line(pixels, width, height, box.x + box.w - 45, box.y + box.h - 27, box.x + box.w - 22, box.y + box.h - 27, rgba('#272727'));
}

function drawChapel(pixels, width, height, prefab) {
  drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.38, timbers: false, chimney: false, ridgeOffset: 0 });
  const p = paletteFor(prefab);
  const box = tilePixel(prefab);
  const cx = box.x + Math.floor(box.w / 2);
  fill(pixels, width, height, cx - 15, box.y + 12, 30, 55, rgba(p.wall));
  drawGableRoof(pixels, width, height, cx - 22, box.y + 2, cx + 22, box.y + 36, p);
  line(pixels, width, height, cx, box.y + 5, cx, box.y + 22, rgba('#f1e6bc'));
  line(pixels, width, height, cx - 8, box.y + 14, cx + 8, box.y + 14, rgba('#f1e6bc'));
  drawWindow(pixels, width, height, cx - 5, box.y + 75, 10, 16);
}

function drawStable(pixels, width, height, prefab) {
  const p = paletteFor(prefab);
  const box = tilePixel(prefab);
  const left = box.x + 6;
  const right = box.x + box.w - 6;
  const top = box.y + 8;
  const bottom = box.y + box.h - 6;
  fill(pixels, width, height, left + 5, bottom - 10, right - left - 4, 10, rgba('#000000', 65));
  drawWalls(pixels, width, height, left + 4, top + 47, right - 4, bottom - 4, p);
  drawGableRoof(pixels, width, height, left, top, right, top + 58, p);
  for (let i = 0; i < 3; i += 1) {
    fill(pixels, width, height, left + 20 + i * 42, bottom - 37, 25, 29, rgba('#49321f'));
    line(pixels, width, height, left + 20 + i * 42, bottom - 21, left + 44 + i * 42, bottom - 21, rgba('#7d5a38'));
  }
}

function drawBarn(pixels, width, height, prefab) {
  drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.40, timbers: false, chimney: false });
  const box = tilePixel(prefab);
  const cx = box.x + Math.floor(box.w / 2);
  fill(pixels, width, height, cx - 18, box.y + box.h - 54, 36, 44, rgba('#5e2f27'));
  line(pixels, width, height, cx - 18, box.y + box.h - 54, cx + 18, box.y + box.h - 10, rgba('#eee2be'));
  line(pixels, width, height, cx + 18, box.y + box.h - 54, cx - 18, box.y + box.h - 10, rgba('#eee2be'));
  line(pixels, width, height, cx, box.y + box.h - 54, cx, box.y + box.h - 10, rgba('#eee2be'));
}

function drawMarketSet(pixels, width, height, prefab) {
  const box = tilePixel(prefab);
  fill(pixels, width, height, box.x + 10, box.y + box.h - 12, box.w * TILE - 20, 8, rgba('#000000', 55));
  const tents = [
    { x: box.x + 10, y: box.y + 28, w: 42, color: '#b8463f' },
    { x: box.x + 60, y: box.y + 20, w: 44, color: '#d8c070' },
    { x: box.x + 108, y: box.y + 31, w: 38, color: '#537d5c' },
  ];
  tents.forEach((tent, index) => {
    polygon(pixels, width, height, [[tent.x, tent.y + 25], [tent.x + tent.w / 2, tent.y], [tent.x + tent.w, tent.y + 25], [tent.x + tent.w - 4, tent.y + 32], [tent.x + 4, tent.y + 32]], rgba(tent.color));
    for (let stripe = 0; stripe < tent.w; stripe += 12) fill(pixels, width, height, tent.x + stripe, tent.y + 14, 5, 18, rgba('#f1dc9a', 190));
    fill(pixels, width, height, tent.x + 6, tent.y + 34, tent.w - 12, 18, rgba('#7a5433'));
    fill(pixels, width, height, tent.x + 10, tent.y + 39, 11 + index * 2, 8, rgba('#b98e4a'));
  });
}

function drawGuardPost(pixels, width, height, prefab) {
  drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.43, timbers: true, chimney: false });
  const box = tilePixel(prefab);
  fill(pixels, width, height, box.x + 7, box.y + box.h - 22, box.w * TILE - 14, 7, rgba('#5d442d'));
  for (let xx = box.x + 10; xx < box.x + box.w * TILE - 10; xx += 12) {
    polygon(pixels, width, height, [[xx, box.y + box.h - 32], [xx + 5, box.y + box.h - 39], [xx + 10, box.y + box.h - 32], [xx + 10, box.y + box.h - 15], [xx, box.y + box.h - 15]], rgba('#6f5032'));
  }
}

function drawWatchtower(pixels, width, height, prefab) {
  const p = paletteFor(prefab);
  const box = tilePixel(prefab);
  const cx = box.x + Math.floor(box.w * TILE / 2);
  fill(pixels, width, height, box.x + 16, box.y + box.h - 13, box.w * TILE - 25, 9, rgba('#000000', 70));
  fill(pixels, width, height, cx - 19, box.y + 51, 38, 100, rgba(p.wall));
  for (let yy = box.y + 58; yy < box.y + 145; yy += 16) line(pixels, width, height, cx - 18, yy, cx + 18, yy + 8, rgba(p.trim));
  polygon(pixels, width, height, [[cx - 36, box.y + 55], [cx, box.y + 13], [cx + 36, box.y + 55], [cx + 30, box.y + 70], [cx - 30, box.y + 70]], rgba(p.roof));
  fill(pixels, width, height, cx - 29, box.y + 70, 58, 18, rgba('#6b5134'));
  fill(pixels, width, height, cx - 7, box.y + 129, 14, 24, rgba('#2e2118'));
}

function drawDockBuilding(pixels, width, height, prefab) {
  drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.43, timbers: true, porch: true, chimney: false });
  const box = tilePixel(prefab);
  fill(pixels, width, height, box.x + 11, box.y + box.h - 14, box.w * TILE - 22, 8, rgba('#614226'));
  for (let xx = box.x + 15; xx < box.x + box.w * TILE - 15; xx += 13) {
    line(pixels, width, height, xx, box.y + box.h - 22, xx, box.y + box.h - 6, rgba('#39281c'));
  }
}

function drawRuinedHouse(pixels, width, height, prefab) {
  const p = paletteFor(prefab);
  const box = tilePixel(prefab);
  const left = box.x + 8;
  const top = box.y + 18;
  const right = box.x + box.w * TILE - 8;
  const bottom = box.y + box.h * TILE - 10;
  fill(pixels, width, height, left + 4, bottom - 8, right - left - 8, 8, rgba('#000000', 55));
  polygon(pixels, width, height, [[left, top + 42], [left + 26, top + 23], [left + 50, top + 44], [left + 47, top + 56], [left + 4, top + 58]], rgba(p.roof, 200));
  drawWalls(pixels, width, height, left + 5, top + 54, right - 5, bottom - 4, p, { timbers: false });
  fill(pixels, width, height, left + 22, top + 38, 30, 32, [0, 0, 0, 0]);
  for (let i = 0; i < 30; i += 1) {
    const rx = left + Math.floor(hash(i, prefab.startTile, 1) * (right - left));
    const ry = bottom - 14 + Math.floor(hash(i, prefab.startTile, 2) * 12);
    fill(pixels, width, height, rx, ry, 5, 4, rgba(p.stone));
  }
  line(pixels, width, height, left + 5, top + 54, left + 37, top + 25, rgba('#3f3832'));
  line(pixels, width, height, right - 8, top + 58, right - 39, top + 38, rgba('#3f3832'));
}

function drawCityRow(pixels, width, height, prefab) {
  const box = tilePixel(prefab);
  const segmentW = Math.floor((box.w * TILE - 14) / 3);
  ['red', 'green', 'warm'].forEach((paletteId, index) => {
    const fakePrefab = { ...prefab, palette: paletteId };
    const p = paletteFor(fakePrefab);
    const left = box.x + 7 + index * segmentW;
    const right = left + segmentW - 2;
    const top = box.y + 9 + (index % 2) * 5;
    const bottom = box.y + box.h * TILE - 8;
    fill(pixels, width, height, left + 4, bottom - 8, right - left, 8, rgba('#000000', 55));
    drawWalls(pixels, width, height, left + 3, top + 57, right - 3, bottom - 4, p);
    drawGableRoof(pixels, width, height, left, top, right, top + 66, p, 0);
    drawDoor(pixels, width, height, Math.floor((left + right) / 2) - 6, bottom - 27, 12, 22);
    drawWindow(pixels, width, height, left + 12, bottom - 44, 8, 9);
    drawWindow(pixels, width, height, right - 24, bottom - 44, 8, 9);
  });
}

function drawGatehouse(pixels, width, height, prefab) {
  const p = paletteFor(prefab);
  const box = tilePixel(prefab);
  const left = box.x + 8;
  const right = box.x + box.w * TILE - 8;
  const bottom = box.y + box.h * TILE - 8;
  fill(pixels, width, height, left + 5, bottom - 10, right - left - 4, 10, rgba('#000000', 65));
  const wallTop = box.y + 68;
  drawWalls(pixels, width, height, left + 22, wallTop, right - 22, bottom - 4, p, { timbers: false });
  fill(pixels, width, height, left + 12, box.y + 48, 44, bottom - box.y - 52, rgba(p.wall));
  fill(pixels, width, height, right - 56, box.y + 48, 44, bottom - box.y - 52, rgba(p.wall));
  for (let yy = box.y + 61; yy < bottom - 10; yy += 16) {
    line(pixels, width, height, left + 16, yy, left + 51, yy, rgba('#68645e'));
    line(pixels, width, height, right - 51, yy, right - 16, yy, rgba('#68645e'));
  }
  drawGableRoof(pixels, width, height, left + 7, box.y + 16, left + 61, box.y + 62, p);
  drawGableRoof(pixels, width, height, right - 61, box.y + 16, right - 7, box.y + 62, p);
  polygon(pixels, width, height, [[left + 62, box.y + 70], [right - 62, box.y + 70], [right - 72, box.y + 98], [left + 72, box.y + 98]], rgba(p.roof));
  fill(pixels, width, height, left + 63, wallTop - 9, right - left - 126, 10, rgba('#6f6a61'));
  for (let xx = left + 65; xx < right - 66; xx += 18) fill(pixels, width, height, xx, wallTop - 18, 10, 12, rgba('#767168'));
  const gateX = Math.floor((left + right) / 2) - 23;
  const gateY = bottom - 56;
  fill(pixels, width, height, gateX, gateY + 14, 46, 48, rgba('#2d2521'));
  polygon(pixels, width, height, [[gateX, gateY + 17], [gateX + 23, gateY], [gateX + 46, gateY + 17]], rgba('#2d2521'));
  line(pixels, width, height, gateX + 23, gateY + 5, gateX + 23, bottom - 6, rgba('#5f4a35'));
  for (let i = 0; i < 3; i += 1) {
    drawWindow(pixels, width, height, left + 24, box.y + 70 + i * 19, 8, 8, false);
    drawWindow(pixels, width, height, right - 33, box.y + 70 + i * 19, 8, 8, false);
  }
}

function drawCityShopVariant(pixels, width, height, prefab, options = {}) {
  drawHouseLike(pixels, width, height, prefab, {
    wallRatio: 0.46,
    porch: true,
    sign: true,
    ridgeOffset: options.ridgeOffset ?? 4,
    doorColor: options.doorColor ?? '#523621',
  });
  const box = tilePixel(prefab);
  const p = paletteFor(prefab);
  const awningY = box.y + box.h * TILE - 48;
  fill(pixels, width, height, box.x + 18, awningY, box.w * TILE - 36, 13, rgba(options.awning ?? p.roof2));
  for (let x = box.x + 22; x < box.x + box.w * TILE - 20; x += 15) {
    fill(pixels, width, height, x, awningY, 7, 13, rgba('#f1d990', 205));
  }
  fill(pixels, width, height, box.x + box.w * TILE - 35, box.y + box.h * TILE - 32, 18, 9, rgba('#754a28'));
  fill(pixels, width, height, box.x + box.w * TILE - 32, box.y + box.h * TILE - 30, 12, 5, rgba('#d8bd74'));
}

function drawTownhouseVariant(pixels, width, height, prefab) {
  const p = paletteFor(prefab);
  const box = tilePixel(prefab);
  const left = box.x + 7;
  const right = box.x + box.w * TILE - 7;
  const top = box.y + 8;
  const bottom = box.y + box.h * TILE - 7;
  fill(pixels, width, height, left + 5, bottom - 9, right - left - 4, 9, rgba('#000000', 60));
  drawWalls(pixels, width, height, left + 7, top + 64, right - 7, bottom - 4, p, { timbers: true });
  drawGableRoof(pixels, width, height, left, top, right, top + 74, p);
  for (let floor = 0; floor < 2; floor += 1) {
    const wy = bottom - 79 + floor * 31;
    drawWindow(pixels, width, height, left + 20, wy, 9, 10);
    drawWindow(pixels, width, height, right - 31, wy, 9, 10);
  }
  drawDoor(pixels, width, height, Math.floor((left + right) / 2) - 7, bottom - 27, 14, 22);
  drawChimney(pixels, width, height, right - 27, top + 22, p.stone);
}

function drawCornerTownhouse(pixels, width, height, prefab) {
  drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.42, porch: true, ridgeOffset: -9 });
  const box = tilePixel(prefab);
  const p = paletteFor(prefab);
  const towerX = box.x + box.w * TILE - 51;
  fill(pixels, width, height, towerX, box.y + 46, 34, box.h * TILE - 58, rgba(p.wall));
  polygon(pixels, width, height, [[towerX - 8, box.y + 48], [towerX + 17, box.y + 15], [towerX + 42, box.y + 48], [towerX + 37, box.y + 60], [towerX - 3, box.y + 60]], rgba(p.roof2));
  drawWindow(pixels, width, height, towerX + 9, box.y + 74, 9, 11);
  drawWindow(pixels, width, height, towerX + 9, box.y + 105, 9, 10);
  fill(pixels, width, height, box.x + 14, box.y + box.h * TILE - 42, 24, 10, rgba('#6f4c2e'));
}

function drawGuildHall(pixels, width, height, prefab) {
  const p = paletteFor(prefab);
  const box = tilePixel(prefab);
  const left = box.x + 7;
  const right = box.x + box.w * TILE - 7;
  const bottom = box.y + box.h * TILE - 8;
  fill(pixels, width, height, left + 7, bottom - 10, right - left - 4, 10, rgba('#000000', 70));
  drawWalls(pixels, width, height, left + 17, box.y + 78, right - 17, bottom - 5, p, { timbers: false });
  drawGableRoof(pixels, width, height, left + 10, box.y + 26, right - 10, box.y + 90, p);
  fill(pixels, width, height, box.x + 88, box.y + 24, 48, 90, rgba(p.wall));
  drawGableRoof(pixels, width, height, box.x + 80, box.y + 10, box.x + 144, box.y + 54, p, 0);
  drawDoor(pixels, width, height, box.x + 104, bottom - 31, 18, 26, '#4f3322');
  for (let i = 0; i < 4; i += 1) {
    drawWindow(pixels, width, height, left + 32 + i * 38, bottom - 62, 11, 12);
  }
  fill(pixels, width, height, box.x + 96, box.y + 77, 32, 7, rgba('#857b6d'));
  fill(pixels, width, height, box.x + 102, box.y + 88, 20, 17, rgba('#26364d'));
  line(pixels, width, height, box.x + 112, box.y + 88, box.x + 112, box.y + 105, rgba('#d6c386'));
  line(pixels, width, height, box.x + 104, box.y + 96, box.x + 120, box.y + 96, rgba('#d6c386'));
}

function drawCourtyardHouse(pixels, width, height, prefab) {
  drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.44, porch: true, ridgeOffset: 7 });
  const box = tilePixel(prefab);
  const p = paletteFor(prefab);
  fill(pixels, width, height, box.x + 16, box.y + box.h * TILE - 35, 40, 20, rgba('#7d9a62'));
  fill(pixels, width, height, box.x + 21, box.y + box.h * TILE - 30, 10, 7, rgba('#e7c368'));
  fill(pixels, width, height, box.x + 39, box.y + box.h * TILE - 27, 9, 6, rgba('#d87a79'));
  fill(pixels, width, height, box.x + box.w * TILE - 45, box.y + 45, 29, 38, rgba(p.wall));
  drawGableRoof(pixels, width, height, box.x + box.w * TILE - 51, box.y + 28, box.x + box.w * TILE - 11, box.y + 62, p);
}

function drawTowerHouse(pixels, width, height, prefab) {
  const p = paletteFor(prefab);
  const box = tilePixel(prefab);
  const cx = box.x + Math.floor(box.w * TILE / 2);
  const bottom = box.y + box.h * TILE - 8;
  fill(pixels, width, height, box.x + 18, bottom - 9, box.w * TILE - 30, 9, rgba('#000000', 68));
  drawWalls(pixels, width, height, cx - 28, box.y + 68, cx + 28, bottom - 4, p, { timbers: true });
  polygon(pixels, width, height, [[cx - 42, box.y + 70], [cx, box.y + 19], [cx + 42, box.y + 70], [cx + 35, box.y + 84], [cx - 35, box.y + 84]], rgba(p.roof));
  fill(pixels, width, height, cx - 20, box.y + 26, 40, 46, rgba(p.wall));
  drawGableRoof(pixels, width, height, cx - 27, box.y + 3, cx + 27, box.y + 39, p);
  drawDoor(pixels, width, height, cx - 7, bottom - 28, 14, 23);
  drawWindow(pixels, width, height, cx - 5, box.y + 93, 10, 11);
  drawWindow(pixels, width, height, cx - 5, box.y + 124, 10, 11);
}

function drawStoneManse(pixels, width, height, prefab) {
  drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.40, timbers: false, porch: true, ridgeOffset: -5 });
  const box = tilePixel(prefab);
  const p = paletteFor(prefab);
  fill(pixels, width, height, box.x + 18, box.y + box.h * TILE - 49, box.w * TILE - 36, 9, rgba('#8b8478'));
  for (let i = 0; i < 3; i += 1) {
    const x = box.x + 32 + i * 31;
    fill(pixels, width, height, x, box.y + box.h * TILE - 43, 13, 35, rgba(p.stone));
    rectOutline(pixels, width, height, x, box.y + box.h * TILE - 43, 13, 35, rgba('#4b4842'));
  }
  drawWindow(pixels, width, height, box.x + 28, box.y + 82, 11, 12);
  drawWindow(pixels, width, height, box.x + box.w * TILE - 41, box.y + 82, 11, 12);
}

function drawBank(pixels, width, height, prefab) {
  drawStoneManse(pixels, width, height, prefab);
  const box = tilePixel(prefab);
  const cx = box.x + Math.floor(box.w * TILE / 2);
  fill(pixels, width, height, cx - 38, box.y + box.h * TILE - 62, 76, 13, rgba('#bca867'));
  fill(pixels, width, height, cx - 24, box.y + box.h * TILE - 78, 48, 19, rgba('#6c675f'));
  rectOutline(pixels, width, height, cx - 24, box.y + box.h * TILE - 78, 48, 19, rgba('#3f3a34'));
  fill(pixels, width, height, cx - 4, box.y + box.h * TILE - 74, 8, 11, rgba('#e0c56c'));
  line(pixels, width, height, cx, box.y + box.h * TILE - 76, cx, box.y + box.h * TILE - 62, rgba('#3f3a34'));
  for (let i = 0; i < 4; i += 1) {
    fill(pixels, width, height, box.x + 30 + i * 41, box.y + box.h * TILE - 49, 13, 38, rgba('#837d70'));
    rectOutline(pixels, width, height, box.x + 30 + i * 41, box.y + box.h * TILE - 49, 13, 38, rgba('#47423b'));
  }
}

function drawAuctionHouse(pixels, width, height, prefab) {
  drawGuildHall(pixels, width, height, prefab);
  const box = tilePixel(prefab);
  const cx = box.x + Math.floor(box.w * TILE / 2);
  fill(pixels, width, height, cx - 48, box.y + box.h * TILE - 51, 96, 14, rgba('#8a4f36'));
  for (let i = 0; i < 3; i += 1) {
    const sx = cx - 35 + i * 35;
    fill(pixels, width, height, sx, box.y + box.h * TILE - 59, 20, 18, rgba(i % 2 ? '#d6c078' : '#b94e45'));
    fill(pixels, width, height, sx + 3, box.y + box.h * TILE - 54, 14, 7, rgba('#f0d58c'));
  }
  fill(pixels, width, height, cx - 11, box.y + 50, 22, 18, rgba('#d6c078'));
  line(pixels, width, height, cx - 5, box.y + 54, cx + 5, box.y + 64, rgba('#4b3828'));
  line(pixels, width, height, cx + 5, box.y + 54, cx - 5, box.y + 64, rgba('#4b3828'));
}

function drawSpecialistShop(pixels, width, height, prefab, options = {}) {
  drawCityShopVariant(pixels, width, height, prefab, options);
  const box = tilePixel(prefab);
  const signX = box.x + box.w * TILE - 47;
  const signY = box.y + box.h * TILE - 60;
  fill(pixels, width, height, signX, signY, 24, 18, rgba(options.signBg ?? '#6b4028'));
  rectOutline(pixels, width, height, signX, signY, 24, 18, rgba('#2e2118'));
  if (options.icon === 'sword') {
    line(pixels, width, height, signX + 8, signY + 14, signX + 18, signY + 4, rgba('#d9dce2'));
    line(pixels, width, height, signX + 7, signY + 8, signX + 15, signY + 16, rgba('#8c6238'));
  } else if (options.icon === 'shield') {
    polygon(pixels, width, height, [[signX + 7, signY + 5], [signX + 17, signY + 5], [signX + 16, signY + 13], [signX + 12, signY + 16], [signX + 8, signY + 13]], rgba('#9db0c2'));
  } else if (options.icon === 'arcane') {
    fill(pixels, width, height, signX + 9, signY + 5, 7, 7, rgba('#8be9fd'));
    line(pixels, width, height, signX + 12, signY + 2, signX + 12, signY + 16, rgba('#d6c8ff'));
    line(pixels, width, height, signX + 5, signY + 9, signX + 19, signY + 9, rgba('#d6c8ff'));
  } else if (options.icon === 'potion') {
    fill(pixels, width, height, signX + 10, signY + 4, 7, 4, rgba('#d8d2ca'));
    fill(pixels, width, height, signX + 8, signY + 8, 11, 8, rgba('#63d3b2'));
  } else if (options.icon === 'thread') {
    rectOutline(pixels, width, height, signX + 7, signY + 6, 12, 9, rgba('#f1d58b'));
    line(pixels, width, height, signX + 7, signY + 11, signX + 19, signY + 8, rgba('#e879f9'));
  }
}

function drawBuildingPrefab(pixels, width, height, prefab) {
  switch (prefab.id) {
    case 'town_hall': drawTownHall(pixels, width, height, prefab); break;
    case 'inn_tavern': drawInn(pixels, width, height, prefab); break;
    case 'blacksmith': drawBlacksmith(pixels, width, height, prefab); break;
    case 'chapel_temple': drawChapel(pixels, width, height, prefab); break;
    case 'stable': drawStable(pixels, width, height, prefab); break;
    case 'barn': drawBarn(pixels, width, height, prefab); break;
    case 'market_stall_set': drawMarketSet(pixels, width, height, prefab); break;
    case 'guard_post': drawGuardPost(pixels, width, height, prefab); break;
    case 'watchtower': drawWatchtower(pixels, width, height, prefab); break;
    case 'dock_building': drawDockBuilding(pixels, width, height, prefab); break;
    case 'ruined_house_small':
    case 'ruined_house_large': drawRuinedHouse(pixels, width, height, prefab); break;
    case 'city_house_row': drawCityRow(pixels, width, height, prefab); break;
    case 'gatehouse': drawGatehouse(pixels, width, height, prefab); break;
    case 'blue_roof_shop':
    case 'apothecary_house':
    case 'city_bakery': drawCityShopVariant(pixels, width, height, prefab, { awning: prefab.id === 'apothecary_house' ? '#7abf8c' : undefined }); break;
    case 'corner_townhouse': drawCornerTownhouse(pixels, width, height, prefab); break;
    case 'guild_hall': drawGuildHall(pixels, width, height, prefab); break;
    case 'red_townhouse':
    case 'green_townhouse': drawTownhouseVariant(pixels, width, height, prefab); break;
    case 'courtyard_house': drawCourtyardHouse(pixels, width, height, prefab); break;
    case 'tower_house': drawTowerHouse(pixels, width, height, prefab); break;
    case 'stone_manse': drawStoneManse(pixels, width, height, prefab); break;
    case 'city_bank': drawBank(pixels, width, height, prefab); break;
    case 'auction_house': drawAuctionHouse(pixels, width, height, prefab); break;
    case 'weaponsmith_shop': drawSpecialistShop(pixels, width, height, prefab, { icon: 'sword', awning: '#9b4a36', signBg: '#523621' }); break;
    case 'armorer_shop': drawSpecialistShop(pixels, width, height, prefab, { icon: 'shield', awning: '#69788a', signBg: '#44505c' }); break;
    case 'arcane_shop': drawSpecialistShop(pixels, width, height, prefab, { icon: 'arcane', awning: '#6c64b9', signBg: '#483b78' }); break;
    case 'alchemy_shop': drawSpecialistShop(pixels, width, height, prefab, { icon: 'potion', awning: '#6bc69c', signBg: '#386b58' }); break;
    case 'tailor_shop': drawSpecialistShop(pixels, width, height, prefab, { icon: 'thread', awning: '#d88a5c', signBg: '#76513c' }); break;
    case 'leatherworker_shop': drawSpecialistShop(pixels, width, height, prefab, { icon: 'shield', awning: '#71854e', signBg: '#4f5a34' }); break;
    case 'profession_hall': drawGuildHall(pixels, width, height, prefab); break;
    case 'fishing_lodge': drawDockBuilding(pixels, width, height, prefab); break;
    case 'mining_office': drawStoneManse(pixels, width, height, prefab); break;
    case 'city_storage': drawDockBuilding(pixels, width, height, prefab); break;
    case 'service_kiosk': drawMarketSet(pixels, width, height, prefab); break;
    case 'canal_house': drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.45, porch: true, ridgeOffset: 4 }); break;
    case 'farm_house': drawHouseLike(pixels, width, height, prefab, { wallRatio: 0.45, porch: true }); break;
    case 'warehouse': drawDockBuilding(pixels, width, height, prefab); break;
    case 'asterfall_villa': drawCourtyardHouse(pixels, width, height, prefab); break;
    default: drawHouseLike(pixels, width, height, prefab, {
      wallRatio: prefab.id === 'small_cottage' ? 0.52 : 0.46,
      porch: prefab.w >= 4,
    });
  }
}

function makeBuildingsTilesheet() {
  const width = BUILDING_COLUMNS * TILE;
  const height = BUILDING_ROWS * TILE;
  const pixels = Buffer.alloc(width * height * 4);
  for (const prefab of BUILDING_PREFABS) drawBuildingPrefab(pixels, width, height, prefab);
  return encodePng(width, height, pixels);
}

function drawPropTile(pixels, width, height, tile, draw) {
  const tx = (tile % PROP_COLUMNS) * TILE;
  const ty = Math.floor(tile / PROP_COLUMNS) * TILE;
  draw(tx, ty);
}

function drawPropPrefabBox(pixels, width, height, tile, tw, th, color, trim = '#463020') {
  const tx = (tile % PROP_COLUMNS) * TILE;
  const ty = Math.floor(tile / PROP_COLUMNS) * TILE;
  fill(pixels, width, height, tx + 3, ty + 9, tw * TILE - 6, th * TILE - 13, rgba(color));
  fill(pixels, width, height, tx + 3, ty + 9, tw * TILE - 6, 5, rgba(trim));
  for (let xx = tx + 8; xx < tx + tw * TILE - 8; xx += 12) line(pixels, width, height, xx, ty + 11, xx - 4, ty + th * TILE - 10, rgba(trim, 150));
}

function makePropsTilesheet() {
  const width = PROP_COLUMNS * TILE;
  const height = Math.ceil(PROP_TILE_COUNT / PROP_COLUMNS) * TILE;
  const pixels = Buffer.alloc(width * height * 4);
  drawPropTile(pixels, width, height, PROPS.barrel, (x, y) => {
    fill(pixels, width, height, x + 9, y + 10, 14, 16, rgba('#7c5132'));
    fill(pixels, width, height, x + 8, y + 12, 16, 3, rgba('#3d2a21'));
    fill(pixels, width, height, x + 8, y + 22, 16, 3, rgba('#3d2a21'));
  });
  drawPropTile(pixels, width, height, PROPS.crate, (x, y) => {
    fill(pixels, width, height, x + 7, y + 9, 18, 17, rgba('#8c6338'));
    rectOutline(pixels, width, height, x + 7, y + 9, 18, 17, rgba('#3b2619'));
    line(pixels, width, height, x + 8, y + 10, x + 24, y + 25, rgba('#4f3420'));
    line(pixels, width, height, x + 24, y + 10, x + 8, y + 25, rgba('#4f3420'));
  });
  drawPropTile(pixels, width, height, PROPS.cart, (x, y) => {
    fill(pixels, width, height, x + 5, y + 10, 20, 12, rgba('#7a5233'));
    line(pixels, width, height, x + 5, y + 10, x + 27, y + 6, rgba('#5a3924'));
    line(pixels, width, height, x + 21, y + 22, x + 29, y + 27, rgba('#5a3924'));
    fill(pixels, width, height, x + 7, y + 23, 5, 5, rgba('#2e2118'));
    fill(pixels, width, height, x + 21, y + 21, 5, 5, rgba('#2e2118'));
  });
  drawPropTile(pixels, width, height, PROPS.well, (x, y) => {
    fill(pixels, width, height, x + 7, y + 14, 18, 12, rgba('#77756e'));
    fill(pixels, width, height, x + 6, y + 12, 20, 5, rgba('#9a9487'));
    fill(pixels, width, height, x + 11, y + 5, 3, 10, rgba('#5d3e27'));
    fill(pixels, width, height, x + 20, y + 5, 3, 10, rgba('#5d3e27'));
    polygon(pixels, width, height, [[x + 8, y + 8], [x + 17, y + 2], [x + 26, y + 8], [x + 23, y + 10], [x + 11, y + 10]], rgba('#7f4932'));
  });
  drawPropTile(pixels, width, height, PROPS.fenceH, (x, y) => {
    fill(pixels, width, height, x + 1, y + 13, 30, 4, rgba('#7a5433'));
    fill(pixels, width, height, x + 1, y + 20, 30, 4, rgba('#6b472d'));
    for (let xx = x + 3; xx < x + 30; xx += 9) fill(pixels, width, height, xx, y + 8, 4, 20, rgba('#5c3d27'));
  });
  drawPropTile(pixels, width, height, PROPS.fenceV, (x, y) => {
    fill(pixels, width, height, x + 13, y + 1, 4, 30, rgba('#7a5433'));
    fill(pixels, width, height, x + 20, y + 1, 4, 30, rgba('#6b472d'));
    for (let yy = y + 3; yy < y + 30; yy += 9) fill(pixels, width, height, x + 8, yy, 20, 4, rgba('#5c3d27'));
  });
  const drawLamp = (tile, glow) => drawPropTile(pixels, width, height, tile, (x, y) => {
    fill(pixels, width, height, x + 10, y + 3, 12, 12, rgba(glow, 90));
    fill(pixels, width, height, x + 14, y + 11, 4, 17, rgba('#4b3424'));
    fill(pixels, width, height, x + 11, y + 5, 10, 8, rgba(glow));
    line(pixels, width, height, x + 10, y + 14, x + 22, y + 14, rgba('#2d2118'));
  });
  drawLamp(PROPS.lamp, '#e8bb5b');
  drawLamp(PROPS.lampFrame2, '#ffd87c');
  const drawTorch = (tile, flame) => drawPropTile(pixels, width, height, tile, (x, y) => {
    fill(pixels, width, height, x + 15, y + 9, 3, 19, rgba('#5a3824'));
    fill(pixels, width, height, x + 10, y + 2, 12, 11, rgba(flame, 115));
    fill(pixels, width, height, x + 13, y + 4, 6, 8, rgba(flame));
    fill(pixels, width, height, x + 15, y + 2, 3, 5, rgba('#ffe07a'));
  });
  drawTorch(PROPS.torch, '#ef8b32');
  drawTorch(PROPS.torchFrame2, '#f7b23f');
  const drawCampfire = (tile, flame, offset = 0) => drawPropTile(pixels, width, height, tile, (x, y) => {
    fill(pixels, width, height, x + 8, y + 20, 18, 4, rgba('#5d3b24'));
    line(pixels, width, height, x + 9, y + 21, x + 25, y + 17, rgba('#5d3b24'));
    line(pixels, width, height, x + 23, y + 22, x + 8, y + 16, rgba('#5d3b24'));
    fill(pixels, width, height, x + 12 + offset, y + 12, 8, 8, rgba(flame));
    fill(pixels, width, height, x + 15 - offset, y + 8, 4, 9, rgba('#ffd86a'));
  });
  drawCampfire(PROPS.campfire, '#ef8b32', 0);
  drawCampfire(PROPS.campfireFrame2, '#f6a23a', -1);
  drawCampfire(PROPS.campfireFrame3, '#dc6428', 1);
  drawPropTile(pixels, width, height, PROPS.flowerPatch, (x, y) => {
    for (let i = 0; i < 18; i += 1) {
      const px = x + 5 + Math.floor(hash(i, 2, 9) * 22);
      const py = y + 10 + Math.floor(hash(i, 3, 9) * 15);
      fill(pixels, width, height, px, py, 3, 3, rgba(i % 2 ? '#e86b86' : '#f2d36b'));
    }
  });
  drawPropTile(pixels, width, height, PROPS.sign, (x, y) => {
    fill(pixels, width, height, x + 15, y + 12, 3, 16, rgba('#5b3b25'));
    fill(pixels, width, height, x + 7, y + 7, 18, 10, rgba('#9a6b3d'));
    rectOutline(pixels, width, height, x + 7, y + 7, 18, 10, rgba('#3b271b'));
  });
  drawPropTile(pixels, width, height, PROPS.yardBasket, (x, y) => {
    fill(pixels, width, height, x + 8, y + 15, 16, 10, rgba('#9b6a3c'));
    line(pixels, width, height, x + 9, y + 15, x + 16, y + 9, rgba('#6d462a'));
    line(pixels, width, height, x + 23, y + 15, x + 16, y + 9, rgba('#6d462a'));
  });
  drawPropTile(pixels, width, height, PROPS.marketCrate, (x, y) => {
    fill(pixels, width, height, x + 6, y + 12, 20, 12, rgba('#8d5d35'));
    for (let i = 0; i < 5; i += 1) fill(pixels, width, height, x + 8 + i * 3, y + 8 + (i % 2), 4, 4, rgba('#bb4343'));
  });
  drawPropTile(pixels, width, height, PROPS.marketAwning, (x, y) => {
    polygon(pixels, width, height, [[x + 3, y + 18], [x + 16, y + 6], [x + 29, y + 18], [x + 26, y + 23], [x + 6, y + 23]], rgba('#c54c44'));
    for (let xx = x + 7; xx < x + 27; xx += 8) fill(pixels, width, height, xx, y + 13, 4, 10, rgba('#f1d48c'));
  });
  drawPropTile(pixels, width, height, PROPS.dockCrate, (x, y) => {
    fill(pixels, width, height, x + 6, y + 10, 20, 16, rgba('#755235'));
    fill(pixels, width, height, x + 9, y + 7, 14, 4, rgba('#9a6c43'));
  });
  drawPropTile(pixels, width, height, PROPS.ropeCoil, (x, y) => {
    for (let r = 10; r > 2; r -= 3) {
      rectOutline(pixels, width, height, x + 16 - r, y + 16 - Math.floor(r / 2), r * 2, r, rgba('#c0a15e'));
    }
  });
  drawPropTile(pixels, width, height, PROPS.hayBale, (x, y) => {
    fill(pixels, width, height, x + 6, y + 13, 20, 12, rgba('#c7a74f'));
    for (let xx = x + 8; xx < x + 25; xx += 5) line(pixels, width, height, xx, y + 14, xx - 3, y + 24, rgba('#e0c568'));
  });
  drawPropTile(pixels, width, height, PROPS.trough, (x, y) => {
    fill(pixels, width, height, x + 5, y + 15, 22, 8, rgba('#735033'));
    fill(pixels, width, height, x + 7, y + 13, 18, 4, rgba('#3d6f7d'));
  });
  drawPropTile(pixels, width, height, PROPS.anvil, (x, y) => {
    fill(pixels, width, height, x + 8, y + 14, 17, 6, rgba('#4a4d4f'));
    fill(pixels, width, height, x + 13, y + 20, 8, 7, rgba('#383b3d'));
    fill(pixels, width, height, x + 5, y + 16, 7, 3, rgba('#4a4d4f'));
  });
  drawPropTile(pixels, width, height, PROPS.woodPile, (x, y) => {
    for (let i = 0; i < 4; i += 1) line(pixels, width, height, x + 6, y + 20 - i * 3, x + 26, y + 15 - i * 2, rgba('#6a4429'));
  });
  const drawSmoke = (tile, shift) => drawPropTile(pixels, width, height, tile, (x, y) => {
    fill(pixels, width, height, x + 13 + shift, y + 18, 7, 5, rgba('#c9c1b8', 95));
    fill(pixels, width, height, x + 10 - shift, y + 10, 10, 7, rgba('#c9c1b8', 75));
    fill(pixels, width, height, x + 16 + shift, y + 4, 8, 6, rgba('#d8d2ca', 55));
  });
  drawSmoke(PROPS.chimneySmoke, 0);
  drawSmoke(PROPS.chimneySmoke2, 2);
  drawSmoke(PROPS.chimneySmoke3, -2);
  drawPropTile(pixels, width, height, PROPS.smallBench, (x, y) => {
    fill(pixels, width, height, x + 6, y + 14, 20, 5, rgba('#7c5634'));
    fill(pixels, width, height, x + 8, y + 19, 3, 8, rgba('#52351f'));
    fill(pixels, width, height, x + 21, y + 19, 3, 8, rgba('#52351f'));
  });
  drawPropTile(pixels, width, height, PROPS.dockPost, (x, y) => {
    fill(pixels, width, height, x + 12, y + 7, 8, 21, rgba('#5c3e28'));
    fill(pixels, width, height, x + 10, y + 5, 12, 5, rgba('#3d2a1d'));
  });
  drawPropTile(pixels, width, height, PROPS.sacks, (x, y) => {
    fill(pixels, width, height, x + 8, y + 13, 10, 12, rgba('#b69a63'));
    fill(pixels, width, height, x + 16, y + 11, 10, 14, rgba('#a98c57'));
  });
  drawPropTile(pixels, width, height, PROPS.flowerTub, (x, y) => {
    fill(pixels, width, height, x + 7, y + 18, 19, 7, rgba('#7b5131'));
    for (let i = 0; i < 7; i += 1) fill(pixels, width, height, x + 8 + i * 3, y + 12 + (i % 2), 3, 3, rgba(i % 2 ? '#e86b86' : '#e8d35f'));
  });
  drawPropTile(pixels, width, height, PROPS.trainingDummy, (x, y) => {
    fill(pixels, width, height, x + 15, y + 7, 4, 21, rgba('#5a3a24'));
    fill(pixels, width, height, x + 10, y + 11, 14, 10, rgba('#9b6d42'));
    line(pixels, width, height, x + 7, y + 15, x + 27, y + 15, rgba('#5a3a24'));
  });
  drawPropPrefabBox(pixels, width, height, PROPS.boat, 3, 2, '#714a31', '#d9c790');
  drawPropPrefabBox(pixels, width, height, PROPS.dockPlanks, 4, 2, '#765437', '#34261b');
  return encodePng(width, height, pixels);
}

function drawTerrainTile(pixels, width, height, tile, base, details = []) {
  const tx = (tile % TERRAIN_COLUMNS) * TILE;
  const ty = Math.floor(tile / TERRAIN_COLUMNS) * TILE;
  fill(pixels, width, height, tx, ty, TILE, TILE, rgba(base));
  for (let i = 0; i < 34; i += 1) {
    const px = tx + Math.floor(hash(tile, i, 10) * TILE);
    const py = ty + Math.floor(hash(tile, i, 11) * TILE);
    put(pixels, width, height, px, py, rgba(hash(tile, i, 12) > 0.5 ? '#ffffff' : '#000000', 20));
  }
  details.forEach((detail) => detail(tx, ty));
}

function makeTerrainTilesheet() {
  const width = TERRAIN_COLUMNS * TILE;
  const height = Math.ceil(TERRAIN_TILE_COUNT / TERRAIN_COLUMNS) * TILE;
  const pixels = Buffer.alloc(width * height * 4);
  drawTerrainTile(pixels, width, height, TERRAIN.grass, '#6f9f54');
  drawTerrainTile(pixels, width, height, TERRAIN.grassAlt, '#83ad5d');
  drawTerrainTile(pixels, width, height, TERRAIN.grassDark, '#527c48');
  drawTerrainTile(pixels, width, height, TERRAIN.dirt, '#a98758');
  drawTerrainTile(pixels, width, height, TERRAIN.path, '#b99963', [(x, y) => fill(pixels, width, height, x, y + 11, TILE, 11, rgba('#c6a66b'))]);
  drawTerrainTile(pixels, width, height, TERRAIN.plaza, '#918572', [
    (x, y) => {
      for (let yy = 0; yy < TILE; yy += 8) line(pixels, width, height, x, y + yy, x + TILE, y + yy, rgba('#6e665a'));
      for (let xx = 0; xx < TILE; xx += 8) line(pixels, width, height, x + xx, y, x + xx, y + TILE, rgba('#6e665a'));
    },
  ]);
  drawTerrainTile(pixels, width, height, TERRAIN.water, '#2f7890', [(x, y) => {
    for (let yy = 7; yy < 28; yy += 8) line(pixels, width, height, x + 3, y + yy, x + 28, y + yy - 2, rgba('#9ed4dd', 150));
  }]);
  drawTerrainTile(pixels, width, height, TERRAIN.waterAlt, '#357f94', [(x, y) => {
    for (let yy = 5; yy < 28; yy += 8) line(pixels, width, height, x + 2, y + yy, x + 26, y + yy + 1, rgba('#a8dce2', 145));
  }]);
  drawTerrainTile(pixels, width, height, TERRAIN.sand, '#d1b878');
  drawTerrainTile(pixels, width, height, TERRAIN.crop, '#b9a353', [(x, y) => {
    for (let xx = 4; xx < TILE; xx += 6) line(pixels, width, height, x + xx, y + 3, x + xx - 3, y + 29, rgba('#dfc968', 150));
  }]);
  drawTerrainTile(pixels, width, height, TERRAIN.flowers, '#76a65a', [(x, y) => {
    for (let i = 0; i < 9; i += 1) fill(pixels, width, height, x + 4 + i * 3, y + 9 + (i % 4) * 4, 2, 2, rgba(i % 2 ? '#e86b86' : '#efd35f'));
  }]);
  drawTerrainTile(pixels, width, height, TERRAIN.cobble, '#8e887a', [(x, y) => {
    for (let yy = 3; yy < TILE; yy += 9) line(pixels, width, height, x + 2, y + yy, x + 29, y + yy + 2, rgba('#6f685e'));
    for (let xx = 5; xx < TILE; xx += 10) line(pixels, width, height, x + xx, y + 2, x + xx - 2, y + 30, rgba('#6f685e'));
  }]);
  return encodePng(width, height, pixels);
}

function makeTsx(name, image, tileCount, columns, animations = [], tileProperties = []) {
  const propertyXml = tileProperties.map((entry) => {
    const props = Object.entries(entry.properties ?? {}).map(([name, value]) => `   <property name="${name}" value="${String(value).replace(/"/g, '&quot;')}"/>`).join('\n');
    return ` <tile id="${entry.tileId}">
  <properties>
${props}
  </properties>
 </tile>`;
  }).join('\n');
  const animationXml = animations.map(({ tileId, frames }) => ` <tile id="${tileId}">
  <animation>
${frames.map((frame) => `   <frame tileid="${frame.tileId}" duration="${frame.duration}"/>`).join('\n')}
  </animation>
 </tile>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${name}" tilewidth="32" tileheight="32" tilecount="${tileCount}" columns="${columns}">
 <image source="${image}" width="${columns * TILE}" height="${Math.ceil(tileCount / columns) * TILE}"/>
${propertyXml ? `${propertyXml}\n` : ''}${animationXml ? `${animationXml}\n` : ''}</tileset>
`;
}

function buildingTileProperties() {
  return BUILDING_PREFABS.map((prefab) => ({
    tileId: prefab.startTile,
    properties: {
      prefabId: prefab.id,
      displayName: prefab.displayName,
      prefabWidth: prefab.w,
      prefabHeight: prefab.h,
      category: prefab.category,
      role: prefab.role,
    },
  }));
}

function propAnimations() {
  return [
    { tileId: PROPS.lamp, frames: [{ tileId: PROPS.lamp, duration: 260 }, { tileId: PROPS.lampFrame2, duration: 260 }] },
    { tileId: PROPS.torch, frames: [{ tileId: PROPS.torch, duration: 170 }, { tileId: PROPS.torchFrame2, duration: 170 }] },
    { tileId: PROPS.campfire, frames: [{ tileId: PROPS.campfire, duration: 140 }, { tileId: PROPS.campfireFrame2, duration: 140 }, { tileId: PROPS.campfireFrame3, duration: 140 }] },
    { tileId: PROPS.chimneySmoke, frames: [{ tileId: PROPS.chimneySmoke, duration: 300 }, { tileId: PROPS.chimneySmoke2, duration: 300 }, { tileId: PROPS.chimneySmoke3, duration: 300 }] },
  ];
}

function terrainAnimations() {
  return [
    { tileId: TERRAIN.water, frames: [{ tileId: TERRAIN.water, duration: 260 }, { tileId: TERRAIN.waterAlt, duration: 260 }] },
  ];
}

function makeLayer(name, id, width, height, fillTile = 0, visible = true) {
  return {
    data: Array.from({ length: width * height }, () => fillTile),
    height,
    id,
    name,
    opacity: 1,
    type: 'tilelayer',
    visible,
    width,
    x: 0,
    y: 0,
  };
}

function setTile(layer, mapWidth, x, y, gid) {
  if (x < 0 || y < 0 || x >= mapWidth || y >= layer.height) return;
  layer.data[y * mapWidth + x] = gid;
}

function fillLayer(layer, mapWidth, x, y, w, h, gid) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) setTile(layer, mapWidth, xx, yy, gid);
  }
}

function terrainGid(tile) {
  return TERRAIN_FIRSTGID + tile;
}

function buildingGid(localTile) {
  return BUILDINGS_FIRSTGID + localTile;
}

function propGid(localTile) {
  return PROPS_FIRSTGID + localTile;
}

function createObjectLayer(name, id, objects) {
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

function objectProperties(props) {
  return Object.entries(props).map(([name, value]) => ({
    name,
    type: typeof value === 'number' ? 'int' : typeof value === 'boolean' ? 'bool' : 'string',
    value,
  }));
}

let objectId = 1;
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

function createPreviewMap() {
  const width = 180;
  const height = 90;
  objectId = 1;
  const ground = makeLayer('Ground', 1, width, height);
  const water = makeLayer('Water', 2, width, height);
  const terrainDetails = makeLayer('TerrainDetails', 3, width, height);
  const roads = makeLayer('Roads', 4, width, height);
  const decor = makeLayer('Decor', 5, width, height);
  const buildings = makeLayer('Buildings', 6, width, height);
  const collision = makeLayer('Collision', 7, width, height, 0, false);
  const labels = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const n = hash(x, y, 44);
      setTile(ground, width, x, y, terrainGid(n > 0.84 ? TERRAIN.grassAlt : n > 0.67 ? TERRAIN.grassDark : TERRAIN.grass));
    }
  }

  fillLayer(roads, width, 46, 34, 31, 22, terrainGid(TERRAIN.plaza));
  fillLayer(roads, width, 0, 42, 150, 5, terrainGid(TERRAIN.path));
  fillLayer(roads, width, 59, 0, 5, 90, terrainGid(TERRAIN.path));
  fillLayer(roads, width, 10, 68, 64, 4, terrainGid(TERRAIN.path));
  fillLayer(roads, width, 82, 60, 25, 4, terrainGid(TERRAIN.path));

  for (let y = 56; y < height; y += 1) {
    for (let x = 174; x < width; x += 1) {
      setTile(water, width, x, y, terrainGid(TERRAIN.water));
      setTile(collision, width, x, y, 1);
    }
  }
  for (let y = 54; y < height; y += 1) {
    setTile(terrainDetails, width, 173, y, terrainGid(TERRAIN.sand));
  }
  fillLayer(collision, width, 136, 65, 14, 5, 0);

  fillLayer(terrainDetails, width, 10, 74, 19, 9, terrainGid(TERRAIN.crop));
  fillLayer(terrainDetails, width, 32, 74, 18, 9, terrainGid(TERRAIN.crop));
  for (let i = 0; i < 30; i += 1) {
    const x = 5 + Math.floor(hash(i, 1, 70) * 138);
    const y = 8 + Math.floor(hash(i, 2, 71) * 72);
    if (roads.data[y * width + x] || water.data[y * width + x]) continue;
    setTile(terrainDetails, width, x, y, terrainGid(TERRAIN.flowers));
  }

  function placeProp(x, y, tile, solid = false) {
    setTile(decor, width, x, y, propGid(tile));
    if (solid) setTile(collision, width, x, y, 1);
  }

  function placePropPrefab(x, y, tile, w, h, solid = false) {
    for (let yy = 0; yy < h; yy += 1) {
      for (let xx = 0; xx < w; xx += 1) {
        setTile(decor, width, x + xx, y + yy, propGid(tile + yy * PROP_COLUMNS + xx));
        if (solid) setTile(collision, width, x + xx, y + yy, 1);
      }
    }
  }

  function placeFenceH(x, y, length) {
    for (let i = 0; i < length; i += 1) placeProp(x + i, y, PROPS.fenceH, true);
  }

  function placeFenceV(x, y, length) {
    for (let i = 0; i < length; i += 1) placeProp(x, y + i, PROPS.fenceV, true);
  }

  function placeBuilding(id, x, y) {
    const prefab = BUILDING_BY_ID[id];
    for (let yy = 0; yy < prefab.h; yy += 1) {
      for (let xx = 0; xx < prefab.w; xx += 1) {
        setTile(buildings, width, x + xx, y + yy, buildingGid(prefab.startTile + yy * BUILDING_COLUMNS + xx));
      }
    }
    const c = prefab.collision;
    fillLayer(collision, width, x + c.x, y + c.y, c.w, c.h, 1);
    labels.push(pointObject(`preview_${id}`, x + prefab.w / 2, y + prefab.h / 2, {
      type: 'buildingPreview',
      prefabId: id,
      displayName: prefab.displayName,
      prefabWidth: prefab.w,
      prefabHeight: prefab.h,
      debugOnly: false,
    }));
  }

  placeBuilding('small_cottage', 12, 14);
  placeBuilding('medium_house', 26, 13);
  placeBuilding('large_house', 42, 12);
  placeBuilding('town_hall', 58, 12);
  placeBuilding('inn_tavern', 75, 14);
  placeBuilding('chapel_temple', 16, 34);
  placeBuilding('blacksmith', 34, 34);
  placeBuilding('market_stall_set', 56, 40);
  placeBuilding('guard_post', 91, 30);
  placeBuilding('watchtower', 99, 27);
  placeBuilding('ruined_house_small', 88, 44);
  placeBuilding('ruined_house_large', 98, 42);
  placeBuilding('city_house_row', 66, 32);
  placeBuilding('gatehouse', 8, 50);
  placeBuilding('farm_house', 12, 62);
  placeBuilding('barn', 25, 61);
  placeBuilding('stable', 55, 58);
  placeBuilding('warehouse', 82, 58);
  placeBuilding('dock_building', 96, 62);
  placeBuilding('asterfall_villa', 111, 8);
  placeBuilding('blue_roof_shop', 121, 18);
  placeBuilding('apothecary_house', 133, 18);
  placeBuilding('corner_townhouse', 120, 32);
  placeBuilding('guild_hall', 132, 32);
  placeBuilding('red_townhouse', 112, 52);
  placeBuilding('green_townhouse', 118, 52);
  placeBuilding('city_bakery', 124, 54);
  placeBuilding('courtyard_house', 111, 72);
  placeBuilding('tower_house', 132, 70);
  placeBuilding('stone_manse', 139, 70);
  placeBuilding('city_bank', 148, 8);
  placeBuilding('auction_house', 148, 24);
  placeBuilding('weaponsmith_shop', 150, 43);
  placeBuilding('armorer_shop', 158, 43);
  placeBuilding('arcane_shop', 150, 54);
  placeBuilding('alchemy_shop', 158, 55);
  placeBuilding('profession_hall', 148, 68);
  placeBuilding('tailor_shop', 126, 6);
  placeBuilding('leatherworker_shop', 134, 6);
  placeBuilding('fishing_lodge', 158, 70);
  placeBuilding('mining_office', 166, 70);

  placeProp(62, 47, PROPS.well);
  placeProp(51, 39, PROPS.lamp);
  placeProp(74, 39, PROPS.lamp);
  placeProp(50, 55, PROPS.lamp);
  placeProp(77, 55, PROPS.lamp);
  placeProp(66, 43, PROPS.flowerPatch);
  placeProp(68, 43, PROPS.flowerPatch);
  placeProp(42, 40, PROPS.anvil);
  placeProp(40, 41, PROPS.woodPile);
  placeProp(78, 21, PROPS.sign);
  placeProp(58, 45, PROPS.marketCrate);
  placeProp(60, 45, PROPS.marketAwning);
  placeProp(65, 45, PROPS.crate);
  placeProp(66, 45, PROPS.barrel);
  placeProp(39, 69, PROPS.trough);
  placeProp(41, 69, PROPS.hayBale);
  placeProp(18, 73, PROPS.cart);
  placeProp(22, 67, PROPS.flowerTub);
  placeProp(74, 19, PROPS.chimneySmoke);
  placeProp(38, 35, PROPS.chimneySmoke);
  placeProp(60, 38, PROPS.torch);
  placeProp(72, 38, PROPS.torch);
  placeProp(20, 52, PROPS.trainingDummy);
  placeProp(91, 64, PROPS.dockCrate);
  placeProp(93, 64, PROPS.ropeCoil);
  placeProp(101, 67, PROPS.dockPost);
  placePropPrefab(96, 67, PROPS.dockPlanks, 4, 2, false);
  placePropPrefab(108, 70, PROPS.boat, 3, 2, false);

  placeFenceH(8, 73, 43);
  placeFenceH(8, 84, 43);
  placeFenceV(8, 74, 10);
  placeFenceV(50, 74, 10);
  placeFenceH(88, 37, 24);
  placeFenceV(88, 38, 12);
  placeFenceV(111, 38, 12);

  return {
    compressionlevel: -1,
    height,
    infinite: false,
    layers: [
      ground,
      water,
      terrainDetails,
      roads,
      decor,
      buildings,
      collision,
      createObjectLayer('PrefabLabels', 8, labels),
    ],
    nextlayerid: 9,
    nextobjectid: objectId + 1,
    orientation: 'orthogonal',
    properties: [
      { name: 'purpose', type: 'string', value: 'world_v4_building_preview' },
      { name: 'tileSize', type: 'int', value: TILE },
      { name: 'buildingTileset', type: 'string', value: 'world_v4_buildings' },
    ],
    renderorder: 'right-down',
    tiledversion: '1.11.2',
    tileheight: TILE,
    tilesets: [
      { firstgid: TERRAIN_FIRSTGID, source: 'tilesets/world_v4_preview_terrain.tsx' },
      { firstgid: BUILDINGS_FIRSTGID, source: 'tilesets/world_v4_buildings.tsx' },
      { firstgid: PROPS_FIRSTGID, source: 'tilesets/world_v4_props.tsx' },
    ],
    tilewidth: TILE,
    type: 'map',
    version: '1.10',
    width,
  };
}

function makePrefabMetadata() {
  return {
    version: 'v4-city-hub-1',
    tileSize: TILE,
    tileset: 'world_v4_buildings.tsx',
    columns: BUILDING_COLUMNS,
    firstgidHint: BUILDINGS_FIRSTGID,
    prefabs: BUILDING_PREFABS.map((prefab) => ({
      id: prefab.id,
      displayName: prefab.displayName,
      category: prefab.category,
      role: prefab.role,
      startTile: prefab.startTile,
      tilesetX: prefab.x,
      tilesetY: prefab.y,
      width: prefab.w,
      height: prefab.h,
      collision: prefab.collision,
    })),
    props: Object.fromEntries(Object.entries(PROPS).map(([name, tileId]) => [name, { tileId }])),
  };
}

function makeNotes() {
  return `# World V4 Building Art Notes

## Goal

This is a standalone V4 building art pass. It does not regenerate the full world map yet.

## Files

- \`public/maps/tilesets/world_v4_buildings.png\`
- \`public/maps/tilesets/world_v4_buildings.tsx\`
- \`public/maps/tilesets/world_v4_props.png\`
- \`public/maps/tilesets/world_v4_props.tsx\`
- \`public/maps/tilesets/world_v4_preview_terrain.png\`
- \`public/maps/tilesets/world_v4_preview_terrain.tsx\`
- \`public/maps/tilesets/world_v4_building_prefabs.json\`
- \`public/maps/building_preview_v4.tmj\`

Generator-compatible mirrors are also written to:

- \`public/assets/tilesets/world_v4_buildings.png\`
- \`public/tilesets/world_v4_buildings.tsx\`
- \`public/assets/tilesets/world_v4_props.png\`
- \`public/tilesets/world_v4_props.tsx\`

## Building Prefabs

${BUILDING_PREFABS.map((prefab) => `- \`${prefab.id}\`: ${prefab.displayName}, ${prefab.w}x${prefab.h}, ${prefab.category}, start tile ${prefab.startTile}`).join('\n')}

## Props

- well
- horizontal and vertical fence
- lamp post with animation
- torch with animation
- campfire with animation
- chimney smoke placeholder animation
- crates, barrels, cart, sign, flower patch, yard basket
- market crate and awning
- hay bale, trough, anvil, wood pile
- dock crate, rope coil, dock post, dock planks, boat

## Preview Map

Open \`public/maps/building_preview_v4.tmj\` in Tiled.

The preview contains:

- village square
- cottages and town houses
- town hall
- inn / tavern
- blacksmith
- chapel
- farm house, barn, stable, crop fields
- market stalls and market props
- guard post, watchtower, gatehouse
- dock building, warehouse, dock props, water corner
- ruined house variants

## Generator Integration Later

Use \`world_v4_building_prefabs.json\` to place prefabs by \`prefabId\`.

Placement rule:

1. Find prefab metadata.
2. Place tiles from \`startTile + localY * columns + localX\`.
3. Write those GIDs to the \`Buildings\` layer.
4. Apply only the prefab collision rectangle to the \`Collision\` layer.
5. Keep small props mostly non-colliding except fences/buildings/water.

This keeps the system compatible with the existing region world generator while allowing better visual building art.
`;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  await Promise.all([
    fs.mkdir(mapTilesetsDir, { recursive: true }),
    fs.mkdir(projectTilesetsDir, { recursive: true }),
    fs.mkdir(assetTilesetsDir, { recursive: true }),
    fs.mkdir(docsDir, { recursive: true }),
  ]);

  const buildingsPng = makeBuildingsTilesheet();
  const propsPng = makePropsTilesheet();
  const terrainPng = makeTerrainTilesheet();

  await Promise.all([
    fs.writeFile(path.join(mapTilesetsDir, 'world_v4_buildings.png'), buildingsPng),
    fs.writeFile(path.join(mapTilesetsDir, 'world_v4_buildings.tsx'), makeTsx('world_v4_buildings', 'world_v4_buildings.png', BUILDING_TILE_COUNT, BUILDING_COLUMNS, [], buildingTileProperties())),
    fs.writeFile(path.join(mapTilesetsDir, 'world_v4_props.png'), propsPng),
    fs.writeFile(path.join(mapTilesetsDir, 'world_v4_props.tsx'), makeTsx('world_v4_props', 'world_v4_props.png', PROP_TILE_COUNT, PROP_COLUMNS, propAnimations())),
    fs.writeFile(path.join(mapTilesetsDir, 'world_v4_preview_terrain.png'), terrainPng),
    fs.writeFile(path.join(mapTilesetsDir, 'world_v4_preview_terrain.tsx'), makeTsx('world_v4_preview_terrain', 'world_v4_preview_terrain.png', TERRAIN_TILE_COUNT, TERRAIN_COLUMNS, terrainAnimations())),
    fs.writeFile(path.join(assetTilesetsDir, 'world_v4_buildings.png'), buildingsPng),
    fs.writeFile(path.join(projectTilesetsDir, 'world_v4_buildings.tsx'), makeTsx('world_v4_buildings', '../assets/tilesets/world_v4_buildings.png', BUILDING_TILE_COUNT, BUILDING_COLUMNS, [], buildingTileProperties())),
    fs.writeFile(path.join(assetTilesetsDir, 'world_v4_props.png'), propsPng),
    fs.writeFile(path.join(projectTilesetsDir, 'world_v4_props.tsx'), makeTsx('world_v4_props', '../assets/tilesets/world_v4_props.png', PROP_TILE_COUNT, PROP_COLUMNS, propAnimations())),
    fs.writeFile(path.join(assetTilesetsDir, 'world_v4_preview_terrain.png'), terrainPng),
    fs.writeFile(path.join(projectTilesetsDir, 'world_v4_preview_terrain.tsx'), makeTsx('world_v4_preview_terrain', '../assets/tilesets/world_v4_preview_terrain.png', TERRAIN_TILE_COUNT, TERRAIN_COLUMNS, terrainAnimations())),
    writeJson(path.join(mapTilesetsDir, 'world_v4_building_prefabs.json'), makePrefabMetadata()),
    writeJson(path.join(mapsDir, 'building_preview_v4.tmj'), createPreviewMap()),
    fs.writeFile(path.join(docsDir, 'world_v4_buildings_notes.md'), makeNotes(), 'utf8'),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
