import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';
import { makeTamziaBanditForestV2Artwork } from './tamzia-forest-artwork-v2.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 32;
const REGION_TILES = 800;
const REGION_GRID = 5;
const REGION_PIXEL_SIZE = REGION_TILES * TILE;
const MAP_ID = 'continent_01_region_0_0';
const REGION_DIR = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions');
const MAP_PATH = path.join(REGION_DIR, `${MAP_ID}.tmj`);
const ASSET_TILESET_DIR = path.join(ROOT, 'public/assets/tilesets');
const PROJECT_TILESET_DIR = path.join(ROOT, 'public/tilesets');
const CONTINENT_TILESET_DIR = path.join(ROOT, 'public/maps/world_map/continents/continent_01/tilesets');

const FOREST_SHEET_NAME = 'tamzia_forest_v1';
const BANDIT_SHEET_NAME = 'tamzia_bandit_forest_v1';
const TARGET_LAYER_NAME = 'tamzia_bandit_forest';
const AREA_OBJECT_NAME = 'tamzia_bandit_forest';
const GENERATED_BY = BANDIT_SHEET_NAME;
const FOREST_MAP_TILESET_SOURCE = `../tilesets/${FOREST_SHEET_NAME}.tsx`;
const BANDIT_MAP_TILESET_SOURCE = `../tilesets/${BANDIT_SHEET_NAME}.tsx`;

const FOREST_ANIMATION_FRAMES = 8;
const BANDIT_FRAME_WIDTH = 128;
const BANDIT_FRAME_HEIGHT = 128;
const BANDIT_COLUMNS = 5;
const BANDIT_ROWS = 4;
const BANDIT_TILECOUNT = BANDIT_COLUMNS * BANDIT_ROWS;
const TILED_GID_MASK = 0x1fffffff;

const TREE_TILES = [
  { key: 'round_oak', id: 0, width: 128, height: 160, weight: 12, displayName: 'Tamzia Weathered Oak' },
  { key: 'pine', id: 8, width: 112, height: 160, weight: 18, displayName: 'Dark Pine' },
  { key: 'birch', id: 16, width: 96, height: 144, weight: 8, displayName: 'Scarred Birch' },
  { key: 'deep_oak', id: 24, width: 128, height: 160, weight: 21, displayName: 'Deep Oak' },
  { key: 'young_tree', id: 32, width: 84, height: 120, weight: 15, displayName: 'Young Thicket Tree' },
  { key: 'cedar', id: 40, width: 112, height: 152, weight: 16, displayName: 'Rough Cedar' },
];

const FOREST_DETAIL_TILES = [
  { key: 'bramble_bush', id: 48, width: 74, height: 70, weight: 20, displayName: 'Bramble Bush' },
  { key: 'round_bush', id: 49, width: 70, height: 62, weight: 12, displayName: 'Low Bush' },
  { key: 'fern_cluster', id: 50, width: 58, height: 58, weight: 10, displayName: 'Fern Cluster' },
  { key: 'grass_tuft', id: 51, width: 48, height: 44, weight: 18, displayName: 'Trampled Grass' },
  { key: 'leaf_patch', id: 52, width: 78, height: 42, weight: 16, displayName: 'Leaf Litter' },
  { key: 'mushrooms', id: 53, width: 42, height: 36, weight: 3, displayName: 'Mushrooms' },
  { key: 'moss_rock', id: 54, width: 54, height: 42, weight: 7, displayName: 'Mossy Stone' },
  { key: 'fallen_log', id: 55, width: 90, height: 46, weight: 13, displayName: 'Cut Fallen Log' },
  { key: 'stump', id: 56, width: 42, height: 44, weight: 13, displayName: 'Axe-Cut Stump' },
  { key: 'forest_shadow', id: 58, width: 88, height: 40, weight: 10, displayName: 'Dark Leaf Shadow' },
  { key: 'ivy_patch', id: 59, width: 66, height: 42, weight: 7, displayName: 'Ivy Patch' },
];

const BANDIT_DECOR_TILES = [
  { key: 'trail_scuff', id: 0, width: 118, height: 44, weight: 18, displayName: 'Bandit Trail Scuff', tier: 0 },
  { key: 'broken_cart', id: 1, width: 116, height: 74, weight: 3, displayName: 'Broken Caravan Cart', tier: 1 },
  { key: 'loot_crates', id: 2, width: 78, height: 58, weight: 7, displayName: 'Stolen Crates', tier: 1 },
  { key: 'sack_pile', id: 3, width: 68, height: 48, weight: 8, displayName: 'Stolen Sack Pile', tier: 1 },
  { key: 'warning_stakes', id: 4, width: 78, height: 86, weight: 6, displayName: 'Warning Stakes', tier: 2 },
  { key: 'rag_banner', id: 5, width: 58, height: 92, weight: 5, displayName: 'Ragged Bandit Marker', tier: 2 },
  { key: 'snare_trap', id: 6, width: 66, height: 44, weight: 8, displayName: 'Hidden Snare', tier: 1 },
  { key: 'lookout_cache', id: 7, width: 92, height: 74, weight: 4, displayName: 'Bandit Lookout Cache', tier: 2 },
  { key: 'boot_tracks', id: 8, width: 96, height: 44, weight: 16, displayName: 'Boot Tracks', tier: 0 },
  { key: 'cut_logs', id: 9, width: 94, height: 48, weight: 10, displayName: 'Cut Log Pile', tier: 0 },
  { key: 'cold_firepit', id: 10, width: 68, height: 44, weight: 4, displayName: 'Smoldering Bandit Fire', tier: 2 },
  { key: 'rope_marker', id: 11, width: 74, height: 42, weight: 7, displayName: 'Rope Marker', tier: 1 },
];

