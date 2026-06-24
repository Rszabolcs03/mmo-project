import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ASSET_DIR = join(ROOT, 'public', 'assets', 'tilesets');
const TILESET_DIR = join(ROOT, 'public', 'tilesets');
const MAP_DIR = join(ROOT, 'public', 'maps');
const DOC_DIR = join(ROOT, 'docs');

const TILE = 32;
const MAP_W = 200;
const BLOCK_GID = 64;
const FOLIAGE_FIRST_GID = 513;
const PROPS_FIRST_GID = 769;
const BRIDGE_FIRST_GID = 897;

mkdirSync(ASSET_DIR, { recursive: true });
mkdirSync(TILESET_DIR, { recursive: true });
mkdirSync(MAP_DIR, { recursive: true });
mkdirSync(DOC_DIR, { recursive: true });

function rgba(color, alpha = 255) {
  const clean = color.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function put(buf, width, height, x, y, color, alpha = 255) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const [r, g, b, a] = rgba(color, alpha);
  const i = (Math.floor(y) * width + Math.floor(x)) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

function rect(buf, width, height, x, y, w, h, color, alpha = 255) {
  for (let yy = Math.round(y); yy < Math.round(y + h); yy += 1) {
    for (let xx = Math.round(x); xx < Math.round(x + w); xx += 1) put(buf, width, height, xx, yy, color, alpha);
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
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) put(buf, width, height, x, y, color, alpha);
    }
  }
}

