import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const MAP_PATH = 'public/maps/world_region_0_0_v3.tmj';
const CHUNKS_DIR = 'public/maps/world_v3_chunks';
const TILE = 32;
const COLLISION_GID = 5393;
const WORLD_V6_CITY_FIRSTGID = 5394;
const LEGACY_SHEET_NAME = 'tamzia_buildings_v1';
const EXTERIOR_SHEET_NAME = 'tamzia_buildings_v2';
const INTERIOR_SHEET_NAME = 'tamzia_building_interiors_v1';

const SHEETS = {
  exterior: {
    name: EXTERIOR_SHEET_NAME,
    tsx: `${EXTERIOR_SHEET_NAME}.tsx`,
    png: `${EXTERIOR_SHEET_NAME}.png`,
  },
  interior: {
    name: INTERIOR_SHEET_NAME,
    tsx: `${INTERIOR_SHEET_NAME}.tsx`,
    png: `${INTERIOR_SHEET_NAME}.png`,
  },
};

const MAP_TILESET_SOURCES = Object.fromEntries(Object.entries(SHEETS).map(([key, sheet]) => [key, `../tilesets/${sheet.tsx}`]));
const CHUNK_TILESET_SOURCES = Object.fromEntries(Object.entries(SHEETS).map(([key, sheet]) => [key, `../../tilesets/${sheet.tsx}`]));
const LEGACY_MAP_TILESET_SOURCE = `../tilesets/${LEGACY_SHEET_NAME}.tsx`;
const LEGACY_CHUNK_TILESET_SOURCE = `../../tilesets/${LEGACY_SHEET_NAME}.tsx`;

const TILE_LAYER_NAMES = [
  'Ground', 'Water', 'TerrainDetails', 'Roads', 'CityBase', 'CityInteriors',
  'Decor', 'Buildings', 'CityRoofs', 'Collision',
];

const OBJECT_LAYER_NAMES = [
  'Zones', 'Spawns', 'BossSpawns', 'NPCs', 'QuestGiver', 'raceStart',
  'Graveyards', 'InteriorZones', 'RegionMarkers', 'RoadMarkers', 'Landmarks', 'Transitions',
];

const CITY = {
  cobble: WORLD_V6_CITY_FIRSTGID + 0,
  cobbleAlt: WORLD_V6_CITY_FIRSTGID + 1,
  cobbleDark: WORLD_V6_CITY_FIRSTGID + 2,
};

const BUILDINGS = [
  {
    id: 'tamzia_tailor_and_leatherworker',
    displayName: 'Tamzia Tailor and Leatherworker',
    category: 'artisan_workshop',
    interiorId: 'tamzia_tailor_and_leatherworker_interior',
    entrance: 'tamzia_tailor_and_leatherworker_entrance',
    legacyEntrance: 'tamzia_talior_and_leatherworker_entrance',
    drawExterior: drawTailorLeatherworker,
    drawInterior: drawTailorLeatherworkerInterior,
  },
  {
    id: 'tamzia_alchemist',
    displayName: 'Tamzia Alchemist',
    category: 'alchemy_shop',
    interiorId: 'tamzia_alchemist_interior',
    entrance: 'tamzia_alchemist_entrance',
    drawExterior: drawAlchemist,
    drawInterior: drawAlchemistInterior,
  },
  {
    id: 'tamzia_inn',
    displayName: 'Tamzia Inn',
    category: 'inn',
    interiorId: 'tamzia_inn_interior',
    entrance: 'tamzia_inn_entrance',
    drawExterior: drawInn,
    drawInterior: drawInnInterior,
  },
  {
    id: 'tamzia_blacksmith',
    displayName: 'Tamzia Blacksmith',
    category: 'blacksmith',
    interiorId: 'tamzia_blacksmith_interior',
    entrance: 'tamzia_blacksmith_entrance',
    drawExterior: drawBlacksmith,
    drawInterior: drawBlacksmithInterior,
  },
];

function makeImage(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function rgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function put(img, x, y, color) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = color[0];
  img.data[i + 1] = color[1];
  img.data[i + 2] = color[2];
  img.data[i + 3] = color[3];
}

function fill(img, x, y, w, h, color) {
  for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(img.height, Math.ceil(y + h)); yy += 1) {
    for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(img.width, Math.ceil(x + w)); xx += 1) put(img, xx, yy, color);
  }
}

function line(img, x0, y0, x1, y1, color) {
  const dx = Math.abs(Math.round(x1) - Math.round(x0));
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(Math.round(y1) - Math.round(y0));
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = Math.round(x0);
  let y = Math.round(y0);
  while (true) {
    put(img, x, y, color);
    if (x === Math.round(x1) && y === Math.round(y1)) break;
    const e2 = err * 2;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function polygon(img, points, color) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1]))));
  const maxY = Math.min(img.height - 1, Math.ceil(Math.max(...points.map((p) => p[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    const nodes = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi < y && yj >= y) || (yj < y && yi >= y)) {
        nodes.push(Math.floor(xi + ((y - yi) / (yj - yi)) * (xj - xi)));
      }
    }
    nodes.sort((a, b) => a - b);
    for (let i = 0; i < nodes.length; i += 2) fill(img, nodes[i], y, nodes[i + 1] - nodes[i] + 1, 1, color);
  }
}

function circle(img, cx, cy, r, color) {
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) if (x * x + y * y <= r * r) put(img, cx + x, cy + y, color);
  }
}

function drawWindow(img, x, y, w, h, glow = '#f8e8a8') {
  fill(img, x, y, w, h, rgba('#26313a'));
  fill(img, x + 3, y + 3, w - 6, h - 6, rgba(glow));
  line(img, x + Math.floor(w / 2), y + 3, x + Math.floor(w / 2), y + h - 4, rgba('#5b4630'));
  line(img, x + 3, y + Math.floor(h / 2), x + w - 4, y + Math.floor(h / 2), rgba('#5b4630'));
}

function drawDoor(img, x, y, w, h, accent = '#d6bd65') {
  fill(img, x, y, w, h, rgba('#2b1b14'));
  fill(img, x + 5, y + 6, w - 10, h - 6, rgba('#70472f'));
  line(img, x + Math.floor(w / 2), y + 7, x + Math.floor(w / 2), y + h - 3, rgba('#3a2419'));
  circle(img, x + w - 11, y + Math.floor(h * 0.58), 3, rgba(accent));
}

function tileTexture(img, x, y, w, h, base, alt, step = 32) {
  fill(img, x, y, w, h, rgba(base));
  for (let yy = y; yy < y + h; yy += step) line(img, x, yy, x + w, yy + 5, rgba(alt, 70));
  for (let xx = x; xx < x + w; xx += step) line(img, xx, y, xx + 4, y + h, rgba('#111111', 36));
}

function roofBands(img, left, right, top, bottom, color) {
  for (let y = top; y < bottom; y += 18) line(img, left, y, right, y + 8, rgba(color, 105));
}

function drawBaseBuilding(img, p, opts) {
  const W = p.widthTiles * TILE;
  const H = p.heightTiles * TILE;
  const doorCenter = Math.round((p.entranceCenterTile - p.x) * TILE);
  const doorW = Math.max(72, Math.round(p.entranceWidthTiles * TILE * 0.72));
  const wallTop = Math.round(H * opts.wallTop);
  const wallBottom = Math.round(H * opts.wallBottom);
  const wallLeft = Math.round(W * opts.wallInsetX);
  const wallRight = W - wallLeft;
  const roofTop = Math.round(H * opts.roofTop);
  const roofFront = Math.round(H * opts.roofFront);
  fill(img, Math.round(W * 0.06), H - 26, Math.round(W * 0.88), 18, rgba('#000000', 42));
  tileTexture(img, wallLeft, wallTop, wallRight - wallLeft, wallBottom - wallTop, opts.wall, opts.wallAlt);
  fill(img, wallLeft + 10, wallBottom - 20, wallRight - wallLeft - 20, 22, rgba('#4c463f'));
  polygon(img, [
    [Math.round(W * 0.05), roofFront],
    [Math.round(W * 0.5), roofTop],
    [Math.round(W * 0.95), roofFront],
    [Math.round(W * 0.9), Math.round(roofFront + H * 0.12)],
    [Math.round(W * 0.1), Math.round(roofFront + H * 0.12)],
  ], rgba(opts.roof));
  polygon(img, [
    [Math.round(W * 0.5), roofTop],
    [Math.round(W * 0.95), roofFront],
    [Math.round(W * 0.5), Math.round(roofFront + H * 0.18)],
    [Math.round(W * 0.05), roofFront],
  ], rgba(opts.roofHi));
  roofBands(img, Math.round(W * 0.09), Math.round(W * 0.91), roofTop + 18, roofFront + 72, opts.roofBand);
  const doorY = wallBottom - Math.round(H * 0.15);
  drawDoor(img, doorCenter - doorW / 2, doorY, doorW, Math.round(H * 0.14), opts.accent);
  fill(img, doorCenter - doorW / 2 - 18, doorY - 22, doorW + 36, 18, rgba(opts.accent));
  fill(img, doorCenter - doorW / 2 - 8, doorY - 18, doorW + 16, 7, rgba('#f8e8a8'));
  return { W, H, doorCenter, doorW, wallTop, wallBottom, wallLeft, wallRight, doorY };
}

