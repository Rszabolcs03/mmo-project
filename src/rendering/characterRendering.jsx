import React from 'react';

import { clamp } from '../game/math';

import {
  RACES,
  CLASSES,
  CHARACTER_SPRITE_SIZE,
  CHARACTER_SPRITE_DRAW_SIZE,
  CHARACTER_SPRITE_EXPECTED_WIDTH,
  CHARACTER_SPRITE_EXPECTED_HEIGHT,
  CHARACTER_SPRITE_EIGHT_DIRECTION_HEIGHT,
  CHARACTER_SPRITE_VERSION,
  HUMAN_CHARACTER_SPRITE_SIZE,
  HUMAN_CHARACTER_WALK_COLUMNS,
  HUMAN_CHARACTER_ATTACK_COLUMNS,
  CHARACTER_SPRITE_ROWS,
  CHARACTER_SPRITE_ROWS_8,
  CHARACTER_SPRITES,
  CHARACTER_SPRITE_LOADS,
  CHARACTER_TINTED_SPRITES,
  CHARACTER_SPRITE_SOURCE_PALETTES,
  CHARACTER_LAYER_ORDER,
} from '../game/gameData';

import {
  hexToRgb,
  shiftHexColor,
  colorDistanceSquared,
  getCharacterSpriteCandidates,
  loadCharacterSprite,
  loadCharacterLayersForAppearance,
  getCharacterLayerSelection,
  getCharacterLayerImage,
} from '../game/mapAssets';
import { getMergedDefaultAppearance } from '../game/worldEntities';
import {
  getMageStaffTipWorldPoint,
  MAGE_WAND_RELEASE_DELAY_MS,
} from '../game/mageStaffGeometry';
import {
  pixelRect,
  pixelLine,
  drawPixelDiamond,
  drawPixelShield,
} from './primitives';

function isRangedClass(classId) {
  return ['hunter', 'mage', 'priest'].includes(classId);
}

function hasHunterPet(character) {
  return character?.classId === 'hunter';
}

function drawCharacterAttackOverlay(context, player, characterOrClass) {
  const attack = player?.attack;
  const now = performance.now();
  if (!attack || !Number.isFinite(attack.startedAt) || now > attack.until) return;
  const selectedClass = typeof characterOrClass === 'string' ? characterOrClass : characterOrClass?.classId;
  const priestSpec = selectedClass === 'priest' && typeof characterOrClass === 'object'
    ? characterOrClass?.talents?.spec
    : null;

  const duration = Math.max(1, attack.until - attack.startedAt);
  const progress = clamp((now - attack.startedAt) / duration, 0, 1);
  const facing = Number.isFinite(attack.facing) ? attack.facing : player.facing ?? 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const sideX = Math.cos(facing + Math.PI / 2);
  const sideY = Math.sin(facing + Math.PI / 2);
  const ranged = isRangedClass(selectedClass) || attack.ranged || attack.autoAttack && selectedClass === 'hunter';
  const classSprite = CLASS_SPRITE_DETAILS[selectedClass] ?? CLASS_SPRITE_DETAILS.warrior;
  const appearance = typeof characterOrClass === 'object' ? characterOrClass?.appearance ?? {} : {};
  const classColors = CLASSES[selectedClass]?.colors ?? {};
  const weaponKind = attack.weaponType ?? classSprite.weapon;
  const weaponColor = appearance.weaponColor ?? classColors.weapon ?? '#f8fafc';
  const weaponShade = shiftHexColor(weaponColor, 0.68);
  const glowColor = classSprite.glow ?? weaponColor;
  const color = selectedClass === 'priest' && priestSpec === 'void'
    ? '#a78bfa'
    : selectedClass === 'priest'
      ? '#fef08a'
    : selectedClass === 'mage'
      ? '#7dd3fc'
      : selectedClass === 'hunter'
        ? '#fbbf24'
        : selectedClass === 'rogue'
          ? '#e5e7eb'
          : '#f8fafc';

  context.save();
  context.translate(player.x, player.y - 22);
  context.globalAlpha = 0.92;
  context.imageSmoothingEnabled = false;

  const swing = Math.sin(progress * Math.PI);
  const handX = fx * 7 + sideX * 8;
  const handY = fy * 7 + sideY * 8;
  const offHandX = fx * 4 - sideX * 9;
  const offHandY = fy * 4 - sideY * 9;

  if (weaponKind === 'bow') {
    const bowCenterX = fx * 9 + sideX * 12;
    const bowCenterY = fy * 9 + sideY * 12;
    const pull = progress < 0.48 ? progress / 0.48 : Math.max(0, 1 - (progress - 0.48) / 0.18);
    const upper = { x: bowCenterX + sideX * 18 - fx * 3, y: bowCenterY + sideY * 18 - fy * 3 };
    const lower = { x: bowCenterX - sideX * 18 - fx * 3, y: bowCenterY - sideY * 18 - fy * 3 };
    const grip = { x: bowCenterX + fx * 2, y: bowCenterY + fy * 2 };
    const string = { x: bowCenterX - fx * (10 + pull * 14), y: bowCenterY - fy * (10 + pull * 14) };
    pixelLine(context, upper.x, upper.y, grip.x, grip.y, 4, weaponShade, 8);
    pixelLine(context, lower.x, lower.y, grip.x, grip.y, 4, weaponShade, 8);
    pixelLine(context, upper.x, upper.y, string.x, string.y, 2, '#fef3c7', 8);
    pixelLine(context, lower.x, lower.y, string.x, string.y, 2, '#fef3c7', 8);
    pixelLine(context, string.x, string.y, grip.x + fx * 34, grip.y + fy * 34, 2, '#f8fafc', 10);
    if (progress > 0.5) {
      const arrowHead = 42 + (progress - 0.5) * 86;
      pixelLine(context, grip.x + fx * 18, grip.y + fy * 18, grip.x + fx * arrowHead, grip.y + fy * arrowHead, 2, '#fef3c7', 10);
      pixelRect(context, grip.x + fx * arrowHead - 3, grip.y + fy * arrowHead - 3, 6, 6, glowColor);
    }
  } else if (weaponKind === 'staff') {
    const reach = 26 + swing * 14;
    pixelLine(context, handX - fx * 14 - sideX * 5, handY - fy * 14 - sideY * 5, handX + fx * reach + sideX * 5, handY + fy * reach + sideY * 5, 5, weaponShade, 12);
    pixelLine(context, handX - fx * 10 - sideX * 3, handY - fy * 10 - sideY * 3, handX + fx * reach + sideX * 3, handY + fy * reach + sideY * 3, 3, weaponColor, 12);
    drawPixelDiamond(context, handX + fx * (reach + 7), handY + fy * (reach + 7), 12 + swing * 5, color);
  } else if (weaponKind === 'daggers') {
    const stab = 18 + swing * 24;
    pixelLine(context, handX, handY, handX + fx * stab + sideX * 5, handY + fy * stab + sideY * 5, 5, weaponShade, 7);
    pixelLine(context, handX, handY, handX + fx * (stab + 7) + sideX * 7, handY + fy * (stab + 7) + sideY * 7, 3, weaponColor, 8);
    pixelLine(context, offHandX, offHandY, offHandX + fx * (14 + (1 - swing) * 18) - sideX * 8, offHandY + fy * (14 + (1 - swing) * 18) - sideY * 8, 4, '#c4b5fd', 7);
  } else if (weaponKind === 'hammer-shield') {
    const reach = 26 + swing * 22;
    pixelLine(context, handX - fx * 9, handY - fy * 9, handX + fx * reach + sideX * 7, handY + fy * reach + sideY * 7, 6, weaponShade, 10);
    pixelRect(context, handX + fx * reach + sideX * 7 - 8, handY + fy * reach + sideY * 7 - 8, 16, 13, weaponColor);
    drawPixelShield(context, offHandX - sideX * 8, offHandY - sideY * 8, '#facc15');
  } else {
    const reach = 34 + swing * 26;
    const arc = (progress - 0.5) * 1.7;
    const swingFx = Math.cos(facing + arc);
    const swingFy = Math.sin(facing + arc);
    pixelLine(context, handX - swingFx * 10, handY - swingFy * 10, handX + swingFx * reach, handY + swingFy * reach, 7, weaponShade, 12);
    pixelLine(context, handX - swingFx * 7, handY - swingFy * 7, handX + swingFx * (reach + 8), handY + swingFy * (reach + 8), 4, weaponColor, 12);
  }

  if (ranged && weaponKind !== 'bow' && weaponKind !== 'staff') {
    const muzzle = 36 + progress * 38;
    pixelRect(context, fx * muzzle - 3, fy * muzzle - 3, 6, 6, color);
  }

  context.restore();
}

const CHARACTER_SPRITE_FRAMES = [
  { leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, bodyBob: 0 },
  { leftLeg: 3, rightLeg: -2, leftArm: -2, rightArm: 2, bodyBob: -1 },
  { leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, bodyBob: 0 },
  { leftLeg: -2, rightLeg: 3, leftArm: 2, rightArm: -2, bodyBob: -1 },
];

const HUMAN_MODULAR_ANIMATION = Object.freeze({
  walk: HUMAN_CHARACTER_WALK_COLUMNS,
  attack: HUMAN_CHARACTER_ATTACK_COLUMNS,
});

const CLASS_SPRITE_DETAILS = {
  mage: { collar: '#67e8f9', dark: '#312e81', weapon: 'staff', glow: '#67e8f9' },
  hunter: { collar: '#bef264', dark: '#7c4a22', weapon: 'bow', glow: '#fde68a' },
  paladin: { collar: '#fef08a', dark: '#facc15', weapon: 'hammer-shield', glow: '#fef08a' },
  warrior: { collar: '#94a3b8', dark: '#475569', weapon: 'greatsword', glow: '#f8fafc' },
  priest: { collar: '#e0e7ff', dark: '#f8fafc', weapon: 'staff', glow: '#fef08a' },
  rogue: { collar: '#111827', dark: '#1f2937', weapon: 'daggers', glow: '#c084fc' },
};

function getCharacterAnimationFrame(player) {
  const moving = Math.abs(player?.vx ?? 0) + Math.abs(player?.vy ?? 0) > 0.05;
  if (!moving) return CHARACTER_SPRITE_FRAMES[0];
  const frameIndex = Math.floor(performance.now() / 120) % CHARACTER_SPRITE_FRAMES.length;
  return CHARACTER_SPRITE_FRAMES[frameIndex];
}

function getCharacterSpriteDirection(player) {
  const now = performance.now();
  const attack = player?.attack;
  const attackFacing = attack
    && Number.isFinite(attack.facing)
    && Number.isFinite(attack.until)
    && now <= attack.until
      ? attack.facing
      : null;
  const facing = attackFacing ?? (Number.isFinite(player?.facing) ? player.facing : 0);
  const sector = Math.round(facing / (Math.PI / 4));
  const normalizedSector = ((sector % 8) + 8) % 8;
  return [
    'right',
    'down-right',
    'down',
    'down-left',
    'left',
    'up-left',
    'up',
    'up-right',
  ][normalizedSector];
}

function getCharacterSpriteRow(image, direction) {
  const imageHeight = image?.naturalHeight || image?.height || CHARACTER_SPRITE_EXPECTED_HEIGHT;
  if (imageHeight >= CHARACTER_SPRITE_EIGHT_DIRECTION_HEIGHT) {
    return CHARACTER_SPRITE_ROWS_8[direction] ?? CHARACTER_SPRITE_ROWS_8.down;
  }

  if (direction === 'up-left' || direction === 'up-right') return CHARACTER_SPRITE_ROWS.up;
  if (direction === 'down-left' || direction === 'down-right') return CHARACTER_SPRITE_ROWS.down;
  return CHARACTER_SPRITE_ROWS[direction] ?? CHARACTER_SPRITE_ROWS.down;
}

function getCharacterSpriteColumn(player, animationProfile = null) {
  const normalizedProfile = Array.isArray(animationProfile)
    ? { walk: animationProfile }
    : animationProfile;
  const attack = player?.attack;
  const now = performance.now();
  if (attack && Number.isFinite(attack.startedAt) && Number.isFinite(attack.until) && now <= attack.until) {
    const duration = Math.max(1, attack.until - attack.startedAt);
    const progress = clamp((now - attack.startedAt) / duration, 0, 1);
    if (normalizedProfile?.attack?.length) {
      const attackIndex = Math.min(
        normalizedProfile.attack.length - 1,
        Math.floor(progress * normalizedProfile.attack.length),
      );
      return normalizedProfile.attack[attackIndex];
    }
    if (attack.castRecovery) {
      if (progress < 0.28) return 4;
      if (progress < 0.64) return 5;
      return 0;
    }
    return 4 + (progress > 0.5 ? 1 : 0);
  }
  const moving = Math.abs(player?.vx ?? 0) + Math.abs(player?.vy ?? 0) > 0.05;
  if (!moving) return 0;
  const animationTime = Number.isFinite(player?.animationTime) ? player.animationTime : performance.now();
  if (normalizedProfile?.walk?.length) {
    return normalizedProfile.walk[
      Math.floor(animationTime / 120) % normalizedProfile.walk.length
    ];
  }
  return (Math.floor(animationTime / 120) % 3) + 1;
}