function poly(buf, width, height, points, color, alpha = 255) {
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
      if (inside) put(buf, width, height, x, y, color, alpha);
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

function encodePng(buf, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    Buffer.from(buf.buffer, y * width * 4, width * 4).copy(raw, row + 1);
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

function tileIndex(tx, ty, cols) {
  return ty * cols + tx;
}

function drawTree(buf, width, height, tx, ty, tw, th, colors, pine = false) {
  const x = tx * TILE;
  const y = ty * TILE;
  const w = tw * TILE;
  const h = th * TILE;
  rect(buf, width, height, x + w * 0.42, y + h * 0.62, w * 0.18, h * 0.28, '#4c2f22');
  rect(buf, width, height, x + w * 0.38, y + h * 0.82, w * 0.28, 5, '#2a211b', 120);
  if (pine) {
    for (let i = 0; i < 4; i += 1) {
      const yy = y + 5 + i * h * 0.17;
      poly(buf, width, height, [[x + w * 0.5, yy], [x + w * (0.18 - i * 0.02), yy + h * 0.28], [x + w * (0.82 + i * 0.02), yy + h * 0.28]], colors[i % colors.length]);
      line(buf, width, height, x + w * 0.5, yy + 5, x + w * 0.5, yy + h * 0.26, 2, '#21442e', 160);
    }
    return;
  }
  const blobs = [
    [0.34, 0.28, 0.28, 0.22],
    [0.62, 0.28, 0.28, 0.22],
    [0.48, 0.18, 0.26, 0.21],
    [0.26, 0.47, 0.24, 0.22],
    [0.7, 0.47, 0.24, 0.22],
    [0.5, 0.47, 0.32, 0.26],
  ];
  blobs.forEach((b, i) => ellipse(buf, width, height, x + w * b[0], y + h * b[1], w * b[2], h * b[3], colors[i % colors.length]));
  blobs.slice(1, 5).forEach((b) => ellipse(buf, width, height, x + w * b[0] - 4, y + h * b[1] - 5, w * b[2] * 0.45, h * b[3] * 0.35, '#9bc56a', 90));
  ellipse(buf, width, height, x + w * 0.54, y + h * 0.62, w * 0.32, h * 0.08, '#1d241a', 95);
}

function drawBush(buf, width, height, tx, ty, color = '#477c3d') {
  const x = tx * TILE;
  const y = ty * TILE;
  ellipse(buf, width, height, x + 13, y + 18, 10, 8, '#2b4d2c');
  ellipse(buf, width, height, x + 19, y + 18, 10, 8, color);
  ellipse(buf, width, height, x + 16, y + 13, 9, 7, '#5d994c');
  rect(buf, width, height, x + 8, y + 24, 16, 3, '#1d241a', 90);
}

function drawTinyProp(buf, width, height, tx, ty, kind, color = '#ffffff') {
  const x = tx * TILE;
  const y = ty * TILE;
  if (kind === 'stump') {
    ellipse(buf, width, height, x + 16, y + 18, 10, 7, '#2a1b14');
    ellipse(buf, width, height, x + 16, y + 16, 9, 6, '#8a5a32');
    ellipse(buf, width, height, x + 16, y + 16, 4, 3, '#c39458');
  } else if (kind === 'log') {
    rect(buf, width, height, x + 4, y + 13, 54, 10, '#5d3a25');
    rect(buf, width, height, x + 7, y + 11, 49, 4, '#8a5a32');
    ellipse(buf, width, height, x + 7, y + 18, 5, 7, '#c39458');
    ellipse(buf, width, height, x + 56, y + 18, 5, 7, '#3b2519');
  } else if (kind === 'flower') {
    rect(buf, width, height, x + 15, y + 16, 2, 10, '#3d6f36');
    for (const [dx, dy] of [[12, 13], [18, 13], [13, 18], [19, 18]]) rect(buf, width, height, x + dx, y + dy, 3, 3, color);
    rect(buf, width, height, x + 15, y + 15, 4, 4, '#ffd95f');
  } else if (kind === 'grass') {
    for (let i = 0; i < 8; i += 1) line(buf, width, height, x + 5 + i * 3, y + 24, x + 8 + i * 2, y + 13 + (i % 3), 2, i % 2 ? '#4f8d3d' : '#6cae4f');
  } else if (kind === 'rock') {
    ellipse(buf, width, height, x + 15, y + 19, 12, 8, '#6f766d');
    ellipse(buf, width, height, x + 11, y + 16, 5, 4, '#a9b0a3');
    rect(buf, width, height, x + 6, y + 25, 19, 3, '#1d241a', 80);
  }
}

function generateFoliage() {
  const width = 512;
  const height = 512;
  const buf = new Uint8Array(width * height * 4);
  drawTree(buf, width, height, 0, 0, 2, 2, ['#416f37', '#538945', '#6aa755']);
  drawTree(buf, width, height, 2, 0, 2, 2, ['#4a7a3c', '#638f47', '#8aa958']);
  drawTree(buf, width, height, 4, 0, 1, 2, ['#2f5a3b', '#3f7148', '#5c8e54'], true);
  drawTree(buf, width, height, 5, 0, 1, 2, ['#284d35', '#376442', '#4d7d4b'], true);
  drawTree(buf, width, height, 6, 0, 1, 1, ['#4f8c43', '#68a854', '#8cc56e']);
  drawBush(buf, width, height, 7, 0);
  drawTinyProp(buf, width, height, 8, 0, 'stump');
  drawTinyProp(buf, width, height, 9, 0, 'log');
  drawTinyProp(buf, width, height, 11, 0, 'flower', '#f5d65b');
  drawTinyProp(buf, width, height, 12, 0, 'flower', '#d781e6');
  drawTinyProp(buf, width, height, 13, 0, 'flower', '#86dbea');
  drawTinyProp(buf, width, height, 14, 0, 'grass');
  drawTinyProp(buf, width, height, 15, 0, 'rock');
  for (let y = 3; y < 7; y += 1) {
    for (let x = 0; x < 4; x += 1) drawTree(buf, width, height, x, y, 1, 1, ['#355f34', '#47723e', '#638a4b'], x % 2 === 1);
  }
  writeFileSync(join(ASSET_DIR, 'human_starting_foliage_v4.png'), encodePng(buf, width, height));
}

function drawFence(buf, width, height, tx, ty, type) {
  const x = tx * TILE;
  const y = ty * TILE;
  const wood = '#8b5b35';
  const dark = '#3c271a';
  if (type === 'h') {
    rect(buf, width, height, x + 1, y + 11, 30, 5, dark);
    rect(buf, width, height, x + 1, y + 20, 30, 5, dark);
    rect(buf, width, height, x + 2, y + 9, 28, 4, wood);
    rect(buf, width, height, x + 2, y + 18, 28, 4, wood);
    rect(buf, width, height, x + 6, y + 6, 5, 22, dark);
    rect(buf, width, height, x + 22, y + 6, 5, 22, dark);
    rect(buf, width, height, x + 7, y + 5, 3, 20, '#b77a45');
    rect(buf, width, height, x + 23, y + 5, 3, 20, '#b77a45');
  } else if (type === 'v') {
    rect(buf, width, height, x + 10, y + 1, 5, 30, dark);
    rect(buf, width, height, x + 19, y + 1, 5, 30, dark);
    rect(buf, width, height, x + 8, y + 2, 4, 28, wood);
    rect(buf, width, height, x + 17, y + 2, 4, 28, wood);
    rect(buf, width, height, x + 6, y + 6, 22, 5, dark);
    rect(buf, width, height, x + 6, y + 22, 22, 5, dark);
    rect(buf, width, height, x + 5, y + 7, 20, 3, '#b77a45');
    rect(buf, width, height, x + 5, y + 23, 20, 3, '#b77a45');
  } else {
    drawFence(buf, width, height, tx, ty, 'h');
    drawFence(buf, width, height, tx, ty, 'v');
  }
}

function drawProp(buf, width, height, tx, ty, kind, frame = 0) {
  const x = tx * TILE;
  const y = ty * TILE;
  if (kind === 'sign') {
    rect(buf, width, height, x + 15, y + 13, 4, 16, '#5b3922');
    rect(buf, width, height, x + 7, y + 6, 20, 12, '#392519');
    rect(buf, width, height, x + 8, y + 7, 18, 10, '#c18b48');
    line(buf, width, height, x + 11, y + 12, x + 22, y + 12, 2, '#6b4427');
  } else if (kind === 'lamp') {
    rect(buf, width, height, x + 15, y + 8, 4, 21, '#2d2420');
    rect(buf, width, height, x + 10, y + 5, 14, 8, '#2d2420');
    rect(buf, width, height, x + 12, y + 6, 10, 6, '#ffd666');
    ellipse(buf, width, height, x + 17, y + 9, 11, 8, '#ffd666', 70);
  } else if (kind === 'barrel') {
    ellipse(buf, width, height, x + 16, y + 10, 10, 5, '#4b2c1a');
    rect(buf, width, height, x + 7, y + 10, 18, 14, '#8b542d');
    ellipse(buf, width, height, x + 16, y + 24, 10, 5, '#3b2417');
    rect(buf, width, height, x + 8, y + 13, 16, 2, '#d6a05a');
    rect(buf, width, height, x + 8, y + 21, 16, 2, '#d6a05a');
  } else if (kind === 'crate') {
    rect(buf, width, height, x + 6, y + 7, 20, 20, '#3d281b');
    rect(buf, width, height, x + 8, y + 9, 16, 16, '#9b6638');
    line(buf, width, height, x + 9, y + 10, x + 23, y + 24, 2, '#5f3a23');
    line(buf, width, height, x + 23, y + 10, x + 9, y + 24, 2, '#5f3a23');
  } else if (kind === 'sack') {
    ellipse(buf, width, height, x + 16, y + 18, 11, 10, '#c5a56b');
    rect(buf, width, height, x + 12, y + 8, 8, 10, '#a88755');
    line(buf, width, height, x + 10, y + 14, x + 21, y + 14, 2, '#6c5134');
  } else if (kind === 'hay') {
    rect(buf, width, height, x + 5, y + 11, 23, 15, '#9b6a2c');
    rect(buf, width, height, x + 7, y + 8, 19, 15, '#d6a947');
    line(buf, width, height, x + 9, y + 12, x + 24, y + 12, 2, '#f2d46d');
    line(buf, width, height, x + 8, y + 19, x + 26, y + 19, 2, '#805626');
  } else if (kind === 'well') {
    ellipse(buf, width, height, x + 16, y + 21, 13, 8, '#2a241f');
    ellipse(buf, width, height, x + 16, y + 19, 12, 7, '#8b8f86');
    ellipse(buf, width, height, x + 16, y + 18, 8, 4, '#263d47');
    rect(buf, width, height, x + 7, y + 8, 4, 13, '#60462e');
    rect(buf, width, height, x + 22, y + 8, 4, 13, '#60462e');
    line(buf, width, height, x + 8, y + 8, x + 24, y + 8, 3, '#6f4c2c');
  } else if (kind === 'dummy') {
    rect(buf, width, height, x + 15, y + 8, 4, 20, '#5f3a23');
    rect(buf, width, height, x + 8, y + 10, 18, 9, '#9c7042');
    rect(buf, width, height, x + 12, y + 6, 10, 7, '#d0b06b');
  } else if (kind === 'chest') {
    rect(buf, width, height, x + 5, y + 13, 22, 13, '#3a2416');
    rect(buf, width, height, x + 7, y + 11, 18, 13, '#9d6030');
    rect(buf, width, height, x + 15, y + 14, 4, 5, '#f0c956');
    line(buf, width, height, x + 8, y + 12, x + 24, y + 12, 2, '#dba94c');
  } else if (kind === 'fire') {
    ellipse(buf, width, height, x + 16, y + 24, 13, 5, '#1d1511', 130);
    line(buf, width, height, x + 8, y + 24, x + 24, y + 17, 4, '#5a321e');
    line(buf, width, height, x + 24, y + 24, x + 8, y + 17, 4, '#5a321e');
    ellipse(buf, width, height, x + 16, y + 17 - (frame % 2), 8, 10, frame % 2 ? '#ff9d2d' : '#ffca45');
    ellipse(buf, width, height, x + 16, y + 18, 4, 6, '#fff2a3');
  } else if (kind === 'torch') {
    rect(buf, width, height, x + 15, y + 12, 4, 17, '#4c2f20');
    ellipse(buf, width, height, x + 17, y + 10 - (frame % 2), 7, 8, frame % 2 ? '#ff8a25' : '#ffd25b');
    ellipse(buf, width, height, x + 17, y + 10, 3, 4, '#fff2a3');
  } else if (kind === 'grave') {
    rect(buf, width, height, x + 8, y + 11, 16, 17, '#4d5553');
    ellipse(buf, width, height, x + 16, y + 11, 8, 7, '#77807a');
    rect(buf, width, height, x + 11, y + 18, 10, 2, '#303735');
  } else if (kind === 'crop') {
    for (let i = 0; i < 4; i += 1) {
      line(buf, width, height, x + 7 + i * 5, y + 25, x + 8 + i * 5, y + 11, 2, '#4e8a38');
      ellipse(buf, width, height, x + 8 + i * 5, y + 15, 4, 5, '#7fb34d');
    }
  } else if (kind === 'dock') {
    rect(buf, width, height, x + 1, y + 10, 30, 13, '#3b291d');
    for (let i = 0; i < 4; i += 1) rect(buf, width, height, x + 3 + i * 7, y + 8, 5, 17, '#8b5b35');
    line(buf, width, height, x + 2, y + 14, x + 29, y + 14, 2, '#c08a4a');
  } else if (kind === 'boat') {
    poly(buf, width, height, [[x + 5, y + 18], [x + 13, y + 10], [x + 27, y + 14], [x + 23, y + 23], [x + 10, y + 24]], '#5d3923');
    poly(buf, width, height, [[x + 9, y + 18], [x + 14, y + 13], [x + 23, y + 16], [x + 20, y + 21], [x + 11, y + 21]], '#8f6036');
  } else if (kind === 'reeds') {
    for (let i = 0; i < 7; i += 1) {
      line(buf, width, height, x + 6 + i * 3, y + 27, x + 8 + i * 2, y + 10 + (i % 4), 2, '#5d7c42');
      rect(buf, width, height, x + 7 + i * 3, y + 10 + (i % 4), 2, 5, '#8b6a32');
    }
  }
}

function generateProps() {
  const width = 512;
  const height = 256;
  const buf = new Uint8Array(width * height * 4);
  drawFence(buf, width, height, 0, 0, 'h');
  drawFence(buf, width, height, 1, 0, 'v');
  drawFence(buf, width, height, 2, 0, 'corner');
  drawFence(buf, width, height, 3, 0, 'h');
  line(buf, width, height, 3 * TILE + 8, 20, 3 * TILE + 24, 10, 3, '#553420');
  ['sign', 'lamp', 'barrel', 'crate', 'sack', 'hay', 'well', 'dummy', 'chest', 'grave', 'crop', 'dock', 'boat', 'reeds'].forEach((kind, i) => drawProp(buf, width, height, 4 + (i % 12), Math.floor(i / 12), kind));
  for (let i = 0; i < 4; i += 1) drawProp(buf, width, height, i, 2, 'fire', i);
  for (let i = 0; i < 4; i += 1) drawProp(buf, width, height, i + 4, 2, 'torch', i);
  for (let i = 0; i < 4; i += 1) drawTinyProp(buf, width, height, i + 8, 2, 'rock');
  writeFileSync(join(ASSET_DIR, 'human_starting_props_v4.png'), encodePng(buf, width, height));
}

function generateBridge() {
  const width = 256;
  const height = 128;
  const buf = new Uint8Array(width * height * 4);
  const plank = '#8b5b35';
  const light = '#bd8350';
  const dark = '#3b281c';

  // Horizontal bridge: row 0 is the main walkway, row 1 is the lower rail/shadow.
  for (let tx = 0; tx < 5; tx += 1) {
    const x = tx * TILE;
    rect(buf, width, height, x, 6, 32, 22, dark, 170);
    rect(buf, width, height, x, 9, 32, 16, plank);
    for (let i = 0; i < 4; i += 1) line(buf, width, height, x + i * 8 + 2, 11, x + i * 8 + 2, 23, 2, light, 180);
    rect(buf, width, height, x, 5, 32, 4, dark);
    rect(buf, width, height, x, 24, 32, 4, dark);
    rect(buf, width, height, x + 2, 7, 28, 2, '#c08a4a', 190);
    rect(buf, width, height, x + 2, 23, 28, 2, '#5f3a23', 190);

    const y = TILE;
    rect(buf, width, height, x, y + 1, 32, 9, '#1d1511', 115);
    rect(buf, width, height, x, y + 4, 32, 8, dark, 165);
    rect(buf, width, height, x, y + 6, 32, 6, '#6b4428');
    rect(buf, width, height, x + 3, y + 7, 26, 2, light, 150);
  }
  rect(buf, width, height, 0, 4, 8, 27, '#6b4428');
  rect(buf, width, height, 4 * TILE + 24, 4, 8, 27, '#6b4428');
  rect(buf, width, height, 0, TILE + 2, 8, 14, '#6b4428');
  rect(buf, width, height, 4 * TILE + 24, TILE + 2, 8, 14, '#6b4428');

  // Vertical bridge pieces remain available for manual Tiled work.
  for (let ty = 1; ty < 4; ty += 1) {
    const y = ty * TILE;
    rect(buf, width, height, 192, y, 20, 32, dark, 170);
    rect(buf, width, height, 195, y, 14, 32, plank);
    for (let i = 0; i < 4; i += 1) line(buf, width, height, 196, y + i * 8 + 2, 208, y + i * 8 + 2, 2, light, 180);
    rect(buf, width, height, 191, y, 4, 32, dark);
    rect(buf, width, height, 210, y, 4, 32, dark);
  }
  rect(buf, width, height, 190, TILE, 26, 7, '#6b4428');
  rect(buf, width, height, 190, TILE * 4 - 7, 26, 7, '#6b4428');
  writeFileSync(join(ASSET_DIR, 'human_starting_bridge_v4.png'), encodePng(buf, width, height));
}

function writeTilesets() {
  writeFileSync(join(TILESET_DIR, 'human_starting_foliage_v4.tsx'), `<?xml version="1.0" encoding="UTF-8"?>\n<tileset version="1.10" tiledversion="1.11.2" name="human_starting_foliage_v4" tilewidth="32" tileheight="32" tilecount="256" columns="16">\n <image source="../assets/tilesets/human_starting_foliage_v4.png" width="512" height="512"/>\n</tileset>\n`);
  writeFileSync(join(TILESET_DIR, 'human_starting_bridge_v4.tsx'), `<?xml version="1.0" encoding="UTF-8"?>\n<tileset version="1.10" tiledversion="1.11.2" name="human_starting_bridge_v4" tilewidth="32" tileheight="32" tilecount="32" columns="8">\n <image source="../assets/tilesets/human_starting_bridge_v4.png" width="256" height="128"/>\n</tileset>\n`);
  writeFileSync(join(TILESET_DIR, 'human_starting_props_v4.tsx'), `<?xml version="1.0" encoding="UTF-8"?>\n<tileset version="1.10" tiledversion="1.11.2" name="human_starting_props_v4" tilewidth="32" tileheight="32" tilecount="128" columns="16">\n <image source="../assets/tilesets/human_starting_props_v4.png" width="512" height="256"/>\n <tile id="32">\n  <animation><frame tileid="32" duration="150"/><frame tileid="33" duration="150"/><frame tileid="34" duration="150"/><frame tileid="35" duration="150"/></animation>\n </tile>\n <tile id="36">\n  <animation><frame tileid="36" duration="140"/><frame tileid="37" duration="140"/><frame tileid="38" duration="140"/><frame tileid="39" duration="140"/></animation>\n </tile>\n</tileset>\n`);
}

function getLayer(map, name) {
  const layer = map.layers.find((entry) => entry.name === name);
  if (!layer) throw new Error(`Missing layer: ${name}`);
  return layer;
}

function setTile(layer, x, y, gid) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_W) return;
  layer.data[y * MAP_W + x] = gid;
}

