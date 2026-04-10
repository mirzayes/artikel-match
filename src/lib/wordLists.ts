import type { GoetheLevel, NounEntry, WordSrsEntry } from '../types';
import { GOETHE_LEVELS } from '../types';
import { shuffleInPlace } from './vokabelnCsv';
import { isMatureDueForIntervalRepeat, isSrsDue } from './srs';

/** «Ən çox səhv edilənlər»: yalnız bu qədər və ya daha çox səhv olan sözlər. */
export const TOP_WRONG_MIN_ERRORS = 5;

export function topWrongWordsInLevel(
  nounsInLevel: NounEntry[],
  wrongCountByWordId: Record<string, number>,
  limit = 8,
): { entry: NounEntry; wrongs: number }[] {
  const rows: { entry: NounEntry; wrongs: number }[] = [];
  for (const n of nounsInLevel) {
    const w = wrongCountByWordId[n.id] ?? 0;
    if (w >= TOP_WRONG_MIN_ERRORS) rows.push({ entry: n, wrongs: w });
  }
  rows.sort((a, b) => b.wrongs - a.wrongs);
  return rows.slice(0, limit);
}

/** Bütün leksikondan (təkrarsız id) ən çox səhv; statistika ekranı üçün. */
export function topWrongWordsGlobal(
  allNouns: NounEntry[],
  wrongCountByWordId: Record<string, number>,
  limit = 80,
): { entry: NounEntry; wrongs: number }[] {
  const seen = new Set<string>();
  const unique: NounEntry[] = [];
  for (const n of allNouns) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    unique.push(n);
  }
  return topWrongWordsInLevel(unique, wrongCountByWordId, limit);
}

export function hardWordsInLevel(nounsInLevel: NounEntry[], hardWordIds: string[]): NounEntry[] {
  const set = new Set(hardWordIds);
  return nounsInLevel.filter((n) => set.has(n.id));
}

export function filterNounsByIds(nounsInLevel: NounEntry[], wordIds: string[]): NounEntry[] {
  if (wordIds.length === 0) return [];
  const set = new Set(wordIds);
  return nounsInLevel.filter((n) => set.has(n.id));
}

/** Bütün səviyyələrdən təkrarsız söz siyahısı (ilk təkrar saxlanılır). */
export function allNounsDeduped(nounsByLevel: Record<GoetheLevel, NounEntry[]>): NounEntry[] {
  const seen = new Set<string>();
  const out: NounEntry[] = [];
  for (const lvl of GOETHE_LEVELS) {
    for (const n of nounsByLevel[lvl]) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(n);
    }
  }
  return out;
}

export function knownWordsInLevel(nounsInLevel: NounEntry[], knownWordIds: string[]): NounEntry[] {
  const set = new Set(knownWordIds);
  return nounsInLevel.filter((n) => set.has(n.id));
}

export function filterQuizPool(
  nounsInLevel: NounEntry[],
  poolMode: 'all' | 'hard',
  hardWordIds: string[],
  knownWordIds: string[],
): NounEntry[] {
  const known = new Set(knownWordIds);
  let list = nounsInLevel.filter((n) => !known.has(n.id));
  if (poolMode === 'hard') {
    const hard = new Set(hardWordIds);
    list = list.filter((n) => hard.has(n.id));
  }
  return list;
}

/** Öyrənmə: yalnız `knownWordIds`-də olmayan sözlər (localStorage: german-articles-progress-v2). */
export function filterLearningQuizPool(nounsInLevel: NounEntry[], knownWordIds: string[]): NounEntry[] {
  const known = new Set(knownWordIds);
  return nounsInLevel.filter((n) => !known.has(n.id));
}

/**
 * Öyrənmə sessiyası: səviyyə siyahısı + «tam bilinən» çıxarılır, Fisher–Yates qarışdırma, `limit` qədər.
 * (`sort(() => Math.random() - 0.5)` əvəzinə `shuffleInPlace`.)
 */
