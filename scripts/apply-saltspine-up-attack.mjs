import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [sheetPath, generatedPath, outputPath = sheetPath] = process.argv.slice(2);
if (!sheetPath || !generatedPath) {
  throw new Error('Usage: node apply-saltspine-up-attack.mjs <sheet> <generated-strip> [output]');
}

const CELL = 96;
const SHEET_COLUMNS = 8;
const UP_ROW = 3;
const ATTACK_START_COLUMN = 4;
const PIXEL_SCALE = 2;
const sheet = PNG.sync.read(readFileSync(sheetPath));
const generated = PNG.sync.read(readFileSync(generatedPath));

if (sheet.width !== CELL * SHEET_COLUMNS || sheet.height !== CELL * 4) {
  throw new Error(`Unexpected Saltspine sheet size: ${sheet.width}x${sheet.height}`);
}

function isChroma(red, green, blue) {
  return red > 70 && blue > 70 && red - green > 28 && blue - green > 28;
}

const paletteByKey = new Map();
for (let index = 0; index < sheet.data.length; index += 4) {
  if (sheet.data[index + 3] === 0) continue;
  const color = [sheet.data[index], sheet.data[index + 1], sheet.data[index + 2]];
  paletteByKey.set(color.join(','), color);
}
const palette = [...paletteByKey.values()];

function nearestPaletteColor(red, green, blue) {
  let nearest = palette[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const color of palette) {
    const redDelta = red - color[0];
    const greenDelta = green - color[1];
    const blueDelta = blue - color[2];
    const distance = redDelta * redDelta * 0.84 + greenDelta * greenDelta + blueDelta * blueDelta * 0.76;
    if (distance < nearestDistance) {
      nearest = color;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function copyCell(sourceColumn, sourceRow, targetColumn, targetRow) {
  for (let localY = 0; localY < CELL; localY += 1) {
    for (let localX = 0; localX < CELL; localX += 1) {
      const sourceIndex = (((sourceRow * CELL + localY) * sheet.width) + sourceColumn * CELL + localX) * 4;
      const targetIndex = (((targetRow * CELL + localY) * sheet.width) + targetColumn * CELL + localX) * 4;
      sheet.data[targetIndex] = sheet.data[sourceIndex];
      sheet.data[targetIndex + 1] = sheet.data[sourceIndex + 1];
      sheet.data[targetIndex + 2] = sheet.data[sourceIndex + 2];
      sheet.data[targetIndex + 3] = sheet.data[sourceIndex + 3];
    }
  }
}

function clearCell(column, row) {
  for (let localY = 0; localY < CELL; localY += 1) {
    for (let localX = 0; localX < CELL; localX += 1) {
      const index = (((row * CELL + localY) * sheet.width) + column * CELL + localX) * 4;
      sheet.data[index] = 0;
      sheet.data[index + 1] = 0;
      sheet.data[index + 2] = 0;
      sheet.data[index + 3] = 0;
    }
  }
}

function generatedBounds(frame) {
  const startX = Math.round(frame * generated.width / 4);
  const endX = Math.round((frame + 1) * generated.width / 4);
  let minX = endX;
  let minY = generated.height;
  let maxX = startX - 1;
  let maxY = -1;
  for (let y = 0; y < generated.height; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * generated.width + x) * 4;
      const red = generated.data[index];
      const green = generated.data[index + 1];
      const blue = generated.data[index + 2];
      if (generated.data[index + 3] === 0 || isChroma(red, green, blue)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error(`Generated frame ${frame} is empty.`);
  return { minX, minY, maxX, maxY };
}

function renderGeneratedFrame(sourceFrame, targetColumn, targetWidth, targetHeight) {
  clearCell(targetColumn, UP_ROW);
  const bounds = generatedBounds(sourceFrame);
  const targetX = Math.round((CELL - targetWidth) / 2 / PIXEL_SCALE) * PIXEL_SCALE;
  const targetY = CELL - targetHeight - 2;
  const logicalWidth = Math.ceil(targetWidth / PIXEL_SCALE);
  const logicalHeight = Math.ceil(targetHeight / PIXEL_SCALE);
  const sourceWidth = bounds.maxX - bounds.minX + 1;
  const sourceHeight = bounds.maxY - bounds.minY + 1;

  for (let logicalY = 0; logicalY < logicalHeight; logicalY += 1) {
    const sourceY = Math.min(
      bounds.maxY,
      Math.round(bounds.minY + (logicalY + 0.5) * sourceHeight / logicalHeight - 0.5),
    );
    for (let logicalX = 0; logicalX < logicalWidth; logicalX += 1) {
      const sourceX = Math.min(
        bounds.maxX,
        Math.round(bounds.minX + (logicalX + 0.5) * sourceWidth / logicalWidth - 0.5),
      );
      const sourceIndex = (sourceY * generated.width + sourceX) * 4;
      const red = generated.data[sourceIndex];
      const green = generated.data[sourceIndex + 1];
      const blue = generated.data[sourceIndex + 2];
      if (generated.data[sourceIndex + 3] === 0 || isChroma(red, green, blue)) continue;
      const color = nearestPaletteColor(red, green, blue);
      for (let blockY = 0; blockY < PIXEL_SCALE; blockY += 1) {
        for (let blockX = 0; blockX < PIXEL_SCALE; blockX += 1) {
          const localX = targetX + logicalX * PIXEL_SCALE + blockX;
          const localY = targetY + logicalY * PIXEL_SCALE + blockY;
          if (localX < 0 || localX >= CELL || localY < 0 || localY >= CELL) continue;
          const targetIndex = (((UP_ROW * CELL + localY) * sheet.width)
            + targetColumn * CELL + localX) * 4;
          sheet.data[targetIndex] = color[0];
          sheet.data[targetIndex + 1] = color[1];
          sheet.data[targetIndex + 2] = color[2];
          sheet.data[targetIndex + 3] = 255;
        }
      }
    }
  }
}

// The first and recovery frames reuse the upward walk stance so entering and
// leaving the attack cannot make the crab turn or jump. Only the wind-up and
// impact are taken from the new, consistently rear-facing generated strip.
copyCell(0, UP_ROW, ATTACK_START_COLUMN, UP_ROW);
renderGeneratedFrame(1, ATTACK_START_COLUMN + 1, 72, 48);
renderGeneratedFrame(2, ATTACK_START_COLUMN + 2, 86, 54);
copyCell(0, UP_ROW, ATTACK_START_COLUMN + 3, UP_ROW);

writeFileSync(outputPath, PNG.sync.write(sheet, { colorType: 6 }));
console.log(`Patched Saltspine upward attack in ${outputPath}; palette=${palette.length}.`);