function drawTailorLeatherworker(img, p) {
  const b = drawBaseBuilding(img, p, {
    wall: '#8f7f69', wallAlt: '#c5b89d', roof: '#6f4f6f', roofHi: '#8b6386', roofBand: '#b78ab7',
    accent: '#e879f9', wallTop: 0.38, wallBottom: 0.9, wallInsetX: 0.12, roofTop: 0.08, roofFront: 0.34,
  });
  for (let x = b.wallLeft + 58; x < b.wallRight - 80; x += 160) drawWindow(img, x, b.wallTop + 82, 30, 28, '#fde68a');
  [['#ef4444', 0.22], ['#38bdf8', 0.33], ['#f59e0b', 0.44], ['#22c55e', 0.55]].forEach(([color, pos], index) => {
    const x = Math.round(b.W * pos);
    fill(img, x, b.wallTop + 26, 42, 78, rgba(color));
    line(img, x, b.wallTop + 26, x + 42, b.wallTop + 104, rgba('#ffffff', 65));
    fill(img, x - 4, b.wallTop + 20, 50, 8, rgba('#4b2e1e'));
    if (index % 2) fill(img, x + 10, b.wallTop + 108, 28, 26, rgba('#7c4a2f'));
  });
  fill(img, b.W - 172, b.H - 162, 96, 78, rgba('#6b4b32'));
  fill(img, b.W - 158, b.H - 148, 68, 46, rgba('#a16207'));
  fill(img, b.W - 185, b.H - 80, 126, 20, rgba('#3f3024'));
  fill(img, 64, b.H - 146, 124, 86, rgba('#5d4430'));
  polygon(img, [[50, b.H - 146], [126, b.H - 198], [205, b.H - 146]], rgba('#9f6a3f'));
  fill(img, 84, b.H - 120, 34, 44, rgba('#d6d3d1'));
  fill(img, 128, b.H - 118, 42, 50, rgba('#92400e'));
}

function drawAlchemist(img, p) {
  const b = drawBaseBuilding(img, p, {
    wall: '#7d766d', wallAlt: '#b7ab95', roof: '#365d68', roofHi: '#4a7984', roofBand: '#70a6b3',
    accent: '#a78bfa', wallTop: 0.36, wallBottom: 0.88, wallInsetX: 0.11, roofTop: 0.06, roofFront: 0.32,
  });
  drawWindow(img, b.wallLeft + 80, b.wallTop + 86, 34, 30, '#bbf7d0');
  drawWindow(img, b.wallRight - 122, b.wallTop + 86, 34, 30, '#bfdbfe');
  fill(img, b.W * 0.68, b.wallTop - 94, 62, 116, rgba('#4b5563'));
  fill(img, b.W * 0.68 + 9, b.wallTop - 83, 44, 84, rgba('#64748b'));
  for (let i = 0; i < 5; i += 1) {
    circle(img, Math.round(b.W * 0.68 + 30 + i * 7), b.wallTop - 94 - i * 12, 10 - i, rgba(i % 2 ? '#86efac' : '#a78bfa', 82));
  }
  [['#22c55e', 0.22], ['#60a5fa', 0.29], ['#a78bfa', 0.36]].forEach(([color, pos]) => {
    const x = Math.round(b.W * pos);
    fill(img, x, b.wallTop + 42, 28, 46, rgba('#1f2937'));
    circle(img, x + 14, b.wallTop + 64, 12, rgba(color));
    fill(img, x + 10, b.wallTop + 32, 8, 15, rgba('#dbeafe'));
  });
  fill(img, b.doorCenter + b.doorW / 2 + 18, b.doorY + 10, 76, 58, rgba('#4b2e1e'));
  fill(img, b.doorCenter + b.doorW / 2 + 31, b.doorY + 20, 50, 12, rgba('#a78bfa'));
  circle(img, b.doorCenter + b.doorW / 2 + 56, b.doorY + 44, 13, rgba('#22c55e'));
}

function drawInn(img, p) {
  const b = drawBaseBuilding(img, p, {
    wall: '#9c7a55', wallAlt: '#d1b07c', roof: '#7c3f2f', roofHi: '#9a5b42', roofBand: '#c17855',
    accent: '#fbbf24', wallTop: 0.35, wallBottom: 0.9, wallInsetX: 0.1, roofTop: 0.05, roofFront: 0.31,
  });
  for (let x = b.wallLeft + 70; x < b.wallRight - 80; x += 150) {
    drawWindow(img, x, b.wallTop + 86, 32, 30, '#fde68a');
    drawWindow(img, x + 44, b.wallTop + 190, 30, 28, '#fed7aa');
  }
  fill(img, b.doorCenter - 170, b.H - 116, 340, 34, rgba('#5b4630'));
  for (let x = b.doorCenter - 144; x <= b.doorCenter + 144; x += 72) fill(img, x, b.H - 144, 16, 78, rgba('#6b4b32'));
  fill(img, b.doorCenter - 104, b.doorY - 92, 208, 40, rgba('#4b2e1e'));
  fill(img, b.doorCenter - 94, b.doorY - 84, 188, 12, rgba('#fbbf24'));
  circle(img, b.doorCenter - 124, b.doorY - 72, 22, rgba('#7c2d12'));
  fill(img, b.doorCenter - 132, b.doorY - 84, 16, 24, rgba('#fbbf24'));
  fill(img, b.W - 230, b.H - 198, 136, 112, rgba('#654321'));
  polygon(img, [[b.W - 248, b.H - 198], [b.W - 162, b.H - 250], [b.W - 72, b.H - 198]], rgba('#6f4f36'));
}

function drawBlacksmith(img, p) {
  if (p.entranceSide === 'north') {
    drawBlacksmithNorthEntrance(img, p);
    return;
  }
  if (['west', 'east'].includes(p.entranceSide)) {
    drawBlacksmithSideEntrance(img, p);
    return;
  }

  const W = p.widthTiles * TILE;
  const H = p.heightTiles * TILE;
  const doorCenter = Math.round((p.entranceCenterTile - p.x) * TILE);
  const doorW = Math.max(96, Math.round(p.entranceWidthTiles * TILE * 0.68));
  fill(img, Math.round(W * 0.06), H - 30, Math.round(W * 0.88), 20, rgba('#000000', 50));
  const wallTop = Math.round(H * 0.32);
  const wallBottom = Math.round(H * 0.86);
  const wallLeft = Math.round(W * 0.08);
  const wallRight = Math.round(W * 0.7);
  tileTexture(img, wallLeft, wallTop, wallRight - wallLeft, wallBottom - wallTop, '#6b6258', '#9b8f80');
  polygon(img, [[50, wallTop], [wallRight * 0.5, 48], [wallRight + 45, wallTop], [wallRight, wallTop + 82], [84, wallTop + 82]], rgba('#3f4854'));
  polygon(img, [[wallRight * 0.5, 48], [wallRight + 45, wallTop], [wallRight * 0.52, wallTop + 122], [50, wallTop]], rgba('#5b6673'));
  roofBands(img, 80, wallRight + 20, 76, wallTop + 72, '#7b8794');
  drawDoor(img, doorCenter - doorW / 2, wallTop + 36, doorW, 90, '#f97316');
  fill(img, doorCenter - doorW / 2 - 20, wallTop + 20, doorW + 40, 18, rgba('#f97316'));
  fill(img, W * 0.72, H * 0.2, W * 0.2, H * 0.44, rgba('#3f3024'));
  polygon(img, [[W * 0.71, H * 0.2], [W * 0.82, H * 0.1], [W * 0.94, H * 0.2], [W * 0.91, H * 0.28], [W * 0.74, H * 0.28]], rgba('#51352a'));
  fill(img, W * 0.77, H * 0.31, W * 0.11, H * 0.24, rgba('#7f1d1d'));
  fill(img, W * 0.79, H * 0.34, W * 0.07, H * 0.16, rgba('#f97316'));
  fill(img, W * 0.8, H * 0.36, W * 0.05, H * 0.1, rgba('#fde68a'));
  fill(img, W * 0.62, H * 0.05, 58, 132, rgba('#404040'));
  fill(img, W * 0.62 + 10, H * 0.03, 38, 42, rgba('#525252'));
  for (let i = 0; i < 4; i += 1) circle(img, W * 0.62 + 28 + i * 10, H * 0.02 - i * 8, 10 - i, rgba('#64748b', 80));
  fill(img, W * 0.15, H * 0.67, 130, 50, rgba('#3f3024'));
  fill(img, W * 0.18, H * 0.61, 48, 58, rgba('#475569'));
  fill(img, W * 0.19, H * 0.59, 70, 12, rgba('#94a3b8'));
  for (let x = Math.round(W * 0.3); x < Math.round(W * 0.55); x += 52) {
    fill(img, x, H * 0.63, 12, 92, rgba('#4b2e1e'));
    line(img, x + 6, H * 0.64, x + 38, H * 0.72, rgba('#d1d5db'));
  }
}

