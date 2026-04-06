import type { Article } from '../types';
import curatedRaw from '../data/a1-curated-themes.json';

type CuratedBlock = { category: string; words: { de: string; az: string }[] };

const curated = curatedRaw as CuratedBlock[];

/** Alman mövzuları filtrdə bu ardıcıllıqla göstərilir. */
export const A1_CURATED_THEME_ORDER = ['Mensch & Körper', 'Kleidung', 'Essen & Trinken'] as const;

function parseDeLemma(de: string): { article: Article; word: string }[] {
  const t = de.trim();
  const slash = t.match(/^der\/die\s+(.+)$/i);
  if (slash) {
    const lemma = slash[1].trim().split(/[\s,/]/)[0];
    if (!lemma) return [];
    return [
      { article: 'der', word: lemma },
      { article: 'die', word: lemma },
    ];
  }
  const m = t.match(/^(der|die|das)\s+(.+)$/i);
  if (!m) return [];
  const art = m[1].toLowerCase() as Article;
  const rest = m[2].trim();
  const word = rest.split(/\s+/)[0];
  if (!word) return [];
  return [{ article: art, word }];
}

function buildCuratedMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of curated) {
    for (const row of block.words) {
      for (const { article, word } of parseDeLemma(row.de)) {
        map.set(`${article}|${word}`, block.category);
      }
    }
  }
  return map;
}

const curatedArticleWordToTheme = buildCuratedMap();

/** A1 üçün: mövzu siyahısındakı sözlərə Alman mövzu adı, qalanlara CSV kateqoriyası. */
export function getA1DisplayCategory(
  level: string,
  article: Article,
  word: string,
  csvCategory: string | undefined,
): string {
  if (level === 'A1') {
    const theme = curatedArticleWordToTheme.get(`${article}|${word}`);
    if (theme) return theme;
  }
  const c = csvCategory?.trim();
  return c || 'Digər';
}

export function sortVocabularyCategoryKeys(categories: string[]): string[] {
  const set = new Set(categories);
  const themeOrderList: string[] = [...A1_CURATED_THEME_ORDER];
  const ordered = themeOrderList.filter((c) => set.has(c));
  const rest = categories.filter((c) => !themeOrderList.includes(c));
  rest.sort((a, b) => {
    if (a === 'İsim') return 1;
    if (b === 'İsim') return -1;
    return a.localeCompare(b, 'az');
  });
  return [...ordered, ...rest];
}
