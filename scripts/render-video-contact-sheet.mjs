import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const inputDirectory = resolve(process.argv[2] ?? '.tmp/video-frames');
const outputPath = resolve(process.argv[3] ?? '.tmp/video-contact-sheet.png');
const columns = Math.max(1, Number.parseInt(process.argv[4] ?? '4', 10));
const scale = Math.max(0.1, Math.min(8, Number.parseFloat(process.argv[5] ?? '0.4')));
const frameFiles = readdirSync(inputDirectory)
  .filter((fileName) => /^frame-\d+\.png$/i.test(fileName))
  .sort();

if (frameFiles.length === 0) {
  throw new Error(`No PNG frames found in ${inputDirectory}.`);
}

const first = PNG.sync.read(readFileSync(resolve(inputDirectory, frameFiles[0])));
const cropLeft = Math.max(0, Number.parseInt(process.argv[6] ?? '0', 10));
const cropTop = Math.max(0, Number.parseInt(process.argv[7] ?? '0', 10));
const cropWidth = Math.max(1, Math.min(first.width - cropLeft, Number.parseInt(process.argv[8] ?? `${first.width}`, 10)));
const cropHeight = Math.max(1, Math.min(first.height - cropTop, Number.parseInt(process.argv[9] ?? `${first.height}`, 10)));
const frameWidth = Math.max(1, Math.round(cropWidth * scale));
const frameHeight = Math.max(1, Math.round(cropHeight * scale));
const rows = Math.ceil(frameFiles.length / columns);
const output = new PNG({
  width: frameWidth * columns,
  height: frameHeight * rows,
  colorType: 6,
});
output.data.fill(0);

for (let frameIndex = 0; frameIndex < frameFiles.length; frameIndex += 1) {
  const frame = PNG.sync.read(readFileSync(resolve(inputDirectory, frameFiles[frameIndex])));
  const destinationLeft = (frameIndex % columns) * frameWidth;
  const destinationTop = Math.floor(frameIndex / columns) * frameHeight;
  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const sourceX = Math.min(frame.width - 1, cropLeft + Math.floor(x / scale));
      const sourceY = Math.min(frame.height - 1, cropTop + Math.floor(y / scale));
      const sourceIndex = (sourceY * frame.width + sourceX) * 4;
      const outputIndex = (
        (destinationTop + y) * output.width + destinationLeft + x
      ) * 4;
      output.data.set(frame.data.subarray(sourceIndex, sourceIndex + 4), outputIndex);
    }
  }
}

writeFileSync(outputPath, PNG.sync.write(output, { colorType: 6 }));
console.log(`Rendered ${frameFiles.length} video frames to ${outputPath}.`);
