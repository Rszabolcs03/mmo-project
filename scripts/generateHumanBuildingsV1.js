import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ASSET_DIR = join(ROOT, 'public', 'assets', 'tilesets');
const TILESET_DIR = join(ROOT, 'public', 'tilesets');
const MAP_DIR = join(ROOT, 'public', 'maps');
const DOC_DIR = join(ROOT, 'docs');

const TILE = 32;
const COLUMNS = 16;
const ROWS = 16;
const TILECOUNT = COLUMNS * ROWS;
const WIDTH = COLUMNS * TILE;
const HEIGHT = ROWS * TILE;
const BUILDING_FIRST_GID = 257;

mkdirSync(ASSET_DIR, { recursive: true });
mkdirSync(TILESET_DIR, { recursive: true });
mkdirSync(MAP_DIR, { recursive: true });
mkdirSync(DOC_DIR, { recursive: true });

function hex(color, alpha = 255) {
  const clean = color.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function put(buf, width, height, x, y, rgba) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (Math.floor(y) * width + Math.floor(x)) * 4;
  buf[i] = rgba[0];
  buf[i + 1] = rgba[1];
  buf[i + 2] = rgba[2];
  buf[i + 3] = rgba[3];
}

function rect(buf, width, height, x, y, w, h, color, alpha = 255) {
  const rgba = hex(color, alpha);
  for (let yy = Math.round(y); yy < Math.round(y + h); yy += 1) {
    for (let xx = Math.round(x); xx < Math.round(x + w); xx += 1) put(buf, width, height, xx, yy, rgba);
  }
}

function line(buf, width, height, x1, y1, x2, y2, size, color, alpha = 255) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    rect(buf, width, height, x1 + (x2 - x1) * t - size / 2, y1 + (y2 - y1) * t - size / 2, size, size, color, alpha);
  }
}

function ellipse(buf, width, height, cx, cy, rx, ry, color, alpha = 255) {
  const rgba = hex(color, alpha);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) put(buf, width, height, x, y, rgba);
    }
  }
}

function poly(buf, width, height, points, color, alpha = 255) {
  const rgba = hex(color, alpha);
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
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1) + xi) inside = !inside;
      }
      if (inside) put(buf, width, height, x, y, rgba);
    }
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
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, row + 1);
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

function tileStart(tx, ty) {
  return ty * COLUMNS + tx;
}

