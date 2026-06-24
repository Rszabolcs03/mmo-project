import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MAP_DIR = join(ROOT, 'public', 'maps');
const TILESET_DIR = join(ROOT, 'public', 'tilesets');
const ASSET_TILESET_DIR = join(ROOT, 'public', 'assets', 'tilesets');
const ENEMY_DIR = join(ROOT, 'public', 'assets', 'enemies');

const TILE = 32;
const WIDTH = 100;
const HEIGHT = 200;
const DUNGEON_TILESET = 'dungeon_cavern';
const ENTRANCE_TILESET = 'dungeon_entrance';

function hexToRgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function createCanvas(width, height) {
  return new Uint8Array(width * height * 4);
}

function setPixel(buffer, canvasWidth, canvasHeight, x, y, rgba) {
  if (x < 0 || y < 0 || x >= canvasWidth || y >= canvasHeight) return;
  const index = (y * canvasWidth + x) * 4;
  buffer[index] = rgba[0];
  buffer[index + 1] = rgba[1];
  buffer[index + 2] = rgba[2];
  buffer[index + 3] = rgba[3];
}

function rect(buffer, canvasWidth, canvasHeight, x, y, width, height, color, alpha = 255) {
  const rgba = hexToRgba(color, alpha);
  for (let yy = Math.round(y); yy < Math.round(y + height); yy += 1) {
    for (let xx = Math.round(x); xx < Math.round(x + width); xx += 1) {
      setPixel(buffer, canvasWidth, canvasHeight, xx, yy, rgba);
    }
  }
}

function ellipse(buffer, canvasWidth, canvasHeight, cx, cy, rx, ry, color, alpha = 255) {
  const rgba = hexToRgba(color, alpha);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPixel(buffer, canvasWidth, canvasHeight, x, y, rgba);
    }
  }
}

