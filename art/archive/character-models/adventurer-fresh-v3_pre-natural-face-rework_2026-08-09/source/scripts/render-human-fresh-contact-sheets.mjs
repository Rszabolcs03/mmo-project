import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';

const root = process.cwd();
const assetRoot = join(root, 'public', 'assets', 'characters', 'human_fresh');
const outputRoot = join(root, 'art', 'reference');
const manifest = JSON.parse(readFileSync(join(assetRoot, 'manifest.json'), 'utf8'));
const size = manifest.frame.size;
const padding = 4;
const classes = ['mage', 'hunter', 'paladin', 'warrior', 'priest', 'rogue'];
const bodies = ['male', 'female'];
const cache = new Map();

function read(path) {
  if (!path) return null;
  if (!cache.has(path)) cache.set(path, PNG.sync.read(readFileSync(join(assetRoot, ...path.split('/')))));
  return cache.get(path);
}

function blend(target, targetIndex, source, sourceIndex) {
  if (source.data[sourceIndex + 3] === 0) return;
  target.data.set(source.data.subarray(sourceIndex, sourceIndex + 4), targetIndex);
}

function layerPaths(classId, body, options = {}) {
  const group = manifest.classes[classId][body];
  const selected = {
    cape: options.cape ? manifest.capes[options.cape] : null,
    body: manifest.bodies[body],
    outfit: group.outfits[options.outfit ?? 'classic'],
    face: manifest.faces[body][options.face ?? 'natural'],
    heritage: options.heritage === 'none'
      ? null
      : manifest.heritage[options.heritage ?? 'road-freckles'],
    beard: body === 'male' && options.beard ? manifest.beards[options.beard] : null,
    hair: manifest.hair[body][options.hair ?? (body === 'male' ? 'cropped' : 'long')],
    offhand: options.tank ? group.offhands[options.weapon ?? 'classic'] : null,
    weapon: group.weapons[options.weapon ?? 'classic'],
  };
  return options.back
    ? [selected.weapon, selected.offhand, selected.body, selected.outfit, selected.cape, selected.face, selected.heritage, selected.beard, selected.hair]
    : classId === 'hunter'
      ? [selected.cape, selected.body, selected.outfit, selected.weapon, selected.face, selected.heritage, selected.beard, selected.hair]
      : [selected.cape, selected.body, selected.outfit, selected.face, selected.heritage, selected.beard, selected.hair, selected.offhand, selected.weapon];
}

function composite(paths, column, row) {
  const output = new PNG({ width: size, height: size, colorType: 6 });
  for (const path of paths.filter(Boolean)) {
    const layer = read(path);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const sourceIndex = (((row * size + y) * layer.width) + column * size + x) * 4;
        blend(output, (y * size + x) * 4, layer, sourceIndex);
      }
    }
  }
  return output;
}

function sheet(columns, rows) {
  const output = new PNG({
    width: padding + columns * (size + padding),
    height: padding + rows * (size + padding),
    colorType: 6,
  });
  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      const index = (y * output.width + x) * 4;
      const dark = (Math.floor(x / 24) + Math.floor(y / 24)) % 2;
      output.data.set(dark ? [13, 23, 34, 255] : [17, 31, 46, 255], index);
    }
  }
  return output;
}

function place(target, source, column, row) {
  PNG.bitblt(source, target, 0, 0, size, size, padding + column * (size + padding), padding + row * (size + padding));
}

function save(name, image) {
  const path = join(outputRoot, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(image, { colorType: 6 }));
  console.log(`Rendered ${path}.`);
}

function nearestNeighbor(source, factor) {
  const output = new PNG({
    width: source.width * factor,
    height: source.height * factor,
    colorType: 6,
  });
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (y * source.width + x) * 4;
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const targetX = x * factor + sx;
          const targetY = y * factor + sy;
          const targetIndex = (targetY * output.width + targetX) * 4;
          output.data.set(source.data.subarray(sourceIndex, sourceIndex + 4), targetIndex);
        }
      }
    }
  }
  return output;
}

const lineupRows = classes.length * bodies.length;
const animation = sheet(9, lineupRows);
const directions = sheet(8, lineupRows);
const attacks = sheet(8, lineupRows);
let line = 0;
for (const classId of classes) {
  for (const body of bodies) {
    for (let column = 0; column < 9; column += 1) {
      place(animation, composite(layerPaths(classId, body), column, 0), column, line);
    }
    for (let row = 0; row < 8; row += 1) {
      const back = row >= 3 && row <= 5;
      place(directions, composite(layerPaths(classId, body, { back }), 0, row), row, line);
      place(attacks, composite(layerPaths(classId, body, { back }), 7, row), row, line);
    }
    line += 1;
  }
}
save('human-fresh-animation-contact-sheet.png', animation);
save('human-fresh-direction-contact-sheet.png', directions);
save('human-fresh-attack-contact-sheet.png', attacks);

