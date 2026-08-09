import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const sourcePath = process.argv[2] ?? 'tmp/imagegen/four-direction/tideglass-matriarch-smooth-cast-chroma.png';
const palettePath = process.argv[3] ?? 'tmp/imagegen/four-direction/tideglass-matriarch-current-sheet.png';
const outputPath = process.argv[4] ?? 'tmp/imagegen/four-direction/tideglass-matriarch-smooth-cast-sheet.png';
const columns = 8;
const rows = 4;
const cellSize = 128;
const pixelScale = 2;
const baseline = 126;
const uniformScale = 0.59;

const source = PNG.sync.read(readFileSync(sourcePath));
const paletteSource = PNG.sync.read(readFileSync(palettePath));
const paletteByKey = new Map();
for (let index = 0; index < paletteSource.data.length; index += 4) {
  if (paletteSource.data[index + 3] === 0) continue;
  const color = [paletteSource.data[index], paletteSource.data[index + 1], paletteSource.data[index + 2]];
  paletteByKey.set(color.join(','), color);
}
const palette = [...paletteByKey.values()];

function isChromaKey(red, green, blue) {
  return red > 70 && blue > 70 && red - green > 28 && blue - green > 28;
}

function nearestPaletteColor(red, green, blue) {
  let nearest = palette[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const color of palette) {
    const redDelta = red - color[0];
    const greenDelta = green - color[1];
    const blueDelta = blue - color[2];
    const distance = redDelta * redDelta * 0.82 + greenDelta * greenDelta + blueDelta * blueDelta * 0.74;
    if (distance < nearestDistance) {
      nearest = color;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function isWeaponOrEnergy(red, green, blue) {
  const goldenWeapon = red > 125 && green > 70 && blue < 120;
  const cyanEnergy = red < 105 && green > 130 && blue > 150;
  return goldenWeapon || cyanEnergy;
}

function getCellAnchor(column, row) {
  const startX = Math.round(column * source.width / columns);
  const endX = Math.round((column + 1) * source.width / columns);
  const startY = Math.round(row * source.height / rows);
  const endY = Math.round((row + 1) * source.height / rows);
  const bodyX = [];
  let bodyBottom = startY;
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * source.width + x) * 4;
      const red = source.data[index];
      const green = source.data[index + 1];
      const blue = source.data[index + 2];
      if (source.data[index + 3] === 0 || isChromaKey(red, green, blue)) continue;
      if (isWeaponOrEnergy(red, green, blue)) continue;
      bodyX.push(x);
      bodyBottom = Math.max(bodyBottom, y);
    }
  }
  if (bodyX.length === 0) throw new Error(`No Tideglass Matriarch body found in generated cell ${column},${row}.`);
  bodyX.sort((left, right) => left - right);
  return {
    centerX: bodyX[Math.floor(bodyX.length / 2)],
    bottomY: bodyBottom,
    startX,
    endX,
    startY,
    endY,
  };
}

const anchors = Array.from({ length: rows }, (_, row) => Array.from(
  { length: columns },
  (_, column) => getCellAnchor(column, row),
));
const output = new PNG({ width: columns * cellSize, height: rows * cellSize, colorType: 6 });
output.data.fill(0);
let opaquePixels = 0;

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const anchor = anchors[row][column];
    for (let logicalY = 0; logicalY < cellSize / pixelScale; logicalY += 1) {
      const localY = logicalY * pixelScale + pixelScale / 2;
      const sourceY = Math.round(anchor.bottomY + (localY - baseline) / uniformScale);
      if (sourceY < anchor.startY || sourceY >= anchor.endY) continue;
      for (let logicalX = 0; logicalX < cellSize / pixelScale; logicalX += 1) {
        const localX = logicalX * pixelScale + pixelScale / 2;
        const sourceX = Math.round(anchor.centerX + (localX - cellSize / 2) / uniformScale);
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
console.log(`Processed anchored Tideglass cast sheet ${output.width}x${output.height}: scale=${uniformScale.toFixed(3)}, ${opaquePixels} opaque pixels.`);
