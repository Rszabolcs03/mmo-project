import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'public', 'assets', 'characters');
const LAYER_DIRS = ['base', 'hair', 'beard', 'outfits', 'weapons', 'capes'];
const FRAME = 48;
const COLS = 4;
const ROWS = 4;
const WIDTH = FRAME * COLS;
const HEIGHT = FRAME * ROWS;
const GENDERS = ['male', 'female'];

const OUTLINE = '#111820';
const DEEP_OUTLINE = '#05080c';
const SHADOW = '#000000';
const SKIN = '#f2c7a4';
const SKIN_SHADE = '#d99a72';
const EYE = '#0f172a';

const CLASSES = {
  priest: {
    main: '#f8fafc',
    shade: '#cbd5e1',
    trim: '#facc15',
    trimLight: '#fef08a',
    accent: '#d8b4fe',
    dark: '#7c3aed',
    hair: '#b794f4',
    weapon: '#fde68a',
    weaponShade: '#b7791f',
    type: 'priest',
  },
  paladin: {
    main: '#f8fafc',
    shade: '#94a3b8',
    trim: '#facc15',
    trimLight: '#fef08a',
    accent: '#e5e7eb',
    dark: '#475569',
    hair: '#facc15',
    weapon: '#e5e7eb',
    weaponShade: '#94a3b8',
    type: 'paladin',
  },
  hunter: {
    main: '#365c2d',
    shade: '#1f3f23',
    trim: '#d6a354',
    trimLight: '#fde68a',
    accent: '#7c4a22',
    dark: '#17201a',
    hair: '#2f221d',
    weapon: '#8d6e45',
    weaponShade: '#5f4329',
    type: 'hunter',
  },
  mage: {
    main: '#1d4ed8',
    shade: '#312e81',
    trim: '#facc15',
    trimLight: '#7dd3fc',
    accent: '#7c3aed',
    dark: '#172554',
    hair: '#2563eb',
    weapon: '#7dd3fc',
    weaponShade: '#0e7490',
    type: 'mage',
  },
  rogue: {
    main: '#1f2937',
    shade: '#0b1120',
    trim: '#9ca3af',
    trimLight: '#e5e7eb',
    accent: '#7c2d12',
    dark: '#020617',
    hair: '#111827',
    weapon: '#e5e7eb',
    weaponShade: '#94a3b8',
    type: 'rogue',
  },
  warrior: {
    main: '#7f1d1d',
    shade: '#451a1a',
    trim: '#cbd5e1',
    trimLight: '#f8fafc',
    accent: '#8b5a2b',
    dark: '#374151',
    hair: '#8b5a2b',
    weapon: '#e5e7eb',
    weaponShade: '#94a3b8',
    type: 'warrior',
  },
};

const RACES = {
  human: { skin: '#f2c7a4', shade: '#d99a72', ear: null },
  elf: { skin: '#f0d6ad', shade: '#d7a477', ear: '#f0d6ad' },
  dwarf: { skin: '#d6a06f', shade: '#9a6543', ear: null },
  orc: { skin: '#74a85a', shade: '#4f7f3f', ear: '#74a85a' },
  undead: { skin: '#cbd5c0', shade: '#8fa08c', ear: null },
};

const HAIR_STYLES = {
  short: { color: '#8b5e34', shade: '#5f3f24' },
  long: { color: '#d8b4fe', shade: '#8b5cf6' },
  hooded: { color: '#1f2937', shade: '#0b1120' },
};

const BEARD_STYLES = {
  none: null,
  short: { color: '#7c4a22', shade: '#4b2c15' },
  full: { color: '#4b2c15', shade: '#241107' },
};

const OUTFIT_VARIANTS = {
  classic: {},
  veteran: { trimBoost: '#ffffff' },
  dark: { darken: true },
};

const WEAPON_VARIANTS = {
  classic: {},
  ornate: { trimBoost: '#ffffff' },
  shadow: { darken: true },
};

function hexToRgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function createCanvas() {
  return new Uint8Array(WIDTH * HEIGHT * 4);
}

