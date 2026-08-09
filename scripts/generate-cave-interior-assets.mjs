import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';

const ROOT = process.cwd();
const REGION_PATH = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions/continent_01_region_1_0.tmj');
const CHUNK_INDEX_PATH = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions/chunks/continent_01_chunks.json');
const CHUNK_DIR = path.dirname(CHUNK_INDEX_PATH);
const CHUNK_RUNTIME_VERSION = 'v4-continent-01-runtime-chunks-9';
const TILESET_DIR = path.join(ROOT, 'public/maps/world_map/continents/continent_01/tilesets');
const TILESET_IMAGE_NAME = 'cave_interiors_v1.png';
const TILESET_TSX_NAME = 'cave_interiors_v1.tsx';
const TILESET_SOURCE = `../tilesets/${TILESET_TSX_NAME}`;
const CHUNK_TILESET_SOURCE = `../../tilesets/${TILESET_TSX_NAME}`;
const ENTRANCE_SPRITE_IMAGE_NAME = 'cave_entrance_small_v1.png';
const ENTRANCE_SPRITE_TSX_NAME = 'cave_entrance_small_v1.tsx';
const ENTRANCE_SPRITE_SOURCE = `../tilesets/${ENTRANCE_SPRITE_TSX_NAME}`;
const ENTRANCE_SPRITE_CHUNK_SOURCE = `../../tilesets/${ENTRANCE_SPRITE_TSX_NAME}`;
const CAVE_ENTRANCE_PROP_NAME = 'prop_cave_entrance_01';
const CAVE_ENTRANCE_DRAW_WIDTH = 176;
const CAVE_ENTRANCE_DRAW_HEIGHT = 128;
const CAVE_ENTRANCE_CONNECTOR_WIDTH = 144;

const TILE = 32;
const SHEET_COLUMNS = 16;
const SHEET_ROWS = 8;
const TILECOUNT = SHEET_COLUMNS * SHEET_ROWS;
const TILESET_WIDTH = SHEET_COLUMNS * TILE;
const TILESET_HEIGHT = SHEET_ROWS * TILE;

const GENERATED_LAYER_NAMES = new Set([
  'CaveInteriors',
  'CaveDetails',
  'CaveEntrances',
  'CaveRoofs',
  'CaveCollision',
]);
const COLLISION_TILESET_SOURCE = '../tilesets/collision_debug_v3.tsx';
const CHUNK_OBJECT_LAYER_NAMES = new Set(['Caves', 'CaveSpawns', 'CaveProps']);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hash2(x, y, seed = 0) {
  const value = Math.sin((x * 127.1 + y * 311.7 + seed * 74.7) * 0.017453292519943295) * 43758.5453123;
  return value - Math.floor(value);
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function mixColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function setPixel(png, x, y, color, alpha = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (y * png.width + x) * 4;
  png.data[index] = color[0];
  png.data[index + 1] = color[1];
  png.data[index + 2] = color[2];
  png.data[index + 3] = alpha;
}

function fillTile(png, tileId, base, accent, options = {}) {
  const tileX = (tileId % SHEET_COLUMNS) * TILE;
  const tileY = Math.floor(tileId / SHEET_COLUMNS) * TILE;
  const baseRgb = hexToRgb(base);
  const accentRgb = hexToRgb(accent);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const n = hash2(tileX + x, tileY + y, tileId);
      const shade = (x + y) / (TILE * 2);
      let color = mixColor(baseRgb, accentRgb, clamp(n * 0.52 + shade * 0.22, 0, 1));
      if (options.darkTop && y < 8) color = mixColor(color, [8, 9, 9], 0.45);
      if (options.darkBottom && y > 23) color = mixColor(color, [8, 9, 9], 0.35);
      if (options.cracks && n > 0.91 && (x + y + tileId) % 5 === 0) color = mixColor(color, [18, 17, 15], 0.65);
      setPixel(png, tileX + x, tileY + y, color);
    }
  }
}

function drawTileLine(png, tileId, x1, y1, x2, y2, colorHex, width = 1) {
  const tileX = (tileId % SHEET_COLUMNS) * TILE;
  const tileY = Math.floor(tileId / SHEET_COLUMNS) * TILE;
  const color = hexToRgb(colorHex);
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2);
  for (let step = 0; step <= steps; step += 1) {
    const t = steps === 0 ? 0 : step / steps;
    const cx = x1 + (x2 - x1) * t;
    const cy = y1 + (y2 - y1) * t;
    for (let oy = -width; oy <= width; oy += 1) {
      for (let ox = -width; ox <= width; ox += 1) {
        if (ox * ox + oy * oy <= width * width) setPixel(png, tileX + Math.round(cx + ox), tileY + Math.round(cy + oy), color);
      }
    }
  }
}

function drawTileEllipse(png, tileId, cx, cy, rx, ry, colorHex, alpha = 255) {
  const tileX = (tileId % SHEET_COLUMNS) * TILE;
  const tileY = Math.floor(tileId / SHEET_COLUMNS) * TILE;
  const color = hexToRgb(colorHex);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPixel(png, tileX + x, tileY + y, color, alpha);
    }
  }
}

