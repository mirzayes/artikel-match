import type { Article, GoetheLevel } from '../types';
import { GOETHE_LEVELS } from '../types';
import { getA1DisplayCategory, sortVocabularyCategoryKeys } from './a1CuratedThemes';

/** Bu səviyyələrdə Lüğətdə bölmələr der / die / das üzrə ayrılır. */
const LEVELS_ARTICLE_BUCKETS: GoetheLevel[] = ['B1', 'B2', 'C1'];

const ARTICLE_ORDER: Article[] = ['der', 'die', 'das'];

const ARTICLE_GROUP_RE = /^(B1|B2|C1) · (der|die|das)$/;

export function getLexiconDisplayGroup(
  level: GoetheLevel,
  article: Article,
  word: string,
  category?: string,
): string {
  if (LEVELS_ARTICLE_BUCKETS.includes(level)) {
    return `${level} · ${article}`;
  }
  return getA1DisplayCategory(level, article, word, category);
}

/** Kateqoriya başlıqlarının sırası: əvvəl A1/A2 mövzuları, sonra B1/B2/C1 · artikl. */
export function sortLexiconGroupKeys(keys: string[]): string[] {
  const bucket: string[] = [];
  const rest: string[] = [];
  for (const k of keys) {
    if (ARTICLE_GROUP_RE.test(k)) bucket.push(k);
    else rest.push(k);
  }
  bucket.sort((a, b) => {
    const [la, aa] = a.split(' · ') as [GoetheLevel, Article];
    const [lb, ab] = b.split(' · ') as [GoetheLevel, Article];
    const i = GOETHE_LEVELS.indexOf(la) - GOETHE_LEVELS.indexOf(lb);
    if (i !== 0) return i;
    return ARTICLE_ORDER.indexOf(aa) - ARTICLE_ORDER.indexOf(ab);
  });
  return [...sortVocabularyCategoryKeys(rest), ...bucket];
}
