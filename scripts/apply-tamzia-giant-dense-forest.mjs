import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 32;
const REGION_TILES = 800;
const MAP_ID = 'continent_01_region_0_0';
const MAP_PATH = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions', `${MAP_ID}.tmj`);
const CHUNK_DIR = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions/chunks');
const CHUNK_INDEX_PATH = path.join(CHUNK_DIR, 'continent_01_chunks.json');

const FOREST_TILESET_SOURCE = '../tilesets/tamzia_forest_v1.tsx';
const CHUNK_FOREST_TILESET_SOURCE = '../../tilesets/tamzia_forest_v1.tsx';
const DENSE_LAYER_NAME = 'tamzia_dense_forest';
const DENSE_GENERATOR_ID = 'tamzia_dense_forest_v1';
const TILED_GID_MASK = 0x1fffffff;
const FOREST_TILECOUNT = 64;

const DENSE_TREES = [
  { key: 'round_oak', id: 0, width: 128, height: 160, weight: 8, displayName: 'Tamzia Old Oak' },
  { key: 'pine', id: 8, width: 112, height: 160, weight: 27, displayName: 'Dark Pine' },
  { key: 'birch', id: 16, width: 96, height: 144, weight: 5, displayName: 'Pale Birch' },
  { key: 'deep_oak', id: 24, width: 128, height: 160, weight: 31, displayName: 'Deepwood Oak' },
  { key: 'young_tree', id: 32, width: 84, height: 120, weight: 9, displayName: 'Thicket Tree' },
  { key: 'cedar', id: 40, width: 112, height: 152, weight: 20, displayName: 'Dark Cedar' },
];

const DENSE_DETAILS = [
  { key: 'bramble_bush', id: 48, width: 74, height: 70, weight: 22, displayName: 'Thorn Bramble' },
  { key: 'round_bush', id: 49, width: 70, height: 62, weight: 8, displayName: 'Low Bush' },
  { key: 'fern_cluster', id: 50, width: 58, height: 58, weight: 15, displayName: 'Deep Ferns' },
  { key: 'grass_tuft', id: 51, width: 48, height: 44, weight: 10, displayName: 'Forest Grass' },
  { key: 'leaf_patch', id: 52, width: 78, height: 42, weight: 13, displayName: 'Leaf Litter' },
  { key: 'mushrooms', id: 53, width: 42, height: 36, weight: 3, displayName: 'Mushrooms' },
  { key: 'moss_rock', id: 54, width: 54, height: 42, weight: 8, displayName: 'Mossy Stone' },
  { key: 'fallen_log', id: 55, width: 90, height: 46, weight: 12, displayName: 'Fallen Log' },
  { key: 'stump', id: 56, width: 42, height: 44, weight: 5, displayName: 'Old Stump' },
  { key: 'forest_shadow', id: 58, width: 88, height: 40, weight: 14, displayName: 'Dense Canopy Shadow' },
  { key: 'ivy_patch', id: 59, width: 66, height: 42, weight: 10, displayName: 'Ivy Patch' },
  { key: 'firefly_glow', id: 60, width: 58, height: 74, weight: 2, displayName: 'Wisp Light' },
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value, pretty = false) {
  writeFileSync(filePath, `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`, 'utf8');
}

function getProperties(object) {
  return Object.fromEntries((object?.properties ?? []).map((property) => [property.name, property.value]));
}

function prop(name, type, value) {
  return { name, type, value };
}

function normalizeSource(source) {
  return String(source ?? '').replaceAll('\\', '/');
}

function decodeLayer(layer) {
  if (Array.isArray(layer?.data)) return Uint32Array.from(layer.data);
  if (layer?.encoding !== 'base64' || layer?.compression !== 'zlib' || typeof layer.data !== 'string') return new Uint32Array(0);
  const inflated = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(Math.floor(inflated.length / 4));
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

function ensureMapTileLayer(map, name, afterName, opacity = 0.46) {
  const existing = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
  if (existing) {
    existing.opacity = opacity;
    const currentIndex = map.layers.indexOf(existing);
    const afterIndex = map.layers.findIndex((candidate) => candidate.name === afterName);
    if (afterIndex >= 0 && currentIndex !== afterIndex + 1) {
      map.layers.splice(currentIndex, 1);
      const nextAfterIndex = map.layers.findIndex((candidate) => candidate.name === afterName);
      map.layers.splice(nextAfterIndex + 1, 0, existing);
    }
    return existing;
  }
  const template = tileLayer(map, 'Roads');
  const layer = {
    compression: 'zlib',
    data: '',
    encoding: 'base64',
    height: Number(template.height ?? REGION_TILES),
    id: Math.max(0, ...map.layers.map((candidate) => Number(candidate.id ?? 0))) + 1,
    name,
    opacity,
    type: 'tilelayer',
    visible: true,
    width: Number(template.width ?? REGION_TILES),
    x: 0,
    y: 0,
  };
  encodeLayer(layer, new Uint32Array(layer.width * layer.height));
  const afterIndex = map.layers.findIndex((candidate) => candidate.name === afterName);
  map.layers.splice(afterIndex >= 0 ? afterIndex + 1 : map.layers.length, 0, layer);
  return layer;
}

function objectLayer(map, name, afterName = null) {
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
  const afterIndex = map.layers.findIndex((candidate) => candidate.name === afterName);
  map.layers.splice(afterIndex >= 0 ? afterIndex + 1 : map.layers.length, 0, layer);
  return layer;
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

function distance(a, b) {
  return Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y));
}