function drawBuilding(buf, tx, ty, tw, th, style) {
  const x = tx * TILE;
  const y = ty * TILE;
  const w = tw * TILE;
  const h = th * TILE;
  const roofH = Math.max(34, Math.floor(h * 0.42));
  const wallY = y + roofH - 9;
  const wallH = h - roofH + 2;
  const roof = style.roof ?? '#914437';
  const roofDark = style.roofDark ?? '#612a25';
  const roofLight = style.roofLight ?? '#c56d45';
  const wall = style.wall ?? '#b58a58';
  const wallDark = style.wallDark ?? '#705033';
  const trim = style.trim ?? '#e6c978';
  const shadow = '#171915';

  rect(buf, WIDTH, HEIGHT, x + 7, wallY + 11, w - 14, wallH - 3, shadow, 160);
  rect(buf, WIDTH, HEIGHT, x + 9, wallY, w - 18, wallH, '#2b2119');
  rect(buf, WIDTH, HEIGHT, x + 12, wallY + 3, w - 24, wallH - 5, wall);
  for (let sx = x + 15; sx < x + w - 18; sx += 18) rect(buf, WIDTH, HEIGHT, sx, wallY + 5, 3, wallH - 9, wallDark, 140);

  poly(buf, WIDTH, HEIGHT, [
    [x + 3, wallY + 4],
    [x + Math.floor(w * 0.5), y + 4],
    [x + w - 3, wallY + 4],
    [x + w - 12, wallY + 22],
    [x + 12, wallY + 22],
  ], '#1b1512');
  poly(buf, WIDTH, HEIGHT, [
    [x + 7, wallY + 3],
    [x + Math.floor(w * 0.5), y + 8],
    [x + w - 7, wallY + 3],
    [x + w - 15, wallY + 18],
    [x + 15, wallY + 18],
  ], roof);
  for (let sx = x + 16; sx < x + w - 16; sx += 14) line(buf, WIDTH, HEIGHT, sx, wallY + 14, sx + 20, wallY + 3, 2, roofDark, 170);
  line(buf, WIDTH, HEIGHT, x + 13, wallY + 18, x + w - 13, wallY + 18, 3, roofLight);
  line(buf, WIDTH, HEIGHT, x + 11, wallY + 21, x + w - 11, wallY + 21, 2, roofDark);

  if (style.chimney) {
    rect(buf, WIDTH, HEIGHT, x + w - 34, y + 16, 13, 24, '#33231a');
    rect(buf, WIDTH, HEIGHT, x + w - 31, y + 12, 8, 24, '#7b4b35');
    rect(buf, WIDTH, HEIGHT, x + w - 33, y + 10, 12, 5, '#553425');
  }

  const doorX = x + Math.floor(w / 2) - 10;
  const doorY = y + h - 34;
  rect(buf, WIDTH, HEIGHT, doorX - 2, doorY - 2, 24, 31, '#2a1c16');
  rect(buf, WIDTH, HEIGHT, doorX + 1, doorY + 1, 18, 29, '#704226');
  rect(buf, WIDTH, HEIGHT, doorX + 15, doorY + 15, 3, 3, trim);
  rect(buf, WIDTH, HEIGHT, doorX - 7, doorY + 29, 34, 4, '#514332');

  const windowY = y + h - 44;
  for (const wx of [x + 19, x + w - 39]) {
    if (wx > x + 12 && wx < x + w - 25 && Math.abs(wx - doorX) > 24) {
      rect(buf, WIDTH, HEIGHT, wx - 2, windowY - 2, 20, 18, '#2a1e16');
      rect(buf, WIDTH, HEIGHT, wx, windowY, 16, 14, '#5b88a5');
      rect(buf, WIDTH, HEIGHT, wx + 7, windowY, 2, 14, '#e9e4bc');
      rect(buf, WIDTH, HEIGHT, wx, windowY + 6, 16, 2, '#e9e4bc');
    }
  }

  if (style.porch) {
    rect(buf, WIDTH, HEIGHT, doorX - 19, doorY + 30, 58, 10, '#55351f');
    rect(buf, WIDTH, HEIGHT, doorX - 16, doorY + 31, 52, 6, '#9d6b3e');
  }
  if (style.sign) {
    rect(buf, WIDTH, HEIGHT, doorX + 28, doorY + 4, 22, 16, '#31221a');
    rect(buf, WIDTH, HEIGHT, doorX + 30, doorY + 6, 18, 12, '#d5b45a');
    rect(buf, WIDTH, HEIGHT, doorX + 38, doorY + 8, 3, 8, '#4f3624');
  }
}

function drawChapel(buf, tx, ty) {
  drawBuilding(buf, tx, ty, 5, 5, {
    roof: '#8c4036',
    roofDark: '#5d2a24',
    roofLight: '#c7724d',
    wall: '#c3a574',
    wallDark: '#77603f',
    trim: '#f2d778',
    chimney: true,
    porch: true,
  });
  const x = tx * TILE;
  const y = ty * TILE;
  rect(buf, WIDTH, HEIGHT, x + 67, y + 42, 26, 58, '#2a2118');
  rect(buf, WIDTH, HEIGHT, x + 70, y + 45, 20, 54, '#d6c18f');
  poly(buf, WIDTH, HEIGHT, [[x + 65, y + 45], [x + 80, y + 20], [x + 95, y + 45]], '#6f342e');
  rect(buf, WIDTH, HEIGHT, x + 76, y + 35, 8, 21, '#f2d778');
  rect(buf, WIDTH, HEIGHT, x + 70, y + 42, 20, 5, '#f2d778');
}

