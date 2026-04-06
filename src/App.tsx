import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav, type Tab } from './components/BottomNav';
import { AmbientOrbs } from './components/layout/AmbientOrbs';
import { Dashboard } from './components/Dashboard';
import { ArticleMatchQuiz } from './components/ArticleMatchQuiz';
import { LearningTopicHub } from './components/learning/LearningTopicHub';
import { ExamFlow } from './components/exam/ExamFlow';
import { DuelMatch } from './components/DuelMatch';
import { getOrCreateDuelUserId } from './components/DuelGame';
import { FriendsNotificationLayer } from './components/FriendsNotificationLayer';
import { VocabularyChecker } from './components/VocabularyChecker';
import { PlayerRegistrationScreen } from './components/PlayerRegistrationScreen';
import { syncDailyStreak } from './lib/dailyStreak';
import { isFirebaseLive } from './lib/firebase';
import { bindAppPresence } from './lib/userPresenceRtdb';
import { setPlayerAvatar, setPlayerProfileDisplayName } from './lib/playerProfileRtdb';
import { useQuizProgress } from './hooks/useQuizProgress';
import { useGameStoreRehydrated } from './hooks/useGameStoreRehydrated';
import { useGameStore } from './store/useGameStore';
import { useVocabulary } from './context/VocabularyContext';
import type { Article, GoetheLevel } from './types';

type LearnQuizConfig = {
  restrictIds: string[] | null;
  poolScope: 'selected_level' | 'all_levels';
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
    hardWordIds,
    knownWordIds,
    masteryByWordId,
    recordAnswer,
    byLevel,
    resetProgress,
    toggleKnownWord,
    ensureHardWord,
    removeHardWord,
  } = useQuizProgress();
  const { nounsByLevel } = useVocabulary();

  const rtdbUserId = useMemo(() => getOrCreateDuelUserId(), []);
  const gameStoreHydrated = useGameStoreRehydrated();
  const isRegistered = useGameStore((s) => s.isRegistered);
  const profilePlayerName = useGameStore((s) => s.playerName);
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

  useEffect(() => {
    syncDailyStreak();
  }, []);

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
    if (!isFirebaseLive) return;
    void bindAppPresence(rtdbUserId);
  }, [rtdbUserId]);

  useEffect(() => {
    if (!isFirebaseLive) return;
    const n = (profilePlayerName || displayName).trim();
    if (!n) return;
    void setPlayerProfileDisplayName(rtdbUserId, n);
  }, [displayName, profilePlayerName, rtdbUserId]);

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

  const handleSaveDisplayName = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      setDisplayName(trimmed);
      if (isFirebaseLive) void setPlayerProfileDisplayName(rtdbUserId, trimmed);
    },
    [rtdbUserId, setDisplayName],
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
    setLearnQuizConfig({ restrictIds: null, poolScope: 'selected_level' });
    setLearnSubView('quiz');
    setLearnMountKey((k) => k + 1);
    setTab('quiz');
  }, [rtdbUserId, setDisplayName]);

  const handleTabChange = useCallback((next: Tab) => {
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
    setLearnSubView('topics');
    setLearnQuizConfig(null);
    setTab('quiz');
  }, []);

  const startLearnHardFocus = useCallback((wordIds: string[]) => {
    setLearnQuizConfig({
      restrictIds: wordIds.length > 0 ? [...wordIds] : null,
      poolScope: 'selected_level',
    });
    setLearnSubView('quiz');
    setLearnMountKey((k) => k + 1);
    setTab('quiz');
  }, []);

  const enterLearnFromProfile = useCallback(() => {
    setLearnQuizConfig({ restrictIds: null, poolScope: 'selected_level' });
    setLearnSubView('quiz');
    setLearnMountKey((k) => k + 1);
    setTab('quiz');
  }, []);

  const showRegistrationGate = gameStoreHydrated && !isRegistered;

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[var(--artikl-bg)]">
      {!showRegistrationGate ? <AmbientOrbs /> : null}

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
            <PlayerRegistrationScreen onComplete={handleRegistrationComplete} />
          </motion.div>
        ) : tab === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[1]"
          >
            <Dashboard
              stats={stats}
              totalXpAllLevels={totalXpAllLevels}
              odluSeriya={odluSeriya}
              displayName={displayName}
              onSaveDisplayName={handleSaveDisplayName}
              hardWordIds={hardWordIds}
              knownWordIds={knownWordIds}
              masteryByWordId={masteryByWordId}
              selectedLevel={selectedLevel}
              onLevelChange={setSelectedLevel}
              onStartQuiz={startLearnFull}
              onStartLearnHardWords={startLearnHardFocus}
              onStartExam={() => setTab('exam')}
              onStartDuel={() => setTab('duel')}
              onToggleKnown={toggleKnownWord}
              onReset={() => {
                if (window.confirm(t('app.reset_confirm'))) resetProgress();
              }}
              onProfileEnterGame={enterLearnFromProfile}
            />
          </motion.div>
        ) : tab === 'quiz' ? (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
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
                    onStartLevel={() => {
                      setLearnQuizConfig({ restrictIds: null, poolScope: 'selected_level' });
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
                    learnPoolScope={learnQuizConfig.poolScope}
                    restrictToWordIds={learnQuizConfig.restrictIds}
                    progressLevelLabel={undefined}
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
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[1]"
          >
            <ExamFlow
              defaultLevel={selectedLevel}
              nounsByLevel={nounsByLevel}
              knownWordIds={knownWordIds}
              wrongCountByWordId={wrongCountByWordId}
              byLevel={byLevel}
              recordAnswer={recordAnswer}
              onGoHome={() => setTab('home')}
            />
          </motion.div>
        ) : tab === 'duel' ? (
          <motion.div
            key="duel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[1]"
          >
            <DuelMatch
              key={selectedLevel}
              level={selectedLevel}
              levelStats={stats}
              displayName={displayName}
              onRecord={handleDuelRecord}
              onExitHome={() => setTab('home')}
            />
          </motion.div>
        ) : (
          <motion.div
            key="lexicon"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[1]"
          >
            <VocabularyChecker />
          </motion.div>
        )}
      </AnimatePresence>

      {isFirebaseLive ? <FriendsNotificationLayer userId={rtdbUserId} /> : null}

      {isRegistered ? (
        <BottomNav active={tab} onChange={handleTabChange} variant="dark" />
      ) : null}
    </div>
  );
}
