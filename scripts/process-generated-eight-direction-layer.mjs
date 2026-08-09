import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

const [sourcePath, outputPath, layerType = 'outfit'] = process.argv.slice(2);
if (!sourcePath || !outputPath || !['outfit', 'weapon'].includes(layerType)) {
  throw new Error('Usage: node process-generated-eight-direction-layer.mjs <source> <output> <outfit|weapon>');
}

const columns = 6;
const rows = 8;
const cellSize = 48;
const classId = outputPath.match(/[\\/]classes[\\/]([^\\/]+)/)?.[1] ?? null;
const centeredWeaponClasses = new Set(['warrior', 'paladin', 'rogue']);
const source = PNG.sync.read(readFileSync(sourcePath));
const output = new PNG({ width: columns * cellSize, height: rows * cellSize, colorType: 6 });
output.data.fill(0);

const outfitPalette = [
  [5, 8, 12],
  [17, 24, 32],
  [11, 18, 32],
  [31, 41, 55],
  [38, 50, 65],
  [55, 65, 81],
  [71, 85, 105],
  [107, 114, 128],
  [148, 163, 184],
  [203, 213, 225],
  [229, 231, 235],
  [241, 245, 249],
  [248, 250, 252],
  [69, 26, 26],
  [127, 29, 29],
  [153, 27, 27],
  [185, 28, 28],
  [31, 63, 35],
  [47, 95, 45],
  [54, 92, 45],
  [79, 127, 63],
  [75, 44, 21],
  [95, 67, 41],
  [124, 74, 34],
  [141, 110, 69],
  [183, 121, 31],
  [217, 119, 6],
  [250, 204, 21],
  [254, 224, 94],
  [254, 240, 138],
  [76, 29, 149],
  [91, 33, 182],
  [109, 40, 217],
  [124, 58, 237],
  [139, 92, 246],
  [167, 139, 250],
  [23, 37, 84],
  [49, 46, 129],
  [29, 78, 216],
  [66, 99, 235],
  [14, 116, 144],
  [103, 232, 249],
  [139, 233, 253],
  [217, 154, 114],
  [242, 199, 164],
];

const weaponPalette = [
  ...outfitPalette,
  [14, 116, 144],
  [103, 232, 249],
  [139, 233, 253],
];

const palette = layerType === 'weapon' ? weaponPalette : outfitPalette;

function isChroma(red, green, blue) {
  return red > 70 && blue > 70 && red - green > 28 && blue - green > 28;
}