function drawBlacksmithBaseWithoutFrontDoor(img, p) {
  const W = p.widthTiles * TILE;
  const H = p.heightTiles * TILE;
  fill(img, Math.round(W * 0.06), H - 30, Math.round(W * 0.88), 20, rgba('#000000', 50));
  const wallTop = Math.round(H * 0.32);
  const wallBottom = Math.round(H * 0.86);
  const wallLeft = Math.round(W * 0.08);
  const wallRight = Math.round(W * 0.7);
  tileTexture(img, wallLeft, wallTop, wallRight - wallLeft, wallBottom - wallTop, '#6b6258', '#9b8f80');
  fill(img, wallLeft + 12, wallBottom - 22, wallRight - wallLeft - 24, 20, rgba('#4c463f'));
  polygon(img, [[50, wallTop], [wallRight * 0.5, 48], [wallRight + 45, wallTop], [wallRight, wallTop + 82], [84, wallTop + 82]], rgba('#3f4854'));
  polygon(img, [[wallRight * 0.5, 48], [wallRight + 45, wallTop], [wallRight * 0.52, wallTop + 122], [50, wallTop]], rgba('#5b6673'));
  roofBands(img, 80, wallRight + 20, 76, wallTop + 72, '#7b8794');

  fill(img, W * 0.72, H * 0.2, W * 0.2, H * 0.44, rgba('#3f3024'));
  polygon(img, [[W * 0.71, H * 0.2], [W * 0.82, H * 0.1], [W * 0.94, H * 0.2], [W * 0.91, H * 0.28], [W * 0.74, H * 0.28]], rgba('#51352a'));
  fill(img, W * 0.77, H * 0.31, W * 0.11, H * 0.24, rgba('#7f1d1d'));
  fill(img, W * 0.79, H * 0.34, W * 0.07, H * 0.16, rgba('#f97316'));
  fill(img, W * 0.8, H * 0.36, W * 0.05, H * 0.1, rgba('#fde68a'));
  fill(img, W * 0.62, H * 0.05, 58, 132, rgba('#404040'));
  fill(img, W * 0.62 + 10, H * 0.03, 38, 42, rgba('#525252'));
  for (let i = 0; i < 4; i += 1) circle(img, W * 0.62 + 28 + i * 10, H * 0.02 - i * 8, 10 - i, rgba('#64748b', 80));

  fill(img, W * 0.15, H * 0.67, 130, 50, rgba('#3f3024'));
  fill(img, W * 0.18, H * 0.61, 48, 58, rgba('#475569'));
  fill(img, W * 0.19, H * 0.59, 70, 12, rgba('#94a3b8'));
  for (let x = Math.round(W * 0.3); x < Math.round(W * 0.55); x += 52) {
    fill(img, x, H * 0.63, 12, 92, rgba('#4b2e1e'));
    line(img, x + 6, H * 0.64, x + 38, H * 0.72, rgba('#d1d5db'));
  }
  return { W, H, wallTop, wallBottom, wallLeft, wallRight };
}

function drawBlacksmithSideEntrance(img, p) {
  const b = drawBlacksmithBaseWithoutFrontDoor(img, p);
  const centerY = Math.round((p.entranceCenterTileY - p.y) * TILE);
  const sideIsWest = p.entranceSide === 'west';
  const doorH = Math.max(96, Math.min(156, Math.round(p.entranceSpanTiles * TILE * 0.38)));
  const doorW = 68;
  const sideX = sideIsWest ? b.wallLeft - 42 : b.wallRight - 26;
  const doorY = Math.max(b.wallTop + 54, Math.min(b.wallBottom - doorH - 24, centerY - doorH / 2));
  const awningX = sideIsWest ? sideX - 12 : sideX - 4;
  const stepX = sideIsWest ? sideX - 58 : sideX + doorW - 6;

  fill(img, stepX, doorY + doorH - 18, 58, 72, rgba('#000000', 32));
  fill(img, stepX, doorY + doorH - 14, 58, 18, rgba('#475569'));
  fill(img, stepX + 8, doorY + doorH + 8, 42, 15, rgba('#64748b'));
  fill(img, stepX + 16, doorY + doorH + 30, 28, 13, rgba('#7b8794'));

  fill(img, sideX - 8, doorY - 12, doorW + 16, doorH + 28, rgba('#4b5563'));
  fill(img, sideX, doorY, doorW, doorH, rgba('#2b1b14'));
  fill(img, sideX + 8, doorY + 10, doorW - 16, doorH - 14, rgba('#70472f'));
  line(img, sideX + doorW / 2, doorY + 12, sideX + doorW / 2, doorY + doorH - 8, rgba('#3a2419'));
  circle(img, sideX + (sideIsWest ? 16 : doorW - 16), doorY + Math.floor(doorH * 0.58), 3, rgba('#f97316'));

  polygon(img, [
    [awningX - 18, doorY - 14],
    [awningX + doorW / 2, doorY - 50],
    [awningX + doorW + 18, doorY - 14],
    [awningX + doorW + 10, doorY + 8],
    [awningX - 10, doorY + 8],
  ], rgba('#2f3844'));
  polygon(img, [
    [awningX - 2, doorY - 9],
    [awningX + doorW / 2, doorY - 34],
    [awningX + doorW + 2, doorY - 9],
    [awningX + doorW - 4, doorY + 4],
    [awningX + 4, doorY + 4],
  ], rgba('#64748b'));
  fill(img, awningX - 10, doorY + 6, doorW + 20, 8, rgba('#f97316'));
}

function drawBlacksmithNorthEntrance(img, p) {
  const W = p.widthTiles * TILE;
  const H = p.heightTiles * TILE;
  const doorCenter = Math.round((p.entranceCenterTile - p.x) * TILE);
  const doorW = Math.max(126, Math.round(p.entranceWidthTiles * TILE * 0.72));
  const wallTop = Math.round(H * 0.32);
  const wallBottom = Math.round(H * 0.86);
  const wallLeft = Math.round(W * 0.08);
  const wallRight = Math.round(W * 0.7);
  const roofPeakY = 44;
  const roofFrontY = wallTop + 76;

  fill(img, Math.round(W * 0.06), H - 30, Math.round(W * 0.88), 20, rgba('#000000', 50));
  tileTexture(img, wallLeft, wallTop, wallRight - wallLeft, wallBottom - wallTop, '#6b6258', '#9b8f80');
  fill(img, wallLeft + 12, wallBottom - 22, wallRight - wallLeft - 24, 20, rgba('#4c463f'));

  polygon(img, [
    [50, wallTop],
    [wallRight * 0.5, roofPeakY],
    [wallRight + 45, wallTop],
    [wallRight, roofFrontY],
    [84, roofFrontY],
  ], rgba('#3f4854'));
  polygon(img, [
    [wallRight * 0.5, roofPeakY],
    [wallRight + 45, wallTop],
    [wallRight * 0.52, wallTop + 126],
    [50, wallTop],
  ], rgba('#5b6673'));
  roofBands(img, 80, wallRight + 20, roofPeakY + 28, roofFrontY - 10, '#7b8794');

  const gateW = Math.min(196, Math.max(132, Math.round(doorW * 0.42)));
  const gateY = 78;
  const gateX = Math.max(84, Math.min(wallRight - gateW - 28, doorCenter - gateW / 2));
  fill(img, gateX - 20, gateY + 32, gateW + 40, 18, rgba('#000000', 42));
  fill(img, gateX - 24, gateY + 72, gateW + 48, 18, rgba('#475569'));
  fill(img, gateX - 12, gateY + 92, gateW + 24, 16, rgba('#64748b'));
  fill(img, gateX, gateY + 112, gateW, 14, rgba('#7b8794'));
  polygon(img, [
    [gateX - 28, gateY + 34],
    [gateX + gateW / 2, gateY - 16],
    [gateX + gateW + 28, gateY + 34],
    [gateX + gateW + 10, gateY + 62],
    [gateX - 10, gateY + 62],
  ], rgba('#2f3844'));
  polygon(img, [
    [gateX - 12, gateY + 40],
    [gateX + gateW / 2, gateY + 10],
    [gateX + gateW + 12, gateY + 40],
    [gateX + gateW + 4, gateY + 56],
    [gateX - 4, gateY + 56],
  ], rgba('#64748b'));
  fill(img, gateX - 10, gateY + 54, gateW + 20, 68, rgba('#4b5563'));
  fill(img, gateX + 6, gateY + 66, gateW - 12, 52, rgba('#2b1b14'));
  fill(img, gateX + 16, gateY + 72, gateW - 32, 42, rgba('#70472f'));
  line(img, gateX + gateW / 2, gateY + 74, gateX + gateW / 2, gateY + 112, rgba('#3a2419'));
  fill(img, gateX - 18, gateY + 56, 12, 66, rgba('#9ca3af'));
  fill(img, gateX + gateW + 6, gateY + 56, 12, 66, rgba('#9ca3af'));
  fill(img, gateX - 20, gateY + 120, gateW + 40, 8, rgba('#f97316'));

  fill(img, W * 0.72, H * 0.2, W * 0.2, H * 0.44, rgba('#3f3024'));
  polygon(img, [[W * 0.71, H * 0.2], [W * 0.82, H * 0.1], [W * 0.94, H * 0.2], [W * 0.91, H * 0.28], [W * 0.74, H * 0.28]], rgba('#51352a'));
  fill(img, W * 0.77, H * 0.31, W * 0.11, H * 0.24, rgba('#7f1d1d'));
  fill(img, W * 0.79, H * 0.34, W * 0.07, H * 0.16, rgba('#f97316'));
  fill(img, W * 0.8, H * 0.36, W * 0.05, H * 0.1, rgba('#fde68a'));
  fill(img, W * 0.62, H * 0.05, 58, 132, rgba('#404040'));
  fill(img, W * 0.62 + 10, H * 0.03, 38, 42, rgba('#525252'));
  for (let i = 0; i < 4; i += 1) circle(img, W * 0.62 + 28 + i * 10, H * 0.02 - i * 8, 10 - i, rgba('#64748b', 80));

  fill(img, W * 0.15, H * 0.67, 130, 50, rgba('#3f3024'));
  fill(img, W * 0.18, H * 0.61, 48, 58, rgba('#475569'));
  fill(img, W * 0.19, H * 0.59, 70, 12, rgba('#94a3b8'));
  for (let x = Math.round(W * 0.3); x < Math.round(W * 0.55); x += 52) {
    fill(img, x, H * 0.63, 12, 92, rgba('#4b2e1e'));
    line(img, x + 6, H * 0.64, x + 38, H * 0.72, rgba('#d1d5db'));
  }
}

