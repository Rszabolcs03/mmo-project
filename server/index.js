import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Room, Server } from 'colyseus';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const WORLD = {
  width: 6400,
  height: 6400,
};

const PLAYER = {
  radius: 18,
};

const ENEMY = {
  maxCount: 12,
  radius: 17,
  speed: 82,
  spawnEvery: 1800,
  wanderSpeed: 34,
};

const WORLD_BROADCAST_MS = 50;

const ENEMY_XP = 35;
const BOSS_XP = 180;
const BOSS_SPAWN_MIN = 18000;
const BOSS_SPAWN_MAX = 34000;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point, start, end) {
  const lineX = end.x - start.x;
  const lineY = end.y - start.y;
  const lengthSquared = lineX * lineX + lineY * lineY;
  if (lengthSquared === 0) return distance(point, start);

  const t = clamp(((point.x - start.x) * lineX + (point.y - start.y) * lineY) / lengthSquared, 0, 1);
  return distance(point, { x: start.x + t * lineX, y: start.y + t * lineY });
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function getProperties(object) {
  return Object.fromEntries((object?.properties ?? []).map((property) => [property.name, property.value]));
}

function loadTiledSpawns() {
  try {
    const mapPath = path.join(rootDir, 'public', 'maps', 'world.tmj');
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    const objectLayers = (map.layers ?? []).filter((layer) => layer.type === 'objectgroup');
    const spawnsLayer = objectLayers.find((layer) => layer.name === 'Spawns');
    const bossSpawnsLayer = objectLayers.find((layer) => layer.name === 'BossSpawns');
    const spawns = [
      ...(spawnsLayer?.objects ?? []),
      ...(bossSpawnsLayer?.objects ?? []),
    ].map((spawn) => ({ ...spawn, props: getProperties(spawn) }));

    return {
      enemySpawns: spawns.filter((spawn) => spawn.props.enemyType || spawn.name?.toLowerCase().includes('spawn')),
      bossSpawns: spawns.filter((spawn) => spawn.props.bossType || spawn.name?.toLowerCase().includes('boss')),
    };
  } catch (error) {
    console.warn('Map spawns could not be loaded, using fallback spawns:', error.message);
    return {
      enemySpawns: [{ x: 720, y: 520, width: 420, height: 320, name: 'fallback_spawn' }],
      bossSpawns: [{ x: 1200, y: 720, width: 520, height: 420, name: 'fallback_boss' }],
    };
  }
}

function randomPointInBounds(bounds) {
  return {
    x: bounds.x + Math.random() * Math.max(1, bounds.width),
    y: bounds.y + Math.random() * Math.max(1, bounds.height),
  };
}

function getSpawnBounds(spawnObject, fallbackPosition, fallbackSize = 360) {
  if (!spawnObject) {
    return {
      x: fallbackPosition.x - fallbackSize / 2,
      y: fallbackPosition.y - fallbackSize / 2,
      width: fallbackSize,
      height: fallbackSize,
    };
  }

  return {
    x: Number(spawnObject.x ?? fallbackPosition.x - fallbackSize / 2),
    y: Number(spawnObject.y ?? fallbackPosition.y - fallbackSize / 2),
    width: Number(spawnObject.width ?? fallbackSize),
    height: Number(spawnObject.height ?? fallbackSize),
  };
}

function randomPointInObject(spawnObject, fallbackPosition) {
  return randomPointInBounds(getSpawnBounds(spawnObject, fallbackPosition));
}

function pickSpawn(spawns) {
  if (!spawns.length) return null;
  return spawns[Math.floor(Math.random() * spawns.length)];
}

function nextBossDelay() {
  return BOSS_SPAWN_MIN + Math.random() * (BOSS_SPAWN_MAX - BOSS_SPAWN_MIN);
}

function createEnemy(id, spawnObject, fallbackPosition) {
  const spawnPoint = randomPointInObject(spawnObject, fallbackPosition);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition);

  return {
    id: String(id),
    type: 'enemy',
    name: 'Wolf',
    spawnName: spawnObject?.name,
    spawnBounds,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: 0,
    x: clamp(spawnPoint.x, ENEMY.radius, WORLD.width - ENEMY.radius),
    y: clamp(spawnPoint.y, ENEMY.radius, WORLD.height - ENEMY.radius),
    radius: ENEMY.radius,
    hp: 100,
    maxHp: 100,
    speed: ENEMY.speed,
    xp: ENEMY_XP,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function createBoss(id, spawnObject, fallbackPosition) {
  const spawnPoint = randomPointInObject(spawnObject, fallbackPosition);
  const spawnBounds = getSpawnBounds(spawnObject, fallbackPosition, 620);

  return {
    id: String(id),
    type: 'boss',
    name: 'Rift Brute',
    spawnName: spawnObject?.name,
    spawnBounds,
    wanderTarget: randomPointInBounds(spawnBounds),
    nextWanderAt: 0,
    x: clamp(spawnPoint.x, 42, WORLD.width - 42),
    y: clamp(spawnPoint.y, 42, WORLD.height - 42),
    radius: 42,
    hp: 620,
    maxHp: 620,
    speed: 58,
    xp: BOSS_XP,
    state: 'idle',
    wobble: Math.random() * Math.PI * 2,
    hitAt: 0,
  };
}

function abilityHitsEnemy(ability, origin, facing, enemy) {
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const hitRadius = (enemy.radius ?? ENEMY.radius) + 7;

  if (ability.type === 'bolt') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * 220, y: origin.y + fy * 220 }) < hitRadius;
  }
  if (ability.type === 'shot') {
    return distanceToSegment(enemy, origin, { x: origin.x + fx * 270, y: origin.y + fy * 270 }) < hitRadius - 4;
  }
  if (ability.type === 'trap') {
    return distance(enemy, { x: origin.x + fx * 95, y: origin.y + fy * 95 }) < 58 + hitRadius;
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

function abilityHealsPlayer(ability, origin, facing, player) {
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);

  if (ability.type === 'nova') {
    return distance(player, origin) < 150;
  }

  if (ability.type === 'heal') {
    const lineEnd = { x: origin.x + fx * 260, y: origin.y + fy * 260 };
    return distanceToSegment(player, origin, lineEnd) < 54 || distance(player, origin) < 92;
  }

  return distance(player, origin) < 120;
}