function generateTilesetPng() {
  const png = new PNG({ width: TILESET_WIDTH, height: TILESET_HEIGHT, colorType: 6 });
  for (let tileId = 0; tileId < TILECOUNT; tileId += 1) {
    fillTile(png, tileId, '#3f3b32', '#6f6247', { cracks: tileId % 2 === 0 });
  }

  for (let tileId = 0; tileId < 12; tileId += 1) {
    fillTile(png, tileId, tileId % 3 === 0 ? '#403a2f' : '#4a4437', '#81714f', { cracks: true });
    if (tileId % 4 === 0) drawTileLine(png, tileId, 4, 24, 27, 9, '#24221d', 1);
    if (tileId % 5 === 0) drawTileLine(png, tileId, 9, 5, 22, 20, '#2b2922', 1);
  }

  for (let tileId = 16; tileId < 32; tileId += 1) {
    fillTile(png, tileId, '#2d2d28', '#625941', { darkTop: tileId % 2 === 0, darkBottom: tileId % 3 === 0, cracks: true });
    drawTileLine(png, tileId, 0, 4 + (tileId % 9), 31, 8 + ((tileId * 3) % 12), '#151614', 2);
  }

  for (let tileId = 32; tileId < 48; tileId += 1) {
    fillTile(png, tileId, '#222620', '#59604c', { darkTop: true, darkBottom: true, cracks: true });
    drawTileLine(png, tileId, 2, 6 + (tileId % 7), 29, 12 + ((tileId * 2) % 9), '#111412', 2);
    drawTileLine(png, tileId, 4, 24 - (tileId % 8), 27, 26 - ((tileId * 3) % 10), '#3f4638', 1);
  }

  for (let tileId = 48; tileId < 64; tileId += 1) {
    fillTile(png, tileId, '#090b0b', '#23251e', { darkTop: true, darkBottom: true, cracks: true });
    drawTileLine(png, tileId, 0, 3 + (tileId % 4), 31, 7 + ((tileId * 2) % 5), '#77735b', 2);
    drawTileLine(png, tileId, 0, 9 + (tileId % 5), 31, 12 + ((tileId * 3) % 6), '#3c4033', 1);
    if (tileId % 3 === 0) drawTileLine(png, tileId, 5, 25, 23, 19, '#121513', 1);
  }

  for (let tileId = 80; tileId < 104; tileId += 1) {
    fillTile(png, tileId, '#4a4437', '#7a6a4d', { cracks: true });
    const ore = tileId % 4 === 0 ? '#8be9fd' : tileId % 5 === 0 ? '#d9f99d' : '#d7c38a';
    drawTileEllipse(png, tileId, 8 + (tileId % 15), 7 + ((tileId * 3) % 17), 2 + (tileId % 3), 2, ore);
    drawTileLine(png, tileId, 5, 25, 16, 11, '#2a2821', 1);
  }

  fs.mkdirSync(TILESET_DIR, { recursive: true });
  fs.writeFileSync(path.join(TILESET_DIR, TILESET_IMAGE_NAME), PNG.sync.write(png));
}

function writeTilesetTsx() {
  const propertiesFor = (ids, kind) => ids.map((id) => [
    ` <tile id="${id}">`,
    '  <properties>',
    `   <property name="kind" value="${kind}"/>`,
    '  </properties>',
    ' </tile>',
  ].join('\n')).join('\n');
  const tsx = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<tileset version="1.10" tiledversion="1.11.2" name="cave_interiors_v1" tilewidth="32" tileheight="32" tilecount="128" columns="16">',
    ` <image source="${TILESET_IMAGE_NAME}" width="${TILESET_WIDTH}" height="${TILESET_HEIGHT}"/>`,
    propertiesFor([0, 1, 2, 3, 4, 5, 6, 7], 'floor'),
    propertiesFor([16, 17, 18, 19, 20, 21, 22, 23], 'edge'),
    propertiesFor([32, 33, 34, 35, 36, 37, 38, 39], 'roof'),
    propertiesFor([48, 49, 50, 51, 52, 53, 54, 55], 'entrance'),
    propertiesFor([80, 81, 82, 83, 84, 85, 86, 87], 'detail'),
    '</tileset>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(TILESET_DIR, TILESET_TSX_NAME), tsx);
}

function fillSpriteEllipse(png, cx, cy, rx, ry, colorHex, alpha = 255, predicate = null) {
  const color = hexToRgb(colorHex);
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!predicate || predicate(x, y))) {
        setPixel(png, x, y, color, alpha);
      }
    }
  }
}

function fillSpriteRect(png, x1, y1, x2, y2, colorHex, alpha = 255) {
  const color = hexToRgb(colorHex);
  for (let y = Math.max(0, y1); y <= Math.min(png.height - 1, y2); y += 1) {
    for (let x = Math.max(0, x1); x <= Math.min(png.width - 1, x2); x += 1) {
      setPixel(png, x, y, color, alpha);
    }
  }
}

function drawSpriteLine(png, x1, y1, x2, y2, colorHex, width = 1, alpha = 255) {
  const color = hexToRgb(colorHex);
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2);
  for (let step = 0; step <= steps; step += 1) {
    const t = steps === 0 ? 0 : step / steps;
    const cx = x1 + (x2 - x1) * t;
    const cy = y1 + (y2 - y1) * t;
    for (let oy = -width; oy <= width; oy += 1) {
      for (let ox = -width; ox <= width; ox += 1) {
        if (ox * ox + oy * oy <= width * width) {
          setPixel(png, Math.round(cx + ox), Math.round(cy + oy), color, alpha);
        }
      }
    }
  }
}

function pointInSpritePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if (((a.y > y) !== (b.y > y)) && x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || 1) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function fillSpritePolygon(png, points, colorHex, alpha = 255) {
  const color = hexToRgb(colorHex);
  const minX = Math.floor(Math.min(...points.map((point) => point.x)));
  const maxX = Math.ceil(Math.max(...points.map((point) => point.x)));
  const minY = Math.floor(Math.min(...points.map((point) => point.y)));
  const maxY = Math.ceil(Math.max(...points.map((point) => point.y)));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInSpritePolygon(x + 0.5, y + 0.5, points)) setPixel(png, x, y, color, alpha);
    }
  }
}

