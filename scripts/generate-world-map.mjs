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
const enemyDir = path.join(publicDir, 'assets', 'enemies');
const docsDir = path.join(rootDir, 'docs');

const TILE = 32;
const COLS = 16;
const ATLAS_TILES = 256;
const WORLD_W = 300;
const WORLD_H = 600;
const WORLD_TILESET_FIRSTGID = 1;
const BUILDINGS_FIRSTGID = 257;
const COLLISION_FIRSTGID = 513;
const RACE_BUILDINGS_FIRSTGID = 258;

const WORLD_TILES = {
  grass: 1,
  grassAlt: 2,
  darkGrass: 3,
  dirt: 4,
  road: 5,
  roadLight: 6,
  water: 7,
  bank: 8,
  stone: 9,
  cityStone: 10,
  field: 11,
  ash: 12,
  snowGrass: 13,
  flowers: 14,
  bridge: 49,
  bridgeLeft: 50,
  bridgeRight: 51,
  oak: 33,
  pine: 35,
  bush: 36,
  rock: 37,
  stump: 38,
  log: 39,
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
  mine: 96,
};

const WORLD_ENEMIES = [
  ['road-bandit', '#513f35', '#d0a45f'],
  ['dire-wolf', '#2f3540', '#9fb5c8'],
  ['stone-gnoll', '#5f594e', '#d8bd7a'],
  ['ember-wraith', '#3c1d1a', '#ff8b3d'],
  ['varro-the-tollkeeper', '#55361f', '#f5c15a', true],
  ['thornmaw-alpha', '#24351e', '#98c95d', true],
  ['granite-ogre', '#5e6268', '#d3dde2', true],
  ['ash-witch', '#291b31', '#ff7a47', true],
];

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
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
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function rgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function canvas(width, height) {
  return { width, height, pixels: Buffer.alloc(width * height * 4) };
}

function pixel(c, x, y, color) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const p = (Math.floor(y) * c.width + Math.floor(x)) * 4;
  const value = Array.isArray(color) ? color : rgba(color);
  c.pixels[p] = value[0];
  c.pixels[p + 1] = value[1];
  c.pixels[p + 2] = value[2];
  c.pixels[p + 3] = value[3];
}

function rect(c, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) pixel(c, xx, yy, color);
}

function ellipse(c, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) pixel(c, x, y, color);
    }
  }
}

function line(c, x0, y0, x1, y1, color) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  while (true) {
    pixel(c, x, y, color);
    if (x === x1 && y === y1) break;
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

function drawTile(c, id, draw) {
  const x = (id % COLS) * TILE;
  const y = Math.floor(id / COLS) * TILE;
  draw(x, y);
}

function makeLayer(width, height, fill = 0) {
  return Array.from({ length: width * height }, () => fill);
}

function idx(width, x, y) {
  return y * width + x;
}

function setTile(layer, width, x, y, gid) {
  if (x < 0 || y < 0 || x >= width || y >= Math.floor(layer.length / width)) return;
  layer[idx(width, x, y)] = gid;
}

function fillRect(layer, width, x, y, w, h, gid) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) setTile(layer, width, xx, yy, gid);
}

function clearRect(layer, width, x, y, w, h) {
  fillRect(layer, width, x, y, w, h, 0);
}

function pointObject(name, x, y, props = {}) {
  return {
    id: pointObject.nextId += 1,
    name,
    point: true,
    x: x * TILE + TILE / 2,
    y: y * TILE + TILE / 2,
    properties: Object.entries(props).map(([key, value]) => ({
      name: key,
      type: typeof value === 'number' ? 'int' : 'string',
      value,
    })),
  };
}
pointObject.nextId = 1000;

function rectObject(name, x, y, w, h, props = {}) {
  return {
    id: pointObject.nextId += 1,
    name,
    x: x * TILE,
    y: y * TILE,
    width: w * TILE,
    height: h * TILE,
    properties: Object.entries(props).map(([key, value]) => ({
      name: key,
      type: typeof value === 'number' ? 'int' : 'string',
      value,
    })),
  };
}

function tileLayer(name, width, height, data) {
  return {
    data,
    height,
    id: tileLayer.nextId += 1,
    name,
    opacity: 1,
    type: 'tilelayer',
    visible: true,
    width,
    x: 0,
    y: 0,
  };
}
tileLayer.nextId = 0;

