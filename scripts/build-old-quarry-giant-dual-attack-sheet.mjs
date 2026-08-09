import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const CELL_SIZE = 96;
const ROWS = 4;
const slamPath = process.argv[2] ?? 'tmp/imagegen/four-direction/old-quarry-giant-slam-sheet.png';
const throwPath = process.argv[3] ?? 'tmp/imagegen/four-direction/old-quarry-giant-smooth-throw-sheet.png';
const outputPath = process.argv[4] ?? 'public/assets/enemies/old-quarry-giant.png';

const slam = PNG.sync.read(readFileSync(slamPath));
const throwing = PNG.sync.read(readFileSync(throwPath));
if (slam.width !== CELL_SIZE * 8 || slam.height !== CELL_SIZE * ROWS) {
  throw new Error(`Expected an 8x4 slam sheet, received ${slam.width}x${slam.height}.`);
}
if (throwing.width !== CELL_SIZE * 8 || throwing.height !== CELL_SIZE * ROWS) {
  throw new Error(`Expected an attack-only 8x4 throw sheet, received ${throwing.width}x${throwing.height}.`);
}

const output = new PNG({ width: CELL_SIZE * 16, height: CELL_SIZE * ROWS, colorType: 6 });
output.data.fill(0);

function copyCell(source, sourceColumn, row, destinationColumn, pixelFilter = null) {
  for (let y = 0; y < CELL_SIZE; y += 1) {
    for (let x = 0; x < CELL_SIZE; x += 1) {
      if (pixelFilter && !pixelFilter(y * CELL_SIZE + x)) continue;
      const sourceIndex = ((row * CELL_SIZE + y) * source.width + sourceColumn * CELL_SIZE + x) * 4;
      const destinationIndex = ((row * CELL_SIZE + y) * output.width + destinationColumn * CELL_SIZE + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        output.data[destinationIndex + channel] = source.data[sourceIndex + channel];
      }
    }
  }
}

for (let row = 0; row < ROWS; row += 1) {
  for (let frame = 0; frame < 4; frame += 1) {
    copyCell(slam, frame, row, frame);
    copyCell(slam, frame + 4, row, frame + 4);
  }

  for (let frame = 0; frame < 8; frame += 1) {
    copyCell(throwing, frame, row, 8 + frame);
  }
}

writeFileSync(outputPath, PNG.sync.write(output, { colorType: 6 }));
console.log(`Built ${output.width}x${output.height} giant sheet with walk, slam, and eight-frame throw rows.`);
