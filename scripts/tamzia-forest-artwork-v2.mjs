import { PNG } from 'pngjs';

const FOREST_FRAME_WIDTH = 128;
const FOREST_FRAME_HEIGHT = 160;
const FOREST_COLUMNS = 8;
const FOREST_ROWS = 8;
const BANDIT_FRAME_WIDTH = 128;
const BANDIT_FRAME_HEIGHT = 128;
const BANDIT_COLUMNS = 5;
const BANDIT_ROWS = 4;
const PIXEL = 2;

const PALETTE = {
  shadow: [17, 45, 29, 76],
  trunkDark: [69, 47, 30, 255],
  trunk: [111, 76, 43, 255],
  trunkLight: [151, 108, 61, 210],
  oak: { outline: [27, 67, 40, 255], dark: [43, 101, 51, 255], mid: [67, 128, 63, 255], light: [118, 157, 77, 210] },
  deep: { outline: [22, 57, 38, 255], dark: [34, 82, 45, 255], mid: [49, 106, 53, 255], light: [86, 132, 67, 190] },
  pine: { outline: [24, 61, 47, 255], dark: [31, 78, 55, 255], mid: [48, 105, 65, 255], light: [84, 133, 74, 190] },
  birch: { outline: [39, 81, 46, 255], dark: [52, 111, 58, 255], mid: [83, 143, 67, 255], light: [147, 180, 91, 205] },
};

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function hash01(a, b = 0, c = 0) {
  const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function createPng(width, height) {
  const png = new PNG({ width, height, colorType: 6, inputColorType: 6 });
  png.data.fill(0);
  return png;
}

function setPixel(png, x, y, rgba) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= png.width || py >= png.height || !rgba[3]) return;
  const index = (py * png.width + px) * 4;
  const sourceAlpha = rgba[3] / 255;
  const destinationAlpha = png.data[index + 3] / 255;
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  png.data[index] = Math.round((rgba[0] * sourceAlpha + png.data[index] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha);
  png.data[index + 1] = Math.round((rgba[1] * sourceAlpha + png.data[index + 1] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha);
  png.data[index + 2] = Math.round((rgba[2] * sourceAlpha + png.data[index + 2] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha);
  png.data[index + 3] = Math.round(outputAlpha * 255);
}

function getPixel(png, x, y) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return [0, 0, 0, 0];
  const index = (y * png.width + x) * 4;
  return [png.data[index], png.data[index + 1], png.data[index + 2], png.data[index + 3]];
}

function rect(png, x, y, width, height, rgba) {
  const startX = Math.floor(x);
  const startY = Math.floor(y);
  for (let py = startY; py < Math.ceil(y + height); py += 1) {
    for (let px = startX; px < Math.ceil(x + width); px += 1) setPixel(png, px, py, rgba);
  }
}

function pixelEllipse(png, centerX, centerY, radiusX, radiusY, rgba) {
  for (let y = Math.floor(centerY - radiusY); y <= Math.ceil(centerY + radiusY); y += PIXEL) {
    for (let x = Math.floor(centerX - radiusX); x <= Math.ceil(centerX + radiusX); x += PIXEL) {
      const dx = (x - centerX) / Math.max(1, radiusX);
      const dy = (y - centerY) / Math.max(1, radiusY);
      if (dx * dx + dy * dy <= 1) rect(png, x, y, PIXEL, PIXEL, rgba);
    }
  }
}

function line(png, x1, y1, x2, y2, width, rgba) {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / PIXEL));
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    pixelEllipse(png, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, width / 2, rgba);
  }
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];
    if (((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1) + a.x) inside = !inside;
  }
  return inside;
}

function polygon(png, points, rgba) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += PIXEL) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += PIXEL) {
      if (pointInPolygon({ x, y }, points)) rect(png, x, y, PIXEL, PIXEL, rgba);
    }
  }
}

