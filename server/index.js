import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import admin from 'firebase-admin';

const PORT = Number(process.env.PORT ?? 3001);
const REQUIRE_FIREBASE_AUTH = process.env.REQUIRE_FIREBASE_AUTH === 'true';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? '*';
const PLAYER_TIMEOUT_MS = 15000;

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
const players = new Map();

app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/', (_request, response) => {
  response.json({
    ok: true,
    service: 'mmo-project socket server',
    health: '/health',
    players: players.size,
  });
});

app.get('/health', (_request, response) => {
  response.json({ ok: true, players: players.size });
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
    level: Number(payload.level ?? 1),
    classId: String(payload.classId ?? 'warrior'),
    raceId: String(payload.raceId ?? 'human'),
    x: clampNumber(payload.x, 18, 6400),
    y: clampNumber(payload.y, 18, 6400),
    facing: Number.isFinite(payload.facing) ? payload.facing : 0,
    updatedAt: Date.now(),
  };
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function broadcastPlayers() {
  io.emit('players:snapshot', [...players.values()]);
}

io.use(verifySocket);

io.on('connection', (socket) => {
  socket.on('player:join', (payload) => {
    players.set(socket.data.uid, sanitizePlayer(socket, payload));
    broadcastPlayers();
  });

  socket.on('player:update', (payload) => {
    if (!players.has(socket.data.uid)) {
      players.set(socket.data.uid, sanitizePlayer(socket, payload));
    } else {
      players.set(socket.data.uid, {
        ...players.get(socket.data.uid),
        ...sanitizePlayer(socket, payload),
      });
    }
    broadcastPlayers();
  });

  socket.on('player:leave', () => {
    players.delete(socket.data.uid);
    broadcastPlayers();
  });

  socket.on('disconnect', () => {
    players.delete(socket.data.uid);
    broadcastPlayers();
  });
});

setInterval(() => {
  const now = Date.now();
  let changed = false;
  players.forEach((player, uid) => {
    if (now - player.updatedAt > PLAYER_TIMEOUT_MS) {
      players.delete(uid);
      changed = true;
    }
  });
  if (changed) broadcastPlayers();
}, 5000);

server.listen(PORT, () => {
  console.log(`MMO socket server listening on ${PORT}`);
});