function generateEntranceSpritePng() {
  const png = new PNG({ width: 128, height: 96, colorType: 6 });

  fillSpriteEllipse(png, 64, 87, 54, 8, '#050606', 130);
  const outerRock = [
    { x: 6, y: 84 },
    { x: 12, y: 59 },
    { x: 24, y: 39 },
    { x: 42, y: 25 },
    { x: 61, y: 18 },
    { x: 81, y: 20 },
    { x: 102, y: 34 },
    { x: 119, y: 59 },
    { x: 123, y: 84 },
  ];
  const midRock = [
    { x: 15, y: 82 },
    { x: 21, y: 60 },
    { x: 34, y: 43 },
    { x: 49, y: 33 },
    { x: 66, y: 28 },
    { x: 84, y: 31 },
    { x: 100, y: 45 },
    { x: 111, y: 64 },
    { x: 114, y: 83 },
  ];
  const mouth = [
    { x: 32, y: 82 },
    { x: 33, y: 62 },
    { x: 40, y: 49 },
    { x: 53, y: 40 },
    { x: 70, y: 38 },
    { x: 87, y: 43 },
    { x: 97, y: 57 },
    { x: 99, y: 82 },
  ];
  fillSpritePolygon(png, outerRock, '#343832', 255);
  fillSpritePolygon(png, midRock, '#62695a', 235);
  fillSpritePolygon(png, [
    { x: 20, y: 85 },
    { x: 28, y: 57 },
    { x: 47, y: 39 },
    { x: 65, y: 32 },
    { x: 88, y: 38 },
    { x: 106, y: 61 },
    { x: 110, y: 85 },
  ], '#3f453e', 255);
  fillSpritePolygon(png, mouth, '#030505', 255);
  fillSpritePolygon(png, [
    { x: 42, y: 81 },
    { x: 43, y: 64 },
    { x: 51, y: 54 },
    { x: 64, y: 50 },
    { x: 78, y: 52 },
    { x: 88, y: 64 },
    { x: 90, y: 81 },
  ], '#101211', 235);

  const stones = [
    { points: [[10, 72], [24, 58], [35, 68], [29, 84], [14, 85]], color: '#4e554b' },
    { points: [[23, 48], [38, 34], [52, 42], [40, 55]], color: '#6f7663' },
    { points: [[42, 26], [58, 18], [69, 29], [55, 38]], color: '#7c826b' },
    { points: [[70, 22], [86, 26], [93, 39], [76, 36]], color: '#555c50' },
    { points: [[96, 42], [113, 59], [110, 79], [95, 67]], color: '#6b725f' },
    { points: [[6, 80], [20, 78], [24, 92], [8, 92]], color: '#2b302c' },
    { points: [[105, 78], [123, 80], [122, 92], [108, 91]], color: '#343933' },
  ];
  stones.forEach(({ points, color }) => fillSpritePolygon(
    png,
    points.map(([x, y]) => ({ x, y })),
    color,
    220,
  ));

  for (let y = 14; y < png.height - 3; y += 1) {
    for (let x = 4; x < png.width - 4; x += 1) {
      const index = (y * png.width + x) * 4;
      if (png.data[index + 3] === 0) continue;
      const isMouth = pointInSpritePolygon(x + 0.5, y + 0.5, mouth);
      const n = hash2(x, y, 118);
      if (!isMouth && n > 0.9) setPixel(png, x, y, hexToRgb('#1f241f'), 255);
      else if (!isMouth && n < 0.06 && png.data[index + 3] > 220) setPixel(png, x, y, hexToRgb('#8c9177'), png.data[index + 3]);
      else if (isMouth && n > 0.94) setPixel(png, x, y, hexToRgb('#0b0d0c'), 255);
    }
  }

  drawSpriteLine(png, 17, 63, 34, 48, '#1a1d1a', 2, 230);
  drawSpriteLine(png, 43, 34, 59, 25, '#a0a58a', 1, 180);
  drawSpriteLine(png, 72, 30, 94, 44, '#252922', 2, 230);
  drawSpriteLine(png, 94, 65, 111, 75, '#242820', 2, 210);
  drawSpriteLine(png, 31, 84, 99, 84, '#151816', 2, 235);
  drawSpriteLine(png, 35, 58, 46, 47, '#0a0c0b', 2, 255);
  drawSpriteLine(png, 86, 48, 96, 61, '#080a09', 2, 255);

  fs.mkdirSync(TILESET_DIR, { recursive: true });
  fs.writeFileSync(path.join(TILESET_DIR, ENTRANCE_SPRITE_IMAGE_NAME), PNG.sync.write(png));
}

function writeEntranceSpriteTsx() {
  const tsx = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<tileset version="1.10" tiledversion="1.11.2" name="cave_entrance_small_v1" tilewidth="128" tileheight="96" tilecount="1" columns="1">',
    ` <image source="${ENTRANCE_SPRITE_IMAGE_NAME}" width="128" height="96"/>`,
    ' <tile id="0">',
    '  <properties>',
    '   <property name="type" value="cave_entrance_prop"/>',
    '  </properties>',
    ' </tile>',
    '</tileset>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(TILESET_DIR, ENTRANCE_SPRITE_TSX_NAME), tsx);
}

function objectProps(object) {
  return Object.fromEntries((object.properties ?? []).map((property) => [property.name, property.value]));
}

function setObjectProps(object, props) {
  const existing = objectProps(object);
  object.properties = Object.entries({ ...existing, ...props }).map(([name, value]) => ({
    name,
    type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'float' : 'string',
    value,
  }));
}

function getObjectPolygon(object) {
  if (Array.isArray(object?.polygon) && object.polygon.length >= 3) {
    return object.polygon.map((point) => ({
      x: object.x + point.x,
      y: object.y + point.y,
    }));
  }
  const x = Number(object?.x ?? 0);
  const y = Number(object?.y ?? 0);
  const width = Number(object?.width ?? 0);
  const height = Number(object?.height ?? 0);
  if (width > 0 && height > 0) {
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }
  return [{ x, y }];
}

function getBounds(points) {
  return {
    x1: Math.min(...points.map((point) => point.x)),
    y1: Math.min(...points.map((point) => point.y)),
    x2: Math.max(...points.map((point) => point.x)),
    y2: Math.max(...points.map((point) => point.y)),
  };
}

function getCenterFromBounds(bounds) {
  return {
    x: (bounds.x1 + bounds.x2) / 2,
    y: (bounds.y1 + bounds.y2) / 2,
  };
}

function normalizeCaveEntranceObject(entrance) {
  const width = Number(entrance?.width ?? 0);
  const height = Number(entrance?.height ?? 0);
  if (width > 0 && height > 0) return;

  const center = getCenterFromBounds(getBounds(getObjectPolygon(entrance)));
  entrance.x = Math.round(center.x);
  entrance.y = Math.round(center.y);
  entrance.polygon = [
    { x: -124, y: -42 },
    { x: -46, y: -92 },
    { x: 64, y: -84 },
    { x: 132, y: -22 },
    { x: 116, y: 70 },
    { x: -96, y: 76 },
    { x: -154, y: 12 },
  ];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const denominator = b.y - a.y;
    const safeDenominator = Math.abs(denominator) < 0.0001
      ? (denominator < 0 ? -0.0001 : 0.0001)
      : denominator;
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / safeDenominator + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function closestPointOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.0001) return { ...start };
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return { x: start.x + dx * t, y: start.y + dy * t };
}

