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
const COLUMNS = 128;

const PREFABS = [
  { id: 'asterfall_town_hall', displayName: 'Asterfall Town Hall', category: 'civic', w: 18, h: 14, style: 'townHall', roof: '#4f6f94', wall: '#9b998e', trim: '#d7bd72', accent: '#234f82' },
  { id: 'asterfall_bank', displayName: 'Asterfall Bank', category: 'service', w: 14, h: 12, style: 'bank', roof: '#4f755e', wall: '#a7a397', trim: '#d8bf75', accent: '#d6bd65' },
  { id: 'asterfall_auction_house', displayName: 'Asterfall Auction House', category: 'service', w: 18, h: 12, style: 'auction', roof: '#8b443e', wall: '#b78958', trim: '#e6c16d', accent: '#6b3b28' },
  { id: 'asterfall_inn', displayName: 'Asterfall Inn', category: 'social', w: 16, h: 12, style: 'inn', roof: '#4d6f91', wall: '#b78a55', trim: '#f0ca7a', accent: '#2c6879' },
  { id: 'asterfall_market_hall', displayName: 'Asterfall Market Hall', category: 'market', w: 18, h: 10, style: 'marketHall', roof: '#5b7849', wall: '#b07f4e', trim: '#e0b763', accent: '#b95146' },
  { id: 'asterfall_general_goods', displayName: 'General Goods Shop', category: 'merchant', w: 10, h: 8, style: 'generalGoods', roof: '#7b5842', wall: '#b58a5b', trim: '#e2c27b', accent: '#4d8069' },
  { id: 'asterfall_weaponsmith', displayName: 'Weaponsmith', category: 'crafting', w: 12, h: 8, style: 'weaponsmith', roof: '#4b5058', wall: '#94755d', trim: '#c8a66a', accent: '#cbd5dd' },
  { id: 'asterfall_armorer', displayName: 'Armorer', category: 'crafting', w: 12, h: 8, style: 'armorer', roof: '#526783', wall: '#9b8870', trim: '#d3b06b', accent: '#8baac2' },
  { id: 'asterfall_blacksmith_repair', displayName: 'Blacksmith / Repair Shop', category: 'crafting', w: 12, h: 10, style: 'blacksmith', roof: '#3d4145', wall: '#89664b', trim: '#d18a42', accent: '#ff9d3f' },
  { id: 'asterfall_arcane_shop', displayName: 'Arcane Shop', category: 'magic', w: 10, h: 10, style: 'arcane', roof: '#5b438d', wall: '#91869a', trim: '#dac77a', accent: '#6ee7f2' },
  { id: 'asterfall_alchemy_shop', displayName: 'Alchemy / Potion Shop', category: 'magic', w: 10, h: 8, style: 'alchemy', roof: '#3f7b61', wall: '#a28f68', trim: '#d7bd75', accent: '#9bdc65' },
  { id: 'asterfall_tailor', displayName: 'Tailor', category: 'profession', w: 10, h: 8, style: 'tailor', roof: '#8d4f73', wall: '#b78b68', trim: '#e8d0a0', accent: '#df86bd' },
  { id: 'asterfall_leatherworker', displayName: 'Leatherworker', category: 'profession', w: 10, h: 8, style: 'leatherworker', roof: '#566d43', wall: '#a17149', trim: '#d0a563', accent: '#8b512f' },
  { id: 'asterfall_profession_hall', displayName: 'Profession Hall', category: 'profession', w: 16, h: 10, style: 'professionHall', roof: '#657a5c', wall: '#aca286', trim: '#dcc57b', accent: '#6f66bd' },
  { id: 'asterfall_fishing_lodge', displayName: 'Fishing Lodge', category: 'profession', w: 12, h: 8, style: 'fishing', roof: '#407781', wall: '#a67d54', trim: '#d5b172', accent: '#66c6d7' },
  { id: 'asterfall_mining_office', displayName: 'Mining Office', category: 'profession', w: 12, h: 8, style: 'mining', roof: '#66645e', wall: '#988870', trim: '#c6ad70', accent: '#b7c0c8' },
  { id: 'asterfall_stable', displayName: 'Stable', category: 'travel', w: 16, h: 8, style: 'stable', roof: '#69583d', wall: '#946a3e', trim: '#d1a05f', accent: '#c49b58' },
  { id: 'asterfall_chapel', displayName: 'Chapel', category: 'civic', w: 12, h: 14, style: 'chapel', roof: '#695d8e', wall: '#aaa69a', trim: '#e3d8af', accent: '#f6f0cf' },
  { id: 'asterfall_guardhouse', displayName: 'Guardhouse', category: 'guard', w: 12, h: 10, style: 'guardhouse', roof: '#4f5963', wall: '#8d8980', trim: '#c8ad67', accent: '#37608a' },
  { id: 'asterfall_gatehouse_watchtower', displayName: 'Gatehouse / Watchtower', category: 'guard', w: 18, h: 14, style: 'gatehouse', roof: '#455561', wall: '#8f8f86', trim: '#c9b06f', accent: '#365d83' },
  { id: 'asterfall_warehouse_storage', displayName: 'Warehouse / Storage', category: 'service', w: 16, h: 10, style: 'warehouse', roof: '#5b564d', wall: '#9a744d', trim: '#cf9f5c', accent: '#9aa0a6' },
  { id: 'asterfall_townhouse_blue', displayName: 'Blue Slate Townhouse', category: 'residential', w: 8, h: 10, style: 'townhouseTall', roof: '#526e87', wall: '#a29686', trim: '#d7c08a', accent: '#5fb7d2' },
  { id: 'asterfall_townhouse_red', displayName: 'Red Gable Townhouse', category: 'residential', w: 10, h: 8, style: 'townhouseGable', roof: '#884a43', wall: '#b58a65', trim: '#e3c487', accent: '#e7a35d' },
  { id: 'asterfall_townhouse_green', displayName: 'Green Corner Townhouse', category: 'residential', w: 10, h: 10, style: 'townhouseCorner', roof: '#55724a', wall: '#ad8d66', trim: '#d5bf83', accent: '#7fb26d' },
  { id: 'asterfall_townhouse_ivory', displayName: 'Ivory Courtyard House', category: 'residential', w: 12, h: 10, style: 'courtyardHouse', roof: '#81716b', wall: '#b7ad92', trim: '#e2ca85', accent: '#b9d47a' },
  { id: 'asterfall_merchant_house_spice', displayName: 'Spice Merchant House', category: 'merchant', w: 12, h: 8, style: 'merchantSpice', roof: '#986239', wall: '#b99662', trim: '#f0cc75', accent: '#d86d3d' },
  { id: 'asterfall_merchant_house_jewel', displayName: 'Jewel Merchant House', category: 'merchant', w: 10, h: 10, style: 'merchantJewel', roof: '#5b618f', wall: '#aa9d85', trim: '#e5c36a', accent: '#7dd7c8' },
  { id: 'asterfall_merchant_house_books', displayName: 'Book Merchant House', category: 'merchant', w: 10, h: 8, style: 'merchantBooks', roof: '#66517c', wall: '#a88c6e', trim: '#dcc17c', accent: '#d8e0a6' },
];

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

