import { motion } from 'framer-motion';
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GOETHE_LEVELS, type GoetheLevel, type NounEntry, type WordSrsEntry } from '../../types';
import { countDueWordsForLevel, filterLearningQuizPool } from '../../lib/wordLists';
import { countMasteredInLevel, isWordMasteredForLevel } from '../../lib/dashboardBuckets';
import { formatLocalDate } from '../../lib/dateKeys';
import { LEARN_BLOCKS_UNLOCK_ALL_COST } from '../../lib/learnBlocks';
import {
  chunkNounsIntoMissions,
  formatMissionRange,
  getMissionOrderedNouns,
  isMissionGateOpen,
  isMissionMastered,
  LEARNING_MISSION_ARTIK_REWARD,
} from '../../lib/learnMissions';
import { vibrateCoinReward } from '../../lib/answerFeedbackMedia';
import {
  isGoetheLevelGated,
  isLevelGateUnlocked,
  type LevelGateCheckArgs,
} from '../../lib/levelGate';
import { VipSubscriptionModal } from '../VipSubscriptionModal';
import { LevelUnlockModal } from '../LevelUnlockModal';
import { LevelMasteryProgressBar } from '../LevelMasteryProgressBar';
import {
  isArtikelVipFromLocalStorage,
  LESSON_DAILY_COIN_CAP,
  useGameStore,
} from '../../store/useGameStore';
import { pickLuckyMissionIndexForDay } from '../../lib/luckyMissionOfDay';
import { getOrCreateDuelUserId } from '../DuelGame';

const MISSION_MAP_PAGE = 5;

/** Açılış: tamamlanmış + 1 aktiv + növbəti 2 kilid; ümumi max 5; genişləndirmə dəyişmir. */
function computeMissionMapVisibleCore(
  missions: NounEntry[][],
  knownWordIds: string[],
  masteryByWordId: Record<string, number>,
  allMissionsPaidUnlocked: boolean,
  luckyMissionIndex: number | null,
): { baseIndices: number[]; restIndices: number[] } {
  const n = missions.length;
  if (n === 0) return { baseIndices: [], restIndices: [] };

  const gateOpenAt = (missionIndex: number) => {
    const baseGate = isMissionGateOpen(
      missionIndex,
      missions,
      knownWordIds,
      masteryByWordId,
      allMissionsPaidUnlocked,
    );
    const lucky = luckyMissionIndex !== null && missionIndex === luckyMissionIndex;
    return baseGate || lucky;
  };

  const doneAt = (missionIndex: number) =>
    isMissionMastered(missions[missionIndex]!, knownWordIds, masteryByWordId);

  let activeIdx: number | null = null;
  for (let i = 0; i < n; i++) {
    if (gateOpenAt(i) && !doneAt(i)) {
      activeIdx = i;
      break;
    }
  }

  const lockedOrdered: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!gateOpenAt(i)) lockedOrdered.push(i);
  }
  const nextTwoLocked = lockedOrdered.slice(0, 2);

  const mustKeep = new Set<number>(nextTwoLocked);
  if (activeIdx !== null) mustKeep.add(activeIdx);

  const completedIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (doneAt(i)) completedIndices.push(i);
  }

  const prioritySet = new Set<number>([...completedIndices, ...mustKeep]);
  let priority = [...prioritySet].sort((a, b) => a - b);

  while (priority.length > MISSION_MAP_PAGE) {
    const removable = priority.filter((i) => doneAt(i) && !mustKeep.has(i));
    if (removable.length === 0) {
      const fall = priority.filter((i) => !mustKeep.has(i));
      if (fall.length === 0) break;
      priority = priority.filter((i) => i !== fall[0]);
    } else {
      priority = priority.filter((i) => i !== removable[0]);
    }
  }

  const baseSet = new Set(priority);
  const restIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!baseSet.has(i)) restIndices.push(i);
  }

  return { baseIndices: priority, restIndices };
}