function setPixel(buffer, x, y, rgba) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const index = (y * WIDTH + x) * 4;
  buffer[index] = rgba[0];
  buffer[index + 1] = rgba[1];
  buffer[index + 2] = rgba[2];
  buffer[index + 3] = rgba[3];
}

function rect(buffer, x, y, width, height, color, alpha = 255) {
  const rgba = hexToRgba(color, alpha);
  const sx = Math.round(x);
  const sy = Math.round(y);
  const ex = Math.round(x + width);
  const ey = Math.round(y + height);
  for (let yy = sy; yy < ey; yy += 1) {
    for (let xx = sx; xx < ex; xx += 1) {
      setPixel(buffer, xx, yy, rgba);
    }
  }
}

function line(buffer, x1, y1, x2, y2, size, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    rect(buffer, x1 + (x2 - x1) * t - size / 2, y1 + (y2 - y1) * t - size / 2, size, size, color);
  }
}

function pixelDiamond(buffer, cx, cy, radius, color) {
  for (let y = -radius; y <= radius; y += 1) {
    const half = radius - Math.abs(y);
    rect(buffer, cx - half, cy + y, half * 2 + 1, 1, color);
  }
}

function drawCross(buffer, cx, cy, color) {
  rect(buffer, cx - 1, cy - 4, 3, 9, color);
  rect(buffer, cx - 4, cy - 1, 9, 3, color);
}

function drawSpark(buffer, cx, cy, color) {
  rect(buffer, cx, cy - 3, 1, 7, color);
  rect(buffer, cx - 3, cy, 7, 1, color);
  rect(buffer, cx - 1, cy - 1, 3, 3, '#ffffff');
}

function drawFeet(buffer, ox, oy, col, cfg) {
  const step = col === 1 ? -3 : col === 3 ? 3 : 0;
  const bounce = col === 0 || col === 2 ? 0 : -1;
  rect(buffer, ox + 16, oy + 37 + bounce + step, 7, 5, DEEP_OUTLINE);
  rect(buffer, ox + 25, oy + 37 + bounce - step, 7, 5, DEEP_OUTLINE);
  rect(buffer, ox + 17, oy + 37 + bounce + step, 5, 3, cfg.trim);
  rect(buffer, ox + 26, oy + 37 + bounce - step, 5, 3, cfg.trim);
}

function drawHead(buffer, ox, oy, direction, cfg, bounce) {
  const side = direction === 'left' ? -1 : 1;
  const sideView = direction === 'left' || direction === 'right';
  const back = direction === 'up';
  const y = oy + bounce;
  const female = cfg.gender === 'female';
  const hairColor = female && cfg.type !== 'rogue' ? cfg.femaleHair ?? cfg.hair : cfg.hair;

  if (back) {
    rect(buffer, ox + 14, y + 5, 20, female ? 25 : 19, OUTLINE);
    rect(buffer, ox + 16, y + 7, 16, female ? 22 : 16, hairColor);
    rect(buffer, ox + 14, y + 14, 20, female ? 15 : 10, hairColor);
    rect(buffer, ox + 18, y + 8, 10, 3, cfg.trimLight, 140);
    return;
  }

  if (sideView) {
    const hx = side > 0 ? 14 : 17;
    rect(buffer, ox + hx, y + 6, 17, female ? 22 : 17, OUTLINE);
    rect(buffer, ox + hx + 3, y + 9, 12, 12, SKIN);
    rect(buffer, ox + hx + 3, y + 19, 10, 2, SKIN_SHADE);
    rect(buffer, ox + hx + (side > 0 ? 2 : 5), y + 5, 14, 7, hairColor);
    if (female) {
      rect(buffer, ox + hx + (side > 0 ? 2 : 5), y + 14, 12, 13, hairColor);
      rect(buffer, ox + hx + (side > 0 ? 12 : 5), y + 18, 3, 8, cfg.shade);
    }
    rect(buffer, ox + hx + (side > 0 ? 12 : 4), y + 14, 3, 3, EYE);
    rect(buffer, ox + hx + (side > 0 ? 11 : 3), y + 20, 5, 2, EYE);
    return;
  }

  rect(buffer, ox + 14, y + 6, 20, 18, OUTLINE);
  rect(buffer, ox + 17, y + 9, 14, 12, SKIN);
  rect(buffer, ox + 17, y + 19, 14, 3, SKIN_SHADE);
  rect(buffer, ox + 15, y + 5, 18, 7, hairColor);
  if (female) {
    rect(buffer, ox + 13, y + 10, 5, 16, OUTLINE);
    rect(buffer, ox + 30, y + 10, 5, 16, OUTLINE);
    rect(buffer, ox + 14, y + 11, 3, 14, hairColor);
    rect(buffer, ox + 31, y + 11, 3, 14, hairColor);
  }
  rect(buffer, ox + 18, y + 14, 3, 3, EYE);
  rect(buffer, ox + 27, y + 14, 3, 3, EYE);
  rect(buffer, ox + 21, y + 20, 6, 2, EYE);
}

