import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mapDir = path.join(rootDir, 'public', 'maps');
const tilesetDir = path.join(rootDir, 'public', 'tilesets');
const assetTilesetDir = path.join(rootDir, 'public', 'assets', 'tilesets');
const enemyDir = path.join(rootDir, 'public', 'assets', 'enemies');
const docsDir = path.join(rootDir, 'docs');

const TILE = 32;
const MAP_SIZE = 200;
const TILESET_COLUMNS = 16;
const TILESET_ROWS = 16;
const COLLISION_GID = 257;

const ZONES = [
  {
    id: 'dwarf',
    title: 'Dwarf Starting Zone',
    mapFile: 'dwarf_starting_zone.tmj',
    tilesetName: 'dwarf_starting_zone',
    raceStart: 'dwarf_starting_area',
    palette: {
      ground: '#8f9aa1',
      ground2: '#a9b2b7',
      dark: '#6f7a82',
      path: '#74665a',
      path2: '#8a7a69',
      water: '#4c8ea8',
      water2: '#65a9c5',
      rock: '#58606a',
      snow: '#dce7ec',
      accent: '#d3a84a',
      tree: '#2f5661',
      tree2: '#456c72',
      roof: '#4d3d35',
      wall: '#766456',
    },
    start: { x: 58, y: 118 },
    village: { x: 42, y: 104, w: 32, h: 28 },
    regions: {
      mine: { x: 112, y: 36, w: 34, h: 28 },
      frostwood: { x: 24, y: 24, w: 44, h: 42 },
      spiders: { x: 128, y: 132, w: 34, h: 30 },
      boss: { x: 150, y: 62, w: 28, h: 26 },
      exit: { x: 184, y: 104, w: 14, h: 24 },
    },
    enemies: [
      ['snow_wolf_spawn_frostwood', 'snow-wolf', 'Snow Wolf', 'frostwood', 2, 14],
      ['frost_trogg_spawn_pass', 'frost-trogg', 'Frost Trogg', 'mine', 4, 12],
      ['cave_spider_spawn_mine', 'cave-spider', 'Cave Spider', 'spiders', 5, 10],
    ],
    boss: ['granite_matriarch_01', 'granite-matriarch', 'Granite Matriarch', 'boss', 8],
  },
  {
    id: 'undead',
    title: 'Undead Starting Zone',
    mapFile: 'undead_starting_zone.tmj',
    tilesetName: 'undead_starting_zone',
    raceStart: 'undead_starting_area',
    palette: {
      ground: '#586151',
      ground2: '#4b5448',
      dark: '#30352f',
      path: '#665f58',
      path2: '#7a7168',
      water: '#394b4d',
      water2: '#526564',
      rock: '#4b4b56',
      snow: '#a3a795',
      accent: '#8d6bd6',
      tree: '#263226',
      tree2: '#3b453a',
      roof: '#303035',
      wall: '#695d61',
    },
    start: { x: 56, y: 52 },
    village: { x: 38, y: 36, w: 34, h: 30 },
    regions: {
      graveyard: { x: 90, y: 34, w: 42, h: 38 },
      plaguewood: { x: 24, y: 126, w: 42, h: 38 },
      crypt: { x: 128, y: 118, w: 34, h: 34 },
      boss: { x: 148, y: 44, w: 30, h: 30 },
      exit: { x: 184, y: 110, w: 14, h: 24 },
    },
    enemies: [
      ['grave_rat_spawn_cryptroad', 'grave-rat', 'Grave Rat', 'graveyard', 1, 15],
      ['plaguehound_spawn_plaguewood', 'plaguehound', 'Plaguehound', 'plaguewood', 3, 12],
      ['restless_dead_spawn_crypt', 'restless-dead', 'Restless Dead', 'crypt', 5, 12],
    ],
    boss: ['crypt_warden_01', 'crypt-warden', 'Crypt Warden', 'boss', 8],
  },
  {
    id: 'elf',
    title: 'Elf Starting Zone',
    mapFile: 'elf_starting_zone.tmj',
    tilesetName: 'elf_starting_zone',
    raceStart: 'elf_starting_area',
    palette: {
      ground: '#6f8d59',
      ground2: '#82a667',
      dark: '#43613d',
      path: '#8d765a',
      path2: '#a88b68',
      water: '#3b8c8c',
      water2: '#58b0a7',
      rock: '#66746d',
      snow: '#c8d7b2',
      accent: '#83d7e8',
      tree: '#315e3f',
      tree2: '#448a58',
      roof: '#6d4c8e',
      wall: '#8f78a9',
    },
    start: { x: 48, y: 104 },
    village: { x: 32, y: 88, w: 38, h: 32 },
    regions: {
      grove: { x: 84, y: 34, w: 42, h: 38 },
      moonpond: { x: 120, y: 98, w: 34, h: 32 },
      shadowwoods: { x: 32, y: 136, w: 44, h: 34 },
      boss: { x: 148, y: 44, w: 30, h: 30 },
      exit: { x: 184, y: 100, w: 14, h: 24 },
    },
    enemies: [
      ['forest_sprite_spawn_grove', 'forest-sprite', 'Forest Sprite', 'grove', 2, 14],
      ['corrupted_treant_spawn_moonpond', 'corrupted-treant', 'Corrupted Treant', 'moonpond', 5, 10],
      ['nightstalker_spawn_shadowwoods', 'nightstalker', 'Nightstalker', 'shadowwoods', 4, 12],
    ],
    boss: ['moonshade_stag_01', 'moonshade-stag', 'Moonshade Stag', 'boss', 8],
  },
  {
    id: 'orc',
    title: 'Orc Starting Zone',
    mapFile: 'orc_starting_zone.tmj',
    tilesetName: 'orc_starting_zone',
    raceStart: 'orc_starting_area',
    palette: {
      ground: '#a47f4d',
      ground2: '#bc9358',
      dark: '#6f5b3f',
      path: '#8a5d3b',
      path2: '#a56e42',
      water: '#3f7c7d',
      water2: '#5ba0a0',
      rock: '#6f6355',
      snow: '#d0b887',
      accent: '#d65236',
      tree: '#4f6b3a',
      tree2: '#6f853f',
      roof: '#8b2e24',
      wall: '#7a4d31',
    },
    start: { x: 52, y: 122 },
    village: { x: 34, y: 108, w: 38, h: 34 },
    regions: {
      plains: { x: 88, y: 38, w: 44, h: 38 },
      scorpion: { x: 130, y: 124, w: 38, h: 34 },
      quilboar: { x: 24, y: 40, w: 38, h: 34 },
      boss: { x: 150, y: 56, w: 30, h: 28 },
      exit: { x: 184, y: 108, w: 14, h: 24 },
    },
    enemies: [
      ['plainstrider_spawn_plains', 'plainstrider', 'Plainstrider', 'plains', 2, 14],
      ['scorpion_spawn_dustwash', 'scorpion', 'Dust Scorpion', 'scorpion', 4, 12],
      ['quilboar_spawn_thorncamp', 'quilboar', 'Razor Quilboar', 'quilboar', 5, 11],
    ],
    boss: ['bloodtusk_chief_01', 'bloodtusk-chief', 'Bloodtusk Chief', 'boss', 8],
  },
];

