import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';

const root = process.cwd();
const outputPath = join(root, 'art', 'reference', 'adventurer-fresh-race-direction-sheet.png');
const faceOutputPath = join(root, 'art', 'reference', 'adventurer-fresh-race-face-direction-sheet.png');
const examples = [
  ['human', 'mage'],
  ['elf', 'hunter'],
  ['dwarf', 'warrior'],
  ['orc', 'hunter'],
  ['undead', 'priest'],
];
const bodies = ['male', 'female'];
const defaultHeritage = {
  human: 'road-freckles',
  elf: 'moon-sigil',
  dwarf: 'clan-rune',
  orc: 'war-paint',
  undead: 'grave-cracks',
};
const directions = 8;
const padding = 6;
const cache = new Map();

function load(raceId, relativePath) {
  if (!relativePath) return null;
  const key = `${raceId}/${relativePath}`;
  if (!cache.has(key)) {
    cache.set(key, PNG.sync.read(readFileSync(join(
      root,
      'public',
      'assets',
      'characters',
      `${raceId}_fresh`,
      ...relativePath.split('/'),
    ))));
  }
  return cache.get(key);
}

function composite(raceId, paths, frameSize, row) {
  const output = new PNG({ width: frameSize, height: frameSize, colorType: 6 });
  for (const relativePath of paths.filter(Boolean)) {
    const source = load(raceId, relativePath);
    for (let y = 0; y < frameSize; y += 1) {
      for (let x = 0; x < frameSize; x += 1) {
        const sourceIndex = (((row * frameSize + y) * source.width) + x) * 4;
        if (source.data[sourceIndex + 3] === 0) continue;
        output.data.set(source.data.subarray(sourceIndex, sourceIndex + 4), (y * frameSize + x) * 4);
      }
    }
  }
  return output;
}

function nearestRegion(source, sourceX, sourceY, width, height, factor) {
  const output = new PNG({ width: width * factor, height: height * factor, colorType: 6 });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = (((sourceY + y) * source.width) + sourceX + x) * 4;
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const targetIndex = ((((y * factor) + dy) * output.width) + x * factor + dx) * 4;
          output.data.set(source.data.subarray(sourceIndex, sourceIndex + 4), targetIndex);
        }
      }
    }
  }
  return output;
}

function paintBackdrop(image) {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      const dark = (Math.floor(x / 24) + Math.floor(y / 24)) % 2;
      image.data.set(dark ? [13, 23, 34, 255] : [20, 35, 49, 255], index);
    }
  }
}

const manifests = Object.fromEntries(examples.map(([raceId]) => [
  raceId,
  JSON.parse(readFileSync(join(root, 'public', 'assets', 'characters', `${raceId}_fresh`, 'manifest.json'), 'utf8')),
]));
const frameSize = manifests.human.frame.size;
const sheet = new PNG({
  width: padding + directions * (frameSize + padding),
  height: padding + examples.length * bodies.length * (frameSize + padding),
  colorType: 6,
});
paintBackdrop(sheet);
const faceCrop = { x: 24, y: 0, width: 48, height: 52, scale: 2 };
const faceCell = { width: faceCrop.width * faceCrop.scale, height: faceCrop.height * faceCrop.scale };
const faceSheet = new PNG({
  width: padding + directions * (faceCell.width + padding),
  height: padding + examples.length * bodies.length * (faceCell.height + padding),
  colorType: 6,
});
paintBackdrop(faceSheet);

let outputRow = 0;
for (const [raceId, classId] of examples) {
  const manifest = manifests[raceId];
  for (const body of bodies) {
    const group = manifest.classes[classId][body];
    const hairStyle = body === 'male' ? 'windswept' : 'side-bangs';
    for (let row = 0; row < directions; row += 1) {
      const back = row >= 3 && row <= 5;
      const layers = {
        body: manifest.bodies[body],
        outfit: group.outfits.classic,
        face: manifest.faces[body].focused,
        heritage: manifest.heritage[defaultHeritage[raceId]],
        hair: manifest.hair[body][hairStyle],
        headwear: group.headwear.classic,
        weapon: group.weapons.classic,
      };
      const paths = back
        ? [layers.weapon, layers.body, layers.outfit, layers.face, layers.heritage, layers.hair, layers.headwear]
        : classId === 'hunter'
          ? [layers.body, layers.outfit, layers.weapon, layers.face, layers.heritage, layers.hair, layers.headwear]
          : [layers.body, layers.outfit, layers.face, layers.heritage, layers.hair, layers.headwear, layers.weapon];
      const frame = composite(raceId, paths, frameSize, row);
      PNG.bitblt(
        frame,
        sheet,
        0,
        0,
        frameSize,
        frameSize,
        padding + row * (frameSize + padding),
        padding + outputRow * (frameSize + padding),
      );
      const facePaths = paths.filter((path) => path !== layers.heritage);
      const cleanFaceFrame = composite(raceId, facePaths, frameSize, row);
      const faceFrame = nearestRegion(
        cleanFaceFrame,
        faceCrop.x,
        faceCrop.y,
        faceCrop.width,
        faceCrop.height,
        faceCrop.scale,
      );
      PNG.bitblt(
        faceFrame,
        faceSheet,
        0,
        0,
        faceFrame.width,
        faceFrame.height,
        padding + row * (faceCell.width + padding),
        padding + outputRow * (faceCell.height + padding),
      );
    }
    outputRow += 1;
  }
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, PNG.sync.write(sheet, { colorType: 6 }));
writeFileSync(faceOutputPath, PNG.sync.write(faceSheet, { colorType: 6 }));
console.log(`Rendered ${outputPath}.`);
console.log(`Rendered ${faceOutputPath}.`);
