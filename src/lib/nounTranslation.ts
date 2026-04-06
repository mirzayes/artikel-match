import type { GoetheLevel, NounEntry, NounTranslationLang } from '../types';
import { GOETHE_LEVELS } from '../types';
import type { VokabelRow } from './vokabelnCsv';

/** Tərcümə (lüğət) dili — yalnız AZ; localStorage: artikel-gloss-lang */
export const GLOSS_LANG_STORAGE_KEY = 'artikel-gloss-lang';

/** Ayrıca yüklənən lüğət: `public/lexicon-glosses/{kod}.json` (az istisna). */
export const LEXICON_GLOSS_PUBLIC_BASE = '/lexicon-glosses';

/**
 * Vite: fayllar `public/lexicon-glosses/` kökündən; `base` alt yolundakı deploy üçün BASE_URL əlavə edilir.
 */
export function getLexiconGlossFileUrl(glossLang: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const trimmed = base.endsWith('/') ? base : `${base}/`;
  return `${trimmed}lexicon-glosses/${glossLang}.json`;
}

/** Yalnız Azərbaycan tərcüməsi (əlavə JSON yüklənmir). */
export const SUPPORTED_GLOSS_LANGS = ['az'] as const;
export type AppGlossLangCode = (typeof SUPPORTED_GLOSS_LANGS)[number];

export function isRtlGlossLang(lang: NounTranslationLang): boolean {
  return lang === 'ar';
}

/** az istisna — bir dəfə `lexicon-glosses/{lang}.json` yüklənir. */
export function usesRemoteGlossFile(lang: NounTranslationLang): boolean {
  return lang !== 'az';
}

export function readStoredGlossLang(): NounTranslationLang {
  if (typeof window === 'undefined') return 'az';
  try {
    localStorage.setItem(GLOSS_LANG_STORAGE_KEY, 'az');
  } catch {
    /* ignore */
  }
  return 'az';
}

export function resolveGlossLang(_i18nLanguage: string | undefined): NounTranslationLang {
  return 'az';
}

export function getNounTranslation(
  entry: NounEntry,
  lang: NounTranslationLang,
  /** Cari gloss dili üçün `lexicon-glosses/{lang}.json` (id → sətir) */
  remoteById?: Readonly<Record<string, string>> | null,
): string {
  if (usesRemoteGlossFile(lang) && remoteById) {
    const r = remoteById[entry.id];
    if (typeof r === 'string' && r.trim()) return r.trim();
  }

  const tr = entry.translations;
  if (tr?.[lang]?.trim()) return tr[lang]!.trim();

  /* Remote və bu dil üçün inline yoxdursa — yalnız əsas (AZ) sahə */
  if (tr?.az?.trim()) return tr.az.trim();
  return entry.translation;
}

/** Bütün səviyyələrdə id ilə NounEntry tapır (kartda canlı gloss üçün). */
export function findNounEntryById(
  nounsByLevel: Record<GoetheLevel, NounEntry[]>,
  wordId: string,
): NounEntry | undefined {
  for (const lvl of GOETHE_LEVELS) {
    const hit = nounsByLevel[lvl].find((n) => n.id === wordId);
    if (hit) return hit;
  }
  return undefined;
}

/** Vokabel sırasındakı köhnə tərcümə əvəzinə cari dil + remote JSON */
export function resolveVokabelRowGloss(
  row: VokabelRow,
  nounsByLevel: Record<GoetheLevel, NounEntry[]>,
  glossLang: NounTranslationLang,
  remoteById: Readonly<Record<string, string>> | null | undefined,
): string {
  const entry = findNounEntryById(nounsByLevel, row.id);
  if (!entry) return row.translation;
  return getNounTranslation(entry, glossLang, usesRemoteGlossFile(glossLang) ? remoteById : null);
}

export function nounToVokabelRow(
  entry: NounEntry,
  glossLang: NounTranslationLang,
  remoteById?: Readonly<Record<string, string>> | null,
): VokabelRow {
  return {
    id: entry.id,
    article: entry.article,
    word: entry.word,
    translation: getNounTranslation(entry, glossLang, remoteById),
    ...(entry.level ? { level: entry.level } : {}),
  };
}
