import { clamp, isFinitePoint, safeNumber } from './math';
import {
  WORLD,
  MAP_FILES,
  WORLD_V3_HUB_MAP_ID,
  WORLD_V3_HUB_ARRIVAL,
  WORLD_V3_QUEST_GIVER_ID,
  WORLD_V3_HUB_TURN_IN_MARKER,
  WORLD_MAP_VERSION,
  WORLD_QUEST_GIVER_ID,
  WORLD_QUEST_TURN_IN_MARKER,
  DUNGEON_ENTRANCE_MARKER,
  DUNGEON_EXIT_MARKER,
  WORLD_LIKE_MAP_IDS,
  normalizeMapId,
  isWorldLikeMap,
  isWorldV2Map,
  getGameplayMapSpaceId,
  getWorldGenerationConfig,
  isStartingMapId,
  getWorldV2MapIdFromPoint,
  getWorldV2RegionOffset,
  getRaceStartMapId,
} from './world';
import {
  PLAYER,
  ENEMY,
  SAVE_KEY,
  FRIENDS_KEY,
  BOSS_XP,
  AUCTION_LISTINGS_KEY,
  PROFESSIONS,
  SHOPKEEPER,
  RACES,
  CLASSES,
  FRESH_RACE_HERITAGE_STYLE_CHOICES,
  FRESH_RACE_DEFAULT_HERITAGE,
  CLASS_NAME_POOLS,
  ENEMY_SPRITE_CONFIG,
} from './gameData';
import {
  distance,
  distanceToSegment,
  angleDifference,
  getInitialStats,
  isPotionItem,
  normalizeInventoryItem,
  normalizeInventory,
  getScaledQuestXpReward,
  normalizeQuestState,
} from './characterLogic';
import {
  canEnemyMoveTo,
  getTiledWorldPixelHeight,
  getTiledWorldPixelWidth,
  moveEnemyWithCollision,
} from './collision';
import { getQuestGiverProfile, normalizeEnemyKind, loadWorldV2Registry, hasTileData } from './mapAssets';

function normalizeCharacter(character) {
  const classId = character.classId ?? 'warrior';
  const raceId = character.raceId ?? 'human';
  const inventory = normalizeInventory(character.inventory);
  const selectedPotionId = inventory.some((item) => item.id === character.selectedPotionId && isPotionItem(item))
    ? character.selectedPotionId
    : inventory.find((item) => isPotionItem(item))?.id ?? null;
  const bank = (character.bank ?? []).map((item) => normalizeInventoryItem(item));
  const professionEntries = Object.fromEntries(PROFESSIONS.map((profession) => [
    profession.id,
    {
      id: profession.id,
      learned: false,
      level: 1,
      xp: 0,
      ...(character.professions?.[profession.id] ?? {}),
    },
  ]));
  return {
    level: 1,
    xp: 0,
    inventory: [],
    bank: [],
    gold: 0,
    stats: getInitialStats(classId),
    talents: { spec: null },
    selectedPotionId,
    professions: professionEntries,
    appearance: {},
    ...character,
    inventory,
    bank,
    selectedPotionId,
    professions: professionEntries,
    talents: { spec: null, ranks: {}, ...(character.talents ?? {}) },
    quests: normalizeQuestState(character.quests),
    appearance: getMergedDefaultAppearance(raceId, classId, character.appearance ?? {}),
  };
}

function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase();
}

function isNameTaken(name, characters, excludedId = null) {
  const normalized = normalizeName(name);
  if (!normalized) return false;
  return characters.some((character) => character.id !== excludedId && normalizeName(character.name) === normalized);
}

function randomClassName(classId, usedNames) {
  const names = CLASS_NAME_POOLS[classId] ?? CLASS_NAME_POOLS.warrior;
  const shuffled = [...names].sort(() => Math.random() - 0.5);
  const pickedName = shuffled.find((candidate) => !usedNames.has(normalizeName(candidate)));
  if (pickedName) return pickedName;

  let index = 2;
  let fallback = `${names[0]} ${index}`;
  while (usedNames.has(normalizeName(fallback))) {
    index += 1;
    fallback = `${names[0]} ${index}`;
  }
  return fallback;
}

function ensureUniqueCharacterNames(characters) {
  const usedNames = new Set();
  let changed = false;
  const nextCharacters = characters.map((character) => {
    const normalized = normalizeName(character.name);
    if (normalized && !usedNames.has(normalized)) {
      usedNames.add(normalized);
      return character;
    }

    const newName = randomClassName(character.classId, usedNames);
    usedNames.add(normalizeName(newName));
    changed = true;
    return {
      ...character,
      name: newName,
      updatedAt: new Date().toISOString(),
    };
  });

  return { characters: nextCharacters, changed };
}

function loadCharacters() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    const unique = ensureUniqueCharacterNames(saved.map(normalizeCharacter));
    if (unique.changed) saveCharacters(unique.characters);
    return unique.characters;
  } catch {
    return [];
  }
}

function backupLocalCharactersBeforeShrink(nextCharacters) {
  try {
    const currentCharacters = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
    if (!Array.isArray(currentCharacters) || currentCharacters.length <= nextCharacters.length) return;
    localStorage.setItem(`${SAVE_KEY}.backup`, JSON.stringify(currentCharacters));
  } catch {
    // Local backup is best-effort only.
  }
}

function saveCharacters(characters) {
  const normalizedCharacters = characters.map(normalizeCharacter);
  try {
    const currentCharacters = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
    if (Array.isArray(currentCharacters) && currentCharacters.length > 0 && normalizedCharacters.length === 0) {
      console.warn('Skipped empty character save over existing local characters');
      return;
    }
  } catch {
    // If local storage is unreadable, continue with the requested save.
  }
  backupLocalCharactersBeforeShrink(normalizedCharacters);
  localStorage.setItem(SAVE_KEY, JSON.stringify(normalizedCharacters));
  if (typeof window !== 'undefined' && window.mmoLauncher?.saveCharacters) {
    window.mmoLauncher.saveCharacters(normalizedCharacters).catch((error) => {
      console.warn('Character disk save failed', error);
    });
  }
}

function loadAuctionListings() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUCTION_LISTINGS_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved
      .map((listing) => ({
        ...listing,
        price: Math.max(1, Math.floor(safeNumber(listing?.price, 1))),
        item: normalizeInventoryItem(listing?.item ?? {}),
      }))
      .filter((listing) => listing.id && listing.item?.id);
  } catch {
    return [];
  }
}

function saveAuctionListings(listings) {
  try {
    localStorage.setItem(AUCTION_LISTINGS_KEY, JSON.stringify(Array.isArray(listings) ? listings : []));
  } catch {
    // Auction house storage is local fallback state only.
  }
}

async function loadPersistedCharacters() {
  const localCharacters = loadCharacters();
  if (typeof window === 'undefined' || !window.mmoLauncher?.loadCharacters) return localCharacters;

  try {
    const diskCharacters = await window.mmoLauncher.loadCharacters();
    return mergeCharacterLists(localCharacters, Array.isArray(diskCharacters) ? diskCharacters : []);
  } catch (error) {
    console.warn('Character disk load failed', error);
    return localCharacters;
  }
}

function characterSaveTime(character) {
  const candidates = [character?.updatedAt, character?.cloudUpdatedAt, character?.createdAt];
  let newest = 0;
  for (const value of candidates) {
    if (!value) continue;
    let parsed = 0;
    if (typeof value?.toMillis === 'function') parsed = value.toMillis();
    else if (Number.isFinite(value?.seconds)) parsed = value.seconds * 1000;
    else if (Number.isFinite(Number(value))) parsed = Number(value);
    if (typeof value === 'string') {
      parsed = Date.parse(value);
    }
    if (Number.isFinite(parsed)) newest = Math.max(newest, parsed);
  }
  return newest;
}

function mergeCharacterLists(...characterLists) {
  const merged = new globalThis.Map();
  characterLists.flat().filter(Boolean).map(normalizeCharacter).forEach((character) => {
    const id = character.id ?? `${normalizeName(character.name)}:${character.classId}:${character.raceId}`;
    const current = merged.get(id);
    if (!current || characterSaveTime(character) >= characterSaveTime(current)) {
      merged.set(id, character);
    }
  });
  return [...merged.values()];
}

