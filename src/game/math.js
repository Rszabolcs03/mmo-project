function clamp(value, min, max) {
  const safeMin = safeNumber(min, 0);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  return Math.max(safeMin, Math.min(safeMax, safeNumber(value, safeMin)));
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function isFinitePoint(point) {
  return Boolean(point) && isFiniteNumber(point.x) && isFiniteNumber(point.y);
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safePoint(point, fallback = { x: 0, y: 0 }) {
  return {
    x: safeNumber(point?.x, fallback.x),
    y: safeNumber(point?.y, fallback.y),
  };
}

export {
  clamp,
  isFiniteNumber,
  isFinitePoint,
  safeNumber,
  safePoint,
};
