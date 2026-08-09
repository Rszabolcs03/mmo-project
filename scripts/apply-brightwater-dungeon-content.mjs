import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = process.cwd();
const REGION_ID = 'continent_01_region_1_0';
const REGION_X = 1;
const REGION_Y = 0;
const TILE = 32;
const REGION_TILES = 800;
const REGION_PIXEL_OFFSET = {
  x: REGION_X * REGION_TILES * TILE,
  y: REGION_Y * REGION_TILES * TILE,
};

const REGION_PATH = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions/continent_01_region_1_0.tmj');
const DUNGEON_MAP_PATH = path.join(ROOT, 'public/maps/dungeons/dungeon_01/dungeon_01.tmj');
const CHUNK_INDEX_PATH = path.join(ROOT, 'public/maps/world_map/continents/continent_01/regions/chunks/continent_01_chunks.json');
const CHUNK_DIR = path.dirname(CHUNK_INDEX_PATH);
const REGISTRY_PATH = path.join(ROOT, 'public/maps/world_map/continents/continent_01/continent_01_regions.json');
const MANIFEST_PATH = path.join(ROOT, 'public/maps/world_map/continents/continent_01/continent_01_manifest.json');
const CONTINENT_TILESET_DIR = path.join(ROOT, 'public/maps/world_map/continents/continent_01/tilesets');
const ENEMY_DIR = path.join(ROOT, 'public/assets/enemies');

const CHUNK_RUNTIME_VERSION = 'v4-continent-01-runtime-chunks-9';
const DUNGEON_ENTRANCE_TILESET_NAME = 'dungeon_entrance_v1';
const DUNGEON_ENTRANCE_TSX_NAME = `${DUNGEON_ENTRANCE_TILESET_NAME}.tsx`;
const DUNGEON_ENTRANCE_PNG_NAME = `${DUNGEON_ENTRANCE_TILESET_NAME}.png`;
const DUNGEON_ENTRANCE_REGION_SOURCE = `../tilesets/${DUNGEON_ENTRANCE_TSX_NAME}`;
const DUNGEON_ENTRANCE_CHUNK_SOURCE = `../../tilesets/${DUNGEON_ENTRANCE_TSX_NAME}`;
const DUNGEON_ENTRANCE_TILE_WIDTH = 128;
const DUNGEON_ENTRANCE_TILE_HEIGHT = 96;
const DUNGEON_ENTRANCE_TILECOUNT = 4;
const DUNGEON_ENTRANCE_DRAW_WIDTH = 192;
const DUNGEON_ENTRANCE_DRAW_HEIGHT = 144;
const DUNGEON_TRANSITION_WIDTH = 260;
const DUNGEON_TRANSITION_HEIGHT = 190;
const BRIGHTWATER_CAVE_ID = 'cave_01';

const BRIGHTWATER_QUEST_GIVER_ID = 'brightwater_ford_pathfinder';
const DUNGEON_ENTRANCE_NAME = 'dungeon_01_entrance';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function color(hex, alpha = 255) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha,
  ];
}

function setPixel(png, x, y, rgba) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (y * png.width + x) * 4;
  png.data[index] = rgba[0];
  png.data[index + 1] = rgba[1];
  png.data[index + 2] = rgba[2];
  png.data[index + 3] = rgba[3];
}

function rect(png, x, y, width, height, hex, alpha = 255) {
  const rgba = color(hex, alpha);
  for (let yy = Math.round(y); yy < Math.round(y + height); yy += 1) {
    for (let xx = Math.round(x); xx < Math.round(x + width); xx += 1) setPixel(png, xx, yy, rgba);
  }
}

function ellipse(png, cx, cy, rx, ry, hex, alpha = 255) {
  const rgba = color(hex, alpha);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / Math.max(1, rx);
      const ny = (y - cy) / Math.max(1, ry);
      if (nx * nx + ny * ny <= 1) setPixel(png, x, y, rgba);
    }
  }
}

function line(png, x1, y1, x2, y2, size, hex, alpha = 255) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    ellipse(png, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, size / 2, size / 2, hex, alpha);
  }
}

function fillPolygon(png, points, hex, alpha = 255) {
  const minX = Math.floor(Math.min(...points.map((point) => point.x)));
  const maxX = Math.ceil(Math.max(...points.map((point) => point.x)));
  const minY = Math.floor(Math.min(...points.map((point) => point.y)));
  const maxY = Math.ceil(Math.max(...points.map((point) => point.y)));
  const rgba = color(hex, alpha);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const a = points[i];
        const b = points[j];
        if (((a.y > y) !== (b.y > y)) && x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || 0.0001) + a.x) {
          inside = !inside;
        }
      }
      if (inside) setPixel(png, x, y, rgba);
    }
  }
}