const HUMAN_ENEMIES = [
  ['wolf', '#30394a', '#8fa5c4'],
  ['kobold', '#9a5f30', '#f4d17b'],
  ['bandit', '#4b3a2f', '#b03a32'],
  ['restless-dead', '#6f7480', '#c5cad4'],
  ['elder-briarheart', '#4b2e1d', '#86b865', true],
];

const EXTRA_ENEMIES = [
  ['snow-wolf', '#dbe7ef', '#465a6a'],
  ['frost-trogg', '#6c8498', '#d9eef6'],
  ['cave-spider', '#26242d', '#ba7a3a'],
  ['grave-rat', '#5d5b58', '#b87b65'],
  ['plaguehound', '#5b6540', '#b6d957'],
  ['forest-sprite', '#4fb876', '#a7f3d0'],
  ['corrupted-treant', '#45301f', '#7c3f33'],
  ['nightstalker', '#24313f', '#8dd0ff'],
  ['plainstrider', '#b67d38', '#f4d27c'],
  ['scorpion', '#71482e', '#d19b55'],
  ['quilboar', '#5b3427', '#d9c1a1'],
  ['granite-matriarch', '#5e646b', '#d0d6dc', true],
  ['crypt-warden', '#3a3344', '#a78bfa', true],
  ['moonshade-stag', '#3c5670', '#a7f3d0', true],
  ['bloodtusk-chief', '#6f2f23', '#f6c453', true],
];

function crc32(buffer) {
  let crc = -1;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(width, height, pixels) {
  const rowBytes = width * 4 + 1;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * rowBytes] = 0;
    pixels.copy(raw, y * rowBytes + 1, y * width * 4, (y + 1) * width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

function hexToRgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function makeCanvas(width, height) {
  return {
    width,
    height,
    pixels: Buffer.alloc(width * height * 4),
  };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const offset = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  const rgba = Array.isArray(color) ? color : hexToRgba(color);
  canvas.pixels[offset] = rgba[0];
  canvas.pixels[offset + 1] = rgba[1];
  canvas.pixels[offset + 2] = rgba[2];
  canvas.pixels[offset + 3] = rgba[3];
}

function rect(canvas, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) setPixel(canvas, xx, yy, color);
  }
}

