

import { clamp, isFinitePoint, safeNumber } from '../game/math';

import { ENEMY, ENEMY_SPRITE_CONFIG, PET_SPRITE_CONFIG, WORLD_BOSS_MECHANICS } from '../game/gameData';

import { getPetSpriteImage, getEnemySpriteId, getEnemySpriteImage } from '../game/mapAssets';
import { getEnemyKindName } from '../game/worldEntities';

import { pixelRect, pixelLine, drawPixelRing } from './primitives';

const ENEMY_SPRITE_FACING = new globalThis.Map();

function getEnemySpriteFacing(enemy) {
  const key = String(enemy?.id ?? enemy?.spawnId ?? enemy?.slotIndex ?? 'enemy');
  const x = safeNumber(enemy?.x, enemy?.targetX);
  const y = safeNumber(enemy?.y, enemy?.targetY);
  const previous = ENEMY_SPRITE_FACING.get(key);
  const seenAt = performance.now();
  let flip = previous?.flip ?? (Math.cos(safeNumber(enemy?.facing, 0)) < -0.1 ? -1 : 1);
  let direction = previous?.direction ?? 'down';
  let movingUntil = previous?.movingUntil ?? 0;
  let deltaX = 0;
  let deltaY = 0;

  if (previous && Number.isFinite(x) && Number.isFinite(y)) {
    deltaX = x - previous.x;
    deltaY = y - previous.y;
  } else if (Number.isFinite(x) && Number.isFinite(y)) {
    deltaX = safeNumber(enemy?.targetX, x) - x;
    deltaY = safeNumber(enemy?.targetY, y) - y;
  }

  if (Math.abs(deltaX) > 0.02 || Math.abs(deltaY) > 0.02) {
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX < 0 ? 'left' : 'right';
    } else {
      direction = deltaY < 0 ? 'up' : 'down';
    }
    flip = deltaX < -0.02 ? -1 : deltaX > 0.02 ? 1 : flip;
    movingUntil = seenAt + 190;
  } else if (seenAt < safeNumber(enemy?.attackUntil, 0)) {
    const mechanicProjectiles = Array.isArray(enemy?.mechanicProjectiles) ? enemy.mechanicProjectiles : [];
    const aimedProjectile = mechanicProjectiles[Math.floor(mechanicProjectiles.length / 2)];
    const aimX = enemy?.attackType === 'water-bolt'
      ? safeNumber(enemy?.attackTargetX, enemy?.targetX)
      : safeNumber(aimedProjectile?.targetX, enemy?.targetX);
    const aimY = enemy?.attackType === 'water-bolt'
      ? safeNumber(enemy?.attackTargetY, enemy?.targetY)
      : safeNumber(aimedProjectile?.targetY, enemy?.targetY);
    const aimDeltaX = aimX - x;
    const aimDeltaY = aimY - y;
    if (Math.abs(aimDeltaX) > Math.abs(aimDeltaY)) direction = aimDeltaX < 0 ? 'left' : 'right';
    else if (Math.abs(aimDeltaY) > 0.02) direction = aimDeltaY < 0 ? 'up' : 'down';
    flip = aimDeltaX < -0.02 ? -1 : aimDeltaX > 0.02 ? 1 : flip;
  } else if (!previous) {
    const facing = safeNumber(enemy?.facing, 0);
    const facingX = Math.cos(facing);
    const facingY = Math.sin(facing);
    if (Math.abs(facingX) > Math.abs(facingY)) direction = facingX < 0 ? 'left' : 'right';
    else direction = facingY < 0 ? 'up' : 'down';
  }

  const state = { x, y, flip, direction, movingUntil, seenAt };
  ENEMY_SPRITE_FACING.set(key, state);
  if (ENEMY_SPRITE_FACING.size > 512) {
    for (const [entryKey, entry] of ENEMY_SPRITE_FACING) {
      if (seenAt - entry.seenAt > 30000) ENEMY_SPRITE_FACING.delete(entryKey);
    }
  }
  return { direction, flip, moving: seenAt < movingUntil };
}

function getRenderedBossProjectilePoint(projectile, now) {
  const launchAt = safeNumber(projectile?.launchAt, 0);
  const impactAt = Math.max(launchAt + 1, safeNumber(projectile?.impactAt, launchAt + 1));
  const progress = clamp((now - launchAt) / (impactAt - launchAt), 0, 1);
  return {
    x: safeNumber(projectile?.originX, 0) + (safeNumber(projectile?.targetX, 0) - safeNumber(projectile?.originX, 0)) * progress,
    y: safeNumber(projectile?.originY, 0) + (safeNumber(projectile?.targetY, 0) - safeNumber(projectile?.originY, 0)) * progress,
  };
}

