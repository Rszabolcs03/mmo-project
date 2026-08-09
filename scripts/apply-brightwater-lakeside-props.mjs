import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const mapPath = path.join(
  rootDir,
  'public',
  'maps',
  'world_map',
  'continents',
  'continent_01',
  'regions',
  'continent_01_region_1_0.tmj',
);
const sourceArchivePath = path.join(
  rootDir,
  'public',
  'assets',
  'tilesets',
  'brightwater_lakeside_props_v2_source.png',
);
const outputImagePath = path.join(
  rootDir,
  'public',
  'assets',
  'tilesets',
  'brightwater_lakeside_props_v2.png',
);
const tsxPath = path.join(rootDir, 'public', 'tilesets', 'brightwater_lakeside_props_v2.tsx');
const tilesetSource = '../../../../../tilesets/brightwater_lakeside_props_v2.tsx';
const layerName = 'BrightwaterLakesideProps';
const tileSize = 32;
const columns = 4;
const rows = 4;

const tileTypes = [
  ['reeds_tall', 'water'],
  ['cattails', 'water'],
  ['lily_pads', 'water'],
  ['shore_rocks', 'shore'],
  ['mossy_rocks', 'shore'],
  ['driftwood', 'shore'],
  ['fishing_crate', 'shore'],
  ['barrel', 'shore'],
  ['drying_net', 'shore'],
  ['rowboat', 'water'],
  ['stone_firepit', 'shore'],
  ['direction_sign', 'shore'],
  ['reed_tuft', 'shore'],
  ['wildflowers', 'shore'],
  ['fishing_baskets', 'shore'],
  ['clay_pots', 'shore'],
];

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function isChromaKey(red, green, blue) {
  return red >= 205 && blue >= 205 && green <= 105 && Math.abs(red - blue) <= 52;
}

function buildSpriteSheet(inputPath) {
  ensureDirectory(sourceArchivePath);
  const resolvedInput = path.resolve(inputPath);
  if (resolvedInput !== sourceArchivePath) fs.copyFileSync(resolvedInput, sourceArchivePath);

  const source = PNG.sync.read(fs.readFileSync(sourceArchivePath));
  if (source.width !== source.height) {
    throw new Error(`Expected a square sprite sheet source, got ${source.width}x${source.height}.`);
  }

  const output = new PNG({ width: columns * tileSize, height: rows * tileSize });
  let transparentPixels = 0;
  let opaquePixels = 0;

  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(((x + 0.5) * source.width) / output.width));
      const sourceY = Math.min(source.height - 1, Math.floor(((y + 0.5) * source.height) / output.height));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const outputIndex = (y * output.width + x) * 4;
      const red = source.data[sourceIndex];
      const green = source.data[sourceIndex + 1];
      const blue = source.data[sourceIndex + 2];
      const transparent = isChromaKey(red, green, blue);

      output.data[outputIndex] = transparent ? 0 : red;
      output.data[outputIndex + 1] = transparent ? 0 : green;
      output.data[outputIndex + 2] = transparent ? 0 : blue;
      output.data[outputIndex + 3] = transparent ? 0 : 255;
      if (transparent) transparentPixels += 1;
      else opaquePixels += 1;
    }
  }

  const cornerIndexes = [
    3,
    (output.width - 1) * 4 + 3,
    ((output.height - 1) * output.width) * 4 + 3,
    (output.width * output.height - 1) * 4 + 3,
  ];
  if (cornerIndexes.some((index) => output.data[index] !== 0)) {
    throw new Error('Chroma-key validation failed: one or more output corners are opaque.');
  }
  const coverage = opaquePixels / (opaquePixels + transparentPixels);
  if (coverage < 0.08 || coverage > 0.72) {
    throw new Error(`Unexpected sprite coverage after chroma removal: ${(coverage * 100).toFixed(1)}%.`);
  }

  ensureDirectory(outputImagePath);
  fs.writeFileSync(outputImagePath, PNG.sync.write(output, { colorType: 6 }));
  return { sourceWidth: source.width, sourceHeight: source.height, coverage };
}