function checkerFloor(img, colorA, colorB, grid = TILE) {
  for (let y = 0; y < img.height; y += grid) {
    for (let x = 0; x < img.width; x += grid) {
      fill(img, x, y, grid, grid, ((x / grid + y / grid) % 2) ? rgba(colorA) : rgba(colorB));
    }
  }
}

function drawInteriorShell(img, p, opts) {
  const W = p.widthTiles * TILE;
  const H = p.heightTiles * TILE;
  checkerFloor(img, opts.floorA, opts.floorB);
  for (let y = TILE; y < H - TILE; y += TILE) {
    line(img, TILE, y, W - TILE, y + 4, rgba(opts.floorLine, 72));
  }
  for (let x = TILE; x < W - TILE; x += TILE) {
    line(img, x, TILE, x + 4, H - TILE, rgba('#111111', 30));
  }

  fill(img, 0, 0, W, 34, rgba(opts.wall));
  fill(img, 0, 0, 34, H, rgba(opts.wall));
  fill(img, W - 34, 0, 34, H, rgba(opts.wall));
  fill(img, 0, H - 34, W, 34, rgba(opts.wallDark));
  fill(img, 34, 34, W - 68, 8, rgba(opts.trim));
  fill(img, 34, H - 42, W - 68, 8, rgba(opts.trimDark));

  const doorCenter = Math.round((p.entranceCenterTile - p.x) * TILE);
  const doorWidth = Math.max(96, Math.round(p.entranceWidthTiles * TILE * 0.72));
  const doorLeft = Math.max(36, Math.min(W - doorWidth - 36, doorCenter - Math.floor(doorWidth / 2)));
  if (['west', 'east'].includes(p.entranceSide)) {
    const doorHeight = Math.max(92, Math.min(148, Math.round((p.entranceSpanTiles ?? p.entranceWidthTiles) * TILE * 0.5)));
    const doorCenterY = Math.round((p.entranceCenterTileY - p.y) * TILE);
    const doorTop = Math.max(58, Math.min(H - doorHeight - 58, doorCenterY - Math.floor(doorHeight / 2)));
    if (p.entranceSide === 'west') {
      fill(img, 0, doorTop, 42, doorHeight, rgba(opts.floorA));
      fill(img, 30, doorTop - 10, 10, doorHeight + 20, rgba(opts.trim));
      fill(img, 4, doorTop, 12, doorHeight, rgba('#4b2e1e'));
    } else {
      fill(img, W - 42, doorTop, 42, doorHeight, rgba(opts.floorA));
      fill(img, W - 40, doorTop - 10, 10, doorHeight + 20, rgba(opts.trim));
      fill(img, W - 16, doorTop, 12, doorHeight, rgba('#4b2e1e'));
    }
  } else if (p.entranceSide === 'north') {
    fill(img, doorLeft, 0, doorWidth, 42, rgba(opts.floorA));
    fill(img, doorLeft - 10, 30, doorWidth + 20, 10, rgba(opts.trim));
    fill(img, doorLeft, 4, doorWidth, 12, rgba('#4b2e1e'));
  } else {
    fill(img, doorLeft, H - 42, doorWidth, 42, rgba(opts.floorA));
    fill(img, doorLeft - 10, H - 42, doorWidth + 20, 10, rgba(opts.trimDark));
    fill(img, doorLeft, H - 17, doorWidth, 13, rgba('#4b2e1e'));
  }

  return { W, H, doorCenter, doorWidth, doorLeft };
}

function drawInteriorCounter(img, x, y, w, h, color = '#6f4d34', top = '#c49a62') {
  fill(img, x, y, w, h, rgba('#3f3024'));
  fill(img, x + 5, y + 5, w - 10, h - 10, rgba(color));
  fill(img, x + 10, y + 8, w - 20, 9, rgba(top));
  fill(img, x + 8, y + h - 12, w - 16, 5, rgba('#2b1b14', 120));
}

function drawShelf(img, x, y, w, h, wood = '#5d4430', accent = '#d8c796') {
  fill(img, x, y, w, h, rgba('#2b1b14'));
  fill(img, x + 4, y + 4, w - 8, h - 8, rgba(wood));
  for (let yy = y + 18; yy < y + h - 8; yy += 36) fill(img, x + 6, yy, w - 12, 5, rgba('#2f2017'));
  for (let xx = x + 12; xx < x + w - 14; xx += 28) {
    fill(img, xx, y + 11, 13, 19, rgba(accent));
    fill(img, xx + 4, y + 48, 18, 9, rgba('#9fb6c8'));
    fill(img, xx + 2, y + 82, 12, 14, rgba('#c7a35f'));
  }
}

function drawRug(img, x, y, w, h, base, trim) {
  fill(img, x, y, w, h, rgba('#2b1b14', 170));
  fill(img, x + 5, y + 5, w - 10, h - 10, rgba(base));
  fill(img, x + 14, y + 14, w - 28, h - 28, rgba(trim));
  fill(img, x + 24, y + 22, w - 48, h - 44, rgba(base));
}

function drawTable(img, x, y, w, h, color = '#6b4b32') {
  fill(img, x, y, w, h, rgba('#2b1b14', 160));
  fill(img, x + 4, y + 4, w - 8, h - 8, rgba(color));
  fill(img, x + 10, y + 9, w - 20, 8, rgba('#c49a62'));
  fill(img, x + 12, y + h - 11, 10, 20, rgba('#3f3024'));
  fill(img, x + w - 22, y + h - 11, 10, 20, rgba('#3f3024'));
}

function drawStool(img, x, y, color = '#7a5739') {
  circle(img, x, y, 15, rgba('#2b1b14', 150));
  circle(img, x, y - 2, 12, rgba(color));
  fill(img, x - 3, y + 7, 6, 16, rgba('#3f3024'));
}

function drawTailorLeatherworkerInterior(img, p) {
  const shell = drawInteriorShell(img, p, {
    floorA: '#8c7c6a',
    floorB: '#9b8b76',
    floorLine: '#c5b89d',
    wall: '#6f5e50',
    wallDark: '#55483e',
    trim: '#d8c796',
    trimDark: '#4b2e1e',
  });
  const { W, H } = shell;
  drawRug(img, W / 2 - 150, H / 2 - 90, 300, 180, '#6f4f6f', '#d8b4fe');
  drawInteriorCounter(img, W / 2 - 155, 88, 310, 52, '#6f4d34', '#e879f9');
  drawShelf(img, 58, 58, 104, 160, '#5d4430', '#f9a8d4');
  drawShelf(img, W - 162, 58, 104, 160, '#5d4430', '#a16207');
  for (let x = W / 2 - 230; x <= W / 2 + 190; x += 70) {
    fill(img, x, H / 2 - 20, 36, 88, rgba(x % 140 ? '#e879f9' : '#facc15'));
    line(img, x, H / 2 - 20, x + 36, H / 2 + 68, rgba('#ffffff', 72));
    fill(img, x - 4, H / 2 - 28, 44, 8, rgba('#4b2e1e'));
  }
  drawTable(img, 86, H - 180, 132, 58, '#70472f');
  fill(img, 106, H - 220, 38, 54, rgba('#7c4a2f'));
  fill(img, 152, H - 216, 44, 48, rgba('#d6d3d1'));
  drawTable(img, W - 246, H - 184, 160, 62, '#6b4b32');
  for (let x = W - 224; x < W - 110; x += 34) {
    fill(img, x, H - 236, 17, 64, rgba('#a16207'));
    fill(img, x + 4, H - 248, 9, 18, rgba('#f5deb3'));
  }
  drawStool(img, W / 2 - 205, H / 2 + 112, '#7a5739');
  drawStool(img, W / 2 + 205, H / 2 + 112, '#7a5739');
}

function drawAlchemistInterior(img, p) {
  const shell = drawInteriorShell(img, p, {
    floorA: '#7b8177',
    floorB: '#879082',
    floorLine: '#bbf7d0',
    wall: '#55636a',
    wallDark: '#3e4a50',
    trim: '#a78bfa',
    trimDark: '#2f2444',
  });
  const { W, H } = shell;
  drawRug(img, W / 2 - 112, H / 2 - 68, 224, 136, '#254d5e', '#86efac');
  drawInteriorCounter(img, W / 2 - 150, 76, 300, 56, '#4b5563', '#a78bfa');
  drawShelf(img, 52, 54, 118, 160, '#374151', '#86efac');
  drawShelf(img, W - 170, 54, 118, 160, '#374151', '#60a5fa');
  for (let x = W / 2 - 230; x <= W / 2 + 210; x += 72) {
    fill(img, x, H / 2 - 12, 30, 54, rgba('#1f2937'));
    circle(img, x + 15, H / 2 + 14, 15, rgba(x % 144 ? '#22c55e' : '#a78bfa'));
    fill(img, x + 10, H / 2 - 26, 10, 22, rgba('#dbeafe'));
  }
  fill(img, W / 2 + 170, H / 2 - 104, 80, 96, rgba('#2b3138'));
  circle(img, W / 2 + 210, H / 2 - 52, 36, rgba('#22c55e', 90));
  circle(img, W / 2 + 196, H / 2 - 66, 10, rgba('#bbf7d0', 160));
  circle(img, W / 2 + 232, H / 2 - 44, 8, rgba('#a78bfa', 160));
  drawTable(img, 84, H - 170, 142, 58, '#4b5563');
  circle(img, 116, H - 145, 12, rgba('#60a5fa'));
  circle(img, 158, H - 146, 12, rgba('#86efac'));
  fill(img, 190, H - 157, 18, 32, rgba('#a78bfa'));
  drawTable(img, W - 232, H - 176, 142, 64, '#4b5563');
  for (let i = 0; i < 5; i += 1) circle(img, W - 170 + i * 15, H - 194 - i * 10, 9 - i, rgba('#86efac', 95));
}

