import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mapPath = path.join(
  rootDir,
  'public',
  'maps',
  'world_map',
  'continents',
  'continent_01',
  'regions',
  'continent_01_region_0_0.tmj',
);

const spawnNames = new Set(['tamzia_wolves', 'tamzia_bears']);
const sideCount = 12;
const applyChanges = process.argv.includes('--apply');

function rounded(value) {
  return Math.round(value * 100) / 100;
}

function ellipseToPolygon(object) {
  const width = Math.max(1, Number(object.width ?? 1));
  const height = Math.max(1, Number(object.height ?? 1));
  const radiusX = width / 2;
  const radiusY = height / 2;

  object.x = rounded(Number(object.x ?? 0) + radiusX);
  object.y = rounded(Number(object.y ?? 0) + radiusY);
  object.polygon = Array.from({ length: sideCount }, (_, index) => {
    const angle = -Math.PI / 2 + (index / sideCount) * Math.PI * 2;
    return {
      x: rounded(Math.cos(angle) * radiusX),
      y: rounded(Math.sin(angle) * radiusY),
    };
  });
  delete object.ellipse;
  delete object.width;
  delete object.height;
}

const map = JSON.parse(await fs.readFile(mapPath, 'utf8'));
const spawnsLayer = map.layers?.find((layer) => layer.type === 'objectgroup' && layer.name === 'Spawns');
if (!spawnsLayer) throw new Error('The Spawns layer was not found.');

const converted = [];
(spawnsLayer.objects ?? []).forEach((object) => {
  if (!spawnNames.has(object.name)) return;
  if (Array.isArray(object.polygon) && object.polygon.length >= 3) {
    converted.push({ name: object.name, id: object.id, state: 'alreadyPolygon' });
    return;
  }
  if (!object.ellipse) throw new Error(`${object.name} is not an ellipse, so it cannot be migrated safely.`);
  ellipseToPolygon(object);
  converted.push({ name: object.name, id: object.id, state: 'converted', vertices: sideCount });
});

if (converted.length !== spawnNames.size) {
  throw new Error('Could not find both tamzia_wolves and tamzia_bears in the Spawns layer.');
}

if (!applyChanges) {
  console.log(JSON.stringify({
    dryRun: true,
    message: 'No map file was changed. Save and close the map in Tiled, then rerun with --apply.',
    converted,
  }, null, 2));
  process.exit(0);
}

await fs.writeFile(mapPath, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  map: path.relative(rootDir, mapPath),
  converted,
  note: 'The original IDs, names, classes and custom spawn properties were preserved.',
}, null, 2));
