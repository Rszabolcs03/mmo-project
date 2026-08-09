import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const continentRoot = path.join(rootDir, 'public', 'maps', 'world_map', 'continents', 'continent_01');
const regionsDir = path.join(continentRoot, 'regions');

const TILE_SIZE = 32;
const REGION_GRID = 5;
const REGION_TILES = 800;
const WORLD_TILES = REGION_GRID * REGION_TILES;
const WORLD_TILE_COUNT = WORLD_TILES * WORLD_TILES;
const TILED_GID_MASK = 0x1fffffff;

const LOCAL = {
  base: 1,
  alt: 2,
  dark: 3,
  dirt: 4,
  bank: 8,
  stone: 9,
  mud: 12,
  light: 13,
  reeds: 15,
  forestFloor: 17,
  sand: 20,
  tallGrass: 21,
  ruinFloor: 24,
};

const BIOMES = {
  emerald: { firstgid: 1 },
  golden: { firstgid: 257 },
  elderwood: { firstgid: 513 },
  silver: { firstgid: 769 },
  sunhill: { firstgid: 1025 },
  cloudspine: { firstgid: 1281 },
  ironcrag: { firstgid: 1537 },
  murkfen: { firstgid: 1793 },
  oldEmpire: { firstgid: 2049 },
  saltwind: { firstgid: 2305 },
  amber: { firstgid: 2561 },
  shadowfen: { firstgid: 2817 },
};

const macroRoutes = {
  centralRoad: [[450, 3050], [900, 2920], [1380, 2945], [1960, 2820], [2440, 2540]],
  southRoad: [[280, 3650], [650, 3540], [1160, 3470], [1660, 3420], [2280, 3380]],
  tamziaRoad: [[420, 930], [1050, 930], [1540, 1030], [2060, 1350], [2500, 1800]],
  eastRoad: [[2460, 2480], [2820, 2120], [3180, 1700], [3500, 1300]],
  northRiver: [[780, 610], [1285, 805], [1805, 1085], [2380, 1305], [3045, 1332], [3994, 1242]],
  southRiver: [[970, 2760], [1325, 2460], [1740, 2115], [2255, 1840], [2915, 1935], [3993, 2860]],
  marshDrain: [[1940, 3155], [2445, 2998], [2970, 3330], [3610, 3745], [3988, 3890]],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothStep(value) {
  return value * value * (3 - 2 * value);
}

function hash2(x, y, seed = 0) {
  let value = ((x + seed * 101) * 374761393 + (y - seed * 37) * 668265263) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, cellSize, seed = 0) {
  const fx = x / cellSize;
  const fy = y / cellSize;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smoothStep(fx - x0);
  const ty = smoothStep(fy - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

function field(x, y, seed = 0) {
  return (valueNoise(x, y, 180, seed) - 0.5) * 0.55
    + (valueNoise(x + 79, y - 31, 340, seed + 3) - 0.5) * 0.35
    + (valueNoise(x - 41, y + 67, 95, seed + 7) - 0.5) * 0.18;
}

function globalIndex(x, y) {
  return y * WORLD_TILES + x;
}

function gid(biomeKey, localId) {
  return BIOMES[biomeKey].firstgid + localId - 1;
}

function familyForGid(value) {
  const gidValue = Number(value ?? 0) & TILED_GID_MASK;
  for (const [key, biome] of Object.entries(BIOMES)) {
    if (gidValue >= biome.firstgid && gidValue < biome.firstgid + 256) return key;
  }
  return 'unknown';
}

function localCalm(seed, x, y, base = LOCAL.base, alt = LOCAL.alt, detail = LOCAL.light) {
  const roll = hash2(Math.floor(x / 7), Math.floor(y / 7), seed);
  if (roll > 0.992) return detail;
  if (roll > 0.92) return alt;
  return base;
}

function decodeLayer(layer) {
  if (Array.isArray(layer.data)) return Uint32Array.from(layer.data);
  if (layer.encoding !== 'base64' || layer.compression !== 'zlib' || typeof layer.data !== 'string') {
    throw new Error(`Unsupported layer encoding for ${layer.name}`);
  }
  const inflated = zlib.inflateSync(Buffer.from(layer.data, 'base64'));
  const data = new Uint32Array(Math.floor(inflated.length / 4));
  for (let index = 0; index < data.length; index += 1) data[index] = inflated.readUInt32LE(index * 4);
  return data;
}

function encodeLayer(layer, data) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let index = 0; index < data.length; index += 1) buffer.writeUInt32LE(data[index] >>> 0, index * 4);
  layer.encoding = 'base64';
  layer.compression = 'zlib';
  layer.data = zlib.deflateSync(buffer, { level: 6 }).toString('base64');
}

function getTileLayer(map, name) {
  const layer = map.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === name);
  if (!layer) throw new Error(`Missing tile layer ${name}`);
  return layer;
}