function drawMageCastAccent(context, player) {
  const attack = player?.attack;
  const now = performance.now();
  if (
    !attack?.castRecovery
    || !attack.autoAttack
    || !Number.isFinite(attack.startedAt)
    || !Number.isFinite(attack.until)
    || now > attack.until
  ) return;

  const duration = Math.max(1, attack.until - attack.startedAt);
  const progress = clamp((now - attack.startedAt) / duration, 0, 1);
  const facing = Number.isFinite(attack.facing) ? attack.facing : player.facing ?? 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const sideX = -fy;
  const sideY = fx;
  const elapsed = now - attack.startedAt;
  const windup = clamp(elapsed / MAGE_WAND_RELEASE_DELAY_MS, 0, 1);
  const recovery = clamp((progress - 0.64) / 0.36, 0, 1);
  const windupTip = getMageStaffTipWorldPoint(player, facing, 'windup');
  const releaseTip = getMageStaffTipWorldPoint(player, facing, 'release');
  const recoveryTip = getMageStaffTipWorldPoint(player, facing, 'recovery');
  const activeTip = elapsed < MAGE_WAND_RELEASE_DELAY_MS
    ? windupTip
    : progress < 2 / 3
      ? releaseTip
      : recoveryTip;
  const x = Math.round(activeTip.x);
  const y = Math.round(activeTip.y);
  const alpha = elapsed < MAGE_WAND_RELEASE_DELAY_MS
    ? 0.38 + windup * 0.5
    : Math.max(0, 0.9 - recovery * 0.9);
  const coreSize = elapsed < MAGE_WAND_RELEASE_DELAY_MS ? 2 + Math.round(windup * 2) : 5;

  context.save();
  context.globalAlpha = alpha;
  context.imageSmoothingEnabled = false;
  pixelRect(context, x - Math.floor(coreSize / 2), y - Math.floor(coreSize / 2), coreSize, coreSize, '#ecfeff');
  pixelRect(context, x - 1, y - 7, 2, 4, '#67e8f9');
  pixelRect(context, x - 1, y + 4, 2, 4, '#67e8f9');
  pixelRect(context, x - 7, y - 1, 4, 2, '#38bdf8');
  pixelRect(context, x + 4, y - 1, 4, 2, '#38bdf8');
  if (elapsed >= MAGE_WAND_RELEASE_DELAY_MS && progress < 0.72) {
    const releaseProgress = clamp((elapsed - MAGE_WAND_RELEASE_DELAY_MS) / Math.max(1, duration * 0.36), 0, 1);
    const trailX = Math.round(x - fx * (7 + releaseProgress * 4));
    const trailY = Math.round(y - fy * (7 + releaseProgress * 4));
    pixelRect(context, trailX - 1, trailY - 1, 3, 3, '#0e7490');
    pixelRect(context, Math.round(x + sideX * 6) - 1, Math.round(y + sideY * 6) - 1, 2, 2, '#a5f3fc');
    pixelRect(context, Math.round(x - sideX * 6) - 1, Math.round(y - sideY * 6) - 1, 2, 2, '#a5f3fc');
  }
  context.restore();
}