function isLayerPixel(x, y) {
  const index = (y * source.width + x) * 4;
  return source.data[index + 3] > 0
    && !isChroma(source.data[index], source.data[index + 1], source.data[index + 2]);
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

function findBands(axisLength, crossLength, sample, mergeGap) {
  const counts = Array.from({ length: axisLength }, (_, axis) => {
    let count = 0;
    for (let cross = 0; cross < crossLength; cross += 1) {
      if (sample(axis, cross)) count += 1;
    }
    return count;
  });

  const rawBands = [];
  let start = null;
  for (let index = 0; index <= counts.length; index += 1) {
    if (index < counts.length && counts[index] > 0) {
      if (start === null) start = index;
      continue;
    }
    if (start !== null) {
      rawBands.push({ start, end: index - 1 });
      start = null;
    }
  }

  const merged = [];
  for (const band of rawBands) {
    const previous = merged.at(-1);
    if (previous && band.start - previous.end - 1 <= mergeGap) previous.end = band.end;
    else merged.push({ ...band });
  }

  return merged
    .map((band) => ({
      ...band,
      mass: counts.slice(band.start, band.end + 1).reduce((sum, count) => sum + count, 0),
    }))
    .filter((band) => band.mass >= (layerType === 'weapon' ? 80 : 350));
}

const detectedXBands = findBands(source.width, source.height, (x, y) => isLayerPixel(x, y), 34);
const xBands = detectedXBands.length === columns
  ? detectedXBands
  : Array.from({ length: columns }, (_, column) => ({
    start: Math.round(column * source.width / columns),
    end: Math.round((column + 1) * source.width / columns) - 1,
  }));
const yBands = findBands(source.height, source.width, (y, x) => isLayerPixel(x, y), 6);

if (detectedXBands.length !== columns) {
  console.warn(`Detected ${detectedXBands.length} horizontal bands; using the declared ${columns}-column grid.`);
}
// Trust the five authored poses: front, rear diagonal, side, front diagonal,
// and back. Opposite-facing directions are built as exact mirrors below.
const requiredSourceRows = 5;
if (yBands.length < requiredSourceRows) {
  throw new Error(`Expected at least ${requiredSourceRows} generated rows, found ${yBands.length}: ${JSON.stringify(yBands)}`);
}

function getCellBounds(column, sourceRow) {
  const xBand = xBands[column];
  const yBand = yBands[sourceRow];
  let minX = xBand.end;
  let minY = yBand.end;
  let maxX = xBand.start;
  let maxY = yBand.start;
  let pixelCount = 0;

  for (let y = yBand.start; y <= yBand.end; y += 1) {
    for (let x = xBand.start; x <= xBand.end; x += 1) {
      if (!isLayerPixel(x, y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      pixelCount += 1;
    }
  }

  if (pixelCount === 0) throw new Error(`No pixels in generated cell ${column},${sourceRow}.`);
  return { minX, minY, maxX, maxY };
}

function setOutputPixel(column, row, x, y, color) {
  if (x < 0 || y < 0 || x >= cellSize || y >= cellSize) return;
  const index = (((row * cellSize + y) * output.width) + column * cellSize + x) * 4;
  output.data[index] = color[0];
  output.data[index + 1] = color[1];
  output.data[index + 2] = color[2];
  output.data[index + 3] = 255;
}

const cellBounds = Array.from({ length: requiredSourceRows }, (_, sourceRow) => (
  Array.from({ length: columns }, (_, column) => getCellBounds(column, sourceRow))
));
const scaleBounds = layerType === 'weapon'
  ? cellBounds.flatMap((rowBounds) => rowBounds.slice(0, 4))
  : cellBounds.flat();
const largestSourceWidth = Math.max(...scaleBounds.map((bounds) => bounds.maxX - bounds.minX + 1));
const largestSourceHeight = Math.max(...scaleBounds.map((bounds) => bounds.maxY - bounds.minY + 1));
const commonMaxWidth = layerType === 'weapon' ? 44 : 46;
const commonMaxHeight = layerType === 'weapon' ? 36 : 43;
const commonScale = layerType === 'weapon'
  ? Math.min(0.3, commonMaxHeight / largestSourceHeight)
  : Math.min(commonMaxWidth / largestSourceWidth, commonMaxHeight / largestSourceHeight);

function renderCell(column, outputRow, sourceRow) {
  const bounds = cellBounds[sourceRow][column];
  const sourceWidth = bounds.maxX - bounds.minX + 1;
  const sourceHeight = bounds.maxY - bounds.minY + 1;
  const drawWidth = Math.max(1, Math.round(sourceWidth * commonScale));
  const drawHeight = Math.max(1, Math.round(sourceHeight * commonScale));

  // Keep every frame on the same sheet-space anchor. Centering and fitting each
  // silhouette independently makes the whole character pulse and slide whenever
  // an arm, foot, robe edge, or weapon changes the cell's bounding box.
  const sourceAnchorX = layerType === 'weapon'
    ? (bounds.minX + bounds.maxX) / 2
    : (xBands[column].start + xBands[column].end) / 2;
  const sourceBaseline = layerType === 'weapon' ? bounds.maxY : yBands[sourceRow].end;
  const leftFacingWeapon = layerType === 'weapon' && (outputRow === 1 || outputRow === 3);
  const upDiagonalOffset = outputRow === 1 ? -2 : 0;
  const centerX = layerType === 'weapon'
    ? centeredWeaponClasses.has(classId)
      ? 24
      : (leftFacingWeapon ? 14 : 33)
    : 24 + upDiagonalOffset;
  const baseline = layerType === 'weapon' ? 39 : 46;
  const startX = Math.round(centerX - (sourceAnchorX - bounds.minX) * commonScale);
  const startY = Math.round(baseline - (sourceBaseline - bounds.minY) * commonScale);

  for (let y = 0; y < drawHeight; y += 1) {
    const sourceY = Math.min(bounds.maxY, bounds.minY + Math.floor((y + 0.5) / commonScale));
    for (let x = 0; x < drawWidth; x += 1) {
      const sourceX = Math.min(bounds.maxX, bounds.minX + Math.floor((x + 0.5) / commonScale));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const red = source.data[sourceIndex];
      const green = source.data[sourceIndex + 1];
      const blue = source.data[sourceIndex + 2];
      if (source.data[sourceIndex + 3] === 0 || isChroma(red, green, blue)) continue;
      setOutputPixel(column, outputRow, startX + x, startY + y, nearestPaletteColor(red, green, blue));
    }
  }
}

function mirrorRow(sourceRow, destinationRow) {
  for (let column = 0; column < columns; column += 1) {
    for (let y = 0; y < cellSize; y += 1) {
      for (let x = 0; x < cellSize; x += 1) {
        const sourceIndex = (((sourceRow * cellSize + y) * output.width) + column * cellSize + x) * 4;
        if (output.data[sourceIndex + 3] === 0) continue;
        const color = [output.data[sourceIndex], output.data[sourceIndex + 1], output.data[sourceIndex + 2]];
        setOutputPixel(column, destinationRow, cellSize - 1 - x, y, color);
      }
    }
  }
}

for (let column = 0; column < columns; column += 1) {
  renderCell(column, 0, 0);
  renderCell(column, 1, 1);
  renderCell(column, 2, 2);
  renderCell(column, 3, 3);
  renderCell(column, 4, 4);
}
mirrorRow(3, 5);
mirrorRow(2, 6);
mirrorRow(1, 7);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, PNG.sync.write(output, { colorType: 6 }));
console.log(`Processed ${layerType} layer: ${outputPath} (${output.width}x${output.height}); source bands ${xBands.length}x${yBands.length}.`);
console.log(`Common scale ${commonScale.toFixed(4)} from source bounds ${largestSourceWidth}x${largestSourceHeight}.`);
