import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  type Firestore,
  type Unsubscribe 
} from 'firebase/firestore';
import type { FairShareGroup } from '../types/fairshare';

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
  } catch (err) {
    console.error('Error al inicializar Firebase:', err);
  }
}

/**
 * Saves or updates a group in Firestore.
 */
export const saveGroupToCloud = async (group: FairShareGroup): Promise<boolean> => {
  if (!db || !isFirebaseConfigured()) {
    return false;
  }

  try {
    const groupRef = doc(db, 'fairshare_groups', group.id);
    const payload = {
      ...group,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(groupRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.error('Error guardando en Firestore:', err);
    return false;
  }
};

/**
 * Subscribes to real-time updates for a specific group in Firestore.
 */
export const subscribeToCloudGroup = (
  groupId: string,
  onUpdate: (group: FairShareGroup) => void,
  onError?: (err: Error) => void
): Unsubscribe | null => {
  if (!db || !isFirebaseConfigured()) {
    return null;
  }

  try {
    const groupRef = doc(db, 'fairshare_groups', groupId);
    return onSnapshot(
      groupRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as FairShareGroup;
          onUpdate(data);
        }
      },
      (err) => {
        console.error('Error escuchando cambios de Firestore:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('Error configurando suscripción a Firestore:', err);
    return null;
  }
};