function drawCharacterSpriteFrame(
  context,
  image,
  player,
  selectedRace,
  row,
  column,
  sourceFrameSize = CHARACTER_SPRITE_SIZE,
) {
  const raceConfig = RACES[selectedRace];
  if (!image || !raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return false;

  const size = CHARACTER_SPRITE_DRAW_SIZE * raceConfig.scale * (selectedRace === 'dwarf' ? 0.96 : selectedRace === 'orc' ? 1.06 : 1);
  context.drawImage(
    image,
    column * sourceFrameSize,
    row * sourceFrameSize,
    sourceFrameSize,
    sourceFrameSize,
    Math.round(player.x - size / 2),
    Math.round(player.y - size + 18),
    Math.round(size),
    Math.round(size),
  );
  return true;
}

function drawCharacterLayeredSprite(context, player, selectedClass, selectedRace, appearance = {}) {
  const raceConfig = RACES[selectedRace];
  if (!raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return false;

  const selection = getCharacterLayerSelection(selectedClass, selectedRace, appearance);
  const freshPrefix = `${selectedRace}-fresh-${selectedClass}-`;
  const expectsHumanEightDirectionSheet = selection.outfit?.startsWith(freshPrefix);
  const usesCurrentHuman = expectsHumanEightDirectionSheet;
  const usesRegisteredHuman = usesCurrentHuman
    && CHARACTER_SPRITE_VERSION === 'adventurer-fresh-v6';
  const usesHumanComposite = usesCurrentHuman;
  const usesCompleteMageBody = false;
  const baseLayer = getCharacterLayerImage('base', selection.base);
  const outfitLayer = getCharacterLayerImage('outfit', selection.outfit);
  if (
    (!usesCompleteMageBody && !usesHumanComposite && !baseLayer)
    || !outfitLayer
  ) return false;

  const direction = getCharacterSpriteDirection(player);
  const usesHumanEightDirectionSheet = expectsHumanEightDirectionSheet
    && (outfitLayer.naturalHeight || outfitLayer.height || 0) >= CHARACTER_SPRITE_EIGHT_DIRECTION_HEIGHT;
  if (expectsHumanEightDirectionSheet && !usesHumanEightDirectionSheet) return false;
  const column = getCharacterSpriteColumn(
    player,
    usesCurrentHuman && usesHumanEightDirectionSheet ? HUMAN_MODULAR_ANIMATION : null,
  );
  const backFacing = direction === 'up' || direction === 'up-left' || direction === 'up-right';
  const layerOrder = usesRegisteredHuman
    ? backFacing
      ? ['weapon', 'offhand', 'base', 'outfit', 'cape', 'face', 'heritage', 'beard', 'hair', 'headwear']
      : selectedClass === 'hunter'
        ? ['cape', 'base', 'outfit', 'weapon', 'face', 'heritage', 'beard', 'hair', 'headwear']
        : ['cape', 'base', 'outfit', 'face', 'heritage', 'beard', 'hair', 'headwear', 'offhand', 'weapon']
    : usesCurrentHuman
    ? backFacing
      ? ['weapon', 'base', 'outfit', 'cape', 'hair', 'face', 'heritage', 'beard', 'headwear']
      : ['cape', 'base', 'outfit', 'hair', 'face', 'heritage', 'beard', 'headwear', 'weapon']
    : usesHumanComposite
    ? backFacing
      ? ['cape', 'weapon', 'hair', 'outfit', 'face', 'heritage', 'beard']
      : ['cape', 'hair', 'outfit', 'face', 'heritage', 'beard', 'weapon']
    : usesCompleteMageBody
    ? ['outfit', 'weapon']
    : backFacing
      ? [...CHARACTER_LAYER_ORDER.filter((layer) => layer !== 'cape' && layer !== 'weapon'), 'cape', 'weapon']
      : CHARACTER_LAYER_ORDER;

  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;
  for (const layer of layerOrder) {
    const layerImage = getCharacterLayerImage(layer, selection[layer]);
    if (!layerImage) continue;
    const tintedLayer = getTintedCharacterLayerImage(
      layerImage,
      layer,
      selection[layer],
      selectedClass,
      selectedRace,
      appearance,
    );
    const row = getCharacterSpriteRow(tintedLayer, direction);
    drawCharacterSpriteFrame(
      context,
      tintedLayer,
      player,
      selectedRace,
      row,
      column,
      usesCurrentHuman ? HUMAN_CHARACTER_SPRITE_SIZE : CHARACTER_SPRITE_SIZE,
    );
  }
  context.imageSmoothingEnabled = previousSmoothing;
  return true;
}

const CHARACTER_RACE_LAYER_PALETTES = {
  human: { skin: '#f2c7a4', skinShade: '#d99a72' },
  elf: { skin: '#f0d6ad', skinShade: '#d7a477' },
  dwarf: { skin: '#d6a06f', skinShade: '#9a6543' },
  orc: { skin: '#74a85a', skinShade: '#4f7f3f' },
  undead: { skin: '#cbd5c0', skinShade: '#8fa08c' },
};

const CHARACTER_HAIR_LAYER_PALETTES = {
  short: { main: '#8b5e34', shade: '#5f3f24' },
  long: { main: '#d8b4fe', shade: '#8b5cf6' },
  hooded: { main: '#1f2937', shade: '#0b1120' },
  full: { main: '#4b2c15', shade: '#241107' },
  cropped: { main: '#8b5e34', shade: '#5f4329' },
  windswept: { main: '#8b5e34', shade: '#5f4329' },
  tousled: { main: '#8b5e34', shade: '#5f4329' },
  tied: { main: '#8b5e34', shade: '#5f4329' },
  'side-bangs': { main: '#8b5e34', shade: '#5f4329' },
  bun: { main: '#8b5e34', shade: '#5f4329' },
  ponytail: { main: '#8b5e34', shade: '#5f4329' },
};

const HUMAN_V9_OUTFIT_PALETTES = {
  mage: {
    primary: ['#172554', '#312e81', '#1d4ed8', '#4263eb'],
    trim: ['#0e7490', '#67e8f9', '#8be9fd'],
  },
  warrior: {
    primary: ['#3f1210', '#7f1d1d', '#b92d26', '#e05044'],
    trim: ['#475569', '#94a3b8', '#cbd5e1'],
  },
  hunter: {
    primary: ['#152b18', '#365c2d', '#4c7b3b', '#6f994e'],
    trim: ['#4e301b', '#915b2e', '#d29947'],
  },
  paladin: {
    primary: ['#475569', '#cbd5e1', '#f8fafc', '#ffffff'],
    trim: ['#a16207', '#facc15', '#fef08a'],
  },
  priest: {
    primary: ['#64748b', '#e2e8f0', '#f8fafc', '#ffffff'],
    trim: ['#a16207', '#facc15', '#fef08a'],
  },
  rogue: {
    primary: ['#090f1a', '#1f2937', '#37304a', '#5b487e'],
    trim: ['#4a2160', '#7e48a6', '#a78bfa'],
  },
};

function getCharacterLayerReplacements(layer, layerId, selectedClass, selectedRace, appearance) {
  const replacements = [];
  const add = (source, target, threshold = 5) => {
    const sourceRgb = hexToRgb(source);
    const targetRgb = hexToRgb(target);
    if (sourceRgb && targetRgb) replacements.push({ source: sourceRgb, target: targetRgb, threshold });
  };

  if (layer === 'base') {
    const palette = CHARACTER_RACE_LAYER_PALETTES[selectedRace] ?? CHARACTER_RACE_LAYER_PALETTES.human;
    const skin = appearance.skin ?? palette.skin;
    add(palette.skinShade, shiftHexColor(skin, 0.72));
    add(palette.skin, skin);
    if (/^[a-z]+-fresh-body-/.test(layerId ?? '')) {
      add('#c27b58', shiftHexColor(skin, 0.58));
      add('#e3a073', shiftHexColor(skin, 0.78));
      add('#f3c59f', skin);
      add('#ffe0bd', shiftHexColor(skin, 1.1));
    }
  }

  if (layer === 'hair' || layer === 'beard') {
    const usesGeneratedHumanHair = layer === 'hair'
      && /^[a-z]+-fresh-hair-/.test(layerId ?? '');
    const usesGeneratedHumanBeard = layer === 'beard'
      && /^[a-z]+-fresh-beard-/.test(layerId ?? '');
    const cosmeticLayerId = layerId
      ?.replace(/^[a-z]+-fresh-hair-(?:male|female)-/, '')
      .replace(/^[a-z]+-fresh-beard-/, '')
      .replace(/^human-(?:female-)?/, '');
    const palette = CHARACTER_HAIR_LAYER_PALETTES[cosmeticLayerId]
      ?? (layer === 'beard' ? { main: '#7c4a22', shade: '#4b2c15' } : CHARACTER_HAIR_LAYER_PALETTES.short);
    const hair = appearance.hair ?? palette.main;
    if (usesGeneratedHumanHair || usesGeneratedHumanBeard) {
      add('#4b2c15', shiftHexColor(hair, 0.5));
      add('#5f4329', shiftHexColor(hair, 0.7));
      add('#8b5e34', hair);
      add('#a97846', shiftHexColor(hair, 1.14));
      add('#5b2b20', shiftHexColor(hair, 0.5));
      add('#874a2f', shiftHexColor(hair, 0.72));
      add('#c47a45', hair);
      add('#e3a36f', shiftHexColor(hair, 1.14));
      add('#68401f', shiftHexColor(hair, 0.68));
      add('#b77a45', shiftHexColor(hair, 1.14));
    }
    add(palette.shade, shiftHexColor(hair, 0.58));
    add(palette.main, hair);
  }

  if (layer === 'face') {
    if (/^[a-z]+-fresh-face-/.test(layerId ?? '')) {
      // v20 authors irises with a dedicated palette key. Facial outlines,
      // brows, mouths and scars intentionally stay #090d14 so changing eye
      // color cannot turn those features into vertical color streaks.
      add('#1e3a5f', appearance.eyes ?? '#3b2416');
      const racePalette = CHARACTER_RACE_LAYER_PALETTES[selectedRace]
        ?? CHARACTER_RACE_LAYER_PALETTES.human;
      const skin = appearance.skin ?? racePalette.skin;
      const hair = appearance.hair ?? CHARACTER_HAIR_LAYER_PALETTES.short.main;
      add('#c27b58', shiftHexColor(skin, 0.58));
      add('#e3a073', shiftHexColor(skin, 0.78));
      add('#f3c59f', skin);
      add('#d99a72', shiftHexColor(skin, 0.72));
      add('#f2c7a4', skin);
      add('#ffe0bd', shiftHexColor(skin, 1.1));
      add('#5b2b20', shiftHexColor(hair, 0.5));
      add('#874a2f', shiftHexColor(hair, 0.7));
      add('#c47a45', hair);
      add('#e3a36f', shiftHexColor(hair, 1.14));
    } else {
      add('#090d14', appearance.eyes ?? '#3b2416');
    }
  }

  if (layer === 'outfit' || layer === 'headwear') {
    const sourcePalette = CHARACTER_SPRITE_SOURCE_PALETTES[selectedClass];
    const usesHumanComposite = /^[a-z]+-fresh-/.test(layerId ?? '');
    let robe = layer === 'headwear'
      ? appearance.hat ?? appearance.robe ?? sourcePalette?.robe
      : appearance.robe ?? sourcePalette?.robe;
    let trim = appearance.trim ?? sourcePalette?.trim;
    if (/^[a-z]+-fresh-/.test(layerId ?? '')) {
      const v9Palette = HUMAN_V9_OUTFIT_PALETTES[selectedClass];
      if (v9Palette) {
        add(v9Palette.primary[0], shiftHexColor(robe, 0.46));
        add(v9Palette.primary[1], shiftHexColor(robe, 0.68));
        add(v9Palette.primary[2], robe);
        add(v9Palette.primary[3], shiftHexColor(robe, 1.14));
        add(v9Palette.trim[0], shiftHexColor(trim, 0.62));
        add(v9Palette.trim[1], trim);
        add(v9Palette.trim[2], shiftHexColor(trim, 1.1));
      }
    }
    // The human mage body is one authored, complete sprite sheet. Historical
    // appearance values may still contain robe variants, but applying those
    // identifiers as whole-sheet brightness filters destroys the authored
    // face, hair and robe shading. Only layered outfits use this shortcut.
    if (selectedClass !== 'mage' && !layerId?.startsWith('human-') && layerId?.endsWith('-dark')) {
      robe = shiftHexColor(robe, 0.58);
      trim = shiftHexColor(trim, 0.76);
    } else if (selectedClass !== 'mage' && !layerId?.startsWith('human-') && layerId?.endsWith('-veteran')) {
      robe = shiftHexColor(robe, 1.12);
    }

    if (selectedClass === 'mage') {
      const racePalette = CHARACTER_RACE_LAYER_PALETTES[selectedRace] ?? CHARACTER_RACE_LAYER_PALETTES.human;
      const skin = appearance.skin ?? racePalette.skin;
      const hair = appearance.hair ?? CHARACTER_HAIR_LAYER_PALETTES.short.main;
      add('#d99a72', shiftHexColor(skin, 0.72));
      add('#f2c7a4', skin);
      add('#ffe0bd', shiftHexColor(skin, 1.1));
      if (usesHumanComposite) {
        add('#5f4329', shiftHexColor(hair, 0.7));
        add('#8b5e34', hair);
        add('#a97846', shiftHexColor(hair, 1.14));
      }
      add('#172554', shiftHexColor(robe, 0.46));
      add('#312e81', shiftHexColor(robe, 0.68));
      add('#1d4ed8', robe);
      add('#4263eb', shiftHexColor(robe, 1.14));
      add('#0e7490', shiftHexColor(trim, 0.62));
      add('#67e8f9', trim);
      add('#8be9fd', shiftHexColor(trim, 1.08));
    } else if (sourcePalette) {
      const racePalette = CHARACTER_RACE_LAYER_PALETTES[selectedRace] ?? CHARACTER_RACE_LAYER_PALETTES.human;
      const skin = appearance.skin ?? racePalette.skin;
      const hair = appearance.hair ?? sourcePalette.hair ?? CHARACTER_HAIR_LAYER_PALETTES.short.main;
      add('#d99a72', shiftHexColor(skin, 0.72));
      add('#f2c7a4', skin);
      add('#ffe0bd', shiftHexColor(skin, 1.1));
      if (usesHumanComposite) {
        add('#5f4329', shiftHexColor(hair, 0.7));
        add('#8b5e34', hair);
        add('#a97846', shiftHexColor(hair, 1.14));
      }
      add(sourcePalette.robeDeep, shiftHexColor(robe, 0.48));
      add(sourcePalette.robeMid, shiftHexColor(robe, 0.72));
      add(sourcePalette.robe, robe);
      add(sourcePalette.robeLight, shiftHexColor(robe, 1.14));
      add(sourcePalette.trimDark, shiftHexColor(trim, 0.66));
      add(sourcePalette.trim, trim);
      add(sourcePalette.trimLight, shiftHexColor(trim, 1.1));
    }
  }

  if (layer === 'cape') {
    const cape = appearance.robe ?? '#7f1d1d';
    add('#3f1210', shiftHexColor(cape, 0.48));
    add('#7f1d1d', cape);
    add('#b92d26', shiftHexColor(cape, 1.14));
    add('#d97706', appearance.trim ?? '#d97706');
    add('#facc15', appearance.trim ?? '#facc15');
  }

  if ((layer === 'weapon' || layer === 'offhand') && /^[a-z]+-fresh-/.test(layerId ?? '')) {
    const finish = appearance.weaponColor ?? appearance.trim ?? '#94a3b8';
    const accent = appearance.trim ?? '#facc15';
    add('#475569', shiftHexColor(finish, 0.55));
    add('#64748b', shiftHexColor(finish, 0.72));
    add('#94a3b8', finish);
    add('#cbd5e1', shiftHexColor(finish, 1.12));
    add('#d7dee8', shiftHexColor(finish, 1.16));
    add('#e2e8f0', shiftHexColor(finish, 1.18));
    add('#a16207', shiftHexColor(accent, 0.62));
    add('#d97706', shiftHexColor(accent, 0.78));
    add('#facc15', accent);
    add('#fef08a', shiftHexColor(accent, 1.12));
  }

  if (layer === 'weapon' && selectedClass === 'mage') {
    const racePalette = CHARACTER_RACE_LAYER_PALETTES[selectedRace] ?? CHARACTER_RACE_LAYER_PALETTES.human;
    const skin = appearance.skin ?? racePalette.skin;
    let staff = appearance.staff ?? '#7c4a22';
    let crystal = appearance.crystal ?? appearance.trim ?? '#67e8f9';
    let crystalMount = appearance.trim ?? '#facc15';
    add('#d99a72', shiftHexColor(skin, 0.72));
    add('#f2c7a4', skin);
    if (layerId?.endsWith('-ornate')) {
      staff = shiftHexColor(staff, 1.16);
      crystal = shiftHexColor(crystal, 1.08);
      crystalMount = '#fef08a';
    } else if (layerId?.endsWith('-shadow')) {
      staff = shiftHexColor(staff, 0.46);
      crystal = shiftHexColor(crystal, 0.82);
      crystalMount = shiftHexColor(crystal, 0.68);
    }
    add('#4b2c15', shiftHexColor(staff, 0.5));
    add('#7c4a22', staff);
    add('#94551f', shiftHexColor(staff, 1.14));
    add('#354427', shiftHexColor(staff, 0.52));
    add('#667a3c', shiftHexColor(staff, 0.82));
    add('#172c3d', shiftHexColor(staff, 0.44));
    add('#31506b', shiftHexColor(staff, 0.7));
    add('#facc15', crystalMount);
    add('#64748b', shiftHexColor(crystalMount, 0.62));
    add('#d7dee8', shiftHexColor(crystalMount, 1.08));
    add('#dbeafe', shiftHexColor(crystalMount, 1.12));
    add('#0e7490', shiftHexColor(crystal, 0.54));
    add('#93c5fd', shiftHexColor(crystal, 0.9));
    add('#67e8f9', crystal);
    add('#8be9fd', shiftHexColor(crystal, 1.12));
    add('#f8fafc', shiftHexColor(crystal, 1.24));
  }

  return replacements;
}

function applyCharacterLayerReplacements(imageData, replacements) {
  const data = imageData?.data;
  if (!data || replacements.length === 0) return imageData;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    for (const replacement of replacements) {
      if (colorDistanceSquared(
        data[index],
        data[index + 1],
        data[index + 2],
        replacement.source,
      ) > replacement.threshold ** 2) continue;
      data[index] = replacement.target[0];
      data[index + 1] = replacement.target[1];
      data[index + 2] = replacement.target[2];
      break;
    }
  }
  return imageData;
}

function rgba(value, fallback) {
  const rgb = hexToRgb(value) ?? hexToRgb(fallback) ?? [255, 255, 255];
  return [rgb[0], rgb[1], rgb[2], 255];
}

function setMagePixel(data, imageWidth, frameRow, frameColumn, x, y, color) {
  if (x < 0 || y < 0 || x >= CHARACTER_SPRITE_SIZE || y >= CHARACTER_SPRITE_SIZE) return;
  const index = ((((frameRow * CHARACTER_SPRITE_SIZE) + y) * imageWidth)
    + frameColumn * CHARACTER_SPRITE_SIZE + x) * 4;
  data.set(color, index);
}

function clearMagePixel(data, imageWidth, frameRow, frameColumn, x, y) {
  if (x < 0 || y < 0 || x >= CHARACTER_SPRITE_SIZE || y >= CHARACTER_SPRITE_SIZE) return;
  const index = ((((frameRow * CHARACTER_SPRITE_SIZE) + y) * imageWidth)
    + frameColumn * CHARACTER_SPRITE_SIZE + x) * 4;
  data.fill(0, index, index + 4);
}

function getMagePixelIndex(imageWidth, frameRow, frameColumn, x, y) {
  return ((((frameRow * CHARACTER_SPRITE_SIZE) + y) * imageWidth)
    + frameColumn * CHARACTER_SPRITE_SIZE + x) * 4;
}

function setMagePixelIfTransparent(
  data,
  imageWidth,
  frameRow,
  frameColumn,
  x,
  y,
  color,
) {
  if (x < 0 || y < 0 || x >= CHARACTER_SPRITE_SIZE || y >= CHARACTER_SPRITE_SIZE) return false;
  const index = getMagePixelIndex(imageWidth, frameRow, frameColumn, x, y);
  if (data[index + 3] !== 0) return false;
  data.set(color, index);
  return true;
}

function getMagePixelAlpha(data, imageWidth, frameRow, frameColumn, x, y) {
  if (x < 0 || y < 0 || x >= CHARACTER_SPRITE_SIZE || y >= CHARACTER_SPRITE_SIZE) return 0;
  return data[getMagePixelIndex(imageWidth, frameRow, frameColumn, x, y) + 3];
}

function collectMagePalettePixels(
  data,
  imageWidth,
  frameRow,
  frameColumn,
  palette,
  bounds,
  shouldInclude = () => true,
) {
  const [left, top, right, bottom] = bounds;
  const pixels = [];
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (!shouldInclude(x, y)) continue;
      const index = getMagePixelIndex(imageWidth, frameRow, frameColumn, x, y);
      if (magePixelMatches(data, index, palette)) pixels.push({ x, y });
    }
  }
  return pixels;
}

function getMagePixelBounds(pixels) {
  if (pixels.length === 0) return null;
  return pixels.reduce(
    (bounds, pixel) => ({
      left: Math.min(bounds.left, pixel.x),
      top: Math.min(bounds.top, pixel.y),
      right: Math.max(bounds.right, pixel.x),
      bottom: Math.max(bounds.bottom, pixel.y),
    }),
    {
      left: CHARACTER_SPRITE_SIZE,
      top: CHARACTER_SPRITE_SIZE,
      right: 0,
      bottom: 0,
    },
  );
}

function drawMageConnectedShape(
  data,
  imageWidth,
  frameRow,
  frameColumn,
  pixels,
  fill,
  outline,
  shouldInclude = () => true,
) {
  const uniquePixels = [];
  const pixelKeys = new Set();
  const fillableKeys = new Set();
  for (const pixel of pixels) {
    const x = Math.round(pixel.x);
    const y = Math.round(pixel.y);
    if (
      x < 0
      || y < 0
      || x >= CHARACTER_SPRITE_SIZE
      || y >= CHARACTER_SPRITE_SIZE
      || !shouldInclude(x, y)
    ) continue;
    const key = `${x}:${y}`;
    if (pixelKeys.has(key)) continue;
    pixelKeys.add(key);
    if (getMagePixelAlpha(data, imageWidth, frameRow, frameColumn, x, y) === 0) {
      fillableKeys.add(key);
    }
    uniquePixels.push({ x, y });
  }

  for (const pixel of uniquePixels) {
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX === 0 && offsetY === 0) continue;
        const outlineX = pixel.x + offsetX;
        const outlineY = pixel.y + offsetY;
        if (!shouldInclude(outlineX, outlineY)) continue;
        setMagePixelIfTransparent(
          data,
          imageWidth,
          frameRow,
          frameColumn,
          outlineX,
          outlineY,
          outline,
        );
      }
    }
  }

  for (const pixel of uniquePixels) {
    if (!fillableKeys.has(`${pixel.x}:${pixel.y}`)) continue;
    setMagePixel(data, imageWidth, frameRow, frameColumn, pixel.x, pixel.y, fill);
  }
}

function findMageWidestRow(pixels) {
  const rows = new Map();
  for (const pixel of pixels) {
    const current = rows.get(pixel.y) ?? { y: pixel.y, left: pixel.x, right: pixel.x, count: 0 };
    current.left = Math.min(current.left, pixel.x);
    current.right = Math.max(current.right, pixel.x);
    current.count += 1;
    rows.set(pixel.y, current);
  }
  return [...rows.values()].sort((left, right) => (
    right.count - left.count
    || right.y - left.y
  ))[0] ?? null;
}

