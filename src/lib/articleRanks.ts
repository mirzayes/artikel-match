export type ArticleRankTier =
  | 'yeni_yetme'
  | 'sagird'
  | 'doyushchu'
  | 'qazi'
  | 'cengaver'
  | 'ustad';

const TIER_LABEL: Record<ArticleRankTier, string> = {
  yeni_yetme: 'Yeni yetmə',
  sagird: 'Şagird',
  doyushchu: 'Döyüşçü',
  qazi: 'Qazi',
  cengaver: 'Cəngavər',
  ustad: 'Ustad',
};

export function articleMasteryPercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((correct / total) * 100));
}

export function articleRankFromPercent(pct: number): {
  tier: ArticleRankTier;
  /** Yalnız 100% — «Ustad», qızılı parıltı. */
  isUstad: boolean;
  label: string;
} {
  if (pct >= 100) {
    return { tier: 'ustad', isUstad: true, label: TIER_LABEL.ustad };
  }
  if (pct >= 91) {
    return { tier: 'cengaver', isUstad: false, label: TIER_LABEL.cengaver };
  }
  if (pct >= 71) {
    return { tier: 'qazi', isUstad: false, label: TIER_LABEL.qazi };
  }
  if (pct >= 46) {
    return { tier: 'doyushchu', isUstad: false, label: TIER_LABEL.doyushchu };
  }
  if (pct >= 21) {
    return { tier: 'sagird', isUstad: false, label: TIER_LABEL.sagird };
  }
  return { tier: 'yeni_yetme', isUstad: false, label: TIER_LABEL.yeni_yetme };
}