function drawRobeBody(buffer, ox, oy, direction, col, cfg) {
  const bounce = col === 0 || col === 2 ? 0 : -1;
  const side = direction === 'left' ? -1 : 1;
  const sideView = direction === 'left' || direction === 'right';
  const back = direction === 'up';
  const y = oy + bounce;
  const widthOffset = cfg.gender === 'female' ? -2 : 0;

  if (sideView) {
    const bodyX = side > 0 ? 16 : 11;
    rect(buffer, ox + bodyX, y + 18, 22 + widthOffset, 22, OUTLINE);
    rect(buffer, ox + bodyX + 3, y + 20, 16 + widthOffset, 18, cfg.main);
    rect(buffer, ox + bodyX + (side > 0 ? 14 : 3), y + 21, 4, 17, cfg.trim);
    rect(buffer, ox + bodyX + 4, y + 33, 14, 4, cfg.shade);
  } else {
    rect(buffer, ox + 12 - widthOffset / 2, y + 17, 24 + widthOffset, 24, OUTLINE);
    rect(buffer, ox + 15 - widthOffset / 2, y + 19, 18 + widthOffset, 20, cfg.main);
    rect(buffer, ox + 21, y + 19, 6, 20, cfg.trim);
    rect(buffer, ox + 16, y + 34, 16, 5, cfg.shade);
    if (back) rect(buffer, ox + 15, y + 20, 18, 19, cfg.main);
  }
}

function drawArmorBody(buffer, ox, oy, direction, col, cfg, bulky = false) {
  const bounce = col === 0 || col === 2 ? 0 : -1;
  const side = direction === 'left' ? -1 : 1;
  const sideView = direction === 'left' || direction === 'right';
  const y = oy + bounce;
  const bodyX = sideView ? (side > 0 ? 15 : 11) : 11;
  const width = bulky ? 26 : 24;

  rect(buffer, ox + bodyX, y + 17, width, 24, OUTLINE);
  rect(buffer, ox + bodyX + 3, y + 19, width - 6, 19, cfg.main);
  rect(buffer, ox + bodyX + 4, y + 23, width - 8, 5, cfg.trim);
  rect(buffer, ox + bodyX + 5, y + 33, width - 10, 5, cfg.shade);
  rect(buffer, ox + bodyX + 6, y + 19, 5, 18, cfg.trimLight, 190);
  if (!sideView) drawCross(buffer, ox + 24, y + 29, cfg.trim);
}

function drawHoodBody(buffer, ox, oy, direction, col, cfg) {
  const bounce = col === 0 || col === 2 ? 0 : -1;
  const side = direction === 'left' ? -1 : 1;
  const sideView = direction === 'left' || direction === 'right';
  const y = oy + bounce;
  const bodyX = sideView ? (side > 0 ? 16 : 11) : 12;

  rect(buffer, ox + bodyX, y + 18, 24, 22, OUTLINE);
  rect(buffer, ox + bodyX + 3, y + 20, 18, 18, cfg.main);
  rect(buffer, ox + bodyX + 4, y + 30, 15, 5, cfg.accent);
  rect(buffer, ox + bodyX + (sideView && side < 0 ? 4 : 15), y + 20, 4, 18, cfg.trim);
}