function ellipse(canvas, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPixel(canvas, x, y, color);
    }
  }
}

function line(canvas, x0, y0, x1, y1, color) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;
  while (true) {
    setPixel(canvas, x, y, color);
    if (x === x1 && y === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y += sy;
    }
  }
}

function drawTile(canvas, tileIndex, draw) {
  const x = (tileIndex % TILESET_COLUMNS) * TILE;
  const y = Math.floor(tileIndex / TILESET_COLUMNS) * TILE;
  draw(x, y);
}

function drawTileset(zone) {
  const canvas = makeCanvas(TILESET_COLUMNS * TILE, TILESET_ROWS * TILE);
  const p = zone.palette;

  for (let id = 0; id < 256; id += 1) {
    drawTile(canvas, id, (x, y) => {
      rect(canvas, x, y, TILE, TILE, p.ground);
      for (let i = 0; i < 10; i += 1) {
        const px = x + ((i * 13 + id * 7) % 31);
        const py = y + ((i * 17 + id * 11) % 31);
        setPixel(canvas, px, py, [255, 255, 255, 24]);
      }
    });
  }

  const tile = (id, color, accent = null) => drawTile(canvas, id, (x, y) => {
    rect(canvas, x, y, TILE, TILE, color);
    if (accent) {
      for (let i = 0; i < 5; i += 1) line(canvas, x + i * 7, y + 4, x + i * 7 + 6, y + 27, accent);
    }
  });

  tile(0, p.ground);
  tile(1, p.ground2);
  tile(2, p.dark);
  tile(3, p.path, p.path2);
  tile(4, p.path2, p.path);
  tile(5, p.water, p.water2);
  tile(6, p.water2, p.water);
  tile(7, p.rock);
  tile(8, p.snow);
  tile(9, p.ground, p.accent);

  drawTile(canvas, 32, (x, y) => {
    ellipse(canvas, x + 16, y + 13, 14, 11, '#16251c');
    ellipse(canvas, x + 14, y + 12, 12, 10, p.tree);
    ellipse(canvas, x + 20, y + 12, 11, 9, p.tree2);
    rect(canvas, x + 13, y + 19, 6, 10, '#4a3224');
  });
  drawTile(canvas, 33, (x, y) => {
    ellipse(canvas, x + 15, y + 17, 12, 9, p.tree);
    ellipse(canvas, x + 19, y + 12, 10, 8, p.tree2);
    rect(canvas, x + 14, y + 21, 5, 9, '#4a3224');
  });
  drawTile(canvas, 34, (x, y) => {
    rect(canvas, x + 14, y + 19, 5, 10, '#493429');
    for (let i = 0; i < 3; i += 1) {
      const yy = y + 5 + i * 6;
      line(canvas, x + 16, yy - 4, x + 6 + i, yy + 8, p.tree);
      line(canvas, x + 16, yy - 4, x + 26 - i, yy + 8, p.tree2);
    }
  });
  drawTile(canvas, 35, (x, y) => {
    ellipse(canvas, x + 16, y + 20, 10, 7, p.tree2);
    ellipse(canvas, x + 12, y + 19, 6, 5, p.tree);
  });
  drawTile(canvas, 36, (x, y) => {
    ellipse(canvas, x + 16, y + 21, 11, 7, p.rock);
    ellipse(canvas, x + 12, y + 18, 6, 4, '#8e989f');
  });
  drawTile(canvas, 37, (x, y) => {
    rect(canvas, x + 5, y + 15, 21, 7, '#6b4a2d');
    line(canvas, x + 7, y + 16, x + 24, y + 20, '#3f2b1b');
  });
  drawTile(canvas, 38, (x, y) => {
    rect(canvas, x + 8, y + 13, 16, 10, '#5d3b27');
    rect(canvas, x + 10, y + 11, 12, 3, '#8b5e34');
    rect(canvas, x + 10, y + 22, 12, 3, '#2f2218');
  });
  drawTile(canvas, 39, (x, y) => {
    rect(canvas, x + 6, y + 10, 20, 16, '#7a5335');
    rect(canvas, x + 9, y + 8, 14, 4, '#b07a42');
    rect(canvas, x + 12, y + 15, 8, 11, '#423027');
  });

  drawTile(canvas, 48, (x, y) => {
    rect(canvas, x, y + 13, 32, 8, '#6a442d');
    rect(canvas, x + 3, y + 10, 4, 15, '#4b3020');
    rect(canvas, x + 25, y + 10, 4, 15, '#4b3020');
  });
  drawTile(canvas, 49, (x, y) => {
    rect(canvas, x + 12, y, 8, 32, '#6a442d');
    rect(canvas, x + 9, y + 3, 14, 4, '#4b3020');
    rect(canvas, x + 9, y + 25, 14, 4, '#4b3020');
  });
  drawTile(canvas, 50, (x, y) => {
    rect(canvas, x + 6, y + 13, 20, 8, '#6a442d');
    rect(canvas, x + 12, y + 7, 8, 19, '#4b3020');
  });
  drawTile(canvas, 51, (x, y) => {
    rect(canvas, x + 10, y + 8, 13, 18, '#503929');
    rect(canvas, x + 13, y + 5, 7, 4, '#d9b35f');
    rect(canvas, x + 12, y + 13, 9, 8, '#ece0bc');
  });
  drawTile(canvas, 52, (x, y) => {
    rect(canvas, x + 7, y + 8, 18, 18, '#775233');
    rect(canvas, x + 10, y + 5, 12, 5, '#967044');
    rect(canvas, x + 12, y + 13, 8, 13, '#2c2119');
  });

  drawTile(canvas, 64, (x, y) => {
    rect(canvas, x + 3, y + 14, 26, 14, p.wall);
    rect(canvas, x + 1, y + 6, 30, 11, p.roof);
    rect(canvas, x + 13, y + 18, 7, 10, '#32231b');
    rect(canvas, x + 5, y + 17, 5, 5, '#a9d6e5');
    rect(canvas, x + 22, y + 17, 5, 5, '#a9d6e5');
  });
  drawTile(canvas, 65, (x, y) => {
    rect(canvas, x + 3, y + 15, 26, 13, p.wall);
    rect(canvas, x, y + 6, 32, 12, p.roof);
    rect(canvas, x + 12, y + 18, 8, 10, '#35251a');
    rect(canvas, x + 22, y + 3, 4, 6, '#2c2119');
  });
  drawTile(canvas, 66, (x, y) => {
    rect(canvas, x + 2, y + 12, 28, 16, p.wall);
    rect(canvas, x, y + 4, 32, 12, p.roof);
    rect(canvas, x + 10, y + 18, 12, 10, '#37261a');
    rect(canvas, x + 5, y + 17, 4, 5, '#a9d6e5');
    rect(canvas, x + 24, y + 17, 4, 5, '#a9d6e5');
  });

  drawTile(canvas, 80, (x, y) => {
    rect(canvas, x + 9, y + 20, 14, 5, '#4b3020');
    rect(canvas, x + 12, y + 8, 8, 13, '#f97316');
    rect(canvas, x + 14, y + 5, 4, 12, '#facc15');
  });
  drawTile(canvas, 81, (x, y) => {
    rect(canvas, x + 12, y + 10, 8, 18, '#3b2a20');
    rect(canvas, x + 14, y + 6, 4, 6, '#facc15');
    rect(canvas, x + 15, y + 4, 2, 8, '#ef4444');
  });
  drawTile(canvas, 82, (x, y) => {
    rect(canvas, x + 9, y + 16, 14, 9, '#594230');
    rect(canvas, x + 10, y + 10, 12, 7, '#8b6f47');
    rect(canvas, x + 13, y + 5, 6, 7, '#d6e2e8');
  });
  drawTile(canvas, 83, (x, y) => {
    rect(canvas, x + 6, y + 13, 20, 12, '#956d3d');
    for (let i = 0; i < 3; i += 1) rect(canvas, x + 8 + i * 6, y + 9, 4, 16, '#caa15c');
  });
  drawTile(canvas, 84, (x, y) => {
    ellipse(canvas, x + 16, y + 19, 11, 7, '#b99a54');
    rect(canvas, x + 7, y + 14, 18, 7, '#cbaa5c');
  });
  drawTile(canvas, 85, (x, y) => {
    ellipse(canvas, x + 16, y + 16, 12, 11, '#2f241c');
    rect(canvas, x + 8, y + 17, 16, 9, '#181412');
    ellipse(canvas, x + 16, y + 16, 8, 7, '#404850');
  });
  drawTile(canvas, 86, (x, y) => {
    rect(canvas, x + 7, y + 8, 18, 17, '#513628');
    rect(canvas, x + 10, y + 5, 12, 6, '#6e5142');
    rect(canvas, x + 12, y + 16, 8, 9, '#181412');
  });
  drawTile(canvas, 87, (x, y) => {
    rect(canvas, x + 6, y + 16, 20, 7, '#83614a');
    rect(canvas, x + 8, y + 11, 16, 7, '#ab8568');
  });

  return encodePng(canvas.width, canvas.height, canvas.pixels);
}

