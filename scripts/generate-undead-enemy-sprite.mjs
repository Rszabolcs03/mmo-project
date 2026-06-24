import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ENEMY_DIR = join(ROOT, 'public', 'assets', 'enemies');

function rgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function canvas(width, height) {
  return new Uint8Array(width * height * 4);
}

function pixel(buffer, width, height, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const value = Array.isArray(color) ? color : rgba(color);
  const index = (Math.floor(y) * width + Math.floor(x)) * 4;
  buffer[index] = value[0];
  buffer[index + 1] = value[1];
  buffer[index + 2] = value[2];
  buffer[index + 3] = value[3];
}

function rect(buffer, width, height, x, y, w, h, color, alpha = 255) {
  const value = rgba(color, alpha);
  for (let yy = Math.round(y); yy < Math.round(y + h); yy += 1) {
    for (let xx = Math.round(x); xx < Math.round(x + w); xx += 1) {
      pixel(buffer, width, height, xx, yy, value);
    }
  }
}

function ellipse(buffer, width, height, cx, cy, rx, ry, color, alpha = 255) {
  const value = rgba(color, alpha);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) pixel(buffer, width, height, x, y, value);
    }
  }
}

function line(buffer, width, height, x1, y1, x2, y2, size, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    rect(buffer, width, height, x1 + (x2 - x1) * t - size / 2, y1 + (y2 - y1) * t - size / 2, size, size, color);
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

function encodePng(data, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1);
    raw[start] = 0;
    Buffer.from(data.buffer, y * width * 4, width * 4).copy(raw, start + 1);
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

function drawUndeadFrame(buffer, width, height, frame, ox) {
  const limp = frame === 1 ? -4 : frame === 3 ? 4 : 0;
  const bob = frame % 2 ? -1 : 0;
  ellipse(buffer, width, height, ox + 32, 54, 23, 6, '#000000', 75);
  line(buffer, width, height, ox + 22, 34 + bob, ox + 9, 45 + limp, 6, '#26313d');
  line(buffer, width, height, ox + 43, 34 + bob, ox + 56, 43 - limp, 6, '#26313d');
  line(buffer, width, height, ox + 22, 34 + bob, ox + 10, 44 + limp, 3, '#7c8794');
  line(buffer, width, height, ox + 43, 34 + bob, ox + 55, 42 - limp, 3, '#7c8794');
  rect(buffer, width, height, ox + 21, 26 + bob, 23, 23, '#26313d');
  rect(buffer, width, height, ox + 24, 29 + bob, 17, 17, '#7c8794');
  rect(buffer, width, height, ox + 26, 17 + bob, 15, 13, '#26313d');
  rect(buffer, width, height, ox + 28, 19 + bob, 11, 9, '#9aa6b2');
  rect(buffer, width, height, ox + 29, 22 + bob, 3, 3, '#a7f3d0');
  rect(buffer, width, height, ox + 36, 22 + bob, 3, 3, '#a7f3d0');
  rect(buffer, width, height, ox + 30, 28 + bob, 8, 2, '#111827');
  rect(buffer, width, height, ox + 26, 47 + bob, 6, 13 + limp, '#26313d');
  rect(buffer, width, height, ox + 35, 47 + bob, 6, 13 - limp, '#26313d');
  rect(buffer, width, height, ox + 27, 48 + bob, 3, 9 + limp, '#7c8794');
  rect(buffer, width, height, ox + 36, 48 + bob, 3, 9 - limp, '#7c8794');
  rect(buffer, width, height, ox + 20, 33 + bob, 4, 13, '#4b5563');
  rect(buffer, width, height, ox + 40, 31 + bob, 4, 15, '#4b5563');
}

mkdirSync(ENEMY_DIR, { recursive: true });
const frameWidth = 64;
const frameHeight = 64;
const frames = 4;
const width = frameWidth * frames;
const height = frameHeight;
const data = canvas(width, height);
for (let frame = 0; frame < frames; frame += 1) {
  drawUndeadFrame(data, width, height, frame, frame * frameWidth);
}
writeFileSync(join(ENEMY_DIR, 'undead.png'), encodePng(data, width, height));
console.log('Generated undead.png');
