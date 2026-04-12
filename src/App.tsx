import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tryNotifyGoldenHourStart } from './lib/coinBonus';
import { syncDailyLoginStreak } from './lib/dailyLoginStreak';
import { playMilestoneFanfare, vibrateCoinReward } from './lib/answerFeedbackMedia';
import { firePioneerBonusConfetti, fireReferralRewardConfetti } from './lib/rewardConfetti';
import { REFERRAL_REWARD_COINS, subscribeReferralGrants } from './lib/referralRtdb';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav, type Tab } from './components/BottomNav';
import { AmbientOrbs } from './components/layout/AmbientOrbs';
import { HomeView } from './components/HomeView';
import { ArticleMatchQuiz } from './components/ArticleMatchQuiz';
import { LearningTopicHub } from './components/learning/LearningTopicHub';
import { getOrCreateDuelUserId } from './components/DuelGame';
import { FriendsNotificationLayer } from './components/FriendsNotificationLayer';
import { VocabularyChecker } from './components/VocabularyChecker';
import { CoinShopSheet } from './components/CoinShopSheet';
import { VipSubscriptionModal } from './components/VipSubscriptionModal';
import { MilestoneOverlay } from './components/MilestoneOverlay';
import { PioneerBonusOverlay } from './components/PioneerBonusOverlay';
import { WelcomeStarterOverlay } from './components/WelcomeStarterOverlay';
import { ThemeToggle } from './components/ThemeToggle';
import Onboarding from './components/Onboarding';
import { signOut } from 'firebase/auth';
import { syncDailyStreak } from './lib/dailyStreak';
import {
  auth,
  ensureAnonymousFirebaseUser,
  isFirebaseLive,
  isRealtimeDatabaseUrlConfigured,
} from './lib/firebase';
import {
  claimDeviceSessionLock,
  getOrCreateLocalDeviceId,
  subscribeDeviceSessionLock,
} from './lib/deviceSession';
import { isDeviceSessionKicked, setDeviceSessionKicked } from './lib/deviceSessionFlags';
import { bindAppPresence } from './lib/userPresenceRtdb';
import {
  setPlayerAvatar,
  setPlayerProfileDisplayName,
  subscribeIsAlphaTester,
} from './lib/playerProfileRtdb';
import { syncLeaderboardXp } from './lib/leaderboardRtdb';
import { useQuizProgress } from './hooks/useQuizProgress';
import { useGameStoreRehydrated } from './hooks/useGameStoreRehydrated';
import { useSupabaseScoresRealtime } from './hooks/useSupabaseScoresRealtime';
import {
  isArtikelVipFromLocalStorage,
  isLessonDailyArtikCapReached,
  syncLessonDailyCoinsToToday,
  syncStreakFreezeExpiry,
  useGameStore,
} from './store/useGameStore';
import { useVocabulary } from './context/VocabularyContext';
import { countMasteredInLevel } from './lib/dashboardBuckets';
import type { Article, GoetheLevel } from './types';
import { GOETHE_LEVELS } from './types';
import { highestUnlockedGoetheLevel, isLevelGateUnlocked, type LevelGateCheckArgs } from './lib/levelGate';
import { DUEL_MIN_ARTIK_BALANCE } from './lib/duelEntry';
import { LeaderboardLiveSync } from './lib/leaderboardLiveQuery';
import {
  promptNotificationPermissionOnFirstLaunch,
  startPwaLocalNotificationScheduler,
} from './lib/pwaLocalNotifications';
import { checkStreak } from './lib/retentionStreak';

const ExamFlowLazy = lazy(() =>
  import('./components/exam/ExamFlow').then((m) => ({ default: m.ExamFlow })),
);
const DuelMatchLazy = lazy(() =>
  import('./components/DuelMatch').then((m) => ({ default: m.DuelMatch })),
);
const LeaderboardViewLazy = lazy(() =>
  import('./components/LeaderboardView').then((m) => ({ default: m.LeaderboardView })),
);