function distanceToSegment(point, a, b) {
  const deltaX = b.x - a.x;
  const deltaY = b.y - a.y;
  if (deltaX === 0 && deltaY === 0) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * deltaX + (point.y - a.y) * deltaY) / (deltaX * deltaX + deltaY * deltaY)));
  return Math.hypot(point.x - (a.x + deltaX * t), point.y - (a.y + deltaY * t));
}

function distanceToSegmentWithProgress(point, a, b) {
  const deltaX = b.x - a.x;
  const deltaY = b.y - a.y;
  const denominator = deltaX * deltaX + deltaY * deltaY;
  const progress = denominator > 0
    ? Math.max(0, Math.min(1, ((point.x - a.x) * deltaX + (point.y - a.y) * deltaY) / denominator))
    : 0;
  return {
    distance: Math.hypot(point.x - (a.x + deltaX * progress), point.y - (a.y + deltaY * progress)),
    progress,
  };
}

function distanceToPolygonEdge(point, polygon) {
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    closest = Math.min(closest, distanceToSegment(point, polygon[index], polygon[(index + 1) % polygon.length]));
  }
  return closest;
}

function polygonBounds(polygon) {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function hash01(a, b = 0, c = 0) {
  const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function weightedPick(items, roll) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let target = roll * total;
  for (const item of items) {
    target -= item.weight;
    if (target <= 0) return item;
  }
  return items[items.length - 1];
}

function maxObjectId(map) {
  return Math.max(0, ...(map.layers ?? []).flatMap((layer) => (layer.objects ?? []).map((object) => Number(object.id ?? 0))));
}

function isGeneratedDenseObject(object) {
  const properties = getProperties(object);
  return properties.generatedBy === DENSE_GENERATOR_ID || properties.denseForestArea === DENSE_LAYER_NAME;
}

function findDensePolygon(map) {
  const layer = objectLayer(map, DENSE_LAYER_NAME, 'tamzia_forest');
  const area = (layer.objects ?? []).find((object) => object.polygon?.length >= 3);
  if (!area) throw new Error(`Add a polygon to the "${DENSE_LAYER_NAME}" object layer before running this script.`);
  const polygon = area.polygon.map((point) => ({ x: Number(area.x ?? 0) + Number(point.x ?? 0), y: Number(area.y ?? 0) + Number(point.y ?? 0) }));
  return { layer, area, polygon };
}

function findGiantArena(map) {
  for (const layer of map.layers ?? []) {
    for (const object of layer.objects ?? []) {
      const properties = getProperties(object);
      const label = `${object.name ?? ''} ${object.type ?? ''} ${properties.spawnId ?? ''}`.toLowerCase();
      if (!label.includes('tamzia_giant') && !label.includes('tamzia_old_quarry_giant')) continue;
      return {
        center: { x: Number(object.x ?? 0) + Number(object.width ?? 0) / 2, y: Number(object.y ?? 0) + Number(object.height ?? 0) / 2 },
        clearRadius: Math.max(520, Math.max(Number(object.width ?? 0), Number(object.height ?? 0)) * 0.82),
      };
    }
  }
  throw new Error('Missing tamzia_giant boss spawn.');
}

function getTilesetFirstgid(map, source) {
  const tileset = map.tilesets.find((candidate) => normalizeSource(candidate.source) === normalizeSource(source));
  if (!tileset) throw new Error(`Missing map tileset ${source}.`);
  return Number(tileset.firstgid);
}

function makeForestObject({ id, tile, point, scale, kind, firstgid, phase = 0 }) {
  const width = Math.round(tile.width * scale);
  const height = Math.round(tile.height * scale);
  const animated = kind === 'dense_tree' || kind === 'dense_fx';
  return {
    gid: firstgid + tile.id + phase,
    height,
    id,
    name: '',
    opacity: 1,
    properties: [
      prop('type', 'string', kind),
      prop('displayName', 'string', tile.displayName),
      prop('spriteSheet', 'string', 'tamzia_forest_v1'),
      prop('generatedBy', 'string', DENSE_GENERATOR_ID),
      prop('denseForestArea', 'string', DENSE_LAYER_NAME),
      prop('encounterRole', 'string', 'tamzia_giant_lair'),
      prop('collision', 'bool', false),
      ...(animated ? [
        prop('animation', 'string', kind === 'dense_fx' ? 'firefly_glow' : 'canopy_sway'),
        prop('animationPhase', 'int', phase),
      ] : []),
    ],
    rotation: 0,
    type: kind,
    visible: true,
    width,
    x: Math.round(point.x - width / 2),
    y: Math.round(point.y),
  };
}

function generateDenseForest(map, polygon, arena, firstgid) {
  const bounds = polygonBounds(polygon);
  const blockedLayers = ['Water', 'RiverFlow', 'WaterEdges', 'Roads', 'CityBase', 'Buildings', 'CityRoofs', 'Collision'];
  const layerData = new Map();
  blockedLayers.forEach((name) => {
    const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
    if (layer) layerData.set(name, decodeLayer(layer));
  });
  const isBlocked = (point, radius = 1) => {
    const tileX = Math.floor(point.x / TILE);
    const tileY = Math.floor(point.y / TILE);
    for (let y = tileY - radius; y <= tileY + radius; y += 1) {
      for (let x = tileX - radius; x <= tileX + radius; x += 1) {
        if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) return true;
        for (const data of layerData.values()) {
          if ((data[y * REGION_TILES + x] ?? 0) & TILED_GID_MASK) return true;
        }
      }
    }
    return false;
  };
  const objects = [];
  const treeAnchors = [];
  let nextId = maxObjectId(map) + 1;
  const addObject = (tile, point, kind, scale = 1) => {
    const phase = kind === 'dense_tree'
      ? Math.floor(hash01(point.x, point.y, 5101) * 8)
      : kind === 'dense_fx'
        ? Math.floor(hash01(point.x, point.y, 5102) * 4)
        : 0;
    const object = makeForestObject({ id: nextId, tile, point, scale, kind, firstgid, phase });
    nextId += 1;
    objects.push(object);
    if (kind === 'dense_tree') treeAnchors.push(point);
  };
  const isTooClose = (point, distanceLimit) => treeAnchors.some((other) => distance(point, other) < distanceLimit);
  const validPoint = (point, radius = 2, arenaBuffer = arena.clearRadius) => (
    pointInPolygon(point, polygon)
    && distance(point, arena.center) >= arenaBuffer
    && !isBlocked(point, radius)
  );

  const treeStep = 154;
  for (let y = bounds.minY + 78; y <= bounds.maxY - 70; y += treeStep) {
    for (let x = bounds.minX + 76; x <= bounds.maxX - 66; x += treeStep) {
      const cellX = Math.floor(x / treeStep);
      const cellY = Math.floor(y / treeStep);
      const point = { x: x + (hash01(cellX, cellY, 31) - 0.5) * 112, y: y + (hash01(cellX, cellY, 32) - 0.5) * 112 };
      if (!validPoint(point, 3)) continue;
      const arenaDistance = distance(point, arena.center);
      const edgeFactor = clamp(distanceToPolygonEdge(point, polygon) / 560, 0.2, 1);
      const ringFactor = clamp(1 - Math.abs(arenaDistance - (arena.clearRadius + 250)) / 390, 0, 1);
      const density = clamp(0.34 + edgeFactor * 0.18 + ringFactor * 0.21 + hash01(cellX, cellY, 33) * 0.16, 0.22, 0.78);
      if (hash01(cellX, cellY, 34) > density) continue;
      const tree = weightedPick(DENSE_TREES, hash01(cellX, cellY, 35));
      if (isTooClose(point, tree.key === 'young_tree' ? 80 : 108)) continue;
      addObject(tree, point, 'dense_tree', 0.9 + hash01(cellX, cellY, 36) * 0.22);
    }
  }

  const detailStep = 106;
  for (let y = bounds.minY + 44; y <= bounds.maxY - 34; y += detailStep) {
    for (let x = bounds.minX + 42; x <= bounds.maxX - 32; x += detailStep) {
      const cellX = Math.floor(x / detailStep);
      const cellY = Math.floor(y / detailStep);
      const point = { x: x + (hash01(cellX, cellY, 131) - 0.5) * 76, y: y + (hash01(cellX, cellY, 132) - 0.5) * 76 };
      if (!validPoint(point, 2)) continue;
      const nearTree = treeAnchors.some((tree) => distance(point, tree) < 210);
      const ringFactor = clamp(1 - Math.abs(distance(point, arena.center) - (arena.clearRadius + 210)) / 440, 0, 1);
      const chance = clamp(0.18 + (nearTree ? 0.24 : 0) + ringFactor * 0.16, 0.14, 0.62);
      if (hash01(cellX, cellY, 133) > chance) continue;
      const detail = weightedPick(DENSE_DETAILS, hash01(cellX, cellY, 134));
      const kind = detail.key === 'firefly_glow' ? 'dense_fx' : detail.key.includes('bush') ? 'dense_bush' : 'dense_detail';
      addObject(detail, point, kind, 0.84 + hash01(cellX, cellY, 135) * 0.22);
    }
  }

  const ringDetails = ['fallen_log', 'bramble_bush', 'forest_shadow', 'moss_rock'];
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2 + 0.18;
    const radius = arena.clearRadius + 120 + (index % 3) * 58;
    const point = { x: arena.center.x + Math.cos(angle) * radius, y: arena.center.y + Math.sin(angle) * radius };
    if (!validPoint(point, 1, arena.clearRadius + 50)) continue;
    const tile = DENSE_DETAILS.find((candidate) => candidate.key === ringDetails[index % ringDetails.length]);
    if (tile) addObject(tile, point, tile.key.includes('bush') ? 'dense_bush' : 'dense_detail', 0.92 + (index % 2) * 0.08);
  }
  return objects.sort((a, b) => (Number(a.y) - Number(b.y)) || (Number(a.x) - Number(b.x)));
}