function magePixelMatches(data, index, palette, threshold = 3) {
  if (data[index + 3] === 0) return false;
  return palette.some((color) => (
    colorDistanceSquared(data[index], data[index + 1], data[index + 2], color) <= threshold ** 2
  ));
}

function recolorMagePixels(
  data,
  imageWidth,
  frameRow,
  frameColumn,
  palette,
  bounds,
  getColor,
) {
  const [left, top, right, bottom] = bounds;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const index = getMagePixelIndex(imageWidth, frameRow, frameColumn, x, y);
      if (!magePixelMatches(data, index, palette)) continue;
      const color = getColor(x, y);
      if (color) data.set(color, index);
    }
  }
}

const MAGE_SOURCE_HAIR_PALETTE = [
  [75, 44, 21, 255],
  [95, 67, 41, 255],
  [124, 74, 34, 255],
  [141, 110, 69, 255],
];
const MAGE_SOURCE_STAFF_PALETTE = MAGE_SOURCE_HAIR_PALETTE;
const MAGE_SOURCE_GOLD_PALETTE = [
  [183, 121, 31, 255],
  [217, 119, 6, 255],
  [250, 204, 21, 255],
  [254, 224, 94, 255],
  [254, 240, 138, 255],
];

const MAGE_STAFF_X_BOUNDS = [
  [34, 47],
  [0, 16],
  [29, 47],
  [32, 47],
  [33, 47],
  [0, 15],
  [0, 18],
  [32, 47],
];

function isMageStaffZone(frameRow, x, y) {
  if (y < 2 || y > 46) return false;
  const [minX, maxX] =
    MAGE_STAFF_X_BOUNDS[frameRow] ?? MAGE_STAFF_X_BOUNDS[0];
  return x >= minX && x <= maxX;
}

function applyMageBaseHairColor(data, imageWidth, frameColumn, colors) {
  const targetPalette = [colors.hairDeep, colors.hairShade, colors.hair, colors.hairLight];
  for (let frameRow = 0; frameRow < 8; frameRow += 1) {
    for (let y = 12; y <= 26; y += 1) {
      for (let x = 10; x <= 37; x += 1) {
        if (isMageStaffZone(frameRow, x, y)) continue;
        const index = getMagePixelIndex(imageWidth, frameRow, frameColumn, x, y);
        const sourceIndex = MAGE_SOURCE_HAIR_PALETTE.findIndex((color) => (
          colorDistanceSquared(data[index], data[index + 1], data[index + 2], color) <= 9
        ));
        if (sourceIndex < 0) continue;
        data.set(targetPalette[sourceIndex], index);
      }
    }
  }
}

function applyMageStaffAppearance(data, imageWidth, frameColumn, appearance, colors) {
  const variant = appearance.weaponVariant ?? 'classic';
  let staff = colors.staff;
  let staffDark = colors.staffDark;
  let staffLight = colors.staffLight;
  let mount = colors.mount;
  let crystal = colors.crystal;
  let crystalDark = colors.crystalDark;
  let crystalLight = colors.crystalLight;
  if (variant === 'ornate') {
    staff = colors.staffLight;
    staffDark = colors.staff;
    staffLight = colors.mountLight;
    mount = colors.mountLight;
    crystal = colors.crystalLight;
  } else if (variant === 'shadow') {
    staff = colors.staffDark;
    staffDark = colors.outline;
    staffLight = colors.staff;
    mount = colors.crystalDark;
    crystal = colors.crystalDark;
    crystalDark = colors.outline;
    crystalLight = colors.crystal;
  }
  const staffTargets = [staffDark, staff, staff, staffLight];
  const crystalPalette = [
    colors.trimDark,
    colors.trim,
    colors.trimLight,
    colors.crystalDark,
    colors.crystal,
    colors.crystalLight,
  ];

  for (let frameRow = 0; frameRow < 8; frameRow += 1) {
    for (let y = 2; y <= 46; y += 1) {
      for (let x = 0; x < CHARACTER_SPRITE_SIZE; x += 1) {
        if (!isMageStaffZone(frameRow, x, y)) continue;
        const index = getMagePixelIndex(imageWidth, frameRow, frameColumn, x, y);
        if (data[index + 3] === 0) continue;
        const staffIndex = MAGE_SOURCE_STAFF_PALETTE.findIndex((color) => (
          colorDistanceSquared(data[index], data[index + 1], data[index + 2], color) <= 9
        ));
        if (staffIndex >= 0) {
          data.set(staffTargets[staffIndex], index);
          continue;
        }
        if (magePixelMatches(data, index, MAGE_SOURCE_GOLD_PALETTE, 3)) {
          data.set(mount, index);
          continue;
        }
        if (magePixelMatches(data, index, crystalPalette, 3)) {
          const brightness = data[index] + data[index + 1] + data[index + 2];
          data.set(
            brightness < 270 ? crystalDark : brightness > 560 ? crystalLight : crystal,
            index,
          );
        }
      }
    }
  }

  if (variant === 'classic') return;

  for (let frameRow = 0; frameRow < 8; frameRow += 1) {
    const crystalPixels = collectMagePalettePixels(
      data,
      imageWidth,
      frameRow,
      frameColumn,
      [crystalDark, crystal, crystalLight],
      [0, 1, 47, 18],
      (x, y) => isMageStaffZone(frameRow, x, y),
    );
    const staffPixels = collectMagePalettePixels(
      data,
      imageWidth,
      frameRow,
      frameColumn,
      [staffDark, staff, staffLight],
      [0, 2, 47, 45],
      (x, y) => isMageStaffZone(frameRow, x, y),
    );
    const crystalBounds = getMagePixelBounds(crystalPixels);
    const staffBounds = getMagePixelBounds(staffPixels);
    if (!crystalBounds || !staffBounds) continue;

    const crystalCenterX = Math.round((crystalBounds.left + crystalBounds.right) / 2);
    const crystalTop = crystalBounds.top;
    const crystalBottom = crystalBounds.bottom;
    const staffSide = crystalCenterX < CHARACTER_SPRITE_SIZE / 2 ? 1 : -1;

    if (variant === 'ornate') {
      const forkPixels = [
        { x: crystalCenterX - 3, y: crystalBottom + 1 },
        { x: crystalCenterX - 3, y: crystalBottom },
        { x: crystalCenterX - 3, y: crystalBottom - 1 },
        { x: crystalCenterX - 2, y: crystalBottom - 2 },
        { x: crystalCenterX + 3, y: crystalBottom + 1 },
        { x: crystalCenterX + 3, y: crystalBottom },
        { x: crystalCenterX + 3, y: crystalBottom - 1 },
        { x: crystalCenterX + 2, y: crystalBottom - 2 },
        { x: crystalCenterX - 2, y: crystalBottom + 2 },
        { x: crystalCenterX - 1, y: crystalBottom + 2 },
        { x: crystalCenterX + 1, y: crystalBottom + 2 },
        { x: crystalCenterX + 2, y: crystalBottom + 2 },
      ];
      drawMageConnectedShape(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        forkPixels,
        mount,
        colors.outline,
      );
      setMagePixelIfTransparent(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        crystalCenterX - 3,
        crystalTop,
        crystalLight,
      );
      setMagePixelIfTransparent(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        crystalCenterX + 3,
        crystalTop,
        crystalLight,
      );
    } else {
      const orbPixels = [];
      for (let offsetY = -3; offsetY <= 3; offsetY += 1) {
        for (let offsetX = -3; offsetX <= 3; offsetX += 1) {
          if ((offsetX * offsetX) + (offsetY * offsetY) > 11) continue;
          orbPixels.push({
            x: crystalCenterX + offsetX,
            y: Math.round((crystalTop + crystalBottom) / 2) + offsetY,
          });
        }
      }
      drawMageConnectedShape(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        orbPixels,
        crystalDark,
        colors.outline,
      );
      const orbCenterY = Math.round((crystalTop + crystalBottom) / 2);
      setMagePixel(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        crystalCenterX - staffSide,
        orbCenterY - 1,
        crystalLight,
      );
      setMagePixel(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        crystalCenterX,
        crystalBottom + 2,
        mount,
      );
    }
  }
}

function applyMageHairVariant(data, imageWidth, frameColumn, appearance, colors) {
  const gender = appearance.gender === 'female' ? 'female' : 'male';
  const style = appearance.hairStyle ?? (gender === 'female' ? 'female-bob' : 'male-cropped');
  const hairPalette = [colors.hairDeep, colors.hairShade, colors.hair, colors.hairLight];
  const hatless = appearance.hatVariant === 'none';
  const isAuthoredDefault = style === 'male-cropped' || style === 'female-bob';
  if (!hatless && isAuthoredDefault) return;

  for (let frameRow = 0; frameRow < 8; frameRow += 1) {
    const robePixels = collectMagePalettePixels(
      data,
      imageWidth,
      frameRow,
      frameColumn,
      [colors.robeDeep, colors.robeMid, colors.robe, colors.robeLight],
      [10, 24, 37, 38],
      (x, y) => !isMageStaffZone(frameRow, x, y),
    );
    const robeBounds = getMagePixelBounds(robePixels);
    const centerX = robeBounds
      ? Math.round((robeBounds.left + robeBounds.right) / 2)
      : 22;
    const staffOnLeft = (MAGE_STAFF_X_BOUNDS[frameRow]?.[0] ?? 34) < 20;
    const openSide = staffOnLeft ? 1 : -1;
    const noStaff = (x, y) => !isMageStaffZone(frameRow, x, y);

    // A no-hat hairstyle needs to replace the baked side locks, otherwise all
    // four choices retain the same authored long-hair silhouette. Remove only
    // recognized hair colors outside the protected face core, plus their dark
    // one-pixel outline, then build the selected silhouette below.
    if (hatless) {
      const sourceAndTargetHair = [...hairPalette, ...MAGE_SOURCE_HAIR_PALETTE];
      const removed = [];
      for (let y = 12; y <= 33; y += 1) {
        for (let x = 10; x <= 37; x += 1) {
          if (!noStaff(x, y)) continue;
          const protectsFace = frameRow === 0
            && x >= centerX - 4 && x <= centerX + 4
            && y >= 17 && y <= 24;
          if (protectsFace) continue;
          const index = getMagePixelIndex(imageWidth, frameRow, frameColumn, x, y);
          if (!magePixelMatches(data, index, sourceAndTargetHair, 16)) continue;
          removed.push({ x, y });
          clearMagePixel(data, imageWidth, frameRow, frameColumn, x, y);
        }
      }
      for (const pixel of removed) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const x = pixel.x + offsetX;
            const y = pixel.y + offsetY;
            if (!noStaff(x, y)) continue;
            const protectsFace = frameRow === 0
              && x >= centerX - 4 && x <= centerX + 4
              && y >= 17 && y <= 24;
            if (protectsFace) continue;
            const index = getMagePixelIndex(imageWidth, frameRow, frameColumn, x, y);
            const isDarkOutline = data[index + 3] !== 0
              && data[index] + data[index + 1] + data[index + 2] < 90;
            if (isDarkOutline) clearMagePixel(data, imageWidth, frameRow, frameColumn, x, y);
          }
        }
      }
    }

    const hairPixels = [];
    const capTop = gender === 'female' ? 11 : 12;
    const capBottom = 19;
    for (let y = capTop; y <= capBottom; y += 1) {
      const progress = (y - capTop) / Math.max(1, capBottom - capTop);
      const halfWidth = Math.max(2, Math.round(2 + Math.sin(progress * Math.PI * 0.72) * 5));
      for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += 1) {
        hairPixels.push({ x, y });
      }
    }

    if (style === 'male-cropped') {
      hairPixels.push(
        { x: centerX - 5, y: capTop - 1 },
        { x: centerX - 4, y: capTop - 2 },
        { x: centerX, y: capTop - 1 },
        { x: centerX + 4, y: capTop - 2 },
        { x: centerX + 5, y: capTop - 1 },
      );
    } else if (style === 'male-parted' || style === 'female-parted') {
      for (let step = 0; step <= (gender === 'female' ? 9 : 6); step += 1) {
        hairPixels.push({
          x: centerX + openSide * (5 + Math.floor(step / 3)),
          y: 15 + step,
        });
        if (step > 2) {
          hairPixels.push({
            x: centerX + openSide * (4 + Math.floor(step / 4)),
            y: 15 + step,
          });
        }
      }
      hairPixels.push(
        { x: centerX - openSide * 2, y: capTop - 1 },
        { x: centerX - openSide * 1, y: capTop - 2 },
      );
    } else if (style === 'male-tousled') {
      hairPixels.push(
        { x: centerX - 6, y: capTop - 1 },
        { x: centerX - 5, y: capTop - 2 },
        { x: centerX - 1, y: capTop - 2 },
        { x: centerX, y: capTop - 3 },
        { x: centerX + 4, y: capTop - 2 },
        { x: centerX + 6, y: capTop - 1 },
      );
      for (let y = 19; y <= 25; y += 1) {
        hairPixels.push({ x: centerX - 7, y }, { x: centerX + 7, y });
      }
    } else if (style === 'male-tied') {
      for (let y = 18; y <= 28; y += 1) {
        const drift = Math.floor((y - 18) / 4);
        hairPixels.push({ x: centerX + openSide * (7 + drift), y });
        if (y >= 21 && y <= 26) {
          hairPixels.push({ x: centerX + openSide * (8 + drift), y });
        }
      }
    } else if (style === 'female-wavy') {
      if (hatless) {
        for (let offsetY = -3; offsetY <= 2; offsetY += 1) {
          for (let offsetX = -3; offsetX <= 3; offsetX += 1) {
            if (offsetX * offsetX + offsetY * offsetY > 10) continue;
            hairPixels.push({ x: centerX + offsetX, y: capTop - 2 + offsetY });
          }
        }
      }
      for (let y = 18; y <= 24; y += 1) {
        hairPixels.push({ x: centerX - 7, y }, { x: centerX + 7, y });
      }
    } else if (style === 'female-braid') {
      const ponytailX = centerX + openSide * 7;
      for (let y = 18; y <= 32; y += 1) {
        const wave = Math.floor((y - 18) / 4) % 2;
        hairPixels.push({ x: ponytailX + openSide * wave, y });
        hairPixels.push({ x: ponytailX + openSide * (wave + 1), y });
      }
      for (let y = 18; y <= 25; y += 1) {
        hairPixels.push({ x: centerX - openSide * 7, y });
      }
    } else {
      // Female long-straight silhouette.
      for (let y = 17; y <= 30; y += 1) {
        const taper = y >= 28 ? 1 : 0;
        hairPixels.push(
          { x: centerX - 7 + taper, y },
          { x: centerX - 8 + taper, y },
          { x: centerX + 7 - taper, y },
          { x: centerX + 8 - taper, y },
        );
      }
    }

    drawMageConnectedShape(
      data,
      imageWidth,
      frameRow,
      frameColumn,
      hairPixels,
      colors.hair,
      colors.outline,
      noStaff,
    );

    if (hatless) {
      for (let x = centerX - 4; x <= centerX + 2; x += 1) {
        setMagePixelIfTransparent(
          data,
          imageWidth,
          frameRow,
          frameColumn,
          x,
          capTop + 2,
          colors.hairLight,
        );
      }
    }
  }
}