function loadFriends() {
  try {
    const saved = JSON.parse(localStorage.getItem(FRIENDS_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveFriends(friends) {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}

function randomPointInObject(object, fallbackPosition) {
  if (!object) return fallbackPosition;

  return {
    x: object.x + Math.random() * Math.max(object.width ?? 0, 1),
    y: object.y + Math.random() * Math.max(object.height ?? 0, 1),
  };
}

function getSpawnBounds(object, fallbackPosition, fallbackSize = 420) {
  if (!object) {
    return {
      x: fallbackPosition.x - fallbackSize / 2,
      y: fallbackPosition.y - fallbackSize / 2,
      width: fallbackSize,
      height: fallbackSize,
    };
  }

  const bounds = getObjectBounds(object);
  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(bounds.width, 1),
    height: Math.max(bounds.height, 1),
  };
}

function randomPointInBounds(bounds) {
  return {
    x: bounds.x + Math.random() * bounds.width,
    y: bounds.y + Math.random() * bounds.height,
  };
}

function numberProp(object, name, fallback) {
  const value = Number(object?.props?.[name]);
  return Number.isFinite(value) ? value : fallback;
}

const DEFAULT_ENEMY_MOVEMENT_SPEED_MULTIPLIER = 1.1;
const MAX_ENEMY_MOVEMENT_SPEED = 1200;

// Tiled enemy-spawn movementSpeed is expressed in world pixels per second.
function getSpawnMovementSpeed(spawnObject, fallbackSpeed = ENEMY.speed) {
  const rawValue = spawnObject?.props?.movementSpeed
    ?? spawnObject?.props?.moveSpeed
    ?? spawnObject?.props?.movement_speed
    ?? spawnObject?.props?.speed;
  const configuredSpeed = Number(rawValue);
  if (Number.isFinite(configuredSpeed)) return clamp(configuredSpeed, 0, MAX_ENEMY_MOVEMENT_SPEED);
  return clamp(
    safeNumber(fallbackSpeed, ENEMY.speed) * DEFAULT_ENEMY_MOVEMENT_SPEED_MULTIPLIER,
    0,
    MAX_ENEMY_MOVEMENT_SPEED,
  );
}

function getSpawnPackId(spawnObject, fallbackId = 'fallback_spawn') {
  const mapId = normalizeMapId(spawnObject?.mapId ?? 'world');
  const baseId = String(spawnObject?.props?.spawnId ?? spawnObject?.name ?? spawnObject?.id ?? fallbackId);
  return `${mapId}:${baseId}`;
}

function getSpawnEnemyType(spawnObject) {
  const spawnName = String(spawnObject?.name ?? '').toLowerCase();
  return normalizeEnemyKind(spawnObject?.props?.enemyType ?? (spawnName.includes('desert') ? 'scarab' : 'wolf'));
}

function getSpawnRecommendedLevel(spawnObject) {
  return Math.max(0, Math.floor(numberProp(spawnObject, 'recommendedLevel', 0)));
}

function getSpawnArea(spawnObject) {
  const bounds = getObjectBounds(spawnObject);
  return Math.max(0, bounds.width) * Math.max(0, bounds.height);
}

function isAdvancedWorldSpawn(spawnObject) {
  const mapId = normalizeMapId(spawnObject?.mapId ?? spawnObject?.props?.mapId ?? 'world');
  return isWorldV2Map(mapId) && getSpawnRecommendedLevel(spawnObject) >= 10;
}

function isInteriorSpawn(spawnObject) {
  return Boolean(normalizeInteriorId(spawnObject?.props?.interiorId ?? spawnObject?.props?.caveId));
}

function getSpawnMaxAlive(spawnObject) {
  const configured = Math.max(1, Math.floor(numberProp(spawnObject, 'maxAlive', numberProp(spawnObject, 'maxEnemies', ENEMY.maxCount))));
  return configured;
}

function getSpawnRespawnMin(spawnObject) {
  const configured = Math.max(1000, numberProp(spawnObject, 'respawnMin', numberProp(spawnObject, 'respawnTime', ENEMY.spawnEvery)));
  if (isInteriorSpawn(spawnObject)) return Math.max(12000, configured);
  return isAdvancedWorldSpawn(spawnObject) ? Math.max(7000, Math.floor(configured * 1.35)) : configured;
}

function getSpawnRespawnMax(spawnObject) {
  const min = getSpawnRespawnMin(spawnObject);
  const configured = Math.max(min, numberProp(spawnObject, 'respawnMax', min));
  if (isInteriorSpawn(spawnObject)) return Math.max(min + 3000, configured);
  return isAdvancedWorldSpawn(spawnObject) ? Math.max(min + 3000, Math.floor(configured * 1.35)) : configured;
}

function getSpawnRespawnDelay(spawnObject) {
  const min = getSpawnRespawnMin(spawnObject);
  const max = getSpawnRespawnMax(spawnObject);
  return min + Math.random() * (max - min);
}

const ENEMY_KIND_STATS = {
  wolf: { name: 'Wolf', hp: 220, radius: 17, speed: 150, xp: 45, damage: 14, attackCooldown: 820 },
  kobold: { name: 'Kobold', hp: 250, radius: 17, speed: 145, xp: 50, damage: 16, attackCooldown: 820 },
  bandit: { name: 'Bandit', hp: 280, radius: 18, speed: 155, xp: 55, damage: 18, attackCooldown: 800 },
  undead: { name: 'Undead', hp: 300, radius: 18, speed: 135, xp: 58, damage: 19, attackCooldown: 880 },
  'restless-dead': { name: 'Restless Dead', hp: 300, radius: 18, speed: 135, xp: 58, damage: 19, attackCooldown: 880 },
  'snow-wolf': { name: 'Snow Wolf', hp: 240, radius: 17, speed: 160, xp: 48, damage: 15, attackCooldown: 800 },
  'frost-trogg': { name: 'Frost Trogg', hp: 330, radius: 19, speed: 138, xp: 62, damage: 22, attackCooldown: 900 },
  'cave-spider': { name: 'Cave Spider', hp: 260, radius: 17, speed: 170, xp: 54, damage: 18, attackCooldown: 780 },
  'grave-rat': { name: 'Grave Rat', hp: 170, radius: 15, speed: 185, xp: 42, damage: 13, attackCooldown: 720 },
  plaguehound: { name: 'Plaguehound', hp: 280, radius: 18, speed: 165, xp: 56, damage: 18, attackCooldown: 790 },
  'forest-sprite': { name: 'Forest Sprite', hp: 230, radius: 15, speed: 175, xp: 48, damage: 16, attackCooldown: 760 },
  'corrupted-treant': { name: 'Corrupted Treant', hp: 460, radius: 21, speed: 118, xp: 78, damage: 27, attackCooldown: 960 },
  nightstalker: { name: 'Nightstalker', hp: 290, radius: 17, speed: 185, xp: 62, damage: 21, attackCooldown: 750 },
  plainstrider: { name: 'Plainstrider', hp: 260, radius: 18, speed: 190, xp: 50, damage: 16, attackCooldown: 760 },
  scorpion: { name: 'Scorpion', hp: 285, radius: 17, speed: 135, xp: 56, damage: 19, attackCooldown: 850 },
  quilboar: { name: 'Quilboar', hp: 360, radius: 20, speed: 130, xp: 70, damage: 23, attackCooldown: 900 },
  scarab: { name: 'Scarab', hp: 240, radius: 16, speed: 145, xp: 48, damage: 16, attackCooldown: 840 },
  'road-bandit': { name: 'Road Bandit', hp: 520, radius: 18, speed: 170, xp: 110, damage: 30, attackCooldown: 790 },
  'dire-wolf': { name: 'Dire Wolf', hp: 680, radius: 19, speed: 205, xp: 140, damage: 34, attackCooldown: 740 },
  'stone-gnoll': { name: 'Stone Gnoll', hp: 920, radius: 21, speed: 150, xp: 180, damage: 42, attackCooldown: 900 },
  'ember-wraith': { name: 'Ember Wraith', hp: 1050, radius: 20, speed: 165, xp: 210, damage: 48, attackCooldown: 850 },
  'cave-stalker': { name: 'Cave Stalker', hp: 1450, radius: 21, speed: 150, xp: 255, damage: 52, attackCooldown: 820 },
  'magma-crawler': { name: 'Magma Crawler', hp: 1600, radius: 22, speed: 130, xp: 285, damage: 58, attackCooldown: 930 },
  'deep-burrower': { name: 'Deep Burrower', hp: 1520, radius: 22, speed: 145, xp: 275, damage: 54, attackCooldown: 880 },
  'obsidian-sentinel': { name: 'Obsidian Sentinel', hp: 1900, radius: 25, speed: 105, xp: 330, damage: 64, attackCooldown: 980 },
  'reedwater-marauder': { name: 'Reedwater Marauder', hp: 720, radius: 19, speed: 178, xp: 110, damage: 34, attackCooldown: 800 },
  'bramblehide-bear': { name: 'Bramblehide Bear', hp: 1150, radius: 24, speed: 145, xp: 145, damage: 44, attackCooldown: 960 },
  'moonbrook-prowler': { name: 'Moonbrook Prowler', hp: 780, radius: 19, speed: 210, xp: 120, damage: 36, attackCooldown: 760 },
  'redscar-highwayman': { name: 'Redscar Highwayman', hp: 900, radius: 19, speed: 185, xp: 135, damage: 40, attackCooldown: 780 },
  'saltspine-crawler': { name: 'Saltspine Crawler', hp: 820, radius: 18, speed: 160, xp: 120, damage: 35, attackCooldown: 820 },
};

const BOSS_KIND_STATS = {
  'elder-briarheart': { name: 'Elder Briarheart', hp: 1200, radius: 36, speed: 76, xp: BOSS_XP + 80, damage: 34, attackCooldown: 1050 },
  'granite-matriarch': { name: 'Granite Matriarch', hp: 1450, radius: 40, speed: 66, xp: BOSS_XP + 110, damage: 38, attackCooldown: 1120 },
  'crypt-warden': { name: 'Crypt Warden', hp: 1380, radius: 38, speed: 70, xp: BOSS_XP + 110, damage: 38, attackCooldown: 1080 },
  'moonshade-stag': { name: 'Moonshade Stag', hp: 1300, radius: 36, speed: 92, xp: BOSS_XP + 110, damage: 36, attackCooldown: 980 },
  'bloodtusk-chief': { name: 'Bloodtusk Chief', hp: 1450, radius: 40, speed: 78, xp: BOSS_XP + 110, damage: 40, attackCooldown: 1060 },
  'varro-the-tollkeeper': { name: 'Varro the Tollkeeper', hp: 2600, radius: 34, speed: 95, xp: 360, damage: 48, attackCooldown: 980 },
  'thornmaw-alpha': { name: 'Thornmaw Alpha', hp: 3400, radius: 35, speed: 105, xp: 440, damage: 54, attackCooldown: 940 },
  'granite-ogre': { name: 'Granite Ogre', hp: 4600, radius: 39, speed: 78, xp: 540, damage: 62, attackCooldown: 1120 },
  'ash-witch': { name: 'Ash Witch', hp: 5200, radius: 34, speed: 96, xp: 620, damage: 66, attackCooldown: 980 },
  'redscar-captain': { name: 'Redscar Captain Varn', hp: 3600, radius: 34, speed: 118, xp: 440, damage: 54, attackCooldown: 900 },
  'gloomfang-matriarch': { name: 'Gloomfang Matriarch', hp: 9800, radius: 48, speed: 92, xp: 1050, damage: 68, attackCooldown: 920 },
  'lava-forged-warden': { name: 'Lava-Forged Warden', hp: 11200, radius: 52, speed: 72, xp: 1140, damage: 76, attackCooldown: 1040 },
  'crystal-horror': { name: 'Crystal Horror', hp: 10600, radius: 50, speed: 82, xp: 1100, damage: 72, attackCooldown: 980 },
  'rift-heart': { name: 'Rift Heart', hp: 24000, radius: 60, speed: 64, xp: 2200, damage: 92, attackCooldown: 1080 },
  'old-quarry-giant': { name: 'Old Quarry Giant', hp: 14000, radius: 48, speed: 70, xp: 550, damage: 72, attackCooldown: 960 },
  'tideglass-matriarch': { name: 'Tideglass Matriarch', hp: 13200, radius: 46, speed: 86, xp: 550, damage: 74, attackCooldown: 900 },
};

function getEnemyKindStats(kind) {
  return ENEMY_KIND_STATS[normalizeEnemyKind(kind)] ?? ENEMY_KIND_STATS.wolf;
}

function getBossKindStats(kind) {
  return BOSS_KIND_STATS[normalizeEnemyKind(kind)] ?? BOSS_KIND_STATS['elder-briarheart'];
}

function humanizeId(value) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getEnemyKindName(enemyKind) {
  const normalized = normalizeEnemyKind(enemyKind);
  return ENEMY_KIND_STATS[normalized]?.name ?? BOSS_KIND_STATS[normalized]?.name ?? humanizeId(normalized);
}

function getQuestGiverForMap(tiledWorld, giverId = null) {
  const givers = tiledWorld?.questGivers ?? [];
  if (!giverId) return givers[0] ?? null;
  return givers.find((giver) => String(giver.id) === String(giverId)) ?? givers[0] ?? null;
}

function getQuestGiverNear(tiledWorld, point) {
  if (!point) return null;
  return (tiledWorld?.questGivers ?? [])
    .filter((giver) => distance(point, giver) <= safeNumber(giver.interactRange, 92))
    .sort((a, b) => distance(point, a) - distance(point, b))[0] ?? null;
}

const ACTIVE_WORLD_TRANSITION_KEYS = [
  'world',
  'world_map',
  'old_world',
  'old_world_map',
  'main_world',
  'new_world',
  'new_world_v3',
  'world_v2',
  'world_v3',
  'world_continent_v2',
  'world_continent_v3',
  'world_continent_v4',
  'continent_01',
];

function isActiveWorldTransitionKey(value) {
  return ACTIVE_WORLD_TRANSITION_KEYS.includes(normalizeTransitionTargetKey(value));
}

function getWorldTransitionForQuest(tiledWorld, character) {
  const raceId = getCharacterRaceId(character);
  return (tiledWorld?.transitions ?? []).find((transition) => {
    const targetMapId = getTransitionTargetMapId(transition);
    const targetKey = normalizeTransitionTargetKey(getTransitionRawTarget(transition));
    const name = String(transition.name ?? '').toLowerCase();
    return (isWorldV2Map(targetMapId) || isActiveWorldTransitionKey(targetKey))
      && (name.includes(raceId) || name.includes('world'));
  }) ?? (tiledWorld?.transitions ?? []).find((transition) => {
    const targetKey = normalizeTransitionTargetKey(getTransitionRawTarget(transition));
    return isWorldV2Map(getTransitionTargetMapId(transition))
      || isActiveWorldTransitionKey(targetKey);
  }) ?? null;
}

function getQuestObjectCenter(object) {
  if (!object) return { x: 0, y: 0 };
  if (object.point) return { x: Number(object.x ?? 0), y: Number(object.y ?? 0) };
  return {
    x: Number(object.x ?? 0) + Number(object.width ?? 0) / 2,
    y: Number(object.y ?? 0) + Number(object.height ?? 0) / 2,
  };
}

function createKillQuestDefinition(tiledWorld, spawn, index, totalCount) {
  const mapId = normalizeMapId(tiledWorld?.mapId);
  const isBoss = Boolean(spawn?.props?.bossType) || String(spawn?.type ?? '').toLowerCase().includes('boss');
  const enemyKind = normalizeEnemyKind(isBoss
    ? spawn?.props?.bossType ?? spawn?.props?.enemyType ?? spawn?.name
    : spawn?.props?.enemyType ?? spawn?.props?.bossType ?? spawn?.name);
  const enemyName = getEnemyKindName(enemyKind);
  const required = Math.max(1, Math.floor(numberProp(spawn, 'questRequired', isBoss ? 1 : 15)));
  const giver = getQuestGiverForMap(tiledWorld, spawn?.props?.questGiverId);
  const turnInPoint = getQuestObjectCenter(giver);
  const explicitMinLevel = Number(spawn?.props?.minLevel);
  const minLevel = Number.isFinite(explicitMinLevel)
    ? Math.max(1, Math.floor(explicitMinLevel))
    : isStartingMapId(mapId)
      ? 1
      : Math.max(1, Math.floor(numberProp(spawn, 'recommendedLevel', 1)));
  return {
    id: `${mapId}:hunt:${enemyKind}`,
    chainIndex: index,
    mapId,
    giverId: giver?.id ?? getQuestGiverProfile(mapId).id,
    turnInMapId: mapId,
    turnInGiverId: giver?.id ?? getQuestGiverProfile(mapId).id,
    type: 'kill',
    title: String(spawn?.props?.questTitle ?? (isBoss ? `Face ${enemyName}` : `Cull the ${enemyName}`)),
    dialogue: String(spawn?.props?.questDialogue ?? (index === 0 ? 'Start close to home. Thin their numbers and return when the path is calmer.' : 'Good. The next threat is already pressing in.')),
    description: String(spawn?.props?.questDescription ?? (isBoss
      ? `${enemyName} holds this area together. Defeat it and return to your quest giver.`
      : `Defeat ${required} ${enemyName} in the marked area, then return to your quest giver.`)),
    objectiveText: String(spawn?.props?.questObjectiveText ?? `Defeat ${required} ${enemyName}`),
    enemyKind,
    required,
    minLevel,
    xpReward: getScaledQuestXpReward({ type: 'kill', required, chainIndex: index }),
    marker: {
      type: 'area',
      mapId,
      x: Number(spawn?.x ?? 0),
      y: Number(spawn?.y ?? 0),
      width: Math.max(96, Number(spawn?.width ?? 0)),
      height: Math.max(96, Number(spawn?.height ?? 0)),
      label: enemyName,
    },
    turnInMarker: {
      type: 'point',
      mapId,
      x: turnInPoint.x,
      y: turnInPoint.y,
      label: giver?.name ?? getQuestGiverProfile(mapId).name,
    },
    isFinalKill: index === totalCount - 1,
  };
}

function createTravelQuestDefinition(tiledWorld, character) {
  const mapId = normalizeMapId(tiledWorld?.mapId);
  if (mapId === 'world') return null;
  const transition = getWorldTransitionForQuest(tiledWorld, character);
  const giver = getQuestGiverForMap(tiledWorld);
  const point = transition ? getObjectPosition(transition) : getQuestObjectCenter(giver);
  return {
    id: `${mapId}:travel:world`,
    chainIndex: 999,
    mapId,
    giverId: giver?.id ?? getQuestGiverProfile(mapId).id,
    turnInMapId: WORLD_V3_HUB_MAP_ID,
    turnInGiverId: WORLD_V3_QUEST_GIVER_ID,
    type: 'travel',
    title: 'Report to Tamzia Town Hall',
    dialogue: 'You have done enough here. Take the road out and report to Mayor Alwen Tamz in Tamzia Town Hall.',
    description: 'Travel to Tamzia and report to Mayor Alwen Tamz inside the Town Hall.',
    objectiveText: 'Travel to Tamzia Town Hall and speak with Mayor Alwen Tamz',
    required: 1,
    xpReward: getScaledQuestXpReward({ type: 'travel' }),
    marker: {
      type: 'point',
      mapId,
      x: point?.x ?? 0,
      y: point?.y ?? 0,
      label: 'Road to Tamzia',
    },
    worldMarker: {
      ...WORLD_V3_HUB_TURN_IN_MARKER,
    },
    turnInMarker: WORLD_V3_HUB_TURN_IN_MARKER,
  };
}

function hasCompletedStartingTravelQuest(character) {
  return Object.keys(character?.quests?.completed ?? {}).some((questId) => (
    String(questId).endsWith(':travel:world')
  ));
}

const TAMZIA_ASSISTANT_QUEST_GIVER_ID = 'tamzia_town_hall_assistant';
const TAMZIA_WANTED_BOARD_QUEST_GIVER_ID = 'tamzia_wanted_board';
const TAMZIA_MEET_ASSISTANT_QUEST_ID = 'world_region_0_0_v3:town-hall:meet-assistant';
const TAMZIA_TO_BRIGHTWATER_QUEST_ID = 'world_region_0_0_v3:tamzia:continue-to-brightwater-ford';
const BRIGHTWATER_FORD_MAP_ID = 'continent_01_region_1_0';
const BRIGHTWATER_FORD_QUEST_GIVER_ID = 'brightwater_ford_pathfinder';
const BRIGHTWATER_FORD_TURN_IN_MARKER = {
  type: 'point',
  mapId: BRIGHTWATER_FORD_MAP_ID,
  x: 35112,
  y: 17176,
  label: 'Pathfinder Mira Fordwatch',
};
const TAMZIA_ASSISTANT_MARKER = {
  type: 'point',
  mapId: WORLD_V3_HUB_MAP_ID,
  x: 15120,
  y: 12368,
  label: 'Civic Assistant Orin',
};
const TAMZIA_WANTED_BOARD_MARKER = {
  type: 'point',
  mapId: WORLD_V3_HUB_MAP_ID,
  x: 15876,
  y: 12774,
  label: 'Tamzia Wanted Board',
};
const TAMZIA_REEDWATER_MARKER = {
  type: 'area',
  mapId: WORLD_V3_HUB_MAP_ID,
  x: 20808,
  y: 6064,
  width: 4424,
  height: 4432,
  label: 'Reedwater Camp',
};
const TAMZIA_BRAMBLEHIDE_MARKER = {
  type: 'area',
  mapId: WORLD_V3_HUB_MAP_ID,
  x: 19264,
  y: 10888,
  width: 4840,
  height: 3576,
  label: 'Bramblehide Thicket',
};
const TAMZIA_MOONBROOK_MARKER = {
  type: 'area',
  mapId: WORLD_V3_HUB_MAP_ID,
  x: 15696,
  y: 6472,
  width: 3992,
  height: 4552,
  label: 'Moonbrook Woods',
};
const TAMZIA_REDSCAR_MARKER = {
  type: 'area',
  mapId: WORLD_V3_HUB_MAP_ID,
  x: 22216,
  y: 21784,
  width: 2368,
  height: 2190,
  label: 'Redscar Hideout',
};
const TAMZIA_SALTSPINE_MARKER = {
  type: 'area',
  mapId: WORLD_V3_HUB_MAP_ID,
  x: 9960,
  y: 17096,
  width: 2600,
  height: 1850,
  label: 'Saltspine Beach',
};
const TAMZIA_QUARRY_GIANT_MARKER = {
  type: 'area',
  mapId: WORLD_V3_HUB_MAP_ID,
  x: 12992,
  y: 18284,
  width: 692,
  height: 700,
  label: 'Old Quarry Giant',
};
const TAMZIA_TIDEGLASS_MARKER = {
  type: 'area',
  mapId: WORLD_V3_HUB_MAP_ID,
  x: 13636,
  y: 8540,
  width: 1092,
  height: 588,
  label: 'Tideglass Matriarch',
};

const TAMZIA_FIELD_QUEST_DEFINITIONS = [
  {
    id: 'world_region_0_0_v3:tamzia:reedwater-marauders',
    chainIndex: 1001,
    mapId: WORLD_V3_HUB_MAP_ID,
    giverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
    turnInMapId: WORLD_V3_HUB_MAP_ID,
    turnInGiverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
    type: 'kill',
    title: 'Quiet the Reedwater Camp',
    dialogue: 'The river camp has started stopping carts before they reach the city. Thin their raiders and bring me the count.',
    description: 'Reedwater Marauders are pressing the trade road east of Tamzia.',
    objectiveText: 'Defeat 18 Reedwater Marauders',
    enemyKind: 'reedwater-marauder',
    required: 18,
    minLevel: 10,
    xpReward: 900,
    xpRewardLocked: true,
    requiredLocked: true,
    marker: TAMZIA_REEDWATER_MARKER,
    turnInMarker: TAMZIA_ASSISTANT_MARKER,
  },
  {
    id: 'world_region_0_0_v3:tamzia:moonbrook-prowlers',
    chainIndex: 1002,
    mapId: WORLD_V3_HUB_MAP_ID,
    giverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
    turnInMapId: WORLD_V3_HUB_MAP_ID,
    turnInGiverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
    type: 'kill',
    title: 'Howls Under Moonbrook',
    dialogue: 'Moonbrook has gone quiet in the bad way. The scouts say the prowlers are hunting in packs now.',
    description: 'Moonbrook Prowlers have claimed the north woods and are pushing toward the road.',
    objectiveText: 'Defeat 16 Moonbrook Prowlers',
    enemyKind: 'moonbrook-prowler',
    required: 16,
    minLevel: 10,
    xpReward: 950,
    xpRewardLocked: true,
    requiredLocked: true,
    marker: TAMZIA_MOONBROOK_MARKER,
    turnInMarker: TAMZIA_ASSISTANT_MARKER,
  },
  {
    id: 'world_region_0_0_v3:tamzia:bramblehide-bears',
    chainIndex: 1003,
    mapId: WORLD_V3_HUB_MAP_ID,
    giverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
    turnInMapId: WORLD_V3_HUB_MAP_ID,
    turnInGiverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
    type: 'kill',
    title: 'Bramblehide Breakout',
    dialogue: 'The bears near the thicket were never gentle, but now they are breaking fences and chasing gatherers.',
    description: 'Bramblehide Bears are blocking herb cutters and woodcutters south-east of Tamzia.',
    objectiveText: 'Defeat 12 Bramblehide Bears',
    enemyKind: 'bramblehide-bear',
    required: 12,
    minLevel: 11,
    xpReward: 950,
    xpRewardLocked: true,
    requiredLocked: true,
    marker: TAMZIA_BRAMBLEHIDE_MARKER,
    turnInMarker: TAMZIA_ASSISTANT_MARKER,
  },
  {
    id: 'world_region_0_0_v3:tamzia:saltspine-crawlers',
    chainIndex: 1004,
    mapId: WORLD_V3_HUB_MAP_ID,
    giverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
    turnInMapId: WORLD_V3_HUB_MAP_ID,
    turnInGiverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
    type: 'kill',
    title: 'Saltspine Tide',
    dialogue: 'Something drove the shore crawlers inland. Keep the beach path open before the fishermen refuse to dock.',
    description: 'Saltspine Crawlers are swarming the western shore path.',
    objectiveText: 'Defeat 14 Saltspine Crawlers',
    enemyKind: 'saltspine-crawler',
    required: 14,
    minLevel: 12,
    xpReward: 1000,
    xpRewardLocked: true,
    requiredLocked: true,
    marker: TAMZIA_SALTSPINE_MARKER,
    turnInMarker: TAMZIA_ASSISTANT_MARKER,
  },
  {
    id: 'world_region_0_0_v3:tamzia:redscar-highwaymen',
    chainIndex: 1005,
    mapId: WORLD_V3_HUB_MAP_ID,
    giverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
    turnInMapId: WORLD_V3_HUB_MAP_ID,
    turnInGiverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
    type: 'kill',
    title: 'Redscar Roadblock',
    dialogue: "The Redscar crew is brave enough to rob the mayoral courier. That makes them everyone's problem.",
    description: 'Redscar Highwaymen have made a hard camp on the southern road. Break the camp and bring down Captain Varn inside the hideout.',
    objectiveText: 'Defeat 12 Redscar Highwaymen and Redscar Captain Varn',
    enemyKind: 'redscar-highwayman',
    required: 13,
    objectives: [
      { enemyKind: 'redscar-highwayman', required: 12, label: 'Highwaymen' },
      { enemyKind: 'redscar-captain', required: 1, label: 'Captain Varn' },
    ],
    minLevel: 13,
    xpReward: 1250,
    xpRewardLocked: true,
    requiredLocked: true,
    marker: TAMZIA_REDSCAR_MARKER,
    turnInMarker: TAMZIA_ASSISTANT_MARKER,
  },
];
const TAMZIA_FIELD_QUEST_IDS = TAMZIA_FIELD_QUEST_DEFINITIONS.map((quest) => quest.id);
const TAMZIA_TO_BRIGHTWATER_QUEST_DEFINITION = {
  id: TAMZIA_TO_BRIGHTWATER_QUEST_ID,
  chainIndex: 1006,
  mapId: WORLD_V3_HUB_MAP_ID,
  giverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
  turnInMapId: BRIGHTWATER_FORD_MAP_ID,
  turnInGiverId: BRIGHTWATER_FORD_QUEST_GIVER_ID,
  type: 'travel',
  title: 'Continue to Brightwater Ford',
  dialogue: 'Your ledger is clear enough for Tamzia. Follow the eastern road to Brightwater Ford and check in with Pathfinder Mira Fordwatch.',
  description: 'Travel east from Tamzia to Brightwater Ford. The boss bounties around Tamzia are optional and can be handled later.',
  objectiveText: 'Travel to Brightwater Ford and speak with Pathfinder Mira Fordwatch',
  required: 1,
  xpReward: 700,
  xpRewardLocked: true,
  marker: BRIGHTWATER_FORD_TURN_IN_MARKER,
  worldMarker: BRIGHTWATER_FORD_TURN_IN_MARKER,
  turnInMarker: BRIGHTWATER_FORD_TURN_IN_MARKER,
};
const TAMZIA_BOUNTY_QUEST_DEFINITIONS = [
  {
    id: 'world_region_0_0_v3:tamzia:bounty-old-quarry-giant',
    chainIndex: 1010,
    mapId: WORLD_V3_HUB_MAP_ID,
    giverId: TAMZIA_WANTED_BOARD_QUEST_GIVER_ID,
    turnInMapId: WORLD_V3_HUB_MAP_ID,
    turnInGiverId: WORLD_V3_QUEST_GIVER_ID,
    type: 'kill',
    title: 'Wanted: Old Quarry Giant',
    dialogue: 'A heavy notice is pinned here: the Old Quarry Giant is smashing stone wagons south-west of Tamzia.',
    description: 'Defeat the Old Quarry Giant, then report to Mayor Alwen Tamz for the bounty.',
    objectiveText: 'Defeat the Old Quarry Giant',
    enemyKind: 'old-quarry-giant',
    required: 1,
    minLevel: 15,
    xpReward: 620,
    xpRewardLocked: true,
    requiredLocked: true,
    marker: TAMZIA_QUARRY_GIANT_MARKER,
    turnInMarker: WORLD_V3_HUB_TURN_IN_MARKER,
  },
  {
    id: 'world_region_0_0_v3:tamzia:bounty-tideglass-matriarch',
    chainIndex: 1011,
    mapId: WORLD_V3_HUB_MAP_ID,
    giverId: TAMZIA_WANTED_BOARD_QUEST_GIVER_ID,
    turnInMapId: WORLD_V3_HUB_MAP_ID,
    turnInGiverId: WORLD_V3_QUEST_GIVER_ID,
    type: 'kill',
    title: 'Wanted: Tideglass Matriarch',
    dialogue: 'A salt-stiff bounty sheet names the Tideglass Matriarch as the source of the beach swarms.',
    description: 'Defeat the Tideglass Matriarch near the western shore, then report to Mayor Alwen Tamz.',
    objectiveText: 'Defeat the Tideglass Matriarch',
    enemyKind: 'tideglass-matriarch',
    required: 1,
    minLevel: 15,
    xpReward: 620,
    xpRewardLocked: true,
    requiredLocked: true,
    marker: TAMZIA_TIDEGLASS_MARKER,
    turnInMarker: WORLD_V3_HUB_TURN_IN_MARKER,
  },
];

function hasCompletedQuestIds(character, questIds) {
  return questIds.every((questId) => isQuestCompleted(character, questId));
}

function getTamziaTownHallQuestDefinitions(character) {
  if (!hasCompletedStartingTravelQuest(character)) return [];
  const definitions = [];
  if (!isQuestCompleted(character, TAMZIA_MEET_ASSISTANT_QUEST_ID)) {
    definitions.push({
    id: TAMZIA_MEET_ASSISTANT_QUEST_ID,
    chainIndex: 1000,
    mapId: WORLD_V3_HUB_MAP_ID,
    giverId: WORLD_V3_QUEST_GIVER_ID,
    turnInMapId: WORLD_V3_HUB_MAP_ID,
    turnInGiverId: TAMZIA_ASSISTANT_QUEST_GIVER_ID,
    type: 'travel',
    title: 'The Assistant Keeps the Ledger',
    dialogue: 'Welcome to Tamzia. I handle the city, but Assistant Orin keeps the work ledger. Report to him for your next assignments.',
    description: 'Speak with Civic Assistant Orin in Tamzia Town Hall. He will coordinate future work around the city.',
    objectiveText: 'Speak with Civic Assistant Orin',
    required: 1,
    xpReward: 600,
    xpRewardLocked: true,
    marker: TAMZIA_ASSISTANT_MARKER,
    turnInMarker: TAMZIA_ASSISTANT_MARKER,
    });
  }
  if (isQuestCompleted(character, TAMZIA_MEET_ASSISTANT_QUEST_ID)) {
    definitions.push(...TAMZIA_FIELD_QUEST_DEFINITIONS);
  }
  if (hasCompletedQuestIds(character, TAMZIA_FIELD_QUEST_IDS)) {
    definitions.push(TAMZIA_TO_BRIGHTWATER_QUEST_DEFINITION);
    definitions.push(...TAMZIA_BOUNTY_QUEST_DEFINITIONS);
  }
  return definitions;
}

function getTamziaWantedBoardQuestDefinitions(character) {
  if (!hasCompletedStartingTravelQuest(character)) return [];
  return TAMZIA_BOUNTY_QUEST_DEFINITIONS;
}

function createWorldKillQuest({
  id,
  chainIndex,
  title,
  description,
  objectiveText,
  enemyKind,
  required,
  marker,
  minLevel = 10,
  xpReward,
}) {
  return {
    id,
    chainIndex,
    mapId: 'world',
    giverId: WORLD_QUEST_GIVER_ID,
    turnInMapId: 'world',
    turnInGiverId: WORLD_QUEST_GIVER_ID,
    type: 'kill',
    title,
    dialogue: 'The city has work for anyone who can survive beyond the walls.',
    description,
    objectiveText,
    enemyKind,
    required,
    minLevel,
    xpReward: xpReward ?? getScaledQuestXpReward({ type: 'kill', required, chainIndex }),
    marker,
    turnInMarker: WORLD_QUEST_TURN_IN_MARKER,
  };
}

function getWorldQuestDefinitions(character) {
  const cityQuests = [
    createWorldKillQuest({
      id: 'world:city:road-bandits',
      chainIndex: 10,
      title: 'Trouble on the Green Road',
      description: 'Road bandits are cutting supply lines south of the city. Clear them out and report back.',
      objectiveText: 'Defeat 12 Road Bandits',
      enemyKind: 'road-bandit',
      required: 12,
      marker: { type: 'area', mapId: 'world', x: 92 * 32, y: 115 * 32, width: 142 * 32, height: 110 * 32, label: 'Greenbelt Fields' },
      xpReward: 2300,
    }),
    createWorldKillQuest({
      id: 'world:city:dire-wolves',
      chainIndex: 11,
      title: 'Howls from Pinewood',
      description: 'Dire wolves are pushing close to the road camps. Thin the pack before they reach the farms.',
      objectiveText: 'Defeat 10 Dire Wolves',
      enemyKind: 'dire-wolf',
      required: 10,
      marker: { type: 'area', mapId: 'world', x: 28 * 32, y: 235 * 32, width: 118 * 32, height: 125 * 32, label: 'Pinewood Hollow' },
      xpReward: 2700,
    }),
    createWorldKillQuest({
      id: 'world:city:stone-gnolls',
      chainIndex: 12,
      title: 'Stonehill Pressure',
      description: 'Stone gnolls have fortified the highlands. Break their patrols and keep the road open.',
      objectiveText: 'Defeat 8 Stone Gnolls',
      enemyKind: 'stone-gnoll',
      required: 8,
      marker: { type: 'area', mapId: 'world', x: 168 * 32, y: 355 * 32, width: 112 * 32, height: 140 * 32, label: 'Stormhill Highlands' },
      minLevel: 14,
      xpReward: 3300,
    }),
    createWorldKillQuest({
      id: 'world:city:ashen-frontier',
      chainIndex: 13,
      title: 'Ash on the Wind',
      description: 'Ember wraiths are gathering on the frontier. Scatter them before the city has another crisis.',
      objectiveText: 'Defeat 8 Ember Wraiths',
      enemyKind: 'ember-wraith',
      required: 8,
      marker: { type: 'area', mapId: 'world', x: 34 * 32, y: 500 * 32, width: 130 * 32, height: 88 * 32, label: 'Ashen Frontier' },
      minLevel: 18,
      xpReward: 4200,
    }),
  ];

  const dungeonQuest = createWorldKillQuest({
    id: 'world:dungeon:rift-heart',
    chainIndex: 20,
    title: 'Into the Rift-Cavern',
    description: 'A rift heart is pulsing beneath the old road. Enter the dungeon, defeat it, and return for a major reward.',
    objectiveText: 'Defeat the Rift Heart',
    enemyKind: 'rift-heart',
    required: 1,
    marker: DUNGEON_ENTRANCE_MARKER,
    minLevel: 20,
    xpReward: 9000,
  });
  dungeonQuest.dungeonMarker = {
    type: 'area',
    mapId: 'dungeon_01',
    x: 21 * 32,
    y: 160 * 32,
    width: 24 * 32,
    height: 23 * 32,
    label: 'Rift Heart',
  };
  dungeonQuest.turnInMarkers = [DUNGEON_EXIT_MARKER, WORLD_QUEST_TURN_IN_MARKER];

  return [...cityQuests, dungeonQuest].filter((quest) => (
    Number(character?.level ?? 1) >= safeNumber(quest.minLevel, 1)
    && (hasCompletedStartingTravelQuest(character) || Number(character?.level ?? 1) >= 10)
  ));
}

function getStartingQuestDefinitions(tiledWorld, character) {
  const mapId = normalizeMapId(tiledWorld?.mapId);
  if (mapId === 'world' || !WORLD_LIKE_MAP_IDS.has(mapId)) return [];
  const killSpawns = [
    ...(tiledWorld?.enemySpawns ?? []),
    ...(tiledWorld?.bossSpawns ?? []),
  ].filter((spawn) => spawn?.props?.enemyType || spawn?.props?.bossType)
    .filter((spawn, index, list) => {
      const spawnKey = `${spawn?.id ?? spawn?.name ?? index}:${spawn?.props?.enemyType ?? ''}:${spawn?.props?.bossType ?? ''}`;
      return list.findIndex((candidate, candidateIndex) => {
        const candidateKey = `${candidate?.id ?? candidate?.name ?? candidateIndex}:${candidate?.props?.enemyType ?? ''}:${candidate?.props?.bossType ?? ''}`;
        return candidateKey === spawnKey;
      }) === index;
    });
  const killQuests = killSpawns
    .sort((a, b) => safeNumber(a.props?.recommendedLevel, 1) - safeNumber(b.props?.recommendedLevel, 1))
    .map((spawn, index, list) => createKillQuestDefinition(tiledWorld, spawn, index, list.length));
  if (isWorldV2Map(mapId)) return killQuests;
  const travelQuest = createTravelQuestDefinition(tiledWorld, character);
  return travelQuest ? [...killQuests, travelQuest] : killQuests;
}

function isQuestCompleted(character, questId) {
  return Boolean(character?.quests?.completed?.[questId]);
}

function getActiveQuest(character, questId) {
  return character?.quests?.active?.[questId] ?? null;
}

function getQuestSnapshot(activeQuest, fallbackQuest = null) {
  return activeQuest?.quest ?? fallbackQuest ?? null;
}

function getAvailableQuestOffers(character, tiledWorld, giver) {
  if (!character || !giver) return [];
  const mapId = normalizeMapId(tiledWorld?.mapId);
  if (mapId === WORLD_V3_HUB_MAP_ID) {
    const definitions = String(giver.id) === TAMZIA_WANTED_BOARD_QUEST_GIVER_ID
      ? getTamziaWantedBoardQuestDefinitions(character)
      : getTamziaTownHallQuestDefinitions(character);
    return definitions
      .filter((quest) => String(quest.giverId) === String(giver.id))
      .filter((quest) => !isQuestCompleted(character, quest.id) && !getActiveQuest(character, quest.id));
  }

  if (mapId === 'world') {
    return getWorldQuestDefinitions(character)
      .filter((quest) => String(quest.giverId) === String(giver.id))
      .filter((quest) => !isQuestCompleted(character, quest.id) && !getActiveQuest(character, quest.id));
  }

  const characterLevel = Number(character?.level ?? 1);
  const definitions = getStartingQuestDefinitions(tiledWorld, character)
    .filter((quest) => String(quest.giverId) === String(giver.id))
    .filter((quest) => characterLevel >= safeNumber(quest.minLevel, 1));

  if (isStartingMapId(mapId)) {
    const killDefinitions = definitions.filter((quest) => quest.type === 'kill');
    const allKillQuestsCompleted = killDefinitions.every((quest) => isQuestCompleted(character, quest.id));
    const killOffers = killDefinitions
      .filter((quest) => !isQuestCompleted(character, quest.id) && !getActiveQuest(character, quest.id));
    const travelOffers = allKillQuestsCompleted
      ? definitions
        .filter((quest) => quest.type === 'travel')
        .filter((quest) => !isQuestCompleted(character, quest.id) && !getActiveQuest(character, quest.id))
      : [];
    return [...killOffers, ...travelOffers];
  }

  for (const quest of definitions) {
    if (isQuestCompleted(character, quest.id) || getActiveQuest(character, quest.id)) continue;
    const previous = definitions.filter((candidate) => candidate.chainIndex < quest.chainIndex);
    return previous.every((candidate) => isQuestCompleted(character, candidate.id)) ? [quest] : [];
  }
  return [];
}

function isQuestTurnInGiverMatch(quest, giver) {
  if (String(quest?.turnInGiverId) === String(giver?.id)) return true;
  const questId = String(quest?.id ?? '');
  return quest?.type === 'travel'
    && questId.endsWith(':travel:world')
    && normalizeMapId(quest?.turnInMapId) === WORLD_V3_HUB_MAP_ID
    && String(giver?.id) === WORLD_V3_QUEST_GIVER_ID;
}

function getTurnInQuestEntries(character, giver, currentMapId) {
  if (!character || !giver) return [];
  return Object.entries(character.quests?.active ?? {})
    .map(([questId, activeQuest]) => ({ questId, activeQuest, quest: getQuestSnapshot(activeQuest) }))
    .filter(({ activeQuest, quest }) => (
      quest
      && (activeQuest.status === 'ready' || (quest.type === 'travel' && normalizeMapId(quest.turnInMapId) === normalizeMapId(currentMapId)))
      && normalizeMapId(quest.turnInMapId) === normalizeMapId(currentMapId)
      && isQuestTurnInGiverMatch(quest, giver)
    ));
}

function getMainQuest(character) {
  const questId = character?.quests?.mainQuestId;
  const activeQuest = questId ? character?.quests?.active?.[questId] : null;
  const fallbackEntry = Object.entries(character?.quests?.active ?? {})[0] ?? null;
  if (activeQuest) return { id: questId, activeQuest, quest: getQuestSnapshot(activeQuest) };
  if (fallbackEntry) return { id: fallbackEntry[0], activeQuest: fallbackEntry[1], quest: getQuestSnapshot(fallbackEntry[1]) };
  return null;
}

function getQuestKillObjectives(quest) {
  if (!quest || quest.type !== 'kill') return [];
  const explicitObjectives = Array.isArray(quest.objectives)
    ? quest.objectives
      .map((objective) => {
        const enemyKind = normalizeEnemyKind(objective?.enemyKind ?? objective?.kind ?? objective?.id);
        const required = Math.max(1, Math.floor(safeNumber(objective?.required, 1)));
        return enemyKind ? {
          ...objective,
          enemyKind,
          required,
          label: String(objective?.label ?? getEnemyKindName(enemyKind)),
        } : null;
      })
      .filter(Boolean)
    : [];
  if (explicitObjectives.length > 0) return explicitObjectives;
  const enemyKind = normalizeEnemyKind(quest.enemyKind);
  return enemyKind ? [{ enemyKind, required: Math.max(1, Math.floor(safeNumber(quest.required, 1))), label: getEnemyKindName(enemyKind) }] : [];
}

function getQuestProgressText(activeQuest, quest) {
  if (!quest) return '';
  if (activeQuest?.status === 'ready') return 'Ready to turn in';
  if (quest.type === 'kill') {
    const objectives = getQuestKillObjectives(quest);
    if (objectives.length > 1) {
      const progressByKind = activeQuest?.progressByKind ?? activeQuest?.objectiveProgress ?? {};
      return objectives.map((objective) => {
        const progress = Math.min(objective.required, Math.max(0, Math.floor(safeNumber(progressByKind[objective.enemyKind], 0))));
        return `${objective.label} ${progress}/${objective.required}`;
      }).join(' | ');
    }
    return `${safeNumber(activeQuest?.progress, 0)} / ${quest.required}`;
  }
  return 'In progress';
}

function questMarkerMatchesCurrentMap(marker, currentMapId) {
  if (!marker) return false;
  const markerMapId = normalizeMapId(marker.mapId);
  const mapId = normalizeMapId(currentMapId);
  if (markerMapId === mapId) return true;
  return isWorldV2Map(markerMapId)
    && isWorldV2Map(mapId)
    && getGameplayMapSpaceId(markerMapId) === getGameplayMapSpaceId(mapId);
}

function getEnemyQuestKillKinds(enemy) {
  return new Set([
    enemy?.enemyKind,
    enemy?.bossType,
    enemy?.questKind,
    enemy?.spawnName,
    enemy?.spawnId,
    enemy?.spriteId,
    enemy?.type,
    enemy?.name,
  ].map(normalizeEnemyKind).filter(Boolean));
}

function getQuestMarkerForMap(quest, currentMapId, activeQuest = null) {
  if (!quest) return null;
  if (activeQuest?.status === 'ready') {
    const mappedTurnInMarker = (quest.turnInMarkers ?? []).find((marker) => questMarkerMatchesCurrentMap(marker, currentMapId));
    if (mappedTurnInMarker) return mappedTurnInMarker;
    const turnInMarker = quest.turnInMarker ?? (normalizeMapId(quest.turnInMapId) === 'world' ? WORLD_QUEST_TURN_IN_MARKER : null);
    if (questMarkerMatchesCurrentMap(turnInMarker, currentMapId)) return turnInMarker;
    return null;
  }
  if (questMarkerMatchesCurrentMap(quest.dungeonMarker, currentMapId)) return quest.dungeonMarker;
  if (questMarkerMatchesCurrentMap(quest.worldMarker, currentMapId)) return quest.worldMarker;
  if (questMarkerMatchesCurrentMap(quest.marker, currentMapId)) return quest.marker;
  return null;
}

function questMarkerIntersectsView(marker, view) {
  if (!marker || !view) return false;
  if (marker.type !== 'area') {
    return marker.x >= view.x
      && marker.y >= view.y
      && marker.x <= view.x + view.width
      && marker.y <= view.y + view.height;
  }
  const width = Math.max(1, safeNumber(marker.width, 1));
  const height = Math.max(1, safeNumber(marker.height, 1));
  return marker.x + width >= view.x
    && marker.y + height >= view.y
    && marker.x <= view.x + view.width
    && marker.y <= view.y + view.height;
}

function getQuestMarkerStyle(marker, percent, view) {
  if (!marker) return {};
  if (marker.type !== 'area') {
    return {
      left: `${percent(marker, 'x')}%`,
      top: `${percent(marker, 'y')}%`,
    };
  }
  const width = Math.max(1, safeNumber(marker.width, 1));
  const height = Math.max(1, safeNumber(marker.height, 1));
  return {
    left: `${percent(marker, 'x')}%`,
    top: `${percent(marker, 'y')}%`,
    width: `${clamp((width / Math.max(1, view.width)) * 100, 3, 100)}%`,
    height: `${clamp((height / Math.max(1, view.height)) * 100, 3, 100)}%`,
  };
}

function rollMobLoot(enemy) {
  const kind = normalizeEnemyKind(enemy?.enemyKind ?? enemy?.bossType ?? enemy?.type);
  const enemyName = getEnemyKindName(kind);
  const slots = ['head', 'chest', 'legs', 'boots', 'weapon', 'ring', 'trinket'];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const rarity = Math.random() < 0.18 ? 'Uncommon' : 'Common';
  const statKey = ['health', 'strength', 'agility', 'intellect', 'mana'][Math.floor(Math.random() * 5)];
  const statAmount = rarity === 'Uncommon' ? 2 : 1;
  return {
    id: crypto.randomUUID(),
    name: `${enemyName} ${slot === 'weapon' ? 'Fang' : 'Trophy'}`,
    rarity,
    slot,
    stats: { [statKey]: statKey === 'health' || statKey === 'mana' ? statAmount * 5 : statAmount },
    foundAt: new Date().toISOString(),
  };
}

function isDungeonEnemyKill(enemy) {
  const type = String(enemy?.type ?? '');
  return type === 'dungeon_enemy' || type === 'dungeon_miniboss' || type === 'dungeon_final_boss' || normalizeMapId(enemy?.mapId) === 'dungeon_01';
}

function rollDungeonMobLoot(enemy) {
  const kind = normalizeEnemyKind(enemy?.enemyKind ?? enemy?.bossType ?? enemy?.type);
  const enemyName = getEnemyKindName(kind);
  const slots = ['head', 'chest', 'legs', 'boots', 'weapon', 'offhand', 'ring', 'trinket'];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const rarityRoll = Math.random();
  const rarity = rarityRoll < 0.12 ? 'Rare' : rarityRoll < 0.58 ? 'Uncommon' : 'Common';
  const primaryStats = ['strength', 'agility', 'intellect'];
  const utilityStats = ['health', 'mana', 'attackSpeed'];
  const primary = primaryStats[Math.floor(Math.random() * primaryStats.length)];
  const utility = utilityStats[Math.floor(Math.random() * utilityStats.length)];
  const statAmount = rarity === 'Rare' ? 4 : rarity === 'Uncommon' ? 3 : 2;
  const stats = {
    [primary]: statAmount,
    [utility]: utility === 'attackSpeed'
      ? (rarity === 'Rare' ? 0.08 : 0.05)
      : statAmount * (utility === 'health' || utility === 'mana' ? 8 : 1),
  };
  return {
    id: crypto.randomUUID(),
    name: `${enemyName} ${slot === 'weapon' ? 'Edge' : 'Relic'}`,
    rarity,
    slot,
    stats,
    foundAt: new Date().toISOString(),
  };
}

function hashNumber(value) {
  const text = String(value ?? '0');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed, salt = 0) {
  const value = Math.sin(hashNumber(`${seed}:${salt}`) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function pointForSpawnSlot(bounds, slotIndex, maxAlive) {
  const aspect = Math.max(0.35, bounds.width / Math.max(1, bounds.height));
  const columns = Math.max(1, Math.ceil(Math.sqrt(maxAlive * aspect)));
  const rows = Math.max(1, Math.ceil(maxAlive / columns));
  const column = slotIndex % columns;
  const row = Math.floor(slotIndex / columns) % rows;
  const cellWidth = bounds.width / columns;
  const cellHeight = bounds.height / rows;
  const seed = `${bounds.x}:${bounds.y}:${slotIndex}`;
  return {
    x: bounds.x + cellWidth * (column + 0.5) + (seededUnit(seed, 1) - 0.5) * Math.max(10, cellWidth * 0.36),
    y: bounds.y + cellHeight * (row + 0.5) + (seededUnit(seed, 2) - 0.5) * Math.max(10, cellHeight * 0.36),
  };
}

function isPointInsideSpawnArea(point, spawnObject, bounds, radius = 0) {
  if (!spawnObject || !point) return true;

  if (Array.isArray(spawnObject.polygon) && spawnObject.polygon.length >= 3) {
    const polygon = getObjectPolygonPoints(spawnObject);
    return pointInPolygon(point, polygon) && distanceToPolygon(point, polygon) >= radius;
  }

  return (
    point.x >= bounds.x + radius
    && point.x <= bounds.x + bounds.width - radius
    && point.y >= bounds.y + radius
    && point.y <= bounds.y + bounds.height - radius
  );
}

function findSpawnAreaAnchor(spawnObject, bounds, radius = 0) {
  const center = clampPointToBounds({
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }, bounds, radius);
  if (isPointInsideSpawnArea(center, spawnObject, bounds, radius)) return center;

  const columns = 12;
  const rows = 12;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const candidate = clampPointToBounds({
        x: bounds.x + ((column + 0.5) / columns) * bounds.width,
        y: bounds.y + ((row + 0.5) / rows) * bounds.height,
      }, bounds, radius);
      if (isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)) return candidate;
    }
  }

  return center;
}

function constrainPointToSpawnArea(point, spawnObject, bounds, radius = ENEMY.radius, fallbackPoint = null) {
  const bounded = clampPointToBounds(point, bounds, radius);
  if (isPointInsideSpawnArea(bounded, spawnObject, bounds, radius)) return bounded;

  const anchor = fallbackPoint && isPointInsideSpawnArea(fallbackPoint, spawnObject, bounds, radius)
    ? fallbackPoint
    : findSpawnAreaAnchor(spawnObject, bounds, radius);
  if (!isPointInsideSpawnArea(anchor, spawnObject, bounds, radius)) return bounded;

  let insidePoint = anchor;
  let outsidePoint = bounded;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const candidate = {
      x: (insidePoint.x + outsidePoint.x) / 2,
      y: (insidePoint.y + outsidePoint.y) / 2,
    };
    if (isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)) insidePoint = candidate;
    else outsidePoint = candidate;
  }
  return insidePoint;
}

