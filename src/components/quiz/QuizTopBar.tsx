import type { LevelProgressStats } from '../../types';

interface QuizTopBarProps {
  stats: LevelProgressStats;
  xpPop?: boolean;
  /** Öyrənmə: canlar (qırmızı / boş boz) */
  hearts?: { filled: number; max: number };
  /** Player avatar emoji from Zustand (`avatarIdToEmoji(store.avatar)`) */
  playerEmoji?: string;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className={filled ? 'artikl-heart artikl-heart--on' : 'artikl-heart artikl-heart--off'}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 21s-6.716-4.432-9-8.5C.78 9.384 2.14 5 6.03 5c1.868 0 3.242 1.091 3.97 2.5C10.728 6.09 12.102 5 13.97 5 17.86 5 19.22 9.384 17 12.5 14.716 16.568 12 21 12 21z" />
    </svg>
  );
}

export function QuizTopBar({ stats, xpPop, hearts, playerEmoji }: QuizTopBarProps) {
  return (
    <>
      {hearts ? (
        <div className="artikl-hearts-row" role="img" aria-label={`Can: ${hearts.filled} / ${hearts.max}`}>
          {Array.from({ length: hearts.max }, (_, i) => (
            <HeartIcon key={i} filled={i < hearts.filled} />
          ))}
        </div>
      ) : null}
    <div className="artikl-topbar">
      <div className="artikl-topbar-left">
        {playerEmoji ? (
          <span className="artikl-player-emoji" role="img" aria-label="Avatar">
            {playerEmoji}
          </span>
        ) : null}
        <div className={`artikl-xp-badge ${xpPop ? 'artikl-xp-pop' : ''}`}>{stats.xp} XP</div>
      </div>
      <div className="artikl-streak-block">
        <div className="artikl-streak-icon" aria-hidden>
          <svg viewBox="0 0 14 14" fill="none">
            <path
              className="artikl-streak-flame-outer"
              d="M7 1C7 1 3 5 3 8.5C3 10.9 4.8 13 7 13C9.2 13 11 10.9 11 8.5C11 5 7 1 7 1Z"
              fill="#F59E0B"
            />
            <path
              className="artikl-streak-flame-inner"
              d="M7 7C7 7 5 9 5 10.2C5 11.2 5.9 12 7 12C8.1 12 9 11.2 9 10.2C9 9 7 7 7 7Z"
              fill="#ff8c00"
            />
          </svg>
        </div>
        <span className="artikl-streak-count">{stats.streak}</span>
      </div>
      <div className="artikl-rec-chip">
        Rekord <span>{stats.bestStreak}</span>
      </div>
    </div>
    </>
  );
}
