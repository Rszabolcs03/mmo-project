export const MAGE_CAST_DURATION_MS = 420;
export const MAGE_WAND_RELEASE_DELAY_MS = 140;

export const MAGE_STAFF_SPRITE_SIZE = 96;
export const MAGE_STAFF_DRAW_SIZE = 72;

export const MAGE_STAFF_DIRECTION_ROWS = Object.freeze({
  down: 0,
  'down-right': 1,
  right: 2,
  'up-right': 3,
  up: 4,
  'up-left': 5,
  left: 6,
  'down-left': 7,
});

// Crystal centers in attack columns 5 (wind-up), 6 (release), and 7 (recovery) of the
// current modular human sheet. They are kept explicit so spell projectiles and
// cast accents begin at the rendered staff tip instead of the character center.
export const MAGE_STAFF_CAST_TIPS = Object.freeze({
  down: Object.freeze({
    windup: Object.freeze({ x: 20, y: 28 }),
    release: Object.freeze({ x: 31, y: 23 }),
    recovery: Object.freeze({ x: 24, y: 28 }),
  }),
  'down-right': Object.freeze({
    windup: Object.freeze({ x: 21, y: 28 }),
    release: Object.freeze({ x: 33, y: 23 }),
    recovery: Object.freeze({ x: 26, y: 28 }),
  }),
  right: Object.freeze({
    windup: Object.freeze({ x: 61, y: 24 }),
    release: Object.freeze({ x: 73, y: 27 }),
    recovery: Object.freeze({ x: 66, y: 27 }),
  }),
  'up-right': Object.freeze({
    windup: Object.freeze({ x: 62, y: 25 }),
    release: Object.freeze({ x: 74, y: 28 }),
    recovery: Object.freeze({ x: 67, y: 29 }),
  }),
  up: Object.freeze({
    windup: Object.freeze({ x: 73, y: 26 }),
    release: Object.freeze({ x: 61, y: 22 }),
    recovery: Object.freeze({ x: 69, y: 26 }),
  }),
  'up-left': Object.freeze({
    windup: Object.freeze({ x: 33, y: 25 }),
    release: Object.freeze({ x: 21, y: 28 }),
    recovery: Object.freeze({ x: 28, y: 29 }),
  }),
  left: Object.freeze({
    windup: Object.freeze({ x: 34, y: 24 }),
    release: Object.freeze({ x: 22, y: 27 }),
    recovery: Object.freeze({ x: 29, y: 27 }),
  }),
  'down-left': Object.freeze({
    windup: Object.freeze({ x: 74, y: 28 }),
    release: Object.freeze({ x: 62, y: 23 }),
    recovery: Object.freeze({ x: 69, y: 28 }),
  }),
});

export const MAGE_STAFF_CAST_TIPS_FEMALE = Object.freeze({
  down: Object.freeze({
    windup: Object.freeze({ x: 19, y: 27 }),
    release: Object.freeze({ x: 31, y: 22 }),
    recovery: Object.freeze({ x: 24, y: 27 }),
  }),
  'down-right': Object.freeze({
    windup: Object.freeze({ x: 19, y: 27 }),
    release: Object.freeze({ x: 31, y: 22 }),
    recovery: Object.freeze({ x: 24, y: 27 }),
  }),
  right: Object.freeze({
    windup: Object.freeze({ x: 62, y: 23 }),
    release: Object.freeze({ x: 74, y: 26 }),
    recovery: Object.freeze({ x: 67, y: 26 }),
  }),
  'up-right': Object.freeze({
    windup: Object.freeze({ x: 62, y: 23 }),
    release: Object.freeze({ x: 74, y: 26 }),
    recovery: Object.freeze({ x: 67, y: 27 }),
  }),
  up: Object.freeze({
    windup: Object.freeze({ x: 73, y: 26 }),
    release: Object.freeze({ x: 61, y: 23 }),
    recovery: Object.freeze({ x: 68, y: 27 }),
  }),
  'up-left': Object.freeze({
    windup: Object.freeze({ x: 33, y: 23 }),
    release: Object.freeze({ x: 21, y: 26 }),
    recovery: Object.freeze({ x: 28, y: 27 }),
  }),
  left: Object.freeze({
    windup: Object.freeze({ x: 33, y: 23 }),
    release: Object.freeze({ x: 21, y: 26 }),
    recovery: Object.freeze({ x: 28, y: 26 }),
  }),
  'down-left': Object.freeze({
    windup: Object.freeze({ x: 76, y: 27 }),
    release: Object.freeze({ x: 64, y: 22 }),
    recovery: Object.freeze({ x: 71, y: 27 }),
  }),
});

export function getMageStaffDirection(facing = 0) {
  const sector = Math.round(Number.isFinite(facing) ? facing / (Math.PI / 4) : 0);
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

export function getMageStaffTipSpritePoint(facing = 0, phase = 'release', gender = 'male') {
  const direction = getMageStaffDirection(facing);
  const anchors = gender === 'female'
    ? MAGE_STAFF_CAST_TIPS_FEMALE
    : MAGE_STAFF_CAST_TIPS;
  const points = anchors[direction] ?? anchors.down;
  return points[phase] ?? points.release;
}

export function getMageStaffTipWorldOffset(facing = 0, phase = 'release', gender = 'male') {
  const point = getMageStaffTipSpritePoint(facing, phase, gender);
  const scale = MAGE_STAFF_DRAW_SIZE / MAGE_STAFF_SPRITE_SIZE;
  return {
    x: (point.x - MAGE_STAFF_SPRITE_SIZE / 2) * scale,
    // Character frames are drawn from y - 54; v9 sprite pixel 72 is the foot anchor.
    y: (point.y - 72) * scale,
  };
}

export function getMageStaffTipWorldPoint(origin, facing = 0, phase = 'release') {
  const gender = origin?.appearance?.gender === 'female' || origin?.gender === 'female'
    ? 'female'
    : 'male';
  const offset = getMageStaffTipWorldOffset(facing, phase, gender);
  return {
    x: Number(origin?.x ?? 0) + offset.x,
    y: Number(origin?.y ?? 0) + offset.y,
  };
}
