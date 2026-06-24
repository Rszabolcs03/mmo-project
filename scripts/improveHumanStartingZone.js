import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ASSET_DIR = join(ROOT, 'public', 'assets', 'tilesets');
const TILESET_DIR = join(ROOT, 'public', 'tilesets');
const MAP_DIR = join(ROOT, 'public', 'maps');
const DOC_DIR = join(ROOT, 'docs');

const TILE = 32;
const MAP_W = 200;
const MAP_H = 200;
const TERRAIN_COLUMNS = 8;
const PROPS_COLUMNS = 16;
const ANIM_COLUMNS = 8;
const TERRAIN_COUNT = 64;
const PROPS_COUNT = 128;
const ANIM_COUNT = 64;
const TERRAIN_FIRST = 1;
const PROPS_FIRST = TERRAIN_FIRST + TERRAIN_COUNT;
const ANIM_FIRST = PROPS_FIRST + PROPS_COUNT;

mkdirSync(ASSET_DIR, { recursive: true });
mkdirSync(TILESET_DIR, { recursive: true });
mkdirSync(MAP_DIR, { recursive: true });
mkdirSync(DOC_DIR, { recursive: true });

function hex(value, alpha = 255) {
  const clean = value.replace('#', '');
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

function put(buffer, width, height, x, y, rgba) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (Math.floor(y) * width + Math.floor(x)) * 4;
  buffer[i] = rgba[0];
  buffer[i + 1] = rgba[1];
  buffer[i + 2] = rgba[2];
  buffer[i + 3] = rgba[3];
}

function rect(buffer, width, height, x, y, w, h, color, alpha = 255) {
  const rgba = hex(color, alpha);
  for (let yy = Math.round(y); yy < Math.round(y + h); yy += 1) {
    for (let xx = Math.round(x); xx < Math.round(x + w); xx += 1) put(buffer, width, height, xx, yy, rgba);
  }
}

function ellipse(buffer, width, height, cx, cy, rx, ry, color, alpha = 255) {
  const rgba = hex(color, alpha);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) put(buffer, width, height, x, y, rgba);
    }
  }
}

function line(buffer, width, height, x1, y1, x2, y2, size, color, alpha = 255) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    rect(buffer, width, height, x1 + (x2 - x1) * t - size / 2, y1 + (y2 - y1) * t - size / 2, size, size, color, alpha);
  }
}

function poly(buffer, width, height, points, color, alpha = 255) {
  const rgba = hex(color, alpha);
  const minX = Math.floor(Math.min(...points.map((p) => p[0])));
  const maxX = Math.ceil(Math.max(...points.map((p) => p[0])));
  const minY = Math.floor(Math.min(...points.map((p) => p[1])));
  const maxY = Math.ceil(Math.max(...points.map((p) => p[1])));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const xi = points[i][0];
        const yi = points[i][1];
        const xj = points[j][0];
        const yj = points[j][1];
        const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1) + xi;
        if (hit) inside = !inside;
      }
      if (inside) put(buffer, width, height, x, y, rgba);
    }
  }
}

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const rng = makeRng(20260611);

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

function encodePng(rgba, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1);
    raw[start] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, start + 1);
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
}

function drawTile(buffer, sheetWidth, columns, id, draw) {
  const ox = (id % columns) * TILE;
  const oy = Math.floor(id / columns) * TILE;
  draw(ox, oy);
}

function terrainGid(id) {
  return TERRAIN_FIRST + id;
}

function propsGid(id) {
  return PROPS_FIRST + id;
}

function animGid(id) {
  return ANIM_FIRST + id;
}

function generateTerrainSheet() {
  const width = TERRAIN_COLUMNS * TILE;
  const height = Math.ceil(TERRAIN_COUNT / TERRAIN_COLUMNS) * TILE;
  const b = canvas(width, height);

  const speckle = (ox, oy, colors, count = 18) => {
    for (let i = 0; i < count; i += 1) {
      rect(b, width, height, ox + Math.floor(rng() * 32), oy + Math.floor(rng() * 32), 1 + Math.floor(rng() * 3), 1, colors[i % colors.length], 180);
    }
  };

  for (let id = 0; id < TERRAIN_COUNT; id += 1) {
    drawTile(b, width, TERRAIN_COLUMNS, id, (ox, oy) => {
      rect(b, width, height, ox, oy, 32, 32, '#87985e');
      speckle(ox, oy, ['#718552', '#9caf72', '#758a54'], 18);
    });
  }

  const bases = {
    0: '#87985e',
    1: '#7b8d55',
    2: '#9aa967',
    3: '#637248',
    4: '#b19964',
    5: '#a98e58',
    6: '#c3ae78',
    7: '#726b59',
    8: '#8a7657',
    9: '#80643e',
    10: '#6a4b34',
    11: '#94a466',
    12: '#7c8d58',
    13: '#a38754',
    14: '#98a968',
    15: '#d1c275',
    16: '#5c6f47',
    17: '#8db66e',
    18: '#a8a470',
    19: '#6f7d51',
    20: '#9c8a67',
    21: '#b9ab8a',
    22: '#766c61',
    23: '#5d584f',
  };

  Object.entries(bases).forEach(([rawId, color]) => {
    const id = Number(rawId);
    drawTile(b, width, TERRAIN_COLUMNS, id, (ox, oy) => {
      rect(b, width, height, ox, oy, 32, 32, color);
      if (id >= 4 && id <= 10) speckle(ox, oy, ['#d0ba80', '#8b6d42', '#6f5637'], 30);
      else if (id >= 20) speckle(ox, oy, ['#c7b796', '#5a5149', '#928574'], 24);
      else speckle(ox, oy, ['#607548', '#aabd7c', '#789158'], 22);
    });
  });

  drawTile(b, width, TERRAIN_COLUMNS, 24, (ox, oy) => {
    rect(b, width, height, ox, oy, 32, 32, '#795735');
    for (let x = 3; x < 32; x += 7) line(b, width, height, ox + x, oy + 1, ox + x - 4, oy + 31, 2, '#4f351f', 200);
  });
  drawTile(b, width, TERRAIN_COLUMNS, 25, (ox, oy) => {
    rect(b, width, height, ox, oy, 32, 32, '#95a25d');
    for (let y = 5; y < 32; y += 8) rect(b, width, height, ox + 2, oy + y, 28, 2, '#6e8646', 210);
    for (let x = 5; x < 30; x += 8) rect(b, width, height, ox + x, oy + 2, 2, 28, '#6e8646', 140);
  });
  drawTile(b, width, TERRAIN_COLUMNS, 26, (ox, oy) => {
    rect(b, width, height, ox, oy, 32, 32, '#4e6b47');
    speckle(ox, oy, ['#30472e', '#6c8651', '#465e39'], 40);
  });

  savePng(join(ASSET_DIR, 'human_starting_zone_v2.png'), b, width, height);
}