function sameParty(a, b) {
  return Boolean(a?.partyId && b?.partyId && a.partyId === b.partyId);
}

class WorldRoom extends Room {
  maxClients = 40;

  onCreate() {
    this.autoDispose = false;
    this.patchRate = null;
    this.players = new Map();
    this.pendingInvites = new Map();
    this.nextPartyId = 1;
    this.enemies = [];
    this.nextEnemyId = 1;
    this.nextSpawnAt = Date.now() + 800;
    this.nextBossSpawnAt = Date.now() + nextBossDelay();
    this.spawnData = loadTiledSpawns();

    this.onMessage('joinGame', (client, message) => {
      const character = message?.character ?? {};
      this.players.set(client.sessionId, {
        id: client.sessionId,
        name: character.name ?? 'Adventurer',
        classId: character.classId ?? 'warrior',
        raceId: character.raceId ?? 'human',
        level: character.level ?? 1,
        x: Number(message?.x ?? 420),
        y: Number(message?.y ?? 420),
        facing: Number(message?.facing ?? 0),
        hp: Number(message?.hp ?? message?.maxHp ?? 100),
        maxHp: Number(message?.maxHp ?? 100),
        partyId: null,
        updatedAt: Date.now(),
      });
    });

    this.onMessage('player', (client, message) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;
      const now = Date.now();
      const previousX = player.x;
      const previousY = player.y;
      const elapsed = Math.max(16, now - (player.updatedAt ?? now));
      player.x = clamp(Number(message?.x ?? player.x), PLAYER.radius, WORLD.width - PLAYER.radius);
      player.y = clamp(Number(message?.y ?? player.y), PLAYER.radius, WORLD.height - PLAYER.radius);
      player.vx = ((player.x - previousX) / elapsed) * 1000;
      player.vy = ((player.y - previousY) / elapsed) * 1000;
      player.facing = Number(message?.facing ?? player.facing);
      player.name = message?.name ?? player.name;
      player.classId = message?.classId ?? player.classId;
      player.raceId = message?.raceId ?? player.raceId;
      player.level = message?.level ?? player.level;
      player.maxHp = Math.max(1, Number(message?.maxHp ?? player.maxHp ?? 100));
      player.hp = clamp(Number(message?.hp ?? player.hp ?? player.maxHp), 0, player.maxHp);
      player.updatedAt = now;
    });

