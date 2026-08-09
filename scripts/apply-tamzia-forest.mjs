import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';
import { makeTamziaForestV2Artwork } from './tamzia-forest-artwork-v2.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 32;
const SHEET_NAME = 'tamzia_forest_v1';
const MAP_ID = 'continent_01_region_0_0';
const MAP_PATH = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions/continent_01_region_0_0.tmj');
const CHUNK_DIR = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions/chunks');
const CHUNK_INDEX_PATH = path.join(CHUNK_DIR, 'continent_01_chunks.json');
const ASSET_TILESET_DIR = path.join(ROOT, 'public/assets/tilesets');
const PROJECT_TILESET_DIR = path.join(ROOT, 'public/tilesets');
const CONTINENT_TILESET_DIR = path.join(ROOT, 'public/maps/world_map/continents/continent_01/tilesets');
const MAP_TILESET_SOURCE = `../tilesets/${SHEET_NAME}.tsx`;
const CHUNK_TILESET_SOURCE = `../../tilesets/${SHEET_NAME}.tsx`;
const FOREST_LAYER_NAME = 'tamzia_forest';
const FOREST_AREA_NAME = 'tamzia_forest_area';
const GENERATED_BY = SHEET_NAME;
const CHUNK_VERSION = 'v4-continent-01-runtime-chunks-9';

const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 160;
const COLUMNS = 8;
const ROWS = 8;
const TILECOUNT = COLUMNS * ROWS;
const ANIMATION_FRAMES = 8;
const TREE_FRAME_DURATION_MS = 110;

const TREE_TILES = [
  { key: 'round_oak', id: 0, width: 128, height: 160, weight: 22, displayName: 'Tamzia Round Oak' },
  { key: 'pine', id: 8, width: 112, height: 160, weight: 18, displayName: 'Tamzia Pine' },
  { key: 'birch', id: 16, width: 96, height: 144, weight: 14, displayName: 'Tamzia Silver Birch' },
  { key: 'deep_oak', id: 24, width: 128, height: 160, weight: 20, displayName: 'Tamzia Deep Oak' },
  { key: 'young_tree', id: 32, width: 84, height: 120, weight: 16, displayName: 'Tamzia Young Tree' },
  { key: 'cedar', id: 40, width: 112, height: 152, weight: 10, displayName: 'Tamzia Cedar' },
];