function distanceToSegment(point, start, end) {
  const closest = closestPointOnSegment(point, start, end);
  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

function closestPointOnPolygon(point, polygon) {
  let closest = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const candidate = closestPointOnSegment(point, polygon[index], polygon[(index + 1) % polygon.length]);
    const candidateDistance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (candidateDistance < closestDistance) {
      closest = candidate;
      closestDistance = candidateDistance;
    }
  }
  return closest;
}

function distanceToPolyline(point, pathPoints) {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < pathPoints.length - 1; index += 1) {
    best = Math.min(best, distanceToSegment(point, pathPoints[index], pathPoints[index + 1]));
  }
  return best;
}

function inEllipse(point, ellipse) {
  const dx = (point.x - ellipse.x) / ellipse.rx;
  const dy = (point.y - ellipse.y) / ellipse.ry;
  return dx * dx + dy * dy <= 1;
}

function encodeLayer(data) {
  const raw = Buffer.alloc(data.length * 4);
  for (let index = 0; index < data.length; index += 1) raw.writeUInt32LE(data[index] >>> 0, index * 4);
  return zlib.deflateSync(raw, { level: 9 }).toString('base64');
}

function decodeLayerData(layer) {
  if (Array.isArray(layer?.data)) return layer.data.slice();
  if (layer?.encoding !== 'base64' || layer?.compression !== 'zlib') return [];
  const raw = zlib.inflateSync(Buffer.from(String(layer.data ?? '').trim(), 'base64'));
  const data = new Array(raw.length / 4);
  for (let index = 0; index < data.length; index += 1) data[index] = raw.readUInt32LE(index * 4);
  return data;
}

function parseTilesetTilecount(sourcePath) {
  const content = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf8') : '';
  const match = content.match(/tilecount="(\d+)"/);
  return match ? Number(match[1]) : 0;
}

function getTilesetTilecount(baseDir, tileset) {
  const sourcePath = path.resolve(baseDir, tileset.source);
  return parseTilesetTilecount(sourcePath) || 1;
}

function getNextFirstGid(map) {
  let next = 1;
  for (const tileset of map.tilesets ?? []) {
    const sourcePath = path.resolve(path.dirname(REGION_PATH), tileset.source);
    const tilecount = parseTilesetTilecount(sourcePath);
    next = Math.max(next, Number(tileset.firstgid) + tilecount);
  }
  return next;
}

function getNextFirstGidForTilesets(tilesets, baseDir) {
  let next = 1;
  for (const tileset of tilesets ?? []) {
    next = Math.max(next, Number(tileset.firstgid) + getTilesetTilecount(baseDir, tileset));
  }
  return next;
}

function getTilesetFirstGid(map, source) {
  return Number(map.tilesets.find((tileset) => tileset.source === source)?.firstgid ?? 0);
}

function ensureMapTileset(map, source) {
  const existing = (map.tilesets ?? []).find((tileset) => tileset.source === source || sourceMatches(tileset.source, source.split('/').pop()));
  if (existing) {
    existing.source = source;
    return Number(existing.firstgid);
  }
  const firstgid = getNextFirstGid(map);
  map.tilesets = [...(map.tilesets ?? []), { firstgid, source }];
  return firstgid;
}

function nextObjectId(map) {
  const nextId = Math.max(
    0,
    Number(map.nextobjectid ?? 0),
    ...(map.layers ?? []).flatMap((layer) => (layer.objects ?? []).map((object) => Number(object.id ?? 0))),
  );
  map.nextobjectid = nextId + 1;
  return nextId;
}

function upsertObject(layer, name, createObject) {
  let object = (layer.objects ?? []).find((candidate) => candidate.name === name);
  if (!object) {
    object = createObject();
    layer.objects = [...(layer.objects ?? []), object];
  }
  return object;
}

function makeTileLayer(name, data, id, visible = true, properties = [], width = 800, height = 800) {
  return {
    compression: 'zlib',
    data: encodeLayer(data),
    encoding: 'base64',
    height,
    id,
    name,
    opacity: 1,
    properties,
    type: 'tilelayer',
    visible,
    width,
    x: 0,
    y: 0,
  };
}

function makeObjectLayer(name, id, objects = [], properties = [], visible = true) {
  return {
    draworder: 'topdown',
    id,
    name,
    objects,
    offsetx: 0,
    offsety: 0,
    opacity: 1,
    properties,
    type: 'objectgroup',
    visible,
    x: 0,
    y: 0,
  };
}

function property(name, value, type = typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'float' : 'string') {
  return { name, type, value };
}