function writeTileset() {
  const tileDefinitions = tileTypes.map(([type, placement], id) => (
    ` <tile id="${id}" type="${type}">\n`
    + '  <properties>\n'
    + `   <property name="placement" value="${placement}"/>\n`
    + '  </properties>\n'
    + ' </tile>'
  )).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="brightwater_lakeside_props_v2" tilewidth="32" tileheight="32" tilecount="16" columns="4" objectalignment="bottom">
 <image source="../assets/tilesets/brightwater_lakeside_props_v2.png" width="128" height="128"/>
${tileDefinitions}
</tileset>
`;
  ensureDirectory(tsxPath);
  fs.writeFileSync(tsxPath, xml, 'utf8');
}

function decodeTileLayer(map, name) {
  const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
  if (!layer || layer.encoding !== 'base64' || layer.compression !== 'zlib') {
    throw new Error(`Expected ${name} to be a base64/zlib tile layer.`);
  }
  const buffer = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const tiles = new Uint32Array(map.width * map.height);
  for (let index = 0; index < tiles.length; index += 1) {
    tiles[index] = buffer.readUInt32LE(index * 4);
  }
  return tiles;
}

function property(name, type, value) {
  return { name, type, value };
}

function addPropsToMap() {
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const water = decodeTileLayer(map, 'Water');
  const roads = decodeTileLayer(map, 'Roads');
  const indexAt = (x, y) => y * map.width + x;
  const isWater = (x, y) => (
    x >= 0 && y >= 0 && x < map.width && y < map.height && water[indexAt(x, y)] !== 0
  );
  const isRoad = (x, y) => (
    x >= 0 && y >= 0 && x < map.width && y < map.height && roads[indexAt(x, y)] !== 0
  );
  const isVillageClearance = (x, y) => x >= 270 && x <= 350 && y >= 500 && y <= 570;

  const buildDistanceField = (targetWater) => {
    const distances = new Uint16Array(map.width * map.height);
    distances.fill(0xffff);
    const queue = new Int32Array(map.width * map.height);
    let head = 0;
    let tail = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const index = indexAt(x, y);
        if (isWater(x, y) !== targetWater) continue;
        distances[index] = 0;
        queue[tail++] = index;
      }
    }
    const neighbors = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0], [1, 0],
      [-1, 1], [0, 1], [1, 1],
    ];
    while (head < tail) {
      const index = queue[head++];
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      const nextDistance = distances[index] + 1;
      neighbors.forEach(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return;
        const nextIndex = indexAt(nx, ny);
        if (distances[nextIndex] <= nextDistance) return;
        distances[nextIndex] = nextDistance;
        queue[tail++] = nextIndex;
      });
    }
    return distances;
  };

  const distanceToWater = buildDistanceField(true);
  const distanceToLand = buildDistanceField(false);

  const roadNearby = (x, y, radius = 1) => {
    for (let yy = y - radius; yy <= y + radius; yy += 1) {
      for (let xx = x - radius; xx <= x + radius; xx += 1) {
        if (isRoad(xx, yy)) return true;
      }
    }
    return false;
  };

  const specs = [];
  const ringTargets = (count, phase = 0, radiusX = 154, radiusY = 84) => Array.from(
    { length: count },
    (_, index) => {
      const angle = phase + (Math.PI * 2 * index) / count;
      return [
        Math.round(335 + Math.cos(angle) * radiusX),
        Math.round(610 + Math.sin(angle) * radiusY),
      ];
    },
  );
  const add = (tileId, placement, targets, options = {}) => {
    targets.forEach(([targetX, targetY], index) => {
      specs.push({ tileId, placement, targetX, targetY, index, ...options });
    });
  };

  add(0, 'water_shore', [[210, 545], [185, 600], [205, 650], [260, 682], [345, 692], [425, 670], [480, 625], [470, 570], [405, 535]].concat(ringTargets(18, 0.08)), { minSpacing: 4 });
  add(1, 'water_shore', [[225, 530], [190, 575], [190, 635], [300, 690], [390, 685], [465, 650], [485, 600], [445, 550]].concat(ringTargets(16, 0.2, 150, 81)), { minSpacing: 4 });
  add(2, 'water', [[235, 550], [205, 600], [230, 650], [290, 670], [350, 665], [410, 660], [450, 620], [450, 580], [400, 555], [360, 585]].concat(ringTargets(24, 0.12, 139, 72)), { minSpacing: 5 });
  add(3, 'land_shore', [[205, 535], [180, 585], [200, 640], [250, 680], [375, 690]].concat(ringTargets(14, 0.16, 161, 90)), { minSpacing: 4 });
  add(4, 'land_shore', [[445, 670], [485, 615], [470, 565], [410, 525]].concat(ringTargets(10, 0.34, 165, 92)), { minSpacing: 4 });
  add(5, 'land_shore', [[220, 655], [455, 645], [420, 540]].concat(ringTargets(6, 0.48, 167, 94)), { minSpacing: 5 });
  add(12, 'land_shore', [[180, 605], [435, 680], [490, 635]].concat(ringTargets(10, 0.61, 170, 96)), { minSpacing: 4 });
  add(13, 'land_shore', [[190, 620], [300, 700], [475, 590]].concat(ringTargets(10, 0.77, 174, 98)), { minSpacing: 5 });

  add(9, 'water', [[430, 555], [450, 660], [315, 690]], { width: 64, height: 64, minSpacing: 7 });
  add(9, 'water_deep', [[330, 600], [385, 620]], { width: 64, height: 64, minSpacing: 18 });

  add(6, 'land_shore', [[465, 566]], { setId: 'east_fishing_spot', width: 40, height: 40, minSpacing: 1 });
  add(7, 'land_shore', [[468, 566]], { setId: 'east_fishing_spot', width: 40, height: 40, minSpacing: 1 });
  add(8, 'land_shore', [[466, 570]], { setId: 'east_fishing_spot', width: 64, height: 64, minSpacing: 1 });
  add(10, 'land_shore', [[470, 570]], { setId: 'east_fishing_spot', width: 48, height: 48, minSpacing: 1 });
  add(11, 'land_shore', [[459, 563]], { setId: 'east_fishing_spot', width: 40, height: 40, minSpacing: 2 });
  add(14, 'land_shore', [[470, 573]], { setId: 'east_fishing_spot', width: 40, height: 40, minSpacing: 1 });
  add(15, 'land_shore', [[473, 572]], { setId: 'east_fishing_spot', width: 40, height: 40, minSpacing: 1 });

  add(6, 'land_shore', [[310, 698]], { setId: 'south_fishing_spot', width: 40, height: 40, minSpacing: 1 });
  add(7, 'land_shore', [[313, 699]], { setId: 'south_fishing_spot', width: 40, height: 40, minSpacing: 1 });
  add(8, 'land_shore', [[316, 700]], { setId: 'south_fishing_spot', width: 64, height: 64, minSpacing: 1 });
  add(10, 'land_shore', [[319, 701]], { setId: 'south_fishing_spot', width: 48, height: 48, minSpacing: 1 });
  add(14, 'land_shore', [[322, 701]], { setId: 'south_fishing_spot', width: 40, height: 40, minSpacing: 1 });
  add(15, 'land_shore', [[325, 702]], { setId: 'south_fishing_spot', width: 40, height: 40, minSpacing: 1 });

  const used = [];
  const validForPlacement = (spec, x, y) => {
    if (isVillageClearance(x, y)) return false;
    const waterTile = isWater(x, y);
    if (spec.placement.startsWith('water')) {
      if (!waterTile) return false;
      const distance = distanceToLand[indexAt(x, y)];
      if (spec.placement === 'water_shore') return distance >= 1 && distance <= 4;
      if (spec.placement === 'water_deep') return distance >= 14;
      return distance >= 3 && distance <= 13;
    }
    if (waterTile || roadNearby(x, y, 1)) return false;
    const distance = distanceToWater[indexAt(x, y)];
    return distance >= 1 && distance <= 5;
  };

  const choosePosition = (spec) => {
    let best = null;
    const searchRadius = spec.placement === 'water_deep' ? 64 : 48;
    const minY = Math.max(480, spec.targetY - searchRadius);
    const maxY = Math.min(720, spec.targetY + searchRadius);
    const minX = Math.max(150, spec.targetX - searchRadius);
    const maxX = Math.min(520, spec.targetX + searchRadius);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (!validForPlacement(spec, x, y)) continue;
        const nearestUsed = used.reduce((distance, point) => (
          Math.min(distance, Math.hypot(x - point.x, y - point.y))
        ), Number.POSITIVE_INFINITY);
        const requiredSpacing = spec.minSpacing ?? 3;
        if (nearestUsed < requiredSpacing) continue;
        const targetDistance = Math.hypot(x - spec.targetX, y - spec.targetY);
        const score = targetDistance + (nearestUsed < requiredSpacing + 2 ? 4 : 0);
        if (!best || score < best.score) best = { x, y, score };
      }
    }
    if (!best) throw new Error(`Could not place tile ${spec.tileId} near ${spec.targetX},${spec.targetY}.`);
    used.push(best);
    return best;
  };

  const existingTileset = map.tilesets.find((tileset) => tileset.source === tilesetSource);
  const firstgid = existingTileset?.firstgid ?? 30100;
  map.tilesets = map.tilesets.filter((tileset) => tileset.source !== tilesetSource);
  map.tilesets.push({ firstgid, source: tilesetSource });
  map.tilesets.sort((left, right) => left.firstgid - right.firstgid);

  const existingLayer = map.layers.find((layer) => layer.name === layerName);
  const layerId = existingLayer?.id ?? map.nextlayerid;
  const existingIds = new Map((existingLayer?.objects ?? []).map((object) => {
    const propId = (object.properties ?? []).find((entry) => entry.name === 'propId')?.value;
    return [propId || object.name, object.id];
  }));
  let nextObjectId = Math.max(map.nextobjectid ?? 1, 1);
  const counters = new Map();
  const objects = specs.map((spec) => {
    const [type, defaultPlacement] = tileTypes[spec.tileId];
    const count = (counters.get(type) ?? 0) + 1;
    counters.set(type, count);
    const propId = `brightwater_${type}_${String(count).padStart(2, '0')}`;
    const position = choosePosition(spec);
    const width = spec.width ?? 32;
    const height = spec.height ?? 32;
    const existingId = existingIds.get(propId);
    const id = existingId ?? nextObjectId++;
    const properties = [
      property('areaId', 'string', 'brightwater_lake'),
      property('displayName', 'string', type.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')),
      property('placement', 'string', defaultPlacement),
      property('propId', 'string', propId),
      property('type', 'string', type),
    ];
    if (spec.setId) properties.push(property('setId', 'string', spec.setId));
    return {
      gid: firstgid + spec.tileId,
      height,
      id,
      name: '',
      opacity: 1,
      properties,
      rotation: 0,
      type,
      visible: true,
      width,
      x: Math.round((position.x + 0.5) * tileSize - width / 2),
      y: Math.round((position.y + 1) * tileSize),
    };
  }).sort((left, right) => left.y - right.y || left.x - right.x);

  const layer = {
    draworder: 'topdown',
    id: layerId,
    name: layerName,
    objects,
    opacity: 1,
    properties: [
      property('areaId', 'string', 'brightwater_lake'),
      property('futureVillageClearance', 'string', 'x=270..350,y=500..570 tiles'),
      property('role', 'string', 'environment_props'),
    ],
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };

  map.layers = map.layers.filter((candidate) => candidate.name !== layerName);
  const roofsIndex = map.layers.findIndex((candidate) => candidate.name === 'CityRoofs');
  map.layers.splice(roofsIndex >= 0 ? roofsIndex : map.layers.length, 0, layer);
  map.nextlayerid = Math.max(map.nextlayerid ?? 1, layerId + 1);
  map.nextobjectid = Math.max(map.nextobjectid ?? 1, nextObjectId);
  fs.writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`, 'utf8');

  return {
    firstgid,
    layerId,
    objectCount: objects.length,
    nextObjectId: map.nextobjectid,
    villageClear: objects.every((object) => {
      const x = Math.floor((object.x + object.width / 2) / tileSize);
      const y = Math.floor(object.y / tileSize) - 1;
      return !isVillageClearance(x, y);
    }),
  };
}

const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : sourceArchivePath;
if (!fs.existsSync(inputPath)) {
  throw new Error('Pass the generated chroma-key sprite sheet path as the first argument.');
}

const image = buildSpriteSheet(inputPath);
writeTileset();
const map = addPropsToMap();
console.log(JSON.stringify({ image, map, outputImagePath, tsxPath, mapPath }, null, 2));
