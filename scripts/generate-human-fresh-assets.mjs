import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { PNG } from 'pngjs';

const root = process.cwd();
const characterRoot = resolve(root, 'public', 'assets', 'characters');
const modelId = 'adventurer-fresh-v6';
const modelVersion = 6;

// v6 keeps the runtime-compatible 96px frame and the established 48-unit
// design space, while moving the whole cast toward rounded expressive faces,
// compact chibi bodies, richer three-tone materials and independent directional
// headwear. Every layer still consumes one shared eight-direction anchor rig.
const designSize = 48;
const detailScale = 2;
const logicalSize = designSize * detailScale;
const scale = 1;
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
const heritageStyles = {
  human: ['road-freckles', 'temple-scar', 'guild-mark'],
  elf: ['moon-sigil', 'leaf-filigree', 'star-circlet'],
  dwarf: ['forge-smudge', 'clan-rune', 'brass-studs'],
  orc: ['war-paint', 'fang-stripe', 'bone-studs'],
  undead: ['grave-cracks', 'ritual-stitches', 'spectral-veins'],
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
    rootY: 0, headLift: 0, shoulderWidth: 6.8, handWidth: 8.6, hipWidth: 3.6,
    footY: 43, footSpread: 4.1, profileDepth: 1, torsoBonus: 0.35,
  },
  elf: {
    rootY: -0.5, headLift: -0.5, shoulderWidth: 6.25, handWidth: 8.0, hipWidth: 3.25,
    footY: 44, footSpread: 3.8, profileDepth: 0.96, torsoBonus: -0.1,
  },
  dwarf: {
    rootY: 1.5, headLift: 0.5, shoulderWidth: 8.0, handWidth: 9.4, hipWidth: 4.35,
    footY: 41.5, footSpread: 4.7, profileDepth: 1.2, torsoBonus: 1.55,
  },
  orc: {
    rootY: 0.5, headLift: 0, shoulderWidth: 8.25, handWidth: 9.55, hipWidth: 4.5,
    footY: 43.5, footSpread: 4.7, profileDepth: 1.14, torsoBonus: 1.4,
  },
  undead: {
    rootY: 0, headLift: 0.15, shoulderWidth: 6.15, handWidth: 7.95, hipWidth: 3.15,
    footY: 43, footSpread: 3.65, profileDepth: 0.92, torsoBonus: -0.2,
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
  eyeWhite: '#fff8e7',
  blush: '#e99a8f',
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

function paintPixel(image, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= image.width || py >= image.height) return;
  const index = (py * image.width + px) * 4;
  image.data.set(rgba(color), index);
}

function rawRect(image, x, y, width, height, color) {
  for (let py = Math.round(y); py < Math.round(y + height); py += 1) {
    for (let px = Math.round(x); px < Math.round(x + width); px += 1) paintPixel(image, px, py, color);
  }
}

function rawEllipse(image, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / Math.max(rx, 0.1);
      const ny = (y - cy) / Math.max(ry, 0.1);
      if (nx * nx + ny * ny <= 1) paintPixel(image, x, y, color);
    }
  }
}

function rawLine(image, x0, y0, x1, y1, color, thickness = 1) {
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
    rawEllipse(image, ax, ay, Math.max(0.5, thickness / 2), Math.max(0.5, thickness / 2), color);
    if (ax === bx && ay === by) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; ax += sx; }
    if (twice <= dx) { error += dx; ay += sy; }
  }
}

function rawPolygon(image, points, color) {
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
        paintPixel(image, x, y, color);
      }
    }
  }
}

function put(image, x, y, color) {
  rawRect(image, x * detailScale, y * detailScale, detailScale, detailScale, color);
}

function detail(image, x, y, color) {
  paintPixel(image, x * detailScale, y * detailScale, color);
}

function rect(image, x, y, width, height, color) {
  rawRect(image, x * detailScale, y * detailScale, width * detailScale, height * detailScale, color);
}

function ellipse(image, cx, cy, rx, ry, color) {
  rawEllipse(image, cx * detailScale, cy * detailScale, rx * detailScale, ry * detailScale, color);
}

function line(image, x0, y0, x1, y1, color, thickness = 1) {
  rawLine(
    image,
    x0 * detailScale,
    y0 * detailScale,
    x1 * detailScale,
    y1 * detailScale,
    color,
    thickness * detailScale,
  );
}

function polygon(image, points, color) {
  rawPolygon(image, points.map(([x, y]) => [x * detailScale, y * detailScale]), color);
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
    ? { x: direction.x * 0.9 * anatomy.profileDepth, y: direction.x * 0.42 }
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
  const footSpread = Math.abs(direction.x) > 0.9 ? anatomy.footSpread * 0.78 : anatomy.footSpread;
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
    y: 31 + root.y + perpendicular.y * 2.8 + direction.y * armSwing,
  };
  const handRight = {
    x: root.x - perpendicular.x * anatomy.handWidth - direction.x * armSwing,
    y: 31 + root.y - perpendicular.y * 2.8 - direction.y * armSwing,
  };
  if (attackIndex >= 0) {
    const reach = [0, 2, 4, 1][attackIndex];
    handLeft.x += direction.x * reach;
    handLeft.y += direction.y * reach * 0.55;
  }
  return {
    row, column, direction, perpendicular, walkIndex, attackIndex, step, root, anatomy, raceId,
    head: { x: root.x + direction.x * (profile ? 0.8 : 1.2), y: 13 + root.y + anatomy.headLift + direction.y * 0.4 },
    shoulderLeft, shoulderRight, handLeft, handRight, footLeft, footRight,
    hipLeft: { x: root.x + perpendicular.x * anatomy.hipWidth, y: 35 + root.y + perpendicular.y },
    hipRight: { x: root.x - perpendicular.x * anatomy.hipWidth, y: 35 + root.y - perpendicular.y },
  };
}

function orientedHeadPoints(x, y, side, points) {
  return points.map(([forward, vertical]) => [x + side * forward, y + vertical]);
}

