import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_PATH = path.join(
  ROOT,
  'public',
  'maps',
  'world_map',
  'continents',
  'continent_01',
  'regions',
  'continent_01_region_1_0.tmj',
);
const LEFT_MAP_PATH = path.join(
  ROOT,
  'public',
  'maps',
  'world_map',
  'continents',
  'continent_01',
  'regions',
  'continent_01_region_0_0.tmj',
);
const EAST_MAP_PATH = path.join(
  ROOT,
  'public',
  'maps',
  'world_map',
  'continents',
  'continent_01',
  'regions',
  'continent_01_region_2_0.tmj',
);
const SOUTH_MAP_PATH = path.join(
  ROOT,
  'public',
  'maps',
  'world_map',
  'continents',
  'continent_01',
  'regions',
  'continent_01_region_1_1.tmj',
);
const BRIGHTWATER_BRIDGE_TILESET_SOURCE = '../../../../../tilesets/brightwater_ford_bridge_v1.tsx';
const LEGACY_BRIGHTWATER_BRIDGE_TILESET_SOURCE = '../../../../../tilesets/human_starting_bridge_v4.tsx';
const BRIGHTWATER_BRIDGE_FIRST_GID = 30032;

const WATER_GID = 3073;
const COLLISION_GID = 5393;
const PROPS_FIRST_GID = 5137;
const EMERALD_GRASS = 1;
const EMERALD_DETAIL = 2;
const SILVER_GRASS = 769;
const SILVER_DETAIL = 772;

const LAKE_DECOR = {
  reeds: PROPS_FIRST_GID + 10,
  rockSmall: PROPS_FIRST_GID + 12,
  log: PROPS_FIRST_GID + 15,
  boat: PROPS_FIRST_GID + 128,
};

const tributary = [
  [0, 339], [18, 350], [37, 365], [57, 380], [79, 394], [103, 410],
  [129, 428], [154, 445], [178, 457], [198, 461], [218, 460], [237, 458], [252, 462],
];
const upperRiver = [
  [268, 88], [264, 110], [266, 134], [272, 158], [277, 185], [276, 211],
  [280, 237], [287, 264], [291, 292], [297, 322], [301, 352], [301, 381],
  [297, 409], [290, 434], [280, 450], [266, 459], [252, 462],
];
// The two branches meet on the west side of Brightwater, then enter the lake
// together. This keeps the watercourse readable and avoids a dead-end branch
// underneath the settlement peninsula.
const brightwaterInlet = [
  [252, 462], [250, 474], [246, 488], [241, 501], [238, 514], [239, 526], [246, 538], [252, 546],
];
const routes = [tributary, upperRiver, brightwaterInlet];
const caveMountainPolygon = [
  [442.75, 413.25],
  [375.25, 347.25],
  [406.5, 299.5],
  [777.25, 443.75],
  [754.75, 545],
  [636.25, 470.25],
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function decodeLayerData(layer) {
  if (Array.isArray(layer?.data)) return Uint32Array.from(layer.data);
  if (layer?.encoding !== 'base64' || layer?.compression !== 'zlib') {
    throw new Error(`Cannot decode ${layer?.name ?? 'unknown'} layer.`);
  }
  const bytes = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(bytes.length / 4);
  for (let index = 0; index < data.length; index += 1) data[index] = bytes.readUInt32LE(index * 4);
  return data;
}

function encodeLayerData(layer, data) {
  const bytes = Buffer.alloc(data.length * 4);
  for (let index = 0; index < data.length; index += 1) bytes.writeUInt32LE(data[index] >>> 0, index * 4);
  layer.encoding = 'base64';
  layer.compression = 'zlib';
  layer.data = zlib.deflateSync(bytes, { level: 6 }).toString('base64');
}

function distanceToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared))
    : 0;
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
}

function routeDistance(x, y, route) {
  return Math.min(...route.slice(1).map((point, index) => distanceToSegment(x, y, route[index], point)));
}

function networkDistance(x, y) {
  return Math.min(...routes.map((route) => routeDistance(x, y, route)));
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = ((yi > y) !== (yj > y))
      && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function caveMountainEdgeDistance(x, y) {
  let distance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < caveMountainPolygon.length; i += 1) {
    const next = (i + 1) % caveMountainPolygon.length;
    distance = Math.min(distance, distanceToSegment(x, y, caveMountainPolygon[i], caveMountainPolygon[next]));
  }
  return distance;
}

function isCaveMountain(x, y) {
  return pointInPolygon(x + 0.5, y + 0.5, caveMountainPolygon);
}

function oldRiverDistance(x, y) {
  const oldTributary = [[0, 339], [52, 381], [104, 422], [160, 463], [210, 487], [258, 510]];
  const oldMain = [[268, 90], [270, 150], [280, 230], [296, 320], [306, 400], [289, 480], [266, 510]];
  return Math.min(routeDistance(x, y, oldTributary), routeDistance(x, y, oldMain));
}

function hash2(x, y) {
  let value = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 2246822519) >>> 0;
  value ^= value >>> 13;
  return value >>> 0;
}

function smoothstep(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function valueNoise(x, y, scale, seed = 0) {
  const scaledX = x / scale;
  const scaledY = y / scale;
  const cellX = Math.floor(scaledX);
  const cellY = Math.floor(scaledY);
  const blendX = smoothstep(scaledX - cellX);
  const blendY = smoothstep(scaledY - cellY);
  const sample = (sampleX, sampleY) => (hash2(sampleX + seed, sampleY - seed) & 0xffff) / 0xffff;
  const top = sample(cellX, cellY) + (sample(cellX + 1, cellY) - sample(cellX, cellY)) * blendX;
  const bottom = sample(cellX, cellY + 1)
    + (sample(cellX + 1, cellY + 1) - sample(cellX, cellY + 1)) * blendX;
  return top + (bottom - top) * blendY;
}

function naturalRiverRadius(x, y, baseRadius, seed = 0) {
  const broadMeander = Math.sin(x * 0.083 + y * 0.049 + seed) * 0.45
    + Math.sin(x * 0.027 - y * 0.071 + seed * 0.7) * 0.3;
  const bankWobble = (valueNoise(x, y, 7, 911 + seed * 37) - 0.5) * 1.15;
  return Math.max(3.75, baseRadius + broadMeander + bankWobble);
}

function grassFor(x, y, detail = false) {
  const boundary = 118 + Math.sin(y * 0.045) * 18 + Math.sin(y * 0.017) * 10;
  const blend = Math.max(0, Math.min(1, (x - boundary + 16) / 32));
  const silver = blend >= 1 || (blend > 0 && (hash2(x, y) % 100) < Math.round(blend * 100));
  const variation = hash2(x, y) % 100;
  if (silver) {
    if (variation < (detail ? 8 : 5)) return SILVER_DETAIL;
    return SILVER_GRASS;
  }
  if (variation < (detail ? 8 : 5)) return EMERALD_DETAIL;
  return EMERALD_GRASS;
}

function paintDeepRoute(
  map,
  route,
  radius,
  ground,
  water,
  shallow,
  terrain,
  collision,
  seed = 0,
  endRadius = radius,
) {
  const minX = Math.max(0, Math.floor(Math.min(...route.map(([x]) => x)) - radius - 2));
  const maxX = Math.min(map.width - 1, Math.ceil(Math.max(...route.map(([x]) => x)) + radius + 2));
  const minY = Math.max(0, Math.floor(Math.min(...route.map(([, y]) => y)) - radius - 2));
  const maxY = Math.min(map.height - 1, Math.ceil(Math.max(...route.map(([, y]) => y)) + radius + 2));
  let painted = 0;
  const startY = route[0][1];
  const endY = route.at(-1)[1];
  const height = Math.max(1, Math.abs(endY - startY));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const progress = Math.max(0, Math.min(1, Math.abs(y - startY) / height));
      const taperedRadius = radius + (endRadius - radius) * progress;
      if (routeDistance(x + 0.5, y + 0.5, route) > naturalRiverRadius(x, y, taperedRadius, seed)) continue;
      const index = y * map.width + x;
      ground[index] = grassFor(x, y, true);
      water[index] = WATER_GID;
      shallow[index] = 0;
      terrain[index] = 0;
      collision[index] = COLLISION_GID;
      painted += 1;
    }
  }
  return painted;
}