function generateCaveLayers(map, firstgid, collisionGid) {
  const width = map.width;
  const height = map.height;
  const floor = new Array(width * height).fill(0);
  const details = new Array(width * height).fill(0);
  const entrances = new Array(width * height).fill(0);
  const roofs = new Array(width * height).fill(0);
  const collision = new Array(width * height).fill(0);

  const cavesLayer = map.layers.find((layer) => layer.name === 'Caves');
  const entrance = cavesLayer?.objects?.find((object) => object.name === 'cave_entrance_01');
  const cave = cavesLayer?.objects?.find((object) => object.name === 'cave_01');
  if (!entrance || !cave) throw new Error('Missing cave_entrance_01 or cave_01 in Caves layer.');
  cavesLayer.offsetx = 0;
  cavesLayer.offsety = 0;
  normalizeCaveEntranceObject(entrance);

  setObjectProps(entrance, {
    type: 'cave_entrance',
    targetInteriorId: 'cave_01',
    caveId: 'cave_01',
    connectorWidth: CAVE_ENTRANCE_CONNECTOR_WIDTH,
    roofLayer: 'CaveRoofs',
  });
  setObjectProps(cave, {
    type: 'caveInterior',
    interiorId: 'cave_01',
    caveId: 'cave_01',
    displayName: 'Mountain Cave',
    interiorFocus: true,
    roofHide: true,
    roofLayer: 'CaveRoofs',
    connectorWidth: CAVE_ENTRANCE_CONNECTOR_WIDTH,
  });

  const entrancePolygon = getObjectPolygon(entrance);
  const cavePolygon = getObjectPolygon(cave);
  const entranceBounds = getBounds(entrancePolygon);
  const caveBounds = getBounds(cavePolygon);
  const entranceCenter = getCenterFromBounds(entranceBounds);
  const caveEntry = closestPointOnPolygon(entranceCenter, cavePolygon);
  const hub = { x: 15600, y: 13520 };
  const northRoom = { x: 15040, y: 12420 };
  const northeastRoom = { x: 20200, y: 13040 };
  const eastJunction = { x: 17600, y: 13760 };
  const eastRoom = { x: 19000, y: 14160 };
  const southBend = { x: 18600, y: 14500 };
  const southRoom = { x: 21600, y: 15120 };
  const deepRoom = { x: 23200, y: 15920 };

  const paths = [
    { width: 160, points: [entranceCenter, caveEntry, hub] },
    { width: 210, points: [hub, { x: 15320, y: 12920 }, northRoom] },
    { width: 230, points: [hub, eastJunction, eastRoom] },
    { width: 205, points: [eastJunction, { x: 19080, y: 13240 }, northeastRoom] },
    { width: 220, points: [hub, southBend, southRoom] },
    { width: 190, points: [southRoom, deepRoom] },
  ];
  const rooms = [
    { ...hub, rx: 430, ry: 320 },
    { ...northRoom, rx: 440, ry: 300 },
    { ...northeastRoom, rx: 520, ry: 320 },
    { ...eastRoom, rx: 560, ry: 340 },
    { ...southRoom, rx: 560, ry: 340 },
    { ...deepRoom, rx: 520, ry: 320 },
  ];

  const minCol = clamp(Math.floor((Math.min(caveBounds.x1, entranceBounds.x1) - 512) / TILE), 0, width - 1);
  const maxCol = clamp(Math.ceil((Math.max(caveBounds.x2, entranceBounds.x2) + 512) / TILE), 0, width - 1);
  const minRow = clamp(Math.floor((Math.min(caveBounds.y1, entranceBounds.y1) - 512) / TILE), 0, height - 1);
  const maxRow = clamp(Math.ceil((Math.max(caveBounds.y2, entranceBounds.y2) + 512) / TILE), 0, height - 1);

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const index = row * width + col;
      const point = { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
      const insideCave = pointInPolygon(point, cavePolygon);
      const insideEntrance = pointInPolygon(point, entrancePolygon);
      const insideConnector = distanceToSegment(point, entranceCenter, caveEntry) <= 86;
      const entranceMouth = (
        ((point.x - entranceCenter.x) / 170) ** 2
        + ((point.y - (entranceCenter.y + 10)) / 98) ** 2
      ) <= 1;
      const insidePath = paths.some((pathInfo) => (
        distanceToPolyline(point, pathInfo.points) <= pathInfo.width / 2
      ));
      const insideRoom = rooms.some((room) => inEllipse(point, room));
      const caveWalkable = insideCave && (insidePath || insideRoom);
      const entranceWalkable = insideEntrance || insideConnector || entranceMouth || distanceToSegment(point, entranceCenter, caveEntry) <= 104;
      if (!caveWalkable && !entranceWalkable) continue;

      const variation = Math.floor(hash2(col, row, 12) * 8);
      if (caveWalkable) {
        floor[index] = firstgid + variation;

        if (hash2(col, row, 44) > 0.88) {
          details[index] = firstgid + 80 + Math.floor(hash2(col, row, 45) * 8);
        }
      }
      if (entranceWalkable) {
        entrances[index] = firstgid + variation;
      }
    }
  }

  const collisionTile = collisionGid || firstgid + 16;
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const index = row * width + col;
      if (floor[index]) continue;
      const point = { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
      if (pointInPolygon(point, cavePolygon)) collision[index] = collisionTile;
    }
  }

  for (let row = minRow + 1; row < maxRow; row += 1) {
    for (let col = minCol + 1; col < maxCol; col += 1) {
      const index = row * width + col;
      if (!floor[index]) continue;
      const neighborIndexes = [
        index - 1,
        index + 1,
        index - width,
        index + width,
        index - width - 1,
        index - width + 1,
        index + width - 1,
        index + width + 1,
      ];
      if (neighborIndexes.some((neighborIndex) => !floor[neighborIndex])) {
        details[index] = firstgid + 16 + Math.floor(hash2(col, row, 77) * 8);
      }
    }
  }

  return { floor, details, entrances, roofs, collision };
}

function upsertGeneratedLayers(map, layersToAdd, objectLayersToAdd) {
  const preservedObjectLayers = new Map();
  for (const layer of map.layers) {
    if (objectLayersToAdd.some((candidate) => candidate.name === layer.name)) preservedObjectLayers.set(layer.name, layer);
  }

  map.layers = map.layers.filter((layer) => !GENERATED_LAYER_NAMES.has(layer.name) && !objectLayersToAdd.some((candidate) => candidate.name === layer.name));

  const insertBefore = (name, layers) => {
    const index = map.layers.findIndex((layer) => layer.name === name);
    if (index >= 0) map.layers.splice(index, 0, ...layers);
    else map.layers.push(...layers);
  };

  insertBefore('Decor', [layersToAdd.caveInteriors, layersToAdd.caveDetails]);
  insertBefore('Collision', [layersToAdd.caveRoofs, layersToAdd.caveEntrances, layersToAdd.caveCollision]);

  const cavesIndex = map.layers.findIndex((layer) => layer.name === 'Caves');
  const objectLayers = objectLayersToAdd.map((layer) => {
    const preserved = preservedObjectLayers.get(layer.name);
    return preserved ? { ...layer, objects: preserved.objects ?? [] } : layer;
  });
  if (cavesIndex >= 0) map.layers.splice(cavesIndex + 1, 0, ...objectLayers);
  else map.layers.push(...objectLayers);
}

function sourceMatches(source, suffix) {
  return String(source ?? '').replace(/\\/g, '/').endsWith(suffix);
}

function getRegionTileOffset(map) {
  const match = path.basename(REGION_PATH).match(/region_(\d+)_(\d+)/);
  return {
    x: Number(match?.[1] ?? 0) * map.width,
    y: Number(match?.[2] ?? 0) * map.height,
  };
}

function getLayerProperty(layer, name) {
  return (layer?.properties ?? []).find((propertyItem) => propertyItem.name === name)?.value;
}

