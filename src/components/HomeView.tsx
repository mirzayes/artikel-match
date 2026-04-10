import { motion } from 'framer-motion';
import { GOETHE_LEVELS, type GoetheLevel } from '../types';
import { useVocabulary } from '../context/VocabularyContext';

interface HomeViewProps {
  selectedLevel: GoetheLevel;
  onLevelChange: (level: GoetheLevel) => void;
  onStartQuiz: () => void;
  dailyLearned: number;
  dailyGoal: number;
}

export function HomeView({
  selectedLevel,
  onLevelChange,
  onStartQuiz,
  dailyLearned,
  dailyGoal,
}: HomeViewProps) {
  const { wordCountByLevel, usingExternalLexicon } = useVocabulary();

  const dayPct = dailyGoal <= 0 ? 0 : Math.min(100, Math.round((dailyLearned / dailyGoal) * 100));

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--artikl-bg)] px-4 pb-32 pt-8 text-[#1A1A2E] dark:text-stone-200 sm:px-6 sm:pb-36 sm:pt-12">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-md"
      >
        <p className="text-center text-lg font-medium text-artikl-text sm:text-xl">Salam! 👋</p>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-artikl-muted2">
          Bu gün bir az alman artiklləri ilə məşq edək.
        </p>

        <div className="glass-card mt-8 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="card-label text-left">Bu günün məqsədi</p>
            <p className="stat-value font-sans text-sm font-semibold tabular-nums text-[#1A1A2E] dark:text-artikl-text/90">
              {dailyLearned} / {dailyGoal} söz
            </p>
          </div>
          <p className="mt-1 text-xs text-artikl-caption">
            Fərqli sözlərə düzgün cavab — məqsədə çatmaq üçün.
          </p>
          <div
            className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]"
            role="progressbar"
            aria-valuenow={dailyLearned}
            aria-valuemin={0}
            aria-valuemax={dailyGoal}
            aria-label={`Bu gün ${dailyLearned} / ${dailyGoal} söz`}
          >
            <motion.div
              className="h-full rounded-full bg-[var(--artikl-accent)]"
              initial={false}
              animate={{ width: `${dayPct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
          <p className="mt-2 text-right text-[11px] tabular-nums text-artikl-caption">{dayPct}%</p>
        </div>
      </motion.div>

      <div className="mx-auto mt-8 w-full max-w-md">
        <div className="glass-card rounded-2xl p-6 sm:p-8">
          <p className="text-center card-label">Goethe səviyyəsi</p>
          {usingExternalLexicon ? (
            <p className="mt-2 text-center text-[11px] font-medium text-emerald-400/90">goethe-lexicon.json yükləndi</p>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {GOETHE_LEVELS.map((lvl) => {
              const on = lvl === selectedLevel;
              const n = wordCountByLevel[lvl];
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onLevelChange(lvl)}
                  className={[
                    'rounded-full px-3.5 py-2 text-sm font-semibold tracking-tight transition-colors',
                    on
                      ? 'border-2 border-purple-600 bg-purple-600 text-white dark:border-transparent dark:bg-[var(--artikl-accent)]'
                      : 'border-2 border-purple-600 bg-white text-purple-600 dark:border-[var(--artikl-border)] dark:bg-transparent dark:text-[var(--artikl-muted2)] hover:dark:border-[var(--artikl-border2)] hover:dark:bg-[var(--artikl-surface)]',
                  ].join(' ')}
                >
                  {lvl}
                  <span className="ml-1 tabular-nums text-xs font-medium text-[#9CA3AF] dark:opacity-75">({n})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="mx-auto mt-10 w-full max-w-md flex-1"
      >
        <button
          type="button"
          onClick={() => onStartQuiz()}
          className="w-full rounded-2xl border-2 border-purple-600 bg-purple-600 py-4 text-[16px] font-semibold text-white transition-transform active:scale-[0.98] dark:border-transparent dark:bg-[var(--artikl-accent)]"
          style={{
            boxShadow: '0 8px 28px rgba(124, 108, 248, 0.25)',
          }}
        >
          Öyrənməyə başla ({selectedLevel})
        </button>
      </motion.div>
    </div>
  );
}
