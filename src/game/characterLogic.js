import { abilityAssetSlug, getAbilityVisualConfig, preloadAbilityVisual } from '../abilityVisuals';
import {
  clamp,
  isFiniteNumber,
  isFinitePoint,
  safeNumber,
} from './math';
import {
  ENEMY,
  MAX_LEVEL,
  ENEMY_XP,
  BOSS_SPAWN_MIN,
  BOSS_SPAWN_MAX,
  AUTO_ATTACK_BASE_COOLDOWN_MS,
  AUTO_ATTACK_MIN_COOLDOWN_MS,
  AUTO_ATTACK_MAX_COOLDOWN_MS,
  CHANNEL_MAX_DURATION_MS,
  BASE_STATS,
  RECALL_ITEM_ID,
  RECALL_ITEM,
  STARTER_HEALTH_POTION,
  ABILITY_BAR_SLOTS,
  TALENT_UNLOCK_LEVEL,
  EQUIPMENT_SLOTS,
  STAT_GROWTH,
  ABILITY_MANA_COST,
  ABILITY_COOLDOWNS,
  shouldEffectFollowCaster,
  TALENTS,
  TALENT_NODES,
  SPEC_FINAL_ABILITY_LEVEL,
  SPEC_FINAL_ABILITIES,
  BOSS_LOOT,
  CLASSES,
} from './gameData';
import { normalizeMapId } from './world';

function sanitizeEffect(effect, now = performance.now()) {
  if (!effect || !isFinitePoint(effect)) return null;
  const maxDuration = effect.type === 'channel' ? CHANNEL_MAX_DURATION_MS : 30000;
  const duration = clamp(safeNumber(effect.duration, 320), 1, maxDuration);
  const start = safeNumber(effect.start, now);
  const sanitized = {
    ...effect,
    x: safeNumber(effect.x),
    y: safeNumber(effect.y),
    start,
    duration,
    facing: safeNumber(effect.facing, 0),
    damage: effect.damage == null ? effect.damage : clamp(safeNumber(effect.damage, 0), 0, 10000),
    healing: effect.healing == null ? effect.healing : clamp(safeNumber(effect.healing, 0), 0, 10000),
    radius: effect.radius == null ? effect.radius : clamp(safeNumber(effect.radius, 96), 8, 520),
    range: effect.range == null ? effect.range : clamp(safeNumber(effect.range, 220), 8, 1600),
    width: effect.width == null ? effect.width : clamp(safeNumber(effect.width, 28), 1, 600),
    arc: effect.arc == null ? effect.arc : clamp(safeNumber(effect.arc, 1.05), 0, Math.PI * 2),
    tickRate: effect.tickRate == null ? effect.tickRate : clamp(safeNumber(effect.tickRate, 500), 80, 5000),
    segmentMs: effect.segmentMs == null ? effect.segmentMs : clamp(safeNumber(effect.segmentMs, 230), 80, 2500),
    maxTargets: effect.maxTargets == null ? effect.maxTargets : clamp(Math.floor(safeNumber(effect.maxTargets, 5)), 1, 12),
    chainRange: effect.chainRange == null ? effect.chainRange : clamp(safeNumber(effect.chainRange, 190), 32, 1200),
    nextTickAt: effect.nextTickAt == null ? effect.nextTickAt : safeNumber(effect.nextTickAt, now),
  };

  if (Array.isArray(sanitized.chainTargets)) {
    sanitized.chainTargets = sanitized.chainTargets
      .map((target) => (target && isFinitePoint(target)
        ? {
          ...target,
          id: target.id == null ? null : String(target.id),
          x: safeNumber(target.x),
          y: safeNumber(target.y),
          radius: clamp(safeNumber(target.radius, ENEMY.radius), 6, 180),
        }
        : null))
      .filter((target) => target?.id)
      .filter(Boolean);
  }

  if (Array.isArray(sanitized.hitTargetIds)) {
    sanitized.hitTargetIds = sanitized.hitTargetIds
      .filter((id) => id != null)
      .map((id) => String(id));
  } else {
    sanitized.hitTargetIds = [];
  }

  if (sanitized.targetEnemyId != null) {
    sanitized.targetEnemyId = String(sanitized.targetEnemyId);
  }
  if (sanitized.targetPlayerId != null) {
    sanitized.targetPlayerId = String(sanitized.targetPlayerId);
  }

  if (!Number.isFinite(sanitized.start) || !Number.isFinite(sanitized.duration)) {
    return null;
  }

  return sanitized;
}

