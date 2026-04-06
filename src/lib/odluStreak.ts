import { previousLocalDateKey } from './dateKeys';
import { ODLU_DAILY_GOAL } from '../types';

export interface OdluSeriyaState {
  streak: number;
  correctToday: number;
  goal: number;
  metToday: boolean;
  /** Gün bitməmiş, norma yoxdur, amma seriya hələ davam edir (dünən tamamlanıb). */
  atRisk: boolean;
}

function correctOnDay(map: Record<string, number>, day: string): number {
  const n = map[day];
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function dayMetGoal(map: Record<string, number>, day: string, goal: number): boolean {
  return correctOnDay(map, day) >= goal;
}

/**
 * Ardıcıl günlər: hər gün ən azı `goal` düzgün cavab.
 * Bu gün tamamlanmayıbsa, zəncir dündən sayılır (Duolingo kimi).
 */
export function computeOdluSeriya(
  dailyCorrectCountByDate: Record<string, number>,
  todayKey: string,
  goal: number = ODLU_DAILY_GOAL,
): OdluSeriyaState {
  const correctToday = correctOnDay(dailyCorrectCountByDate, todayKey);
  const metToday = correctToday >= goal;

  let anchor = todayKey;
  if (!metToday) {
    anchor = previousLocalDateKey(todayKey);
  }

  let streak = 0;
  let d = anchor;
  for (let guard = 0; guard < 4000; guard++) {
    if (!dayMetGoal(dailyCorrectCountByDate, d, goal)) break;
    streak += 1;
    d = previousLocalDateKey(d);
  }

  const atRisk = !metToday && streak > 0;

  return {
    streak,
    correctToday,
    goal,
    metToday,
    atRisk,
  };
}
