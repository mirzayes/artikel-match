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
 * `streakFreezeCoversToday` — bu gün üçün dondurucu aktivdirsə, seriya hesabında
 * bu gün norma tutulmuş kimi sayılır (faktiki `correctToday` eyni qalır).
 */
export function computeOdluSeriya(
  dailyCorrectCountByDate: Record<string, number>,
  todayKey: string,
  goal: number = ODLU_DAILY_GOAL,
  streakFreezeCoversToday = false,
): OdluSeriyaState {
  const correctToday = correctOnDay(dailyCorrectCountByDate, todayKey);
  const metToday = correctToday >= goal;

  const effectiveTodayForStreak =
    streakFreezeCoversToday && correctToday < goal ? goal : correctToday;
  const mapForStreak =
    effectiveTodayForStreak === correctToday
      ? dailyCorrectCountByDate
      : { ...dailyCorrectCountByDate, [todayKey]: effectiveTodayForStreak };

  const effectiveMetToday = effectiveTodayForStreak >= goal;
  let anchor = todayKey;
  if (!effectiveMetToday) {
    anchor = previousLocalDateKey(todayKey);
  }

  let streak = 0;
  let d = anchor;
  for (let guard = 0; guard < 4000; guard++) {
    if (!dayMetGoal(mapForStreak, d, goal)) break;
    streak += 1;
    d = previousLocalDateKey(d);
  }

  const freezeRelievesRisk = streakFreezeCoversToday && correctToday < goal;
  const atRisk = !metToday && streak > 0 && !freezeRelievesRisk;

  return {
    streak,
    correctToday,
    goal,
    metToday,
    atRisk,
  };
}