function tileOrigin(tileId, columns, frameWidth, frameHeight) {
  return {
    x: (tileId % columns) * frameWidth,
    y: Math.floor(tileId / columns) * frameHeight,
  };
}

function drawShadow(png, originX, originY, width = 40, y = 143) {
  pixelEllipse(png, originX + 64, originY + y, width, 8, PALETTE.shadow);
}

function drawTrunk(png, originX, originY, x, y, width, height, options = {}) {
  const dark = options.dark ?? PALETTE.trunkDark;
  const mid = options.mid ?? PALETTE.trunk;
  const light = options.light ?? PALETTE.trunkLight;
  rect(png, originX + x - 2, originY + y, width + 4, height, dark);
  rect(png, originX + x, originY + y, width, height, mid);
  rect(png, originX + x + 2, originY + y + 3, Math.max(2, width * 0.34), height - 5, light);
  for (let stripe = 0; stripe < Math.max(2, Math.floor(height / 13)); stripe += 1) {
    line(png, originX + x + width - 3, originY + y + 5 + stripe * 12, originX + x + width - 7, originY + y + 10 + stripe * 12, 1, dark);
  }
}

function drawCanopy(png, originX, originY, centerX, centerY, radiusX, radiusY, palette, seed, sway = 0) {
  const x = originX + centerX + sway;
  const y = originY + centerY;
  pixelEllipse(png, x, y + 2, radiusX + 4, radiusY + 4, palette.outline);
  pixelEllipse(png, x, y, radiusX, radiusY, palette.dark);
  pixelEllipse(png, x - radiusX * 0.14, y - radiusY * 0.12, radiusX * 0.78, radiusY * 0.76, palette.mid);
  pixelEllipse(png, x - radiusX * 0.32, y - radiusY * 0.34, radiusX * 0.34, radiusY * 0.25, palette.light);
  for (let index = 0; index < 6; index += 1) {
    const px = x - radiusX * 0.65 + hash01(seed, index, 91) * radiusX * 1.3;
    const py = y - radiusY * 0.48 + hash01(seed, index, 92) * radiusY * 0.96;
    const color = index % 3 === 0 ? palette.light : index % 2 ? palette.mid : palette.dark;
    rect(png, px, py, 3, 3, color);
  }
}

function drawOak(png, tileId, frame, palette = PALETTE.oak, scale = 1) {
  const { x, y } = tileOrigin(tileId, FOREST_COLUMNS, FOREST_FRAME_WIDTH, FOREST_FRAME_HEIGHT);
  const sway = Math.round(Math.sin((frame / 8) * Math.PI * 2) * 2);
  drawShadow(png, x, y, 42 * scale, 145);
  drawTrunk(png, x, y, 56, 91, 15 * scale, 52 * scale);
  line(png, x + 62, y + 101, x + 39, y + 77, 5, PALETTE.trunkDark);
  line(png, x + 65, y + 96, x + 88, y + 70, 5, PALETTE.trunkDark);
  drawCanopy(png, x, y, 43, 62, 28 * scale, 27 * scale, palette, 1, sway);
  drawCanopy(png, x, y, 66, 45, 32 * scale, 31 * scale, palette, 2, sway);
  drawCanopy(png, x, y, 88, 64, 29 * scale, 27 * scale, palette, 3, sway);
  drawCanopy(png, x, y, 60, 77, 42 * scale, 32 * scale, palette, 4, sway);
  drawCanopy(png, x, y, 80, 86, 28 * scale, 24 * scale, palette, 5, sway);
}

