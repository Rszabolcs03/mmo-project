import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SPRITES_DIR = join(ROOT, 'public', 'assets', 'sprites');
const ENEMIES_DIR = join(ROOT, 'public', 'assets', 'enemies');
const PETS_DIR = join(ROOT, 'public', 'assets', 'pets');

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
mkdirSync(PETS_DIR, { recursive: true });

const slot = drawAbilitySlot();
savePng(join(SPRITES_DIR, 'ability-slot-holder.png'), slot.buffer, slot.width, slot.height);

const wolf = drawSheet(64, 64, 4, drawWolfFrame);
savePng(join(ENEMIES_DIR, 'wolf.png'), wolf.buffer, wolf.width, wolf.height);

const boss = drawSheet(96, 96, 4, drawBriarheartFrame);
savePng(join(ENEMIES_DIR, 'elder-briarheart.png'), boss.buffer, boss.width, boss.height);

const ENEMY_PALETTES = {
  wolf: ['#3e4755', '#242b36', '#bde9ff'],
  kobold: ['#8a5a2f', '#3b2415', '#facc15'],
  bandit: ['#64748b', '#1f2937', '#f8fafc'],
  undead: ['#7c8794', '#26313d', '#a7f3d0'],
  'restless-dead': ['#94a3b8', '#334155', '#c4b5fd'],
  'snow-wolf': ['#cbd5e1', '#64748b', '#e0f2fe'],
  'frost-trogg': ['#60a5fa', '#1e3a8a', '#e0f2fe'],
  'cave-spider': ['#312e81', '#111827', '#a78bfa'],
  'grave-rat': ['#6b7280', '#27272a', '#fca5a5'],
  plaguehound: ['#556b4f', '#263b2a', '#bef264'],
  'forest-sprite': ['#22c55e', '#14532d', '#fef08a'],
  'corrupted-treant': ['#6b4427', '#2f1d13', '#a78bfa'],
  nightstalker: ['#1f2937', '#020617', '#c084fc'],
  plainstrider: ['#d6a354', '#7c4a12', '#fef3c7'],
  scorpion: ['#b45309', '#3f2a13', '#facc15'],
  quilboar: ['#7f5539', '#3f2418', '#fef3c7'],
  'road-bandit': ['#475569', '#111827', '#fb7185'],
  'dire-wolf': ['#374151', '#111827', '#ef4444'],
  'stone-gnoll': ['#78716c', '#292524', '#fbbf24'],
  'ember-wraith': ['#ef4444', '#450a0a', '#fde047'],
  'granite-matriarch': ['#78716c', '#292524', '#c4b5fd'],
  'crypt-warden': ['#475569', '#111827', '#a7f3d0'],
  'moonshade-stag': ['#475569', '#1e1b4b', '#c4b5fd'],
  'bloodtusk-chief': ['#7f1d1d', '#2b0b0b', '#fef3c7'],
  'varro-the-tollkeeper': ['#334155', '#0f172a', '#f59e0b'],
  'thornmaw-alpha': ['#365314', '#14220a', '#f97316'],
  'granite-ogre': ['#57534e', '#1c1917', '#fde68a'],
  'ash-witch': ['#581c87', '#1e102e', '#fb7185'],
  'redscar-captain': ['#7f1d1d', '#2b0b0b', '#facc15'],
  'reedwater-marauder': ['#2f6f7a', '#12343c', '#67e8f9'],
  'bramblehide-bear': ['#7c4a2d', '#3f2418', '#fbbf24'],
  'moonbrook-prowler': ['#3f4658', '#111827', '#93c5fd'],
  'redscar-highwayman': ['#7f1d1d', '#2b0b0b', '#facc15'],
  'saltspine-crawler': ['#2dd4bf', '#0f766e', '#f8fafc'],
  'old-quarry-giant': ['#6b7280', '#262626', '#fcd34d'],
  'tideglass-matriarch': ['#0891b2', '#164e63', '#cffafe'],
};

const NORMAL_ENEMIES = [
  'wolf', 'kobold', 'bandit', 'undead', 'restless-dead', 'snow-wolf', 'frost-trogg', 'cave-spider', 'grave-rat',
  'plaguehound', 'forest-sprite', 'corrupted-treant', 'nightstalker', 'plainstrider', 'scorpion',
  'quilboar', 'road-bandit', 'dire-wolf', 'stone-gnoll', 'ember-wraith',
  'reedwater-marauder', 'bramblehide-bear', 'moonbrook-prowler', 'redscar-highwayman', 'saltspine-crawler',
];

const BOSS_ENEMIES = [
  'elder-briarheart', 'granite-matriarch', 'crypt-warden', 'moonshade-stag', 'bloodtusk-chief',
  'varro-the-tollkeeper', 'thornmaw-alpha', 'granite-ogre', 'ash-witch',
  'redscar-captain', 'old-quarry-giant', 'tideglass-matriarch',
];