function abilityNetworkPayload(ability, { includeChainTargets = false } = {}) {
  if (!ability) return null;
  const payload = {
    classId: ability.classId,
    visualClassId: ability.visualClassId,
    visual: ability.visual,
    key: ability.key,
    name: ability.name,
    type: ability.type,
    color: ability.color,
    damage: ability.damage,
    healing: ability.healing,
    radius: ability.radius,
    range: ability.range,
    width: ability.width,
    angle: ability.angle,
    arc: ability.arc,
    projectile: ability.projectile,
    groundAtCursor: ability.groundAtCursor,
    followCaster: shouldEffectFollowCaster(ability),
    duration: ability.type === 'channel'
      ? ability.channelMaxDuration ?? CHANNEL_MAX_DURATION_MS
      : ability.duration,
    tickRate: ability.tickRate,
    segmentMs: ability.segmentMs,
    maxTargets: ability.maxTargets,
    chainRange: ability.chainRange,
    combatOnly: ability.combatOnly,
    furyGain: ability.furyGain,
    multiStrike: ability.multiStrike,
    pierce: ability.pierce,
    trapOffset: ability.trapOffset,
    slowDuration: ability.slowDuration,
    slowMultiplier: ability.slowMultiplier,
    freezeDuration: ability.freezeDuration,
    stunDuration: ability.stunDuration,
    applyCold: ability.applyCold,
    skipCold: ability.skipCold,
    bonusVsControlledMultiplier: ability.bonusVsControlledMultiplier,
    applyBurn: ability.applyBurn,
    burnDamage: ability.burnDamage,
    burnDuration: ability.burnDuration,
    burnTickRate: ability.burnTickRate,
    burnStacking: ability.burnStacking,
    damageTakenMultiplier: ability.damageTakenMultiplier,
    damageTakenDuration: ability.damageTakenDuration,
    absorb: ability.absorb,
    invulnerable: ability.invulnerable,
    invisibility: ability.invisibility,
    damageReduction: ability.damageReduction,
    regenPerSecond: ability.regenPerSecond,
    noManaCost: ability.noManaCost,
    manaRegenPerSecond: ability.manaRegenPerSecond,
    furyRegenPerSecond: ability.furyRegenPerSecond,
    attackSpeedMultiplier: ability.attackSpeedMultiplier,
    petAttackSpeedMultiplier: ability.petAttackSpeedMultiplier,
    petBleedDamage: ability.petBleedDamage,
    petBleedDuration: ability.petBleedDuration,
    burnWindow: ability.burnWindow,
    rootSelf: ability.rootSelf,
    maxHealthMultiplier: ability.maxHealthMultiplier,
    autoCombatBolt: ability.autoCombatBolt,
    autoBoltCombatOnly: ability.autoBoltCombatOnly,
    autoBoltName: ability.autoBoltName,
    autoBoltDamage: ability.autoBoltDamage,
    autoBoltInterval: ability.autoBoltInterval,
    damageMultiplier: ability.damageMultiplier,
    leechPercent: ability.leechPercent,
    selfHealPercent: ability.selfHealPercent,
    autoDamageMultiplier: ability.autoDamageMultiplier,
    strikeDamageMultiplier: ability.strikeDamageMultiplier,
    stealthDamageMultiplier: ability.stealthDamageMultiplier,
    noCooldowns: ability.noCooldowns,
    noEnergyCost: ability.noEnergyCost,
    cooldownMultiplier: ability.cooldownMultiplier,
    poisonWindow: ability.poisonWindow,
    applyPoison: ability.applyPoison,
    poisonDamage: ability.poisonDamage,
    poisonDuration: ability.poisonDuration,
    poisonTickRate: ability.poisonTickRate,
    bleedDamage: ability.bleedDamage,
    bleedTickRate: ability.bleedTickRate,
    teleportToTarget: ability.teleportToTarget,
    postDamageMultiplier: ability.postDamageMultiplier,
    postDamageDuration: ability.postDamageDuration,
    manaCost: ability.manaCost,
    furyCost: ability.furyCost,
    energyCost: ability.energyCost,
    autoAttack: ability.autoAttack,
    targetPlayerId: ability.targetPlayerId,
  };

  if (includeChainTargets && Array.isArray(ability.chainTargets)) {
    payload.chainTargets = ability.chainTargets
      .map((target) => (target && isFinitePoint(target)
        ? {
          id: String(target.id),
          x: safeNumber(target.x),
          y: safeNumber(target.y),
          radius: safeNumber(target.radius, ENEMY.radius),
        }
        : null))
      .filter(Boolean);
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

function attachAbilityVisual(ability, classId) {
  if (!ability) return ability;
  const visualClassId = ability.visualClassId ?? ability.classId ?? classId;
  const visual = ability.visual ?? getAbilityVisualConfig(visualClassId, ability);
  preloadAbilityVisual(visual);
  return {
    ...ability,
    classId: visualClassId,
    visualClassId,
    visual,
  };
}

function sanitizeEnemy(enemy) {
  if (!enemy || !isFinitePoint(enemy)) return null;
  const radius = clamp(enemy.radius ?? ENEMY.radius, 6, 180);
  const maxHp = Math.max(1, safeNumber(enemy.maxHp, enemy.type === 'boss' ? 620 : 100));
  const hp = clamp(enemy.hp ?? maxHp, 0, maxHp);

  return {
    ...enemy,
    id: String(enemy.id ?? `enemy-${safeNumber(enemy.x)}-${safeNumber(enemy.y)}`),
    x: safeNumber(enemy.x),
    y: safeNumber(enemy.y),
    targetX: isFiniteNumber(enemy.targetX) ? safeNumber(enemy.targetX) : safeNumber(enemy.x),
    targetY: isFiniteNumber(enemy.targetY) ? safeNumber(enemy.targetY) : safeNumber(enemy.y),
    radius,
    hp,
    maxHp,
    facing: safeNumber(enemy.facing, 0),
    speed: safeNumber(enemy.speed, ENEMY.speed),
    xp: safeNumber(enemy.xp, ENEMY_XP),
    hitAt: safeNumber(enemy.hitAt, 0),
    wobble: safeNumber(enemy.wobble, 0),
  };
}

function sanitizeWorldPlayer(worldPlayer) {
  if (!worldPlayer || !isFinitePoint(worldPlayer)) return null;
  const maxHp = Math.max(1, safeNumber(worldPlayer.maxHp, 100));

  return {
    ...worldPlayer,
    id: String(worldPlayer.id ?? ''),
    name: worldPlayer.name ?? 'Adventurer',
    classId: worldPlayer.classId ?? 'warrior',
    raceId: worldPlayer.raceId ?? 'human',
    appearance: worldPlayer.appearance ?? {},
    talents: worldPlayer.talents ?? { spec: null },
    level: Math.max(1, Math.floor(safeNumber(worldPlayer.level, 1))),
    x: safeNumber(worldPlayer.x),
    y: safeNumber(worldPlayer.y),
    vx: safeNumber(worldPlayer.vx, 0),
    vy: safeNumber(worldPlayer.vy, 0),
    facing: safeNumber(worldPlayer.facing, 0),
    hp: clamp(worldPlayer.hp ?? maxHp, 0, maxHp),
    maxHp,
    pet: worldPlayer.pet && isFinitePoint(worldPlayer.pet) ? {
      x: safeNumber(worldPlayer.pet.x),
      y: safeNumber(worldPlayer.pet.y),
      vx: safeNumber(worldPlayer.pet.vx, 0),
      vy: safeNumber(worldPlayer.pet.vy, 0),
      facing: safeNumber(worldPlayer.pet.facing, safeNumber(worldPlayer.facing, 0)),
      walk: safeNumber(worldPlayer.pet.walk, 0),
      moving: Boolean(worldPlayer.pet.moving),
      attackStartedAt: safeNumber(worldPlayer.pet.attackStartedAt, 0),
      attackUntil: safeNumber(worldPlayer.pet.attackUntil, 0),
    } : null,
  };
}

function sanitizeOnlinePlayer(worldPlayer) {
  if (!worldPlayer?.id) return null;
  const maxHp = Math.max(1, safeNumber(worldPlayer.maxHp, 1));
  return {
    ...worldPlayer,
    id: String(worldPlayer.id),
    name: worldPlayer.name ?? 'Adventurer',
    classId: worldPlayer.classId ?? 'warrior',
    talents: worldPlayer.talents ?? { spec: null },
    level: Math.max(1, Math.floor(safeNumber(worldPlayer.level, 1))),
    hp: Math.ceil(clamp(worldPlayer.hp ?? maxHp, 0, maxHp)),
    maxHp: Math.ceil(maxHp),
    mapId: normalizeMapId(worldPlayer.mapId),
    instanceId: worldPlayer.instanceId ?? null,
    partyId: worldPlayer.partyId ?? null,
    partyLeaderId: worldPlayer.partyLeaderId ?? null,
  };
}

function samePartyMembers(current, next) {
  if (current.length !== next.length) return false;
  return current.every((member, index) => {
    const candidate = next[index];
    return (
      member.id === candidate.id
      && member.name === candidate.name
      && member.classId === candidate.classId
      && member.talents?.spec === candidate.talents?.spec
      && member.level === candidate.level
      && member.hp === candidate.hp
      && member.maxHp === candidate.maxHp
      && member.mapId === candidate.mapId
      && member.instanceId === candidate.instanceId
      && member.isOutOfPhase === candidate.isOutOfPhase
      && member.isSelf === candidate.isSelf
      && member.isLeader === candidate.isLeader
    );
  });
}

function sameOnlinePlayers(current, next) {
  if (current.length !== next.length) return false;
  return current.every((player, index) => {
    const candidate = next[index];
    return (
      player.id === candidate.id
      && player.name === candidate.name
      && player.classId === candidate.classId
      && player.talents?.spec === candidate.talents?.spec
      && player.level === candidate.level
      && player.hp === candidate.hp
      && player.maxHp === candidate.maxHp
      && player.mapId === candidate.mapId
      && player.instanceId === candidate.instanceId
      && player.partyId === candidate.partyId
      && player.partyLeaderId === candidate.partyLeaderId
    );
  });
}

function distance(a, b) {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getMovementStateFromDisplacement(previous, current, deltaSeconds, fallbackFacing = 0) {
  const delta = Math.max(0.001, safeNumber(deltaSeconds, 0.001));
  const moveX = safeNumber(current?.x) - safeNumber(previous?.x);
  const moveY = safeNumber(current?.y) - safeNumber(previous?.y);
  const moved = Math.hypot(moveX, moveY) > 0.001;
  return {
    vx: moved ? moveX / delta : 0,
    vy: moved ? moveY / delta : 0,
    facing: moved ? Math.atan2(moveY, moveX) : safeNumber(fallbackFacing, 0),
    moved,
  };
}

function distanceToSegment(point, start, end) {
  if (!isFinitePoint(point) || !isFinitePoint(start) || !isFinitePoint(end)) return Number.POSITIVE_INFINITY;
  const lineX = end.x - start.x;
  const lineY = end.y - start.y;
  const lengthSquared = lineX * lineX + lineY * lineY || 1;
  const t = clamp(((point.x - start.x) * lineX + (point.y - start.y) * lineY) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + lineX * t), point.y - (start.y + lineY * t));
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function lerpAngle(current, target, amount) {
  return current + angleDifference(target, current) * amount;
}

function xpForLevel(level) {
  return level >= MAX_LEVEL ? 0 : level * 100;
}

function getAbilityId(ability) {
  return ability ? `${ability.key}:${ability.name}` : '';
}

function resolveAbility(abilities, abilityId, fallbackKey = null) {
  if (!Array.isArray(abilities)) return null;
  const lookup = abilityId == null ? '' : String(abilityId);
  const [slotKey, ...nameParts] = lookup.split(':');
  const hasStoredKey = lookup && nameParts.length > 0 && slotKey;
  const lookupName = hasStoredKey ? nameParts.join(':') : lookup;
  const lookupSlug = lookupName ? abilityAssetSlug(lookupName) : '';
  const fallbackKeyString = fallbackKey == null ? null : String(fallbackKey);
  const storedKeyString = hasStoredKey
    ? String(slotKey)
    : (/^\d+$/.test(lookup) ? lookup : fallbackKeyString);

  return abilities.find((ability) => getAbilityId(ability) === lookup)
    ?? abilities.find((ability) => String(ability.name) === lookup)
    ?? (lookupSlug ? abilities.find((ability) => abilityAssetSlug(ability.name) === lookupSlug) : null)
    ?? (storedKeyString ? abilities.find((ability) => String(ability.key) === storedKeyString) : null)
    ?? null;
}

function getDefaultAbilitySlots(character) {
  const slots = getCharacterAbilities(character).slice(0, ABILITY_BAR_SLOTS).map(getAbilityId);
  while (slots.length < ABILITY_BAR_SLOTS) slots.push(null);
  return slots;
}

function getFinalAbilityForCharacter(character) {
  const specId = character?.talents?.spec;
  if (!character || !specId) return null;
  const finalAbility = SPEC_FINAL_ABILITIES[character.classId]?.[specId] ?? null;
  if (!finalAbility || (character.level ?? 1) < (finalAbility.level ?? SPEC_FINAL_ABILITY_LEVEL)) return null;
  return applyTalentModifiersToAbility(finalAbility, character);
}

function getTalentRanks(character) {
  return character?.talents?.ranks ?? {};
}

function getTalentNodeKey(specId, nodeId) {
  return `${specId}:${nodeId}`;
}

function getEarnedTalentPoints(character) {
  return Math.max(0, ((character?.level ?? 1) - TALENT_UNLOCK_LEVEL + 1) * 2);
}

function getSpentTalentPoints(character) {
  const ranks = getTalentRanks(character);
  const talentTree = character ? TALENTS[character.classId] : null;
  if (!talentTree) return 0;
  return Object.keys(talentTree.specs).reduce((total, specId) => (
    total + getTalentNodesForSpec(character.classId, specId)
      .reduce((specTotal, node) => specTotal + Number(ranks[getTalentNodeKey(specId, node.id)] ?? 0), 0)
  ), 0);
}

function getAvailableTalentPoints(character) {
  return Math.max(0, getEarnedTalentPoints(character) - getSpentTalentPoints(character));
}

function getClassPrimaryStat(classId) {
  if (classId === 'mage' || classId === 'priest') return 'intellect';
  if (classId === 'hunter' || classId === 'rogue') return 'agility';
  return 'strength';
}

function getSpecAbilityList(classId, specId) {
  const specAbilities = TALENTS[classId]?.specs?.[specId]?.abilities ?? [];
  const finalAbility = SPEC_FINAL_ABILITIES[classId]?.[specId] ?? null;
  return finalAbility ? [...specAbilities, finalAbility] : specAbilities;
}

function getTalentNodesForSpec(classId, specId) {
  const abilities = getSpecAbilityList(classId, specId);
  return TALENT_NODES.map((node) => ({
    ...node,
    ability: node.abilityKey
      ? abilities.find((ability) => String(ability.key) === String(node.abilityKey)) ?? null
      : null,
  }));
}

function getSpecSpentPoints(character, specId) {
  const ranks = getTalentRanks(character);
  return getTalentNodesForSpec(character?.classId, specId)
    .reduce((total, node) => total + Number(ranks[getTalentNodeKey(specId, node.id)] ?? 0), 0);
}

function getTalentNodeStatBonuses(classId, node, rank) {
  if (!rank) return {};
  if (node.id === 'core') {
    return {
      [getClassPrimaryStat(classId)]: rank * 2,
      health: rank * 8,
    };
  }
  if (node.id === 'flow') {
    return {
      mana: classId === 'warrior' || classId === 'rogue' ? 0 : rank * 8,
      attackSpeed: rank * 0.035,
    };
  }
  return {};
}

function getTalentStatBonuses(character) {
  const selectedSpec = character?.talents?.spec;
  if (!selectedSpec) return {};
  const ranks = getTalentRanks(character);
  const classId = character?.classId;
  const bonuses = {};
  getTalentNodesForSpec(classId, selectedSpec).forEach((node) => {
    const rank = Number(ranks[getTalentNodeKey(selectedSpec, node.id)] ?? 0);
    const nodeBonuses = getTalentNodeStatBonuses(classId, node, rank);
    Object.entries(nodeBonuses).forEach(([key, value]) => {
      bonuses[key] = (bonuses[key] ?? 0) + value;
    });
  });
  return bonuses;
}

function getAbilityTalentModifiers(character, ability) {
  const selectedSpec = character?.talents?.spec;
  if (!selectedSpec || !ability) return null;
  const ranks = getTalentRanks(character);
  const modifiers = {
    damageBonus: 0,
    healingBonus: 0,
    cooldownReduction: 0,
    durationBonus: 0,
    absorbBonus: 0,
    resourceCostReduction: 0,
  };

  getTalentNodesForSpec(character.classId, selectedSpec).forEach((node) => {
    if (!node.abilityKey || String(node.abilityKey) !== String(ability.key)) return;
    const rank = Number(ranks[getTalentNodeKey(selectedSpec, node.id)] ?? 0);
    if (!rank) return;
    modifiers.damageBonus += (node.damageBonus ?? 0) * rank;
    modifiers.healingBonus += (node.healingBonus ?? 0) * rank;
    modifiers.cooldownReduction += (node.cooldownReduction ?? 0) * rank;
    modifiers.durationBonus += (node.durationBonus ?? 0) * rank;
    modifiers.absorbBonus += (node.absorbBonus ?? 0) * rank;
    modifiers.resourceCostReduction += (node.resourceCostReduction ?? 0) * rank;
  });

  return modifiers.damageBonus
    || modifiers.healingBonus
    || modifiers.cooldownReduction
    || modifiers.durationBonus
    || modifiers.absorbBonus
    || modifiers.resourceCostReduction
    ? modifiers
    : null;
}

function scaleNumeric(value, bonus, minimum = 1) {
  if (typeof value !== 'number' || !bonus) return value;
  return Math.max(minimum, Math.round(value * (1 + bonus)));
}

function reduceNumeric(value, reduction, minimum = 0) {
  if (typeof value !== 'number' || !reduction) return value;
  return Math.max(minimum, Math.round(value * Math.max(0.1, 1 - reduction)));
}

function applyTalentModifiersToAbility(ability, character) {
  const modifiers = getAbilityTalentModifiers(character, ability);
  if (!modifiers) return ability;

  const next = { ...ability };
  next.damage = scaleNumeric(next.damage, modifiers.damageBonus);
  next.healing = scaleNumeric(next.healing, modifiers.healingBonus);
  next.cooldown = reduceNumeric(next.cooldown, modifiers.cooldownReduction, 250);
  next.duration = scaleNumeric(next.duration, modifiers.durationBonus, 250);
  next.absorb = scaleNumeric(next.absorb, modifiers.absorbBonus);
  next.manaCost = reduceNumeric(next.manaCost, modifiers.resourceCostReduction);
  next.furyCost = reduceNumeric(next.furyCost, modifiers.resourceCostReduction);
  next.energyCost = reduceNumeric(next.energyCost, modifiers.resourceCostReduction);

  if (next.spawnGroundAbility) {
    next.spawnGroundAbility = {
      ...next.spawnGroundAbility,
      damage: scaleNumeric(next.spawnGroundAbility.damage, modifiers.damageBonus),
      healing: scaleNumeric(next.spawnGroundAbility.healing, modifiers.healingBonus),
      duration: scaleNumeric(next.spawnGroundAbility.duration, modifiers.durationBonus, 250),
    };
  }

  return next;
}

function formatTalentPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function getTalentNodeDescription(classId, specId, node) {
  const ability = node.ability ?? getSpecAbilityList(classId, specId)
    .find((candidate) => String(candidate.key) === String(node.abilityKey));
  if (node.id === 'core') {
    const primary = getClassPrimaryStat(classId);
    return `Per rank: +2 ${primary}, +8 health.`;
  }
  if (node.id === 'flow') {
    const resourceText = classId === 'warrior' || classId === 'rogue'
      ? 'no mana bonus'
      : '+8 mana';
    return `Per rank: ${resourceText}, +3.5% attack speed.`;
  }

  const effects = [];
  if (node.damageBonus) effects.push(`+${formatTalentPercent(node.damageBonus)} damage`);
  if (node.healingBonus) effects.push(`+${formatTalentPercent(node.healingBonus)} healing`);
  if (node.cooldownReduction) effects.push(`-${formatTalentPercent(node.cooldownReduction)} cooldown`);
  if (node.durationBonus) effects.push(`+${formatTalentPercent(node.durationBonus)} duration`);
  if (node.absorbBonus) effects.push(`+${formatTalentPercent(node.absorbBonus)} absorb`);
  const levelText = node.requiresLevel ? ` Unlocks at level ${node.requiresLevel}.` : '';
  return `Improves: ${ability?.name ?? 'future ability'}. Per rank: ${effects.join(', ')}.${levelText}`;
}

function getUnlockedAbilities(classId, level) {
  return CLASSES[classId].abilities.filter((ability) => ability.level <= level);
}

function getCharacterAbilities(character) {
  if (!character) return [];
  const level = character.level ?? 1;
  const talentTree = TALENTS[character.classId];
  const selectedSpec = character.talents?.spec;
  const specAbilities = selectedSpec ? getSpecAbilityList(character.classId, selectedSpec) : null;

  const abilities = specAbilities && level >= (talentTree?.unlockLevel ?? TALENT_UNLOCK_LEVEL)
    ? specAbilities.filter((ability) => ability.level <= level)
    : getUnlockedAbilities(character.classId, level);
  return abilities.map((ability) => applyTalentModifiersToAbility(ability, character));
}

const WARRIOR_FURY_PER_ATTACK = 12;
const ROGUE_ENERGY_REGEN_PER_SECOND = 32;
const PARTY_INVITE_COOLDOWN_MS = 8000;

const WARRIOR_ABILITY_COSTS = {
  1: 12,
  2: 16,
  3: 20,
  4: 28,
  5: 34,
  6: 42,
};

function getAbilityManaCost(ability, character = null) {
  if (character?.classId === 'warrior') {
    const furyCost = ability.furyCost ?? WARRIOR_ABILITY_COSTS[ability.key];
    if (typeof furyCost === 'number') return furyCost;
  }
  if (character?.classId === 'rogue') {
    const energyCost = ability.energyCost ?? ability.manaCost ?? ability.resourceCost ?? ABILITY_MANA_COST[ability.key];
    if (typeof energyCost === 'number') return energyCost;
  }

  return ability.manaCost ?? ability.resourceCost ?? ABILITY_MANA_COST[ability.key] ?? 15;
}

function getAbilityCooldownMs(ability) {
  if (!ability) return 0;
  if (ability.cooldown) return ability.cooldown;
  if (ability.type === 'channel') return (ability.duration ?? 3000) + (ABILITY_COOLDOWNS.channel ?? 4800);
  return ABILITY_COOLDOWNS[ability.type] ?? 1000;
}

function getResourceConfig(character) {
  if (character?.classId === 'warrior') {
    return {
      key: 'fury',
      label: 'Fury',
      max: 100,
    };
  }
  if (character?.classId === 'rogue') {
    return {
      key: 'energy',
      label: 'Energy',
      max: 100,
    };
  }

  return {
    key: 'mana',
    label: 'Mana',
    max: getTotalStats(character).mana,
  };
}

function getCurrentResource(character, vitals = {}) {
  const resourceConfig = getResourceConfig(character);
  return Math.floor(vitals?.[resourceConfig.key] ?? 0);
}

function getResourceMax(character, stats = getTotalStats(character)) {
  return getResourceConfig({ ...character, ...stats }).max;
}

function getAutoAttackCooldownMs(character) {
  const stats = character ? getTotalStats(character) : BASE_STATS;
  const speed = Math.max(0.25, Number(stats.attackSpeed ?? 1) + Number(stats.agility ?? 0) * 0.012);
  return clamp(AUTO_ATTACK_BASE_COOLDOWN_MS / speed, AUTO_ATTACK_MIN_COOLDOWN_MS, AUTO_ATTACK_MAX_COOLDOWN_MS);
}

function getAutoAttackAbility(classId, character = null) {
  const priestSpec = classId === 'priest' ? character?.talents?.spec : null;
  if (classId === 'warrior' || classId === 'paladin' || classId === 'rogue') {
    return {
      key: 'M1',
      name: classId === 'rogue' ? 'Dagger Slice' : 'Swing',
      type: 'strike',
      color: classId === 'paladin' ? '#fde68a' : classId === 'rogue' ? '#d8b4fe' : '#d1d5db',
      damage: classId === 'paladin' ? 28 : classId === 'rogue' ? 25 : 30,
      range: 86,
      width: 44,
      duration: 420,
      autoAttack: true,
    };
  }

  if (classId === 'hunter') {
    return {
      key: 'M1',
      name: 'Auto Shot',
      type: 'shot',
      color: '#facc15',
      damage: 26,
      range: 560,
      width: 22,
      duration: 520,
      autoAttack: true,
    };
  }

  return {
    key: 'M1',
    name: classId === 'priest' && priestSpec === 'void'
      ? 'Void Spark'
      : classId === 'priest'
        ? 'Light Spark'
        : 'Wand Bolt',
    type: 'bolt',
    color: classId === 'priest' && priestSpec === 'void'
      ? '#8b5cf6'
      : classId === 'priest'
        ? '#fde68a'
        : '#8be9fd',
    damage: classId === 'priest' && priestSpec === 'void' ? 28 : 24,
    range: classId === 'mage' || classId === 'priest' ? 520 : 280,
    width: 22,
    duration: 520,
    autoAttack: true,
  };
}

function mitigateDamageWithCombatBuffs(buffs, rawDamage, now) {
  if (now < (buffs.invulnerableUntil ?? 0)) return 0;
  if (now >= (buffs.shieldUntil ?? 0)) {
    buffs.shieldAbsorb = 0;
  }
  let damage = Number(rawDamage ?? 0);
  if (now < (buffs.damageReductionUntil ?? 0)) {
    damage *= 1 - clamp(buffs.damageReduction ?? 0, 0, 0.9);
  }
  damage = Math.max(0, Math.ceil(damage));
  if ((buffs.shieldAbsorb ?? 0) > 0 && damage > 0) {
    const absorbed = Math.min(buffs.shieldAbsorb, damage);
    buffs.shieldAbsorb -= absorbed;
    damage -= absorbed;
  }
  return Math.max(0, damage);
}

function getCombatDamageMultiplier(buffs, ability, now) {
  let multiplier = 1;
  if (now < (buffs.damageFormUntil ?? 0)) multiplier *= buffs.damageMultiplier ?? 1;
  if (now < (buffs.stealthDamageUntil ?? 0)) multiplier *= buffs.stealthDamageMultiplier ?? 1;
  if (now < (buffs.autoEmpowerUntil ?? 0)) {
    if (ability?.autoAttack) multiplier *= buffs.autoDamageMultiplier ?? 1;
    if (ability?.type === 'strike' && !ability?.autoAttack) multiplier *= buffs.strikeDamageMultiplier ?? 1;
  }
  return multiplier;
}

function abilityDealsDamage(ability) {
  return Number(ability?.damage ?? 0) > 0 || Boolean(ability?.autoAttack);
}

function triggerRogueStealthDamage(buffs, ability, now) {
  if (!abilityDealsDamage(ability)) return;
  if (now >= (buffs.invisibleUntil ?? 0)) return;
  buffs.invisibleUntil = 0;
  buffs.stealthDamageUntil = Math.max(buffs.stealthDamageUntil ?? 0, now + 5000);
  buffs.stealthDamageMultiplier = buffs.stealthDamageMultiplier ?? 1.35;
}

function enrichRogueAbilityForCast(ability, character, buffs, now, options = {}) {
  if (!ability || character?.classId !== 'rogue') return ability;
  const nextAbility = { ...ability };
  if (options.consumeStealth) {
    triggerRogueStealthDamage(buffs, nextAbility, now);
  }
  if (abilityDealsDamage(nextAbility) && now < (buffs.poisonBladeUntil ?? 0)) {
    nextAbility.applyPoison = true;
    nextAbility.poisonDamage = buffs.poisonDamage ?? 9;
    nextAbility.poisonDuration = buffs.poisonDuration ?? 5000;
    nextAbility.poisonTickRate = buffs.poisonTickRate ?? 1000;
  }
  return nextAbility;
}

function isEnemyImpaired(enemy, now) {
  return now < (enemy?.coldUntil ?? 0)
    || now < (enemy?.slowUntil ?? 0)
    || now < (enemy?.frozenUntil ?? 0)
    || now < (enemy?.stunnedUntil ?? 0);
}

function getAbilityDamageAgainstEnemy(ability, baseDamage, enemy, now) {
  let damage = Number(baseDamage ?? 0);
  const multiStrike = safeNumber(ability?.multiStrike, 1);
  if (multiStrike > 1) {
    damage *= multiStrike;
  }
  if ((ability?.bonusVsControlledMultiplier ?? 0) > 0 && isEnemyImpaired(enemy, now)) {
    damage *= ability.bonusVsControlledMultiplier;
  }
  if (now < (enemy?.damageTakenUntil ?? 0)) {
    damage *= enemy.damageTakenMultiplier ?? 1;
  }
  return Math.max(0, Math.ceil(damage));
}

function applyStackingDot(existingDamage, nextDamage, stacking) {
  if (!stacking) return nextDamage;
  return safeNumber(existingDamage, 0) + safeNumber(nextDamage, 0);
}

function applyAbilityDebuffsClient(enemy, ability, sourcePlayerId, now) {
  if (!enemy || !ability) return enemy;
  let nextEnemy = { ...enemy };
  if (ability.applyPoison || ability.poisonDamage) {
    nextEnemy.poisonDamage = applyStackingDot(nextEnemy.poisonDamage, ability.poisonDamage ?? 0, ability.poisonStacking !== false);
    nextEnemy.poisonTickRate = Math.max(250, safeNumber(ability.poisonTickRate, 1000));
    nextEnemy.poisonUntil = now + Math.max(500, safeNumber(ability.poisonDuration, 5000));
    nextEnemy.nextPoisonTickAt = now + nextEnemy.poisonTickRate;
    nextEnemy.poisonSourcePlayerId = sourcePlayerId ?? nextEnemy.poisonSourcePlayerId;
  }
  if (ability.bleedDamage) {
    nextEnemy.bleedDamage = applyStackingDot(nextEnemy.bleedDamage, ability.bleedDamage, ability.bleedStacking !== false);
    nextEnemy.bleedTickRate = Math.max(250, safeNumber(ability.bleedTickRate, 1000));
    nextEnemy.bleedUntil = now + Math.max(500, safeNumber(ability.bleedDuration, 600000));
    nextEnemy.nextBleedTickAt = now + nextEnemy.bleedTickRate;
    nextEnemy.bleedSourcePlayerId = sourcePlayerId ?? nextEnemy.bleedSourcePlayerId;
  }
  if (ability.applyBurn || ability.burnDamage) {
    nextEnemy.burnDamage = applyStackingDot(nextEnemy.burnDamage, ability.burnDamage ?? 0, ability.burnStacking);
    nextEnemy.burnTickRate = Math.max(250, safeNumber(ability.burnTickRate, 1000));
    nextEnemy.burnUntil = now + Math.max(500, safeNumber(ability.burnDuration, 4500));
    nextEnemy.nextBurnTickAt = now + nextEnemy.burnTickRate;
    nextEnemy.burnSourcePlayerId = sourcePlayerId ?? nextEnemy.burnSourcePlayerId;
  }
  if (ability.applyCold) {
    nextEnemy.coldUntil = Math.max(nextEnemy.coldUntil ?? 0, now + Math.max(500, safeNumber(ability.slowDuration, 3000)));
    nextEnemy.coldMultiplier = clamp(safeNumber(ability.slowMultiplier, 0.55), 0.1, 1);
  }
  if (ability.slowDuration) {
    nextEnemy.slowUntil = Math.max(nextEnemy.slowUntil ?? 0, now + Math.max(500, safeNumber(ability.slowDuration, 3000)));
    nextEnemy.slowMultiplier = clamp(safeNumber(ability.slowMultiplier, 0.55), 0.1, 1);
  }
  if (ability.freezeDuration) {
    const isBoss = nextEnemy.type === 'boss' || nextEnemy.type === 'dungeon_miniboss' || nextEnemy.type === 'dungeon_final_boss';
    if (!isBoss) {
      nextEnemy.frozenUntil = Math.max(nextEnemy.frozenUntil ?? 0, now + Math.max(250, safeNumber(ability.freezeDuration, 1500)));
    }
  }
  if (ability.stunDuration) {
    nextEnemy.stunnedUntil = Math.max(nextEnemy.stunnedUntil ?? 0, now + Math.max(250, safeNumber(ability.stunDuration, 1000)));
  }
  if (ability.damageTakenMultiplier && ability.damageTakenDuration) {
    nextEnemy.damageTakenMultiplier = Math.max(nextEnemy.damageTakenMultiplier ?? 1, safeNumber(ability.damageTakenMultiplier, 1));
    nextEnemy.damageTakenUntil = Math.max(nextEnemy.damageTakenUntil ?? 0, now + Math.max(500, safeNumber(ability.damageTakenDuration, 5000)));
  }
  return nextEnemy;
}

function enrichAbilityForCast(ability, character, buffs, now, options = {}) {
  let nextAbility = enrichRogueAbilityForCast(ability, character, buffs, now, options);
  if (!nextAbility) return nextAbility;
  nextAbility = { ...nextAbility };
  const spec = character?.talents?.spec;
  if (character?.classId === 'mage' && spec === 'frost' && abilityDealsDamage(nextAbility) && !nextAbility.skipCold) {
    nextAbility.applyCold = true;
    nextAbility.slowDuration = Math.max(nextAbility.slowDuration ?? 0, 3000);
    nextAbility.slowMultiplier = nextAbility.slowMultiplier ?? 0.55;
  }
  if (abilityDealsDamage(nextAbility) && now < (buffs.burnWindowUntil ?? 0)) {
    nextAbility.applyBurn = true;
    nextAbility.burnDamage = buffs.burnDamage ?? 10;
    nextAbility.burnDuration = buffs.burnDuration ?? 5000;
    nextAbility.burnTickRate = buffs.burnTickRate ?? 1000;
    nextAbility.burnStacking = buffs.burnStacking ?? true;
  }
  return nextAbility;
}

function getEffectiveAbilityResourceCost(ability, character, buffs, now) {
  if (now < (buffs.noManaCostUntil ?? 0) && getResourceConfig(character).key === 'mana') return 0;
  if (character?.classId === 'rogue' && now < (buffs.noEnergyCostUntil ?? 0)) return 0;
  return getAbilityManaCost(ability, character);
}

function getEffectiveAbilityCooldownMs(ability, buffs, now) {
  const baseCooldown = getAbilityCooldownMs(ability);
  if (now < (buffs.cooldownMultiplierUntil ?? 0)) {
    return Math.max(100, Math.round(baseCooldown * (buffs.cooldownMultiplier ?? 1)));
  }
  return baseCooldown;
}

function getCombatHealingMultiplier(buffs, now) {
  if (now < (buffs.healingFormUntil ?? 0)) return buffs.healingMultiplier ?? 1;
  return 1;
}

function getInitialStats(classId) {
  const growth = STAT_GROWTH[classId];
  return {
    health: BASE_STATS.health + growth.health,
    mana: BASE_STATS.mana + growth.mana,
    strength: BASE_STATS.strength + growth.strength,
    agility: BASE_STATS.agility + growth.agility,
    intellect: BASE_STATS.intellect + growth.intellect,
    attackSpeed: BASE_STATS.attackSpeed + (growth.attackSpeed ?? 0),
  };
}

function addStats(stats, growth, times = 1) {
  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => [key, value + (growth[key] ?? 0) * times]),
  );
}

function formatItemStats(stats = {}) {
  const labels = {
    health: 'Health',
    mana: 'Mana',
    strength: 'Strength',
    agility: 'Agility',
    intellect: 'Intellect',
    attackSpeed: 'Attack Speed',
  };

  return Object.entries(stats)
    .filter(([, value]) => value)
    .map(([key, value]) => `+${value} ${labels[key] ?? key}`)
    .join(', ');
}

function getItemScore(item) {
  const weights = {
    health: 0.18,
    mana: 0.16,
    strength: 1,
    agility: 1,
    intellect: 1,
    attackSpeed: 18,
  };
  return Object.entries(item?.stats ?? {}).reduce((total, [key, value]) => (
    total + Number(value ?? 0) * (weights[key] ?? 1)
  ), 0);
}

function getItemComparison(item, equippedItems) {
  if (isPotionItem(item)) return `Potion x${getItemQuantity(item)}`;
  if (item?.type === 'usable') return item.nonDestroyable ? 'Bound utility' : 'Utility';
  if (isItemBroken(item)) return 'Broken';
  const equipped = equippedItems?.[item?.slot];
  const diff = Math.round((getItemScore(item) - getItemScore(equipped)) * 10) / 10;
  const labels = {
    health: 'Health',
    mana: 'Mana',
    strength: 'Strength',
    agility: 'Agility',
    intellect: 'Intellect',
    attackSpeed: 'Attack Speed',
  };
  const statDiffs = Object.keys({ ...(item?.stats ?? {}), ...(equipped?.stats ?? {}) })
    .map((key) => [key, Number(item?.stats?.[key] ?? 0) - Number(equipped?.stats?.[key] ?? 0)])
    .filter(([, value]) => value)
    .map(([key, value]) => `${value > 0 ? '+' : ''}${Number(value.toFixed?.(2) ?? value)} ${labels[key] ?? key}`);
  const summary = !equipped
    ? '+ New slot'
    : diff > 0
      ? `+${diff} upgrade`
      : diff < 0
        ? `${diff} downgrade`
        : 'Sidegrade';
  return statDiffs.length ? `${summary} (${statDiffs.join(', ')})` : summary;
}

function getItemStatDiffGroups(item, equippedItems) {
  if (item?.type === 'usable' || isPotionItem(item)) return { positive: [], negative: [] };
  const equipped = equippedItems?.[item?.slot];
  const labels = {
    health: 'Health',
    mana: 'Mana',
    strength: 'Strength',
    agility: 'Agility',
    intellect: 'Intellect',
    attackSpeed: 'Attack Speed',
  };
  const diffs = Object.keys({ ...(item?.stats ?? {}), ...(equipped?.stats ?? {}) })
    .map((key) => [key, Number(item?.stats?.[key] ?? 0) - Number(equipped?.stats?.[key] ?? 0)])
    .filter(([, value]) => value);
  const formatValue = (value) => Number(value.toFixed(2));
  const positive = diffs.filter(([, value]) => value > 0).map(([key, value]) => ({ key, label: labels[key] ?? key, value: `+${formatValue(value)}` }));
  const negative = diffs.filter(([, value]) => value < 0).map(([key, value]) => ({ key, label: labels[key] ?? key, value: `${formatValue(value)}` }));
  return { positive, negative };
}

function getItemShiftComparison(item, equippedItems) {
  const { positive, negative } = getItemStatDiffGroups(item, equippedItems);
  return [
    positive.length ? `Gains: ${positive.map((entry) => `${entry.value} ${entry.label}`).join(', ')}` : 'Gains: none',
    negative.length ? `Losses: ${negative.map((entry) => `${entry.value} ${entry.label}`).join(', ')}` : 'Losses: none',
  ].join('\n');
}

function getInventoryItemTooltip(item, equippedItems, shiftHeld) {
  if (!item) return 'Empty';
  if (isPotionItem(item)) {
    return [
      item.name,
      `${item.rarity ?? 'Common'} Potion x${getItemQuantity(item)}`,
      item.description ?? 'Potion',
      item.healAmount ? `Heals ${item.healAmount}` : null,
      item.manaAmount ? `Restores ${item.manaAmount} mana` : null,
      'Press Q to use your selected main potion',
    ].filter(Boolean).join('\n');
  }
  if (item.type === 'usable') {
    return [
      item.name,
      `${item.rarity ?? 'Common'} Usable`,
      item.description ?? 'Use item',
      item.nonDestroyable ? 'Cannot be destroyed' : 'Can be destroyed',
    ].filter(Boolean).join('\n');
  }
  return `${item.name}\n${item.rarity} ${EQUIPMENT_SLOTS.find((slot) => slot.id === item.slot)?.label ?? item.slot}\n${formatItemStats(item.stats)}\n${formatDurability(item)}\n${shiftHeld ? getItemShiftComparison(item, equippedItems) : 'Hold Shift for stat gains/losses'}`;
}

function getItemSellValue(item) {
  if (item?.nonDestroyable || item?.type === 'usable') return 0;
  if (isPotionItem(item)) return Math.max(1, Math.floor((item.price ?? 4) * 0.35)) * getItemQuantity(item);
  const rarityValue = item.rarity === 'Epic'
    ? 55
    : item.rarity === 'Rare'
      ? 24
      : item.rarity === 'Uncommon'
        ? 14
        : 8;
  const statValue = Object.values(item.stats ?? {}).reduce((total, value) => total + value, 0);
  return rarityValue + statValue * 3;
}

function getEquippedItems(character) {
  const inventory = character?.inventory ?? [];
  return Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [
      slot.id,
      inventory.find((item) => item.equippedSlot === slot.id) ?? null,
    ]),
  );
}