function lakeBackgroundFromEdges(map, sourceGround, x, y) {
  const waveA = Math.sin(y * 0.041) * 9 + Math.sin((x + y) * 0.017) * 5;
  const waveB = Math.sin(x * 0.037 + 1.4) * 9 + Math.sin((x - y) * 0.019) * 5;
  const distances = [
    { side: 'left', value: x - 145 + waveA },
    { side: 'right', value: 516 - x - waveA },
    { side: 'top', value: y - 472 + waveB },
    { side: 'bottom', value: 706 - y - waveB },
  ];
  distances.sort((a, b) => a.value - b.value);
  const side = distances[0].side;
  const sampleX = side === 'left'
    ? 139
    : (side === 'right' ? 523 : Math.max(0, Math.min(map.width - 1, x)));
  const sampleY = side === 'top'
    ? 467
    : (side === 'bottom' ? 712 : Math.max(0, Math.min(map.height - 1, y)));
  return sourceGround[sampleY * map.width + sampleX] || 1;
}

function isBrightwaterPeninsula(x, y) {
  if (x < 274 || x > 348 || y < 474 || y > 552) return false;
  const spread = (x - 309) / 35;
  // Keep the little ford on a compact, rounded tongue of land. The former
  // wide wedge split the lake into two hard, river-like horns.
  const shoreline = 510 + Math.max(0, 1 - spread * spread) * 38
    + Math.sin(x * 0.13) * 1.5;
  return y <= shoreline;
}

function brightwaterLakeShape(x, y) {
  // One slightly asymmetric basin reads much better than overlapping ovals.
  // It is widest through the middle, with a soft southern belly for the outlet
  // and a restrained shoulder beside the small settlement peninsula.
  const vertical = y - 603;
  const centerX = 333 + Math.sin(vertical * 0.028) * 7 - vertical * 0.045;
  const centerY = 603 + Math.sin((x - 333) * 0.018) * 2;
  const angle = Math.atan2(y - centerY, x - centerX);
  const radiusX = 151 + Math.sin(angle * 2 - 0.65) * 5 + Math.sin(angle * 5 + 0.4) * 2;
  const radiusY = 91 + Math.sin(angle * 3 + 0.6) * 3;
  const distance = Math.hypot((x - centerX) / radiusX, (y - centerY) / radiusY);
  const edge = 1 + Math.sin(angle * 4 + 0.35) * 0.018 + Math.sin(angle * 7 - 0.7) * 0.012;
  return { distance, edge };
}

function findLakeDecorPlacement(map, water, roads, targetX, targetY, predicate, radius = 24) {
  let best = null;
  const minX = Math.max(0, targetX - radius);
  const maxX = Math.min(map.width - 1, targetX + radius);
  const minY = Math.max(0, targetY - radius);
  const maxY = Math.min(map.height - 1, targetY + radius);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const index = y * map.width + x;
      if (roads[index] || !predicate(x, y, index)) continue;
      const distance = Math.hypot(x - targetX, y - targetY);
      if (!best || distance < best.distance) best = { x, y, index, distance };
    }
  }
  return best;
}

function decorateBrightwaterLake(map, decor, water, shallow, roads) {
  if (!decor) return { cleared: 0, reeds: 0, rocks: 0, logs: 0, boats: 0 };
  let cleared = 0;
  let reeds = 0;
  let rocks = 0;
  let logs = 0;
  let boats = 0;
  const bounds = { x1: 145, x2: 516, y1: 472, y2: 706 };
  const isWater = (x, y, index = y * map.width + x) => Boolean(water[index] && !shallow[index]);
  const isShoreWater = (x, y, index) => {
    if (!isWater(x, y, index)) return false;
    return [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return true;
      return !isWater(nx, ny);
    });
  };
  const isShoreLand = (x, y, index) => {
    if (isWater(x, y, index)) return false;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return false;
      return isWater(nx, ny);
    });
  };

  // The lake previously had no dedicated decor. Clear this compact footprint
  // first so the result is stable after each rebuild and never touches town props.
  for (let y = bounds.y1; y <= bounds.y2; y += 1) {
    for (let x = bounds.x1; x <= bounds.x2; x += 1) {
      const index = y * map.width + x;
      if (!decor[index]) continue;
      decor[index] = 0;
      cleared += 1;
    }
  }

  const reedTargets = [
    [210, 572], [191, 620], [227, 662], [296, 686], [405, 677], [459, 628], [432, 566],
  ];
  for (const [x, y] of reedTargets) {
    const placement = findLakeDecorPlacement(map, water, roads, x, y, isShoreWater);
    if (!placement || decor[placement.index]) continue;
    decor[placement.index] = LAKE_DECOR.reeds;
    reeds += 1;
  }

  const rockTargets = [[186, 588], [210, 647], [264, 682], [455, 651], [460, 588]];
  for (const [x, y] of rockTargets) {
    const placement = findLakeDecorPlacement(map, water, roads, x, y, isShoreLand);
    if (!placement || decor[placement.index]) continue;
    decor[placement.index] = LAKE_DECOR.rockSmall;
    rocks += 1;
  }

  const logPlacement = findLakeDecorPlacement(
    map,
    water,
    roads,
    304,
    665,
    (x, y, index) => isWater(x, y, index)
      && !isShoreWater(x, y, index)
      && x > 245 && x < 390 && y > 620,
  );
  if (logPlacement) {
    decor[logPlacement.index] = LAKE_DECOR.log;
    logs += 1;
  }

  // A single small skiff near the ford makes the water feel inhabited without
  // adding collision or turning the lake into a busy harbour.
  const boatX = 380;
  const boatY = 640;
  let boatFits = true;
  for (let y = boatY; y < boatY + 2 && boatFits; y += 1) {
    for (let x = boatX; x < boatX + 3; x += 1) {
      if (!isWater(x, y) || roads[y * map.width + x]) {
        boatFits = false;
        break;
      }
    }
  }
  if (boatFits) {
    for (let y = 0; y < 2; y += 1) {
      for (let x = 0; x < 3; x += 1) decor[(boatY + y) * map.width + boatX + x] = LAKE_DECOR.boat + y * 16 + x;
    }
    boats += 1;
  }
  return { cleared, reeds, rocks, logs, boats };
}

