import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ABILITY_ROOT = join(ROOT, 'public', 'assets', 'abilities');
const CLASSES = ['priest', 'paladin', 'hunter', 'mage', 'rogue', 'warrior'];
const GROUPS = ['icons', 'effects', 'projectiles', 'impacts', 'sounds'];

const CLASS_THEMES = {
  priest: { primary: '#fef3c7', secondary: '#facc15', accent: '#8b5cf6', dark: '#3b2a14' },
  paladin: { primary: '#fef08a', secondary: '#f59e0b', accent: '#f8fafc', dark: '#4a3008' },
  hunter: { primary: '#86efac', secondary: '#365c2d', accent: '#d6a354', dark: '#1f331d' },
  mage: { primary: '#67e8f9', secondary: '#2563eb', accent: '#c084fc', dark: '#172554' },
  rogue: { primary: '#d8b4fe', secondary: '#1f2937', accent: '#a3a3a3', dark: '#0f172a' },
  warrior: { primary: '#fecaca', secondary: '#7f1d1d', accent: '#cbd5e1', dark: '#301313' },
};

const ABILITIES = {
  mage: [
    ['Firebolt', 'bolt', '#ff6b35'], ['Frost Nova', 'nova', '#7dd3fc'], ['Arcane Lance', 'shot', '#c084fc'],
    ['Meteor Ring', 'shout', '#fb7185'], ['Ice Prison', 'trap', '#bae6fd'], ['Star Surge', 'bolt', '#fef08a'],
    ['Arcane Bolt', 'bolt', '#67e8f9'], ['Mana Pulse', 'nova', '#22d3ee'], ['Spellweave', 'shot', '#a5f3fc'],
    ['Astral Storm', 'shout', '#67e8f9'], ['Frost Spike', 'shot', '#7dd3fc'], ['Ice Ward', 'shield', '#bae6fd'],
    ['Winter Ring', 'nova', '#e0f2fe'], ['Glacial Prison', 'trap', '#e0f2fe'], ['Arcane Singularity', 'trap', '#67e8f9'],
    ['Deep Freeze', 'trap', '#bae6fd'], ['Wand Bolt', 'bolt', '#8be9fd'], ['Aegis Ward', 'buff', '#93c5fd'],
    ['Frost Bolt', 'bolt', '#bae6fd'], ['Frozen Circle', 'trap', '#e0f2fe'], ['Hailstorm', 'ground', '#7dd3fc'],
    ['Shatter Spike', 'shot', '#67e8f9'], ['Ice Block', 'buff', '#bfdbfe'], ['Fire Bolt', 'bolt', '#fb923c'],
    ['Fireball', 'shot', '#f97316'], ['Flame Wave', 'aura', '#ef4444'], ['Burning Ground', 'ground', '#fb923c'],
    ['Inferno Form', 'buff', '#f97316'], ['Blink', 'buff', '#93c5fd'],
  ],
  hunter: [
    ['Piercing Shot', 'shot', '#facc15'], ['Trap', 'trap', '#fb923c'], ['Rapid Arrow', 'bolt', '#bef264'],
    ['Explosive Trap', 'trap', '#fdba74'], ['Volley', 'shout', '#fde047'], ['Deadeye', 'shot', '#fefce8'],
    ['Raptor Shot', 'shot', '#fde68a'], ['Pack Howl', 'shout', '#bef264'], ['Mammoth Rake', 'strike', '#86efac'],
    ['Stampede', 'trap', '#fde047'], ['Viper Shot', 'bolt', '#fdba74'], ['Hardened Trap', 'trap', '#fdba74'],
    ['Volley Mark', 'shout', '#fef08a'], ['Snare Burst', 'trap', '#fb923c'], ['Alpha Command', 'shout', '#bef264'],
    ['Wildfire Snare', 'trap', '#fb923c'], ['Auto Shot', 'shot', '#facc15'], ['Aegis Ward', 'buff', '#93c5fd'],
    ['Steady Shot', 'shot', '#facc15'], ['Multishot', 'cleave', '#fde047'], ['Rapid Fire', 'channel', '#bef264'],
    ['True Shot', 'shot', '#fef08a'], ['Barbed Shot', 'shot', '#d6a354'], ['Poison Arrow', 'bolt', '#86efac'],
    ['Arrow Rain', 'ground', '#fde047'], ['Predator Focus', 'buff', '#bef264'], ['Dash', 'buff', '#86efac'],
    ['Disengage Dash', 'buff', '#86efac'], ['Pet Bite', 'strike', '#bef264'],
  ],
  paladin: [
    ['Holy Strike', 'strike', '#fff3a3'], ['Divine Shield', 'shield', '#fef08a'], ['Judgement', 'bolt', '#fde68a'],
    ['Consecration', 'nova', '#fef3c7'], ['Hammer Toss', 'shot', '#e5e7eb'], ['Radiant Burst', 'shout', '#fef08a'],
    ['Crusader Swing', 'strike', '#fde68a'], ['Hammerstorm', 'aura', '#facc15'], ['Consecrated Field', 'ground', '#fef3c7'],
    ["Zealot's Edge", 'buff', '#fff7ad'], ['Shield Slam', 'strike', '#bfdbfe'], ["Avenger's Shield", 'chain', '#fef08a'],
    ['Guardian Hammers', 'aura', '#fde68a'], ['Bastion Renewal', 'buff', '#e0f2fe'], ['Avenging Radiance', 'buff', '#fef08a'],
    ['Divine Bulwark', 'buff', '#dbeafe'], ['Swing', 'strike', '#fde68a'], ['Aegis Ward', 'buff', '#fef08a'],
    ['Final Reckoning', 'buff', '#facc15'],
  ],
  warrior: [
    ['Cleave', 'cleave', '#f97316'], ['Battle Shout', 'shout', '#ef4444'], ['Charge Slash', 'strike', '#fb923c'],
    ['Whirlwind', 'nova', '#f87171'], ['Ground Breaker', 'trap', '#a16207'], ['Execute', 'shot', '#fecaca'],
    ['Raging Cleave', 'cleave', '#fdba74'], ['Blood Howl', 'shout', '#fb7185'], ['Mortal Frenzy', 'strike', '#fda4af'],
    ['Rage Execution', 'shot', '#fecdd3'], ['Shield Slam', 'strike', '#d1d5db'], ['Guarded Roar', 'shield', '#e5e7eb'],
    ['Bulwark Charge', 'cleave', '#f1f5f9'], ['Immovable Front', 'trap', '#cbd5e1'], ['Rampage', 'cleave', '#fb7185'],
    ['Iron Quake', 'nova', '#cbd5e1'], ['Swing', 'strike', '#d1d5db'], ['Aegis Ward', 'buff', '#93c5fd'],
    ['Slash', 'strike', '#fecaca'], ['Sweeping Slash', 'cleave', '#fb923c'], ['Double Slash', 'cleave', '#f87171'],
    ['Bladestorm', 'aura', '#ef4444'], ['Blood Frenzy', 'buff', '#dc2626'], ['Shield Sweep', 'aura', '#cbd5e1'],
    ['Guard Wall', 'shield', '#e5e7eb'], ['Vanguard Cleave', 'cleave', '#f1f5f9'], ['Last Stand', 'buff', '#d1d5db'],
    ['Charge', 'buff', '#fb923c'], ['War Charge', 'nova', '#fb923c'],
  ],
  priest: [
    ['Smite', 'bolt', '#fef3c7'], ['Holy Nova', 'nova', '#fde68a'], ['Mind Spike', 'shot', '#c4b5fd'],
    ['Sanctuary', 'shield', '#fef08a'], ['Penance', 'bolt', '#e9d5ff'], ['Divine Wrath', 'shout', '#fff7ed'],
    ['Void Lance', 'bolt', '#8b5cf6'], ['Void Flay', 'channel', '#5b21b6'], ['Void Plague', 'ground', '#6d28d9'],
    ['Void Shield', 'buff', '#7c3aed'], ['Angelic Pierce', 'bolt', '#fef3c7'], ['Mend', 'hot', '#fde68a'],
    ['Sanctified Ground', 'healGround', '#facc15'], ['Enter the Void', 'buff', '#4c1d95'], ['Void Rift', 'ground', '#581c87'],
    ['Become the Ascended', 'buff', '#fef08a'], ['Void Spark', 'bolt', '#8b5cf6'], ['Light Spark', 'bolt', '#fde68a'],
    ['Fade', 'buff', '#c4b5fd'],
    ['Void Bolt', 'bolt', '#8b5cf6'], ['Flay', 'channel', '#5b21b6'], ['Mind Blast', 'ground', '#7c3aed'],
    ['Void Curse', 'ground', '#581c87'], ['Void Form', 'buff', '#4c1d95'], ['Light Heal', 'heal', '#fef3c7'],
    ['Renew', 'hot', '#fde68a'], ['Radiant Circle', 'healGround', '#facc15'],
  ],
  rogue: [
    ['Quick Stab', 'strike', '#d8b4fe'], ['Blade Fan', 'cleave', '#a78bfa'], ['Poison Knife', 'shot', '#86efac'],
    ['Smoke Bomb', 'trap', '#94a3b8'], ['Ambush', 'strike', '#f0abfc'], ['Eviscerate', 'shot', '#f5d0fe'],
    ['Shadow Cut', 'strike', '#c084fc'], ['Poison Fan', 'cleave', '#86efac'], ['Backstab', 'strike', '#d8b4fe'],
    ['Nightfall', 'trap', '#7c3aed'], ['Twin Slash', 'cleave', '#f9a8d4'], ['Feint Step', 'shield', '#e9d5ff'],
    ['Piercing Lunge', 'shot', '#f0abfc'], ['Final Flourish', 'strike', '#f5d0fe'], ['Shadow Bloom', 'trap', '#a78bfa'],
    ['Perfect Riposte', 'strike', '#f0abfc'], ['Dagger Slice', 'strike', '#d8b4fe'], ['Aegis Ward', 'buff', '#93c5fd'],
    ['Vanish', 'buff', '#312e81'], ['Quick Cut', 'strike', '#d8b4fe'], ['Assassinate', 'strike', '#f0abfc'],
    ['Fan of Knives', 'nova', '#a78bfa'], ['Poison Blade', 'buff', '#86efac'], ['Crimson Rupture', 'strike', '#dc2626'],
    ['Shadow Slash', 'strike', '#c084fc'], ['Shadow Flurry', 'channel', '#7c3aed'], ['Shadowstep', 'strike', '#a78bfa'],
    ['Dagger Cyclone', 'aura', '#e9d5ff'], ['Shadow Frenzy', 'buff', '#312e81'],
  ],
};