function expandBounds(bounds, amountX, amountY) {
  return { minX: bounds.minX - amountX, maxX: bounds.maxX + amountX, minY: bounds.minY - amountY, maxY: bounds.maxY + amountY };
}

function containsPoint(bounds, point) {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function repaintDirtRoad(roadData, roadGid, points, seed, mark) {
  const minX = Math.max(0, Math.floor(Math.min(...points.map((point) => point.x - point.radius)) - 2));
  const maxX = Math.min(REGION_TILES - 1, Math.ceil(Math.max(...points.map((point) => point.x + point.radius)) + 2));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y - point.radius)) - 2));
  const maxY = Math.min(REGION_TILES - 1, Math.ceil(Math.max(...points.map((point) => point.y + point.radius)) + 2));
  for (let tileY = minY; tileY <= maxY; tileY += 1) {
    for (let tileX = minX; tileX <= maxX; tileX += 1) {
      const index = tileY * REGION_TILES + tileX;
      if (roadData[index] === roadGid) {
        roadData[index] = 0;
        mark(tileX, tileY);
      }
    }
  }
  for (let tileY = minY; tileY <= maxY; tileY += 1) {
    for (let tileX = minX; tileX <= maxX; tileX += 1) {
      const center = { x: tileX + 0.5, y: tileY + 0.5 };
      let closest = Number.POSITIVE_INFINITY;
      for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index];
        const b = points[index + 1];
        const result = distanceToSegmentWithProgress(center, a, b);
        const radius = a.radius + (b.radius - a.radius) * result.progress;
        closest = Math.min(closest, result.distance - radius);
      }
      // Keep the middle of the road solid; only the outer one tile receives a
      // low-frequency irregularity so it reads as a travelled dirt path.
      const edgeNoise = (hash01(Math.floor(tileX / 3), Math.floor(tileY / 3), seed) - 0.5) * 0.85;
      if (closest <= edgeNoise) {
        roadData[tileY * REGION_TILES + tileX] = roadGid;
        mark(tileX, tileY);
      }
    }
  }
}

