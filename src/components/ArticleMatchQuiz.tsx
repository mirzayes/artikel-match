import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Article, GoetheLevel, LevelProgressStats, WordSrsEntry } from '../types';
import {
  LEARNING_SESSION_GOAL,
  LEARNING_SESSION_POOL_SIZE,
  LESSON_CORRECT_NEW_ARTIK,
  LESSON_CORRECT_REVIEW_ARTIK,
} from '../types';
import type { VokabelRow } from '../lib/vokabelnCsv';
import {
  isRtlGlossLang,
  nounToVokabelRow,
  resolveVokabelRowGloss,
  usesRemoteGlossFile,
} from '../lib/nounTranslation';
import { useGlossLanguage, useGlossRemote } from '../hooks/useGlossLanguage';
import { useVocabulary } from '../context/VocabularyContext';
import {
  allNounsDeduped,
  classifyLessonCoinWordType,
  filterLearningQuizPool,
  filterNounsByIds,
  getSrsLearningSessionPool,
} from '../lib/wordLists';
import { queueUserProgressRemote } from '../lib/supabaseUserProgress';
import {
  playCoinBonusChime,
  playCorrectAnswerBeep,
  playLessonCoinsBlingBurst,
  vibrateWrongAnswer,
} from '../lib/answerFeedbackMedia';
import { ArticleButton, type ArticleBtnMode } from './quiz/ArticleButton';
import { FeedbackBar } from './quiz/FeedbackBar';
import { ProgressBar } from './quiz/ProgressBar';
import { QuizTopBar } from './quiz/QuizTopBar';
import { WordCard } from './quiz/WordCard';
import { getArticleFact } from '../data/articleFacts';
import { getOrCreateDuelUserId } from './DuelGame';
import { ResultView, type SessionCoinRewardSummary, type SessionWordSummary } from './quiz/LearningSessionWin';
import { CoinBalanceMeter } from './CoinBalanceMeter';
import {
  getGoldenHourCoinMultiplier,
  getLessonCoinMultiplier,
  getOdluStreakArtikMultiplier,
} from '../lib/coinBonus';
import { tryClaimA1MasterReward } from '../lib/milestones';
import { avatarIdToEmoji } from '../lib/playerProfileRtdb';
import { useGameStore } from '../store/useGameStore';
import { getAffixWrongTeachHighlight } from '../lib/predictArticleFromAffixRules';

const WORD_TRANSITION_MS = 120;
/** «Çətin söz» — cari söz növbədə ~3–4-cü sıraya qayıdır */
const HARD_REINSERT_OFFSET = 3;
const STREAK_TO_CLEAR_HARD = 3;
/** Sessiyada hər söz üçün mənimsəmə hədəfi (ulduz) */
const SESSION_STAR_MAX = 5;
/** Sessiya sonu əlavə mükafət (Happy Hours ilə vurulur). */
const SESSION_COMPLETION_PERFECT_BONUS = 15;