function clearLegacyOutletTail(map, sourceGround, ground, water, shallow, terrain, collision) {
  let cleared = 0;
  // The lake reset ends at row 706. The old wide outlet below that row was
  // therefore surviving every rebuild and made the new stream flare out again
  // before the region border. Clear only that former tail, then redraw it with
  // the tapered route below.
  for (let y = 707; y < map.height; y += 1) {
    for (let x = 130; x <= 260; x += 1) {
      const index = y * map.width + x;
      if (!water[index] && !shallow[index]) continue;
      ground[index] = sourceGround[index] || grassFor(x, y, true);
      water[index] = 0;
      shallow[index] = 0;
      terrain[index] = 0;
      collision[index] = 0;
      cleared += 1;
    }
  }
  return cleared;
}

function repairBrightwaterLake(map, sourceGround, ground, water, shallow, terrain, collision) {
  let deepTiles = 0;
  let shoreTiles = 0;

  // Reset only the damaged lake footprint. Roads, buildings and all object layers
  // remain untouched; this removes the rectangular land tongue left by the river pass.
  for (let y = 472; y <= 706; y += 1) {
    for (let x = 145; x <= 516; x += 1) {
      const index = y * map.width + x;
      ground[index] = lakeBackgroundFromEdges(map, sourceGround, x, y);
      water[index] = 0;
      shallow[index] = 0;
      terrain[index] = 0;
      collision[index] = 0;
    }
  }

  for (let y = 480; y <= 700; y += 1) {
    for (let x = 152; x <= 508; x += 1) {
      const { distance, edge } = brightwaterLakeShape(x, y);
      if (distance > edge) continue;
      const index = y * map.width + x;
      if (isBrightwaterPeninsula(x, y)) {
        ground[index] = lakeBackgroundFromEdges(map, sourceGround, x, y);
        continue;
      }
      terrain[index] = 0;
      // Keep the lake edge as a clean grassy shoreline. The old shallow-water
      // ring rendered as a detached blue halo at world-map zoom levels.
      water[index] = WATER_GID;
      shallow[index] = 0;
      collision[index] = COLLISION_GID;
      deepTiles += 1;
      if (distance > edge - 0.09) shoreTiles += 1;
    }
  }

  const clearedLegacyOutletTiles = clearLegacyOutletTail(
    map, sourceGround, ground, water, shallow, terrain, collision,
  );
  const outletTiles = paintDeepRoute(
    map,
    [[242, 620], [234, 634], [226, 650], [220, 667], [215, 684], [209, 702], [203, 723], [196, 745], [187, 772], [181, 799]],
    10.5,
    ground,
    water,
    shallow,
    terrain,
    collision,
    23,
    5.5,
  );

  // Reassert the naturally tapered settlement peninsula after the inlet is carved,
  // so no water tile can end up beneath a village building.
  for (let y = 474; y <= 558; y += 1) {
    for (let x = 248; x <= 372; x += 1) {
      if (!isBrightwaterPeninsula(x, y)) continue;
      const index = y * map.width + x;
      ground[index] = lakeBackgroundFromEdges(map, sourceGround, x, y);
      water[index] = 0;
      shallow[index] = 0;
      terrain[index] = 0;
      collision[index] = 0;
    }
  }

  // Both upstream branches now use one continuous inlet. It slips around the
  // west side of Brightwater rather than producing two disconnected diagonal
  // cuts through the lake edge.
  const inletTiles = paintDeepRoute(
    map,
    brightwaterInlet,
    7.5,
    ground,
    water,
    shallow,
    terrain,
    collision,
    41,
    5.75,
  );

  return { deepTiles, shoreTiles, inletTiles, outletTiles, clearedLegacyOutletTiles };
}

function repairSouthOutletContinuation(southMap) {
  const required = ['Ground', 'Water', 'ShallowWater', 'TerrainDetails', 'Collision'];
  const layerByName = Object.fromEntries(required.map((name) => [
    name,
    southMap.layers.find((layer) => layer.type === 'tilelayer' && layer.name === name),
  ]));
  if (required.some((name) => !layerByName[name])) return { cleared: 0, painted: 0 };

  const ground = decodeLayerData(layerByName.Ground);
  const water = decodeLayerData(layerByName.Water);
  const shallow = decodeLayerData(layerByName.ShallowWater);
  const terrain = decodeLayerData(layerByName.TerrainDetails);
  const collision = decodeLayerData(layerByName.Collision);
  const sourceGround = Uint32Array.from(ground);
  let cleared = 0;

  // Narrow only the first stretch of the neighbouring region. Farther south
  // its existing river remains untouched, so this is a seamless local taper,
  // not a redraw of the next biome.
  for (let y = 0; y <= 128; y += 1) {
    for (let x = 130; x <= 220; x += 1) {
      const index = y * southMap.width + x;
      if (!water[index] && !shallow[index]) continue;
      ground[index] = sourceGround[index] || grassFor(x, y, true);
      water[index] = 0;
      shallow[index] = 0;
      terrain[index] = 0;
      collision[index] = 0;
      cleared += 1;
    }
  }

  const painted = paintDeepRoute(
    southMap,
    [[181, 0], [176, 18], [171, 39], [166, 61], [161, 84], [156, 106], [151, 128]],
    5.5,
    ground,
    water,
    shallow,
    terrain,
    collision,
    23,
    8.5,
  );
  for (const name of required) encodeLayerData(layerByName[name], {
    Ground: ground,
    Water: water,
    ShallowWater: shallow,
    TerrainDetails: terrain,
    Collision: collision,
  }[name]);
  return { cleared, painted };
}

