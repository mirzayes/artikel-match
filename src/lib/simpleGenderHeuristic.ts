import { articleGrammarRules } from '../data/articleGrammarRules';
import type { Article } from '../types';

/**
 * Sadə “RULES” modeli (tədris / müqayisə üçün).
 * Canlı quiz izahları üçün `getArticleRule` və `matchSuffixRule` istifadə olunur.
 * İstəyə bağlı proqnoz: `getGenderHint` (`./genderHintHeuristic`); kart üçün sadə sufiks: `predictArticleFromAffixRules`.
 */
const FEMININE_ER = new Set(
  articleGrammarRules.feminineEr.words.map((x) => x.toLowerCase()),
);

const FIXED_SUFFIXES_RAW: [string, Article][] = [
  ['ismus', 'der'],
  ['heit', 'die'],
  ['zeug', 'das'],
  ['ung', 'die'],
  ['um', 'das'],
];

const FIXED_SUFFIXES_SORTED = FIXED_SUFFIXES_RAW.slice().sort(
  (a, b) => b[0].length - a[0].length,
);

/**
 * 1) Feminin -er istisna siyahısı → die.
 * 2) Sabit sonluqlar (ən uzun əvvəl).
 * 3) -er → der, sonra -e → die, əks halda das.
 */
export function getGenderFromSimpleRules(word: string): Article {
  const w = word.trim().toLowerCase();
  if (!w) return 'das';

  if (FEMININE_ER.has(w)) return 'die';

  for (const [suffix, article] of FIXED_SUFFIXES_SORTED) {
    if (w.endsWith(suffix)) return article;
  }

  if (w.endsWith('er')) return 'der';
  if (w.endsWith('e')) return 'die';

  return 'das';
}