function drawPine(png, tileId, frame, palette = PALETTE.pine, width = 1) {
  const { x, y } = tileOrigin(tileId, FOREST_COLUMNS, FOREST_FRAME_WIDTH, FOREST_FRAME_HEIGHT);
  const sway = Math.round(Math.sin((frame / 8) * Math.PI * 2) * 2);
  drawShadow(png, x, y, 32 * width, 146);
  drawTrunk(png, x, y, 59, 94, 10, 52, { mid: [91, 61, 37, 255], light: [128, 88, 47, 190] });
  const tiers = [
    [65, 22, 20, 34],
    [63, 45, 31, 42],
    [66, 72, 41, 47],
    [64, 102, 50, 40],
  ];
  tiers.forEach(([centerX, centerY, radiusX, radiusY], index) => {
    const center = x + centerX + (index % 2 ? -sway : sway);
    polygon(png, [{ x: center, y: y + centerY - radiusY }, { x: center + radiusX * width, y: y + centerY + radiusY }, { x: center - radiusX * width, y: y + centerY + radiusY }], palette.outline);
    polygon(png, [{ x: center, y: y + centerY - radiusY + 5 }, { x: center + (radiusX - 5) * width, y: y + centerY + radiusY - 3 }, { x: center - (radiusX - 5) * width, y: y + centerY + radiusY - 3 }], index % 2 ? palette.dark : palette.mid);
    line(png, center - radiusX * 0.25, y + centerY, center + radiusX * 0.25, y + centerY + radiusY * 0.32, 1, palette.light);
  });
}

function drawBirch(png, tileId, frame, scale = 1) {
  const { x, y } = tileOrigin(tileId, FOREST_COLUMNS, FOREST_FRAME_WIDTH, FOREST_FRAME_HEIGHT);
  const sway = Math.round(Math.sin((frame / 8) * Math.PI * 2 + 1.2) * 1);
  drawShadow(png, x, y, 27 * scale, 141);
  drawTrunk(png, x, y, 59, 79, 10 * scale, 59 * scale, { dark: [88, 88, 77, 255], mid: [209, 205, 177, 255], light: [240, 232, 196, 220] });
  rect(png, x + 60, y + 92, 7, 3, [59, 58, 49, 210]);
  rect(png, x + 61, y + 110, 6, 3, [59, 58, 49, 210]);
  drawCanopy(png, x, y, 49, 57, 23 * scale, 22 * scale, PALETTE.birch, 11, sway);
  drawCanopy(png, x, y, 68, 42, 29 * scale, 25 * scale, PALETTE.birch, 12, sway);
  drawCanopy(png, x, y, 82, 64, 24 * scale, 23 * scale, PALETTE.birch, 13, sway);
  drawCanopy(png, x, y, 64, 78, 31 * scale, 24 * scale, PALETTE.birch, 14, sway);
}