function outline(buf, width, height, x, y, w, h, color, size = 2) {
  rect(buf, width, height, x, y, w, size, color);
  rect(buf, width, height, x, y + h - size, w, size, color);
  rect(buf, width, height, x, y, size, h, color);
  rect(buf, width, height, x + w - size, y, size, h, color);
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

function packPrefabs() {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const prefab of PREFABS) {
    if (x + prefab.w > COLUMNS) {
      x = 0;
      y += rowHeight + 2;
      rowHeight = 0;
    }
    prefab.x = x;
    prefab.y = y;
    prefab.startTile = y * COLUMNS + x;
    rowHeight = Math.max(rowHeight, prefab.h);
    x += prefab.w + 2;
  }
  return y + rowHeight + 1;
}

function roofPolygon(x, y, w, roofTop, wallTop, style) {
  if (['stable', 'warehouse', 'marketHall'].includes(style)) {
    return [[x + 10, wallTop + 8], [x + w - 10, wallTop + 8], [x + w - 26, roofTop], [x + 26, roofTop]];
  }
  if (['chapel', 'gatehouse', 'townhouseTall', 'arcane', 'merchantJewel'].includes(style)) {
    return [[x + 8, wallTop + 12], [x + w / 2, roofTop], [x + w - 8, wallTop + 12], [x + w - 18, wallTop + 32], [x + 18, wallTop + 32]];
  }
  return [[x + 8, wallTop + 10], [x + w / 2, roofTop], [x + w - 8, wallTop + 10], [x + w - 18, wallTop + 32], [x + 18, wallTop + 32]];
}

