import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 32;
const TILESET_NAME = 'tamzia_bandit_hideout_v1';
const OLD_TILESET_NAME = 'tamzia_bandit_camp_v1';
const MAP_ID = 'continent_01_region_0_0';
const MAP_PATH = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions/continent_01_region_0_0.tmj');
const CHUNK_DIR = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions/chunks');
const CHUNK_INDEX_PATH = path.join(CHUNK_DIR, 'continent_01_chunks.json');
const CHUNK_PATH = path.join(CHUNK_DIR, 'chunk_5_5.json');
const CONTINENT_TILESET_DIR = path.join(ROOT, 'public/maps/world_map/continents/continent_01/tilesets');
const ASSET_TILESET_DIR = path.join(ROOT, 'public/assets/tilesets');
const PROJECT_TILESET_DIR = path.join(ROOT, 'public/tilesets');

const COLLISION_GID = 5393;
const WORLD_V6_CITY_FIRSTGID = 5394;
const CITY = {
  cobble: WORLD_V6_CITY_FIRSTGID,
  cobbleAlt: WORLD_V6_CITY_FIRSTGID + 1,
  cobbleDark: WORLD_V6_CITY_FIRSTGID + 2,
};

const PLACEMENT = {
  id: 'tamzia_bandit_hideout',
  interiorId: 'tamzia_bandit_hideout_interior',
  displayName: 'Redscar Hideout',
  x: 712,
  y: 688,
  widthTiles: 39,
  heightTiles: 22,
  doorTileX: 19,
  doorSpanTiles: 7,
  chunkX: 5,
  chunkY: 5,
};

const EXTERIOR_Y = 0;
const INTERIOR_Y = PLACEMENT.heightTiles;
const FIRE_Y = PLACEMENT.heightTiles * 2;
const COLUMNS = PLACEMENT.widthTiles;
const ROWS = FIRE_Y + 1;
const FIRE_TILE_ID = FIRE_Y * COLUMNS;
const CHUNK_TILES = 128;
const CHUNK_OFFSET_TILES_X = PLACEMENT.chunkX * CHUNK_TILES;
const CHUNK_OFFSET_TILES_Y = PLACEMENT.chunkY * CHUNK_TILES;
const CHUNK_OFFSET_X = CHUNK_OFFSET_TILES_X * TILE;
const CHUNK_OFFSET_Y = CHUNK_OFFSET_TILES_Y * TILE;

function rgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function put(image, x, y, color) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const offset = (Math.floor(y) * image.width + Math.floor(x)) * 4;
  image.data[offset] = color[0];
  image.data[offset + 1] = color[1];
  image.data[offset + 2] = color[2];
  image.data[offset + 3] = color[3];
}

function fill(image, x, y, width, height, color) {
  for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(image.height, Math.ceil(y + height)); yy += 1) {
    for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(image.width, Math.ceil(x + width)); xx += 1) {
      put(image, xx, yy, color);
    }
  }
}

function line(image, x0, y0, x1, y1, color) {
  const dx = Math.abs(Math.round(x1) - Math.round(x0));
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(Math.round(y1) - Math.round(y0));
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = Math.round(x0);
  let y = Math.round(y0);
  while (true) {
    put(image, x, y, color);
    if (x === Math.round(x1) && y === Math.round(y1)) break;
    const e2 = err * 2;
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

function polygon(image, points, color) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]))));
  const maxY = Math.min(image.height - 1, Math.ceil(Math.max(...points.map((point) => point[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    const nodes = [];
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
      const [x0, y0] = points[index];
      const [x1, y1] = points[previous];
      if ((y0 < y && y1 >= y) || (y1 < y && y0 >= y)) {
        nodes.push(Math.floor(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)));
      }
    }
    nodes.sort((a, b) => a - b);
    for (let index = 0; index < nodes.length; index += 2) {
      fill(image, nodes[index], y, nodes[index + 1] - nodes[index] + 1, 1, color);
    }
  }
}

function circle(image, cx, cy, radius, color) {
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= radius * radius) put(image, cx + x, cy + y, color);
    }
  }
}

function drawWindow(image, x, y, glow = '#f4d48a') {
  fill(image, x, y, 28, 24, rgba('#241b17'));
  fill(image, x + 4, y + 4, 20, 16, rgba(glow));
  line(image, x + 14, y + 4, x + 14, y + 20, rgba('#5b3b24'));
  line(image, x + 4, y + 12, x + 24, y + 12, rgba('#5b3b24'));
}

function drawDoor(image, centerX, baseY, width, height) {
  fill(image, centerX - width / 2 - 10, baseY - height - 12, width + 20, height + 16, rgba('#2b1b14'));
  fill(image, centerX - width / 2, baseY - height, width, height, rgba('#6d3f27'));
  line(image, centerX, baseY - height + 8, centerX, baseY - 5, rgba('#2d1912'));
  circle(image, centerX + width / 2 - 14, baseY - Math.floor(height * 0.46), 3, rgba('#d6bd65'));
}

