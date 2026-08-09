import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'brightwater_ford_bridge_v1';
const TILE = 32;
const COLUMNS = 3;
const ROWS = 4;
const ASSET_DIR = path.join(ROOT, 'public', 'assets', 'tilesets');
const PROJECT_TILESET_DIR = path.join(ROOT, 'public', 'tilesets');
const CONTINENT_TILESET_DIR = path.join(ROOT, 'public', 'maps', 'world_map', 'continents', 'continent_01', 'tilesets');

function color(hex, alpha = 255) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha,
  ];
}

function pixel(image, x, y, rgba) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const index = (y * image.width + x) * 4;
  image.data[index] = rgba[0];
  image.data[index + 1] = rgba[1];
  image.data[index + 2] = rgba[2];
  image.data[index + 3] = rgba[3];
}

function fill(image, x, y, width, height, rgba) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) pixel(image, px, py, rgba);
  }
}

function horizontal(image, x, y, width, rgba, thickness = 1) {
  fill(image, x, y, width, thickness, rgba);
}

function vertical(image, x, y, height, rgba, thickness = 1) {
  fill(image, x, y, thickness, height, rgba);
}

function drawRailRow(image, tileX, tileY, role, front) {
  const x = tileX * TILE;
  const y = tileY * TILE;
  const outline = color('#2e2119');
  const shadow = color('#4e3220');
  const wood = color('#895b35');
  const light = color('#ba8247');
  const railY = front ? y + 3 : y + 23;
  const postY = front ? y + 0 : y + 15;

  horizontal(image, x, railY, TILE, outline, 7);
  horizontal(image, x + 1, railY + 1, TILE - 2, shadow, 5);
  horizontal(image, x + 2, railY + 2, TILE - 4, wood, 2);
  horizontal(image, x + 3, railY + 2, TILE - 6, light, 1);

  const posts = role === 'left'
    ? [5, 25]
    : (role === 'right' ? [6, 26] : [6, 25]);
  for (const offset of posts) {
    vertical(image, x + offset - 2, postY, 15, outline, 5);
    vertical(image, x + offset - 1, postY + 1, 12, shadow, 3);
    vertical(image, x + offset, postY + 2, 10, wood, 1);
    horizontal(image, x + offset - 3, front ? y + 12 : y + 15, 7, outline, 2);
  }
}

function drawDeckRow(image, tileX, tileY, role, alternate) {
  const x = tileX * TILE;
  const y = tileY * TILE;
  const outline = color('#2e2119');
  const dark = color('#5d3b24');
  const wood = color(alternate ? '#a76f3e' : '#946039');
  const highlight = color('#c08a4b');
  const grain = color('#714725');

  fill(image, x, y, TILE, TILE, outline);
  fill(image, x + 2, y + 1, TILE - 4, TILE - 2, dark);
  fill(image, x + 3, y + 2, TILE - 6, TILE - 4, wood);
  horizontal(image, x + 3, y + 3, TILE - 6, highlight);
  if (tileY === 1) horizontal(image, x + 3, y + 29, TILE - 6, grain);
  if (tileY === 2) horizontal(image, x + 3, y + 2, TILE - 6, grain);

  // Low-detail planks: enough separation for readability at world-map scale,
  // but not the high-detail treatment that looked out of place previously.
  for (const offset of [7, 16, 25]) {
    vertical(image, x + offset, y + 3, TILE - 6, grain, 1);
    if ((offset + tileX) % 2 === 0) vertical(image, x + offset + 1, y + 5, TILE - 10, highlight, 1);
  }
  horizontal(image, x + 4, y + 15, TILE - 8, grain, 1);
  if (role === 'left') vertical(image, x + 2, y + 2, TILE - 4, outline, 2);
  if (role === 'right') vertical(image, x + TILE - 4, y + 2, TILE - 4, outline, 2);
}

function drawTile(image, column, row) {
  const role = column === 0 ? 'left' : (column === COLUMNS - 1 ? 'right' : 'middle');
  if (row === 0) drawRailRow(image, column, row, role, false);
  else if (row === ROWS - 1) drawRailRow(image, column, row, role, true);
  else drawDeckRow(image, column, row, role, column === 1);
}

function main() {
  const sheet = new PNG({ width: TILE * COLUMNS, height: TILE * ROWS });
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) drawTile(sheet, column, row);
  }
  const png = PNG.sync.write(sheet, { colorType: 6, inputColorType: 6, deflateLevel: 9 });
  const tsx = `<?xml version="1.0" encoding="UTF-8"?>\n<tileset version="1.10" tiledversion="1.11.2" name="${NAME}" tilewidth="${TILE}" tileheight="${TILE}" tilecount="${COLUMNS * ROWS}" columns="${COLUMNS}">\n <image source="${NAME}.png" width="${TILE * COLUMNS}" height="${TILE * ROWS}"/>\n</tileset>\n`;
  [ASSET_DIR, PROJECT_TILESET_DIR, CONTINENT_TILESET_DIR].forEach((directory) => mkdirSync(directory, { recursive: true }));
  [ASSET_DIR, PROJECT_TILESET_DIR, CONTINENT_TILESET_DIR].forEach((directory) => {
    writeFileSync(path.join(directory, `${NAME}.png`), png);
  });
  [PROJECT_TILESET_DIR, CONTINENT_TILESET_DIR].forEach((directory) => {
    writeFileSync(path.join(directory, `${NAME}.tsx`), tsx);
  });
  console.log(JSON.stringify({ tileset: NAME, tileSize: TILE, tiles: COLUMNS * ROWS, bridgeRows: ROWS }, null, 2));
}

main();
