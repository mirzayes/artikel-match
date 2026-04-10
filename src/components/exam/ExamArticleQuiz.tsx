import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Article, ExamSessionConfig, GoetheLevel, LevelProgressStats } from '../../types';
import { QUIZ_MAX_LIVES, useQuizLives } from '../../hooks/useQuizLives';
import { getArticleFact } from '../../data/articleFacts';
import type { VokabelRow } from '../../lib/vokabelnCsv';
import { ArticleButton, type ArticleBtnMode } from '../quiz/ArticleButton';
import { FeedbackBar } from '../quiz/FeedbackBar';
import { ProgressBar } from '../quiz/ProgressBar';
import { QuizTopBar } from '../quiz/QuizTopBar';
import { WordCard } from '../quiz/WordCard';
import { useGlossLanguage, useGlossRemote } from '../../hooks/useGlossLanguage';
import { useVocabulary } from '../../context/VocabularyContext';
import { isRtlGlossLang, resolveVokabelRowGloss } from '../../lib/nounTranslation';
import { buildFiniteQuestionOrder, buildInfiniteCycleOrder, examQuestionCount } from './examDeck';
import { avatarIdToEmoji } from '../../lib/playerProfileRtdb';
import { vibrateCorrectAnswer, vibrateWrongAnswer } from '../../lib/answerFeedbackMedia';
import { useGameStore } from '../../store/useGameStore';

function parseArticleInput(raw: string): Article | null {
  const t = raw.trim().toLowerCase();
  if (t === 'der' || t === 'die' || t === 'das') return t;
  return null;
}

interface ExamArticleQuizProps {
  config: ExamSessionConfig;
  rows: VokabelRow[];
  levelStats: LevelProgressStats;
  onRecord: (level: GoetheLevel, article: Article, correct: boolean, wordId: string) => void;
  onFinish: (payload: { correct: number; total: number }) => void;
}

