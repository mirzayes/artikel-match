import type { NounEntry } from '../types';
import { LEARNED_FOR_TRAINING_MASTERY } from '../types';

export type CollectionBucketKey =
  | 'food'
  | 'travel'
  | 'work_school'
  | 'home_life'
  | 'body_style'
  | 'time_place'
  | 'general';

export const COLLECTION_BUCKET_ORDER: CollectionBucketKey[] = [
  'food',
  'travel',
  'work_school',
  'home_life',
  'body_style',
  'time_place',
  'general',
];

const CATEGORY_TO_BUCKET: Record<string, CollectionBucketKey> = {
  Essen: 'food',
  Getränke: 'food',
  Verkehr: 'travel',
  İstiqamət: 'travel',
  'Ölkə/Milliyyət': 'travel',
  Peşə: 'work_school',
  Məktəb: 'work_school',
  'İmtahan dili': 'work_school',
  Haushalt: 'home_life',
  Möbel: 'home_life',
  Alltag: 'home_life',
  Ailə: 'home_life',
  Kleidung: 'body_style',
  Körper: 'body_style',
  Zaman: 'time_place',
  'Günün vaxtı': 'time_place',
  'Həftə günü': 'time_place',
  Wetter: 'time_place',
  Fəsil: 'time_place',
  İsim: 'general',
  Anglisizm: 'general',
};

export function nounCategoryBucket(category: string | undefined): CollectionBucketKey {
  if (!category) return 'general';
  return CATEGORY_TO_BUCKET[category] ?? 'general';
}

export function isWordMasteredForLevel(
  wordId: string,
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
): boolean {
  if (knownWordIds.includes(wordId)) return true;
  return (masteryByWordId[wordId] ?? 0) >= LEARNED_FOR_TRAINING_MASTERY;
}

export function countMasteredInLevel(
  nounsInLevel: NounEntry[],
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
): number {
  let c = 0;
  for (const n of nounsInLevel) {
    if (isWordMasteredForLevel(n.id, knownWordIds, masteryByWordId)) c += 1;
  }
  return c;
}

export type BucketProgress = {
  key: CollectionBucketKey;
  mastered: number;
  total: number;
  fraction: number;
};

export function collectionBucketProgress(
  nounsInLevel: NounEntry[],
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
): BucketProgress[] {
  const tallies: Record<CollectionBucketKey, { mastered: number; total: number }> = {
    food: { mastered: 0, total: 0 },
    travel: { mastered: 0, total: 0 },
    work_school: { mastered: 0, total: 0 },
    home_life: { mastered: 0, total: 0 },
    body_style: { mastered: 0, total: 0 },
    time_place: { mastered: 0, total: 0 },
    general: { mastered: 0, total: 0 },
  };

  for (const n of nounsInLevel) {
    const b = nounCategoryBucket(n.category);
    tallies[b].total += 1;
    if (isWordMasteredForLevel(n.id, knownWordIds, masteryByWordId)) tallies[b].mastered += 1;
  }

  return COLLECTION_BUCKET_ORDER.map((key) => {
    const { mastered, total } = tallies[key];
    return {
      key,
      mastered,
      total,
      fraction: total > 0 ? mastered / total : 0,
    };
  }).filter((row) => row.total > 0);
}