function applyMageHatVariant(data, imageWidth, frameColumn, appearance, colors) {
  const variant = appearance.hatVariant ?? 'wanderer';
  if (variant === 'wanderer') return;
  const hatPalette = [colors.hatDark, colors.hatMid, colors.hat, colors.hatLight];

  for (let frameRow = 0; frameRow < 8; frameRow += 1) {
    const hatPixels = collectMagePalettePixels(
      data,
      imageWidth,
      frameRow,
      frameColumn,
      hatPalette,
      [4, 2, 43, 18],
      (x, y) => !isMageStaffZone(frameRow, x, y),
    );
    const hatBounds = getMagePixelBounds(hatPixels);
    const brim = findMageWidestRow(hatPixels);
    if (!hatBounds || !brim) continue;
    const noStaff = (x, y) => !isMageStaffZone(frameRow, x, y);
    const centerX = Math.round((brim.left + brim.right) / 2);
    const brimY = Math.min(15, brim.y);

    // Every non-default design replaces the baked wanderer silhouette. The
    // former code only glued pixels onto that hat, which produced the long
    // horizontal bar and doubled crown seen in the recording.
    for (let y = 0; y <= brimY; y += 1) {
      for (let x = 3; x <= 44; x += 1) {
        if (noStaff(x, y)) clearMagePixel(data, imageWidth, frameRow, frameColumn, x, y);
      }
    }
    for (let y = brimY + 1; y <= Math.min(18, brimY + 3); y += 1) {
      for (let x = 3; x <= 44; x += 1) {
        if (!noStaff(x, y)) continue;
        const index = getMagePixelIndex(imageWidth, frameRow, frameColumn, x, y);
        if (magePixelMatches(data, index, hatPalette, 40)) {
          clearMagePixel(data, imageWidth, frameRow, frameColumn, x, y);
        }
      }
    }

    if (variant === 'none') continue;

    if (variant === 'wide') {
      const shape = [];
      const crownTop = Math.max(5, brimY - 8);
      for (let y = crownTop; y < brimY; y += 1) {
        const progress = (y - crownTop) / Math.max(1, brimY - crownTop);
        const halfWidth = Math.round(3 + progress * 4);
        for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += 1) {
          shape.push({ x, y });
        }
      }
      for (let x = centerX - 11; x <= centerX + 11; x += 1) {
        shape.push({ x, y: brimY });
        if (Math.abs(x - centerX) <= 9) shape.push({ x, y: brimY + 1 });
      }
      drawMageConnectedShape(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        shape,
        colors.hat,
        colors.outline,
        noStaff,
      );
      for (let x = centerX - 6; x <= centerX + 6; x += 1) {
        setMagePixel(data, imageWidth, frameRow, frameColumn, x, brimY - 2, colors.trim);
      }
    } else if (variant === 'high-crown') {
      const crownPixels = [];
      const crownTop = 1;
      const crownBottom = Math.max(crownTop + 4, brim.y - 2);
      const crownHeight = Math.max(1, crownBottom - crownTop);
      for (let y = crownTop; y <= crownBottom; y += 1) {
        const progress = (y - crownTop) / crownHeight;
        const halfWidth = Math.max(1, Math.round(1 + progress * 6));
        const lean = Math.round((1 - progress) * -1);
        for (
          let x = centerX + lean - halfWidth;
          x <= centerX + lean + halfWidth;
          x += 1
        ) {
          crownPixels.push({ x, y });
        }
      }
      for (let x = centerX - 9; x <= centerX + 9; x += 1) {
        crownPixels.push({ x, y: brimY });
        if (Math.abs(x - centerX) <= 7) crownPixels.push({ x, y: brimY + 1 });
      }
      drawMageConnectedShape(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        crownPixels,
        colors.hat,
        colors.outline,
        noStaff,
      );
      for (let x = centerX - 6; x <= centerX + 6; x += 1) {
        const bandY = crownBottom - 1;
        if (getMagePixelAlpha(data, imageWidth, frameRow, frameColumn, x, bandY) !== 0) {
          setMagePixel(data, imageWidth, frameRow, frameColumn, x, bandY, colors.trim);
        }
      }
    } else if (variant === 'starcaller') {
      const staffOnLeft = (MAGE_STAFF_X_BOUNDS[frameRow]?.[0] ?? 34) < 20;
      const openSide = staffOnLeft ? 1 : -1;
      const hoodPixels = [];
      const hoodTop = Math.max(3, brimY - 11);
      for (let y = hoodTop; y < brimY; y += 1) {
        const progress = (y - hoodTop) / Math.max(1, brimY - hoodTop);
        const halfWidth = Math.max(1, Math.round(2 + progress * 6));
        const lean = Math.round(openSide * (1 - progress) * 3);
        for (let x = centerX + lean - halfWidth; x <= centerX + lean + halfWidth; x += 1) {
          hoodPixels.push({ x, y });
        }
      }
      for (let x = centerX - 8; x <= centerX + 8; x += 1) {
        hoodPixels.push({ x, y: brimY });
      }
      const tailAnchor = centerX + openSide * 7;
      for (let step = 0; step <= 8; step += 1) {
        const drift = Math.floor(step / 3);
        const x = tailAnchor + openSide * drift;
        const y = brimY + 1 + step;
        hoodPixels.push({ x, y }, { x: x - openSide, y });
        if (step <= 4) hoodPixels.push({ x: x - openSide * 2, y });
      }
      drawMageConnectedShape(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        hoodPixels,
        colors.hatMid,
        colors.outline,
        noStaff,
      );
      for (let x = centerX - 6; x <= centerX + 6; x += 1) {
        setMagePixel(data, imageWidth, frameRow, frameColumn, x, brimY - 1, colors.trim);
      }
      const tailTipX = tailAnchor + openSide * 2;
      const tailTipY = brimY + 9;
      if (getMagePixelAlpha(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        tailTipX,
        tailTipY,
      ) !== 0) {
        setMagePixel(
          data,
          imageWidth,
          frameRow,
          frameColumn,
          tailTipX,
          tailTipY,
          colors.trimLight,
        );
      }
    }
  }
}

function applyMageFaceVariant(data, imageWidth, frameColumn, appearance, colors) {
  const row = 0;
  const gender = appearance.gender === 'female' ? 'female' : 'male';
  const variant = appearance.faceVariant
    ?? (gender === 'female' ? 'female-soft' : 'male-natural');

  // The polished atlas has a compact 7x7 face. Its generated downscale loses
  // sub-pixel eyes, so author the readable three-pixel expression on the
  // actual face interior instead of using coordinates from the older sheet.
  setMagePixel(data, imageWidth, row, frameColumn, 20, 19, colors.skin);
  setMagePixel(data, imageWidth, row, frameColumn, 23, 19, colors.skin);
  setMagePixel(data, imageWidth, row, frameColumn, 21, 22, colors.skinShade);
  setMagePixel(data, imageWidth, row, frameColumn, 22, 22, colors.skinShade);
  setMagePixel(data, imageWidth, row, frameColumn, 20, 19, colors.eyes);
  setMagePixel(data, imageWidth, row, frameColumn, 23, 19, colors.eyes);
  setMagePixel(data, imageWidth, row, frameColumn, 22, 22, colors.mouth);

  if (variant === 'male-keen') {
    setMagePixel(data, imageWidth, row, frameColumn, 20, 18, colors.hairShade);
    setMagePixel(data, imageWidth, row, frameColumn, 23, 18, colors.hairShade);
  } else if (variant === 'male-weathered') {
    setMagePixel(data, imageWidth, row, frameColumn, 24, 18, colors.skinShade);
    setMagePixel(data, imageWidth, row, frameColumn, 24, 20, colors.skinShade);
    setMagePixel(data, imageWidth, row, frameColumn, 19, 22, colors.hairShade);
  } else if (variant === 'male-calm') {
    setMagePixel(data, imageWidth, row, frameColumn, 22, 22, colors.skinShade);
    setMagePixel(data, imageWidth, row, frameColumn, 21, 22, colors.mouth);
  } else if (variant === 'female-bright') {
    setMagePixel(data, imageWidth, row, frameColumn, 19, 21, colors.skinLight);
    setMagePixel(data, imageWidth, row, frameColumn, 24, 21, colors.skinLight);
  } else if (variant === 'female-freckled') {
    setMagePixel(data, imageWidth, row, frameColumn, 19, 21, colors.skinShade);
    setMagePixel(data, imageWidth, row, frameColumn, 24, 21, colors.skinShade);
  } else if (variant === 'female-serene') {
    setMagePixel(data, imageWidth, row, frameColumn, 22, 22, colors.skinShade);
    setMagePixel(data, imageWidth, row, frameColumn, 21, 22, colors.mouth);
    setMagePixel(data, imageWidth, row, frameColumn, 19, 19, colors.eyes);
    setMagePixel(data, imageWidth, row, frameColumn, 24, 19, colors.eyes);
  }
}

function applyMageRobeVariant(data, imageWidth, frameColumn, appearance, colors) {
  const variant = appearance.outfitVariant ?? 'classic';
  if (variant === 'classic') return;
  const robePalette = [colors.robeDeep, colors.robeMid, colors.robe, colors.robeLight];

  for (let frameRow = 0; frameRow < 8; frameRow += 1) {
    const robePixels = collectMagePalettePixels(
      data,
      imageWidth,
      frameRow,
      frameColumn,
      robePalette,
      [10, 25, 37, 42],
      (x, y) => !isMageStaffZone(frameRow, x, y),
    );
    const robeBounds = getMagePixelBounds(robePixels);
    if (!robeBounds) continue;
    const centerX = Math.round((robeBounds.left + robeBounds.right) / 2);
    const noStaff = (x, y) => !isMageStaffZone(frameRow, x, y);

    if (variant === 'veteran') {
      const mantleY = Math.min(31, robeBounds.top + 2);
      drawMageConnectedShape(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        [
          { x: robeBounds.left - 1, y: mantleY },
          { x: robeBounds.left - 2, y: mantleY + 1 },
          { x: robeBounds.left - 3, y: mantleY + 2 },
          { x: robeBounds.left - 2, y: mantleY + 2 },
          { x: robeBounds.left - 1, y: mantleY + 1 },
          { x: robeBounds.left - 1, y: mantleY + 2 },
          { x: robeBounds.right + 1, y: mantleY },
          { x: robeBounds.right + 2, y: mantleY + 1 },
          { x: robeBounds.right + 3, y: mantleY + 2 },
          { x: robeBounds.right + 2, y: mantleY + 2 },
          { x: robeBounds.right + 1, y: mantleY + 1 },
          { x: robeBounds.right + 1, y: mantleY + 2 },
        ],
        colors.robeMid,
        colors.outline,
        noStaff,
      );
      recolorMagePixels(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        robePalette,
        [robeBounds.left, mantleY, robeBounds.right, mantleY + 2],
        (x) => (Math.abs(x - centerX) >= 3 ? colors.robeDeep : colors.trimDark),
      );
    } else if (variant === 'runed') {
      const tabardTop = Math.max(29, robeBounds.top + 3);
      const tabardPixels = [];
      for (
        let y = tabardTop;
        y <= Math.min(44, robeBounds.bottom + 3);
        y += 1
      ) {
        tabardPixels.push({ x: centerX, y });
        tabardPixels.push({ x: centerX - 1, y });
        tabardPixels.push({ x: centerX + 1, y });
        if (y <= robeBounds.bottom + 1) {
          tabardPixels.push({ x: centerX - 2, y });
          tabardPixels.push({ x: centerX + 2, y });
        }
      }
      drawMageConnectedShape(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        tabardPixels,
        colors.robeLight,
        colors.outline,
        noStaff,
      );
      const tabardBottom = Math.min(41, robeBounds.bottom + 1);
      for (let y = tabardTop; y <= tabardBottom; y += 1) {
        const halfWidth = y <= tabardTop + 1 || y >= tabardBottom - 1 ? 1 : 2;
        for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += 1) {
          if (!noStaff(x, y)) continue;
          if (getMagePixelAlpha(data, imageWidth, frameRow, frameColumn, x, y) === 0) continue;
          const isEdge = Math.abs(x - centerX) === halfWidth;
          const isRune = x === centerX && (y - tabardTop) % 3 === 1;
          setMagePixel(
            data,
            imageWidth,
            frameRow,
            frameColumn,
            x,
            y,
            isRune ? colors.trimLight : isEdge ? colors.trimDark : colors.robeLight,
          );
        }
      }
    } else if (variant === 'dark') {
      recolorMagePixels(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        robePalette,
        [robeBounds.left, robeBounds.top, robeBounds.right, robeBounds.bottom],
        (x, y) => (y <= robeBounds.top + 3 ? colors.robeMid : colors.robeDeep),
      );
      const layeredHem = [];
      const hemY = Math.min(44, robeBounds.bottom + 1);
      for (let x = robeBounds.left; x <= robeBounds.right; x += 1) {
        layeredHem.push({ x, y: hemY });
        if (Math.abs(x - centerX) >= 3) {
          layeredHem.push({ x, y: Math.min(45, hemY + 1) });
        }
        if (Math.abs(x - centerX) >= 5) {
          layeredHem.push({ x, y: Math.min(45, hemY + 2) });
        }
      }
      drawMageConnectedShape(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        layeredHem,
        colors.robeDeep,
        colors.outline,
        noStaff,
      );
      const collarY = robeBounds.top;
      drawMageConnectedShape(
        data,
        imageWidth,
        frameRow,
        frameColumn,
        [
          { x: centerX - 2, y: collarY - 1 },
          { x: centerX - 1, y: collarY },
          { x: centerX + 2, y: collarY - 1 },
          { x: centerX + 1, y: collarY },
        ],
        colors.trimDark,
        colors.outline,
        noStaff,
      );
    }
  }
}

