import fs from 'node:fs/promises';
import zlib from 'node:zlib';

const MAP_PATH = 'public/maps/world_region_0_0_v3.tmj';
const CHUNKS_DIR = 'public/maps/world_v3_chunks';
const TILE = 32;
const COLLISION_GID = 5393;
const WORLD_V6_CITY_FIRSTGID = 5394;

const assetsDir = 'public/assets/tilesets';
const tilesetsDir = 'public/tilesets';

const assetSpecs = [
  { key: 'townHallExterior', tsx: 'tamzia_town_hall_exterior.tsx', png: 'tamzia_town_hall_exterior.png', name: 'tamzia_town_hall_exterior', w: 60, h: 23, kind: 'townHallExterior' },
  { key: 'townHallInterior', tsx: 'tamzia_town_hall_interior.tsx', png: 'tamzia_town_hall_interior.png', name: 'tamzia_town_hall_interior', w: 60, h: 23, kind: 'townHallInterior' },
  { key: 'bankExterior', tsx: 'tamzia_city_bank_exterior.tsx', png: 'tamzia_city_bank_exterior.png', name: 'tamzia_city_bank_exterior', w: 30, h: 14, kind: 'bankExterior' },
  { key: 'bankInterior', tsx: 'tamzia_city_bank_interior.tsx', png: 'tamzia_city_bank_interior.png', name: 'tamzia_city_bank_interior', w: 30, h: 14, kind: 'bankInterior' },
];

const CITY = {
  cobble: WORLD_V6_CITY_FIRSTGID + 0,
  cobbleAlt: WORLD_V6_CITY_FIRSTGID + 1,
  cobbleDark: WORLD_V6_CITY_FIRSTGID + 2,
  fountainBasin: WORLD_V6_CITY_FIRSTGID + 32,
  fountainWater: WORLD_V6_CITY_FIRSTGID + 33,
  fountainFoam: WORLD_V6_CITY_FIRSTGID + 35,
  fountainStatue: WORLD_V6_CITY_FIRSTGID + 36,
  fountainEdge: WORLD_V6_CITY_FIRSTGID + 37,
  cityLamp: WORLD_V6_CITY_FIRSTGID + 80,
  bench: WORLD_V6_CITY_FIRSTGID + 81,
  planter: WORLD_V6_CITY_FIRSTGID + 82,
  signGeneral: WORLD_V6_CITY_FIRSTGID + 72,
  bannerBlue: WORLD_V6_CITY_FIRSTGID + 87,
};

const TILE_LAYER_NAMES = [
  'Ground', 'Water', 'TerrainDetails', 'Roads', 'CityBase', 'CityInteriors',
  'Decor', 'Buildings', 'CityRoofs', 'Collision',
];

const OBJECT_LAYER_NAMES = [
  'Zones', 'Spawns', 'BossSpawns', 'NPCs', 'QuestGiver', 'raceStart',
  'Graveyards', 'InteriorZones', 'RegionMarkers', 'RoadMarkers', 'Landmarks', 'Transitions',
];

const placements = {
  townHall: { name: 'tamzia_town_hall', x: 460, y: 370, w: 60, h: 23, doorX: 484, doorW: 10, entranceName: 'town_hall_entrance', interiorId: 'tamzia_town_hall_interior' },
  bank: { name: 'tamzia_city_bank', x: 410, y: 386, w: 30, h: 14, doorX: 420, doorW: 11, entranceName: 'tamzia_city_bank_entrance', interiorId: 'tamzia_city_bank_interior' },
};

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
  for (let yy = Math.max(0, y); yy < Math.min(img.height, y + h); yy += 1) {
    for (let xx = Math.max(0, x); xx < Math.min(img.width, x + w); xx += 1) put(img, xx, yy, color);
  }
}