function drawArms(buffer, ox, oy, direction, col, cfg, armored = false) {
  const bounce = col === 0 || col === 2 ? 0 : -1;
  const armSwing = col === 1 ? -2 : col === 3 ? 2 : 0;
  const side = direction === 'left' ? -1 : 1;
  const sideView = direction === 'left' || direction === 'right';
  const y = oy + bounce;
  const armColor = armored ? cfg.trimLight : cfg.trim;

  if (sideView) {
    const x = side > 0 ? 12 : 32;
    rect(buffer, ox + x, y + 22 + armSwing, 6, 14, OUTLINE);
    rect(buffer, ox + x + 1, y + 23 + armSwing, 4, 10, armColor);
    return;
  }

  rect(buffer, ox + 8, y + 22 + armSwing, 6, 14, OUTLINE);
  rect(buffer, ox + 34, y + 22 - armSwing, 6, 14, OUTLINE);
  rect(buffer, ox + 9, y + 23 + armSwing, 4, 10, armColor);
  rect(buffer, ox + 35, y + 23 - armSwing, 4, 10, armColor);
}

function drawClassHatOrHelmet(buffer, ox, oy, direction, cfg, bounce) {
  const y = oy + bounce;
  if (cfg.type === 'mage') {
    rect(buffer, ox + 14, y + 6, 20, 5, OUTLINE);
    rect(buffer, ox + 17, y + 1, 14, 9, OUTLINE);
    rect(buffer, ox + 18, y + 2, 12, 8, cfg.shade);
    rect(buffer, ox + 16, y + 8, 16, 3, cfg.trimLight);
    return;
  }

  if (cfg.type === 'paladin') {
    rect(buffer, ox + 14, y + 5, 20, 8, OUTLINE);
    rect(buffer, ox + 16, y + 6, 16, 6, cfg.trim);
    rect(buffer, ox + 21, y + 3, 6, 6, cfg.trimLight);
    if (direction !== 'up') rect(buffer, ox + 22, y + 12, 4, 9, cfg.shade);
    return;
  }

  if (cfg.type === 'hunter' || cfg.type === 'rogue') {
    rect(buffer, ox + 14, y + 5, 20, 12, OUTLINE);
    rect(buffer, ox + 16, y + 7, 16, 9, cfg.shade);
    if (cfg.type === 'hunter') {
      rect(buffer, ox + 18, y + 5, 10, 3, cfg.trim);
    } else {
      rect(buffer, ox + 17, y + 17, 14, 4, cfg.dark);
    }
  }
}