function drawEnemySheet(enemyId, main, accent, boss = false) {
  const size = boss ? 96 : 64;
  const canvas = makeCanvas(size * 4, size);
  const dark = '#1f1720';
  for (let frame = 0; frame < 4; frame += 1) {
    const ox = frame * size;
    const bob = frame === 1 ? -3 : frame === 3 ? 3 : 0;
    const cx = ox + size / 2;
    const cy = size / 2 + bob;
    ellipse(canvas, cx, cy + size * 0.24, size * 0.28, size * 0.12, [0, 0, 0, 70]);

    if (enemyId.includes('wolf') || enemyId.includes('hound')) {
      rect(canvas, ox + 18, cy + 20, 28, 13, main);
      rect(canvas, ox + 39, cy + 12, 15, 16, main);
      rect(canvas, ox + 47, cy + 15, 5, 4, accent);
      rect(canvas, ox + 21 + frame, cy + 31, 4, 11, dark);
      rect(canvas, ox + 38 - frame, cy + 31, 4, 11, dark);
      line(canvas, ox + 18, cy + 22, ox + 8, cy + 15, main);
    } else if (enemyId.includes('spider') || enemyId.includes('scorpion')) {
      ellipse(canvas, cx, cy + 16, 17, 11, main);
      rect(canvas, cx + 9, cy + 8, 9, 8, accent);
      for (let leg = 0; leg < 4; leg += 1) {
        line(canvas, cx - 8 + leg * 5, cy + 17, cx - 25 + leg * 9, cy + 25 + ((frame + leg) % 2) * 3, dark);
        line(canvas, cx - 8 + leg * 5, cy + 17, cx - 25 + leg * 9, cy + 9 - ((frame + leg) % 2) * 3, dark);
      }
    } else if (enemyId.includes('treant') || enemyId.includes('briar') || enemyId.includes('matriarch')) {
      const scale = boss ? 1.3 : 1;
      rect(canvas, cx - 10 * scale, cy - 2, 20 * scale, 34 * scale, main);
      rect(canvas, cx - 18 * scale, cy - 12, 36 * scale, 15 * scale, accent);
      line(canvas, cx - 10, cy + 5, cx - 27, cy + 20 + frame, main);
      line(canvas, cx + 10, cy + 5, cx + 27, cy + 20 - frame, main);
      rect(canvas, cx - 4, cy + 8, 4, 4, '#facc15');
    } else if (enemyId.includes('stag') || enemyId.includes('plainstrider')) {
      rect(canvas, cx - 14, cy + 13, 30, 14, main);
      rect(canvas, cx + 12, cy + 2, 12, 16, main);
      line(canvas, cx + 17, cy + 3, cx + 9, cy - 11, accent);
      line(canvas, cx + 19, cy + 3, cx + 29, cy - 11, accent);
      rect(canvas, cx - 9 + frame, cy + 26, 4, 12, dark);
      rect(canvas, cx + 9 - frame, cy + 26, 4, 12, dark);
    } else {
      const scale = boss ? 1.45 : 1;
      ellipse(canvas, cx, cy + 10, 15 * scale, 18 * scale, main);
      rect(canvas, cx - 10 * scale, cy + 16, 20 * scale, 20 * scale, main);
      rect(canvas, cx - 6, cy + 3, 4, 5, accent);
      rect(canvas, cx + 5, cy + 3, 4, 5, accent);
      line(canvas, cx - 10, cy + 23, cx - 22 - frame, cy + 30, dark);
      line(canvas, cx + 10, cy + 23, cx + 22 + frame, cy + 30, dark);
    }
  }
  return encodePng(canvas.width, canvas.height, canvas.pixels);
}

