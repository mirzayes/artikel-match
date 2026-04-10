import { useGameStore } from '../store/useGameStore';
import { coinsWithTurboMultiplier } from './coinBonus';
import { consecutiveLearnDaysThroughToday } from './learnStreak';

export const ACHIEVEMENT_MARATHON = 'marafoncu';
export const ACHIEVEMENT_DUEL_MASTER = 'duel_ustasi';

const MARATHON_DAYS = 7;
const MARATHON_COINS = 200;
const DUEL_MASTER_WINS = 10;
const DUEL_MASTER_COINS = 150;

function hasAchievement(id: string): boolean {
  return useGameStore.getState().achievementIds.includes(id);
}

/** Öyrənmə düzgün cavablarından sonra (7 gün ardıcıl). */
export function tryUnlockMarathonAchievement(learningCorrectByDate: Record<string, number>): void {
  if (hasAchievement(ACHIEVEMENT_MARATHON)) return;
  if (consecutiveLearnDaysThroughToday(learningCorrectByDate) < MARATHON_DAYS) return;
  const coins = coinsWithTurboMultiplier(MARATHON_COINS);
  useGameStore.getState().unlockAchievement(ACHIEVEMENT_MARATHON, coins);
}

/** Duel qələbələrinin sayı hədəfə çatanda. */
export function tryUnlockDuelMasterAchievement(totalWins: number): void {
  if (hasAchievement(ACHIEVEMENT_DUEL_MASTER)) return;
  if (totalWins < DUEL_MASTER_WINS) return;
  const coins = coinsWithTurboMultiplier(DUEL_MASTER_COINS);
  useGameStore.getState().unlockAchievement(ACHIEVEMENT_DUEL_MASTER, coins);
}
