import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const sourceCellSize = 96;
const cellSize = 128;
const rows = 4;
const currentPath = process.argv[2] ?? 'tmp/imagegen/four-direction/tideglass-matriarch-current-sheet.png';
const attackPath = process.argv[3] ?? 'tmp/imagegen/four-direction/tideglass-matriarch-smooth-cast-sheet.png';
const outputPath = process.argv[4] ?? 'public/assets/enemies/tideglass-matriarch.png';
const current = PNG.sync.read(readFileSync(currentPath));
const attack = PNG.sync.read(readFileSync(attackPath));
const attackFrameOrder = [null, 1, 2, 3, 4, 5, 1, null];
const attackDirectionRows = [0, 2, 1, 3];

if (current.width < sourceCellSize * 4 || current.height !== sourceCellSize * rows) {
  throw new Error(`Expected at least four 96px walk columns, received ${current.width}x${current.height}.`);
}
if (attack.width !== cellSize * 8 || attack.height !== cellSize * rows) {
  throw new Error(`Expected an 8x4 cast sheet, received ${attack.width}x${attack.height}.`);
}

const output = new PNG({ width: cellSize * 12, height: cellSize * rows, colorType: 6 });
output.data.fill(0);

function copyCell(
  source,
  sourceCell,
  sourceColumn,
  sourceRow,
  destinationColumn,
  destinationRow,
  offsetX = 0,
  offsetY = 0,
) {
  for (let y = 0; y < sourceCell; y += 1) {
    for (let x = 0; x < sourceCell; x += 1) {
      const sourceIndex = ((sourceRow * sourceCell + y) * source.width + sourceColumn * sourceCell + x) * 4;
      const destinationX = destinationColumn * cellSize + offsetX + x;
      const destinationY = destinationRow * cellSize + offsetY + y;
      const destinationIndex = (destinationY * output.width + destinationX) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        output.data[destinationIndex + channel] = source.data[sourceIndex + channel];
      }
    }
  }
}

for (let row = 0; row < rows; row += 1) {
  for (let frame = 0; frame < 4; frame += 1) copyCell(current, sourceCellSize, frame, row, frame, row, 16, 32);
  attackFrameOrder.forEach((sourceFrame, frame) => {
    if (sourceFrame == null) {
      copyCell(current, sourceCellSize, 0, row, frame + 4, row, 16, 32);
      return;
    }
    copyCell(attack, cellSize, sourceFrame, attackDirectionRows[row], frame + 4, row);
  });
}

writeFileSync(outputPath, PNG.sync.write(output, { colorType: 6 }));
console.log(`Built ${output.width}x${output.height} Tideglass sheet with preserved walk and eight-frame cast rows.`);