function refineBrightwaterHardpack(map, ground, water, shallow, roads) {
  let cleared = 0;
  let painted = 0;
  // Keep Brightwater as a compact ford settlement. The old version left a
  // single, oversized hardpack blob around the shore, so first clear that
  // footprint and rebuild only the paths players actually use.
  for (let y = 462; y <= 570; y += 1) {
    for (let x = 148; x <= 380; x += 1) {
      const index = y * map.width + x;
      if (!roads[index]) continue;
      roads[index] = 0;
      cleared += 1;
    }
  }

  const routes = [
    // The west road curves up to the narrow river neck. It meets a short bridge
    // before the water broadens into the lake, rather than crossing the whole inlet.
    { points: [[148, 510], [171, 512], [193, 510], [210, 500], [224, 486], [236, 470]], radius: 4.75 },
    // East-bank approach into Brightwater; this leaves the settlement itself compact.
    { points: [[262, 470], [277, 475], [291, 484], [302, 495], [304, 511], [304, 524]], radius: 4.25 },
    // Compact village spine between the inn, the marker and the warehouse.
    { points: [[304, 524], [304, 534], [298, 546], [294, 555]], radius: 4.5 },
    { points: [[302, 523], [306, 507], [307, 491], [307, 477]], radius: 3.75 },
    // Short dock path; it reads as a deliberate waterside access rather than a plaza edge.
    { points: [[304, 525], [316, 527], [328, 527], [338, 528]], radius: 3.5 },
  ];
  for (const route of routes) painted += paintRoadRoute(
    map, route.points, route.radius, ground, water, shallow, roads,
  );

  // A small irregular forecourt makes the town marker feel intentional, while
  // still leaving grass around the buildings and the shoreline.
  for (let y = 515; y <= 545; y += 1) {
    for (let x = 282; x <= 322; x += 1) {
      const index = y * map.width + x;
      if (water[index] || shallow[index]) continue;
      const wobble = Math.sin(x * 0.43 + y * 0.17) * 1.5
        + Math.sin(x * 0.11 - y * 0.29) * 1.1;
      const withinForecourt = Math.hypot((x - 303) / (16 + wobble), (y - 530) / (13 + wobble * 0.35)) <= 1;
      if (!withinForecourt) continue;
      roads[index] = roadGidForGround(ground[index]);
      painted += 1;
    }
  }
  return { cleared, painted };
}

function normalizeTilesetSource(source) {
  return String(source ?? '').replace(/\\/g, '/');
}

function ensureBrightwaterBridgeTileset(map) {
  // The generic starter-zone bridge only made this crossing look like a thin
  // beam. Keep the map clean when updating an existing save of the region.
  map.tilesets = map.tilesets.filter((tileset) => (
    normalizeTilesetSource(tileset.source) !== LEGACY_BRIGHTWATER_BRIDGE_TILESET_SOURCE
  ));
  const existing = map.tilesets.find((tileset) => (
    normalizeTilesetSource(tileset.source) === BRIGHTWATER_BRIDGE_TILESET_SOURCE
  ));
  if (existing) {
    existing.firstgid = BRIGHTWATER_BRIDGE_FIRST_GID;
    return Number(existing.firstgid);
  }
  map.tilesets.push({
    firstgid: BRIGHTWATER_BRIDGE_FIRST_GID,
    source: BRIGHTWATER_BRIDGE_TILESET_SOURCE,
  });
  map.tilesets.sort((a, b) => Number(a.firstgid) - Number(b.firstgid));
  return BRIGHTWATER_BRIDGE_FIRST_GID;
}

function bridgeLayer(map) {
  let layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === 'BrightwaterBridge');
  if (layer) return layer;
  const roadsIndex = map.layers.findIndex((candidate) => candidate.type === 'tilelayer' && candidate.name === 'Roads');
  layer = {
    compression: 'zlib',
    data: '',
    encoding: 'base64',
    height: map.height,
    id: Math.max(...map.layers.map((candidate) => Number(candidate.id ?? 0)), 0) + 1,
    name: 'BrightwaterBridge',
    opacity: 1,
    type: 'tilelayer',
    visible: true,
    width: map.width,
    x: 0,
    y: 0,
  };
  encodeLayerData(layer, new Uint32Array(map.width * map.height));
  map.layers.splice(roadsIndex >= 0 ? roadsIndex + 1 : map.layers.length, 0, layer);
  return layer;
}

function placeBrightwaterBridge(map, water, shallow, collision, bridgeFirstgid) {
  const layer = bridgeLayer(map);
  const data = decodeLayerData(layer);
  // Restore the old long deck to normal water collision before replacing it.
  // This makes rebuilding the script idempotent and prevents an invisible,
  // walkable strip across the lake mouth.
  for (const rect of [
    { x1: 226, x2: 271, y1: 517, y2: 518 },
    { x1: 236, x2: 262, y1: 469, y2: 470 },
  ]) {
    for (let y = rect.y1; y <= rect.y2; y += 1) {
      for (let x = rect.x1; x <= rect.x2; x += 1) {
        const index = y * map.width + x;
        if (water[index] && !shallow[index]) collision[index] = COLLISION_GID;
      }
    }
  }
  data.fill(0);

  // Cross the narrow neck just above the lake. The bridge now reads as a real
  // river crossing; the broad, open mouth below stays visually open water.
  const startX = 236;
  const endX = 262;
  const startY = 468;
  for (let row = 0; row < 4; row += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const column = x === startX ? 0 : (x === endX ? 2 : 1);
      data[(startY + row) * map.width + x] = bridgeFirstgid + row * 3 + column;
    }
  }
  // Bridge decking is traversable even though the animated water continues
  // underneath it. Keep the clearance narrow to avoid making the nearby lake walkable.
  let clearedCollision = 0;
  for (let y = startY; y <= startY + 3; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const index = y * map.width + x;
      if (collision[index]) clearedCollision += 1;
      collision[index] = 0;
    }
  }
  encodeLayerData(layer, data);
  return { tiles: (endX - startX + 1) * 4, clearedCollision };
}

function trimSubmergedRoadArtifacts(map, roads, water, shallow) {
  let cleared = 0;
  for (let y = 460; y < map.height; y += 1) {
    for (let x = 120; x <= 560; x += 1) {
      const index = y * map.width + x;
      if (!roads[index]) continue;
      const orphanedSouthSpur = x >= 280 && x <= 325 && y >= 559 && y < map.height;
      if (orphanedSouthSpur) {
        roads[index] = 0;
        cleared += 1;
        continue;
      }
      if (!water[index] && !shallow[index]) continue;
      const brightwaterBridge = x >= 240 && x <= 350 && y >= 500 && y <= 558;
      if (brightwaterBridge) continue;
      roads[index] = 0;
      cleared += 1;
    }
  }
  return cleared;
}

function roadGidForGround(gid) {
  if (gid >= 513 && gid < 769) return 517;
  if (gid >= 769 && gid < 1025) return 773;
  if (gid >= 1025 && gid < 1281) return 1029;
  return 5;
}