const AVOID_TILE_LAYERS = [
  'Water',
  'RiverFlow',
  'WaterEdges',
  'WaterFX',
  'Roads',
  'Buildings',
  'CityRoofs',
  'CityInteriors',
  'CaveInteriors',
  'CaveDetails',
  'CaveEntrances',
  'Collision',
  'CaveCollision',
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value, pretty = false) {
  writeFileSync(filePath, `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`, 'utf8');
}

function prop(name, type, value) {
  return { name, type, value };
}

function getProperties(object) {
  return Object.fromEntries((object?.properties ?? []).map((property) => [property.name, property.value]));
}

function hexToRgba(hex, alpha = 255) {
  const clean = String(hex).replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function blendPixel(png, x, y, rgba) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= png.width || py >= png.height) return;
  const index = (py * png.width + px) * 4;
  const srcAlpha = rgba[3] / 255;
  const dstAlpha = png.data[index + 3] / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
  if (outAlpha <= 0) return;

  png.data[index] = Math.round((rgba[0] * srcAlpha + png.data[index] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  png.data[index + 1] = Math.round((rgba[1] * srcAlpha + png.data[index + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  png.data[index + 2] = Math.round((rgba[2] * srcAlpha + png.data[index + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  png.data[index + 3] = Math.round(outAlpha * 255);
}

function rect(png, x, y, width, height, color, alpha = 255) {
  const rgba = hexToRgba(color, alpha);
  const startX = Math.round(x);
  const startY = Math.round(y);
  const endX = Math.round(x + width);
  const endY = Math.round(y + height);
  for (let yy = startY; yy < endY; yy += 1) {
    for (let xx = startX; xx < endX; xx += 1) blendPixel(png, xx, yy, rgba);
  }
}

function ellipse(png, cx, cy, rx, ry, color, alpha = 255) {
  const rgba = hexToRgba(color, alpha);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) blendPixel(png, x, y, rgba);
    }
  }
}

function line(png, x1, y1, x2, y2, size, color, alpha = 255) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    rect(png, x1 + (x2 - x1) * t - size / 2, y1 + (y2 - y1) * t - size / 2, size, size, color, alpha);
  }
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];
    if (((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonFill(png, points, color, alpha = 255) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));
  const rgba = hexToRgba(color, alpha);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon({ x, y }, points)) blendPixel(png, x, y, rgba);
    }
  }
}

function tileOrigin(tileId) {
  return {
    x: (tileId % BANDIT_COLUMNS) * BANDIT_FRAME_WIDTH,
    y: Math.floor(tileId / BANDIT_COLUMNS) * BANDIT_FRAME_HEIGHT,
  };
}

function drawCrate(png, x, y, width, height) {
  rect(png, x, y, width, height, '#5a3b24', 255);
  rect(png, x + 3, y + 3, width - 6, height - 6, '#8b5a31', 235);
  rect(png, x + 6, y + 7, width - 12, 4, '#3d281b', 180);
  rect(png, x + 6, y + height - 10, width - 12, 4, '#3d281b', 160);
  line(png, x + 7, y + height - 8, x + width - 8, y + 7, 3, '#3b2517', 170);
}

function drawSack(png, x, y, width, height, color = '#a68a62') {
  ellipse(png, x + width / 2, y + height * 0.56, width / 2, height / 2, '#4a3424', 90);
  ellipse(png, x + width / 2, y + height * 0.5, width / 2 - 2, height / 2 - 1, color, 245);
  rect(png, x + width * 0.35, y + 5, width * 0.3, 5, '#6b4a31', 220);
  line(png, x + 7, y + height * 0.56, x + width - 8, y + height * 0.48, 2, '#69513a', 115);
}

