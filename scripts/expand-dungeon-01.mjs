import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MAP_PATH = join(ROOT, 'public', 'maps', 'dungeon_01.tmj');
const TILE = 32;
const TARGET_WIDTH = 100;
const TARGET_HEIGHT = 250;
const BLOCKED_GID = 257;

function seeded(x, y, salt = 0) {
  const value = Math.sin((x * 928371 + y * 1237 + salt * 971) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function getLayer(map, name) {
  const layer = map.layers.find((candidate) => candidate.name === name);
  if (!layer?.data) throw new Error(`Missing tile layer: ${name}`);
  return layer;
}

function extendLayer(layer, oldHeight, fillValue) {
  const nextData = Array(TARGET_WIDTH * TARGET_HEIGHT).fill(fillValue);
  const copyHeight = Math.min(oldHeight, TARGET_HEIGHT);
  for (let y = 0; y < copyHeight; y += 1) {
    for (let x = 0; x < TARGET_WIDTH; x += 1) {
      nextData[y * TARGET_WIDTH + x] = layer.data[y * TARGET_WIDTH + x] ?? fillValue;
    }
  }
  layer.width = TARGET_WIDTH;
  layer.height = TARGET_HEIGHT;
  layer.data = nextData;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function main() {
  const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
  if (map.width !== TARGET_WIDTH) {
    throw new Error(`dungeon_01.tmj must be ${TARGET_WIDTH} tiles wide before expanding.`);
  }

  const oldHeight = Number(map.height ?? 0);
  const ground = getLayer(map, 'Ground');
  const lava = getLayer(map, 'Lava');
  const decor = getLayer(map, 'Decor');
  const collision = getLayer(map, 'Collision');

  extendLayer(ground, oldHeight, 3);
  extendLayer(lava, oldHeight, 0);
  extendLayer(decor, oldHeight, 0);
  extendLayer(collision, oldHeight, BLOCKED_GID);

  map.height = TARGET_HEIGHT;

  const indexOf = (x, y) => y * TARGET_WIDTH + x;
  const isInside = (x, y) => x > 0 && y > 0 && x < TARGET_WIDTH - 1 && y < TARGET_HEIGHT - 1;

  const setFloor = (x, y, options = {}) => {
    if (!isInside(x, y)) return;
    const index = indexOf(x, y);
    const isBridge = ground.data[index] === 7;
    if (lava.data[index] && !options.clearLava && !isBridge) return;

    collision.data[index] = 0;
    if (options.clearLava) lava.data[index] = 0;
    if (options.clearDecor) decor.data[index] = 0;
    if (!isBridge) {
      ground.data[index] = options.boss
        ? 15
        : seeded(x, y, 3) > 0.88 ? 2 : 1;
    }
  };

  const openCircle = (cx, cy, rx, ry, options = {}) => {
    const minX = Math.floor(cx - rx);
    const maxX = Math.ceil(cx + rx);
    const minY = Math.floor(cy - ry);
    const maxY = Math.ceil(cy + ry);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const nx = (x - cx) / Math.max(1, rx);
        const ny = (y - cy) / Math.max(1, ry);
        if (nx * nx + ny * ny <= 1) setFloor(x, y, options);
      }
    }
  };

  const openRect = (x, y, width, height, options = {}) => {
    for (let yy = y; yy < y + height; yy += 1) {
      for (let xx = x; xx < x + width; xx += 1) setFloor(xx, yy, options);
    }
  };

  const openH = (x1, x2, y, half = 6) => openRect(Math.min(x1, x2), y - half, Math.abs(x2 - x1) + 1, half * 2 + 1, { clearDecor: true });
  const openV = (x, y1, y2, half = 6) => openRect(x - half, Math.min(y1, y2), half * 2 + 1, Math.abs(y2 - y1) + 1, { clearDecor: true });

  const originalWalkable = collision.data.map((value) => value === 0);
  for (let y = 1; y < Math.min(oldHeight, TARGET_HEIGHT - 1); y += 1) {
    for (let x = 1; x < TARGET_WIDTH - 1; x += 1) {
      if (!originalWalkable[indexOf(x, y)]) continue;
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          if (dx * dx + dy * dy > 9) continue;
          setFloor(x + dx, y + dy, { clearDecor: true });
        }
      }
    }
  }

  const spawnsLayer = map.layers.find((layer) => layer.name === 'Spawns');
  const spawnObjects = spawnsLayer?.objects ?? [];
  spawnObjects.forEach((object) => {
    const props = Object.fromEntries((object.properties ?? []).map((property) => [property.name, property.value]));
    const cx = (Number(object.x ?? 0) + Number(object.width ?? 0) / 2) / TILE;
    const cy = (Number(object.y ?? 0) + Number(object.height ?? 0) / 2) / TILE;
    const widthTiles = Math.max(1, Number(object.width ?? 0) / TILE);
    const heightTiles = Math.max(1, Number(object.height ?? 0) / TILE);
    const isBoss = String(props.type ?? object.name ?? '').toLowerCase().includes('boss')
      || Boolean(props.bossType);
    const isFinal = String(props.type ?? object.name ?? '').toLowerCase().includes('final');

    if (isFinal) {
      openCircle(cx, cy, Math.max(18, widthTiles / 2 + 3), Math.max(15, heightTiles / 2 + 3), { boss: true, clearLava: true, clearDecor: true });
    } else if (isBoss) {
      openCircle(cx, cy, Math.max(12, widthTiles / 2 + 3), Math.max(11, heightTiles / 2 + 3), { boss: true, clearLava: true, clearDecor: true });
    } else {
      openCircle(cx, cy, Math.max(9, Math.min(15, widthTiles / 2 + 4)), Math.max(8, Math.min(12, heightTiles / 2 + 4)), { clearLava: true, clearDecor: true });
    }
  });

  // Use the extra 50 rows for a wider post-final exit tunnel instead of empty map space.
  openV(33, 181, 226, 7);
  openH(33, 88, 226, 7);
  openCircle(87, 226, 13, 11, { boss: false, clearLava: true, clearDecor: true });

  const transitionsLayer = map.layers.find((layer) => layer.name === 'Transitions');
  const exit = transitionsLayer?.objects?.find((object) => object.name === 'dungeon_01_exit');
  if (exit) {
    exit.x = 82 * TILE;
    exit.y = 220 * TILE;
    exit.width = 13 * TILE;
    exit.height = 14 * TILE;
  }

  const zonesLayer = map.layers.find((layer) => layer.name === 'Zones');
  (zonesLayer?.objects ?? []).forEach((zone) => {
    if (Number(zone.width ?? 0) >= (map.width * TILE) - 1) {
      zone.height = TARGET_HEIGHT * TILE;
    }
  });

  map.nextlayerid = Math.max(map.nextlayerid ?? 0, ...map.layers.map((layer) => Number(layer.id ?? 0) + 1));
  writeFileSync(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`);
  console.log(`Expanded dungeon_01.tmj from 100x${oldHeight} to 100x${TARGET_HEIGHT}, widened corridors, and preserved spawn objects.`);
}

main();