function drawBossProjectile(context, enemy, projectile, now, type) {
  const originX = safeNumber(projectile?.originX, enemy.x) - safeNumber(enemy?.x, 0);
  const originY = safeNumber(projectile?.originY, enemy.y) - safeNumber(enemy?.y, 0);
  const targetX = safeNumber(projectile?.targetX, enemy.x) - safeNumber(enemy?.x, 0);
  const targetY = safeNumber(projectile?.targetY, enemy.y) - safeNumber(enemy?.y, 0);
  const launchAt = safeNumber(projectile?.launchAt, 0);
  const impactAt = safeNumber(projectile?.impactAt, launchAt);
  const isBoulder = type === 'boulder-toss';
  const dangerRadius = isBoulder
    ? clamp(safeNumber(projectile?.radius, 42) + 18, 36, 72)
    : 25;

  if (now < launchAt) {
    const startedAt = type === 'water-bolt'
      ? safeNumber(enemy?.attackStartedAt, now)
      : safeNumber(enemy?.mechanicStartedAt, now);
    const charge = clamp((now - startedAt) / Math.max(1, launchAt - startedAt), 0, 1);
    pixelLine(
      context,
      originX,
      originY,
      targetX,
      targetY,
      isBoulder ? 5 : 4,
      isBoulder ? `rgba(146, 98, 55, ${0.28 + charge * 0.34})` : `rgba(103, 232, 249, ${0.28 + charge * 0.36})`,
      isBoulder ? 12 : 16,
    );
    drawPixelRing(
      context,
      targetX,
      targetY,
      dangerRadius,
      isBoulder ? `rgba(251, 191, 36, ${0.5 + charge * 0.3})` : `rgba(165, 243, 252, ${0.5 + charge * 0.3})`,
      isBoulder ? 14 : 12,
      isBoulder ? 6 : 5,
      0,
    );
    return;
  }
  if (now > impactAt) {
    if (isBoulder && now < impactAt + 300) {
      const impactFade = 1 - clamp((now - impactAt) / 300, 0, 1);
      drawPixelRing(
        context,
        targetX,
        targetY,
        dangerRadius * (0.72 + (1 - impactFade) * 0.28),
        `rgba(120, 83, 48, ${0.72 * impactFade})`,
        16,
        8,
        0,
      );
      for (let index = 0; index < 6; index += 1) {
        const angle = index * Math.PI / 3 + 0.25;
        const dustDistance = dangerRadius * (0.28 + (1 - impactFade) * 0.46);
        pixelRect(
          context,
          targetX + Math.cos(angle) * dustDistance - 5,
          targetY + Math.sin(angle) * dustDistance - 5,
          10,
          10,
          `rgba(146, 98, 55, ${0.52 * impactFade})`,
        );
      }
    }
    return;
  }

  const point = getRenderedBossProjectilePoint(projectile, now);
  const x = point.x - safeNumber(enemy?.x, 0);
  const y = point.y - safeNumber(enemy?.y, 0);
  const angle = Math.atan2(targetY - originY, targetX - originX);
  const trailX = Math.cos(angle);
  const trailY = Math.sin(angle);
  if (isBoulder) {
    pixelRect(context, x - 21, y - 17, 42, 34, '#2f2924');
    pixelRect(context, x - 14, y - 22, 24, 8, '#493c31');
    pixelRect(context, x - 12, y - 11, 18, 15, '#6b5844');
    pixelRect(context, x + 7, y + 4, 9, 9, '#8a7358');
    pixelRect(context, x - trailX * 32 - 7, y - trailY * 32 - 7, 14, 14, 'rgba(120, 83, 48, 0.45)');
  } else {
    pixelRect(context, x - 12, y - 8, 24, 16, '#083344');
    pixelRect(context, x - 8, y - 6, 17, 12, '#0891b2');
    pixelRect(context, x - 4, y - 4, 10, 8, '#67e8f9');
    pixelRect(context, x - 2, y - 4, 5, 4, '#ecfeff');
    pixelRect(context, x - trailX * 22 - 6, y - trailY * 22 - 4, 12, 8, 'rgba(34, 211, 238, 0.48)');
    pixelRect(context, x - trailX * 38 - 4, y - trailY * 38 - 3, 8, 6, 'rgba(103, 232, 249, 0.3)');
  }
}

function drawWorldBossRangedAttack(context, enemy, now) {
  if (enemy?.attackType !== 'water-bolt' || enemy?.attackResolved || now >= safeNumber(enemy?.attackUntil, 0)) return;
  drawBossProjectile(context, enemy, {
    originX: enemy.attackOriginX,
    originY: enemy.attackOriginY,
    targetX: enemy.attackTargetX,
    targetY: enemy.attackTargetY,
    launchAt: enemy.attackLaunchAt,
    impactAt: enemy.attackImpactAt,
  }, now, 'water-bolt');
}