function getTotalStats(character) {
  const baseStats = character?.stats ?? getInitialStats(character?.classId ?? 'warrior');
  const equipmentStats = (character?.inventory ?? [])
    .filter((item) => item.equippedSlot && !isItemBroken(item))
    .reduce((total, item) => addStats(total, item.stats ?? {}), { ...baseStats });

  const selectedSpec = character?.talents?.spec;
  const talentBonuses = selectedSpec ? TALENTS[character.classId]?.specs[selectedSpec]?.bonuses : null;
  const specStats = talentBonuses ? addStats(equipmentStats, talentBonuses) : equipmentStats;
  return addStats(specStats, getTalentStatBonuses(character));
}

function isPotionItem(item) {
  return item?.type === 'potion' || item?.type === 'consumable' || item?.potionType;
}

function isEquipmentItem(item) {
  return Boolean(item?.slot) && !isPotionItem(item) && item?.type !== 'usable';
}

function getItemQuantity(item) {
  return Math.max(1, Math.floor(safeNumber(item?.quantity, 1)));
}

function getMaxDurability(item) {
  if (!isEquipmentItem(item)) return null;
  return Math.max(1, Math.floor(safeNumber(item.maxDurability, 100)));
}

function isItemBroken(item) {
  const maxDurability = getMaxDurability(item);
  if (!maxDurability) return false;
  return safeNumber(item?.durability, maxDurability) <= 0 || item?.broken === true;
}