function pointForSpawnSlotInArea(spawnObject, bounds, slotIndex, maxAlive, radius = ENEMY.radius) {
  const gridPoint = clampPointToBounds(pointForSpawnSlot(bounds, slotIndex, maxAlive), bounds, radius);
  if (isPointInsideSpawnArea(gridPoint, spawnObject, bounds, radius)) return gridPoint;

  const seed = `${getSpawnPackId(spawnObject)}:${slotIndex}:area`;
  for (let attempt = 0; attempt < 96; attempt += 1) {
    const candidate = clampPointToBounds({
      x: bounds.x + seededUnit(seed, attempt * 2 + 1) * bounds.width,
      y: bounds.y + seededUnit(seed, attempt * 2 + 2) * bounds.height,
    }, bounds, radius);
    if (isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)) return candidate;
  }

  return constrainPointToSpawnArea(gridPoint, spawnObject, bounds, radius);
}

function getSpawnMovementMode(spawnObject, slotIndex = 0) {
  const configured = String(
    spawnObject?.props?.movement
    ?? spawnObject?.props?.movementMode
    ?? spawnObject?.props?.patrol
    ?? '',
  ).toLowerCase();
  if (['still', 'stationary', 'guard', 'sentinel'].includes(configured)) return 'sentinel';
  if (['pause', 'wander_pause', 'roam_pause', 'stop'].includes(configured)) return 'roam-pause';
  if (['patrol', 'path', 'loop'].includes(configured)) return 'patrol';
  if (slotIndex % 4 === 0) return 'roam-pause';
  return 'patrol';
}