function drawBeastFrame(buffer, canvasWidth, canvasHeight, frame, ox, oy, palette, kind) {
  const [body, shade, accent] = palette;
  const step = frame === 1 ? -3 : frame === 3 ? 3 : 0;
  const bounce = frame % 2 ? -1 : 0;
  const outline = '#0f172a';
  if (kind.includes('bear')) {
    ellipse(buffer, canvasWidth, canvasHeight, ox + 32, oy + 51, 29, 7, '#000000', 78);
    rect(buffer, canvasWidth, canvasHeight, ox + 11, oy + 24 + bounce, 37, 20, outline);
    rect(buffer, canvasWidth, canvasHeight, ox + 15, oy + 27 + bounce, 30, 14, body);
    rect(buffer, canvasWidth, canvasHeight, ox + 20, oy + 35 + bounce, 22, 6, shade);
    rect(buffer, canvasWidth, canvasHeight, ox + 41, oy + 17 + bounce, 20, 23, outline);
    rect(buffer, canvasWidth, canvasHeight, ox + 45, oy + 21 + bounce, 13, 16, body);
    rect(buffer, canvasWidth, canvasHeight, ox + 42, oy + 13 + bounce, 7, 7, outline);
    rect(buffer, canvasWidth, canvasHeight, ox + 54, oy + 13 + bounce, 7, 7, outline);
    rect(buffer, canvasWidth, canvasHeight, ox + 48, oy + 27 + bounce, 3, 3, accent);
    rect(buffer, canvasWidth, canvasHeight, ox + 55, oy + 27 + bounce, 3, 3, accent);
    rect(buffer, canvasWidth, canvasHeight, ox + 17, oy + 40 + bounce, 7, 12 + step, outline);
    rect(buffer, canvasWidth, canvasHeight, ox + 35, oy + 40 + bounce, 7, 12 - step, outline);
    rect(buffer, canvasWidth, canvasHeight, ox + 19, oy + 41 + bounce, 4, 8 + step, body);
    rect(buffer, canvasWidth, canvasHeight, ox + 37, oy + 41 + bounce, 4, 8 - step, body);
    rect(buffer, canvasWidth, canvasHeight, ox + 51, oy + 36 + bounce, 8, 3, outline);
    return;
  }
  ellipse(buffer, canvasWidth, canvasHeight, ox + 32, oy + 49, 25, 6, '#000000', 75);
  rect(buffer, canvasWidth, canvasHeight, ox + 15, oy + 25 + bounce, 32, 17, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 18, oy + 27 + bounce, 27, 12, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 22, oy + 34 + bounce, 20, 5, shade);
  rect(buffer, canvasWidth, canvasHeight, ox + 43, oy + 19 + bounce, 18, 19, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 46, oy + 22 + bounce, 12, 13, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 47, oy + 13 + bounce, 5, 9, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 55, oy + 12 + bounce, 5, 10, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 50, oy + 26 + bounce, 3, 3, accent);
  rect(buffer, canvasWidth, canvasHeight, ox + 57, oy + 26 + bounce, 3, 3, accent);
  line(buffer, canvasWidth, canvasHeight, ox + 17, oy + 30 + bounce, ox + 5, oy + 23 + bounce, 5, outline);
  line(buffer, canvasWidth, canvasHeight, ox + 17, oy + 30 + bounce, ox + 5, oy + 23 + bounce, 3, body);
  if (kind.includes('quilboar') || kind.includes('bloodtusk')) {
    line(buffer, canvasWidth, canvasHeight, ox + 56, oy + 35 + bounce, ox + 66, oy + 40 + bounce, 3, '#fef3c7');
    line(buffer, canvasWidth, canvasHeight, ox + 49, oy + 35 + bounce, ox + 39, oy + 40 + bounce, 3, '#fef3c7');
  }
  rect(buffer, canvasWidth, canvasHeight, ox + 19, oy + 38 + bounce, 5, 13 + step, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 34, oy + 38 + bounce, 5, 13 - step, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 20, oy + 39 + bounce, 3, 9 + step, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 35, oy + 39 + bounce, 3, 9 - step, body);
}

