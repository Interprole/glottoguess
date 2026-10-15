/**
 * Firebase layer: Google sign-in, progress sync and duels.
 * This module (and the Firebase SDK) is loaded lazily after first render.
 */
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config';
import { newDuelId, type Duel, type DuelResult, type DuelSpec } from './duel';
import { coerceProgress, mergeProgress, progressEquals, recordDuel, type Progress } from './progress';
import { getProgress, setProgress, setRemoteSaver, updateProgress } from './store';

export interface CloudUser {
  uid: string;
  name: string;
  photo: string | null;
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/** Firestore rejects `undefined`; a JSON round-trip drops such fields. */
const clean = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

const toUser = (u: User): CloudUser => ({
  uid: u.uid,
  name: u.displayName || u.email?.split('@')[0] || 'Player',
  photo: u.photoURL,
});

let currentUser: CloudUser | null = null;
export const getUser = () => currentUser;

async function pull(u: CloudUser): Promise<void> {
  const ref = doc(db, 'users', u.uid);
  const snap = await getDoc(ref);
  const remote = coerceProgress(snap.exists() ? snap.data().progress : null);
  const local = getProgress();
  const merged = mergeProgress(local, remote);
  setProgress(merged, { remote: false });
  if (!snap.exists() || !progressEquals(merged, remote)) {
    await setDoc(ref, { progress: clean(merged), name: u.name, updatedAt: serverTimestamp() }, { merge: true });
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
function saverFor(u: CloudUser) {
  return (p: Progress) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      setDoc(doc(db, 'users', u.uid), { progress: clean(p), name: u.name, updatedAt: serverTimestamp() }, { merge: true }).catch(
        (e) => console.warn('progress sync failed', e),
      );
    }, 1200);
  };
}

/** Start listening to the auth state; calls back with the signed-in user (or null). */
export function watchUser(cb: (u: CloudUser | null) => void): () => void {
  return onAuthStateChanged(auth, async (fu) => {
    if (!fu) {
      currentUser = null;
      setRemoteSaver(null);
      cb(null);
      return;
    }
    const u = toUser(fu);
    currentUser = u;
    cb(u);
    try {
      await pull(u);
    } catch (e) {
      console.warn('progress pull failed', e);
    }
    setRemoteSaver(saverFor(u));
  });
}

export async function signIn(): Promise<void> {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      throw e;
    }
  }
}

export async function signOut(): Promise<void> {
  setRemoteSaver(null);
  await fbSignOut(auth);
}

// ------------------------------------------------------------------- duels

function requireUser(): CloudUser {
  if (!currentUser) throw new Error('not signed in');
  return currentUser;
}

export async function createDuel(spec: DuelSpec): Promise<string> {
  const u = requireUser();
  const id = newDuelId();
  const duel: Omit<Duel, 'id'> = { creatorUid: u.uid, creatorName: u.name, createdAt: Date.now(), spec };
  await setDoc(doc(db, 'duels', id), clean(duel));
  updateProgress((p) => recordDuel(p, id, duel.createdAt));
  return id;
}

export async function getDuel(id: string): Promise<Duel | null> {
  const snap = await getDoc(doc(db, 'duels', id));
  return snap.exists() ? ({ id, ...(snap.data() as Omit<Duel, 'id'>) }) : null;
}

export async function getMyResult(id: string): Promise<DuelResult | null> {
  const u = requireUser();
  const snap = await getDoc(doc(db, 'duels', id, 'results', u.uid));
  return snap.exists() ? (snap.data() as DuelResult) : null;
}

/** Results are readable only by the creator and by players who have finished (see firestore.rules). */
export async function listResults(id: string): Promise<DuelResult[] | null> {
  try {
    const snap = await getDocs(collection(db, 'duels', id, 'results'));
    return snap.docs.map((d) => d.data() as DuelResult);
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') return null;
    throw e;
  }
}

export async function submitResult(id: string, r: Omit<DuelResult, 'uid' | 'name' | 'photo'>): Promise<void> {
  const u = requireUser();
  const result: DuelResult = { uid: u.uid, name: u.name, ...(u.photo ? { photo: u.photo } : {}), ...r };
  await setDoc(doc(db, 'duels', id, 'results', u.uid), clean(result));
  updateProgress((p) => recordDuel(p, id, Date.now()));
}