function slug(name) {
  return String(name)
    .toLowerCase()
    .replace(/['\u2019`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hexToRgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

function createCanvas(width, height) {
  return new Uint8Array(width * height * 4);
}

function setPixel(buffer, canvasWidth, canvasHeight, x, y, rgba) {
  if (x < 0 || y < 0 || x >= canvasWidth || y >= canvasHeight) return;
  const index = (y * canvasWidth + x) * 4;
  buffer[index] = rgba[0];
  buffer[index + 1] = rgba[1];
  buffer[index + 2] = rgba[2];
  buffer[index + 3] = rgba[3];
}

function rect(buffer, canvasWidth, canvasHeight, x, y, width, height, color, alpha = 255) {
  const rgba = hexToRgba(color, alpha);
  const sx = Math.round(x);
  const sy = Math.round(y);
  const ex = Math.round(x + width);
  const ey = Math.round(y + height);
  for (let yy = sy; yy < ey; yy += 1) {
    for (let xx = sx; xx < ex; xx += 1) setPixel(buffer, canvasWidth, canvasHeight, xx, yy, rgba);
  }
}

function line(buffer, canvasWidth, canvasHeight, x1, y1, x2, y2, size, color, alpha = 255) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    rect(buffer, canvasWidth, canvasHeight, x1 + (x2 - x1) * t - size / 2, y1 + (y2 - y1) * t - size / 2, size, size, color, alpha);
  }
}

function ellipse(buffer, canvasWidth, canvasHeight, cx, cy, rx, ry, color, alpha = 255) {
  const rgba = hexToRgba(color, alpha);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPixel(buffer, canvasWidth, canvasHeight, x, y, rgba);
    }
  }
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(rgba, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, rowStart + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function savePng(path, buffer, width, height) {
  writeFileSync(path, encodePng(buffer, width, height));
}

function drawSymbol(buffer, width, height, type, x, y, size, color, theme, frame = 0) {
  const outline = '#061015';
  const pulse = frame % 2 === 0 ? 0 : 2;
  if (type === 'bolt' || type === 'shot') {
    line(buffer, width, height, x - size * 0.2, y + size * 0.4, x + size * 0.25 + pulse, y - size * 0.35, Math.max(3, size / 7), outline);
    line(buffer, width, height, x - size * 0.2, y + size * 0.4, x + size * 0.25 + pulse, y - size * 0.35, Math.max(2, size / 10), color);
    rect(buffer, width, height, x + size * 0.2, y - size * 0.43, size * 0.24, size * 0.24, theme.accent);
  } else if (type === 'strike' || type === 'cleave') {
    line(buffer, width, height, x - size * 0.34, y + size * 0.34, x + size * 0.34, y - size * 0.34, Math.max(5, size / 6), outline);
    line(buffer, width, height, x - size * 0.28, y + size * 0.28, x + size * 0.28, y - size * 0.28, Math.max(3, size / 9), color);
    rect(buffer, width, height, x - size * 0.39, y + size * 0.26, size * 0.22, size * 0.24, theme.secondary);
  } else if (type === 'aura' || type === 'nova' || type === 'shout') {
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10 + frame * 0.35;
      rect(buffer, width, height, x + Math.cos(angle) * (size * 0.34 + pulse) - 3, y + Math.sin(angle) * (size * 0.34 + pulse) - 3, 6, 6, i % 2 ? color : theme.accent);
    }
    ellipse(buffer, width, height, x, y, size * 0.18, size * 0.18, color, 210);
  } else if (type === 'ground' || type === 'trap' || type === 'healGround' || type === 'hot') {
    rect(buffer, width, height, x - size * 0.32, y - size * 0.2, size * 0.64, size * 0.4, outline, 230);
    rect(buffer, width, height, x - size * 0.26, y - size * 0.14, size * 0.52, size * 0.28, color, 220);
    for (let i = 0; i < 4; i += 1) rect(buffer, width, height, x - size * 0.22 + i * size * 0.14, y - size * 0.04 + (frame % 2) * 2, 5, 5, theme.accent);
  } else if (type === 'shield' || type === 'buff' || type === 'chain') {
    rect(buffer, width, height, x - size * 0.28, y - size * 0.34, size * 0.56, size * 0.18, outline);
    rect(buffer, width, height, x - size * 0.34, y - size * 0.18, size * 0.68, size * 0.42, outline);
    rect(buffer, width, height, x - size * 0.21, y + size * 0.19, size * 0.42, size * 0.18, outline);
    rect(buffer, width, height, x - size * 0.22, y - size * 0.19, size * 0.44, size * 0.42, color);
    rect(buffer, width, height, x - 3, y - size * 0.12, 6, size * 0.28, theme.dark);
    rect(buffer, width, height, x - size * 0.11, y - 3, size * 0.22, 6, theme.dark);
  } else if (type === 'channel') {
    for (let i = 0; i < 5; i += 1) {
      const offset = i * size * 0.12;
      rect(buffer, width, height, x - size * 0.3 + offset, y - size * 0.32 + offset + pulse, size * 0.18, size * 0.18, i % 2 ? color : theme.accent);
      rect(buffer, width, height, x + size * 0.18 - offset, y + size * 0.2 - offset - pulse, size * 0.16, size * 0.16, i % 2 ? theme.secondary : color);
    }
  } else {
    rect(buffer, width, height, x - size * 0.25, y - size * 0.25, size * 0.5, size * 0.5, color);
  }
}