function generatePropsSheet() {
  const width = PROPS_COLUMNS * TILE;
  const height = Math.ceil(PROPS_COUNT / PROPS_COLUMNS) * TILE;
  const b = canvas(width, height);
  const tile = (id, cb) => drawTile(b, width, PROPS_COLUMNS, id, cb);
  const outline = '#1f221c';

  tile(0, (ox, oy) => {
    ellipse(b, width, height, ox + 16, oy + 14, 15, 13, outline);
    ellipse(b, width, height, ox + 16, oy + 14, 13, 11, '#2f6b3e');
    ellipse(b, width, height, ox + 9, oy + 18, 8, 7, '#3e7c49');
    ellipse(b, width, height, ox + 22, oy + 11, 8, 8, '#4b8f54');
    rect(b, width, height, ox + 13, oy + 21, 6, 10, '#7b4a28');
    rect(b, width, height, ox + 11, oy + 29, 11, 3, '#442a18');
  });
  tile(1, (ox, oy) => {
    for (let i = 0; i < 4; i += 1) {
      ellipse(b, width, height, ox + 16, oy + 22 - i * 5, 13 - i * 2, 6, outline);
      ellipse(b, width, height, ox + 16, oy + 22 - i * 5, 11 - i * 2, 4, i % 2 ? '#355f43' : '#294d38');
    }
    rect(b, width, height, ox + 14, oy + 23, 5, 9, '#6c4329');
  });
  tile(2, (ox, oy) => {
    ellipse(b, width, height, ox + 14, oy + 20, 10, 8, outline);
    ellipse(b, width, height, ox + 14, oy + 20, 8, 6, '#3d733f');
    ellipse(b, width, height, ox + 21, oy + 21, 8, 7, '#4b8a48');
  });
  tile(3, (ox, oy) => {
    ellipse(b, width, height, ox + 16, oy + 17, 9, 5, outline);
    ellipse(b, width, height, ox + 16, oy + 17, 7, 3, '#b37a43');
    rect(b, width, height, ox + 11, oy + 16, 10, 12, '#6f4328');
  });
  tile(4, (ox, oy) => {
    rect(b, width, height, ox + 2, oy + 10, 28, 14, '#7b4d30');
    line(b, width, height, ox + 3, oy + 11, ox + 29, oy + 23, 2, '#4a2f1f');
    line(b, width, height, ox + 3, oy + 23, ox + 29, oy + 11, 2, '#4a2f1f');
  });
  tile(5, (ox, oy) => {
    rect(b, width, height, ox + 3, oy + 12, 26, 8, '#835532');
    rect(b, width, height, ox + 5, oy + 8, 4, 17, '#5d3822');
    rect(b, width, height, ox + 23, oy + 8, 4, 17, '#5d3822');
  });
  tile(6, (ox, oy) => {
    rect(b, width, height, ox + 14, oy + 7, 4, 22, '#704629');
    rect(b, width, height, ox + 8, oy + 12, 17, 9, '#5d3b24');
    rect(b, width, height, ox + 10, oy + 14, 13, 5, '#c5a15b');
  });
  tile(7, (ox, oy) => {
    rect(b, width, height, ox + 8, oy + 12, 16, 15, outline);
    rect(b, width, height, ox + 10, oy + 14, 12, 11, '#85522f');
    ellipse(b, width, height, ox + 16, oy + 13, 8, 4, '#bf8752');
  });
  tile(8, (ox, oy) => {
    rect(b, width, height, ox + 7, oy + 12, 18, 14, outline);
    rect(b, width, height, ox + 9, oy + 14, 14, 10, '#9f7141');
    rect(b, width, height, ox + 11, oy + 16, 10, 2, '#d2a45c');
  });
  tile(9, (ox, oy) => {
    rect(b, width, height, ox + 8, oy + 13, 16, 13, '#8d7543');
    line(b, width, height, ox + 9, oy + 14, ox + 23, oy + 25, 2, '#5b482a');
    line(b, width, height, ox + 23, oy + 14, ox + 9, oy + 25, 2, '#5b482a');
  });
  tile(10, (ox, oy) => {
    ellipse(b, width, height, ox + 14, oy + 22, 7, 5, '#bea46c');
    ellipse(b, width, height, ox + 20, oy + 20, 8, 6, '#d4bd84');
    rect(b, width, height, ox + 10, oy + 17, 15, 10, '#c9ad73');
  });
  tile(11, (ox, oy) => {
    for (let i = 0; i < 12; i += 1) {
      rect(b, width, height, ox + 5 + (i * 7) % 22, oy + 12 + Math.floor(i / 4) * 5, 3, 3, ['#f2d75e', '#f0a6c4', '#ffffff'][i % 3]);
    }
  });
  tile(12, (ox, oy) => {
    ellipse(b, width, height, ox + 16, oy + 20, 11, 7, outline);
    ellipse(b, width, height, ox + 16, oy + 20, 9, 5, '#7d827c');
    ellipse(b, width, height, ox + 13, oy + 17, 5, 3, '#b0b5ad');
  });
  tile(13, (ox, oy) => {
    line(b, width, height, ox + 6, oy + 24, ox + 26, oy + 15, 8, outline);
    line(b, width, height, ox + 6, oy + 24, ox + 26, oy + 15, 5, '#7b4f2e');
    line(b, width, height, ox + 7, oy + 22, ox + 27, oy + 13, 2, '#c18a4a');
  });
  tile(14, (ox, oy) => {
    rect(b, width, height, ox + 9, oy + 10, 14, 18, '#57534e');
    rect(b, width, height, ox + 11, oy + 12, 10, 14, '#81786c');
    rect(b, width, height, ox + 7, oy + 27, 18, 3, '#3b3835');
  });
  tile(15, (ox, oy) => {
    rect(b, width, height, ox + 7, oy + 12, 18, 16, '#5b4436');
    rect(b, width, height, ox + 10, oy + 15, 12, 10, '#7c6755');
    rect(b, width, height, ox + 13, oy + 17, 6, 6, '#2d2520');
  });

  const roof = ['#7d3d2f', '#9a4737', '#6d3227'];
  for (let i = 0; i < 8; i += 1) {
    tile(16 + i, (ox, oy) => {
      rect(b, width, height, ox + 2, oy + 13, 28, 14, outline);
      poly(b, width, height, [[ox + 2, oy + 15], [ox + 16, oy + 4], [ox + 30, oy + 15], [ox + 28, oy + 20], [ox + 4, oy + 20]], roof[i % roof.length]);
      line(b, width, height, ox + 4, oy + 16, ox + 28, oy + 16, 2, '#d08a52');
    });
  }
  for (let i = 0; i < 8; i += 1) {
    tile(24 + i, (ox, oy) => {
      rect(b, width, height, ox + 3, oy + 3, 26, 27, outline);
      rect(b, width, height, ox + 5, oy + 5, 22, 23, '#b99563');
      for (let x = 6; x < 27; x += 7) rect(b, width, height, ox + x, oy + 5, 2, 23, '#7b5d3b', 150);
    });
  }
  tile(32, (ox, oy) => {
    rect(b, width, height, ox + 9, oy + 7, 14, 22, outline);
    rect(b, width, height, ox + 11, oy + 9, 10, 20, '#6f3f26');
    rect(b, width, height, ox + 18, oy + 18, 2, 2, '#e4c46f');
  });
  tile(33, (ox, oy) => {
    rect(b, width, height, ox + 7, oy + 9, 18, 15, outline);
    rect(b, width, height, ox + 9, oy + 11, 14, 11, '#5b86a6');
    rect(b, width, height, ox + 15, oy + 10, 2, 13, '#e0e6d8');
    rect(b, width, height, ox + 9, oy + 16, 14, 2, '#e0e6d8');
  });
  tile(34, (ox, oy) => {
    ellipse(b, width, height, ox + 16, oy + 18, 13, 9, outline);
    ellipse(b, width, height, ox + 16, oy + 18, 10, 6, '#8a8f91');
    ellipse(b, width, height, ox + 16, oy + 18, 6, 3, '#2e4850');
    rect(b, width, height, ox + 5, oy + 19, 22, 7, '#b8b3a0');
  });
  tile(35, (ox, oy) => {
    rect(b, width, height, ox + 13, oy + 6, 5, 20, '#59391f');
    rect(b, width, height, ox + 11, oy + 24, 9, 6, '#2f2116');
    rect(b, width, height, ox + 10, oy + 5, 11, 5, '#f4d875');
  });
  tile(36, (ox, oy) => {
    rect(b, width, height, ox + 10, oy + 5, 12, 23, outline);
    rect(b, width, height, ox + 12, oy + 7, 8, 19, '#6d4a2d');
    ellipse(b, width, height, ox + 16, oy + 5, 7, 4, '#f7cc5f');
  });
  tile(37, (ox, oy) => {
    rect(b, width, height, ox + 8, oy + 8, 16, 18, outline);
    rect(b, width, height, ox + 10, oy + 10, 12, 14, '#8b4c33');
    rect(b, width, height, ox + 12, oy + 12, 8, 10, '#3c2e27');
  });
  tile(38, (ox, oy) => {
    rect(b, width, height, ox + 5, oy + 14, 22, 11, '#7d5233');
    rect(b, width, height, ox + 8, oy + 9, 16, 11, '#5d3b26');
    rect(b, width, height, ox + 11, oy + 6, 10, 7, '#3d2a1d');
  });
  tile(39, (ox, oy) => {
    rect(b, width, height, ox + 6, oy + 19, 20, 7, outline);
    rect(b, width, height, ox + 8, oy + 20, 16, 5, '#b59754');
    for (let x = 9; x < 24; x += 5) rect(b, width, height, ox + x, oy + 10, 3, 12, '#b2893e');
    rect(b, width, height, ox + 7, oy + 8, 18, 4, '#d5b65a');
  });
  tile(40, (ox, oy) => {
    rect(b, width, height, ox + 8, oy + 10, 16, 17, outline);
    rect(b, width, height, ox + 10, oy + 12, 12, 13, '#765f35');
    rect(b, width, height, ox + 6, oy + 7, 20, 7, '#d9bc5a');
  });
  tile(41, (ox, oy) => {
    rect(b, width, height, ox + 8, oy + 8, 16, 20, '#7b5132');
    for (let x = 9; x < 24; x += 5) rect(b, width, height, ox + x, oy + 9, 2, 18, '#c79d4b');
  });
  tile(42, (ox, oy) => {
    rect(b, width, height, ox + 8, oy + 11, 16, 16, '#8b6e31');
    rect(b, width, height, ox + 9, oy + 7, 14, 8, '#d4b75f');
    rect(b, width, height, ox + 6, oy + 20, 20, 4, '#caa74d');
  });
  tile(43, (ox, oy) => {
    rect(b, width, height, ox + 5, oy + 20, 22, 5, '#75472b');
    rect(b, width, height, ox + 7, oy + 15, 18, 5, '#8a5735');
    rect(b, width, height, ox + 9, oy + 10, 14, 5, '#a36b43');
  });
  tile(44, (ox, oy) => {
    for (let x = 3; x < 32; x += 6) rect(b, width, height, ox + x, oy + 5, 4, 23, '#8f5b33');
    rect(b, width, height, ox + 1, oy + 8, 30, 4, '#c48c52');
    rect(b, width, height, ox + 1, oy + 22, 30, 4, '#6e4327');
  });
  tile(45, (ox, oy) => {
    rect(b, width, height, ox + 3, oy + 20, 26, 5, '#7a4d2f');
    rect(b, width, height, ox + 6, oy + 15, 20, 5, '#9f6b40');
    rect(b, width, height, ox + 9, oy + 10, 14, 5, '#c28a52');
  });
  tile(46, (ox, oy) => {
    rect(b, width, height, ox + 7, oy + 6, 18, 22, outline);
    rect(b, width, height, ox + 9, oy + 8, 14, 18, '#4b4039');
    rect(b, width, height, ox + 10, oy + 18, 12, 8, '#201917');
    rect(b, width, height, ox + 7, oy + 5, 18, 5, '#75655a');
  });
  tile(47, (ox, oy) => {
    rect(b, width, height, ox + 11, oy + 7, 10, 21, '#6f6e67');
    rect(b, width, height, ox + 13, oy + 9, 6, 17, '#9b9a8e');
    rect(b, width, height, ox + 7, oy + 27, 18, 3, '#3f3e3a');
  });
  tile(48, (ox, oy) => {
    rect(b, width, height, ox + 8, oy + 12, 16, 15, outline);
    rect(b, width, height, ox + 10, oy + 14, 12, 11, '#62432a');
    rect(b, width, height, ox + 12, oy + 12, 8, 4, '#d6b35b');
  });
  tile(49, (ox, oy) => {
    rect(b, width, height, ox + 8, oy + 8, 16, 20, '#82602d');
    rect(b, width, height, ox + 10, oy + 10, 12, 16, '#d8b550');
    line(b, width, height, ox + 9, oy + 10, ox + 23, oy + 25, 2, '#60441f');
  });
  tile(50, (ox, oy) => {
    rect(b, width, height, ox + 14, oy + 5, 5, 22, '#6a4428');
    rect(b, width, height, ox + 9, oy + 7, 15, 13, '#9b6a42');
    rect(b, width, height, ox + 13, oy + 10, 7, 8, '#d8bf73');
  });
  tile(51, (ox, oy) => {
    rect(b, width, height, ox + 7, oy + 7, 18, 20, '#734527');
    rect(b, width, height, ox + 10, oy + 10, 12, 14, '#b98247');
    rect(b, width, height, ox + 12, oy + 12, 8, 10, '#694225');
  });
  tile(52, (ox, oy) => {
    rect(b, width, height, ox + 6, oy + 18, 20, 8, '#6d482e');
    rect(b, width, height, ox + 12, oy + 6, 8, 14, '#51331f');
    rect(b, width, height, ox + 8, oy + 7, 16, 5, '#88724f');
  });

  savePng(join(ASSET_DIR, 'human_starting_props_v2.png'), b, width, height);
}

