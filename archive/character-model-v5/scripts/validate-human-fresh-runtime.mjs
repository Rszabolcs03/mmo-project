import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const vite = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
let gameData;
let mapAssets;
let worldEntities;
try {
  [gameData, mapAssets, worldEntities] = await Promise.all([
    vite.ssrLoadModule('/src/game/gameData.js'),
    vite.ssrLoadModule('/src/game/mapAssets.js'),
    vite.ssrLoadModule('/src/game/worldEntities.js'),
  ]);
} finally {
  await vite.close();
}

const bodies = ['male', 'female'];
const faces = {
  male: ['male-natural', 'male-focused', 'male-scarred', 'male-cheerful'],
  female: ['female-natural', 'female-focused', 'female-freckled', 'female-cheerful'],
};
const hair = {
  male: ['male-cropped', 'male-windswept', 'male-tousled', 'male-tied'],
  female: ['female-long', 'female-side-bangs', 'female-bun', 'female-ponytail'],
};
const outfits = ['classic', 'veteran', 'runed', 'dark'];
const weapons = ['classic', 'veteran', 'runed', 'ornate'];
const allClasses = Object.keys(gameData.CLASSES);

if (
  gameData.CHARACTER_SPRITE_VERSION !== 'adventurer-fresh-v5'
  || gameData.HUMAN_CHARACTER_SPRITE_SIZE !== 96
  || gameData.HUMAN_CHARACTER_SPRITE_COLUMNS !== 9
  || gameData.HUMAN_CHARACTER_SPRITE_EXPECTED_WIDTH !== 864
  || gameData.HUMAN_CHARACTER_SPRITE_EXPECTED_HEIGHT !== 768
  || JSON.stringify(gameData.HUMAN_CHARACTER_WALK_COLUMNS) !== JSON.stringify([1, 2, 3, 4])
  || JSON.stringify(gameData.HUMAN_CHARACTER_ATTACK_COLUMNS) !== JSON.stringify([5, 6, 7, 8])
) throw new Error('Runtime animation constants do not match adventurer-fresh-v5.');

