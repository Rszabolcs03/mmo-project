

import {
  clamp,
  isFiniteNumber,
  isFinitePoint,
  safeNumber,
} from '../game/math';

import { sanitizeEffect, distance } from '../game/characterLogic';
import {
  ABILITY_VISUAL_IMAGE_CACHE,
  getAbilityVisualImage,
  preloadAbilityVisual,
} from '../abilityVisuals';

import {
  pixelRect,
  pixelLine,
  drawPixelCross,
  drawPixelRing,
  drawPixelDiamond,
  drawPixelHammer,
  drawPixelShield,
} from './primitives';

function getAbilitySheetFrame(effect, now, frameInfo = {}, loop = false) {
  const frameCount = clamp(Math.floor(safeNumber(frameInfo.frames, 4)), 1, 64);
  if (loop) return Math.floor(now / 110) % frameCount;
  const duration = Math.max(1, safeNumber(effect.duration, 650));
  const progress = clamp((now - safeNumber(effect.start, now)) / duration, 0, 0.999);
  return clamp(Math.floor(progress * frameCount), 0, frameCount - 1);
}

function drawAbilitySheetSprite(context, effect, now, kind, x, y, options = {}) {
  if (!effect?.visual || !isFiniteNumber(x) || !isFiniteNumber(y)) return false;
  const image = getAbilityVisualImage(effect.visual[kind]);
  if (!image) return false;

  const defaultSize = kind === 'projectile' ? 32 : 64;
  const frameInfo = effect.visual.frame?.[kind] ?? {
    width: defaultSize,
    height: defaultSize,
    frames: Math.max(1, Math.floor(image.naturalWidth / defaultSize)),
  };
  const frameWidth = Math.max(1, Math.floor(safeNumber(frameInfo.width, defaultSize)));
  const frameHeight = Math.max(1, Math.floor(safeNumber(frameInfo.height, defaultSize)));
  const frameCount = clamp(
    Math.floor(safeNumber(frameInfo.frames, Math.max(1, Math.floor(image.naturalWidth / frameWidth)))),
    1,
    64,
  );
  const frame = clamp(
    Math.floor(options.frame ?? getAbilitySheetFrame(effect, now, { ...frameInfo, frames: frameCount }, Boolean(options.loop))),
    0,
    frameCount - 1,
  );
  const width = Math.max(1, safeNumber(options.width, safeNumber(options.size, defaultSize)));
  const height = Math.max(1, safeNumber(options.height, safeNumber(options.size, defaultSize)));

  context.save();
  context.translate(x, y);
  if (isFiniteNumber(options.rotation)) context.rotate(options.rotation);
  if (options.alpha != null) context.globalAlpha *= clamp(safeNumber(options.alpha, 1), 0, 1);
  context.drawImage(
    image,
    frame * frameWidth,
    0,
    frameWidth,
    frameHeight,
    Math.round(-width / 2),
    Math.round(-height / 2),
    Math.round(width),
    Math.round(height),
  );
  context.restore();
  return true;
}

function drawAbilitySheetTrail(context, effect, now, kind, from, to, options = {}) {
  if (!isFinitePoint(from) || !isFinitePoint(to)) return false;
  const count = clamp(Math.floor(safeNumber(options.count, 4)), 1, 24);
  const rotation = isFiniteNumber(options.rotation)
    ? options.rotation
    : Math.atan2(to.y - from.y, to.x - from.x);
  let drew = false;

  for (let index = 0; index < count; index += 1) {
    const t = (index + 1) / (count + 1);
    const sizeScale = 1 - t * safeNumber(options.shrink, 0.22);
    const alpha = safeNumber(options.alpha, 0.6) * (0.45 + t * 0.55);
    drew = drawAbilitySheetSprite(context, effect, now, kind, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, {
      ...options,
      rotation,
      size: safeNumber(options.size, kind === 'projectile' ? 32 : 64) * sizeScale,
      alpha,
      loop: options.loop ?? true,
    }) || drew;
  }

  return drew;
}