function drawWorldBossMechanicTelegraph(context, enemy, now) {
  const mechanicType = String(enemy?.mechanicType ?? '');
  const mechanicStartedAt = safeNumber(enemy?.mechanicStartedAt, 0);
  const mechanicImpactAt = safeNumber(enemy?.mechanicImpactAt, 0);
  const mechanicUntil = safeNumber(enemy?.mechanicUntil, 0);
  if (!mechanicType || now < mechanicStartedAt || now >= mechanicUntil) return;

  context.save();
  context.imageSmoothingEnabled = false;

  const projectiles = Array.isArray(enemy?.mechanicProjectiles) ? enemy.mechanicProjectiles : [];
  if ((mechanicType === 'tidal-volley' || mechanicType === 'boulder-toss') && projectiles.length > 0) {
    projectiles.forEach((projectile) => drawBossProjectile(context, enemy, projectile, now, mechanicType));
    context.restore();
    return;
  }

  const spriteId = getEnemySpriteId(enemy);
  const mechanicConfig = WORLD_BOSS_MECHANICS[spriteId];
  const radius = clamp(enemy?.mechanicRadius ?? mechanicConfig?.radius ?? 160, 48, 320);
  const charging = now < mechanicImpactAt;
  const chargeProgress = charging
    ? clamp((now - mechanicStartedAt) / Math.max(1, mechanicImpactAt - mechanicStartedAt), 0, 1)
    : 1;
  const recoveryAlpha = charging
    ? 1
    : 1 - clamp((now - mechanicImpactAt) / Math.max(1, mechanicUntil - mechanicImpactAt), 0, 1);

  if (mechanicType === 'ground-slam') {
    const pulse = Math.floor(now / 110) % 2;
    drawPixelRing(
      context,
      0,
      0,
      radius,
      `rgba(253, 186, 116, ${(0.58 + chargeProgress * 0.28) * recoveryAlpha})`,
      32,
      8 + pulse * 3,
      Math.PI / 32,
    );
    drawPixelRing(
      context,
      0,
      0,
      radius * (0.24 + chargeProgress * 0.5),
      `rgba(180, 83, 9, ${0.58 * recoveryAlpha})`,
      20,
      7,
      0,
    );
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4 + 0.2;
      const inner = radius * 0.18;
      const outer = radius * (0.32 + chargeProgress * 0.58);
      pixelLine(
        context,
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        Math.cos(angle) * outer,
        Math.sin(angle) * outer,
        6,
        `rgba(120, 53, 15, ${0.62 * recoveryAlpha})`,
        7,
      );
    }
  }

  context.restore();
}

function drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp) {
  const spriteId = getEnemySpriteId(enemy);
  const spriteConfig = ENEMY_SPRITE_CONFIG[spriteId];
  const labelKind = enemy?.enemyKind ?? enemy?.bossType ?? enemy?.questKind ?? spriteId;
  const labelName = getEnemyKindName(labelKind);
  const enemyName = !enemy?.name || (enemy.name === 'Wolf' && String(labelKind ?? '').toLowerCase() !== 'wolf')
    ? labelName
    : enemy.name;
  const barWidth = spriteConfig
    ? clamp(Math.round((spriteConfig.drawWidth ?? 64) * (isBoss ? 0.64 : 0.68)), isBoss ? 92 : 52, isBoss ? 130 : 86)
    : isBoss ? 92 : 42;
  const barHeight = isBoss ? 8 : 5;
  const bossLabelOffset = enemy.type === 'boss' ? 124 : radius + 24;
  const barY = spriteConfig ? spriteConfig.yOffset - (isBoss ? 14 : 12) : isBoss ? -bossLabelOffset : -radius - 15;
  const frozen = !isBoss && performance.now() < (enemy.frozenUntil ?? 0);

  if (frozen) {
    context.fillStyle = 'rgba(186, 230, 253, 0.34)';
    context.fillRect(-radius - 10, -radius - 14, radius * 2 + 20, radius * 2 + 28);
    context.strokeStyle = 'rgba(240, 249, 255, 0.78)';
    context.lineWidth = 3;
    context.strokeRect(-radius - 10, -radius - 14, radius * 2 + 20, radius * 2 + 28);
  }

  context.fillStyle = '#111827';
  context.fillRect(-barWidth / 2, barY, barWidth, barHeight);
  context.fillStyle = enemy.state === 'aggro' ? '#ef4444' : '#22c55e';
  context.fillRect(-barWidth / 2, barY, barWidth * (hp / Math.max(1, maxHp)), barHeight);

  context.fillStyle = isBoss ? '#f6f1df' : '#cbd5e1';
  context.font = isBoss ? '900 13px Inter, Arial' : '900 12px Inter, Arial';
  context.textAlign = 'center';
  context.fillText(enemyName, 0, isBoss ? barY - 10 : barY - 8);
}

