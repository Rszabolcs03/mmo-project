import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TILESET_DIR = join(ROOT, 'public', 'assets', 'tilesets');
const TILED_TILESET_DIR = join(ROOT, 'public', 'tilesets');
const MAP_DIR = join(ROOT, 'public', 'maps');

const TILE = 32;
const MAP_W = 200;
const MAP_H = 200;
const TERRAIN_FIRST = 1;
const PROPS_FIRST = 65;
const ANIM_FIRST = 129;

mkdirSync(TILESET_DIR, { recursive: true });
mkdirSync(TILED_TILESET_DIR, { recursive: true });
mkdirSync(MAP_DIR, { recursive: true });

function hex(hexColor, alpha = 255) {
  const clean = hexColor.replace('#', '');
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
  const index = (y * width + x) * 4;
  buffer[index] = rgba[0];
  buffer[index + 1] = rgba[1];
  buffer[index + 2] = rgba[2];
  buffer[index + 3] = rgba[3];
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
}

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const rng = makeRng(946231);

function drawTile(buffer, sheetWidth, id, draw) {
  const ox = (id % 8) * TILE;
  const oy = Math.floor(id / 8) * TILE;
  draw(ox, oy);
}

function terrainSheet() {
  const width = 256;
  const height = 256;
  const b = canvas(width, height);
  const grass = ['#87985e', '#8e9f66', '#7f9058', '#96aa6d'];

  for (let id = 0; id < 64; id += 1) {
    drawTile(b, width, id, (ox, oy) => {
      const base = grass[id % grass.length];
      rect(b, width, height, ox, oy, TILE, TILE, base);
      for (let i = 0; i < 18; i += 1) {
        const x = ox + Math.floor(rng() * TILE);
        const y = oy + Math.floor(rng() * TILE);
        rect(b, width, height, x, y, 2, 1, rng() > 0.5 ? '#6f844c' : '#a5b97b', 180);
      }
    });
  }

  const dirt = (id, base) => drawTile(b, width, id, (ox, oy) => {
    rect(b, width, height, ox, oy, TILE, TILE, base);
    for (let i = 0; i < 26; i += 1) rect(b, width, height, ox + Math.floor(rng() * TILE), oy + Math.floor(rng() * TILE), 3, 2, rng() > 0.5 ? '#a58a58' : '#78613f', 170);
  });
  dirt(4, '#b19a65');
  dirt(5, '#a48c57');
  dirt(6, '#7f755c');
  drawTile(b, width, 7, (ox, oy) => {
    rect(b, width, height, ox, oy, TILE, TILE, '#8d856e');
    for (let yy = 2; yy < TILE; yy += 8) for (let xx = (yy % 16) / 2; xx < TILE; xx += 12) rect(b, width, height, ox + xx, oy + yy, 8, 5, '#b6aa88', 210);
  });
  drawTile(b, width, 8, (ox, oy) => {
    rect(b, width, height, ox, oy, TILE, TILE, '#735638');
    for (let x = 2; x < TILE; x += 6) line(b, width, height, ox + x, oy + 2, ox + x - 4, oy + 30, 2, '#4e3824', 190);
  });
  drawTile(b, width, 9, (ox, oy) => {
    rect(b, width, height, ox, oy, TILE, TILE, '#86a768');
    for (let i = 0; i < 10; i += 1) rect(b, width, height, ox + Math.floor(rng() * TILE), oy + Math.floor(rng() * TILE), 2, 4, '#f2d05e', 210);
  });
  drawTile(b, width, 10, (ox, oy) => {
    rect(b, width, height, ox, oy, TILE, TILE, '#9aaa6c');
    for (let i = 0; i < 9; i += 1) rect(b, width, height, ox + Math.floor(rng() * TILE), oy + Math.floor(rng() * TILE), 3, 3, '#ffefe0', 220);
  });
  drawTile(b, width, 11, (ox, oy) => {
    rect(b, width, height, ox, oy, TILE, TILE, '#6d7d53');
    for (let i = 0; i < 20; i += 1) rect(b, width, height, ox + Math.floor(rng() * TILE), oy + Math.floor(rng() * TILE), 2, 2, '#52643f', 180);
  });
  savePng(join(TILESET_DIR, 'human_starting_zone.png'), b, width, height);
}

