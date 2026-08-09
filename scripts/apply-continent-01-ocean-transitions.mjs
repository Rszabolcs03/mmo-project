import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTINENT_ROOT = path.join(ROOT, 'public/maps/world_map/continents/continent_01');
const REGISTRY_PATH = path.join(CONTINENT_ROOT, 'continent_01_regions.json');
const GID_MASK = 0x1fffffff;
const WATER_SOURCE = 'world_v3_water.tsx';
const SHALLOW_LAYER_NAME = 'ShallowWater';
const SUBMERGED_ROAD_LAYER_NAME = 'SubmergedRoad';
const COASTAL_RIPPLE_OPACITY = 0.46;
const SHALLOW_DEPTH = 2;
const RIPPLE_DEPTH = 4;
const MEDIUM_DEPTH = 5;
const BEACH_DEPTH = 70;
const TAMZIA_FOREST_AREA = [
  { x: 657.5, y: 204 }, { x: 629.5, y: 266.5 }, { x: 728, y: 392 },
  { x: 779, y: 382.5 }, { x: 792.5, y: 480 }, { x: 603.5, y: 471.5 },
  { x: 585, y: 345 }, { x: 441.5, y: 339.5 }, { x: 545, y: 196.5 },
  { x: 646.5, y: 172.5 },
];
const TAMZIA_DENSE_FOREST_AREA = [
  { x: 392.75, y: 528 }, { x: 450.5, y: 529 }, { x: 494.25, y: 631.75 },
  { x: 447.75, y: 676 }, { x: 387, y: 628.25 }, { x: 383, y: 585 },
  { x: 348.5, y: 529.25 },
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function property(name, type, value) {
  return { name, type, value };
}

function decodeLayer(layer) {
  if (Array.isArray(layer?.data)) return Uint32Array.from(layer.data);
  if (layer?.encoding !== 'base64' || layer?.compression !== 'zlib' || typeof layer.data !== 'string') {
    throw new Error(`Layer "${layer?.name ?? 'unknown'}" is not zlib/base64 tile data.`);
  }
  const inflated = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(inflated.length / 4);
  for (let index = 0; index < data.length; index += 1) data[index] = inflated.readUInt32LE(index * 4);
  return data;
}

function encodeLayer(layer, data) {
  const bytes = Buffer.alloc(data.length * 4);
  for (let index = 0; index < data.length; index += 1) bytes.writeUInt32LE(data[index] >>> 0, index * 4);
  layer.encoding = 'base64';
  layer.compression = 'zlib';
  layer.data = zlib.deflateSync(bytes, { level: 6 }).toString('base64');
}

function tileLayer(map, name) {
  const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
  if (!layer) throw new Error(`Missing tile layer "${name}".`);
  return layer;
}

function objectLayer(map, name) {
  let layer = map.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === name);
  if (layer) {
    layer.objects ??= [];
    return layer;
  }
  layer = {
    draworder: 'topdown',
    id: Math.max(0, ...map.layers.map((candidate) => Number(candidate.id ?? 0))) + 1,
    name,
    objects: [],
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
  map.layers.push(layer);
  return layer;
}

function ensureShallowWaterLayer(map) {
  const existing = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === SHALLOW_LAYER_NAME);
  const afterName = map.layers.some((candidate) => candidate.type === 'tilelayer' && candidate.name === SUBMERGED_ROAD_LAYER_NAME)
    ? SUBMERGED_ROAD_LAYER_NAME
    : 'Roads';
  if (existing) {
    existing.opacity = COASTAL_RIPPLE_OPACITY;
    const currentIndex = map.layers.indexOf(existing);
    const afterIndex = map.layers.findIndex((candidate) => candidate.name === afterName);
    if (afterIndex >= 0 && currentIndex !== afterIndex + 1) {
      map.layers.splice(currentIndex, 1);
      const nextAfterIndex = map.layers.findIndex((candidate) => candidate.name === afterName);
      map.layers.splice(nextAfterIndex + 1, 0, existing);
    }
    return existing;
  }
  const roads = tileLayer(map, 'Roads');
  const layer = {
    compression: 'zlib',
    data: '',
    encoding: 'base64',
    height: Number(roads.height),
    id: Math.max(0, ...map.layers.map((candidate) => Number(candidate.id ?? 0))) + 1,
    name: SHALLOW_LAYER_NAME,
    opacity: COASTAL_RIPPLE_OPACITY,
    type: 'tilelayer',
    visible: true,
    width: Number(roads.width),
    x: 0,
    y: 0,
  };
  encodeLayer(layer, new Uint32Array(layer.width * layer.height));
  const afterIndex = map.layers.findIndex((candidate) => candidate.name === afterName);
  map.layers.splice(afterIndex >= 0 ? afterIndex + 1 : map.layers.indexOf(roads) + 1, 0, layer);
  return layer;
}

