import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVocabulary } from '../context/VocabularyContext';
import { countMasteredInLevel } from '../lib/dashboardBuckets';
import { formatLocalDate } from '../lib/dateKeys';
import { isFirebaseLive } from '../lib/firebase';
import { useLeaderboardLiveQuery } from '../lib/leaderboardLiveQuery';
import type { GoetheLevel } from '../types';
import { GermanyMap } from './GermanyMap';
import { LevelMasteryProgressBar } from './LevelMasteryProgressBar';
import {
  isArtikelVipFromLocalStorage,
  LESSON_DAILY_COIN_CAP,
  useGameStore,
} from '../store/useGameStore';
import { readRetentionStreakState } from '../lib/retentionStreak';

const RETENTION_ENTRY_PULSE_SS = 'artikl-retention-entry-pulse-ymd';

function StreakFreezeSnowflake() {
  const { t } = useTranslation();
  const show = useGameStore((s) => {
    if (!s.isStreakFrozen || !s.streakFreezeProtectedYmd) return false;
    const today = formatLocalDate(new Date());
    return s.streakFreezeProtectedYmd >= today;
  });
  if (!show) return null;
  return (
    <span
      className="text-[11px] leading-none"
      title={t('settings.streak_freeze_title')}
      aria-hidden
    >
      ❄️
    </span>
  );
}