function clearTimerRef(ref: MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

function defer(fn: () => void) {
  queueMicrotask(fn);
}

function rotateQueue(q: VokabelRow[]): VokabelRow[] {
  if (q.length <= 1) return q;
  const [h, ...r] = q;
  return [...r, h!];
}

function queueAfterHardMark(q: VokabelRow[]): VokabelRow[] {
  if (q.length <= 1) return q;
  const [head, ...rest] = q;
  const at = Math.min(HARD_REINSERT_OFFSET, rest.length);
  return [...rest.slice(0, at), head!, ...rest.slice(at)];
}

type PendingFlush = {
  kind: 'pick';
  ok: boolean;
  wordId: string;
  article: Article;
  word: string;
  translation: string;
  streakAfter: number;
  wordLevel: GoetheLevel;
};

interface ArticleMatchQuizProps {
  level: GoetheLevel;
  levelStats: LevelProgressStats;
  knownWordIds: string[];
  /** Yalnız bu id-lərlə məhdud sessiya (mövzu və ya çətin sözlər). */
  restrictToWordIds?: string[] | null;
  /** `all_levels`: bütün leksikon; `selected_level` — yalnız `level`. */
  learnPoolScope?: 'selected_level' | 'all_levels';
  srsByWordId: Record<string, WordSrsEntry>;
  /** Yalnız Təkrar növbəsi (əvvəl öyrənilmiş / növbəsi çatan). */
  reviewOnly?: boolean;
  /** Proqres zolğunda göstərilən etiket (məs. «Qarışıq»). */
  progressLevelLabel?: string;
  /** Mövzu seçiminə qayıt */
  onAbandonSession?: () => void;
  /** Sessiya bitəndə ikinci düymə mətni (mövzu səhifəsi). */
  sessionExitButtonLabel?: string;
  onRecord: (level: GoetheLevel, article: Article, correct: boolean, wordId: string) => void;
  onEnsureHardWord: (wordId: string) => void;
  onRemoveHardWord: (wordId: string) => void;
  onExitAfterSession?: () => void;
  masteryByWordId: Record<string, number>;
  /** Dəvət mükafatı üçün: bütün səviyyələrdə cəmi XP (referral: > min). */
  totalXpAllLevels?: number;
  /** Odlu 🔥 ardıcıllığı — >3 gün üçün +10% Artik (öyrənmə sessiyası). */
  odluStreakDays?: number;
  /** Missiya «Sonsuz»: bütün sözlər qarışıq, sessiyada təkrar yox */
  missionSessionMode?: 'classic' | 'infinite';
}

/** Fisher–Yates: yalnız göstərilmə sırası üçün (SRS seçimi dəyişmir). */
function fisherYatesShuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function ArticleMatchQuiz({
  level,
  levelStats,
  knownWordIds,
  restrictToWordIds = null,
  learnPoolScope = 'selected_level',
  srsByWordId,
  reviewOnly = false,
  progressLevelLabel,
  onAbandonSession,
  sessionExitButtonLabel,
  onRecord,
  onEnsureHardWord,
  onRemoveHardWord,
  onExitAfterSession,
  masteryByWordId,
  totalXpAllLevels = 0,
  odluStreakDays = 0,
  missionSessionMode = 'classic',
}: ArticleMatchQuizProps) {
  const { t } = useTranslation();
  const { nounsByLevel } = useVocabulary();
  const [glossLang] = useGlossLanguage();
  const { remoteGlossById, remoteGlossReady } = useGlossRemote();
  const playerAvatarId = useGameStore((s) => s.avatar);
  const playerEmoji = avatarIdToEmoji(playerAvatarId);
  const restrictKey = restrictToWordIds?.join('\0') ?? '';
  const missionInfiniteMode = missionSessionMode === 'infinite';
  const missionInfiniteModeRef = useRef(missionInfiniteMode);
  useEffect(() => {
    missionInfiniteModeRef.current = missionInfiniteMode;
  }, [missionInfiniteMode]);
  const totalXpRef = useRef(totalXpAllLevels);
  totalXpRef.current = totalXpAllLevels;

  const [wordQueue, setWordQueue] = useState<VokabelRow[]>([]);
  /** Sessiya başında seçilmiş sözlər (proqres paydası) */
  const [sessionTargetWordIds, setSessionTargetWordIds] = useState<string[]>([]);
  /** Sessiya daxilində hər söz üçün 0…5 ulduz */
  const [sessionMasteryByWordId, setSessionMasteryByWordId] = useState<Record<string, number>>({});

  const [phase, setPhase] = useState<'idle' | 'answered'>('idle');
  const [picked, setPicked] = useState<Article | null>(null);
  const [wordVisible, setWordVisible] = useState(true);

  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionCoinReward, setSessionCoinReward] = useState<SessionCoinRewardSummary | null>(null);
  const [sessionNonce, setSessionNonce] = useState(0);

  const [sessionEasyWords, setSessionEasyWords] = useState<SessionWordSummary[]>([]);
  const [sessionHardWords, setSessionHardWords] = useState<SessionWordSummary[]>([]);

  const [comboLocal, setComboLocal] = useState(0);
  const comboLocalRef = useRef(0);
  useEffect(() => {
    comboLocalRef.current = comboLocal;
  }, [comboLocal]);

  const [comboMsg, setComboMsg] = useState<string | null>(null);
  const [comboShow, setComboShow] = useState(false);
  const [xpPop, setXpPop] = useState(false);
  const [starBurstSeq, setStarBurstSeq] = useState(0);
  const [hardBtnPulse, setHardBtnPulse] = useState(false);

  const sessionPickStreakRef = useRef<Record<string, number>>({});
  const sessionErrorsRef = useRef(0);
  const sessionCorrectCountRef = useRef(0);
  const pendingFlushRef = useRef<PendingFlush | null>(null);
  const prevLevelRef = useRef(level);
  const nextLockRef = useRef(false);
  const [nextBusy, setNextBusy] = useState(false);

  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionWordCoinClassRef = useRef<Record<string, 'new' | 'review'>>({});
  const sessionNewCorrectRef = useRef(0);
  const sessionReviewCorrectRef = useRef(0);

  const triggerStarAnimation = useCallback(() => {
    setStarBurstSeq((s) => s + 1);
  }, []);

  const triggerXpPop = useCallback(() => {
    setXpPop(true);
    if (xpTimerRef.current) clearTimeout(xpTimerRef.current);
    xpTimerRef.current = setTimeout(() => {
      xpTimerRef.current = null;
      setXpPop(false);
    }, 400);
  }, []);

  const appendEasy = useCallback((row: { id: string; word: string; article: Article; translation: string }) => {
    setSessionEasyWords((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
  }, []);

  const appendHard = useCallback((row: { id: string; word: string; article: Article; translation: string }) => {
    setSessionHardWords((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
  }, []);

  /** Tək mənbə: proqres və sayğac eyni state-dən */
  const sessionProgress = useMemo(() => {
    const cap = Math.max(1, sessionTargetWordIds.length * SESSION_STAR_MAX);
    let stars = 0;
    for (const id of sessionTargetWordIds) {
      stars += Math.min(SESSION_STAR_MAX, sessionMasteryByWordId[id] ?? 0);
    }
    return {
      starCap: cap,
      totalStars: stars,
      fraction: cap > 0 ? Math.min(1, stars / cap) : 0,
      label: `${stars} / ${cap}`,
    };
  }, [sessionMasteryByWordId, sessionTargetWordIds]);

  const forceResetSessionUi = useCallback(() => {
    clearTimerRef(transitionTimerRef);
    clearTimerRef(comboTimerRef);
    clearTimerRef(xpTimerRef);
    pendingFlushRef.current = null;
    nextLockRef.current = false;
    setNextBusy(false);
    setPhase('idle');
    setPicked(null);
    setWordVisible(true);
    setComboShow(false);
    sessionPickStreakRef.current = {};
    sessionErrorsRef.current = 0;
    sessionCorrectCountRef.current = 0;
    sessionWordCoinClassRef.current = {};
    sessionNewCorrectRef.current = 0;
    sessionReviewCorrectRef.current = 0;
    setSessionTargetWordIds([]);
    setSessionMasteryByWordId({});
  }, []);

  useEffect(() => {
    const levelChanged = prevLevelRef.current !== level;
    prevLevelRef.current = level;

    forceResetSessionUi();
    setLoadErr(null);
    setSessionEasyWords([]);
    setSessionHardWords([]);

    const baseNouns =
      learnPoolScope === 'all_levels' ? allNounsDeduped(nounsByLevel) : nounsByLevel[level];
    const focused =
      restrictToWordIds != null && restrictToWordIds.length > 0
        ? filterNounsByIds(baseNouns, restrictToWordIds)
        : baseNouns;

    if (restrictToWordIds != null && restrictToWordIds.length === 0) {
      setWordQueue([]);
      setSessionComplete(false);
      setLoadErr(t('quiz.learning_focus_empty', { level }));
      return;
    }

    if (usesRemoteGlossFile(glossLang) && !remoteGlossReady) {
      setWordQueue([]);
      setSessionComplete(false);
      setLoadErr(null);
      return;
    }

    const remote = usesRemoteGlossFile(glossLang) ? remoteGlossById : null;

    if (missionInfiniteMode && restrictToWordIds != null && restrictToWordIds.length > 0) {
      const poolOrdered = fisherYatesShuffle(focused);
      if (!poolOrdered.length) {
        setWordQueue([]);
        setSessionComplete(false);
        setLoadErr(t('quiz.topic_empty'));
        return;
      }

      const coinClass: Record<string, 'new' | 'review'> = {};
      for (const n of poolOrdered) {
        coinClass[n.id] = classifyLessonCoinWordType(n.id, knownWordIds, srsByWordId);
      }
      sessionWordCoinClassRef.current = coinClass;
      sessionNewCorrectRef.current = 0;
      sessionReviewCorrectRef.current = 0;

      const sessionCards = poolOrdered.map((n) => nounToVokabelRow(n, glossLang, remote));
      const ids = sessionCards.map((r) => r.id);
      const initialMastery: Record<string, number> = {};
      for (const id of ids) initialMastery[id] = 0;

      setSessionTargetWordIds(ids);
      setSessionMasteryByWordId(initialMastery);
      setWordQueue(sessionCards);
      setSessionComplete(false);
      setLoadErr(null);

      if (levelChanged) {
        setComboLocal(0);
      }
      return;
    }

    const poolNouns = getSrsLearningSessionPool(
      focused,
      knownWordIds,
      srsByWordId,
      LEARNING_SESSION_POOL_SIZE,
      new Date(),
      { reviewOnly },
    );
    if (!poolNouns.length) {
      setWordQueue([]);
      setSessionComplete(false);
      if (reviewOnly) {
        setLoadErr(t('quiz.review_queue_empty'));
      } else {
        const stillLearning = filterLearningQuizPool(focused, knownWordIds);
        if (stillLearning.length > 0) {
          setLoadErr(t('quiz.srs_nothing_due_now'));
        } else if (restrictToWordIds?.length) {
          setLoadErr(t('quiz.topic_empty'));
        } else if (learnPoolScope === 'all_levels') {
          setLoadErr(t('quiz.empty_pool_all'));
        } else {
          setLoadErr(t('quiz.empty_pool', { level }));
        }
      }
      return;
    }

    const poolOrdered =
      restrictToWordIds != null && restrictToWordIds.length > 0
        ? fisherYatesShuffle(poolNouns)
        : poolNouns;

    const coinClass: Record<string, 'new' | 'review'> = {};
    for (const n of poolOrdered) {
      coinClass[n.id] = classifyLessonCoinWordType(n.id, knownWordIds, srsByWordId);
    }
    sessionWordCoinClassRef.current = coinClass;
    sessionNewCorrectRef.current = 0;
    sessionReviewCorrectRef.current = 0;

    const sessionCards = poolOrdered.map((n) => nounToVokabelRow(n, glossLang, remote));
    const ids = sessionCards.map((r) => r.id);
    const initialMastery: Record<string, number> = {};
    for (const id of ids) initialMastery[id] = 0;

    setSessionTargetWordIds(ids);
    setSessionMasteryByWordId(initialMastery);
    setWordQueue(sessionCards);
    setSessionComplete(false);

    if (levelChanged) {
      setComboLocal(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessiya başında snapshot; SRS/known sessiya bitənə qədər növbəni sıfırlamır
  }, [
    level,
    nounsByLevel,
    sessionNonce,
    forceResetSessionUi,
    restrictKey,
    learnPoolScope,
    reviewOnly,
    t,
    glossLang,
    remoteGlossReady,
    remoteGlossById,
    missionInfiniteMode,
  ]);

  useEffect(() => {
    return () => {
      clearTimerRef(comboTimerRef);
      clearTimerRef(xpTimerRef);
      clearTimerRef(transitionTimerRef);
    };
  }, []);

  const currentWord = wordQueue[0] ?? null;

  const currentDisplayGloss = useMemo(
    () =>
      currentWord
        ? resolveVokabelRowGloss(currentWord, nounsByLevel, glossLang, remoteGlossById)
        : '',
    [currentWord, nounsByLevel, glossLang, remoteGlossById],
  );

  const { fraction: progressFraction, label: positionLabel } = sessionProgress;

  const infiniteMissionTotal = sessionTargetWordIds.length;
  const progressBarLabel =
    missionInfiniteMode && infiniteMissionTotal > 0 && wordQueue.length > 0
      ? `${infiniteMissionTotal - wordQueue.length + 1} / ${infiniteMissionTotal}`
      : positionLabel;
  const progressBarFraction =
    missionInfiniteMode && infiniteMissionTotal > 0
      ? Math.min(1, Math.max(0, (infiniteMissionTotal - wordQueue.length) / infiniteMissionTotal))
      : progressFraction;

  const applyPersistSideEffects = useCallback(
    (p: PendingFlush) => {
      defer(() => {
        onRecord(p.wordLevel, p.article, p.ok, p.wordId);
        triggerXpPop();
        if (p.ok) {
          queueUserProgressRemote({ wordId: p.wordId, level: p.wordLevel, status: 'review' });
          const prevS = sessionPickStreakRef.current[p.wordId] ?? 0;
          const nextS = prevS + 1;
          sessionPickStreakRef.current[p.wordId] = nextS;
          if (nextS >= STREAK_TO_CLEAR_HARD) {
            onRemoveHardWord(p.wordId);
            sessionPickStreakRef.current[p.wordId] = 0;
          }
          const nextCombo = comboLocalRef.current + 1;
          setComboLocal(nextCombo);
          if (nextCombo >= 2) {
            const bonus = 10 + nextCombo * 2;
            setComboMsg(`${nextCombo}× combo  +${bonus} XP`);
            setComboShow(true);
            if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
            comboTimerRef.current = setTimeout(() => {
              comboTimerRef.current = null;
              setComboShow(false);
            }, 1400);
          }
          sessionCorrectCountRef.current += 1;
          const cls = sessionWordCoinClassRef.current[p.wordId];
          if (cls === 'review') sessionReviewCorrectRef.current += 1;
          else sessionNewCorrectRef.current += 1;
        } else {
          sessionErrorsRef.current += 1;
          sessionPickStreakRef.current[p.wordId] = 0;
          setComboLocal(0);
          appendHard({
            id: p.wordId,
            word: p.word,
            article: p.article,
            translation: p.translation,
          });
          onEnsureHardWord(p.wordId);
          queueUserProgressRemote({ wordId: p.wordId, level: p.wordLevel, status: 'hard' });
        }
      });
    },
    [appendHard, onEnsureHardWord, onRecord, onRemoveHardWord, triggerXpPop],
  );

  const runSessionCompleteCelebration = useCallback(() => {
    const errors = sessionErrorsRef.current;
    const inviteeUid = getOrCreateDuelUserId();

    tryClaimA1MasterReward(knownWordIds, masteryByWordId, nounsByLevel.A1);

    const m = getLessonCoinMultiplier(new Date(), odluStreakDays);
    const goldenMul = getGoldenHourCoinMultiplier();
    const streakMul = getOdluStreakArtikMultiplier(odluStreakDays);
    const nNew = sessionNewCorrectRef.current;
    const nRev = sessionReviewCorrectRef.current;
    const baseLesson = nNew * LESSON_CORRECT_NEW_ARTIK + nRev * LESSON_CORRECT_REVIEW_ARTIK;
    const wantCorrect = Math.floor(baseLesson * m);
    const wantPerfect = errors === 0 ? Math.floor(SESSION_COMPLETION_PERFECT_BONUS * m) : 0;
    const wantTotal = wantCorrect + wantPerfect;
    const lessonResult = useGameStore.getState().earnCoinsFromLesson(wantTotal);
    const g = lessonResult.granted;
    let showCr = wantCorrect;
    let showPr = wantPerfect;
    if (wantTotal > 0 && g < wantTotal) {
      showCr = Math.floor((g * wantCorrect) / wantTotal);
      showPr = g - showCr;
    }
    if (g > 0) {
      playLessonCoinsBlingBurst(g);
      if (showPr > 0 && errors === 0) {
        window.setTimeout(() => playCoinBonusChime(), 240 + Math.min(g, 14) * 38);
      }
    }

    useGameStore.getState().completeLearningSession(inviteeUid, totalXpRef.current);

    setSessionCoinReward({
      correctCoins: showCr,
      perfectCoins: showPr,
      total: g,
      errors,
      correctAnswers: sessionCorrectCountRef.current,
      turboActive: goldenMul > 1,
      streakBonusActive: streakMul > 1,
      lessonDailyCapReached: wantTotal > 0 && g < wantTotal,
    });
    setSessionComplete(true);
  }, [knownWordIds, masteryByWordId, nounsByLevel.A1, odluStreakDays]);

  /** Cavabdan sonra: neutral — növbə; hard — çətin + arxaya */
  const advanceFromAnswered = useCallback(
    (mode: 'neutral' | 'hard') => {
      if (phase !== 'answered' || nextLockRef.current) return;
      const p = pendingFlushRef.current;
      if (!p) return;

      nextLockRef.current = true;
      setNextBusy(true);
      pendingFlushRef.current = null;

      applyPersistSideEffects(p);

      let masteredNeutral = false;

      if (mode === 'hard') {
        if (p.ok) {
          appendHard({
            id: p.wordId,
            word: p.word,
            article: p.article,
            translation: p.translation,
          });
          defer(() => {
            onEnsureHardWord(p.wordId);
            queueUserProgressRemote({ wordId: p.wordId, level: p.wordLevel, status: 'hard' });
          });
        }
        sessionPickStreakRef.current[p.wordId] = 0;
        setHardBtnPulse(true);
        window.setTimeout(() => setHardBtnPulse(false), 900);
      } else {
        masteredNeutral = p.ok && p.streakAfter >= SESSION_STAR_MAX;
        if (masteredNeutral) {
          appendEasy({
            id: p.wordId,
            word: p.word,
            article: p.article,
            translation: p.translation,
          });
          onRemoveHardWord(p.wordId);
        }
      }

      setWordVisible(false);
      clearTimerRef(transitionTimerRef);
      transitionTimerRef.current = setTimeout(() => {
        transitionTimerRef.current = null;
        setPhase('idle');
        setPicked(null);
        setWordQueue((q) => {
          if (missionInfiniteModeRef.current) {
            const rest = q.slice(1);
            if (rest.length === 0) {
              queueMicrotask(() => {
                runSessionCompleteCelebration();
              });
            }
            return rest;
          }
          if (mode === 'hard') {
            return queueAfterHardMark(q);
          }
          if (masteredNeutral) {
            const next = q.filter((x) => x.id !== p.wordId);
            if (next.length === 0) {
              queueMicrotask(() => {
                runSessionCompleteCelebration();
              });
            }
            return next;
          }
          return rotateQueue(q);
        });
        setWordVisible(true);
        nextLockRef.current = false;
        setNextBusy(false);
      }, WORD_TRANSITION_MS);
    },
    [
      appendEasy,
      appendHard,
      applyPersistSideEffects,
      knownWordIds,
      masteryByWordId,
      nounsByLevel.A1,
      onEnsureHardWord,
      onRemoveHardWord,
      phase,
      runSessionCompleteCelebration,
    ],
  );

  const handlePick = useCallback(
    (a: Article) => {
      if (!currentWord || phase !== 'idle') return;

      setPicked(a);
      setPhase('answered');

      const ok = a === currentWord.article;
      if (ok) {
        playCorrectAnswerBeep();
        triggerStarAnimation();
      } else {
        vibrateWrongAnswer();
      }

      const prevStreak = sessionMasteryByWordId[currentWord.id] ?? 0;
      const streakAfter = ok ? Math.min(SESSION_STAR_MAX, prevStreak + 1) : 0;
      setSessionMasteryByWordId((prev) => ({ ...prev, [currentWord.id]: streakAfter }));

      pendingFlushRef.current = {
        kind: 'pick',
        ok,
        wordId: currentWord.id,
        article: currentWord.article,
        word: currentWord.word,
        translation: resolveVokabelRowGloss(currentWord, nounsByLevel, glossLang, remoteGlossById),
        streakAfter,
        wordLevel: currentWord.level ?? level,
      };
    },
    [currentWord, phase, sessionMasteryByWordId, triggerStarAnimation, nounsByLevel, glossLang, remoteGlossById],
  );

  const btnMode = useCallback(
    (a: Article): ArticleBtnMode => {
      if (phase === 'idle' || !currentWord) return 'idle';
      if (picked === currentWord.article) {
        return a === currentWord.article ? 'correct' : 'idle';
      }
      if (picked === a) return 'wrong';
      if (a === currentWord.article) return 'reveal';
      return 'idle';
    },
    [currentWord, phase, picked],
  );

  const isCorrectPick = Boolean(picked !== null && currentWord && picked === currentWord.article);

  if (loadErr) {
    return (
      <div
        className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 px-6 pb-32 text-center text-sm"
        style={{ background: 'var(--artikl-bg)', color: 'var(--artikl-muted2)' }}
      >
        <p>{loadErr}</p>
        {onAbandonSession ? (
          <button
            type="button"
            onClick={onAbandonSession}
            className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs font-semibold text-artikl-text/85 backdrop-blur-[10px] transition-colors hover:border-white/25"
          >
            {sessionExitButtonLabel ?? t('learning_topics.back_topics')}
          </button>
        ) : null}
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <ResultView
        goal={sessionTargetWordIds.length || LEARNING_SESSION_GOAL}
        easyWords={sessionEasyWords}
        hardWords={sessionHardWords}
        coinReward={sessionCoinReward}
        glossRtl={isRtlGlossLang(glossLang)}
        secondaryActionLabel={sessionExitButtonLabel ?? t('learning_topics.back_topics')}
        titleOverride={
          missionInfiniteMode ? t('learning_topics.mission_complete_infinite_title') : null
        }
        subtitleOverride={
          missionInfiniteMode
            ? t('learning_topics.mission_complete_infinite_sub', {
                n: sessionTargetWordIds.length,
              })
            : null
        }
        onHome={() => onExitAfterSession?.()}
        onRestart={() => {
          setSessionCoinReward(null);
          setSessionComplete(false);
          setLoadErr(null);
          setSessionNonce((x) => x + 1);
        }}
      />
    );
  }

  const deckExhaustedBeforeGoal =
    !missionInfiniteMode &&
    wordQueue.length === 0 &&
    sessionTargetWordIds.length > 0 &&
    sessionProgress.totalStars < sessionProgress.starCap;

  if (deckExhaustedBeforeGoal) {
    return (
      <div
        className="flex min-h-[50dvh] flex-col items-center justify-center px-6 pb-32 text-center text-sm"
        style={{ background: 'var(--artikl-bg)', color: 'var(--artikl-muted2)' }}
      >
        <p>
          Növbədə söz qalmadı, ulduz hədəfi tamamlanmadı. Ana səhifədən yenidən «Öyrənməyə başla» seçin.
        </p>
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div
        className="flex min-h-[50dvh] flex-col items-center justify-center pb-32 text-sm"
        style={{ background: 'var(--artikl-bg)', color: 'var(--artikl-muted2)' }}
      >
        Yüklənir…
      </div>
    );
  }

  const sessionStarsForCard = sessionMasteryByWordId[currentWord.id] ?? 0;

  const wrongAffixTeach =
    phase === 'answered' && !isCorrectPick
      ? getAffixWrongTeachHighlight(currentWord.word, currentWord.article)
      : null;

  return (
    <div
      className="flex min-h-[100dvh] justify-center pb-36 pt-[max(0px,env(safe-area-inset-top))]"
      style={{ background: 'var(--artikl-bg)' }}
    >
      <div className="artikl-scene">
        <div className="flex w-full max-w-[min(100%,420px)] items-start justify-between gap-2 px-1 pb-1">
          {onAbandonSession ? (
            <button
              type="button"
              onClick={onAbandonSession}
              className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-artikl-text/70 backdrop-blur-[10px] transition-colors hover:border-white/20 hover:text-artikl-text/90 active:scale-[0.98]"
            >
              ← {sessionExitButtonLabel ?? t('learning_topics.back_topics')}
            </button>
          ) : (
            <span />
          )}
          <CoinBalanceMeter compact className="shrink-0" />
        </div>
        <QuizTopBar stats={levelStats} xpPop={xpPop} playerEmoji={playerEmoji} />
        <ProgressBar
          levelLabel={progressLevelLabel ?? level}
          positionLabel={progressBarLabel}
          fraction={progressBarFraction}
          stats={levelStats}
          fillClassName="artikl-prog-fill--smooth"
        />
        <div key={currentWord.id} className="w-full artikl-word-shell">
          <WordCard
            variant="learn"
            wordKey={currentWord.id}
            word={currentWord.word}
            cardLabel={reviewOnly ? t('quiz.card_label_repeat') : t('quiz.card_label')}
            correctArticle={currentWord.article}
            translation={currentDisplayGloss}
            translationRtl={isRtlGlossLang(glossLang)}
            glossLang={glossLang}
            wordVisible={wordVisible}
            showAnswer={phase === 'answered'}
            highlightArticle={phase === 'answered' ? currentWord.article : null}
            glowArticle={isCorrectPick ? currentWord.article : null}
            comboToast={comboMsg}
            comboToastVisible={comboShow}
            masteryStarLevel={sessionStarsForCard}
            starBurstSeq={starBurstSeq}
            wrongAffixTeach={wrongAffixTeach}
          />
        </div>
        {phase === 'answered' ? (
          <FeedbackBar ok={isCorrectPick} fact={isCorrectPick ? getArticleFact(currentWord.word) : null}>
            {isCorrectPick ? (
              <>
                Düzgün!{' '}
                <strong>
                  {currentWord.article} {currentWord.word}
                </strong>{' '}
                — {currentDisplayGloss}
              </>
            ) : (
              <>
                Səhv.{' '}
                <strong>
                  {currentWord.article} {currentWord.word}
                </strong>{' '}
                — {currentDisplayGloss}
              </>
            )}
          </FeedbackBar>
        ) : null}

        {phase === 'answered' ? (
          <div
            className={[
              'artikl-post-row',
              missionInfiniteMode ? '' : 'artikl-post-row--dual',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-live="polite"
          >
            <button
              type="button"
              className="artikl-glass-btn artikl-glass-btn--violet"
              onClick={() => advanceFromAnswered('neutral')}
              disabled={nextBusy}
            >
              Növbəti
            </button>
            {!missionInfiniteMode ? (
              <button
                type="button"
                className={`artikl-glass-btn artikl-glass-btn--ember ${hardBtnPulse ? 'artikl-glass-btn--pulse' : ''}`.trim()}
                onClick={() => advanceFromAnswered('hard')}
                disabled={nextBusy}
              >
                Çətin söz
              </button>
            ) : null}
          </div>
        ) : null}

        {phase === 'idle' ? (
          <div className="artikl-btns">
            {(['der', 'die', 'das'] as const).map((a) => (
              <ArticleButton key={a} article={a} mode={btnMode(a)} disabled={false} onPick={handlePick} />
            ))}
          </div>
        ) : null}

        <div className="artikl-flex-space" />
      </div>
    </div>
  );
}
