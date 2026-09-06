import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDocs,
  collection,
  onSnapshot, 
  type Firestore,
  type Unsubscribe 
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User
} from 'firebase/auth';
import type { FairShareGroup, GroupSummary } from '../types/fairshare';

// Read config from Vite environment variables (.env / .env.local)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey && 
    firebaseConfig.projectId &&
    firebaseConfig.apiKey.length > 5
  );
};

// Initialize Firebase only if valid configuration is provided
if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (err) {
    console.error('Error al inicializar Firebase:', err);
  }
}

// -------------------------------------------------------------
// Authentication Methods
// -------------------------------------------------------------

export const loginWithGoogle = async (): Promise<User | null> => {
  if (!auth) throw new Error('Firebase Auth no está configurado.');
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const loginWithEmail = async (email: string, pass: string): Promise<User | null> => {
  if (!auth) throw new Error('Firebase Auth no está configurado.');
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
};

export const registerWithEmail = async (email: string, pass: string): Promise<User | null> => {
  if (!auth) throw new Error('Firebase Auth no está configurado.');
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  return result.user;
};

export const logoutUser = async (): Promise<void> => {
  if (!auth) return;
  await signOut(auth);
};

export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

// -------------------------------------------------------------
// User-Scoped Firestore Methods
// -------------------------------------------------------------

/**
 * Saves a group in the user's private Firestore collection: users/{userId}/groups/{groupId}
 */
export const saveUserGroupToCloud = async (userId: string, group: FairShareGroup): Promise<boolean> => {
  if (!db || !isFirebaseConfigured() || !userId) {
    return false;
  }

  try {
    const groupRef = doc(db, 'users', userId, 'groups', group.id);
    const payload = {
      ...group,
      userId,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(groupRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.error('Error guardando grupo de usuario en Firestore:', err);
    return false;
  }
};

/**
 * Subscribes to real-time changes of a group for a specific user.
 */
export const subscribeToUserGroup = (
  userId: string,
  groupId: string,
  onUpdate: (group: FairShareGroup) => void,
  onError?: (err: Error) => void
): Unsubscribe | null => {
  if (!db || !isFirebaseConfigured() || !userId) {
    return null;
  }

  try {
    const groupRef = doc(db, 'users', userId, 'groups', groupId);
    return onSnapshot(
      groupRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as FairShareGroup;
          onUpdate(data);
        }
      },
      (err) => {
        console.error('Error escuchando grupo de usuario en Firestore:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('Error configurando suscripción:', err);
    return null;
  }
};

/**
 * Fetches all saved groups summaries for a user from Firestore.
 */
export const fetchUserCloudGroupsIndex = async (userId: string): Promise<GroupSummary[]> => {
  if (!db || !isFirebaseConfigured() || !userId) {
    return [];
  }

  try {
    const groupsColl = collection(db, 'users', userId, 'groups');
    const snapshot = await getDocs(groupsColl);
    const list: GroupSummary[] = [];

    snapshot.forEach((d) => {
      const g = d.data() as FairShareGroup;
      list.push({
        id: g.id,
        title: g.title,
        updatedAt: g.updatedAt,
        expenseCount: (g.expenses || []).length,
        participantCount: (g.participants || []).length,
      });
    });

    return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  } catch (err) {
    console.error('Error obteniendo lista de eventos de Firestore:', err);
    return [];
  }
};
