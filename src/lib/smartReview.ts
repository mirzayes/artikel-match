import type { NounEntry } from '../types';
import { MAX_MASTERY_LEVEL } from '../types';

/** Saxlanmış dəyəri 0…MAX_MASTERY_LEVEL aralığına salır. */
export function clampMastery(n: number): number {
  return Math.min(MAX_MASTERY_LEVEL, Math.max(0, Math.floor(n)));
}

/** Viktorina: bütün lüğət bir dəfə təsadüfi ardıcıllıqla, sonra təkrarlanan sonsuz döngü. */
export function shuffleNounPool(pool: NounEntry[]): NounEntry[] {
  if (pool.length <= 1) return [...pool];
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = t;
  }
  return copy;
}

/**
 * Ağıllı təkrar: aşağı mastery → daha böyük çəki (daha tez-tez seçilir).
 * Çəki (6 - m)² — mastery 0 üçün 36, 5 üçün 1.
 */
export function pickSmartReview(
  pool: NounEntry[],
  excludeId: string | null,
  masteryByWordId: Record<string, number>,
): NounEntry {
  const candidates = excludeId ? pool.filter((n) => n.id !== excludeId) : [...pool];
  if (candidates.length === 0) return pool[0]!;
  const weights = candidates.map((n) => {
    const m = clampMastery(masteryByWordId[n.id] ?? 0);
    return (MAX_MASTERY_LEVEL + 1 - m) ** 2;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}