function propsSheet() {
  const width = 256;
  const height = 256;
  const b = canvas(width, height);
  const tile = (id, cb) => drawTile(b, width, id, cb);

  tile(0, (ox, oy) => {
    ellipse(b, width, height, ox + 16, oy + 15, 15, 13, '#21492f');
    ellipse(b, width, height, ox + 10, oy + 18, 9, 8, '#2d6a40');
    ellipse(b, width, height, ox + 21, oy + 12, 9, 9, '#3b7a4b');
    rect(b, width, height, ox + 13, oy + 21, 6, 10, '#6d4528');
    rect(b, width, height, ox + 12, oy + 29, 9, 3, '#412818');
  });
  tile(1, (ox, oy) => {
    for (let i = 0; i < 4; i += 1) ellipse(b, width, height, ox + 16, oy + 21 - i * 5, 12 - i * 2, 6, i % 2 ? '#375943' : '#2d4b3a');
    rect(b, width, height, ox + 14, oy + 23, 5, 9, '#68412a');
  });
  tile(2, (ox, oy) => {
    ellipse(b, width, height, ox + 14, oy + 20, 10, 8, '#315d35');
    ellipse(b, width, height, ox + 21, oy + 21, 8, 7, '#3f7b41');
    rect(b, width, height, ox + 11, oy + 26, 16, 3, '#263d24');
  });
  tile(3, (ox, oy) => {
    for (let i = 0; i < 12; i += 1) {
      const x = ox + 5 + Math.floor(rng() * 22);
      const y = oy + 12 + Math.floor(rng() * 15);
      rect(b, width, height, x, y, 2, 2, ['#f5d56b', '#f7a1c4', '#d8f6ff'][i % 3]);
    }
  });
  tile(4, (ox, oy) => {
    ellipse(b, width, height, ox + 16, oy + 20, 10, 7, '#5f625f');
    ellipse(b, width, height, ox + 13, oy + 17, 6, 5, '#888b84');
    rect(b, width, height, ox + 8, oy + 24, 17, 3, '#383b39');
  });
  tile(5, (ox, oy) => {
    rect(b, width, height, ox + 10, oy + 13, 12, 13, '#5d3823');
    ellipse(b, width, height, ox + 16, oy + 13, 7, 4, '#9a6840');
    ellipse(b, width, height, ox + 16, oy + 13, 4, 2, '#d0a05e');
  });
  tile(6, (ox, oy) => {
    line(b, width, height, ox + 7, oy + 23, ox + 25, oy + 15, 7, '#5b3b25');
    line(b, width, height, ox + 7, oy + 24, ox + 25, oy + 16, 3, '#9b6a3f');
  });
  tile(7, (ox, oy) => {
    rect(b, width, height, ox + 14, oy + 8, 5, 22, '#6b472b');
    rect(b, width, height, ox + 8, oy + 8, 17, 10, '#d8c078');
    rect(b, width, height, ox + 10, oy + 10, 13, 2, '#8b6035');
  });
  tile(8, (ox, oy) => {
    rect(b, width, height, ox, oy + 12, 32, 5, '#6d4528');
    rect(b, width, height, ox, oy + 16, 32, 3, '#9a6840');
  });
  tile(9, (ox, oy) => {
    rect(b, width, height, ox + 13, oy, 5, 32, '#6d4528');
    rect(b, width, height, ox + 17, oy, 3, 32, '#9a6840');
  });
  tile(10, (ox, oy) => {
    rect(b, width, height, ox + 12, oy + 5, 8, 25, '#6d4528');
    ellipse(b, width, height, ox + 16, oy + 7, 7, 5, '#9a6840');
  });
  tile(11, (ox, oy) => {
    rect(b, width, height, ox + 2, oy + 10, 28, 18, '#7d2f24');
    line(b, width, height, ox + 2, oy + 10, ox + 16, oy + 2, 5, '#5e2018');
    line(b, width, height, ox + 30, oy + 10, ox + 16, oy + 2, 5, '#aa4738');
  });
  tile(12, (ox, oy) => {
    rect(b, width, height, ox + 4, oy + 7, 24, 23, '#c9b18a');
    rect(b, width, height, ox + 4, oy + 7, 24, 3, '#8c7659');
  });
  tile(13, (ox, oy) => {
    rect(b, width, height, ox + 10, oy + 7, 12, 23, '#734a2c');
    rect(b, width, height, ox + 19, oy + 18, 2, 2, '#f0cd5a');
  });
  tile(14, (ox, oy) => {
    rect(b, width, height, ox + 9, oy + 10, 14, 12, '#6faec9');
    rect(b, width, height, ox + 8, oy + 9, 16, 2, '#5d422c');
    rect(b, width, height, ox + 15, oy + 10, 2, 12, '#e8f7ff');
  });
  tile(15, (ox, oy) => {
    ellipse(b, width, height, ox + 16, oy + 20, 11, 8, '#5a5f61');
    ellipse(b, width, height, ox + 16, oy + 17, 9, 5, '#8d9492');
    ellipse(b, width, height, ox + 16, oy + 16, 6, 3, '#3d6b73');
    rect(b, width, height, ox + 6, oy + 15, 4, 9, '#7b5637');
    rect(b, width, height, ox + 22, oy + 15, 4, 9, '#7b5637');
  });
  tile(16, (ox, oy) => {
    rect(b, width, height, ox + 14, oy + 8, 4, 19, '#3d2a1e');
    rect(b, width, height, ox + 11, oy + 6, 10, 5, '#e8c45f');
    rect(b, width, height, ox + 13, oy + 7, 6, 3, '#fff7ad');
  });
  tile(17, (ox, oy) => {
    rect(b, width, height, ox + 7, oy + 12, 18, 15, '#7c552e');
    rect(b, width, height, ox + 7, oy + 12, 18, 3, '#b17a42');
    rect(b, width, height, ox + 15, oy + 12, 3, 15, '#4f331e');
  });
  tile(18, (ox, oy) => {
    ellipse(b, width, height, ox + 16, oy + 18, 9, 11, '#7c552e');
    rect(b, width, height, ox + 9, oy + 10, 14, 3, '#a37444');
    rect(b, width, height, ox + 9, oy + 23, 14, 3, '#4c3320');
  });
  tile(19, (ox, oy) => {
    ellipse(b, width, height, ox + 16, oy + 21, 12, 8, '#d7aa4f');
    rect(b, width, height, ox + 8, oy + 16, 16, 9, '#c88d38');
    rect(b, width, height, ox + 11, oy + 13, 3, 14, '#f1ca66');
  });
  tile(20, (ox, oy) => {
    for (let x = 4; x < 30; x += 6) {
      rect(b, width, height, ox + x, oy + 8, 3, 18, '#e9c85d');
      rect(b, width, height, ox + x + 1, oy + 6, 2, 5, '#6a8a3c');
    }
  });
  tile(21, (ox, oy) => {
    rect(b, width, height, ox, oy + 4, 32, 24, '#8a5a36');
    for (let x = 1; x < 32; x += 7) rect(b, width, height, ox + x, oy + 4, 3, 24, '#5b3521');
    rect(b, width, height, ox, oy + 6, 32, 2, '#b67b43');
  });
  savePng(join(TILESET_DIR, 'human_starting_props.png'), b, width, height);
}

