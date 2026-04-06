import i18n from '../i18n';
import type { Article } from '../types';
import { matchSuffixRule } from './ruleEngine';

export type GenderHintSource = 'suffix' | 'ge_prefix';

export interface GenderHint {
  article: Article;
  hint: string;
  source: GenderHintSource;
  /** Set when source === 'suffix' */
  matchedSuffix?: string;
}

/**
 * Heuristic guess from word shape (suffix / Ge- prefix). Not authoritative —
 * use {@link getArticleRule} with the known correct article for full rules.
 *
 * Suffix matching delegates to {@link matchSuffixRule} (longest match, edge-case skips).
 */
export function getGenderHint(word: string): GenderHint | null {
  const suffixMatch = matchSuffixRule(word);
  if (suffixMatch) {
    return {
      article: suffixMatch.article,
      hint: suffixMatch.messageAz,
      source: 'suffix',
      matchedSuffix: suffixMatch.matchedSuffix,
    };
  }

  const low = word.trim().toLowerCase();
  if (low.startsWith('ge') && low.length > 4) {
    return {
      article: 'das',
      hint: i18n.t('quiz.gender_hint_ge_prefix'),
      source: 'ge_prefix',
    };
  }

  return null;
}
