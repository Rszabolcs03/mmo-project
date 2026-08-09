import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_PATH = path.join(
  ROOT,
  'public',
  'maps',
  'world_map',
  'continents',
  'continent_01',
  'regions',
  'continent_01_region_0_0.tmj',
);
const LAYER_NAME = 'tamzia_bandit_forest';
const AREA_NAME = 'tamzia_bandit_forest';

function clipPolygonToBoundary(points, axis, limit, keepGreater) {
  if (!points.length) return [];
  const inside = (point) => (keepGreater ? point[axis] >= limit : point[axis] <= limit);
  const intersection = (from, to) => {
    const delta = to[axis] - from[axis];
    if (Math.abs(delta) < 0.000001) return { ...to, [axis]: limit };
    const t = (limit - from[axis]) / delta;
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
  };

  const output = [];
  for (let index = 0; index < points.length; index += 1) {
    const from = points[(index + points.length - 1) % points.length];
    const to = points[index];
    const fromInside = inside(from);
    const toInside = inside(to);
    if (toInside !== fromInside) output.push(intersection(from, to));
    if (toInside) output.push({ ...to });
  }
  return output;
}

function dedupePolygon(points) {
  return points.filter((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    return Math.abs(point.x - previous.x) > 0.0001 || Math.abs(point.y - previous.y) > 0.0001;
  });
}

function clipPolygonToRegion(points, width, height) {
  return [
    ['x', 0, true],
    ['x', width, false],
    ['y', 0, true],
    ['y', height, false],
  ].reduce((clipped, [axis, limit, keepGreater]) => (
    clipPolygonToBoundary(clipped, axis, limit, keepGreater)
  ), points);
}

function clipAreaObject(area, width, height) {
  const absolutePoints = (area.polygon ?? []).map((point) => ({
    x: area.x + point.x,
    y: area.y + point.y,
  }));
  const clipped = dedupePolygon(clipPolygonToRegion(absolutePoints, width, height));
  if (clipped.length < 3) throw new Error(`${AREA_NAME} no longer intersects this region.`);

  const anchor = clipped[0];
  area.x = Number(anchor.x.toFixed(3));
  area.y = Number(anchor.y.toFixed(3));
  area.width = 0;
  area.height = 0;
  area.polygon = clipped.map((point) => ({
    x: Number((point.x - anchor.x).toFixed(3)),
    y: Number((point.y - anchor.y).toFixed(3)),
  }));
}

function isOutsideRegion(object, width, height) {
  const x = Number(object.x ?? 0);
  const y = Number(object.y ?? 0);
  const objectWidth = Number(object.width ?? 0);
  // Tile objects are bottom-anchored in Tiled: their artwork extends upward,
  // so only their eastward footprint needs an additional containment check.
  return x < 0 || y < 0 || x > width || y > height || x + objectWidth > width;
}

const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
const width = Number(map.width) * Number(map.tilewidth);
const height = Number(map.height) * Number(map.tileheight);
const layer = map.layers.find((candidate) => candidate.type === 'objectgroup' && candidate.name === LAYER_NAME);
if (!layer) throw new Error(`Missing ${LAYER_NAME} object layer.`);

const area = layer.objects.find((object) => object.name === AREA_NAME && Array.isArray(object.polygon));
if (!area) throw new Error(`Missing ${AREA_NAME} area polygon.`);

clipAreaObject(area, width, height);

let removedDecorCount = 0;
layer.objects = layer.objects.filter((object) => {
  if (object === area) return true;
  if (!isOutsideRegion(object, width, height)) return true;
  removedDecorCount += 1;
  return false;
});

writeFileSync(MAP_PATH, `${JSON.stringify(map)}\n`, 'utf8');
console.log(`Clipped ${AREA_NAME} to ${width}x${height}; removed ${removedDecorCount} out-of-region forest objects.`);
