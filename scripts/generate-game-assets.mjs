import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SPRITES_DIR = join(ROOT, 'public', 'assets', 'sprites');
const ENEMIES_DIR = join(ROOT, 'public', 'assets', 'enemies');

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
  const sx = Math.round(x);
  const sy = Math.round(y);
  const ex = Math.round(x + width);
  const ey = Math.round(y + height);
  for (let yy = sy; yy < ey; yy += 1) {
    for (let xx = sx; xx < ex; xx += 1) {
      setPixel(buffer, canvasWidth, canvasHeight, xx, yy, rgba);
    }
  }
}

function line(buffer, canvasWidth, canvasHeight, x1, y1, x2, y2, size, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    rect(
      buffer,
      canvasWidth,
      canvasHeight,
      x1 + (x2 - x1) * t - size / 2,
      y1 + (y2 - y1) * t - size / 2,
      size,
      size,
      color,
    );
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

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
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
  console.log(`Generated ${path}`);
}

function drawAbilitySlot() {
  const width = 84;
  const height = 84;
  const buffer = createCanvas(width, height);
  const dark = '#102028';
  const mid = '#24434b';
  const bright = '#78e6f5';
  const brass = '#c4973f';

  rect(buffer, width, height, 8, 4, 68, 76, '#061015', 230);
  rect(buffer, width, height, 4, 10, 76, 64, '#061015', 230);
  rect(buffer, width, height, 10, 8, 64, 68, dark, 255);
  rect(buffer, width, height, 13, 11, 58, 62, mid, 200);
  rect(buffer, width, height, 17, 15, 50, 50, '#0b1a20', 235);
  rect(buffer, width, height, 21, 19, 42, 42, '#152b31', 255);
  rect(buffer, width, height, 21, 19, 42, 2, bright, 150);
  rect(buffer, width, height, 21, 59, 42, 2, '#081116', 255);
  rect(buffer, width, height, 21, 19, 2, 42, bright, 110);
  rect(buffer, width, height, 61, 19, 2, 42, '#071015', 255);
  rect(buffer, width, height, 12, 8, 10, 4, bright, 180);
  rect(buffer, width, height, 62, 8, 10, 4, bright, 180);
  rect(buffer, width, height, 12, 72, 10, 4, brass, 170);
  rect(buffer, width, height, 62, 72, 10, 4, brass, 170);
  rect(buffer, width, height, 31, 68, 22, 4, bright, 120);
  return { buffer, width, height };
}

function drawWolfFrame(buffer, canvasWidth, canvasHeight, frame, ox, oy) {
  const step = frame === 1 ? -3 : frame === 3 ? 3 : 0;
  const bounce = frame === 0 || frame === 2 ? 0 : -1;
  const body = frame % 2 === 0 ? '#3e4755' : '#465262';
  const shade = '#242b36';
  const outline = '#111820';
  const eye = '#bde9ff';

  ellipse(buffer, canvasWidth, canvasHeight, ox + 31, oy + 47, 25, 6, '#000000', 70);
  line(buffer, canvasWidth, canvasHeight, ox + 17, oy + 30 + bounce, ox + 4, oy + 23 + bounce, 6, outline);
  line(buffer, canvasWidth, canvasHeight, ox + 17, oy + 29 + bounce, ox + 4, oy + 22 + bounce, 3, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 14, oy + 25 + bounce, 33, 17, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 17, oy + 27 + bounce, 27, 12, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 21, oy + 34 + bounce, 22, 6, shade);
  rect(buffer, canvasWidth, canvasHeight, ox + 44, oy + 18 + bounce, 17, 20, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 47, oy + 21 + bounce, 11, 14, '#596679');
  rect(buffer, canvasWidth, canvasHeight, ox + 45, oy + 11 + bounce, 6, 10, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 54, oy + 10 + bounce, 6, 11, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 47, oy + 14 + bounce, 3, 7, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 55, oy + 14 + bounce, 3, 7, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 50, oy + 25 + bounce, 3, 3, eye);
  rect(buffer, canvasWidth, canvasHeight, ox + 57, oy + 25 + bounce, 3, 3, eye);
  rect(buffer, canvasWidth, canvasHeight, ox + 52, oy + 33 + bounce, 7, 3, '#0b1120');
  rect(buffer, canvasWidth, canvasHeight, ox + 19, oy + 38 + bounce, 5, 13 + step, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 33, oy + 38 + bounce, 5, 13 - step, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 20, oy + 39 + bounce, 3, 9 + step, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 34, oy + 39 + bounce, 3, 9 - step, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 18, oy + 50 + step, 8, 3, '#121820');
  rect(buffer, canvasWidth, canvasHeight, ox + 32, oy + 50 - step, 8, 3, '#121820');
}

