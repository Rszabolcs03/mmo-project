import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [inputPath, rowValue = '0', columnValue = '0', xValue = '0', yValue = '0', widthValue = '48', heightValue = '48'] = process.argv.slice(2);
if (!inputPath) throw new Error('Usage: node inspect-sprite-frame.mjs <input> [row] [column] [x] [y] [width] [height]');

const image = PNG.sync.read(readFileSync(inputPath));
const frameSize = 48;
const [row, column, startX, startY, width, height] = [rowValue, columnValue, xValue, yValue, widthValue, heightValue]
  .map((value) => Number.parseInt(value, 10));
const knownColors = new Map([
  ['00000000', ' '],
  ['05080cff', 'X'],
  ['0b1220ff', 'x'],
  ['111820ff', '#'],
  ['f2c7a4ff', 'S'],
  ['d99a72ff', 's'],
  ['172554ff', 'n'],
  ['312e81ff', 'N'],
  ['1d4ed8ff', 'B'],
  ['4263ebff', 'b'],
  ['0e7490ff', 'c'],
  ['67e8f9ff', 'C'],
  ['8be9fdff', 'L'],
  ['f8fafcff', 'W'],
  ['f1f5f9ff', 'w'],
  ['facC15ff'.toLowerCase(), 'G'],
  ['b7791fff', 'g'],
  ['7c4a22ff', 'H'],
  ['5f4329ff', 'h'],
  ['4b2c15ff', 'd'],
]);

for (let y = startY; y < startY + height; y += 1) {
  let line = `${String(y).padStart(2, '0')} `;
  for (let x = startX; x < startX + width; x += 1) {
    const index = ((((row * frameSize) + y) * image.width) + column * frameSize + x) * 4;
    const hex = Array.from(image.data.subarray(index, index + 4), (value) => value.toString(16).padStart(2, '0')).join('');
    line += knownColors.get(hex) ?? (image.data[index + 3] === 0 ? ' ' : '?');
  }
  console.log(line);
}