function drawHumanoidFrame(buffer, canvasWidth, canvasHeight, frame, ox, oy, palette, kind, boss = false) {
  const [body, shade, accent] = palette;
  const outline = '#0f172a';
  const size = boss ? 1.38 : 1;
  const cx = ox + (boss ? 48 : 32);
  const cy = oy + (boss ? 50 : 35);
  const step = frame === 1 ? -4 : frame === 3 ? 4 : 0;
  ellipse(buffer, canvasWidth, canvasHeight, cx, oy + (boss ? 82 : 53), boss ? 32 : 22, boss ? 8 : 6, '#000000', 75);
  rect(buffer, canvasWidth, canvasHeight, cx - 11 * size, cy - 17 * size, 22 * size, 25 * size, outline);
  rect(buffer, canvasWidth, canvasHeight, cx - 8 * size, cy - 14 * size, 16 * size, 20 * size, body);
  rect(buffer, canvasWidth, canvasHeight, cx - 10 * size, cy - 31 * size, 20 * size, 18 * size, outline);
  rect(buffer, canvasWidth, canvasHeight, cx - 7 * size, cy - 28 * size, 14 * size, 12 * size, shade);
  rect(buffer, canvasWidth, canvasHeight, cx - 5 * size, cy - 24 * size, 4 * size, 4 * size, accent);
  rect(buffer, canvasWidth, canvasHeight, cx + 2 * size, cy - 24 * size, 4 * size, 4 * size, accent);
  line(buffer, canvasWidth, canvasHeight, cx - 11 * size, cy - 8 * size, cx - 24 * size, cy + 4 * size + step, 5 * size, outline);
  line(buffer, canvasWidth, canvasHeight, cx + 11 * size, cy - 8 * size, cx + 24 * size, cy + 4 * size - step, 5 * size, outline);
  line(buffer, canvasWidth, canvasHeight, cx - 10 * size, cy - 8 * size, cx - 22 * size, cy + 3 * size + step, 3 * size, body);
  line(buffer, canvasWidth, canvasHeight, cx + 10 * size, cy - 8 * size, cx + 22 * size, cy + 3 * size - step, 3 * size, body);
  rect(buffer, canvasWidth, canvasHeight, cx - 9 * size, cy + 7 * size, 7 * size, 16 * size - step, outline);
  rect(buffer, canvasWidth, canvasHeight, cx + 2 * size, cy + 7 * size, 7 * size, 16 * size + step, outline);
  if (kind.includes('witch') || kind.includes('wraith')) {
    rect(buffer, canvasWidth, canvasHeight, cx - 14 * size, cy - 37 * size, 28 * size, 6 * size, accent);
    line(buffer, canvasWidth, canvasHeight, cx, cy - 45 * size, cx + 9 * size, cy - 32 * size, 5 * size, shade);
  }
  if (kind.includes('marauder') || kind.includes('highwayman')) {
    line(buffer, canvasWidth, canvasHeight, cx + 17 * size, cy - 12 * size, cx + 29 * size, cy + 12 * size - step, 3 * size, accent);
    rect(buffer, canvasWidth, canvasHeight, cx - 11 * size, cy + 1 * size, 22 * size, 4 * size, accent);
  }
  if (kind.includes('matriarch')) {
    rect(buffer, canvasWidth, canvasHeight, cx - 12 * size, cy - 36 * size, 24 * size, 5 * size, accent);
    line(buffer, canvasWidth, canvasHeight, cx + 22 * size, cy - 30 * size, cx + 22 * size, cy + 14 * size, 5 * size, outline);
    line(buffer, canvasWidth, canvasHeight, cx + 22 * size, cy - 30 * size, cx + 22 * size, cy + 14 * size, 3 * size, accent);
  }
  if (kind.includes('ogre') || kind.includes('gnoll') || kind.includes('warden') || kind.includes('giant')) {
    rect(buffer, canvasWidth, canvasHeight, cx + 18 * size, cy - 28 * size, 7 * size, 38 * size, accent);
    rect(buffer, canvasWidth, canvasHeight, cx + 14 * size, cy - 31 * size, 15 * size, 7 * size, outline);
  }
}

function drawInsectFrame(buffer, canvasWidth, canvasHeight, frame, ox, oy, palette) {
  const [body, shade, accent] = palette;
  const walk = frame === 1 ? -3 : frame === 3 ? 3 : 0;
  const outline = '#1f1308';
  ellipse(buffer, canvasWidth, canvasHeight, ox + 32, oy + 51, 23, 5, '#000000', 70);
  ellipse(buffer, canvasWidth, canvasHeight, ox + 32, oy + 33, 22, 17, outline);
  ellipse(buffer, canvasWidth, canvasHeight, ox + 32, oy + 33, 17, 13, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 29, oy + 19, 6, 28, accent);
  for (let index = -1; index <= 1; index += 1) {
    line(buffer, canvasWidth, canvasHeight, ox + 18, oy + 29 + index * 8, ox + 4, oy + 35 + index * 8 + walk, 4, outline);
    line(buffer, canvasWidth, canvasHeight, ox + 46, oy + 29 + index * 8, ox + 60, oy + 35 + index * 8 - walk, 4, outline);
  }
  rect(buffer, canvasWidth, canvasHeight, ox + 24, oy + 16, 5, 5, '#fff7ed');
  rect(buffer, canvasWidth, canvasHeight, ox + 36, oy + 16, 5, 5, '#fff7ed');
}