function formatDurability(item) {
  const maxDurability = getMaxDurability(item);
  if (!maxDurability) return '';
  const durability = clamp(Math.floor(safeNumber(item?.durability, maxDurability)), 0, maxDurability);
  return `${isItemBroken(item) ? 'Broken - ' : ''}Durability ${durability}/${maxDurability}`;
}

function createItemInstance(template, extra = {}) {
  const item = {
    ...template,
    ...extra,
    id: crypto.randomUUID(),
    foundAt: new Date().toISOString(),
  };
  return normalizeInventoryItem(item);
}

function normalizeInventoryItem(item = {}) {
  const base = {
    slot: item.type === 'usable' || isPotionItem(item) ? null : item.slot ?? 'trinket',
    stats: item.stats ?? {},
    ...item,
  };
  if (!base.id) base.id = crypto.randomUUID();
  if (isPotionItem(base)) {
    return {
      ...base,
      slot: null,
      stats: {},
      stackable: base.stackable ?? true,
      quantity: getItemQuantity(base),
      maxStack: Math.max(1, Math.floor(safeNumber(base.maxStack, 20))),
    };
  }
  if (isEquipmentItem(base)) {
    const maxDurability = getMaxDurability(base);
    const durability = clamp(Math.floor(safeNumber(base.durability, maxDurability)), 0, maxDurability);
    return {
      ...base,
      maxDurability,
      durability,
      broken: durability <= 0,
    };
  }
  return base;
}