function mergeTileBounds(first, second) {
  if (!first) return second;
  if (!second) return first;
  return {
    minX: Math.min(first.minX, second.minX),
    minY: Math.min(first.minY, second.minY),
    maxX: Math.max(first.maxX, second.maxX),
    maxY: Math.max(first.maxY, second.maxY),
  };
}

function applyFloodedFord(map) {
  const water = tileLayer(map, 'Water');
  const roads = tileLayer(map, 'Roads');
  const collision = tileLayer(map, 'Collision');
  const submergedRoad = ensureMapTileLayer(map, 'SubmergedRoad', 'Roads', 0.56);
  const shallowWater = ensureMapTileLayer(map, 'ShallowWater', 'SubmergedRoad');
  const waterData = decodeLayer(water);
  const roadData = decodeLayer(roads);
  const submergedRoadData = decodeLayer(submergedRoad);
  const collisionData = decodeLayer(collision);
  const shallowData = new Uint32Array(shallowWater.width * shallowWater.height);
  const waterFirstgid = getTilesetFirstgid(map, '../tilesets/world_v3_water.tsx');
  const saltwindFirstgid = getTilesetFirstgid(map, '../tilesets/world_v3_saltwind.tsx');
  const emeraldFirstgid = getTilesetFirstgid(map, '../tilesets/world_v3_emerald_vale.tsx');
  const deepWaterGid = waterFirstgid;
  const middleWaterGid = waterFirstgid + 2;
  const shallowWaterGid = waterFirstgid + 4;
  const rippleWaterGid = waterFirstgid + 6;
  const roadGid = emeraldFirstgid + 4;
  const touched = { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: -1, maxY: -1 };
  const mark = (x, y) => {
    touched.minX = Math.min(touched.minX, x);
    touched.minY = Math.min(touched.minY, y);
    touched.maxX = Math.max(touched.maxX, x);
    touched.maxY = Math.max(touched.maxY, y);
  };

  // The old path used a narrow Saltwind road strip. Replace it with the same
  // gently tapering Tamzia route, then let the shallow-water overlay soften it.
  for (let tileY = 708; tileY <= 799; tileY += 1) {
    for (let tileX = 518; tileX <= 557; tileX += 1) {
      const index = tileY * REGION_TILES + tileX;
      if ((roadData[index] & TILED_GID_MASK) === saltwindFirstgid + 5) {
        roadData[index] = 0;
        mark(tileX, tileY);
      }
    }
  }
  // The solid dirt path ends at the waterline. A separate blue water layer
  // below carries the submerged continuation, so it no longer reads as a dry
  // road jutting into the sea.
  for (let tileY = 746; tileY <= 799; tileY += 1) {
    for (let tileX = 528; tileX <= 558; tileX += 1) {
      const index = tileY * REGION_TILES + tileX;
      if ((roadData[index] & TILED_GID_MASK) === roadGid) {
        roadData[index] = 0;
        mark(tileX, tileY);
      }
      if (submergedRoadData[index]) {
        submergedRoadData[index] = 0;
        mark(tileX, tileY);
      }
    }
  }
  const dryFordRoad = [
    { x: 536.5, y: 710, radius: 4.2 },
    { x: 536.5, y: 734, radius: 4.1 },
    { x: 538, y: 746.5, radius: 3.3 },
    { x: 539.5, y: 752, radius: 2.2 },
  ];
  repaintDirtRoad(roadData, roadGid, dryFordRoad, 1017, mark);
  for (let tileY = 754; tileY <= 799; tileY += 1) {
    for (let tileX = 528; tileX <= 558; tileX += 1) {
      const index = tileY * REGION_TILES + tileX;
      if ((roadData[index] & TILED_GID_MASK) === roadGid) {
        roadData[index] = 0;
        mark(tileX, tileY);
      }
    }
  }
  const submergedFordRoad = [
    { x: 539.5, y: 753, radius: 2.65 },
    { x: 541.5, y: 761, radius: 2.35 },
    { x: 544, y: 770, radius: 1.9 },
    { x: 547, y: 777, radius: 1.25 },
    { x: 549, y: 781, radius: 0.65 },
  ];
  repaintDirtRoad(submergedRoadData, middleWaterGid, submergedFordRoad, 1349, mark);

  // Find the lake connected to the flooded end of the road and calculate a
  // shore-to-depth gradient. The first 3 tiles are a passable ford, then the
  // water becomes visibly deeper and remains blocked.
  const startX = 536;
  const startY = 760;
  let start = -1;
  for (let radius = 0; radius <= 32 && start < 0; radius += 1) {
    for (let y = startY - radius; y <= startY + radius && start < 0; y += 1) {
      for (let x = startX - radius; x <= startX + radius; x += 1) {
        if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) continue;
        const index = y * REGION_TILES + x;
        const gid = waterData[index] & TILED_GID_MASK;
        if (gid === deepWaterGid || gid === middleWaterGid || gid === shallowWaterGid) {
          start = index;
          break;
        }
      }
    }
  }
  if (start < 0) throw new Error('Could not locate the southern deep-water body for the Tamzia ford.');
  const inLake = new Uint8Array(waterData.length);
  const lakeCells = [];
  const queue = [start];
  inLake[start] = 1;
  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    lakeCells.push(current);
    const tileX = current % REGION_TILES;
    const tileY = Math.floor(current / REGION_TILES);
    [[tileX - 1, tileY], [tileX + 1, tileY], [tileX, tileY - 1], [tileX, tileY + 1]].forEach(([nextX, nextY]) => {
      if (nextX < 0 || nextY < 0 || nextX >= REGION_TILES || nextY >= REGION_TILES) return;
      const next = nextY * REGION_TILES + nextX;
      const gid = waterData[next] & TILED_GID_MASK;
      if (inLake[next] || (gid !== deepWaterGid && gid !== middleWaterGid && gid !== shallowWaterGid)) return;
      inLake[next] = 1;
      queue.push(next);
    });
  }
  const depth = new Int16Array(waterData.length);
  depth.fill(-1);
  const frontier = [];
  lakeCells.forEach((index) => {
    const tileX = index % REGION_TILES;
    const tileY = Math.floor(index / REGION_TILES);
    const isShore = [[tileX - 1, tileY], [tileX + 1, tileY], [tileX, tileY - 1], [tileX, tileY + 1]].some(([nextX, nextY]) => (
      nextX < 0 || nextY < 0 || nextX >= REGION_TILES || nextY >= REGION_TILES || !inLake[nextY * REGION_TILES + nextX]
    ));
    if (!isShore) return;
    depth[index] = 1;
    frontier.push(index);
  });
  head = 0;
  while (head < frontier.length) {
    const current = frontier[head];
    head += 1;
    const tileX = current % REGION_TILES;
    const tileY = Math.floor(current / REGION_TILES);
    [[tileX - 1, tileY], [tileX + 1, tileY], [tileX, tileY - 1], [tileX, tileY + 1]].forEach(([nextX, nextY]) => {
      if (nextX < 0 || nextY < 0 || nextX >= REGION_TILES || nextY >= REGION_TILES) return;
      const next = nextY * REGION_TILES + nextX;
      if (!inLake[next] || depth[next] >= 0) return;
      depth[next] = depth[current] + 1;
      frontier.push(next);
    });
  }
  const waterCollisionGid = collisionData[start] || 5393;
  lakeCells.forEach((index) => {
    const tileX = index % REGION_TILES;
    const tileY = Math.floor(index / REGION_TILES);
    const distanceFromShore = depth[index];
    const onRoad = (roadData[index] & TILED_GID_MASK) === roadGid;
    const onSubmergedRoad = (submergedRoadData[index] & TILED_GID_MASK) === middleWaterGid;
    const isFordRoad = (onRoad || onSubmergedRoad) && tileY >= 752 && tileX >= 528 && tileX <= 558;
    // The path stays wadeable for a short stretch after it enters the lake,
    // then deliberately fades out below the surface instead of ending in a hard edge.
    const fordDepth = !isFordRoad ? distanceFromShore
      : tileY <= 765 ? 1
        : tileY <= 777 ? 3
          : tileY <= 782 ? 5
            : 6;
    if (fordDepth <= 2) waterData[index] = shallowWaterGid;
    else if (fordDepth <= 5) waterData[index] = middleWaterGid;
    else waterData[index] = deepWaterGid;
    if (fordDepth <= 4) collisionData[index] = 0;
    else collisionData[index] = waterCollisionGid;
    if (fordDepth <= 5 || isFordRoad) shallowData[index] = rippleWaterGid;
    mark(tileX, tileY);
  });
  shallowWater.opacity = 0.46;
  encodeLayer(water, waterData);
  encodeLayer(roads, roadData);
  encodeLayer(submergedRoad, submergedRoadData);
  encodeLayer(collision, collisionData);
  encodeLayer(shallowWater, shallowData);
  return touched.maxX >= 0 ? touched : null;
}

