import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGION_DIR = path.join(ROOT, 'public', 'maps', 'world_map', 'continents', 'continent_01', 'regions');
const LEFT_PATH = path.join(REGION_DIR, 'continent_01_region_0_0.tmj');
const RIGHT_PATH = path.join(REGION_DIR, 'continent_01_region_1_0.tmj');

const WATER_GID = 3073;
const RIVER_WATER_GID = 3075;
const LEFT_RIVER_FLOW_GID = 30010;
const RIGHT_RIVER_FLOW_GID = 30006;
const COLLISION_GID = 5393;
const EMERALD_GRASS = 1;
const EMERALD_DETAIL = 2;
const SILVER_GRASS = 769;
const SILVER_DETAIL = 772;
const BEACH_SAND = 2312;
const SEAM_X = 800;
const COAST_START_X = 430;
const START_X = 640;
const END_X = 960;
// Redraw the shore a little farther into the right-hand region than the
// terrain-palette repair. This lets the shared beach taper back into the
// existing northern hill/cave terrain instead of ending in a hard vertical
// slice, without repainting that terrain farther inland.
const COAST_BLEND_START_X = 1240;
const COAST_BLEND_END_X = 1420;
const COAST_END_X = COAST_BLEND_END_X;
const MEADOW_END_X = 1120;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

function decodeLayer(layer) {
  const bytes = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const values = new Uint32Array(bytes.length / 4);
  for (let index = 0; index < values.length; index += 1) values[index] = bytes.readUInt32LE(index * 4);
  return values;
}

function encodeLayer(layer, values) {
  const bytes = Buffer.alloc(values.length * 4);
  for (let index = 0; index < values.length; index += 1) bytes.writeUInt32LE(values[index] >>> 0, index * 4);
  layer.encoding = 'base64';
  layer.compression = 'zlib';
  layer.data = zlib.deflateSync(bytes, { level: 6 }).toString('base64');
}

function requiredLayers(map) {
  const names = ['Ground', 'Water', 'WaterFX', 'RiverFlow', 'ShallowWater', 'TerrainDetails', 'Roads', 'Collision'];
  const layers = Object.fromEntries(names.map((name) => [
    name,
    map.layers.find((layer) => layer.type === 'tilelayer' && layer.name === name),
  ]));
  for (const name of names) {
    if (!layers[name]) throw new Error(`Missing ${name} layer.`);
  }
  return Object.fromEntries(names.map((name) => [name, decodeLayer(layers[name])]));
}

function hash2(x, y) {
  let value = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 2246822519) >>> 0;
  value ^= value >>> 13;
  return value >>> 0;
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function valueNoise(x, y, scale, seed = 0) {
  const scaledX = x / scale;
  const scaledY = y / scale;
  const cellX = Math.floor(scaledX);
  const cellY = Math.floor(scaledY);
  const blendX = smoothstep(scaledX - cellX);
  const blendY = smoothstep(scaledY - cellY);
  const sample = (sampleX, sampleY) => (hash2(sampleX + seed, sampleY - seed) & 0xffff) / 0xffff;
  const top = lerp(sample(cellX, cellY), sample(cellX + 1, cellY), blendX);
  const bottom = lerp(sample(cellX, cellY + 1), sample(cellX + 1, cellY + 1), blendX);
  return lerp(top, bottom, blendY);
}

function coastMixNoise(worldX, y) {
  // The previous 2- and 5-tile noise generated a checkerboard-like fringe.
  // A few larger, softer pockets read as natural dune grass at map scale.
  const clustered = valueNoise(worldX, y, 18, 311) * 0.68
    + valueNoise(worldX, y, 9, 947) * 0.32;
  const edgeJitter = (((hash2(worldX + 1700, y - 2300) & 0xffff) / 0xffff) - 0.5) * 0.035;
  return Math.max(0, Math.min(0.999, clustered + edgeJitter));
}

