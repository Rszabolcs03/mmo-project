import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const mapsDir = path.join(publicDir, 'maps');
const mapTilesetsDir = path.join(mapsDir, 'tilesets');
const projectTilesetsDir = path.join(publicDir, 'tilesets');
const assetTilesetsDir = path.join(publicDir, 'assets', 'tilesets');

const TILE = 32;
const COLUMNS = 64;
const ROWS = 72;
const TILE_COUNT = COLUMNS * ROWS;
const SHEET_WIDTH = COLUMNS * TILE;
const SHEET_HEIGHT = ROWS * TILE;

const PREFABS = [
  { id: 'asterfall_town_hall', displayName: 'Asterfall Town Hall', category: 'civic', w: 9, h: 7, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 4, y: 6 }, style: 'townHall', roof: '#6f7f91', wall: '#a8a092', trim: '#d9c277', accent: '#315f8c' },
  { id: 'asterfall_bank', displayName: 'Asterfall Bank', category: 'service', w: 7, h: 6, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 3, y: 5 }, style: 'bank', roof: '#5c718a', wall: '#9c9990', trim: '#d9ba63', accent: '#d6c07a' },
  { id: 'asterfall_auction_house', displayName: 'Asterfall Auction House', category: 'service', w: 9, h: 6, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 4, y: 5 }, style: 'auction', roof: '#7f5a88', wall: '#b19162', trim: '#e3c36d', accent: '#8f3f68' },
  { id: 'asterfall_inn', displayName: 'Asterfall Inn', category: 'social', w: 8, h: 6, orientation: 'corner', entranceSide: 'south', entranceTile: { x: 3, y: 5 }, style: 'inn', roof: '#8a4d45', wall: '#b98d58', trim: '#f0d28a', accent: '#2f6b7d' },
  { id: 'asterfall_market_hall', displayName: 'Asterfall Market Hall', category: 'market', w: 9, h: 5, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 4, y: 4 }, style: 'marketHall', roof: '#647e50', wall: '#b68755', trim: '#e8c06d', accent: '#c45142' },
  { id: 'asterfall_general_goods', displayName: 'General Goods Shop', category: 'merchant', w: 5, h: 4, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 2, y: 3 }, style: 'generalGoods', roof: '#77715e', wall: '#b59366', trim: '#e2c483', accent: '#4d7f70' },
  { id: 'asterfall_weaponsmith', displayName: 'Weaponsmith', category: 'crafting', w: 6, h: 4, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 2, y: 3 }, style: 'weaponsmith', roof: '#4d5965', wall: '#94765b', trim: '#c4a36d', accent: '#bcc7cf' },
  { id: 'asterfall_armorer', displayName: 'Armorer', category: 'crafting', w: 6, h: 4, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 3, y: 3 }, style: 'armorer', roof: '#5f6673', wall: '#9d8b71', trim: '#d4b36a', accent: '#7fa0b8' },
  { id: 'asterfall_blacksmith_repair', displayName: 'Blacksmith / Repair Shop', category: 'crafting', w: 6, h: 5, orientation: 'corner', entranceSide: 'west', entranceTile: { x: 0, y: 3 }, style: 'blacksmith', roof: '#3f4448', wall: '#8a6a4c', trim: '#d18a42', accent: '#ff9f43' },
  { id: 'asterfall_arcane_shop', displayName: 'Arcane Shop', category: 'magic', w: 5, h: 5, orientation: 'vertical', entranceSide: 'south', entranceTile: { x: 2, y: 4 }, style: 'arcane', roof: '#4f4a89', wall: '#8e8b99', trim: '#dbca7c', accent: '#6ee7f2' },
  { id: 'asterfall_alchemy_shop', displayName: 'Alchemy / Potion Shop', category: 'magic', w: 5, h: 4, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 2, y: 3 }, style: 'alchemy', roof: '#3f7f68', wall: '#9c946d', trim: '#d7bd75', accent: '#9bdc65' },
  { id: 'asterfall_tailor', displayName: 'Tailor', category: 'profession', w: 5, h: 4, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 2, y: 3 }, style: 'tailor', roof: '#8c5274', wall: '#b79070', trim: '#e8d0a0', accent: '#e68ac2' },
  { id: 'asterfall_leatherworker', displayName: 'Leatherworker', category: 'profession', w: 5, h: 4, orientation: 'vertical', entranceSide: 'east', entranceTile: { x: 4, y: 2 }, style: 'leatherworker', roof: '#5f6f45', wall: '#a2764c', trim: '#d0a563', accent: '#8b512f' },
  { id: 'asterfall_profession_hall', displayName: 'Profession Hall', category: 'profession', w: 8, h: 5, orientation: 'plaza', entranceSide: 'south', entranceTile: { x: 4, y: 4 }, style: 'professionHall', roof: '#6c7c63', wall: '#aea487', trim: '#dcc57b', accent: '#7b6bd6' },
  { id: 'asterfall_fishing_lodge', displayName: 'Fishing Lodge', category: 'profession', w: 6, h: 4, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 3, y: 3 }, style: 'fishing', roof: '#507d82', wall: '#a8845b', trim: '#d5b172', accent: '#6cc7d7' },
  { id: 'asterfall_mining_office', displayName: 'Mining Office', category: 'profession', w: 6, h: 4, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 2, y: 3 }, style: 'mining', roof: '#68645d', wall: '#9b8a74', trim: '#c6ad70', accent: '#b8c0c8' },
  { id: 'asterfall_stable', displayName: 'Stable', category: 'travel', w: 8, h: 4, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 4, y: 3 }, style: 'stable', roof: '#6d5e3f', wall: '#9a7042', trim: '#d5aa65', accent: '#c49b58' },
  { id: 'asterfall_chapel', displayName: 'Chapel', category: 'civic', w: 6, h: 7, orientation: 'vertical', entranceSide: 'south', entranceTile: { x: 3, y: 6 }, style: 'chapel', roof: '#6f7f8a', wall: '#b0aa9c', trim: '#e3d8af', accent: '#f6f0cf' },
  { id: 'asterfall_guardhouse', displayName: 'Guardhouse', category: 'guard', w: 6, h: 5, orientation: 'corner', entranceSide: 'west', entranceTile: { x: 0, y: 3 }, style: 'guardhouse', roof: '#555c64', wall: '#8d8980', trim: '#c8ad67', accent: '#37608a' },
  { id: 'asterfall_gatehouse_watchtower', displayName: 'Gatehouse / Watchtower', category: 'guard', w: 9, h: 7, orientation: 'road-facing', entranceSide: 'south', entranceTile: { x: 4, y: 6 }, style: 'gatehouse', roof: '#4f5961', wall: '#8f8f86', trim: '#c9b06f', accent: '#365d83' },
  { id: 'asterfall_warehouse_storage', displayName: 'Warehouse / Storage', category: 'service', w: 8, h: 5, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 4, y: 4 }, style: 'warehouse', roof: '#5e594f', wall: '#a0784e', trim: '#cf9f5c', accent: '#9aa0a6' },
  { id: 'asterfall_townhouse_blue', displayName: 'Blue Slate Townhouse', category: 'residential', w: 4, h: 5, orientation: 'vertical', entranceSide: 'south', entranceTile: { x: 2, y: 4 }, style: 'townhouseTall', roof: '#526e87', wall: '#a29686', trim: '#d7c08a', accent: '#5fb7d2' },
  { id: 'asterfall_townhouse_red', displayName: 'Red Gable Townhouse', category: 'residential', w: 5, h: 4, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 2, y: 3 }, style: 'townhouseGable', roof: '#8a4a43', wall: '#b58a65', trim: '#e3c487', accent: '#e7a35d' },
  { id: 'asterfall_townhouse_green', displayName: 'Green Corner Townhouse', category: 'residential', w: 5, h: 5, orientation: 'corner', entranceSide: 'east', entranceTile: { x: 4, y: 3 }, style: 'townhouseCorner', roof: '#55724a', wall: '#ad8d66', trim: '#d5bf83', accent: '#7fb26d' },
  { id: 'asterfall_townhouse_ivory', displayName: 'Ivory Courtyard House', category: 'residential', w: 6, h: 5, orientation: 'plaza', entranceSide: 'south', entranceTile: { x: 3, y: 4 }, style: 'courtyardHouse', roof: '#85716b', wall: '#b7ad92', trim: '#e2ca85', accent: '#b9d47a' },
  { id: 'asterfall_merchant_house_spice', displayName: 'Spice Merchant House', category: 'merchant', w: 6, h: 4, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 3, y: 3 }, style: 'merchantSpice', roof: '#986239', wall: '#b99662', trim: '#f0cc75', accent: '#d86d3d' },
  { id: 'asterfall_merchant_house_jewel', displayName: 'Jewel Merchant House', category: 'merchant', w: 5, h: 5, orientation: 'vertical', entranceSide: 'south', entranceTile: { x: 2, y: 4 }, style: 'merchantJewel', roof: '#5b618f', wall: '#aa9d85', trim: '#e5c36a', accent: '#7dd7c8' },
  { id: 'asterfall_merchant_house_books', displayName: 'Book Merchant House', category: 'merchant', w: 5, h: 4, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 2, y: 3 }, style: 'merchantBooks', roof: '#66517c', wall: '#a88c6e', trim: '#dcc17c', accent: '#d8e0a6' },
  { id: 'asterfall_service_kiosk_blue', displayName: 'Blue Service Kiosk', category: 'kiosk', w: 3, h: 3, orientation: 'plaza', entranceSide: 'south', entranceTile: { x: 1, y: 2 }, style: 'kioskBlue', roof: '#47708a', wall: '#a98555', trim: '#dfbe79', accent: '#82c8e4' },
  { id: 'asterfall_service_kiosk_red', displayName: 'Red Food Stall', category: 'kiosk', w: 4, h: 3, orientation: 'plaza', entranceSide: 'south', entranceTile: { x: 2, y: 2 }, style: 'kioskRed', roof: '#94443f', wall: '#aa794a', trim: '#eccf86', accent: '#f09a62' },
  { id: 'asterfall_service_kiosk_green', displayName: 'Green Herb Stall', category: 'kiosk', w: 4, h: 3, orientation: 'plaza', entranceSide: 'south', entranceTile: { x: 2, y: 2 }, style: 'kioskGreen', roof: '#4e7b58', wall: '#9f764c', trim: '#d8bb75', accent: '#9bd46c' },
  { id: 'asterfall_market_awning_row', displayName: 'Market Awning Row', category: 'kiosk', w: 6, h: 3, orientation: 'horizontal', entranceSide: 'south', entranceTile: { x: 3, y: 2 }, style: 'awningRow', roof: '#b34f49', wall: '#a47447', trim: '#e8c56c', accent: '#406f95' },
  { id: 'asterfall_city_wall_segment', displayName: 'City Wall Segment', category: 'wall', w: 6, h: 3, orientation: 'horizontal', entranceSide: 'none', entranceTile: null, style: 'wallSegment', roof: '#5c6266', wall: '#8e8d84', trim: '#c2aa72', accent: '#6d7278' },
  { id: 'asterfall_wall_corner_tower', displayName: 'Wall Corner Tower', category: 'wall', w: 4, h: 5, orientation: 'corner', entranceSide: 'south', entranceTile: { x: 2, y: 4 }, style: 'wallTower', roof: '#525b64', wall: '#8b8d86', trim: '#c6ad70', accent: '#748192' },
];