function normalizedAbilityName(name) {
  return slug(name);
}

function drawPaladinHammer(buffer, width, height, x, y, size, angle, color = '#facc15', alpha = 255) {
  const outline = '#061015';
  const handle = '#7c4a12';
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const px = -sin;
  const py = cos;
  const start = { x: x - cos * size * 0.28, y: y - sin * size * 0.28 };
  const end = { x: x + cos * size * 0.34, y: y + sin * size * 0.34 };
  line(buffer, width, height, start.x, start.y, end.x, end.y, Math.max(4, size / 11), outline, alpha);
  line(buffer, width, height, start.x, start.y, end.x, end.y, Math.max(2, size / 18), handle, alpha);
  rect(buffer, width, height, end.x - px * size * 0.12 - size * 0.09, end.y - py * size * 0.12 - size * 0.09, size * 0.18, size * 0.18, outline, alpha);
  rect(buffer, width, height, end.x + px * size * 0.12 - size * 0.09, end.y + py * size * 0.12 - size * 0.09, size * 0.18, size * 0.18, outline, alpha);
  rect(buffer, width, height, end.x - px * size * 0.12 - size * 0.06, end.y - py * size * 0.12 - size * 0.06, size * 0.12, size * 0.12, color, alpha);
  rect(buffer, width, height, end.x + px * size * 0.12 - size * 0.06, end.y + py * size * 0.12 - size * 0.06, size * 0.12, size * 0.12, color, alpha);
}