function getWaterFirstgid(map) {
  const entry = map.tilesets.find((tileset) => String(tileset.source ?? '').replaceAll('\\', '/').endsWith(WATER_SOURCE));
  if (!entry) throw new Error(`Could not find ${WATER_SOURCE} in map tilesets.`);
  return Number(entry.firstgid);
}

function getEmeraldFirstgid(map) {
  const entry = map.tilesets.find((tileset) => String(tileset.source ?? '').replaceAll('\\', '/').endsWith('world_v3_emerald_vale.tsx'));
  if (!entry) throw new Error('Could not find world_v3_emerald_vale.tsx in map tilesets.');
  return Number(entry.firstgid);
}

function getSaltwindFirstgid(map) {
  const entry = map.tilesets.find((tileset) => String(tileset.source ?? '').replaceAll('\\', '/').endsWith('world_v3_saltwind.tsx'));
  if (!entry) throw new Error('Could not find world_v3_saltwind.tsx in map tilesets.');
  return Number(entry.firstgid);
}

function getElderwoodFirstgid(map) {
  const entry = map.tilesets.find((tileset) => String(tileset.source ?? '').replaceAll('\\', '/').endsWith('world_v3_elderwood.tsx'));
  if (!entry) throw new Error('Could not find world_v3_elderwood.tsx in map tilesets.');
  return Number(entry.firstgid);
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];
    if (((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point, a, b) {
  const deltaX = b.x - a.x;
  const deltaY = b.y - a.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((point.x - a.x) * deltaX + (point.y - a.y) * deltaY) / lengthSquared))
    : 0;
  return Math.hypot(point.x - (a.x + deltaX * t), point.y - (a.y + deltaY * t));
}

function isInsideOrNearPolygon(point, polygon, padding = 0) {
  if (pointInPolygon(point, polygon)) return true;
  return polygon.some((vertex, index) => distanceToSegment(point, vertex, polygon[(index + 1) % polygon.length]) <= padding);
}

function isWaterGid(gid, waterFirstgid) {
  return gid >= waterFirstgid && gid < waterFirstgid + 16;
}

function addOceanSeeds(mask, ocean, width, height, queue) {
  let tail = 0;
  const seed = (index) => {
    if (!mask[index] || ocean[index]) return;
    ocean[index] = 1;
    queue[tail] = index;
    tail += 1;
  };
  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  return tail;
}

function markOcean(mask, width, height) {
  const ocean = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let head = 0;
  let tail = addOceanSeeds(mask, ocean, width, height, queue);
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    const visit = (next) => {
      if (!mask[next] || ocean[next]) return;
      ocean[next] = 1;
      queue[tail] = next;
      tail += 1;
    };
    if (x > 0) visit(index - 1);
    if (x + 1 < width) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y + 1 < height) visit(index + width);
  }
  return { ocean, count: tail };
}

function buildCoastDepth(ocean, width, height) {
  const depth = new Uint8Array(ocean.length);
  const queue = new Int32Array(ocean.length);
  let tail = 0;
  const isLand = (x, y) => x >= 0 && y >= 0 && x < width && y < height && !ocean[y * width + x];
  for (let index = 0; index < ocean.length; index += 1) {
    if (!ocean[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    if (!isLand(x - 1, y) && !isLand(x + 1, y) && !isLand(x, y - 1) && !isLand(x, y + 1)) continue;
    depth[index] = 1;
    queue[tail] = index;
    tail += 1;
  }
  let head = 0;
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const currentDepth = depth[index];
    if (currentDepth >= MEDIUM_DEPTH) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const visit = (next) => {
      if (!ocean[next] || depth[next]) return;
      depth[next] = currentDepth + 1;
      queue[tail] = next;
      tail += 1;
    };
    if (x > 0) visit(index - 1);
    if (x + 1 < width) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y + 1 < height) visit(index + width);
  }
  return depth;
}