function packPrefabs() {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const prefab of PREFABS) {
    if (x + prefab.w > COLUMNS) {
      x = 0;
      y += rowHeight + 1;
      rowHeight = 0;
    }
    prefab.x = x;
    prefab.y = y;
    prefab.startTile = y * COLUMNS + x;
    rowHeight = Math.max(rowHeight, prefab.h);
    x += prefab.w + 1;
  }
}

function rgba(hex, alpha = 255) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), alpha];
}
function mix(a, b, t) {
  const ca = Array.isArray(a) ? a : rgba(a);
  const cb = Array.isArray(b) ? b : rgba(b);
  return ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
}
function setPixel(buf, width, height, x, y, color) {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= width || py >= height) return;
  const c = Array.isArray(color) ? color : rgba(color);
  const i = (py * width + px) * 4;
  const a = (c[3] ?? 255) / 255;
  const inv = 1 - a;
  buf[i] = Math.round(c[0] * a + buf[i] * inv);
  buf[i + 1] = Math.round(c[1] * a + buf[i + 1] * inv);
  buf[i + 2] = Math.round(c[2] * a + buf[i + 2] * inv);
  buf[i + 3] = Math.min(255, Math.round((c[3] ?? 255) + buf[i + 3] * inv));
}
function rect(buf, width, height, x, y, w, h, color) {
  for (let yy = Math.floor(y); yy < Math.ceil(y + h); yy += 1) {
    for (let xx = Math.floor(x); xx < Math.ceil(x + w); xx += 1) setPixel(buf, width, height, xx, yy, color);
  }
}
function outline(buf, width, height, x, y, w, h, color) {
  rect(buf, width, height, x, y, w, 2, color);
  rect(buf, width, height, x, y + h - 2, w, 2, color);
  rect(buf, width, height, x, y, 2, h, color);
  rect(buf, width, height, x + w - 2, y, 2, h, color);
}
function line(buf, width, height, x0, y0, x1, y1, color, size = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    rect(buf, width, height, x0 + (x1 - x0) * t - size / 2, y0 + (y1 - y0) * t - size / 2, size, size, color);
  }
}
function poly(buf, width, height, points, color) {
  const minX = Math.floor(Math.min(...points.map((p) => p[0])));
  const maxX = Math.ceil(Math.max(...points.map((p) => p[0])));
  const minY = Math.floor(Math.min(...points.map((p) => p[1])));
  const maxY = Math.ceil(Math.max(...points.map((p) => p[1])));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi || 0.001) + xi) inside = !inside;
      }
      if (inside) setPixel(buf, width, height, x, y, color);
    }
  }
}
function ellipse(buf, width, height, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPixel(buf, width, height, x, y, color);
    }
  }
}

