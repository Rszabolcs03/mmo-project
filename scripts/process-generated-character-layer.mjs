import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [sourcePath, outputPath, layerType = 'outfit', profile = ''] = process.argv.slice(2);
if (!sourcePath || !outputPath || !['outfit', 'weapon'].includes(layerType)) {
  throw new Error('Usage: node process-generated-character-layer.mjs <source> <output> <outfit|weapon>');
}

const columns = 6;
const rows = 4;
const cellSize = 48;
const source = PNG.sync.read(readFileSync(sourcePath));
const output = new PNG({ width: columns * cellSize, height: rows * cellSize, colorType: 6 });
output.data.fill(0);

// The generated rows have intentionally generous spacing, but the last row
// slightly overlaps the mathematical quarter boundary. These bands separate
// the four actual animation rows without clipping the upward-facing hood.
const rowBands = [
  [0, Math.round(source.height * 0.266)],
  [Math.round(source.height * 0.266), Math.round(source.height * 0.491)],
  [Math.round(source.height * 0.491), Math.round(source.height * 0.715)],
  [Math.round(source.height * 0.715), source.height],
];

const outfitPalette = [
  [5, 8, 12],
  [17, 24, 32],
  [23, 37, 84],
  [49, 46, 129],
  [29, 78, 216],
  [66, 99, 235],
  [14, 116, 144],
  [103, 232, 249],
  [139, 233, 253],
  [183, 121, 31],
  [250, 204, 21],
  [75, 44, 21],
  [38, 50, 65],
  [241, 245, 249],
];

const weaponPalette = [
  [5, 8, 12],
  [17, 24, 32],
  [75, 44, 21],
  [124, 74, 34],
  [183, 121, 31],
  [250, 204, 21],
  [14, 116, 144],
  [103, 232, 249],
  [139, 233, 253],
  [241, 245, 249],
];

const palette = layerType === 'weapon' ? weaponPalette : outfitPalette;

function isChroma(red, green, blue) {
  return red > 70 && blue > 70 && red - green > 28 && blue - green > 28;
}