function generateDungeonEntranceTileset() {
  ensureDir(CONTINENT_TILESET_DIR);
  const png = new PNG({
    width: DUNGEON_ENTRANCE_TILE_WIDTH * DUNGEON_ENTRANCE_TILECOUNT,
    height: DUNGEON_ENTRANCE_TILE_HEIGHT,
    colorType: 6,
  });

  for (let frame = 0; frame < DUNGEON_ENTRANCE_TILECOUNT; frame += 1) {
    const ox = frame * DUNGEON_ENTRANCE_TILE_WIDTH;
    const glow = frame === 1 || frame === 2 ? 1 : 0;
    ellipse(png, ox + 64, 84, 48, 11, '#000000', 95);
    fillPolygon(png, [
      { x: ox + 12, y: 72 },
      { x: ox + 21, y: 43 },
      { x: ox + 37, y: 22 },
      { x: ox + 55, y: 11 },
      { x: ox + 76, y: 12 },
      { x: ox + 96, y: 27 },
      { x: ox + 111, y: 55 },
      { x: ox + 116, y: 76 },
      { x: ox + 91, y: 88 },
      { x: ox + 36, y: 87 },
    ], '#252923');
    fillPolygon(png, [
      { x: ox + 20, y: 73 },
      { x: ox + 29, y: 49 },
      { x: ox + 43, y: 29 },
      { x: ox + 58, y: 20 },
      { x: ox + 73, y: 20 },
      { x: ox + 89, y: 34 },
      { x: ox + 101, y: 58 },
      { x: ox + 106, y: 77 },
      { x: ox + 88, y: 82 },
      { x: ox + 39, y: 82 },
    ], '#4b5146');
    ellipse(png, ox + 64, 62, 35, 29, '#080b0b');
    ellipse(png, ox + 64, 68, 28, 23, '#020404');
    ellipse(png, ox + 64, 69, 23, 16, glow ? '#172322' : '#0f1514', glow ? 220 : 190);
    line(png, ox + 28, 73, ox + 100, 73, 8, '#6b5034');
    line(png, ox + 31, 76, ox + 97, 76, 4, '#a1622d');
    rect(png, ox + 22, 59, 11, 18, '#69716a');
    rect(png, ox + 94, 56, 13, 22, '#69716a');
    rect(png, ox + 36, 18, 20, 8, '#747b74');
    rect(png, ox + 58, 13, 19, 7, '#8b9289');
    rect(png, ox + 76, 22, 20, 8, '#69716a');
    line(png, ox + 41, 39, ox + 28, 67, 3, '#1b1f1c');
    line(png, ox + 88, 38, ox + 101, 67, 3, '#1b1f1c');
    line(png, ox + 54, 24, ox + 47, 42, 2, '#25201a');
    line(png, ox + 75, 23, ox + 85, 45, 2, '#25201a');
    rect(png, ox + 35, 74, 9, 5, '#d97706', 200 + glow * 35);
    rect(png, ox + 84, 73, 8, 5, '#f59e0b', 190 + glow * 45);
    ellipse(png, ox + 64, 70, 18 + glow * 3, 5 + glow, '#38bdf8', 35 + glow * 35);
  }

  fs.writeFileSync(path.join(CONTINENT_TILESET_DIR, DUNGEON_ENTRANCE_PNG_NAME), PNG.sync.write(png));
  fs.writeFileSync(path.join(CONTINENT_TILESET_DIR, DUNGEON_ENTRANCE_TSX_NAME), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<tileset version="1.10" tiledversion="1.12.1" name="${DUNGEON_ENTRANCE_TILESET_NAME}" tilewidth="${DUNGEON_ENTRANCE_TILE_WIDTH}" tileheight="${DUNGEON_ENTRANCE_TILE_HEIGHT}" tilecount="${DUNGEON_ENTRANCE_TILECOUNT}" columns="${DUNGEON_ENTRANCE_TILECOUNT}">`,
    ` <image source="${DUNGEON_ENTRANCE_PNG_NAME}" width="${DUNGEON_ENTRANCE_TILE_WIDTH * DUNGEON_ENTRANCE_TILECOUNT}" height="${DUNGEON_ENTRANCE_TILE_HEIGHT}"/>`,
    ' <tile id="0">',
    '  <properties>',
    '   <property name="type" value="dungeon_entrance"/>',
    '  </properties>',
    '  <animation>',
    '   <frame tileid="0" duration="180"/>',
    '   <frame tileid="1" duration="180"/>',
    '   <frame tileid="2" duration="180"/>',
    '   <frame tileid="3" duration="180"/>',
    '  </animation>',
    ' </tile>',
    '</tileset>',
    '',
  ].join('\n'));
}

function drawCaveMonsterFrame(png, id, frame, frameWidth, frameHeight, options = {}) {
  const ox = frame * frameWidth;
  const pulse = frame % 2 === 0 ? 0 : 3;
  const boss = frameWidth > 64;
  const cx = ox + frameWidth / 2;
  const cy = boss ? 54 + pulse : 37 + pulse;
  ellipse(png, cx, frameHeight - (boss ? 13 : 9), boss ? 38 : 24, boss ? 10 : 6, '#000000', 80);

  if (id === 'cave-spider') {
    for (const side of [-1, 1]) {
      line(png, cx + side * 10, cy + 4, cx + side * 31, cy - 8 + pulse, 4, '#141817');
      line(png, cx + side * 11, cy + 8, cx + side * 34, cy + 4 - pulse, 4, '#141817');
      line(png, cx + side * 9, cy + 12, cx + side * 29, cy + 20 - pulse, 4, '#141817');
    }
    ellipse(png, cx, cy, 20, 15, '#111827');
    ellipse(png, cx, cy, 14, 10, '#334155');
    rect(png, cx - 8, cy - 4, 4, 4, '#a7f3d0');
    rect(png, cx + 4, cy - 4, 4, 4, '#a7f3d0');
    return;
  }

  if (id === 'deep-burrower') {
    ellipse(png, cx, cy + 8, 27, 15, '#292524');
    ellipse(png, cx, cy + 7, 20, 11, '#6b5d46');
    rect(png, cx - 17, cy + 2, 9, 9, '#d6c190');
    rect(png, cx + 8, cy + 2, 9, 9, '#d6c190');
    line(png, cx - 18, cy - 2, cx - 30, cy - 13, 4, '#c7b58b');
    line(png, cx + 18, cy - 2, cx + 30, cy - 13, 4, '#c7b58b');
    rect(png, cx - 4, cy + 5, 8, 3, '#0f172a');
    return;
  }

  if (id === 'magma-crawler') {
    ellipse(png, cx, cy + 4, 24, 17, '#1c1917');
    ellipse(png, cx, cy + 4, 17, 12, '#7f1d1d');
    ellipse(png, cx, cy + 7, 9, 5, '#f97316');
    rect(png, cx - 19, cy + 1, 6, 5, '#facc15');
    rect(png, cx + 13, cy + 1, 6, 5, '#facc15');
    line(png, cx - 17, cy + 15, cx - 32, cy + 24 - pulse, 5, '#1c1917');
    line(png, cx + 17, cy + 15, cx + 32, cy + 24 - pulse, 5, '#1c1917');
    return;
  }

  if (id === 'obsidian-sentinel') {
    ellipse(png, cx, cy + 8, 23, 16, '#020617');
    rect(png, cx - 15, cy - 14, 30, 35, '#334155');
    rect(png, cx - 10, cy - 8, 20, 23, '#1f2937');
    rect(png, cx - 5, cy - 2, 10, 4, '#67e8f9');
    line(png, cx - 18, cy + 3, cx - 30, cy + 19 - pulse, 6, '#020617');
    line(png, cx + 18, cy + 3, cx + 30, cy + 19 - pulse, 6, '#020617');
    return;
  }

  if (boss) {
    for (const side of [-1, 1]) {
      line(png, cx + side * 18, cy + 12, cx + side * 48, cy + 33 - pulse, 7, '#1e1b4b');
      line(png, cx + side * 13, cy - 1, cx + side * 43, cy - 19 + pulse, 6, '#1e1b4b');
    }
    ellipse(png, cx, cy, 35, 30, '#1e1b4b');
    ellipse(png, cx, cy, 26, 22, '#581c87');
    rect(png, cx - 12, cy - 8, 7, 7, '#d9f99d');
    rect(png, cx + 5, cy - 8, 7, 7, '#d9f99d');
    line(png, cx - 17, cy + 15, cx + 17, cy + 15, 4, '#0f172a');
    rect(png, cx - 28, cy - 29, 9, 24, '#a3e635');
    rect(png, cx + 19, cy - 29, 9, 24, '#a3e635');
    return;
  }

  ellipse(png, cx, cy, 23, 19, options.outline ?? '#111827');
  ellipse(png, cx, cy + 1, 16, 14, options.body ?? '#475569');
  rect(png, cx - 13, cy - 6, 6, 6, options.eye ?? '#c4b5fd');
  rect(png, cx + 7, cy - 6, 6, 6, options.eye ?? '#c4b5fd');
  line(png, cx - 15, cy + 13, cx - 28, cy + 24 - pulse, 5, options.outline ?? '#111827');
  line(png, cx + 15, cy + 13, cx + 28, cy + 24 - pulse, 5, options.outline ?? '#111827');
  line(png, cx - 5, cy + 15, cx + 5, cy + 15, 3, '#0f172a');
}

function generateEnemySprite(id, options = {}) {
  ensureDir(ENEMY_DIR);
  const boss = Boolean(options.boss);
  const frameWidth = boss ? 96 : 64;
  const frameHeight = boss ? 96 : 64;
  const frameCount = 4;
  const png = new PNG({ width: frameWidth * frameCount, height: frameHeight, colorType: 6 });
  for (let frame = 0; frame < frameCount; frame += 1) {
    drawCaveMonsterFrame(png, id, frame, frameWidth, frameHeight, options);
  }
  fs.writeFileSync(path.join(ENEMY_DIR, `${id}.png`), PNG.sync.write(png));
}

function generateCaveMonsterSprites() {
  generateEnemySprite('cave-spider');
  generateEnemySprite('cave-stalker', { body: '#475569', outline: '#111827', eye: '#c4b5fd' });
  generateEnemySprite('deep-burrower');
  generateEnemySprite('magma-crawler');
  generateEnemySprite('obsidian-sentinel');
  generateEnemySprite('gloomfang-matriarch', { boss: true });
}

function property(name, value, type = typeof value === 'boolean' ? 'bool' : Number.isInteger(value) ? 'int' : typeof value === 'number' ? 'float' : 'string') {
  return { name, type, value };
}

function getProps(object) {
  return Object.fromEntries((object?.properties ?? []).map((item) => [item.name, item.value]));
}

function setProps(object, nextProps) {
  const merged = { ...getProps(object), ...nextProps };
  object.properties = Object.entries(merged).map(([name, value]) => property(name, value));
}

function parseTilecount(tsxPath, fallback = 1) {
  if (!fs.existsSync(tsxPath)) return fallback;
  const content = fs.readFileSync(tsxPath, 'utf8');
  const match = content.match(/tilecount="(\d+)"/);
  return match ? Number(match[1]) : fallback;
}

function getNextFirstGid(tilesets, baseDir) {
  let next = 1;
  for (const tileset of tilesets ?? []) {
    const sourcePath = path.resolve(baseDir, tileset.source ?? '');
    next = Math.max(next, Number(tileset.firstgid ?? 1) + parseTilecount(sourcePath, 1));
  }
  return next;
}

function ensureTileset(map, source, baseDir) {
  const existing = (map.tilesets ?? []).find((tileset) => tileset.source === source || String(tileset.source ?? '').endsWith(path.basename(source)));
  if (existing) {
    existing.source = source;
    return Number(existing.firstgid);
  }
  const firstgid = getNextFirstGid(map.tilesets ?? [], baseDir);
  map.tilesets = [...(map.tilesets ?? []), { firstgid, source }];
  return firstgid;
}

function getLayer(map, name, type = 'objectgroup') {
  let layer = map.layers.find((candidate) => candidate.name === name && candidate.type === type);
  if (layer) return layer;
  const nextId = Math.max(0, Number(map.nextlayerid ?? 0), ...map.layers.map((item) => Number(item.id ?? 0))) + 1;
  layer = type === 'objectgroup'
    ? { id: nextId, name, type, draworder: 'topdown', visible: true, opacity: 1, objects: [] }
    : null;
  if (!layer) throw new Error(`Cannot create ${type} layer ${name}`);
  map.layers.push(layer);
  map.nextlayerid = nextId + 1;
  return layer;
}

function nextObjectId(map) {
  const maxLayerId = Math.max(
    0,
    Number(map.nextobjectid ?? 0),
    ...map.layers.flatMap((layer) => (layer.objects ?? []).map((object) => Number(object.id ?? 0))),
  );
  map.nextobjectid = maxLayerId + 1;
  return maxLayerId;
}

function centerOf(object) {
  return {
    x: Number(object.x ?? 0) + Number(object.width ?? 0) / 2,
    y: Number(object.y ?? 0) + Number(object.height ?? 0) / 2,
  };
}

function upsertObject(layer, name, createObject) {
  let object = (layer.objects ?? []).find((candidate) => candidate.name === name);
  if (!object) {
    object = createObject();
    layer.objects = [...(layer.objects ?? []), object];
  }
  return object;
}

function patchRegionMap() {
  const map = JSON.parse(fs.readFileSync(REGION_PATH, 'utf8'));
  const entranceFirstgid = ensureTileset(map, DUNGEON_ENTRANCE_REGION_SOURCE, path.dirname(REGION_PATH));
  const transitions = getLayer(map, 'Transitions');
  const props = getLayer(map, 'Props');
  const caveProps = getLayer(map, 'CaveProps');
  const landmarks = getLayer(map, 'Landmarks');
  const caveSpawns = getLayer(map, 'CaveSpawns');

  const dungeonTransition = transitions.objects.find((object) => ['dungeon_01', DUNGEON_ENTRANCE_NAME].includes(object.name))
    ?? transitions.objects.find((object) => getProps(object).targetMapId === 'dungeon_01');
  if (!dungeonTransition) throw new Error('Missing dungeon_01 transition marker in Brightwater Ford.');

  const transitionCenter = centerOf(dungeonTransition);
  dungeonTransition.name = DUNGEON_ENTRANCE_NAME;
  dungeonTransition.type = 'transition';
  dungeonTransition.ellipse = true;
  dungeonTransition.x = transitionCenter.x - DUNGEON_TRANSITION_WIDTH / 2;
  dungeonTransition.y = transitionCenter.y - DUNGEON_TRANSITION_HEIGHT / 2;
  dungeonTransition.width = DUNGEON_TRANSITION_WIDTH;
  dungeonTransition.height = DUNGEON_TRANSITION_HEIGHT;
  dungeonTransition.visible = true;
  setProps(dungeonTransition, {
    type: 'dungeon_entrance',
    targetMapId: 'dungeon_01',
    targetSpawn: 'dungeon_01_start',
    displayName: 'Dungeon Entrance',
    recommendedLevel: 20,
    requiredLevel: 20,
    showOnMap: true,
    interiorId: BRIGHTWATER_CAVE_ID,
    caveId: BRIGHTWATER_CAVE_ID,
  });

  props.objects = (props.objects ?? []).filter((object) => object.name !== 'prop_dungeon_01_entrance');
  setProps(caveProps, {
    type: 'caveProps',
    interiorId: BRIGHTWATER_CAVE_ID,
    caveId: BRIGHTWATER_CAVE_ID,
  });
  const prop = upsertObject(caveProps, 'prop_dungeon_01_entrance', () => ({
    id: nextObjectId(map),
    name: 'prop_dungeon_01_entrance',
    type: '',
    gid: entranceFirstgid,
    x: transitionCenter.x - DUNGEON_ENTRANCE_DRAW_WIDTH / 2,
    y: transitionCenter.y + DUNGEON_ENTRANCE_DRAW_HEIGHT * 0.34,
    width: DUNGEON_ENTRANCE_DRAW_WIDTH,
    height: DUNGEON_ENTRANCE_DRAW_HEIGHT,
    rotation: 0,
    visible: true,
    properties: [],
  }));
  prop.gid = entranceFirstgid;
  prop.x = transitionCenter.x - DUNGEON_ENTRANCE_DRAW_WIDTH / 2;
  prop.y = transitionCenter.y + DUNGEON_ENTRANCE_DRAW_HEIGHT * 0.34;
  prop.width = DUNGEON_ENTRANCE_DRAW_WIDTH;
  prop.height = DUNGEON_ENTRANCE_DRAW_HEIGHT;
  prop.visible = true;
  setProps(prop, {
    type: 'dungeon_entrance_prop',
    displayName: 'Dungeon Entrance',
    transitionId: DUNGEON_ENTRANCE_NAME,
    interiorId: BRIGHTWATER_CAVE_ID,
    caveId: BRIGHTWATER_CAVE_ID,
  });

  const landmark = upsertObject(landmarks, 'marker_dungeon_01_entrance', () => ({
    id: nextObjectId(map),
    name: 'marker_dungeon_01_entrance',
    type: '',
    point: true,
    x: transitionCenter.x,
    y: transitionCenter.y,
    width: 0,
    height: 0,
    rotation: 0,
    visible: true,
    properties: [],
  }));
  landmark.point = true;
  landmark.x = transitionCenter.x;
  landmark.y = transitionCenter.y;
  landmark.width = 0;
  landmark.height = 0;
  setProps(landmark, {
    type: 'landmark',
    landmarkId: 'dungeon_01_entrance',
    landmarkKind: 'dungeon_entrance',
    displayName: 'Dungeon Entrance',
    showOnMap: true,
    debugOnly: false,
    interiorId: BRIGHTWATER_CAVE_ID,
    caveId: BRIGHTWATER_CAVE_ID,
  });

  setProps(caveSpawns, {
    type: 'caveSpawns',
    interiorId: BRIGHTWATER_CAVE_ID,
    caveId: BRIGHTWATER_CAVE_ID,
  });

  const spawnConfigs = [
    {
      from: 'cave_monsters_01',
      to: 'cave_stalker_den',
      enemyType: 'cave-stalker',
      questTitle: 'Eyes in the Dark',
      questDialogue: 'The cave mouth is awake. Start with the stalkers near the first bend and keep them off the ford road.',
      questDescription: 'Cave Stalkers are gathering near the Brightwater cave entrance.',
      questObjectiveText: 'Defeat 6 Cave Stalkers',
      questRequired: 6,
      recommendedLevel: 16,
      maxAlive: 6,
      respawnMin: 18000,
      respawnMax: 30000,
      movement: 'patrol',
    },
    {
      from: 'cave_monsters_02',
      to: 'deep_burrower_run',
      enemyType: 'deep-burrower',
      questTitle: 'Burrowers Below Brightwater',
      questDialogue: 'Good. The next tunnels are being hollowed out from below. Break the burrowers before the road sinks.',
      questDescription: 'Deep Burrowers are undermining the cave branches east of Brightwater Ford.',
      questObjectiveText: 'Defeat 5 Deep Burrowers',
      questRequired: 5,
      recommendedLevel: 17,
      maxAlive: 5,
      respawnMin: 20000,
      respawnMax: 34000,
      movement: 'roam-pause',
    },
    {
      from: 'cave_monsters_03',
      to: 'magma_crawler_nest',
      enemyType: 'magma-crawler',
      questTitle: 'Heat Under the Hill',
      questDialogue: 'The miners swear the stone is warming. If the crawlers are nesting in there, clear them before they spread.',
      questDescription: 'Magma Crawlers have opened a hot nest in the northern cave branch.',
      questObjectiveText: 'Defeat 4 Magma Crawlers',
      questRequired: 4,
      recommendedLevel: 18,
      maxAlive: 4,
      respawnMin: 24000,
      respawnMax: 38000,
      movement: 'patrol',
    },
    {
      from: 'cave_boss_01',
      to: 'gloomfang_matriarch_lair',
      bossType: 'gloomfang-matriarch',
      questTitle: 'Matriarch in the Split Cave',
      questDialogue: 'That leaves the thing drawing them together. Find the matriarch in the split cave and end it clean.',
      questDescription: 'Gloomfang Matriarch commands the cave packs from the deepest branch.',
      questObjectiveText: 'Defeat the Gloomfang Matriarch',
      questRequired: 1,
      recommendedLevel: 19,
      maxAlive: 1,
      respawnMin: 90000,
      respawnMax: 120000,
      movement: 'sentinel',
    },
  ];

  for (const config of spawnConfigs) {
    const object = caveSpawns.objects.find((candidate) => candidate.name === config.from || candidate.name === config.to);
    if (!object) continue;
    object.name = config.to;
    object.type = config.bossType ? 'boss_spawn' : 'mob_pack';
    setProps(object, {
      type: config.bossType ? 'boss_spawn' : 'mob_pack',
      spawnId: config.to,
      questGiverId: BRIGHTWATER_QUEST_GIVER_ID,
      questTitle: config.questTitle,
      questDialogue: config.questDialogue,
      questDescription: config.questDescription,
      questObjectiveText: config.questObjectiveText,
      questRequired: config.questRequired,
      minLevel: config.recommendedLevel,
      recommendedLevel: config.recommendedLevel,
      maxAlive: config.maxAlive,
      respawnMin: config.respawnMin,
      respawnMax: config.respawnMax,
      movement: config.movement,
      interiorId: BRIGHTWATER_CAVE_ID,
      caveId: BRIGHTWATER_CAVE_ID,
      ...(config.enemyType ? { enemyType: config.enemyType } : {}),
      ...(config.bossType ? { bossType: config.bossType } : {}),
    });
  }

  fs.writeFileSync(REGION_PATH, `${JSON.stringify(map, null, 2)}\n`);
  return { regionMap: map, entranceFirstgid, transitionCenter };
}

function patchDungeonExit() {
  const map = JSON.parse(fs.readFileSync(DUNGEON_MAP_PATH, 'utf8'));
  const transition = map.layers
    .find((layer) => layer.name === 'Transitions')
    ?.objects
    ?.find((object) => object.name === 'dungeon_01_exit');
  if (!transition) throw new Error('Missing dungeon_01_exit in dungeon_01.tmj.');
  setProps(transition, {
    type: 'dungeon_exit',
    targetMapId: REGION_ID,
    targetSpawn: DUNGEON_ENTRANCE_NAME,
  });
  fs.writeFileSync(DUNGEON_MAP_PATH, `${JSON.stringify(map, null, 2)}\n`);
}

function globalTileFromRegionPoint(point) {
  return {
    x: Math.round((REGION_PIXEL_OFFSET.x + point.x) / TILE),
    y: Math.round((REGION_PIXEL_OFFSET.y + point.y) / TILE),
  };
}

function patchRegistryAndManifest(transitionCenter) {
  const markerTile = globalTileFromRegionPoint(transitionCenter);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const landmarks = registry.landmarks ?? [];
  const existing = landmarks.find((landmark) => landmark.id === 'dungeon_01_entrance');
  const marker = existing ?? { id: 'dungeon_01_entrance' };
  Object.assign(marker, {
    displayName: 'Dungeon Entrance',
    kind: 'dungeon_entrance',
    x: markerTile.x,
    y: markerTile.y,
    radius: 70,
    biome: 'silver_river',
    showOnMap: true,
    transitionTarget: 'dungeon_01',
    requiredLevel: 20,
    interiorId: BRIGHTWATER_CAVE_ID,
    caveId: BRIGHTWATER_CAVE_ID,
    macroPass: 'v4',
  });
  if (!existing) landmarks.push(marker);
  registry.landmarks = landmarks;
  fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  manifest.runtime = {
    ...(manifest.runtime ?? {}),
    chunkAssetVersion: CHUNK_RUNTIME_VERSION,
  };
  const defaultSpawnPoints = manifest.defaultSpawnPoints ?? [];
  const spawn = defaultSpawnPoints.find((entry) => entry.id === DUNGEON_ENTRANCE_NAME) ?? { id: DUNGEON_ENTRANCE_NAME };
  Object.assign(spawn, {
    mapId: REGION_ID,
    x: REGION_PIXEL_OFFSET.x + transitionCenter.x,
    y: REGION_PIXEL_OFFSET.y + transitionCenter.y,
    targetMapId: 'dungeon_01',
    targetSpawn: 'dungeon_01_start',
    interiorId: BRIGHTWATER_CAVE_ID,
    caveId: BRIGHTWATER_CAVE_ID,
  });
  if (!defaultSpawnPoints.includes(spawn)) defaultSpawnPoints.push(spawn);
  manifest.defaultSpawnPoints = defaultSpawnPoints;
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

function objectBounds(object) {
  const x = Number(object?.x ?? 0);
  const y = Number(object?.y ?? 0);
  const width = Math.max(1, Number(object?.width ?? 0) || 1);
  const height = Math.max(1, Number(object?.height ?? 0) || 1);
  if (Array.isArray(object?.polygon) && object.polygon.length >= 3) {
    const points = object.polygon.map((point) => ({ x: x + point.x, y: y + point.y }));
    return {
      x: Math.min(...points.map((point) => point.x)),
      y: Math.min(...points.map((point) => point.y)),
      width: Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x)),
      height: Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y)),
    };
  }
  const isTileObject = Number(object?.gid ?? 0) > 0;
  return {
    x,
    y: isTileObject ? y - height : y,
    width,
    height,
  };
}

function intersects(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function cloneForChunk(object, chunkInfo, entranceFirstgid, chunkEntranceFirstgid) {
  const chunkOffset = {
    x: Number(chunkInfo.x ?? chunkInfo.tileX ?? 0) * TILE,
    y: Number(chunkInfo.y ?? chunkInfo.tileY ?? 0) * TILE,
  };
  const cloned = {
    ...object,
    x: Number(object.x ?? 0) + REGION_PIXEL_OFFSET.x - chunkOffset.x,
    y: Number(object.y ?? 0) + REGION_PIXEL_OFFSET.y - chunkOffset.y,
    sourceMapId: REGION_ID,
  };
  const gid = Number(cloned.gid ?? 0);
  if (gid >= entranceFirstgid && gid < entranceFirstgid + DUNGEON_ENTRANCE_TILECOUNT) {
    cloned.gid = chunkEntranceFirstgid + (gid - entranceFirstgid);
  }
  return cloned;
}

function getObjectsForChunk(layer, chunkInfo, entranceFirstgid, chunkEntranceFirstgid) {
  const chunkBounds = {
    x: Number(chunkInfo.x ?? chunkInfo.tileX ?? 0) * TILE,
    y: Number(chunkInfo.y ?? chunkInfo.tileY ?? 0) * TILE,
    width: Number(chunkInfo.width ?? 128) * TILE,
    height: Number(chunkInfo.height ?? 128) * TILE,
  };
  return (layer?.objects ?? [])
    .filter((object) => (
      !['Props', 'CaveProps'].includes(layer.name)
      || object.name === 'prop_dungeon_01_entrance'
    ))
    .filter((object) => {
      const bounds = objectBounds(object);
      return intersects({
        x: bounds.x + REGION_PIXEL_OFFSET.x,
        y: bounds.y + REGION_PIXEL_OFFSET.y,
        width: bounds.width,
        height: bounds.height,
      }, chunkBounds);
    })
    .map((object) => cloneForChunk(object, chunkInfo, entranceFirstgid, chunkEntranceFirstgid));
}

function managedObjectName(layerName, object) {
  const name = String(object?.name ?? '');
  if (layerName === 'Props') return name === 'prop_dungeon_01_entrance';
  if (layerName === 'CaveProps') return name === 'prop_dungeon_01_entrance';
  if (layerName === 'Transitions') return name === 'dungeon_01' || name === DUNGEON_ENTRANCE_NAME;
  if (layerName === 'Landmarks') return name === 'marker_dungeon_01_entrance';
  if (layerName === 'CaveSpawns') {
    return [
      'cave_monsters_01',
      'cave_monsters_02',
      'cave_monsters_03',
      'cave_boss_01',
      'cave_stalker_den',
      'deep_burrower_run',
      'magma_crawler_nest',
      'gloomfang_matriarch_lair',
    ].includes(name);
  }
  return false;
}

function getNextLayerId(map) {
  return Math.max(0, Number(map.nextlayerid ?? 0), ...map.layers.map((layer) => Number(layer.id ?? 0))) + 1;
}

function insertObjectLayer(chunkMap, layerName) {
  const layer = {
    id: getNextLayerId(chunkMap),
    name: layerName,
    type: 'objectgroup',
    visible: true,
    opacity: 1,
    objects: [],
  };
  chunkMap.nextlayerid = layer.id + 1;
  const afterName = layerName === 'CaveSpawns' ? 'Caves' : layerName === 'Props' ? 'Buildings' : 'InteriorZones';
  const index = chunkMap.layers.findIndex((candidate) => candidate.name === afterName);
  if (index >= 0) chunkMap.layers.splice(index + 1, 0, layer);
  else chunkMap.layers.push(layer);
  return layer;
}

function upsertChunkObjectLayer(chunkMap, sourceLayer, objects) {
  const layerName = sourceLayer.name;
  let layer = chunkMap.layers.find((candidate) => candidate.name === layerName && candidate.type === 'objectgroup');
  if (!layer && objects.length === 0) return false;
  if (!layer) layer = insertObjectLayer(chunkMap, layerName);
  const before = JSON.stringify(layer.objects ?? []);
  layer.visible = sourceLayer.visible !== false;
  layer.opacity = sourceLayer.opacity ?? 1;
  layer.properties = sourceLayer.properties ?? layer.properties;
  layer.objects = [
    ...(layer.objects ?? []).filter((object) => !managedObjectName(layerName, object)),
    ...objects,
  ];
  return JSON.stringify(layer.objects ?? []) !== before;
}

function ensureChunkEntranceTileset(index) {
  const existing = (index.tilesets ?? []).find((tileset) => (
    tileset.source === DUNGEON_ENTRANCE_CHUNK_SOURCE
    || String(tileset.source ?? '').endsWith(DUNGEON_ENTRANCE_TSX_NAME)
  ));
  if (existing) {
    existing.source = DUNGEON_ENTRANCE_CHUNK_SOURCE;
    return Number(existing.firstgid);
  }
  const firstgid = getNextFirstGid(index.tilesets ?? [], CHUNK_DIR);
  index.tilesets = [...(index.tilesets ?? []), { firstgid, source: DUNGEON_ENTRANCE_CHUNK_SOURCE }];
  return firstgid;
}

function patchRuntimeChunks(regionMap, entranceFirstgid) {
  if (!fs.existsSync(CHUNK_INDEX_PATH)) return;
  const index = JSON.parse(fs.readFileSync(CHUNK_INDEX_PATH, 'utf8'));
  index.version = CHUNK_RUNTIME_VERSION;
  const chunkEntranceFirstgid = ensureChunkEntranceTileset(index);
  index.objectLayers = Array.from(new Set([...(index.objectLayers ?? []), 'CaveProps', 'CaveSpawns']));

  const sourceLayers = ['Props', 'CaveProps', 'Transitions', 'Landmarks', 'CaveSpawns']
    .map((name) => regionMap.layers.find((layer) => layer.name === name))
    .filter(Boolean);

  let patchedChunks = 0;
  for (const chunkInfo of index.chunks ?? []) {
    const chunkPath = path.join(CHUNK_DIR, chunkInfo.file);
    if (!fs.existsSync(chunkPath)) continue;
    const chunkMap = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
    let changed = chunkMap.version !== CHUNK_RUNTIME_VERSION;
    chunkMap.version = CHUNK_RUNTIME_VERSION;
    for (const sourceLayer of sourceLayers) {
      const objects = getObjectsForChunk(sourceLayer, chunkInfo, entranceFirstgid, chunkEntranceFirstgid);
      if (upsertChunkObjectLayer(chunkMap, sourceLayer, objects)) changed = true;
    }
    if (changed) {
      fs.writeFileSync(chunkPath, JSON.stringify(chunkMap));
      patchedChunks += 1;
    }
  }

  fs.writeFileSync(CHUNK_INDEX_PATH, JSON.stringify(index));
  console.log(`Patched ${patchedChunks} runtime chunks with Brightwater dungeon content firstgid ${chunkEntranceFirstgid}`);
}

generateDungeonEntranceTileset();
generateCaveMonsterSprites();
const patchedRegion = patchRegionMap();
patchDungeonExit();
patchRegistryAndManifest(patchedRegion.transitionCenter);
patchRuntimeChunks(patchedRegion.regionMap, patchedRegion.entranceFirstgid);
console.log('Applied Brightwater dungeon entrance, cave spawn quests, and cave monster sprites.');
