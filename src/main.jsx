import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  Backpack,
  Cloud,
  Crosshair,
  Crown,
  DoorOpen,
  Hammer,
  HeartPulse,
  Leaf,
  LogOut,
  Map,
  Shield,
  Skull,
  Sparkles,
  Sword,
  User,
  UserMinus,
  Wand2,
} from 'lucide-react';
import { deleteCloudCharacter, loadCloudCharacters, saveCloudCharacter } from './characterCloud';
import { getColyseusUrl, joinWorldRoom } from './colyseusGameClient';
import { auth, hasFirebaseConfig } from './firebaseClient';
import './styles.css';

const OFFLINE_DEMO = false;
const OFFLINE_USER = {
  uid: 'offline-demo',
  email: 'Offline demo',
};

const WORLD = {
  width: 6400,
  height: 6400,
  tile: 32,
};

const MAP_FILES = {
  world: 'world.tmj',
  dungeon_01: 'dungeon_01.tmj',
};

const PLAYER = {
  radius: 18,
  speed: 260,
  manaRegen: 7,
  hpRegen: 5,
  outOfCombatDelay: 5000,
};

const ENEMY = {
  maxCount: 12,
  radius: 17,
  speed: 82,
  spawnEvery: 1800,
  wanderSpeed: 34,
};

const SAVE_KEY = 'mmo-project.characters.v1';
const MAX_LEVEL = 20;
const ENEMY_XP = 35;
const BOSS_XP = 180;
const BOSS_SPAWN_MIN = 18000;
const BOSS_SPAWN_MAX = 34000;
const COLYSEUS_INPUT_MS = 50;
const COLYSEUS_RECONNECT_MS = 1800;
const REMOTE_PLAYER_LEAD_MS = 90;
const REMOTE_PLAYER_SMOOTHING = 15;
const REMOTE_PLAYER_SNAP_DISTANCE = 360;
const AUTO_ATTACK_COOLDOWN_MS = 720;
const BASE_STATS = {
  health: 100,
  mana: 60,
  strength: 5,
  agility: 5,
  intellect: 5,
};

const EQUIPMENT_SLOTS = [
  { id: 'head', label: 'Head' },
  { id: 'chest', label: 'Chest' },
  { id: 'legs', label: 'Legs' },
  { id: 'boots', label: 'Boots' },
  { id: 'weapon', label: 'Weapon' },
  { id: 'offhand', label: 'Offhand' },
  { id: 'ring', label: 'Ring' },
  { id: 'trinket', label: 'Trinket' },
];

const STAT_GROWTH = {
  mage: { health: 8, mana: 16, strength: 1, agility: 1, intellect: 4 },
  hunter: { health: 11, mana: 8, strength: 2, agility: 4, intellect: 1 },
  paladin: { health: 14, mana: 10, strength: 3, agility: 1, intellect: 2 },
  warrior: { health: 16, mana: 4, strength: 4, agility: 2, intellect: 0 },
  priest: { health: 9, mana: 15, strength: 1, agility: 1, intellect: 4 },
};

const ABILITY_MANA_COST = {
  1: 12,
  2: 18,
  3: 26,
  4: 36,
  5: 48,
  6: 62,
};

const TALENTS = {
  paladin: {
    unlockLevel: 10,
    specs: {
      verdict: {
        name: 'Oath of the Verdict',
        role: 'Damage',
        description: 'Holy strikes become sharper and faster.',
        bonuses: { strength: 5, intellect: 2, mana: 15 },
        abilities: [
          { key: '1', level: 10, name: 'Templar Strike', type: 'strike', color: '#fde68a', damage: 96, manaCost: 34 },
          { key: '2', level: 10, name: 'Blazing Verdict', type: 'bolt', color: '#facc15', damage: 82, manaCost: 30 },
          { key: '3', level: 12, name: 'Radiant Cleave', type: 'cleave', color: '#fef3c7', damage: 74, manaCost: 42 },
          { key: '4', level: 16, name: 'Final Judgement', type: 'shot', color: '#fff7ad', damage: 132, manaCost: 62 },
        ],
      },
      aegis: {
        name: 'Aegis of Dawn',
        role: 'Tank',
        description: 'You constantly draw enemy focus while fighting.',
        bonuses: { health: 55, strength: 2, intellect: 2, mana: 20 },
        passive: 'Radiant Taunt',
        abilities: [
          { key: '1', level: 10, name: 'Shield Bash', type: 'strike', color: '#bfdbfe', damage: 62, manaCost: 24 },
          { key: '2', level: 10, name: 'Dawn Guard', type: 'shield', color: '#fef08a', damage: 28, manaCost: 28 },
          { key: '3', level: 12, name: 'Consecrated Ground', type: 'nova', color: '#fde68a', damage: 52, manaCost: 42 },
          { key: '4', level: 16, name: 'Bulwark Slam', type: 'cleave', color: '#e0f2fe', damage: 88, manaCost: 54 },
        ],
      },
    },
  },
  warrior: {
    unlockLevel: 10,
    specs: {
      berserker: {
        name: 'Berserker Rage',
        role: 'Damage',
        description: 'Warrior attacks become more savage and fury-fueled.',
        bonuses: { strength: 6, agility: 2, fury: 20 },
        abilities: [
          { key: '1', level: 10, name: 'Raging Cleave', type: 'cleave', color: '#fdba74', damage: 112, furyCost: 24 },
          { key: '2', level: 10, name: 'Blood Howl', type: 'shout', color: '#fb7185', damage: 42, furyCost: 16 },
          { key: '3', level: 12, name: 'Mortal Frenzy', type: 'strike', color: '#fda4af', damage: 96, furyCost: 28 },
          { key: '4', level: 16, name: 'Rage Execution', type: 'shot', color: '#fecdd3', damage: 148, furyCost: 42 },
        ],
      },
      ironward: {
        name: 'Iron Ward',
        role: 'Tank',
        description: 'A defensive path that stores fury into heavy guard.',
        bonuses: { health: 60, strength: 3, agility: 1, fury: 15 },
        passive: 'Unbreakable Guard',
        abilities: [
          { key: '1', level: 10, name: 'Shield Slam', type: 'strike', color: '#d1d5db', damage: 90, furyCost: 20 },
          { key: '2', level: 10, name: 'Guarded Roar', type: 'shield', color: '#e5e7eb', damage: 30, furyCost: 14 },
          { key: '3', level: 12, name: 'Bulwark Charge', type: 'cleave', color: '#f1f5f9', damage: 78, furyCost: 24 },
          { key: '4', level: 16, name: 'Immovable Front', type: 'trap', color: '#cbd5e1', damage: 118, furyCost: 38 },
        ],
      },
    },
  },
  hunter: {
    unlockLevel: 10,
    specs: {
      beastmaster: {
        name: 'Beast Master',
        role: 'Damage',
        description: 'Your companions focus the enemy and sharpen ranged attacks.',
        bonuses: { agility: 6, strength: 2, health: 20 },
        abilities: [
          { key: '1', level: 10, name: 'Raptor Shot', type: 'shot', color: '#fde68a', damage: 96, manaCost: 34 },
          { key: '2', level: 10, name: 'Pack Howl', type: 'shout', color: '#bef264', damage: 46, manaCost: 24 },
          { key: '3', level: 12, name: 'Mammoth Rake', type: 'strike', color: '#86efac', damage: 86, manaCost: 42 },
          { key: '4', level: 16, name: 'Stampede', type: 'trap', color: '#fde047', damage: 128, manaCost: 60 },
        ],
      },
      survival: {
        name: 'Survivalist',
        role: 'Utility',
        description: 'You weave traps, sustain, and precise shots into a steady rhythm.',
        bonuses: { agility: 4, health: 30, mana: 12 },
        abilities: [
          { key: '1', level: 10, name: 'Viper Shot', type: 'bolt', color: '#fdba74', damage: 88, manaCost: 30 },
          { key: '2', level: 10, name: 'Hardened Trap', type: 'trap', color: '#fdba74', damage: 54, manaCost: 26 },
          { key: '3', level: 12, name: 'Volley Mark', type: 'shout', color: '#fef08a', damage: 68, manaCost: 40 },
          { key: '4', level: 16, name: 'Snare Burst', type: 'trap', color: '#fb923c', damage: 122, manaCost: 56 },
        ],
      },
    },
  },
  mage: {
    unlockLevel: 10,
    specs: {
      arcane: {
        name: 'Arcane Weaving',
        role: 'Damage',
        description: 'Arcane spells become volatile and powerful.',
        bonuses: { intellect: 7, mana: 18 },
        abilities: [
          { key: '1', level: 10, name: 'Arcane Bolt', type: 'bolt', color: '#67e8f9', damage: 104, manaCost: 34 },
          { key: '2', level: 10, name: 'Mana Pulse', type: 'nova', color: '#22d3ee', damage: 58, manaCost: 28 },
          { key: '3', level: 12, name: 'Spellweave', type: 'shot', color: '#a5f3fc', damage: 88, manaCost: 42 },
          { key: '4', level: 16, name: 'Astral Storm', type: 'shout', color: '#67e8f9', damage: 138, manaCost: 62 },
        ],
      },
      frost: {
        name: 'Frostguard',
        role: 'Control',
        description: 'Ice magic slows enemies and reinforces your defense.',
        bonuses: { intellect: 5, agility: 2, mana: 15 },
        abilities: [
          { key: '1', level: 10, name: 'Frost Spike', type: 'shot', color: '#7dd3fc', damage: 84, manaCost: 30 },
          { key: '2', level: 10, name: 'Ice Ward', type: 'shield', color: '#bae6fd', damage: 26, manaCost: 26 },
          { key: '3', level: 12, name: 'Winter Ring', type: 'nova', color: '#e0f2fe', damage: 70, manaCost: 38 },
          { key: '4', level: 16, name: 'Glacial Prison', type: 'trap', color: '#e0f2fe', damage: 118, manaCost: 56 },
        ],
      },
    },
  },
  priest: {
    unlockLevel: 10,
    specs: {
      void: {
        name: 'Enter the Void',
        role: 'Damage',
        description: 'Smite and Mind Spike hit harder.',
        bonuses: { intellect: 6, mana: 20 },
        abilities: [
          { key: '1', level: 10, name: 'Void Bolt', type: 'bolt', color: '#8b5cf6', damage: 92, manaCost: 34 },
          {
            key: '2',
            level: 10,
            name: 'Mind Flay',
            type: 'channel',
            color: '#a78bfa',
            damage: 26,
            manaCost: 8,
            duration: 3200,
            tickRate: 450,
          },
          { key: '3', level: 12, name: 'Shadow Nova', type: 'shout', color: '#6d28d9', damage: 58, manaCost: 44 },
          { key: '4', level: 16, name: 'Void Collapse', type: 'trap', color: '#4c1d95', damage: 115, manaCost: 62 },
        ],
      },
      light: {
        name: 'Embrace the Light',
        role: 'Healer',
        description: 'Holy magic becomes steadier and safer.',
        bonuses: { health: 25, intellect: 3, mana: 30 },
        abilities: [
          { key: '1', level: 10, name: 'Heal', type: 'heal', color: '#bbf7d0', healing: 90, manaCost: 34 },
          { key: '2', level: 10, name: 'Renew', type: 'heal', color: '#86efac', healing: 55, manaCost: 24 },
          { key: '3', level: 12, name: 'Holy Pulse', type: 'nova', color: '#fef08a', damage: 34, healing: 48, manaCost: 42 },
          { key: '4', level: 16, name: 'Greater Heal', type: 'heal', color: '#f0fdf4', healing: 150, manaCost: 58 },
        ],
      },
    },
  },
};

const BOSS_LOOT = [
  { name: 'Ancient Ember Crown', rarity: 'Rare', slot: 'head', stats: { intellect: 3, mana: 10 } },
  { name: 'Ironbark Chestguard', rarity: 'Rare', slot: 'chest', stats: { health: 25, strength: 1 } },
  { name: 'Wolf King Fang', rarity: 'Epic', slot: 'weapon', stats: { strength: 4, agility: 2 } },
  { name: 'Moonlit Trail Boots', rarity: 'Epic', slot: 'boots', stats: { agility: 4, health: 10 } },
  { name: 'Sunforged Relic', rarity: 'Epic', slot: 'trinket', stats: { mana: 15, intellect: 2 } },
  { name: 'Rift Guard Buckler', rarity: 'Rare', slot: 'offhand', stats: { health: 18, strength: 2 } },
  { name: 'Band of First Dawn', rarity: 'Rare', slot: 'ring', stats: { agility: 2, intellect: 2 } },
];

const SHOPKEEPER = {
  x: 515,
  y: 390,
  name: 'Mira',
  type: 'shopkeeper',
  interactRange: 92,
};

const RACES = {
  human: {
    name: 'Human',
    icon: User,
    skin: '#f2c7a4',
    hair: '#8b5e34',
    scale: 1,
    allowedClasses: ['mage', 'hunter', 'paladin', 'warrior', 'priest'],
  },
  elf: {
    name: 'Elf',
    icon: Leaf,
    skin: '#f0d6ad',
    hair: '#e9d66b',
    scale: 0.96,
    allowedClasses: ['mage', 'hunter', 'priest'],
  },
  dwarf: {
    name: 'Dwarf',
    icon: Hammer,
    skin: '#d6a06f',
    hair: '#9a4f2f',
    scale: 0.88,
    allowedClasses: ['paladin', 'warrior', 'hunter', 'priest'],
  },
  orc: {
    name: 'Orc',
    icon: Sword,
    skin: '#74a85a',
    hair: '#20251f',
    scale: 1.08,
    allowedClasses: ['warrior', 'hunter'],
  },
  undead: {
    name: 'Undead',
    icon: Skull,
    skin: '#cbd5c0',
    hair: '#d8dee9',
    scale: 1,
    allowedClasses: ['mage', 'warrior', 'priest'],
  },
};

