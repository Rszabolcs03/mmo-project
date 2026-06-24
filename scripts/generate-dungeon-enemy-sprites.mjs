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
  const index = (Math.floor(y) * width + Math.floor(x)) * 4;
  const value = Array.isArray(color) ? color : rgba(color);
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

function saveSheet(name, frameWidth, frameHeight, drawFrame) {
  const frames = 4;
  const width = frameWidth * frames;
  const height = frameHeight;
  const b = canvas(width, height);
  for (let frame = 0; frame < frames; frame += 1) {
    drawFrame(b, width, height, frame, frame * frameWidth, 0);
  }
  writeFileSync(join(ENEMY_DIR, `${name}.png`), encodePng(b, width, height));
  console.log(`Generated ${name}.png`);
}

function drawCaveStalker(b, w, h, frame, ox) {
  const bob = frame % 2 ? -2 : 0;
  const wing = frame === 1 ? -6 : frame === 3 ? 6 : 0;
  ellipse(b, w, h, ox + 32, 54, 24, 5, '#000000', 75);
  line(b, w, h, ox + 29, 28 + bob, ox + 7, 14 + bob + wing, 8, '#111827');
  line(b, w, h, ox + 35, 28 + bob, ox + 57, 14 + bob - wing, 8, '#111827');
  line(b, w, h, ox + 29, 29 + bob, ox + 9, 17 + bob + wing, 5, '#475569');
  line(b, w, h, ox + 35, 29 + bob, ox + 55, 17 + bob - wing, 5, '#475569');
  ellipse(b, w, h, ox + 32, 34 + bob, 15, 19, '#0f172a');
  ellipse(b, w, h, ox + 32, 35 + bob, 10, 15, '#64748b');
  rect(b, w, h, ox + 23, 18 + bob, 18, 10, '#111827');
  rect(b, w, h, ox + 26, 20 + bob, 12, 7, '#334155');
  rect(b, w, h, ox + 26, 30 + bob, 4, 4, '#c4b5fd');
  rect(b, w, h, ox + 35, 30 + bob, 4, 4, '#c4b5fd');
  rect(b, w, h, ox + 28, 45 + bob, 4, 9, '#0f172a');
  rect(b, w, h, ox + 34, 45 + bob, 4, 9, '#0f172a');
}

function drawMagmaCrawler(b, w, h, frame, ox) {
  const walk = frame === 1 ? -4 : frame === 3 ? 4 : 0;
  const glow = frame % 2 ? '#fde047' : '#fb923c';
  ellipse(b, w, h, ox + 32, 54, 25, 5, '#000000', 80);
  for (let i = 0; i < 3; i += 1) {
    line(b, w, h, ox + 18, 29 + i * 7, ox + 4, 32 + i * 5 + walk, 5, '#451a03');
    line(b, w, h, ox + 46, 29 + i * 7, ox + 60, 32 + i * 5 - walk, 5, '#451a03');
    line(b, w, h, ox + 18, 29 + i * 7, ox + 6, 32 + i * 5 + walk, 2, '#f97316');
    line(b, w, h, ox + 46, 29 + i * 7, ox + 58, 32 + i * 5 - walk, 2, '#f97316');
  }
  ellipse(b, w, h, ox + 49, 28, 11, 10, '#1c1917');
  ellipse(b, w, h, ox + 49, 28, 7, 7, '#991b1b');
  ellipse(b, w, h, ox + 32, 36, 24, 17, '#1c1917');
  ellipse(b, w, h, ox + 32, 35, 19, 13, '#7f1d1d');
  ellipse(b, w, h, ox + 24, 36, 7, 8, '#991b1b');
  ellipse(b, w, h, ox + 40, 36, 7, 8, '#991b1b');
  rect(b, w, h, ox + 18, 32, 28, 5, '#b91c1c');
  rect(b, w, h, ox + 24, 23, 5, 24, glow);
  rect(b, w, h, ox + 35, 23, 5, 24, glow);
  rect(b, w, h, ox + 45, 25, 4, 4, '#fef3c7');
  rect(b, w, h, ox + 53, 25, 4, 4, '#fef3c7');
  line(b, w, h, ox + 56, 30, ox + 63, 24 + walk / 2, 3, '#fef3c7');
  line(b, w, h, ox + 56, 33, ox + 63, 39 - walk / 2, 3, '#fef3c7');
}

