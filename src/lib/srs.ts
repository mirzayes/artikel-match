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
 * 1 → sabah (yerli günün başlanğıcı), 2 → +3 gün, 3+ → +7 gün.
 */
export function nextReviewAfterCorrect(streakAfterCorrect: number, from: Date = new Date()): Date {
  if (streakAfterCorrect <= 0) return from;
  const base = new Date(from);
  if (streakAfterCorrect === 1) {
    base.setDate(base.getDate() + 1);
    base.setHours(0, 0, 0, 0);
    return base;
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

/** 0…5 ulduz üçün: mövcud streak (düzgün cədvəl pilləsi). */
export function srsStreakToStarLevel(streak: number): number {
  return Math.min(5, Math.max(0, Math.floor(streak)));
}