function drawPixelWolf(context, radius, pulse, walk, bodyColor, outline, recentlyHit) {
  pixelRect(context, -radius - 16, 6 + pulse, radius * 2 + 24, 13, 'rgba(0, 0, 0, 0.22)');
  pixelRect(context, -radius - 8, -9 + pulse, radius * 2 + 12, 23, outline);
  pixelRect(context, -radius - 4, -6 + pulse, radius * 2 + 7, 17, bodyColor);
  pixelRect(context, radius - 3, -16 + pulse, 21, 21, outline);
  pixelRect(context, radius + 1, -13 + pulse, 15, 15, recentlyHit ? '#fecaca' : '#475569');
  pixelRect(context, radius, -24 + pulse, 7, 10, outline);
  pixelRect(context, radius + 10, -25 + pulse, 7, 11, outline);
  pixelRect(context, radius + 2, -23 + pulse, 4, 8, bodyColor);
  pixelRect(context, radius + 11, -23 + pulse, 4, 8, bodyColor);
  pixelRect(context, radius + 4, -8 + pulse, 4, 4, '#e0e7ff');
  pixelRect(context, radius + 13, -8 + pulse, 4, 4, '#e0e7ff');
  pixelRect(context, radius + 6, 2 + pulse, 10, 3, '#111827');
  pixelRect(context, -radius - 13, -5 + pulse, 14, 6, outline);
  pixelLine(context, -radius - 10, -4 + pulse, -radius - 28, -11 + pulse, 5, bodyColor, 4);
  pixelRect(context, -radius + 1, 8 + pulse, 6, 15 + walk, outline);
  pixelRect(context, 7, 8 + pulse, 6, 15 - walk, outline);
  pixelRect(context, -radius + 2, 8 + pulse, 3, 12 + walk, bodyColor);
  pixelRect(context, 8, 8 + pulse, 3, 12 - walk, bodyColor);
}

function drawHunterPet(context, pet, owner, now, character = null) {
  if (!pet || !isFinitePoint(pet)) return;
  const walk = Number.isFinite(pet.walk) ? pet.walk : now / 260;
  const facing = safeNumber(pet.facing, owner?.facing ?? 0);
  const flip = Math.cos(facing) < -0.1 ? -1 : 1;
  const leg = Math.sin(walk * 8) * 2;
  const bob = Math.sin(walk * 4) * 1.2;
  const raceId = character?.raceId ?? owner?.raceId ?? 'human';
  const petSprite = getPetSpriteImage(raceId);
  const petConfig = PET_SPRITE_CONFIG[raceId] ?? PET_SPRITE_CONFIG.human;

  if (petSprite && petSprite.complete && petSprite.naturalWidth) {
    const attacking = Number.isFinite(pet.attackUntil) && now < pet.attackUntil;
    const moving = Boolean(pet.moving) || Math.abs(safeNumber(pet.vx, 0)) + Math.abs(safeNumber(pet.vy, 0)) > 1;
    const frame = attacking
      ? 4 + Math.floor(clamp((now - safeNumber(pet.attackStartedAt, now)) / Math.max(1, safeNumber(pet.attackUntil, now) - safeNumber(pet.attackStartedAt, now)), 0, 0.999) * 2)
      : moving
        ? 2 + (Math.floor(now / 130) % 2)
        : Math.floor(now / 420) % 2;
    const sx = frame * petConfig.frameWidth;
    context.save();
    context.translate(pet.x, pet.y + bob);
    context.scale(flip, 1);
    context.imageSmoothingEnabled = false;
    context.drawImage(
      petSprite,
      sx,
      0,
      petConfig.frameWidth,
      petConfig.frameHeight,
      -petConfig.drawWidth / 2,
      petConfig.yOffset,
      petConfig.drawWidth,
      petConfig.drawHeight,
    );
    context.restore();
    return;
  }

  context.save();
  context.translate(pet.x, pet.y + bob);
  context.scale(flip, 1);
  context.imageSmoothingEnabled = false;
  context.fillStyle = 'rgba(0, 0, 0, 0.28)';
  context.beginPath();
  context.ellipse(0, 18, 24, 8, 0, 0, Math.PI * 2);
  context.fill();

  const petPalettes = {
    human: { body: '#6b7280', shade: '#374151', trim: '#d6b15f', eye: '#dbeafe' },
    elf: { body: '#355e3b', shade: '#1f3d2a', trim: '#a7f3d0', eye: '#f0fdf4' },
    dwarf: { body: '#8a5a3c', shade: '#4b2f22', trim: '#f59e0b', eye: '#fef3c7' },
    orc: { body: '#5f6f37', shade: '#323d1f', trim: '#c2410c', eye: '#fde68a' },
  };
  const palette = petPalettes[raceId] ?? petPalettes.human;
  const body = palette.body;
  const shade = palette.shade;
  const trim = palette.trim;
  const eye = palette.eye;
  const outline = '#151923';
  pixelRect(context, -21, -6, 32, 20, outline);
  pixelRect(context, -18, -3, 29, 15, body);
  pixelRect(context, -14, 8, 22, 5, shade);
  pixelRect(context, -28, -12, 17, 18, outline);
  pixelRect(context, -25, -9, 14, 14, body);
  pixelRect(context, -24, -17, 6, 8, outline);
  pixelRect(context, -19, -17, 6, 8, outline);
  pixelRect(context, -21, -15, 2, 4, body);
  pixelRect(context, -16, -15, 2, 4, body);
  pixelRect(context, -24, -5, 4, 4, eye);
  pixelRect(context, -16, -5, 4, 4, eye);
  pixelRect(context, -21, 0, 5, 2, outline);
  pixelRect(context, 9, -5, 18, 5, outline);
  pixelRect(context, 11, -4, 15, 3, shade);
  pixelRect(context, -13, 13 + leg, 6, 9, outline);
  pixelRect(context, 1, 13 - leg, 6, 9, outline);
  pixelRect(context, -10, 13 + leg, 3, 7, body);
  pixelRect(context, 4, 13 - leg, 3, 7, body);
  pixelRect(context, -15, -5, 20, 3, trim);
  context.restore();
}