function paintRoadRoute(map, route, radius, ground, water, shallow, roads) {
  const minX = Math.max(0, Math.floor(Math.min(...route.map(([x]) => x)) - radius - 1));
  const maxX = Math.min(map.width - 1, Math.ceil(Math.max(...route.map(([x]) => x)) + radius + 1));
  const minY = Math.max(0, Math.floor(Math.min(...route.map(([, y]) => y)) - radius - 1));
  const maxY = Math.min(map.height - 1, Math.ceil(Math.max(...route.map(([, y]) => y)) + radius + 1));
  let painted = 0;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (routeDistance(x, y, route) > radius) continue;
      const index = y * map.width + x;
      if (water[index] || shallow[index]) continue;
      roads[index] = roadGidForGround(ground[index]);
      painted += 1;
    }
  }
  return painted;
}

function matchingVariant(gid, x, y) {
  const variation = hash2(x, y) % 100;
  if (gid >= 1 && gid < 257) return variation < 6 ? 2 : 1;
  if (gid >= 513 && gid < 769) return variation < 6 ? 514 : 513;
  if (gid >= 769 && gid < 1025) return variation < 6 ? 772 : 769;
  return gid;
}

function familyFirstGid(gid) {
  if (!gid) return EMERALD_GRASS;
  return Math.floor((gid - 1) / 256) * 256 + 1;
}

function quietGroundVariant(gid, x, y) {
  if (!gid) return EMERALD_GRASS;
  const first = familyFirstGid(gid);
  const local = gid - first;
  // The macro map used the bright alternate tile as a solid fill in several
  // enormous polygons. Keep it as sparse texture instead of a biome-sized patch.
  if (local === 1 || local === 2) return (hash2(x, y) % 29 === 0) ? first + 1 : first;
  return gid;
}

function dominantBoundaryFamily(source, width, height, edgeX, y) {
  const counts = new Map();
  for (let sampleY = Math.max(0, y - 12); sampleY <= Math.min(height - 1, y + 12); sampleY += 1) {
    for (let inset = 0; inset <= 10; inset += 2) {
      const x = Math.max(0, Math.min(width - 1, edgeX - inset));
      const first = familyFirstGid(source[sampleY * width + x]);
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? SILVER_GRASS;
}

function normalizeOpenMeadow(map, ground, water, shallow, roads) {
  let changed = 0;
  for (let y = 118; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = y * map.width + x;
      if (water[index] || shallow[index] || roads[index]) continue;
      let next = quietGroundVariant(ground[index], x, y);
      const first = familyFirstGid(next);
      const grassFamily = first === 1 || first === 257 || first === 513
        || first === 769 || first === 1025 || first === 2305;
      const meadowEdge = 495 + Math.sin(y * 0.021) * 28 + Math.sin(y * 0.053) * 14;
      const coastEdge = 119 + Math.sin(x * 0.031) * 7 + Math.sin(x * 0.011) * 4;
      const openSilverMeadow = grassFamily && x < meadowEdge && y > coastEdge;
      if (openSilverMeadow) {
        next = (hash2(x, y) % 31 === 0) ? SILVER_DETAIL : SILVER_GRASS;
      }
      // Saltwind's local tile 7 is sand-colored. Away from the actual north/east
      // coast and the cave rim it looked like disconnected pieces of dirt road.
      if (x < 440 && y > 128 && next >= 2305 && next < 2561) {
        next = (hash2(x, y) % 31 === 0) ? SILVER_DETAIL : SILVER_GRASS;
      }
      if (next === ground[index]) continue;
      ground[index] = next;
      changed += 1;
    }
  }
  return changed;
}

function cleanTerrainDetails(map, terrain, water, shallow, roads, xStart, xEnd, yStart, yEnd) {
  let cleared = 0;
  for (let y = Math.max(0, yStart); y <= Math.min(map.height - 1, yEnd); y += 1) {
    for (let x = Math.max(0, xStart); x <= Math.min(map.width - 1, xEnd); x += 1) {
      const index = y * map.width + x;
      if (isCaveMountain(x, y)) continue;
      if (!terrain[index] || water[index] || shallow[index] || roads[index]) continue;
      if (hash2(x + 4100, y + 2300) % 23 === 0) continue;
      terrain[index] = 0;
      cleared += 1;
    }
  }
  return cleared;
}

function restoreCaveMountain(map, ground, terrain, water, shallow, roads) {
  let groundTiles = 0;
  let detailTiles = 0;
  const topContour = [
    [338, 355], [397, 294], [485, 307], [575, 333], [665, 366], [735, 394], [799, 411],
  ];
  const bottomContour = [
    [338, 380], [404, 432], [492, 451], [582, 478], [670, 516], [735, 555], [799, 594],
  ];

  function contourY(points, x) {
    for (let i = 1; i < points.length; i += 1) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      if (x > bx) continue;
      const t = Math.max(0, Math.min(1, (x - ax) / Math.max(1, bx - ax)));
      return ay + (by - ay) * t;
    }
    return points.at(-1)[1];
  }

  // Remove the previous closed oval before drawing the open mountain shoulder.
  for (let y = 244; y <= 610; y += 1) {
    for (let x = 310; x < map.width; x += 1) {
      const index = y * map.width + x;
      if (water[index] || shallow[index] || roads[index]) continue;
      const first = familyFirstGid(ground[index]);
      if (first === 1281 || first === 1537) {
        ground[index] = (hash2(x, y) % 31 === 0) ? SILVER_DETAIL : SILVER_GRASS;
      }
      if (terrain[index] === 1332 || terrain[index] === 1573) terrain[index] = 0;
    }
  }

  for (let y = 270; y <= 610; y += 1) {
    for (let x = 330; x < map.width; x += 1) {
      const index = y * map.width + x;
      if (water[index] || shallow[index] || roads[index]) continue;
      const wave = Math.sin(x * 0.049 + y * 0.013) * 5
        + Math.sin(x * 0.017 - y * 0.041) * 3;
      const top = contourY(topContour, x) + wave;
      const bottom = contourY(bottomContour, x) - wave * 0.55;
      if (y < top || y > bottom) continue;
      const edgeDistance = Math.min(y - top, bottom - y);
      const scatter = hash2(x + 5200, y + 3100) % 100;
      if (edgeDistance < 9 && scatter > Math.round((edgeDistance / 9) * 100)) continue;

      if (edgeDistance < 15) {
        ground[index] = scatter < 6 ? 1284 : 1281;
      } else if (edgeDistance < 36) {
        ground[index] = scatter < 6 ? 1557 : 1554;
      } else {
        ground[index] = scatter < 5 ? 1298 : 1289;
      }
      terrain[index] = 0;
      const variation = hash2(x + 31, y + 17) % 100;
      const detailChance = edgeDistance < 15 ? 2 : (edgeDistance < 36 ? 4 : 3);
      if (variation < detailChance) {
        terrain[index] = 1332;
        detailTiles += 1;
      } else if (variation < detailChance + 3) {
        terrain[index] = 1573;
        detailTiles += 1;
      }
      groundTiles += 1;
    }
  }
  return { groundTiles, detailTiles };
}