interface LearningTopicHubProps {
  nounsByLevel: Record<GoetheLevel, NounEntry[]>;
  knownWordIds: string[];
  masteryByWordId: Record<string, number>;
  selectedLevel: GoetheLevel;
  onLevelChange: (level: GoetheLevel) => void;
  /** Missiya söz dəsti + rejim (Klassik / Sonsuz) */
  onStartBlock: (wordIds: string[], opts: { missionMode: 'classic' | 'infinite' }) => void;
  srsByWordId: Record<string, WordSrsEntry>;
  /** Təkrar sırası — yalnız növbəsi çatan köhnə sözlər */
  onStartRepeat: () => void;
  totalXpAllLevels: number;
  onNavigateDuel?: () => void;
}

export function LearningTopicHub({
  nounsByLevel,
  knownWordIds,
  masteryByWordId,
  selectedLevel,
  onLevelChange,
  onStartBlock,
  srsByWordId,
  onStartRepeat,
  totalXpAllLevels,
  onNavigateDuel,
}: LearningTopicHubProps) {
  const { t } = useTranslation();
  const iapLevelUnlocks = useGameStore((s) => s.iapLevelUnlocks);
  const levelGateCoinUnlocks = useGameStore((s) => s.levelGateCoinUnlocks);
  const claimRewardAdBonus = useGameStore((s) => s.claimRewardAdBonus);
  const lessonCoinsYmdStore = useGameStore((s) => s.lessonCoinsYmd);
  const lessonCoinsEarnedStore = useGameStore((s) => s.lessonCoinsEarnedToday);
  const learningAllBlocksUnlocked = useGameStore((s) => s.learningAllBlocksUnlocked);
  const learningMissionArtikClaimed = useGameStore((s) => s.learningMissionArtikClaimed);
  const tryClaimLearningMissionReward = useGameStore((s) => s.tryClaimLearningMissionReward);
  const unlockLearningBlocksForLevel = useGameStore((s) => s.unlockLearningBlocksForLevel);
  const coins = useGameStore((s) => s.coins);
  const [levelLockTarget, setLevelLockTarget] = useState<GoetheLevel | null>(null);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [adToast, setAdToast] = useState<string | null>(null);
  const [unlockToast, setUnlockToast] = useState<string | null>(null);
  const [missionToast, setMissionToast] = useState<string | null>(null);
  /** Başla → rejim seçimi; null = bağlı */
  const [missionModePickerWordIds, setMissionModePickerWordIds] = useState<string[] | null>(null);
  /** Missiya xəritəsində «Daha çox göstər» — hər klikdə +5 missiya */
  const [missionMapExpandBatches, setMissionMapExpandBatches] = useState(0);

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

  useEffect(() => {
    setMissionMapExpandBatches(0);
  }, [selectedLevel]);

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

  useEffect(() => {
    if (!unlockToast) return;
    const id = window.setTimeout(() => setUnlockToast(null), 2800);
    return () => clearTimeout(id);
  }, [unlockToast]);

  useEffect(() => {
    if (!missionToast) return;
    const id = window.setTimeout(() => setMissionToast(null), 3200);
    return () => clearTimeout(id);
  }, [missionToast]);

  const levelNouns = useMemo(() => nounsByLevel[selectedLevel] ?? [], [nounsByLevel, selectedLevel]);

  const levelTotalCount = levelNouns.length;

  const masteredInLevel = useMemo(
    () => countMasteredInLevel(levelNouns, knownWordIds, masteryByWordId),
    [levelNouns, knownWordIds, masteryByWordId],
  );

  const missions = useMemo(
    () => chunkNounsIntoMissions(getMissionOrderedNouns(selectedLevel, levelNouns)),
    [selectedLevel, levelNouns],
  );

  const repeatDueCount = useMemo(
    () =>
      countDueWordsForLevel(levelNouns, knownWordIds, srsByWordId, 'review_only', new Date()),
    [levelNouns, knownWordIds, srsByWordId],
  );

  const paidUnlockForLevel =
    learningAllBlocksUnlocked[selectedLevel] === true || isArtikelVipFromLocalStorage();

  const duelDeviceKey = useMemo(() => getOrCreateDuelUserId(), []);

  const luckyMissionIndex = useMemo(
    () =>
      pickLuckyMissionIndexForDay({
        ymd: formatLocalDate(new Date()),
        level: selectedLevel,
        deviceKey: duelDeviceKey,
        missions,
        knownWordIds,
        masteryByWordId,
        allMissionsPaidUnlocked: paidUnlockForLevel,
      }),
    [
      selectedLevel,
      duelDeviceKey,
      missions,
      knownWordIds,
      masteryByWordId,
      paidUnlockForLevel,
    ],
  );

  const { restMissionIndices, visibleMissionIndices } = useMemo(() => {
    const { baseIndices, restIndices } = computeMissionMapVisibleCore(
      missions,
      knownWordIds,
      masteryByWordId,
      paidUnlockForLevel,
      luckyMissionIndex,
    );
    const extra = missionMapExpandBatches * MISSION_MAP_PAGE;
    const more = restIndices.slice(0, extra);
    const visible = [...new Set([...baseIndices, ...more])].sort((a, b) => a - b);
    return {
      restMissionIndices: restIndices,
      visibleMissionIndices: visible,
    };
  }, [
    missions,
    knownWordIds,
    masteryByWordId,
    paidUnlockForLevel,
    luckyMissionIndex,
    missionMapExpandBatches,
  ]);

  const missionMapMoreRemaining =
    restMissionIndices.length > missionMapExpandBatches * MISSION_MAP_PAGE;

  const showPaidUnlockOffer = useMemo(() => {
    if (missions.length <= 1 || paidUnlockForLevel) return false;
    return missions.some(
      (_, i) => !isMissionGateOpen(i, missions, knownWordIds, masteryByWordId, false),
    );
  }, [missions, knownWordIds, masteryByWordId, paidUnlockForLevel]);

  const paidUnlockGap = LEARN_BLOCKS_UNLOCK_ALL_COST - coins;
  const nearPaidUnlock =
    !isArtikelVipFromLocalStorage() &&
    showPaidUnlockOffer &&
    paidUnlockGap > 0 &&
    paidUnlockGap <= 60;

  useEffect(() => {
    let totalCoins = 0;
    let missionCount = 0;
    missions.forEach((missionNouns, i) => {
      const done = isMissionMastered(missionNouns, knownWordIds, masteryByWordId);
      const g = tryClaimLearningMissionReward(selectedLevel, i, done);
      if (g > 0) {
        totalCoins += g;
        missionCount += 1;
      }
    });
    if (totalCoins > 0) {
      setMissionToast(
        t('learning_topics.mission_artik_toast', { count: missionCount, amount: totalCoins }),
      );
      vibrateCoinReward();
    }
  }, [missions, knownWordIds, masteryByWordId, selectedLevel, tryClaimLearningMissionReward, t]);

  const handleUnlockAllBlocks = useCallback(() => {
    const ok = unlockLearningBlocksForLevel(selectedLevel);
    if (ok) setUnlockToast(t('learning_topics.unlock_missions_success'));
    else setUnlockToast(t('learning_topics.unlock_missions_insufficient'));
  }, [selectedLevel, unlockLearningBlocksForLevel, t]);

  const handleConfirmMissionMode = useCallback(
    (missionMode: 'classic' | 'infinite') => {
      if (!missionModePickerWordIds?.length) return;
      onStartBlock(missionModePickerWordIds, { missionMode });
      setMissionModePickerWordIds(null);
    },
    [missionModePickerWordIds, onStartBlock],
  );

  const handleStartRepeat = useCallback(() => {
    if (repeatDueCount === 0) return;
    onStartRepeat();
  }, [onStartRepeat, repeatDueCount]);

  return (
    <div className="learning-topic-hub flex min-h-[100dvh] flex-col bg-[var(--artikl-learn-hub-bg)] px-4 pb-[var(--app-bottom-pad,7rem)] pt-[max(12px,env(safe-area-inset-top))] sm:px-6 sm:pb-[var(--app-bottom-pad-sm,8rem)]">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-2">
          <h1 className="learning-hub-page-title font-display text-center text-sm font-bold uppercase tracking-[0.2em] text-[#1A1A2E] dark:text-artikl-heading/90">
            {t('learning_topics.section_title')}
          </h1>
          <span className="learning-hub-mastery-chip rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-bold text-[#1A1A2E] dark:text-violet-200">
            {masteredInLevel}/{levelTotalCount}
          </span>
        </div>

        <div className="mt-4 flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GOETHE_LEVELS.map((lvl) => {
              const active = lvl === selectedLevel;
              const monetizationLocked = !isArtikelVipFromLocalStorage() && lvl !== 'A1';
              const progressLocked =
                isGoetheLevelGated(lvl) && !isLevelGateUnlocked(lvl, levelGateArgs);
              const locked = monetizationLocked || progressLocked;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleLevelPick(lvl)}
                  className={[
                    'learning-hub-level-btn shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold tabular-nums transition-all duration-200',
                    active
                      ? 'learning-hub-level-btn--active relative border-2 border-purple-600 bg-purple-600 text-white shadow-[0_0_22px_rgba(139,92,246,0.35)] dark:border-cyan-400/55 dark:bg-gradient-to-br dark:from-violet-600/50 dark:via-violet-500/35 dark:to-cyan-500/30 dark:shadow-[0_0_22px_rgba(139,92,246,0.45),0_0_14px_rgba(34,211,238,0.28)] dark:ring-1 dark:ring-violet-400/50'
                      : 'border-2 border-purple-600 bg-white text-purple-600 backdrop-blur-[10px] dark:border-[var(--artikl-border)] dark:bg-[var(--artikl-surface)] dark:text-artikl-muted2 hover:dark:border-[var(--artikl-border2)] hover:dark:bg-[var(--artikl-surface2)] hover:dark:text-artikl-text',
                    locked ? 'opacity-55' : '',
                  ].join(' ')}
                >
                  {locked ? <span className="mr-0.5" aria-hidden>🔒</span> : null}
                  {lvl}
                </button>
              );
            })}
          </div>
          {isArtikelVipFromLocalStorage() ? (
            <div
              className="flex shrink-0 flex-col items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-extrabold uppercase leading-tight tracking-wide text-amber-200"
              title="Gold VIP"
            >
              <span aria-hidden>👑</span>
              <span className="mt-0.5">VIP</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => startTransition(() => setVipModalOpen(true))}
              className="flex shrink-0 flex-col items-center justify-center rounded-xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-500/25 to-amber-700/20 px-2.5 py-1 text-[10px] font-extrabold uppercase leading-tight tracking-wide text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.25)] transition-transform active:scale-95"
              title="Gold VIP"
            >
              <span aria-hidden>👑</span>
              <span className="mt-0.5">VIP</span>
            </button>
          )}
        </div>

        <div className="learning-hub-coin-row mt-3 rounded-2xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] px-3 py-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#4B5563] dark:text-artikl-text/60">
            <span className="learning-hub-coin-row-label">{t('dashboard.lesson_coin_meter_label')}</span>
            <span className="learning-hub-coin-row-count flex items-center gap-1.5 tabular-nums text-[#7C3AED] dark:text-amber-200/90">
              <span className="learning-hub-coin-icon inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] leading-none">
                🪙
              </span>
              <span>
                {lessonEarnedToday} / {LESSON_DAILY_COIN_CAP}
              </span>
            </span>
          </div>
          <div
            className="learning-hub-lesson-meter-track mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--artikl-prog-track-bg)]"
            role="progressbar"
            aria-valuenow={lessonEarnedToday}
            aria-valuemin={0}
            aria-valuemax={LESSON_DAILY_COIN_CAP}
            aria-label={t('dashboard.lesson_coin_meter_label')}
          >
            <motion.div
              className={
                lessonCapFull
                  ? 'learning-hub-lesson-meter-fill h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-500'
                  : 'learning-hub-lesson-meter-fill h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-cyan-400'
              }
              initial={{ width: 0 }}
              animate={{
                width: `${LESSON_DAILY_COIN_CAP > 0 ? Math.min(100, (lessonEarnedToday / LESSON_DAILY_COIN_CAP) * 100) : 0}%`,
              }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {lessonCapFull ? (
          <p className="learning-hub-lesson-cap-banner mt-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2.5 text-center text-[11px] font-medium leading-relaxed text-[#1A1A2E] dark:text-cyan-100/90">
            {t('learning_topics.artik_limit_learning_continue')}
          </p>
        ) : null}

        <p className="learning-hub-meta mt-3 text-center text-[11px] font-medium tabular-nums text-artikl-muted2">
          {t('learning_topics.level_noun_count', { level: selectedLevel, count: levelTotalCount })}
        </p>

        <p className="learning-hub-progress-line mt-2 text-center text-[12px] font-semibold tabular-nums text-artikl-text">
          {t('learning_topics.level_progress_line', {
            mastered: masteredInLevel,
            total: levelTotalCount,
          })}
        </p>

        <LevelMasteryProgressBar mastered={masteredInLevel} total={levelTotalCount} className="mt-2.5" />

        <motion.div
          className="learning-hub-repeat-card mt-5 rounded-[20px] border border-cyan-400/30 bg-gradient-to-br from-cyan-500/[14] via-teal-500/[10] to-emerald-500/[12] px-4 py-4 shadow-[0_12px_40px_rgba(34,211,238,0.08)]"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="learning-hub-repeat-title flex items-center gap-2 text-[15px] font-bold text-artikl-heading">
                <span className="text-lg" aria-hidden>
                  🔁
                </span>
                {t('learning_topics.repeat_title')}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#4B5563] dark:text-cyan-100/65">
                {t('learning_topics.repeat_sub')}
              </p>
              <p className="mt-1.5 text-[10px] leading-snug text-[#9CA3AF] dark:text-artikl-text/38">
                {t('learning_topics.repeat_coin_hint')}
              </p>
            </div>
            <span className="learning-hub-repeat-badge shrink-0 rounded-full border border-cyan-400/35 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#1A1A2E] dark:text-cyan-100">
              {repeatDueCount}
            </span>
          </div>
          <motion.button
            type="button"
            whileHover={repeatDueCount > 0 ? { scale: 1.01 } : undefined}
            whileTap={repeatDueCount > 0 ? { scale: 0.985 } : undefined}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            disabled={repeatDueCount === 0}
            onClick={handleStartRepeat}
            className="learning-hub-repeat-cta mt-3 w-full rounded-xl border-2 border-purple-600 bg-white py-3 text-[13px] font-bold text-purple-600 shadow-[0_6px_24px_rgba(124,58,237,0.12)] transition-opacity disabled:cursor-not-allowed disabled:border-purple-200 disabled:text-[#9CA3AF] dark:border-cyan-400/40 dark:bg-gradient-to-r dark:from-cyan-600/35 dark:to-teal-600/30 dark:text-cyan-50 dark:shadow-[0_6px_24px_rgba(34,211,238,0.12)] dark:disabled:opacity-35"
          >
            {t('learning_topics.repeat_cta')}
          </motion.button>
        </motion.div>

        <p className="learning-hub-section-header mt-6 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4B5563] dark:text-artikl-text/50">
          {t('learning_topics.mission_map_title')}
        </p>

        {luckyMissionIndex !== null &&
        missions[luckyMissionIndex] &&
        !isMissionMastered(missions[luckyMissionIndex]!, knownWordIds, masteryByWordId) ? (
          <p className="learning-hub-lucky-banner mt-2 rounded-xl border border-[#F59E0B]/40 bg-gradient-to-r from-[#F59E0B]/16 to-orange-500/10 px-3 py-2 text-center text-[11px] font-semibold leading-snug text-[#1A1A2E] dark:text-[#FEF3C7]/95">
            {t('learning_topics.lucky_mission_banner', { n: luckyMissionIndex + 1 })}
          </p>
        ) : null}

        {missions.length === 0 ? (
          <p className="learning-hub-empty mt-8 text-center text-[13px] text-[#4B5563] dark:text-artikl-text/45">
            {t('learning_topics.blocks_empty_level')}
          </p>
        ) : (
          <>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {visibleMissionIndices.map((missionIndex) => {
              const missionNouns = missions[missionIndex]!;
              const range = formatMissionRange(missionIndex, missionNouns);
              const baseGateOpen = isMissionGateOpen(
                missionIndex,
                missions,
                knownWordIds,
                masteryByWordId,
                paidUnlockForLevel,
              );
              const isLuckyMission =
                luckyMissionIndex !== null && missionIndex === luckyMissionIndex;
              const gateOpen = baseGateOpen || isLuckyMission;
              const mastered = missionNouns.filter((n) =>
                isWordMasteredForLevel(n.id, knownWordIds, masteryByWordId),
              ).length;
              const eligible = filterLearningQuizPool(missionNouns, knownWordIds);
              const eligibleCount = eligible.length;
              const missionDone = isMissionMastered(missionNouns, knownWordIds, masteryByWordId);
              const rewardKey = `${selectedLevel}:${missionIndex}`;
              const rewardClaimed = learningMissionArtikClaimed[rewardKey] === true;
              const wordIds = missionNouns.map((n) => n.id);
              const canStart = gateOpen && eligibleCount > 0;

              const missionCardMod = missionDone
                ? 'learning-mission-card--done'
                : gateOpen
                  ? 'learning-mission-card--open'
                  : 'learning-mission-card--locked';

              return (
                <div
                  key={`${selectedLevel}-mission-${missionIndex}`}
                  className={[
                    'learning-mission-card relative flex min-h-[148px] flex-col overflow-hidden rounded-[16px] border p-3 transition-[border-color,opacity]',
                    missionCardMod,
                    missionDone
                      ? 'border-emerald-400/35 bg-gradient-to-br from-emerald-500/[12] via-teal-500/[8] to-cyan-500/[10]'
                      : gateOpen
                        ? 'border-[var(--artikl-border2)] bg-gradient-to-br from-violet-500/[18] via-fuchsia-500/[10] to-cyan-500/[12]'
                        : 'border-[var(--artikl-border)] bg-[var(--artikl-surface)]',
                    !gateOpen ? 'opacity-90' : '',
                  ].join(' ')}
                >
                  {!gateOpen ? (
                    <div
                      className="learning-mission-lock-overlay pointer-events-none absolute inset-0 z-[1] bg-[#0a0a12]/55 backdrop-blur-[2px]"
                      aria-hidden
                    />
                  ) : null}

                  <div
                    className={`relative flex min-h-0 flex-1 flex-col rounded-xl bg-white/75 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-[3px] dark:bg-[#050508]/55 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${!gateOpen ? 'z-[2]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="learning-mission-card__title min-w-0 text-[13px] font-bold leading-snug text-artikl-heading">
                        {!gateOpen ? (
                          <span className="mr-0.5 text-base leading-none" aria-hidden>
                            🔒
                          </span>
                        ) : null}
                        {t('learning_topics.mission_title', { n: missionIndex + 1 })}
                        {isLuckyMission && !baseGateOpen ? (
                          <span className="learning-hub-lucky-badge ml-1.5 inline-block rounded-md border border-[#F59E0B]/50 bg-[#F59E0B]/22 px-1 py-0.5 align-middle text-[8px] font-extrabold uppercase tracking-wide text-[#1A1A2E] dark:text-[#FFFBEB]">
                            {t('learning_topics.lucky_mission_badge')}
                          </span>
                        ) : null}
                      </p>
                      {missionDone && rewardClaimed ? (
                        <span
                          className="learning-mission-card__reward shrink-0 rounded-md border border-emerald-400/35 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-emerald-100/95"
                          title={t('learning_topics.mission_reward_chip_aria')}
                        >
                          +{LEARNING_MISSION_ARTIK_REWARD}
                        </span>
                      ) : null}
                    </div>
                    <p className="learning-mission-card__range mt-0.5 text-[10px] font-medium tabular-nums text-[#4B5563] dark:text-artikl-text/40">
                      {range}
                    </p>
                    <p className="learning-mission-card__count mt-1.5 text-[10px] font-medium tabular-nums text-[#4B5563] dark:text-artikl-text/48">
                      {mastered}/{missionNouns.length}
                    </p>
                    <div className="learning-mission-card__track mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--artikl-prog-track-bg)]">
                      <div
                        className="learning-mission-card__fill h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-[width] duration-500"
                        style={{
                          width: `${missionNouns.length > 0 ? Math.round((mastered / missionNouns.length) * 100) : 0}%`,
                        }}
                      />
                    </div>

                    <div className="mt-auto pt-2">
                      {gateOpen ? (
                        missionDone || eligibleCount === 0 ? (
                          <p className="learning-mission-card__status learning-mission-card__status--success text-[11px] font-medium leading-snug text-emerald-200/85">
                            {t('learning_topics.mission_complete')}
                          </p>
                        ) : (
                          <p className="learning-mission-card__status learning-mission-card__status--ready text-[10px] leading-snug text-[#4B5563] dark:text-artikl-text/48">
                            {t('learning_topics.mission_sub_ready')}
                          </p>
                        )
                      ) : (
                        <p className="learning-mission-card__status learning-mission-card__status--locked-hint text-[10px] leading-snug text-[#4B5563] dark:text-orange-200/80">
                          {t('learning_topics.mission_locked_hint')}
                        </p>
                      )}

                      {gateOpen && eligibleCount > 0 ? (
                        <motion.button
                          type="button"
                          whileHover={canStart ? { scale: 1.02 } : undefined}
                          whileTap={canStart ? { scale: 0.98 } : undefined}
                          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                          disabled={!canStart}
                          onClick={() => setMissionModePickerWordIds(wordIds)}
                          className="learning-mission-start-btn mt-2 w-full rounded-lg border-2 border-purple-600 bg-purple-600 py-2 text-[11px] font-bold text-white shadow-[0_6px_20px_rgba(139,92,246,0.22)] transition-opacity disabled:cursor-not-allowed disabled:border-purple-200 disabled:bg-purple-200 disabled:text-[#9CA3AF] dark:border-transparent dark:bg-gradient-to-r dark:from-[#7c6cf8] dark:via-[#a855f7] dark:to-[#c44fd9] dark:disabled:opacity-35"
                        >
                          {t('learning_topics.mission_start')}
                        </motion.button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {missionMapMoreRemaining ? (
            <button
              type="button"
              onClick={() => setMissionMapExpandBatches((c) => c + 1)}
              className="learning-hub-missions-more mt-3 w-full rounded-xl border-2 border-purple-600 bg-white py-3 text-[12px] font-semibold text-purple-600 transition-colors hover:bg-purple-50 active:scale-[0.99] dark:border-[var(--artikl-border2)] dark:bg-[var(--artikl-surface2)] dark:text-artikl-text/85 hover:dark:border-[var(--artikl-border)] hover:dark:bg-[var(--artikl-surface)]"
            >
              {t('learning_topics.show_more_missions')}
            </button>
          ) : null}
          </>
        )}

        {showPaidUnlockOffer ? (
          <div className="learning-hub-unlock-panel mt-5 rounded-2xl border border-[#EA580C]/30 bg-[#EA580C]/[0.07] px-4 py-3.5">
            <p className="text-center text-[11px] font-medium leading-relaxed text-[#1A1A2E] dark:text-orange-50/90">
              {t('learning_topics.unlock_all_missions_banner')}
            </p>
            <button
              type="button"
              onClick={handleUnlockAllBlocks}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-purple-600 bg-white py-3 text-[12px] font-extrabold text-purple-600 shadow-[0_6px_24px_rgba(124,58,237,0.12)] transition-colors hover:bg-purple-50 dark:border-[#EA580C]/45 dark:bg-gradient-to-r dark:from-orange-600/22 dark:to-[#EA580C]/16 dark:text-orange-50 dark:shadow-[0_6px_24px_rgba(234,88,12,0.16)] hover:dark:border-orange-500/55"
            >
              <span aria-hidden>🪙</span>
              {t('learning_topics.unlock_all_missions_cta', { cost: LEARN_BLOCKS_UNLOCK_ALL_COST })}
              <span className="text-[10px] font-semibold tabular-nums text-[#7C3AED] dark:text-orange-200/75">
                ({t('common.amount_artik', { amount: coins })})
              </span>
            </button>
            {nearPaidUnlock ? (
              <button
                type="button"
                onClick={handleWatchAd}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-purple-600 bg-purple-600 py-3.5 text-[13px] font-extrabold text-white shadow-[0_6px_24px_rgba(124,58,237,0.25)] transition-transform animate-pulse active:scale-[0.98] dark:border-[#EA580C]/60 dark:bg-gradient-to-r dark:from-orange-600/32 dark:via-[#EA580C]/28 dark:to-orange-700/22 dark:shadow-[0_0_28px_rgba(234,88,12,0.32),0_8px_28px_rgba(234,88,12,0.2)] dark:ring-2 dark:ring-orange-500/45"
              >
                <span aria-hidden>📺</span>
                {t('dashboard.lesson_limit_ad_cta')}
              </button>
            ) : null}
          </div>
        ) : null}

        {lessonCapFull ? (
          <div className="mx-auto mt-5 flex w-full max-w-[380px] flex-wrap justify-center gap-2">
            {onNavigateDuel ? (
              <button
                type="button"
                onClick={onNavigateDuel}
                className="rounded-xl border-2 border-purple-600 bg-white px-4 py-2.5 text-[12px] font-bold text-purple-600 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-100"
              >
                {t('dashboard.lesson_limit_duel_cta')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleWatchAd}
              className={[
                'rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-transform active:scale-[0.98]',
                nearPaidUnlock
                  ? 'border-2 border-purple-600 bg-purple-600 text-white shadow-[0_0_24px_rgba(124,58,237,0.28)] ring-2 ring-purple-500/40 animate-pulse dark:border-[#EA580C]/65 dark:bg-gradient-to-r dark:from-orange-600/28 dark:to-[#EA580C]/22 dark:text-orange-50 dark:shadow-[0_0_24px_rgba(234,88,12,0.28)] dark:ring-orange-500/42'
                  : 'border-2 border-purple-600 bg-white text-purple-600 dark:border-[var(--artikl-border2)] dark:bg-[var(--artikl-surface2)] dark:text-artikl-text/80',
              ].join(' ')}
            >
              {t('dashboard.lesson_limit_ad_cta')}
            </button>
          </div>
        ) : null}

        {missionModePickerWordIds ? (
          <div
            className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:px-4"
            role="dialog"
            aria-modal
            aria-labelledby="mission-mode-title"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label={t('learning_topics.mission_mode_cancel')}
              onClick={() => setMissionModePickerWordIds(null)}
            />
            <div className="relative z-[1] mx-auto w-full max-w-[400px] rounded-t-3xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(0,0,0,0.35)] sm:rounded-3xl sm:pb-5">
              <h2
                id="mission-mode-title"
                className="text-center text-base font-bold leading-snug text-artikl-heading"
              >
                {t('learning_topics.mission_mode_title')}
              </h2>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => handleConfirmMissionMode('classic')}
                  className="flex w-full flex-col items-start gap-1 rounded-2xl border border-violet-400/35 bg-gradient-to-br from-violet-500/18 to-fuchsia-500/10 px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
                >
                  <span className="text-[14px] font-bold text-artikl-heading">
                    {t('learning_topics.mission_mode_classic')}
                  </span>
                  <span className="text-[11px] leading-snug text-[#4B5563] dark:text-artikl-text/65">
                    {t('learning_topics.mission_mode_classic_desc')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmMissionMode('infinite')}
                  className="flex w-full flex-col items-start gap-1 rounded-2xl border border-cyan-400/35 bg-gradient-to-br from-cyan-500/14 to-violet-500/10 px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
                >
                  <span className="text-[14px] font-bold text-artikl-heading">
                    {t('learning_topics.mission_mode_infinite')}
                  </span>
                  <span className="text-[11px] leading-snug text-[#4B5563] dark:text-artikl-text/65">
                    {t('learning_topics.mission_mode_infinite_desc')}
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMissionModePickerWordIds(null)}
                className="mt-4 w-full rounded-xl border-2 border-purple-600 bg-white py-2.5 text-[12px] font-semibold text-purple-600 dark:border-[var(--artikl-border2)] dark:bg-[var(--artikl-surface2)] dark:text-artikl-text/80"
              >
                {t('learning_topics.mission_mode_cancel')}
              </button>
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

        {unlockToast ? (
          <div
            className="learning-hub-toast--dark fixed bottom-[max(9rem,env(safe-area-inset-bottom)+7rem)] left-1/2 z-[93] w-[min(90vw,320px)] -translate-x-1/2 rounded-xl border border-amber-400/30 bg-[#1c1410]/95 px-3 py-2 text-center text-[12px] text-amber-100/95 shadow-lg"
            role="status"
          >
            {unlockToast}
          </div>
        ) : null}

        {missionToast ? (
          <div
            className="fixed bottom-[max(12rem,env(safe-area-inset-bottom)+9.5rem)] left-1/2 z-[94] w-[min(90vw,320px)] -translate-x-1/2 rounded-xl border border-emerald-400/35 bg-[#0f1c16]/95 px-3 py-2 text-center text-[12px] text-emerald-100/95 shadow-lg"
            role="status"
          >
            {missionToast}
          </div>
        ) : null}
      </div>
    </div>
  );
}