function drawPixelScarab(context, radius, pulse, walk, isAggro, recentlyHit) {
  const shell = recentlyHit ? '#fecaca' : isAggro ? '#92400e' : '#b45309';
  const trim = '#facc15';
  const outline = '#3f2a13';
  pixelRect(context, -radius - 15, 10 + pulse, radius * 2 + 30, 8, 'rgba(0, 0, 0, 0.2)');
  pixelRect(context, -radius - 10, -12 + pulse, radius * 2 + 20, 28, outline);
  pixelRect(context, -radius - 6, -9 + pulse, radius * 2 + 12, 22, shell);
  pixelRect(context, -4, -10 + pulse, 8, 24, trim);
  pixelRect(context, -radius - 2, -2 + pulse, radius * 2 + 4, 4, trim);
  for (let index = -1; index <= 1; index += 1) {
    pixelLine(context, -radius - 4, -3 + index * 8 + pulse, -radius - 22, 2 + index * 9 + walk, 4, outline, 4);
    pixelLine(context, radius + 4, -3 + index * 8 + pulse, radius + 22, 2 + index * 9 - walk, 4, outline, 4);
  }
  pixelRect(context, -7, -18 + pulse, 5, 5, '#fff7ed');
  pixelRect(context, 2, -18 + pulse, 5, 5, '#fff7ed');
}

function drawPixelStalker(context, radius, pulse, walk, bodyColor, outline, recentlyHit) {
  const fill = recentlyHit ? '#fecaca' : bodyColor;
  pixelRect(context, -radius - 10, 13 + pulse, radius * 2 + 20, 8, 'rgba(0, 0, 0, 0.25)');
  pixelRect(context, -radius - 7, -radius + pulse, radius * 2 + 14, radius * 2 + 12, outline);
  pixelRect(context, -radius - 2, -radius + 5 + pulse, radius * 2 + 4, radius * 2 + 3, fill);
  pixelLine(context, -radius + 2, -radius + 7 + pulse, -radius - 18, -radius - 12 + pulse, 6, outline, 4);
  pixelLine(context, radius - 2, -radius + 7 + pulse, radius + 18, -radius - 12 + pulse, 6, outline, 4);
  pixelRect(context, -10, -6 + pulse, 6, 6, '#f8fafc');
  pixelRect(context, 5, -6 + pulse, 6, 6, '#f8fafc');
  pixelRect(context, -8, 11 + pulse, 16, 4, '#94a3b8');
  pixelRect(context, -radius + 3, radius + pulse, 6, 14 + walk, outline);
  pixelRect(context, radius - 9, radius + pulse, 6, 14 - walk, outline);
}

function drawPixelBoss(context, enemy, radius, pulse, walk, bodyColor, outline, recentlyHit) {
  const isFinal = enemy.type === 'dungeon_final_boss';
  const fill = recentlyHit ? '#fecaca' : bodyColor;
  pixelRect(context, -radius - 10, radius - 2 + pulse, radius * 2 + 20, 12, 'rgba(0, 0, 0, 0.28)');
  pixelRect(context, -radius, -radius + pulse, radius * 2, radius * 2, outline);
  pixelRect(context, -radius + 6, -radius + 6 + pulse, radius * 2 - 12, radius * 2 - 12, fill);
  pixelRect(context, -radius + 14, -radius - 13 + pulse, 12, 18, '#facc15');
  pixelRect(context, -6, -radius - 18 + pulse, 12, 23, '#facc15');
  pixelRect(context, radius - 26, -radius - 13 + pulse, 12, 18, '#facc15');
  pixelRect(context, -15, -8 + pulse, 9, 9, '#f8fafc');
  pixelRect(context, 7, -8 + pulse, 9, 9, '#f8fafc');
  pixelRect(context, -15, 18 + pulse, 30, 6, '#111827');
  if (isFinal) {
    for (let ring = 0; ring < 8; ring += 1) {
      const angle = ring * (Math.PI / 4) + performance.now() / 420;
      pixelRect(
        context,
        Math.cos(angle) * (radius + 12) - 4,
        Math.sin(angle) * (radius + 12) + pulse - 4,
        8,
        8,
        ring % 2 === 0 ? '#a78bfa' : '#f0abfc',
      );
    }
  } else {
    pixelRect(context, -radius - 6, 5 + pulse, 12, 28 + walk, outline);
    pixelRect(context, radius - 6, 5 + pulse, 12, 28 - walk, outline);
  }
}