function drawTamziaBanditFrame(buffer, canvasWidth, canvasHeight, frame, ox, oy, palette, kind) {
  const [body, shade, accent] = palette;
  const outline = '#0f172a';
  const bounce = frame % 2 ? -1 : 0;
  const step = frame === 1 ? -4 : frame === 3 ? 4 : 0;
  const cx = ox + 32;
  const isRedscar = kind.includes('redscar');
  const hood = isRedscar ? '#991b1b' : '#155e75';
  const cloth = isRedscar ? '#451a03' : '#164e63';

  ellipse(buffer, canvasWidth, canvasHeight, cx, oy + 53, 22, 6, '#000000', 76);
  rect(buffer, canvasWidth, canvasHeight, cx - 11, oy + 27 + bounce, 22, 22, outline);
  rect(buffer, canvasWidth, canvasHeight, cx - 8, oy + 30 + bounce, 16, 16, body);
  rect(buffer, canvasWidth, canvasHeight, cx - 10, oy + 36 + bounce, 20, 5, cloth);
  rect(buffer, canvasWidth, canvasHeight, cx - 11, oy + 14 + bounce, 22, 18, outline);
  rect(buffer, canvasWidth, canvasHeight, cx - 8, oy + 16 + bounce, 16, 13, hood);
  rect(buffer, canvasWidth, canvasHeight, cx - 5, oy + 22 + bounce, 10, 6, shade);
  rect(buffer, canvasWidth, canvasHeight, cx - 4, oy + 23 + bounce, 3, 3, accent);
  rect(buffer, canvasWidth, canvasHeight, cx + 2, oy + 23 + bounce, 3, 3, accent);
  rect(buffer, canvasWidth, canvasHeight, cx - 13, oy + 31 + bounce, 26, 4, accent, 220);
  line(buffer, canvasWidth, canvasHeight, cx - 11, oy + 33 + bounce, cx - 24, oy + 43 + step, 5, outline);
  line(buffer, canvasWidth, canvasHeight, cx - 10, oy + 33 + bounce, cx - 22, oy + 42 + step, 3, body);
  line(buffer, canvasWidth, canvasHeight, cx + 11, oy + 33 + bounce, cx + 23, oy + 43 - step, 5, outline);
  line(buffer, canvasWidth, canvasHeight, cx + 10, oy + 33 + bounce, cx + 21, oy + 42 - step, 3, body);
  rect(buffer, canvasWidth, canvasHeight, cx - 8, oy + 48 + bounce, 6, 11 - step / 2, outline);
  rect(buffer, canvasWidth, canvasHeight, cx + 2, oy + 48 + bounce, 6, 11 + step / 2, outline);
  if (isRedscar) {
    line(buffer, canvasWidth, canvasHeight, cx + 18, oy + 28 + bounce, cx + 32, oy + 16 + bounce, 3, '#d6b15f');
    line(buffer, canvasWidth, canvasHeight, cx + 18, oy + 28 + bounce, cx + 31, oy + 17 + bounce, 1, '#fef3c7');
    rect(buffer, canvasWidth, canvasHeight, cx - 16, oy + 18 + bounce, 8, 4, '#facc15');
  } else {
    line(buffer, canvasWidth, canvasHeight, cx + 17, oy + 13 + bounce, cx + 29, oy + 49 - step, 3, '#e0f2fe');
    line(buffer, canvasWidth, canvasHeight, cx + 17, oy + 13 + bounce, cx + 29, oy + 49 - step, 1, accent);
    rect(buffer, canvasWidth, canvasHeight, cx - 18, oy + 20 + bounce, 8, 13, '#0f766e');
  }
}

function drawMoonbrookProwlerFrame(buffer, canvasWidth, canvasHeight, frame, ox, oy, palette) {
  const [body, shade, accent] = palette;
  const step = frame === 1 ? -4 : frame === 3 ? 4 : 0;
  const bounce = frame % 2 ? -1 : 0;
  const outline = '#0f172a';
  ellipse(buffer, canvasWidth, canvasHeight, ox + 31, oy + 50, 27, 6, '#000000', 72);
  line(buffer, canvasWidth, canvasHeight, ox + 15, oy + 31 + bounce, ox + 2, oy + 20 + bounce, 5, outline);
  line(buffer, canvasWidth, canvasHeight, ox + 16, oy + 30 + bounce, ox + 4, oy + 21 + bounce, 3, shade);
  rect(buffer, canvasWidth, canvasHeight, ox + 13, oy + 25 + bounce, 34, 18, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 17, oy + 27 + bounce, 27, 12, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 21, oy + 33 + bounce, 22, 5, shade);
  rect(buffer, canvasWidth, canvasHeight, ox + 43, oy + 17 + bounce, 18, 21, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 47, oy + 21 + bounce, 12, 14, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 45, oy + 10 + bounce, 6, 11, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 55, oy + 10 + bounce, 6, 11, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 48, oy + 13 + bounce, 3, 7, shade);
  rect(buffer, canvasWidth, canvasHeight, ox + 56, oy + 13 + bounce, 3, 7, shade);
  rect(buffer, canvasWidth, canvasHeight, ox + 50, oy + 25 + bounce, 3, 3, accent);
  rect(buffer, canvasWidth, canvasHeight, ox + 57, oy + 25 + bounce, 3, 3, accent);
  rect(buffer, canvasWidth, canvasHeight, ox + 51, oy + 34 + bounce, 8, 3, '#020617');
  rect(buffer, canvasWidth, canvasHeight, ox + 18, oy + 38 + bounce, 5, 13 + step, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 35, oy + 38 + bounce, 5, 13 - step, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 19, oy + 39 + bounce, 3, 9 + step, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 36, oy + 39 + bounce, 3, 9 - step, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 20, oy + 22 + bounce, 19, 3, accent, 185);
}

