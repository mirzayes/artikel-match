import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVocabulary } from '../context/VocabularyContext';
import { filterLearningQuizPool } from '../lib/wordLists';
import { countMasteredInLevel } from '../lib/dashboardBuckets';
import {
  GOETHE_LEVELS,
  LEARNED_FOR_TRAINING_MASTERY,
  type GoetheLevel,
  type LevelProgressStats,
} from '../types';
import { ArticleRpgCard } from './ArticleRpgCard';
import { OdluSeriyaCard } from './OdluSeriyaCard';
import { DashboardWordLists } from './DashboardWordLists';
import { LeaderboardModal } from './LeaderboardModal';
import type { OdluSeriyaState } from '../lib/odluStreak';

/* ─── compact daily-progress ring ─────────────────────────────────────── */
const RING_R = 52;
const RING_S = 8;
const RING_C = 2 * Math.PI * RING_R;

function DailyRing({ current, goal }: { current: number; goal: number }) {
  const clamped = goal > 0 ? Math.min(1, current / goal) : 0;
  const offset = RING_C * (1 - clamped);
  const done = current >= goal;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[132px] w-[132px]">
        <svg
          width={132}
          height={132}
          viewBox="0 0 132 132"
          className="-rotate-90"
          aria-hidden
        >
          <defs>
            <linearGradient id="dailyRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              {done ? (
                <>
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#f97316" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#8b7cff" />
                  <stop offset="55%" stopColor="#5eead4" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </>
              )}
            </linearGradient>
          </defs>
          <circle
            cx="66"
            cy="66"
            r={RING_R}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={RING_S}
          />
          <circle
            cx="66"
            cy="66"
            r={RING_R}
            fill="none"
            stroke="url(#dailyRingGrad)"
            strokeWidth={RING_S}
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
            Bu gün
          </p>
          <p className="mt-0.5 font-display text-[1.55rem] font-bold leading-none tabular-nums text-white">
            {current}
            <span className="text-[1rem] font-semibold text-white/45"> / {goal}</span>
          </p>
          {done ? (
            <span className="mt-1 text-base leading-none" aria-hidden>🔥</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─── types ────────────────────────────────────────────────────────────── */
const detailsShell =
  'rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-[14px] overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-[0_8px_32px_rgba(0,0,0,0.2)]';

const summaryBtn =
  'flex w-full cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-left text-sm font-semibold text-[rgba(232,232,245,0.85)] transition-colors hover:bg-white/[0.04]';

interface DashboardProps {
  stats: LevelProgressStats;
  totalXpAllLevels: number;
  odluSeriya: OdluSeriyaState;
  displayName: string;
  onSaveDisplayName: (name: string) => void;
  hardWordIds: string[];
  knownWordIds: string[];
  masteryByWordId: Record<string, number>;
  selectedLevel: GoetheLevel;
  onLevelChange: (level: GoetheLevel) => void;
  onStartQuiz: () => void;
  onStartLearnHardWords: (wordIds: string[]) => void;
  onStartExam: () => void;
  onStartDuel: () => void;
  onToggleKnown: (wordId: string) => void;
  onReset: () => void;
  onProfileEnterGame?: () => void;
}

/* ─── component ────────────────────────────────────────────────────────── */
export function Dashboard({
  stats,
  totalXpAllLevels,
  odluSeriya,
  displayName,
  onSaveDisplayName,
  hardWordIds,
  knownWordIds,
  masteryByWordId,
  selectedLevel,
  onLevelChange,
  onStartQuiz,
  onStartLearnHardWords,
  onStartExam,
  onStartDuel,
  onToggleKnown,
  onReset,
}: DashboardProps) {
  const { t } = useTranslation();
  const { wordCountByLevel, usingExternalLexicon, nounsByLevel } = useVocabulary();
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const nounsInLevel = nounsByLevel[selectedLevel];
  const levelTotal = nounsInLevel.length;
  const masteredCount = useMemo(
    () => countMasteredInLevel(nounsInLevel, knownWordIds, masteryByWordId),
    [nounsInLevel, knownWordIds, masteryByWordId],
  );

  const learningPoolCount = useMemo(
    () => filterLearningQuizPool(nounsInLevel, knownWordIds).length,
    [nounsInLevel, knownWordIds],
  );

  const masterTheseHandler = () => {
    const ids = nounsInLevel.filter((n) => hardWordIds.includes(n.id)).map((n) => n.id);
    onStartLearnHardWords(ids);
  };

  const userName = displayName.trim() || 'Oyunçu';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--artikl-bg)] px-4 pb-28 pt-[max(12px,env(safe-area-inset-top))] text-[var(--artikl-text)] sm:px-6 sm:pb-32">
      <div className="mx-auto w-full max-w-[420px]">

        {/* ── Top bar: name · streak · help ── */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <p className="truncate text-sm font-bold text-white">{userName}</p>
            <span
              className="flex items-center gap-1 rounded-full border border-orange-400/40 bg-orange-500/10 px-2 py-0.5 text-xs font-bold tabular-nums text-orange-200"
              title="Odlu seriya"
            >
              🔥 {odluSeriya.streak}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {usingExternalLexicon ? (
              <span className="text-[9px] font-medium text-emerald-400/80">
                {t('dashboard.external_lexicon_loaded')}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/35 bg-white/[0.06] text-sm font-bold text-cyan-200/90 backdrop-blur-[10px] transition-colors hover:border-cyan-300/50 hover:bg-white/[0.1] active:scale-[0.97]"
              aria-label={t('dashboard.help_title')}
            >
              {t('dashboard.help_mark')}
            </button>
          </div>
        </motion.div>

        {/* ── Level selector ── */}
        <div className="mt-4 flex flex-wrap gap-2">
          {GOETHE_LEVELS.map((lvl) => {
            const on = lvl === selectedLevel;
            const n = wordCountByLevel[lvl];
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onLevelChange(lvl)}
                className={[
                  'rounded-full px-[14px] py-2 text-[13px] font-semibold tabular-nums transition-all',
                  on
                    ? 'border border-transparent bg-[var(--artikl-accent)] text-white shadow-[0_0_20px_rgba(124,108,248,0.3)]'
                    : 'border-[0.5px] border-white/10 bg-white/[0.04] text-[var(--text-muted)] backdrop-blur-[10px] hover:border-white/[0.15] hover:bg-white/[0.07]',
                ].join(' ')}
              >
                {lvl}
                <span className="ml-0.5 text-[10px] font-semibold opacity-60">({n})</span>
              </button>
            );
          })}
        </div>

        {/* ── Daily progress ring ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 flex justify-center"
        >
          <DailyRing current={odluSeriya.correctToday} goal={odluSeriya.goal} />
        </motion.div>

        <p className="mt-1 text-center text-[11px] tabular-nums text-white/40">
          {masteredCount} / {levelTotal} isim öyrənilib · {selectedLevel}
        </p>

        {/* ── Primary action button ── */}
        <motion.button
          type="button"
          onClick={onStartQuiz}
          whileHover={{ scale: 1.012 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="mt-5 w-full rounded-[14px] border border-transparent bg-[var(--artikl-accent)] px-4 py-4 text-[15px] font-bold text-white shadow-[0_8px_32px_rgba(124,108,248,0.28)] transition-[box-shadow] hover:shadow-[0_10px_40px_rgba(124,108,248,0.38)]"
        >
          {t('dashboard.primary_learn', { level: selectedLevel })}
        </motion.button>

        {/* ── Secondary actions ── */}
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onStartExam}
            className="rounded-[12px] border-[0.5px] border-white/[0.1] bg-white/[0.04] py-3.5 text-sm font-bold text-[var(--artikl-text)] backdrop-blur-[12px] transition-[transform,background,border-color] hover:border-white/[0.15] hover:bg-white/[0.07] active:scale-[0.97]"
          >
            {t('dashboard.secondary_exam')}
          </button>
          <button
            type="button"
            onClick={onStartDuel}
            className="rounded-[12px] border-[0.5px] border-[rgba(167,139,250,0.35)] bg-[rgba(124,108,248,0.12)] py-3.5 text-sm font-bold text-[#c4b5fd] backdrop-blur-[12px] transition-[transform,background,border-color] hover:border-[rgba(167,139,250,0.5)] hover:bg-[rgba(124,108,248,0.18)] active:scale-[0.97]"
          >
            {t('dashboard.secondary_duel')}
          </button>
        </div>

        {/* ── Çətin sözlər + Liderlər ── */}
        <DashboardWordLists
          nounsInLevel={nounsInLevel}
          hardWordIds={hardWordIds}
          onToggleKnown={onToggleKnown}
          onMasterTheseWords={masterTheseHandler}
        />

        <button
          type="button"
          onClick={() => setLeaderboardOpen(true)}
          className="mt-4 flex w-full items-center justify-between gap-2 rounded-2xl border-[0.5px] border-[rgba(167,139,250,0.32)] bg-[rgba(124,108,248,0.1)] px-4 py-3 text-left backdrop-blur-[12px] transition-[transform,border-color] hover:border-[rgba(167,139,250,0.45)] active:scale-[0.97]"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-violet-200/95">
            {t('dashboard.leaders')}
          </span>
          <span className="text-lg leading-none" aria-hidden>🏆</span>
        </button>

        <LeaderboardModal
          open={leaderboardOpen}
          onClose={() => setLeaderboardOpen(false)}
          totalXpAllLevels={totalXpAllLevels}
          displayName={displayName}
          onSaveDisplayName={onSaveDisplayName}
        />

        {/* ── Collapsible: stats + settings ── */}
        <details className={`${detailsShell} mt-4`}>
          <summary className={summaryBtn}>
            <span>{t('dashboard.more_insights')}</span>
            <span className="text-[10px] text-[rgba(232,232,245,0.35)]">{t('dashboard.details_chevron')}</span>
          </summary>
          <div className="space-y-3 border-t border-white/[0.06] px-2 pb-4 pt-3">
            <OdluSeriyaCard odlu={odluSeriya} />
            <ArticleRpgCard byArticle={stats.byArticle} />
          </div>
        </details>

        <details className={`${detailsShell} mt-3`}>
          <summary className={summaryBtn}>
            <span>{t('settings.title')}</span>
            <span className="text-[10px] text-[rgba(232,232,245,0.35)]">{t('dashboard.details_chevron')}</span>
          </summary>
          <div className="space-y-3 border-t border-white/[0.06] px-3 pb-4 pt-3">
            <p className="text-[10px] leading-relaxed text-[rgba(232,232,245,0.38)]">
              {t('settings.reset_hint')}
            </p>
            <button
              type="button"
              onClick={onReset}
              className="w-full rounded-xl border border-white/14 bg-transparent py-2.5 text-[11px] font-medium text-[rgba(232,232,245,0.55)] transition-colors hover:border-rose-400/40 hover:bg-rose-950/20 hover:text-rose-200/80 active:scale-[0.99]"
            >
              {t('settings.reset_button')}
            </button>
          </div>
        </details>

      </div>

      {/* ── Help modal ── */}
      {helpOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-12 backdrop-blur-sm sm:items-center sm:pb-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-help-title"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-2xl border border-white/[0.12] bg-[#14141f]/95 p-4 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="dashboard-help-title" className="text-sm font-bold text-white">
                {t('dashboard.help_title')}
              </h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-xl px-2 py-1 text-xs font-semibold text-[rgba(232,232,245,0.55)] hover:bg-white/[0.06] hover:text-white"
              >
                {t('dashboard.help_close')}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-[rgba(232,232,245,0.72)]">
              {t('dashboard.help_body', {
                mastery: LEARNED_FOR_TRAINING_MASTERY,
                queue: learningPoolCount,
              })}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