function normalizeInventory(inventory = []) {
  const normalized = inventory.map((item) => normalizeInventoryItem(item));
  const hasRecallItem = normalized.some((item) => item.id === RECALL_ITEM_ID || item.action === 'recall');
  const withRecall = hasRecallItem ? normalized : [{ ...RECALL_ITEM }, ...normalized];
  const hasPotion = withRecall.some((item) => isPotionItem(item));
  return hasPotion ? withRecall : [{ ...STARTER_HEALTH_POTION }, ...withRecall];
}

function getBagCount(inventory = []) {
  return inventory.filter((item) => !item.equippedSlot).length;
}

function canStackItems(existing, incoming) {
  return Boolean(existing?.stackable && incoming?.stackable)
    && !existing.equippedSlot
    && existing.name === incoming.name
    && existing.type === incoming.type
    && String(existing.potionType ?? '') === String(incoming.potionType ?? '')
    && getItemQuantity(existing) < Math.max(1, Math.floor(safeNumber(existing.maxStack, incoming.maxStack ?? 20)));
}

function addInventoryItemStack(inventory = [], incomingItem) {
  const incoming = normalizeInventoryItem(incomingItem);
  if (!incoming.stackable) return { inventory: [...inventory, incoming], createdStacks: 1 };

  let remaining = getItemQuantity(incoming);
  let createdStacks = 0;
  const nextInventory = inventory.map((item) => {
    if (remaining <= 0 || !canStackItems(item, incoming)) return item;
    const maxStack = Math.max(1, Math.floor(safeNumber(item.maxStack, incoming.maxStack ?? 20)));
    const currentQuantity = getItemQuantity(item);
    const moved = Math.min(remaining, maxStack - currentQuantity);
    remaining -= moved;
    return { ...item, quantity: currentQuantity + moved };
  });

  while (remaining > 0) {
    const maxStack = Math.max(1, Math.floor(safeNumber(incoming.maxStack, 20)));
    const stackQuantity = Math.min(remaining, maxStack);
    nextInventory.push({
      ...incoming,
      id: crypto.randomUUID(),
      quantity: stackQuantity,
    });
    remaining -= stackQuantity;
    createdStacks += 1;
  }

  return { inventory: nextInventory, createdStacks };
}