function drawDeepBurrower(b, w, h, frame, ox) {
  const sway = frame === 1 ? -4 : frame === 3 ? 4 : 0;
  ellipse(b, w, h, ox + 32, 55, 25, 5, '#000000', 70);
  for (let i = 0; i < 4; i += 1) {
    ellipse(b, w, h, ox + 20 + i * 9, 39 - i * 3 + (i % 2 ? sway / 2 : -sway / 2), 10, 11, '#292524');
    ellipse(b, w, h, ox + 20 + i * 9, 38 - i * 3 + (i % 2 ? sway / 2 : -sway / 2), 7, 8, '#78716c');
  }
  ellipse(b, w, h, ox + 47, 23 + sway / 2, 13, 14, '#292524');
  ellipse(b, w, h, ox + 47, 23 + sway / 2, 9, 10, '#a08a63');
  line(b, w, h, ox + 40, 16 + sway / 2, ox + 31, 4 + sway, 4, '#d6c190');
  line(b, w, h, ox + 52, 16 + sway / 2, ox + 61, 4 - sway, 4, '#d6c190');
  rect(b, w, h, ox + 43, 22 + sway / 2, 3, 3, '#fef3c7');
  rect(b, w, h, ox + 51, 22 + sway / 2, 3, 3, '#fef3c7');
}

function drawObsidianSentinel(b, w, h, frame, ox) {
  const step = frame === 1 ? -3 : frame === 3 ? 3 : 0;
  ellipse(b, w, h, ox + 32, 55, 24, 6, '#000000', 85);
  rect(b, w, h, ox + 16, 20, 9, 11, '#020617');
  rect(b, w, h, ox + 40, 20, 9, 11, '#020617');
  rect(b, w, h, ox + 18, 22, 6, 8, '#475569');
  rect(b, w, h, ox + 41, 22, 6, 8, '#475569');
  rect(b, w, h, ox + 19, 20, 27, 32, '#020617');
  rect(b, w, h, ox + 22, 23, 21, 26, '#334155');
  rect(b, w, h, ox + 24, 12, 17, 13, '#020617');
  rect(b, w, h, ox + 27, 15, 11, 8, '#1f2937');
  rect(b, w, h, ox + 29, 18, 7, 3, '#67e8f9');
  line(b, w, h, ox + 19, 29, ox + 7, 42 + step, 8, '#020617');
  line(b, w, h, ox + 46, 29, ox + 58, 42 - step, 8, '#020617');
  line(b, w, h, ox + 19, 29, ox + 9, 41 + step, 4, '#475569');
  line(b, w, h, ox + 46, 29, ox + 56, 41 - step, 4, '#475569');
  rect(b, w, h, ox + 25, 50, 7, 11 + step, '#020617');
  rect(b, w, h, ox + 35, 50, 7, 11 - step, '#020617');
  rect(b, w, h, ox + 20, 32, 25, 4, '#0f172a');
  rect(b, w, h, ox + 30, 24, 5, 22, '#67e8f9', 190);
}

function drawGloomfang(b, w, h, frame, ox) {
  const bob = frame % 2 ? -2 : 0;
  const claw = frame === 1 ? -5 : frame === 3 ? 5 : 0;
  ellipse(b, w, h, ox + 48, 82, 34, 8, '#000000', 85);
  line(b, w, h, ox + 30, 47 + bob, ox + 12, 62 + claw, 10, '#1e1b4b');
  line(b, w, h, ox + 66, 47 + bob, ox + 84, 62 - claw, 10, '#1e1b4b');
  ellipse(b, w, h, ox + 48, 53 + bob, 29, 28, '#1e1b4b');
  ellipse(b, w, h, ox + 48, 52 + bob, 21, 21, '#581c87');
  rect(b, w, h, ox + 32, 24 + bob, 32, 20, '#111827');
  rect(b, w, h, ox + 36, 28 + bob, 24, 14, '#6d28d9');
  line(b, w, h, ox + 34, 24 + bob, ox + 24, 9 + bob, 5, '#a3e635');
  line(b, w, h, ox + 62, 24 + bob, ox + 72, 9 + bob, 5, '#a3e635');
  rect(b, w, h, ox + 39, 34 + bob, 6, 6, '#d9f99d');
  rect(b, w, h, ox + 52, 34 + bob, 6, 6, '#d9f99d');
  rect(b, w, h, ox + 38, 63 + bob, 8, 18 + claw / 2, '#111827');
  rect(b, w, h, ox + 51, 63 + bob, 8, 18 - claw / 2, '#111827');
}

