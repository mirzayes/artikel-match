import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Article, GoetheLevel, LevelProgressStats } from '../types';
import { LEARNING_SESSION_GOAL } from '../types';
import { shuffleInPlace, type VokabelRow } from '../lib/vokabelnCsv';
import {
  isRtlGlossLang,
  nounToVokabelRow,
  resolveVokabelRowGloss,
  usesRemoteGlossFile,
} from '../lib/nounTranslation';
import { useGlossLanguage, useGlossRemote } from '../hooks/useGlossLanguage';
import { useVocabulary } from '../context/VocabularyContext';
import { allNounsDeduped, filterNounsByIds, filterLearningQuizPool } from '../lib/wordLists';
import { queueUserProgressRemote } from '../lib/supabaseUserProgress';
import { playCorrectAnswerBeep, vibrateWrongAnswer } from '../lib/answerFeedbackMedia';
import { ArticleButton, type ArticleBtnMode } from './quiz/ArticleButton';
import { FeedbackBar } from './quiz/FeedbackBar';
import { ProgressBar } from './quiz/ProgressBar';
import { QuizTopBar } from './quiz/QuizTopBar';
import { WordCard } from './quiz/WordCard';
import { getArticleFact } from '../data/articleFacts';
import { ResultView, type SessionWordSummary } from './quiz/LearningSessionWin';
import { avatarIdToEmoji } from '../lib/playerProfileRtdb';
import { useGameStore } from '../store/useGameStore';
import { getAffixWrongTeachHighlight } from '../lib/predictArticleFromAffixRules';

const WORD_TRANSITION_MS = 120;
/** «Çətin söz» — cari söz növbədə ~3–4-cü sıraya qayıdır */
const HARD_REINSERT_OFFSET = 3;
const STREAK_TO_CLEAR_HARD = 3;
/** Sessiyada hər söz üçün mənimsəmə hədəfi (ulduz) */
const SESSION_STAR_MAX = 5;

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
}

export function ArticleMatchQuiz({
  level,
  levelStats,
  knownWordIds,
  restrictToWordIds = null,
  learnPoolScope = 'selected_level',
  progressLevelLabel,
  onAbandonSession,
  sessionExitButtonLabel,
  onRecord,
  onEnsureHardWord,
  onRemoveHardWord,
  onExitAfterSession,
}: ArticleMatchQuizProps) {
  const { t } = useTranslation();
  const { nounsByLevel } = useVocabulary();
  const [glossLang] = useGlossLanguage();
  const { remoteGlossById, remoteGlossReady } = useGlossRemote();
  const playerAvatarId = useGameStore((s) => s.avatar);
  const playerEmoji = avatarIdToEmoji(playerAvatarId);
  const restrictKey = restrictToWordIds?.join('\0') ?? '';

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
  const pendingFlushRef = useRef<PendingFlush | null>(null);
  const prevLevelRef = useRef(level);
  const nextLockRef = useRef(false);
  const [nextBusy, setNextBusy] = useState(false);

  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const eligible = filterLearningQuizPool(focused, knownWordIds);
    if (!eligible.length) {
      setWordQueue([]);
      setSessionComplete(false);
      if (restrictToWordIds?.length) {
        setLoadErr(t('quiz.topic_empty'));
      } else if (learnPoolScope === 'all_levels') {
        setLoadErr(t('quiz.empty_pool_all'));
      } else {
        setLoadErr(t('quiz.empty_pool', { level }));
      }
      return;
    }

    const shuffled = eligible.map((n) => nounToVokabelRow(n, glossLang, remote));
    shuffleInPlace(shuffled);
    const sessionCards = shuffled;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnız sessiya başlanğıcı üçün snapshot
  }, [
    level,
    nounsByLevel,
    sessionNonce,
    forceResetSessionUi,
    restrictKey,
    learnPoolScope,
    t,
    glossLang,
    remoteGlossReady,
    remoteGlossById,
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
        } else {
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
          if (mode === 'hard') {
            return queueAfterHardMark(q);
          }
          if (masteredNeutral) {
            const next = q.filter((x) => x.id !== p.wordId);
            if (next.length === 0) queueMicrotask(() => setSessionComplete(true));
            return next;
          }
          return rotateQueue(q);
        });
        setWordVisible(true);
        nextLockRef.current = false;
        setNextBusy(false);
      }, WORD_TRANSITION_MS);
    },
    [appendEasy, appendHard, applyPersistSideEffects, onEnsureHardWord, onRemoveHardWord, phase],
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
            className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs font-semibold text-white/85 backdrop-blur-[10px] transition-colors hover:border-white/25"
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
        glossRtl={isRtlGlossLang(glossLang)}
        secondaryActionLabel={sessionExitButtonLabel ?? t('learning_topics.back_topics')}
        onHome={() => onExitAfterSession?.()}
        onRestart={() => {
          setSessionComplete(false);
          setLoadErr(null);
          setSessionNonce((x) => x + 1);
        }}
      />
    );
  }

  const deckExhaustedBeforeGoal =
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
        {onAbandonSession ? (
          <div className="flex w-full max-w-[min(100%,420px)] justify-start px-1 pb-1">
            <button
              type="button"
              onClick={onAbandonSession}
              className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur-[10px] transition-colors hover:border-white/20 hover:text-white/90 active:scale-[0.98]"
            >
              ← {sessionExitButtonLabel ?? t('learning_topics.back_topics')}
            </button>
          </div>
        ) : null}
        <QuizTopBar stats={levelStats} xpPop={xpPop} playerEmoji={playerEmoji} />
        <ProgressBar
          levelLabel={progressLevelLabel ?? level}
          positionLabel={positionLabel}
          fraction={progressFraction}
          stats={levelStats}
          fillClassName="artikl-prog-fill--smooth"
        />
        <div key={currentWord.id} className="w-full artikl-word-shell">
          <WordCard
            variant="learn"
            wordKey={currentWord.id}
            word={currentWord.word}
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
          <div className="artikl-post-row artikl-post-row--dual" aria-live="polite">
            <button
              type="button"
              className="artikl-glass-btn artikl-glass-btn--violet"
              onClick={() => advanceFromAnswered('neutral')}
              disabled={nextBusy}
            >
              Növbəti
            </button>
            <button
              type="button"
              className={`artikl-glass-btn artikl-glass-btn--ember ${hardBtnPulse ? 'artikl-glass-btn--pulse' : ''}`.trim()}
              onClick={() => advanceFromAnswered('hard')}
              disabled={nextBusy}
            >
              Çətin söz
            </button>
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
