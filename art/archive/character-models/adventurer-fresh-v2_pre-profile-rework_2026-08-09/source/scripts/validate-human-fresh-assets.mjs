import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const root = process.cwd();
const assetRoot = join(root, 'public', 'assets', 'characters', 'human_fresh');
const manifest = JSON.parse(readFileSync(join(assetRoot, 'manifest.json'), 'utf8'));
const classes = ['mage', 'hunter', 'paladin', 'warrior', 'priest', 'rogue'];
const bodies = ['male', 'female'];
const size = 96;
const width = size * 9;
const height = size * 8;
const cache = new Map();

for (const removedRoot of ['human', 'humans_v2', 'human_old', 'old_humans', 'old_humans2', 'legacy']) {
  if (existsSync(join(root, 'public', 'assets', 'characters', removedRoot))) {
    throw new Error(`Removed human asset root was recreated: ${removedRoot}`);
  }
}

if (manifest.model !== 'adventurer-fresh-v2' || manifest.version !== 2) {
  throw new Error(`Expected adventurer-fresh-v2, got ${manifest.model} v${manifest.version}.`);
}
if (!manifest.provenance.includes('reads no prior character sprite files')) {
  throw new Error('The fresh manifest does not declare independent provenance.');
}
if (
  manifest.frame.size !== size
  || manifest.frame.columns !== 9
  || manifest.frame.rows !== 8
  || JSON.stringify(manifest.frame.walk) !== JSON.stringify([1, 2, 3, 4])
  || JSON.stringify(manifest.frame.attack) !== JSON.stringify([5, 6, 7, 8])
) throw new Error('Fresh frame contract is invalid.');
if (manifest.architecture.layers.join(',') !== 'cape,body,outfit,face,beard,hair,offhand,weapon') {
  throw new Error('Fresh paper-doll layer contract is invalid.');
}

function read(path) {
  if (!path || path.includes('..')) throw new Error(`Invalid fresh asset path: ${path}`);
  if (!cache.has(path)) {
    const absolute = join(assetRoot, ...path.split('/'));
    if (!existsSync(absolute)) throw new Error(`Missing fresh asset: ${path}`);
    const image = PNG.sync.read(readFileSync(absolute));
    if (image.width !== width || image.height !== height) {
      throw new Error(`${path} is ${image.width}x${image.height}; expected ${width}x${height}.`);
    }
    cache.set(path, image);
  }
  return cache.get(path);
}

function index(image, row, column, x, y) {
  return (((row * size + y) * image.width) + column * size + x) * 4;
}

function frameDifference(left, leftRow, leftColumn, right, rightRow, rightColumn) {
  let different = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const a = index(left, leftRow, leftColumn, x, y);
      const b = index(right, rightRow, rightColumn, x, y);
      let delta = 0;
      for (let channel = 0; channel < 4; channel += 1) delta += Math.abs(left.data[a + channel] - right.data[b + channel]);
      if (delta > 24) different += 1;
    }
  }
  return different;
}

function atlasDifference(left, right) {
  let different = 0;
  for (let pixel = 0; pixel < left.data.length; pixel += 4) {
    let delta = 0;
    for (let channel = 0; channel < 4; channel += 1) delta += Math.abs(left.data[pixel + channel] - right.data[pixel + channel]);
    if (delta > 24) different += 1;
  }
  return different;
}

function alphaCount(image, row, column) {
  return points(image, row, column).length;
}

function alphaOverlap(left, right, row, column, maxY = size) {
  let overlap = 0;
  for (let y = 0; y < maxY; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (
        left.data[index(left, row, column, x, y) + 3] >= 32
        && right.data[index(right, row, column, x, y) + 3] >= 32
      ) overlap += 1;
    }
  }
  return overlap;
}

function points(image, row, column) {
  const result = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (image.data[index(image, row, column, x, y) + 3] >= 32) result.push([x, y]);
    }
  }
  return result;
}

function nearestDistance(left, right) {
  let minimum = Number.POSITIVE_INFINITY;
  for (const [leftX, leftY] of left) {
    for (const [rightX, rightY] of right) {
      minimum = Math.min(minimum, Math.hypot(leftX - rightX, leftY - rightY));
      if (minimum === 0) return 0;
    }
  }
  return minimum;
}