function buildLandCoastDepth(ocean, width, height) {
  const depth = new Uint8Array(ocean.length);
  const queue = new Int32Array(ocean.length);
  let tail = 0;
  const isOcean = (x, y) => x >= 0 && y >= 0 && x < width && y < height && ocean[y * width + x];
  for (let index = 0; index < ocean.length; index += 1) {
    if (ocean[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    if (!isOcean(x - 1, y) && !isOcean(x + 1, y) && !isOcean(x, y - 1) && !isOcean(x, y + 1)) continue;
    depth[index] = 1;
    queue[tail] = index;
    tail += 1;
  }
  let head = 0;
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const currentDepth = depth[index];
    if (currentDepth >= BEACH_DEPTH) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const visit = (next) => {
      if (ocean[next] || depth[next]) return;
      depth[next] = currentDepth + 1;
      queue[tail] = next;
      tail += 1;
    };
    if (x > 0) visit(index - 1);
    if (x + 1 < width) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y + 1 < height) visit(index + width);
  }
  return depth;
}

function applyTideglassArena(map, waterData, waterFirstgid) {
  const bossLayer = map.layers.find((layer) => layer.type === 'objectgroup' && layer.name === 'BossSpawns');
  const boss = (bossLayer?.objects ?? []).find((object) => object.name === 'beach_monster');
  if (!boss) return { tiles: 0, landmark: false };
  const centerX = (Number(boss.x) + Number(boss.width) / 2) / 32;
  const centerY = (Number(boss.y) + Number(boss.height) / 2) / 32;
  const ground = tileLayer(map, 'Ground');
  const terrain = tileLayer(map, 'TerrainDetails');
  const groundData = decodeLayer(ground);
  const terrainData = decodeLayer(terrain);
  const saltwindFirstgid = getSaltwindFirstgid(map);
  let tiles = 0;
  for (let y = Math.max(0, Math.floor(centerY - 26)); y <= Math.min(799, Math.ceil(centerY + 26)); y += 1) {
    for (let x = Math.max(0, Math.floor(centerX - 36)); x <= Math.min(799, Math.ceil(centerX + 36)); x += 1) {
      const index = y * 800 + x;
      if (waterData[index] & GID_MASK) continue;
      const oval = ((x + 0.5 - centerX) / 32) ** 2 + ((y + 0.5 - centerY) / 22) ** 2;
      if (oval > 1) continue;
      // A darker packed-sand rim makes this read as a deliberately worn arena.
      groundData[index] = oval >= 0.78 ? saltwindFirstgid + 4 : saltwindFirstgid + 19;
      terrainData[index] = 0;
      const leftPool = ((x + 0.5 - (centerX - 9)) / 6) ** 2 + ((y + 0.5 - (centerY + 4)) / 3) ** 2;
      const rightPool = ((x + 0.5 - (centerX + 8)) / 5) ** 2 + ((y + 0.5 - (centerY - 4)) / 2.6) ** 2;
      const innerPool = ((x + 0.5 - centerX) / 3.8) ** 2 + ((y + 0.5 - (centerY + 7)) / 2.2) ** 2;
      if (leftPool <= 1 || rightPool <= 1 || innerPool <= 1) terrainData[index] = waterFirstgid + 2;
      tiles += 1;
    }
  }
  encodeLayer(ground, groundData);
  encodeLayer(terrain, terrainData);

  const landmarks = objectLayer(map, 'Landmarks');
  const existing = landmarks.objects.find((object) => object.name === 'tamzia_tideglass_cove');
  const marker = {
    id: Number(existing?.id ?? Math.max(0, ...map.layers.flatMap((layer) => layer.objects ?? []).map((object) => Number(object.id ?? 0))) + 1),
    name: 'tamzia_tideglass_cove',
    x: Math.round(centerX * 32),
    y: Math.round(centerY * 32),
    width: 0,
    height: 0,
    properties: [
      property('type', 'string', 'landmark'),
      property('landmarkId', 'string', 'tamzia_tideglass_cove'),
      property('landmarkKind', 'string', 'boss'),
      property('displayName', 'string', 'Tideglass Cove'),
      property('description', 'string', 'the tidal arena of the Tideglass Matriarch'),
      property('showOnMap', 'bool', true),
      property('debugOnly', 'bool', false),
    ],
  };
  if (existing) Object.assign(existing, marker);
  else landmarks.objects.push(marker);
  map.nextobjectid = Math.max(Number(map.nextobjectid ?? 1), marker.id + 1);
  return { tiles, landmark: true };
}