function clearTile(layer, x, y) {
  setTile(layer, x, y, 0);
}

function place(layer, firstgid, x, y, tx, ty, cols = 16) {
  setTile(layer, x, y, firstgid + tileIndex(tx, ty, cols));
}

function placeRect(layer, firstgid, x, y, tx, ty, w, h, cols = 16) {
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) place(layer, firstgid, x + xx, y + yy, tx + xx, ty + yy, cols);
  }
}

function blockRect(collision, x, y, w, h) {
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) setTile(collision, x + xx, y + yy, BLOCK_GID);
  }
}

function clearRect(layer, x, y, w, h) {
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) clearTile(layer, x + xx, y + yy);
  }
}

function fillGroundPatch(ground, x, y, w, h, baseGid = 1) {
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      const noise = (x + xx) * 11 + (y + yy) * 17;
      setTile(ground, x + xx, y + yy, noise % 9 === 0 ? 3 : noise % 13 === 0 ? 4 : baseGid);
    }
  }
}

function placeFenceBox(decor, collision, x, y, w, h) {
  for (let xx = 0; xx < w; xx += 1) {
    place(decor, PROPS_FIRST_GID, x + xx, y, 0, 0);
    place(decor, PROPS_FIRST_GID, x + xx, y + h - 1, 0, 0);
    setTile(collision, x + xx, y, BLOCK_GID);
    setTile(collision, x + xx, y + h - 1, BLOCK_GID);
  }
  for (let yy = 1; yy < h - 1; yy += 1) {
    place(decor, PROPS_FIRST_GID, x, y + yy, 1, 0);
    place(decor, PROPS_FIRST_GID, x + w - 1, y + yy, 1, 0);
    setTile(collision, x, y + yy, BLOCK_GID);
    setTile(collision, x + w - 1, y + yy, BLOCK_GID);
  }
}

