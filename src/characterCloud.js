import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebaseClient';

function characterCollection(uid) {
  return collection(db, 'users', uid, 'characters');
}

export async function loadCloudCharacters(uid) {
  if (!db || !uid) return [];

  const snapshot = await getDocs(characterCollection(uid));
  return snapshot.docs.map((characterDoc) => ({
    ...characterDoc.data(),
    id: characterDoc.id,
  }));
}

export async function saveCloudCharacter(uid, character) {
  if (!db || !uid || !character?.id) return;

  await setDoc(
    doc(db, 'users', uid, 'characters', character.id),
    {
      ...character,
      cloudUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteCloudCharacter(uid, characterId) {
  if (!db || !uid || !characterId) return;

  await deleteDoc(doc(db, 'users', uid, 'characters', characterId));
}