function drawBriarheartFrame(buffer, canvasWidth, canvasHeight, frame, ox, oy) {
  const pulse = frame === 1 || frame === 3 ? -2 : 0;
  const arm = frame === 1 ? -4 : frame === 3 ? 4 : 0;
  const outline = '#14100c';
  const bark = '#6b4427';
  const barkDark = '#3b2417';
  const moss = '#496b37';
  const glow = frame % 2 === 0 ? '#8cff7a' : '#d3ff8a';

  ellipse(buffer, canvasWidth, canvasHeight, ox + 48, oy + 78, 35, 8, '#000000', 80);
  rect(buffer, canvasWidth, canvasHeight, ox + 31, oy + 30 + pulse, 34, 45, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 35, oy + 34 + pulse, 26, 37, bark);
  rect(buffer, canvasWidth, canvasHeight, ox + 38, oy + 38 + pulse, 5, 31, barkDark);
  rect(buffer, canvasWidth, canvasHeight, ox + 53, oy + 36 + pulse, 4, 32, '#8a5a31');
  rect(buffer, canvasWidth, canvasHeight, ox + 33, oy + 25 + pulse, 30, 12, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 36, oy + 26 + pulse, 24, 9, moss);
  rect(buffer, canvasWidth, canvasHeight, ox + 26, oy + 18 + pulse, 8, 16, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 63, oy + 18 + pulse, 8, 16, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 28, oy + 15 + pulse, 5, 13, '#9a6a36');
  rect(buffer, canvasWidth, canvasHeight, ox + 65, oy + 15 + pulse, 5, 13, '#9a6a36');
  line(buffer, canvasWidth, canvasHeight, ox + 31, oy + 19 + pulse, ox + 21, oy + 8 + pulse, 5, outline);
  line(buffer, canvasWidth, canvasHeight, ox + 67, oy + 19 + pulse, ox + 78, oy + 8 + pulse, 5, outline);
  line(buffer, canvasWidth, canvasHeight, ox + 31, oy + 19 + pulse, ox + 21, oy + 8 + pulse, 3, '#9a6a36');
  line(buffer, canvasWidth, canvasHeight, ox + 67, oy + 19 + pulse, ox + 78, oy + 8 + pulse, 3, '#9a6a36');
  line(buffer, canvasWidth, canvasHeight, ox + 35, oy + 43 + pulse, ox + 17, oy + 56 + arm, 8, outline);
  line(buffer, canvasWidth, canvasHeight, ox + 61, oy + 43 + pulse, ox + 79, oy + 56 - arm, 8, outline);
  line(buffer, canvasWidth, canvasHeight, ox + 36, oy + 43 + pulse, ox + 19, oy + 55 + arm, 5, bark);
  line(buffer, canvasWidth, canvasHeight, ox + 60, oy + 43 + pulse, ox + 77, oy + 55 - arm, 5, bark);
  rect(buffer, canvasWidth, canvasHeight, ox + 38, oy + 73 + pulse, 9, 14 - arm / 2, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 51, oy + 73 + pulse, 9, 14 + arm / 2, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 40, oy + 74 + pulse, 5, 10 - arm / 2, barkDark);
  rect(buffer, canvasWidth, canvasHeight, ox + 53, oy + 74 + pulse, 5, 10 + arm / 2, barkDark);
  rect(buffer, canvasWidth, canvasHeight, ox + 43, oy + 46 + pulse, 12, 10, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 45, oy + 48 + pulse, 8, 6, glow);
  rect(buffer, canvasWidth, canvasHeight, ox + 39, oy + 29 + pulse, 5, 5, '#d7ffcf');
  rect(buffer, canvasWidth, canvasHeight, ox + 53, oy + 29 + pulse, 5, 5, '#d7ffcf');
  rect(buffer, canvasWidth, canvasHeight, ox + 43, oy + 62 + pulse, 13, 4, '#24130d');
}

function drawSheet(frameWidth, frameHeight, frames, drawFrame) {
  const width = frameWidth * frames;
  const height = frameHeight;
  const buffer = createCanvas(width, height);
  for (let frame = 0; frame < frames; frame += 1) {
    drawFrame(buffer, width, height, frame, frame * frameWidth, 0);
  }
  return { buffer, width, height };
}

mkdirSync(SPRITES_DIR, { recursive: true });
mkdirSync(ENEMIES_DIR, { recursive: true });

const slot = drawAbilitySlot();
savePng(join(SPRITES_DIR, 'ability-slot-holder.png'), slot.buffer, slot.width, slot.height);

const wolf = drawSheet(64, 64, 4, drawWolfFrame);
savePng(join(ENEMIES_DIR, 'wolf.png'), wolf.buffer, wolf.width, wolf.height);

const boss = drawSheet(96, 96, 4, drawBriarheartFrame);
savePng(join(ENEMIES_DIR, 'elder-briarheart.png'), boss.buffer, boss.width, boss.height);