function applyDeathDurabilityDamage(character, damage = 12) {
  let changed = false;
  const inventory = (character?.inventory ?? []).map((item) => {
    if (!item.equippedSlot || !isEquipmentItem(item)) return item;
    const maxDurability = getMaxDurability(item);
    const durability = clamp(Math.floor(safeNumber(item.durability, maxDurability)) - damage, 0, maxDurability);
    if (durability === item.durability && item.broken === (durability <= 0)) return item;
    changed = true;
    return {
      ...item,
      durability,
      broken: durability <= 0,
    };
  });
  return changed
    ? {
      ...character,
      inventory,
      updatedAt: new Date().toISOString(),
    }
    : character;
}

function getRepairCost(item) {
  if (!isEquipmentItem(item)) return 0;
  const maxDurability = getMaxDurability(item);
  const durability = clamp(Math.floor(safeNumber(item.durability, maxDurability)), 0, maxDurability);
  const missing = Math.max(0, maxDurability - durability);
  const rarityMultiplier = item.rarity === 'Epic' ? 0.9 : item.rarity === 'Rare' ? 0.65 : item.rarity === 'Uncommon' ? 0.42 : 0.25;
  return Math.ceil(missing * rarityMultiplier);
}

function getRepairAllCost(character) {
  return (character?.inventory ?? []).reduce((total, item) => total + getRepairCost(item), 0);
}