function tileLayer(name, data) {
  return {
    id: 0,
    name,
    type: 'tilelayer',
    visible: true,
    opacity: 1,
    x: 0,
    y: 0,
    width: MAP_SIZE,
    height: MAP_SIZE,
    data,
  };
}

function objectLayer(name, objects) {
  return {
    id: 0,
    name,
    type: 'objectgroup',
    visible: true,
    opacity: 1,
    x: 0,
    y: 0,
    objects,
  };
}

function prop(name, value) {
  let type = 'string';
  if (Number.isInteger(value)) type = 'int';
  else if (typeof value === 'number') type = 'float';
  else if (typeof value === 'boolean') type = 'bool';
  return { name, type, value };
}

function objectRect(id, name, x, y, w, h, properties = []) {
  return {
    id,
    name,
    type: '',
    visible: true,
    x: x * TILE,
    y: y * TILE,
    width: w * TILE,
    height: h * TILE,
    properties,
  };
}

function objectPoint(id, name, x, y, properties = []) {
  return {
    id,
    name,
    type: '',
    visible: true,
    point: true,
    x: x * TILE + TILE / 2,
    y: y * TILE + TILE / 2,
    properties,
  };
}

function idx(x, y) {
  return y * MAP_SIZE + x;
}

function setTile(data, x, y, gid) {
  if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return;
  data[idx(x, y)] = gid;
}