function drawWeapon(buffer, ox, oy, direction, col, cfg) {
  const bounce = col === 0 || col === 2 ? 0 : -1;
  const swing = col === 1 ? -1 : col === 3 ? 2 : 0;
  const side = direction === 'left' ? -1 : 1;
  const sideView = direction === 'left' || direction === 'right';
  const back = direction === 'up';
  const y = oy + bounce;

  if (cfg.type === 'priest' || cfg.type === 'mage') {
    const staffX = sideView ? (side > 0 ? 36 : 10) : 37;
    line(buffer, ox + staffX, y + 10, ox + staffX, y + 38, 3, OUTLINE);
    line(buffer, ox + staffX, y + 11, ox + staffX, y + 37, 1, cfg.weapon);
    if (cfg.type === 'priest') {
      drawCross(buffer, ox + staffX, y + 8, cfg.trimLight);
    } else {
      pixelDiamond(buffer, ox + staffX, y + 8, 4, cfg.trimLight);
      rect(buffer, ox + staffX - 1, y + 7, 3, 3, '#ffffff');
    }
    return;
  }

  if (cfg.type === 'paladin') {
    const shieldX = sideView ? (side > 0 ? 8 : 31) : 8;
    rect(buffer, ox + shieldX, y + 23, 10, 14, OUTLINE);
    rect(buffer, ox + shieldX + 2, y + 25, 6, 10, cfg.trim);
    drawCross(buffer, ox + shieldX + 5, y + 30, cfg.trimLight);
    const hammerX = sideView ? (side > 0 ? 36 : 8) : 36;
    line(buffer, ox + hammerX, y + 17 + swing, ox + hammerX, y + 37 + swing, 3, cfg.weaponShade);
    rect(buffer, ox + hammerX - 4, y + 14 + swing, 9, 6, cfg.weapon);
    rect(buffer, ox + hammerX - 5, y + 15 + swing, 11, 2, cfg.trimLight);
    return;
  }

  if (cfg.type === 'hunter') {
    const bowX = sideView ? (side > 0 ? 37 : 10) : 38;
    line(buffer, ox + bowX, y + 13, ox + bowX, y + 38, 3, OUTLINE);
    line(buffer, ox + bowX, y + 14, ox + bowX, y + 37, 1, cfg.weapon);
    line(buffer, ox + bowX - 5 * side, y + 19, ox + bowX + 5 * side, y + 31, 1, cfg.trimLight);
    if (back) line(buffer, ox + 12, y + 37, ox + 35, y + 17, 2, cfg.weapon);
    return;
  }

  if (cfg.type === 'rogue') {
    if (sideView) {
      const daggerX = side > 0 ? 37 : 11;
      line(buffer, ox + daggerX, y + 29 + swing, ox + daggerX + side * 8, y + 37 + swing, 3, OUTLINE);
      line(buffer, ox + daggerX, y + 29 + swing, ox + daggerX + side * 8, y + 37 + swing, 1, cfg.weapon);
    } else {
      line(buffer, ox + 10, y + 29 + swing, ox + 4, y + 38 + swing, 3, OUTLINE);
      line(buffer, ox + 38, y + 29 - swing, ox + 44, y + 38 - swing, 3, OUTLINE);
      line(buffer, ox + 10, y + 29 + swing, ox + 4, y + 38 + swing, 1, cfg.weapon);
      line(buffer, ox + 38, y + 29 - swing, ox + 44, y + 38 - swing, 1, cfg.weapon);
    }
    return;
  }

  if (cfg.type === 'warrior') {
    const swordX = sideView ? (side > 0 ? 37 : 11) : 37;
    const x2 = sideView ? swordX + side * 8 : 43;
    line(buffer, ox + swordX, y + 15 + swing, ox + x2, y + 37 + swing, 4, OUTLINE);
    line(buffer, ox + swordX, y + 16 + swing, ox + x2, y + 36 + swing, 2, cfg.weapon);
    rect(buffer, ox + swordX - 3, y + 16 + swing, 8, 3, cfg.trimLight);
  }
}

function drawFrame(buffer, cfg, row, col) {
  const ox = col * FRAME;
  const oy = row * FRAME;
  const direction = ['down', 'left', 'right', 'up'][row];
  const bounce = col === 0 || col === 2 ? 0 : -1;

  rect(buffer, ox + 12, oy + 42, 25, 3, SHADOW, 46);
  drawFeet(buffer, ox, oy, col, cfg);

  if (cfg.type === 'paladin') {
    drawArmorBody(buffer, ox, oy, direction, col, cfg, true);
    drawArms(buffer, ox, oy, direction, col, cfg, true);
  } else if (cfg.type === 'warrior') {
    drawArmorBody(buffer, ox, oy, direction, col, cfg, false);
    drawArms(buffer, ox, oy, direction, col, cfg, true);
    if (direction === 'up') rect(buffer, ox + 13, oy + 20 + bounce, 22, 21, cfg.main);
  } else if (cfg.type === 'hunter' || cfg.type === 'rogue') {
    drawHoodBody(buffer, ox, oy, direction, col, cfg);
    drawArms(buffer, ox, oy, direction, col, cfg);
  } else {
    drawRobeBody(buffer, ox, oy, direction, col, cfg);
    drawArms(buffer, ox, oy, direction, col, cfg);
  }

  drawHead(buffer, ox, oy, direction, cfg, bounce);
  drawClassHatOrHelmet(buffer, ox, oy, direction, cfg, bounce);

  if (cfg.type === 'priest') drawSpark(buffer, ox + 20, oy + 28 + bounce, cfg.trimLight);
  if (cfg.type === 'mage') drawSpark(buffer, ox + 19, oy + 29 + bounce, cfg.trimLight);
  if (cfg.type === 'hunter') rect(buffer, ox + 15, oy + 27 + bounce, 17, 3, cfg.trim, 220);
  if (cfg.type === 'rogue') rect(buffer, ox + 17, oy + 27 + bounce, 14, 4, cfg.accent, 230);

  drawWeapon(buffer, ox, oy, direction, col, cfg);
}