    this.onMessage('partyInvite', (client, message) => {
      const fromPlayer = this.players.get(client.sessionId);
      const targetId = message?.targetId;
      const targetPlayer = this.players.get(targetId);
      const targetClient = this.clients.find((candidate) => candidate.sessionId === targetId);
      if (!fromPlayer || !targetPlayer || !targetClient || targetId === client.sessionId) return;

      this.pendingInvites.set(`${client.sessionId}:${targetId}`, Date.now() + 30000);
      targetClient.send('partyInvite', {
        fromId: client.sessionId,
        fromName: fromPlayer.name,
      });
      client.send('notice', { text: `Party invite sent to ${targetPlayer.name}` });
    });

    this.onMessage('partyAccept', (client, message) => {
      const fromId = message?.fromId;
      const inviteKey = `${fromId}:${client.sessionId}`;
      const expiresAt = this.pendingInvites.get(inviteKey);
      const inviter = this.players.get(fromId);
      const accepter = this.players.get(client.sessionId);
      if (!expiresAt || expiresAt < Date.now() || !inviter || !accepter) return;

      this.pendingInvites.delete(inviteKey);
      const partyId = inviter.partyId ?? accepter.partyId ?? `party-${this.nextPartyId++}`;
      inviter.partyId = partyId;
      accepter.partyId = partyId;
      inviter.updatedAt = Date.now();
      accepter.updatedAt = Date.now();

      this.clients
        .filter((candidate) => candidate.sessionId === fromId || candidate.sessionId === client.sessionId)
        .forEach((candidate) => candidate.send('notice', { text: `${inviter.name} and ${accepter.name} joined a party` }));
    });