function objectLayer(name, objects) {
  return {
    draworder: 'topdown',
    id: tileLayer.nextId += 1,
    name,
    objects,
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
}

function makeTsx(name, image, columns = COLS, tileCount = ATLAS_TILES, animations = '') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${name}" tilewidth="32" tileheight="32" tilecount="${tileCount}" columns="${columns}">
 <image source="../assets/tilesets/${image}" width="${columns * TILE}" height="${Math.ceil(tileCount / columns) * TILE}"/>
${animations}</tileset>
`;
}

function drawWorldTileset() {
  const c = canvas(COLS * TILE, COLS * TILE);
  for (let id = 0; id < ATLAS_TILES; id += 1) {
    drawTile(c, id, (x, y) => {
      rect(c, x, y, TILE, TILE, '#7f9258');
      for (let i = 0; i < 7; i += 1) pixel(c, x + ((id * 7 + i * 11) % 30), y + ((id * 13 + i * 9) % 30), [255, 255, 255, 18]);
    });
  }
  const simple = (id, base, accent = null) => drawTile(c, id - 1, (x, y) => {
    rect(c, x, y, TILE, TILE, base);
    if (accent) for (let i = 0; i < 5; i += 1) line(c, x + i * 7, y + 3, x + i * 7 + 8, y + 28, accent);
  });
  simple(WORLD_TILES.grass, '#7f9258');
  simple(WORLD_TILES.grassAlt, '#899b62');
  simple(WORLD_TILES.darkGrass, '#5e774d');
  simple(WORLD_TILES.dirt, '#9b7652', '#7c5a3d');
  simple(WORLD_TILES.road, '#b89562', '#d6bc80');
  simple(WORLD_TILES.roadLight, '#ccb680', '#a58355');
  simple(WORLD_TILES.water, '#3f93a8', '#59b5c6');
  simple(WORLD_TILES.bank, '#789061', '#b9a36c');
  simple(WORLD_TILES.stone, '#778083', '#aeb8b9');
  simple(WORLD_TILES.cityStone, '#8d8b7c', '#bcb89e');
  simple(WORLD_TILES.field, '#91834f', '#c8ba70');
  simple(WORLD_TILES.ash, '#595c50', '#333733');
  simple(WORLD_TILES.snowGrass, '#9ab0aa', '#e1ebe4');
  simple(WORLD_TILES.flowers, '#82975c');

  drawTile(c, WORLD_TILES.oak - 1, (x, y) => {
    ellipse(c, x + 16, y + 14, 15, 12, '#23361f');
    ellipse(c, x + 13, y + 12, 12, 10, '#3d7134');
    ellipse(c, x + 20, y + 12, 11, 10, '#5b9346');
    ellipse(c, x + 17, y + 8, 9, 7, '#679e4f');
    rect(c, x + 13, y + 20, 6, 10, '#54351f');
  });
  drawTile(c, WORLD_TILES.pine - 1, (x, y) => {
    rect(c, x + 14, y + 19, 5, 11, '#4a3022');
    for (let i = 0; i < 4; i += 1) {
      const yy = y + 5 + i * 6;
      line(c, x + 16, yy - 4, x + 5 + i, yy + 9, '#2f5d47');
      line(c, x + 16, yy - 4, x + 27 - i, yy + 9, '#477657');
    }
  });
  drawTile(c, WORLD_TILES.bush - 1, (x, y) => {
    ellipse(c, x + 16, y + 20, 11, 7, '#4f8446');
    ellipse(c, x + 11, y + 19, 6, 5, '#386538');
    ellipse(c, x + 21, y + 18, 6, 5, '#6a9e53');
  });
  drawTile(c, WORLD_TILES.rock - 1, (x, y) => {
    ellipse(c, x + 16, y + 21, 11, 7, '#646e70');
    ellipse(c, x + 12, y + 18, 6, 4, '#9ca8a9');
  });
  drawTile(c, WORLD_TILES.stump - 1, (x, y) => {
    ellipse(c, x + 16, y + 20, 8, 5, '#7b4d2a');
    rect(c, x + 10, y + 15, 12, 8, '#604026');
    ellipse(c, x + 16, y + 15, 8, 4, '#a06c3d');
  });
  drawTile(c, WORLD_TILES.log - 1, (x, y) => {
    rect(c, x + 4, y + 15, 24, 8, '#6d4729');
    ellipse(c, x + 5, y + 19, 4, 5, '#a87846');
    ellipse(c, x + 27, y + 19, 4, 5, '#3f2818');
  });
  drawTile(c, WORLD_TILES.bridge - 1, (x, y) => {
    rect(c, x, y + 5, TILE, 22, '#5b3b22');
    for (let i = 0; i < 5; i += 1) rect(c, x + i * 7, y + 7, 3, 18, '#9b6a3c');
    rect(c, x, y + 4, TILE, 3, '#2d1e14');
    rect(c, x, y + 25, TILE, 3, '#2d1e14');
  });
  drawTile(c, WORLD_TILES.bridgeLeft - 1, (x, y) => {
    rect(c, x + 5, y + 5, 27, 22, '#5b3b22');
    rect(c, x + 5, y + 4, 27, 3, '#2d1e14');
    rect(c, x + 5, y + 25, 27, 3, '#2d1e14');
  });
  drawTile(c, WORLD_TILES.bridgeRight - 1, (x, y) => {
    rect(c, x, y + 5, 27, 22, '#5b3b22');
    rect(c, x, y + 4, 27, 3, '#2d1e14');
    rect(c, x, y + 25, 27, 3, '#2d1e14');
  });
  drawTile(c, WORLD_TILES.fenceH - 1, (x, y) => {
    rect(c, x, y + 14, TILE, 6, '#715038');
    rect(c, x + 4, y + 10, 5, 15, '#4b3425');
    rect(c, x + 23, y + 10, 5, 15, '#4b3425');
  });
  drawTile(c, WORLD_TILES.fenceV - 1, (x, y) => {
    rect(c, x + 13, y, 6, TILE, '#715038');
    rect(c, x + 9, y + 4, 14, 5, '#4b3425');
    rect(c, x + 9, y + 23, 14, 5, '#4b3425');
  });
  drawTile(c, WORLD_TILES.well - 1, (x, y) => {
    ellipse(c, x + 16, y + 20, 11, 7, '#4b4b4b');
    ellipse(c, x + 16, y + 17, 10, 6, '#a0a8a9');
    ellipse(c, x + 16, y + 17, 6, 3, '#264a5a');
    rect(c, x + 8, y + 8, 16, 4, '#6f4d30');
  });
  drawTile(c, WORLD_TILES.lamp - 1, (x, y) => {
    rect(c, x + 14, y + 8, 4, 19, '#3d2a1d');
    rect(c, x + 10, y + 5, 12, 8, '#f8d15c');
    rect(c, x + 9, y + 4, 14, 2, '#46311f');
  });
  drawTile(c, WORLD_TILES.crate - 1, (x, y) => {
    rect(c, x + 7, y + 10, 18, 17, '#8f6238');
    line(c, x + 8, y + 11, x + 24, y + 26, '#4c3320');
    line(c, x + 24, y + 11, x + 8, y + 26, '#4c3320');
  });
  drawTile(c, WORLD_TILES.barrel - 1, (x, y) => {
    ellipse(c, x + 16, y + 12, 8, 4, '#a46d36');
    rect(c, x + 8, y + 12, 16, 13, '#76512e');
    ellipse(c, x + 16, y + 25, 8, 4, '#4c3320');
  });
  drawTile(c, WORLD_TILES.sign - 1, (x, y) => {
    rect(c, x + 15, y + 11, 3, 17, '#4b3425');
    rect(c, x + 6, y + 7, 20, 9, '#8f6238');
    line(c, x + 9, y + 11, x + 22, y + 11, '#3d2a1d');
  });
  drawTile(c, WORLD_TILES.crop - 1, (x, y) => {
    rect(c, x, y, TILE, TILE, '#8c7d45');
    for (let i = 0; i < 4; i += 1) line(c, x + 4 + i * 7, y + 25, x + 9 + i * 6, y + 8, '#cbb95e');
  });
  drawTile(c, WORLD_TILES.hay - 1, (x, y) => {
    rect(c, x + 6, y + 13, 20, 12, '#c8a44a');
    line(c, x + 8, y + 15, x + 24, y + 22, '#8d6d2e');
  });
  drawTile(c, WORLD_TILES.grave - 1, (x, y) => {
    rect(c, x + 10, y + 10, 12, 16, '#7f8586');
    ellipse(c, x + 16, y + 11, 6, 5, '#a0a8a9');
    line(c, x + 14, y + 17, x + 18, y + 17, '#3d4142');
  });
  drawTile(c, WORLD_TILES.campfire - 1, (x, y) => {
    rect(c, x + 8, y + 21, 18, 4, '#5e3b25');
    ellipse(c, x + 16, y + 17, 5, 9, '#ffbf2f');
    ellipse(c, x + 17, y + 18, 3, 6, '#ff6534');
  });
  drawTile(c, WORLD_TILES.mine - 1, (x, y) => {
    ellipse(c, x + 16, y + 19, 14, 9, '#4f4b45');
    rect(c, x + 7, y + 16, 18, 12, '#211d1a');
    rect(c, x + 5, y + 13, 22, 4, '#6f4b2f');
  });
  return encodePng(c.width, c.height, c.pixels);
}

const PREFABS = {
  cityHall: { x: 0, y: 0, w: 7, h: 6, roof: '#34465a', wall: '#bda27b', trim: '#f0d47c' },
  guild: { x: 8, y: 0, w: 6, h: 5, roof: '#6c2f33', wall: '#b38a63', trim: '#d8c17b' },
  shop: { x: 0, y: 7, w: 6, h: 5, roof: '#3f6b45', wall: '#b98d5c', trim: '#f1d27c' },
  inn: { x: 7, y: 7, w: 6, h: 5, roof: '#4e385f', wall: '#ad8f72', trim: '#d7b769' },
  cottage: { x: 0, y: 13, w: 5, h: 3, roof: '#5b392e', wall: '#9c774f', trim: '#d9bd78' },
  village: { x: 6, y: 13, w: 5, h: 3, roof: '#314f43', wall: '#8f744e', trim: '#d2b16c' },
  tower: { x: 12, y: 12, w: 4, h: 4, roof: '#2c3b4d', wall: '#9d9a86', trim: '#c9c079' },
};

function drawBuildingAtlas() {
  const c = canvas(COLS * TILE, COLS * TILE);
  Object.values(PREFABS).forEach((prefab) => {
    const ox = prefab.x * TILE;
    const oy = prefab.y * TILE;
    const w = prefab.w * TILE;
    const h = prefab.h * TILE;
    rect(c, ox + 4, oy + h - 12, w - 8, 8, [0, 0, 0, 45]);
    rect(c, ox + 8, oy + 22, w - 16, h - 30, '#6a4b35');
    rect(c, ox + 12, oy + 27, w - 24, h - 39, prefab.wall);
    rect(c, ox + 7, oy + 18, w - 14, 12, '#2a1d17');
    for (let x = ox + 8; x < ox + w - 8; x += 18) line(c, x, oy + 18, x + 13, oy + 29, prefab.trim);
    rect(c, ox + 4, oy + 10, w - 8, 17, prefab.roof);
    rect(c, ox + 10, oy + 6, w - 20, 8, prefab.roof);
    line(c, ox + 6, oy + 27, ox + w - 7, oy + 27, '#1b1412');
    rect(c, ox + Math.floor(w / 2) - 8, oy + h - 32, 16, 20, '#3b281c');
    rect(c, ox + Math.floor(w / 2) - 5, oy + h - 29, 10, 17, '#5f3e25');
    for (let wx = ox + 20; wx < ox + w - 20; wx += 42) {
      rect(c, wx, oy + h - 42, 12, 10, '#24394a');
      rect(c, wx + 2, oy + h - 40, 8, 6, '#a7d4e5');
    }
    rect(c, ox + w - 22, oy + 2, 8, 15, '#51341e');
    rect(c, ox + w - 24, oy, 12, 4, '#2e2118');
  });
  return encodePng(c.width, c.height, c.pixels);
}

function drawEnemySheet(kind, main, accent, boss = false) {
  const frame = boss ? 96 : 64;
  const c = canvas(frame * 4, frame);
  for (let f = 0; f < 4; f += 1) {
    const x = f * frame;
    const bob = f % 2 === 0 ? 0 : -3;
    ellipse(c, x + frame / 2, frame - 9, boss ? 31 : 21, 6, [0, 0, 0, 60]);
    if (kind.includes('wolf')) {
      rect(c, x + 16, 31 + bob, 32, 14, main);
      rect(c, x + 43, 23 + bob, 16, 18, main);
      rect(c, x + 51, 18 + bob, 5, 8, accent);
      rect(c, x + 17, 44 + bob, 6, 12, '#171a21');
      rect(c, x + 39, 44 + bob, 6, 12, '#171a21');
      line(c, x + 14, 34 + bob, x + 4, 27 + bob, accent);
    } else if (kind.includes('wraith') || kind.includes('witch')) {
      ellipse(c, x + frame / 2, 31 + bob, boss ? 25 : 15, boss ? 22 : 16, main);
      rect(c, x + frame / 2 - 14, 35 + bob, 28, 22, main);
      ellipse(c, x + frame / 2 - 6, 28 + bob, 3, 4, accent);
      ellipse(c, x + frame / 2 + 6, 28 + bob, 3, 4, accent);
      for (let i = 0; i < 3; i += 1) line(c, x + frame / 2 - 12 + i * 12, 54 + bob, x + frame / 2 - 18 + i * 15, 63, accent);
    } else if (kind.includes('gnoll') || kind.includes('ogre')) {
      ellipse(c, x + frame / 2, 31 + bob, boss ? 25 : 15, boss ? 22 : 14, main);
      rect(c, x + frame / 2 - 13, 37 + bob, 26, boss ? 31 : 20, main);
      rect(c, x + frame / 2 - 20, 34 + bob, 9, 24, accent);
      rect(c, x + frame / 2 + 11, 34 + bob, 9, 24, accent);
      rect(c, x + frame / 2 - 6, 28 + bob, 4, 4, '#101010');
      rect(c, x + frame / 2 + 6, 28 + bob, 4, 4, '#101010');
    } else {
      rect(c, x + frame / 2 - 13, 28 + bob, 26, 29, main);
      ellipse(c, x + frame / 2, 24 + bob, 14, 12, main);
      rect(c, x + frame / 2 - 5, 20 + bob, 4, 4, '#101010');
      rect(c, x + frame / 2 + 6, 20 + bob, 4, 4, '#101010');
      line(c, x + frame / 2 - 14, 40 + bob, x + frame / 2 - 25, 49 + bob, accent);
      line(c, x + frame / 2 + 14, 40 + bob, x + frame / 2 + 25, 49 + bob, accent);
    }
  }
  return encodePng(c.width, c.height, c.pixels);
}

function placePrefab(decor, collision, width, name, x, y) {
  const p = PREFABS[name];
  for (let yy = 0; yy < p.h; yy += 1) {
    for (let xx = 0; xx < p.w; xx += 1) {
      setTile(decor, width, x + xx, y + yy, BUILDINGS_FIRSTGID + (p.y + yy) * COLS + p.x + xx);
      if (yy >= 1) setTile(collision, width, x + xx, y + yy, COLLISION_FIRSTGID);
    }
  }
  clearRect(collision, width, x + Math.floor(p.w / 2) - 1, y + p.h - 1, 3, 1);
}

function paintRoad(ground, width, x0, y0, x1, y1, radius = 3) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / Math.max(steps, 1);
    const x = Math.round(x0 + (x1 - x0) * t + Math.sin(i / 9) * 1.5);
    const y = Math.round(y0 + (y1 - y0) * t + Math.cos(i / 11) * 1.5);
    fillRect(ground, width, x - radius, y - radius, radius * 2 + 1, radius * 2 + 1, WORLD_TILES.road);
    fillRect(ground, width, x - radius + 1, y - radius + 1, radius * 2 - 1, radius * 2 - 1, WORLD_TILES.roadLight);
  }
}

function scatter(layer, width, area, gids, count, avoid = () => false) {
  for (let i = 0; i < count; i += 1) {
    const x = area.x + ((i * 37 + area.y * 5) % area.w);
    const y = area.y + ((i * 53 + area.x * 3) % area.h);
    if (!avoid(x, y)) setTile(layer, width, x, y, gids[i % gids.length]);
  }
}

function makeWorldMap() {
  const ground = makeLayer(WORLD_W, WORLD_H, WORLD_TILES.grass);
  const water = makeLayer(WORLD_W, WORLD_H);
  const decor = makeLayer(WORLD_W, WORLD_H);
  const collision = makeLayer(WORLD_W, WORLD_H);

  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      if ((x * 17 + y * 11) % 19 === 0) setTile(ground, WORLD_W, x, y, WORLD_TILES.grassAlt);
      if (y > 120 && y < 240 && (x + y) % 7 === 0) setTile(ground, WORLD_W, x, y, WORLD_TILES.darkGrass);
      if (y > 360 && y < 505 && (x * 3 + y) % 6 === 0) setTile(ground, WORLD_W, x, y, WORLD_TILES.ash);
      if (y > 500 && (x + y * 2) % 5 === 0) setTile(ground, WORLD_W, x, y, WORLD_TILES.snowGrass);
    }
  }

  for (let y = 0; y < WORLD_H; y += 1) {
    const riverX = Math.round(34 + Math.sin(y / 27) * 9 + Math.sin(y / 83) * 6);
    for (let x = riverX - 8; x <= riverX + 8; x += 1) {
      setTile(water, WORLD_W, x, y, WORLD_TILES.water);
      setTile(collision, WORLD_W, x, y, COLLISION_FIRSTGID);
    }
    setTile(ground, WORLD_W, riverX - 9, y, WORLD_TILES.bank);
    setTile(ground, WORLD_W, riverX + 9, y, WORLD_TILES.bank);
  }

  fillRect(ground, WORLD_W, 92, 18, 118, 70, WORLD_TILES.cityStone);
  paintRoad(ground, WORLD_W, 150, 54, 150, 585, 4);
  paintRoad(ground, WORLD_W, 150, 54, 45, 82, 4);
  paintRoad(ground, WORLD_W, 150, 54, 252, 96, 4);
  paintRoad(ground, WORLD_W, 150, 162, 228, 180, 3);
  paintRoad(ground, WORLD_W, 150, 300, 75, 310, 3);
  paintRoad(ground, WORLD_W, 150, 430, 236, 450, 3);
  paintRoad(ground, WORLD_W, 150, 548, 82, 552, 3);

  for (let x = 31; x < 52; x += 1) {
    setTile(water, WORLD_W, x, 82, 0);
    setTile(collision, WORLD_W, x, 82, 0);
    setTile(decor, WORLD_W, x, 82, x === 31 ? WORLD_TILES.bridgeLeft : x === 51 ? WORLD_TILES.bridgeRight : WORLD_TILES.bridge);
  }

  placePrefab(decor, collision, WORLD_W, 'cityHall', 136, 28);
  placePrefab(decor, collision, WORLD_W, 'guild', 108, 34);
  placePrefab(decor, collision, WORLD_W, 'shop', 168, 36);
  placePrefab(decor, collision, WORLD_W, 'inn', 136, 62);
  placePrefab(decor, collision, WORLD_W, 'cottage', 103, 65);
  placePrefab(decor, collision, WORLD_W, 'cottage', 185, 65);
  placePrefab(decor, collision, WORLD_W, 'tower', 93, 20);
  placePrefab(decor, collision, WORLD_W, 'tower', 204, 20);
  fillRect(decor, WORLD_W, 146, 50, 1, 1, WORLD_TILES.well);
  fillRect(decor, WORLD_W, 129, 52, 1, 1, WORLD_TILES.lamp);
  fillRect(decor, WORLD_W, 170, 55, 1, 1, WORLD_TILES.lamp);

  const villages = [
    { y: 160, x: 216, prefab: 'village', flavor: [WORLD_TILES.crop, WORLD_TILES.hay, WORLD_TILES.fenceH] },
    { y: 294, x: 64, prefab: 'cottage', flavor: [WORLD_TILES.log, WORLD_TILES.stump, WORLD_TILES.oak] },
    { y: 430, x: 228, prefab: 'village', flavor: [WORLD_TILES.rock, WORLD_TILES.mine, WORLD_TILES.crate] },
    { y: 548, x: 74, prefab: 'tower', flavor: [WORLD_TILES.grave, WORLD_TILES.campfire, WORLD_TILES.rock] },
  ];
  villages.forEach((v) => {
    placePrefab(decor, collision, WORLD_W, v.prefab, v.x, v.y);
    placePrefab(decor, collision, WORLD_W, 'cottage', v.x + 9, v.y + 5);
    scatter(decor, WORLD_W, { x: v.x - 8, y: v.y - 6, w: 28, h: 22 }, v.flavor, 34);
  });

  scatter(decor, WORLD_W, { x: 4, y: 4, w: 286, h: 590 }, [WORLD_TILES.oak, WORLD_TILES.pine, WORLD_TILES.bush, WORLD_TILES.rock, WORLD_TILES.flowers], 2100, (x, y) => (
    (x > 80 && x < 220 && y < 105) || Math.abs(x - 150) < 8 || water[idx(WORLD_W, x, y)]
  ));
  scatter(decor, WORLD_W, { x: 170, y: 130, w: 90, h: 85 }, [WORLD_TILES.oak, WORLD_TILES.pine, WORLD_TILES.bush], 360);
  scatter(decor, WORLD_W, { x: 42, y: 250, w: 65, h: 110 }, [WORLD_TILES.oak, WORLD_TILES.pine, WORLD_TILES.log, WORLD_TILES.stump], 350);
  scatter(decor, WORLD_W, { x: 195, y: 390, w: 75, h: 100 }, [WORLD_TILES.rock, WORLD_TILES.mine, WORLD_TILES.stump], 300);

  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      if ([WORLD_TILES.oak, WORLD_TILES.pine, WORLD_TILES.rock, WORLD_TILES.mine].includes(decor[idx(WORLD_W, x, y)])) {
        setTile(collision, WORLD_W, x, y, COLLISION_FIRSTGID);
      }
    }
  }

  const spawns = [
    rectObject('road_bandit_patrols', 110, 125, 82, 80, { type: 'enemySpawn', zoneId: 'greenbelt_fields', enemyType: 'road-bandit', recommendedLevel: 10, maxEnemies: 20, maxAlive: 20, respawnMin: 15000, respawnMax: 30000, movementMode: 'patrol' }),
    rectObject('dire_wolf_hollow', 35, 245, 92, 90, { type: 'enemySpawn', zoneId: 'pinewood_hollow', enemyType: 'dire-wolf', recommendedLevel: 14, maxEnemies: 22, maxAlive: 22, respawnMin: 18000, respawnMax: 32000, movementMode: 'patrol' }),
    rectObject('stone_gnoll_highlands', 182, 365, 84, 105, { type: 'enemySpawn', zoneId: 'stormhill_highlands', enemyType: 'stone-gnoll', recommendedLevel: 17, maxEnemies: 18, maxAlive: 18, respawnMin: 22000, respawnMax: 36000, movementMode: 'patrol' }),
    rectObject('ember_wraith_frontier', 42, 510, 98, 72, { type: 'enemySpawn', zoneId: 'ashen_frontier', enemyType: 'ember-wraith', recommendedLevel: 20, maxEnemies: 16, maxAlive: 16, respawnMin: 24000, respawnMax: 42000, movementMode: 'patrol' }),
  ];
  const bosses = [
    rectObject('varro_the_tollkeeper_01', 204, 170, 18, 18, { type: 'bossSpawn', zoneId: 'greenbelt_fields', bossType: 'varro-the-tollkeeper', recommendedLevel: 13 }),
    rectObject('thornmaw_alpha_01', 75, 316, 18, 18, { type: 'bossSpawn', zoneId: 'pinewood_hollow', bossType: 'thornmaw-alpha', recommendedLevel: 16 }),
    rectObject('granite_ogre_01', 238, 448, 18, 18, { type: 'bossSpawn', zoneId: 'stormhill_highlands', bossType: 'granite-ogre', recommendedLevel: 19 }),
    rectObject('ash_witch_01', 92, 552, 18, 18, { type: 'bossSpawn', zoneId: 'ashen_frontier', bossType: 'ash-witch', recommendedLevel: 20 }),
  ];
  const transitions = [
    pointObject('human_road_arrival', 145, 78, { type: 'arrival', sourceRace: 'human' }),
    pointObject('dwarf_road_arrival', 150, 78, { type: 'arrival', sourceRace: 'dwarf' }),
    pointObject('undead_road_arrival', 155, 78, { type: 'arrival', sourceRace: 'undead' }),
    pointObject('elf_road_arrival', 145, 84, { type: 'arrival', sourceRace: 'elf' }),
    pointObject('orc_road_arrival', 155, 84, { type: 'arrival', sourceRace: 'orc' }),
  ];

  const map = {
    compressionlevel: -1,
    height: WORLD_H,
    infinite: false,
    layers: [
      tileLayer('Ground', WORLD_W, WORLD_H, ground),
      tileLayer('water', WORLD_W, WORLD_H, water),
      tileLayer('Decor', WORLD_W, WORLD_H, decor),
      tileLayer('Collision', WORLD_W, WORLD_H, collision),
      objectLayer('NPCs', [
        pointObject('high_captain_arden', 150, 52, { type: 'npc', role: 'mayor' }),
        pointObject('capital_vendor', 170, 56, { type: 'npc', role: 'shopkeeper' }),
        pointObject('class_trainer', 113, 54, { type: 'npc', role: 'trainer' }),
      ]),
      objectLayer('Spawns', spawns),
      objectLayer('BossSpawns', bosses),
      objectLayer('Transitions', transitions),
      objectLayer('Zones', [
        rectObject('capital_city', 90, 16, 124, 82, { type: 'safeZone', zoneId: 'capital_city', recommendedLevel: 10 }),
        rectObject('greenbelt_fields', 92, 115, 142, 110, { type: 'zone', zoneId: 'greenbelt_fields', recommendedLevel: 10 }),
        rectObject('pinewood_hollow', 28, 235, 118, 125, { type: 'zone', zoneId: 'pinewood_hollow', recommendedLevel: 14 }),
        rectObject('stormhill_highlands', 168, 355, 112, 140, { type: 'zone', zoneId: 'stormhill_highlands', recommendedLevel: 17 }),
        rectObject('ashen_frontier', 34, 500, 130, 88, { type: 'zone', zoneId: 'ashen_frontier', recommendedLevel: 20 }),
      ]),
      objectLayer('graveyard', [
        pointObject('capital_graveyard', 132, 87, { type: 'graveyard', facing: 0 }),
        pointObject('frontier_graveyard', 77, 545, { type: 'graveyard', facing: 0 }),
      ]),
      objectLayer('raceStart', transitions.map((obj) => ({ ...obj, properties: [{ name: 'type', type: 'string', value: 'raceStart' }] }))),
    ],
    nextlayerid: tileLayer.nextId + 1,
    nextobjectid: pointObject.nextId + 1,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.11.2',
    tileheight: TILE,
    tilesets: [
      { firstgid: WORLD_TILESET_FIRSTGID, source: '../tilesets/world_map.tsx' },
      { firstgid: BUILDINGS_FIRSTGID, source: '../tilesets/world_buildings_v1.tsx' },
      { firstgid: COLLISION_FIRSTGID, source: '../tilesets/collision_debug.tsx' },
    ],
    tilewidth: TILE,
    type: 'map',
    version: '1.10',
    width: WORLD_W,
  };
  return map;
}

function makeRaceBuildingAtlas() {
  return drawBuildingAtlas();
}

function addRaceBuildingsToMap(map, race) {
  if (!map.tilesets.some((tileset) => tileset.source === '../tilesets/race_buildings_v1.tsx')) {
    map.tilesets.push({ firstgid: RACE_BUILDINGS_FIRSTGID, source: '../tilesets/race_buildings_v1.tsx' });
  }
  const decor = map.layers.find((layer) => layer.name === 'Decor')?.data;
  const collision = map.layers.find((layer) => layer.name === 'Collision')?.data;
  if (!decor || !collision) return map;
  const width = map.width;
  const villageByRace = {
    dwarf: { x: 42, y: 104, style: ['cityHall', 'tower', 'guild', 'cottage'] },
    undead: { x: 38, y: 36, style: ['guild', 'tower', 'cottage', 'inn'] },
    elf: { x: 32, y: 88, style: ['shop', 'village', 'inn', 'cottage'] },
    orc: { x: 34, y: 108, style: ['guild', 'cottage', 'village', 'tower'] },
  };
  const v = villageByRace[race];
  if (!v) return map;
  clearRect(decor, width, v.x, v.y, 45, 38);
  clearRect(collision, width, v.x, v.y, 45, 38);
  const oldFirst = BUILDINGS_FIRSTGID;
  const placeRacePrefab = (name, x, y) => {
    const p = PREFABS[name];
    for (let yy = 0; yy < p.h; yy += 1) {
      for (let xx = 0; xx < p.w; xx += 1) {
        setTile(decor, width, x + xx, y + yy, RACE_BUILDINGS_FIRSTGID + (p.y + yy) * COLS + p.x + xx);
        if (yy >= 1) setTile(collision, width, x + xx, y + yy, COLLISION_FIRSTGID);
      }
    }
    clearRect(collision, width, x + Math.floor(p.w / 2) - 1, y + p.h - 1, 3, 1);
  };
  placeRacePrefab(v.style[0], v.x + 10, v.y + 4);
  placeRacePrefab(v.style[1], v.x + 3, v.y + 6);
  placeRacePrefab(v.style[2], v.x + 25, v.y + 8);
  placeRacePrefab(v.style[3], v.x + 14, v.y + 22);
  for (let i = 0; i < 30; i += 1) {
    setTile(decor, width, v.x + 2 + (i * 7) % 39, v.y + 2 + (i * 11) % 34, [WORLD_TILES.crate, WORLD_TILES.barrel, WORLD_TILES.sign, WORLD_TILES.lamp][i % 4]);
  }
  return map;
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  await Promise.all([fs.mkdir(assetTilesetsDir, { recursive: true }), fs.mkdir(tilesetsDir, { recursive: true }), fs.mkdir(enemyDir, { recursive: true }), fs.mkdir(docsDir, { recursive: true })]);

  await fs.writeFile(path.join(assetTilesetsDir, 'world_map.png'), drawWorldTileset());
  await fs.writeFile(path.join(tilesetsDir, 'world_map.tsx'), makeTsx('world_map', 'world_map.png'));
  await fs.writeFile(path.join(assetTilesetsDir, 'world_buildings_v1.png'), drawBuildingAtlas());
  await fs.writeFile(path.join(tilesetsDir, 'world_buildings_v1.tsx'), makeTsx('world_buildings_v1', 'world_buildings_v1.png'));
  await fs.writeFile(path.join(assetTilesetsDir, 'race_buildings_v1.png'), makeRaceBuildingAtlas());
  await fs.writeFile(path.join(tilesetsDir, 'race_buildings_v1.tsx'), makeTsx('race_buildings_v1', 'race_buildings_v1.png'));
  await writeJson(path.join(mapsDir, 'world_map.tmj'), makeWorldMap());

  for (const [kind, mainColor, accentColor, boss] of WORLD_ENEMIES) {
    await fs.writeFile(path.join(enemyDir, `${kind}.png`), drawEnemySheet(kind, mainColor, accentColor, Boolean(boss)));
  }

  for (const race of ['dwarf', 'undead', 'elf', 'orc']) {
    const mapPath = path.join(mapsDir, `${race}_starting_zone.tmj`);
    const map = JSON.parse(await fs.readFile(mapPath, 'utf8'));
    await writeJson(mapPath, addRaceBuildingsToMap(map, race));
  }

  await fs.writeFile(path.join(docsDir, 'world_map_notes.md'), `# World Map

- File: \`public/maps/world_map.tmj\`
- Size: 300x600 tiles, 32px tiles.
- Main city arrival points: \`human_road_arrival\`, \`dwarf_road_arrival\`, \`undead_road_arrival\`, \`elf_road_arrival\`, \`orc_road_arrival\`.
- Progression zones:
  - \`greenbelt_fields\` level 10, enemy \`road-bandit\`
  - \`pinewood_hollow\` level 14, enemy \`dire-wolf\`
  - \`stormhill_highlands\` level 17, enemy \`stone-gnoll\`
  - \`ashen_frontier\` level 20, enemy \`ember-wraith\`
- Bosses:
  - \`varro-the-tollkeeper\`
  - \`thornmaw-alpha\`
  - \`granite-ogre\`
  - \`ash-witch\`

The city and villages use prefab building tiles from \`world_buildings_v1.tsx\`. The dwarf, undead, elf, and orc starting maps now use \`race_buildings_v1.tsx\` to replace the small generated house clusters with larger readable prefab buildings.
`);

  console.log('Generated world_map.tmj, world/race building prefabs, and world enemy sprites.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
