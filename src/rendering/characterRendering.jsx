import React from 'react';

import { clamp } from '../game/math';

import {
  RACES,
  CLASSES,
  CHARACTER_SPRITE_SIZE,
  CHARACTER_SPRITE_DRAW_SIZE,
  CHARACTER_SPRITE_EXPECTED_WIDTH,
  CHARACTER_SPRITE_EXPECTED_HEIGHT,
  CHARACTER_SPRITE_ROWS,
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
  getCharacterLayerSelection,
  getCharacterLayerImage,
} from '../game/mapAssets';
import { getMergedDefaultAppearance } from '../game/worldEntities';
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
  const facing = Number.isFinite(player?.facing) ? player.facing : 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  if (Math.abs(fy) > Math.abs(fx)) return fy < 0 ? 'up' : 'down';
  return fx < 0 ? 'left' : 'right';
}

function getCharacterSpriteColumn(player) {
  const attack = player?.attack;
  const now = performance.now();
  if (attack && Number.isFinite(attack.startedAt) && Number.isFinite(attack.until) && now <= attack.until) {
    const duration = Math.max(1, attack.until - attack.startedAt);
    const progress = clamp((now - attack.startedAt) / duration, 0, 1);
    return 4 + (progress > 0.5 ? 1 : 0);
  }
  const moving = Math.abs(player?.vx ?? 0) + Math.abs(player?.vy ?? 0) > 0.05;
  if (!moving) return 0;
  const walkFrame = Math.floor(performance.now() / 120) % 3;
  return walkFrame + 1;
}

function drawCharacterSpriteFrame(context, image, player, selectedRace, row, column) {
  const raceConfig = RACES[selectedRace];
  if (!image || !raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return false;

  const size = CHARACTER_SPRITE_DRAW_SIZE * raceConfig.scale * (selectedRace === 'dwarf' ? 0.96 : selectedRace === 'orc' ? 1.06 : 1);
  context.drawImage(
    image,
    column * CHARACTER_SPRITE_SIZE,
    row * CHARACTER_SPRITE_SIZE,
    CHARACTER_SPRITE_SIZE,
    CHARACTER_SPRITE_SIZE,
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
  const baseLayer = getCharacterLayerImage('base', selection.base);
  const outfitLayer = getCharacterLayerImage('outfit', selection.outfit);
  if (!baseLayer || !outfitLayer) return false;

  const direction = getCharacterSpriteDirection(player);
  const row = CHARACTER_SPRITE_ROWS[direction] ?? CHARACTER_SPRITE_ROWS.down;
  const column = getCharacterSpriteColumn(player);

  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;
  for (const layer of CHARACTER_LAYER_ORDER) {
    const layerImage = getCharacterLayerImage(layer, selection[layer]);
    if (layerImage) drawCharacterSpriteFrame(context, layerImage, player, selectedRace, row, column);
  }
  context.imageSmoothingEnabled = previousSmoothing;
  return true;
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

  const sprite = getCharacterSpriteImage(selectedClass, appearance);
  const raceConfig = RACES[selectedRace];
  if (!sprite?.image || !raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return false;

  const direction = getCharacterSpriteDirection(player);
  const row = CHARACTER_SPRITE_ROWS[direction] ?? CHARACTER_SPRITE_ROWS.down;
  const column = getCharacterSpriteColumn(player);
  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;
  const image = getTintedCharacterSpriteImage(sprite.image, sprite.spriteId, selectedClass, appearance);
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
  const overlayCharacter = { ...characterMeta, classId: selectedClass, raceId: selectedRace, appearance };

  if (drawCharacterAssetSprite(context, player, selectedClass, selectedRace, appearance)) {
    return;
  }
  drawPixelPlayerSprite(context, player, selectedClass, selectedRace, appearance);
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

function CharacterPreview({ character, spriteLoadVersion = 0 }) {
  const previewRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !character) return;
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
    context.translate(width / 2, 190);
    context.scale(2.65, 2.65);
    const previewAppearance = getMergedDefaultAppearance(character.raceId, character.classId, character.appearance ?? {});
    drawPlayer(
      context,
      { x: 0, y: 0, facing: Math.PI / 2 },
      character.classId,
      character.raceId,
      previewAppearance,
      { ...character, appearance: previewAppearance },
    );
    context.restore();
  }, [character, spriteLoadVersion]);

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