function getObjectBoundsForLayer(object) {
  if (Array.isArray(object?.polygon) && object.polygon.length >= 3) {
    return getBounds(getObjectPolygon(object));
  }
  return {
    x1: Number(object?.x ?? 0),
    y1: Number(object?.y ?? 0),
    x2: Number(object?.x ?? 0) + Number(object?.width ?? 0),
    y2: Number(object?.y ?? 0) + Number(object?.height ?? 0),
  };
}

function cloneObjectForChunk(object, regionOffsetPixels, chunkOffsetPixels) {
  return {
    ...object,
    x: Number(object?.x ?? 0) + regionOffsetPixels.x - chunkOffsetPixels.x,
    y: Number(object?.y ?? 0) + regionOffsetPixels.y - chunkOffsetPixels.y,
  };
}

function objectCenterTile(object, regionTileOffset) {
  const bounds = getObjectBoundsForLayer(object);
  const center = getCenterFromBounds(bounds);
  return {
    x: Math.floor(center.x / TILE) + regionTileOffset.x,
    y: Math.floor(center.y / TILE) + regionTileOffset.y,
  };
}

function getNextLayerId(map) {
  return Math.max(
    Number(map.nextlayerid ?? 0),
    0,
    ...(map.layers ?? []).map((layer) => Number(layer.id ?? 0)),
  ) + 1;
}

function takeNextLayerId(state) {
  const id = state.nextLayerId;
  state.nextLayerId += 1;
  return id;
}

function insertBeforeLayer(layers, targetName, layersToInsert) {
  const index = layers.findIndex((layer) => (typeof layer === 'string' ? layer : layer.name) === targetName);
  if (index >= 0) layers.splice(index, 0, ...layersToInsert);
  else layers.push(...layersToInsert);
}

function insertAfterLayer(layers, targetName, layersToInsert) {
  const index = layers.findIndex((layer) => (typeof layer === 'string' ? layer : layer.name) === targetName);
  if (index >= 0) layers.splice(index + 1, 0, ...layersToInsert);
  else layers.push(...layersToInsert);
}

function remapCaveGid(gid, regionFirstgid, chunkFirstgid) {
  if (gid >= regionFirstgid && gid < regionFirstgid + TILECOUNT) {
    return chunkFirstgid + (gid - regionFirstgid);
  }
  return gid;
}

function getSourceLayerInfo(regionMap) {
  return [
    { name: 'CaveInteriors', visible: true },
    { name: 'CaveDetails', visible: true },
    { name: 'CaveRoofs', visible: false },
    { name: 'CaveEntrances', visible: false },
    { name: 'CaveCollision', visible: false },
  ]
    .map((info) => {
      const layer = regionMap.layers.find((candidate) => candidate.name === info.name);
      return layer
        ? {
          ...info,
          properties: layer.properties ?? [],
          data: decodeLayerData(layer),
        }
        : null;
    })
    .filter(Boolean);
}

function copyRegionLayerToChunk(sourceLayer, regionMap, chunkInfo, regionTileOffset, regionFirstgid, chunkFirstgid) {
  const data = new Array(chunkInfo.width * chunkInfo.height).fill(0);
  let hasTiles = false;
  for (let row = 0; row < chunkInfo.height; row += 1) {
    const localRow = chunkInfo.y + row - regionTileOffset.y;
    if (localRow < 0 || localRow >= regionMap.height) continue;
    for (let col = 0; col < chunkInfo.width; col += 1) {
      const localCol = chunkInfo.x + col - regionTileOffset.x;
      if (localCol < 0 || localCol >= regionMap.width) continue;
      const gid = sourceLayer.data[localRow * regionMap.width + localCol];
      if (!gid) continue;
      data[row * chunkInfo.width + col] = remapCaveGid(gid, regionFirstgid, chunkFirstgid);
      hasTiles = true;
    }
  }
  return hasTiles ? data : null;
}

function getObjectsForChunk(sourceLayer, chunkInfo, regionTileOffset) {
  const regionOffsetPixels = {
    x: regionTileOffset.x * TILE,
    y: regionTileOffset.y * TILE,
  };
  const chunkOffsetPixels = {
    x: chunkInfo.x * TILE,
    y: chunkInfo.y * TILE,
  };
  return (sourceLayer?.objects ?? [])
    .filter((object) => {
      const tile = objectCenterTile(object, regionTileOffset);
      return tile.x >= chunkInfo.x
        && tile.y >= chunkInfo.y
        && tile.x < chunkInfo.x + chunkInfo.width
        && tile.y < chunkInfo.y + chunkInfo.height;
    })
    .map((object) => cloneObjectForChunk(object, regionOffsetPixels, chunkOffsetPixels));
}

function makeChunkObjectLayer(sourceLayer, id, objects) {
  return makeObjectLayer(
    sourceLayer.name,
    id,
    objects,
    sourceLayer.properties ?? [],
    sourceLayer.visible !== false,
  );
}

function ensureChunkTilesetSource(index, source, tsxName) {
  const existing = (index.tilesets ?? []).find((tileset) => (
    tileset.source === source
      || sourceMatches(tileset.source, `/tilesets/${tsxName}`)
      || sourceMatches(tileset.source, tsxName)
  ));
  if (existing) {
    existing.source = source;
    return Number(existing.firstgid);
  }
  const firstgid = getNextFirstGidForTilesets(index.tilesets ?? [], CHUNK_DIR);
  index.tilesets = [...(index.tilesets ?? []), { firstgid, source }];
  return firstgid;
}

function ensureChunkTileset(index) {
  return ensureChunkTilesetSource(index, CHUNK_TILESET_SOURCE, TILESET_TSX_NAME);
}

function remapSingleTilesetGid(gid, regionFirstgid, chunkFirstgid, tilecount = 1) {
  if (gid >= regionFirstgid && gid < regionFirstgid + tilecount) {
    return chunkFirstgid + (gid - regionFirstgid);
  }
  return gid;
}

function remapCaveEntrancePropGid(object, regionEntranceFirstgid, chunkEntranceFirstgid) {
  const gid = Number(object?.gid ?? 0);
  if (!gid) return object;
  return {
    ...object,
    gid: remapSingleTilesetGid(gid, regionEntranceFirstgid, chunkEntranceFirstgid, 1),
  };
}

