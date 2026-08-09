import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';

const root = process.cwd();
const outputPath = join(root, 'art', 'reference', 'adventurer-fresh-race-direction-sheet.png');
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
for (let y = 0; y < sheet.height; y += 1) {
  for (let x = 0; x < sheet.width; x += 1) {
    const index = (y * sheet.width + x) * 4;
    const dark = (Math.floor(x / 24) + Math.floor(y / 24)) % 2;
    sheet.data.set(dark ? [13, 23, 34, 255] : [20, 35, 49, 255], index);
  }
}

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
        weapon: group.weapons.classic,
      };
      const paths = back
        ? [layers.weapon, layers.body, layers.outfit, layers.face, layers.heritage, layers.hair]
        : classId === 'hunter'
          ? [layers.body, layers.outfit, layers.weapon, layers.face, layers.heritage, layers.hair]
          : [layers.body, layers.outfit, layers.face, layers.heritage, layers.hair, layers.weapon];
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
    }
    outputRow += 1;
  }
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, PNG.sync.write(sheet, { colorType: 6 }));
console.log(`Rendered ${outputPath}.`);