function drawPaladinShield(buffer, width, height, x, y, size, color = '#fef08a', accent = '#f8fafc', alpha = 255) {
  const outline = '#061015';
  rect(buffer, width, height, x - size * 0.31, y - size * 0.34, size * 0.62, size * 0.15, outline, alpha);
  rect(buffer, width, height, x - size * 0.38, y - size * 0.2, size * 0.76, size * 0.46, outline, alpha);
  rect(buffer, width, height, x - size * 0.22, y + size * 0.2, size * 0.44, size * 0.2, outline, alpha);
  rect(buffer, width, height, x - size * 0.25, y - size * 0.2, size * 0.5, size * 0.43, accent, alpha);
  rect(buffer, width, height, x - size * 0.18, y - size * 0.15, size * 0.36, size * 0.32, color, Math.min(255, alpha));
  rect(buffer, width, height, x - size * 0.04, y - size * 0.1, size * 0.08, size * 0.23, outline, alpha);
  rect(buffer, width, height, x - size * 0.12, y - size * 0.02, size * 0.24, size * 0.08, outline, alpha);
}

function drawPaladinCross(buffer, width, height, x, y, size, color = '#fef08a', alpha = 255) {
  const outline = '#061015';
  rect(buffer, width, height, x - size * 0.08, y - size * 0.32, size * 0.16, size * 0.64, outline, alpha);
  rect(buffer, width, height, x - size * 0.26, y - size * 0.08, size * 0.52, size * 0.16, outline, alpha);
  rect(buffer, width, height, x - size * 0.05, y - size * 0.28, size * 0.1, size * 0.56, color, alpha);
  rect(buffer, width, height, x - size * 0.22, y - size * 0.05, size * 0.44, size * 0.1, color, alpha);
}