function upsertManagedChunkObjects(chunkMap, sourceLayer, objects, state, managedNames) {
  const names = new Set(managedNames);
  let layer = chunkMap.layers.find((candidate) => candidate.name === sourceLayer.name && candidate.type === 'objectgroup');
  if (!layer && objects.length === 0) return false;
  if (!layer) {
    layer = makeChunkObjectLayer(sourceLayer, takeNextLayerId(state), []);
    insertAfterLayer(chunkMap.layers, sourceLayer.name === 'Props' ? 'Buildings' : 'InteriorZones', [layer]);
  }
  const before = JSON.stringify(layer.objects ?? []);
  layer.visible = sourceLayer.visible !== false;
  layer.opacity = sourceLayer.opacity ?? 1;
  layer.properties = sourceLayer.properties ?? layer.properties;
  layer.objects = [
    ...(layer.objects ?? []).filter((object) => !names.has(String(object?.name ?? ''))),
    ...objects,
  ];
  return JSON.stringify(layer.objects ?? []) !== before;
}

function upsertChunkIndexMetadata(index) {
  const tileLayerNames = (index.layers ?? []).filter((name) => !GENERATED_LAYER_NAMES.has(name));
  insertBeforeLayer(tileLayerNames, 'Decor', ['CaveInteriors', 'CaveDetails']);
  insertBeforeLayer(tileLayerNames, 'Collision', ['CaveRoofs', 'CaveEntrances', 'CaveCollision']);
  index.layers = tileLayerNames;

  const objectLayerNames = (index.objectLayers ?? []).filter((name) => !CHUNK_OBJECT_LAYER_NAMES.has(name));
  insertAfterLayer(objectLayerNames, 'InteriorZones', ['Caves', 'CaveSpawns', 'CaveProps']);
  if (!objectLayerNames.includes('Props')) insertAfterLayer(objectLayerNames, 'Buildings', ['Props']);
  index.objectLayers = objectLayerNames;
}

function patchRuntimeChunks(regionMap, regionFirstgid, regionEntranceFirstgid) {
  if (!fs.existsSync(CHUNK_INDEX_PATH)) return;

  const index = JSON.parse(fs.readFileSync(CHUNK_INDEX_PATH, 'utf8'));
  index.version = CHUNK_RUNTIME_VERSION;
  const chunkFirstgid = ensureChunkTileset(index);
  const chunkEntranceFirstgid = ensureChunkTilesetSource(index, ENTRANCE_SPRITE_CHUNK_SOURCE, ENTRANCE_SPRITE_TSX_NAME);
  upsertChunkIndexMetadata(index);

  const regionTileOffset = getRegionTileOffset(regionMap);
  const sourceLayers = getSourceLayerInfo(regionMap);
  const propsSourceLayer = regionMap.layers.find((layer) => layer.name === 'Props') ?? {
    name: 'Props',
    type: 'objectgroup',
    objects: [],
    properties: [],
    visible: true,
  };
  const objectSourceLayers = [...CHUNK_OBJECT_LAYER_NAMES]
    .map((name) => regionMap.layers.find((layer) => layer.name === name) ?? {
      name,
      type: 'objectgroup',
      objects: [],
      properties: [
        property('interiorId', 'cave_01'),
        property('caveId', 'cave_01'),
      ],
      visible: true,
    });

  let patchedChunks = 0;
  for (const chunkInfo of index.chunks ?? []) {
    const chunkPath = path.join(CHUNK_DIR, chunkInfo.file);
    if (!fs.existsSync(chunkPath)) continue;
    const chunkMap = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
    const state = { nextLayerId: getNextLayerId(chunkMap) };
    const tileLayersToInsert = sourceLayers
      .map((sourceLayer) => {
        const data = copyRegionLayerToChunk(sourceLayer, regionMap, chunkInfo, regionTileOffset, regionFirstgid, chunkFirstgid);
        return data
          ? makeTileLayer(
            sourceLayer.name,
            data,
            takeNextLayerId(state),
            sourceLayer.visible,
            sourceLayer.properties,
            chunkInfo.width,
            chunkInfo.height,
          )
          : null;
      })
      .filter(Boolean);

    const objectLayersToInsert = objectSourceLayers
      .map((sourceLayer) => {
        const objects = getObjectsForChunk(sourceLayer, chunkInfo, regionTileOffset);
        return objects.length
          ? makeChunkObjectLayer(sourceLayer, takeNextLayerId(state), objects)
          : null;
      })
      .filter(Boolean);

    const caveEntranceProps = getObjectsForChunk({
      ...propsSourceLayer,
      objects: (propsSourceLayer.objects ?? []).filter((object) => object.name === CAVE_ENTRANCE_PROP_NAME),
    }, chunkInfo, regionTileOffset)
      .map((object) => remapCaveEntrancePropGid(object, regionEntranceFirstgid, chunkEntranceFirstgid));

    const originalLayerCount = (chunkMap.layers ?? []).length;
    chunkMap.layers = (chunkMap.layers ?? []).filter((layer) => (
      !GENERATED_LAYER_NAMES.has(layer.name)
        && !CHUNK_OBJECT_LAYER_NAMES.has(layer.name)
    ));
    const removedGeneratedLayers = chunkMap.layers.length !== originalLayerCount;

    if (tileLayersToInsert.length) {
      const interiorLayers = tileLayersToInsert.filter((layer) => ['CaveInteriors', 'CaveDetails'].includes(layer.name));
      const roofLayers = tileLayersToInsert.filter((layer) => ['CaveRoofs', 'CaveEntrances', 'CaveCollision'].includes(layer.name));
      insertBeforeLayer(chunkMap.layers, 'Decor', interiorLayers);
      insertBeforeLayer(chunkMap.layers, 'Collision', roofLayers);
    }
    if (objectLayersToInsert.length) insertAfterLayer(chunkMap.layers, 'InteriorZones', objectLayersToInsert);
    const changedProps = upsertManagedChunkObjects(chunkMap, propsSourceLayer, caveEntranceProps, state, [CAVE_ENTRANCE_PROP_NAME]);

    const changed = removedGeneratedLayers || tileLayersToInsert.length > 0 || objectLayersToInsert.length > 0 || changedProps;
    if (changed) {
      chunkMap.nextlayerid = state.nextLayerId;
      fs.writeFileSync(chunkPath, JSON.stringify(chunkMap));
      patchedChunks += 1;
    }
  }

  fs.writeFileSync(CHUNK_INDEX_PATH, JSON.stringify(index));
  console.log(`Patched ${patchedChunks} runtime chunks with cave firstgid ${chunkFirstgid} and entrance firstgid ${chunkEntranceFirstgid}`);
}

