import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_PATH = path.join(ROOT, 'public', 'maps', 'world_map', 'continents', 'continent_01', 'regions', 'continent_01_region_0_0.tmj');
const ASSET_DIR = path.join(ROOT, 'public', 'assets', 'tilesets');
const PROJECT_TILESET_DIR = path.join(ROOT, 'public', 'tilesets');
const CONTINENT_TILESET_DIR = path.join(ROOT, 'public', 'maps', 'world_map', 'continents', 'continent_01', 'tilesets');

const SHEET_NAME = 'tamzia_river_tribe_v1';
const MAP_TILESET_SOURCE = `../tilesets/${SHEET_NAME}.tsx`;
const BRIDGE_SHEET_NAME = 'tamzia_river_bridge_v2';
const BRIDGE_TILESET_SOURCE = `../tilesets/${BRIDGE_SHEET_NAME}.tsx`;
const BRIDGE_FIRST_GID = 32000;
const LAYER_NAME = 'tamzia_river_tribe';
const GENERATED_BY = SHEET_NAME;
const FRAME = 160;
const COLUMNS = 8;
const ROWS = 3;
const TILECOUNT = COLUMNS * ROWS;

const TILES = {
  tent: { id: 0, width: 152, height: 132, displayName: 'Reedwater Lean-to' },
  rack: { id: 1, width: 142, height: 112, displayName: 'Fishing Rack' },
  skiff: { id: 2, width: 150, height: 94, displayName: 'Moored River Skiff' },
  fire: { id: 6, width: 94, height: 84, displayName: 'Smouldering Fire' },
  banner: { id: 10, width: 58, height: 126, displayName: 'Reedwater Banner' },
  supplies: { id: 14, width: 124, height: 86, displayName: 'River Supplies' },
  reeds: { id: 15, width: 106, height: 84, displayName: 'River Reeds' },
  bridge: { id: 16, width: 288, height: 288, displayName: 'Reedwater Footbridge' },
  nets: { id: 17, width: 112, height: 78, displayName: 'Cast Net and Poles' },
  driftwood: { id: 18, width: 126, height: 62, displayName: 'Driftwood Cache' },
  watchpost: { id: 19, width: 74, height: 128, displayName: 'Marauder Watchpost' },
};

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
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= image.width || py >= image.height) return;
  const index = (py * image.width + px) * 4;
  image.data[index] = color[0];
  image.data[index + 1] = color[1];
  image.data[index + 2] = color[2];
  image.data[index + 3] = color[3];
}

function fill(image, x, y, width, height, color) {
  for (let yy = Math.floor(y); yy < Math.ceil(y + height); yy += 1) {
    for (let xx = Math.floor(x); xx < Math.ceil(x + width); xx += 1) put(image, xx, yy, color);
  }
}

function line(image, x0, y0, x1, y1, color, thickness = 1) {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    for (let oy = -Math.floor(thickness / 2); oy <= Math.floor(thickness / 2); oy += 1) {
      for (let ox = -Math.floor(thickness / 2); ox <= Math.floor(thickness / 2); ox += 1) {
        put(image, x0 + (x1 - x0) * t + ox, y0 + (y1 - y0) * t + oy, color);
      }
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
      if ((y0 < y && y1 >= y) || (y1 < y && y0 >= y)) nodes.push(Math.round(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)));
    }
    nodes.sort((a, b) => a - b);
    for (let index = 0; index + 1 < nodes.length; index += 2) fill(image, nodes[index], y, nodes[index + 1] - nodes[index] + 1, 1, color);
  }
}

function ellipse(image, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / Math.max(1, rx);
      const ny = (y - cy) / Math.max(1, ry);
      if (nx * nx + ny * ny <= 1) put(image, x, y, color);
    }
  }
}

function origin(id) {
  return { x: (id % COLUMNS) * FRAME, y: Math.floor(id / COLUMNS) * FRAME };
}