function smoothstep(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function mouthIndent(x, centerX, depth, halfWidth) {
  const distance = Math.abs(x - centerX);
  if (distance >= halfWidth) return 0;
  // A cosine-shaped inlet has a flat derivative at both ends, so the beach
  // turns into the estuary without a visible shoulder or rectangular cut.
  return Math.round(depth * (0.5 + 0.5 * Math.cos(Math.PI * distance / halfWidth)));
}

function coastLine(worldX) {
  let westCoastShoulder = 0;
  if (worldX < 560) {
    const westBlend = Math.max(0, Math.min(1, (560 - worldX) / 130));
    westCoastShoulder = 31 + 64 * Math.pow(westBlend, 1.8);
  } else if (worldX < 760) {
    westCoastShoulder = 31 * smoothstep((760 - worldX) / 200);
  }
  const naturalCoast = Math.round(121 + westCoastShoulder
    + Math.sin(worldX * 0.028) * 4
    + Math.sin(worldX * 0.011 + 1.8) * 3);
  return naturalCoast
    + mouthIndent(worldX, 1068, 14, 30);
}

function coastBeachWidth(worldX) {
  return Math.round(20
    + Math.sin(worldX * 0.043 + 0.6) * 3
    + Math.sin(worldX * 0.017) * 2);
}

function coastFadeDepth(worldX) {
  return Math.round(30
    + Math.sin(worldX * 0.031 + 0.9) * 3
    + Math.sin(worldX * 0.013) * 2);
}

function seaTransition(depthFromShore) {
  return {
    water: depthFromShore <= 2 ? 3077 : (depthFromShore <= 5 ? 3075 : WATER_GID),
    shallow: depthFromShore <= 4 ? 3079 : 0,
  };
}

function isBeachGround(gid) {
  // All of these are variants from the existing sand palette. Keeping them
  // here lets a repaired shoreline merge back into the hand-painted coast
  // rather than forcing the cave-side beach to one flat sand colour.
  return gid === BEACH_SAND || gid === 2305 || gid === 2322 || gid === 2323;
}

function snapshotCoast(map, layers) {
  const shorelines = new Int32Array(map.width);
  const beachWidths = new Int32Array(map.width);
  for (let x = 0; x < map.width; x += 1) {
    let shoreline = map.height;
    for (let y = 0; y < map.height; y += 1) {
      if (!layers.Water[y * map.width + x]) {
        shoreline = y;
        break;
      }
    }
    shorelines[x] = shoreline;

    let lastSand = -1;
    for (let y = shoreline; y <= Math.min(map.height - 1, shoreline + 96); y += 1) {
      if (isBeachGround(layers.Ground[y * map.width + x])) lastSand = y;
      // Once there has been a small continuous non-sand patch after the beach,
      // later terrain detail should not count as an extension of the beach.
      if (lastSand >= shoreline && y - lastSand > 4) break;
    }
    beachWidths[x] = lastSand >= shoreline ? lastSand - shoreline : 0;
  }
  return { shorelines, beachWidths };
}

function findPolygonObject(layers, objectName) {
  for (const layer of layers) {
    if (layer.type === 'objectgroup') {
      const object = (layer.objects ?? []).find((candidate) => candidate.name === objectName && candidate.polygon);
      if (object) return object;
    }
    if (layer.layers) {
      const nested = findPolygonObject(layer.layers, objectName);
      if (nested) return nested;
    }
  }
  return null;
}

function findObject(layers, objectName) {
  for (const layer of layers) {
    if (layer.type === 'objectgroup') {
      const object = (layer.objects ?? []).find((candidate) => candidate.name === objectName);
      if (object) return object;
    }
    if (layer.layers) {
      const nested = findObject(layer.layers, objectName);
      if (nested) return nested;
    }
  }
  return null;
}

function polygonInTiles(map, objectName) {
  const object = findPolygonObject(map.layers, objectName);
  if (!object) return null;
  return object.polygon.map((point) => ({
    x: (object.x + point.x) / map.tilewidth,
    y: (object.y + point.y) / map.tileheight,
  }));
}

function pointInPolygon(x, y, polygon) {
  if (!polygon) return false;
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const a = polygon[current];
    const b = polygon[previous];
    const crosses = ((a.y > y) !== (b.y > y))
      && (x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
}

function meadowGround(worldX, y) {
  // The transition is evaluated in shared world coordinates. Both maps therefore
  // get the exact same visual answer at the border instead of two unrelated fills.
  const baseBlend = smoothstep((worldX - START_X) / (END_X - START_X));
  const organicNoise = Math.sin(worldX * 0.036 + y * 0.016) * 0.12
    + Math.sin(worldX * 0.012 - y * 0.043) * 0.075;
  const useSilver = baseBlend + organicNoise > 0.5;
  const variant = hash2(worldX, y) % 31 === 0;
  if (useSilver) return variant ? SILVER_DETAIL : SILVER_GRASS;
  return variant ? EMERALD_DETAIL : EMERALD_GRASS;
}

function applySeam(map, layers, worldOffsetX, coastSnapshot = null) {
  let coastTiles = 0;
  let meadowTiles = 0;
  const forestPolygon = worldOffsetX === 0 ? polygonInTiles(map, 'tamzia_forest_area') : null;
  const startLocalX = Math.max(0, COAST_START_X - worldOffsetX);
  const endLocalX = Math.min(map.width - 1, COAST_END_X - worldOffsetX);

  for (let x = startLocalX; x <= endLocalX; x += 1) {
    const worldX = worldOffsetX + x;
    const sharedShoreline = coastLine(worldX);
    let shoreline = sharedShoreline;
    let beachWidth = coastBeachWidth(worldX);
    // The far eastern edge meets the pre-existing cave coastline. Blend the
    // shared coast into that saved shoreline over a wide strip, avoiding both
    // a vertical cut and edits to the cave/mountain tiles farther south.
    if (coastSnapshot && worldX >= COAST_BLEND_START_X) {
      const blend = smoothstep((worldX - COAST_BLEND_START_X) / (COAST_BLEND_END_X - COAST_BLEND_START_X));
      shoreline = Math.round(lerp(sharedShoreline, coastSnapshot.shorelines[x], blend));
      const existingWidth = coastSnapshot.beachWidths[x] || beachWidth;
      beachWidth = Math.round(lerp(beachWidth, existingWidth, blend));
    }
    const beachEnd = shoreline + beachWidth;
    const fadeDepth = coastFadeDepth(worldX);
    const fadeEnd = beachEnd + fadeDepth;

    for (let y = 0; y <= Math.min(map.height - 1, fadeEnd); y += 1) {
      const index = y * map.width + x;
      layers.TerrainDetails[index] = 0;
      if (y < shoreline) {
        const sea = seaTransition(shoreline - y);
        layers.Ground[index] = SILVER_GRASS;
        layers.Water[index] = sea.water;
        layers.RiverFlow[index] = 0;
        layers.ShallowWater[index] = sea.shallow;
        layers.Collision[index] = COLLISION_GID;
        layers.Roads[index] = 0;
        coastTiles += 1;
        continue;
      }

      layers.Water[index] = 0;
      layers.RiverFlow[index] = 0;
      layers.ShallowWater[index] = 0;
      layers.Collision[index] = 0;
      if (y <= beachEnd) {
        layers.Ground[index] = BEACH_SAND;
      } else {
        const organicFade = (y - beachEnd) / fadeDepth
          + Math.sin(worldX * 0.071 + y * 0.039) * 0.055
          + Math.sin(worldX * 0.027 - y * 0.083) * 0.04;
        let fade = smoothstep(organicFade);
        const forestReach = 16 + Math.round(Math.sin(x * 0.17 + 0.8) * 3);
        let forestDistance = null;
        for (let distance = 0; distance <= forestReach; distance += 1) {
          if (pointInPolygon(x + 0.5, y + distance + 0.5, forestPolygon)) {
            forestDistance = distance;
            break;
          }
        }
        if (forestDistance !== null) {
          const forestProtection = smoothstep((forestReach - forestDistance) / forestReach);
          fade = Math.max(fade, forestProtection);
        }
        const generatedGround = coastMixNoise(worldX, y) < fade
          ? meadowGround(worldX, y)
          : BEACH_SAND;
        layers.Ground[index] = generatedGround;
      }
      coastTiles += 1;
    }

    // Carry the terrain palette through the seam without extending any forest
    // objects into the neighbouring region.
    for (let y = fadeEnd + 1; worldX >= START_X && worldX <= MEADOW_END_X && y <= Math.min(map.height - 1, 540); y += 1) {
      const index = y * map.width + x;
      if (layers.Water[index] || layers.ShallowWater[index] || layers.Roads[index]) continue;
      if (pointInPolygon(x + 0.5, y + 0.5, forestPolygon)) continue;
      layers.Ground[index] = meadowGround(worldX, y);
      layers.TerrainDetails[index] = 0;
      meadowTiles += 1;
    }
  }

  return { coastTiles, meadowTiles };
}

function distanceToSegment(x, y, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / lengthSquared))
    : 0;
  return {
    distance: Math.hypot(x - (from.x + dx * t), y - (from.y + dy * t)),
    radius: from.radius + (to.radius - from.radius) * t,
  };
}