function drawBody(image, p, body, raceId = 'human') {
  const profile = Math.abs(p.direction.x) > 0.9;
  const front = p.direction.y > 0.45;
  const back = p.direction.y < -0.45;
  const diagonal = Math.abs(p.direction.x) > 0.45 && !profile;
  const side = p.direction.x < 0 ? -1 : 1;
  const x = p.head.x;
  const y = p.head.y;
  const broad = raceId === 'orc' ? 0.85 : raceId === 'dwarf' ? 0.65 : raceId === 'elf' ? -0.25 : raceId === 'undead' ? -0.15 : 0;
  const tall = raceId === 'elf' ? 0.35 : raceId === 'dwarf' ? -0.45 : raceId === 'orc' ? 0.2 : raceId === 'undead' ? -0.25 : 0;
  const feminine = body === 'female' ? -0.25 : 0;
  const neckHalf = raceId === 'orc' || raceId === 'dwarf' ? 2.8 : raceId === 'undead' ? 2.05 : 2.35;

  // The neck is always authored behind the skull and disappears naturally
  // beneath the class collar. It prevents the side view from reading as a head
  // pasted directly onto the torso without exposing a dark vertical stalk.
  polygon(image, [
    [x - neckHalf, y + 5.1], [x + neckHalf, y + 5.1],
    [x + neckHalf - 0.25, y + 11.2], [x - neckHalf + 0.25, y + 11.2],
  ], C.outline);
  polygon(image, [
    [x - neckHalf + 0.7, y + 5.4], [x + neckHalf - 0.7, y + 5.4],
    [x + neckHalf - 0.9, y + 10.8], [x - neckHalf + 0.85, y + 10.8],
  ], back ? C.skinDeep : C.skinShade);

  if (profile) {
    const nose = raceId === 'elf' ? 0.35 : raceId === 'dwarf' ? 0.05 : raceId === 'orc' ? 0.3 : raceId === 'undead' ? -0.25 : 0.15;
    const jaw = raceId === 'orc' ? 0.7 : raceId === 'dwarf' ? 0.35 : raceId === 'elf' ? -0.15 : raceId === 'undead' ? -0.3 : 0;
    const outer = [
      [-3.7 - broad * 0.35, -7.2 - tall], [0.1, -8.25 - tall], [3.4 + broad * 0.2, -7.1 - tall * 0.5],
      [4.75 + broad * 0.25, -4.6], [5.05 + broad * 0.2, -2.45], [5.72 + nose, -1.25],
      [6.45 + nose, 0.05], [6.15 + nose, 0.95], [5.05 + broad * 0.15, 1.55],
      [5.45 + jaw * 0.3, 2.65], [5.05 + jaw * 0.45, 3.35], [4.65 + jaw, 4.65],
      [3.35 + jaw, 6.2 + tall * 0.25], [0.5, 7.2 + tall * 0.15], [-2.8 - broad * 0.2, 6.55],
      [-5.05 - broad * 0.35, 4.3], [-6.05 - broad * 0.45, 0.65], [-5.75 - broad * 0.35, -3.65],
    ];
    const inner = [
      [-3.35 - broad * 0.25, -6.55 - tall], [0.15, -7.45 - tall], [3.0 + broad * 0.15, -6.35],
      [4.05 + broad * 0.15, -4.15], [4.35, -2.1], [5.12 + nose, -1.0],
      [5.75 + nose, 0.05], [5.48 + nose, 0.55], [4.35, 1.15],
      [4.75 + jaw * 0.2, 2.55], [4.35 + jaw * 0.35, 3.0], [4.0 + jaw, 4.25],
      [2.85 + jaw, 5.45], [0.45, 6.35], [-2.35, 5.8], [-4.25, 3.85],
      [-5.15 - broad * 0.25, 0.65], [-4.9 - broad * 0.2, -3.25],
    ];
    polygon(image, orientedHeadPoints(x, y, side, outer), C.outline);
    polygon(image, orientedHeadPoints(x, y, side, inner), C.skinShade);
    polygon(image, orientedHeadPoints(x, y, side, [
      [-0.9, -6.25], [1.8, -6.2], [3.55, -4.45], [3.95, -2.0],
      [5.02 + nose, -0.8], [5.55 + nose, 0.05], [5.15 + nose, 0.4], [4.05, 1.05],
      [4.35 + jaw * 0.25, 2.45], [3.85 + jaw * 0.55, 4.0], [2.55 + jaw, 5.15],
      [0.25, 5.75], [-1.05, 4.35], [-1.4, 0.2], [-1.05, -3.9],
    ]), C.skin);
    line(image, x - side * 1.2, y - 5.4, x + side * 2.35, y - 5.65, C.skinLight, 0.55);
    line(image, x - side * 3.9, y + 2.2, x - side * 2.75, y + 4.55, C.skinDeep, 0.6);
    ellipse(image, x - side * 3.75, y + 0.15, 1.45, 1.9, C.outline);
    ellipse(image, x - side * 3.7, y + 0.15, 0.85, 1.25, C.skinShade);
    line(image, x - side * 4.05, y - 0.15, x - side * 3.35, y + 0.65, C.skinDeep, 0.5);
  } else if (diagonal) {
    const facing = side;
    const outer = back
      ? [[-4.7 - broad, -6.7 - tall], [0, -8.1 - tall], [4.4 + broad, -6.7 - tall], [6.5 + broad, -2.8], [6.7 + broad, 2.1], [4.5 + broad, 6.1], [0.3, 7.3], [-3.8 - broad, 6.2], [-6.2 - broad, 2.8], [-6.4 - broad, -2.7]]
      : [[-4.65 - broad * 0.5, -6.8 - tall], [0.15, -8.15 - tall], [4.25 + broad * 0.5, -6.7], [6.1 + broad, -3.5], [6.65 + broad, 0.15], [5.85 + broad, 3.75], [3.75 + broad * 0.5, 6.35], [0.45, 7.25], [-3.35 - broad * 0.3, 6.35], [-5.75 - broad, 3.65], [-6.4 - broad, -0.2], [-5.75 - broad * 0.6, -4.2]];
    const points = orientedHeadPoints(x, y, facing, outer);
    polygon(image, points, C.outline);
    const inner = outer.map(([forward, vertical]) => [
      forward * 0.88,
      vertical > 0 ? vertical - 0.7 : vertical + 0.75,
    ]);
    polygon(image, orientedHeadPoints(x, y + 0.05, facing, inner), back ? C.skinDeep : C.skinShade);
    if (!back) {
      polygon(image, orientedHeadPoints(x, y, facing, [
        [-0.6, -6.4], [2.5, -5.95], [4.55 + broad * 0.4, -3.25], [5.1 + broad * 0.55, 0.2],
        [4.45 + broad * 0.45, 3.3], [2.7, 5.35], [0.05, 5.8], [-1.1, 3.4], [-1.35, -1.8],
      ]), C.skin);
      line(image, x - facing * 0.65, y - 5.35, x + facing * 2.4, y - 5.05, C.skinLight, 0.55);
      line(image, x - facing * 3.75, y + 2.7, x - facing * 2.55, y + 4.9, C.skinDeep, 0.55);
    }
    const earX = x - facing * (4.55 + broad * 0.2);
    ellipse(image, earX, y + 0.45, 1.35, 1.95, C.outline);
    ellipse(image, earX, y + 0.4, 0.75, 1.2, back ? C.skinDeep : C.skinShade);
  } else {
    const halfWidth = 7.15 + broad + feminine;
    const halfHeight = 8.15 + tall;
    polygon(image, [
      [x - 4.5 - broad * 0.35, y - halfHeight + 0.6], [x, y - halfHeight], [x + 4.5 + broad * 0.35, y - halfHeight + 0.6],
      [x + halfWidth - 0.4, y - 4.3], [x + halfWidth, y - 0.2], [x + halfWidth - 0.75, y + 3.8],
      [x + 4.25 + broad * 0.25, y + 6.5], [x, y + 7.5 + tall * 0.2], [x - 4.25 - broad * 0.25, y + 6.5],
      [x - halfWidth + 0.75, y + 3.8], [x - halfWidth, y - 0.2], [x - halfWidth + 0.4, y - 4.3],
    ], C.outline);
    polygon(image, [
      [x - 4.0 - broad * 0.25, y - halfHeight + 1.3], [x, y - halfHeight + 0.75], [x + 4.0 + broad * 0.25, y - halfHeight + 1.3],
      [x + halfWidth - 1.05, y - 3.9], [x + halfWidth - 0.75, y - 0.2], [x + halfWidth - 1.4, y + 3.45],
      [x + 3.75 + broad * 0.2, y + 5.8], [x, y + 6.7], [x - 3.75 - broad * 0.2, y + 5.8],
      [x - halfWidth + 1.4, y + 3.45], [x - halfWidth + 0.75, y - 0.2], [x - halfWidth + 1.05, y - 3.9],
    ], back ? C.skinDeep : C.skinShade);
    if (!back) {
      polygon(image, [
        [x - 3.65, y - 6.45], [x + 1.2, y - 6.75], [x + 4.85 + broad * 0.2, y - 3.8],
        [x + 5.45 + broad * 0.25, y + 1.15], [x + 3.85, y + 4.9], [x + 0.4, y + 5.75],
        [x - 2.7, y + 5.05], [x - 4.8, y + 2.5], [x - 5.15, y - 1.9],
      ], C.skin);
      line(image, x - 3.4, y - 5.25, x + 1.65, y - 5.65, C.skinLight, 0.55);
      line(image, x + 4.35, y + 2.7, x + 2.5, y + 5.0, C.skinDeep, 0.55);
      line(image, x - 4.7, y + 2.8, x - 3.35, y + 4.7, C.skinShade, 0.5);
    }
    for (const earSide of [-1, 1]) {
      const earX = x + earSide * (halfWidth - 0.2);
      ellipse(image, earX, y + 0.55, 1.2, 1.85, C.outline);
      ellipse(image, earX, y + 0.5, 0.65, 1.15, back ? C.skinDeep : earSide < 0 ? C.skinShade : C.skin);
    }
  }

  if (raceId === 'elf') {
    const earY = y - 0.1;
    if (profile) {
      polygon(image, orientedHeadPoints(x, y, side, [[-4.6, -1], [-9.7, -3.1], [-5.7, 2.0]]), C.outline);
      line(image, x - side * 5.4, earY, x - side * 8.8, earY - 2.0, C.skin, 0.7);
      line(image, x - side * 6.1, earY - 0.1, x - side * 8.2, earY - 1.6, C.skinDeep, 0.45);
    } else if (diagonal) {
      const rear = -side;
      polygon(image, [
        [x + rear * 4.6, earY - 0.7], [x + rear * 10.2, earY - 3.0], [x + rear * 5.9, earY + 2.0],
      ], C.outline);
      line(image, x + rear * 5.3, earY, x + rear * 9.1, earY - 2.0, back ? C.skinShade : C.skin, 0.65);
    } else {
      for (const earSide of [-1, 1]) {
        polygon(image, [[x + earSide * 5.8, earY - 0.8], [x + earSide * 10.2, earY - 3.0], [x + earSide * 6.5, earY + 2]], C.outline);
        line(image, x + earSide * 6.4, earY, x + earSide * 9.2, earY - 2, back ? C.skinShade : C.skin, 0.65);
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
  const back = p.direction.y < -0.45;
  if (back) return;
  const turn = p.direction.x;
  const side = turn < 0 ? -1 : 1;
  const profile = Math.abs(turn) > 0.9;
  const diagonal = Math.abs(turn) > 0.45 && !profile;
  const x = p.head.x;
  const y = p.head.y;
  // Keep every race on the canonical eye key. Undead glow is a runtime color
  // customization, so baking cyan into this layer would make its picker inert.
  const eyeColor = C.eye;
  const lidColor = raceId === 'orc' ? C.outline : C.outlineSoft;

  if (profile) {
    const eyeX = x + side * (raceId === 'orc' ? 2.35 : raceId === 'elf' ? 2.5 : 2.15);
    const eyeY = y - 1.45;
    const eyeWidth = raceId === 'elf' ? 1.6 : raceId === 'orc' ? 1.35 : 1.45;
    if (style === 'cheerful') {
      line(image, eyeX - side * eyeWidth, eyeY + 0.2, eyeX + side * eyeWidth, eyeY - 0.1, C.outline, 0.55);
      detail(image, eyeX + side * 1.5, eyeY + 2.7, '#e99a8f');
    } else {
      ellipse(image, eyeX, eyeY, eyeWidth, raceId === 'undead' ? 1.15 : 0.8, C.outline);
      ellipse(image, eyeX + side * 0.15, eyeY + 0.05, eyeWidth - 0.4, 0.42, C.skinLight);
      ellipse(image, eyeX + side * 0.45, eyeY + 0.05, 0.42, 0.58, eyeColor);
      detail(image, eyeX + side * 0.55, eyeY - 0.2, C.skinLight);
      line(image, eyeX - side * 1.65, eyeY - (style === 'focused' ? 2.25 : 2.0), eyeX + side * 1.25, eyeY - 1.65, lidColor, style === 'focused' ? 0.85 : 0.6);
    }
    line(image, x + side * 3.45, y - 0.85, x + side * 5.25, y + 0.05, C.skinShade, 0.55);
    detail(image, x + side * 5.35, y + 0.45, C.outlineSoft);
    detail(image, x + side * 4.75, y + 0.85, C.skinDeep);
    line(image, x + side * 3.1, y + 2.45, x + side * 4.75, y + (style === 'cheerful' ? 2.2 : 2.65), C.outlineSoft, 0.55);
    line(image, x + side * 3.15, y + 3.2, x + side * 4.15, y + 3.05, C.skinLight, 0.45);
    line(image, x + side * 2.0, y + 4.65, x + side * 3.35, y + 4.35, C.skinDeep, 0.5);
    detail(image, x - side * 3.55, y + 0.35, C.skinDeep);
    if (style === 'scarred') {
      line(image, eyeX - side * 0.8, eyeY - 3.0, eyeX + side * 1.15, eyeY + 2.45, '#8f4d4d', 0.55);
      detail(image, eyeX + side * 0.25, eyeY - 0.15, C.skinLight);
    }
    if (style === 'freckled') {
      detail(image, x + side * 2.1, y + 1.1, '#b86e58');
      detail(image, x + side * 2.8, y + 1.45, '#b86e58');
      detail(image, x + side * 3.45, y + 1.2, '#b86e58');
    }
    if (raceId === 'elf') {
      line(image, eyeX - side * 1.45, eyeY - 0.45, eyeX + side * 1.55, eyeY - 0.8, C.outline, 0.5);
      detail(image, x - side * 3.9, y - 2.0, C.skinLight);
    }
    if (raceId === 'dwarf') {
      line(image, eyeX - side * 1.9, eyeY - 2.15, eyeX + side * 1.15, eyeY - 1.95, C.outline, 0.9);
      line(image, x - side * 1.6, y + 4.0, x + side * 2.0, y + 4.9, C.skinDeep, 0.65);
    }
    if (raceId === 'orc') {
      line(image, eyeX - side * 1.8, eyeY - 2.0, eyeX + side * 1.1, eyeY - 1.55, C.outline, 0.9);
      polygon(image, orientedHeadPoints(x, y, side, [[3.55, 2.8], [4.35, 4.55], [4.85, 2.65]]), C.outline);
      polygon(image, orientedHeadPoints(x, y, side, [[3.8, 2.85], [4.3, 4.0], [4.55, 2.75]]), C.skinLight);
    }
    if (raceId === 'undead') {
      line(image, x - side * 2.9, y + 1.0, x - side * 1.1, y + 3.8, C.skinDeep, 0.55);
      detail(image, x + side * 3.2, y + 3.55, C.outlineSoft);
      detail(image, x - side * 2.0, y - 4.0, C.skinLight);
    }
    return;
  }

  const facing = diagonal ? side : 0;
  const centerX = x + facing * 0.55;
  const eyeY = y - 0.2;
  const eyes = diagonal
    ? [{ offset: -side * 2.0, width: 1.05, far: true }, { offset: side * 2.45, width: 1.4, far: false }]
    : [{ offset: -2.65, width: 1.35, far: false }, { offset: 2.65, width: 1.35, far: false }];
  for (const { offset, width, far } of eyes) {
    const eyeX = centerX + offset;
    if (style === 'cheerful') {
      line(image, eyeX - width, eyeY + 0.1, eyeX + width, eyeY - (far ? 0.15 : 0), C.outline, 0.55);
      continue;
    }
    ellipse(image, eyeX, eyeY, width, raceId === 'undead' ? 1.0 : 0.78, C.outline);
    ellipse(image, eyeX, eyeY + 0.05, Math.max(0.55, width - 0.38), 0.4, C.skinLight);
    const irisShift = diagonal ? side * 0.25 : 0;
    ellipse(image, eyeX + irisShift, eyeY + 0.05, 0.4, 0.55, eyeColor);
    detail(image, eyeX + irisShift - 0.1, eyeY - 0.15, C.skinLight);
    if (style === 'focused') {
      const browTilt = diagonal ? side : Math.sign(offset);
      line(image, eyeX - width, eyeY - 2.2 + browTilt * 0.15, eyeX + width, eyeY - 1.75 - browTilt * 0.15, C.outline, 0.75);
    } else {
      line(image, eyeX - width * 0.85, eyeY - 1.95, eyeX + width * 0.85, eyeY - 2.0, lidColor, 0.5);
    }
  }

  const noseCenter = centerX + facing * 0.65;
  line(image, noseCenter - facing * 0.25, eyeY + 0.75, noseCenter + facing * 0.55, eyeY + 2.15, C.skinShade, 0.5);
  detail(image, noseCenter - 0.35, eyeY + 2.35, C.skinDeep);
  detail(image, noseCenter + 0.45, eyeY + 2.35, C.skinDeep);
  detail(image, noseCenter - facing * 0.35, eyeY + 1.05, C.skinLight);
  const mouthCenter = centerX + facing * 0.45;
  if (style === 'cheerful') {
    detail(image, centerX - 4.6, eyeY + 2.9, '#e99a8f');
    detail(image, centerX + 4.6, eyeY + 2.9, '#e99a8f');
    line(image, mouthCenter - 1.65, eyeY + 4.25, mouthCenter, eyeY + 4.8, C.outlineSoft, 0.55);
    line(image, mouthCenter, eyeY + 4.8, mouthCenter + 1.65, eyeY + 4.25, C.outlineSoft, 0.55);
  } else if (style === 'focused') {
    line(image, mouthCenter - 1.65, eyeY + 4.55, mouthCenter + 1.65, eyeY + 4.45, C.outline, 0.6);
  } else {
    line(image, mouthCenter - 1.35, eyeY + 4.45, mouthCenter + 1.35, eyeY + 4.4, C.outlineSoft, 0.55);
  }
  line(image, mouthCenter - 0.7, eyeY + 5.15, mouthCenter + 0.75, eyeY + 5.1, C.skinLight, 0.45);
  detail(image, centerX - 4.6, eyeY + 2.2, C.skinShade);
  detail(image, centerX + 4.55, eyeY + 2.15, C.skinDeep);
  if (style === 'scarred') {
    line(image, centerX + 0.9, eyeY - 3.55, centerX + 4.55, eyeY + 3.75, '#8f4d4d', 0.55);
    detail(image, centerX + 2.8, eyeY + 0.1, C.skinLight);
  }
  if (style === 'freckled') {
    for (const offset of [-4.4, -3.3, 3.1, 4.25]) detail(image, centerX + offset, eyeY + 2.75 + Math.abs(offset % 1), '#b86e58');
  }
  if (raceId === 'orc') {
    line(image, centerX - 4.65, eyeY - 2.3, centerX - 2.0, eyeY - 1.7, C.outline, 0.75);
    line(image, centerX + 2.0, eyeY - 1.7, centerX + 4.65, eyeY - 2.3, C.outline, 0.75);
    for (const tuskSide of [-1, 1]) {
      polygon(image, [[mouthCenter + tuskSide * 2.15, eyeY + 4.0], [mouthCenter + tuskSide * 2.8, eyeY + 5.55], [mouthCenter + tuskSide * 3.05, eyeY + 3.75]], C.outline);
      line(image, mouthCenter + tuskSide * 2.45, eyeY + 4.05, mouthCenter + tuskSide * 2.75, eyeY + 5.05, C.skinLight, 0.5);
    }
  }
  if (raceId === 'dwarf') {
    line(image, centerX - 4.4, eyeY - 2.25, centerX - 1.8, eyeY - 2.2, C.outlineSoft, 0.75);
    line(image, centerX + 1.8, eyeY - 2.2, centerX + 4.4, eyeY - 2.25, C.outlineSoft, 0.75);
    line(image, noseCenter - 0.75, eyeY + 2.2, noseCenter + 0.85, eyeY + 2.2, C.skinDeep, 0.65);
  }
  if (raceId === 'elf') {
    line(image, centerX - 4.25, eyeY - 0.65, centerX - 1.7, eyeY - 1.05, C.outline, 0.5);
    line(image, centerX + 1.7, eyeY - 1.05, centerX + 4.25, eyeY - 0.65, C.outline, 0.5);
    detail(image, centerX, eyeY - 4.65, C.goldLight);
  }
  if (raceId === 'undead') {
    line(image, centerX - 4.65, eyeY + 2.75, centerX - 3.0, eyeY + 4.75, C.skinDeep, 0.55);
    line(image, centerX + 4.65, eyeY + 2.75, centerX + 3.0, eyeY + 4.75, C.skinDeep, 0.55);
    detail(image, noseCenter, eyeY + 2.5, C.outlineSoft);
  }
}

function drawHeritage(image, p, style, raceId = 'human') {
  if (!style || p.direction.y < -0.45) return;
  const profile = Math.abs(p.direction.x) > 0.9;
  const side = p.direction.x < 0 ? -1 : 1;
  const x = p.head.x;
  const y = p.head.y;
  const visibleSide = profile ? side : p.direction.x < -0.1 ? -1 : 1;

  if (raceId === 'human') {
    if (style === 'road-freckles') {
      const cheekX = x + visibleSide * (profile ? 3 : 2.5);
      for (const [dx, dy] of [[-0.9, 1.7], [0.1, 2.05], [0.95, 1.7], [1.55, 2.45]]) {
        detail(image, cheekX + dx, y + dy, '#b86e58');
      }
    } else if (style === 'temple-scar') {
      const templeX = x + visibleSide * (profile ? 1 : 2.6);
      line(image, templeX - visibleSide * 0.8, y - 3.8, templeX + visibleSide * 0.75, y + 1.8, '#8f4d4d', 0.55);
      detail(image, templeX, y - 1, C.skinLight);
    } else if (style === 'guild-mark') {
      const markX = x + visibleSide * (profile ? 2 : 2.7);
      polygon(image, [[markX, y + 1.1], [markX + 0.8, y + 2], [markX, y + 2.9], [markX - 0.8, y + 2]], C.goldDeep);
      detail(image, markX, y + 2, C.goldLight);
    }
    return;
  }

  if (raceId === 'elf') {
    if (style === 'moon-sigil') {
      const markX = x + visibleSide * (profile ? 1 : 2.8);
      line(image, markX - visibleSide * 0.8, y + 0.9, markX - visibleSide * 0.15, y + 2.8, '#7dd3fc', 0.55);
      line(image, markX - visibleSide * 0.1, y + 2.8, markX + visibleSide * 0.65, y + 1.7, '#7dd3fc', 0.45);
      detail(image, markX + visibleSide * 0.8, y + 1.65, C.goldLight);
    } else if (style === 'leaf-filigree') {
      const markX = x + visibleSide * (profile ? 2 : 2.7);
      line(image, markX, y, markX - visibleSide * 0.8, y + 4.7, '#5f9f75', 0.5);
      detail(image, markX + visibleSide * 0.7, y + 1.7, '#b8e3cf');
      detail(image, markX - visibleSide * 1.45, y + 3.8, '#b8e3cf');
    } else if (style === 'star-circlet') {
      line(image, x - (profile ? side * 2 : 3), y - 2.8, x + (profile ? side * 2 : 3), y - 2.8, C.goldDeep, 0.6);
      detail(image, x + (profile ? side : 0), y - 2.8, C.goldLight);
      detail(image, x + (profile ? side : 0), y - 3.55, '#c4b5fd');
    }
    return;
  }

  if (raceId === 'dwarf') {
    if (style === 'forge-smudge') {
      const cheekX = x + visibleSide * (profile ? 3 : 2.6);
      line(image, cheekX - visibleSide * 1.15, y + 1.1, cheekX + visibleSide * 1.0, y + 2.8, '#6b351f', 0.85);
      detail(image, cheekX, y + 1.9, '#9a4f2f');
    } else if (style === 'clan-rune') {
      const runeX = x + visibleSide * (profile ? 2 : 2.6);
      line(image, runeX, y + 0.2, runeX, y + 4.8, '#d6b25e', 0.55);
      line(image, runeX - visibleSide * 0.9, y + 1.1, runeX + visibleSide * 0.9, y + 2.0, C.goldLight, 0.45);
      detail(image, runeX - visibleSide * 0.8, y + 3.8, C.goldDeep);
    } else if (style === 'brass-studs') {
      const studX = x + visibleSide * (profile ? 4 : 3.2);
      for (const dy of [-2, 1, 4]) {
        detail(image, studX, y + dy, C.goldDeep);
        detail(image, studX - visibleSide * 0.55, y + dy - 0.25, C.goldLight);
      }
    }
    return;
  }

  if (raceId === 'orc') {
    if (style === 'war-paint') {
      const paintX = x + visibleSide * (profile ? 2 : 2.8);
      line(image, paintX - visibleSide * 0.85, y - 3, paintX + visibleSide * 0.7, y + 3.8, '#a52f2a', 0.9);
      line(image, paintX - visibleSide * 1.35, y - 0.2, paintX + visibleSide * 1.15, y + 0.45, '#e05044', 0.55);
    } else if (style === 'fang-stripe') {
      const paintX = x + visibleSide * (profile ? 3 : 2.8);
      line(image, paintX - visibleSide * 0.8, y - 2, paintX + visibleSide * 0.8, y + 2.9, '#f1e5c8', 0.55);
      line(image, paintX, y + 1, paintX - visibleSide * 0.8, y + 4.7, '#9f7f54', 0.45);
    } else if (style === 'bone-studs') {
      const studX = x + visibleSide * (profile ? 4 : 3.2);
      for (const dy of [-2, 1, 4]) detail(image, studX - visibleSide * ((dy % 2) * 0.6), y + dy, '#f1e5c8');
    }
    return;
  }

  if (raceId === 'undead') {
    if (style === 'grave-cracks') {
      const crackX = x + visibleSide * (profile ? 2 : 2.2);
      line(image, crackX, y - 2, crackX - visibleSide * 1.8, y + 1.8, '#6b746c', 0.5);
      line(image, crackX - visibleSide * 0.9, y + 1, crackX + visibleSide * 0.85, y + 4.8, '#6b746c', 0.45);
    } else if (style === 'ritual-stitches') {
      const stitchX = x + visibleSide * (profile ? 2 : 2.2);
      line(image, stitchX - visibleSide * 2, y + 2, stitchX + visibleSide * 2, y + 4, C.outlineSoft, 0.5);
      for (const offset of [-1, 1]) detail(image, stitchX + visibleSide * offset, y + 3, '#d8ddd0');
    } else if (style === 'spectral-veins') {
      const veinX = x + visibleSide * (profile ? 2 : 2.2);
      line(image, veinX, y - 3, veinX - visibleSide * 0.8, y + 4, '#67e8f9', 0.45);
      detail(image, veinX + visibleSide * 0.8, y, '#a7f3d0');
      detail(image, veinX - visibleSide * 1.7, y + 3, '#a7f3d0');
    }
  }
}

function hairCap(image, p, style, raceId = 'human') {
  const profile = Math.abs(p.direction.x) > 0.9;
  const back = p.direction.y < -0.35;
  const rearDiagonal = back && Math.abs(p.direction.x) > 0.45;
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
    if (rearDiagonal) {
      polygon(image, orientedHeadPoints(x, y, side, [
        [-6.65, 4.1], [-7.25, -0.2], [-5.7, -4.45], [-2.15, top - y + 0.45],
        [1.0, top - y], [4.85, -5.45], [6.75, -2.15], [7.3, 1.35],
        [5.95, 4.65], [3.65, lowerSide - y], [0.9, lowerCenter - y],
        [-2.25, lowerCenter - y - 0.55], [-4.8, lowerSide - y - 0.4],
      ]), C.outline);
      polygon(image, orientedHeadPoints(x, y, side, [
        [-5.8, 3.65], [-6.3, 0], [-4.95, -3.8], [-1.8, top - y + 1.3],
        [0.9, top - y + 0.8], [4.1, -4.85], [5.8, -1.85], [6.3, 1.15],
        [5.05, 3.95], [3.05, lowerSide - y - 0.8], [0.75, lowerCenter - y - 0.9],
        [-1.75, lowerCenter - y - 1.35], [-4.05, lowerSide - y - 1.05],
      ]), C.hair);
      line(image, x - side * 4.4, y - 3.75, x + side * 0.65, top + 1.65, C.hairLight, 0.65);
      line(image, x + side * 4.6, y - 3.1, x + side * 5.15, y + 3.45, C.hairShade, 0.65);
      line(image, x - side * 2.1, y + 5.0, x + side * 1.1, y + 6.2, C.hairDeep, 0.5);
      const earX = x + side * 6.15;
      if (raceId === 'elf') {
        polygon(image, [[earX - side * 0.6, y - 0.8], [earX + side * 4.0, y - 2.6], [earX + side * 0.2, y + 1.65]], C.outline);
        line(image, earX, y - 0.15, earX + side * 3.05, y - 1.85, C.skinShade, 0.55);
      } else {
        ellipse(image, earX, y + 0.4, 1.05, 1.6, C.outline);
        ellipse(image, earX, y + 0.4, 0.5, 1.0, C.skinShade);
        line(image, earX - side * 0.25, y + 0.05, earX + side * 0.3, y + 0.7, C.skinDeep, 0.45);
      }
      return;
    }
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

function drawBeard(image, p, style, raceId = 'human') {
  if (p.direction.y < -0.35) return;
  const profile = Math.abs(p.direction.x) > 0.9;
  if (profile) {
    const facing = Math.sign(p.direction.x) || 1;
    const beardLength = style === 'full'
      ? raceId === 'dwarf' ? 13 : raceId === 'elf' ? 10 : 11
      : 6;
    if (style === 'short') {
      line(image, p.head.x + facing, p.head.y + 4, p.head.x + facing * 5, p.head.y + 5, C.outline, 2);
      line(image, p.head.x + facing * 2, p.head.y + 4, p.head.x + facing * 4, p.head.y + 5, C.hairShade, 1);
      put(image, p.head.x + facing, p.head.y + 6, C.hairDeep);
      return;
    }
    polygon(image, [
      [p.head.x - facing * 2, p.head.y + 4], [p.head.x + facing * 5, p.head.y + 3],
      [p.head.x + facing * 4, p.head.y + 8], [p.head.x + facing, p.head.y + beardLength],
      [p.head.x - facing * 2, p.head.y + beardLength - 3],
    ], C.outline);
    polygon(image, [
      [p.head.x - facing, p.head.y + 5], [p.head.x + facing * 4, p.head.y + 4],
      [p.head.x + facing * 3, p.head.y + 8], [p.head.x + facing, p.head.y + beardLength - 1],
      [p.head.x - facing, p.head.y + beardLength - 4],
    ], C.hair);
    line(image, p.head.x + facing * 2, p.head.y + 5, p.head.x + facing, p.head.y + beardLength - 2, C.hairLight, 1);
    if (raceId === 'dwarf') {
      put(image, p.head.x + facing, p.head.y + beardLength - 3, C.gold);
      put(image, p.head.x, p.head.y + beardLength - 5, C.goldDeep);
    } else if (raceId === 'undead') {
      put(image, p.head.x - facing, p.head.y + beardLength - 5, C.outline);
    }
    return;
  }
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
    if (raceId === 'dwarf') {
      put(image, p.head.x - 2 + side, p.head.y + 9, C.goldDeep);
      put(image, p.head.x + 2 + side, p.head.y + 9, C.gold);
    } else if (raceId === 'orc') {
      put(image, p.head.x - 3 + side, p.head.y + 8, C.woodLight);
    } else if (raceId === 'undead') {
      put(image, p.head.x + side, p.head.y + 8, C.outline);
    }
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

function drawBoot(image, hip, foot, depth = 'near') {
  const bootColor = depth === 'far' ? '#1b151b' : C.boot;
  const highlight = depth === 'far' ? '#382834' : C.bootLight;
  outlinedLine(image, hip, { x: foot.x, y: foot.y - 1 }, bootColor, 3);
  ellipse(image, foot.x, foot.y, 3, 1.8, C.outline);
  rect(image, foot.x - 2, foot.y - 1, 4, 2, bootColor);
  put(image, foot.x - 1, foot.y - 1, highlight);
}

function drawProfileOutfit(image, p, classId, body, variant, raceId, palette) {
  const facing = Math.sign(p.direction.x) || 1;
  const rear = -facing;
  const wide = p.anatomy.torsoBonus;
  const frontX = p.root.x + facing * (5.5 + wide * 0.65);
  const backX = p.root.x + rear * (4.4 + wide * 0.55);
  const waistFront = p.root.x + facing * (4 + wide * 0.45);
  const waistBack = p.root.x + rear * (3.3 + wide * 0.4);
  const topY = 22 + p.root.y;
  const waistY = 35 + p.root.y;
  const hemY = 39 + p.root.y;
  const armor = classId === 'paladin' || classId === 'warrior';
  const farShoulder = p.shoulderRight;
  const farHand = p.handRight;
  const nearShoulder = p.shoulderLeft;
  const nearHand = p.handLeft;

  drawBoot(image, p.hipRight, p.footRight, 'far');
  drawBoot(image, p.hipLeft, p.footLeft, 'near');
  outlinedLine(image, farShoulder, farHand, palette.shade, armor ? 4 : 3);
  ellipse(image, farShoulder.x, farShoulder.y, armor ? 4 : 3, armor ? 2.7 : 2.2, C.outline);
  ellipse(image, farShoulder.x, farShoulder.y, armor ? 2.8 : 2, armor ? 1.7 : 1.2, palette.shade);
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
  line(image, p.root.x + rear, topY + 2, p.root.x + rear, waistY - 4, palette.deep, 1);
  polygon(image, [
    [p.root.x + rear * 2.5, topY], [p.root.x + facing * 2.7, topY],
    [p.root.x + facing * 3.3, topY + 3], [p.root.x + rear * 1.5, topY + 4],
  ], C.outline);
  line(image, p.root.x + rear * 1.5, topY + 1, p.root.x + facing * 2.2, topY + 2, palette.accent, 1);

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
  line(image, nearShoulder.x - facing, nearShoulder.y, nearHand.x - facing, nearHand.y - 1, palette.light, 1);
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

// The v6 rig is intentionally separate from the archived v4/v5 construction.
// Every visual layer consumes this same pose object, so a cosmetic can never
// invent a different head, hand or foot anchor for a diagonal direction.
function poseV6(row, column, raceId = 'human') {
  const direction = directions[row];
  const anatomy = RACE_ANATOMY[raceId] ?? RACE_ANATOMY.human;
  const profile = Math.abs(direction.x) > 0.9;
  const perpendicular = profile
    ? { x: direction.x * 0.44 * anatomy.profileDepth, y: direction.x * 0.24 }
    : { x: -direction.y, y: direction.x };
  const walkIndex = column >= 1 && column <= 4 ? column - 1 : -1;
  const attackIndex = column >= 5 ? column - 5 : -1;
  const stride = walkIndex >= 0 ? [-1.15, -0.4, 1.15, 0.4][walkIndex] : 0;
  const bob = walkIndex >= 0 ? [0, -0.8, 0, -0.8][walkIndex] : attackIndex === 2 ? 0.8 : 0;
  const lunge = attackIndex >= 0 ? [0, 0.8, 1.8, 0.55][attackIndex] : 0;
  const root = {
    x: 24 + direction.x * lunge,
    y: anatomy.rootY + bob + direction.y * lunge * 0.42,
  };
  const footSpread = profile ? anatomy.footSpread * 0.68 : anatomy.footSpread;
  const footLeft = {
    x: root.x + perpendicular.x * footSpread + direction.x * stride * 2.25,
    y: anatomy.footY + bob + perpendicular.y * footSpread * 0.42 + direction.y * stride * 1.55,
  };
  const footRight = {
    x: root.x - perpendicular.x * footSpread - direction.x * stride * 2.25,
    y: anatomy.footY + bob - perpendicular.y * footSpread * 0.42 - direction.y * stride * 1.55,
  };
  const shoulderLeft = {
    x: root.x + perpendicular.x * anatomy.shoulderWidth,
    y: 24 + root.y + perpendicular.y * 1.25,
  };
  const shoulderRight = {
    x: root.x - perpendicular.x * anatomy.shoulderWidth,
    y: 24 + root.y - perpendicular.y * 1.25,
  };
  const armSwing = walkIndex >= 0 ? stride * 1.55 : 0;
  const handLeft = {
    x: root.x + perpendicular.x * anatomy.handWidth + direction.x * armSwing,
    y: 31 + root.y + perpendicular.y * 2.4 + direction.y * armSwing,
  };
  const handRight = {
    x: root.x - perpendicular.x * anatomy.handWidth - direction.x * armSwing,
    y: 31 + root.y - perpendicular.y * 2.4 - direction.y * armSwing,
  };
  if (attackIndex >= 0) {
    const reach = [0, 2, 4, 1.2][attackIndex];
    handLeft.x += direction.x * reach;
    handLeft.y += direction.y * reach * 0.52;
  }
  return {
    row,
    column,
    direction,
    perpendicular,
    walkIndex,
    attackIndex,
    step: stride,
    root,
    anatomy,
    raceId,
    head: {
      x: root.x + direction.x * (profile ? 0.55 : 0.9),
      y: 13.2 + root.y + anatomy.headLift + direction.y * 0.3,
    },
    shoulderLeft,
    shoulderRight,
    handLeft,
    handRight,
    footLeft,
    footRight,
    hipLeft: { x: root.x + perpendicular.x * anatomy.hipWidth, y: 35 + root.y + perpendicular.y },
    hipRight: { x: root.x - perpendicular.x * anatomy.hipWidth, y: 35 + root.y - perpendicular.y },
  };
}

function drawBodyV6(image, p, body, raceId = 'human') {
  const profile = Math.abs(p.direction.x) > 0.9;
  const back = p.direction.y < -0.45;
  const diagonal = Math.abs(p.direction.x) > 0.45 && !profile;
  const side = p.direction.x < 0 ? -1 : 1;
  const x = p.head.x;
  const y = p.head.y;
  const broad = raceId === 'orc' ? 0.8 : raceId === 'dwarf' ? 0.55 : raceId === 'elf' ? -0.25 : raceId === 'undead' ? -0.15 : 0;
  const tall = raceId === 'elf' ? 0.35 : raceId === 'dwarf' ? -0.45 : raceId === 'undead' ? -0.2 : 0;
  const feminine = body === 'female' ? -0.3 : 0;
  const neckWidth = raceId === 'orc' || raceId === 'dwarf' ? 2.5 : 2.1;

  polygon(image, [
    [x - neckWidth, y + 4.6], [x + neckWidth, y + 4.6],
    [x + neckWidth - 0.35, y + 10.8], [x - neckWidth + 0.35, y + 10.8],
  ], C.outline);
  polygon(image, [
    [x - neckWidth + 0.65, y + 4.9], [x + neckWidth - 0.65, y + 4.9],
    [x + neckWidth - 0.9, y + 10.35], [x - neckWidth + 0.9, y + 10.35],
  ], back ? C.skinDeep : C.skinShade);

  if (profile) {
    const nose = raceId === 'elf' ? 0.25 : raceId === 'orc' ? 0.4 : raceId === 'undead' ? -0.15 : 0;
    const jaw = raceId === 'orc' ? 0.55 : raceId === 'dwarf' ? 0.3 : raceId === 'elf' ? -0.1 : 0;
    const outer = [
      [-4.15 - broad * 0.3, -5.8 - tall], [-1.4, -7.35 - tall], [1.8, -7.25 - tall],
      [4.0 + broad * 0.25, -5.4], [4.6 + broad * 0.2, -2.2], [5.55 + nose, -0.45],
      [5.15 + nose, 0.8], [4.45 + jaw, 2.0], [4.35 + jaw, 3.8],
      [2.7 + jaw, 5.65], [-0.1, 6.5], [-3.25 - broad * 0.2, 5.3],
      [-4.9 - broad * 0.35, 2.4], [-5.15 - broad * 0.35, -2.3],
    ];
    polygon(image, orientedHeadPoints(x, y, side, outer), C.outline);
    polygon(image, orientedHeadPoints(x, y + 0.05, side, outer.map(([forward, vertical]) => [
      forward * 0.84,
      vertical > 0 ? vertical - 0.65 : vertical + 0.7,
    ])), back ? C.skinDeep : C.skinShade);
    if (!back) {
      polygon(image, orientedHeadPoints(x, y, side, [
        [-0.9, -5.9], [1.7, -5.85], [3.25, -4.25], [3.75, -1.8],
        [4.75 + nose, -0.35], [4.4 + nose, 0.4], [3.7 + jaw, 1.8],
        [3.55 + jaw, 3.4], [2.15 + jaw, 4.75], [0, 5.45], [-1.0, 4.15], [-1.25, -3.3],
      ]), C.skin);
    }
    const earX = x - side * (3.7 + broad * 0.15);
    ellipse(image, earX, y + 0.25, 1.35, 1.75, C.outline);
    ellipse(image, earX, y + 0.25, 0.65, 1.0, back ? C.skinDeep : C.skinShade);
  } else if (diagonal) {
    const outer = [
      [-4.8 - broad * 0.3, -5.8 - tall], [-1.2, -7.3 - tall], [2.2, -7.0 - tall],
      [4.95 + broad * 0.5, -4.65], [6.0 + broad * 0.45, -1.0], [5.55 + broad * 0.35, 2.8],
      [3.55 + broad * 0.25, 5.45], [0.15, 6.55], [-3.4 - broad * 0.2, 5.45],
      [-5.35 - broad * 0.35, 2.4], [-5.65 - broad * 0.35, -2.2],
    ];
    polygon(image, orientedHeadPoints(x, y, side, outer), C.outline);
    polygon(image, orientedHeadPoints(x, y + 0.05, side, outer.map(([forward, vertical]) => [
      forward * 0.86,
      vertical > 0 ? vertical - 0.65 : vertical + 0.7,
    ])), back ? C.skinDeep : C.skinShade);
    if (!back) {
      polygon(image, orientedHeadPoints(x, y, side, [
        [-0.5, -5.8], [2.0, -5.55], [3.9, -3.7], [4.55, -0.65],
        [4.15, 2.35], [2.55, 4.55], [0.1, 5.35], [-0.9, 3.8], [-1.15, -3.5],
      ]), C.skin);
    }
    const earX = x - side * (4.15 + broad * 0.1);
    ellipse(image, earX, y + 0.3, 1.25, 1.7, C.outline);
    ellipse(image, earX, y + 0.3, 0.6, 0.95, back ? C.skinDeep : C.skinShade);
  } else {
    const halfWidth = 6.75 + broad + feminine;
    const top = y - 7.45 - tall;
    polygon(image, [
      [x - 3.8, top], [x + 3.8, top],
      [x + halfWidth - 0.45, y - 5.1], [x + halfWidth, y - 1.35],
      [x + halfWidth - 0.2, y + 2.7], [x + 3.9, y + 5.5],
      [x, y + 6.65 + tall * 0.2], [x - 3.9, y + 5.5],
      [x - halfWidth + 0.2, y + 2.7], [x - halfWidth, y - 1.35],
      [x - halfWidth + 0.5, y - 5.1],
    ], C.outline);
    polygon(image, [
      [x - 3.45, top + 0.75], [x + 3.45, top + 0.75],
      [x + halfWidth - 1.2, y - 4.65], [x + halfWidth - 0.75, y - 1.25],
      [x + halfWidth - 1.0, y + 2.25], [x + 3.25, y + 4.65],
      [x, y + 5.55], [x - 3.25, y + 4.65],
      [x - halfWidth + 1.0, y + 2.25], [x - halfWidth + 0.75, y - 1.25],
      [x - halfWidth + 1.2, y - 4.65],
    ], back ? C.skinDeep : C.skinShade);
    if (!back) {
      polygon(image, [
        [x - 2.7, y - 5.75], [x + 2.1, y - 5.75], [x + 4.55, y - 3.55],
        [x + 4.9, y + 0.9], [x + 3.05, y + 4.15], [x + 0.1, y + 5.0],
        [x - 2.55, y + 4.25], [x - 4.25, y + 1.7], [x - 4.35, y - 3.0],
      ], C.skin);
    }
    for (const earSide of [-1, 1]) {
      const earX = x + earSide * (halfWidth - 0.15);
      ellipse(image, earX, y + 0.15, 1.0, 1.55, C.outline);
      ellipse(image, earX, y + 0.15, 0.5, 0.85, back ? C.skinDeep : earSide < 0 ? C.skinShade : C.skin);
    }
  }

  if (raceId === 'elf') {
    const earY = y - 0.2;
    if (profile) {
      polygon(image, orientedHeadPoints(x, y, side, [[-3.8, -0.8], [-8.2, -2.6], [-4.6, 1.6]]), C.outline);
      line(image, x - side * 4.2, earY, x - side * 7.4, earY - 1.8, back ? C.skinDeep : C.skin, 0.75);
    } else if (diagonal) {
      polygon(image, [[x - side * 3.8, earY - 0.7], [x - side * 8.4, earY - 2.7], [x - side * 4.6, earY + 1.6]], C.outline);
      line(image, x - side * 4.25, earY, x - side * 7.55, earY - 1.8, back ? C.skinDeep : C.skinShade, 0.7);
    } else {
      for (const earSide of [-1, 1]) {
        polygon(image, [[x + earSide * 5.1, earY - 0.7], [x + earSide * 8.8, earY - 2.6], [x + earSide * 5.7, earY + 1.6]], C.outline);
        line(image, x + earSide * 5.5, earY, x + earSide * 8.0, earY - 1.7, back ? C.skinDeep : C.skin, 0.7);
      }
    }
  }

  const handScale = raceId === 'dwarf' || raceId === 'orc' ? 0.25 : raceId === 'undead' ? -0.15 : 0;
  for (const hand of [p.handLeft, p.handRight]) {
    ellipse(image, hand.x, hand.y, 2.05 + handScale, 2.35 + handScale, C.outline);
    ellipse(image, hand.x, hand.y - 0.25, 1.25 + handScale * 0.5, 1.45 + handScale * 0.5, C.skin);
    put(image, hand.x - 0.7, hand.y - 1.0, C.skinLight);
  }
}

function drawFaceV6(image, p, style, raceId = 'human') {
  if (p.direction.y < -0.45) return;
  const profile = Math.abs(p.direction.x) > 0.9;
  const diagonal = Math.abs(p.direction.x) > 0.45 && !profile;
  const side = p.direction.x < 0 ? -1 : 1;
  const x = p.head.x;
  const y = p.head.y;
  const eyeColor = C.eye;

  if (profile) {
    const eyeX = x + side * 2.3;
    const eyeY = y - 0.6;
    ellipse(image, eyeX, eyeY, 1.35, 1.75, C.outline);
    ellipse(image, eyeX + side * 0.08, eyeY, 0.78, 1.18, C.eyeWhite);
    rect(image, eyeX + side * 0.05 - 0.35, eyeY - 0.15, 0.7, 1.15, eyeColor);
    detail(image, eyeX - side * 0.2, eyeY - 0.7, '#ffffff');
    line(image, eyeX - side * 1.0, eyeY - 1.9, eyeX + side * 0.9, eyeY - (style === 'focused' ? 2.15 : 1.85), C.outlineSoft, style === 'focused' ? 0.9 : 0.7);
    if (style === 'cheerful') put(image, x + side * 2.55, y + 1.35, C.blush);
    put(image, x + side * 4.25, y + 0.25, C.skinDeep);
    line(image, x + side * 2.6, y + 2.4, x + side * 4.0, y + (style === 'cheerful' ? 2.1 : 2.55), C.outlineSoft, 0.65);
    put(image, x - side * 3.6, y + 0.2, C.skinDeep);
    if (style === 'scarred') line(image, eyeX - side * 0.6, eyeY - 2.35, eyeX + side * 0.8, eyeY + 2.0, '#8f4d4d', 0.65);
    if (style === 'freckled') {
      put(image, x + side * 2.35, y + 1.2, '#b86e58');
      put(image, x + side * 3.2, y + 1.55, '#b86e58');
    }
  } else {
    const centerX = x + (diagonal ? side * 0.45 : 0);
    const eyeY = y - 0.4;
    const eyes = diagonal
      ? [{ x: centerX - side * 1.8, far: true }, { x: centerX + side * 2.15, far: false }]
      : [{ x: centerX - 2.35, far: false }, { x: centerX + 2.35, far: false }];
    for (const eye of eyes) {
      const width = eye.far ? 1.15 : 1.45;
      if (style === 'cheerful') {
        line(image, eye.x - width * 0.65, eyeY + 0.25, eye.x, eyeY - 0.2, C.outline, 0.85);
        line(image, eye.x, eyeY - 0.2, eye.x + width * 0.65, eyeY + 0.25, C.outline, 0.85);
      } else {
        ellipse(image, eye.x, eyeY, width * 0.72, 1.65, C.outline);
        ellipse(image, eye.x, eyeY, width * 0.42, 1.08, C.eyeWhite);
        rect(image, eye.x - 0.18 + (diagonal ? side * 0.15 : 0), eyeY - 0.1, 0.68, 1.05, eyeColor);
        detail(image, eye.x - 0.2 + (diagonal ? side * 0.1 : 0), eyeY - 0.7, '#ffffff');
        const tilt = style === 'focused' ? (diagonal ? side : Math.sign(eye.x - centerX)) * 0.35 : 0;
        line(image, eye.x - width * 0.65, eyeY - 1.7 + tilt, eye.x + width * 0.65, eyeY - 1.7 - tilt, C.outlineSoft, style === 'focused' ? 0.9 : 0.65);
      }
    }
    const noseX = centerX + (diagonal ? side * 0.55 : 0);
    put(image, noseX, eyeY + 2.1, C.skinDeep);
    detail(image, noseX - (diagonal ? side * 0.4 : 0), eyeY + 1.2, C.skinLight);
    const mouthY = eyeY + 4.0;
    if (style === 'cheerful') {
      line(image, centerX - 1.35, mouthY - 0.2, centerX, mouthY + 0.45, C.outlineSoft, 0.65);
      line(image, centerX, mouthY + 0.45, centerX + 1.35, mouthY - 0.2, C.outlineSoft, 0.65);
      put(image, centerX - 4.0, eyeY + 2.6, C.blush);
      put(image, centerX + 4.0, eyeY + 2.6, C.blush);
    } else {
      line(image, centerX - 1.2, mouthY, centerX + 1.2, mouthY + (style === 'focused' ? -0.15 : 0), C.outlineSoft, 0.65);
    }
    if (style === 'scarred') line(image, centerX + 1.2, eyeY - 2.6, centerX + 3.7, eyeY + 2.9, '#8f4d4d', 0.65);
    if (style === 'freckled') {
      for (const offset of [-3.6, -2.7, 2.7, 3.6]) put(image, centerX + offset, eyeY + 2.55, '#b86e58');
    }
  }

  if (raceId === 'orc') {
    const mouthY = y + 3.6;
    for (const tuskSide of profile ? [side] : [-1, 1]) {
      polygon(image, [[x + tuskSide * 2.5, mouthY], [x + tuskSide * 3.0, mouthY + 1.8], [x + tuskSide * 3.35, mouthY - 0.15]], C.outline);
      line(image, x + tuskSide * 2.8, mouthY, x + tuskSide * 3.0, mouthY + 1.25, C.skinLight, 0.55);
    }
  }
  if (raceId === 'undead') {
    const cheekSide = profile ? -side : -1;
    line(image, x + cheekSide * 3.5, y + 1.6, x + cheekSide * 2.3, y + 3.8, C.skinDeep, 0.65);
  }
}

function drawHairV6(image, p, body, style, raceId = 'human') {
  const profile = Math.abs(p.direction.x) > 0.9;
  const back = p.direction.y < -0.45;
  const diagonal = Math.abs(p.direction.x) > 0.45 && !profile;
  const side = p.direction.x < 0 ? -1 : 1;
  const x = p.head.x;
  const y = p.head.y;
  const feminine = body === 'female';
  const longStyle = feminine && (style === 'long' || style === 'side-bangs');

  if (profile) {
    const rear = -side;
    polygon(image, orientedHeadPoints(x, y, side, [
      [-4.9, 3.7], [-5.6, -1.4], [-4.0, -5.7], [-1.2, -8.25],
      [2.0, -7.7], [4.15, -5.0], [4.5, -2.5], [2.9, -2.0], [0.4, -2.8], [-2.0, -1.2],
    ]), C.outline);
    polygon(image, orientedHeadPoints(x, y, side, [
      [-4.0, 3.1], [-4.7, -1.1], [-3.2, -5.0], [-0.9, -7.2],
      [1.6, -6.8], [3.25, -4.5], [3.45, -3.1], [2.1, -2.9], [0.2, -3.6], [-1.7, -2.1],
    ]), C.hair);
    line(image, x + rear * 3.5, y - 4.4, x + side * 0.8, y - 6.7, C.hairLight, 1);
    line(image, x + rear * 4.2, y - 0.5, x + rear * 3.7, y + 3.0, C.hairShade, 1);
  } else if (back) {
    const lower = longStyle ? y + 11 : y + 4.8;
    const half = diagonal ? 6.6 : 6.9;
    const points = diagonal
      ? orientedHeadPoints(x, y, side, [
        [-5.3, 3.8], [-5.9, -1.8], [-4.1, -5.7], [-1.2, -7.8],
        [2.2, -7.2], [5.1, -4.7], [6.0, -0.8], [5.2, 4.0],
        [3.2, lower - y], [0.2, lower - y + 0.6], [-2.8, lower - y],
      ])
      : [[x - half, y + 3.8], [x - half - 0.4, y - 1.7], [x - 4.2, y - 5.8], [x - 1.8, y - 7.6], [x + 1.8, y - 7.6], [x + 4.2, y - 5.8], [x + half + 0.4, y - 1.7], [x + half, y + 3.8], [x + 4, lower], [x, lower + 0.6], [x - 4, lower]];
    polygon(image, points, C.outline);
    const inner = points.map(([px, py]) => [x + (px - x) * 0.86, py < y ? py + 0.8 : py - 0.7]);
    polygon(image, inner, C.hair);
    line(image, x - 3.6, y - 5.1, x + 1.5, y - 6.7, C.hairLight, 1);
    line(image, x + 4.5, y - 3.5, x + 4.0, Math.min(lower - 1, y + 7), C.hairShade, 1);
  } else {
    const turn = diagonal ? side * 0.8 : 0;
    polygon(image, [
      [x - 6.4 + turn, y - 1.2], [x - 6.2 + turn, y - 4.4], [x - 3.8 + turn, y - 7.1],
      [x - 0.5 + turn, y - 8.2], [x + 3.4 + turn, y - 7.0], [x + 6.0 + turn, y - 4.2],
      [x + 6.2 + turn, y - 1.2], [x + 4.0 + turn, y - 2.6], [x + 1.7 + turn, y - 1.3],
      [x - 0.6 + turn, y - 2.6], [x - 2.9 + turn, y - 1.2], [x - 4.6 + turn, y - 2.8],
    ], C.outline);
    polygon(image, [
      [x - 5.4 + turn, y - 2.0], [x - 5.2 + turn, y - 4.0], [x - 3.1 + turn, y - 6.3],
      [x - 0.4 + turn, y - 7.2], [x + 2.9 + turn, y - 6.2], [x + 5.0 + turn, y - 3.7],
      [x + 5.2 + turn, y - 2.1], [x + 3.7 + turn, y - 3.4], [x + 1.6 + turn, y - 2.2],
      [x - 0.5 + turn, y - 3.5], [x - 2.7 + turn, y - 2.2], [x - 4.1 + turn, y - 3.5],
    ], C.hair);
    line(image, x - 3.4 + turn, y - 5.9, x + 1.3 + turn, y - 6.8, C.hairLight, 1);
  }

  if (longStyle) {
    if (profile) {
      const rear = -side;
      polygon(image, [[x + rear * 4.0, y - 1], [x + rear * 6.4, y + 1], [x + rear * 6.2, y + 11], [x + rear * 3.9, y + 13], [x + rear * 3.2, y + 8]], C.outline);
      line(image, x + rear * 4.8, y + 1, x + rear * 4.9, y + 11, C.hair, 2.2);
      line(image, x + rear * 4.5, y + 2, x + rear * 4.6, y + 9, C.hairLight, 0.75);
    } else if (!back) {
      for (const lockSide of [-1, 1]) {
        polygon(image, [[x + lockSide * 5.0, y - 1], [x + lockSide * 7.0, y + 1], [x + lockSide * 6.6, y + 11], [x + lockSide * 4.8, y + 13], [x + lockSide * 4.1, y + 7]], C.outline);
        line(image, x + lockSide * 5.5, y + 1, x + lockSide * 5.3, y + 11, lockSide < 0 ? C.hairLight : C.hair, 2.1);
      }
    }
  }

  if (style === 'side-bangs' && !back) {
    const bangSide = profile ? side : p.direction.x > 0 ? -1 : 1;
    line(image, x + bangSide * 3.8, y - 4.8, x + bangSide * 4.7, y + 2.2, C.outline, 2.8);
    line(image, x + bangSide * 3.8, y - 4.8, x + bangSide * 4.7, y + 1.6, C.hair, 1.1);
  }
  if (style === 'windswept' || style === 'tousled') {
    const sweep = style === 'windswept' ? (profile ? side : 1) : -1;
    const offsets = profile ? [-2, 1.5] : [-3.5, 0, 3.5];
    for (const offset of offsets) {
      polygon(image, [[x + offset - 1.5, y - 6.3], [x + offset + sweep * 2.3, y - 9.3], [x + offset + 1.7, y - 6.1]], C.outline);
      line(image, x + offset - 0.7, y - 6.8, x + offset + sweep * 1.2, y - 8.0, C.hair, 1.5);
    }
  }
  if (style === 'bun') {
    const bunX = x + (profile ? -side * 2.8 : back && diagonal ? -side * 1.5 : 0);
    const bunY = y - 9.2;
    ellipse(image, bunX, bunY, 3.5, 3.0, C.outline);
    ellipse(image, bunX, bunY, 2.5, 2.0, C.hair);
    put(image, bunX - 1, bunY - 0.8, C.hairLight);
  }
  if (style === 'tied' || style === 'ponytail') {
    const rear = profile ? -side : p.direction.x > 0.1 ? -1 : p.direction.x < -0.1 ? 1 : 0;
    const tieX = x + rear * 5.2;
    const tieY = y + 1.5;
    ellipse(image, tieX, tieY, 1.5, 1.5, C.outline);
    put(image, tieX, tieY, C.gold);
    const length = style === 'ponytail' ? 10 : 7;
    polygon(image, [[tieX - 1.5, tieY + 1], [tieX + 1.5, tieY + 1], [tieX + rear * 2 + 1.2, tieY + length - 1], [tieX + rear * 0.5, tieY + length + 1], [tieX + rear * 2 - 1.2, tieY + length - 1]], C.outline);
    line(image, tieX + rear * 0.2, tieY + 2, tieX + rear * 1.1, tieY + length - 1, C.hair, 2);
    put(image, tieX + rear, tieY + length - 2, C.hairLight);
  }

  if (raceId === 'elf' && !back) {
    put(image, x + (profile ? side * 0.5 : 0), y - 3.6, C.goldLight);
  }
  if (raceId === 'dwarf' && body === 'male' && !back) {
    put(image, x - (profile ? side * 3.8 : 4.5), y + 2.2, C.goldDeep);
  }
  if (raceId === 'orc' && (style === 'windswept' || style === 'tousled')) {
    line(image, x - (profile ? side * 2.5 : 3.2), y - 7.1, x + (profile ? side * 2.5 : 3.2), y - 7.1, C.hairDeep, 1.2);
  }
  if (raceId === 'undead') {
    const raggedSide = profile ? -side : -1;
    polygon(image, [[x + raggedSide * 4.5, y - 5.3], [x + raggedSide * 7.2, y - 2.7], [x + raggedSide * 4.9, y - 0.8]], C.outline);
    line(image, x + raggedSide * 4.7, y - 4.4, x + raggedSide * 6.1, y - 2.8, C.hairShade, 1.1);
  }
}

function drawBeardV5(image, p, style, raceId = 'human') {
  if (p.direction.y < -0.45) return;
  const profile = Math.abs(p.direction.x) > 0.9;
  const diagonal = Math.abs(p.direction.x) > 0.45 && !profile;
  const side = p.direction.x < 0 ? -1 : 1;
  const x = p.head.x;
  const y = p.head.y;
  const long = style === 'full';
  if (profile) {
    polygon(image, orientedHeadPoints(x, y, side, [
      [2.2, 2.4], [4.3, 2.0], [4.1, 4.3], [2.4, long ? 9.8 : 7.1],
      [0.2, long ? 11.3 : 7.8], [-2.0, long ? 8.8 : 6.7], [-2.6, 4.4],
    ]), C.outline);
    polygon(image, orientedHeadPoints(x, y, side, [
      [2.3, 3.0], [3.5, 2.7], [3.2, 4.2], [1.9, long ? 8.6 : 6.1],
      [0.1, long ? 9.9 : 6.7], [-1.4, long ? 7.8 : 5.8], [-1.8, 4.3],
    ]), C.hair);
  } else {
    const turn = diagonal ? side * 0.8 : 0;
    const bottom = y + (long ? 12.0 : 8.2);
    polygon(image, [
      [x - 4.1 + turn, y + 2.4], [x - 3.5 + turn, y + 5.3],
      [x - 2.0 + turn, bottom - 1.0], [x + turn, bottom], [x + 2.0 + turn, bottom - 1.0],
      [x + 3.5 + turn, y + 5.3], [x + 4.1 + turn, y + 2.4],
      [x + 1.6 + turn, y + 4.2], [x + turn, y + 3.6], [x - 1.6 + turn, y + 4.2],
    ], C.outline);
    polygon(image, [
      [x - 3.25 + turn, y + 3.1], [x - 2.7 + turn, y + 5.3],
      [x - 1.4 + turn, bottom - 1.4], [x + turn, bottom - 0.9], [x + 1.4 + turn, bottom - 1.4],
      [x + 2.7 + turn, y + 5.3], [x + 3.25 + turn, y + 3.1],
      [x + 1.2 + turn, y + 4.9], [x + turn, y + 4.4], [x - 1.2 + turn, y + 4.9],
    ], C.hair);
  }
  line(image, x - (profile ? side * 0.2 : 1.6), y + 5.1, x + (profile ? side * 1.0 : 1.2), y + (long ? 8.8 : 6.7), C.hairLight, 0.8);
  if (raceId === 'dwarf' && long) {
    for (const braidSide of profile ? [-side] : [-1, 1]) {
      const braidX = x + braidSide * 2.2;
      line(image, braidX, y + 7, braidX + braidSide * 0.5, y + 12, C.outline, 2.5);
      line(image, braidX, y + 7, braidX + braidSide * 0.5, y + 11, C.hair, 1.1);
      put(image, braidX + braidSide * 0.5, y + 10.5, C.gold);
    }
  }
}

function drawOutfitPolishV6(image, p, classId, variant, raceId = 'human') {
  const palette = CLASS_PALETTES[classId];
  const back = p.direction.y < -0.45;
  const profile = Math.abs(p.direction.x) > 0.9;
  const side = p.direction.x < 0 ? -1 : 1;
  const x = p.root.x;
  const y = p.root.y;
  const gold = classId === 'mage' || classId === 'paladin' || classId === 'priest';
  const trimDeep = gold ? C.goldDeep : palette.accentDeep;
  const trim = gold ? C.gold : palette.accent;
  const trimLight = gold ? C.goldLight : palette.accentLight;

  // A shared three-tone rim makes every class read as the same premium sprite
  // family, while the class-specific construction below preserves silhouettes.
  if (profile) {
    line(image, x - side * 1.5, 24 + y, x + side * 4.8, 25 + y, palette.light, 0.75);
    line(image, x - side * 2.4, 35 + y, x + side * 3.7, 35 + y, trimDeep, 1.1);
  } else {
    line(image, x - 5.2, 23 + y, x - 3.4, 31 + y, palette.light, 0.8);
    line(image, x + 5.2, 24 + y, x + 3.8, 31 + y, palette.deep, 0.8);
    line(image, x - 4.8, 35 + y, x + 4.8, 35 + y, trimDeep, 1.1);
  }

  if (classId === 'mage' || classId === 'priest') {
    const hemY = classId === 'mage' ? 43 + y : 44 + y;
    const hemHalf = profile ? 5.2 : variant === 'veteran' ? 8.2 : 7.2;
    line(image, x - hemHalf, hemY - 1, x + hemHalf, hemY - 1, trim, 1.05);
    put(image, x - hemHalf + 1, hemY - 2, trimLight);
    if (!back) {
      line(image, x, 27 + y, x, hemY - 2, trim, 1.0);
      polygon(image, [[x, 27 + y], [x + 1.6, 29 + y], [x, 31 + y], [x - 1.6, 29 + y]], trimLight);
    } else {
      line(image, x - 3.6, 27 + y, x, 31 + y, trim, 0.75);
      line(image, x + 3.6, 27 + y, x, 31 + y, trimDeep, 0.75);
    }
  }

  if (classId === 'hunter') {
    const directionBias = profile ? side * 1.2 : p.direction.x * 0.8;
    polygon(image, [
      [x - 6 + directionBias, 21 + y], [x, 19.5 + y], [x + 6 + directionBias, 21 + y],
      [x + 4 + directionBias, 25 + y], [x, 23.5 + y], [x - 4 + directionBias, 25 + y],
    ], palette.shade);
    line(image, x - 4 + directionBias, 23 + y, x + 4 + directionBias, 23 + y, palette.light, 0.8);
    line(image, x - side * 5, 25 + y, x + side * 5, 35 + y, trim, 1.4);
    put(image, x + side * 1.2, 30 + y, trimLight);
  }

  if (classId === 'paladin' || classId === 'warrior') {
    const metal = classId === 'paladin' ? C.gold : C.metal;
    const metalLight = classId === 'paladin' ? C.goldLight : C.metalLight;
    for (const shoulder of [p.shoulderLeft, p.shoulderRight]) {
      line(image, shoulder.x - 1.6, shoulder.y - 1.1, shoulder.x + 1.1, shoulder.y - 1.1, metalLight, 0.8);
      put(image, shoulder.x + 1.4, shoulder.y + 0.4, metal);
    }
    if (!back) {
      line(image, x - 3.4, 25 + y, x, 29 + y, metalLight, 0.8);
      line(image, x + 3.4, 25 + y, x, 29 + y, metal, 0.8);
      ellipse(image, x, 29 + y, 1.45, 1.45, C.outline);
      put(image, x, 29 + y, classId === 'paladin' ? C.goldLight : palette.main);
    }
    for (const foot of [p.footLeft, p.footRight]) {
      line(image, foot.x - 1.7, foot.y - 2.5, foot.x + 1.2, foot.y - 2.5, metal, 0.7);
    }
  }

  if (classId === 'rogue') {
    line(image, x - side * 5.3, 25 + y, x + side * 4.8, 35 + y, palette.accent, 1.25);
    put(image, x, 30 + y, palette.accentLight);
    if (!back) {
      for (const buckleX of [-3.6, 3.6]) {
        rect(image, x + buckleX - 0.9, 34 + y, 1.8, 1.8, C.goldDeep);
        put(image, x + buckleX, 34 + y, C.gold);
      }
    }
  }

  if (variant === 'runed') {
    const runeY = back ? 29 + y : 37 + y;
    for (const offset of profile ? [side * 2] : [-3, 0, 3]) put(image, x + offset, runeY, trimLight);
  } else if (variant === 'veteran') {
    put(image, x - (profile ? side * 2 : 3), 27 + y, C.metalLight);
    put(image, x + (profile ? side * 2 : 3), 31 + y, C.metalDeep);
  } else if (variant === 'dark') {
    line(image, x - (profile ? 2 : 4), 36 + y, x + (profile ? 2 : 4), 36 + y, palette.deep, 1.2);
  }

  if (raceId === 'elf') put(image, x - (profile ? side * 3 : 4), 24 + y, trimLight);
  if (raceId === 'dwarf') put(image, x, 35 + y, C.goldLight);
  if (raceId === 'orc') line(image, x - 3, 36 + y, x + 3, 36 + y, C.woodDeep, 1.2);
  if (raceId === 'undead') put(image, x + (profile ? side * 2 : 3), 37 + y, palette.accentLight);
}

function drawHeadwearV6(image, p, classId, variant, raceId = 'human') {
  const palette = CLASS_PALETTES[classId];
  const profile = Math.abs(p.direction.x) > 0.9;
  const diagonal = Math.abs(p.direction.x) > 0.45 && !profile;
  const back = p.direction.y < -0.45;
  const side = p.direction.x < 0 ? -1 : 1;
  const x = p.head.x;
  const y = p.head.y;
  const turn = profile ? side * 1.45 : diagonal ? side * 0.85 : 0;
  const variantSpark = variant === 'runed'
    ? palette.accentLight
    : variant === 'dark'
      ? palette.deep
      : variant === 'veteran'
        ? C.metalLight
        : palette.light;

  if (classId === 'mage') {
    const brimY = y - 5.2;
    const brimHalf = profile ? 7.0 : 8.2;
    polygon(image, [
      [x - brimHalf + turn, brimY - 1.1], [x + brimHalf + turn, brimY - 1.1],
      [x + brimHalf + 1 + turn, brimY + 1.1], [x + 1.2 + turn, brimY + 2.0],
      [x - brimHalf - 1 + turn, brimY + 1.0],
    ], C.outline);
    polygon(image, [
      [x - brimHalf + 0.7 + turn, brimY - 0.45], [x + brimHalf - 0.5 + turn, brimY - 0.45],
      [x + brimHalf + turn, brimY + 0.55], [x + 0.8 + turn, brimY + 1.05],
      [x - brimHalf + turn, brimY + 0.45],
    ], palette.main);
    const apexX = x + turn + (profile ? side * 1.5 : diagonal ? side * 1.2 : -1.0);
    const cone = [
      [x - 4.8 + turn, brimY - 0.7], [apexX, y - 12.1],
      [x + 2.0 + turn, y - 9.6], [x + 5.2 + turn, brimY - 0.7],
    ];
    polygon(image, cone, C.outline);
    polygon(image, [
      [x - 3.9 + turn, brimY - 1.0], [apexX + 0.15, y - 10.9],
      [x + 1.8 + turn, y - 8.8], [x + 4.2 + turn, brimY - 1.0],
    ], palette.main);
    polygon(image, [
      [x - 3.8 + turn, brimY - 2.1], [x + 4.0 + turn, brimY - 2.1],
      [x + 4.5 + turn, brimY - 0.55], [x - 4.2 + turn, brimY - 0.55],
    ], C.goldDeep);
    line(image, x - 3.2 + turn, brimY - 1.6, x + 3.7 + turn, brimY - 1.6, C.gold, 1.0);
    put(image, x - 1.8 + turn, y - 8.2, variantSpark);
    if (variant === 'runed' || variant === 'veteran') {
      polygon(image, [[x + 1.2 + turn, y - 7.9], [x + 2.1 + turn, y - 6.6], [x + 1.2 + turn, y - 5.4], [x + 0.3 + turn, y - 6.6]], C.goldLight);
    }
    return;
  }

  if (classId === 'paladin') {
    const bandY = y - 4.25;
    line(image, x - 5.4 + turn * 0.25, bandY, x + 5.4 + turn * 0.25, bandY, C.outline, 2.0);
    line(image, x - 4.9 + turn * 0.25, bandY - 0.25, x + 4.9 + turn * 0.25, bandY - 0.25, C.gold, 0.9);
    polygon(image, [[x - 1.4 + turn, bandY], [x + turn, bandY - 2.5], [x + 1.4 + turn, bandY], [x + turn, bandY + 1.2]], C.outline);
    put(image, x + turn, bandY - 0.3, palette.accentLight);
    put(image, x - 2.6 + turn, bandY - 0.4, variantSpark);
    return;
  }

  if (classId === 'warrior') {
    const bandY = y - 3.9;
    polygon(image, [
      [x - 5.8 + turn, bandY - 1.1], [x + 5.8 + turn, bandY - 1.1],
      [x + 5.2 + turn, bandY + 1.3], [x - 5.2 + turn, bandY + 1.3],
    ], C.outline);
    rect(image, x - 5.0 + turn, bandY - 0.45, 10, 1.45, palette.main);
    line(image, x - 4.2 + turn, bandY - 0.2, x + 1.5 + turn, bandY - 0.2, palette.light, 0.65);
    put(image, x + 2.8 + turn, bandY - 0.1, variantSpark);
    if (back || profile) {
      const tailX = x - side * 5.0 + turn;
      polygon(image, [[tailX, bandY + 0.2], [tailX - side * 2.7, bandY + 3.0], [tailX - side * 0.7, bandY + 4.8]], palette.deep);
    }
    return;
  }

  const hoodMain = classId === 'priest' ? palette.main : classId === 'hunter' ? palette.shade : palette.main;
  const hoodDeep = classId === 'priest' ? palette.shade : palette.deep;
  const edge = classId === 'priest' ? C.gold : palette.accent;
  const topPoints = [
    [x - 5.8 + turn, y - 0.5], [x - 6.0 + turn, y - 4.2], [x - 3.5 + turn, y - 7.5],
    [x + turn, y - 8.8], [x + 3.6 + turn, y - 7.2], [x + 6.0 + turn, y - 3.8],
    [x + 5.7 + turn, y - 0.4], [x + 3.9 + turn, y - 2.4], [x + 2.5 + turn, y - 5.6],
    [x + turn, y - 6.8], [x - 2.5 + turn, y - 5.6], [x - 4.0 + turn, y - 2.4],
  ];
  polygon(image, topPoints, C.outline);
  polygon(image, topPoints.map(([px, py], index) => [x + (px - x) * 0.84, py + (index < 7 ? 0.75 : 0.1)]), hoodMain);
  line(image, x - 3.1 + turn, y - 6.5, x + 0.2 + turn, y - 7.6, variantSpark, 0.8);

  if (back) {
    polygon(image, [
      [x - 5.0 + turn, y - 1], [x + 5.0 + turn, y - 1], [x + 5.5 + turn, y + 5.3],
      [x + 2.2 + turn, y + 7.3], [x - 2.2 + turn, y + 7.3], [x - 5.5 + turn, y + 5.3],
    ], C.outline);
    polygon(image, [
      [x - 4.1 + turn, y - 0.7], [x + 4.1 + turn, y - 0.7], [x + 4.5 + turn, y + 4.7],
      [x + 1.8 + turn, y + 6.3], [x - 1.8 + turn, y + 6.3], [x - 4.5 + turn, y + 4.7],
    ], hoodDeep);
    line(image, x - 3.2 + turn, y + 2.8, x + turn, y + 4.2, edge, 0.8);
    line(image, x + turn, y + 4.2, x + 3.2 + turn, y + 2.8, hoodDeep, 0.8);
  } else {
    const openingHalf = profile ? 3.5 : 4.6;
    for (const hoodSide of profile ? [-side] : [-1, 1]) {
      const outerX = x + hoodSide * (openingHalf + 1.0) + turn;
      const innerX = x + hoodSide * openingHalf + turn;
      polygon(image, [
        [outerX, y - 2.7], [innerX, y - 3.4], [innerX, y + 4.5],
        [x + hoodSide * (openingHalf + 0.1) + turn, y + 7.0], [outerX + hoodSide * 1.2, y + 5.2],
      ], C.outline);
      line(image, outerX, y - 2.0, x + hoodSide * (openingHalf + 0.6) + turn, y + 5.6, hoodDeep, 2.0);
      line(image, innerX, y - 2.8, innerX, y + 4.4, edge, 0.7);
    }
    if (classId === 'hunter') {
      const featherSide = profile ? -side : -1;
      polygon(image, [[x + featherSide * 3.7 + turn, y - 7.2], [x + featherSide * 7.0 + turn, y - 10.0], [x + featherSide * 5.2 + turn, y - 5.9]], C.outline);
      line(image, x + featherSide * 4.2 + turn, y - 7.1, x + featherSide * 6.1 + turn, y - 8.8, palette.accentLight, 1.0);
    }
  }

  if (raceId === 'elf' && !back) put(image, x - side * 5.0 + turn, y - 2.5, C.goldLight);
  if (raceId === 'dwarf') line(image, x - 3 + turn, y - 5.7, x + 1 + turn, y - 6.8, C.goldDeep, 0.7);
  if (raceId === 'orc') put(image, x + side * 4.5 + turn, y - 3, C.woodLight);
  if (raceId === 'undead') put(image, x - side * 3.5 + turn, y - 5.5, palette.accentLight);
}

function drawLayer(kind, options, row, column) {
  const image = frame();
  const p = poseV6(row, column, options.raceId);
  if (kind === 'body') drawBodyV6(image, p, options.body, options.raceId);
  if (kind === 'face') drawFaceV6(image, p, options.style, options.raceId);
  if (kind === 'heritage') drawHeritage(image, p, options.style, options.raceId);
  if (kind === 'hair') drawHairV6(image, p, options.body, options.style, options.raceId);
  if (kind === 'beard') drawBeardV5(image, p, options.style, options.raceId);
  if (kind === 'cape') drawCape(image, p, options.style);
  if (kind === 'outfit') {
    drawOutfit(image, p, options.classId, options.body, options.variant, options.raceId);
    drawOutfitPolishV6(image, p, options.classId, options.variant, options.raceId);
  }
  if (kind === 'headwear') drawHeadwearV6(image, p, options.classId, options.variant, options.raceId);
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

// Small bounded repair mode for iterating on race-owned facial markings. It
// deliberately rewrites only heritage atlases and never removes a live root.
if (process.argv.includes('--heritage-only')) {
  let heritageAssetCount = 0;
  for (const raceId of races) {
    const outputRoot = resolve(characterRoot, `${raceId}_fresh`);
    if (!outputRoot.startsWith(`${characterRoot}${sep}`)) {
      throw new Error(`Refusing to generate outside the character asset root: ${outputRoot}`);
    }
    for (const style of heritageStyles[raceId]) {
      write(outputRoot, `heritage/${style}.png`, createAtlas('heritage', { raceId, style }));
      heritageAssetCount += 1;
    }
  }
  console.log(`Regenerated ${heritageAssetCount} v6 heritage atlases.`);
  process.exit(0);
}

if (process.argv.includes('--headwear-only')) {
  let headwearAssetCount = 0;
  for (const raceId of races) {
    const outputRoot = resolve(characterRoot, `${raceId}_fresh`);
    if (!outputRoot.startsWith(`${characterRoot}${sep}`)) {
      throw new Error(`Refusing to generate outside the character asset root: ${outputRoot}`);
    }
    for (const classId of raceClasses[raceId]) {
      for (const body of bodies) {
        for (const variant of outfitVariants) {
          write(
            outputRoot,
            `classes/${classId}/${body}/headwear/${variant}.png`,
            createAtlas('headwear', { raceId, classId, body, variant }),
          );
          headwearAssetCount += 1;
        }
      }
    }
  }
  console.log(`Regenerated ${headwearAssetCount} v6 headwear atlases.`);
  process.exit(0);
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
    model: modelId,
    version: modelVersion,
    race: raceId,
    allowedClasses,
    provenance: 'Authored from scratch by scripts/generate-human-fresh-assets.mjs using the v6 shared directional rig; reads no prior character sprite files.',
    frame: {
      size: frameSize,
      logicalSize,
      pixelScale: scale,
      designSize,
      detailScale,
      columns,
      rows,
      directions: directions.map(({ id }) => id),
      idle: [0],
      walk: [1, 2, 3, 4],
      attack: [5, 6, 7, 8],
    },
    architecture: {
      layers: ['cape', 'body', 'outfit', 'face', 'heritage', 'beard', 'hair', 'headwear', 'offhand', 'weapon'],
      anchorContract: 'Every race and layer is drawn independently from one v6 eight-direction screen-space skeleton with shared head, hand, hip, shoulder, and foot anchors.',
      faceContract: 'Front, diagonal, profile, rear-diagonal, and back skull volumes are authored separately; faces use expressive multi-tone eyes and never render through rear views.',
      headwearContract: 'Every class owns an independent headwear layer that rotates in eight directions while preserving readable hair and face customization.',
      colorContract: 'Exact canonical palettes are replaced at runtime for race skin, eyes, hair, clothing, trim, and weapon finish.',
    },
    bodies: {},
    faces: { male: {}, female: {} },
    heritage: {},
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
  for (const style of heritageStyles[raceId]) {
    manifest.heritage[style] = write(
      outputRoot,
      `heritage/${style}.png`,
      createAtlas('heritage', { raceId, style }),
    );
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
      const group = { outfits: {}, headwear: {}, weapons: {}, offhands: {} };
      for (const variant of outfitVariants) {
        group.outfits[variant] = write(
          outputRoot,
          `classes/${classId}/${body}/outfits/${variant}.png`,
          createAtlas('outfit', { raceId, classId, body, variant }),
        );
        group.headwear[variant] = write(
          outputRoot,
          `classes/${classId}/${body}/headwear/${variant}.png`,
          createAtlas('headwear', { raceId, classId, body, variant }),
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
    '- New v6 48x48 logical skeleton rendered as crisp two-pixel clusters into 96x96 frames.',
    '- Eight directions, four walk poses, and four class attack poses.',
    '- Independent body, face, heritage detail, hair, beard, cape, outfit, class headwear, main-hand, and tank offhand atlases.',
    '- Rounded expressive faces, layered garments, gold piping, and three-tone materials follow the v6 style targets without copying a reference character.',
    '- Cardinal profiles use a rounded forehead/nose/cheek/chin silhouette; diagonal and back views share the same compact skull volume.',
    '- Large readable eyes use separate outline, sclera, iris, and highlight clusters without becoming mask-like.',
    '- Hats, hoods, circlets, and headbands rotate independently and preserve meaningful hair customization underneath.',
    '- Each race owns three heritage-detail styles in addition to race-specific face, hair, color, outfit, and weapon treatment.',
    '- Warrior and paladin creation/DPS visuals use one sword; Tank-role talents add a shield layer.',
    '- All layers use identical pose anchors, preventing drifting or floating equipment.',
    '',
  ].join('\n'));

  const raceAssetCount = 2 + 8 + 3 + 8 + 2 + 2
    + allowedClasses.length * bodies.length * 13
    + allowedClasses.filter((classId) => classId === 'warrior' || classId === 'paladin').length * bodies.length * 5;
  totalAssetCount += raceAssetCount;
  console.log(`Generated ${raceAssetCount} ${raceId} atlases at ${relative(root, outputRoot)}.`);
}

console.log(`Generated ${totalAssetCount} from-scratch ${modelId} atlases for ${races.join(', ')}.`);