function drawTent(image) {
  const { x, y } = origin(0);
  ellipse(image, x + 80, y + 143, 63, 11, rgba('#17241f', 90));
  fill(image, x + 34, y + 91, 91, 48, rgba('#423225'));
  polygon(image, [[x + 18, y + 94], [x + 79, y + 25], [x + 145, y + 94]], rgba('#27372a'));
  polygon(image, [[x + 30, y + 95], [x + 79, y + 35], [x + 79, y + 95]], rgba('#557545'));
  polygon(image, [[x + 79, y + 35], [x + 138, y + 95], [x + 79, y + 95]], rgba('#3f5938'));
  line(image, x + 79, y + 25, x + 79, y + 143, rgba('#2b2118'), 3);
  line(image, x + 18, y + 94, x + 34, y + 139, rgba('#5b412c'), 3);
  line(image, x + 145, y + 94, x + 125, y + 139, rgba('#5b412c'), 3);
  fill(image, x + 70, y + 104, 19, 35, rgba('#1d201b'));
  fill(image, x + 73, y + 108, 13, 29, rgba('#7c5030'));
  for (let offset = 0; offset < 5; offset += 1) line(image, x + 35 + offset * 19, y + 82, x + 44 + offset * 18, y + 50, rgba('#91a65b', 155), 1);
}

function drawRack(image) {
  const { x, y } = origin(1);
  ellipse(image, x + 82, y + 144, 58, 9, rgba('#17241f', 82));
  line(image, x + 27, y + 137, x + 41, y + 45, rgba('#302219'), 5);
  line(image, x + 128, y + 137, x + 112, y + 45, rgba('#302219'), 5);
  line(image, x + 33, y + 55, x + 120, y + 48, rgba('#5d4027'), 6);
  line(image, x + 44, y + 72, x + 110, y + 67, rgba('#7b5633'), 3);
  for (let index = 0; index < 4; index += 1) {
    const fishX = x + 48 + index * 18;
    ellipse(image, fishX, y + 87 + (index % 2) * 3, 8, 4, rgba('#8ea7a1'));
    line(image, fishX - 10, y + 82, fishX - 1, y + 87, rgba('#2b3733'), 1);
    line(image, fishX, y + 72, fishX, y + 83, rgba('#c3af7b'), 1);
  }
  fill(image, x + 44, y + 117, 70, 16, rgba('#83603a'));
  for (let index = 0; index < 4; index += 1) line(image, x + 46 + index * 19, y + 118, x + 46 + index * 19, y + 132, rgba('#39291d'), 1);
}

function drawSkiff(image, id, phase) {
  const { x, y } = origin(id);
  const bob = [0, 2, 1, -1][phase];
  ellipse(image, x + 80, y + 126 + bob, 61, 12, rgba('#0d5a79', 105));
  polygon(image, [[x + 17, y + 92 + bob], [x + 141, y + 92 + bob], [x + 117, y + 121 + bob], [x + 43, y + 121 + bob]], rgba('#2c241b'));
  polygon(image, [[x + 23, y + 92 + bob], [x + 135, y + 92 + bob], [x + 112, y + 113 + bob], [x + 48, y + 113 + bob]], rgba('#8b5a32'));
  fill(image, x + 51, y + 96 + bob, 58, 7, rgba('#c49858'));
  line(image, x + 31, y + 80 + bob, x + 119, y + 136 + bob, rgba('#3c2b1d'), 3);
  line(image, x + 38, y + 78 + bob, x + 126, y + 134 + bob, rgba('#d3ae6b'), 1);
  fill(image, x + 76, y + 76 + bob, 8, 24, rgba('#5d4027'));
  polygon(image, [[x + 84, y + 77 + bob], [x + 111, y + 89 + bob], [x + 84, y + 96 + bob]], rgba('#5e7f45'));
}

