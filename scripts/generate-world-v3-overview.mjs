import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mapsDir = path.join(rootDir, 'public', 'maps');
const registryPath = path.join(mapsDir, 'world_regions_v3.json');
const outputPath = path.join(mapsDir, 'world_v3_overview.png');

const COLLISION_LAYER_NAME = 'Collision';
const WORLD_BACKGROUND = [47, 111, 126, 255];
const TILED_GID_MASK = 0x0fffffff;

function parseXmlAttributes(tag) {
  const attributes = {};
  const pattern = /([a-zA-Z_:][\w:.-]*)="([^"]*)"/g;
  let match = pattern.exec(tag);
  while (match) {
    attributes[match[1]] = match[2];
    match = pattern.exec(tag);
  }
  return attributes;
}

function readTileset(tsxPath) {
  const xml = readFileSync(tsxPath, 'utf8');
  const tilesetTag = xml.match(/<tileset\b[^>]*>/)?.[0];
  const imageTag = xml.match(/<image\b[^>]*>/)?.[0];
  if (!tilesetTag || !imageTag) {
    throw new Error(`Invalid tileset: ${tsxPath}`);
  }

  const tilesetAttrs = parseXmlAttributes(tilesetTag);
  const imageAttrs = parseXmlAttributes(imageTag);
  const tilewidth = Number(tilesetAttrs.tilewidth || 32);
  const tileheight = Number(tilesetAttrs.tileheight || 32);
  const columns = Number(tilesetAttrs.columns || Math.floor(Number(imageAttrs.width || 0) / tilewidth) || 1);
  const tilecount = Number(tilesetAttrs.tilecount || 0);
  const imagePath = path.resolve(path.dirname(tsxPath), imageAttrs.source.replaceAll('/', path.sep));
  const png = PNG.sync.read(readFileSync(imagePath));

  return {
    tilewidth,
    tileheight,
    columns,
    tilecount,
    png,
  };
}

function getTileAverageColor(tileset, localId) {
  const sx = (localId % tileset.columns) * tileset.tilewidth;
  const sy = Math.floor(localId / tileset.columns) * tileset.tileheight;
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let painted = 0;

  for (let y = 0; y < tileset.tileheight; y += 1) {
    for (let x = 0; x < tileset.tilewidth; x += 1) {
      const px = sx + x;
      const py = sy + y;
      if (px >= tileset.png.width || py >= tileset.png.height) continue;

      const index = (py * tileset.png.width + px) * 4;
      const pixelAlpha = tileset.png.data[index + 3];
      if (pixelAlpha <= 8) continue;

      red += tileset.png.data[index];
      green += tileset.png.data[index + 1];
      blue += tileset.png.data[index + 2];
      alpha += pixelAlpha;
      painted += 1;
    }
  }

  if (!painted) return null;

  const coverage = painted / (tileset.tilewidth * tileset.tileheight);
  return [
    Math.round(red / painted),
    Math.round(green / painted),
    Math.round(blue / painted),
    Math.max(18, Math.round((alpha / painted) * coverage)),
  ];
}

function decodeLayerData(layer) {
  if (Array.isArray(layer.data)) return Uint32Array.from(layer.data);
  if (layer.encoding !== 'base64' || layer.compression !== 'zlib' || typeof layer.data !== 'string') {
    throw new Error(`Unsupported layer encoding: ${layer.name} (${layer.encoding}/${layer.compression})`);
  }

  const inflated = zlib.inflateSync(Buffer.from(layer.data.trim(), 'base64'));
  const data = new Uint32Array(layer.width * layer.height);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = inflated.readUInt32LE(index * 4);
  }
  return data;
}

function blendPixel(target, index, color) {
  const alpha = color[3] / 255;
  if (alpha >= 0.995) {
    target[index] = color[0];
    target[index + 1] = color[1];
    target[index + 2] = color[2];
    target[index + 3] = 255;
    return;
  }

  const inverseAlpha = 1 - alpha;
  target[index] = Math.round(color[0] * alpha + target[index] * inverseAlpha);
  target[index + 1] = Math.round(color[1] * alpha + target[index + 1] * inverseAlpha);
  target[index + 2] = Math.round(color[2] * alpha + target[index + 2] * inverseAlpha);
  target[index + 3] = 255;
}

function fillPng(png, color) {
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = color[0];
    png.data[index + 1] = color[1];
    png.data[index + 2] = color[2];
    png.data[index + 3] = color[3];
  }
}

function buildTilesetColorLookup(map, tilesetCache, gidColors) {
  const tilesets = [...(map.tilesets ?? [])].sort((a, b) => a.firstgid - b.firstgid);
  for (const entry of tilesets) {
    if (gidColors[entry.firstgid]) continue;

    const tsxPath = path.resolve(mapsDir, entry.source.replaceAll('/', path.sep));
    let tileset = tilesetCache.get(tsxPath);
    if (!tileset) {
      tileset = readTileset(tsxPath);
      tilesetCache.set(tsxPath, tileset);
    }

    for (let localId = 0; localId < tileset.tilecount; localId += 1) {
      const color = getTileAverageColor(tileset, localId);
      if (color) gidColors[entry.firstgid + localId] = color;
    }
  }
}

function drawRegionLayer(output, region, layer, gidColors) {
  const data = decodeLayerData(layer);
  for (let row = 0; row < layer.height; row += 1) {
    const worldY = region.y + row;
    if (worldY < 0 || worldY >= output.height) continue;

    let sourceIndex = row * layer.width;
    let targetIndex = ((worldY * output.width) + region.x) * 4;
    for (let col = 0; col < layer.width; col += 1, sourceIndex += 1, targetIndex += 4) {
      const gid = (data[sourceIndex] || 0) & TILED_GID_MASK;
      if (!gid) continue;

      const color = gidColors[gid];
      if (!color) continue;
      blendPixel(output.data, targetIndex, color);
    }
  }
}

async function main() {
  const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
  const output = new PNG({
    width: registry.worldTiles.width,
    height: registry.worldTiles.height,
  });
  const tilesetCache = new Map();
  const gidColors = [];
  let layerCount = 0;

  fillPng(output, WORLD_BACKGROUND);

  for (const region of registry.regions) {
    const mapPath = path.join(mapsDir, region.file);
    const map = JSON.parse(await fs.readFile(mapPath, 'utf8'));
    buildTilesetColorLookup(map, tilesetCache, gidColors);

    const tileLayers = map.layers.filter((layer) => (
      layer.type === 'tilelayer'
      && layer.visible !== false
      && layer.name !== COLLISION_LAYER_NAME
    ));

    for (const layer of tileLayers) {
      drawRegionLayer(output, region, layer, gidColors);
      layerCount += 1;
    }

    console.log(`Rendered ${region.file}: ${tileLayers.length} layers`);
  }

  const pngBuffer = PNG.sync.write(output, { colorType: 6, inputColorType: 6, deflateLevel: 9 });
  await fs.writeFile(outputPath, pngBuffer);

  console.log(`Wrote ${path.relative(rootDir, outputPath)} (${output.width}x${output.height}, ${pngBuffer.length} bytes, ${tilesetCache.size} tilesets, ${layerCount} layers)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