function routeSample(x, y, route) {
  let best = { distance: Number.POSITIVE_INFINITY, radius: 0 };
  for (let index = 1; index < route.length; index += 1) {
    const sample = distanceToSegment(x, y, route[index - 1], route[index]);
    if (sample.distance < best.distance) best = sample;
  }
  return best;
}

function normalizeRightRiverCoast(map, layers) {
  let changed = 0;
  for (let x = 140; x <= 360; x += 1) {
    // Use the same world-space shoreline as the neighbouring map. The old
    // local formula was almost identical, but its small offset became a
    // noticeable step where the two region canvases meet.
    const shoreline = coastLine(SEAM_X + x);
    const beachWidth = coastBeachWidth(SEAM_X + x);
    const beachEnd = shoreline + beachWidth;
    const fadeDepth = coastFadeDepth(SEAM_X + x);
    const fadeEnd = beachEnd + fadeDepth;
    for (let y = 0; y <= fadeEnd; y += 1) {
      const index = y * map.width + x;
      layers.TerrainDetails[index] = 0;
      layers.RiverFlow[index] = 0;
      if (y < shoreline) {
        const sea = seaTransition(shoreline - y);
        layers.Ground[index] = SILVER_GRASS;
        layers.Water[index] = sea.water;
        layers.ShallowWater[index] = sea.shallow;
        layers.Collision[index] = COLLISION_GID;
        layers.Roads[index] = 0;
      } else {
        layers.Water[index] = 0;
        layers.ShallowWater[index] = 0;
        layers.Collision[index] = 0;
        const organicFade = (y - beachEnd) / fadeDepth
          + Math.sin((SEAM_X + x) * 0.071 + y * 0.039) * 0.055
          + Math.sin((SEAM_X + x) * 0.027 - y * 0.083) * 0.04;
        const fade = smoothstep(organicFade);
        layers.Ground[index] = y <= beachEnd || coastMixNoise(SEAM_X + x, y) >= fade
          ? BEACH_SAND
          : meadowGround(SEAM_X + x, y);
      }
      changed += 1;
    }
  }
  return changed;
}