function drawBanditTile(png, tile) {
  const { x: ox, y: oy } = tileOrigin(tile.id);
  if (tile.key === 'trail_scuff') {
    ellipse(png, ox + 64, oy + 76, 54, 16, '#5a4a34', 90);
    for (let i = 0; i < 13; i += 1) {
      const x = ox + 17 + i * 8;
      const y = oy + 68 + Math.sin(i) * 5;
      ellipse(png, x, y, 7, 3, i % 2 ? '#7b633e' : '#3d3327', 95);
    }
    line(png, ox + 18, oy + 82, ox + 112, oy + 68, 2, '#31291f', 80);
  } else if (tile.key === 'broken_cart') {
    ellipse(png, ox + 64, oy + 92, 52, 13, '#000000', 45);
    rect(png, ox + 35, oy + 55, 48, 18, '#6f492b', 245);
    rect(png, ox + 39, oy + 59, 40, 6, '#9a6a39', 220);
    line(png, ox + 30, oy + 72, ox + 94, oy + 46, 5, '#4a301d', 235);
    line(png, ox + 41, oy + 77, ox + 112, oy + 78, 4, '#5b3820', 225);
    ellipse(png, ox + 35, oy + 79, 13, 13, '#2a211a', 240);
    ellipse(png, ox + 35, oy + 79, 8, 8, '#7a4d2b', 230);
    ellipse(png, ox + 92, oy + 76, 10, 10, '#2a211a', 220);
    line(png, ox + 91, oy + 52, ox + 107, oy + 40, 3, '#3a2618', 220);
  } else if (tile.key === 'loot_crates') {
    ellipse(png, ox + 63, oy + 88, 36, 10, '#000000', 42);
    drawCrate(png, ox + 33, oy + 56, 32, 27);
    drawCrate(png, ox + 58, oy + 63, 35, 25);
    drawCrate(png, ox + 49, oy + 42, 29, 25);
  } else if (tile.key === 'sack_pile') {
    ellipse(png, ox + 64, oy + 88, 36, 10, '#000000', 42);
    drawSack(png, ox + 33, oy + 59, 34, 31);
    drawSack(png, ox + 55, oy + 52, 38, 34, '#b09162');
    drawSack(png, ox + 63, oy + 66, 32, 25, '#8e744f');
  } else if (tile.key === 'warning_stakes') {
    ellipse(png, ox + 64, oy + 99, 34, 10, '#000000', 45);
    line(png, ox + 46, oy + 92, ox + 49, oy + 40, 5, '#4e2f1d', 250);
    line(png, ox + 66, oy + 97, ox + 62, oy + 31, 5, '#5c3923', 250);
    line(png, ox + 84, oy + 91, ox + 88, oy + 48, 5, '#4a2d1d', 250);
    polygonFill(png, [{ x: ox + 43, y: oy + 39 }, { x: ox + 51, y: oy + 28 }, { x: ox + 53, y: oy + 41 }], '#271a13', 255);
    polygonFill(png, [{ x: ox + 58, y: oy + 31 }, { x: ox + 65, y: oy + 18 }, { x: ox + 70, y: oy + 33 }], '#271a13', 255);
    rect(png, ox + 52, oy + 56, 32, 10, '#5b1f1d', 230);
    rect(png, ox + 55, oy + 58, 24, 3, '#8a3a2c', 170);
  } else if (tile.key === 'rag_banner') {
    ellipse(png, ox + 64, oy + 102, 20, 7, '#000000', 42);
    line(png, ox + 59, oy + 100, ox + 59, oy + 31, 5, '#4b301e', 245);
    line(png, ox + 59, oy + 35, ox + 92, oy + 41, 3, '#2c2119', 220);
    polygonFill(png, [
      { x: ox + 62, y: oy + 37 },
      { x: ox + 94, y: oy + 42 },
      { x: ox + 86, y: oy + 59 },
      { x: ox + 69, y: oy + 54 },
    ], '#5b1f1d', 235);
    rect(png, ox + 70, oy + 42, 12, 4, '#8f4934', 120);
    rect(png, ox + 84, oy + 49, 5, 7, '#2e1715', 140);
  } else if (tile.key === 'snare_trap') {
    ellipse(png, ox + 64, oy + 77, 30, 12, '#000000', 35);
    ellipse(png, ox + 64, oy + 70, 24, 9, '#3d2b1d', 185);
    ellipse(png, ox + 64, oy + 70, 18, 6, '#82603a', 155);
    line(png, ox + 42, oy + 70, ox + 28, oy + 59, 2, '#3a2c1f', 190);
    line(png, ox + 86, oy + 70, ox + 103, oy + 64, 2, '#3a2c1f', 190);
  } else if (tile.key === 'lookout_cache') {
    ellipse(png, ox + 64, oy + 94, 42, 10, '#000000', 42);
    drawCrate(png, ox + 40, oy + 59, 31, 25);
    line(png, ox + 72, oy + 91, ox + 75, oy + 43, 4, '#50321f', 240);
    line(png, ox + 95, oy + 90, ox + 85, oy + 47, 4, '#50321f', 230);
    line(png, ox + 70, oy + 57, ox + 98, oy + 53, 4, '#5b3b23', 230);
    rect(png, ox + 74, oy + 50, 17, 8, '#61241f', 220);
    drawSack(png, ox + 65, oy + 66, 28, 25, '#96784f');
  } else if (tile.key === 'boot_tracks') {
    for (let i = 0; i < 6; i += 1) {
      const x = ox + 36 + i * 11;
      const y = oy + 68 + (i % 2) * 12;
      ellipse(png, x, y, 5, 9, '#31291f', 115);
      rect(png, x - 3, y + 5, 6, 4, '#31291f', 90);
    }
  } else if (tile.key === 'cut_logs') {
    ellipse(png, ox + 64, oy + 86, 38, 9, '#000000', 40);
    for (let i = 0; i < 3; i += 1) {
      const y = oy + 60 + i * 9;
      rect(png, ox + 36 + i * 4, y, 54, 8, '#6f4729', 240);
      ellipse(png, ox + 37 + i * 4, y + 4, 5, 4, '#a87943', 230);
      ellipse(png, ox + 90 + i * 4, y + 4, 5, 4, '#4a2f1e', 230);
      line(png, ox + 42 + i * 4, y + 3, ox + 86 + i * 4, y + 4, 1, '#3d2618', 120);
    }
  } else if (tile.key === 'cold_firepit') {
    ellipse(png, ox + 64, oy + 78, 28, 12, '#000000', 38);
    ellipse(png, ox + 64, oy + 70, 23, 9, '#5b5140', 185);
    ellipse(png, ox + 64, oy + 70, 16, 6, '#2d2925', 190);
    line(png, ox + 50, oy + 67, ox + 78, oy + 74, 3, '#4b321e', 200);
    line(png, ox + 53, oy + 75, ox + 75, oy + 63, 3, '#3b2718', 210);
  } else if (tile.key === 'rope_marker') {
    ellipse(png, ox + 64, oy + 80, 32, 8, '#000000', 36);
    line(png, ox + 36, oy + 73, ox + 92, oy + 65, 4, '#8b6a3d', 215);
    line(png, ox + 39, oy + 77, ox + 93, oy + 70, 2, '#3c2b1c', 135);
    rect(png, ox + 34, oy + 65, 6, 19, '#4c321f', 240);
    rect(png, ox + 91, oy + 60, 6, 22, '#4c321f', 240);
  }
}