function drawSaltspineCrawlerFrame(buffer, canvasWidth, canvasHeight, frame, ox, oy, palette) {
  const [body, shade, accent] = palette;
  const walk = frame === 1 ? -3 : frame === 3 ? 3 : 0;
  const pulse = frame % 2 ? -1 : 0;
  const outline = '#0f172a';
  ellipse(buffer, canvasWidth, canvasHeight, ox + 32, oy + 52, 25, 6, '#000000', 70);
  ellipse(buffer, canvasWidth, canvasHeight, ox + 32, oy + 34 + pulse, 25, 16, outline);
  ellipse(buffer, canvasWidth, canvasHeight, ox + 32, oy + 33 + pulse, 20, 12, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 22, oy + 27 + pulse, 20, 5, accent, 205);
  rect(buffer, canvasWidth, canvasHeight, ox + 27, oy + 36 + pulse, 10, 5, shade);
  for (let index = -1; index <= 1; index += 1) {
    line(buffer, canvasWidth, canvasHeight, ox + 17, oy + 31 + index * 6 + pulse, ox + 3, oy + 39 + index * 5 + walk, 4, outline);
    line(buffer, canvasWidth, canvasHeight, ox + 47, oy + 31 + index * 6 + pulse, ox + 61, oy + 39 + index * 5 - walk, 4, outline);
    line(buffer, canvasWidth, canvasHeight, ox + 17, oy + 31 + index * 6 + pulse, ox + 4, oy + 39 + index * 5 + walk, 2, shade);
    line(buffer, canvasWidth, canvasHeight, ox + 47, oy + 31 + index * 6 + pulse, ox + 60, oy + 39 + index * 5 - walk, 2, shade);
  }
  line(buffer, canvasWidth, canvasHeight, ox + 18, oy + 26 + pulse, ox + 9, oy + 15 + pulse - walk, 4, outline);
  line(buffer, canvasWidth, canvasHeight, ox + 46, oy + 26 + pulse, ox + 55, oy + 15 + pulse + walk, 4, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 6, oy + 12 + pulse - walk, 8, 7, accent);
  rect(buffer, canvasWidth, canvasHeight, ox + 51, oy + 12 + pulse + walk, 8, 7, accent);
  rect(buffer, canvasWidth, canvasHeight, ox + 25, oy + 17 + pulse, 4, 5, '#e0f2fe');
  rect(buffer, canvasWidth, canvasHeight, ox + 36, oy + 17 + pulse, 4, 5, '#e0f2fe');
}