function distanceToSegmentSquared(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return (px - ax) ** 2 + (py - ay) ** 2;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const sx = ax + t * dx;
  const sy = ay + t * dy;
  return (px - sx) ** 2 + (py - sy) ** 2;
}

function routeDistance(x, y, route) {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.length; index += 1) {
    const [ax, ay] = route[index - 1];
    const [bx, by] = route[index];
    best = Math.min(best, distanceToSegmentSquared(x, y, ax, ay, bx, by));
  }
  return Math.sqrt(best);
}

function nearestRouteDistance(x, y, routes) {
  return Math.min(...routes.map((route) => routeDistance(x, y, route)));
}

function buildInfluence(mask, radius, maxDistanceSquared) {
  const influence = new Uint8Array(WORLD_TILE_COUNT);
  for (let y = 0; y < WORLD_TILES; y += 1) {
    for (let x = 0; x < WORLD_TILES; x += 1) {
      const index = globalIndex(x, y);
      if (!mask[index]) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= WORLD_TILES) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > maxDistanceSquared) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= WORLD_TILES) continue;
          influence[globalIndex(xx, yy)] = 1;
        }
      }
    }
  }
  return influence;
}

function isInsideProtectedCity(globalTileX, globalTileY, protectedCityRects) {
  return protectedCityRects.some((rect) => (
    globalTileX >= rect.x
    && globalTileX <= rect.x + rect.width
    && globalTileY >= rect.y
    && globalTileY <= rect.y + rect.height
  ));
}

function macroFlags(x, y, oldFamily, roadNearWide, shoreNear, waterEdge) {
  const northForestEdge = 1580 + field(x, y, 21) * 310;
  const northForestSouth = 1760 + field(x + 100, y, 23) * 300;
  const eastWildsEdge = 2590 + field(x, y, 31) * 260;
  const southFieldsNorth = 2460 + field(x, y, 41) * 240;
  const marshWest = 2940 + field(x, y, 51) * 260;
  const marshNorth = 2500 + field(x, y, 53) * 260;

  const nwForest = x < northForestEdge && y < northForestSouth;
  const eastWilds = x > eastWildsEdge && y > 760 + field(x, y, 33) * 160 && y < 3040 + field(x, y, 35) * 180;
  const southFields = y > southFieldsNorth && x < 2740 + field(x, y, 43) * 220;
  const marsh = (x > marshWest && y > marshNorth)
    || ((oldFamily === 'murkfen' || oldFamily === 'shadowfen') && x > 2680 && y > 2180);
  const central = !nwForest && !eastWilds && !southFields && !marsh;
  const coast = oldFamily === 'saltwind'
    && (shoreNear || x < 260 || x > 3740 || y < 260 || y > 3740);

  const riverMeadow = shoreNear
    || routeDistance(x, y, macroRoutes.northRiver) < 34
    || routeDistance(x, y, macroRoutes.southRiver) < 38
    || routeDistance(x, y, macroRoutes.marshDrain) < 32;

  return { nwForest, eastWilds, southFields, marsh, central, coast, riverMeadow, roadNearWide, waterEdge };
}

