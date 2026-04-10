import type { NounEntry } from '../types';
import { LEARNED_FOR_TRAINING_MASTERY } from '../types';
import { useGameStore } from '../store/useGameStore';

/** A1 üzrə bütün sözlər «mənimsənilib» (5 ulduz və ya bilirəm). */
export function isA1LevelFullyMastered(
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
  a1Nouns: NounEntry[],
): boolean {
  if (a1Nouns.length === 0) return false;
  const known = new Set(knownWordIds);
  return a1Nouns.every(
    (n) =>
      known.has(n.id) || (masteryByWordId[n.id] ?? 0) >= LEARNED_FOR_TRAINING_MASTERY,
  );
}

/** Bir dəfə +1000 sikkə + qızıl sandıq animasiyası. */
export function tryClaimA1MasterReward(
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
  a1Nouns: NounEntry[],
): void {
  if (useGameStore.getState().a1MasterRewardClaimed) return;
  if (!isA1LevelFullyMastered(knownWordIds, masteryByWordId, a1Nouns)) return;
  useGameStore.getState().grantA1MasterReward();
}