function line(buffer, canvasWidth, canvasHeight, x1, y1, x2, y2, size, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    rect(buffer, canvasWidth, canvasHeight, x1 + (x2 - x1) * t - size / 2, y1 + (y2 - y1) * t - size / 2, size, size, color);
  }
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(rgba, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, rowStart + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function savePng(path, buffer, width, height) {
  writeFileSync(path, encodePng(buffer, width, height));
}

function drawTile(buffer, columns, tileId, base, detail = null, canvasHeight = columns * TILE) {
  const x = (tileId % columns) * TILE;
  const y = Math.floor(tileId / columns) * TILE;
  rect(buffer, columns * TILE, canvasHeight, x, y, TILE, TILE, base);
  if (detail) detail(x, y, columns * TILE, canvasHeight);
}

function makeDungeonTileset() {
  const columns = 16;
  const size = columns * TILE;
  const b = createCanvas(size, size);

  drawTile(b, columns, 0, '#2f332c', (x, y, w, h) => {
    rect(b, w, h, x + 4, y + 5, 5, 3, '#3e443a');
    rect(b, w, h, x + 19, y + 22, 7, 3, '#252821');
  });
  drawTile(b, columns, 1, '#38372f', (x, y, w, h) => {
    rect(b, w, h, x + 2, y + 14, 11, 2, '#4d4a3f');
    rect(b, w, h, x + 18, y + 7, 8, 3, '#25251f');
  });
  drawTile(b, columns, 2, '#171a18', (x, y, w, h) => {
    rect(b, w, h, x, y + 24, 32, 8, '#101210');
    rect(b, w, h, x + 4, y + 5, 8, 6, '#2d312c');
    rect(b, w, h, x + 20, y + 13, 10, 8, '#242823');
  });
  drawTile(b, columns, 3, '#242820', (x, y, w, h) => {
    line(b, w, h, x + 3, y + 25, x + 27, y + 7, 3, '#4b3f34');
    rect(b, w, h, x + 13, y + 13, 5, 5, '#6b5b49');
  });
  drawTile(b, columns, 4, '#632019', (x, y, w, h) => {
    rect(b, w, h, x, y + 8, 32, 16, '#a23318');
    rect(b, w, h, x, y + 15, 32, 5, '#f97316');
    rect(b, w, h, x + 5, y + 4, 6, 24, '#ef4444', 180);
  });
  drawTile(b, columns, 5, '#81230f', (x, y, w, h) => {
    rect(b, w, h, x, y + 11, 32, 11, '#facc15');
    rect(b, w, h, x + 3, y + 15, 14, 5, '#fff7ad');
    rect(b, w, h, x + 20, y + 7, 7, 17, '#f97316');
  });
  drawTile(b, columns, 6, '#5b4633', (x, y, w, h) => {
    rect(b, w, h, x, y + 4, 32, 6, '#8b6b45');
    rect(b, w, h, x, y + 21, 32, 6, '#8b6b45');
    rect(b, w, h, x + 5, y, 5, 32, '#3b2f24');
    rect(b, w, h, x + 22, y, 5, 32, '#3b2f24');
  });
  drawTile(b, columns, 7, '#2f332c', (x, y, w, h) => {
    rect(b, w, h, x + 3, y + 3, 26, 26, '#3f463a');
    rect(b, w, h, x + 8, y + 8, 16, 16, '#59634f');
  });
  drawTile(b, columns, 8, '#2f332c', (x, y, w, h) => {
    line(b, w, h, x + 5, y + 24, x + 25, y + 6, 2, '#7c6f64');
    line(b, w, h, x + 8, y + 6, x + 24, y + 26, 2, '#201f1b');
  });
  drawTile(b, columns, 9, '#2f332c', (x, y, w, h) => {
    rect(b, w, h, x + 6, y + 11, 6, 12, '#60a5fa');
    rect(b, w, h, x + 17, y + 5, 5, 20, '#a78bfa');
    rect(b, w, h, x + 23, y + 15, 4, 10, '#67e8f9');
  });
  drawTile(b, columns, 10, '#2f332c', (x, y, w, h) => {
    rect(b, w, h, x + 8, y + 17, 16, 5, '#e7d3a1');
    rect(b, w, h, x + 13, y + 10, 5, 16, '#d6c190');
  });
  drawTile(b, columns, 11, '#2f332c', (x, y, w, h) => {
    rect(b, w, h, x + 8, y + 17, 6, 7, '#8b5cf6');
    rect(b, w, h, x + 18, y + 13, 7, 11, '#f472b6');
    rect(b, w, h, x + 13, y + 23, 14, 3, '#1f2937');
  });
  drawTile(b, columns, 12, '#1f241e', (x, y, w, h) => {
    rect(b, w, h, x + 6, y + 4, 20, 24, '#3b2f2f');
    rect(b, w, h, x + 10, y + 8, 12, 18, '#0f1115');
    rect(b, w, h, x + 7, y + 3, 18, 5, '#64748b');
  });
  drawTile(b, columns, 13, '#1f241e', (x, y, w, h) => {
    rect(b, w, h, x + 5, y + 2, 22, 28, '#334155');
    rect(b, w, h, x + 9, y + 8, 14, 16, '#111827');
    rect(b, w, h, x + 3, y + 26, 26, 4, '#7f1d1d');
  });
  drawTile(b, columns, 14, '#3b2f3f', (x, y, w, h) => {
    rect(b, w, h, x + 3, y + 3, 26, 26, '#4c1d95');
    rect(b, w, h, x + 12, y + 5, 8, 22, '#a78bfa');
    rect(b, w, h, x + 5, y + 12, 22, 8, '#7c3aed');
  });
  drawTile(b, columns, 15, '#242820', (x, y, w, h) => {
    rect(b, w, h, x + 3, y + 3, 26, 26, '#1e293b');
    line(b, w, h, x + 7, y + 8, x + 25, y + 24, 3, '#a855f7');
  });

  savePng(join(ASSET_TILESET_DIR, `${DUNGEON_TILESET}.png`), b, size, size);
  writeFileSync(join(TILESET_DIR, `${DUNGEON_TILESET}.tsx`), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.12.1" name="${DUNGEON_TILESET}" tilewidth="32" tileheight="32" tilecount="256" columns="16">
 <image source="../assets/tilesets/${DUNGEON_TILESET}.png" width="512" height="512"/>
</tileset>
`);
}

function makeEntranceTileset() {
  const columns = 4;
  const width = columns * TILE;
  const height = 3 * TILE;
  const b = createCanvas(width, height);
  for (let tile = 0; tile < 12; tile += 1) drawTile(b, columns, tile, '#2d3329', null, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const col = Math.floor(x / TILE);
      const row = Math.floor(y / TILE);
      if (row === 0 && col >= 1 && col <= 2) rect(b, width, height, x, y, 1, 1, '#3f3f36');
      if (row === 1 && (col === 0 || col === 3)) rect(b, width, height, x, y, 1, 1, '#343a33');
      if (row === 1 && (col === 1 || col === 2)) rect(b, width, height, x, y, 1, 1, '#0f1413');
      if (row === 2 && col >= 1 && col <= 2) rect(b, width, height, x, y, 1, 1, '#1f2937');
    }
  }
  rect(b, width, height, 42, 21, 44, 48, '#060909');
  rect(b, width, height, 35, 70, 58, 9, '#7c2d12');
  rect(b, width, height, 48, 74, 33, 5, '#f97316');
  rect(b, width, height, 25, 43, 10, 28, '#64748b');
  rect(b, width, height, 94, 43, 10, 28, '#64748b');
  rect(b, width, height, 46, 10, 36, 7, '#94a3b8');
  savePng(join(ASSET_TILESET_DIR, `${ENTRANCE_TILESET}.png`), b, width, height);
  writeFileSync(join(TILESET_DIR, `${ENTRANCE_TILESET}.tsx`), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.12.1" name="${ENTRANCE_TILESET}" tilewidth="32" tileheight="32" tilecount="12" columns="4">
 <image source="../assets/tilesets/${ENTRANCE_TILESET}.png" width="128" height="96"/>
</tileset>
`);
}

function property(name, type, value) {
  return { name, type, value };
}

function pointObject(id, name, x, y, props = [], type = '') {
  return { id, name, type, point: true, x, y, width: 0, height: 0, rotation: 0, properties: props };
}

function rectObject(id, name, x, y, width, height, props = [], type = '') {
  return { id, name, type, x, y, width, height, rotation: 0, properties: props };
}

function makeDungeonMap() {
  const ground = Array(WIDTH * HEIGHT).fill(3);
  const lava = Array(WIDTH * HEIGHT).fill(0);
  const decor = Array(WIDTH * HEIGHT).fill(0);
  const collision = Array(WIDTH * HEIGHT).fill(257);
  const walkable = Array(WIDTH * HEIGHT).fill(false);
  const bridge = Array(WIDTH * HEIGHT).fill(false);
  let seed = 4;

  const idx = (x, y) => y * WIDTH + x;
  const setFloor = (x, y, boss = false) => {
    if (x < 1 || y < 1 || x >= WIDTH - 1 || y >= HEIGHT - 1) return;
    walkable[idx(x, y)] = true;
    ground[idx(x, y)] = boss ? 15 : (((x * 17 + y * 13 + seed) % 11 === 0) ? 2 : 1);
    collision[idx(x, y)] = 0;
  };
  const fillRect = (x, y, w, h, boss = false) => {
    for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) setFloor(xx, yy, boss);
  };
  const corridorH = (x1, x2, y, half = 4) => fillRect(Math.min(x1, x2), y - half, Math.abs(x2 - x1) + 1, half * 2 + 1);
  const corridorV = (x, y1, y2, half = 4) => fillRect(x - half, Math.min(y1, y2), half * 2 + 1, Math.abs(y2 - y1) + 1);
  const markBridge = (x, y, w, h) => {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        if (xx < 1 || yy < 1 || xx >= WIDTH - 1 || yy >= HEIGHT - 1) continue;
        bridge[idx(xx, yy)] = true;
        setFloor(xx, yy);
        ground[idx(xx, yy)] = 7;
      }
    }
  };

  fillRect(46, 9, 20, 16);
  corridorV(56, 23, 43);
  corridorH(36, 84, 42);
  corridorV(84, 42, 64);
  corridorH(18, 84, 64);
  corridorV(18, 64, 89);
  corridorH(18, 76, 89);
  corridorV(76, 89, 118);
  corridorH(30, 76, 118);
  corridorV(30, 118, 160);
  corridorH(30, 88, 166);

  fillRect(78, 34, 18, 22, true);
  fillRect(4, 69, 20, 22, true);
  fillRect(70, 105, 20, 24, true);
  fillRect(15, 155, 35, 31, true);
  fillRect(82, 158, 14, 22);

  const lavaRows = [38, 82, 115];
  lavaRows.forEach((row, index) => {
    for (let y = row; y <= row + 3; y += 1) {
      for (let x = 2; x < WIDTH - 2; x += 1) {
        lava[idx(x, y)] = ((x + y + index) % 5 === 0) ? 6 : 5;
        if (!bridge[idx(x, y)]) {
          collision[idx(x, y)] = 257;
          walkable[idx(x, y)] = false;
        }
      }
    }
  });
  markBridge(52, 36, 10, 8);
  markBridge(14, 80, 11, 8);
  markBridge(72, 113, 10, 8);

  for (let y = 1; y < HEIGHT - 1; y += 1) {
    for (let x = 1; x < WIDTH - 1; x += 1) {
      if (walkable[idx(x, y)]) continue;
      const nearFloor = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [-1, -1], [1, -1], [-1, 1],
      ].some(([dx, dy]) => walkable[idx(x + dx, y + dy)]);
      if (nearFloor && !lava[idx(x, y)]) ground[idx(x, y)] = 4;
    }
  }

  for (let y = 3; y < HEIGHT - 3; y += 1) {
    for (let x = 3; x < WIDTH - 3; x += 1) {
      if (!walkable[idx(x, y)] || bridge[idx(x, y)]) continue;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const roll = seed % 1000;
      if (roll < 8) decor[idx(x, y)] = 9;
      else if (roll < 16) decor[idx(x, y)] = 10;
      else if (roll < 23) decor[idx(x, y)] = 11;
      else if (roll < 31) decor[idx(x, y)] = 8;
    }
  }

  decor[idx(55, 14)] = 13;
  decor[idx(87, 166)] = 14;
  decor[idx(32, 170)] = 16;
  decor[idx(33, 171)] = 16;
  decor[idx(31, 171)] = 16;

  const spawns = [
    rectObject(1, 'trash_pack_01_upper_bridge', 54 * TILE, 29 * TILE, 12 * TILE, 11 * TILE, [property('type', 'string', 'mob_pack'), property('enemyType', 'string', 'cave-stalker'), property('difficulty', 'string', 'elite')]),
    rectObject(2, 'trash_pack_02_left_bend', 8 * TILE, 58 * TILE, 13 * TILE, 12 * TILE, [property('type', 'string', 'mob_pack'), property('enemyType', 'string', 'deep-burrower'), property('difficulty', 'string', 'elite')]),
    rectObject(3, 'trash_pack_03_middle_bridge', 26 * TILE, 78 * TILE, 15 * TILE, 11 * TILE, [property('type', 'string', 'mob_pack'), property('enemyType', 'string', 'magma-crawler'), property('difficulty', 'string', 'elite')]),
    rectObject(4, 'trash_pack_04_middle_patrol', 47 * TILE, 78 * TILE, 16 * TILE, 12 * TILE, [property('type', 'string', 'mob_pack'), property('enemyType', 'string', 'cave-stalker'), property('difficulty', 'string', 'elite')]),
    rectObject(5, 'trash_pack_05_upper_right_guard', 71 * TILE, 48 * TILE, 14 * TILE, 12 * TILE, [property('type', 'string', 'mob_pack'), property('enemyType', 'string', 'obsidian-sentinel'), property('difficulty', 'string', 'elite')]),
    rectObject(6, 'trash_pack_06_lower_left', 8 * TILE, 112 * TILE, 16 * TILE, 14 * TILE, [property('type', 'string', 'mob_pack'), property('enemyType', 'string', 'deep-burrower'), property('difficulty', 'string', 'elite')]),
    rectObject(7, 'trash_pack_07_lower_mid', 38 * TILE, 111 * TILE, 16 * TILE, 14 * TILE, [property('type', 'string', 'mob_pack'), property('enemyType', 'string', 'magma-crawler'), property('difficulty', 'string', 'elite')]),
    rectObject(8, 'trash_pack_08_lower_right_bridge', 67 * TILE, 106 * TILE, 16 * TILE, 15 * TILE, [property('type', 'string', 'mob_pack'), property('enemyType', 'string', 'obsidian-sentinel'), property('difficulty', 'string', 'elite')]),
    rectObject(9, 'miniboss_gloomfang_matriach', 6 * TILE, 71 * TILE, 17 * TILE, 18 * TILE, [property('type', 'string', 'miniboss'), property('bossType', 'string', 'gloomfang-matriarch')]),
    rectObject(10, 'miniboss_lava_forged_warden', 80 * TILE, 36 * TILE, 14 * TILE, 18 * TILE, [property('type', 'string', 'miniboss'), property('bossType', 'string', 'lava-forged-warden')]),
    rectObject(11, 'miniboss_crystal_horror', 72 * TILE, 108 * TILE, 16 * TILE, 18 * TILE, [property('type', 'string', 'miniboss'), property('bossType', 'string', 'crystal-horror')]),
    rectObject(12, 'finalboss_rift_heart', 21 * TILE, 160 * TILE, 24 * TILE, 23 * TILE, [property('type', 'string', 'finalboss'), property('bossType', 'string', 'rift-heart')]),
  ];

  const transitions = [
    pointObject(50, 'dungeon_01_start', 56 * TILE + 16, 15 * TILE + 16, [property('type', 'string', 'spawn'), property('facing', 'float', 1.5708)]),
    rectObject(51, 'dungeon_01_exit', 85 * TILE, 162 * TILE, 8 * TILE, 10 * TILE, [property('type', 'string', 'dungeon_exit'), property('targetMapId', 'string', 'world'), property('targetSpawn', 'string', 'dungeon_01_entrance')]),
  ];

  const zones = [
    rectObject(80, 'emberdeep_caverns', 0, 0, WIDTH * TILE, HEIGHT * TILE, [property('type', 'string', 'dungeon'), property('displayName', 'Emberdeep Caverns'), property('recommendedLevel', 'int', 20)]),
  ];

  const map = {
    compressionlevel: -1,
    height: HEIGHT,
    infinite: false,
    layers: [
      { id: 1, name: 'Ground', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: ground },
      { id: 2, name: 'Lava', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: lava },
      { id: 3, name: 'Decor', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: decor },
      { id: 4, name: 'Collision', type: 'tilelayer', visible: false, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: collision },
      { id: 5, name: 'Spawns', type: 'objectgroup', visible: true, opacity: 1, draworder: 'topdown', x: 0, y: 0, objects: spawns },
      { id: 6, name: 'Transitions', type: 'objectgroup', visible: true, opacity: 1, draworder: 'topdown', x: 0, y: 0, objects: transitions },
      { id: 7, name: 'Zones', type: 'objectgroup', visible: false, opacity: 1, draworder: 'topdown', x: 0, y: 0, objects: zones },
    ],
    nextlayerid: 8,
    nextobjectid: 90,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.12.1',
    tileheight: TILE,
    tilesets: [
      { firstgid: 1, source: `../tilesets/${DUNGEON_TILESET}.tsx` },
      { firstgid: 257, source: '../tilesets/collision_debug.tsx' },
    ],
    tilewidth: TILE,
    type: 'map',
    version: '1.10',
    width: WIDTH,
  };

  writeFileSync(join(MAP_DIR, 'dungeon_01.tmj'), `${JSON.stringify(map, null, 2)}\n`);
}