function drawInnInterior(img, p) {
  const shell = drawInteriorShell(img, p, {
    floorA: '#8f6f4f',
    floorB: '#9c7a55',
    floorLine: '#d1b07c',
    wall: '#6f4d34',
    wallDark: '#4f3423',
    trim: '#fbbf24',
    trimDark: '#4b2e1e',
  });
  const { W, H } = shell;
  drawRug(img, W / 2 - 148, H - 320, 296, 170, '#7c3f2f', '#fbbf24');
  drawInteriorCounter(img, W / 2 - 190, 84, 380, 62, '#70472f', '#fbbf24');
  for (let x = W / 2 - 160; x <= W / 2 + 120; x += 70) {
    fill(img, x, 162, 44, 24, rgba('#3f3024'));
    fill(img, x + 8, 152, 28, 26, rgba('#d97706'));
  }
  for (let y = 250; y < H - 230; y += 140) {
    drawTable(img, 90, y, 142, 62, '#6b4b32');
    drawStool(img, 70, y + 32, '#7a5739');
    drawStool(img, 252, y + 32, '#7a5739');
    drawTable(img, W - 232, y, 142, 62, '#6b4b32');
    drawStool(img, W - 252, y + 32, '#7a5739');
    drawStool(img, W - 70, y + 32, '#7a5739');
  }
  for (let x = W / 2 - 220; x <= W / 2 + 150; x += 185) {
    fill(img, x, H / 2 - 70, 120, 76, rgba('#3f3024'));
    fill(img, x + 8, H / 2 - 62, 104, 48, rgba('#6f4f36'));
    fill(img, x + 16, H / 2 - 54, 88, 28, rgba('#d8c796'));
    fill(img, x + 12, H / 2 - 16, 96, 14, rgba('#7c3f2f'));
  }
  fill(img, W / 2 - 88, H - 220, 176, 64, rgba('#4b2e1e'));
  fill(img, W / 2 - 74, H - 210, 148, 16, rgba('#fbbf24'));
  circle(img, W / 2, H - 234, 24, rgba('#7c2d12'));
  fill(img, W / 2 - 8, H - 250, 16, 28, rgba('#fbbf24'));
}

function drawBlacksmithInterior(img, p) {
  const shell = drawInteriorShell(img, p, {
    floorA: '#65625d',
    floorB: '#746f67',
    floorLine: '#a8a29e',
    wall: '#4b5563',
    wallDark: '#343b45',
    trim: '#f97316',
    trimDark: '#3f2417',
  });
  const { W, H } = shell;
  drawInteriorCounter(img, W / 2 - 210, H - 150, 420, 58, '#5b4630', '#f97316');
  drawShelf(img, 62, 70, 118, 160, '#3f3024', '#d1d5db');
  drawShelf(img, W - 180, 70, 118, 160, '#3f3024', '#f97316');
  fill(img, W * 0.68, H * 0.3, 138, 122, rgba('#3f3024'));
  fill(img, W * 0.71, H * 0.34, 78, 68, rgba('#7f1d1d'));
  fill(img, W * 0.73, H * 0.36, 52, 42, rgba('#f97316'));
  fill(img, W * 0.745, H * 0.375, 34, 24, rgba('#fde68a'));
  for (let i = 0; i < 5; i += 1) circle(img, Math.round(W * 0.76 + i * 11), Math.round(H * 0.28 - i * 9), 10 - i, rgba('#64748b', 80));
  fill(img, W / 2 - 92, H / 2 - 54, 86, 58, rgba('#475569'));
  fill(img, W / 2 - 112, H / 2 - 62, 126, 16, rgba('#94a3b8'));
  fill(img, W / 2 - 45, H / 2 + 4, 22, 62, rgba('#334155'));
  for (let x = W / 2 + 34; x < W / 2 + 260; x += 48) {
    fill(img, x, H / 2 - 56, 12, 112, rgba('#4b2e1e'));
    line(img, x + 6, H / 2 - 46, x + 38, H / 2 + 22, rgba('#d1d5db'));
    fill(img, x + 30, H / 2 + 20, 10, 42, rgba('#94a3b8'));
  }
  drawTable(img, 210, H - 188, 158, 66, '#5b4630');
  fill(img, 238, H - 215, 42, 42, rgba('#94a3b8'));
  fill(img, 294, H - 216, 18, 58, rgba('#d1d5db'));
  drawRug(img, W / 2 - 124, 96, 248, 112, '#3f4854', '#94a3b8');
}

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return out;
}

function pngEncode(img) {
  const raw = Buffer.alloc((img.width * 4 + 1) * img.height);
  for (let y = 0; y < img.height; y += 1) {
    raw[y * (img.width * 4 + 1)] = 0;
    Buffer.from(img.data.slice(y * img.width * 4, (y + 1) * img.width * 4)).copy(raw, y * (img.width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function decodeLayer(layer) {
  if (Array.isArray(layer.data)) return layer.data.slice();
  const inflated = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Array(inflated.length / 4);
  for (let i = 0; i < data.length; i += 1) data[i] = inflated.readUInt32LE(i * 4);
  return data;
}

function encodeLayer(layer, data) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let i = 0; i < data.length; i += 1) buffer.writeUInt32LE((data[i] ?? 0) >>> 0, i * 4);
  layer.data = zlib.deflateSync(buffer, { level: 6 }).toString('base64');
  layer.encoding = 'base64';
  layer.compression = 'zlib';
}

function getProperties(object) {
  return Object.fromEntries((object?.properties ?? []).map((prop) => [prop.name, prop.value]));
}

function prop(name, type, value) {
  return { name, type, value };
}

function pointObject(id, name, x, y, properties) {
  return { id, name, x, y, width: 0, height: 0, point: true, rotation: 0, type: '', visible: true, opacity: 1, properties };
}

function rectObject(id, name, x, y, width, height, properties) {
  return { id, name, x, y, width, height, rotation: 0, type: '', visible: true, opacity: 1, properties };
}

function setTile(data, width, x, y, value) {
  if (!data || x < 0 || y < 0 || x >= width || y < 0 || y >= width) return;
  data[y * width + x] = value;
}

function getTile(data, width, x, y) {
  if (!data || x < 0 || y < 0 || x >= width || y >= width) return 0;
  return data[y * width + x] ?? 0;
}

function fillTiles(data, width, x, y, w, h, value) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) setTile(data, width, xx, yy, value);
}

function clearTiles(data, width, x, y, w, h) {
  fillTiles(data, width, x, y, w, h, 0);
}

function patternCityBase(data, width, x, y, w, h, variant = 0) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const tile = (xx + yy + variant) % 9 === 0 ? CITY.cobbleDark : (xx * 3 + yy + variant) % 4 === 0 ? CITY.cobbleAlt : CITY.cobble;
      setTile(data, width, xx, yy, tile);
    }
  }
}

function frameTiles(data, width, x, y, w, h, tile) {
  for (let xx = x; xx < x + w; xx += 1) {
    setTile(data, width, xx, y, tile);
    setTile(data, width, xx, y + h - 1, tile);
  }
  for (let yy = y; yy < y + h; yy += 1) {
    setTile(data, width, x, yy, tile);
    setTile(data, width, x + w - 1, yy, tile);
  }
}

function footprintFromObject(object) {
  const x = Math.floor(Number(object.x ?? 0) / TILE);
  const y = Math.floor(Number(object.y ?? 0) / TILE);
  const right = Math.ceil((Number(object.x ?? 0) + Number(object.width ?? 0)) / TILE);
  const bottom = Math.ceil((Number(object.y ?? 0) + Number(object.height ?? 0)) / TILE);
  return { x, y, widthTiles: Math.max(1, right - x), heightTiles: Math.max(1, bottom - y) };
}

function entranceInfo(placement, entrance) {
  const centerTile = (Number(entrance.x ?? 0) + Number(entrance.width ?? 0) / 2) / TILE;
  const centerTileY = (Number(entrance.y ?? 0) + Number(entrance.height ?? 0) / 2) / TILE;
  const distances = [
    ['west', Math.abs(centerTile - placement.x)],
    ['east', Math.abs(centerTile - (placement.x + placement.widthTiles))],
    ['north', Math.abs(centerTileY - placement.y)],
    ['south', Math.abs(centerTileY - (placement.y + placement.heightTiles))],
  ];
  const side = distances.sort((a, b) => a[1] - b[1])[0][0];
  const rawSpanTiles = ['west', 'east'].includes(side)
    ? Number(entrance.height ?? TILE * 3) / TILE
    : Number(entrance.width ?? TILE * 3) / TILE;
  const spanTiles = Math.max(3, Math.min(6, Math.round(rawSpanTiles)));
  return {
    side,
    centerTile,
    centerTileY,
    widthTiles: spanTiles,
    spanTiles,
    tile: {
      x: side === 'west' ? 0 : side === 'east' ? placement.widthTiles - 1 : Math.round(centerTile - placement.x),
      y: side === 'north' ? 1 : side === 'south' ? placement.heightTiles - 1 : Math.round(centerTileY - placement.y),
    },
  };
}