function DeferredTabFallback() {
  return (
    <div
      className="flex min-h-[50dvh] items-center justify-center px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--artikl-border2)] border-t-[var(--artikl-accent)] opacity-90" />
    </div>
  );
}

type LearnQuizConfig = {
  restrictIds: string[] | null;
  poolScope: 'selected_level' | 'all_levels';
  reviewOnly?: boolean;
  /** Missiya «Sonsuz» rejimi: təkrarsız sıra */
  missionSessionMode?: 'classic' | 'infinite';
  /** Missiya xəritəsi indeksi — klassik sessiya bitəndə kilid üçün */
  missionSlotIndex?: number;
};

export default function App() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('home');
  /** Öyrənməyə hər girişdə tam sıfırlama (köhnə taymerlər / sessiya «quyruğu» olmasın) */
  const [learnMountKey, setLearnMountKey] = useState(0);
  const [learnSubView, setLearnSubView] = useState<'topics' | 'quiz'>('topics');
  const [learnQuizConfig, setLearnQuizConfig] = useState<LearnQuizConfig | null>(null);
  const {
    selectedLevel,
    setSelectedLevel,
    stats,
    totalXpAllLevels,
    odluSeriya,
    displayName,
    setDisplayName,
    wrongCountByWordId,
    knownWordIds,
    masteryByWordId,
    srsByWordId,
    recordAnswer,
    byLevel,
    ensureHardWord,
    removeHardWord,
  } = useQuizProgress();
  const { nounsByLevel } = useVocabulary();

  const leaderboardLearnedWordsTotal = useMemo(() => {
    return GOETHE_LEVELS.reduce((sum, lvl) => {
      const nouns = nounsByLevel[lvl] ?? [];
      if (nouns.length === 0) return sum;
      return sum + countMasteredInLevel(nouns, knownWordIds, masteryByWordId);
    }, 0);
  }, [nounsByLevel, knownWordIds, masteryByWordId]);

  const iapLevelUnlocks = useGameStore((s) => s.iapLevelUnlocks);
  const levelGateCoinUnlocks = useGameStore((s) => s.levelGateCoinUnlocks);
  const artikBalance = useGameStore((s) => s.coins);

  const rtdbUserId = useMemo(() => getOrCreateDuelUserId(), []);
  const gameStoreHydrated = useGameStoreRehydrated();
  /** Supabase Realtime: `public.scores` INSERT → konsol + istəyə görə `onInsert` (UI). */
  useSupabaseScoresRealtime();
  const isRegistered = useGameStore((s) => s.isRegistered);
  const profilePlayerName = useGameStore((s) => s.playerName);
  const profileAvatar = useGameStore((s) => s.avatar);
  const migrateQuizProfileRef = useRef(false);

  useEffect(() => {
    if (!gameStoreHydrated || migrateQuizProfileRef.current) return;
    migrateQuizProfileRef.current = true;
    const st = useGameStore.getState();
    if (st.isRegistered) {
      const n = st.playerName.trim();
      if (n) setDisplayName(n);
      return;
    }
    const q = displayName.trim();
    if (q) {
      useGameStore.getState().setPlayer(q, useGameStore.getState().avatar);
    }
  }, [gameStoreHydrated, displayName, setDisplayName]);

  const [retentionStreakEntryBump, setRetentionStreakEntryBump] = useState(false);
  useEffect(() => {
    syncDailyStreak();
    const r = checkStreak();
    setRetentionStreakEntryBump(r.didBumpStreak);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => promptNotificationPermissionOnFirstLaunch(), 2000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => startPwaLocalNotificationScheduler(), []);

  /** Gündəlik öyrənmə limiti (300) — saxlanılmış tarix dünəndirsə, təqvimə görə sıfırlanır. */
  useEffect(() => {
    if (!gameStoreHydrated) return;
    syncLessonDailyCoinsToToday();
    syncStreakFreezeExpiry();
  }, [gameStoreHydrated]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        syncLessonDailyCoinsToToday();
        syncStreakFreezeExpiry();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  /** İlk giriş: totalXp === 0 — +200 sikkə və tam ekran qarşılama. */
  useEffect(() => {
    if (!gameStoreHydrated || !isRegistered) return;
    const granted = useGameStore.getState().claimWelcomeStarterBonusIfEligible(totalXpAllLevels);
    if (granted) {
      vibrateCoinReward();
      setWelcomeStarterVisible(true);
    }
  }, [gameStoreHydrated, isRegistered, totalXpAllLevels]);

  const [coinShopOpen, setCoinShopOpen] = useState(false);
  const [vipPaymentOpen, setVipPaymentOpen] = useState(false);
  const [checkInToast, setCheckInToast] = useState<{ coins: number; dayIndex: number } | null>(null);
  const [referralRewardToast, setReferralRewardToast] = useState<number | null>(null);
  const [welcomeStarterVisible, setWelcomeStarterVisible] = useState(false);
  const [pioneerBonusVisible, setPioneerBonusVisible] = useState(false);
  /** Bir hesab — bir aktiv cihaz; RTDB kilidi hazır olmayana qədər bulud yazıları gözləyir. */
  const [deviceSessionReady, setDeviceSessionReady] = useState(() => !isFirebaseLive);
  const [deviceSessionMessage, setDeviceSessionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!gameStoreHydrated || !isRegistered) return;
    syncDailyLoginStreak();
    const r = useGameStore.getState().claimDailyCheckIn();
    if (r) {
      vibrateCoinReward();
      setCheckInToast({ coins: r.coins, dayIndex: r.dayIndex });
    }
    tryNotifyGoldenHourStart();
  }, [gameStoreHydrated, isRegistered]);

  useEffect(() => {
    if (!checkInToast) return;
    const id = window.setTimeout(() => setCheckInToast(null), 5200);
    return () => clearTimeout(id);
  }, [checkInToast]);

  useEffect(() => {
    if (referralRewardToast == null) return;
    const id = window.setTimeout(() => setReferralRewardToast(null), 4800);
    return () => clearTimeout(id);
  }, [referralRewardToast]);

  /* Auto-navigate to Duel tab when opened via invite link (?room=XXX) */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (!room) return;
    try { sessionStorage.setItem('duel-auto-join-room', room.toUpperCase()); } catch { /* ignore */ }
    // Strip ?room= from the URL bar without reloading
    const clean = window.location.pathname + window.location.hash;
    window.history.replaceState(null, '', clean);
    setTab('duel');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get('ref') || params.get('invite'))?.trim();
    if (ref && /^[A-Z0-9]{6,12}$/i.test(ref)) {
      useGameStore.getState().setPendingReferralCode(ref);
    }
  }, []);

  /**
   * Sessiya kilidi: yeni cihaz `lastDeviceId` yazır; köhnə cihaz eyni yolu dinləyir və fərqdə çıxır.
   */
  useEffect(() => {
    if (!isFirebaseLive || !isRealtimeDatabaseUrlConfigured()) {
      setDeviceSessionReady(true);
      return;
    }
    if (isDeviceSessionKicked()) {
      setDeviceSessionReady(false);
      setDeviceSessionMessage(t('session.device_in_use'));
      return;
    }
    let unsubLock: (() => void) | undefined;
    let cancelled = false;
    setDeviceSessionReady(false);
    void (async () => {
      await ensureAnonymousFirebaseUser();
      if (cancelled || isDeviceSessionKicked()) return;
      await claimDeviceSessionLock(rtdbUserId);
      if (cancelled) return;
      const local = getOrCreateLocalDeviceId();
      unsubLock = subscribeDeviceSessionLock(rtdbUserId, local, () => {
        if (cancelled) return;
        setDeviceSessionKicked();
        setDeviceSessionReady(false);
        if (auth) void signOut(auth);
        setDeviceSessionMessage(t('session.device_in_use'));
      });
      if (!cancelled) setDeviceSessionReady(true);
    })();
    return () => {
      cancelled = true;
      unsubLock?.();
    };
  }, [isFirebaseLive, rtdbUserId, t]);

  useEffect(() => {
    if (!isFirebaseLive || !deviceSessionReady) return;
    void bindAppPresence(rtdbUserId);
  }, [rtdbUserId, isFirebaseLive, deviceSessionReady]);

  useEffect(() => {
    if (!isFirebaseLive || !deviceSessionReady) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      if (!(await ensureAnonymousFirebaseUser())) return;
      if (cancelled) return;
      unsub = subscribeReferralGrants(rtdbUserId, (coins) => {
        useGameStore.getState().earnCoins(coins);
        vibrateCoinReward();
        if (coins === REFERRAL_REWARD_COINS) {
          playMilestoneFanfare();
          fireReferralRewardConfetti();
          setReferralRewardToast(coins);
        }
      });
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [rtdbUserId, isFirebaseLive, deviceSessionReady]);

  /** RTDB `isAlpha` (Pioner) — bir dəfə +1000 Artik və tam ekran. */
  useEffect(() => {
    if (!isFirebaseLive || !deviceSessionReady || !gameStoreHydrated || !isRegistered) return;
    return subscribeIsAlphaTester(rtdbUserId, (isAlpha) => {
      if (!isAlpha) return;
      const granted = useGameStore.getState().claimPioneerAlphaBonusOnce();
      if (!granted) return;
      playMilestoneFanfare();
      vibrateCoinReward();
      firePioneerBonusConfetti();
      setPioneerBonusVisible(true);
    });
  }, [rtdbUserId, isFirebaseLive, deviceSessionReady, gameStoreHydrated, isRegistered]);

  useEffect(() => {
    if (!isFirebaseLive || !deviceSessionReady) return;
    const n = (profilePlayerName || displayName).trim();
    if (!n) return;
    void setPlayerProfileDisplayName(rtdbUserId, n);
  }, [displayName, profilePlayerName, rtdbUserId, deviceSessionReady]);

  useEffect(() => {
    if (!isFirebaseLive || !deviceSessionReady) return;
    const name = (profilePlayerName || displayName).trim() || 'Oyunçu';
    void (async () => {
      if (!(await ensureAnonymousFirebaseUser())) return;
      await syncLeaderboardXp(
        rtdbUserId,
        totalXpAllLevels,
        name,
        profileAvatar,
        leaderboardLearnedWordsTotal,
      );
    })();
  }, [
    totalXpAllLevels,
    displayName,
    profilePlayerName,
    profileAvatar,
    rtdbUserId,
    deviceSessionReady,
    leaderboardLearnedWordsTotal,
  ]);

  /** Yalnız statistika/mastery yazılır; modal, sessiya, «10 söz» yoxdur (App-də də yoxdur). */
  const handleLearningRecord = useCallback(
    (level: GoetheLevel, article: Article, correct: boolean, wordId: string) => {
      recordAnswer(level, article, correct, wordId, { learningSrs: true });
    },
    [recordAnswer],
  );

  const handleDuelRecord = useCallback(
    (level: GoetheLevel, article: Article, correct: boolean, wordId: string) => {
      recordAnswer(level, article, correct, wordId);
    },
    [recordAnswer],
  );

  const handleRegistrationComplete = useCallback(() => {
    const st = useGameStore.getState();
    const name = st.playerName.trim();
    if (!name) return;
    setDisplayName(name);
    if (isFirebaseLive) {
      void setPlayerProfileDisplayName(rtdbUserId, name);
      void setPlayerAvatar(rtdbUserId, st.avatar);
    }
    setLearnQuizConfig(null);
    setLearnSubView('topics');
    setLearnMountKey((k) => k + 1);
    setTab('quiz');
  }, [rtdbUserId, setDisplayName]);

  const handleStartDuel = useCallback(() => {
    if (
      !isArtikelVipFromLocalStorage() &&
      useGameStore.getState().coins < DUEL_MIN_ARTIK_BALANCE
    ) {
      setCoinShopOpen(true);
      return;
    }
    setTab('duel');
  }, []);

  const handleTabChange = useCallback((next: Tab) => {
    if (next === 'quiz' && isLessonDailyArtikCapReached()) {
      setVipPaymentOpen(true);
      return;
    }
    if (
      next === 'duel' &&
      !isArtikelVipFromLocalStorage() &&
      useGameStore.getState().coins < DUEL_MIN_ARTIK_BALANCE
    ) {
      setCoinShopOpen(true);
      return;
    }
    setTab((prev) => {
      if (prev === 'quiz' && next !== 'quiz') {
        queueMicrotask(() => {
          setLearnSubView('topics');
          setLearnQuizConfig(null);
        });
      }
      if (next === 'quiz' && prev !== 'quiz') {
        queueMicrotask(() => {
          setLearnMountKey((k) => k + 1);
          setLearnSubView('topics');
          setLearnQuizConfig(null);
        });
      }
      return next;
    });
  }, []);

  const abandonLearnQuiz = useCallback(() => {
    setLearnQuizConfig(null);
    setLearnSubView('topics');
    setLearnMountKey((k) => k + 1);
  }, []);

  const startLearnFull = useCallback(() => {
    if (isLessonDailyArtikCapReached()) {
      setVipPaymentOpen(true);
      return;
    }
    setLearnSubView('topics');
    setLearnQuizConfig(null);
    setTab('quiz');
  }, []);

  const openLearnAtLevelFromHomeMap = useCallback((level: GoetheLevel) => {
    if (isLessonDailyArtikCapReached()) {
      setVipPaymentOpen(true);
      return;
    }
    if (!isArtikelVipFromLocalStorage() && level !== 'A1') {
      setVipPaymentOpen(true);
      return;
    }
    setSelectedLevel(level);
    setLearnSubView('topics');
    setLearnQuizConfig(null);
    setLearnMountKey((k) => k + 1);
    setTab('quiz');
  }, [setSelectedLevel]);

  const showRegistrationGate = gameStoreHydrated && !isRegistered;

  const levelGateArgsForClamp: LevelGateCheckArgs = useMemo(
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
    if (!isLevelGateUnlocked(selectedLevel, levelGateArgsForClamp)) {
      setSelectedLevel(highestUnlockedGoetheLevel(levelGateArgsForClamp));
    }
  }, [selectedLevel, levelGateArgsForClamp, setSelectedLevel]);

  /** Gold VIP olmayan oyunçular: öyrənmə və kviz yalnız A1. */
  useEffect(() => {
    if (isArtikelVipFromLocalStorage()) return;
    if (selectedLevel !== 'A1') {
      setSelectedLevel('A1');
    }
  }, [selectedLevel, setSelectedLevel]);

  return (
    <div lang="az" className="relative min-h-[100dvh] overflow-x-hidden bg-[var(--artikl-bg)]">
      <ThemeToggle />
      {!showRegistrationGate ? <MilestoneOverlay /> : null}
      {!showRegistrationGate ? (
        <WelcomeStarterOverlay visible={welcomeStarterVisible} onDismiss={() => setWelcomeStarterVisible(false)} />
      ) : null}
      {!showRegistrationGate ? (
        <PioneerBonusOverlay visible={pioneerBonusVisible} onDismiss={() => setPioneerBonusVisible(false)} />
      ) : null}
      {!showRegistrationGate ? <AmbientOrbs /> : null}

      <AnimatePresence>
        {checkInToast && !showRegistrationGate ? (
          <motion.div
            key="daily-checkin"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-[max(5.5rem,env(safe-area-inset-bottom)+4.5rem)] left-1/2 z-[85] w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl border border-amber-400/35 bg-gradient-to-br from-[rgba(245,158,11,0.18)] via-[rgba(24,22,38,0.97)] to-[rgba(14,12,22,0.99)] px-4 py-3.5 text-center shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
            role="status"
            aria-live="polite"
          >
            <p className="text-lg" aria-hidden>
              🪙
            </p>
            <p className="mt-1 text-[13px] font-bold leading-snug text-white">
              {t('rewards.check_in_title')}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/72">
              {t('rewards.check_in_body', {
                day: checkInToast.dayIndex,
                coins: checkInToast.coins,
              })}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {referralRewardToast != null && !showRegistrationGate ? (
          <motion.div
            key="referral-bonus"
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="app-toast-on-dark fixed left-1/2 top-[max(1.25rem,env(safe-area-inset-top))] z-[210] w-[min(92vw,380px)] -translate-x-1/2 rounded-2xl border border-[#F59E0B]/45 bg-gradient-to-br from-[rgba(124,58,237,0.2)] via-[rgba(30,24,48,0.96)] to-[rgba(12,10,20,0.99)] px-4 py-4 text-center shadow-[0_20px_56px_rgba(124,58,237,0.22),0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
            role="status"
            aria-live="polite"
          >
            <p className="text-2xl" aria-hidden>
              🎉
            </p>
            <p className="mt-1 text-[15px] font-extrabold leading-snug text-[#FEF3C7]">
              {t('profile.referral_reward_toast_title')}
            </p>
            <p className="mt-1.5 text-[13px] font-bold leading-snug text-[#FEF3C7]">
              {t('common.reward_credited', { amount: referralRewardToast })}
            </p>
            <p className="mt-1 text-[11px] text-artikl-muted2">
              {t('profile.referral_reward_toast_sub')}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {deviceSessionMessage ? (
          <motion.div
            key="device-session-kick"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="app-toast-on-dark fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[220] w-[min(92vw,400px)] -translate-x-1/2 rounded-2xl border border-rose-500/45 bg-gradient-to-br from-[rgba(244,63,94,0.2)] via-[rgba(24,18,32,0.98)] to-[rgba(10,8,16,0.99)] px-4 py-3.5 text-center shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md"
            role="alert"
            aria-live="assertive"
          >
            <p className="text-[13px] font-bold leading-snug text-rose-100">{deviceSessionMessage}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-artikl-muted2">
              {t('session.lock_hint')}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showRegistrationGate ? (
          <motion.div
            key="player-reg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[1] min-h-[100dvh]"
          >
            <Onboarding onComplete={handleRegistrationComplete} />
          </motion.div>
        ) : tab === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[1]"
          >
            <HomeView
              selectedLevel={selectedLevel}
              totalXpAllLevels={totalXpAllLevels}
              knownWordIds={knownWordIds}
              masteryByWordId={masteryByWordId}
              streakDays={odluSeriya.streak}
              retentionStreakEntryBump={retentionStreakEntryBump}
              dashboardUserId={rtdbUserId}
              onContinueLearn={startLearnFull}
              onOpenVipPayment={() => setVipPaymentOpen(true)}
              onOpenDuel={handleStartDuel}
              onOpenExam={() => setTab('exam')}
              onOpenCoinShop={() => setCoinShopOpen(true)}
              onOpenLeaders={() => setTab('leaders')}
              onMapLevelSelect={openLearnAtLevelFromHomeMap}
            />
          </motion.div>
        ) : tab === 'quiz' ? (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnimatePresence mode="wait">
              {learnSubView === 'topics' ? (
                <motion.div
                  key="learn-topics"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <LearningTopicHub
                    nounsByLevel={nounsByLevel}
                    knownWordIds={knownWordIds}
                    masteryByWordId={masteryByWordId}
                    selectedLevel={selectedLevel}
                    onLevelChange={setSelectedLevel}
                    totalXpAllLevels={totalXpAllLevels}
                    onNavigateDuel={handleStartDuel}
                    srsByWordId={srsByWordId}
                    onOpenVipPayment={() => setVipPaymentOpen(true)}
                    onStartBlock={(wordIds, opts) => {
                      if (isLessonDailyArtikCapReached()) {
                        setVipPaymentOpen(true);
                        return;
                      }
                      setLearnQuizConfig({
                        restrictIds: [...wordIds],
                        poolScope: 'selected_level',
                        reviewOnly: false,
                        missionSessionMode: opts.missionMode,
                        missionSlotIndex: opts.missionSlotIndex,
                      });
                      setLearnSubView('quiz');
                      setLearnMountKey((k) => k + 1);
                    }}
                    onStartRepeat={() => {
                      if (isLessonDailyArtikCapReached()) {
                        setVipPaymentOpen(true);
                        return;
                      }
                      setLearnQuizConfig({
                        restrictIds: null,
                        poolScope: 'selected_level',
                        reviewOnly: true,
                      });
                      setLearnSubView('quiz');
                      setLearnMountKey((k) => k + 1);
                    }}
                  />
                </motion.div>
              ) : learnQuizConfig ? (
                <motion.div
                  key="learn-quiz"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <ArticleMatchQuiz
                    key={`${selectedLevel}-${learnMountKey}`}
                    level={selectedLevel}
                    levelStats={stats}
                    knownWordIds={knownWordIds}
                    masteryByWordId={masteryByWordId}
                    srsByWordId={srsByWordId}
                    totalXpAllLevels={totalXpAllLevels}
                    odluStreakDays={odluSeriya.streak}
                    learnPoolScope={learnQuizConfig.poolScope}
                    restrictToWordIds={learnQuizConfig.restrictIds}
                    reviewOnly={learnQuizConfig.reviewOnly === true}
                    missionSessionMode={learnQuizConfig.missionSessionMode}
                    missionSlotIndex={learnQuizConfig.missionSlotIndex ?? null}
                    progressLevelLabel={
                      learnQuizConfig.reviewOnly ? t('learning_topics.repeat_chip') : undefined
                    }
                    sessionExitButtonLabel={t('learning_topics.back_topics')}
                    onAbandonSession={abandonLearnQuiz}
                    onRecord={handleLearningRecord}
                    onEnsureHardWord={ensureHardWord}
                    onRemoveHardWord={removeHardWord}
                    onExitAfterSession={() => {
                      setLearnQuizConfig(null);
                      setLearnSubView('topics');
                      setLearnMountKey((k) => k + 1);
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : tab === 'exam' ? (
          <motion.div
            key="exam"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[1]"
          >
            <Suspense fallback={<DeferredTabFallback />}>
              <ExamFlowLazy
                defaultLevel={selectedLevel}
                nounsByLevel={nounsByLevel}
                knownWordIds={knownWordIds}
                wrongCountByWordId={wrongCountByWordId}
                byLevel={byLevel}
                recordAnswer={recordAnswer}
                onGoHome={() => setTab('home')}
              />
            </Suspense>
          </motion.div>
        ) : tab === 'duel' ? (
          <motion.div
            key="duel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[1]"
          >
            <Suspense fallback={<DeferredTabFallback />}>
              <DuelMatchLazy
                key={selectedLevel}
                level={selectedLevel}
                levelStats={stats}
                displayName={displayName}
                onRecord={handleDuelRecord}
                onExitHome={() => setTab('home')}
              />
            </Suspense>
          </motion.div>
        ) : tab === 'leaders' ? (
          <motion.div
            key="leaders"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[1]"
          >
            <Suspense fallback={<DeferredTabFallback />}>
              <LeaderboardViewLazy
                totalXpAllLevels={totalXpAllLevels}
                displayName={displayName}
                userId={rtdbUserId}
                avatar={profileAvatar}
              />
            </Suspense>
          </motion.div>
        ) : (
          <motion.div
            key="lexicon"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[1]"
          >
            <VocabularyChecker />
          </motion.div>
        )}
      </AnimatePresence>

      {isFirebaseLive && deviceSessionReady ? <FriendsNotificationLayer userId={rtdbUserId} /> : null}

      {isRegistered ? <LeaderboardLiveSync /> : null}

      {isRegistered ? (
        <BottomNav
          active={tab}
          onChange={handleTabChange}
          variant="dark"
          artikBalance={artikBalance}
          onDuelInsufficientArtik={() => setCoinShopOpen(true)}
        />
      ) : null}
      {isRegistered ? (
        <CoinShopSheet open={coinShopOpen} onClose={() => setCoinShopOpen(false)} />
      ) : null}
      {isRegistered ? (
        <VipSubscriptionModal open={vipPaymentOpen} onClose={() => setVipPaymentOpen(false)} />
      ) : null}
    </div>
  );
}
