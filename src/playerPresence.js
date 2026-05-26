import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebaseClient';

const PRESENCE_COLLECTION = 'onlinePlayers';
const PRESENCE_TTL_MS = 30000;

function isFreshPresence(player) {
  const updatedAt = player.updatedAt?.toMillis?.();
  return !updatedAt || Date.now() - updatedAt < PRESENCE_TTL_MS;
}

function isValidPresence(player) {
  return (
    Number.isFinite(player.x)
    && Number.isFinite(player.y)
    && Number.isFinite(player.facing)
    && typeof player.classId === 'string'
    && typeof player.raceId === 'string'
  );
}

export function subscribeOnlinePlayers(currentUid, onPlayersChange, onError) {
  if (!db || !currentUid) return () => {};

  return onSnapshot(
    collection(db, PRESENCE_COLLECTION),
    (snapshot) => {
      const players = snapshot.docs
        .filter((playerDoc) => playerDoc.id !== currentUid)
        .map((playerDoc) => ({ uid: playerDoc.id, ...playerDoc.data() }))
        .filter((player) => isValidPresence(player) && isFreshPresence(player));
      onPlayersChange(players);
    },
    onError,
  );
}

export async function savePlayerPresence(uid, player) {
  if (!db || !uid || !player) return;

  await setDoc(
    doc(db, PRESENCE_COLLECTION, uid),
    {
      ...player,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function removePlayerPresence(uid) {
  if (!db || !uid) return;

  await deleteDoc(doc(db, PRESENCE_COLLECTION, uid));
}
