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
  BookOpen,
  Cloud,
  Crosshair,
  Crown,
  DoorOpen,
  Hammer,
  HeartPulse,
  Leaf,
  LogOut,
  Map,
  Monitor,
  Settings,
  Shield,
  Skull,
  Sparkles,
  Sword,
  User,
  UserPlus,
  UserMinus,
  Users,
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
const FRIENDS_KEY = 'mmo-project.friends.v1';
const MAX_LEVEL = 20;
const ENEMY_XP = 35;
const BOSS_XP = 180;
const BOSS_SPAWN_MIN = 18000;
const BOSS_SPAWN_MAX = 34000;
const BOSS_RESPAWN_DELAY = 60000;
const COLYSEUS_INPUT_MS = 50;
const COLYSEUS_RECONNECT_MS = 1800;
const REMOTE_PLAYER_LEAD_MS = 90;
const REMOTE_PLAYER_SMOOTHING = 15;
const REMOTE_PLAYER_SNAP_DISTANCE = 360;
const AUTO_ATTACK_BASE_COOLDOWN_MS = 900;
const AUTO_ATTACK_MIN_COOLDOWN_MS = 360;
const AUTO_ATTACK_MAX_COOLDOWN_MS = 1600;
const BASE_STATS = {
  health: 100,
  mana: 60,
  strength: 5,
  agility: 5,
  intellect: 5,
  attackSpeed: 1,
};

const INVENTORY_CAPACITY = 24;
const ABILITY_BAR_SLOTS = 5;
const TALENT_UNLOCK_LEVEL = 10;

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
  mage: { health: 8, mana: 16, strength: 1, agility: 1, intellect: 4, attackSpeed: 0.01 },
  hunter: { health: 11, mana: 8, strength: 2, agility: 4, intellect: 1, attackSpeed: 0.035 },
  paladin: { health: 14, mana: 10, strength: 3, agility: 1, intellect: 2, attackSpeed: 0.02 },
  warrior: { health: 16, mana: 4, strength: 4, agility: 2, intellect: 0, attackSpeed: 0.025 },
  priest: { health: 9, mana: 15, strength: 1, agility: 1, intellect: 4, attackSpeed: 0.015 },
  rogue: { health: 10, mana: 8, strength: 2, agility: 5, intellect: 1, attackSpeed: 0.055 },
};

const ABILITY_MANA_COST = {
  1: 12,
  2: 18,
  3: 26,
  4: 36,
  5: 48,
  6: 62,
};

const ABILITY_COOLDOWNS = {
  strike: 900,
  cleave: 1200,
  shot: 1100,
  bolt: 1150,
  nova: 2600,
  trap: 3200,
  shield: 4200,
  shout: 3600,
  heal: 1600,
  channel: 4800,
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
  rogue: {
    unlockLevel: 10,
    specs: {
      nightblade: {
        name: 'Nightblade',
        role: 'Damage',
        description: 'Fast openers, poison, and short-range burst.',
        bonuses: { agility: 7, strength: 2, attackSpeed: 0.18 },
        abilities: [
          { key: '1', level: 10, name: 'Shadow Cut', type: 'strike', color: '#c084fc', damage: 104, manaCost: 28 },
          { key: '2', level: 10, name: 'Poison Fan', type: 'cleave', color: '#86efac', damage: 72, manaCost: 30 },
          { key: '3', level: 12, name: 'Backstab', type: 'strike', color: '#d8b4fe', damage: 128, manaCost: 42 },
          { key: '4', level: 16, name: 'Nightfall', type: 'trap', color: '#7c3aed', damage: 146, manaCost: 58 },
        ],
      },
      duelist: {
        name: 'Duelist',
        role: 'Damage',
        description: 'Cleaner rhythm, faster autos, and precise finishers.',
        bonuses: { agility: 5, strength: 4, health: 18, attackSpeed: 0.25 },
        abilities: [
          { key: '1', level: 10, name: 'Twin Slash', type: 'cleave', color: '#f9a8d4', damage: 92, manaCost: 26 },
          { key: '2', level: 10, name: 'Feint Step', type: 'shield', color: '#e9d5ff', damage: 20, manaCost: 22 },
          { key: '3', level: 12, name: 'Piercing Lunge', type: 'shot', color: '#f0abfc', damage: 108, manaCost: 38 },
          { key: '4', level: 16, name: 'Final Flourish', type: 'strike', color: '#f5d0fe', damage: 155, manaCost: 56 },
        ],
      },
    },
  },
};

const TALENT_NODES = [
  {
    id: 'core',
    name: 'Core Discipline',
    maxRank: 3,
    description: 'Improves your main combat stats.',
  },
  {
    id: 'flow',
    name: 'Battle Flow',
    maxRank: 3,
    description: 'Improves resource comfort and attack rhythm.',
  },
  {
    id: 'signature',
    name: 'Signature Technique',
    maxRank: 1,
    requiresSpent: 3,
    description: 'Unlocks a new specialization ability.',
  },
];

const TALENT_SIGNATURE_ABILITIES = {
  mage: {
    arcane: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Arcane Singularity', type: 'trap', color: '#67e8f9', damage: 150, manaCost: 68, cooldown: 7800 },
    frost: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Deep Freeze', type: 'trap', color: '#bae6fd', damage: 132, manaCost: 58, cooldown: 7600 },
  },
  hunter: {
    beastmaster: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Alpha Command', type: 'shout', color: '#bef264', damage: 122, manaCost: 52, cooldown: 7200 },
    survival: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Wildfire Snare', type: 'trap', color: '#fb923c', damage: 148, manaCost: 62, cooldown: 8200 },
  },
  paladin: {
    verdict: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Sunfall Verdict', type: 'shot', color: '#fef08a', damage: 168, manaCost: 72, cooldown: 8200 },
    aegis: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Beacon Wall', type: 'shield', color: '#dbeafe', damage: 52, manaCost: 48, cooldown: 8800 },
  },
  warrior: {
    berserker: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Rampage', type: 'cleave', color: '#fb7185', damage: 156, furyCost: 48, cooldown: 7400 },
    ironward: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Iron Quake', type: 'nova', color: '#cbd5e1', damage: 118, furyCost: 42, cooldown: 8200 },
  },
  priest: {
    void: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Void Eruption', type: 'nova', color: '#7c3aed', damage: 152, manaCost: 72, cooldown: 8600 },
    light: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Radiant Hymn', type: 'heal', color: '#bbf7d0', healing: 190, manaCost: 76, cooldown: 8800 },
  },
  rogue: {
    nightblade: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Shadow Bloom', type: 'trap', color: '#a78bfa', damage: 154, manaCost: 64, cooldown: 7600 },
    duelist: { key: 'T', level: TALENT_UNLOCK_LEVEL, name: 'Perfect Riposte', type: 'strike', color: '#f0abfc', damage: 174, manaCost: 58, cooldown: 6800 },
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
    allowedClasses: ['mage', 'hunter', 'paladin', 'warrior', 'priest', 'rogue'],
  },
  elf: {
    name: 'Elf',
    icon: Leaf,
    skin: '#f0d6ad',
    hair: '#e9d66b',
    scale: 0.96,
    allowedClasses: ['mage', 'hunter', 'priest', 'rogue'],
  },
  dwarf: {
    name: 'Dwarf',
    icon: Hammer,
    skin: '#d6a06f',
    hair: '#9a4f2f',
    scale: 0.88,
    allowedClasses: ['paladin', 'warrior', 'hunter', 'priest', 'rogue'],
  },
  orc: {
    name: 'Orc',
    icon: Sword,
    skin: '#74a85a',
    hair: '#20251f',
    scale: 1.08,
    allowedClasses: ['warrior', 'hunter', 'rogue'],
  },
  undead: {
    name: 'Undead',
    icon: Skull,
    skin: '#cbd5c0',
    hair: '#d8dee9',
    scale: 1,
    allowedClasses: ['mage', 'warrior', 'priest', 'rogue'],
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
  rogue: {
    name: 'Rogue',
    icon: Sword,
    colors: {
      robe: '#312e81',
      trim: '#c084fc',
      hair: '#1f2937',
      weapon: '#e5e7eb',
    },
    abilities: [
      { key: '1', level: 1, name: 'Quick Stab', type: 'strike', color: '#d8b4fe', damage: 44 },
      { key: '2', level: 1, name: 'Blade Fan', type: 'cleave', color: '#a78bfa', damage: 34 },
      { key: '3', level: 4, name: 'Poison Knife', type: 'shot', color: '#86efac', damage: 58 },
      { key: '4', level: 8, name: 'Smoke Bomb', type: 'trap', color: '#94a3b8', damage: 48 },
      { key: '5', level: 12, name: 'Ambush', type: 'strike', color: '#f0abfc', damage: 88 },
      { key: '6', level: 16, name: 'Eviscerate', type: 'shot', color: '#f5d0fe', damage: 118 },
    ],
  },
};

const CLASS_NAME_POOLS = {
  mage: ['Aetherion', 'Lyra Spellwind', 'Vaelis', 'Mira Starfall', 'Eldrin'],
  hunter: ['Rowan Swiftshot', 'Kael Thorn', 'Ashen Vale', 'Nira Wildmark', 'Bryn'],
  paladin: ['Aurel Dawnshield', 'Ser Caldus', 'Tirion Vale', 'Maren Lightward', 'Garran'],
  warrior: ['Brakka Ironhand', 'Duran Steelborn', 'Rokar', 'Hilda Axebreaker', 'Torvik'],
  priest: ['Elowen Lightcall', 'Seren Dawn', 'Iria Solace', 'Neris', 'Calen Vow'],
  rogue: ['Nyx Shade', 'Vera Quickstep', 'Silas Dusk', 'Kira Vex', 'Ren Blackvale'],
};

const CHARACTER_SPRITE_SIZE = 48;
const CHARACTER_SPRITE_DRAW_SIZE = 72;
const CHARACTER_SPRITE_VARIANTS = ['male', 'female'];
const CHARACTER_SPRITE_ROWS = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};
const CHARACTER_SPRITES = new globalThis.Map();
const CHARACTER_SPRITE_LOADS = new globalThis.Map();
const CHARACTER_TINTED_SPRITES = new globalThis.Map();
const CHARACTER_SPRITE_SOURCE_PALETTES = {
  priest: { skin: '#f2c7a4', skinShade: '#d99a72', hair: '#b794f4', robe: '#f8fafc', trim: '#facc15' },
  paladin: { skin: '#f2c7a4', skinShade: '#d99a72', hair: '#facc15', robe: '#f8fafc', trim: '#facc15' },
  hunter: { skin: '#f2c7a4', skinShade: '#d99a72', hair: '#2f221d', robe: '#365c2d', trim: '#d6a354' },
  mage: { skin: '#f2c7a4', skinShade: '#d99a72', hair: '#2563eb', robe: '#1d4ed8', trim: '#facc15' },
  rogue: { skin: '#f2c7a4', skinShade: '#d99a72', hair: '#111827', robe: '#1f2937', trim: '#9ca3af' },
  warrior: { skin: '#f2c7a4', skinShade: '#d99a72', hair: '#8b5a2b', robe: '#7f1d1d', trim: '#cbd5e1' },
};
const CHARACTER_LAYER_ORDER = ['cape', 'base', 'hair', 'beard', 'outfit', 'weapon'];
const CHARACTER_LAYER_DIRS = {
  base: 'base',
  hair: 'hair',
  beard: 'beard',
  outfit: 'outfits',
  weapon: 'weapons',
  cape: 'capes',
};
const CHARACTER_LAYER_IMAGES = new globalThis.Map();
const CHARACTER_LAYER_LOADS = new globalThis.Map();
const ENEMY_SPRITES = new globalThis.Map();
const ENEMY_SPRITE_LOADS = new globalThis.Map();
const ENEMY_SPRITE_CONFIG = {
  wolf: {
    path: 'assets/enemies/wolf.png',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 4,
    drawWidth: 74,
    drawHeight: 74,
    yOffset: -50,
  },
  'elder-briarheart': {
    path: 'assets/enemies/elder-briarheart.png',
    frameWidth: 96,
    frameHeight: 96,
    frameCount: 4,
    drawWidth: 148,
    drawHeight: 148,
    yOffset: -112,
  },
};

const CUSTOMIZATION = {
  skin: ['#f2c7a4', '#d6a06f', '#f0d6ad', '#74a85a', '#cbd5c0'],
  hair: ['#8b5e34', '#f6d365', '#2f221d', '#d8b4fe', '#d8dee9'],
  robe: ['#4263eb', '#2f9e44', '#e6c55c', '#b42318', '#f8fafc'],
  trim: ['#8be9fd', '#f8fafc', '#facc15', '#64748b', '#c084fc'],
};