function placeCropField(ground, decor, collision, x, y, w, h) {
  fillGroundPatch(ground, x, y, w, h, 1);
  clearRect(decor, x, y, w, h);
  clearRect(collision, x, y, w, h);
  placeFenceBox(decor, collision, x, y, w, h);
  // Leave the lower middle open as a gate.
  clearTile(decor, x + Math.floor(w / 2), y + h - 1);
  clearTile(collision, x + Math.floor(w / 2), y + h - 1);
  clearTile(decor, x + Math.floor(w / 2) - 1, y + h - 1);
  clearTile(collision, x + Math.floor(w / 2) - 1, y + h - 1);
  for (let yy = y + 2; yy < y + h - 2; yy += 2) {
    for (let xx = x + 2; xx < x + w - 2; xx += 3) {
      place(decor, PROPS_FIRST_GID, xx, yy, 14, 0);
    }
  }
}

function scatterDecor(decor, collision, points, choices, collide = false) {
  points.forEach(([x, y], i) => {
    const choice = choices[i % choices.length];
    if (choice.w) placeRect(decor, choice.firstgid, x, y, choice.tx, choice.ty, choice.w, choice.h, choice.cols ?? 16);
    else place(decor, choice.firstgid, x, y, choice.tx, choice.ty, choice.cols ?? 16);
    if (collide) {
      if (choice.w && choice.h) blockRect(collision, x, y + choice.h - 1, choice.w, 1);
      else setTile(collision, x, y, BLOCK_GID);
    }
  });
}