function drawTornBanner(image, x, y, height, color = '#8f2b2b') {
  fill(image, x, y, 34, height, rgba(color));
  polygon(image, [[x, y + height], [x + 14, y + height - 18], [x + 34, y + height]], rgba(color));
  line(image, x + 2, y + 3, x + 30, y + height - 12, rgba('#f1c0a6', 150));
  fill(image, x - 4, y - 6, 42, 7, rgba('#3b2118'));
}

function drawCrate(image, x, y, width = 58, height = 42) {
  fill(image, x, y, width, height, rgba('#3b281d'));
  fill(image, x + 5, y + 5, width - 10, height - 10, rgba('#7a5130'));
  line(image, x + 5, y + 5, x + width - 6, y + height - 6, rgba('#3b281d', 180));
  line(image, x + width - 6, y + 5, x + 5, y + height - 6, rgba('#3b281d', 180));
  fill(image, x + width / 2 - 3, y + 4, 6, height - 8, rgba('#4a2f20'));
}

function drawBarrel(image, x, y) {
  fill(image, x + 8, y, 28, 44, rgba('#3b281d'));
  fill(image, x + 4, y + 6, 36, 32, rgba('#8a5b32'));
  fill(image, x + 8, y + 10, 28, 5, rgba('#b07a3d'));
  fill(image, x + 8, y + 29, 28, 5, rgba('#4a2f20'));
  fill(image, x + 11, y + 3, 22, 4, rgba('#2d1d16'));
  fill(image, x + 11, y + 37, 22, 4, rgba('#2d1d16'));
}

function drawBedroll(image, x, y, color = '#7c3a2f') {
  fill(image, x, y, 122, 44, rgba('#3b281d'));
  fill(image, x + 8, y + 7, 106, 29, rgba(color));
  fill(image, x + 14, y + 12, 34, 19, rgba('#d9c9a8'));
  fill(image, x + 57, y + 8, 4, 27, rgba('#2d1d16', 150));
  fill(image, x + 92, y + 8, 4, 27, rgba('#2d1d16', 120));
}

function drawWeaponRack(image, x, y) {
  fill(image, x, y + 62, 142, 10, rgba('#3b281d'));
  fill(image, x + 4, y + 8, 10, 64, rgba('#4a2f20'));
  fill(image, x + 126, y + 8, 10, 64, rgba('#4a2f20'));
  fill(image, x + 3, y + 20, 136, 8, rgba('#5c3b27'));
  for (let index = 0; index < 4; index += 1) {
    const swordX = x + 26 + index * 26;
    line(image, swordX, y + 4, swordX + 10, y + 62, rgba('#d1d5db', 160));
    line(image, swordX + 2, y + 4, swordX + 12, y + 62, rgba('#4a2c1e'));
    fill(image, swordX - 5, y + 47, 22, 5, rgba('#d6bd65'));
  }
}

function drawExterior(image) {
  const x = 0;
  const y = EXTERIOR_Y * TILE;
  const width = PLACEMENT.widthTiles * TILE;
  const height = PLACEMENT.heightTiles * TILE;
  const doorCenter = PLACEMENT.doorTileX * TILE + TILE / 2;
  const wallTop = y + Math.round(height * 0.35);
  const wallBottom = y + height - 42;
  const wallLeft = x + 84;
  const wallRight = x + width - 90;
  const roofPeakY = y + 36;
  const roofFrontY = y + 210;

  fill(image, x + 86, y + height - 30, width - 172, 22, rgba('#000000', 42));
  fill(image, wallLeft, wallTop, wallRight - wallLeft, wallBottom - wallTop, rgba('#6f604f'));
  for (let xx = wallLeft + 22; xx < wallRight; xx += 34) line(image, xx, wallTop + 4, xx - 5, wallBottom, rgba('#2d241d', 90));
  for (let yy = wallTop + 18; yy < wallBottom; yy += 32) line(image, wallLeft + 4, yy, wallRight - 8, yy + 4, rgba('#b9aa91', 70));
  fill(image, wallLeft, wallBottom - 16, wallRight - wallLeft, 22, rgba('#463d34'));

  polygon(image, [
    [x + 34, y + roofFrontY],
    [x + width / 2, roofPeakY],
    [x + width - 34, y + roofFrontY],
    [x + width - 88, y + roofFrontY + 58],
    [x + width / 2, y + roofFrontY + 112],
    [x + 88, y + roofFrontY + 58],
  ], rgba('#4b352d'));
  polygon(image, [
    [x + width / 2, roofPeakY],
    [x + width - 34, y + roofFrontY],
    [x + width / 2, y + roofFrontY + 112],
    [x + 34, y + roofFrontY],
  ], rgba('#5b4138'));
  for (let yy = roofPeakY + 28; yy < y + roofFrontY + 80; yy += 18) {
    line(image, x + 70, yy, x + width - 74, yy + 6, rgba('#866256', 95));
    line(image, x + 78, yy + 8, x + width - 82, yy + 13, rgba('#2b201d', 90));
  }
  line(image, x + 58, y + roofFrontY + 6, x + width - 62, y + roofFrontY + 6, rgba('#241a17', 190));

  drawDoor(image, doorCenter, wallBottom + 2, 124, 102);
  fill(image, doorCenter - 90, wallBottom - 116, 180, 15, rgba('#3b2118'));
  fill(image, doorCenter - 82, wallBottom - 112, 164, 5, rgba('#b05236'));

  [wallLeft + 68, wallLeft + 230, wallRight - 288, wallRight - 126].forEach((windowX, index) => {
    drawWindow(image, windowX, wallTop + 96 + (index % 2) * 34, index % 2 ? '#e7be78' : '#f0d08a');
  });
  drawTornBanner(image, wallLeft + 130, wallTop + 52, 92);
  drawTornBanner(image, wallRight - 178, wallTop + 58, 84, '#7e2725');

  fill(image, x + 112, wallBottom - 64, 72, 48, rgba('#5c412b'));
  fill(image, x + 124, wallBottom - 52, 48, 30, rgba('#8a5b32'));
  fill(image, x + width - 192, wallBottom - 62, 92, 58, rgba('#4e3524'));
  fill(image, x + width - 178, wallBottom - 46, 64, 26, rgba('#9a641f'));
  for (let xx = x + 76; xx < x + width - 64; xx += 128) {
    fill(image, xx, y + height - 96, 13, 72, rgba('#43291c'));
    polygon(image, [[xx - 5, y + height - 96], [xx + 6, y + height - 126], [xx + 18, y + height - 96]], rgba('#6a4a31'));
  }

  fill(image, doorCenter - 214, wallTop + 106, 34, 40, rgba('#251915'));
  fill(image, doorCenter - 208, wallTop + 116, 22, 22, rgba('#ddd3bd'));
  circle(image, doorCenter - 197, wallTop + 127, 5, rgba('#1d1512'));
}