function clampPointToBounds(point, bounds, radius = ENEMY.radius) {
  return {
    x: clamp(point.x, bounds.x + radius, bounds.x + bounds.width - radius),
    y: clamp(point.y, bounds.y + radius, bounds.y + bounds.height - radius),
  };
}

function buildPatrolPoints(home, spawnObject, bounds, slotIndex, radius = ENEMY.radius, tiledWorld = null, collisionOptions = {}) {
  const seed = `${bounds.x}:${bounds.y}:${slotIndex}:patrol`;
  const spreadX = Math.min(Math.max(bounds.width * 0.12, 36), 170);
  const spreadY = Math.min(Math.max(bounds.height * 0.12, 36), 140);
  const direction = seededUnit(seed, 7) > 0.5 ? 1 : -1;
  const offsets = [
    { x: -spreadX, y: -spreadY * 0.25 },
    { x: spreadX * 0.7, y: -spreadY * 0.9 },
    { x: spreadX, y: spreadY * 0.45 },
    { x: -spreadX * 0.55, y: spreadY },
  ];
  return offsets.map((offset, index) => findOpenSpawnPoint(
    tiledWorld,
    spawnObject,
    bounds,
    slotIndex * 10 + index,
    4,
    radius,
    {
      x: home.x + offset.x * direction + (seededUnit(seed, index) - 0.5) * 18,
      y: home.y + offset.y + (seededUnit(seed, index + 10) - 0.5) * 18,
    },
    collisionOptions,
  ));
}

