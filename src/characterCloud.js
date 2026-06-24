import {
  collection,
  collectionGroup,
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

export async function loadAllCloudCharactersForAdmin() {
  if (!db) return [];

  const snapshot = await getDocs(collectionGroup(db, 'characters'));
  return snapshot.docs.map((characterDoc) => {
    const data = characterDoc.data();
    const ownerDoc = characterDoc.ref.parent.parent;
    return {
      ...data,
      id: characterDoc.id,
      ownerUid: data.ownerUid ?? ownerDoc?.id ?? null,
      ownerEmail: data.ownerEmail ?? data.accountEmail ?? null,
    };
  });
}

export async function saveCloudCharacter(uid, character, ownerEmail = '') {
  if (!db || !uid || !character?.id) return;

  await setDoc(
    doc(db, 'users', uid, 'characters', character.id),
    {
      ...character,
      ownerUid: uid,
      ownerEmail: ownerEmail || character.ownerEmail || '',
      cloudUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteCloudCharacter(uid, characterId) {
  if (!db || !uid || !characterId) return;

  await deleteDoc(doc(db, 'users', uid, 'characters', characterId));
}