function applyOceanToRegion(record, worldWidth, ocean, coastDepth, landCoastDepth) {
  const { region, map, water, waterData, waterFirstgid } = record;
  const shallow = ensureShallowWaterLayer(map);
  const shallowData = new Uint32Array(waterData.length);
  const roads = tileLayer(map, 'Roads');
  const roadData = decodeLayer(roads);
  const collision = tileLayer(map, 'Collision');
  const collisionData = decodeLayer(collision);
  const submergedRoad = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === SUBMERGED_ROAD_LAYER_NAME);
  const submergedRoadData = submergedRoad ? decodeLayer(submergedRoad) : null;
  const roadGid = getEmeraldFirstgid(map) + 4;
  let changed = 0;
  let shallowTiles = 0;
  let beachTiles = 0;
  let arenaTiles = 0;

  for (let y = 0; y < region.height; y += 1) {
    for (let x = 0; x < region.width; x += 1) {
      const localIndex = y * region.width + x;
      const globalIndex = (region.y + y) * worldWidth + region.x + x;
      if (!ocean[globalIndex]) continue;
      const gid = waterData[localIndex] & GID_MASK;
      if (!isWaterGid(gid, waterFirstgid)) continue;
      const depth = coastDepth[globalIndex];
      const isFordRoad = region.id === 'continent_01_region_0_0'
        && y >= 752
        && x >= 528
        && x <= 558
        && (roadData[localIndex] & GID_MASK) === roadGid
        && collisionData[localIndex] === 0;
      const isSubmergedFord = region.id === 'continent_01_region_0_0'
        && Boolean(submergedRoadData?.[localIndex] & GID_MASK);
      const visualDepth = (isFordRoad || isSubmergedFord)
        ? y <= 765 ? 1 : y <= 777 ? 3 : y <= 782 ? 5 : 6
        : depth;
      const targetGid = visualDepth > 0 && visualDepth <= SHALLOW_DEPTH
        ? waterFirstgid + 4
        : visualDepth > 0 && visualDepth <= MEDIUM_DEPTH
          ? waterFirstgid + 2
          : waterFirstgid;
      if (waterData[localIndex] !== targetGid) {
        waterData[localIndex] = targetGid;
        changed += 1;
      }
      if ((visualDepth > 0 && visualDepth <= RIPPLE_DEPTH) || isFordRoad || isSubmergedFord) {
        shallowData[localIndex] = waterFirstgid + 6;
        shallowTiles += 1;
      }
    }
  }

  // Tamzia gets two deliberate beach stretches rather than a uniform sand rim:
  // a broad southern crescent and a small northern inlet. The coast between
  // them intentionally remains grassy right up to the water.
  if (region.id === 'continent_01_region_0_0') {
    const ground = tileLayer(map, 'Ground');
    const terrainDetails = tileLayer(map, 'TerrainDetails');
    const groundData = decodeLayer(ground);
    const terrainData = decodeLayer(terrainDetails);
    const saltwindFirstgid = getSaltwindFirstgid(map);
    const emeraldFirstgid = getEmeraldFirstgid(map);
    const elderwoodFirstgid = getElderwoodFirstgid(map);
    for (let y = 0; y < region.height; y += 1) {
      for (let x = 0; x < region.width; x += 1) {
        const localIndex = y * region.width + x;
        const globalIndex = (region.y + y) * worldWidth + region.x + x;
        const distance = landCoastDepth[globalIndex];
        if (ocean[globalIndex]) continue;
        const existingGid = groundData[localIndex] & GID_MASK;
        const isOldBeach = existingGid >= saltwindFirstgid && existingGid < saltwindFirstgid + 32;
        const point = { x: x + 0.5, y: y + 0.5 };
        const inDenseForest = isInsideOrNearPolygon(point, TAMZIA_DENSE_FOREST_AREA, 10);
        const inForest = isInsideOrNearPolygon(point, TAMZIA_FOREST_AREA, 10);
        if (inDenseForest || inForest) {
          if (isOldBeach) {
            groundData[localIndex] = inDenseForest && pointInPolygon(point, TAMZIA_DENSE_FOREST_AREA)
              ? elderwoodFirstgid + 2
              : emeraldFirstgid;
            terrainData[localIndex] = 0;
          }
          continue;
        }
        // Use a smoothly changing beach width instead of rectangular bands.
        // This keeps the sand edge irregular and shoreline-shaped while the
        // protected forest polygons above still stop it from spreading inland.
        const shorelineWobble = 4 * Math.sin(y / 23) + 3 * Math.sin(y / 57) + 2 * Math.sin((x + y) / 41);
        const northernWidth = 13 + 23 * Math.exp(-(((y - 270) / 48) ** 2));
        const linkWidth = 15 + 5 * Math.sin((y - 320) / 37);
        // A single broad bell curve gives the lower beach a rounded cove
        // instead of a horizontal, rectangular start line.
        const southernWidth = 3 + 49 * Math.exp(-(((y - 565) / 118) ** 2));
        const inNorthernInlet = y <= 340 && distance <= northernWidth + shorelineWobble;
        const inBeachMonsterCove = x <= 462 && y >= 235 && y <= 305 && distance <= 70
          && (((x - 414) / 55) ** 2 + ((y - 270) / 34) ** 2 <= 1);
        // The link is narrow on purpose: it joins the two coves without
        // turning the entire west coast into one uniform beach.
        const inCoastalLink = y >= 315 && y <= 460 && distance <= linkWidth + shorelineWobble;
        const inSouthernBeach = y >= 345 && distance <= southernWidth + shorelineWobble;
        if (!inNorthernInlet && !inBeachMonsterCove && !inCoastalLink && !inSouthernBeach) {
          if (isOldBeach) {
            groundData[localIndex] = emeraldFirstgid;
            terrainData[localIndex] = 0;
          }
          continue;
        }
        if (!distance || distance > BEACH_DEPTH) continue;
        // Keep the full selected cove in the warm sand palette. The pale
        // Saltwind transition tile read as a grey-green field and made both
        // beach encounter zones look as if their beach had disappeared.
        const beachGid = distance <= 20
          ? saltwindFirstgid + 7
          : saltwindFirstgid + 19;
        if (groundData[localIndex] !== beachGid) {
          groundData[localIndex] = beachGid;
          terrainData[localIndex] = 0;
          beachTiles += 1;
        }
      }
    }
    encodeLayer(ground, groundData);
    encodeLayer(terrainDetails, terrainData);
  }

  if (region.id === 'continent_01_region_0_0') {
    arenaTiles = applyTideglassArena(map, waterData, waterFirstgid).tiles;
  }

  shallow.opacity = COASTAL_RIPPLE_OPACITY;
  encodeLayer(water, waterData);
  encodeLayer(shallow, shallowData);
  return { changed, shallowTiles, beachTiles, arenaTiles };
}