function paintRect(data, x, y, w, h, gid) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) setTile(data, xx, yy, gid);
  }
}

function paintCircle(data, cx, cy, rx, ry, gid) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) setTile(data, x, y, gid);
    }
  }
}

function paintPath(data, points, width, gid) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 2;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / Math.max(steps, 1);
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t + Math.sin(t * Math.PI * 2 + index) * 1.5);
      paintCircle(data, x, y, width, Math.max(1, width - 1), gid);
    }
  }
}

function placeHouse(ground, decor, collision, x, y, variant = 0) {
  const tile = 65 + (variant % 2);
  for (let yy = 0; yy < 4; yy += 1) {
    for (let xx = 0; xx < 5; xx += 1) {
      setTile(decor, x + xx, y + yy, tile + 1);
      setTile(collision, x + xx, y + yy, COLLISION_GID);
    }
  }
  setTile(decor, x + 2, y + 3, 65);
  setTile(collision, x + 2, y + 4, 0);
  paintRect(ground, x - 1, y + 4, 7, 2, 4);
}

function decorateMap(zone) {
  const ground = Array(MAP_SIZE * MAP_SIZE).fill(1);
  const water = Array(MAP_SIZE * MAP_SIZE).fill(0);
  const decor = Array(MAP_SIZE * MAP_SIZE).fill(0);
  const collision = Array(MAP_SIZE * MAP_SIZE).fill(0);

  for (let y = 0; y < MAP_SIZE; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const noise = (x * 37 + y * 19 + x * y * 3) % 29;
      if (noise === 0) setTile(ground, x, y, 2);
      if (noise === 5) setTile(ground, x, y, 3);
      if (noise === 11) setTile(decor, x, y, 10);
      if (noise === 17) setTile(decor, x, y, 37);
    }
  }

  paintRect(ground, zone.village.x - 5, zone.village.y - 5, zone.village.w + 10, zone.village.h + 10, 2);
  paintCircle(ground, zone.start.x, zone.start.y, 14, 10, 4);
  paintPath(ground, [
    zone.start,
    { x: zone.village.x + zone.village.w / 2, y: zone.village.y + 8 },
    { x: zone.regions.exit.x, y: zone.regions.exit.y + 8 },
  ], 3, 4);
  Object.values(zone.regions).forEach((region, index) => {
    paintPath(ground, [zone.start, { x: region.x + region.w / 2, y: region.y + region.h / 2 }], index % 2 ? 2 : 3, 4);
    paintCircle(ground, region.x + region.w / 2, region.y + region.h / 2, region.w / 2.2, region.h / 2.4, index % 2 ? 2 : 3);
  });

  const riverX = zone.id === 'elf' ? 118 : zone.id === 'orc' ? 150 : zone.id === 'undead' ? 28 : 86;
  for (let y = 0; y < MAP_SIZE; y += 1) {
    const wave = Math.round(Math.sin(y / 8) * 5);
    const width = zone.id === 'dwarf' ? 8 : 10;
    for (let x = riverX + wave; x < riverX + wave + width; x += 1) {
      setTile(water, x, y, 6);
      setTile(collision, x, y, COLLISION_GID);
    }
  }
  const bridgeY = Math.round(zone.start.y + (zone.regions.exit.y - zone.start.y) / 2);
  paintRect(water, riverX - 1, bridgeY - 1, 14, 4, 88);
  paintRect(collision, riverX - 1, bridgeY - 1, 14, 4, 0);

  for (let i = 0; i < 7; i += 1) {
    placeHouse(ground, decor, collision, zone.village.x + 4 + (i % 3) * 9, zone.village.y + 4 + Math.floor(i / 3) * 9, i);
  }
  setTile(decor, zone.start.x - 3, zone.start.y - 4, 82);
  setTile(decor, zone.start.x + 5, zone.start.y + 2, 51);
  setTile(decor, zone.start.x - 6, zone.start.y + 3, 83);

  Object.values(zone.regions).forEach((region, regionIndex) => {
    for (let i = 0; i < 34; i += 1) {
      const x = region.x + ((i * 7 + regionIndex * 11) % Math.max(region.w, 1));
      const y = region.y + ((i * 13 + regionIndex * 5) % Math.max(region.h, 1));
      const tile = regionIndex % 2 === 0 ? 33 : 34;
      setTile(decor, x, y, tile + 1);
      if ((i + regionIndex) % 3 !== 0) setTile(collision, x, y, COLLISION_GID);
    }
  });

  for (let i = 0; i < 620; i += 1) {
    const edge = i < 260;
    const x = edge
      ? (i % 4 === 0 ? 2 + (i * 17) % 22 : MAP_SIZE - 24 + (i * 11) % 20)
      : (i * 23 + 9) % MAP_SIZE;
    const y = edge
      ? (i * 31 + 7) % MAP_SIZE
      : (i * 41 + 13) % MAP_SIZE;
    if (ground[idx(x, y)] === 4 || water[idx(x, y)]) continue;
    const tile = i % 5 === 0 ? 33 : i % 7 === 0 ? 35 : 34;
    setTile(decor, x, y, tile + 1);
    if (i % 4 !== 0) setTile(collision, x, y, COLLISION_GID);
  }

  for (let i = 0; i < 180; i += 1) {
    const x = (i * 47 + 17) % MAP_SIZE;
    const y = (i * 29 + 31) % MAP_SIZE;
    if (collision[idx(x, y)] || water[idx(x, y)]) continue;
    setTile(decor, x, y, 9 + (i % 4));
  }

  return { ground, water, decor, collision };
}