function drawWarden(b, w, h, frame, ox) {
  const swing = frame === 1 ? -7 : frame === 3 ? 7 : 0;
  ellipse(b, w, h, ox + 48, 83, 34, 8, '#000000', 90);
  rect(b, w, h, ox + 27, 26, 11, 15, '#1c1917');
  rect(b, w, h, ox + 59, 26, 11, 15, '#1c1917');
  rect(b, w, h, ox + 30, 28, 7, 11, '#991b1b');
  rect(b, w, h, ox + 60, 28, 7, 11, '#991b1b');
  rect(b, w, h, ox + 31, 30, 35, 43, '#1c1917');
  rect(b, w, h, ox + 36, 34, 25, 35, '#7f1d1d');
  rect(b, w, h, ox + 38, 18, 22, 17, '#1c1917');
  rect(b, w, h, ox + 42, 22, 14, 10, '#991b1b');
  rect(b, w, h, ox + 41, 28, 16, 4, '#f97316');
  line(b, w, h, ox + 31, 43, ox + 17, 58 - swing, 7, '#1c1917');
  line(b, w, h, ox + 67, 29, ox + 82, 61 + swing, 8, '#1c1917');
  line(b, w, h, ox + 82, 20 + swing, ox + 82, 78 + swing, 5, '#f97316');
  rect(b, w, h, ox + 76, 18 + swing, 13, 7, '#fed7aa');
  rect(b, w, h, ox + 39, 70, 8, 18 - swing / 3, '#1c1917');
  rect(b, w, h, ox + 52, 70, 8, 18 + swing / 3, '#1c1917');
}

function drawCrystalHorror(b, w, h, frame, ox) {
  const pulse = frame % 2 ? -2 : 1;
  ellipse(b, w, h, ox + 48, 83, 33, 8, '#000000', 75);
  for (let i = 0; i < 7; i += 1) {
    const angle = (Math.PI * 2 * i) / 7;
    line(b, w, h, ox + 48, 51 + pulse, ox + 48 + Math.cos(angle) * 30, 51 + pulse + Math.sin(angle) * 25, 7, '#0f172a');
    line(b, w, h, ox + 48, 51 + pulse, ox + 48 + Math.cos(angle) * 25, 51 + pulse + Math.sin(angle) * 21, 4, '#67e8f9');
  }
  ellipse(b, w, h, ox + 48, 51 + pulse, 22, 22, '#164e63');
  ellipse(b, w, h, ox + 48, 51 + pulse, 13, 13, '#a5f3fc');
  rect(b, w, h, ox + 42, 44 + pulse, 5, 5, '#0f172a');
  rect(b, w, h, ox + 51, 44 + pulse, 5, 5, '#0f172a');
}

function drawRiftHeart(b, w, h, frame, ox) {
  const pulse = frame % 2 ? 4 : 0;
  ellipse(b, w, h, ox + 48, 84, 35, 8, '#000000', 80);
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8 + frame * 0.35;
    ellipse(b, w, h, ox + 48 + Math.cos(angle) * (32 + pulse), 48 + Math.sin(angle) * (30 + pulse), 5, 5, i % 2 ? '#f0abfc' : '#a78bfa');
  }
  ellipse(b, w, h, ox + 48, 49, 30 + pulse / 2, 27 + pulse / 2, '#111827');
  ellipse(b, w, h, ox + 48, 49, 21 + pulse / 3, 19 + pulse / 3, '#4c1d95');
  ellipse(b, w, h, ox + 48, 49, 11 + pulse / 4, 11 + pulse / 4, '#f0abfc');
  line(b, w, h, ox + 18, 49, ox + 78, 49, 3, '#a78bfa');
  line(b, w, h, ox + 48, 19, ox + 48, 79, 3, '#a78bfa');
}

mkdirSync(ENEMY_DIR, { recursive: true });

saveSheet('cave-stalker', 64, 64, drawCaveStalker);
saveSheet('magma-crawler', 64, 64, drawMagmaCrawler);
saveSheet('deep-burrower', 64, 64, drawDeepBurrower);
saveSheet('obsidian-sentinel', 64, 64, drawObsidianSentinel);
saveSheet('gloomfang-matriarch', 96, 96, drawGloomfang);
saveSheet('lava-forged-warden', 96, 96, drawWarden);
saveSheet('crystal-horror', 96, 96, drawCrystalHorror);
saveSheet('rift-heart', 96, 96, drawRiftHeart);
