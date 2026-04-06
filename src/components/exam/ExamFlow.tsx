import { useCallback, useRef, useState } from 'react';
import type { Article, ExamSessionConfig, GoetheLevel, LevelProgressStats, NounEntry } from '../../types';
import { buildExamRows } from './examDeck';
import type { VokabelRow } from '../../lib/vokabelnCsv';
import { useGlossLanguage, useGlossRemote } from '../../hooks/useGlossLanguage';
import { usesRemoteGlossFile } from '../../lib/nounTranslation';
import { ExamArticleQuiz } from './ExamArticleQuiz';
import { ExamResults } from './ExamResults';
import { ExamSettings } from './ExamSettings';

interface ExamFlowProps {
  defaultLevel: GoetheLevel;
  nounsByLevel: Record<GoetheLevel, NounEntry[]>;
  knownWordIds: string[];
  wrongCountByWordId: Record<string, number>;
  byLevel: Record<GoetheLevel, LevelProgressStats>;
  recordAnswer: (
    level: GoetheLevel,
    article: Article,
    correct: boolean,
    wordId: string,
    options?: { xpMultiplier?: number },
  ) => void;
  onGoHome: () => void;
}

type Screen = 'settings' | 'quiz' | 'results';

export function ExamFlow({
  defaultLevel,
  nounsByLevel,
  knownWordIds,
  wrongCountByWordId,
  byLevel,
  recordAnswer,
  onGoHome,
}: ExamFlowProps) {
  const [glossLang] = useGlossLanguage();
  const { remoteGlossById, remoteGlossReady } = useGlossRemote();
  const canStartWithGloss = !usesRemoteGlossFile(glossLang) || remoteGlossReady;
  const glossLoading = usesRemoteGlossFile(glossLang) && !remoteGlossReady;
  const [screen, setScreen] = useState<Screen>('settings');
  const [config, setConfig] = useState<ExamSessionConfig | null>(null);
  const [deck, setDeck] = useState<VokabelRow[]>([]);
  const [result, setResult] = useState<{ correct: number; total: number; xpGained: number } | null>(null);

  const byLevelRef = useRef(byLevel);
  byLevelRef.current = byLevel;
  const startXpRef = useRef(0);
  const finishLevelRef = useRef<GoetheLevel>(defaultLevel);

  const handleStart = useCallback(
    (cfg: ExamSessionConfig) => {
      const remote = usesRemoteGlossFile(glossLang) ? remoteGlossById : null;
      const rows = buildExamRows(
        cfg.level,
        cfg.topics,
        nounsByLevel,
        wrongCountByWordId,
        knownWordIds,
        glossLang,
        remote,
      );
      if (rows.length === 0) return;
      startXpRef.current = byLevelRef.current[cfg.level].xp ?? 0;
      finishLevelRef.current = cfg.level;
      setDeck(rows);
      setConfig(cfg);
      setScreen('quiz');
    },
    [nounsByLevel, wrongCountByWordId, knownWordIds, glossLang],
  );

  const handleExamRecord = useCallback(
    (level: GoetheLevel, article: Article, correct: boolean, wordId: string) => {
      recordAnswer(level, article, correct, wordId, { xpMultiplier: 2 });
    },
    [recordAnswer],
  );

  const handleQuizFinish = useCallback(({ correct, total }: { correct: number; total: number }) => {
    window.setTimeout(() => {
      const lvl = finishLevelRef.current;
      const endXp = byLevelRef.current[lvl].xp ?? 0;
      const gained = Math.max(0, endXp - startXpRef.current);
      setResult({ correct, total, xpGained: gained });
      setConfig(null);
      setDeck([]);
      setScreen('results');
    }, 0);
  }, []);

  const handleAgain = useCallback(() => {
    setResult(null);
    setScreen('settings');
  }, []);

  const handleHomeFromResults = useCallback(() => {
    setResult(null);
    setScreen('settings');
    onGoHome();
  }, [onGoHome]);

  if (screen === 'results' && result) {
    return (
      <ExamResults
        correct={result.correct}
        total={result.total}
        xpGained={result.xpGained}
        onAgain={handleAgain}
        onHome={handleHomeFromResults}
      />
    );
  }

  if (screen === 'quiz' && config && deck.length > 0) {
    return (
      <ExamArticleQuiz
        key={`${config.level}-${config.questions}-${config.topics}-${deck.length}`}
        config={config}
        rows={deck}
        levelStats={byLevel[config.level]}
        onRecord={handleExamRecord}
        onFinish={handleQuizFinish}
      />
    );
  }

  return (
    <ExamSettings
      defaultLevel={defaultLevel}
      nounsByLevel={nounsByLevel}
      knownWordIds={knownWordIds}
      wrongCountByWordId={wrongCountByWordId}
      onStart={handleStart}
      canStartWithGloss={canStartWithGloss}
      glossLoading={glossLoading}
    />
  );
}