function mapObjects(zone) {
  let id = 1;
  const zones = [
    objectRect(id++, zone.raceStart, zone.village.x, zone.village.y, zone.village.w, zone.village.h, [
      prop('type', 'raceStartZone'),
      prop('zoneId', zone.raceStart),
      prop('race', zone.id),
      prop('recommendedLevel', 1),
    ]),
    ...Object.entries(zone.regions).map(([key, region]) => objectRect(id++, `${zone.id}_${key}`, region.x, region.y, region.w, region.h, [
      prop('type', 'zone'),
      prop('zoneId', `${zone.id}_${key}`),
      prop('recommendedLevel', key === 'boss' ? 8 : 2),
    ])),
  ];
  const npcs = [
    objectPoint(id++, `${zone.id}_elder`, zone.start.x - 4, zone.start.y - 3, [prop('type', 'npc'), prop('role', 'elder')]),
    objectPoint(id++, `${zone.id}_shopkeeper`, zone.start.x + 6, zone.start.y + 2, [prop('type', 'shopkeeper')]),
    objectPoint(id++, `${zone.id}_trainer`, zone.start.x - 8, zone.start.y + 5, [prop('type', 'trainer')]),
  ];
  const spawns = zone.enemies.map(([name, enemyType, , regionKey, recommendedLevel, maxEnemies]) => {
    const region = zone.regions[regionKey];
    return objectRect(id++, name, region.x, region.y, region.w, region.h, [
      prop('type', 'enemySpawn'),
      prop('zoneId', name),
      prop('spawnId', name),
      prop('enemyType', enemyType),
      prop('recommendedLevel', recommendedLevel),
      prop('maxEnemies', maxEnemies),
      prop('maxAlive', maxEnemies),
      prop('respawnMin', 15000),
      prop('respawnMax', 30000),
      prop('movementMode', 'patrol'),
    ]);
  });
  const bossRegion = zone.regions[zone.boss[3]];
  const bossSpawns = [
    objectRect(id++, zone.boss[0], bossRegion.x, bossRegion.y, bossRegion.w, bossRegion.h, [
      prop('type', 'bossSpawn'),
      prop('zoneId', zone.boss[0]),
      prop('bossType', zone.boss[1]),
      prop('enemyType', zone.boss[1]),
      prop('recommendedLevel', zone.boss[4]),
      prop('respawnMin', 60000),
      prop('respawnMax', 60000),
    ]),
  ];
  const transitions = [
    objectRect(id++, `${zone.id}_to_world_road`, zone.regions.exit.x, zone.regions.exit.y, zone.regions.exit.w, zone.regions.exit.h, [
      prop('type', 'transition'),
      prop('targetMap', 'world'),
      prop('targetSpawn', `${zone.id}_road_arrival`),
    ]),
  ];
  const raceStart = [
    objectPoint(id++, `${zone.id}_start`, zone.start.x, zone.start.y, [
      prop('race', zone.id),
      prop('type', 'raceStart'),
      prop('facing', 0),
    ]),
  ];
  const graveyard = [
    objectPoint(id++, `${zone.id}_graveyard`, zone.village.x + zone.village.w - 4, zone.village.y + zone.village.h + 6, [
      prop('type', 'graveyard'),
      prop('zoneId', `${zone.id}_graveyard`),
    ]),
  ];
  return { zones, npcs, spawns, bossSpawns, transitions, raceStart, graveyard };
}