function drawFire(image, id, phase) {
  const { x, y } = origin(id);
  const flame = [0, 4, 1, 6][phase];
  ellipse(image, x + 80, y + 136, 42, 9, rgba('#1b211d', 86));
  for (let index = 0; index < 7; index += 1) ellipse(image, x + 48 + index * 10, y + 123 + (index % 2) * 3, 8, 5, rgba('#6e7370'));
  line(image, x + 48, y + 126, x + 109, y + 112, rgba('#473020'), 5);
  line(image, x + 51, y + 112, x + 106, y + 129, rgba('#5d3b24'), 5);
  polygon(image, [[x + 80, y + 122], [x + 59, y + 92 - flame], [x + 76, y + 66 + flame], [x + 84, y + 96], [x + 101, y + 85 - flame], [x + 94, y + 122]], rgba('#e56b2e'));
  polygon(image, [[x + 80, y + 118], [x + 70, y + 95], [x + 79, y + 79 + flame], [x + 90, y + 109]], rgba('#ffd46b'));
  for (let index = 0; index < 3; index += 1) put(image, x + 68 + index * 12, y + 53 - ((phase + index) % 3) * 8, rgba('#f8d285', 190));
}

function drawBanner(image, id, phase) {
  const { x, y } = origin(id);
  const wave = [0, 5, 2, -3][phase];
  ellipse(image, x + 30, y + 144, 16, 5, rgba('#1b211d', 85));
  line(image, x + 30, y + 25, x + 30, y + 145, rgba('#33251b'), 5);
  fill(image, x + 23, y + 19, 15, 7, rgba('#bda26a'));
  polygon(image, [[x + 34, y + 37], [x + 74 + wave, y + 48], [x + 61 + wave, y + 89], [x + 37, y + 78]], rgba('#744132'));
  polygon(image, [[x + 36, y + 40], [x + 66 + wave, y + 50], [x + 56 + wave, y + 77], [x + 39, y + 70]], rgba('#a96e3e'));
  fill(image, x + 42 + wave * 0.4, y + 53, 8, 8, rgba('#d2c385'));
  line(image, x + 30, y + 27, x + 72 + wave, y + 42, rgba('#46301f'), 2);
}

function drawSupplies(image) {
  const { x, y } = origin(14);
  ellipse(image, x + 78, y + 140, 62, 9, rgba('#17241f', 86));
  fill(image, x + 20, y + 93, 52, 39, rgba('#4a3120'));
  fill(image, x + 25, y + 98, 42, 28, rgba('#95623b'));
  line(image, x + 25, y + 99, x + 67, y + 126, rgba('#58361f'), 2);
  line(image, x + 67, y + 99, x + 25, y + 126, rgba('#58361f'), 2);
  ellipse(image, x + 101, y + 109, 21, 31, rgba('#4a3120'));
  fill(image, x + 82, y + 86, 38, 46, rgba('#70472b'));
  fill(image, x + 87, y + 92, 28, 7, rgba('#c8954f'));
  fill(image, x + 87, y + 117, 28, 7, rgba('#2d2319'));
  fill(image, x + 78, y + 119, 18, 13, rgba('#c4b16f'));
}

function drawReeds(image) {
  const { x, y } = origin(15);
  ellipse(image, x + 81, y + 140, 49, 9, rgba('#122d2a', 88));
  for (let index = 0; index < 13; index += 1) {
    const reedX = x + 24 + index * 9;
    const height = 32 + (index % 4) * 9;
    line(image, reedX, y + 140, reedX + (index % 3 - 1) * 5, y + 140 - height, rgba('#3d5e37'), 3);
    line(image, reedX - 1, y + 136, reedX + (index % 3 - 1) * 5 - 10, y + 127 - height * 0.36, rgba('#648548'), 2);
    if (index % 2 === 0) fill(image, reedX - 3, y + 136 - height, 6, 13, rgba('#8a7944'));
  }
}

