import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import az from '../locales/az.json';

export const UI_LANG_STORAGE_KEY = 'artikel-ui-lang';

/** Yalnız Azərbaycan dilində interfeys. */
export const SUPPORTED_UI_LANGS = ['az'] as const;
export type UiLangCode = (typeof SUPPORTED_UI_LANGS)[number];

function ensureAzOnlyStorage(): void {
  try {
    localStorage.setItem(UI_LANG_STORAGE_KEY, 'az');
  } catch {
    /* ignore */
  }
}

void i18n.use(initReactI18next).init({
  resources: { az: { translation: az } },
  lng: 'az',
  fallbackLng: 'az',
  supportedLngs: ['az'],
  interpolation: { escapeValue: false },
});

ensureAzOnlyStorage();

if (typeof document !== 'undefined') {
  document.documentElement.lang = 'az';
}

i18n.on('languageChanged', () => {
  try {
    if (typeof document !== 'undefined') document.documentElement.lang = 'az';
    ensureAzOnlyStorage();
  } catch {
    /* ignore */
  }
});

export default i18n;