function nearestPaletteColor(red, green, blue) {
  let nearest = palette[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const color of palette) {
    const redDelta = red - color[0];
    const greenDelta = green - color[1];
    const blueDelta = blue - color[2];
    const distance = redDelta * redDelta * 0.82 + greenDelta * greenDelta + blueDelta * blueDelta * 0.78;
    if (distance < nearestDistance) {
      nearest = color;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function getBounds(column, row) {
  const startX = Math.round(column * source.width / columns);
  const endX = Math.round((column + 1) * source.width / columns);
  const [startY, endY] = rowBands[row];
  const opaqueX = [];
  let minX = endX;
  let minY = endY;
  let maxX = startX - 1;
  let maxY = startY - 1;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * source.width + x) * 4;
      const red = source.data[index];
      const green = source.data[index + 1];
      const blue = source.data[index + 2];
      if (source.data[index + 3] === 0 || isChroma(red, green, blue)) continue;
      opaqueX.push(x);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (opaqueX.length === 0) throw new Error(`No layer pixels in generated cell ${column},${row}.`);
  opaqueX.sort((left, right) => left - right);
  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: opaqueX[Math.floor(opaqueX.length / 2)],
    centerY: (minY + maxY) / 2,
    bottomY: maxY,
  };
}

function renderOutfitCell(column, row, bounds) {
  const sourceHeight = bounds.maxY - bounds.minY + 1;
  const scale = 43 / sourceHeight;
  const anchorX = cellSize / 2;
  const baseline = 45;

  for (let localY = 0; localY < cellSize; localY += 1) {
    const sourceY = Math.round(bounds.bottomY + (localY - baseline) / scale);
    if (sourceY < bounds.minY || sourceY > bounds.maxY) continue;
    for (let localX = 0; localX < cellSize; localX += 1) {
      const sourceX = Math.round(bounds.centerX + (localX - anchorX) / scale);
      if (sourceX < bounds.minX || sourceX > bounds.maxX) continue;
      sampleIntoCell(column, row, localX, localY, sourceX, sourceY);
    }
  }
}

function renderWeaponCell(column, row, bounds) {
  const sourceWidth = bounds.maxX - bounds.minX + 1;
  const sourceHeight = bounds.maxY - bounds.minY + 1;
  const scale = 32 / Math.max(sourceWidth, sourceHeight);
  const vertical = row === 0 || row === 3;
  const anchorX = vertical ? (column >= 4 ? 33 : 36) : 24;
  const anchorY = vertical ? 28 : (column >= 4 ? 29 : 27);

  for (let localY = 0; localY < cellSize; localY += 1) {
    const sourceY = Math.round(bounds.centerY + (localY - anchorY) / scale);
    if (sourceY < bounds.minY || sourceY > bounds.maxY) continue;
    for (let localX = 0; localX < cellSize; localX += 1) {
      const sourceX = Math.round(bounds.centerX + (localX - anchorX) / scale);
      if (sourceX < bounds.minX || sourceX > bounds.maxX) continue;
      sampleIntoCell(column, row, localX, localY, sourceX, sourceY);
    }
  }
}

function sampleIntoCell(column, row, localX, localY, sourceX, sourceY) {
  const sourceIndex = (sourceY * source.width + sourceX) * 4;
  const red = source.data[sourceIndex];
  const green = source.data[sourceIndex + 1];
  const blue = source.data[sourceIndex + 2];
  if (source.data[sourceIndex + 3] === 0 || isChroma(red, green, blue)) return;
  const color = nearestPaletteColor(red, green, blue);
  const outputIndex = (((row * cellSize + localY) * output.width) + column * cellSize + localX) * 4;
  output.data[outputIndex] = color[0];
  output.data[outputIndex + 1] = color[1];
  output.data[outputIndex + 2] = color[2];
  output.data[outputIndex + 3] = 255;
}

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const bounds = getBounds(column, row);
    if (layerType === 'weapon') renderWeaponCell(column, row, bounds);
    else renderOutfitCell(column, row, bounds);
  }
}

// Outfit generations often paint a placeholder face into the hat opening.
// The real face and hairstyle are separate layers, so keep that opening clear
// while leaving the upward-facing back of the hat intact.
if (layerType === 'outfit') {
  const faceWindows = [
    { x: 15, y: 13, width: 18, height: 6 },
    { x: 17, y: 12, width: 15, height: 8 },
    { x: 16, y: 12, width: 15, height: 8 },
  ];

  for (let row = 0; row < faceWindows.length; row += 1) {
    const window = faceWindows[row];
    for (let column = 0; column < columns; column += 1) {
      for (let y = window.y; y < window.y + window.height; y += 1) {
        for (let x = window.x; x < window.x + window.width; x += 1) {
          const index = (((row * cellSize + y) * output.width) + column * cellSize + x) * 4;
          output.data[index] = 0;
          output.data[index + 1] = 0;
          output.data[index + 2] = 0;
          output.data[index + 3] = 0;
        }
      }
    }
  }
}

if (layerType === 'outfit' && profile === 'mirror-up-release') {
  const row = 3;
  const column = 5;
  for (let y = 0; y < cellSize; y += 1) {
    for (let x = 0; x < cellSize / 2; x += 1) {
      const leftIndex = (((row * cellSize + y) * output.width) + column * cellSize + x) * 4;
      const rightIndex = (((row * cellSize + y) * output.width) + column * cellSize + (cellSize - 1 - x)) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const value = output.data[leftIndex + channel];
        output.data[leftIndex + channel] = output.data[rightIndex + channel];
        output.data[rightIndex + channel] = value;
      }
    }
  }
}

writeFileSync(outputPath, PNG.sync.write(output, { colorType: 6 }));
console.log(`Processed ${layerType} layer: ${outputPath} (${output.width}x${output.height}).`);