function drawEnemyAssetSprite(context, enemy, now, recentlyHit) {
  const spriteId = getEnemySpriteId(enemy);
  const config = ENEMY_SPRITE_CONFIG[spriteId];
  const image = getEnemySpriteImage(spriteId);
  if (!config || !image || !image.complete || !image.naturalWidth || !image.naturalHeight) return false;

  const attackStartedAt = safeNumber(enemy.attackStartedAt, 0);
  const attackUntil = safeNumber(enemy.attackUntil, 0);
  const boulderThrow = enemy?.attackType === 'boulder-toss';
  const waterRangedAttack = enemy?.attackType === 'water-bolt' || enemy?.attackType === 'tidal-volley';
  const boulderLaunchAt = safeNumber(enemy?.mechanicLaunchAt, attackUntil);
  const waterLaunchAt = safeNumber(enemy?.attackLaunchAt, safeNumber(enemy?.mechanicLaunchAt, attackUntil));
  const visibleAttackUntil = boulderThrow
    ? Math.min(attackUntil, boulderLaunchAt + 380)
    : waterRangedAttack
      ? Math.min(attackUntil, waterLaunchAt + 300)
      : attackUntil;
  const attacking = config.attackFrameCount > 0 && now >= attackStartedAt && now < visibleAttackUntil;
  const attackDuration = Math.max(1, visibleAttackUntil - attackStartedAt || config.attackDuration);
  const attackProgress = attacking && !boulderThrow && !waterRangedAttack
    ? clamp((now - attackStartedAt) / attackDuration, 0, 0.999)
    : 0;
  const boulderWindupProgress = clamp(
    (now - attackStartedAt) / Math.max(1, boulderLaunchAt - attackStartedAt),
    0,
    1,
  );
  const boulderReleaseElapsed = now - boulderLaunchAt;
  const boulderThrowFrame = now >= boulderLaunchAt
    ? boulderReleaseElapsed < 70
      ? 5
      : boulderReleaseElapsed < 220
        ? 6
        : 7
    : boulderWindupProgress < 0.14
      ? 0
      : boulderWindupProgress < 0.295
        ? 1
        : boulderWindupProgress < 0.465
          ? 2
          : boulderWindupProgress < 0.65
            ? 3
            : boulderWindupProgress < 0.85
              ? 4
              : 5;
  const waterWindupProgress = clamp(
    (now - attackStartedAt) / Math.max(1, waterLaunchAt - attackStartedAt),
    0,
    1,
  );
  const waterReleaseElapsed = now - waterLaunchAt;
  const waterAttackFrame = now >= waterLaunchAt
    ? waterReleaseElapsed < 70
      ? 4
      : waterReleaseElapsed < 145
        ? 5
        : waterReleaseElapsed < 230
          ? 6
          : 7
    : waterWindupProgress < 0.25
      ? 0
      : waterWindupProgress < 0.5
        ? 1
        : waterWindupProgress < 0.75
          ? 2
          : waterWindupProgress < 0.92
            ? 3
            : 4;
  const facing = getEnemySpriteFacing(enemy);
  const frame = attacking
    ? boulderThrow
      ? Math.min(Math.max(0, (config.boulderThrowFrameCount ?? 8) - 1), boulderThrowFrame)
      : waterRangedAttack
        ? Math.min(Math.max(0, config.attackFrameCount - 1), waterAttackFrame)
        : Math.floor(attackProgress * config.attackFrameCount)
    : facing.moving
      ? Math.floor((now / Math.max(80, config.walkFrameDuration ?? 155) + (enemy.wobble ?? 0)) % config.frameCount)
      : 0;
  const activeAttackStartColumn = boulderThrow
    ? config.boulderThrowStartColumn ?? config.attackStartColumn ?? 4
    : config.attackStartColumn ?? 4;
  const frameColumn = config.directional
    ? (attacking ? activeAttackStartColumn : config.walkStartColumn ?? 0) + frame
    : frame;
  const directionRow = config.directionRows?.[facing.direction] ?? 0;
  const sx = frameColumn * config.frameWidth;
  const sy = config.directional
    ? directionRow * config.frameHeight
    : attacking ? (config.attackRow ?? 1) * config.frameHeight : 0;
  if (
    sx < 0
    || sx + config.frameWidth > image.naturalWidth
    || sy < 0
    || sy + config.frameHeight > image.naturalHeight
  ) return false;
  const alpha = 1;
  const flip = config.directional ? 1 : facing.flip;

  context.save();
  context.globalAlpha = alpha;
  context.scale(flip, 1);
  context.drawImage(
    image,
    sx,
    sy,
    config.frameWidth,
    config.frameHeight,
    Math.round(-config.drawWidth / 2),
    Math.round(config.yOffset),
    config.drawWidth,
    config.drawHeight,
  );
  context.restore();
  return true;
}