function animatedSheet() {
  const width = 256;
  const height = 128;
  const b = canvas(width, height);
  const tile = (id, cb) => drawTile(b, width, id, cb);

  for (let i = 0; i < 4; i += 1) {
    tile(i, (ox, oy) => {
      rect(b, width, height, ox, oy, 32, 32, '#4d9db0');
      for (let y = 4 + i; y < 32; y += 9) line(b, width, height, ox, oy + y, ox + 31, oy + y - 4, 2, '#75d0dc', 150);
      for (let y = 1; y < 32; y += 8) line(b, width, height, ox, oy + y, ox + 31, oy + y + 3, 1, '#2f7180', 180);
    });
  }
  for (let i = 0; i < 4; i += 1) {
    tile(4 + i, (ox, oy) => {
      rect(b, width, height, ox, oy, 32, 32, '#5bb4c8');
      for (let y = i; y < 32; y += 7) line(b, width, height, ox + 4, oy + y, ox + 28, oy + y + 2, 2, '#d9fbff', 160);
    });
  }
  for (let i = 0; i < 4; i += 1) {
    tile(8 + i, (ox, oy) => {
      rect(b, width, height, ox, oy, 32, 32, '#336f7f');
      for (let x = 3 + i; x < 32; x += 8) line(b, width, height, ox + x, oy, ox + x - 7, oy + 31, 3, '#b7f7ff', 190);
    });
  }
  for (let i = 0; i < 4; i += 1) {
    tile(12 + i, (ox, oy) => {
      rect(b, width, height, ox, oy, 32, 32, '#2e7485');
      for (let x = i; x < 32; x += 6) line(b, width, height, ox + x, oy, ox + x + 4, oy + 31, 2, '#e7ffff', 170);
    });
  }
  for (let i = 0; i < 4; i += 1) {
    tile(16 + i, (ox, oy) => {
      ellipse(b, width, height, ox + 16, oy + 25, 12, 4, '#1c1713', 150);
      rect(b, width, height, ox + 8, oy + 23, 16, 4, '#5a3621');
      line(b, width, height, ox + 9, oy + 24, ox + 23, oy + 20, 3, '#8d5b31');
      ellipse(b, width, height, ox + 16, oy + 17 - (i % 2), 5 + (i % 2), 9, '#ff8a24', 220);
      ellipse(b, width, height, ox + 16, oy + 17 - (i % 2), 3, 6, '#fff06a', 230);
    });
  }
  for (let i = 0; i < 4; i += 1) {
    tile(20 + i, (ox, oy) => {
      rect(b, width, height, ox + 14, oy + 9, 4, 20, '#3d2a1e');
      ellipse(b, width, height, ox + 16, oy + 8, 4 + (i % 2), 7, '#ff8a24', 230);
      ellipse(b, width, height, ox + 16, oy + 8, 2, 4, '#fff5a2', 240);
    });
  }
  for (let i = 0; i < 4; i += 1) {
    tile(24 + i, (ox, oy) => {
      ellipse(b, width, height, ox + 16, oy + 24, 13, 5, '#59666a');
      rect(b, width, height, ox + 9, oy + 13, 14, 12, '#6f7a77');
      for (let y = 6 + i; y < 18; y += 5) line(b, width, height, ox + 10, oy + y, ox + 22, oy + y - 2, 2, '#bdfaff', 180);
    });
  }

  savePng(join(TILESET_DIR, 'human_starting_animated.png'), b, width, height);
}