function drawTamziaBossFrame(buffer, canvasWidth, canvasHeight, frame, ox, oy, palette, kind) {
  const [body, shade, accent] = palette;
  const outline = '#0f172a';
  const step = frame === 1 ? -5 : frame === 3 ? 5 : 0;
  const pulse = frame % 2 ? -2 : 0;
  const cx = ox + 48;

  if (kind.includes('redscar')) {
    ellipse(buffer, canvasWidth, canvasHeight, cx, oy + 82, 33, 8, '#000000', 82);
    rect(buffer, canvasWidth, canvasHeight, cx - 17, oy + 31 + pulse, 34, 40, outline);
    rect(buffer, canvasWidth, canvasHeight, cx - 12, oy + 35 + pulse, 24, 32, body);
    rect(buffer, canvasWidth, canvasHeight, cx - 18, oy + 45 + pulse, 36, 7, accent, 210);
    rect(buffer, canvasWidth, canvasHeight, cx - 15, oy + 14 + pulse, 30, 21, outline);
    rect(buffer, canvasWidth, canvasHeight, cx - 11, oy + 17 + pulse, 22, 15, '#991b1b');
    rect(buffer, canvasWidth, canvasHeight, cx - 8, oy + 24 + pulse, 5, 5, accent);
    rect(buffer, canvasWidth, canvasHeight, cx + 3, oy + 24 + pulse, 5, 5, accent);
    rect(buffer, canvasWidth, canvasHeight, cx - 20, oy + 16 + pulse, 11, 5, accent);
    rect(buffer, canvasWidth, canvasHeight, cx + 9, oy + 16 + pulse, 11, 5, accent);
    line(buffer, canvasWidth, canvasHeight, cx - 17, oy + 39 + pulse, cx - 36, oy + 57 + step, 7, outline);
    line(buffer, canvasWidth, canvasHeight, cx + 17, oy + 39 + pulse, cx + 34, oy + 56 - step, 7, outline);
    line(buffer, canvasWidth, canvasHeight, cx - 16, oy + 39 + pulse, cx - 34, oy + 56 + step, 4, body);
    line(buffer, canvasWidth, canvasHeight, cx + 16, oy + 39 + pulse, cx + 32, oy + 55 - step, 4, body);
    rect(buffer, canvasWidth, canvasHeight, cx - 13, oy + 69 + pulse, 10, 17 - step / 2, outline);
    rect(buffer, canvasWidth, canvasHeight, cx + 3, oy + 69 + pulse, 10, 17 + step / 2, outline);
    line(buffer, canvasWidth, canvasHeight, cx + 31, oy + 20 + pulse, cx + 39, oy + 74 - step, 5, outline);
    line(buffer, canvasWidth, canvasHeight, cx + 31, oy + 20 + pulse, cx + 39, oy + 74 - step, 2, '#fef3c7');
    rect(buffer, canvasWidth, canvasHeight, cx + 25, oy + 17 + pulse, 15, 5, accent);
    line(buffer, canvasWidth, canvasHeight, cx - 28, oy + 25 + pulse, cx - 41, oy + 64 + step, 4, outline);
    line(buffer, canvasWidth, canvasHeight, cx - 28, oy + 25 + pulse, cx - 41, oy + 64 + step, 2, '#d6b15f');
    rect(buffer, canvasWidth, canvasHeight, cx - 47, oy + 61 + step, 13, 6, accent);
    return;
  }

  if (kind.includes('old-quarry')) {
    ellipse(buffer, canvasWidth, canvasHeight, cx, oy + 82, 34, 8, '#000000', 82);
    rect(buffer, canvasWidth, canvasHeight, cx - 18, oy + 32 + pulse, 36, 38, outline);
    rect(buffer, canvasWidth, canvasHeight, cx - 14, oy + 35 + pulse, 28, 31, body);
    rect(buffer, canvasWidth, canvasHeight, cx - 19, oy + 25 + pulse, 38, 12, outline);
    rect(buffer, canvasWidth, canvasHeight, cx - 15, oy + 27 + pulse, 30, 8, shade);
    rect(buffer, canvasWidth, canvasHeight, cx - 12, oy + 13 + pulse, 24, 18, outline);
    rect(buffer, canvasWidth, canvasHeight, cx - 8, oy + 17 + pulse, 16, 11, body);
    rect(buffer, canvasWidth, canvasHeight, cx - 7, oy + 21 + pulse, 5, 4, accent);
    rect(buffer, canvasWidth, canvasHeight, cx + 3, oy + 21 + pulse, 5, 4, accent);
    rect(buffer, canvasWidth, canvasHeight, cx - 10, oy + 45 + pulse, 20, 5, shade);
    line(buffer, canvasWidth, canvasHeight, cx - 18, oy + 43 + pulse, cx - 34, oy + 63 + step, 9, outline);
    line(buffer, canvasWidth, canvasHeight, cx + 18, oy + 43 + pulse, cx + 36, oy + 61 - step, 9, outline);
    line(buffer, canvasWidth, canvasHeight, cx - 17, oy + 43 + pulse, cx - 32, oy + 62 + step, 5, body);
    line(buffer, canvasWidth, canvasHeight, cx + 17, oy + 43 + pulse, cx + 34, oy + 60 - step, 5, body);
    rect(buffer, canvasWidth, canvasHeight, cx - 14, oy + 68 + pulse, 10, 18 - step / 2, outline);
    rect(buffer, canvasWidth, canvasHeight, cx + 4, oy + 68 + pulse, 10, 18 + step / 2, outline);
    rect(buffer, canvasWidth, canvasHeight, cx + 26, oy + 18 + pulse, 8, 45, outline);
    rect(buffer, canvasWidth, canvasHeight, cx + 28, oy + 20 + pulse, 4, 39, accent);
    rect(buffer, canvasWidth, canvasHeight, cx + 22, oy + 15 + pulse, 16, 8, outline);
    return;
  }

  ellipse(buffer, canvasWidth, canvasHeight, cx, oy + 82, 31, 8, '#000000', 78);
  rect(buffer, canvasWidth, canvasHeight, cx - 15, oy + 30 + pulse, 30, 42, outline);
  rect(buffer, canvasWidth, canvasHeight, cx - 11, oy + 34 + pulse, 22, 35, body);
  rect(buffer, canvasWidth, canvasHeight, cx - 17, oy + 43 + pulse, 34, 6, accent, 190);
  rect(buffer, canvasWidth, canvasHeight, cx - 13, oy + 15 + pulse, 26, 18, outline);
  rect(buffer, canvasWidth, canvasHeight, cx - 9, oy + 18 + pulse, 18, 12, shade);
  rect(buffer, canvasWidth, canvasHeight, cx - 7, oy + 22 + pulse, 4, 4, '#e0f2fe');
  rect(buffer, canvasWidth, canvasHeight, cx + 4, oy + 22 + pulse, 4, 4, '#e0f2fe');
  rect(buffer, canvasWidth, canvasHeight, cx - 15, oy + 11 + pulse, 30, 5, accent);
  line(buffer, canvasWidth, canvasHeight, cx - 14, oy + 38 + pulse, cx - 32, oy + 55 + step, 6, outline);
  line(buffer, canvasWidth, canvasHeight, cx + 14, oy + 38 + pulse, cx + 31, oy + 55 - step, 6, outline);
  line(buffer, canvasWidth, canvasHeight, cx - 13, oy + 38 + pulse, cx - 30, oy + 54 + step, 3, body);
  line(buffer, canvasWidth, canvasHeight, cx + 13, oy + 38 + pulse, cx + 29, oy + 54 - step, 3, body);
  rect(buffer, canvasWidth, canvasHeight, cx - 11, oy + 70 + pulse, 8, 16 - step / 2, outline);
  rect(buffer, canvasWidth, canvasHeight, cx + 3, oy + 70 + pulse, 8, 16 + step / 2, outline);
  line(buffer, canvasWidth, canvasHeight, cx + 29, oy + 13 + pulse, cx + 29, oy + 78, 5, outline);
  line(buffer, canvasWidth, canvasHeight, cx + 29, oy + 13 + pulse, cx + 29, oy + 78, 2, '#cffafe');
  rect(buffer, canvasWidth, canvasHeight, cx + 25, oy + 9 + pulse, 9, 9, accent);
  rect(buffer, canvasWidth, canvasHeight, cx - 23, oy + 60 + pulse, 6, 4, '#67e8f9', 180);
  rect(buffer, canvasWidth, canvasHeight, cx + 17, oy + 63 + pulse, 6, 4, '#67e8f9', 180);
}

