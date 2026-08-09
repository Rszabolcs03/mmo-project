import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  throw new Error('Usage: node expand-four-to-eight-direction-sheet.mjs <input> <output>');
}

const frameSize = 48;
const columns = 6;
const sourceRows = 4;
const outputRows = 8;
const source = PNG.sync.read(readFileSync(sourcePath));
if (source.width === frameSize * columns && source.height === frameSize * outputRows) {
  if (sourcePath !== outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, PNG.sync.write(source, { colorType: 6 }));
  }
  console.log(`Already eight-direction: ${sourcePath}`);
  process.exit(0);
}
if (source.width !== frameSize * columns || source.height !== frameSize * sourceRows) {
  throw new Error(`Expected ${frameSize * columns}x${frameSize * sourceRows}, got ${source.width}x${source.height}.`);
}

const output = new PNG({
  width: frameSize * columns,
  height: frameSize * outputRows,
  colorType: 6,
});
output.data.fill(0);

function copyFrame(sourceRow, destinationRow, column, { mirror = false, offsetX = 0 } = {}) {
  for (let y = 0; y < frameSize; y += 1) {
    for (let x = 0; x < frameSize; x += 1) {
      const sourceX = column * frameSize + (mirror ? frameSize - 1 - x : x);
      const sourceIndex = ((sourceRow * frameSize + y) * source.width + sourceX) * 4;
      if (source.data[sourceIndex + 3] === 0) continue;

      const destinationX = column * frameSize + x + offsetX;
      if (destinationX < column * frameSize || destinationX >= (column + 1) * frameSize) continue;
      const destinationIndex = ((destinationRow * frameSize + y) * output.width + destinationX) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        output.data[destinationIndex + channel] = source.data[sourceIndex + channel];
      }
    }
  }
}

for (let column = 0; column < columns; column += 1) {
  copyFrame(0, 0, column); // down
  copyFrame(3, 1, column, { offsetX: -2 }); // up-left from back
  copyFrame(2, 2, column); // right
  copyFrame(1, 3, column); // down-left from left
  copyFrame(3, 4, column); // up
  copyFrame(1, 5, column, { mirror: true }); // down-right
  copyFrame(2, 6, column, { mirror: true }); // left
  copyFrame(3, 7, column, { mirror: true, offsetX: 2 }); // up-right
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, PNG.sync.write(output, { colorType: 6 }));
console.log(`Expanded ${sourcePath} to ${outputPath} (${output.width}x${output.height}).`);
