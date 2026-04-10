import { formatLocalDate, previousLocalDateKey } from './dateKeys';

/**
 * Ardıcıl təqvim günləri: həmin gün öyrənmə kvizində ən azı bir düzgün cavab olub.
 * `learningCorrectByDate[ymd]` > 0
 */
export function consecutiveLearnDaysFrom(learningCorrectByDate: Record<string, number>, fromYmd: string): number {
  let ymd = fromYmd;
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const c = learningCorrectByDate[ymd] ?? 0;
    if (c > 0) {
      n++;
      ymd = previousLocalDateKey(ymd);
    } else break;
  }
  return n;
}

export function consecutiveLearnDaysThroughToday(learningCorrectByDate: Record<string, number>): number {
  return consecutiveLearnDaysFrom(learningCorrectByDate, formatLocalDate(new Date()));
}