function drawEnemyFrameByKind(kind, boss = false) {
  const frameSize = boss ? 96 : 64;
  return drawSheet(frameSize, frameSize, 4, (buffer, width, height, frame, ox, oy) => {
    const palette = ENEMY_PALETTES[kind] ?? ['#64748b', '#1f2937', '#f8fafc'];
    if (boss && (kind.includes('old-quarry') || kind.includes('tideglass') || kind.includes('redscar'))) {
      drawTamziaBossFrame(buffer, width, height, frame, ox, oy, palette, kind);
      return;
    }
    if (!boss && (kind.includes('reedwater') || kind.includes('redscar'))) {
      drawTamziaBanditFrame(buffer, width, height, frame, ox, oy, palette, kind);
      return;
    }
    if (!boss && kind.includes('moonbrook')) {
      drawMoonbrookProwlerFrame(buffer, width, height, frame, ox, oy, palette);
      return;
    }
    if (!boss && kind.includes('saltspine')) {
      drawSaltspineCrawlerFrame(buffer, width, height, frame, ox, oy, palette);
      return;
    }
    if (!boss && (kind.includes('scorpion') || kind.includes('spider') || kind.includes('sprite') || kind.includes('crawler'))) {
      drawInsectFrame(buffer, width, height, frame, ox, oy, palette);
      return;
    }
    if (!boss && (kind.includes('wolf') || kind.includes('hound') || kind.includes('rat') || kind.includes('strider') || kind.includes('quilboar') || kind.includes('stag') || kind.includes('bear') || kind.includes('prowler'))) {
      drawBeastFrame(buffer, width, height, frame, ox, oy, palette, kind);
      return;
    }
    drawHumanoidFrame(buffer, width, height, frame, ox, oy, palette, kind, boss);
  });
}