function drawRoof(buf, sw, sh, x, y, w, h, p, wallTop) {
  const roofTop = y + 10;
  const darkRoof = mix(p.roof, '#111827', 0.38);
  const lightRoof = mix(p.roof, '#ffffff', 0.18);
  const points = roofPolygon(x, y, w, roofTop, wallTop, p.style);
  poly(buf, sw, sh, points, darkRoof);
  const inset = p.style === 'gatehouse' ? 20 : 12;
  poly(buf, sw, sh, points.map(([px, py]) => [px < x + w / 2 ? px + inset * 0.2 : px - inset * 0.2, py + 4]), p.roof);
  for (let yy = roofTop + 12; yy < wallTop + 26; yy += 6) {
    line(buf, sw, sh, x + 14, yy, x + w - 14, yy + 1, darkRoof, 2);
    line(buf, sw, sh, x + 22, yy + 3, x + w - 22, yy + 3, mix(p.roof, '#ffffff', 0.08), 1);
  }
  line(buf, sw, sh, x + w / 2, roofTop + 2, x + w / 2, wallTop + 28, lightRoof, 2);
  line(buf, sw, sh, x + 11, wallTop + 12, x + w / 2, roofTop, darkRoof, 3);
  line(buf, sw, sh, x + w - 11, wallTop + 12, x + w / 2, roofTop, darkRoof, 3);
}

function drawDoor(buf, sw, sh, x, bottom, cx, trim, doubleDoor = false) {
  const doorW = doubleDoor ? 36 : 24;
  const doorH = 42;
  const dx = cx - doorW / 2;
  const dy = bottom - doorH - 10;
  rect(buf, sw, sh, dx - 4, dy - 5, doorW + 8, doorH + 7, '#2e211b');
  rect(buf, sw, sh, dx, dy, doorW, doorH, '#6b442d');
  if (doubleDoor) line(buf, sw, sh, cx, dy + 2, cx, dy + doorH - 2, '#3b281e', 2);
  rect(buf, sw, sh, dx + doorW - 7, dy + 20, 4, 4, trim);
  rect(buf, sw, sh, dx - 14, bottom - 10, doorW + 28, 5, '#d1c0a0');
  rect(buf, sw, sh, dx - 22, bottom - 5, doorW + 44, 5, '#a59b8a');
}

function drawWindows(buf, sw, sh, x, y, w, wallTop, bottom, accent, count, rows = 1) {
  const glass = mix(accent, '#dff6ff', 0.45);
  for (let row = 0; row < rows; row += 1) {
    const wy = wallTop + 24 + row * 30;
    for (let i = 0; i < count; i += 1) {
      const wx = x + 32 + i * ((w - 64) / Math.max(1, count - 1));
      if (wy > bottom - 52) continue;
      rect(buf, sw, sh, wx - 3, wy - 3, 16, 17, '#5b4731');
      rect(buf, sw, sh, wx, wy, 10, 11, glass);
      line(buf, sw, sh, wx + 5, wy, wx + 5, wy + 10, '#fff0a8', 1);
      line(buf, sw, sh, wx, wy + 5, wx + 10, wy + 5, '#fff0a8', 1);
    }
  }
}

function drawBanner(buf, sw, sh, x, y, color) {
  rect(buf, sw, sh, x, y, 15, 34, color);
  poly(buf, sw, sh, [[x, y + 34], [x + 7, y + 27], [x + 15, y + 34]], mix(color, '#000000', 0.2));
  line(buf, sw, sh, x + 7, y + 5, x + 7, y + 24, '#f6d365', 2);
}

function drawSign(buf, sw, sh, x, y, color, kind = 'square') {
  rect(buf, sw, sh, x - 3, y - 3, 30, 24, '#3a2a1e');
  rect(buf, sw, sh, x, y, 24, 18, color);
  if (kind === 'coin') ellipse(buf, sw, sh, x + 12, y + 9, 7, 7, '#f4d36f');
  else if (kind === 'sword') line(buf, sw, sh, x + 6, y + 14, x + 18, y + 4, '#e5edf5', 3);
  else if (kind === 'potion') ellipse(buf, sw, sh, x + 12, y + 10, 6, 7, '#9bdc65');
  else if (kind === 'arcane') ellipse(buf, sw, sh, x + 12, y + 9, 6, 6, '#6ee7f2');
  else line(buf, sw, sh, x + 5, y + 9, x + 19, y + 9, '#f3d48a', 3);
}