function drawInterior(image) {
  const x = 0;
  const y = INTERIOR_Y * TILE;
  const width = PLACEMENT.widthTiles * TILE;
  const height = PLACEMENT.heightTiles * TILE;
  const doorCenter = PLACEMENT.doorTileX * TILE + TILE / 2;

  fill(image, x, y, width, height, rgba('#4c4036'));
  fill(image, x + 32, y + 32, width - 64, height - 72, rgba('#8a785f'));
  for (let yy = y + 36; yy < y + height - 76; yy += 32) {
    const shade = (yy / 32) % 2 ? '#7f6e58' : '#907e64';
    fill(image, x + 32, yy, width - 64, 28, rgba(shade));
    line(image, x + 38, yy + 27, x + width - 38, yy + 29, rgba('#3a3028', 70));
  }
  for (let xx = x + 42; xx < x + width - 42; xx += 64) {
    line(image, xx, y + 42, xx - 10, y + height - 82, rgba('#3a3028', 80));
  }

  fill(image, x + 32, y + 28, width - 64, 18, rgba('#2d241d'));
  fill(image, x + 32, y + 42, width - 64, 8, rgba('#b79a63'));
  fill(image, x + 32, y + height - 82, width - 64, 18, rgba('#2d241d'));
  fill(image, x + 32, y + 32, 12, height - 102, rgba('#2d241d'));
  fill(image, x + width - 44, y + 32, 12, height - 102, rgba('#2d241d'));

  [x + 74, x + width - 106].forEach((postX) => {
    [y + 74, y + height - 166].forEach((postY) => {
      fill(image, postX, postY, 34, 34, rgba('#2b1b14'));
      fill(image, postX + 7, postY + 5, 20, 24, rgba('#5c3b27'));
      fill(image, postX + 3, postY + 28, 28, 5, rgba('#b0793f'));
    });
  });

  fill(image, x + width / 2 - 252, y + 72, 504, 152, rgba('#3a2a23'));
  fill(image, x + width / 2 - 228, y + 94, 456, 96, rgba('#5b4138'));
  fill(image, x + width / 2 - 196, y + 118, 392, 16, rgba('#b05236'));
  fill(image, x + width / 2 - 92, y + 146, 184, 42, rgba('#4b3022'));
  fill(image, x + width / 2 - 74, y + 154, 148, 24, rgba('#7a5130'));
  fill(image, x + width / 2 - 23, y + 116, 46, 46, rgba('#2b1b14'));
  fill(image, x + width / 2 - 17, y + 108, 34, 32, rgba('#8f2b2b'));
  fill(image, x + width / 2 - 6, y + 101, 12, 14, rgba('#d6bd65'));
  drawTornBanner(image, x + width / 2 - 286, y + 112, 102, '#7e2725');
  drawTornBanner(image, x + width / 2 + 252, y + 112, 102, '#7e2725');

  fill(image, x + width / 2 - 94, y + 225, 188, 296, rgba('#692b2b', 120));
  fill(image, x + width / 2 - 82, y + 238, 164, 270, rgba('#8f3c32', 165));
  for (let yy = y + 258; yy < y + 500; yy += 40) {
    line(image, x + width / 2 - 72, yy, x + width / 2 + 72, yy + 8, rgba('#d6bd65', 110));
  }

  fill(image, x + width / 2 - 186, y + 292, 372, 118, rgba('#2f211a'));
  fill(image, x + width / 2 - 170, y + 306, 340, 88, rgba('#725035'));
  fill(image, x + width / 2 - 132, y + 322, 106, 46, rgba('#b39a70'));
  fill(image, x + width / 2 + 30, y + 320, 110, 50, rgba('#9f845b'));
  fill(image, x + width / 2 - 13, y + 318, 26, 54, rgba('#8f2b2b'));
  fill(image, x + width / 2 - 4, y + 309, 8, 72, rgba('#d6bd65'));
  line(image, x + width / 2 - 112, y + 334, x + width / 2 + 116, y + 356, rgba('#47311f', 170));
  circle(image, x + width / 2 - 64, y + 348, 7, rgba('#253f2f'));
  circle(image, x + width / 2 + 84, y + 342, 6, rgba('#253f2f'));

  drawBedroll(image, x + 82, y + 182, '#7c3a2f');
  drawBedroll(image, x + 82, y + 246, '#5f4937');
  drawBedroll(image, x + width - 204, y + 184, '#7c3a2f');
  drawBedroll(image, x + width - 204, y + 248, '#5f4937');
  drawBedroll(image, x + 94, y + 396, '#614936');
  drawBedroll(image, x + width - 216, y + 398, '#614936');

  drawCrate(image, x + 72, y + height - 214, 64, 46);
  drawCrate(image, x + 142, y + height - 202, 58, 40);
  drawBarrel(image, x + 210, y + height - 214);
  drawBarrel(image, x + width - 138, y + height - 218);
  drawCrate(image, x + width - 222, y + height - 210, 68, 44);

  drawWeaponRack(image, x + width / 2 - 250, y + height - 216);
  drawWeaponRack(image, x + width / 2 + 112, y + height - 216);

  fill(image, doorCenter - 70, y + height - 84, 140, 54, rgba('#2d1d16'));
  fill(image, doorCenter - 54, y + height - 66, 108, 32, rgba('#8a6b4d'));
  fill(image, doorCenter - 42, y + height - 54, 84, 12, rgba('#b79a63'));
}