function caveApproachBeachWidth(x) {
  // This is a narrow, terrain-only pass along the rocky eastern approach.
  // The anchors keep the broad cove readable, but remove the abrupt 70+ tile
  // sand columns that made the shore look cut out of the map.
  const anchors = [
    { x: 560, width: 48 },
    { x: 620, width: 58 },
    { x: 690, width: 54 },
    { x: 730, width: 46 },
    { x: 760, width: 26 },
  ];
  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const next = anchors[index];
    if (x <= next.x) {
      const amount = smoothstep((x - previous.x) / (next.x - previous.x));
      return Math.round(lerp(previous.width, next.width, amount));
    }
  }
  return anchors.at(-1).width;
}

function smoothCaveApproachBeach(map, layers) {
  const caveCollisionLayer = map.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'CaveCollision');
  if (!caveCollisionLayer) return 0;
  const caveCollision = decodeLayer(caveCollisionLayer);
  let changed = 0;

  for (let x = 560; x <= 760; x += 1) {
    let shoreline = map.height;
    for (let y = 0; y < map.height; y += 1) {
      if (!layers.Water[y * map.width + x]) {
        shoreline = y;
        break;
      }
    }
    let caveStart = map.height;
    for (let y = 0; y < map.height; y += 1) {
      if (caveCollision[y * map.width + x]) {
        caveStart = y;
        break;
      }
    }
    const beachEnd = shoreline + caveApproachBeachWidth(x);
    // Leave a generous untouched band before the cave/mountain collision
    // footprint. This pass changes only visible Ground/TerrainDetails tiles.
    const maxY = Math.min(map.height - 1, caveStart - 36, beachEnd + 30);
    for (let y = shoreline; y <= maxY; y += 1) {
      const index = y * map.width + x;
      const fade = smoothstep((y - beachEnd) / 30);
      const pocket = valueNoise(SEAM_X + x, y, 24, 401) * 0.74
        + valueNoise(SEAM_X + x, y, 12, 887) * 0.26;
      layers.Ground[index] = y <= beachEnd || pocket >= fade
        ? BEACH_SAND
        : meadowGround(SEAM_X + x, y);
      layers.TerrainDetails[index] = 0;
      changed += 1;
    }
  }
  return changed;
}