function drawDoor(buf, w, h, x, y, width, height, entranceTile, entranceSide, trim) {
  if (!entranceTile) return;
  const doorW = Math.min(18, Math.max(12, Math.floor(width / 7)));
  const doorH = 22;
  let dx = x + entranceTile.x * TILE + 7;
  let dy = y + entranceTile.y * TILE + 8;
  if (entranceSide === 'south') {
    dx = x + entranceTile.x * TILE + 7;
    dy = y + entranceTile.y * TILE + 8;
  } else if (entranceSide === 'west') {
    dx = x + entranceTile.x * TILE + 1;
    dy = y + entranceTile.y * TILE + 5;
  } else if (entranceSide === 'east') {
    dx = x + entranceTile.x * TILE + 14;
    dy = y + entranceTile.y * TILE + 5;
  }
  rect(buf, w, h, dx - 2, dy - 3, doorW + 4, doorH + 3, '#33251d');
  rect(buf, w, h, dx, dy, doorW, doorH, '#6d442e');
  rect(buf, w, h, dx + doorW - 4, dy + 10, 3, 3, trim);
}

function drawWindows(buf, w, h, x, y, width, height, roofBottom, spec) {
  const glass = mix(spec.accent, '#ffffff', 0.35);
  const glow = mix(spec.accent, '#f8e5a2', 0.5);
  const count = Math.max(2, Math.min(8, Math.floor(width / 42)));
  const top = roofBottom + 14;
  for (let i = 0; i < count; i += 1) {
    const wx = x + 18 + i * ((width - 38) / Math.max(1, count - 1));
    const wy = y + top + (i % 2) * 2;
    rect(buf, w, h, wx - 2, wy - 2, 11, 11, '#5b4935');
    rect(buf, w, h, wx, wy, 7, 7, i % 3 === 0 ? glow : glass);
    line(buf, w, h, wx + 3, wy, wx + 3, wy + 6, '#fff6b3', 1);
  }
}