function getOrCreateObjectLayer(map, name, takeId, afterName = 'Buildings') {
  let layer = map.layers.find((candidate) => candidate.name === name && candidate.type === 'objectgroup');
  if (layer) return layer;
  layer = makeObjectLayer(name, takeId(), [], [], true);
  const index = map.layers.findIndex((candidate) => candidate.name === afterName);
  if (index >= 0) map.layers.splice(index + 1, 0, layer);
  else map.layers.push(layer);
  return layer;
}

function upsertCaveEntranceProp(map, entranceFirstgid, takeId) {
  const cavesLayer = map.layers.find((layer) => layer.name === 'Caves');
  const entrance = cavesLayer?.objects?.find((object) => object.name === 'cave_entrance_01');
  if (!entrance) throw new Error('Missing cave_entrance_01 when placing cave entrance prop.');

  const entranceCenter = getCenterFromBounds(getBounds(getObjectPolygon(entrance)));
  const propsLayer = getOrCreateObjectLayer(map, 'Props', takeId, 'Buildings');
  const prop = upsertObject(propsLayer, CAVE_ENTRANCE_PROP_NAME, () => ({
    id: nextObjectId(map),
    name: CAVE_ENTRANCE_PROP_NAME,
    type: '',
    gid: entranceFirstgid,
    x: entranceCenter.x - CAVE_ENTRANCE_DRAW_WIDTH / 2,
    y: entranceCenter.y + CAVE_ENTRANCE_DRAW_HEIGHT * 0.45,
    width: CAVE_ENTRANCE_DRAW_WIDTH,
    height: CAVE_ENTRANCE_DRAW_HEIGHT,
    rotation: 0,
    visible: true,
    properties: [],
  }));
  prop.gid = entranceFirstgid;
  prop.x = entranceCenter.x - CAVE_ENTRANCE_DRAW_WIDTH / 2;
  prop.y = entranceCenter.y + CAVE_ENTRANCE_DRAW_HEIGHT * 0.45;
  prop.width = CAVE_ENTRANCE_DRAW_WIDTH;
  prop.height = CAVE_ENTRANCE_DRAW_HEIGHT;
  prop.rotation = 0;
  prop.visible = true;
  setObjectProps(prop, {
    type: 'cave_entrance_prop',
    displayName: 'Cave Entrance',
    caveId: 'cave_01',
    targetInteriorId: 'cave_01',
  });
}

function patchRegionMap() {
  const map = JSON.parse(fs.readFileSync(REGION_PATH, 'utf8'));
  const firstgid = ensureMapTileset(map, TILESET_SOURCE);
  const entranceFirstgid = ensureMapTileset(map, ENTRANCE_SPRITE_SOURCE);

  const ids = [];
  let nextLayerId = Math.max(Number(map.nextlayerid ?? 0), ...map.layers.map((layer) => Number(layer.id ?? 0))) + 1;
  const takeId = () => {
    const id = nextLayerId;
    ids.push(id);
    nextLayerId += 1;
    return id;
  };

  const layerProps = [
    property('interiorId', 'cave_01'),
    property('caveId', 'cave_01'),
    property('roofLayer', 'CaveRoofs'),
  ];
  const collisionGid = getTilesetFirstGid(map, COLLISION_TILESET_SOURCE);
  const { floor, details, entrances, roofs, collision } = generateCaveLayers(map, firstgid, collisionGid);
  upsertCaveEntranceProp(map, entranceFirstgid, takeId);
  const layersToAdd = {
    caveInteriors: makeTileLayer('CaveInteriors', floor, takeId(), true, [
      ...layerProps,
      property('type', 'caveInterior'),
    ]),
    caveDetails: makeTileLayer('CaveDetails', details, takeId(), true, [
      ...layerProps,
      property('type', 'caveInteriorDetails'),
    ]),
    caveRoofs: makeTileLayer('CaveRoofs', roofs, takeId(), false, [
      ...layerProps,
      property('type', 'caveRoof'),
    ]),
    caveEntrances: makeTileLayer('CaveEntrances', entrances, takeId(), false, [
      ...layerProps,
      property('type', 'caveEntrance'),
    ]),
    caveCollision: makeTileLayer('CaveCollision', collision, takeId(), false, [
      ...layerProps,
      property('type', 'caveCollision'),
    ]),
  };
  const objectLayers = [
    makeObjectLayer('CaveSpawns', takeId(), [], [
      property('interiorId', 'cave_01'),
      property('caveId', 'cave_01'),
      property('type', 'caveSpawns'),
    ], true),
    makeObjectLayer('CaveProps', takeId(), [], [
      property('interiorId', 'cave_01'),
      property('caveId', 'cave_01'),
      property('type', 'caveProps'),
    ], true),
  ];

  upsertGeneratedLayers(map, layersToAdd, objectLayers);
  map.nextlayerid = Math.max(nextLayerId, ...ids) + 1;
  fs.writeFileSync(REGION_PATH, `${JSON.stringify(map, null, 2)}\n`);
  console.log(`Generated cave tileset at ${path.relative(ROOT, path.join(TILESET_DIR, TILESET_IMAGE_NAME))}`);
  console.log(`Generated cave entrance sprite at ${path.relative(ROOT, path.join(TILESET_DIR, ENTRANCE_SPRITE_IMAGE_NAME))}`);
  console.log(`Patched ${path.relative(ROOT, REGION_PATH)} with cave firstgid ${firstgid}`);
  return { map, firstgid, entranceFirstgid };
}

generateTilesetPng();
writeTilesetTsx();
generateEntranceSpritePng();
writeEntranceSpriteTsx();
const patchedRegion = patchRegionMap();
patchRuntimeChunks(patchedRegion.map, patchedRegion.firstgid, patchedRegion.entranceFirstgid);