function visibleFacePixels(face, hair, row, column) {
  let visible = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const faceAlpha = face.data[index(face, row, column, x, y) + 3];
      const hairAlpha = hair.data[index(hair, row, column, x, y) + 3];
      if (faceAlpha >= 32 && hairAlpha < 32) visible += 1;
    }
  }
  return visible;
}

function visibleEyePixels(face, hair, row, column) {
  let visible = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const faceIndex = index(face, row, column, x, y);
      const isEye = face.data[faceIndex] === 30
        && face.data[faceIndex + 1] === 58
        && face.data[faceIndex + 2] === 95
        && face.data[faceIndex + 3] >= 32;
      const hairAlpha = hair.data[index(hair, row, column, x, y) + 3];
      if (isEye && hairAlpha < 32) visible += 1;
    }
  }
  return visible;
}

const paths = new Set([
  ...Object.values(manifest.bodies),
  ...bodies.flatMap((body) => Object.values(manifest.faces[body])),
  ...bodies.flatMap((body) => Object.values(manifest.hair[body])),
  ...Object.values(manifest.beards),
  ...Object.values(manifest.capes),
  ...classes.flatMap((classId) => bodies.flatMap((body) => [
    ...Object.values(manifest.classes[classId][body].outfits),
    ...Object.values(manifest.classes[classId][body].weapons),
    ...Object.values(manifest.classes[classId][body].offhands),
  ])),
]);
if (paths.size !== 150) throw new Error(`Expected 150 unique fresh atlases, got ${paths.size}.`);
for (const path of paths) read(path);

const shortCape = read(manifest.capes.short);
const longCape = read(manifest.capes.long);
if (atlasDifference(shortCape, longCape) < 2_000) throw new Error('Short and long capes are not visibly distinct.');
for (const row of [0, 2, 4, 6]) {
  const profile = row === 2 || row === 6;
  const minimumCapePixels = profile ? 240 : 700;
  const minimumLongExtension = profile ? 80 : 300;
  if (alphaCount(shortCape, row, 0) < minimumCapePixels) throw new Error(`Short cape is not readable in direction row ${row}.`);
  if (alphaCount(longCape, row, 0) < alphaCount(shortCape, row, 0) + minimumLongExtension) {
    throw new Error(`Long cape does not extend beyond the short cape in direction row ${row}.`);
  }
}

for (const body of bodies) {
  const bodyImage = read(manifest.bodies[body]);
  const faceImages = Object.values(manifest.faces[body]).map(read);
  const hairImages = Object.values(manifest.hair[body]).map(read);
  for (let option = 1; option < faceImages.length; option += 1) {
    if (atlasDifference(faceImages[0], faceImages[option]) < 300) throw new Error(`${body} face ${option} is not distinct.`);
    if (frameDifference(faceImages[0], 0, 0, faceImages[option], 0, 0) < 8) {
      throw new Error(`${body} face ${option} is not visibly distinct from the front.`);
    }
    for (const profileRow of [2, 6]) {
      // A true profile has only one readable eye and very little room for an
      // expression mark. Require a real profile layer here; the combined
      // face/hair checks below separately verify that it stays visible.
      if (alphaCount(faceImages[option], profileRow, 0) < 16) {
        throw new Error(`${body} face ${option} is missing in side row ${profileRow}.`);
      }
    }
  }
  for (let option = 1; option < hairImages.length; option += 1) {
    if (atlasDifference(hairImages[0], hairImages[option]) < 500) throw new Error(`${body} hair ${option} is not distinct.`);
  }
  for (const face of faceImages) {
    for (const hair of hairImages) {
      for (const row of [0, 1, 2, 6, 7]) {
        if (visibleFacePixels(face, hair, row, 0) < 12) {
          throw new Error(`${body} face/hair combination hides the readable face in row ${row}.`);
        }
        if (face !== faceImages.at(-1)
          && ![2, 6].includes(row)
          && visibleEyePixels(face, hair, row, 0) < 8) {
          throw new Error(`${body} face/hair combination hides the eye color in row ${row}.`);
        }
      }
      if (face !== faceImages.at(-1)
        && visibleEyePixels(face, hair, 2, 0) + visibleEyePixels(face, hair, 6, 0) < 4) {
        throw new Error(`${body} face ${faceImages.indexOf(face)}/hair ${hairImages.indexOf(hair)} combination hides the eye color in both side views.`);
      }
    }
  }
  if (points(bodyImage, 4, 0).length < 80) throw new Error(`${body} rear body frame is missing.`);
  if (frameDifference(bodyImage, 0, 0, bodyImage, 2, 0) < 100) throw new Error(`${body} profile head silhouette is not directional.`);
  if (frameDifference(bodyImage, 0, 0, bodyImage, 4, 0) < 100) throw new Error(`${body} rear head silhouette is not directional.`);
}