function drawPaladinField(buffer, width, height, x, y, size, color, theme, frame = 0) {
  const pulse = frame * 3;
  ellipse(buffer, width, height, x, y, size * 0.42 + pulse, size * 0.25 + pulse * 0.5, '#061015', 80);
  ellipse(buffer, width, height, x, y, size * 0.36 + pulse, size * 0.21 + pulse * 0.45, color, 70);
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    const px = x + Math.cos(angle) * (size * 0.28 + pulse);
    const py = y + Math.sin(angle) * (size * 0.17 + pulse * 0.35);
    drawPaladinCross(buffer, width, height, px, py, size * 0.17, i % 2 ? theme.accent : theme.secondary, 210);
  }
  drawPaladinCross(buffer, width, height, x, y, size * 0.34, theme.primary, 230);
}

function drawPaladinRays(buffer, width, height, x, y, size, color, theme, frame = 0) {
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12 + frame * 0.12;
    const inner = size * 0.16;
    const outer = size * (0.34 + frame * 0.03);
    line(
      buffer,
      width,
      height,
      x + Math.cos(angle) * inner,
      y + Math.sin(angle) * inner,
      x + Math.cos(angle) * outer,
      y + Math.sin(angle) * outer,
      3,
      i % 2 ? color : theme.accent,
      220,
    );
  }
  ellipse(buffer, width, height, x, y, size * 0.18, size * 0.18, color, 220);
  drawPaladinCross(buffer, width, height, x, y, size * 0.3, '#f8fafc', 240);
}