export function ExamArticleQuiz({ config, rows, levelStats, onRecord, onFinish }: ExamArticleQuizProps) {
  const [glossLang] = useGlossLanguage();
  const { remoteGlossById } = useGlossRemote();
  const { nounsByLevel } = useVocabulary();
  const playerAvatarId = useGameStore((s) => s.avatar);
  const playerEmoji = avatarIdToEmoji(playerAvatarId);
  const level = config.level;
  const targetTotal = examQuestionCount(config);
  const { lives, loseLife, gainLifeFromRecovery } = useQuizLives();

  const order = useMemo(() => {
    const len = rows.length;
    if (len === 0) return [];
    if (targetTotal === null) return buildInfiniteCycleOrder(len);
    return buildFiniteQuestionOrder(len, targetTotal);
  }, [rows.length, targetTotal, config.level, config.questions, config.topics]);

  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'answered'>('idle');
  const [picked, setPicked] = useState<Article | null>(null);
  const [wordVisible, setWordVisible] = useState(true);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [xpPop, setXpPop] = useState(false);
  const [recoverInput, setRecoverInput] = useState('');
  const [recoverErr, setRecoverErr] = useState<string | null>(null);
  const xpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef({ c: 0, t: 0 });

  useEffect(() => {
    setCursor(0);
    setPhase('idle');
    setPicked(null);
    setSessionCorrect(0);
    setSessionAnswered(0);
    setWordVisible(true);
  }, [config, order]);

  useEffect(() => {
    sessionRef.current = { c: sessionCorrect, t: sessionAnswered };
  }, [sessionCorrect, sessionAnswered]);

  useEffect(() => {
    return () => {
      if (xpTimerRef.current) clearTimeout(xpTimerRef.current);
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    };
  }, []);

  const triggerXpPop = useCallback(() => {
    setXpPop(true);
    if (xpTimerRef.current) clearTimeout(xpTimerRef.current);
    xpTimerRef.current = setTimeout(() => {
      xpTimerRef.current = null;
      setXpPop(false);
    }, 400);
  }, []);

  const len = rows.length;
  const rowIndex =
    len === 0
      ? 0
      : targetTotal === null
        ? order[cursor % len]!
        : order[cursor]!;
  const current = len ? rows[rowIndex]! : null;

  const currentDisplayGloss = useMemo(
    () =>
      current ? resolveVokabelRowGloss(current, nounsByLevel, glossLang, remoteGlossById) : '',
    [current, nounsByLevel, glossLang, remoteGlossById],
  );

  useEffect(() => {
    setRecoverInput('');
    setRecoverErr(null);
  }, [current?.id]);

  const finiteTotal = targetTotal ?? 0;
  const progressFraction =
    targetTotal === null
      ? 0
      : finiteTotal > 0
        ? Math.min(1, sessionAnswered / finiteTotal)
        : 0;

  const positionLabel =
    targetTotal === null
      ? `Sual ${sessionAnswered + (phase === 'idle' ? 1 : 0)}`
      : `${Math.min(sessionAnswered + (phase === 'idle' ? 1 : 0), finiteTotal)} / ${finiteTotal}`;

  const sessionAccLabel =
    sessionAnswered === 0 ? '—' : `${Math.round((sessionCorrect / sessionAnswered) * 100)}%`;

  const handlePick = useCallback(
    (a: Article) => {
      if (!current || phase !== 'idle') return;
      setPicked(a);
      setPhase('answered');
      const ok = a === current.article;
      onRecord(level, current.article, ok, current.id);
      triggerXpPop();
      setSessionAnswered((n) => n + 1);
      if (ok) {
        vibrateCorrectAnswer();
        setSessionCorrect((n) => n + 1);
      } else {
        vibrateWrongAnswer();
        loseLife();
      }
    },
    [current, level, loseLife, onRecord, phase, triggerXpPop],
  );

  const handleRecoverySubmit = useCallback(() => {
    if (!current || phase !== 'idle' || lives !== 0) return;
    const a = parseArticleInput(recoverInput);
    if (!a) {
      setRecoverErr('der, die və ya das yazın');
      return;
    }
    if (a !== current.article) {
      vibrateWrongAnswer();
      setRecoverErr('Düzgün deyil');
      return;
    }
    setRecoverErr(null);
    setRecoverInput('');
    gainLifeFromRecovery();
    handlePick(a);
  }, [current, gainLifeFromRecovery, handlePick, lives, phase, recoverInput]);

  const completeSession = useCallback(() => {
    const { c, t } = sessionRef.current;
    onFinish({ correct: c, total: t });
  }, [onFinish]);

  const handleNext = useCallback(() => {
    if (!current) return;
    const atEnd =
      targetTotal !== null && finiteTotal > 0 && sessionAnswered >= finiteTotal && phase === 'answered';

    if (atEnd) {
      completeSession();
      return;
    }

    setWordVisible(false);
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(() => {
      nextTimerRef.current = null;
      setCursor((c) => c + 1);
      setPhase('idle');
      setPicked(null);
      setWordVisible(true);
    }, 120);
  }, [completeSession, current, finiteTotal, phase, sessionAnswered, targetTotal]);

  const handleEndInfinite = useCallback(() => {
    const { c, t } = sessionRef.current;
    if (t === 0) return;
    window.setTimeout(() => onFinish({ correct: c, total: t }), 0);
  }, [onFinish]);

  const isCorrectPick = Boolean(picked !== null && current && picked === current.article);

  const showArticleRecovery = lives === 0 && phase === 'idle';

  const btnMode = useCallback(
    (a: Article): ArticleBtnMode => {
      if (phase === 'idle' || !current) return 'idle';
      if (picked === current.article) {
        return a === current.article ? 'correct' : 'idle';
      }
      if (picked === a) return 'wrong';
      if (a === current.article) return 'reveal';
      return 'idle';
    },
    [current, phase, picked],
  );

  if (!current || len === 0) {
    return (
      <div
        className="flex min-h-[50dvh] flex-col items-center justify-center px-6 pb-32 text-center text-sm"
        style={{ background: 'var(--artikl-bg)', color: 'var(--artikl-muted2)' }}
      >
        <p>Söz siyahısı boşdur.</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] justify-center pb-36 pt-[max(0px,env(safe-area-inset-top))]"
      style={{ background: 'var(--artikl-bg)' }}
    >
      <div className="artikl-scene">
        <div className="flex w-full max-w-[min(100%,420px)] items-center justify-end gap-2 px-1 pb-1">
          {targetTotal === null ? (
            <button
              type="button"
              onClick={handleEndInfinite}
              disabled={sessionAnswered === 0}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-artikl-text transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Testi bitir
            </button>
          ) : null}
        </div>
        <QuizTopBar
          stats={levelStats}
          xpPop={xpPop}
          hearts={{ filled: lives, max: QUIZ_MAX_LIVES }}
          playerEmoji={playerEmoji}
        />
        <ProgressBar
          levelLabel={level}
          positionLabel={positionLabel}
          fraction={progressFraction}
          stats={levelStats}
          accuracyLabel={sessionAccLabel}
          modeChip="Sınaq"
        />
        <WordCard
          variant="exam"
          wordKey={current.id}
          word={current.word}
          correctArticle={current.article}
          translation={currentDisplayGloss}
          translationRtl={isRtlGlossLang(glossLang)}
          glossLang={glossLang}
          wordVisible={wordVisible}
          showAnswer={phase === 'answered'}
          highlightArticle={phase === 'answered' ? current.article : null}
          glowArticle={isCorrectPick ? current.article : null}
          comboToast={null}
          comboToastVisible={false}
          cardLabel=""
        />
        {phase === 'answered' ? (
          <FeedbackBar ok={isCorrectPick} fact={isCorrectPick ? getArticleFact(current.word) : null}>
            {isCorrectPick ? (
              <>
                Düzgün!{' '}
                <strong>
                  {current.article} {current.word}
                </strong>{' '}
                — {currentDisplayGloss}
              </>
            ) : (
              <>
                Səhv.{' '}
                <strong>
                  {current.article} {current.word}
                </strong>{' '}
                — {currentDisplayGloss}
              </>
            )}
          </FeedbackBar>
        ) : null}

        {showArticleRecovery ? (
          <div className="artikl-recover">
            <input
              className="artikl-recover-input"
              value={recoverInput}
              onChange={(e) => {
                setRecoverInput(e.target.value);
                setRecoverErr(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRecoverySubmit();
              }}
              placeholder="der / die / das"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
            />
            <button type="button" className="artikl-recover-submit" onClick={handleRecoverySubmit}>
              Təsdiq et
            </button>
            {recoverErr ? <p className="artikl-recover-err">{recoverErr}</p> : null}
            <p className="artikl-recover-hint">Can bitib — düzgün artikli yazın (+1 can)</p>
          </div>
        ) : (
          <div className="artikl-btns">
            {(['der', 'die', 'das'] as const).map((a) => (
              <ArticleButton
                key={a}
                article={a}
                mode={btnMode(a)}
                disabled={phase === 'answered'}
                onPick={handlePick}
              />
            ))}
          </div>
        )}

        <div className="artikl-actions">
          {phase === 'answered' ? (
            <div className="artikl-next-row artikl-next-row-show flex justify-center">
              <button type="button" className="artikl-next-btn" onClick={handleNext}>
                {targetTotal !== null && sessionAnswered >= finiteTotal ? 'Nəticəni gör' : 'Növbəti sual'}
              </button>
            </div>
          ) : null}
        </div>

        <div className="artikl-flex-space" />
      </div>
    </div>
  );
}
