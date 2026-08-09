import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

const [
  inputPath,
  outputPath,
  rowValue = '0',
  columnValue = '0',
  scaleValue = '8',
  frameSizeValue = '48',
] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error(
    'Usage: node render-sprite-frame-preview.mjs <input> <output> [row] [column] [scale] [frame-size]',
  );
}

const row = Number.parseInt(rowValue, 10);
const column = Number.parseInt(columnValue, 10);
const scale = Number.parseInt(scaleValue, 10);
const frameSize = Number.parseInt(frameSizeValue, 10);
if (
  ![row, column, scale, frameSize].every(Number.isFinite)
  || row < 0
  || column < 0
  || scale < 1
  || frameSize < 1
) {
  throw new Error(
    'Row and column must be non-negative integers; scale and frame size must be positive integers.',
  );
}

const source = PNG.sync.read(readFileSync(inputPath));
if ((column + 1) * frameSize > source.width || (row + 1) * frameSize > source.height) {
  throw new Error(`Frame ${column},${row} lies outside ${source.width}x${source.height}.`);
}

const output = new PNG({ width: frameSize * scale, height: frameSize * scale, colorType: 6 });
for (let outputY = 0; outputY < output.height; outputY += 1) {
  for (let outputX = 0; outputX < output.width; outputX += 1) {
    const sourceX = column * frameSize + Math.floor(outputX / scale);
    const sourceY = row * frameSize + Math.floor(outputY / scale);
    const sourceIndex = (sourceY * source.width + sourceX) * 4;
    const outputIndex = (outputY * output.width + outputX) * 4;
    output.data.set(source.data.subarray(sourceIndex, sourceIndex + 4), outputIndex);
  }
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, PNG.sync.write(output, { colorType: 6 }));
console.log(`Rendered frame row=${row} column=${column} at ${scale}x: ${outputPath}`);