function drawMine(buf, tx, ty) {
  const x = tx * TILE;
  const y = ty * TILE;
  rect(buf, WIDTH, HEIGHT, x + 4, y + 34, 152, 58, '#1d1917');
  poly(buf, WIDTH, HEIGHT, [[x + 8, y + 61], [x + 30, y + 18], [x + 130, y + 18], [x + 154, y + 61], [x + 146, y + 91], [x + 16, y + 91]], '#66584c');
  poly(buf, WIDTH, HEIGHT, [[x + 21, y + 67], [x + 42, y + 35], [x + 118, y + 35], [x + 139, y + 67], [x + 132, y + 90], [x + 28, y + 90]], '#2e2925');
  rect(buf, WIDTH, HEIGHT, x + 22, y + 67, 116, 21, '#191615');
  for (let sx = x + 20; sx <= x + 134; sx += 28) {
    line(buf, WIDTH, HEIGHT, sx, y + 70, sx + 15, y + 35, 7, '#6f4b2e');
    line(buf, WIDTH, HEIGHT, sx + 15, y + 35, sx + 31, y + 70, 7, '#6f4b2e');
  }
  rect(buf, WIDTH, HEIGHT, x + 15, y + 83, 130, 9, '#8e6138');
  ellipse(buf, WIDTH, HEIGHT, x + 80, y + 28, 20, 8, '#928071');
}

function drawShed(buf, tx, ty) {
  drawBuilding(buf, tx, ty, 3, 2, {
    roof: '#6f3a2b',
    roofDark: '#48241d',
    roofLight: '#aa6142',
    wall: '#a87b4e',
    wallDark: '#60452d',
    trim: '#d1a25b',
    porch: false,
  });
}

function drawExtras(buf) {
  const tile = (id, cb) => {
    const x = (id % COLUMNS) * TILE;
    const y = Math.floor(id / COLUMNS) * TILE;
    cb(x, y);
  };
  tile(tileStart(0, 11), (x, y) => {
    poly(buf, WIDTH, HEIGHT, [[x + 1, y + 20], [x + 16, y + 5], [x + 31, y + 20], [x + 28, y + 27], [x + 4, y + 27]], '#8f4235');
    line(buf, WIDTH, HEIGHT, x + 6, y + 23, x + 26, y + 23, 3, '#ca744d');
  });
  tile(tileStart(1, 11), (x, y) => {
    rect(buf, WIDTH, HEIGHT, x + 10, y + 5, 12, 23, '#2a1c16');
    rect(buf, WIDTH, HEIGHT, x + 12, y + 7, 8, 21, '#75462a');
    rect(buf, WIDTH, HEIGHT, x + 18, y + 17, 3, 3, '#e5c76b');
  });
  tile(tileStart(2, 11), (x, y) => {
    rect(buf, WIDTH, HEIGHT, x + 7, y + 9, 18, 15, '#2a1e16');
    rect(buf, WIDTH, HEIGHT, x + 9, y + 11, 14, 11, '#5b88a5');
    rect(buf, WIDTH, HEIGHT, x + 15, y + 10, 2, 14, '#e9e4bc');
    rect(buf, WIDTH, HEIGHT, x + 9, y + 16, 14, 2, '#e9e4bc');
  });
  tile(tileStart(3, 11), (x, y) => {
    rect(buf, WIDTH, HEIGHT, x + 12, y + 6, 9, 22, '#7b4b35');
    rect(buf, WIDTH, HEIGHT, x + 10, y + 4, 13, 5, '#553425');
  });
  tile(tileStart(4, 11), (x, y) => {
    rect(buf, WIDTH, HEIGHT, x + 5, y + 18, 22, 8, '#55351f');
    rect(buf, WIDTH, HEIGHT, x + 7, y + 19, 18, 5, '#9d6b3e');
  });
  tile(tileStart(5, 11), (x, y) => {
    rect(buf, WIDTH, HEIGHT, x + 6, y + 12, 20, 15, '#31221a');
    rect(buf, WIDTH, HEIGHT, x + 8, y + 14, 16, 11, '#d5b45a');
    rect(buf, WIDTH, HEIGHT, x + 14, y + 17, 4, 5, '#4f3624');
  });
}