function updateTerrainAndRoads(map, polygon, arena) {
  const ground = tileLayer(map, 'Ground');
  const terrainDetails = tileLayer(map, 'TerrainDetails');
  const roads = tileLayer(map, 'Roads');
  const water = tileLayer(map, 'Water');
  const groundData = decodeLayer(ground);
  const terrainData = decodeLayer(terrainDetails);
  const roadData = decodeLayer(roads);
  const waterData = decodeLayer(water);
  const elderwoodFirstgid = getTilesetFirstgid(map, '../tilesets/world_v3_elderwood.tsx');
  const emeraldFirstgid = getTilesetFirstgid(map, '../tilesets/world_v3_emerald_vale.tsx');
  const saltwindFirstgid = getTilesetFirstgid(map, '../tilesets/world_v3_saltwind.tsx');
  const focus = expandBounds(polygonBounds(polygon), 1500, 1550);
  const touched = { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: -1, maxY: -1 };
  const mark = (x, y) => {
    touched.minX = Math.min(touched.minX, x);
    touched.minY = Math.min(touched.minY, y);
    touched.maxX = Math.max(touched.maxX, x);
    touched.maxY = Math.max(touched.maxY, y);
  };
  const isElderwoodGround = (gid) => gid >= elderwoodFirstgid && gid <= elderwoodFirstgid + 3;
  const isElderwoodDetail = (gid) => gid >= elderwoodFirstgid + 7 && gid <= elderwoodFirstgid + 22;
  const isSaltwindLand = (gid) => (
    (gid >= saltwindFirstgid && gid <= saltwindFirstgid + 5)
    || (gid >= saltwindFirstgid + 7 && gid <= saltwindFirstgid + 31)
  );
  const isSaltwindDetail = (gid) => gid >= saltwindFirstgid && gid < saltwindFirstgid + 256;
  const isNearWater = (tileX, tileY, radius = 7) => {
    for (let y = Math.max(0, tileY - radius); y <= Math.min(REGION_TILES - 1, tileY + radius); y += 1) {
      for (let x = Math.max(0, tileX - radius); x <= Math.min(REGION_TILES - 1, tileX + radius); x += 1) {
        if (Math.max(Math.abs(x - tileX), Math.abs(y - tileY)) <= radius && (waterData[y * REGION_TILES + x] & TILED_GID_MASK)) return true;
      }
    }
    return false;
  };

  for (let tileY = Math.max(0, Math.floor(focus.minY / TILE)); tileY <= Math.min(REGION_TILES - 1, Math.ceil(focus.maxY / TILE)); tileY += 1) {
    for (let tileX = Math.max(0, Math.floor(focus.minX / TILE)); tileX <= Math.min(REGION_TILES - 1, Math.ceil(focus.maxX / TILE)); tileX += 1) {
      const index = tileY * REGION_TILES + tileX;
      const point = { x: (tileX + 0.5) * TILE, y: (tileY + 0.5) * TILE };
      const groundGid = groundData[index] & TILED_GID_MASK;
      const detailGid = terrainData[index] & TILED_GID_MASK;
      if (pointInPolygon(point, polygon)) {
        const arenaDistance = distance(point, arena.center);
        const edgeDistance = distanceToPolygonEdge(point, polygon);
        const target = arenaDistance < arena.clearRadius * 1.05 || edgeDistance < 260
          ? elderwoodFirstgid + 3
          : elderwoodFirstgid + 2;
        if (groundGid !== target) {
          groundData[index] = target;
          mark(tileX, tileY);
        }
      } else if (containsPoint(focus, point) && isElderwoodGround(groundGid)) {
        groundData[index] = emeraldFirstgid;
        if (isElderwoodDetail(detailGid)) terrainData[index] = 0;
        mark(tileX, tileY);
      }
    }
  }

  for (let index = 0; index < roadData.length; index += 1) {
    const gid = roadData[index] & TILED_GID_MASK;
    let replacement = 0;
    if (gid === elderwoodFirstgid + 4) replacement = emeraldFirstgid + 4;
    // Elderwood's second road tile has no Emerald Vale counterpart. The
    // adjacent Emerald tile is water, which caused holes and thin strips.
    // Use the complete Tamzia road tile for both darker legacy variants.
    if (gid === elderwoodFirstgid + 5 || gid === emeraldFirstgid + 5) replacement = emeraldFirstgid + 4;
    if (!replacement) continue;
    roadData[index] = replacement;
    mark(index % REGION_TILES, Math.floor(index / REGION_TILES));
  }

  // The broad grey-gold Saltwind floor leaked into Tamzia's southern coast.
  // Restore its exposed land to the same grass used around the forest while
  // leaving actual water, roads, and the deliberate dense-forest patch alone.
  for (let index = 0; index < groundData.length; index += 1) {
    const groundGid = groundData[index] & TILED_GID_MASK;
    const waterGid = waterData[index] & TILED_GID_MASK;
    const tileX = index % REGION_TILES;
    const tileY = Math.floor(index / REGION_TILES);
    if (waterGid || !isSaltwindLand(groundGid) || isNearWater(tileX, tileY, 70)) continue;
    groundData[index] = emeraldFirstgid;
    const detailGid = terrainData[index] & TILED_GID_MASK;
    if (isSaltwindDetail(detailGid)) terrainData[index] = 0;
    mark(tileX, tileY);
  }

  const standardRoadGid = emeraldFirstgid + 4;
  // South-east approach: the old six-tile ribbon was too thin for a travelled
  // route. A gently widening, irregular strip keeps the original route while
  // matching the road weight around Tamzia.
  repaintDirtRoad(roadData, standardRoadGid, [
    { x: 461.5, y: 522, radius: 3.8 },
    { x: 477.5, y: 561, radius: 4.1 },
    { x: 499.5, y: 614, radius: 4.4 },
    { x: 522.5, y: 670, radius: 4.5 },
    { x: 536.5, y: 713, radius: 4.0 },
  ], 812, mark);
  // Northern approach: rebuild the abrupt blocky join as a shallow curve with
  // a modest taper at both ends rather than a perfectly rectangular road.
  repaintDirtRoad(roadData, standardRoadGid, [
    { x: 568.5, y: 474.5, radius: 2.6 },
    { x: 587.5, y: 486.5, radius: 3.8 },
    { x: 610.5, y: 497.5, radius: 4.5 },
    { x: 674.5, y: 500.5, radius: 4.8 },
    { x: 731.5, y: 501.5, radius: 4.7 },
    { x: 760.5, y: 503.5, radius: 3.5 },
  ], 913, mark);

  // The old Elderwood ground extended far past the giant encounter. Keep the
  // dark treatment only on the explicit dense-forest polygon; every detached
  // dark-green island is restored to the regular Tamzia grass palette.
  const visited = new Uint8Array(groundData.length);
  const deepGround = new Set([elderwoodFirstgid + 2, elderwoodFirstgid + 3]);
  for (let start = 0; start < groundData.length; start += 1) {
    if (visited[start] || !deepGround.has(groundData[start] & TILED_GID_MASK)) continue;
    const cells = [];
    const queue = [start];
    let head = 0;
    let belongsToDenseForest = false;
    visited[start] = 1;
    while (head < queue.length) {
      const current = queue[head];
      head += 1;
      cells.push(current);
      const tileX = current % REGION_TILES;
      const tileY = Math.floor(current / REGION_TILES);
      if (pointInPolygon({ x: (tileX + 0.5) * TILE, y: (tileY + 0.5) * TILE }, polygon)) belongsToDenseForest = true;
      [[tileX - 1, tileY], [tileX + 1, tileY], [tileX, tileY - 1], [tileX, tileY + 1]].forEach(([nextX, nextY]) => {
        if (nextX < 0 || nextY < 0 || nextX >= REGION_TILES || nextY >= REGION_TILES) return;
        const next = nextY * REGION_TILES + nextX;
        if (visited[next] || !deepGround.has(groundData[next] & TILED_GID_MASK)) return;
        visited[next] = 1;
        queue.push(next);
      });
    }
    if (belongsToDenseForest) continue;
    cells.forEach((index) => {
      groundData[index] = emeraldFirstgid;
      if (isElderwoodDetail(terrainData[index] & TILED_GID_MASK)) terrainData[index] = 0;
      mark(index % REGION_TILES, Math.floor(index / REGION_TILES));
    });
  }
  encodeLayer(ground, groundData);
  encodeLayer(terrainDetails, terrainData);
  encodeLayer(roads, roadData);
  return touched.maxX >= 0 ? touched : null;
}