function drawAbilityAssetEffect(context, effect, now) {
  if (!effect?.visual || effect.type === 'dungeon_aoe' || effect.type === 'dungeon_laser') return false;

  const duration = Math.max(1, safeNumber(effect.duration, 650));
  const progress = clamp((now - safeNumber(effect.start, now)) / duration, 0, 1);
  const facing = safeNumber(effect.facing, 0);
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const sideX = Math.cos(facing + Math.PI / 2);
  const sideY = Math.sin(facing + Math.PI / 2);
  const radius = safeNumber(effect.radius, 96);
  const type = effect.type;
  const effectName = String(effect.name ?? '').toLowerCase();
  const persistentType = ['channel', 'aura', 'ground', 'healGround', 'hot', 'buff'].includes(type);
  const previousAlpha = context.globalAlpha;
  let drew = false;

  if (persistentType) {
    context.globalAlpha = 1;
  }

  const draw = (kind, x, y, options = {}) => {
    drew = drawAbilitySheetSprite(context, effect, now, kind, x, y, options) || drew;
  };
  const trail = (kind, from, to, options = {}) => {
    drew = drawAbilitySheetTrail(context, effect, now, kind, from, to, options) || drew;
  };

  try {
    if (type === 'bolt') {
      const start = { x: effect.x + fx * 18, y: effect.y + fy * 18 };
      const head = { x: effect.x + fx * (42 + progress * 190), y: effect.y + fy * (42 + progress * 190) };
      trail('projectile', start, head, { count: 3, size: 25, alpha: 0.45, rotation: facing, loop: true });
      draw('projectile', head.x, head.y, { size: 42, rotation: facing, loop: true });
      draw('impact', head.x, head.y, { size: 58, alpha: 0.55 });
      return drew;
    }

    if (type === 'shot') {
      const start = { x: effect.x + fx * 18, y: effect.y + fy * 18 };
      const travel = clamp(safeNumber(effect.range, 560), 80, 900);
      const head = { x: effect.x + fx * (28 + progress * travel), y: effect.y + fy * (28 + progress * travel) };
      trail('projectile', start, head, { count: 4, size: 22, alpha: 0.42, rotation: facing, loop: true });
      draw('projectile', head.x, head.y, { size: 36, rotation: facing, loop: true });
      draw('impact', head.x, head.y, { size: 48, alpha: 0.45 });
      return drew;
    }

    if (type === 'channel') {
      const start = { x: effect.x + fx * 18, y: effect.y + fy * 18 };
      const channelLength = clamp(safeNumber(effect.range, 290), 42, 620);
      if (effectName.includes('rapid fire')) {
        for (let arrow = 0; arrow < 7; arrow += 1) {
          const laneOffset = (arrow - 3) * 4;
          const arrowProgress = ((now / 170) + arrow * 0.18) % 1;
          const dist = 30 + arrowProgress * channelLength;
          const ax = effect.x + fx * dist + sideX * laneOffset;
          const ay = effect.y + fy * dist + sideY * laneOffset;
          draw('projectile', ax, ay, { size: 34, rotation: facing, alpha: 0.58 + arrowProgress * 0.38, loop: true });
          trail('projectile', { x: ax - fx * 34, y: ay - fy * 34 }, { x: ax, y: ay }, { count: 2, size: 18, alpha: 0.3, rotation: facing, loop: true });
        }
        return drew;
      }
      const end = { x: effect.x + fx * channelLength, y: effect.y + fy * channelLength };
      const channelSegments = clamp(Math.ceil(channelLength / 20), 4, 18);
      trail('effect', start, end, { count: channelSegments, size: channelLength < 90 ? 34 : 45, alpha: 0.72, rotation: facing, loop: true, shrink: 0.08 });
      draw('projectile', end.x, end.y, { size: channelLength < 90 ? 34 : 42, rotation: facing, alpha: 0.75, loop: true });
      return drew;
    }

    if (type === 'shield' || (type === 'buff' && (effect.absorb || effect.invulnerable || effect.damageReduction))) {
      const pulse = 1 + Math.sin(now / 140) * 0.06;
      const baseSize = type === 'shield'
        ? 78 + progress * 26
        : effect.invulnerable
          ? 108
          : effect.absorb
            ? 98
            : 92;
      const size = baseSize * pulse;
      draw('effect', effect.x, effect.y, { size, alpha: 0.88, loop: true });
      draw('impact', effect.x, effect.y, { size: size * 1.14, alpha: 0.46, loop: true });
      for (let index = 0; index < 3; index += 1) {
        const angle = now / 260 + index * ((Math.PI * 2) / 3);
        draw('projectile', effect.x + Math.cos(angle) * size * 0.35, effect.y + Math.sin(angle) * size * 0.26, {
          size: 28,
          alpha: 0.72,
          rotation: angle + Math.PI / 2,
          loop: true,
        });
      }
      return drew;
    }

    if (type === 'nova' || type === 'shout') {
      const size = 92 + progress * 116;
      draw('impact', effect.x, effect.y, { size, alpha: 0.82 });
      draw('effect', effect.x, effect.y, { size: Math.max(64, size * 0.72), alpha: 0.72, loop: true });
      return drew;
    }

    if (type === 'aura') {
      draw('effect', effect.x, effect.y, { size: radius * 1.65, alpha: 0.7, loop: true });
      draw('impact', effect.x, effect.y, { size: radius * 1.05, alpha: 0.45, loop: true });
      for (let index = 0; index < 4; index += 1) {
        const angle = now / 170 + index * (Math.PI / 2);
        draw('projectile', effect.x + Math.cos(angle) * radius * 0.58, effect.y + Math.sin(angle) * radius * 0.58, {
          size: 45,
          alpha: 0.92,
          rotation: angle + Math.PI / 2,
          loop: true,
        });
      }
      return drew;
    }

    if (type === 'ground' || type === 'healGround') {
      draw('effect', effect.x, effect.y, { size: radius * 2.1, alpha: 0.62, loop: true });
      draw('impact', effect.x, effect.y, { size: radius * 1.25, alpha: 0.5, loop: true });
      return drew;
    }

    if (type === 'hot') {
      draw('effect', effect.x, effect.y - 28, { size: 58, alpha: 0.72, loop: true });
      draw('impact', effect.x, effect.y - 44, { size: 42, alpha: 0.62, loop: true });
      return drew;
    }

    if (type === 'buff') {
      const size = effect.invulnerable ? 104 : effect.absorb ? 94 : effect.damageMultiplier || effect.noCooldowns ? 112 : 82;
      draw('effect', effect.x, effect.y, { size, alpha: 0.82, loop: true });
      draw('impact', effect.x, effect.y - 30, { size: Math.max(44, size * 0.54), alpha: 0.7, loop: true });
      return drew;
    }

    if (type === 'chain') {
      const chainTargets = Array.isArray(effect.chainTargets) ? effect.chainTargets.filter(isFinitePoint) : [];
      if (chainTargets.length > 0) {
        const segmentMs = Math.max(80, safeNumber(effect.segmentMs, 230));
        const elapsed = Math.max(0, now - safeNumber(effect.start, now));
        const points = [{ x: effect.x, y: effect.y }, ...chainTargets];
        const segmentIndex = clamp(Math.floor(elapsed / segmentMs), 0, Math.max(0, points.length - 2));
        const segmentProgress = clamp((elapsed - segmentIndex * segmentMs) / segmentMs, 0, 1);
        const from = points[segmentIndex];
        const to = points[segmentIndex + 1] ?? from;
        const head = { x: from.x + (to.x - from.x) * segmentProgress, y: from.y + (to.y - from.y) * segmentProgress };
        const rotation = Math.atan2(to.y - from.y, to.x - from.x);

        if (effect.petMelee || effectName.includes('pet bite')) {
          const target = chainTargets[0];
          const biteProgress = clamp(elapsed / segmentMs, 0, 1);
          const impactProgress = clamp((elapsed - segmentMs) / 180, 0, 1);
          const biteX = effect.x + (target.x - effect.x) * (0.45 + biteProgress * 0.55);
          const biteY = effect.y + (target.y - effect.y) * (0.45 + biteProgress * 0.55);
          const biteAlpha = 0.42 + biteProgress * 0.34;
          const clawAlpha = impactProgress > 0 ? 1 - impactProgress * 0.55 : biteProgress;

          context.save();
          context.globalAlpha *= biteAlpha;
          pixelLine(context, effect.x, effect.y, biteX, biteY, 10, 'rgba(15, 23, 42, 0.22)', 12);
          pixelLine(context, effect.x + sideX * 5, effect.y + sideY * 5, biteX + sideX * 8, biteY + sideY * 8, 4, '#6b3f16', 10);
          context.restore();

          context.save();
          context.globalAlpha *= clamp(clawAlpha, 0.35, 1);
          for (let index = -1; index <= 1; index += 1) {
            const offset = index * 9;
            const startX = target.x - fx * 22 + sideX * offset;
            const startY = target.y - fy * 22 + sideY * offset;
            const endX = target.x + fx * 18 + sideX * (offset + 5);
            const endY = target.y + fy * 18 + sideY * (offset + 5);
            pixelLine(context, startX, startY, endX, endY, 7, 'rgba(15, 23, 42, 0.34)', 8);
            pixelLine(context, startX, startY, endX, endY, 3, index === 0 ? '#fef3c7' : '#fde68a', 8);
          }
          pixelRect(context, target.x - fx * 6 - 5, target.y - fy * 6 - 5, 10, 10, '#ef4444');
          pixelRect(context, target.x + fx * 10 - 4, target.y + fy * 10 - 4, 8, 8, '#f97316');
          context.restore();
          return true;
        }

        for (let index = 0; index <= segmentIndex; index += 1) {
          const lineStart = points[index];
          const lineEnd = index === segmentIndex ? head : points[index + 1];
          trail('projectile', lineStart, lineEnd, { count: 3, size: 24, alpha: 0.55, rotation: Math.atan2(lineEnd.y - lineStart.y, lineEnd.x - lineStart.x), loop: true });
        }
        draw('projectile', head.x, head.y, { size: 44, rotation, alpha: 0.95, loop: true });
        chainTargets.forEach((target, index) => {
          if (elapsed >= (index + 1) * segmentMs) {
            draw('impact', target.x, target.y, { size: 58, alpha: 0.72, loop: true });
          }
        });
      } else {
        const start = { x: effect.x + fx * 18, y: effect.y + fy * 18 };
        const head = { x: effect.x + fx * (48 + progress * 220), y: effect.y + fy * (48 + progress * 220) };
        trail('projectile', start, head, { count: 4, size: 24, alpha: 0.5, rotation: facing, loop: true });
        draw('projectile', head.x, head.y, { size: 44, rotation: facing, alpha: 0.95, loop: true });
      }
      return drew;
    }

    if (type === 'heal') {
      draw('impact', effect.x, effect.y - 14, { size: 86, alpha: 0.82 });
      draw('effect', effect.x, effect.y - 30, { size: 56, alpha: 0.7, loop: true });
      return drew;
    }

    if (type === 'trap') {
      const trapOffset = safeNumber(effect.trapOffset, 95);
      const trapX = effect.x + fx * trapOffset;
      const trapY = effect.y + fy * trapOffset;
      draw('effect', trapX, trapY, { size: 76, alpha: 0.82, loop: true });
      draw('impact', trapX, trapY, { size: 60, alpha: 0.48, loop: true });
      return drew;
    }

    if (type === 'strike') {
      const hitX = effect.x + fx * 58 + sideX * Math.sin(progress * Math.PI) * 14;
      const hitY = effect.y + fy * 58 + sideY * Math.sin(progress * Math.PI) * 14;
      draw('impact', hitX, hitY, { size: 78, rotation: facing, alpha: 0.85 });
      draw('projectile', hitX - fx * 12, hitY - fy * 12, { size: 38, rotation: facing, alpha: 0.65, loop: true });
      return drew;
    }

    if (type === 'cleave') {
      if (effectName.includes('multishot')) {
        const arrowCount = 7;
        const arc = clamp(safeNumber(effect.arc, 0.55), 0.18, 1.4);
        const travel = clamp(safeNumber(effect.range, 420), 80, 760);
        for (let index = 0; index < arrowCount; index += 1) {
          const amount = arrowCount === 1 ? 0 : index / (arrowCount - 1);
          const angle = facing + (amount - 0.5) * arc;
          const px = Math.cos(angle);
          const py = Math.sin(angle);
          const start = { x: effect.x + px * 22, y: effect.y + py * 22 };
          const dist = 40 + progress * travel;
          const head = { x: effect.x + px * dist, y: effect.y + py * dist };
          trail('projectile', start, head, { count: 2, size: 18, alpha: 0.36, rotation: angle, loop: true });
          draw('projectile', head.x, head.y, { size: 32, rotation: angle, alpha: 0.88, loop: true });
        }
        return drew;
      }
      for (let index = -2; index <= 2; index += 1) {
        const angle = facing + index * 0.32;
        const distanceFromCaster = 56 + progress * 18;
        draw('impact', effect.x + Math.cos(angle) * distanceFromCaster, effect.y + Math.sin(angle) * distanceFromCaster, {
          size: 58,
          rotation: angle,
          alpha: 0.78,
        });
      }
      return drew;
    }

    return false;
  } finally {
    context.globalAlpha = previousAlpha;
  }
}