function chooseBiomeTile(x, y, oldFamily, flags) {
  const patch = valueNoise(x, y, 165, 201);
  const smallPatch = valueNoise(x + 41, y - 73, 88, 203);
  const dry = valueNoise(x + 180, y - 90, 210, 207) + clamp((y - 2980) / 1200, 0, 0.22) + clamp((520 - x) / 700, 0, 0.18);
  const wet = valueNoise(x - 90, y + 130, 190, 211) + (flags.riverMeadow ? 0.34 : 0) + (flags.marsh ? 0.24 : 0);
  const forest = valueNoise(x + 65, y + 25, 150, 217);
  const rock = valueNoise(x - 30, y + 45, 130, 223);

  if (flags.coast) {
    if (flags.waterEdge) return gid('saltwind', localCalm(301, x, y, LOCAL.sand, LOCAL.bank, LOCAL.light));
    if (flags.nwForest && patch > 0.62) return gid('emerald', localCalm(302, x, y));
    if (flags.southFields && dry > 0.72) return gid('amber', localCalm(303, x, y));
    return gid('saltwind', localCalm(304, x, y, LOCAL.base, LOCAL.alt, LOCAL.sand));
  }

  if (flags.marsh) {
    if (flags.waterEdge || wet > 0.82) return gid('murkfen', localCalm(321, x, y, LOCAL.base, LOCAL.mud, LOCAL.reeds));
    if (forest > 0.66 && smallPatch > 0.44) return gid('shadowfen', localCalm(322, x, y, LOCAL.base, LOCAL.dark, LOCAL.forestFloor));
    if (flags.roadNearWide) return gid('murkfen', localCalm(323, x, y, LOCAL.base, LOCAL.dirt, LOCAL.mud));
    return gid('murkfen', localCalm(324, x, y));
  }

  if (flags.riverMeadow) {
    if (flags.waterEdge) return gid('silver', localCalm(341, x, y, LOCAL.light, LOCAL.bank, LOCAL.tallGrass));
    if (flags.nwForest && forest > 0.5) return gid('elderwood', localCalm(342, x, y, LOCAL.base, LOCAL.forestFloor, LOCAL.dark));
    if (flags.eastWilds && forest > 0.44) return gid('elderwood', localCalm(343, x, y, LOCAL.base, LOCAL.dark, LOCAL.forestFloor));
    return gid('silver', localCalm(344, x, y, LOCAL.light, LOCAL.base, LOCAL.tallGrass));
  }

  if (flags.roadNearWide) {
    if (flags.eastWilds) return gid('emerald', localCalm(361, x, y, LOCAL.base, LOCAL.light, LOCAL.dirt));
    if (flags.marsh) return gid('murkfen', localCalm(362, x, y, LOCAL.base, LOCAL.dirt, LOCAL.mud));
    if (flags.southFields) return gid('golden', localCalm(363, x, y, LOCAL.base, LOCAL.light, LOCAL.dirt));
    return gid('emerald', localCalm(364, x, y, LOCAL.base, LOCAL.light, LOCAL.tallGrass));
  }

  if (flags.nwForest) {
    if (forest > 0.72) return gid('elderwood', localCalm(381, x, y, LOCAL.base, LOCAL.dark, LOCAL.forestFloor));
    if (patch > 0.46) return gid('emerald', localCalm(382, x, y, LOCAL.base, LOCAL.alt, LOCAL.light));
    return gid('elderwood', localCalm(383, x, y, LOCAL.base, LOCAL.forestFloor, LOCAL.dark));
  }

  if (flags.eastWilds) {
    if (wet > 0.8 && y > 2100) return gid('murkfen', localCalm(401, x, y, LOCAL.base, LOCAL.mud, LOCAL.reeds));
    if (forest > 0.64) return gid('elderwood', localCalm(402, x, y, LOCAL.base, LOCAL.dark, LOCAL.forestFloor));
    if (forest < 0.22 && patch > 0.62) return gid('shadowfen', localCalm(403, x, y, LOCAL.base, LOCAL.dark, LOCAL.forestFloor));
    return gid('emerald', localCalm(404, x, y, LOCAL.base, LOCAL.dark, LOCAL.light));
  }

  if (flags.southFields) {
    if (rock > 0.86 && dry > 0.54) return gid('oldEmpire', localCalm(421, x, y, LOCAL.ruinFloor, LOCAL.stone, LOCAL.dirt));
    if (dry > 0.78) return gid('amber', localCalm(422, x, y, LOCAL.base, LOCAL.alt, LOCAL.light));
    if (patch > 0.62) return gid('golden', localCalm(423, x, y, LOCAL.base, LOCAL.light, LOCAL.tallGrass));
    if (patch < 0.28) return gid('emerald', localCalm(424, x, y, LOCAL.base, LOCAL.light, LOCAL.alt));
    return gid('sunhill', localCalm(425, x, y, LOCAL.base, LOCAL.alt, LOCAL.light));
  }

  if (flags.central) {
    const nearTamzia = x < 1850 && y < 1600;
    if (nearTamzia && forest > 0.62 && x < 1000) return gid('emerald', localCalm(441, x, y, LOCAL.base, LOCAL.alt, LOCAL.light));
    if (patch > 0.76 && y < 1500) return gid('golden', localCalm(442, x, y, LOCAL.base, LOCAL.light, LOCAL.tallGrass));
    if (patch < 0.1 && forest > 0.65) return gid('elderwood', localCalm(443, x, y, LOCAL.base, LOCAL.forestFloor, LOCAL.dark));
    return gid('emerald', localCalm(444, x, y, LOCAL.base, LOCAL.light, LOCAL.alt));
  }

  return gid('emerald', localCalm(461, x, y));
}