function objectVisualBounds(object) {
  const width = Math.max(1, Number(object.width ?? 1));
  const height = Math.max(1, Number(object.height ?? 1));
  const isTileObject = (Number(object.gid ?? 0) & TILED_GID_MASK) > 0;
  return { x: Number(object.x ?? 0), y: Number(object.y ?? 0) - (isTileObject ? height : 0), width, height };
}

function intersects(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

function ensureChunkLayer(chunk, name) {
  let layer = chunk.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === name);
  if (layer) return layer;
  layer = { type: 'objectgroup', name, visible: true, opacity: 1, objects: [] };
  const afterIndex = chunk.layers.findIndex((candidate) => candidate.name === 'tamzia_bandit_forest');
  chunk.layers.splice(afterIndex >= 0 ? afterIndex + 1 : chunk.layers.length, 0, layer);
  return layer;
}

function ensureChunkTileLayer(chunk, name, afterName, opacity = 0.46) {
  const existing = chunk.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
  if (existing) {
    existing.opacity = opacity;
    return existing;
  }
  const template = chunk.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === 'Roads');
  const width = Number(template?.width ?? chunk.width ?? 128);
  const height = Number(template?.height ?? chunk.height ?? 128);
  const layer = { type: 'tilelayer', name, visible: true, opacity, width, height, encoding: 'base64', compression: 'zlib', data: '' };
  encodeLayer(layer, new Uint32Array(width * height));
  const afterIndex = chunk.layers.findIndex((candidate) => candidate.name === afterName);
  chunk.layers.splice(afterIndex >= 0 ? afterIndex + 1 : chunk.layers.length, 0, layer);
  return layer;
}

