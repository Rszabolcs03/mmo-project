import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { PNG } from 'pngjs';

const root = process.cwd();
const characterRoot = resolve(root, 'public', 'assets', 'characters');

const logicalSize = 48;
const scale = 2;
const frameSize = logicalSize * scale;
const columns = 9;
const rows = 8;
const classes = ['mage', 'hunter', 'paladin', 'warrior', 'priest', 'rogue'];
const raceClasses = {
  human: ['mage', 'hunter', 'paladin', 'warrior', 'priest', 'rogue'],
  elf: ['mage', 'hunter', 'priest', 'rogue'],
  dwarf: ['paladin', 'warrior', 'hunter', 'priest', 'rogue'],
  orc: ['warrior', 'hunter', 'rogue'],
  undead: ['mage', 'warrior', 'priest', 'rogue'],
};
const races = Object.keys(raceClasses);
const bodies = ['male', 'female'];
const outfitVariants = ['classic', 'veteran', 'runed', 'dark'];
const weaponVariants = ['classic', 'veteran', 'runed', 'ornate', 'shadow'];
const faceStyles = {
  male: ['natural', 'focused', 'scarred', 'cheerful'],
  female: ['natural', 'focused', 'freckled', 'cheerful'],
};
const hairStyles = {
  male: ['cropped', 'windswept', 'tousled', 'tied'],
  female: ['long', 'side-bangs', 'bun', 'ponytail'],
};
const directions = [
  { id: 'down', x: 0, y: 1 },
  { id: 'down-right', x: 0.707, y: 0.707 },
  { id: 'right', x: 1, y: 0 },
  { id: 'up-right', x: 0.707, y: -0.707 },
  { id: 'up', x: 0, y: -1 },
  { id: 'up-left', x: -0.707, y: -0.707 },
  { id: 'left', x: -1, y: 0 },
  { id: 'down-left', x: -0.707, y: 0.707 },
];

const RACE_ANATOMY = {
  human: {
    rootY: 0, headLift: 0, shoulderWidth: 6, handWidth: 8, hipWidth: 3,
    footY: 43, footSpread: 3.8, profileDepth: 1, torsoBonus: 0,
  },
  elf: {
    rootY: -0.5, headLift: -0.5, shoulderWidth: 5.6, handWidth: 7.5, hipWidth: 2.8,
    footY: 44, footSpread: 3.5, profileDepth: 0.94, torsoBonus: -0.35,
  },
  dwarf: {
    rootY: 1.5, headLift: 0.5, shoulderWidth: 7.5, handWidth: 9.2, hipWidth: 4,
    footY: 41.5, footSpread: 4.5, profileDepth: 1.2, torsoBonus: 1.3,
  },
  orc: {
    rootY: 0.5, headLift: 0, shoulderWidth: 7.5, handWidth: 9, hipWidth: 4,
    footY: 43.5, footSpread: 4.4, profileDepth: 1.14, torsoBonus: 1,
  },
  undead: {
    rootY: 0, headLift: 0.15, shoulderWidth: 5.5, handWidth: 7.5, hipWidth: 2.7,
    footY: 43, footSpread: 3.3, profileDepth: 0.9, torsoBonus: -0.5,
  },
};

const C = {
  outline: '#201421',
  outlineSoft: '#382033',
  skinDeep: '#c27b58',
  skinShade: '#e3a073',
  skin: '#f3c59f',
  skinLight: '#ffe0bd',
  eye: '#1e3a5f',
  hairDeep: '#4b2c15',
  hairShade: '#68401f',
  hair: '#8b5e34',
  hairLight: '#b77a45',
  boot: '#241a20',
  bootLight: '#4b3540',
  metalDeep: '#475569',
  metal: '#94a3b8',
  metalLight: '#e2e8f0',
  goldDeep: '#a16207',
  gold: '#facc15',
  goldLight: '#fef08a',
  woodDeep: '#4b2c15',
  wood: '#7c4a22',
  woodLight: '#b66a2c',
  crystalDeep: '#0e7490',
  crystal: '#67e8f9',
  crystalLight: '#cffafe',
};

const CLASS_PALETTES = {
  mage: { deep: '#172554', shade: '#312e81', main: '#1d4ed8', light: '#4263eb', accentDeep: '#0e7490', accent: '#67e8f9', accentLight: '#cffafe' },
  hunter: { deep: '#152b18', shade: '#365c2d', main: '#4c7b3b', light: '#6f994e', accentDeep: '#4e301b', accent: '#b77936', accentLight: '#e4ad61' },
  paladin: { deep: '#475569', shade: '#cbd5e1', main: '#f8fafc', light: '#ffffff', accentDeep: '#a16207', accent: '#facc15', accentLight: '#fef08a' },
  warrior: { deep: '#3f1210', shade: '#7f1d1d', main: '#b92d26', light: '#e05044', accentDeep: '#475569', accent: '#94a3b8', accentLight: '#e2e8f0' },
  priest: { deep: '#64748b', shade: '#e2e8f0', main: '#f8fafc', light: '#ffffff', accentDeep: '#a16207', accent: '#facc15', accentLight: '#fef08a' },
  rogue: { deep: '#090f1a', shade: '#1f2937', main: '#37304a', light: '#5b487e', accentDeep: '#4a2160', accent: '#7e48a6', accentLight: '#c4b5fd' },
};

function rgba(hex) {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
    255,
  ];
}

function frame() {
  return new PNG({ width: logicalSize, height: logicalSize, colorType: 6 });
}

function put(image, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= image.width || py >= image.height) return;
  const index = (py * image.width + px) * 4;
  image.data.set(rgba(color), index);
}

function rect(image, x, y, width, height, color) {
  for (let py = Math.round(y); py < Math.round(y + height); py += 1) {
    for (let px = Math.round(x); px < Math.round(x + width); px += 1) put(image, px, py, color);
  }
}

function ellipse(image, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / Math.max(rx, 0.1);
      const ny = (y - cy) / Math.max(ry, 0.1);
      if (nx * nx + ny * ny <= 1) put(image, x, y, color);
    }
  }
}

function line(image, x0, y0, x1, y1, color, thickness = 1) {
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const sx = ax < bx ? 1 : -1;
  const dy = -Math.abs(by - ay);
  const sy = ay < by ? 1 : -1;
  let error = dx + dy;
  while (true) {
    ellipse(image, ax, ay, Math.max(0.5, thickness / 2), Math.max(0.5, thickness / 2), color);
    if (ax === bx && ay === by) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; ax += sx; }
    if (twice <= dx) { error += dx; ay += sy; }
  }
}