function drawForestDetail(png, tileId, key) {
  const { x, y } = tileOrigin(tileId, FOREST_COLUMNS, FOREST_FRAME_WIDTH, FOREST_FRAME_HEIGHT);
  if (key === 'bramble_bush' || key === 'round_bush') {
    drawShadow(png, x, y, key === 'bramble_bush' ? 33 : 29, 143);
    drawCanopy(png, x, y, 48, 119, 24, 18, PALETTE.deep, 31);
    drawCanopy(png, x, y, 71, 113, 27, 20, PALETTE.oak, 32);
    drawCanopy(png, x, y, 85, 122, 19, 15, PALETTE.deep, 33);
    if (key === 'bramble_bush') {
      rect(png, x + 45, y + 125, 3, 3, [133, 74, 91, 230]);
      rect(png, x + 78, y + 105, 3, 3, [151, 79, 97, 230]);
    }
  } else if (key === 'fern_cluster') {
    drawShadow(png, x, y, 26, 144);
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI * 0.94 + index * 0.22;
      const length = 20 + (index % 3) * 5;
      line(png, x + 64, y + 139, x + 64 + Math.cos(angle) * length, y + 139 + Math.sin(angle) * length, 2, index % 2 ? [72, 132, 68, 235] : [102, 154, 76, 225]);
    }
  } else if (key === 'grass_tuft') {
    for (let index = 0; index < 14; index += 1) {
      const baseX = x + 42 + index * 3;
      line(png, baseX, y + 145, baseX + ((index % 3) - 1) * 5, y + 122 - (index % 4) * 3, 2, index % 2 ? [95, 143, 72, 230] : [53, 112, 59, 240]);
    }
  } else if (key === 'leaf_patch') {
    drawShadow(png, x, y, 40, 142);
    for (let index = 0; index < 19; index += 1) {
      const px = x + 29 + ((index * 13) % 68);
      const py = y + 128 + ((index * 7) % 19);
      pixelEllipse(png, px, py, 4, 2, index % 3 ? [120, 104, 58, 190] : [157, 130, 67, 190]);
    }
  } else if (key === 'mushrooms') {
    drawShadow(png, x, y, 20, 145);
    rect(png, x + 54, y + 123, 5, 15, [225, 214, 178, 245]);
    pixelEllipse(png, x + 56, y + 120, 10, 6, [180, 75, 62, 245]);
    rect(png, x + 70, y + 128, 4, 11, [230, 221, 187, 245]);
    pixelEllipse(png, x + 72, y + 125, 7, 5, [218, 145, 66, 240]);
  } else if (key === 'moss_rock') {
    drawShadow(png, x, y, 29, 144);
    pixelEllipse(png, x + 64, y + 130, 27, 17, [88, 96, 79, 250]);
    pixelEllipse(png, x + 55, y + 123, 15, 8, [130, 153, 94, 205]);
    line(png, x + 72, y + 123, x + 83, y + 130, 1, [53, 64, 54, 190]);
  } else if (key === 'fallen_log') {
    drawShadow(png, x, y, 44, 144);
    rect(png, x + 27, y + 119, 72, 17, PALETTE.trunkDark);
    rect(png, x + 30, y + 120, 66, 11, PALETTE.trunk);
    line(png, x + 33, y + 123, x + 92, y + 124, 1, PALETTE.trunkLight);
    pixelEllipse(png, x + 28, y + 128, 8, 10, [83, 52, 31, 255]);
    pixelEllipse(png, x + 98, y + 128, 8, 10, [83, 52, 31, 255]);
  } else if (key === 'stump') {
    drawShadow(png, x, y, 19, 145);
    rect(png, x + 52, y + 115, 24, 24, PALETTE.trunkDark);
    rect(png, x + 55, y + 115, 18, 22, PALETTE.trunk);
    pixelEllipse(png, x + 64, y + 114, 14, 8, [171, 121, 66, 255]);
    pixelEllipse(png, x + 64, y + 114, 8, 4, [100, 64, 36, 190]);
  } else if (key === 'wildflowers') {
    for (let index = 0; index < 10; index += 1) {
      const px = x + 46 + ((index * 11) % 36);
      const py = y + 130 + ((index * 5) % 12);
      line(png, px, py + 6, px, py - 5, 1, [82, 132, 64, 220]);
      pixelEllipse(png, px, py - 6, 3, 3, index % 2 ? [235, 196, 92, 235] : [212, 148, 194, 230]);
    }
  } else if (key === 'forest_shadow') {
    drawShadow(png, x, y, 45, 140);
    pixelEllipse(png, x + 47, y + 133, 19, 7, [28, 59, 31, 72]);
  } else if (key === 'ivy_patch') {
    pixelEllipse(png, x + 64, y + 140, 33, 10, [38, 86, 44, 120]);
    for (let index = 0; index < 15; index += 1) {
      const px = x + 35 + ((index * 9) % 58);
      const py = y + 125 + ((index * 6) % 18);
      pixelEllipse(png, px, py, 4, 3, index % 2 ? [83, 145, 69, 215] : [50, 109, 56, 230]);
    }
  }
}

function copyTile(sheet, tile, tileId, columns, frameWidth, frameHeight) {
  const { x, y } = tileOrigin(tileId, columns, frameWidth, frameHeight);
  for (let py = 0; py < tile.height; py += 1) {
    for (let px = 0; px < tile.width; px += 1) {
      const rgba = getPixel(tile, px, py);
      if (rgba[3]) setPixel(sheet, x + px, y + py, rgba);
    }
  }
}