    this.onMessage('ability', (client, message) => {
      const player = this.players.get(client.sessionId);
      const ability = message?.ability;
      if (!player || !ability) return;

      const origin = {
        x: Number(message?.origin?.x ?? player.x),
        y: Number(message?.origin?.y ?? player.y),
      };
      const facing = Number(message?.facing ?? player.facing ?? 0);
      const damage = Number(message?.damage ?? ability.damage ?? 0);
      const healing = Number(message?.healing ?? ability.healing ?? 0);
      const xpAwards = new Map();
      const now = Date.now();

      if (!message?.effectOnly && damage > 0) {
        this.enemies = this.enemies
          .map((enemy) => {
            if (!abilityHitsEnemy(ability, origin, facing, enemy)) return enemy;
            const firstHitPlayerId = enemy.firstHitPlayerId ?? client.sessionId;
            if (enemy.hp - damage <= 0) {
              const previousAward = xpAwards.get(firstHitPlayerId) ?? { amount: 0, bossKills: 0 };
              xpAwards.set(firstHitPlayerId, {
                amount: previousAward.amount + (enemy.xp ?? ENEMY_XP),
                bossKills: previousAward.bossKills + (enemy.type === 'boss' ? 1 : 0),
              });
            }
            return {
              ...enemy,
              firstHitPlayerId,
              hp: enemy.hp - damage,
              state: 'aggro',
              targetPlayerId: enemy.targetPlayerId ?? client.sessionId,
              hitAt: now,
            };
          })
          .filter((enemy) => enemy.hp > 0);
      }

      if (healing > 0) {
        const directTargetId = message?.targetPlayerId;
        for (const [playerId, targetPlayer] of this.players.entries()) {
          if (playerId === client.sessionId) continue;
          if (directTargetId) {
            if (playerId !== directTargetId) continue;
          } else if (!abilityHealsPlayer(ability, origin, facing, targetPlayer)) {
            continue;
          }

          targetPlayer.hp = clamp((targetPlayer.hp ?? targetPlayer.maxHp ?? 100) + healing, 0, targetPlayer.maxHp ?? 100);
          targetPlayer.updatedAt = now;

          const targetClient = this.clients.find((candidate) => candidate.sessionId === playerId);
          targetClient?.send('heal', {
            amount: healing,
            sourceId: client.sessionId,
            abilityName: ability.name,
          });
        }
      }

      if (!message?.silent) {
        this.broadcast('effect', {
          ...ability,
          casterId: client.sessionId,
          x: origin.x,
          y: origin.y,
          facing,
          start: Date.now(),
          duration: ability.type === 'channel'
            ? ability.duration ?? 3000
            : ability.type === 'shield' || ability.type === 'heal'
              ? 900
              : 650,
        });
      }

      xpAwards.forEach((award, firstHitPlayerId) => {
        this.awardXpForEnemyKill(firstHitPlayerId, award.amount, award.bossKills);
      });
    });

    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / 30);
    this.clock.setInterval(() => this.broadcastWorld(), WORLD_BROADCAST_MS);
  }

  onJoin(client) {
    client.send('hello', { sessionId: client.sessionId });
  }

  onLeave(client) {
    this.players.delete(client.sessionId);
    this.pendingInvites.forEach((_, key) => {
      if (key.startsWith(`${client.sessionId}:`) || key.endsWith(`:${client.sessionId}`)) {
        this.pendingInvites.delete(key);
      }
    });
    this.enemies = this.enemies.map((enemy) => (
      enemy.targetPlayerId === client.sessionId ? { ...enemy, state: 'idle', targetPlayerId: null } : enemy
    ));
  }

  update(deltaTime) {
    const now = Date.now();
    const delta = Math.min(deltaTime / 1000, 0.05);
    const fallbackPlayer = [...this.players.values()][0] ?? { x: 600, y: 480 };

    if (this.players.size > 0 && now >= this.nextSpawnAt && this.enemies.length < ENEMY.maxCount) {
      this.enemies.push(createEnemy(this.nextEnemyId, pickSpawn(this.spawnData.enemySpawns), fallbackPlayer));
      this.nextEnemyId += 1;
      this.nextSpawnAt = now + ENEMY.spawnEvery;
    }

    const bossAlive = this.enemies.some((enemy) => enemy.type === 'boss');
    if (this.players.size > 0 && !bossAlive && now >= this.nextBossSpawnAt) {
      this.enemies.push(createBoss(this.nextEnemyId, pickSpawn(this.spawnData.bossSpawns), fallbackPlayer));
      this.nextEnemyId += 1;
      this.nextBossSpawnAt = now + nextBossDelay();
      this.broadcast('notice', { text: 'Boss spawned: Rift Brute' });
    }

    this.enemies = this.enemies.map((enemy) => {
      const targetPlayer = enemy.targetPlayerId ? this.players.get(enemy.targetPlayerId) : null;
      if (!targetPlayer && enemy.state === 'aggro') {
        return { ...enemy, state: 'idle', targetPlayerId: null };
      }

      if (enemy.state !== 'aggro') {
        const bounds = enemy.spawnBounds;
        let target = enemy.wanderTarget;
        const shouldPickNewTarget = !target || now >= enemy.nextWanderAt || distance(enemy, target) < 8;
        if (shouldPickNewTarget) target = randomPointInBounds(bounds);

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

      const toPlayerX = targetPlayer.x - enemy.x;
      const toPlayerY = targetPlayer.y - enemy.y;
      const length = Math.hypot(toPlayerX, toPlayerY) || 1;
      const drift = Math.sin(now / 520 + enemy.wobble) * 0.35;
      const dirX = toPlayerX / length;
      const dirY = toPlayerY / length;
      const attackRange = (enemy.radius ?? ENEMY.radius) + PLAYER.radius + 8;
      const nextAttackAt = enemy.nextAttackAt ?? 0;

      if (length <= attackRange && now >= nextAttackAt) {
        const damage = enemy.type === 'boss' ? 28 : 9;
        targetPlayer.hp = clamp((targetPlayer.hp ?? targetPlayer.maxHp ?? 100) - damage, 0, targetPlayer.maxHp ?? 100);
        targetPlayer.updatedAt = now;
        const targetClient = this.clients.find((client) => client.sessionId === enemy.targetPlayerId);
        targetClient?.send('hit', { damage });
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

  broadcastWorld() {
    this.broadcast('world', {
      players: [...this.players.values()],
      enemies: this.enemies,
      serverTime: Date.now(),
    });
  }

  awardXpForEnemyKill(firstHitPlayerId, amount, bossKills) {
    const owner = this.players.get(firstHitPlayerId);
    if (!owner) return;

    const recipients = [...this.players.values()].filter((player) => (
      player.id === firstHitPlayerId || sameParty(player, owner)
    ));

    recipients.forEach((player) => {
      const recipientClient = this.clients.find((client) => client.sessionId === player.id);
      recipientClient?.send('xp', { amount, bossKills });
    });
  }
}

const port = Number(process.env.PORT ?? 2567);
const gameServer = new Server({
  express: (app) => {
    app.get('/', (_request, response) => {
      response.send('MMO Colyseus server is running');
    });

    app.get('/health', (_request, response) => {
      response.json({ ok: true, service: 'mmo-colyseus' });
    });
  },
});
gameServer.define('world', WorldRoom);

gameServer.listen(port).then(() => {
  console.log(`Colyseus MMO server listening on ws://localhost:${port}`);
});