function applyHumanMageBodyAppearance(imageData, imageWidth, imageHeight, appearance, layerId) {
  if (imageHeight < CHARACTER_SPRITE_EIGHT_DIRECTION_HEIGHT) return;
  const data = imageData.data;
  const robeValue = appearance.robe ?? '#1d4ed8';
  const effectiveRobe = robeValue;
  const hatValue = appearance.hat ?? robeValue;
  const colors = {
    outline: rgba('#05080c', '#05080c'),
    skin: rgba(appearance.skin, '#f2c7a4'),
    skinShade: rgba(shiftHexColor(appearance.skin ?? '#f2c7a4', 0.72), '#d99a72'),
    skinLight: rgba(shiftHexColor(appearance.skin ?? '#f2c7a4', 1.08), '#ffd8b8'),
    mouth: rgba(shiftHexColor(appearance.skin ?? '#f2c7a4', 0.56), '#9c6b55'),
    eyes: rgba(appearance.eyes, '#3b2416'),
    hairDeep: rgba(shiftHexColor(appearance.hair ?? '#8b5e34', 0.5), '#4b2c15'),
    hairShade: rgba(shiftHexColor(appearance.hair ?? '#8b5e34', 0.7), '#5f4329'),
    hair: rgba(appearance.hair, '#8b5e34'),
    hairLight: rgba(shiftHexColor(appearance.hair ?? '#8b5e34', 1.14), '#a97846'),
    robeDeep: rgba(shiftHexColor(effectiveRobe, 0.46), '#172554'),
    robeMid: rgba(shiftHexColor(effectiveRobe, 0.68), '#312e81'),
    robe: rgba(effectiveRobe, '#1d4ed8'),
    robeDark: rgba(shiftHexColor(effectiveRobe, 0.46), '#172554'),
    robeLight: rgba(shiftHexColor(effectiveRobe, 1.14), '#4263eb'),
    trim: rgba(appearance.trim, '#67e8f9'),
    trimDark: rgba(shiftHexColor(appearance.trim ?? '#67e8f9', 0.62), '#0e7490'),
    trimLight: rgba(shiftHexColor(appearance.trim ?? '#67e8f9', 1.08), '#8be9fd'),
    hat: rgba(hatValue, robeValue),
    hatDark: rgba(shiftHexColor(hatValue, 0.46), '#172554'),
    hatMid: rgba(shiftHexColor(hatValue, 0.68), '#312e81'),
    hatLight: rgba(shiftHexColor(hatValue, 1.14), '#4263eb'),
    staffDark: rgba(shiftHexColor(appearance.staff ?? '#7c4a22', 0.5), '#4b2c15'),
    staff: rgba(appearance.staff, '#7c4a22'),
    staffLight: rgba(shiftHexColor(appearance.staff ?? '#7c4a22', 1.14), '#94551f'),
    mount: rgba('#facc15', '#facc15'),
    mountLight: rgba('#fef08a', '#fef08a'),
    crystalDark: rgba(shiftHexColor(appearance.crystal ?? '#67e8f9', 0.54), '#0e7490'),
    crystal: rgba(appearance.crystal, '#67e8f9'),
    crystalLight: rgba(shiftHexColor(appearance.crystal ?? '#67e8f9', 1.12), '#8be9fd'),
  };
  const robeTones = [
    colors.robeDeep,
    colors.robeMid,
    colors.robe,
    colors.robeLight,
  ];
  const hatTones = [colors.hatDark, colors.hatMid, colors.hat, colors.hatLight];
  const frameColumns = Math.floor(imageWidth / CHARACTER_SPRITE_SIZE);

  for (let frameColumn = 0; frameColumn < frameColumns; frameColumn += 1) {
    for (let frameRow = 0; frameRow < 8; frameRow += 1) {
      for (let y = 2; y <= 18; y += 1) {
        for (let x = 4; x < 44; x += 1) {
          const index = ((((frameRow * CHARACTER_SPRITE_SIZE) + y) * imageWidth)
            + frameColumn * CHARACTER_SPRITE_SIZE + x) * 4;
          for (let toneIndex = 0; toneIndex < robeTones.length; toneIndex += 1) {
            const source = robeTones[toneIndex];
            if (colorDistanceSquared(data[index], data[index + 1], data[index + 2], source) > 16) continue;
            data[index] = hatTones[toneIndex][0];
            data[index + 1] = hatTones[toneIndex][1];
            data[index + 2] = hatTones[toneIndex][2];
            break;
          }
        }
      }
    }
    applyMageBaseHairColor(data, imageWidth, frameColumn, colors);
    applyMageStaffAppearance(data, imageWidth, frameColumn, appearance, colors);
    applyMageHatVariant(data, imageWidth, frameColumn, appearance, colors);
    applyMageHairVariant(data, imageWidth, frameColumn, appearance, colors);
    applyMageFaceVariant(data, imageWidth, frameColumn, appearance, colors);
    applyMageRobeVariant(data, imageWidth, frameColumn, appearance, colors);
  }
}

function getTintedCharacterLayerImage(sourceImage, layer, layerId, selectedClass, selectedRace, appearance = {}) {
  const replacements = getCharacterLayerReplacements(layer, layerId, selectedClass, selectedRace, appearance);
  if (replacements.length === 0) return sourceImage;

  const tintKey = [
    'layer',
    layer,
    layerId,
    selectedClass,
    selectedRace,
    appearance.gender,
    appearance.skin,
    appearance.eyes,
    appearance.hair,
    appearance.hairStyle,
    appearance.faceVariant,
    appearance.hat,
    appearance.hatVariant,
    appearance.robe,
    appearance.trim,
    appearance.staff,
    appearance.crystal,
    appearance.outfitVariant,
    appearance.weaponVariant,
    appearance.weaponColor,
  ].join('|');
  if (CHARACTER_TINTED_SPRITES.has(tintKey)) return CHARACTER_TINTED_SPRITES.get(tintKey);

  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.naturalWidth || sourceImage.width || CHARACTER_SPRITE_EXPECTED_WIDTH;
  canvas.height = sourceImage.naturalHeight || sourceImage.height || CHARACTER_SPRITE_EXPECTED_HEIGHT;
  const spriteContext = canvas.getContext('2d');
  spriteContext.imageSmoothingEnabled = false;
  spriteContext.drawImage(sourceImage, 0, 0);

  const imageData = spriteContext.getImageData(0, 0, canvas.width, canvas.height);
  applyCharacterLayerReplacements(imageData, replacements);
  if (layer === 'outfit'
    && selectedClass === 'mage'
    && selectedRace === 'human'
    && !/^[a-z]+-fresh-/.test(layerId ?? '')) {
    applyHumanMageBodyAppearance(imageData, canvas.width, canvas.height, appearance, layerId);
  }
  spriteContext.putImageData(imageData, 0, 0);
  CHARACTER_TINTED_SPRITES.set(tintKey, canvas);
  return canvas;
}

function getCharacterSpriteImage(selectedClass, appearance = {}) {
  for (const spriteId of getCharacterSpriteCandidates(selectedClass, appearance)) {
    if (!CHARACTER_SPRITES.has(spriteId) && !CHARACTER_SPRITE_LOADS.has(spriteId)) {
      loadCharacterSprite(spriteId);
    }
    const image = CHARACTER_SPRITES.get(spriteId);
    if (image) return { image, spriteId };
  }
  return null;
}

function getTintedCharacterSpriteImage(sourceImage, spriteId, selectedClass, appearance = {}) {
  const palette = CHARACTER_SPRITE_SOURCE_PALETTES[selectedClass];
  if (!sourceImage || !palette) return sourceImage;

  const tintValues = {
    skin: appearance.skin,
    hair: appearance.hair,
    robe: appearance.robe,
    trim: appearance.trim,
  };
  const tintKey = `${spriteId}|${Object.entries(tintValues).map(([key, value]) => `${key}:${value ?? ''}`).join('|')}`;
  if (CHARACTER_TINTED_SPRITES.has(tintKey)) return CHARACTER_TINTED_SPRITES.get(tintKey);

  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.naturalWidth || sourceImage.width || CHARACTER_SPRITE_EXPECTED_WIDTH;
  canvas.height = sourceImage.naturalHeight || sourceImage.height || CHARACTER_SPRITE_EXPECTED_HEIGHT;
  const spriteContext = canvas.getContext('2d');
  spriteContext.imageSmoothingEnabled = false;
  spriteContext.drawImage(sourceImage, 0, 0);

  const imageData = spriteContext.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const sources = {
    skin: hexToRgb(palette.skin),
    skinShade: hexToRgb(palette.skinShade),
    hair: hexToRgb(palette.hair),
    robe: hexToRgb(palette.robe),
    trim: hexToRgb(palette.trim),
  };
  const targets = {
    skin: hexToRgb(appearance.skin),
    skinShade: hexToRgb(shiftHexColor(appearance.skin, 0.78)),
    hair: hexToRgb(appearance.hair),
    robe: hexToRgb(appearance.robe),
    trim: hexToRgb(appearance.trim),
  };
  const replacements = [
    ['skinShade', 18],
    ['skin', 18],
    ['hair', 22],
    ['robe', 22],
    ['trim', 20],
  ];

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    for (const [key, threshold] of replacements) {
      const target = targets[key];
      if (!target) continue;
      if (colorDistanceSquared(data[index], data[index + 1], data[index + 2], sources[key]) > threshold ** 2) continue;
      data[index] = target[0];
      data[index + 1] = target[1];
      data[index + 2] = target[2];
      break;
    }
  }

  spriteContext.putImageData(imageData, 0, 0);
  CHARACTER_TINTED_SPRITES.set(tintKey, canvas);
  return canvas;
}