function drawPetFrame(buffer, canvasWidth, canvasHeight, frame, ox, oy, palette, race) {
  const [body, shade, accent] = palette;
  const idle = frame <= 1;
  const walking = frame === 2 || frame === 3;
  const attacking = frame >= 4;
  const attackPhase = frame === 5 ? 1 : 0;
  const step = walking ? (frame === 2 ? -4 : 4) : 0;
  const bounce = idle ? (frame === 1 ? -1 : 0) : walking ? -1 : 0;
  const lunge = attacking ? 5 + attackPhase * 6 : 0;
  const headLift = attacking ? -2 - attackPhase * 2 : 0;
  const outline = '#101820';
  ellipse(buffer, canvasWidth, canvasHeight, ox + 32, oy + 50, 25, 6, '#000000', 70);
  rect(buffer, canvasWidth, canvasHeight, ox + 13 + lunge * 0.35, oy + 25 + bounce, 34, 18, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 17 + lunge * 0.35, oy + 28 + bounce, 27, 12, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 22 + lunge * 0.35, oy + 35 + bounce, 19, 5, shade);
  rect(buffer, canvasWidth, canvasHeight, ox + 43 + lunge, oy + 18 + bounce + headLift, 18, attacking ? 22 : 20, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 46 + lunge, oy + 21 + bounce + headLift, 12, attacking ? 15 : 14, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 47 + lunge, oy + 11 + bounce + headLift, 6, 10, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 55 + lunge, oy + 11 + bounce + headLift, 6, 10, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 50 + lunge, oy + 25 + bounce + headLift, 3, 3, '#f8fafc');
  rect(buffer, canvasWidth, canvasHeight, ox + 57 + lunge, oy + 25 + bounce + headLift, 3, 3, '#f8fafc');
  if (attacking) {
    rect(buffer, canvasWidth, canvasHeight, ox + 55 + lunge, oy + 35 + bounce + headLift, 13 + attackPhase * 4, 4, outline);
    rect(buffer, canvasWidth, canvasHeight, ox + 57 + lunge, oy + 36 + bounce + headLift, 10 + attackPhase * 4, 2, '#fef3c7');
    rect(buffer, canvasWidth, canvasHeight, ox + 61 + lunge + attackPhase * 4, oy + 39 + bounce + headLift, 4, 4, accent);
  } else {
    rect(buffer, canvasWidth, canvasHeight, ox + 48 + lunge, oy + 33 + bounce, 12, 3, outline);
  }
  line(buffer, canvasWidth, canvasHeight, ox + 16, oy + 31 + bounce, ox + 4 - (attacking ? 3 : 0), oy + 23 + bounce + (idle ? Math.sin(frame) : 0), 6, outline);
  line(buffer, canvasWidth, canvasHeight, ox + 16, oy + 31 + bounce, ox + 4 - (attacking ? 3 : 0), oy + 23 + bounce, 3, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 19 + lunge * 0.25, oy + 38 + bounce, 5, 13 + step, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 34 + lunge * 0.25, oy + 38 + bounce, 5, 13 - step, outline);
  rect(buffer, canvasWidth, canvasHeight, ox + 20 + lunge * 0.25, oy + 39 + bounce, 3, 9 + step, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 35 + lunge * 0.25, oy + 39 + bounce, 3, 9 - step, body);
  rect(buffer, canvasWidth, canvasHeight, ox + 18, oy + 22 + bounce, 22, 3, accent);
  if (race === 'orc') {
    rect(buffer, canvasWidth, canvasHeight, ox + 55 + lunge, oy + 34 + bounce + headLift, 8, 3, '#fef3c7');
  }
  if (race === 'dwarf') {
    rect(buffer, canvasWidth, canvasHeight, ox + 20, oy + 21 + bounce, 12, 6, '#f59e0b');
  }
  if (race === 'elf') {
    line(buffer, canvasWidth, canvasHeight, ox + 44, oy + 21 + bounce, ox + 37, oy + 13 + bounce, 3, accent);
  }
}

const PET_PALETTES = {
  human: ['#6b7280', '#374151', '#d6b15f'],
  elf: ['#355e3b', '#1f3d2a', '#a7f3d0'],
  dwarf: ['#8a5a3c', '#4b2f22', '#f59e0b'],
  orc: ['#5f6f37', '#323d1f', '#c2410c'],
};

const HAND_AUTHORED_ENEMIES = new Set([
  'wolf',
  'bramblehide-bear',
  'moonbrook-prowler',
  'redscar-highwayman',
  'redscar-captain',
  'old-quarry-giant',
  'tideglass-matriarch',
]);

for (const kind of NORMAL_ENEMIES) {
  if (HAND_AUTHORED_ENEMIES.has(kind)) continue;
  const sheet = drawEnemyFrameByKind(kind, false);
  savePng(join(ENEMIES_DIR, `${kind}.png`), sheet.buffer, sheet.width, sheet.height);
}

for (const kind of BOSS_ENEMIES) {
  if (HAND_AUTHORED_ENEMIES.has(kind)) continue;
  const sheet = drawEnemyFrameByKind(kind, true);
  savePng(join(ENEMIES_DIR, `${kind}.png`), sheet.buffer, sheet.width, sheet.height);
}

for (const [race, palette] of Object.entries(PET_PALETTES)) {
  const sheet = drawSheet(64, 64, 6, (buffer, width, height, frame, ox, oy) => {
    drawPetFrame(buffer, width, height, frame, ox, oy, palette, race);
  });
  savePng(join(PETS_DIR, `${race}.png`), sheet.buffer, sheet.width, sheet.height);
}