const DETAIL_TILES = [
  { key: 'bramble_bush', id: 48, width: 74, height: 70, weight: 16, displayName: 'Bramble Bush' },
  { key: 'round_bush', id: 49, width: 70, height: 62, weight: 14, displayName: 'Round Bush' },
  { key: 'fern_cluster', id: 50, width: 58, height: 58, weight: 12, displayName: 'Fern Cluster' },
  { key: 'grass_tuft', id: 51, width: 48, height: 44, weight: 14, displayName: 'Forest Grass' },
  { key: 'leaf_patch', id: 52, width: 78, height: 42, weight: 14, displayName: 'Leaf Litter' },
  { key: 'mushrooms', id: 53, width: 42, height: 36, weight: 5, displayName: 'Forest Mushrooms' },
  { key: 'moss_rock', id: 54, width: 54, height: 42, weight: 6, displayName: 'Mossy Rock' },
  { key: 'fallen_log', id: 55, width: 90, height: 46, weight: 4, displayName: 'Fallen Log' },
  { key: 'stump', id: 56, width: 42, height: 44, weight: 4, displayName: 'Tree Stump' },
  { key: 'wildflowers', id: 57, width: 44, height: 38, weight: 5, displayName: 'Woodland Flowers' },
  { key: 'forest_shadow', id: 58, width: 88, height: 40, weight: 7, displayName: 'Forest Shadow' },
  { key: 'ivy_patch', id: 59, width: 66, height: 42, weight: 6, displayName: 'Ivy Patch' },
  { key: 'firefly_glow', id: 60, width: 58, height: 74, weight: 2, displayName: 'Firefly Glow' },
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
    rect(
      png,
      x1 + (x2 - x1) * t - size / 2,
      y1 + (y2 - y1) * t - size / 2,
      size,
      size,
      color,
      alpha,
    );
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

function diamond(png, cx, cy, radiusX, radiusY, color, alpha = 255) {
  polygonFill(png, [
    { x: cx, y: cy - radiusY },
    { x: cx + radiusX, y: cy },
    { x: cx, y: cy + radiusY },
    { x: cx - radiusX, y: cy },
  ], color, alpha);
}

function tileOrigin(tileId) {
  return {
    x: (tileId % COLUMNS) * FRAME_WIDTH,
    y: Math.floor(tileId / COLUMNS) * FRAME_HEIGHT,
  };
}

function drawBark(png, ox, oy, x, y, width, height, light = '#8a5a33', dark = '#4f341f') {
  ellipse(png, ox + x + width / 2, oy + y + height, width * 0.62, 8, '#000000', 48);
  rect(png, ox + x, oy + y, width, height, dark, 255);
  rect(png, ox + x + 2, oy + y, Math.max(2, width - 5), height, light, 230);
  rect(png, ox + x + width - 4, oy + y + 4, 2, height - 8, '#2f2118', 150);
  for (let stripe = 0; stripe < 4; stripe += 1) {
    const sx = ox + x + 2 + stripe * Math.max(2, width / 4);
    line(png, sx, oy + y + 5, sx - 2, oy + y + height - 5, 1, '#342519', 120);
  }
}

function drawLeafCluster(png, ox, oy, cx, cy, rx, ry, palette, frame, phase = 0) {
  const sway = Math.sin((frame / ANIMATION_FRAMES) * Math.PI * 2 + phase);
  const dx = Math.round(sway * 2);
  const dy = Math.round(Math.cos((frame / ANIMATION_FRAMES) * Math.PI * 2 + phase) * 0.9);
  ellipse(png, ox + cx + dx, oy + cy + dy + 3, rx + 4, ry + 4, palette.outline, 230);
  ellipse(png, ox + cx + dx, oy + cy + dy, rx, ry, palette.mid, 245);
  ellipse(png, ox + cx + dx - rx * 0.2, oy + cy + dy - ry * 0.18, rx * 0.52, ry * 0.42, palette.light, 135);
  ellipse(png, ox + cx + dx + rx * 0.28, oy + cy + dy + ry * 0.2, rx * 0.44, ry * 0.36, palette.dark, 135);
}

function drawRoundTree(png, tileId, frame, palette, trunkColor = '#8a5a33') {
  const { x: ox, y: oy } = tileOrigin(tileId);
  ellipse(png, ox + 64, oy + 142, 42, 13, '#000000', 54);
  drawBark(png, ox, oy, 57, 91, 15, 52, trunkColor, '#4d3321');
  drawLeafCluster(png, ox, oy, 42, 59, 28, 27, palette, frame, 0.2);
  drawLeafCluster(png, ox, oy, 66, 42, 33, 31, palette, frame, 1.1);
  drawLeafCluster(png, ox, oy, 87, 61, 30, 28, palette, frame, 2.0);
  drawLeafCluster(png, ox, oy, 61, 72, 43, 34, palette, frame, 2.7);
  drawLeafCluster(png, ox, oy, 79, 85, 31, 25, palette, frame, 3.3);
  ellipse(png, ox + 38, oy + 90, 9, 5, palette.light, 95);
  ellipse(png, ox + 91, oy + 37, 8, 4, palette.light, 85);
}

function drawPineTree(png, tileId, frame, palette) {
  const { x: ox, y: oy } = tileOrigin(tileId);
  const sway = Math.round(Math.sin((frame / ANIMATION_FRAMES) * Math.PI * 2) * 2);
  ellipse(png, ox + 64, oy + 144, 34, 11, '#000000', 50);
  drawBark(png, ox, oy, 59, 88, 10, 55, '#7a4e2d', '#3f2b1e');
  [
    [64 + sway, 20, 21, 35],
    [63 - sway, 43, 34, 45],
    [65 + sway, 70, 44, 50],
    [64 - sway, 100, 53, 43],
  ].forEach(([cx, cy, rx, ry], index) => {
    polygonFill(png, [
      { x: ox + cx, y: oy + cy - ry },
      { x: ox + cx + rx, y: oy + cy + ry },
      { x: ox + cx - rx, y: oy + cy + ry },
    ], palette.outline, 235);
    polygonFill(png, [
      { x: ox + cx, y: oy + cy - ry + 5 },
      { x: ox + cx + rx - 5, y: oy + cy + ry - 3 },
      { x: ox + cx - rx + 5, y: oy + cy + ry - 3 },
    ], index % 2 ? palette.mid : palette.dark, 245);
    line(png, ox + cx - 8, oy + cy - ry * 0.2, ox + cx + 8, oy + cy + ry * 0.28, 2, palette.light, 84);
  });
}

function drawBirchTree(png, tileId, frame) {
  const { x: ox, y: oy } = tileOrigin(tileId);
  const palette = {
    outline: '#2f5a35',
    dark: '#3f7a43',
    mid: '#629948',
    light: '#a6c76a',
  };
  ellipse(png, ox + 64, oy + 138, 28, 9, '#000000', 42);
  drawBark(png, ox, oy, 59, 78, 10, 58, '#e2dcc8', '#7a7567');
  rect(png, ox + 60, oy + 88, 7, 2, '#2b2924', 180);
  rect(png, ox + 61, oy + 108, 6, 2, '#2b2924', 180);
  drawLeafCluster(png, ox, oy, 49, 54, 23, 22, palette, frame, 0.6);
  drawLeafCluster(png, ox, oy, 68, 40, 29, 25, palette, frame, 1.8);
  drawLeafCluster(png, ox, oy, 82, 62, 24, 23, palette, frame, 2.7);
  drawLeafCluster(png, ox, oy, 64, 75, 32, 24, palette, frame, 3.5);
}

function drawYoungTree(png, tileId, frame) {
  const { x: ox, y: oy } = tileOrigin(tileId);
  const palette = {
    outline: '#285334',
    dark: '#346b3b',
    mid: '#4f8f45',
    light: '#9cc46b',
  };
  ellipse(png, ox + 64, oy + 134, 25, 8, '#000000', 35);
  drawBark(png, ox, oy, 60, 88, 9, 44, '#8b5c37', '#4c3321');
  drawLeafCluster(png, ox, oy, 52, 67, 21, 21, palette, frame, 0.4);
  drawLeafCluster(png, ox, oy, 69, 55, 25, 24, palette, frame, 1.7);
  drawLeafCluster(png, ox, oy, 77, 78, 22, 20, palette, frame, 2.8);
  drawLeafCluster(png, ox, oy, 62, 83, 26, 20, palette, frame, 3.4);
}

function drawCedarTree(png, tileId, frame) {
  const { x: ox, y: oy } = tileOrigin(tileId);
  const palette = {
    outline: '#244333',
    dark: '#2f6040',
    mid: '#3f7f4a',
    light: '#7fa65c',
  };
  ellipse(png, ox + 64, oy + 143, 34, 10, '#000000', 46);
  drawBark(png, ox, oy, 58, 92, 12, 50, '#704728', '#3e2b1f');
  drawLeafCluster(png, ox, oy, 60, 35, 24, 30, palette, frame, 0.2);
  drawLeafCluster(png, ox, oy, 45, 66, 24, 32, palette, frame, 1.3);
  drawLeafCluster(png, ox, oy, 83, 66, 25, 33, palette, frame, 2.1);
  drawLeafCluster(png, ox, oy, 64, 93, 39, 31, palette, frame, 2.8);
}

function drawStaticDetail(png, tileId, key) {
  const { x: ox, y: oy } = tileOrigin(tileId);
  ellipse(png, ox + 64, oy + 136, 33, 8, '#000000', 35);
  if (key === 'bramble_bush') {
    drawLeafCluster(png, ox, oy, 49, 112, 23, 18, { outline: '#263d26', dark: '#335a30', mid: '#47733c', light: '#8aa35d' }, 0, 0);
    drawLeafCluster(png, ox, oy, 70, 107, 26, 20, { outline: '#263d26', dark: '#335a30', mid: '#4d7a3d', light: '#9bb36a' }, 1, 0);
    drawLeafCluster(png, ox, oy, 84, 119, 20, 15, { outline: '#263d26', dark: '#335a30', mid: '#466f39', light: '#92aa64' }, 2, 0);
    rect(png, ox + 43, oy + 126, 4, 3, '#9f4860', 190);
    rect(png, ox + 78, oy + 101, 3, 3, '#b65a72', 180);
  } else if (key === 'round_bush') {
    drawLeafCluster(png, ox, oy, 63, 113, 30, 22, { outline: '#24422e', dark: '#2e6237', mid: '#4f8742', light: '#99b75e' }, 0, 0);
    drawLeafCluster(png, ox, oy, 78, 121, 19, 15, { outline: '#24422e', dark: '#2e6237', mid: '#5b9148', light: '#a7c66a' }, 2, 0);
  } else if (key === 'fern_cluster') {
    for (let index = 0; index < 9; index += 1) {
      const angle = -Math.PI * 0.92 + index * 0.23;
      const len = 22 + (index % 3) * 5;
      const x1 = ox + 64;
      const y1 = oy + 132;
      const x2 = x1 + Math.cos(angle) * len;
      const y2 = y1 + Math.sin(angle) * len;
      line(png, x1, y1, x2, y2, 2, '#3f7f41', 225);
      line(png, (x1 + x2) / 2, (y1 + y2) / 2, x2 + 4, y2 + 3, 1, '#8fbf64', 150);
    }
  } else if (key === 'grass_tuft') {
    for (let index = 0; index < 13; index += 1) {
      const x = ox + 44 + index * 3;
      const y = oy + 135;
      line(png, x, y, x + ((index % 3) - 1) * 5, y - 17 - (index % 4) * 3, 2, index % 2 ? '#5f8845' : '#8ba75a', 210);
    }
  } else if (key === 'leaf_patch') {
    ellipse(png, ox + 64, oy + 133, 39, 12, '#5a4a2d', 120);
    for (let index = 0; index < 18; index += 1) {
      const x = ox + 31 + ((index * 13) % 66);
      const y = oy + 124 + ((index * 7) % 18);
      diamond(png, x, y, 4, 2, index % 3 ? '#8e7840' : '#b3924e', 170);
    }
  } else if (key === 'mushrooms') {
    rect(png, ox + 54, oy + 121, 5, 14, '#e8d7b0', 230);
    ellipse(png, ox + 56, oy + 118, 10, 6, '#b84840', 240);
    rect(png, ox + 71, oy + 126, 4, 10, '#efe0be', 230);
    ellipse(png, ox + 73, oy + 123, 8, 5, '#d98b4c', 235);
    rect(png, ox + 62, oy + 128, 3, 8, '#d6caa8', 220);
    ellipse(png, ox + 63, oy + 126, 6, 4, '#d8d16b', 220);
  } else if (key === 'moss_rock') {
    ellipse(png, ox + 63, oy + 126, 25, 15, '#60665c', 235);
    ellipse(png, ox + 56, oy + 121, 13, 8, '#99a878', 150);
    rect(png, ox + 72, oy + 122, 9, 2, '#c5c4ab', 150);
    rect(png, ox + 48, oy + 131, 7, 2, '#3c423c', 140);
  } else if (key === 'fallen_log') {
    ellipse(png, ox + 63, oy + 136, 44, 8, '#000000', 34);
    rect(png, ox + 29, oy + 116, 70, 18, '#6a4328', 235);
    rect(png, ox + 31, oy + 119, 65, 4, '#9b6840', 180);
    ellipse(png, ox + 29, oy + 125, 8, 10, '#4c2f1d', 240);
    ellipse(png, ox + 99, oy + 125, 8, 10, '#4c2f1d', 240);
    ellipse(png, ox + 99, oy + 125, 4, 5, '#b78750', 170);
  } else if (key === 'stump') {
    ellipse(png, ox + 64, oy + 137, 18, 7, '#000000', 34);
    rect(png, ox + 52, oy + 112, 24, 23, '#704626', 240);
    ellipse(png, ox + 64, oy + 111, 14, 8, '#a6753f', 235);
    ellipse(png, ox + 64, oy + 111, 8, 4, '#4a2d1b', 150);
    rect(png, ox + 57, oy + 121, 3, 12, '#3d281a', 130);
  } else if (key === 'wildflowers') {
    for (let index = 0; index < 11; index += 1) {
      const x = ox + 47 + ((index * 11) % 35);
      const y = oy + 128 + ((index * 5) % 12);
      line(png, x, y + 4, x, y - 4, 1, '#5f8a43', 180);
      rect(png, x - 1, y - 6, 3, 3, index % 2 ? '#f6d56e' : '#eaa6d7', 220);
    }
  } else if (key === 'forest_shadow') {
    ellipse(png, ox + 64, oy + 130, 45, 13, '#0f1a12', 75);
    ellipse(png, ox + 48, oy + 125, 18, 7, '#1d2e1f', 65);
    ellipse(png, ox + 80, oy + 136, 20, 6, '#2d3d20', 50);
  } else if (key === 'ivy_patch') {
    ellipse(png, ox + 64, oy + 132, 32, 10, '#274c2d', 115);
    for (let index = 0; index < 16; index += 1) {
      const x = ox + 36 + ((index * 9) % 56);
      const y = oy + 122 + ((index * 6) % 17);
      diamond(png, x, y, 4, 3, index % 2 ? '#4d8c43' : '#78a957', 185);
    }
  }
}

function makeTilesetImage() {
  return makeTamziaForestV2Artwork();
}

function makeTsx(imageSource) {
  const animations = TREE_TILES.map((tree) => {
    return Array.from({ length: ANIMATION_FRAMES }, (_, phase) => {
      const frames = Array.from({ length: ANIMATION_FRAMES }, (_, index) => (
        `    <frame tileid="${tree.id + ((phase + index) % ANIMATION_FRAMES)}" duration="${TREE_FRAME_DURATION_MS}"/>`
      )).join('\n');
      return ` <tile id="${tree.id + phase}" type="${tree.key}">
  <animation>
${frames}
  </animation>
 </tile>`;
    }).join('\n');
  }).join('\n');

  const fireflyAnimations = Array.from({ length: 4 }, (_, phase) => {
    const frames = Array.from({ length: 4 }, (_, index) => (
      `    <frame tileid="${60 + ((phase + index) % 4)}" duration="150"/>`
    )).join('\n');
    return ` <tile id="${60 + phase}" type="firefly_glow">
  <animation>
${frames}
  </animation>
 </tile>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${SHEET_NAME}" tilewidth="${FRAME_WIDTH}" tileheight="${FRAME_HEIGHT}" tilecount="${TILECOUNT}" columns="${COLUMNS}">
 <image source="${imageSource}" width="${COLUMNS * FRAME_WIDTH}" height="${ROWS * FRAME_HEIGHT}"/>
${animations}
${fireflyAnimations}
</tileset>
`;
}

function writeTilesetAssets() {
  mkdirSync(ASSET_TILESET_DIR, { recursive: true });
  mkdirSync(PROJECT_TILESET_DIR, { recursive: true });
  mkdirSync(CONTINENT_TILESET_DIR, { recursive: true });

  const image = makeTilesetImage();
  const pngBytes = PNG.sync.write(image, {
    colorType: 6,
    inputColorType: 6,
    deflateLevel: 9,
  });

  writeFileSync(path.join(ASSET_TILESET_DIR, `${SHEET_NAME}.png`), pngBytes);
  writeFileSync(path.join(CONTINENT_TILESET_DIR, `${SHEET_NAME}.png`), pngBytes);
  writeFileSync(path.join(PROJECT_TILESET_DIR, `${SHEET_NAME}.tsx`), makeTsx(`../assets/tilesets/${SHEET_NAME}.png`), 'utf8');
  writeFileSync(path.join(CONTINENT_TILESET_DIR, `${SHEET_NAME}.tsx`), makeTsx(`${SHEET_NAME}.png`), 'utf8');
}

function normalizeSource(source) {
  return String(source ?? '').replace(/\\/g, '/');
}

function resolveTilesetPath(baseFilePath, source) {
  return path.resolve(path.dirname(baseFilePath), normalizeSource(source));
}

function parseTileCount(baseFilePath, source) {
  const filePath = resolveTilesetPath(baseFilePath, source);
  if (!existsSync(filePath)) return 1;
  const text = readFileSync(filePath, 'utf8');
  const tilecount = Number(text.match(/tilecount="(\d+)"/)?.[1] ?? 1);
  return Number.isFinite(tilecount) && tilecount > 0 ? tilecount : 1;
}

function nextFirstGid(tilesets, baseFilePath) {
  return (tilesets ?? []).reduce((next, tileset) => {
    const firstgid = Number(tileset.firstgid ?? 0);
    if (!Number.isFinite(firstgid) || firstgid <= 0) return next;
    return Math.max(next, firstgid + parseTileCount(baseFilePath, tileset.source));
  }, 1);
}

function upsertTileset(tilesets, source, baseFilePath) {
  const normalized = normalizeSource(source);
  const existing = (tilesets ?? []).find((tileset) => normalizeSource(tileset.source) === normalized);
  if (existing) return Number(existing.firstgid);
  const firstgid = nextFirstGid(tilesets, baseFilePath);
  tilesets.push({ firstgid, source: normalized });
  tilesets.sort((a, b) => Number(a.firstgid) - Number(b.firstgid));
  return firstgid;
}

function decodeLayer(layer) {
  if (!layer?.data) return [];
  if (Array.isArray(layer.data)) return layer.data.slice();
  const inflated = zlib.inflateSync(Buffer.from(String(layer.data).trim(), 'base64'));
  const values = [];
  for (let index = 0; index < inflated.length; index += 4) {
    values.push(inflated.readUInt32LE(index));
  }
  return values;
}

function tileValueAt(map, layerDataByName, layerName, pixelX, pixelY) {
  const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === layerName);
  if (!layer) return 0;
  const col = Math.floor(pixelX / map.tilewidth);
  const row = Math.floor(pixelY / map.tileheight);
  if (col < 0 || row < 0 || col >= layer.width || row >= layer.height) return 0;
  return Number(layerDataByName.get(layerName)?.[row * layer.width + col] ?? 0);
}

function hasTileNear(map, layerDataByName, layerNames, pixelX, pixelY, radiusTiles = 1) {
  const centerCol = Math.floor(pixelX / map.tilewidth);
  const centerRow = Math.floor(pixelY / map.tileheight);
  return layerNames.some((layerName) => {
    const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === layerName);
    const data = layerDataByName.get(layerName);
    if (!layer || !data) return false;
    for (let row = centerRow - radiusTiles; row <= centerRow + radiusTiles; row += 1) {
      for (let col = centerCol - radiusTiles; col <= centerCol + radiusTiles; col += 1) {
        if (col < 0 || row < 0 || col >= layer.width || row >= layer.height) continue;
        if (Number(data[row * layer.width + col] ?? 0) > 0) return true;
      }
    }
    return false;
  });
}

function hash01(x, y, seed = 0) {
  let value = Math.imul(Math.trunc(x) ^ 0x9e3779b9, 0x85ebca6b)
    ^ Math.imul(Math.trunc(y) ^ 0xc2b2ae35, 0x27d4eb2d)
    ^ Math.imul(seed, 0x165667b1);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
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

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function distanceToPolygonEdge(point, polygon) {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const next = (index + 1) % polygon.length;
    best = Math.min(best, distanceToSegment(point, polygon[index], polygon[next]));
  }
  return best;
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

function getForestPolygon(layer) {
  const area = layer.objects.find((object) => object.name === FOREST_AREA_NAME);
  if (!area?.polygon?.length) {
    throw new Error(`Missing polygon object ${FOREST_AREA_NAME} on ${FOREST_LAYER_NAME}.`);
  }
  return area.polygon.map((point) => ({
    x: Number(area.x ?? 0) + Number(point.x ?? 0),
    y: Number(area.y ?? 0) + Number(point.y ?? 0),
  }));
}

function isGeneratedForestObject(object) {
  const props = getProperties(object);
  return props.generatedBy === GENERATED_BY || String(object?.name ?? '').startsWith('tamzia_forest_generated_');
}

function maxObjectId(map) {
  return Math.max(
    0,
    ...(map.layers ?? [])
      .filter((layer) => Array.isArray(layer.objects))
      .flatMap((layer) => layer.objects.map((object) => Number(object.id ?? 0))),
  );
}

function makeForestObject({ id, tile, localId, x, y, width, height, kind, index, animationPhase = 0 }) {
  return {
    gid: localId,
    height,
    id,
    name: '',
    opacity: 1,
    properties: [
      prop('type', 'string', kind),
      prop('displayName', 'string', tile.displayName),
      prop('spriteSheet', 'string', SHEET_NAME),
      prop('generatedBy', 'string', GENERATED_BY),
      prop('forestArea', 'string', FOREST_AREA_NAME),
      prop('collision', 'bool', false),
      ...((kind === 'forest_tree' || kind === 'forest_fx') ? [
        prop('animation', 'string', kind === 'forest_fx' ? 'firefly_glow' : 'canopy_sway'),
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

function isTooCloseToTree(trees, x, y, minDistance) {
  return trees.some((tree) => Math.hypot(tree.x - x, tree.y - y) < minDistance);
}

function generateForestObjects(map, forestLayer, mapFirstgid) {
  const polygon = getForestPolygon(forestLayer);
  const bounds = polygonBounds(polygon);
  const avoidLayers = ['Water', 'RiverFlow', 'WaterEdges', 'Roads', 'Buildings', 'CityRoofs', 'CityInteriors', 'CaveInteriors', 'CaveDetails', 'CaveEntrances', 'Collision', 'CaveCollision'];
  const layerDataByName = new Map(
    map.layers
      .filter((layer) => layer.type === 'tilelayer')
      .map((layer) => [layer.name, decodeLayer(layer)]),
  );

  let nextId = maxObjectId({
    ...map,
    layers: map.layers.map((layer) => layer === forestLayer
      ? { ...layer, objects: layer.objects.filter((object) => !isGeneratedForestObject(object)) }
      : layer),
  }) + 1;
  let index = 1;
  const objects = [];
  const treeAnchors = [];

  const addObject = (tile, point, kind, scale = 1) => {
    const width = Math.round(tile.width * scale);
    const height = Math.round(tile.height * scale);
    const animatedFrameCount = kind === 'forest_fx' ? 4 : ANIMATION_FRAMES;
    const animationPhase = (kind === 'forest_tree' || kind === 'forest_fx')
      ? Math.floor(hash01(point.x, point.y, 4801) * animatedFrameCount)
      : 0;
    const object = makeForestObject({
      id: nextId,
      tile,
      localId: mapFirstgid + tile.id + animationPhase,
      x: point.x - width / 2,
      y: point.y,
      width,
      height,
      kind,
      index,
      animationPhase,
    });
    nextId += 1;
    index += 1;
    objects.push(object);
    if (kind === 'forest_tree') treeAnchors.push({ x: point.x, y: point.y });
    return object;
  };

  const treeStep = 174;
  for (let y = bounds.minY + 90; y <= bounds.maxY - 70; y += treeStep) {
    for (let x = bounds.minX + 80; x <= bounds.maxX - 70; x += treeStep) {
      const cellX = Math.floor(x / treeStep);
      const cellY = Math.floor(y / treeStep);
      const point = {
        x: x + (hash01(cellX, cellY, 21) - 0.5) * 142,
        y: y + (hash01(cellX, cellY, 22) - 0.5) * 134,
      };
      if (!pointInPolygon(point, polygon)) continue;
      if (hasTileNear(map, layerDataByName, avoidLayers, point.x, point.y, 3)) continue;

      const edgeDistance = distanceToPolygonEdge(point, polygon);
      const patchNoise = hash01(Math.floor(point.x / 820), Math.floor(point.y / 820), 77);
      const edgeFactor = Math.min(1, Math.max(0.18, edgeDistance / 920));
      const density = Math.min(0.82, 0.36 + edgeFactor * 0.22 + patchNoise * 0.24);
      const roll = hash01(cellX, cellY, 23);
      if (roll > density) continue;

      const tree = weightedPick(TREE_TILES, hash01(cellX, cellY, 24));
      const scale = 0.9 + hash01(cellX, cellY, 25) * 0.18;
      const minDistance = tree.key === 'young_tree' ? 74 : 104;
      if (isTooCloseToTree(treeAnchors, point.x, point.y, minDistance)) continue;
      addObject(tree, point, 'forest_tree', scale);
    }
  }

  const detailStep = 118;
  for (let y = bounds.minY + 48; y <= bounds.maxY - 36; y += detailStep) {
    for (let x = bounds.minX + 44; x <= bounds.maxX - 36; x += detailStep) {
      const cellX = Math.floor(x / detailStep);
      const cellY = Math.floor(y / detailStep);
      const point = {
        x: x + (hash01(cellX, cellY, 121) - 0.5) * 86,
        y: y + (hash01(cellX, cellY, 122) - 0.5) * 86,
      };
      if (!pointInPolygon(point, polygon)) continue;
      if (hasTileNear(map, layerDataByName, avoidLayers, point.x, point.y, 2)) continue;

      const edgeDistance = distanceToPolygonEdge(point, polygon);
      const treeNear = treeAnchors.some((tree) => Math.hypot(tree.x - point.x, tree.y - point.y) < 220);
      const baseChance = treeNear ? 0.34 : 0.2;
      const edgeBonus = edgeDistance < 520 ? 0.16 : 0;
      if (hash01(cellX, cellY, 123) > baseChance + edgeBonus) continue;

      const detail = weightedPick(DETAIL_TILES, hash01(cellX, cellY, 124));
      const scale = 0.86 + hash01(cellX, cellY, 125) * 0.24;
      const kind = detail.key === 'firefly_glow'
        ? 'forest_fx'
        : detail.key.includes('bush')
          ? 'forest_bush'
          : 'forest_detail';
      addObject(detail, point, kind, scale);
    }
  }

  treeAnchors.forEach((tree, treeIndex) => {
    if (treeIndex % 3 !== 0) return;
    const detail = weightedPick(DETAIL_TILES.filter((tile) => ['leaf_patch', 'forest_shadow', 'ivy_patch', 'grass_tuft'].includes(tile.key)), hash01(tree.x, tree.y, 331));
    const point = {
      x: tree.x + (hash01(tree.x, tree.y, 332) - 0.5) * 78,
      y: tree.y + 16 + (hash01(tree.x, tree.y, 333) - 0.5) * 28,
    };
    if (pointInPolygon(point, polygon)
      && !hasTileNear(map, layerDataByName, avoidLayers, point.x, point.y, 1)) {
      addObject(detail, point, 'forest_detail', 0.9);
    }
  });

  objects.sort((a, b) => (Number(a.y ?? 0) - Number(b.y ?? 0)) || (Number(a.x ?? 0) - Number(b.x ?? 0)));
  return objects;
}

function objectVisualBounds(object) {
  const x = Number(object.x ?? 0);
  const y = Number(object.y ?? 0);
  const width = Math.max(1, Number(object.width ?? 1));
  const height = Math.max(1, Number(object.height ?? 1));
  const hasGid = Number(object.gid ?? 0) > 0;
  return {
    x,
    y: hasGid ? y - height : y,
    width,
    height,
  };
}

function objectIntersectsChunk(object, chunk) {
  const bounds = objectVisualBounds(object);
  const chunkBounds = {
    x: Number(chunk.x ?? chunk.tileX ?? 0) * TILE,
    y: Number(chunk.y ?? chunk.tileY ?? 0) * TILE,
    width: Number(chunk.width ?? 128) * TILE,
    height: Number(chunk.height ?? 128) * TILE,
  };
  return bounds.x < chunkBounds.x + chunkBounds.width
    && bounds.x + bounds.width > chunkBounds.x
    && bounds.y < chunkBounds.y + chunkBounds.height
    && bounds.y + bounds.height > chunkBounds.y;
}

function convertRegionGidToChunk(gid, mapFirstgid, chunkFirstgid) {
  const value = Number(gid ?? 0);
  if (value >= mapFirstgid && value < mapFirstgid + TILECOUNT) {
    return value + (chunkFirstgid - mapFirstgid);
  }
  return value;
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

function updateChunk(chunkInfo, forestObjects, mapFirstgid, chunkFirstgid) {
  const chunkPath = path.join(CHUNK_DIR, chunkInfo.file);
  if (!existsSync(chunkPath)) return { changed: false, objects: 0 };
  const chunk = readJson(chunkPath);
  const layer = objectLayer(chunk, FOREST_LAYER_NAME, 'Props');
  const preserved = (layer.objects ?? []).filter((object) => !isGeneratedForestObject(object));
  const chunkOffsetX = Number(chunkInfo.x ?? chunk.tileX ?? 0) * TILE;
  const chunkOffsetY = Number(chunkInfo.y ?? chunk.tileY ?? 0) * TILE;
  const localObjects = forestObjects
    .filter((object) => objectIntersectsChunk(object, chunkInfo))
    .map((object) => ({
      ...object,
      gid: convertRegionGidToChunk(object.gid, mapFirstgid, chunkFirstgid),
      x: Number(object.x ?? 0) - chunkOffsetX,
      y: Number(object.y ?? 0) - chunkOffsetY,
      sourceMapId: MAP_ID,
    }));

  const before = JSON.stringify(layer.objects ?? []);
  layer.objects = [...preserved, ...localObjects]
    .sort((a, b) => (Number(a.y ?? 0) - Number(b.y ?? 0)) || (Number(a.x ?? 0) - Number(b.x ?? 0)));
  const after = JSON.stringify(layer.objects ?? []);
  const hadGenerated = before !== JSON.stringify(preserved);
  if (!localObjects.length && !hadGenerated) return { changed: false, objects: 0 };

  chunk.version = CHUNK_VERSION;
  writeJson(chunkPath, chunk, false);
  return { changed: before !== after || chunk.version !== CHUNK_VERSION, objects: localObjects.length };
}

function updateRegionMap() {
  const map = readJson(MAP_PATH);
  const mapFirstgid = upsertTileset(map.tilesets, MAP_TILESET_SOURCE, MAP_PATH);
  const forestLayer = objectLayer(map, FOREST_LAYER_NAME, 'Props');
  forestLayer.draworder = 'topdown';
  forestLayer.objects = (forestLayer.objects ?? []).filter((object) => !isGeneratedForestObject(object));

  const forestObjects = generateForestObjects(map, forestLayer, mapFirstgid);
  forestLayer.objects = [
    ...forestLayer.objects,
    ...forestObjects,
  ].sort((a, b) => {
    if (a.name === FOREST_AREA_NAME) return -1;
    if (b.name === FOREST_AREA_NAME) return 1;
    return (Number(a.y ?? 0) - Number(b.y ?? 0)) || (Number(a.x ?? 0) - Number(b.x ?? 0));
  });
  map.nextobjectid = Math.max(Number(map.nextobjectid ?? 1), maxObjectId(map) + 1);
  writeJson(MAP_PATH, map, true);
  return { mapFirstgid, forestObjects };
}

function updateChunkIndex() {
  const index = readJson(CHUNK_INDEX_PATH);
  const chunkFirstgid = upsertTileset(index.tilesets, CHUNK_TILESET_SOURCE, CHUNK_INDEX_PATH);
  index.version = CHUNK_VERSION;
  if (!Array.isArray(index.objectLayers)) index.objectLayers = [];
  if (!index.objectLayers.includes(FOREST_LAYER_NAME)) index.objectLayers.push(FOREST_LAYER_NAME);
  writeJson(CHUNK_INDEX_PATH, index, true);
  return { chunkFirstgid, chunks: index.chunks ?? [] };
}

function updateChunks(chunks, forestObjects, mapFirstgid, chunkFirstgid) {
  let changedChunks = 0;
  let chunkObjects = 0;
  chunks.forEach((chunk) => {
    const result = updateChunk(chunk, forestObjects, mapFirstgid, chunkFirstgid);
    if (result.changed) changedChunks += 1;
    chunkObjects += result.objects;
  });
  return { changedChunks, chunkObjects };
}

writeTilesetAssets();
const { mapFirstgid, forestObjects } = updateRegionMap();
const { chunkFirstgid, chunks } = updateChunkIndex();
const { changedChunks, chunkObjects } = updateChunks(chunks, forestObjects, mapFirstgid, chunkFirstgid);

const counts = forestObjects.reduce((summary, object) => {
  const type = getProperties(object).type ?? 'unknown';
  summary[type] = (summary[type] ?? 0) + 1;
  return summary;
}, {});

console.log(JSON.stringify({
  tileset: SHEET_NAME,
  mapFirstgid,
  chunkFirstgid,
  objects: forestObjects.length,
  counts,
  changedChunks,
  chunkObjects,
  collision: 'unchanged',
}, null, 2));