function findOpenSpawnPoint(
  tiledWorld,
  spawnObject,
  bounds,
  slotIndex,
  maxAlive,
  radius = ENEMY.radius,
  preferredPoint = null,
  collisionOptions = {},
) {
  const basePoint = constrainPointToSpawnArea(
    preferredPoint ?? pointForSpawnSlotInArea(spawnObject, bounds, slotIndex, maxAlive, radius),
    spawnObject,
    bounds,
    radius,
  );
  if (
    isPointInsideSpawnArea(basePoint, spawnObject, bounds, radius)
    && (!tiledWorld || canEnemyMoveTo(tiledWorld, basePoint.x, basePoint.y, radius, collisionOptions))
  ) return basePoint;

  const seed = `${bounds.x}:${bounds.y}:${slotIndex}:open`;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const angle = seededUnit(seed, attempt) * Math.PI * 2;
    const spread = 18 + attempt * 8;
    const candidate = clampPointToBounds({
      x: basePoint.x + Math.cos(angle) * spread,
      y: basePoint.y + Math.sin(angle) * spread,
    }, bounds, radius);
    if (
      isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)
      && canEnemyMoveTo(tiledWorld, candidate.x, candidate.y, radius, collisionOptions)
    ) return candidate;
  }

  // If a forest prop or another collision-heavy feature blocks the slot's cell,
  // search the whole spawn area with a slot-specific sequence. The old shared
  // top-left scan made every blocked slot collapse onto the same open tile.
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const candidate = clampPointToBounds({
      x: bounds.x + seededUnit(seed, 1000 + attempt * 2) * bounds.width,
      y: bounds.y + seededUnit(seed, 1001 + attempt * 2) * bounds.height,
    }, bounds, radius);
    if (
      isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)
      && canEnemyMoveTo(tiledWorld, candidate.x, candidate.y, radius, collisionOptions)
    ) return candidate;
  }

  const columns = Math.max(1, Math.floor(bounds.width / Math.max(radius * 2, 24)));
  const rows = Math.max(1, Math.floor(bounds.height / Math.max(radius * 2, 24)));
  const cellCount = columns * rows;
  const startCell = Math.floor(seededUnit(seed, 4001) * cellCount);
  for (let step = 0; step < cellCount; step += 1) {
    const cellIndex = (startCell + step) % cellCount;
    const column = cellIndex % columns;
    const row = Math.floor(cellIndex / columns);
    const candidate = clampPointToBounds({
      x: bounds.x + ((column + 0.5) / columns) * bounds.width,
      y: bounds.y + ((row + 0.5) / rows) * bounds.height,
    }, bounds, radius);
    if (
      isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)
      && canEnemyMoveTo(tiledWorld, candidate.x, candidate.y, radius, collisionOptions)
    ) return candidate;
  }

  return basePoint;
}

function isSameEnemyMovementSpace(left, right) {
  if (!left || !right || left === right || String(left.id) === String(right.id)) return false;
  const leftInteriorId = normalizeInteriorId(left.interiorId ?? left.spawnArea?.props?.interiorId ?? left.spawnArea?.props?.caveId);
  const rightInteriorId = normalizeInteriorId(right.interiorId ?? right.spawnArea?.props?.interiorId ?? right.spawnArea?.props?.caveId);
  return leftInteriorId === rightInteriorId
    && getGameplayMapSpaceId(left.mapId ?? 'world') === getGameplayMapSpaceId(right.mapId ?? 'world');
}

function getEnemySeparationVector(enemy, nearbyEnemies = []) {
  if (!enemy || !Array.isArray(nearbyEnemies) || nearbyEnemies.length === 0) {
    return { x: 0, y: 0, strength: 0, nearbyCount: 0 };
  }

  const enemyRadius = Math.max(1, safeNumber(enemy.radius, ENEMY.radius));
  const crowdRadius = Math.max(170, enemyRadius * 8.5);
  const comfortableNeighborCount = 3; // The enemy plus three neighbours still forms a natural four-unit pack.
  let pushX = 0;
  let pushY = 0;
  let personalStrength = 0;
  const crowd = [];

  nearbyEnemies.forEach((neighbor) => {
    if (
      !isSameEnemyMovementSpace(enemy, neighbor)
      || safeNumber(neighbor.hp, 1) <= 0
      || !isFinitePoint(neighbor)
    ) return;

    let dx = safeNumber(enemy.x) - safeNumber(neighbor.x);
    let dy = safeNumber(enemy.y) - safeNumber(neighbor.y);
    let separationDistance = Math.hypot(dx, dy);
    if (separationDistance < 0.001) {
      const enemyId = String(enemy.id ?? 'enemy');
      const neighborId = String(neighbor.id ?? 'neighbor');
      const orderedIds = [enemyId, neighborId].sort();
      const angle = seededUnit(`${orderedIds[0]}:${orderedIds[1]}:separation`, 1) * Math.PI * 2;
      const direction = enemyId === orderedIds[0] ? 1 : -1;
      dx = Math.cos(angle) * direction;
      dy = Math.sin(angle) * direction;
      separationDistance = 1;
    }

    if (separationDistance < crowdRadius) crowd.push({ dx, dy, distance: separationDistance });

    const neighborRadius = Math.max(1, safeNumber(neighbor.radius, ENEMY.radius));
    const personalDistance = Math.max(60, enemyRadius + neighborRadius + 24);
    if (separationDistance >= personalDistance) return;
    const closeness = 1 - separationDistance / personalDistance;
    const weight = 0.8 + closeness * 1.8;
    pushX += (dx / separationDistance) * weight;
    pushY += (dy / separationDistance) * weight;
    personalStrength = Math.max(personalStrength, 0.55 + closeness * 1.05);
  });

  let crowdStrength = 0;
  if (crowd.length > comfortableNeighborCount) {
    crowdStrength = clamp((crowd.length - comfortableNeighborCount) / 3, 0, 1);
    crowd.forEach(({ dx, dy, distance: neighborDistance }) => {
      const falloff = 1 - neighborDistance / crowdRadius;
      pushX += (dx / neighborDistance) * falloff * crowdStrength;
      pushY += (dy / neighborDistance) * falloff * crowdStrength;
    });
  }

  const pushLength = Math.hypot(pushX, pushY);
  if (pushLength < 0.001) {
    return { x: 0, y: 0, strength: 0, nearbyCount: crowd.length };
  }
  return {
    x: pushX / pushLength,
    y: pushY / pushLength,
    strength: clamp(personalStrength + crowdStrength * 1.35, 0, 1.6),
    nearbyCount: crowd.length,
  };
}

function getMinimumDistanceFromEnemies(point, enemy, occupiedEnemies) {
  let minimumDistance = Number.POSITIVE_INFINITY;
  occupiedEnemies.forEach((neighbor) => {
    if (!isSameEnemyMovementSpace(enemy, neighbor) || safeNumber(neighbor.hp, 1) <= 0 || !isFinitePoint(neighbor)) return;
    minimumDistance = Math.min(minimumDistance, Math.hypot(point.x - neighbor.x, point.y - neighbor.y));
  });
  return minimumDistance;
}

function findDistributedSpawnPoint(
  initialPoint,
  enemy,
  occupiedEnemies,
  tiledWorld,
  spawnObject,
  bounds,
  slotIndex,
  maxAlive,
  radius,
  collisionOptions,
) {
  if (!Array.isArray(occupiedEnemies) || occupiedEnemies.length === 0) return initialPoint;
  const spacingFromArea = Math.sqrt(Math.max(1, bounds.width * bounds.height) / Math.max(1, maxAlive)) * 0.5;
  const preferredSpacing = clamp(spacingFromArea, radius * 2 + 22, 170);
  let bestPoint = initialPoint;
  let bestDistance = getMinimumDistanceFromEnemies(initialPoint, enemy, occupiedEnemies);
  if (bestDistance >= preferredSpacing) return initialPoint;

  const seed = `${getSpawnPackId(spawnObject)}:${slotIndex}:distributed`;
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const rawPoint = {
      x: bounds.x + seededUnit(seed, attempt * 2 + 1) * bounds.width,
      y: bounds.y + seededUnit(seed, attempt * 2 + 2) * bounds.height,
    };
    const candidate = constrainPointToSpawnArea(rawPoint, spawnObject, bounds, radius, initialPoint);
    if (
      !isPointInsideSpawnArea(candidate, spawnObject, bounds, radius)
      || !canEnemyMoveTo(tiledWorld, candidate.x, candidate.y, radius, collisionOptions)
    ) continue;
    const candidateDistance = getMinimumDistanceFromEnemies(candidate, enemy, occupiedEnemies);
    if (candidateDistance > bestDistance) {
      bestPoint = candidate;
      bestDistance = candidateDistance;
    }
    if (candidateDistance >= preferredSpacing) return candidate;
  }
  return bestPoint;
}

function makeEnemyMovementState(
  spawnObject,
  bounds,
  slotIndex,
  maxAlive,
  radius = ENEMY.radius,
  tiledWorld = null,
  occupiedEnemies = [],
  enemyIdentity = null,
) {
  const interiorId = normalizeInteriorId(spawnObject?.props?.interiorId ?? spawnObject?.props?.caveId);
  const collisionOptions = interiorId
    ? { activeInteriorId: interiorId, ignoreWorldCollision: true }
    : {};
  const openPoint = findOpenSpawnPoint(tiledWorld, spawnObject, bounds, slotIndex, maxAlive, radius, null, collisionOptions);
  const home = findDistributedSpawnPoint(
    openPoint,
    {
      id: enemyIdentity ?? `spawn-slot-${slotIndex}`,
      mapId: spawnObject?.mapId ?? 'world',
      interiorId,
      radius,
      spawnArea: spawnObject,
    },
    occupiedEnemies,
    tiledWorld,
    spawnObject,
    bounds,
    slotIndex,
    maxAlive,
    radius,
    collisionOptions,
  );
  const movementMode = getSpawnMovementMode(spawnObject, slotIndex);
  const patrolPoints = movementMode === 'sentinel'
    ? [home]
    : buildPatrolPoints(home, spawnObject, bounds, slotIndex, radius, tiledWorld, collisionOptions);
  return {
    home,
    movementMode,
    patrolPoints,
    patrolIndex: Math.floor(seededUnit(`${slotIndex}:patrol`, 3) * patrolPoints.length),
    pauseUntil: 0,
    wanderTarget: patrolPoints[0] ?? home,
    nextWanderAt: performance.now() + 500 + seededUnit(`${slotIndex}:wander`, 4) * 1500,
  };
}

function getReadyRespawnSlots(pack, now, occupiedSlots) {
  const readySlots = [];
  const waitingRespawns = [];
  pack.pendingRespawns.forEach((respawn) => {
    const normalizedRespawn = typeof respawn === 'number' ? { at: respawn, slotIndex: null } : respawn;
    if (normalizedRespawn.at > now) {
      waitingRespawns.push(normalizedRespawn);
      return;
    }
    if (normalizedRespawn.slotIndex != null && !occupiedSlots.has(normalizedRespawn.slotIndex)) {
      readySlots.push(normalizedRespawn.slotIndex);
      occupiedSlots.add(normalizedRespawn.slotIndex);
      return;
    }
    const openSlot = Array.from({ length: pack.maxAlive }).findIndex((_, index) => !occupiedSlots.has(index));
    if (openSlot >= 0) {
      readySlots.push(openSlot);
      occupiedSlots.add(openSlot);
    }
  });
  pack.pendingRespawns = waitingRespawns;
  return readySlots;
}

function updateIdleEnemyMovement(enemy, now, delta, isBoss = false, tiledWorld = null, nearbyEnemies = []) {
  const bounds = enemy.spawnBounds;
  if (!bounds) return enemy;
  const spawnArea = enemy.spawnArea ?? null;
  const radius = enemy.radius ?? ENEMY.radius;
  const mode = enemy.movementMode ?? 'patrol';
  let target = enemy.wanderTarget;
  let patrolIndex = enemy.patrolIndex ?? 0;
  let pauseUntil = enemy.pauseUntil ?? 0;
  let nextWanderAt = enemy.nextWanderAt ?? 0;
  const patrolPoints = enemy.patrolPoints?.length ? enemy.patrolPoints : [enemy.home ?? randomPointInBounds(bounds)];
  const separation = getEnemySeparationVector(enemy, nearbyEnemies);
  let movementPaused = false;

  if (mode === 'sentinel') {
    if (!target || now >= nextWanderAt || distance(enemy, target) < 5) {
      const home = enemy.home ?? patrolPoints[0];
      target = constrainPointToSpawnArea({
        x: home.x + (seededUnit(`${enemy.id}:${Math.floor(now / 1000)}`, 1) - 0.5) * 34,
        y: home.y + (seededUnit(`${enemy.id}:${Math.floor(now / 1000)}`, 2) - 0.5) * 34,
      }, spawnArea, bounds, radius, home);
      nextWanderAt = now + 3000 + Math.random() * 4000;
    }
  } else if (mode === 'roam-pause') {
    if (pauseUntil <= now && (!target || distance(enemy, target) < 10 || now >= nextWanderAt)) {
      patrolIndex = (patrolIndex + 1) % patrolPoints.length;
      target = patrolPoints[patrolIndex];
      pauseUntil = now + 900 + Math.random() * 1900;
      nextWanderAt = now + 6500 + Math.random() * 2500;
    }
    movementPaused = pauseUntil > now;
  } else if (!target || distance(enemy, target) < 10 || now >= nextWanderAt) {
    patrolIndex = (patrolIndex + 1) % patrolPoints.length;
    target = patrolPoints[patrolIndex];
    nextWanderAt = now + 9000 + Math.random() * 3000;
  }

  const toTargetX = target.x - enemy.x;
  const toTargetY = target.y - enemy.y;
  const targetLength = Math.hypot(toTargetX, toTargetY);
  let steeringX = movementPaused || targetLength < 0.001 ? 0 : toTargetX / targetLength;
  let steeringY = movementPaused || targetLength < 0.001 ? 0 : toTargetY / targetLength;
  if (separation.strength > 0) {
    const separationWeight = movementPaused ? 1.35 : 1.1;
    steeringX += separation.x * separation.strength * separationWeight;
    steeringY += separation.y * separation.strength * separationWeight;
  }
  const steeringLength = Math.hypot(steeringX, steeringY);
  if (steeringLength < 0.001) {
    return {
      ...enemy,
      wanderTarget: target,
      patrolIndex,
      pauseUntil,
      nextWanderAt,
    };
  }
  const speedMultiplier = mode === 'sentinel' ? 0.24 : mode === 'roam-pause' ? 0.52 : 0.78;
  const pauseMultiplier = movementPaused ? 0.55 : 1;
  const baseMovementSpeed = Math.max(0, safeNumber(enemy.speed, ENEMY.speed));
  const wanderSpeed = baseMovementSpeed * (isBoss ? 0.65 : 1) * speedMultiplier * pauseMultiplier;
  const movement = moveEnemyWithCollision(
    tiledWorld,
    enemy,
    enemy.x + (steeringX / steeringLength) * wanderSpeed * delta,
    enemy.y + (steeringY / steeringLength) * wanderSpeed * delta,
    bounds,
  );
  const nextPosition = constrainPointToSpawnArea(movement, spawnArea, bounds, radius, enemy.home);
  const constrainedBySpawnArea = Math.abs(nextPosition.x - movement.x) > 0.01 || Math.abs(nextPosition.y - movement.y) > 0.01;

  return {
    ...enemy,
    wanderTarget: target,
    patrolIndex,
    pauseUntil,
    nextWanderAt: movement.blocked || constrainedBySpawnArea ? Math.min(nextWanderAt, now + 600) : nextWanderAt,
    x: nextPosition.x,
    y: nextPosition.y,
  };
}