function drawPaladinAbilitySymbol(buffer, width, height, name, type, x, y, size, color, theme, frame = 0) {
  const key = normalizedAbilityName(name);
  if (key.includes('hammerstorm') || key.includes('guardian-hammers')) {
    for (let i = 0; i < 4; i += 1) {
      const angle = frame * 0.65 + (Math.PI * 2 * i) / 4;
      const hx = x + Math.cos(angle) * size * 0.32;
      const hy = y + Math.sin(angle) * size * 0.24;
      drawPaladinHammer(buffer, width, height, hx, hy, size * 0.5, angle + Math.PI / 4, color, 240);
    }
    ellipse(buffer, width, height, x, y, size * 0.18, size * 0.12, '#fef3c7', 120);
    return true;
  }
  if (key.includes('consecrated-field') || key === 'consecration') {
    drawPaladinField(buffer, width, height, x, y, size, color, theme, frame);
    return true;
  }
  if (key.includes('avenger') || key.includes('divine-shield') || key.includes('divine-bulwark') || key.includes('aegis-ward') || key.includes('shield-slam')) {
    if (key.includes('avenger')) {
      line(buffer, width, height, x - size * 0.36, y + size * 0.22, x + size * 0.3, y - size * 0.18, Math.max(5, size / 10), '#fef3c7', 150);
    }
    drawPaladinShield(buffer, width, height, x, y, size, color, theme.accent, 255);
    if (key.includes('shield-slam')) {
      drawPaladinHammer(buffer, width, height, x + size * 0.14, y + size * 0.1, size * 0.45, -Math.PI / 5, theme.secondary, 230);
    }
    return true;
  }
  if (key.includes('zealot') || key.includes('avenging-radiance') || key.includes('radiant-burst') || key.includes('bastion-renewal')) {
    drawPaladinRays(buffer, width, height, x, y, size, color, theme, frame);
    if (key.includes('bastion-renewal')) {
      drawPaladinShield(buffer, width, height, x, y + size * 0.03, size * 0.55, '#bfdbfe', '#f8fafc', 230);
    }
    return true;
  }
  if (key.includes('crusader-swing') || key.includes('holy-strike') || key === 'swing' || key.includes('hammer-toss')) {
    const angle = key.includes('hammer-toss') ? frame * 0.6 : -Math.PI / 4 + frame * 0.12;
    drawPaladinHammer(buffer, width, height, x, y, size * 0.95, angle, color, 255);
    drawPaladinCross(buffer, width, height, x + size * 0.2, y - size * 0.2, size * 0.22, '#f8fafc', 220);
    return true;
  }
  return false;
}

function drawIcon(classId, type, color, name) {
  const width = 64;
  const height = 64;
  const buffer = createCanvas(width, height);
  const theme = CLASS_THEMES[classId];
  rect(buffer, width, height, 7, 7, 50, 50, '#061015', 235);
  rect(buffer, width, height, 10, 10, 44, 44, theme.dark, 255);
  rect(buffer, width, height, 13, 13, 38, 38, theme.secondary, 130);
  rect(buffer, width, height, 10, 10, 44, 3, theme.primary, 180);
  rect(buffer, width, height, 10, 51, 44, 3, '#020617', 200);
  if (!(classId === 'paladin' && drawPaladinAbilitySymbol(buffer, width, height, name, type, 32, 32, 38, color, theme, 0))) {
    drawSymbol(buffer, width, height, type, 32, 32, 38, color, theme, 0);
  }
  return { buffer, width, height };
}

function drawSheet(frameWidth, frameHeight, frameCount, drawFrame) {
  const width = frameWidth * frameCount;
  const height = frameHeight;
  const buffer = createCanvas(width, height);
  for (let frame = 0; frame < frameCount; frame += 1) drawFrame(buffer, width, height, frame, frame * frameWidth, 0);
  return { buffer, width, height };
}

