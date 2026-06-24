import { resolveAssetUrl } from './game/mapAssets';

const ABILITY_ASSET_CLASSES = ['priest', 'paladin', 'hunter', 'mage', 'rogue', 'warrior'];
export const ABILITY_VISUAL_IMAGE_CACHE = new globalThis.Map();

export function abilityAssetSlug(name) {
  return String(name ?? 'ability')
    .trim()
    .toLowerCase()
    .replace(/['\u2019`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ability';
}

export function getAbilityVisualConfig(classId, ability) {
  const safeClassId = ABILITY_ASSET_CLASSES.includes(classId) ? classId : 'mage';
  const slug = abilityAssetSlug(ability?.name);
  return {
    classId: safeClassId,
    slug,
    icon: `/assets/abilities/icons/${safeClassId}/${slug}.png`,
    effect: `/assets/abilities/effects/${safeClassId}/${slug}.png`,
    projectile: `/assets/abilities/projectiles/${safeClassId}/${slug}.png`,
    impact: `/assets/abilities/impacts/${safeClassId}/${slug}.png`,
    sound: `/assets/abilities/sounds/${safeClassId}/${slug}.ogg`,
    frame: {
      icon: { width: 64, height: 64 },
      effect: { width: 64, height: 64, frames: 4 },
      projectile: { width: 32, height: 32, frames: 4 },
      impact: { width: 64, height: 64, frames: 4 },
    },
  };
}

export function getAbilityVisualImage(src) {
  if (!src || typeof Image === 'undefined') return null;
  const imageSrc = String(src).startsWith('/')
    ? resolveAssetUrl(String(src).slice(1))
    : resolveAssetUrl(String(src));

  let record = ABILITY_VISUAL_IMAGE_CACHE.get(imageSrc);
  if (!record) {
    const image = new Image();
    record = { image, loaded: false, failed: false };
    image.onload = () => {
      record.loaded = true;
    };
    image.onerror = () => {
      record.failed = true;
    };
    image.src = imageSrc;
    ABILITY_VISUAL_IMAGE_CACHE.set(imageSrc, record);
  }

  if (record.failed || !record.loaded) return null;
  return record.image;
}

export function preloadAbilityVisual(visual) {
  if (!visual) return;
  ['icon', 'effect', 'projectile', 'impact'].forEach((key) => {
    getAbilityVisualImage(visual[key]);
  });
}

export function getAbilityIconStyle(classId, ability) {
  if (!ability) return undefined;
  const visual = getAbilityVisualConfig(classId, ability);
  return {
    '--ability-icon-url': `url("${visual.icon}")`,
  };
}