function generateAnimatedSheet() {
  const width = ANIM_COLUMNS * TILE;
  const height = Math.ceil(ANIM_COUNT / ANIM_COLUMNS) * TILE;
  const b = canvas(width, height);
  const tile = (id, cb) => drawTile(b, width, ANIM_COLUMNS, id, cb);

  for (let f = 0; f < 4; f += 1) {
    tile(f, (ox, oy) => {
      rect(b, width, height, ox, oy, 32, 32, '#4b91a7');
      for (let y = -4; y < 36; y += 8) line(b, width, height, ox, oy + y + f * 2, ox + 32, oy + y + 6 + f * 2, 2, '#7ac6d5', 130);
      specks(b, width, height, ox, oy, '#2d6677', 16);
    });
    tile(4 + f, (ox, oy) => {
      rect(b, width, height, ox, oy, 32, 32, '#3c7c92');
      for (let x = 4; x < 32; x += 7) line(b, width, height, ox + x, oy + 1, ox + x - 3 + f, oy + 31, 3, '#9ad9e2', 170);
    });
    tile(8 + f, (ox, oy) => {
      rect(b, width, height, ox + 6, oy + 22, 20, 5, '#5a3822');
      rect(b, width, height, ox + 9, oy + 17, 14, 5, '#7b4d2d');
      ellipse(b, width, height, ox + 16, oy + 18, 5 + (f % 2), 8, '#ff7c2a');
      ellipse(b, width, height, ox + 16, oy + 18, 3, 5 + (f % 2), '#ffd35f');
    });
    tile(12 + f, (ox, oy) => {
      rect(b, width, height, ox + 14, oy + 7, 4, 22, '#6a4328');
      ellipse(b, width, height, ox + 16, oy + 8, 4 + (f % 2), 6, '#ff8b2c');
      ellipse(b, width, height, ox + 16, oy + 8, 2, 4, '#ffdf7a');
    });
    tile(16 + f, (ox, oy) => {
      rect(b, width, height, ox, oy, 32, 32, '#87985e', 0);
      for (let i = 0; i < 12; i += 1) line(b, width, height, ox + 3 + i * 2, oy + 21, ox + 5 + i * 2 + f % 2, oy + 12, 1, '#6e8b4e', 180);
    });
  }

  savePng(join(ASSET_DIR, 'human_starting_animated_v2.png'), b, width, height);
}