function drawBuilding(buf, sheetW, sheetH, p) {
  const x = p.x * TILE;
  const y = p.y * TILE;
  const width = p.w * TILE;
  const height = p.h * TILE;
  const wallTop = y + Math.floor(height * 0.38);
  const wallH = height - (wallTop - y) - 8;
  const darkRoof = mix(p.roof, '#111827', 0.35);
  const lightRoof = mix(p.roof, '#ffffff', 0.18);
  const darkWall = mix(p.wall, '#1f2933', 0.25);
  const shadow = [0, 0, 0, 56];

  ellipse(buf, sheetW, sheetH, x + width / 2, y + height - 7, width * 0.43, 9, shadow);
  rect(buf, sheetW, sheetH, x + 8, wallTop, width - 16, wallH, p.wall);
  outline(buf, sheetW, sheetH, x + 8, wallTop, width - 16, wallH, darkWall);

  if (['chapel', 'gatehouse', 'wallTower'].includes(p.style)) {
    poly(buf, sheetW, sheetH, [[x + width * 0.12, wallTop + 12], [x + width / 2, y + 5], [x + width * 0.88, wallTop + 12], [x + width * 0.80, wallTop + 26], [x + width * 0.20, wallTop + 26]], p.roof);
    line(buf, sheetW, sheetH, x + width / 2, y + 8, x + width / 2, wallTop + 24, lightRoof, 2);
  } else if (['stable', 'warehouse', 'marketHall', 'awningRow'].includes(p.style)) {
    rect(buf, sheetW, sheetH, x + 4, y + 18, width - 8, wallTop - y + 16, p.roof);
    poly(buf, sheetW, sheetH, [[x + 4, y + 18], [x + width - 4, y + 18], [x + width - 16, y + 4], [x + 16, y + 4]], lightRoof);
  } else if (['townhouseTall', 'arcane', 'merchantJewel'].includes(p.style)) {
    poly(buf, sheetW, sheetH, [[x + 6, wallTop + 2], [x + width / 2, y + 5], [x + width - 6, wallTop + 2], [x + width - 12, wallTop + 16], [x + 12, wallTop + 16]], p.roof);
    rect(buf, sheetW, sheetH, x + width - 30, y + 22, 17, 44, darkRoof);
  } else {
    poly(buf, sheetW, sheetH, [[x + 4, wallTop + 8], [x + width / 2, y + 8], [x + width - 4, wallTop + 8], [x + width - 12, wallTop + 25], [x + 12, wallTop + 25]], p.roof);
  }

  for (let yy = y + 12; yy < wallTop + 22; yy += 7) line(buf, sheetW, sheetH, x + 12, yy, x + width - 12, yy + 1, darkRoof, 1);
  rect(buf, sheetW, sheetH, x + 10, wallTop + wallH - 8, width - 20, 6, p.trim);
  drawWindows(buf, sheetW, sheetH, x, y, width, height, wallTop, p);
  drawDoor(buf, sheetW, sheetH, x, y, width, height, p.entranceTile, p.entranceSide, p.trim);

  const cx = x + width / 2;
  const bottom = y + height - 24;
  switch (p.style) {
    case 'townHall':
      rect(buf, sheetW, sheetH, cx - 14, y + 18, 28, 58, '#7f8790');
      rect(buf, sheetW, sheetH, cx - 10, y + 8, 20, 16, p.accent);
      rect(buf, sheetW, sheetH, cx - 6, y + 33, 12, 12, '#f0d98a');
      rect(buf, sheetW, sheetH, x + 20, bottom, width - 40, 6, p.accent);
      break;
    case 'bank':
      for (let i = 0; i < 4; i += 1) rect(buf, sheetW, sheetH, x + 22 + i * 40, wallTop + 30, 8, 36, '#d1c6aa');
      rect(buf, sheetW, sheetH, cx - 18, wallTop + 18, 36, 10, p.trim);
      break;
    case 'auction':
      rect(buf, sheetW, sheetH, x + 18, wallTop + 22, width - 36, 16, p.accent);
      for (let i = 0; i < 5; i += 1) rect(buf, sheetW, sheetH, x + 34 + i * 42, wallTop + 45, 18, 6, p.trim);
      break;
    case 'inn':
      rect(buf, sheetW, sheetH, x + width - 45, y + 12, 16, 40, '#4a3428');
      rect(buf, sheetW, sheetH, x + width - 47, y + 8, 20, 7, '#2c201a');
      rect(buf, sheetW, sheetH, x + 22, wallTop + 28, 44, 15, p.accent);
      break;
    case 'blacksmith':
      rect(buf, sheetW, sheetH, x + width - 48, wallTop + 30, 36, 28, '#40352d');
      rect(buf, sheetW, sheetH, x + width - 37, wallTop + 21, 13, 13, p.accent);
      rect(buf, sheetW, sheetH, x + 18, bottom - 2, 30, 9, '#65717a');
      break;
    case 'arcane':
      ellipse(buf, sheetW, sheetH, cx, wallTop + 48, 12, 12, [99, 226, 242, 210]);
      line(buf, sheetW, sheetH, cx - 9, wallTop + 48, cx + 9, wallTop + 48, '#f0f9ff', 2);
      line(buf, sheetW, sheetH, cx, wallTop + 39, cx, wallTop + 57, '#f0f9ff', 2);
      break;
    case 'alchemy':
      rect(buf, sheetW, sheetH, x + 18, wallTop + 22, 20, 18, '#374c34');
      ellipse(buf, sheetW, sheetH, x + 28, wallTop + 29, 7, 7, p.accent);
      break;
    case 'chapel':
      rect(buf, sheetW, sheetH, cx - 4, y + 6, 8, 28, p.accent);
      rect(buf, sheetW, sheetH, cx - 13, y + 15, 26, 7, p.accent);
      break;
    case 'gatehouse':
      rect(buf, sheetW, sheetH, x + 16, y + 30, 42, height - 42, '#858a86');
      rect(buf, sheetW, sheetH, x + width - 58, y + 30, 42, height - 42, '#858a86');
      rect(buf, sheetW, sheetH, cx - 24, bottom - 8, 48, 30, '#2f2a26');
      break;
    case 'stable':
      for (let i = 0; i < 4; i += 1) rect(buf, sheetW, sheetH, x + 22 + i * 46, wallTop + 34, 28, 24, '#5b3f28');
      break;
    case 'wallSegment':
      rect(buf, sheetW, sheetH, x + 4, y + 46, width - 8, 36, p.wall);
      for (let i = 0; i < p.w; i += 1) rect(buf, sheetW, sheetH, x + i * TILE + 4, y + 34, 22, 14, '#777d7f');
      break;
    case 'wallTower':
      rect(buf, sheetW, sheetH, x + 20, y + 34, width - 40, height - 45, p.wall);
      ellipse(buf, sheetW, sheetH, cx, y + 45, width * 0.34, 16, p.roof);
      break;
    default:
      if (p.category === 'kiosk') {
        rect(buf, sheetW, sheetH, x + 8, wallTop + 18, width - 16, 12, p.accent);
        for (let i = 0; i < p.w; i += 1) rect(buf, sheetW, sheetH, x + 10 + i * 24, wallTop + 8, 12, 20, i % 2 ? p.trim : p.accent);
      }
      break;
  }

  // The image stays transparent outside the building art; all placement guides live in JSON/TMJ metadata.
}