function drawCampFireFrame(image, frame) {
  const originX = frame * TILE;
  const originY = FIRE_Y * TILE;
  const stone = rgba('#777066');
  const stoneDark = rgba('#504a43');
  [[8, 20], [13, 17], [19, 17], [24, 20], [24, 25], [18, 27], [11, 26], [7, 23]].forEach(([x, y], index) => {
    circle(image, originX + x, originY + y, index % 2 ? 4 : 5, index % 2 ? stoneDark : stone);
  });
  line(image, originX + 10, originY + 25, originX + 23, originY + 18, rgba('#5b3520'));
  line(image, originX + 8, originY + 18, originX + 25, originY + 26, rgba('#4b2b19'));
  const sway = [-2, 1, -1, 2][frame] ?? 0;
  polygon(image, [
    [originX + 16 + sway, originY + 5],
    [originX + 23, originY + 20],
    [originX + 16, originY + 26],
    [originX + 9, originY + 20],
  ], rgba('#f97316'));
  polygon(image, [
    [originX + 16 - sway, originY + 8],
    [originX + 20, originY + 20],
    [originX + 16, originY + 24],
    [originX + 12, originY + 20],
  ], rgba('#fde047'));
  polygon(image, [
    [originX + 15 + sway, originY + 13],
    [originX + 18, originY + 21],
    [originX + 15, originY + 23],
    [originX + 13, originY + 21],
  ], rgba('#fff7ad'));
}

function makeTilesetImage() {
  const image = new PNG({
    width: COLUMNS * TILE,
    height: ROWS * TILE,
    colorType: 6,
    inputColorType: 6,
  });
  image.data.fill(0);
  drawExterior(image);
  drawInterior(image);
  for (let frame = 0; frame < 4; frame += 1) drawCampFireFrame(image, frame);
  return image;
}

function makeTsx(imageSource) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${TILESET_NAME}" tilewidth="${TILE}" tileheight="${TILE}" tilecount="${COLUMNS * ROWS}" columns="${COLUMNS}">
 <image source="${imageSource}" width="${COLUMNS * TILE}" height="${ROWS * TILE}"/>
 <tile id="${FIRE_TILE_ID}" type="camp_fire">
  <animation>
   <frame tileid="${FIRE_TILE_ID}" duration="150"/>
   <frame tileid="${FIRE_TILE_ID + 1}" duration="150"/>
   <frame tileid="${FIRE_TILE_ID + 2}" duration="150"/>
   <frame tileid="${FIRE_TILE_ID + 3}" duration="150"/>
  </animation>
 </tile>