function cleanNeighborTerrain(neighbor, xStart, xEnd, yStart, yEnd) {
  const required = ['TerrainDetails', 'Water', 'ShallowWater', 'Roads'];
  const layers = Object.fromEntries(required.map((name) => [
    name,
    neighbor.layers.find((layer) => layer.type === 'tilelayer' && layer.name === name),
  ]));
  if (required.some((name) => !layers[name])) return 0;
  const terrain = decodeLayerData(layers.TerrainDetails);
  const water = decodeLayerData(layers.Water);
  const shallow = decodeLayerData(layers.ShallowWater);
  const roads = decodeLayerData(layers.Roads);
  const changed = cleanTerrainDetails(
    neighbor, terrain, water, shallow, roads, xStart, xEnd, yStart, yEnd,
  );
  encodeLayerData(layers.TerrainDetails, terrain);
  return changed;
}

function alignNorthCoast(map, ground, water, shallow, roads, xStart, xEnd) {
  let changed = 0;
  for (let x = Math.max(0, xStart); x <= Math.min(map.width - 1, xEnd); x += 1) {
    let shoreline = 0;
    while (shoreline < 145) {
      const index = shoreline * map.width + x;
      if (!water[index] && !shallow[index]) break;
      shoreline += 1;
    }
    const beachWidth = 17 + Math.round(Math.sin(x * 0.052) * 3 + Math.sin(x * 0.017) * 2);
    for (let y = shoreline; y <= Math.min(map.height - 1, shoreline + beachWidth + 13); y += 1) {
      const index = y * map.width + x;
      if (water[index] || shallow[index] || roads[index]) continue;
      const distance = y - shoreline;
      let next;
      if (distance <= beachWidth) next = 2312;
      else {
        const fade = (distance - beachWidth) / 13;
        next = (hash2(x, y) % 100) < Math.round(fade * 100)
          ? ((hash2(x + 7, y) % 29 === 0) ? SILVER_DETAIL : SILVER_GRASS)
          : 2312;
      }
      if (ground[index] === next) continue;
      ground[index] = next;
      changed += 1;
    }
  }
  return changed;
}

function alignNeighborNorthCoast(neighbor, xStart, xEnd) {
  const required = ['Ground', 'Water', 'ShallowWater', 'Roads'];
  const layers = Object.fromEntries(required.map((name) => [
    name,
    neighbor.layers.find((layer) => layer.type === 'tilelayer' && layer.name === name),
  ]));
  if (required.some((name) => !layers[name])) return 0;
  const ground = decodeLayerData(layers.Ground);
  const water = decodeLayerData(layers.Water);
  const shallow = decodeLayerData(layers.ShallowWater);
  const roads = decodeLayerData(layers.Roads);
  const changed = alignNorthCoast(neighbor, ground, water, shallow, roads, xStart, xEnd);
  encodeLayerData(layers.Ground, ground);
  return changed;
}

function rebuildSouthRoadNetwork(map, ground, water, shallow, roads) {
  let cleared = 0;
  for (let y = 594; y < map.height; y += 1) {
    for (let x = 260; x <= 720; x += 1) {
      const index = y * map.width + x;
      if (!roads[index]) continue;
      roads[index] = 0;
      cleared += 1;
    }
  }
  const eastRoad = paintRoadRoute(
    map,
    [[488, 623], [520, 641], [548, 662], [575, 688], [604, 721], [635, 760], [665, 799]],
    5.5,
    ground,
    water,
    shallow,
    roads,
  );
  const southRoad = paintRoadRoute(
    map,
    [[294, 799], [316, 777], [352, 754], [398, 735], [448, 718], [500, 704], [548, 695], [575, 688]],
    5,
    ground,
    water,
    shallow,
    roads,
  );
  for (let y = 594; y < map.height; y += 1) {
    for (let x = 260; x <= 720; x += 1) {
      const index = y * map.width + x;
      if (roads[index]) roads[index] = 773;
    }
  }
  return { cleared, eastRoad, southRoad };
}

function blendNeighborGroundEdge(neighbor, side, targetFamily, span, rangeStart, rangeEnd) {
  const groundLayer = neighbor.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'Ground');
  const waterLayer = neighbor.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'Water');
  const shallowLayer = neighbor.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'ShallowWater');
  const roadsLayer = neighbor.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'Roads');
  if (!groundLayer || !waterLayer || !shallowLayer || !roadsLayer) return 0;
  const ground = decodeLayerData(groundLayer);
  const water = decodeLayerData(waterLayer);
  const shallow = decodeLayerData(shallowLayer);
  const roads = decodeLayerData(roadsLayer);
  let changed = 0;
  const horizontal = side === 'north';
  const lineLength = horizontal ? neighbor.width : neighbor.height;
  const start = Math.max(0, rangeStart);
  const end = Math.min(lineLength - 1, rangeEnd);
  for (let p = start; p <= end; p += 1) {
    const organicSpan = span + Math.sin(p * 0.047) * 8 + Math.sin(p * 0.016) * 5;
    for (let distance = 0; distance <= span + 16; distance += 1) {
      const x = side === 'east' ? neighbor.width - 1 - distance : p;
      const y = side === 'north' ? distance : p;
      const index = y * neighbor.width + x;
      if (water[index] || shallow[index] || roads[index]) continue;
      const blend = Math.max(0, Math.min(1, (organicSpan - distance + 10) / 20));
      if ((hash2(x + 3300, y + 1700) % 100) >= Math.round(blend * 100)) continue;
      const next = (hash2(x, y) % 25 === 0) ? targetFamily + 3 : targetFamily;
      if (ground[index] === next) continue;
      ground[index] = next;
      changed += 1;
    }
  }
  encodeLayerData(groundLayer, ground);
  return changed;
}