for (const [raceId, race] of Object.entries(gameData.RACES)) {
  const assetRoot = join(root, 'public', 'assets', 'characters', `${raceId}_fresh`);
  const manifestPath = join(assetRoot, 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error(`Missing ${raceId} fresh manifest.`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.model !== 'adventurer-fresh-v5' || manifest.version !== 5 || manifest.race !== raceId) {
    throw new Error(`${raceId} manifest is not adventurer-fresh-v5.`);
  }
  if (JSON.stringify(manifest.allowedClasses) !== JSON.stringify(race.allowedClasses)) {
    throw new Error(`${raceId} manifest class restrictions do not match RACES.`);
  }
  if (!gameData.FRESH_RACE_CUSTOMIZATION[raceId]
    || !gameData.FRESH_RACE_FACE_STYLE_CHOICES[raceId]
    || !gameData.FRESH_RACE_HAIR_STYLE_CHOICES[raceId]
    || !gameData.FRESH_RACE_HERITAGE_STYLE_CHOICES[raceId]
    || !gameData.FRESH_RACE_DEFAULT_HERITAGE[raceId]) {
    throw new Error(`${raceId} is missing race-specific customization configuration.`);
  }
  const heritageChoices = gameData.FRESH_RACE_HERITAGE_STYLE_CHOICES[raceId];
  if (heritageChoices.length !== 4 || heritageChoices[0].id !== 'none') {
    throw new Error(`${raceId} must provide None plus three race-specific heritage styles.`);
  }
  if (Object.keys(manifest.heritage ?? {}).length !== 3) {
    throw new Error(`${raceId} manifest must provide three race-specific heritage atlases.`);
  }

  for (const classId of race.allowedClasses) {
    for (const body of bodies) {
      for (let option = 0; option < 4; option += 1) {
        const appearance = worldEntities.getMergedDefaultAppearance(raceId, classId, {
          gender: body,
          faceVariant: faces[body][option],
          hairStyle: hair[body][option],
          heritageStyle: heritageChoices[option].id,
          beard: body === 'male' && option === 3 ? 'full' : 'none',
          capeStyle: option === 2 ? 'long' : 'none',
          outfitVariant: outfits[option],
          weaponVariant: weapons[option],
          skin: gameData.FRESH_RACE_CUSTOMIZATION[raceId].skin.at(-1),
          eyes: gameData.FRESH_RACE_CUSTOMIZATION[raceId].eyes[2],
          hair: gameData.FRESH_RACE_CUSTOMIZATION[raceId].hair.at(-1),
          robe: '#b42318',
          trim: '#facc15',
          weaponColor: '#60a5fa',
        });
        const selection = mapAssets.getCharacterLayerSelection(classId, raceId, appearance);
        const faceStyle = faces[body][option].replace(`${body}-`, '');
        const hairStyle = hair[body][option].replace(`${body}-`, '');
        const expected = {
          base: `${raceId}-fresh-body-${body}`,
          face: `${raceId}-fresh-face-${body}-${faceStyle}`,
          hair: `${raceId}-fresh-hair-${body}-${hairStyle}`,
          outfit: `${raceId}-fresh-${classId}-${body}-${outfits[option]}`,
          weapon: `${raceId}-fresh-${classId}-${body}-${weapons[option]}`,
          ...(heritageChoices[option].id === 'none'
            ? {}
            : { heritage: `${raceId}-fresh-heritage-${heritageChoices[option].id}` }),
        };
        for (const [layer, id] of Object.entries(expected)) {
          if (selection[layer] !== id) {
            throw new Error(`${raceId} ${classId} ${body} ${layer} selected ${selection[layer]}, expected ${id}.`);
          }
        }
        if (heritageChoices[option].id === 'none' && selection.heritage !== null) {
          throw new Error(`${raceId} None heritage unexpectedly selected ${selection.heritage}.`);
        }
        for (const [layer, id] of Object.entries(selection)) {
          if (!id) continue;
          const path = mapAssets.getCharacterLayerAssetPath(layer, id);
          if (!path?.startsWith(`${raceId}_fresh/`)) {
            throw new Error(`${id} resolves outside ${raceId}_fresh: ${path}`);
          }
          if (!existsSync(join(root, 'public', 'assets', 'characters', ...path.split('/')))) {
            throw new Error(`${id} resolves to missing file: ${path}`);
          }
        }
        if (selection.offhand !== null) {
          throw new Error(`${raceId} ${classId} ${body} unexpectedly equips an offhand during creation.`);
        }
        if (appearance.spriteModel !== 'adventurer-fresh-v5'
          || appearance.characterSpriteModel !== 'adventurer-fresh-v5') {
          throw new Error(`${raceId} save normalization did not select the fresh model.`);
        }
      }
    }
  }

  for (const classId of allClasses.filter((candidate) => !race.allowedClasses.includes(candidate))) {
    const selection = mapAssets.getCharacterLayerSelection(classId, raceId, { gender: 'male' });
    if (selection.outfit?.startsWith(`${raceId}-fresh-`)) {
      throw new Error(`${raceId} incorrectly generated a forbidden ${classId} fresh route.`);
    }
  }
}

for (const [raceId, race] of Object.entries(gameData.RACES)) {
  for (const [classId, damageSpec, tankSpec] of [
    ['warrior', 'berserker', 'ironward'],
    ['paladin', 'verdict', 'aegis'],
  ]) {
    if (!race.allowedClasses.includes(classId)) continue;
    for (const body of bodies) {
      const common = { race: raceId, gender: body, weaponVariant: 'runed' };
      const creation = mapAssets.getCharacterLayerSelection(classId, raceId, common);
      const damage = mapAssets.getCharacterLayerSelection(classId, raceId, { ...common, combatSpec: damageSpec });
      const tank = mapAssets.getCharacterLayerSelection(classId, raceId, { ...common, combatSpec: tankSpec });
      if (creation.offhand !== null || damage.offhand !== null) {
        throw new Error(`${raceId} ${classId} ${body} must use one sword in creation and Damage specs.`);
      }
      if (creation.weapon !== damage.weapon || damage.weapon !== tank.weapon) {
        throw new Error(`${raceId} ${classId} ${body} changed its sword while switching role.`);
      }
      const expectedOffhand = `${raceId}-fresh-${classId}-${body}-runed`;
      if (tank.offhand !== expectedOffhand) {
        throw new Error(`${raceId} ${classId} ${body} tank selected ${tank.offhand}, expected ${expectedOffhand}.`);
      }
      const offhandPath = mapAssets.getCharacterLayerAssetPath('offhand', tank.offhand);
      if (offhandPath !== `${raceId}_fresh/classes/${classId}/${body}/offhands/runed.png`) {
        throw new Error(`${raceId} ${classId} ${body} tank offhand resolves incorrectly: ${offhandPath}`);
      }
    }
  }
}

const migrated = worldEntities.getMergedDefaultAppearance('elf', 'mage', {
  gender: 'female',
  faceVariant: 'female-soft',
  hairStyle: 'female-bob',
  spriteModel: 'legacy-model',
});
if (
  migrated.faceVariant !== 'female-natural'
  || migrated.hairStyle !== 'female-long'
  || migrated.heritageStyle !== gameData.FRESH_RACE_DEFAULT_HERITAGE.elf
  || migrated.spriteModel !== 'adventurer-fresh-v5'
  || migrated.characterSpriteModel !== 'adventurer-fresh-v5'
) throw new Error('Old non-human saves are not migrated onto fresh assets.');

console.log('Validated adventurer-fresh-v5 runtime: all five races use race-specific fresh layers and heritage customization for allowed classes only, every layer resolves inside its race root, creation/Damage uses one sword, Tank adds the matching shield, and old saves migrate forward.');
