/** Gümüşdə Qızıla «son təkan» — bu XP intervalında gümüş parlaq zolğ göstərilir. */
export const LEAGUE_SILVER_PUSH_START_XP = 6_515;
export const LEAGUE_GOLD_MIN_XP = 10_000;

export function leagueSilverToGoldFillPercent(xp: number): number {
  if (xp >= LEAGUE_GOLD_MIN_XP) return 100;
  if (xp <= LEAGUE_SILVER_PUSH_START_XP) return 0;
  return (
    ((xp - LEAGUE_SILVER_PUSH_START_XP) / (LEAGUE_GOLD_MIN_XP - LEAGUE_SILVER_PUSH_START_XP)) * 100
  );
}

/** Yerli təqvim: cari ayın son saniyəsi (mövsüm bitişi). */
export function leagueSeasonEndsAtLocal(from: Date = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function leagueSeasonRemainingMs(now: Date, seasonEnd: Date): number {
  return Math.max(0, seasonEnd.getTime() - now.getTime());
}