function drawEffectSheet(classId, type, color, name) {
  const theme = CLASS_THEMES[classId];
  return drawSheet(64, 64, 4, (buffer, width, height, frame, ox, oy) => {
    const key = normalizedAbilityName(name);
    if (key === 'arrow-rain') {
      for (let i = 0; i < 9; i += 1) {
        const x = ox + 10 + i * 6 + (frame % 2) * 2;
        const y = oy + 8 + ((i * 7 + frame * 8) % 48);
        line(buffer, width, height, x - 4, y - 10, x + 5, y + 10, 3, '#fef3c7', 230);
        rect(buffer, width, height, x + 3, y + 7, 6, 5, '#a16207', 245);
      }
      ellipse(buffer, width, height, ox + 32, oy + 48, 24, 7, '#fde047', 80);
      return;
    }
    if (key === 'hailstorm') {
      for (let i = 0; i < 12; i += 1) {
        const x = ox + 8 + ((i * 13 + frame * 5) % 50);
        const y = oy + 6 + ((i * 9 + frame * 10) % 50);
        rect(buffer, width, height, x - 3, y - 3, 7, 7, i % 2 ? '#e0f2fe' : '#7dd3fc', 235);
        rect(buffer, width, height, x - 1, y - 5, 4, 4, '#f8fafc', 210);
      }
      ellipse(buffer, width, height, ox + 32, oy + 48, 25, 8, '#bae6fd', 75);
      return;
    }
    if (classId === 'paladin' && drawPaladinAbilitySymbol(buffer, width, height, name, type, ox + 32, oy + 32, 42, color, theme, frame)) {
      return;
    }
    const radius = 12 + frame * 5;
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12 + frame * 0.4;
      rect(buffer, width, height, ox + 32 + Math.cos(angle) * radius - 3, oy + 32 + Math.sin(angle) * radius - 3, 6, 6, i % 2 ? color : theme.accent, 230);
    }
    drawSymbol(buffer, width, height, type, ox + 32, oy + 32, 34, color, theme, frame);
  });
}

function drawProjectileSheet(classId, type, color, name) {
  const theme = CLASS_THEMES[classId];
  return drawSheet(32, 32, 4, (buffer, width, height, frame, ox, oy) => {
    const key = normalizedAbilityName(name);
    if (key === 'arrow-rain') {
      line(buffer, width, height, ox + 10, oy + 2 + frame, ox + 20, oy + 28 - frame, 4, '#fef3c7', 245);
      rect(buffer, width, height, ox + 18, oy + 24 - frame, 7, 5, '#a16207', 245);
      return;
    }
    if (key === 'hailstorm') {
      rect(buffer, width, height, ox + 12, oy + 4 + frame, 10, 10, '#e0f2fe', 245);
      rect(buffer, width, height, ox + 15, oy + 1 + frame, 5, 5, '#f8fafc', 220);
      rect(buffer, width, height, ox + 9, oy + 11 + frame, 6, 6, '#7dd3fc', 230);
      return;
    }
    if (classId === 'paladin' && (key.includes('avenger') || key.includes('divine-shield') || key.includes('aegis'))) {
      drawPaladinShield(buffer, width, height, ox + 16, oy + 16, 22 + (frame % 2) * 2, color, theme.accent, 245);
      line(buffer, width, height, ox + 3, oy + 25 - frame, ox + 12, oy + 20 - frame, 3, '#fef3c7', 140);
      return;
    }
    if (classId === 'paladin' && (key.includes('hammer') || key.includes('swing') || key.includes('strike') || key.includes('slam'))) {
      drawPaladinHammer(buffer, width, height, ox + 16, oy + 16, 26, frame * 0.7 - Math.PI / 5, color, 245);
      return;
    }
    line(buffer, width, height, ox + 5, oy + 20 - frame, ox + 23, oy + 8 + frame, 5, '#061015', 220);
    line(buffer, width, height, ox + 7, oy + 19 - frame, ox + 21, oy + 9 + frame, 3, color, 255);
    rect(buffer, width, height, ox + 21, oy + 7 + frame, 6, 6, theme.accent);
    if (type === 'chain' || type === 'shield') {
      rect(buffer, width, height, ox + 12, oy + 10, 10, 8, color);
      rect(buffer, width, height, ox + 14, oy + 12, 6, 5, theme.dark);
    }
  });
}

