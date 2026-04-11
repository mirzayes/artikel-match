import { motion } from 'framer-motion';
import { onValue, ref as dbRef } from 'firebase/database';
import { useQueryClient } from '@tanstack/react-query';
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVocabulary } from '../context/VocabularyContext';
import { filterLearningQuizPool } from '../lib/wordLists';
import { countMasteredInLevel } from '../lib/dashboardBuckets';
import {
  GOETHE_LEVELS,
  LEARNED_FOR_TRAINING_MASTERY,
  ODLU_DAILY_GOAL_OPTIONS,
  type GoetheLevel,
  type LevelProgressStats,
  type OdluDailyGoalOption,
} from '../types';
import { ArticleRpgCard } from './ArticleRpgCard';
import { OdluSeriyaCard } from './OdluSeriyaCard';
import { DashboardWordLists } from './DashboardWordLists';
import { ACHIEVEMENT_DUEL_MASTER, ACHIEVEMENT_MARATHON } from '../lib/achievements';
import { isGoldenHourLocal } from '../lib/coinBonus';
import { formatLocalDate } from '../lib/dateKeys';
import type { OdluSeriyaState } from '../lib/odluStreak';
import { CoinBalanceMeter } from './CoinBalanceMeter';
import { LevelMasteryProgressBar } from './LevelMasteryProgressBar';
import { LeaderboardModal } from './LeaderboardModal';
import { VipSubscriptionModal } from './VipSubscriptionModal';
import { LevelUnlockModal } from './LevelUnlockModal';
import { isArtikelVipFromLocalStorage, LESSON_DAILY_COIN_CAP, useGameStore } from '../store/useGameStore';
import {
  isGoetheLevelGated,
  isLevelGateUnlocked,
  type LevelGateCheckArgs,
} from '../lib/levelGate';
import { acceptFriendRequest, declineFriendRequest } from '../lib/friendsRtdb';
import { isFirebaseLive, rtdb } from '../lib/firebase';
import { avatarIdToEmoji } from '../lib/playerProfileRtdb';
import type { LeaderboardEntry } from '../lib/leaderboardRtdb';
import { useLeaderboardLiveQuery } from '../lib/leaderboardLiveQuery';
import { DUEL_MIN_ARTIK_BALANCE } from '../lib/duelEntry';
import { subscribeMatchmakingWaitingCount } from '../lib/matchmakingQueueRtdb';
import { prefetchLexiconCatalog } from '../lib/lexiconPrefetch';