function windFrame(tile, frame, strength = 2) {
  const output = createPng(tile.width, tile.height);
  const swing = Math.sin((frame / 8) * Math.PI * 2) * strength;
  for (let y = 0; y < tile.height; y += 1) {
    const influence = Math.pow((tile.height - 1 - y) / Math.max(1, tile.height - 1), 1.55);
    const shift = Math.round(swing * influence);
    for (let x = 0; x < tile.width; x += 1) {
      const rgba = getPixel(tile, x, y);
      if (rgba[3]) setPixel(output, x + shift, y, rgba);
    }
  }
  return output;
}

function fireflyFrame(frame) {
  const tile = createPng(FOREST_FRAME_WIDTH, FOREST_FRAME_HEIGHT);
  [[40, 105, 0], [61, 121, 2], [86, 98, 4], [96, 130, 5], [51, 133, 6]].forEach(([x, y, phase], index) => {
    const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(frame * 1.6 + phase));
    pixelEllipse(tile, x + Math.sin(frame + phase) * 2, y - Math.cos(frame + phase) * 2, 5 + pulse * 3, 5 + pulse * 3, [107, 200, 145, Math.round(20 + pulse * 35)]);
    pixelEllipse(tile, x + Math.sin(frame + phase) * 2, y - Math.cos(frame + phase) * 2, 2, 2, index % 2 ? [190, 239, 147, 255] : [120, 218, 213, 255]);
  });
  return tile;
}

export function makeTamziaForestV2Artwork() {
  const sheet = createPng(FOREST_COLUMNS * FOREST_FRAME_WIDTH, FOREST_ROWS * FOREST_FRAME_HEIGHT);
  const treeDrawers = [
    (png, frame) => drawOak(png, 0, frame, PALETTE.oak),
    (png, frame) => drawPine(png, 0, frame, PALETTE.pine),
    (png, frame) => drawBirch(png, 0, frame),
    (png, frame) => drawOak(png, 0, frame, PALETTE.deep),
    (png, frame) => drawBirch(png, 0, frame, 0.75),
    (png, frame) => drawPine(png, 0, frame, PALETTE.deep, 0.86),
  ];
  treeDrawers.forEach((drawTree, treeIndex) => {
    for (let frame = 0; frame < 8; frame += 1) {
      const tile = createPng(FOREST_FRAME_WIDTH, FOREST_FRAME_HEIGHT);
      drawTree(tile, frame);
      copyTile(sheet, windFrame(tile, frame + treeIndex, treeIndex === 2 ? 1 : 2), treeIndex * 8 + frame, FOREST_COLUMNS, FOREST_FRAME_WIDTH, FOREST_FRAME_HEIGHT);
    }
  });
  const details = ['bramble_bush', 'round_bush', 'fern_cluster', 'grass_tuft', 'leaf_patch', 'mushrooms', 'moss_rock', 'fallen_log', 'stump', 'wildflowers', 'forest_shadow', 'ivy_patch'];
  details.forEach((key, index) => drawForestDetail(sheet, 48 + index, key));
  for (let frame = 0; frame < 4; frame += 1) copyTile(sheet, fireflyFrame(frame), 60 + frame, FOREST_COLUMNS, FOREST_FRAME_WIDTH, FOREST_FRAME_HEIGHT);
  return sheet;
}

function drawCrate(png, originX, originY, x, y, width, height) {
  rect(png, originX + x, originY + y, width, height, [78, 52, 31, 255]);
  rect(png, originX + x + 3, originY + y + 3, width - 6, height - 6, [121, 81, 43, 255]);
  line(png, originX + x + 6, originY + y + height - 7, originX + x + width - 7, originY + y + 7, 2, [62, 43, 28, 220]);
}