function drawSheet(drawLayerFrame) {
  const buffer = createCanvas();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      drawLayerFrame(buffer, row, col);
    }
  }
  return buffer;
}

function writeLayerSheet(folder, id, drawLayerFrame) {
  const outputPath = join(OUT_DIR, folder, `${id}.png`);
  writeFileSync(outputPath, encodePng(drawSheet(drawLayerFrame)));
  console.log(`Generated ${outputPath}`);
}

function mixConfig(classConfig, variant = {}) {
  if (variant.darken) {
    return {
      ...classConfig,
      main: classConfig.shade,
      shade: classConfig.dark,
      trim: classConfig.accent,
      trimLight: classConfig.trim,
    };
  }
  if (variant.trimBoost) {
    return {
      ...classConfig,
      trimLight: variant.trimBoost,
    };
  }
  return classConfig;
}

function drawBaseLayerFrame(buffer, race, gender, row, col) {
  const ox = col * FRAME;
  const oy = row * FRAME;
  const direction = ['down', 'left', 'right', 'up'][row];
  const bounce = col === 0 || col === 2 ? 0 : -1;
  const step = col === 1 ? -2 : col === 3 ? 2 : 0;
  const side = direction === 'left' ? -1 : 1;
  const sideView = direction === 'left' || direction === 'right';
  const back = direction === 'up';
  const y = oy + bounce;
  const slim = gender === 'female';

  rect(buffer, ox + 12, oy + 42, 25, 3, SHADOW, 46);
  rect(buffer, ox + 16, oy + 37 + bounce + step, 7, 5, DEEP_OUTLINE);
  rect(buffer, ox + 25, oy + 37 + bounce - step, 7, 5, DEEP_OUTLINE);
  rect(buffer, ox + 18, oy + 37 + bounce + step, 3, 3, race.shade);
  rect(buffer, ox + 27, oy + 37 + bounce - step, 3, 3, race.shade);

  if (back) {
    rect(buffer, ox + 15, y + 7, 18, 16, OUTLINE);
    rect(buffer, ox + 18, y + 10, 12, 11, race.skin);
    return;
  }

  if (sideView) {
    const hx = side > 0 ? 15 : 16;
    if (race.ear) {
      rect(buffer, ox + hx + (side > 0 ? 15 : -2), y + 14, 4, 4, OUTLINE);
      rect(buffer, ox + hx + (side > 0 ? 16 : -1), y + 15, 2, 2, race.ear);
    }
    rect(buffer, ox + hx, y + 7, slim ? 16 : 17, 16, OUTLINE);
    rect(buffer, ox + hx + 3, y + 10, 11, 10, race.skin);
    rect(buffer, ox + hx + 3, y + 19, 10, 2, race.shade);
    rect(buffer, ox + hx + (side > 0 ? 12 : 4), y + 14, 3, 3, EYE);
    return;
  }

  if (race.ear) {
    rect(buffer, ox + 11, y + 14, 4, 4, OUTLINE);
    rect(buffer, ox + 33, y + 14, 4, 4, OUTLINE);
    rect(buffer, ox + 12, y + 15, 2, 2, race.ear);
    rect(buffer, ox + 34, y + 15, 2, 2, race.ear);
  }
  rect(buffer, ox + 14, y + 7, 20, 17, OUTLINE);
  rect(buffer, ox + 17, y + 10, 14, 11, race.skin);
  rect(buffer, ox + 17, y + 19, 14, 3, race.shade);
  rect(buffer, ox + 18, y + 14, 3, 3, EYE);
  rect(buffer, ox + 27, y + 14, 3, 3, EYE);
}