function drawImpactSheet(classId, type, color, name) {
  const theme = CLASS_THEMES[classId];
  return drawSheet(64, 64, 4, (buffer, width, height, frame, ox, oy) => {
    const key = normalizedAbilityName(name);
    if (key === 'arrow-rain') {
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        line(buffer, width, height, ox + 32, oy + 36, ox + 32 + Math.cos(angle) * (12 + frame * 4), oy + 36 + Math.sin(angle) * (8 + frame * 3), 3, i % 2 ? '#fde047' : '#fef3c7', 210);
      }
      rect(buffer, width, height, ox + 24, oy + 34, 17, 6, '#a16207', 220);
      return;
    }
    if (key === 'hailstorm') {
      for (let i = 0; i < 10; i += 1) {
        const angle = (Math.PI * 2 * i) / 10;
        rect(buffer, width, height, ox + 32 + Math.cos(angle) * (8 + frame * 5) - 3, oy + 34 + Math.sin(angle) * (6 + frame * 4) - 3, 7, 7, i % 2 ? '#e0f2fe' : '#7dd3fc', 220);
      }
      ellipse(buffer, width, height, ox + 32, oy + 38, 12 + frame * 4, 6 + frame * 2, '#bae6fd', 95);
      return;
    }
    if (classId === 'paladin') {
      if (key.includes('hammerstorm') || key.includes('guardian-hammers') || key.includes('consecrated-field') || key.includes('avenging-radiance') || key.includes('zealot')) {
        drawPaladinAbilitySymbol(buffer, width, height, name, type, ox + 32, oy + 32, 44, color, theme, frame);
        return;
      }
      if (key.includes('avenger') || key.includes('shield') || key.includes('bulwark') || key.includes('bastion')) {
        ellipse(buffer, width, height, ox + 32, oy + 34, 12 + frame * 5, 8 + frame * 3, color, 95);
        drawPaladinShield(buffer, width, height, ox + 32, oy + 30, 30 + frame * 3, color, theme.accent, 230);
        return;
      }
      if (key.includes('swing') || key.includes('strike') || key.includes('slam')) {
        drawPaladinHammer(buffer, width, height, ox + 32, oy + 32, 42, -Math.PI / 4 + frame * 0.22, color, 230);
        drawPaladinRays(buffer, width, height, ox + 32, oy + 32, 28 + frame * 2, color, theme, frame);
        return;
      }
    }
    const radius = 8 + frame * 7;
    ellipse(buffer, width, height, ox + 32, oy + 32, radius, radius * 0.7, color, 160 - frame * 20);
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      line(buffer, width, height, ox + 32, oy + 32, ox + 32 + Math.cos(angle) * (radius + 12), oy + 32 + Math.sin(angle) * (radius + 12), 3, i % 2 ? theme.accent : theme.primary, 230);
    }
    if (type === 'heal' || type === 'hot' || type === 'healGround') {
      rect(buffer, width, height, ox + 29, oy + 18, 6, 28, '#f8fafc');
      rect(buffer, width, height, ox + 20, oy + 27, 24, 6, '#f8fafc');
    }
  });
}

for (const group of GROUPS) {
  for (const classId of CLASSES) mkdirSync(join(ABILITY_ROOT, group, classId), { recursive: true });
}

for (const classId of CLASSES) {
  writeFileSync(join(ABILITY_ROOT, 'sounds', classId, '.gitkeep'), '');
  for (const [name, type, color] of ABILITIES[classId]) {
    const file = `${slug(name)}.png`;
    const icon = drawIcon(classId, type, color, name);
    savePng(join(ABILITY_ROOT, 'icons', classId, file), icon.buffer, icon.width, icon.height);
    const effect = drawEffectSheet(classId, type, color, name);
    savePng(join(ABILITY_ROOT, 'effects', classId, file), effect.buffer, effect.width, effect.height);
    const projectile = drawProjectileSheet(classId, type, color, name);
    savePng(join(ABILITY_ROOT, 'projectiles', classId, file), projectile.buffer, projectile.width, projectile.height);
    const impact = drawImpactSheet(classId, type, color, name);
    savePng(join(ABILITY_ROOT, 'impacts', classId, file), impact.buffer, impact.width, impact.height);
  }
}

console.log('Generated ability visual assets.');
