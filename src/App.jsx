import React from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  Backpack,
  BookOpen,
  Crown,
  DoorOpen,
  Hammer,
  LogOut,
  Map as MapIcon,
  Monitor,
  Settings,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  deleteCloudCharacter,
  loadAllCloudCharactersForAdmin,
  loadCloudCharacters,
  saveCloudCharacter,
} from './characterCloud';
import { getColyseusUrl, joinWorldRoom } from './colyseusGameClient';
import { auth, hasFirebaseConfig } from './firebaseClient';
import { getAbilityIconStyle, getAbilityVisualConfig } from './abilityVisuals';
import {
  clamp,
  isFinitePoint,
  safeNumber,
  safePoint,
} from './game/math';
import {
  MAGE_CAST_DURATION_MS,
  MAGE_WAND_RELEASE_DELAY_MS,
} from './game/mageStaffGeometry';
import {
  OFFLINE_DEMO,
  OFFLINE_USER,
  WORLD,
  RESOLUTION_OPTIONS,
  WORLD_V2_REGION_PIXEL_SIZE,
  WORLD_V2_ACTIVE_CHUNK_RADIUS,
  WORLD_V2_PRELOAD_CHUNK_RADIUS,
  WORLD_V3_HUB_MAP_ID,
  WORLD_V3_AFTER_STARTING_SPAWN_NAME,
  WORLD_V3_HUB_ARRIVAL,
  WORLD_MAP_VERSION,
  WORLD_MAP_BIOME_COLORS,
  normalizeMapId,
  isWorldLikeMap,
  isWorldV2Map,
  getWorldGenerationIdFromMapId,
  getWorldGenerationConfig,
  isStartingMapId,
  getRandomWorldV2MapId,
  getWorldV2RegionCoordsFromMapId,
  getWorldV2MapIdFromPoint,
  getWorldV2ChunkCacheKey,
  formatWorldGenerationLabel,
  getWorldV2ChunkIdsAround,
  getWorldV2RegionOffset,
  normalizeWorldV2PositionForMap,
  getGameplayMapSpaceId,
  getRaceStartMapId,
  getCharacterTargetMapId,
  formatZoneDisplayName,
  getZoneId,
  getZoneBiomeId,
  getZoneDescription,
  getZoneLevelLabel,
  isPointInsideZone,
  zoneIntersectsView,
  createRegistryZone,
  dedupeZones,
  zoneViewFor,
} from './game/world';
import {
  PLAYER,
  ENEMY,
  REMEMBER_LOGIN_KEY,
  ADMIN_EMAILS,
  MAX_LEVEL,
  ENEMY_XP,
  BOSS_RESPAWN_DELAY,
  COLYSEUS_INPUT_MS,
  COLYSEUS_RECONNECT_MS,
  COLYSEUS_MAX_RECONNECT_ATTEMPTS,
  REMOTE_PLAYER_LEAD_MS,
  REMOTE_PLAYER_SMOOTHING,
  REMOTE_PLAYER_SNAP_DISTANCE,
  AUTO_ATTACK_MIN_COOLDOWN_MS,
  AUTO_ATTACK_MAX_COOLDOWN_MS,
  CHANNEL_MAX_DURATION_MS,
  BASE_STATS,
  STAT_DESCRIPTIONS,
  INVENTORY_CAPACITY,
  RECALL_CAST_MS,
  POTION_COOLDOWN_MS,
  BANK_CAPACITY,
  CITY_VENDOR_STOCK,
  PROFESSIONS,
  PROFESSION_BY_ID,
  ABILITY_BAR_SLOTS,
  TALENT_UNLOCK_LEVEL,
  HUNTER_PET,
  EQUIPMENT_SLOTS,
  STAT_GROWTH,
  getAbilityTickRateMs,
  shouldEffectFollowCaster,
  TALENTS,
  TALENT_BRANCHES,
  CLASSES,
  SHOW_MAP_ENEMY_DOTS,
  MAP_CANVAS_REDRAW_MS,
  WORLD_BOSS_MECHANICS,
  TREES,
  ROCKS,
  NPCS,
} from './game/gameData';
import {
  sanitizeEffect,
  abilityNetworkPayload,
  attachAbilityVisual,
  sanitizeEnemy,
  sanitizeWorldPlayer,
  sanitizeOnlinePlayer,
  samePartyMembers,
  sameOnlinePlayers,
  distance,
  getMovementStateFromDisplacement,
  lerpAngle,
  xpForLevel,
  getAbilityId,
  resolveAbility,
  getDefaultAbilitySlots,
  getFinalAbilityForCharacter,
  getTalentRanks,
  getTalentNodeKey,
  getEarnedTalentPoints,
  getSpentTalentPoints,
  getAvailableTalentPoints,
  getTalentNodesForSpec,
  getSpecSpentPoints,
  getTalentNodeDescription,
  getCharacterAbilities,
  WARRIOR_FURY_PER_ATTACK,
  ROGUE_ENERGY_REGEN_PER_SECOND,
  PARTY_INVITE_COOLDOWN_MS,
  getAbilityManaCost,
  getAbilityCooldownMs,
  getResourceConfig,
  getCurrentResource,
  getResourceMax,
  getAutoAttackCooldownMs,
  getAutoAttackAbility,
  mitigateDamageWithCombatBuffs,
  getCombatDamageMultiplier,
  abilityDealsDamage,
  getAbilityDamageAgainstEnemy,
  applyAbilityDebuffsClient,
  enrichAbilityForCast,
  getEffectiveAbilityResourceCost,
  getEffectiveAbilityCooldownMs,
  getCombatHealingMultiplier,
  getInitialStats,
  addStats,
  formatItemStats,
  getItemComparison,
  getItemStatDiffGroups,
  getInventoryItemTooltip,
  getItemSellValue,
  getEquippedItems,
  getTotalStats,
  isPotionItem,
  isEquipmentItem,
  getItemQuantity,
  getMaxDurability,
  isItemBroken,
  formatDurability,
  createItemInstance,
  normalizeInventoryItem,
  normalizeInventory,
  getBagCount,
  addInventoryItemStack,
  applyDeathDurabilityDamage,
  getRepairCost,
  getRepairAllCost,
  getScaledQuestXpReward,
  normalizeQuestState,
  rollBossLoot,
  rollDungeonBossLoot,
  getInitialBossSpawnAt,
} from './game/characterLogic';
import {
  hasTileData,
  loadImage,
  loadCharacterSprites,
  loadEnemySprites,
  loadPetSprites,
  normalizeEnemyKind,
  loadTiledMap,
  loadWorldV2ChunkIndex,
  loadWorldV2Registry,
  loadWorldV2ChunkMap,
  createWorldV2ChunkComposite,
  resolveAssetUrl,
} from './game/mapAssets';
import {
  clearForcedPhase,
  getDayNightDebugState,
  getLightingForPhase,
  setForcedPhase,
  setTimeSpeed,
} from './systems/dayNightSystem';
import {
  clearForcedWeather,
  getPrecipitationState,
  getWeatherDebugState,
  getWeatherLightingModifier,
  setForcedWeather,
  setWeatherSpeed,
} from './systems/weatherSystem';
import {
  normalizeCharacter,
  normalizeName,
  isNameTaken,
  ensureUniqueCharacterNames,
  loadCharacters,
  saveCharacters,
  loadAuctionListings,
  saveAuctionListings,
  loadPersistedCharacters,
  mergeCharacterLists,
  loadFriends,
  saveFriends,
  getQuestGiverForMap,
  getQuestGiverNear,
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
  getReadyRespawnSlots,
  getEnemySeparationVector,
  updateIdleEnemyMovement,
  resetEnemyAggro,
  createWorldSpawnPacks,
  scheduleWorldSpawnRespawn,
  getRaceStartPosition,
  getCharacterStartPosition,
  createEnemy,
  createBoss,
  getSpawnPackId,
  isTamziaInteriorNpc,
  pickSpawn,
  abilityHitsEnemyClient,
  selectChainEnemyTargetList,
  selectChainEnemyTargets,
  getShopkeeperFromMap,
  normalizeServiceNpc,
  isServiceNpc,
  isNpcVisibleForInterior,
  getNearbyServiceNpc,
  normalizeInteriorId,
  getInteriorZoneId,
  getCaveInteriorZone,
  getCaveEntranceZones,
  getCaveEntranceZone,
  isPointInCaveInteriorSpace,
  getOpenInteriorZone,
  getObjectPosition,
  pointInObject,
  getTransitionRawTarget,
  normalizeTransitionTargetKey,
  getTransitionTargetMapId,
  getTransitionType,
  isStartingZoneWorldExit,
  getTransitionTargetSpawnName,
  findSpawnObject,
  getNearestGraveyardPosition,
  hasFinalBossAlive,
  getDungeonEntryError,
  getStartingZoneExitError,
  findWorldV2RegistryTarget,
} from './game/worldEntities';
import { usePressedKeys } from './hooks/usePressedKeys';
import {
  isRangedClass,
  hasHunterPet,
  CLASS_SPRITE_DETAILS,
  drawPlayer,
  drawLocalPlayerMarker,
  drawRemotePlayerMarker,
  drawSelectedPlayerRing,
  drawHunterPet,
  drawEnemy,
  preloadAbilityVisual,
  drawPixelAbilityEffect,
  drawTiledWorld,
  drawStreetLamps,
  drawTamziaFountains,
  drawInteriorFocusOverlay,
  getTiledWorldPixelWidth,
  getTiledWorldPixelHeight,
  canMoveTo,
  findOpenPointNear,
  moveEnemyWithCollision,
  drawQuestGiverAt,
  drawShopkeeperAt,
  drawWantedBoardAt,
  drawTamziaNpcAt,
} from './rendering/canvasRendering';
import { AuthGate } from './components/AuthGate';
import { CharacterMenu } from './components/CharacterMenu';
import { describeAbility, getAbilityIconLabel, getItemIconLabel } from './uiFormatters';

const WORLD_MAP_INITIAL_ZOOM = 4;
const WORLD_MAP_MAX_ZOOM = 10;
const WORLD_MAP_REGISTRY_TILE_SCALE = 4;
const WORLD_MAP_FALLBACK_COLOR = '#4c8547';
const WORLD_MAP_OVERVIEW_VERSION = 'v4-continent-01-overview-4';
const DAY_NIGHT_PHASES = ['auto', 'dawn', 'day', 'evening', 'night'];
const DAY_NIGHT_SPEEDS = [1, 10, 60, 300];
const WEATHER_PHASES = ['auto', 'clear', 'cloudy', 'rain', 'storm'];
const WEATHER_SPEEDS = [1, 10, 60, 300];
const LOCAL_ENEMY_LEASH_GRACE_MS = 4200;
const LOCAL_ENEMY_LEASH_DISTANCE = 760;
const LOCAL_BOSS_LEASH_DISTANCE = 980;
const LOCAL_ENEMY_ATTACK_ANIMATION_MS = 420;
const LOCAL_ENEMY_ATTACK_IMPACT_MS = 210;

function getLocalWorldBossMechanicConfig(enemy) {
  const kind = normalizeEnemyKind(enemy?.bossType ?? enemy?.enemyKind ?? enemy?.spriteId ?? enemy?.name);
  return WORLD_BOSS_MECHANICS[kind] ?? null;
}

function getActiveLocalWorldBossMechanicConfig(mechanicConfig, mechanicType) {
  if (!mechanicConfig || !mechanicType) return null;
  if (mechanicConfig.type === mechanicType) return mechanicConfig;
  return mechanicConfig.secondary?.type === mechanicType ? mechanicConfig.secondary : null;
}

function createLocalBossProjectilePattern(source, target, config, now) {
  const originX = safeNumber(source?.x, 0);
  const originY = safeNumber(source?.y, 0);
  const targetLeadSeconds = Math.max(0, safeNumber(config?.targetLeadMs, 0)) / 1000;
  const targetLeadMaxDistance = Math.max(0, safeNumber(config?.targetLeadMaxDistance, 0));
  const rawLeadX = safeNumber(target?.vx, 0) * targetLeadSeconds;
  const rawLeadY = safeNumber(target?.vy, 0) * targetLeadSeconds;
  const rawLeadDistance = Math.hypot(rawLeadX, rawLeadY);
  const leadScale = rawLeadDistance > targetLeadMaxDistance && rawLeadDistance > 0
    ? targetLeadMaxDistance / rawLeadDistance
    : 1;
  const targetX = safeNumber(target?.x, originX + 1) + rawLeadX * leadScale;
  const targetY = safeNumber(target?.y, originY) + rawLeadY * leadScale;
  const baseAngle = Math.atan2(targetY - originY, targetX - originX);
  const targetDistance = Math.hypot(targetX - originX, targetY - originY);
  const maxTravelDistance = Math.max(96, safeNumber(config?.maxTravelDistance, config?.activationRange ?? 720));
  const travelDistance = clamp(targetDistance, 96, maxTravelDistance);
  const projectileSpeed = Math.max(80, safeNumber(config?.projectileSpeed, 420));
  const projectileCountMin = clamp(Math.floor(safeNumber(config?.projectileCountMin, config?.projectileCount ?? 1)), 1, 7);
  const projectileCountMax = clamp(Math.floor(safeNumber(config?.projectileCountMax, projectileCountMin)), projectileCountMin, 7);
  const projectileCount = projectileCountMin + Math.floor(Math.random() * (projectileCountMax - projectileCountMin + 1));
  const projectileSpread = safeNumber(config?.projectileSpread, 0);
  const launchAt = now + Math.max(0, safeNumber(config?.telegraphDuration, config?.launchDelay ?? 0));

  return Array.from({ length: projectileCount }, (_, index) => {
    const offset = index - (projectileCount - 1) / 2;
    const angle = baseAngle + offset * projectileSpread;
    const projectileTargetX = originX + Math.cos(angle) * travelDistance;
    const projectileTargetY = originY + Math.sin(angle) * travelDistance;
    return {
      id: `${String(config?.type ?? 'projectile')}-${index}`,
      type: String(config?.type ?? 'projectile'),
      originX,
      originY,
      targetX: projectileTargetX,
      targetY: projectileTargetY,
      launchAt,
      impactAt: launchAt + (travelDistance / projectileSpeed) * 1000,
      radius: Math.max(4, safeNumber(config?.projectileRadius, 18)),
    };
  });
}

function getLocalBossProjectilePoint(projectile, at) {
  const launchAt = safeNumber(projectile?.launchAt, 0);
  const impactAt = Math.max(launchAt + 1, safeNumber(projectile?.impactAt, launchAt + 1));
  const progress = clamp((at - launchAt) / (impactAt - launchAt), 0, 1);
  return {
    x: safeNumber(projectile?.originX, 0) + (safeNumber(projectile?.targetX, 0) - safeNumber(projectile?.originX, 0)) * progress,
    y: safeNumber(projectile?.originY, 0) + (safeNumber(projectile?.targetY, 0) - safeNumber(projectile?.originY, 0)) * progress,
  };
}

function localBossProjectileSweptHit(projectile, target, previousTime, now, extraRadius = 0) {
  const launchAt = safeNumber(projectile?.launchAt, 0);
  const impactAt = safeNumber(projectile?.impactAt, launchAt);
  if (now < launchAt || previousTime > impactAt) return false;
  const from = getLocalBossProjectilePoint(projectile, Math.max(launchAt, Math.min(previousTime, impactAt)));
  const to = getLocalBossProjectilePoint(projectile, Math.max(launchAt, Math.min(now, impactAt)));
  const segmentX = to.x - from.x;
  const segmentY = to.y - from.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  const projection = segmentLengthSquared > 0
    ? clamp(((safeNumber(target?.x, 0) - from.x) * segmentX + (safeNumber(target?.y, 0) - from.y) * segmentY) / segmentLengthSquared, 0, 1)
    : 0;
  const closestX = from.x + segmentX * projection;
  const closestY = from.y + segmentY * projection;
  return Math.hypot(safeNumber(target?.x, 0) - closestX, safeNumber(target?.y, 0) - closestY)
    <= Math.max(4, safeNumber(projectile?.radius, 18)) + Math.max(0, extraRadius);
}
const NIGHT_LAMP_GLOW_PASS = {
  glowOnly: true,
  phaseFilter: 'night',
  radiusMultiplier: 1.18,
  intensityMultiplier: 1.08,
  alphaMultiplier: 0.7,
};

function colorChannelsToRgba(channels, alphaMultiplier = 1) {
  if (!Array.isArray(channels) || channels.length < 4) return null;
  const alpha = clamp(safeNumber(channels[3], 0) * alphaMultiplier, 0, 1);
  if (alpha <= 0) return null;
  const red = clamp(Math.round(safeNumber(channels[0], 0)), 0, 255);
  const green = clamp(Math.round(safeNumber(channels[1], 0)), 0, 255);
  const blue = clamp(Math.round(safeNumber(channels[2], 0)), 0, 255);
  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
}

function drawDayNightOverlay(context, width, height, lighting) {
  if (!context || !lighting) return;
  const overlay = colorChannelsToRgba(lighting.overlay);
  const accent = colorChannelsToRgba(lighting.accent);
  const brightness = safeNumber(lighting.brightnessMultiplier ?? lighting.brightness, 1);
  const saturation = safeNumber(lighting.saturationMultiplier ?? lighting.saturation, 1);
  const fogIntensity = clamp(safeNumber(lighting.fogIntensity, 0), 0, 1);
  if (!overlay && !accent && brightness === 1 && saturation === 1 && fogIntensity <= 0) return;

  context.save();
  context.globalCompositeOperation = 'source-over';
  if (saturation < 1) {
    const softness = clamp((1 - saturation) * 0.16, 0, 0.16);
    context.fillStyle = `rgba(176, 198, 218, ${softness.toFixed(3)})`;
    context.fillRect(0, 0, width, height);
  }
  if (brightness < 1) {
    const shade = clamp((1 - brightness) * 0.38, 0, 0.18);
    context.fillStyle = `rgba(9, 13, 22, ${shade.toFixed(3)})`;
    context.fillRect(0, 0, width, height);
  } else if (brightness > 1) {
    const lift = clamp((brightness - 1) * 0.12, 0, 0.08);
    context.fillStyle = `rgba(255, 246, 220, ${lift.toFixed(3)})`;
    context.fillRect(0, 0, width, height);
  }
  if (overlay) {
    context.fillStyle = overlay;
    context.fillRect(0, 0, width, height);
  }
  if (accent) {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, accent);
    gradient.addColorStop(0.58, colorChannelsToRgba(lighting.accent, 0.36) ?? 'rgba(255,255,255,0)');
    gradient.addColorStop(1, colorChannelsToRgba(lighting.accent, 0) ?? 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
  if (fogIntensity > 0) {
    const fogAlpha = clamp(fogIntensity * 0.18, 0, 0.18);
    context.globalCompositeOperation = 'screen';
    const verticalMist = context.createLinearGradient(0, 0, 0, height);
    verticalMist.addColorStop(0, `rgba(212, 229, 238, ${(fogAlpha * 0.95).toFixed(3)})`);
    verticalMist.addColorStop(0.45, `rgba(190, 213, 226, ${(fogAlpha * 0.45).toFixed(3)})`);
    verticalMist.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = verticalMist;
    context.fillRect(0, 0, width, height);

    const bandHeight = Math.max(54, height * 0.12);
    for (let index = 0; index < 3; index += 1) {
      const y = height * (0.2 + index * 0.22);
      const band = context.createLinearGradient(0, y - bandHeight, 0, y + bandHeight);
      band.addColorStop(0, 'rgba(255,255,255,0)');
      band.addColorStop(0.5, `rgba(214, 232, 238, ${(fogAlpha * (0.55 - index * 0.1)).toFixed(3)})`);
      band.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = band;
      context.fillRect(0, y - bandHeight, width, bandHeight * 2);
    }
  }
  context.restore();
}

function combineOverlayChannels(baseChannels, overlayColor, overlayAlpha) {
  const baseAlpha = clamp(safeNumber(baseChannels?.[3], 0), 0, 1);
  const topAlpha = clamp(safeNumber(overlayAlpha, 0), 0, 1);
  if (topAlpha <= 0) return [...(baseChannels ?? [255, 255, 255, 0])];
  if (baseAlpha <= 0) return [...overlayColor, topAlpha];

  const outAlpha = clamp(topAlpha + baseAlpha * (1 - topAlpha), 0, 1);
  const outColor = [0, 1, 2].map((index) => (
    (
      safeNumber(overlayColor?.[index], 255) * topAlpha
      + safeNumber(baseChannels?.[index], 255) * baseAlpha * (1 - topAlpha)
    ) / Math.max(0.001, outAlpha)
  ));
  return [...outColor, outAlpha];
}

function applyWeatherLightingModifier(lighting, weatherModifier) {
  if (!lighting || !weatherModifier) return lighting;
  const overlay = combineOverlayChannels(
    lighting.overlay,
    weatherModifier.overlayColor,
    weatherModifier.overlayAlpha,
  );
  const accent = combineOverlayChannels(
    lighting.accent,
    weatherModifier.accentColor,
    weatherModifier.accentAlpha,
  );
  const brightnessMultiplier = clamp(
    safeNumber(lighting.brightnessMultiplier ?? lighting.brightness, 1)
      * safeNumber(weatherModifier.brightnessMultiplier, 1),
    0.45,
    1.15,
  );
  const saturationMultiplier = clamp(
    safeNumber(lighting.saturationMultiplier ?? lighting.saturation, 1)
      * safeNumber(weatherModifier.saturationMultiplier, 1),
    0.45,
    1.2,
  );

  return {
    ...lighting,
    overlayColor: overlay.slice(0, 3),
    overlayAlpha: overlay[3],
    accentColor: accent.slice(0, 3),
    accentAlpha: accent[3],
    overlay,
    accent,
    brightness: brightnessMultiplier,
    brightnessMultiplier,
    saturation: saturationMultiplier,
    saturationMultiplier,
    fogIntensity: clamp(
      safeNumber(lighting.fogIntensity, 0) + safeNumber(weatherModifier.fogIntensity, 0),
      0,
      0.45,
    ),
    weather: weatherModifier,
  };
}

function weatherNoise(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function drawPixelRaindrop(context, x, y, length, slant, scale, alpha, tint = [174, 213, 233]) {
  const [red, green, blue] = tint;
  const steps = Math.max(3, Math.round(length / 3));
  const width = Math.max(1, Math.round(scale));
  for (let step = 0; step < steps; step += 1) {
    const progress = step / Math.max(1, steps - 1);
    const px = Math.round(x - slant * progress);
    const py = Math.round(y + length * progress);
    const segmentAlpha = alpha * (0.22 + progress * 0.58);
    context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${segmentAlpha.toFixed(3)})`;
    context.fillRect(px, py, width, Math.max(1, Math.round(scale * 1.8)));
  }

  const headX = Math.round(x - slant);
  const headY = Math.round(y + length);
  context.fillStyle = `rgba(218, 239, 248, ${(alpha * 0.86).toFixed(3)})`;
  context.fillRect(headX, headY, Math.max(1, width + 1), Math.max(1, Math.round(scale + 1)));
}

function drawRainSplash(context, x, y, size, alpha) {
  const pixel = Math.max(1, Math.round(size));
  context.fillStyle = `rgba(190, 225, 238, ${alpha.toFixed(3)})`;
  context.fillRect(Math.round(x), Math.round(y), pixel, pixel);
  context.fillStyle = `rgba(154, 200, 222, ${(alpha * 0.7).toFixed(3)})`;
  context.fillRect(Math.round(x - pixel * 3), Math.round(y + pixel), pixel * 2, pixel);
  context.fillRect(Math.round(x + pixel * 2), Math.round(y + pixel), pixel * 2, pixel);
  if (size > 1.2) {
    context.fillStyle = `rgba(220, 240, 248, ${(alpha * 0.45).toFixed(3)})`;
    context.fillRect(Math.round(x - pixel), Math.round(y - pixel * 2), pixel, pixel);
    context.fillRect(Math.round(x + pixel), Math.round(y - pixel), pixel, pixel);
  }
}

function drawWeatherEffects(context, width, height, precipitation, now = performance.now()) {
  if (!context || !precipitation?.active) return;
  const cloudCover = clamp(safeNumber(precipitation.cloudCover, 0), 0, 1);
  const rainIntensity = clamp(safeNumber(precipitation.rainIntensity, 0), 0, 1);
  const stormIntensity = clamp(safeNumber(precipitation.stormIntensity, 0), 0, 1);
  const windIntensity = clamp(safeNumber(precipitation.windIntensity, 0), 0, 1);

  if (cloudCover > 0.04) {
    context.save();
    context.globalCompositeOperation = 'source-over';
    const drift = (now * (0.006 + windIntensity * 0.018)) % Math.max(1, height * 0.7);
    for (let index = 0; index < 3; index += 1) {
      const bandHeight = Math.max(86, height * (0.12 + index * 0.025));
      const y = ((index * height * 0.33 + drift) % (height + bandHeight * 2)) - bandHeight;
      const alpha = cloudCover * (0.025 + stormIntensity * 0.018) * (1 - index * 0.16);
      const band = context.createLinearGradient(0, y - bandHeight, 0, y + bandHeight);
      band.addColorStop(0, 'rgba(16, 24, 34, 0)');
      band.addColorStop(0.5, `rgba(16, 24, 34, ${alpha.toFixed(3)})`);
      band.addColorStop(1, 'rgba(16, 24, 34, 0)');
      context.fillStyle = band;
      context.fillRect(0, y - bandHeight, width, bandHeight * 2);
    }
    context.restore();
  }

  if (rainIntensity > 0.04) {
    context.save();
    context.globalCompositeOperation = 'screen';

    context.fillStyle = `rgba(119, 160, 184, ${(0.036 * rainIntensity).toFixed(3)})`;
    context.fillRect(0, 0, width, height);

    const density = (width * height) / 9500;
    const farCount = Math.floor(density * (0.85 + rainIntensity * 1.05));
    const mainCount = Math.floor(density * (0.72 + rainIntensity * 1.18));
    const nearCount = Math.floor(density * (0.18 + rainIntensity * 0.22 + stormIntensity * 0.34));
    const fallSpeed = 0.42 + rainIntensity * 0.42 + windIntensity * 0.22;
    const slant = 2.5 + windIntensity * 8 + stormIntensity * 4;

    for (let index = 0; index < farCount; index += 1) {
      const seed = index * 5;
      const baseX = weatherNoise(seed + 1) * (width + 100) - 50;
      const baseY = weatherNoise(seed + 2) * (height + 90) - 45;
      const y = (baseY + now * fallSpeed * 0.72 + index * 13) % (height + 90) - 45;
      const x = (baseX + now * windIntensity * 0.04 + y * windIntensity * 0.045) % (width + 100) - 50;
      const alpha = clamp(0.08 + rainIntensity * 0.09 + weatherNoise(seed + 3) * 0.045, 0.055, 0.22);
      context.fillStyle = `rgba(156, 196, 218, ${alpha.toFixed(3)})`;
      context.fillRect(Math.round(x), Math.round(y), 1, 2 + Math.round(weatherNoise(seed + 4) * 2));
    }

    for (let index = 0; index < mainCount; index += 1) {
      const seed = index * 7 + 1000;
      const baseX = weatherNoise(seed + 1) * (width + 140) - 70;
      const baseY = weatherNoise(seed + 2) * (height + 130) - 65;
      const y = (baseY + now * fallSpeed + index * 17) % (height + 130) - 65;
      const x = (baseX + now * windIntensity * 0.07 + y * windIntensity * 0.065) % (width + 140) - 70;
      const length = 9 + rainIntensity * 8 + weatherNoise(seed + 3) * 6 + stormIntensity * 4;
      const alpha = clamp(0.19 + rainIntensity * 0.22 + stormIntensity * 0.11 + weatherNoise(seed + 4) * 0.07, 0.15, 0.58);
      drawPixelRaindrop(context, x, y, length, slant, 1.18, alpha, [188, 224, 240]);
    }

    for (let index = 0; index < nearCount; index += 1) {
      const seed = index * 11 + 3000;
      const baseX = weatherNoise(seed + 1) * (width + 180) - 90;
      const baseY = weatherNoise(seed + 2) * (height + 160) - 80;
      const y = (baseY + now * fallSpeed * 1.16 + index * 23) % (height + 160) - 80;
      const x = (baseX + now * windIntensity * 0.1 + y * windIntensity * 0.085) % (width + 180) - 90;
      const length = 15 + rainIntensity * 10 + stormIntensity * 9 + weatherNoise(seed + 3) * 7;
      const alpha = clamp(0.27 + rainIntensity * 0.24 + stormIntensity * 0.17 + weatherNoise(seed + 4) * 0.08, 0.2, 0.72);
      drawPixelRaindrop(context, x, y, length, slant * 1.25, 1.75, alpha, [207, 236, 248]);
    }

    const splashCount = Math.floor(density * (0.26 + rainIntensity * 0.5 + stormIntensity * 0.22));
    for (let index = 0; index < splashCount; index += 1) {
      const seed = index * 13 + 7000;
      const cycle = (now * (0.0016 + rainIntensity * 0.0012) + weatherNoise(seed + 1)) % 1;
      if (cycle > 0.26) continue;
      const x = weatherNoise(seed + 2) * width;
      const y = height * (0.43 + weatherNoise(seed + 3) * 0.52);
      const alpha = clamp((1 - cycle / 0.26) * (0.18 + rainIntensity * 0.2 + stormIntensity * 0.1), 0, 0.44);
      drawRainSplash(context, x, y, 1 + stormIntensity * 0.8, alpha);
    }
    context.restore();
  }

  const lightningFlash = clamp(safeNumber(precipitation.lightningFlash, 0), 0, 1);
  if (lightningFlash > 0.01) {
    context.save();
    context.globalCompositeOperation = 'screen';
    context.fillStyle = `rgba(196, 220, 255, ${(0.22 * lightningFlash).toFixed(3)})`;
    context.fillRect(0, 0, width, height);
    context.fillStyle = `rgba(255, 255, 255, ${(0.08 * lightningFlash).toFixed(3)})`;
    context.fillRect(0, 0, width, height);
    context.restore();
  }
}

export default function App() {
  const canvasRef = React.useRef(null);
  const minimapCanvasRef = React.useRef(null);
  const worldMapCanvasRef = React.useRef(null);
  const keys = usePressedKeys();
  const player = React.useRef({ x: 420, y: 420, facing: 0 });
  const hunterPetRef = React.useRef({ x: 420, y: 452, facing: 0, walk: 0, nextAttackAt: 0, targetEnemyId: null });
  const forcedMoveRef = React.useRef(null);
  const hostileSlowEffectsRef = React.useRef([]);
  const lastSafePlayerPositionRef = React.useRef({ x: 420, y: 420, facing: 0 });
  const camera = React.useRef({ x: 0, y: 0 });
  const mouse = React.useRef({ x: 420, y: 420, screenX: 0, screenY: 0 });
  const tiledWorld = React.useRef(null);
  const currentMapIdRef = React.useRef('world');
  const effects = React.useRef([]);
  const enemies = React.useRef([]);
  const nextEnemyId = React.useRef(1);
  const nextSpawnAt = React.useRef(0);
  const nextBossSpawnAt = React.useRef(0);
  const worldSpawnPacks = React.useRef(new globalThis.Map());
  const mapCanvasDrawRef = React.useRef({ minimap: 0, world: 0 });
  const mapOverviewCacheRef = React.useRef({ key: null, canvas: null });
  const worldMapOverviewImageRef = React.useRef(null);
  const worldMapDragRef = React.useRef(null);
  const suppressWorldMapClickRef = React.useRef(false);
  const cooldowns = React.useRef({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const potionCooldownUntilRef = React.useRef(0);
  const abilitySlotsRef = React.useRef(Array(ABILITY_BAR_SLOTS).fill(null));
  const selectedClassRef = React.useRef(null);
  const selectedRaceRef = React.useRef(null);
  const characterRef = React.useRef(null);
  const charactersRef = React.useRef([]);
  const lastRenderStatusAt = React.useRef(0);
  const vitalsRef = React.useRef({ hp: BASE_STATS.health, mana: BASE_STATS.mana, fury: 0, energy: 100 });
  const deadRef = React.useRef(false);
  const shopOpenRef = React.useRef(false);
  const openUiRef = React.useRef({});
  const lastCombatAt = React.useRef(0);
  const authFlowRef = React.useRef(null);
  const authUserRef = React.useRef(null);
  const explicitLogoutRef = React.useRef(false);
  const rememberLoginRef = React.useRef(false);
  const accountSessionClosedRef = React.useRef(false);
  const colyseusRoomRef = React.useRef(null);
  const colyseusSessionIdRef = React.useRef(null);
  const remotePlayersRef = React.useRef([]);
  const onlinePlayersRef = React.useRef([]);
  const partyMembersRef = React.useRef([]);
  const displayedRemotePlayersRef = React.useRef([]);
  const remoteAttackStatesRef = React.useRef(new globalThis.Map());
  const partyInviteCooldownsRef = React.useRef(new globalThis.Map());
  const selectedPlayerIdRef = React.useRef(null);
  const lastColyseusInputAt = React.useRef(0);
  const mapTransitioningRef = React.useRef(false);
  const dungeonConfirmOpenRef = React.useRef(false);
  const dungeonEntranceConfirmCooldownRef = React.useRef(0);
  const activeCaveInteriorIdRef = React.useRef(null);
  const lastCaveEntranceKeyRef = React.useRef(null);
  const caveInteriorTransitionCooldownRef = React.useRef(0);
  const worldV2ChunkCacheRef = React.useRef(new globalThis.Map());
  const worldV2ChunkLoadRef = React.useRef(new globalThis.Map());
  const worldV2StreamingRef = React.useRef(false);
  const worldV2LoadedRegionKeyRef = React.useRef('');
  const worldV2PreloadKeyRef = React.useRef('');
  const lastPositionSaveRef = React.useRef({ at: 0, x: player.current.x, y: player.current.y, mapId: 'world' });
  const lastTransitionWarningAtRef = React.useRef(0);
  const lastPositionRenderRef = React.useRef({ at: 0, x: player.current.x, y: player.current.y });
  const nextAutoAttackAt = React.useRef(0);
  const autoAttackHeld = React.useRef(false);
  const combatEnemyIdsRef = React.useRef(new Set());
  const locallyDefeatedEnemyIdsRef = React.useRef(new globalThis.Map());
  const shiftHeldRef = React.useRef(false);
  const questDialogGiverIdRef = React.useRef(null);
  const combatBuffsRef = React.useRef({
    autoEmpowerUntil: 0,
    autoDamageMultiplier: 1,
    strikeDamageMultiplier: 1,
    damageFormUntil: 0,
    damageMultiplier: 1,
    leechPercent: 0,
    shieldAbsorb: 0,
    shieldUntil: 0,
    damageReductionUntil: 0,
    damageReduction: 0,
    regenUntil: 0,
    regenPerSecond: 0,
    invulnerableUntil: 0,
    noCooldownUntil: 0,
    noManaCostUntil: 0,
    noEnergyCostUntil: 0,
    cooldownMultiplierUntil: 0,
    cooldownMultiplier: 1,
    manaRegenUntil: 0,
    manaRegenPerSecond: 0,
    furyRegenUntil: 0,
    furyRegenPerSecond: 0,
    attackSpeedUntil: 0,
    attackSpeedMultiplier: 1,
    petAttackSpeedUntil: 0,
    petAttackSpeedMultiplier: 1,
    petBleedDamage: 0,
    petBleedDuration: 0,
    burnWindowUntil: 0,
    burnDamage: 0,
    burnDuration: 0,
    burnTickRate: 1000,
    burnStacking: true,
    rootSelfUntil: 0,
    maxHealthMultiplierUntil: 0,
    maxHealthMultiplier: 1,
    autoCombatBoltUntil: 0,
    autoBoltName: null,
    autoBoltDamage: 0,
    autoBoltInterval: 1000,
    autoBoltCombatOnly: true,
    autoBoltTargetId: null,
    nextAutoCombatBoltAt: 0,
    healingFormUntil: 0,
    healingMultiplier: 1,
    invisibleUntil: 0,
    stealthDamageUntil: 0,
    stealthDamageMultiplier: 1.35,
    poisonBladeUntil: 0,
    poisonDamage: 9,
    poisonDuration: 5000,
    poisonTickRate: 1000,
  });
  const rightClickCooldownRef = React.useRef(0);
  const [characters, setCharacters] = React.useState(() => loadCharacters());
  const [character, setCharacter] = React.useState(null);
  const [position, setPosition] = React.useState(player.current);
  const [vitals, setVitals] = React.useState(vitalsRef.current);
  const [isDead, setIsDead] = React.useState(false);
  const [enemyCount, setEnemyCount] = React.useState(0);
  const [lastCast, setLastCast] = React.useState(null);
  const [inventoryOpen, setInventoryOpen] = React.useState(false);
  const [shopOpen, setShopOpen] = React.useState(false);
  const [bankOpen, setBankOpen] = React.useState(false);
  const [auctionOpen, setAuctionOpen] = React.useState(false);
  const [repairOpen, setRepairOpen] = React.useState(false);
  const [professionOpen, setProfessionOpen] = React.useState(false);
  const [professionPanelOpen, setProfessionPanelOpen] = React.useState(false);
  const [activeServiceNpcId, setActiveServiceNpcId] = React.useState(null);
  const [inventoryTab, setInventoryTab] = React.useState('gear');
  const [auctionListings, setAuctionListings] = React.useState(() => loadAuctionListings());
  const [auctionPriceByItemId, setAuctionPriceByItemId] = React.useState({});
  const [potionCooldownUntil, setPotionCooldownUntil] = React.useState(0);
  const [talentsOpen, setTalentsOpen] = React.useState(false);
  const [abilityBookOpen, setAbilityBookOpen] = React.useState(false);
  const [gameMenuOpen, setGameMenuOpen] = React.useState(false);
  const [dungeonConfirmOpen, setDungeonConfirmOpenState] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [selectedResolutionId, setSelectedResolutionId] = React.useState(() => {
    try {
      return localStorage.getItem('mmo-resolution') || '1280x720';
    } catch {
      return '1280x720';
    }
  });
  const [friendsOpen, setFriendsOpen] = React.useState(false);
  const [mapOpen, setMapOpen] = React.useState(false);
  const [worldMapMode, setWorldMapMode] = React.useState('world');
  const [selectedMapZoneId, setSelectedMapZoneId] = React.useState(null);
  const [worldV2Registry, setWorldV2Registry] = React.useState(null);
  const [worldMapZoom, setWorldMapZoom] = React.useState(1);
  const [worldMapCenter, setWorldMapCenter] = React.useState(null);
  const [worldMapWaypoint, setWorldMapWaypoint] = React.useState(null);
  const [worldMapOverviewReady, setWorldMapOverviewReady] = React.useState(false);
  const [worldMapDragging, setWorldMapDragging] = React.useState(false);
  const [journalOpen, setJournalOpen] = React.useState(false);
  const [questLogOpen, setQuestLogOpen] = React.useState(false);
  const [questDialogGiverId, setQuestDialogGiverId] = React.useState(null);
  const [selectedQuestDialogId, setSelectedQuestDialogId] = React.useState(null);
  const [friends, setFriends] = React.useState(() => loadFriends());
  const [friendNameInput, setFriendNameInput] = React.useState('');
  const [resurrectionCast, setResurrectionCast] = React.useState(null);
  const [shiftHeld, setShiftHeld] = React.useState(false);
  const [hoveredInventoryItemId, setHoveredInventoryItemId] = React.useState(null);
  const [draggedInventoryItemId, setDraggedInventoryItemId] = React.useState(null);
  const [destroyConfirmItemId, setDestroyConfirmItemId] = React.useState(null);
  const [recallCast, setRecallCast] = React.useState(null);
  const [mapStatus, setMapStatus] = React.useState('Loading map...');
  const [currentMapId, setCurrentMapId] = React.useState('world');
  const [authUser, setAuthUser] = React.useState(OFFLINE_DEMO ? OFFLINE_USER : null);
  const [rememberLogin, setRememberLogin] = React.useState(() => {
    try {
      return Boolean(JSON.parse(localStorage.getItem(REMEMBER_LOGIN_KEY) || 'null')?.remember);
    } catch {
      return false;
    }
  });
  const [authForm, setAuthForm] = React.useState(() => {
    try {
      const remembered = JSON.parse(localStorage.getItem(REMEMBER_LOGIN_KEY) || 'null');
      return { email: remembered?.remember ? remembered.email ?? '' : '', password: '' };
    } catch {
      return { email: '', password: '' };
    }
  });
  const [authMode, setAuthMode] = React.useState('login');
  const [authReady, setAuthReady] = React.useState(OFFLINE_DEMO || !hasFirebaseConfig);
  const [renderStatus, setRenderStatus] = React.useState('Render starting...');
  const [colyseusStatus, setColyseusStatus] = React.useState('Colyseus offline');
  const [selectedPlayerId, setSelectedPlayerId] = React.useState(null);
  const [partyInvite, setPartyInvite] = React.useState(null);
  const [partyMembers, setPartyMembers] = React.useState([]);
  const [onlinePlayers, setOnlinePlayers] = React.useState([]);
  const [adminPlayersOpen, setAdminPlayersOpen] = React.useState(false);
  const [adminPlayersView, setAdminPlayersView] = React.useState('online');
  const [adminCloudCharacters, setAdminCloudCharacters] = React.useState([]);
  const [adminOnlinePlayers, setAdminOnlinePlayers] = React.useState([]);
  const [adminPlayersStatus, setAdminPlayersStatus] = React.useState('Players not loaded');
  const [dayNightDebugState, setDayNightDebugState] = React.useState(() => getDayNightDebugState());
  const [weatherDebugState, setWeatherDebugState] = React.useState(() => getWeatherDebugState());
  const [abilitySlots, setAbilitySlots] = React.useState(Array(ABILITY_BAR_SLOTS).fill(null));
  const [spriteLoadVersion, setSpriteLoadVersion] = React.useState(0);
  const [authStatus, setAuthStatus] = React.useState(
    OFFLINE_DEMO ? 'Offline demo' : hasFirebaseConfig ? 'Login or create an account' : 'Firebase config missing',
  );

  selectedClassRef.current = character?.classId ?? null;
  selectedRaceRef.current = character?.raceId ?? null;
  characterRef.current = character;
  charactersRef.current = characters;
  authUserRef.current = authUser;
  rememberLoginRef.current = rememberLogin;
  deadRef.current = isDead;
  shopOpenRef.current = shopOpen;
  questDialogGiverIdRef.current = questDialogGiverId;
  selectedPlayerIdRef.current = selectedPlayerId;
  abilitySlotsRef.current = abilitySlots;
  partyMembersRef.current = partyMembers;
  const setDungeonConfirmOpen = React.useCallback((open) => {
    dungeonConfirmOpenRef.current = Boolean(open);
    setDungeonConfirmOpenState(Boolean(open));
  }, []);
  openUiRef.current = {
    inventoryOpen,
    shopOpen,
    bankOpen,
    auctionOpen,
    repairOpen,
    professionOpen,
    professionPanelOpen,
    talentsOpen,
    abilityBookOpen,
    gameMenuOpen,
    dungeonConfirmOpen,
    settingsOpen,
    friendsOpen,
    mapOpen,
    journalOpen,
    questLogOpen,
    questDialogGiverId,
    adminPlayersOpen,
    destroyConfirmItemId,
    draggedInventoryItemId,
    selectedPlayerId,
    partyInvite,
  };

  const setVitalsValue = (nextVitals) => {
    vitalsRef.current = {
      ...vitalsRef.current,
      ...nextVitals,
    };
    setVitals(vitalsRef.current);
  };

  const closeGameplayUiForEscape = () => {
    const openUi = openUiRef.current ?? {};
    let closed = false;

    if (openUi.destroyConfirmItemId) {
      setDestroyConfirmItemId(null);
      closed = true;
    }
    if (openUi.draggedInventoryItemId) {
      setDraggedInventoryItemId(null);
      closed = true;
    }
    if (openUi.partyInvite) {
      setPartyInvite(null);
      closed = true;
    }
    if (openUi.selectedPlayerId) {
      setSelectedPlayerId(null);
      closed = true;
    }
    if (openUi.questDialogGiverId) {
      questDialogGiverIdRef.current = null;
      setQuestDialogGiverId(null);
      setSelectedQuestDialogId(null);
      closed = true;
    }
    if (openUi.adminPlayersOpen) {
      setAdminPlayersOpen(false);
      closed = true;
    }
    if (openUi.settingsOpen) {
      setSettingsOpen(false);
      closed = true;
    }
    if (openUi.gameMenuOpen) {
      setGameMenuOpen(false);
      closed = true;
    }
    if (openUi.dungeonConfirmOpen) {
      setDungeonConfirmOpen(false);
      dungeonEntranceConfirmCooldownRef.current = performance.now() + 900;
      closed = true;
    }
    if (openUi.shopOpen) {
      setShopOpen(false);
      closed = true;
    }
    if (openUi.bankOpen) {
      setBankOpen(false);
      closed = true;
    }
    if (openUi.auctionOpen) {
      setAuctionOpen(false);
      closed = true;
    }
    if (openUi.repairOpen) {
      setRepairOpen(false);
      closed = true;
    }
    if (openUi.professionOpen) {
      setProfessionOpen(false);
      closed = true;
    }
    if (openUi.professionPanelOpen) {
      setProfessionPanelOpen(false);
      closed = true;
    }
    if (openUi.inventoryOpen) {
      setInventoryOpen(false);
      closed = true;
    }
    if (openUi.talentsOpen) {
      setTalentsOpen(false);
      closed = true;
    }
    if (openUi.abilityBookOpen) {
      setAbilityBookOpen(false);
      closed = true;
    }
    if (openUi.friendsOpen) {
      setFriendsOpen(false);
      closed = true;
    }
    if (openUi.mapOpen) {
      setMapOpen(false);
      closed = true;
    }
    if (openUi.journalOpen) {
      setJournalOpen(false);
      closed = true;
    }
    if (openUi.questLogOpen) {
      setQuestLogOpen(false);
      closed = true;
    }
    if (closed) {
      setActiveServiceNpcId(null);
    }

    return closed;
  };

  const focusWorldMapOnPlayer = React.useCallback((zoom = WORLD_MAP_INITIAL_ZOOM) => {
    const focusPoint = isFinitePoint(player.current) ? player.current : null;
    setWorldMapMode('world');
    setSelectedMapZoneId(null);
    setWorldMapZoom(clamp(zoom, 1, WORLD_MAP_MAX_ZOOM));
    setWorldMapCenter(isFinitePoint(focusPoint)
      ? {
        x: focusPoint.x,
        y: focusPoint.y,
      }
      : null);
    mapCanvasDrawRef.current.world = 0;
  }, []);

  const syncCloudCharacter = React.useCallback((updatedCharacter) => {
    const user = authUserRef.current;
    if (OFFLINE_DEMO || !user || user.localOnly) return;

    const characterToSave = {
      ...updatedCharacter,
      updatedAt: updatedCharacter.updatedAt ?? new Date().toISOString(),
    };
    saveCloudCharacter(user.uid, characterToSave, user.email ?? '').catch((error) => {
      setAuthStatus(`Cloud save failed: ${error.message}`);
    });
  }, []);

  const isAdmin = ADMIN_EMAILS.has(String(authUser?.email ?? '').trim().toLowerCase());

  const persistRememberLogin = React.useCallback((enabled, email = authForm.email) => {
    try {
      if (enabled) {
        localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({
          remember: true,
          email: String(email ?? '').trim(),
        }));
      } else {
        localStorage.removeItem(REMEMBER_LOGIN_KEY);
      }
    } catch {
      // Remember-login is a convenience only.
    }
  }, [authForm.email]);

  const updateRememberLogin = (enabled) => {
    rememberLoginRef.current = enabled;
    setRememberLogin(enabled);
    persistRememberLogin(enabled);
  };

  const updateAuthForm = (nextForm) => {
    setAuthForm(nextForm);
    if (rememberLoginRef.current) {
      persistRememberLogin(true, nextForm.email);
    }
  };

  const applyPersistedCharacters = React.useCallback((...characterLists) => {
    const currentCharacters = charactersRef.current;
    const mergedCharacters = mergeCharacterLists(currentCharacters, ...characterLists);
    const unique = ensureUniqueCharacterNames(mergedCharacters);
    if (unique.characters.length === 0) {
      return currentCharacters;
    }

    charactersRef.current = unique.characters;
    setCharacters(unique.characters);
    saveCharacters(unique.characters);
    return unique.characters;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    loadPersistedCharacters()
      .then((persistedCharacters) => {
        if (cancelled || !Array.isArray(persistedCharacters) || persistedCharacters.length === 0) return;
        applyPersistedCharacters(persistedCharacters);
        if (!authUserRef.current && !explicitLogoutRef.current) {
          setAuthUser(OFFLINE_USER);
          setAuthReady(true);
          setAuthStatus('Local saves active');
        }
      })
      .catch((error) => {
        console.warn('Initial character load failed', error);
      });
    return () => {
      cancelled = true;
    };
  }, [applyPersistedCharacters]);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([loadCharacterSprites(), loadEnemySprites(), loadPetSprites()]).finally(() => {
      if (!cancelled) setSpriteLoadVersion((version) => version + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!character || !isWorldV2Map(currentMapId)) return undefined;
    let cancelled = false;
    loadWorldV2Registry(getWorldGenerationIdFromMapId(currentMapId))
      .then((registry) => {
        if (!cancelled) setWorldV2Registry(registry);
      })
      .catch((error) => {
        if (!cancelled) setMapStatus(`World registry failed: ${error.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [character?.id, currentMapId]);

  React.useEffect(() => {
    if (OFFLINE_DEMO) return undefined;

    if (!auth) {
      setAuthReady(true);
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        const localCharacters = await loadPersistedCharacters();
        if (localCharacters.length > 0 && !explicitLogoutRef.current) {
          applyPersistedCharacters(localCharacters);
          setAuthUser(OFFLINE_USER);
          setAuthReady(true);
          setAuthStatus('Local saves active');
        } else {
          setAuthUser(null);
          setCharacter(null);
          setAuthReady(true);
          setAuthStatus('Login or create an account');
        }
        return;
      }

      if (!user.emailVerified) {
        if (authFlowRef.current) return;

        setAuthUser(null);
        setCharacter(null);
        setAuthReady(true);
        setAuthStatus('Verify your email before logging in');
        await signOut(auth);
        return;
      }

      explicitLogoutRef.current = false;
      setAuthUser(user);
      setAuthStatus('Loading cloud characters...');
      try {
        const localCharacters = await loadPersistedCharacters();
        const cloudCharacters = (await loadCloudCharacters(user.uid)).map(normalizeCharacter);
        applyPersistedCharacters(localCharacters, cloudCharacters);
        setAuthStatus(`Cloud save active: ${user.email}`);
      } catch (error) {
        setAuthStatus(`Cloud load failed: ${error.message}`);
      } finally {
        setAuthReady(true);
      }
    });
  }, [applyPersistedCharacters]);

  const submitAuth = async (mode) => {
    if (!auth) {
      setAuthStatus('Firebase config missing');
      return;
    }

    const email = authForm.email.trim();
    const password = authForm.password;
    if (!email || password.length < 6) {
      setAuthStatus('Email and 6+ character password required');
      return;
    }

    setAuthStatus(mode === 'register' ? 'Creating account...' : 'Logging in...');
    authFlowRef.current = mode;
    try {
      if (mode === 'register') {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setAuthMode('login');
        setAuthStatus('Verification email sent. Confirm it, then login.');
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        if (!credential.user.emailVerified) {
          await sendEmailVerification(credential.user);
          await signOut(auth);
          setAuthStatus('Email is not verified. We sent a new verification email.');
          return;
        }
        setAuthStatus(`Cloud save active: ${credential.user.email}`);
        persistRememberLogin(rememberLoginRef.current, email);
      }
      setAuthForm({ email: rememberLoginRef.current ? email : '', password: '' });
    } catch (error) {
      setAuthStatus(error.message);
    } finally {
      authFlowRef.current = null;
    }
  };

  const logoutAuth = async () => {
    explicitLogoutRef.current = true;
    setCharacter(null);
    setAuthUser(null);
    setAuthReady(true);
    setAuthStatus('Login or create an account');
    setGameMenuOpen(false);
    setInventoryOpen(false);
    setShopOpen(false);
    setTalentsOpen(false);
    setAbilityBookOpen(false);
    setQuestLogOpen(false);
    setSettingsOpen(false);
    setFriendsOpen(false);
    setMapOpen(false);
    setJournalOpen(false);
    setAdminPlayersOpen(false);
    setSelectedPlayerId(null);
    setPartyMembers([]);
    setOnlinePlayers([]);
    colyseusRoomRef.current?.leave();
    colyseusRoomRef.current = null;
    colyseusSessionIdRef.current = null;
    remotePlayersRef.current = [];
    displayedRemotePlayersRef.current = [];
    onlinePlayersRef.current = [];
    setColyseusStatus('Colyseus offline');

    if (OFFLINE_DEMO) {
      setAuthStatus('Offline demo');
      return;
    }

    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      setAuthStatus(`Logout failed: ${error.message}`);
    }
  };

  React.useEffect(() => {
    if (!lastCast) return undefined;
    const timer = window.setTimeout(() => setLastCast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [lastCast]);

  React.useEffect(() => {
    const syncWorldDebugState = () => {
      setDayNightDebugState(getDayNightDebugState());
      setWeatherDebugState(getWeatherDebugState());
    };
    syncWorldDebugState();
    const timer = window.setInterval(syncWorldDebugState, 500);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const debugTime = {
      setPhase: (phase) => {
        const result = setForcedPhase(phase);
        setDayNightDebugState(getDayNightDebugState());
        return result;
      },
      setSpeed: (multiplier) => {
        const result = setTimeSpeed(multiplier);
        setDayNightDebugState(getDayNightDebugState());
        return result;
      },
      clearOverride: () => {
        const result = clearForcedPhase();
        setDayNightDebugState(getDayNightDebugState());
        return result;
      },
      getState: getDayNightDebugState,
    };

    window.debugTime = debugTime;
    const debugWeather = {
      setWeather: (weather) => {
        const result = setForcedWeather(weather);
        setWeatherDebugState(getWeatherDebugState());
        return result;
      },
      setSpeed: (multiplier) => {
        const result = setWeatherSpeed(multiplier);
        setWeatherDebugState(getWeatherDebugState());
        return result;
      },
      clearOverride: () => {
        const result = clearForcedWeather();
        setWeatherDebugState(getWeatherDebugState());
        return result;
      },
      getState: getWeatherDebugState,
    };

    window.debugWeather = debugWeather;
    return () => {
      if (window.debugTime === debugTime) {
        delete window.debugTime;
      }
      if (window.debugWeather === debugWeather) {
        delete window.debugWeather;
      }
    };
  }, []);

  React.useEffect(() => {
    setWorldMapWaypoint(null);
    setSelectedMapZoneId(null);
    focusWorldMapOnPlayer(isWorldV2Map(currentMapId) ? WORLD_MAP_INITIAL_ZOOM : 1);
  }, [currentMapId, focusWorldMapOnPlayer]);

  React.useEffect(() => {
    let cancelled = false;
    loadImage(`${resolveAssetUrl('maps/world_map/continents/continent_01/continent_01_overview.png')}?v=${WORLD_MAP_OVERVIEW_VERSION}`)
      .then((image) => {
        if (cancelled) return;
        worldMapOverviewImageRef.current = image;
        setWorldMapOverviewReady(true);
        mapCanvasDrawRef.current.world = 0;
      })
      .catch((error) => {
        console.warn('World overview image failed to load', error);
        if (!cancelled) setWorldMapOverviewReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const updateShift = (event) => {
      const down = Boolean(event.shiftKey);
      shiftHeldRef.current = down;
      setShiftHeld(down);
    };
    const clearShift = () => {
      shiftHeldRef.current = false;
      setShiftHeld(false);
    };
    window.addEventListener('keydown', updateShift, true);
    window.addEventListener('keyup', updateShift, true);
    window.addEventListener('blur', clearShift);
    return () => {
      window.removeEventListener('keydown', updateShift, true);
      window.removeEventListener('keyup', updateShift, true);
      window.removeEventListener('blur', clearShift);
    };
  }, []);

  React.useEffect(() => {
    const blockBrowserNavigationInput = (event) => {
      const blockedNavigationKey = event.type === 'keydown'
        && ['BrowserBack', 'BrowserForward', 'GoBack', 'GoForward'].includes(event.key);
      if (blockedNavigationKey) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.type === 'keydown' && event.key === 'Escape' && characterRef.current) {
        event.preventDefault();
        event.stopPropagation();
        if (!window.mmoLauncher?.onGameEscape) {
          setGameMenuOpen((open) => !open);
        }
      }
      if ('button' in event && (event.button === 3 || event.button === 4)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockBrowserNavigationInput, true);
    window.addEventListener('mousedown', blockBrowserNavigationInput, true);
    window.addEventListener('mouseup', blockBrowserNavigationInput, true);
    window.addEventListener('auxclick', blockBrowserNavigationInput, true);
    return () => {
      window.removeEventListener('keydown', blockBrowserNavigationInput, true);
      window.removeEventListener('mousedown', blockBrowserNavigationInput, true);
      window.removeEventListener('mouseup', blockBrowserNavigationInput, true);
      window.removeEventListener('auxclick', blockBrowserNavigationInput, true);
    };
  }, []);

  React.useEffect(() => {
    const lockHistory = () => {
      try {
        window.history.pushState({ mmoGame: true }, document.title, window.location.href);
      } catch {
        // History can be unavailable in a few embedded launch modes.
      }
    };
    const blockHistoryBack = (event) => {
      event.preventDefault?.();
      lockHistory();
    };
    lockHistory();
    window.addEventListener('popstate', blockHistoryBack);
    return () => {
      window.removeEventListener('popstate', blockHistoryBack);
    };
  }, []);

  const loadWorldV2Chunk = React.useCallback(async (chunkId, generationId = 'v2') => {
    const generation = getWorldGenerationConfig(generationId);
    const cacheKey = getWorldV2ChunkCacheKey(chunkId, generation.id);
    const cached = worldV2ChunkCacheRef.current.get(cacheKey);
    if (cached) return cached;
    const activeLoad = worldV2ChunkLoadRef.current.get(cacheKey);
    if (activeLoad) return activeLoad;
    const loadPromise = loadWorldV2ChunkMap(chunkId, generation.id)
      .then((chunk) => {
        worldV2ChunkCacheRef.current.set(cacheKey, chunk);
        return chunk;
      })
      .finally(() => {
        worldV2ChunkLoadRef.current.delete(cacheKey);
      });
    worldV2ChunkLoadRef.current.set(cacheKey, loadPromise);
    return loadPromise;
  }, []);

  const preloadWorldV2ChunksAround = React.useCallback((point, radius = WORLD_V2_PRELOAD_CHUNK_RADIUS, generationId = 'v2') => {
    if (!isFinitePoint(point)) return;
    const generation = getWorldGenerationConfig(generationId);
    const preloadIds = getWorldV2ChunkIdsAround(point, radius);
    const preloadKey = `${generation.id}:${preloadIds.join('|')}`;
    if (worldV2PreloadKeyRef.current === preloadKey) return;
    worldV2PreloadKeyRef.current = preloadKey;
    preloadIds.forEach((chunkId) => {
      const cacheKey = getWorldV2ChunkCacheKey(chunkId, generation.id);
      if (worldV2ChunkCacheRef.current.has(cacheKey) || worldV2ChunkLoadRef.current.has(cacheKey)) return;
      loadWorldV2Chunk(chunkId, generation.id).catch((error) => {
        console.warn(`${formatWorldGenerationLabel(generation.id)} chunk preload failed: ${chunkId}`, error);
      });
    });
  }, [loadWorldV2Chunk]);

  const buildWorldV2CompositeAround = React.useCallback(async (positionOrNull = null, preferredMapId = null) => {
    const generationId = getWorldGenerationIdFromMapId(preferredMapId);
    const preferredCoords = getWorldV2RegionCoordsFromMapId(preferredMapId) ?? { regionX: 2, regionY: 2, generationId };
    const fallbackOffset = getWorldV2RegionOffset(preferredCoords);
    const centerPoint = isFinitePoint(positionOrNull)
      ? normalizeWorldV2PositionForMap(preferredMapId, positionOrNull)
      : {
          x: fallbackOffset.x + WORLD_V2_REGION_PIXEL_SIZE / 2,
          y: fallbackOffset.y + WORLD_V2_REGION_PIXEL_SIZE / 2,
        };
    const chunkIds = getWorldV2ChunkIdsAround(centerPoint, WORLD_V2_ACTIVE_CHUNK_RADIUS);
    const loadedChunks = await Promise.all(chunkIds.map((chunkId) => loadWorldV2Chunk(chunkId, generationId)));
    const chunkIndex = await loadWorldV2ChunkIndex(generationId);
    const centerMapId = getWorldV2MapIdFromPoint(centerPoint.x, centerPoint.y, generationId) ?? preferredMapId ?? `world_region_2_2_${generationId}`;
    worldV2LoadedRegionKeyRef.current = `${generationId}:${chunkIds.join('|')}`;
    preloadWorldV2ChunksAround(centerPoint, WORLD_V2_PRELOAD_CHUNK_RADIUS, generationId);
    return createWorldV2ChunkComposite(loadedChunks, centerMapId, chunkIndex.tilesets, generationId, chunkIndex);
  }, [loadWorldV2Chunk, preloadWorldV2ChunksAround]);

  const loadPlayableMap = React.useCallback(async (mapId, positionHint = null) => {
    const normalizedMapId = normalizeMapId(mapId);
    if (import.meta.env.DEV && isWorldV2Map(normalizedMapId)) {
      return loadTiledMap(normalizedMapId);
    }
    if (!isWorldV2Map(normalizedMapId)) return loadTiledMap(normalizedMapId);
    return buildWorldV2CompositeAround(positionHint, normalizedMapId);
  }, [buildWorldV2CompositeAround]);

  const ensureWorldV2StreamingForPosition = React.useCallback((point) => {
    if (import.meta.env.DEV) return;
    if (!isWorldV2Map(currentMapIdRef.current) || !isFinitePoint(point) || worldV2StreamingRef.current) return;
    const generationId = getWorldGenerationIdFromMapId(currentMapIdRef.current);
    const nextMapId = getWorldV2MapIdFromPoint(point.x, point.y, generationId);
    if (!nextMapId) return;
    if (nextMapId !== currentMapIdRef.current) {
      currentMapIdRef.current = nextMapId;
      setCurrentMapId(nextMapId);
    }

    preloadWorldV2ChunksAround(point, WORLD_V2_PRELOAD_CHUNK_RADIUS, generationId);
    const expectedChunkIds = getWorldV2ChunkIdsAround(point, WORLD_V2_ACTIVE_CHUNK_RADIUS);
    const expectedKey = `${generationId}:${expectedChunkIds.join('|')}`;
    if (tiledWorld.current?.isChunkWorld && worldV2LoadedRegionKeyRef.current === expectedKey) return;

    worldV2StreamingRef.current = true;
    buildWorldV2CompositeAround(point, nextMapId)
      .then((composite) => {
        if (!isWorldV2Map(currentMapIdRef.current)) return;
        tiledWorld.current = composite;
        currentMapIdRef.current = composite.mapId;
        setCurrentMapId(composite.mapId);
        worldSpawnPacks.current = createWorldSpawnPacks(isWorldLikeMap(composite.mapId) ? composite.enemySpawns : []);
        setMapStatus(`${formatWorldGenerationLabel(generationId)} chunk streaming: ${composite.loadedRegions.length} chunks active`);
      })
      .catch((error) => {
        console.error(error);
        setMapStatus(`${formatWorldGenerationLabel(generationId)} streaming failed: ${error.message}`);
      })
      .finally(() => {
        worldV2StreamingRef.current = false;
      });
  }, [buildWorldV2CompositeAround, preloadWorldV2ChunksAround]);

  const enterCharacter = async (nextCharacter) => {
    const playableCharacter = normalizeCharacter(nextCharacter);
    const targetMapId = getCharacterTargetMapId(playableCharacter);
    const positionHint = normalizeWorldV2PositionForMap(targetMapId, playableCharacter?.position);
    let loadedMap = tiledWorld.current;
    if (!loadedMap || normalizeMapId(loadedMap.mapId) !== targetMapId || (isWorldV2Map(targetMapId) && !loadedMap.isRegionWorld)) {
      try {
        loadedMap = await loadPlayableMap(targetMapId, positionHint);
        tiledWorld.current = loadedMap;
        currentMapIdRef.current = loadedMap.mapId;
        setCurrentMapId(loadedMap.mapId);
        activeCaveInteriorIdRef.current = null;
        lastCaveEntranceKeyRef.current = null;
        const worldLabel = formatWorldGenerationLabel(loadedMap.worldGenerationId ?? getWorldGenerationIdFromMapId(loadedMap.mapId));
        setMapStatus(loadedMap.isChunkWorld
          ? `${worldLabel} chunk streaming: ${loadedMap.loadedRegions.length} chunks active`
          : loadedMap.isRegionWorld
          ? `${worldLabel} world streaming: ${loadedMap.loadedRegions.length} region loaded`
          : `Map loaded: ${loadedMap.zones.length} zone, ${loadedMap.spawns.length} spawn`);
      } catch (error) {
        console.error(error);
        setAuthStatus(`Map load failed: ${error.message}`);
        return;
      }
    }

    enemies.current = [];
    combatEnemyIdsRef.current.clear();
    effects.current = [];
    nextEnemyId.current = 1;
    nextSpawnAt.current = performance.now() + 700;
    nextBossSpawnAt.current = getInitialBossSpawnAt(loadedMap);
    worldSpawnPacks.current = createWorldSpawnPacks(isWorldLikeMap(loadedMap?.mapId) ? loadedMap.enemySpawns ?? [] : []);
    cooldowns.current = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const nextAbilitySlots = getDefaultAbilitySlots(playableCharacter);
    abilitySlotsRef.current = nextAbilitySlots;
    setAbilitySlots(nextAbilitySlots);
    player.current = isWorldV2Map(targetMapId) && positionHint
      ? findOpenPointNear(loadedMap, positionHint, PLAYER.radius)
      : getCharacterStartPosition(loadedMap, playableCharacter);
    player.current = { ...player.current, mapId: loadedMap.mapId };
    lastPositionSaveRef.current = {
      at: performance.now(),
      x: player.current.x,
      y: player.current.y,
      mapId: loadedMap.mapId,
    };
    const stats = getTotalStats(playableCharacter);
    setVitalsValue({
      hp: stats.health,
      mana: stats.mana,
      fury: playableCharacter.classId === 'warrior' ? 0 : 0,
      energy: playableCharacter.classId === 'rogue' ? 100 : 0,
    });
    setIsDead(false);
    deadRef.current = false;
    hostileSlowEffectsRef.current = [];
    lastCombatAt.current = 0;
    setEnemyCount(0);
    setLastCast(null);
    setInventoryOpen(false);
    setShopOpen(false);
    setBankOpen(false);
    setAuctionOpen(false);
    setRepairOpen(false);
    setProfessionOpen(false);
    setActiveServiceNpcId(null);
    setTalentsOpen(false);
    setAbilityBookOpen(false);
    setQuestLogOpen(false);
    questDialogGiverIdRef.current = null;
    setQuestDialogGiverId(null);
    setSelectedQuestDialogId(null);
    setGameMenuOpen(false);
    setCharacter(playableCharacter);
  };

  const createCharacter = async (newCharacter) => {
    if (isNameTaken(newCharacter.name, charactersRef.current)) {
      setAuthStatus('Name taken');
      return;
    }

    const targetMapId = getRaceStartMapId(newCharacter.raceId);
    let loadedMap = tiledWorld.current;
    if (!loadedMap || normalizeMapId(loadedMap.mapId) !== targetMapId) {
      try {
        loadedMap = await loadTiledMap(targetMapId);
        tiledWorld.current = loadedMap;
        currentMapIdRef.current = loadedMap.mapId;
        setCurrentMapId(loadedMap.mapId);
        activeCaveInteriorIdRef.current = null;
        lastCaveEntranceKeyRef.current = null;
        setMapStatus(`Map loaded: ${loadedMap.zones.length} zone, ${loadedMap.spawns.length} spawn`);
      } catch (error) {
        console.error(error);
        setAuthStatus(`Map load failed: ${error.message}`);
        return;
      }
    }

    const startPosition = getRaceStartPosition(loadedMap, newCharacter.raceId);
    const createdAt = new Date().toISOString();
    const characterToSave = normalizeCharacter({
      ...newCharacter,
      id: crypto.randomUUID(),
      level: 1,
      xp: 0,
      stats: getInitialStats(newCharacter.classId),
      inventory: normalizeInventory(newCharacter.inventory ?? []),
      gold: 0,
      talents: { spec: null, ranks: {} },
      quests: normalizeQuestState(),
      createdAt,
      updatedAt: createdAt,
      position: {
        ...startPosition,
        mapId: loadedMap.mapId,
        worldVersion: loadedMap.mapId === 'world' ? WORLD_MAP_VERSION : undefined,
      },
    });
    const nextCharacters = [...charactersRef.current, characterToSave];
    charactersRef.current = nextCharacters;
    setCharacters(nextCharacters);
    saveCharacters(nextCharacters);
    syncCloudCharacter(characterToSave);
    await enterCharacter(characterToSave);
  };

  const deleteCharacter = (characterId) => {
    const nextCharacters = characters.filter((savedCharacter) => savedCharacter.id !== characterId);
    charactersRef.current = nextCharacters;
    setCharacters(nextCharacters);
    saveCharacters(nextCharacters);
    if (!OFFLINE_DEMO && authUser && !authUser.localOnly) {
      deleteCloudCharacter(authUser.uid, characterId).catch((error) => {
        setAuthStatus(`Cloud delete failed: ${error.message}`);
      });
    }
  };

  const persistCharacter = (updatedCharacter) => {
    const characterToPersist = normalizeCharacter({
      ...updatedCharacter,
      updatedAt: updatedCharacter.updatedAt ?? new Date().toISOString(),
    });
    const nextCharacters = charactersRef.current.map((savedCharacter) =>
      savedCharacter.id === characterToPersist.id ? characterToPersist : savedCharacter,
    );
    charactersRef.current = nextCharacters;
    characterRef.current = characterToPersist;
    setCharacters(nextCharacters);
    saveCharacters(nextCharacters);
    syncCloudCharacter(characterToPersist);
    setCharacter(characterToPersist);
  };

  const createCurrentPositionSnapshot = (source = player.current, mapId = currentMapIdRef.current) => ({
    x: source.x,
    y: source.y,
    facing: Number(source.facing ?? player.current.facing ?? 0),
    mapId,
    worldVersion: mapId === 'world' ? WORLD_MAP_VERSION : undefined,
  });

  const persistCurrentPosition = (source = player.current, mapId = currentMapIdRef.current) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return null;

    const updatedCharacter = {
      ...activeCharacter,
      position: createCurrentPositionSnapshot(source, mapId),
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    return updatedCharacter;
  };

  const saveCurrentPositionLocally = () => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;

    const updatedCharacter = normalizeCharacter({
      ...activeCharacter,
      position: createCurrentPositionSnapshot(),
      updatedAt: new Date().toISOString(),
    });
    const nextCharacters = charactersRef.current.map((savedCharacter) =>
      savedCharacter.id === updatedCharacter.id ? updatedCharacter : savedCharacter,
    );
    charactersRef.current = nextCharacters;
    characterRef.current = updatedCharacter;
    saveCharacters(nextCharacters);
    syncCloudCharacter(updatedCharacter);
  };

  const awardExperience = (amount) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter || activeCharacter.level >= MAX_LEVEL) return;

    let nextLevel = activeCharacter.level ?? 1;
    let nextXp = (activeCharacter.xp ?? 0) + amount;
    let leveledUp = false;
    let levelsGained = 0;

    while (nextLevel < MAX_LEVEL && nextXp >= xpForLevel(nextLevel)) {
      nextXp -= xpForLevel(nextLevel);
      nextLevel += 1;
      leveledUp = true;
      levelsGained += 1;
    }

    if (nextLevel >= MAX_LEVEL) {
      nextLevel = MAX_LEVEL;
      nextXp = 0;
    }

    const updatedCharacter = {
      ...activeCharacter,
      level: nextLevel,
      xp: nextXp,
      stats: levelsGained > 0
        ? addStats(activeCharacter.stats ?? getInitialStats(activeCharacter.classId), STAT_GROWTH[activeCharacter.classId], levelsGained)
        : activeCharacter.stats,
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    setLastCast(leveledUp ? `Level ${nextLevel}!` : `+${amount} XP`);
  };

  const adminSetMaxLevel = () => {
    if (!isAdmin) return;
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;

    colyseusRoomRef.current?.send('adminSetMaxLevel', {
      auth: { email: authUserRef.current?.email ?? '' },
    });

    const currentLevel = activeCharacter.level ?? 1;
    const levelsToGain = Math.max(0, MAX_LEVEL - currentLevel);
    const baseStats = activeCharacter.stats ?? getInitialStats(activeCharacter.classId);
    const updatedCharacter = {
      ...activeCharacter,
      level: MAX_LEVEL,
      xp: 0,
      stats: levelsToGain > 0
        ? addStats(baseStats, STAT_GROWTH[activeCharacter.classId], levelsToGain)
        : baseStats,
      updatedAt: new Date().toISOString(),
    };
    const totalStats = getTotalStats(updatedCharacter);
    const resourceConfig = getResourceConfig(updatedCharacter);
    persistCharacter(updatedCharacter);
    setAbilitySlots(getDefaultAbilitySlots(updatedCharacter));
    setVitalsValue({
      hp: totalStats.health,
      mana: resourceConfig.key === 'mana' ? getResourceMax(updatedCharacter, totalStats) : vitalsRef.current.mana,
      fury: resourceConfig.key === 'fury' ? 0 : vitalsRef.current.fury,
      energy: resourceConfig.key === 'energy' ? getResourceMax(updatedCharacter, totalStats) : vitalsRef.current.energy,
    });
    setLastCast('Admin: max level applied');
  };

  const applyAdminLevelGainToCharacter = (sourceCharacter, amount = 1) => {
    if (!sourceCharacter) return null;
    const current = Math.max(1, Math.floor(safeNumber(sourceCharacter.level, 1)));
    const nextLevel = clamp(current + Math.max(1, Math.floor(safeNumber(amount, 1))), 1, MAX_LEVEL);
    const levelsToGain = Math.max(0, nextLevel - current);
    const baseStats = sourceCharacter.stats ?? getInitialStats(sourceCharacter.classId);
    return {
      ...sourceCharacter,
      level: nextLevel,
      xp: nextLevel >= MAX_LEVEL ? 0 : sourceCharacter.xp ?? 0,
      stats: levelsToGain > 0
        ? addStats(baseStats, STAT_GROWTH[sourceCharacter.classId], levelsToGain)
        : baseStats,
      updatedAt: new Date().toISOString(),
    };
  };

  const adminLevelUpCharacter = async (target = null) => {
    if (!isAdmin) return;
    const targetId = target?.id ?? characterRef.current?.id;
    if (!targetId) return;

    const isSelfCharacter = targetId === characterRef.current?.id;
    const sourceCharacter = isSelfCharacter
      ? characterRef.current
      : charactersRef.current.find((savedCharacter) => savedCharacter.id === targetId) ?? target;
    const updatedCharacter = applyAdminLevelGainToCharacter(sourceCharacter, 1);
    if (!updatedCharacter) return;

    if (isSelfCharacter) {
      persistCharacter(updatedCharacter);
      const stats = getTotalStats(updatedCharacter);
      setVitalsValue({
        ...vitalsRef.current,
        hp: Math.min(stats.health, Math.max(vitalsRef.current.hp, stats.health)),
        mana: updatedCharacter.classId === 'rogue' || updatedCharacter.classId === 'warrior' ? vitalsRef.current.mana : stats.mana,
      });
    } else {
      const nextCharacters = charactersRef.current.map((savedCharacter) => (
        savedCharacter.id === updatedCharacter.id ? updatedCharacter : savedCharacter
      ));
      charactersRef.current = nextCharacters;
      setCharacters(nextCharacters);
      saveCharacters(nextCharacters);
      if (!OFFLINE_DEMO && authUserRef.current && updatedCharacter.ownerUid === authUserRef.current.uid) {
        syncCloudCharacter(updatedCharacter);
      }
    }

    if (target?.online?.id || target?.sessionId) {
      colyseusRoomRef.current?.send('adminLevelUpPlayer', {
        auth: { email: authUserRef.current?.email ?? '' },
        targetId: target.online?.id ?? target.sessionId,
        amount: 1,
      });
    }
    setAdminPlayersStatus(`${updatedCharacter.name ?? 'Character'} level ${updatedCharacter.level}`);
    setLastCast(`Admin level up: ${updatedCharacter.name ?? 'Character'}`);
    loadAdminCloudCharacters();
  };

  const adminLevelUpOnlinePlayer = (onlinePlayer) => {
    if (!isAdmin || !onlinePlayer?.id) return;
    colyseusRoomRef.current?.send('adminLevelUpPlayer', {
      auth: { email: authUserRef.current?.email ?? '' },
      targetId: onlinePlayer.id,
      amount: 1,
    });
    setAdminPlayersStatus(`Leveling ${onlinePlayer.name ?? 'player'}...`);
  };

  const loadAdminCloudCharacters = async () => {
    if (!isAdmin) return;
    setAdminPlayersStatus('Loading accounts...');
    let tokenEmail = authUserRef.current?.email ?? '';
    const tokenUid = authUserRef.current?.uid ?? '';
    try {
      const tokenResult = authUserRef.current
        ? await authUserRef.current.getIdTokenResult(true)
        : null;
      tokenEmail = tokenResult?.claims?.email ?? tokenEmail;
      const allCharacters = (await loadAllCloudCharactersForAdmin())
        .map((cloudCharacter) => normalizeCharacter(cloudCharacter))
        .sort((a, b) => String(a.ownerEmail ?? a.ownerUid ?? '').localeCompare(String(b.ownerEmail ?? b.ownerUid ?? ''))
          || String(a.name ?? '').localeCompare(String(b.name ?? '')));
      setAdminCloudCharacters(allCharacters);
      setAdminPlayersStatus(`Loaded ${allCharacters.length} character${allCharacters.length === 1 ? '' : 's'}`);
    } catch (error) {
      setAdminPlayersStatus(`Account load failed for ${tokenEmail || 'unknown'} (${tokenUid || 'no uid'}): ${error.message}`);
    }
  };

  const requestAdminOnlinePlayers = () => {
    if (!isAdmin || !colyseusRoomRef.current) {
      setAdminPlayersStatus('Online list needs server connection');
      return;
    }
    colyseusRoomRef.current.send('adminListPlayers', {
      auth: { email: authUserRef.current?.email ?? '' },
    });
    setAdminPlayersStatus('Refreshing online players...');
  };

  const openAdminPlayers = () => {
    if (!isAdmin) return;
    setAdminPlayersOpen(true);
    setGameMenuOpen(false);
    loadAdminCloudCharacters();
    requestAdminOnlinePlayers();
  };

  const getActiveInteriorId = () => normalizeInteriorId(activeCaveInteriorIdRef.current);

  const getActiveLocalInteriorId = (point = player.current) => {
    const activeCaveInteriorId = getActiveInteriorId();
    if (activeCaveInteriorId) return activeCaveInteriorId;
    if (!tiledWorld.current || !point) return null;
    return normalizeInteriorId(getInteriorZoneId(getOpenInteriorZone(tiledWorld.current, point, null)));
  };

  const isPlayerPointInsideActiveInterior = (point, interiorId = getActiveInteriorId()) => {
    const activeInteriorId = normalizeInteriorId(interiorId);
    if (!activeInteriorId) return true;
    return isPointInCaveInteriorSpace(tiledWorld.current, point, activeInteriorId);
  };

  const canMovePlayerTo = (x, y, collisionOptions = undefined) => {
    const activeInteriorId = normalizeInteriorId(collisionOptions?.activeInteriorId ?? getActiveInteriorId());
    return canMoveTo(tiledWorld.current, x, y, PLAYER.radius, collisionOptions)
      && isPlayerPointInsideActiveInterior({ x, y }, activeInteriorId);
  };

  const canBlinkPlayerTo = (x, y, collisionOptions = undefined) => {
    const activeInteriorId = normalizeInteriorId(collisionOptions?.activeInteriorId ?? getActiveInteriorId());
    if (!canMovePlayerTo(x, y, collisionOptions)) return false;
    if (!activeInteriorId) return true;
    const activeCaveZone = getCaveInteriorZone(tiledWorld.current, activeInteriorId);
    return !activeCaveZone || pointInObject({ x, y }, activeCaveZone, PLAYER.radius);
  };

  const findPlayerMovementTarget = (
    origin,
    facing,
    targetDistance,
    collisionOptions = undefined,
    validator = canMovePlayerTo,
  ) => {
    const activeWorldWidth = getTiledWorldPixelWidth(tiledWorld.current);
    const activeWorldHeight = getTiledWorldPixelHeight(tiledWorld.current);
    const fallback = { x: origin.x, y: origin.y };
    for (let stepDistance = targetDistance; stepDistance >= 16; stepDistance -= 16) {
      const targetX = clamp(origin.x + Math.cos(facing) * stepDistance, PLAYER.radius, activeWorldWidth - PLAYER.radius);
      const targetY = clamp(origin.y + Math.sin(facing) * stepDistance, PLAYER.radius, activeWorldHeight - PLAYER.radius);
      if (validator(targetX, targetY, collisionOptions)) return { x: targetX, y: targetY };
    }
    return fallback;
  };

  const invalidateDynamicMapOverview = () => {
    mapCanvasDrawRef.current.minimap = 0;
    mapCanvasDrawRef.current.world = 0;
    mapOverviewCacheRef.current = {
      ...mapOverviewCacheRef.current,
      key: null,
      canvas: null,
    };
  };

  const getLocalInteriorId = (entity) => normalizeInteriorId(
    entity?.interiorId
    ?? entity?.props?.interiorId
    ?? entity?.props?.caveId
    ?? entity?.props?.targetInteriorId,
  );

  const canShareLocalInteriorSpace = (entity) => getLocalInteriorId(entity) === getActiveLocalInteriorId();

  const getActiveTransitionAtPlayer = () => (
    tiledWorld.current?.transitions?.find((transition) => (
      canShareLocalInteriorSpace(transition)
      && pointInObject(player.current, transition, PLAYER.radius)
    ))
  );

  const updateActiveCaveInterior = (now = performance.now()) => {
    const activeWorld = tiledWorld.current;
    if (!activeWorld || !isWorldV2Map(currentMapIdRef.current)) {
      const hadActiveInterior = Boolean(activeCaveInteriorIdRef.current);
      activeCaveInteriorIdRef.current = null;
      lastCaveEntranceKeyRef.current = null;
      if (hadActiveInterior) invalidateDynamicMapOverview();
      return null;
    }

    const entranceZone = getCaveEntranceZone(activeWorld, player.current);
    const entranceInteriorId = entranceZone ? getInteriorZoneId(entranceZone) : null;
    const entranceKey = entranceZone
      ? `${entranceZone.mapId ?? currentMapIdRef.current}:${entranceZone.id ?? entranceZone.name}:${entranceInteriorId}`
      : null;
    const previousEntranceKey = lastCaveEntranceKeyRef.current;

    if (!entranceKey) {
      lastCaveEntranceKeyRef.current = null;
    } else if (entranceKey !== previousEntranceKey && now >= caveInteriorTransitionCooldownRef.current) {
      const currentInteriorId = getActiveInteriorId();
      activeCaveInteriorIdRef.current = currentInteriorId === entranceInteriorId ? null : entranceInteriorId;
      caveInteriorTransitionCooldownRef.current = now + 650;
      lastCaveEntranceKeyRef.current = entranceKey;
      invalidateDynamicMapOverview();
      setLastCast(currentInteriorId === entranceInteriorId ? 'Left cave' : 'Entered cave');
    }

    const activeInteriorId = getActiveInteriorId();
    if (activeInteriorId && !isPointInCaveInteriorSpace(activeWorld, player.current, activeInteriorId)) {
      if (!canMoveTo(activeWorld, player.current.x, player.current.y, PLAYER.radius)) {
        return activeInteriorId;
      }
      activeCaveInteriorIdRef.current = null;
      lastCaveEntranceKeyRef.current = null;
      invalidateDynamicMapOverview();
      return null;
    }

    return getActiveInteriorId();
  };

  const applyWorldControls = (controls = {}) => {
    try {
      if (controls.time) {
        if (controls.time.forcedPhase) {
          setForcedPhase(controls.time.forcedPhase);
        } else {
          clearForcedPhase();
        }
        if (Number.isFinite(Number(controls.time.speedMultiplier))) {
          setTimeSpeed(controls.time.speedMultiplier);
        }
      }

      if (controls.weather) {
        if (controls.weather.forcedWeather) {
          setForcedWeather(controls.weather.forcedWeather);
        } else {
          clearForcedWeather();
        }
        if (Number.isFinite(Number(controls.weather.speedMultiplier))) {
          setWeatherSpeed(controls.weather.speedMultiplier);
        }
      }
    } catch (error) {
      setLastCast(`World sync failed: ${error.message}`);
    }

    setDayNightDebugState(getDayNightDebugState());
    setWeatherDebugState(getWeatherDebugState());
  };

  const setAdminWorldTimePhase = (phase) => {
    if (!isAdmin) return;
    if (colyseusRoomRef.current) {
      colyseusRoomRef.current.send('adminSetWorldTime', {
        auth: { email: authUserRef.current?.email ?? '' },
        phase,
      });
      setLastCast(`World time: ${phase}`);
      return;
    }

    if (phase === 'auto') {
      clearForcedPhase();
      setLastCast('World time: Auto');
    } else {
      setForcedPhase(phase);
      setLastCast(`World time: ${phase}`);
    }
    setDayNightDebugState(getDayNightDebugState());
  };

  const setAdminWorldTimeSpeed = (multiplier) => {
    if (!isAdmin) return;
    if (colyseusRoomRef.current) {
      colyseusRoomRef.current.send('adminSetWorldTimeSpeed', {
        auth: { email: authUserRef.current?.email ?? '' },
        multiplier,
      });
      setLastCast(`World time speed: ${multiplier}x`);
      return;
    }

    setTimeSpeed(multiplier);
    setDayNightDebugState(getDayNightDebugState());
    setLastCast(`World time speed: ${multiplier}x`);
  };

  const setAdminWeatherPhase = (weather) => {
    if (!isAdmin) return;
    if (colyseusRoomRef.current) {
      colyseusRoomRef.current.send('adminSetWeather', {
        auth: { email: authUserRef.current?.email ?? '' },
        weather,
      });
      setLastCast(`Weather: ${weather}`);
      return;
    }

    if (weather === 'auto') {
      clearForcedWeather();
      setLastCast('Weather: Auto');
    } else {
      setForcedWeather(weather);
      setLastCast(`Weather: ${weather}`);
    }
    setWeatherDebugState(getWeatherDebugState());
  };

  const setAdminWeatherSpeed = (multiplier) => {
    if (!isAdmin) return;
    if (colyseusRoomRef.current) {
      colyseusRoomRef.current.send('adminSetWeatherSpeed', {
        auth: { email: authUserRef.current?.email ?? '' },
        multiplier,
      });
      setLastCast(`Weather speed: ${multiplier}x`);
      return;
    }

    setWeatherSpeed(multiplier);
    setWeatherDebugState(getWeatherDebugState());
    setLastCast(`Weather speed: ${multiplier}x`);
  };

  const adminTeleportToPlayer = (targetId) => {
    if (!isAdmin || !targetId || !colyseusRoomRef.current) return;
    colyseusRoomRef.current.send('adminTeleportTo', {
      auth: { email: authUserRef.current?.email ?? '' },
      targetId,
    });
    setAdminPlayersStatus('Teleporting...');
  };

  const adminSummonPlayer = (targetId) => {
    if (!isAdmin || !targetId || !colyseusRoomRef.current) return;
    colyseusRoomRef.current.send('adminSummonPlayer', {
      auth: { email: authUserRef.current?.email ?? '' },
      targetId,
    });
    setAdminPlayersStatus('Bringing player here...');
  };

  const adminTeleportToLocation = (location) => {
    if (!isAdmin || !location) return;
    if (!colyseusRoomRef.current) {
      setLastCast('Admin teleport requires server connection');
      return;
    }
    const mapId = normalizeMapId(location.mapId ?? currentMapIdRef.current);
    const x = safeNumber(location.x, player.current.x);
    const y = safeNumber(location.y, player.current.y);
    setMapOpen(false);
    colyseusRoomRef.current.send('adminTeleportToLocation', {
      auth: { email: authUserRef.current?.email ?? '' },
      mapId,
      x,
      y,
    });
    setAdminPlayersStatus(`Teleporting to ${Math.round(x)}, ${Math.round(y)}...`);
  };

  const addItemToActiveInventory = (item, sourceLabel = 'Loot') => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter || !item) return false;
    const result = addInventoryItemStack(activeCharacter.inventory ?? [], item);
    if (getBagCount(result.inventory) > INVENTORY_CAPACITY) {
      setLastCast('Inventory full');
      return false;
    }

    const selectedPotionId = activeCharacter.selectedPotionId
      ?? result.inventory.find((inventoryItem) => isPotionItem(inventoryItem))?.id
      ?? null;
    const updatedCharacter = {
      ...activeCharacter,
      inventory: result.inventory,
      selectedPotionId,
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    setLastCast(`${sourceLabel}: ${item.name}`);
    return true;
  };

  const addLoot = (item) => {
    addItemToActiveInventory(item, 'Loot');
  };

  const updateQuestState = (updater) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return null;
    const quests = normalizeQuestState(activeCharacter.quests);
    const nextQuests = normalizeQuestState(updater(quests, activeCharacter) ?? quests);
    const updatedCharacter = {
      ...activeCharacter,
      quests: nextQuests,
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    return updatedCharacter;
  };

  const acceptQuest = (quest) => {
    if (!quest?.id || getActiveQuest(characterRef.current, quest.id) || isQuestCompleted(characterRef.current, quest.id)) return;
    updateQuestState((quests) => ({
      ...quests,
      active: {
        ...quests.active,
        [quest.id]: {
          status: 'active',
          progress: 0,
          acceptedAt: new Date().toISOString(),
          quest,
        },
      },
      mainQuestId: quests.mainQuestId ?? quest.id,
    }));
    setSelectedQuestDialogId(quest.id);
    setLastCast(`Quest accepted: ${quest.title}`);
  };

  const declineQuest = () => {
    setSelectedQuestDialogId(null);
  };

  const abandonQuest = (questId) => {
    const activeQuest = questId ? characterRef.current?.quests?.active?.[questId] : null;
    const quest = getQuestSnapshot(activeQuest);
    if (!activeQuest) return;
    updateQuestState((quests) => {
      const nextActive = { ...quests.active };
      delete nextActive[questId];
      const nextMainQuestId = quests.mainQuestId === questId
        ? Object.keys(nextActive)[0] ?? null
        : quests.mainQuestId;
      return {
        ...quests,
        active: nextActive,
        mainQuestId: nextMainQuestId,
      };
    });
    setLastCast(`Quest abandoned: ${quest?.title ?? 'Quest'}`);
  };

  const completeQuestTurnIn = (questId) => {
    const activeQuest = characterRef.current?.quests?.active?.[questId];
    const quest = getQuestSnapshot(activeQuest);
    const travelReady = quest?.type === 'travel' && normalizeMapId(quest.turnInMapId) === normalizeMapId(currentMapIdRef.current);
    if (!quest || (activeQuest.status !== 'ready' && !travelReady)) return;
    updateQuestState((quests) => {
      const nextActive = { ...quests.active };
      delete nextActive[questId];
      const nextMainQuestId = quests.mainQuestId === questId
        ? Object.keys(nextActive)[0] ?? null
        : quests.mainQuestId;
      return {
        ...quests,
        active: nextActive,
        completed: {
          ...quests.completed,
          [questId]: new Date().toISOString(),
        },
        mainQuestId: nextMainQuestId,
      };
    });
    window.setTimeout(() => awardExperience(Math.max(safeNumber(quest.xpReward, 0), getScaledQuestXpReward(quest))), 0);
    setSelectedQuestDialogId(null);
    setLastCast(`Quest complete: ${quest.title}`);
  };

  const setMainQuest = (questId) => {
    if (!questId || !characterRef.current?.quests?.active?.[questId]) return;
    updateQuestState((quests) => ({
      ...quests,
      mainQuestId: questId,
    }));
  };

  const recordQuestKills = (defeatedEnemies) => {
    const kills = (Array.isArray(defeatedEnemies) ? defeatedEnemies : [])
      .map(getEnemyQuestKillKinds)
      .filter((killKinds) => killKinds.size > 0);
    if (!kills.length) return;

    updateQuestState((quests) => {
      let changed = false;
      const active = Object.fromEntries(Object.entries(quests.active).map(([questId, activeQuest]) => {
        const quest = getQuestSnapshot(activeQuest);
        if (!quest || quest.type !== 'kill' || activeQuest.status === 'ready') return [questId, activeQuest];
        const objectives = Array.isArray(quest.objectives)
          ? quest.objectives
            .map((objective) => ({
              ...objective,
              enemyKind: normalizeEnemyKind(objective?.enemyKind ?? objective?.kind ?? objective?.id),
              required: Math.max(1, Math.floor(safeNumber(objective?.required, 1))),
            }))
            .filter((objective) => objective.enemyKind)
          : [];
        if (objectives.length > 0) {
          const progressByKind = { ...(activeQuest.progressByKind ?? activeQuest.objectiveProgress ?? {}) };
          let matchedObjective = false;
          objectives.forEach((objective) => {
            const matchingKills = kills.filter((killKinds) => killKinds.has(objective.enemyKind)).length;
            if (!matchingKills) return;
            progressByKind[objective.enemyKind] = Math.min(
              objective.required,
              Math.max(0, Math.floor(safeNumber(progressByKind[objective.enemyKind], 0))) + matchingKills,
            );
            matchedObjective = true;
          });
          if (!matchedObjective) return [questId, activeQuest];
          const progress = objectives.reduce((total, objective) => (
            total + Math.min(objective.required, Math.max(0, Math.floor(safeNumber(progressByKind[objective.enemyKind], 0))))
          ), 0);
          const ready = objectives.every((objective) => (
            Math.max(0, Math.floor(safeNumber(progressByKind[objective.enemyKind], 0))) >= objective.required
          ));
          changed = true;
          return [
            questId,
            {
              ...activeQuest,
              progress,
              progressByKind,
              status: ready ? 'ready' : 'active',
            },
          ];
        }
        const questEnemyKind = normalizeEnemyKind(quest.enemyKind);
        const matchingKills = kills.filter((killKinds) => killKinds.has(questEnemyKind)).length;
        if (!matchingKills) return [questId, activeQuest];
        const progress = Math.min(quest.required, safeNumber(activeQuest.progress, 0) + matchingKills);
        changed = true;
        return [
          questId,
          {
            ...activeQuest,
            progress,
            status: progress >= quest.required ? 'ready' : 'active',
          },
        ];
      }));
      return changed ? { ...quests, active } : quests;
    });
  };

  const rollNormalMobDrops = (defeatedEnemies) => {
    (Array.isArray(defeatedEnemies) ? defeatedEnemies : [])
      .filter((enemy) => !(enemy.type === 'boss' || String(enemy.type ?? '').includes('boss')))
      .forEach((enemy) => {
        const dungeonDrop = isDungeonEnemyKill(enemy);
        const dropChance = dungeonDrop ? 0.16 : 0.05;
        if (Math.random() < dropChance) addLoot(dungeonDrop ? rollDungeonMobLoot(enemy) : rollMobLoot(enemy));
      });
  };

  const equipItem = (itemId) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;

    const itemToEquip = (activeCharacter.inventory ?? []).find((item) => item.id === itemId);
    if (!itemToEquip?.slot) return;

    const updatedCharacter = {
      ...activeCharacter,
      inventory: (activeCharacter.inventory ?? []).map((item) => ({
        ...item,
        equippedSlot: item.id === itemId
          ? itemToEquip.slot
          : item.equippedSlot === itemToEquip.slot
            ? null
            : item.equippedSlot,
      })),
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    setLastCast(`Equipped: ${itemToEquip.name}`);
  };

  const unequipSlot = (slotId) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;

    const updatedCharacter = {
      ...activeCharacter,
      inventory: (activeCharacter.inventory ?? []).map((item) => (
        item.equippedSlot === slotId ? { ...item, equippedSlot: null } : item
      )),
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
  };

  const sellItem = (itemId) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;

    const itemToSell = (activeCharacter.inventory ?? []).find((item) => item.id === itemId);
    if (!itemToSell || itemToSell.equippedSlot) return;
    if (itemToSell.nonDestroyable || itemToSell.type === 'usable') {
      setLastCast(`${itemToSell.name} cannot be sold`);
      return;
    }

    const value = getItemSellValue(itemToSell);
    const updatedCharacter = {
      ...activeCharacter,
      gold: (activeCharacter.gold ?? 0) + value,
      inventory: (activeCharacter.inventory ?? []).filter((item) => item.id !== itemId),
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    setLastCast(`Sold: ${itemToSell.name} +${value}g`);
  };

  const closeServicePanels = () => {
    setShopOpen(false);
    setBankOpen(false);
    setAuctionOpen(false);
    setRepairOpen(false);
    setProfessionOpen(false);
  };

  const bindRecallStoneToInn = (serviceNpc) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter || !serviceNpc) return;
    const props = serviceNpc.props ?? {};
    const homePosition = {
      x: safeNumber(props.homeX, safeNumber(serviceNpc.x, player.current.x)),
      y: safeNumber(props.homeY, safeNumber(serviceNpc.y, player.current.y)),
      facing: safeNumber(props.homeFacing, player.current.facing),
      mapId: normalizeMapId(props.homeMapId ?? serviceNpc.mapId ?? currentMapIdRef.current),
      innkeeperId: serviceNpc.id ?? serviceNpc.name ?? null,
      innkeeperName: serviceNpc.name ?? props.displayName ?? 'Innkeeper',
    };
    persistCharacter({
      ...activeCharacter,
      homeBind: homePosition,
      updatedAt: new Date().toISOString(),
    });
    setLastCast(`${serviceNpc.name}: Recall Stone bound here`);
  };

  const openServiceNpc = (serviceNpc) => {
    if (!serviceNpc) return;
    const serviceType = String(serviceNpc.serviceType || serviceNpc.props?.serviceType || serviceNpc.props?.npcType || serviceNpc.props?.type || '').toLowerCase();
    closeServicePanels();
    setInventoryOpen(false);
    setActiveServiceNpcId(serviceNpc.id ?? serviceNpc.name ?? null);
    if (serviceType === 'bank') {
      setBankOpen(true);
      setLastCast(`${serviceNpc.name}: Bank opened`);
    } else if (serviceType === 'auction') {
      setAuctionOpen(true);
      setLastCast(`${serviceNpc.name}: Auction House opened`);
    } else if (serviceType === 'repair') {
      setRepairOpen(true);
      setLastCast(`${serviceNpc.name}: Repair service`);
    } else if (serviceType === 'professiontrainer' || serviceType === 'trainer') {
      setProfessionOpen(true);
      setLastCast(`${serviceNpc.name}: Profession training`);
    } else if (serviceType === 'inn') {
      bindRecallStoneToInn(serviceNpc);
    } else {
      setShopOpen(true);
      setLastCast(`${serviceNpc.name}: Goods and services`);
    }
  };

  const buyVendorItem = (stockEntry) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter || !stockEntry?.item) return;
    const template = stockEntry.item;
    const price = Math.max(1, Math.floor(safeNumber(template.price, 1)));
    if (safeNumber(activeCharacter.gold, 0) < price) {
      setLastCast('Not enough gold');
      return;
    }
    const item = createItemInstance(template, { vendorStockId: stockEntry.id });
    const result = addInventoryItemStack(activeCharacter.inventory ?? [], item);
    if (getBagCount(result.inventory) > INVENTORY_CAPACITY) {
      setLastCast('Inventory full');
      return;
    }
    const selectedPotionId = activeCharacter.selectedPotionId
      ?? result.inventory.find((inventoryItem) => isPotionItem(inventoryItem))?.id
      ?? null;
    persistCharacter({
      ...activeCharacter,
      gold: safeNumber(activeCharacter.gold, 0) - price,
      inventory: result.inventory,
      selectedPotionId,
      updatedAt: new Date().toISOString(),
    });
    setLastCast(`Bought: ${template.name}`);
  };

  const repairAllItems = () => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;
    const cost = getRepairAllCost(activeCharacter);
    if (cost <= 0) {
      setLastCast('No repairs needed');
      return;
    }
    if (safeNumber(activeCharacter.gold, 0) < cost) {
      setLastCast(`Need ${cost}g for repairs`);
      return;
    }
    persistCharacter({
      ...activeCharacter,
      gold: safeNumber(activeCharacter.gold, 0) - cost,
      inventory: (activeCharacter.inventory ?? []).map((item) => {
        if (!isEquipmentItem(item)) return item;
        const maxDurability = getMaxDurability(item);
        return { ...item, durability: maxDurability, broken: false };
      }),
      updatedAt: new Date().toISOString(),
    });
    setLastCast(`Repaired all gear -${cost}g`);
  };

  const depositBankItem = (itemId) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;
    const item = (activeCharacter.inventory ?? []).find((inventoryItem) => inventoryItem.id === itemId);
    if (!item || item.equippedSlot || item.nonDestroyable) return;
    if ((activeCharacter.bank ?? []).length >= BANK_CAPACITY) {
      setLastCast('Bank full');
      return;
    }
    persistCharacter({
      ...activeCharacter,
      inventory: (activeCharacter.inventory ?? []).filter((inventoryItem) => inventoryItem.id !== item.id),
      bank: [...(activeCharacter.bank ?? []), item],
      selectedPotionId: activeCharacter.selectedPotionId === item.id
        ? (activeCharacter.inventory ?? []).find((inventoryItem) => inventoryItem.id !== item.id && isPotionItem(inventoryItem))?.id ?? null
        : activeCharacter.selectedPotionId,
      updatedAt: new Date().toISOString(),
    });
    setLastCast(`Deposited: ${item.name}`);
  };

  const withdrawBankItem = (itemId) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;
    const item = (activeCharacter.bank ?? []).find((bankItem) => bankItem.id === itemId);
    if (!item) return;
    const result = addInventoryItemStack(activeCharacter.inventory ?? [], item);
    if (getBagCount(result.inventory) > INVENTORY_CAPACITY) {
      setLastCast('Inventory full');
      return;
    }
    persistCharacter({
      ...activeCharacter,
      inventory: result.inventory,
      bank: (activeCharacter.bank ?? []).filter((bankItem) => bankItem.id !== item.id),
      selectedPotionId: activeCharacter.selectedPotionId ?? result.inventory.find((inventoryItem) => isPotionItem(inventoryItem))?.id ?? null,
      updatedAt: new Date().toISOString(),
    });
    setLastCast(`Withdrew: ${item.name}`);
  };

  const listAuctionItem = (itemId) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;
    const item = (activeCharacter.inventory ?? []).find((inventoryItem) => inventoryItem.id === itemId);
    if (!item || item.equippedSlot || item.nonDestroyable) return;
    const price = Math.max(1, Math.floor(safeNumber(auctionPriceByItemId[itemId], getItemSellValue(item) * 2 || 10)));
    const listing = {
      id: crypto.randomUUID(),
      sellerId: activeCharacter.id,
      sellerName: activeCharacter.name,
      item,
      price,
      listedAt: new Date().toISOString(),
    };
    const nextListings = [listing, ...auctionListings];
    setAuctionListings(nextListings);
    saveAuctionListings(nextListings);
    persistCharacter({
      ...activeCharacter,
      inventory: (activeCharacter.inventory ?? []).filter((inventoryItem) => inventoryItem.id !== item.id),
      selectedPotionId: activeCharacter.selectedPotionId === item.id
        ? (activeCharacter.inventory ?? []).find((inventoryItem) => inventoryItem.id !== item.id && isPotionItem(inventoryItem))?.id ?? null
        : activeCharacter.selectedPotionId,
      updatedAt: new Date().toISOString(),
    });
    setAuctionPriceByItemId((current) => ({ ...current, [itemId]: '' }));
    setLastCast(`Listed: ${item.name} for ${price}g`);
  };

  const buyAuctionListing = (listingId) => {
    const activeCharacter = characterRef.current;
    const listing = auctionListings.find((entry) => entry.id === listingId);
    if (!activeCharacter || !listing) return;
    if (String(listing.sellerId) === String(activeCharacter.id)) {
      setLastCast('You cannot buy your own listing');
      return;
    }
    if (safeNumber(activeCharacter.gold, 0) < listing.price) {
      setLastCast('Not enough gold');
      return;
    }
    const item = normalizeInventoryItem({ ...listing.item, id: crypto.randomUUID(), boughtAt: new Date().toISOString() });
    const result = addInventoryItemStack(activeCharacter.inventory ?? [], item);
    if (getBagCount(result.inventory) > INVENTORY_CAPACITY) {
      setLastCast('Inventory full');
      return;
    }
    const nextListings = auctionListings.filter((entry) => entry.id !== listing.id);
    setAuctionListings(nextListings);
    saveAuctionListings(nextListings);
    const nextCharacters = charactersRef.current.map((savedCharacter) => (
      String(savedCharacter.id) === String(listing.sellerId)
        ? { ...savedCharacter, gold: safeNumber(savedCharacter.gold, 0) + listing.price, updatedAt: new Date().toISOString() }
        : savedCharacter
    ));
    charactersRef.current = nextCharacters;
    setCharacters(nextCharacters);
    saveCharacters(nextCharacters);
    persistCharacter({
      ...activeCharacter,
      gold: safeNumber(activeCharacter.gold, 0) - listing.price,
      inventory: result.inventory,
      selectedPotionId: activeCharacter.selectedPotionId ?? result.inventory.find((inventoryItem) => isPotionItem(inventoryItem))?.id ?? null,
      updatedAt: new Date().toISOString(),
    });
    setLastCast(`Bought: ${listing.item.name}`);
  };

  const cancelAuctionListing = (listingId) => {
    const activeCharacter = characterRef.current;
    const listing = auctionListings.find((entry) => entry.id === listingId);
    if (!activeCharacter || !listing || String(listing.sellerId) !== String(activeCharacter.id)) return;
    const result = addInventoryItemStack(activeCharacter.inventory ?? [], listing.item);
    if (getBagCount(result.inventory) > INVENTORY_CAPACITY) {
      setLastCast('Inventory full');
      return;
    }
    const nextListings = auctionListings.filter((entry) => entry.id !== listing.id);
    setAuctionListings(nextListings);
    saveAuctionListings(nextListings);
    persistCharacter({
      ...activeCharacter,
      inventory: result.inventory,
      selectedPotionId: activeCharacter.selectedPotionId ?? result.inventory.find((inventoryItem) => isPotionItem(inventoryItem))?.id ?? null,
      updatedAt: new Date().toISOString(),
    });
    setLastCast(`Canceled listing: ${listing.item.name}`);
  };

  const learnProfession = (professionId) => {
    const activeCharacter = characterRef.current;
    const profession = PROFESSION_BY_ID[professionId];
    if (!activeCharacter || !profession) return;
    const current = activeCharacter.professions?.[professionId];
    if (current?.learned) {
      setLastCast(`${profession.displayName} already learned`);
      return;
    }
    const learnedCount = PROFESSIONS.filter((entry) => activeCharacter.professions?.[entry.id]?.learned).length;
    if (learnedCount >= 2) {
      setLastCast('You can only learn 2 professions');
      return;
    }
    persistCharacter({
      ...activeCharacter,
      professions: {
        ...(activeCharacter.professions ?? {}),
        [professionId]: {
          id: professionId,
          learned: true,
          level: 1,
          xp: 0,
          learnedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    });
    setLastCast(`Learned ${profession.displayName}`);
  };

  const unlearnProfession = (professionId) => {
    const activeCharacter = characterRef.current;
    const profession = PROFESSION_BY_ID[professionId];
    if (!activeCharacter || !profession || !activeCharacter.professions?.[professionId]?.learned) return;
    persistCharacter({
      ...activeCharacter,
      professions: {
        ...(activeCharacter.professions ?? {}),
        [professionId]: {
          id: professionId,
          learned: false,
          level: 1,
          xp: 0,
          unlearnedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    });
    setLastCast(`Unlearned ${profession.displayName}`);
  };

  const selectMainPotion = (itemId) => {
    const activeCharacter = characterRef.current;
    const item = (activeCharacter?.inventory ?? []).find((inventoryItem) => inventoryItem.id === itemId);
    if (!activeCharacter || !isPotionItem(item)) return;
    persistCharacter({
      ...activeCharacter,
      selectedPotionId: item.id,
      updatedAt: new Date().toISOString(),
    });
    setLastCast(`Main potion: ${item.name}`);
  };

  const useSelectedPotion = () => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter || deadRef.current) return;
    const now = performance.now();
    if (now < potionCooldownUntilRef.current) {
      setLastCast(`Potion ready in ${Math.ceil((potionCooldownUntilRef.current - now) / 1000)}s`);
      return;
    }
    const inventory = activeCharacter.inventory ?? [];
    const selectedPotion = inventory.find((item) => item.id === activeCharacter.selectedPotionId && isPotionItem(item))
      ?? inventory.find((item) => isPotionItem(item));
    if (!selectedPotion) {
      setLastCast('No potion selected');
      return;
    }
    const stats = getTotalStats(activeCharacter);
    let nextVitals = vitalsRef.current;
    if (selectedPotion.potionType === 'mana' || selectedPotion.action === 'restoreMana') {
      if (safeNumber(nextVitals.mana, 0) >= safeNumber(stats.mana, BASE_STATS.mana)) {
        setLastCast('Mana is already full');
        return;
      }
      nextVitals = {
        ...nextVitals,
        mana: Math.min(safeNumber(stats.mana, BASE_STATS.mana), safeNumber(nextVitals.mana, 0) + safeNumber(selectedPotion.manaAmount, 120)),
      };
    } else {
      if (safeNumber(nextVitals.hp, 0) >= safeNumber(stats.health, BASE_STATS.health)) {
        setLastCast('Health is already full');
        return;
      }
      nextVitals = {
        ...nextVitals,
        hp: Math.min(safeNumber(stats.health, BASE_STATS.health), safeNumber(nextVitals.hp, 0) + safeNumber(selectedPotion.healAmount, 120)),
      };
    }

    const remainingQuantity = getItemQuantity(selectedPotion) - 1;
    const nextInventory = inventory
      .map((item) => (item.id === selectedPotion.id ? { ...item, quantity: remainingQuantity } : item))
      .filter((item) => !isPotionItem(item) || getItemQuantity(item) > 0);
    const nextSelectedPotionId = remainingQuantity > 0
      ? selectedPotion.id
      : nextInventory.find((item) => isPotionItem(item))?.id ?? null;
    persistCharacter({
      ...activeCharacter,
      inventory: nextInventory,
      selectedPotionId: nextSelectedPotionId,
      updatedAt: new Date().toISOString(),
    });
    potionCooldownUntilRef.current = now + POTION_COOLDOWN_MS;
    setPotionCooldownUntil(potionCooldownUntilRef.current);
    setVitalsValue(nextVitals);
    setLastCast(`${selectedPotion.name} used`);
  };

  const reorderBagItem = (itemId, targetIndex) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter || !itemId) return;

    const inventory = activeCharacter.inventory ?? [];
    const bagItemsForOrder = inventory.filter((item) => !item.equippedSlot);
    const fromIndex = bagItemsForOrder.findIndex((item) => item.id === itemId);
    if (fromIndex < 0) return;

    const nextBagItems = [...bagItemsForOrder];
    const [movedItem] = nextBagItems.splice(fromIndex, 1);
    const insertIndex = clamp(Math.floor(safeNumber(targetIndex, nextBagItems.length)), 0, nextBagItems.length);
    nextBagItems.splice(insertIndex, 0, movedItem);

    let bagCursor = 0;
    const updatedCharacter = {
      ...activeCharacter,
      inventory: inventory.map((item) => (
        item.equippedSlot ? item : nextBagItems[bagCursor++]
      )),
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
  };

  const requestDestroyItem = (itemId) => {
    const activeCharacter = characterRef.current;
    const item = (activeCharacter?.inventory ?? []).find((inventoryItem) => inventoryItem.id === itemId);
    if (!item || item.equippedSlot) return;
    if (item.nonDestroyable) {
      setLastCast(`${item.name} cannot be destroyed`);
      return;
    }
    setDestroyConfirmItemId(item.id);
  };

  const confirmDestroyItem = () => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter || !destroyConfirmItemId) return;
    const item = (activeCharacter.inventory ?? []).find((inventoryItem) => inventoryItem.id === destroyConfirmItemId);
    if (!item || item.equippedSlot || item.nonDestroyable) {
      setDestroyConfirmItemId(null);
      return;
    }

    const updatedCharacter = {
      ...activeCharacter,
      inventory: (activeCharacter.inventory ?? []).filter((inventoryItem) => inventoryItem.id !== item.id),
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    setDestroyConfirmItemId(null);
    setHoveredInventoryItemId((currentId) => (currentId === item.id ? null : currentId));
    setLastCast(`Destroyed: ${item.name}`);
  };

  const sendPartyInviteToPlayer = (targetId, targetName = 'player') => {
    if (!targetId || !colyseusRoomRef.current) return false;
    const activeCharacter = characterRef.current;
    const currentParty = partyMembers.find((member) => member.id === targetId);
    if (currentParty && !currentParty.isSelf) {
      setLastCast(`${targetName} is already in your party`);
      return false;
    }

    const now = performance.now();
    const cooldownUntil = partyInviteCooldownsRef.current.get(targetId) ?? 0;
    if (cooldownUntil > now) {
      setLastCast('Party invite already pending');
      return false;
    }

    partyInviteCooldownsRef.current.set(targetId, now + PARTY_INVITE_COOLDOWN_MS);
    colyseusRoomRef.current.send('partyInvite', { targetId });
    setLastCast(`Party invite sent to ${targetName}`);
    return Boolean(activeCharacter);
  };

  const inviteSelectedPlayer = () => {
    const targetId = selectedPlayerIdRef.current;
    const targetPlayer = [...displayedRemotePlayersRef.current, ...onlinePlayersRef.current]
      .find((candidate) => candidate.id === targetId);
    sendPartyInviteToPlayer(targetId, targetPlayer?.name ?? 'player');
  };

  const acceptPartyInvite = () => {
    if (!partyInvite?.fromId || !colyseusRoomRef.current) return;
    colyseusRoomRef.current.send('partyAccept', { fromId: partyInvite.fromId });
    setPartyInvite(null);
    setLastCast('Party invite accepted');
  };

  const leaveParty = () => {
    if (!colyseusRoomRef.current) return;
    colyseusRoomRef.current.send('partyLeave');
    setSelectedPlayerId(null);
    setLastCast('Left party');
  };

  const kickPartyMember = (memberId) => {
    if (!memberId || !colyseusRoomRef.current) return;
    colyseusRoomRef.current.send('partyKick', { targetId: memberId });
    if (selectedPlayerIdRef.current === memberId) setSelectedPlayerId(null);
    setLastCast('Party member removed');
  };

  const resetDungeonInstances = () => {
    if (!colyseusRoomRef.current) {
      setLastCast('Dungeon reset needs online mode');
      return;
    }
    colyseusRoomRef.current.send('dungeonReset');
    locallyDefeatedEnemyIdsRef.current.clear();
    setLastCast('Resetting dungeon...');
  };

  const targetPartyMember = (member) => {
    if (!member || member.isSelf) return;
    setSelectedPlayerId(member.id);
  };

  const addFriendByName = (rawName) => {
    const name = String(rawName ?? '').trim();
    if (!name) return;
    const alreadyAdded = friends.some((friend) => normalizeName(friend.name) === normalizeName(name));
    if (alreadyAdded) {
      setLastCast(`${name} is already on your friends list`);
      return;
    }

    const nextFriends = [
      ...friends,
      {
        id: crypto.randomUUID(),
        name,
        addedAt: new Date().toISOString(),
      },
    ];
    setFriends(nextFriends);
    saveFriends(nextFriends);
    setFriendNameInput('');
    setLastCast(`${name} added to friends`);
  };

  const addSelectedPlayerAsFriend = () => {
    const selectedPlayer = displayedRemotePlayersRef.current.find((remotePlayer) => remotePlayer.id === selectedPlayerIdRef.current);
    if (!selectedPlayer?.name) {
      setLastCast('Target a player first');
      return;
    }
    addFriendByName(selectedPlayer.name);
  };

  const removeFriend = (friendId) => {
    const nextFriends = friends.filter((friend) => friend.id !== friendId);
    setFriends(nextFriends);
    saveFriends(nextFriends);
  };

  const inviteFriend = (friend) => {
    const onlineFriend = onlinePlayersRef.current.find((candidate) => (
      normalizeName(candidate.name) === normalizeName(friend.name)
      && candidate.id !== colyseusSessionIdRef.current
    ));
    if (!onlineFriend) {
      setLastCast(`${friend.name} is offline`);
      return;
    }
    sendPartyInviteToPlayer(onlineFriend.id, onlineFriend.name);
  };

  const canResurrect = () => {
    const activeCharacter = characterRef.current;
    return activeCharacter?.classId === 'priest' && activeCharacter?.talents?.spec === 'light';
  };

  const startResurrection = (targetPlayer) => {
    if (!targetPlayer || !canResurrect() || !colyseusRoomRef.current) return false;
    if ((targetPlayer.hp ?? targetPlayer.maxHp ?? 1) > 0) return false;
    if (distance(targetPlayer, player.current) > 110) {
      setLastCast('Move closer to resurrect');
      return true;
    }

    setResurrectionCast({ targetId: targetPlayer.id, targetName: targetPlayer.name ?? 'Adventurer', startedAt: performance.now() });
    setLastCast(`Resurrecting ${targetPlayer.name ?? 'Adventurer'}...`);
    window.setTimeout(() => {
      const room = colyseusRoomRef.current;
      if (!room || deadRef.current) return;
      room.send('resurrect', { targetId: targetPlayer.id });
      setResurrectionCast(null);
    }, 3200);
    return true;
  };

  const chooseTalentSpec = (specId) => {
    const activeCharacter = characterRef.current;
    const talentTree = activeCharacter ? TALENTS[activeCharacter.classId] : null;
    if (!activeCharacter || !talentTree || (activeCharacter.level ?? 1) < talentTree.unlockLevel) return;

    const updatedCharacter = {
      ...activeCharacter,
      talents: { ...(activeCharacter.talents ?? {}), spec: specId, ranks: getTalentRanks(activeCharacter) },
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    const nextAbilitySlots = getDefaultAbilitySlots(updatedCharacter);
    abilitySlotsRef.current = nextAbilitySlots;
    setAbilitySlots(nextAbilitySlots);
    cooldowns.current = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const stats = getTotalStats(updatedCharacter);
    setVitalsValue({
      hp: Math.min(vitalsRef.current.hp, stats.health),
      mana: Math.min(vitalsRef.current.mana, stats.mana),
      fury: activeCharacter.classId === 'warrior' ? Math.min(vitalsRef.current.fury ?? 0, 100) : 0,
      energy: activeCharacter.classId === 'rogue' ? Math.min(vitalsRef.current.energy ?? 100, 100) : 0,
    });
    setLastCast(`Spec: ${talentTree.specs[specId].name}`);
  };

  const spendTalentPoint = (specId, nodeId) => {
    const activeCharacter = characterRef.current;
    const talentTree = activeCharacter ? TALENTS[activeCharacter.classId] : null;
    const node = activeCharacter
      ? getTalentNodesForSpec(activeCharacter.classId, specId).find((candidate) => candidate.id === nodeId)
      : null;
    if (!activeCharacter || !talentTree || !node) return;
    if ((activeCharacter.level ?? 1) < (talentTree.unlockLevel ?? TALENT_UNLOCK_LEVEL)) return;
    if (node.requiresLevel && (activeCharacter.level ?? 1) < node.requiresLevel) {
      setLastCast(`${node.name} unlocks at level ${node.requiresLevel}`);
      return;
    }

    const selectedSpec = activeCharacter.talents?.spec;
    if (selectedSpec !== specId) {
      chooseTalentSpec(specId);
      return;
    }

    const ranks = getTalentRanks(activeCharacter);
    const nodeKey = getTalentNodeKey(specId, nodeId);
    const currentRank = Number(ranks[nodeKey] ?? 0);
    if (currentRank >= node.maxRank || getAvailableTalentPoints(activeCharacter) <= 0) return;
    if (node.requiresSpent && getSpecSpentPoints(activeCharacter, specId) < node.requiresSpent) {
      setLastCast(`Spend ${node.requiresSpent} points in this branch first`);
      return;
    }

    const updatedCharacter = {
      ...activeCharacter,
      talents: {
        ...(activeCharacter.talents ?? {}),
        spec: specId,
        ranks: {
          ...ranks,
          [nodeKey]: currentRank + 1,
        },
      },
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    const stats = getTotalStats(updatedCharacter);
    setVitalsValue({
      hp: Math.min(vitalsRef.current.hp, stats.health),
      mana: Math.min(vitalsRef.current.mana, stats.mana),
      fury: updatedCharacter.classId === 'warrior' ? Math.min(vitalsRef.current.fury ?? 0, 100) : 0,
      energy: updatedCharacter.classId === 'rogue' ? Math.min(vitalsRef.current.energy ?? 100, 100) : 0,
    });

    const nextSlots = abilitySlotsRef.current.map((slotId, index) => {
      const ability = resolveAbility(getCharacterAbilities(updatedCharacter), slotId, index + 1);
      return ability ? getAbilityId(ability) : null;
    });
    if (!nextSlots.some(Boolean)) {
      const defaults = getDefaultAbilitySlots(updatedCharacter);
      abilitySlotsRef.current = defaults;
      setAbilitySlots(defaults);
    } else {
      abilitySlotsRef.current = nextSlots;
      setAbilitySlots(nextSlots);
    }
  };

  const resetTalentPoints = () => {
    const activeCharacter = characterRef.current;
    const talentTree = activeCharacter ? TALENTS[activeCharacter.classId] : null;
    if (!activeCharacter || !talentTree) return;
    const updatedCharacter = {
      ...activeCharacter,
      talents: {
        ...(activeCharacter.talents ?? {}),
        ranks: {},
      },
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    const stats = getTotalStats(updatedCharacter);
    setVitalsValue({
      hp: Math.min(vitalsRef.current.hp, stats.health),
      mana: Math.min(vitalsRef.current.mana, stats.mana),
      fury: updatedCharacter.classId === 'warrior' ? Math.min(vitalsRef.current.fury ?? 0, 100) : 0,
      energy: updatedCharacter.classId === 'rogue' ? Math.min(vitalsRef.current.energy ?? 100, 100) : 0,
    });
    setLastCast('Talent points reset');
  };

  const assignAbilitySlot = (slotIndex, ability) => {
    if (!abilityBookOpen || !ability) return;
    const abilityId = getAbilityId(ability);
    setAbilitySlots((current) => {
      const availableAbilities = getCharacterAbilities(characterRef.current);
      const nextSlots = current.map((slotId, index) => {
        const existingAbility = resolveAbility(availableAbilities, slotId, index + 1);
        return existingAbility && getAbilityId(existingAbility) === abilityId ? null : slotId;
      });
      nextSlots[slotIndex] = abilityId;
      abilitySlotsRef.current = nextSlots;
      return nextSlots;
    });
    setLastCast(`${ability.name} assigned to ${slotIndex + 1}`);
  };

  const killPlayer = () => {
    if (deadRef.current) return;

    deadRef.current = true;
    setIsDead(true);
    setRecallCast(null);
    setShopOpen(false);
    setInventoryOpen(false);
    setVitalsValue({ ...vitalsRef.current, hp: 0 });
    const now = performance.now();
    enemies.current = enemies.current.map((enemy) => (
      enemy.state === 'aggro' || enemy.targetPlayerId || enemy.firstHitPlayerId
        ? resetEnemyAggro(enemy, now)
        : enemy
    ));
  };

  const respawnPlayer = async () => {
    let activeCharacter = characterRef.current;
    if (!activeCharacter) return;

    const durabilityDamagedCharacter = applyDeathDurabilityDamage(activeCharacter);
    if (durabilityDamagedCharacter !== activeCharacter) {
      activeCharacter = durabilityDamagedCharacter;
      persistCharacter(durabilityDamagedCharacter);
    }
    const stats = getTotalStats(activeCharacter);
    let respawnMap = tiledWorld.current;
    let respawnOrigin = { x: player.current.x, y: player.current.y };

    if (currentMapIdRef.current === 'dungeon_01') {
      try {
        const raceMapId = getRaceStartMapId(activeCharacter.raceId);
        respawnMap = await loadTiledMap(raceMapId);
        tiledWorld.current = respawnMap;
        currentMapIdRef.current = respawnMap.mapId;
        setCurrentMapId(respawnMap.mapId);
        respawnOrigin = getRaceStartPosition(respawnMap, activeCharacter.raceId);
        setMapStatus(`Map loaded: ${respawnMap.zones.length} zone, ${respawnMap.spawns.length} spawn`);
      } catch (error) {
        console.error(error);
      }
    }

    player.current = getNearestGraveyardPosition(respawnMap, respawnOrigin, activeCharacter);
    setPosition({ ...player.current });
    enemies.current = [];
    combatEnemyIdsRef.current.clear();
    effects.current = [];
    remotePlayersRef.current = [];
    displayedRemotePlayersRef.current = [];
    setSelectedPlayerId(null);
    nextSpawnAt.current = performance.now() + 900;
    nextBossSpawnAt.current = getInitialBossSpawnAt(respawnMap);
    worldSpawnPacks.current = createWorldSpawnPacks(isWorldLikeMap(respawnMap?.mapId) ? respawnMap.enemySpawns ?? [] : []);
    setVitalsValue({
      hp: stats.health,
      mana: stats.mana,
      fury: activeCharacter.classId === 'warrior' ? 0 : 0,
      energy: activeCharacter.classId === 'rogue' ? 100 : 0,
    });
    setEnemyCount(0);
    setIsDead(false);
    deadRef.current = false;
    hostileSlowEffectsRef.current = [];
    persistCurrentPosition(player.current, currentMapIdRef.current);
    setLastCast('Respawned');
  };

  const resetToMapStart = () => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;

    const startPosition = getRaceStartPosition(tiledWorld.current, activeCharacter.raceId);
    const resetPosition = {
      ...startPosition,
      mapId: currentMapIdRef.current,
      worldVersion: currentMapIdRef.current === 'world' ? WORLD_MAP_VERSION : undefined,
    };
    player.current = resetPosition;
    setPosition({ ...resetPosition });
    persistCharacter({
      ...activeCharacter,
      position: resetPosition,
      updatedAt: new Date().toISOString(),
    });
    setLastCast('Moved to map start');
  };

  const switchMap = React.useCallback(async (nextMapId, spawnName, message) => {
    const activeCharacter = characterRef.current;
    const loadedMap = await loadPlayableMap(nextMapId);
    tiledWorld.current = loadedMap;
    currentMapIdRef.current = loadedMap.mapId;
    setCurrentMapId(loadedMap.mapId);
    setDungeonConfirmOpen(false);
    dungeonEntranceConfirmCooldownRef.current = 0;
    activeCaveInteriorIdRef.current = null;
    lastCaveEntranceKeyRef.current = null;
    enemies.current = [];
    combatEnemyIdsRef.current.clear();
    effects.current = [];
    remotePlayersRef.current = [];
    displayedRemotePlayersRef.current = [];
    setSelectedPlayerId(null);
    worldSpawnPacks.current = createWorldSpawnPacks(isWorldLikeMap(loadedMap.mapId) ? loadedMap.enemySpawns : []);
    nextBossSpawnAt.current = getInitialBossSpawnAt(loadedMap);
    setEnemyCount(0);
    const worldLabel = formatWorldGenerationLabel(loadedMap.worldGenerationId ?? getWorldGenerationIdFromMapId(loadedMap.mapId));
    setMapStatus(loadedMap.isChunkWorld
      ? `${worldLabel} chunk streaming: ${loadedMap.loadedRegions.length} chunks active`
      : loadedMap.isRegionWorld
      ? `${worldLabel} world streaming: ${loadedMap.loadedRegions.length} region loaded`
      : `Map loaded: ${loadedMap.zones.length} zone, ${loadedMap.spawns.length} spawn`);

    const spawn = findSpawnObject(loadedMap, spawnName, activeCharacter);
    const spawnInteriorId = isWorldV2Map(loadedMap.mapId) ? getLocalInteriorId(spawn) : null;
    activeCaveInteriorIdRef.current = spawnInteriorId;
    if (spawnInteriorId) invalidateDynamicMapOverview();
    const nextPosition = spawn
      ? getObjectPosition(spawn)
      : getRaceStartPosition(loadedMap, activeCharacter?.raceId);
    const safePosition = {
      x: clamp(nextPosition.x, PLAYER.radius, getTiledWorldPixelWidth(loadedMap) - PLAYER.radius),
      y: clamp(nextPosition.y, PLAYER.radius, getTiledWorldPixelHeight(loadedMap) - PLAYER.radius),
      facing: player.current.facing,
      mapId: loadedMap.mapId,
    };

    player.current = safePosition;
    setPosition({ ...safePosition });
    lastPositionSaveRef.current = {
      at: performance.now(),
      x: safePosition.x,
      y: safePosition.y,
      mapId: loadedMap.mapId,
    };
    persistCurrentPosition(safePosition, loadedMap.mapId);
    if (message) setLastCast(message);
  }, [loadPlayableMap, setDungeonConfirmOpen]);

  const cancelDungeonEntry = () => {
    dungeonEntranceConfirmCooldownRef.current = performance.now() + 900;
    setDungeonConfirmOpen(false);
    setLastCast('Dungeon entry cancelled');
  };

  const confirmDungeonEntry = () => {
    if (mapTransitioningRef.current || !characterRef.current || deadRef.current) return;
    const activeTransition = getActiveTransitionAtPlayer();
    const transitionTargetMapId = getTransitionTargetMapId(activeTransition);
    const isDungeonEntrance = isWorldV2Map(currentMapIdRef.current)
      && (activeTransition?.name === 'dungeon_01_entrance' || transitionTargetMapId === 'dungeon_01');
    if (!isDungeonEntrance) {
      dungeonEntranceConfirmCooldownRef.current = performance.now() + 600;
      setDungeonConfirmOpen(false);
      return;
    }
    const entryError = getDungeonEntryError(characterRef.current);
    if (entryError) {
      dungeonEntranceConfirmCooldownRef.current = performance.now() + 1200;
      setDungeonConfirmOpen(false);
      setLastCast(entryError);
      return;
    }
    setDungeonConfirmOpen(false);
    mapTransitioningRef.current = true;
    switchMap('dungeon_01', 'dungeon_01_start', 'Entered dungeon')
      .finally(() => {
        mapTransitioningRef.current = false;
      });
  };

  const teleportToMapPosition = React.useCallback(async (nextMapId, targetPosition, message) => {
    const activeCharacter = characterRef.current;
    const positionHint = normalizeWorldV2PositionForMap(nextMapId, targetPosition);
    const loadedMap = await loadPlayableMap(nextMapId, positionHint);
    tiledWorld.current = loadedMap;
    currentMapIdRef.current = loadedMap.mapId;
    setCurrentMapId(loadedMap.mapId);
    activeCaveInteriorIdRef.current = null;
    lastCaveEntranceKeyRef.current = null;
    enemies.current = [];
    combatEnemyIdsRef.current.clear();
    effects.current = [];
    remotePlayersRef.current = [];
    displayedRemotePlayersRef.current = [];
    setSelectedPlayerId(null);
    worldSpawnPacks.current = createWorldSpawnPacks(isWorldLikeMap(loadedMap.mapId) ? loadedMap.enemySpawns : []);
    nextBossSpawnAt.current = getInitialBossSpawnAt(loadedMap);
    setEnemyCount(0);
    const worldLabel = formatWorldGenerationLabel(loadedMap.worldGenerationId ?? getWorldGenerationIdFromMapId(loadedMap.mapId));
    setMapStatus(loadedMap.isChunkWorld
      ? `${worldLabel} chunk streaming: ${loadedMap.loadedRegions.length} chunks active`
      : loadedMap.isRegionWorld
      ? `${worldLabel} world streaming: ${loadedMap.loadedRegions.length} region loaded`
      : `Map loaded: ${loadedMap.zones.length} zone, ${loadedMap.spawns.length} spawn`);

    const safeTarget = findOpenPointNear(loadedMap, positionHint ?? targetPosition, PLAYER.radius);
    const safePosition = {
      x: clamp(safeTarget.x, PLAYER.radius, getTiledWorldPixelWidth(loadedMap) - PLAYER.radius),
      y: clamp(safeTarget.y, PLAYER.radius, getTiledWorldPixelHeight(loadedMap) - PLAYER.radius),
      facing: targetPosition?.facing ?? player.current.facing,
      mapId: loadedMap.mapId,
    };

    player.current = safePosition;
    setPosition({ ...safePosition });
    lastPositionSaveRef.current = {
      at: performance.now(),
      x: safePosition.x,
      y: safePosition.y,
      mapId: loadedMap.mapId,
    };
    if (activeCharacter) persistCurrentPosition(safePosition, loadedMap.mapId);
    if (message) setLastCast(message);
  }, [loadPlayableMap]);

  const activateWorldV2TransitionTarget = React.useCallback(async (transition) => {
    const rawTarget = getTransitionRawTarget(transition);
    const generationId = getWorldGenerationIdFromMapId(currentMapIdRef.current);
    const target = await findWorldV2RegistryTarget(rawTarget, generationId);
    const sourcePoint = getObjectPosition(transition);
    const loopsToSamePlace = target && sourcePoint && distance(sourcePoint, target) < 384;
    if (!target || loopsToSamePlace) {
      const label = transition?.props?.displayName ?? rawTarget ?? transition?.name ?? 'Transition';
      const now = performance.now();
      if (now - lastTransitionWarningAtRef.current > 1200) {
        lastTransitionWarningAtRef.current = now;
        setLastCast(`${label} is not connected yet`);
      }
      return false;
    }

    await teleportToMapPosition(target.mapId, {
      x: target.x,
      y: target.y,
      facing: player.current.facing,
    }, `Travelled to ${target.displayName}`);
    return true;
  }, [teleportToMapPosition]);

  const teleportToRandomNewWorldRegion = React.useCallback(async (generationId = 'v3') => {
    const generation = getWorldGenerationConfig(generationId);
    const usesActiveContinent = generation.id === 'v3' || generation.aliasOf === 'v3';
    const targetMapId = usesActiveContinent ? WORLD_V3_HUB_MAP_ID : getRandomWorldV2MapId(generation.id);
    const regionOffset = getWorldV2RegionOffset(targetMapId);
    const globalTargetPosition = usesActiveContinent
      ? { ...WORLD_V3_HUB_ARRIVAL }
      : {
        x: regionOffset.x + PLAYER.radius + Math.random() * Math.max(1, WORLD_V2_REGION_PIXEL_SIZE - PLAYER.radius * 2),
        y: regionOffset.y + PLAYER.radius + Math.random() * Math.max(1, WORLD_V2_REGION_PIXEL_SIZE - PLAYER.radius * 2),
      };
    const loadedMap = await buildWorldV2CompositeAround(globalTargetPosition, targetMapId);
    const configuredSpawn = usesActiveContinent
      ? findSpawnObject(loadedMap, WORLD_V3_AFTER_STARTING_SPAWN_NAME, characterRef.current)
      : null;
    const configuredSpawnPosition = configuredSpawn ? getObjectPosition(configuredSpawn) : null;
    const targetPosition = configuredSpawnPosition
      ? { ...configuredSpawnPosition, facing: WORLD_V3_HUB_ARRIVAL.facing }
      : globalTargetPosition;
    const safeTarget = findOpenPointNear(loadedMap, targetPosition, PLAYER.radius);
    const safeMapId = getWorldV2MapIdFromPoint(safeTarget.x, safeTarget.y, generation.id) ?? loadedMap.mapId;
    tiledWorld.current = { ...loadedMap, mapId: safeMapId };
    currentMapIdRef.current = safeMapId;
    setCurrentMapId(safeMapId);
    enemies.current = [];
    combatEnemyIdsRef.current.clear();
    effects.current = [];
    remotePlayersRef.current = [];
    displayedRemotePlayersRef.current = [];
    setSelectedPlayerId(null);
    worldSpawnPacks.current = createWorldSpawnPacks(isWorldLikeMap(safeMapId) ? loadedMap.enemySpawns : []);
    nextBossSpawnAt.current = getInitialBossSpawnAt(loadedMap);
    setEnemyCount(0);
    setMapStatus(`${formatWorldGenerationLabel(loadedMap.worldGenerationId ?? getWorldGenerationIdFromMapId(loadedMap.mapId))} chunk streaming: ${loadedMap.loadedRegions.length} chunks active`);

    const safePosition = {
      x: safeTarget.x,
      y: safeTarget.y,
      facing: player.current.facing,
      mapId: safeMapId,
    };
    player.current = safePosition;
    setPosition({ ...safePosition });
    lastPositionSaveRef.current = {
      at: performance.now(),
      x: safePosition.x,
      y: safePosition.y,
      mapId: safeMapId,
    };
    if (characterRef.current) persistCurrentPosition(safePosition, safeMapId);
    setLastCast(usesActiveContinent ? 'Arrived at Tamzia. Report to the Town Hall.' : 'Entered the new world');
  }, [buildWorldV2CompositeAround]);

  const teleportToAdminTarget = React.useCallback(async (target) => {
    if (!target || !Number.isFinite(Number(target.x)) || !Number.isFinite(Number(target.y))) return;
    const activeCharacter = characterRef.current;
    const targetPosition = normalizeWorldV2PositionForMap(target.mapId, target);
    const loadedMap = await loadPlayableMap(target.mapId, targetPosition);
    tiledWorld.current = loadedMap;
    currentMapIdRef.current = loadedMap.mapId;
    setCurrentMapId(loadedMap.mapId);
    activeCaveInteriorIdRef.current = null;
    lastCaveEntranceKeyRef.current = null;
    enemies.current = [];
    combatEnemyIdsRef.current.clear();
    effects.current = [];
    remotePlayersRef.current = [];
    displayedRemotePlayersRef.current = [];
    setSelectedPlayerId(null);
    worldSpawnPacks.current = createWorldSpawnPacks(isWorldLikeMap(loadedMap.mapId) ? loadedMap.enemySpawns : []);
    nextBossSpawnAt.current = getInitialBossSpawnAt(loadedMap);
    setEnemyCount(0);
    const adminWorldLabel = formatWorldGenerationLabel(loadedMap.worldGenerationId ?? getWorldGenerationIdFromMapId(loadedMap.mapId));
    setMapStatus(loadedMap.isChunkWorld
      ? `${adminWorldLabel} chunk streaming: ${loadedMap.loadedRegions.length} chunks active`
      : loadedMap.isRegionWorld
      ? `${adminWorldLabel} world streaming: ${loadedMap.loadedRegions.length} region loaded`
      : `Map loaded: ${loadedMap.zones.length} zone, ${loadedMap.spawns.length} spawn`);

    const safePosition = {
      x: clamp(Number(targetPosition.x), PLAYER.radius, getTiledWorldPixelWidth(loadedMap) - PLAYER.radius),
      y: clamp(Number(targetPosition.y), PLAYER.radius, getTiledWorldPixelHeight(loadedMap) - PLAYER.radius),
      facing: player.current.facing,
      mapId: loadedMap.mapId,
    };
    player.current = safePosition;
    setPosition({ ...safePosition });
    lastPositionSaveRef.current = {
      at: performance.now(),
      x: safePosition.x,
      y: safePosition.y,
      mapId: loadedMap.mapId,
    };
    if (activeCharacter) persistCurrentPosition(safePosition, loadedMap.mapId);
    setLastCast(target.message ?? `Teleported to ${target.targetName ?? 'player'}`);
  }, [loadPlayableMap]);

  const teleportToNearestRespawnPoint = async () => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter || deadRef.current) return;

    const homeBind = activeCharacter.homeBind;
    if (homeBind?.mapId && Number.isFinite(Number(homeBind.x)) && Number.isFinite(Number(homeBind.y))) {
      await teleportToMapPosition(homeBind.mapId, {
        x: Number(homeBind.x),
        y: Number(homeBind.y),
        facing: Number(homeBind.facing ?? player.current.facing),
      }, `Recalled to ${homeBind.innkeeperName ?? 'your inn'}`);
      setRecallCast(null);
      setInventoryOpen(false);
      return;
    }

    let recallMap = tiledWorld.current;
    let recallOrigin = { x: player.current.x, y: player.current.y };

    if (isWorldV2Map(currentMapIdRef.current)) {
      await teleportToMapPosition(WORLD_V3_HUB_MAP_ID, {
        ...WORLD_V3_HUB_ARRIVAL,
        facing: player.current.facing,
      }, 'Returned to Tamzia');
      setRecallCast(null);
      setInventoryOpen(false);
      return;
    }

    if (currentMapIdRef.current === 'dungeon_01') {
      const raceMapId = getRaceStartMapId(activeCharacter.raceId);
      recallMap = await loadTiledMap(raceMapId);
      tiledWorld.current = recallMap;
      currentMapIdRef.current = recallMap.mapId;
      setCurrentMapId(recallMap.mapId);
      recallOrigin = getRaceStartPosition(recallMap, activeCharacter.raceId);
      enemies.current = [];
      combatEnemyIdsRef.current.clear();
      effects.current = [];
      remotePlayersRef.current = [];
      displayedRemotePlayersRef.current = [];
      setSelectedPlayerId(null);
      worldSpawnPacks.current = createWorldSpawnPacks(isWorldLikeMap(recallMap.mapId) ? recallMap.enemySpawns : []);
      nextBossSpawnAt.current = getInitialBossSpawnAt(recallMap);
      setEnemyCount(0);
      setMapStatus(`Map loaded: ${recallMap.zones.length} zone, ${recallMap.spawns.length} spawn`);
    }

    const respawnPoint = getNearestGraveyardPosition(recallMap, recallOrigin, activeCharacter);
    const safePosition = {
      x: clamp(respawnPoint.x, PLAYER.radius, recallMap.map.width * recallMap.map.tilewidth - PLAYER.radius),
      y: clamp(respawnPoint.y, PLAYER.radius, recallMap.map.height * recallMap.map.tileheight - PLAYER.radius),
      facing: respawnPoint.facing ?? player.current.facing,
      mapId: recallMap.mapId,
    };
    player.current = safePosition;
    setPosition({ ...safePosition });
    persistCurrentPosition(safePosition, recallMap.mapId);
    setRecallCast(null);
    setInventoryOpen(false);
    setLastCast('Teleported to respawn point');
  };

  const useInventoryItem = (item) => {
    if (!item || deadRef.current) return;
    if (isPotionItem(item)) {
      selectMainPotion(item.id);
      setInventoryTab('potions');
      return;
    }
    if (item.action === 'recall') {
      if (recallCast) {
        setLastCast('Recall already casting');
        return;
      }
      const now = performance.now();
      setRecallCast({
        itemId: item.id,
        itemName: item.name,
        startedAt: now,
        completesAt: now + RECALL_CAST_MS,
      });
      setLastCast(`${item.name}: 5s`);
      window.setTimeout(() => {
        if (!characterRef.current || deadRef.current) {
          setRecallCast(null);
          return;
        }
        teleportToNearestRespawnPoint().catch((error) => {
          console.error(error);
          setRecallCast(null);
          setLastCast('Recall failed');
        });
      }, RECALL_CAST_MS);
      return;
    }

    equipItem(item.id);
  };

  const saveCurrentCharacter = () => {
    if (!character) return;
    const updatedCharacter = {
      ...character,
      position: createCurrentPositionSnapshot(),
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    colyseusRoomRef.current?.leave();
    colyseusRoomRef.current = null;
    colyseusSessionIdRef.current = null;
    remotePlayersRef.current = [];
    displayedRemotePlayersRef.current = [];
    onlinePlayersRef.current = [];
    setOnlinePlayers([]);
    setPartyMembers([]);
    setColyseusStatus('Colyseus offline');
    setCharacter(null);
    enemies.current = [];
    combatEnemyIdsRef.current.clear();
    effects.current = [];
    setEnemyCount(0);
    setInventoryOpen(false);
    setShopOpen(false);
    setTalentsOpen(false);
    setAbilityBookOpen(false);
    setQuestLogOpen(false);
    questDialogGiverIdRef.current = null;
    setQuestDialogGiverId(null);
    setSelectedQuestDialogId(null);
    setGameMenuOpen(false);
    setRecallCast(null);
  };

  const exitGame = () => {
    saveCurrentPositionLocally();
    if (window.mmoLauncher?.exitGame) {
      window.mmoLauncher.exitGame();
      return;
    }
    window.close();
  };

  const applyResolution = async (resolution) => {
    if (!resolution) return;
    setSelectedResolutionId(resolution.id);
    try {
      localStorage.setItem('mmo-resolution', resolution.id);
    } catch {
      // Best-effort preference storage.
    }

    try {
      if (window.mmoLauncher?.setResolution) {
        await window.mmoLauncher.setResolution(resolution.width, resolution.height);
      } else {
        window.resizeTo?.(resolution.width, resolution.height);
      }
      setLastCast(`Resolution: ${resolution.label}`);
    } catch (error) {
      setLastCast(`Resolution failed: ${error.message}`);
    }
  };

  React.useEffect(() => {
    const handleCloseLikeEvent = () => saveCurrentPositionLocally();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveCurrentPositionLocally();
    };

    window.addEventListener('beforeunload', handleCloseLikeEvent);
    window.addEventListener('pagehide', handleCloseLikeEvent);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleCloseLikeEvent);
      window.removeEventListener('pagehide', handleCloseLikeEvent);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    loadTiledMap('world')
      .then((loadedMap) => {
        if (cancelled) return;
        tiledWorld.current = loadedMap;
        worldSpawnPacks.current = createWorldSpawnPacks(loadedMap.enemySpawns);
        nextBossSpawnAt.current = getInitialBossSpawnAt(loadedMap);
        currentMapIdRef.current = loadedMap.mapId;
        setCurrentMapId(loadedMap.mapId);
        activeCaveInteriorIdRef.current = null;
        lastCaveEntranceKeyRef.current = null;
        setMapStatus(`Map loaded: ${loadedMap.zones.length} zone, ${loadedMap.spawns.length} spawn`);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setMapStatus('Map fallback active');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const activeCharacter = character;
    if (!activeCharacter) {
      remotePlayersRef.current = [];
      displayedRemotePlayersRef.current = [];
      onlinePlayersRef.current = [];
      enemies.current = [];
      effects.current = [];
      combatEnemyIdsRef.current.clear();
      colyseusRoomRef.current?.leave();
      colyseusRoomRef.current = null;
      colyseusSessionIdRef.current = null;
      setOnlinePlayers([]);
      setPartyMembers([]);
      setEnemyCount(0);
      setColyseusStatus('Colyseus offline');
      return undefined;
    }

    accountSessionClosedRef.current = false;
    let cancelled = false;
    let reconnectTimer = null;
    let reconnectAttempt = 0;

    const returnToLauncherAfterConnectionLoss = () => {
      if (cancelled) return;
      saveCurrentPositionLocally();
      colyseusRoomRef.current = null;
      colyseusSessionIdRef.current = null;
      remotePlayersRef.current = [];
      displayedRemotePlayersRef.current = [];
      onlinePlayersRef.current = [];
      remoteAttackStatesRef.current.clear();
      setOnlinePlayers([]);
      setPartyMembers([]);
      setColyseusStatus('Server connection lost');
      setLastCast('Server connection lost');
      if (window.mmoLauncher?.returnToLauncher) {
        window.mmoLauncher.returnToLauncher();
      } else {
        setCharacter(null);
      }
    };

    const connect = () => {
      if (cancelled || !characterRef.current) return;
      setColyseusStatus(`Connecting ${getColyseusUrl()}...`);

      joinWorldRoom()
        .then((room) => {
        if (cancelled) {
          room.leave();
          return;
        }

        reconnectAttempt = 0;
        colyseusRoomRef.current = room;
        colyseusSessionIdRef.current = room.sessionId;
        setColyseusStatus(`Colyseus online | ${room.sessionId.slice(0, 5)}`);
        const joinStats = getTotalStats(characterRef.current ?? activeCharacter);

        room.send('joinGame', {
          auth: { email: authUserRef.current?.email ?? authUser?.email ?? '' },
          character: {
            name: characterRef.current?.name ?? activeCharacter.name,
            classId: characterRef.current?.classId ?? activeCharacter.classId,
            raceId: characterRef.current?.raceId ?? activeCharacter.raceId,
            appearance: characterRef.current?.appearance ?? activeCharacter.appearance ?? {},
            level: characterRef.current?.level ?? activeCharacter.level ?? 1,
            talents: characterRef.current?.talents ?? activeCharacter.talents ?? { spec: null },
          },
          x: player.current.x,
          y: player.current.y,
          facing: player.current.facing,
          mapId: currentMapIdRef.current,
          interiorId: getActiveLocalInteriorId(),
          hp: vitalsRef.current.hp,
          maxHp: joinStats.health,
        });

        room.onMessage('worldControls', (controls) => {
          applyWorldControls(controls);
        });

        room.onMessage('world', (worldState) => {
          const worldPlayers = (worldState.players ?? [])
            .map(sanitizeWorldPlayer)
            .filter((worldPlayer) => worldPlayer?.id);
          const onlinePlayerList = (worldState.onlinePlayers ?? worldPlayers)
            .map(sanitizeOnlinePlayer)
            .filter(Boolean);
          onlinePlayersRef.current = onlinePlayerList;
          setOnlinePlayers((currentPlayers) => (
            sameOnlinePlayers(currentPlayers, onlinePlayerList) ? currentPlayers : onlinePlayerList
          ));
          const localOnlinePlayer = onlinePlayerList.find((worldPlayer) => worldPlayer.id === room.sessionId)
            ?? worldPlayers.find((worldPlayer) => worldPlayer.id === room.sessionId)
            ?? null;
          const currentPartyId = localOnlinePlayer?.partyId ?? null;

          remotePlayersRef.current = worldPlayers
            .filter((remotePlayer) => remotePlayer.id !== room.sessionId)
            .map((remotePlayer) => ({ ...remotePlayer, receivedAt: performance.now() }));

          const visiblePlayersById = new Map(worldPlayers.map((worldPlayer) => [worldPlayer.id, worldPlayer]));
          const localMapId = normalizeMapId(localOnlinePlayer?.mapId ?? currentMapIdRef.current);
          const localInstanceId = localOnlinePlayer?.instanceId ?? null;
          const nextPartyMembers = currentPartyId
            ? onlinePlayerList
              .filter((onlinePlayer) => onlinePlayer.partyId === currentPartyId)
              .map((onlinePlayer) => {
                const visiblePlayer = visiblePlayersById.get(onlinePlayer.id);
                const sourcePlayer = visiblePlayer ?? onlinePlayer;
                const memberMapId = normalizeMapId(sourcePlayer.mapId ?? onlinePlayer.mapId ?? localMapId);
                const memberInstanceId = sourcePlayer.instanceId ?? onlinePlayer.instanceId ?? null;
                const sameGameplaySpace = getGameplayMapSpaceId(memberMapId) === getGameplayMapSpaceId(localMapId);
                const needsSameInstance = memberMapId === 'dungeon_01' || localMapId === 'dungeon_01';
                const isOutOfPhase = onlinePlayer.id !== room.sessionId
                  && (!sameGameplaySpace || (needsSameInstance && memberInstanceId !== localInstanceId));
                return {
                  id: onlinePlayer.id,
                  name: sourcePlayer.name ?? 'Adventurer',
                  classId: sourcePlayer.classId ?? 'warrior',
                  talents: sourcePlayer.talents ?? { spec: null },
                  level: sourcePlayer.level ?? 1,
                  hp: Math.ceil(clamp(sourcePlayer.hp ?? sourcePlayer.maxHp ?? 1, 0, sourcePlayer.maxHp ?? 1)),
                  maxHp: Math.max(1, Math.ceil(sourcePlayer.maxHp ?? 1)),
                  mapId: memberMapId,
                  instanceId: memberInstanceId,
                  isOutOfPhase,
                  isSelf: onlinePlayer.id === room.sessionId,
                  isLeader: onlinePlayer.partyLeaderId === onlinePlayer.id,
                };
              })
            : [];

          partyMembersRef.current = nextPartyMembers;
          setPartyMembers((currentMembers) => (
            samePartyMembers(currentMembers, nextPartyMembers) ? currentMembers : nextPartyMembers
          ));

          if (
            selectedPlayerIdRef.current
            && !remotePlayersRef.current.some((remotePlayer) => remotePlayer.id === selectedPlayerIdRef.current)
            && !nextPartyMembers.some((member) => member.id === selectedPlayerIdRef.current)
          ) {
            setSelectedPlayerId(null);
          }
          const now = performance.now();
          const serverTime = safeNumber(worldState.serverTime, Date.now());
          const toLocalAttackTime = (value) => (
            Number.isFinite(value) && value > 0 ? now + (value - serverTime) : 0
          );
          locallyDefeatedEnemyIdsRef.current.forEach((expiresAt, enemyId) => {
            if (expiresAt <= now) locallyDefeatedEnemyIdsRef.current.delete(enemyId);
          });
          enemies.current = (worldState.enemies ?? [])
            .map((enemy) => {
              const sanitized = sanitizeEnemy(enemy);
              if (!sanitized) return null;
              return {
                ...sanitized,
                attackStartedAt: toLocalAttackTime(sanitized.attackStartedAt),
                attackLaunchAt: toLocalAttackTime(sanitized.attackLaunchAt),
                attackImpactAt: toLocalAttackTime(sanitized.attackImpactAt),
                attackUntil: toLocalAttackTime(sanitized.attackUntil),
                nextMechanicAt: toLocalAttackTime(sanitized.nextMechanicAt),
                nextSecondaryMechanicAt: toLocalAttackTime(sanitized.nextSecondaryMechanicAt),
                mechanicStartedAt: toLocalAttackTime(sanitized.mechanicStartedAt),
                mechanicLaunchAt: toLocalAttackTime(sanitized.mechanicLaunchAt),
                mechanicImpactAt: toLocalAttackTime(sanitized.mechanicImpactAt),
                mechanicUntil: toLocalAttackTime(sanitized.mechanicUntil),
                mechanicProjectiles: (Array.isArray(sanitized.mechanicProjectiles)
                  ? sanitized.mechanicProjectiles
                  : []).map((projectile) => ({
                  ...projectile,
                  launchAt: toLocalAttackTime(projectile.launchAt),
                  impactAt: toLocalAttackTime(projectile.impactAt),
                })),
              };
            })
            .filter((enemy) => enemy && !locallyDefeatedEnemyIdsRef.current.has(String(enemy.id)));
          setEnemyCount(enemies.current.length);
        });

        room.onMessage('effect', (effect) => {
          if (effect?.casterId && effect.casterId === room.sessionId) {
            return;
          }
          const now = performance.now();
          const visualClassId = effect?.visualClassId ?? effect?.classId ?? 'mage';
          const visual = effect?.visual ?? getAbilityVisualConfig(visualClassId, effect);
          preloadAbilityVisual(visual);
          const sanitizedEffect = sanitizeEffect({
            ...effect,
            classId: visualClassId,
            visualClassId,
            visual,
            start: now,
            nextTickAt: ['channel', 'aura', 'ground', 'hot', 'healGround'].includes(effect?.type) ? now : effect?.nextTickAt,
            duration: effect?.duration ?? (
              ['channel', 'aura', 'ground', 'hot', 'healGround', 'buff'].includes(effect?.type) ? 3000 : 650
            ),
          }, now);
          if (!sanitizedEffect) {
            setRenderStatus('Dropped invalid remote effect');
            return;
          }
          if (effect?.casterId) {
            const usesMageCastRecovery = visualClassId === 'mage' && Boolean(sanitizedEffect.autoAttack);
            remoteAttackStatesRef.current.set(effect.casterId, {
              startedAt: now,
              until: now + (usesMageCastRecovery ? MAGE_CAST_DURATION_MS : 320),
              type: sanitizedEffect.type,
              facing: sanitizedEffect.facing,
              ranged: sanitizedEffect.range > 80 || sanitizedEffect.projectile || sanitizedEffect.autoAttack,
              autoAttack: sanitizedEffect.autoAttack,
              castRecovery: usesMageCastRecovery,
              weaponType: CLASS_SPRITE_DETAILS[visualClassId]?.weapon,
            });
          }
          if (sanitizedEffect.type === 'channel' && sanitizedEffect.casterId) {
            effects.current = effects.current.filter((activeEffect) => !(
              activeEffect.type === 'channel'
              && String(activeEffect.casterId ?? '') === String(sanitizedEffect.casterId)
              && String(activeEffect.key ?? '') === String(sanitizedEffect.key ?? '')
            ));
          }
          effects.current.push(sanitizedEffect);
        });

        room.onMessage('xp', (message) => {
          if (Array.isArray(message?.kills) && message.kills.length > 0) {
            recordQuestKills(message.kills);
            rollNormalMobDrops(message.kills);
          }
          if (message?.amount) awardExperience(message.amount);
          const bossKills = (Array.isArray(message?.kills) ? message.kills : [])
            .filter((kill) => kill.type === 'boss' || String(kill.type ?? '').includes('boss'));
          const bossKillCount = Math.max(message?.bossKills ?? 0, bossKills.length);
          for (let i = 0; i < bossKillCount; i += 1) {
            addLoot(isDungeonEnemyKill(bossKills[i]) ? rollDungeonBossLoot() : rollBossLoot());
          }
        });

        room.onMessage('hit', (message) => {
          const rawDamage = Number(message?.damage ?? 0);
          if (deadRef.current || rawDamage <= 0) return;
          const hitNow = performance.now();
          const damage = mitigateDamageWithCombatBuffs(combatBuffsRef.current, rawDamage, hitNow);
          if (damage <= 0) {
            setLastCast('Blocked');
            return;
          }
          const slowDuration = clamp(safeNumber(message?.slowDuration, 0), 0, 10000);
          if (slowDuration > 0) {
            hostileSlowEffectsRef.current.push({
              until: hitNow + slowDuration,
              multiplier: clamp(safeNumber(message?.slowMultiplier, 0.7), 0.2, 1),
            });
          }
          lastCombatAt.current = hitNow;
          const nextHp = Math.max(0, vitalsRef.current.hp - damage);
          setVitalsValue({ ...vitalsRef.current, hp: nextHp });
          setLastCast(slowDuration > 0 ? `-${damage} HP · Slowed` : `-${damage} HP`);
          if (nextHp <= 0) killPlayer();
        });

        room.onMessage('heal', (message) => {
          const amount = Number(message?.amount ?? 0);
          if (!characterRef.current || deadRef.current || amount <= 0) return;
          const stats = getTotalStats(characterRef.current);
          const nextHp = Math.min(stats.health, vitalsRef.current.hp + amount);
          setVitalsValue({ ...vitalsRef.current, hp: nextHp });
          setLastCast(`+${amount} HP`);
        });

        room.onMessage('resurrected', (message) => {
          const stats = characterRef.current ? getTotalStats(characterRef.current) : BASE_STATS;
          const nextHp = Math.max(1, Math.min(stats.health, Number(message?.hp ?? Math.ceil(stats.health * 0.45))));
          const nextPosition = {
            x: Number(message?.x ?? player.current.x),
            y: Number(message?.y ?? player.current.y),
            facing: player.current.facing,
          };
          player.current = nextPosition;
          setPosition({ ...nextPosition });
          setVitalsValue({ ...vitalsRef.current, hp: nextHp });
          setIsDead(false);
          deadRef.current = false;
          hostileSlowEffectsRef.current = [];
          setLastCast('Resurrected');
        });

        room.onMessage('partyInvite', (message) => {
          if (!message?.fromId) return;
          setPartyInvite({
            fromId: message.fromId,
            fromName: message.fromName ?? 'Adventurer',
          });
        });

        room.onMessage('notice', (message) => {
          if (message?.text) setLastCast(message.text);
        });

        room.onMessage('adminPlayers', (message) => {
          if (!isAdmin) return;
          const nextOnlinePlayers = (message?.onlinePlayers ?? [])
            .map((onlinePlayer) => ({
              ...onlinePlayer,
              id: String(onlinePlayer.id ?? ''),
              email: onlinePlayer.email ?? '',
              name: onlinePlayer.name ?? 'Adventurer',
              level: Math.max(1, Math.floor(safeNumber(onlinePlayer.level, 1))),
              mapId: normalizeMapId(onlinePlayer.mapId),
              x: safeNumber(onlinePlayer.x, 0),
              y: safeNumber(onlinePlayer.y, 0),
            }))
            .filter((onlinePlayer) => onlinePlayer.id);
          setAdminOnlinePlayers(nextOnlinePlayers);
          setAdminPlayersStatus(`${nextOnlinePlayers.length} online player${nextOnlinePlayers.length === 1 ? '' : 's'}`);
        });

        room.onMessage('adminTeleport', (message) => {
          teleportToAdminTarget(message).catch((error) => {
            setAdminPlayersStatus(`Teleport failed: ${error.message}`);
          });
        });

        room.onMessage('adminLevelUp', (message) => {
          const updatedCharacter = applyAdminLevelGainToCharacter(characterRef.current, message?.amount ?? 1);
          if (!updatedCharacter) return;
          persistCharacter(updatedCharacter);
          const stats = getTotalStats(updatedCharacter);
          setVitalsValue({
            ...vitalsRef.current,
            hp: Math.max(vitalsRef.current.hp, stats.health),
            mana: updatedCharacter.classId === 'rogue' || updatedCharacter.classId === 'warrior' ? vitalsRef.current.mana : stats.mana,
          });
          setLastCast(`Admin level up: Level ${updatedCharacter.level}`);
        });

        room.onMessage('adminResult', (message) => {
          if (!message) return;
          if (message.ok === false) {
            const text = message.error ?? 'Admin action failed';
            setAdminPlayersStatus(text);
            setLastCast(text);
            return;
          }
          if (message.action === 'teleportTo') {
            const text = `Teleported to ${message.targetName ?? 'player'}`;
            setAdminPlayersStatus(text);
            setLastCast(text);
          }
          if (message.action === 'summonPlayer') {
            const text = `Brought ${message.targetName ?? 'player'} here`;
            setAdminPlayersStatus(text);
            setLastCast(text);
            requestAdminOnlinePlayers();
          }
          if (message.action === 'teleportToLocation') {
            const x = Math.round(safeNumber(message.x, player.current.x));
            const y = Math.round(safeNumber(message.y, player.current.y));
            const text = `Teleported to ${x}, ${y}`;
            setAdminPlayersStatus(text);
            setLastCast(text);
          }
          if (message.action === 'levelUpPlayer') {
            const text = `${message.targetName ?? 'Player'} is level ${message.level ?? '?'}`;
            setAdminPlayersStatus(text);
            setLastCast(text);
            requestAdminOnlinePlayers();
          }
          if (message.action === 'worldTime') {
            const text = `World time: ${message.phase ?? 'auto'}`;
            setAdminPlayersStatus(text);
            setLastCast(text);
          }
          if (message.action === 'worldTimeSpeed') {
            const text = `World time speed: ${safeNumber(message.multiplier, 1)}x`;
            setAdminPlayersStatus(text);
            setLastCast(text);
          }
          if (message.action === 'weather') {
            const text = `Weather: ${message.weather ?? 'auto'}`;
            setAdminPlayersStatus(text);
            setLastCast(text);
          }
          if (message.action === 'weatherSpeed') {
            const text = `Weather speed: ${safeNumber(message.multiplier, 1)}x`;
            setAdminPlayersStatus(text);
            setLastCast(text);
          }
        });

        room.onMessage('accountReplaced', (message) => {
          accountSessionClosedRef.current = true;
          if (message?.text) setLastCast(message.text);
          setColyseusStatus('Account active in another client');
          setRecallCast(null);
          setCharacter(null);
        });

        room.onMessage('channelEnd', (message) => {
          const casterId = message?.casterId == null ? null : String(message.casterId);
          if (!casterId) return;
          const key = message?.key == null ? null : String(message.key);
          effects.current = effects.current.filter((effect) => !(
            effect.type === 'channel'
            && String(effect.casterId ?? '') === casterId
            && (!key || String(effect.key ?? '') === key)
          ));
          remoteAttackStatesRef.current.delete(casterId);
        });

        room.onLeave(() => {
          if (cancelled) return;
          colyseusRoomRef.current = null;
          colyseusSessionIdRef.current = null;
          remotePlayersRef.current = [];
          displayedRemotePlayersRef.current = [];
          onlinePlayersRef.current = [];
          remoteAttackStatesRef.current.clear();
          setOnlinePlayers([]);
          setPartyMembers([]);
          if (accountSessionClosedRef.current) {
            setColyseusStatus('Account active in another client');
            return;
          }
          reconnectAttempt += 1;
          if (reconnectAttempt >= COLYSEUS_MAX_RECONNECT_ATTEMPTS) {
            returnToLauncherAfterConnectionLoss();
            return;
          }
          setColyseusStatus(`Colyseus reconnecting... (${reconnectAttempt})`);
          reconnectTimer = window.setTimeout(connect, COLYSEUS_RECONNECT_MS);
        });
      })
      .catch((error) => {
        if (cancelled) return;
        colyseusRoomRef.current = null;
        colyseusSessionIdRef.current = null;
        remotePlayersRef.current = [];
        displayedRemotePlayersRef.current = [];
        onlinePlayersRef.current = [];
        remoteAttackStatesRef.current.clear();
        setOnlinePlayers([]);
        setPartyMembers([]);
        reconnectAttempt += 1;
        if (reconnectAttempt >= COLYSEUS_MAX_RECONNECT_ATTEMPTS) {
          returnToLauncherAfterConnectionLoss();
          return;
        }
        setColyseusStatus(`Colyseus retry ${reconnectAttempt}: ${error.message}`);
        reconnectTimer = window.setTimeout(connect, Math.min(6000, COLYSEUS_RECONNECT_MS * reconnectAttempt));
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      remotePlayersRef.current = [];
      displayedRemotePlayersRef.current = [];
      onlinePlayersRef.current = [];
      remoteAttackStatesRef.current.clear();
      partyInviteCooldownsRef.current.clear();
      setOnlinePlayers([]);
      setPartyMembers([]);
      colyseusRoomRef.current?.leave();
      colyseusRoomRef.current = null;
      colyseusSessionIdRef.current = null;
    };
  }, [character?.id]);

  React.useEffect(() => {
    const getDamageMultiplier = (ability, now) => {
      return getCombatDamageMultiplier(combatBuffsRef.current, ability, now);
    };

    const sanitizeAbilityRoomMessage = (message) => {
      if (!message?.ability) return null;
      const ability = { ...message.ability };
      [
        'damage',
        'healing',
        'radius',
        'range',
        'width',
        'angle',
        'arc',
        'duration',
        'tickRate',
        'segmentMs',
        'maxTargets',
        'chainRange',
        'absorb',
        'damageReduction',
        'regenPerSecond',
        'damageMultiplier',
        'leechPercent',
        'autoDamageMultiplier',
        'strikeDamageMultiplier',
        'stealthDamageMultiplier',
        'cooldownMultiplier',
        'poisonDamage',
        'poisonDuration',
        'poisonTickRate',
        'bleedDamage',
        'bleedTickRate',
        'postDamageMultiplier',
        'postDamageDuration',
        'furyGain',
        'multiStrike',
        'trapOffset',
        'slowDuration',
        'slowMultiplier',
        'freezeDuration',
        'stunDuration',
        'bonusVsControlledMultiplier',
        'burnDamage',
        'burnDuration',
        'burnTickRate',
        'damageTakenMultiplier',
        'damageTakenDuration',
        'manaRegenPerSecond',
        'furyRegenPerSecond',
        'attackSpeedMultiplier',
        'petAttackSpeedMultiplier',
        'petBleedDamage',
        'petBleedDuration',
        'maxHealthMultiplier',
        'autoBoltDamage',
        'autoBoltInterval',
        'selfHealPercent',
        'manaCost',
        'furyCost',
        'energyCost',
      ].forEach((key) => {
        if (ability[key] != null) ability[key] = safeNumber(ability[key], 0);
      });
      if (Array.isArray(ability.chainTargets)) {
        ability.chainTargets = ability.chainTargets
          .map((target) => (target && isFinitePoint(target)
            ? {
              id: target.id == null ? undefined : String(target.id),
              x: safeNumber(target.x),
              y: safeNumber(target.y),
              radius: safeNumber(target.radius, ENEMY.radius),
            }
            : null))
          .filter(Boolean);
      }

      const origin = safePoint(message.origin, player.current);
      if (!origin) return null;
      const sanitized = {
        ...message,
        ability,
        origin,
        facing: safeNumber(message.facing, safeNumber(player.current?.facing, 0)),
      };
      if (sanitized.damage != null) sanitized.damage = clamp(safeNumber(sanitized.damage, 0), 0, 10000);
      if (sanitized.healing != null) sanitized.healing = clamp(safeNumber(sanitized.healing, 0), 0, 10000);
      if (sanitized.targetEnemyId != null) sanitized.targetEnemyId = String(sanitized.targetEnemyId);
      if (sanitized.targetPlayerId != null) sanitized.targetPlayerId = String(sanitized.targetPlayerId);
      return sanitized;
    };

    const sendAbilityToRoom = (room, message) => {
      const safeMessage = sanitizeAbilityRoomMessage(message);
      if (!room || !safeMessage) return false;
      try {
        room.send('ability', safeMessage);
        return true;
      } catch (error) {
        console.error('Ability send failed', error, safeMessage);
        setColyseusStatus(`Colyseus send failed: ${error.message}`);
        return false;
      }
    };

    const healFromLeech = (damageDone, now) => {
      const buffs = combatBuffsRef.current;
      if (!characterRef.current || now >= buffs.damageFormUntil || !(buffs.leechPercent > 0) || damageDone <= 0) return;
      const stats = getTotalStats(characterRef.current);
      const healing = Math.max(1, Math.floor(damageDone * buffs.leechPercent));
      setVitalsValue({
        ...vitalsRef.current,
        hp: Math.min(stats.health, vitalsRef.current.hp + healing),
      });
    };

    const applyCombatBuff = (ability, now) => {
      const buffs = combatBuffsRef.current;
      const until = now + (ability.duration ?? 5000);
      if (ability.autoDamageMultiplier || ability.strikeDamageMultiplier) {
        buffs.autoEmpowerUntil = until;
        buffs.autoDamageMultiplier = ability.autoDamageMultiplier ?? 1;
        buffs.strikeDamageMultiplier = ability.strikeDamageMultiplier ?? 1;
      }
      if (ability.damageMultiplier || ability.leechPercent) {
        buffs.damageFormUntil = until;
        buffs.damageMultiplier = ability.damageMultiplier ?? 1;
        buffs.leechPercent = ability.leechPercent ?? 0;
      }
      if (ability.healingMultiplier) {
        buffs.healingFormUntil = until;
        buffs.healingMultiplier = ability.healingMultiplier ?? 1;
      }
      if (ability.noCooldowns) {
        buffs.noCooldownUntil = until;
      }
      if (ability.noManaCost) {
        buffs.noManaCostUntil = until;
      }
      if (ability.noEnergyCost) {
        buffs.noEnergyCostUntil = until;
      }
      if (ability.cooldownMultiplier) {
        buffs.cooldownMultiplierUntil = until;
        buffs.cooldownMultiplier = ability.cooldownMultiplier;
      }
      if (ability.invisibility) {
        buffs.invisibleUntil = until;
        buffs.stealthDamageMultiplier = ability.stealthDamageMultiplier ?? buffs.stealthDamageMultiplier ?? 1.35;
      }
      if (ability.poisonWindow) {
        buffs.poisonBladeUntil = until;
        buffs.poisonDamage = ability.poisonDamage ?? 9;
        buffs.poisonDuration = ability.poisonDuration ?? 5000;
        buffs.poisonTickRate = ability.poisonTickRate ?? 1000;
      }
      if (ability.damageReduction) {
        buffs.damageReductionUntil = until;
        buffs.damageReduction = ability.damageReduction;
      }
      if (ability.regenPerSecond) {
        buffs.regenUntil = until;
        buffs.regenPerSecond = ability.regenPerSecond;
      }
      if (ability.manaRegenPerSecond) {
        buffs.manaRegenUntil = until;
        buffs.manaRegenPerSecond = ability.manaRegenPerSecond;
      }
      if (ability.furyRegenPerSecond) {
        buffs.furyRegenUntil = until;
        buffs.furyRegenPerSecond = ability.furyRegenPerSecond;
      }
      if (ability.attackSpeedMultiplier) {
        buffs.attackSpeedUntil = until;
        buffs.attackSpeedMultiplier = ability.attackSpeedMultiplier;
      }
      if (ability.petAttackSpeedMultiplier || ability.petBleedDamage || ability.petBleedDuration) {
        buffs.petAttackSpeedUntil = until;
        buffs.petAttackSpeedMultiplier = ability.petAttackSpeedMultiplier ?? 1;
        buffs.petBleedDamage = ability.petBleedDamage ?? 0;
        buffs.petBleedDuration = ability.petBleedDuration ?? 0;
      }
      if (ability.burnWindow) {
        buffs.burnWindowUntil = until;
        buffs.burnDamage = ability.burnDamage ?? 10;
        buffs.burnDuration = ability.burnDuration ?? 5000;
        buffs.burnTickRate = ability.burnTickRate ?? 1000;
        buffs.burnStacking = ability.burnStacking ?? true;
      }
      if (ability.rootSelf) {
        buffs.rootSelfUntil = until;
      }
      if (ability.maxHealthMultiplier) {
        buffs.maxHealthMultiplierUntil = until;
        buffs.maxHealthMultiplier = ability.maxHealthMultiplier;
      }
      if (ability.autoCombatBolt) {
        buffs.autoCombatBoltUntil = until;
        buffs.autoBoltName = ability.autoBoltName ?? 'Auto Bolt';
        buffs.autoBoltDamage = ability.autoBoltDamage ?? 24;
        buffs.autoBoltInterval = Math.max(250, ability.autoBoltInterval ?? 1000);
        buffs.autoBoltCombatOnly = ability.autoBoltCombatOnly !== false;
        buffs.autoBoltTargetId = null;
        buffs.nextAutoCombatBoltAt = now + 80;
      }
      if (ability.invulnerable) {
        buffs.invulnerableUntil = until;
      }
      if (ability.absorb) {
        buffs.shieldAbsorb = Math.max(buffs.shieldAbsorb, ability.absorb);
        buffs.shieldUntil = Math.max(buffs.shieldUntil ?? 0, until);
      }
    };

    const applyAbilityDamage = (ability, facing, now, originOverride = player.current, options = {}) => {
      const origin = safePoint(originOverride, player.current);
      const statBonus = characterRef.current
        ? Math.floor(
            ((getTotalStats(characterRef.current).strength ?? 0)
              + (getTotalStats(characterRef.current).agility ?? 0)
              + (getTotalStats(characterRef.current).intellect ?? 0)) / 8,
          )
        : 0;
      const damage = options.damage ?? Math.ceil((ability.damage + statBonus) * getDamageMultiplier(ability, now));
      const targetEnemyIds = Array.isArray(options.targetEnemyIds)
        ? new Set(options.targetEnemyIds.map((id) => String(id)))
        : null;
      const chainTargets = !targetEnemyIds && ability.type === 'chain'
        ? selectChainEnemyTargets(enemies.current.filter(canShareLocalInteriorSpace), ability, origin, facing, colyseusSessionIdRef.current ?? 'local')
        : null;
      let totalDamageDone = 0;

      const damagedEnemies = enemies.current.map((enemy) => {
        if (!canShareLocalInteriorSpace(enemy)) return enemy;
        const hit = targetEnemyIds
          ? targetEnemyIds.has(String(enemy.id))
          : chainTargets
            ? chainTargets.has(enemy.id)
            : abilityHitsEnemyClient(ability, origin, facing, enemy);
        if (!hit) return enemy;
        combatEnemyIdsRef.current.add(String(enemy.id));
        if (hasHunterPet(characterRef.current)) {
          hunterPetRef.current.targetEnemyId = enemy.id;
        }
        lastCombatAt.current = now;
        const finalDamage = getAbilityDamageAgainstEnemy(ability, damage, enemy, now);
        totalDamageDone += Math.min(enemy.hp, finalDamage);
        const ownerId = colyseusSessionIdRef.current ?? 'local';
        return applyAbilityDebuffsClient(
          {
            ...enemy,
            state: 'aggro',
            hp: enemy.hp - finalDamage,
            targetPlayerId: enemy.targetPlayerId ?? ownerId,
            firstHitPlayerId: enemy.firstHitPlayerId ?? ownerId,
            leashStartedAt: null,
            aggroDisabledUntil: null,
            hitAt: now,
          },
          ability,
          ownerId,
          now,
        );
      });

      const defeatedEnemies = damagedEnemies.filter((enemy) => enemy.hp <= 0);
      enemies.current = damagedEnemies.filter((enemy) => enemy.hp > 0);

      if (defeatedEnemies.length > 0) {
        recordQuestKills(defeatedEnemies);
        rollNormalMobDrops(defeatedEnemies);
        awardExperience(defeatedEnemies.reduce((total, enemy) => total + (enemy.xp ?? ENEMY_XP), 0));
        if (defeatedEnemies.some((enemy) => enemy.type === 'boss')) {
          nextBossSpawnAt.current = performance.now() + BOSS_RESPAWN_DELAY;
        }
        defeatedEnemies
          .filter((enemy) => enemy.type === 'enemy' && enemy.spawnId)
          .forEach((enemy) => scheduleWorldSpawnRespawn(worldSpawnPacks.current, enemy.spawnId, now, enemy.spawnSlot));
        defeatedEnemies
          .filter((enemy) => enemy.type === 'boss')
          .forEach((enemy) => addLoot(isDungeonEnemyKill(enemy) ? rollDungeonBossLoot() : rollBossLoot()));
      }
      healFromLeech(totalDamageDone, now);
      setEnemyCount(enemies.current.length);
    };

    const applyAbilityHealing = (ability, now = performance.now()) => {
      if (!ability.healing || !characterRef.current) return;

      const stats = getTotalStats(characterRef.current);
      const intellectBonus = Math.floor((stats.intellect ?? 0) / 3);
      const healing = Math.ceil((ability.healing + intellectBonus) * getCombatHealingMultiplier(combatBuffsRef.current, now));
      const nextHp = Math.min(stats.health, vitalsRef.current.hp + healing);
      setVitalsValue({ ...vitalsRef.current, hp: nextHp });
    };

    const getLocallyHitEnemies = (ability, origin, facing) => {
      if (!ability || !isFinitePoint(origin)) return [];
      const localEnemies = enemies.current.filter((enemy) => {
        if (!enemy || enemy.hp <= 0) return false;
        if (!canShareLocalInteriorSpace(enemy)) return false;
        if (
          currentMapIdRef.current
          && enemy.mapId
          && getGameplayMapSpaceId(enemy.mapId) !== getGameplayMapSpaceId(currentMapIdRef.current)
        ) return false;
        return abilityHitsEnemyClient(ability, origin, facing, enemy);
      });

      if (ability.type === 'chain') {
        return selectChainEnemyTargetList(localEnemies, ability, origin, facing, colyseusSessionIdRef.current ?? 'local');
      }

      if ((ability.type === 'strike' || ability.type === 'shot' || ability.type === 'bolt' || ability.type === 'channel') && !ability.pierce) {
        return localEnemies
          .sort((a, b) => distance(a, origin) - distance(b, origin))
          .slice(0, 1);
      }

      return localEnemies;
    };

    const getAbilityImpactDelayMs = (ability, origin, target = null) => {
      if (!ability || !isFinitePoint(origin)) return 0;
      if (ability.type === 'bolt' || ability.type === 'shot') {
        const travelDistance = target && isFinitePoint(target)
          ? distance(origin, target)
          : Math.min(safeNumber(ability.range, ability.type === 'shot' ? 560 : 520), ability.type === 'shot' ? 560 : 520);
        const speed = ability.type === 'shot' ? 1220 : 980;
        return clamp((travelDistance / speed) * 1000, 120, 680);
      }
      if (ability.type === 'cleave' && String(ability.name ?? '').toLowerCase().includes('multishot')) {
        const travelDistance = target && isFinitePoint(target)
          ? distance(origin, target)
          : Math.min(safeNumber(ability.range, 420), 620);
        return clamp((travelDistance / 1220) * 1000, 160, 620);
      }
      if (ability.type === 'strike' || ability.type === 'cleave') return 120;
      if (ability.type === 'nova') return 90;
      return 0;
    };

    const sendDamageToHitEnemies = (room, ability, origin, facing, damage, options = {}) => {
      if (!room || !(damage > 0)) return false;
      const hitEnemies = (options.hitEnemies ?? getLocallyHitEnemies(ability, origin, facing))
        .filter(canShareLocalInteriorSpace);
      if (hitEnemies.length === 0) return false;

      hitEnemies.forEach((enemy) => {
        combatEnemyIdsRef.current.add(String(enemy.id));
        if (hasHunterPet(characterRef.current)) {
          hunterPetRef.current.targetEnemyId = enemy.id;
        }
        sendAbilityToRoom(room, {
          ability: abilityNetworkPayload(ability),
          origin,
          facing,
          damage,
          targetEnemyId: enemy.id,
          silent: options.silent ?? false,
        });
        if (enemy.hp <= damage) {
          locallyDefeatedEnemyIdsRef.current.set(String(enemy.id), performance.now() + 900);
        }
      });

      enemies.current = enemies.current.filter((enemy) => !locallyDefeatedEnemyIdsRef.current.has(String(enemy.id)));
      setEnemyCount(enemies.current.length);
      return true;
    };

    const pushLocalEffect = (ability, facing, now, origin = player.current) => {
      const safeOrigin = safePoint(origin, lastSafePlayerPositionRef.current);
      const visualClassId = ability.visualClassId ?? ability.classId ?? characterRef.current?.classId ?? selectedClassRef.current;
      const visual = ability.visual ?? getAbilityVisualConfig(visualClassId, ability);
      preloadAbilityVisual(visual);
      const sanitizedEffect = sanitizeEffect({
        ...ability,
        classId: visualClassId,
        visualClassId,
        visual,
        casterId: colyseusSessionIdRef.current ?? 'local',
        localCaster: true,
        holdKey: ability.holdKey,
        followCaster: shouldEffectFollowCaster(ability),
        x: safeOrigin.x,
        y: safeOrigin.y,
        facing: safeNumber(facing, safeNumber(player.current?.facing, 0)),
        targetPlayerId: ability.targetPlayerId,
        start: now,
        nextTickAt: ability.type === 'channel' || ability.type === 'aura' || ability.type === 'ground' || ability.type === 'hot' || ability.type === 'healGround'
          ? safeNumber(ability.nextTickAt, now)
          : ability.nextTickAt,
        duration: ability.type === 'channel'
          ? ability.channelMaxDuration ?? CHANNEL_MAX_DURATION_MS
          : ability.type === 'aura' || ability.type === 'ground' || ability.type === 'healGround' || ability.type === 'hot' || ability.type === 'buff'
            ? ability.duration ?? 5000
          : ability.type === 'shield' || ability.type === 'heal'
            ? 900
            : ability.duration ?? 650,
      }, now);
      if (!sanitizedEffect) {
        setRenderStatus(`Dropped invalid ${ability?.name ?? 'ability'} effect`);
        return null;
      }
      effects.current.push(sanitizedEffect);
      return sanitizedEffect;
    };

    const fireAbility = (slot) => {
      const classId = selectedClassRef.current;
      if (!classId || deadRef.current) return;

      const now = performance.now();
      const cooldownsDisabled = now < (combatBuffsRef.current.noCooldownUntil ?? 0);
      if (!cooldownsDisabled && now < cooldowns.current[slot]) return;

      const activeCharacter = characterRef.current;
      const unlockedAbilities = getCharacterAbilities(activeCharacter);
      const storedAbilityId = abilitySlotsRef.current[slot - 1];
      const finalAbility = slot === 5 ? getFinalAbilityForCharacter(activeCharacter) : null;
      let resolvedAbility = resolveAbility(unlockedAbilities, storedAbilityId, slot);
      if (finalAbility && (!resolvedAbility || String(resolvedAbility.key) !== '5')) {
        resolvedAbility = finalAbility;
      }
      if (!resolvedAbility) return;
      const resolvedAbilityId = getAbilityId(resolvedAbility);
      if (storedAbilityId !== resolvedAbilityId) {
        const nextSlots = [...abilitySlotsRef.current];
        nextSlots[slot - 1] = resolvedAbilityId;
        abilitySlotsRef.current = nextSlots;
        setAbilitySlots(nextSlots);
      }
      let ability = attachAbilityVisual(resolvedAbility, classId);
      ability = enrichAbilityForCast(ability, activeCharacter, combatBuffsRef.current, now, { consumeStealth: true });
      if (activeCharacter?.classId === 'rogue' && abilityDealsDamage(ability)) {
        effects.current = effects.current.filter((effect) => !(effect.type === 'buff' && (effect.invisibility || String(effect.name ?? '').toLowerCase().includes('vanish'))));
      }
      if (ability.type === 'trap') {
        ability = {
          ...ability,
          trapOffset: 0,
          duration: Math.max(15000, safeNumber(ability.duration, 15000)),
          tickRate: Math.max(120, safeNumber(ability.tickRate, 160)),
        };
      }
      const resourceConfig = getResourceConfig(activeCharacter);
      const resourceCost = getEffectiveAbilityResourceCost(ability, activeCharacter, combatBuffsRef.current, now);
      const currentResource = getCurrentResource(activeCharacter, vitalsRef.current);
      if (currentResource < resourceCost) {
        setLastCast(`Not enough ${resourceConfig.label.toLowerCase()}`);
        return;
      }
      const safeMouse = isFinitePoint(mouse.current) ? mouse.current : player.current;
      const facing = Number.isFinite(Math.atan2(safeMouse.y - player.current.y, safeMouse.x - player.current.x))
        ? Math.atan2(safeMouse.y - player.current.y, safeMouse.x - player.current.x)
        : safeNumber(player.current.facing, 0);
      let origin = ability.groundAtCursor || ability.type === 'trap'
        ? safePoint(safeMouse, player.current)
        : { x: player.current.x, y: player.current.y };
      if (ability.teleportToTarget) {
        const target = getLocallyHitEnemies(ability, origin, facing)[0];
        if (target) {
          const offsetX = Math.cos(facing) * -46;
          const offsetY = Math.sin(facing) * -46;
          player.current.x = clamp(target.x + offsetX, PLAYER.radius, WORLD.width - PLAYER.radius);
          player.current.y = clamp(target.y + offsetY, PLAYER.radius, WORLD.height - PLAYER.radius);
          lastSafePlayerPositionRef.current = { ...player.current };
          origin = { x: player.current.x, y: player.current.y };
          combatBuffsRef.current.stealthDamageUntil = Math.max(
            combatBuffsRef.current.stealthDamageUntil ?? 0,
            now + (ability.postDamageDuration ?? 2000),
          );
          combatBuffsRef.current.stealthDamageMultiplier = ability.postDamageMultiplier ?? 1.25;
        }
      }
      player.current.facing = facing;
      player.current.attack = {
        startedAt: now,
        until: now + 320,
        type: ability.type,
        facing,
        ranged: ability.range > 80 || ability.projectile,
        weaponType: CLASS_SPRITE_DETAILS[activeCharacter?.classId]?.weapon,
      };
      const room = colyseusRoomRef.current;
      const stats = activeCharacter ? getTotalStats(activeCharacter) : BASE_STATS;
      const damage = ability.damage
        ? Math.ceil(
            (ability.damage + Math.floor(((stats.strength ?? 0) + (stats.agility ?? 0) + (stats.intellect ?? 0)) / 8))
              * getDamageMultiplier(ability, now),
          )
        : 0;
      const healing = ability.healing
        ? Math.ceil((ability.healing + Math.floor((stats.intellect ?? 0) / 3)) * getCombatHealingMultiplier(combatBuffsRef.current, now))
        : 0;

      if (ability.type === 'channel') {
        if (!cooldownsDisabled) cooldowns.current[slot] = now + getEffectiveAbilityCooldownMs(ability, combatBuffsRef.current, now);
        effects.current = effects.current.filter((effect) => {
          if (effect.type === 'channel' && effect.localCaster) sendChannelEndToRoom(effect);
          return effect.type !== 'channel';
        });
        ability = {
          ...ability,
          holdKey: String(slot),
        };
        if (room) {
          pushLocalEffect(ability, facing, now, origin);
          sendAbilityToRoom(room, {
            ability: abilityNetworkPayload(ability),
            origin,
            facing,
            damage,
            effectOnly: true,
          });
        } else {
          pushLocalEffect({
            ...ability,
            tickRate: ability.tickRate ?? 500,
          }, facing, now);
        }
        setLastCast(`${ability.key}: ${ability.name}`);
        return;
      }

      const nextVitals = {
        ...vitalsRef.current,
        [resourceConfig.key]: clamp(
          currentResource - resourceCost + (resourceConfig.key === 'fury' ? safeNumber(ability.furyGain, 0) : 0),
          0,
          resourceConfig.max,
        ),
      };
      setVitalsValue(nextVitals);
      if (!cooldownsDisabled) cooldowns.current[slot] = now + getEffectiveAbilityCooldownMs(ability, combatBuffsRef.current, now);

      if (ability.type === 'buff') {
        applyCombatBuff(ability, now);
        pushLocalEffect(ability, facing, now, origin);
        if (room) {
          sendAbilityToRoom(room, {
            ability: abilityNetworkPayload(ability),
            origin,
            facing,
            effectOnly: true,
          });
        }
        if (ability.spawnGrounds && ability.spawnGroundAbility) {
          const count = ability.spawnGrounds;
          for (let index = 0; index < count; index += 1) {
            const angle = facing + (index - (count - 1) / 2) * 0.72;
            const spawnOrigin = {
              x: safeMouse.x + Math.cos(angle) * 82,
              y: safeMouse.y + Math.sin(angle) * 82,
            };
            const spawnedAbility = {
              ...ability.spawnGroundAbility,
              key: ability.key,
              groundAtCursor: true,
            };
            pushLocalEffect(spawnedAbility, facing, now, spawnOrigin);
            if (room) {
              sendAbilityToRoom(room, {
                ability: abilityNetworkPayload(spawnedAbility),
                origin: spawnOrigin,
                facing,
                damage: spawnedAbility.damage
                  ? Math.ceil((spawnedAbility.damage + Math.floor(((stats.strength ?? 0) + (stats.agility ?? 0) + (stats.intellect ?? 0)) / 8))
                    * getDamageMultiplier(spawnedAbility, now))
                  : 0,
                effectOnly: true,
              });
            }
          }
        }
        setLastCast(`${ability.key}: ${ability.name}`);
        return;
      }

      if (ability.type === 'trap') {
        const tickingTrap = { ...ability, nextTickAt: now + 120 };
        pushLocalEffect(tickingTrap, facing, now, origin);
        if (room) {
          sendAbilityToRoom(room, {
            ability: abilityNetworkPayload(tickingTrap),
            origin,
            facing,
            effectOnly: true,
          });
        }
        setLastCast(`${ability.key}: ${ability.name}`);
        return;
      }

      if (ability.type === 'aura' || ability.type === 'ground' || ability.type === 'healGround' || ability.type === 'hot') {
        const effectAbility = ability.type === 'hot'
          ? { ...ability, targetPlayerId: selectedPlayerIdRef.current ?? colyseusSessionIdRef.current ?? 'local' }
          : ability;
        const tickRate = getAbilityTickRateMs(effectAbility);
        const hasTimedPayload = damage > 0 || healing > 0;
        const tickingEffectAbility = hasTimedPayload
          ? { ...effectAbility, tickRate, nextTickAt: now }
          : effectAbility;
        pushLocalEffect(tickingEffectAbility, facing, now, origin);
        if (room) {
          sendAbilityToRoom(room, {
            ability: abilityNetworkPayload(tickingEffectAbility),
            origin,
            facing,
            damage,
            healing,
            targetPlayerId: effectAbility.targetPlayerId,
            effectOnly: true,
          });
        }
        setLastCast(`${ability.key}: ${ability.name}`);
        return;
      }

      if (ability.type === 'chain') {
        const chainTargets = getLocallyHitEnemies(ability, origin, facing)
          .map((enemy) => ({
            id: enemy.id,
            x: enemy.x,
            y: enemy.y,
            radius: enemy.radius ?? ENEMY.radius,
          }));
        if (chainTargets.length === 0) {
          pushLocalEffect({
            ...ability,
            type: 'shield',
            duration: 420,
            damage: 0,
          }, facing, now, origin);
          setLastCast(`${ability.name}: miss`);
          return;
        }
        const segmentMs = ability.segmentMs ?? 230;
        const chainEffect = {
          ...ability,
          chainTargets,
          hitTargetIds: [],
          segmentMs,
          duration: Math.max(650, segmentMs * Math.max(1, chainTargets.length) + 360),
        };

        pushLocalEffect(chainEffect, facing, now, origin);
        if (room) {
          sendAbilityToRoom(room, {
            ability: abilityNetworkPayload(chainEffect, { includeChainTargets: true }),
            origin,
            facing,
            damage: 0,
            effectOnly: true,
          });
        }
        setLastCast(`${ability.key}: ${ability.name}`);
        return;
      }

      if (ability.damage) {
        const anticipatedHits = getLocallyHitEnemies(ability, origin, facing);
        const impactDelay = getAbilityImpactDelayMs(ability, origin, anticipatedHits[0]);
        const applyImpactDamage = () => {
          const impactNow = performance.now();
          if (room) {
            const sentTargetedDamage = sendDamageToHitEnemies(room, ability, origin, facing, damage, {
              hitEnemies: anticipatedHits,
              silent: true,
            });
            if (!sentTargetedDamage && ability.type !== 'strike' && ability.type !== 'shot' && ability.type !== 'bolt') {
              sendAbilityToRoom(room, {
                ability: abilityNetworkPayload(ability),
                origin,
                facing,
                damage,
                healing,
                targetPlayerId: ability.healing ? selectedPlayerIdRef.current : null,
                silent: true,
              });
            }
            healFromLeech(damage, impactNow);
          } else {
            applyAbilityDamage(ability, facing, impactNow, origin, {
              targetEnemyIds: anticipatedHits.map((enemy) => enemy.id),
              damage,
            });
          }
        };
        const isTravelVisual = ['bolt', 'shot'].includes(ability.type)
          || (ability.type === 'cleave' && String(ability.name ?? '').toLowerCase().includes('multishot'));
        const visualAbility = isTravelVisual
          ? { ...ability, duration: Math.max(safeNumber(ability.duration, 520), impactDelay + 180) }
          : ability;
        if (!room) ability = visualAbility;
        if (room) {
          pushLocalEffect(visualAbility, facing, now, origin);
          sendAbilityToRoom(room, {
            ability: abilityNetworkPayload(visualAbility),
            origin,
            facing,
            damage: 0,
            healing: 0,
            effectOnly: true,
          });
        }
        if (impactDelay > 0) {
          window.setTimeout(applyImpactDamage, impactDelay);
        } else {
          applyImpactDamage();
        }
      }
      if (ability.healing) {
        const isTargetedRemoteHeal = Boolean(room && selectedPlayerIdRef.current && ability.type === 'heal');
        if (!isTargetedRemoteHeal) {
          applyAbilityHealing(ability, now);
        }
        if (room && !ability.damage) {
          pushLocalEffect(ability, facing, now, origin);
        }
        if (room && !ability.damage) {
          sendAbilityToRoom(room, {
            ability: abilityNetworkPayload(ability),
            origin,
            facing,
            healing,
            targetPlayerId: selectedPlayerIdRef.current,
          });
        }
      }
      if (!room) {
        pushLocalEffect(ability, facing, now, origin);
      }
      setLastCast(`${ability.key}: ${ability.name}`);
    };

    const onKeyDown = (event) => {
      if (event.repeat) return;
      if (event.key.toLowerCase() === 'c' && characterRef.current) {
        setInventoryOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === 'n' && characterRef.current) {
        setTalentsOpen((open) => !open);
        setInventoryOpen(false);
        setShopOpen(false);
        return;
      }
      if (event.key.toLowerCase() === 'o' && characterRef.current) {
        setFriendsOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === 'm' && characterRef.current) {
        setMapOpen((open) => {
          if (!open) focusWorldMapOnPlayer();
          return !open;
        });
        return;
      }
      if (event.key.toLowerCase() === 'j' && characterRef.current) {
        setJournalOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === 'k' && characterRef.current) {
        setQuestLogOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === 'l' && characterRef.current) {
        setProfessionPanelOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === 'p' && characterRef.current) {
        setAbilityBookOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === 'q' && characterRef.current) {
        useSelectedPotion();
        return;
      }
      if (event.key === 'Escape' && characterRef.current) {
        event.preventDefault();
        event.stopPropagation();
        if (!closeGameplayUiForEscape()) {
          setGameMenuOpen(true);
        }
        return;
      }
      if (event.key.toLowerCase() === 'e' && characterRef.current) {
        const questGiver = getQuestGiverNear(tiledWorld.current, player.current);
        if (questGiver && !deadRef.current) {
          questDialogGiverIdRef.current = questGiver.id;
          setQuestDialogGiverId(questGiver.id);
          setSelectedQuestDialogId(null);
          setShopOpen(false);
          setLastCast(`${questGiver.name}: ${questGiver.title}`);
          return;
        }
        const serviceNpc = getNearbyServiceNpc(tiledWorld.current, player.current);
        if (serviceNpc && !deadRef.current) {
          openServiceNpc(serviceNpc);
        }
        return;
      }
      if (/^[1-9]$/.test(event.key)) {
        const slot = Number(event.key);
        if (slot <= ABILITY_BAR_SLOTS) fireAbility(slot);
      }
    };

    const removeGameEscapeListener = window.mmoLauncher?.onGameEscape?.(() => {
      if (!characterRef.current) return;
      if (!closeGameplayUiForEscape()) {
        setGameMenuOpen(true);
      }
    });

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      removeGameEscapeListener?.();
    };
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let animationFrame = 0;
    let lastTime = performance.now();

    const getDamageMultiplier = (ability, now) => {
      return getCombatDamageMultiplier(combatBuffsRef.current, ability, now);
    };

    const healFromLeech = (damageDone, now) => {
      const buffs = combatBuffsRef.current;
      if (!characterRef.current || now >= buffs.damageFormUntil || !(buffs.leechPercent > 0) || damageDone <= 0) return;
      const stats = getTotalStats(characterRef.current);
      const healing = Math.max(1, Math.floor(damageDone * buffs.leechPercent));
      setVitalsValue({
        ...vitalsRef.current,
        hp: Math.min(stats.health, vitalsRef.current.hp + healing),
      });
    };

    const applyOptimisticEnemyDamage = (targetEnemyId, ability, damage, now, ownerId = colyseusSessionIdRef.current ?? 'local') => {
      if (targetEnemyId == null || !(damage > 0)) return 0;
      let totalDamageDone = 0;
      let hit = false;
      const defeatedEnemies = [];
      const damagedEnemies = enemies.current.map((enemy) => {
        if (String(enemy.id) !== String(targetEnemyId) || enemy.hp <= 0 || !canShareLocalInteriorSpace(enemy)) return enemy;
        hit = true;
        combatEnemyIdsRef.current.add(String(enemy.id));
        lastCombatAt.current = now;
        const finalDamage = getAbilityDamageAgainstEnemy(ability, damage, enemy, now);
        totalDamageDone += Math.min(enemy.hp, finalDamage);
        if (enemy.hp - finalDamage <= 0) defeatedEnemies.push(enemy);
        return applyAbilityDebuffsClient(
          {
            ...enemy,
            hp: enemy.hp - finalDamage,
            state: 'aggro',
            hitAt: now,
            targetPlayerId: enemy.targetPlayerId ?? ownerId,
            firstHitPlayerId: enemy.firstHitPlayerId ?? ownerId,
            leashStartedAt: null,
            aggroDisabledUntil: null,
          },
          ability,
          ownerId,
          now,
        );
      });
      if (!hit) return 0;
      enemies.current = damagedEnemies.filter((enemy) => enemy.hp > 0);
      if (defeatedEnemies.length > 0 && !colyseusRoomRef.current) {
        recordQuestKills(defeatedEnemies);
        rollNormalMobDrops(defeatedEnemies);
      }
      setEnemyCount(enemies.current.length);
      return totalDamageDone;
    };

    const resize = () => {
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(canvas.clientWidth * scale);
      canvas.height = Math.floor(canvas.clientHeight * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      if (mouse.current.screenX === 0 && mouse.current.screenY === 0) {
        mouse.current.screenX = canvas.clientWidth / 2;
        mouse.current.screenY = canvas.clientHeight / 2;
      }
    };

    const updateMouse = (event) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current.screenX = event.clientX - rect.left;
      mouse.current.screenY = event.clientY - rect.top;
      mouse.current.x = mouse.current.screenX + camera.current.x;
      mouse.current.y = mouse.current.screenY + camera.current.y;
    };

    const pushAutoAttackEffect = (ability, facing, now) => {
      const safeOrigin = safePoint(player.current, lastSafePlayerPositionRef.current);
      const visualClassId = ability.visualClassId ?? ability.classId ?? characterRef.current?.classId ?? selectedClassRef.current;
      const sanitizedEffect = sanitizeEffect({
        ...ability,
        classId: visualClassId,
        visualClassId,
        visual: ability.visual ?? getAbilityVisualConfig(visualClassId, ability),
        casterId: colyseusSessionIdRef.current ?? 'local',
        localCaster: true,
        followCaster: shouldEffectFollowCaster(ability),
        x: safeOrigin.x,
        y: safeOrigin.y,
        facing: safeNumber(facing, safeNumber(player.current?.facing, 0)),
        start: now,
        duration: ability.duration ?? 450,
      }, now);
      if (!sanitizedEffect) {
        setRenderStatus(`Dropped invalid ${ability?.name ?? 'attack'} effect`);
        return null;
      }
      effects.current.push(sanitizedEffect);
      return sanitizedEffect;
    };

    const pushLocalEffect = (ability, facing, now, origin = player.current) => {
      const safeOrigin = safePoint(origin, lastSafePlayerPositionRef.current);
      const visualClassId = ability.visualClassId ?? ability.classId ?? characterRef.current?.classId ?? selectedClassRef.current;
      const visual = ability.visual ?? getAbilityVisualConfig(visualClassId, ability);
      preloadAbilityVisual(visual);
      const sanitizedEffect = sanitizeEffect({
        ...ability,
        classId: visualClassId,
        visualClassId,
        visual,
        casterId: colyseusSessionIdRef.current ?? 'local',
        localCaster: true,
        holdKey: ability.holdKey,
        followCaster: shouldEffectFollowCaster(ability),
        x: safeOrigin.x,
        y: safeOrigin.y,
        facing: safeNumber(facing, safeNumber(player.current?.facing, 0)),
        targetPlayerId: ability.targetPlayerId,
        start: now,
        nextTickAt: ability.type === 'channel' || ability.type === 'aura' || ability.type === 'ground' || ability.type === 'hot' || ability.type === 'healGround'
          ? safeNumber(ability.nextTickAt, now)
          : ability.nextTickAt,
        duration: ability.type === 'channel'
          ? ability.channelMaxDuration ?? CHANNEL_MAX_DURATION_MS
          : ability.type === 'aura' || ability.type === 'ground' || ability.type === 'healGround' || ability.type === 'hot' || ability.type === 'buff'
            ? ability.duration ?? 5000
          : ability.type === 'shield' || ability.type === 'heal'
            ? 900
            : ability.duration ?? 650,
      }, now);
      if (!sanitizedEffect) {
        setRenderStatus(`Dropped invalid ${ability?.name ?? 'ability'} effect`);
        return null;
      }
      effects.current.push(sanitizedEffect);
      return sanitizedEffect;
    };

    const sendAbilityToRoom = (room, message, eventName = 'ability') => {
      if (!room || !message?.ability) return false;
      const ability = { ...message.ability };
      [
        'damage',
        'healing',
        'radius',
        'range',
        'width',
        'angle',
        'arc',
        'duration',
        'tickRate',
        'segmentMs',
        'maxTargets',
        'chainRange',
        'absorb',
        'damageReduction',
        'regenPerSecond',
        'damageMultiplier',
        'leechPercent',
        'autoDamageMultiplier',
        'strikeDamageMultiplier',
        'stealthDamageMultiplier',
        'cooldownMultiplier',
        'poisonDamage',
        'poisonDuration',
        'poisonTickRate',
        'bleedDamage',
        'bleedTickRate',
        'postDamageMultiplier',
        'postDamageDuration',
        'furyGain',
        'multiStrike',
        'trapOffset',
        'slowDuration',
        'slowMultiplier',
        'freezeDuration',
        'stunDuration',
        'bonusVsControlledMultiplier',
        'burnDamage',
        'burnDuration',
        'burnTickRate',
        'damageTakenMultiplier',
        'damageTakenDuration',
        'manaRegenPerSecond',
        'furyRegenPerSecond',
        'attackSpeedMultiplier',
        'petAttackSpeedMultiplier',
        'petBleedDamage',
        'petBleedDuration',
        'maxHealthMultiplier',
        'autoBoltDamage',
        'autoBoltInterval',
        'selfHealPercent',
        'manaCost',
        'furyCost',
        'energyCost',
      ].forEach((key) => {
        if (ability[key] != null) ability[key] = safeNumber(ability[key], 0);
      });
      if (Array.isArray(ability.chainTargets)) {
        ability.chainTargets = ability.chainTargets
          .map((target) => (target && isFinitePoint(target)
            ? {
              id: target.id == null ? undefined : String(target.id),
              x: safeNumber(target.x),
              y: safeNumber(target.y),
              radius: safeNumber(target.radius, ENEMY.radius),
            }
            : null))
          .filter(Boolean);
      }

      const origin = safePoint(message.origin, player.current);
      if (!isFinitePoint(origin)) return false;
      const safeMessage = {
        ...message,
        ability,
        origin,
        facing: safeNumber(message.facing, safeNumber(player.current?.facing, 0)),
      };
      if (safeMessage.damage != null) safeMessage.damage = clamp(safeNumber(safeMessage.damage, 0), 0, 10000);
      if (safeMessage.healing != null) safeMessage.healing = clamp(safeNumber(safeMessage.healing, 0), 0, 10000);
      if (safeMessage.targetEnemyId != null) safeMessage.targetEnemyId = String(safeMessage.targetEnemyId);
      if (safeMessage.targetPlayerId != null) safeMessage.targetPlayerId = String(safeMessage.targetPlayerId);

      try {
        room.send(eventName, safeMessage);
        return true;
      } catch (error) {
        console.error(`${eventName} send failed`, error, safeMessage);
        setColyseusStatus(`Colyseus send failed: ${error.message}`);
        return false;
      }
    };

    const sendChannelEndToRoom = (effect) => {
      const room = colyseusRoomRef.current;
      if (!room || !effect || effect.type !== 'channel' || !effect.localCaster) return;
      try {
        room.send('channelEnd', {
          key: effect.key == null ? null : String(effect.key),
          name: effect.name == null ? null : String(effect.name),
        });
      } catch (error) {
        console.error('channelEnd send failed', error);
      }
    };

    const sendTargetedDamageToRoom = (room, message) => {
      if (message?.targetEnemyId == null || !(safeNumber(message?.damage, 0) > 0)) return false;
      return sendAbilityToRoom(room, message, 'targeted-damage');
    };

    const getLocallyHitEnemies = (ability, origin, facing) => {
      if (!ability || !isFinitePoint(origin)) return [];
      const localEnemies = enemies.current.filter((enemy) => {
        if (!enemy || enemy.hp <= 0) return false;
        if (!canShareLocalInteriorSpace(enemy)) return false;
        if (
          currentMapIdRef.current
          && enemy.mapId
          && getGameplayMapSpaceId(enemy.mapId) !== getGameplayMapSpaceId(currentMapIdRef.current)
        ) return false;
        return abilityHitsEnemyClient(ability, origin, facing, enemy);
      });

      if (ability.type === 'chain') {
        return selectChainEnemyTargetList(localEnemies, ability, origin, facing, colyseusSessionIdRef.current ?? 'local');
      }

      if ((ability.type === 'strike' || ability.type === 'shot' || ability.type === 'bolt' || ability.type === 'channel') && !ability.pierce) {
        return localEnemies
          .sort((a, b) => distance(a, origin) - distance(b, origin))
          .slice(0, 1);
      }

      return localEnemies;
    };

    const getAbilityImpactDelayMs = (ability, origin, target = null) => {
      if (!ability || !isFinitePoint(origin)) return 0;
      if (ability.type === 'bolt' || ability.type === 'shot') {
        const travelDistance = target && isFinitePoint(target)
          ? distance(origin, target)
          : Math.min(safeNumber(ability.range, ability.type === 'shot' ? 560 : 520), ability.type === 'shot' ? 560 : 520);
        const speed = ability.type === 'shot' ? 1220 : 980;
        return clamp((travelDistance / speed) * 1000, 120, 680);
      }
      if (ability.type === 'cleave' && String(ability.name ?? '').toLowerCase().includes('multishot')) {
        const travelDistance = target && isFinitePoint(target)
          ? distance(origin, target)
          : Math.min(safeNumber(ability.range, 420), 620);
        return clamp((travelDistance / 1220) * 1000, 160, 620);
      }
      if (ability.type === 'strike' || ability.type === 'cleave') return 120;
      if (ability.type === 'nova') return 90;
      return 0;
    };

    const sendDamageToHitEnemies = (room, ability, origin, facing, damage, options = {}) => {
      if (!room || !(damage > 0)) return false;
      const hitEnemies = (options.hitEnemies ?? getLocallyHitEnemies(ability, origin, facing))
        .filter(canShareLocalInteriorSpace);
      if (hitEnemies.length === 0) return false;

      hitEnemies.forEach((enemy) => {
        combatEnemyIdsRef.current.add(String(enemy.id));
        if (hasHunterPet(characterRef.current)) {
          hunterPetRef.current.targetEnemyId = enemy.id;
        }
        sendAbilityToRoom(room, {
          ability: abilityNetworkPayload(ability),
          origin,
          facing,
          damage,
          targetEnemyId: enemy.id,
          silent: options.silent ?? false,
        });
      });

      return true;
    };

    const launchSingleTargetProjectile = (originInput, target, ability, now, options = {}) => {
      if (!target || target.id == null || target.hp <= 0 || !isFinitePoint(target) || !canShareLocalInteriorSpace(target)) return false;
      const origin = safePoint(originInput, player.current);
      if (!isFinitePoint(origin)) return false;
      const facing = Math.atan2(target.y - origin.y, target.x - origin.x);
      const range = Math.max(
        safeNumber(ability.range, 620),
        distance(origin, target) + clamp(safeNumber(target.radius, ENEMY.radius), 8, 80),
      );
      const travelProbe = {
        ...ability,
        type: options.travelType ?? (ability.type === 'shot' ? 'shot' : 'bolt'),
        range,
      };
      const segmentMs = clamp(
        safeNumber(options.segmentMs, getAbilityImpactDelayMs(travelProbe, origin, target)),
        90,
        700,
      );
      const projectileAbility = attachAbilityVisual({
        ...ability,
        type: 'chain',
        projectile: !options.melee,
        petMelee: Boolean(options.melee),
        range,
        maxTargets: 1,
        chainRange: 1,
        segmentMs,
        duration: segmentMs + safeNumber(options.afterImpactMs, 280),
        hitTargetIds: [],
        chainTargets: [{
          id: String(target.id),
          x: safeNumber(target.x),
          y: safeNumber(target.y),
          radius: clamp(safeNumber(target.radius, ENEMY.radius), 6, 180),
        }],
        followCaster: false,
      }, ability.visualClassId ?? ability.classId ?? characterRef.current?.classId ?? selectedClassRef.current);
      combatEnemyIdsRef.current.add(String(target.id));
      if (hasHunterPet(characterRef.current)) {
        hunterPetRef.current.targetEnemyId = target.id;
      }
      return Boolean(pushLocalEffect(projectileAbility, facing, now, origin));
    };

    const castRightClickShield = (now) => {
      const activeCharacter = characterRef.current;
      if (!activeCharacter || deadRef.current) return;
      if (now < rightClickCooldownRef.current) return;

      const stats = getTotalStats(activeCharacter);
      const rightClickAbility = (() => {
        if (activeCharacter.classId === 'priest') {
          return {
            key: 'M2',
            name: 'Fade',
            type: 'buff',
            color: '#c4b5fd',
            duration: 1500,
            cooldown: 12000,
            radius: 56,
            followCaster: true,
            invulnerable: true,
          };
        }
        if (activeCharacter.classId === 'rogue') {
          return {
            key: 'M2',
            name: 'Vanish',
            type: 'buff',
            color: '#312e81',
            duration: 6000,
            cooldown: 14000,
            radius: 62,
            followCaster: true,
            invisibility: true,
            stealthDamageMultiplier: 1.35,
          };
        }
        if (activeCharacter.classId === 'hunter') {
          return {
            key: 'M2',
            name: 'Disengage Dash',
            type: 'buff',
            color: '#bef264',
            duration: 280,
            cooldown: 8500,
            radius: 38,
            dashDistance: 220,
          };
        }
        if (activeCharacter.classId === 'mage') {
          return {
            key: 'M2',
            name: 'Blink',
            type: 'buff',
            color: '#93c5fd',
            duration: 320,
            cooldown: 9000,
            radius: 42,
            blinkDistance: 260,
          };
        }
        if (activeCharacter.classId === 'warrior') {
          return {
            key: 'M2',
            name: 'War Charge',
            type: 'nova',
            color: '#f97316',
            damage: 24,
            duration: 420,
            cooldown: 10500,
            radius: 92,
            stunDuration: 1000,
            chargeDistance: 260,
            followCaster: true,
          };
        }
        return {
          key: 'M2',
          name: 'Aegis Ward',
          type: 'buff',
          color: activeCharacter.classId === 'paladin' ? '#fef08a' : '#93c5fd',
          duration: 4500,
          cooldown: 10000,
          radius: 58,
          followCaster: true,
          absorb: Math.max(55, Math.floor((stats.health ?? BASE_STATS.health) * 0.22)),
        };
      })();
      const ability = attachAbilityVisual(rightClickAbility, activeCharacter.classId);
      const safeMouse = isFinitePoint(mouse.current) ? mouse.current : player.current;
      const facing = Number.isFinite(Math.atan2(safeMouse.y - player.current.y, safeMouse.x - player.current.x))
        ? Math.atan2(safeMouse.y - player.current.y, safeMouse.x - player.current.x)
        : safeNumber(player.current.facing, 0);
      player.current.facing = facing;
      player.current.attack = {
        startedAt: now,
        until: now + 260,
        type: ability.type,
        facing,
        ranged: false,
        weaponType: CLASS_SPRITE_DETAILS[activeCharacter.classId]?.weapon,
      };
      rightClickCooldownRef.current = now + ability.cooldown;
      const movementDistance = ability.dashDistance ?? ability.blinkDistance ?? ability.chargeDistance ?? 0;
      if (movementDistance > 0) {
        const activeInteriorId = getActiveInteriorId();
        const movementCollisionOptions = activeInteriorId
          ? { activeInteriorId, ignoreWorldCollision: true }
          : undefined;
        const targetDistance = Math.min(movementDistance, Math.max(32, distance(player.current, safeMouse)));
        const targetPoint = findPlayerMovementTarget(
          player.current,
          facing,
          targetDistance,
          movementCollisionOptions,
          ability.blinkDistance ? canBlinkPlayerTo : canMovePlayerTo,
        );
        if (ability.blinkDistance) {
          player.current.x = targetPoint.x;
          player.current.y = targetPoint.y;
          lastSafePlayerPositionRef.current = { ...player.current };
        } else {
          forcedMoveRef.current = {
            x: targetPoint.x,
            y: targetPoint.y,
            speed: ability.chargeDistance ? 880 : 760,
            damageOnFinish: Boolean(ability.chargeDistance),
            ability,
            facing,
            damage: ability.chargeDistance
              ? Math.max(1, Math.floor((ability.damage ?? 0) + ((stats.strength ?? 0) * 0.55)))
              : 0,
          };
        }
      }
      if (ability.invulnerable) {
        combatBuffsRef.current.invulnerableUntil = Math.max(combatBuffsRef.current.invulnerableUntil ?? 0, now + ability.duration);
      }
      if (ability.invisibility) {
        combatBuffsRef.current.invisibleUntil = Math.max(combatBuffsRef.current.invisibleUntil ?? 0, now + ability.duration);
        combatBuffsRef.current.stealthDamageMultiplier = ability.stealthDamageMultiplier ?? 1.35;
      }
      if (ability.absorb) {
        combatBuffsRef.current.shieldAbsorb = Math.max(combatBuffsRef.current.shieldAbsorb, ability.absorb);
        combatBuffsRef.current.shieldUntil = Math.max(combatBuffsRef.current.shieldUntil ?? 0, now + ability.duration);
      }
      pushAutoAttackEffect(ability, facing, now);
      sendAbilityToRoom(colyseusRoomRef.current, {
        ability: abilityNetworkPayload(ability),
        origin: { x: player.current.x, y: player.current.y },
        facing,
        effectOnly: true,
      });
      setLastCast(ability.absorb ? `${ability.name}: ${ability.absorb} shield` : ability.name);
    };

    const runAutoAttack = (now) => {
      if (!characterRef.current || deadRef.current) return;
      if (now < nextAutoAttackAt.current) return;

      const activeCharacter = characterRef.current;
      let ability = attachAbilityVisual(getAutoAttackAbility(activeCharacter.classId, activeCharacter), activeCharacter.classId);
      ability = enrichAbilityForCast(ability, activeCharacter, combatBuffsRef.current, now, { consumeStealth: true });
      if (activeCharacter.classId === 'rogue') {
        effects.current = effects.current.filter((effect) => !(effect.type === 'buff' && (effect.invisibility || String(effect.name ?? '').toLowerCase().includes('vanish'))));
      }
      const safeMouse = isFinitePoint(mouse.current) ? mouse.current : player.current;
      const facing = Number.isFinite(Math.atan2(safeMouse.y - player.current.y, safeMouse.x - player.current.x))
        ? Math.atan2(safeMouse.y - player.current.y, safeMouse.x - player.current.x)
        : safeNumber(player.current.facing, 0);
      player.current.facing = facing;
      const usesMageCastRecovery = activeCharacter.classId === 'mage' && ability.type === 'bolt';
      player.current.attack = {
        startedAt: now,
        until: now + (usesMageCastRecovery ? MAGE_CAST_DURATION_MS : 280),
        type: ability.type,
        facing,
        ranged: isRangedClass(activeCharacter.classId),
        autoAttack: true,
        castRecovery: usesMageCastRecovery,
        weaponType: CLASS_SPRITE_DETAILS[activeCharacter.classId]?.weapon,
      };
      const speedMultiplier = now < (combatBuffsRef.current.attackSpeedUntil ?? 0)
        ? Math.max(0.2, combatBuffsRef.current.attackSpeedMultiplier ?? 1)
        : 1;
      nextAutoAttackAt.current = now + clamp(
        getAutoAttackCooldownMs(activeCharacter) / speedMultiplier,
        AUTO_ATTACK_MIN_COOLDOWN_MS,
        AUTO_ATTACK_MAX_COOLDOWN_MS,
      );

      const stats = getTotalStats(activeCharacter);
      const damage = ability.damage + Math.floor(((stats.strength ?? 0) + (stats.agility ?? 0) + (stats.intellect ?? 0)) / 12);
      const resourceConfig = getResourceConfig(activeCharacter);
      if (resourceConfig.key === 'fury') {
        setVitalsValue({
          ...vitalsRef.current,
          fury: Math.min(resourceConfig.max, (vitalsRef.current.fury ?? 0) + WARRIOR_FURY_PER_ATTACK),
        });
      }

      const room = colyseusRoomRef.current;
      const finalDamage = Math.ceil(damage * getCombatDamageMultiplier(combatBuffsRef.current, ability, now));
      const origin = { x: player.current.x, y: player.current.y };
      const hitEnemies = getLocallyHitEnemies(ability, origin, facing);
      const projectileImpactDelay = getAbilityImpactDelayMs(ability, origin, hitEnemies[0]);
      const impactDelay = projectileImpactDelay + (usesMageCastRecovery ? MAGE_WAND_RELEASE_DELAY_MS : 0);
      const isTravelVisual = ['bolt', 'shot'].includes(ability.type)
        || (ability.type === 'cleave' && String(ability.name ?? '').toLowerCase().includes('multishot'));
      const visualAbility = isTravelVisual
        ? { ...ability, duration: Math.max(safeNumber(ability.duration, 520), impactDelay + 180) }
        : ability;
      if (room) {
        pushAutoAttackEffect(visualAbility, facing, now);
        sendAbilityToRoom(room, {
          ability: abilityNetworkPayload(visualAbility),
          origin,
          facing,
          damage: 0,
          effectOnly: true,
        });
        if (hitEnemies.length === 0) {
          setLastCast(`${ability.name}: miss`);
          return;
        }
        window.setTimeout(() => {
          const sentTargetedDamage = sendDamageToHitEnemies(room, ability, origin, facing, finalDamage, {
            hitEnemies,
            silent: true,
          });
          if (!sentTargetedDamage) setLastCast(`${ability.name}: miss`);
        }, impactDelay);
        if (now < (combatBuffsRef.current.damageFormUntil ?? 0) && (combatBuffsRef.current.leechPercent ?? 0) > 0) {
          const healing = Math.max(1, Math.floor(finalDamage * (combatBuffsRef.current.leechPercent ?? 0)));
          if (healing > 0) {
            setVitalsValue({
              ...vitalsRef.current,
              hp: Math.min(stats.health, vitalsRef.current.hp + healing),
            });
          }
        }
        return;
      }

      if (hitEnemies.length === 0) {
        setLastCast(`${ability.name}: miss`);
      } else {
        window.setTimeout(() => {
          applyAbilityDamage(ability, facing, performance.now(), origin, {
            targetEnemyIds: hitEnemies.map((enemy) => enemy.id),
            damage: finalDamage,
          });
        }, impactDelay);
      }

      pushAutoAttackEffect(visualAbility, facing, now);
    };

    const updateHunterPet = (now, delta) => {
      const activeCharacter = characterRef.current;
      const pet = hunterPetRef.current;
      if (!hasHunterPet(activeCharacter) || deadRef.current || !isFinitePoint(player.current)) {
        if (pet) pet.targetEnemyId = null;
        return;
      }

      const ownerId = colyseusSessionIdRef.current ?? 'local';
      const currentMapId = currentMapIdRef.current;
      const validTargets = enemies.current
        .filter((enemy) => enemy && enemy.hp > 0)
        .filter(canShareLocalInteriorSpace)
        .filter((enemy) => {
          const sameMap = !currentMapId || !enemy.mapId || getGameplayMapSpaceId(enemy.mapId) === getGameplayMapSpaceId(currentMapId);
          const combatTarget = combatEnemyIdsRef.current.has(String(enemy.id))
            || String(enemy.id) === String(pet.targetEnemyId ?? '')
            || enemy.state === 'aggro'
            || safeNumber(enemy.hp, enemy.maxHp ?? 1) < safeNumber(enemy.maxHp, 1)
            || String(enemy.targetPlayerId ?? '') === String(ownerId)
            || String(enemy.firstHitPlayerId ?? '') === String(ownerId)
            || (distance(enemy, player.current) <= 760 && now - lastCombatAt.current < 7000);
          return combatTarget && (sameMap || combatEnemyIdsRef.current.has(String(enemy.id)));
        });

      let target = validTargets.find((enemy) => String(enemy.id) === String(pet.targetEnemyId));
      if (!target) {
        target = validTargets
          .sort((a, b) => distance(a, player.current) - distance(b, player.current))[0] ?? null;
        pet.targetEnemyId = target?.id ?? null;
      }

      const ownerGapBeforeSnap = isFinitePoint(pet) ? distance(pet, player.current) : Number.POSITIVE_INFINITY;
      if (!isFinitePoint(pet) || ownerGapBeforeSnap > HUNTER_PET.leashDistance * 2.4) {
        pet.x = player.current.x - Math.cos(safeNumber(player.current.facing, 0)) * HUNTER_PET.followDistance;
        pet.y = player.current.y - Math.sin(safeNumber(player.current.facing, 0)) * HUNTER_PET.followDistance + 24;
        pet.facing = safeNumber(player.current.facing, 0);
        pet.walk = 0;
        pet.targetEnemyId = null;
        target = null;
      } else if (target && ownerGapBeforeSnap > HUNTER_PET.leashDistance) {
        pet.targetEnemyId = null;
        target = null;
      }

      const desired = target
        ? { x: target.x, y: target.y }
        : {
            x: player.current.x - Math.cos(safeNumber(player.current.facing, 0)) * HUNTER_PET.followDistance,
            y: player.current.y - Math.sin(safeNumber(player.current.facing, 0)) * HUNTER_PET.followDistance + 26,
          };
      const gap = distance(pet, desired);
      const targetAttackRange = target
        ? HUNTER_PET.attackRange + clamp(safeNumber(target.radius, ENEMY.radius), 8, 80)
        : 12;
      if (gap > targetAttackRange) {
        const dirX = (desired.x - pet.x) / Math.max(1, gap);
        const dirY = (desired.y - pet.y) / Math.max(1, gap);
        const activeWorldWidth = getTiledWorldPixelWidth(tiledWorld.current);
        const activeWorldHeight = getTiledWorldPixelHeight(tiledWorld.current);
        const ownerGap = distance(pet, player.current);
        const catchupMultiplier = target
          ? clamp(ownerGap / Math.max(1, HUNTER_PET.leashDistance * 0.65), 1, 1.7)
          : clamp(1 + Math.max(0, ownerGap - HUNTER_PET.followDistance) / 120, 1, 2.4);
        const petSpeed = HUNTER_PET.speed * catchupMultiplier;
        const nextX = clamp(pet.x + dirX * petSpeed * delta, HUNTER_PET.radius, activeWorldWidth - HUNTER_PET.radius);
        const nextY = clamp(pet.y + dirY * petSpeed * delta, HUNTER_PET.radius, activeWorldHeight - HUNTER_PET.radius);
        const movement = moveEnemyWithCollision(
          tiledWorld.current,
          { ...pet, radius: HUNTER_PET.radius, interiorId: getActiveLocalInteriorId() },
          nextX,
          nextY,
        );
        if (movement.blocked && !target && ownerGap > HUNTER_PET.leashDistance * 1.15) {
          const openPoint = findOpenPointNear(tiledWorld.current, desired, HUNTER_PET.radius);
          pet.x = openPoint.x;
          pet.y = openPoint.y;
          pet.vx = 0;
          pet.vy = 0;
          pet.moving = false;
          pet.facing = safeNumber(player.current.facing, pet.facing);
          return;
        }
        pet.x = movement.x;
        pet.y = movement.y;
        pet.vx = dirX * petSpeed;
        pet.vy = dirY * petSpeed;
        pet.moving = true;
        pet.facing = Math.atan2(dirY, dirX);
        pet.walk = (pet.walk ?? 0) + delta * catchupMultiplier;
      } else if (target) {
        pet.vx = 0;
        pet.vy = 0;
        pet.moving = false;
        pet.facing = Math.atan2(target.y - pet.y, target.x - pet.x);
      } else {
        pet.vx = 0;
        pet.vy = 0;
        pet.moving = false;
      }

      if (!target || gap > targetAttackRange + 10 || now < (pet.nextAttackAt ?? 0)) return;

      const buffs = combatBuffsRef.current;
      const petSpeedMultiplier = now < (buffs.petAttackSpeedUntil ?? 0)
        ? Math.max(0.2, buffs.petAttackSpeedMultiplier ?? 1)
        : 1;
      pet.nextAttackAt = now + (HUNTER_PET.attackCooldown / petSpeedMultiplier);
      pet.attackStartedAt = now;
      pet.attackUntil = now + 360;

      const ability = attachAbilityVisual({
        key: 'pet-bite',
        name: 'Pet Bite',
        type: 'strike',
        color: '#bef264',
        damage: HUNTER_PET.damage,
        range: HUNTER_PET.attackRange + 20,
        width: 58,
        duration: 360,
        autoAttack: true,
        visualClassId: 'hunter',
        classId: 'hunter',
        bleedDamage: now < (buffs.petAttackSpeedUntil ?? 0) ? buffs.petBleedDamage : 0,
        bleedDuration: now < (buffs.petAttackSpeedUntil ?? 0) ? buffs.petBleedDuration : 0,
        bleedTickRate: 1000,
      }, 'hunter');
      const stats = getTotalStats(activeCharacter);
      const damage = Math.ceil(
        (ability.damage + Math.floor(((stats.agility ?? 0) + (stats.strength ?? 0)) / 10))
          * getCombatDamageMultiplier(buffs, ability, now),
      );
      const petOrigin = { x: pet.x, y: pet.y };
      const launched = launchSingleTargetProjectile(petOrigin, target, {
        ...ability,
        damage: ability.damage,
        range: Math.max(HUNTER_PET.attackRange + 38, distance(petOrigin, target) + 12),
        duration: 360,
      }, now, { segmentMs: 120, afterImpactMs: 220, travelType: 'shot', melee: true });
      if (!launched && !colyseusRoomRef.current) {
        applyAbilityDamage(ability, safeNumber(pet.facing, 0), now, petOrigin, {
          targetEnemyIds: [target.id],
          damage,
        });
      }
    };

    const handlePointerDown = (event) => {
      updateMouse(event);
      if (event.button === 3 || event.button === 4) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.button === 2) {
        event.preventDefault();
        stopAutoAttack();
        castRightClickShield(performance.now());
        return;
      }
      if (event.button !== 0) return;
      const clickedPlayer = [...displayedRemotePlayersRef.current]
        .sort((a, b) => distance(a, mouse.current) - distance(b, mouse.current))
        .find((remotePlayer) => distance(remotePlayer, mouse.current) <= 54);
      if (clickedPlayer) {
        setSelectedPlayerId(clickedPlayer.id);
        if (startResurrection(clickedPlayer)) return;
        return;
      }

      setSelectedPlayerId(null);
      autoAttackHeld.current = true;
      runAutoAttack(performance.now());
    };

    const stopAutoAttack = () => {
      autoAttackHeld.current = false;
    };

    const preventContextMenu = (event) => {
      event.preventDefault();
      stopAutoAttack();
    };

    const drawTree = (x, y) => {
      context.fillStyle = '#6b4f2a';
      context.fillRect(x - 5, y + 10, 10, 22);
      context.fillStyle = '#1f7a4d';
      context.beginPath();
      context.arc(x, y, 28, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2fb36f';
      context.beginPath();
      context.arc(x - 10, y - 8, 15, 0, Math.PI * 2);
      context.fill();
    };

    const drawRock = (x, y) => {
      context.fillStyle = '#7f8b8d';
      context.beginPath();
      context.ellipse(x, y, 24, 16, -0.2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#a7b0b2';
      context.beginPath();
      context.ellipse(x - 6, y - 4, 10, 6, -0.3, 0, Math.PI * 2);
      context.fill();
    };

    const drawNpc = (npc) => {
      const npcX = safeNumber(npc?.point ? npc.x : npc?.x + (npc?.width ?? 0) / 2, npc?.x ?? 0);
      const npcY = safeNumber(npc?.point ? npc.y : npc?.y + (npc?.height ?? 0) / 2, npc?.y ?? 0);
      const npcName = String(npc?.props?.displayName ?? npc?.name ?? 'NPC');
      context.fillStyle = npc?.props?.color ?? npc?.color ?? '#8be9fd';
      context.beginPath();
      context.arc(npcX, npcY, 15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#101820';
      context.font = '600 13px Inter, Arial';
      context.textAlign = 'center';
      context.fillText(npcName, npcX, npcY - 24);
    };

    const drawEffect = (effect, now) => {
      drawPixelAbilityEffect(context, effect, now);
      return;

      const progress = clamp((now - effect.start) / effect.duration, 0, 1);
      const alpha = 1 - progress;
      const fx = Math.cos(effect.facing);
      const fy = Math.sin(effect.facing);

      context.save();
      context.globalAlpha = Math.max(alpha, 0);
      context.strokeStyle = effect.color;
      context.fillStyle = effect.color;
      context.lineCap = 'round';

      if (effect.type === 'bolt') {
        const distance = 40 + progress * 180;
        context.beginPath();
        context.arc(effect.x + fx * distance, effect.y + fy * distance, 10, 0, Math.PI * 2);
        context.fill();
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(effect.x + fx * 24, effect.y + fy * 24);
        context.lineTo(effect.x + fx * distance, effect.y + fy * distance);
        context.stroke();
      }

      if (effect.type === 'nova' || effect.type === 'shield' || effect.type === 'shout') {
        context.lineWidth = effect.type === 'shield' ? 5 : 4;
        context.beginPath();
        context.arc(effect.x, effect.y, 28 + progress * 95, 0, Math.PI * 2);
        context.stroke();
      }

      if (effect.type === 'heal') {
        context.lineWidth = 5;
        context.beginPath();
        context.arc(effect.x, effect.y, 24 + progress * 46, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = effect.color;
        context.font = '900 24px Inter, Arial';
        context.textAlign = 'center';
        context.fillText('+', effect.x, effect.y - 34 - progress * 16);
      }

      if (effect.type === 'shot') {
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(effect.x + fx * 20, effect.y + fy * 20);
        context.lineTo(effect.x + fx * (180 + progress * 90), effect.y + fy * (180 + progress * 90));
        context.stroke();
      }

      if (effect.type === 'channel') {
        context.globalAlpha = 0.45 + Math.sin(now / 55) * 0.18;
        context.lineWidth = 8;
        context.beginPath();
        context.moveTo(effect.x + fx * 18, effect.y + fy * 18);
        context.lineTo(effect.x + fx * 260, effect.y + fy * 260);
        context.stroke();
        context.lineWidth = 2;
        context.strokeStyle = '#f5d0fe';
        context.beginPath();
        context.moveTo(effect.x + fx * 18, effect.y + fy * 18);
        context.lineTo(effect.x + fx * 260, effect.y + fy * 260);
        context.stroke();
      }

      if (effect.type === 'trap') {
        const trapOffset = safeNumber(effect.trapOffset, 95);
        const trapX = effect.x + fx * trapOffset;
        const trapY = effect.y + fy * trapOffset;
        context.lineWidth = 4;
        context.beginPath();
        context.rect(trapX - 16, trapY - 16, 32, 32);
        context.stroke();
        context.beginPath();
        context.arc(trapX, trapY, 7 + progress * 18, 0, Math.PI * 2);
        context.stroke();
      }

      if (effect.type === 'strike') {
        context.lineWidth = 7;
        context.beginPath();
        context.moveTo(effect.x - 30 * fy, effect.y + 30 * fx);
        context.lineTo(effect.x + fx * 90 + 30 * fy, effect.y + fy * 90 - 30 * fx);
        context.stroke();
      }

      if (effect.type === 'cleave') {
        context.lineWidth = 8;
        context.beginPath();
        context.arc(effect.x, effect.y, 54, effect.facing - 0.95, effect.facing + 0.95);
        context.stroke();
      }

      if (effect.type === 'dungeon_aoe') {
        const radius = effect.radius ?? 90;
        context.globalAlpha = 0.2 + alpha * 0.28;
        context.fillStyle = effect.color ?? '#ef4444';
        context.beginPath();
        context.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = Math.max(alpha, 0.25);
        context.lineWidth = 5;
        context.strokeStyle = '#fecaca';
        context.beginPath();
        context.arc(effect.x, effect.y, radius * (0.72 + progress * 0.28), 0, Math.PI * 2);
        context.stroke();
      }

      if (effect.type === 'dungeon_laser') {
        const length = effect.length ?? 520;
        context.globalAlpha = 0.18 + alpha * 0.42;
        context.lineWidth = effect.width ?? 42;
        context.strokeStyle = effect.color ?? '#f43f5e';
        context.beginPath();
        context.moveTo(effect.x + fx * 20, effect.y + fy * 20);
        context.lineTo(effect.x + fx * length, effect.y + fy * length);
        context.stroke();
        context.globalAlpha = Math.max(alpha, 0.35);
        context.lineWidth = 6;
        context.strokeStyle = '#ffe4e6';
        context.beginPath();
        context.moveTo(effect.x + fx * 28, effect.y + fy * 28);
        context.lineTo(effect.x + fx * length, effect.y + fy * length);
        context.stroke();
      }

      context.restore();
    };

    const smoothRemotePlayers = (delta) => {
      const targets = remotePlayersRef.current
        .map(sanitizeWorldPlayer)
        .filter((target) => target?.id)
        .filter(canShareLocalInteriorSpace);
      const previousDisplays = new globalThis.Map(displayedRemotePlayersRef.current.map((remotePlayer) => [remotePlayer.id, remotePlayer]));
      const amount = clamp(1 - Math.exp(-REMOTE_PLAYER_SMOOTHING * delta), 0, 1);

      displayedRemotePlayersRef.current = targets.map((target) => {
        const previous = previousDisplays.get(target.id);
        const leadSeconds = REMOTE_PLAYER_LEAD_MS / 1000;
        const predictedTarget = {
          ...target,
          x: target.x + safeNumber(target.vx, 0) * leadSeconds,
          y: target.y + safeNumber(target.vy, 0) * leadSeconds,
        };
        if (!previous) return predictedTarget;

        const gap = distance(previous, predictedTarget);
        if (gap > REMOTE_PLAYER_SNAP_DISTANCE) return predictedTarget;

        return {
          ...predictedTarget,
          x: previous.x + (predictedTarget.x - previous.x) * amount,
          y: previous.y + (predictedTarget.y - previous.y) * amount,
          facing: lerpAngle(previous.facing ?? predictedTarget.facing ?? 0, predictedTarget.facing ?? previous.facing ?? 0, amount),
        };
      });
    };

    const draw = (now) => {
      const viewWidth = canvas.clientWidth;
      const viewHeight = canvas.clientHeight;
      const worldWidth = getTiledWorldPixelWidth(tiledWorld.current);
      const worldHeight = getTiledWorldPixelHeight(tiledWorld.current);
      const safePlayer = isFinitePoint(player.current)
        ? player.current
        : lastSafePlayerPositionRef.current;
      const cameraX = clamp(safeNumber(safePlayer.x, 420) - viewWidth / 2, 0, Math.max(0, worldWidth - viewWidth));
      const cameraY = clamp(safeNumber(safePlayer.y, 420) - viewHeight / 2, 0, Math.max(0, worldHeight - viewHeight));
      camera.current.x = cameraX;
      camera.current.y = cameraY;
      mouse.current.x = mouse.current.screenX + cameraX;
      mouse.current.y = mouse.current.screenY + cameraY;

      let suppressOutdoorAtmosphere = false;
      context.clearRect(0, 0, viewWidth, viewHeight);
      context.save();
      try {
        context.translate(-cameraX, -cameraY);

      let activeInteriorZone = null;
      let activeCaveEntranceZones = [];
      if (tiledWorld.current) {
        context.fillStyle = '#1f2d2f';
        context.fillRect(0, 0, worldWidth, worldHeight);
        const activeInteriorId = getActiveInteriorId();
        activeInteriorZone = getOpenInteriorZone(tiledWorld.current, safePlayer, activeInteriorId);
        const activeLocalInteriorId = activeInteriorZone
          ? getInteriorZoneId(activeInteriorZone)
          : activeInteriorId;
        suppressOutdoorAtmosphere = Boolean(activeLocalInteriorId);
        activeCaveEntranceZones = activeInteriorId ? getCaveEntranceZones(tiledWorld.current, activeInteriorId) : [];
        const drawnLayerCount = drawTiledWorld(
          context,
          tiledWorld.current,
          cameraX,
          cameraY,
          viewWidth,
          viewHeight,
          (error, layer) => {
            console.error(error);
            setRenderStatus(`Layer skipped: ${layer?.name ?? 'unnamed'}`);
          },
          {
            fadeBuildings: Boolean(activeInteriorZone),
            activeInteriorZone,
            activeCaveEntranceZones,
            interiorOnly: Boolean(activeInteriorId && activeInteriorZone),
            now,
          },
        );
        if (drawnLayerCount === 0) {
          const fallbackTileSize = tiledWorld.current.map?.tilewidth ?? WORLD.tile;
          const startCol = Math.floor(cameraX / fallbackTileSize) - 1;
          const endCol = Math.ceil((cameraX + viewWidth) / fallbackTileSize) + 1;
          const startRow = Math.floor(cameraY / fallbackTileSize) - 1;
          const endRow = Math.ceil((cameraY + viewHeight) / fallbackTileSize) + 1;
          for (let row = startRow; row <= endRow; row += 1) {
            for (let col = startCol; col <= endCol; col += 1) {
              context.fillStyle = (row + col) % 2 === 0 ? '#526e4e' : '#4a6548';
              context.fillRect(col * fallbackTileSize, row * fallbackTileSize, fallbackTileSize, fallbackTileSize);
            }
          }
        }
      } else {
        const grass = context.createLinearGradient(0, 0, WORLD.width, WORLD.height);
        grass.addColorStop(0, '#86c96f');
        grass.addColorStop(0.48, '#62b66a');
        grass.addColorStop(1, '#4fae80');
        context.fillStyle = grass;
        context.fillRect(0, 0, WORLD.width, WORLD.height);

        context.strokeStyle = 'rgba(255,255,255,0.12)';
        context.lineWidth = 1;
        for (let x = 0; x <= WORLD.width; x += WORLD.tile) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x, WORLD.height);
          context.stroke();
        }
        for (let y = 0; y <= WORLD.height; y += WORLD.tile) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(WORLD.width, y);
          context.stroke();
        }

        context.fillStyle = 'rgba(234, 199, 116, 0.72)';
        context.beginPath();
        context.moveTo(0, 520);
        context.bezierCurveTo(720, 420, 1120, 760, 1740, 680);
        context.bezierCurveTo(2400, 590, 2790, 930, 3600, 810);
        context.lineTo(3600, 940);
        context.bezierCurveTo(2860, 1040, 2320, 730, 1770, 820);
        context.bezierCurveTo(1120, 930, 710, 590, 0, 700);
        context.closePath();
        context.fill();

        TREES.forEach(([x, y]) => drawTree(x, y));
        ROCKS.forEach(([x, y]) => drawRock(x, y));
        NPCS.forEach(drawNpc);
      }

      const hasPlacedWantedBoardProp = (tiledWorld.current?.props ?? []).some((prop) => {
        const label = `${prop?.props?.type ?? ''} ${prop?.type ?? ''} ${prop?.name ?? ''}`.toLowerCase();
        return label.includes('wanted_board') || label.includes('wanted board') || label.includes('wantedboard');
      });

      if (tiledWorld.current?.props?.length) {
        drawTamziaFountains(
          context,
          tiledWorld.current.props,
          cameraX,
          cameraY,
          viewWidth,
          viewHeight,
          now,
        );
      }

      if (tiledWorld.current?.lightMarkers?.length) {
        drawStreetLamps(
          context,
          tiledWorld.current.lightMarkers,
          cameraX,
          cameraY,
          viewWidth,
          viewHeight,
        );
      }

      (tiledWorld.current?.questGivers ?? [])
        .filter((giver) => isNpcVisibleForInterior(giver, activeInteriorZone))
        .filter(() => !hasPlacedWantedBoardProp)
        .filter((giver) => String(giver?.props?.npcType ?? '').toLowerCase().includes('wanted_board'))
        .forEach((giver) => drawWantedBoardAt(context, giver, now));

      const activeCharacter = characterRef.current;
      if (activeCharacter) {
        try {
          drawPlayer(context, player.current, activeCharacter.classId, activeCharacter.raceId, activeCharacter.appearance, activeCharacter);
        } catch (error) {
          console.error(error);
        }
        drawLocalPlayerMarker(context, player.current, activeCharacter);
        if (hasHunterPet(activeCharacter)) {
          try {
            drawHunterPet(context, hunterPetRef.current, player.current, now, activeCharacter);
          } catch (error) {
            console.error(error);
          }
        }
      }
      const visibleNpcs = (tiledWorld.current?.npcs ?? [])
        .filter((npc) => isNpcVisibleForInterior(npc, activeInteriorZone));
      const visibleNpcQuestIds = new Set(visibleNpcs
        .map((npc) => String(npc?.props?.questGiverId ?? npc?.name ?? npc?.id ?? ''))
        .filter(Boolean));
      visibleNpcs.forEach((npc) => {
        if (isTamziaInteriorNpc(npc)) drawTamziaNpcAt(context, npc, now);
        else if (isServiceNpc(npc)) drawShopkeeperAt(context, normalizeServiceNpc(npc));
        else drawNpc(npc);
      });
      (tiledWorld.current?.questGivers ?? [])
        .filter((giver) => isNpcVisibleForInterior(giver, activeInteriorZone))
        .filter((giver) => !visibleNpcQuestIds.has(String(giver?.id ?? '')))
        .filter((giver) => giver?.props?.renderHidden !== true)
        .filter((giver) => {
          if (!hasPlacedWantedBoardProp) return true;
          return !String(giver?.props?.npcType ?? '').toLowerCase().includes('wanted_board');
        })
        .forEach((giver) => {
          if (isTamziaInteriorNpc(giver)) drawTamziaNpcAt(context, giver, now);
          else drawQuestGiverAt(context, giver, now);
        });
      displayedRemotePlayersRef.current.forEach((remotePlayer) => {
        try {
          if (remotePlayer.id === selectedPlayerIdRef.current) {
            drawSelectedPlayerRing(context, remotePlayer);
          }
          if (remotePlayer.classId === 'hunter' && remotePlayer.pet) {
            drawHunterPet(context, remotePlayer.pet, remotePlayer, now, remotePlayer);
          }
          const remoteAttack = remoteAttackStatesRef.current.get(remotePlayer.id);
          if (remoteAttack && now > remoteAttack.until) remoteAttackStatesRef.current.delete(remotePlayer.id);
          const drawableRemotePlayer = remoteAttack && now <= remoteAttack.until
            ? { ...remotePlayer, attack: remoteAttack }
            : remotePlayer;
          drawPlayer(context, drawableRemotePlayer, remotePlayer.classId, remotePlayer.raceId, remotePlayer.appearance, remotePlayer);
          drawRemotePlayerMarker(context, remotePlayer);
        } catch (error) {
          console.error(error);
        }
      });
      enemies.current
        .filter(canShareLocalInteriorSpace)
        .forEach((enemy) => {
          try {
            drawEnemy(context, enemy, now);
          } catch (error) {
            console.error(error);
          }
        });
      const brokenEffects = new Set();
      effects.current.forEach((effect) => {
        try {
          drawEffect(effect, now);
        } catch (error) {
          console.error(error);
          brokenEffects.add(effect);
        }
      });
      if (brokenEffects.size > 0) {
        effects.current = effects.current.filter((effect) => !brokenEffects.has(effect));
        setRenderStatus(`Removed ${brokenEffects.size} broken effect${brokenEffects.size > 1 ? 's' : ''}`);
      }

      drawInteriorFocusOverlay(context, activeInteriorZone, worldWidth, worldHeight, now, activeCaveEntranceZones);
      } finally {
        context.restore();
      }
      if (!suppressOutdoorAtmosphere) {
        try {
          const weatherModifier = getWeatherLightingModifier();
          const precipitation = getPrecipitationState();
          const lighting = applyWeatherLightingModifier(getLightingForPhase(), weatherModifier);
          drawDayNightOverlay(context, viewWidth, viewHeight, lighting);
          if (lighting.phase === 'night' && tiledWorld.current?.lightMarkers?.length) {
            context.save();
            try {
              context.translate(-cameraX, -cameraY);
              drawStreetLamps(
                context,
                tiledWorld.current.lightMarkers,
                cameraX,
                cameraY,
                viewWidth,
                viewHeight,
                NIGHT_LAMP_GLOW_PASS,
              );
            } finally {
              context.restore();
            }
          }
          if (tiledWorld.current?.props?.length) {
            context.save();
            try {
              context.translate(-cameraX, -cameraY);
              drawTamziaFountains(
                context,
                tiledWorld.current.props,
                cameraX,
                cameraY,
                viewWidth,
                viewHeight,
                now,
                { glowOnly: true, lighting, postOverlay: true },
              );
            } finally {
              context.restore();
            }
          }
          drawWeatherEffects(context, viewWidth, viewHeight, precipitation, now);
        } catch (error) {
          console.error('Day/night overlay failed', error);
        }
      }
    };

    const tick = (now) => {
      try {
        const delta = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        const onlineRoom = colyseusRoomRef.current;
        smoothRemotePlayers(delta);

        if (!isFinitePoint(player.current)) {
          player.current = {
            ...player.current,
            ...lastSafePlayerPositionRef.current,
            vx: 0,
            vy: 0,
          };
          setRenderStatus('Recovered invalid player position');
        } else {
          lastSafePlayerPositionRef.current = {
            x: player.current.x,
            y: player.current.y,
            facing: safeNumber(player.current.facing, 0),
          };
        }

        effects.current = effects.current
          .map((effect) => sanitizeEffect(effect, now))
          .filter(Boolean);

        if (now - lastRenderStatusAt.current > 700) {
          lastRenderStatusAt.current = now;
          setRenderStatus(
            `Render live ${canvas.clientWidth}x${canvas.clientHeight} | cam ${Math.round(camera.current.x)}, ${Math.round(camera.current.y)}`,
          );
        }

      if (
        !onlineRoom
        && selectedClassRef.current
        && isWorldLikeMap(currentMapIdRef.current)
        && worldSpawnPacks.current.size > 0
      ) {
        let spawnedAnyEnemy = false;
        worldSpawnPacks.current.forEach((pack) => {
          const aliveEnemies = enemies.current.filter((enemy) => (
            enemy.type === 'enemy' && enemy.spawnId === pack.id
          ));
          let aliveCount = aliveEnemies.length;
          const occupiedSlots = new Set(
            aliveEnemies
              .map((enemy) => enemy.spawnSlot)
              .filter((slotIndex) => Number.isFinite(slotIndex)),
          );

          const readySlots = getReadyRespawnSlots(pack, now, occupiedSlots);
          readySlots.forEach((slotIndex) => {
            if (aliveCount >= pack.maxAlive) return;

            enemies.current.push(createEnemy(
              nextEnemyId.current,
              pack.spawn,
              player.current,
              slotIndex,
              pack.maxAlive,
              tiledWorld.current,
              enemies.current,
            ));
            nextEnemyId.current += 1;
            aliveCount += 1;
            spawnedAnyEnemy = true;
          });

          while (aliveCount + pack.pendingRespawns.length < pack.maxAlive) {
            let openSlot = 0;
            while (occupiedSlots.has(openSlot) && openSlot < pack.maxAlive) openSlot += 1;
            if (openSlot >= pack.maxAlive) break;
            occupiedSlots.add(openSlot);
            enemies.current.push(createEnemy(
              nextEnemyId.current,
              pack.spawn,
              player.current,
              openSlot,
              pack.maxAlive,
              tiledWorld.current,
              enemies.current,
            ));
            nextEnemyId.current += 1;
            aliveCount += 1;
            spawnedAnyEnemy = true;
          }
        });

        if (spawnedAnyEnemy) setEnemyCount(enemies.current.length);
      }

      if (
        selectedClassRef.current
        && isWorldLikeMap(currentMapIdRef.current)
        && worldSpawnPacks.current.size === 0
        && (tiledWorld.current?.bossSpawns ?? []).length === 0
      ) {
        const activeMapId = normalizeMapId(currentMapIdRef.current);
        const nextEnemies = enemies.current.filter((enemy) => !(
          ['enemy', 'boss'].includes(enemy.type)
          && normalizeMapId(enemy.mapId ?? activeMapId) === activeMapId
        ));
        if (nextEnemies.length !== enemies.current.length) {
          enemies.current = nextEnemies;
          setEnemyCount(nextEnemies.length);
        }
      }

      const currentBossSpawns = tiledWorld.current?.bossSpawns ?? [];
      if (!onlineRoom && selectedClassRef.current && currentBossSpawns.length > 0 && now >= nextBossSpawnAt.current) {
        const spawnedBosses = [];
        currentBossSpawns.forEach((spawn, index) => {
          const spawnId = getSpawnPackId(spawn, `boss_spawn_${index}`);
          const bossAliveForSpawn = enemies.current.some((enemy) => (
            enemy.type === 'boss'
            && enemy.spawnId === spawnId
            && (!currentMapIdRef.current || !enemy.mapId || normalizeMapId(enemy.mapId) === currentMapIdRef.current)
          ));
          if (bossAliveForSpawn) return;

          const boss = createBoss(nextEnemyId.current, spawn, player.current, tiledWorld.current);
          enemies.current.push(boss);
          spawnedBosses.push(boss);
          nextEnemyId.current += 1;
        });
        if (spawnedBosses.length > 0) {
          nextBossSpawnAt.current = Number.POSITIVE_INFINITY;
          setEnemyCount(enemies.current.length);
          setLastCast(spawnedBosses.length === 1
            ? `Boss spawned: ${spawnedBosses[0].name}`
            : `Bosses spawned: ${spawnedBosses.map((boss) => boss.name).join(', ')}`);
        }
      }

      let dx = 0;
      let dy = 0;
      if (!deadRef.current) {
        if (keys.current.has('w') || keys.current.has('arrowup')) dy -= 1;
        if (keys.current.has('s') || keys.current.has('arrowdown')) dy += 1;
        if (keys.current.has('a') || keys.current.has('arrowleft')) dx -= 1;
        if (keys.current.has('d') || keys.current.has('arrowright')) dx += 1;
      }

      if (now < (combatBuffsRef.current.rootSelfUntil ?? 0)) {
        dx = 0;
        dy = 0;
      }

      const forcedMove = forcedMoveRef.current;
      const activeInteriorId = normalizeInteriorId(activeCaveInteriorIdRef.current);
      const playerCollisionOptions = activeInteriorId
        ? { activeInteriorId, ignoreWorldCollision: true }
        : undefined;
      if (forcedMove && !deadRef.current) {
        const toX = forcedMove.x - player.current.x;
        const toY = forcedMove.y - player.current.y;
        const gap = Math.hypot(toX, toY);
        const step = Math.min(gap, safeNumber(forcedMove.speed, 760) * delta);
        if (gap <= 3 || step <= 0) {
          forcedMoveRef.current = null;
          player.current.vx = 0;
          player.current.vy = 0;
          if (forcedMove.damageOnFinish && forcedMove.ability && forcedMove.damage > 0) {
            if (colyseusRoomRef.current) {
              sendDamageToHitEnemies(colyseusRoomRef.current, forcedMove.ability, player.current, forcedMove.facing, forcedMove.damage, { silent: true });
            } else {
              applyAbilityDamage(forcedMove.ability, forcedMove.facing, now, player.current);
            }
          }
        } else {
          const moveX = (toX / gap) * step;
          const moveY = (toY / gap) * step;
          const nextX = player.current.x + moveX;
          const nextY = player.current.y + moveY;
          let blocked = true;
          if (canMovePlayerTo(nextX, player.current.y, playerCollisionOptions)) {
            player.current.x = nextX;
            blocked = false;
          }
          if (canMovePlayerTo(player.current.x, nextY, playerCollisionOptions)) {
            player.current.y = nextY;
            blocked = false;
          }
          player.current.vx = blocked ? 0 : moveX / Math.max(delta, 0.001);
          player.current.vy = blocked ? 0 : moveY / Math.max(delta, 0.001);
          player.current.facing = safeNumber(forcedMove.facing, player.current.facing);
          if (blocked) forcedMoveRef.current = null;
        }
      } else if (dx !== 0 || dy !== 0) {
        hostileSlowEffectsRef.current = hostileSlowEffectsRef.current.filter((effect) => effect.until > now);
        const hostileMovementMultiplier = hostileSlowEffectsRef.current.reduce(
          (multiplier, effect) => Math.min(multiplier, clamp(safeNumber(effect.multiplier, 1), 0.2, 1)),
          1,
        );
        const movementSpeed = PLAYER.speed * hostileMovementMultiplier;
        const length = Math.hypot(dx, dy);
        dx /= length;
        dy /= length;
        const previousX = player.current.x;
        const previousY = player.current.y;
        const activeWorldWidth = getTiledWorldPixelWidth(tiledWorld.current);
        const activeWorldHeight = getTiledWorldPixelHeight(tiledWorld.current);
        const nextX = clamp(player.current.x + dx * movementSpeed * delta, PLAYER.radius, activeWorldWidth - PLAYER.radius);
        const nextY = clamp(player.current.y + dy * movementSpeed * delta, PLAYER.radius, activeWorldHeight - PLAYER.radius);

        if (canMovePlayerTo(nextX, player.current.y, playerCollisionOptions)) {
          player.current.x = nextX;
        }
        if (canMovePlayerTo(player.current.x, nextY, playerCollisionOptions)) {
          player.current.y = nextY;
        }
        const movementState = getMovementStateFromDisplacement(
          { x: previousX, y: previousY },
          player.current,
          delta,
          player.current.facing,
        );
        player.current.vx = movementState.vx;
        player.current.vy = movementState.vy;
        player.current.facing = movementState.facing;
      } else {
        player.current.vx = 0;
        player.current.vy = 0;
      }

      const playerIsMoving = Math.abs(player.current.vx ?? 0) + Math.abs(player.current.vy ?? 0) > 0.05;
      if (playerIsMoving) {
        const walkDirectionSector = ((Math.round(safeNumber(player.current.facing, 0) / (Math.PI / 4)) % 8) + 8) % 8;
        // Preserve gait phase while turning so changing sprite rows does not
        // repeatedly snap the character back to the neutral passing pose.
        if (
          !player.current.walkMoving
          || !Number.isFinite(player.current.walkStartedAt)
        ) {
          player.current.walkStartedAt = now;
        }
        player.current.walkMoving = true;
        player.current.walkDirectionSector = walkDirectionSector;
        player.current.animationTime = Math.max(0, now - player.current.walkStartedAt);
      } else {
        player.current.walkMoving = false;
        player.current.walkDirectionSector = null;
        player.current.walkStartedAt = now;
        player.current.animationTime = 0;
      }

      if (isWorldV2Map(currentMapIdRef.current) && tiledWorld.current?.isRegionWorld) {
        ensureWorldV2StreamingForPosition(player.current);
      }

      updateActiveCaveInterior(now);

      if (!mapTransitioningRef.current && characterRef.current && !deadRef.current && tiledWorld.current) {
        const currentMap = currentMapIdRef.current;
        const activeTransition = getActiveTransitionAtPlayer();
        const transitionTargetMapId = getTransitionTargetMapId(activeTransition);
        const isDungeonEntrance = isWorldV2Map(currentMap)
          && (activeTransition?.name === 'dungeon_01_entrance' || transitionTargetMapId === 'dungeon_01');
        const transitionName = String(activeTransition?.name ?? '').trim().toLowerCase();
        const transitionTargetKey = normalizeTransitionTargetKey(getTransitionRawTarget(activeTransition));
        const isNewWorldTransition = transitionName === 'transition_to_new_world'
          || ['new_world', 'new_world_v3', 'world_v2', 'world_v3', 'world_continent_v2', 'world_continent_v3', 'world_continent_v4', 'continent_01'].includes(transitionTargetKey);
        const newWorldGenerationId = ['world_v2', 'world_continent_v2'].includes(transitionTargetKey) ? 'v2' : 'v3';

        if (isNewWorldTransition) {
          const startingZoneExitError = isStartingMapId(currentMap)
            ? getStartingZoneExitError(characterRef.current)
            : null;
          if (startingZoneExitError) {
            if (now - lastTransitionWarningAtRef.current > 1200) {
              lastTransitionWarningAtRef.current = now;
              setLastCast(startingZoneExitError);
            }
          } else {
            mapTransitioningRef.current = true;
            teleportToRandomNewWorldRegion(newWorldGenerationId)
              .catch((error) => {
                console.error(error);
                setLastCast(`New world load failed: ${error.message}`);
              })
              .finally(() => {
                mapTransitioningRef.current = false;
              });
          }
        } else if (isDungeonEntrance) {
          const entryError = getDungeonEntryError(characterRef.current);
          if (entryError) {
            if (now - lastTransitionWarningAtRef.current > 1200) {
              lastTransitionWarningAtRef.current = now;
              setLastCast(entryError);
            }
          } else if (!dungeonConfirmOpenRef.current && now >= dungeonEntranceConfirmCooldownRef.current) {
            setDungeonConfirmOpen(true);
            setLastCast('Enter dungeon?');
          }
        } else if (currentMap === 'dungeon_01' && activeTransition?.name === 'dungeon_01_exit') {
          if (hasFinalBossAlive(enemies.current)) {
            setLastCast('Defeat the final boss first');
          } else {
            mapTransitioningRef.current = true;
            switchMap(transitionTargetMapId || WORLD_V3_HUB_MAP_ID, 'dungeon_01_entrance', 'Dungeon cleared')
              .then(() => {
                player.current.y += 130;
                setPosition({ ...player.current });
                persistCurrentPosition(player.current, currentMapIdRef.current);
              })
              .finally(() => {
                mapTransitioningRef.current = false;
              });
          }
        } else if (activeTransition) {
          const targetMapId = transitionTargetMapId;
          if (targetMapId && targetMapId !== currentMap) {
            const transitionType = getTransitionType(activeTransition);
            const configuredLevel = Number(activeTransition.props?.recommendedLevel ?? 0);
            const isStartingExit = isStartingZoneWorldExit(currentMap, activeTransition, targetMapId);
            const requiredLevel = isStartingExit
              ? configuredLevel
              : transitionType === 'world_exit'
                ? Math.max(10, configuredLevel)
                : configuredLevel;
            const activeLevel = Number(characterRef.current.level ?? 1);
            const startingZoneExitError = isStartingExit
              ? getStartingZoneExitError(characterRef.current)
              : null;

            if (startingZoneExitError) {
              if (now - lastTransitionWarningAtRef.current > 1200) {
                lastTransitionWarningAtRef.current = now;
                setLastCast(startingZoneExitError);
              }
            } else if (requiredLevel > 0 && activeLevel < requiredLevel) {
              if (now - lastTransitionWarningAtRef.current > 1200) {
                lastTransitionWarningAtRef.current = now;
                setLastCast(`Level ${requiredLevel} required`);
              }
            } else {
              mapTransitioningRef.current = true;
              const transitionPromise = isStartingExit
                ? teleportToRandomNewWorldRegion('v3')
                : switchMap(
                  targetMapId,
                  getTransitionTargetSpawnName(activeTransition, characterRef.current, targetMapId),
                  isWorldV2Map(targetMapId) ? 'Entered the city' : 'Changed zone',
                );
              transitionPromise
                .finally(() => {
                  mapTransitioningRef.current = false;
                });
            }
          } else if (isWorldV2Map(currentMap) && getTransitionRawTarget(activeTransition)) {
            mapTransitioningRef.current = true;
            activateWorldV2TransitionTarget(activeTransition)
              .finally(() => {
                setTimeout(() => {
                  mapTransitioningRef.current = false;
                }, 350);
              });
          }
        }
      }

      if (characterRef.current && !deadRef.current) {
        const lastSave = lastPositionSaveRef.current;
        const movedEnough = distance({ x: lastSave.x, y: lastSave.y }, player.current) > 48;
        const changedMap = lastSave.mapId !== currentMapIdRef.current;
        if ((movedEnough || changedMap) && now - lastSave.at > 5000) {
          lastPositionSaveRef.current = {
            at: now,
            x: player.current.x,
            y: player.current.y,
            mapId: currentMapIdRef.current,
          };
          persistCurrentPosition();
        }
      }

      if (onlineRoom && characterRef.current && now - lastColyseusInputAt.current > COLYSEUS_INPUT_MS) {
        lastColyseusInputAt.current = now;
        const stats = getTotalStats(characterRef.current);
        onlineRoom.send('player', {
          x: player.current.x,
          y: player.current.y,
          facing: player.current.facing,
          interiorId: getActiveLocalInteriorId(),
          name: characterRef.current.name,
          classId: characterRef.current.classId,
          raceId: characterRef.current.raceId,
          appearance: characterRef.current.appearance ?? {},
          level: characterRef.current.level ?? 1,
          talents: characterRef.current.talents ?? { spec: null },
          mapId: currentMapIdRef.current,
          startingZoneExitReady: isStartingMapId(currentMapIdRef.current)
            ? !getStartingZoneExitError(characterRef.current)
            : true,
          hp: vitalsRef.current.hp,
          maxHp: stats.health,
          pet: characterRef.current.classId === 'hunter' ? {
            x: hunterPetRef.current.x,
            y: hunterPetRef.current.y,
            vx: hunterPetRef.current.vx ?? 0,
            vy: hunterPetRef.current.vy ?? 0,
            facing: hunterPetRef.current.facing ?? player.current.facing,
            walk: hunterPetRef.current.walk ?? 0,
            moving: Boolean(hunterPetRef.current.moving),
            attackStartedAt: hunterPetRef.current.attackStartedAt ?? 0,
            attackUntil: hunterPetRef.current.attackUntil ?? 0,
          } : null,
        });
      }

      if (!onlineRoom) {
        const enemyMovementSnapshot = enemies.current;
        enemies.current = enemyMovementSnapshot.map((enemy) => {
          if (!canShareLocalInteriorSpace(enemy)) {
            const idleEnemy = (enemy.state === 'aggro' || enemy.targetPlayerId || enemy.firstHitPlayerId)
              ? resetEnemyAggro(enemy, now)
              : enemy;
            return updateIdleEnemyMovement(
              idleEnemy,
              now,
              delta,
              idleEnemy.type === 'boss' || idleEnemy.type?.includes?.('boss'),
              tiledWorld.current,
              enemyMovementSnapshot,
            );
          }

          const isBossEnemy = enemy.type === 'boss' || enemy.type?.includes?.('boss');
          if (deadRef.current && enemy.state === 'aggro') {
            return updateIdleEnemyMovement(
              resetEnemyAggro(enemy, now),
              now,
              delta,
              isBossEnemy,
              tiledWorld.current,
              enemyMovementSnapshot,
            );
          }

          if (enemy.state !== 'aggro') {
            return updateIdleEnemyMovement(
              enemy,
              now,
              delta,
              isBossEnemy,
              tiledWorld.current,
              enemyMovementSnapshot,
            );
          }

          let activeEnemy = enemy;
          const toPlayerX = player.current.x - activeEnemy.x;
          const toPlayerY = player.current.y - activeEnemy.y;
          const length = Math.hypot(toPlayerX, toPlayerY) || 1;
          const homePoint = isFinitePoint(activeEnemy.home) ? activeEnemy.home : activeEnemy.wanderTarget;
          const distanceFromHome = isFinitePoint(homePoint) ? distance(activeEnemy, homePoint) : 0;
          const leashDistance = isBossEnemy ? LOCAL_BOSS_LEASH_DISTANCE : LOCAL_ENEMY_LEASH_DISTANCE;
          const outsideLeash = length > leashDistance || distanceFromHome > leashDistance * 1.25;
          if (outsideLeash) {
            const leashStartedAt = activeEnemy.leashStartedAt ?? now;
            if (now - leashStartedAt >= LOCAL_ENEMY_LEASH_GRACE_MS || distanceFromHome > leashDistance * 1.8) {
              return updateIdleEnemyMovement(
                resetEnemyAggro(activeEnemy, now),
                now,
                delta,
                isBossEnemy,
                tiledWorld.current,
                enemyMovementSnapshot,
              );
            }
            activeEnemy = { ...activeEnemy, leashStartedAt };
          } else if (activeEnemy.leashStartedAt != null) {
            activeEnemy = { ...activeEnemy, leashStartedAt: null };
          }

          const drift = Math.sin(now / 520 + activeEnemy.wobble) * 0.35;
          const dirX = toPlayerX / length;
          const dirY = toPlayerY / length;
          const separation = getEnemySeparationVector(activeEnemy, enemyMovementSnapshot);
          const meleeAttackRange = (activeEnemy.radius ?? ENEMY.radius) + PLAYER.radius + 8;
          const nextAttackAt = activeEnemy.nextAttackAt ?? 0;

          const mechanicConfig = getLocalWorldBossMechanicConfig(activeEnemy);
          const rangedAttackConfig = mechanicConfig?.rangedAttack ?? null;
          const attackRange = rangedAttackConfig?.range ?? meleeAttackRange;
          const rangedAttackStartRange = rangedAttackConfig
            ? Math.min(attackRange, safeNumber(rangedAttackConfig.attackStartRange, attackRange))
            : attackRange;
          if (mechanicConfig && !Number.isFinite(activeEnemy.nextMechanicAt)) {
            activeEnemy = {
              ...activeEnemy,
              nextMechanicAt: now + mechanicConfig.initialDelay,
            };
          }
          if (mechanicConfig?.secondary && !Number.isFinite(activeEnemy.nextSecondaryMechanicAt)) {
            activeEnemy = {
              ...activeEnemy,
              nextSecondaryMechanicAt: now + mechanicConfig.secondary.initialDelay,
            };
          }

          const mechanicUntil = safeNumber(activeEnemy.mechanicUntil, 0);
          const activeMechanicConfig = getActiveLocalWorldBossMechanicConfig(mechanicConfig, activeEnemy.mechanicType);
          if (activeMechanicConfig && now < mechanicUntil) {
            const mechanicImpactAt = safeNumber(activeEnemy.mechanicImpactAt, mechanicUntil);
            const mechanicProjectiles = Array.isArray(activeEnemy.mechanicProjectiles)
              ? activeEnemy.mechanicProjectiles
              : [];
            if (mechanicProjectiles.length > 0 && !activeEnemy.mechanicResolved) {
              const projectileHit = !deadRef.current && mechanicProjectiles.some((projectile) => (
                localBossProjectileSweptHit(projectile, player.current, now - Math.max(1, delta * 1000), now, PLAYER.radius)
              ));
              if (projectileHit) {
                const rawDamage = safeNumber(activeMechanicConfig.damage, 1);
                const damage = mitigateDamageWithCombatBuffs(combatBuffsRef.current, rawDamage, now);
                if (damage > 0 && safeNumber(activeMechanicConfig.slowDuration, 0) > 0) {
                  hostileSlowEffectsRef.current.push({
                    until: now + activeMechanicConfig.slowDuration,
                    multiplier: clamp(safeNumber(activeMechanicConfig.slowMultiplier, 0.7), 0.2, 1),
                  });
                }
                lastCombatAt.current = now;
                const nextHp = Math.max(0, vitalsRef.current.hp - damage);
                setVitalsValue({ ...vitalsRef.current, hp: nextHp });
                setLastCast(damage > 0 ? `-${damage} HP · Slowed` : 'Blocked');
                if (nextHp <= 0) killPlayer();
              }
              const mechanicFinished = projectileHit || now >= mechanicImpactAt;
              return {
                ...activeEnemy,
                mechanicResolved: mechanicFinished,
                attackResolved: mechanicFinished,
                targetX: player.current.x,
                targetY: player.current.y,
              };
            }
            if (!activeEnemy.mechanicResolved && now >= mechanicImpactAt) {
              if (!deadRef.current && length <= activeMechanicConfig.radius) {
                const damage = mitigateDamageWithCombatBuffs(combatBuffsRef.current, activeMechanicConfig.damage, now);
                lastCombatAt.current = now;
                const nextHp = Math.max(0, vitalsRef.current.hp - damage);
                setVitalsValue({ ...vitalsRef.current, hp: nextHp });
                setLastCast(damage > 0 ? `-${damage} HP` : 'Blocked');
                if (nextHp <= 0) killPlayer();
              }
              return {
                ...activeEnemy,
                mechanicResolved: true,
                attackResolved: true,
                targetX: player.current.x,
                targetY: player.current.y,
              };
            }
            return {
              ...activeEnemy,
              targetX: player.current.x,
              targetY: player.current.y,
            };
          }

          const primaryActivationRange = mechanicConfig?.activationRange ?? safeNumber(mechanicConfig?.radius, 0) * 1.35;
          const primaryReady = Boolean(
            mechanicConfig
            && length <= primaryActivationRange
            && now >= safeNumber(activeEnemy.nextMechanicAt, Number.POSITIVE_INFINITY)
          );
          const secondaryConfig = mechanicConfig?.secondary ?? null;
          const secondaryReady = Boolean(
            secondaryConfig
            && length >= safeNumber(secondaryConfig.minRange, 0)
            && length <= safeNumber(secondaryConfig.activationRange, 0)
            && now >= safeNumber(activeEnemy.nextSecondaryMechanicAt, Number.POSITIVE_INFINITY)
          );
          const selectedMechanicConfig = secondaryReady && (!primaryReady || length > primaryActivationRange)
            ? secondaryConfig
            : primaryReady
              ? mechanicConfig
              : null;

          if (selectedMechanicConfig) {
            const mechanicProjectiles = selectedMechanicConfig.projectileSpeed
              ? createLocalBossProjectilePattern(activeEnemy, player.current, selectedMechanicConfig, now)
              : [];
            const mechanicLaunchAt = mechanicProjectiles[0]?.launchAt
              ?? now + selectedMechanicConfig.telegraphDuration;
            const mechanicImpactAt = mechanicProjectiles.length > 0
              ? Math.max(...mechanicProjectiles.map((projectile) => projectile.impactAt))
              : now + selectedMechanicConfig.telegraphDuration;
            const mechanicUntilAt = mechanicProjectiles.length > 0
              ? mechanicImpactAt + safeNumber(selectedMechanicConfig.recoveryDuration, 300)
              : now + selectedMechanicConfig.totalDuration;
            const cooldownField = selectedMechanicConfig === secondaryConfig
              ? 'nextSecondaryMechanicAt'
              : 'nextMechanicAt';
            return {
              ...activeEnemy,
              [cooldownField]: now + selectedMechanicConfig.cooldown,
              mechanicType: selectedMechanicConfig.type,
              mechanicStartedAt: now,
              mechanicLaunchAt,
              mechanicImpactAt,
              mechanicUntil: mechanicUntilAt,
              mechanicRadius: safeNumber(selectedMechanicConfig.radius, 0),
              mechanicProjectiles,
              mechanicHitPlayerIds: [],
              mechanicResolved: false,
              nextAttackAt: Math.max(safeNumber(activeEnemy.nextAttackAt, 0), mechanicUntilAt + 250),
              attackStartedAt: now,
              attackType: selectedMechanicConfig.type,
              attackLaunchAt: mechanicLaunchAt,
              attackImpactAt: mechanicLaunchAt,
              attackUntil: mechanicUntilAt,
              attackResolved: false,
              targetX: player.current.x,
              targetY: player.current.y,
            };
          }

          const attackUntil = safeNumber(activeEnemy.attackUntil, 0);
          if (now < attackUntil) {
            const attackImpactAt = safeNumber(activeEnemy.attackImpactAt, attackUntil);
            if (activeEnemy.attackType === 'water-bolt' && !activeEnemy.attackResolved) {
              const attackProjectile = {
                originX: activeEnemy.attackOriginX,
                originY: activeEnemy.attackOriginY,
                targetX: activeEnemy.attackTargetX,
                targetY: activeEnemy.attackTargetY,
                launchAt: activeEnemy.attackLaunchAt,
                impactAt: activeEnemy.attackImpactAt,
                radius: activeEnemy.attackProjectileRadius,
              };
              const attackHit = !deadRef.current && localBossProjectileSweptHit(
                attackProjectile,
                player.current,
                now - Math.max(1, delta * 1000),
                now,
                PLAYER.radius,
              );
              if (attackHit) {
                const rawDamage = safeNumber(activeEnemy.damage, isBossEnemy ? 28 : 9);
                const damage = mitigateDamageWithCombatBuffs(combatBuffsRef.current, rawDamage, now);
                if (damage > 0 && safeNumber(rangedAttackConfig?.slowDuration, 0) > 0) {
                  hostileSlowEffectsRef.current.push({
                    until: now + rangedAttackConfig.slowDuration,
                    multiplier: clamp(safeNumber(rangedAttackConfig.slowMultiplier, 0.7), 0.2, 1),
                  });
                }
                lastCombatAt.current = now;
                const nextHp = Math.max(0, vitalsRef.current.hp - damage);
                setVitalsValue({ ...vitalsRef.current, hp: nextHp });
                setLastCast(damage > 0 ? `-${damage} HP · Slowed` : 'Blocked');
                if (nextHp <= 0) killPlayer();
              }
              if (attackHit || now >= attackImpactAt) {
                return {
                  ...activeEnemy,
                  attackResolved: true,
                  targetX: player.current.x,
                  targetY: player.current.y,
                };
              }
              return {
                ...activeEnemy,
                targetX: player.current.x,
                targetY: player.current.y,
              };
            }
            if (!activeEnemy.attackResolved && now >= attackImpactAt) {
              if (!deadRef.current && length <= meleeAttackRange) {
                const rawDamage = safeNumber(activeEnemy.damage, isBossEnemy ? 28 : 9);
                const damage = mitigateDamageWithCombatBuffs(combatBuffsRef.current, rawDamage, now);
                lastCombatAt.current = now;
                const nextHp = Math.max(0, vitalsRef.current.hp - damage);
                setVitalsValue({ ...vitalsRef.current, hp: nextHp });
                setLastCast(damage > 0 ? `-${damage} HP` : 'Blocked');
                if (nextHp <= 0) killPlayer();
              }
              return {
                ...activeEnemy,
                attackResolved: true,
                targetX: player.current.x,
                targetY: player.current.y,
              };
            }
            return {
              ...activeEnemy,
              targetX: player.current.x,
              targetY: player.current.y,
            };
          }
          if (!deadRef.current && length <= rangedAttackStartRange && now >= nextAttackAt) {
            if (rangedAttackConfig) {
              const [attackProjectile] = createLocalBossProjectilePattern(activeEnemy, player.current, {
                ...rangedAttackConfig,
                telegraphDuration: rangedAttackConfig.launchDelay,
                maxTravelDistance: rangedAttackConfig.range,
                projectileCount: 1,
                projectileSpread: 0,
              }, now);
              const attackUntilAt = attackProjectile.impactAt + safeNumber(rangedAttackConfig.recoveryDuration, 180);
              return {
                ...activeEnemy,
                nextAttackAt: now + safeNumber(rangedAttackConfig.cooldown, 1350),
                attackStartedAt: now,
                attackType: rangedAttackConfig.type,
                attackLaunchAt: attackProjectile.launchAt,
                attackImpactAt: attackProjectile.impactAt,
                attackUntil: attackUntilAt,
                attackResolved: false,
                attackOriginX: attackProjectile.originX,
                attackOriginY: attackProjectile.originY,
                attackTargetX: attackProjectile.targetX,
                attackTargetY: attackProjectile.targetY,
                attackProjectileRadius: attackProjectile.radius,
                targetX: player.current.x,
                targetY: player.current.y,
              };
            }
            return {
              ...activeEnemy,
              nextAttackAt: now + safeNumber(activeEnemy.attackCooldown, isBossEnemy ? 1100 : 850),
              attackStartedAt: now,
              attackType: 'melee',
              attackLaunchAt: 0,
              attackImpactAt: now + LOCAL_ENEMY_ATTACK_IMPACT_MS,
              attackUntil: now + LOCAL_ENEMY_ATTACK_ANIMATION_MS,
              attackResolved: false,
              targetX: player.current.x,
              targetY: player.current.y,
            };
          }
          if (rangedAttackConfig && length <= safeNumber(rangedAttackConfig.preferredRange, rangedAttackConfig.range)) {
            return {
              ...activeEnemy,
              targetX: player.current.x,
              targetY: player.current.y,
            };
          }

          let chaseX = dirX - dirY * drift + separation.x * separation.strength * 0.95;
          let chaseY = dirY + dirX * drift + separation.y * separation.strength * 0.95;
          const chaseLength = Math.hypot(chaseX, chaseY) || 1;
          chaseX /= chaseLength;
          chaseY /= chaseLength;
          const movement = moveEnemyWithCollision(
            tiledWorld.current,
            activeEnemy,
            activeEnemy.x + chaseX * (activeEnemy.speed ?? ENEMY.speed) * delta,
            activeEnemy.y + chaseY * (activeEnemy.speed ?? ENEMY.speed) * delta,
          );

          return {
            ...activeEnemy,
            x: movement.x,
            y: movement.y,
          };
        });
      }

      if (autoAttackHeld.current) {
        runAutoAttack(now);
      }

      const getEffectFollowPoint = (effect) => {
        if (!effect?.followCaster) return null;
        const casterId = effect.casterId == null ? null : String(effect.casterId);
        const localId = colyseusSessionIdRef.current == null ? null : String(colyseusSessionIdRef.current);
        if (!casterId || effect.localCaster || casterId === 'local' || (localId && casterId === localId)) {
          return safePoint(player.current, lastSafePlayerPositionRef.current);
        }
        const remoteCaster = displayedRemotePlayersRef.current.find((remotePlayer) => String(remotePlayer.id) === casterId)
          ?? remotePlayersRef.current.find((remotePlayer) => String(remotePlayer.id) === casterId);
        return remoteCaster && isFinitePoint(remoteCaster)
          ? { x: safeNumber(remoteCaster.x), y: safeNumber(remoteCaster.y), facing: safeNumber(remoteCaster.facing, effect.facing) }
          : null;
      };

      effects.current = effects.current
        .map((effect) => {
          try {
            const followPoint = getEffectFollowPoint(effect);
            if (followPoint) {
              effect = {
                ...effect,
                x: followPoint.x,
                y: followPoint.y,
                facing: effect.type === 'channel' ? safeNumber(followPoint.facing, effect.facing) : effect.facing,
              };
            }

          if (effect.type === 'chain') {
            if (deadRef.current) return effect;
            const chainTargets = (Array.isArray(effect.chainTargets) ? effect.chainTargets : [])
              .map((target) => (target && isFinitePoint(target)
                ? {
                  ...target,
                  id: target.id == null ? null : String(target.id),
                  x: safeNumber(target.x),
                  y: safeNumber(target.y),
                  radius: clamp(safeNumber(target.radius, ENEMY.radius), 6, 180),
                }
                : null))
              .filter((target) => target?.id);
            if (chainTargets.length === 0) {
              return {
                ...effect,
                duration: Math.min(effect.duration ?? 650, 650),
                hitTargetIds: [],
              };
            }

            const segmentMs = Math.max(80, effect.segmentMs ?? 230);
            const hitTargetIds = new Set((effect.hitTargetIds ?? []).map((id) => String(id)));
            const stats = characterRef.current ? getTotalStats(characterRef.current) : BASE_STATS;
            const statBonus = Math.floor(((stats.strength ?? 0) + (stats.agility ?? 0) + (stats.intellect ?? 0)) / 8);
            const damage = effect.damage
              ? Math.ceil((effect.damage + statBonus) * getDamageMultiplier(effect, now))
              : 0;

            chainTargets.forEach((target, index) => {
              if (!target?.id || hitTargetIds.has(String(target.id))) return;
              const impactAt = effect.start + (index + 1) * segmentMs;
              if (now < impactAt) return;
              const liveTarget = enemies.current.find((enemy) => String(enemy.id) === String(target.id));
              if (!liveTarget || !canShareLocalInteriorSpace(liveTarget)) return;

              hitTargetIds.add(String(target.id));
              if (damage <= 0) return;

              if (colyseusRoomRef.current) {
                sendAbilityToRoom(colyseusRoomRef.current, {
                  ability: abilityNetworkPayload(effect),
                  origin: { x: target.x, y: target.y },
                  facing: effect.facing,
                  damage,
                  targetEnemyId: target.id,
                  silent: true,
                });
                healFromLeech(damage, now);
                return;
              }

              let totalDamageDone = 0;
              const damagedEnemies = enemies.current.map((enemy) => {
                if (enemy.id !== target.id || !canShareLocalInteriorSpace(enemy)) return enemy;
                lastCombatAt.current = now;
                const finalDamage = getAbilityDamageAgainstEnemy(effect, damage, enemy, now);
                totalDamageDone += Math.min(enemy.hp, finalDamage);
                const ownerId = colyseusSessionIdRef.current ?? 'local';
                return applyAbilityDebuffsClient(
                  {
                    ...enemy,
                    state: 'aggro',
                    hp: enemy.hp - finalDamage,
                    targetPlayerId: enemy.targetPlayerId ?? ownerId,
                    firstHitPlayerId: enemy.firstHitPlayerId ?? ownerId,
                    leashStartedAt: null,
                    aggroDisabledUntil: null,
                    hitAt: now,
                  },
                  effect,
                  ownerId,
                  now,
                );
              });
              const defeatedEnemies = damagedEnemies.filter((enemy) => enemy.hp <= 0);
              enemies.current = damagedEnemies.filter((enemy) => enemy.hp > 0);
              if (defeatedEnemies.length > 0) {
                recordQuestKills(defeatedEnemies);
                rollNormalMobDrops(defeatedEnemies);
                awardExperience(defeatedEnemies.reduce((total, enemy) => total + (enemy.xp ?? ENEMY_XP), 0));
                if (defeatedEnemies.some((enemy) => enemy.type === 'boss')) {
                  nextBossSpawnAt.current = performance.now() + BOSS_RESPAWN_DELAY;
                }
                defeatedEnemies
                  .filter((enemy) => enemy.type === 'enemy' && enemy.spawnId)
                  .forEach((enemy) => scheduleWorldSpawnRespawn(worldSpawnPacks.current, enemy.spawnId, now, enemy.spawnSlot));
                defeatedEnemies
                  .filter((enemy) => enemy.type === 'boss')
                  .forEach((enemy) => addLoot(isDungeonEnemyKill(enemy) ? rollDungeonBossLoot() : rollBossLoot()));
                setEnemyCount(enemies.current.length);
              }
              healFromLeech(totalDamageDone, now);
            });

            return {
              ...effect,
              chainTargets,
              hitTargetIds: [...hitTargetIds],
            };
          }

          const tickable = ['channel', 'aura', 'ground', 'hot', 'healGround', 'trap'].includes(effect.type);
          if (!tickable || deadRef.current) return effect;
          const isRemoteCaster = effect.casterId
            && effect.casterId !== colyseusSessionIdRef.current
            && !effect.localCaster;
          if (isRemoteCaster) {
            if (effect.followCaster) {
              const remoteCaster = displayedRemotePlayersRef.current.find((remotePlayer) => remotePlayer.id === effect.casterId)
                ?? remotePlayersRef.current.find((remotePlayer) => remotePlayer.id === effect.casterId);
              if (remoteCaster) {
                return {
                  ...effect,
                  x: remoteCaster.x,
                  y: remoteCaster.y,
                  facing: effect.type === 'channel' ? safeNumber(remoteCaster.facing, effect.facing) : effect.facing,
                };
              }
            }
            return effect;
          }
          const casterPoint = safePoint(player.current, lastSafePlayerPositionRef.current);
          const liveChannelFacing = effect.type === 'channel' && effect.followCaster
            ? Math.atan2(mouse.current.y - casterPoint.y, mouse.current.x - casterPoint.x)
            : safeNumber(effect.facing, safeNumber(player.current.facing, 0));
          const effectFacing = Number.isFinite(liveChannelFacing)
            ? liveChannelFacing
            : safeNumber(effect.facing, safeNumber(player.current.facing, 0));
          if (effect.type === 'channel' && effect.followCaster) {
            player.current.facing = effectFacing;
          }
          if (effect.type === 'channel' && effect.localCaster && effect.holdKey && !keys.current.has(String(effect.holdKey).toLowerCase())) {
            sendChannelEndToRoom(effect);
            return { ...effect, start: 0, duration: 0 };
          }

          if (now < effect.nextTickAt) {
            return effect.followCaster
              ? { ...effect, x: casterPoint.x, y: casterPoint.y, facing: effectFacing }
              : { ...effect, facing: effectFacing };
          }

          if (effect.type === 'channel') {
            const resourceConfig = getResourceConfig(characterRef.current);
            const resourceCost = getEffectiveAbilityResourceCost(effect, characterRef.current, combatBuffsRef.current, now);
            if (getCurrentResource(characterRef.current, vitalsRef.current) < resourceCost) {
              setLastCast(`Channel interrupted: no ${resourceConfig.label.toLowerCase()}`);
              sendChannelEndToRoom(effect);
              return { ...effect, start: 0, duration: 0 };
            }

            setVitalsValue({
              ...vitalsRef.current,
              [resourceConfig.key]: Math.max(0, getCurrentResource(characterRef.current, vitalsRef.current) - resourceCost),
            });
          }

          const start = effect.followCaster ? casterPoint : safePoint(effect, casterPoint);
          const stats = characterRef.current ? getTotalStats(characterRef.current) : BASE_STATS;
          const statBonus = effect.type === 'channel'
            ? Math.floor((stats.intellect ?? 0) / 5)
            : Math.floor(((stats.strength ?? 0) + (stats.agility ?? 0) + (stats.intellect ?? 0)) / 10);
          const damage = effect.damage
            ? Math.ceil((effect.damage + statBonus) * getDamageMultiplier(effect, now))
            : 0;
          const healing = effect.healing
            ? Math.ceil((effect.healing + Math.floor((stats.intellect ?? 0) / 3)) * getCombatHealingMultiplier(combatBuffsRef.current, now))
            : 0;

          if (healing > 0 && (effect.type === 'hot' || effect.type === 'healGround')) {
            const targetId = effect.targetPlayerId;
            const healsSelf = !targetId || targetId === 'local' || targetId === colyseusSessionIdRef.current;
            const inGround = effect.type !== 'healGround' || distance(player.current, start) < (effect.radius ?? 118) + PLAYER.radius;
            if (healsSelf && inGround) {
              const totalStats = characterRef.current ? getTotalStats(characterRef.current) : BASE_STATS;
              setVitalsValue({
                ...vitalsRef.current,
                hp: Math.min(totalStats.health, vitalsRef.current.hp + healing),
              });
            }
            if (colyseusRoomRef.current) {
              sendAbilityToRoom(colyseusRoomRef.current, {
                ability: abilityNetworkPayload(effect),
                origin: start,
                facing: effectFacing,
                healing,
                targetPlayerId: effect.type === 'hot' ? targetId : null,
                silent: true,
              });
            }
            return {
              ...effect,
              x: effect.followCaster ? casterPoint.x : effect.x,
              y: effect.followCaster ? casterPoint.y : effect.y,
              facing: effectFacing,
              nextTickAt: now + getAbilityTickRateMs(effect),
            };
          }

          if (damage <= 0) {
            return {
              ...effect,
              x: effect.followCaster ? casterPoint.x : effect.x,
              y: effect.followCaster ? casterPoint.y : effect.y,
              facing: effectFacing,
              nextTickAt: now + getAbilityTickRateMs(effect),
            };
          }

          if (colyseusRoomRef.current) {
            const sentTargetedDamage = sendDamageToHitEnemies(
              colyseusRoomRef.current,
              effect,
              start,
              effectFacing,
              damage,
              { silent: true },
            );
            if (sentTargetedDamage) healFromLeech(damage, now);
            if (effect.type === 'trap' && sentTargetedDamage) {
              return { ...effect, type: 'nova', x: start.x, y: start.y, start: now, duration: 520, facing: effectFacing, radius: effect.radius ?? 92, damage: 0 };
            }
          } else {
            let totalDamageDone = 0;
            let hitCount = 0;
            const damagedEnemies = enemies.current.map((enemy) => {
              if (!canShareLocalInteriorSpace(enemy)) return enemy;
              const hit = abilityHitsEnemyClient(effect, start, effectFacing, enemy);
              if (!hit) return enemy;
              combatEnemyIdsRef.current.add(String(enemy.id));
              if (hasHunterPet(characterRef.current)) {
                hunterPetRef.current.targetEnemyId = enemy.id;
              }
              hitCount += 1;
              lastCombatAt.current = now;
              const finalDamage = getAbilityDamageAgainstEnemy(effect, damage, enemy, now);
              totalDamageDone += Math.min(enemy.hp, finalDamage);
              const ownerId = colyseusSessionIdRef.current ?? 'local';
              return applyAbilityDebuffsClient(
                {
                  ...enemy,
                  state: 'aggro',
                  hp: enemy.hp - finalDamage,
                  targetPlayerId: enemy.targetPlayerId ?? ownerId,
                  firstHitPlayerId: enemy.firstHitPlayerId ?? ownerId,
                  leashStartedAt: null,
                  aggroDisabledUntil: null,
                  hitAt: now,
                },
                effect,
                ownerId,
                now,
              );
            });
            const defeatedEnemies = damagedEnemies.filter((enemy) => enemy.hp <= 0);
            enemies.current = damagedEnemies.filter((enemy) => enemy.hp > 0);

            if (defeatedEnemies.length > 0) {
              recordQuestKills(defeatedEnemies);
              rollNormalMobDrops(defeatedEnemies);
              awardExperience(defeatedEnemies.reduce((total, enemy) => total + (enemy.xp ?? ENEMY_XP), 0));
              if (defeatedEnemies.some((enemy) => enemy.type === 'boss')) {
                nextBossSpawnAt.current = performance.now() + BOSS_RESPAWN_DELAY;
              }
              defeatedEnemies
                .filter((enemy) => enemy.type === 'enemy' && enemy.spawnId)
                .forEach((enemy) => scheduleWorldSpawnRespawn(worldSpawnPacks.current, enemy.spawnId, now, enemy.spawnSlot));
              defeatedEnemies
                .filter((enemy) => enemy.type === 'boss')
                .forEach((enemy) => addLoot(isDungeonEnemyKill(enemy) ? rollDungeonBossLoot() : rollBossLoot()));
              setEnemyCount(enemies.current.length);
            }
            healFromLeech(totalDamageDone, now);
            if (effect.type === 'trap' && hitCount > 0) {
              return { ...effect, type: 'nova', x: start.x, y: start.y, start: now, duration: 520, facing: effectFacing, radius: effect.radius ?? 92, damage: 0 };
            }
          }

          return {
            ...effect,
            x: effect.followCaster ? casterPoint.x : effect.x,
            y: effect.followCaster ? casterPoint.y : effect.y,
            facing: effectFacing,
            nextTickAt: now + getAbilityTickRateMs(effect),
          };
          } catch (effectError) {
            console.error('Effect update failed', effectError, effect);
            setRenderStatus(`Dropped broken effect: ${effect?.name ?? effect?.type ?? 'unknown'}`);
            return null;
          }
        })
        .filter((effect) => effect && now - effect.start < effect.duration);

      const autoBoltBuffs = combatBuffsRef.current;
      if (
        characterRef.current
        && !deadRef.current
        && now < (autoBoltBuffs.autoCombatBoltUntil ?? 0)
        && now >= (autoBoltBuffs.nextAutoCombatBoltAt ?? 0)
      ) {
        const casterId = colyseusSessionIdRef.current ?? 'local';
        const casterPoint = safePoint(player.current, lastSafePlayerPositionRef.current);
        autoBoltBuffs.nextAutoCombatBoltAt = now + Math.max(250, autoBoltBuffs.autoBoltInterval ?? 1000);
        const combatOnly = autoBoltBuffs.autoBoltCombatOnly !== false;
        const combatEnemyIds = combatEnemyIdsRef.current;
        enemies.current.forEach((enemy) => {
          if (enemy?.id != null && enemy.hp <= 0) combatEnemyIds.delete(String(enemy.id));
        });
        const classId = characterRef.current.classId;
        const autoBoltRange = classId === 'mage' ? 760 : 900;
        const isAutoBoltCombatTarget = (enemy) => {
          if (!combatOnly) return true;
          const enemyId = String(enemy.id);
          return combatEnemyIds.has(enemyId)
            || String(enemy.targetPlayerId ?? '') === String(casterId)
            || String(enemy.firstHitPlayerId ?? '') === String(casterId)
            || (enemy.state === 'aggro' && now - lastCombatAt.current < PLAYER.outOfCombatDelay);
        };
        const candidateTargets = enemies.current
          .filter((enemy) => enemy && enemy.hp > 0)
          .filter(canShareLocalInteriorSpace)
          .filter((enemy) => distance(enemy, casterPoint) <= autoBoltRange)
          .filter((enemy) => {
            const sameMap = !currentMapIdRef.current || !enemy.mapId || getGameplayMapSpaceId(enemy.mapId) === getGameplayMapSpaceId(currentMapIdRef.current);
            const combatTarget = isAutoBoltCombatTarget(enemy);
            return combatTarget && (sameMap || combatEnemyIds.has(String(enemy.id)));
          });
        const selectAutoBoltTarget = () => {
          const currentTargetId = autoBoltBuffs.autoBoltTargetId == null ? null : String(autoBoltBuffs.autoBoltTargetId);
          const currentTarget = currentTargetId
            ? candidateTargets.find((enemy) => String(enemy.id) === currentTargetId)
            : null;
          if (currentTarget) return currentTarget;
          const nextTarget = candidateTargets
            .sort((a, b) => distance(a, casterPoint) - distance(b, casterPoint))[0] ?? null;
          autoBoltBuffs.autoBoltTargetId = nextTarget?.id ?? null;
          return nextTarget;
        };
        const target = selectAutoBoltTarget();

        if (target) {
          const autoBoltAbility = attachAbilityVisual(
            enrichAbilityForCast({
              key: 'auto-form-bolt',
              name: autoBoltBuffs.autoBoltName ?? (classId === 'mage' ? 'Frost Bolt' : 'Void Bolt'),
              type: 'bolt',
              color: classId === 'mage' ? '#bae6fd' : '#8b5cf6',
              damage: Math.max(1, autoBoltBuffs.autoBoltDamage ?? 24),
              range: 620,
              width: 24,
              pierce: false,
              cooldown: 0,
            }, characterRef.current, autoBoltBuffs, now, { consumeStealth: false }),
            classId,
          );
          launchSingleTargetProjectile(casterPoint, target, {
            ...autoBoltAbility,
            range: Math.max(autoBoltAbility.range ?? 620, distance(casterPoint, target) + 16),
          }, now, { afterImpactMs: 260, travelType: 'bolt' });
        }
      }

      updateHunterPet(now, delta);
      draw(now);
      const lastRenderedPosition = lastPositionRenderRef.current;
      const movedSinceRender = distance(lastRenderedPosition, player.current);
      if (now - lastRenderedPosition.at > 100 || movedSinceRender > 48) {
        lastPositionRenderRef.current = {
          at: now,
          x: player.current.x,
          y: player.current.y,
        };
        setPosition({ ...player.current });
      }

      if (characterRef.current && !deadRef.current) {
        const activeCharacter = characterRef.current;
        const stats = getTotalStats(activeCharacter);
        const buffs = combatBuffsRef.current;
        const hpMax = Math.ceil((stats.health ?? BASE_STATS.health) * (
          now < (buffs.maxHealthMultiplierUntil ?? 0)
            ? Math.max(1, buffs.maxHealthMultiplier ?? 1)
            : 1
        ));
        const resourceConfig = getResourceConfig(activeCharacter);
        const hasNearbyAggro = enemies.current.some((enemy) => (
          canShareLocalInteriorSpace(enemy) && enemy.state === 'aggro' && distance(enemy, player.current) < 220
        ));
        const outOfCombat = !hasNearbyAggro && now - lastCombatAt.current > PLAYER.outOfCombatDelay;
        let nextVitals = vitalsRef.current;

        if (resourceConfig.key === 'mana' && nextVitals.mana < stats.mana) {
          nextVitals = {
            ...nextVitals,
            mana: Math.min(
              stats.mana,
              nextVitals.mana
                + PLAYER.manaRegen * delta
                + (now < (buffs.manaRegenUntil ?? 0) ? (buffs.manaRegenPerSecond ?? 0) * delta : 0),
            ),
          };
        }
        if (resourceConfig.key === 'fury' && now < (buffs.furyRegenUntil ?? 0)) {
          nextVitals = {
            ...nextVitals,
            fury: Math.min(resourceConfig.max, (nextVitals.fury ?? 0) + (buffs.furyRegenPerSecond ?? 0) * delta),
          };
        }
        if (resourceConfig.key === 'fury' && nextVitals.fury > resourceConfig.max) {
          nextVitals = {
            ...nextVitals,
            fury: resourceConfig.max,
          };
        }
        if (resourceConfig.key === 'energy' && (nextVitals.energy ?? 0) < resourceConfig.max) {
          nextVitals = {
            ...nextVitals,
            energy: Math.min(resourceConfig.max, (nextVitals.energy ?? 0) + ROGUE_ENERGY_REGEN_PER_SECOND * delta),
          };
        }
        if (outOfCombat && nextVitals.hp < stats.health) {
          nextVitals = {
            ...nextVitals,
            hp: Math.min(hpMax, nextVitals.hp + PLAYER.hpRegen * delta),
          };
        }
        if (now < buffs.regenUntil && nextVitals.hp < hpMax) {
          nextVitals = {
            ...nextVitals,
            hp: Math.min(
              hpMax,
              nextVitals.hp + (buffs.regenPerSecond ?? 0) * delta,
            ),
          };
        }
        if (nextVitals.hp > hpMax) {
          nextVitals = {
            ...nextVitals,
            hp: hpMax,
          };
        }

        if (nextVitals !== vitalsRef.current) {
          setVitalsValue(nextVitals);
        }
      }
      const serviceOpen = openUiRef.current?.shopOpen
        || openUiRef.current?.bankOpen
        || openUiRef.current?.auctionOpen
        || openUiRef.current?.repairOpen
        || openUiRef.current?.professionOpen;
      if (serviceOpen && !getNearbyServiceNpc(tiledWorld.current, player.current)) {
        closeServicePanels();
        setActiveServiceNpcId(null);
      }
      const openQuestGiverId = questDialogGiverIdRef.current;
      if (openQuestGiverId) {
        const openQuestGiver = getQuestGiverForMap(tiledWorld.current, openQuestGiverId);
        const interactRange = safeNumber(openQuestGiver?.interactRange, 96);
        if (!openQuestGiver || distance(player.current, openQuestGiver) > interactRange + 45) {
          questDialogGiverIdRef.current = null;
          setQuestDialogGiverId(null);
          setSelectedQuestDialogId(null);
        }
      }
        animationFrame = requestAnimationFrame(tick);
      } catch (error) {
        console.error(error);
        setRenderStatus(`Loop error: ${error.message}`);
        try {
          draw(performance.now());
        } catch (drawError) {
          console.error(drawError);
          setRenderStatus(`Draw error: ${drawError.message}`);
        }
        animationFrame = requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', updateMouse);
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', stopAutoAttack);
    window.addEventListener('blur', stopAutoAttack);
    canvas.addEventListener('pointerleave', stopAutoAttack);
    canvas.addEventListener('contextmenu', preventContextMenu);
    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', updateMouse);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', stopAutoAttack);
      window.removeEventListener('blur', stopAutoAttack);
      canvas.removeEventListener('pointerleave', stopAutoAttack);
      canvas.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [keys, Boolean(character)]);

  const currentClass = character ? CLASSES[character.classId] : null;
  const currentLevel = character?.level ?? 1;
  const currentXp = character?.xp ?? 0;
  const nextLevelXp = xpForLevel(currentLevel);
  const unlockedAbilities = character ? getCharacterAbilities(character) : [];
  const currentStats = character ? getTotalStats(character) : BASE_STATS;
  const nowForCooldowns = performance.now();
  const slottedAbilities = abilitySlots.map((abilityId, index) => resolveAbility(unlockedAbilities, abilityId, index + 1));
  const equippedItems = getEquippedItems(character);
  const inventory = character?.inventory ?? [];
  const bagItems = inventory.filter((item) => !item.equippedSlot);
  const potionBagItems = bagItems.filter((item) => isPotionItem(item));
  const gearBagItems = bagItems.filter((item) => !isPotionItem(item));
  const sellableBagItems = bagItems.filter((item) => !item.nonDestroyable && item.type !== 'usable');
  const bankItems = character?.bank ?? [];
  const selectedPotion = inventory.find((item) => item.id === character?.selectedPotionId && isPotionItem(item))
    ?? potionBagItems[0]
    ?? null;
  const potionCooldownRemaining = Math.max(0, Math.ceil((potionCooldownUntil - nowForCooldowns) / 1000));
  const activeServiceNpc = activeServiceNpcId == null
    ? null
    : (tiledWorld.current?.npcs ?? [])
      .map(normalizeServiceNpc)
      .find((npc) => String(npc.id ?? npc.name) === String(activeServiceNpcId)) ?? null;
  const activeShopType = String(activeServiceNpc?.shopType || activeServiceNpc?.props?.shopType || 'general').toLowerCase();
  const activeVendorStock = CITY_VENDOR_STOCK[activeShopType] ?? CITY_VENDOR_STOCK.general;
  const repairCost = character ? getRepairAllCost(character) : 0;
  const activeProfessionId = activeServiceNpc?.professionId || activeServiceNpc?.props?.professionId || null;
  const activeProfession = activeProfessionId ? PROFESSION_BY_ID[activeProfessionId] : null;
  const learnedProfessions = PROFESSIONS.filter((profession) => character?.professions?.[profession.id]?.learned);
  const learnedProfessionCount = learnedProfessions.length;
  const professionLimitReached = learnedProfessionCount >= 2;
  const auctionInventoryItems = bagItems.filter((item) => !item.equippedSlot && !item.nonDestroyable);
  const hoveredInventoryItem = hoveredInventoryItemId
    ? bagItems.find((item) => item.id === hoveredInventoryItemId) ?? null
    : null;
  const hoveredItemDiffs = hoveredInventoryItem ? getItemStatDiffGroups(hoveredInventoryItem, equippedItems) : { positive: [], negative: [] };
  const destroyConfirmItem = destroyConfirmItemId
    ? bagItems.find((item) => item.id === destroyConfirmItemId) ?? null
    : null;
  const gold = character?.gold ?? 0;
  const displayHp = Math.ceil(vitals.hp);
  const resourceConfig = character ? getResourceConfig(character) : { key: 'mana', label: 'Mana', max: BASE_STATS.mana };
  const displayResource = Math.floor(getCurrentResource(character, vitals));
  const resourceMax = Math.max(1, getResourceMax(character, currentStats));
  const nearServiceNpc = character ? getNearbyServiceNpc(tiledWorld.current, position) : null;
  const activeShopkeeper = activeServiceNpc ?? nearServiceNpc ?? getShopkeeperFromMap(tiledWorld.current);
  const nearShopkeeper = Boolean(nearServiceNpc);
  const talentTree = character ? TALENTS[character.classId] : null;
  const selectedTalentSpec = character?.talents?.spec ?? null;
  const availableTalentPoints = character ? getAvailableTalentPoints(character) : 0;
  const spentTalentPoints = character ? getSpentTalentPoints(character) : 0;
  const totalTalentPoints = character ? getEarnedTalentPoints(character) : 0;
  const selectedPlayer = displayedRemotePlayersRef.current.find((remotePlayer) => remotePlayer.id === selectedPlayerId) ?? null;
  const isLocalPartyLeader = partyMembers.some((member) => member.isSelf && member.isLeader);
  const minimapWorldWidth = getTiledWorldPixelWidth(tiledWorld.current);
  const minimapWorldHeight = getTiledWorldPixelHeight(tiledWorld.current);
  const minimapViewSize = 1050;
  const minimapView = {
    x: clamp(position.x - minimapViewSize / 2, 0, Math.max(0, minimapWorldWidth - minimapViewSize)),
    y: clamp(position.y - minimapViewSize / 2, 0, Math.max(0, minimapWorldHeight - minimapViewSize)),
    width: Math.min(minimapViewSize, minimapWorldWidth),
    height: Math.min(minimapViewSize, minimapWorldHeight),
  };
  const pointInMinimapView = (point) => (
    point.x >= minimapView.x
    && point.y >= minimapView.y
    && point.x <= minimapView.x + minimapView.width
    && point.y <= minimapView.y + minimapView.height
  );
  const worldMapZoomValue = clamp(safeNumber(worldMapZoom, 1), 1, WORLD_MAP_MAX_ZOOM);
  const isWorldV2CurrentMap = isWorldV2Map(currentMapId);
  const registryTileSize = safeNumber(worldV2Registry?.tileSize, WORLD.tile);
  const registryZones = isWorldV2CurrentMap
    ? (worldV2Registry?.regions ?? []).map((region) => createRegistryZone(region, registryTileSize))
    : [];
  const markerZones = (tiledWorld.current?.regionMarkers ?? [])
    .filter((marker) => marker.props?.type === 'region' && marker.props?.showOnMap !== false)
    .map((marker) => ({
      ...marker,
      id: marker.props?.regionId ?? marker.name,
      props: {
        ...marker.props,
        zoneId: marker.props?.zoneId ?? marker.props?.regionId ?? marker.name,
        biomeType: marker.props?.biomeType ?? marker.props?.biomeId,
        description: marker.props?.description ?? marker.props?.role,
      },
    }));
  const legacyZones = (tiledWorld.current?.zones ?? []).map((zone) => ({
    ...zone,
    props: {
      ...(zone.props ?? {}),
      zoneId: zone.props?.zoneId ?? zone.id ?? zone.name,
      biomeType: zone.props?.biomeType ?? zone.props?.biomeId,
    },
  }));
  const mapZones = dedupeZones(isWorldV2CurrentMap
    ? registryZones
    : [...legacyZones, ...markerZones]);
  const currentMapZone = mapZones.find((zone) => isPointInsideZone(position, zone)) ?? mapZones[0] ?? null;
  const selectedMapZone = selectedMapZoneId
    ? mapZones.find((zone) => getZoneId(zone) === selectedMapZoneId) ?? null
    : null;
  const focusedMapZone = selectedMapZone ?? currentMapZone;
  const isFullWorldMapMode = isWorldV2CurrentMap || worldMapMode === 'world';
  const worldMapCenterPoint = worldMapCenter && isFinitePoint(worldMapCenter)
    ? {
      x: clamp(worldMapCenter.x, 0, minimapWorldWidth),
      y: clamp(worldMapCenter.y, 0, minimapWorldHeight),
    }
    : {
      x: minimapWorldWidth / 2,
      y: minimapWorldHeight / 2,
    };
  const fullWorldMapViewWidth = Math.max(1, minimapWorldWidth / worldMapZoomValue);
  const fullWorldMapViewHeight = Math.max(1, minimapWorldHeight / worldMapZoomValue);
  const fullWorldMapView = {
    x: clamp(worldMapCenterPoint.x - fullWorldMapViewWidth / 2, 0, Math.max(0, minimapWorldWidth - fullWorldMapViewWidth)),
    y: clamp(worldMapCenterPoint.y - fullWorldMapViewHeight / 2, 0, Math.max(0, minimapWorldHeight - fullWorldMapViewHeight)),
    width: fullWorldMapViewWidth,
    height: fullWorldMapViewHeight,
  };
  const worldMapView = isFullWorldMapMode
    ? fullWorldMapView
    : zoneViewFor(focusedMapZone, minimapWorldWidth, minimapWorldHeight, clamp(worldMapZoomValue, 1, 4));
  const pointInWorldMapView = (point) => (
    point.x >= worldMapView.x
    && point.y >= worldMapView.y
    && point.x <= worldMapView.x + worldMapView.width
    && point.y <= worldMapView.y + worldMapView.height
  );
  const minimapEnemies = SHOW_MAP_ENEMY_DOTS
    ? enemies.current.filter(canShareLocalInteriorSpace).filter(pointInMinimapView).slice(0, 80)
    : [];
  const mapEnemies = SHOW_MAP_ENEMY_DOTS
    ? enemies.current.filter(canShareLocalInteriorSpace).filter(pointInWorldMapView).slice(0, 180)
    : [];
  const minimapPlayers = displayedRemotePlayersRef.current.filter(pointInMinimapView).slice(0, 12);
  const mapPlayers = displayedRemotePlayersRef.current.filter(pointInWorldMapView).slice(0, 30);
  const minimapPercent = (point, axis) => {
    const min = axis === 'x' ? minimapView.x : minimapView.y;
    const size = axis === 'x' ? minimapView.width : minimapView.height;
    return clamp(((point[axis] - min) / Math.max(1, size)) * 100, 0, 100);
  };
  const worldMapPercent = (point, axis) => {
    const min = axis === 'x' ? worldMapView.x : worldMapView.y;
    const size = axis === 'x' ? worldMapView.width : worldMapView.height;
    return clamp(((point[axis] - min) / Math.max(1, size)) * 100, -20, 120);
  };
  const minimapZones = mapZones
    .map((zone) => ({ ...zone, label: formatZoneDisplayName(zone) }))
    .filter((zone) => zone.label && zoneIntersectsView(zone, minimapView));
  const worldMapZones = mapZones
    .map((zone) => ({ ...zone, label: formatZoneDisplayName(zone), biomeId: getZoneBiomeId(zone) }))
    .filter((zone) => zone.label && zoneIntersectsView(zone, worldMapView));
  const mapZoneTitle = formatZoneDisplayName(focusedMapZone) || (currentMapId === 'dungeon_01' ? 'Dungeon Map' : 'Zone Map');
  const selectedMapZoneTitle = formatZoneDisplayName(selectedMapZone) || formatZoneDisplayName(currentMapZone);
  const focusedMapZoneDescription = getZoneDescription(focusedMapZone);
  const focusedMapZoneLevel = getZoneLevelLabel(focusedMapZone);
  const hasWorldMapOverviewImage = Boolean(
    isWorldV2CurrentMap
    && worldMapOverviewReady
    && worldMapOverviewImageRef.current,
  );
  const isWorldMapOverviewZoom = isFullWorldMapMode && worldMapZoomValue <= 1.05;
  const activeLocalInteriorIdForMap = getActiveLocalInteriorId();
  const registryLandmarks = isWorldV2CurrentMap
    ? (worldV2Registry?.landmarks ?? [])
      .filter((landmark) => landmark.showOnMap !== false)
      .filter((landmark) => {
        const landmarkInteriorId = getLocalInteriorId(landmark);
        return !landmarkInteriorId || landmarkInteriorId === activeLocalInteriorIdForMap;
      })
      .map((landmark) => ({
        id: landmark.id,
        x: safeNumber(landmark.x, 0) * registryTileSize,
        y: safeNumber(landmark.y, 0) * registryTileSize,
        kind: landmark.kind,
        displayName: landmark.displayName ?? landmark.id,
      }))
    : (tiledWorld.current?.landmarks ?? [])
      .filter((landmark) => landmark.props?.showOnMap !== false && landmark.props?.debugOnly !== true)
      .map((landmark) => ({
        id: landmark.props?.landmarkId ?? landmark.name,
        x: safeNumber(landmark.x, 0),
        y: safeNumber(landmark.y, 0),
        kind: landmark.props?.landmarkKind ?? landmark.props?.type,
        displayName: landmark.props?.displayName ?? landmark.name,
      }));
  const mapLandmarks = registryLandmarks
    .filter(pointInWorldMapView)
    .slice(0, isFullWorldMapMode ? 80 : 30);
  const nearQuestGiver = character ? getQuestGiverNear(tiledWorld.current, position) : null;
  const activeQuestGiver = character && questDialogGiverId
    ? (tiledWorld.current?.questGivers ?? []).find((giver) => String(giver.id) === String(questDialogGiverId)) ?? null
    : null;
  const questTurnIns = activeQuestGiver ? getTurnInQuestEntries(character, activeQuestGiver, currentMapId) : [];
  const questOffers = activeQuestGiver ? getAvailableQuestOffers(character, tiledWorld.current, activeQuestGiver) : [];
  const questDialogEntries = [
    ...questTurnIns.map((entry) => ({ ...entry, id: `turnin:${entry.questId}`, kind: 'turnin' })),
    ...questOffers.map((quest) => ({
      id: `offer:${quest.id}`,
      kind: 'offer',
      questId: quest.id,
      quest,
      activeQuest: null,
    })),
  ];
  const selectedQuestDialogEntry = questDialogEntries.find((entry) => (
    entry.id === selectedQuestDialogId || entry.questId === selectedQuestDialogId
  )) ?? questDialogEntries[0] ?? null;
  const selectedQuestDialogQuest = selectedQuestDialogEntry?.quest ?? null;
  const selectedQuestDialogActive = selectedQuestDialogEntry?.activeQuest ?? null;
  const questLogEntries = Object.entries(character?.quests?.active ?? {})
    .map(([questId, activeQuest]) => ({ questId, activeQuest, quest: getQuestSnapshot(activeQuest) }))
    .filter((entry) => entry.quest)
    .sort((a, b) => safeNumber(a.quest.chainIndex, 0) - safeNumber(b.quest.chainIndex, 0));
  const mainQuestEntry = getMainQuest(character);
  const selectedQuestLogEntry = mainQuestEntry ?? questLogEntries[0] ?? null;
  const selectedQuestLogId = selectedQuestLogEntry?.questId ?? selectedQuestLogEntry?.id ?? null;
  const mainQuestId = mainQuestEntry?.id ?? mainQuestEntry?.questId ?? null;
  const questMarkerEntries = questLogEntries
    .map((entry) => ({
      ...entry,
      marker: getQuestMarkerForMap(entry.quest, currentMapId, entry.activeQuest),
      isMain: entry.questId === mainQuestId,
    }))
    .filter((entry) => entry.marker);
  const minimapQuestMarkerEntries = questMarkerEntries.filter((entry) => questMarkerIntersectsView(entry.marker, minimapView));
  const worldMapQuestMarkerEntries = questMarkerEntries.filter((entry) => questMarkerIntersectsView(entry.marker, worldMapView));
  const adminOnlineByEmail = new Map(
    adminOnlinePlayers
      .filter((onlinePlayer) => onlinePlayer.email)
      .map((onlinePlayer) => [String(onlinePlayer.email).toLowerCase(), onlinePlayer]),
  );
  const adminAccountGroupsMap = adminCloudCharacters.reduce((groups, cloudCharacter) => {
    const ownerKey = String(cloudCharacter.ownerEmail || cloudCharacter.ownerUid || 'unknown').toLowerCase();
    if (!groups[ownerKey]) {
      groups[ownerKey] = {
        key: ownerKey,
        email: cloudCharacter.ownerEmail || 'Unknown account',
        uid: cloudCharacter.ownerUid ?? '',
        characters: [],
        online: null,
      };
    }
    groups[ownerKey].characters.push(cloudCharacter);
    groups[ownerKey].online = adminOnlineByEmail.get(ownerKey) ?? groups[ownerKey].online;
    return groups;
  }, {});
  adminOnlinePlayers.forEach((onlinePlayer) => {
    const ownerKey = String(onlinePlayer.email || onlinePlayer.id || 'unknown').toLowerCase();
    if (!adminAccountGroupsMap[ownerKey]) {
      adminAccountGroupsMap[ownerKey] = {
        key: ownerKey,
        email: onlinePlayer.email || 'Unknown account',
        uid: '',
        characters: [],
        online: onlinePlayer,
      };
    } else {
      adminAccountGroupsMap[ownerKey].online = onlinePlayer;
      if (!adminAccountGroupsMap[ownerKey].email || adminAccountGroupsMap[ownerKey].email === 'Unknown account') {
        adminAccountGroupsMap[ownerKey].email = onlinePlayer.email || 'Unknown account';
      }
    }
  });
  const adminAccountGroups = Object.values(adminAccountGroupsMap)
    .sort((a, b) => String(a.email).localeCompare(String(b.email)));
  const waypointDistance = worldMapWaypoint ? Math.round(distance(position, worldMapWaypoint)) : 0;
  const waypointInCurrentMap = Boolean(
    worldMapWaypoint
    && getGameplayMapSpaceId(worldMapWaypoint.mapId) === getGameplayMapSpaceId(currentMapId),
  );
  const waypointInMinimapView = Boolean(waypointInCurrentMap && pointInMinimapView(worldMapWaypoint));
  const worldMapViewBox = `${worldMapView.x / registryTileSize} ${worldMapView.y / registryTileSize} ${Math.max(1, worldMapView.width / registryTileSize)} ${Math.max(1, worldMapView.height / registryTileSize)}`;
  const registryRoads = isWorldV2CurrentMap ? worldV2Registry?.roads ?? [] : [];
  const registryRivers = isWorldV2CurrentMap ? worldV2Registry?.rivers ?? [] : [];
  const registryLakes = isWorldV2CurrentMap ? worldV2Registry?.lakes ?? [] : [];
  const makeRegistryPath = (points = []) => points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${safeNumber(x, 0)} ${safeNumber(y, 0)}`)
    .join(' ');
  const clampWorldMapCenterForView = (centerX, centerY, viewWidth = worldMapView.width, viewHeight = worldMapView.height) => ({
    x: viewWidth >= minimapWorldWidth
      ? minimapWorldWidth / 2
      : clamp(centerX, viewWidth / 2, minimapWorldWidth - viewWidth / 2),
    y: viewHeight >= minimapWorldHeight
      ? minimapWorldHeight / 2
      : clamp(centerY, viewHeight / 2, minimapWorldHeight - viewHeight / 2),
  });
  const getWorldMapPointFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = worldMapView.x + ((event.clientX - rect.left) / rect.width) * worldMapView.width;
    const y = worldMapView.y + ((event.clientY - rect.top) / rect.height) * worldMapView.height;
    const mapId = isWorldV2CurrentMap
      ? getWorldV2MapIdFromPoint(x, y, getWorldGenerationIdFromMapId(currentMapId)) ?? currentMapId
      : currentMapId;
    return {
      x: clamp(x, 0, minimapWorldWidth),
      y: clamp(y, 0, minimapWorldHeight),
      mapId,
    };
  };
  const handleWorldMapPointerDown = (event) => {
    if (!isFullWorldMapMode || worldMapZoomValue <= 1.001 || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    event.preventDefault();
    worldMapDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerX: worldMapView.x + worldMapView.width / 2,
      centerY: worldMapView.y + worldMapView.height / 2,
      viewWidth: worldMapView.width,
      viewHeight: worldMapView.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setWorldMapDragging(true);
  };
  const handleWorldMapPointerMove = (event) => {
    const drag = worldMapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.moved = true;

    const nextCenter = clampWorldMapCenterForView(
      drag.centerX - (deltaX / rect.width) * drag.viewWidth,
      drag.centerY - (deltaY / rect.height) * drag.viewHeight,
      drag.viewWidth,
      drag.viewHeight,
    );
    mapCanvasDrawRef.current.world = 0;
    setWorldMapCenter(nextCenter);
  };
  const finishWorldMapDrag = (event) => {
    const drag = worldMapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) suppressWorldMapClickRef.current = true;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    worldMapDragRef.current = null;
    setWorldMapDragging(false);
  };
  const handleWorldMapClick = (event) => {
    if (suppressWorldMapClickRef.current) {
      suppressWorldMapClickRef.current = false;
      return;
    }
    const nextWaypoint = getWorldMapPointFromEvent(event);
    if (!nextWaypoint) return;
    setWorldMapWaypoint(nextWaypoint);
    setLastCast(`Waypoint: ${Math.round(nextWaypoint.x)}, ${Math.round(nextWaypoint.y)}`);
  };
  const handleWorldMapDoubleClick = (event) => {
    if (!isAdmin || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    suppressWorldMapClickRef.current = false;
    const target = getWorldMapPointFromEvent(event);
    if (!target) return;
    adminTeleportToLocation(target);
  };
  const handleWorldMapWheel = (event) => {
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const pointerX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const pointerY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const anchorX = worldMapView.x + pointerX * worldMapView.width;
    const anchorY = worldMapView.y + pointerY * worldMapView.height;
    const maxZoom = isFullWorldMapMode ? WORLD_MAP_MAX_ZOOM : 4;
    const nextZoom = clamp(worldMapZoomValue * Math.exp(-event.deltaY * 0.001), 1, maxZoom);
    if (!Number.isFinite(nextZoom) || Math.abs(nextZoom - worldMapZoomValue) < 0.01) return;

    if (isFullWorldMapMode) {
      const nextWidth = Math.max(1, minimapWorldWidth / nextZoom);
      const nextHeight = Math.max(1, minimapWorldHeight / nextZoom);
      const nextX = clamp(anchorX - pointerX * nextWidth, 0, Math.max(0, minimapWorldWidth - nextWidth));
      const nextY = clamp(anchorY - pointerY * nextHeight, 0, Math.max(0, minimapWorldHeight - nextHeight));
      setWorldMapCenter(nextZoom <= 1.001
        ? null
        : {
          x: nextX + nextWidth / 2,
          y: nextY + nextHeight / 2,
        });
    }

    mapCanvasDrawRef.current.world = 0;
    setWorldMapZoom(nextZoom);
  };
  const handleWorldMapContextMenu = (event) => {
    event.preventDefault();
    if (isWorldV2CurrentMap) {
      setWorldMapMode('world');
      setSelectedMapZoneId(null);
      setWorldMapZoom(1);
      setWorldMapCenter(null);
      mapCanvasDrawRef.current.world = 0;
      setLastCast('Full world map');
      return;
    }
    setWorldMapMode((mode) => (mode === 'world' ? 'zone' : 'world'));
    setWorldMapZoom(1);
    setWorldMapCenter(null);
    setLastCast(worldMapMode === 'world' ? 'Zone map' : 'Full world map');
  };
  const selectedPlayerHpPercent = selectedPlayer
    ? (clamp(selectedPlayer.hp ?? selectedPlayer.maxHp, 0, selectedPlayer.maxHp ?? 1) / Math.max(1, selectedPlayer.maxHp ?? 1)) * 100
    : 0;
  const dayNightModeLabel = dayNightDebugState.mode === 'forced' ? 'Forced' : 'Auto';
  const dayNightPhaseLabel = String(dayNightDebugState.phase ?? 'day');
  const dayNightForcedPhase = dayNightDebugState.forcedPhase ?? null;
  const dayNightSpeedMultiplier = safeNumber(dayNightDebugState.speedMultiplier, 1);
  const weatherModeLabel = weatherDebugState.mode === 'forced' ? 'Forced' : 'Auto';
  const weatherPhaseLabel = String(weatherDebugState.phase ?? 'clear');
  const weatherForcedPhase = weatherDebugState.forcedWeather ?? null;
  const weatherSpeedMultiplier = safeNumber(weatherDebugState.speedMultiplier, 1);
  const weatherTargetLabel = weatherDebugState.transition?.from === weatherDebugState.transition?.to
    ? weatherDebugState.remainingLabel
    : weatherDebugState.transitionLabel;

  React.useEffect(() => {
    const getTilesetForGid = (tilesets, gid) => [...tilesets].reverse().find((candidate) => gid >= candidate.firstgid) ?? null;
    const overviewObjectLayerNames = new Set(['tamzia_river_tribe', 'tamzia_forest', 'tamzia_bandit_forest', 'tamzia_dense_forest']);
    const tiledGidMask = 0x1fffffff;

    const parseMapColor = (color) => {
      const match = String(color ?? '').trim().match(/^#?([0-9a-f]{6})$/i);
      if (!match) return [76, 133, 71];
      const value = Number.parseInt(match[1], 16);
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    };

    const blendChannel = (a, b, amount) => a + (b - a) * amount;
    const smoothStep = (value) => {
      const t = clamp(value, 0, 1);
      return t * t * (3 - 2 * t);
    };
    const noiseAt = (x, y, seed = 0) => {
      const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
      return value - Math.floor(value);
    };

    const buildRegistryOverviewCanvas = (registry) => {
      const regions = registry?.regions ?? [];
      if (!regions.length) return null;
      const worldTileWidth = safeNumber(
        registry?.worldTiles?.width,
        Math.max(...regions.map((region) => safeNumber(region.x, 0) + safeNumber(region.width, 0)), 1),
      );
      const worldTileHeight = safeNumber(
        registry?.worldTiles?.height,
        Math.max(...regions.map((region) => safeNumber(region.y, 0) + safeNumber(region.height, 0)), 1),
      );
      const regionTileWidth = safeNumber(registry?.regionTiles?.width, 800);
      const regionTileHeight = safeNumber(registry?.regionTiles?.height, 800);
      const key = [
        'registry',
        registry.version ?? 'unknown',
        worldTileWidth,
        worldTileHeight,
        regions.map((region) => `${region.id}:${region.displayName}:${region.biomeId}:${region.x}:${region.y}`).join('|'),
      ].join(':');
      if (mapOverviewCacheRef.current.registryKey === key && mapOverviewCacheRef.current.registryCanvas) {
        return mapOverviewCacheRef.current.registryCanvas;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(worldTileWidth / WORLD_MAP_REGISTRY_TILE_SCALE));
      canvas.height = Math.max(1, Math.ceil(worldTileHeight / WORLD_MAP_REGISTRY_TILE_SCALE));
      canvas.tileScale = WORLD_MAP_REGISTRY_TILE_SCALE;
      const context = canvas.getContext('2d');
      if (!context) return null;

      const regionByCell = new globalThis.Map();
      regions.forEach((region) => {
        const cellX = Math.floor(safeNumber(region.x, 0) / Math.max(1, regionTileWidth));
        const cellY = Math.floor(safeNumber(region.y, 0) / Math.max(1, regionTileHeight));
        regionByCell.set(`${cellX}:${cellY}`, region);
      });
      const gridWidth = Math.max(1, Math.ceil(worldTileWidth / Math.max(1, regionTileWidth)));
      const gridHeight = Math.max(1, Math.ceil(worldTileHeight / Math.max(1, regionTileHeight)));
      const colorByRegionId = new globalThis.Map();
      const getRegionColor = (region) => {
        const id = region?.id ?? region?.biomeId ?? 'fallback';
        if (colorByRegionId.has(id)) return colorByRegionId.get(id);
        const color = parseMapColor(WORLD_MAP_BIOME_COLORS[region?.biomeId] ?? WORLD_MAP_FALLBACK_COLOR);
        colorByRegionId.set(id, color);
        return color;
      };
      const getRegionAtCell = (cellX, cellY) => {
        const x = clamp(cellX, 0, gridWidth - 1);
        const y = clamp(cellY, 0, gridHeight - 1);
        return regionByCell.get(`${x}:${y}`) ?? regions[0];
      };

      const image = context.createImageData(canvas.width, canvas.height);
      for (let y = 0; y < canvas.height; y += 1) {
        const tileY = (y + 0.5) * WORLD_MAP_REGISTRY_TILE_SCALE;
        const gridY = tileY / Math.max(1, regionTileHeight) - 0.5;
        const y0 = Math.floor(gridY);
        const yBlend = smoothStep(gridY - y0);
        for (let x = 0; x < canvas.width; x += 1) {
          const tileX = (x + 0.5) * WORLD_MAP_REGISTRY_TILE_SCALE;
          const gridX = tileX / Math.max(1, regionTileWidth) - 0.5;
          const x0 = Math.floor(gridX);
          const xBlend = smoothStep(gridX - x0);
          const c00 = getRegionColor(getRegionAtCell(x0, y0));
          const c10 = getRegionColor(getRegionAtCell(x0 + 1, y0));
          const c01 = getRegionColor(getRegionAtCell(x0, y0 + 1));
          const c11 = getRegionColor(getRegionAtCell(x0 + 1, y0 + 1));
          const top = c00.map((channel, index) => blendChannel(channel, c10[index], xBlend));
          const bottom = c01.map((channel, index) => blendChannel(channel, c11[index], xBlend));
          const color = top.map((channel, index) => blendChannel(channel, bottom[index], yBlend));
          const fineNoise = noiseAt(x, y, 3) - 0.5;
          const broadNoise = noiseAt(Math.floor(x / 8), Math.floor(y / 8), 9) - 0.5;
          const shade = 0.94 + fineNoise * 0.08 + broadNoise * 0.12;
          const index = (y * canvas.width + x) * 4;
          image.data[index] = clamp(Math.round(color[0] * shade), 0, 255);
          image.data[index + 1] = clamp(Math.round(color[1] * shade), 0, 255);
          image.data[index + 2] = clamp(Math.round(color[2] * shade), 0, 255);
          image.data[index + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      mapOverviewCacheRef.current = {
        ...mapOverviewCacheRef.current,
        registryKey: key,
        registryCanvas: canvas,
      };
      return canvas;
    };

    const normalizeOverviewLayerName = (layer) => String(layer?.name ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const getLayerProperty = (layer, propertyName) => (
      (layer?.properties ?? []).find((property) => property.name === propertyName)?.value
    );
    const getLayerInteriorId = (layer) => normalizeInteriorId(
      getLayerProperty(layer, 'interiorId')
      ?? getLayerProperty(layer, 'caveId'),
    );
    const isCaveInteriorOverviewLayer = (layer) => [
      'caveinteriors',
      'cave_interiors',
      'cavedetails',
      'cave_details',
    ].includes(normalizeOverviewLayerName(layer));
    const isCaveRoofOverviewLayer = (layer) => [
      'caveroofs',
      'cave_roofs',
    ].includes(normalizeOverviewLayerName(layer));
    const isCaveEntranceOverviewLayer = (layer) => [
      'caveentrances',
      'cave_entrances',
    ].includes(normalizeOverviewLayerName(layer));
    const isOverviewCollisionLayer = (layer) => normalizeOverviewLayerName(layer).includes('collision');
    const shouldDrawOverviewLayer = (layer, activeInteriorId = null) => {
      if (layer.type !== 'tilelayer' || layer.visible === false || !hasTileData(layer) || isOverviewCollisionLayer(layer)) {
        return false;
      }
      const layerInteriorId = getLayerInteriorId(layer);
      if (isCaveInteriorOverviewLayer(layer)) {
        return Boolean(activeInteriorId) && (!layerInteriorId || layerInteriorId === activeInteriorId);
      }
      if (isCaveRoofOverviewLayer(layer)) {
        return false;
      }
      return true;
    };
    const shouldDrawOverviewObjectLayer = (layer) => (
      layer?.type === 'objectgroup'
      && layer.visible !== false
      && overviewObjectLayerNames.has(layer.name)
    );
    const getOverviewObjectProperty = (object, propertyName) => (
      object?.props?.[propertyName]
      ?? (object?.properties ?? []).find((property) => property.name === propertyName)?.value
    );
    const getOverviewObjectAlpha = (object) => {
      const type = String(object?.type || getOverviewObjectProperty(object, 'type') || '').toLowerCase();
      if (type.includes('tree')) return 0.66;
      if (type.includes('bush')) return 0.52;
      if (type.includes('detail')) return 0.32;
      return 0.44;
    };
    const hasDynamicCaveOverviewLayers = (tiledMap) => {
      const mapHasCaveLayer = (sourceMap) => (sourceMap?.layers ?? []).some((layer) => (
        layer.type === 'tilelayer'
        && hasTileData(layer)
        && (isCaveInteriorOverviewLayer(layer) || isCaveRoofOverviewLayer(layer) || isCaveEntranceOverviewLayer(layer))
      ));
      if (tiledMap?.isRegionWorld) return tiledMap.loadedRegions.some((region) => mapHasCaveLayer(region.map));
      return mapHasCaveLayer(tiledMap?.map);
    };

    const buildMapOverviewCanvas = (tiled) => {
      const map = tiled?.map;
      if (!map || !Array.isArray(tiled?.tilesets)) return null;
      const activeOverviewInteriorId = getActiveInteriorId();
      const tilesetKey = tiled.tilesets
        .map((tileset) => `${tileset.firstgid}:${tileset.image?.currentSrc ?? tileset.image?.src ?? ''}:${tileset.image?.naturalWidth ?? 0}`)
        .join('|');
      const regionKey = tiled.isRegionWorld
        ? tiled.loadedRegions.map((region) => `${region.mapId}:${region.offsetX}:${region.offsetY}`).join('|')
        : '';
      const key = `${tiled.mapId}:${map.width}x${map.height}:${tilesetKey}:${regionKey}:interior:${activeOverviewInteriorId ?? 'outside'}`;
      if (mapOverviewCacheRef.current.key === key && mapOverviewCacheRef.current.canvas) {
        return mapOverviewCacheRef.current.canvas;
      }

      const overviewTileScale = tiled.isChunkWorld ? 4 : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(map.width / overviewTileScale));
      canvas.height = Math.max(1, Math.ceil(map.height / overviewTileScale));
      canvas.tileScale = overviewTileScale;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.imageSmoothingEnabled = false;
      context.fillStyle = '#20362f';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 1;
      sampleCanvas.height = 1;
      const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
      const colorCache = new globalThis.Map();
      const getTileColor = (gid, layerName, tilesets) => {
        if (!gid) return null;
        const cacheKey = `${layerName}:${gid}`;
        if (colorCache.has(cacheKey)) return colorCache.get(cacheKey);
        const tileset = getTilesetForGid(tilesets, gid);
        let color = layerName === 'Ground'
          ? (gid >= 1300 ? '#7d6b58' : '#89945e')
          : '#6f7f69';
        if (tileset?.image && tileset.image.complete && tileset.image.naturalWidth && sampleContext) {
          const localId = gid - tileset.firstgid;
          const sourceX = (localId % tileset.columns) * tileset.tilewidth;
          const sourceY = Math.floor(localId / tileset.columns) * tileset.tileheight;
          try {
            sampleContext.clearRect(0, 0, 1, 1);
            sampleContext.drawImage(
              tileset.image,
              sourceX,
              sourceY,
              tileset.tilewidth,
              tileset.tileheight,
              0,
              0,
              1,
              1,
            );
            const [red, green, blue, alpha] = sampleContext.getImageData(0, 0, 1, 1).data;
            if (alpha > 12) color = `rgb(${red}, ${green}, ${blue})`;
          } catch {
            // If sampling fails, keep the stable terrain fallback color.
          }
        }
        colorCache.set(cacheKey, color);
        return color;
      };

      const drawOverviewMap = (sourceMap, tilesets, offsetTileX = 0, offsetTileY = 0) => {
        sourceMap.layers
          .filter((layer) => shouldDrawOverviewLayer(layer, activeOverviewInteriorId))
          .forEach((layer) => {
            for (let row = 0; row < sourceMap.height; row += overviewTileScale) {
              for (let col = 0; col < sourceMap.width; col += overviewTileScale) {
                const gid = layer.data[row * layer.width + col];
                const color = getTileColor(gid, layer.name, tilesets);
                if (!color) continue;
                context.fillStyle = color;
                context.fillRect(
                  Math.floor((offsetTileX + col) / overviewTileScale),
                  Math.floor((offsetTileY + row) / overviewTileScale),
                  1,
                  1,
                );
              }
            }
          });

        sourceMap.layers
          .filter(shouldDrawOverviewObjectLayer)
          .forEach((layer) => {
            const tileWidth = safeNumber(sourceMap.tilewidth, WORLD.tile);
            const tileHeight = safeNumber(sourceMap.tileheight, WORLD.tile);
            (layer.objects ?? []).forEach((object) => {
              if (object.visible === false) return;
              const gid = safeNumber(object.gid, 0) & tiledGidMask;
              if (!gid) return;
              const color = getTileColor(gid, layer.name, tilesets);
              if (!color) return;
              const objectWidth = Math.max(1, safeNumber(object.width, tileWidth));
              const objectHeight = Math.max(1, safeNumber(object.height, tileHeight));
              const startTileX = offsetTileX + safeNumber(object.x, 0) / tileWidth;
              const endTileX = offsetTileX + (safeNumber(object.x, 0) + objectWidth) / tileWidth;
              const startTileY = offsetTileY + (safeNumber(object.y, 0) - objectHeight) / tileHeight;
              const endTileY = offsetTileY + safeNumber(object.y, 0) / tileHeight;
              const x = Math.floor(startTileX / overviewTileScale);
              const y = Math.floor(startTileY / overviewTileScale);
              const width = Math.max(1, Math.ceil(endTileX / overviewTileScale) - x);
              const height = Math.max(1, Math.ceil(endTileY / overviewTileScale) - y);

              context.save();
              context.globalAlpha = getOverviewObjectAlpha(object);
              context.fillStyle = color;
              context.fillRect(x, y, width, height);
              context.restore();
            });
          });
      };

      if (tiled.isRegionWorld) {
        tiled.loadedRegions.forEach((region) => {
          drawOverviewMap(
            region.map,
            region.tilesets,
            Math.floor(region.offsetX / region.map.tilewidth),
            Math.floor(region.offsetY / region.map.tileheight),
          );
        });
      } else {
        map.layers
          .filter((layer) => shouldDrawOverviewLayer(layer, activeOverviewInteriorId))
          .forEach((layer) => {
            for (let row = 0; row < map.height; row += overviewTileScale) {
              for (let col = 0; col < map.width; col += overviewTileScale) {
                const gid = layer.data[row * layer.width + col];
                const color = getTileColor(gid, layer.name, tiled.tilesets);
                if (!color) continue;
                context.fillStyle = color;
                context.fillRect(
                  Math.floor(col / overviewTileScale),
                  Math.floor(row / overviewTileScale),
                  1,
                  1,
                );
              }
            }
          });
      }

      mapOverviewCacheRef.current = { ...mapOverviewCacheRef.current, key, canvas };
      return canvas;
    };

    const drawMapCanvas = (canvas, view, key) => {
      const tiled = tiledWorld.current;
      if (!canvas || !tiled?.map) return;
      const now = performance.now();
      const lastDraw = mapCanvasDrawRef.current[key] ?? 0;
      if (now - lastDraw < MAP_CANVAS_REDRAW_MS) return;
      mapCanvasDrawRef.current[key] = now;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width || canvas.clientWidth || 176));
      const height = Math.max(1, Math.floor(rect.height || canvas.clientHeight || 176));
      const scale = key === 'minimap'
        ? 1
        : Math.min(window.devicePixelRatio || 1, 1.5);
      const pixelWidth = Math.floor(width * scale);
      const pixelHeight = Math.floor(height * scale);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#20362f';
      context.fillRect(0, 0, width, height);
      const activeOverviewInteriorId = getActiveInteriorId();
      const useDynamicCaveOverview = Boolean(activeOverviewInteriorId) && hasDynamicCaveOverviewLayers(tiled);
      const useStaticWorldOverview = key === 'world' && hasWorldMapOverviewImage && !useDynamicCaveOverview;
      const useRegistryOverview = key === 'world' && !useStaticWorldOverview && !useDynamicCaveOverview && isWorldV2CurrentMap && worldV2Registry;
      const overview = useStaticWorldOverview
        ? worldMapOverviewImageRef.current
        : (
          useRegistryOverview
            ? buildRegistryOverviewCanvas(worldV2Registry)
            : buildMapOverviewCanvas(tiled)
        );
      if (overview) {
        const overviewWidth = overview.naturalWidth || overview.width;
        const overviewHeight = overview.naturalHeight || overview.height;
        const overviewTileScale = useStaticWorldOverview
          ? safeNumber(worldV2Registry?.worldTiles?.width, minimapWorldWidth / registryTileSize) / Math.max(1, overviewWidth)
          : overview.tileScale ?? 1;
        const sourceTileWidth = (useStaticWorldOverview || useRegistryOverview) ? registryTileSize : tiled.map.tilewidth;
        const sourceTileHeight = (useStaticWorldOverview || useRegistryOverview) ? registryTileSize : tiled.map.tileheight;
        const sourceX = clamp(view.x / sourceTileWidth / overviewTileScale, 0, overviewWidth);
        const sourceY = clamp(view.y / sourceTileHeight / overviewTileScale, 0, overviewHeight);
        const sourceWidth = clamp(view.width / sourceTileWidth / overviewTileScale, 1, overviewWidth - sourceX);
        const sourceHeight = clamp(view.height / sourceTileHeight / overviewTileScale, 1, overviewHeight - sourceY);
        context.imageSmoothingEnabled = Boolean(useStaticWorldOverview || useRegistryOverview);
        context.drawImage(
          overview,
          Math.floor(sourceX),
          Math.floor(sourceY),
          Math.max(1, Math.ceil(sourceWidth)),
          Math.max(1, Math.ceil(sourceHeight)),
          0,
          0,
          width,
          height,
        );
      }
    };

    drawMapCanvas(minimapCanvasRef.current, minimapView, 'minimap');
    if (mapOpen) {
      drawMapCanvas(worldMapCanvasRef.current, worldMapView, 'world');
    }
  }, [
    currentMapId,
    mapOpen,
    position.x,
    position.y,
    minimapView.x,
    minimapView.y,
    minimapView.width,
    minimapView.height,
    minimapWorldWidth,
    minimapWorldHeight,
    worldMapView.x,
    worldMapView.y,
    worldMapView.width,
    worldMapView.height,
    isWorldV2CurrentMap,
    hasWorldMapOverviewImage,
    registryTileSize,
    worldV2Registry,
  ]);

  if (!character) {
    return (
      <main className="app-shell menu-shell">
        <section className="menu-stage" aria-label="Character account menu">
          {(!authReady || !authUser) && (
            <AuthGate
              authForm={authForm}
              authMode={authMode}
              authStatus={authReady ? authStatus : 'Checking session...'}
              firebaseReady={hasFirebaseConfig}
              onAuthChange={updateAuthForm}
              onAuthModeChange={setAuthMode}
              onAuthSubmit={submitAuth}
              rememberLogin={rememberLogin}
              onRememberLoginChange={updateRememberLogin}
            />
          )}
          {authReady && authUser && (
            <CharacterMenu
              characters={characters}
              onCreate={createCharacter}
              onDelete={deleteCharacter}
              onEnter={enterCharacter}
              onExitGame={exitGame}
              onLogout={logoutAuth}
              spriteLoadVersion={spriteLoadVersion}
            />
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="game-stage" aria-label="Top-down game prototype">
        <canvas ref={canvasRef} className="game-canvas" />
        {(!authReady || !authUser) && (
          <AuthGate
            authForm={authForm}
            authMode={authMode}
            authStatus={authReady ? authStatus : 'Checking session...'}
            firebaseReady={hasFirebaseConfig}
            onAuthChange={updateAuthForm}
            onAuthModeChange={setAuthMode}
            onAuthSubmit={submitAuth}
            rememberLogin={rememberLogin}
            onRememberLoginChange={updateRememberLogin}
          />
        )}
        {authReady && authUser && !character && (
          <CharacterMenu
            characters={characters}
            onCreate={createCharacter}
            onDelete={deleteCharacter}
            onEnter={enterCharacter}
            onExitGame={exitGame}
            onLogout={logoutAuth}
            spriteLoadVersion={spriteLoadVersion}
          />
        )}
        {character && (
          <div className="hud-actions">
            <button className="menu-button" type="button" onClick={() => setGameMenuOpen(true)}>
              <DoorOpen size={18} />
              <span>Menu</span>
            </button>
            <button className="inventory-button" type="button" onClick={() => setInventoryOpen((open) => !open)}>
              <Backpack size={18} />
              <span>Inventory</span>
            </button>
            <button className="talents-button" type="button" onClick={() => setTalentsOpen((open) => !open)}>
              <Sparkles size={18} />
              <span>Talents</span>
            </button>
            <button className="talents-button" type="button" onClick={() => setAbilityBookOpen((open) => !open)}>
              <BookOpen size={18} />
              <span>Abilities</span>
            </button>
            <button className="talents-button" type="button" onClick={() => setQuestLogOpen((open) => !open)}>
              <BookOpen size={18} />
              <span>Quests</span>
            </button>
            <button className="talents-button" type="button" onClick={() => setProfessionPanelOpen((open) => !open)}>
              <Hammer size={18} />
              <span>Professions</span>
            </button>
            <button className="talents-button" type="button" onClick={() => setSettingsOpen((open) => !open)}>
              <Settings size={18} />
              <span>Settings</span>
            </button>
          </div>
        )}
        <div className="hud top-right">
          <MapIcon size={18} />
          <span>
            {Math.round(position.x)}, {Math.round(position.y)} | {gold}g
          </span>
        </div>
        {character && (
          <div
            className="minimap-panel"
            onClick={() => {
              focusWorldMapOnPlayer();
              setMapOpen(true);
            }}
            role="button"
            tabIndex={0}
          >
            <div className="minimap-grid">
              <canvas ref={minimapCanvasRef} className="map-render-canvas" />
              {minimapZones.map((zone) => (
                <span
                  className="minimap-zone"
                  key={zone.id ?? zone.name}
                  style={{
                    '--zone-color': WORLD_MAP_BIOME_COLORS[getZoneBiomeId(zone)] ?? '#8be9fd',
                    left: `${minimapPercent(zone, 'x')}%`,
                    top: `${minimapPercent(zone, 'y')}%`,
                    width: `${clamp((zone.width / minimapView.width) * 100, 2, 100)}%`,
                    height: `${clamp((zone.height / minimapView.height) * 100, 2, 100)}%`,
                  }}
                  title={zone.label}
                />
              ))}
              {minimapEnemies.map((enemy) => (
                <span
                  className={`minimap-dot enemy ${enemy.type?.includes('boss') ? 'boss' : ''}`}
                  key={enemy.id}
                  style={{
                    left: `${minimapPercent(enemy, 'x')}%`,
                    top: `${minimapPercent(enemy, 'y')}%`,
                  }}
                />
              ))}
              {minimapPlayers.map((remotePlayer) => (
                <span
                  className="minimap-dot player"
                  key={remotePlayer.id}
                  style={{
                    left: `${minimapPercent(remotePlayer, 'x')}%`,
                    top: `${minimapPercent(remotePlayer, 'y')}%`,
                  }}
                />
              ))}
              {waypointInMinimapView && (
                <span
                  className="minimap-dot waypoint"
                  style={{
                    left: `${minimapPercent(worldMapWaypoint, 'x')}%`,
                    top: `${minimapPercent(worldMapWaypoint, 'y')}%`,
                  }}
                />
              )}
              {minimapQuestMarkerEntries.map(({ questId, quest, marker, isMain }) => (
                <span
                  className={`minimap-quest-marker ${marker.type === 'area' ? 'area' : 'point'} ${isMain ? 'primary' : ''}`}
                  key={`minimap-quest-${questId}`}
                  style={getQuestMarkerStyle(marker, minimapPercent, minimapView)}
                  title={marker.label ?? quest.title}
                />
              ))}
              <span
                className="minimap-dot self"
                style={{
                  left: `${minimapPercent(position, 'x')}%`,
                  top: `${minimapPercent(position, 'y')}%`,
                }}
              />
            </div>
          </div>
        )}
        {selectedPlayer && (
          <div className="target-panel compact-target">
            <div>
              <strong>{selectedPlayer.name ?? 'Adventurer'}</strong>
              <span>Lv {selectedPlayer.level ?? 1}</span>
            </div>
            <div className="target-hp">
              <span style={{ width: `${selectedPlayerHpPercent}%` }} />
            </div>
            <button type="button" title="Party invite" onClick={inviteSelectedPlayer}>
              <User size={16} />
            </button>
            <button type="button" title="Add friend" onClick={addSelectedPlayerAsFriend}>
              <UserPlus size={16} />
            </button>
          </div>
        )}
        {partyInvite && (
          <div className="party-invite-panel">
            <strong>{partyInvite.fromName}</strong>
            <span>Party invite</span>
            <button type="button" onClick={acceptPartyInvite}>Accept</button>
            <button type="button" onClick={() => setPartyInvite(null)}>Decline</button>
          </div>
        )}
        {nearQuestGiver && !questDialogGiverId && (
          <div className="interact-prompt">E - Quests</div>
        )}
        {nearShopkeeper && !shopOpen && !bankOpen && !auctionOpen && !repairOpen && !professionOpen && !nearQuestGiver && (
          <div className="interact-prompt">E - {nearServiceNpc?.name ?? 'Service'}</div>
        )}
        {character && (
          <div className="level-panel">
            <strong>Level {currentLevel}</strong>
            <span>{currentLevel >= MAX_LEVEL ? 'Max level' : `${currentXp} / ${nextLevelXp} XP`}</span>
            <div className="xp-track">
              <span style={{ width: `${currentLevel >= MAX_LEVEL ? 100 : (currentXp / nextLevelXp) * 100}%` }} />
            </div>
            <span>HP {displayHp} / {currentStats.health}</span>
            <div className="hp-track">
              <span style={{ width: `${(displayHp / currentStats.health) * 100}%` }} />
            </div>
            <span>{resourceConfig.label} {displayResource} / {resourceMax}</span>
            <div className="mana-track">
              <span style={{ width: `${(displayResource / resourceMax) * 100}%` }} />
            </div>
          </div>
        )}
        {character && isAdmin && adminPlayersOpen && (
          <aside className="admin-players-panel">
            <div className="panel-heading quest-panel-heading">
              <div>
                <strong>Players</strong>
                <small>{adminPlayersStatus}</small>
              </div>
              <button className="panel-close" type="button" onClick={() => setAdminPlayersOpen(false)}>
                X
              </button>
            </div>
            <div className="admin-player-toolbar">
              <button
                className={adminPlayersView === 'online' ? 'selected' : ''}
                type="button"
                onClick={() => {
                  setAdminPlayersView('online');
                  requestAdminOnlinePlayers();
                }}
              >
                Online
              </button>
              <button
                className={adminPlayersView === 'accounts' ? 'selected' : ''}
                type="button"
                onClick={() => {
                  setAdminPlayersView('accounts');
                  loadAdminCloudCharacters();
                }}
              >
                Accounts
              </button>
              <button type="button" onClick={() => { loadAdminCloudCharacters(); requestAdminOnlinePlayers(); }}>
                Refresh
              </button>
            </div>
            {adminPlayersView === 'online' ? (
              <div className="admin-player-list">
                {adminOnlinePlayers.length === 0 ? (
                  <p className="quest-empty">No online players.</p>
                ) : adminOnlinePlayers.map((onlinePlayer) => (
                  <article className="admin-player-row" key={onlinePlayer.id}>
                    <div>
                      <strong>{onlinePlayer.name}</strong>
                      <span>{onlinePlayer.email || 'No account email'}</span>
                      <small>Level {onlinePlayer.level} | {onlinePlayer.mapId} | {Math.round(onlinePlayer.x)}, {Math.round(onlinePlayer.y)}</small>
                    </div>
                    <button
                      type="button"
                      disabled={onlinePlayer.id === colyseusSessionIdRef.current}
                      onClick={() => adminTeleportToPlayer(onlinePlayer.id)}
                    >
                      Teleport
                    </button>
                    <button
                      type="button"
                      disabled={onlinePlayer.id === colyseusSessionIdRef.current}
                      onClick={() => adminSummonPlayer(onlinePlayer.id)}
                    >
                      Bring Here
                    </button>
                    <button type="button" onClick={() => adminLevelUpOnlinePlayer(onlinePlayer)}>
                      Level Up
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="admin-player-list">
                {adminAccountGroups.length === 0 ? (
                  <p className="quest-empty">No cloud characters found.</p>
                ) : adminAccountGroups.map((account) => (
                  <article className="admin-account-row" key={account.key}>
                    <div className="admin-account-heading">
                      <div>
                        <strong>{account.email}</strong>
                        <span>{account.uid}</span>
                      </div>
                      {account.online ? (
                        <div className="admin-account-actions">
                          <button
                            type="button"
                            disabled={account.online.id === colyseusSessionIdRef.current}
                            onClick={() => adminTeleportToPlayer(account.online.id)}
                          >
                            Teleport Online
                          </button>
                          <button
                            type="button"
                            disabled={account.online.id === colyseusSessionIdRef.current}
                            onClick={() => adminSummonPlayer(account.online.id)}
                          >
                            Bring Here
                          </button>
                          <button type="button" onClick={() => adminLevelUpOnlinePlayer(account.online)}>
                            Level Up Online
                          </button>
                        </div>
                      ) : (
                        <small>Offline</small>
                      )}
                    </div>
                    <div className="admin-character-grid">
                      {account.characters.map((cloudCharacter) => (
                        <div className="admin-character-chip" key={`${account.key}:${cloudCharacter.id}`}>
                          <strong>{cloudCharacter.name}</strong>
                          <span>{cloudCharacter.raceId} {cloudCharacter.classId}</span>
                          <small>Level {cloudCharacter.level ?? 1}</small>
                          {cloudCharacter.id === character?.id && (
                            <button type="button" onClick={() => adminLevelUpCharacter(cloudCharacter)}>
                              Level Up
                            </button>
                          )}
                        </div>
                      ))}
                      {account.characters.length === 0 && (
                        <div className="admin-character-chip empty">
                          <strong>Online account</strong>
                          <span>No saved character yet</span>
                          <small>{account.online?.name ?? 'Online'}</small>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
        )}
        {questLogEntries.length > 0 && !inventoryOpen && (
          <aside className="quest-tracker" aria-label="Active quests">
            {questLogEntries.map((entry) => (
              <button
                className={`quest-tracker-item ${entry.questId === mainQuestId ? 'active' : ''} ${entry.activeQuest.status === 'ready' ? 'ready' : ''}`}
                key={entry.questId}
                type="button"
                onClick={() => {
                  setMainQuest(entry.questId);
                  setQuestLogOpen(true);
                }}
              >
                <strong>{entry.quest.title}</strong>
                <span>{getQuestProgressText(entry.activeQuest, entry.quest)}</span>
              </button>
            ))}
          </aside>
        )}
        {partyMembers.length > 1 && (
          <div className="party-list">
            <div className="party-list-heading">
              <span>Party</span>
              <button type="button" title="Leave party" onClick={leaveParty}>
                <LogOut size={15} />
              </button>
            </div>
            {partyMembers.map((member) => {
              const memberClass = CLASSES[member.classId] ?? CLASSES.warrior;
              const MemberIcon = memberClass.icon;
              const hpPercent = (clamp(member.hp, 0, member.maxHp) / Math.max(1, member.maxHp)) * 100;
              const canKick = isLocalPartyLeader && !member.isSelf;
              const phaseLabel = member.isOutOfPhase
                ? member.mapId === 'dungeon_01' ? 'Dungeon instance' : 'Different zone'
                : null;

              return (
                <div
                  className={`party-member ${member.isSelf ? 'self' : ''} ${member.isOutOfPhase ? 'out-of-phase' : ''} ${selectedPlayerId === member.id ? 'selected' : ''}`}
                  key={member.id}
                  onClick={() => targetPartyMember(member)}
                  role={member.isSelf ? undefined : 'button'}
                  tabIndex={member.isSelf ? undefined : 0}
                  onKeyDown={(event) => {
                    if (member.isSelf || (event.key !== 'Enter' && event.key !== ' ')) return;
                    event.preventDefault();
                    targetPartyMember(member);
                  }}
                >
                  <span className={`party-icon ${member.classId}`}>
                    <MemberIcon size={16} />
                    {member.isLeader && (
                      <span className="party-leader-badge" title="Party leader">
                        <Crown size={11} />
                      </span>
                    )}
                  </span>
                  <div className="party-member-copy">
                    <strong>{member.name}</strong>
                    <span>Lv {member.level}{member.isSelf ? ' | You' : phaseLabel ? ` | ${phaseLabel}` : ''}</span>
                  </div>
                  {canKick && (
                    <button
                      className="party-kick-button"
                      type="button"
                      title="Kick from party"
                      onClick={(event) => {
                        event.stopPropagation();
                        kickPartyMember(member.id);
                      }}
                    >
                      <UserMinus size={14} />
                    </button>
                  )}
                  <div className="party-member-hp">
                    <span style={{ width: `${hpPercent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {character && isDead && (
          <div className="death-screen">
            <strong>You died</strong>
            <button type="button" onClick={respawnPlayer}>Respawn</button>
          </div>
        )}
        {character && gameMenuOpen && (
          <aside className="game-menu-panel">
            <div className="panel-heading">
              <strong>Menu</strong>
              <span>Esc</span>
            </div>
            <button type="button" onClick={() => setGameMenuOpen(false)}>Resume</button>
            {isAdmin && (
              <section className="game-menu-admin-section" aria-label="Admin Panel">
                <div className="game-menu-admin-heading">
                  <Monitor size={14} />
                  <strong>Admin Panel</strong>
                </div>
                <div className="admin-panel-actions">
                  <button type="button" onClick={adminSetMaxLevel}>Max Level</button>
                  <button type="button" onClick={openAdminPlayers}>Players</button>
                </div>
                <section className="admin-time-section" aria-label="World Time">
                  <div className="admin-time-title">World Time</div>
                  <div className="admin-time-readout">
                    <span>Time <strong>{dayNightDebugState.time}</strong></span>
                    <span>Phase <strong>{dayNightPhaseLabel}</strong></span>
                    <span>Speed <strong>{dayNightSpeedMultiplier}x</strong></span>
                    <span>Mode <strong>{dayNightModeLabel}</strong></span>
                  </div>
                  <div className="admin-time-buttons">
                    {DAY_NIGHT_PHASES.map((phase) => {
                      const selected = phase === 'auto'
                        ? !dayNightForcedPhase
                        : dayNightForcedPhase === phase;
                      return (
                        <button
                          className={selected ? 'selected' : ''}
                          key={phase}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setAdminWorldTimePhase(phase)}
                        >
                          {phase}
                        </button>
                      );
                    })}
                  </div>
                  <div className="admin-time-buttons speed">
                    {DAY_NIGHT_SPEEDS.map((speed) => {
                      const selected = Math.abs(dayNightSpeedMultiplier - speed) < 0.001;
                      return (
                        <button
                          className={selected ? 'selected' : ''}
                          key={speed}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setAdminWorldTimeSpeed(speed)}
                        >
                          {speed}x
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section className="admin-time-section" aria-label="Weather">
                  <div className="admin-time-title">Weather</div>
                  <div className="admin-time-readout">
                    <span>State <strong>{weatherPhaseLabel}</strong></span>
                    <span>Next <strong>{weatherTargetLabel}</strong></span>
                    <span>Speed <strong>{weatherSpeedMultiplier}x</strong></span>
                    <span>Mode <strong>{weatherModeLabel}</strong></span>
                  </div>
                  <div className="admin-time-buttons">
                    {WEATHER_PHASES.map((weather) => {
                      const selected = weather === 'auto'
                        ? !weatherForcedPhase
                        : weatherForcedPhase === weather;
                      return (
                        <button
                          className={selected ? 'selected' : ''}
                          key={weather}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setAdminWeatherPhase(weather)}
                        >
                          {weather}
                        </button>
                      );
                    })}
                  </div>
                  <div className="admin-time-buttons speed">
                    {WEATHER_SPEEDS.map((speed) => {
                      const selected = Math.abs(weatherSpeedMultiplier - speed) < 0.001;
                      return (
                        <button
                          className={selected ? 'selected' : ''}
                          key={speed}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setAdminWeatherSpeed(speed)}
                        >
                          {speed}x
                        </button>
                      );
                    })}
                  </div>
                </section>
              </section>
            )}
            <button type="button" onClick={() => setSettingsOpen((open) => !open)}>Settings</button>
            <button type="button" onClick={saveCurrentCharacter}>Character Menu</button>
            <button className="danger-button" type="button" onClick={exitGame}>Exit Game</button>
          </aside>
        )}
        {character && inventoryOpen && (
          <aside className="inventory-panel">
            <div className="panel-heading">
              <strong>Inventory</strong>
              <span>C</span>
            </div>
            <div className="stat-grid">
              <span title={STAT_DESCRIPTIONS.health}>Health <strong>{currentStats.health}</strong></span>
              <span title={STAT_DESCRIPTIONS[resourceConfig.key] ?? STAT_DESCRIPTIONS.mana}>{resourceConfig.label} <strong>{resourceMax}</strong></span>
              <span title={STAT_DESCRIPTIONS.strength}>Strength <strong>{currentStats.strength}</strong></span>
              <span title={STAT_DESCRIPTIONS.agility}>Agility <strong>{currentStats.agility}</strong></span>
              <span title={STAT_DESCRIPTIONS.intellect}>Intellect <strong>{currentStats.intellect}</strong></span>
              <span title={STAT_DESCRIPTIONS.attackSpeed}>Attack Speed <strong>{Number(currentStats.attackSpeed ?? 1).toFixed(2)}x</strong></span>
            </div>
            <div className="inventory-tabs">
              <button className={inventoryTab === 'gear' ? 'selected' : ''} type="button" onClick={() => setInventoryTab('gear')}>Gear</button>
              <button className={inventoryTab === 'potions' ? 'selected' : ''} type="button" onClick={() => setInventoryTab('potions')}>Potions</button>
            </div>
            {inventoryTab === 'gear' ? (
              <>
                <p className="inventory-label">Equipment</p>
                <div className="equipment-grid">
                  {EQUIPMENT_SLOTS.map((slot) => {
                    const equippedItem = equippedItems[slot.id];
                    return (
                      <button
                        className={`equipment-slot ${equippedItem ? equippedItem.rarity.toLowerCase() : ''} ${isItemBroken(equippedItem) ? 'broken' : ''}`}
                        disabled={!equippedItem}
                        key={slot.id}
                        title={equippedItem ? formatDurability(equippedItem) : slot.label}
                        type="button"
                        onClick={() => unequipSlot(slot.id)}
                      >
                        <span>{slot.label}</span>
                        <strong>{equippedItem?.name ?? 'Empty'}</strong>
                      </button>
                    );
                  })}
                </div>
                <p className="inventory-label">Bag {bagItems.length}/{INVENTORY_CAPACITY}</p>
                <div className="inventory-grid">
                  {Array.from({ length: INVENTORY_CAPACITY }).map((_, index) => {
                    const item = gearBagItems[index];
                    const tooltip = getInventoryItemTooltip(item, equippedItems, shiftHeld);
                    return (
                      <button
                        className={`inventory-cell icon-only ${item ? item.rarity.toLowerCase() : 'empty'} ${isItemBroken(item) ? 'broken' : ''} ${draggedInventoryItemId && item?.id === draggedInventoryItemId ? 'dragging' : ''}`}
                        draggable={Boolean(item)}
                        key={item?.id ?? `empty-${index}`}
                        title={tooltip}
                        type="button"
                        onDragEnd={() => setDraggedInventoryItemId(null)}
                        onDragOver={(event) => {
                          if (!draggedInventoryItemId) return;
                          event.preventDefault();
                        }}
                        onDragStart={(event) => {
                          if (!item) return;
                          setDraggedInventoryItemId(item.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', item.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const draggedId = event.dataTransfer.getData('text/plain') || draggedInventoryItemId;
                          if (!draggedId) return;
                          reorderBagItem(draggedId, index);
                          setDraggedInventoryItemId(null);
                        }}
                        onBlur={() => item && setHoveredInventoryItemId((currentId) => (currentId === item.id ? null : currentId))}
                        onClick={() => item && useInventoryItem(item)}
                        onFocus={() => item && setHoveredInventoryItemId(item.id)}
                        onMouseEnter={() => item && setHoveredInventoryItemId(item.id)}
                        onMouseLeave={() => item && setHoveredInventoryItemId((currentId) => (currentId === item.id ? null : currentId))}
                      >
                        {item ? (
                          <>
                            <span className="item-icon">{getItemIconLabel(item)}</span>
                            <em>{getItemComparison(item, equippedItems).startsWith('+') ? '+' : ''}</em>
                          </>
                        ) : (
                          <span className="item-icon empty" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p className="inventory-label">Main Potion</p>
                <div className="potion-slot">
                  <strong>{selectedPotion?.name ?? 'No potion selected'}</strong>
                  <span>{selectedPotion ? `Q ${potionCooldownRemaining > 0 ? `${potionCooldownRemaining}s` : 'Ready'} | x${getItemQuantity(selectedPotion)}` : 'Choose a potion below'}</span>
                </div>
                <p className="inventory-label">Consumables</p>
                <div className="loot-list">
                  {potionBagItems.length === 0 ? (
                    <p>No potions in bag.</p>
                  ) : potionBagItems.map((item) => (
                    <button
                      className={`loot-item ${item.rarity.toLowerCase()} ${selectedPotion?.id === item.id ? 'selected' : ''}`}
                      key={item.id}
                      title={getInventoryItemTooltip(item, equippedItems, shiftHeld)}
                      type="button"
                      onClick={() => selectMainPotion(item.id)}
                    >
                      <strong>{item.name}</strong>
                      <span>x{getItemQuantity(item)} | {selectedPotion?.id === item.id ? 'Main potion' : 'Set as main'}</span>
                      <small>{item.healAmount ? `Heals ${item.healAmount}` : item.manaAmount ? `Restores ${item.manaAmount} mana` : item.description}</small>
                    </button>
                  ))}
                </div>
              </>
            )}
            <button className="wide-panel-button" type="button" onClick={resetDungeonInstances}>
              <DoorOpen size={16} />
              <span>Reset Dungeon</span>
            </button>
            <button
              className={`inventory-destroy-zone ${draggedInventoryItemId ? 'active' : ''}`}
              type="button"
              onClick={() => draggedInventoryItemId && requestDestroyItem(draggedInventoryItemId)}
              onDragOver={(event) => {
                if (!draggedInventoryItemId) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const draggedId = event.dataTransfer.getData('text/plain') || draggedInventoryItemId;
                requestDestroyItem(draggedId);
                setDraggedInventoryItemId(null);
              }}
            >
              <Trash2 size={16} />
              <span>Destroy</span>
            </button>
          </aside>
        )}
        {destroyConfirmItem && (
          <div className="destroy-confirm">
            <strong>Destroy {destroyConfirmItem.name}?</strong>
            <div>
              <button className="danger-button" type="button" onClick={confirmDestroyItem}>Yes</button>
              <button type="button" onClick={() => setDestroyConfirmItemId(null)}>No</button>
            </div>
          </div>
        )}
        {character && dungeonConfirmOpen && (
          <div className="dungeon-confirm">
            <strong>Enter dungeon?</strong>
            <div>
              <button className="confirm-button" type="button" onClick={confirmDungeonEntry}>Yes</button>
              <button type="button" onClick={cancelDungeonEntry}>No</button>
            </div>
          </div>
        )}
        {inventoryOpen && hoveredInventoryItem && shiftHeld && (
          <div className="item-compare-tooltip">
            <div className="item-compare-heading">
              <strong>{hoveredInventoryItem.name}</strong>
              <span>{hoveredInventoryItem.type === 'usable' ? 'Usable' : isPotionItem(hoveredInventoryItem) ? 'Potion' : EQUIPMENT_SLOTS.find((slot) => slot.id === hoveredInventoryItem.slot)?.label ?? hoveredInventoryItem.slot}</span>
            </div>
            <small>{hoveredInventoryItem.type === 'usable' || isPotionItem(hoveredInventoryItem) ? hoveredInventoryItem.description : `${formatItemStats(hoveredInventoryItem.stats)} | ${formatDurability(hoveredInventoryItem)}`}</small>
            <div className="item-compare-columns">
              <section>
                <strong>+ Stats</strong>
                {hoveredItemDiffs.positive.length ? (
                  hoveredItemDiffs.positive.map((entry) => (
                    <span className="gain" key={`gain-${entry.key}`}>{entry.value} {entry.label}</span>
                  ))
                ) : (
                  <span>None</span>
                )}
              </section>
              <section>
                <strong>- Stats</strong>
                {hoveredItemDiffs.negative.length ? (
                  hoveredItemDiffs.negative.map((entry) => (
                    <span className="loss" key={`loss-${entry.key}`}>{entry.value} {entry.label}</span>
                  ))
                ) : (
                  <span>None</span>
                )}
              </section>
            </div>
          </div>
        )}
        {character && shopOpen && (
          <aside className="shop-panel">
            <div className="panel-heading">
              <strong>{activeShopkeeper?.name ?? 'Shop'}</strong>
              <span>{gold}g</span>
            </div>
            <p className="shop-copy">{activeShopType === 'alchemy' ? 'Potions and consumables.' : activeShopType === 'weaponsmith' ? 'Weapons and tools.' : activeShopType === 'armorer' ? 'Armor and field repairs.' : activeShopType === 'arcane' ? 'Caster gear and arcane goods.' : 'Buy supplies or sell unwanted loot.'}</p>
            <p className="inventory-label">Buy</p>
            <div className="loot-list">
              {activeVendorStock.map((stockEntry) => (
                <button
                  className={`loot-item ${stockEntry.item.rarity?.toLowerCase?.() ?? 'common'}`}
                  key={stockEntry.id}
                  type="button"
                  onClick={() => buyVendorItem(stockEntry)}
                >
                  <strong>{stockEntry.item.name}</strong>
                  <span>{stockEntry.item.price ?? 1}g</span>
                  <small>{isPotionItem(stockEntry.item) ? stockEntry.item.description : formatItemStats(stockEntry.item.stats)}</small>
                </button>
              ))}
            </div>
            <p className="inventory-label">Sell</p>
            <div className="loot-list">
              {sellableBagItems.length === 0 ? (
                <p>No unequipped items to sell.</p>
              ) : (
                sellableBagItems.map((item) => (
                  <button
                    className={`loot-item ${item.rarity.toLowerCase()}`}
                    key={item.id}
                    type="button"
                    onClick={() => sellItem(item.id)}
                  >
                    <strong>{item.name}</strong>
                    <span>
                      Sell for {getItemSellValue(item)}g
                    </span>
                    <small>{formatItemStats(item.stats)}</small>
                  </button>
                ))
              )}
            </div>
          </aside>
        )}
        {character && repairOpen && (
          <aside className="shop-panel service-panel">
            <div className="panel-heading">
              <strong>{activeServiceNpc?.name ?? 'Repair'}</strong>
              <span>{gold}g</span>
            </div>
            <p className="shop-copy">Repair broken or damaged equipped gear.</p>
            <button className="wide-panel-button" type="button" onClick={repairAllItems}>
              <Hammer size={16} />
              <span>Repair All ({repairCost}g)</span>
            </button>
            <div className="loot-list">
              {inventory.filter(isEquipmentItem).map((item) => (
                <div className={`loot-item ${item.rarity.toLowerCase()} ${isItemBroken(item) ? 'broken' : ''}`} key={item.id}>
                  <strong>{item.name}</strong>
                  <span>{formatDurability(item)}</span>
                  <small>{getRepairCost(item)}g repair</small>
                </div>
              ))}
            </div>
          </aside>
        )}
        {character && bankOpen && (
          <aside className="shop-panel service-panel bank-panel">
            <div className="panel-heading">
              <strong>{activeServiceNpc?.name ?? 'Bank'}</strong>
              <span>{bankItems.length}/{BANK_CAPACITY}</span>
            </div>
            <p className="inventory-label">Inventory</p>
            <div className="loot-list compact-list">
              {bagItems.filter((item) => !item.nonDestroyable).map((item) => (
                <button className={`loot-item ${item.rarity.toLowerCase()}`} key={item.id} type="button" onClick={() => depositBankItem(item.id)}>
                  <strong>{item.name}</strong>
                  <span>Deposit</span>
                  <small>{isPotionItem(item) ? `x${getItemQuantity(item)}` : formatItemStats(item.stats)}</small>
                </button>
              ))}
              {bagItems.filter((item) => !item.nonDestroyable).length === 0 && <p>No depositable items.</p>}
            </div>
            <p className="inventory-label">Bank Storage</p>
            <div className="loot-list compact-list">
              {bankItems.map((item) => (
                <button className={`loot-item ${item.rarity.toLowerCase()}`} key={item.id} type="button" onClick={() => withdrawBankItem(item.id)}>
                  <strong>{item.name}</strong>
                  <span>Withdraw</span>
                  <small>{isPotionItem(item) ? `x${getItemQuantity(item)}` : formatItemStats(item.stats)}</small>
                </button>
              ))}
              {bankItems.length === 0 && <p>Bank is empty.</p>}
            </div>
          </aside>
        )}
        {character && auctionOpen && (
          <aside className="shop-panel service-panel auction-panel">
            <div className="panel-heading">
              <strong>{activeServiceNpc?.name ?? 'Auction House'}</strong>
              <span>{gold}g</span>
            </div>
            <p className="inventory-label">Listings</p>
            <div className="loot-list compact-list">
              {auctionListings.length === 0 ? (
                <p>No auctions listed.</p>
              ) : auctionListings.map((listing) => (
                <button
                  className={`loot-item ${listing.item.rarity.toLowerCase()}`}
                  key={listing.id}
                  type="button"
                  onClick={() => (String(listing.sellerId) === String(character.id) ? cancelAuctionListing(listing.id) : buyAuctionListing(listing.id))}
                >
                  <strong>{listing.item.name}</strong>
                  <span>{listing.price}g | {String(listing.sellerId) === String(character.id) ? 'Cancel' : 'Buy'}</span>
                  <small>{listing.sellerName ?? 'Unknown seller'}</small>
                </button>
              ))}
            </div>
            <p className="inventory-label">List Item</p>
            <div className="loot-list compact-list">
              {auctionInventoryItems.length === 0 ? (
                <p>No auctionable bag items.</p>
              ) : auctionInventoryItems.map((item) => (
                <div className={`loot-item ${item.rarity.toLowerCase()}`} key={item.id}>
                  <strong>{item.name}</strong>
                  <input
                    min="1"
                    type="number"
                    value={auctionPriceByItemId[item.id] ?? (getItemSellValue(item) * 2 || 10)}
                    onChange={(event) => setAuctionPriceByItemId((current) => ({ ...current, [item.id]: event.target.value }))}
                  />
                  <button type="button" onClick={() => listAuctionItem(item.id)}>List</button>
                </div>
              ))}
            </div>
          </aside>
        )}
        {character && professionOpen && (
          <aside className="shop-panel service-panel">
            <div className="panel-heading">
              <strong>{activeServiceNpc?.name ?? 'Trainer'}</strong>
              <span>Profession</span>
            </div>
            {activeProfession ? (
              <div className="profession-card">
                <strong>{activeProfession.displayName}</strong>
                <p>{activeProfession.description}</p>
                <button
                  type="button"
                  disabled={!character.professions?.[activeProfession.id]?.learned && professionLimitReached}
                  onClick={() => learnProfession(activeProfession.id)}
                >
                  {character.professions?.[activeProfession.id]?.learned
                    ? 'Learned'
                    : professionLimitReached
                    ? 'Profession Limit Reached'
                    : 'Learn Profession'}
                </button>
              </div>
            ) : (
              <div className="loot-list">
                {PROFESSIONS.map((profession) => (
                  <button
                    className="loot-item common"
                    disabled={!character.professions?.[profession.id]?.learned && professionLimitReached}
                    key={profession.id}
                    type="button"
                    onClick={() => learnProfession(profession.id)}
                  >
                    <strong>{profession.displayName}</strong>
                    <span>{character.professions?.[profession.id]?.learned ? 'Learned' : professionLimitReached ? 'Limit Reached' : 'Learn'}</span>
                    <small>{profession.description}</small>
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
        {character && professionPanelOpen && (
          <aside className="shop-panel service-panel">
            <div className="panel-heading">
              <strong>Professions</strong>
              <span>{learnedProfessionCount} / 2</span>
            </div>
            <div className="loot-list">
              {PROFESSIONS.map((profession) => {
                const state = character.professions?.[profession.id];
                const learned = Boolean(state?.learned);
                return (
                  <div className={`loot-item ${learned ? 'uncommon' : 'common'}`} key={profession.id}>
                    <strong>{profession.displayName}</strong>
                    <span>{learned ? `Level ${state?.level ?? 1}` : 'Not learned'}</span>
                    <small>{profession.description}</small>
                    {learned && (
                      <button type="button" onClick={() => unlearnProfession(profession.id)}>
                        Unlearn
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        )}
        {character && activeQuestGiver && (
          <aside className="quest-dialog-panel">
            <div className="panel-heading quest-panel-heading">
              <div>
                <strong>{activeQuestGiver.name}</strong>
                <small>{activeQuestGiver.title}</small>
              </div>
              <button
                className="panel-close"
                type="button"
                onClick={() => {
                  questDialogGiverIdRef.current = null;
                  setQuestDialogGiverId(null);
                  setSelectedQuestDialogId(null);
                }}
              >
                X
              </button>
            </div>
            <p className="quest-dialogue">{activeQuestGiver.dialogue}</p>
            <div className="quest-dialog-body">
              <div className="quest-entry-list">
                {questDialogEntries.length === 0 ? (
                  <p className="quest-empty">No quests right now.</p>
                ) : questDialogEntries.map((entry) => (
                  <button
                    className={`quest-entry ${selectedQuestDialogEntry?.id === entry.id ? 'selected' : ''} ${entry.kind}`}
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedQuestDialogId(entry.questId)}
                  >
                    <strong>{entry.quest.title}</strong>
                    <span>{entry.kind === 'turnin' ? 'Turn in' : 'Available'}</span>
                  </button>
                ))}
              </div>
              <section className="quest-detail">
                {selectedQuestDialogQuest ? (
                  <>
                    <strong>{selectedQuestDialogQuest.title}</strong>
                    <p>{selectedQuestDialogQuest.description}</p>
                    <span>{selectedQuestDialogQuest.objectiveText}</span>
                    <small>
                      {selectedQuestDialogEntry.kind === 'turnin'
                        ? 'Ready to turn in'
                        : getQuestProgressText(selectedQuestDialogActive, selectedQuestDialogQuest)}
                    </small>
                    <em>{selectedQuestDialogQuest.xpReward ?? 0} XP reward</em>
                    <div className="quest-actions">
                      {selectedQuestDialogEntry.kind === 'turnin' ? (
                        <button type="button" onClick={() => completeQuestTurnIn(selectedQuestDialogEntry.questId)}>
                          Complete
                        </button>
                      ) : (
                        <>
                          <button type="button" onClick={() => acceptQuest(selectedQuestDialogQuest)}>
                            Accept
                          </button>
                          <button className="secondary" type="button" onClick={declineQuest}>
                            Decline
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="quest-empty">Come back after finishing your current task.</p>
                )}
              </section>
            </div>
          </aside>
        )}
        {character && questLogOpen && (
          <aside className="quest-log-panel">
            <div className="panel-heading quest-panel-heading">
              <div>
                <strong>Quest Log</strong>
                <small>K</small>
              </div>
              <button className="panel-close" type="button" onClick={() => setQuestLogOpen(false)}>
                X
              </button>
            </div>
            <div className="quest-dialog-body">
              <div className="quest-entry-list">
                {questLogEntries.length === 0 ? (
                  <p className="quest-empty">No active quests.</p>
                ) : questLogEntries.map((entry) => (
                  <button
                    className={`quest-entry ${mainQuestEntry?.id === entry.questId ? 'selected' : ''} ${entry.activeQuest.status}`}
                    key={entry.questId}
                    type="button"
                    onClick={() => setMainQuest(entry.questId)}
                  >
                    <strong>{entry.quest.title}</strong>
                    <span>{getQuestProgressText(entry.activeQuest, entry.quest)}</span>
                  </button>
                ))}
              </div>
              <section className="quest-detail">
                {selectedQuestLogEntry ? (
                  <>
                    <strong>{selectedQuestLogEntry.quest.title}</strong>
                    <p>{selectedQuestLogEntry.quest.description}</p>
                    <span>{selectedQuestLogEntry.quest.objectiveText}</span>
                    <small>{getQuestProgressText(selectedQuestLogEntry.activeQuest, selectedQuestLogEntry.quest)}</small>
                    <em>{selectedQuestLogEntry.quest.xpReward ?? 0} XP reward</em>
                    <div className="quest-actions">
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => abandonQuest(selectedQuestLogId)}
                      >
                        Abandon
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="quest-empty">Accept a quest from a quest giver.</p>
                )}
              </section>
            </div>
          </aside>
        )}
        {character && talentsOpen && (
          <aside className="talent-panel">
            <div className="panel-heading">
              <strong>Talents</strong>
              <span>{availableTalentPoints}</span>
            </div>
            {talentTree && (
              <button className="wide-panel-button" type="button" onClick={resetTalentPoints}>
                Reset points
              </button>
            )}
            {!talentTree ? (
              <p className="shop-copy">Talents for this class are not ready yet.</p>
            ) : (
              <>
                <p className="shop-copy">
                  {currentLevel >= talentTree.unlockLevel
                    ? `${availableTalentPoints} point available | ${spentTalentPoints}/${totalTalentPoints} spent`
                    : `Unlocks at level ${talentTree.unlockLevel}.`}
                </p>
                <div className="talent-tree">
                  {Object.entries(talentTree.specs).map(([specId, spec]) => {
                    const specRanks = getTalentRanks(character);
                    const specSelected = selectedTalentSpec === specId;
                    const specCollapsed = Boolean(selectedTalentSpec && !specSelected);
                    const specSpent = getSpecSpentPoints(character, specId);
                    const specNodes = getTalentNodesForSpec(character.classId, specId);
                    return (
                      <section className={`talent-branch ${specSelected ? 'selected' : ''} ${specCollapsed ? 'collapsed' : ''}`} key={specId}>
                        <button
                          className="talent-branch-header"
                          disabled={currentLevel < talentTree.unlockLevel}
                          type="button"
                          onClick={() => chooseTalentSpec(specId)}
                        >
                          <strong>{spec.name}</strong>
                          <span>
                            {spec.role}
                            {specSelected ? ' | Active' : specSpent ? ` | ${specSpent} spent` : ''}
                          </span>
                          <small>{spec.description}</small>
                        </button>
                        {specCollapsed ? (
                          <div className="talent-branch-summary">
                            <span>{specSpent} point spent in this spec.</span>
                            <small>Click the branch header to switch and edit this tree.</small>
                          </div>
                        ) : (
                          <div className="talent-node-groups">
                            {TALENT_BRANCHES.map((branch) => {
                              const branchNodes = specNodes.filter((node) => node.branch === branch.id);
                              if (!branchNodes.length) return null;
                              return (
                                <div className="talent-node-group" key={branch.id}>
                                  <strong>{branch.name}</strong>
                                  <div className="talent-node-row">
                                    {branchNodes.map((node) => {
                                      const nodeKey = getTalentNodeKey(specId, node.id);
                                      const rank = Number(specRanks[nodeKey] ?? 0);
                                      const nodeDescription = getTalentNodeDescription(character.classId, specId, node);
                                      const locked = currentLevel < talentTree.unlockLevel
                                        || selectedTalentSpec !== specId
                                        || availableTalentPoints <= 0
                                        || rank >= node.maxRank
                                        || (node.requiresSpent && getSpecSpentPoints(character, specId) < node.requiresSpent)
                                        || (node.requiresLevel && currentLevel < node.requiresLevel);
                                      return (
                                        <button
                                          className={`talent-node ${rank > 0 ? 'ranked' : ''}`}
                                          disabled={locked}
                                          key={node.id}
                                          title={nodeDescription}
                                          type="button"
                                          onClick={() => spendTalentPoint(specId, node.id)}
                                        >
                                          <strong>{node.name}</strong>
                                          <span>{rank}/{node.maxRank}</span>
                                          <small>{nodeDescription}</small>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </>
            )}
          </aside>
        )}
        {character && settingsOpen && (
          <aside className="settings-panel">
            <div className="panel-heading">
              <strong>Settings</strong>
              <span>Display</span>
            </div>
            <section className="settings-section">
              <strong>Resolution</strong>
              <div className="resolution-grid">
                {RESOLUTION_OPTIONS.map((resolution) => (
                  <button
                    className={selectedResolutionId === resolution.id ? 'selected' : ''}
                    key={resolution.id}
                    type="button"
                    onClick={() => applyResolution(resolution)}
                  >
                    {resolution.label}
                  </button>
                ))}
              </div>
            </section>
            <div className="settings-buttons">
              <button type="button" onClick={() => window.mmoLauncher?.setFullscreen?.(true) ?? document.documentElement.requestFullscreen?.()}>
                <Monitor size={16} />
                Fullscreen
              </button>
              <button type="button" onClick={() => window.mmoLauncher?.setFullscreen?.(true) ?? document.documentElement.requestFullscreen?.()}>
                <Monitor size={16} />
                Fullscreen windowed
              </button>
              <button type="button" onClick={() => window.mmoLauncher?.setFullscreen?.(false) ?? document.exitFullscreen?.()}>
                <Monitor size={16} />
                Windowed
              </button>
            </div>
          </aside>
        )}
        {character && friendsOpen && (
          <aside className="friends-panel">
            <div className="panel-heading">
              <strong>Friends</strong>
              <span>O</span>
            </div>
            <div className="friend-add-row">
              <input
                placeholder="Player name"
                value={friendNameInput}
                onChange={(event) => setFriendNameInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addFriendByName(friendNameInput);
                }}
              />
              <button type="button" onClick={() => addFriendByName(friendNameInput)}>Add</button>
            </div>
            <button className="wide-panel-button" type="button" onClick={addSelectedPlayerAsFriend}>
              <UserPlus size={16} />
              Add target
            </button>
            <div className="friends-list">
              {friends.length === 0 ? (
                <p>No friends yet.</p>
              ) : friends.map((friend) => {
                const onlineFriend = onlinePlayers.find((candidate) => (
                  normalizeName(candidate.name) === normalizeName(friend.name)
                  && candidate.id !== colyseusSessionIdRef.current
                ));
                const isOnline = Boolean(onlineFriend);
                return (
                  <div className={`friend-row ${isOnline ? 'online' : 'offline'}`} key={friend.id}>
                    <Users size={16} />
                    <strong>{friend.name}</strong>
                    <span className={`friend-status ${isOnline ? 'online' : 'offline'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                    {isOnline && (
                      <button type="button" onClick={() => inviteFriend(friend)}>Invite</button>
                    )}
                    <button type="button" onClick={() => removeFriend(friend.id)}>Remove</button>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
        {character && abilityBookOpen && (
          <aside className="ability-book-panel">
            <div className="panel-heading">
              <strong>Ability Book</strong>
              <span>P</span>
            </div>
            <p className="shop-copy">Assign abilities to the 5-slot bar while this book is open.</p>
            <div className="ability-book-list">
              {unlockedAbilities.map((ability) => (
                <div className="ability-book-row" key={getAbilityId(ability)} title={describeAbility(ability, currentStats, character)}>
                  <span
                    className={`ability-icon ${ability.type} asset`}
                    style={getAbilityIconStyle(character.classId, ability)}
                  >
                    {getAbilityIconLabel(ability)}
                  </span>
                  <div>
                    <strong>{ability.name}</strong>
                    <small>{describeAbility(ability, currentStats, character)}</small>
                  </div>
                  <div className="ability-slot-pickers">
                    {Array.from({ length: ABILITY_BAR_SLOTS }).map((_, index) => (
                      <button
                        className={abilitySlots[index] === getAbilityId(ability) ? 'selected' : ''}
                        key={index}
                        type="button"
                        onClick={() => assignAbilitySlot(index, ability)}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
        {character && mapOpen && (
          <aside className={`world-map-panel ${isFullWorldMapMode ? 'full-world-panel' : ''}`}>
            <div className="panel-heading">
              <div>
                <strong>{isFullWorldMapMode ? 'World Map' : mapZoneTitle}</strong>
                <small>{isFullWorldMapMode ? 'Full world' : 'Zone focus'}</small>
              </div>
              <div className="world-map-tools">
                {!isWorldV2CurrentMap && (
                  <button
                    type="button"
                    onClick={() => {
                      setWorldMapMode((mode) => (mode === 'world' ? 'zone' : 'world'));
                      setWorldMapZoom(1);
                      setWorldMapCenter(null);
                    }}
                  >
                    {isFullWorldMapMode ? 'Zone' : 'World'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const nextZoom = clamp(worldMapZoomValue / 1.25, 1, isFullWorldMapMode ? WORLD_MAP_MAX_ZOOM : 4);
                    if (nextZoom <= 1.001) setWorldMapCenter(null);
                    setWorldMapZoom(nextZoom);
                  }}
                >-</button>
                <span>{worldMapZoomValue <= 1.001 ? 'Full' : `${worldMapZoomValue.toFixed(1)}x`}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextZoom = clamp(worldMapZoomValue * 1.25, 1, isFullWorldMapMode ? WORLD_MAP_MAX_ZOOM : 4);
                    if (isFullWorldMapMode && !worldMapCenter) setWorldMapCenter({ x: position.x, y: position.y });
                    setWorldMapZoom(nextZoom);
                  }}
                >+</button>
                <button
                  type="button"
                  onClick={() => {
                    setWorldMapWaypoint(null);
                    focusWorldMapOnPlayer();
                  }}
                >Reset</button>
                <kbd>M</kbd>
              </div>
            </div>
            <div
              className={`world-map-canvas ${isFullWorldMapMode ? 'full-world' : 'zone-world'} ${isWorldMapOverviewZoom ? 'overview-world' : ''} ${worldMapDragging ? 'dragging' : ''}`}
              onClick={handleWorldMapClick}
              onContextMenu={handleWorldMapContextMenu}
              onDoubleClick={handleWorldMapDoubleClick}
              onPointerCancel={finishWorldMapDrag}
              onPointerDown={handleWorldMapPointerDown}
              onPointerMove={handleWorldMapPointerMove}
              onPointerUp={finishWorldMapDrag}
              onWheel={handleWorldMapWheel}
              role="button"
              tabIndex={0}
            >
              <canvas ref={worldMapCanvasRef} className="map-render-canvas" />
              {isWorldV2CurrentMap && worldV2Registry && !hasWorldMapOverviewImage && (
                <svg className="world-map-overlay" viewBox={worldMapViewBox} preserveAspectRatio="none" aria-hidden="true">
                  {registryLakes.map((lake) => (
                    <ellipse
                      className="world-map-lake"
                      key={lake.id}
                      cx={safeNumber(lake.x, 0)}
                      cy={safeNumber(lake.y, 0)}
                      rx={safeNumber(lake.rx, 1)}
                      ry={safeNumber(lake.ry, 1)}
                    />
                  ))}
                  {registryRivers.map((river) => (
                    <path
                      className="world-map-river"
                      d={makeRegistryPath(river.points)}
                      key={river.id}
                      strokeWidth={Math.max(5, safeNumber(river.width, 10) * 2)}
                    />
                  ))}
                  {registryRoads.map((road) => (
                    <path
                      className={`world-map-road ${road.kind ?? 'road'}`}
                      d={makeRegistryPath(road.points)}
                      key={road.id}
                      strokeWidth={Math.max(3, safeNumber(road.width, 6) * (road.kind === 'trail' ? 0.9 : 1.3))}
                    />
                  ))}
                </svg>
              )}
              {worldMapZones.map((zone) => (
                <span
                  className={`map-zone ${getZoneId(zone) === getZoneId(focusedMapZone) ? 'selected' : ''}`}
                  key={getZoneId(zone) || zone.name}
                  style={{
                    '--zone-color': WORLD_MAP_BIOME_COLORS[zone.biomeId] ?? '#8be9fd',
                    left: `${worldMapPercent(zone, 'x')}%`,
                    top: `${worldMapPercent(zone, 'y')}%`,
                    width: `${clamp((zone.width / worldMapView.width) * 100, 2, 100)}%`,
                    height: `${clamp((zone.height / worldMapView.height) * 100, 2, 100)}%`,
                  }}
                  title={zone.label}
                >
                  {zone.label}
                </span>
              ))}
              {mapLandmarks.map((landmark) => {
                const landmarkPercentX = worldMapPercent(landmark, 'x');
                const landmarkPercentY = worldMapPercent(landmark, 'y');
                const edgeClass = isWorldMapOverviewZoom && landmarkPercentX < 10
                  ? 'edge-left'
                  : isWorldMapOverviewZoom && landmarkPercentX > 90
                  ? 'edge-right'
                  : '';
                return (
                  <span
                    className={`map-landmark ${landmark.kind ?? ''} ${edgeClass}`}
                    key={landmark.id}
                    style={{
                      left: `${landmarkPercentX}%`,
                      top: `${landmarkPercentY}%`,
                    }}
                    title={landmark.displayName}
                  >
                    <span />
                    <strong>{landmark.displayName}</strong>
                  </span>
                );
              })}
              {mapEnemies.map((enemy) => (
                <span
                  className={`map-dot enemy ${enemy.type?.includes('boss') ? 'boss' : ''}`}
                  key={enemy.id}
                  style={{
                    left: `${worldMapPercent(enemy, 'x')}%`,
                    top: `${worldMapPercent(enemy, 'y')}%`,
                  }}
                />
              ))}
              {mapPlayers.map((remotePlayer) => (
                <span
                  className="map-dot player"
                  key={remotePlayer.id}
                  style={{
                    left: `${worldMapPercent(remotePlayer, 'x')}%`,
                    top: `${worldMapPercent(remotePlayer, 'y')}%`,
                  }}
                />
              ))}
              {worldMapQuestMarkerEntries.map(({ questId, quest, marker, isMain }) => (
                <span
                  className={`map-quest-marker ${marker.type === 'area' ? 'area' : 'point'} ${isMain ? 'primary' : ''}`}
                  key={`world-map-quest-${questId}`}
                  style={getQuestMarkerStyle(marker, worldMapPercent, worldMapView)}
                  title={marker.label ?? quest.title}
                >
                  {marker.type === 'area' ? marker.label : null}
                </span>
              ))}
              <span
                className="map-dot self"
                style={{
                  left: `${worldMapPercent(position, 'x')}%`,
                  top: `${worldMapPercent(position, 'y')}%`,
                }}
              />
              {waypointInCurrentMap && (
                <span
                  className="map-dot waypoint"
                  style={{
                    left: `${worldMapPercent(worldMapWaypoint, 'x')}%`,
                    top: `${worldMapPercent(worldMapWaypoint, 'y')}%`,
                  }}
                />
              )}
            </div>
            <div className="map-waypoint-readout">
              {isFullWorldMapMode
                ? `${isAdmin ? 'Double-click to teleport | ' : ''}Click to set waypoint | Drag to pan | Mouse wheel zooms at cursor`
                : `${selectedMapZoneTitle || 'Current zone'}${focusedMapZoneDescription ? ` | ${focusedMapZoneDescription}` : ''}${focusedMapZoneLevel ? ` | ${focusedMapZoneLevel}` : ''}`}
              {worldMapWaypoint && !isFullWorldMapMode
                ? ` | Waypoint ${Math.round(worldMapWaypoint.x)}, ${Math.round(worldMapWaypoint.y)} | ${waypointDistance} px`
                : ''}
            </div>
          </aside>
        )}
        {character && journalOpen && (
          <aside className="journal-panel">
            <div className="panel-heading">
              <strong>Dungeon Journal</strong>
              <span>J</span>
            </div>
            <section>
              <h3>Forgotten Grove Depths</h3>
              <p>Compact party dungeon with elite forest packs, a mini boss, and a ritual final boss.</p>
              <strong>Bosses</strong>
              <ul>
                <li>Grove Warden: heavier melee hits and focused pressure.</li>
                <li>Rift Heart: drops burning ground and fires a frontal laser.</li>
              </ul>
              <strong>Exit Rule</strong>
              <p>The exit unlocks after the final boss dies. The instance resets after everyone leaves.</p>
            </section>
          </aside>
        )}
        {resurrectionCast && (
          <div className="resurrection-cast">
            <strong>Resurrection</strong>
            <span>{resurrectionCast.targetName}</span>
          </div>
        )}
        {recallCast && (
          <div className="resurrection-cast recall-cast">
            <strong>{recallCast.itemName}</strong>
            <span>Recalling</span>
            <div className="recall-progress">
              <span />
            </div>
          </div>
        )}
        {currentClass && (
          <div className="ability-bar">
            {slottedAbilities.map((ability, index) => {
              const slot = index + 1;
              const remainingMs = Math.max(0, (cooldowns.current[slot] ?? 0) - nowForCooldowns);
              const cooldownMs = Math.max(1, ability ? getAbilityCooldownMs(ability) : 1);
              const cooldownPercent = clamp((remainingMs / cooldownMs) * 100, 0, 100);
              return (
                <div
                  className={`ability-slot ${ability ? '' : 'empty'} ${abilityBookOpen ? 'editable' : ''}`}
                  key={slot}
                  title={ability ? describeAbility(ability, currentStats, character) : 'Empty slot'}
                >
                  <kbd>{slot}</kbd>
                  {ability ? (
                    <>
                      <span
                        className={`ability-icon ${ability.type} asset`}
                        style={getAbilityIconStyle(character.classId, ability)}
                      >
                        {getAbilityIconLabel(ability)}
                      </span>
                      <small>{getAbilityManaCost(ability, character)} {resourceConfig.label.toLowerCase()}</small>
                      {remainingMs > 0 && (
                        <>
                          <span className="cooldown-sweep" style={{ height: `${cooldownPercent}%` }} />
                          <em>{(remainingMs / 1000).toFixed(1)}</em>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="empty-slot-mark" />
                  )}
                </div>
              );
            })}
            <button
              className={`ability-slot potion-hotkey ${selectedPotion ? '' : 'empty'}`}
              title={selectedPotion ? getInventoryItemTooltip(selectedPotion, equippedItems, false) : 'No main potion selected'}
              type="button"
              onClick={useSelectedPotion}
            >
              <kbd>Q</kbd>
              {selectedPotion ? (
                <>
                  <span className="ability-icon">POT</span>
                  <small>x{getItemQuantity(selectedPotion)}</small>
                  {potionCooldownRemaining > 0 && (
                    <>
                      <span className="cooldown-sweep" style={{ height: `${clamp((potionCooldownRemaining * 1000 / POTION_COOLDOWN_MS) * 100, 0, 100)}%` }} />
                      <em>{potionCooldownRemaining}</em>
                    </>
                  )}
                </>
              ) : (
                <span className="empty-slot-mark" />
              )}
            </button>
            {lastCast && <div className="cast-toast">{lastCast}</div>}
          </div>
        )}
      </section>
    </main>
  );
}