function makeTilesheet() {
  const pixels = Buffer.alloc(SHEET_WIDTH * SHEET_HEIGHT * 4);
  for (const prefab of PREFABS) drawBuilding(pixels, SHEET_WIDTH, SHEET_HEIGHT, prefab);
  return encodePng(SHEET_WIDTH, SHEET_HEIGHT, pixels);
}

function makeTsx(source) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="asterfall_city_buildings" tilewidth="32" tileheight="32" tilecount="${TILE_COUNT}" columns="${COLUMNS}">
 <image source="${source}" width="${SHEET_WIDTH}" height="${SHEET_HEIGHT}"/>
</tileset>
`;
}

function prefabMetadata() {
  return {
    version: 1,
    tileSize: TILE,
    tileset: {
      name: 'asterfall_city_buildings',
      image: '../../assets/tilesets/asterfall_city_buildings.png',
      tsx: '../../tilesets/asterfall_city_buildings.tsx',
      columns: COLUMNS,
      tileCount: TILE_COUNT,
    },
    placement: {
      rule: 'Place prefab tiles from startTile + localY * columns + localX on a Buildings or CityRoofs layer. Use roofHideRegion and interiorRegion for roof fade/hide workflows.',
      noAutoPlacement: true,
    },
    prefabs: PREFABS.map((p) => {
      const roofH = Math.max(2, Math.floor(p.h * 0.48));
      const interiorW = Math.max(3, p.w - 1);
      const interiorH = Math.max(3, p.h - roofH + 1);
      return {
        id: p.id,
        displayName: p.displayName,
        category: p.category,
        widthTiles: p.w,
        heightTiles: p.h,
        startTile: p.startTile,
        sheetTileX: p.x,
        sheetTileY: p.y,
        orientation: p.orientation,
        entranceSide: p.entranceSide,
        entranceTile: p.entranceTile,
        recommendedInteriorWidth: interiorW,
        recommendedInteriorHeight: interiorH,
        roofHideRegion: { x: 0, y: 0, width: p.w, height: roofH },
        interiorRegion: { x: 0, y: roofH - 1, width: p.w, height: p.h - roofH + 1 },
        collisionRegion: { x: 0, y: Math.max(1, roofH - 1), width: p.w, height: p.h - Math.max(1, roofH - 1) },
        footprintType: p.category === 'wall' ? 'wall-support' : p.orientation,
        placementHints: {
          alignDoorToRoad: p.entranceSide !== 'none',
          roadFacing: p.entranceSide,
          supportsRoofFade: true,
          supportsInteriorReveal: p.category !== 'wall',
        },
      };
    }),
  };
}

function emptyLayer(name, width, height) {
  return { data: new Array(width * height).fill(0), height, id: 0, name, opacity: 1, type: 'tilelayer', visible: true, width, x: 0, y: 0 };
}
function createPreviewMap() {
  const width = 64;
  const height = 92;
  const ground = emptyLayer('Ground', width, height);
  const roads = emptyLayer('Roads', width, height);
  const buildings = emptyLayer('Buildings', width, height);
  const roofs = emptyLayer('CityRoofs', width, height);
  const interiors = emptyLayer('CityInteriors', width, height);
  const objects = [];
  let cursorX = 2;
  let cursorY = 3;
  let rowH = 0;
  let id = 1;
  for (const p of PREFABS) {
    if (cursorX + p.w + 2 > width) {
      cursorX = 2;
      cursorY += rowH + 5;
      rowH = 0;
    }
    for (let yy = cursorY; yy < cursorY + p.h; yy += 1) {
      for (let xx = cursorX; xx < cursorX + p.w; xx += 1) {
        buildings.data[yy * width + xx] = 1 + p.startTile + (yy - cursorY) * COLUMNS + (xx - cursorX);
      }
    }
    objects.push({
      id: id++,
      name: p.id,
      type: 'prefab_label',
      x: cursorX * TILE,
      y: (cursorY - 1) * TILE,
      width: p.w * TILE,
      height: TILE,
      rotation: 0,
      visible: true,
      text: { text: p.id, wrap: true, color: '#f8fafc', pixelsize: 12 },
    });
    objects.push({
      id: id++,
      name: `${p.id}_footprint`,
      type: 'prefab_footprint',
      x: cursorX * TILE,
      y: cursorY * TILE,
      width: p.w * TILE,
      height: p.h * TILE,
      rotation: 0,
      visible: true,
    });
    cursorX += p.w + 2;
    rowH = Math.max(rowH, p.h);
  }
  let layerId = 1;
  for (const layer of [ground, roads, interiors, buildings, roofs]) layer.id = layerId++;
  return {
    compressionlevel: -1,
    height,
    infinite: false,
    layers: [
      ground,
      roads,
      interiors,
      buildings,
      roofs,
      { draworder: 'topdown', id: layerId++, name: 'PrefabInfo', objects, opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0 },
    ],
    nextlayerid: layerId,
    nextobjectid: id,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.11.2',
    tileheight: TILE,
    tilesets: [{ firstgid: 1, source: '../tilesets/asterfall_city_buildings.tsx' }],
    tilewidth: TILE,
    type: 'map',
    version: '1.10',
    width,
  };
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
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

async function main() {
  packPrefabs();
  await Promise.all([
    fs.mkdir(mapTilesetsDir, { recursive: true }),
    fs.mkdir(projectTilesetsDir, { recursive: true }),
    fs.mkdir(assetTilesetsDir, { recursive: true }),
  ]);
  const png = makeTilesheet();
  await Promise.all([
    fs.writeFile(path.join(assetTilesetsDir, 'asterfall_city_buildings.png'), png),
    fs.writeFile(path.join(projectTilesetsDir, 'asterfall_city_buildings.tsx'), makeTsx('../assets/tilesets/asterfall_city_buildings.png'), 'utf8'),
    fs.writeFile(path.join(mapTilesetsDir, 'asterfall_city_buildings.tsx'), makeTsx('../../assets/tilesets/asterfall_city_buildings.png'), 'utf8'),
    fs.writeFile(path.join(mapTilesetsDir, 'asterfall_city_building_prefabs.json'), `${JSON.stringify(prefabMetadata(), null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(mapsDir, 'asterfall_building_preview.tmj'), `${JSON.stringify(createPreviewMap(), null, 2)}\n`, 'utf8'),
  ]);
  console.log(`Generated ${PREFABS.length} Asterfall city building prefabs.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