function drawCharacterAssetSprite(context, player, selectedClass, selectedRace, appearance = {}) {
  if (drawCharacterLayeredSprite(context, player, selectedClass, selectedRace, appearance)) return true;
  // Human characters must never flash a legacy full-character sheet while
  // their race-specific eight-direction artwork is loading or invalid.
  if (selectedRace === 'human') return false;

  const sprite = getCharacterSpriteImage(selectedClass, appearance);
  const raceConfig = RACES[selectedRace];
  if (!sprite?.image || !raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return false;

  const direction = getCharacterSpriteDirection(player);
  const column = getCharacterSpriteColumn(player);
  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;
  const image = getTintedCharacterSpriteImage(sprite.image, sprite.spriteId, selectedClass, appearance);
  const row = getCharacterSpriteRow(image, direction);
  drawCharacterSpriteFrame(context, image, player, selectedRace, row, column);
  context.imageSmoothingEnabled = previousSmoothing;
  return true;
}

function drawPixelPlayerSprite(context, player, selectedClass, selectedRace, appearance = {}) {
  const classConfig = CLASSES[selectedClass];
  const raceConfig = RACES[selectedRace];
  if (!classConfig || !raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return;

  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;

  const colors = { ...classConfig.colors, ...appearance };
  const skin = appearance.skin ?? raceConfig.skin;
  const hair = appearance.hair ?? (selectedRace === 'human' ? colors.hair : raceConfig.hair);
  const body = appearance.robe ?? colors.robe;
  const trim = appearance.trim ?? colors.trim;
  const weapon = colors.weapon ?? '#e5e7eb';
  const facing = Number.isFinite(player.facing) ? player.facing : 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const direction = Math.abs(fy) > Math.abs(fx)
    ? (fy < 0 ? 'back' : 'front')
    : (fx < 0 ? 'left' : 'right');
  const isBack = direction === 'back';
  const isSide = direction === 'left' || direction === 'right';
  const sideSign = direction === 'left' ? -1 : 1;
  const sideX = Math.cos(facing + Math.PI / 2);
  const sideY = Math.sin(facing + Math.PI / 2);
  const now = performance.now();
  const frame = getCharacterAnimationFrame(player);
  const idleBreath = Math.round(Math.sin(now / 420 + player.x * 0.01) * 1);
  const bob = frame.bodyBob + idleBreath;
  const outline = '#101820';
  const shade = 'rgba(0, 0, 0, 0.26)';
  const scaleY = selectedRace === 'dwarf' ? 0.9 : 1;
  const spriteScale = selectedRace === 'dwarf' ? 1.12 : 1.18;
  const classSprite = CLASS_SPRITE_DETAILS[selectedClass] ?? CLASS_SPRITE_DETAILS.warrior;
  const highlight = selectedClass === 'priest'
    ? '#f8fafc'
    : selectedClass === 'mage'
      ? '#a5f3fc'
      : selectedClass === 'hunter'
        ? '#bef264'
        : selectedClass === 'paladin'
          ? '#fef08a'
          : selectedClass === 'rogue'
            ? '#c084fc'
            : '#cbd5e1';

  context.save();
  context.translate(player.x, player.y + bob);
  context.scale(raceConfig.scale * spriteScale, raceConfig.scale * scaleY * spriteScale);

  pixelRect(context, -18, 21, 36, 7, shade);

  const leftStep = frame.leftLeg;
  const rightStep = frame.rightLeg;
  pixelRect(context, -12, 12, 8, 18 + leftStep, outline);
  pixelRect(context, 4, 12, 8, 18 + rightStep, outline);
  pixelRect(context, -10, 13, 5, 14 + leftStep, trim);
  pixelRect(context, 5, 13, 5, 14 + rightStep, trim);
  pixelRect(context, -11, 27 + leftStep, 8, 4, outline);
  pixelRect(context, 3, 27 + rightStep, 10, 4, outline);

  pixelRect(context, -18, -15, 36, 38, outline);
  pixelRect(context, -14, -11, 28, 32, body);
  pixelRect(context, -8, -5, 16, 24, selectedClass === 'rogue' ? '#111827' : body);
  if (isSide) {
    pixelRect(context, -13 * sideSign, -12, 24 * sideSign, 34, outline);
    pixelRect(context, -10 * sideSign, -9, 18 * sideSign, 28, body);
    pixelRect(context, -4 * sideSign, -7, 7 * sideSign, 26, trim);
  }
  pixelRect(context, -10, -8, 7, 27, 'rgba(255, 255, 255, 0.12)');
  pixelRect(context, 7, -8, 4, 25, 'rgba(0, 0, 0, 0.16)');
  pixelRect(context, -10, 5, 20, 4, trim);
  pixelRect(context, -3, -9, 6, 30, trim);
  if (isBack) {
    pixelRect(context, -13, -10, 26, 31, body);
    pixelRect(context, -3, -8, 6, 28, trim);
    pixelRect(context, -15, 16, 30, 6, trim);
  }
  pixelRect(context, -20, -13, 9, 10, outline);
  pixelRect(context, 11, -13, 9, 10, outline);
  pixelRect(context, -18, -11, 7, 7, highlight);
  pixelRect(context, 11, -11, 7, 7, highlight);
  pixelRect(context, -14, -15, 28, 4, classSprite.collar);

  if (selectedClass === 'paladin') {
    pixelRect(context, -15, -11, 30, 14, '#fef08a');
    pixelRect(context, -11, -8, 22, 8, body);
    if (isBack) {
      pixelRect(context, -4, -5, 8, 22, '#fef08a');
      pixelRect(context, -10, 2, 20, 5, '#fef08a');
    }
  }
  if (selectedClass === 'warrior') {
    pixelRect(context, -15, -11, 30, 13, '#94a3b8');
    pixelRect(context, -9, -7, 18, 7, body);
    if (isBack) {
      pixelRect(context, -16, 4, 32, 24, '#7f1d1d');
      pixelRect(context, -5, 9, 10, 12, '#f59e0b');
    }
  }
  if (selectedClass === 'priest') {
    pixelRect(context, -14, -10, 28, 5, '#e0e7ff');
    pixelRect(context, -4, 9, 8, 10, '#f8fafc');
    pixelRect(context, -16, 19, 32, 5, '#e0e7ff');
    if (isBack) {
      pixelRect(context, -3, -2, 6, 22, '#facc15');
      pixelRect(context, -9, 7, 18, 4, '#facc15');
    }
  }
  if (selectedClass === 'mage') {
    pixelRect(context, -13, -11, 26, 5, '#67e8f9');
    pixelRect(context, -8, 10, 16, 5, '#dbeafe');
    pixelRect(context, -15, 18, 30, 5, '#312e81');
    if (isBack) {
      pixelRect(context, -15, -17, 30, 9, '#1d4ed8');
      pixelRect(context, -12, -25, 24, 11, '#1e3a8a');
    }
  }
  if (selectedClass === 'hunter') {
    pixelRect(context, -14, -10, 28, 5, '#bef264');
    pixelRect(context, -12, 10, 24, 5, '#7c4a22');
    if (isBack) {
      pixelRect(context, -17, -14, 34, 17, '#2f5f2d');
      pixelLine(context, -18, 16, 13, -18, 4, '#7c4a22', 10);
    }
  }
  if (selectedClass === 'rogue') {
    pixelRect(context, -13, -12, 26, 9, '#111827');
    pixelRect(context, -14, 5, 28, 7, '#1f2937');
    pixelRect(context, -10, 16, 20, 8, '#111827');
    pixelRect(context, -16, -2, 5, 22, '#111827');
    pixelRect(context, 11, -2, 5, 22, '#111827');
  }

  pixelRect(context, -21, -5, 7, 20 + frame.leftArm, outline);
  pixelRect(context, 14, -5, 7, 20 + frame.rightArm, outline);
  pixelRect(context, -19, -4, 4, 16 + frame.leftArm, trim);
  pixelRect(context, 15, -4, 4, 16 + frame.rightArm, trim);

  const headY = -30;
  if (selectedRace === 'elf') {
    if (!isBack) {
      pixelRect(context, -23, headY - 2, 10, 5, outline);
      pixelRect(context, 13, headY - 2, 10, 5, outline);
      pixelRect(context, -24, headY - 1, 9, 3, skin);
      pixelRect(context, 15, headY - 1, 9, 3, skin);
    }
  }

  pixelRect(context, -14, headY - 12, 28, 5, outline);
  pixelRect(context, -16, headY - 7, 32, 18, outline);
  pixelRect(context, -12, headY + 11, 24, 5, outline);
  if (isBack) {
    pixelRect(context, -13, headY - 9, 26, 24, hair);
    pixelRect(context, -9, headY - 12, 18, 6, hair);
    pixelRect(context, -11, headY + 6, 22, 8, 'rgba(0, 0, 0, 0.12)');
  } else if (isSide) {
    pixelRect(context, -12 * sideSign, headY - 9, 23 * sideSign, 5, skin);
    pixelRect(context, -14 * sideSign, headY - 4, 25 * sideSign, 14, skin);
    pixelRect(context, -8 * sideSign, headY + 9, 18 * sideSign, 5, skin);
    pixelRect(context, 8 * sideSign, headY - 1, 4 * sideSign, 8, skin);
  } else {
    pixelRect(context, -11, headY - 9, 22, 5, skin);
    pixelRect(context, -13, headY - 4, 26, 13, skin);
    pixelRect(context, -9, headY + 9, 18, 5, skin);
    pixelRect(context, -11, headY - 5, 6, 7, 'rgba(255, 255, 255, 0.12)');
  }

  if (selectedRace === 'orc') {
    if (!isBack) {
      pixelRect(context, -13, headY - 5, 5, 8, skin);
      pixelRect(context, 8, headY - 5, 5, 8, skin);
      pixelRect(context, -8, headY + 8, 3, 6, '#f8fafc');
      pixelRect(context, 5, headY + 8, 3, 6, '#f8fafc');
    }
  }

  if (selectedRace === 'undead') {
    if (!isBack) {
      pixelRect(context, -9, headY - 8, 18, 8, '#d8e1cf');
      pixelRect(context, -5, headY + 5, 2, 5, '#64748b');
      pixelRect(context, 1, headY + 5, 2, 5, '#64748b');
    }
  } else if (!isBack) {
    pixelRect(context, -11, headY - 12, 22, 7, hair);
    if (isSide) {
      pixelRect(context, -13 * sideSign, headY - 7, 9 * sideSign, 17, hair);
      pixelRect(context, 7 * sideSign, headY - 7, 5 * sideSign, 9, hair);
    } else {
      pixelRect(context, -12, headY - 6, 6, 8, hair);
      pixelRect(context, 7, headY - 7, 5, 7, hair);
    }
  }

  if (selectedRace === 'dwarf') {
    pixelRect(context, -9, headY + 4, 18, 12, '#7c2d12');
    pixelRect(context, -5, headY + 12, 10, 5, '#9a3412');
    pixelRect(context, -14, headY - 8, 5, 6, hair);
    pixelRect(context, 9, headY - 8, 5, 6, hair);
  }

  if (!isBack) {
    if (isSide) {
      pixelRect(context, 4 * sideSign, headY - 1, 3 * sideSign, 4, '#111827');
      pixelRect(context, 5 * sideSign, headY + 8, 6 * sideSign, 2, '#111827');
    } else {
      pixelRect(context, -6 + Math.round(fx * 2), headY - 1 + Math.round(fy), 3, 4, '#111827');
      pixelRect(context, 4 + Math.round(fx * 2), headY - 1 + Math.round(fy), 3, 4, '#111827');
      pixelRect(context, -3 + Math.round(fx * 2), headY + 8, 7, 2, '#111827');
    }
  }

  const handX = sideX * 20 + fx * 4;
  const handY = sideY * 20 + fy * 4;
  const offHandX = -sideX * 20 + fx * 4;
  const offHandY = -sideY * 20 + fy * 4;

  if (classSprite.weapon === 'staff') {
    const orb = classSprite.glow;
    pixelLine(context, handX, handY, handX + fx * 30 + sideX * 8, handY + fy * 30 + sideY * 8, 4, weapon, 9);
    pixelRect(context, handX + fx * 34 + sideX * 8 - 5, handY + fy * 34 + sideY * 8 - 5, 10, 10, orb);
    pixelRect(context, handX + fx * 37 + sideX * 8 - 2, handY + fy * 37 + sideY * 8 - 2, 4, 4, '#f8fafc');
  } else if (classSprite.weapon === 'bow') {
    pixelLine(context, handX - sideX * 9, handY - sideY * 9, handX + sideX * 9, handY + sideY * 9, 3, '#8d6e45', 8);
    pixelLine(context, handX - sideX * 10, handY - sideY * 10, handX + sideX * 10, handY + sideY * 10, 1, '#f8fafc', 8);
    pixelLine(context, offHandX, offHandY, offHandX + fx * 24, offHandY + fy * 24, 3, '#fde68a', 7);
  } else if (classSprite.weapon === 'daggers') {
    pixelLine(context, handX, handY, handX + fx * 20 + sideX * 5, handY + fy * 20 + sideY * 5, 4, weapon, 7);
    pixelLine(context, offHandX, offHandY, offHandX + fx * 20 - sideX * 5, offHandY + fy * 20 - sideY * 5, 4, weapon, 7);
  } else if (classSprite.weapon === 'hammer-shield') {
    pixelRect(context, offHandX - 8, offHandY - 8, 16, 18, '#facc15');
    pixelRect(context, offHandX - 5, offHandY - 5, 10, 12, '#334155');
    pixelLine(context, handX, handY, handX + fx * 34 + sideX * 9, handY + fy * 34 + sideY * 9, 5, weapon, 8);
    pixelRect(context, handX + fx * 35 + sideX * 9 - 6, handY + fy * 35 + sideY * 9 - 6, 12, 12, '#fef08a');
  } else {
    pixelLine(context, handX, handY, handX + fx * 42 + sideX * 8, handY + fy * 42 + sideY * 8, 5, weapon, 10);
    pixelRect(context, handX + fx * 42 + sideX * 8 - 3, handY + fy * 42 + sideY * 8 - 10, 6, 18, '#f8fafc');
  }

  context.restore();
}

function drawPlayer(context, player, selectedClass, selectedRace, appearance = {}, characterMeta = null) {
  const classConfig = CLASSES[selectedClass];
  const raceConfig = RACES[selectedRace];
  if (!classConfig || !raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return;
  const renderAppearance = {
    ...appearance,
    combatSpec: characterMeta?.talents?.spec ?? appearance.combatSpec ?? null,
  };
  const overlayCharacter = { ...characterMeta, classId: selectedClass, raceId: selectedRace, appearance: renderAppearance };

  if (drawCharacterAssetSprite(context, player, selectedClass, selectedRace, renderAppearance)) {
    if (selectedClass === 'mage') drawMageCastAccent(context, player);
    return;
  }
  // Human classes own complete eight-direction artwork. While a newly chosen
  // gender is loading, drawing the procedural fallback makes the preview flash
  // a different face for one frame before the authored sheet replaces it.
  if (selectedRace === 'human') return;
  drawPixelPlayerSprite(context, player, selectedClass, selectedRace, renderAppearance);
  drawCharacterAttackOverlay(context, player, overlayCharacter);
  return;

  const colors = { ...classConfig.colors, ...appearance };
  const x = player.x;
  const y = player.y;
  const facing = Number.isFinite(player.facing) ? player.facing : 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const sideX = Math.cos(facing + Math.PI / 2);
  const sideY = Math.sin(facing + Math.PI / 2);

  context.save();
  context.translate(x, y);
  context.scale(raceConfig.scale, raceConfig.scale);

  context.fillStyle = 'rgba(0, 0, 0, 0.22)';
  context.beginPath();
  context.ellipse(0, 20, 19, 8, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#1b2834';
  context.lineWidth = 4;
  context.lineCap = 'round';

  const stride = Math.sin(performance.now() / 160 + x * 0.02 + y * 0.01) * 4;
  context.strokeStyle = '#15222b';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(-7, 16);
  context.lineTo(-10 + stride, 30);
  context.moveTo(7, 16);
  context.lineTo(10 - stride, 30);
  context.stroke();
  context.strokeStyle = colors.trim;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-7, 17);
  context.lineTo(-10 + stride, 28);
  context.moveTo(7, 17);
  context.lineTo(10 - stride, 28);
  context.stroke();

  context.strokeStyle = colors.trim;
  context.beginPath();
  context.moveTo(-10 * sideX - 2 * fx, -5 * sideY - 2 * fy);
  context.lineTo(-19 * sideX + 9 * fx, -19 * sideY + 9 * fy);
  context.moveTo(10 * sideX - 2 * fx, 10 * sideY - 2 * fy);
  context.lineTo(19 * sideX + 9 * fx, 19 * sideY + 9 * fy);
  context.stroke();

  context.fillStyle = colors.robe;
  context.strokeStyle = '#14212a';
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(-14, -12, 28, 34, 8);
  context.fill();
  context.stroke();

  if (selectedClass === 'paladin' || selectedClass === 'warrior') {
    context.fillStyle = selectedClass === 'paladin' ? 'rgba(254, 240, 138, 0.45)' : 'rgba(203, 213, 225, 0.38)';
    context.beginPath();
    context.roundRect(-13, -9, 26, 16, 5);
    context.fill();
  }

  if (selectedClass === 'rogue') {
    context.fillStyle = 'rgba(15, 23, 42, 0.48)';
    context.beginPath();
    context.moveTo(-16, -8);
    context.lineTo(0, 25);
    context.lineTo(16, -8);
    context.lineTo(8, 2);
    context.lineTo(-8, 2);
    context.closePath();
    context.fill();
  }

  context.strokeStyle = colors.trim;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(0, 17);
  context.stroke();

  context.fillStyle = appearance.skin ?? raceConfig.skin;
  context.strokeStyle = '#14212a';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, -23, 12, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  if (selectedRace === 'elf') {
    context.fillStyle = appearance.skin ?? raceConfig.skin;
    context.beginPath();
    context.moveTo(-10, -25);
    context.lineTo(-22, -30);
    context.lineTo(-11, -19);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(10, -25);
    context.lineTo(22, -30);
    context.lineTo(11, -19);
    context.closePath();
    context.fill();
  }

  context.fillStyle = appearance.hair ?? (selectedRace === 'human' ? colors.hair : raceConfig.hair);
  context.beginPath();
  context.arc(-2, -29, 11, Math.PI, Math.PI * 2);
  context.fill();

  if (selectedRace === 'dwarf') {
    context.fillStyle = '#7c2d12';
    context.beginPath();
    context.ellipse(0, -14, 9, 8, 0, 0, Math.PI * 2);
    context.fill();
  }

  if (selectedRace === 'orc') {
    context.fillStyle = '#f8fafc';
    context.beginPath();
    context.moveTo(-7, -16);
    context.lineTo(-3, -10);
    context.lineTo(-1, -17);
    context.moveTo(7, -16);
    context.lineTo(3, -10);
    context.lineTo(1, -17);
    context.fill();
  }

  if (selectedRace === 'undead') {
    context.strokeStyle = '#64748b';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-7, -18);
    context.lineTo(7, -18);
    context.moveTo(-5, -12);
    context.lineTo(5, -12);
    context.stroke();
  }

  context.fillStyle = '#101820';
  context.beginPath();
  context.arc(fx * 4 - 4, -23 + fy * 2, 2, 0, Math.PI * 2);
  context.arc(fx * 4 + 4, -23 + fy * 2, 2, 0, Math.PI * 2);
  context.fill();

  if (selectedClass === 'hunter') {
    context.strokeStyle = colors.weapon;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(sideX * 20 + fx * 8, sideY * 20 + fy * 8, 16, -1.1, 1.1);
    context.stroke();
    context.strokeStyle = '#f8fafc';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(sideX * 20 + fx * 8, sideY * 20 + fy * 8 - 15);
    context.lineTo(sideX * 20 + fx * 8, sideY * 20 + fy * 8 + 15);
    context.stroke();
  } else if (selectedClass === 'mage') {
    context.strokeStyle = colors.weapon;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(sideX * 20 - fx * 6, sideY * 20 - fy * 6);
    context.lineTo(sideX * 26 + fx * 22, sideY * 26 + fy * 22);
    context.stroke();
    context.fillStyle = '#67e8f9';
    context.beginPath();
    context.arc(sideX * 26 + fx * 24, sideY * 26 + fy * 24, 5, 0, Math.PI * 2);
    context.fill();
  } else if (selectedClass === 'rogue') {
    context.strokeStyle = colors.weapon;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(sideX * 16 - fx * 2, sideY * 16 - fy * 2);
    context.lineTo(sideX * 27 + fx * 14, sideY * 27 + fy * 14);
    context.moveTo(-sideX * 16 - fx * 2, -sideY * 16 - fy * 2);
    context.lineTo(-sideX * 27 + fx * 14, -sideY * 27 + fy * 14);
    context.stroke();
  } else {
    context.strokeStyle = colors.weapon;
    context.lineWidth = selectedClass === 'warrior' ? 5 : 4;
    context.beginPath();
    context.moveTo(sideX * 18 - fx * 2, sideY * 18 - fy * 2);
    context.lineTo(sideX * 24 + fx * 28, sideY * 24 + fy * 28);
    context.stroke();
  }

  context.restore();
}

const CHARACTER_PREVIEW_DIRECTIONS = {
  front: Math.PI / 2,
  'front-right': Math.PI / 4,
  right: 0,
  'back-right': -Math.PI / 4,
  back: -Math.PI / 2,
  'back-left': -3 * Math.PI / 4,
  left: Math.PI,
  'front-left': 3 * Math.PI / 4,
};
const CHARACTER_PREVIEW_ROTATION = [
  'front',
  'front-right',
  'right',
  'back-right',
  'back',
  'back-left',
  'left',
  'front-left',
];

function CharacterPreview({ character, spriteLoadVersion = 0, showDirectionControls = false }) {
  const previewRef = React.useRef(null);
  const [previewDirection, setPreviewDirection] = React.useState('front');
  const rotatePreview = (offset) => {
    setPreviewDirection((currentDirection) => {
      const currentIndex = CHARACTER_PREVIEW_ROTATION.indexOf(currentDirection);
      const nextIndex = (currentIndex + offset + CHARACTER_PREVIEW_ROTATION.length)
        % CHARACTER_PREVIEW_ROTATION.length;
      return CHARACTER_PREVIEW_ROTATION[nextIndex];
    });
  };

  React.useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !character) return;
    const previewAppearance = {
      ...getMergedDefaultAppearance(character.raceId, character.classId, character.appearance ?? {}),
      combatSpec: character.talents?.spec ?? null,
    };
    let cancelled = false;

    const renderPreview = () => {
      if (cancelled) return;
      const context = canvas.getContext('2d');
      const pixelRatio = window.devicePixelRatio || 1;
      const width = 280;
      const height = 320;
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(139, 233, 253, 0.12)');
      gradient.addColorStop(1, 'rgba(246, 241, 223, 0.06)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.save();
      context.translate(width / 2, 192);
      context.scale(3.25, 3.25);
      drawPlayer(
        context,
        { x: 0, y: 0, facing: CHARACTER_PREVIEW_DIRECTIONS[previewDirection] },
        character.classId,
        character.raceId,
        previewAppearance,
        { ...character, appearance: previewAppearance },
      );
      context.restore();
    };

    renderPreview();
    const layerLoads = [
      loadCharacterLayersForAppearance(character.classId, character.raceId, previewAppearance),
    ];
    if (character.raceId === 'human' && character.classId === 'mage') {
      const alternateGender = previewAppearance.gender === 'female' ? 'male' : 'female';
      layerLoads.push(loadCharacterLayersForAppearance(
        character.classId,
        character.raceId,
        { ...previewAppearance, gender: alternateGender },
      ));
    }
    Promise.all(layerLoads)
      .then(renderPreview)
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [character, previewDirection, spriteLoadVersion]);

  if (!character) {
    return (
      <div className="character-preview empty">
        <span>Select a character</span>
      </div>
    );
  }

  return (
    <div className="character-preview">
      <canvas ref={previewRef} width="280" height="320" />
      {showDirectionControls && (
        <div className="preview-direction-controls" aria-label="Preview direction">
          <button
            aria-label="Rotate character left"
            type="button"
            onClick={() => rotatePreview(-1)}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <span className="preview-direction-label" aria-live="polite">
            <small>Viewing</small>
            <strong>{previewDirection}</strong>
          </span>
          <button
            aria-label="Rotate character right"
            type="button"
            onClick={() => rotatePreview(1)}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
      <div className="preview-copy">
        <strong>{character.name || 'Unnamed'}</strong>
        <span>
          Level {character.level ?? 1} {RACES[character.raceId]?.name} {CLASSES[character.classId]?.name}
        </span>
      </div>
    </div>
  );
}

function drawLocalPlayerMarker(context, player, character) {
  if (!character || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return;

  context.save();
  context.translate(player.x, player.y);

  context.fillStyle = 'rgba(16, 24, 30, 0.78)';
  context.strokeStyle = 'rgba(139, 233, 253, 0.42)';
  context.lineWidth = 1;
  context.fillRect(-70, -78, 140, 34);
  context.strokeRect(-70, -78, 140, 34);

  context.fillStyle = '#f6f1df';
  context.font = '900 12px Inter, Arial';
  context.textAlign = 'center';
  context.fillText(character.name ?? 'You', 0, -64);
  context.fillStyle = '#8be9fd';
  context.font = '800 10px Inter, Arial';
  context.fillText('You', 0, -51);
  context.restore();
}

function drawHealthBar(context, x, y, width, hp, maxHp) {
  const safeMaxHp = Math.max(1, Number(maxHp ?? 1));
  const safeHp = clamp(Number(hp ?? safeMaxHp), 0, safeMaxHp);
  context.fillStyle = 'rgba(15, 23, 42, 0.78)';
  context.fillRect(x, y, width, 5);
  context.fillStyle = '#22c55e';
  context.fillRect(x, y, width * (safeHp / safeMaxHp), 5);
}

function drawRemotePlayerMarker(context, remotePlayer) {
  if (!Number.isFinite(remotePlayer?.x) || !Number.isFinite(remotePlayer?.y)) return;

  context.save();
  context.translate(remotePlayer.x, remotePlayer.y);
  context.fillStyle = 'rgba(16, 24, 30, 0.78)';
  context.strokeStyle = 'rgba(251, 191, 36, 0.42)';
  context.lineWidth = 1;
  context.fillRect(-70, -78, 140, 34);
  context.strokeRect(-70, -78, 140, 34);
  drawHealthBar(context, -60, -42, 120, remotePlayer.hp, remotePlayer.maxHp);
  context.fillStyle = '#f6f1df';
  context.font = '900 12px Inter, Arial';
  context.textAlign = 'center';
  context.fillText(remotePlayer.name ?? 'Adventurer', 0, -64);
  context.fillStyle = '#fbbf24';
  context.font = '800 10px Inter, Arial';
  context.fillText(`Lv ${remotePlayer.level ?? 1}`, 0, -51);
  context.restore();
}

function drawSelectedPlayerRing(context, remotePlayer) {
  if (!Number.isFinite(remotePlayer?.x) || !Number.isFinite(remotePlayer?.y)) return;

  context.save();
  context.translate(remotePlayer.x, remotePlayer.y);
  context.strokeStyle = '#fbbf24';
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(0, 12, 30, 20, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

export {
  isRangedClass,
  hasHunterPet,
  drawCharacterAttackOverlay,
  CHARACTER_SPRITE_FRAMES,
  CLASS_SPRITE_DETAILS,
  getCharacterAnimationFrame,
  getCharacterSpriteDirection,
  getCharacterSpriteColumn,
  getCharacterLayerReplacements,
  applyCharacterLayerReplacements,
  applyHumanMageBodyAppearance,
  drawCharacterSpriteFrame,
  drawCharacterLayeredSprite,
  getCharacterSpriteImage,
  getTintedCharacterSpriteImage,
  drawCharacterAssetSprite,
  drawPixelPlayerSprite,
  drawPlayer,
  CharacterPreview,
  drawLocalPlayerMarker,
  drawHealthBar,
  drawRemotePlayerMarker,
  drawSelectedPlayerRing,
};