function drawClutter(buf, sw, sh, x, y, p) {
  rect(buf, sw, sh, x, y, 18, 14, '#8a5b36');
  outline(buf, sw, sh, x, y, 18, 14, '#4e3424', 2);
  rect(buf, sw, sh, x + 24, y + 2, 13, 16, '#765337');
  ellipse(buf, sw, sh, x + 30, y + 2, 7, 4, '#9d754e');
  ellipse(buf, sw, sh, x + 30, y + 18, 7, 4, '#4d3828');
  ellipse(buf, sw, sh, x + 48, y + 8, 10, 8, mix(p.accent, '#6b8e4e', 0.35));
  rect(buf, sw, sh, x + 42, y + 14, 12, 8, '#6f8b48');
}

function drawBuilding(buf, sw, sh, p) {
  const x = p.x * TILE;
  const y = p.y * TILE;
  const w = p.w * TILE;
  const h = p.h * TILE;
  const bottom = y + h - 18;
  const wallTop = y + Math.floor(h * 0.42);
  const wallX = x + 18;
  const wallW = w - 36;
  const darkWall = mix(p.wall, '#1f2933', 0.24);
  const lightWall = mix(p.wall, '#ffffff', 0.13);

  ellipse(buf, sw, sh, x + w / 2, y + h - 14, w * 0.42, 14, [0, 0, 0, 72]);
  rect(buf, sw, sh, wallX, wallTop, wallW, bottom - wallTop, p.wall);
  for (let yy = wallTop + 8; yy < bottom; yy += 16) line(buf, sw, sh, wallX + 4, yy, wallX + wallW - 4, yy, lightWall, 1);
  outline(buf, sw, sh, wallX, wallTop, wallW, bottom - wallTop, darkWall, 3);
  drawRoof(buf, sw, sh, x, y, w, h, p, wallTop);
  rect(buf, sw, sh, wallX + 8, bottom - 16, wallW - 16, 10, p.trim);

  const center = x + w / 2;
  const rows = p.h > 11 ? 2 : 1;
  drawWindows(buf, sw, sh, x, y, w, wallTop, bottom, p.accent, Math.max(2, Math.floor(p.w / 2.5)), rows);
  drawDoor(buf, sw, sh, x, bottom, center, p.trim, p.w >= 14);
  drawClutter(buf, sw, sh, x + 16, bottom - 4, p);
  drawClutter(buf, sw, sh, x + w - 78, bottom - 3, p);

  const signY = bottom - 68;
  switch (p.style) {
    case 'townHall':
      rect(buf, sw, sh, center - 28, y + 26, 56, 104, '#6f7780');
      outline(buf, sw, sh, center - 28, y + 26, 56, 104, '#2d3742', 3);
      poly(buf, sw, sh, [[center - 34, y + 30], [center, y + 4], [center + 34, y + 30], [center + 24, y + 48], [center - 24, y + 48]], '#355f8c');
      ellipse(buf, sw, sh, center, y + 72, 15, 15, '#d8c27a');
      line(buf, sw, sh, center, y + 60, center, y + 72, '#34291e', 2);
      line(buf, sw, sh, center, y + 72, center + 9, y + 72, '#34291e', 2);
      drawBanner(buf, sw, sh, x + 50, wallTop + 26, '#265b8e');
      drawBanner(buf, sw, sh, x + w - 65, wallTop + 26, '#265b8e');
      break;
    case 'bank':
      for (let i = 0; i < 4; i += 1) {
        rect(buf, sw, sh, x + 42 + i * 54, wallTop + 42, 10, bottom - wallTop - 58, '#d2c8ae');
        outline(buf, sw, sh, x + 40 + i * 54, wallTop + 39, 14, bottom - wallTop - 52, '#82796a', 1);
      }
      drawSign(buf, sw, sh, center - 12, signY, '#3f5d46', 'coin');
      rect(buf, sw, sh, x + w - 72, wallTop + 50, 42, 42, '#72706c');
      outline(buf, sw, sh, x + w - 72, wallTop + 50, 42, 42, '#3d3c38', 2);
      break;
    case 'auction':
      rect(buf, sw, sh, x + 32, wallTop + 48, w - 64, 28, '#8b3f48');
      for (let i = 0; i < 6; i += 1) rect(buf, sw, sh, x + 42 + i * 44, wallTop + 78, 22, 8, p.trim);
      drawSign(buf, sw, sh, center - 12, signY, '#6b3b28', 'hammer');
      break;
    case 'inn':
      rect(buf, sw, sh, x + w - 60, y + 34, 18, 70, '#3c2a20');
      rect(buf, sw, sh, x + w - 64, y + 28, 26, 12, '#251914');
      ellipse(buf, sw, sh, x + w - 51, y + 20, 12, 7, [180, 180, 180, 90]);
      drawSign(buf, sw, sh, x + 42, signY, '#2c6879');
      rect(buf, sw, sh, x + 36, bottom - 92, 70, 24, '#276376');
      break;
    case 'blacksmith':
      rect(buf, sw, sh, x + 24, wallTop + 44, 64, 48, '#372b24');
      ellipse(buf, sw, sh, x + 56, wallTop + 68, 25, 18, '#ff9d3f');
      ellipse(buf, sw, sh, x + 56, wallTop + 70, 17, 10, '#ffd166');
      rect(buf, sw, sh, x + w - 58, y + 30, 18, 78, '#3b332d');
      drawSign(buf, sw, sh, center - 12, signY, '#3c3c3c', 'sword');
      break;
    case 'weaponsmith':
      for (let i = 0; i < 5; i += 1) line(buf, sw, sh, x + 42 + i * 26, wallTop + 72, x + 52 + i * 26, wallTop + 48, '#dce7ef', 3);
      drawSign(buf, sw, sh, center - 12, signY, '#4b5058', 'sword');
      break;
    case 'armorer':
      for (let i = 0; i < 3; i += 1) {
        ellipse(buf, sw, sh, x + 56 + i * 54, wallTop + 66, 15, 20, '#a6b2bd');
        rect(buf, sw, sh, x + 49 + i * 54, wallTop + 84, 14, 24, '#65717b');
      }
      drawSign(buf, sw, sh, center - 12, signY, '#526783');
      break;
    case 'arcane':
      rect(buf, sw, sh, center - 26, y + 32, 52, 98, '#7e6d98');
      poly(buf, sw, sh, [[center - 32, y + 36], [center, y + 2], [center + 32, y + 36], [center + 20, y + 55], [center - 20, y + 55]], '#5b438d');
      ellipse(buf, sw, sh, center, wallTop + 78, 19, 19, [110, 231, 242, 210]);
      line(buf, sw, sh, center - 15, wallTop + 78, center + 15, wallTop + 78, '#effcff', 3);
      line(buf, sw, sh, center, wallTop + 63, center, wallTop + 93, '#effcff', 3);
      drawSign(buf, sw, sh, x + 32, signY, '#5b438d', 'arcane');
      break;
    case 'alchemy':
      drawSign(buf, sw, sh, center - 12, signY, '#3f7b61', 'potion');
      ellipse(buf, sw, sh, x + 54, wallTop + 70, 20, 20, '#263529');
      ellipse(buf, sw, sh, x + 54, wallTop + 64, 17, 9, '#9bdc65');
      for (let i = 0; i < 5; i += 1) ellipse(buf, sw, sh, x + w - 74 + i * 12, wallTop + 62, 5, 10, i % 2 ? '#6ee7f2' : '#9bdc65');
      break;
    case 'tailor':
      rect(buf, sw, sh, x + 32, bottom - 95, 48, 25, '#ead7a2');
      rect(buf, sw, sh, x + 80, bottom - 95, 48, 25, p.accent);
      for (let i = 0; i < 4; i += 1) line(buf, sw, sh, x + w - 72 + i * 13, wallTop + 55, x + w - 75 + i * 13, wallTop + 95, i % 2 ? '#df86bd' : '#6f66bd', 5);
      break;
    case 'leatherworker':
      for (let i = 0; i < 4; i += 1) ellipse(buf, sw, sh, x + 54 + i * 26, wallTop + 72, 11, 20, i % 2 ? '#8b512f' : '#b17b4f');
      break;
    case 'professionHall':
      drawBanner(buf, sw, sh, x + 48, wallTop + 32, '#6f66bd');
      drawBanner(buf, sw, sh, x + w - 63, wallTop + 32, '#4f7f68');
      drawSign(buf, sw, sh, center - 12, signY, '#657a5c');
      break;
    case 'fishing':
      drawSign(buf, sw, sh, center - 12, signY, '#407781');
      line(buf, sw, sh, x + 34, wallTop + 58, x + 110, wallTop + 92, '#d8c7a0', 3);
      line(buf, sw, sh, x + 34, wallTop + 92, x + 110, wallTop + 58, '#d8c7a0', 3);
      ellipse(buf, sw, sh, x + w - 70, wallTop + 72, 30, 10, '#88cfe0');
      break;
    case 'mining':
      drawSign(buf, sw, sh, center - 12, signY, '#66645e');
      rect(buf, sw, sh, x + 34, bottom - 64, 54, 28, '#4a4238');
      for (let i = 0; i < 5; i += 1) ellipse(buf, sw, sh, x + 43 + i * 9, bottom - 58, 5, 5, '#b7c0c8');
      line(buf, sw, sh, x + w - 80, wallTop + 65, x + w - 42, wallTop + 38, '#cbd5e1', 4);
      break;
    case 'stable':
      for (let i = 0; i < 5; i += 1) {
        rect(buf, sw, sh, x + 36 + i * 48, wallTop + 66, 30, 40, '#5c3d25');
        outline(buf, sw, sh, x + 36 + i * 48, wallTop + 66, 30, 40, '#2f2117', 2);
      }
      rect(buf, sw, sh, x + w - 92, bottom - 44, 54, 18, '#b9904c');
      break;
    case 'chapel':
      rect(buf, sw, sh, center - 5, y + 11, 10, 45, p.accent);
      rect(buf, sw, sh, center - 19, y + 25, 38, 9, p.accent);
      ellipse(buf, sw, sh, center, wallTop + 72, 18, 32, '#8fb6d8');
      line(buf, sw, sh, center, wallTop + 45, center, wallTop + 92, '#f6f0cf', 3);
      line(buf, sw, sh, center - 13, wallTop + 62, center + 13, wallTop + 62, '#f6f0cf', 3);
      break;
    case 'guardhouse':
      drawBanner(buf, sw, sh, x + 38, wallTop + 30, '#365d83');
      drawBanner(buf, sw, sh, x + w - 54, wallTop + 30, '#365d83');
      drawSign(buf, sw, sh, center - 12, signY, '#4f5963');
      break;
    case 'gatehouse':
      rect(buf, sw, sh, x + 24, y + 58, 74, h - 100, '#858a86');
      rect(buf, sw, sh, x + w - 98, y + 58, 74, h - 100, '#858a86');
      outline(buf, sw, sh, x + 24, y + 58, 74, h - 100, '#3f4546', 3);
      outline(buf, sw, sh, x + w - 98, y + 58, 74, h - 100, '#3f4546', 3);
      poly(buf, sw, sh, [[x + 18, y + 70], [x + 61, y + 22], [x + 104, y + 70], [x + 92, y + 96], [x + 30, y + 96]], p.roof);
      poly(buf, sw, sh, [[x + w - 104, y + 70], [x + w - 61, y + 22], [x + w - 18, y + 70], [x + w - 30, y + 96], [x + w - 92, y + 96]], p.roof);
      rect(buf, sw, sh, center - 42, bottom - 74, 84, 64, '#2e2924');
      ellipse(buf, sw, sh, center, bottom - 10, 42, 42, '#2e2924');
      break;
    case 'warehouse':
      for (let i = 0; i < 6; i += 1) rect(buf, sw, sh, x + 44 + i * 35, wallTop + 62, 22, 44, '#68472f');
      rect(buf, sw, sh, x + 30, bottom - 52, 46, 28, '#8a5b36');
      rect(buf, sw, sh, x + 80, bottom - 52, 46, 28, '#765337');
      break;
    case 'merchantSpice':
      rect(buf, sw, sh, x + 34, bottom - 86, 50, 26, '#d86d3d');
      for (let i = 0; i < 5; i += 1) ellipse(buf, sw, sh, x + w - 90 + i * 16, wallTop + 70, 8, 8, i % 2 ? '#d86d3d' : '#d6bd65');
      break;
    case 'merchantJewel':
      ellipse(buf, sw, sh, center, wallTop + 72, 16, 16, '#7dd7c8');
      rect(buf, sw, sh, x + 38, bottom - 78, 42, 22, '#5b618f');
      break;
    case 'merchantBooks':
      for (let i = 0; i < 7; i += 1) rect(buf, sw, sh, x + 40 + i * 18, wallTop + 58, 8, 32, i % 2 ? '#d8e0a6' : '#66517c');
      break;
    default:
      if (p.category === 'residential') {
        rect(buf, sw, sh, x + 28, bottom - 78, 44, 20, p.accent);
        drawBanner(buf, sw, sh, x + w - 54, wallTop + 42, p.accent);
      }
  }
}