function drawPixelAbilityEffect(context, effect, now) {
  effect = sanitizeEffect(effect, now);
  if (!effect) return;
  const duration = Math.max(1, effect.duration ?? 320);
  const progress = clamp((now - effect.start) / duration, 0, 1);
  const alpha = 1 - progress;
  const facing = Number.isFinite(effect.facing) ? effect.facing : 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const sideX = Math.cos(facing + Math.PI / 2);
  const sideY = Math.sin(facing + Math.PI / 2);
  const color = effect.color ?? '#8be9fd';
  const light = effect.type === 'heal' ? '#f0fdf4' : '#f8fafc';
  const effectName = String(effect.name ?? '').toLowerCase();
  const isVoid = effectName.includes('void') || effectName.includes('flay') || color === '#4c1d95' || color === '#5b21b6' || color === '#6d28d9';
  const isHoly = effectName.includes('holy') || effectName.includes('angelic') || effectName.includes('sanctified') || effectName.includes('ascended');
  const isPaladin = effectName.includes('crusader') || effectName.includes('hammer') || effectName.includes('consecrated') || effectName.includes('avenger') || effectName.includes('bastion') || effectName.includes('bulwark') || effectName.includes('zealot');
  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;

  context.save();
  context.globalAlpha = Math.max(alpha, 0);
  try {
    if (drawAbilityAssetEffect(context, effect, now)) return;

  if (effect.type === 'bolt') {
    const distance = 42 + progress * 190;
    const beamSize = isHoly ? 7 : isVoid ? 6 : 6;
    pixelLine(context, effect.x + fx * 18, effect.y + fy * 18, effect.x + fx * distance, effect.y + fy * distance, beamSize + 4, 'rgba(15, 23, 42, 0.32)', 12);
    pixelLine(context, effect.x + fx * 18, effect.y + fy * 18, effect.x + fx * distance, effect.y + fy * distance, beamSize, color, 12);
    if (isHoly) {
      pixelLine(context, effect.x + fx * 23, effect.y + fy * 23, effect.x + fx * (distance - 10), effect.y + fy * (distance - 10), 2, '#fff7ed', 11);
    }
    for (let spark = 0; spark < 5; spark += 1) {
      const offset = (spark - 2) * 7;
      const sparkColor = isVoid
        ? (spark % 2 ? '#c084fc' : '#4c1d95')
        : isHoly
          ? (spark % 2 ? '#fef9c3' : '#facc15')
          : (spark % 2 ? light : color);
      pixelRect(
        context,
        effect.x + fx * (distance - spark * 13) + sideX * offset - 4,
        effect.y + fy * (distance - spark * 13) + sideY * offset - 4,
        8,
        8,
        sparkColor,
      );
    }
    if (isVoid) {
      drawPixelDiamond(context, effect.x + fx * distance, effect.y + fy * distance, 16, '#a78bfa');
    }
  }

  if (effect.type === 'shot') {
    const head = 28 + progress * clamp(safeNumber(effect.range, 560), 80, 900);
    pixelLine(context, effect.x + fx * 20, effect.y + fy * 20, effect.x + fx * head, effect.y + fy * head, 4, '#fde68a', 14);
    pixelRect(context, effect.x + fx * head - 5, effect.y + fy * head - 5, 10, 10, color);
    pixelRect(context, effect.x + fx * head + sideX * 8 - 3, effect.y + fy * head + sideY * 8 - 3, 6, 6, light);
    pixelRect(context, effect.x + fx * head - sideX * 8 - 3, effect.y + fy * head - sideY * 8 - 3, 6, 6, light);
  }

  if (effect.type === 'channel') {
    if (effectName.includes('rapid fire')) {
      context.globalAlpha = 0.72 + Math.sin(now / 40) * 0.08;
      const channelLength = clamp(safeNumber(effect.range, 590), 80, 680);
      for (let arrow = 0; arrow < 7; arrow += 1) {
        const arrowProgress = ((now / 160) + arrow * 0.17) % 1;
        const laneOffset = (arrow - 3) * 4;
        const head = 32 + arrowProgress * channelLength;
        const tail = Math.max(20, head - 38);
        pixelLine(
          context,
          effect.x + fx * tail + sideX * laneOffset,
          effect.y + fy * tail + sideY * laneOffset,
          effect.x + fx * head + sideX * laneOffset,
          effect.y + fy * head + sideY * laneOffset,
          3,
          '#fef3c7',
          8,
        );
        pixelRect(context, effect.x + fx * head + sideX * laneOffset - 4, effect.y + fy * head + sideY * laneOffset - 4, 8, 8, '#facc15');
      }
      return;
    }
    context.globalAlpha = 0.5 + Math.sin(now / 55) * 0.18;
    const channelLength = clamp(safeNumber(effect.range, 290), 42, 620);
    const segments = clamp(Math.ceil(channelLength / 17), 4, 17);
    for (let segment = 0; segment < segments; segment += 1) {
      const distance = 18 + segment * (channelLength / Math.max(1, segments - 1));
      const wobble = Math.sin(now / 90 + segment) * 5;
      pixelRect(
        context,
        effect.x + fx * distance + sideX * wobble - 5,
        effect.y + fy * distance + sideY * wobble - 5,
        10,
        10,
        isVoid ? (segment % 2 ? '#7c3aed' : '#2e1065') : (segment % 2 ? color : '#f5d0fe'),
      );
      if (isVoid && segment % 4 === 0) {
        drawPixelDiamond(context, effect.x + fx * distance + sideX * wobble, effect.y + fy * distance + sideY * wobble, 10, '#c4b5fd');
      }
    }
  }

  if (effect.type === 'nova' || effect.type === 'shield' || effect.type === 'shout') {
    const baseRadius = effect.type === 'shield' ? 24 : 30;
    const radius = baseRadius + progress * 98;
    const iconColor = effect.type === 'shout' ? '#fb7185' : color;
    drawPixelRing(context, effect.x, effect.y, radius, iconColor, effect.type === 'shield' ? 28 : 22, effect.type === 'shield' ? 5 : 7, now / 240);
    if (isHoly) {
      drawPixelRing(context, effect.x, effect.y, Math.max(10, radius - 20), '#fef9c3', 18, 5, -now / 220);
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = ray * (Math.PI / 4) + now / 500;
        pixelLine(
          context,
          effect.x + Math.cos(angle) * Math.max(8, radius * 0.35),
          effect.y + Math.sin(angle) * Math.max(8, radius * 0.35),
          effect.x + Math.cos(angle) * radius,
          effect.y + Math.sin(angle) * radius,
          3,
          ray % 2 ? '#facc15' : '#fefce8',
          7,
        );
      }
    }
    if (effect.type === 'shield') {
      drawPixelRing(context, effect.x, effect.y, Math.max(8, radius - 15), '#fef3c7', 18, 4, -now / 280);
    }
  }

  if (effect.type === 'aura') {
    const radius = effect.radius ?? 112;
    context.globalAlpha = 0.72 + Math.sin(now / 80) * 0.12;
    drawPixelRing(context, effect.x, effect.y, radius * 0.72, isPaladin ? '#fde68a' : '#fef3c7', 20, 5, now / 130);
    drawPixelRing(context, effect.x, effect.y, radius * 0.42, isPaladin ? '#facc15' : color, 16, 4, -now / 150);
    for (let hammer = 0; hammer < 4; hammer += 1) {
      const angle = now / 170 + hammer * (Math.PI / 2);
      const hx = effect.x + Math.cos(angle) * radius * 0.58;
      const hy = effect.y + Math.sin(angle) * radius * 0.58;
      drawPixelHammer(context, hx, hy, angle + Math.PI / 2, color);
    }
  }

  if (effect.type === 'ground' || effect.type === 'healGround') {
    const radius = effect.radius ?? 110;
    if (effectName.includes('arrow rain')) {
      context.globalAlpha = 0.72;
      drawPixelRing(context, effect.x, effect.y, radius * 0.82, '#fde68a', 28, 5, now / 260);
      for (let arrow = 0; arrow < 18; arrow += 1) {
        const seed = arrow * 97;
        const angle = (seed % 360) * (Math.PI / 180);
        const lane = ((now / 7 + seed) % (radius * 1.7)) - radius * 0.85;
        const ax = effect.x + Math.cos(angle) * (radius * 0.15 + (seed % 73)) + Math.sin(angle) * lane * 0.28;
        const ay = effect.y - radius * 0.85 + lane;
        pixelLine(context, ax - 8, ay - 18, ax + 7, ay + 14, 3, '#fef3c7', 6);
        pixelRect(context, ax + 4, ay + 10, 7, 7, '#a16207');
      }
      return;
    }
    if (effectName.includes('hailstorm')) {
      context.globalAlpha = 0.68;
      drawPixelRing(context, effect.x, effect.y, radius * 0.78, '#bae6fd', 30, 5, -now / 260);
      for (let shard = 0; shard < 22; shard += 1) {
        const seed = shard * 83;
        const sx = effect.x + ((seed * 17 + now / 5) % (radius * 2) - radius);
        const sy = effect.y + ((seed * 11 + now / 4) % (radius * 2) - radius);
        if (distance({ x: sx, y: sy }, effect) > radius) continue;
        drawPixelDiamond(context, sx, sy, 7 + (shard % 3) * 2, shard % 2 ? '#e0f2fe' : '#7dd3fc');
      }
      return;
    }
    context.globalAlpha = 0.2 + Math.sin(now / 160) * 0.07;
    for (let ring = 0; ring < 4; ring += 1) {
      drawPixelRing(
        context,
        effect.x,
        effect.y,
        radius * (0.35 + ring * 0.17),
        effect.type === 'healGround'
          ? (ring % 2 ? '#fef9c3' : '#facc15')
          : isVoid
            ? (ring % 2 ? '#a78bfa' : '#4c1d95')
            : (ring % 2 ? '#fef3c7' : color),
        24,
        isVoid ? 7 : 6,
        now / (220 + ring * 60),
      );
    }
    context.globalAlpha = 0.5;
    if (isVoid) {
      drawPixelDiamond(context, effect.x, effect.y, 28, '#2e1065');
      drawPixelDiamond(context, effect.x, effect.y, 18, '#a78bfa');
    } else {
      drawPixelCross(context, effect.x, effect.y, effect.type === 'healGround' ? 14 : 12, effect.type === 'healGround' ? '#fef08a' : '#f8fafc');
      if (isPaladin || effect.type === 'healGround') {
        drawPixelRing(context, effect.x, effect.y, radius * 0.18, '#fff7ed', 12, 4, -now / 160);
      }
    }
  }

  if (effect.type === 'hot') {
    const radius = 20 + Math.sin(now / 140) * 4;
    context.globalAlpha = 0.34 + Math.sin(now / 110) * 0.08;
    drawPixelRing(context, effect.x, effect.y - 26, radius, color, 14, 4, now / 180);
    drawPixelCross(context, effect.x, effect.y - 42, 6, '#fef9c3');
    for (let spark = 0; spark < 4; spark += 1) {
      const angle = now / 220 + spark * (Math.PI / 2);
      pixelRect(context, effect.x + Math.cos(angle) * 22 - 3, effect.y - 28 + Math.sin(angle) * 14 - 3, 6, 6, color);
    }
  }

  if (effect.type === 'buff') {
    const radius = 28 + Math.sin(now / 130) * 4;
    context.globalAlpha = Math.max(0.28, alpha);
    drawPixelRing(context, effect.x, effect.y, radius, color, 22, 5, now / 210);
    if (effect.invulnerable) {
      drawPixelRing(context, effect.x, effect.y, radius + 16, isVoid ? '#c4b5fd' : '#dbeafe', 26, 5, -now / 180);
      if (effectName.includes('fade')) {
        context.globalAlpha = 0.36 + Math.sin(now / 75) * 0.12;
        drawPixelDiamond(context, effect.x, effect.y - 34, 18, '#c4b5fd');
        drawPixelRing(context, effect.x, effect.y, radius + 28, '#7c3aed', 18, 4, now / 120);
      }
    }
    if (effect.damageMultiplier) {
      drawPixelRing(context, effect.x, effect.y, radius + 12, '#fde68a', 24, 6, -now / 170);
      if (isVoid) {
        drawPixelRing(context, effect.x, effect.y, radius + 24, '#6d28d9', 20, 5, now / 150);
      } else {
        for (let ray = 0; ray < 6; ray += 1) {
          const angle = ray * (Math.PI / 3) + now / 420;
          pixelLine(context, effect.x, effect.y, effect.x + Math.cos(angle) * (radius + 34), effect.y + Math.sin(angle) * (radius + 34), 3, '#fef9c3', 8);
        }
      }
    }
    if (effect.noCooldowns || effectName.includes('ascended')) {
      drawPixelRing(context, effect.x, effect.y, radius + 25, '#fef08a', 32, 6, -now / 110);
      drawPixelCross(context, effect.x, effect.y - 42, 9, '#fff7ed');
    }
    if (effect.absorb) {
      drawPixelRing(context, effect.x, effect.y, radius + 10, isVoid ? '#8b5cf6' : '#bfdbfe', 20, 5, -now / 190);
      drawPixelShield(context, effect.x, effect.y - 38, isVoid ? '#7c3aed' : '#facc15');
    }
  }

  if (effect.type === 'chain') {
    const chainTargets = Array.isArray(effect.chainTargets) ? effect.chainTargets : [];
    if (chainTargets.length > 0) {
      const segmentMs = Math.max(80, effect.segmentMs ?? 230);
      const elapsed = Math.max(0, now - effect.start);
      const points = [{ x: effect.x, y: effect.y }, ...chainTargets];
      const maxSegment = Math.max(0, points.length - 2);
      const segmentIndex = clamp(Math.floor(elapsed / segmentMs), 0, maxSegment);
      const segmentProgress = clamp((elapsed - segmentIndex * segmentMs) / segmentMs, 0, 1);
      const from = points[segmentIndex];
      const to = points[segmentIndex + 1] ?? from;
      const sx = from.x + (to.x - from.x) * segmentProgress;
      const sy = from.y + (to.y - from.y) * segmentProgress;

      for (let index = 0; index < points.length - 1; index += 1) {
        if (index > segmentIndex) break;
        const lineStart = points[index];
        const lineEnd = index === segmentIndex ? { x: sx, y: sy } : points[index + 1];
        pixelLine(context, lineStart.x, lineStart.y, lineEnd.x, lineEnd.y, 4, '#fef3c7', 14);
        pixelLine(context, lineStart.x, lineStart.y, lineEnd.x, lineEnd.y, 2, '#facc15', 14);
      }

      chainTargets.forEach((target, index) => {
        if (elapsed >= (index + 1) * segmentMs) {
          drawPixelRing(context, target.x, target.y, 20 + Math.sin(now / 90) * 3, '#fde68a', 14, 4, now / 100);
        }
      });
      drawPixelRing(context, sx, sy, 18 + Math.sin(now / 80) * 3, '#facc15', 14, 4, now / 100);
      drawPixelShield(context, sx, sy, '#facc15');
    } else {
      const distance = 48 + progress * 220;
      const sx = effect.x + fx * distance;
      const sy = effect.y + fy * distance;
      pixelLine(context, effect.x + fx * 18, effect.y + fy * 18, sx, sy, 3, '#fef3c7', 18);
      drawPixelRing(context, sx, sy, 22 + Math.sin(now / 90) * 3, '#facc15', 14, 4, now / 100);
      drawPixelShield(context, sx, sy, '#facc15');
    }
  }

  if (effect.type === 'heal') {
    const radius = 18 + progress * 55;
    drawPixelRing(context, effect.x, effect.y, radius, '#86efac', 16, 6, now / 180);
    drawPixelCross(context, effect.x, effect.y - 36 - progress * 18, 7, color);
    for (let spark = 0; spark < 6; spark += 1) {
      pixelRect(
        context,
        effect.x + Math.cos(spark) * (12 + spark * 4) - 3,
        effect.y - progress * 45 + Math.sin(spark * 1.7) * 18 - 3,
        6,
        6,
        spark % 2 ? '#f0fdf4' : color,
      );
    }
  }

  if (effect.type === 'trap') {
    const trapOffset = safeNumber(effect.trapOffset, 95);
    const trapX = effect.x + fx * trapOffset;
    const trapY = effect.y + fy * trapOffset;
    const pulse = 28 + Math.sin(now / 90) * 4;
    pixelRect(context, trapX - 18, trapY - 18, 36, 4, color);
    pixelRect(context, trapX - 18, trapY + 14, 36, 4, color);
    pixelRect(context, trapX - 18, trapY - 18, 4, 36, color);
    pixelRect(context, trapX + 14, trapY - 18, 4, 36, color);
    drawPixelRing(context, trapX, trapY, pulse, '#f5d0fe', 12, 4, now / 150);
  }

  if (effect.type === 'strike') {
    for (let slash = 0; slash < 9; slash += 1) {
      const distance = 20 + slash * 9;
      const width = 9 - slash * 0.35;
      pixelRect(
        context,
        effect.x + fx * distance + sideX * (slash - 4) * 7 - width / 2,
        effect.y + fy * distance + sideY * (slash - 4) * 7 - width / 2,
        width,
        width,
        slash % 2 ? light : color,
      );
    }
  }

  if (effect.type === 'cleave') {
    if (effectName.includes('multishot')) {
      const arrowCount = 7;
      const arc = clamp(safeNumber(effect.arc, 0.55), 0.18, 1.4);
      const travel = clamp(safeNumber(effect.range, 420), 80, 760);
      for (let arrow = 0; arrow < arrowCount; arrow += 1) {
        const amount = arrowCount === 1 ? 0 : arrow / (arrowCount - 1);
        const angle = facing + (amount - 0.5) * arc;
        const ax = Math.cos(angle);
        const ay = Math.sin(angle);
        const head = 36 + progress * travel;
        pixelLine(context, effect.x + ax * 22, effect.y + ay * 22, effect.x + ax * head, effect.y + ay * head, 3, '#fef3c7', 12);
        pixelRect(context, effect.x + ax * head - 4, effect.y + ay * head - 4, 8, 8, arrow % 2 ? '#facc15' : color);
      }
      return;
    }
    for (let slash = -8; slash <= 8; slash += 1) {
      const angle = facing + slash * 0.115;
      const radius = 48 + progress * 18;
      pixelRect(
        context,
        effect.x + Math.cos(angle) * radius - 5,
        effect.y + Math.sin(angle) * radius - 5,
        10,
        10,
        slash % 2 ? color : light,
      );
    }
  }

  if (effect.type === 'dungeon_aoe') {
    const radius = effect.radius ?? 90;
    context.globalAlpha = 0.18 + alpha * 0.26;
    for (let ring = 0; ring < 3; ring += 1) {
      drawPixelRing(context, effect.x, effect.y, radius * (0.45 + ring * 0.22 + progress * 0.08), effect.color ?? '#ef4444', 22 + ring * 6, 9, now / (220 + ring * 80));
    }
  }

  if (effect.type === 'dungeon_laser') {
    const length = effect.length ?? 520;
    const width = effect.width ?? 42;
    context.globalAlpha = 0.22 + alpha * 0.42;
    for (let index = 0; index <= 32; index += 1) {
      const distance = 24 + (length / 32) * index;
      pixelRect(
        context,
        effect.x + fx * distance - width / 2 * Math.abs(sideX) - 4,
        effect.y + fy * distance - width / 2 * Math.abs(sideY) - 4,
        Math.max(8, Math.abs(sideX) * width + 8),
        Math.max(8, Math.abs(sideY) * width + 8),
        index % 2 ? effect.color ?? '#f43f5e' : '#ffe4e6',
      );
    }
  }

  } finally {
    context.restore();
    context.imageSmoothingEnabled = previousSmoothing;
  }
}

export {
  ABILITY_VISUAL_IMAGE_CACHE,
  getAbilityVisualImage,
  preloadAbilityVisual,
  getAbilitySheetFrame,
  drawAbilitySheetSprite,
  drawAbilitySheetTrail,
  drawAbilityAssetEffect,
  drawPixelAbilityEffect,
};