function polygon(image, points, color) {
  const minY = Math.floor(Math.min(...points.map((point) => point[1])));
  const maxY = Math.ceil(Math.max(...points.map((point) => point[1])));
  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let index = 0; index < points.length; index += 1) {
      const [x1, y1] = points[index];
      const [x2, y2] = points[(index + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    intersections.sort((left, right) => left - right);
    for (let index = 0; index < intersections.length; index += 2) {
      for (let x = Math.ceil(intersections[index]); x <= Math.floor(intersections[index + 1]); x += 1) {
        put(image, x, y, color);
      }
    }
  }
}

function outlinedLine(image, start, end, color, thickness = 2) {
  line(image, start.x, start.y, end.x, end.y, C.outline, thickness + 2);
  line(image, start.x, start.y, end.x, end.y, color, thickness);
}

function pose(row, column, raceId = 'human') {
  const direction = directions[row];
  const profile = Math.abs(direction.x) > 0.9;
  const anatomy = RACE_ANATOMY[raceId] ?? RACE_ANATOMY.human;
  // A literal world-space perpendicular has no horizontal component on the
  // cardinal side rows. That collapsed shoulders, hands, hips and equipment
  // into a single vertical strip. This is a screen-space paper-doll, so exact
  // profiles retain a compact visible width while depth is expressed in y.
  const perpendicular = profile
    ? { x: direction.x * 0.72 * anatomy.profileDepth, y: direction.x * 0.26 }
    : { x: -direction.y, y: direction.x };
  const walkIndex = column >= 1 && column <= 4 ? column - 1 : -1;
  const attackIndex = column >= 5 ? column - 5 : -1;
  const step = walkIndex >= 0 ? [-1, -0.65, 1, 0.65][walkIndex] : 0;
  const bob = walkIndex >= 0 ? [0, -1, 0, -1][walkIndex] : attackIndex === 2 ? 1 : 0;
  const lunge = attackIndex >= 0 ? [0, 1, 2, 0][attackIndex] : 0;
  const root = {
    x: 24 + Math.round(direction.x * lunge),
    y: anatomy.rootY + bob + Math.round(direction.y * lunge * 0.5),
  };
  const footSpread = Math.abs(direction.x) > 0.9 ? anatomy.footSpread * 0.63 : anatomy.footSpread;
  const footLeft = {
    x: root.x + perpendicular.x * footSpread + direction.x * step * 2,
    y: anatomy.footY + bob + perpendicular.y * footSpread * 0.45 + direction.y * step * 1.5,
  };
  const footRight = {
    x: root.x - perpendicular.x * footSpread - direction.x * step * 2,
    y: anatomy.footY + bob - perpendicular.y * footSpread * 0.45 - direction.y * step * 1.5,
  };
  const shoulderLeft = { x: root.x + perpendicular.x * anatomy.shoulderWidth, y: 24 + root.y + perpendicular.y * 1.4 };
  const shoulderRight = { x: root.x - perpendicular.x * anatomy.shoulderWidth, y: 24 + root.y - perpendicular.y * 1.4 };
  const armSwing = walkIndex >= 0 ? step * 1.4 : 0;
  const handLeft = {
    x: root.x + perpendicular.x * anatomy.handWidth + direction.x * armSwing,
    y: 31 + root.y + perpendicular.y * 2 + direction.y * armSwing,
  };
  const handRight = {
    x: root.x - perpendicular.x * anatomy.handWidth - direction.x * armSwing,
    y: 31 + root.y - perpendicular.y * 2 - direction.y * armSwing,
  };
  if (attackIndex >= 0) {
    const reach = [0, 2, 4, 1][attackIndex];
    handLeft.x += direction.x * reach;
    handLeft.y += direction.y * reach * 0.55;
  }
  return {
    row, column, direction, perpendicular, walkIndex, attackIndex, step, root, anatomy, raceId,
    head: { x: root.x + direction.x * (profile ? 0.35 : 1.2), y: 13 + root.y + anatomy.headLift + direction.y * 0.4 },
    shoulderLeft, shoulderRight, handLeft, handRight, footLeft, footRight,
    hipLeft: { x: root.x + perpendicular.x * anatomy.hipWidth, y: 35 + root.y + perpendicular.y },
    hipRight: { x: root.x - perpendicular.x * anatomy.hipWidth, y: 35 + root.y - perpendicular.y },
  };
}

function drawBody(image, p, body, raceId = 'human') {
  const profile = Math.abs(p.direction.x) > 0.9;
  const back = p.direction.y < -0.45;
  const side = p.direction.x < 0 ? -1 : 1;
  const raceHeadWidth = raceId === 'orc' ? 1.1 : raceId === 'dwarf' ? 1 : raceId === 'elf' ? -0.35 : raceId === 'undead' ? -0.15 : 0;
  const radiusX = (body === 'female' ? 6.5 : 7) + raceHeadWidth;
  const radiusY = raceId === 'dwarf' ? 7.9 : raceId === 'elf' ? 8.7 : raceId === 'orc' ? 8.8 : raceId === 'undead' ? 8.1 : 8.5;
  if (profile) {
    const x = p.head.x;
    const y = p.head.y;
    // Compact three-quarter silhouette: no projecting beak/nose and no long
    // empty face wedge. The face layer supplies direction through feature bias.
    ellipse(image, x, y, radiusX + 0.1, radiusY, C.outline);
    ellipse(image, x + side * 0.1, y + 0.2, radiusX - 0.85, radiusY - 1.05, C.skinShade);
    ellipse(image, x + side * 0.35, y - 0.45, radiusX - 1.45, radiusY - 2.15, C.skin);
    ellipse(image, x - side * (radiusX - 0.7), y + 1, 1.25, 1.8, C.outline);
    put(image, x - side * (radiusX - 0.7), y + 1, C.skinShade);
    line(image, x - side * 2, y - 6, x + side, y - 6, C.skinLight, 1);
    line(image, x + side, y + radiusY - 2.4, x - side * 2, y + radiusY - 1.4, C.skinDeep, 1);
  } else {
    ellipse(image, p.head.x, p.head.y, radiusX + 1, radiusY, C.outline);
    ellipse(image, p.head.x, p.head.y + 0.2, radiusX, radiusY - 1, C.skinShade);
    ellipse(image, p.head.x - 1, p.head.y - 1, radiusX - 1.2, radiusY - 2, C.skin);
    if (!back) {
      rect(image, p.head.x - 3, p.head.y - 4, 4, 2, C.skinLight);
      line(image, p.head.x - 3, p.head.y + 6, p.head.x + 3, p.head.y + 6, C.skinDeep, 1);
    }
    ellipse(image, p.head.x - radiusX - 0.5, p.head.y + 1, 1.5, 2.2, C.outline);
    ellipse(image, p.head.x + radiusX + 0.5, p.head.y + 1, 1.5, 2.2, C.outline);
    put(image, p.head.x - radiusX - 0.5, p.head.y + 1, back ? C.skinShade : C.skin);
    put(image, p.head.x + radiusX + 0.5, p.head.y + 1, back ? C.skinShade : C.skin);
  }
  // The outfit collar meets the head directly. An exposed neck column looked
  // like a detached black stalk and added no useful readability at this scale.
  if (raceId === 'elf') {
    const earLength = profile ? 4 : 3;
    const earY = p.head.y;
    if (profile) {
      polygon(image, [
        [p.head.x - side * 5, earY - 1], [p.head.x - side * (5 + earLength), earY - 3],
        [p.head.x - side * 6, earY + 2],
      ], C.outline);
      line(image, p.head.x - side * 6, earY, p.head.x - side * (6 + earLength - 1), earY - 2, C.skin, 1);
    } else {
      for (const earSide of [-1, 1]) {
        polygon(image, [
          [p.head.x + earSide * 6, earY - 1], [p.head.x + earSide * 10, earY - 3],
          [p.head.x + earSide * 7, earY + 2],
        ], C.outline);
        line(image, p.head.x + earSide * 7, earY, p.head.x + earSide * 9, earY - 2, C.skin, 1);
      }
    }
  }
  const handScale = raceId === 'dwarf' || raceId === 'orc' ? 0.35 : raceId === 'undead' ? -0.2 : 0;
  for (const hand of [p.handLeft, p.handRight]) {
    ellipse(image, hand.x, hand.y, 2.2 + handScale, 2.5 + handScale, C.outline);
    ellipse(image, hand.x, hand.y - 0.3, 1.3 + handScale * 0.5, 1.6 + handScale * 0.5, C.skin);
    put(image, hand.x - 1, hand.y - 1, C.skinLight);
  }
}

function drawFace(image, p, style, raceId = 'human') {
  if (p.direction.y < -0.45) return;
  const side = p.direction.x;
  const profile = Math.abs(side) > 0.9;
  if (profile) {
    // Exact cardinal sides use a true one-eye profile. Features remain inside
    // the head silhouette so the face reads as turned instead of stretched.
    const eyeX = p.head.x + side * (raceId === 'orc' ? 2.4 : 2);
    const eyeY = p.head.y - 1.2;
    const browStart = eyeX - side * 1.5;
    const browEnd = eyeX + side * 1.5;
    if (style === 'cheerful') {
      line(image, eyeX - side, eyeY, eyeX + side, eyeY, C.outline, 1);
      put(image, eyeX + side * 2, eyeY + 3, '#e99a8f');
    } else {
      put(image, eyeX - side, eyeY - 1, C.outline);
      put(image, eyeX, eyeY - 1, C.outline);
      put(image, eyeX - side, eyeY, C.skinLight);
      put(image, eyeX, eyeY, C.eye);
      put(image, eyeX, eyeY + 1, C.eye);
      line(image, browStart, eyeY - (style === 'focused' ? 3 : 2.5), browEnd, eyeY - 2, C.outlineSoft, 1);
    }
    put(image, p.head.x + side * 4, p.head.y + 1, C.skinDeep);
    put(image, p.head.x + side * 3, p.head.y + 3, C.skinShade);
    line(image, p.head.x + side, p.head.y + 5, p.head.x + side * 3, p.head.y + 5, C.outlineSoft, 1);
    put(image, p.head.x - side * 4, p.head.y + 1, C.skinDeep);
    if (style === 'scarred') {
      line(image, eyeX - side, eyeY - 4, eyeX + side * 2, eyeY + 3, '#8f4d4d', 1);
    }
    if (style === 'freckled') {
      put(image, p.head.x + side * 2, p.head.y + 2, '#b86e58');
      put(image, p.head.x + side * 3, p.head.y + 2, '#b86e58');
    }
    if (raceId === 'elf') {
      line(image, eyeX - side, eyeY - 2, eyeX + side * 2, eyeY - 3, C.outline, 1);
      put(image, p.head.x - side * 4, p.head.y - 2, C.skinLight);
    }
    if (raceId === 'dwarf') {
      line(image, eyeX - side * 2, eyeY - 3, eyeX + side, eyeY - 3, C.outline, 2);
      put(image, p.head.x + side * 3, p.head.y + 2, C.skinDeep);
    }
    if (raceId === 'orc') {
      line(image, eyeX - side * 2, eyeY - 3, eyeX + side, eyeY - 2, C.outline, 2);
      put(image, p.head.x + side * 3, p.head.y + 5, C.skinLight);
      put(image, p.head.x + side * 4, p.head.y + 4, C.outline);
    }
    if (raceId === 'undead') {
      ellipse(image, eyeX, eyeY, 2, 2, C.outline);
      put(image, eyeX, eyeY, C.eye);
      line(image, p.head.x - side * 3, p.head.y + 1, p.head.x - side, p.head.y + 4, C.skinDeep, 1);
      put(image, p.head.x + side * 3, p.head.y + 4, C.outlineSoft);
    }
    return;
  }

  const centerX = p.head.x + side * 0.35;
  const eyeY = p.head.y;
  for (const offset of [-3, 3]) {
    const eyeX = centerX + offset;
    if (style === 'cheerful') {
      line(image, eyeX - 1, eyeY, eyeX + 1, eyeY, C.outline, 1);
      continue;
    }
    // A light sclera plus colored iris keeps the compact eyes readable without
    // returning to the featureless dark rectangles used by the old model.
    put(image, eyeX - 1, eyeY - 1, C.outline);
    put(image, eyeX, eyeY - 1, C.outline);
    put(image, eyeX - 1, eyeY, C.skinLight);
    put(image, eyeX, eyeY, C.eye);
    put(image, eyeX, eyeY + 1, C.eye);
    put(image, eyeX - 1, eyeY + 1, C.skinShade);
    if (style === 'focused') {
      if (offset < 0) line(image, eyeX - 1, eyeY - 3, eyeX + 1, eyeY - 2, C.outline, 1);
      else line(image, eyeX - 1, eyeY - 2, eyeX + 1, eyeY - 3, C.outline, 1);
    } else {
      put(image, eyeX, eyeY - 3, C.outlineSoft);
    }
  }
  put(image, centerX, eyeY + 2, C.skinDeep);
  if (style === 'cheerful') {
    put(image, centerX - 5, eyeY + 3, '#e99a8f');
    put(image, centerX + 5, eyeY + 3, '#e99a8f');
    put(image, centerX - 2, eyeY + 4, C.outlineSoft);
    line(image, centerX - 1, eyeY + 5, centerX + 1, eyeY + 5, C.outlineSoft, 1);
    put(image, centerX + 2, eyeY + 4, C.outlineSoft);
  } else if (style === 'focused') {
    line(image, centerX - 2, eyeY + 5, centerX + 2, eyeY + 5, C.outline, 1);
  } else {
    line(image, centerX - 1, eyeY + 5, centerX + 1, eyeY + 5, C.outlineSoft, 1);
  }
  if (style === 'scarred') {
    line(image, centerX + 1, eyeY - 4, centerX + 5, eyeY + 4, '#8f4d4d', 1);
    put(image, centerX + 3, eyeY, C.skinLight);
  }
  if (style === 'freckled') {
    for (const x of [-5, -3, 3, 5]) put(image, centerX + x, eyeY + 3, '#b86e58');
  }
  if (raceId === 'orc') {
    line(image, centerX - 5, eyeY - 3, centerX - 2, eyeY - 2, C.outline, 1);
    line(image, centerX + 2, eyeY - 2, centerX + 5, eyeY - 3, C.outline, 1);
    line(image, centerX - 1, eyeY + 2, centerX + 1, eyeY + 2, C.skinDeep, 2);
    put(image, centerX - 3, eyeY + 5, C.skinLight);
    put(image, centerX + 3, eyeY + 5, C.skinLight);
    put(image, centerX - 3, eyeY + 4, C.outline);
    put(image, centerX + 3, eyeY + 4, C.outline);
  }
  if (raceId === 'dwarf') {
    line(image, centerX - 5, eyeY - 3, centerX - 2, eyeY - 3, C.outlineSoft, 1);
    line(image, centerX + 2, eyeY - 3, centerX + 5, eyeY - 3, C.outlineSoft, 1);
    line(image, centerX - 1, eyeY + 2, centerX + 1, eyeY + 2, C.skinDeep, 2);
    put(image, centerX - 5, eyeY + 3, C.skinShade);
    put(image, centerX + 5, eyeY + 3, C.skinShade);
  }
  if (raceId === 'elf') {
    line(image, centerX - 5, eyeY - 2, centerX - 2, eyeY - 3, C.outline, 1);
    line(image, centerX + 2, eyeY - 3, centerX + 5, eyeY - 2, C.outline, 1);
    put(image, centerX, eyeY - 5, C.goldLight);
  }
  if (raceId === 'undead') {
    put(image, centerX - 3, eyeY, C.eye);
    put(image, centerX + 3, eyeY, C.eye);
    line(image, centerX - 5, eyeY + 3, centerX - 3, eyeY + 5, C.skinDeep, 1);
    line(image, centerX + 5, eyeY + 3, centerX + 3, eyeY + 5, C.skinDeep, 1);
  }
}

function hairCap(image, p, style, raceId = 'human') {
  const profile = Math.abs(p.direction.x) > 0.9;
  const back = p.direction.y < -0.35;
  const side = p.direction.x < 0 ? -1 : 1;
  const x = p.head.x;
  const y = p.head.y;
  if (profile) {
    const rear = -side;
    const rearWidth = raceId === 'dwarf' ? 7.8 : raceId === 'orc' ? 7.2 : raceId === 'undead' ? 6.2 : 7;
    const crown = raceId === 'elf' ? -9.5 : raceId === 'dwarf' ? -8.2 : raceId === 'orc' ? -8.8 : -9;
    const frontReach = raceId === 'undead' ? 4.8 : raceId === 'dwarf' ? 5.4 : 5.8;
    polygon(image, [
      [x + rear * (rearWidth - 0.5), y + 4], [x + rear * rearWidth, y],
      [x + rear * 5.8, y - 5], [x + rear * 2.2, y + crown],
      [x + side * 1.8, y + crown + 0.7], [x + side * frontReach, y - 4],
      [x + side * (frontReach - 0.6), y - 2], [x + side * 1.3, y - 2],
      [x + rear * 2.2, y - 1],
    ], C.outline);
    polygon(image, [
      [x + rear * (rearWidth - 1.5), y + 3], [x + rear * (rearWidth - 1), y],
      [x + rear * 4.9, y - 4], [x + rear * 1.8, y + crown + 1],
      [x + side * 1.5, y + crown + 1.7], [x + side * (frontReach - 1), y - 4],
      [x + side * (frontReach - 1.4), y - 3], [x + side, y - 3],
      [x + rear * 2, y - 2],
    ], C.hair);
    line(image, x + rear * 4, y - 5, x + side, y + crown + 2, C.hairLight, 1);
    line(image, x + rear * (rearWidth - 1), y, x + rear * (rearWidth - 2), y + 4, C.hairShade, 1);
    return;
  }
  if (back) {
    const top = style === 'bun' ? y - 7 : y - 9;
    const longBack = style === 'long' || style === 'side-bangs';
    const lowerSide = longBack ? y + 7 : y + 4;
    const lowerCenter = longBack ? y + 8 : y + 6;
    polygon(image, [
      [x - 7, y + 5], [x - 8, y + 1], [x - 7, y - 4],
      [x - 4, top + 1], [x, top], [x + 4, top + 1], [x + 7, y - 4],
      [x + 8, y + 1], [x + 7, y + 5], [x + 4, lowerSide],
      [x + 2, lowerCenter], [x - 2, lowerCenter], [x - 4, lowerSide],
    ], C.outline);
    polygon(image, [
      [x - 6, y + 4], [x - 7, y + 1], [x - 6, y - 3],
      [x - 3, top + 2], [x, top + 1], [x + 3, top + 2], [x + 6, y - 3],
      [x + 7, y + 1], [x + 6, y + 4], [x + 3, lowerSide - 1],
      [x + 1, lowerCenter - 1], [x - 1, lowerCenter - 1], [x - 3, lowerSide - 1],
    ], C.hair);
    line(image, x - 4, top + 3, x + 2, top + 1, C.hairLight, 1);
    line(image, x + 4, y - 3, x + 5, y + 4, C.hairShade, 1);
    put(image, x - 2, lowerCenter - 1, C.hairDeep);
    put(image, x + 2, lowerCenter - 1, C.hairShade);
    return;
  }
  const lowerEdge = y - 1;
  polygon(image, [
    [x - 8, lowerEdge], [x - 8, y - 3], [x - 5, y - 8],
    [x, y - 10], [x + 5, y - 8], [x + 8, y - 3], [x + 8, lowerEdge],
    [x + 5, y - 3], [x + 2, y - 1],
    [x - 2, y - 1], [x - 5, y - 3],
  ], C.outline);
  polygon(image, [
    [x - 7, lowerEdge - 1], [x - 7, y - 3], [x - 4, y - 7],
    [x, y - 9], [x + 4, y - 7], [x + 7, y - 3], [x + 7, lowerEdge - 1],
    [x + 4, y - 4], [x + 1, y - 2],
    [x - 2, y - 2], [x - 4, y - 4],
  ], C.hair);
  line(image, x - 4, y - 6, x + 2, y - 8, C.hairLight, 1);
}

function drawHair(image, p, body, style, raceId = 'human') {
  const back = p.direction.y < -0.35;
  const profile = Math.abs(p.direction.x) > 0.9;
  const side = p.direction.x < 0 ? -1 : 1;
  if (body === 'female' && ['long', 'side-bangs'].includes(style)) {
    if (back) {
      polygon(image, [
        [p.head.x - 8, p.head.y - 3], [p.head.x - 9, p.head.y + 5],
        [p.head.x - 7, p.head.y + 13], [p.head.x - 3, p.head.y + 11],
        [p.head.x, p.head.y + 14], [p.head.x + 3, p.head.y + 11],
        [p.head.x + 7, p.head.y + 13], [p.head.x + 9, p.head.y + 5],
        [p.head.x + 8, p.head.y - 3],
      ], C.outline);
      polygon(image, [
        [p.head.x - 7, p.head.y - 2], [p.head.x - 8, p.head.y + 5],
        [p.head.x - 6, p.head.y + 11], [p.head.x - 3, p.head.y + 9],
        [p.head.x, p.head.y + 12], [p.head.x + 3, p.head.y + 9],
        [p.head.x + 6, p.head.y + 11], [p.head.x + 8, p.head.y + 5],
        [p.head.x + 7, p.head.y - 2],
      ], C.hair);
      line(image, p.head.x - 5, p.head.y - 1, p.head.x - 4, p.head.y + 10, C.hairLight, 1);
      line(image, p.head.x + 4, p.head.y + 1, p.head.x + 5, p.head.y + 10, C.hairShade, 1);
      line(image, p.head.x, p.head.y - 3, p.head.x, p.head.y + 8, C.hairShade, 1);
      put(image, p.head.x - 6, p.head.y + 11, C.hairDeep);
      put(image, p.head.x, p.head.y + 12, C.hairLight);
      put(image, p.head.x + 6, p.head.y + 11, C.hairDeep);
    } else {
      if (profile) {
        const rear = -side;
        polygon(image, [
          [p.head.x + rear * 4, p.head.y - 3], [p.head.x + rear * 8, p.head.y],
          [p.head.x + rear * 9, p.head.y + 10], [p.head.x + rear * 6, p.head.y + 14],
          [p.head.x + rear * 4, p.head.y + 11], [p.head.x + rear * 5, p.head.y + 1],
        ], C.outline);
        polygon(image, [
          [p.head.x + rear * 4, p.head.y - 2], [p.head.x + rear * 7, p.head.y],
          [p.head.x + rear * 8, p.head.y + 9], [p.head.x + rear * 6, p.head.y + 12],
          [p.head.x + rear * 5, p.head.y + 10], [p.head.x + rear * 5, p.head.y + 1],
        ], C.hair);
        line(image, p.head.x + rear * 6, p.head.y + 1, p.head.x + rear * 6, p.head.y + 10, C.hairLight, 1);
      } else {
        polygon(image, [
          [p.head.x - 8, p.head.y - 3], [p.head.x - 8, p.head.y + 11],
          [p.head.x - 5, p.head.y + 14], [p.head.x - 5, p.head.y + 1],
        ], C.outline);
        polygon(image, [
          [p.head.x - 7, p.head.y - 2], [p.head.x - 7, p.head.y + 10],
          [p.head.x - 6, p.head.y + 12], [p.head.x - 6, p.head.y + 1],
        ], C.hair);
        polygon(image, [
          [p.head.x + 8, p.head.y - 3], [p.head.x + 8, p.head.y + 11],
          [p.head.x + 5, p.head.y + 14], [p.head.x + 5, p.head.y + 1],
        ], C.outline);
        polygon(image, [
          [p.head.x + 7, p.head.y - 2], [p.head.x + 7, p.head.y + 10],
          [p.head.x + 6, p.head.y + 12], [p.head.x + 6, p.head.y + 1],
        ], C.hair);
        line(image, p.head.x - 5, p.head.y + 1, p.head.x - 4, p.head.y + 10, C.hairLight, 1);
      }
    }
  }
  if (style === 'tied' || style === 'ponytail') {
    const rear = profile ? -side : p.direction.x > 0.1 ? -1 : 1;
    const tieX = p.head.x + rear * 6;
    const tieY = p.head.y + (back ? 3 : 1);
    ellipse(image, tieX, tieY, 2, 2, C.outline);
    put(image, tieX, tieY, C.goldDeep);
    polygon(image, [
      [tieX + rear, tieY], [tieX + rear * 4, tieY + 2],
      [tieX + rear * 5, tieY + 7], [tieX + rear * 2, tieY + 11],
      [tieX, tieY + 7], [tieX + rear, tieY + 3],
    ], C.outline);
    polygon(image, [
      [tieX + rear, tieY + 1], [tieX + rear * 3, tieY + 2],
      [tieX + rear * 4, tieY + 6], [tieX + rear * 2, tieY + 9],
      [tieX + rear, tieY + 6],
    ], C.hair);
    line(image, tieX + rear * 2, tieY + 3, tieX + rear * 3, tieY + 7, C.hairLight, 1);
  }
  hairCap(image, p, style, raceId);
  if (style === 'bun') {
    const bunX = p.head.x + (profile ? -side * 3 : -p.direction.x * 2);
    const bunY = p.head.y - 11;
    rect(image, bunX - 1, bunY + 3, 2, 3, C.outline);
    polygon(image, [
      [bunX - 2, bunY - 3], [bunX + 2, bunY - 3],
      [bunX + 4, bunY - 1], [bunX + 4, bunY + 1],
      [bunX + 2, bunY + 3], [bunX - 2, bunY + 3],
      [bunX - 4, bunY + 1], [bunX - 4, bunY - 1],
    ], C.outline);
    polygon(image, [
      [bunX - 2, bunY - 2], [bunX + 2, bunY - 2],
      [bunX + 3, bunY - 1], [bunX + 3, bunY + 1],
      [bunX + 1, bunY + 2], [bunX - 2, bunY + 2],
      [bunX - 3, bunY + 1], [bunX - 3, bunY - 1],
    ], C.hair);
    put(image, bunX - 1, bunY - 1, C.hairLight);
    line(image, bunX + 1, bunY, bunX + 2, bunY + 2, C.hairShade, 1);
    line(image, bunX - 2, bunY + 2, bunX + 2, bunY + 2, C.goldDeep, 1);
  }
  if (profile) {
    const front = side;
    const rear = -side;
    if (style === 'cropped') {
      line(image, p.head.x + rear * 5, p.head.y + 1, p.head.x + rear * 3, p.head.y + 4, C.hairShade, 1);
    } else if (style === 'side-bangs') {
      line(image, p.head.x + front * 3, p.head.y - 5, p.head.x + front * 4, p.head.y + 1, C.outline, 3);
      line(image, p.head.x + front * 3, p.head.y - 5, p.head.x + front * 4, p.head.y, C.hair, 1);
    } else if (style === 'long') {
      line(image, p.head.x + rear * 5, p.head.y + 1, p.head.x + rear * 6, p.head.y + 10, C.hairShade, 1);
    } else if (style === 'bun') {
      put(image, p.head.x + rear * 5, p.head.y - 1, C.hairLight);
    }
  }
  if (back) {
    if (style === 'cropped') {
      put(image, p.head.x - 3, p.head.y + 4, C.hairShade);
      line(image, p.head.x - 1, p.head.y + 5, p.head.x + 1, p.head.y + 5, C.hairDeep, 1);
    } else if (style === 'windswept') {
      polygon(image, [
        [p.head.x + 5, p.head.y - 5], [p.head.x + 10, p.head.y - 4],
        [p.head.x + 7, p.head.y - 1],
      ], C.outline);
      line(image, p.head.x + 6, p.head.y - 4, p.head.x + 8, p.head.y - 4, C.hair, 1);
    } else if (style === 'tousled') {
      put(image, p.head.x - 5, p.head.y + 2, C.hairLight);
      put(image, p.head.x + 4, p.head.y + 3, C.hairDeep);
    } else if (style === 'side-bangs') {
      line(image, p.head.x - 4, p.head.y - 4, p.head.x - 5, p.head.y + 8, C.hairLight, 1);
      line(image, p.head.x + 2, p.head.y - 6, p.head.x + 4, p.head.y + 7, C.hairShade, 1);
    } else if (style === 'bun') {
      put(image, p.head.x - 2, p.head.y - 12, C.hairLight);
    } else if (style === 'ponytail') {
      polygon(image, [
        [p.head.x - 3, p.head.y + 3], [p.head.x + 3, p.head.y + 3],
        [p.head.x + 4, p.head.y + 7], [p.head.x + 2, p.head.y + 13],
        [p.head.x, p.head.y + 15], [p.head.x - 2, p.head.y + 13],
        [p.head.x - 4, p.head.y + 7],
      ], C.outline);
      polygon(image, [
        [p.head.x - 2, p.head.y + 4], [p.head.x + 2, p.head.y + 4],
        [p.head.x + 3, p.head.y + 7], [p.head.x + 1, p.head.y + 12],
        [p.head.x, p.head.y + 13], [p.head.x - 1, p.head.y + 12],
        [p.head.x - 3, p.head.y + 7],
      ], C.hair);
      line(image, p.head.x - 1, p.head.y + 5, p.head.x, p.head.y + 11, C.hairLight, 1);
      line(image, p.head.x + 2, p.head.y + 6, p.head.x + 1, p.head.y + 11, C.hairShade, 1);
    }
  }
  if (!back && !profile) {
    polygon(image, [
      [p.head.x - 7, p.head.y - 3], [p.head.x - 5, p.head.y - 1],
      [p.head.x - 3, p.head.y - 3], [p.head.x - 1, p.head.y - 1],
      [p.head.x + 1, p.head.y - 3], [p.head.x + 3, p.head.y - 1],
      [p.head.x + 7, p.head.y - 3], [p.head.x + 5, p.head.y - 6],
      [p.head.x - 5, p.head.y - 6],
    ], C.hair);
    line(image, p.head.x - 5, p.head.y - 5, p.head.x + 2, p.head.y - 7, C.hairLight, 1);
    if (style === 'windswept' || style === 'side-bangs') {
      const bangSide = p.direction.x > 0.1 ? -1 : p.direction.x < -0.1 ? 1 : -1;
      line(image, p.head.x + bangSide * 5, p.head.y - 4, p.head.x + bangSide * 6, p.head.y + 3, C.outline, 3);
      line(image, p.head.x + bangSide * 5, p.head.y - 4, p.head.x + bangSide * 6, p.head.y + 3, C.hair, 1);
      put(image, p.head.x + bangSide * 5, p.head.y - 4, C.hairLight);
    }
  }
  if (style === 'tousled' || style === 'windswept') {
    // Restrained layered tufts replace the old tall spikes/top-knot shapes.
    const sweep = style === 'windswept' ? (profile ? side : 1) : -1;
    const tufts = profile ? [[-side * 3, -7], [side, -8]] : [[-4, -7], [0, -8], [4, -7]];
    for (const [x, y] of tufts) {
      polygon(image, [
        [p.head.x + x - 2, p.head.y + y + 3],
        [p.head.x + x + sweep, p.head.y + y],
        [p.head.x + x + 2, p.head.y + y + 3],
      ], C.outline);
      line(image, p.head.x + x - 1, p.head.y + y + 2, p.head.x + x + sweep, p.head.y + y + 1, C.hair, 2);
    }
  }
  if (raceId === 'elf' && !back) {
    const lockSide = profile ? -side : -1;
    line(image, p.head.x + lockSide * 6, p.head.y + 1, p.head.x + lockSide * 7, p.head.y + 8, C.outline, 3);
    line(image, p.head.x + lockSide * 6, p.head.y + 1, p.head.x + lockSide * 7, p.head.y + 8, C.hair, 1);
    put(image, p.head.x + lockSide * 7, p.head.y + 6, C.gold);
    const crownStart = profile ? p.head.x - side * 4 : p.head.x - 5;
    const crownEnd = profile ? p.head.x + side * 3 : p.head.x + 5;
    line(image, crownStart, p.head.y - 4, crownEnd, p.head.y - 4, C.goldDeep, 1);
    put(image, profile ? p.head.x + side : p.head.x, p.head.y - 4, C.goldLight);
    if (style === 'tied' || style === 'ponytail') {
      const braidX = p.head.x + (profile ? -side * 6 : 5);
      for (let offset = 4; offset <= 10; offset += 2) {
        put(image, braidX + (offset % 4 === 0 ? -1 : 1), p.head.y + offset, offset === 8 ? C.gold : C.hairLight);
      }
    }
  }
  if (raceId === 'dwarf' && body === 'male' && !back) {
    const offset = profile ? side * 1.5 : 0;
    line(image, p.head.x - 6 + offset, p.head.y + 1, p.head.x - 5 + offset, p.head.y + 5, C.hairShade, 2);
    line(image, p.head.x + 6 + offset, p.head.y + 1, p.head.x + 5 + offset, p.head.y + 5, C.hairDeep, 2);
    if (style === 'tied') {
      const braidX = p.head.x + (profile ? -side * 6 : 6);
      line(image, braidX, p.head.y + 2, braidX, p.head.y + 10, C.outline, 3);
      for (let offsetY = 3; offsetY <= 9; offsetY += 2) put(image, braidX, p.head.y + offsetY, C.hairLight);
      put(image, braidX, p.head.y + 7, C.gold);
    }
  }
  if (raceId === 'dwarf' && back) {
    line(image, p.head.x - 5, p.head.y - 4, p.head.x + 5, p.head.y - 4, C.hairLight, 2);
    put(image, p.head.x - 4, p.head.y - 4, C.goldDeep);
    put(image, p.head.x + 4, p.head.y - 4, C.goldDeep);
  }
  if (raceId === 'orc') {
    const crestSide = profile ? side : 0;
    if (style === 'cropped') {
      line(image, p.head.x - 3 + crestSide, p.head.y - 7, p.head.x + 3 + crestSide, p.head.y - 7, C.hairDeep, 2);
    } else if (style === 'windswept' || style === 'tousled') {
      const points = profile ? [-3, 0, 3] : [-5, -2, 1, 4];
      for (const offsetX of points) {
        polygon(image, [
          [p.head.x + offsetX - 2, p.head.y - 6],
          [p.head.x + offsetX + (profile ? side * 2 : 1), p.head.y - 11],
          [p.head.x + offsetX + 2, p.head.y - 6],
        ], C.outline);
        line(image, p.head.x + offsetX - 1, p.head.y - 7, p.head.x + offsetX + (profile ? side : 0), p.head.y - 9, C.hair, 2);
      }
    }
    put(image, p.head.x + (profile ? -side * 5 : -6), p.head.y - 2, C.goldDeep);
  }
  if (raceId === 'undead') {
    const streakX = p.head.x + (profile ? -side * 3 : 2);
    line(image, streakX, p.head.y - 7, streakX + (profile ? side : 1), p.head.y - 3, C.hairDeep, 1);
    const raggedSide = profile ? -side : -1;
    polygon(image, [
      [p.head.x + raggedSide * 5, p.head.y - 5],
      [p.head.x + raggedSide * 9, p.head.y - 2],
      [p.head.x + raggedSide * 6, p.head.y + 1],
    ], C.outline);
    line(image, p.head.x + raggedSide * 5, p.head.y - 4, p.head.x + raggedSide * 7, p.head.y - 2, C.hairShade, 1);
  }
}

function drawBeard(image, p, style) {
  if (p.direction.y < -0.35) return;
  const side = p.direction.x * 1.2;
  if (style === 'short') {
    line(image, p.head.x - 4 + side, p.head.y + 5, p.head.x + 4 + side, p.head.y + 5, C.hairDeep, 2);
    put(image, p.head.x + side, p.head.y + 7, C.hairShade);
  } else {
    polygon(image, [
      [p.head.x - 5 + side, p.head.y + 4], [p.head.x + 5 + side, p.head.y + 4],
      [p.head.x + 3 + side, p.head.y + 10], [p.head.x + side, p.head.y + 12],
      [p.head.x - 3 + side, p.head.y + 10],
    ], C.outline);
    polygon(image, [
      [p.head.x - 4 + side, p.head.y + 5], [p.head.x + 4 + side, p.head.y + 5],
      [p.head.x + 2 + side, p.head.y + 9], [p.head.x + side, p.head.y + 10],
      [p.head.x - 2 + side, p.head.y + 9],
    ], C.hair);
    line(image, p.head.x - 2 + side, p.head.y + 6, p.head.x + side, p.head.y + 9, C.hairLight, 1);
  }
}

function drawCape(image, p, style) {
  const long = style === 'long';
  const bottom = long ? 45 : 39;
  const profile = Math.abs(p.direction.x) > 0.9;
  const back = p.direction.y < -0.35;
  const sway = p.walkIndex >= 0 ? -p.step * 2 : 0;
  const capeMain = '#7f1d1d';
  const capeLight = '#b92d26';
  const capeShade = '#3f1210';
  if (profile) {
    const side = p.direction.x < 0 ? -1 : 1;
    const rear = -side;
    const topX = p.root.x + rear * 3;
    const bottomX = p.root.x + rear * (long ? 8 : 6) + sway;
    polygon(image, [
      [p.root.x + rear, 22 + p.root.y], [topX + rear * 3, 24 + p.root.y],
      [bottomX + rear * 2, bottom - 2 + p.root.y], [bottomX, bottom + p.root.y],
      [bottomX - rear * 2, bottom - 2 + p.root.y], [topX - rear, 25 + p.root.y],
    ], C.outline);
    polygon(image, [
      [p.root.x + rear * 2, 23 + p.root.y], [topX + rear * 2, 25 + p.root.y],
      [bottomX + rear, bottom - 3 + p.root.y], [bottomX, bottom - 1 + p.root.y],
      [bottomX - rear, bottom - 3 + p.root.y], [topX, 25 + p.root.y],
    ], capeMain);
    line(image, topX + rear, 26 + p.root.y, bottomX, bottom - 4 + p.root.y, capeLight, 1);
    line(image, topX - rear, 26 + p.root.y, bottomX - rear, bottom - 4 + p.root.y, capeShade, 1);
    ellipse(image, p.root.x + rear * 3, 23 + p.root.y, 1.8, 1.8, C.outline);
    put(image, p.root.x + rear * 3, 23 + p.root.y, C.gold);
    return;
  }
  const halfWidth = long ? (back ? 11 : 10) : (back ? 9 : 8);
  const bottomCenter = p.root.x + sway;
  polygon(image, [
    [p.root.x - (back ? 8 : 7), 22 + p.root.y], [p.root.x + (back ? 8 : 7), 22 + p.root.y],
    [bottomCenter + halfWidth, bottom - 1 + p.root.y],
    [bottomCenter + Math.floor(halfWidth / 2), bottom + p.root.y],
    [bottomCenter, bottom - 2 + p.root.y],
    [bottomCenter - Math.floor(halfWidth / 2), bottom + p.root.y],
    [bottomCenter - halfWidth, bottom - 1 + p.root.y],
  ], C.outline);
  polygon(image, [
    [p.root.x - 7, 23 + p.root.y], [p.root.x + 7, 23 + p.root.y],
    [bottomCenter + halfWidth - 1, bottom - 2 + p.root.y],
    [bottomCenter + Math.floor(halfWidth / 2), bottom - 1 + p.root.y],
    [bottomCenter, bottom - 3 + p.root.y],
    [bottomCenter - Math.floor(halfWidth / 2), bottom - 1 + p.root.y],
    [bottomCenter - halfWidth + 1, bottom - 2 + p.root.y],
  ], capeMain);
  line(image, p.root.x - 5, 25 + p.root.y, bottomCenter - 4, bottom - 4 + p.root.y, capeLight, 1);
  line(image, p.root.x + 4, 25 + p.root.y, bottomCenter + 3, bottom - 5 + p.root.y, capeShade, 1);
  if (back) {
    line(image, p.root.x, 24 + p.root.y, bottomCenter, bottom - 3 + p.root.y, '#5a1715', 1);
    line(image, p.root.x - 4, 24 + p.root.y, p.root.x + 4, 24 + p.root.y, C.goldDeep, 1);
  }
  ellipse(image, p.root.x - 5, 23 + p.root.y, 1.8, 1.8, C.outline);
  ellipse(image, p.root.x + 5, 23 + p.root.y, 1.8, 1.8, C.outline);
  put(image, p.root.x - 5, 23 + p.root.y, C.gold);
  put(image, p.root.x + 5, 23 + p.root.y, C.gold);
}

function drawBoot(image, hip, foot) {
  outlinedLine(image, hip, { x: foot.x, y: foot.y - 1 }, C.boot, 3);
  ellipse(image, foot.x, foot.y, 3, 1.8, C.outline);
  rect(image, foot.x - 2, foot.y - 1, 4, 2, C.boot);
  put(image, foot.x - 1, foot.y - 1, C.bootLight);
}

function drawProfileOutfit(image, p, classId, body, variant, raceId, palette) {
  const facing = Math.sign(p.direction.x) || 1;
  const rear = -facing;
  const wide = p.anatomy.torsoBonus;
  const frontX = p.root.x + facing * (4.4 + wide * 0.55);
  const backX = p.root.x + rear * (3.4 + wide * 0.45);
  const waistFront = p.root.x + facing * (3.2 + wide * 0.4);
  const waistBack = p.root.x + rear * (2.5 + wide * 0.35);
  const topY = 22 + p.root.y;
  const waistY = 35 + p.root.y;
  const hemY = 39 + p.root.y;
  const armor = classId === 'paladin' || classId === 'warrior';
  const farShoulder = p.shoulderRight;
  const farHand = p.handRight;
  const nearShoulder = p.shoulderLeft;
  const nearHand = p.handLeft;

  drawBoot(image, p.hipRight, p.footRight);
  drawBoot(image, p.hipLeft, p.footLeft);
  outlinedLine(image, farShoulder, farHand, palette.shade, armor ? 4 : 3);
  polygon(image, [
    [backX, topY + 2], [p.root.x + rear * 1.2, topY], [frontX, topY + 2],
    [waistFront, waistY], [p.root.x + facing * 2.1, hemY],
    [p.root.x + rear * 2.2, hemY - 1], [waistBack, waistY],
  ], C.outline);
  polygon(image, [
    [backX + facing, topY + 3], [p.root.x + rear, topY + 1], [frontX - facing, topY + 3],
    [waistFront - facing, waistY - 1], [p.root.x + facing * 1.5, hemY - 2],
    [p.root.x + rear * 1.6, hemY - 2], [waistBack + facing, waistY - 1],
  ], palette.main);
  line(image, backX + facing, topY + 4, waistBack + facing, waistY - 2, palette.shade, 1);
  line(image, frontX - facing, topY + 4, waistFront - facing, waistY - 3, palette.light, 1);

  line(image, waistBack, waistY - 3, waistFront, waistY - 3, C.outline, 3);
  line(image, waistBack + facing, waistY - 3, waistFront - facing, waistY - 3, palette.accentDeep, 1);
  rect(image, p.root.x + facing - 1, waistY - 4, 3, 3, C.outline);
  put(image, p.root.x + facing, waistY - 3, palette.accentLight);

  if (classId === 'mage' || classId === 'priest') {
    const robeLength = variant === 'runed' ? 46 : variant === 'veteran' ? 45 : 44;
    const flare = variant === 'veteran' ? 5.5 : 4.5;
    const robeFront = p.root.x + facing * flare;
    const robeBack = p.root.x + rear * (3.5 + wide * 0.3);
    polygon(image, [
      [waistBack, 34 + p.root.y], [waistFront, 34 + p.root.y],
      [robeFront, robeLength + p.root.y], [p.root.x + facing, robeLength - 1 + p.root.y],
      [p.root.x + rear * 1.5, robeLength + p.root.y], [robeBack, robeLength - 2 + p.root.y],
    ], C.outline);
    polygon(image, [
      [waistBack + facing, 35 + p.root.y], [waistFront - facing, 35 + p.root.y],
      [robeFront - facing, robeLength - 1 + p.root.y], [p.root.x + facing, robeLength - 2 + p.root.y],
      [p.root.x + rear, robeLength - 1 + p.root.y], [robeBack + facing, robeLength - 3 + p.root.y],
    ], palette.main);
    line(image, p.root.x + facing, 35 + p.root.y, p.root.x + facing * 1.8, robeLength - 2 + p.root.y, palette.accent, 1);
  }

  if (classId === 'mage' || classId === 'priest') {
    polygon(image, [
      [backX, topY + 1], [p.root.x + rear, topY - 2], [p.root.x + facing * 2, topY + 3],
      [frontX, topY + 1], [p.root.x + facing * 3, topY + 6], [p.root.x, topY + 4],
    ], palette.deep);
    line(image, p.root.x + facing, topY + 2, p.root.x + facing * 2, topY + 8, palette.accentLight, 1);
  } else if (classId === 'hunter') {
    line(image, backX, topY + 2, waistFront, waistY - 1, palette.accent, 2);
    const quiverX = p.root.x + rear * (4.5 + wide * 0.2);
    polygon(image, [
      [quiverX + rear * 2, topY + 2], [quiverX + facing, topY + 1],
      [quiverX + facing, waistY + 4], [quiverX + rear, waistY + 5],
    ], C.outline);
    line(image, quiverX, topY + 3, quiverX, waistY + 3, palette.accentDeep, 2);
    for (const offset of [-1, 1]) {
      line(image, quiverX + offset, topY + 2, quiverX + offset + rear, topY - 4, C.woodLight, 1);
      put(image, quiverX + offset + rear, topY - 5, C.metalLight);
    }
  } else if (classId === 'rogue') {
    line(image, backX, topY + 3, waistFront, waistY - 1, palette.accent, 1);
    rect(image, p.root.x + rear * 3 - 1, waistY - 1, 4, 4, C.outline);
    rect(image, p.root.x + rear * 3, waistY, 2, 2, palette.accentDeep);
  } else if (armor) {
    ellipse(image, nearShoulder.x, nearShoulder.y, 4.5 + wide * 0.25, 3, C.outline);
    ellipse(image, nearShoulder.x, nearShoulder.y, 3.3 + wide * 0.2, 2, palette.accent);
    polygon(image, [
      [p.root.x + rear * 2, topY + 3], [p.root.x + facing * 2.5, topY + 2],
      [waistFront - facing, waistY - 4], [p.root.x + rear, waistY - 2],
    ], palette.accentDeep);
    line(image, p.root.x + facing, topY + 4, p.root.x + facing, waistY - 5, palette.accentLight, 1);
  }

  if (variant === 'veteran') {
    line(image, backX, topY + 6, frontX - facing, topY + 6, palette.accentLight, 2);
    put(image, p.root.x + facing * 2, topY + 6, palette.light);
  } else if (variant === 'runed') {
    polygon(image, [
      [p.root.x + facing, topY + 5], [p.root.x + facing * 3, topY + 8],
      [p.root.x + facing, topY + 11], [p.root.x + rear, topY + 8],
    ], palette.accentLight);
  } else if (variant === 'dark') {
    polygon(image, [
      [backX, topY + 2], [frontX, topY + 2], [waistFront, waistY],
      [p.root.x + facing, waistY - 2], [waistBack, waistY + 3],
    ], palette.deep);
    line(image, frontX - facing, topY + 4, waistFront - facing, waistY - 2, palette.accent, 1);
  }

  if (raceId === 'elf') {
    line(image, p.root.x + rear, topY + 4, p.root.x + facing * 2, waistY - 5, palette.accentLight, 1);
    put(image, p.root.x + facing * 2, waistY - 6, C.goldLight);
  } else if (raceId === 'dwarf') {
    line(image, backX, topY + 7, frontX, topY + 7, palette.accentLight, 2);
    line(image, backX + facing, topY + 10, frontX - facing, topY + 10, palette.deep, 2);
    for (const offset of [-2, 2]) put(image, p.root.x + facing * offset, topY + 7, C.gold);
  } else if (raceId === 'orc') {
    line(image, backX, topY + 3, waistFront, waistY - 4, C.woodDeep, 2);
    put(image, frontX, topY, palette.accentLight);
    put(image, frontX + facing, topY - 1, C.outline);
  } else if (raceId === 'undead') {
    line(image, backX + facing, topY + 5, frontX - facing, topY + 9, palette.accentLight, 1);
    put(image, waistBack, waistY + 2, palette.deep);
    put(image, waistFront, waistY + 1, palette.shade);
  } else {
    line(image, p.root.x + rear, topY + 4, p.root.x + facing, waistY - 5, palette.accentLight, 1);
  }

  outlinedLine(image, nearShoulder, nearHand, palette.main, armor ? 4 : 3);
  ellipse(image, nearHand.x, nearHand.y - 1.5, 2.7, 2.2, C.outline);
  ellipse(image, nearHand.x, nearHand.y - 1.5, 1.7, 1.2, palette.accent);
  put(image, nearHand.x - facing, nearHand.y - 2, palette.accentLight);
}

function drawRaceOutfitDetails(image, p, raceId, palette, classId, back) {
  const y = p.root.y;
  if (raceId === 'elf') {
    const glow = classId === 'hunter' || classId === 'rogue' ? palette.accentLight : C.goldLight;
    line(image, p.root.x - 4, 25 + y, p.root.x, 30 + y, glow, 1);
    line(image, p.root.x + 4, 25 + y, p.root.x, 30 + y, glow, 1);
    if (!back) polygon(image, [[p.root.x, 29 + y], [p.root.x + 2, 32 + y], [p.root.x, 34 + y], [p.root.x - 2, 32 + y]], glow);
  } else if (raceId === 'dwarf') {
    line(image, p.root.x - 7, 25 + y, p.root.x + 7, 25 + y, palette.accentLight, 2);
    line(image, p.root.x - 7, 29 + y, p.root.x + 7, 29 + y, palette.deep, 2);
    for (const x of [-5, 0, 5]) put(image, p.root.x + x, 25 + y, C.gold);
    rect(image, p.root.x - 3, 32 + y, 6, 3, C.outline);
    rect(image, p.root.x - 2, 32 + y, 4, 2, palette.accent);
  } else if (raceId === 'orc') {
    line(image, p.root.x - 6, 23 + y, p.root.x + 5, 34 + y, C.woodDeep, 2);
    polygon(image, [[p.root.x - 8, 23 + y], [p.root.x - 5, 19 + y], [p.root.x - 3, 24 + y]], C.outline);
    line(image, p.root.x - 6, 22 + y, p.root.x - 5, 20 + y, palette.accentLight, 1);
  } else if (raceId === 'undead') {
    line(image, p.root.x - 5, 27 + y, p.root.x + 4, 31 + y, palette.accentLight, 1);
    for (const x of [-5, -1, 4]) put(image, p.root.x + x, 38 + y + (x % 2), palette.deep);
  } else if (!back) {
    line(image, p.root.x, 25 + y, p.root.x, 31 + y, palette.accentLight, 1);
    put(image, p.root.x - 2, 27 + y, palette.light);
    put(image, p.root.x + 2, 27 + y, palette.shade);
  }
}

function drawOutfit(image, p, classId, body, variant, raceId = 'human') {
  const palette = CLASS_PALETTES[classId];
  const waist = (body === 'female' ? 4.6 : 5.3) + p.anatomy.torsoBonus * 0.6;
  const profile = Math.abs(p.direction.x) > 0.9;
  const back = p.direction.y < -0.35;
  if (profile) {
    drawProfileOutfit(image, p, classId, body, variant, raceId, palette);
    return;
  }
  const torsoHalf = 6 + p.anatomy.torsoBonus;
  const turn = p.direction.x;
  const torsoCenter = p.root.x + turn * 0.9;
  const rearInset = Math.abs(turn) * 0.8;
  const torsoLeft = torsoCenter - torsoHalf + (turn > 0 ? rearInset : 0);
  const torsoRight = torsoCenter + torsoHalf - (turn < 0 ? rearInset : 0);
  const waistLeft = p.root.x - waist + (turn > 0 ? rearInset * 0.6 : 0);
  const waistRight = p.root.x + waist - (turn < 0 ? rearInset * 0.6 : 0);
  drawBoot(image, p.hipLeft, p.footLeft);
  drawBoot(image, p.hipRight, p.footRight);
  const farLeft = p.direction.x >= 0 ? p.shoulderRight : p.shoulderLeft;
  const farHand = p.direction.x >= 0 ? p.handRight : p.handLeft;
  outlinedLine(image, farLeft, farHand, palette.shade, classId === 'paladin' || classId === 'warrior' ? 4 : 3);
  polygon(image, [
    [torsoLeft, 22 + p.root.y], [torsoRight, 22 + p.root.y],
    [waistRight, 35 + p.root.y], [p.root.x + 4 + turn, 39 + p.root.y],
    [p.root.x - 4 + turn, 39 + p.root.y], [waistLeft, 35 + p.root.y],
  ], C.outline);
  polygon(image, [
    [torsoLeft + 1, 23 + p.root.y], [torsoRight - 1, 23 + p.root.y],
    [waistRight - 1, 34 + p.root.y], [p.root.x + 3 + turn, 37 + p.root.y],
    [p.root.x - 3 + turn, 37 + p.root.y], [waistLeft + 1, 34 + p.root.y],
  ], palette.main);
  if (back) {
    line(image, p.root.x, 24 + p.root.y, p.root.x, 32 + p.root.y, palette.shade, 1);
    line(image, p.root.x - 4, 24 + p.root.y, p.root.x + 4, 24 + p.root.y, palette.light, 1);
    put(image, p.root.x - 3, 27 + p.root.y, palette.light);
    put(image, p.root.x + 3, 27 + p.root.y, palette.shade);
  } else {
    rect(image, p.root.x - 4, 24 + p.root.y, 2, 10, palette.light);
  }
  rect(image, p.root.x - 5, 32 + p.root.y, 10, 3, C.outline);
  rect(image, p.root.x - 4, 32 + p.root.y, 8, 1, palette.accentDeep);
  if (back) {
    put(image, p.root.x - 4, 33 + p.root.y, palette.accentLight);
    put(image, p.root.x + 3, 33 + p.root.y, palette.accentDeep);
  } else {
    rect(image, p.root.x - 1, 32 + p.root.y, 2, 3, palette.accent);
    put(image, p.root.x, 32 + p.root.y, palette.accentLight);
  }
  const nearLeft = p.direction.x >= 0 ? p.shoulderLeft : p.shoulderRight;
  const nearHand = p.direction.x >= 0 ? p.handLeft : p.handRight;
  outlinedLine(image, nearLeft, nearHand, palette.main, classId === 'paladin' || classId === 'warrior' ? 4 : 3);
  for (const hand of [p.handLeft, p.handRight]) {
    ellipse(image, hand.x, hand.y - 1.5, 2.7, 2.2, C.outline);
    ellipse(image, hand.x, hand.y - 1.5, 1.8, 1.3, classId === 'hunter' || classId === 'rogue' ? palette.accentDeep : palette.accent);
    put(image, hand.x - 1, hand.y - 2, palette.accentLight);
  }

  if (classId === 'mage') {
    polygon(image, [
      [p.root.x - 7, 22 + p.root.y], [p.root.x - 3, 20 + p.root.y],
      [p.root.x, 24 + p.root.y], [p.root.x + 3, 20 + p.root.y],
      [p.root.x + 7, 22 + p.root.y], [p.root.x + 5, 27 + p.root.y],
      [p.root.x, 25 + p.root.y], [p.root.x - 5, 27 + p.root.y],
    ], C.outline);
    polygon(image, [
      [p.root.x - 6, 22 + p.root.y], [p.root.x - 3, 21 + p.root.y],
      [p.root.x, 25 + p.root.y], [p.root.x + 3, 21 + p.root.y],
      [p.root.x + 6, 22 + p.root.y], [p.root.x + 4, 25 + p.root.y],
      [p.root.x, 24 + p.root.y], [p.root.x - 4, 25 + p.root.y],
    ], palette.deep);
    if (back) {
      line(image, p.root.x - 4, 25 + p.root.y, p.root.x, 29 + p.root.y, palette.light, 1);
      line(image, p.root.x + 4, 25 + p.root.y, p.root.x, 29 + p.root.y, palette.shade, 1);
      line(image, p.root.x, 29 + p.root.y, p.root.x, 37 + p.root.y, palette.accentDeep, 1);
    } else {
      ellipse(image, p.root.x, 25 + p.root.y, 2.2, 2.2, C.outline);
      ellipse(image, p.root.x, 25 + p.root.y, 1.2, 1.2, palette.accentLight);
      line(image, p.root.x - 4, 28 + p.root.y, p.root.x - 2, 37 + p.root.y, palette.accent, 1);
      line(image, p.root.x + 4, 28 + p.root.y, p.root.x + 2, 37 + p.root.y, palette.accentDeep, 1);
    }
  }

  if (['mage', 'priest'].includes(classId)) {
    const robeShift = -p.direction.x * 2;
    const robeWidth = profile ? 6 : variant === 'veteran' ? 9 : variant === 'runed' ? 8 : 7;
    const robeBottom = variant === 'runed' ? 45 : variant === 'veteran' ? 44 : 43;
    const robeOuter = [
      [p.root.x - 5, 34 + p.root.y], [p.root.x + 5, 34 + p.root.y],
      [p.root.x + robeShift + robeWidth, robeBottom + p.root.y],
      [p.root.x + robeShift + 2, robeBottom - 2 + p.root.y],
      [p.root.x + robeShift, robeBottom + 1 + p.root.y],
      [p.root.x + robeShift - 2, robeBottom - 2 + p.root.y],
      [p.root.x + robeShift - robeWidth, robeBottom + p.root.y],
    ];
    polygon(image, robeOuter, C.outline);
    polygon(image, robeOuter.map(([x, y], index) => [
      x + (index === 2 ? -1 : index === 6 ? 1 : 0),
      y + (index < 2 ? 1 : -1),
    ]), palette.main);
    line(image, p.root.x, 35 + p.root.y, p.root.x + robeShift, robeBottom - 1 + p.root.y, back ? palette.shade : palette.accent, 1);
    line(image, p.root.x - 4, 37 + p.root.y, p.root.x + robeShift - robeWidth + 2, robeBottom - 2 + p.root.y, back ? palette.shade : palette.light, 1);
    if (back) {
      line(image, p.root.x + 4, 37 + p.root.y, p.root.x + robeShift + robeWidth - 2, robeBottom - 2 + p.root.y, palette.deep, 1);
    }
  }
  if (classId === 'hunter') {
    polygon(image, [
      [p.root.x - 7, 22 + p.root.y], [p.root.x, 20 + p.root.y],
      [p.root.x + 7, 22 + p.root.y], [p.root.x + 4, 27 + p.root.y],
      [p.root.x, 25 + p.root.y], [p.root.x - 4, 27 + p.root.y],
    ], palette.deep);
    const quiverSide = profile ? -Math.sign(p.direction.x) : p.direction.x < -0.1 ? -1 : 1;
    const quiverX = p.root.x + quiverSide * (profile ? 5 : 7);
    const strapTopX = p.root.x - quiverSide * 5;
    const strapBottomX = p.root.x + quiverSide * 5;
    line(image, strapTopX, 24 + p.root.y, strapBottomX, 35 + p.root.y, back ? palette.accentDeep : palette.accent, 2);
    rect(image, p.root.x + quiverSide * 4 - 1, 35 + p.root.y, 3, 6, palette.accentDeep);
    rect(image, quiverX - 2, 22 + p.root.y, 4, 9, C.outline);
    rect(image, quiverX - 1, 23 + p.root.y, 2, 8, palette.accentDeep);
    for (const offset of [-1, 1, 3]) {
      const arrowX = quiverX + quiverSide * Math.floor(offset / 2);
      line(image, quiverX, 23 + p.root.y, arrowX, 18 + p.root.y, C.woodLight, 1);
      put(image, arrowX, 17 + p.root.y, C.metalLight);
    }
    if (back) line(image, p.root.x - 5, 27 + p.root.y, p.root.x + 5, 27 + p.root.y, palette.light, 1);
  }
  if (classId === 'rogue') {
    polygon(image, [
      [p.root.x - 7, 22 + p.root.y], [p.root.x - 3, 20 + p.root.y],
      [p.root.x, 23 + p.root.y], [p.root.x + 3, 20 + p.root.y],
      [p.root.x + 7, 22 + p.root.y], [p.root.x + 4, 26 + p.root.y],
      [p.root.x, 24 + p.root.y], [p.root.x - 4, 26 + p.root.y],
    ], palette.deep);
    line(image, p.root.x - 5, 24 + p.root.y, p.root.x + 5, 34 + p.root.y, palette.accent, 1);
    line(image, p.root.x + 5, 24 + p.root.y, p.root.x - 5, 34 + p.root.y, palette.accentDeep, 1);
    rect(image, p.root.x - 6, 34 + p.root.y, 4, 4, C.outline);
    rect(image, p.root.x - 5, 35 + p.root.y, 2, 2, palette.accentDeep);
    rect(image, p.root.x + 2, 34 + p.root.y, 4, 4, C.outline);
    rect(image, p.root.x + 3, 35 + p.root.y, 2, 2, palette.accentDeep);
  }
  if (classId === 'paladin' || classId === 'warrior') {
    for (const shoulder of [p.shoulderLeft, p.shoulderRight]) {
      ellipse(image, shoulder.x, shoulder.y, 4, 3, C.outline);
      ellipse(image, shoulder.x, shoulder.y, 3, 2, palette.accent);
      put(image, shoulder.x - 1, shoulder.y - 1, palette.accentLight);
    }
    if (back) {
      polygon(image, [
        [p.root.x - 4, 24 + p.root.y], [p.root.x + 4, 24 + p.root.y],
        [p.root.x + 3, 31 + p.root.y], [p.root.x, 33 + p.root.y], [p.root.x - 3, 31 + p.root.y],
      ], palette.accentDeep);
      line(image, p.root.x - 3, 25 + p.root.y, p.root.x + 3, 25 + p.root.y, palette.accentLight, 1);
      line(image, p.root.x, 26 + p.root.y, p.root.x, 31 + p.root.y, palette.shade, 1);
      for (const x of [-3, 3]) put(image, p.root.x + x, 29 + p.root.y, palette.accentLight);
    } else {
      polygon(image, [
        [p.root.x - 4, 24 + p.root.y], [p.root.x, 22 + p.root.y],
        [p.root.x + 4, 24 + p.root.y], [p.root.x + 3, 31 + p.root.y],
        [p.root.x, 33 + p.root.y], [p.root.x - 3, 31 + p.root.y],
      ], palette.accentDeep);
      polygon(image, [
        [p.root.x - 3, 25 + p.root.y], [p.root.x, 23 + p.root.y],
        [p.root.x + 3, 25 + p.root.y], [p.root.x + 2, 30 + p.root.y],
        [p.root.x, 31 + p.root.y], [p.root.x - 2, 30 + p.root.y],
      ], palette.accent);
      put(image, p.root.x - 1, 25 + p.root.y, palette.accentLight);
      if (classId === 'warrior') {
        rect(image, p.root.x - 5, 30 + p.root.y, 10, 2, C.outline);
        rect(image, p.root.x - 4, 30 + p.root.y, 8, 1, palette.deep);
      } else {
        line(image, p.root.x, 25 + p.root.y, p.root.x, 31 + p.root.y, palette.accentLight, 1);
        line(image, p.root.x - 2, 27 + p.root.y, p.root.x + 2, 27 + p.root.y, palette.accentLight, 1);
      }
    }
  }
  if (classId === 'priest') {
    polygon(image, [
      [p.root.x - 7, 22 + p.root.y], [p.root.x - 3, 20 + p.root.y],
      [p.root.x, 24 + p.root.y], [p.root.x + 3, 20 + p.root.y],
      [p.root.x + 7, 22 + p.root.y], [p.root.x + 4, 27 + p.root.y],
      [p.root.x, 25 + p.root.y], [p.root.x - 4, 27 + p.root.y],
    ], palette.shade);
    if (back) {
      line(image, p.root.x - 4, 25 + p.root.y, p.root.x, 29 + p.root.y, palette.light, 1);
      line(image, p.root.x + 4, 25 + p.root.y, p.root.x, 29 + p.root.y, palette.deep, 1);
      line(image, p.root.x, 29 + p.root.y, p.root.x, 37 + p.root.y, palette.accentDeep, 1);
    } else {
      rect(image, p.root.x - 2, 25 + p.root.y, 4, 13, palette.accent);
      rect(image, p.root.x - 1, 26 + p.root.y, 2, 11, palette.accentLight);
      line(image, p.root.x - 2, 29 + p.root.y, p.root.x + 2, 29 + p.root.y, palette.accentDeep, 1);
    }
  }
  if (variant === 'veteran') {
    rect(image, p.root.x - 6, 27 + p.root.y, 12, 3, C.outline);
    rect(image, p.root.x - 5, 28 + p.root.y, 10, 1, palette.accentDeep);
    for (const x of [-4, 0, 4]) put(image, p.root.x + x, 28 + p.root.y, palette.accentLight);
    for (const shoulder of [p.shoulderLeft, p.shoulderRight]) {
      ellipse(image, shoulder.x, shoulder.y - 1, 3.5, 2.5, C.outline);
      ellipse(image, shoulder.x, shoulder.y - 1, 2.4, 1.4, palette.accent);
      put(image, shoulder.x - 1, shoulder.y - 2, palette.accentLight);
    }
  } else if (variant === 'runed') {
    if (!back) {
      polygon(image, [
        [p.root.x, 24 + p.root.y], [p.root.x + 3, 28 + p.root.y],
        [p.root.x, 32 + p.root.y], [p.root.x - 3, 28 + p.root.y],
      ], palette.accentLight);
      polygon(image, [
        [p.root.x, 26 + p.root.y], [p.root.x + 1, 28 + p.root.y],
        [p.root.x, 30 + p.root.y], [p.root.x - 1, 28 + p.root.y],
      ], palette.deep);
    } else {
      line(image, p.root.x - 3, 27 + p.root.y, p.root.x + 3, 27 + p.root.y, palette.accentLight, 1);
    }
    polygon(image, [
      [p.root.x - 5, 34 + p.root.y], [p.root.x - 1, 35 + p.root.y],
      [p.root.x - 2, 43 + p.root.y], [p.root.x - 7, 42 + p.root.y],
    ], palette.shade);
    polygon(image, [
      [p.root.x + 1, 35 + p.root.y], [p.root.x + 5, 34 + p.root.y],
      [p.root.x + 7, 42 + p.root.y], [p.root.x + 2, 43 + p.root.y],
    ], palette.deep);
    put(image, p.root.x - 4, 39 + p.root.y, palette.accentLight);
    put(image, p.root.x + 4, 39 + p.root.y, palette.accentLight);
  } else if (variant === 'dark') {
    polygon(image, [
      [p.root.x - 6, 22 + p.root.y], [p.root.x + 6, 22 + p.root.y],
      [p.root.x + 4, 27 + p.root.y], [p.root.x, 25 + p.root.y],
      [p.root.x - 4, 27 + p.root.y],
    ], palette.deep);
    polygon(image, [
      [p.root.x - 5, 27 + p.root.y], [p.root.x, 30 + p.root.y],
      [p.root.x + 5, 27 + p.root.y], [p.root.x + 3, 36 + p.root.y],
      [p.root.x, 34 + p.root.y], [p.root.x - 3, 36 + p.root.y],
    ], palette.shade);
    if (!back) rect(image, p.root.x - 1, 27 + p.root.y, 2, 8, palette.accent);
    else line(image, p.root.x, 27 + p.root.y, p.root.x, 35 + p.root.y, palette.shade, 1);
    polygon(image, [
      [p.root.x - 6, 35 + p.root.y], [p.root.x + 2, 35 + p.root.y],
      [p.root.x + 5, 43 + p.root.y], [p.root.x, 41 + p.root.y],
      [p.root.x - 7, 44 + p.root.y],
    ], palette.deep);
    line(image, p.root.x - 4, 36 + p.root.y, p.root.x - 5, 42 + p.root.y, palette.light, 1);
  }
  drawRaceOutfitDetails(image, p, raceId, palette, classId, back);
}

function weaponPalette(variant) {
  if (variant === 'ornate') return { deep: C.goldDeep, main: C.gold, light: C.goldLight };
  if (variant === 'runed') return { deep: '#4a2160', main: '#7e48a6', light: '#c4b5fd' };
  if (variant === 'shadow') return { deep: '#111827', main: '#374151', light: '#94a3b8' };
  if (variant === 'veteran') return { deep: '#334155', main: '#94a3b8', light: '#f8fafc' };
  return { deep: C.metalDeep, main: C.metal, light: C.metalLight };
}

function weaponVector(p, classId, second = false) {
  const mirror = p.direction.x < -0.1 ? -1 : 1;
  if (p.attackIndex < 0) {
    const profile = Math.abs(p.direction.x) > 0.9;
    const isCaster = classId === 'mage' || classId === 'priest';
    const handSide = isCaster && profile
      ? Math.sign(p.direction.x)
      : Math.sign(p.handLeft.x - p.root.x)
        || (profile ? Math.sign(p.direction.x) : -Math.sign(p.direction.y))
      || -1;
    const idle = {
      x: handSide * (isCaster ? 0.48 : 0.56),
      y: isCaster ? -0.88 : -0.83,
    };
    return second ? { x: -idle.x, y: idle.y } : idle;
  }
  const phase = p.attackIndex;
  if (classId === 'hunter') return { x: 0, y: -1 };
  if (classId === 'mage' || classId === 'priest') {
    const vectors = [
      { x: -0.55 * mirror, y: -0.83 }, { x: 0.35 * mirror, y: -0.94 },
      { x: 0.8 * mirror, y: -0.6 }, { x: -0.1 * mirror, y: -1 },
    ];
    return vectors[phase];
  }
  const vectors = [
    { x: -0.9 * mirror, y: -0.35 }, { x: 0.55 * mirror, y: -0.84 },
    { x: 0.96 * mirror, y: 0.28 }, { x: -0.12 * mirror, y: -0.99 },
  ];
  const vector = vectors[phase];
  return second ? { x: -vector.x, y: vector.y } : vector;
}

function drawBlade(image, hand, vector, palette, length, width = 2) {
  const tip = { x: hand.x + vector.x * length, y: hand.y + vector.y * length };
  outlinedLine(image, hand, tip, palette.main, width);
  line(image, hand.x, hand.y, tip.x, tip.y, palette.light, 1);
  const perpendicular = { x: -vector.y, y: vector.x };
  line(image, hand.x - perpendicular.x * 3, hand.y - perpendicular.y * 3, hand.x + perpendicular.x * 3, hand.y + perpendicular.y * 3, palette.deep, 2);
  ellipse(image, hand.x, hand.y, 1.6, 1.6, C.gold);
  put(image, tip.x, tip.y, palette.light);
}

function drawStaff(image, hand, vector, palette, classId, variant, raceId = 'human') {
  const raceLength = raceId === 'elf' ? 1 : raceId === 'dwarf' ? -2 : raceId === 'orc' ? 0 : raceId === 'undead' ? -1 : 0;
  const staffLength = (variant === 'veteran' ? 19 : variant === 'ornate' ? 18 : variant === 'shadow' ? 15 : 17) + raceLength;
  const top = { x: hand.x + vector.x * staffLength, y: hand.y + vector.y * staffLength };
  const bottom = { x: hand.x - vector.x * 7, y: hand.y - vector.y * 7 };
  outlinedLine(image, bottom, top, variant === 'shadow' ? '#3f2a30' : C.wood, 2);
  line(image, bottom.x, bottom.y, top.x, top.y, C.woodLight, 1);
  ellipse(image, top.x, top.y, 4, 4, C.outline);
  ellipse(image, top.x, top.y, 3, 3, classId === 'mage' ? C.crystalDeep : palette.deep);
  ellipse(image, top.x, top.y, 2, 2, classId === 'mage' ? C.crystal : palette.main);
  put(image, top.x - 1, top.y - 1, classId === 'mage' ? C.crystalLight : palette.light);
  if (raceId === 'elf') {
    line(image, top.x - 4, top.y + 2, top.x, top.y - 5, C.gold, 1);
    line(image, top.x + 4, top.y + 2, top.x, top.y - 5, C.goldLight, 1);
    put(image, top.x, top.y - 6, palette.light);
  } else if (raceId === 'dwarf') {
    polygon(image, [[top.x - 5, top.y], [top.x, top.y - 5], [top.x + 5, top.y], [top.x, top.y + 5]], palette.deep);
    line(image, top.x - 3, top.y, top.x + 3, top.y, C.gold, 1);
    line(image, top.x, top.y - 3, top.x, top.y + 3, C.goldLight, 1);
  } else if (raceId === 'orc') {
    line(image, top.x - 5, top.y - 3, top.x + 3, top.y + 4, C.woodDeep, 2);
    put(image, top.x - 5, top.y - 4, palette.light);
    put(image, top.x + 4, top.y + 4, palette.deep);
  } else if (raceId === 'undead') {
    polygon(image, [[top.x - 5, top.y], [top.x - 2, top.y - 4], [top.x + 2, top.y - 2], [top.x + 5, top.y + 2], [top.x, top.y + 5]], C.outline);
    put(image, top.x - 3, top.y - 1, C.skinLight);
    put(image, top.x + 3, top.y + 1, palette.light);
  }
  if (variant === 'veteran') {
    line(image, top.x - 4, top.y - 2, top.x - 2, top.y + 3, palette.main, 2);
    line(image, top.x + 4, top.y - 2, top.x + 2, top.y + 3, palette.main, 2);
  } else if (variant === 'runed' || variant === 'ornate') {
    line(image, top.x - 5, top.y, top.x + 5, top.y, palette.main, 1);
    line(image, top.x, top.y - 5, top.x, top.y + 5, palette.main, 1);
    if (variant === 'ornate') {
      put(image, top.x - 4, top.y - 3, palette.light);
      put(image, top.x + 4, top.y - 3, palette.light);
      put(image, top.x - 4, top.y + 3, palette.light);
      put(image, top.x + 4, top.y + 3, palette.light);
    }
  } else if (variant === 'shadow') {
    put(image, top.x - 4, top.y, '#7e48a6');
    put(image, top.x + 4, top.y, '#7e48a6');
    put(image, top.x, top.y - 4, '#7e48a6');
  }
}

function drawShield(image, hand, p, palette, kite = false, raceId = 'human') {
  const center = { x: hand.x + p.perpendicular.x * -1.5, y: hand.y + p.perpendicular.y * -1.5 };
  if (raceId === 'dwarf') {
    polygon(image, [
      [center.x - 7, center.y - 5], [center.x + 7, center.y - 5],
      [center.x + 7, center.y + 4], [center.x + 3, center.y + 7],
      [center.x - 3, center.y + 7], [center.x - 7, center.y + 4],
    ], C.outline);
    polygon(image, [
      [center.x - 5, center.y - 4], [center.x + 5, center.y - 4],
      [center.x + 5, center.y + 3], [center.x + 2, center.y + 5],
      [center.x - 2, center.y + 5], [center.x - 5, center.y + 3],
    ], palette.main);
    line(image, center.x - 5, center.y, center.x + 5, center.y, palette.light, 1);
  } else if (raceId === 'orc') {
    polygon(image, [
      [center.x - 6, center.y - 6], [center.x + 4, center.y - 5], [center.x + 7, center.y],
      [center.x + 3, center.y + 7], [center.x - 5, center.y + 5], [center.x - 7, center.y],
    ], C.outline);
    polygon(image, [
      [center.x - 5, center.y - 4], [center.x + 3, center.y - 4], [center.x + 5, center.y],
      [center.x + 2, center.y + 5], [center.x - 4, center.y + 4], [center.x - 5, center.y],
    ], palette.deep);
    line(image, center.x - 3, center.y - 3, center.x + 3, center.y + 4, palette.light, 2);
  } else if (raceId === 'undead') {
    polygon(image, [
      [center.x - 5, center.y - 6], [center.x + 5, center.y - 4], [center.x + 6, center.y + 2],
      [center.x + 1, center.y + 7], [center.x - 6, center.y + 4],
    ], C.outline);
    polygon(image, [
      [center.x - 4, center.y - 4], [center.x + 4, center.y - 3], [center.x + 4, center.y + 1],
      [center.x + 1, center.y + 5], [center.x - 4, center.y + 3],
    ], palette.main);
  } else if (kite) {
    polygon(image, [
      [center.x - 5, center.y - 5], [center.x + 5, center.y - 5],
      [center.x + 4, center.y + 3], [center.x, center.y + 8], [center.x - 4, center.y + 3],
    ], C.outline);
    polygon(image, [
      [center.x - 4, center.y - 4], [center.x + 4, center.y - 4],
      [center.x + 3, center.y + 2], [center.x, center.y + 6], [center.x - 3, center.y + 2],
    ], palette.main);
  } else {
    ellipse(image, center.x, center.y, 6.5, 6.5, C.outline);
    ellipse(image, center.x, center.y, 5.3, 5.3, palette.deep);
    ellipse(image, center.x, center.y, 3.9, 3.9, palette.main);
  }
  ellipse(image, center.x, center.y, 1.8, 1.8, palette.light);
}

function drawBow(image, hand, p, palette, variant, raceId = 'human') {
  const profile = Math.abs(p.direction.x) > 0.9;
  const raceSpan = raceId === 'elf' ? 2 : raceId === 'dwarf' ? -2 : raceId === 'orc' ? 1 : raceId === 'undead' ? -1 : 0;
  const span = (variant === 'ornate' ? 14 : variant === 'veteran' ? 13 : variant === 'shadow' ? 11 : 12) + raceSpan;
  const raceBend = raceId === 'elf' ? 0.8 : raceId === 'dwarf' ? -0.5 : raceId === 'orc' ? 1.1 : raceId === 'undead' ? 0.4 : 0;
  const bend = (profile ? 2.1 : variant === 'ornate' ? 4.2 : 3.4) + raceBend;
  const aim = p.direction;
  const axis = { x: 0, y: 1 };
  const outward = Math.sign(hand.x - p.root.x) || -Math.sign(p.direction.x) || -1;
  // The bow's grip is the hand anchor. Keeping those points identical avoids
  // the detached connector that made the weapon float beside the hunter.
  const grip = { x: hand.x, y: hand.y - 0.5 };
  const bowSide = profile ? Math.sign(p.direction.x) : outward;
  const top = {
    x: grip.x + bowSide * bend,
    y: grip.y - span / 2,
  };
  const bottom = {
    x: grip.x + bowSide * bend,
    y: grip.y + span / 2,
  };
  const upperMid = {
    x: grip.x + bowSide * bend * 0.45,
    y: grip.y - span * 0.28,
  };
  const lowerMid = {
    x: grip.x + bowSide * bend * 0.45,
    y: grip.y + span * 0.28,
  };
  for (const [from, to] of [[top, upperMid], [upperMid, grip], [grip, lowerMid], [lowerMid, bottom]]) {
    line(image, from.x, from.y, to.x, to.y, C.outline, 3);
    line(image, from.x, from.y, to.x, to.y, C.woodLight, 1);
  }
  line(image, top.x, top.y, upperMid.x, upperMid.y, C.woodLight, 1);
  line(image, lowerMid.x, lowerMid.y, bottom.x, bottom.y, C.woodDeep, 1);
  put(image, top.x, top.y, C.woodLight);
  put(image, bottom.x, bottom.y, C.woodDeep);
  ellipse(image, grip.x, grip.y, 1.5, 1.5, palette.deep);
  if (raceId === 'elf') {
    put(image, upperMid.x, upperMid.y, C.goldLight);
    put(image, lowerMid.x, lowerMid.y, C.gold);
  } else if (raceId === 'dwarf') {
    line(image, upperMid.x, upperMid.y, grip.x, grip.y, C.metal, 2);
    line(image, grip.x, grip.y, lowerMid.x, lowerMid.y, C.metalDeep, 2);
  } else if (raceId === 'orc') {
    put(image, top.x - bowSide, top.y, C.skinLight);
    put(image, bottom.x - bowSide, bottom.y, C.skinDeep);
    line(image, grip.x, grip.y - 2, grip.x + bowSide * 3, grip.y, C.woodDeep, 2);
  } else if (raceId === 'undead') {
    line(image, top.x, top.y, top.x - bowSide * 2, top.y + 2, C.skinLight, 1);
    line(image, bottom.x, bottom.y, bottom.x - bowSide * 2, bottom.y - 2, C.skinDeep, 1);
  }
  if (p.attackIndex >= 0) {
    const pull = [1, 3, 5, 1][p.attackIndex];
    const nock = { x: grip.x - aim.x * pull, y: grip.y - aim.y * pull };
    line(image, top.x, top.y, nock.x, nock.y, '#d6c8aa', 1);
    line(image, nock.x, nock.y, bottom.x, bottom.y, '#d6c8aa', 1);
    const arrowTip = { x: nock.x + aim.x * 16, y: nock.y + aim.y * 16 };
    line(image, nock.x, nock.y, arrowTip.x, arrowTip.y, C.woodLight, 1);
    put(image, arrowTip.x, arrowTip.y, palette.light);
    put(image, nock.x - aim.x * 2 + axis.x, nock.y - aim.y * 2 + axis.y, palette.main);
    put(image, nock.x - aim.x * 2 - axis.x, nock.y - aim.y * 2 - axis.y, palette.main);
  } else {
    line(image, top.x, top.y, bottom.x, bottom.y, '#d6c8aa', 1);
  }
}

function drawWeapon(image, p, classId, variant, raceId = 'human') {
  const palette = weaponPalette(variant);
  const vector = weaponVector(p, classId);
  if (classId === 'mage' || classId === 'priest') {
    drawStaff(image, p.handLeft, vector, palette, classId, variant, raceId);
  } else if (classId === 'hunter') {
    drawBow(image, p.handLeft, p, palette, variant, raceId);
  } else if (classId === 'warrior') {
    const length = (variant === 'shadow' ? 14 : 16) + (raceId === 'elf' ? 1 : raceId === 'dwarf' ? -2 : raceId === 'orc' ? 2 : 0);
    drawBlade(image, p.handLeft, vector, palette, length, raceId === 'orc' || raceId === 'dwarf' ? 4 : 3);
  } else if (classId === 'paladin') {
    const length = (variant === 'shadow' ? 14 : 15) + (raceId === 'elf' ? 1 : raceId === 'dwarf' ? -1 : 0);
    drawBlade(image, p.handLeft, vector, palette, length, raceId === 'dwarf' ? 4 : 3);
    const guard = { x: p.handLeft.x - vector.y * 2, y: p.handLeft.y + vector.x * 2 };
    put(image, guard.x, guard.y, C.goldLight);
  } else {
    const bladeLength = raceId === 'elf' ? 11 : raceId === 'dwarf' ? 8 : raceId === 'orc' ? 12 : raceId === 'undead' ? 9 : 10;
    drawBlade(image, p.handLeft, vector, palette, bladeLength, raceId === 'orc' ? 3 : 2);
    drawBlade(image, p.handRight, weaponVector(p, classId, true), palette, bladeLength - 1, raceId === 'orc' ? 3 : 2);
  }
  if (raceId === 'elf') put(image, p.handLeft.x, p.handLeft.y - 2, C.goldLight);
  if (raceId === 'dwarf') rect(image, p.handLeft.x - 2, p.handLeft.y, 4, 2, C.goldDeep);
  if (raceId === 'orc') line(image, p.handLeft.x - 2, p.handLeft.y + 1, p.handLeft.x + 2, p.handLeft.y - 1, C.woodDeep, 2);
  if (raceId === 'undead') put(image, p.handLeft.x + vector.y * 2, p.handLeft.y - vector.x * 2, C.skinLight);
}

function drawOffhand(image, p, classId, variant, raceId = 'human') {
  if (classId !== 'warrior' && classId !== 'paladin') return;
  drawShield(image, p.handRight, p, weaponPalette(variant), classId === 'paladin', raceId);
}

function drawLayer(kind, options, row, column) {
  const image = frame();
  const p = pose(row, column, options.raceId);
  if (kind === 'body') drawBody(image, p, options.body, options.raceId);
  if (kind === 'face') drawFace(image, p, options.style, options.raceId);
  if (kind === 'hair') drawHair(image, p, options.body, options.style, options.raceId);
  if (kind === 'beard') drawBeard(image, p, options.style);
  if (kind === 'cape') drawCape(image, p, options.style);
  if (kind === 'outfit') drawOutfit(image, p, options.classId, options.body, options.variant, options.raceId);
  if (kind === 'weapon') drawWeapon(image, p, options.classId, options.variant, options.raceId);
  if (kind === 'offhand') drawOffhand(image, p, options.classId, options.variant, options.raceId);
  return image;
}

function createAtlas(kind, options) {
  const atlas = new PNG({ width: frameSize * columns, height: frameSize * rows, colorType: 6 });
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const source = drawLayer(kind, options, row, column);
      for (let y = 0; y < logicalSize; y += 1) {
        for (let x = 0; x < logicalSize; x += 1) {
          const sourceIndex = (y * logicalSize + x) * 4;
          if (source.data[sourceIndex + 3] === 0) continue;
          for (let sy = 0; sy < scale; sy += 1) {
            for (let sx = 0; sx < scale; sx += 1) {
              const targetX = column * frameSize + x * scale + sx;
              const targetY = row * frameSize + y * scale + sy;
              const targetIndex = (targetY * atlas.width + targetX) * 4;
              atlas.data.set(source.data.subarray(sourceIndex, sourceIndex + 4), targetIndex);
            }
          }
        }
      }
    }
  }
  return atlas;
}