function normalizeQuestEnemyKind(value) {
  return String(value ?? '').toLowerCase().trim().replace(/[_\s]+/g, '-');
}

function getQuestKillObjectives(quest) {
  if (!quest || quest.type !== 'kill') return [];
  const explicitObjectives = Array.isArray(quest.objectives)
    ? quest.objectives
      .map((objective) => {
        const enemyKind = normalizeQuestEnemyKind(objective?.enemyKind ?? objective?.kind ?? objective?.id);
        const required = Math.max(1, Math.floor(safeNumber(objective?.required, 1)));
        return enemyKind ? { ...objective, enemyKind, required } : null;
      })
      .filter(Boolean)
    : [];
  if (explicitObjectives.length > 0) return explicitObjectives;
  const enemyKind = normalizeQuestEnemyKind(quest.enemyKind);
  return enemyKind ? [{ enemyKind, required: Math.max(1, Math.floor(safeNumber(quest.required, 1))) }] : [];
}

function getScaledQuestXpReward(quest) {
  if (!quest) return 0;
  if (quest.xpRewardLocked) return Math.max(0, safeNumber(quest.xpReward, 0));
  if (quest.type === 'travel') return 1600;
  if (quest.type === 'kill' && safeNumber(quest.required, 0) === 1) return 1400;
  return 850 + Math.max(0, Math.floor(safeNumber(quest.chainIndex, 0))) * 180;
}

