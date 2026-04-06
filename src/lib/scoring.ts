/**
 * XP: hər düzgün cavab üçün əsas 10; hər tam 5-lik seriya mərhələsi +5 (maks. 6 mərhələ → +30 əlavə).
 * Nümunə: seriya 1–4 → 10 XP; 5–9 → 15; 10–14 → 20; …; 30+ → 40.
 */
export function xpForCorrectAnswer(streakAfterCorrect: number): number {
  if (streakAfterCorrect < 1) return 0;
  const tier = Math.min(Math.floor(streakAfterCorrect / 5), 6);
  return 10 + tier * 5;
}