function writeMapV4() {
  const map = JSON.parse(readFileSync(join(MAP_DIR, 'human_starting_zone_v3.tmj'), 'utf8'));
  const sources = new Set(map.tilesets.map((tileset) => tileset.source));
  if (!sources.has('../tilesets/human_starting_foliage_v4.tsx')) map.tilesets.push({ firstgid: FOLIAGE_FIRST_GID, source: '../tilesets/human_starting_foliage_v4.tsx' });
  if (!sources.has('../tilesets/human_starting_props_v4.tsx')) map.tilesets.push({ firstgid: PROPS_FIRST_GID, source: '../tilesets/human_starting_props_v4.tsx' });
  if (!sources.has('../tilesets/human_starting_bridge_v4.tsx')) map.tilesets.push({ firstgid: BRIDGE_FIRST_GID, source: '../tilesets/human_starting_bridge_v4.tsx' });

  const decor = getLayer(map, 'Decor');
  const collision = getLayer(map, 'Collision');

  const oldWeakDecor = new Set([65, 66, 67, 68, 69, 70, 76, 77, 78]);
  for (let i = 0; i < decor.data.length; i += 1) {
    if (oldWeakDecor.has(decor.data[i])) {
      const x = i % MAP_W;
      const y = Math.floor(i / MAP_W);
      const variant = (x * 17 + y * 31) % 7;
      decor.data[i] = FOLIAGE_FIRST_GID + [14, 15, 11, 12, 13, 7, 8][variant];
    }
  }

  scatterDecor(decor, collision, [
    [4, 4], [8, 13], [13, 22], [5, 37], [10, 52], [6, 70], [12, 91], [7, 111], [12, 133], [5, 154], [10, 176],
    [176, 7], [188, 14], [181, 28], [193, 47], [178, 68], [190, 85], [181, 111], [193, 130], [176, 151], [187, 175],
    [34, 23], [41, 31], [52, 27], [66, 37], [71, 49], [42, 61], [59, 72],
  ], [
    { firstgid: FOLIAGE_FIRST_GID, tx: 0, ty: 0, w: 2, h: 2 },
    { firstgid: FOLIAGE_FIRST_GID, tx: 2, ty: 0, w: 2, h: 2 },
    { firstgid: FOLIAGE_FIRST_GID, tx: 4, ty: 0, w: 1, h: 2 },
  ], true);

  scatterDecor(decor, collision, [
    [39, 29], [43, 35], [47, 40], [33, 44], [55, 51], [62, 34], [69, 28], [76, 40],
    [148, 38], [154, 32], [160, 44], [168, 36], [173, 47], [144, 54], [157, 59],
  ], [
    { firstgid: FOLIAGE_FIRST_GID, tx: 0, ty: 3 },
    { firstgid: FOLIAGE_FIRST_GID, tx: 1, ty: 3 },
    { firstgid: FOLIAGE_FIRST_GID, tx: 2, ty: 3 },
    { firstgid: FOLIAGE_FIRST_GID, tx: 3, ty: 3 },
  ], true);

  scatterDecor(decor, collision, [
    [90, 88], [94, 91], [105, 91], [110, 96], [84, 102], [118, 106], [91, 118], [103, 122],
    [80, 111], [74, 119], [78, 123], [86, 126],
  ], [
    { firstgid: PROPS_FIRST_GID, tx: 4, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 5, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 6, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 7, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 8, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 9, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 10, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 11, ty: 0 },
  ], true);

  // Farm detail pass only: keep the v3 ground/layout intact and avoid
  // replacing broad map areas with repeated crop or fence rectangles.
  scatterDecor(decor, collision, [
    [77, 22], [84, 22], [96, 23], [104, 23], [114, 24], [121, 25],
    [80, 31], [91, 32], [101, 32], [112, 33], [119, 34],
  ], [
    { firstgid: PROPS_FIRST_GID, tx: 14, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 9, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 6, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 7, ty: 0 },
    { firstgid: FOLIAGE_FIRST_GID, tx: 14, ty: 0 },
  ], false);
  scatterDecor(decor, collision, [
    [75, 20], [124, 20], [76, 51], [123, 51],
  ], [
    { firstgid: PROPS_FIRST_GID, tx: 4, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 5, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 9, ty: 0 },
  ], true);

  scatterDecor(decor, collision, [
    [43, 149], [46, 152], [51, 148], [54, 155], [60, 151], [65, 156], [48, 160],
  ], [
    { firstgid: PROPS_FIRST_GID, tx: 13, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 15, ty: 0 },
    { firstgid: FOLIAGE_FIRST_GID, tx: 8, ty: 0 },
    { firstgid: FOLIAGE_FIRST_GID, tx: 15, ty: 0 },
  ], true);

  scatterDecor(decor, collision, [
    [96, 26], [99, 27], [103, 28], [98, 32], [106, 34], [93, 34],
  ], [
    { firstgid: FOLIAGE_FIRST_GID, tx: 15, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 7, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 6, ty: 0 },
    { firstgid: PROPS_FIRST_GID, tx: 8, ty: 0 },
  ], true);

  for (let y = 70; y <= 75; y += 1) {
    for (let x = 20; x <= 30; x += 1) {
      clearTile(decor, x, y);
      clearTile(collision, x, y);
    }
  }
  for (let row = 0; row < 2; row += 1) {
    place(decor, BRIDGE_FIRST_GID, 20, 72 + row, 0, row, 8);
    for (let x = 21; x <= 29; x += 1) place(decor, BRIDGE_FIRST_GID, x, 72 + row, 1 + ((x - 21) % 3), row, 8);
    place(decor, BRIDGE_FIRST_GID, 30, 72 + row, 4, row, 8);
  }
  for (let y = 72; y <= 73; y += 1) {
    for (let x = 20; x <= 30; x += 1) clearTile(collision, x, y);
  }

  scatterDecor(decor, collision, [
    [18, 69], [20, 75], [30, 69], [31, 76], [17, 80], [29, 82],
  ], [
    { firstgid: PROPS_FIRST_GID, tx: 1, ty: 1 },
    { firstgid: PROPS_FIRST_GID, tx: 15, ty: 0 },
    { firstgid: FOLIAGE_FIRST_GID, tx: 11, ty: 0 },
    { firstgid: FOLIAGE_FIRST_GID, tx: 12, ty: 0 },
  ], false);
  scatterDecor(decor, collision, [[18, 73], [19, 73], [20, 73]], [{ firstgid: PROPS_FIRST_GID, tx: 15, ty: 1 }], false);

  writeFileSync(join(MAP_DIR, 'human_starting_zone_v4.tmj'), `${JSON.stringify(map, null, 2)}\n`);
}

