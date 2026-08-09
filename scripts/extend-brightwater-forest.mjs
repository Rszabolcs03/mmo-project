import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const regionsDir = path.join(rootDir, 'public', 'maps', 'world_map', 'continents', 'continent_01', 'regions');
const sourceMapPath = path.join(regionsDir, 'continent_01_region_0_0.tmj');
const targetMapPath = path.join(regionsDir, 'continent_01_region_1_0.tmj');
const TILE_SIZE = 32;
const GID_MASK = 0x1fffffff;
const FOREST_SOURCE = '../tilesets/tamzia_forest_v1.tsx';
const BANDIT_FOREST_SOURCE = '../tilesets/tamzia_bandit_forest_v1.tsx';
const SOURCE_FOREST_FIRSTGID = 26520;
const SOURCE_BANDIT_FIRSTGID = 26584;
const FOREST_TILECOUNT = 64;
const BANDIT_TILECOUNT = 20;

function decodeLayerData(layer, tileCount) {
  if (!layer || layer.type !== 'tilelayer') return new Uint32Array(tileCount);
  if (Array.isArray(layer.data)) return Uint32Array.from(layer.data);
  if (layer.encoding !== 'base64' || layer.compression !== 'zlib') return new Uint32Array(tileCount);
  const buffer = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(tileCount);
  for (let index = 0; index < data.length; index += 1) data[index] = buffer.readUInt32LE(index * 4);
  return data;
}

function getProperty(object, name) {
  return (object?.properties ?? []).find((entry) => entry.name === name)?.value;
}

function setProperty(properties, name, type, value) {
  const next = (properties ?? []).filter((entry) => entry.name !== name);
  next.push({ name, type, value });
  return next;
}

function polygonPoints(object) {
  return (object.polygon ?? []).map((point) => ({
    x: Number(object.x ?? 0) + Number(point.x ?? 0),
    y: Number(object.y ?? 0) + Number(point.y ?? 0),
  }));
}

