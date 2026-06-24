import {
  getAbilityCooldownMs,
  getAbilityManaCost,
  getResourceConfig,
  isPotionItem,
} from './game/characterLogic';

export { getAbilityIconLabel, describeAbility, getItemIconLabel };

function getAbilityIconLabel(ability) {
  const labels = {
    bolt: 'BL',
    nova: 'NV',
    shot: 'SH',
    trap: 'TR',
    strike: 'ST',
    cleave: 'CL',
    shout: 'AO',
    shield: 'GD',
    heal: 'HL',
    channel: 'CH',
    chain: 'CH',
    aura: 'AU',
    ground: 'GR',
    hot: 'HT',
    healGround: 'HG',
    buff: 'BF',
  };
  return labels[ability?.type] ?? 'AB';
}

function describeAbility(ability, stats, character) {
  if (!ability) return '';
  const damage = ability.damage
    ? ability.damage + Math.floor(((stats.strength ?? 0) + (stats.agility ?? 0) + (stats.intellect ?? 0)) / 8)
    : 0;
  const healing = ability.healing ? ability.healing + Math.floor((stats.intellect ?? 0) / 3) : 0;
  const typeDescriptions = {
    bolt: 'fires a magic projectile toward the cursor',
    shot: 'fires a ranged weapon attack toward the cursor',
    strike: 'hits enemies in front of you',
    cleave: 'slashes enemies in a frontal arc',
    nova: 'hits enemies around you',
    shout: 'bursts around you',
    shield: 'protects you',
    heal: 'heals the selected ally or yourself',
    channel: 'channels continuously from your character toward the cursor until resource runs out',
    chain: 'jumps between combat targets',
    aura: 'creates an effect around you',
    ground: 'places an area effect at the cursor',
    trap: 'places a trap that waits for an enemy to trigger it',
    hot: 'heals over time',
    healGround: 'places a healing area',
    buff: 'temporarily empowers you',
  };
  const parts = [];
  parts.push(typeDescriptions[ability.type] ?? 'uses an ability');
  if (damage) parts.push(`${damage} damage`);
  if (healing) parts.push(`${healing} healing`);
  if (ability.range) parts.push(`${Math.round(ability.range)} range`);
  if (ability.radius) parts.push(`${Math.round(ability.radius)} radius`);
  if (ability.duration && ability.type !== 'channel') parts.push(`${(ability.duration / 1000).toFixed(1)}s duration`);
  if (ability.type === 'channel') parts.push('no fixed duration');
  if (ability.freezeDuration) parts.push(`${(ability.freezeDuration / 1000).toFixed(1)}s freeze`);
  if (ability.stunDuration) parts.push(`${(ability.stunDuration / 1000).toFixed(1)}s stun`);
  if (ability.slowDuration) parts.push(`${(ability.slowDuration / 1000).toFixed(1)}s slow`);
  if (ability.applyPoison || ability.poisonDamage) parts.push('applies poison');
  if (ability.applyBurn || ability.burnDamage) parts.push('applies burn');
  if (ability.bleedDamage) parts.push('applies bleed');
  if (ability.autoCombatBolt) parts.push(`auto-casts ${ability.autoBoltName ?? 'bolts'} on combat targets`);
  if (ability.invisibility) parts.push('grants invisibility until you attack');
  if (ability.invulnerable) parts.push('grants invulnerability');
  parts.push(`${getAbilityManaCost(ability, character)} ${getResourceConfig(character).label.toLowerCase()}`);
  parts.push(`${(getAbilityCooldownMs(ability) / 1000).toFixed(1)}s cooldown`);
  return parts.join(' | ');
}

function getItemIconLabel(item) {
  if (item?.action === 'recall') return 'RC';
  if (isPotionItem(item)) return 'PT';
  if (item?.type === 'usable') return 'US';
  const labels = {
    head: 'HD',
    chest: 'CH',
    legs: 'LG',
    boots: 'BT',
    weapon: 'WP',
    offhand: 'OH',
    ring: 'RG',
    trinket: 'TR',
  };
  return labels[item?.slot] ?? 'IT';
}
