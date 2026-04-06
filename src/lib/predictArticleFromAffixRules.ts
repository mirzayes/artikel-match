import type { Article } from '../types';

/** İstifadəçi tərəfindən verilmiş qayda dəsti: əvvəl uzun sonluqlar. */
const DIE_SUFFIXES_DESC = ['heit', 'keit', 'ung'] as const;
const DAS_SUFFIXES_DESC = ['chen', 'ment', 'um'] as const;

export type AffixRuleKind = 'die_suffix' | 'das_suffix' | 'das_ge_prefix';

export interface AffixArticlePrediction {
  article: Article;
  rule: AffixRuleKind;
}

/**
 * Alman lemmasına görə **ehtimal olunan** artikl (yalnız bu sadə nümunələr üçün).
 * -ung / -heit / -keit → die; -chen / -um / -ment → das; Ge- + uzunluq → das.
 * Dəqiq deyil — istisnalar çoxdur; UI-də yalnız `correctArticle` ilə üst-üstə düşərsə göstərin.
 */
export function predictArticleFromAffixRules(word: string): AffixArticlePrediction | null {
  const w = word.trim().toLowerCase();
  if (!w) return null;

  for (const s of DIE_SUFFIXES_DESC) {
    if (w.endsWith(s)) return { article: 'die', rule: 'die_suffix' };
  }
  for (const s of DAS_SUFFIXES_DESC) {
    if (w.endsWith(s)) return { article: 'das', rule: 'das_suffix' };
  }
  if (w.startsWith('ge') && w.length > 4) {
    return { article: 'das', rule: 'das_ge_prefix' };
  }
  return null;
}

/** Səhv cavabdan sonra lemma üzərində qırmızı vurğulama + tədris mətni üçün. */
export interface AffixWrongTeachHighlight {
  start: number;
  length: number;
  rule: AffixRuleKind;
  /** UI: məs. "-ung" və ya "Ge-" */
  suffixLabel: string;
}

/**
 * Düzgün artikl üçün forma qaydası varsa, lemadakı uyğun hissənin [start, start+length) indeksləri.
 * `correctArticle` ilə üst-üstə düşməsə null.
 */
export function getAffixWrongTeachHighlight(
  word: string,
  correctArticle: Article,
): AffixWrongTeachHighlight | null {
  const pred = predictArticleFromAffixRules(word);
  if (!pred || pred.article !== correctArticle) return null;

  const w = word.trim();
  const lower = w.toLowerCase();
  if (!w) return null;

  if (pred.rule === 'die_suffix') {
    for (const s of DIE_SUFFIXES_DESC) {
      if (lower.endsWith(s)) {
        return {
          start: w.length - s.length,
          length: s.length,
          rule: pred.rule,
          suffixLabel: `-${s}`,
        };
      }
    }
    return null;
  }

  if (pred.rule === 'das_suffix') {
    for (const s of DAS_SUFFIXES_DESC) {
      if (lower.endsWith(s)) {
        return {
          start: w.length - s.length,
          length: s.length,
          rule: pred.rule,
          suffixLabel: `-${s}`,
        };
      }
    }
    return null;
  }

  if (pred.rule === 'das_ge_prefix' && lower.startsWith('ge') && w.length > 4) {
    return {
      start: 0,
      length: 2,
      rule: pred.rule,
      suffixLabel: 'Ge-',
    };
  }

  return null;
}
