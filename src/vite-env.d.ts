/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** POST: JSON { wordId, article, word, translation } → { explanation } və ya mətn */
  readonly VITE_WORD_EXPLAIN_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** Realtime Database, напр. https://PROJECT_ID-default-rtdb.europe-west1.firebasedatabase.app */
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
}
