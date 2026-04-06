import { motion } from 'framer-motion';
import type { Article } from '../../types';

const CONFETTI_COLORS = ['#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#f87171', '#818cf8'];

export type SessionWordSummary = {
  id: string;
  word: string;
  article: Article;
  translation: string;
};

type LearningSessionWinProps = {
  goal: number;
  easyWords?: SessionWordSummary[];
  hardWords?: SessionWordSummary[];
  /** Arap lüğəti üçün tərcümə sütunu RTL */
  glossRtl?: boolean;
  /** Boşdursa «Ana səhifə» */
  secondaryActionLabel?: string;
  onHome: () => void;
  onRestart: () => void;
};

function WordColumn({
  title,
  tone,
  words,
  glossRtl,
}: {
  title: string;
  tone: 'easy' | 'hard';
  words: SessionWordSummary[];
  glossRtl?: boolean;
}) {
  const border =
    tone === 'easy' ? 'border-emerald-500/25 bg-emerald-950/20' : 'border-rose-500/25 bg-rose-950/20';
  const label = tone === 'easy' ? 'text-emerald-200/90' : 'text-rose-200/90';

  return (
    <div className={`learning-win-col rounded-2xl border p-3 ${border}`}>
      <p className={`mb-2 text-center text-[0.65rem] font-bold uppercase tracking-widest ${label}`}>{title}</p>
      {words.length === 0 ? (
        <p className="py-2 text-center text-xs text-[rgba(232,232,245,0.38)]">—</p>
      ) : (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto text-left text-sm">
          {words.map((w) => (
            <li key={w.id} className="leading-snug text-[rgba(232,232,245,0.82)]">
              <span className="font-semibold text-violet-200/90">{w.article}</span> {w.word}
              <span
                className="block text-xs font-normal text-[rgba(232,232,245,0.45)]"
                style={
                  glossRtl ? { direction: 'rtl', textAlign: 'right' as const } : undefined
                }
              >
                {w.translation}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LearningSessionWin({
  goal,
  easyWords = [],
  hardWords = [],
  glossRtl = false,
  secondaryActionLabel = 'Ana səhifə',
  onHome,
  onRestart,
}: LearningSessionWinProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="learning-win-root"
      role="dialog"
      aria-modal
      aria-labelledby="learning-win-title"
    >
      <div className="learning-win-confetti" aria-hidden>
        {Array.from({ length: 22 }, (_, i) => (
          <span
            key={i}
            className="learning-win-confetti-piece"
            style={{
              left: `${(i * 53) % 100}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
              animationDelay: `${(i % 10) * 0.07}s`,
            }}
          />
        ))}
      </div>
      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        className="learning-win-card glass-card learning-win-card--wide"
      >
        <p className="learning-win-emoji" aria-hidden>
          🎉
        </p>
        <h2 id="learning-win-title" className="learning-win-title">
          Sessiya tamamlandı!
        </h2>
        <p className="learning-win-sub">
          {goal} söz üzrə 5 ulduz — növbə tam mənimsənildi.
        </p>

        <div className="learning-win-columns">
          <WordColumn title="Asan (bilirəm)" tone="easy" words={easyWords} glossRtl={glossRtl} />
          <WordColumn title="Çətin (təkrar)" tone="hard" words={hardWords} glossRtl={glossRtl} />
        </div>

        <div className="learning-win-actions">
          <button type="button" className="learning-win-btn learning-win-btn-primary" onClick={onRestart}>
            Yenidən başla
          </button>
          <button type="button" className="learning-win-btn learning-win-btn-ghost" onClick={onHome}>
            {secondaryActionLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export { LearningSessionWin as ResultView };