function writeTilesets() {
  writeFileSync(join(TILED_TILESET_DIR, 'human_starting_zone.tsx'), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.12.1" name="human_starting_zone" tilewidth="32" tileheight="32" tilecount="64" columns="8">
 <image source="../assets/tilesets/human_starting_zone.png" width="256" height="256"/>
</tileset>
`);
  writeFileSync(join(TILED_TILESET_DIR, 'human_starting_props.tsx'), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.12.1" name="human_starting_props" tilewidth="32" tileheight="32" tilecount="64" columns="8">
 <image source="../assets/tilesets/human_starting_props.png" width="256" height="256"/>
</tileset>
`);
  writeFileSync(join(TILED_TILESET_DIR, 'human_starting_animated.tsx'), `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.12.1" name="human_starting_animated" tilewidth="32" tileheight="32" tilecount="32" columns="8">
 <image source="../assets/tilesets/human_starting_animated.png" width="256" height="128"/>
 ${[0, 4, 8, 12, 16, 20, 24].map((start) => `<tile id="${start}">
  <animation>
   <frame tileid="${start}" duration="180"/>
   <frame tileid="${start + 1}" duration="180"/>
   <frame tileid="${start + 2}" duration="180"/>
   <frame tileid="${start + 3}" duration="180"/>
  </animation>
 </tile>`).join('\n ')}
</tileset>
`);
}