function getEnemyHomePoint(enemy) {
  if (isFinitePoint(enemy?.home)) {
    return {
      x: safeNumber(enemy.home.x),
      y: safeNumber(enemy.home.y),
    };
  }

  const patrolHome = Array.isArray(enemy?.patrolPoints)
    ? enemy.patrolPoints.find((point) => isFinitePoint(point))
    : null;
  if (patrolHome) {
    return {
      x: safeNumber(patrolHome.x),
      y: safeNumber(patrolHome.y),
    };
  }

  if (enemy?.spawnBounds) {
    const radius = enemy.radius ?? ENEMY.radius;
    return clampPointToBounds({
      x: safeNumber(enemy.spawnBounds.x) + safeNumber(enemy.spawnBounds.width, radius * 2) / 2,
      y: safeNumber(enemy.spawnBounds.y) + safeNumber(enemy.spawnBounds.height, radius * 2) / 2,
    }, enemy.spawnBounds, radius);
  }

  return {
    x: safeNumber(enemy?.x),
    y: safeNumber(enemy?.y),
  };
}

function clearEnemyCombatEffects(enemy) {
  const nextEnemy = { ...enemy };
  [
    'poisonDebuff',
    'burnDebuff',
    'bleedDebuff',
    'coldUntil',
    'coldMultiplier',
    'slowUntil',
    'slowMultiplier',
    'frozenUntil',
    'stunnedUntil',
    'damageTakenMultiplier',
    'damageTakenUntil',
  ].forEach((key) => {
    delete nextEnemy[key];
  });
  return nextEnemy;
}

function resetEnemyAggro(enemy, now = 0) {
  const home = getEnemyHomePoint(enemy);
  const maxHp = Math.max(1, safeNumber(enemy?.maxHp, enemy?.hp ?? 1));
  return {
    ...clearEnemyCombatEffects(enemy),
    state: 'idle',
    targetPlayerId: null,
    firstHitPlayerId: null,
    leashStartedAt: null,
    aggroStartedAt: null,
    aggroDisabledUntil: now + 2500,
    attackStartedAt: 0,
    attackType: null,
    attackLaunchAt: 0,
    attackImpactAt: 0,
    attackUntil: 0,
    attackResolved: true,
    nextMechanicAt: null,
    nextSecondaryMechanicAt: null,
    mechanicType: null,
    mechanicStartedAt: 0,
    mechanicLaunchAt: 0,
    mechanicImpactAt: 0,
    mechanicUntil: 0,
    mechanicRadius: 0,
    mechanicProjectiles: [],
    mechanicHitPlayerIds: [],
    mechanicResolved: true,
    hp: maxHp,
    x: home.x,
    y: home.y,
    home,
    targetX: home.x,
    targetY: home.y,
    wanderTarget: home,
    pauseUntil: now + 500,
    nextWanderAt: now + 1400,
  };
}

function createWorldSpawnPacks(spawns = []) {
  const sourceSpawns = Array.isArray(spawns) ? spawns : [];

  return new globalThis.Map(sourceSpawns.map((spawn, index) => {
    const id = getSpawnPackId(spawn, `fallback_spawn_${index}`);
    return [id, {
      id,
      spawn,
      maxAlive: getSpawnMaxAlive(spawn),
      pendingRespawns: [],
    }];
  }));
}

function scheduleWorldSpawnRespawn(spawnPacks, spawnId, now, spawnSlot = null) {
  const pack = spawnPacks.get(spawnId);
  if (!pack) return;
  pack.pendingRespawns.push({ at: now + getSpawnRespawnDelay(pack.spawn), slotIndex: spawnSlot });
}

function getRaceStartPosition(tiledWorld, raceId) {
  const mapId = normalizeMapId(tiledWorld?.mapId ?? getRaceStartMapId(raceId));
  const normalizedRace = String(raceId ?? '').toLowerCase();
  const start = tiledWorld?.raceStarts?.find((candidate) => (
    candidate.name.toLowerCase().includes(normalizedRace)
  )) ?? tiledWorld?.raceStarts?.find((candidate) => (
    candidate.name.toLowerCase().includes('human')
  ));

  if (!start && isWorldV2Map(mapId)) return { ...WORLD_V3_HUB_ARRIVAL, mapId };
  if (!start) return { x: 420, y: 420, facing: 0, mapId };

  return {
    x: start.x,
    y: start.y,
    facing: Number(start.props.facing ?? 0),
    mapId,
  };
}

function getCharacterStartPosition(tiledWorld, character) {
  const savedPosition = character?.position;
  const mapId = normalizeMapId(tiledWorld?.mapId ?? getRaceStartMapId(character?.raceId));
  const savedMapId = normalizeMapId(savedPosition?.mapId ?? mapId);
  if (
    mapId === 'world'
    && savedMapId === 'world'
    && savedPosition?.worldVersion !== WORLD_MAP_VERSION
    && Number(character?.level ?? 1) >= 10
  ) {
    const arrival = getTransition(tiledWorld, `${String(character?.raceId ?? 'human').toLowerCase()}_road_arrival`)
      ?? getTransition(tiledWorld, 'human_road_arrival');
    if (arrival) {
      return {
        x: arrival.x,
        y: arrival.y,
        facing: Number(arrival.props?.facing ?? 0),
        mapId,
      };
    }
  }
  if (
    Number.isFinite(savedPosition?.x)
    && Number.isFinite(savedPosition?.y)
    && savedMapId === mapId
  ) {
    return {
      x: savedPosition.x,
      y: savedPosition.y,
      facing: Number(savedPosition.facing ?? 0),
      mapId,
    };
  }

  return getRaceStartPosition(tiledWorld, character?.raceId);
}

function getGraveyardPosition(tiledWorld, character) {
  return getNearestGraveyardPosition(tiledWorld, character?.position, character);
}