function drawBridge(image) {
  const { x, y } = origin(16);
  ellipse(image, x + 80, y + 127, 69, 16, rgba('#143c51', 64));
  // A simple, low plank bridge: readable from a distance without looking like a wall.
  line(image, x + 2, y + 158, x + 158, y + 2, rgba('#2b1d13'), 16);
  line(image, x + 2, y + 158, x + 158, y + 2, rgba('#9a6438'), 10);
  for (let index = 0; index < 12; index += 1) {
    const offset = 7 + index * 13;
    line(image, x + offset - 7, y + 165 - offset, x + offset + 7, y + 151 - offset, rgba('#d1a15f'), 2);
  }
  line(image, x + 1, y + 159, x + 159, y + 1, rgba('#51351e'), 2);
  line(image, x + 6, y + 142, x + 142, y + 6, rgba('#51351e'), 2);
}

function drawNets(image) {
  const { x, y } = origin(17);
  ellipse(image, x + 76, y + 143, 54, 8, rgba('#17241f', 82));
  line(image, x + 27, y + 139, x + 39, y + 52, rgba('#3b2a1c'), 4);
  line(image, x + 118, y + 139, x + 106, y + 52, rgba('#3b2a1c'), 4);
  line(image, x + 36, y + 62, x + 109, y + 61, rgba('#8b673f'), 3);
  for (let column = 0; column < 6; column += 1) {
    const netX = x + 43 + column * 11;
    line(image, netX, y + 65, netX + 15, y + 122, rgba('#a7b18d', 135), 1);
  }
  for (let row = 0; row < 5; row += 1) line(image, x + 42, y + 72 + row * 11, x + 102, y + 72 + row * 11, rgba('#a7b18d', 115), 1);
  fill(image, x + 75, y + 119, 32, 14, rgba('#83603a'));
}

function drawDriftwood(image) {
  const { x, y } = origin(18);
  ellipse(image, x + 78, y + 140, 60, 8, rgba('#17241f', 72));
  line(image, x + 20, y + 126, x + 108, y + 91, rgba('#34251a'), 11);
  line(image, x + 23, y + 122, x + 105, y + 89, rgba('#7b5130'), 7);
  line(image, x + 38, y + 136, x + 120, y + 109, rgba('#3b291d'), 9);
  line(image, x + 40, y + 133, x + 118, y + 107, rgba('#a57443'), 5);
  [32, 59, 87, 112].forEach((offset, index) => line(image, x + offset, y + 119 - index * 8, x + offset + 4, y + 126 - index * 8, rgba('#d8b36d'), 2));
}

function drawWatchpost(image) {
  const { x, y } = origin(19);
  ellipse(image, x + 38, y + 143, 26, 8, rgba('#17241f', 85));
  line(image, x + 25, y + 138, x + 36, y + 47, rgba('#3b291d'), 6);
  line(image, x + 51, y + 138, x + 42, y + 47, rgba('#3b291d'), 6);
  fill(image, x + 17, y + 51, 40, 8, rgba('#7d5530'));
  fill(image, x + 20, y + 59, 34, 22, rgba('#4a3424'));
  polygon(image, [[x + 10, y + 53], [x + 37, y + 20], [x + 64, y + 53]], rgba('#33452e'));
  line(image, x + 37, y + 18, x + 37, y + 56, rgba('#5b3c24'), 3);
  fill(image, x + 29, y + 65, 16, 9, rgba('#c38d45'));
  fill(image, x + 34, y + 40, 6, 10, rgba('#e6d089'));
}

function makeImage() {
  const image = new PNG({ width: FRAME * COLUMNS, height: FRAME * ROWS });
  drawTent(image);
  drawRack(image);
  [2, 3, 4, 5].forEach((id, phase) => drawSkiff(image, id, phase));
  [6, 7, 8, 9].forEach((id, phase) => drawFire(image, id, phase));
  [10, 11, 12, 13].forEach((id, phase) => drawBanner(image, id, phase));
  drawSupplies(image);
  drawReeds(image);
  drawBridge(image);
  drawNets(image);
  drawDriftwood(image);
  drawWatchpost(image);
  return image;
}