function carveRiverMouth(map, layers, route, flowGid, shorelineAtX, worldOffsetX) {
  const minX = Math.max(0, Math.floor(Math.min(...route.map((point) => point.x - point.radius - 6))));
  const maxX = Math.min(map.width - 1, Math.ceil(Math.max(...route.map((point) => point.x + point.radius + 6))));
  const minY = Math.max(0, Math.floor(Math.min(...route.map((point) => point.y - point.radius - 5))));
  const maxY = Math.min(map.height - 1, Math.ceil(Math.max(...route.map((point) => point.y + point.radius + 5))));
  let waterTiles = 0;
  let bankTiles = 0;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const sample = routeSample(x + 0.5, y + 0.5, route);
      if (sample.distance > sample.radius + 5) continue;
      const index = y * map.width + x;
      const shoreline = shorelineAtX(x);

      if (sample.distance <= sample.radius) {
        const isOpenSea = y < shoreline;
        const sea = seaTransition(shoreline - y);
        layers.Ground[index] = isOpenSea
          ? SILVER_GRASS
          : (y <= shoreline + 24 ? BEACH_SAND : meadowGround(worldOffsetX + x, y));
        layers.Water[index] = isOpenSea ? sea.water : RIVER_WATER_GID;
        layers.WaterFX[index] = 0;
        layers.ShallowWater[index] = isOpenSea ? sea.shallow : 0;
        layers.TerrainDetails[index] = 0;
        layers.Roads[index] = 0;
        layers.Collision[index] = COLLISION_GID;
        layers.RiverFlow[index] = isOpenSea ? 0 : flowGid;
        waterTiles += 1;
      } else if (y >= shoreline) {
        // Preserve established downstream water beside the repair corridor. The
        // old implementation cleared it near the route endpoint and introduced
        // a one- or two-row break in both rivers.
        if (layers.Water[index]) continue;
        layers.Water[index] = 0;
        layers.WaterFX[index] = 0;
        layers.RiverFlow[index] = 0;
        layers.ShallowWater[index] = 0;
        layers.Collision[index] = 0;
        layers.TerrainDetails[index] = 0;
        layers.Ground[index] = y <= shoreline + 27
          ? BEACH_SAND
          : meadowGround(worldOffsetX + x, y);
        bankTiles += 1;
      }
    }
  }
  return { waterTiles, bankTiles };
}

function normalizeOpenSeaAtMouth(map, layers, xStart, xEnd, shorelineAtX) {
  let changed = 0;
  for (let x = Math.max(0, xStart); x <= Math.min(map.width - 1, xEnd); x += 1) {
    const shoreline = shorelineAtX(x);
    for (let y = 0; y < shoreline; y += 1) {
      const index = y * map.width + x;
      if (!layers.Water[index]) continue;
      const sea = seaTransition(shoreline - y);
      if (layers.Water[index] !== sea.water || layers.RiverFlow[index]) changed += 1;
      layers.Water[index] = sea.water;
      layers.RiverFlow[index] = 0;
      layers.ShallowWater[index] = sea.shallow;
      layers.Collision[index] = COLLISION_GID;
      layers.TerrainDetails[index] = 0;
    }
  }
  return changed;
}

function restoreBeachMonsterArena(map, layers) {
  const boss = findObject(map.layers, 'beach_monster');
  if (!boss) return 0;

  // Keep the boss arena independent from the nearby coast transition. Its
  // loose oval is deliberately a little larger than the actual spawn area,
  // which leaves a readable sandy fighting space around the puddles.
  const centerX = (boss.x + boss.width / 2) / map.tilewidth;
  const centerY = (boss.y + boss.height / 2) / map.tileheight;
  const radiusX = Math.max(27, boss.width / map.tilewidth / 2 + 10);
  const radiusY = Math.max(22, boss.height / map.tileheight / 2 + 10);
  const minX = Math.max(0, Math.floor(centerX - radiusX - 4));
  const maxX = Math.min(map.width - 1, Math.ceil(centerX + radiusX + 4));
  const minY = Math.max(0, Math.floor(centerY - radiusY - 4));
  const maxY = Math.min(map.height - 1, Math.ceil(centerY + radiusY + 4));
  let restored = 0;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const normalizedDistance = Math.hypot(
        (x + 0.5 - centerX) / radiusX,
        (y + 0.5 - centerY) / radiusY,
      );
      // A low-frequency wobble preserves the hand-painted feel without
      // turning the arena edge into the noisy grass/sand transition.
      const rim = 1
        + (valueNoise(x, y, 7, 1771) - 0.5) * 0.10
        + Math.sin(x * 0.22 + y * 0.13) * 0.025;
      if (normalizedDistance > rim) continue;

      const index = y * map.width + x;
      const isPuddle = layers.Water[index] || layers.ShallowWater[index] || layers.RiverFlow[index];
      layers.Ground[index] = BEACH_SAND;
      layers.TerrainDetails[index] = 0;
      layers.Roads[index] = 0;
      if (!isPuddle) {
        layers.Water[index] = 0;
        layers.WaterFX[index] = 0;
        layers.ShallowWater[index] = 0;
        layers.RiverFlow[index] = 0;
        layers.Collision[index] = 0;
      }
      restored += 1;
    }
  }

  return restored;
}