const CLASSES = {
  mage: {
    name: 'Mage',
    icon: Wand2,
    colors: {
      robe: '#4263eb',
      trim: '#8be9fd',
      hair: '#f6d365',
      weapon: '#d7f9ff',
    },
    abilities: [
      { key: '1', level: 1, name: 'Firebolt', type: 'bolt', color: '#ff6b35', damage: 55 },
      { key: '2', level: 1, name: 'Frost Nova', type: 'nova', color: '#7dd3fc', damage: 30 },
      { key: '3', level: 4, name: 'Arcane Lance', type: 'shot', color: '#c084fc', damage: 65 },
      { key: '4', level: 8, name: 'Meteor Ring', type: 'shout', color: '#fb7185', damage: 42 },
      { key: '5', level: 12, name: 'Ice Prison', type: 'trap', color: '#bae6fd', damage: 70 },
      { key: '6', level: 16, name: 'Star Surge', type: 'bolt', color: '#fef08a', damage: 95 },
    ],
  },
  hunter: {
    name: 'Hunter',
    icon: Crosshair,
    colors: {
      robe: '#2f9e44',
      trim: '#d8b46a',
      hair: '#5f3dc4',
      weapon: '#8d6e45',
    },
    abilities: [
      { key: '1', level: 1, name: 'Piercing Shot', type: 'shot', color: '#facc15', damage: 45 },
      { key: '2', level: 1, name: 'Trap', type: 'trap', color: '#fb923c', damage: 40 },
      { key: '3', level: 4, name: 'Rapid Arrow', type: 'bolt', color: '#bef264', damage: 58 },
      { key: '4', level: 8, name: 'Explosive Trap', type: 'trap', color: '#fdba74', damage: 70 },
      { key: '5', level: 12, name: 'Volley', type: 'shout', color: '#fde047', damage: 45 },
      { key: '6', level: 16, name: 'Deadeye', type: 'shot', color: '#fefce8', damage: 110 },
    ],
  },
  paladin: {
    name: 'Paladin',
    icon: Shield,
    colors: {
      robe: '#e6c55c',
      trim: '#f8fafc',
      hair: '#8b5e34',
      weapon: '#cbd5e1',
    },
    abilities: [
      { key: '1', level: 1, name: 'Holy Strike', type: 'strike', color: '#fff3a3', damage: 45 },
      { key: '2', level: 1, name: 'Divine Shield', type: 'shield', color: '#fef08a', damage: 22 },
      { key: '3', level: 4, name: 'Judgement', type: 'bolt', color: '#fde68a', damage: 62 },
      { key: '4', level: 8, name: 'Consecration', type: 'nova', color: '#fef3c7', damage: 48 },
      { key: '5', level: 12, name: 'Hammer Toss', type: 'shot', color: '#e5e7eb', damage: 82 },
      { key: '6', level: 16, name: 'Radiant Burst', type: 'shout', color: '#fef08a', damage: 72 },
    ],
  },
  warrior: {
    name: 'Warrior',
    icon: Sword,
    colors: {
      robe: '#b42318',
      trim: '#64748b',
      hair: '#2f221d',
      weapon: '#d1d5db',
    },
    abilities: [
      { key: '1', level: 1, name: 'Cleave', type: 'cleave', color: '#f97316', damage: 48 },
      { key: '2', level: 1, name: 'Battle Shout', type: 'shout', color: '#ef4444', damage: 25 },
      { key: '3', level: 4, name: 'Charge Slash', type: 'strike', color: '#fb923c', damage: 65 },
      { key: '4', level: 8, name: 'Whirlwind', type: 'nova', color: '#f87171', damage: 50 },
      { key: '5', level: 12, name: 'Ground Breaker', type: 'trap', color: '#a16207', damage: 80 },
      { key: '6', level: 16, name: 'Execute', type: 'shot', color: '#fecaca', damage: 120 },
    ],
  },
  priest: {
    name: 'Priest',
    icon: HeartPulse,
    colors: {
      robe: '#f8fafc',
      trim: '#facc15',
      hair: '#d8b4fe',
      weapon: '#fde68a',
    },
    abilities: [
      { key: '1', level: 1, name: 'Smite', type: 'bolt', color: '#fef3c7', damage: 48 },
      { key: '2', level: 1, name: 'Holy Nova', type: 'nova', color: '#fde68a', damage: 28 },
      { key: '3', level: 4, name: 'Mind Spike', type: 'shot', color: '#c4b5fd', damage: 62 },
      { key: '4', level: 8, name: 'Sanctuary', type: 'shield', color: '#fef08a', damage: 34 },
      { key: '5', level: 12, name: 'Penance', type: 'bolt', color: '#e9d5ff', damage: 78 },
      { key: '6', level: 16, name: 'Divine Wrath', type: 'shout', color: '#fff7ed', damage: 82 },
    ],
  },
};

const CLASS_NAME_POOLS = {
  mage: ['Aetherion', 'Lyra Spellwind', 'Vaelis', 'Mira Starfall', 'Eldrin'],
  hunter: ['Rowan Swiftshot', 'Kael Thorn', 'Ashen Vale', 'Nira Wildmark', 'Bryn'],
  paladin: ['Aurel Dawnshield', 'Ser Caldus', 'Tirion Vale', 'Maren Lightward', 'Garran'],
  warrior: ['Brakka Ironhand', 'Duran Steelborn', 'Rokar', 'Hilda Axebreaker', 'Torvik'],
  priest: ['Elowen Lightcall', 'Seren Dawn', 'Iria Solace', 'Neris', 'Calen Vow'],
};

const CUSTOMIZATION = {
  skin: ['#f2c7a4', '#d6a06f', '#f0d6ad', '#74a85a', '#cbd5c0'],
  hair: ['#8b5e34', '#f6d365', '#2f221d', '#d8b4fe', '#d8dee9'],
  robe: ['#4263eb', '#2f9e44', '#e6c55c', '#b42318', '#f8fafc'],
  trim: ['#8be9fd', '#f8fafc', '#facc15', '#64748b', '#c084fc'],
};

const TREES = [
  [260, 240], [430, 380], [620, 250], [940, 440], [1180, 280], [1450, 520],
  [1760, 330], [2040, 570], [2380, 410], [2710, 650], [3090, 360],
  [360, 920], [720, 760], [1010, 1050], [1390, 900], [1680, 1120],
  [2090, 890], [2460, 1010], [2860, 910], [3240, 1180],
  [520, 1540], [860, 1320], [1230, 1690], [1560, 1450], [1930, 1600],
  [2320, 1370], [2680, 1700], [3120, 1490],
  [390, 2050], [760, 1900], [1130, 2180], [1510, 1990], [1880, 2110],
  [2260, 1920], [2630, 2200], [3070, 2020], [3370, 2140],
];

const ROCKS = [
  [780, 520], [1320, 650], [2180, 260], [3010, 780], [460, 1280],
  [1120, 1370], [1810, 760], [2530, 1320], [3360, 980], [940, 2040],
  [2110, 2180], [2890, 1880],
];