function animationTiles(startId, type, duration = 150) {
  return Array.from({ length: 4 }, (_, phase) => {
    const frames = Array.from({ length: 4 }, (_, index) => (
      `    <frame tileid="${startId + ((phase + index) % 4)}" duration="${duration}"/>`
    )).join('\n');
    return ` <tile id="${startId + phase}" type="${type}">\n  <animation>\n${frames}\n  </animation>\n </tile>`;
  }).join('\n');
}

function makeTsx(imageSource) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${SHEET_NAME}" tilewidth="${FRAME}" tileheight="${FRAME}" tilecount="${TILECOUNT}" columns="${COLUMNS}">
 <image source="${imageSource}" width="${FRAME * COLUMNS}" height="${FRAME * ROWS}"/>
 <tile id="0" type="river_tent"/>
 <tile id="1" type="fishing_rack"/>
${animationTiles(2, 'river_skiff', 180)}
${animationTiles(6, 'river_fire', 130)}
${animationTiles(10, 'river_banner', 180)}
 <tile id="14" type="river_supplies"/>
 <tile id="15" type="river_reeds"/>
 <tile id="16" type="river_bridge"/>
 <tile id="17" type="river_nets"/>
 <tile id="18" type="river_driftwood"/>
 <tile id="19" type="river_watchpost"/>