function writeTilesetAssets() {
  const png = makeTamziaBanditForestV2Artwork();
  const pngBuffer = PNG.sync.write(png, { colorType: 6, inputColorType: 6, deflateLevel: 9 });

  const tileTypes = BANDIT_DECOR_TILES.map((tile) => {
    const animation = tile.key === 'cold_firepit'
      ? `\n  <animation>\n    <frame tileid="10" duration="130"/>\n    <frame tileid="12" duration="130"/>\n    <frame tileid="13" duration="130"/>\n    <frame tileid="14" duration="130"/>\n    <frame tileid="15" duration="130"/>\n  </animation>`
      : tile.key === 'rag_banner'
        ? `\n  <animation>\n    <frame tileid="5" duration="150"/>\n    <frame tileid="16" duration="150"/>\n    <frame tileid="17" duration="150"/>\n    <frame tileid="18" duration="150"/>\n    <frame tileid="19" duration="150"/>\n  </animation>`
        : '';
    return ` <tile id="${tile.id}" type="${tile.key}">${animation}\n </tile>`;
  }).join('\n');
  const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${BANDIT_SHEET_NAME}" tilewidth="${BANDIT_FRAME_WIDTH}" tileheight="${BANDIT_FRAME_HEIGHT}" tilecount="${BANDIT_TILECOUNT}" columns="${BANDIT_COLUMNS}">
 <image source="${BANDIT_SHEET_NAME}.png" width="${png.width}" height="${png.height}"/>
${tileTypes}
</tileset>
`;

  [ASSET_TILESET_DIR, PROJECT_TILESET_DIR, CONTINENT_TILESET_DIR].forEach((dir) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${BANDIT_SHEET_NAME}.png`), pngBuffer);
    writeFileSync(path.join(dir, `${BANDIT_SHEET_NAME}.tsx`), tsx, 'utf8');
  });
}

function decodeLayer(layer) {
  if (!layer?.data) return new Uint32Array(0);
  if (Array.isArray(layer.data)) return Uint32Array.from(layer.data);
  if (layer.encoding !== 'base64' || layer.compression !== 'zlib') return new Uint32Array(0);
  const inflated = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(Math.floor(inflated.length / 4));
  for (let index = 0; index < data.length; index += 1) {
    data[index] = inflated.readUInt32LE(index * 4);
  }
  return data;
}

function parseXmlAttribute(xml, name) {
  const match = xml.match(new RegExp(`${name}="([^"]+)"`));
  return match?.[1] ?? null;
}

function getTilesetTilecount(tsxPath, fallback = 1) {
  if (!existsSync(tsxPath)) return fallback;
  const xml = readFileSync(tsxPath, 'utf8');
  return Number(parseXmlAttribute(xml, 'tilecount') ?? fallback) || fallback;
}

function resolveTilesetPath(mapPath, source) {
  return path.resolve(path.dirname(mapPath), String(source ?? '').replaceAll('/', path.sep));
}

function upsertTileset(tilesets, source, mapPath, fallbackTilecount) {
  const existing = tilesets.find((tileset) => tileset.source === source);
  if (existing) return Number(existing.firstgid ?? 1);

  const maxEnd = Math.max(
    1,
    ...tilesets.map((tileset) => {
      const tsxPath = resolveTilesetPath(mapPath, tileset.source);
      return Number(tileset.firstgid ?? 1) + getTilesetTilecount(tsxPath, 1);
    }),
  );
  tilesets.push({ firstgid: maxEnd, source });
  tilesets.sort((a, b) => Number(a.firstgid ?? 0) - Number(b.firstgid ?? 0));
  return maxEnd || fallbackTilecount;
}