export function getLearningSessionPool(
  nounsInLevel: NounEntry[],
  knownWordIds: string[],
  limit: number,
): NounEntry[] {
  const eligible = filterLearningQuizPool(nounsInLevel, knownWordIds);
  if (!eligible.length) return [];
  const copy = eligible.slice();
  shuffleInPlace(copy);
  return copy.slice(0, Math.min(limit, copy.length));
}

function cmpNextReview(
  a: NounEntry,
  b: NounEntry,
  srsByWordId: Record<string, WordSrsEntry>,
): number {
  const ta = Date.parse(srsByWordId[a.id]?.nextReview ?? '') || 0;
  const tb = Date.parse(srsByWordId[b.id]?.nextReview ?? '') || 0;
  return ta - tb;
}

/** Sessiya əvvəlində: Artik üçün «yeni» vs «təkrar» (köhnə SRS streak). */
export function classifyLessonCoinWordType(
  wordId: string,
  knownWordIds: string[],
  srsByWordId: Record<string, WordSrsEntry>,
): 'new' | 'review' {
  const known = new Set(knownWordIds);
  if (known.has(wordId)) return 'review';
  const e = srsByWordId[wordId];
  if (!e || e.streak < 1) return 'new';
  return 'review';
}

/**
 * SRS öyrənmə növbəsi:
 * - «Bilinən» amma növbəsi çatmış sözlər (Təkrar) əvvəl.
 * - Sonra öyrənilməkdə olan və növbəsi çatan / heç vaxt görülməmişlər.
 * - Gələcək növbəli sözlər sessiyaya düşmür (24 saat və s. gözləyir).
 * `reviewOnly`: yalnız «mənimsənilmiş» sözlər, SRS intervalı ≥ ~24 saat və növbəsi çatmış (qısa «səhv→1 dəq» sıraya düşmür).
 */
export function getSrsLearningSessionPool(
  nounsInLevel: NounEntry[],
  knownWordIds: string[],
  srsByWordId: Record<string, WordSrsEntry>,
  limit: number,
  now: Date = new Date(),
  opts?: { reviewOnly?: boolean },
): NounEntry[] {
  if (limit <= 0 || nounsInLevel.length === 0) return [];

  const known = new Set(knownWordIds);
  const reviewOnly = opts?.reviewOnly === true;

  const masteredDue = nounsInLevel
    .filter((n) => known.has(n.id))
    .filter((n) =>
      reviewOnly
        ? isMatureDueForIntervalRepeat(srsByWordId[n.id], now)
        : isSrsDue(srsByWordId[n.id], now),
    )
    .sort((a, b) => cmpNextReview(a, b, srsByWordId));

  const inProgress = nounsInLevel.filter((n) => !known.has(n.id));
  const inProgressDue = reviewOnly
    ? []
    : inProgress
        .filter((n) => {
          const e = srsByWordId[n.id];
          if (!e) return true;
          return isSrsDue(e, now);
        })
        .sort((a, b) => cmpNextReview(a, b, srsByWordId));

  const pickedIds = new Set<string>();
  const out: NounEntry[] = [];

  const pushUnique = (arr: NounEntry[]) => {
    for (const n of arr) {
      if (out.length >= limit) return;
      if (pickedIds.has(n.id)) continue;
      pickedIds.add(n.id);
      out.push(n);
    }
  };

  pushUnique(masteredDue);
  pushUnique(inProgressDue);

  return out;
}

export function countDueWordsForLevel(
  nounsInLevel: NounEntry[],
  knownWordIds: string[],
  srsByWordId: Record<string, WordSrsEntry>,
  kind: 'mixed' | 'review_only',
  now: Date = new Date(),
): number {
  return getSrsLearningSessionPool(nounsInLevel, knownWordIds, srsByWordId, 99_999, now, {
    reviewOnly: kind === 'review_only',
  }).length;
}

/**
 * «Bilinən» sözlər: `knownWordIds` (localStorage: german-articles-progress-v2).
 */
export function excludeKnownNouns(nouns: NounEntry[], knownWordIds: string[]): NounEntry[] {
  return filterQuizPool(nouns, 'all', [], knownWordIds);
}