function smoothWestRegionSeam(map, leftMap, ground, water, shallow, roads) {
  const leftGroundLayer = leftMap.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'Ground');
  if (!leftGroundLayer) return 0;
  const leftGround = decodeLayerData(leftGroundLayer);
  let changed = 0;
  for (let y = 132; y <= 580; y += 1) {
    const sourceGid = leftGround[y * leftMap.width + leftMap.width - 1];
    const sourceFamily = dominantBoundaryFamily(
      leftGround,
      leftMap.width,
      leftMap.height,
      leftMap.width - 1,
      y,
    );
    const edge = 27 + Math.sin(y * 0.057) * 7 + Math.sin(y * 0.019) * 5;
    for (let x = 0; x <= 92; x += 1) {
      const index = y * map.width + x;
      if (water[index] || shallow[index] || roads[index]) continue;
      let next = (hash2(x + 1400, y) % 27 === 0) ? SILVER_DETAIL : SILVER_GRASS;
      if (x === 0) next = matchingVariant(sourceGid, x, y);
      else {
        const blend = Math.max(0, Math.min(1, (edge - x + 10) / 20));
        if ((hash2(x + 900, y) % 100) < Math.round(blend * 100)) {
          next = (hash2(x, y) % 23 === 0) ? sourceFamily + 3 : sourceFamily;
        }
      }
      if (ground[index] === next) continue;
      ground[index] = next;
      changed += 1;
    }
  }
  return changed;
}

function smoothSouthRegionSeam(map, southMap, ground, water, shallow, roads) {
  const sourceLayer = southMap.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'Ground');
  if (!sourceLayer) return 0;
  const source = decodeLayerData(sourceLayer);
  let changed = 0;
  for (let x = 0; x < map.width; x += 1) {
    const sourceGid = x <= 430 ? SILVER_GRASS : source[x];
    const depth = 14 + Math.sin(x * 0.041) * 4 + Math.sin(x * 0.013) * 3;
    for (let distance = 0; distance <= 30; distance += 1) {
      const y = map.height - 1 - distance;
      const index = y * map.width + x;
      if (water[index] || shallow[index] || roads[index]) continue;
      const blend = Math.max(0, Math.min(1, (depth - distance + 6) / 12));
      if (blend <= 0 || (hash2(x, y + 1300) % 100) >= Math.round(blend * 100)) continue;
      const next = matchingVariant(sourceGid, x, y);
      if (ground[index] === next) continue;
      ground[index] = next;
      changed += 1;
    }
  }
  return changed;
}

function smoothEastRegionSeam(map, eastMap, ground, water, shallow, roads) {
  const sourceLayer = eastMap.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'Ground');
  if (!sourceLayer) return 0;
  const source = decodeLayerData(sourceLayer);
  let changed = 0;
  for (let y = 130; y < map.height; y += 1) {
    const sourceGid = source[y * eastMap.width];
    const depth = 13 + Math.sin(y * 0.043) * 4 + Math.sin(y * 0.014) * 3;
    for (let distance = 0; distance <= 28; distance += 1) {
      const x = map.width - 1 - distance;
      const index = y * map.width + x;
      if (water[index] || shallow[index] || roads[index]) continue;
      const blend = Math.max(0, Math.min(1, (depth - distance + 6) / 12));
      if (blend <= 0 || (hash2(x + 2100, y) % 100) >= Math.round(blend * 100)) continue;
      const next = matchingVariant(sourceGid, x, y);
      if (ground[index] === next) continue;
      ground[index] = next;
      changed += 1;
    }
  }
  return changed;
}

function matchWaterBoundary(map, neighbor, side, ground, water, shallow, terrain, collision) {
  const names = ['Ground', 'Water', 'ShallowWater', 'TerrainDetails', 'Collision'];
  const sourceLayers = Object.fromEntries(names.map((name) => [
    name,
    neighbor.layers.find((layer) => layer.type === 'tilelayer' && layer.name === name),
  ]));
  if (names.some((name) => !sourceLayers[name])) return 0;
  const source = Object.fromEntries(names.map((name) => [name, decodeLayerData(sourceLayers[name])]));
  let changed = 0;
  const horizontal = side === 'south';
  const length = horizontal ? map.width : map.height;
  for (let p = 0; p < length; p += 1) {
    const targetX = side === 'east' ? map.width - 1 : (side === 'west' ? 0 : p);
    const targetY = horizontal ? map.height - 1 : p;
    const sourceX = side === 'east' ? 0 : (side === 'west' ? neighbor.width - 1 : p);
    const sourceY = horizontal ? 0 : p;
    const targetIndex = targetY * map.width + targetX;
    const sourceIndex = sourceY * neighbor.width + sourceX;
    const before = `${ground[targetIndex]}:${water[targetIndex]}:${shallow[targetIndex]}`;
    ground[targetIndex] = source.Ground[sourceIndex];
    water[targetIndex] = source.Water[sourceIndex];
    shallow[targetIndex] = source.ShallowWater[sourceIndex];
    terrain[targetIndex] = source.TerrainDetails[sourceIndex];
    collision[targetIndex] = source.Collision[sourceIndex];
    if (before !== `${ground[targetIndex]}:${water[targetIndex]}:${shallow[targetIndex]}`) changed += 1;
  }
  return changed;
}

function matchSouthRoadBoundary(map, southMap, roads) {
  const sourceLayer = southMap.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'Roads');
  if (!sourceLayer) return 0;
  const source = decodeLayerData(sourceLayer);
  let changed = 0;
  const targetOffset = (map.height - 1) * map.width;
  for (let x = 0; x < map.width; x += 1) {
    if (roads[targetOffset + x] === source[x]) continue;
    roads[targetOffset + x] = source[x];
    changed += 1;
  }
  return changed;
}

