/**
 * Spaced repetition (öyrənmə rejimi): streak, lastAttempt, nextReview (ISO-8601).
 */

import type { WordSrsEntry } from '../types';

export function addMinutesUtc(from: Date, minutes: number): Date {
  return new Date(from.getTime() + minutes * 60_000);
}

/** Səhv: 1 dəqiqə sonra. */
export function nextReviewAfterWrong(from: Date = new Date()): Date {
  return addMinutesUtc(from, 1);
}

/**
 * Düzgün cavabdan SONRA olan streak dəyərinə görə interval.
 * 1 → dəqiq 24 saat (Təkrar / retention), 2 → +3 gün (günün başı), 3+ → +7 gün.
 */
export function nextReviewAfterCorrect(streakAfterCorrect: number, from: Date = new Date()): Date {
  if (streakAfterCorrect <= 0) return from;
  const base = new Date(from);
  if (streakAfterCorrect === 1) {
    return addMinutesUtc(from, 24 * 60);
  }
  if (streakAfterCorrect === 2) {
    base.setDate(base.getDate() + 3);
    base.setHours(0, 0, 0, 0);
    return base;
  }
  base.setDate(base.getDate() + 7);
  base.setHours(0, 0, 0, 0);
  return base;
}

export function isSrsDue(entry: WordSrsEntry | undefined, now: Date = new Date()): boolean {
  if (!entry) return true;
  const t = Date.parse(entry.nextReview);
  if (!Number.isFinite(t)) return true;
  return t <= now.getTime();
}

/** Təkrar: yalnız interval ən azı ~24 saat olan (ilk retention və ya daha uzun) və növbəsi çatmış sözlər. */
const MIN_INTERVAL_REPEAT_MS = 24 * 60 * 60 * 1000 - 60_000;

export function isMatureDueForIntervalRepeat(
  entry: WordSrsEntry | undefined,
  now: Date = new Date(),
): boolean {
  if (!entry) return false;
  const last = Date.parse(entry.lastAttempt);
  const next = Date.parse(entry.nextReview);
  if (!Number.isFinite(last) || !Number.isFinite(next)) return false;
  if (next > now.getTime()) return false;
  return next - last >= MIN_INTERVAL_REPEAT_MS;
}

/** 0…5 ulduz üçün: mövcud streak (düzgün cədvəl pilləsi). */
export function srsStreakToStarLevel(streak: number): number {
  return Math.min(5, Math.max(0, Math.floor(streak)));
}
