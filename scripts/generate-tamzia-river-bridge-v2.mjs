import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'tamzia_river_bridge_v2';
const TILE = 256;
const COLUMNS = 3;
const ASSET_DIR = path.join(ROOT, 'public', 'assets', 'tilesets');
const PROJECT_TILESET_DIR = path.join(ROOT, 'public', 'tilesets');
const CONTINENT_TILESET_DIR = path.join(ROOT, 'public', 'maps', 'world_map', 'continents', 'continent_01', 'tilesets');

function rgba(hex, alpha = 255) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha,
  ];
}

function put(image, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= image.width || py >= image.height) return;
  const index = (py * image.width + px) * 4;
  image.data[index] = color[0];
  image.data[index + 1] = color[1];
  image.data[index + 2] = color[2];
  image.data[index + 3] = color[3];
}

function line(image, x0, y0, x1, y1, color, thickness = 1) {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    for (let oy = -Math.floor(thickness / 2); oy <= Math.floor(thickness / 2); oy += 1) {
      for (let ox = -Math.floor(thickness / 2); ox <= Math.floor(thickness / 2); ox += 1) {
        put(image, x0 + (x1 - x0) * t + ox, y0 + (y1 - y0) * t + oy, color);
      }
    }
  }
}

function polygon(image, points, color) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]))));
  const maxY = Math.min(image.height - 1, Math.ceil(Math.max(...points.map((point) => point[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    const nodes = [];
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
      const [x0, y0] = points[index];
      const [x1, y1] = points[previous];
      if ((y0 < y && y1 >= y) || (y1 < y && y0 >= y)) nodes.push(Math.round(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)));
    }
    nodes.sort((a, b) => a - b);
    for (let index = 0; index + 1 < nodes.length; index += 2) {
      for (let x = nodes[index]; x <= nodes[index + 1]; x += 1) put(image, x, y, color);
    }
  }
}

function drawWideBridge(image, tileIndex, variation = 0) {
  const ox = tileIndex * TILE;
  const shadow = rgba('#1d302b', 86);
  const outline = rgba('#2a1e16');
  const timberDark = rgba('#604027');
  const timber = rgba(variation ? '#a77342' : '#99683c');
  const timberLight = rgba('#c28b4e');
  const rail = rgba('#4b321f');
  // Lower-left to upper-right. The 56px deck is deliberately wide enough for two players.
  const deck = [[ox + 19, 200], [ox + 200, 19], [ox + 237, 56], [ox + 56, 237]];
  polygon(image, [[ox + 25, 207], [ox + 207, 25], [ox + 244, 62], [ox + 62, 244]], shadow);
  polygon(image, deck, outline);
  polygon(image, [[ox + 25, 199], [ox + 199, 25], [ox + 231, 57], [ox + 57, 231]], timberDark);
  polygon(image, [[ox + 32, 198], [ox + 198, 32], [ox + 224, 58], [ox + 58, 224]], timber);
  for (let offset = 0; offset < 12; offset += 1) {
    const t = (offset + 0.5) / 12;
    const centerX = ox + 42 + 171 * t;
    const centerY = 214 - 171 * t;
    line(image, centerX - 17, centerY - 17, centerX + 17, centerY + 17, rgba('#704927'), 3);
    line(image, centerX - 15, centerY - 15, centerX + 15, centerY + 15, timberLight, 1);
  }
  // Low rails run along the two edges; posts are intentionally few and simple.
  line(image, ox + 20, 196, ox + 196, 20, rail, 5);
  line(image, ox + 61, 236, ox + 236, 61, rail, 5);
  [0.15, 0.42, 0.69, 0.92].forEach((t) => {
    const x = ox + 27 + 176 * t;
    const y = 189 - 176 * t;
    line(image, x, y + 13, x + 8, y - 8, outline, 6);
    line(image, x + 1, y + 12, x + 8, y - 6, timberLight, 3);
    line(image, x + 41, y + 40, x + 49, y + 19, outline, 6);
    line(image, x + 42, y + 39, x + 49, y + 21, timberLight, 3);
  });
  // Short, flat stone lips make the ends visually meet the banks without extra props.
  line(image, ox + 16, 205, ox + 46, 235, rgba('#6f756d'), 7);
  line(image, ox + 210, 21, ox + 240, 51, rgba('#6f756d'), 7);
}

function main() {
  const sheet = new PNG({ width: TILE * COLUMNS, height: TILE });
  drawWideBridge(sheet, 0, 0);
  drawWideBridge(sheet, 1, 1);
  drawWideBridge(sheet, 2, 0);
  const png = PNG.sync.write(sheet, { colorType: 6, inputColorType: 6, deflateLevel: 9 });
  const tsx = `<?xml version="1.0" encoding="UTF-8"?>\n<tileset version="1.10" tiledversion="1.11.2" name="${NAME}" tilewidth="${TILE}" tileheight="${TILE}" tilecount="3" columns="3">\n <image source="${NAME}.png" width="${TILE * COLUMNS}" height="${TILE}"/>\n <tile id="0" type="wide_timber_bridge"/>\n <tile id="1" type="wide_timber_bridge_alt"/>\n <tile id="2" type="wide_timber_bridge"/>\n</tileset>\n`;
  [ASSET_DIR, PROJECT_TILESET_DIR, CONTINENT_TILESET_DIR].forEach((directory) => mkdirSync(directory, { recursive: true }));
  [ASSET_DIR, CONTINENT_TILESET_DIR].forEach((directory) => writeFileSync(path.join(directory, `${NAME}.png`), png));
  [PROJECT_TILESET_DIR, CONTINENT_TILESET_DIR].forEach((directory) => writeFileSync(path.join(directory, `${NAME}.tsx`), tsx));
  console.log(JSON.stringify({ tileset: NAME, tileSize: TILE, tileCount: COLUMNS, style: 'native low-detail pixel art' }, null, 2));
}

main();