function drawHairLayerFrame(buffer, style, row, col) {
  const ox = col * FRAME;
  const oy = row * FRAME;
  const direction = ['down', 'left', 'right', 'up'][row];
  const bounce = col === 0 || col === 2 ? 0 : -1;
  const side = direction === 'left' ? -1 : 1;
  const sideView = direction === 'left' || direction === 'right';
  const y = oy + bounce;

  if (style === 'hooded') {
    const cfg = HAIR_STYLES.hooded;
    rect(buffer, ox + 13, y + 5, 22, 14, OUTLINE);
    rect(buffer, ox + 15, y + 7, 18, 11, cfg.color);
    if (direction !== 'up') rect(buffer, ox + 17, y + 17, 14, 4, cfg.shade);
    return;
  }

  const cfg = HAIR_STYLES[style] ?? HAIR_STYLES.short;
  if (direction === 'up') {
    rect(buffer, ox + 13, y + 5, 22, style === 'long' ? 25 : 18, OUTLINE);
    rect(buffer, ox + 16, y + 7, 16, style === 'long' ? 22 : 14, cfg.color);
    rect(buffer, ox + 18, y + 8, 10, 3, cfg.shade);
    return;
  }
  if (sideView) {
    const hx = side > 0 ? 14 : 17;
    rect(buffer, ox + hx + (side > 0 ? 2 : 3), y + 5, 15, 8, OUTLINE);
    rect(buffer, ox + hx + (side > 0 ? 3 : 4), y + 6, 12, 6, cfg.color);
    if (style === 'long') {
      rect(buffer, ox + hx + (side > 0 ? 2 : 7), y + 13, 10, 15, OUTLINE);
      rect(buffer, ox + hx + (side > 0 ? 3 : 8), y + 14, 7, 12, cfg.color);
    }
    return;
  }
  rect(buffer, ox + 14, y + 5, 20, 8, OUTLINE);
  rect(buffer, ox + 16, y + 6, 16, 6, cfg.color);
  if (style === 'long') {
    rect(buffer, ox + 12, y + 10, 6, 17, OUTLINE);
    rect(buffer, ox + 30, y + 10, 6, 17, OUTLINE);
    rect(buffer, ox + 14, y + 11, 3, 14, cfg.color);
    rect(buffer, ox + 31, y + 11, 3, 14, cfg.color);
  }
}

function drawBeardLayerFrame(buffer, style, row, col) {
  const beard = BEARD_STYLES[style];
  if (!beard || row === 3) return;
  const ox = col * FRAME;
  const oy = row * FRAME;
  const bounce = col === 0 || col === 2 ? 0 : -1;
  const direction = ['down', 'left', 'right', 'up'][row];
  const side = direction === 'left' ? -1 : 1;
  const sideView = direction === 'left' || direction === 'right';
  const y = oy + bounce;
  if (sideView) {
    const hx = side > 0 ? 15 : 16;
    rect(buffer, ox + hx + (side > 0 ? 9 : 3), y + 18, 6, style === 'full' ? 7 : 4, beard.color);
    rect(buffer, ox + hx + (side > 0 ? 10 : 4), y + 20, 4, 2, beard.shade);
    return;
  }
  rect(buffer, ox + 18, y + 19, 12, style === 'full' ? 8 : 4, beard.color);
  rect(buffer, ox + 21, y + 22, 6, 3, beard.shade);
}

function drawOutfitLayerFrame(buffer, cfg, row, col) {
  const ox = col * FRAME;
  const oy = row * FRAME;
  const direction = ['down', 'left', 'right', 'up'][row];
  const bounce = col === 0 || col === 2 ? 0 : -1;
  drawFeet(buffer, ox, oy, col, cfg);
  if (cfg.type === 'paladin') {
    drawArmorBody(buffer, ox, oy, direction, col, cfg, true);
    drawArms(buffer, ox, oy, direction, col, cfg, true);
  } else if (cfg.type === 'warrior') {
    drawArmorBody(buffer, ox, oy, direction, col, cfg, false);
    drawArms(buffer, ox, oy, direction, col, cfg, true);
  } else if (cfg.type === 'hunter' || cfg.type === 'rogue') {
    drawHoodBody(buffer, ox, oy, direction, col, cfg);
    drawArms(buffer, ox, oy, direction, col, cfg);
  } else {
    drawRobeBody(buffer, ox, oy, direction, col, cfg);
    drawArms(buffer, ox, oy, direction, col, cfg);
  }
  drawClassHatOrHelmet(buffer, ox, oy, direction, cfg, bounce);
  if (cfg.type === 'priest') drawSpark(buffer, ox + 20, oy + 28 + bounce, cfg.trimLight);
  if (cfg.type === 'mage') drawSpark(buffer, ox + 19, oy + 29 + bounce, cfg.trimLight);
}