const leftMap = readJson(LEFT_PATH);
const rightMap = readJson(RIGHT_PATH);
const leftLayers = requiredLayers(leftMap);
const rightLayers = requiredLayers(rightMap);

const leftResult = applySeam(leftMap, leftLayers, 0);
const rightCoastSnapshot = snapshotCoast(rightMap, rightLayers);
const rightResult = applySeam(rightMap, rightLayers, SEAM_X, rightCoastSnapshot);
const normalizedRightCoastTiles = normalizeRightRiverCoast(rightMap, rightLayers);
const caveApproachTilesSmoothed = smoothCaveApproachBeach(rightMap, rightLayers);
const leftMouth = carveRiverMouth(
  leftMap,
  leftLayers,
  [
    { x: 641, y: 110, radius: 10 },
    { x: 643, y: 126, radius: 9 },
    { x: 650, y: 143, radius: 8 },
    { x: 662, y: 160, radius: 8 },
    { x: 670, y: 172, radius: 7 },
    { x: 678, y: 184, radius: 6.5 },
    { x: 689, y: 196, radius: 6 },
    { x: 697, y: 202, radius: 6 },
    { x: 702, y: 216, radius: 6 },
    { x: 705, y: 230, radius: 6 },
    { x: 712, y: 242, radius: 6 },
    { x: 717, y: 252, radius: 6 },
    { x: 725, y: 264, radius: 6 },
    { x: 734, y: 274, radius: 6 },
    { x: 745, y: 284, radius: 6 },
  ],
  LEFT_RIVER_FLOW_GID,
  (x) => coastLine(x),
  0,
);
const rightMouth = carveRiverMouth(
  rightMap,
  rightLayers,
  [
    { x: 268, y: 90, radius: 14 },
    { x: 267, y: 112, radius: 12 },
    { x: 270, y: 140, radius: 9 },
    { x: 273, y: 166, radius: 7.5 },
    { x: 276, y: 192, radius: 6.5 },
    { x: 278, y: 210, radius: 6 },
    { x: 281, y: 230, radius: 6 },
    { x: 284, y: 244, radius: 6 },
    { x: 286, y: 260, radius: 6 },
    { x: 289, y: 278, radius: 6 },
  ],
  RIGHT_RIVER_FLOW_GID,
  (x) => coastLine(SEAM_X + x),
  SEAM_X,
);
const leftOpenSeaTilesNormalized = normalizeOpenSeaAtMouth(
  leftMap, leftLayers, 580, 710, (x) => coastLine(x),
);
const rightOpenSeaTilesNormalized = normalizeOpenSeaAtMouth(
  rightMap,
  rightLayers,
  210,
  330,
  (x) => coastLine(SEAM_X + x),
);
const beachMonsterArenaTilesRestored = restoreBeachMonsterArena(leftMap, leftLayers);

for (const [map, layers] of [[leftMap, leftLayers], [rightMap, rightLayers]]) {
  for (const name of Object.keys(layers)) {
    const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
    encodeLayer(layer, layers[name]);
  }
}

writeJson(LEFT_PATH, leftMap);
writeJson(RIGHT_PATH, rightMap);
console.log(JSON.stringify({
  leftResult,
  rightResult,
  normalizedRightCoastTiles,
  caveApproachTilesSmoothed,
  leftMouth,
  rightMouth,
  leftOpenSeaTilesNormalized,
  rightOpenSeaTilesNormalized,
  beachMonsterArenaTilesRestored,
  summary: 'Smoothed the 0_0 / 1_0 north-coast, meadow seam and both river mouths.',
}));