function line(img, x0, y0, x1, y1, color) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  while (true) {
    put(img, x, y, color);
    if (x === x1 && y === y1) break;
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

function checkerFloor(img, colorA, colorB, grid = 32) {
  for (let y = 0; y < img.height; y += grid) {
    for (let x = 0; x < img.width; x += grid) fill(img, x, y, grid, grid, ((x / grid + y / grid) % 2) ? colorA : colorB);
  }
}

function drawWindow(img, x, y, w = 22, h = 26, glow = '#f8e8a8') {
  fill(img, x, y, w, h, rgba('#2e3540'));
  fill(img, x + 3, y + 3, w - 6, h - 6, rgba(glow));
  line(img, x + Math.floor(w / 2), y + 3, x + Math.floor(w / 2), y + h - 4, rgba('#5b4630'));
  line(img, x + 3, y + Math.floor(h / 2), x + w - 4, y + Math.floor(h / 2), rgba('#5b4630'));
}

function drawDoor(img, x, y, w, h) {
  fill(img, x, y, w, h, rgba('#322119'));
  fill(img, x + 5, y + 6, w - 10, h - 6, rgba('#70472f'));
  line(img, x + Math.floor(w / 2), y + 8, x + Math.floor(w / 2), y + h - 2, rgba('#3a2419'));
  circle(img, x + w - 12, y + Math.floor(h * 0.58), 3, rgba('#f2c66b'));
}

function drawTownHallExterior(img) {
  const W = img.width;
  const H = img.height;
  fill(img, 0, H - 26, W, 18, rgba('#000000', 38));
  fill(img, 84, 236, W - 168, 390, rgba('#9f9a8c'));
  fill(img, 112, 256, W - 224, 18, rgba('#c9c1ad'));
  fill(img, 92, 606, W - 184, 22, rgba('#5b554e'));
  polygon(img, [[50, 260], [W / 2, 74], [W - 50, 260], [W - 84, 332], [84, 332]], rgba('#596b7e'));
  polygon(img, [[W / 2, 74], [W - 50, 260], [W / 2, 304], [50, 260]], rgba('#6f8498'));
  for (let y = 156; y < 326; y += 18) line(img, 82, y, W - 82, y + 10, rgba('#93a6b8'));
  fill(img, W / 2 - 74, 90, 148, 160, rgba('#7d858c'));
  polygon(img, [[W / 2 - 92, 94], [W / 2, 20], [W / 2 + 92, 94], [W / 2 + 74, 126], [W / 2 - 74, 126]], rgba('#465a70'));
  fill(img, W / 2 - 24, 26, 48, 72, rgba('#334455'));
  fill(img, W / 2 - 5, 8, 10, 24, rgba('#d6bd65'));
  for (let x = 132; x < W - 132; x += 132) {
    fill(img, x - 9, 290, 18, 306, rgba('#d2c7b1'));
    fill(img, x - 13, 280, 26, 18, rgba('#74695c'));
  }
  for (let x = 170; x < W - 180; x += 170) {
    drawWindow(img, x, 342, 28, 30);
    drawWindow(img, x, 438, 28, 30);
  }
  for (let x = 260; x < W - 260; x += 170) {
    drawWindow(img, x, 380, 28, 30);
    drawWindow(img, x, 500, 28, 30);
  }
  drawDoor(img, W / 2 - 108, H - 134, 216, 116);
  fill(img, W / 2 - 150, H - 40, 300, 26, rgba('#d6bd65'));
  fill(img, W / 2 - 120, H - 184, 240, 26, rgba('#254d7a'));
  fill(img, W / 2 - 110, H - 176, 220, 10, rgba('#d6bd65'));
  for (let x = 0; x < W; x += 32) line(img, x, H - 1, x + 32, H - 10, rgba('#111111', 90));
}

function drawTownHallInterior(img) {
  const W = img.width;
  const H = img.height;
  checkerFloor(img, rgba('#8e8677'), rgba('#9a927f'));
  fill(img, 0, 0, W, 40, rgba('#6f6a60'));
  fill(img, 0, 0, 42, H, rgba('#6f6a60'));
  fill(img, W - 42, 0, 42, H, rgba('#6f6a60'));
  fill(img, 0, H - 42, W, 42, rgba('#6f6a60'));
  fill(img, W / 2 - 340, 104, 680, 54, rgba('#254d7a'));
  fill(img, W / 2 - 334, 112, 668, 16, rgba('#d6bd65'));
  fill(img, W / 2 - 260, 176, 520, 36, rgba('#725238'));
  fill(img, W / 2 - 250, 180, 500, 10, rgba('#c49a62'));
  for (let x = W / 2 - 220; x <= W / 2 + 220; x += 110) {
    fill(img, x - 30, 236, 60, 72, rgba('#7a5739'));
    fill(img, x - 24, 242, 48, 12, rgba('#c79a5d'));
    fill(img, x - 18, 260, 36, 34, rgba('#3f3024'));
  }
  for (let x = 82; x < 360; x += 58) {
    fill(img, x, 78, 40, 150, rgba('#5d4430'));
    fill(img, x + 4, 86, 32, 12, rgba('#c7a35f'));
    fill(img, x + 4, 120, 32, 8, rgba('#d8c796'));
    fill(img, x + 4, 158, 32, 10, rgba('#9fb6c8'));
  }
  for (let x = W - 330; x < W - 80; x += 58) {
    fill(img, x, 78, 40, 150, rgba('#5d4430'));
    fill(img, x + 4, 92, 32, 9, rgba('#d8c796'));
    fill(img, x + 4, 136, 32, 12, rgba('#c7a35f'));
    fill(img, x + 4, 180, 32, 8, rgba('#9fb6c8'));
  }
  fill(img, W / 2 - 160, 360, 320, 76, rgba('#6f4d34'));
  fill(img, W / 2 - 148, 368, 296, 18, rgba('#c49a62'));
  fill(img, W / 2 - 70, 450, 140, 88, rgba('#254d7a'));
  fill(img, W / 2 - 58, 462, 116, 18, rgba('#d6bd65'));
  for (let x = 170; x < W - 170; x += 170) fill(img, x, H - 170, 82, 48, rgba('#6b4b32'));
  drawDoor(img, W / 2 - 96, H - 58, 192, 48);
}

function drawBankExterior(img) {
  const W = img.width;
  const H = img.height;
  fill(img, 0, H - 24, W, 16, rgba('#000000', 44));
  fill(img, 62, 150, W - 124, 218, rgba('#928d82'));
  fill(img, 74, 342, W - 148, 28, rgba('#5a554d'));
  polygon(img, [[34, 150], [W / 2, 48], [W - 34, 150], [W - 68, 220], [68, 220]], rgba('#64748b'));
  polygon(img, [[W / 2, 48], [W - 34, 150], [W / 2, 196], [34, 150]], rgba('#78879a'));
  fill(img, W / 2 - 80, 78, 160, 64, rgba('#7e8079'));
  fill(img, W / 2 - 8, 46, 16, 50, rgba('#d6bd65'));
  for (let x = 124; x < W - 100; x += 92) {
    fill(img, x - 8, 168, 16, 172, rgba('#c9c1ad'));
    fill(img, x - 14, 160, 28, 14, rgba('#5d5750'));
  }
  drawWindow(img, 138, 230, 28, 28, '#d6f4ff');
  drawWindow(img, W - 166, 230, 28, 28, '#d6f4ff');
  fill(img, W / 2 - 118, 226, 236, 28, rgba('#d6bd65'));
  drawDoor(img, W / 2 - 86, H - 104, 172, 88);
  fill(img, W / 2 - 120, H - 36, 240, 20, rgba('#d6bd65'));
  fill(img, W - 210, 184, 72, 54, rgba('#5b6470'));
  fill(img, W - 194, 198, 40, 28, rgba('#d6bd65'));
}

function drawBankInterior(img) {
  const W = img.width;
  const H = img.height;
  checkerFloor(img, rgba('#827d72'), rgba('#90887a'));
  fill(img, 0, 0, W, 34, rgba('#66635c'));
  fill(img, 0, 0, 34, H, rgba('#66635c'));
  fill(img, W - 34, 0, 34, H, rgba('#66635c'));
  fill(img, 0, H - 34, W, 34, rgba('#66635c'));
  fill(img, 100, 146, W - 200, 42, rgba('#725238'));
  fill(img, 112, 152, W - 224, 12, rgba('#c49a62'));
  for (let x = 158; x < W - 140; x += 116) {
    fill(img, x, 198, 78, 46, rgba('#6f4d34'));
    fill(img, x + 6, 204, 66, 10, rgba('#c49a62'));
    fill(img, x + 24, 220, 28, 16, rgba('#d6bd65'));
  }
  fill(img, W - 230, 58, 148, 98, rgba('#555c66'));
  fill(img, W - 204, 82, 96, 54, rgba('#2b3138'));
  fill(img, W - 188, 96, 64, 26, rgba('#d6bd65'));
  for (let x = 72; x < 234; x += 50) {
    fill(img, x, 64, 34, 104, rgba('#5d4430'));
    fill(img, x + 4, 74, 26, 10, rgba('#d6bd65'));
    fill(img, x + 4, 108, 26, 8, rgba('#b8c2cc'));
  }
  fill(img, W / 2 - 70, 284, 140, 48, rgba('#6f4d34'));
  fill(img, W / 2 - 58, 292, 116, 12, rgba('#c49a62'));
  drawDoor(img, W / 2 - 88, H - 48, 176, 40);
}

function drawAsset(spec) {
  const img = makeImage(spec.w * TILE, spec.h * TILE);
  if (spec.kind === 'townHallExterior') drawTownHallExterior(img);
  if (spec.kind === 'townHallInterior') drawTownHallInterior(img);
  if (spec.kind === 'bankExterior') drawBankExterior(img);
  if (spec.kind === 'bankInterior') drawBankInterior(img);
  return img;
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function pngEncode(img) {
  const raw = Buffer.alloc((img.width * 4 + 1) * img.height);
  for (let y = 0; y < img.height; y += 1) {
    raw[y * (img.width * 4 + 1)] = 0;
    Buffer.from(img.data.buffer, y * img.width * 4, img.width * 4).copy(raw, y * (img.width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
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

function setTile(data, width, x, y, value) {
  if (!data || x < 0 || y < 0 || x >= width || y >= width) return;
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

function patternedCityTile(x, y, variant = 0) {
  if ((x + y + variant) % 11 === 0) return CITY.cobbleDark;
  if ((x * 3 + y + variant) % 5 === 0) return CITY.cobbleAlt;
  return CITY.cobble;
}

function fillPatternTiles(data, width, x, y, w, h, variant = 0) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) setTile(data, width, xx, yy, patternedCityTile(xx, yy, variant));
  }
}

function frameTiles(data, width, x, y, w, h, value) {
  for (let xx = x; xx < x + w; xx += 1) {
    setTile(data, width, xx, y, value);
    setTile(data, width, xx, y + h - 1, value);
  }
  for (let yy = y; yy < y + h; yy += 1) {
    setTile(data, width, x, yy, value);
    setTile(data, width, x + w - 1, yy, value);
  }
}

function paintBuildingGround(data, width, p, variant = 0) {
  clearTiles(data.CityBase, width, p.x, p.y, p.w, p.h);

  const foundationX = p.x + 2;
  const foundationY = p.y + Math.max(7, Math.floor(p.h * 0.42));
  const foundationW = p.w - 4;
  const foundationH = p.h - (foundationY - p.y) - 1;
  fillPatternTiles(data.CityBase, width, foundationX, foundationY, foundationW, foundationH, variant);
  frameTiles(data.CityBase, width, foundationX, foundationY, foundationW, foundationH, CITY.cobbleDark);

  const apronX = p.doorX - 4;
  const apronY = p.y + p.h - 2;
  const apronW = p.doorW + 8;
  const apronH = 6;
  fillPatternTiles(data.CityBase, width, apronX, apronY, apronW, apronH, variant + 3);
  frameTiles(data.CityBase, width, apronX, apronY, apronW, apronH, CITY.cobbleDark);
  fillTiles(data.CityBase, width, p.doorX - 2, p.y + p.h, p.doorW + 4, 4, CITY.cobbleAlt);
}

function layerByName(map, name, type = null) {
  const layer = map.layers.find((candidate) => candidate.name === name && (!type || candidate.type === type));
  if (!layer) throw new Error(`Missing layer: ${name}`);
  return layer;
}

function objectLayer(map, name) {
  const layer = layerByName(map, name, 'objectgroup');
  layer.objects ??= [];
  return layer;
}

function prop(name, type, value) {
  return { name, type, value };
}

function pointObject(id, name, x, y, properties) {
  return { id, name, x, y, width: 0, height: 0, point: true, rotation: 0, type: '', visible: true, opacity: 1, properties };
}

function rectObject(id, name, x, y, w, h, properties) {
  return { id, name, x, y, width: w, height: h, rotation: 0, type: '', visible: true, opacity: 1, properties };
}

function stamp(data, width, placement, firstgid) {
  for (let y = 0; y < placement.h; y += 1) {
    for (let x = 0; x < placement.w; x += 1) setTile(data, width, placement.x + x, placement.y + y, firstgid + y * placement.w + x);
  }
}

function collisionFrame(data, width, p) {
  for (let y = 0; y < p.h; y += 1) {
    for (let x = 0; x < p.w; x += 1) {
      const gx = p.x + x;
      const gy = p.y + y;
      const border = x === 0 || y === 0 || x === p.w - 1 || y === p.h - 1;
      const inDoor = gx >= p.doorX && gx < p.doorX + p.doorW && gy >= p.y + p.h - 2;
      if (border && !inDoor) setTile(data, width, gx, gy, COLLISION_GID);
    }
  }
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

async function writeAssets() {
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.mkdir(tilesetsDir, { recursive: true });
  for (const spec of assetSpecs) {
    const image = drawAsset(spec);
    await fs.writeFile(`${assetsDir}/${spec.png}`, pngEncode(image));
    await fs.writeFile(`${tilesetsDir}/${spec.tsx}`, `<?xml version="1.0" encoding="UTF-8"?>\n<tileset version="1.10" tiledversion="1.11.2" name="${spec.name}" tilewidth="32" tileheight="32" tilecount="${spec.w * spec.h}" columns="${spec.w}">\n <image source="../assets/tilesets/${spec.png}" width="${spec.w * TILE}" height="${spec.h * TILE}"/>\n</tileset>\n`, 'utf8');
  }
}

function nextFirstgid(map) {
  let next = 1;
  for (const tileset of map.tilesets ?? []) {
    const spec = assetSpecs.find((candidate) => `../tilesets/${candidate.tsx}` === tileset.source);
    const count = spec ? spec.w * spec.h : /world_v6_city/.test(tileset.source ?? '') ? 8192 : /collision_debug/.test(tileset.source ?? '') ? 1 : 256;
    next = Math.max(next, Number(tileset.firstgid ?? 1) + count);
  }
  return next;
}

function ensureTilesets(map) {
  map.tilesets = (map.tilesets ?? []).filter((tileset) => !assetSpecs.some((spec) => tileset.source === `../tilesets/${spec.tsx}`));
  let firstgid = nextFirstgid(map);
  const gids = {};
  for (const spec of assetSpecs) {
    gids[spec.key] = firstgid;
    map.tilesets.push({ firstgid, source: `../tilesets/${spec.tsx}` });
    firstgid += spec.w * spec.h;
  }
  map.tilesets.sort((a, b) => a.firstgid - b.firstgid);
  return gids;
}

function updateEntranceObjects(map) {
  const buildings = objectLayer(map, 'Buildings');
  const townEntrance = buildings.objects.find((object) => object.name === 'town_hall_entrance');
  const bankEntrance = buildings.objects.find((object) => object.name === 'tamzia_city_bank_entrance');
  if (townEntrance) {
    townEntrance.x = placements.townHall.doorX * TILE;
    townEntrance.y = (placements.townHall.y + placements.townHall.h - 1) * TILE;
    townEntrance.width = placements.townHall.doorW * TILE;
    townEntrance.height = TILE;
    townEntrance.properties = [
      prop('type', 'string', 'buildingEntrance'),
      prop('buildingId', 'string', 'tamzia_town_hall'),
      prop('interiorId', 'string', placements.townHall.interiorId),
      prop('doorX', 'int', placements.townHall.doorX + Math.floor(placements.townHall.doorW / 2)),
      prop('doorY', 'int', placements.townHall.y + placements.townHall.h),
    ];
  }
  if (bankEntrance) {
    bankEntrance.x = placements.bank.doorX * TILE;
    bankEntrance.y = (placements.bank.y + placements.bank.h - 1) * TILE;
    bankEntrance.width = placements.bank.doorW * TILE;
    bankEntrance.height = TILE;
    bankEntrance.properties = [
      prop('type', 'string', 'buildingEntrance'),
      prop('buildingId', 'string', 'tamzia_city_bank'),
      prop('interiorId', 'string', placements.bank.interiorId),
      prop('doorX', 'int', placements.bank.doorX + Math.floor(placements.bank.doorW / 2)),
      prop('doorY', 'int', placements.bank.y + placements.bank.h),
    ];
  }
}

function placeHubPlaza(data, width) {
  const hub = { x: 460, y: 424, w: 52, h: 44 };
  const cx = hub.x + Math.floor(hub.w / 2);
  const cy = hub.y + Math.floor(hub.h / 2);
  fillTiles(data.CityBase, width, cx - 12, cy - 10, 25, 21, CITY.cobble);
  fillTiles(data.CityBase, width, cx - 13, cy - 11, 27, 2, CITY.cobbleDark);
  fillTiles(data.CityBase, width, cx - 13, cy + 10, 27, 2, CITY.cobbleDark);
  fillTiles(data.CityBase, width, cx - 13, cy - 11, 2, 23, CITY.cobbleDark);
  fillTiles(data.CityBase, width, cx + 12, cy - 11, 2, 23, CITY.cobbleDark);
  for (let y = -3; y <= 3; y += 1) {
    for (let x = -3; x <= 3; x += 1) {
      const d = Math.abs(x) + Math.abs(y);
      setTile(data.CityBase, width, cx + x, cy + y, d <= 1 ? CITY.fountainWater : d <= 4 ? CITY.fountainBasin : CITY.fountainEdge);
    }
  }
  setTile(data.CityBase, width, cx, cy, CITY.fountainStatue);
  setTile(data.CityBase, width, cx - 1, cy, CITY.fountainFoam);
  setTile(data.CityBase, width, cx + 1, cy, CITY.fountainFoam);
  [[-10, -8], [10, -8], [-10, 8], [10, 8]].forEach(([x, y]) => setTile(data.CityBase, width, cx + x, cy + y, CITY.cityLamp));
  [[-7, -8], [7, -8], [-7, 8], [7, 8]].forEach(([x, y]) => setTile(data.CityBase, width, cx + x, cy + y, CITY.bench));
  [[-12, 0], [12, 0], [0, -10], [0, 10], [-12, -6], [12, 6]].forEach(([x, y]) => setTile(data.CityBase, width, cx + x, cy + y, CITY.planter));
  setTile(data.CityBase, width, cx - 12, cy + 9, CITY.signGeneral);
  setTile(data.CityBase, width, cx + 12, cy - 9, CITY.bannerBlue);
}

function addInteriorObjects(map) {
  const interiorZones = objectLayer(map, 'InteriorZones');
  const npcs = objectLayer(map, 'NPCs');
  const questGivers = objectLayer(map, 'QuestGiver');
  const landmarks = objectLayer(map, 'Landmarks');
  const removeRe = /^tamzia_(town_hall|bank|city_bank)|^questgiver_tamzia_/i;
  interiorZones.objects = interiorZones.objects.filter((object) => !removeRe.test(object.name ?? ''));
  npcs.objects = npcs.objects.filter((object) => !removeRe.test(object.name ?? ''));
  questGivers.objects = questGivers.objects.filter((object) => !removeRe.test(object.name ?? ''));
  landmarks.objects = landmarks.objects.filter((object) => !/^tamzia_(town_hall|city_bank)_placed$/i.test(object.name ?? ''));

  let id = Math.max(1, ...map.layers.flatMap((layer) => (layer.objects ?? []).map((object) => Number(object.id ?? 0)))) + 1;
  const addInteriorZone = (p, displayName) => {
    interiorZones.objects.push(rectObject(id++, p.interiorId, (p.x + 1) * TILE, (p.y + 1) * TILE, (p.w - 2) * TILE, (p.h - 2) * TILE, [
      prop('type', 'string', 'buildingInterior'),
      prop('buildingId', 'string', p.name),
      prop('interiorId', 'string', p.interiorId),
      prop('displayName', 'string', displayName),
      prop('roofLayer', 'string', 'CityRoofs'),
      prop('roofHide', 'bool', true),
      prop('interiorFocus', 'bool', true),
      prop('doorX', 'int', p.doorX + Math.floor(p.doorW / 2)),
      prop('doorY', 'int', p.y + p.h),
      prop('debugOnly', 'bool', false),
    ]));
    landmarks.objects.push(rectObject(id++, `${p.name}_placed`, p.x * TILE, p.y * TILE, p.w * TILE, p.h * TILE, [
      prop('type', 'string', 'building'),
      prop('buildingId', 'string', p.name),
      prop('interiorId', 'string', p.interiorId),
      prop('displayName', 'string', displayName),
      prop('showOnMap', 'bool', false),
      prop('debugOnly', 'bool', true),
    ]));
  };
  addInteriorZone(placements.townHall, 'Tamzia Town Hall');
  addInteriorZone(placements.bank, 'Tamzia City Bank');

  const npc = (layer, name, p, tx, ty, displayName, npcType, color, extra = []) => {
    layer.objects.push(pointObject(id++, name, tx * TILE + 16, ty * TILE + 16, [
      prop('type', 'string', npcType),
      prop('npcType', 'string', npcType),
      prop('displayName', 'string', displayName),
      prop('color', 'string', color),
      prop('interiorId', 'string', p.interiorId),
      prop('buildingId', 'string', p.name),
      prop('interactRange', 'int', 104),
      ...extra,
    ]));
  };
  const questGiver = (name, p, tx, ty, displayName, npcType, color, questGiverId, title, dialogue) => {
    questGivers.objects.push(pointObject(id++, name, tx * TILE + 16, ty * TILE + 16, [
      prop('type', 'string', 'questgiver'),
      prop('npcType', 'string', npcType),
      prop('displayName', 'string', displayName),
      prop('color', 'string', color),
      prop('interiorId', 'string', p.interiorId),
      prop('buildingId', 'string', p.name),
      prop('interactRange', 'int', 104),
      prop('questGiverId', 'string', questGiverId),
      prop('title', 'string', title),
      prop('dialogue', 'string', dialogue),
    ]));
  };

  npc(npcs, 'tamzia_town_hall_mayor', placements.townHall, 489, 382, 'Mayor Alwen Tamz', 'mayor', '#d6bd65');
  npc(npcs, 'tamzia_town_hall_clerk', placements.townHall, 480, 379, 'Clerk Nara Vell', 'clerk', '#93c5fd');
  npc(npcs, 'tamzia_town_hall_guard', placements.townHall, 498, 386, 'Tamzia Hall Guard', 'guard', '#94a3b8');
  npc(npcs, 'tamzia_town_hall_assistant', placements.townHall, 472, 386, 'Civic Assistant Orin', 'assistant', '#86efac');
  questGiver(
    'questgiver_tamzia_town_hall_mayor',
    placements.townHall,
    489,
    382,
    'Mayor Alwen Tamz',
    'mayor',
    '#d6bd65',
    'tamzia_town_hall_mayor',
    'Mayor of Tamzia',
    'Welcome to Tamzia. The city has work for steady hands.',
  );
  questGiver(
    'questgiver_tamzia_town_hall_assistant',
    placements.townHall,
    472,
    386,
    'Civic Assistant Orin',
    'assistant',
    '#86efac',
    'tamzia_town_hall_assistant',
    'Civic Assistant',
    'I keep the civic ledger. More assignments will be posted here as Tamzia expands.',
  );

  npc(npcs, 'tamzia_city_bank_banker', placements.bank, 423, 393, 'Banker Maro Gilt', 'banker', '#facc15', [
    prop('serviceType', 'string', 'bank'),
    prop('shopType', 'string', 'bank'),
  ]);
  npc(npcs, 'tamzia_city_bank_assistant', placements.bank, 419, 393, 'Assistant Banker Lysa', 'assistant_banker', '#fde68a');
  npc(npcs, 'tamzia_city_bank_vault_clerk', placements.bank, 431, 389, 'Vault Clerk Dovan', 'vault_clerk', '#cbd5e1');
  npc(npcs, 'tamzia_city_bank_guard', placements.bank, 428, 396, 'Tamzia Bank Guard', 'guard', '#94a3b8');
  map.nextobjectid = id;
}

async function updateChunks(map, data) {
  const affected = [[3, 2], [3, 3], [3, 4], [4, 2], [4, 3], [4, 4]];
  const updated = [];
  const indexPath = `${CHUNKS_DIR}/world_v3_chunks.json`;
  try {
    const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
    index.tilesets = (index.tilesets ?? []).filter((tileset) => !assetSpecs.some((spec) => tileset.source === `../../tilesets/${spec.tsx}`));
    for (const spec of assetSpecs) {
      const mapTileset = map.tilesets.find((tileset) => tileset.source === `../tilesets/${spec.tsx}`);
      if (mapTileset) index.tilesets.push({ ...mapTileset, source: `../../tilesets/${spec.tsx}` });
    }
    index.tilesets.sort((a, b) => a.firstgid - b.firstgid);
    await fs.writeFile(indexPath, `${JSON.stringify(index)}\n`, 'utf8');
  } catch {
    // The region map remains valid even when runtime chunks have not been generated locally.
  }
  for (const [chunkX, chunkY] of affected) {
    const path = `${CHUNKS_DIR}/chunk_${chunkX}_${chunkY}.json`;
    try {
      const chunk = JSON.parse(await fs.readFile(path, 'utf8'));
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
      await fs.writeFile(path, `${JSON.stringify(chunk)}\n`, 'utf8');
      updated.push(`chunk_${chunkX}_${chunkY}.json`);
    } catch {
      // Chunk generation is optional in local authoring, but existing chunks are kept in sync when present.
    }
  }
  return updated;
}

async function updateMap() {
  const map = JSON.parse(await fs.readFile(MAP_PATH, 'utf8'));
  const gids = ensureTilesets(map);
  const tileLayers = Object.fromEntries(map.layers.filter((layer) => layer.type === 'tilelayer').map((layer) => [layer.name, layer]));
  const data = Object.fromEntries(Object.entries(tileLayers).map(([name, layer]) => [name, decodeLayer(layer)]));

  for (const p of [placements.townHall, placements.bank]) {
    clearTiles(data.CityInteriors, map.width, p.x, p.y, p.w, p.h);
    clearTiles(data.CityRoofs, map.width, p.x, p.y, p.w, p.h);
    clearTiles(data.Collision, map.width, p.x, p.y, p.w, p.h);
  }
  paintBuildingGround(data, map.width, placements.townHall, 1);
  paintBuildingGround(data, map.width, placements.bank, 4);
  stamp(data.CityRoofs, map.width, placements.townHall, gids.townHallExterior);
  stamp(data.CityInteriors, map.width, placements.townHall, gids.townHallInterior);
  stamp(data.CityRoofs, map.width, placements.bank, gids.bankExterior);
  stamp(data.CityInteriors, map.width, placements.bank, gids.bankInterior);
  collisionFrame(data.Collision, map.width, placements.townHall);
  collisionFrame(data.Collision, map.width, placements.bank);
  clearTiles(data.Collision, map.width, placements.townHall.doorX, placements.townHall.y + placements.townHall.h - 2, placements.townHall.doorW, 4);
  clearTiles(data.Collision, map.width, placements.bank.doorX, placements.bank.y + placements.bank.h - 2, placements.bank.doorW, 4);

  fillTiles(data.Roads, map.width, placements.townHall.doorX - 2, placements.townHall.y + placements.townHall.h, placements.townHall.doorW + 4, 4, CITY.cobbleAlt);
  fillTiles(data.Roads, map.width, placements.bank.doorX - 2, placements.bank.y + placements.bank.h, placements.bank.doorW + 4, 4, CITY.cobbleAlt);

  placeHubPlaza(data, map.width);
  updateEntranceObjects(map);
  addInteriorObjects(map);

  for (const [name, layer] of Object.entries(tileLayers)) encodeLayer(layer, data[name]);
  await fs.writeFile(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  const chunks = await updateChunks(map, data);
  return { gids, chunks };
}

await writeAssets();
const result = await updateMap();
console.log(JSON.stringify({
  assets: assetSpecs.map((spec) => ({ png: `${assetsDir}/${spec.png}`, tsx: `${tilesetsDir}/${spec.tsx}`, sizeTiles: `${spec.w}x${spec.h}` })),
  firstgids: result.gids,
  chunks: result.chunks,
}, null, 2));