function makeMap(zone, layers) {
  let layerId = 1;
  const withId = (layer) => ({ ...layer, id: layerId++ });
  const objects = mapObjects(zone);
  return {
    type: 'map',
    version: '1.10',
    tiledversion: '1.11.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width: MAP_SIZE,
    height: MAP_SIZE,
    tilewidth: TILE,
    tileheight: TILE,
    infinite: false,
    nextlayerid: 20,
    nextobjectid: 200,
    tilesets: [
      { firstgid: 1, source: `../tilesets/${zone.tilesetName}.tsx` },
      { firstgid: COLLISION_GID, source: '../tilesets/collision_debug.tsx' },
    ],
    layers: [
      withId(tileLayer('Ground', layers.ground)),
      withId(tileLayer('water', layers.water)),
      withId(tileLayer('Decor', layers.decor)),
      withId(tileLayer('Collision', layers.collision)),
      withId(objectLayer('NPCs', objects.npcs)),
      withId(objectLayer('Spawns', objects.spawns)),
      withId(objectLayer('BossSpawns', objects.bossSpawns)),
      withId(objectLayer('Transitions', objects.transitions)),
      withId(objectLayer('Zones', objects.zones)),
      withId(objectLayer('graveyard', objects.graveyard)),
      withId(objectLayer('raceStart', objects.raceStart)),
    ],
  };
}

function makeTsx(name) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${name}" tilewidth="32" tileheight="32" tilecount="256" columns="16">
 <image source="../assets/tilesets/${name}.png" width="512" height="512"/>
 <tile id="5">
  <animation>
   <frame tileid="5" duration="160"/>
   <frame tileid="6" duration="160"/>
   <frame tileid="5" duration="160"/>
   <frame tileid="6" duration="160"/>
  </animation>
 </tile>
 <tile id="80">
  <animation>
   <frame tileid="80" duration="140"/>
   <frame tileid="81" duration="140"/>
   <frame tileid="80" duration="140"/>
   <frame tileid="81" duration="140"/>
  </animation>
 </tile>
</tileset>
`;
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  await Promise.all([
    fs.mkdir(mapDir, { recursive: true }),
    fs.mkdir(tilesetDir, { recursive: true }),
    fs.mkdir(assetTilesetDir, { recursive: true }),
    fs.mkdir(enemyDir, { recursive: true }),
    fs.mkdir(docsDir, { recursive: true }),
  ]);

  for (const zone of ZONES) {
    await fs.writeFile(path.join(assetTilesetDir, `${zone.tilesetName}.png`), drawTileset(zone));
    await fs.writeFile(path.join(tilesetDir, `${zone.tilesetName}.tsx`), makeTsx(zone.tilesetName));
    const layers = decorateMap(zone);
    await writeJson(path.join(mapDir, zone.mapFile), makeMap(zone, layers));
  }

  for (const [id, mainColor, accentColor, boss] of [...HUMAN_ENEMIES, ...EXTRA_ENEMIES]) {
    await fs.writeFile(path.join(enemyDir, `${id}.png`), drawEnemySheet(id, mainColor, accentColor, Boolean(boss)));
  }

  const notes = [
    '# Race Starting Zones',
    '',
    'Generated 200x200 Tiled maps for dwarf, undead, elf, and orc starting areas.',
    '',
    '## Files',
    ...ZONES.map((zone) => `- \`public/maps/${zone.mapFile}\` with \`public/tilesets/${zone.tilesetName}.tsx\` and \`public/assets/tilesets/${zone.tilesetName}.png\``),
    '',
    '## Race Starts',
    ...ZONES.map((zone) => `- ${zone.id}: object layer \`raceStart\`, point \`${zone.id}_start\`, zone \`${zone.raceStart}\``),
    '',
    '## Enemy Types',
    ...ZONES.flatMap((zone) => zone.enemies.map((enemy) => `- ${zone.id}: \`${enemy[1]}\` in \`${enemy[0]}\``)),
    ...ZONES.map((zone) => `- ${zone.id} boss: \`${zone.boss[1]}\` in \`${zone.boss[0]}\``),
    '',
    'Human-zone enemy sprites were also generated for wolf, kobold, bandit, restless-dead, and elder-briarheart.',
    '',
    '## Extension',
    'Add new spawn rectangles to the Spawns layer with `enemyType`, `spawnId`, `maxAlive`, `respawnMin`, and `respawnMax` custom properties. Add boss rectangles to BossSpawns with `bossType`.',
    '',
  ].join('\n');
  await fs.writeFile(path.join(docsDir, 'race_starting_zones_notes.md'), notes);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
