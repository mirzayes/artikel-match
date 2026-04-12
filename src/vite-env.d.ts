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
  /** «Kofe al» düyməsi — tam URL (üstünlük VITE_BUY_ME_A_COFFEE_URL-dən). */
  readonly VITE_DONATION_COFFEE_URL?: string;
  /** Gold VIP ödəniş (2 AZN) — tam URL. */
  readonly VITE_GOLD_VIP_CHECKOUT_URL?: string;
  /** Mağaza və VIP: AZN kart PAN (boşdursa layihə default kartı). */
  readonly VITE_PAYMENT_CARD_PAN?: string;
  /** PayPal: tam `https://paypal.me/...` və ya `https://www.paypal.com/paypalme/...` linki; və ya yalnız istifadəçi adı. */
  readonly VITE_PAYPAL_ME_URL?: string;
  /** PayPal.me istifadəçi adı (link boşdursa). */
  readonly VITE_PAYPAL_ME_USERNAME?: string;
  /** PayPal ödənişi üçün e-poçt (göstərmə / kopyalama). */
  readonly VITE_PAYPAL_RECIPIENT_EMAIL?: string;
  /** VIP «Instagram-a yaz» — Direct və ya profil (üstünlük `VITE_SUPPORT_INSTAGRAM_URL`-dən). */
  readonly VITE_INSTAGRAM_CHECKOUT_URL?: string;
  /** Instagram profil linki (məs. https://www.instagram.com/nick/) */
  readonly VITE_SUPPORT_INSTAGRAM_URL?: string;
  /** Sprachbasar / bloq profili — boşdursa layihə default @sprachbasar linki. */
  readonly VITE_INSTAGRAM_COMMUNITY_PROFILE_URL?: string;
  /** @nick — link yoxdursa profil URL qurulur. */
  readonly VITE_SUPPORT_INSTAGRAM_HANDLE?: string;
}