function drawBanditTile(png, tileId, key, frame = 0) {
  const { x, y } = tileOrigin(tileId, BANDIT_COLUMNS, BANDIT_FRAME_WIDTH, BANDIT_FRAME_HEIGHT);
  if (key === 'trail_scuff') {
    pixelEllipse(png, x + 64, y + 78, 54, 15, [78, 62, 42, 88]);
    for (let index = 0; index < 13; index += 1) pixelEllipse(png, x + 17 + index * 8, y + 71 + Math.sin(index) * 5, 7, 3, index % 2 ? [123, 97, 58, 110] : [57, 45, 32, 125]);
  } else if (key === 'broken_cart') {
    drawShadow(png, x, y, 48, 101);
    rect(png, x + 35, y + 57, 48, 18, [81, 53, 31, 255]);
    rect(png, x + 39, y + 60, 40, 7, [133, 88, 47, 255]);
    line(png, x + 30, y + 76, x + 94, y + 47, 5, [65, 42, 26, 255]);
    line(png, x + 41, y + 79, x + 110, y + 80, 4, [90, 56, 31, 245]);
    pixelEllipse(png, x + 36, y + 82, 14, 14, [42, 34, 27, 255]);
    pixelEllipse(png, x + 36, y + 82, 8, 8, [121, 76, 41, 255]);
  } else if (key === 'loot_crates') {
    drawShadow(png, x, y, 36, 101);
    drawCrate(png, x, y, 33, 59, 32, 27);
    drawCrate(png, x, y, 58, 65, 35, 25);
    drawCrate(png, x, y, 49, 43, 29, 25);
  } else if (key === 'sack_pile') {
    drawShadow(png, x, y, 36, 101);
    [[33, 61, 34, 31], [56, 53, 38, 35], [64, 68, 32, 25]].forEach(([sx, sy, sw, sh], index) => {
      pixelEllipse(png, x + sx + sw / 2, y + sy + sh / 2, sw / 2, sh / 2, [129, 104, 70, 255]);
      rect(png, x + sx + sw * 0.36, y + sy + 5, sw * 0.28, 4, [84, 60, 40, 220]);
      if (index === 1) line(png, x + sx + 5, y + sy + sh * 0.56, x + sx + sw - 6, y + sy + sh * 0.5, 1, [90, 72, 48, 180]);
    });
  } else if (key === 'warning_stakes') {
    drawShadow(png, x, y, 34, 104);
    [[48, 93, 48, 39], [65, 98, 63, 29], [84, 92, 88, 48]].forEach(([x1, y1, x2, y2]) => line(png, x + x1, y + y1, x + x2, y + y2, 5, [72, 45, 28, 255]));
    polygon(png, [{ x: x + 44, y: y + 42 }, { x: x + 52, y: y + 31 }, { x: x + 53, y: y + 45 }], [45, 31, 24, 255]);
    polygon(png, [{ x: x + 59, y: y + 33 }, { x: x + 66, y: y + 20 }, { x: x + 70, y: y + 35 }], [45, 31, 24, 255]);
    rect(png, x + 53, y + 58, 31, 10, [110, 48, 39, 230]);
  } else if (key === 'rag_banner') {
    drawShadow(png, x, y, 18, 106);
    line(png, x + 59, y + 102, x + 59, y + 31, 5, [71, 45, 29, 255]);
    line(png, x + 59, y + 37, x + 91, y + 42, 3, [52, 38, 28, 230]);
    const wave = Math.sin((frame / 5) * Math.PI * 2) * 4;
    polygon(png, [{ x: x + 62, y: y + 39 }, { x: x + 95, y: y + 43 + wave }, { x: x + 86, y: y + 61 + wave }, { x: x + 69, y: y + 55 }], [111, 46, 38, 245]);
    rect(png, x + 70, y + 44, 12, 4, [168, 77, 56, 145]);
  } else if (key === 'snare_trap') {
    drawShadow(png, x, y, 31, 90);
    pixelEllipse(png, x + 64, y + 73, 24, 10, [74, 52, 30, 200]);
    pixelEllipse(png, x + 64, y + 73, 18, 6, [155, 118, 63, 170]);
    line(png, x + 43, y + 72, x + 29, y + 60, 2, [77, 59, 39, 200]);
    line(png, x + 85, y + 72, x + 102, y + 66, 2, [77, 59, 39, 200]);
  } else if (key === 'lookout_cache') {
    drawShadow(png, x, y, 43, 100);
    drawCrate(png, x, y, 40, 60, 31, 25);
    line(png, x + 73, y + 92, x + 76, y + 44, 4, [74, 47, 28, 245]);
    line(png, x + 94, y + 90, x + 85, y + 49, 4, [74, 47, 28, 235]);
    line(png, x + 70, y + 57, x + 98, y + 53, 4, [93, 60, 35, 230]);
    rect(png, x + 75, y + 50, 16, 8, [103, 43, 37, 220]);
  } else if (key === 'boot_tracks') {
    for (let index = 0; index < 6; index += 1) pixelEllipse(png, x + 36 + index * 11, y + 71 + (index % 2) * 12, 5, 9, [57, 43, 30, 150]);
  } else if (key === 'cut_logs') {
    drawShadow(png, x, y, 38, 94);
    for (let index = 0; index < 3; index += 1) {
      const logY = y + 62 + index * 9;
      line(png, x + 36 + index * 4, logY, x + 90 + index * 4, logY + 1, 8, [101, 61, 34, 255]);
      pixelEllipse(png, x + 36 + index * 4, logY, 5, 4, [172, 113, 63, 240]);
    }
  } else if (key === 'cold_firepit') {
    drawShadow(png, x, y, 29, 91);
    pixelEllipse(png, x + 64, y + 76, 25, 11, [82, 75, 57, 255]);
    pixelEllipse(png, x + 64, y + 72, 18, 7, [48, 44, 37, 255]);
    line(png, x + 50, y + 69, x + 78, y + 76, 3, [85, 52, 29, 255]);
    line(png, x + 53, y + 77, x + 75, y + 65, 3, [85, 52, 29, 255]);
    const flameHeight = 13 + Math.round(Math.max(0, Math.sin(frame * 1.7 + 0.4)) * 9);
    pixelEllipse(png, x + 64 + Math.sin(frame) * 2, y + 69 - flameHeight / 2, 7, flameHeight / 2, [224, 110, 44, 190]);
    pixelEllipse(png, x + 64 + Math.sin(frame) * 2, y + 70 - flameHeight / 2, 3, Math.max(3, flameHeight / 3), [249, 191, 81, 255]);
  } else if (key === 'rope_marker') {
    drawShadow(png, x, y, 32, 89);
    line(png, x + 36, y + 75, x + 93, y + 68, 4, [154, 116, 61, 220]);
    line(png, x + 39, y + 78, x + 93, y + 71, 1, [79, 57, 36, 180]);
    rect(png, x + 34, y + 66, 6, 20, [75, 49, 29, 255]);
    rect(png, x + 91, y + 61, 6, 23, [75, 49, 29, 255]);
  }
}

export function makeTamziaBanditForestV2Artwork() {
  const sheet = createPng(BANDIT_COLUMNS * BANDIT_FRAME_WIDTH, BANDIT_ROWS * BANDIT_FRAME_HEIGHT);
  const keys = ['trail_scuff', 'broken_cart', 'loot_crates', 'sack_pile', 'warning_stakes', 'rag_banner', 'snare_trap', 'lookout_cache', 'boot_tracks', 'cut_logs', 'cold_firepit', 'rope_marker'];
  keys.forEach((key, index) => drawBanditTile(sheet, index, key, 0));
  for (let frame = 1; frame <= 4; frame += 1) drawBanditTile(sheet, 11 + frame, 'cold_firepit', frame);
  for (let frame = 1; frame <= 4; frame += 1) drawBanditTile(sheet, 15 + frame, 'rag_banner', frame);
  return sheet;
}