function convertForestGid(gid, mapFirstgid, chunkFirstgid) {
  const normalized = Number(gid ?? 0) & TILED_GID_MASK;
  return normalized >= mapFirstgid && normalized < mapFirstgid + FOREST_TILECOUNT
    ? normalized + (chunkFirstgid - mapFirstgid)
    : Number(gid ?? 0);
}

function syncChunks(map, denseObjects, terrainBounds) {
  const index = readJson(CHUNK_INDEX_PATH);
  const mapFirstgid = getTilesetFirstgid(map, FOREST_TILESET_SOURCE);
  const chunkTileset = index.tilesets.find((candidate) => normalizeSource(candidate.source) === normalizeSource(CHUNK_FOREST_TILESET_SOURCE));
  if (!chunkTileset) throw new Error(`Missing chunk tileset ${CHUNK_FOREST_TILESET_SOURCE}.`);
  const chunkFirstgid = Number(chunkTileset.firstgid);
  index.objectLayers ??= [];
  if (!index.objectLayers.includes(DENSE_LAYER_NAME)) index.objectLayers.push(DENSE_LAYER_NAME);
  index.layers ??= [];
  if (!index.layers.includes('SubmergedRoad')) {
    const roadsIndex = index.layers.indexOf('Roads');
    index.layers.splice(roadsIndex >= 0 ? roadsIndex + 1 : index.layers.length, 0, 'SubmergedRoad');
  }
  if (!index.layers.includes('ShallowWater')) {
    const submergedIndex = index.layers.indexOf('SubmergedRoad');
    index.layers.splice(submergedIndex >= 0 ? submergedIndex + 1 : index.layers.length, 0, 'ShallowWater');
  }
  writeJson(CHUNK_INDEX_PATH, index, true);
  const sourceLayers = new Map(['Ground', 'TerrainDetails', 'Roads', 'SubmergedRoad', 'ShallowWater', 'Water', 'Collision'].map((name) => [name, tileLayer(map, name)]));
  const changedChunks = [];
  for (const chunkInfo of index.chunks ?? []) {
    const chunkTileX = Number(chunkInfo.x ?? chunkInfo.tileX ?? 0);
    const chunkTileY = Number(chunkInfo.y ?? chunkInfo.tileY ?? 0);
    const chunkWidth = Number(chunkInfo.width ?? 128);
    const chunkHeight = Number(chunkInfo.height ?? 128);
    const chunkBounds = { x: chunkTileX * TILE, y: chunkTileY * TILE, width: chunkWidth * TILE, height: chunkHeight * TILE };
    const terrainIntersects = terrainBounds && intersects(
      { x: terrainBounds.minX * TILE, y: terrainBounds.minY * TILE, width: (terrainBounds.maxX - terrainBounds.minX + 1) * TILE, height: (terrainBounds.maxY - terrainBounds.minY + 1) * TILE },
      chunkBounds,
    );
    const chunkObjects = denseObjects.filter((object) => intersects(objectVisualBounds(object), chunkBounds));
    if (!terrainIntersects && !chunkObjects.length) continue;
    const chunkPath = path.join(CHUNK_DIR, chunkInfo.file);
    if (!existsSync(chunkPath)) continue;
    const chunk = readJson(chunkPath);
    if (terrainIntersects) {
      for (const [name, sourceLayer] of sourceLayers) {
        const layer = name === 'SubmergedRoad'
          ? ensureChunkTileLayer(chunk, name, 'Roads', 0.56)
          : name === 'ShallowWater'
            ? ensureChunkTileLayer(chunk, name, 'SubmergedRoad')
            : chunk.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
        if (!layer) continue;
        const sourceData = decodeLayer(sourceLayer);
        const targetData = new Uint32Array(chunkWidth * chunkHeight);
        for (let localY = 0; localY < chunkHeight; localY += 1) {
          for (let localX = 0; localX < chunkWidth; localX += 1) {
            const sourceX = chunkTileX + localX;
            const sourceY = chunkTileY + localY;
            if (sourceX >= 0 && sourceY >= 0 && sourceX < REGION_TILES && sourceY < REGION_TILES) {
              targetData[localY * chunkWidth + localX] = sourceData[sourceY * REGION_TILES + sourceX] ?? 0;
            }
          }
        }
        encodeLayer(layer, targetData);
      }
    }
    const layer = ensureChunkLayer(chunk, DENSE_LAYER_NAME);
    layer.objects = chunkObjects.map((object) => ({
      ...object,
      gid: convertForestGid(object.gid, mapFirstgid, chunkFirstgid),
      x: Number(object.x ?? 0) - chunkBounds.x,
      y: Number(object.y ?? 0) - chunkBounds.y,
      sourceMapId: MAP_ID,
    }));
    writeJson(chunkPath, chunk, false);
    changedChunks.push({ id: chunkInfo.id, objects: chunkObjects.length });
  }
  return changedChunks;
}