function drawPixelEnemySprite(context, enemy, now) {
  const x = Number.isFinite(enemy?.x) ? enemy.x : enemy?.targetX;
  const y = Number.isFinite(enemy?.y) ? enemy.y : enemy?.targetY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;

  const time = Number.isFinite(now) ? now : performance.now();
  const pulse = Math.round(Math.sin(time / 180 + (enemy.wobble ?? 0)) * 2);
  const walk = Math.round(Math.sin(time / 110 + (enemy.wobble ?? 0)) * 3);
  const recentlyHit = time - (enemy.hitAt ?? 0) < 140;
  const isBoss = enemy.type === 'boss' || enemy.type === 'dungeon_miniboss' || enemy.type === 'dungeon_final_boss';
  const isAggro = enemy.state === 'aggro';
  const radius = enemy.radius ?? ENEMY.radius;
  const maxHp = enemy.maxHp || (isBoss ? 620 : 100);
  const hp = clamp(enemy.hp ?? maxHp, 0, maxHp);
  const outline = '#221722';
  const bodyColor = enemy.type === 'dungeon_enemy'
    ? '#475569'
    : enemy.type === 'dungeon_miniboss'
      ? '#7c2d12'
      : enemy.type === 'dungeon_final_boss'
        ? '#4c1d95'
        : isBoss
          ? '#5b21b6'
          : isAggro
            ? '#7f1d1d'
            : '#4b5563';

  context.save();
  context.translate(x, y);
  drawWorldBossRangedAttack(context, enemy, time);
  drawWorldBossMechanicTelegraph(context, enemy, time);

  try {
    if (drawEnemyAssetSprite(context, enemy, time, recentlyHit)) {
      drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp);
    } else if (enemy.type === 'enemy' && enemy.enemyKind === 'scarab') {
      drawPixelScarab(context, radius, pulse, walk, isAggro, recentlyHit);
      drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp);
    } else if (enemy.type === 'enemy') {
      drawPixelWolf(context, radius, pulse, walk, bodyColor, outline, recentlyHit);
      drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp);
    } else if (enemy.type === 'dungeon_enemy') {
      drawPixelStalker(context, radius, pulse, walk, bodyColor, outline, recentlyHit);
      drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp);
    } else {
      drawPixelBoss(context, enemy, radius, pulse, walk, bodyColor, outline, recentlyHit);
      drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp);
    }
  } finally {
    context.restore();
    context.imageSmoothingEnabled = previousSmoothing;
  }
}