function objectLayer(map, name, afterName = null) {
  let layer = map.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === name);
  if (layer) {
    layer.objects ??= [];
    layer.visible ??= true;
    layer.opacity ??= 1;
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

function findAreaObject(map, targetLayer) {
  const targetArea = (targetLayer.objects ?? []).find((object) => object.name === AREA_OBJECT_NAME && object.polygon?.length);
  if (targetArea) return { layer: targetLayer, object: targetArea };

  for (const layer of map.layers ?? []) {
    const object = (layer.objects ?? []).find((candidate) => candidate.name === AREA_OBJECT_NAME && candidate.polygon?.length);
    if (object) return { layer, object };
  }
  return null;
}

function getPolygonFromObject(object) {
  return (object?.polygon ?? []).map((point) => ({
    x: Number(object.x ?? 0) + Number(point.x ?? 0),
    y: Number(object.y ?? 0) + Number(point.y ?? 0),
  }));
}

function polygonBounds(polygon) {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function hash01(a, b = 0, c = 0) {
  const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453123;
  return value - Math.floor(value);
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function weightedPick(items, roll) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let target = roll * total;
  for (const item of items) {
    target -= item.weight;
    if (target <= 0) return item;
  }
  return items[items.length - 1];
}

function distance(a, b) {
  return Math.hypot(Number(a.x ?? 0) - Number(b.x ?? 0), Number(a.y ?? 0) - Number(b.y ?? 0));
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distance(point, a);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function pointOnSegment(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function perpendicularOffset(a, b, amount) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    x: (-dy / length) * amount,
    y: (dx / length) * amount,
  };
}

function distanceToPolygonEdge(point, polygon) {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    best = Math.min(best, distanceToSegment(point, polygon[index], polygon[(index + 1) % polygon.length]));
  }
  return best;
}

function objectCenter(object) {
  return {
    x: Number(object?.x ?? 0) + Number(object?.width ?? 0) / 2,
    y: Number(object?.y ?? 0) + Number(object?.height ?? 0) / 2,
  };
}

function findObjectByName(map, names) {
  const lowerNames = names.map((name) => name.toLowerCase());
  for (const layer of map.layers ?? []) {
    for (const object of layer.objects ?? []) {
      const name = String(object.name ?? '').toLowerCase();
      if (lowerNames.some((candidate) => name.includes(candidate))) return object;
    }
  }
  return null;
}

function maxObjectId(map) {
  return Math.max(
    0,
    ...(map.layers ?? [])
      .filter((layer) => Array.isArray(layer.objects))
      .flatMap((layer) => layer.objects.map((object) => Number(object.id ?? 0))),
  );
}

function isGeneratedBanditForestObject(object) {
  const props = getProperties(object);
  return props.generatedBy === GENERATED_BY || props.banditForestArea === AREA_OBJECT_NAME;
}

function loadRegionData() {
  const regions = new Map();
  for (let regionY = 0; regionY < REGION_GRID; regionY += 1) {
    for (let regionX = 0; regionX < REGION_GRID; regionX += 1) {
      const mapId = `continent_01_region_${regionX}_${regionY}`;
      const filePath = path.join(REGION_DIR, `${mapId}.tmj`);
      if (!existsSync(filePath)) continue;
      const map = readJson(filePath);
      const tileLayers = new Map();
      (map.layers ?? [])
        .filter((layer) => layer.type === 'tilelayer')
        .forEach((layer) => {
          tileLayers.set(layer.name, {
            width: Number(layer.width ?? map.width ?? REGION_TILES),
            height: Number(layer.height ?? map.height ?? REGION_TILES),
            data: decodeLayer(layer),
          });
        });
      regions.set(`${regionX},${regionY}`, { regionX, regionY, mapId, map, tileLayers });
    }
  }
  return regions;
}

function hasTileNear(regions, layerNames, x, y, radiusTiles = 1) {
  const baseTileX = Math.floor(x / TILE);
  const baseTileY = Math.floor(y / TILE);
  for (let dy = -radiusTiles; dy <= radiusTiles; dy += 1) {
    for (let dx = -radiusTiles; dx <= radiusTiles; dx += 1) {
      const tileX = baseTileX + dx;
      const tileY = baseTileY + dy;
      if (tileX < 0 || tileY < 0) return true;
      const regionX = Math.floor(tileX / REGION_TILES);
      const regionY = Math.floor(tileY / REGION_TILES);
      const region = regions.get(`${regionX},${regionY}`);
      if (!region) return true;
      const localX = tileX - regionX * REGION_TILES;
      const localY = tileY - regionY * REGION_TILES;
      for (const layerName of layerNames) {
        const layer = region.tileLayers.get(layerName);
        if (!layer || localX < 0 || localY < 0 || localX >= layer.width || localY >= layer.height) continue;
        if ((layer.data[localY * layer.width + localX] ?? 0) & TILED_GID_MASK) return true;
      }
    }
  }
  return false;
}

function makeForestObject({ id, tile, gid, x, y, width, height, kind, displayName, spriteSheet, animationPhase = 0 }) {
  return {
    gid,
    height,
    id,
    name: '',
    opacity: 1,
    properties: [
      prop('type', 'string', kind),
      prop('displayName', 'string', displayName ?? tile.displayName),
      prop('spriteSheet', 'string', spriteSheet),
      prop('generatedBy', 'string', GENERATED_BY),
      prop('banditForestArea', 'string', AREA_OBJECT_NAME),
      prop('collision', 'bool', false),
      ...(kind === 'forest_tree' ? [
        prop('animation', 'string', 'canopy_sway'),
        prop('animationPhase', 'int', animationPhase),
      ] : []),
    ],
    rotation: 0,
    type: kind,
    visible: true,
    width,
    x: Math.round(x),
    y: Math.round(y),
  };
}

function getDanger(point, cityPoint, hideoutPoint) {
  const total = Math.max(1, distance(cityPoint, hideoutPoint));
  return clamp(1 - distance(point, hideoutPoint) / total, 0, 1);
}

function validPoint(point, polygon, regions, radiusTiles = 2) {
  if (!pointInPolygon(point, polygon)) return false;
  if (hasTileNear(regions, AVOID_TILE_LAYERS, point.x, point.y, radiusTiles)) return false;
  return true;
}

function findNearbyValidPoint(candidate, polygon, regions, seed = 0, radius = 240) {
  if (validPoint(candidate, polygon, regions, 2)) return candidate;
  for (let index = 0; index < 28; index += 1) {
    const angle = hash01(seed, index, 91) * Math.PI * 2;
    const length = 48 + hash01(seed, index, 92) * radius;
    const point = {
      x: candidate.x + Math.cos(angle) * length,
      y: candidate.y + Math.sin(angle) * length,
    };
    if (validPoint(point, polygon, regions, 2)) return point;
  }
  return null;
}

function isTooClose(points, point, minDistance) {
  return points.some((other) => distance(other, point) < minDistance);
}

function generateBanditForestObjects({ map, polygon, regions, forestFirstgid, banditFirstgid }) {
  const bounds = polygonBounds(polygon);
  const cityObject = findObjectByName(map, ['tamzia_city']);
  const hideoutObject = findObjectByName(map, ['tamzia_bandit_hideout_entrance', 'tamzia_bandit_hideout', 'marker_fernroot_hideout']);
  const cityPoint = cityObject ? objectCenter(cityObject) : { x: bounds.minX, y: bounds.minY };
  const hideoutPoint = hideoutObject ? objectCenter(hideoutObject) : { x: bounds.maxX - 1600, y: bounds.maxY - 1600 };
  let nextId = maxObjectId(map) + 1;
  const objects = [];
  const treeAnchors = [];
  const occupied = [];

  const addObject = (tile, point, kind, options = {}) => {
    const scale = options.scale ?? 1;
    const width = Math.round(tile.width * scale);
    const height = Math.round(tile.height * scale);
    const animationPhase = kind === 'forest_tree'
      ? Math.floor(hash01(point.x, point.y, 3001) * FOREST_ANIMATION_FRAMES)
      : 0;
    const sourceFirstgid = options.spriteSheet === BANDIT_SHEET_NAME ? banditFirstgid : forestFirstgid;
    const gid = sourceFirstgid + tile.id + (kind === 'forest_tree' ? animationPhase : 0);
    const object = makeForestObject({
      id: nextId,
      tile,
      gid,
      x: point.x - width / 2,
      y: point.y,
      width,
      height,
      kind,
      displayName: options.displayName,
      spriteSheet: options.spriteSheet ?? FOREST_SHEET_NAME,
      animationPhase,
    });
    nextId += 1;
    objects.push(object);
    occupied.push({ x: point.x, y: point.y, radius: Math.max(width, height) * 0.42 });
    if (kind === 'forest_tree') treeAnchors.push({ x: point.x, y: point.y });
    return object;
  };

  const pathStart = findNearbyValidPoint(pointOnSegment(cityPoint, hideoutPoint, 0.24), polygon, regions, 11, 520)
    ?? { x: bounds.minX + 1200, y: bounds.minY + 1200 };
  const pathEnd = findNearbyValidPoint(pointOnSegment(cityPoint, hideoutPoint, 0.88), polygon, regions, 12, 520)
    ?? hideoutPoint;

  const treeStep = 218;
  for (let y = bounds.minY + 90; y <= bounds.maxY - 70; y += treeStep) {
    for (let x = bounds.minX + 80; x <= bounds.maxX - 70; x += treeStep) {
      const cellX = Math.floor(x / treeStep);
      const cellY = Math.floor(y / treeStep);
      const point = {
        x: x + (hash01(cellX, cellY, 21) - 0.5) * 150,
        y: y + (hash01(cellX, cellY, 22) - 0.5) * 142,
      };
      if (!validPoint(point, polygon, regions, 3)) continue;

      const danger = getDanger(point, cityPoint, hideoutPoint);
      const pathDistance = distanceToSegment(point, pathStart, pathEnd);
      const pathFactor = clamp(1 - pathDistance / 560, 0, 1);
      const edgeFactor = clamp(distanceToPolygonEdge(point, polygon) / 1200, 0.2, 1);
      const patchNoise = hash01(Math.floor(point.x / 780), Math.floor(point.y / 780), 71);
      const density = clamp(0.24 + danger * 0.16 + edgeFactor * 0.1 + patchNoise * 0.16 - pathFactor * 0.2, 0.12, 0.58);
      if (hash01(cellX, cellY, 23) > density) continue;

      const tree = weightedPick(TREE_TILES, hash01(cellX, cellY, 24));
      const minDistance = tree.key === 'young_tree' ? 84 : 118;
      if (isTooClose(treeAnchors, point, minDistance)) continue;
      addObject(tree, point, 'forest_tree', {
        scale: 0.84 + hash01(cellX, cellY, 25) * 0.2,
        spriteSheet: FOREST_SHEET_NAME,
      });
    }
  }

  const detailStep = 138;
  for (let y = bounds.minY + 52; y <= bounds.maxY - 34; y += detailStep) {
    for (let x = bounds.minX + 46; x <= bounds.maxX - 36; x += detailStep) {
      const cellX = Math.floor(x / detailStep);
      const cellY = Math.floor(y / detailStep);
      const point = {
        x: x + (hash01(cellX, cellY, 121) - 0.5) * 96,
        y: y + (hash01(cellX, cellY, 122) - 0.5) * 96,
      };
      if (!validPoint(point, polygon, regions, 2)) continue;

      const danger = getDanger(point, cityPoint, hideoutPoint);
      const pathFactor = clamp(1 - distanceToSegment(point, pathStart, pathEnd) / 500, 0, 1);
      const treeNear = treeAnchors.some((tree) => distance(tree, point) < 240);
      const chance = clamp(0.17 + danger * 0.12 + pathFactor * 0.16 + (treeNear ? 0.09 : 0), 0.12, 0.48);
      if (hash01(cellX, cellY, 123) > chance) continue;

      const detailPool = danger > 0.42
        ? FOREST_DETAIL_TILES
        : FOREST_DETAIL_TILES.filter((tile) => !['fallen_log', 'stump'].includes(tile.key) || hash01(cellX, cellY, 130) > 0.4);
      const detail = weightedPick(detailPool, hash01(cellX, cellY, 124));
      const kind = detail.key.includes('bush') ? 'forest_bush' : 'forest_detail';
      addObject(detail, point, kind, {
        scale: 0.84 + hash01(cellX, cellY, 125) * 0.24,
        spriteSheet: FOREST_SHEET_NAME,
      });
    }
  }

  const banditStep = 244;
  for (let y = bounds.minY + 92; y <= bounds.maxY - 70; y += banditStep) {
    for (let x = bounds.minX + 76; x <= bounds.maxX - 64; x += banditStep) {
      const cellX = Math.floor(x / banditStep);
      const cellY = Math.floor(y / banditStep);
      const point = {
        x: x + (hash01(cellX, cellY, 221) - 0.5) * 196,
        y: y + (hash01(cellX, cellY, 222) - 0.5) * 196,
      };
      if (!validPoint(point, polygon, regions, 2)) continue;

      const danger = getDanger(point, cityPoint, hideoutPoint);
      const pathFactor = clamp(1 - distanceToSegment(point, pathStart, pathEnd) / 680, 0, 1);
      const chance = clamp(0.025 + danger * 0.16 + pathFactor * 0.14, 0.02, 0.32);
      if (hash01(cellX, cellY, 223) > chance) continue;
      if (isTooClose(occupied, point, danger > 0.65 ? 70 : 108)) continue;

      const maxTier = danger > 0.5 ? 2 : danger > 0.22 ? 1 : 0;
      const pool = BANDIT_DECOR_TILES.filter((tile) => tile.tier <= maxTier);
      const tile = weightedPick(pool, hash01(cellX, cellY, 224));
      addObject(tile, point, tile.tier >= 2 ? 'bandit_marker' : 'bandit_detail', {
        scale: 0.86 + hash01(cellX, cellY, 225) * 0.18,
        spriteSheet: BANDIT_SHEET_NAME,
      });
    }
  }

  const trailTiles = BANDIT_DECOR_TILES.filter((tile) => (
    ['trail_scuff', 'boot_tracks', 'rope_marker', 'cut_logs', 'snare_trap'].includes(tile.key)
  ));
  for (let index = 0; index < 52; index += 1) {
    const t = 0.04 + (index / 51) * 0.92;
    const base = pointOnSegment(pathStart, pathEnd, t);
    const side = (hash01(index, 411, 1) - 0.5) * 340;
    const offset = perpendicularOffset(pathStart, pathEnd, side);
    const point = findNearbyValidPoint({
      x: base.x + offset.x,
      y: base.y + offset.y,
    }, polygon, regions, 900 + index, 180);
    if (!point || isTooClose(occupied, point, 58)) continue;
    const danger = getDanger(point, cityPoint, hideoutPoint);
    const pool = danger > 0.34
      ? trailTiles
      : trailTiles.filter((tile) => ['trail_scuff', 'boot_tracks', 'cut_logs'].includes(tile.key));
    const tile = weightedPick(pool, hash01(index, 411, 2));
    addObject(tile, point, tile.tier >= 2 ? 'bandit_marker' : 'bandit_detail', {
      scale: 0.82 + hash01(index, 411, 3) * 0.18,
      spriteSheet: BANDIT_SHEET_NAME,
    });
  }

  const addSetPiece = (tileKey, t, sideOffset, seed, extras = []) => {
    const base = pointOnSegment(pathStart, pathEnd, t);
    const offset = perpendicularOffset(pathStart, pathEnd, sideOffset);
    const point = findNearbyValidPoint({ x: base.x + offset.x, y: base.y + offset.y }, polygon, regions, seed, 360);
    if (!point || isTooClose(occupied, point, 180)) return;
    const tile = BANDIT_DECOR_TILES.find((candidate) => candidate.key === tileKey);
    if (!tile) return;
    addObject(tile, point, tile.tier >= 2 ? 'bandit_marker' : 'bandit_detail', {
      scale: 1,
      spriteSheet: BANDIT_SHEET_NAME,
    });
    extras.forEach((extra, index) => {
      const extraTile = BANDIT_DECOR_TILES.find((candidate) => candidate.key === extra.key);
      if (!extraTile) return;
      const extraPoint = findNearbyValidPoint({
        x: point.x + extra.dx,
        y: point.y + extra.dy,
      }, polygon, regions, seed + index + 100, 120);
      if (!extraPoint || isTooClose(occupied, extraPoint, 64)) return;
      addObject(extraTile, extraPoint, extraTile.tier >= 2 ? 'bandit_marker' : 'bandit_detail', {
        scale: extra.scale ?? 0.92,
        spriteSheet: BANDIT_SHEET_NAME,
      });
    });
  };

  addSetPiece('broken_cart', 0.48, 240, 501, [
    { key: 'loot_crates', dx: 120, dy: 46, scale: 0.9 },
    { key: 'sack_pile', dx: -92, dy: 68, scale: 0.88 },
    { key: 'boot_tracks', dx: 32, dy: 138, scale: 0.9 },
  ]);
  addSetPiece('lookout_cache', 0.72, -260, 601, [
    { key: 'rag_banner', dx: 82, dy: -20, scale: 0.94 },
    { key: 'snare_trap', dx: -110, dy: 96, scale: 0.9 },
  ]);
  addSetPiece('warning_stakes', 0.84, 160, 701, [
    { key: 'rope_marker', dx: -88, dy: 58, scale: 0.92 },
    { key: 'boot_tracks', dx: 84, dy: 104, scale: 0.9 },
  ]);
  addSetPiece('cold_firepit', 0.62, 340, 801, [
    { key: 'cut_logs', dx: 86, dy: 46, scale: 0.88 },
    { key: 'sack_pile', dx: -86, dy: 34, scale: 0.86 },
  ]);

  objects.sort((a, b) => (Number(a.y ?? 0) - Number(b.y ?? 0)) || (Number(a.x ?? 0) - Number(b.x ?? 0)));
  return { objects, cityPoint, hideoutPoint, pathStart, pathEnd };
}

function updateRegionMap() {
  const map = readJson(MAP_PATH);
  map.tilesets ??= [];
  const forestFirstgid = upsertTileset(map.tilesets, FOREST_MAP_TILESET_SOURCE, MAP_PATH, 64);
  const banditFirstgid = upsertTileset(map.tilesets, BANDIT_MAP_TILESET_SOURCE, MAP_PATH, BANDIT_TILECOUNT);
  const targetLayer = objectLayer(map, TARGET_LAYER_NAME, 'tamzia_forest');
  targetLayer.draworder = 'topdown';

  const areaRef = findAreaObject(map, targetLayer);
  if (!areaRef) {
    throw new Error(`Missing polygon object "${AREA_OBJECT_NAME}". Draw it on "${TARGET_LAYER_NAME}" or keep that named area on an object layer.`);
  }

  const areaObject = { ...areaRef.object };
  const polygon = getPolygonFromObject(areaObject);
  if (polygon.length < 3) throw new Error(`Object "${AREA_OBJECT_NAME}" must be a polygon.`);

  for (const layer of map.layers ?? []) {
    if (!Array.isArray(layer.objects)) continue;
    layer.objects = layer.objects.filter((object) => (
      object === areaRef.object
      || object.name !== AREA_OBJECT_NAME
      || layer === targetLayer
    ));
  }

  const regions = loadRegionData();
  const generated = generateBanditForestObjects({ map, polygon, regions, forestFirstgid, banditFirstgid });
  const preserved = (targetLayer.objects ?? []).filter((object) => (
    object.name !== AREA_OBJECT_NAME
    && !isGeneratedBanditForestObject(object)
  ));

  targetLayer.objects = [
    areaObject,
    ...preserved,
    ...generated.objects,
  ].sort((a, b) => {
    if (a.name === AREA_OBJECT_NAME) return -1;
    if (b.name === AREA_OBJECT_NAME) return 1;
    return (Number(a.y ?? 0) - Number(b.y ?? 0)) || (Number(a.x ?? 0) - Number(b.x ?? 0));
  });

  map.nextobjectid = Math.max(Number(map.nextobjectid ?? 1), maxObjectId(map) + 1);
  writeJson(MAP_PATH, map, true);

  return {
    forestFirstgid,
    banditFirstgid,
    objects: generated.objects,
    cityPoint: generated.cityPoint,
    hideoutPoint: generated.hideoutPoint,
    pathStart: generated.pathStart,
    pathEnd: generated.pathEnd,
  };
}

writeTilesetAssets();
const result = updateRegionMap();
const counts = result.objects.reduce((summary, object) => {
  const type = getProperties(object).type ?? 'unknown';
  summary[type] = (summary[type] ?? 0) + 1;
  return summary;
}, {});

console.log(JSON.stringify({
  layer: TARGET_LAYER_NAME,
  tileset: BANDIT_SHEET_NAME,
  forestFirstgid: result.forestFirstgid,
  banditFirstgid: result.banditFirstgid,
  objects: result.objects.length,
  counts,
  cityPoint: {
    x: Math.round(result.cityPoint.x),
    y: Math.round(result.cityPoint.y),
  },
  hideoutPoint: {
    x: Math.round(result.hideoutPoint.x),
    y: Math.round(result.hideoutPoint.y),
  },
  pathStart: {
    x: Math.round(result.pathStart.x),
    y: Math.round(result.pathStart.y),
  },
  pathEnd: {
    x: Math.round(result.pathEnd.x),
    y: Math.round(result.pathEnd.y),
  },
  collision: 'unchanged',
}, null, 2));
