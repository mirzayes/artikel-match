import type { NounEntry } from '../types';
import { GOETHE_LEVELS, type GoetheLevel } from '../types';

/** A2: bu ümumi XP-dən sonra açılır (bütün səviyyələrin cəmi). */
export const A2_UNLOCK_MIN_TOTAL_XP = 5000;

/** B1: bir dəfə Artik ilə və ya Fast Pass. B2/C1 — elit məzmun, daha bahalı. */
export const B1_LEVEL_UNLOCK_ARTIK_COST = 1000;
export const B2_LEVEL_UNLOCK_ARTIK_COST = 2000;
export const C1_LEVEL_UNLOCK_ARTIK_COST = 2000;

/** IAP göstəriciləri (real ödəniş SDK yoxdur — demo təsdiq). */
export const LEVEL_UNLOCK_PRICE_AZN = 2;
/** UI: B1+ üçün “Fast Pass” (eyni demo qiymət). */
export const FAST_PASS_PRICE_AZN = LEVEL_UNLOCK_PRICE_AZN;
export const COIN_PACK_1000_PRICE_AZN = 0.99;
export const COIN_PACK_1000_AMOUNT = 1000;

const GATED: GoetheLevel[] = ['A2', 'B1', 'B2', 'C1'];

export type LevelGateCheckArgs = {
  totalXpAllLevels: number;
  knownWordIds: string[];
  masteryByWordId: Record<string, number>;
  nounsByLevel: Record<GoetheLevel, NounEntry[]>;
  /** AZN ilə açılmış səviyyələr (persist). */
  iapLevelUnlocks: Partial<Record<GoetheLevel, boolean>>;
  /** B1/B2/C1 bir dəfə Artik ödəməklə (persist). */
  levelGateCoinUnlocks: Partial<Record<GoetheLevel, boolean>>;
};

export function previousGoetheLevel(level: GoetheLevel): GoetheLevel | null {
  const i = GOETHE_LEVELS.indexOf(level);
  if (i <= 0) return null;
  return GOETHE_LEVELS[i - 1]!;
}

export function coinUnlockCostForLevel(level: GoetheLevel): number | null {
  if (level === 'B1') return B1_LEVEL_UNLOCK_ARTIK_COST;
  if (level === 'B2') return B2_LEVEL_UNLOCK_ARTIK_COST;
  if (level === 'C1') return C1_LEVEL_UNLOCK_ARTIK_COST;
  return null;
}

/** B1/B2/C1 yalnız Artik və ya Fast Pass ilə (əvvəlki pillə açıq olmalıdır). */
function isPremiumContentLevel(level: GoetheLevel): level is 'B1' | 'B2' | 'C1' {
  return level === 'B1' || level === 'B2' || level === 'C1';
}

/** A1 həmişə açıq; A2 — XP və ya IAP; B1+ — əvvəlki pillə + Artik və ya Fast Pass. */
export function isLevelGateUnlocked(level: GoetheLevel, args: LevelGateCheckArgs): boolean {
  if (level === 'A1') return true;
  if (!GATED.includes(level)) return true;

  if (level === 'A2') {
    return (
      args.totalXpAllLevels >= A2_UNLOCK_MIN_TOTAL_XP || Boolean(args.iapLevelUnlocks.A2)
    );
  }

  if (isPremiumContentLevel(level)) {
    const prev = previousGoetheLevel(level);
    if (!prev) return true;
    if (!isLevelGateUnlocked(prev, args)) return false;
    return Boolean(args.iapLevelUnlocks[level] || args.levelGateCoinUnlocks[level]);
  }

  return true;
}

export function highestUnlockedGoetheLevel(args: LevelGateCheckArgs): GoetheLevel {
  let best: GoetheLevel = 'A1';
  for (const lvl of GOETHE_LEVELS) {
    if (isLevelGateUnlocked(lvl, args)) best = lvl;
    else break;
  }
  return best;
}

export function isGoetheLevelGated(level: GoetheLevel): boolean {
  return level !== 'A1' && GATED.includes(level);
}

/** IAP düyməsi: əvvəlki pillə artıq açıq olmalıdır. */
export function canBuyIapUnlockForLevel(level: GoetheLevel, args: LevelGateCheckArgs): boolean {
  if (!isGoetheLevelGated(level)) return false;
  if (isLevelGateUnlocked(level, args)) return false;
  if (level === 'A2') return true;
  const prev = previousGoetheLevel(level);
  if (!prev) return false;
  return isLevelGateUnlocked(prev, args);
}

