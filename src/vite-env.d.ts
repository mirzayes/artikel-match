/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    /** Build-time: `vite.config` `define` from `.env` (`loadEnv`). */
    readonly NEXT_PUBLIC_POSTHOG_KEY?: string;
    readonly NEXT_PUBLIC_POSTHOG_HOST?: string;
  }
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_POSTHOG_KEY?: string;
  readonly NEXT_PUBLIC_POSTHOG_HOST?: string;
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
  /** Buy Me a Coffee / dəstək linki (mağaza düymələri). */
  readonly VITE_BUY_ME_A_COFFEE_URL?: string;
}