function normalizeQuestState(quests = {}) {
  const activeEntries = Object.entries(quests.active ?? {})
    .filter(([questId, quest]) => questId && quest)
    .map(([questId, quest]) => {
      const questSnapshot = quest.quest ? { ...quest.quest } : null;
      if (
        questSnapshot?.id === 'world_region_0_0_v3:tamzia:redscar-highwaymen'
        && (!Array.isArray(questSnapshot.objectives) || questSnapshot.objectives.length === 0)
      ) {
        questSnapshot.required = 13;
        questSnapshot.requiredLocked = true;
        questSnapshot.objectiveText = 'Defeat 12 Redscar Highwaymen and Redscar Captain Varn';
        questSnapshot.description = 'Redscar Highwaymen have made a hard camp on the southern road. Break the camp and bring down Captain Varn inside the hideout.';
        questSnapshot.objectives = [
          { enemyKind: 'redscar-highwayman', required: 12, label: 'Highwaymen' },
          { enemyKind: 'redscar-captain', required: 1, label: 'Captain Varn' },
        ];
      }
      const explicitObjectives = Array.isArray(questSnapshot?.objectives) && questSnapshot.objectives.length > 0;
      if (questSnapshot?.type === 'kill' && explicitObjectives) {
        const objectives = getQuestKillObjectives(questSnapshot);
        questSnapshot.objectives = objectives;
        questSnapshot.required = objectives.reduce((total, objective) => total + objective.required, 0);
      } else if (questSnapshot?.type === 'kill' && safeNumber(questSnapshot.required, 0) !== 1 && !questSnapshot.requiredLocked) {
        const minimumRequired = normalizeMapId(questSnapshot.mapId) === 'world' ? 1 : 15;
        questSnapshot.required = Math.max(minimumRequired, Math.floor(safeNumber(questSnapshot.required, minimumRequired)));
        questSnapshot.objectiveText = String(questSnapshot.objectiveText ?? '').replace(/Defeat \d+/i, `Defeat ${questSnapshot.required}`);
        questSnapshot.description = String(questSnapshot.description ?? '').replace(/Defeat \d+/i, `Defeat ${questSnapshot.required}`);
      }
      if (questSnapshot) {
        questSnapshot.xpReward = Math.max(safeNumber(questSnapshot.xpReward, 0), getScaledQuestXpReward(questSnapshot));
      }
      const objectives = getQuestKillObjectives(questSnapshot);
      const usesObjectiveProgress = questSnapshot?.type === 'kill' && explicitObjectives && objectives.length > 0;
      const storedProgressByKind = quest.progressByKind ?? quest.objectiveProgress ?? {};
      const progressByKind = Object.fromEntries(objectives.map((objective, index) => {
        const kind = normalizeQuestEnemyKind(objective.enemyKind);
        const stored = safeNumber(storedProgressByKind[kind], index === 0 ? quest.progress : 0);
        return [kind, Math.min(objective.required, Math.max(0, Math.floor(stored)))];
      }));
      const progress = usesObjectiveProgress
        ? objectives.reduce((total, objective) => total + safeNumber(progressByKind[objective.enemyKind], 0), 0)
        : Math.max(0, Math.floor(safeNumber(quest.progress, 0)));
      const ready = questSnapshot?.type === 'kill'
        ? usesObjectiveProgress
          ? objectives.every((objective) => safeNumber(progressByKind[objective.enemyKind], 0) >= objective.required)
          : progress >= safeNumber(questSnapshot.required, 1)
        : quest.status === 'ready';
      return [
        questId,
        {
          status: ready ? 'ready' : 'active',
          progress,
          ...(usesObjectiveProgress ? { progressByKind } : {}),
          acceptedAt: quest.acceptedAt ?? new Date().toISOString(),
          quest: questSnapshot,
        },
      ];
    });
  return {
    active: Object.fromEntries(activeEntries),
    completed: { ...(quests.completed ?? {}) },
    mainQuestId: quests.mainQuestId ?? activeEntries[0]?.[0] ?? null,
  };
}

function rollBossLoot() {
  const item = BOSS_LOOT[Math.floor(Math.random() * BOSS_LOOT.length)];
  return {
    ...item,
    id: crypto.randomUUID(),
    foundAt: new Date().toISOString(),
  };
}

function rollDungeonBossLoot() {
  const item = BOSS_LOOT[Math.floor(Math.random() * BOSS_LOOT.length)];
  const statBonus = Object.fromEntries(Object.entries(item.stats ?? {}).map(([key, value]) => [
    key,
    key === 'attackSpeed' ? Number((Number(value ?? 0) + 0.03).toFixed(2)) : Math.ceil(Number(value ?? 0) * 1.45),
  ]));
  return {
    ...item,
    id: crypto.randomUUID(),
    name: `Riftforged ${item.name}`,
    rarity: item.rarity === 'Rare' && Math.random() < 0.45 ? 'Epic' : item.rarity,
    stats: statBonus,
    foundAt: new Date().toISOString(),
  };
}

function nextBossDelay() {
  return BOSS_SPAWN_MIN + Math.random() * (BOSS_SPAWN_MAX - BOSS_SPAWN_MIN);
}

function getInitialBossSpawnAt(tiledWorld, now = performance.now()) {
  return (tiledWorld?.bossSpawns ?? []).length > 0 ? 0 : now + nextBossDelay();
}

export {
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
  distanceToSegment,
  angleDifference,
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
  getClassPrimaryStat,
  getSpecAbilityList,
  getTalentNodesForSpec,
  getSpecSpentPoints,
  getTalentNodeStatBonuses,
  getTalentStatBonuses,
  getAbilityTalentModifiers,
  scaleNumeric,
  reduceNumeric,
  applyTalentModifiersToAbility,
  formatTalentPercent,
  getTalentNodeDescription,
  getUnlockedAbilities,
  getCharacterAbilities,
  WARRIOR_FURY_PER_ATTACK,
  ROGUE_ENERGY_REGEN_PER_SECOND,
  PARTY_INVITE_COOLDOWN_MS,
  WARRIOR_ABILITY_COSTS,
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
  triggerRogueStealthDamage,
  enrichRogueAbilityForCast,
  isEnemyImpaired,
  getAbilityDamageAgainstEnemy,
  applyStackingDot,
  applyAbilityDebuffsClient,
  enrichAbilityForCast,
  getEffectiveAbilityResourceCost,
  getEffectiveAbilityCooldownMs,
  getCombatHealingMultiplier,
  getInitialStats,
  addStats,
  formatItemStats,
  getItemScore,
  getItemComparison,
  getItemStatDiffGroups,
  getItemShiftComparison,
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
  canStackItems,
  addInventoryItemStack,
  applyDeathDurabilityDamage,
  getRepairCost,
  getRepairAllCost,
  getScaledQuestXpReward,
  normalizeQuestState,
  rollBossLoot,
  rollDungeonBossLoot,
  nextBossDelay,
  getInitialBossSpawnAt,
};