function writeDocs() {
  writeFileSync(join(DOC_DIR, 'human_starting_props_v4_notes.md'), `# Human Starting Props V4

Generated by \`scripts/improveHumanStartingZoneV4.js\`.

## Files

- \`public/maps/human_starting_zone_v4.tmj\`
- \`public/assets/tilesets/human_starting_foliage_v4.png\`
- \`public/tilesets/human_starting_foliage_v4.tsx\`
- \`public/assets/tilesets/human_starting_props_v4.png\`
- \`public/tilesets/human_starting_props_v4.tsx\`
- \`public/assets/tilesets/human_starting_bridge_v4.png\`
- \`public/tilesets/human_starting_bridge_v4.tsx\`

## Foliage

Includes 2x2 oak trees, 1x2 pine trees, saplings, bushes, stumps, fallen logs, flower patches, tall grass, rocks, and dense forest edge tiles.

## Props

Includes fence variants, signpost, lamp post, barrel, crate, sack, hay bale, well, training dummy, chest, gravestones, crop tiles, dock, boat, reeds, campfire, and torch.

## Animated Tiles

- Campfire: tile id 32, 4 frames, 150 ms.
- Torch: tile id 36, 4 frames, 140 ms.

## Bridge

The bridge tileset contains horizontal bridge sections and vertical bridge parts with railings, plank shadows, and support beams. In v4 the western river crossing uses the new horizontal bridge.

## Placement Pass

- Replaced weak simple tree/decor tiles with v4 foliage variants.
- Added denser forest edge clusters on map boundaries and in wolfwoods.
- Added village props around the square: lamps, signs, barrels, crates, well, chest, sacks, and hay.
- Added crops and farm details near the farm shed.
- Added graveyard stones, stumps, rocks, and broken natural details.
- Added mine crates, sacks, rocks, and rugged approach props.
- Added reeds, flowers, rocks, dock pieces, and a small boat at the river bend.

## Collision Rules

- Large trees and dense foliage clusters block only their trunk/base rows.
- Rocks, crates, barrels, gravestones, and similar solid props block movement.
- Flowers, reeds, crops, and tall grass are decorative and walkable.
- The new bridge is explicitly walkable, while water collision remains around it.
- Existing building and water collision from v3 is preserved.
`);
}

generateFoliage();
generateProps();
generateBridge();
writeTilesets();
writeMapV4();
writeDocs();

console.log('Generated human_starting_zone_v4 prop/foliage/bridge quality pass.');