const registry = readJson(REGISTRY_PATH);
const worldWidth = Number(registry.worldTiles.width);
const worldHeight = Number(registry.worldTiles.height);
const waterMask = new Uint8Array(worldWidth * worldHeight);
const records = registry.regions.map((region) => {
  const filePath = path.join(CONTINENT_ROOT, region.file);
  const map = readJson(filePath);
  const water = tileLayer(map, 'Water');
  const waterData = decodeLayer(water);
  const waterFirstgid = getWaterFirstgid(map);
  for (let y = 0; y < region.height; y += 1) {
    for (let x = 0; x < region.width; x += 1) {
      const localIndex = y * region.width + x;
      if (isWaterGid(waterData[localIndex] & GID_MASK, waterFirstgid)) {
        waterMask[(region.y + y) * worldWidth + region.x + x] = 1;
      }
    }
  }
  return { region, map, filePath, water, waterData, waterFirstgid };
});

const { ocean, count: oceanTiles } = markOcean(waterMask, worldWidth, worldHeight);
const coastDepth = buildCoastDepth(ocean, worldWidth, worldHeight);
const landCoastDepth = buildLandCoastDepth(ocean, worldWidth, worldHeight);
let changedWaterTiles = 0;
let rippleTiles = 0;
let beachTiles = 0;
let arenaTiles = 0;
records.forEach((record) => {
  const result = applyOceanToRegion(record, worldWidth, ocean, coastDepth, landCoastDepth);
  changedWaterTiles += result.changed;
  rippleTiles += result.shallowTiles;
  beachTiles += result.beachTiles;
  arenaTiles += result.arenaTiles;
  writeJson(record.filePath, record.map);
});

console.log(JSON.stringify({
  regions: records.length,
  oceanTiles,
  changedWaterTiles,
  rippleTiles,
  beachTiles,
  arenaTiles,
  coast: 'continuous global shallow-to-deep transition with animated ripples',
}, null, 2));
