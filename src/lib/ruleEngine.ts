import { articleGrammarRules } from '../data/articleGrammarRules';
import type { Article } from '../types';

export interface SuffixRuleMatch {
  article: Article;
  matchedSuffix: string;
  messageAz: string;
}

/**
 * Bu lemmalar üçün avtomatik sufiks qaydası göstərilmir (yanlış uyğunluq riski).
 */
const LEMMA_SKIP_SUFFIX = new Set<string>([
  'tor',
  'labor',
  'moor',
  'sprung',
  'schwung',
  'butter',
  'termin',
  'firma',
  'oma',
]);

/**
 * -en ilə bitir, amma infinitiv deyil — “substantivləşmiş infinitiv → das” heuristikasını keçməsin.
 */
const LEMMA_SKIP_SUBSTANTIVIZED_EN = new Set<string>([
  'garten',
  'kuchen',
  'ofen',
  'wagen',
  'laden',
  'bogen',
  'magen',
  'besen',
  'rasen',
  'haufen',
]);

/** -a → die xarici söz heuristikası; orta cins olanlar. */
const LEMMA_SKIP_LOANWORD_A = new Set<string>(['sofa']);

const SORTED_SUFFIX_RULES = [...articleGrammarRules.suffixRules].sort(
  (a, b) => b.suffix.length - a.suffix.length,
);

/** Alman ismi kimi: ilk hərf böyük hərflə və söz -en ilə bitir (case-insensitive son). */
function isSubstantivizedInfinitiveShape(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 3) return false;
  if (!/^\p{Lu}/u.test(t)) return false;
  return t.toLowerCase().endsWith('en');
}

/**
 * Uzun sonluq əvvəl yoxlanılır (məs. -ium əvvəl -um-dan; -tur əvvəl -ur-dan).
 * Xüsusi: `-en` → `das` yalnız substantivləşmiş infinitiv forması üçün (böyük hərf + -en);
 * `-a` → `die` üçün məhdud istisna lemmalar (məs. sofa → das).
 */
export function matchSuffixRule(word: string): SuffixRuleMatch | null {
  const raw = word.trim();
  const w = raw.toLowerCase();
  if (!w || LEMMA_SKIP_SUFFIX.has(w)) return null;

  for (const row of SORTED_SUFFIX_RULES) {
    if (row.suffix === 'en') {
      if (!isSubstantivizedInfinitiveShape(raw) || LEMMA_SKIP_SUBSTANTIVIZED_EN.has(w)) {
        continue;
      }
    }
    if (row.suffix === 'a' && LEMMA_SKIP_LOANWORD_A.has(w)) {
      continue;
    }
    if (w.endsWith(row.suffix)) {
      return {
        article: row.article,
        matchedSuffix: row.suffix,
        messageAz: row.rule,
      };
    }
  }
  return null;
}