/** B1–C1 kilidli: kiçik boz SVG qıfıl. */
function GrayLockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6V11z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      <div
        className={[
          'relative h-[132px] w-[132px] transition-all duration-500',
          done
            ? 'drop-shadow-[0_0_18px_rgba(251,146,60,0.45)]'
            : 'drop-shadow-[0_0_10px_rgba(124,108,248,0.2)]',
        ].join(' ')}
      >
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
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9CA3AF] dark:text-artikl-text/35">
            Bu gün
          </p>
          <p className="mt-0.5 font-display text-[1.55rem] font-bold leading-none tabular-nums text-artikl-text">
            {current}
            <span className="text-[1rem] font-semibold text-[#4B5563] dark:text-artikl-text/45"> / {goal}</span>
          </p>
          {done ? (
            <motion.span
              className="mt-1 text-base leading-none"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              aria-hidden
            >
              🔥
            </motion.span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─── types ────────────────────────────────────────────────────────────── */
const detailsShell =
  'rounded-2xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] backdrop-blur-[14px] overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-[0_8px_32px_rgba(0,0,0,0.2)]';

const summaryBtn =
  'flex w-full cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-left text-sm font-semibold text-artikl-text transition-colors hover:bg-[var(--artikl-surface)]';

function shortIncomingId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 14)}…` : id;
}

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
  odluDailyGoal: OdluDailyGoalOption;
  onOdluDailyGoalChange: (goal: OdluDailyGoalOption) => void;
  /** RTDB lider cədvəlində öz sətirini vurğulamaq üçün */
  dashboardUserId?: string;
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
  odluDailyGoal,
  onOdluDailyGoalChange,
  dashboardUserId,
}: DashboardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { wordCountByLevel, usingExternalLexicon, nounsByLevel } = useVocabulary();
  const coins = useGameStore((s) => s.coins);
  const achievementIds = useGameStore((s) => s.achievementIds);
  const iapLevelUnlocks = useGameStore((s) => s.iapLevelUnlocks);
  const levelGateCoinUnlocks = useGameStore((s) => s.levelGateCoinUnlocks);
  const claimRewardAdBonus = useGameStore((s) => s.claimRewardAdBonus);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [levelLockTarget, setLevelLockTarget] = useState<GoetheLevel | null>(null);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [adToast, setAdToast] = useState<string | null>(null);
  const { data: leaderboardLiveState } = useLeaderboardLiveQuery();
  const leaderTop3: LeaderboardEntry[] = useMemo(
    () => (leaderboardLiveState?.entries ?? []).slice(0, 3),
    [leaderboardLiveState?.entries],
  );
  const [matchmakingWaiting, setMatchmakingWaiting] = useState(0);
  const [simRivalPulse, setSimRivalPulse] = useState(false);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<
    { fromId: string; fromName: string; fromAvatar: string; timestamp: number }[]
  >([]);
  const [friendRequestBusyId, setFriendRequestBusyId] = useState<string | null>(null);

  useEffect(() => {
    prefetchLexiconCatalog(queryClient, nounsByLevel);
  }, [queryClient, nounsByLevel]);

  useEffect(() => {
    const uid = dashboardUserId?.trim();
    if (!uid || !isFirebaseLive || !rtdb) {
      setIncomingFriendRequests([]);
      return;
    }
    const r = dbRef(rtdb, `users/${uid}/incomingFriendRequests`);
    const unsub = onValue(r, (snap) => {
      const raw = snap.val() as
        | Record<
            string,
            { fromName?: string; fromAvatar?: string; timestamp?: number; from?: string }
          >
        | null;
      if (!raw) {
        setIncomingFriendRequests([]);
        return;
      }
      const list = Object.entries(raw)
        .filter(([k, v]) => Boolean(k) && v != null && typeof v === 'object')
        .map(([fromId, row]) => {
          const fromName =
            typeof row.fromName === 'string' && row.fromName.trim()
              ? row.fromName.trim()
              : typeof row.from === 'string'
                ? shortIncomingId(row.from)
                : shortIncomingId(fromId);
          const fromAvatar =
            typeof row.fromAvatar === 'string' && row.fromAvatar.trim()
              ? row.fromAvatar.trim()
              : 'pretzel';
          const timestamp = typeof row.timestamp === 'number' ? row.timestamp : 0;
          return { fromId, fromName, fromAvatar, timestamp };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
      setIncomingFriendRequests(list);
    });
    return unsub;
  }, [dashboardUserId]);

  useEffect(() => subscribeMatchmakingWaitingCount(setMatchmakingWaiting), []);

  useEffect(() => {
    if (isFirebaseLive) return;
    const flip = () => setSimRivalPulse(Math.random() < 0.38);
    flip();
    const id = window.setInterval(flip, 11000);
    return () => clearInterval(id);
  }, []);

  const duelCtaPulse = matchmakingWaiting > 0 || (!isFirebaseLive && simRivalPulse);

  const levelGateArgs: LevelGateCheckArgs = useMemo(
    () => ({
      totalXpAllLevels,
      knownWordIds,
      masteryByWordId,
      nounsByLevel,
      iapLevelUnlocks,
      levelGateCoinUnlocks,
    }),
    [
      totalXpAllLevels,
      knownWordIds,
      masteryByWordId,
      nounsByLevel,
      iapLevelUnlocks,
      levelGateCoinUnlocks,
    ],
  );

  const lessonCoinsYmdStore = useGameStore((s) => s.lessonCoinsYmd);
  const lessonCoinsEarnedStore = useGameStore((s) => s.lessonCoinsEarnedToday);
  const lessonEarnedToday = useMemo(() => {
    const today = formatLocalDate(new Date());
    return lessonCoinsYmdStore === today ? lessonCoinsEarnedStore : 0;
  }, [lessonCoinsYmdStore, lessonCoinsEarnedStore]);
  const lessonCapFull = lessonEarnedToday >= LESSON_DAILY_COIN_CAP;

  const handleLevelPick = useCallback(
    (lvl: GoetheLevel) => {
      if (!isArtikelVipFromLocalStorage() && lvl !== 'A1') {
        startTransition(() => setVipModalOpen(true));
        return;
      }
      if (!isLevelGateUnlocked(lvl, levelGateArgs)) {
        setLevelLockTarget(lvl);
        return;
      }
      onLevelChange(lvl);
    },
    [levelGateArgs, onLevelChange],
  );

  const handlePrimaryLearn = useCallback(() => {
    if (lessonCapFull) return;
    onStartQuiz();
  }, [lessonCapFull, onStartQuiz]);

  const handleWatchAd = useCallback(() => {
    const n = claimRewardAdBonus();
    if (n == null) setAdToast(t('dashboard.lesson_limit_ad_used'));
    else setAdToast(t('common.plus_amount_artik', { amount: n }));
  }, [claimRewardAdBonus, t]);

  useEffect(() => {
    if (!adToast) return;
    const id = window.setTimeout(() => setAdToast(null), 2600);
    return () => clearTimeout(id);
  }, [adToast]);

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
  const duelEntryLocked =
    !isArtikelVipFromLocalStorage() && coins < DUEL_MIN_ARTIK_BALANCE;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--artikl-bg)] px-4 pb-[var(--app-bottom-pad,7rem)] pt-[max(12px,env(safe-area-inset-top))] text-[var(--artikl-text)] sm:px-6 sm:pb-[var(--app-bottom-pad-sm,8rem)]">
      <div className="mx-auto w-full max-w-[420px]">

        {/* ── Top bar: name · streak · help ── */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <p className="truncate text-sm font-bold text-artikl-heading">{userName}</p>
            <span
              className={[
                'flex max-w-full flex-wrap items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums',
                odluSeriya.metToday
                  ? 'border-orange-400/40 bg-orange-500/10 text-[#1A1A2E] dark:text-orange-200'
                  : 'border-[var(--artikl-border2)] bg-[var(--artikl-surface)] text-artikl-caption',
              ].join(' ')}
              title="Odlu seriya"
            >
              <span style={{ filter: odluSeriya.metToday ? 'none' : 'grayscale(1) opacity(0.4)' }}>🔥</span>
              {odluSeriya.streak}
              {odluSeriya.streak > 3 ? (
                <span className="ml-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-300/95">
                  {t('rewards.odlu_streak_artik_bonus')}
                </span>
              ) : null}
            </span>
            {incomingFriendRequests.length > 0 && dashboardUserId ? (
              <span
                className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold tabular-nums text-white shadow-[0_0_12px_rgba(244,63,94,0.35)]"
                aria-label={t('friends.pending_requests_aria')}
                role="status"
              >
                {incomingFriendRequests.length > 9 ? '9+' : incomingFriendRequests.length}
              </span>
            ) : null}
            <CoinBalanceMeter compact showCoinShop />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {usingExternalLexicon ? (
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                title="Leksikon yükləndi"
              />
            ) : null}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/35 bg-[var(--artikl-surface2)] text-sm font-bold text-cyan-200/90 backdrop-blur-[10px] transition-colors hover:border-cyan-300/50 hover:bg-[var(--artikl-surface)] active:scale-[0.97]"
              aria-label={t('dashboard.help_title')}
            >
              {t('dashboard.help_mark')}
            </button>
          </div>
        </motion.div>

        {isGoldenHourLocal() ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/18 via-orange-500/12 to-rose-500/10 px-3 py-2.5 text-center shadow-[0_0_28px_rgba(245,158,11,0.12)]"
            role="status"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1A1A2E] dark:text-amber-200/90">
              {t('rewards.golden_hour_chip')}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-[#4B5563] dark:text-[rgba(255,248,220,0.88)]">
              {t('rewards.golden_hour_banner')}
            </p>
          </motion.div>
        ) : null}

        {(achievementIds.includes(ACHIEVEMENT_MARATHON) || achievementIds.includes(ACHIEVEMENT_DUEL_MASTER)) ? (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {achievementIds.includes(ACHIEVEMENT_MARATHON) ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200/90">
                {t('rewards.badge_marathon')}
              </span>
            ) : null}
            {achievementIds.includes(ACHIEVEMENT_DUEL_MASTER) ? (
              <span className="rounded-full border border-purple-400/35 bg-purple-500/12 px-2.5 py-1 text-[10px] font-semibold text-purple-200/90">
                {t('rewards.badge_duel_master')}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* ── Level selector + VIP ── */}
        <div className="mt-4 flex flex-wrap items-stretch gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {GOETHE_LEVELS.map((lvl) => {
              const on = lvl === selectedLevel;
              const n = wordCountByLevel[lvl];
              const monetizationLocked = !isArtikelVipFromLocalStorage() && lvl !== 'A1';
              const progressLocked =
                isGoetheLevelGated(lvl) && !isLevelGateUnlocked(lvl, levelGateArgs);
              const locked = monetizationLocked || progressLocked;
              const upperTierLockedVisual =
                locked && (lvl === 'B1' || lvl === 'B2' || lvl === 'C1') && !monetizationLocked;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleLevelPick(lvl)}
                  className={[
                    'lex-no-tap-highlight min-h-[44px] rounded-full px-[14px] py-2.5 text-[13px] font-semibold tabular-nums transition-all active:scale-[0.98]',
                    on
                      ? 'border-2 border-purple-600 bg-purple-600 text-white shadow-[0_0_20px_rgba(124,108,248,0.3)] dark:border-transparent dark:bg-[var(--artikl-accent)]'
                      : 'border-2 border-purple-600 bg-white text-purple-600 backdrop-blur-[10px] dark:border-[0.5px] dark:border-[var(--artikl-border)] dark:bg-[var(--artikl-surface)] dark:text-[var(--text-muted)] hover:dark:border-[var(--artikl-border2)] hover:dark:bg-[var(--artikl-surface2)]',
                    locked ? 'opacity-55' : '',
                  ].join(' ')}
                >
                  {locked ? (
                    upperTierLockedVisual ? (
                      <span className="mr-1 inline-flex shrink-0 text-zinc-500" aria-hidden title="Kilidli">
                        <GrayLockIcon className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="mr-0.5 text-[11px] opacity-70 grayscale" aria-hidden>
                        🔒
                      </span>
                    )
                  ) : null}
                  {lvl}
                  <span className="ml-0.5 text-[10px] font-semibold text-[#9CA3AF] dark:opacity-60">
                    ({n})
                  </span>
                </button>
              );
            })}
          </div>
          {isArtikelVipFromLocalStorage() ? (
            <div
              className="flex min-h-[44px] shrink-0 flex-col items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/15 px-3 text-[10px] font-extrabold uppercase leading-tight tracking-wide text-amber-200"
              title="Gold VIP"
            >
              <span aria-hidden>👑</span>
              <span>VIP</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => startTransition(() => setVipModalOpen(true))}
              className="flex min-h-[44px] shrink-0 flex-col items-center justify-center rounded-full border-2 border-amber-400/60 bg-gradient-to-b from-amber-500/25 to-amber-700/20 px-3 text-[10px] font-extrabold uppercase leading-tight tracking-wide text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.25)] active:scale-95"
              title="Gold VIP"
            >
              <span aria-hidden>👑</span>
              <span>VIP</span>
            </button>
          )}
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

        <p className="mt-1 text-center text-[11px] tabular-nums text-[#4B5563] dark:text-artikl-text/40">
          {odluSeriya.metToday ? (
            <span className="text-[#7C3AED] dark:text-orange-300/90">{t('odlu.daily_done')}</span>
          ) : (
            <span>Gündəlik hədəf: {odluSeriya.correctToday}/{odluSeriya.goal}</span>
          )}
          {' · '}
          {masteredCount} / {levelTotal} isim öyrənilib · {selectedLevel}
        </p>

        <LevelMasteryProgressBar mastered={masteredCount} total={levelTotal} className="mt-2.5" />

        {dashboardUserId && isFirebaseLive && incomingFriendRequests.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] px-3 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.18)]">
            <p className="text-sm font-bold text-artikl-text">{t('friends.requests_section')}</p>
            <ul className="mt-3 space-y-3">
              {incomingFriendRequests.map((req) => (
                <li
                  key={req.fromId}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--artikl-border)] bg-[var(--artikl-surface2)] px-2.5 py-2"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--artikl-border)] bg-[var(--artikl-surface2)] text-xl"
                    aria-hidden
                  >
                    {avatarIdToEmoji(req.fromAvatar)}
                  </span>
                  <div className="min-w-0 flex-1 basis-[120px]">
                    <p className="truncate text-sm font-semibold text-artikl-text">{req.fromName}</p>
                    <p className="truncate font-mono text-[9px] text-[#9CA3AF] dark:text-artikl-text/35" title={req.fromId}>
                      {req.fromId}
                    </p>
                  </div>
                  <div className="flex w-full gap-2 sm:ml-auto sm:w-auto sm:flex-initial">
                    <button
                      type="button"
                      disabled={friendRequestBusyId === req.fromId}
                      onClick={() => {
                        setFriendRequestBusyId(req.fromId);
                        void acceptFriendRequest(dashboardUserId, req.fromId).finally(() =>
                          setFriendRequestBusyId(null),
                        );
                      }}
                      className="flex-1 rounded-xl border-2 border-purple-600 bg-purple-600 px-3 py-2 text-xs font-bold text-white shadow-[0_4px_16px_rgba(124,108,248,0.25)] active:scale-[0.98] disabled:border-purple-200 disabled:bg-purple-200 disabled:text-[#9CA3AF] sm:flex-initial dark:border-transparent dark:bg-[#7c6cf8] dark:disabled:opacity-50"
                    >
                      {t('friends.accept')}
                    </button>
                    <button
                      type="button"
                      disabled={friendRequestBusyId === req.fromId}
                      onClick={() => {
                        setFriendRequestBusyId(req.fromId);
                        void declineFriendRequest(dashboardUserId, req.fromId).finally(() =>
                          setFriendRequestBusyId(null),
                        );
                      }}
                      className="flex-1 rounded-xl border-2 border-purple-600 bg-white px-3 py-2 text-xs font-semibold text-purple-600 active:scale-[0.98] disabled:border-purple-200 disabled:text-[#9CA3AF] sm:flex-initial dark:border-[var(--artikl-border2)] dark:bg-transparent dark:text-artikl-text dark:disabled:opacity-50"
                    >
                      {t('friends.decline')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Günlük öyrənmə sikkə limiti (kviz mükafatı) */}
        <div className="dashboard-lesson-coin-panel mt-4 rounded-2xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] px-3 py-3">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#4B5563] dark:text-artikl-text/70">
            <span>{t('dashboard.lesson_coin_meter_label')}</span>
            <span className="dashboard-lesson-coin-count tabular-nums text-[#7C3AED] dark:text-amber-200/90">
              🪙 {lessonEarnedToday} / {LESSON_DAILY_COIN_CAP}
            </span>
          </div>
          <div
            className="dashboard-lesson-coin-track mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[var(--artikl-prog-track-bg)]"
            role="progressbar"
            aria-valuenow={lessonEarnedToday}
            aria-valuemin={0}
            aria-valuemax={LESSON_DAILY_COIN_CAP}
            aria-label={t('dashboard.lesson_coin_meter_label')}
          >
            <motion.div
              className={[
                'dashboard-lesson-coin-fill h-full rounded-full',
                lessonCapFull
                  ? 'bg-gradient-to-r from-rose-500 to-orange-500'
                  : 'bg-gradient-to-r from-violet-500 via-purple-400 to-cyan-400',
              ].join(' ')}
              initial={{ width: 0 }}
              animate={{
                width: `${LESSON_DAILY_COIN_CAP > 0 ? Math.min(100, (lessonEarnedToday / LESSON_DAILY_COIN_CAP) * 100) : 0}%`,
              }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          {lessonEarnedToday === 0 ? (
            <p className="mt-1.5 text-[10px] text-[#9CA3AF] dark:text-artikl-text/30">{t('dashboard.lesson_start_hint')}</p>
          ) : null}
        </div>

        {/* ── Primary action button ── */}
        <motion.button
          type="button"
          onClick={handlePrimaryLearn}
          disabled={lessonCapFull}
          whileHover={lessonCapFull ? undefined : { scale: 1.012 }}
          whileTap={lessonCapFull ? undefined : { scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className={[
            'lex-no-tap-highlight mt-5 min-h-[52px] w-full rounded-[14px] border border-transparent px-4 py-4 text-base font-bold shadow-[0_8px_32px_rgba(124,108,248,0.28)] transition-[box-shadow,opacity]',
            lessonCapFull
              ? 'cursor-not-allowed border-2 border-purple-200 bg-purple-50 text-[#9CA3AF] dark:cursor-not-allowed dark:border-transparent dark:bg-[var(--artikl-surface2)] dark:text-artikl-text/45'
              : 'border-2 border-purple-600 bg-purple-600 text-white hover:shadow-[0_10px_40px_rgba(124,108,248,0.38)] dark:border-transparent dark:bg-[var(--artikl-accent)]',
          ].join(' ')}
        >
          {lessonCapFull ? t('dashboard.lesson_coin_limit_btn') : t('dashboard.primary_learn', { level: selectedLevel })}
        </motion.button>
        {lessonCapFull ? (
          <div className="dashboard-lesson-cap-banner mt-3 space-y-2 rounded-xl border border-amber-400/20 bg-amber-500/8 px-3 py-3 text-center">
            <p className="dashboard-lesson-cap-banner-text text-[12px] leading-snug text-[#374151] dark:text-[rgba(255,248,220,0.92)]">
              {t('dashboard.lesson_coin_limit_body')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={onStartDuel}
                className={[
                  'rounded-lg border-2 border-purple-600 bg-white px-3 py-2 text-[11px] font-bold text-purple-600 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-100',
                  duelEntryLocked ? 'opacity-50' : '',
                ].join(' ')}
              >
                {t('dashboard.lesson_limit_duel_cta')}
              </button>
              <button
                type="button"
                onClick={handleWatchAd}
                className="rounded-lg border-2 border-purple-600 bg-white px-3 py-2 text-[11px] font-semibold text-purple-600 dark:border-[var(--artikl-border2)] dark:bg-[var(--artikl-surface2)] dark:text-artikl-text/80"
              >
                {t('dashboard.lesson_limit_ad_cta')}
              </button>
            </div>
          </div>
        ) : null}

        {/* ── Secondary actions ── */}
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onStartExam}
            className="rounded-[12px] border-[0.5px] border-[var(--artikl-border)] bg-[var(--artikl-surface)] py-3.5 text-sm font-bold text-[var(--artikl-text)] backdrop-blur-[12px] transition-[transform,background,border-color] hover:border-[var(--artikl-border2)] hover:bg-[var(--artikl-surface2)] active:scale-[0.97]"
          >
            {t('dashboard.secondary_exam')}
          </button>
          <button
            type="button"
            onClick={onStartDuel}
            className={[
              'rounded-[12px] border-2 border-purple-600 bg-white py-3.5 text-sm font-bold text-purple-600 backdrop-blur-[12px] transition-[transform,background,border-color] hover:bg-purple-50 active:scale-[0.97] dark:border-[0.5px] dark:border-[rgba(167,139,250,0.35)] dark:bg-[rgba(124,108,248,0.12)] dark:text-[#c4b5fd] hover:dark:border-[rgba(167,139,250,0.5)] hover:dark:bg-[rgba(124,108,248,0.18)]',
              duelEntryLocked ? 'opacity-50' : '',
            ].join(' ')}
          >
            {t('dashboard.secondary_duel')}
          </button>
        </div>

        {/* ── Təsadüfi rəqib — quick PvP (növbədə gözləyən varsa və ya offline sim — pulse) ── */}
        <button
          type="button"
          onClick={onStartDuel}
          className={[
            'duel-cta-random mt-3 flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-[rgba(168,85,247,0.35)] bg-gradient-to-r from-[rgba(124,108,248,0.18)] via-[rgba(168,85,247,0.12)] to-[rgba(196,79,217,0.10)] py-3.5 text-sm font-bold text-artikl-heading shadow-[0_6px_24px_rgba(168,85,247,0.18)] transition-all hover:shadow-[0_8px_32px_rgba(168,85,247,0.28)] active:scale-[0.98]',
            duelCtaPulse ? 'artikl-duel-cta--pulse' : '',
            duelEntryLocked ? 'opacity-50' : '',
          ].join(' ')}
          title={duelCtaPulse ? t('dashboard.duel_pulse_hint') : undefined}
        >
          <span aria-hidden>⚔️</span>
          {t('duel.random_opponent')}
          <span className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#7C3AED] dark:text-amber-200">
            {t('common.balance_display', { amount: coins })}
          </span>
        </button>

        {/* ── Çətin sözlər (boşdursa gizlidir) ── */}
        <DashboardWordLists
          nounsInLevel={nounsInLevel}
          hardWordIds={hardWordIds}
          onToggleKnown={onToggleKnown}
          onMasterTheseWords={masterTheseHandler}
        />

        <button
          type="button"
          onClick={() => setLeaderboardOpen(true)}
          className="mt-4 w-full rounded-2xl border-[0.5px] border-[rgba(167,139,250,0.32)] bg-[rgba(124,108,248,0.1)] text-left backdrop-blur-[12px] transition-[transform,border-color] hover:border-[rgba(167,139,250,0.45)] active:scale-[0.99]"
        >
          <div className="flex items-center justify-between border-b border-[var(--artikl-border)] px-4 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1A1A2E] dark:text-violet-200/95">
              {t('dashboard.leaders_strip_title')}
            </span>
            <span className="text-lg leading-none" aria-hidden>
              🏆
            </span>
          </div>
          <div className="space-y-0.5 px-3 py-3">
            {[0, 1, 2].map((i) => {
              const e = leaderTop3[i];
              const rank = i + 1;
              const isYou = Boolean(e && dashboardUserId && e.uid === dashboardUserId);
              if (!e) {
                return (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-2 rounded-lg py-1.5 pl-1 text-[12px] text-[#9CA3AF] dark:text-artikl-text/28"
                  >
                    <span className="w-6 text-center text-[11px] font-bold tabular-nums text-[#9CA3AF] dark:text-artikl-text/20">
                      {rank}
                    </span>
                    <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--artikl-surface2)]" />
                    <div className="h-3 flex-1 animate-pulse rounded-full bg-[var(--artikl-surface)]" />
                    <span className="text-[10px] text-[#9CA3AF] dark:text-artikl-text/20">— XP</span>
                  </div>
                );
              }
              return (
                <div
                  key={e.uid}
                  className={[
                    'flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-2',
                    isYou ? 'bg-amber-500/10 ring-1 ring-amber-400/25' : '',
                  ].join(' ')}
                >
                  <span className="w-6 text-center text-[11px] font-bold tabular-nums text-[#4B5563] dark:text-artikl-text/45">
                    {rank}
                  </span>
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--artikl-border)] bg-[var(--artikl-surface2)] text-lg leading-none"
                    aria-hidden
                  >
                    {avatarIdToEmoji(e.avatar)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#1A1A2E] dark:text-artikl-text/90">
                    {e.displayName.trim() || t('duel.player_default')}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#7C3AED] dark:text-violet-200/85">
                    {e.totalXp.toLocaleString()} XP
                  </span>
                </div>
              );
            })}
          </div>
          <p className="border-t border-[var(--artikl-border)] px-4 py-2 text-center text-[10px] font-medium text-[#9CA3AF] dark:text-artikl-text/35">
            {t('dashboard.leaders_strip_tap')}
          </p>
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
            <span className="text-[10px] text-artikl-caption">{t('dashboard.details_chevron')}</span>
          </summary>
          <div className="space-y-3 border-t border-[var(--artikl-border)] px-2 pb-4 pt-3">
            <OdluSeriyaCard odlu={odluSeriya} />
            <ArticleRpgCard byArticle={stats.byArticle} />
          </div>
        </details>

        <details className={`${detailsShell} mt-3`}>
          <summary className={summaryBtn}>
            <span>{t('settings.title')}</span>
            <span className="text-[10px] text-artikl-caption">{t('dashboard.details_chevron')}</span>
          </summary>
          <div className="space-y-4 border-t border-[var(--artikl-border)] px-3 pb-4 pt-3">
            {/* Daily goal selector */}
            <div>
              <p className="text-[11px] font-semibold text-artikl-text">
                {t('settings.daily_goal_label')}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-artikl-caption">
                {t('settings.daily_goal_hint')}
              </p>
              <div className="mt-2 flex gap-2">
                {ODLU_DAILY_GOAL_OPTIONS.map((opt) => {
                  const active = opt === odluDailyGoal;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onOdluDailyGoalChange(opt)}
                      className={[
                        'flex-1 rounded-xl py-2.5 text-[13px] font-bold tabular-nums transition-all',
                        active
                          ? 'border-2 border-purple-600 bg-purple-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.2)] dark:border-orange-400/50 dark:bg-orange-500/15 dark:text-orange-200 dark:shadow-[0_0_16px_rgba(251,146,60,0.15)]'
                          : 'border-2 border-purple-600 bg-white text-purple-600 dark:border-[var(--artikl-border)] dark:bg-[var(--artikl-surface)] dark:text-artikl-muted2 hover:dark:border-[var(--artikl-border2)] hover:dark:bg-[var(--artikl-surface2)]',
                      ].join(' ')}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-[var(--artikl-surface2)]" />

            <p className="text-[10px] leading-relaxed text-artikl-caption">
              {t('settings.reset_hint')}
            </p>
            <button
              type="button"
              onClick={onReset}
              className="w-full rounded-xl border border-[var(--artikl-border2)] bg-transparent py-2.5 text-[11px] font-medium text-artikl-muted2 transition-colors hover:border-rose-400/40 hover:bg-rose-950/20 hover:text-rose-200/80 active:scale-[0.99]"
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
            className="app-sheet-panel w-full max-w-[420px] rounded-2xl border border-[var(--artikl-border2)] bg-[#14141f]/95 p-4 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="dashboard-help-title" className="text-sm font-bold text-artikl-text">
                {t('dashboard.help_title')}
              </h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-xl px-2 py-1 text-xs font-semibold text-artikl-muted2 hover:bg-[var(--artikl-surface2)] hover:text-artikl-text"
              >
                {t('dashboard.help_close')}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-artikl-text">
              {t('dashboard.help_body', {
                mastery: LEARNED_FOR_TRAINING_MASTERY,
                queue: learningPoolCount,
              })}
            </p>
          </div>
        </div>
      ) : null}

      <VipSubscriptionModal open={vipModalOpen} onClose={() => setVipModalOpen(false)} />

      <LevelUnlockModal
        open={levelLockTarget !== null}
        level={levelLockTarget}
        onClose={() => setLevelLockTarget(null)}
        totalXpAllLevels={totalXpAllLevels}
        knownWordIds={knownWordIds}
        masteryByWordId={masteryByWordId}
      />

      {adToast ? (
        <div
          className="fixed bottom-[max(6rem,env(safe-area-inset-bottom)+5rem)] left-1/2 z-[92] w-[min(90vw,320px)] -translate-x-1/2 rounded-xl border border-[var(--artikl-border2)] bg-[var(--artikl-surface)] px-3 py-2 text-center text-[12px] text-artikl-text shadow-lg"
          role="status"
        >
          {adToast}
        </div>
      ) : null}
    </div>
  );
}
