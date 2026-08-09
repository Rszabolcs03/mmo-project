import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const sourcePath = process.argv[2];
const targetPath = process.argv[3] ?? 'tmp/imagegen/four-direction/old-quarry-giant-throw-sheet.png';

if (!sourcePath) {
  throw new Error('Usage: node scripts/apply-old-quarry-giant-throw-sheet.mjs <chroma-source.png> [target.png]');
}

const source = PNG.sync.read(readFileSync(sourcePath));
const target = PNG.sync.read(readFileSync(targetPath));

if (target.width !== 768 || target.height !== 384) {
  throw new Error(`Expected a 768x384 target sheet, received ${target.width}x${target.height}.`);
}
if (Math.abs(source.width / source.height - 2) > 0.01) {
  throw new Error(`Expected a 2:1 generated sheet, received ${source.width}x${source.height}.`);
}

const firstAttackColumnX = target.width / 2;
let copiedPixels = 0;
let transparentPixels = 0;

for (let y = 0; y < target.height; y += 1) {
  const sourceY = Math.min(source.height - 1, Math.floor(((y + 0.5) / target.height) * source.height));
  for (let x = firstAttackColumnX; x < target.width; x += 1) {
    const sourceX = Math.min(source.width - 1, Math.floor(((x + 0.5) / target.width) * source.width));
    const sourceIndex = (sourceY * source.width + sourceX) * 4;
    const targetIndex = (y * target.width + x) * 4;
    const red = source.data[sourceIndex];
    const green = source.data[sourceIndex + 1];
    const blue = source.data[sourceIndex + 2];
    const isChromaKey = red > 45 && blue > 45 && red - green > 18 && blue - green > 18;

    if (isChromaKey) {
      target.data[targetIndex] = 0;
      target.data[targetIndex + 1] = 0;
      target.data[targetIndex + 2] = 0;
      target.data[targetIndex + 3] = 0;
      transparentPixels += 1;
    } else {
      target.data[targetIndex] = red;
      target.data[targetIndex + 1] = green;
      target.data[targetIndex + 2] = blue;
      target.data[targetIndex + 3] = 255;
      copiedPixels += 1;
    }
  }
}

writeFileSync(targetPath, PNG.sync.write(target, { colorType: 6 }));
console.log(`Updated 16 throw frames in ${targetPath}: ${copiedPixels} opaque, ${transparentPixels} transparent pixels.`);
