import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const sourcePath = process.argv[2] ?? 'tmp/imagegen/four-direction/old-quarry-giant-smooth-throw-chroma.png';
const palettePath = process.argv[3] ?? 'tmp/imagegen/four-direction/old-quarry-giant-slam-sheet.png';
const outputPath = process.argv[4] ?? 'tmp/imagegen/four-direction/old-quarry-giant-smooth-throw-sheet.png';
const columns = 8;
const rows = 4;
const cellSize = 96;
const pixelScale = 2;
const baseline = 93;
const outputWidth = 96 * 8;
const outputHeight = 96 * 4;

const source = PNG.sync.read(readFileSync(sourcePath));
const paletteSource = PNG.sync.read(readFileSync(palettePath));

const paletteByKey = new Map();
for (let index = 0; index < paletteSource.data.length; index += 4) {
  if (paletteSource.data[index + 3] === 0) continue;
  const color = [paletteSource.data[index], paletteSource.data[index + 1], paletteSource.data[index + 2]];
  paletteByKey.set(color.join(','), color);
}
const palette = [...paletteByKey.values()];

function nearestPaletteColor(red, green, blue) {
  let nearest = palette[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const color of palette) {
    const deltaRed = red - color[0];
    const deltaGreen = green - color[1];
    const deltaBlue = blue - color[2];
    const colorDistance = deltaRed * deltaRed * 0.8 + deltaGreen * deltaGreen + deltaBlue * deltaBlue * 0.7;
    if (colorDistance < nearestDistance) {
      nearest = color;
      nearestDistance = colorDistance;
    }
  }
  return nearest;
}

function isChromaKey(red, green, blue) {
  return red > 45 && blue > 45 && red - green > 18 && blue - green > 18;
}

function getCellBounds(column, row) {
  const startX = Math.round(column * source.width / columns);
  const endX = Math.round((column + 1) * source.width / columns);
  const startY = Math.round(row * source.height / rows);
  const endY = Math.round((row + 1) * source.height / rows);
  let minX = endX;
  let minY = endY;
  let maxX = startX - 1;
  let maxY = startY - 1;
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * source.width + x) * 4;
      if (source.data[index + 3] === 0 || isChromaKey(source.data[index], source.data[index + 1], source.data[index + 2])) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error(`No giant found in generated cell ${column},${row}.`);
  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

const bounds = Array.from({ length: rows }, (_, row) => Array.from(
  { length: columns },
  (_, column) => getCellBounds(column, row),
));
const flatBounds = bounds.flat();
const uniformScale = Math.min(
  92 / Math.max(...flatBounds.map((box) => box.width)),
  90 / Math.max(...flatBounds.map((box) => box.height)),
);
const output = new PNG({ width: outputWidth, height: outputHeight, colorType: 6 });
output.data.fill(0);
let opaquePixels = 0;
let transparentPixels = 0;

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const box = bounds[row][column];
    const logicalWidth = Math.max(1, Math.round(box.width * uniformScale / pixelScale));
    const logicalHeight = Math.max(1, Math.round(box.height * uniformScale / pixelScale));
    const drawWidth = logicalWidth * pixelScale;
    const drawHeight = logicalHeight * pixelScale;
    const destinationX = column * cellSize + Math.floor((cellSize - drawWidth) / 2);
    const destinationY = row * cellSize + baseline - drawHeight;
    for (let logicalY = 0; logicalY < logicalHeight; logicalY += 1) {
      const sourceY = box.minY + Math.min(box.height - 1, Math.floor((logicalY + 0.5) * box.height / logicalHeight));
      for (let logicalX = 0; logicalX < logicalWidth; logicalX += 1) {
        const sourceX = box.minX + Math.min(box.width - 1, Math.floor((logicalX + 0.5) * box.width / logicalWidth));
        const sourceIndex = (sourceY * source.width + sourceX) * 4;
        const red = source.data[sourceIndex];
        const green = source.data[sourceIndex + 1];
        const blue = source.data[sourceIndex + 2];
        if (source.data[sourceIndex + 3] === 0 || isChromaKey(red, green, blue)) {
          transparentPixels += pixelScale * pixelScale;
          continue;
        }
        const color = nearestPaletteColor(red, green, blue);
        for (let blockY = 0; blockY < pixelScale; blockY += 1) {
          for (let blockX = 0; blockX < pixelScale; blockX += 1) {
            const outputX = destinationX + logicalX * pixelScale + blockX;
            const outputY = destinationY + logicalY * pixelScale + blockY;
            if (outputX < column * cellSize || outputX >= (column + 1) * cellSize) continue;
            if (outputY < row * cellSize || outputY >= (row + 1) * cellSize) continue;
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
console.log(`Processed smooth throw sheet ${output.width}x${output.height}: scale=${uniformScale.toFixed(3)}, ${opaquePixels} opaque, ${transparentPixels} sampled transparent pixels.`);
