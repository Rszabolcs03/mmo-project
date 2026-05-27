import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import admin from 'firebase-admin';

const PORT = Number(process.env.PORT ?? 3001);
const REQUIRE_FIREBASE_AUTH = process.env.REQUIRE_FIREBASE_AUTH === 'true';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? '*';
const PLAYER_TIMEOUT_MS = 15000;
const ENEMY_MAX_COUNT = 12;
const ENEMY_SPAWN_EVERY = 1800;
const BOSS_SPAWN_MIN = 18000;
const BOSS_SPAWN_MAX = 34000;
const WORLD_SIZE = 6400;

const players = new Map();
const enemies = new Map();
let nextEnemyId = 1;
let nextSpawnAt = Date.now() + 1200;
let nextBossSpawnAt = Date.now() + nextBossDelay();
let enemySpawns = [];
let bossSpawns = [];
let lastTickAt = Date.now();
let lastEnemyBroadcastAt = 0;

function createFirebaseApp() {
  if (admin.apps.length) return admin.app();

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  if (REQUIRE_FIREBASE_AUTH) {
    throw new Error('Firebase Admin credentials are required when REQUIRE_FIREBASE_AUTH=true');
  }

  return null;
}

const firebaseApp = createFirebaseApp();
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/', (_request, response) => {
  response.json({
    ok: true,
    service: 'mmo-project socket server',
    health: '/health',
    players: players.size,
    enemies: enemies.size,
  });
});

app.get('/health', (_request, response) => {
  response.json({ ok: true, players: players.size, enemies: enemies.size });
});

async function verifySocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    const fallbackUid = socket.handshake.auth?.uid;

    if (firebaseApp && token) {
      const decoded = await admin.auth().verifyIdToken(token);
      socket.data.uid = decoded.uid;
      socket.data.email = decoded.email;
      return next();
    }

    if (REQUIRE_FIREBASE_AUTH) {
      return next(new Error('Missing Firebase token'));
    }

    socket.data.uid = fallbackUid || socket.id;
    return next();
  } catch (error) {
    return next(error);
  }
}

function sanitizePlayer(socket, payload = {}) {
  return {
    uid: socket.data.uid,
    socketId: socket.id,
    name: String(payload.name ?? 'Player').slice(0, 18),
    level: clampNumber(payload.level, 1, 20, 1),
    classId: String(payload.classId ?? 'warrior'),
    raceId: String(payload.raceId ?? 'human'),
    x: clampNumber(payload.x, 18, WORLD_SIZE, 420),
    y: clampNumber(payload.y, 18, WORLD_SIZE, 420),
    facing: Number.isFinite(payload.facing) ? payload.facing : 0,
    updatedAt: Date.now(),
  };
}

function sanitizeSpawn(spawn = {}) {
  return {
    name: String(spawn.name ?? 'spawn'),
    x: clampNumber(spawn.x, 0, WORLD_SIZE, 420),
    y: clampNumber(spawn.y, 0, WORLD_SIZE, 420),
    width: clampNumber(spawn.width, 1, WORLD_SIZE, 420),
    height: clampNumber(spawn.height, 1, WORLD_SIZE, 420),
  };
}

function updateWorldSpawns(payload = {}) {
  if (Array.isArray(payload.enemySpawns) && payload.enemySpawns.length > 0) {
    enemySpawns = payload.enemySpawns.map(sanitizeSpawn);
  }
  if (Array.isArray(payload.bossSpawns) && payload.bossSpawns.length > 0) {
    bossSpawns = payload.bossSpawns.map(sanitizeSpawn);
  }
}

function clampNumber(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function pickSpawn(spawns) {
  if (!spawns.length) return null;
  return spawns[Math.floor(Math.random() * spawns.length)];
}

function createEnemy(id, spawnObject, fallbackPosition) {
  const spawnPoint = randomPointInObject(spawnObject, fallbackPosition);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition);
  return {
    id,
    type: 'enemy',
    state: 'idle',
    targetSocketId: null,
    spawnName: spawnObject?.name,
    spawnBounds,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: Date.now() + 800 + Math.random() * 1800,
    x: clamp(spawnPoint.x, 17, WORLD_SIZE - 17),
    y: clamp(spawnPoint.y, 17, WORLD_SIZE - 17),
    hp: 100,
    maxHp: 100,
    radius: 17,
    speed: 82,
    xp: 35,
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
    nextAttackAt: 0,
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
    targetSocketId: null,
    spawnName: spawnObject?.name,
    spawnBounds,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: Date.now() + 1200 + Math.random() * 2200,
    x: clamp(spawnPoint.x, 42, WORLD_SIZE - 42),
    y: clamp(spawnPoint.y, 42, WORLD_SIZE - 42),
    hp: 620,
    maxHp: 620,
    radius: 36,
    speed: 54,
    xp: 180,
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
    nextAttackAt: 0,
  };
}