function doorPoint(placement) {
  if (placement.entranceSide === 'north') return { x: placement.x + placement.entranceTile.x, y: placement.y };
  if (placement.entranceSide === 'south') return { x: placement.x + placement.entranceTile.x, y: placement.y + placement.heightTiles };
  if (placement.entranceSide === 'west') return { x: placement.x, y: placement.y + placement.entranceTile.y };
  return { x: placement.x + placement.widthTiles, y: placement.y + placement.entranceTile.y };
}

async function readTileCountForSource(source) {
  const sourcePath = path.resolve(path.dirname(MAP_PATH), source.replaceAll('/', path.sep));
  try {
    const text = await fs.readFile(sourcePath, 'utf8');
    const match = text.match(/tilecount="(\d+)"/);
    if (match) return Number(match[1]);
  } catch {
    // fall through to known fallbacks
  }
  if (/world_v6_city/.test(source)) return 8192;
  if (/collision_debug/.test(source)) return 1;
  return 256;
}

async function nextFirstgid(map) {
  let next = 1;
  for (const tileset of map.tilesets ?? []) {
    if ([...Object.values(MAP_TILESET_SOURCES), LEGACY_MAP_TILESET_SOURCE].includes(tileset.source)) continue;
    next = Math.max(next, Number(tileset.firstgid ?? 1) + await readTileCountForSource(tileset.source ?? ''));
  }
  return next;
}

function objectIntersects(object, rect) {
  const x = Number(object.x ?? 0);
  const y = Number(object.y ?? 0);
  const w = Math.max(1, Number(object.width ?? 1));
  const h = Math.max(1, Number(object.height ?? 1));
  return x < rect.x + rect.width && x + w > rect.x && y < rect.y + rect.height && y + h > rect.y;
}

function chunkObjects(map, chunk) {
  const rect = { x: chunk.tileX * TILE, y: chunk.tileY * TILE, width: chunk.width * TILE, height: chunk.height * TILE };
  return OBJECT_LAYER_NAMES.map((name) => {
    const source = map.layers.find((layer) => layer.type === 'objectgroup' && layer.name === name);
    const objects = [];
    for (const object of source?.objects ?? []) {
      if (!objectIntersects(object, rect)) continue;
      objects.push({ ...object, x: Number(object.x ?? 0) - rect.x, y: Number(object.y ?? 0) - rect.y, sourceMapId: 'world_region_0_0_v3' });
    }
    return { type: 'objectgroup', name, visible: true, opacity: 1, objects };
  });
}