function drawEnemySprite(id, options = {}) {
  const boss = Boolean(options.boss);
  const frameWidth = boss ? 96 : 64;
  const frameHeight = boss ? 96 : 64;
  const frames = 4;
  const width = frameWidth * frames;
  const height = frameHeight;
  const b = createCanvas(width, height);
  for (let frame = 0; frame < frames; frame += 1) {
    const ox = frame * frameWidth;
    const pulse = frame % 2 === 0 ? 0 : 3;
    ellipse(b, width, height, ox + frameWidth / 2, frameHeight - 13, boss ? 34 : 24, boss ? 9 : 6, '#000000', 85);
    if (boss) {
      ellipse(b, width, height, ox + 48, 48 + pulse, 34, 30, options.outline ?? '#111827');
      ellipse(b, width, height, ox + 48, 48 + pulse, 25, 23, options.body ?? '#7c3aed');
      rect(b, width, height, ox + 28, 23 + pulse, 9, 21, options.accent ?? '#f97316');
      rect(b, width, height, ox + 59, 23 + pulse, 9, 21, options.accent ?? '#f97316');
      rect(b, width, height, ox + 38, 41 + pulse, 7, 7, '#f8fafc');
      rect(b, width, height, ox + 53, 41 + pulse, 7, 7, '#f8fafc');
      line(b, width, height, ox + 25, 67 + pulse, ox + 71, 67 + pulse, 4, '#111827');
      if (id === 'rift-heart') {
        ellipse(b, width, height, ox + 48, 48 + pulse, 13, 13, '#f0abfc');
        line(b, width, height, ox + 18, 48 + pulse, ox + 78, 48 + pulse, 3, '#a78bfa');
        line(b, width, height, ox + 48, 18 + pulse, ox + 48, 78 + pulse, 3, '#a78bfa');
      }
    } else {
      ellipse(b, width, height, ox + 32, 34 + pulse, 22, 19, options.outline ?? '#111827');
      ellipse(b, width, height, ox + 32, 35 + pulse, 16, 14, options.body ?? '#475569');
      rect(b, width, height, ox + 20, 28 + pulse, 5, 5, options.eye ?? '#f8fafc');
      rect(b, width, height, ox + 39, 28 + pulse, 5, 5, options.eye ?? '#f8fafc');
      line(b, width, height, ox + 20, 47 + pulse, ox + 12, 56 - pulse, 5, options.outline ?? '#111827');
      line(b, width, height, ox + 44, 47 + pulse, ox + 52, 56 - pulse, 5, options.outline ?? '#111827');
      if (id === 'magma-crawler') ellipse(b, width, height, ox + 32, 39 + pulse, 8, 5, '#f97316');
      if (id === 'obsidian-sentinel') rect(b, width, height, ox + 26, 18 + pulse, 12, 30, '#1f2937');
      if (id === 'deep-burrower') line(b, width, height, ox + 16, 19 + pulse, ox + 5, 10 + pulse, 4, '#d6c190');
    }
  }
  savePng(join(ENEMY_DIR, `${id}.png`), b, width, height);
}