function specks(buffer, width, height, ox, oy, color, count) {
  for (let i = 0; i < count; i += 1) rect(buffer, width, height, ox + Math.floor(rng() * 32), oy + Math.floor(rng() * 32), 2, 1, color, 120);
}

function writeTsx() {
  writeFileSync(join(TILESET_DIR, 'human_starting_zone_v2.tsx'), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="human_starting_zone_v2" tilewidth="32" tileheight="32" tilecount="${TERRAIN_COUNT}" columns="${TERRAIN_COLUMNS}">
 <image source="../assets/tilesets/human_starting_zone_v2.png" width="${TERRAIN_COLUMNS * TILE}" height="${Math.ceil(TERRAIN_COUNT / TERRAIN_COLUMNS) * TILE}"/>
</tileset>
`);

  writeFileSync(join(TILESET_DIR, 'human_starting_props_v2.tsx'), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="human_starting_props_v2" tilewidth="32" tileheight="32" tilecount="${PROPS_COUNT}" columns="${PROPS_COLUMNS}">
 <image source="../assets/tilesets/human_starting_props_v2.png" width="${PROPS_COLUMNS * TILE}" height="${Math.ceil(PROPS_COUNT / PROPS_COLUMNS) * TILE}"/>
</tileset>
`);

  const animTiles = [
    [0, [0, 1, 2, 3], 180],
    [4, [4, 5, 6, 7], 140],
    [8, [8, 9, 10, 11], 120],
    [12, [12, 13, 14, 15], 110],
    [16, [16, 17, 18, 19], 260],
  ].map(([id, frames, duration]) => ` <tile id="${id}">
  <animation>
${frames.map((frame) => `   <frame tileid="${frame}" duration="${duration}"/>`).join('\n')}
  </animation>
 </tile>`).join('\n');

  writeFileSync(join(TILESET_DIR, 'human_starting_animated_v2.tsx'), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="human_starting_animated_v2" tilewidth="32" tileheight="32" tilecount="${ANIM_COUNT}" columns="${ANIM_COLUMNS}">
 <image source="../assets/tilesets/human_starting_animated_v2.png" width="${ANIM_COLUMNS * TILE}" height="${Math.ceil(ANIM_COUNT / ANIM_COLUMNS) * TILE}"/>
${animTiles}
</tileset>
`);
}

const ground = Array.from({ length: MAP_W * MAP_H }, () => terrainGid(0));
const water = Array.from({ length: MAP_W * MAP_H }, () => 0);
const decor = Array.from({ length: MAP_W * MAP_H }, () => 0);
const collision = Array.from({ length: MAP_W * MAP_H }, () => 0);

function idx(x, y) {
  return y * MAP_W + x;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

function setTile(layer, x, y, gid) {
  if (!inBounds(x, y)) return;
  layer[idx(x, y)] = gid;
}

function fill(layer, x, y, w, h, gid) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) setTile(layer, xx, yy, gid);
}

function markCollision(x, y, w = 1, h = 1) {
  fill(collision, x, y, w, h, terrainGid(63));
}

function clearCollision(x, y, w = 1, h = 1) {
  fill(collision, x, y, w, h, 0);
}

function fillEllipse(layer, cx, cy, rx, ry, gid) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) setTile(layer, x, y, gid);
    }
  }
}

function pointLine(points) {
  const result = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      result.push([Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t)]);
    }
  }
  return result;
}

function drawRoad(points, radius = 3) {
  for (const [x, y] of pointLine(points)) {
    fillEllipse(ground, x, y, radius + (Math.floor(rng() * 2)), radius - 1 + (Math.floor(rng() * 2)), terrainGid(4 + Math.floor(rng() * 2)));
    for (let yy = y - radius - 1; yy <= y + radius + 1; yy += 1) {
      for (let xx = x - radius - 1; xx <= x + radius + 1; xx += 1) {
        if (!inBounds(xx, yy)) continue;
        const d = Math.hypot(xx - x, yy - y);
        if (d > radius && d < radius + 1.5 && ground[idx(xx, yy)] === terrainGid(0)) setTile(ground, xx, yy, terrainGid(6));
      }
    }
  }
}

function placeProp(x, y, propId, solid = false) {
  setTile(decor, x, y, propsGid(propId));
  if (solid) markCollision(x, y);
}

function placeTree(x, y, type = 'oak') {
  placeProp(x, y, type === 'pine' ? 1 : 0, true);
}

function placeFenceRect(x, y, w, h, gateX = null) {
  for (let xx = x; xx < x + w; xx += 1) {
    if (xx !== gateX) {
      placeProp(xx, y, 5, true);
      placeProp(xx, y + h - 1, 5, true);
    }
  }
  for (let yy = y + 1; yy < y + h - 1; yy += 1) {
    placeProp(x, yy, 4, true);
    placeProp(x + w - 1, yy, 4, true);
  }
}

function placeHouse(x, y, w, h, doorOffset = Math.floor(w / 2), shop = false) {
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      if (yy === 0) placeProp(x + xx, y + yy, 16 + (xx % 4), true);
      else placeProp(x + xx, y + yy, 24 + ((xx + yy) % 4), true);
    }
  }
  placeProp(x + doorOffset, y + h - 1, 32, false);
  clearCollision(x + doorOffset, y + h - 1);
  if (w > 3) {
    placeProp(x + 1, y + Math.max(1, h - 2), 33, true);
    placeProp(x + w - 2, y + Math.max(1, h - 2), 33, true);
  }
  if (shop) placeProp(x + doorOffset, y + h, 6, true);
}

function placeBridge(x, y, w, h) {
  fill(decor, x, y, w, h, propsGid(44));
  fill(collision, x, y, w, h, 0);
}

function addForest(bounds, count, type = 'mixed') {
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 20) {
    attempts += 1;
    const x = bounds.x + Math.floor(rng() * bounds.w);
    const y = bounds.y + Math.floor(rng() * bounds.h);
    const g = ground[idx(x, y)];
    if (water[idx(x, y)] || decor[idx(x, y)] || g === terrainGid(4) || g === terrainGid(5) || g === terrainGid(7)) continue;
    if (Math.hypot(x - 98, y - 111) < 23) continue;
    placeTree(x, y, type === 'pine' || (type === 'mixed' && rng() > 0.5) ? 'pine' : 'oak');
    if (rng() > 0.65) placeProp(x + (rng() > 0.5 ? 1 : -1), y + 1, 2, false);
    placed += 1;
  }
}

function addVillage() {
  fillEllipse(ground, 99, 111, 19, 14, terrainGid(7));
  fill(ground, 91, 104, 17, 9, terrainGid(21));
  placeHouse(88, 91, 6, 5, 3);
  placeHouse(102, 94, 7, 5, 3, true);
  placeHouse(78, 104, 6, 5, 3);
  placeHouse(112, 111, 6, 5, 3);
  placeHouse(91, 122, 7, 5, 3);

  placeProp(99, 110, 34, true);
  placeProp(95, 107, 35, true);
  placeProp(105, 107, 35, true);
  placeProp(94, 117, 35, true);
  placeProp(107, 117, 35, true);
  placeProp(110, 102, 6, true);
  placeProp(92, 101, 6, true);
  placeProp(101, 116, 7, true);
  placeProp(102, 116, 8, true);
  placeProp(103, 116, 9, true);
  placeProp(86, 111, 50, true);
  placeProp(83, 111, 51, true);

  placeFenceRect(72, 119, 14, 10, 79);
  for (let y = 121; y < 127; y += 1) for (let x = 74; x < 84; x += 1) setTile(ground, x, y, terrainGid(25));
  for (let x = 74; x < 84; x += 2) for (let y = 121; y < 127; y += 2) placeProp(x, y, 40 + ((x + y) % 3), false);

  for (const [x, y] of [[88, 115], [89, 115], [110, 118], [111, 118], [96, 102], [97, 102]]) placeProp(x, y, 11, false);
}

function addRiver() {
  for (let y = 0; y < MAP_H; y += 1) {
    const cx = Math.round(24 + Math.sin(y / 15) * 4 + Math.sin(y / 37) * 3);
    for (let x = cx - 4; x <= cx + 4; x += 1) {
      setTile(water, x, y, animGid(0));
      setTile(ground, x, y, terrainGid(13));
      markCollision(x, y);
    }
    for (let x = cx - 6; x <= cx + 6; x += 1) {
      if (!water[idx(x, y)] && inBounds(x, y)) setTile(ground, x, y, terrainGid(14));
    }
  }
  placeBridge(22, 102, 10, 3);
  fill(ground, 22, 102, 10, 3, terrainGid(4));
  placeProp(35, 98, 45, true);
  placeProp(38, 99, 13, false);
  placeProp(40, 100, 13, false);
}

function addMine() {
  fillEllipse(ground, 98, 34, 22, 14, terrainGid(20));
  placeProp(97, 29, 46, true);
  placeProp(98, 29, 46, true);
  placeProp(99, 29, 46, true);
  placeProp(98, 31, 37, false);
  markCollision(96, 28, 5, 3);
  clearCollision(98, 31);
  for (const [x, y] of [[86, 37], [89, 42], [106, 40], [111, 32], [94, 47]]) placeProp(x, y, 12, true);
  for (let x = 82; x < 114; x += 3) if (rng() > 0.45) placeProp(x, 47 + Math.floor(rng() * 7), 48, false);
}

function addFarmAndFields() {
  fillEllipse(ground, 142, 145, 28, 18, terrainGid(2));
  for (let fy = 137; fy <= 156; fy += 8) {
    for (let fx = 128; fx <= 156; fx += 10) {
      fill(ground, fx, fy, 8, 6, terrainGid(24));
      for (let y = fy + 1; y < fy + 5; y += 2) for (let x = fx + 1; x < fx + 7; x += 2) placeProp(x, y, 40 + ((x + y) % 3), false);
    }
  }
  placeFenceRect(123, 132, 39, 29, 143);
  placeProp(164, 145, 49, true);
  placeProp(151, 133, 42, true);
  placeProp(154, 134, 42, true);
  placeProp(121, 144, 52, true);
}

function addGraveyard() {
  fillEllipse(ground, 55, 158, 17, 13, terrainGid(22));
  placeFenceRect(41, 146, 30, 24, 55);
  for (const [x, y] of [[48, 153], [52, 155], [56, 152], [61, 158], [46, 162], [59, 165], [64, 151], [50, 168]]) placeProp(x, y, 47, true);
  placeProp(67, 164, 8, true);
  placeProp(43, 150, 38, true);
}

function addBossClearing() {
  fillEllipse(ground, 161, 51, 23, 16, terrainGid(3));
  fillEllipse(ground, 161, 51, 11, 7, terrainGid(11));
  placeProp(160, 49, 3, true);
  for (const [x, y] of [[147, 44], [151, 62], [175, 42], [178, 59], [162, 68]]) placeProp(x, y, 3, true);
  addForest({ x: 135, y: 24, w: 55, h: 54 }, 55, 'mixed');
}

function addWorldRoad() {
  fillEllipse(ground, 191, 99, 8, 13, terrainGid(4));
  for (let y = 88; y < 111; y += 1) fill(ground, 189, y, 11, 1, terrainGid(4));
  placeProp(186, 96, 6, true);
  placeProp(187, 97, 50, true);
}

function addDecorRegions() {
  addForest({ x: 3, y: 3, w: 63, h: 85 }, 165, 'mixed');
  addForest({ x: 5, y: 170, w: 188, h: 28 }, 120, 'pine');
  addForest({ x: 3, y: 4, w: 25, h: 190 }, 145, 'mixed');
  addForest({ x: 176, y: 3, w: 21, h: 190 }, 130, 'mixed');
  addForest({ x: 115, y: 60, w: 55, h: 48 }, 35, 'mixed');
  addForest({ x: 72, y: 135, w: 35, h: 50 }, 50, 'mixed');

  for (let i = 0; i < 120; i += 1) {
    const x = Math.floor(rng() * MAP_W);
    const y = Math.floor(rng() * MAP_H);
    if (water[idx(x, y)] || decor[idx(x, y)] || ground[idx(x, y)] === terrainGid(4) || ground[idx(x, y)] === terrainGid(5) || Math.hypot(x - 98, y - 111) < 18) continue;
    placeProp(x, y, [2, 4, 11, 12, 13][Math.floor(rng() * 5)], rng() > 0.65);
  }
}

function addMapLayout() {
  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      if (x < 8 || y < 8 || x > 191 || y > 191) setTile(ground, x, y, terrainGid(26));
      else if (rng() > 0.985) setTile(ground, x, y, terrainGid(10));
      else if (rng() > 0.975) setTile(ground, x, y, terrainGid(9));
    }
  }

  addRiver();
  drawRoad([[98, 112], [122, 110], [150, 104], [177, 99], [199, 98]], 3);
  drawRoad([[98, 108], [100, 84], [96, 57], [98, 31]], 3);
  drawRoad([[102, 118], [120, 132], [145, 151]], 3);
  drawRoad([[93, 111], [70, 112], [50, 106], [31, 103]], 3);
  drawRoad([[105, 105], [124, 86], [145, 63], [161, 52]], 3);

  addVillage();
  addMine();
  addFarmAndFields();
  addGraveyard();
  addBossClearing();
  addWorldRoad();
  addDecorRegions();
}

let objectId = 1;
const props = {
  string: (name, value) => ({ name, type: 'string', value }),
  int: (name, value) => ({ name, type: 'int', value }),
  bool: (name, value) => ({ name, type: 'bool', value }),
};

function obj(name, x, y, w, h, properties = [], point = false) {
  const base = {
    height: point ? 0 : h,
    id: objectId,
    name,
    opacity: 1,
    rotation: 0,
    type: '',
    visible: true,
    width: point ? 0 : w,
    x,
    y,
  };
  objectId += 1;
  if (point) base.point = true;
  if (properties.length) base.properties = properties;
  return base;
}

function pointObj(name, tx, ty, properties) {
  return obj(name, tx * TILE + 16, ty * TILE + 16, 0, 0, properties, true);
}

function rectObj(name, tx, ty, tw, th, properties) {
  return obj(name, tx * TILE, ty * TILE, tw * TILE, th * TILE, properties, false);
}

function commonZone(type, zoneId, recommendedLevel, extra = []) {
  return [props.string('type', type), props.string('zoneId', zoneId), props.int('recommendedLevel', recommendedLevel), ...extra];
}

function buildObjects() {
  const NPCs = [
    pointObj('mayor_elder', 99, 108, commonZone('npc', 'northshire_village', 1, [props.string('npcType', 'mayor')])),
    pointObj('shopkeeper', 107, 100, commonZone('npc', 'northshire_village', 1, [props.string('npcType', 'shopkeeper')])),
    pointObj('trainer', 82, 110, commonZone('npc', 'northshire_village', 1, [props.string('npcType', 'trainer')])),
    pointObj('quest_giver_wolves', 87, 96, commonZone('npc', 'northshire_village', 1, [props.string('questId', 'wolves_at_the_treeline')])),
    pointObj('quest_giver_mine', 103, 112, commonZone('npc', 'northshire_village', 2, [props.string('questId', 'kobolds_in_the_old_mine')])),
    pointObj('river_fisher', 38, 99, commonZone('npc', 'riverbend_fields', 1, [props.string('npcType', 'fisher')])),
  ];

  const Spawns = [
    rectObj('wolf_spawn_northshire', 35, 30, 37, 47, commonZone('enemy_spawn', 'wolfwoods', 2, [props.string('enemyType', 'wolf'), props.int('maxEnemies', 14), props.int('maxAlive', 14), props.int('respawnTime', 22000), props.int('respawnMin', 15000), props.int('respawnMax', 30000)])),
    rectObj('kobold_spawn_mine', 82, 27, 34, 29, commonZone('enemy_spawn', 'old_mine', 3, [props.string('enemyType', 'kobold'), props.int('maxEnemies', 10), props.int('maxAlive', 10), props.int('respawnTime', 25000), props.int('respawnMin', 15000), props.int('respawnMax', 30000)])),
    rectObj('bandit_spawn_fields', 125, 133, 38, 31, commonZone('enemy_spawn', 'riverbend_fields', 4, [props.string('enemyType', 'bandit'), props.int('maxEnemies', 10), props.int('maxAlive', 10), props.int('respawnTime', 26000), props.int('respawnMin', 15000), props.int('respawnMax', 30000)])),
    rectObj('undead_spawn_graveyard', 43, 147, 28, 26, commonZone('enemy_spawn', 'northshire_graveyard', 5, [props.string('enemyType', 'undead'), props.int('maxEnemies', 8), props.int('maxAlive', 8), props.int('respawnTime', 30000), props.int('respawnMin', 18000), props.int('respawnMax', 30000)])),
  ];

  const BossSpawns = [
    rectObj('human_forest_boss_01', 151, 43, 22, 18, commonZone('boss_spawn', 'briarheart_clearing', 6, [props.string('bossType', 'elder_briarheart'), props.string('enemyType', 'forest_boss'), props.int('maxEnemies', 1), props.int('maxAlive', 1), props.int('respawnTime', 60000), props.int('respawnMin', 60000), props.int('respawnMax', 60000)])),
  ];

  const Transitions = [
    rectObj('old_mine_entrance', 97, 29, 4, 4, commonZone('dungeon_entrance', 'old_mine', 4, [props.string('targetMap', 'old_mine_dungeon'), props.string('targetSpawn', 'old_mine_start')])),
    rectObj('human_to_world_road', 189, 88, 11, 24, commonZone('world_exit', 'world_road', 1, [props.string('targetMap', 'world'), props.string('targetSpawn', 'human_road_exit')])),
  ];

  const Zones = [
    rectObj('human_starting_area', 76, 88, 47, 46, commonZone('safe_zone', 'northshire_village', 1, [props.string('biome', 'village')])),
    rectObj('wolfwoods', 31, 23, 47, 61, commonZone('zone', 'wolfwoods', 2, [props.string('enemyType', 'wolf')])),
    rectObj('old_mine', 80, 23, 39, 36, commonZone('zone', 'old_mine', 3, [props.string('enemyType', 'kobold')])),
    rectObj('riverbend_fields', 120, 128, 47, 42, commonZone('zone', 'riverbend_fields', 4, [props.string('enemyType', 'bandit')])),
    rectObj('northshire_graveyard', 40, 144, 35, 31, commonZone('zone', 'northshire_graveyard', 5, [props.string('enemyType', 'undead')])),
    rectObj('briarheart_clearing', 143, 36, 41, 35, commonZone('zone', 'briarheart_clearing', 6, [props.string('bossType', 'elder_briarheart')])),
    rectObj('world_road', 183, 85, 17, 31, commonZone('zone', 'world_road', 1, [props.string('targetMap', 'world')])),
  ];

  const graveyard = [
    pointObj('graveyard_northshire', 56, 158, commonZone('graveyard', 'northshire_graveyard', 1)),
    pointObj('graveyard_village_chapel', 94, 124, commonZone('graveyard', 'northshire_village', 1)),
  ];

  const raceStart = [
    pointObj('human_starting_area', 99, 112, [props.string('type', 'player_start'), props.string('race', 'human'), props.string('zoneId', 'northshire_village'), props.int('recommendedLevel', 1)]),
  ];

  return { NPCs, Spawns, BossSpawns, Transitions, Zones, graveyard, raceStart };
}

function layer(name, data, visible = true) {
  return {
    data,
    height: MAP_H,
    id: objectId++,
    name,
    opacity: 1,
    type: 'tilelayer',
    visible,
    width: MAP_W,
    x: 0,
    y: 0,
  };
}

function objectLayer(name, objects) {
  return {
    draworder: 'topdown',
    id: objectId++,
    name,
    objects,
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
}

function writeMap() {
  const objects = buildObjects();
  const map = {
    compressionlevel: -1,
    height: MAP_H,
    infinite: false,
    layers: [
      layer('Ground', ground),
      layer('water', water),
      layer('Decor', decor),
      layer('Collision', collision, false),
      objectLayer('NPCs', objects.NPCs),
      objectLayer('Spawns', objects.Spawns),
      objectLayer('BossSpawns', objects.BossSpawns),
      objectLayer('Transitions', objects.Transitions),
      objectLayer('Zones', objects.Zones),
      objectLayer('graveyard', objects.graveyard),
      objectLayer('raceStart', objects.raceStart),
    ],
    nextlayerid: objectId + 1,
    nextobjectid: objectId + 100,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.11.2',
    tileheight: TILE,
    tilesets: [
      { firstgid: TERRAIN_FIRST, source: '../tilesets/human_starting_zone_v2.tsx' },
      { firstgid: PROPS_FIRST, source: '../tilesets/human_starting_props_v2.tsx' },
      { firstgid: ANIM_FIRST, source: '../tilesets/human_starting_animated_v2.tsx' },
    ],
    tilewidth: TILE,
    type: 'map',
    version: '1.10',
    width: MAP_W,
  };
  writeFileSync(join(MAP_DIR, 'human_starting_zone_v2.tmj'), `${JSON.stringify(map, null, 2)}\n`);
}

function writeDocs() {
  writeFileSync(join(DOC_DIR, 'human_starting_zone_v2_notes.md'), `# Human Starting Zone V2

Generated by \`scripts/improveHumanStartingZone.js\`.

## Files

- \`public/maps/human_starting_zone_v2.tmj\`
- \`public/tilesets/human_starting_zone_v2.tsx\`
- \`public/tilesets/human_starting_props_v2.tsx\`
- \`public/tilesets/human_starting_animated_v2.tsx\`
- \`public/assets/tilesets/human_starting_zone_v2.png\`
- \`public/assets/tilesets/human_starting_props_v2.png\`
- \`public/assets/tilesets/human_starting_animated_v2.png\`

## Zones

- \`northshire_village\`: safe human starting village with spawn, houses, well, trainer, shopkeeper, mayor, and quest NPCs.
- \`wolfwoods\`: dense forest starter combat area. Object: \`wolf_spawn_northshire\`.
- \`old_mine\`: northern rocky mine/kobold area. Objects: \`kobold_spawn_mine\`, \`old_mine_entrance\`.
- \`riverbend_fields\`: southeast farm and field area. Object: \`bandit_spawn_fields\`.
- \`northshire_graveyard\`: southwest graveyard/undead area. Object: \`undead_spawn_graveyard\`.
- \`briarheart_clearing\`: northeast forest boss clearing. Object: \`human_forest_boss_01\`.
- \`world_road\`: eastern exit road. Object: \`human_to_world_road\`.

## Object Properties

Common properties:

- \`type\`: logical role, for example \`enemy_spawn\`, \`boss_spawn\`, \`npc\`, \`zone\`, \`graveyard\`, \`player_start\`, \`world_exit\`.
- \`zoneId\`: stable zone identifier used by game logic.
- \`recommendedLevel\`: suggested player level.
- \`enemyType\`: set on enemy spawn zones.
- \`bossType\`: set on boss spawn zones.
- \`maxEnemies\` and \`maxAlive\`: intended fixed pack population.
- \`respawnTime\`, \`respawnMin\`, \`respawnMax\`: respawn timing in milliseconds.

## Expansion Notes

- Keep gameplay objects on object layers, not baked into tile layers.
- Add new NPCs to the \`NPCs\` layer as point objects with \`type=npc\`.
- Add enemy packs as rectangle objects on \`Spawns\`, then set \`enemyType\`, \`maxEnemies\`, and respawn properties.
- Keep roads walkable and place collision only on trunks, buildings, fences, water, rocks, and blocked mine walls.
- Animated tiles are in \`human_starting_animated_v2.tsx\`: water, waterfall, campfire, torch, and grass sway.
`);
}

generateTerrainSheet();
generatePropsSheet();
generateAnimatedSheet();
writeTsx();
addMapLayout();
writeMap();
writeDocs();

console.log('Generated human_starting_zone_v2.tmj and v2 tilesets.');