function layer(name, id, data, visible = true) {
  return { data, height: MAP_H, id, name, opacity: 1, type: 'tilelayer', visible, width: MAP_W, x: 0, y: 0 };
}

function objectLayer(name, id, objects) {
  return { draworder: 'topdown', id, name, objects, opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0 };
}

function prop(id) {
  return PROPS_FIRST + id;
}

function terrain(id) {
  return TERRAIN_FIRST + id;
}

function anim(id) {
  return ANIM_FIRST + id;
}

function index(x, y) {
  return y * MAP_W + x;
}

function set(data, x, y, gid) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
  data[index(x, y)] = gid;
}

function get(data, x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 0;
  return data[index(x, y)];
}

function setArea(data, x, y, w, h, gid) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) set(data, xx, yy, gid);
}

function clearArea(data, x, y, w, h) {
  setArea(data, x, y, w, h, 0);
}

function drawPath(ground, points, radius = 3) {
  for (let p = 0; p < points.length - 1; p += 1) {
    const [x1, y1] = points[p];
    const [x2, y2] = points[p + 1];
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const cx = Math.round(x1 + (x2 - x1) * t);
      const cy = Math.round(y1 + (y2 - y1) * t);
      for (let yy = -radius; yy <= radius; yy += 1) {
        for (let xx = -radius; xx <= radius; xx += 1) {
          if (xx * xx + yy * yy <= radius * radius + rng() * 2) set(ground, cx + xx, cy + yy, terrain(rng() > 0.3 ? 4 : 5));
        }
      }
    }
  }
}

function rectObject(id, name, x, y, w, h, properties = []) {
  return { height: h, id, name, opacity: 1, properties, rotation: 0, type: '', visible: true, width: w, x, y };
}

function pointObject(id, name, x, y, properties = []) {
  return { height: 0, id, name, opacity: 1, point: true, properties, rotation: 0, type: '', visible: true, width: 0, x, y };
}

function propValue(name, value, type = 'string') {
  return { name, type, value: String(value) };
}