function drawEnemy(context, enemy, now) {
  const x = Number.isFinite(enemy?.x) ? enemy.x : enemy?.targetX;
  const y = Number.isFinite(enemy?.y) ? enemy.y : enemy?.targetY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  drawPixelEnemySprite(context, enemy, now);
  return;

  const pulse = Math.sin(now / 180 + (enemy.wobble ?? 0)) * 2;
  const recentlyHit = now - (enemy.hitAt ?? 0) < 140;
  const isBoss = enemy.type === 'boss' || enemy.type === 'dungeon_miniboss' || enemy.type === 'dungeon_final_boss';
  const isAggro = enemy.state === 'aggro';
  const radius = enemy.radius ?? ENEMY.radius;
  const maxHp = enemy.maxHp || (isBoss ? 620 : 100);
  const hp = clamp(enemy.hp ?? maxHp, 0, maxHp);

  context.save();
  context.translate(x, y);

  context.fillStyle = 'rgba(0, 0, 0, 0.24)';
  context.beginPath();
  context.ellipse(0, isBoss ? 34 : 17, isBoss ? 38 : 18, isBoss ? 13 : 7, 0, 0, Math.PI * 2);
  context.fill();

  const walk = Math.sin(now / 120 + (enemy.wobble ?? 0)) * 4;
  const bodyColor = recentlyHit
    ? '#fecaca'
    : enemy.type === 'dungeon_enemy'
      ? '#475569'
      : enemy.type === 'dungeon_miniboss'
        ? '#7c2d12'
        : enemy.type === 'dungeon_final_boss'
          ? '#4c1d95'
          : isBoss
            ? '#5b21b6'
            : isAggro
              ? '#7f1d1d'
              : '#4b5563';

  if (enemy.type === 'enemy' && enemy.enemyKind === 'scarab') {
    context.strokeStyle = '#3b2f1c';
    context.lineWidth = 4;
    context.fillStyle = recentlyHit ? '#fecaca' : isAggro ? '#92400e' : '#b45309';
    context.beginPath();
    context.ellipse(0, 3 + pulse, radius + 9, radius - 2, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#fbbf24';
    context.beginPath();
    context.ellipse(0, -2 + pulse, radius - 2, radius - 9, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#3b2f1c';
    context.lineWidth = 3;
    context.beginPath();
    for (let leg = -1; leg <= 1; leg += 1) {
      context.moveTo(-12, 4 + leg * 7 + pulse);
      context.lineTo(-28, 8 + leg * 7 + walk);
      context.moveTo(12, 4 + leg * 7 + pulse);
      context.lineTo(28, 8 + leg * 7 - walk);
    }
    context.stroke();
  } else if (enemy.type === 'enemy') {
    context.strokeStyle = '#2b1111';
    context.lineWidth = 4;
    context.fillStyle = bodyColor;
    context.beginPath();
    context.ellipse(0, 3 + pulse, radius + 8, radius - 3, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#374151';
    context.beginPath();
    context.ellipse(18, -4 + pulse, 13, 11, 0.2, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#374151';
    context.beginPath();
    context.moveTo(18, -16 + pulse);
    context.lineTo(24, -28 + pulse);
    context.lineTo(27, -12 + pulse);
    context.moveTo(7, -15 + pulse);
    context.lineTo(5, -28 + pulse);
    context.lineTo(16, -15 + pulse);
    context.fill();
    context.stroke();
    context.strokeStyle = '#2b1111';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-12, 12 + pulse);
    context.lineTo(-18, 24 + walk);
    context.moveTo(6, 12 + pulse);
    context.lineTo(2, 25 - walk);
    context.moveTo(-24, 1 + pulse);
    context.quadraticCurveTo(-38, -8 + pulse, -44, -1 + pulse);
    context.stroke();
  } else {
    context.fillStyle = bodyColor;
    context.strokeStyle = '#2b1111';
    context.lineWidth = isBoss ? 5 : 3;
    context.beginPath();
    context.arc(0, pulse, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    if (enemy.type === 'dungeon_enemy') {
      context.fillStyle = '#94a3b8';
      context.beginPath();
      context.moveTo(-18, -9 + pulse);
      context.lineTo(-30, -21 + pulse);
      context.lineTo(-21, 1 + pulse);
      context.moveTo(18, -9 + pulse);
      context.lineTo(30, -21 + pulse);
      context.lineTo(21, 1 + pulse);
      context.fill();
    }
  }

  context.fillStyle = '#fef2f2';
  context.beginPath();
  context.arc(isBoss ? -12 : 7, (isBoss ? -8 : -5) + pulse, isBoss ? 5 : 3, 0, Math.PI * 2);
  context.arc(isBoss ? 12 : 19, (isBoss ? -8 : -5) + pulse, isBoss ? 5 : 3, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#111827';
  context.lineWidth = isBoss ? 4 : 2;
  context.beginPath();
  context.moveTo(isBoss ? -13 : 9, (isBoss ? 12 : 7) + pulse);
  context.lineTo(isBoss ? 13 : 19, (isBoss ? 12 : 7) + pulse);
  context.stroke();

  if (isBoss) {
    context.fillStyle = '#facc15';
    context.beginPath();
    context.moveTo(-18, -30 + pulse);
    context.lineTo(-6, -48 + pulse);
    context.lineTo(0, -28 + pulse);
    context.lineTo(8, -50 + pulse);
    context.lineTo(20, -30 + pulse);
    context.closePath();
    context.fill();
    context.fillStyle = '#f6f1df';
    context.font = '800 13px Inter, Arial';
    context.textAlign = 'center';
    context.fillText(enemy.name, 0, -58);
  }

  context.fillStyle = '#111827';
  context.fillRect(isBoss ? -38 : -18, isBoss ? -44 : -30, isBoss ? 76 : 36, isBoss ? 8 : 5);
  context.fillStyle = '#22c55e';
  context.fillRect(
    isBoss ? -38 : -18,
    isBoss ? -44 : -30,
    (isBoss ? 76 : 36) * (hp / maxHp),
    isBoss ? 8 : 5,
  );

  if (!isAggro) {
    context.fillStyle = '#cbd5e1';
    context.font = '800 12px Inter, Arial';
    context.textAlign = 'center';
    context.fillText('idle', 0, isBoss ? -72 : -39);
  }

  context.restore();
}

export {
  drawPixelEnemyLabel,
  drawPixelWolf,
  drawHunterPet,
  drawPixelScarab,
  drawPixelStalker,
  drawPixelBoss,
  drawEnemyAssetSprite,
  drawPixelEnemySprite,
  drawEnemy,
};