function fallbackSpawnPosition() {
  const firstPlayer = [...players.values()][0];
  return firstPlayer ? { x: firstPlayer.x, y: firstPlayer.y } : { x: 420, y: 420 };
}

function nextBossDelay() {
  return BOSS_SPAWN_MIN + Math.random() * (BOSS_SPAWN_MAX - BOSS_SPAWN_MIN);
}

function serializeEnemies() {
  return [...enemies.values()].map((enemy) => ({
    id: enemy.id,
    type: enemy.type,
    name: enemy.name,
    state: enemy.state,
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    hp: Math.max(0, Math.round(enemy.hp)),
    maxHp: enemy.maxHp,
    radius: enemy.radius,
    speed: enemy.speed,
    xp: enemy.xp,
    wobble: enemy.wobble,
    hitAt: enemy.hitAt,
  }));
}

function broadcastPlayers() {
  io.emit('players:snapshot', [...players.values()]);
}

function broadcastEnemies() {
  io.emit('enemies:snapshot', serializeEnemies());
}

function abilityHitsEnemy(ability, origin, facing, enemy) {
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const hitRadius = (enemy.radius ?? 17) + 7;
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

function handleAbilityCast(socket, payload = {}) {
  const caster = players.get(socket.id);
  if (!caster) return;

  const ability = {
    key: String(payload.key ?? ''),
    name: String(payload.name ?? 'Ability').slice(0, 32),
    type: String(payload.type ?? 'bolt'),
    color: String(payload.color ?? '#8be9fd'),
    damage: clampNumber(payload.damage, 0, 500, 0),
    duration: clampNumber(payload.duration, 120, 5000, 650),
    clientCastId: String(payload.clientCastId ?? ''),
  };
  const origin = {
    x: clampNumber(payload.x, 0, WORLD_SIZE, caster.x),
    y: clampNumber(payload.y, 0, WORLD_SIZE, caster.y),
  };
  const facing = Number.isFinite(payload.facing) ? payload.facing : caster.facing;
  const now = Date.now();

  if (!payload.damageOnly) {
    io.emit('ability:effect', {
      ...ability,
      casterUid: socket.data.uid,
      x: origin.x,
      y: origin.y,
      facing,
      startedAt: now,
    });
  }

  if (!ability.damage) return;

  let xp = 0;
  let bossKills = 0;
  let changed = false;
  enemies.forEach((enemy, id) => {
    if (!abilityHitsEnemy(ability, origin, facing, enemy)) return;

    enemy.hp -= ability.damage;
    enemy.state = 'aggro';
    enemy.targetSocketId = socket.id;
    enemy.hitAt = now;
    changed = true;

    if (enemy.hp <= 0) {
      xp += enemy.xp ?? 35;
      if (enemy.type === 'boss') bossKills += 1;
      enemies.delete(id);
    }
  });

  if (xp > 0) {
    socket.emit('player:reward', { xp, bossKills });
  }
  if (changed) broadcastEnemies();
}

function tickEnemies() {
  const now = Date.now();
  const delta = Math.min((now - lastTickAt) / 1000, 0.05);
  lastTickAt = now;

  if (players.size > 0 && now >= nextSpawnAt && enemies.size < ENEMY_MAX_COUNT) {
    const enemy = createEnemy(nextEnemyId, pickSpawn(enemySpawns), fallbackSpawnPosition());
    enemies.set(nextEnemyId, enemy);
    nextEnemyId += 1;
    nextSpawnAt = now + ENEMY_SPAWN_EVERY;
  }

  const bossAlive = [...enemies.values()].some((enemy) => enemy.type === 'boss');
  if (players.size > 0 && !bossAlive && now >= nextBossSpawnAt) {
    const boss = createBoss(nextEnemyId, pickSpawn(bossSpawns), fallbackSpawnPosition());
    enemies.set(nextEnemyId, boss);
    nextEnemyId += 1;
    nextBossSpawnAt = now + nextBossDelay();
    io.emit('server:message', 'Boss spawned: Rift Brute');
  }

  enemies.forEach((enemy) => {
    if (enemy.state !== 'aggro') {
      const bounds = enemy.spawnBounds;
      let target = enemy.wanderTarget;
      const shouldPickNewTarget = !target || now >= enemy.nextWanderAt || distance(enemy, target) < 8;
      if (shouldPickNewTarget) target = randomPointInBounds(bounds);

      const toTargetX = target.x - enemy.x;
      const toTargetY = target.y - enemy.y;
      const length = Math.hypot(toTargetX, toTargetY) || 1;
      const wanderSpeed = enemy.type === 'boss' ? 22 : 34;
      enemy.wanderTarget = target;
      enemy.nextWanderAt = shouldPickNewTarget ? now + 900 + Math.random() * 2200 : enemy.nextWanderAt;
      enemy.x = clamp(enemy.x + (toTargetX / length) * wanderSpeed * delta, bounds.x + enemy.radius, bounds.x + bounds.width - enemy.radius);
      enemy.y = clamp(enemy.y + (toTargetY / length) * wanderSpeed * delta, bounds.y + enemy.radius, bounds.y + bounds.height - enemy.radius);
      return;
    }

    const target = players.get(enemy.targetSocketId) ?? [...players.values()][0];
    if (!target) {
      enemy.state = 'idle';
      enemy.targetSocketId = null;
      return;
    }

    const toPlayerX = target.x - enemy.x;
    const toPlayerY = target.y - enemy.y;
    const length = Math.hypot(toPlayerX, toPlayerY) || 1;
    const drift = Math.sin(now / 520 + enemy.wobble) * 0.35;
    const dirX = toPlayerX / length;
    const dirY = toPlayerY / length;
    const attackRange = enemy.radius + 18 + 8;

    if (length <= attackRange && now >= enemy.nextAttackAt) {
      const damage = enemy.type === 'boss' ? 28 : 9;
      io.to(target.socketId).emit('player:hit', { damage });
      enemy.nextAttackAt = now + (enemy.type === 'boss' ? 1100 : 850);
      return;
    }

    enemy.x = clamp(enemy.x + (dirX - dirY * drift) * enemy.speed * delta, enemy.radius, WORLD_SIZE - enemy.radius);
    enemy.y = clamp(enemy.y + (dirY + dirX * drift) * enemy.speed * delta, enemy.radius, WORLD_SIZE - enemy.radius);
  });

  if (now - lastEnemyBroadcastAt > 100) {
    lastEnemyBroadcastAt = now;
    broadcastEnemies();
  }
}

io.use(verifySocket);

io.on('connection', (socket) => {
  socket.emit('enemies:snapshot', serializeEnemies());

  socket.on('world:init', (payload) => {
    updateWorldSpawns(payload);
  });

  socket.on('player:join', (payload) => {
    updateWorldSpawns(payload?.world);
    players.set(socket.id, sanitizePlayer(socket, payload));
    broadcastPlayers();
    socket.emit('enemies:snapshot', serializeEnemies());
  });

  socket.on('player:update', (payload) => {
    if (!players.has(socket.id)) {
      players.set(socket.id, sanitizePlayer(socket, payload));
    } else {
      players.set(socket.id, {
        ...players.get(socket.id),
        ...sanitizePlayer(socket, payload),
      });
    }
    broadcastPlayers();
  });

  socket.on('ability:cast', (payload) => {
    handleAbilityCast(socket, payload);
  });

  socket.on('player:leave', () => {
    players.delete(socket.id);
    broadcastPlayers();
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    broadcastPlayers();
  });
});

setInterval(() => {
  const now = Date.now();
  let changed = false;
  players.forEach((player, socketId) => {
    if (now - player.updatedAt > PLAYER_TIMEOUT_MS) {
      players.delete(socketId);
      changed = true;
    }
  });
  if (changed) broadcastPlayers();
}, 5000);

setInterval(tickEnemies, 50);

server.listen(PORT, () => {
  console.log(`MMO socket server listening on ${PORT}`);
});