function write(outputRoot, relativePath, image) {
  const path = join(outputRoot, ...relativePath.split('/'));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(image, { colorType: 6 }));
  return relativePath;
}

let totalAssetCount = 0;
for (const raceId of races) {
  const outputRoot = resolve(characterRoot, `${raceId}_fresh`);
  if (!outputRoot.startsWith(`${characterRoot}${sep}`)) {
    throw new Error(`Refusing to generate outside the character asset root: ${outputRoot}`);
  }
  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(outputRoot, { recursive: true });

  const allowedClasses = raceClasses[raceId];
  const manifest = {
    model: 'adventurer-fresh-v2',
    version: 2,
    race: raceId,
    allowedClasses,
    provenance: 'Authored from scratch by scripts/generate-human-fresh-assets.mjs; reads no prior character sprite files.',
    frame: {
      size: frameSize,
      logicalSize,
      pixelScale: scale,
      columns,
      rows,
      directions: directions.map(({ id }) => id),
      idle: [0],
      walk: [1, 2, 3, 4],
      attack: [5, 6, 7, 8],
    },
    architecture: {
      layers: ['cape', 'body', 'outfit', 'face', 'beard', 'hair', 'offhand', 'weapon'],
      anchorContract: 'Every race and layer is drawn independently from the same corrected screen-space skeleton pose.',
      colorContract: 'Exact canonical palettes are replaced at runtime for race skin, eyes, hair, clothing, trim, and weapon finish.',
    },
    bodies: {},
    faces: { male: {}, female: {} },
    hair: { male: {}, female: {} },
    beards: {},
    capes: {},
    classes: {},
  };

  for (const body of bodies) {
    manifest.bodies[body] = write(outputRoot, `bodies/${body}.png`, createAtlas('body', { raceId, body }));
    for (const style of faceStyles[body]) {
      manifest.faces[body][style] = write(
        outputRoot,
        `faces/${body}/${style}.png`,
        createAtlas('face', { raceId, style }),
      );
    }
    for (const style of hairStyles[body]) {
      manifest.hair[body][style] = write(
        outputRoot,
        `hair/${body}/${style}.png`,
        createAtlas('hair', { raceId, body, style }),
      );
    }
  }
  for (const style of ['short', 'full']) {
    manifest.beards[style] = write(outputRoot, `beards/${style}.png`, createAtlas('beard', { raceId, style }));
  }
  for (const style of ['short', 'long']) {
    manifest.capes[style] = write(outputRoot, `capes/${style}.png`, createAtlas('cape', { raceId, style }));
  }
  for (const classId of allowedClasses) {
    manifest.classes[classId] = {};
    for (const body of bodies) {
      const group = { outfits: {}, weapons: {}, offhands: {} };
      for (const variant of outfitVariants) {
        group.outfits[variant] = write(
          outputRoot,
          `classes/${classId}/${body}/outfits/${variant}.png`,
          createAtlas('outfit', { raceId, classId, body, variant }),
        );
      }
      for (const variant of weaponVariants) {
        group.weapons[variant] = write(
          outputRoot,
          `classes/${classId}/${body}/weapons/${variant}.png`,
          createAtlas('weapon', { raceId, classId, body, variant }),
        );
        if (classId === 'warrior' || classId === 'paladin') {
          group.offhands[variant] = write(
            outputRoot,
            `classes/${classId}/${body}/offhands/${variant}.png`,
            createAtlas('offhand', { raceId, classId, body, variant }),
          );
        }
      }
      manifest.classes[classId][body] = group;
    }
  }

  writeFileSync(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(outputRoot, 'README.md'), [
    `# Fresh ${raceId} paper-doll assets`,
    '',
    `This directory is the live ${raceId} sprite source for: ${allowedClasses.join(', ')}.`,
    '',
    '- Completely new procedural pixel artwork; no old character image is read or transformed.',
    '- Shared corrected 48x48 logical skeleton rendered at crisp 2x pixels into 96x96 frames.',
    '- Eight directions, four walk poses, and four class attack poses.',
    '- Independent body, face, hair, beard, cape, outfit, main-hand, and tank offhand atlases.',
    '- Warrior and paladin creation/DPS visuals use one sword; Tank-role talents add a shield layer.',
    '- All layers use identical pose anchors, preventing drifting or floating equipment.',
    '',
  ].join('\n'));

  const raceAssetCount = 2 + 8 + 8 + 2 + 2
    + allowedClasses.length * bodies.length * 9
    + allowedClasses.filter((classId) => classId === 'warrior' || classId === 'paladin').length * bodies.length * 5;
  totalAssetCount += raceAssetCount;
  console.log(`Generated ${raceAssetCount} ${raceId} atlases at ${relative(root, outputRoot)}.`);
}

console.log(`Generated ${totalAssetCount} from-scratch adventurer-fresh-v2 atlases for ${races.join(', ')}.`);