const outfits = sheet(4, lineupRows);
const weapons = sheet(5, lineupRows);
line = 0;
for (const classId of classes) {
  for (const body of bodies) {
    for (const [column, outfit] of ['classic', 'veteran', 'runed', 'dark'].entries()) {
      place(outfits, composite(layerPaths(classId, body, { outfit }), 0, 0), column, line);
    }
    for (const [column, weapon] of ['classic', 'veteran', 'runed', 'ornate', 'shadow'].entries()) {
      place(weapons, composite(layerPaths(classId, body, { weapon }), 0, 0), column, line);
    }
    line += 1;
  }
}
save('human-fresh-outfit-contact-sheet.png', outfits);
save('human-fresh-weapon-contact-sheet.png', weapons);

const cosmetics = sheet(8, 2);
for (const [row, body] of bodies.entries()) {
  for (let column = 0; column < 8; column += 1) {
    const face = faceStyles(body)[column < 4 ? column : 0];
    const hair = hairStylesFor(body)[column < 4 ? 0 : column - 4];
    place(cosmetics, composite(layerPaths('mage', body, {
      face,
      hair,
      beard: body === 'male' && column === 7 ? 'short' : null,
    }), 0, 0), column, row);
  }
}
save('human-fresh-cosmetic-contact-sheet.png', cosmetics);
save('human-fresh-cosmetic-detail-sheet.png', nearestNeighbor(cosmetics, 2));

const faces = sheet(4, 8);
let faceRow = 0;
for (const body of bodies) {
  for (const face of faceStyles(body)) {
    const hair = body === 'male' ? 'cropped' : 'bun';
    for (const [column, directionRow] of [0, 2, 4, 6].entries()) {
      place(faces, composite(layerPaths('mage', body, {
        face,
        hair,
        back: directionRow === 4,
      }), 0, directionRow), column, faceRow);
    }
    faceRow += 1;
  }
}
save('human-fresh-face-direction-detail-sheet.png', nearestNeighbor(faces, 2));

const heritage = sheet(4, bodies.length * 4);
let heritageRow = 0;
for (const body of bodies) {
  for (const directionRow of [0, 2, 4, 6]) {
    for (const [column, style] of ['none', ...Object.keys(manifest.heritage)].entries()) {
      place(heritage, composite(layerPaths('mage', body, {
        heritage: style,
        back: directionRow === 4,
      }), 0, directionRow), column, heritageRow);
    }
    heritageRow += 1;
  }
}
save('human-fresh-heritage-contact-sheet.png', heritage);
save('human-fresh-heritage-detail-sheet.png', nearestNeighbor(heritage, 2));

const profileBack = sheet(4, 10);
let profileBackRow = 0;
for (const body of bodies) {
  for (const hair of hairStylesFor(body)) {
    for (const [column, directionRow] of [0, 2, 4, 6].entries()) {
      place(profileBack, composite(layerPaths('mage', body, {
        hair,
        back: directionRow === 4,
      }), 0, directionRow), column, profileBackRow);
    }
    profileBackRow += 1;
  }
}
for (const body of bodies) {
  for (const [column, directionRow] of [0, 2, 4, 6].entries()) {
    place(profileBack, composite(layerPaths('hunter', body, {
      back: directionRow === 4,
    }), 0, directionRow), column, profileBackRow);
  }
  profileBackRow += 1;
}
save('human-fresh-profile-back-contact-sheet.png', profileBack);
save('human-fresh-profile-back-detail-sheet.png', nearestNeighbor(profileBack, 2));

const capes = sheet(4, 4);
for (const [bodyIndex, body] of bodies.entries()) {
  for (const [capeIndex, cape] of ['short', 'long'].entries()) {
    const outputRow = bodyIndex * 2 + capeIndex;
    for (const [column, directionRow] of [0, 2, 4, 6].entries()) {
      place(capes, composite(layerPaths('mage', body, {
        cape,
        back: directionRow === 4,
      }), 0, directionRow), column, outputRow);
    }
  }
}
save('human-fresh-cape-contact-sheet.png', capes);

const roles = sheet(2, 4);
let roleRow = 0;
for (const classId of ['warrior', 'paladin']) {
  for (const body of bodies) {
    place(roles, composite(layerPaths(classId, body), 0, 0), 0, roleRow);
    place(roles, composite(layerPaths(classId, body, { tank: true }), 0, 0), 1, roleRow);
    roleRow += 1;
  }
}
save('human-fresh-role-contact-sheet.png', roles);

function faceStyles(body) {
  return Object.keys(manifest.faces[body]);
}

function hairStylesFor(body) {
  return Object.keys(manifest.hair[body]);
}
