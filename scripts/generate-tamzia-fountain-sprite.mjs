import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'public', 'assets', 'tilesets');
const TSX_DIR = join(ROOT, 'public', 'tilesets');
const CONTINENT_TILESET_DIR = join(ROOT, 'public', 'maps', 'world_map', 'continents', 'continent_01', 'tilesets');
const SHEET_NAME = 'tamzia_fountain_v1';
const FRAME_WIDTH = 176;
const FRAME_HEIGHT = 176;
const FRAME_COUNT = 6;
const WIDTH = FRAME_WIDTH * FRAME_COUNT;
const HEIGHT = FRAME_HEIGHT;

function hexToRgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function blendPixel(png, x, y, rgba) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (Math.floor(y) * png.width + Math.floor(x)) * 4;
  const srcAlpha = rgba[3] / 255;
  const dstAlpha = png.data[index + 3] / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
  if (outAlpha <= 0) return;

  png.data[index] = Math.round((rgba[0] * srcAlpha + png.data[index] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  png.data[index + 1] = Math.round((rgba[1] * srcAlpha + png.data[index + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  png.data[index + 2] = Math.round((rgba[2] * srcAlpha + png.data[index + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  png.data[index + 3] = Math.round(outAlpha * 255);
}

function pixel(png, x, y, color, alpha = 255) {
  blendPixel(png, Math.round(x), Math.round(y), hexToRgba(color, alpha));
}

function rect(png, x, y, width, height, color, alpha = 255) {
  const rgba = hexToRgba(color, alpha);
  const sx = Math.round(x);
  const sy = Math.round(y);
  const ex = Math.round(x + width);
  const ey = Math.round(y + height);
  for (let yy = sy; yy < ey; yy += 1) {
    for (let xx = sx; xx < ex; xx += 1) {
      blendPixel(png, xx, yy, rgba);
    }
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

function ellipseRing(png, cx, cy, outerRx, outerRy, innerRx, innerRy, color, alpha = 255) {
  const rgba = hexToRgba(color, alpha);
  for (let y = Math.floor(cy - outerRy); y <= Math.ceil(cy + outerRy); y += 1) {
    for (let x = Math.floor(cx - outerRx); x <= Math.ceil(cx + outerRx); x += 1) {
      const ox = (x - cx) / outerRx;
      const oy = (y - cy) / outerRy;
      const ix = (x - cx) / innerRx;
      const iy = (y - cy) / innerRy;
      if (ox * ox + oy * oy <= 1 && ix * ix + iy * iy > 1) blendPixel(png, x, y, rgba);
    }
  }
}

function line(png, x1, y1, x2, y2, size, color, alpha = 255) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
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

function ellipseDash(png, cx, cy, rx, ry, phase, color, alpha = 255, thickness = 2, dash = 0.5) {
  for (let step = 0; step < 160; step += 1) {
    const angle = (step / 160) * Math.PI * 2;
    const band = (Math.sin(angle * 5 + phase) + 1) / 2;
    if (band < dash) continue;
    const x = cx + Math.cos(angle) * rx;
    const y = cy + Math.sin(angle) * ry;
    rect(png, x - thickness / 2, y - thickness / 2, thickness, thickness, color, alpha);
  }
}

function diamond(png, cx, cy, radiusX, radiusY, color, alpha = 255) {
  const rgba = hexToRgba(color, alpha);
  for (let y = Math.floor(cy - radiusY); y <= Math.ceil(cy + radiusY); y += 1) {
    for (let x = Math.floor(cx - radiusX); x <= Math.ceil(cx + radiusX); x += 1) {
      if (Math.abs((x - cx) / radiusX) + Math.abs((y - cy) / radiusY) <= 1) {
        blendPixel(png, x, y, rgba);
      }
    }
  }
}

function drawStoneChip(png, x, y, color, alpha = 255) {
  rect(png, x, y, 5, 2, color, alpha);
  rect(png, x + 1, y + 2, 3, 1, color, Math.max(0, alpha - 35));
}

function drawRimLantern(png, x, y, phase, warm = true) {
  const glow = warm ? '#ffc96f' : '#9ff7ff';
  const metal = warm ? '#5b3a25' : '#43545a';
  ellipse(png, x, y + 1, 10, 5, '#000000', 42);
  ellipse(png, x, y, 7, 4, glow, 42 + Math.round((Math.sin(phase + x * 0.04) + 1) * 18));
  rect(png, x - 4, y - 5, 8, 9, '#2a211a', 220);
  rect(png, x - 2, y - 3, 4, 5, glow, 170);
  rect(png, x - 5, y - 6, 10, 2, metal, 235);
  rect(png, x - 3, y + 3, 6, 2, metal, 225);
}

function drawStoneTicks(png, ox, oy, frame) {
  const cx = ox + 88;
  const cy = oy + 91;
  const tickColors = ['#b8ad9c', '#6c665c', '#d2c5ae', '#817869'];
  for (let index = 0; index < 32; index += 1) {
    const angle = (index / 32) * Math.PI * 2;
    const x = cx + Math.cos(angle) * 68;
    const y = cy + Math.sin(angle) * 50;
    const width = index % 4 === 0 ? 8 : 5;
    const height = index % 2 === 0 ? 3 : 2;
    rect(png, x - width / 2, y - height / 2, width, height, tickColors[(index + frame) % tickColors.length], 170);
  }
  drawStoneChip(png, ox + 25, oy + 112, '#5c574f', 180);
  drawStoneChip(png, ox + 43, oy + 122, '#cbc0aa', 150);
  drawStoneChip(png, ox + 124, oy + 111, '#5c574f', 170);
  drawStoneChip(png, ox + 136, oy + 121, '#d6ccb7', 145);
}

function drawWater(png, ox, oy, frame) {
  const phase = (frame / FRAME_COUNT) * Math.PI * 2;
  const cx = ox + 88;
  const cy = oy + 88;
  const shimmer = Math.sin(phase) * 2;

  ellipse(png, cx, cy + 1, 52, 32, '#083d50');
  ellipse(png, cx, cy, 49, 29, '#126b82');
  ellipse(png, cx - 4, cy - 2, 39, 22, '#21a9c3', 150);
  ellipse(png, cx + 11, cy + 3, 23, 13, '#6beaf2', 72);
  ellipse(png, cx - 19, cy + 8, 14, 7, '#082f3d', 80);

  ellipseDash(png, cx, cy + shimmer * 0.25, 40, 22, phase, '#a7f3ff', 150, 2, 0.58);
  ellipseDash(png, cx, cy - 1, 29, 15, phase + 1.7, '#dffcff', 140, 2, 0.62);
  ellipseDash(png, cx, cy + 1, 18, 9, phase + 3.1, '#6ee7f5', 150, 2, 0.48);

  for (let index = 0; index < 10; index += 1) {
    const angle = phase + index * 1.73;
    const x = cx + Math.cos(angle) * (19 + (index % 4) * 6);
    const y = cy + Math.sin(angle) * (9 + (index % 3) * 4);
    rect(png, x - 2, y - 1, 4, 2, index % 2 ? '#e8feff' : '#9cf6ff', 160);
  }

  const jetLift = Math.sin(phase) * 4;
  line(png, cx, cy - 15, cx - 24, cy - 28 + jetLift, 3, '#dffcff', 180);
  line(png, cx, cy - 15, cx + 25, cy - 28 - jetLift, 3, '#dffcff', 170);
  line(png, cx, cy - 17, cx - 15, cy - 37 - jetLift, 2, '#75e7ff', 190);
  line(png, cx, cy - 17, cx + 14, cy - 37 + jetLift, 2, '#75e7ff', 190);
  line(png, cx - 5, cy - 13, cx - 36, cy - 18 - jetLift * 0.6, 2, '#9ff7ff', 145);
  line(png, cx + 5, cy - 13, cx + 36, cy - 18 + jetLift * 0.6, 2, '#9ff7ff', 145);
  rect(png, cx - 2, cy - 42 + jetLift * 0.4, 4, 10, '#e8feff', 170);
  rect(png, cx - 4, cy - 47 + jetLift * 0.4, 8, 5, '#8beeff', 145);
  rect(png, cx - 18, cy - 38 - jetLift * 0.3, 5, 4, '#dffcff', 135);
  rect(png, cx + 14, cy - 38 + jetLift * 0.3, 5, 4, '#dffcff', 135);
}

function drawFrame(png, frame) {
  const ox = frame * FRAME_WIDTH;
  const oy = 0;
  const cx = ox + 88;
  const cy = oy + 91;
  const phase = (frame / FRAME_COUNT) * Math.PI * 2;

  ellipse(png, cx, oy + 132, 78, 18, '#000000', 76);
  ellipse(png, cx, cy + 13, 76, 17, '#000000', 38);
  ellipse(png, cx, cy + 9, 75, 54, '#1f1f1c');
  ellipse(png, cx, cy + 7, 71, 51, '#504b43');
  ellipseRing(png, cx, cy - 4, 70, 49, 52, 33, '#8e8576');
  ellipseRing(png, cx, cy - 7, 64, 42, 51, 31, '#d5c7ad', 205);
  ellipseRing(png, cx, cy + 2, 73, 51, 68, 46, '#383630', 200);
  ellipseRing(png, cx, cy - 10, 58, 36, 53, 31, '#efe3c7', 94);
  drawStoneTicks(png, ox, oy, frame);

  drawWater(png, ox, oy, frame);

  ellipse(png, cx, oy + 79, 20, 11, '#34312c');
  ellipse(png, cx, oy + 76, 17, 9, '#948b7d');
  rect(png, cx - 9, oy + 49, 18, 28, '#413d36');
  rect(png, cx - 6, oy + 47, 12, 29, '#a99e8c');
  rect(png, cx + 2, oy + 48, 3, 25, '#ded1b8', 180);
  rect(png, cx - 8, oy + 61, 16, 3, '#615a51', 175);
  ellipse(png, cx, oy + 49, 14, 8, '#34312c');
  ellipse(png, cx, oy + 47, 12, 6, '#c4b9a4');
  diamond(png, cx, oy + 36 + Math.sin(phase) * 1.5, 8, 12, '#e7dec8');
  rect(png, cx - 3, oy + 25 + Math.sin(phase) * 1.5, 6, 14, '#766f64');
  rect(png, cx - 1, oy + 23 + Math.sin(phase) * 1.5, 3, 13, '#fff3d4', 175);
  rect(png, cx - 17, oy + 74, 34, 4, '#4c473f', 190);

  const sparkleAlpha = 92 + Math.round((Math.sin(phase) + 1) * 52);
  ellipse(png, cx, oy + 88, 58, 36, '#48e8ff', 24);
  ellipseDash(png, cx, oy + 88, 56, 34, phase + 0.8, '#dffcff', sparkleAlpha, 2, 0.8);

  drawRimLantern(png, ox + 39, oy + 72, phase, true);
  drawRimLantern(png, ox + 137, oy + 72, phase + 0.9, true);
  drawRimLantern(png, ox + 58, oy + 116, phase + 1.6, false);
  drawRimLantern(png, ox + 118, oy + 116, phase + 2.2, false);

  rect(png, ox + 24, oy + 105, 14, 5, '#d6c8ad', 160);
  rect(png, ox + 137, oy + 105, 13, 5, '#6c665c', 170);
  rect(png, ox + 45, oy + 50, 10, 4, '#c8bca6', 145);
  rect(png, ox + 121, oy + 50, 10, 4, '#6c665c', 150);
}

function makeTsx(imageSource) {
  const frames = Array.from({ length: FRAME_COUNT }, (_, index) => (
    `    <frame tileid="${index}" duration="140"/>`
  )).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${SHEET_NAME}" tilewidth="${FRAME_WIDTH}" tileheight="${FRAME_HEIGHT}" tilecount="${FRAME_COUNT}" columns="${FRAME_COUNT}">
 <image source="${imageSource}" width="${WIDTH}" height="${HEIGHT}"/>
 <tile id="0">
  <animation>
${frames}
  </animation>
 </tile>
</tileset>
`;
}

const png = new PNG({ width: WIDTH, height: HEIGHT, colorType: 6 });
for (let frame = 0; frame < FRAME_COUNT; frame += 1) drawFrame(png, frame);

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TSX_DIR, { recursive: true });
mkdirSync(CONTINENT_TILESET_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, `${SHEET_NAME}.png`), PNG.sync.write(png, {
  colorType: 6,
  inputColorType: 6,
  deflateLevel: 9,
}));
writeFileSync(join(CONTINENT_TILESET_DIR, `${SHEET_NAME}.png`), PNG.sync.write(png, {
  colorType: 6,
  inputColorType: 6,
  deflateLevel: 9,
}));
writeFileSync(join(TSX_DIR, `${SHEET_NAME}.tsx`), makeTsx(`../assets/tilesets/${SHEET_NAME}.png`), 'utf8');
writeFileSync(join(CONTINENT_TILESET_DIR, `${SHEET_NAME}.tsx`), makeTsx(`${SHEET_NAME}.png`), 'utf8');

console.log(`Generated public/assets/tilesets/${SHEET_NAME}.png (${WIDTH}x${HEIGHT}, ${FRAME_COUNT} frames)`);
console.log(`Generated public/tilesets/${SHEET_NAME}.tsx`);
console.log(`Generated public/maps/world_map/continents/continent_01/tilesets/${SHEET_NAME}.tsx`);
