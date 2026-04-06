import type { GoetheLevel, NounEntry } from '../../types';
import { GOETHE_LEVELS } from '../../types';
import {
  buildWordCounts,
  mergeLexiconWithBundled,
  parseGoetheLexiconJson,
} from './lexicon';
import { emptyNounsByLevel } from './bundledLexiconLoader';

/**
 * Leksikon mənbələri
 * -----------------
 * 1) Daxili (bundled) sözlər: ./a1.ts … ./c1.ts — tədris üçün əsas dəst.
 *    UI üçün `VocabularyProvider` — dinamik yükləmə, 50-lik hissələr.
 *
 * 2) Genişləndirilmiş siyahı: `public/goethe-lexicon.json` (məsələn `npm run lexicon` ilə
 *    `src/data/words/source/goethe-a1-az.csv`-dən generasiya olunur).
 *    Goethe Institut-un rəsmi “Wortliste” PDF-ləri müəllif hüquqlu materialdır; onların tam
 *    məzmununu bu repozitoriyaya mən köçürə bilmərəm. İmtahan üçün tam rəsmi siyahını
 *    istəyirsinizsə, PDF/CSV-ni Goethe və ya DWDS kimi mənbələrdən özünüz əldə edib
 *    aşağıdakı JSON formatına çevirin və faylı `public/goethe-lexicon.json` kimi yerləşdirin.
 *    Tətbiq işə düşəndə bu faylı yükləyir; boş səviyyələr bundled sözlərlə doldurulur.
 *    Çoxdilli gloss: `public/lexicon-glosses/{en,ru,tr,kr,zh,es,ar}.json` (word id → gloss; az əsas sahədə).
 *    Seçilmiş dilə yalnız həmin JSON yüklənir — `npm run lexicon:gloss-split` və ya `lexicon:translate`.
 *
 * JSON nümunə (birbaşa və ya { "levels": { ... } }):
 * {
 *   "A1": [
 *     { "article": "der", "word": "Mann", "translation": "kişi" }
 *   ],
 *   "A2": [], "B1": [], "B2": [], "C1": []
 * }
 *
 * İstəyə görə hər sətirdə "id": "unikal-id" verə bilərsiniz.
 */
export const LEXICON_PUBLIC_URL = '/goethe-lexicon.json';

export {
  buildWordCounts,
  mergeLexiconWithBundled,
  parseGoetheLexiconJson,
};

export { emptyNounsByLevel, loadBundledLexiconProgressive, applyNounsByLevelInChunks } from './bundledLexiconLoader';

/** Köhnə importlar: boş başlanğıc; canlı leksikon üçün VocabularyContext istifadə edin. */
export const NOUNS_BY_LEVEL: Record<GoetheLevel, NounEntry[]> = emptyNounsByLevel();

const emptyCounts = buildWordCounts(emptyNounsByLevel());

export const WORD_COUNT_BY_LEVEL: Record<GoetheLevel, number> = emptyCounts.wordCountByLevel;

export const TOTAL_WORD_COUNT = emptyCounts.totalWordCount;

export function getNounsForLevel(level: GoetheLevel): NounEntry[] {
  return NOUNS_BY_LEVEL[level];
}

export const ALL_NOUNS: NounEntry[] = GOETHE_LEVELS.flatMap((l) => NOUNS_BY_LEVEL[l]);