/** Tətbiqə giriş seriyası (localStorage) — XP / səviyyə ilə eyni xəttdə. */
function RetentionAppStreakChip({ entryPulse }: { entryPulse: boolean }) {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playEntryPulse, setPlayEntryPulse] = useState(false);
  const [state, setState] = useState(() => readRetentionStreakState());
  const [tipOpen, setTipOpen] = useState(false);

  /** Eyni gündə tab dəyişəndə təkrar oynamasın; ilk «bump» açılışında bir dəfə. */
  useEffect(() => {
    if (!entryPulse) return;
    const today = formatLocalDate(new Date());
    try {
      if (sessionStorage.getItem(RETENTION_ENTRY_PULSE_SS) === today) return;
      sessionStorage.setItem(RETENTION_ENTRY_PULSE_SS, today);
    } catch {
      /* ignore */
    }
    setPlayEntryPulse(true);
    const tid = window.setTimeout(() => setPlayEntryPulse(false), 900);
    return () => window.clearTimeout(tid);
  }, [entryPulse]);

  useEffect(() => {
    const refresh = () => setState(readRetentionStreakState());
    refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!tipOpen) return;
    const id = window.setTimeout(() => setTipOpen(false), 4500);
    return () => window.clearTimeout(id);
  }, [tipOpen]);

  useEffect(() => {
    if (!tipOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setTipOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [tipOpen]);

  const n = state.streak;
  const active = n > 0;

  return (
    <div ref={wrapRef} className="relative flex flex-col items-center">
      <motion.button
        type="button"
        aria-expanded={tipOpen}
        aria-label={t('home_view.retention_streak_a11y', { count: n })}
        onClick={() => setTipOpen((v) => !v)}
        initial={false}
        animate={
          playEntryPulse
            ? {
                scale: [1, 1.24, 1, 1.12, 1],
              }
            : { scale: 1 }
        }
        transition={{ duration: 0.78, times: [0, 0.22, 0.48, 0.72, 1], ease: [0.22, 1, 0.36, 1] }}
        className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0 rounded-xl px-1.5 py-1 transition-colors active:bg-white/[0.06]"
      >
        <span
          className={`select-none text-[1.35rem] leading-none transition-[filter,opacity] ${
            active
              ? 'opacity-100 saturate-150 [filter:drop-shadow(0_0_10px_rgba(251,146,60,0.85))]'
              : 'opacity-[0.42] grayscale'
          }`}
          aria-hidden
        >
          🔥
        </span>
        <span
          className={`text-[13px] font-black tabular-nums leading-none ${
            active ? 'text-orange-500 dark:text-orange-400' : 'text-artikl-muted2'
          }`}
        >
          {n}
        </span>
      </motion.button>

      {tipOpen ? (
        <div
          role="tooltip"
          className="absolute left-1/2 top-[calc(100%+6px)] z-30 w-[min(240px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] px-3 py-2.5 text-center text-[12px] font-semibold leading-snug text-artikl-heading shadow-[0_12px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        >
          {t('home_view.retention_streak_tip', { count: n })}
        </div>
      ) : null}
    </div>
  );
}

export type HomeViewProps = {
  selectedLevel: GoetheLevel;
  totalXpAllLevels: number;
  knownWordIds: string[];
  masteryByWordId: Record<string, number>;
  streakDays: number;
  /** Bu sessiyada `checkStreak` seriyanı artırdısa — alov üçün giriş animasiyası. */
  retentionStreakEntryBump: boolean;
  dashboardUserId: string;
  onContinueLearn: () => void;
  onOpenVipPayment: () => void;
  onOpenDuel: () => void;
  onOpenExam: () => void;
  onOpenCoinShop: () => void;
  onOpenLeaders: () => void;
  /** Xəritədə səviyyə nöqtəsi — öyrənmə tabına keçid */
  onMapLevelSelect: (level: GoetheLevel) => void;
};

export function HomeView({
  selectedLevel,
  totalXpAllLevels,
  knownWordIds,
  masteryByWordId,
  streakDays,
  retentionStreakEntryBump,
  dashboardUserId,
  onContinueLearn,
  onOpenVipPayment,
  onOpenDuel,
  onOpenExam,
  onOpenCoinShop,
  onOpenLeaders,
  onMapLevelSelect,
}: HomeViewProps) {
  const { t } = useTranslation();
  const { nounsByLevel } = useVocabulary();
  const { data: leaderboardLive } = useLeaderboardLiveQuery();

  const lessonCoinsYmdStore = useGameStore((s) => s.lessonCoinsYmd);
  const lessonCoinsEarnedStore = useGameStore((s) => s.lessonCoinsEarnedToday);
  const coins = useGameStore((s) => s.coins);

  const lessonEarnedToday = useMemo(() => {
    const today = formatLocalDate(new Date());
    return lessonCoinsYmdStore === today ? lessonCoinsEarnedStore : 0;
  }, [lessonCoinsYmdStore, lessonCoinsEarnedStore]);

  const isVipUser = isArtikelVipFromLocalStorage();
  const lessonCapFull = !isVipUser && lessonEarnedToday >= LESSON_DAILY_COIN_CAP;

  const nounsInLevel = nounsByLevel[selectedLevel];
  const levelTotal = nounsInLevel.length;
  const masteredCount = useMemo(
    () => countMasteredInLevel(nounsInLevel, knownWordIds, masteryByWordId),
    [nounsInLevel, knownWordIds, masteryByWordId],
  );

  const rankLabel = useMemo(() => {
    const entries = leaderboardLive?.entries ?? [];
    const seeded = leaderboardLive?.seeded ?? false;
    if (!dashboardUserId.trim()) return t('home_view.rank_unknown');
    const idx = entries.findIndex((e) => e.uid === dashboardUserId);
    if (idx >= 0) return `#${idx + 1}`;
    if (isFirebaseLive && seeded && entries.length > 0) return t('home_view.rank_out_top');
    return t('home_view.rank_unknown');
  }, [dashboardUserId, leaderboardLive?.entries, leaderboardLive?.seeded, t]);

  const artikDisplay = isVipUser ? '∞' : coins.toLocaleString('az-AZ');

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--artikl-bg)] px-4 pb-[var(--app-bottom-pad,7rem)] pt-[max(12px,env(safe-area-inset-top))] text-[var(--artikl-text)] sm:px-6 sm:pb-[var(--app-bottom-pad-sm,8rem)]">
      <div className="mx-auto w-full max-w-[420px]">
        <motion.header
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)]/80 px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-md dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-artikl-muted2">
                {t('home_view.level_progress_caption')}
              </p>
              <p className="mt-0.5 text-2xl font-black tabular-nums tracking-tight text-artikl-heading">
                {selectedLevel}
              </p>
            </div>
            <div className="shrink-0 self-center">
              <RetentionAppStreakChip entryPulse={retentionStreakEntryBump} />
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-artikl-muted2">
                {t('home_view.total_xp_label')}
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-violet-300 dark:text-violet-200/95">
                {totalXpAllLevels.toLocaleString('az-AZ')}
              </p>
            </div>
          </div>

          <p className="mt-3 text-center text-xs font-semibold tabular-nums text-artikl-muted2">
            {masteredCount} / {levelTotal}
          </p>
          <LevelMasteryProgressBar mastered={masteredCount} total={levelTotal} className="mt-2" />

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--artikl-border)] pt-4">
            <div className="flex flex-col items-center rounded-xl bg-white/[0.03] px-1 py-2.5 text-center ring-1 ring-white/[0.06]">
              <span className="inline-flex items-center gap-0.5 text-lg leading-none" aria-hidden>
                <span>🔥</span>
                <StreakFreezeSnowflake />
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-artikl-muted2">
                {t('home_view.stat_days')}
              </span>
              <span className="mt-0.5 text-sm font-bold tabular-nums text-artikl-heading">
                {streakDays}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onOpenLeaders()}
              className="flex flex-col items-center rounded-xl bg-white/[0.03] px-1 py-2.5 text-center ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.06] active:scale-[0.98]"
            >
              <span className="text-lg leading-none" aria-hidden>
                🏆
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-artikl-muted2">
                {t('home_view.stat_rank')}
              </span>
              <span className="mt-0.5 text-sm font-bold tabular-nums text-artikl-heading">{rankLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenCoinShop()}
              className="flex flex-col items-center rounded-xl bg-white/[0.03] px-1 py-2.5 text-center ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.06] active:scale-[0.98]"
            >
              <span className="text-lg leading-none" aria-hidden>
                🪙
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-artikl-muted2">
                {t('home_view.stat_artik')}
              </span>
              <span className="mt-0.5 text-sm font-bold tabular-nums text-amber-200/90">{artikDisplay}</span>
            </button>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="mt-5 w-full"
        >
          <GermanyMap
            showLevelHotspots
            selectedLevel={selectedLevel}
            onPickLevel={onMapLevelSelect}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-4"
        >
          {lessonCapFull ? (
            <button
              type="button"
              onClick={() => onOpenVipPayment()}
              className="w-full rounded-2xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 py-4 text-[15px] font-bold leading-snug text-stone-900 shadow-[0_8px_28px_rgba(245,158,11,0.3)] transition hover:brightness-105 active:scale-[0.99]"
            >
              {t('home_view.vip_unlimited_learn')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onContinueLearn()}
              className="w-full rounded-2xl border-2 border-purple-600 bg-purple-600 py-4 text-[16px] font-semibold text-white shadow-[0_8px_28px_rgba(124,108,248,0.25)] transition-transform active:scale-[0.98] dark:border-transparent dark:bg-[var(--artikl-accent)]"
            >
              {t('home_view.continue_learn')}
            </button>
          )}
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8"
        >
          <p className="mb-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-artikl-muted2">
            {t('home_view.quick_section_title')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onOpenDuel()}
              className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] px-3 py-4 text-center shadow-sm transition active:scale-[0.98] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
            >
              <span className="text-2xl" aria-hidden>
                ⚔️
              </span>
              <span className="text-[15px] font-bold text-artikl-heading">{t('home_view.quick_duel')}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenExam()}
              className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] px-3 py-4 text-center shadow-sm transition active:scale-[0.98] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
            >
              <span className="text-2xl" aria-hidden>
                📝
              </span>
              <span className="text-[15px] font-bold text-artikl-heading">{t('home_view.quick_exam')}</span>
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