function main() {
  const map = readJson(MAP_PATH);
  const leftMap = readJson(LEFT_MAP_PATH);
  const eastMap = readJson(EAST_MAP_PATH);
  const southMap = readJson(SOUTH_MAP_PATH);
  const required = ['Ground', 'Water', 'ShallowWater', 'TerrainDetails', 'Roads', 'Collision', 'Decor'];
  const layers = Object.fromEntries(required.map((name) => [
    name,
    map.layers.find((layer) => layer.type === 'tilelayer' && layer.name === name),
  ]));
  for (const name of required) {
    if (!layers[name]) throw new Error(`Missing ${name} layer in ${path.basename(MAP_PATH)}.`);
  }

  const ground = decodeLayerData(layers.Ground);
  const sourceGround = Uint32Array.from(ground);
  const water = decodeLayerData(layers.Water);
  const shallow = decodeLayerData(layers.ShallowWater);
  const terrain = decodeLayerData(layers.TerrainDetails);
  const roads = decodeLayerData(layers.Roads);
  const collision = decodeLayerData(layers.Collision);
  const decor = decodeLayerData(layers.Decor);
  let clearedWater = 0;
  let carvedWater = 0;
  let grassBanks = 0;
  let naturalizedBankTiles = 0;

  // Remove the old irregular tributary and confluence, without touching the ocean
  // or unrelated water outside the known Reedwater corridor.
  for (let y = 128; y <= 540; y += 1) {
    for (let x = 0; x <= 438; x += 1) {
      const index = y * map.width + x;
      if (oldRiverDistance(x, y) > 34 && networkDistance(x, y) > 28) continue;
      if (water[index] || shallow[index]) clearedWater += 1;
      water[index] = 0;
      shallow[index] = 0;
      collision[index] = 0;
      terrain[index] = 0;
      ground[index] = grassFor(x, y, true);
    }
  }

  // Blend the two region palettes across a broad grass corridor so the seam no
  // longer reads as a hard biome rectangle. No sand or shallow-water halo is used.
  for (let y = 300; y <= 552; y += 1) {
    for (let x = 0; x <= 292; x += 1) {
      const distance = routeDistance(x, y, tributary);
      if (distance > 25) continue;
      const index = y * map.width + x;
      if (!water[index]) ground[index] = grassFor(x, y, distance > 11);
      if (distance <= 25) terrain[index] = 0;
      grassBanks += 1;
    }
  }

  // Remove the remaining light, repeating Silver River tile only around the
  // watercourse. The surrounding meadow stays intact, while both riverbanks use
  // the quieter base tones already present on the west-region side.
  for (let y = 120; y <= 548; y += 1) {
    for (let x = 0; x <= 438; x += 1) {
      if (networkDistance(x, y) > 68) continue;
      const index = y * map.width + x;
      if (water[index] || shallow[index]) continue;
      let next = ground[index];
      if (next === 770 || next === 771) next = (hash2(x, y) % 18 === 0) ? 772 : 769;
      if (next === 2 || next === 3) next = (hash2(x, y) % 18 === 0) ? 2 : 1;
      if (y > 150 && next >= 2305 && next < 2561) next = grassFor(x, y, true);
      if (next === ground[index]) continue;
      ground[index] = next;
      naturalizedBankTiles += 1;
    }
  }

  for (let y = 82; y <= 596; y += 1) {
    for (let x = 0; x <= 438; x += 1) {
      const distances = routes.map((route) => routeDistance(x, y, route));
      const distance = Math.min(...distances);
      if (distance > 8) continue;
      const nearestRoute = distances.indexOf(distance);
      const nearConfluence = Math.hypot(x - 252, y - 462) < 19;
      const nearOcean = nearestRoute === 1 && y < 128;
      const baseRadius = nearConfluence
        ? 7.25
        : (nearOcean ? 6.75 : (nearestRoute === 0 ? 5.2 : (nearestRoute === 1 ? 5.8 : 6)));
      const radius = naturalRiverRadius(x, y, baseRadius, nearestRoute + 1);
      if (distance > radius) continue;
      const index = y * map.width + x;
      ground[index] = grassFor(x, y, false);
      terrain[index] = 0;
      water[index] = WATER_GID;
      shallow[index] = 0;
      collision[index] = COLLISION_GID;
      carvedWater += 1;
    }
  }

  const lake = repairBrightwaterLake(map, sourceGround, ground, water, shallow, terrain, collision);
  const brightwaterHardpack = refineBrightwaterHardpack(map, ground, water, shallow, roads);
  const brightwaterBridgeFirstGid = ensureBrightwaterBridgeTileset(map);
  const brightwaterBridge = placeBrightwaterBridge(
    map, water, shallow, collision, brightwaterBridgeFirstGid,
  );
  const submergedRoadTilesCleared = trimSubmergedRoadArtifacts(map, roads, water, shallow);
  const normalizedMeadowTiles = normalizeOpenMeadow(map, ground, water, shallow, roads);
  const terrainDetailsCleared = cleanTerrainDetails(
    map, terrain, water, shallow, roads, 0, map.width - 1, 116, map.height - 1,
  );
  const caveMountainRestored = restoreCaveMountain(map, ground, terrain, water, shallow, roads);
  const leftTerrainDetailsCleared = cleanNeighborTerrain(
    leftMap, leftMap.width - 110, leftMap.width - 1, 92, 690,
  );
  const southTerrainDetailsCleared = cleanNeighborTerrain(
    southMap, 0, 470, 0, 74,
  );
  const northCoastTiles = alignNorthCoast(map, ground, water, shallow, roads, 0, 125);
  const leftNorthCoastTiles = alignNeighborNorthCoast(
    leftMap, leftMap.width - 125, leftMap.width - 1,
  );
  const leftNeighborBlendTiles = blendNeighborGroundEdge(leftMap, 'east', SILVER_GRASS, 58, 118, 646);
  const southNeighborBlendTiles = blendNeighborGroundEdge(southMap, 'north', SILVER_GRASS, 72, 0, 470);
  const seamTiles = smoothWestRegionSeam(map, leftMap, ground, water, shallow, roads);
  const southSeamTiles = smoothSouthRegionSeam(map, southMap, ground, water, shallow, roads);
  const eastSeamTiles = smoothEastRegionSeam(map, eastMap, ground, water, shallow, roads);
  const southRoadNetwork = rebuildSouthRoadNetwork(map, ground, water, shallow, roads);
  // Keep the lake dressing on its own visual layer so it never creates collision.
  const lakeDecor = decorateBrightwaterLake(map, decor, water, shallow, roads);
  const southOutletContinuation = repairSouthOutletContinuation(southMap);
  const southRoadBoundaryTiles = matchSouthRoadBoundary(map, southMap, roads);
  const westBoundaryTiles = matchWaterBoundary(
    map, leftMap, 'west', ground, water, shallow, terrain, collision,
  );
  const eastBoundaryTiles = matchWaterBoundary(
    map, eastMap, 'east', ground, water, shallow, terrain, collision,
  );
  const southBoundaryTiles = matchWaterBoundary(
    map, southMap, 'south', ground, water, shallow, terrain, collision,
  );

  for (const name of required) encodeLayerData(layers[name], {
    Ground: ground,
    Water: water,
    ShallowWater: shallow,
    TerrainDetails: terrain,
    Roads: roads,
    Collision: collision,
    Decor: decor,
  }[name]);
  writeJson(MAP_PATH, map);
  writeJson(LEFT_MAP_PATH, leftMap);
  writeJson(SOUTH_MAP_PATH, southMap);
  console.log(JSON.stringify({
    map: path.basename(MAP_PATH),
    clearedWater,
    carvedWater,
    grassBanks,
    naturalizedBankTiles,
    lake,
    brightwaterHardpack,
    brightwaterBridge,
    submergedRoadTilesCleared,
    normalizedMeadowTiles,
    terrainDetailsCleared,
    caveMountainRestored,
    leftTerrainDetailsCleared,
    southTerrainDetailsCleared,
    northCoastTiles,
    leftNorthCoastTiles,
    leftNeighborBlendTiles,
    southNeighborBlendTiles,
    seamTiles,
    southSeamTiles,
    eastSeamTiles,
    southRoadNetwork,
    lakeDecor,
    southOutletContinuation,
    southRoadBoundaryTiles,
    westBoundaryTiles,
    eastBoundaryTiles,
    southBoundaryTiles,
    summary: 'Smoothed the Reedwater tributary, confluence and cross-region grass transition.',
  }, null, 2));
}

main();