function polygonBounds(points) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    area += points[previous].x * points[index].y - points[index].x * points[previous].y;
  }
  return Math.abs(area) / 2;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const a = points[index];
    const b = points[previous];
    if (((a.y > y) !== (b.y > y)) && x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || 0.0001) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seedText) {
  let state = hashSeed(seedText) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function ensureTileset(map, source, preferredFirstgid, tilecount) {
  const existing = (map.tilesets ?? []).find((tileset) => tileset.source === source);
  if (existing) return Number(existing.firstgid);
  const occupied = (map.tilesets ?? []).map((tileset) => {
    const tsxPath = path.resolve(path.dirname(targetMapPath), tileset.source ?? '');
    let existingTilecount = 1;
    try {
      const match = fs.readFileSync(tsxPath, 'utf8').match(/tilecount="(\d+)"/);
      if (match) existingTilecount = Math.max(1, Number(match[1]));
    } catch {
      existingTilecount = 1;
    }
    return {
      firstgid: Number(tileset.firstgid),
      end: Number(tileset.firstgid) + existingTilecount,
    };
  });
  const overlaps = occupied.some((range) => preferredFirstgid < range.end && preferredFirstgid + tilecount > range.firstgid);
  if (overlaps) throw new Error(`Preferred tileset range ${preferredFirstgid}..${preferredFirstgid + tilecount - 1} is occupied.`);
  map.tilesets.push({ firstgid: preferredFirstgid, source });
  map.tilesets.sort((left, right) => left.firstgid - right.firstgid);
  return preferredFirstgid;
}

function remapTemplateGid(gid, forestFirstgid, banditFirstgid) {
  const base = Number(gid ?? 0) & GID_MASK;
  if (base >= SOURCE_FOREST_FIRSTGID && base < SOURCE_FOREST_FIRSTGID + FOREST_TILECOUNT) {
    return forestFirstgid + base - SOURCE_FOREST_FIRSTGID;
  }
  if (base >= SOURCE_BANDIT_FIRSTGID && base < SOURCE_BANDIT_FIRSTGID + BANDIT_TILECOUNT) {
    return banditFirstgid + base - SOURCE_BANDIT_FIRSTGID;
  }
  throw new Error(`Unexpected forest template GID ${gid}.`);
}

function main() {
  const sourceMap = JSON.parse(fs.readFileSync(sourceMapPath, 'utf8'));
  const targetMap = JSON.parse(fs.readFileSync(targetMapPath, 'utf8'));
  const forestAreaLayer = targetMap.layers.find((layer) => layer.type === 'objectgroup' && layer.name === 'Forest_area');
  const areas = (forestAreaLayer?.objects ?? [])
    .filter((object) => Array.isArray(object.polygon) && object.polygon.length >= 3)
    .map((object) => {
      const points = polygonPoints(object);
      return { object, points, bounds: polygonBounds(points), area: polygonArea(points) };
    })
    .sort((left, right) => left.bounds.minY - right.bounds.minY);
  if (areas.length !== 2) throw new Error(`Expected exactly two Forest_area polygons, found ${areas.length}.`);

  const sourceForestLayer = sourceMap.layers.find((layer) => layer.type === 'objectgroup' && layer.name === 'tamzia_forest');
  const sourceBanditLayer = sourceMap.layers.find((layer) => layer.type === 'objectgroup' && layer.name === 'tamzia_bandit_forest');
  const forestTemplates = (sourceForestLayer?.objects ?? []).filter((object) => Number(object.gid ?? 0) > 0 && object.type);
  const banditTemplates = (sourceBanditLayer?.objects ?? []).filter((object) => Number(object.gid ?? 0) > 0 && object.type);
  if (!forestTemplates.length || !banditTemplates.length) throw new Error('Missing source forest templates in region 0_0.');

  const forestFirstgid = ensureTileset(targetMap, FOREST_SOURCE, SOURCE_FOREST_FIRSTGID, FOREST_TILECOUNT);
  const banditFirstgid = ensureTileset(targetMap, BANDIT_FOREST_SOURCE, SOURCE_BANDIT_FIRSTGID, BANDIT_TILECOUNT);
  const tileCount = targetMap.width * targetMap.height;
  const blockingLayers = Object.fromEntries([
    'Water',
    'ShallowWater',
    'Roads',
    'Buildings',
    'CityInteriors',
    'CaveInteriors',
    'CaveDetails',
    'CaveEntrances',
    'Collision',
    'CaveCollision',
  ].map((name) => [
    name,
    decodeLayerData(targetMap.layers.find((layer) => layer.type === 'tilelayer' && layer.name === name), tileCount),
  ]));

  const tileBlocked = (layerNames, pixelX, pixelY, radiusTiles) => {
    const centerX = Math.floor(pixelX / TILE_SIZE);
    const centerY = Math.floor(pixelY / TILE_SIZE);
    for (let tileY = centerY - radiusTiles; tileY <= centerY + radiusTiles; tileY += 1) {
      for (let tileX = centerX - radiusTiles; tileX <= centerX + radiusTiles; tileX += 1) {
        if (tileX < 0 || tileY < 0 || tileX >= targetMap.width || tileY >= targetMap.height) return true;
        const index = tileY * targetMap.width + tileX;
        if (layerNames.some((name) => blockingLayers[name][index] !== 0)) return true;
      }
    }
    return false;
  };

  const existingLayers = new Map([
    ['tamzia_forest', targetMap.layers.find((layer) => layer.type === 'objectgroup' && layer.name === 'tamzia_forest')],
    ['tamzia_bandit_forest', targetMap.layers.find((layer) => layer.type === 'objectgroup' && layer.name === 'tamzia_bandit_forest')],
  ]);
  const existingIds = new Map();
  existingLayers.forEach((layer) => {
    (layer?.objects ?? []).forEach((object) => {
      const continuationId = getProperty(object, 'continuationId');
      if (continuationId) existingIds.set(continuationId, object.id);
    });
  });
  let nextObjectId = Math.max(
    Number(targetMap.nextobjectid ?? 1),
    ...targetMap.layers.flatMap((layer) => (layer.objects ?? []).map((object) => Number(object.id ?? 0) + 1)),
  );

  const makeObjects = ({ area, kind, templates, step, seed }) => {
    const random = randomFromSeed(seed);
    const objects = [];
    const startX = Math.floor(area.bounds.minX / step) * step;
    const startY = Math.floor(area.bounds.minY / step) * step;
    let gridIndex = 0;
    for (let baseY = startY; baseY <= area.bounds.maxY; baseY += step) {
      for (let baseX = startX; baseX <= area.bounds.maxX; baseX += step) {
        const template = templates[Math.floor(random() * templates.length)];
        const isTree = String(template.type).includes('tree');
        const isLargeDetail = Number(template.width ?? 0) >= 90 || Number(template.height ?? 0) >= 90;
        let position = null;
        for (let attempt = 0; attempt < 4 && !position; attempt += 1) {
          const jitter = step * 0.42;
          const x = Math.round(baseX + step / 2 + (random() * 2 - 1) * jitter);
          const y = Math.round(baseY + step / 2 + (random() * 2 - 1) * jitter);
          if (!pointInPolygon(x, y, area.points)) continue;
          const waterRadius = isTree ? 3 : isLargeDetail ? 2 : 1;
          const roadRadius = isTree ? 4 : isLargeDetail ? 3 : 2;
          if (tileBlocked(['Water', 'ShallowWater'], x, y, waterRadius)) continue;
          if (tileBlocked(['Roads'], x, y, roadRadius)) continue;
          if (tileBlocked(['Buildings', 'CityInteriors', 'CaveInteriors', 'CaveDetails', 'CaveEntrances', 'Collision', 'CaveCollision'], x, y, isTree ? 2 : 1)) continue;
          position = { x, y };
        }
        if (!position) {
          gridIndex += 1;
          continue;
        }

        const continuationId = `${kind}_${Math.round(baseX)}_${Math.round(baseY)}_${gridIndex}`;
        const id = existingIds.get(continuationId) ?? nextObjectId++;
        let properties = [...(template.properties ?? [])];
        properties = setProperty(properties, 'continuationId', 'string', continuationId);
        properties = setProperty(properties, 'continuation', 'bool', true);
        properties = setProperty(properties, 'generatedBy', 'string', 'extend_brightwater_forest_v1');
        properties = setProperty(properties, 'sourceRegion', 'string', 'continent_01_region_0_0');
        properties = kind === 'tamzia_forest'
          ? setProperty(properties, 'forestArea', 'string', 'brightwater_north_forest_extension')
          : setProperty(properties, 'banditForestArea', 'string', 'brightwater_south_forest_extension');
        objects.push({
          ...template,
          gid: remapTemplateGid(template.gid, forestFirstgid, banditFirstgid),
          id,
          name: '',
          x: position.x - Number(template.width ?? 0) / 2,
          y: position.y,
          properties,
        });
        gridIndex += 1;
      }
    }
    return objects.sort((left, right) => left.y - right.y || left.x - right.x);
  };

  const forestObjects = makeObjects({
    area: areas[0],
    kind: 'tamzia_forest',
    templates: forestTemplates,
    step: 170,
    seed: 'brightwater-north-forest-extension-v1',
  });
  const banditObjects = makeObjects({
    area: areas[1],
    kind: 'tamzia_bandit_forest',
    templates: banditTemplates,
    step: 190,
    seed: 'brightwater-south-forest-extension-v1',
  });

  let nextLayerId = Math.max(
    Number(targetMap.nextlayerid ?? 1),
    ...targetMap.layers.map((layer) => Number(layer.id ?? 0) + 1),
  );
  const makeLayer = (name, objects, areaId) => ({
    draworder: 'topdown',
    id: existingLayers.get(name)?.id ?? nextLayerId++,
    name,
    objects,
    opacity: 1,
    properties: [
      { name: 'areaId', type: 'string', value: areaId },
      { name: 'generatedBy', type: 'string', value: 'extend_brightwater_forest_v1' },
      { name: 'sourceRegion', type: 'string', value: 'continent_01_region_0_0' },
    ],
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  });
  const generatedLayers = [
    makeLayer('tamzia_forest', forestObjects, 'brightwater_north_forest_extension'),
    makeLayer('tamzia_bandit_forest', banditObjects, 'brightwater_south_forest_extension'),
  ];

  targetMap.layers = targetMap.layers.filter((layer) => !['tamzia_forest', 'tamzia_bandit_forest'].includes(layer.name));
  const insertionIndex = targetMap.layers.findIndex((layer) => layer.name === 'BrightwaterLakesideProps');
  targetMap.layers.splice(insertionIndex >= 0 ? insertionIndex : targetMap.layers.length, 0, ...generatedLayers);
  targetMap.nextlayerid = Math.max(nextLayerId, ...generatedLayers.map((layer) => layer.id + 1));
  targetMap.nextobjectid = Math.max(nextObjectId, Number(targetMap.nextobjectid ?? 1));
  fs.writeFileSync(targetMapPath, `${JSON.stringify(targetMap, null, 2)}\n`, 'utf8');

  const typeCounts = (objects) => Object.fromEntries(
    [...new Set(objects.map((object) => object.type))]
      .sort()
      .map((type) => [type, objects.filter((object) => object.type === type).length]),
  );
  console.log(JSON.stringify({
    areas: areas.map((area) => ({ bounds: area.bounds, area: Math.round(area.area) })),
    tamziaForest: { objects: forestObjects.length, types: typeCounts(forestObjects) },
    tamziaBanditForest: { objects: banditObjects.length, types: typeCounts(banditObjects) },
    firstgids: { forestFirstgid, banditFirstgid },
    nextlayerid: targetMap.nextlayerid,
    nextobjectid: targetMap.nextobjectid,
  }, null, 2));
}

main();