function generateBuildingPng() {
  const buf = new Uint8Array(WIDTH * HEIGHT * 4);
  drawBuilding(buf, 0, 0, 3, 3, { roof: '#8f4235', roofDark: '#5b2a23', roofLight: '#c96f4a', wall: '#b99262', wallDark: '#705033', trim: '#e3c36d', chimney: true, porch: true });
  drawBuilding(buf, 4, 0, 4, 4, { roof: '#914437', roofDark: '#612a25', roofLight: '#d17a50', wall: '#b98b5e', wallDark: '#75543a', trim: '#e6c978', chimney: true, porch: true });
  drawBuilding(buf, 9, 0, 5, 4, { roof: '#7e3a2f', roofDark: '#4b241f', roofLight: '#bd6a45', wall: '#c0945f', wallDark: '#785638', trim: '#f0cf76', chimney: true, porch: true, sign: true });
  drawChapel(buf, 0, 5);
  drawShed(buf, 6, 5);
  drawMine(buf, 10, 5);
  drawExtras(buf);
  writeFileSync(join(ASSET_DIR, 'human_buildings_v1.png'), encodePng(buf, WIDTH, HEIGHT));
}

function writeTileset() {
  writeFileSync(join(TILESET_DIR, 'human_buildings_v1.tsx'), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="human_buildings_v1" tilewidth="32" tileheight="32" tilecount="${TILECOUNT}" columns="${COLUMNS}">
 <image source="../assets/tilesets/human_buildings_v1.png" width="${WIDTH}" height="${HEIGHT}"/>
</tileset>
`);
}

function gid(localId) {
  return BUILDING_FIRST_GID + localId;
}

function mapIndex(map, x, y) {
  return y * map.width + x;
}

function getLayer(map, name) {
  const layer = map.layers.find((entry) => entry.name === name);
  if (!layer) throw new Error(`Missing layer ${name}`);
  return layer;
}

function fillLayer(map, layerName, x, y, w, h, value) {
  const layer = getLayer(map, layerName);
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx >= 0 && yy >= 0 && xx < map.width && yy < map.height) layer.data[mapIndex(map, xx, yy)] = value;
    }
  }
}

function placePrefab(map, x, y, tx, ty, w, h, options = {}) {
  const decor = getLayer(map, 'Decor');
  const collision = getLayer(map, 'Collision');
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      const mx = x + xx;
      const my = y + yy;
      if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) continue;
      decor.data[mapIndex(map, mx, my)] = gid(tileStart(tx + xx, ty + yy));
      collision.data[mapIndex(map, mx, my)] = gid(tileStart(tx + xx, ty + yy));
    }
  }
  const doors = options.doors ?? [[Math.floor(w / 2), h - 1]];
  for (const [dx, dy] of doors) {
    const mx = x + dx;
    const my = y + dy;
    collision.data[mapIndex(map, mx, my)] = 0;
    if (my + 1 < map.height) collision.data[mapIndex(map, mx, my + 1)] = 0;
  }
}

function addVillageProps(map) {
  const decor = getLayer(map, 'Decor');
  const collision = getLayer(map, 'Collision');
  const set = (x, y, localId, solid = false) => {
    decor.data[mapIndex(map, x, y)] = gid(localId);
    if (solid) collision.data[mapIndex(map, x, y)] = gid(localId);
  };
  set(99, 110, tileStart(4, 11), true);
  set(106, 100, tileStart(5, 11), true);
  set(88, 101, tileStart(5, 11), true);
  set(96, 126, tileStart(4, 11), true);
  set(111, 118, tileStart(5, 11), true);
}

function updateNpcPositions(map) {
  const npcs = getLayer(map, 'NPCs');
  const positions = {
    mayor_elder: [99, 101],
    shopkeeper: [111, 101],
    trainer: [80, 111],
    quest_giver_wolves: [87, 96],
    quest_giver_mine: [104, 113],
  };
  for (const object of npcs.objects) {
    if (!positions[object.name]) continue;
    const [tx, ty] = positions[object.name];
    object.x = tx * TILE + 16;
    object.y = ty * TILE + 16;
  }
}

function writeMapV3() {
  const map = JSON.parse(readFileSync(join(MAP_DIR, 'human_starting_zone_v2.tmj'), 'utf8'));
  if (!map.tilesets.some((tileset) => tileset.source === '../tilesets/human_buildings_v1.tsx')) {
    map.tilesets.push({ firstgid: BUILDING_FIRST_GID, source: '../tilesets/human_buildings_v1.tsx' });
  }

  const oldFootprints = [
    [88, 91, 6, 5],
    [102, 94, 7, 6],
    [78, 104, 6, 5],
    [112, 111, 6, 5],
    [91, 122, 7, 5],
    [96, 28, 6, 5],
  ];
  for (const area of oldFootprints) {
    fillLayer(map, 'Decor', ...area, 0);
    fillLayer(map, 'Collision', ...area, 0);
  }

  placePrefab(map, 89, 91, 0, 0, 3, 3); // mayor cottage
  placePrefab(map, 103, 94, 9, 0, 5, 4); // shop/vendor
  placePrefab(map, 78, 105, 4, 0, 4, 4); // trainer lodge
  placePrefab(map, 113, 111, 0, 0, 3, 3); // village house
  placePrefab(map, 91, 121, 4, 0, 4, 4); // elder/family house
  placePrefab(map, 48, 146, 0, 5, 5, 5); // graveyard chapel
  placePrefab(map, 74, 118, 6, 5, 3, 2); // farm shed
  placePrefab(map, 96, 28, 10, 5, 5, 3, { doors: [[2, 2]] }); // mine entrance
  addVillageProps(map);
  updateNpcPositions(map);

  map.layers.unshift(map.layers.splice(map.layers.findIndex((layer) => layer.name === 'Decor'), 1)[0]);
  const preferredOrder = ['Ground', 'water', 'Decor', 'Collision', 'NPCs', 'Spawns', 'BossSpawns', 'Transitions', 'Zones', 'graveyard', 'raceStart'];
  map.layers.sort((a, b) => preferredOrder.indexOf(a.name) - preferredOrder.indexOf(b.name));
  map.nextlayerid = Math.max(...map.layers.map((layer) => layer.id)) + 1;
  writeFileSync(join(MAP_DIR, 'human_starting_zone_v3.tmj'), `${JSON.stringify(map, null, 2)}\n`);
}

function writeDocs() {
  writeFileSync(join(DOC_DIR, 'human_buildings_v1_notes.md'), `# Human Buildings V1

Generated by \`scripts/generateHumanBuildingsV1.js\`.

## Files

- \`public/assets/tilesets/human_buildings_v1.png\`
- \`public/tilesets/human_buildings_v1.tsx\`
- \`public/maps/human_starting_zone_v3.tmj\`

## Building Prefabs

- Small house: 3x3 tiles, source area \`x=0,y=0,w=3,h=3\`.
- Medium house: 4x4 tiles, source area \`x=4,y=0,w=4,h=4\`.
- Vendor/shop building: 5x4 tiles, source area \`x=9,y=0,w=5,h=4\`.
- Chapel / village hall: 5x5 tiles, source area \`x=0,y=5,w=5,h=5\`.
- Shed / farm storage: 3x2 tiles, source area \`x=6,y=5,w=3,h=2\`.
- Mine entrance front: 5x3 tiles, source area \`x=10,y=5,w=5,h=3\`.
- Extra pieces: roof cap, door, window, chimney, porch, and hanging sign on row 11.

## Usage In V3 Map

- Mayor / elder cottage: village north-west.
- Vendor/shop: village north-east.
- Trainer lodge: village west side.
- Village homes: south and east side of the starting square.
- Chapel: graveyard zone.
- Farm shed: small fenced farm near the starting village.
- Mine entrance: old mine transition area.

## Matching Props

The buildings are designed to be used with \`human_starting_props_v2\`: fences, well, barrels, crates, sacks, flower patches, lamps, crop tiles, and signposts.

## Collision Notes

Each prefab is placed as a solid footprint on the \`Collision\` layer, then the main door tile and the tile below the door are cleared so entrances remain readable and walkable.
`);
}

generateBuildingPng();
writeTileset();
writeMapV3();
writeDocs();
console.log('Generated human_buildings_v1 and human_starting_zone_v3.');