function makeMap() {
  const ground = Array.from({ length: MAP_W * MAP_H }, (_, i) => {
    const x = i % MAP_W;
    const y = Math.floor(i / MAP_W);
    const noise = rng();
    if (x < 3 || y < 3 || x > MAP_W - 4 || y > MAP_H - 4) return terrain(11);
    return terrain(noise < 0.1 ? 1 : noise < 0.2 ? 2 : noise < 0.26 ? 3 : 0);
  });
  const water = Array(MAP_W * MAP_H).fill(0);
  const decor = Array(MAP_W * MAP_H).fill(0);
  const collision = Array(MAP_W * MAP_H).fill(0);

  drawPath(ground, [[8, 172], [36, 150], [64, 128], [92, 109], [107, 96], [133, 84], [180, 68]], 4);
  drawPath(ground, [[92, 109], [91, 80], [97, 53], [112, 29]], 3);
  drawPath(ground, [[92, 109], [68, 103], [44, 94], [22, 84]], 3);
  drawPath(ground, [[92, 109], [111, 122], [128, 143], [151, 172]], 3);

  for (let y = 0; y < MAP_H; y += 1) {
    const cx = Math.round(22 + Math.sin(y / 13) * 5 + Math.sin(y / 31) * 7);
    for (let dx = -4; dx <= 4; dx += 1) {
      const x = cx + dx;
      set(water, x, y, anim(dx === 0 ? 4 : 0));
      set(collision, x, y, terrain(6));
    }
  }
  for (let y = 101; y <= 109; y += 1) {
    for (let x = 17; x <= 28; x += 1) {
      set(water, x, y, 0);
      set(collision, x, y, 0);
      set(decor, x, y, prop(21));
      set(ground, x, y, terrain(4));
    }
  }

  setArea(ground, 78, 88, 30, 23, terrain(6));
  setArea(ground, 81, 91, 24, 17, terrain(7));
  setArea(ground, 125, 130, 18, 14, terrain(8));

  for (let y = 86; y <= 111; y += 1) {
    set(decor, 76, y, y % 5 === 0 ? prop(10) : prop(9));
    set(decor, 110, y, y % 5 === 0 ? prop(10) : prop(9));
    set(collision, 76, y, terrain(6));
    set(collision, 110, y, terrain(6));
  }
  for (let x = 76; x <= 110; x += 1) {
    set(decor, x, 86, x % 5 === 0 ? prop(10) : prop(8));
    if (x < 90 || x > 96) set(decor, x, 111, x % 5 === 0 ? prop(10) : prop(8));
    set(collision, x, 86, terrain(6));
    if (x < 90 || x > 96) set(collision, x, 111, terrain(6));
  }

  setArea(decor, 88, 78, 8, 4, prop(11));
  setArea(decor, 88, 82, 8, 6, prop(12));
  set(decor, 91, 87, prop(13));
  set(decor, 94, 83, prop(14));
  setArea(collision, 88, 78, 8, 10, terrain(6));
  set(decor, 101, 96, prop(15));
  set(collision, 101, 96, terrain(6));
  set(decor, 81, 97, prop(7));

  for (let x = 126; x < 142; x += 2) {
    for (let y = 132; y < 142; y += 3) set(decor, x, y, prop(20));
  }
  for (let x = 123; x <= 145; x += 1) {
    set(decor, x, 128, x % 5 === 0 ? prop(10) : prop(8));
    set(decor, x, 145, x % 5 === 0 ? prop(10) : prop(8));
  }
  for (let y = 128; y <= 145; y += 1) {
    set(decor, 123, y, y % 5 === 0 ? prop(10) : prop(9));
    set(decor, 145, y, y % 5 === 0 ? prop(10) : prop(9));
  }

  const clearings = [
    [92, 102, 26],
    [128, 136, 17],
    [30, 92, 18],
    [152, 63, 16],
  ];
  const isClearing = (x, y) => clearings.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r ** 2);
  for (let y = 5; y < MAP_H - 5; y += 1) {
    for (let x = 5; x < MAP_W - 5; x += 1) {
      if (isClearing(x, y) || get(water, x, y)) continue;
      const chance = rng();
      const dense = x < 42 || y < 40 || x > 158 || y > 164;
      if (chance < (dense ? 0.08 : 0.025)) {
        const tile = rng() < 0.6 ? prop(0) : prop(1);
        set(decor, x, y, tile);
        set(collision, x, y, terrain(6));
      } else if (chance < (dense ? 0.12 : 0.04)) {
        set(decor, x, y, rng() < 0.55 ? prop(2) : prop(3));
      } else if (chance < (dense ? 0.145 : 0.055)) {
        set(decor, x, y, rng() < 0.45 ? prop(4) : prop(5));
        if (rng() < 0.35) set(collision, x, y, terrain(6));
      }
    }
  }

  for (let x = 95; x < 101; x += 1) {
    for (let y = 47; y < 54; y += 1) {
      set(water, x, y, anim(8));
      set(collision, x, y, terrain(6));
    }
  }
  for (let y = 54; y < 64; y += 1) {
    set(water, 97, y, anim(12));
    set(water, 98, y, anim(12));
    set(collision, 97, y, terrain(6));
    set(collision, 98, y, terrain(6));
  }
  set(decor, 80, 93, anim(16));
  set(decor, 108, 89, anim(20));
  set(decor, 101, 96, prop(15));

  const objects = {
    transitions: [
      rectObject(1, 'human_to_world_road', 5700, 1970, 260, 280, [propValue('targetMap', 'world')]),
      rectObject(2, 'old_mine_entrance', 3550, 790, 160, 160, [propValue('minLevel', '4')]),
    ],
    bossSpawns: [
      rectObject(3, 'human_forest_boss_01', 4480, 1888, 520, 420, [
        propValue('bossType', 'elder_briarheart'),
        propValue('zoneId', 'northshire_forest'),
        propValue('respawnMin', '60000'),
        propValue('respawnMax', '60000'),
      ]),
    ],
    npcs: [
      pointObject(4, 'marshal_arden', 2944, 2976, [propValue('displayName', 'Marshal Arden'), propValue('npcType', 'questgiver'), propValue('interactRange', '96')]),
      pointObject(5, 'elise_shop', 3264, 3072, [propValue('displayName', 'Elise'), propValue('npcType', 'shopkeeper'), propValue('interactRange', '92')]),
      pointObject(6, 'brother_alden', 2864, 2688, [propValue('displayName', 'Brother Alden'), propValue('npcType', 'trainer'), propValue('interactRange', '92')]),
    ],
    zones: [
      rectObject(7, 'northshire_forest', 1800, 640, 3600, 2600, [
        propValue('displayName', 'Northshire Forest'),
        propValue('enemyType', 'wolf'),
        propValue('minLevel', '1'),
        propValue('maxLevel', '6'),
      ]),
      rectObject(8, 'riverbend_fields', 3600, 3800, 1600, 1000, [
        propValue('displayName', 'Riverbend Fields'),
        propValue('enemyType', 'bandit'),
        propValue('minLevel', '4'),
        propValue('maxLevel', '8'),
      ]),
    ],
    spawns: [
      rectObject(9, 'wolf_spawn_northshire', 2100, 1200, 1700, 1100, [
        propValue('enemyType', 'wolf'),
        propValue('maxAlive', '14'),
        propValue('respawnMin', '15000'),
        propValue('respawnMax', '30000'),
        propValue('zoneId', 'northshire_forest'),
      ]),
      rectObject(10, 'kobold_spawn_mine', 3360, 640, 680, 560, [
        propValue('enemyType', 'kobold'),
        propValue('maxAlive', '8'),
        propValue('respawnMin', '18000'),
        propValue('respawnMax', '32000'),
        propValue('zoneId', 'northshire_forest'),
      ]),
      rectObject(11, 'bandit_spawn_fields', 3940, 4020, 940, 620, [
        propValue('enemyType', 'bandit'),
        propValue('maxAlive', '10'),
        propValue('respawnMin', '18000'),
        propValue('respawnMax', '35000'),
        propValue('zoneId', 'riverbend_fields'),
      ]),
    ],
    graveyard: [
      pointObject(12, 'graveyard_northshire', 2550, 3270),
      pointObject(13, 'graveyard_riverbend', 4200, 3800),
    ],
    raceStart: [
      pointObject(14, 'human_starting_area', 2976, 3264, [propValue('race', 'human')]),
    ],
  };

  const map = {
    compressionlevel: -1,
    height: MAP_H,
    infinite: false,
    layers: [
      layer('Ground', 1, ground),
      layer('water', 10, water),
      objectLayer('Transitions', 9, objects.transitions),
      objectLayer('BossSpawns', 6, objects.bossSpawns),
      objectLayer('NPCs', 7, objects.npcs),
      layer('Decor', 2, decor),
      layer('Collision', 3, collision, false),
      objectLayer('Zones', 4, objects.zones),
      objectLayer('Spawns', 5, objects.spawns),
      objectLayer('graveyard', 11, objects.graveyard),
      objectLayer('raceStart', 8, objects.raceStart),
    ],
    nextlayerid: 12,
    nextobjectid: 15,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.12.1',
    tileheight: TILE,
    tilesets: [
      { firstgid: TERRAIN_FIRST, source: '../tilesets/human_starting_zone.tsx' },
      { firstgid: PROPS_FIRST, source: '../tilesets/human_starting_props.tsx' },
      { firstgid: ANIM_FIRST, source: '../tilesets/human_starting_animated.tsx' },
    ],
    tilewidth: TILE,
    type: 'map',
    version: '1.10',
    width: MAP_W,
  };

  writeFileSync(join(MAP_DIR, 'human_starting_zone.tmj'), `${JSON.stringify(map)}\n`);
}

terrainSheet();
propsSheet();
animatedSheet();
writeTilesets();
makeMap();

console.log('Generated human starting zone map and tilesets.');