const map = readJson(MAP_PATH);
const { layer: denseLayer, area: denseArea, polygon } = findDensePolygon(map);
const arena = findGiantArena(map);
const forestFirstgid = getTilesetFirstgid(map, FOREST_TILESET_SOURCE);
const preserved = (denseLayer.objects ?? []).filter((object) => object === denseArea || !isGeneratedDenseObject(object));
const denseObjects = generateDenseForest(map, polygon, arena, forestFirstgid);
denseLayer.draworder = 'topdown';
denseLayer.objects = [denseArea, ...preserved.filter((object) => object !== denseArea), ...denseObjects]
  .sort((a, b) => a === denseArea ? -1 : b === denseArea ? 1 : (Number(a.y ?? 0) - Number(b.y ?? 0)) || (Number(a.x ?? 0) - Number(b.x ?? 0)));
map.nextobjectid = Math.max(Number(map.nextobjectid ?? 1), maxObjectId(map) + 1);
const terrainBounds = updateTerrainAndRoads(map, polygon, arena);
const fordBounds = applyFloodedFord(map);
writeJson(MAP_PATH, map, true);
const changedChunks = syncChunks(map, denseObjects, mergeTileBounds(terrainBounds, fordBounds));
const counts = denseObjects.reduce((summary, object) => {
  const type = getProperties(object).type ?? 'unknown';
  summary[type] = (summary[type] ?? 0) + 1;
  return summary;
}, {});

console.log(JSON.stringify({
  layer: DENSE_LAYER_NAME,
  giantArena: { x: Math.round(arena.center.x), y: Math.round(arena.center.y), clearRadius: arena.clearRadius },
  objects: denseObjects.length,
  counts,
  changedChunks: changedChunks.length,
  terrainChanged: Boolean(terrainBounds),
  floodedFord: Boolean(fordBounds),
  roads: 'elderwood road tiles remapped to the standard Tamzia road palette',
}, null, 2));
