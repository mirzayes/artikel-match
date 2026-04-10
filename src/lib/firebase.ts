import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { isDeviceSessionKicked } from './deviceSessionFlags';

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

/**
 * Fallback config used when any VITE_FIREBASE_* value is unset or empty.
 * These are intentionally non-functional placeholders so the app can still
 * boot in offline / development mode without a real .env file.
 * Set real values in .env (see .env.example).
 */
const PLACEHOLDER_FIREBASE_CONFIG = {
  apiKey: 'MISSING_API_KEY',
  authDomain: 'example.firebaseapp.com',
  databaseURL: 'https://example-default-rtdb.firebaseio.com',
  projectId: 'example',
  storageBucket: 'example.appspot.com',
  messagingSenderId: '000000000000',
  appId: '0:000000000000:web:0000000000000000',
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

/** Realtime Database URL set and not a dev placeholder (required for referralCodes / RTDB writes). */
export function isRealtimeDatabaseUrlConfigured(): boolean {
  const u = trimEnv('VITE_FIREBASE_DATABASE_URL');
  return u !== '' && !u.includes('example-default-rtdb.firebaseio.com');
}

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

let auth: Auth | null = null;
if (app) {
  try {
    auth = getAuth(app);
  } catch {
    auth = null;
  }
}

export { app, auth, rtdb, db };

/**
 * RTDB qaydaları çox vaxt `auth != null` tələb edir.
 * Anonim giriş — `referralCodes` və digər yazılar üçün.
 */
export async function ensureAnonymousFirebaseUser(): Promise<string | null> {
  if (!app || !auth || !isFirebaseLive) return null;
  if (isDeviceSessionKicked()) return null;
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[firebase] Anonymous sign-in failed (enable Anonymous in Firebase Console → Auth):', e);
    }
    return null;
  }
}

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
