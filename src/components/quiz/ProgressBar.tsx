import type { LevelProgressStats } from '../../types';

interface ProgressBarProps {
  levelLabel: string;
  positionLabel: string;
  /** 0–1 */
  fraction: number;
  stats: LevelProgressStats;
  /** Boş deyilsə, ümumi stat əvəzinə göstərilir (məs. cari sınaq üçün) */
  accuracyLabel?: string | null;
  /** Sağ çip mətni; default Artikl */
  modeChip?: string;
  /** Öyrənmə: fill üçün transition sinfi (məs. artikl-prog-fill--smooth) */
  fillClassName?: string;
}

export function ProgressBar({
  levelLabel,
  positionLabel,
  fraction,
  stats,
  accuracyLabel,
  modeChip = 'Artikl',
  fillClassName,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, fraction * 100));
  const acc =
    accuracyLabel !== undefined && accuracyLabel !== null
      ? accuracyLabel
      : stats.totalAnswered === 0
        ? '—'
        : `${Math.round((stats.correctTotal / stats.totalAnswered) * 100)}%`;

  return (
    <div className="artikl-prog-section">
      <div className="artikl-prog-meta">
        <span className="artikl-prog-level">{levelLabel}</span>
        <span className="artikl-prog-count">{positionLabel}</span>
      </div>
      <div
        className="artikl-prog-track"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={['artikl-prog-fill', fillClassName].filter(Boolean).join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="artikl-stat-row">
        <div className="artikl-stat-pill artikl-stat-acc">Dəqiqlik {acc}</div>
        <div className="artikl-stat-pill artikl-stat-mode">{modeChip}</div>
      </div>
    </div>
  );
}