const APPEARANCE_CHOICES = {
  gender: [
    { id: 'male', label: 'Male' },
    { id: 'female', label: 'Female' },
  ],
  hairStyle: [
    { id: 'short', label: 'Short' },
    { id: 'long', label: 'Long' },
    { id: 'hooded', label: 'Hood' },
  ],
  beard: [
    { id: 'none', label: 'None' },
    { id: 'short', label: 'Short' },
    { id: 'full', label: 'Full' },
  ],
  outfitVariant: [
    { id: 'classic', label: 'Classic' },
    { id: 'veteran', label: 'Veteran' },
    { id: 'dark', label: 'Dark' },
  ],
  weaponVariant: [
    { id: 'classic', label: 'Classic' },
    { id: 'ornate', label: 'Ornate' },
    { id: 'shadow', label: 'Shadow' },
  ],
  capeStyle: [
    { id: 'none', label: 'None' },
    { id: 'short', label: 'Short' },
    { id: 'long', label: 'Long' },
  ],
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

function sameOnlinePlayers(current, next) {
  if (current.length !== next.length) return false;
  return current.every((player, index) => {
    const candidate = next[index];
    return (
      player.id === candidate.id
      && player.name === candidate.name
      && player.classId === candidate.classId
      && player.level === candidate.level
      && player.partyId === candidate.partyId
      && player.partyLeaderId === candidate.partyLeaderId
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

function getAbilityId(ability) {
  return ability ? `${ability.key}:${ability.name}` : '';
}

function resolveAbility(abilities, abilityId) {
  return abilities.find((ability) => getAbilityId(ability) === abilityId)
    ?? abilities.find((ability) => ability.name === abilityId)
    ?? null;
}

function getDefaultAbilitySlots(character) {
  const slots = getCharacterAbilities(character).slice(0, ABILITY_BAR_SLOTS).map(getAbilityId);
  while (slots.length < ABILITY_BAR_SLOTS) slots.push(null);
  return slots;
}

function getTalentRanks(character) {
  return character?.talents?.ranks ?? {};
}

function getTalentNodeKey(specId, nodeId) {
  return `${specId}:${nodeId}`;
}

function getEarnedTalentPoints(character) {
  return Math.max(0, (character?.level ?? 1) - TALENT_UNLOCK_LEVEL + 1);
}

function getSpentTalentPoints(character) {
  return Object.values(getTalentRanks(character)).reduce((total, rank) => total + Number(rank ?? 0), 0);
}

function getAvailableTalentPoints(character) {
  return Math.max(0, getEarnedTalentPoints(character) - getSpentTalentPoints(character));
}

function getSpecSpentPoints(character, specId) {
  const ranks = getTalentRanks(character);
  return TALENT_NODES.reduce((total, node) => total + Number(ranks[getTalentNodeKey(specId, node.id)] ?? 0), 0);
}

function getTalentStatBonuses(character) {
  const selectedSpec = character?.talents?.spec;
  if (!selectedSpec) return {};
  const ranks = getTalentRanks(character);
  const coreRank = Number(ranks[getTalentNodeKey(selectedSpec, 'core')] ?? 0);
  const flowRank = Number(ranks[getTalentNodeKey(selectedSpec, 'flow')] ?? 0);
  const classId = character?.classId;
  const primary = classId === 'mage' || classId === 'priest'
    ? 'intellect'
    : classId === 'hunter' || classId === 'rogue'
      ? 'agility'
      : 'strength';

  return {
    [primary]: coreRank * 2,
    health: coreRank * 8,
    mana: classId === 'warrior' ? 0 : flowRank * 8,
    attackSpeed: flowRank * 0.035,
  };
}

function getTalentSignatureAbility(character) {
  const selectedSpec = character?.talents?.spec;
  if (!selectedSpec) return null;
  const ranks = getTalentRanks(character);
  if (!ranks[getTalentNodeKey(selectedSpec, 'signature')]) return null;
  return TALENT_SIGNATURE_ABILITIES[character.classId]?.[selectedSpec] ?? null;
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

  const abilities = specAbilities && level >= (talentTree?.unlockLevel ?? TALENT_UNLOCK_LEVEL)
    ? specAbilities.filter((ability) => ability.level <= level)
    : getUnlockedAbilities(character.classId, level);
  const signatureAbility = getTalentSignatureAbility(character);
  return signatureAbility ? [...abilities, signatureAbility] : abilities;
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

function getAutoAttackAbility(classId) {
  if (classId === 'warrior' || classId === 'paladin' || classId === 'rogue') {
    return {
      key: 'M1',
      name: classId === 'rogue' ? 'Dagger Slice' : 'Swing',
      type: 'strike',
      color: classId === 'paladin' ? '#fde68a' : classId === 'rogue' ? '#d8b4fe' : '#d1d5db',
      damage: classId === 'paladin' ? 28 : classId === 'rogue' ? 25 : 30,
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
  const equipped = equippedItems?.[item?.slot];
  const diff = Math.round((getItemScore(item) - getItemScore(equipped)) * 10) / 10;
  if (!equipped) return '+ New slot';
  if (diff > 0) return `+${diff} upgrade`;
  if (diff < 0) return `${diff} downgrade`;
  return 'Sidegrade';
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
  const specStats = talentBonuses ? addStats(equipmentStats, talentBonuses) : equipmentStats;
  return addStats(specStats, getTalentStatBonuses(character));
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

function hexToRgb(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) return null;
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function shiftHexColor(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const shifted = rgb.map((channel) => clamp(Math.round(channel * amount), 0, 255));
  return `#${shifted.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function colorDistanceSquared(red, green, blue, target) {
  if (!target) return Number.POSITIVE_INFINITY;
  return (red - target[0]) ** 2 + (green - target[1]) ** 2 + (blue - target[2]) ** 2;
}

function getCharacterSpriteBaseClass(spriteId) {
  if (typeof spriteId !== 'string') return null;
  return spriteId.split('-')[0];
}

function getCharacterSpriteCandidates(selectedClass, appearance = {}) {
  const classId = normalizeCharacterLayerId(selectedClass) ?? 'warrior';
  const gender = normalizeCharacterLayerId(appearance.gender);
  const candidates = [];
  if (gender) candidates.push(`${classId}-${gender}`);
  candidates.push(classId);
  return [...new Set(candidates)];
}

function loadCharacterSprite(spriteId) {
  const baseClassId = getCharacterSpriteBaseClass(spriteId);
  if (!spriteId || !baseClassId || !CLASSES[baseClassId]) return Promise.resolve(null);
  if (CHARACTER_SPRITES.has(spriteId)) return Promise.resolve(CHARACTER_SPRITES.get(spriteId));
  if (CHARACTER_SPRITE_LOADS.has(spriteId)) return CHARACTER_SPRITE_LOADS.get(spriteId);

  const promise = loadImage(resolveAssetUrl(`assets/characters/${spriteId}.png`))
    .then((image) => {
      if (image.naturalWidth !== 192 || image.naturalHeight !== 192) {
        console.warn(`Character spritesheet for ${spriteId} should be 192x192, got ${image.naturalWidth}x${image.naturalHeight}.`);
      }
      CHARACTER_SPRITES.set(spriteId, image);
      return image;
    })
    .catch((error) => {
      console.warn(`Missing character spritesheet for ${spriteId}; using generated fallback.`, error);
      CHARACTER_SPRITES.set(spriteId, null);
      return null;
    });

  CHARACTER_SPRITE_LOADS.set(spriteId, promise);
  return promise;
}

function loadCharacterSprites() {
  const spriteIds = Object.keys(CLASSES).flatMap((classId) => [
    classId,
    ...CHARACTER_SPRITE_VARIANTS.map((variant) => `${classId}-${variant}`),
  ]);
  return Promise.all(spriteIds.map(loadCharacterSprite));
}

function loadEnemySprite(spriteId) {
  const config = ENEMY_SPRITE_CONFIG[spriteId];
  if (!config) return Promise.resolve(null);
  if (ENEMY_SPRITES.has(spriteId)) return Promise.resolve(ENEMY_SPRITES.get(spriteId));
  if (ENEMY_SPRITE_LOADS.has(spriteId)) return ENEMY_SPRITE_LOADS.get(spriteId);

  const promise = loadImage(resolveAssetUrl(config.path))
    .then((image) => {
      ENEMY_SPRITES.set(spriteId, image);
      return image;
    })
    .catch((error) => {
      console.warn(`Missing enemy spritesheet for ${spriteId}; using generated fallback.`, error);
      ENEMY_SPRITES.set(spriteId, null);
      return null;
    });

  ENEMY_SPRITE_LOADS.set(spriteId, promise);
  return promise;
}

function loadEnemySprites() {
  return Promise.all(Object.keys(ENEMY_SPRITE_CONFIG).map(loadEnemySprite));
}

function getEnemySpriteId(enemy) {
  if (enemy?.type === 'boss') return 'elder-briarheart';
  if (enemy?.type === 'enemy' && (enemy.enemyKind ?? 'wolf') === 'wolf') return 'wolf';
  return null;
}

function getEnemySpriteImage(spriteId) {
  if (!spriteId) return null;
  if (!ENEMY_SPRITES.has(spriteId) && !ENEMY_SPRITE_LOADS.has(spriteId)) {
    loadEnemySprite(spriteId);
  }
  return ENEMY_SPRITES.get(spriteId) ?? null;
}

function normalizeCharacterLayerId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  return trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function normalizeOptionalCharacterLayerId(value) {
  const normalized = normalizeCharacterLayerId(value);
  return normalized === 'none' ? null : normalized;
}

function getCharacterLayerSelection(selectedClass, selectedRace, appearance = {}) {
  const classId = normalizeCharacterLayerId(selectedClass) ?? 'warrior';
  const genderId = normalizeCharacterLayerId(appearance.gender) ?? 'male';
  const bodyId = normalizeCharacterLayerId(appearance.body);
  const outfitId = normalizeCharacterLayerId(appearance.outfit);
  const weaponId = normalizeCharacterLayerId(appearance.weapon);
  const outfitVariant = normalizeCharacterLayerId(appearance.outfitVariant) ?? 'classic';
  const weaponVariant = normalizeCharacterLayerId(appearance.weaponVariant) ?? 'classic';
  const raceId = normalizeCharacterLayerId(appearance.race)
    ?? (bodyId && !bodyId.includes('-') ? bodyId : null)
    ?? normalizeCharacterLayerId(selectedRace)
    ?? 'human';

  return {
    base: bodyId && bodyId.includes('-') ? bodyId : `${raceId}-${genderId}`,
    hair: normalizeCharacterLayerId(appearance.hairAsset) ?? normalizeCharacterLayerId(appearance.hairStyle),
    beard: normalizeOptionalCharacterLayerId(appearance.beard),
    outfit: outfitId && outfitId.includes('-') ? outfitId : `${classId}-${outfitVariant}`,
    weapon: weaponId && weaponId.includes('-') ? weaponId : `${classId}-${weaponVariant}`,
    cape: normalizeOptionalCharacterLayerId(appearance.cape) ?? normalizeOptionalCharacterLayerId(appearance.capeStyle),
  };
}

function getCharacterLayerCacheKey(layer, layerId) {
  return `${layer}:${layerId}`;
}

function loadCharacterLayer(layer, layerId) {
  if (!layer || !layerId || !CHARACTER_LAYER_DIRS[layer]) return Promise.resolve(null);

  const cacheKey = getCharacterLayerCacheKey(layer, layerId);
  if (CHARACTER_LAYER_IMAGES.has(cacheKey)) return Promise.resolve(CHARACTER_LAYER_IMAGES.get(cacheKey));
  if (CHARACTER_LAYER_LOADS.has(cacheKey)) return CHARACTER_LAYER_LOADS.get(cacheKey);

  const promise = loadImage(resolveAssetUrl(`assets/characters/${CHARACTER_LAYER_DIRS[layer]}/${layerId}.png`))
    .then((image) => {
      if (image.naturalWidth !== 192 || image.naturalHeight !== 192) {
        console.warn(`Character layer ${cacheKey} should be 192x192, got ${image.naturalWidth}x${image.naturalHeight}.`);
      }
      CHARACTER_LAYER_IMAGES.set(cacheKey, image);
      return image;
    })
    .catch(() => {
      CHARACTER_LAYER_IMAGES.set(cacheKey, null);
      return null;
    });

  CHARACTER_LAYER_LOADS.set(cacheKey, promise);
  return promise;
}

function loadCharacterLayersForAppearance(selectedClass, selectedRace, appearance = {}) {
  const selection = getCharacterLayerSelection(selectedClass, selectedRace, appearance);
  return Promise.all(
    CHARACTER_LAYER_ORDER
      .filter((layer) => selection[layer])
      .map((layer) => loadCharacterLayer(layer, selection[layer])),
  );
}

function getCharacterLayerImage(layer, layerId) {
  if (!layer || !layerId) return null;
  const cacheKey = getCharacterLayerCacheKey(layer, layerId);
  if (!CHARACTER_LAYER_IMAGES.has(cacheKey) && !CHARACTER_LAYER_LOADS.has(cacheKey)) {
    loadCharacterLayer(layer, layerId);
  }
  return CHARACTER_LAYER_IMAGES.get(cacheKey) ?? null;
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
  const graveyardsLayer = map.layers.find((layer) => ['Graveyard', 'Graveyards', 'graveyard'].includes(layer.name));
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
    graveyards: (graveyardsLayer?.objects ?? []).map((graveyard) => ({ ...graveyard, props: getProperties(graveyard) })),
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
    talents: { spec: null, ranks: {}, ...(character.talents ?? {}) },
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

function numberProp(object, name, fallback) {
  const value = Number(object?.props?.[name]);
  return Number.isFinite(value) ? value : fallback;
}

function getSpawnPackId(spawnObject, fallbackId = 'fallback_spawn') {
  return String(spawnObject?.props?.spawnId ?? spawnObject?.name ?? spawnObject?.id ?? fallbackId);
}

function getSpawnEnemyType(spawnObject) {
  const spawnName = String(spawnObject?.name ?? '').toLowerCase();
  return String(spawnObject?.props?.enemyType ?? (spawnName.includes('desert') ? 'scarab' : 'wolf')).toLowerCase();
}

function getSpawnMaxAlive(spawnObject) {
  return Math.max(1, Math.floor(numberProp(spawnObject, 'maxAlive', ENEMY.maxCount)));
}

function getSpawnRespawnMin(spawnObject) {
  return Math.max(1000, numberProp(spawnObject, 'respawnMin', ENEMY.spawnEvery));
}

function getSpawnRespawnMax(spawnObject) {
  return Math.max(getSpawnRespawnMin(spawnObject), numberProp(spawnObject, 'respawnMax', getSpawnRespawnMin(spawnObject)));
}

function getSpawnRespawnDelay(spawnObject) {
  const min = getSpawnRespawnMin(spawnObject);
  const max = getSpawnRespawnMax(spawnObject);
  return min + Math.random() * (max - min);
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
  if (slotIndex % 5 === 0) return 'sentinel';
  if (slotIndex % 3 === 0) return 'roam-pause';
  return 'patrol';
}

function clampPointToBounds(point, bounds, radius = ENEMY.radius) {
  return {
    x: clamp(point.x, bounds.x + radius, bounds.x + bounds.width - radius),
    y: clamp(point.y, bounds.y + radius, bounds.y + bounds.height - radius),
  };
}

function buildPatrolPoints(home, bounds, slotIndex, radius = ENEMY.radius) {
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
  return offsets.map((offset, index) => clampPointToBounds({
    x: home.x + offset.x * direction + (seededUnit(seed, index) - 0.5) * 18,
    y: home.y + offset.y + (seededUnit(seed, index + 10) - 0.5) * 18,
  }, bounds, radius));
}

function makeEnemyMovementState(spawnObject, bounds, slotIndex, maxAlive, radius = ENEMY.radius) {
  const home = clampPointToBounds(pointForSpawnSlot(bounds, slotIndex, maxAlive), bounds, radius);
  const movementMode = getSpawnMovementMode(spawnObject, slotIndex);
  const patrolPoints = movementMode === 'sentinel' ? [home] : buildPatrolPoints(home, bounds, slotIndex, radius);
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

function updateIdleEnemyMovement(enemy, now, delta, isBoss = false) {
  const bounds = enemy.spawnBounds;
  if (!bounds) return enemy;
  const radius = enemy.radius ?? ENEMY.radius;
  const mode = enemy.movementMode ?? 'patrol';
  let target = enemy.wanderTarget;
  let patrolIndex = enemy.patrolIndex ?? 0;
  let pauseUntil = enemy.pauseUntil ?? 0;
  let nextWanderAt = enemy.nextWanderAt ?? 0;
  const patrolPoints = enemy.patrolPoints?.length ? enemy.patrolPoints : [enemy.home ?? randomPointInBounds(bounds)];

  if (mode === 'sentinel') {
    if (!target || now >= nextWanderAt || distance(enemy, target) < 5) {
      const home = enemy.home ?? patrolPoints[0];
      target = clampPointToBounds({
        x: home.x + (seededUnit(`${enemy.id}:${Math.floor(now / 1000)}`, 1) - 0.5) * 34,
        y: home.y + (seededUnit(`${enemy.id}:${Math.floor(now / 1000)}`, 2) - 0.5) * 34,
      }, bounds, radius);
      nextWanderAt = now + 3000 + Math.random() * 4000;
    }
  } else if (mode === 'roam-pause') {
    if (pauseUntil > now && target && distance(enemy, target) < 10) {
      return { ...enemy, pauseUntil };
    }
    if (!target || distance(enemy, target) < 10 || now >= nextWanderAt) {
      patrolIndex = (patrolIndex + 1) % patrolPoints.length;
      target = patrolPoints[patrolIndex];
      pauseUntil = now + 900 + Math.random() * 1900;
      nextWanderAt = now + 6500 + Math.random() * 2500;
    }
  } else if (!target || distance(enemy, target) < 10 || now >= nextWanderAt) {
    patrolIndex = (patrolIndex + 1) % patrolPoints.length;
    target = patrolPoints[patrolIndex];
    nextWanderAt = now + 9000 + Math.random() * 3000;
  }

  const toTargetX = target.x - enemy.x;
  const toTargetY = target.y - enemy.y;
  const length = Math.hypot(toTargetX, toTargetY) || 1;
  const speedMultiplier = mode === 'sentinel' ? 0.24 : mode === 'roam-pause' ? 0.52 : 0.78;
  const wanderSpeed = (isBoss ? ENEMY.wanderSpeed * 0.65 : ENEMY.wanderSpeed) * speedMultiplier;

  return {
    ...enemy,
    wanderTarget: target,
    patrolIndex,
    pauseUntil,
    nextWanderAt,
    x: clamp(enemy.x + (toTargetX / length) * wanderSpeed * delta, bounds.x + radius, bounds.x + bounds.width - radius),
    y: clamp(enemy.y + (toTargetY / length) * wanderSpeed * delta, bounds.y + radius, bounds.y + bounds.height - radius),
  };
}

function createWorldSpawnPacks(spawns = []) {
  const sourceSpawns = spawns.length
    ? spawns
    : [{ x: 720, y: 520, width: 420, height: 320, name: 'fallback_spawn' }];

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

function getGraveyardPosition(tiledWorld, character) {
  return getNearestGraveyardPosition(tiledWorld, character?.position, character);
}

function createEnemy(id, spawnObject, fallbackPosition, spawnSlot = 0, maxAlive = getSpawnMaxAlive(spawnObject)) {
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition);
  const enemyKind = getSpawnEnemyType(spawnObject);
  const movement = makeEnemyMovementState(spawnObject, spawnBounds, spawnSlot, maxAlive, ENEMY.radius);
  const spawnPoint = movement.home;
  return {
    id,
    type: 'enemy',
    enemyKind,
    state: 'idle',
    spawnName: spawnObject?.name,
    spawnId: getSpawnPackId(spawnObject),
    spawnSlot,
    spawnBounds,
    ...movement,
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
    name: 'Elder Briarheart',
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

function pixelRect(context, x, y, width, height, color) {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function pixelLine(context, fromX, fromY, toX, toY, size, color, steps = 10) {
  for (let index = 0; index <= steps; index += 1) {
    const amount = index / steps;
    pixelRect(
      context,
      fromX + (toX - fromX) * amount - size / 2,
      fromY + (toY - fromY) * amount - size / 2,
      size,
      size,
      color,
    );
  }
}

function isRangedClass(classId) {
  return ['hunter', 'mage', 'priest'].includes(classId);
}

function drawCharacterAttackOverlay(context, player, selectedClass) {
  const attack = player?.attack;
  const now = performance.now();
  if (!attack || !Number.isFinite(attack.startedAt) || now > attack.until) return;

  const duration = Math.max(1, attack.until - attack.startedAt);
  const progress = clamp((now - attack.startedAt) / duration, 0, 1);
  const facing = Number.isFinite(attack.facing) ? attack.facing : player.facing ?? 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const sideX = Math.cos(facing + Math.PI / 2);
  const sideY = Math.sin(facing + Math.PI / 2);
  const ranged = isRangedClass(selectedClass) || attack.ranged || attack.autoAttack && selectedClass === 'hunter';
  const color = selectedClass === 'priest'
    ? '#fef08a'
    : selectedClass === 'mage'
      ? '#7dd3fc'
      : selectedClass === 'hunter'
        ? '#fbbf24'
        : selectedClass === 'rogue'
          ? '#e5e7eb'
          : '#f8fafc';

  context.save();
  context.translate(player.x, player.y - 22);
  context.globalAlpha = 1 - progress * 0.28;
  context.imageSmoothingEnabled = false;

  if (ranged) {
    const length = 22 + progress * 42;
    const startX = fx * 12 + sideX * 8;
    const startY = fy * 12 + sideY * 8;
    const endX = fx * length + sideX * 8;
    const endY = fy * length + sideY * 8;
    pixelLine(context, startX, startY, endX, endY, 4, 'rgba(0, 0, 0, 0.32)', 14);
    pixelLine(context, startX, startY, endX, endY, 2, color, 14);
    pixelRect(context, endX - 3, endY - 3, 6, 6, color);
  } else {
    const reach = 30 + Math.sin(progress * Math.PI) * 18;
    const arcCenterX = fx * reach;
    const arcCenterY = fy * reach;
    for (let step = -4; step <= 4; step += 1) {
      const sx = sideX * step * 4;
      const sy = sideY * step * 4;
      pixelRect(context, arcCenterX + sx - 3, arcCenterY + sy - 3, 6, 6, 'rgba(0, 0, 0, 0.25)');
      pixelRect(context, arcCenterX + sx - 2, arcCenterY + sy - 2, 4, 4, color);
    }
  }

  context.restore();
}

function drawPixelCross(context, x, y, size, color) {
  pixelRect(context, x - size / 2, y - size * 1.5, size, size * 3, color);
  pixelRect(context, x - size * 1.5, y - size / 2, size * 3, size, color);
}

const CHARACTER_SPRITE_FRAMES = [
  { leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, bodyBob: 0 },
  { leftLeg: 3, rightLeg: -2, leftArm: -2, rightArm: 2, bodyBob: -1 },
  { leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, bodyBob: 0 },
  { leftLeg: -2, rightLeg: 3, leftArm: 2, rightArm: -2, bodyBob: -1 },
];

const CLASS_SPRITE_DETAILS = {
  mage: { collar: '#67e8f9', dark: '#312e81', weapon: 'staff', glow: '#67e8f9' },
  hunter: { collar: '#bef264', dark: '#7c4a22', weapon: 'bow', glow: '#fde68a' },
  paladin: { collar: '#fef08a', dark: '#facc15', weapon: 'hammer-shield', glow: '#fef08a' },
  warrior: { collar: '#94a3b8', dark: '#475569', weapon: 'greatsword', glow: '#f8fafc' },
  priest: { collar: '#e0e7ff', dark: '#f8fafc', weapon: 'staff', glow: '#fef08a' },
  rogue: { collar: '#111827', dark: '#1f2937', weapon: 'daggers', glow: '#c084fc' },
};

function getCharacterAnimationFrame(player) {
  const moving = Math.abs(player?.vx ?? 0) + Math.abs(player?.vy ?? 0) > 0.05;
  if (!moving) return CHARACTER_SPRITE_FRAMES[0];
  const frameIndex = Math.floor(performance.now() / 120) % CHARACTER_SPRITE_FRAMES.length;
  return CHARACTER_SPRITE_FRAMES[frameIndex];
}

function getCharacterSpriteDirection(player) {
  const facing = Number.isFinite(player?.facing) ? player.facing : 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  if (Math.abs(fy) > Math.abs(fx)) return fy < 0 ? 'up' : 'down';
  return fx < 0 ? 'left' : 'right';
}

function getCharacterSpriteColumn(player) {
  const moving = Math.abs(player?.vx ?? 0) + Math.abs(player?.vy ?? 0) > 0.05;
  if (!moving) return 0;
  const walkFrame = Math.floor(performance.now() / 120) % 3;
  return walkFrame + 1;
}

function drawCharacterSpriteFrame(context, image, player, selectedRace, row, column) {
  const raceConfig = RACES[selectedRace];
  if (!image || !raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return false;

  const size = CHARACTER_SPRITE_DRAW_SIZE * raceConfig.scale * (selectedRace === 'dwarf' ? 0.96 : selectedRace === 'orc' ? 1.06 : 1);
  context.drawImage(
    image,
    column * CHARACTER_SPRITE_SIZE,
    row * CHARACTER_SPRITE_SIZE,
    CHARACTER_SPRITE_SIZE,
    CHARACTER_SPRITE_SIZE,
    Math.round(player.x - size / 2),
    Math.round(player.y - size + 18),
    Math.round(size),
    Math.round(size),
  );
  return true;
}

function drawCharacterLayeredSprite(context, player, selectedClass, selectedRace, appearance = {}) {
  const raceConfig = RACES[selectedRace];
  if (!raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return false;

  const selection = getCharacterLayerSelection(selectedClass, selectedRace, appearance);
  const baseLayer = getCharacterLayerImage('base', selection.base);
  const outfitLayer = getCharacterLayerImage('outfit', selection.outfit);
  if (!baseLayer || !outfitLayer) return false;

  const direction = getCharacterSpriteDirection(player);
  const row = CHARACTER_SPRITE_ROWS[direction] ?? CHARACTER_SPRITE_ROWS.down;
  const column = getCharacterSpriteColumn(player);

  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;
  for (const layer of CHARACTER_LAYER_ORDER) {
    const layerImage = getCharacterLayerImage(layer, selection[layer]);
    if (layerImage) drawCharacterSpriteFrame(context, layerImage, player, selectedRace, row, column);
  }
  context.imageSmoothingEnabled = previousSmoothing;
  return true;
}

function getCharacterSpriteImage(selectedClass, appearance = {}) {
  for (const spriteId of getCharacterSpriteCandidates(selectedClass, appearance)) {
    if (!CHARACTER_SPRITES.has(spriteId) && !CHARACTER_SPRITE_LOADS.has(spriteId)) {
      loadCharacterSprite(spriteId);
    }
    const image = CHARACTER_SPRITES.get(spriteId);
    if (image) return { image, spriteId };
  }
  return null;
}

function getTintedCharacterSpriteImage(sourceImage, spriteId, selectedClass, appearance = {}) {
  const palette = CHARACTER_SPRITE_SOURCE_PALETTES[selectedClass];
  if (!sourceImage || !palette) return sourceImage;

  const tintValues = {
    skin: appearance.skin,
    hair: appearance.hair,
    robe: appearance.robe,
    trim: appearance.trim,
  };
  const tintKey = `${spriteId}|${Object.entries(tintValues).map(([key, value]) => `${key}:${value ?? ''}`).join('|')}`;
  if (CHARACTER_TINTED_SPRITES.has(tintKey)) return CHARACTER_TINTED_SPRITES.get(tintKey);

  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.naturalWidth || sourceImage.width || 192;
  canvas.height = sourceImage.naturalHeight || sourceImage.height || 192;
  const spriteContext = canvas.getContext('2d');
  spriteContext.imageSmoothingEnabled = false;
  spriteContext.drawImage(sourceImage, 0, 0);

  const imageData = spriteContext.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const sources = {
    skin: hexToRgb(palette.skin),
    skinShade: hexToRgb(palette.skinShade),
    hair: hexToRgb(palette.hair),
    robe: hexToRgb(palette.robe),
    trim: hexToRgb(palette.trim),
  };
  const targets = {
    skin: hexToRgb(appearance.skin),
    skinShade: hexToRgb(shiftHexColor(appearance.skin, 0.78)),
    hair: hexToRgb(appearance.hair),
    robe: hexToRgb(appearance.robe),
    trim: hexToRgb(appearance.trim),
  };
  const replacements = [
    ['skinShade', 18],
    ['skin', 18],
    ['hair', 22],
    ['robe', 22],
    ['trim', 20],
  ];

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    for (const [key, threshold] of replacements) {
      const target = targets[key];
      if (!target) continue;
      if (colorDistanceSquared(data[index], data[index + 1], data[index + 2], sources[key]) > threshold ** 2) continue;
      data[index] = target[0];
      data[index + 1] = target[1];
      data[index + 2] = target[2];
      break;
    }
  }

  spriteContext.putImageData(imageData, 0, 0);
  CHARACTER_TINTED_SPRITES.set(tintKey, canvas);
  return canvas;
}

function drawCharacterAssetSprite(context, player, selectedClass, selectedRace, appearance = {}) {
  if (drawCharacterLayeredSprite(context, player, selectedClass, selectedRace, appearance)) return true;

  const sprite = getCharacterSpriteImage(selectedClass, appearance);
  const raceConfig = RACES[selectedRace];
  if (!sprite?.image || !raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return false;

  const direction = getCharacterSpriteDirection(player);
  const row = CHARACTER_SPRITE_ROWS[direction] ?? CHARACTER_SPRITE_ROWS.down;
  const column = getCharacterSpriteColumn(player);
  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;
  const image = getTintedCharacterSpriteImage(sprite.image, sprite.spriteId, selectedClass, appearance);
  drawCharacterSpriteFrame(context, image, player, selectedRace, row, column);
  context.imageSmoothingEnabled = previousSmoothing;
  return true;
}

function drawPixelPlayerSprite(context, player, selectedClass, selectedRace, appearance = {}) {
  const classConfig = CLASSES[selectedClass];
  const raceConfig = RACES[selectedRace];
  if (!classConfig || !raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return;

  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;

  const colors = { ...classConfig.colors, ...appearance };
  const skin = appearance.skin ?? raceConfig.skin;
  const hair = appearance.hair ?? (selectedRace === 'human' ? colors.hair : raceConfig.hair);
  const body = appearance.robe ?? colors.robe;
  const trim = appearance.trim ?? colors.trim;
  const weapon = colors.weapon ?? '#e5e7eb';
  const facing = Number.isFinite(player.facing) ? player.facing : 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const direction = Math.abs(fy) > Math.abs(fx)
    ? (fy < 0 ? 'back' : 'front')
    : (fx < 0 ? 'left' : 'right');
  const isBack = direction === 'back';
  const isSide = direction === 'left' || direction === 'right';
  const sideSign = direction === 'left' ? -1 : 1;
  const sideX = Math.cos(facing + Math.PI / 2);
  const sideY = Math.sin(facing + Math.PI / 2);
  const now = performance.now();
  const frame = getCharacterAnimationFrame(player);
  const idleBreath = Math.round(Math.sin(now / 420 + player.x * 0.01) * 1);
  const bob = frame.bodyBob + idleBreath;
  const outline = '#101820';
  const shade = 'rgba(0, 0, 0, 0.26)';
  const scaleY = selectedRace === 'dwarf' ? 0.9 : 1;
  const spriteScale = selectedRace === 'dwarf' ? 1.12 : 1.18;
  const classSprite = CLASS_SPRITE_DETAILS[selectedClass] ?? CLASS_SPRITE_DETAILS.warrior;
  const highlight = selectedClass === 'priest'
    ? '#f8fafc'
    : selectedClass === 'mage'
      ? '#a5f3fc'
      : selectedClass === 'hunter'
        ? '#bef264'
        : selectedClass === 'paladin'
          ? '#fef08a'
          : selectedClass === 'rogue'
            ? '#c084fc'
            : '#cbd5e1';

  context.save();
  context.translate(player.x, player.y + bob);
  context.scale(raceConfig.scale * spriteScale, raceConfig.scale * scaleY * spriteScale);

  pixelRect(context, -18, 21, 36, 7, shade);

  const leftStep = frame.leftLeg;
  const rightStep = frame.rightLeg;
  pixelRect(context, -12, 12, 8, 18 + leftStep, outline);
  pixelRect(context, 4, 12, 8, 18 + rightStep, outline);
  pixelRect(context, -10, 13, 5, 14 + leftStep, trim);
  pixelRect(context, 5, 13, 5, 14 + rightStep, trim);
  pixelRect(context, -11, 27 + leftStep, 8, 4, outline);
  pixelRect(context, 3, 27 + rightStep, 10, 4, outline);

  pixelRect(context, -18, -15, 36, 38, outline);
  pixelRect(context, -14, -11, 28, 32, body);
  pixelRect(context, -8, -5, 16, 24, selectedClass === 'rogue' ? '#111827' : body);
  if (isSide) {
    pixelRect(context, -13 * sideSign, -12, 24 * sideSign, 34, outline);
    pixelRect(context, -10 * sideSign, -9, 18 * sideSign, 28, body);
    pixelRect(context, -4 * sideSign, -7, 7 * sideSign, 26, trim);
  }
  pixelRect(context, -10, -8, 7, 27, 'rgba(255, 255, 255, 0.12)');
  pixelRect(context, 7, -8, 4, 25, 'rgba(0, 0, 0, 0.16)');
  pixelRect(context, -10, 5, 20, 4, trim);
  pixelRect(context, -3, -9, 6, 30, trim);
  if (isBack) {
    pixelRect(context, -13, -10, 26, 31, body);
    pixelRect(context, -3, -8, 6, 28, trim);
    pixelRect(context, -15, 16, 30, 6, trim);
  }
  pixelRect(context, -20, -13, 9, 10, outline);
  pixelRect(context, 11, -13, 9, 10, outline);
  pixelRect(context, -18, -11, 7, 7, highlight);
  pixelRect(context, 11, -11, 7, 7, highlight);
  pixelRect(context, -14, -15, 28, 4, classSprite.collar);

  if (selectedClass === 'paladin') {
    pixelRect(context, -15, -11, 30, 14, '#fef08a');
    pixelRect(context, -11, -8, 22, 8, body);
    if (isBack) {
      pixelRect(context, -4, -5, 8, 22, '#fef08a');
      pixelRect(context, -10, 2, 20, 5, '#fef08a');
    }
  }
  if (selectedClass === 'warrior') {
    pixelRect(context, -15, -11, 30, 13, '#94a3b8');
    pixelRect(context, -9, -7, 18, 7, body);
    if (isBack) {
      pixelRect(context, -16, 4, 32, 24, '#7f1d1d');
      pixelRect(context, -5, 9, 10, 12, '#f59e0b');
    }
  }
  if (selectedClass === 'priest') {
    pixelRect(context, -14, -10, 28, 5, '#e0e7ff');
    pixelRect(context, -4, 9, 8, 10, '#f8fafc');
    pixelRect(context, -16, 19, 32, 5, '#e0e7ff');
    if (isBack) {
      pixelRect(context, -3, -2, 6, 22, '#facc15');
      pixelRect(context, -9, 7, 18, 4, '#facc15');
    }
  }
  if (selectedClass === 'mage') {
    pixelRect(context, -13, -11, 26, 5, '#67e8f9');
    pixelRect(context, -8, 10, 16, 5, '#dbeafe');
    pixelRect(context, -15, 18, 30, 5, '#312e81');
    if (isBack) {
      pixelRect(context, -15, -17, 30, 9, '#1d4ed8');
      pixelRect(context, -12, -25, 24, 11, '#1e3a8a');
    }
  }
  if (selectedClass === 'hunter') {
    pixelRect(context, -14, -10, 28, 5, '#bef264');
    pixelRect(context, -12, 10, 24, 5, '#7c4a22');
    if (isBack) {
      pixelRect(context, -17, -14, 34, 17, '#2f5f2d');
      pixelLine(context, -18, 16, 13, -18, 4, '#7c4a22', 10);
    }
  }
  if (selectedClass === 'rogue') {
    pixelRect(context, -13, -12, 26, 9, '#111827');
    pixelRect(context, -14, 5, 28, 7, '#1f2937');
    pixelRect(context, -10, 16, 20, 8, '#111827');
    pixelRect(context, -16, -2, 5, 22, '#111827');
    pixelRect(context, 11, -2, 5, 22, '#111827');
  }

  pixelRect(context, -21, -5, 7, 20 + frame.leftArm, outline);
  pixelRect(context, 14, -5, 7, 20 + frame.rightArm, outline);
  pixelRect(context, -19, -4, 4, 16 + frame.leftArm, trim);
  pixelRect(context, 15, -4, 4, 16 + frame.rightArm, trim);

  const headY = -30;
  if (selectedRace === 'elf') {
    if (!isBack) {
      pixelRect(context, -23, headY - 2, 10, 5, outline);
      pixelRect(context, 13, headY - 2, 10, 5, outline);
      pixelRect(context, -24, headY - 1, 9, 3, skin);
      pixelRect(context, 15, headY - 1, 9, 3, skin);
    }
  }

  pixelRect(context, -14, headY - 12, 28, 5, outline);
  pixelRect(context, -16, headY - 7, 32, 18, outline);
  pixelRect(context, -12, headY + 11, 24, 5, outline);
  if (isBack) {
    pixelRect(context, -13, headY - 9, 26, 24, hair);
    pixelRect(context, -9, headY - 12, 18, 6, hair);
    pixelRect(context, -11, headY + 6, 22, 8, 'rgba(0, 0, 0, 0.12)');
  } else if (isSide) {
    pixelRect(context, -12 * sideSign, headY - 9, 23 * sideSign, 5, skin);
    pixelRect(context, -14 * sideSign, headY - 4, 25 * sideSign, 14, skin);
    pixelRect(context, -8 * sideSign, headY + 9, 18 * sideSign, 5, skin);
    pixelRect(context, 8 * sideSign, headY - 1, 4 * sideSign, 8, skin);
  } else {
    pixelRect(context, -11, headY - 9, 22, 5, skin);
    pixelRect(context, -13, headY - 4, 26, 13, skin);
    pixelRect(context, -9, headY + 9, 18, 5, skin);
    pixelRect(context, -11, headY - 5, 6, 7, 'rgba(255, 255, 255, 0.12)');
  }

  if (selectedRace === 'orc') {
    if (!isBack) {
      pixelRect(context, -13, headY - 5, 5, 8, skin);
      pixelRect(context, 8, headY - 5, 5, 8, skin);
      pixelRect(context, -8, headY + 8, 3, 6, '#f8fafc');
      pixelRect(context, 5, headY + 8, 3, 6, '#f8fafc');
    }
  }

  if (selectedRace === 'undead') {
    if (!isBack) {
      pixelRect(context, -9, headY - 8, 18, 8, '#d8e1cf');
      pixelRect(context, -5, headY + 5, 2, 5, '#64748b');
      pixelRect(context, 1, headY + 5, 2, 5, '#64748b');
    }
  } else if (!isBack) {
    pixelRect(context, -11, headY - 12, 22, 7, hair);
    if (isSide) {
      pixelRect(context, -13 * sideSign, headY - 7, 9 * sideSign, 17, hair);
      pixelRect(context, 7 * sideSign, headY - 7, 5 * sideSign, 9, hair);
    } else {
      pixelRect(context, -12, headY - 6, 6, 8, hair);
      pixelRect(context, 7, headY - 7, 5, 7, hair);
    }
  }

  if (selectedRace === 'dwarf') {
    pixelRect(context, -9, headY + 4, 18, 12, '#7c2d12');
    pixelRect(context, -5, headY + 12, 10, 5, '#9a3412');
    pixelRect(context, -14, headY - 8, 5, 6, hair);
    pixelRect(context, 9, headY - 8, 5, 6, hair);
  }

  if (!isBack) {
    if (isSide) {
      pixelRect(context, 4 * sideSign, headY - 1, 3 * sideSign, 4, '#111827');
      pixelRect(context, 5 * sideSign, headY + 8, 6 * sideSign, 2, '#111827');
    } else {
      pixelRect(context, -6 + Math.round(fx * 2), headY - 1 + Math.round(fy), 3, 4, '#111827');
      pixelRect(context, 4 + Math.round(fx * 2), headY - 1 + Math.round(fy), 3, 4, '#111827');
      pixelRect(context, -3 + Math.round(fx * 2), headY + 8, 7, 2, '#111827');
    }
  }

  const handX = sideX * 20 + fx * 4;
  const handY = sideY * 20 + fy * 4;
  const offHandX = -sideX * 20 + fx * 4;
  const offHandY = -sideY * 20 + fy * 4;

  if (classSprite.weapon === 'staff') {
    const orb = classSprite.glow;
    pixelLine(context, handX, handY, handX + fx * 30 + sideX * 8, handY + fy * 30 + sideY * 8, 4, weapon, 9);
    pixelRect(context, handX + fx * 34 + sideX * 8 - 5, handY + fy * 34 + sideY * 8 - 5, 10, 10, orb);
    pixelRect(context, handX + fx * 37 + sideX * 8 - 2, handY + fy * 37 + sideY * 8 - 2, 4, 4, '#f8fafc');
  } else if (classSprite.weapon === 'bow') {
    pixelLine(context, handX - sideX * 9, handY - sideY * 9, handX + sideX * 9, handY + sideY * 9, 3, '#8d6e45', 8);
    pixelLine(context, handX - sideX * 10, handY - sideY * 10, handX + sideX * 10, handY + sideY * 10, 1, '#f8fafc', 8);
    pixelLine(context, offHandX, offHandY, offHandX + fx * 24, offHandY + fy * 24, 3, '#fde68a', 7);
  } else if (classSprite.weapon === 'daggers') {
    pixelLine(context, handX, handY, handX + fx * 20 + sideX * 5, handY + fy * 20 + sideY * 5, 4, weapon, 7);
    pixelLine(context, offHandX, offHandY, offHandX + fx * 20 - sideX * 5, offHandY + fy * 20 - sideY * 5, 4, weapon, 7);
  } else if (classSprite.weapon === 'hammer-shield') {
    pixelRect(context, offHandX - 8, offHandY - 8, 16, 18, '#facc15');
    pixelRect(context, offHandX - 5, offHandY - 5, 10, 12, '#334155');
    pixelLine(context, handX, handY, handX + fx * 34 + sideX * 9, handY + fy * 34 + sideY * 9, 5, weapon, 8);
    pixelRect(context, handX + fx * 35 + sideX * 9 - 6, handY + fy * 35 + sideY * 9 - 6, 12, 12, '#fef08a');
  } else {
    pixelLine(context, handX, handY, handX + fx * 42 + sideX * 8, handY + fy * 42 + sideY * 8, 5, weapon, 10);
    pixelRect(context, handX + fx * 42 + sideX * 8 - 3, handY + fy * 42 + sideY * 8 - 10, 6, 18, '#f8fafc');
  }

  context.restore();
  context.imageSmoothingEnabled = previousSmoothing;
}

function drawPlayer(context, player, selectedClass, selectedRace, appearance = {}) {
  const classConfig = CLASSES[selectedClass];
  const raceConfig = RACES[selectedRace];
  if (!classConfig || !raceConfig || !Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return;

  if (drawCharacterAssetSprite(context, player, selectedClass, selectedRace, appearance)) {
    drawCharacterAttackOverlay(context, player, selectedClass);
    return;
  }
  drawPixelPlayerSprite(context, player, selectedClass, selectedRace, appearance);
  drawCharacterAttackOverlay(context, player, selectedClass);
  return;

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

  const stride = Math.sin(performance.now() / 160 + x * 0.02 + y * 0.01) * 4;
  context.strokeStyle = '#15222b';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(-7, 16);
  context.lineTo(-10 + stride, 30);
  context.moveTo(7, 16);
  context.lineTo(10 - stride, 30);
  context.stroke();
  context.strokeStyle = colors.trim;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-7, 17);
  context.lineTo(-10 + stride, 28);
  context.moveTo(7, 17);
  context.lineTo(10 - stride, 28);
  context.stroke();

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

  if (selectedClass === 'paladin' || selectedClass === 'warrior') {
    context.fillStyle = selectedClass === 'paladin' ? 'rgba(254, 240, 138, 0.45)' : 'rgba(203, 213, 225, 0.38)';
    context.beginPath();
    context.roundRect(-13, -9, 26, 16, 5);
    context.fill();
  }

  if (selectedClass === 'rogue') {
    context.fillStyle = 'rgba(15, 23, 42, 0.48)';
    context.beginPath();
    context.moveTo(-16, -8);
    context.lineTo(0, 25);
    context.lineTo(16, -8);
    context.lineTo(8, 2);
    context.lineTo(-8, 2);
    context.closePath();
    context.fill();
  }

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
  } else if (selectedClass === 'rogue') {
    context.strokeStyle = colors.weapon;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(sideX * 16 - fx * 2, sideY * 16 - fy * 2);
    context.lineTo(sideX * 27 + fx * 14, sideY * 27 + fy * 14);
    context.moveTo(-sideX * 16 - fx * 2, -sideY * 16 - fy * 2);
    context.lineTo(-sideX * 27 + fx * 14, -sideY * 27 + fy * 14);
    context.stroke();
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

function CharacterPreview({ character, spriteLoadVersion = 0 }) {
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
      { x: 0, y: 0, facing: Math.PI / 2 },
      character.classId,
      character.raceId,
      character.appearance,
    );
    context.restore();
  }, [character, spriteLoadVersion]);

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
    hairStyle: 'short',
    skin: race.skin,
    hair: raceId === 'human' ? classConfig.colors.hair : race.hair,
    robe: classConfig.colors.robe,
    trim: classConfig.colors.trim,
  };
}

function getMergedDefaultAppearance(raceId, classId, current = {}) {
  const nextDefault = getDefaultAppearance(raceId, classId);
  return {
    ...nextDefault,
    gender: current.gender ?? 'male',
    hairStyle: current.hairStyle ?? 'short',
    beard: current.beard ?? nextDefault.beard,
    outfitVariant: current.outfitVariant ?? nextDefault.outfitVariant,
    weaponVariant: current.weaponVariant ?? nextDefault.weaponVariant,
    capeStyle: current.capeStyle ?? current.cape ?? nextDefault.capeStyle,
    skin: current.skin ?? nextDefault.skin,
    hair: current.hair ?? nextDefault.hair,
    robe: current.robe ?? nextDefault.robe,
    trim: current.trim ?? nextDefault.trim,
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

function drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp) {
  const barWidth = isBoss ? 92 : 42;
  const barHeight = isBoss ? 8 : 5;
  const bossLabelOffset = enemy.type === 'boss' ? 124 : radius + 24;
  const barY = isBoss ? -bossLabelOffset : -radius - 15;

  context.fillStyle = '#111827';
  context.fillRect(-barWidth / 2, barY, barWidth, barHeight);
  context.fillStyle = '#22c55e';
  context.fillRect(-barWidth / 2, barY, barWidth * (hp / Math.max(1, maxHp)), barHeight);

  if (isBoss || enemy.state !== 'aggro') {
    context.fillStyle = isBoss ? '#f6f1df' : '#cbd5e1';
    context.font = isBoss ? '900 13px Inter, Arial' : '900 12px Inter, Arial';
    context.textAlign = 'center';
    context.fillText(isBoss ? enemy.name : 'idle', 0, isBoss ? barY - 10 : barY - 8);
  }
}

function drawPixelWolf(context, radius, pulse, walk, bodyColor, outline, recentlyHit) {
  pixelRect(context, -radius - 16, 6 + pulse, radius * 2 + 24, 13, 'rgba(0, 0, 0, 0.22)');
  pixelRect(context, -radius - 8, -9 + pulse, radius * 2 + 12, 23, outline);
  pixelRect(context, -radius - 4, -6 + pulse, radius * 2 + 7, 17, bodyColor);
  pixelRect(context, radius - 3, -16 + pulse, 21, 21, outline);
  pixelRect(context, radius + 1, -13 + pulse, 15, 15, recentlyHit ? '#fecaca' : '#475569');
  pixelRect(context, radius, -24 + pulse, 7, 10, outline);
  pixelRect(context, radius + 10, -25 + pulse, 7, 11, outline);
  pixelRect(context, radius + 2, -23 + pulse, 4, 8, bodyColor);
  pixelRect(context, radius + 11, -23 + pulse, 4, 8, bodyColor);
  pixelRect(context, radius + 4, -8 + pulse, 4, 4, '#e0e7ff');
  pixelRect(context, radius + 13, -8 + pulse, 4, 4, '#e0e7ff');
  pixelRect(context, radius + 6, 2 + pulse, 10, 3, '#111827');
  pixelRect(context, -radius - 13, -5 + pulse, 14, 6, outline);
  pixelLine(context, -radius - 10, -4 + pulse, -radius - 28, -11 + pulse, 5, bodyColor, 4);
  pixelRect(context, -radius + 1, 8 + pulse, 6, 15 + walk, outline);
  pixelRect(context, 7, 8 + pulse, 6, 15 - walk, outline);
  pixelRect(context, -radius + 2, 8 + pulse, 3, 12 + walk, bodyColor);
  pixelRect(context, 8, 8 + pulse, 3, 12 - walk, bodyColor);
}

function drawPixelScarab(context, radius, pulse, walk, isAggro, recentlyHit) {
  const shell = recentlyHit ? '#fecaca' : isAggro ? '#92400e' : '#b45309';
  const trim = '#facc15';
  const outline = '#3f2a13';
  pixelRect(context, -radius - 15, 10 + pulse, radius * 2 + 30, 8, 'rgba(0, 0, 0, 0.2)');
  pixelRect(context, -radius - 10, -12 + pulse, radius * 2 + 20, 28, outline);
  pixelRect(context, -radius - 6, -9 + pulse, radius * 2 + 12, 22, shell);
  pixelRect(context, -4, -10 + pulse, 8, 24, trim);
  pixelRect(context, -radius - 2, -2 + pulse, radius * 2 + 4, 4, trim);
  for (let index = -1; index <= 1; index += 1) {
    pixelLine(context, -radius - 4, -3 + index * 8 + pulse, -radius - 22, 2 + index * 9 + walk, 4, outline, 4);
    pixelLine(context, radius + 4, -3 + index * 8 + pulse, radius + 22, 2 + index * 9 - walk, 4, outline, 4);
  }
  pixelRect(context, -7, -18 + pulse, 5, 5, '#fff7ed');
  pixelRect(context, 2, -18 + pulse, 5, 5, '#fff7ed');
}

function drawPixelStalker(context, radius, pulse, walk, bodyColor, outline, recentlyHit) {
  const fill = recentlyHit ? '#fecaca' : bodyColor;
  pixelRect(context, -radius - 10, 13 + pulse, radius * 2 + 20, 8, 'rgba(0, 0, 0, 0.25)');
  pixelRect(context, -radius - 7, -radius + pulse, radius * 2 + 14, radius * 2 + 12, outline);
  pixelRect(context, -radius - 2, -radius + 5 + pulse, radius * 2 + 4, radius * 2 + 3, fill);
  pixelLine(context, -radius + 2, -radius + 7 + pulse, -radius - 18, -radius - 12 + pulse, 6, outline, 4);
  pixelLine(context, radius - 2, -radius + 7 + pulse, radius + 18, -radius - 12 + pulse, 6, outline, 4);
  pixelRect(context, -10, -6 + pulse, 6, 6, '#f8fafc');
  pixelRect(context, 5, -6 + pulse, 6, 6, '#f8fafc');
  pixelRect(context, -8, 11 + pulse, 16, 4, '#94a3b8');
  pixelRect(context, -radius + 3, radius + pulse, 6, 14 + walk, outline);
  pixelRect(context, radius - 9, radius + pulse, 6, 14 - walk, outline);
}

function drawPixelBoss(context, enemy, radius, pulse, walk, bodyColor, outline, recentlyHit) {
  const isFinal = enemy.type === 'dungeon_final_boss';
  const fill = recentlyHit ? '#fecaca' : bodyColor;
  pixelRect(context, -radius - 10, radius - 2 + pulse, radius * 2 + 20, 12, 'rgba(0, 0, 0, 0.28)');
  pixelRect(context, -radius, -radius + pulse, radius * 2, radius * 2, outline);
  pixelRect(context, -radius + 6, -radius + 6 + pulse, radius * 2 - 12, radius * 2 - 12, fill);
  pixelRect(context, -radius + 14, -radius - 13 + pulse, 12, 18, '#facc15');
  pixelRect(context, -6, -radius - 18 + pulse, 12, 23, '#facc15');
  pixelRect(context, radius - 26, -radius - 13 + pulse, 12, 18, '#facc15');
  pixelRect(context, -15, -8 + pulse, 9, 9, '#f8fafc');
  pixelRect(context, 7, -8 + pulse, 9, 9, '#f8fafc');
  pixelRect(context, -15, 18 + pulse, 30, 6, '#111827');
  if (isFinal) {
    for (let ring = 0; ring < 8; ring += 1) {
      const angle = ring * (Math.PI / 4) + performance.now() / 420;
      pixelRect(
        context,
        Math.cos(angle) * (radius + 12) - 4,
        Math.sin(angle) * (radius + 12) + pulse - 4,
        8,
        8,
        ring % 2 === 0 ? '#a78bfa' : '#f0abfc',
      );
    }
  } else {
    pixelRect(context, -radius - 6, 5 + pulse, 12, 28 + walk, outline);
    pixelRect(context, radius - 6, 5 + pulse, 12, 28 - walk, outline);
  }
}

function drawEnemyAssetSprite(context, enemy, now, recentlyHit) {
  const spriteId = getEnemySpriteId(enemy);
  const config = ENEMY_SPRITE_CONFIG[spriteId];
  const image = getEnemySpriteImage(spriteId);
  if (!config || !image) return false;

  const frame = Math.floor((now / 155 + (enemy.wobble ?? 0)) % config.frameCount);
  const sx = frame * config.frameWidth;
  const alpha = recentlyHit ? 0.72 : 1;

  context.save();
  context.globalAlpha = alpha;
  context.drawImage(
    image,
    sx,
    0,
    config.frameWidth,
    config.frameHeight,
    Math.round(-config.drawWidth / 2),
    Math.round(config.yOffset),
    config.drawWidth,
    config.drawHeight,
  );
  context.restore();
  return true;
}

function drawPixelEnemySprite(context, enemy, now) {
  const x = Number.isFinite(enemy?.x) ? enemy.x : enemy?.targetX;
  const y = Number.isFinite(enemy?.y) ? enemy.y : enemy?.targetY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;

  const time = Number.isFinite(now) ? now : performance.now();
  const pulse = Math.round(Math.sin(time / 180 + (enemy.wobble ?? 0)) * 2);
  const walk = Math.round(Math.sin(time / 110 + (enemy.wobble ?? 0)) * 3);
  const recentlyHit = time - (enemy.hitAt ?? 0) < 140;
  const isBoss = enemy.type === 'boss' || enemy.type === 'dungeon_miniboss' || enemy.type === 'dungeon_final_boss';
  const isAggro = enemy.state === 'aggro';
  const radius = enemy.radius ?? ENEMY.radius;
  const maxHp = enemy.maxHp || (isBoss ? 620 : 100);
  const hp = clamp(enemy.hp ?? maxHp, 0, maxHp);
  const outline = '#221722';
  const bodyColor = enemy.type === 'dungeon_enemy'
    ? '#475569'
    : enemy.type === 'dungeon_miniboss'
      ? '#7c2d12'
      : enemy.type === 'dungeon_final_boss'
        ? '#4c1d95'
        : isBoss
          ? '#5b21b6'
          : isAggro
            ? '#7f1d1d'
            : '#4b5563';

  context.save();
  context.translate(x, y);

  if (drawEnemyAssetSprite(context, enemy, time, recentlyHit)) {
    drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp);
  } else if (enemy.type === 'enemy' && enemy.enemyKind === 'scarab') {
    drawPixelScarab(context, radius, pulse, walk, isAggro, recentlyHit);
    drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp);
  } else if (enemy.type === 'enemy') {
    drawPixelWolf(context, radius, pulse, walk, bodyColor, outline, recentlyHit);
    drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp);
  } else if (enemy.type === 'dungeon_enemy') {
    drawPixelStalker(context, radius, pulse, walk, bodyColor, outline, recentlyHit);
    drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp);
  } else {
    drawPixelBoss(context, enemy, radius, pulse, walk, bodyColor, outline, recentlyHit);
    drawPixelEnemyLabel(context, enemy, isBoss, radius, hp, maxHp);
  }
  context.restore();
  context.imageSmoothingEnabled = previousSmoothing;
}

function drawEnemy(context, enemy, now) {
  const x = Number.isFinite(enemy?.x) ? enemy.x : enemy?.targetX;
  const y = Number.isFinite(enemy?.y) ? enemy.y : enemy?.targetY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  drawPixelEnemySprite(context, enemy, now);
  return;

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

  const walk = Math.sin(now / 120 + (enemy.wobble ?? 0)) * 4;
  const bodyColor = recentlyHit
    ? '#fecaca'
    : enemy.type === 'dungeon_enemy'
      ? '#475569'
      : enemy.type === 'dungeon_miniboss'
        ? '#7c2d12'
        : enemy.type === 'dungeon_final_boss'
          ? '#4c1d95'
          : isBoss
            ? '#5b21b6'
            : isAggro
              ? '#7f1d1d'
              : '#4b5563';

  if (enemy.type === 'enemy' && enemy.enemyKind === 'scarab') {
    context.strokeStyle = '#3b2f1c';
    context.lineWidth = 4;
    context.fillStyle = recentlyHit ? '#fecaca' : isAggro ? '#92400e' : '#b45309';
    context.beginPath();
    context.ellipse(0, 3 + pulse, radius + 9, radius - 2, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#fbbf24';
    context.beginPath();
    context.ellipse(0, -2 + pulse, radius - 2, radius - 9, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#3b2f1c';
    context.lineWidth = 3;
    context.beginPath();
    for (let leg = -1; leg <= 1; leg += 1) {
      context.moveTo(-12, 4 + leg * 7 + pulse);
      context.lineTo(-28, 8 + leg * 7 + walk);
      context.moveTo(12, 4 + leg * 7 + pulse);
      context.lineTo(28, 8 + leg * 7 - walk);
    }
    context.stroke();
  } else if (enemy.type === 'enemy') {
    context.strokeStyle = '#2b1111';
    context.lineWidth = 4;
    context.fillStyle = bodyColor;
    context.beginPath();
    context.ellipse(0, 3 + pulse, radius + 8, radius - 3, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#374151';
    context.beginPath();
    context.ellipse(18, -4 + pulse, 13, 11, 0.2, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#374151';
    context.beginPath();
    context.moveTo(18, -16 + pulse);
    context.lineTo(24, -28 + pulse);
    context.lineTo(27, -12 + pulse);
    context.moveTo(7, -15 + pulse);
    context.lineTo(5, -28 + pulse);
    context.lineTo(16, -15 + pulse);
    context.fill();
    context.stroke();
    context.strokeStyle = '#2b1111';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-12, 12 + pulse);
    context.lineTo(-18, 24 + walk);
    context.moveTo(6, 12 + pulse);
    context.lineTo(2, 25 - walk);
    context.moveTo(-24, 1 + pulse);
    context.quadraticCurveTo(-38, -8 + pulse, -44, -1 + pulse);
    context.stroke();
  } else {
    context.fillStyle = bodyColor;
    context.strokeStyle = '#2b1111';
    context.lineWidth = isBoss ? 5 : 3;
    context.beginPath();
    context.arc(0, pulse, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    if (enemy.type === 'dungeon_enemy') {
      context.fillStyle = '#94a3b8';
      context.beginPath();
      context.moveTo(-18, -9 + pulse);
      context.lineTo(-30, -21 + pulse);
      context.lineTo(-21, 1 + pulse);
      context.moveTo(18, -9 + pulse);
      context.lineTo(30, -21 + pulse);
      context.lineTo(21, 1 + pulse);
      context.fill();
    }
  }

  context.fillStyle = '#fef2f2';
  context.beginPath();
  context.arc(isBoss ? -12 : 7, (isBoss ? -8 : -5) + pulse, isBoss ? 5 : 3, 0, Math.PI * 2);
  context.arc(isBoss ? 12 : 19, (isBoss ? -8 : -5) + pulse, isBoss ? 5 : 3, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#111827';
  context.lineWidth = isBoss ? 4 : 2;
  context.beginPath();
  context.moveTo(isBoss ? -13 : 9, (isBoss ? 12 : 7) + pulse);
  context.lineTo(isBoss ? 13 : 19, (isBoss ? 12 : 7) + pulse);
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

function drawPixelRing(context, x, y, radius, color, count = 20, size = 6, spin = 0) {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + spin;
    pixelRect(
      context,
      x + Math.cos(angle) * radius - size / 2,
      y + Math.sin(angle) * radius - size / 2,
      size,
      size,
      color,
    );
  }
}

function drawPixelAbilityEffect(context, effect, now) {
  const duration = Math.max(1, effect.duration ?? 320);
  const progress = clamp((now - effect.start) / duration, 0, 1);
  const alpha = 1 - progress;
  const facing = Number.isFinite(effect.facing) ? effect.facing : 0;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const sideX = Math.cos(facing + Math.PI / 2);
  const sideY = Math.sin(facing + Math.PI / 2);
  const color = effect.color ?? '#8be9fd';
  const light = effect.type === 'heal' ? '#f0fdf4' : '#f8fafc';
  const previousSmoothing = context.imageSmoothingEnabled;
  context.imageSmoothingEnabled = false;

  context.save();
  context.globalAlpha = Math.max(alpha, 0);

  if (effect.type === 'bolt') {
    const distance = 42 + progress * 190;
    pixelLine(context, effect.x + fx * 18, effect.y + fy * 18, effect.x + fx * distance, effect.y + fy * distance, 6, color, 12);
    for (let spark = 0; spark < 5; spark += 1) {
      const offset = (spark - 2) * 7;
      pixelRect(
        context,
        effect.x + fx * (distance - spark * 13) + sideX * offset - 4,
        effect.y + fy * (distance - spark * 13) + sideY * offset - 4,
        8,
        8,
        spark % 2 ? light : color,
      );
    }
  }

  if (effect.type === 'shot') {
    const head = 85 + progress * 230;
    pixelLine(context, effect.x + fx * 20, effect.y + fy * 20, effect.x + fx * head, effect.y + fy * head, 4, '#fde68a', 14);
    pixelRect(context, effect.x + fx * head - 5, effect.y + fy * head - 5, 10, 10, color);
    pixelRect(context, effect.x + fx * head + sideX * 8 - 3, effect.y + fy * head + sideY * 8 - 3, 6, 6, light);
    pixelRect(context, effect.x + fx * head - sideX * 8 - 3, effect.y + fy * head - sideY * 8 - 3, 6, 6, light);
  }

  if (effect.type === 'channel') {
    context.globalAlpha = 0.45 + Math.sin(now / 55) * 0.18;
    for (let segment = 0; segment < 15; segment += 1) {
      const distance = 24 + segment * 17;
      const wobble = Math.sin(now / 90 + segment) * 5;
      pixelRect(
        context,
        effect.x + fx * distance + sideX * wobble - 5,
        effect.y + fy * distance + sideY * wobble - 5,
        10,
        10,
        segment % 2 ? color : '#f5d0fe',
      );
    }
  }

  if (effect.type === 'nova' || effect.type === 'shield' || effect.type === 'shout') {
    const baseRadius = effect.type === 'shield' ? 24 : 30;
    const radius = baseRadius + progress * 98;
    const iconColor = effect.type === 'shout' ? '#fb7185' : color;
    drawPixelRing(context, effect.x, effect.y, radius, iconColor, effect.type === 'shield' ? 28 : 22, effect.type === 'shield' ? 5 : 7, now / 240);
    if (effect.type === 'shield') {
      drawPixelRing(context, effect.x, effect.y, Math.max(8, radius - 15), '#fef3c7', 18, 4, -now / 280);
    }
  }

  if (effect.type === 'heal') {
    const radius = 18 + progress * 55;
    drawPixelRing(context, effect.x, effect.y, radius, '#86efac', 16, 6, now / 180);
    drawPixelCross(context, effect.x, effect.y - 36 - progress * 18, 7, color);
    for (let spark = 0; spark < 6; spark += 1) {
      pixelRect(
        context,
        effect.x + Math.cos(spark) * (12 + spark * 4) - 3,
        effect.y - progress * 45 + Math.sin(spark * 1.7) * 18 - 3,
        6,
        6,
        spark % 2 ? '#f0fdf4' : color,
      );
    }
  }

  if (effect.type === 'trap') {
    const trapX = effect.x + fx * 95;
    const trapY = effect.y + fy * 95;
    const pulse = 28 + Math.sin(now / 90) * 4;
    pixelRect(context, trapX - 18, trapY - 18, 36, 4, color);
    pixelRect(context, trapX - 18, trapY + 14, 36, 4, color);
    pixelRect(context, trapX - 18, trapY - 18, 4, 36, color);
    pixelRect(context, trapX + 14, trapY - 18, 4, 36, color);
    drawPixelRing(context, trapX, trapY, pulse, '#f5d0fe', 12, 4, now / 150);
  }

  if (effect.type === 'strike') {
    for (let slash = 0; slash < 9; slash += 1) {
      const distance = 20 + slash * 9;
      const width = 9 - slash * 0.35;
      pixelRect(
        context,
        effect.x + fx * distance + sideX * (slash - 4) * 7 - width / 2,
        effect.y + fy * distance + sideY * (slash - 4) * 7 - width / 2,
        width,
        width,
        slash % 2 ? light : color,
      );
    }
  }

  if (effect.type === 'cleave') {
    for (let slash = -8; slash <= 8; slash += 1) {
      const angle = facing + slash * 0.115;
      const radius = 48 + progress * 18;
      pixelRect(
        context,
        effect.x + Math.cos(angle) * radius - 5,
        effect.y + Math.sin(angle) * radius - 5,
        10,
        10,
        slash % 2 ? color : light,
      );
    }
  }

  if (effect.type === 'dungeon_aoe') {
    const radius = effect.radius ?? 90;
    context.globalAlpha = 0.18 + alpha * 0.26;
    for (let ring = 0; ring < 3; ring += 1) {
      drawPixelRing(context, effect.x, effect.y, radius * (0.45 + ring * 0.22 + progress * 0.08), effect.color ?? '#ef4444', 22 + ring * 6, 9, now / (220 + ring * 80));
    }
  }

  if (effect.type === 'dungeon_laser') {
    const length = effect.length ?? 520;
    const width = effect.width ?? 42;
    context.globalAlpha = 0.22 + alpha * 0.42;
    for (let index = 0; index <= 32; index += 1) {
      const distance = 24 + (length / 32) * index;
      pixelRect(
        context,
        effect.x + fx * distance - width / 2 * Math.abs(sideX) - 4,
        effect.y + fy * distance - width / 2 * Math.abs(sideY) - 4,
        Math.max(8, Math.abs(sideX) * width + 8),
        Math.max(8, Math.abs(sideY) * width + 8),
        index % 2 ? effect.color ?? '#f43f5e' : '#ffe4e6',
      );
    }
  }

  context.restore();
  context.imageSmoothingEnabled = previousSmoothing;
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

function getObjectPosition(object) {
  if (!object) return null;
  return object.point ? { x: Number(object.x ?? 0), y: Number(object.y ?? 0) } : getObjectCenter(object);
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
  };
  return labels[ability?.type] ?? 'AB';
}

function describeAbility(ability, stats, character) {
  if (!ability) return '';
  const damage = ability.damage
    ? ability.damage + Math.floor(((stats.strength ?? 0) + (stats.agility ?? 0) + (stats.intellect ?? 0)) / 8)
    : 0;
  const healing = ability.healing ? ability.healing + Math.floor((stats.intellect ?? 0) / 3) : 0;
  const parts = [];
  if (damage) parts.push(`${damage} damage`);
  if (healing) parts.push(`${healing} healing`);
  parts.push(`${getAbilityManaCost(ability, character)} ${getResourceConfig(character).label.toLowerCase()}`);
  parts.push(`${(getAbilityCooldownMs(ability) / 1000).toFixed(1)}s cooldown`);
  return parts.join(' | ');
}

function getItemIconLabel(item) {
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
  spriteLoadVersion = 0,
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
      setAppearance((current) => getMergedDefaultAppearance(raceId, nextClassId, current));
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
    setAppearance((current) => getMergedDefaultAppearance(id, nextClassId, current));
  };

  const selectClass = (id) => {
    setClassId(id);
    setAppearance((current) => getMergedDefaultAppearance(raceId, id, current));
  };

  const updateAppearance = (key, value) => {
    setAppearance((current) => ({ ...current, [key]: value }));
  };

  const cycleAppearanceValue = (key, values, direction) => {
    const currentIndex = values.indexOf(appearance[key]);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + values.length) % values.length;
    updateAppearance(key, values[nextIndex]);
  };

  const cycleAppearanceChoice = (key, choices, direction) => {
    const values = choices.map((choice) => choice.id);
    cycleAppearanceValue(key, values, direction);
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
              <CharacterPreview character={selectedCharacter} spriteLoadVersion={spriteLoadVersion} />
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
                <CharacterPreview character={draftCharacter} spriteLoadVersion={spriteLoadVersion} />
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
                      {Object.entries(APPEARANCE_CHOICES).map(([key, choices]) => (
                        <div className="customization-row" key={key}>
                          <strong>{key}</strong>
                          {key === 'gender' ? (
                            <div className="choice-buttons">
                              {choices.map((choice) => (
                                <button
                                  className={appearance[key] === choice.id ? 'selected text-choice' : 'text-choice'}
                                  key={choice.id}
                                  type="button"
                                  onClick={() => updateAppearance(key, choice.id)}
                                >
                                  {choice.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="cycle-control">
                              <button
                                aria-label={`Previous ${key}`}
                                className="cycle-arrow"
                                type="button"
                                onClick={() => cycleAppearanceChoice(key, choices, -1)}
                              >
                                {'<'}
                              </button>
                              <button
                                className="cycle-value"
                                type="button"
                                onClick={() => cycleAppearanceChoice(key, choices, 1)}
                              >
                                {choices.find((choice) => choice.id === appearance[key])?.label ?? choices[0]?.label}
                              </button>
                              <button
                                aria-label={`Next ${key}`}
                                className="cycle-arrow"
                                type="button"
                                onClick={() => cycleAppearanceChoice(key, choices, 1)}
                              >
                                {'>'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {Object.entries(CUSTOMIZATION).map(([key, values]) => (
                        <div className="customization-row" key={key}>
                          <strong>{key}</strong>
                          <div className="cycle-control">
                            <button
                              aria-label={`Previous ${key}`}
                              className="cycle-arrow"
                              type="button"
                              onClick={() => cycleAppearanceValue(key, values, -1)}
                            >
                              {'<'}
                            </button>
                            <button
                              className="cycle-value color-value"
                              type="button"
                              onClick={() => cycleAppearanceValue(key, values, 1)}
                              title={appearance[key]}
                            >
                              <span className="cycle-swatch" style={{ backgroundColor: appearance[key] }} />
                              <span>{appearance[key]}</span>
                            </button>
                            <button
                              aria-label={`Next ${key}`}
                              className="cycle-arrow"
                              type="button"
                              onClick={() => cycleAppearanceValue(key, values, 1)}
                            >
                              {'>'}
                            </button>
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
  const worldSpawnPacks = React.useRef(new globalThis.Map());
  const cooldowns = React.useRef({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const abilitySlotsRef = React.useRef(Array(ABILITY_BAR_SLOTS).fill(null));
  const selectedClassRef = React.useRef(null);
  const selectedRaceRef = React.useRef(null);
  const characterRef = React.useRef(null);
  const charactersRef = React.useRef([]);
  const lastRenderStatusAt = React.useRef(0);
  const vitalsRef = React.useRef({ hp: BASE_STATS.health, mana: BASE_STATS.mana, fury: 0, energy: 100 });
  const deadRef = React.useRef(false);
  const shopOpenRef = React.useRef(false);
  const lastCombatAt = React.useRef(0);
  const authFlowRef = React.useRef(null);
  const authUserRef = React.useRef(null);
  const colyseusRoomRef = React.useRef(null);
  const colyseusSessionIdRef = React.useRef(null);
  const remotePlayersRef = React.useRef([]);
  const onlinePlayersRef = React.useRef([]);
  const displayedRemotePlayersRef = React.useRef([]);
  const remoteAttackStatesRef = React.useRef(new globalThis.Map());
  const partyInviteCooldownsRef = React.useRef(new globalThis.Map());
  const selectedPlayerIdRef = React.useRef(null);
  const lastColyseusInputAt = React.useRef(0);
  const mapTransitioningRef = React.useRef(false);
  const nextAutoAttackAt = React.useRef(0);
  const autoAttackHeld = React.useRef(false);
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
  const [abilityBookOpen, setAbilityBookOpen] = React.useState(false);
  const [gameMenuOpen, setGameMenuOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [friendsOpen, setFriendsOpen] = React.useState(false);
  const [mapOpen, setMapOpen] = React.useState(false);
  const [journalOpen, setJournalOpen] = React.useState(false);
  const [friends, setFriends] = React.useState(() => loadFriends());
  const [friendNameInput, setFriendNameInput] = React.useState('');
  const [resurrectionCast, setResurrectionCast] = React.useState(null);
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
  const [onlinePlayers, setOnlinePlayers] = React.useState([]);
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
  deadRef.current = isDead;
  shopOpenRef.current = shopOpen;
  selectedPlayerIdRef.current = selectedPlayerId;
  abilitySlotsRef.current = abilitySlots;

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
    let cancelled = false;
    Promise.all([loadCharacterSprites(), loadEnemySprites()]).finally(() => {
      if (!cancelled) setSpriteLoadVersion((version) => version + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    worldSpawnPacks.current = createWorldSpawnPacks(tiledWorld.current?.enemySpawns ?? []);
    cooldowns.current = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const nextAbilitySlots = getDefaultAbilitySlots(nextCharacter);
    abilitySlotsRef.current = nextAbilitySlots;
    setAbilitySlots(nextAbilitySlots);
    player.current = getCharacterStartPosition(tiledWorld.current, nextCharacter);
    const stats = getTotalStats(nextCharacter);
    setVitalsValue({
      hp: stats.health,
      mana: stats.mana,
      fury: nextCharacter.classId === 'warrior' ? 0 : 0,
      energy: nextCharacter.classId === 'rogue' ? 100 : 0,
    });
    setIsDead(false);
    deadRef.current = false;
    lastCombatAt.current = 0;
    setEnemyCount(0);
    setLastCast(null);
    setInventoryOpen(false);
    setShopOpen(false);
    setTalentsOpen(false);
    setAbilityBookOpen(false);
    setGameMenuOpen(false);
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
      talents: { spec: null, ranks: {} },
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
    const bagCount = (activeCharacter.inventory ?? []).filter((inventoryItem) => !inventoryItem.equippedSlot).length;
    if (bagCount >= INVENTORY_CAPACITY) {
      setLastCast('Inventory full');
      return;
    }

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
      talents: { spec: specId, ranks: activeCharacter.talents?.spec === specId ? getTalentRanks(activeCharacter) : {} },
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
    const node = TALENT_NODES.find((candidate) => candidate.id === nodeId);
    if (!activeCharacter || !talentTree || !node) return;
    if ((activeCharacter.level ?? 1) < (talentTree.unlockLevel ?? TALENT_UNLOCK_LEVEL)) return;

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

    const nextSlots = abilitySlotsRef.current.map((slotId) => {
      const ability = resolveAbility(getCharacterAbilities(updatedCharacter), slotId);
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

  const assignAbilitySlot = (slotIndex, ability) => {
    if (!abilityBookOpen || !ability) return;
    const abilityId = getAbilityId(ability);
    setAbilitySlots((current) => {
      const nextSlots = current.map((slotId) => (slotId === abilityId ? null : slotId));
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
    setShopOpen(false);
    setInventoryOpen(false);
    setVitalsValue({ ...vitalsRef.current, hp: 0 });
    enemies.current = enemies.current.map((enemy) => ({ ...enemy, state: 'idle' }));
  };

  const respawnPlayer = async () => {
    const activeCharacter = characterRef.current;
    if (!activeCharacter) return;

    const stats = getTotalStats(activeCharacter);
    let respawnMap = tiledWorld.current;
    let respawnOrigin = { x: player.current.x, y: player.current.y };

    if (currentMapIdRef.current === 'dungeon_01') {
      try {
        respawnMap = await loadTiledMap('world');
        tiledWorld.current = respawnMap;
        currentMapIdRef.current = 'world';
        setCurrentMapId('world');
        const dungeonEntrance = getTransition(respawnMap, 'dungeon_01_entrance');
        respawnOrigin = getObjectPosition(dungeonEntrance) ?? respawnOrigin;
        setMapStatus(`Map loaded: ${respawnMap.zones.length} zone, ${respawnMap.spawns.length} spawn`);
      } catch (error) {
        console.error(error);
      }
    }

    player.current = getNearestGraveyardPosition(respawnMap, respawnOrigin, activeCharacter);
    setPosition({ ...player.current });
    enemies.current = [];
    effects.current = [];
    remotePlayersRef.current = [];
    displayedRemotePlayersRef.current = [];
    setSelectedPlayerId(null);
    nextSpawnAt.current = performance.now() + 900;
    nextBossSpawnAt.current = performance.now() + nextBossDelay();
    worldSpawnPacks.current = createWorldSpawnPacks(respawnMap?.enemySpawns ?? []);
    setVitalsValue({
      hp: stats.health,
      mana: stats.mana,
      fury: activeCharacter.classId === 'warrior' ? 0 : 0,
      energy: activeCharacter.classId === 'rogue' ? 100 : 0,
    });
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
    worldSpawnPacks.current = createWorldSpawnPacks(loadedMap.mapId === 'world' ? loadedMap.enemySpawns : []);
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
    setAbilityBookOpen(false);
    setGameMenuOpen(false);
  };

  React.useEffect(() => {
    let cancelled = false;

    loadTiledMap('world')
      .then((loadedMap) => {
        if (cancelled) return;
        tiledWorld.current = loadedMap;
        worldSpawnPacks.current = createWorldSpawnPacks(loadedMap.enemySpawns);
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
          const onlinePlayerList = worldState.onlinePlayers ?? worldPlayers;
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
          if (effect?.casterId && effect.casterId === room.sessionId) {
            return;
          }
          const now = performance.now();
          if (effect?.casterId) {
            remoteAttackStatesRef.current.set(effect.casterId, {
              startedAt: now,
              until: now + 320,
              type: effect.type,
              facing: effect.facing,
              ranged: effect.range > 80 || effect.projectile || effect.autoAttack,
              autoAttack: effect.autoAttack,
            });
          }
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
        onlinePlayersRef.current = [];
        remoteAttackStatesRef.current.clear();
        setOnlinePlayers([]);
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
        if (defeatedEnemies.some((enemy) => enemy.type === 'boss')) {
          nextBossSpawnAt.current = performance.now() + BOSS_RESPAWN_DELAY;
        }
        defeatedEnemies
          .filter((enemy) => enemy.type === 'enemy' && enemy.spawnId)
          .forEach((enemy) => scheduleWorldSpawnRespawn(worldSpawnPacks.current, enemy.spawnId, now, enemy.spawnSlot));
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

    const pushLocalEffect = (ability, facing, now) => {
      effects.current.push({
        ...ability,
        casterId: colyseusSessionIdRef.current ?? 'local',
        x: player.current.x,
        y: player.current.y,
        facing,
        start: now,
        nextTickAt: ability.type === 'channel' ? now : ability.nextTickAt,
        duration: ability.type === 'channel'
          ? ability.duration ?? 3000
          : ability.type === 'shield' || ability.type === 'heal'
            ? 900
            : ability.duration ?? 650,
      });
    };

    const fireAbility = (slot) => {
      const classId = selectedClassRef.current;
      if (!classId || deadRef.current) return;

      const now = performance.now();
      if (now < cooldowns.current[slot]) return;

      const activeCharacter = characterRef.current;
      const unlockedAbilities = getCharacterAbilities(activeCharacter);
      const ability = resolveAbility(unlockedAbilities, abilitySlotsRef.current[slot - 1]);
      if (!ability) return;
      const resourceConfig = getResourceConfig(activeCharacter);
      const resourceCost = getAbilityManaCost(ability, activeCharacter);
      if (getCurrentResource(activeCharacter, vitalsRef.current) < resourceCost) {
        setLastCast(`Not enough ${resourceConfig.label.toLowerCase()}`);
        return;
      }
      const facing = Math.atan2(mouse.current.y - player.current.y, mouse.current.x - player.current.x);
      player.current.facing = facing;
      player.current.attack = {
        startedAt: now,
        until: now + 320,
        type: ability.type,
        facing,
        ranged: ability.range > 80 || ability.projectile,
      };
      const room = colyseusRoomRef.current;
      const stats = activeCharacter ? getTotalStats(activeCharacter) : BASE_STATS;
      const damage = ability.damage
        ? ability.damage + Math.floor(((stats.strength ?? 0) + (stats.agility ?? 0) + (stats.intellect ?? 0)) / 8)
        : 0;
      const healing = ability.healing
        ? ability.healing + Math.floor((stats.intellect ?? 0) / 3)
        : 0;

      if (ability.type === 'channel') {
        cooldowns.current[slot] = now + getAbilityCooldownMs(ability);
        effects.current = effects.current.filter((effect) => effect.type !== 'channel');
        if (room) {
          pushLocalEffect(ability, facing, now);
          room.send('ability', {
            ability,
            origin: { x: player.current.x, y: player.current.y },
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
        [resourceConfig.key]: Math.max(0, getCurrentResource(activeCharacter, vitalsRef.current) - resourceCost),
      };
      setVitalsValue(nextVitals);
      cooldowns.current[slot] = now + getAbilityCooldownMs(ability);

      if (ability.damage) {
        if (room) {
          pushLocalEffect(ability, facing, now);
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
          pushLocalEffect(ability, facing, now);
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
        pushLocalEffect(ability, facing, now);
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
        setMapOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === 'j' && characterRef.current) {
        setJournalOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === 'p' && characterRef.current) {
        setAbilityBookOpen((open) => !open);
        return;
      }
      if (event.key === 'Escape' && characterRef.current) {
        event.preventDefault();
        event.stopPropagation();
        setGameMenuOpen((open) => !open);
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
      if (/^[1-9]$/.test(event.key)) {
        const slot = Number(event.key);
        if (slot <= ABILITY_BAR_SLOTS) fireAbility(slot);
      }
    };

    const removeGameEscapeListener = window.mmoLauncher?.onGameEscape?.(() => {
      if (characterRef.current) setGameMenuOpen((open) => !open);
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
      effects.current.push({
        ...ability,
        casterId: colyseusSessionIdRef.current ?? 'local',
        x: player.current.x,
        y: player.current.y,
        facing,
        start: now,
        duration: ability.duration ?? 450,
      });
    };

    const runAutoAttack = (now) => {
      if (!characterRef.current || deadRef.current) return;
      if (now < nextAutoAttackAt.current) return;

      const activeCharacter = characterRef.current;
      const ability = getAutoAttackAbility(activeCharacter.classId);
      const facing = Math.atan2(mouse.current.y - player.current.y, mouse.current.x - player.current.x);
      player.current.facing = facing;
      player.current.attack = {
        startedAt: now,
        until: now + 280,
        type: ability.type,
        facing,
        ranged: isRangedClass(activeCharacter.classId),
        autoAttack: true,
      };
      nextAutoAttackAt.current = now + getAutoAttackCooldownMs(activeCharacter);

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
        pushAutoAttackEffect(ability, facing, now);
        room.send('ability', {
          ability,
          origin: { x: player.current.x, y: player.current.y },
          facing,
          damage,
        });
        return;
      }

      const damagedEnemies = enemies.current.map((enemy) => {
        if (!abilityHitsEnemyClient(ability, player.current, facing, enemy)) return enemy;
        lastCombatAt.current = now;
        return { ...enemy, state: 'aggro', hp: enemy.hp - damage, hitAt: now };
      });
      const defeatedEnemies = damagedEnemies.filter((enemy) => enemy.hp <= 0);
      enemies.current = damagedEnemies.filter((enemy) => enemy.hp > 0);

      if (defeatedEnemies.length > 0) {
        awardExperience(defeatedEnemies.reduce((total, enemy) => total + (enemy.xp ?? ENEMY_XP), 0));
        if (defeatedEnemies.some((enemy) => enemy.type === 'boss')) {
          nextBossSpawnAt.current = performance.now() + BOSS_RESPAWN_DELAY;
        }
        defeatedEnemies
          .filter((enemy) => enemy.type === 'enemy' && enemy.spawnId)
          .forEach((enemy) => scheduleWorldSpawnRespawn(worldSpawnPacks.current, enemy.spawnId, now, enemy.spawnSlot));
        defeatedEnemies
          .filter((enemy) => enemy.type === 'boss')
          .forEach(() => addLoot(rollBossLoot()));
        setEnemyCount(enemies.current.length);
      }

      pushAutoAttackEffect(ability, facing, now);
    };

    const handlePointerDown = (event) => {
      if (event.button !== 0) return;
      updateMouse(event);
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
          const remoteAttack = remoteAttackStatesRef.current.get(remotePlayer.id);
          if (remoteAttack && now > remoteAttack.until) remoteAttackStatesRef.current.delete(remotePlayer.id);
          const drawableRemotePlayer = remoteAttack && now <= remoteAttack.until
            ? { ...remotePlayer, attack: remoteAttack }
            : remotePlayer;
          drawPlayer(context, drawableRemotePlayer, remotePlayer.classId, remotePlayer.raceId, remotePlayer.appearance);
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

      if (
        !onlineRoom
        && selectedClassRef.current
        && currentMapIdRef.current === 'world'
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

            enemies.current.push(createEnemy(nextEnemyId.current, pack.spawn, player.current, slotIndex, pack.maxAlive));
            nextEnemyId.current += 1;
            aliveCount += 1;
            spawnedAnyEnemy = true;
          });

          while (aliveCount + pack.pendingRespawns.length < pack.maxAlive) {
            let openSlot = 0;
            while (occupiedSlots.has(openSlot) && openSlot < pack.maxAlive) openSlot += 1;
            if (openSlot >= pack.maxAlive) break;
            occupiedSlots.add(openSlot);
            enemies.current.push(createEnemy(nextEnemyId.current, pack.spawn, player.current, openSlot, pack.maxAlive));
            nextEnemyId.current += 1;
            aliveCount += 1;
            spawnedAnyEnemy = true;
          }
        });

        if (spawnedAnyEnemy) setEnemyCount(enemies.current.length);
      }

      const bossAlive = enemies.current.some((enemy) => enemy.type === 'boss');
      if (!onlineRoom && selectedClassRef.current && !bossAlive && now >= nextBossSpawnAt.current) {
        enemies.current.push(createBoss(nextEnemyId.current, pickSpawn(tiledWorld.current?.bossSpawns ?? []), player.current));
        nextEnemyId.current += 1;
        nextBossSpawnAt.current = Number.POSITIVE_INFINITY;
        setEnemyCount(enemies.current.length);
        setLastCast('Boss spawned: Elder Briarheart');
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
        player.current.vx = dx * PLAYER.speed;
        player.current.vy = dy * PLAYER.speed;
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
      } else {
        player.current.vx = 0;
        player.current.vy = 0;
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
            return updateIdleEnemyMovement(enemy, now, delta, enemy.type === 'boss' || enemy.type?.includes?.('boss'));
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

      if (autoAttackHeld.current) {
        runAutoAttack(now);
      }

      effects.current = effects.current
        .map((effect) => {
          if (effect.type !== 'channel' || deadRef.current) return effect;
          if (effect.casterId && effect.casterId !== colyseusSessionIdRef.current) return effect;
          if (now < effect.nextTickAt) return effect;

          const resourceConfig = getResourceConfig(characterRef.current);
          const resourceCost = getAbilityManaCost(effect, characterRef.current);
          if (getCurrentResource(characterRef.current, vitalsRef.current) < resourceCost) {
            setLastCast(`Channel interrupted: no ${resourceConfig.label.toLowerCase()}`);
            return { ...effect, start: 0, duration: 0 };
          }

          setVitalsValue({
            ...vitalsRef.current,
            [resourceConfig.key]: Math.max(0, getCurrentResource(characterRef.current, vitalsRef.current) - resourceCost),
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
              if (defeatedEnemies.some((enemy) => enemy.type === 'boss')) {
                nextBossSpawnAt.current = performance.now() + BOSS_RESPAWN_DELAY;
              }
        defeatedEnemies
          .filter((enemy) => enemy.type === 'enemy' && enemy.spawnId)
                .forEach((enemy) => scheduleWorldSpawnRespawn(worldSpawnPacks.current, enemy.spawnId, now, enemy.spawnSlot));
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
        if (resourceConfig.key === 'energy' && (nextVitals.energy ?? 0) < resourceConfig.max) {
          nextVitals = {
            ...nextVitals,
            energy: Math.min(resourceConfig.max, (nextVitals.energy ?? 0) + ROGUE_ENERGY_REGEN_PER_SECOND * delta),
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
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', stopAutoAttack);
    window.addEventListener('blur', stopAutoAttack);
    canvas.addEventListener('pointerleave', stopAutoAttack);
    canvas.addEventListener('contextmenu', stopAutoAttack);
    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', updateMouse);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', stopAutoAttack);
      window.removeEventListener('blur', stopAutoAttack);
      canvas.removeEventListener('pointerleave', stopAutoAttack);
      canvas.removeEventListener('contextmenu', stopAutoAttack);
    };
  }, [keys]);

  const currentClass = character ? CLASSES[character.classId] : null;
  const currentLevel = character?.level ?? 1;
  const currentXp = character?.xp ?? 0;
  const nextLevelXp = xpForLevel(currentLevel);
  const unlockedAbilities = character ? getCharacterAbilities(character) : [];
  const currentStats = character ? getTotalStats(character) : BASE_STATS;
  const nowForCooldowns = performance.now();
  const slottedAbilities = abilitySlots.map((abilityId) => resolveAbility(unlockedAbilities, abilityId));
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
  const availableTalentPoints = character ? getAvailableTalentPoints(character) : 0;
  const spentTalentPoints = character ? getSpentTalentPoints(character) : 0;
  const totalTalentPoints = character ? getEarnedTalentPoints(character) : 0;
  const selectedPlayer = displayedRemotePlayersRef.current.find((remotePlayer) => remotePlayer.id === selectedPlayerId) ?? null;
  const isLocalPartyLeader = partyMembers.some((member) => member.isSelf && member.isLeader);
  const activeMap = tiledWorld.current?.map;
  const minimapWorldWidth = activeMap ? activeMap.width * activeMap.tilewidth : WORLD.width;
  const minimapWorldHeight = activeMap ? activeMap.height * activeMap.tileheight : WORLD.height;
  const minimapEnemies = enemies.current.slice(0, 80);
  const minimapPlayers = displayedRemotePlayersRef.current.slice(0, 12);
  const selectedPlayerHpPercent = selectedPlayer
    ? (clamp(selectedPlayer.hp ?? selectedPlayer.maxHp, 0, selectedPlayer.maxHp ?? 1) / Math.max(1, selectedPlayer.maxHp ?? 1)) * 100
    : 0;

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
            <button className="talents-button" type="button" onClick={() => setSettingsOpen((open) => !open)}>
              <Settings size={18} />
              <span>Settings</span>
            </button>
          </div>
        )}
        <div className="hud top-right">
          <Map size={18} />
          <span>
            {Math.round(position.x)}, {Math.round(position.y)} | {gold}g
          </span>
        </div>
        {character && (
          <div className="minimap-panel" onClick={() => setMapOpen(true)} role="button" tabIndex={0}>
            <div className="minimap-grid">
              {minimapEnemies.map((enemy) => (
                <span
                  className={`minimap-dot enemy ${enemy.type?.includes('boss') ? 'boss' : ''}`}
                  key={enemy.id}
                  style={{
                    left: `${clamp((enemy.x / minimapWorldWidth) * 100, 0, 100)}%`,
                    top: `${clamp((enemy.y / minimapWorldHeight) * 100, 0, 100)}%`,
                  }}
                />
              ))}
              {minimapPlayers.map((remotePlayer) => (
                <span
                  className="minimap-dot player"
                  key={remotePlayer.id}
                  style={{
                    left: `${clamp((remotePlayer.x / minimapWorldWidth) * 100, 0, 100)}%`,
                    top: `${clamp((remotePlayer.y / minimapWorldHeight) * 100, 0, 100)}%`,
                  }}
                />
              ))}
              <span
                className="minimap-dot self"
                style={{
                  left: `${clamp((position.x / minimapWorldWidth) * 100, 0, 100)}%`,
                  top: `${clamp((position.y / minimapWorldHeight) * 100, 0, 100)}%`,
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
        {character && gameMenuOpen && (
          <aside className="game-menu-panel">
            <div className="panel-heading">
              <strong>Menu</strong>
              <span>Esc</span>
            </div>
            <button type="button" onClick={() => setGameMenuOpen(false)}>Resume</button>
            <button type="button" onClick={() => setSettingsOpen((open) => !open)}>Settings</button>
            <button type="button" onClick={saveCurrentCharacter}>Character Menu</button>
          </aside>
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
              <span>Attack Speed <strong>{Number(currentStats.attackSpeed ?? 1).toFixed(2)}x</strong></span>
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
            <p className="inventory-label">Bag {bagItems.length}/{INVENTORY_CAPACITY}</p>
            <div className="inventory-grid">
              {Array.from({ length: INVENTORY_CAPACITY }).map((_, index) => {
                const item = bagItems[index];
                const tooltip = item
                  ? `${item.name}\n${item.rarity} ${EQUIPMENT_SLOTS.find((slot) => slot.id === item.slot)?.label ?? item.slot}\n${formatItemStats(item.stats)}\n${getItemComparison(item, equippedItems)}`
                  : 'Empty';
                return (
                  <button
                    className={`inventory-cell icon-only ${item ? item.rarity.toLowerCase() : 'empty'}`}
                    disabled={!item}
                    key={item?.id ?? `empty-${index}`}
                    title={tooltip}
                    type="button"
                    onClick={() => item && equipItem(item.id)}
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
              <span>{availableTalentPoints}</span>
            </div>
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
                    return (
                      <section className={`talent-branch ${specSelected ? 'selected' : ''}`} key={specId}>
                        <button
                          className="talent-branch-header"
                          disabled={currentLevel < talentTree.unlockLevel}
                          type="button"
                          onClick={() => chooseTalentSpec(specId)}
                        >
                          <strong>{spec.name}</strong>
                          <span>{spec.role}</span>
                          <small>{spec.description}</small>
                        </button>
                        <div className="talent-node-row">
                          {TALENT_NODES.map((node) => {
                            const nodeKey = getTalentNodeKey(specId, node.id);
                            const rank = Number(specRanks[nodeKey] ?? 0);
                            const locked = currentLevel < talentTree.unlockLevel
                              || selectedTalentSpec !== specId
                              || availableTalentPoints <= 0
                              || rank >= node.maxRank
                              || (node.requiresSpent && getSpecSpentPoints(character, specId) < node.requiresSpent);
                            return (
                              <button
                                className={`talent-node ${rank > 0 ? 'ranked' : ''}`}
                                disabled={locked}
                                key={node.id}
                                title={node.description}
                                type="button"
                                onClick={() => spendTalentPoint(specId, node.id)}
                              >
                                <strong>{node.name}</strong>
                                <span>{rank}/{node.maxRank}</span>
                                <small>{node.id === 'signature' ? 'Unlock ability' : node.description}</small>
                              </button>
                            );
                          })}
                        </div>
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
            <div className="settings-buttons">
              <button type="button" onClick={() => document.documentElement.requestFullscreen?.()}>
                <Monitor size={16} />
                Fullscreen
              </button>
              <button type="button" onClick={() => document.documentElement.requestFullscreen?.()}>
                <Monitor size={16} />
                Fullscreen windowed
              </button>
              <button type="button" onClick={() => document.exitFullscreen?.()}>
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
                <div className="ability-book-row" key={getAbilityId(ability)}>
                  <span className={`ability-icon ${ability.type}`}>{getAbilityIconLabel(ability)}</span>
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
          <aside className="world-map-panel">
            <div className="panel-heading">
              <strong>{currentMapId === 'dungeon_01' ? 'Dungeon Map' : 'World Map'}</strong>
              <span>M</span>
            </div>
            <div className="world-map-canvas">
              {minimapEnemies.map((enemy) => (
                <span
                  className={`map-dot enemy ${enemy.type?.includes('boss') ? 'boss' : ''}`}
                  key={enemy.id}
                  style={{
                    left: `${clamp((enemy.x / minimapWorldWidth) * 100, 0, 100)}%`,
                    top: `${clamp((enemy.y / minimapWorldHeight) * 100, 0, 100)}%`,
                  }}
                />
              ))}
              {minimapPlayers.map((remotePlayer) => (
                <span
                  className="map-dot player"
                  key={remotePlayer.id}
                  style={{
                    left: `${clamp((remotePlayer.x / minimapWorldWidth) * 100, 0, 100)}%`,
                    top: `${clamp((remotePlayer.y / minimapWorldHeight) * 100, 0, 100)}%`,
                  }}
                />
              ))}
              <span
                className="map-dot self"
                style={{
                  left: `${clamp((position.x / minimapWorldWidth) * 100, 0, 100)}%`,
                  top: `${clamp((position.y / minimapWorldHeight) * 100, 0, 100)}%`,
                }}
              />
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
                      <span className={`ability-icon ${ability.type}`}>{getAbilityIconLabel(ability)}</span>
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
            {lastCast && <div className="cast-toast">{lastCast}</div>}
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
