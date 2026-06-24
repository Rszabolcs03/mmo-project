import { clamp, isFiniteNumber, safeNumber } from '../game/math';

function pixelRect(context, x, y, width, height, color) {
  if (![x, y, width, height].every((value) => Number.isFinite(Number(value)))) return;
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function pixelLine(context, fromX, fromY, toX, toY, size, color, steps = 10) {
  if (![fromX, fromY, toX, toY, size, steps].every((value) => Number.isFinite(Number(value)))) return;
  const safeSteps = Math.max(1, Math.floor(steps));
  for (let index = 0; index <= safeSteps; index += 1) {
    const amount = index / safeSteps;
    pixelRect(
      context,
      fromX + (toX - fromX) * amount - size / 2,
      fromY + (toY - fromY) * amount - size / 2,
      size,
      size,
      color,
    );
  }
}

function drawPixelCross(context, x, y, size, color) {
  pixelRect(context, x - size / 2, y - size * 1.5, size, size * 3, color);
  pixelRect(context, x - size * 1.5, y - size / 2, size * 3, size, color);
}

function drawPixelRing(context, x, y, radius, color, count = 20, size = 6, spin = 0) {
  const safeCount = clamp(Math.floor(safeNumber(count, 20)), 1, 96);
  const safeRadius = clamp(safeNumber(radius, 24), 0, 1200);
  const safeSize = clamp(safeNumber(size, 6), 1, 80);
  const safeSpin = safeNumber(spin, 0);
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return;
  for (let index = 0; index < safeCount; index += 1) {
    const angle = (index / safeCount) * Math.PI * 2 + safeSpin;
    pixelRect(
      context,
      x + Math.cos(angle) * safeRadius - safeSize / 2,
      y + Math.sin(angle) * safeRadius - safeSize / 2,
      safeSize,
      safeSize,
      color,
    );
  }
}

function drawPixelDiamond(context, x, y, size, color) {
  const half = Math.max(2, Math.round(size / 2));
  pixelRect(context, x - 2, y - half, 4, size, color);
  pixelRect(context, x - half, y - 2, size, 4, color);
  pixelRect(context, x - half + 2, y - half + 2, 4, 4, color);
  pixelRect(context, x + half - 6, y - half + 2, 4, 4, color);
  pixelRect(context, x - half + 2, y + half - 6, 4, 4, color);
  pixelRect(context, x + half - 6, y + half - 6, 4, 4, color);
}

function drawPixelHammer(context, x, y, angle, color = '#facc15') {
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return;
  const safeAngle = safeNumber(angle, 0);
  const fx = Math.cos(safeAngle);
  const fy = Math.sin(safeAngle);
  const sx = Math.cos(safeAngle + Math.PI / 2);
  const sy = Math.sin(safeAngle + Math.PI / 2);
  pixelLine(context, x - fx * 11, y - fy * 11, x + fx * 13, y + fy * 13, 5, '#7c4a1d', 8);
  pixelLine(context, x + fx * 11 - sx * 12, y + fy * 11 - sy * 12, x + fx * 11 + sx * 12, y + fy * 11 + sy * 12, 8, color, 8);
  pixelLine(context, x + fx * 11 - sx * 8, y + fy * 11 - sy * 8, x + fx * 11 + sx * 8, y + fy * 11 + sy * 8, 3, '#fef9c3', 6);
}

function drawPixelShield(context, x, y, color = '#facc15') {
  pixelRect(context, x - 11, y - 13, 22, 6, color);
  pixelRect(context, x - 14, y - 8, 28, 18, color);
  pixelRect(context, x - 9, y + 8, 18, 8, color);
  pixelRect(context, x - 7, y - 5, 14, 16, '#f8fafc');
  pixelRect(context, x - 2, y - 2, 4, 12, '#334155');
}

export {
  pixelRect,
  pixelLine,
  drawPixelCross,
  drawPixelRing,
  drawPixelDiamond,
  drawPixelHammer,
  drawPixelShield,
};