const NPCS = [
  { x: 560, y: 590, name: 'Lina', color: '#f97316' },
  { x: 1710, y: 1340, name: 'Marek', color: '#06b6d4' },
  { x: 2920, y: 1540, name: 'Sera', color: '#a855f7' },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function samePartyMembers(current, next) {
  if (current.length !== next.length) return false;
  return current.every((member, index) => {
    const candidate = next[index];
    return (
      member.id === candidate.id
      && member.name === candidate.name
      && member.classId === candidate.classId
      && member.level === candidate.level
      && member.hp === candidate.hp
      && member.maxHp === candidate.maxHp
      && member.isSelf === candidate.isSelf
      && member.isLeader === candidate.isLeader
    );
  });
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point, start, end) {
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

function getUnlockedAbilities(classId, level) {
  return CLASSES[classId].abilities.filter((ability) => ability.level <= level);
}

function getCharacterAbilities(character) {
  if (!character) return [];
  const level = character.level ?? 1;
  const talentTree = TALENTS[character.classId];
  const selectedSpec = character.talents?.spec;
  const specAbilities = selectedSpec ? talentTree?.specs[selectedSpec]?.abilities : null;

  if (specAbilities && level >= (talentTree?.unlockLevel ?? 10)) {
    return specAbilities.filter((ability) => ability.level <= level);
  }

  return getUnlockedAbilities(character.classId, level);
}

const WARRIOR_FURY_PER_ATTACK = 12;

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

  return ability.manaCost ?? ability.resourceCost ?? ABILITY_MANA_COST[ability.key] ?? 15;
}

function getResourceConfig(character) {
  if (character?.classId === 'warrior') {
    return {
      key: 'fury',
      label: 'Fury',
      max: 100,
    };
  }

  return {
    key: 'mana',
    label: 'Mana',
    max: getTotalStats(character).mana,
  };
}

function getCurrentResource(character, vitals = vitalsRef.current) {
  const resourceConfig = getResourceConfig(character);
  return Math.floor(vitals?.[resourceConfig.key] ?? 0);
}

function getResourceMax(character, stats = getTotalStats(character)) {
  return getResourceConfig({ ...character, ...stats }).max;
}

function getAutoAttackAbility(classId) {
  if (classId === 'warrior' || classId === 'paladin') {
    return {
      key: 'M1',
      name: 'Swing',
      type: 'strike',
      color: classId === 'paladin' ? '#fde68a' : '#d1d5db',
      damage: classId === 'paladin' ? 28 : 30,
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
      duration: 520,
      autoAttack: true,
    };
  }

  return {
    key: 'M1',
    name: classId === 'priest' ? 'Wand Smite' : 'Wand Bolt',
    type: 'bolt',
    color: classId === 'priest' ? '#fef3c7' : '#8be9fd',
    damage: 24,
    duration: 520,
    autoAttack: true,
  };
}

function getInitialStats(classId) {
  const growth = STAT_GROWTH[classId];
  return {
    health: BASE_STATS.health + growth.health,
    mana: BASE_STATS.mana + growth.mana,
    strength: BASE_STATS.strength + growth.strength,
    agility: BASE_STATS.agility + growth.agility,
    intellect: BASE_STATS.intellect + growth.intellect,
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
  };

  return Object.entries(stats)
    .filter(([, value]) => value)
    .map(([key, value]) => `+${value} ${labels[key] ?? key}`)
    .join(', ');
}

function getItemSellValue(item) {
  const rarityValue = item.rarity === 'Epic' ? 55 : 24;
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
    .filter((item) => item.equippedSlot)
    .reduce((total, item) => addStats(total, item.stats ?? {}), { ...baseStats });

  const selectedSpec = character?.talents?.spec;
  const talentBonuses = selectedSpec ? TALENTS[character.classId]?.specs[selectedSpec]?.bonuses : null;
  return talentBonuses ? addStats(equipmentStats, talentBonuses) : equipmentStats;
}

function normalizeInventory(inventory = []) {
  return inventory.map((item) => ({
    slot: 'trinket',
    stats: item.stats ?? {},
    ...item,
  }));
}

function rollBossLoot() {
  const item = BOSS_LOOT[Math.floor(Math.random() * BOSS_LOOT.length)];
  return {
    ...item,
    id: crypto.randomUUID(),
    foundAt: new Date().toISOString(),
  };
}

function nextBossDelay() {
  return BOSS_SPAWN_MIN + Math.random() * (BOSS_SPAWN_MAX - BOSS_SPAWN_MIN);
}

function getProperties(object) {
  return Object.fromEntries((object.properties ?? []).map((property) => [property.name, property.value]));
}

function parseTsxTileset(xmlText) {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml');
  const tileset = document.querySelector('tileset');
  const image = document.querySelector('image');

  return {
    columns: Number(tileset.getAttribute('columns')),
    tilewidth: Number(tileset.getAttribute('tilewidth')),
    tileheight: Number(tileset.getAttribute('tileheight')),
    imageSource: image.getAttribute('source'),
  };
}

async function loadImage(src) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

function resolveAssetUrl(relativePath, baseUrl = null) {
  const appBaseUrl = new URL(import.meta.env.BASE_URL || './', window.location.href);
  return new URL(relativePath, baseUrl ?? appBaseUrl).href;
}

async function loadTiledMap(mapId = 'world') {
  const cacheBust = `v=${Date.now()}`;
  const fileName = MAP_FILES[mapId] ?? MAP_FILES.world;
  const mapUrl = resolveAssetUrl(`maps/${fileName}`);
  const map = await fetch(`${mapUrl}?${cacheBust}`, { cache: 'no-store' }).then((response) => response.json());
  const tilesets = await Promise.all(
    map.tilesets.map(async (tileset) => {
      const tilesetUrl = resolveAssetUrl(tileset.source, mapUrl);
      const tilesetText = await fetch(`${tilesetUrl}?${cacheBust}`, { cache: 'no-store' }).then((response) => response.text());
      const parsedTileset = parseTsxTileset(tilesetText);
      const imageUrl = resolveAssetUrl(parsedTileset.imageSource, tilesetUrl);
      const image = await loadImage(`${imageUrl}?${cacheBust}`);

      return {
        firstgid: tileset.firstgid,
        ...parsedTileset,
        image,
      };
    }),
  );
  const zonesLayer = map.layers.find((layer) => layer.name === 'Zones');
  const spawnsLayer = map.layers.find((layer) => layer.name === 'Spawns');
  const bossSpawnsLayer = map.layers.find((layer) => layer.name === 'BossSpawns');
  const npcsLayer = map.layers.find((layer) => layer.name === 'NPCs');
  const raceStartsLayer = map.layers.find((layer) => layer.name === 'raceStart');
  const transitionsLayer = map.layers.find((layer) => layer.name === 'Transitions');
  const spawns = [
    ...(spawnsLayer?.objects ?? []),
    ...(bossSpawnsLayer?.objects ?? []),
  ].map((spawn) => ({ ...spawn, props: getProperties(spawn) }));

  return {
    mapId,
    map,
    tilesets,
    zones: (zonesLayer?.objects ?? []).map((zone) => ({ ...zone, props: getProperties(zone) })),
    spawns,
    enemySpawns: spawns.filter((spawn) => spawn.props.enemyType),
    bossSpawns: spawns.filter((spawn) => spawn.props.bossType || spawn.name.toLowerCase().includes('boss')),
    npcs: (npcsLayer?.objects ?? []).map((npc) => ({ ...npc, props: getProperties(npc) })),
    raceStarts: (raceStartsLayer?.objects ?? []).map((start) => ({ ...start, props: getProperties(start) })),
    transitions: (transitionsLayer?.objects ?? []).map((transition) => ({ ...transition, props: getProperties(transition) })),
  };
}

function normalizeCharacter(character) {
  return {
    level: 1,
    xp: 0,
    inventory: [],
    gold: 0,
    stats: getInitialStats(character.classId ?? 'warrior'),
    talents: { spec: null },
    appearance: {},
    ...character,
    inventory: normalizeInventory(character.inventory),
    talents: character.talents ?? { spec: null },
    appearance: character.appearance ?? {},
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

function saveCharacters(characters) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(characters));
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

  return {
    x: object.x,
    y: object.y,
    width: Math.max(object.width ?? 0, 1),
    height: Math.max(object.height ?? 0, 1),
  };
}

function randomPointInBounds(bounds) {
  return {
    x: bounds.x + Math.random() * bounds.width,
    y: bounds.y + Math.random() * bounds.height,
  };
}

function getRaceStartPosition(tiledWorld, raceId) {
  const normalizedRace = String(raceId ?? '').toLowerCase();
  const start = tiledWorld?.raceStarts?.find((candidate) => (
    candidate.name.toLowerCase().includes(normalizedRace)
  )) ?? tiledWorld?.raceStarts?.find((candidate) => (
    candidate.name.toLowerCase().includes('human')
  ));

  if (!start) return { x: 420, y: 420, facing: 0 };

  return {
    x: start.x,
    y: start.y,
    facing: Number(start.props.facing ?? 0),
  };
}

function getCharacterStartPosition(tiledWorld, character) {
  const savedPosition = character?.position;
  if (Number.isFinite(savedPosition?.x) && Number.isFinite(savedPosition?.y)) {
    return {
      x: savedPosition.x,
      y: savedPosition.y,
      facing: Number(savedPosition.facing ?? 0),
    };
  }

  return getRaceStartPosition(tiledWorld, character?.raceId);
}

function createEnemy(id, spawnObject, fallbackPosition) {
  const spawnPoint = randomPointInObject(spawnObject, fallbackPosition);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition);
  return {
    id,
    type: 'enemy',
    state: 'idle',
    spawnName: spawnObject?.name,
    spawnBounds,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: performance.now() + 800 + Math.random() * 1800,
    x: clamp(spawnPoint.x, ENEMY.radius, WORLD.width - ENEMY.radius),
    y: clamp(spawnPoint.y, ENEMY.radius, WORLD.height - ENEMY.radius),
    hp: 100,
    maxHp: 100,
    radius: ENEMY.radius,
    speed: ENEMY.speed,
    xp: ENEMY_XP,
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createBoss(id, spawnObject, fallbackPosition) {
  const spawnPoint = randomPointInObject(spawnObject, fallbackPosition);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition, 620);
  return {
    id,
    type: 'boss',
    name: 'Rift Brute',
    state: 'idle',
    spawnName: spawnObject?.name,
    spawnBounds,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: performance.now() + 1200 + Math.random() * 2200,
    x: clamp(spawnPoint.x, 42, WORLD.width - 42),
    y: clamp(spawnPoint.y, 42, WORLD.height - 42),
    hp: 620,
    maxHp: 620,
    radius: 36,
    speed: 54,
    xp: BOSS_XP,
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function usePressedKeys() {
  const keys = React.useRef(new Set());

  React.useEffect(() => {
    const down = (event) => {
      keys.current.add(event.key.toLowerCase());
    };
    const up = (event) => {
      keys.current.delete(event.key.toLowerCase());
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return keys;
}

function drawPlayer(context, player, selectedClass, selectedRace, appearance = {}) {
  const classConfig = CLASSES[selectedClass];
  const raceConfig = RACES[selectedRace];
  if (!classConfig || !raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return;

  const colors = { ...classConfig.colors, ...appearance };
  const x = player.x;
  const y = player.y;
  const facing = Number.isFinite(player.facing) ? player.facing : 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const sideX = Math.cos(facing + Math.PI / 2);
  const sideY = Math.sin(facing + Math.PI / 2);

  context.save();
  context.translate(x, y);
  context.scale(raceConfig.scale, raceConfig.scale);

  context.fillStyle = 'rgba(0, 0, 0, 0.22)';
  context.beginPath();
  context.ellipse(0, 20, 19, 8, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#1b2834';
  context.lineWidth = 4;
  context.lineCap = 'round';

  context.strokeStyle = colors.trim;
  context.beginPath();
  context.moveTo(-10 * sideX - 2 * fx, -5 * sideY - 2 * fy);
  context.lineTo(-19 * sideX + 9 * fx, -19 * sideY + 9 * fy);
  context.moveTo(10 * sideX - 2 * fx, 10 * sideY - 2 * fy);
  context.lineTo(19 * sideX + 9 * fx, 19 * sideY + 9 * fy);
  context.stroke();

  context.fillStyle = colors.robe;
  context.strokeStyle = '#14212a';
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(-14, -12, 28, 34, 8);
  context.fill();
  context.stroke();

  context.strokeStyle = colors.trim;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(0, 17);
  context.stroke();

  context.fillStyle = appearance.skin ?? raceConfig.skin;
  context.strokeStyle = '#14212a';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, -23, 12, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  if (selectedRace === 'elf') {
    context.fillStyle = appearance.skin ?? raceConfig.skin;
    context.beginPath();
    context.moveTo(-10, -25);
    context.lineTo(-22, -30);
    context.lineTo(-11, -19);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(10, -25);
    context.lineTo(22, -30);
    context.lineTo(11, -19);
    context.closePath();
    context.fill();
  }

  context.fillStyle = appearance.hair ?? (selectedRace === 'human' ? colors.hair : raceConfig.hair);
  context.beginPath();
  context.arc(-2, -29, 11, Math.PI, Math.PI * 2);
  context.fill();

  if (selectedRace === 'dwarf') {
    context.fillStyle = '#7c2d12';
    context.beginPath();
    context.ellipse(0, -14, 9, 8, 0, 0, Math.PI * 2);
    context.fill();
  }

  if (selectedRace === 'orc') {
    context.fillStyle = '#f8fafc';
    context.beginPath();
    context.moveTo(-7, -16);
    context.lineTo(-3, -10);
    context.lineTo(-1, -17);
    context.moveTo(7, -16);
    context.lineTo(3, -10);
    context.lineTo(1, -17);
    context.fill();
  }

  if (selectedRace === 'undead') {
    context.strokeStyle = '#64748b';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-7, -18);
    context.lineTo(7, -18);
    context.moveTo(-5, -12);
    context.lineTo(5, -12);
    context.stroke();
  }

  context.fillStyle = '#101820';
  context.beginPath();
  context.arc(fx * 4 - 4, -23 + fy * 2, 2, 0, Math.PI * 2);
  context.arc(fx * 4 + 4, -23 + fy * 2, 2, 0, Math.PI * 2);
  context.fill();

  if (selectedClass === 'hunter') {
    context.strokeStyle = colors.weapon;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(sideX * 20 + fx * 8, sideY * 20 + fy * 8, 16, -1.1, 1.1);
    context.stroke();
    context.strokeStyle = '#f8fafc';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(sideX * 20 + fx * 8, sideY * 20 + fy * 8 - 15);
    context.lineTo(sideX * 20 + fx * 8, sideY * 20 + fy * 8 + 15);
    context.stroke();
  } else if (selectedClass === 'mage') {
    context.strokeStyle = colors.weapon;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(sideX * 20 - fx * 6, sideY * 20 - fy * 6);
    context.lineTo(sideX * 26 + fx * 22, sideY * 26 + fy * 22);
    context.stroke();
    context.fillStyle = '#67e8f9';
    context.beginPath();
    context.arc(sideX * 26 + fx * 24, sideY * 26 + fy * 24, 5, 0, Math.PI * 2);
    context.fill();
  } else {
    context.strokeStyle = colors.weapon;
    context.lineWidth = selectedClass === 'warrior' ? 5 : 4;
    context.beginPath();
    context.moveTo(sideX * 18 - fx * 2, sideY * 18 - fy * 2);
    context.lineTo(sideX * 24 + fx * 28, sideY * 24 + fy * 28);
    context.stroke();
  }

  context.restore();
}

function CharacterPreview({ character }) {
  const previewRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !character) return;
    const context = canvas.getContext('2d');
    const pixelRatio = window.devicePixelRatio || 1;
    const width = 280;
    const height = 320;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(139, 233, 253, 0.12)');
    gradient.addColorStop(1, 'rgba(246, 241, 223, 0.06)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(width / 2, 190);
    context.scale(2.65, 2.65);
    drawPlayer(
      context,
      { x: 0, y: 0, facing: -Math.PI / 2 },
      character.classId,
      character.raceId,
      character.appearance,
    );
    context.restore();
  }, [character]);

  if (!character) {
    return (
      <div className="character-preview empty">
        <span>Select a character</span>
      </div>
    );
  }

  return (
    <div className="character-preview">
      <canvas ref={previewRef} width="280" height="320" />
      <div className="preview-copy">
        <strong>{character.name || 'Unnamed'}</strong>
        <span>
          Level {character.level ?? 1} {RACES[character.raceId]?.name} {CLASSES[character.classId]?.name}
        </span>
      </div>
    </div>
  );
}

function getDefaultAppearance(raceId, classId) {
  const race = RACES[raceId] ?? RACES.human;
  const classConfig = CLASSES[classId] ?? CLASSES.warrior;
  return {
    skin: race.skin,
    hair: raceId === 'human' ? classConfig.colors.hair : race.hair,
    robe: classConfig.colors.robe,
    trim: classConfig.colors.trim,
  };
}

function drawLocalPlayerMarker(context, player, character) {
  if (!character || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return;

  context.save();
  context.translate(player.x, player.y);

  context.fillStyle = 'rgba(16, 24, 30, 0.78)';
  context.strokeStyle = 'rgba(139, 233, 253, 0.42)';
  context.lineWidth = 1;
  context.fillRect(-70, -78, 140, 34);
  context.strokeRect(-70, -78, 140, 34);

  context.fillStyle = '#f6f1df';
  context.font = '900 12px Inter, Arial';
  context.textAlign = 'center';
  context.fillText(character.name ?? 'You', 0, -64);
  context.fillStyle = '#8be9fd';
  context.font = '800 10px Inter, Arial';
  context.fillText('You', 0, -51);
  context.restore();
}

function drawHealthBar(context, x, y, width, hp, maxHp) {
  const safeMaxHp = Math.max(1, Number(maxHp ?? 1));
  const safeHp = clamp(Number(hp ?? safeMaxHp), 0, safeMaxHp);
  context.fillStyle = 'rgba(15, 23, 42, 0.78)';
  context.fillRect(x, y, width, 5);
  context.fillStyle = '#22c55e';
  context.fillRect(x, y, width * (safeHp / safeMaxHp), 5);
}

function drawRemotePlayerMarker(context, remotePlayer) {
  if (!Number.isFinite(remotePlayer?.x) || !Number.isFinite(remotePlayer?.y)) return;

  context.save();
  context.translate(remotePlayer.x, remotePlayer.y);
  context.fillStyle = 'rgba(16, 24, 30, 0.78)';
  context.strokeStyle = 'rgba(251, 191, 36, 0.42)';
  context.lineWidth = 1;
  context.fillRect(-70, -78, 140, 34);
  context.strokeRect(-70, -78, 140, 34);
  drawHealthBar(context, -60, -42, 120, remotePlayer.hp, remotePlayer.maxHp);
  context.fillStyle = '#f6f1df';
  context.font = '900 12px Inter, Arial';
  context.textAlign = 'center';
  context.fillText(remotePlayer.name ?? 'Adventurer', 0, -64);
  context.fillStyle = '#fbbf24';
  context.font = '800 10px Inter, Arial';
  context.fillText(`Lv ${remotePlayer.level ?? 1}`, 0, -51);
  context.restore();
}

function drawSelectedPlayerRing(context, remotePlayer) {
  if (!Number.isFinite(remotePlayer?.x) || !Number.isFinite(remotePlayer?.y)) return;

  context.save();
  context.translate(remotePlayer.x, remotePlayer.y);
  context.strokeStyle = '#fbbf24';
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(0, 12, 30, 20, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawEnemy(context, enemy, now) {
  const x = Number.isFinite(enemy?.x) ? enemy.x : enemy?.targetX;
  const y = Number.isFinite(enemy?.y) ? enemy.y : enemy?.targetY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  const pulse = Math.sin(now / 180 + (enemy.wobble ?? 0)) * 2;
  const recentlyHit = now - (enemy.hitAt ?? 0) < 140;
  const isBoss = enemy.type === 'boss' || enemy.type === 'dungeon_miniboss' || enemy.type === 'dungeon_final_boss';
  const isAggro = enemy.state === 'aggro';
  const radius = enemy.radius ?? ENEMY.radius;
  const maxHp = enemy.maxHp || (isBoss ? 620 : 100);
  const hp = clamp(enemy.hp ?? maxHp, 0, maxHp);

  context.save();
  context.translate(x, y);

  context.fillStyle = 'rgba(0, 0, 0, 0.24)';
  context.beginPath();
  context.ellipse(0, isBoss ? 34 : 17, isBoss ? 38 : 18, isBoss ? 13 : 7, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = recentlyHit ? '#fecaca' : isBoss ? '#5b21b6' : isAggro ? '#7f1d1d' : '#334155';
  context.strokeStyle = '#2b1111';
  context.lineWidth = isBoss ? 5 : 3;
  context.beginPath();
  context.arc(0, pulse, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = '#fef2f2';
  context.beginPath();
  context.arc(isBoss ? -12 : -6, (isBoss ? -8 : -4) + pulse, isBoss ? 5 : 3, 0, Math.PI * 2);
  context.arc(isBoss ? 12 : 6, (isBoss ? -8 : -4) + pulse, isBoss ? 5 : 3, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#111827';
  context.lineWidth = isBoss ? 4 : 2;
  context.beginPath();
  context.moveTo(isBoss ? -13 : -6, (isBoss ? 12 : 6) + pulse);
  context.lineTo(isBoss ? 13 : 6, (isBoss ? 12 : 6) + pulse);
  context.stroke();

  if (isBoss) {
    context.fillStyle = '#facc15';
    context.beginPath();
    context.moveTo(-18, -30 + pulse);
    context.lineTo(-6, -48 + pulse);
    context.lineTo(0, -28 + pulse);
    context.lineTo(8, -50 + pulse);
    context.lineTo(20, -30 + pulse);
    context.closePath();
    context.fill();
    context.fillStyle = '#f6f1df';
    context.font = '800 13px Inter, Arial';
    context.textAlign = 'center';
    context.fillText(enemy.name, 0, -58);
  }

  context.fillStyle = '#111827';
  context.fillRect(isBoss ? -38 : -18, isBoss ? -44 : -30, isBoss ? 76 : 36, isBoss ? 8 : 5);
  context.fillStyle = '#22c55e';
  context.fillRect(
    isBoss ? -38 : -18,
    isBoss ? -44 : -30,
    (isBoss ? 76 : 36) * (hp / maxHp),
    isBoss ? 8 : 5,
  );

  if (!isAggro) {
    context.fillStyle = '#cbd5e1';
    context.font = '800 12px Inter, Arial';
    context.textAlign = 'center';
    context.fillText('idle', 0, isBoss ? -72 : -39);
  }

  context.restore();
}

function drawTiledLayer(context, layer, tilesets, map, cameraX, cameraY, viewWidth, viewHeight) {
  if (layer.type !== 'tilelayer' || !Array.isArray(layer.data) || !layer.visible) return;

  const startCol = Math.max(0, Math.floor(cameraX / map.tilewidth) - 1);
  const endCol = Math.min(map.width - 1, Math.ceil((cameraX + viewWidth) / map.tilewidth) + 1);
  const startRow = Math.max(0, Math.floor(cameraY / map.tileheight) - 1);
  const endRow = Math.min(map.height - 1, Math.ceil((cameraY + viewHeight) / map.tileheight) + 1);

  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const gid = layer.data[row * layer.width + col];
      if (!gid) continue;

      const tileset = [...tilesets].reverse().find((candidate) => gid >= candidate.firstgid);
      if (!tileset) continue;

      const localId = gid - tileset.firstgid;
      const sourceX = (localId % tileset.columns) * tileset.tilewidth;
      const sourceY = Math.floor(localId / tileset.columns) * tileset.tileheight;
      const targetX = col * map.tilewidth;
      const targetY = row * map.tileheight;

      if (layer.name === 'Ground') {
        context.fillStyle = gid >= 1300 ? '#7d6b58' : '#89945e';
        context.fillRect(targetX, targetY, map.tilewidth, map.tileheight);
      }

      context.drawImage(
        tileset.image,
        sourceX,
        sourceY,
        tileset.tilewidth,
        tileset.tileheight,
        targetX,
        targetY,
        map.tilewidth,
        map.tileheight,
      );
    }
  }
}

function drawTiledZones(context, zones) {
  context.save();
  context.strokeStyle = 'rgba(139, 233, 253, 0.85)';
  context.fillStyle = 'rgba(139, 233, 253, 0.08)';
  context.lineWidth = 3;
  context.font = '800 15px Inter, Arial';
  context.textAlign = 'left';

  zones.forEach((zone) => {
    context.fillRect(zone.x, zone.y, zone.width, zone.height);
    context.strokeRect(zone.x, zone.y, zone.width, zone.height);
    context.fillStyle = '#e0fbff';
    context.fillText(zone.props.displayName ?? zone.name, zone.x + 10, zone.y + 22);
    context.fillStyle = 'rgba(139, 233, 253, 0.08)';
  });

  context.restore();
}

function isTileBlocked(tiledWorld, x, y) {
  const map = tiledWorld?.map;
  const collisionLayer = map?.layers.find((layer) => layer.name === 'Collision');
  if (!map || !collisionLayer?.data) return false;
  if (x < 0 || y < 0 || x >= map.width * map.tilewidth || y >= map.height * map.tileheight) return true;

  const col = Math.floor(x / map.tilewidth);
  const row = Math.floor(y / map.tileheight);
  return Boolean(collisionLayer.data[row * collisionLayer.width + col]);
}

function canMoveTo(tiledWorld, x, y, radius) {
  const points = [
    { x, y },
    { x: x - radius, y },
    { x: x + radius, y },
    { x, y: y - radius },
    { x, y: y + radius },
  ];

  return points.every((point) => !isTileBlocked(tiledWorld, point.x, point.y));
}

function drawShopkeeper(context) {
  drawShopkeeperAt(context, SHOPKEEPER);
}

function drawShopkeeperAt(context, shopkeeper) {
  context.save();
  context.translate(shopkeeper.x, shopkeeper.y);

  context.fillStyle = 'rgba(0, 0, 0, 0.24)';
  context.beginPath();
  context.ellipse(0, 18, 18, 7, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#7c3aed';
  context.strokeStyle = '#1f1235';
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(-13, -8, 26, 31, 7);
  context.fill();
  context.stroke();

  context.fillStyle = '#f0c7a1';
  context.beginPath();
  context.arc(0, -21, 11, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#4b2e1e';
  context.beginPath();
  context.arc(0, -28, 10, Math.PI, Math.PI * 2);
  context.fill();

  context.fillStyle = '#facc15';
  context.font = '900 16px Inter, Arial';
  context.textAlign = 'center';
  context.fillText('$', 0, 10);

  context.fillStyle = '#f6f1df';
  context.font = '800 13px Inter, Arial';
  context.fillText(shopkeeper.name, 0, -42);
  context.fillStyle = '#8be9fd';
  context.font = '800 11px Inter, Arial';
  context.fillText('Shopkeeper', 0, -28);

  context.restore();
}

function pickSpawn(spawns) {
  if (!spawns.length) return null;
  return spawns[Math.floor(Math.random() * spawns.length)];
}

function abilityHitsEnemyClient(ability, origin, facing, enemy) {
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const hitRadius = (enemy.radius ?? ENEMY.radius) + 7;
  const lineEnd = { x: origin.x + fx * 270, y: origin.y + fy * 270 };
  const trapCenter = { x: origin.x + fx * 95, y: origin.y + fy * 95 };

  if (ability.type === 'bolt') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * 220, y: origin.y + fy * 220 }) < hitRadius;
  }
  if (ability.type === 'shot') {
    return distanceToSegment(enemy, origin, lineEnd) < hitRadius - 4;
  }
  if (ability.type === 'trap') {
    return distance(enemy, trapCenter) < 58 + hitRadius;
  }
  if (ability.type === 'strike') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * 110, y: origin.y + fy * 110 }) < 44 + hitRadius;
  }
  if (ability.type === 'cleave') {
    const enemyAngle = Math.atan2(enemy.y - origin.y, enemy.x - origin.x);
    return distance(enemy, origin) < 90 + hitRadius && Math.abs(angleDifference(enemyAngle, facing)) < 1.05;
  }
  if (ability.type === 'channel') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * 280, y: origin.y + fy * 280 }) < hitRadius + 3;
  }

  return distance(enemy, origin) < 118 + hitRadius;
}

function getShopkeeperFromMap(tiledWorld) {
  const npc = tiledWorld?.npcs?.find((candidate) => (
    candidate.props.npcType === 'shopkeeper'
    || candidate.props.type === 'shopkeeper'
    || candidate.name.toLowerCase().includes('shop')
  ));

  if (!npc) return tiledWorld?.mapId === 'world' ? SHOPKEEPER : null;

  return {
    ...SHOPKEEPER,
    x: npc.x + (npc.width ?? 0) / 2,
    y: npc.y + (npc.height ?? 0) / 2,
    name: npc.props.displayName ?? npc.name ?? SHOPKEEPER.name,
    interactRange: Number(npc.props.interactRange ?? SHOPKEEPER.interactRange),
  };
}

function getObjectCenter(object) {
  return {
    x: Number(object?.x ?? 0) + Number(object?.width ?? 0) / 2,
    y: Number(object?.y ?? 0) + Number(object?.height ?? 0) / 2,
  };
}

function pointInObject(point, object) {
  if (!object || !point) return false;
  if (object.point) return distance(point, object) < 42;
  return (
    point.x >= Number(object.x ?? 0)
    && point.x <= Number(object.x ?? 0) + Number(object.width ?? 0)
    && point.y >= Number(object.y ?? 0)
    && point.y <= Number(object.y ?? 0) + Number(object.height ?? 0)
  );
}

function getTransition(tiledWorld, name) {
  return tiledWorld?.transitions?.find((transition) => transition.name === name) ?? null;
}

function hasFinalBossAlive(enemiesList) {
  return enemiesList.some((enemy) => enemy.type === 'dungeon_final_boss');
}

function AuthGate({
  authForm,
  authMode,
  authStatus,
  firebaseReady,
  onAuthChange,
  onAuthModeChange,
  onAuthSubmit,
}) {
  const isRegister = authMode === 'register';

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={(event) => {
        event.preventDefault();
        onAuthSubmit(authMode);
      }}>
        <div>
          <p className="eyebrow">Top-Down MMO Prototype</p>
          <h1>{isRegister ? 'Create Account' : 'Login'}</h1>
        </div>
        <div className="auth-status">
          <Cloud size={18} />
          <span>{authStatus}</span>
        </div>
        <label className="auth-field">
          <span>Email</span>
          <input
            autoComplete="email"
            disabled={!firebaseReady}
            value={authForm.email}
            onChange={(event) => onAuthChange({ ...authForm, email: event.target.value })}
            placeholder="you@example.com"
          />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            disabled={!firebaseReady}
            type="password"
            value={authForm.password}
            onChange={(event) => onAuthChange({ ...authForm, password: event.target.value })}
            placeholder="Minimum 6 characters"
          />
        </label>
        <button className="auth-submit" disabled={!firebaseReady} type="submit">
          {isRegister ? 'Register' : 'Login'}
        </button>
        <button
          className="auth-switch"
          disabled={!firebaseReady}
          type="button"
          onClick={() => onAuthModeChange(isRegister ? 'login' : 'register')}
        >
          {isRegister ? 'Already verified? Login' : 'Need an account? Register'}
        </button>
      </form>
    </main>
  );
}

function CharacterMenu({
  authUser,
  characters,
  onCreate,
  onDelete,
  onEnter,
  onLogout,
}) {
  const [mode, setMode] = React.useState(characters.length > 0 ? 'list' : 'create');
  const [creationStep, setCreationStep] = React.useState('identity');
  const [selectedCharacterId, setSelectedCharacterId] = React.useState(characters[0]?.id ?? null);
  const [name, setName] = React.useState('');
  const [raceId, setRaceId] = React.useState('human');
  const [classId, setClassId] = React.useState('warrior');
  const [appearance, setAppearance] = React.useState(() => getDefaultAppearance('human', 'warrior'));
  const selectedRace = RACES[raceId];
  const selectedCharacter = characters.find((savedCharacter) => savedCharacter.id === selectedCharacterId) ?? characters[0] ?? null;
  const trimmedName = name.trim();
  const nameTaken = isNameTaken(trimmedName, characters);
  const canCreate = trimmedName.length >= 2 && !nameTaken && selectedRace.allowedClasses.includes(classId);
  const draftCharacter = {
    name: trimmedName || 'Unnamed',
    raceId,
    classId,
    appearance,
    level: 1,
  };

  React.useEffect(() => {
    if (!selectedRace.allowedClasses.includes(classId)) {
      const nextClassId = selectedRace.allowedClasses[0];
      setClassId(nextClassId);
      setAppearance(getDefaultAppearance(raceId, nextClassId));
    }
  }, [classId, raceId, selectedRace]);

  React.useEffect(() => {
    if (selectedCharacterId && characters.some((savedCharacter) => savedCharacter.id === selectedCharacterId)) return;
    setSelectedCharacterId(characters[0]?.id ?? null);
    if (characters.length === 0) setMode('create');
  }, [characters, selectedCharacterId]);

  const selectRace = (id) => {
    const race = RACES[id];
    const nextClassId = race.allowedClasses.includes(classId) ? classId : race.allowedClasses[0];
    setRaceId(id);
    setClassId(nextClassId);
    setAppearance(getDefaultAppearance(id, nextClassId));
  };

  const selectClass = (id) => {
    setClassId(id);
    setAppearance(getDefaultAppearance(raceId, id));
  };

  const updateAppearance = (key, value) => {
    setAppearance((current) => ({ ...current, [key]: value }));
  };

  const startCreate = () => {
    setMode('create');
    setCreationStep('identity');
    setName('');
    setRaceId('human');
    setClassId('warrior');
    setAppearance(getDefaultAppearance('human', 'warrior'));
  };

  const createAndReturn = () => {
    if (!canCreate) return;
    onCreate({ name: trimmedName, raceId, classId, appearance });
  };

  return (
    <div className="selection-screen">
      <div className="selection-panel">
        <header className="character-menu-header">
          <div>
            <p className="eyebrow">Character menu</p>
            <h1>{mode === 'create' ? 'Create Your Hero' : 'Choose Your Hero'}</h1>
          </div>
          <button className="auth-button secondary" type="button" onClick={onLogout}>
            Logout
          </button>
        </header>

        <div className="account-panel">
          <div className="auth-status">
            <Cloud size={18} />
            <span>{authUser?.email}</span>
          </div>
        </div>

        <div className="character-menu-layout">
          <aside className="character-list">
            <p className="section-label">Saved characters</p>
            <div className="saved-list">
              {characters.length === 0 && (
                <div className="empty-slot">No characters yet</div>
              )}
              {characters.map((savedCharacter) => {
                const race = RACES[savedCharacter.raceId] ?? RACES.human;
                const classConfig = CLASSES[savedCharacter.classId] ?? CLASSES.warrior;
                const Icon = classConfig.icon;
                return (
                  <div
                    className={`saved-card ${selectedCharacter?.id === savedCharacter.id && mode === 'list' ? 'selected' : ''}`}
                    key={savedCharacter.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setMode('list');
                      setSelectedCharacterId(savedCharacter.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setMode('list');
                      setSelectedCharacterId(savedCharacter.id);
                    }}
                  >
                    <span className={`class-portrait ${savedCharacter.classId}`}>
                      <Icon size={26} />
                    </span>
                    <span>
                      <strong>{savedCharacter.name}</strong>
                      <small>
                        Level {savedCharacter.level ?? 1} {race.name} {classConfig.name}
                      </small>
                    </span>
                    <button
                      className="delete-character"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(savedCharacter.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
            <button className="create-new-character" type="button" onClick={startCreate}>
              Create New Character
            </button>
          </aside>

          {mode === 'list' && (
            <section className="character-preview-panel">
              <CharacterPreview character={selectedCharacter} />
              <div className="preview-actions">
                <button
                  className="create-button"
                  disabled={!selectedCharacter}
                  type="button"
                  onClick={() => selectedCharacter && onEnter(selectedCharacter)}
                >
                  Enter World
                </button>
              </div>
            </section>
          )}

          {mode === 'create' && (
            <section className="character-builder">
              <div className="builder-preview">
                <CharacterPreview character={draftCharacter} />
              </div>

              <div className="builder-fields">
                {creationStep === 'identity' && (
                  <>
                    <p className="section-label">Race</p>
                    <div className="race-grid">
                      {Object.entries(RACES).map(([id, race]) => {
                        const Icon = race.icon;
                        return (
                          <button
                            className={`race-card ${raceId === id ? 'selected' : ''}`}
                            key={id}
                            type="button"
                            onClick={() => selectRace(id)}
                          >
                            <span className="race-icon" style={{ backgroundColor: race.skin }}>
                              <Icon size={24} />
                            </span>
                            <strong>{race.name}</strong>
                          </button>
                        );
                      })}
                    </div>

                    <p className="section-label">Class</p>
                    <div className="class-grid">
                      {Object.entries(CLASSES).map(([id, classConfig]) => {
                        const Icon = classConfig.icon;
                        const isAllowed = selectedRace.allowedClasses.includes(id);
                        return (
                          <button
                            className={`class-card ${classId === id ? 'selected' : ''}`}
                            disabled={!isAllowed}
                            key={id}
                            type="button"
                            onClick={() => selectClass(id)}
                          >
                            <span className={`class-portrait ${id}`}>
                              <Icon size={32} />
                            </span>
                            <strong>{classConfig.name}</strong>
                            <span>
                              {isAllowed
                                ? classConfig.abilities.map((ability) => ability.name).join(' / ')
                                : `${selectedRace.name} cannot be ${classConfig.name}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {creationStep === 'customize' && (
                  <>
                    <p className="section-label">Customize</p>
                    <div className="customization-grid">
                      {Object.entries(CUSTOMIZATION).map(([key, values]) => (
                        <div className="customization-row" key={key}>
                          <strong>{key}</strong>
                          <div>
                            {values.map((value) => (
                              <button
                                className={appearance[key] === value ? 'selected' : ''}
                                key={value}
                                style={{ backgroundColor: value }}
                                type="button"
                                onClick={() => updateAppearance(key, value)}
                                title={value}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {creationStep === 'name' && (
                  <>
                    <p className="section-label">Name</p>
                    <label className="name-field">
                      <span>Character name</span>
                      <input
                        maxLength={18}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Name"
                      />
                      {nameTaken && <em>Name taken</em>}
                    </label>
                  </>
                )}

                <div className="builder-actions">
                  <button
                    className="auth-button secondary"
                    type="button"
                    onClick={() => {
                      if (creationStep === 'identity') {
                        setMode(characters.length > 0 ? 'list' : 'create');
                        return;
                      }
                      setCreationStep(creationStep === 'name' ? 'customize' : 'identity');
                    }}
                  >
                    Back
                  </button>
                  {creationStep !== 'name' ? (
                  <button
                    className="create-button"
                    type="button"
                    onClick={() => setCreationStep(creationStep === 'identity' ? 'customize' : 'name')}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    className="create-button"
                    disabled={!canCreate}
                    type="button"
                    onClick={createAndReturn}
                  >
                    Create
                  </button>
                )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const canvasRef = React.useRef(null);
  const keys = usePressedKeys();
  const player = React.useRef({ x: 420, y: 420, facing: 0 });
  const camera = React.useRef({ x: 0, y: 0 });
  const mouse = React.useRef({ x: 420, y: 420, screenX: 0, screenY: 0 });
  const tiledWorld = React.useRef(null);
  const currentMapIdRef = React.useRef('world');
  const effects = React.useRef([]);
  const enemies = React.useRef([]);
  const nextEnemyId = React.useRef(1);
  const nextSpawnAt = React.useRef(0);
  const nextBossSpawnAt = React.useRef(0);
  const cooldowns = React.useRef({ 1: 0, 2: 0 });
  const selectedClassRef = React.useRef(null);
  const selectedRaceRef = React.useRef(null);
  const characterRef = React.useRef(null);
  const charactersRef = React.useRef([]);
  const lastRenderStatusAt = React.useRef(0);
  const vitalsRef = React.useRef({ hp: BASE_STATS.health, mana: BASE_STATS.mana, fury: 0 });
  const deadRef = React.useRef(false);
  const shopOpenRef = React.useRef(false);
  const lastCombatAt = React.useRef(0);
  const authFlowRef = React.useRef(null);
  const authUserRef = React.useRef(null);
  const colyseusRoomRef = React.useRef(null);
  const colyseusSessionIdRef = React.useRef(null);
  const remotePlayersRef = React.useRef([]);
  const displayedRemotePlayersRef = React.useRef([]);
  const selectedPlayerIdRef = React.useRef(null);
  const lastColyseusInputAt = React.useRef(0);
  const mapTransitioningRef = React.useRef(false);
  const nextAutoAttackAt = React.useRef(0);
  const [characters, setCharacters] = React.useState(() => loadCharacters());
  const [character, setCharacter] = React.useState(null);
  const [position, setPosition] = React.useState(player.current);
  const [vitals, setVitals] = React.useState(vitalsRef.current);
  const [isDead, setIsDead] = React.useState(false);
  const [enemyCount, setEnemyCount] = React.useState(0);
  const [lastCast, setLastCast] = React.useState(null);
  const [inventoryOpen, setInventoryOpen] = React.useState(false);
  const [shopOpen, setShopOpen] = React.useState(false);
  const [talentsOpen, setTalentsOpen] = React.useState(false);
  const [mapStatus, setMapStatus] = React.useState('Loading map...');
  const [currentMapId, setCurrentMapId] = React.useState('world');
  const [authUser, setAuthUser] = React.useState(OFFLINE_DEMO ? OFFLINE_USER : null);
  const [authForm, setAuthForm] = React.useState({ email: '', password: '' });
  const [authMode, setAuthMode] = React.useState('login');
  const [authReady, setAuthReady] = React.useState(OFFLINE_DEMO || !hasFirebaseConfig);
  const [renderStatus, setRenderStatus] = React.useState('Render starting...');
  const [colyseusStatus, setColyseusStatus] = React.useState('Colyseus offline');
  const [selectedPlayerId, setSelectedPlayerId] = React.useState(null);
  const [partyInvite, setPartyInvite] = React.useState(null);
  const [partyMembers, setPartyMembers] = React.useState([]);
  const [authStatus, setAuthStatus] = React.useState(
    OFFLINE_DEMO ? 'Offline demo' : hasFirebaseConfig ? 'Login or create an account' : 'Firebase config missing',
  );

  selectedClassRef.current = character?.classId ?? null;
  selectedRaceRef.current = character?.raceId ?? null;
  characterRef.current = character;
  charactersRef.current = characters;
  authUserRef.current = authUser;
  deadRef.current = isDead;
  shopOpenRef.current = shopOpen;
  selectedPlayerIdRef.current = selectedPlayerId;

  const setVitalsValue = (nextVitals) => {
    vitalsRef.current = {
      ...vitalsRef.current,
      ...nextVitals,
    };
    setVitals(vitalsRef.current);
  };

  const syncCloudCharacter = React.useCallback((updatedCharacter) => {
    if (OFFLINE_DEMO || !authUser) return;

    saveCloudCharacter(authUser.uid, updatedCharacter).catch((error) => {
      setAuthStatus(`Cloud save failed: ${error.message}`);
    });
  }, [authUser]);

  React.useEffect(() => {
    if (OFFLINE_DEMO) return undefined;

    if (!auth) {
      setAuthReady(true);
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setCharacter(null);
        setAuthReady(true);
        setAuthStatus('Login or create an account');
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

      setAuthUser(user);
      setAuthStatus('Loading cloud characters...');
      try {
        const unique = ensureUniqueCharacterNames((await loadCloudCharacters(user.uid)).map(normalizeCharacter));
        setCharacters(unique.characters);
        saveCharacters(unique.characters);
        if (unique.changed) {
          unique.characters.forEach((savedCharacter) => {
            saveCloudCharacter(user.uid, savedCharacter).catch((error) => {
              setAuthStatus(`Cloud rename failed: ${error.message}`);
            });
          });
        }
        setAuthStatus(`Cloud save active: ${user.email}`);
      } catch (error) {
        setAuthStatus(`Cloud load failed: ${error.message}`);
      } finally {
        setAuthReady(true);
      }
    });
  }, []);

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
      }
      setAuthForm({ email: '', password: '' });
    } catch (error) {
      setAuthStatus(error.message);
    } finally {
      authFlowRef.current = null;
    }
  };

  const logoutAuth = async () => {
    if (OFFLINE_DEMO) {
      setCharacter(null);
      setAuthStatus('Offline demo');
      return;
    }

    if (!auth) return;
    await signOut(auth);
  };

  React.useEffect(() => {
    if (!lastCast) return undefined;
    const timer = window.setTimeout(() => setLastCast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [lastCast]);

  const enterCharacter = (nextCharacter) => {
    enemies.current = [];
    effects.current = [];
    nextEnemyId.current = 1;
    nextSpawnAt.current = performance.now() + 700;
    nextBossSpawnAt.current = performance.now() + nextBossDelay();
    cooldowns.current = { 1: 0, 2: 0 };
    player.current = getCharacterStartPosition(tiledWorld.current, nextCharacter);
    const stats = getTotalStats(nextCharacter);
    setVitalsValue({ hp: stats.health, mana: stats.mana, fury: nextCharacter.classId === 'warrior' ? 0 : 0 });
    setIsDead(false);
    deadRef.current = false;
    lastCombatAt.current = 0;
    setEnemyCount(0);
    setLastCast(null);
    setInventoryOpen(false);
    setShopOpen(false);
    setTalentsOpen(false);
    setCharacter(nextCharacter);
  };

  const createCharacter = (newCharacter) => {
    if (isNameTaken(newCharacter.name, charactersRef.current)) {
      setAuthStatus('Name taken');
      return;
    }

    const characterToSave = {
      ...newCharacter,
      id: crypto.randomUUID(),
      level: 1,
      xp: 0,
      stats: getInitialStats(newCharacter.classId),
      inventory: [],
      gold: 0,
      talents: { spec: null },
      createdAt: new Date().toISOString(),
      position: getRaceStartPosition(tiledWorld.current, newCharacter.raceId),
    };
    const nextCharacters = [...characters, characterToSave];
    setCharacters(nextCharacters);
    saveCharacters(nextCharacters);
    syncCloudCharacter(characterToSave);
    enterCharacter(characterToSave);
  };

  const deleteCharacter = (characterId) => {
    const nextCharacters = characters.filter((savedCharacter) => savedCharacter.id !== characterId);
    setCharacters(nextCharacters);
    saveCharacters(nextCharacters);
    if (!OFFLINE_DEMO && authUser) {
      deleteCloudCharacter(authUser.uid, characterId).catch((error) => {
        setAuthStatus(`Cloud delete failed: ${error.message}`);
      });
    }
  };

  const persistCharacter = (updatedCharacter) => {
    const nextCharacters = charactersRef.current.map((savedCharacter) =>
      savedCharacter.id === updatedCharacter.id ? updatedCharacter : savedCharacter,
    );
    setCharacters(nextCharacters);
    saveCharacters(nextCharacters);
    syncCloudCharacter(updatedCharacter);
    setCharacter(updatedCharacter);
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

  const addLoot = (item) => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;

    const updatedCharacter = {
      ...activeCharacter,
      inventory: [...(activeCharacter.inventory ?? []), item],
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    setLastCast(`Loot: ${item.name}`);
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

  const inviteSelectedPlayer = () => {
    const targetId = selectedPlayerIdRef.current;
    if (!targetId || !colyseusRoomRef.current) return;
    colyseusRoomRef.current.send('partyInvite', { targetId });
    setLastCast('Party invite sent');
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

  const targetPartyMember = (member) => {
    if (!member || member.isSelf) return;
    setSelectedPlayerId(member.id);
  };

  const chooseTalentSpec = (specId) => {
    const activeCharacter = characterRef.current;
    const talentTree = activeCharacter ? TALENTS[activeCharacter.classId] : null;
    if (!activeCharacter || !talentTree || (activeCharacter.level ?? 1) < talentTree.unlockLevel) return;

    const updatedCharacter = {
      ...activeCharacter,
      talents: { ...(activeCharacter.talents ?? {}), spec: specId },
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    const stats = getTotalStats(updatedCharacter);
    setVitalsValue({
      hp: Math.min(vitalsRef.current.hp, stats.health),
      mana: Math.min(vitalsRef.current.mana, stats.mana),
      fury: activeCharacter.classId === 'warrior' ? Math.min(vitalsRef.current.fury ?? 0, 100) : 0,
    });
    setLastCast(`Spec: ${talentTree.specs[specId].name}`);
  };

  const killPlayer = () => {
    if (deadRef.current) return;

    deadRef.current = true;
    setIsDead(true);
    setShopOpen(false);
    setInventoryOpen(false);
    setVitalsValue({ ...vitalsRef.current, hp: 0 });
    enemies.current = enemies.current.map((enemy) => ({ ...enemy, state: 'idle' }));
  };

  const respawnPlayer = () => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;

    const stats = getTotalStats(activeCharacter);
    player.current = getRaceStartPosition(tiledWorld.current, activeCharacter.raceId);
    enemies.current = [];
    effects.current = [];
    nextSpawnAt.current = performance.now() + 900;
    nextBossSpawnAt.current = performance.now() + nextBossDelay();
    setVitalsValue({ hp: stats.health, mana: stats.mana, fury: activeCharacter.classId === 'warrior' ? 0 : 0 });
    setEnemyCount(0);
    setIsDead(false);
    deadRef.current = false;
    setLastCast('Respawned');
  };

  const resetToMapStart = () => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;

    const startPosition = getRaceStartPosition(tiledWorld.current, activeCharacter.raceId);
    player.current = startPosition;
    setPosition({ ...startPosition });
    persistCharacter({
      ...activeCharacter,
      position: startPosition,
      updatedAt: new Date().toISOString(),
    });
    setLastCast('Moved to map start');
  };

  const switchMap = React.useCallback(async (nextMapId, spawnName, message) => {
    const loadedMap = await loadTiledMap(nextMapId);
    tiledWorld.current = loadedMap;
    currentMapIdRef.current = nextMapId;
    setCurrentMapId(nextMapId);
    enemies.current = [];
    effects.current = [];
    remotePlayersRef.current = [];
    displayedRemotePlayersRef.current = [];
    setSelectedPlayerId(null);
    setEnemyCount(0);
    setMapStatus(`Map loaded: ${loadedMap.zones.length} zone, ${loadedMap.spawns.length} spawn`);

    const spawn = getTransition(loadedMap, spawnName);
    const nextPosition = spawn
      ? (spawn.point ? { x: spawn.x, y: spawn.y } : getObjectCenter(spawn))
      : { x: PLAYER.radius + 80, y: PLAYER.radius + 80 };
    const safePosition = {
      x: clamp(nextPosition.x, PLAYER.radius, loadedMap.map.width * loadedMap.map.tilewidth - PLAYER.radius),
      y: clamp(nextPosition.y, PLAYER.radius, loadedMap.map.height * loadedMap.map.tileheight - PLAYER.radius),
      facing: player.current.facing,
    };

    player.current = safePosition;
    setPosition({ ...safePosition });
    if (message) setLastCast(message);
  }, []);

  const saveCurrentCharacter = () => {
    if (!character) return;
    const updatedCharacter = {
      ...character,
      position: {
        x: player.current.x,
        y: player.current.y,
        facing: player.current.facing,
      },
      updatedAt: new Date().toISOString(),
    };
    persistCharacter(updatedCharacter);
    setCharacter(null);
    enemies.current = [];
    effects.current = [];
    setEnemyCount(0);
    setInventoryOpen(false);
    setShopOpen(false);
    setTalentsOpen(false);
  };

  React.useEffect(() => {
    let cancelled = false;

    loadTiledMap('world')
      .then((loadedMap) => {
        if (cancelled) return;
        tiledWorld.current = loadedMap;
        currentMapIdRef.current = loadedMap.mapId;
        setCurrentMapId(loadedMap.mapId);
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
      colyseusRoomRef.current?.leave();
      colyseusRoomRef.current = null;
      colyseusSessionIdRef.current = null;
      setColyseusStatus('Colyseus offline');
      return undefined;
    }

    let cancelled = false;
    let reconnectTimer = null;
    let reconnectAttempt = 0;

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
          hp: vitalsRef.current.hp,
          maxHp: joinStats.health,
        });

        room.onMessage('world', (worldState) => {
          const worldPlayers = worldState.players ?? [];
          const localOnlinePlayer = worldPlayers.find((worldPlayer) => worldPlayer.id === room.sessionId) ?? null;
          const currentPartyId = localOnlinePlayer?.partyId ?? null;

          remotePlayersRef.current = worldPlayers
            .filter((remotePlayer) => remotePlayer.id !== room.sessionId)
            .map((remotePlayer) => ({ ...remotePlayer, receivedAt: performance.now() }));

          const nextPartyMembers = currentPartyId
            ? worldPlayers
              .filter((worldPlayer) => worldPlayer.partyId === currentPartyId)
              .map((worldPlayer) => ({
                id: worldPlayer.id,
                name: worldPlayer.name ?? 'Adventurer',
                classId: worldPlayer.classId ?? 'warrior',
                level: worldPlayer.level ?? 1,
                hp: Math.ceil(clamp(worldPlayer.hp ?? worldPlayer.maxHp ?? 1, 0, worldPlayer.maxHp ?? 1)),
                maxHp: Math.max(1, Math.ceil(worldPlayer.maxHp ?? 1)),
                isSelf: worldPlayer.id === room.sessionId,
                isLeader: worldPlayer.partyLeaderId === worldPlayer.id,
              }))
            : [];

          setPartyMembers((currentMembers) => (
            samePartyMembers(currentMembers, nextPartyMembers) ? currentMembers : nextPartyMembers
          ));

          if (
            selectedPlayerIdRef.current
            && !remotePlayersRef.current.some((remotePlayer) => remotePlayer.id === selectedPlayerIdRef.current)
          ) {
            setSelectedPlayerId(null);
          }
          enemies.current = (worldState.enemies ?? []).map((enemy) => ({ ...enemy }));
          setEnemyCount(enemies.current.length);
        });

        room.onMessage('effect', (effect) => {
          const now = performance.now();
          effects.current.push({
            ...effect,
            start: now,
            nextTickAt: effect.type === 'channel' ? now : effect.nextTickAt,
            duration: effect.duration ?? (effect.type === 'channel' ? 3000 : 650),
          });
        });

        room.onMessage('xp', (message) => {
          if (message?.amount) awardExperience(message.amount);
          for (let i = 0; i < (message?.bossKills ?? 0); i += 1) {
            addLoot(rollBossLoot());
          }
        });

        room.onMessage('hit', (message) => {
          const damage = Number(message?.damage ?? 0);
          if (deadRef.current || damage <= 0) return;
          lastCombatAt.current = performance.now();
          const nextHp = Math.max(0, vitalsRef.current.hp - damage);
          setVitalsValue({ ...vitalsRef.current, hp: nextHp });
          setLastCast(`-${damage} HP`);
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

        room.onLeave(() => {
          if (cancelled) return;
          colyseusRoomRef.current = null;
          colyseusSessionIdRef.current = null;
          remotePlayersRef.current = [];
          displayedRemotePlayersRef.current = [];
          setPartyMembers([]);
          reconnectAttempt += 1;
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
        setPartyMembers([]);
        reconnectAttempt += 1;
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
      setPartyMembers([]);
      colyseusRoomRef.current?.leave();
      colyseusRoomRef.current = null;
      colyseusSessionIdRef.current = null;
    };
  }, [character?.id]);

  React.useEffect(() => {
    const applyAbilityDamage = (ability, facing, now) => {
      const origin = { x: player.current.x, y: player.current.y };
      const statBonus = characterRef.current
        ? Math.floor(
            ((getTotalStats(characterRef.current).strength ?? 0)
              + (getTotalStats(characterRef.current).agility ?? 0)
              + (getTotalStats(characterRef.current).intellect ?? 0)) / 8,
          )
        : 0;
      const damage = ability.damage + statBonus;

      const damagedEnemies = enemies.current.map((enemy) => {
          if (!abilityHitsEnemyClient(ability, origin, facing, enemy)) return enemy;
          lastCombatAt.current = now;
          return { ...enemy, state: 'aggro', hp: enemy.hp - damage, hitAt: now };
        });

      const defeatedEnemies = damagedEnemies.filter((enemy) => enemy.hp <= 0);
      enemies.current = damagedEnemies.filter((enemy) => enemy.hp > 0);

      if (defeatedEnemies.length > 0) {
        awardExperience(defeatedEnemies.reduce((total, enemy) => total + (enemy.xp ?? ENEMY_XP), 0));
        defeatedEnemies
          .filter((enemy) => enemy.type === 'boss')
          .forEach(() => addLoot(rollBossLoot()));
      }
      setEnemyCount(enemies.current.length);
    };

    const applyAbilityHealing = (ability) => {
      if (!ability.healing || !characterRef.current) return;

      const stats = getTotalStats(characterRef.current);
      const intellectBonus = Math.floor((stats.intellect ?? 0) / 3);
      const nextHp = Math.min(stats.health, vitalsRef.current.hp + ability.healing + intellectBonus);
      setVitalsValue({ ...vitalsRef.current, hp: nextHp });
    };

    const fireAbility = (slot) => {
      const classId = selectedClassRef.current;
      if (!classId || deadRef.current) return;

      const now = performance.now();
      if (now < cooldowns.current[slot]) return;

      const activeCharacter = characterRef.current;
      const unlockedAbilities = getCharacterAbilities(activeCharacter);
      const ability = unlockedAbilities[slot - 1];
      if (!ability) return;
      const resourceConfig = getResourceConfig(activeCharacter);
      const resourceCost = getAbilityManaCost(ability, activeCharacter);
      if (getCurrentResource(activeCharacter) < resourceCost) {
        setLastCast(`Not enough ${resourceConfig.label.toLowerCase()}`);
        return;
      }
      const facing = Math.atan2(mouse.current.y - player.current.y, mouse.current.x - player.current.x);
      player.current.facing = facing;
      const room = colyseusRoomRef.current;
      const stats = activeCharacter ? getTotalStats(activeCharacter) : BASE_STATS;
      const damage = ability.damage
        ? ability.damage + Math.floor(((stats.strength ?? 0) + (stats.agility ?? 0) + (stats.intellect ?? 0)) / 8)
        : 0;
      const healing = ability.healing
        ? ability.healing + Math.floor((stats.intellect ?? 0) / 3)
        : 0;

      if (ability.type === 'channel') {
        cooldowns.current[slot] = now + (ability.duration ?? 3000) + 800;
        effects.current = effects.current.filter((effect) => effect.type !== 'channel');
        if (room) {
          room.send('ability', {
            ability,
            origin: { x: player.current.x, y: player.current.y },
            facing,
            damage,
            effectOnly: true,
          });
        } else {
          effects.current.push({
            ...ability,
            x: player.current.x,
            y: player.current.y,
            facing,
            start: now,
            nextTickAt: now,
            duration: ability.duration ?? 3000,
            tickRate: ability.tickRate ?? 500,
          });
        }
        setLastCast(`${ability.key}: ${ability.name}`);
        return;
      }

      const nextVitals = {
        ...vitalsRef.current,
        [resourceConfig.key]: Math.max(0, getCurrentResource(activeCharacter) - resourceCost),
      };
      setVitalsValue(nextVitals);
      cooldowns.current[slot] = now + 650;

      if (ability.damage) {
        if (room) {
          room.send('ability', {
            ability,
            origin: { x: player.current.x, y: player.current.y },
            facing,
            damage,
            healing,
          });
        } else {
          applyAbilityDamage(ability, facing, now);
        }
      }
      if (ability.healing) {
        const isTargetedRemoteHeal = Boolean(room && selectedPlayerIdRef.current && ability.type === 'heal');
        if (!isTargetedRemoteHeal) {
          applyAbilityHealing(ability);
        }
        if (room && !ability.damage) {
          room.send('ability', {
            ability,
            origin: { x: player.current.x, y: player.current.y },
            facing,
            healing,
            targetPlayerId: selectedPlayerIdRef.current,
          });
        }
      }
      if (!room) {
        effects.current.push({
          ...ability,
          x: player.current.x,
          y: player.current.y,
          facing,
          start: now,
          duration: ability.type === 'shield' || ability.type === 'heal' ? 900 : 650,
        });
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
      if (event.key.toLowerCase() === 'e' && characterRef.current) {
        const shopkeeper = getShopkeeperFromMap(tiledWorld.current);
        if (shopkeeper && !deadRef.current && distance(player.current, shopkeeper) <= shopkeeper.interactRange) {
          setShopOpen((open) => !open);
          setInventoryOpen(false);
          setLastCast('Shopkeeper: Show me what you found.');
        }
        return;
      }
      if (/^[1-9]$/.test(event.key)) fireAbility(Number(event.key));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let animationFrame = 0;
    let lastTime = performance.now();

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

    const selectPlayerAtMouse = (event) => {
      updateMouse(event);
      const clickedPlayer = [...displayedRemotePlayersRef.current]
        .sort((a, b) => distance(a, mouse.current) - distance(b, mouse.current))
        .find((remotePlayer) => distance(remotePlayer, mouse.current) <= 54);
      if (clickedPlayer) {
        setSelectedPlayerId(clickedPlayer.id);
        return;
      }

      setSelectedPlayerId(null);
      if (!characterRef.current || deadRef.current) return;

      const now = performance.now();
      if (now < nextAutoAttackAt.current) return;
      nextAutoAttackAt.current = now + AUTO_ATTACK_COOLDOWN_MS;

      const activeCharacter = characterRef.current;
      const ability = getAutoAttackAbility(activeCharacter.classId);
      const facing = Math.atan2(mouse.current.y - player.current.y, mouse.current.x - player.current.x);
      player.current.facing = facing;
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

      if (room) {
        room.send('ability', {
          ability,
          origin: { x: player.current.x, y: player.current.y },
          facing,
          damage,
        });
      } else {
        const damagedEnemies = enemies.current.map((enemy) => {
          if (!abilityHitsEnemyClient(ability, player.current, facing, enemy)) return enemy;
          lastCombatAt.current = now;
          return { ...enemy, state: 'aggro', hp: enemy.hp - damage, hitAt: now };
        });
        const defeatedEnemies = damagedEnemies.filter((enemy) => enemy.hp <= 0);
        enemies.current = damagedEnemies.filter((enemy) => enemy.hp > 0);

        if (defeatedEnemies.length > 0) {
          awardExperience(defeatedEnemies.reduce((total, enemy) => total + (enemy.xp ?? ENEMY_XP), 0));
          defeatedEnemies
            .filter((enemy) => enemy.type === 'boss')
            .forEach(() => addLoot(rollBossLoot()));
          setEnemyCount(enemies.current.length);
        }

        effects.current.push({
          ...ability,
          x: player.current.x,
          y: player.current.y,
          facing,
          start: now,
          duration: ability.duration,
        });
      }
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
      context.fillStyle = npc.color;
      context.beginPath();
      context.arc(npc.x, npc.y, 15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#101820';
      context.font = '600 13px Inter, Arial';
      context.textAlign = 'center';
      context.fillText(npc.name, npc.x, npc.y - 24);
    };

    const drawEffect = (effect, now) => {
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
        const trapX = effect.x + fx * 95;
        const trapY = effect.y + fy * 95;
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
      const targets = remotePlayersRef.current;
      const previousDisplays = new globalThis.Map(displayedRemotePlayersRef.current.map((remotePlayer) => [remotePlayer.id, remotePlayer]));
      const amount = clamp(1 - Math.exp(-REMOTE_PLAYER_SMOOTHING * delta), 0, 1);

      displayedRemotePlayersRef.current = targets.map((target) => {
        const previous = previousDisplays.get(target.id);
        const leadSeconds = REMOTE_PLAYER_LEAD_MS / 1000;
        const predictedTarget = {
          ...target,
          x: target.x + Number(target.vx ?? 0) * leadSeconds,
          y: target.y + Number(target.vy ?? 0) * leadSeconds,
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
      const activeMap = tiledWorld.current?.map;
      const worldWidth = activeMap ? activeMap.width * activeMap.tilewidth : WORLD.width;
      const worldHeight = activeMap ? activeMap.height * activeMap.tileheight : WORLD.height;
      const cameraX = clamp(player.current.x - viewWidth / 2, 0, Math.max(0, worldWidth - viewWidth));
      const cameraY = clamp(player.current.y - viewHeight / 2, 0, Math.max(0, worldHeight - viewHeight));
      camera.current.x = cameraX;
      camera.current.y = cameraY;
      mouse.current.x = mouse.current.screenX + cameraX;
      mouse.current.y = mouse.current.screenY + cameraY;

      context.clearRect(0, 0, viewWidth, viewHeight);
      context.save();
      context.translate(-cameraX, -cameraY);

      if (tiledWorld.current) {
        context.fillStyle = '#1f2d2f';
        context.fillRect(0, 0, worldWidth, worldHeight);
        try {
          tiledWorld.current.map.layers
            .filter((layer) => layer.type === 'tilelayer' && layer.name !== 'Collision')
            .forEach((layer) => drawTiledLayer(
              context,
              layer,
              tiledWorld.current.tilesets,
              tiledWorld.current.map,
              cameraX,
              cameraY,
              viewWidth,
              viewHeight,
            ));
          drawTiledZones(context, tiledWorld.current.zones);
        } catch (error) {
          console.error(error);
          setRenderStatus(`Render error: ${error.message}`);
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

      const activeCharacter = characterRef.current;
      if (activeCharacter) {
        try {
          drawPlayer(context, player.current, activeCharacter.classId, activeCharacter.raceId, activeCharacter.appearance);
        } catch (error) {
          console.error(error);
        }
        drawLocalPlayerMarker(context, player.current, activeCharacter);
      }
      const activeShopkeeper = getShopkeeperFromMap(tiledWorld.current);
      if (activeShopkeeper) drawShopkeeperAt(context, activeShopkeeper);
      displayedRemotePlayersRef.current.forEach((remotePlayer) => {
        try {
          if (remotePlayer.id === selectedPlayerIdRef.current) {
            drawSelectedPlayerRing(context, remotePlayer);
          }
          drawPlayer(context, remotePlayer, remotePlayer.classId, remotePlayer.raceId, remotePlayer.appearance);
          drawRemotePlayerMarker(context, remotePlayer);
        } catch (error) {
          console.error(error);
        }
      });
      enemies.current.forEach((enemy) => {
        try {
          drawEnemy(context, enemy, now);
        } catch (error) {
          console.error(error);
        }
      });
      effects.current.forEach((effect) => drawEffect(effect, now));

      context.restore();
    };

    const tick = (now) => {
      try {
        const delta = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        const onlineRoom = colyseusRoomRef.current;
        smoothRemotePlayers(delta);

        if (now - lastRenderStatusAt.current > 700) {
          lastRenderStatusAt.current = now;
          setRenderStatus(
            `Render live ${canvas.clientWidth}x${canvas.clientHeight} | cam ${Math.round(camera.current.x)}, ${Math.round(camera.current.y)}`,
          );
        }

      if (!onlineRoom && selectedClassRef.current && now >= nextSpawnAt.current && enemies.current.length < ENEMY.maxCount) {
        enemies.current.push(createEnemy(nextEnemyId.current, pickSpawn(tiledWorld.current?.enemySpawns ?? []), player.current));
        nextEnemyId.current += 1;
        nextSpawnAt.current = now + ENEMY.spawnEvery;
        setEnemyCount(enemies.current.length);
      }

      const bossAlive = enemies.current.some((enemy) => enemy.type === 'boss');
      if (!onlineRoom && selectedClassRef.current && !bossAlive && now >= nextBossSpawnAt.current) {
        enemies.current.push(createBoss(nextEnemyId.current, pickSpawn(tiledWorld.current?.bossSpawns ?? []), player.current));
        nextEnemyId.current += 1;
        nextBossSpawnAt.current = now + nextBossDelay();
        setEnemyCount(enemies.current.length);
        setLastCast('Boss spawned: Rift Brute');
      }

      let dx = 0;
      let dy = 0;
      if (!deadRef.current) {
        if (keys.current.has('w') || keys.current.has('arrowup')) dy -= 1;
        if (keys.current.has('s') || keys.current.has('arrowdown')) dy += 1;
        if (keys.current.has('a') || keys.current.has('arrowleft')) dx -= 1;
        if (keys.current.has('d') || keys.current.has('arrowright')) dx += 1;
      }

      if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        dx /= length;
        dy /= length;
        player.current.facing = Math.atan2(dy, dx);
        const activeMap = tiledWorld.current?.map;
        const activeWorldWidth = activeMap ? activeMap.width * activeMap.tilewidth : WORLD.width;
        const activeWorldHeight = activeMap ? activeMap.height * activeMap.tileheight : WORLD.height;
        const nextX = clamp(player.current.x + dx * PLAYER.speed * delta, PLAYER.radius, activeWorldWidth - PLAYER.radius);
        const nextY = clamp(player.current.y + dy * PLAYER.speed * delta, PLAYER.radius, activeWorldHeight - PLAYER.radius);

        if (canMoveTo(tiledWorld.current, nextX, player.current.y, PLAYER.radius)) {
          player.current.x = nextX;
        }
        if (canMoveTo(tiledWorld.current, player.current.x, nextY, PLAYER.radius)) {
          player.current.y = nextY;
        }
      }

      if (!mapTransitioningRef.current && characterRef.current && !deadRef.current && tiledWorld.current) {
        const currentMap = currentMapIdRef.current;
        if (currentMap === 'world' && pointInObject(player.current, getTransition(tiledWorld.current, 'dungeon_01_entrance'))) {
          mapTransitioningRef.current = true;
          switchMap('dungeon_01', 'dungeon_01_start', 'Entered dungeon')
            .finally(() => {
              mapTransitioningRef.current = false;
            });
        } else if (currentMap === 'dungeon_01' && pointInObject(player.current, getTransition(tiledWorld.current, 'dungeon_01_exit'))) {
          if (hasFinalBossAlive(enemies.current)) {
            setLastCast('Defeat the final boss first');
          } else {
            mapTransitioningRef.current = true;
            switchMap('world', 'dungeon_01_entrance', 'Dungeon cleared')
              .then(() => {
                player.current.y += 130;
                setPosition({ ...player.current });
              })
              .finally(() => {
                mapTransitioningRef.current = false;
              });
          }
        }
      }

      if (onlineRoom && characterRef.current && now - lastColyseusInputAt.current > COLYSEUS_INPUT_MS) {
        lastColyseusInputAt.current = now;
        const stats = getTotalStats(characterRef.current);
        onlineRoom.send('player', {
          x: player.current.x,
          y: player.current.y,
          facing: player.current.facing,
          name: characterRef.current.name,
          classId: characterRef.current.classId,
          raceId: characterRef.current.raceId,
          appearance: characterRef.current.appearance ?? {},
          level: characterRef.current.level ?? 1,
          talents: characterRef.current.talents ?? { spec: null },
          mapId: currentMapIdRef.current,
          hp: vitalsRef.current.hp,
          maxHp: stats.health,
        });
      }

      if (!onlineRoom) {
        enemies.current = enemies.current.map((enemy) => {
        if (enemy.state !== 'aggro') {
          const bounds = enemy.spawnBounds;
          let target = enemy.wanderTarget;
          const shouldPickNewTarget = !target || now >= enemy.nextWanderAt || distance(enemy, target) < 8;

          if (shouldPickNewTarget) {
            target = randomPointInBounds(bounds);
          }

          const toTargetX = target.x - enemy.x;
          const toTargetY = target.y - enemy.y;
          const length = Math.hypot(toTargetX, toTargetY) || 1;
          const wanderSpeed = enemy.type === 'boss' ? ENEMY.wanderSpeed * 0.65 : ENEMY.wanderSpeed;

          return {
            ...enemy,
            wanderTarget: target,
            nextWanderAt: shouldPickNewTarget ? now + 900 + Math.random() * 2200 : enemy.nextWanderAt,
            x: clamp(
              enemy.x + (toTargetX / length) * wanderSpeed * delta,
              bounds.x + (enemy.radius ?? ENEMY.radius),
              bounds.x + bounds.width - (enemy.radius ?? ENEMY.radius),
            ),
            y: clamp(
              enemy.y + (toTargetY / length) * wanderSpeed * delta,
              bounds.y + (enemy.radius ?? ENEMY.radius),
              bounds.y + bounds.height - (enemy.radius ?? ENEMY.radius),
            ),
          };
        }

        const toPlayerX = player.current.x - enemy.x;
        const toPlayerY = player.current.y - enemy.y;
        const length = Math.hypot(toPlayerX, toPlayerY) || 1;
        const drift = Math.sin(now / 520 + enemy.wobble) * 0.35;
        const dirX = toPlayerX / length;
        const dirY = toPlayerY / length;
        const attackRange = (enemy.radius ?? ENEMY.radius) + PLAYER.radius + 8;
        const nextAttackAt = enemy.nextAttackAt ?? 0;

        if (!deadRef.current && length <= attackRange && now >= nextAttackAt) {
          const damage = enemy.type === 'boss' ? 28 : 9;
          lastCombatAt.current = now;
          const nextHp = Math.max(0, vitalsRef.current.hp - damage);
          setVitalsValue({ ...vitalsRef.current, hp: nextHp });
          setLastCast(`-${damage} HP`);
          if (nextHp <= 0) {
            killPlayer();
          }

          return {
            ...enemy,
            nextAttackAt: now + (enemy.type === 'boss' ? 1100 : 850),
          };
        }

        return {
          ...enemy,
          x: clamp(
            enemy.x + (dirX - dirY * drift) * (enemy.speed ?? ENEMY.speed) * delta,
            enemy.radius ?? ENEMY.radius,
            WORLD.width - (enemy.radius ?? ENEMY.radius),
          ),
          y: clamp(
            enemy.y + (dirY + dirX * drift) * (enemy.speed ?? ENEMY.speed) * delta,
            enemy.radius ?? ENEMY.radius,
            WORLD.height - (enemy.radius ?? ENEMY.radius),
          ),
        };
        });
      }

      effects.current = effects.current
        .map((effect) => {
          if (effect.type !== 'channel' || deadRef.current) return effect;
          if (effect.casterId && effect.casterId !== colyseusSessionIdRef.current) return effect;
          if (now < effect.nextTickAt) return effect;

          const resourceConfig = getResourceConfig(characterRef.current);
          const resourceCost = getAbilityManaCost(effect, characterRef.current);
          if (getCurrentResource(characterRef.current) < resourceCost) {
            setLastCast(`Channel interrupted: no ${resourceConfig.label.toLowerCase()}`);
            return { ...effect, start: 0, duration: 0 };
          }

          setVitalsValue({
            ...vitalsRef.current,
            [resourceConfig.key]: Math.max(0, getCurrentResource(characterRef.current) - resourceCost),
          });

          const fx = Math.cos(effect.facing);
          const fy = Math.sin(effect.facing);
          const start = { x: effect.x, y: effect.y };
          const end = { x: effect.x + fx * 280, y: effect.y + fy * 280 };
          const stats = characterRef.current ? getTotalStats(characterRef.current) : BASE_STATS;
          const damage = effect.damage + Math.floor((stats.intellect ?? 0) / 5);

          if (colyseusRoomRef.current) {
            colyseusRoomRef.current.send('ability', {
              ability: effect,
              origin: start,
              facing: effect.facing,
              damage,
              silent: true,
            });
          } else {
            const damagedEnemies = enemies.current.map((enemy) => {
              const hitRadius = (enemy.radius ?? ENEMY.radius) + 10;
              if (distanceToSegment(enemy, start, end) >= hitRadius) return enemy;
              lastCombatAt.current = now;
              return { ...enemy, state: 'aggro', hp: enemy.hp - damage, hitAt: now };
            });
            const defeatedEnemies = damagedEnemies.filter((enemy) => enemy.hp <= 0);
            enemies.current = damagedEnemies.filter((enemy) => enemy.hp > 0);

            if (defeatedEnemies.length > 0) {
              awardExperience(defeatedEnemies.reduce((total, enemy) => total + (enemy.xp ?? ENEMY_XP), 0));
              defeatedEnemies
                .filter((enemy) => enemy.type === 'boss')
                .forEach(() => addLoot(rollBossLoot()));
              setEnemyCount(enemies.current.length);
            }
          }

          return { ...effect, nextTickAt: now + effect.tickRate };
        })
        .filter((effect) => now - effect.start < effect.duration);
      draw(now);
      setPosition({ ...player.current });

      if (characterRef.current && !deadRef.current) {
        const activeCharacter = characterRef.current;
        const stats = getTotalStats(activeCharacter);
        const resourceConfig = getResourceConfig(activeCharacter);
        const hasNearbyAggro = enemies.current.some((enemy) => (
          enemy.state === 'aggro' && distance(enemy, player.current) < 220
        ));
        const outOfCombat = !hasNearbyAggro && now - lastCombatAt.current > PLAYER.outOfCombatDelay;
        let nextVitals = vitalsRef.current;

        if (resourceConfig.key === 'mana' && nextVitals.mana < stats.mana) {
          nextVitals = {
            ...nextVitals,
            mana: Math.min(stats.mana, nextVitals.mana + PLAYER.manaRegen * delta),
          };
        }
        if (resourceConfig.key === 'fury' && nextVitals.fury > resourceConfig.max) {
          nextVitals = {
            ...nextVitals,
            fury: resourceConfig.max,
          };
        }
        if (outOfCombat && nextVitals.hp < stats.health) {
          nextVitals = {
            ...nextVitals,
            hp: Math.min(stats.health, nextVitals.hp + PLAYER.hpRegen * delta),
          };
        }

        if (nextVitals !== vitalsRef.current) {
          setVitalsValue(nextVitals);
        }
      }
      const shopkeeper = getShopkeeperFromMap(tiledWorld.current);
      if (shopOpenRef.current && (!shopkeeper || distance(player.current, shopkeeper) > shopkeeper.interactRange + 45)) {
        setShopOpen(false);
      }
        animationFrame = requestAnimationFrame(tick);
      } catch (error) {
        console.error(error);
        setRenderStatus(`Loop error: ${error.message}`);
        animationFrame = requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', updateMouse);
    canvas.addEventListener('click', selectPlayerAtMouse);
    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', updateMouse);
      canvas.removeEventListener('click', selectPlayerAtMouse);
    };
  }, [keys]);

  const currentClass = character ? CLASSES[character.classId] : null;
  const currentLevel = character?.level ?? 1;
  const currentXp = character?.xp ?? 0;
  const nextLevelXp = xpForLevel(currentLevel);
  const unlockedAbilities = character ? getCharacterAbilities(character) : [];
  const currentStats = character ? getTotalStats(character) : BASE_STATS;
  const equippedItems = getEquippedItems(character);
  const inventory = character?.inventory ?? [];
  const bagItems = inventory.filter((item) => !item.equippedSlot);
  const gold = character?.gold ?? 0;
  const displayHp = Math.ceil(vitals.hp);
  const resourceConfig = character ? getResourceConfig(character) : { key: 'mana', label: 'Mana', max: BASE_STATS.mana };
  const displayResource = Math.floor(getCurrentResource(character, vitals));
  const resourceMax = Math.max(1, getResourceMax(character, currentStats));
  const activeShopkeeper = getShopkeeperFromMap(tiledWorld.current);
  const nearShopkeeper = character && activeShopkeeper && distance(position, activeShopkeeper) <= activeShopkeeper.interactRange;
  const talentTree = character ? TALENTS[character.classId] : null;
  const selectedTalentSpec = character?.talents?.spec ?? null;
  const selectedPlayer = displayedRemotePlayersRef.current.find((remotePlayer) => remotePlayer.id === selectedPlayerId) ?? null;
  const isLocalPartyLeader = partyMembers.some((member) => member.isSelf && member.isLeader);

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
            onAuthChange={setAuthForm}
            onAuthModeChange={setAuthMode}
            onAuthSubmit={submitAuth}
          />
        )}
        {authReady && authUser && !character && (
          <CharacterMenu
            authUser={authUser}
            characters={characters}
            onCreate={createCharacter}
            onDelete={deleteCharacter}
            onEnter={enterCharacter}
            onLogout={logoutAuth}
          />
        )}
        {character && (
          <div className="hud-actions">
            <button className="menu-button" type="button" onClick={saveCurrentCharacter}>
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
          </div>
        )}
        <div className="hud top-right">
          <Map size={18} />
          <span>
            {Math.round(position.x)}, {Math.round(position.y)} | {gold}g
          </span>
        </div>
        {selectedPlayer && (
          <div className="target-panel">
            <div>
              <strong>{selectedPlayer.name ?? 'Adventurer'}</strong>
              <span>Lv {selectedPlayer.level ?? 1}</span>
            </div>
            <div className="target-hp">
              <span style={{ width: `${(clamp(selectedPlayer.hp ?? selectedPlayer.maxHp, 0, selectedPlayer.maxHp ?? 1) / Math.max(1, selectedPlayer.maxHp ?? 1)) * 100}%` }} />
            </div>
            <button type="button" title="Party invite" onClick={inviteSelectedPlayer}>
              <User size={16} />
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
        {nearShopkeeper && !shopOpen && (
          <div className="interact-prompt">E - Shop</div>
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

              return (
                <div
                  className={`party-member ${member.isSelf ? 'self' : ''} ${selectedPlayerId === member.id ? 'selected' : ''}`}
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
                    <span>Lv {member.level}{member.isSelf ? ' | You' : ''}</span>
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
        {character && inventoryOpen && (
          <aside className="inventory-panel">
            <div className="panel-heading">
              <strong>Inventory</strong>
              <span>C</span>
            </div>
            <div className="stat-grid">
              <span>Health <strong>{currentStats.health}</strong></span>
              <span>{resourceConfig.label} <strong>{resourceMax}</strong></span>
              <span>Strength <strong>{currentStats.strength}</strong></span>
              <span>Agility <strong>{currentStats.agility}</strong></span>
              <span>Intellect <strong>{currentStats.intellect}</strong></span>
            </div>
            <p className="inventory-label">Equipment</p>
            <div className="equipment-grid">
              {EQUIPMENT_SLOTS.map((slot) => {
                const equippedItem = equippedItems[slot.id];
                return (
                  <button
                    className={`equipment-slot ${equippedItem ? equippedItem.rarity.toLowerCase() : ''}`}
                    disabled={!equippedItem}
                    key={slot.id}
                    type="button"
                    onClick={() => unequipSlot(slot.id)}
                  >
                    <span>{slot.label}</span>
                    <strong>{equippedItem?.name ?? 'Empty'}</strong>
                  </button>
                );
              })}
            </div>
            <p className="inventory-label">Bag</p>
            <div className="loot-list">
              {bagItems.length === 0 ? (
                <p>No loot yet. Bosses drop items.</p>
              ) : (
                bagItems.map((item) => (
                  <button
                    className={`loot-item ${item.rarity.toLowerCase()}`}
                    key={item.id}
                    type="button"
                    onClick={() => equipItem(item.id)}
                  >
                    <strong>{item.name}</strong>
                    <span>
                      {item.rarity} | {EQUIPMENT_SLOTS.find((slot) => slot.id === item.slot)?.label ?? item.slot}
                    </span>
                    <small>{formatItemStats(item.stats)}</small>
                  </button>
                ))
              )}
            </div>
          </aside>
        )}
        {character && shopOpen && (
          <aside className="shop-panel">
            <div className="panel-heading">
              <strong>{activeShopkeeper?.name ?? 'Shop'}'s Shop</strong>
              <span>{gold}g</span>
            </div>
            <p className="shop-copy">Sell unwanted loot.</p>
            <div className="loot-list">
              {bagItems.length === 0 ? (
                <p>No unequipped items to sell.</p>
              ) : (
                bagItems.map((item) => (
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
        {character && talentsOpen && (
          <aside className="talent-panel">
            <div className="panel-heading">
              <strong>Talents</strong>
              <span>N</span>
            </div>
            {!talentTree ? (
              <p className="shop-copy">Talents for this class are not ready yet.</p>
            ) : (
              <>
                <p className="shop-copy">
                  {currentLevel >= talentTree.unlockLevel
                    ? 'Choose one specialization.'
                    : `Unlocks at level ${talentTree.unlockLevel}.`}
                </p>
                <div className="talent-tree">
                  {Object.entries(talentTree.specs).map(([specId, spec]) => (
                    <button
                      className={`talent-card ${selectedTalentSpec === specId ? 'selected' : ''}`}
                      disabled={currentLevel < talentTree.unlockLevel}
                      key={specId}
                      type="button"
                      onClick={() => chooseTalentSpec(specId)}
                    >
                      <strong>{spec.name}</strong>
                      <span>{spec.role}</span>
                      <small>{spec.description}</small>
                      <em>{formatItemStats(spec.bonuses)}</em>
                    </button>
                  ))}
                </div>
              </>
            )}
          </aside>
        )}
        {currentClass && (
          <div className="ability-bar">
            {unlockedAbilities.map((ability) => (
              <div className="ability-slot" key={ability.key}>
                <kbd>{ability.key}</kbd>
                <span>{ability.name}</span>
                <small>{getAbilityManaCost(ability, character)} {resourceConfig.label.toLowerCase()}</small>
              </div>
            ))}
            {lastCast && <div className="cast-toast">{lastCast}</div>}
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