function chooseTerrainDetail(x, y, groundGid, flags) {
  const roll = hash2(Math.floor(x / 11), Math.floor(y / 11), 503);
  if (roll < 0.997) return 0;
  const family = familyForGid(groundGid);
  if (family === 'murkfen' || family === 'shadowfen') return gid('murkfen', LOCAL.reeds);
  if (family === 'oldEmpire') return gid('oldEmpire', LOCAL.stone);
  if (family === 'saltwind') return gid('saltwind', LOCAL.sand);
  if (family === 'elderwood') return gid('elderwood', LOCAL.forestFloor);
  if (flags.riverMeadow) return gid('silver', LOCAL.tallGrass);
  return gid('emerald', LOCAL.tallGrass);
}

async function main() {
  const regionEntries = [];
  const roadMask = new Uint8Array(WORLD_TILE_COUNT);
  const shoreMask = new Uint8Array(WORLD_TILE_COUNT);
  const protectedCityRects = [];
  const objectSignatureBefore = [];

  for (let regionY = 0; regionY < REGION_GRID; regionY += 1) {
    for (let regionX = 0; regionX < REGION_GRID; regionX += 1) {
      const file = path.join(regionsDir, `continent_01_region_${regionX}_${regionY}.tmj`);
      const map = JSON.parse(await fs.readFile(file, 'utf8'));
      const roads = decodeLayer(getTileLayer(map, 'Roads'));
      const waterEdges = decodeLayer(getTileLayer(map, 'WaterEdges'));
      const offsetX = regionX * REGION_TILES;
      const offsetY = regionY * REGION_TILES;

      if (regionX === 0 && regionY === 0) {
        const cityObjects = map.layers.find((layer) => layer.name === 'CityArea')?.objects ?? [];
        cityObjects.forEach((object) => {
          protectedCityRects.push({
            x: Math.max(0, Math.floor(Number(object.x ?? 0) / TILE_SIZE) - 8),
            y: Math.max(0, Math.floor(Number(object.y ?? 0) / TILE_SIZE) - 8),
            width: Math.ceil(Number(object.width ?? 0) / TILE_SIZE) + 16,
            height: Math.ceil(Number(object.height ?? 0) / TILE_SIZE) + 16,
          });
        });
      }

      for (const layer of map.layers) {
        if (layer.type !== 'objectgroup') continue;
        objectSignatureBefore.push(`${regionX}_${regionY}:${layer.name}:${(layer.objects ?? []).length}`);
      }

      for (let localY = 0; localY < REGION_TILES; localY += 1) {
        for (let localX = 0; localX < REGION_TILES; localX += 1) {
          const localIndex = localY * REGION_TILES + localX;
          const index = globalIndex(offsetX + localX, offsetY + localY);
          if (roads[localIndex]) roadMask[index] = 1;
          if (waterEdges[localIndex]) shoreMask[index] = 1;
        }
      }

      regionEntries.push({ file, map, regionX, regionY });
    }
  }

  const roadNear = buildInfluence(roadMask, 6, 38);
  const roadNearWide = buildInfluence(roadMask, 11, 122);
  const shoreNear = buildInfluence(shoreMask, 7, 58);

  const stats = {
    changedGroundTiles: 0,
    terrainDetailTiles: 0,
    mountainFamilyTilesReplaced: 0,
    roadCollisionCleared: 0,
    protectedCityTiles: 0,
    objectLayersTouched: 0,
    regionsChanged: [],
    familyCounts: Object.fromEntries(Object.keys(BIOMES).map((key) => [key, 0])),
  };

  for (const entry of regionEntries) {
    const { file, map, regionX, regionY } = entry;
    const groundLayer = getTileLayer(map, 'Ground');
    const waterLayer = getTileLayer(map, 'Water');
    const terrainLayer = getTileLayer(map, 'TerrainDetails');
    const roadsLayer = getTileLayer(map, 'Roads');
    const collisionLayer = getTileLayer(map, 'Collision');
    const oldGround = decodeLayer(groundLayer);
    const water = decodeLayer(waterLayer);
    const roads = decodeLayer(roadsLayer);
    const oldTerrain = decodeLayer(terrainLayer);
    const oldCollision = decodeLayer(collisionLayer);
    const nextGround = new Uint32Array(oldGround);
    const nextTerrain = new Uint32Array(oldTerrain);
    const nextCollision = new Uint32Array(oldCollision);
    const offsetX = regionX * REGION_TILES;
    const offsetY = regionY * REGION_TILES;
    let changedThisRegion = false;

    for (let localY = 0; localY < REGION_TILES; localY += 1) {
      for (let localX = 0; localX < REGION_TILES; localX += 1) {
        const localIndex = localY * REGION_TILES + localX;
        const x = offsetX + localX;
        const y = offsetY + localY;
        const global = globalIndex(x, y);

        if (isInsideProtectedCity(x, y, protectedCityRects)) {
          stats.protectedCityTiles += 1;
          continue;
        }

        const oldFamily = familyForGid(oldGround[localIndex]);
        if (water[localIndex]) {
          if (oldFamily === 'cloudspine' || oldFamily === 'ironcrag') {
            nextGround[localIndex] = gid('silver', LOCAL.light);
            stats.mountainFamilyTilesReplaced += 1;
          }
          continue;
        }

        const flags = macroFlags(
          x,
          y,
          oldFamily,
          Boolean(roadNearWide[global]),
          Boolean(shoreNear[global]),
          Boolean(shoreMask[global]),
        );
        const nextGid = chooseBiomeTile(x, y, oldFamily, flags);
        if (nextGid !== oldGround[localIndex]) {
          if (oldFamily === 'cloudspine' || oldFamily === 'ironcrag') stats.mountainFamilyTilesReplaced += 1;
          nextGround[localIndex] = nextGid;
          nextTerrain[localIndex] = chooseTerrainDetail(x, y, nextGid, flags);
          if (nextTerrain[localIndex]) stats.terrainDetailTiles += 1;
          stats.changedGroundTiles += 1;
          changedThisRegion = true;
        }

        if (roads[localIndex] && nextCollision[localIndex]) {
          nextCollision[localIndex] = 0;
          stats.roadCollisionCleared += 1;
        }
      }
    }

    for (const value of nextGround) {
      const family = familyForGid(value);
      if (stats.familyCounts[family] !== undefined) stats.familyCounts[family] += 1;
    }

    encodeLayer(groundLayer, nextGround);
    encodeLayer(terrainLayer, nextTerrain);
    encodeLayer(collisionLayer, nextCollision);
    collisionLayer.visible = false;
    await fs.writeFile(file, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
    if (changedThisRegion) stats.regionsChanged.push(path.relative(rootDir, file).replaceAll(path.sep, '/'));
  }

  const objectSignatureAfter = [];
  for (const entry of regionEntries) {
    const { map, regionX, regionY } = entry;
    for (const layer of map.layers) {
      if (layer.type !== 'objectgroup') continue;
      objectSignatureAfter.push(`${regionX}_${regionY}:${layer.name}:${(layer.objects ?? []).length}`);
    }
  }
  stats.objectLayersTouched = objectSignatureBefore.join('|') === objectSignatureAfter.join('|') ? 0 : 1;

  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