function makeTilesheet(rows) {
  const width = COLUMNS * TILE;
  const height = rows * TILE;
  const pixels = Buffer.alloc(width * height * 4);
  for (const prefab of PREFABS) drawBuilding(pixels, width, height, prefab);
  return { png: encodePng(width, height, pixels), width, height };
}

function makeTsx(source, rows) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="asterfall_city_buildings" tilewidth="32" tileheight="32" tilecount="${COLUMNS * rows}" columns="${COLUMNS}">
 <image source="${source}" width="${COLUMNS * TILE}" height="${rows * TILE}"/>
</tileset>
`;
}

function prefabMetadata(rows) {
  return {
    version: 2,
    tileSize: TILE,
    tileset: {
      name: 'asterfall_city_buildings',
      image: '../../assets/tilesets/asterfall_city_buildings.png',
      tsx: '../../tilesets/asterfall_city_buildings.tsx',
      columns: COLUMNS,
      tileCount: COLUMNS * rows,
    },
    placement: {
      rule: 'Place detailed large Asterfall prefabs on CityRoofs. Use interiorRegion and roofHideRegion for roof fade/hide workflows.',
      noAutoPlacement: true,
    },
    prefabs: PREFABS.map((p) => {
      const roofH = Math.max(4, Math.floor(p.h * 0.42));
      const interiorY = Math.max(2, roofH - 1);
      const entranceTile = { x: Math.floor(p.w / 2), y: p.h - 1 };
      return {
        id: p.id,
        displayName: p.displayName,
        category: p.category,
        widthTiles: p.w,
        heightTiles: p.h,
        startTile: p.startTile,
        sheetTileX: p.x,
        sheetTileY: p.y,
        orientation: p.w > p.h ? 'horizontal' : p.h > p.w ? 'vertical' : 'plaza',
        entranceSide: 'south',
        entranceTile,
        recommendedInteriorWidth: Math.max(4, p.w - 2),
        recommendedInteriorHeight: Math.max(4, p.h - interiorY),
        roofHideRegion: { x: 0, y: 0, width: p.w, height: roofH },
        interiorRegion: { x: 0, y: interiorY, width: p.w, height: p.h - interiorY },
        collisionRegion: { x: 0, y: interiorY, width: p.w, height: p.h - interiorY },
        footprintType: p.category,
        placementHints: {
          alignDoorToRoad: true,
          roadFacing: 'south',
          supportsRoofFade: true,
          supportsInteriorReveal: true,
        },
      };
    }),
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
  const rows = packPrefabs();
  await Promise.all([
    fs.mkdir(mapTilesetsDir, { recursive: true }),
    fs.mkdir(projectTilesetsDir, { recursive: true }),
    fs.mkdir(assetTilesetsDir, { recursive: true }),
  ]);
  const sheet = makeTilesheet(rows);
  await Promise.all([
    fs.writeFile(path.join(assetTilesetsDir, 'asterfall_city_buildings.png'), sheet.png),
    fs.writeFile(path.join(projectTilesetsDir, 'asterfall_city_buildings.tsx'), makeTsx('../assets/tilesets/asterfall_city_buildings.png', rows), 'utf8'),
    fs.writeFile(path.join(mapTilesetsDir, 'asterfall_city_buildings.tsx'), makeTsx('../../assets/tilesets/asterfall_city_buildings.png', rows), 'utf8'),
    fs.writeFile(path.join(mapTilesetsDir, 'asterfall_city_building_prefabs.json'), `${JSON.stringify(prefabMetadata(rows), null, 2)}\n`, 'utf8'),
  ]);
  console.log(`Generated ${PREFABS.length} detailed Asterfall building prefabs (${COLUMNS} columns, ${rows} rows).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