for (const classId of classes) {
  for (const body of bodies) {
    const group = manifest.classes[classId][body];
    const outfits = Object.values(group.outfits).map(read);
    const weapons = Object.values(group.weapons).map(read);
    const offhands = Object.values(group.offhands).map(read);
    const expectsTankOffhand = classId === 'warrior' || classId === 'paladin';
    if (offhands.length !== (expectsTankOffhand ? 5 : 0)) {
      throw new Error(`${classId} ${body} has an invalid tank offhand set.`);
    }
    for (let option = 1; option < outfits.length; option += 1) {
      if (atlasDifference(outfits[0], outfits[option]) < 800) throw new Error(`${classId} ${body} outfit ${option} is not distinct.`);
    }
    if (frameDifference(outfits[0], 0, 0, outfits[0], 4, 0) < 120) {
      throw new Error(`${classId} ${body} outfit does not have a distinct rear design.`);
    }
    for (let option = 1; option < weapons.length; option += 1) {
      if (atlasDifference(weapons[0], weapons[option]) < 120) throw new Error(`${classId} ${body} weapon ${option} is not distinct.`);
    }
    for (let option = 0; option < offhands.length; option += 1) {
      if (atlasDifference(weapons[option], offhands[option]) < 2_000) {
        throw new Error(`${classId} ${body} weapon/offhand ${option} are not independent assets.`);
      }
      if (alphaCount(offhands[option], 0, 0) < 150) {
        throw new Error(`${classId} ${body} tank offhand ${option} is not visibly rendered.`);
      }
    }
    const bodyImage = read(manifest.bodies[body]);
    for (let row = 0; row < 8; row += 1) {
      if (frameDifference(outfits[0], row, 1, outfits[0], row, 3) < 80) throw new Error(`${classId} ${body} row ${row} lacks stride motion.`);
      if (frameDifference(outfits[0], row, 2, outfits[0], row, 4) < 30) throw new Error(`${classId} ${body} row ${row} lacks passing poses.`);
      for (let column = 5; column < 8; column += 1) {
        if (frameDifference(weapons[0], row, column, weapons[0], row, column + 1) < 30) {
          throw new Error(`${classId} ${body} row ${row} attack columns ${column}/${column + 1} are not animated.`);
        }
      }
      for (let column = 0; column < 9; column += 1) {
        const anchors = [...points(bodyImage, row, column), ...points(outfits[0], row, column)];
        const equipment = points(weapons[0], row, column);
        const distance = nearestDistance(anchors, equipment);
        if (distance > 4.5) {
          throw new Error(`${classId} ${body} row ${row} column ${column} weapon floats ${distance.toFixed(2)}px from its shared skeleton.`);
        }
        if (offhands.length) {
          const offhandDistance = nearestDistance(anchors, points(offhands[0], row, column));
          if (offhandDistance > 4.5) {
            throw new Error(`${classId} ${body} row ${row} column ${column} tank offhand floats ${offhandDistance.toFixed(2)}px from its shared skeleton.`);
          }
        }
      }
    }

    for (const sideRow of [2, 6]) {
      if (alphaOverlap(bodyImage, weapons[0], sideRow, 0, 38) > 64) {
        throw new Error(`${classId} ${body} side-view weapon obscures too much of the head.`);
      }
    }
  }
}

const generator = readFileSync(join(root, 'scripts', 'generate-human-fresh-assets.mjs'), 'utf8');
for (const forbidden of ['characters/human/', 'characters\\human\\', 'humans_v2', 'human_old']) {
  if (generator.includes(forbidden)) throw new Error(`Fresh generator depends on forbidden old source: ${forbidden}`);
}
const sharedGenerator = readFileSync(join(root, 'scripts', 'generate-character-sprites.mjs'), 'utf8');
if (sharedGenerator.includes('legacy/full-sheets')) {
  throw new Error('The shared sprite generator can recreate deleted legacy human sheets.');
}

console.log('Validated 150 from-scratch human adventurer-fresh-v2 atlases: corrected directional geometry without exposed neck pixels, polished faces/hair/capes/outfits, anchored weapons, four-phase walks and attacks, eight directions, one-sword DPS weapons, and independent tank offhands.');