function createEnemy(
  id,
  spawnObject,
  fallbackPosition,
  spawnSlot = 0,
  maxAlive = getSpawnMaxAlive(spawnObject),
  tiledWorld = null,
  occupiedEnemies = [],
) {
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition);
  const enemyKind = getSpawnEnemyType(spawnObject);
  const stats = getEnemyKindStats(enemyKind);
  const radius = stats.radius ?? ENEMY.radius;
  const mapId = normalizeMapId(spawnObject?.mapId ?? 'world');
  const interiorId = normalizeInteriorId(spawnObject?.props?.interiorId ?? spawnObject?.props?.caveId);
  const movement = makeEnemyMovementState(
    spawnObject,
    spawnBounds,
    spawnSlot,
    maxAlive,
    radius,
    tiledWorld,
    occupiedEnemies,
    id,
  );
  const spawnPoint = movement.home;
  const mapWidth = tiledWorld ? getTiledWorldPixelWidth(tiledWorld) : WORLD.width;
  const mapHeight = tiledWorld ? getTiledWorldPixelHeight(tiledWorld) : WORLD.height;
  return {
    id,
    type: 'enemy',
    enemyKind,
    mapId,
    interiorId,
    spriteId: ENEMY_SPRITE_CONFIG[enemyKind] ? enemyKind : null,
    name: stats.name,
    state: 'idle',
    spawnName: spawnObject?.name,
    spawnId: getSpawnPackId(spawnObject),
    spawnSlot,
    spawnBounds,
    spawnArea: spawnObject,
    ...movement,
    x: clamp(spawnPoint.x, radius, mapWidth - radius),
    y: clamp(spawnPoint.y, radius, mapHeight - radius),
    hp: stats.hp,
    maxHp: stats.hp,
    radius,
    speed: getSpawnMovementSpeed(spawnObject, stats.speed),
    xp: stats.xp,
    damage: stats.damage,
    attackCooldown: stats.attackCooldown,
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createBoss(id, spawnObject, fallbackPosition, tiledWorld = null) {
  const bossKind = normalizeEnemyKind(spawnObject?.props?.bossType ?? spawnObject?.props?.enemyType ?? spawnObject?.name ?? 'elder-briarheart');
  const stats = getBossKindStats(bossKind);
  const radius = stats.radius ?? 36;
  const mapId = normalizeMapId(spawnObject?.mapId ?? 'world');
  const interiorId = normalizeInteriorId(spawnObject?.props?.interiorId ?? spawnObject?.props?.caveId);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition, 620);
  const movement = makeEnemyMovementState(spawnObject, spawnBounds, 0, 1, radius, tiledWorld);
  const spawnPoint = movement.home;
  const mapWidth = tiledWorld ? getTiledWorldPixelWidth(tiledWorld) : WORLD.width;
  const mapHeight = tiledWorld ? getTiledWorldPixelHeight(tiledWorld) : WORLD.height;
  return {
    id,
    type: 'boss',
    bossType: bossKind,
    enemyKind: bossKind,
    questKind: spawnObject?.props?.enemyType ? normalizeEnemyKind(spawnObject.props.enemyType) : bossKind,
    spriteId: ENEMY_SPRITE_CONFIG[bossKind] ? bossKind : 'elder-briarheart',
    mapId,
    interiorId,
    name: stats.name,
    state: 'idle',
    spawnName: spawnObject?.name,
    spawnId: getSpawnPackId(spawnObject),
    spawnSlot: 0,
    spawnBounds,
    spawnArea: spawnObject,
    ...movement,
    nextWanderAt: performance.now() + 1200 + Math.random() * 2200,
    x: clamp(spawnPoint.x, radius + 6, mapWidth - radius - 6),
    y: clamp(spawnPoint.y, radius + 6, mapHeight - radius - 6),
    hp: stats.hp,
    maxHp: stats.hp,
    radius,
    speed: getSpawnMovementSpeed(spawnObject, stats.speed),
    xp: stats.xp,
    damage: stats.damage,
    attackCooldown: stats.attackCooldown,
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

const CHARACTER_APPEARANCE_MODEL = 'adventurer-fresh-v3';

function getDefaultAppearance(raceId, classId) {
  const race = RACES[raceId] ?? RACES.human;
  const classConfig = CLASSES[classId] ?? CLASSES.warrior;
  return {
    race: raceId,
    body: raceId,
    outfit: classId,
    weapon: classId,
    beard: 'none',
    cape: 'none',
    outfitVariant: 'classic',
    weaponVariant: 'classic',
    capeStyle: 'none',
    gender: 'male',
    hairStyle: 'male-cropped',
    faceVariant: 'male-natural',
    heritageStyle: FRESH_RACE_DEFAULT_HERITAGE[raceId] ?? 'none',
    hatVariant: 'none',
    skin: race.skin,
    eyes: '#3b2416',
    hair: raceId === 'human' ? classConfig.colors.hair : race.hair,
    hat: classConfig.colors.robe,
    robe: classConfig.colors.robe,
    trim: classConfig.colors.trim,
    staff: '#7c4a22',
    crystal: classConfig.colors.trim,
    weaponColor: '#94a3b8',
    spriteModel: CHARACTER_APPEARANCE_MODEL,
    characterSpriteModel: CHARACTER_APPEARANCE_MODEL,
    ...(raceId === 'human' ? { humanSpriteModel: CHARACTER_APPEARANCE_MODEL } : {}),
  };
}

function getMergedDefaultAppearance(raceId, classId, current = {}) {
  const nextDefault = getDefaultAppearance(raceId, classId);
  const merged = {
    ...nextDefault,
    gender: current.gender ?? 'male',
    hairStyle: current.hairStyle ?? nextDefault.hairStyle,
    faceVariant: current.faceVariant ?? nextDefault.faceVariant,
    heritageStyle: current.heritageStyle ?? nextDefault.heritageStyle,
    hatVariant: current.hatVariant ?? nextDefault.hatVariant,
    beard: current.beard ?? nextDefault.beard,
    outfitVariant: current.outfitVariant ?? nextDefault.outfitVariant,
    weaponVariant: current.weaponVariant ?? nextDefault.weaponVariant,
    capeStyle: current.capeStyle ?? current.cape ?? nextDefault.capeStyle,
    skin: current.skin ?? nextDefault.skin,
    eyes: current.eyes ?? nextDefault.eyes,
    hair: current.hair ?? nextDefault.hair,
    hat: current.hat ?? current.robe ?? nextDefault.hat,
    robe: current.robe ?? nextDefault.robe,
    trim: current.trim ?? nextDefault.trim,
    staff: current.staff ?? nextDefault.staff,
    crystal: current.crystal ?? current.trim ?? nextDefault.crystal,
    weaponColor: current.weaponColor ?? nextDefault.weaponColor,
  };
  if (RACES[raceId]) {
    const gender = merged.gender === 'female' ? 'female' : 'male';
    const validFaces = gender === 'female'
      ? ['female-natural', 'female-focused', 'female-freckled', 'female-cheerful']
      : ['male-natural', 'male-focused', 'male-scarred', 'male-cheerful'];
    const legacyFaceMap = {
      'male-keen': 'male-focused',
      'male-weathered': 'male-scarred',
      'male-calm': 'male-cheerful',
      'female-soft': 'female-natural',
      'female-bright': 'female-cheerful',
      'female-serene': 'female-cheerful',
    };
    const validHair = gender === 'female'
      ? ['female-long', 'female-side-bangs', 'female-bun', 'female-ponytail']
      : ['male-cropped', 'male-windswept', 'male-tousled', 'male-tied'];
    const legacyHairMap = gender === 'female'
      ? {
        short: 'female-side-bangs',
        long: 'female-long',
        hooded: 'female-long',
        'female-bob': 'female-long',
        'female-parted': 'female-side-bangs',
        'female-wavy': 'female-bun',
        'female-braid': 'female-ponytail',
      }
      : {
        short: 'male-cropped',
        long: 'male-tied',
        hooded: 'male-cropped',
        'male-parted': 'male-windswept',
      };
    merged.hairStyle = legacyHairMap[merged.hairStyle] ?? merged.hairStyle;
    merged.faceVariant = legacyFaceMap[merged.faceVariant] ?? merged.faceVariant;
    if (!validFaces.includes(merged.faceVariant)) merged.faceVariant = validFaces[0];
    if (!validHair.includes(merged.hairStyle)) merged.hairStyle = validHair[0];
    const validHeritage = FRESH_RACE_HERITAGE_STYLE_CHOICES[raceId]?.map((option) => option.id) ?? ['none'];
    if (!validHeritage.includes(merged.heritageStyle)) {
      merged.heritageStyle = FRESH_RACE_DEFAULT_HERITAGE[raceId] ?? 'none';
    }
    if (!['classic', 'veteran', 'runed', 'dark'].includes(merged.outfitVariant)) {
      merged.outfitVariant = 'classic';
    }
    if (!['classic', 'veteran', 'runed', 'ornate', 'shadow'].includes(merged.weaponVariant)) {
      merged.weaponVariant = 'classic';
    }
    if (classId === 'mage') {
      if (!['wanderer', 'wide', 'high-crown', 'starcaller', 'none'].includes(merged.hatVariant)) {
        merged.hatVariant = 'none';
      }
      merged.spriteModel = CHARACTER_APPEARANCE_MODEL;
    } else {
      merged.hatVariant = 'none';
    }
    if (gender === 'female' || !['none', 'short', 'full'].includes(merged.beard)) {
      merged.beard = 'none';
    }
    if (!['none', 'short', 'long'].includes(merged.capeStyle)) {
      merged.capeStyle = 'none';
    }
    merged.cape = merged.capeStyle;
    merged.spriteModel = CHARACTER_APPEARANCE_MODEL;
    merged.characterSpriteModel = CHARACTER_APPEARANCE_MODEL;
    if (raceId === 'human') merged.humanSpriteModel = CHARACTER_APPEARANCE_MODEL;
  }
  return merged;
}

function getNpcDisplayName(npc) {
  return String(npc?.props?.displayName ?? npc?.name ?? 'NPC');
}

function getNpcRole(npc) {
  return String(npc?.props?.npcType ?? npc?.props?.type ?? npc?.serviceType ?? npc?.shopType ?? '').toLowerCase();
}

function isTamziaInteriorNpc(npc) {
  const interiorId = getNpcInteriorId(npc);
  const buildingId = String(npc?.props?.buildingId ?? npc?.buildingId ?? '').toLowerCase();
  const tamziaInteriorIds = [
    'tamzia_town_hall_interior',
    'tamzia_city_bank_interior',
    'tamzia_tailor_and_leatherworker_interior',
    'tamzia_alchemist_interior',
    'tamzia_inn_interior',
    'tamzia_blacksmith_interior',
  ];
  const tamziaBuildingIds = [
    'tamzia_town_hall',
    'tamzia_city_bank',
    'tamzia_tailor_and_leatherworker',
    'tamzia_alchemist',
    'tamzia_inn',
    'tamzia_blacksmith',
  ];
  return tamziaInteriorIds.includes(interiorId)
    || tamziaBuildingIds.includes(buildingId);
}

function getTamziaNpcPalette(npc) {
  const role = getNpcRole(npc);
  if (role.includes('banker')) return { coat: '#5b3a1f', trim: '#facc15', pants: '#322119', hair: '#6b4b2a', accent: '#fde68a', item: '$' };
  if (role.includes('vault')) return { coat: '#374151', trim: '#cbd5e1', pants: '#1f2937', hair: '#2f2418', accent: '#d1d5db', item: 'L' };
  if (role.includes('guard')) return { coat: '#475569', trim: '#cbd5e1', pants: '#273444', hair: '#3f3024', accent: '#93c5fd', item: 'shield' };
  if (role.includes('mayor')) return { coat: '#254d7a', trim: '#d6bd65', pants: '#1e3a5f', hair: '#d6bd65', accent: '#fef3c7', item: 'chain' };
  if (role.includes('clerk')) return { coat: '#6f4d34', trim: '#93c5fd', pants: '#3f3024', hair: '#4b2e1e', accent: '#dbeafe', item: 'scroll' };
  if (role.includes('assistant')) return { coat: '#2f6f56', trim: '#86efac', pants: '#1f4d3d', hair: '#3f3024', accent: '#dcfce7', item: 'scroll' };
  if (role.includes('quest')) return { coat: '#7c2d12', trim: '#f97316', pants: '#431407', hair: '#2f2418', accent: '#fed7aa', item: '!' };
  return { coat: npc?.props?.color ?? '#155e75', trim: '#8be9fd', pants: '#0f3440', hair: '#3f3024', accent: '#e0f2fe', item: '' };
}

function pickSpawn(spawns) {
  if (!spawns.length) return null;
  return spawns[Math.floor(Math.random() * spawns.length)];
}

function abilityHitsEnemyClient(ability, origin, facing, enemy) {
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const hitRadius = (enemy.radius ?? ENEMY.radius) + 7;
  const rangedDefault = ability.type === 'bolt' ? 520 : ability.type === 'shot' ? 560 : 280;
  const range = Math.max(20, safeNumber(ability.range, rangedDefault));
  const lineEnd = { x: origin.x + fx * range, y: origin.y + fy * range };
  const trapCenter = { x: origin.x + fx * safeNumber(ability.trapOffset, 95), y: origin.y + fy * safeNumber(ability.trapOffset, 95) };

  if (ability.type === 'bolt') {
    return distanceToSegment(enemy, origin, lineEnd) < hitRadius + safeNumber(ability.width, 22);
  }
  if (ability.type === 'shot') {
    return distanceToSegment(enemy, origin, lineEnd) < hitRadius + safeNumber(ability.width, 24);
  }
  if (ability.type === 'chain') {
    return distance(enemy, origin) < (ability.range ?? 430) + hitRadius;
  }
  if (ability.type === 'aura') {
    return distance(enemy, origin) < (ability.radius ?? 112) + hitRadius;
  }
  if (ability.type === 'nova') {
    return distance(enemy, origin) < (ability.radius ?? 118) + hitRadius;
  }
  if (ability.type === 'ground') {
    return distance(enemy, origin) < (ability.radius ?? 110) + hitRadius;
  }
  if (ability.type === 'trap') {
    return distance(enemy, trapCenter) < safeNumber(ability.radius, 58) + hitRadius;
  }
  if (ability.type === 'strike') {
    const strikeRange = safeNumber(ability.range, 110);
    const strikeWidth = safeNumber(ability.width, 44);
    return distanceToSegment(enemy, origin, { x: origin.x + fx * strikeRange, y: origin.y + fy * strikeRange }) < strikeWidth + hitRadius;
  }
  if (ability.type === 'cleave') {
    const enemyAngle = Math.atan2(enemy.y - origin.y, enemy.x - origin.x);
    return distance(enemy, origin) < safeNumber(ability.range, 90) + hitRadius
      && Math.abs(angleDifference(enemyAngle, facing)) < safeNumber(ability.arc, 1.05);
  }
  if (ability.type === 'channel') {
    return distanceToSegment(enemy, origin, lineEnd) < hitRadius + safeNumber(ability.width, 8);
  }

  return distance(enemy, origin) < 118 + hitRadius;
}

function selectChainEnemyTargetList(enemiesToCheck, ability, origin, facing, casterId = null, options = {}) {
  const maxTargets = Math.max(1, ability.maxTargets ?? 5);
  const chainRange = ability.chainRange ?? 190;
  const combatIds = [casterId, ability.casterId]
    .filter((id) => id != null)
    .map((id) => String(id));
  const isCombatEligible = (enemy) => {
    if (!ability.combatOnly) return true;
    if (!enemy) return false;
    if (combatIds.length > 0) {
      if (enemy.targetPlayerId != null && combatIds.includes(String(enemy.targetPlayerId))) return true;
      if (enemy.firstHitPlayerId != null && combatIds.includes(String(enemy.firstHitPlayerId))) return true;
    }
    return enemy.state === 'aggro' && enemy.targetPlayerId == null && enemy.firstHitPlayerId == null;
  };
  let eligibleEnemies = enemiesToCheck.filter(isCombatEligible);
  let firstTarget = eligibleEnemies
    .filter((enemy) => abilityHitsEnemyClient(ability, origin, facing, enemy))
    .sort((a, b) => distance(a, origin) - distance(b, origin))[0];

  if (!firstTarget && ability.combatOnly && options.allowFallback !== false) {
    eligibleEnemies = enemiesToCheck.filter((enemy) => enemy && enemy.hp > 0);
    firstTarget = eligibleEnemies
      .filter((enemy) => abilityHitsEnemyClient(ability, origin, facing, enemy))
      .sort((a, b) => distance(a, origin) - distance(b, origin))[0];
  }

  if (!firstTarget) return [];

  const selected = [firstTarget];
  while (selected.length < maxTargets) {
    const previous = selected[selected.length - 1];
    const nextTarget = eligibleEnemies
      .filter((enemy) => !selected.some((target) => target.id === enemy.id))
      .filter((enemy) => distance(enemy, previous) < chainRange + (enemy.radius ?? ENEMY.radius))
      .sort((a, b) => distance(a, previous) - distance(b, previous))[0];
    if (!nextTarget) break;
    selected.push(nextTarget);
  }

  return selected;
}

function selectChainEnemyTargets(enemiesToCheck, ability, origin, facing, casterId = null) {
  return new Set(selectChainEnemyTargetList(enemiesToCheck, ability, origin, facing, casterId).map((enemy) => enemy.id));
}

function getShopkeeperFromMap(tiledWorld) {
  const npc = tiledWorld?.npcs?.find((candidate) => isServiceNpc(candidate) || (
    candidate.props.npcType === 'shopkeeper'
    || candidate.props.type === 'shopkeeper'
    || candidate.name.toLowerCase().includes('shop')
  ));

  if (!npc) return isWorldLikeMap(tiledWorld?.mapId) ? SHOPKEEPER : null;

  return normalizeServiceNpc(npc);
}

function getNpcCenter(npc) {
  return {
    x: Number(npc?.x ?? 0) + Number(npc?.width ?? 0) / 2,
    y: Number(npc?.y ?? 0) + Number(npc?.height ?? 0) / 2,
  };
}

function normalizeServiceNpc(npc) {
  const center = getNpcCenter(npc);
  const props = npc?.props ?? {};
  return {
    ...SHOPKEEPER,
    ...npc,
    ...center,
    name: props.displayName ?? npc?.name ?? SHOPKEEPER.name,
    serviceType: String(props.serviceType ?? props.npcType ?? props.type ?? '').trim(),
    shopType: String(props.shopType ?? props.vendorType ?? '').trim(),
    professionId: String(props.professionId ?? '').trim(),
    interactRange: Number(props.interactRange ?? SHOPKEEPER.interactRange),
  };
}

function isServiceNpc(npc) {
  const props = npc?.props ?? {};
  const serviceType = String(props.serviceType ?? '').trim();
  const npcType = String(props.npcType ?? props.type ?? '').trim();
  return Boolean(serviceType)
    || ['shopkeeper', 'vendor', 'blacksmith', 'banker', 'auctioneer', 'innkeeper', 'trainer'].includes(npcType);
}

function getNpcInteriorId(npc) {
  return String(npc?.props?.interiorId ?? npc?.interiorId ?? '').trim();
}

function normalizeInteriorId(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized || ['none', 'null', 'overworld', 'outside'].includes(normalized.toLowerCase())) return null;
  return normalized;
}

function getInteriorZoneId(zone) {
  const props = zone?.props ?? {};
  const name = String(zone?.name ?? '').trim();
  const explicitId = normalizeInteriorId(props.interiorId ?? props.caveId ?? props.targetInteriorId ?? zone?.interiorId);
  if (explicitId) return explicitId;
  if (/^cave_entrance_/i.test(name)) return name.replace(/^cave_entrance_/i, 'cave_');
  return normalizeInteriorId(name);
}

function getInteriorZoneKind(zone) {
  const props = zone?.props ?? {};
  return String(props.interiorKind ?? props.kind ?? props.type ?? zone?.type ?? zone?.name ?? '').trim().toLowerCase();
}

function isCaveEntranceZone(zone) {
  const kind = getInteriorZoneKind(zone);
  const name = String(zone?.name ?? '').toLowerCase();
  return kind.includes('cave_entrance') || kind.includes('cave entrance') || name.startsWith('cave_entrance');
}

function isCaveInteriorZone(zone) {
  const kind = getInteriorZoneKind(zone);
  const name = String(zone?.name ?? '').toLowerCase();
  return !isCaveEntranceZone(zone) && (kind.includes('cave') || name.startsWith('cave_'));
}

function isNpcVisibleForInterior(npc, activeInteriorZone) {
  const npcInteriorId = getNpcInteriorId(npc);
  if (!npcInteriorId) return true;
  if (!activeInteriorZone) return false;
  const zoneInteriorId = getInteriorZoneId(activeInteriorZone);
  const zoneProps = activeInteriorZone.props ?? {};
  const zoneBuildingId = String(zoneProps.buildingId ?? '').trim();
  const npcBuildingId = String(npc?.props?.buildingId ?? npc?.buildingId ?? '').trim();
  return npcInteriorId === zoneInteriorId
    || npcInteriorId === activeInteriorZone.name
    || (zoneBuildingId && npcBuildingId && zoneBuildingId === npcBuildingId);
}

function getNearbyServiceNpc(tiledWorld, point) {
  const activeInteriorZone = point ? getOpenInteriorZone(tiledWorld, point) : null;
  const services = (tiledWorld?.npcs ?? [])
    .filter(isServiceNpc)
    .filter((npc) => isNpcVisibleForInterior(npc, activeInteriorZone))
    .map(normalizeServiceNpc)
    .filter((npc) => distance(point, npc) <= npc.interactRange)
    .sort((a, b) => distance(point, a) - distance(point, b));
  if (services.length) return services[0];
  if ((tiledWorld?.npcs ?? []).some(isServiceNpc)) return null;
  const fallback = getShopkeeperFromMap(tiledWorld);
  if (fallback && point && distance(point, fallback) <= fallback.interactRange) return fallback;
  return null;
}

function getCaveInteriorZones(tiledWorld) {
  return (tiledWorld?.caveZones ?? []).filter(isCaveInteriorZone);
}

function getCaveEntranceZones(tiledWorld, interiorId = null) {
  const normalizedInteriorId = normalizeInteriorId(interiorId);
  return (tiledWorld?.caveZones ?? [])
    .filter(isCaveEntranceZone)
    .filter((zone) => !normalizedInteriorId || getInteriorZoneId(zone) === normalizedInteriorId);
}

function getCaveInteriorZone(tiledWorld, interiorId) {
  const normalizedInteriorId = normalizeInteriorId(interiorId);
  if (!normalizedInteriorId) return null;
  return getCaveInteriorZones(tiledWorld)
    .find((zone) => getInteriorZoneId(zone) === normalizedInteriorId) ?? null;
}

function getCaveEntranceZone(tiledWorld, point) {
  if (!point) return null;
  return getCaveEntranceZones(tiledWorld)
    .filter((zone) => pointInObject(point, zone, PLAYER.radius))
    .sort((a, b) => {
      const areaA = getObjectArea(a);
      const areaB = getObjectArea(b);
      return areaA - areaB;
    })[0] ?? null;
}

function normalizeTileLayerName(layer) {
  return String(layer?.name ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function getTileLayerProperty(layer, propertyName) {
  return (layer?.properties ?? []).find((property) => property.name === propertyName)?.value;
}

function getTileLayerInteriorId(layer) {
  return normalizeInteriorId(
    getTileLayerProperty(layer, 'interiorId')
      ?? getTileLayerProperty(layer, 'caveId'),
  );
}

function isCaveInteriorTileLayer(layer, interiorId) {
  if (layer?.type !== 'tilelayer' || layer.visible === false || !hasTileData(layer)) return false;
  const name = normalizeTileLayerName(layer);
  if (!['caveinteriors', 'cave_interiors'].includes(name)) return false;
  const layerInteriorId = getTileLayerInteriorId(layer);
  return !interiorId || !layerInteriorId || layerInteriorId === interiorId;
}

function pointHitsTileLayer(map, layer, point) {
  const tileWidth = safeNumber(map?.tilewidth, WORLD.tile);
  const tileHeight = safeNumber(map?.tileheight, WORLD.tile);
  const col = Math.floor(safeNumber(point?.x, 0) / tileWidth);
  const row = Math.floor(safeNumber(point?.y, 0) / tileHeight);
  const width = Number(layer?.width ?? map?.width ?? 0);
  const height = Number(layer?.height ?? map?.height ?? 0);
  if (col < 0 || row < 0 || col >= width || row >= height) return false;
  return Boolean(layer.data[row * width + col]);
}

function pointHitsCaveInteriorTile(map, point, interiorId) {
  return (map?.layers ?? [])
    .filter((layer) => isCaveInteriorTileLayer(layer, interiorId))
    .some((layer) => pointHitsTileLayer(map, layer, point));
}

function getLocalMapPoint(tiledWorld, point) {
  const map = tiledWorld?.map;
  if (!map || !point) return point;
  if (!isWorldV2Map(tiledWorld.mapId)) return point;
  const offset = getWorldV2RegionOffset(tiledWorld.mapId);
  const mapWidth = Number(map.width ?? 0) * safeNumber(map.tilewidth, WORLD.tile);
  const mapHeight = Number(map.height ?? 0) * safeNumber(map.tileheight, WORLD.tile);
  const x = safeNumber(point.x, 0);
  const y = safeNumber(point.y, 0);
  if (
    x >= offset.x
    && y >= offset.y
    && x < offset.x + mapWidth
    && y < offset.y + mapHeight
  ) {
    return { ...point, x: x - offset.x, y: y - offset.y };
  }
  return point;
}

function isPointOnCaveInteriorTile(tiledWorld, point, interiorId) {
  if (!tiledWorld?.map || !point) return false;
  if (tiledWorld.isRegionWorld && Array.isArray(tiledWorld.loadedRegions)) {
    return tiledWorld.loadedRegions.some((region) => {
      const map = region?.map;
      if (!map) return false;
      const localPoint = {
        ...point,
        x: safeNumber(point.x, 0) - safeNumber(region.offsetX, 0),
        y: safeNumber(point.y, 0) - safeNumber(region.offsetY, 0),
      };
      return pointHitsCaveInteriorTile(map, localPoint, interiorId);
    });
  }
  return pointHitsCaveInteriorTile(tiledWorld.map, getLocalMapPoint(tiledWorld, point), interiorId);
}

function isPointInCaveInteriorSpace(tiledWorld, point, interiorId) {
  const normalizedInteriorId = normalizeInteriorId(interiorId);
  if (!point || !normalizedInteriorId) return false;
  const caveZone = getCaveInteriorZone(tiledWorld, normalizedInteriorId);
  const entranceZones = getCaveEntranceZones(tiledWorld, normalizedInteriorId);
  return isPointOnCaveInteriorTile(tiledWorld, point, normalizedInteriorId)
    || entranceZones.some((zone) => (
      pointInObject(point, zone, PLAYER.radius)
      || isPointInCaveConnector(point, caveZone, zone)
    ));
}

function getOpenInteriorZone(tiledWorld, point, activeInteriorId = null) {
  const activeCaveId = normalizeInteriorId(activeInteriorId);
  if (activeCaveId && isPointInCaveInteriorSpace(tiledWorld, point, activeCaveId)) {
    return getCaveInteriorZone(tiledWorld, activeCaveId);
  }

  return (tiledWorld?.interiorZones ?? [])
    .filter((zone) => zone?.props?.roofHide !== false && pointInObject(point, zone, PLAYER.radius))
    .sort((a, b) => {
      const areaA = getObjectArea(a);
      const areaB = getObjectArea(b);
      return areaA - areaB;
    })[0] ?? null;
}

function getObjectCenter(object) {
  return {
    x: Number(object?.x ?? 0) + Number(object?.width ?? 0) / 2,
    y: Number(object?.y ?? 0) + Number(object?.height ?? 0) / 2,
  };
}

function getObjectPosition(object) {
  if (!object) return null;
  return object.point ? { x: Number(object.x ?? 0), y: Number(object.y ?? 0) } : getObjectCenter(object);
}

function getObjectBounds(object) {
  const objectX = Number(object?.x ?? 0);
  const objectY = Number(object?.y ?? 0);
  if (Array.isArray(object?.polygon) && object.polygon.length >= 3) {
    const polygon = getObjectPolygonPoints(object);
    const minX = Math.min(...polygon.map((point) => point.x));
    const maxX = Math.max(...polygon.map((point) => point.x));
    const minY = Math.min(...polygon.map((point) => point.y));
    const maxY = Math.max(...polygon.map((point) => point.y));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return {
    x: objectX,
    y: objectY,
    width: Math.max(0, Number(object?.width ?? 0)),
    height: Math.max(0, Number(object?.height ?? 0)),
  };
}

function getObjectVisualCenter(object) {
  const bounds = getObjectBounds(object);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function pointInObject(point, object, padding = 0) {
  if (!object || !point) return false;
  if (object.point) return distance(point, object) < 42 + padding;
  if (Array.isArray(object.polygon) && object.polygon.length >= 3) {
    const polygon = getObjectPolygonPoints(object);
    if (pointInPolygon(point, polygon)) return true;
    return padding > 0 && distanceToPolygon(point, polygon) <= padding;
  }
  const objectX = Number(object.x ?? 0);
  const objectY = Number(object.y ?? 0);
  const objectWidth = Number(object.width ?? 0);
  const objectHeight = Number(object.height ?? 0);
  if (object.ellipse && objectWidth > 0 && objectHeight > 0) {
    const centerX = objectX + objectWidth / 2;
    const centerY = objectY + objectHeight / 2;
    const radiusX = objectWidth / 2 + padding;
    const radiusY = objectHeight / 2 + padding;
    const normalizedX = (Number(point.x ?? 0) - centerX) / Math.max(1, radiusX);
    const normalizedY = (Number(point.y ?? 0) - centerY) / Math.max(1, radiusY);
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }
  return (
    point.x >= objectX - padding
    && point.x <= objectX + objectWidth + padding
    && point.y >= objectY - padding
    && point.y <= objectY + objectHeight + padding
  );
}

function getObjectPolygonPoints(object) {
  const objectX = Number(object?.x ?? 0);
  const objectY = Number(object?.y ?? 0);
  return (object?.polygon ?? []).map((point) => ({
    x: objectX + Number(point.x ?? 0),
    y: objectY + Number(point.y ?? 0),
  }));
}

function pointInPolygon(point, polygon) {
  let inside = false;
  const x = Number(point?.x ?? 0);
  const y = Number(point?.y ?? 0);
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const denominator = previous.y - current.y;
    const safeDenominator = Math.abs(denominator) < 0.0001
      ? (denominator < 0 ? -0.0001 : 0.0001)
      : denominator;
    const intersects = ((current.y > y) !== (previous.y > y))
      && x < ((previous.x - current.x) * (y - current.y)) / safeDenominator + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToPolygon(point, polygon) {
  if (!polygon.length) return Number.POSITIVE_INFINITY;
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    closest = Math.min(closest, distanceToSegment(point, start, end));
  }
  return closest;
}

function closestPointOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.0001) return { ...start };
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
}

function closestPointOnPolygon(point, polygon) {
  if (!polygon.length) return null;
  let closest = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const candidate = closestPointOnSegment(point, start, end);
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < closestDistance) {
      closest = candidate;
      closestDistance = candidateDistance;
    }
  }
  return closest;
}

function isPointInCaveConnector(point, caveZone, entranceZone) {
  if (!point || !caveZone || !entranceZone) return false;
  const entranceCenter = getObjectVisualCenter(entranceZone);
  const cavePolygon = getObjectPolygonPoints(caveZone);
  const caveEntryPoint = closestPointOnPolygon(entranceCenter, cavePolygon) ?? getObjectVisualCenter(caveZone);
  const connectorWidth = clamp(
    safeNumber(entranceZone?.props?.connectorWidth ?? caveZone?.props?.connectorWidth, 240),
    80,
    900,
  ) / 2 + PLAYER.radius + 24;
  return distanceToSegment(point, entranceCenter, caveEntryPoint) <= connectorWidth;
}

function getObjectArea(object) {
  if (Array.isArray(object?.polygon) && object.polygon.length >= 3) {
    const polygon = getObjectPolygonPoints(object);
    let area = 0;
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
  }
  return safeNumber(object?.width, 0) * safeNumber(object?.height, 0);
}

function getTransition(tiledWorld, name) {
  return tiledWorld?.transitions?.find((transition) => transition.name === name) ?? null;
}

function getCharacterRaceId(character) {
  return String(character?.raceId ?? 'human').toLowerCase();
}

function getTransitionRawTarget(transition) {
  const props = transition?.props ?? {};
  return props.targetMapId
    ?? props.targetMap
    ?? props.mapId
    ?? props.target
    ?? props.targetLandmarkId
    ?? props.targetLocationId
    ?? props.destination
    ?? null;
}

function normalizeTransitionTargetKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\.tmj$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getMapIdFromTransitionTarget(value) {
  const rawTarget = String(value ?? '').trim();
  if (!rawTarget) return null;
  if (MAP_FILES[rawTarget]) return normalizeMapId(rawTarget);

  const normalizedTarget = normalizeTransitionTargetKey(rawTarget);
  if (isActiveWorldTransitionKey(normalizedTarget)) return WORLD_V3_HUB_MAP_ID;

  const matchingEntry = Object.entries(MAP_FILES).find(([mapId, fileName]) => (
    normalizeTransitionTargetKey(mapId) === normalizedTarget
    || normalizeTransitionTargetKey(fileName) === normalizedTarget
  ));
  return matchingEntry ? normalizeMapId(matchingEntry[0]) : null;
}

function getTransitionTargetMapId(transition) {
  return getMapIdFromTransitionTarget(getTransitionRawTarget(transition));
}

function getTransitionType(transition) {
  return String(transition?.props?.type ?? '').toLowerCase();
}

function isStartingZoneWorldExit(currentMapId, transition, targetMapId) {
  if (!isStartingMapId(currentMapId)) return false;

  const targetKey = normalizeTransitionTargetKey(getTransitionRawTarget(transition));
  return isWorldV2Map(targetMapId) || isActiveWorldTransitionKey(targetKey);
}

function getTransitionTargetSpawnName(transition, character, targetMapId) {
  const props = transition?.props ?? {};
  const explicit = props.targetSpawn ?? props.targetSpawnName ?? props.spawn ?? props.arrival;
  const explicitName = explicit ? String(explicit) : '';
  const raceId = getCharacterRaceId(character);

  if (isWorldV2Map(targetMapId) && (!explicitName || explicitName.endsWith('_road_exit'))) {
    return `${raceId}_road_arrival`;
  }

  return explicitName || null;
}

function findSpawnObject(tiledWorld, spawnName, character) {
  const normalized = String(spawnName ?? '').toLowerCase();
  const raceId = getCharacterRaceId(character);
  const byName = (object) => String(object?.name ?? '').toLowerCase() === normalized;
  const includesName = (needle) => (object) => String(object?.name ?? '').toLowerCase().includes(needle);

  return getTransition(tiledWorld, spawnName)
    ?? tiledWorld?.raceStarts?.find(byName)
    ?? tiledWorld?.spawns?.find(byName)
    ?? tiledWorld?.transitions?.find(byName)
    ?? tiledWorld?.raceStarts?.find(includesName(`${raceId}_road_arrival`))
    ?? tiledWorld?.transitions?.find(includesName(`${raceId}_road_arrival`))
    ?? tiledWorld?.raceStarts?.find(includesName(raceId))
    ?? tiledWorld?.raceStarts?.find(includesName('human'))
    ?? null;
}

function getNearestGraveyardPosition(tiledWorld, origin, character) {
  const graveyards = [
    ...(tiledWorld?.graveyards ?? []),
    ...(tiledWorld?.transitions ?? []).filter((transition) => transition.name?.toLowerCase().includes('graveyard')),
  ];
  const source = origin ?? getRaceStartPosition(tiledWorld, character?.raceId);

  if (graveyards.length > 0) {
    const nearest = graveyards
      .map((graveyard) => ({ graveyard, point: getObjectPosition(graveyard) }))
      .filter((entry) => entry.point)
      .sort((a, b) => distance(source, a.point) - distance(source, b.point))[0];

    if (nearest) {
      return {
        x: nearest.point.x,
        y: nearest.point.y,
        facing: Number(nearest.graveyard.props?.facing ?? 0),
      };
    }
  }

  return getRaceStartPosition(tiledWorld, character?.raceId);
}

function hasFinalBossAlive(enemiesList) {
  return enemiesList.some((enemy) => enemy.type === 'dungeon_final_boss');
}

const DUNGEON_01_REQUIRED_LEVEL = 20;

function getDungeonEntryError(character) {
  const activeLevel = Number(character?.level ?? 1);

  if (activeLevel < DUNGEON_01_REQUIRED_LEVEL) return `Level ${DUNGEON_01_REQUIRED_LEVEL} required`;

  return null;
}

function getStartingZoneExitError(character) {
  const hasTravelQuest = Object.values(character?.quests?.active ?? {}).some((activeQuest) => {
    const quest = getQuestSnapshot(activeQuest);
    return quest?.type === 'travel'
      && !isWorldV2Map(quest?.mapId)
      && isWorldV2Map(quest?.turnInMapId);
  });

  if (hasTravelQuest || hasCompletedStartingTravelQuest(character)) return null;
  return 'Finish your starting-zone quests first';
}

async function findWorldV2RegistryTarget(targetId, generationId = 'v2') {
  const targetKey = normalizeTransitionTargetKey(targetId);
  if (!targetKey) return null;
  const generation = getWorldGenerationConfig(generationId);
  const registry = await loadWorldV2Registry(generation.id);
  const tileSize = safeNumber(registry.tileSize, WORLD.tile);
  const landmark = (registry.landmarks ?? []).find((candidate) => {
    const candidateKeys = [
      candidate.id,
      candidate.displayName,
      candidate.name,
    ].map(normalizeTransitionTargetKey);
    return candidateKeys.includes(targetKey);
  });
  if (!landmark) return null;

  const x = safeNumber(landmark.x, 0) * tileSize;
  const y = safeNumber(landmark.y, 0) * tileSize;
  return {
    id: landmark.id,
    displayName: landmark.displayName ?? landmark.id,
    x,
    y,
    mapId: getWorldV2MapIdFromPoint(x, y, generation.id) ?? `world_region_2_2_${generation.id}`,
  };
}

export {
  normalizeCharacter,
  normalizeName,
  isNameTaken,
  randomClassName,
  ensureUniqueCharacterNames,
  loadCharacters,
  saveCharacters,
  loadAuctionListings,
  saveAuctionListings,
  loadPersistedCharacters,
  characterSaveTime,
  mergeCharacterLists,
  loadFriends,
  saveFriends,
  randomPointInObject,
  getSpawnBounds,
  randomPointInBounds,
  numberProp,
  getSpawnPackId,
  getSpawnEnemyType,
  getSpawnMaxAlive,
  getSpawnRespawnMin,
  getSpawnRespawnMax,
  getSpawnRespawnDelay,
  ENEMY_KIND_STATS,
  BOSS_KIND_STATS,
  getEnemyKindStats,
  getBossKindStats,
  humanizeId,
  getEnemyKindName,
  getQuestGiverForMap,
  getQuestGiverNear,
  getWorldTransitionForQuest,
  getQuestObjectCenter,
  createKillQuestDefinition,
  createTravelQuestDefinition,
  hasCompletedStartingTravelQuest,
  createWorldKillQuest,
  getWorldQuestDefinitions,
  getStartingQuestDefinitions,
  isQuestCompleted,
  getActiveQuest,
  getQuestSnapshot,
  getAvailableQuestOffers,
  getTurnInQuestEntries,
  getMainQuest,
  getQuestProgressText,
  getEnemyQuestKillKinds,
  getQuestMarkerForMap,
  questMarkerIntersectsView,
  getQuestMarkerStyle,
  rollMobLoot,
  isDungeonEnemyKill,
  rollDungeonMobLoot,
  hashNumber,
  seededUnit,
  pointForSpawnSlot,
  getSpawnMovementMode,
  clampPointToBounds,
  buildPatrolPoints,
  makeEnemyMovementState,
  getEnemySeparationVector,
  getReadyRespawnSlots,
  updateIdleEnemyMovement,
  resetEnemyAggro,
  createWorldSpawnPacks,
  scheduleWorldSpawnRespawn,
  getRaceStartPosition,
  getCharacterStartPosition,
  getGraveyardPosition,
  createEnemy,
  createBoss,
  getDefaultAppearance,
  getMergedDefaultAppearance,
  getNpcDisplayName,
  getNpcRole,
  isTamziaInteriorNpc,
  getTamziaNpcPalette,
  pickSpawn,
  abilityHitsEnemyClient,
  selectChainEnemyTargetList,
  selectChainEnemyTargets,
  getShopkeeperFromMap,
  getNpcCenter,
  normalizeServiceNpc,
  isServiceNpc,
  getNpcInteriorId,
  isNpcVisibleForInterior,
  getNearbyServiceNpc,
  normalizeInteriorId,
  getInteriorZoneId,
  isCaveEntranceZone,
  isCaveInteriorZone,
  getCaveInteriorZone,
  getCaveEntranceZones,
  getCaveEntranceZone,
  isPointInCaveInteriorSpace,
  getOpenInteriorZone,
  getObjectCenter,
  getObjectPosition,
  pointInObject,
  getTransition,
  getCharacterRaceId,
  getTransitionRawTarget,
  normalizeTransitionTargetKey,
  getMapIdFromTransitionTarget,
  getTransitionTargetMapId,
  getTransitionType,
  isStartingZoneWorldExit,
  getTransitionTargetSpawnName,
  findSpawnObject,
  getNearestGraveyardPosition,
  hasFinalBossAlive,
  DUNGEON_01_REQUIRED_LEVEL,
  getDungeonEntryError,
  getStartingZoneExitError,
  findWorldV2RegistryTarget,
};