function makeTsx(name, imageSource, columns, rows) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<tileset version="1.10" tiledversion="1.11.2" name="${name}" tilewidth="32" tileheight="32" tilecount="${columns * rows}" columns="${columns}">\n <image source="${imageSource}" width="${columns * TILE}" height="${rows * TILE}"/>\n</tileset>\n`;
}

function stampPrefab(data, mapWidth, placement, firstgid, columns) {
  for (let y = 0; y < placement.heightTiles; y += 1) {
    for (let x = 0; x < placement.widthTiles; x += 1) {
      setTile(data, mapWidth, placement.x + x, placement.y + y, firstgid + (placement.sheetY + y) * columns + x);
    }
  }
}

function collisionFrame(data, mapWidth, placement) {
  for (let y = 0; y < placement.heightTiles; y += 1) {
    for (let x = 0; x < placement.widthTiles; x += 1) {
      const isFrame = x === 0 || y === 0 || x === placement.widthTiles - 1 || y === placement.heightTiles - 1;
      if (isFrame) setTile(data, mapWidth, placement.x + x, placement.y + y, COLLISION_GID);
    }
  }
}

function addInteriorCollision(data, mapWidth, placement) {
  const x = placement.x;
  const y = placement.y;
  const w = placement.widthTiles;
  const h = placement.heightTiles;
  if (placement.category === 'artisan_workshop') {
    fillTiles(data, mapWidth, x + 2, y + 2, 4, 5, COLLISION_GID);
    fillTiles(data, mapWidth, x + w - 6, y + 2, 4, 5, COLLISION_GID);
    fillTiles(data, mapWidth, x + Math.floor(w / 2) - 5, y + 3, 10, 2, COLLISION_GID);
    fillTiles(data, mapWidth, x + 3, y + h - 6, 5, 2, COLLISION_GID);
    fillTiles(data, mapWidth, x + w - 8, y + h - 6, 5, 2, COLLISION_GID);
  } else if (placement.category === 'alchemy_shop') {
    fillTiles(data, mapWidth, x + 2, y + 2, 4, 5, COLLISION_GID);
    fillTiles(data, mapWidth, x + w - 6, y + 2, 4, 5, COLLISION_GID);
    fillTiles(data, mapWidth, x + Math.floor(w / 2) - 5, y + 2, 10, 2, COLLISION_GID);
    fillTiles(data, mapWidth, x + w - 9, y + Math.floor(h / 2) - 2, 3, 3, COLLISION_GID);
    fillTiles(data, mapWidth, x + 3, y + h - 5, 5, 2, COLLISION_GID);
    fillTiles(data, mapWidth, x + w - 8, y + h - 5, 5, 2, COLLISION_GID);
  } else if (placement.category === 'inn') {
    fillTiles(data, mapWidth, x + Math.floor(w / 2) - 6, y + 3, 12, 2, COLLISION_GID);
    for (let yy = y + 8; yy < y + h - 8; yy += 4) {
      fillTiles(data, mapWidth, x + 3, yy, 5, 2, COLLISION_GID);
      fillTiles(data, mapWidth, x + w - 8, yy, 5, 2, COLLISION_GID);
    }
    fillTiles(data, mapWidth, x + Math.floor(w / 2) - 4, y + h - 7, 8, 2, COLLISION_GID);
  } else if (placement.category === 'blacksmith') {
    fillTiles(data, mapWidth, x + 2, y + 3, 4, 5, COLLISION_GID);
    fillTiles(data, mapWidth, x + w - 7, y + 3, 4, 5, COLLISION_GID);
    fillTiles(data, mapWidth, x + Math.floor(w * 0.68), y + Math.floor(h * 0.3), 5, 4, COLLISION_GID);
    fillTiles(data, mapWidth, x + Math.floor(w / 2) - 3, y + Math.floor(h / 2) - 2, 4, 4, COLLISION_GID);
    fillTiles(data, mapWidth, x + Math.floor(w / 2) - 6, y + h - 5, 12, 2, COLLISION_GID);
  }
}

function paintGroundAndCollision(data, mapWidth, placement) {
  clearTiles(data.CityRoofs, mapWidth, placement.x, placement.y, placement.widthTiles, placement.heightTiles);
  clearTiles(data.CityInteriors, mapWidth, placement.x, placement.y, placement.widthTiles, placement.heightTiles);
  clearTiles(data.Collision, mapWidth, placement.x, placement.y, placement.widthTiles, placement.heightTiles);
  clearTiles(data.CityBase, mapWidth, placement.x, placement.y, placement.widthTiles, placement.heightTiles);
  patternCityBase(data.CityBase, mapWidth, placement.x + 1, placement.y + 1, placement.widthTiles - 2, placement.heightTiles - 1, placement.sheetY);
  frameTiles(data.CityBase, mapWidth, placement.x + 1, placement.y + 1, placement.widthTiles - 2, placement.heightTiles - 1, CITY.cobbleDark);

  const entranceSpan = placement.entranceSpanTiles ?? placement.entranceWidthTiles;
  const doorX = placement.x + Math.round(placement.entranceTile.x - entranceSpan / 2);
  const doorY = placement.y + Math.round(placement.entranceTile.y - entranceSpan / 2);
  collisionFrame(data.Collision, mapWidth, placement);
  addInteriorCollision(data.Collision, mapWidth, placement);
  if (placement.entranceSide === 'north') {
    const apronY = placement.y - 2;
    patternCityBase(data.CityBase, mapWidth, doorX - 1, apronY, entranceSpan + 2, 4, placement.sheetY + 2);
    clearTiles(data.Collision, mapWidth, doorX, placement.y, entranceSpan, 2);
    fillTiles(data.CityBase, mapWidth, doorX, placement.y - 2, entranceSpan, 2, CITY.cobbleAlt);
  } else if (placement.entranceSide === 'south') {
    const apronY = placement.y + placement.heightTiles - 2;
    patternCityBase(data.CityBase, mapWidth, doorX - 1, apronY, entranceSpan + 2, 5, placement.sheetY + 2);
    clearTiles(data.Collision, mapWidth, doorX, placement.y + placement.heightTiles - 2, entranceSpan, 2);
    fillTiles(data.CityBase, mapWidth, doorX, placement.y + placement.heightTiles, entranceSpan, 2, CITY.cobbleAlt);
  } else if (placement.entranceSide === 'west') {
    patternCityBase(data.CityBase, mapWidth, placement.x - 3, doorY - 1, 5, entranceSpan + 2, placement.sheetY + 2);
    clearTiles(data.Collision, mapWidth, placement.x, doorY, 2, entranceSpan);
    fillTiles(data.CityBase, mapWidth, placement.x - 3, doorY, 3, entranceSpan, CITY.cobbleAlt);
  } else if (placement.entranceSide === 'east') {
    patternCityBase(data.CityBase, mapWidth, placement.x + placement.widthTiles - 2, doorY - 1, 5, entranceSpan + 2, placement.sheetY + 2);
    clearTiles(data.Collision, mapWidth, placement.x + placement.widthTiles - 2, doorY, 2, entranceSpan);
    fillTiles(data.CityBase, mapWidth, placement.x + placement.widthTiles, doorY, 3, entranceSpan, CITY.cobbleAlt);
  }
}

function blitPlacement(sheet, placement, draw) {
  const sub = makeImage(placement.widthTiles * TILE, placement.heightTiles * TILE);
  draw(sub, placement);
  for (let y = 0; y < sub.height; y += 1) {
    for (let x = 0; x < sub.width; x += 1) {
      const i = (y * sub.width + x) * 4;
      const color = [sub.data[i], sub.data[i + 1], sub.data[i + 2], sub.data[i + 3]];
      put(sheet, x, (placement.sheetY * TILE) + y, color);
    }
  }
}

async function writeAssets(placements, columns, rows) {
  const exterior = makeImage(columns * TILE, rows * TILE);
  const interior = makeImage(columns * TILE, rows * TILE);
  for (const placement of placements) {
    blitPlacement(exterior, placement, placement.drawExterior);
    blitPlacement(interior, placement, placement.drawInterior);
  }

  await fs.mkdir('public/maps/tilesets', { recursive: true });
  await fs.mkdir('public/assets/tilesets', { recursive: true });
  await fs.mkdir('public/tilesets', { recursive: true });
  await Promise.all([
    fs.writeFile(`public/maps/tilesets/${SHEETS.exterior.png}`, pngEncode(exterior)),
    fs.writeFile(`public/assets/tilesets/${SHEETS.exterior.png}`, pngEncode(exterior)),
    fs.writeFile(`public/maps/tilesets/${SHEETS.exterior.tsx}`, makeTsx(SHEETS.exterior.name, SHEETS.exterior.png, columns, rows), 'utf8'),
    fs.writeFile(`public/tilesets/${SHEETS.exterior.tsx}`, makeTsx(SHEETS.exterior.name, `../assets/tilesets/${SHEETS.exterior.png}`, columns, rows), 'utf8'),
    fs.writeFile(`public/maps/tilesets/${SHEETS.interior.png}`, pngEncode(interior)),
    fs.writeFile(`public/assets/tilesets/${SHEETS.interior.png}`, pngEncode(interior)),
    fs.writeFile(`public/maps/tilesets/${SHEETS.interior.tsx}`, makeTsx(SHEETS.interior.name, SHEETS.interior.png, columns, rows), 'utf8'),
    fs.writeFile(`public/tilesets/${SHEETS.interior.tsx}`, makeTsx(SHEETS.interior.name, `../assets/tilesets/${SHEETS.interior.png}`, columns, rows), 'utf8'),
  ]);
}

function updateEntranceObject(object, placement) {
  object.name = placement.entrance;
  const props = getProperties(object);
  const door = doorPoint(placement);
  object.properties = [
    prop('type', 'string', 'buildingEntrance'),
    prop('buildingId', 'string', placement.id),
    prop('interiorId', 'string', placement.interiorId),
    prop('interiorCompatible', 'bool', true),
    prop('entranceSide', 'string', placement.entranceSide),
    prop('doorX', 'int', door.x),
    prop('doorY', 'int', door.y),
    ...Object.entries(props)
      .filter(([name]) => !['type', 'buildingId', 'interiorId', 'interiorCompatible', 'entranceSide', 'doorX', 'doorY'].includes(name))
      .map(([name, value]) => prop(name, typeof value === 'boolean' ? 'bool' : Number.isFinite(Number(value)) ? 'float' : 'string', value)),
  ];
}

function objectLayer(map, name) {
  const layer = map.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === name);
  if (!layer) throw new Error(`Missing object layer: ${name}`);
  layer.objects ??= [];
  return layer;
}

function nextObjectId(map) {
  return Math.max(0, ...map.layers.flatMap((layer) => (layer.objects ?? []).map((object) => Number(object.id ?? 0)))) + 1;
}

function tilePoint(placement, localX, localY) {
  return {
    x: (placement.x + localX) * TILE + TILE / 2,
    y: (placement.y + localY) * TILE + TILE / 2,
  };
}

function npcProps(placement, displayName, npcType, color, extra = {}) {
  return [
    prop('type', 'string', npcType),
    prop('npcType', 'string', npcType),
    prop('displayName', 'string', displayName),
    prop('color', 'string', color),
    prop('interiorId', 'string', placement.interiorId),
    prop('buildingId', 'string', placement.id),
    prop('interactRange', 'int', 104),
    ...Object.entries(extra).map(([name, value]) => {
      const type = typeof value === 'boolean' ? 'bool' : Number.isInteger(value) ? 'int' : Number.isFinite(Number(value)) && value !== '' ? 'float' : 'string';
      return prop(name, type, value);
    }),
  ];
}

function addNpc(layer, id, name, placement, localX, localY, displayName, npcType, color, extra = {}) {
  const point = tilePoint(placement, localX, localY);
  layer.objects.push(pointObject(id, name, point.x, point.y, npcProps(placement, displayName, npcType, color, extra)));
}

function addInteriorObjects(map, placements) {
  const byId = Object.fromEntries(placements.map((placement) => [placement.id, placement]));
  const interiorZones = objectLayer(map, 'InteriorZones');
  const npcs = objectLayer(map, 'NPCs');
  const landmarks = objectLayer(map, 'Landmarks');
  const managedInteriorIds = new Set(placements.map((placement) => placement.interiorId));
  const managedBuildingIds = new Set(placements.map((placement) => placement.id));
  const managedNpcNames = new Set([
    'tamzia_innkeeper',
    'tamzia_general_goods_vendor',
    'tamzia_market_vendor',
    'tamzia_blacksmith_repair_smith',
    'tamzia_weaponsmith',
    'tamzia_armorer',
    'tamzia_alchemy_potion_vendor',
    'tamzia_arcane_mage_vendor',
    'tamzia_tailor',
    'tamzia_leatherworker',
    'tamzia_mining_trainer',
    'tamzia_alchemy_trainer',
  ]);
  const shouldRemove = (object) => {
    const props = getProperties(object);
    return managedInteriorIds.has(String(props.interiorId ?? object.name ?? ''))
      || managedBuildingIds.has(String(props.buildingId ?? ''))
      || managedNpcNames.has(String(object.name ?? ''));
  };

  interiorZones.objects = interiorZones.objects.filter((object) => !shouldRemove(object));
  npcs.objects = npcs.objects.filter((object) => !shouldRemove(object));
  landmarks.objects = landmarks.objects.filter((object) => !shouldRemove(object) && !String(object.name ?? '').startsWith('tamzia_artisan_building_'));

  let id = nextObjectId(map);
  for (const placement of placements) {
    const door = doorPoint(placement);
    interiorZones.objects.push(rectObject(id++, placement.interiorId, (placement.x + 1) * TILE, (placement.y + 1) * TILE, (placement.widthTiles - 2) * TILE, (placement.heightTiles - 2) * TILE, [
      prop('type', 'string', 'buildingInterior'),
      prop('buildingId', 'string', placement.id),
      prop('interiorId', 'string', placement.interiorId),
      prop('displayName', 'string', placement.displayName),
      prop('roofLayer', 'string', 'CityRoofs'),
      prop('roofHide', 'bool', true),
      prop('interiorFocus', 'bool', true),
      prop('doorX', 'int', door.x),
      prop('doorY', 'int', door.y),
      prop('debugOnly', 'bool', false),
    ]));
    landmarks.objects.push(rectObject(id++, `tamzia_artisan_building_${placement.id}`, placement.x * TILE, placement.y * TILE, placement.widthTiles * TILE, placement.heightTiles * TILE, [
      prop('type', 'string', 'building'),
      prop('buildingId', 'string', placement.id),
      prop('interiorId', 'string', placement.interiorId),
      prop('displayName', 'string', placement.displayName),
      prop('showOnMap', 'bool', false),
      prop('debugOnly', 'bool', true),
    ]));
  }

  addNpc(npcs, id++, 'tamzia_tailor', byId.tamzia_tailor_and_leatherworker, 14, 7, 'Tamzia Tailor', 'trainer', '#f9a8d4', {
    serviceType: 'professiontrainer',
    professionId: 'tailoring',
  });
  addNpc(npcs, id++, 'tamzia_leatherworker', byId.tamzia_tailor_and_leatherworker, 19, 7, 'Tamzia Leatherworker', 'trainer', '#a16207', {
    serviceType: 'professiontrainer',
    professionId: 'leatherworking',
  });
  addNpc(npcs, id++, 'tamzia_cloth_vendor', byId.tamzia_tailor_and_leatherworker, 11, 13, 'Tamzia Clothier', 'vendor', '#e879f9', {
    serviceType: 'vendor',
    shopType: 'general',
  });

  addNpc(npcs, id++, 'tamzia_alchemy_potion_vendor', byId.tamzia_alchemist, 13, 5, 'Tamzia Alchemy / Potion Vendor', 'vendor', '#22c55e', {
    serviceType: 'vendor',
    shopType: 'alchemy',
  });
  addNpc(npcs, id++, 'tamzia_arcane_mage_vendor', byId.tamzia_alchemist, 17, 5, 'Tamzia Arcane / Mage Vendor', 'vendor', '#818cf8', {
    serviceType: 'vendor',
    shopType: 'arcane',
  });
  addNpc(npcs, id++, 'tamzia_alchemy_trainer', byId.tamzia_alchemist, 9, 9, 'Tamzia Alchemist', 'trainer', '#86efac', {
    serviceType: 'professiontrainer',
    professionId: 'alchemy',
  });

  addNpc(npcs, id++, 'tamzia_innkeeper', byId.tamzia_inn, 13, 6, 'Tamzia Innkeeper', 'innkeeper', '#fbbf24', {
    serviceType: 'inn',
  });
  addNpc(npcs, id++, 'tamzia_general_goods_vendor', byId.tamzia_inn, 9, 19, 'Tamzia General Goods Vendor', 'vendor', '#38bdf8', {
    serviceType: 'vendor',
    shopType: 'general',
  });
  addNpc(npcs, id++, 'tamzia_market_vendor', byId.tamzia_inn, 17, 19, 'Tamzia Market Vendor', 'vendor', '#34d399', {
    serviceType: 'vendor',
    shopType: 'general',
  });

  addNpc(npcs, id++, 'tamzia_blacksmith_repair_smith', byId.tamzia_blacksmith, 21, 18, 'Tamzia Blacksmith / Repair Smith', 'blacksmith', '#f59e0b', {
    serviceType: 'repair',
  });
  addNpc(npcs, id++, 'tamzia_weaponsmith', byId.tamzia_blacksmith, 25, 15, 'Tamzia Weaponsmith', 'vendor', '#f97316', {
    serviceType: 'vendor',
    shopType: 'weaponsmith',
  });
  addNpc(npcs, id++, 'tamzia_armorer', byId.tamzia_blacksmith, 30, 15, 'Tamzia Armorer', 'vendor', '#94a3b8', {
    serviceType: 'vendor',
    shopType: 'armorer',
  });
  addNpc(npcs, id++, 'tamzia_mining_trainer', byId.tamzia_blacksmith, 16, 15, 'Tamzia Mining Trainer', 'trainer', '#64748b', {
    serviceType: 'professiontrainer',
    professionId: 'mining',
  });

  map.nextobjectid = id;
}

async function updateChunks(map, data, placements) {
  const affected = new Set();
  for (const p of placements) {
    const minX = Math.floor(Math.max(0, p.x - 2) / 128);
    const maxX = Math.floor(Math.min(map.width - 1, p.x + p.widthTiles + 2) / 128);
    const minY = Math.floor(Math.max(0, p.y - 2) / 128);
    const maxY = Math.floor(Math.min(map.height - 1, p.y + p.heightTiles + 4) / 128);
    for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) affected.add(`${x}_${y}`);
  }

  const indexPath = `${CHUNKS_DIR}/world_v3_chunks.json`;
  try {
    const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
    const chunkSources = new Set([...Object.values(CHUNK_TILESET_SOURCES), LEGACY_CHUNK_TILESET_SOURCE]);
    index.tilesets = (index.tilesets ?? []).filter((tileset) => !chunkSources.has(tileset.source));
    for (const [key, source] of Object.entries(MAP_TILESET_SOURCES)) {
      const mapTileset = map.tilesets.find((tileset) => tileset.source === source);
      if (mapTileset) index.tilesets.push({ ...mapTileset, source: CHUNK_TILESET_SOURCES[key] });
    }
    index.tilesets.sort((a, b) => a.firstgid - b.firstgid);
    await fs.writeFile(indexPath, `${JSON.stringify(index)}\n`, 'utf8');
  } catch {
    // Keep authoring map valid even if chunk index is not present.
  }

  const updated = [];
  for (const key of [...affected].sort()) {
    const pathName = `${CHUNKS_DIR}/chunk_${key}.json`;
    try {
      const chunk = JSON.parse(await fs.readFile(pathName, 'utf8'));
      const tileLayers = TILE_LAYER_NAMES.map((name) => {
        const chunkData = new Array(chunk.width * chunk.height).fill(0);
        for (let y = 0; y < chunk.height; y += 1) {
          for (let x = 0; x < chunk.width; x += 1) chunkData[y * chunk.width + x] = getTile(data[name], map.width, chunk.tileX + x, chunk.tileY + y);
        }
        const layer = { type: 'tilelayer', name, visible: true, opacity: 1, width: chunk.width, height: chunk.height, encoding: 'base64', compression: 'zlib', data: '' };
        encodeLayer(layer, chunkData);
        return layer;
      });
      chunk.layers = [...tileLayers, ...chunkObjects(map, chunk)];
      await fs.writeFile(pathName, `${JSON.stringify(chunk)}\n`, 'utf8');
      updated.push(`chunk_${key}.json`);
    } catch {
      // Missing chunks are ignored for local authoring.
    }
  }
  return updated;
}

async function main() {
  const map = JSON.parse(await fs.readFile(MAP_PATH, 'utf8'));
  const buildingsLayer = map.layers.find((layer) => layer.type === 'objectgroup' && layer.name === 'Buildings');
  if (!buildingsLayer) throw new Error('Missing Buildings object layer');

  const placements = [];
  for (const spec of BUILDINGS) {
    const buildingObject = buildingsLayer.objects.find((object) => object.name === spec.id);
    const entranceObject = buildingsLayer.objects.find((object) => object.name === spec.entrance || object.name === spec.legacyEntrance);
    if (!buildingObject) throw new Error(`Missing building object: ${spec.id}`);
    if (!entranceObject) throw new Error(`Missing entrance object: ${spec.entrance}`);
    const placement = {
      ...spec,
      ...footprintFromObject(buildingObject),
      object: buildingObject,
      entranceObject,
    };
    const info = entranceInfo(placement, entranceObject);
    Object.assign(placement, {
      entranceSide: info.side,
      entranceCenterTile: info.centerTile,
      entranceCenterTileY: info.centerTileY,
      entranceWidthTiles: info.widthTiles,
      entranceSpanTiles: info.spanTiles,
      entranceTile: info.tile,
    });
    placements.push(placement);
    updateEntranceObject(entranceObject, placement);
  }

  const columns = Math.max(...placements.map((placement) => placement.widthTiles));
  let sheetY = 0;
  for (const placement of placements) {
    placement.sheetY = sheetY;
    sheetY += placement.heightTiles + 1;
  }
  const rows = sheetY - 1;

  await writeAssets(placements, columns, rows);

  const managedSources = new Set([...Object.values(MAP_TILESET_SOURCES), LEGACY_MAP_TILESET_SOURCE]);
  map.tilesets = (map.tilesets ?? []).filter((tileset) => !managedSources.has(tileset.source));
  const firstgid = await nextFirstgid(map);
  const tileCount = columns * rows;
  const firstgids = {
    exterior: firstgid,
    interior: firstgid + tileCount,
  };
  map.tilesets.push({ firstgid: firstgids.exterior, source: MAP_TILESET_SOURCES.exterior });
  map.tilesets.push({ firstgid: firstgids.interior, source: MAP_TILESET_SOURCES.interior });
  map.tilesets.sort((a, b) => a.firstgid - b.firstgid);

  const tileLayers = Object.fromEntries(map.layers.filter((layer) => layer.type === 'tilelayer').map((layer) => [layer.name, layer]));
  const data = Object.fromEntries(Object.entries(tileLayers).map(([name, layer]) => [name, decodeLayer(layer)]));
  for (const placement of placements) {
    paintGroundAndCollision(data, map.width, placement);
    stampPrefab(data.CityRoofs, map.width, placement, firstgids.exterior, columns);
    stampPrefab(data.CityInteriors, map.width, placement, firstgids.interior, columns);
  }
  addInteriorObjects(map, placements);

  for (const [name, layer] of Object.entries(tileLayers)) encodeLayer(layer, data[name]);
  await fs.writeFile(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`, 'utf8');

  const metadata = {
    exteriorTileset: SHEETS.exterior.tsx,
    exteriorImage: SHEETS.exterior.png,
    interiorTileset: SHEETS.interior.tsx,
    interiorImage: SHEETS.interior.png,
    columns,
    rows,
    firstgids,
    prefabs: placements.map((placement) => ({
      id: placement.id,
      displayName: placement.displayName,
      category: placement.category,
      interiorId: placement.interiorId,
      widthTiles: placement.widthTiles,
      heightTiles: placement.heightTiles,
      entranceTile: placement.entranceTile,
      entranceSide: placement.entranceSide,
      footprint: {
        x: placement.x,
        y: placement.y,
        widthTiles: placement.widthTiles,
        heightTiles: placement.heightTiles,
      },
      roofHideRegion: {
        x: placement.x,
        y: placement.y,
        widthTiles: placement.widthTiles,
        heightTiles: placement.heightTiles,
      },
      interiorCompatible: true,
      sheetRect: {
        x: 0,
        y: placement.sheetY,
        widthTiles: placement.widthTiles,
        heightTiles: placement.heightTiles,
      },
    })),
  };
  await fs.writeFile(`public/maps/tilesets/${EXTERIOR_SHEET_NAME.replace('buildings', 'building_prefabs')}.json`, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  const chunks = await updateChunks(map, data, placements);

  console.log(JSON.stringify({
    tilesets: Object.fromEntries(Object.entries(SHEETS).map(([key, sheet]) => [key, {
      png: `public/maps/tilesets/${sheet.png}`,
      runtimePng: `public/assets/tilesets/${sheet.png}`,
      tsx: `public/maps/tilesets/${sheet.tsx}`,
      runtimeTsx: `public/tilesets/${sheet.tsx}`,
      sizeTiles: `${columns}x${rows}`,
      firstgid: firstgids[key],
    }])),
    prefabs: metadata.prefabs.map((prefab) => ({
      id: prefab.id,
      interiorId: prefab.interiorId,
      sizeTiles: `${prefab.widthTiles}x${prefab.heightTiles}`,
      entranceTile: prefab.entranceTile,
      entranceSide: prefab.entranceSide,
    })),
    chunks,
  }, null, 2));
}

await main();