function makeEnemySprites() {
  drawEnemySprite('cave-stalker', { body: '#475569', outline: '#111827', eye: '#c4b5fd' });
  drawEnemySprite('magma-crawler', { body: '#7f1d1d', outline: '#1c1917', eye: '#facc15' });
  drawEnemySprite('deep-burrower', { body: '#57534e', outline: '#292524', eye: '#e7d3a1' });
  drawEnemySprite('obsidian-sentinel', { body: '#334155', outline: '#020617', eye: '#67e8f9' });
  drawEnemySprite('gloomfang-matriarch', { boss: true, body: '#581c87', outline: '#1e1b4b', accent: '#a3e635' });
  drawEnemySprite('lava-forged-warden', { boss: true, body: '#7f1d1d', outline: '#1c1917', accent: '#f97316' });
  drawEnemySprite('crystal-horror', { boss: true, body: '#164e63', outline: '#0f172a', accent: '#67e8f9' });
  drawEnemySprite('rift-heart', { boss: true, body: '#4c1d95', outline: '#111827', accent: '#f0abfc' });
}

function ensureWorldEntrance() {
  const worldPath = join(MAP_DIR, 'world_map.tmj');
  const map = JSON.parse(readFileSync(worldPath, 'utf8'));
  const worldTileset = map.tilesets.find((tileset) => tileset.source === `../tilesets/${ENTRANCE_TILESET}.tsx`);
  let firstgid = worldTileset?.firstgid;
  if (!firstgid) {
    firstgid = Math.max(...map.tilesets.map((tileset) => Number(tileset.firstgid ?? 1))) + 300;
    map.tilesets.push({ firstgid, source: `../tilesets/${ENTRANCE_TILESET}.tsx` });
  }

  const transitionLayer = map.layers.find((layer) => ['Dungeon_transition', 'Dungeon_transitions', 'DungeonTransitions'].includes(layer.name))
    ?? map.layers.find((layer) => layer.name === 'Transitions');
  if (!transitionLayer) throw new Error('world_map.tmj has no transition object layer.');
  const object = transitionLayer.objects.find((candidate) => candidate.name === 'dungeon_01' || candidate.name === 'dungeon_01_entrance')
    ?? transitionLayer.objects[0];
  if (!object) throw new Error('No dungeon transition object found in world_map.tmj.');

  object.name = 'dungeon_01_entrance';
  object.type = 'transition';
  object.properties = [
    property('type', 'string', 'dungeon_entrance'),
    property('targetMapId', 'string', 'dungeon_01'),
    property('targetSpawn', 'string', 'dungeon_01_start'),
    property('recommendedLevel', 'int', 20),
    property('requiredLevel', 'int', 20),
  ];

  const decorLayer = map.layers.find((layer) => layer.name === 'Decor');
  const collisionLayer = map.layers.find((layer) => layer.name === 'Collision');
  const groundLayer = map.layers.find((layer) => layer.name === 'Ground');
  if (decorLayer?.data && groundLayer?.data) {
    const tileX = Math.max(1, Math.floor((object.x ?? 0) / TILE) - 1);
    const tileY = Math.max(1, Math.floor((object.y ?? 0) / TILE) - 1);
    object.x = tileX * TILE;
    object.y = tileY * TILE;
    object.width = 4 * TILE;
    object.height = 3 * TILE;
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        const index = (tileY + y) * map.width + tileX + x;
        decorLayer.data[index] = firstgid + y * 4 + x;
        groundLayer.data[index] = 3;
      }
    }
    if (collisionLayer?.data) {
      for (let y = -1; y < 4; y += 1) {
        for (let x = -1; x < 5; x += 1) {
          const index = (tileY + y) * map.width + tileX + x;
          if (x >= 1 && x <= 2 && y >= 1 && y <= 2) {
            collisionLayer.data[index] = 0;
          } else if (index >= 0 && index < collisionLayer.data.length) {
            collisionLayer.data[index] = 513;
          }
        }
      }
    }
  }

  writeFileSync(worldPath, `${JSON.stringify(map, null, 2)}\n`);
}

mkdirSync(MAP_DIR, { recursive: true });
mkdirSync(TILESET_DIR, { recursive: true });
mkdirSync(ASSET_TILESET_DIR, { recursive: true });
mkdirSync(ENEMY_DIR, { recursive: true });

makeDungeonTileset();
makeEntranceTileset();
makeDungeonMap();
makeEnemySprites();
ensureWorldEntrance();

console.log('Generated dungeon_01.tmj, dungeon cave tilesets, entrance art, and dungeon enemy sprites.');
