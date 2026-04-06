import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { getFirestore, type Firestore } from 'firebase/firestore';

const FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

/**
 * Reads a Vite env var safely: missing, non-string, or whitespace-only → "".
 * Does not throw and does not log.
 */
function trimEnv(key: string): string {
  try {
    const raw = (import.meta.env as Record<string, unknown>)[key];
    return typeof raw === 'string' ? raw.trim() : '';
  } catch {
    return '';
  }
}

/** Fallback config used when any VITE_FIREBASE_* value is unset or empty. */
const PLACEHOLDER_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCrPuWNbhqz9tHji4EQuLPwofmqmYuBmQc',
  authDomain: 'artikelmatch.firebaseapp.com',
  databaseURL: 'https://artikelmatch-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'artikelmatch',
  storageBucket: 'artikelmatch.firebasestorage.app',
  messagingSenderId: '114813253843',
  appId: '1:114813253843:web:8e343716880f52f76bfc26',
} as const;

function buildFirebaseConfig() {
  return {
    apiKey: trimEnv('VITE_FIREBASE_API_KEY') || PLACEHOLDER_FIREBASE_CONFIG.apiKey,
    authDomain:
      trimEnv('VITE_FIREBASE_AUTH_DOMAIN') || PLACEHOLDER_FIREBASE_CONFIG.authDomain,
    projectId: trimEnv('VITE_FIREBASE_PROJECT_ID') || PLACEHOLDER_FIREBASE_CONFIG.projectId,
    storageBucket:
      trimEnv('VITE_FIREBASE_STORAGE_BUCKET') || PLACEHOLDER_FIREBASE_CONFIG.storageBucket,
    messagingSenderId:
      trimEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') ||
      PLACEHOLDER_FIREBASE_CONFIG.messagingSenderId,
    appId: trimEnv('VITE_FIREBASE_APP_ID') || PLACEHOLDER_FIREBASE_CONFIG.appId,
    databaseURL:
      trimEnv('VITE_FIREBASE_DATABASE_URL') || PLACEHOLDER_FIREBASE_CONFIG.databaseURL,
  };
}

/** `true` when every listed VITE_FIREBASE_* is present and non-empty after trim. */
export const isFirebaseConfigured = FIREBASE_ENV_KEYS.every((k) => trimEnv(k) !== '');

/**
 * Use for cloud-backed paths (RTDB writes, presence, etc.).
 * Requires real API key and project id from env (not placeholder-only).
 */
export const isFirebaseLive = Boolean(
  trimEnv('VITE_FIREBASE_API_KEY') && trimEnv('VITE_FIREBASE_PROJECT_ID'),
);

function initFirebase(): {
  app: FirebaseApp | null;
  rtdb: Database | null;
  db: Firestore | null;
} {
  try {
    const app = initializeApp(buildFirebaseConfig());
    return {
      app,
      rtdb: getDatabase(app),
      db: getFirestore(app),
    };
  } catch {
    return { app: null, rtdb: null, db: null };
  }
}

const { app, rtdb, db } = initFirebase();

export { app, rtdb, db };

/** App + RTDB instances exist (may still be placeholder-backed). */
export const isFirebaseReady = app !== null && rtdb !== null;

export function requireRtdb(): Database {
  if (!rtdb) {
    throw new Error('RTDB недоступна');
  }
  return rtdb;
}

export function requireFirestore(): Firestore {
  if (!db) {
    throw new Error('Firestore недоступна');
  }
  return db;
}