function drawCapeLayerFrame(buffer, style, row, col) {
  if (style === 'none') return;
  const ox = col * FRAME;
  const oy = row * FRAME;
  const direction = ['down', 'left', 'right', 'up'][row];
  const bounce = col === 0 || col === 2 ? 0 : -1;
  const long = style === 'long';
  const y = oy + bounce;
  if (direction === 'left' || direction === 'right') {
    const x = direction === 'right' ? 12 : 25;
    rect(buffer, ox + x, y + 20, 12, long ? 22 : 15, OUTLINE);
    rect(buffer, ox + x + 2, y + 22, 8, long ? 18 : 11, '#7f1d1d');
    rect(buffer, ox + x + 8, y + 23, 2, long ? 16 : 9, '#d97706');
    return;
  }
  rect(buffer, ox + 14, y + 18, 20, long ? 25 : 16, OUTLINE);
  rect(buffer, ox + 16, y + 20, 16, long ? 21 : 12, '#7f1d1d');
  rect(buffer, ox + 29, y + 22, 2, long ? 17 : 8, '#d97706');
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

function encodePng(rgba) {
  const raw = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    const rowStart = y * (WIDTH * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(rgba.buffer, y * WIDTH * 4, WIDTH * 4).copy(raw, rowStart + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const dir of LAYER_DIRS) {
  mkdirSync(join(OUT_DIR, dir), { recursive: true });
}

for (const [classId, classConfig] of Object.entries(CLASSES)) {
  for (const gender of ['default', ...GENDERS]) {
    const buffer = createCanvas();
    const genderConfig = {
      ...classConfig,
      gender: gender === 'default' ? 'male' : gender,
      femaleHair: classId === 'priest'
        ? '#d8b4fe'
        : classId === 'paladin'
          ? '#facc15'
          : classId === 'mage'
            ? '#2563eb'
            : classId === 'hunter'
              ? '#6b4f2a'
              : classConfig.hair,
    };
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        drawFrame(buffer, genderConfig, row, col);
      }
    }
    const suffix = gender === 'default' ? '' : `-${gender}`;
    const outputPath = join(OUT_DIR, `${classId}${suffix}.png`);
    writeFileSync(outputPath, encodePng(buffer));
    console.log(`Generated ${outputPath}`);
  }
}

for (const [raceId, raceConfig] of Object.entries(RACES)) {
  for (const gender of GENDERS) {
    writeLayerSheet('base', `${raceId}-${gender}`, (buffer, row, col) => {
      drawBaseLayerFrame(buffer, raceConfig, gender, row, col);
    });
  }
}

for (const style of Object.keys(HAIR_STYLES)) {
  writeLayerSheet('hair', style, (buffer, row, col) => {
    drawHairLayerFrame(buffer, style, row, col);
  });
}

for (const style of Object.keys(BEARD_STYLES)) {
  writeLayerSheet('beard', style, (buffer, row, col) => {
    drawBeardLayerFrame(buffer, style, row, col);
  });
}

for (const [classId, classConfig] of Object.entries(CLASSES)) {
  for (const [variantId, variant] of Object.entries(OUTFIT_VARIANTS)) {
    const cfg = mixConfig(classConfig, variant);
    writeLayerSheet('outfits', `${classId}-${variantId}`, (buffer, row, col) => {
      drawOutfitLayerFrame(buffer, cfg, row, col);
    });
  }

  for (const [variantId, variant] of Object.entries(WEAPON_VARIANTS)) {
    const cfg = mixConfig(classConfig, variant);
    writeLayerSheet('weapons', `${classId}-${variantId}`, (buffer, row, col) => {
      drawWeapon(buffer, col * FRAME, row * FRAME, ['down', 'left', 'right', 'up'][row], col, cfg);
    });
  }
}

for (const style of ['none', 'short', 'long']) {
  writeLayerSheet('capes', style, (buffer, row, col) => {
    drawCapeLayerFrame(buffer, style, row, col);
  });
}
