import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [sourcePath, outputPath, scaleArg = '0.4', rowOrderArg = '0,1,2,3', palettePath = '', paletteLimitArg = '20'] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  throw new Error('Usage: node process-generated-enemy-sheet.mjs <source> <output> [scale] [rowOrder] [palettePath] [paletteLimit]');
}

const columns = 8;
const rows = 4;
const cellSize = 96;
const pixelScale = 2;
const baseline = 93;
const scale = Number(scaleArg);
const rowOrder = rowOrderArg.split(',').map(Number);
const paletteLimit = Math.max(4, Number(paletteLimitArg) || 20);
if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Invalid scale: ${scaleArg}`);
if (rowOrder.length !== rows || rowOrder.some((row) => !Number.isInteger(row) || row < 0 || row >= rows)) {
  throw new Error(`Invalid row order: ${rowOrderArg}`);
}

const source = PNG.sync.read(readFileSync(sourcePath));

function isChromaKey(red, green, blue) {
  return red > 70 && blue > 70 && red - green > 28 && blue - green > 28;
}

function buildPalette() {
  if (palettePath && palettePath !== '-') {
    const paletteSource = PNG.sync.read(readFileSync(palettePath));
    const colors = new Map();
    for (let index = 0; index < paletteSource.data.length; index += 4) {
      if (paletteSource.data[index + 3] === 0) continue;
      const color = [paletteSource.data[index], paletteSource.data[index + 1], paletteSource.data[index + 2]];
      colors.set(color.join(','), color);
    }
    return [...colors.values()];
  }

  const histogram = new Map();
  for (let index = 0; index < source.data.length; index += 4) {
    const red = source.data[index];
    const green = source.data[index + 1];
    const blue = source.data[index + 2];
    if (source.data[index + 3] === 0 || isChromaKey(red, green, blue)) continue;
    const key = `${red >> 5},${green >> 5},${blue >> 5}`;
    const bin = histogram.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bin.count += 1;
    bin.red += red;
    bin.green += green;
    bin.blue += blue;
    histogram.set(key, bin);
  }
  return [...histogram.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, paletteLimit)
    .map((bin) => [
      Math.round(bin.red / bin.count),
      Math.round(bin.green / bin.count),
      Math.round(bin.blue / bin.count),
    ]);
}

const palette = buildPalette();
if (palette.length === 0) throw new Error('No usable palette colors found.');

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

function getCellAnchor(column, sourceRow) {
  const startX = Math.round(column * source.width / columns);
  const endX = Math.round((column + 1) * source.width / columns);
  const startY = Math.round(sourceRow * source.height / rows);
  const endY = Math.round((sourceRow + 1) * source.height / rows);
  const opaqueX = [];
  let bottomY = startY;
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * source.width + x) * 4;
      const red = source.data[index];
      const green = source.data[index + 1];
      const blue = source.data[index + 2];
      if (source.data[index + 3] === 0 || isChromaKey(red, green, blue)) continue;
      opaqueX.push(x);
      bottomY = Math.max(bottomY, y);
    }
  }
  if (opaqueX.length === 0) throw new Error(`No sprite found in generated cell ${column},${sourceRow}.`);
  opaqueX.sort((left, right) => left - right);
  return {
    centerX: opaqueX[Math.floor(opaqueX.length / 2)],
    bottomY,
    startX,
    endX,
    startY,
    endY,
  };
}

const output = new PNG({ width: columns * cellSize, height: rows * cellSize, colorType: 6 });
output.data.fill(0);
let opaquePixels = 0;

for (let row = 0; row < rows; row += 1) {
  const sourceRow = rowOrder[row];
  for (let column = 0; column < columns; column += 1) {
    const anchor = getCellAnchor(column, sourceRow);
    for (let logicalY = 0; logicalY < cellSize / pixelScale; logicalY += 1) {
      const localY = logicalY * pixelScale + pixelScale / 2;
      const sourceY = Math.round(anchor.bottomY + (localY - baseline) / scale);
      if (sourceY < anchor.startY || sourceY >= anchor.endY) continue;
      for (let logicalX = 0; logicalX < cellSize / pixelScale; logicalX += 1) {
        const localX = logicalX * pixelScale + pixelScale / 2;
        const sourceX = Math.round(anchor.centerX + (localX - cellSize / 2) / scale);
        if (sourceX < anchor.startX || sourceX >= anchor.endX) continue;
        const sourceIndex = (sourceY * source.width + sourceX) * 4;
        const red = source.data[sourceIndex];
        const green = source.data[sourceIndex + 1];
        const blue = source.data[sourceIndex + 2];
        if (source.data[sourceIndex + 3] === 0 || isChromaKey(red, green, blue)) continue;
        const color = nearestPaletteColor(red, green, blue);
        for (let blockY = 0; blockY < pixelScale; blockY += 1) {
          for (let blockX = 0; blockX < pixelScale; blockX += 1) {
            const outputX = column * cellSize + logicalX * pixelScale + blockX;
            const outputY = row * cellSize + logicalY * pixelScale + blockY;
            const outputIndex = (outputY * output.width + outputX) * 4;
            output.data[outputIndex] = color[0];
            output.data[outputIndex + 1] = color[1];
            output.data[outputIndex + 2] = color[2];
            output.data[outputIndex + 3] = 255;
            opaquePixels += 1;
          }
        }
      }
    }
  }
}

writeFileSync(outputPath, PNG.sync.write(output, { colorType: 6 }));
console.log(`Processed ${outputPath}: ${output.width}x${output.height}, scale=${scale.toFixed(3)}, palette=${palette.length}, opaque=${opaquePixels}.`);