</tileset>
`;
}

function prop(name, type, value) {
  return { name, type, value };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value, pretty = false) {
  writeFileSync(filePath, `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`, 'utf8');
}

function parseTileCount(source, baseDir) {
  const sourcePath = path.resolve(baseDir, source.replaceAll('/', path.sep));
  if (!existsSync(sourcePath)) return 1;
  const text = readFileSync(sourcePath, 'utf8');
  return Number(text.match(/tilecount="(\d+)"/)?.[1] ?? 1);
}

function nextFirstGid(tilesets, baseDir) {
  return Math.max(1, ...tilesets.map((tileset) => Number(tileset.firstgid ?? 1) + parseTileCount(tileset.source, baseDir)));
}

function replaceTileset(tilesets, oldSource, newSource, firstgid, baseDir) {
  const existing = tilesets.find((tileset) => tileset.source === newSource);
  if (existing) {
    existing.firstgid = firstgid ?? existing.firstgid;
    return Number(existing.firstgid);
  }
  const old = tilesets.find((tileset) => tileset.source === oldSource);
  const chosenFirstgid = firstgid ?? Number(old?.firstgid ?? nextFirstGid(tilesets, baseDir));
  const filtered = tilesets.filter((tileset) => tileset.source !== oldSource && tileset.source !== newSource);
  filtered.push({ firstgid: chosenFirstgid, source: newSource });
  filtered.sort((a, b) => Number(a.firstgid) - Number(b.firstgid));
  tilesets.length = 0;
  tilesets.push(...filtered);
  return chosenFirstgid;
}

function decodeLayer(layer) {
  if (Array.isArray(layer.data)) return layer.data.slice();
  const inflated = zlib.inflateSync(Buffer.from(String(layer.data).trim(), 'base64'));
  const values = [];
  for (let index = 0; index < inflated.length; index += 4) values.push(inflated.readUInt32LE(index));
  return values;
}

function encodeLayer(layer, data) {
  const buffer = Buffer.alloc(data.length * 4);
  data.forEach((value, index) => buffer.writeUInt32LE(Number(value) >>> 0, index * 4));
  layer.encoding = 'base64';
  layer.compression = 'zlib';
  layer.data = zlib.deflateSync(buffer).toString('base64');
}

function tileLayer(map, name) {
  const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
  if (!layer) throw new Error(`Missing tile layer ${name}`);
  return layer;
}

function findTileLayer(map, name) {
  return map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name) ?? null;
}

function objectLayer(map, name, afterName = null) {
  let layer = map.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === name);
  if (layer) {
    layer.objects ??= [];
    return layer;
  }
  layer = {
    draworder: 'topdown',
    id: Math.max(0, ...map.layers.map((candidate) => Number(candidate.id ?? 0))) + 1,
    name,
    objects: [],
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
  const afterIndex = afterName ? map.layers.findIndex((candidate) => candidate.name === afterName) : -1;
  map.layers.splice(afterIndex >= 0 ? afterIndex + 1 : map.layers.length, 0, layer);
  return layer;
}

function setTile(data, mapWidth, x, y, value) {
  if (x < 0 || y < 0 || x >= mapWidth) return;
  data[y * mapWidth + x] = value;
}

function fillTiles(data, mapWidth, x, y, width, height, value) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) setTile(data, mapWidth, xx, yy, value);
  }
}

function stamp(data, mapWidth, x, y, width, height, firstgid, sheetY = 0) {
  for (let yy = 0; yy < height; yy += 1) {
    for (let xx = 0; xx < width; xx += 1) {
      setTile(data, mapWidth, x + xx, y + yy, firstgid + (sheetY + yy) * COLUMNS + xx);
    }
  }
}

function patternGround(data, mapWidth, x, y, width, height) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      const tile = (xx + yy) % 7 === 0 ? CITY.cobbleDark : (xx * 5 + yy) % 4 === 0 ? CITY.cobbleAlt : CITY.cobble;
      setTile(data, mapWidth, xx, yy, tile);
    }
  }
}

function addCollision(data, mapWidth, p) {
  for (let y = 0; y < p.heightTiles; y += 1) {
    for (let x = 0; x < p.widthTiles; x += 1) {
      const frame = x === 0 || y === 0 || x === p.widthTiles - 1 || y === p.heightTiles - 1;
      if (frame) setTile(data, mapWidth, p.x + x, p.y + y, COLLISION_GID);
    }
  }
  const doorStart = p.x + p.doorTileX - Math.floor(p.doorSpanTiles / 2);
  fillTiles(data, mapWidth, doorStart, p.y + p.heightTiles - 2, p.doorSpanTiles, 3, 0);
  fillTiles(data, mapWidth, p.x + 4, p.y + 4, 5, 3, COLLISION_GID);
  fillTiles(data, mapWidth, p.x + p.widthTiles - 9, p.y + 4, 5, 3, COLLISION_GID);
  fillTiles(data, mapWidth, p.x + Math.floor(p.widthTiles / 2) - 6, p.y + 9, 12, 4, COLLISION_GID);
  fillTiles(data, mapWidth, p.x + 5, p.y + p.heightTiles - 7, 6, 2, COLLISION_GID);
  fillTiles(data, mapWidth, p.x + p.widthTiles - 11, p.y + p.heightTiles - 7, 6, 2, COLLISION_GID);
}

function paintPlacement(map, firstgid) {
  const layers = {
    CityBase: tileLayer(map, 'CityBase'),
    CityInteriors: tileLayer(map, 'CityInteriors'),
    CityRoofs: tileLayer(map, 'CityRoofs'),
    Buildings: tileLayer(map, 'Buildings'),
    Collision: tileLayer(map, 'Collision'),
  };
  const data = Object.fromEntries(Object.entries(layers).map(([name, layer]) => [name, decodeLayer(layer)]));
  const p = PLACEMENT;
  fillTiles(data.CityRoofs, map.width, p.x, p.y, p.widthTiles, p.heightTiles, 0);
  fillTiles(data.CityInteriors, map.width, p.x, p.y, p.widthTiles, p.heightTiles, 0);
  fillTiles(data.Buildings, map.width, p.x, p.y, p.widthTiles, p.heightTiles, 0);
  fillTiles(data.Collision, map.width, p.x, p.y, p.widthTiles, p.heightTiles, 0);
  patternGround(data.CityBase, map.width, p.x + 1, p.y + p.heightTiles - 3, p.widthTiles - 2, 5);
  stamp(data.CityRoofs, map.width, p.x, p.y, p.widthTiles, p.heightTiles, firstgid, EXTERIOR_Y);
  stamp(data.CityInteriors, map.width, p.x, p.y, p.widthTiles, p.heightTiles, firstgid, INTERIOR_Y);
  addCollision(data.Collision, map.width, p);
  for (const [name, layer] of Object.entries(layers)) encodeLayer(layer, data[name]);
}

function upsertObject(objects, object) {
  const index = objects.findIndex((candidate) => candidate.id === object.id || candidate.name === object.name);
  if (index >= 0) objects[index] = { ...objects[index], ...object };
  else objects.push(object);
}

function removeObjects(objects, names) {
  const remove = new Set(names);
  return objects.filter((object) => !remove.has(object.name));
}

function updateObjects(map, firstgid) {
  const p = PLACEMENT;
  const buildingX = p.x * TILE;
  const buildingY = p.y * TILE;
  const buildingWidth = p.widthTiles * TILE;
  const buildingHeight = p.heightTiles * TILE;
  const doorX = p.x + p.doorTileX;
  const doorY = p.y + p.heightTiles;
  const entranceX = (doorX - Math.floor(p.doorSpanTiles / 2)) * TILE;
  const entranceY = (p.y + p.heightTiles - 1) * TILE;
  const entranceWidth = p.doorSpanTiles * TILE;

  const buildings = objectLayer(map, 'Buildings');
  buildings.objects = removeObjects(buildings.objects, [p.id, `${p.id}_entrance`]);
  upsertObject(buildings.objects, {
    height: buildingHeight,
    id: 161,
    name: p.id,
    opacity: 1,
    properties: [
      prop('type', 'string', 'building'),
      prop('buildingType', 'string', p.id),
      prop('displayName', 'string', p.displayName),
      prop('interiorId', 'string', p.interiorId),
      prop('spriteSheet', 'string', TILESET_NAME),
    ],
    rotation: 0,
    type: '',
    visible: true,
    width: buildingWidth,
    x: buildingX,
    y: buildingY,
  });
  upsertObject(buildings.objects, {
    height: TILE,
    id: 162,
    name: `${p.id}_entrance`,
    opacity: 1,
    properties: [
      prop('type', 'string', 'buildingEntrance'),
      prop('buildingId', 'string', p.id),
      prop('interiorId', 'string', p.interiorId),
      prop('interiorCompatible', 'bool', true),
      prop('entranceSide', 'string', 'south'),
      prop('doorX', 'int', doorX),
      prop('doorY', 'int', doorY),
    ],
    rotation: 0,
    type: '',
    visible: true,
    width: entranceWidth,
    x: entranceX,
    y: entranceY,
  });

  const interiorZones = objectLayer(map, 'InteriorZones');
  interiorZones.objects = removeObjects(interiorZones.objects, [p.interiorId]);
  upsertObject(interiorZones.objects, {
    height: (p.heightTiles - 2) * TILE,
    id: 165,
    name: p.interiorId,
    opacity: 1,
    properties: [
      prop('type', 'string', 'buildingInterior'),
      prop('buildingId', 'string', p.id),
      prop('interiorId', 'string', p.interiorId),
      prop('displayName', 'string', p.displayName),
      prop('roofLayer', 'string', 'CityRoofs'),
      prop('roofHide', 'bool', true),
      prop('interiorFocus', 'bool', true),
      prop('doorX', 'int', doorX),
      prop('doorY', 'int', doorY),
      prop('debugOnly', 'bool', false),
    ],
    rotation: 0,
    type: '',
    visible: true,
    width: (p.widthTiles - 2) * TILE,
    x: (p.x + 1) * TILE,
    y: (p.y + 1) * TILE,
  });

  const landmarks = objectLayer(map, 'Landmarks');
  landmarks.objects = removeObjects(landmarks.objects, ['tamzia_bandit_hideout_placed']);
  upsertObject(landmarks.objects, {
    height: buildingHeight,
    id: 166,
    name: 'tamzia_bandit_hideout_placed',
    opacity: 1,
    properties: [
      prop('type', 'string', 'building'),
      prop('buildingId', 'string', p.id),
      prop('interiorId', 'string', p.interiorId),
      prop('displayName', 'string', p.displayName),
      prop('showOnMap', 'bool', false),
      prop('debugOnly', 'bool', true),
    ],
    rotation: 0,
    type: '',
    visible: true,
    width: buildingWidth,
    x: buildingX,
    y: buildingY,
  });

  const spawns = objectLayer(map, 'Spawns');
  spawns.objects = removeObjects(spawns.objects, ['tamzia_bandit_hideout_guards']);
  upsertObject(spawns.objects, {
    height: 320,
    id: 167,
    name: 'tamzia_bandit_hideout_guards',
    opacity: 1,
    properties: [
      prop('type', 'string', 'enemySpawn'),
      prop('displayName', 'string', 'Redscar Hideout Guards'),
      prop('enemyType', 'string', 'redscar-highwayman'),
      prop('spawnId', 'string', 'tamzia_redscar_hideout_guards'),
      prop('interiorId', 'string', p.interiorId),
      prop('buildingId', 'string', p.id),
      prop('maxAlive', 'int', 5),
      prop('recommendedLevel', 'int', 13),
      prop('respawnMin', 'int', 14000),
      prop('respawnMax', 'int', 23000),
      prop('movementMode', 'string', 'roam-pause'),
    ],
    rotation: 0,
    type: 'enemySpawn',
    visible: true,
    width: 672,
    x: (p.x + 9) * TILE,
    y: (p.y + 6) * TILE,
  });

  const bossSpawns = objectLayer(map, 'BossSpawns');
  bossSpawns.objects = removeObjects(bossSpawns.objects, ['redscar_captain_varn']);
  upsertObject(bossSpawns.objects, {
    height: 160,
    id: 168,
    name: 'redscar_captain_varn',
    opacity: 1,
    properties: [
      prop('type', 'string', 'bossSpawn'),
      prop('displayName', 'string', 'Redscar Captain Varn'),
      prop('bossType', 'string', 'redscar-captain'),
      prop('spawnId', 'string', 'tamzia_redscar_captain_varn'),
      prop('interiorId', 'string', p.interiorId),
      prop('buildingId', 'string', p.id),
      prop('maxAlive', 'int', 1),
      prop('questRequired', 'int', 1),
      prop('recommendedLevel', 'int', 14),
      prop('respawnMin', 'int', 90000),
      prop('respawnMax', 'int', 120000),
      prop('movementMode', 'string', 'sentinel'),
    ],
    rotation: 0,
    type: 'bossSpawn',
    visible: true,
    width: 192,
    x: (p.x + 16) * TILE,
    y: (p.y + 4) * TILE,
  });

  const props = objectLayer(map, 'Props', 'Buildings');
  props.objects = removeObjects(props.objects, ['camp_fire']);
  upsertObject(props.objects, {
    gid: firstgid + FIRE_TILE_ID,
    height: 64,
    id: 164,
    name: 'camp_fire',
    opacity: 1,
    properties: [
      prop('type', 'string', 'camp_fire'),
      prop('displayName', 'string', 'Bandit Campfire'),
      prop('spriteSheet', 'string', TILESET_NAME),
      prop('alwaysOn', 'bool', true),
      prop('color', 'string', '#ff9f45'),
      prop('radius', 'int', 118),
      prop('intensity', 'float', 0.58),
    ],
    rotation: 0,
    type: 'camp_fire',
    visible: true,
    width: 64,
    x: 23328,
    y: 23072,
  });

  map.nextobjectid = Math.max(Number(map.nextobjectid ?? 1), 169);
}

function convertRegionGidToChunk(value, mapFirstgid, chunkFirstgid) {
  const gid = Number(value ?? 0);
  if (gid >= mapFirstgid && gid < mapFirstgid + COLUMNS * ROWS) {
    return gid + (chunkFirstgid - mapFirstgid);
  }
  return gid;
}

function chunkLayerFromRegion(regionLayer, regionData, chunk, mapFirstgid, chunkFirstgid) {
  const data = new Array(chunk.width * chunk.height).fill(0);
  for (let y = 0; y < chunk.height; y += 1) {
    for (let x = 0; x < chunk.width; x += 1) {
      data[y * chunk.width + x] = convertRegionGidToChunk(
        regionData[(chunk.tileY + y) * regionLayer.width + chunk.tileX + x] ?? 0,
        mapFirstgid,
        chunkFirstgid,
      );
    }
  }
  const layer = {
    type: 'tilelayer',
    name: regionLayer.name,
    visible: regionLayer.visible,
    opacity: regionLayer.opacity ?? 1,
    width: chunk.width,
    height: chunk.height,
    encoding: 'base64',
    compression: 'zlib',
    data: '',
  };
  encodeLayer(layer, data);
  return layer;
}

function objectIntersectsChunk(object, chunk) {
  const x = Number(object.x ?? 0);
  const y = Number(object.y ?? 0);
  const width = Math.max(1, Number(object.width ?? 1));
  const height = Math.max(1, Number(object.height ?? 1));
  const rect = {
    x: chunk.tileX * TILE,
    y: chunk.tileY * TILE,
    width: chunk.width * TILE,
    height: chunk.height * TILE,
  };
  return x < rect.x + rect.width && x + width > rect.x && y < rect.y + rect.height && y + height > rect.y;
}

function objectLayerForChunk(map, name, chunk, mapFirstgid, chunkFirstgid) {
  const source = map.layers.find((layer) => layer.type === 'objectgroup' && layer.name === name);
  const objects = (source?.objects ?? [])
    .filter((object) => objectIntersectsChunk(object, chunk))
    .map((object) => ({
      ...object,
      ...(Number(object.gid ?? 0) > 0 ? { gid: convertRegionGidToChunk(object.gid, mapFirstgid, chunkFirstgid) } : {}),
      x: Number(object.x ?? 0) - chunk.tileX * TILE,
      y: Number(object.y ?? 0) - chunk.tileY * TILE,
      sourceMapId: MAP_ID,
    }));
  return { type: 'objectgroup', name, visible: true, opacity: 1, objects };
}

function updateChunkFromRegion(map, mapFirstgid, chunkFirstgid) {
  const chunk = readJson(CHUNK_PATH);
  const tileLayerNames = [
    ...new Set([
      ...chunk.layers.filter((layer) => layer.type === 'tilelayer').map((layer) => layer.name),
      ...map.layers.filter((layer) => layer.type === 'tilelayer').map((layer) => layer.name),
    ]),
  ];
  const objectLayerNames = [
    'Zones',
    'Spawns',
    'BossSpawns',
    'NPCs',
    'QuestGiver',
    'raceStart',
    'Graveyards',
    'InteriorZones',
    'RegionMarkers',
    'RoadMarkers',
    'Landmarks',
    'Buildings',
    'Props',
    'Transitions',
  ];
  const existingChunkTileLayers = new Map(
    chunk.layers
      .filter((layer) => layer.type === 'tilelayer')
      .map((layer) => [layer.name, layer]),
  );
  const tileLayers = tileLayerNames.map((name) => {
    const layer = findTileLayer(map, name);
    if (!layer) return existingChunkTileLayers.get(name);
    return chunkLayerFromRegion(layer, decodeLayer(layer), chunk, mapFirstgid, chunkFirstgid);
  }).filter(Boolean);
  chunk.layers = [
    ...tileLayers,
    ...objectLayerNames.map((name) => objectLayerForChunk(map, name, chunk, mapFirstgid, chunkFirstgid)),
  ];
  writeJson(CHUNK_PATH, chunk);
}

function writeTilesetAssets() {
  mkdirSync(CONTINENT_TILESET_DIR, { recursive: true });
  mkdirSync(ASSET_TILESET_DIR, { recursive: true });
  mkdirSync(PROJECT_TILESET_DIR, { recursive: true });

  const image = makeTilesetImage();
  const continentPng = path.join(CONTINENT_TILESET_DIR, `${TILESET_NAME}.png`);
  writeFileSync(continentPng, PNG.sync.write(image, { colorType: 6, inputColorType: 6, deflateLevel: 9 }));
  copyFileSync(continentPng, path.join(ASSET_TILESET_DIR, `${TILESET_NAME}.png`));
  writeFileSync(path.join(CONTINENT_TILESET_DIR, `${TILESET_NAME}.tsx`), makeTsx(`${TILESET_NAME}.png`), 'utf8');
  writeFileSync(path.join(PROJECT_TILESET_DIR, `${TILESET_NAME}.tsx`), makeTsx(`../assets/tilesets/${TILESET_NAME}.png`), 'utf8');
}

function updateMaps() {
  const map = readJson(MAP_PATH);
  const mapFirstgid = replaceTileset(
    map.tilesets,
    `../tilesets/${OLD_TILESET_NAME}.tsx`,
    `../tilesets/${TILESET_NAME}.tsx`,
    null,
    path.dirname(MAP_PATH),
  );
  paintPlacement(map, mapFirstgid);
  updateObjects(map, mapFirstgid);
  writeJson(MAP_PATH, map, true);

  const index = readJson(CHUNK_INDEX_PATH);
  const chunkFirstgid = replaceTileset(
    index.tilesets,
    `../../tilesets/${OLD_TILESET_NAME}.tsx`,
    `../../tilesets/${TILESET_NAME}.tsx`,
    null,
    CHUNK_DIR,
  );
  const props = objectLayer(map, 'Props');
  const campFire = props.objects.find((object) => object.name === 'camp_fire');
  if (campFire) campFire.gid = mapFirstgid + FIRE_TILE_ID;
  writeJson(CHUNK_INDEX_PATH, index);
  updateChunkFromRegion(map, mapFirstgid, chunkFirstgid);

  return { mapFirstgid, chunkFirstgid };
}

writeTilesetAssets();
const { mapFirstgid, chunkFirstgid } = updateMaps();

console.log(JSON.stringify({
  tileset: TILESET_NAME,
  sizeTiles: `${COLUMNS}x${ROWS}`,
  mapFirstgid,
  chunkFirstgid,
  campFireTileId: FIRE_TILE_ID,
  campFireGids: {
    map: mapFirstgid + FIRE_TILE_ID,
    chunk: chunkFirstgid + FIRE_TILE_ID,
  },
  placement: {
    x: PLACEMENT.x,
    y: PLACEMENT.y,
    widthTiles: PLACEMENT.widthTiles,
    heightTiles: PLACEMENT.heightTiles,
    interiorId: PLACEMENT.interiorId,
  },
}, null, 2));