</tileset>
`;
}

function writeAssets() {
  [ASSET_DIR, PROJECT_TILESET_DIR, CONTINENT_TILESET_DIR].forEach((directory) => mkdirSync(directory, { recursive: true }));
  const image = makeImage();
  const png = PNG.sync.write(image, { colorType: 6, inputColorType: 6, deflateLevel: 9 });
  writeFileSync(path.join(ASSET_DIR, `${SHEET_NAME}.png`), png);
  writeFileSync(path.join(CONTINENT_TILESET_DIR, `${SHEET_NAME}.png`), png);
  writeFileSync(path.join(PROJECT_TILESET_DIR, `${SHEET_NAME}.tsx`), makeTsx(`../assets/tilesets/${SHEET_NAME}.png`), 'utf8');
  writeFileSync(path.join(CONTINENT_TILESET_DIR, `${SHEET_NAME}.tsx`), makeTsx(`${SHEET_NAME}.png`), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function decodeLayerData(layer) {
  if (Array.isArray(layer?.data)) return Uint32Array.from(layer.data);
  if (layer?.encoding !== 'base64' || layer?.compression !== 'zlib') {
    throw new Error(`Cannot decode ${layer?.name ?? 'unknown'} layer.`);
  }
  const bytes = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(bytes.length / 4);
  for (let index = 0; index < data.length; index += 1) data[index] = bytes.readUInt32LE(index * 4);
  return data;
}

function encodeLayerData(layer, data) {
  const bytes = Buffer.alloc(data.length * 4);
  for (let index = 0; index < data.length; index += 1) bytes.writeUInt32LE(data[index] >>> 0, index * 4);
  layer.encoding = 'base64';
  layer.compression = 'zlib';
  layer.data = zlib.deflateSync(bytes, { level: 6 }).toString('base64');
}

function distanceToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared)) : 0;
  const px = ax + dx * t;
  const py = ay + dy * t;
  return Math.hypot(x - px, y - py);
}

function carveReedwaterCreek(map) {
  const groundLayer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === 'Ground');
  const waterLayer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === 'Water');
  const shallowLayer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === 'ShallowWater');
  const terrainDetailsLayer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === 'TerrainDetails');
  const collisionLayer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === 'Collision');
  if (!groundLayer || !waterLayer || !shallowLayer || !terrainDetailsLayer || !collisionLayer) return 0;

  const ground = decodeLayerData(groundLayer);
  const water = decodeLayerData(waterLayer);
  const shallow = decodeLayerData(shallowLayer);
  const terrainDetails = decodeLayerData(terrainDetailsLayer);
  const collision = decodeLayerData(collisionLayer);
  // A single continuous tidal creek: broad at the sea mouth, narrow through camp,
  // then merged into the original south-east running river rather than capped at the bridge.
  const route = [[610, 93], [626, 102], [646, 117], [657, 137], [660, 157], [676, 178], [695, 195], [704, 218], [711, 242], [729, 266], [751, 286], [763, 309], [782, 330], [798, 339]];
  const routeDistance = (tileX, tileY) => Math.min(...route.slice(1).map((point, index) => distanceToSegment(tileX, tileY, route[index], point)));
  // Remove isolated deep-water leftovers from the prior creek versions. This only
  // operates below the coast, so the original sea tiles remain untouched.
  for (let tileY = 145; tileY <= 360; tileY += 1) {
    for (let tileX = 600; tileX < map.width; tileX += 1) {
      const index = tileY * map.width + tileX;
      if (routeDistance(tileX, tileY) <= 3) continue;
      if (!water[index] && !shallow[index]) continue;
      water[index] = 0;
      shallow[index] = 0;
      collision[index] = 0;
      terrainDetails[index] = 0;
      ground[index] = 1;
    }
  }
  let changed = 0;
  for (let tileY = 76; tileY <= 360; tileY += 1) {
    for (let tileX = 600; tileX < map.width; tileX += 1) {
      let nearestSegment = 0;
      let distance = Number.POSITIVE_INFINITY;
      route.slice(1).forEach((point, index) => {
        const candidate = distanceToSegment(tileX, tileY, route[index], point);
        if (candidate < distance) {
          distance = candidate;
          nearestSegment = index;
        }
      });
      const mouthProgress = Math.max(0, Math.min(1, nearestSegment / 3));
      const bridgeNarrowing = nearestSegment === 8 ? 1.5 : (nearestSegment === 7 || nearestSegment === 9 ? 0.5 : 0);
      const deepRadius = 4.5 + (1 - mouthProgress) * 5.5 - bridgeNarrowing;
      const index = tileY * map.width + tileX;
      // Rivers use a clean grass-to-deep-water edge. Clear the older shallow halo
      // and its terrain specks throughout the whole former creek corridor.
      if (distance <= 20 && shallow[index]) shallow[index] = 0;
      if (tileY > 146 && distance <= 42 && ground[index] >= 2305 && ground[index] < 2561) {
        ground[index] = 1;
        terrainDetails[index] = 0;
      }
      if (tileY > 146 && distance <= 18) {
        const bankDetail = ((((tileX * 73856093) ^ (tileY * 19349663)) >>> 0) % 37) === 0;
        ground[index] = bankDetail ? 2 : 1;
        terrainDetails[index] = 0;
      }
      if (distance > deepRadius) {
        if (distance <= 20 && water[index]) terrainDetails[index] = 0;
        continue;
      }
      // Keep a thin sandy lip only at the actual sea mouth; the rest is grassy riverbank.
      if (tileY > 146) ground[index] = 1;
      terrainDetails[index] = 0;
      water[index] = 3073;
      shallow[index] = 0;
      collision[index] = 5393;
      changed += 1;
    }
  }
  encodeLayerData(groundLayer, ground);
  encodeLayerData(waterLayer, water);
  encodeLayerData(shallowLayer, shallow);
  encodeLayerData(terrainDetailsLayer, terrainDetails);
  encodeLayerData(collisionLayer, collision);
  return changed;
}

function clearFootbridgeCollision(map) {
  const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === 'Collision');
  if (!layer) return 0;
  const data = decodeLayerData(layer);
  const centerX = 725;
  const centerY = 262;
  let cleared = 0;
  for (let tileY = centerY - 15; tileY <= centerY + 15; tileY += 1) {
    for (let tileX = centerX - 15; tileX <= centerX + 15; tileX += 1) {
      if (tileX < 0 || tileY < 0 || tileX >= layer.width || tileY >= layer.height) continue;
      if (Math.abs(tileX + tileY - (centerX + centerY)) > 3) continue;
      const index = tileY * layer.width + tileX;
      if (!data[index]) continue;
      data[index] = 0;
      cleared += 1;
    }
  }
  encodeLayerData(layer, data);
  return cleared;
}

function normalizeSource(source) {
  return String(source ?? '').replace(/\\/g, '/');
}

function parseTileCount(baseFilePath, source) {
  const tilesetPath = path.resolve(path.dirname(baseFilePath), normalizeSource(source));
  if (!existsSync(tilesetPath)) return 1;
  const sourceText = readFileSync(tilesetPath, 'utf8');
  return Math.max(1, Number(sourceText.match(/tilecount="(\d+)"/)?.[1] ?? 1));
}

function upsertTileset(map) {
  const existing = map.tilesets.find((tileset) => normalizeSource(tileset.source) === MAP_TILESET_SOURCE);
  if (existing) return Number(existing.firstgid);
  const firstgid = map.tilesets.reduce((next, tileset) => Math.max(next, Number(tileset.firstgid) + parseTileCount(MAP_PATH, tileset.source)), 1);
  map.tilesets.push({ firstgid, source: MAP_TILESET_SOURCE });
  map.tilesets.sort((a, b) => Number(a.firstgid) - Number(b.firstgid));
  return firstgid;
}

function upsertBridgeTileset(map) {
  const existing = map.tilesets.find((tileset) => normalizeSource(tileset.source) === BRIDGE_TILESET_SOURCE);
  if (existing) {
    existing.firstgid = BRIDGE_FIRST_GID;
    return Number(existing.firstgid);
  }
  map.tilesets.push({ firstgid: BRIDGE_FIRST_GID, source: BRIDGE_TILESET_SOURCE });
  map.tilesets.sort((a, b) => Number(a.firstgid) - Number(b.firstgid));
  return BRIDGE_FIRST_GID;
}

function getProperties(object) {
  return Object.fromEntries((object?.properties ?? []).map((property) => [property.name, property.value]));
}

function prop(name, type, value) {
  return { name, type, value };
}

function objectLayer(map, name, afterName) {
  let layer = map.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === name);
  if (layer) return layer;
  layer = {
    draworder: 'topdown',
    id: Math.max(...map.layers.map((candidate) => Number(candidate.id ?? 0)), 0) + 1,
    name,
    objects: [],
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
  const afterIndex = map.layers.findIndex((candidate) => candidate.name === afterName);
  map.layers.splice(afterIndex >= 0 ? afterIndex + 1 : map.layers.length, 0, layer);
  return layer;
}

function maxObjectId(map) {
  return Math.max(0, ...(map.layers ?? []).flatMap((layer) => (layer.objects ?? []).map((object) => Number(object.id ?? 0))));
}

function makeProp(id, tile, x, y, kind, extra = {}) {
  return {
    gid: tile.gid,
    height: tile.height,
    id,
    name: '',
    opacity: 1,
    properties: [
      prop('type', 'string', kind),
      prop('displayName', 'string', tile.displayName),
      prop('spriteSheet', 'string', extra.spriteSheet ?? SHEET_NAME),
      prop('generatedBy', 'string', GENERATED_BY),
      prop('campArea', 'string', 'tamzia_river_tribe'),
      prop('collision', 'bool', false),
      ...(extra.animation ? [prop('animation', 'string', extra.animation), prop('animationPhase', 'int', extra.animationPhase ?? 0)] : []),
    ],
    rotation: 0,
    type: kind,
    visible: true,
    width: tile.width,
    x: Math.round(x - tile.width / 2),
    y: Math.round(y),
  };
}

function applyRiverCamp() {
  const map = readJson(MAP_PATH);
  const creekTiles = carveReedwaterCreek(map);
  const firstgid = upsertTileset(map);
  const bridgeFirstgid = upsertBridgeTileset(map);
  const layer = objectLayer(map, LAYER_NAME, 'Props');
  layer.draworder = 'topdown';
  layer.objects = (layer.objects ?? []).filter((object) => getProperties(object).generatedBy !== GENERATED_BY);
  let nextId = maxObjectId(map) + 1;
  const tile = (key) => ({ ...TILES[key], gid: firstgid + TILES[key].id });
  const bridgeTile = {
    gid: bridgeFirstgid,
    height: 320,
    width: 320,
    displayName: 'Reedwater Wide Timber Bridge',
  };
  const objects = [
    makeProp(nextId++, tile('tent'), 21580, 7410, 'river_tent'),
    makeProp(nextId++, tile('tent'), 22195, 7800, 'river_tent'),
    makeProp(nextId++, tile('tent'), 23920, 8070, 'river_tent'),
    makeProp(nextId++, tile('rack'), 23950, 8330, 'fishing_rack'),
    makeProp(nextId++, tile('fire'), 22145, 8070, 'river_fire', { animation: 'fire_flicker', animationPhase: 0 }),
    makeProp(nextId++, tile('fire'), 23920, 8545, 'river_fire', { animation: 'fire_flicker', animationPhase: 2 }),
    makeProp(nextId++, tile('banner'), 21840, 7620, 'river_banner', { animation: 'banner_flutter', animationPhase: 1 }),
    makeProp(nextId++, tile('banner'), 24140, 8120, 'river_banner', { animation: 'banner_flutter', animationPhase: 3 }),
    makeProp(nextId++, tile('supplies'), 22540, 7830, 'river_supplies'),
    makeProp(nextId++, tile('supplies'), 24010, 8380, 'river_supplies'),
    makeProp(nextId++, tile('rack'), 21635, 7845, 'fishing_rack'),
    makeProp(nextId++, tile('nets'), 23880, 8460, 'river_nets'),
    makeProp(nextId++, tile('driftwood'), 21885, 8290, 'river_driftwood'),
    makeProp(nextId++, tile('watchpost'), 21440, 7925, 'river_watchpost'),
    makeProp(nextId++, bridgeTile, 23208, 8544, 'river_bridge', { spriteSheet: BRIDGE_SHEET_NAME }),
    makeProp(nextId++, tile('skiff'), 23580, 8860, 'river_skiff', { animation: 'water_bob', animationPhase: 0 }),
    makeProp(nextId++, tile('skiff'), 24170, 9440, 'river_skiff', { animation: 'water_bob', animationPhase: 2 }),
    makeProp(nextId++, tile('reeds'), 22850, 8310, 'river_reeds'),
    makeProp(nextId++, tile('reeds'), 23830, 8705, 'river_reeds'),
    makeProp(nextId++, tile('reeds'), 24400, 9140, 'river_reeds'),
    makeProp(nextId++, tile('reeds'), 25100, 9680, 'river_reeds'),
    makeProp(nextId++, tile('reeds'), 22410, 8215, 'river_reeds'),
  ];
  layer.objects = [...layer.objects, ...objects].sort((a, b) => Number(a.y ?? 0) - Number(b.y ?? 0));

  const landmarks = objectLayer(map, 'Landmarks');
  landmarks.objects = (landmarks.objects ?? []).filter((object) => object.name !== 'tamzia_reedwater_encampment');
  landmarks.objects.push({
    height: 0,
    id: nextId++,
    name: 'tamzia_reedwater_encampment',
    opacity: 1,
    point: true,
    properties: [
      prop('displayName', 'string', 'Reedwater Encampment'),
      prop('kind', 'string', 'enemy_camp'),
      prop('showOnMap', 'bool', true),
    ],
    rotation: 0,
    type: 'landmark',
    visible: true,
    width: 0,
    x: 22380,
    y: 8020,
  });
  const bridgeTiles = clearFootbridgeCollision(map);
  map.nextobjectid = Math.max(Number(map.nextobjectid ?? 1), nextId);
  writeJson(MAP_PATH, map);
  return { firstgid, bridgeFirstgid, objects: objects.length, bridgeTiles, creekTiles };
}

writeAssets();
const result = applyRiverCamp();
console.log(JSON.stringify({
  tileset: SHEET_NAME,
  ...result,
  summary: 'Refined the Reedwater marauder camp with a sea-connected creek, a full-span footbridge, animated skiffs, fires and banners.',
}, null, 2));
